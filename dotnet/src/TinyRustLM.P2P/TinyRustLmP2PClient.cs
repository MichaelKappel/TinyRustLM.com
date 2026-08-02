using System.Text;
using System.Text.Json;

namespace TinyRustLM;

/// <summary>Native-backed metadata-bound TinyRustLM P2P workflow client.</summary>
public sealed class TinyRustLmP2PClient : ITinyRustLmP2PClient
{
    private const long MinPieceSize = 1024;
    private const long MaxPieceSize = 16 * 1024 * 1024;
    private const int MaxManifestJsonBytes = 1024 * 1024;
    private const int MaxPublicKeyJsonBytes = 16 * 1024;
    private const int MaxAnnouncementJsonBytes = 256 * 1024;
    private const int MaxAnnouncementCatalogJsonBytes = 4 * 1024 * 1024;
    private const int MaxReceiptJsonBytes = 256 * 1024;

    /// <inheritdoc />
    public P2PShareKitReport PrepareLocalShareKit(PrepareShareKitRequest request)
    {
        using var requestUtf8 = NativeJson.Utf8(PrepareShareKitRequestJson(request), nameof(request));
        return NativeJson.Call<P2PShareKitReport>(() =>
            NativeMethods.tinyrustlm_p2p_prepare_share_kit_json(requestUtf8.Pointer));
    }

