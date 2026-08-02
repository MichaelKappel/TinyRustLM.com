using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.SeedHost;

/// <summary>Owned storage and execution limits for browser-initiated peer imports.</summary>
public sealed record SeedHostBridgeOperationOptions(
    string RootDirectory,
    string? MiniModelExecutablePath = null,
    TimeSpan? OperationTimeout = null,
    int MaximumManifestBytes = 4 * 1024 * 1024,
    int MaximumPeerRequestBytes = 256 * 1024,
    string? SharingRootDirectory = null,
    bool AllowSharing = false);

/// <summary>Manifest and one or two peer requests supplied by the browser catalog workflow.</summary>
public sealed record SeedHostBridgeImportSubmission(
    string ManifestText,
    IReadOnlyList<string> PeerImportRequests);

/// <summary>Public-safe lifecycle state for one durable import operation.</summary>
public enum SeedHostBridgeImportState
{
    /// <summary>Durable inputs exist and execution is about to begin.</summary>
    Queued,
    /// <summary>Rust is validating manifest-bound peer metadata before model bytes.</summary>
    Preflighting,
    /// <summary>The cancellable Rust importer is fetching and verifying peer pieces.</summary>
    Importing,
    /// <summary>The completed artifact and receipt chain are being reinspected.</summary>
    Validating,
    /// <summary>The artifact is complete and eligible for receipt-checked browser loading.</summary>
    Available,
    /// <summary>The operation stopped safely and can resume from Rust-owned staging state.</summary>
    Resumable,
    /// <summary>A non-resumable identity or validation failure requires operator attention.</summary>
    Failed
}

