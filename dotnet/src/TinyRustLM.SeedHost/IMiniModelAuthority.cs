namespace TinyRustLM.SeedHost;

/// <summary>Typed managed access to the authoritative MiniModel Rust validation ABI.</summary>
public interface IMiniModelAuthority
{
    /// <summary>Native MiniModel ABI version loaded by this process.</summary>
    uint NativeAbiVersion { get; }

    /// <summary>Validate and inspect a MiniModel manifest.</summary>
    MiniModelManifestInspection InspectManifest(string manifestPath);

    /// <summary>Validate a `.slm` artifact against its MiniModel manifest.</summary>
    MiniModelArtifactVerification VerifyArtifact(string manifestPath, string artifactPath);

    /// <summary>Validate every declared piece and the piece-set Merkle identity.</summary>
    PeerPieceInspection InspectPeerPieceDirectory(string manifestPath, string pieceDirectory);

    /// <summary>Validate companion state against the manifest and piece store.</summary>
    PeerCompanionInspection InspectPeerCompanionState(
        string statePath,
        string manifestPath,
        string pieceDirectory);

    /// <summary>Write companion state through the authoritative Rust implementation.</summary>
    PeerCompanionStateWrite WritePeerCompanionState(
        string manifestPath,
        string pieceDirectory,
        string outputPath,
        string knownPeerBaseUrl);

    /// <summary>Validate a complete two-lane seed-fleet configuration.</summary>
    SeedFleetInspection InspectSeedFleet(string configPath);

    /// <summary>Validate a signed outside-network receipt against one exact fleet endpoint.</summary>
    ExternalProbeReceiptInspection InspectExternalProbeReceipt(
        string receiptPath,
        string trustPath,
        string configPath);

    /// <summary>Prepare a version-1 announcement after consuming verified proof exactly once.</summary>
    SeedPeerSourceAnnouncementPreparation PrepareSeedAnnouncement(
        string catalogEntryPath,
        string outputPath,
        string receiptPath,
        string trustPath,
        string configPath);

    /// <summary>Prepare a verified local peer share without publishing model bytes.</summary>
    PeerSharePreparation PreparePeerShare(
        string artifactPath,
        string outputDirectory,
        string modelId,
        string? sourceHuggingFaceModelId = null,
        string? knownPeerBaseUrl = null,
        PeerShareProvenance? provenance = null);

    /// <summary>Serve and re-import a prepared share over loopback before fleet admission.</summary>
    LocalPeerRoundTripVerification VerifyLocalPeerRoundTrip(
        string manifestPath,
        string artifactPath,
        string pieceDirectory,
        string workDirectory,
        string receiptPath);

    /// <summary>Fetch and validate only a peer status document.</summary>
    PeerStatusCheck CheckPeerStatus(string manifestPath, string peerBaseUrl, string outputPath);

    /// <summary>Fetch and validate metadata needed before any peer piece bytes.</summary>
    PeerImportPreflight PreflightPeerImport(
        string requestPath,
        string manifestPath,
        string outputPath);

    /// <summary>Fetch, verify, assemble, and receipt one peer import.</summary>
    PeerImportExecution ExecutePeerImport(
        string requestPath,
        string manifestPath,
        string outputDirectory);

    /// <summary>Revalidate the full imported-artifact receipt chain.</summary>
    PeerImportReceiptInspection InspectPeerImportReceipt(
        string receiptPath,
        string requestPath,
        string preflightPath,
        string manifestPath,
        string artifactPath);
}
