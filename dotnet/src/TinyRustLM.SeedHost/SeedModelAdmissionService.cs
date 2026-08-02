using System.Text;

namespace TinyRustLM.SeedHost;

/// <summary>One externally configured endpoint for a model's lane replica.</summary>
public sealed record SeedLaneAdmissionEndpoint(
    string LaneId,
    string BindAddress,
    string PublicBaseUrl);

/// <summary>Inputs for preparing and atomically admitting one `.slm` artifact.</summary>
public sealed record SeedModelAdmissionOptions(
    string ModelId,
    string ArtifactPath,
    IReadOnlyList<SeedLaneAdmissionEndpoint> LaneEndpoints,
    string? SourceHuggingFaceModelId = null,
    PeerShareProvenance? Provenance = null,
    bool Enabled = true);

/// <summary>Rust-verified paths and fleet status after successful admission.</summary>
public sealed record SeedModelAdmissionResult(
    string ModelId,
    string ShareDirectory,
    string ManifestPath,
    string PieceDirectory,
    string ArtifactSha256,
    int PieceCount,
    string LocalRoundTripReceiptPath,
    string LocalRoundTripReceiptSha256,
    SeedFleetInspection Fleet);

/// <summary>
/// Prepares one shared piece store, writes one Rust-authoritative state per lane, and commits the
/// fleet reference only after every local artifact and state check succeeds.
/// </summary>
public sealed class SeedModelAdmissionService
{
    private readonly SeedFleetStore store;
    private readonly IMiniModelAuthority authority;
    private readonly SemaphoreSlim admissionLock = new(1, 1);

    /// <summary>Create an admission service over one owned fleet store.</summary>
    public SeedModelAdmissionService(SeedFleetStore store, IMiniModelAuthority authority)
    {
        ArgumentNullException.ThrowIfNull(store);
        ArgumentNullException.ThrowIfNull(authority);
        this.store = store;
        this.authority = authority;
    }

    /// <summary>Prepare, verify, and admit one model without duplicating pieces per lane.</summary>
    public async Task<SeedModelAdmissionResult> AdmitAsync(
        SeedModelAdmissionOptions options,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(options);
        ValidateOptions(options);
        await admissionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var configuration = await store.ReadConfigurationAsync(cancellationToken)
                .ConfigureAwait(false);
            if (configuration.Models.Any(model =>
                string.Equals(model.ModelId, options.ModelId, StringComparison.Ordinal)))
            {
                throw new SeedHostValidationException(
                    "duplicate_model_id",
                    $"Fleet already contains model ID '{options.ModelId}'.");
            }
            var endpointMap = BuildEndpointMap(configuration, options);
            var artifactPath = RequireRegularArtifact(options.ArtifactPath);
            var stagingDirectory = Path.Combine(
                store.RootDirectory,
                $".admission-{Guid.NewGuid():N}");
            Directory.CreateDirectory(stagingDirectory);
            string? committedDirectory = null;
            var committed = false;
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                var preparation = authority.PreparePeerShare(
                    artifactPath,
                    stagingDirectory,
                    options.ModelId,
                    options.SourceHuggingFaceModelId,
                    provenance: options.Provenance);
                cancellationToken.ThrowIfCancellationRequested();
                var stagedManifest = RequireDescendant(
                    stagingDirectory,
                    preparation.ManifestPath,
                    requireDirectory: false);
                var stagedPieces = RequireDescendant(
                    stagingDirectory,
                    preparation.PieceDirPath,
                    requireDirectory: true);
                var stateDirectory = Path.Combine(stagingDirectory, "lane-state");
                Directory.CreateDirectory(stateDirectory);
                var stateRelativePaths = new Dictionary<string, string>(StringComparer.Ordinal);
                foreach (var lane in configuration.Lanes)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var statePath = Path.Combine(stateDirectory, $"{lane.LaneId}.state.json");
                    var endpoint = endpointMap[lane.LaneId];
                    var written = authority.WritePeerCompanionState(
                        stagedManifest,
                        stagedPieces,
                        statePath,
                        endpoint.PublicBaseUrl);
                    if (!string.Equals(written.ModelId, options.ModelId, StringComparison.Ordinal)
                        || !string.Equals(
                            written.ArtifactSha256,
                            preparation.ArtifactSha256,
                            StringComparison.Ordinal))
                    {
                        throw new SeedHostException(
                            "companion_state_identity_mismatch",
                            "Rust-written companion state did not match the prepared model identity.");
                    }
                    _ = authority.InspectPeerCompanionState(
                        statePath,
                        stagedManifest,
                        stagedPieces);
                    stateRelativePaths.Add(
                        lane.LaneId,
                        Path.GetRelativePath(stagingDirectory, statePath));
                }

                cancellationToken.ThrowIfCancellationRequested();
                var stagedRoundTripReceipt = Path.Combine(
                    stagingDirectory,
                    "local-peer-round-trip.v0");
                var roundTrip = authority.VerifyLocalPeerRoundTrip(
                    stagedManifest,
                    artifactPath,
                    stagedPieces,
                    Path.Combine(stagingDirectory, ".local-peer-round-trip-work"),
                    stagedRoundTripReceipt);
                ValidateRoundTrip(preparation, roundTrip);
                stagedRoundTripReceipt = RequireDescendant(
                    stagingDirectory,
                    roundTrip.ReceiptPath,
                    requireDirectory: false);