/// <summary>
/// Public-safe import status. Paths, peer URLs, request documents, and credentials are never
/// represented in this type.
/// </summary>
public sealed record SeedHostBridgeImportStatus(
    string OperationId,
    SeedHostBridgeImportState State,
    string? ModelId,
    long ArtifactByteCount,
    int VerifiedPieceCount,
    int DownloadedPieceCount,
    int ReusedPieceCount,
    int RefetchedCorruptPieceCount,
    int NetworkRetryCount,
    bool WasResumed,
    string? ArtifactSha256,
    bool CanResume,
    string? ErrorCode,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

/// <summary>One receipt-verified local model available to the paired browser.</summary>
public sealed record SeedHostBridgeModelInfo(
    string OperationId,
    string ModelId,
    long ArtifactByteCount,
    string ArtifactSha256,
    int PieceCount);

/// <summary>An opened model stream whose complete Rust receipt chain was just revalidated.</summary>
public sealed class SeedHostBridgeModelContent : IAsyncDisposable
{
    internal SeedHostBridgeModelContent(
        Stream content,
        string modelId,
        long byteCount,
        string artifactSha256)
    {
        Content = content;
        ModelId = modelId;
        ByteCount = byteCount;
        ArtifactSha256 = artifactSha256;
    }

    /// <summary>Read-only bounded artifact stream.</summary>
    public Stream Content { get; }

    /// <summary>Rust-validated model identity.</summary>
    public string ModelId { get; }

    /// <summary>Exact expected artifact byte count.</summary>
    public long ByteCount { get; }

    /// <summary>Rust-validated artifact SHA-256 identity.</summary>
    public string ArtifactSha256 { get; }

    /// <inheritdoc />
    public ValueTask DisposeAsync() => Content.DisposeAsync();
}

/// <summary>Injectable process boundary used to test hard cancellation without fake Rust rules.</summary>
internal interface ISeedHostBridgeImporter
{
    Task<PeerImportExecution> ImportAsync(
        SeedPeerImportOptions options,
        CancellationToken cancellationToken = default);
}

internal sealed class SeedHostBridgeImporter(SeedPeerImportService service)
    : ISeedHostBridgeImporter
{
    public Task<PeerImportExecution> ImportAsync(
        SeedPeerImportOptions options,
        CancellationToken cancellationToken = default) =>
        service.ImportAsync(options, cancellationToken);
}

/// <summary>
/// Durable, idempotent browser import coordinator. Rust remains authoritative for every manifest,
/// peer identity, piece, assembly, and receipt decision.
/// </summary>
public sealed class SeedHostBridgeOperations :
    ISeedHostBridgeOperations,
    ISeedHostBridgeSharingOperations
{
    private const string StateFileName = "bridge-import-state.v1.json";
    private const string ImportsDirectoryName = "imports";
    private const int StateSchemaVersion = 1;
    private const int MaximumPersistedStateBytes = 128 * 1024;
    private const int MaximumPeerCount = 2;

    private static readonly JsonSerializerOptions StateJsonOptions = CreateStateJsonOptions();
    private static readonly string[] SensitiveNames =
    [
        "access_token",
        "api_key",
        "apikey",
        "authorization",
        "bearer",
        "client_secret",
        "credential",
        "credentials",
        "password",
        "private_key",
        "refresh_token",
        "secret",
        "token"
    ];

    private readonly SeedHostBridgeOperationOptions options;
    private readonly IMiniModelAuthority authority;
    private readonly ISeedHostBridgeImporter importer;
    private readonly SeedFleetStore? sharingStore;
    private readonly SemaphoreSlim sharingLock = new(1, 1);
    private readonly Dictionary<string, OperationContext> operations = new(StringComparer.Ordinal);
    private readonly object operationsSync = new();
    private bool disposed;

    /// <summary>Create a durable operation coordinator using the reviewed Rust importer.</summary>
    public SeedHostBridgeOperations(
        SeedHostBridgeOperationOptions options,
        IMiniModelAuthority authority)
        : this(options, authority, new SeedHostBridgeImporter(new SeedPeerImportService(authority)))
    {
    }

    internal SeedHostBridgeOperations(
        SeedHostBridgeOperationOptions options,
        IMiniModelAuthority authority,
        ISeedHostBridgeImporter importer)
    {
        this.options = ValidateOptions(options);
        this.authority = authority ?? throw new ArgumentNullException(nameof(authority));
        this.importer = importer ?? throw new ArgumentNullException(nameof(importer));
        if (this.options.AllowSharing)
        {
            var sharingRoot = RequiredSharingRoot(this.options);
            RequireDescendantRoot(sharingRoot, this.options.RootDirectory);
            sharingStore = new SeedFleetStore(
                new SeedFleetStoreOptions(sharingRoot),
                this.authority);
        }
        LoadPersistedOperations();
    }

    /// <inheritdoc />
    public uint NativeAbiVersion => authority.NativeAbiVersion;

    /// <inheritdoc />
    public ValueTask<SeedHostBridgeRuntimeStatus> GetStatusAsync(
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        cancellationToken.ThrowIfCancellationRequested();
        PersistedImportState[] states;
        lock (operationsSync)
        {
            states = operations.Values.Select(value => value.ReadState()).ToArray();
        }
        return ValueTask.FromResult(new SeedHostBridgeRuntimeStatus(
            "ready",
            NativeAbiVersion,
            states.Count(value => value.State == SeedHostBridgeImportState.Available),
            states.Count(value => IsActive(value.State)),
            options.AllowSharing));
    }

    /// <summary>
    /// Create, resume, or observe one deterministic import. Identical content always maps to the
    /// same operation ID, so browser retries cannot duplicate model downloads.
    /// </summary>
    public ValueTask<SeedHostBridgeImportStatus> StartImportAsync(
        SeedHostBridgeImportSubmission submission,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var validated = ValidateSubmission(submission);
        cancellationToken.ThrowIfCancellationRequested();
        var operationId = CreateOperationId(validated.ManifestBytes, validated.RequestBytes);
        OperationContext context;
        lock (operationsSync)
        {
            if (!operations.TryGetValue(operationId, out context!))
            {
                context = CreateOperation(operationId, validated);
                operations.Add(operationId, context);
            }
            else
            {
                VerifyPersistedInputs(context, validated);
            }
            var current = context.ReadState();
            if (current.State is SeedHostBridgeImportState.Resumable)
            {
                StartRunner(context);
            }
            else if (current.State is SeedHostBridgeImportState.Queued && context.Runner is null)
            {
                StartRunner(context);
            }
            return ValueTask.FromResult(ToStatus(context.ReadState()));
        }
    }

    /// <summary>Read public-safe status for one known operation.</summary>
    public ValueTask<SeedHostBridgeImportStatus> GetImportAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult(ToStatus(GetContext(operationId).ReadState()));
    }

    /// <summary>
    /// Cancel the active Rust process tree. Verified staging pieces remain owned by Rust and the
    /// operation becomes explicitly resumable.
    /// </summary>
    public async ValueTask<SeedHostBridgeImportStatus> CancelImportAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var context = GetContext(operationId);
        Task? runner;
        lock (context.Sync)
        {
            runner = context.Runner;
            context.Cancellation?.Cancel();
        }
        if (runner is not null)
        {
            await runner.WaitAsync(cancellationToken).ConfigureAwait(false);
        }
        var state = context.ReadState();
        if (IsActive(state.State))
        {
            state = UpdateState(context, current => current with
            {
                State = SeedHostBridgeImportState.Resumable,
                ErrorCode = "bridge_import_cancelled",
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }
        return ToStatus(state);
    }

    /// <summary>List only complete imports. In-progress and failed artifacts are never exposed.</summary>
    public ValueTask<IReadOnlyList<SeedHostBridgeModelInfo>> ListModelsAsync(
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        cancellationToken.ThrowIfCancellationRequested();
        List<SeedHostBridgeModelInfo> values;
        lock (operationsSync)
        {
            values = operations.Values
                .Select(value => value.ReadState())
                .Where(value => value.State == SeedHostBridgeImportState.Available)
                .OrderBy(value => value.ModelId, StringComparer.Ordinal)
                .Select(value => new SeedHostBridgeModelInfo(
                    value.OperationId,
                    RequiredPersisted(value.ModelId, "model identity"),
                    value.ArtifactByteCount,
                    RequiredPersisted(value.ArtifactSha256, "artifact identity"),
                    value.PieceCount))
                .ToList();
        }
        return ValueTask.FromResult<IReadOnlyList<SeedHostBridgeModelInfo>>(values);
    }

    /// <summary>
    /// Reinspect the complete Rust receipt chain immediately before opening model bytes. A stale,
    /// replaced, linked, or invalid artifact is never returned to the browser.
    /// </summary>
    public ValueTask<SeedHostBridgeModelContent> OpenModelAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        cancellationToken.ThrowIfCancellationRequested();
        var context = GetContext(operationId);
        var state = context.ReadState();
        if (state.State != SeedHostBridgeImportState.Available)
        {
            throw new SeedHostValidationException(
                "bridge_model_not_available",
                "The requested model has not completed receipt-verified import.");
        }

        FileStream? stream = null;
        try
        {
            var manifestPath = RequireRegularOwnedFile(context, state.ManifestFile);
            var requestPath = RequireRegularOwnedFile(context, state.WinningRequestFile);
            var preflightPath = RequireRegularOwnedFile(context, state.WinningPreflightFile);
            var receiptPath = RequireRegularOwnedFile(context, state.ReceiptFile);
            var artifactPath = RequireRegularOwnedFile(context, state.ArtifactFile);
            stream = new FileStream(
                artifactPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 128 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan);
            if (stream.Length != state.ArtifactByteCount)
            {
                throw new SeedHostException(
                    "bridge_model_revalidation_failed",
                    "The local model byte count changed after its verified import.");
            }
            PeerImportReceiptInspection receipt;
            try
            {
                receipt = authority.InspectPeerImportReceipt(
                    receiptPath,
                    requestPath,
                    preflightPath,
                    manifestPath,
                    artifactPath);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                throw new SeedHostException(
                    "bridge_model_revalidation_failed",
                    "Rust rejected the imported model receipt chain before browser loading.",
                    error);
            }
            ValidateReceipt(state, receipt);
            cancellationToken.ThrowIfCancellationRequested();
            var result = new SeedHostBridgeModelContent(
                stream,
                RequiredPersisted(state.ModelId, "model identity"),
                state.ArtifactByteCount,
                RequiredPersisted(state.ArtifactSha256, "artifact identity"));
            stream = null;
            return ValueTask.FromResult(result);
        }
        finally
        {
            stream?.Dispose();
        }
    }

    /// <inheritdoc />
    public async ValueTask<SeedHostBridgeSharingStatus> GetSharingAsync(
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var store = RequireSharingStore();
        await sharingLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await BuildSharingStatusAsync(store, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            sharingLock.Release();
        }
    }

    /// <inheritdoc />
    public async ValueTask<SeedHostBridgeSharingStatus> InitializeSharingAsync(
        string fleetId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var store = RequireSharingStore();
        await sharingLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _ = await store.InitializeAsync(fleetId, cancellationToken).ConfigureAwait(false);
            return await BuildSharingStatusAsync(store, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            sharingLock.Release();
        }
    }

    /// <inheritdoc />
    public async ValueTask<SeedHostBridgeSharingStatus> AdmitImportForSharingAsync(
        string operationId,
        IReadOnlyList<SeedLaneAdmissionEndpoint> laneEndpoints,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        ArgumentNullException.ThrowIfNull(laneEndpoints);
        var store = RequireSharingStore();
        await sharingLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var configuration = await store.ReadConfigurationAsync(cancellationToken)
                .ConfigureAwait(false);
            var context = GetContext(operationId);
            var state = RequireAvailableState(context);
            var manifestPath = RequireRegularOwnedFile(context, state.ManifestFile);
            var pieceDirectory = RequireAvailablePieceDirectory(context, state);

            await using (var model = await OpenModelAsync(operationId, cancellationToken)
                .ConfigureAwait(false))
            {
                cancellationToken.ThrowIfCancellationRequested();
            }
            var pieces = authority.InspectPeerPieceDirectory(manifestPath, pieceDirectory);
            ValidatePiecesForSharing(state, pieces);

            var manifestRelative = ToSharingRelative(store, manifestPath);
            var piecesRelative = ToSharingRelative(store, pieceDirectory);
            var endpoints = ValidateSharingEndpoints(configuration, state, laneEndpoints);
            var existing = configuration.Models.SingleOrDefault(model =>
                string.Equals(model.ModelId, state.ModelId, StringComparison.Ordinal));
            if (existing is not null)
            {
                ValidateIdempotentSharingAdmission(
                    configuration,
                    existing,
                    state,
                    manifestRelative,
                    piecesRelative,
                    endpoints);
                return await BuildSharingStatusAsync(store, cancellationToken).ConfigureAwait(false);
            }

            var finalStateDirectory = ResolveOwnedPath(context, "sharing-state-v1");
            if (Directory.Exists(finalStateDirectory) || File.Exists(finalStateDirectory))
            {
                throw new SeedHostException(
                    "bridge_sharing_state_conflict",
                    "An unrecognized file occupies the imported model sharing-state path.");
            }
            var stagingStateDirectory = ResolveOwnedPath(
                context,
                $".sharing-state-{Guid.NewGuid():N}");
            Directory.CreateDirectory(stagingStateDirectory);
            var committedStateDirectory = false;
            var committedFleet = false;
            try
            {
                var assignments = new List<SeedLaneEndpointAssignment>(endpoints.Count);
                foreach (var endpoint in endpoints)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var statePath = Path.Combine(stagingStateDirectory, $"{endpoint.LaneId}.state.json");
                    var written = authority.WritePeerCompanionState(
                        manifestPath,
                        pieceDirectory,
                        statePath,
                        endpoint.PublicBaseUrl);
                    ValidateWrittenSharingState(state, endpoint, written);
                    var inspected = authority.InspectPeerCompanionState(
                        statePath,
                        manifestPath,
                        pieceDirectory);
                    ValidateInspectedSharingState(state, endpoint, pieces, inspected);
                }
                Directory.Move(stagingStateDirectory, finalStateDirectory);
                committedStateDirectory = true;

                foreach (var endpoint in endpoints)
                {
                    var statePath = Path.Combine(finalStateDirectory, $"{endpoint.LaneId}.state.json");
                    var inspected = authority.InspectPeerCompanionState(
                        statePath,
                        manifestPath,
                        pieceDirectory);
                    ValidateInspectedSharingState(state, endpoint, pieces, inspected);
                    assignments.Add(new SeedLaneEndpointAssignment(
                        endpoint.LaneId,
                        new SeedFleetEndpoint(
                            RequiredPersisted(state.ModelId, "model identity"),
                            ToSharingRelative(store, statePath),
                            endpoint.BindAddress,
                            endpoint.PublicBaseUrl)));
                }
                var fleetModel = new SeedFleetModel(
                    RequiredPersisted(state.ModelId, "model identity"),
                    Enabled: false,
                    manifestRelative,
                    piecesRelative,
                    RequiredPersisted(state.ArtifactSha256, "artifact identity"));
                ValidateProspectiveFleet(configuration, fleetModel, assignments);
                _ = await store.AddModelAsync(fleetModel, assignments, cancellationToken)
                    .ConfigureAwait(false);
                committedFleet = true;
                return await BuildSharingStatusAsync(store, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                if (Directory.Exists(stagingStateDirectory))
                {
                    Directory.Delete(stagingStateDirectory, recursive: true);
                }
                if (committedStateDirectory
                    && !committedFleet
                    && Directory.Exists(finalStateDirectory))
                {
                    Directory.Delete(finalStateDirectory, recursive: true);
                }
                throw;
            }
        }
        finally
        {
            sharingLock.Release();
        }
    }

    /// <inheritdoc />
    public async ValueTask<SeedHostBridgeSharingStatus> SetImportSharingEnabledAsync(
        string operationId,
        bool enabled,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var store = RequireSharingStore();
        await sharingLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var state = RequireAvailableState(GetContext(operationId));
            var configuration = await store.ReadConfigurationAsync(cancellationToken)
                .ConfigureAwait(false);
            RequireOwnedFleetModel(configuration, state, operationId, store);
            _ = await store.SetModelEnabledAsync(
                    RequiredPersisted(state.ModelId, "model identity"),
                    enabled,
                    cancellationToken)
                .ConfigureAwait(false);
            return await BuildSharingStatusAsync(store, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            sharingLock.Release();
        }
    }

    /// <inheritdoc />
    public async ValueTask<SeedHostBridgeSharingStatus> RemoveImportFromSharingAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var store = RequireSharingStore();
        await sharingLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var state = RequireAvailableState(GetContext(operationId));
            var configuration = await store.ReadConfigurationAsync(cancellationToken)
                .ConfigureAwait(false);
            RequireOwnedFleetModel(configuration, state, operationId, store);
            _ = await store.RemoveModelAsync(
                    RequiredPersisted(state.ModelId, "model identity"),
                    cancellationToken)
                .ConfigureAwait(false);
            return await BuildSharingStatusAsync(store, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            sharingLock.Release();
        }
    }

    private SeedFleetStore RequireSharingStore() =>
        options.AllowSharing && sharingStore is not null
            ? sharingStore
            : throw new SeedHostValidationException(
                "bridge_sharing_disabled",
                "Sharing control was not enabled by the local companion operator.");

    private async ValueTask<SeedHostBridgeSharingStatus> BuildSharingStatusAsync(
        SeedFleetStore store,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!File.Exists(store.ConfigurationPath))
        {
            if (Directory.Exists(store.ConfigurationPath))
            {
                throw new SeedHostException(
                    "bridge_sharing_configuration_invalid",
                    "A directory occupies the owned seed-fleet configuration path.");
            }
            return new SeedHostBridgeSharingStatus(
                SharingEnabled: true,
                Initialized: false,
                FleetId: null,
                SeedFleetConfiguration.RequiredTargetModelCount,
                AdmittedModelCount: 0,
                SeedFleetConfiguration.RequiredTargetModelCount,
                SeedFleetConfiguration.RequiredReplicaLaneCount,
                AdvertisementStatus: "not-initialized",
                Models: []);
        }

        var configuration = await store.ReadConfigurationAsync(cancellationToken)
            .ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        var inspection = authority.InspectSeedFleet(store.ConfigurationPath);
        ValidateSharingFleetInspection(configuration, inspection);

        var operationByManifest = new Dictionary<string, string>(StringComparer.Ordinal);
        lock (operationsSync)
        {
            foreach (var pair in operations)
            {
                var state = pair.Value.ReadState();
                if (state.State != SeedHostBridgeImportState.Available)
                {
                    continue;
                }
                var manifestPath = RequireRegularOwnedFile(pair.Value, state.ManifestFile);
                var relative = NormalizeOwnedPath(ToSharingRelative(store, manifestPath));
                if (!operationByManifest.TryAdd(relative, pair.Key))
                {
                    throw new SeedHostException(
                        "bridge_sharing_operation_conflict",
                        "More than one bridge operation claimed the same fleet manifest path.");
                }
            }
        }

        var models = configuration.Models
            .OrderBy(model => model.ModelId, StringComparer.Ordinal)
            .Select(model =>
            {
                operationByManifest.TryGetValue(
                    NormalizeOwnedPath(model.ManifestPath),
                    out var operationId);
                return new SeedHostBridgeSharingModelInfo(
                    operationId,
                    model.ModelId,
                    model.Enabled,
                    "external-proof-required");
            })
            .ToArray();
        return new SeedHostBridgeSharingStatus(
            SharingEnabled: true,
            Initialized: true,
            inspection.FleetId,
            inspection.TargetModelCount,
            inspection.AdmittedModelCount,
            inspection.RemainingModelCapacity,
            inspection.ReplicaLaneCount,
            inspection.AdvertisementStatus,
            models);
    }

    private static void ValidateSharingFleetInspection(
        SeedFleetConfiguration configuration,
        SeedFleetInspection inspection)
    {
        var modelIds = configuration.Models
            .Select(model => model.ModelId)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        var activeModelIds = configuration.Models
            .Where(model => model.Enabled)
            .Select(model => model.ModelId)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        var laneIds = configuration.Lanes
            .Select(lane => lane.LaneId)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        if (!string.Equals(inspection.FleetId, configuration.FleetId, StringComparison.Ordinal)
            || inspection.TargetModelCount != SeedFleetConfiguration.RequiredTargetModelCount
            || inspection.AdmittedModelCount != configuration.Models.Count
            || inspection.ActiveModelCount != activeModelIds.Length
            || inspection.RemainingModelCapacity
                != SeedFleetConfiguration.RequiredTargetModelCount - configuration.Models.Count
            || inspection.ReplicaLaneCount != SeedFleetConfiguration.RequiredReplicaLaneCount
            || inspection.PeerEndpointCount != configuration.Lanes.Sum(lane => lane.Endpoints.Count)
            || !inspection.ModelIds.OrderBy(value => value, StringComparer.Ordinal)
                .SequenceEqual(modelIds, StringComparer.Ordinal)
            || !inspection.ActiveModelIds.OrderBy(value => value, StringComparer.Ordinal)
                .SequenceEqual(activeModelIds, StringComparer.Ordinal)
            || !inspection.LaneIds.OrderBy(value => value, StringComparer.Ordinal)
                .SequenceEqual(laneIds, StringComparer.Ordinal)
            || string.IsNullOrWhiteSpace(inspection.AdvertisementStatus))
        {
            throw new SeedHostException(
                "bridge_sharing_fleet_revalidation_failed",
                "Rust fleet inspection disagreed with the managed seed-fleet configuration.");
        }
    }

    private static PersistedImportState RequireAvailableState(OperationContext context)
    {
        var state = context.ReadState();
        if (state.State != SeedHostBridgeImportState.Available)
        {
            throw new SeedHostValidationException(
                "bridge_model_not_available",
                "Only a completed receipt-verified browser import can be managed for sharing.");
        }
        return state;
    }

    private static void ValidatePiecesForSharing(
        PersistedImportState state,
        PeerPieceInspection pieces)
    {
        if (!string.Equals(state.ModelId, pieces.ModelId, StringComparison.Ordinal)
            || state.ArtifactByteCount != pieces.ArtifactByteCount
            || state.PieceCount != pieces.PieceCount
            || !string.Equals(state.ManifestSha256, pieces.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(state.ArtifactSha256, pieces.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(state.PieceSetSha256, pieces.PieceSetSha256, StringComparison.Ordinal)
            || !string.Equals(state.MerkleRootSha256, pieces.MerkleRootSha256, StringComparison.Ordinal))
        {
            throw new SeedHostException(
                "bridge_sharing_piece_identity_mismatch",
                "Rust piece inspection disagreed with the receipt-verified browser import.");
        }
    }

    private static IReadOnlyList<SeedLaneAdmissionEndpoint> ValidateSharingEndpoints(
        SeedFleetConfiguration configuration,
        PersistedImportState state,
        IReadOnlyList<SeedLaneAdmissionEndpoint> laneEndpoints)
    {
        if (laneEndpoints.Count != configuration.Lanes.Count)
        {
            throw new SeedHostValidationException(
                "lane_assignment_mismatch",
                "Sharing admission requires exactly one endpoint for each configured lane.");
        }
        var endpointMap = new Dictionary<string, SeedLaneAdmissionEndpoint>(StringComparer.Ordinal);
        foreach (var endpoint in laneEndpoints)
        {
            if (endpoint is null
                || string.IsNullOrWhiteSpace(endpoint.LaneId)
                || !endpointMap.TryAdd(endpoint.LaneId, endpoint))
            {
                throw new SeedHostValidationException(
                    "lane_assignment_mismatch",
                    "Sharing admission requires unique nonempty lane endpoint assignments.");
            }
        }
        if (!configuration.Lanes.All(lane => endpointMap.ContainsKey(lane.LaneId)))
        {
            throw new SeedHostValidationException(
                "lane_assignment_mismatch",
                "Sharing admission named an unknown lane or omitted a configured lane.");
        }

        var modelId = RequiredPersisted(state.ModelId, "model identity");
        var replacementModel = new SeedFleetModel(
            modelId,
            Enabled: false,
            "pending/browser-import.manifest",
            "pending/browser-import-pieces",
            RequiredPersisted(state.ArtifactSha256, "artifact identity"));
        var prospectiveModels = configuration.Models
            .Where(model => !string.Equals(model.ModelId, modelId, StringComparison.Ordinal))
            .Append(replacementModel);
        var prospectiveLanes = configuration.Lanes.Select(lane => lane with
        {
            Endpoints = lane.Endpoints
                .Where(endpoint => !string.Equals(endpoint.ModelId, modelId, StringComparison.Ordinal))
                .Append(new SeedFleetEndpoint(
                    modelId,
                    $"pending/{lane.LaneId}.state.json",
                    endpointMap[lane.LaneId].BindAddress,
                    endpointMap[lane.LaneId].PublicBaseUrl))
                .ToArray()
        });
        _ = SeedFleetConfiguration.Create(
            configuration.FleetId,
            prospectiveModels,
            prospectiveLanes);
        return configuration.Lanes.Select(lane => endpointMap[lane.LaneId]).ToArray();
    }

    private static void ValidateIdempotentSharingAdmission(
        SeedFleetConfiguration configuration,
        SeedFleetModel existing,
        PersistedImportState state,
        string manifestRelative,
        string piecesRelative,
        IReadOnlyList<SeedLaneAdmissionEndpoint> laneEndpoints)
    {
        var modelId = RequiredPersisted(state.ModelId, "model identity");
        var endpointMap = laneEndpoints.ToDictionary(endpoint => endpoint.LaneId, StringComparer.Ordinal);
        var matches = string.Equals(existing.ModelId, modelId, StringComparison.Ordinal)
            && string.Equals(
                NormalizeOwnedPath(existing.ManifestPath),
                NormalizeOwnedPath(manifestRelative),
                StringComparison.Ordinal)
            && string.Equals(
                NormalizeOwnedPath(existing.PieceDirectory),
                NormalizeOwnedPath(piecesRelative),
                StringComparison.Ordinal);
        foreach (var lane in configuration.Lanes)
        {
            var endpoint = lane.Endpoints.SingleOrDefault(candidate =>
                string.Equals(candidate.ModelId, modelId, StringComparison.Ordinal));
            matches = matches
                && endpoint is not null
                && endpointMap.TryGetValue(lane.LaneId, out var requested)
                && string.Equals(endpoint.BindAddress, requested.BindAddress, StringComparison.Ordinal)
                && string.Equals(endpoint.PublicBaseUrl, requested.PublicBaseUrl, StringComparison.Ordinal)
                && string.Equals(
                    NormalizeOwnedPath(endpoint.StatePath),
                    ExpectedSharingStateRelative(manifestRelative, lane.LaneId),
                    StringComparison.Ordinal);
        }
        if (!matches)
        {
            throw new SeedHostValidationException(
                "bridge_sharing_admission_conflict",
                "The model is already admitted with different owned paths or lane endpoints.");
        }
    }

    private static void ValidateWrittenSharingState(
        PersistedImportState state,
        SeedLaneAdmissionEndpoint endpoint,
        PeerCompanionStateWrite written)
    {
        if (!string.Equals(state.ModelId, written.ModelId, StringComparison.Ordinal)
            || state.PieceCount != written.PieceCount
            || !string.Equals(state.ManifestSha256, written.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(state.ArtifactSha256, written.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(state.MerkleRootSha256, written.MerkleRootSha256, StringComparison.Ordinal)
            || !string.Equals(endpoint.PublicBaseUrl, written.PeerBaseUrl, StringComparison.Ordinal))
        {
            throw new SeedHostException(
                "bridge_sharing_state_identity_mismatch",
                "Rust-written companion state disagreed with the receipt-verified import or lane.");
        }
    }

    private static void ValidateInspectedSharingState(
        PersistedImportState state,
        SeedLaneAdmissionEndpoint endpoint,
        PeerPieceInspection pieces,
        PeerCompanionInspection inspected)
    {
        if (!string.Equals(state.ModelId, inspected.ModelId, StringComparison.Ordinal)
            || state.ArtifactByteCount != inspected.ArtifactByteCount
            || state.PieceCount != inspected.PieceCount
            || !string.Equals(state.ManifestSha256, inspected.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(state.ArtifactSha256, inspected.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(state.MerkleRootSha256, inspected.MerkleRootSha256, StringComparison.Ordinal)
            || !string.Equals(pieces.PieceSetSha256, inspected.PieceSetSha256, StringComparison.Ordinal)
            || !string.Equals(endpoint.PublicBaseUrl, inspected.PeerBaseUrl, StringComparison.Ordinal))
        {
            throw new SeedHostException(
                "bridge_sharing_state_revalidation_failed",
                "Rust companion-state inspection disagreed with the imported model or lane endpoint.");
        }
    }

    private static void ValidateProspectiveFleet(
        SeedFleetConfiguration configuration,
        SeedFleetModel model,
        IReadOnlyList<SeedLaneEndpointAssignment> assignments)
    {
        var endpointMap = assignments.ToDictionary(value => value.LaneId, StringComparer.Ordinal);
        if (endpointMap.Count != configuration.Lanes.Count
            || !configuration.Lanes.All(lane => endpointMap.ContainsKey(lane.LaneId)))
        {
            throw new SeedHostValidationException(
                "lane_assignment_mismatch",
                "Sharing admission requires one validated endpoint for each fleet lane.");
        }
        _ = SeedFleetConfiguration.Create(
            configuration.FleetId,
            configuration.Models.Append(model),
            configuration.Lanes.Select(lane => lane with
            {
                Endpoints = lane.Endpoints.Append(endpointMap[lane.LaneId].Endpoint).ToArray()
            }));
    }

    private void RequireOwnedFleetModel(
        SeedFleetConfiguration configuration,
        PersistedImportState state,
        string operationId,
        SeedFleetStore store)
    {
        var context = GetContext(operationId);
        var modelId = RequiredPersisted(state.ModelId, "model identity");
        var model = configuration.Models.SingleOrDefault(candidate =>
            string.Equals(candidate.ModelId, modelId, StringComparison.Ordinal));
        var manifestRelative = ToSharingRelative(
            store,
            RequireRegularOwnedFile(context, state.ManifestFile));
        var piecesRelative = ToSharingRelative(
            store,
            RequireAvailablePieceDirectory(context, state));
        var owned = model is not null
            && string.Equals(
                NormalizeOwnedPath(model.ManifestPath),
                NormalizeOwnedPath(manifestRelative),
                StringComparison.Ordinal)
            && string.Equals(
                NormalizeOwnedPath(model.PieceDirectory),
                NormalizeOwnedPath(piecesRelative),
                StringComparison.Ordinal);
        foreach (var lane in configuration.Lanes)
        {
            var endpoint = lane.Endpoints.SingleOrDefault(candidate =>
                string.Equals(candidate.ModelId, modelId, StringComparison.Ordinal));
            owned = owned
                && endpoint is not null
                && string.Equals(
                    NormalizeOwnedPath(endpoint.StatePath),
                    ExpectedSharingStateRelative(manifestRelative, lane.LaneId),
                    StringComparison.Ordinal);
        }
        if (!owned)
        {
            throw new SeedHostValidationException(
                "bridge_sharing_model_not_owned",
                "The fleet model is absent or was not admitted by this browser import operation.");
        }
    }

    private static string ExpectedSharingStateRelative(string manifestRelative, string laneId)
    {
        var normalizedManifest = NormalizeOwnedPath(manifestRelative);
        var separator = normalizedManifest.LastIndexOf('/');
        var directory = separator >= 0 ? normalizedManifest[..separator] + "/" : string.Empty;
        return $"{directory}sharing-state-v1/{laneId}.state.json";
    }

    private static string ToSharingRelative(SeedFleetStore store, string path)
    {
        var root = Path.GetFullPath(store.RootDirectory).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        var absolute = Path.GetFullPath(path);
        var prefix = root + Path.DirectorySeparatorChar;
        if (!absolute.StartsWith(prefix, PathComparison))
        {
            throw new SeedHostException(
                "bridge_sharing_path_escape",
                "A browser import path escaped the explicitly owned seed-fleet root.");
        }
        return NormalizeOwnedPath(Path.GetRelativePath(root, absolute));
    }

    private static string NormalizeOwnedPath(string path) =>
        path.Replace(Path.DirectorySeparatorChar, '/')
            .Replace(Path.AltDirectorySeparatorChar, '/');

    private static string RequiredSharingRoot(SeedHostBridgeOperationOptions value)
    {
        if (string.IsNullOrWhiteSpace(value.SharingRootDirectory)
            || value.SharingRootDirectory.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "bridge_sharing_root_invalid",
                "Sharing requires one explicit credential-free owned fleet root.");
        }
        return Path.GetFullPath(value.SharingRootDirectory);
    }

    private static void RequireDescendantRoot(string parentRoot, string childRoot)
    {
        var parent = Path.GetFullPath(parentRoot).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        var child = Path.GetFullPath(childRoot).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        if (!string.Equals(parent, child, PathComparison)
            && !child.StartsWith(parent + Path.DirectorySeparatorChar, PathComparison))
        {
            throw new SeedHostValidationException(
                "bridge_sharing_root_mismatch",
                "Bridge import storage must remain inside the explicitly owned seed-fleet root.");
        }
    }

    private OperationContext CreateOperation(string operationId, ValidatedSubmission submission)
    {
        EnsureOwnedRoot();
        var importsRoot = Path.Combine(options.RootDirectory, ImportsDirectoryName);
        EnsureRegularDirectory(importsRoot, create: true, "bridge_import_root_unsafe");
        var operationRoot = Path.Combine(importsRoot, operationId);
        if (Directory.Exists(operationRoot) || File.Exists(operationRoot))
        {
            throw new SeedHostException(
                "bridge_import_state_conflict",
                "An unrecognized file already occupies the deterministic operation path.");
        }
        Directory.CreateDirectory(operationRoot);
        try
        {
            EnsureRegularDirectory(operationRoot, create: false, "bridge_import_root_unsafe");
            var manifestFile = "manifest.minimodel";
            WriteDurableNewFile(Path.Combine(operationRoot, manifestFile), submission.ManifestBytes);
            var requestFiles = new List<string>(submission.RequestBytes.Count);
            for (var index = 0; index < submission.RequestBytes.Count; index++)
            {
                var fileName = $"peer-request-{index}.json";
                WriteDurableNewFile(Path.Combine(operationRoot, fileName), submission.RequestBytes[index]);
                requestFiles.Add(fileName);
            }
            MiniModelManifestInspection manifest;
            try
            {
                manifest = authority.InspectManifest(Path.Combine(operationRoot, manifestFile));
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                throw new SeedHostException(
                    "bridge_manifest_invalid",
                    "Rust rejected the supplied MiniModel manifest.",
                    error);
            }
            var now = DateTimeOffset.UtcNow;
            var state = new PersistedImportState(
                StateSchemaVersion,
                operationId,
                SeedHostBridgeImportState.Queued,
                manifestFile,
                requestFiles,
                Sha256Hex(submission.ManifestBytes),
                submission.RequestBytes.Select(Sha256Hex).ToArray(),
                manifest.ModelId,
                manifest.ArtifactByteCount,
                manifest.ManifestSha256,
                manifest.ArtifactSha256,
                manifest.MerkleRootSha256,
                null,
                manifest.PieceCount,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                now,
                now);
            var context = new OperationContext(operationRoot, state);
            PersistState(context, state);
            return context;
        }
        catch
        {
            Directory.Delete(operationRoot, recursive: true);
            throw;
        }
    }

    private void StartRunner(OperationContext context)
    {
        lock (context.Sync)
        {
            if (context.Runner is { IsCompleted: false })
            {
                return;
            }
            context.Cancellation?.Dispose();
            context.Cancellation = new CancellationTokenSource();
            context.Runner = RunImportAsync(context, context.Cancellation.Token);
        }
    }

    private async Task RunImportAsync(OperationContext context, CancellationToken cancellationToken)
    {
        try
        {
            var initial = UpdateState(context, state => state with
            {
                State = SeedHostBridgeImportState.Preflighting,
                ErrorCode = null,
                UpdatedUtc = DateTimeOffset.UtcNow
            });
            var manifestPath = RequireRegularOwnedFile(context, initial.ManifestFile);
            var manifest = authority.InspectManifest(manifestPath);
            ValidateManifestIdentity(initial, manifest);
            var preflights = new List<(string RequestFile, string PreflightFile, PeerImportPreflight Value)>();
            for (var index = 0; index < initial.RequestFiles.Count; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var requestFile = initial.RequestFiles[index];
                var requestPath = RequireRegularOwnedFile(context, requestFile);
                var preflightFile = $"peer-preflight-{index}.json";
                var preflightPath = ResolveOwnedPath(context, preflightFile);
                PeerImportPreflight preflight;
                try
                {
                    preflight = authority.PreflightPeerImport(
                        requestPath,
                        manifestPath,
                        preflightPath);
                }
                catch (SeedHostException error)
                {
                    throw new SeedHostException(
                        "bridge_peer_preflight_rejected",
                        $"Rust rejected peer preflight {index + 1} before any piece import.",
                        error);
                }
                RequireRegularOwnedFile(context, preflightFile);
                ValidatePreflightAgainstManifest(manifest, preflight);
                preflights.Add((requestFile, preflightFile, preflight));
            }
            ValidatePreflightAgreement(preflights.Select(value => value.Value).ToArray());
            var identity = preflights[0].Value;
            UpdateState(context, state => state with
            {
                State = SeedHostBridgeImportState.Importing,
                PieceSetSha256 = identity.PieceSetSha256,
                ErrorCode = null,
                UpdatedUtc = DateTimeOffset.UtcNow
            });

            Exception? lastImportError = null;
            for (var index = 0; index < preflights.Count; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var candidate = preflights[index];
                var outputDirectory = ResolveOwnedPath(context, "data");
                try
                {
                    var report = await importer.ImportAsync(
                        new SeedPeerImportOptions(
                            ResolveOwnedPath(context, candidate.RequestFile),
                            manifestPath,
                            outputDirectory,
                            options.MiniModelExecutablePath,
                            options.OperationTimeout),
                        cancellationToken).ConfigureAwait(false);
                    UpdateState(context, state => state with
                    {
                        State = SeedHostBridgeImportState.Validating,
                        UpdatedUtc = DateTimeOffset.UtcNow
                    });
                    ValidateImportReport(manifest, identity, report);
                    var reportedPieceDirectory = RequireRegularOwnedAbsoluteDirectory(
                        context,
                        report.PieceDirPath);
                    RequireDirectoryInsideImportOutput(outputDirectory, reportedPieceDirectory);
                    var receipt = authority.InspectPeerImportReceipt(
                        RequireRegularOwnedAbsoluteFile(context, report.ReceiptPath),
                        ResolveOwnedPath(context, candidate.RequestFile),
                        ResolveOwnedPath(context, candidate.PreflightFile),
                        manifestPath,
                        RequireRegularOwnedAbsoluteFile(context, report.OutputArtifactPath));
                    ValidateReceiptAgainstImport(manifest, identity, report, receipt);
                    UpdateState(context, state => state with
                    {
                        State = SeedHostBridgeImportState.Available,
                        ModelId = receipt.ModelId,
                        ArtifactByteCount = manifest.ArtifactByteCount,
                        ArtifactSha256 = receipt.ArtifactSha256,
                        PieceSetSha256 = receipt.PieceSetSha256,
                        PieceCount = receipt.PieceCount,
                        DownloadedPieceCount = report.DownloadedPieceCount,
                        ReusedPieceCount = report.ReusedPieceCount,
                        RefetchedCorruptPieceCount = report.RefetchedCorruptPieceCount,
                        NetworkRetryCount = report.NetworkRetryCount,
                        WasResumed = report.Resumed,
                        ArtifactFile = ToOwnedRelativePath(context, report.OutputArtifactPath),
                        ReceiptFile = ToOwnedRelativePath(context, report.ReceiptPath),
                        PieceDirectory = ToOwnedRelativePath(context, reportedPieceDirectory),
                        WinningRequestFile = candidate.RequestFile,
                        WinningPreflightFile = candidate.PreflightFile,
                        ErrorCode = null,
                        UpdatedUtc = DateTimeOffset.UtcNow
                    });
                    return;
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception error)
                {
                    lastImportError = error;
                }
            }
            UpdateState(context, state => state with
            {
                State = SeedHostBridgeImportState.Resumable,
                ErrorCode = ErrorCode(lastImportError, "bridge_peer_import_failed"),
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            UpdateState(context, state => state.State == SeedHostBridgeImportState.Available
                ? state
                : state with
                {
                    State = SeedHostBridgeImportState.Resumable,
                    ErrorCode = "bridge_import_cancelled",
                    UpdatedUtc = DateTimeOffset.UtcNow
                });
        }
        catch (Exception error)
        {
            UpdateState(context, state => state with
            {
                State = SeedHostBridgeImportState.Failed,
                ErrorCode = ErrorCode(error, "bridge_import_failed"),
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }
    }

    private void LoadPersistedOperations()
    {
        if (!Directory.Exists(options.RootDirectory))
        {
            return;
        }
        EnsureOwnedRoot();
        var importsRoot = Path.Combine(options.RootDirectory, ImportsDirectoryName);
        if (!Directory.Exists(importsRoot))
        {
            return;
        }
        EnsureRegularDirectory(importsRoot, create: false, "bridge_import_root_unsafe");
        foreach (var directory in Directory.EnumerateDirectories(importsRoot))
        {
            EnsureRegularDirectory(directory, create: false, "bridge_import_root_unsafe");
            var operationId = Path.GetFileName(directory);
            if (!IsOperationId(operationId))
            {
                continue;
            }
            var statePath = Path.Combine(directory, StateFileName);
            if (!File.Exists(statePath))
            {
                continue;
            }
            var information = RequireRegularFile(statePath, "bridge_import_state_invalid");
            if (information.Length is <= 0 or > MaximumPersistedStateBytes)
            {
                throw new SeedHostException(
                    "bridge_import_state_invalid",
                    "Persisted bridge import state is outside its byte boundary.");
            }
            PersistedImportState state;
            try
            {
                state = JsonSerializer.Deserialize<PersistedImportState>(
                        File.ReadAllText(statePath, Encoding.UTF8),
                        StateJsonOptions)
                    ?? throw new JsonException("State was null.");
            }
            catch (JsonException error)
            {
                throw new SeedHostException(
                    "bridge_import_state_invalid",
                    "Persisted bridge import state did not match schema version 1.",
                    error);
            }
            ValidatePersistedState(directory, operationId, state);
            var context = new OperationContext(directory, state);
            if (IsActive(state.State))
            {
                state = state with
                {
                    State = SeedHostBridgeImportState.Resumable,
                    ErrorCode = "bridge_import_interrupted",
                    UpdatedUtc = DateTimeOffset.UtcNow
                };
                context.SetState(state);
                PersistState(context, state);
            }
            operations.Add(operationId, context);
        }
    }

    private void VerifyPersistedInputs(OperationContext context, ValidatedSubmission submission)
    {
        var state = context.ReadState();
        if (!CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(state.ManifestContentSha256),
                Convert.FromHexString(Sha256Hex(submission.ManifestBytes)))
            || state.RequestContentSha256.Count != submission.RequestBytes.Count)
        {
            throw new SeedHostException(
                "bridge_import_id_collision",
                "Deterministic import identity disagreed with its persisted input hashes.");
        }
        for (var index = 0; index < submission.RequestBytes.Count; index++)
        {
            if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(state.RequestContentSha256[index]),
                    Convert.FromHexString(Sha256Hex(submission.RequestBytes[index]))))
            {
                throw new SeedHostException(
                    "bridge_import_id_collision",
                    "Deterministic import identity disagreed with its persisted input hashes.");
            }
        }
        RequireRegularOwnedFile(context, state.ManifestFile);
        foreach (var requestFile in state.RequestFiles)
        {
            RequireRegularOwnedFile(context, requestFile);
        }
    }

    private static void ValidateManifestIdentity(
        PersistedImportState state,
        MiniModelManifestInspection manifest)
    {
        if (!string.Equals(state.ModelId, manifest.ModelId, StringComparison.Ordinal)
            || state.ArtifactByteCount != manifest.ArtifactByteCount
            || state.PieceCount != manifest.PieceCount
            || !string.Equals(state.ManifestSha256, manifest.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(state.ArtifactSha256, manifest.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(state.MerkleRootSha256, manifest.MerkleRootSha256, StringComparison.Ordinal))
        {
            throw new SeedHostException(
                "bridge_manifest_identity_changed",
                "The persisted manifest no longer has its admitted Rust identity.");
        }
    }

    private static void ValidatePreflightAgainstManifest(
        MiniModelManifestInspection manifest,
        PeerImportPreflight preflight)
    {
        if (!string.Equals(manifest.ManifestSha256, preflight.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(manifest.ArtifactSha256, preflight.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(manifest.MerkleRootSha256, preflight.MerkleRootSha256, StringComparison.Ordinal)
            || manifest.PieceCount != preflight.PieceCount
            || !preflight.CheckPeerStatusBeforePieceFetch
            || !preflight.PreflightFetchesPieceSetBeforePieces
            || !preflight.ValidateAdvertisedCompanionStateBeforePieceFetch
            || !preflight.ImportReceiptRequiredBeforeBrowserLoad)
        {
            throw new SeedHostException(
                "bridge_peer_preflight_invalid",
                "Rust peer preflight did not bind the complete selected manifest identity.");
        }
    }

    private static void ValidatePreflightAgreement(IReadOnlyList<PeerImportPreflight> values)
    {
        var expected = values[0];
        if (values.Skip(1).Any(value =>
            !string.Equals(value.ManifestSha256, expected.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(value.ArtifactSha256, expected.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(value.PieceSetSha256, expected.PieceSetSha256, StringComparison.Ordinal)
            || !string.Equals(value.MerkleRootSha256, expected.MerkleRootSha256, StringComparison.Ordinal)
            || value.PieceCount != expected.PieceCount))
        {
            throw new SeedHostException(
                "bridge_peer_identity_mismatch",
                "Selected peers disagree about the complete model content identity.");
        }
    }

    private static void ValidateImportReport(
        MiniModelManifestInspection manifest,
        PeerImportPreflight preflight,
        PeerImportExecution report)
    {
        if (!string.Equals(report.ManifestSha256, manifest.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(report.ArtifactSha256, manifest.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(report.PieceSetSha256, preflight.PieceSetSha256, StringComparison.Ordinal)
            || !string.Equals(report.MerkleRootSha256, manifest.MerkleRootSha256, StringComparison.Ordinal)
            || report.PieceCount != manifest.PieceCount
            || report.DownloadedPieceCount + report.ReusedPieceCount != report.PieceCount)
        {
            throw new SeedHostException(
                "bridge_import_identity_mismatch",
                "Rust import output disagreed with its preflight content identity.");
        }
    }

    private static void ValidateReceiptAgainstImport(
        MiniModelManifestInspection manifest,
        PeerImportPreflight preflight,
        PeerImportExecution report,
        PeerImportReceiptInspection receipt)
    {
        if (!string.Equals(receipt.ManifestSha256, manifest.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(receipt.ArtifactSha256, report.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(receipt.PieceSetSha256, preflight.PieceSetSha256, StringComparison.Ordinal)
            || !string.Equals(receipt.MerkleRootSha256, manifest.MerkleRootSha256, StringComparison.Ordinal)
            || receipt.PieceCount != manifest.PieceCount
            || !receipt.PeerPieceSetMetadataFetched
            || !receipt.PeerCompanionStateMetadataFetched
            || !receipt.PeerPieceBytesFetched
            || !receipt.ArtifactAssembledFromPeerPieces
            || receipt.ProjectServerServesModelBytes
            || receipt.ProjectServerRunsModelBytes
            || receipt.ProjectServerProxiesHuggingfaceBytes)
        {
            throw new SeedHostException(
                "bridge_import_receipt_mismatch",
                "Rust receipt inspection disagreed with the imported model identity or byte boundary.");
        }
    }

    private static void ValidateReceipt(
        PersistedImportState state,
        PeerImportReceiptInspection receipt)
    {
        if (!string.Equals(state.ModelId, receipt.ModelId, StringComparison.Ordinal)
            || !string.Equals(state.ManifestSha256, receipt.ManifestSha256, StringComparison.Ordinal)
            || !string.Equals(state.ArtifactSha256, receipt.ArtifactSha256, StringComparison.Ordinal)
            || !string.Equals(state.PieceSetSha256, receipt.PieceSetSha256, StringComparison.Ordinal)
            || !string.Equals(state.MerkleRootSha256, receipt.MerkleRootSha256, StringComparison.Ordinal)
            || state.PieceCount != receipt.PieceCount
            || !receipt.PeerPieceSetMetadataFetched
            || !receipt.PeerCompanionStateMetadataFetched
            || !receipt.PeerPieceBytesFetched
            || !receipt.ArtifactAssembledFromPeerPieces
            || receipt.ProjectServerServesModelBytes
            || receipt.ProjectServerRunsModelBytes
            || receipt.ProjectServerProxiesHuggingfaceBytes)
        {
            throw new SeedHostException(
                "bridge_model_revalidation_failed",
                "The local model receipt no longer matches its admitted import identity.");
        }
    }

    private ValidatedSubmission ValidateSubmission(SeedHostBridgeImportSubmission submission)
    {
        ArgumentNullException.ThrowIfNull(submission);
        if (submission.PeerImportRequests is null
            || submission.PeerImportRequests.Count is < 1 or > MaximumPeerCount)
        {
            throw new SeedHostValidationException(
                "bridge_peer_count_invalid",
                "A browser import requires one or two peer request documents.");
        }
        var manifestBytes = EncodeBounded(
            submission.ManifestText,
            nameof(submission.ManifestText),
            options.MaximumManifestBytes,
            "bridge_manifest_size_invalid");
        ValidateNoCredentialsInText(submission.ManifestText, isJson: LooksLikeJson(submission.ManifestText));
        var requestBytes = new List<byte[]>(submission.PeerImportRequests.Count);
        foreach (var request in submission.PeerImportRequests)
        {
            var bytes = EncodeBounded(
                request,
                nameof(submission.PeerImportRequests),
                options.MaximumPeerRequestBytes,
                "bridge_peer_request_size_invalid");
            ValidateNoCredentialsInText(request, isJson: true);
            requestBytes.Add(bytes);
        }
        return new ValidatedSubmission(manifestBytes, requestBytes);
    }

    private static void ValidateNoCredentialsInText(string text, bool isJson)
    {
        try
        {
            if (isJson)
            {
                using var document = JsonDocument.Parse(text, new JsonDocumentOptions
                {
                    AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow,
                    MaxDepth = 32
                });
                ValidateJsonValue(document.RootElement);
                return;
            }
            foreach (var line in text.Split('\n'))
            {
                var separator = line.IndexOfAny(['=', ':']);
                if (separator > 0 && IsSensitiveName(line[..separator]))
                {
                    throw CredentialError();
                }
                ValidateUriValue(separator >= 0 ? line[(separator + 1)..].Trim() : line.Trim());
            }
        }
        catch (JsonException)
        {
            throw new SeedHostValidationException(
                "bridge_peer_request_invalid",
                "Peer import requests must be strict bounded JSON.");
        }
    }

    private static void ValidateJsonValue(JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in value.EnumerateObject())
                {
                    if (IsSensitiveName(property.Name))
                    {
                        throw CredentialError();
                    }
                    ValidateJsonValue(property.Value);
                }
                break;
            case JsonValueKind.Array:
                foreach (var item in value.EnumerateArray())
                {
                    ValidateJsonValue(item);
                }
                break;
            case JsonValueKind.String:
                ValidateUriValue(value.GetString());
                break;
        }
    }

    private static void ValidateUriValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return;
        }
        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            throw CredentialError();
        }
        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var name = pair.Split('=', 2)[0];
            if (IsSensitiveName(Uri.UnescapeDataString(name)))
            {
                throw CredentialError();
            }
        }
    }

    private static bool IsSensitiveName(string value)
    {
        var normalized = new string(value.Trim().ToLowerInvariant()
            .Select(character => char.IsLetterOrDigit(character) ? character : '_')
            .ToArray()).Trim('_');
        return SensitiveNames.Contains(normalized, StringComparer.Ordinal);
    }

    private static SeedHostValidationException CredentialError() => new(
        "bridge_import_contains_credentials",
        "Bridge import metadata must not contain credentials, bearer tokens, or secret URL fields.");

    private static byte[] EncodeBounded(
        string value,
        string argumentName,
        int maximumBytes,
        string errorCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        if (value.Contains('\0'))
        {
            throw new SeedHostValidationException(errorCode, "Bridge import text contains an embedded NUL.");
        }
        var bytes = new UTF8Encoding(false, true).GetBytes(value);
        if (bytes.Length is <= 0 || bytes.Length > maximumBytes)
        {
            throw new SeedHostValidationException(
                errorCode,
                $"Bridge import text must contain 1 to {maximumBytes} UTF-8 bytes.");
        }
        return bytes;
    }

    private static string CreateOperationId(byte[] manifest, IReadOnlyList<byte[]> requests)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData("TinyRustLM bridge import v1\0"u8);
        AppendLengthPrefixed(hash, manifest);
        foreach (var request in requests)
        {
            AppendLengthPrefixed(hash, request);
        }
        return $"import-{Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant()}";
    }

    private static void AppendLengthPrefixed(IncrementalHash hash, byte[] value)
    {
        Span<byte> length = stackalloc byte[8];
        BinaryPrimitives.WriteInt64LittleEndian(length, value.LongLength);
        hash.AppendData(length);
        hash.AppendData(value);
    }

    private OperationContext GetContext(string operationId)
    {
        if (!IsOperationId(operationId))
        {
            throw new SeedHostValidationException(
                "bridge_import_id_invalid",
                "The bridge import operation ID is invalid.");
        }
        lock (operationsSync)
        {
            if (!operations.TryGetValue(operationId, out var context))
            {
                throw new SeedHostValidationException(
                    "bridge_import_not_found",
                    "The bridge import operation does not exist.");
            }
            return context;
        }
    }

    private PersistedImportState UpdateState(
        OperationContext context,
        Func<PersistedImportState, PersistedImportState> update)
    {
        lock (context.Sync)
        {
            var next = update(context.State);
            PersistState(context, next);
            context.State = next;
            return next;
        }
    }

    private static void PersistState(OperationContext context, PersistedImportState state)
    {
        var path = Path.Combine(context.RootDirectory, StateFileName);
        var temporary = path + $".tmp-{Guid.NewGuid():N}";
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(state, StateJsonOptions);
            if (bytes.Length > MaximumPersistedStateBytes)
            {
                throw new SeedHostException(
                    "bridge_import_state_too_large",
                    "Bridge import state exceeded its durable byte boundary.");
            }
            using (var stream = new FileStream(
                temporary,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                16 * 1024,
                FileOptions.WriteThrough))
            {
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(path))
            {
                File.Replace(temporary, path, null);
            }
            else
            {
                File.Move(temporary, path);
            }
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static void WriteDurableNewFile(string path, byte[] bytes)
    {
        using var stream = new FileStream(
            path,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            16 * 1024,
            FileOptions.WriteThrough);
        stream.Write(bytes);
        stream.Flush(flushToDisk: true);
    }

    private static void ValidatePersistedState(
        string root,
        string operationId,
        PersistedImportState state)
    {
        if (state.SchemaVersion != StateSchemaVersion
            || !string.Equals(state.OperationId, operationId, StringComparison.Ordinal)
            || state.RequestFiles.Count is < 1 or > MaximumPeerCount
            || state.RequestContentSha256.Count != state.RequestFiles.Count
            || !IsSha256Hex(state.ManifestContentSha256)
            || state.RequestContentSha256.Any(value => !IsSha256Hex(value))
            || TransferEvidenceIsInvalid(state)
            || state.CreatedUtc > state.UpdatedUtc)
        {
            throw new SeedHostException(
                "bridge_import_state_invalid",
                "Persisted bridge import state failed its structural contract.");
        }
        var context = new OperationContext(root, state);
        RequireRegularOwnedFile(context, state.ManifestFile);
        foreach (var request in state.RequestFiles)
        {
            RequireRegularOwnedFile(context, request);
        }
        if (state.State == SeedHostBridgeImportState.Available)
        {
            RequireRegularOwnedFile(context, state.ArtifactFile);
            RequireRegularOwnedFile(context, state.ReceiptFile);
            _ = RequireAvailablePieceDirectory(context, state);
            RequireRegularOwnedFile(context, state.WinningRequestFile);
            RequireRegularOwnedFile(context, state.WinningPreflightFile);
        }
    }

    private static string RequireRegularOwnedFile(OperationContext context, string? relativePath) =>
        RequireRegularOwnedAbsoluteFile(context, ResolveOwnedPath(context, relativePath));

    private static string RequireRegularOwnedAbsoluteFile(OperationContext context, string absolutePath)
    {
        var ownedPath = ResolveOwnedPath(context, ToOwnedRelativePath(context, absolutePath));
        RequireRegularFile(ownedPath, "bridge_import_file_invalid");
        return ownedPath;
    }

    private static string RequireRegularOwnedAbsoluteDirectory(
        OperationContext context,
        string absolutePath)
    {
        var ownedPath = ResolveOwnedPath(context, ToOwnedRelativePath(context, absolutePath));
        EnsureRegularDirectory(
            ownedPath,
            create: false,
            "bridge_import_piece_directory_invalid");
        return ownedPath;
    }

    private static string RequireAvailablePieceDirectory(
        OperationContext context,
        PersistedImportState state)
    {
        var relativePath = string.IsNullOrWhiteSpace(state.PieceDirectory)
            ? "data"
            : state.PieceDirectory;
        return RequireRegularOwnedAbsoluteDirectory(
            context,
            ResolveOwnedPath(context, relativePath));
    }

    private static void RequireDirectoryInsideImportOutput(
        string outputDirectory,
        string reportedPieceDirectory)
    {
        var root = Path.GetFullPath(outputDirectory).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        var candidate = Path.GetFullPath(reportedPieceDirectory).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        if (!string.Equals(root, candidate, PathComparison)
            && !candidate.StartsWith(root + Path.DirectorySeparatorChar, PathComparison))
        {
            throw new SeedHostException(
                "bridge_import_piece_path_mismatch",
                "Rust import output named a piece directory outside the owned import target.");
        }
    }

    private static FileInfo RequireRegularFile(string path, string errorCode)
    {
        var information = new FileInfo(path);
        if (!information.Exists
            || information.Length <= 0
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostException(
                errorCode,
                "Bridge import files must be nonempty regular non-link files.");
        }
        return information;
    }

    private static string ResolveOwnedPath(OperationContext context, string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)
            || Path.IsPathRooted(relativePath)
            || relativePath.Contains('\0'))
        {
            throw new SeedHostException(
                "bridge_import_path_invalid",
                "Persisted bridge paths must be nonempty relative paths.");
        }
        var root = Path.GetFullPath(context.RootDirectory).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var result = Path.GetFullPath(Path.Combine(root, relativePath));
        if (!result.StartsWith(root, PathComparison))
        {
            throw new SeedHostException(
                "bridge_import_path_escape",
                "A bridge import path escaped its owned operation directory.");
        }
        return result;
    }

    private static string ToOwnedRelativePath(OperationContext context, string path)
    {
        var absoluteRoot = Path.GetFullPath(context.RootDirectory).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var absolutePath = Path.GetFullPath(path);
        if (!absolutePath.StartsWith(absoluteRoot, PathComparison))
        {
            throw new SeedHostException(
                "bridge_import_path_escape",
                "A native import output escaped its owned operation directory.");
        }
        return Path.GetRelativePath(context.RootDirectory, absolutePath)
            .Replace(Path.DirectorySeparatorChar, '/');
    }

    private void EnsureOwnedRoot()
    {
        EnsureRegularDirectory(options.RootDirectory, create: true, "bridge_import_root_unsafe");
    }

    private static void EnsureRegularDirectory(string path, bool create, string errorCode)
    {
        if (create)
        {
            Directory.CreateDirectory(path);
        }
        var information = new DirectoryInfo(path);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                errorCode,
                "Bridge import storage must use regular non-link directories.");
        }
    }

    private static SeedHostBridgeOperationOptions ValidateOptions(
        SeedHostBridgeOperationOptions value)
    {
        ArgumentNullException.ThrowIfNull(value);
        ArgumentException.ThrowIfNullOrWhiteSpace(value.RootDirectory);
        if (value.RootDirectory.Contains('\0')
            || value.MaximumManifestBytes is < 1024 or > 16 * 1024 * 1024
            || value.MaximumPeerRequestBytes is < 512 or > 1024 * 1024
            || value.OperationTimeout is { } timeout &&
                (timeout < TimeSpan.FromSeconds(1) || timeout > TimeSpan.FromDays(1)))
        {
            throw new SeedHostValidationException(
                "bridge_operation_options_invalid",
                "Bridge operation paths or resource limits are outside supported bounds.");
        }
        return value with
        {
            RootDirectory = Path.GetFullPath(value.RootDirectory),
            SharingRootDirectory = value.SharingRootDirectory is null
                ? null
                : Path.GetFullPath(value.SharingRootDirectory)
        };
    }

    private static SeedHostBridgeImportStatus ToStatus(PersistedImportState state) => new(
        state.OperationId,
        state.State,
        state.ModelId,
        state.ArtifactByteCount,
        state.State == SeedHostBridgeImportState.Available ? state.PieceCount : 0,
        state.DownloadedPieceCount ?? 0,
        state.ReusedPieceCount ?? 0,
        state.RefetchedCorruptPieceCount ?? 0,
        state.NetworkRetryCount ?? 0,
        state.WasResumed ?? false,
        state.State == SeedHostBridgeImportState.Available ? state.ArtifactSha256 : null,
        state.State == SeedHostBridgeImportState.Resumable,
        state.ErrorCode,
        state.CreatedUtc,
        state.UpdatedUtc);

    private static bool TransferEvidenceIsInvalid(PersistedImportState state)
    {
        var values = new int?[]
        {
            state.DownloadedPieceCount,
            state.ReusedPieceCount,
            state.RefetchedCorruptPieceCount,
            state.NetworkRetryCount
        };
        var hasAny = values.Any(value => value.HasValue) || state.WasResumed.HasValue;
        if (!hasAny)
        {
            return false;
        }
        if (values.Any(value => !value.HasValue || value.Value < 0) || !state.WasResumed.HasValue)
        {
            return true;
        }
        return state.State == SeedHostBridgeImportState.Available
            && state.DownloadedPieceCount!.Value + state.ReusedPieceCount!.Value != state.PieceCount;
    }

    private static string ErrorCode(Exception? error, string fallback) =>
        error is SeedHostException seedHostError ? seedHostError.Code : fallback;

    private static string RequiredPersisted(string? value, string label) =>
        !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new SeedHostException(
                "bridge_import_state_invalid",
                $"Available model state omitted its {label}.");

    private static bool LooksLikeJson(string value) =>
        value.AsSpan().TrimStart().StartsWith("{".AsSpan(), StringComparison.Ordinal);

    private static bool IsOperationId(string? value) =>
        value is { Length: 71 }
        && value.StartsWith("import-", StringComparison.Ordinal)
        && value.AsSpan(7).IndexOfAnyExcept("0123456789abcdef") < 0;

    private static bool IsSha256Hex(string? value) =>
        value is { Length: 64 }
        && value.AsSpan().IndexOfAnyExcept("0123456789abcdefABCDEF") < 0;

    private static bool IsActive(SeedHostBridgeImportState state) =>
        state is SeedHostBridgeImportState.Queued
            or SeedHostBridgeImportState.Preflighting
            or SeedHostBridgeImportState.Importing
            or SeedHostBridgeImportState.Validating;

    private static string Sha256Hex(byte[] value) =>
        Convert.ToHexString(SHA256.HashData(value)).ToLowerInvariant();

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private static JsonSerializerOptions CreateStateJsonOptions()
    {
        var value = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = true
        };
        value.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
        return value;
    }

    private void ThrowIfDisposed() => ObjectDisposedException.ThrowIf(disposed, this);

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        Task[] runners;
        lock (operationsSync)
        {
            if (disposed)
            {
                return;
            }
            disposed = true;
            foreach (var context in operations.Values)
            {
                lock (context.Sync)
                {
                    context.Cancellation?.Cancel();
                }
            }
            runners = operations.Values
                .Select(value => value.Runner)
                .Where(value => value is not null)
                .Cast<Task>()
                .ToArray();
        }
        await Task.WhenAll(runners).ConfigureAwait(false);
        foreach (var context in operations.Values)
        {
            context.Cancellation?.Dispose();
        }
        await sharingLock.WaitAsync().ConfigureAwait(false);
        try
        {
            if (sharingStore is not null)
            {
                await sharingStore.DisposeAsync().ConfigureAwait(false);
            }
        }
        finally
        {
            sharingLock.Release();
            sharingLock.Dispose();
        }
    }

    private sealed record ValidatedSubmission(
        byte[] ManifestBytes,
        IReadOnlyList<byte[]> RequestBytes);

    private sealed class OperationContext(
        string rootDirectory,
        PersistedImportState state)
    {
        internal object Sync { get; } = new();
        internal string RootDirectory { get; } = rootDirectory;
        internal PersistedImportState State { get; set; } = state;
        internal CancellationTokenSource? Cancellation { get; set; }
        internal Task? Runner { get; set; }

        internal PersistedImportState ReadState()
        {
            lock (Sync)
            {
                return State;
            }
        }

        internal void SetState(PersistedImportState value)
        {
            lock (Sync)
            {
                State = value;
            }
        }
    }

    private sealed record PersistedImportState(
        int SchemaVersion,
        string OperationId,
        SeedHostBridgeImportState State,
        string ManifestFile,
        IReadOnlyList<string> RequestFiles,
        string ManifestContentSha256,
        IReadOnlyList<string> RequestContentSha256,
        string? ModelId,
        long ArtifactByteCount,
        string? ManifestSha256,
        string? ArtifactSha256,
        string? MerkleRootSha256,
        string? PieceSetSha256,
        int PieceCount,
        int? DownloadedPieceCount,
        int? ReusedPieceCount,
        int? RefetchedCorruptPieceCount,
        int? NetworkRetryCount,
        bool? WasResumed,
        string? ArtifactFile,
        string? ReceiptFile,
        string? PieceDirectory,
        string? WinningRequestFile,
        string? WinningPreflightFile,
        string? ErrorCode,
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc);
}
