using TinyRustLM;

namespace TinyRustLM.Companion;

/// <summary>
/// Runs or recovers the sole registered source operation with one exclusive owner.
/// </summary>
public sealed class CompanionProductionOperationExecutor :
    ICompanionOperationExecutor,
    IAsyncDisposable
{
    private static readonly TimeSpan CancellationPollInterval =
        TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan CancellationWait = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan JournalReadRetry = TimeSpan.FromMilliseconds(10);
    private const int MaximumJournalReadAttempts = 8;

    private readonly CompanionOperationJournal _journal;
    private readonly CompanionSourceAcquisition _acquisition;
    private readonly CompanionSourceConversion _conversion;
    private readonly string _journalRoot;
    private readonly string _workRoot;
    private readonly string _workerSha256;
    private readonly string _converterSha256;
    private readonly object _workersGate = new();
    private readonly Dictionary<string, WorkerHandle> _workers = new(StringComparer.Ordinal);
    private readonly CancellationTokenSource _shutdown = new();
    private int _disposeState;

    /// <summary>Creates one executor bound to fixed journal, work, worker, and converter identities.</summary>
    internal CompanionProductionOperationExecutor(
        CompanionOperationJournal journal,
        CompanionSourceAcquisition acquisition,
        CompanionSourceConversion conversion,
        string journalRoot,
        string workRoot,
        string workerSha256,
        string converterSha256)
    {
        _journal = journal ?? throw new ArgumentNullException(nameof(journal));
        _acquisition = acquisition ?? throw new ArgumentNullException(nameof(acquisition));
        _conversion = conversion ?? throw new ArgumentNullException(nameof(conversion));
        _journalRoot = CompanionProductionFileSystem.RequireExistingDirectory(
            journalRoot,
            "operation-journal-invalid");
        _workRoot = CompanionProductionFileSystem.RequireExistingDirectory(
            workRoot,
            "operation-work-root-invalid");
        CompanionContract.RequireDigest(workerSha256, "operation-worker-sha256");
        CompanionContract.RequireDigest(converterSha256, "operation-converter-sha256");
        _workerSha256 = workerSha256;
        _converterSha256 = converterSha256;
    }

    /// <summary>Ensures one nonterminal operation has at most one in-process worker.</summary>
    public async Task EnsureStartedAsync(string operationId)
    {
        ThrowIfDisposed();
        CompanionContract.RequireDigest(operationId, "journal-operation-id");
        CompanionOperationRecord current;
        for (var attempt = 0; ; attempt++)
        {
            if (HasActiveWorker(operationId))
            {
                return;
            }

            try
            {
                current = _journal.Read(operationId);
                break;
            }
            catch (CompanionContractException error) when (
                error.Code == "journal-record-read" &&
                attempt + 1 < MaximumJournalReadAttempts)
            {
                await Task.Delay(JournalReadRetry).ConfigureAwait(false);
            }
        }
        if (!IsTerminal(current.State))
        {
            _ = StartWorker(operationId);
        }
    }

    /// <summary>Enumerates the bounded journal and restarts every valid nonterminal operation.</summary>
    internal void RecoverPendingOperations()
    {
        ThrowIfDisposed();
        var operationsRoot = Path.Combine(_journalRoot, "operations");
        string[] entries;
        try
        {
            entries = Directory.GetFileSystemEntries(operationsRoot);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new CompanionProtocolException("operation-journal-invalid");
        }

        var pending = new List<string>();
        foreach (var entry in entries)
        {
            try
            {
                if (!Directory.Exists(entry) || File.Exists(entry))
                {
                    throw new CompanionProtocolException("operation-journal-invalid");
                }
                CompanionProductionFileSystem.RejectReparsePoint(
                    entry,
                    "operation-journal-invalid");
                var operationId = Path.GetFileName(entry);
                CompanionContract.RequireDigest(operationId, "operation-journal-id");
                var current = _journal.Read(operationId);
                if (!IsTerminal(current.State))
                {
                    pending.Add(operationId);
                }
            }
            catch (CompanionProtocolException)
            {
                throw;
            }
            catch (CompanionContractException)
            {
                throw new CompanionProtocolException("operation-journal-invalid");
            }
            catch (Exception error) when (
                error is IOException or UnauthorizedAccessException or NotSupportedException)
            {
                throw new CompanionProtocolException("operation-journal-invalid");
            }
        }

        foreach (var operationId in pending)
        {
            _ = StartWorker(operationId);
        }
    }

    /// <summary>Applies one persisted cancellation intent and waits for terminal journal evidence.</summary>
    public async Task CancelAndWaitAsync(string operationId, string cancellationId)
    {
        ThrowIfDisposed();
        CompanionContract.RequireDigest(
            operationId,
            "operation-cancellation-operation-id");
        var cancellation = _journal.ReadCancellationIntent(operationId);
        if (cancellation.Request.CancellationId != cancellationId)
        {
            throw new CompanionProtocolException("operation-terminal");
        }

        var current = _journal.Read(operationId);
        if (IsTerminal(current.State))
        {
            return;
        }

        var worker = StartWorker(operationId);
        worker.RequestCancellation();
        using var timeout = new CancellationTokenSource(CancellationWait);
        while (true)
        {
            current = _journal.Read(operationId);
            if (IsTerminal(current.State))
            {
                return;
            }
            try
            {
                await Task.Delay(CancellationPollInterval, timeout.Token)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (timeout.IsCancellationRequested)
            {
                throw new CompanionProtocolException("companion-unavailable");
            }
        }
    }

    /// <summary>Cancels all owned workers and waits for their terminal normalization.</summary>
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposeState, 1) != 0)
        {
            return;
        }
        _shutdown.Cancel();
        Task[] tasks;
        lock (_workersGate)
        {
            tasks = _workers.Values
                .Select(static worker => worker.Task)
                .Where(static task => task is not null)
                .Cast<Task>()
                .ToArray();
        }
        try
        {
            await Task.WhenAll(tasks).ConfigureAwait(false);
        }
        catch
        {
            // Worker failures are normalized into terminal journal evidence.
        }
        _acquisition.Dispose();
        _shutdown.Dispose();
    }

    /// <summary>Returns the active worker or creates the operation's sole in-process worker.</summary>
    private WorkerHandle StartWorker(string operationId)
    {
        lock (_workersGate)
        {
            ThrowIfDisposed();
            if (_workers.TryGetValue(operationId, out var active) &&
                active.Task is { IsCompleted: false })
            {
                return active;
            }
            if (active is not null)
            {
                _workers.Remove(operationId);
                active.Dispose();
            }

            var worker = new WorkerHandle();
            _workers.Add(operationId, worker);
            worker.Task = Task.Run(() => RunWorkerAsync(operationId, worker));
            return worker;
        }
    }

    /// <summary>Checks whether the operation currently has an unfinished in-process worker.</summary>
    private bool HasActiveWorker(string operationId)
    {
        lock (_workersGate)
        {
            return _workers.TryGetValue(operationId, out var active) &&
                active.Task is { IsCompleted: false };
        }
    }

    /// <summary>Acquires cross-process ownership and normalizes execution into terminal evidence.</summary>
    private async Task RunWorkerAsync(string operationId, WorkerHandle worker)
    {
        try
        {
            using var owner = TryAcquireOwner(operationId);
            if (owner is null)
            {
                return;
            }

            var paths = OpenOperationPaths(operationId);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                worker.Token,
                _shutdown.Token);
            using var stopMonitor = new CancellationTokenSource();
            var monitor = MonitorCancellationAsync(
                operationId,
                worker,
                stopMonitor.Token);
            try
            {
                await ExecuteOperationAsync(
                    operationId,
                    paths,
                    worker,
                    linked.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (linked.IsCancellationRequested)
            {
                if (worker.FailureCode is { } failure)
                {
                    TryReject(operationId, failure);
                }
                else
                {
                    TryCancel(operationId);
                }
            }
            catch (Exception error)
            {
                TryReject(operationId, PublicFailureCode(error));
            }
            finally
            {
                stopMonitor.Cancel();
                try
                {
                    await monitor.ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (stopMonitor.IsCancellationRequested)
                {
                }
            }
        }
        finally
        {
            lock (_workersGate)
            {
                if (_workers.TryGetValue(operationId, out var current) &&
                    ReferenceEquals(current, worker))
                {
                    _workers.Remove(operationId);
                }
            }
            worker.Dispose();
        }
    }

    /// <summary>Advances the registered operation through acquisition, conversion, or recovery.</summary>
    private async Task ExecuteOperationAsync(
        string operationId,
        CompanionProductionOperationPaths paths,
        WorkerHandle worker,
        CancellationToken cancellationToken)
    {
        while (true)
        {
            var current = _journal.Read(operationId);
            if (IsTerminal(current.State))
            {
                return;
            }
            if (worker.IsCancellationRequested)
            {
                cancellationToken.ThrowIfCancellationRequested();
            }

            switch (current.State)
            {
                case CompanionOperationState.Queued:
                    PrepareSourceAcquisition(operationId, paths);
                    break;
                case CompanionOperationState.AcquiringSource:
                    RequireExecutionBinding(current, paths);
                    if (HasConversionIntent(operationId))
                    {
                        RecoverPersistedConversion(operationId);
                        break;
                    }
                    if (!HasSourceReceipt(operationId))
                    {
                        _ = await _acquisition.AcquireAsync(
                            operationId,
                            paths,
                            cancellationToken).ConfigureAwait(false);
                    }
                    cancellationToken.ThrowIfCancellationRequested();
                    _ = await _conversion.RunAsync(
                        operationId,
                        ConversionRequest(paths),
                        cancellationToken).ConfigureAwait(false);
                    return;
                case CompanionOperationState.Converting:
                case CompanionOperationState.VerifyingComposition:
                    RequireExecutionBinding(current, paths);
                    ReconcileOrCloseLostOwner(operationId, worker.IsCancellationRequested);
                    return;
                default:
                    throw new CompanionContractException("operation-worker-state");
            }
        }
    }

    /// <summary>Persists execution and source intents before entering source acquisition.</summary>
    private void PrepareSourceAcquisition(
        string operationId,
        CompanionProductionOperationPaths paths)
    {
        var current = _journal.Read(operationId);
        var request = _journal.ReadRequest(operationId);
        CompanionSourceDescriptor.RequireSupported(request);
        var execution = _journal.PersistExecutionIntent(new CompanionExecutionIntent(
            CompanionContract.ExecutionIntentSchema,
            operationId,
            current.RequestSha256,
            request.AttemptId,
            _workerSha256,
            _converterSha256,
            CompanionSourceDescriptor.DescriptorId,
            CompanionSourceDescriptor.CacheLogicalId,
            paths.SourceStagingRoot,
            paths.MaterializedLockRoot,
            paths.ConversionOutputRoot,
            CompanionSourceDescriptor.NetworkProfileId,
            CompanionSourceDescriptor.ResourcePolicyId));
        var acquisition = _journal.PersistSourceAcquisitionIntent(
            new CompanionSourceAcquisitionIntent(
                CompanionContract.SourceAcquisitionIntentSchema,
                operationId,
                current.RequestSha256,
                execution.Sha256,
                CompanionSourceDescriptor.DescriptorId,
                CompanionSourceDescriptor.Repository,
                CompanionSourceDescriptor.Revision,
                CompanionSourceDescriptor.ModelSourceLockSha256,
                CompanionSourceDescriptor.TokenizerSourceLockSha256,
                CompanionSourceDescriptor.PayloadBytes,
                CompanionSourceDescriptor.PayloadInventorySchema,
                CompanionSourceDescriptor.PayloadInventorySha256,
                paths.SourceCacheRoot,
                paths.ModelSourceRoot,
                paths.TokenizerSourceRoot,
                paths.SourceStagingRoot,
                paths.MaterializedLockRoot,
                CompanionSourceDescriptor.InitialOrigin,
                CompanionSourceDescriptor.MaximumRedirects,
                CompanionSourceDescriptor.BufferBytes));
        _journal.Advance(
            operationId,
            CompanionOperationState.AcquiringSource,
            CompanionAcquisitionRoute.Source,
            phaseCompletedBytes: 0,
            phaseTotalBytes: CompanionSourceDescriptor.PayloadBytes,
            executionIntentSha256: execution.Sha256,
            sourceAcquisitionIntentSha256: acquisition.Sha256);
    }

    /// <summary>Rebinds a persisted conversion intent to the journal's converting state.</summary>
    private void RecoverPersistedConversion(string operationId)
    {
        var current = _journal.Read(operationId);
        var receipt = _journal.ReadSourceAcquisitionReceipt(operationId);
        var conversion = _journal.ReadSourceConversionIntent(operationId);
        _journal.Advance(
            operationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionRoute.Source,
            current.PhaseCompletedBytes,
            current.PhaseTotalBytes,
            sourceAcquisitionReceiptSha256: receipt.Sha256,
            sourceConversionIntentSha256: conversion.Sha256);
    }

    /// <summary>Requires current source execution to match every persisted tool, root, and profile identity.</summary>
    private void RequireExecutionBinding(
        CompanionOperationRecord current,
        CompanionProductionOperationPaths paths)
    {
        var request = _journal.ReadRequest(current.OperationId);
        CompanionSourceDescriptor.RequireSupported(request);
        var persisted = _journal.ReadExecutionIntent(current.OperationId);
        var intent = persisted.Intent;
        if (current.ExecutionIntentSha256 != persisted.Sha256 ||
            intent.OperationId != current.OperationId ||
            intent.RequestSha256 != current.RequestSha256 ||
            intent.AttemptId != request.AttemptId)
        {
            throw new CompanionContractException("operation-execution-identity");
        }
        if (intent.InstalledWorkerSha256 != _workerSha256)
        {
            throw new CompanionContractException("operation-worker-drift");
        }
        if (intent.InstalledConverterSha256 != _converterSha256)
        {
            throw new CompanionContractException("operation-converter-drift");
        }
        if (intent.SourceAcquisitionRoot != paths.SourceStagingRoot ||
            intent.MaterializedLockRoot != paths.MaterializedLockRoot ||
            intent.ConversionOutputRoot != paths.ConversionOutputRoot)
        {
            throw new CompanionContractException("operation-execution-root");
        }
        if (intent.SourceDescriptorId != CompanionSourceDescriptor.DescriptorId ||
            intent.SourceCacheLogicalId != CompanionSourceDescriptor.CacheLogicalId ||
            intent.NetworkProfileId != CompanionSourceDescriptor.NetworkProfileId ||
            intent.ResourcePolicyId != CompanionSourceDescriptor.ResourcePolicyId)
        {
            throw new CompanionContractException("operation-execution-profile");
        }
    }

    /// <summary>Reconciles conversion evidence or closes an ownerless pending conversion fail-closed.</summary>
    private void ReconcileOrCloseLostOwner(string operationId, bool cancellationRequested)
    {
        var result = _conversion.ReconcileTerminal(operationId);
        if (result.Status != CompanionSourceConversionReconciliationStatus.Pending)
        {
            return;
        }
        if (cancellationRequested || HasCancellationIntent(operationId))
        {
            TryCancel(operationId);
        }
        else
        {
            TryReject(operationId, "operation-owner-lost");
        }
    }

    /// <summary>Polls for the immutable cancellation intent and signals the local worker once.</summary>
    private async Task MonitorCancellationAsync(
        string operationId,
        WorkerHandle worker,
        CancellationToken cancellationToken)
    {
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                if (HasCancellationIntent(operationId))
                {
                    _ = _journal.ReadCancellationIntent(operationId);
                    worker.RequestCancellation();
                    return;
                }
            }
            catch (CompanionContractException)
            {
                worker.Fail("cancellation-intent-invalid");
                return;
            }
            await Task.Delay(CancellationPollInterval, cancellationToken)
                .ConfigureAwait(false);
        }
    }

    /// <summary>Attempts exclusive cross-process ownership through the operation's fixed lock file.</summary>
    private FileStream? TryAcquireOwner(string operationId)
    {
        var operationDirectory = Path.Combine(_journalRoot, "operations", operationId);
        var ownerPath = Path.Combine(operationDirectory, "operation.owner.lock");
        try
        {
            if (Directory.Exists(ownerPath))
            {
                throw new CompanionContractException("operation-owner-lock-invalid");
            }
            if (File.Exists(ownerPath))
            {
                CompanionProductionFileSystem.RejectReparsePoint(
                    ownerPath,
                    "operation-owner-lock-invalid");
            }
            var stream = new FileStream(
                ownerPath,
                FileMode.OpenOrCreate,
                FileAccess.ReadWrite,
                FileShare.None,
                bufferSize: 1,
                FileOptions.WriteThrough);
            CompanionProductionFileSystem.RejectReparsePoint(
                ownerPath,
                "operation-owner-lock-invalid");
            return stream;
        }
        catch (IOException)
        {
            return null;
        }
        catch (UnauthorizedAccessException)
        {
            throw new CompanionContractException("operation-owner-lock-invalid");
        }
    }

    /// <summary>Opens the fixed marked work root and derives all operation-owned child paths.</summary>
    private CompanionProductionOperationPaths OpenOperationPaths(string operationId)
    {
        var operationRoot = Path.Combine(_workRoot, operationId);
        CompanionProductionFileSystem.OpenOrCreateOwnedRoot(
            operationRoot,
            $"{CompanionProductionFileSystem.OperationRootMarkerPrefix}{operationId}\n",
            "operation-work-root-invalid");
        return new CompanionProductionOperationPaths(
            operationRoot,
            Path.Combine(operationRoot, "source-cache"),
            Path.Combine(operationRoot, "model-source"),
            Path.Combine(operationRoot, "tokenizer-source"),
            Path.Combine(operationRoot, "source-staging"),
            Path.Combine(operationRoot, "source-locks"),
            Path.Combine(operationRoot, "composition-output"));
    }

    /// <summary>Builds conversion input exclusively from operation-owned fixed paths.</summary>
    private CompanionSourceConversionRequest ConversionRequest(
        CompanionProductionOperationPaths paths) =>
        new(
            Path.Combine(
                paths.MaterializedLockRoot,
                CompanionBuiltInSourceAssets.ModelLockFileName),
            paths.ModelSourceRoot,
            Path.Combine(
                paths.MaterializedLockRoot,
                CompanionBuiltInSourceAssets.TokenizerLockFileName),
            paths.TokenizerSourceRoot,
            paths.ConversionOutputRoot);

    /// <summary>Checks for the fixed source-acquisition receipt path.</summary>
    private bool HasSourceReceipt(string operationId) => File.Exists(Path.Combine(
        _journalRoot,
        "operations",
        operationId,
        "source-acquisition.receipt.json"));

    /// <summary>Checks for the fixed source-conversion intent path.</summary>
    private bool HasConversionIntent(string operationId) => File.Exists(Path.Combine(
        _journalRoot,
        "operations",
        operationId,
        "source-conversion.intent.json"));

    /// <summary>Checks for the fixed cancellation-intent path.</summary>
    private bool HasCancellationIntent(string operationId) => File.Exists(Path.Combine(
        _journalRoot,
        "operations",
        operationId,
        "cancellation.intent.json"));

    /// <summary>Best-effort closes a still-active operation as cancelled without replacing terminal evidence.</summary>
    private void TryCancel(string operationId)
    {
        var current = TryRead(operationId);
        if (current is null || IsTerminal(current.State))
        {
            return;
        }
        try
        {
            _journal.Advance(
                operationId,
                CompanionOperationState.Cancelled,
                CompanionAcquisitionRoute.Source,
                current.PhaseCompletedBytes,
                current.PhaseTotalBytes);
        }
        catch (CompanionContractException) when (
            TryRead(operationId) is
            {
                State: CompanionOperationState.Available or
                CompanionOperationState.Cancelled or CompanionOperationState.Rejected
            })
        {
        }
    }

    /// <summary>Best-effort closes a still-active operation with one public-safe rejection code.</summary>
    private void TryReject(string operationId, string code)
    {
        var current = TryRead(operationId);
        if (current is null || IsTerminal(current.State))
        {
            return;
        }
        try
        {
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionRoute.Source,
                current.PhaseCompletedBytes,
                current.PhaseTotalBytes,
                errorCode: code);
        }
        catch (CompanionContractException) when (
            TryRead(operationId) is
            {
                State: CompanionOperationState.Available or
                CompanionOperationState.Cancelled or CompanionOperationState.Rejected
            })
        {
        }
    }

    /// <summary>Reads current operation evidence or returns null when the journal rejects it.</summary>
    private CompanionOperationRecord? TryRead(string operationId)
    {
        try
        {
            return _journal.Read(operationId);
        }
        catch (CompanionContractException)
        {
            return null;
        }
    }

    /// <summary>Maps internal failures to the bounded public-safe error-code vocabulary.</summary>
    private static string PublicFailureCode(Exception error)
    {
        var code = error switch
        {
            CompanionContractException contract => contract.Code,
            TinyRustLmException conversion => conversion.Code,
            HttpRequestException => "source-network-failure",
            UnauthorizedAccessException => "source-access-denied",
            IOException => "source-io-failure",
            _ => "operation-worker-failure"
        };
        return IsPublicErrorCode(code) ? code : "operation-worker-failure";
    }

    /// <summary>Checks the lowercase bounded syntax allowed in public terminal evidence.</summary>
    private static bool IsPublicErrorCode(string code) =>
        code.Length is >= 3 and <= 64 &&
        code[0] is >= 'a' and <= 'z' &&
        code.All(static character => character is (>= 'a' and <= 'z') or
            (>= '0' and <= '9') or '-');

    /// <summary>Returns whether the operation state is immutable and terminal.</summary>
    private static bool IsTerminal(CompanionOperationState state) => state is
        CompanionOperationState.Available or
        CompanionOperationState.Cancelled or
        CompanionOperationState.Rejected;

    /// <summary>Rejects work after runtime shutdown has begun.</summary>
    private void ThrowIfDisposed()
    {
        if (Volatile.Read(ref _disposeState) != 0)
        {
            throw new CompanionProtocolException("companion-unavailable");
        }
    }

    /// <summary>Owns one operation worker's cancellation signal, task, and first failure code.</summary>
    private sealed class WorkerHandle : IDisposable
    {
        private readonly CancellationTokenSource _cancellation = new();
        private string? _failureCode;

        /// <summary>Gets or sets the sole task executing this worker.</summary>
        internal Task? Task { get; set; }

        /// <summary>Gets the worker-local cancellation token.</summary>
        internal CancellationToken Token => _cancellation.Token;

        /// <summary>Gets whether local cancellation has been requested.</summary>
        internal bool IsCancellationRequested => _cancellation.IsCancellationRequested;

        /// <summary>Gets the first cancellation-monitor failure code, when present.</summary>
        internal string? FailureCode => Volatile.Read(ref _failureCode);

        /// <summary>Signals cancellation without failing if shutdown already disposed the source.</summary>
        internal void RequestCancellation()
        {
            try
            {
                _cancellation.Cancel();
            }
            catch (ObjectDisposedException)
            {
            }
        }

        /// <summary>Preserves the first failure code and cancels the worker.</summary>
        internal void Fail(string code)
        {
            Interlocked.CompareExchange(ref _failureCode, code, null);
            RequestCancellation();
        }

        /// <summary>Releases the worker-local cancellation source.</summary>
        public void Dispose() => _cancellation.Dispose();
    }
}
