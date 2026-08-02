namespace TinyRustLM;

/// <summary>Request to prepare a local TinyRustLM P2P share kit.</summary>
public sealed record PrepareShareKitRequest(
    string ModelPath,
    string OutputDir,
    string? ManifestId = null,
    string? ModelId = null,
    string? PeerId = null,
    string? PublicBaseUrl = null,
    long? PieceSize = null);

/// <summary>One piece declared by a TinyRustLM P2P manifest.</summary>
public sealed record P2PPiece(int Index, string Route, long ByteCount, string Sha256);

/// <summary>Public P2P manifest boundary flags that prevent private-product leakage.</summary>
public sealed record P2PManifestBoundary(
    bool ManifestContainsModelBytes,
    bool ExposesPrivateRouting,
    bool RequiresPieceSha256Validation,
    bool RequiresArtifactSha256Validation);

/// <summary>Metadata-only P2P manifest for an already-created .slm artifact.</summary>
public sealed record P2PManifest(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    SlmInspection Slm,
    string ArtifactSha256,
    long ArtifactByteCount,
    long PieceSize,
    int PieceCount,
    IReadOnlyList<P2PPiece> Pieces,
    long CreatedUnixSeconds,
    P2PManifestBoundary Boundary);

/// <summary>Detached Ed25519 signature over a canonical TinyRustLM P2P manifest payload.</summary>
public sealed record P2PManifestSignature(
    string Kind,
    string KeyId,
    string PublisherId,
    string PublicKeyRoute,
    string PayloadSha256,
    string Value);

/// <summary>Metadata-only signed P2P manifest envelope.</summary>
public sealed record P2PSignedManifest(
    string Kind,
    int Version,
    P2PManifest Manifest,
    P2PManifestSignature Signature);

/// <summary>Metadata-only MiniModel public key document used by the public verifier.</summary>
public sealed record P2PPublicKeyDocument(
    string KeyKind,
    string KeyAlgorithm,
    string KeyId,
    string PublisherId,
    string PublicKeyRoute,
    string PublicKeyBase64,
    string PublicKeySha256,
    string Usage,
    string CreatedUtc,
    bool Revoked);

/// <summary>Report returned after local signed P2P manifest verification.</summary>
public sealed record P2PSignedManifestVerification(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    string ManifestSha256,
    string SignatureAlgorithm,
    string KeyId,
    string PublisherId,
    string PublicKeyRoute,
    string PublicKeySha256,
    string PayloadSha256,
    bool Valid);

/// <summary>Metadata-only share kit report written by the public P2P SDK.</summary>
public sealed record P2PShareKitReport(
    string Kind,
    int Version,
    string OutputDir,
    string ManifestPath,
    string ShareMetadataPath,
    string? AnnouncementPath,
    string ManifestSha256,
    string ShareMetadataSha256,
    string? AnnouncementSha256,
    P2PManifest Manifest);

/// <summary>Metadata-only share summary exported from a P2P manifest.</summary>
public sealed record P2PShareMetadata(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    string ManifestSha256,
    string ArtifactSha256,
    long ArtifactByteCount,
    int PieceCount,
    long ExportedUnixSeconds,
    P2PManifestBoundary Boundary);

/// <summary>Inspection report for a metadata-bound P2P manifest.</summary>
public sealed record P2PManifestInspection(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    string ManifestSha256,
    string ArtifactSha256,
    long ArtifactByteCount,
    int PieceCount,
    long DeclaredPieceBytes,
    bool Valid);

/// <summary>Metadata-only import plan for a TinyRustLM P2P manifest.</summary>
public sealed record P2PImportPlan(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    string ManifestSha256,
    string ArtifactSha256,
    IReadOnlyList<P2PPiece> RequiredPieces,
    string RequiredNextGate);

/// <summary>Boundary flags proven by local P2P piece assembly.</summary>
public sealed record P2PLocalImportBoundary(
    bool NetworkFetchPerformed,
    bool PrivateRoutingUsed,
    bool PieceSha256Verified,
    bool ArtifactSha256Verified,
    bool SlmValidationPerformed);

/// <summary>Receipt for a local share-kit assembly into a verified .slm artifact.</summary>
public sealed record P2PLocalImportReceipt(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    string ManifestSha256,
    string ArtifactSha256,
    long ArtifactByteCount,
    string ReceiptPath,
    string OutputPath,
    string OutputSha256,
    long OutputByteCount,
    int PieceCount,
    int VerifiedPieceCount,
    long AssembledUnixSeconds,
    P2PLocalImportBoundary Boundary);

