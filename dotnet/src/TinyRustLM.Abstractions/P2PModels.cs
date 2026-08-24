namespace TinyRustLM;

/// <summary>The two artifact classes admitted by direct transport.</summary>
public enum TinyRustLmP2PArtifactKind
{
    /// <summary>An SLM2 model bound to one exact ACG2 composition.</summary>
    Slm2Model,

    /// <summary>One exact ACG2 composition artifact.</summary>
    Acg2Composition
}

/// <summary>Closed semantic admission for one transported artifact.</summary>
public sealed class TinyRustLmP2PAdmission
{
    private TinyRustLmP2PAdmission(TinyRustLmP2PArtifactKind kind, string? compositionPath)
    {
        Kind = kind;
        CompositionPath = compositionPath;
    }

    /// <summary>Artifact class to admit.</summary>
    public TinyRustLmP2PArtifactKind Kind { get; }

    /// <summary>Exact ACG2 path required only for an SLM2 model.</summary>
    public string? CompositionPath { get; }

    /// <summary>Creates admission for an SLM2 model bound to an exact local ACG2 artifact.</summary>
    public static TinyRustLmP2PAdmission ForSlm2Model(string compositionPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(compositionPath);
        return new TinyRustLmP2PAdmission(TinyRustLmP2PArtifactKind.Slm2Model, compositionPath);
    }

    /// <summary>Creates admission for an exact ACG2 composition artifact.</summary>
    public static TinyRustLmP2PAdmission ForAcg2Composition() =>
        new(TinyRustLmP2PArtifactKind.Acg2Composition, null);
}

/// <summary>Inputs required for one create-only provenance-bound share kit.</summary>
public sealed record PrepareShareKitRequest(
    string ArtifactPath,
    string OutputDirectory,
    string ArtifactManifestId,
    string QualificationReceiptId,
    string ProvenanceReceiptId,
    string LicenseExpression,
    string CreatedAtUtc,
    TinyRustLmP2PAdmission Admission);

/// <summary>Inputs required for one create-only verified local assembly.</summary>
public sealed record AssembleArtifactRequest(
    string PieceDirectory,
    string OutputPath,
    TinyRustLmP2PAdmission Admission);

/// <summary>One exact ordered transfer piece.</summary>
public sealed record P2PPiece(
    ulong Index,
    ulong Offset,
    ulong Length,
    string Sha256);

/// <summary>Public-safe redaction declaration bound into a manifest.</summary>
public sealed record P2PPublicRedaction(
    string Profile,
    string Decision);

/// <summary>Canonical public-safe fixed-piece direct-transfer manifest.</summary>
public sealed record P2PManifest(
    string Schema,
    string ManifestId,
    string CanonicalContentSha256,
    string ArtifactManifestId,
    string ArtifactId,
    string ArtifactSha256,
    ulong ArtifactBytes,
    ulong PieceBytes,
    ulong PieceCount,
    IReadOnlyList<P2PPiece> Pieces,
    string MerkleProfile,
    string MerkleRootSha256,
    IReadOnlyList<string> CompositionArtifactIds,
    string QualificationReceiptId,
    string ProvenanceReceiptId,
    string LicenseExpression,
    string CreatedAtUtc,
    P2PPublicRedaction Redaction);

/// <summary>Result of one create-only local share-kit transaction.</summary>
public sealed record P2PShareKitReport(
    string Schema,
    string OutputDirectory,
    string ManifestPath,
    string PieceDirectory,
    P2PManifest Manifest);

/// <summary>Result of one verified and semantically admitted local assembly.</summary>
public sealed record P2PImportedArtifact(
    string Schema,
    string OutputPath,
    string ManifestId,
    string ArtifactSha256,
    ulong ArtifactBytes);

/// <summary>Composition-bound fixed-piece direct-transport API.</summary>
public interface ITinyRustLmP2PClient
{
    /// <summary>Creates one new local share kit and returns its validated manifest.</summary>
    P2PShareKitReport PrepareShareKit(PrepareShareKitRequest request);

    /// <summary>Validates one exact canonical manifest wire.</summary>
    P2PManifest InspectManifest(ReadOnlyMemory<byte> canonicalManifestJson);

    /// <summary>Verifies pieces, admits semantics, and create-only promotes one artifact.</summary>
    P2PImportedArtifact AssembleArtifact(
        AssembleArtifactRequest request,
        ReadOnlyMemory<byte> canonicalManifestJson);
}
