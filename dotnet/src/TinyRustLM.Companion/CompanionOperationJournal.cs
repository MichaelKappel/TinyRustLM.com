using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.Companion;

public sealed record CompanionPersistedCancellationIntent(
    CompanionCancelRequest Request,
    string Sha256,
    bool WasCreated);

public sealed class CompanionOperationJournal
{
    private const string MarkerFileName = ".tinyrustlm-companion-root";
    private const string OperationsDirectoryName = "operations";
    private const string ExecutionIntentFileName = "execution.intent.json";
    private const string SourceAcquisitionIntentFileName = "source-acquisition.intent.json";
    private const string SourceAcquisitionReceiptFileName = "source-acquisition.receipt.json";
    private const string SourceConversionIntentFileName = "source-conversion.intent.json";
    private const string CancellationIntentFileName = "cancellation.intent.json";
    private const int MaximumRecordBytes = 65_536;
    private const int MaximumHistoryRecords = 5;
    private const int OperationGateWaitMilliseconds = 5_000;
    private static readonly StringComparer OperationPathComparer = OperatingSystem.IsWindows()
        ? StringComparer.OrdinalIgnoreCase
        : StringComparer.Ordinal;
    private static readonly ConcurrentDictionary<string, OperationGateEntry> InProcessLocks =
        new(OperationPathComparer);
    private readonly string _operationsRoot;
    private readonly TimeProvider _timeProvider;

    internal int ActiveInProcessGateCount => InProcessLocks.Keys.Count(path =>
        OperationPathComparer.Equals(Path.GetDirectoryName(path), _operationsRoot));

