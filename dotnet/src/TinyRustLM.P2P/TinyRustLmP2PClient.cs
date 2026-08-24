using System.Text.Json.Serialization;

namespace TinyRustLM;

/// <summary>Native-backed composition-bound fixed-piece direct transport.</summary>
public sealed class TinyRustLmP2PClient : ITinyRustLmP2PClient
{
    /// <inheritdoc />
    public P2PShareKitReport PrepareShareKit(PrepareShareKitRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidatePrepareRequest(request);
        var contract = NativeContractAuthority.Get();
        var requestBytes = NativeJson.Serialize(
            new NativePrepareEnvelope(
                NativeContractAuthority.P2PPrepareSchema,
                new NativePrepareRequest(
                    request.ArtifactPath,
                    request.OutputDirectory,
                    request.ArtifactManifestId,
                    request.QualificationReceiptId,
                    request.ProvenanceReceiptId,
                    request.LicenseExpression,
                    request.CreatedAtUtc,
                    NativeAdmission.From(request.Admission))),
            contract.Limits.MaximumP2PRequestJsonBytes,
            nameof(request));
        var report = NativeJson.Call<P2PShareKitReport>(() =>
            NativeMethods.tinyrustlm_p2p_prepare_share_kit_json(
                requestBytes,
                (nuint)requestBytes.Length));
        RequireSchema(report.Schema, "tinyrustlm.native.p2p_share_kit/1");
        RequireNativeText(report.OutputDirectory);
        RequireNativeText(report.ManifestPath);
        RequireNativeText(report.PieceDirectory);
        ValidateManifest(report.Manifest);
        return report;
    }

    /// <inheritdoc />
    public P2PManifest InspectManifest(ReadOnlyMemory<byte> canonicalManifestJson)
    {
        var contract = NativeContractAuthority.Get();
        ManagedValidation.RequireBytes(
            canonicalManifestJson,
            nameof(canonicalManifestJson),
            contract.Limits.MaximumP2PManifestBytes);
        var manifestBytes = canonicalManifestJson.ToArray();
        var manifest = NativeJson.Call<P2PManifest>(() =>
            NativeMethods.tinyrustlm_p2p_inspect_manifest_json(
                manifestBytes,
                (nuint)manifestBytes.Length));
        ValidateManifest(manifest);
        return manifest;
    }

    /// <inheritdoc />
    public P2PImportedArtifact AssembleArtifact(
        AssembleArtifactRequest request,
        ReadOnlyMemory<byte> canonicalManifestJson)
    {
        ArgumentNullException.ThrowIfNull(request);
        ManagedValidation.RequireText(request.PieceDirectory, nameof(request.PieceDirectory));
        ManagedValidation.RequireText(request.OutputPath, nameof(request.OutputPath));
        ArgumentNullException.ThrowIfNull(request.Admission);
        var contract = NativeContractAuthority.Get();
        ManagedValidation.RequireBytes(
            canonicalManifestJson,
            nameof(canonicalManifestJson),
            contract.Limits.MaximumP2PManifestBytes);
        var requestBytes = NativeJson.Serialize(
            new NativeAssembleRequest(
                NativeContractAuthority.P2PAssembleSchema,
                request.PieceDirectory,
                request.OutputPath,
                NativeAdmission.From(request.Admission)),
            contract.Limits.MaximumP2PRequestJsonBytes,
            nameof(request));
        var manifestBytes = canonicalManifestJson.ToArray();
        var report = NativeJson.Call<P2PImportedArtifact>(() =>
            NativeMethods.tinyrustlm_p2p_assemble_json(
                requestBytes,
                (nuint)requestBytes.Length,
                manifestBytes,
                (nuint)manifestBytes.Length));
        RequireSchema(report.Schema, "tinyrustlm.native.p2p_imported_artifact/1");
        if (!IsNativeText(report.OutputPath) ||
            !ManagedValidation.IsContentId(report.ManifestId) ||
            !ManagedValidation.IsDigest(report.ArtifactSha256) ||
            report.ArtifactBytes == 0)
        {
            throw new TinyRustLmException("native-p2p-import-report");
        }

        return report;
    }

    private static void ValidatePrepareRequest(PrepareShareKitRequest request)
    {
        ManagedValidation.RequireText(request.ArtifactPath, nameof(request.ArtifactPath));
        ManagedValidation.RequireText(request.OutputDirectory, nameof(request.OutputDirectory));
        ManagedValidation.RequireContentId(request.ArtifactManifestId, nameof(request.ArtifactManifestId));
        ManagedValidation.RequireContentId(request.QualificationReceiptId, nameof(request.QualificationReceiptId));
        ManagedValidation.RequireContentId(request.ProvenanceReceiptId, nameof(request.ProvenanceReceiptId));
        ManagedValidation.RequireText(request.LicenseExpression, nameof(request.LicenseExpression), 256);
        ManagedValidation.RequireText(request.CreatedAtUtc, nameof(request.CreatedAtUtc), 64);
        ArgumentNullException.ThrowIfNull(request.Admission);
        _ = NativeAdmission.From(request.Admission);
    }