                var shareRoot = Path.Combine(store.RootDirectory, "shares");
                Directory.CreateDirectory(shareRoot);
                EnsureNonLinkDirectory(shareRoot, "unsafe_share_root");
                var directoryName = ModelDirectoryName(
                    options.ModelId,
                    preparation.ArtifactSha256);
                committedDirectory = Path.Combine(shareRoot, directoryName);
                if (File.Exists(committedDirectory) || Directory.Exists(committedDirectory))
                {
                    throw new SeedHostValidationException(
                        "share_directory_exists",
                        "A share directory already exists for this model and artifact identity.");
                }
                Directory.Move(stagingDirectory, committedDirectory);
                var finalManifest = Path.Combine(
                    committedDirectory,
                    Path.GetRelativePath(stagingDirectory, stagedManifest));
                var finalPieces = Path.Combine(
                    committedDirectory,
                    Path.GetRelativePath(stagingDirectory, stagedPieces));
                var finalRoundTripReceipt = Path.Combine(
                    committedDirectory,
                    Path.GetRelativePath(stagingDirectory, stagedRoundTripReceipt));
                _ = authority.InspectPeerPieceDirectory(finalManifest, finalPieces);

                var model = new SeedFleetModel(
                    options.ModelId,
                    options.Enabled,
                    OwnedRelative(finalManifest),
                    OwnedRelative(finalPieces),
                    preparation.ArtifactSha256);
                var assignments = configuration.Lanes.Select(lane =>
                {
                    var endpoint = endpointMap[lane.LaneId];
                    var statePath = Path.Combine(
                        committedDirectory,
                        stateRelativePaths[lane.LaneId]);
                    _ = authority.InspectPeerCompanionState(
                        statePath,
                        finalManifest,
                        finalPieces);
                    return new SeedLaneEndpointAssignment(
                        lane.LaneId,
                        new SeedFleetEndpoint(
                            options.ModelId,
                            OwnedRelative(statePath),
                            endpoint.BindAddress,
                            endpoint.PublicBaseUrl));
                }).ToArray();
                cancellationToken.ThrowIfCancellationRequested();
                var fleet = await store.AddModelAsync(model, assignments, cancellationToken)
                    .ConfigureAwait(false);
                committed = true;
                return new SeedModelAdmissionResult(
                    options.ModelId,
                    committedDirectory,
                    finalManifest,
                    finalPieces,
                    preparation.ArtifactSha256,
                    preparation.PieceCount,
                    finalRoundTripReceipt,
                    roundTrip.ReceiptSha256,
                    fleet);
            }
            finally
            {
                if (!committed)
                {
                    DeleteOwnedAdmissionDirectory(stagingDirectory);
                    if (committedDirectory is not null)
                    {
                        DeleteOwnedAdmissionDirectory(committedDirectory);
                    }
                }
            }
        }
        finally
        {
            admissionLock.Release();
        }
    }

    private Dictionary<string, SeedLaneAdmissionEndpoint> BuildEndpointMap(
        SeedFleetConfiguration configuration,
        SeedModelAdmissionOptions options)
    {
        var endpoints = new Dictionary<string, SeedLaneAdmissionEndpoint>(StringComparer.Ordinal);
        foreach (var endpoint in options.LaneEndpoints)
        {
            if (endpoint is null
                || string.IsNullOrWhiteSpace(endpoint.LaneId)
                || !endpoints.TryAdd(endpoint.LaneId, endpoint))
            {
                throw new SeedHostValidationException(
                    "lane_assignment_mismatch",
                    "Admission requires one unique endpoint for each configured lane.");
            }
        }
        if (endpoints.Count != configuration.Lanes.Count
            || !configuration.Lanes.All(lane => endpoints.ContainsKey(lane.LaneId)))
        {
            throw new SeedHostValidationException(
                "lane_assignment_mismatch",
                "Admission requires one endpoint for each configured lane.");
        }

        var placeholderModel = new SeedFleetModel(
            options.ModelId,
            options.Enabled,
            "pending/model.manifest.v0",
            "pending/model.peer-pieces");
        var candidateModels = configuration.Models.Append(placeholderModel);
        var candidateLanes = configuration.Lanes.Select(lane => lane with
        {
            Endpoints = lane.Endpoints.Append(new SeedFleetEndpoint(
                options.ModelId,
                $"pending/{lane.LaneId}.state.json",
                endpoints[lane.LaneId].BindAddress,
                endpoints[lane.LaneId].PublicBaseUrl)).ToArray()
        });
        _ = SeedFleetConfiguration.Create(
            configuration.FleetId,
            candidateModels,
            candidateLanes);
        return endpoints;
    }

    private static void ValidateOptions(SeedModelAdmissionOptions options)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(options.ModelId);
        ArgumentException.ThrowIfNullOrWhiteSpace(options.ArtifactPath);
        ArgumentNullException.ThrowIfNull(options.LaneEndpoints);
        if (options.SourceHuggingFaceModelId?.Contains('\0') == true)
        {
            throw new SeedHostValidationException(
                "invalid_source_model_id",
                "Source model ID cannot contain an embedded NUL character.");
        }
        if (options.SourceHuggingFaceModelId is not null && options.Provenance is null)
        {
            throw new SeedHostValidationException(
                "missing_trained_provenance",
                "A trained Hugging Face source requires checksum-bound provenance evidence.");
        }
        if (options.Provenance is not null && options.SourceHuggingFaceModelId is null)
        {
            throw new SeedHostValidationException(
                "orphan_trained_provenance",
                "Trained provenance requires a Hugging Face source model identity.");
        }
    }

    private static void ValidateRoundTrip(
        PeerSharePreparation preparation,
        LocalPeerRoundTripVerification roundTrip)
    {
        if (!string.Equals(roundTrip.ModelId, preparation.ModelId, StringComparison.Ordinal)
            || !string.Equals(
                roundTrip.ArtifactSha256,
                preparation.ArtifactSha256,
                StringComparison.Ordinal)
            || roundTrip.PieceCount != preparation.PieceCount
            || !roundTrip.PeerStatusChecked
            || !roundTrip.PeerPieceSetChecked
            || !roundTrip.PeerCompanionStateChecked
            || !roundTrip.FinalReceiptChecked
            || roundTrip.ProjectServerServesModelBytes
            || roundTrip.ProjectServerRunsModelBytes
            || roundTrip.ProjectServerProxiesModelBytes)
        {
            throw new SeedHostException(
                "local_round_trip_identity_mismatch",
                "Rust local peer round-trip evidence did not match the prepared share boundary.");
        }
    }

    private static string RequireRegularArtifact(string path)
    {
        if (path.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "invalid_artifact_path",
                "Artifact path cannot contain an embedded NUL character.");
        }
        var absolute = Path.GetFullPath(path);
        var information = new FileInfo(absolute);
        if (!information.Exists
            || information.Length <= 0
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "invalid_artifact_path",
                "Artifact must be a nonempty regular non-link file.");
        }
        return absolute;
    }

    private static string RequireDescendant(
        string root,
        string path,
        bool requireDirectory)
    {
        var absoluteRoot = Path.GetFullPath(root) + Path.DirectorySeparatorChar;
        var absolute = Path.GetFullPath(path);
        if (!absolute.StartsWith(absoluteRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new SeedHostException(
                "native_output_escaped_staging",
                "MiniModel output path escaped the owned admission staging directory.");
        }
        if (requireDirectory)
        {
            EnsureNonLinkDirectory(absolute, "invalid_native_output_directory");
        }
        else
        {
            var information = new FileInfo(absolute);
            if (!information.Exists
                || (information.Attributes & FileAttributes.ReparsePoint) != 0
                || information.LinkTarget is not null)
            {
                throw new SeedHostException(
                    "invalid_native_output_file",
                    "MiniModel did not produce a regular non-link output file.");
            }
        }
        return absolute;
    }

    private static void EnsureNonLinkDirectory(string path, string errorCode)
    {
        var information = new DirectoryInfo(path);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                errorCode,
                "Owned seed-host directory must be a regular non-link directory.");
        }
    }

    private string OwnedRelative(string path)
    {
        var root = Path.GetFullPath(store.RootDirectory) + Path.DirectorySeparatorChar;
        var absolute = Path.GetFullPath(path);
        if (!absolute.StartsWith(root, StringComparison.OrdinalIgnoreCase))
        {
            throw new SeedHostException(
                "owned_path_escape",
                "Prepared model output escaped the owned fleet root.");
        }
        return Path.GetRelativePath(store.RootDirectory, absolute).Replace('\\', '/');
    }

    private static string ModelDirectoryName(string modelId, string artifactSha256)
    {
        var builder = new StringBuilder();
        foreach (var character in modelId.ToLowerInvariant())
        {
            if (character is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                builder.Append(character);
            }
            else if (builder.Length > 0 && builder[^1] != '-')
            {
                builder.Append('-');
            }
            if (builder.Length == 48)
            {
                break;
            }
        }
        var slug = builder.ToString().Trim('-');
        if (slug.Length == 0)
        {
            slug = "model";
        }
        var hash = artifactSha256.StartsWith("sha256:", StringComparison.Ordinal)
            ? artifactSha256[7..]
            : artifactSha256;
        if (hash.Length < 12)
        {
            throw new SeedHostException(
                "invalid_artifact_identity",
                "Prepared artifact SHA-256 was not a complete digest.");
        }
        return $"{slug}-{hash[..12]}";
    }

    private static void DeleteOwnedAdmissionDirectory(string path)
    {
        if (!Directory.Exists(path))
        {
            return;
        }
        var information = new DirectoryInfo(path);
        if ((information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "unsafe_admission_cleanup",
                "Refusing to clean a linked admission directory.");
        }
        Directory.Delete(path, recursive: true);
    }
}
