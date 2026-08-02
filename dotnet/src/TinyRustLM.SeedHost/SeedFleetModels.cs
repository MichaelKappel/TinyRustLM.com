using System.Text.Json.Serialization;

namespace TinyRustLM.SeedHost;

/// <summary>One admitted MiniModel artifact and its shared read-only piece store.</summary>
public sealed record SeedFleetModel(
    [property: JsonPropertyName("model_id")] string ModelId,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("manifest_path")] string ManifestPath,
    [property: JsonPropertyName("piece_dir")] string PieceDirectory,
    [property: JsonIgnore] string? ArtifactSha256 = null);

/// <summary>One model endpoint owned by one independently restartable lane.</summary>
public sealed record SeedFleetEndpoint(
    [property: JsonPropertyName("model_id")] string ModelId,
    [property: JsonPropertyName("state_path")] string StatePath,
    [property: JsonPropertyName("bind_addr")] string BindAddress,
    [property: JsonPropertyName("public_base_url")] string PublicBaseUrl);

/// <summary>A stable lane and its one endpoint per admitted model.</summary>
public sealed record SeedFleetLane(
    [property: JsonPropertyName("lane_id")] string LaneId,
    [property: JsonPropertyName("endpoints")] IReadOnlyList<SeedFleetEndpoint> Endpoints);

/// <summary>Fail-closed model-byte and announcement boundaries embedded in every fleet.</summary>
public sealed record SeedFleetBoundary(
    [property: JsonPropertyName("operator_consent")] bool OperatorConsent,
    [property: JsonPropertyName("advertise_only_after_external_probe")] bool AdvertiseOnlyAfterExternalProbe,
    [property: JsonPropertyName("project_server_serves_model_bytes")] bool ProjectServerServesModelBytes,
    [property: JsonPropertyName("project_server_runs_model_bytes")] bool ProjectServerRunsModelBytes,
    [property: JsonPropertyName("project_server_proxies_model_bytes")] bool ProjectServerProxiesModelBytes)
{
    /// <summary>The only boundary accepted by fleet schema v0.</summary>
    public static SeedFleetBoundary Required { get; } = new(
        OperatorConsent: true,
        AdvertiseOnlyAfterExternalProbe: true,
        ProjectServerServesModelBytes: false,
        ProjectServerRunsModelBytes: false,
        ProjectServerProxiesModelBytes: false);
}

/// <summary>Rust-validated fleet status returned through the MiniModel native ABI.</summary>
public sealed record SeedFleetInspection(
    string ConfigPath,
    string FleetId,
    int TargetModelCount,
    int AdmittedModelCount,
    int ActiveModelCount,
    int RemainingModelCapacity,
    int ReplicaLaneCount,
    int PeerEndpointCount,
    IReadOnlyList<string> LaneIds,
    IReadOnlyList<string> ModelIds,
    IReadOnlyList<string> ActiveModelIds,
    string AdvertisementStatus);

/// <summary>Rust-verified, short-lived outside-network reachability evidence.</summary>
public sealed record ExternalProbeReceiptInspection(
    string ReceiptPath,
    string ReceiptSha256,
    string ReceiptId,
    string ObserverId,
    string ObserverKeyId,
    string ObserverPublicKeySha256,
    string FleetId,
    string LaneId,
    string ModelId,
    string PublicBaseUrl,
    string ArtifactSha256,
    string PieceSetSha256,
    string CheckedUtc,
    string ExpiresUtc,
    int CheckedRouteCount,
    string ProbeImplementationVersion,
    string NetworkScope,
    string SignaturePayloadSha256,
    bool ExternallyReachable,
    bool AnnouncementEligible,
    bool ProjectServerServesModelBytes,
    bool ProjectServerRunsModelBytes,
    bool ProjectServerProxiesModelBytes);

