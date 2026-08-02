using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.SeedHost;

/// <summary>Native-backed implementation of MiniModel trust operations.</summary>
public sealed class MiniModelAuthority : IMiniModelAuthority
{
    /// <summary>Native ABI version supported by this managed package.</summary>
    public const uint SupportedNativeAbiVersion = 2;

    private const int MaxRequestJsonBytes = 4 * 1024 * 1024;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower) }
    };

    /// <inheritdoc />
    public uint NativeAbiVersion => InvokeNative(MiniModelNativeMethods.minimodel_native_abi_version);

    /// <inheritdoc />
    public MiniModelManifestInspection InspectManifest(string manifestPath) => Invoke<MiniModelManifestInspection>(
        new { operation = "inspect_manifest", manifest_path = RequiredPath(manifestPath, nameof(manifestPath)) });

    /// <inheritdoc />
    public MiniModelArtifactVerification VerifyArtifact(string manifestPath, string artifactPath) =>
        Invoke<MiniModelArtifactVerification>(new
        {
            operation = "verify_artifact",
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            artifact_path = RequiredPath(artifactPath, nameof(artifactPath))
        });

    /// <inheritdoc />
    public PeerPieceInspection InspectPeerPieceDirectory(string manifestPath, string pieceDirectory) =>
        Invoke<PeerPieceInspection>(new
        {
            operation = "inspect_peer_piece_dir",
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            piece_dir = RequiredPath(pieceDirectory, nameof(pieceDirectory))
        });

    /// <inheritdoc />
    public PeerCompanionInspection InspectPeerCompanionState(
        string statePath,
        string manifestPath,
        string pieceDirectory) => Invoke<PeerCompanionInspection>(new
        {
            operation = "inspect_peer_companion_state",
            state_path = RequiredPath(statePath, nameof(statePath)),
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            piece_dir = RequiredPath(pieceDirectory, nameof(pieceDirectory))
        });

    /// <inheritdoc />
    public PeerCompanionStateWrite WritePeerCompanionState(
        string manifestPath,
        string pieceDirectory,
        string outputPath,
        string knownPeerBaseUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(knownPeerBaseUrl);
        ThrowIfEmbeddedNul(knownPeerBaseUrl, nameof(knownPeerBaseUrl));
        return Invoke<PeerCompanionStateWrite>(new
        {
            operation = "write_peer_companion_state",
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            piece_dir = RequiredPath(pieceDirectory, nameof(pieceDirectory)),
            output_path = RequiredPath(outputPath, nameof(outputPath)),
            known_peer_base_url = knownPeerBaseUrl
        });
    }

    /// <inheritdoc />
    public SeedFleetInspection InspectSeedFleet(string configPath) => Invoke<SeedFleetInspection>(new
    {
        operation = "inspect_seed_fleet",
        config_path = RequiredPath(configPath, nameof(configPath))
    });

    /// <inheritdoc />
    public ExternalProbeReceiptInspection InspectExternalProbeReceipt(
        string receiptPath,
        string trustPath,
        string configPath) => Invoke<ExternalProbeReceiptInspection>(new
        {
            operation = "inspect_external_probe_receipt",
            receipt_path = RequiredPath(receiptPath, nameof(receiptPath)),
            trust_path = RequiredPath(trustPath, nameof(trustPath)),
            config_path = RequiredPath(configPath, nameof(configPath))
        });

    /// <inheritdoc />
    public SeedPeerSourceAnnouncementPreparation PrepareSeedAnnouncement(
        string catalogEntryPath,
        string outputPath,
        string receiptPath,
        string trustPath,
        string configPath) => Invoke<SeedPeerSourceAnnouncementPreparation>(new
        {
            operation = "prepare_seed_announcement",
            catalog_entry_path = RequiredPath(catalogEntryPath, nameof(catalogEntryPath)),
            output_path = RequiredPath(outputPath, nameof(outputPath)),
            receipt_path = RequiredPath(receiptPath, nameof(receiptPath)),
            trust_path = RequiredPath(trustPath, nameof(trustPath)),
            config_path = RequiredPath(configPath, nameof(configPath))
        });

    /// <inheritdoc />
    public PeerSharePreparation PreparePeerShare(
        string artifactPath,
        string outputDirectory,
        string modelId,
        string? sourceHuggingFaceModelId = null,
        string? knownPeerBaseUrl = null,
        PeerShareProvenance? provenance = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(modelId);
        ThrowIfEmbeddedNul(modelId, nameof(modelId));
        ThrowIfEmbeddedNul(sourceHuggingFaceModelId, nameof(sourceHuggingFaceModelId));
        ThrowIfEmbeddedNul(knownPeerBaseUrl, nameof(knownPeerBaseUrl));
        return Invoke<PeerSharePreparation>(new
        {
            operation = "prepare_peer_share",
            artifact_path = RequiredPath(artifactPath, nameof(artifactPath)),
            output_dir = RequiredPath(outputDirectory, nameof(outputDirectory)),
            model_id = modelId,
            source_huggingface_model_id = sourceHuggingFaceModelId,
            known_peer_base_url = knownPeerBaseUrl,
            provenance = ProvenanceRequest(provenance)
        });
    }

    /// <inheritdoc />
    public LocalPeerRoundTripVerification VerifyLocalPeerRoundTrip(
        string manifestPath,
        string artifactPath,
        string pieceDirectory,
        string workDirectory,
        string receiptPath) => Invoke<LocalPeerRoundTripVerification>(new
        {
            operation = "verify_local_peer_round_trip",
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            artifact_path = RequiredPath(artifactPath, nameof(artifactPath)),
            piece_dir = RequiredPath(pieceDirectory, nameof(pieceDirectory)),
            work_dir = RequiredPath(workDirectory, nameof(workDirectory)),
            receipt_path = RequiredPath(receiptPath, nameof(receiptPath))
        });

    /// <inheritdoc />
    public PeerStatusCheck CheckPeerStatus(string manifestPath, string peerBaseUrl, string outputPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(peerBaseUrl);
        ThrowIfEmbeddedNul(peerBaseUrl, nameof(peerBaseUrl));
        return Invoke<PeerStatusCheck>(new
        {
            operation = "check_peer_status",
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            peer_base_url = peerBaseUrl,
            output_path = RequiredPath(outputPath, nameof(outputPath))
        });
    }

    /// <inheritdoc />
    public PeerImportPreflight PreflightPeerImport(
        string requestPath,
        string manifestPath,
        string outputPath) => Invoke<PeerImportPreflight>(new
        {
            operation = "preflight_peer_import",
            request_path = RequiredPath(requestPath, nameof(requestPath)),
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            output_path = RequiredPath(outputPath, nameof(outputPath))
        });

    /// <inheritdoc />
    public PeerImportExecution ExecutePeerImport(
        string requestPath,
        string manifestPath,
        string outputDirectory) => Invoke<PeerImportExecution>(new
        {
            operation = "execute_peer_import",
            request_path = RequiredPath(requestPath, nameof(requestPath)),
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            output_dir = RequiredPath(outputDirectory, nameof(outputDirectory))
        });

    /// <inheritdoc />
    public PeerImportReceiptInspection InspectPeerImportReceipt(
        string receiptPath,
        string requestPath,
        string preflightPath,
        string manifestPath,
        string artifactPath) => Invoke<PeerImportReceiptInspection>(new
        {
            operation = "inspect_peer_import_receipt",
            receipt_path = RequiredPath(receiptPath, nameof(receiptPath)),
            request_path = RequiredPath(requestPath, nameof(requestPath)),
            preflight_path = RequiredPath(preflightPath, nameof(preflightPath)),
            manifest_path = RequiredPath(manifestPath, nameof(manifestPath)),
            artifact_path = RequiredPath(artifactPath, nameof(artifactPath))
        });

    /// <summary>Serialize one request, call Rust, and deserialize a strict typed envelope.</summary>
    private static T Invoke<T>(object request)
    {
        EnsureSupportedAbi();
        var requestJson = JsonSerializer.Serialize(request, JsonOptions);
        if (Encoding.UTF8.GetByteCount(requestJson) > MaxRequestJsonBytes)
        {
            throw new SeedHostValidationException(
                "request_too_large",
                $"MiniModel native request exceeds {MaxRequestJsonBytes} UTF-8 bytes.");
        }
        using var nativeRequest = new NativeUtf8String(requestJson);
        var pointer = InvokeNative(() =>
            MiniModelNativeMethods.minimodel_native_invoke_json(nativeRequest.Pointer));
        if (pointer == IntPtr.Zero)
        {
            throw new SeedHostException(
                "null_native_response",
                "MiniModel native operation returned no response.");
        }
        try
        {
            var responseJson = Marshal.PtrToStringUTF8(pointer)
                ?? throw new SeedHostException(
                    "invalid_native_response",
                    "MiniModel native response was not valid UTF-8.");
            var envelope = JsonSerializer.Deserialize<NativeEnvelope<T>>(responseJson, JsonOptions)
                ?? throw new SeedHostException(
                    "invalid_native_response",
                    "MiniModel native response was empty.");
            if (!envelope.Ok)
            {
                var error = envelope.Error
                    ?? new NativeError("native_error", "MiniModel native operation failed.");
                throw new SeedHostException(error.Code, error.Message);
            }
            return envelope.Value
                ?? throw new SeedHostException(
                    "invalid_native_response",
                    "MiniModel native response did not include a value.");
        }
        finally
        {
            MiniModelNativeMethods.minimodel_native_string_free(pointer);
        }
    }

    /// <summary>Reject a native package that cannot honor this managed JSON contract.</summary>
    private static void EnsureSupportedAbi()
    {
        var actual = InvokeNative(MiniModelNativeMethods.minimodel_native_abi_version);
        if (actual != SupportedNativeAbiVersion)
        {
            throw new SeedHostException(
                "native_abi_mismatch",
                $"MiniModel native ABI {actual} is incompatible with required ABI {SupportedNativeAbiVersion}.");
        }
    }

    /// <summary>Map loader failures to an actionable package diagnostic.</summary>
    private static T InvokeNative<T>(Func<T> operation)
    {
        try
        {
            return operation();
        }
        catch (DllNotFoundException error)
        {
            throw new SeedHostException(
                "native_library_not_found",
                $"MiniModel native library for RID {MiniModelNativeMethods.RuntimeIdentifier()} was not found.",
                error);
        }
        catch (BadImageFormatException error)
        {
            throw new SeedHostException(
                "native_architecture_mismatch",
                $"MiniModel native library does not match RID {MiniModelNativeMethods.RuntimeIdentifier()}.",
                error);
        }
    }

    /// <summary>Validate a required native path argument without normalizing caller intent.</summary>
    private static string RequiredPath(string value, string argumentName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        ThrowIfEmbeddedNul(value, argumentName);
        return value;
    }

    /// <summary>Validate and map trained provenance without exposing unreviewed JSON fields.</summary>
    private static object? ProvenanceRequest(PeerShareProvenance? provenance)
    {
        if (provenance is null)
        {
            return null;
        }
        return new
        {
            source_revision = RequiredText(provenance.SourceRevision, nameof(provenance.SourceRevision)),
            source_license_id = RequiredText(provenance.SourceLicenseId, nameof(provenance.SourceLicenseId)),
            source_license_path = RequiredPath(provenance.SourceLicensePath, nameof(provenance.SourceLicensePath)),
            source_license_sha256 = RequiredText(provenance.SourceLicenseSha256, nameof(provenance.SourceLicenseSha256)),
            modification_notice_path = RequiredPath(provenance.ModificationNoticePath, nameof(provenance.ModificationNoticePath)),
            modification_notice_sha256 = RequiredText(provenance.ModificationNoticeSha256, nameof(provenance.ModificationNoticeSha256)),
            conversation_evidence_path = RequiredPath(provenance.ConversationEvidencePath, nameof(provenance.ConversationEvidencePath)),
            conversation_evidence_sha256 = RequiredText(provenance.ConversationEvidenceSha256, nameof(provenance.ConversationEvidenceSha256)),
            evaluation_evidence_path = RequiredPath(provenance.EvaluationEvidencePath, nameof(provenance.EvaluationEvidencePath)),
            evaluation_evidence_sha256 = RequiredText(provenance.EvaluationEvidenceSha256, nameof(provenance.EvaluationEvidenceSha256)),
            quality_tier = provenance.QualityTier,
            known_limitation = RequiredText(provenance.KnownLimitation, nameof(provenance.KnownLimitation))
        };
    }

    /// <summary>Validate a required native text argument without changing its identity.</summary>
    private static string RequiredText(string value, string argumentName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        ThrowIfEmbeddedNul(value, argumentName);
        return value;
    }

    /// <summary>Reject embedded NUL before constructing a native C string.</summary>
    private static void ThrowIfEmbeddedNul(string? value, string argumentName)
    {
        if (value?.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException(
                "MiniModel native string arguments cannot contain embedded NUL characters.",
                argumentName);
        }
    }

    private sealed record NativeEnvelope<T>(bool Ok, T? Value, NativeError? Error);

    private sealed record NativeError(string Code, string Message);

    /// <summary>Own one unmanaged UTF-8 string for a native call.</summary>
    private sealed class NativeUtf8String : IDisposable
    {
        internal NativeUtf8String(string value)
        {
            Pointer = Marshal.StringToCoTaskMemUTF8(value);
        }

        internal IntPtr Pointer { get; }

        /// <inheritdoc />
        public void Dispose()
        {
            Marshal.FreeCoTaskMem(Pointer);
        }
    }
}