/// <summary>Inspection report for a local P2P import receipt and matching .slm artifact.</summary>
public sealed record P2PLocalImportReceiptInspection(
    string Kind,
    int Version,
    string ManifestId,
    string ModelId,
    string ReceiptSha256,
    string ManifestSha256,
    string ArtifactSha256,
    long ArtifactByteCount,
    string ReceiptOutputPath,
    string InspectedOutputPath,
    string InspectedOutputSha256,
    long InspectedOutputByteCount,
    int PieceCount,
    int VerifiedPieceCount,
    bool Valid,
    P2PLocalImportBoundary Boundary);

/// <summary>Peer announcement accepted by the public P2P SDK.</summary>
public sealed record P2PAnnouncement(
    string Kind,
    int Version,
    string PeerId,
    string ManifestId,
    string ModelId,
    string ManifestUrl,
    string ManifestSha256,
    string ArtifactSha256,
    long ArtifactByteCount,
    bool PeerConsent,
    long CreatedUnixSeconds);

/// <summary>Local catalog of validated received announcements.</summary>
public sealed record P2PAnnouncementCatalog(
    string Kind,
    int Version,
    IReadOnlyList<P2PAnnouncement> Announcements);

/// <summary>Inspection report for a local catalog of validated received announcements.</summary>
public sealed record P2PAnnouncementCatalogInspection(
    string Kind,
    int Version,
    string CatalogSha256,
    int AnnouncementCount,
    int PeerCount,
    int ManifestCount,
    int ModelCount,
    long TotalAnnouncedArtifactBytes,
    bool Valid);

/// <summary>Public metadata-bound P2P workflow API.</summary>
public interface ITinyRustLmP2PClient
{
    /// <summary>Prepares a local share kit and returns a typed metadata-only report.</summary>
    P2PShareKitReport PrepareLocalShareKit(PrepareShareKitRequest request);

    /// <summary>Prepares a local share kit and returns the exact native report JSON.</summary>
    string PrepareLocalShareKitJson(PrepareShareKitRequest request);

    /// <summary>Validates and inspects a P2P manifest JSON document.</summary>
    P2PManifestInspection InspectManifest(string manifestJson);

    /// <summary>Verifies a signed P2P manifest envelope with local public key JSON.</summary>
    P2PSignedManifestVerification VerifySignedManifest(string signedManifestJson, string publicKeyJson);

    /// <summary>Verifies a signed P2P manifest envelope and returns the exact native JSON.</summary>
    string VerifySignedManifestJson(string signedManifestJson, string publicKeyJson);

    /// <summary>Creates a metadata-only import plan from a manifest JSON document.</summary>
    P2PImportPlan ImportFromManifest(string manifestJson);

    /// <summary>
    /// Assembles local manifest-declared pieces into a verified .slm artifact and returns a receipt.
    /// </summary>
    P2PLocalImportReceipt ImportFromManifest(
        string manifestJson,
        string shareKitRoot,
        string outputPath);

    /// <summary>Validates a local P2P import receipt JSON document against an output .slm artifact.</summary>
    P2PLocalImportReceiptInspection InspectLocalImportReceipt(string receiptJson, string outputPath);

    /// <summary>Exports typed share metadata from a manifest JSON document.</summary>
    P2PShareMetadata ExportShareMetadata(string manifestJson);

    /// <summary>Exports the exact share metadata JSON from a manifest JSON document.</summary>
    string ExportShareMetadataJson(string manifestJson);

    /// <summary>Validates a received announcement JSON document.</summary>
    P2PAnnouncement ValidateAnnouncement(string announcementJson);

    /// <summary>Validates a received announcement JSON document and returns the exact native JSON.</summary>
    string ValidateAnnouncementJson(string announcementJson);

    /// <summary>Applies a received announcement to an optional existing catalog JSON document.</summary>
    P2PAnnouncementCatalog ApplyReceivedAnnouncement(string announcementJson, string? existingCatalogJson = null);

    /// <summary>Applies a received announcement and returns the exact native catalog JSON.</summary>
    string ApplyReceivedAnnouncementJson(string announcementJson, string? existingCatalogJson = null);

    /// <summary>Validates and inspects an existing announcement catalog JSON document.</summary>
    P2PAnnouncementCatalogInspection InspectAnnouncementCatalog(string catalogJson);

    /// <summary>Validates and inspects an existing announcement catalog and returns the exact native JSON.</summary>
    string InspectAnnouncementCatalogJson(string catalogJson);
}