/// <summary>Rust-prepared v1 announcement and one-use external-receipt reservation.</summary>
public sealed record SeedPeerSourceAnnouncementPreparation(
    string AnnouncementPath,
    string AnnouncementSha256,
    string ReplayRecordPath,
    string FleetId,
    string LaneId,
    string ModelId,
    string ArtifactSha256,
    string PieceSetSha256,
    string PeerBaseUrl,
    string ExternalProbeReceiptId,
    string ExternalProbeReceiptSha256,
    string ExternalProbeExpiresUtc,
    bool ExternallyReachable,
    bool AnnouncementEligible,
    bool Advertised,
    bool ProjectServerServesModelBytes,
    bool ProjectServerRunsModelBytes,
    bool ProjectServerProxiesModelBytes);

/// <summary>Rust-validated MiniModel manifest identity and piece contract.</summary>
public sealed record MiniModelManifestInspection(
    string ManifestPath,
    string ManifestSha256,
    string ModelId,
    long ArtifactByteCount,
    string ArtifactSha256,
    int PieceSize,
    int PieceCount,
    string MerkleRootSha256,
    string SourceKind,
    string SourceId,
    string SourceRevision,
    string? SourceLicenseId,
    string? SourceLicenseRoute,
    string? SourceLicenseSha256,
    string? ModificationNoticeRoute,
    string? ModificationNoticeSha256,
    string? QualityTier,
    string? QualityClaim,
    string? TrainedQualityClaim,
    string? KnownLimitation,
    string? RequiredNextGate,
    string? ConversationEvidenceRoute,
    string? ConversationEvidenceSha256,
    string? EvaluationEvidenceRoute,
    string? EvaluationEvidenceSha256,
    string EvidenceStatus,
    string SignatureKind);

/// <summary>Rust-validated local peer piece-set identity.</summary>
public sealed record PeerPieceInspection(
    string PieceSetPath,
    string PieceSetSha256,
    string ModelId,
    long ArtifactByteCount,
    int PieceCount,
    string ManifestSha256,
    string ArtifactSha256,
    string MerkleRootSha256);

/// <summary>Rust-validated peer companion state and serve routes.</summary>
public sealed record PeerCompanionInspection(
    string StatePath,
    string StateRoute,
    string PieceSetPath,
    string PieceSetSha256,
    string ModelId,
    string PeerBaseUrl,
    long ArtifactByteCount,
    int PieceCount,
    string ManifestSha256,
    string ArtifactSha256,
    string MerkleRootSha256);

/// <summary>Rust-written companion state identity before lane admission.</summary>
public sealed record PeerCompanionStateWrite(
    string StatePath,
    string ModelId,
    string PeerBaseUrl,
    int PieceCount,
    string ManifestSha256,
    string ArtifactSha256,
    string MerkleRootSha256);

/// <summary>Rust-generated local share-kit paths and immutable content identity.</summary>
public sealed record PeerSharePreparation(
    string ManifestPath,
    string PeerOfferPath,
    string PieceDirPath,
    string CatalogEntryPath,
    string ModelId,
    string ArtifactSha256,
    int PieceCount,
    int PeerSourceCount);

/// <summary>Rust-verified evidence from a real loopback peer serve/import round trip.</summary>
public sealed record LocalPeerRoundTripVerification(
    string ReceiptPath,
    string ReceiptSha256,
    string ModelId,
    string ManifestSha256,
    long ArtifactByteCount,
    string ArtifactSha256,
    string PieceSetSha256,
    int PieceCount,
    string MerkleRootSha256,
    string ImportReceiptSha256,
    bool PeerStatusChecked,
    bool PeerPieceSetChecked,
    bool PeerCompanionStateChecked,
    bool FinalReceiptChecked,
    bool ProjectServerServesModelBytes,
    bool ProjectServerRunsModelBytes,
    bool ProjectServerProxiesModelBytes);

/// <summary>Reviewed quality boundary for a checksum-bound trained-model share.</summary>
public enum PeerShareQualityTier
{
    /// <summary>Conversation evidence passed while full assistant quality remains pending.</summary>
    ConversationProvenFullAssistantPending
}

/// <summary>Exact source, license, notice, and quality evidence required for a trained share.</summary>
public sealed record PeerShareProvenance(
    string SourceRevision,
    string SourceLicenseId,
    string SourceLicensePath,
    string SourceLicenseSha256,
    string ModificationNoticePath,
    string ModificationNoticeSha256,
    string ConversationEvidencePath,
    string ConversationEvidenceSha256,
    string EvaluationEvidencePath,
    string EvaluationEvidenceSha256,
    PeerShareQualityTier QualityTier,
    string KnownLimitation);