    private static void ValidateManifest(P2PManifest manifest)
    {
        ArgumentNullException.ThrowIfNull(manifest);
        RequireSchema(manifest.Schema, "tinyrustlm.vnext.p2p_manifest.v1");
        if (manifest.Pieces is null ||
            manifest.CompositionArtifactIds is null ||
            manifest.Redaction is null ||
            !ManagedValidation.IsContentId(manifest.ManifestId) ||
            !ManagedValidation.IsDigest(manifest.CanonicalContentSha256) ||
            !ManagedValidation.IsContentId(manifest.ArtifactManifestId) ||
            !ManagedValidation.IsContentId(manifest.ArtifactId) ||
            !ManagedValidation.IsDigest(manifest.ArtifactSha256) ||
            !ManagedValidation.IsDigest(manifest.MerkleRootSha256) ||
            !ManagedValidation.IsContentId(manifest.QualificationReceiptId) ||
            !ManagedValidation.IsContentId(manifest.ProvenanceReceiptId) ||
            !IsNativeText(manifest.LicenseExpression, 256) ||
            !IsNativeText(manifest.CreatedAtUtc, 64) ||
            manifest.ArtifactBytes == 0 ||
            manifest.PieceBytes != 4_194_304 ||
            manifest.PieceCount == 0 ||
            manifest.PieceCount != (ulong)manifest.Pieces.Count ||
            manifest.MerkleProfile != "tinyrustlm.merkle.sha256-4mib.v1" ||
            manifest.Redaction.Profile != "tinyrustlm.vnext.public_safe.v1" ||
            manifest.Redaction.Decision != "public-safe")
        {
            throw new TinyRustLmException("native-p2p-manifest-report");
        }

        ulong expectedOffset = 0;
        for (var index = 0; index < manifest.Pieces.Count; index++)
        {
            var piece = manifest.Pieces[index];
            if (piece is null ||
                !ManagedValidation.IsDigest(piece.Sha256) ||
                piece.Index != (ulong)index || piece.Offset != expectedOffset ||
                piece.Length == 0 || piece.Length > manifest.PieceBytes)
            {
                throw new TinyRustLmException("native-p2p-piece-report");
            }

            expectedOffset = checked(expectedOffset + piece.Length);
        }

        if (expectedOffset != manifest.ArtifactBytes ||
            !manifest.CompositionArtifactIds.SequenceEqual(
                manifest.CompositionArtifactIds.OrderBy(value => value, StringComparer.Ordinal),
                StringComparer.Ordinal))
        {
            throw new TinyRustLmException("native-p2p-manifest-report");
        }

        foreach (var compositionId in manifest.CompositionArtifactIds)
        {
            if (!ManagedValidation.IsContentId(compositionId))
            {
                throw new TinyRustLmException("native-p2p-manifest-report");
            }
        }
    }

    private static bool IsNativeText(string? value, int maximumCharacters = 4096) =>
        !string.IsNullOrWhiteSpace(value) &&
        value.Length <= maximumCharacters &&
        value.IndexOf('\0', StringComparison.Ordinal) < 0;

    private static void RequireNativeText(string? value)
    {
        if (!IsNativeText(value))
        {
            throw new TinyRustLmException("native-p2p-report");
        }
    }

    private static void RequireSchema(string actual, string expected)
    {
        if (!string.Equals(actual, expected, StringComparison.Ordinal))
        {
            throw new TinyRustLmException("native-report-schema");
        }
    }

    private sealed record NativePrepareEnvelope(string Schema, NativePrepareRequest Request);

    private sealed record NativePrepareRequest(
        string ArtifactPath,
        string OutputDirectory,
        string ArtifactManifestId,
        string QualificationReceiptId,
        string ProvenanceReceiptId,
        string LicenseExpression,
        string CreatedAtUtc,
        NativeAdmission Admission);

    private sealed record NativeAssembleRequest(
        string Schema,
        string PieceDirectory,
        string OutputPath,
        NativeAdmission Admission);

    private sealed record NativeAdmission(
        string Kind,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        string? CompositionPath)
    {
        internal static NativeAdmission From(TinyRustLmP2PAdmission admission)
        {
            ArgumentNullException.ThrowIfNull(admission);
            return admission.Kind switch
            {
                TinyRustLmP2PArtifactKind.Slm2Model => Slm2(admission.CompositionPath),
                TinyRustLmP2PArtifactKind.Acg2Composition when admission.CompositionPath is null =>
                    new NativeAdmission("acg2-composition", null),
                _ => throw new ArgumentException("The artifact admission is inconsistent.", nameof(admission))
            };
        }

        private static NativeAdmission Slm2(string? compositionPath)
        {
            ManagedValidation.RequireText(compositionPath!, nameof(compositionPath));
            return new NativeAdmission("slm2-model", compositionPath);
        }
    }
}