    /// <inheritdoc />
    public string PrepareLocalShareKitJson(PrepareShareKitRequest request)
    {
        using var requestUtf8 = NativeJson.Utf8(PrepareShareKitRequestJson(request), nameof(request));
        var report = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_p2p_prepare_share_kit_json(requestUtf8.Pointer));
        return JsonSerializer.Serialize(report, NativeJson.SerializerOptions);
    }

    private static string PrepareShareKitRequestJson(PrepareShareKitRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidatePrepareShareKitRequest(request);
        var nativeRequest = new NativePrepareShareKitRequest(
            request.ModelPath,
            request.OutputDir,
            request.ManifestId,
            request.ModelId,
            request.PeerId,
            request.PublicBaseUrl,
            request.PieceSize);
        return JsonSerializer.Serialize(nativeRequest, NativeJson.SerializerOptions);
    }

    private static void ValidatePrepareShareKitRequest(PrepareShareKitRequest request)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.ModelPath, nameof(request.ModelPath));
        ArgumentException.ThrowIfNullOrWhiteSpace(request.OutputDir, nameof(request.OutputDir));
        NativeJson.ThrowIfContainsEmbeddedNul(request.ModelPath, nameof(request.ModelPath));
        NativeJson.ThrowIfContainsEmbeddedNul(request.OutputDir, nameof(request.OutputDir));
        NativeJson.ThrowIfContainsEmbeddedNul(request.ManifestId, nameof(request.ManifestId));
        NativeJson.ThrowIfContainsEmbeddedNul(request.ModelId, nameof(request.ModelId));
        NativeJson.ThrowIfContainsEmbeddedNul(request.PeerId, nameof(request.PeerId));
        NativeJson.ThrowIfContainsEmbeddedNul(request.PublicBaseUrl, nameof(request.PublicBaseUrl));
        if (request.PieceSize is { } pieceSize
            && (pieceSize < MinPieceSize || pieceSize > MaxPieceSize))
        {
            throw new ArgumentOutOfRangeException(
                nameof(request.PieceSize),
                pieceSize,
                $"PieceSize must be between {MinPieceSize} and {MaxPieceSize} bytes.");
        }
    }

    /// <inheritdoc />
    public P2PManifestInspection InspectManifest(string manifestJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(manifestJson);
        ValidateJsonHandoff(
            manifestJson,
            MaxManifestJsonBytes,
            nameof(manifestJson),
            "P2P manifest JSON");
        using var manifestUtf8 = NativeJson.Utf8(manifestJson, nameof(manifestJson));
        return NativeJson.Call<P2PManifestInspection>(() =>
            NativeMethods.tinyrustlm_p2p_inspect_manifest_json(manifestUtf8.Pointer));
    }

    /// <inheritdoc />
    public P2PSignedManifestVerification VerifySignedManifest(
        string signedManifestJson,
        string publicKeyJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(signedManifestJson);
        ArgumentException.ThrowIfNullOrWhiteSpace(publicKeyJson);
        ValidateJsonHandoff(
            signedManifestJson,
            MaxManifestJsonBytes,
            nameof(signedManifestJson),
            "signed P2P manifest JSON");
        ValidateJsonHandoff(
            publicKeyJson,
            MaxPublicKeyJsonBytes,
            nameof(publicKeyJson),
            "P2P public key JSON");
        using var signedManifestUtf8 = NativeJson.Utf8(signedManifestJson, nameof(signedManifestJson));
        using var publicKeyUtf8 = NativeJson.Utf8(publicKeyJson, nameof(publicKeyJson));
        return NativeJson.Call<P2PSignedManifestVerification>(() =>
            NativeMethods.tinyrustlm_p2p_verify_signed_manifest_json(
                signedManifestUtf8.Pointer,
                publicKeyUtf8.Pointer));
    }

    /// <inheritdoc />
    public string VerifySignedManifestJson(string signedManifestJson, string publicKeyJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(signedManifestJson);
        ArgumentException.ThrowIfNullOrWhiteSpace(publicKeyJson);
        ValidateJsonHandoff(
            signedManifestJson,
            MaxManifestJsonBytes,
            nameof(signedManifestJson),
            "signed P2P manifest JSON");
        ValidateJsonHandoff(
            publicKeyJson,
            MaxPublicKeyJsonBytes,
            nameof(publicKeyJson),
            "P2P public key JSON");
        using var signedManifestUtf8 = NativeJson.Utf8(signedManifestJson, nameof(signedManifestJson));
        using var publicKeyUtf8 = NativeJson.Utf8(publicKeyJson, nameof(publicKeyJson));
        var verification = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_p2p_verify_signed_manifest_json(
                signedManifestUtf8.Pointer,
                publicKeyUtf8.Pointer));
        return JsonSerializer.Serialize(verification, NativeJson.SerializerOptions);
    }

    /// <inheritdoc />
    public P2PImportPlan ImportFromManifest(string manifestJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(manifestJson);
        ValidateJsonHandoff(
            manifestJson,
            MaxManifestJsonBytes,
            nameof(manifestJson),
            "P2P manifest JSON");
        using var manifestUtf8 = NativeJson.Utf8(manifestJson, nameof(manifestJson));
        return NativeJson.Call<P2PImportPlan>(() =>
            NativeMethods.tinyrustlm_p2p_import_from_manifest_json(manifestUtf8.Pointer));
    }

    /// <inheritdoc />
    public P2PLocalImportReceipt ImportFromManifest(
        string manifestJson,
        string shareKitRoot,
        string outputPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(manifestJson);
        ArgumentException.ThrowIfNullOrWhiteSpace(shareKitRoot);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputPath);
        ValidateJsonHandoff(
            manifestJson,
            MaxManifestJsonBytes,
            nameof(manifestJson),
            "P2P manifest JSON");
        using var manifestUtf8 = NativeJson.Utf8(manifestJson, nameof(manifestJson));
        using var shareKitRootUtf8 = NativeJson.Utf8(shareKitRoot, nameof(shareKitRoot));
        using var outputPathUtf8 = NativeJson.Utf8(outputPath, nameof(outputPath));
        return NativeJson.Call<P2PLocalImportReceipt>(() =>
            NativeMethods.tinyrustlm_p2p_assemble_from_manifest_json(
                manifestUtf8.Pointer,
                shareKitRootUtf8.Pointer,
                outputPathUtf8.Pointer));
    }

    /// <inheritdoc />
    public P2PLocalImportReceiptInspection InspectLocalImportReceipt(string receiptJson, string outputPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(receiptJson);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputPath);
        ValidateJsonHandoff(
            receiptJson,
            MaxReceiptJsonBytes,
            nameof(receiptJson),
            "P2P local import receipt JSON");
        using var receiptUtf8 = NativeJson.Utf8(receiptJson, nameof(receiptJson));
        using var outputPathUtf8 = NativeJson.Utf8(outputPath, nameof(outputPath));
        return NativeJson.Call<P2PLocalImportReceiptInspection>(() =>
            NativeMethods.tinyrustlm_p2p_inspect_local_import_receipt_json(
                receiptUtf8.Pointer,
                outputPathUtf8.Pointer));
    }

    /// <inheritdoc />
    public P2PShareMetadata ExportShareMetadata(string manifestJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(manifestJson);
        ValidateJsonHandoff(
            manifestJson,
            MaxManifestJsonBytes,
            nameof(manifestJson),
            "P2P manifest JSON");
        using var manifestUtf8 = NativeJson.Utf8(manifestJson, nameof(manifestJson));
        return NativeJson.Call<P2PShareMetadata>(() =>
            NativeMethods.tinyrustlm_p2p_export_share_metadata_json(manifestUtf8.Pointer));
    }

    /// <inheritdoc />
    public string ExportShareMetadataJson(string manifestJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(manifestJson);
        ValidateJsonHandoff(
            manifestJson,
            MaxManifestJsonBytes,
            nameof(manifestJson),
            "P2P manifest JSON");
        using var manifestUtf8 = NativeJson.Utf8(manifestJson, nameof(manifestJson));
        var metadata = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_p2p_export_share_metadata_json(manifestUtf8.Pointer));
        return JsonSerializer.Serialize(metadata, NativeJson.SerializerOptions);
    }

    /// <inheritdoc />
    public P2PAnnouncement ValidateAnnouncement(string announcementJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(announcementJson);
        ValidateJsonHandoff(
            announcementJson,
            MaxAnnouncementJsonBytes,
            nameof(announcementJson),
            "P2P announcement JSON");
        using var announcementUtf8 = NativeJson.Utf8(announcementJson, nameof(announcementJson));
        return NativeJson.Call<P2PAnnouncement>(() =>
            NativeMethods.tinyrustlm_p2p_validate_announcement_json(announcementUtf8.Pointer));
    }

    /// <inheritdoc />
    public string ValidateAnnouncementJson(string announcementJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(announcementJson);
        ValidateJsonHandoff(
            announcementJson,
            MaxAnnouncementJsonBytes,
            nameof(announcementJson),
            "P2P announcement JSON");
        using var announcementUtf8 = NativeJson.Utf8(announcementJson, nameof(announcementJson));
        var announcement = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_p2p_validate_announcement_json(announcementUtf8.Pointer));
        return JsonSerializer.Serialize(announcement, NativeJson.SerializerOptions);
    }

    /// <inheritdoc />
    public P2PAnnouncementCatalog ApplyReceivedAnnouncement(string announcementJson, string? existingCatalogJson = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(announcementJson);
        ValidateJsonHandoff(
            announcementJson,
            MaxAnnouncementJsonBytes,
            nameof(announcementJson),
            "P2P announcement JSON");
        ValidateOptionalJsonHandoff(
            existingCatalogJson,
            MaxAnnouncementCatalogJsonBytes,
            nameof(existingCatalogJson),
            "P2P announcement catalog JSON");
        using var announcementUtf8 = NativeJson.Utf8(announcementJson, nameof(announcementJson));
        using var catalogUtf8 = NativeJson.Utf8(existingCatalogJson, nameof(existingCatalogJson));
        return NativeJson.Call<P2PAnnouncementCatalog>(() =>
            NativeMethods.tinyrustlm_p2p_apply_received_announcement_json(
                announcementUtf8.Pointer,
                catalogUtf8.Pointer));
    }

    /// <inheritdoc />
    public string ApplyReceivedAnnouncementJson(string announcementJson, string? existingCatalogJson = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(announcementJson);
        ValidateJsonHandoff(
            announcementJson,
            MaxAnnouncementJsonBytes,
            nameof(announcementJson),
            "P2P announcement JSON");
        ValidateOptionalJsonHandoff(
            existingCatalogJson,
            MaxAnnouncementCatalogJsonBytes,
            nameof(existingCatalogJson),
            "P2P announcement catalog JSON");
        using var announcementUtf8 = NativeJson.Utf8(announcementJson, nameof(announcementJson));
        using var catalogUtf8 = NativeJson.Utf8(existingCatalogJson, nameof(existingCatalogJson));
        var catalog = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_p2p_apply_received_announcement_json(
                announcementUtf8.Pointer,
                catalogUtf8.Pointer));
        return JsonSerializer.Serialize(catalog, NativeJson.SerializerOptions);
    }

    /// <inheritdoc />
    public P2PAnnouncementCatalogInspection InspectAnnouncementCatalog(string catalogJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(catalogJson);
        ValidateJsonHandoff(
            catalogJson,
            MaxAnnouncementCatalogJsonBytes,
            nameof(catalogJson),
            "P2P announcement catalog JSON");
        using var catalogUtf8 = NativeJson.Utf8(catalogJson, nameof(catalogJson));
        return NativeJson.Call<P2PAnnouncementCatalogInspection>(() =>
            NativeMethods.tinyrustlm_p2p_inspect_announcement_catalog_json(catalogUtf8.Pointer));
    }

    /// <inheritdoc />
    public string InspectAnnouncementCatalogJson(string catalogJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(catalogJson);
        ValidateJsonHandoff(
            catalogJson,
            MaxAnnouncementCatalogJsonBytes,
            nameof(catalogJson),
            "P2P announcement catalog JSON");
        using var catalogUtf8 = NativeJson.Utf8(catalogJson, nameof(catalogJson));
        var inspection = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_p2p_inspect_announcement_catalog_json(catalogUtf8.Pointer));
        return JsonSerializer.Serialize(inspection, NativeJson.SerializerOptions);
    }

    private static void ValidateOptionalJsonHandoff(
        string? json,
        int maxUtf8Bytes,
        string parameterName,
        string documentName)
    {
        if (json is null)
        {
            return;
        }

        ValidateJsonHandoff(json, maxUtf8Bytes, parameterName, documentName);
    }

    private static void ValidateJsonHandoff(
        string json,
        int maxUtf8Bytes,
        string parameterName,
        string documentName)
    {
        NativeJson.ThrowIfContainsEmbeddedNul(json, parameterName);
        var byteCount = Encoding.UTF8.GetByteCount(json);
        if (byteCount > maxUtf8Bytes)
        {
            throw new ArgumentException(
                $"{documentName} exceeded the {maxUtf8Bytes} UTF-8 byte budget.",
                parameterName);
        }
    }

    private sealed record NativePrepareShareKitRequest(
        string ModelPath,
        string OutputDir,
        string? ManifestId,
        string? ModelId,
        string? PeerId,
        string? PublicBaseUrl,
        long? PieceSize);
}