/// <summary>Validated TinyRustLM `.slm` structure returned by MiniModel Rust.</summary>
public sealed record MiniModelSlmInspection(
    int FileBytes,
    int FormatVersion,
    string ModelShape,
    string Quantization,
    string Checksum,
    string TokenizerChecksum,
    string TensorLayoutChecksum);

/// <summary>Manifest-bound `.slm` verification report returned by MiniModel Rust.</summary>
public sealed record MiniModelArtifactVerification(
    string ManifestSha256,
    string ManifestModelId,
    long ArtifactByteCount,
    string ArtifactSha256,
    string EvidenceStatus,
    MiniModelSlmInspection Slm);

/// <summary>Metadata-only local peer-health result written by MiniModel Rust.</summary>
public sealed record PeerStatusCheck(
    string ReportPath,
    string PeerBaseUrl,
    string StatusUrl,
    string CompanionStateRoute,
    string ModelId,
    long ArtifactByteCount,
    int PieceCount,
    string PieceSetSha256,
    string ManifestSha256,
    string ArtifactSha256,
    string MerkleRootSha256);

/// <summary>Rust-written metadata preflight that fetches no peer piece bytes.</summary>
public sealed record PeerImportPreflight(
    string RequestPath,
    string PreflightPath,
    string PeerBaseUrl,
    string PieceSetUrl,
    string PieceSetSha256,
    string CompanionStateUrl,
    string CompanionStateStatus,
    string MetadataRoutesStatus,
    string PeerStatusRoute,
    string PeerPieceSetRoute,
    string PeerCompanionStateRoute,
    string ReceiverValidationContractStatus,
    bool CheckPeerStatusBeforePieceFetch,
    bool PreflightFetchesPieceSetBeforePieces,
    bool ValidateAdvertisedCompanionStateBeforePieceFetch,
    bool ImportReceiptRequiredBeforeBrowserLoad,
    int PieceCount,
    string ManifestSha256,
    string ArtifactSha256,
    string MerkleRootSha256);

/// <summary>Completed peer import paths and verified content identity.</summary>
public sealed record PeerImportExecution(
    string RequestPath,
    string StatusCheckPath,
    string PreflightPath,
    string PeerBaseUrl,
    string CompanionStateUrl,
    string CompanionStateStatus,
    string PieceDirPath,
    string PieceSetSha256,
    string OutputArtifactPath,
    string ReceiptPath,
    string ResumeStatePath,
    int PieceCount,
    int DownloadedPieceCount,
    int ReusedPieceCount,
    int RefetchedCorruptPieceCount,
    int NetworkRetryCount,
    int TransferConcurrency,
    bool Resumed,
    string ManifestSha256,
    string ArtifactSha256,
    string MerkleRootSha256);

/// <summary>Rust-validated chain from request and preflight through final import receipt.</summary>
public sealed record PeerImportReceiptInspection(
    string ReceiptPath,
    string ReceiptSha256,
    string RequestPath,
    string RequestSha256,
    string PreflightPath,
    string PreflightSha256,
    string ManifestSha256,
    string ModelId,
    string ArtifactPath,
    string ArtifactSha256,
    string ReceiverValidationContractStatus,
    bool CheckPeerStatusBeforePieceFetch,
    bool PreflightFetchesPieceSetBeforePieces,
    bool ValidateAdvertisedCompanionStateBeforePieceFetch,
    bool ImportReceiptRequiredBeforeBrowserLoad,
    string PeerBaseUrl,
    string CompanionStateUrl,
    string CompanionStateStatus,
    string PieceSetSha256,
    int PieceCount,
    string MerkleRootSha256,
    bool PeerPieceSetMetadataFetched,
    bool PeerCompanionStateMetadataFetched,
    bool PeerPieceBytesFetched,
    bool ArtifactAssembledFromPeerPieces,
    bool ProjectServerServesModelBytes,
    bool ProjectServerRunsModelBytes,
    bool ProjectServerProxiesHuggingfaceBytes);