    public CompanionOperationJournal(string rootPath, TimeProvider? timeProvider = null)
    {
        var root = RequireOwnedRoot(rootPath);
        _operationsRoot = Path.Combine(root, OperationsDirectoryName);
        if (!Directory.Exists(_operationsRoot) || File.Exists(_operationsRoot))
        {
            throw new CompanionContractException("journal-operations-root");
        }
        RejectReparsePoint(_operationsRoot, "journal-operations-root");
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public static string CreateOwnedRoot(string rootPath)
    {
        var root = FullPath(rootPath, nameof(rootPath));
        if (Directory.Exists(root) || File.Exists(root))
        {
            throw new CompanionContractException("journal-root-exists");
        }
        var parent = Path.GetDirectoryName(root);
        if (string.IsNullOrWhiteSpace(parent) || !Directory.Exists(parent))
        {
            throw new CompanionContractException("journal-root-parent");
        }
        RejectReparsePoint(parent, "journal-root-parent");

        Directory.CreateDirectory(root);
        try
        {
            var operations = Path.Combine(root, OperationsDirectoryName);
            Directory.CreateDirectory(operations);
            WriteCreateOnly(
                Path.Combine(root, MarkerFileName),
                Encoding.ASCII.GetBytes(CompanionContract.OwnedRootMarker));
            return root;
        }
        catch
        {
            var operations = Path.Combine(root, OperationsDirectoryName);
            if (Directory.Exists(operations) &&
                !Directory.EnumerateFileSystemEntries(operations).Any())
            {
                Directory.Delete(operations);
            }
            if (Directory.Exists(root) && !Directory.EnumerateFileSystemEntries(root).Any())
            {
                Directory.Delete(root);
            }
            throw;
        }
    }

    public CompanionOperationRecord CreateOrRead(CompanionAcquireRequest request)
    {
        var normalized = CompanionContract.ValidateAndNormalize(request);
        var requestBytes = CompanionLoopbackWire.EncodeAcquireRequest(normalized);
        var operationId = Sha256(requestBytes);
        var finalDirectory = OperationDirectory(operationId);
        if (File.Exists(finalDirectory))
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        if (Directory.Exists(finalDirectory))
        {
            return ReadExistingOperation(operationId, requestBytes);
        }

        var stagingDirectory = Path.Combine(
            _operationsRoot,
            $".staging-{operationId}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(stagingDirectory);
        try
        {
            var now = Timestamp();
            var record = new CompanionOperationRecord(
                CompanionContract.OperationRecordSchema,
                operationId,
                Sha256(requestBytes),
                0,
                CompanionOperationState.Queued,
                CompanionAcquisitionRoute.Source,
                now,
                now,
                0,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
            Directory.CreateDirectory(Path.Combine(stagingDirectory, "history"));
            WriteCreateOnly(Path.Combine(stagingDirectory, "request.json"), requestBytes);
            var recordBytes = Serialize(record);
            WriteCreateOnly(Path.Combine(stagingDirectory, "history", SequenceFile(0)), recordBytes);
            WriteCreateOnly(Path.Combine(stagingDirectory, "current.json"), recordBytes);
            try
            {
                Directory.Move(stagingDirectory, finalDirectory);
                return record;
            }
            catch (IOException) when (Directory.Exists(finalDirectory))
            {
                DeleteOwnedStagingDirectory(stagingDirectory);
                return ReadExistingOperation(operationId, requestBytes);
            }
        }
        catch
        {
            if (Directory.Exists(stagingDirectory))
            {
                DeleteOwnedStagingDirectory(stagingDirectory);
            }
            throw;
        }
    }

    public CompanionOperationRecord Read(string operationId)
    {
        RequireOperationId(operationId);
        var directory = RequireOperationDirectory(operationId);
        return ReadLatestRecord(directory, operationId);
    }

    public CompanionAcquireRequest ReadRequest(string operationId)
    {
        RequireOperationId(operationId);
        var path = Path.Combine(RequireOperationDirectory(operationId), "request.json");
        var bytes = ReadBoundedRegularFile(
            path,
            "journal-request-file",
            "journal-request-file");
        CompanionAcquireRequest normalized;
        try
        {
            normalized = CompanionLoopbackWire.DecodeAcquireRequest(bytes);
        }
        catch (CompanionProtocolException)
        {
            throw new CompanionContractException("journal-request-json");
        }
        var current = Read(operationId);
        if (Sha256(bytes) != operationId ||
            Sha256(bytes) != current.RequestSha256)
        {
            throw new CompanionContractException("journal-request-identity");
        }
        return normalized;
    }

    public CompanionPersistedExecutionIntent PersistExecutionIntent(
        CompanionExecutionIntent intent)
    {
        CompanionOperationEvidenceCodec.Validate(intent);
        RequireOperationId(intent.OperationId);
        var gate = TryAcquireOperationGate(intent.OperationId);
        if (gate is null)
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = RequireOperationDirectory(intent.OperationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadLatestRecord(directory, intent.OperationId);
            var request = ReadRequest(intent.OperationId);
            if (current.State != CompanionOperationState.Queued ||
                current.ExecutionIntentSha256 is not null ||
                current.SourceAcquisitionIntentSha256 is not null ||
                current.SourceAcquisitionReceiptSha256 is not null ||
                current.SourceConversionIntentSha256 is not null ||
                current.Artifacts is not null ||
                current.ErrorCode is not null ||
                intent.RequestSha256 != current.RequestSha256 ||
                intent.AttemptId != request.AttemptId)
            {
                throw new CompanionContractException("journal-execution-intent-state");
            }

            var canonical = CompanionOperationEvidenceCodec.Serialize(intent);
            var observed = PersistCanonicalEvidence(
                Path.Combine(directory, ExecutionIntentFileName),
                canonical,
                "journal-execution-intent");
            return new CompanionPersistedExecutionIntent(
                CompanionOperationEvidenceCodec.DeserializeExecutionIntent(observed),
                Sha256(observed));
        }
        finally
        {
            gate.Dispose();
        }
    }

    public CompanionPersistedExecutionIntent ReadExecutionIntent(string operationId)
    {
        RequireOperationId(operationId);
        var current = Read(operationId);
        var bytes = ReadBoundedRegularFile(
            Path.Combine(RequireOperationDirectory(operationId), ExecutionIntentFileName),
            "journal-execution-intent-file",
            "journal-execution-intent-read");
        var intent = CompanionOperationEvidenceCodec.DeserializeExecutionIntent(bytes);
        var digest = Sha256(bytes);
        if (intent.OperationId != operationId ||
            intent.RequestSha256 != current.RequestSha256 ||
            current.ExecutionIntentSha256 is not null && current.ExecutionIntentSha256 != digest)
        {
            throw new CompanionContractException("journal-execution-intent-identity");
        }
        return new CompanionPersistedExecutionIntent(intent, digest);
    }

    public CompanionPersistedSourceAcquisitionIntent PersistSourceAcquisitionIntent(
        CompanionSourceAcquisitionIntent intent)
    {
        CompanionOperationEvidenceCodec.Validate(intent);
        RequireOperationId(intent.OperationId);
        var gate = TryAcquireOperationGate(intent.OperationId);
        if (gate is null)
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = RequireOperationDirectory(intent.OperationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadLatestRecord(directory, intent.OperationId);
            var execution = ReadExecutionIntent(intent.OperationId);
            if (current.State != CompanionOperationState.Queued ||
                current.ExecutionIntentSha256 is not null ||
                current.SourceAcquisitionIntentSha256 is not null ||
                current.SourceAcquisitionReceiptSha256 is not null ||
                current.SourceConversionIntentSha256 is not null ||
                current.Artifacts is not null ||
                current.ErrorCode is not null ||
                intent.RequestSha256 != current.RequestSha256 ||
                intent.ExecutionIntentSha256 != execution.Sha256 ||
                intent.SourceStagingRoot != execution.Intent.SourceAcquisitionRoot ||
                intent.MaterializedLockRoot != execution.Intent.MaterializedLockRoot)
            {
                throw new CompanionContractException("journal-source-acquisition-intent-state");
            }

            var canonical = CompanionOperationEvidenceCodec.Serialize(intent);
            var observed = PersistCanonicalEvidence(
                Path.Combine(directory, SourceAcquisitionIntentFileName),
                canonical,
                "journal-source-acquisition-intent");
            return new CompanionPersistedSourceAcquisitionIntent(
                CompanionOperationEvidenceCodec.DeserializeSourceAcquisitionIntent(observed),
                Sha256(observed));
        }
        finally
        {
            gate.Dispose();
        }
    }

    public CompanionPersistedSourceAcquisitionIntent ReadSourceAcquisitionIntent(
        string operationId)
    {
        RequireOperationId(operationId);
        var current = Read(operationId);
        var bytes = ReadBoundedRegularFile(
            Path.Combine(
                RequireOperationDirectory(operationId),
                SourceAcquisitionIntentFileName),
            "journal-source-acquisition-intent-file",
            "journal-source-acquisition-intent-read");
        var intent = CompanionOperationEvidenceCodec.DeserializeSourceAcquisitionIntent(bytes);
        var digest = Sha256(bytes);
        if (intent.OperationId != operationId ||
            intent.RequestSha256 != current.RequestSha256 ||
            current.SourceAcquisitionIntentSha256 is not null &&
                current.SourceAcquisitionIntentSha256 != digest)
        {
            throw new CompanionContractException("journal-source-acquisition-intent-identity");
        }
        return new CompanionPersistedSourceAcquisitionIntent(intent, digest);
    }

    public CompanionPersistedSourceAcquisitionReceipt PersistSourceAcquisitionReceipt(
        CompanionSourceAcquisitionReceipt receipt)
    {
        CompanionOperationEvidenceCodec.Validate(receipt);
        RequireOperationId(receipt.OperationId);
        var gate = TryAcquireOperationGate(receipt.OperationId);
        if (gate is null)
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = RequireOperationDirectory(receipt.OperationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadLatestRecord(directory, receipt.OperationId);
            var execution = ReadExecutionIntent(receipt.OperationId);
            var acquisition = ReadSourceAcquisitionIntent(receipt.OperationId);
            if (current.State != CompanionOperationState.AcquiringSource ||
                current.ExecutionIntentSha256 != execution.Sha256 ||
                current.SourceAcquisitionIntentSha256 != acquisition.Sha256 ||
                current.SourceAcquisitionReceiptSha256 is not null ||
                current.SourceConversionIntentSha256 is not null ||
                current.Artifacts is not null ||
                current.ErrorCode is not null ||
                receipt.RequestSha256 != current.RequestSha256 ||
                receipt.ExecutionIntentSha256 != execution.Sha256 ||
                receipt.SourceAcquisitionIntentSha256 != acquisition.Sha256 ||
                receipt.ActivatedModelSourceRoot != acquisition.Intent.ModelSourceRoot ||
                receipt.ActivatedTokenizerSourceRoot !=
                    acquisition.Intent.TokenizerSourceRoot)
            {
                throw new CompanionContractException("journal-source-acquisition-receipt-state");
            }

            var canonical = CompanionOperationEvidenceCodec.Serialize(receipt);
            var observed = PersistCanonicalEvidence(
                Path.Combine(directory, SourceAcquisitionReceiptFileName),
                canonical,
                "journal-source-acquisition-receipt");
            return new CompanionPersistedSourceAcquisitionReceipt(
                CompanionOperationEvidenceCodec.DeserializeSourceAcquisitionReceipt(observed),
                Sha256(observed));
        }
        finally
        {
            gate.Dispose();
        }
    }

    public CompanionPersistedSourceAcquisitionReceipt ReadSourceAcquisitionReceipt(
        string operationId)
    {
        RequireOperationId(operationId);
        var current = Read(operationId);
        var bytes = ReadBoundedRegularFile(
            Path.Combine(
                RequireOperationDirectory(operationId),
                SourceAcquisitionReceiptFileName),
            "journal-source-acquisition-receipt-file",
            "journal-source-acquisition-receipt-read");
        var receipt = CompanionOperationEvidenceCodec.DeserializeSourceAcquisitionReceipt(bytes);
        var digest = Sha256(bytes);
        if (receipt.OperationId != operationId ||
            receipt.RequestSha256 != current.RequestSha256 ||
            current.SourceAcquisitionReceiptSha256 is not null &&
                current.SourceAcquisitionReceiptSha256 != digest)
        {
            throw new CompanionContractException("journal-source-acquisition-receipt-identity");
        }
        return new CompanionPersistedSourceAcquisitionReceipt(receipt, digest);
    }

    public CompanionPersistedSourceConversionIntent PersistSourceConversionIntent(
        CompanionSourceConversionIntent intent)
    {
        CompanionSourceConversionIntentCodec.Validate(intent);
        RequireOperationId(intent.OperationId);
        var gate = TryAcquireOperationGate(intent.OperationId);
        if (gate is null)
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = RequireOperationDirectory(intent.OperationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadLatestRecord(directory, intent.OperationId);
            var execution = ReadExecutionIntent(intent.OperationId);
            var acquisition = ReadSourceAcquisitionReceipt(intent.OperationId);
            if (current.State != CompanionOperationState.AcquiringSource ||
                current.ExecutionIntentSha256 != execution.Sha256 ||
                current.SourceAcquisitionIntentSha256 is null ||
                current.SourceAcquisitionReceiptSha256 is not null ||
                current.SourceConversionIntentSha256 is not null ||
                current.Artifacts is not null ||
                current.ErrorCode is not null ||
                intent.RequestSha256 != current.RequestSha256 ||
                intent.Conversion.ModelSourceLockSha256 !=
                    CompanionSourceDescriptor.ModelSourceLockSha256 ||
                intent.Conversion.TokenizerSourceLockSha256 !=
                    CompanionSourceDescriptor.TokenizerSourceLockSha256 ||
                intent.Conversion.ConverterExecutableSha256 !=
                    execution.Intent.InstalledConverterSha256 ||
                intent.Conversion.OutputRoot != execution.Intent.ConversionOutputRoot ||
                Path.GetDirectoryName(intent.Conversion.ModelSourceLockPath) !=
                    execution.Intent.MaterializedLockRoot ||
                Path.GetDirectoryName(intent.Conversion.TokenizerSourceLockPath) !=
                    execution.Intent.MaterializedLockRoot ||
                intent.Conversion.ModelSourceDirectory !=
                    acquisition.Receipt.ActivatedModelSourceRoot ||
                intent.Conversion.TokenizerSourceDirectory !=
                    acquisition.Receipt.ActivatedTokenizerSourceRoot)
            {
                throw new CompanionContractException("journal-source-conversion-intent-state");
            }

            var canonical = CompanionSourceConversionIntentCodec.Serialize(intent);
            var path = Path.Combine(directory, SourceConversionIntentFileName);
            if (!File.Exists(path))
            {
                try
                {
                    WriteCreateOnly(path, canonical);
                }
                catch (IOException) when (File.Exists(path))
                {
                }
            }
            var observed = ReadBoundedRegularFile(
                path,
                "journal-source-conversion-intent-file",
                "journal-source-conversion-intent-read");
            if (!observed.AsSpan().SequenceEqual(canonical))
            {
                throw new CompanionContractException("journal-source-conversion-intent-conflict");
            }
            var parsed = CompanionSourceConversionIntentCodec.DeserializeCanonical(observed);
            return new CompanionPersistedSourceConversionIntent(parsed, Sha256(observed));
        }
        finally
        {
            gate.Dispose();
        }
    }

    public CompanionPersistedSourceConversionIntent ReadSourceConversionIntent(string operationId)
    {
        RequireOperationId(operationId);
        var current = Read(operationId);
        var bytes = ReadBoundedRegularFile(
            Path.Combine(OperationDirectory(operationId), SourceConversionIntentFileName),
            "journal-source-conversion-intent-file",
            "journal-source-conversion-intent-read");
        var intent = CompanionSourceConversionIntentCodec.DeserializeCanonical(bytes);
        var digest = Sha256(bytes);
        if (intent.OperationId != operationId ||
            intent.RequestSha256 != current.RequestSha256 ||
            current.SourceConversionIntentSha256 is not null &&
                current.SourceConversionIntentSha256 != digest)
        {
            throw new CompanionContractException("journal-source-conversion-intent-identity");
        }
        return new CompanionPersistedSourceConversionIntent(intent, digest);
    }

    public CompanionPersistedCancellationIntent BindCancellationIntent(
        string operationId,
        CompanionCancelRequest request)
    {
        RequireOperationId(operationId);
        ArgumentNullException.ThrowIfNull(request);
        byte[] canonical;
        try
        {
            canonical = CompanionLoopbackWire.EncodeCancelRequest(request);
        }
        catch (CompanionProtocolException)
        {
            throw new CompanionContractException("journal-cancellation-intent-contract");
        }

        var gate = AcquireOperationGate(operationId);

        try
        {
            var directory = RequireOperationDirectory(operationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadLatestRecord(directory, operationId);
            var path = Path.Combine(directory, CancellationIntentFileName);
            if (File.Exists(path))
            {
                var persisted = ReadCancellationIntentFile(path);
                if (!persisted.Request.Equals(request) ||
                    !persisted.Bytes.AsSpan().SequenceEqual(canonical))
                {
                    throw new CompanionContractException("journal-operation-terminal");
                }
                return new CompanionPersistedCancellationIntent(
                    persisted.Request,
                    Sha256(persisted.Bytes),
                    WasCreated: false);
            }
            if (IsTerminal(current.State))
            {
                throw new CompanionContractException("journal-operation-terminal");
            }

            WriteCreateOnly(path, canonical);
            var observed = ReadCancellationIntentFile(path);
            if (!observed.Bytes.AsSpan().SequenceEqual(canonical) ||
                !observed.Request.Equals(request))
            {
                throw new CompanionContractException("journal-cancellation-intent-conflict");
            }
            return new CompanionPersistedCancellationIntent(
                observed.Request,
                Sha256(observed.Bytes),
                WasCreated: true);
        }
        finally
        {
            gate.Dispose();
        }
    }

    public CompanionPersistedCancellationIntent ReadCancellationIntent(string operationId)
    {
        RequireOperationId(operationId);
        var directory = RequireOperationDirectory(operationId);
        var persisted = ReadCancellationIntentFile(
            Path.Combine(directory, CancellationIntentFileName));
        return new CompanionPersistedCancellationIntent(
            persisted.Request,
            Sha256(persisted.Bytes),
            WasCreated: false);
    }

    public CompanionOperationRecord Advance(
        string operationId,
        CompanionOperationState nextState,
        CompanionAcquisitionRoute route,
        ulong phaseCompletedBytes = 0,
        ulong? phaseTotalBytes = null,
        CompanionArtifactSet? artifacts = null,
        string? errorCode = null,
        string? executionIntentSha256 = null,
        string? sourceAcquisitionIntentSha256 = null,
        string? sourceAcquisitionReceiptSha256 = null,
        string? sourceConversionIntentSha256 = null)
    {
        RequireOperationId(operationId);
        var gate = TryAcquireOperationGate(operationId);
        if (gate is null)
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = RequireOperationDirectory(operationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadLatestRecord(directory, operationId);
            RepairCurrentCache(directory, operationId, current);
            if (route != current.Route)
            {
                throw new CompanionContractException("journal-route-immutable");
            }
            ValidateTransition(current.State, nextState);
            var executionSha256 = ResolveExecutionIntentSha256(
                current,
                nextState,
                executionIntentSha256);
            var acquisitionIntentSha256 = ResolveSourceAcquisitionIntentSha256(
                current,
                nextState,
                executionSha256,
                sourceAcquisitionIntentSha256);
            var acquisitionReceiptSha256 = ResolveSourceAcquisitionReceiptSha256(
                current,
                nextState,
                executionSha256,
                acquisitionIntentSha256,
                sourceAcquisitionReceiptSha256);
            var intentSha256 = ResolveSourceConversionIntentSha256(
                current,
                nextState,
                acquisitionReceiptSha256,
                sourceConversionIntentSha256);
            ValidateRecordFields(
                nextState,
                current.Route,
                phaseCompletedBytes,
                phaseTotalBytes,
                artifacts,
                errorCode,
                executionSha256,
                acquisitionIntentSha256,
                acquisitionReceiptSha256,
                intentSha256);
            var next = current with
            {
                Sequence = checked(current.Sequence + 1),
                State = nextState,
                UpdatedAtUtc = Timestamp(),
                PhaseCompletedBytes = phaseCompletedBytes,
                PhaseTotalBytes = phaseTotalBytes,
                Artifacts = artifacts,
                ErrorCode = errorCode,
                ExecutionIntentSha256 = executionSha256,
                SourceAcquisitionIntentSha256 = acquisitionIntentSha256,
                SourceAcquisitionReceiptSha256 = acquisitionReceiptSha256,
                SourceConversionIntentSha256 = intentSha256
            };
            var bytes = Serialize(next);
            var historyPath = Path.Combine(directory, "history", SequenceFile(next.Sequence));
            WriteCreateOnly(historyPath, bytes);
            ReplaceCurrent(Path.Combine(directory, "current.json"), bytes);
            return next;
        }
        finally
        {
            gate.Dispose();
        }
    }

    private static void ValidateTransition(CompanionOperationState current, CompanionOperationState next)
    {
        var allowed = current switch
        {
            CompanionOperationState.Queued => next is CompanionOperationState.AcquiringSource
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.AcquiringSource => next is CompanionOperationState.Converting
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.Converting => next is CompanionOperationState.VerifyingComposition
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.VerifyingComposition => next is CompanionOperationState.Available
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            _ => false
        };
        if (!allowed)
        {
            throw new CompanionContractException("journal-transition");
        }
    }

    private static bool IsTerminal(CompanionOperationState state) =>
        state is CompanionOperationState.Available or
            CompanionOperationState.Cancelled or
            CompanionOperationState.Rejected;

    private string? ResolveExecutionIntentSha256(
        CompanionOperationRecord current,
        CompanionOperationState nextState,
        string? supplied)
    {
        if (current.ExecutionIntentSha256 is not null)
        {
            return RequireUnchangedDigest(
                current.ExecutionIntentSha256,
                supplied,
                "journal-execution-intent");
        }
        if (supplied is null)
        {
            return null;
        }
        CompanionContract.RequireDigest(supplied, "journal-execution-intent-digest");
        if (current.State != CompanionOperationState.Queued ||
            nextState != CompanionOperationState.AcquiringSource)
        {
            throw new CompanionContractException("journal-execution-intent-transition");
        }
        var persisted = ReadExecutionIntent(current.OperationId);
        if (persisted.Sha256 != supplied)
        {
            throw new CompanionContractException("journal-execution-intent-identity");
        }
        return supplied;
    }

    private string? ResolveSourceAcquisitionIntentSha256(
        CompanionOperationRecord current,
        CompanionOperationState nextState,
        string? executionIntentSha256,
        string? supplied)
    {
        if (current.SourceAcquisitionIntentSha256 is not null)
        {
            return RequireUnchangedDigest(
                current.SourceAcquisitionIntentSha256,
                supplied,
                "journal-source-acquisition-intent");
        }
        if (supplied is null)
        {
            return null;
        }
        CompanionContract.RequireDigest(
            supplied,
            "journal-source-acquisition-intent-digest");
        if (current.State != CompanionOperationState.Queued ||
            nextState != CompanionOperationState.AcquiringSource ||
            executionIntentSha256 is null)
        {
            throw new CompanionContractException(
                "journal-source-acquisition-intent-transition");
        }
        var persisted = ReadSourceAcquisitionIntent(current.OperationId);
        if (persisted.Sha256 != supplied ||
            persisted.Intent.ExecutionIntentSha256 != executionIntentSha256)
        {
            throw new CompanionContractException(
                "journal-source-acquisition-intent-identity");
        }
        return supplied;
    }

    private string? ResolveSourceAcquisitionReceiptSha256(
        CompanionOperationRecord current,
        CompanionOperationState nextState,
        string? executionIntentSha256,
        string? sourceAcquisitionIntentSha256,
        string? supplied)
    {
        if (current.SourceAcquisitionReceiptSha256 is not null)
        {
            return RequireUnchangedDigest(
                current.SourceAcquisitionReceiptSha256,
                supplied,
                "journal-source-acquisition-receipt");
        }
        if (supplied is null)
        {
            return null;
        }
        CompanionContract.RequireDigest(
            supplied,
            "journal-source-acquisition-receipt-digest");
        if (current.State != CompanionOperationState.AcquiringSource ||
            nextState != CompanionOperationState.Converting ||
            executionIntentSha256 is null ||
            sourceAcquisitionIntentSha256 is null)
        {
            throw new CompanionContractException(
                "journal-source-acquisition-receipt-transition");
        }
        var persisted = ReadSourceAcquisitionReceipt(current.OperationId);
        if (persisted.Sha256 != supplied ||
            persisted.Receipt.ExecutionIntentSha256 != executionIntentSha256 ||
            persisted.Receipt.SourceAcquisitionIntentSha256 !=
                sourceAcquisitionIntentSha256)
        {
            throw new CompanionContractException(
                "journal-source-acquisition-receipt-identity");
        }
        return supplied;
    }

    private string? ResolveSourceConversionIntentSha256(
        CompanionOperationRecord current,
        CompanionOperationState nextState,
        string? sourceAcquisitionReceiptSha256,
        string? supplied)
    {
        if (current.SourceConversionIntentSha256 is not null)
        {
            return RequireUnchangedDigest(
                current.SourceConversionIntentSha256,
                supplied,
                "journal-source-conversion-intent");
        }
        if (supplied is null)
        {
            return null;
        }
        CompanionContract.RequireDigest(supplied, "journal-source-conversion-intent-digest");
        if (current.State != CompanionOperationState.AcquiringSource ||
            nextState != CompanionOperationState.Converting ||
            sourceAcquisitionReceiptSha256 is null)
        {
            throw new CompanionContractException("journal-source-conversion-intent-transition");
        }
        var persisted = ReadSourceConversionIntent(current.OperationId);
        if (persisted.Sha256 != supplied)
        {
            throw new CompanionContractException("journal-source-conversion-intent-identity");
        }
        return supplied;
    }

    private static string RequireUnchangedDigest(string current, string? supplied, string code)
    {
        if (supplied is not null && supplied != current)
        {
            throw new CompanionContractException($"{code}-immutable");
        }
        return current;
    }

    private static void ValidateOptionalDigest(string? value, string code)
    {
        if (value is not null)
        {
            CompanionContract.RequireDigest(value, code);
        }
    }

    private static void ValidateRecordFields(
        CompanionOperationState state,
        CompanionAcquisitionRoute route,
        ulong phaseCompletedBytes,
        ulong? phaseTotalBytes,
        CompanionArtifactSet? artifacts,
        string? errorCode,
        string? executionIntentSha256,
        string? sourceAcquisitionIntentSha256,
        string? sourceAcquisitionReceiptSha256,
        string? sourceConversionIntentSha256)
    {
        if (route != CompanionAcquisitionRoute.Source)
        {
            throw new CompanionContractException("journal-route");
        }
        if (phaseCompletedBytes > CompanionContract.MaximumProgressBytes ||
            phaseTotalBytes > CompanionContract.MaximumProgressBytes ||
            phaseTotalBytes is ulong total && (total == 0 || phaseCompletedBytes > total))
        {
            throw new CompanionContractException("journal-progress");
        }
        if (state == CompanionOperationState.Available)
        {
            CompanionContract.ValidateArtifactSet(
                artifacts ?? throw new CompanionContractException("journal-artifacts-required"));
            if (errorCode is not null)
            {
                throw new CompanionContractException("journal-available-fields");
            }
        }
        else if (artifacts is not null)
        {
            throw new CompanionContractException("journal-artifacts-premature");
        }
        if (state == CompanionOperationState.Rejected)
        {
            if (!IsErrorCode(errorCode))
            {
                throw new CompanionContractException("journal-rejection-code");
            }
        }
        else if (errorCode is not null)
        {
            throw new CompanionContractException("journal-unexpected-error");
        }

        ValidateOptionalDigest(executionIntentSha256, "journal-execution-intent-digest");
        ValidateOptionalDigest(
            sourceAcquisitionIntentSha256,
            "journal-source-acquisition-intent-digest");
        ValidateOptionalDigest(
            sourceAcquisitionReceiptSha256,
            "journal-source-acquisition-receipt-digest");
        ValidateOptionalDigest(
            sourceConversionIntentSha256,
            "journal-source-conversion-intent-digest");

        var hasNoPhaseEvidence = executionIntentSha256 is null &&
            sourceAcquisitionIntentSha256 is null &&
            sourceAcquisitionReceiptSha256 is null &&
            sourceConversionIntentSha256 is null;
        var hasAcquisitionEvidence = executionIntentSha256 is not null &&
            sourceAcquisitionIntentSha256 is not null &&
            sourceAcquisitionReceiptSha256 is null &&
            sourceConversionIntentSha256 is null;
        var hasConversionEvidence = executionIntentSha256 is not null &&
            sourceAcquisitionIntentSha256 is not null &&
            sourceAcquisitionReceiptSha256 is not null &&
            sourceConversionIntentSha256 is not null;
        var phaseEvidenceValid = state switch
        {
            CompanionOperationState.Queued => hasNoPhaseEvidence,
            CompanionOperationState.AcquiringSource => hasAcquisitionEvidence,
            CompanionOperationState.Converting or
                CompanionOperationState.VerifyingComposition or
                CompanionOperationState.Available => hasConversionEvidence,
            CompanionOperationState.Cancelled or CompanionOperationState.Rejected =>
                hasNoPhaseEvidence || hasAcquisitionEvidence || hasConversionEvidence,
            _ => false
        };
        if (!phaseEvidenceValid)
        {
            throw new CompanionContractException("journal-phase-evidence");
        }
    }

    private CompanionOperationRecord ReadRecord(string path, string operationId)
    {
        var bytes = ReadBoundedRegularFile(
            path,
            "journal-record-file",
            "journal-record-read");

        CompanionOperationRecord record;
        try
        {
            CompanionStrictJson.RejectDuplicateProperties(bytes, "journal-record-json");
            record = JsonSerializer.Deserialize<CompanionOperationRecord>(bytes, JsonOptions)
                ?? throw new CompanionContractException("journal-record-json");
        }
        catch (JsonException)
        {
            throw new CompanionContractException("journal-record-json");
        }
        if (record.Schema != CompanionContract.OperationRecordSchema ||
            record.OperationId != operationId ||
            record.RequestSha256 != operationId)
        {
            throw new CompanionContractException("journal-record-contract");
        }
        try
        {
            CompanionContract.RequireDigest(record.RequestSha256, "journal-record-contract");
            var created = RequireTimestamp(record.CreatedAtUtc);
            var updated = RequireTimestamp(record.UpdatedAtUtc);
            if (updated < created)
            {
                throw new CompanionContractException("journal-record-contract");
            }
            ValidateRecordFields(
                record.State,
                record.Route,
                record.PhaseCompletedBytes,
                record.PhaseTotalBytes,
                record.Artifacts,
                record.ErrorCode,
                record.ExecutionIntentSha256,
                record.SourceAcquisitionIntentSha256,
                record.SourceAcquisitionReceiptSha256,
                record.SourceConversionIntentSha256);
        }
        catch (CompanionContractException)
        {
            throw new CompanionContractException("journal-record-contract");
        }
        if (!bytes.AsSpan().SequenceEqual(Serialize(record)))
        {
            throw new CompanionContractException("journal-record-canonical");
        }
        return record;
    }

    private CompanionOperationRecord ReadLatestRecord(string directory, string operationId)
    {
        var current = ReadRecord(Path.Combine(directory, "current.json"), operationId);
        var historyDirectory = Path.Combine(directory, "history");
        string[] entries;
        try
        {
            if (!Directory.Exists(historyDirectory) || File.Exists(historyDirectory) ||
                (File.GetAttributes(historyDirectory) & FileAttributes.ReparsePoint) != 0)
            {
                throw new CompanionContractException("journal-history-contract");
            }
            entries = Directory.GetFileSystemEntries(historyDirectory);
        }
        catch (CompanionContractException)
        {
            throw;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or
            NotSupportedException)
        {
            throw new CompanionContractException("journal-history-read");
        }

        if (entries.Length is 0 or > MaximumHistoryRecords)
        {
            throw new CompanionContractException("journal-history-contract");
        }
        Array.Sort(entries, StringComparer.Ordinal);
        var records = new CompanionOperationRecord[entries.Length];
        for (var index = 0; index < entries.Length; index++)
        {
            var expectedPath = Path.Combine(historyDirectory, SequenceFile(checked((ulong)index)));
            if (!string.Equals(entries[index], expectedPath, PathComparison))
            {
                throw new CompanionContractException("journal-history-contract");
            }
            var record = ReadRecord(expectedPath, operationId);
            if (record.Sequence != checked((ulong)index))
            {
                throw new CompanionContractException("journal-history-contract");
            }
            if (index == 0)
            {
                if (record.State != CompanionOperationState.Queued ||
                    record.CreatedAtUtc != record.UpdatedAtUtc)
                {
                    throw new CompanionContractException("journal-history-contract");
                }
            }
            else
            {
                ValidateHistoryTransition(records[index - 1], record);
            }
            records[index] = record;
        }

        var latestSequence = checked((ulong)(records.Length - 1));
        if (current.Sequence > latestSequence ||
            latestSequence - current.Sequence > 1 ||
            !Serialize(current).AsSpan().SequenceEqual(
                Serialize(records[checked((int)current.Sequence)])))
        {
            throw new CompanionContractException("journal-current-history-mismatch");
        }
        return records[^1];
    }

    private void RepairCurrentCache(
        string directory,
        string operationId,
        CompanionOperationRecord latest)
    {
        var path = Path.Combine(directory, "current.json");
        var current = ReadRecord(path, operationId);
        if (current.Sequence == latest.Sequence)
        {
            return;
        }
        if (checked(current.Sequence + 1) != latest.Sequence)
        {
            throw new CompanionContractException("journal-current-history-mismatch");
        }

        var canonical = Serialize(latest);
        ReplaceCurrent(path, canonical);
        var observed = ReadRecord(path, operationId);
        if (!Serialize(observed).AsSpan().SequenceEqual(canonical))
        {
            throw new CompanionContractException("journal-current-history-mismatch");
        }
    }

    private static void ValidateHistoryTransition(
        CompanionOperationRecord previous,
        CompanionOperationRecord next)
    {
        try
        {
            ValidateTransition(previous.State, next.State);
        }
        catch (CompanionContractException)
        {
            throw new CompanionContractException("journal-history-contract");
        }
        if (next.Sequence != checked(previous.Sequence + 1) ||
            next.OperationId != previous.OperationId ||
            next.RequestSha256 != previous.RequestSha256 ||
            next.Route != previous.Route ||
            next.CreatedAtUtc != previous.CreatedAtUtc ||
            RequireTimestamp(next.UpdatedAtUtc) < RequireTimestamp(previous.UpdatedAtUtc) ||
            !HistoryEvidenceIsValid(previous, next))
        {
            throw new CompanionContractException("journal-history-contract");
        }
    }

    private static bool HistoryEvidenceIsValid(
        CompanionOperationRecord previous,
        CompanionOperationRecord next)
    {
        if (previous.State == CompanionOperationState.Queued &&
            next.State == CompanionOperationState.AcquiringSource)
        {
            return next.ExecutionIntentSha256 is not null &&
                next.SourceAcquisitionIntentSha256 is not null &&
                next.SourceAcquisitionReceiptSha256 is null &&
                next.SourceConversionIntentSha256 is null;
        }
        if (previous.State == CompanionOperationState.AcquiringSource &&
            next.State == CompanionOperationState.Converting)
        {
            return next.ExecutionIntentSha256 == previous.ExecutionIntentSha256 &&
                next.SourceAcquisitionIntentSha256 ==
                    previous.SourceAcquisitionIntentSha256 &&
                next.SourceAcquisitionReceiptSha256 is not null &&
                next.SourceConversionIntentSha256 is not null;
        }
        return next.ExecutionIntentSha256 == previous.ExecutionIntentSha256 &&
            next.SourceAcquisitionIntentSha256 == previous.SourceAcquisitionIntentSha256 &&
            next.SourceAcquisitionReceiptSha256 == previous.SourceAcquisitionReceiptSha256 &&
            next.SourceConversionIntentSha256 == previous.SourceConversionIntentSha256;
    }

    private CompanionOperationRecord ReadExistingOperation(
        string operationId,
        ReadOnlySpan<byte> expectedRequest)
    {
        var directory = RequireOperationDirectory(operationId);
        var request = ReadBoundedRegularFile(
            Path.Combine(directory, "request.json"),
            "journal-request-file",
            "journal-request-file");
        if (!request.AsSpan().SequenceEqual(expectedRequest) || Sha256(request) != operationId)
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        try
        {
            _ = CompanionLoopbackWire.DecodeAcquireRequest(request);
        }
        catch (CompanionProtocolException)
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        var record = ReadLatestRecord(directory, operationId);
        if (record.RequestSha256 != operationId)
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        return record;
    }

    private static byte[] ReadBoundedRegularFile(
        string path,
        string validationCode,
        string ioCode)
    {
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists || info.Length is <= 0 or > MaximumRecordBytes ||
                (info.Attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new CompanionContractException(validationCode);
            }
            using var stream = new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                MaximumRecordBytes,
                FileOptions.SequentialScan);
            var length = stream.Length;
            if (length is <= 0 or > MaximumRecordBytes)
            {
                throw new CompanionContractException(validationCode);
            }
            var bytes = new byte[checked((int)length)];
            stream.ReadExactly(bytes);
            if (stream.Position != length || stream.Length != length)
            {
                throw new CompanionContractException(validationCode);
            }
            return bytes;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or
            NotSupportedException)
        {
            throw new CompanionContractException(ioCode);
        }
    }

    private static PersistedCancellationFile ReadCancellationIntentFile(string path)
    {
        var bytes = ReadBoundedRegularFile(
            path,
            "journal-cancellation-intent-file",
            "journal-cancellation-intent-read");
        try
        {
            return new PersistedCancellationFile(
                CompanionLoopbackWire.DecodeCancelRequest(bytes),
                bytes);
        }
        catch (CompanionProtocolException)
        {
            throw new CompanionContractException("journal-cancellation-intent-contract");
        }
    }

    private OperationGateLease AcquireOperationGate(string operationId) =>
        AcquireOperationGate(operationId, wait: true)
            ?? throw new CompanionContractException("journal-operation-busy");

    private OperationGateLease? TryAcquireOperationGate(string operationId) =>
        AcquireOperationGate(operationId, wait: false);

    private OperationGateLease? AcquireOperationGate(string operationId, bool wait)
    {
        var key = OperationDirectory(operationId);
        while (true)
        {
            var entry = InProcessLocks.GetOrAdd(
                key,
                static value => new OperationGateEntry(value));
            if (!entry.TryRetain())
            {
                continue;
            }

            var acquired = false;
            try
            {
                if (wait)
                {
                    acquired = entry.Semaphore.Wait(OperationGateWaitMilliseconds);
                }
                else
                {
                    acquired = entry.Semaphore.Wait(0);
                }

                if (!acquired)
                {
                    ReleaseOperationGateReference(entry);
                    return null;
                }
                return new OperationGateLease(entry);
            }
            catch
            {
                if (!acquired)
                {
                    ReleaseOperationGateReference(entry);
                }
                throw;
            }
        }
    }

    private static void ReleaseOperationGateReference(OperationGateEntry entry)
    {
        lock (entry.SyncRoot)
        {
            if (entry.ReferenceCount <= 0)
            {
                throw new InvalidOperationException("The operation gate reference count is invalid.");
            }

            entry.ReferenceCount--;
            if (entry.ReferenceCount != 0)
            {
                return;
            }

            entry.Removed = true;
            var removed = ((ICollection<KeyValuePair<string, OperationGateEntry>>)InProcessLocks)
                .Remove(new KeyValuePair<string, OperationGateEntry>(entry.Key, entry));
            if (!removed)
            {
                entry.Removed = false;
            }
        }
    }

    private static byte[] PersistCanonicalEvidence(
        string path,
        byte[] canonical,
        string code)
    {
        if (!File.Exists(path))
        {
            try
            {
                WriteCreateOnly(path, canonical);
            }
            catch (IOException) when (File.Exists(path))
            {
            }
        }
        var observed = ReadBoundedRegularFile(path, $"{code}-file", $"{code}-read");
        if (!observed.AsSpan().SequenceEqual(canonical))
        {
            throw new CompanionContractException($"{code}-conflict");
        }
        return observed;
    }

    private string OperationDirectory(string operationId) => Path.Combine(_operationsRoot, operationId);

    private string RequireOperationDirectory(string operationId)
    {
        var directory = OperationDirectory(operationId);
        if (!Directory.Exists(directory) || File.Exists(directory) ||
            (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException("journal-operation-missing");
        }
        return directory;
    }

    private void DeleteOwnedStagingDirectory(string path)
    {
        var full = Path.GetFullPath(path);
        if (!string.Equals(Path.GetDirectoryName(full), _operationsRoot, PathComparison) ||
            !Path.GetFileName(full).StartsWith(".staging-", StringComparison.Ordinal) ||
            (File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException("journal-staging-ownership");
        }
        Directory.Delete(full, recursive: true);
    }

    private string Timestamp() =>
        _timeProvider.GetUtcNow().ToString("O", CultureInfo.InvariantCulture);

    private static DateTimeOffset RequireTimestamp(string value)
    {
        if (!DateTimeOffset.TryParseExact(
                value,
                "O",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsed) ||
            parsed.Offset != TimeSpan.Zero ||
            value != parsed.ToString("O", CultureInfo.InvariantCulture))
        {
            throw new CompanionContractException("journal-record-contract");
        }
        return parsed;
    }

    private static FileStream AcquireProcessLock(string path)
    {
        try
        {
            return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, 1,
                FileOptions.WriteThrough);
        }
        catch (IOException)
        {
            throw new CompanionContractException("journal-operation-busy");
        }
    }

    private static void ReplaceCurrent(string path, byte[] bytes)
    {
        var temporary = Path.Combine(
            Path.GetDirectoryName(path)!,
            $".current-{Guid.NewGuid():N}.tmp");
        WriteCreateOnly(temporary, bytes);
        try
        {
            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static void WriteCreateOnly(string path, byte[] bytes)
    {
        using var stream = new FileStream(
            path,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            65_536,
            FileOptions.WriteThrough);
        stream.Write(bytes);
        stream.Flush(flushToDisk: true);
    }

    private static byte[] Serialize<T>(T value)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
        if (bytes.Length is 0 or > MaximumRecordBytes)
        {
            throw new CompanionContractException("journal-record-size");
        }
        return bytes;
    }

    private static string RequireOwnedRoot(string value)
    {
        var root = FullPath(value, nameof(value));
        if (!Directory.Exists(root))
        {
            throw new CompanionContractException("journal-root-missing");
        }
        RejectReparsePoint(root, "journal-root-reparse");
        var marker = Path.Combine(root, MarkerFileName);
        if (!File.Exists(marker) ||
            (File.GetAttributes(marker) & FileAttributes.ReparsePoint) != 0 ||
            File.ReadAllText(marker, Encoding.ASCII) != CompanionContract.OwnedRootMarker)
        {
            throw new CompanionContractException("journal-root-marker");
        }
        return root;
    }

    private static string FullPath(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        if (value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException("The path contains an embedded NUL.", parameterName);
        }
        return Path.GetFullPath(value);
    }

    private static void RejectReparsePoint(string path, string code)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException(code);
        }
    }

    private static void RequireOperationId(string value)
    {
        CompanionContract.RequireDigest(value, "journal-operation-id");
    }

    private static bool IsErrorCode(string? value) =>
        value is { Length: >= 3 and <= 64 } &&
        value[0] is >= 'a' and <= 'z' &&
        value.All(character => character is (>= 'a' and <= 'z') or
            (>= '0' and <= '9') or '-');

    private static string SequenceFile(ulong sequence) => $"{sequence:D20}.json";

    private static StringComparison PathComparison => OperatingSystem.IsWindows()
        ? StringComparison.OrdinalIgnoreCase
        : StringComparison.Ordinal;

    private static string Sha256(byte[] bytes) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)).ToLowerInvariant();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        AllowTrailingCommas = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false) }
    };

    private sealed class OperationGateEntry(string key)
    {
        internal string Key { get; } = key;
        internal SemaphoreSlim Semaphore { get; } = new(1, 1);
        internal object SyncRoot { get; } = new();
        internal int ReferenceCount { get; set; }
        internal bool Removed { get; set; }

        internal bool TryRetain()
        {
            lock (SyncRoot)
            {
                if (Removed)
                {
                    return false;
                }
                ReferenceCount = checked(ReferenceCount + 1);
                return true;
            }
        }
    }

    private sealed class OperationGateLease(OperationGateEntry entry) : IDisposable
    {
        private OperationGateEntry? _entry = entry;

        public void Dispose()
        {
            var retained = Interlocked.Exchange(ref _entry, null);
            if (retained is null)
            {
                return;
            }
            retained.Semaphore.Release();
            ReleaseOperationGateReference(retained);
        }
    }

    private sealed record PersistedCancellationFile(
        CompanionCancelRequest Request,
        byte[] Bytes);
}
