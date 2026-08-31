using System.Text;
using System.Text.Json;

namespace TinyRustLM.Companion;

public static class CompanionLoopbackWire
{
    public const string InstallationSchema = "tinyrustlm.companion.installation.v1";
    public const string PairingBeginRequestSchema =
        "tinyrustlm.companion.loopback.pairing-begin-request.v1";
    public const string PairingBeginResponseSchema =
        "tinyrustlm.companion.loopback.pairing-begin-response.v1";
    public const string PairingCompleteRequestSchema =
        "tinyrustlm.companion.loopback.pairing-complete-request.v1";
    public const string PairingCompleteResponseSchema =
        "tinyrustlm.companion.loopback.pairing-complete-response.v1";
    public const string SessionStatusSchema =
        "tinyrustlm.companion.loopback.session-status.v1";
    public const string RotationBeginSchema =
        "tinyrustlm.companion.loopback.rotation-begin.v1";
    public const string RotationChallengeSchema =
        "tinyrustlm.companion.loopback.rotation-challenge.v1";
    public const string RotationCommitSchema =
        "tinyrustlm.companion.loopback.rotation-commit.v1";
    public const string RotationCommittedSchema =
        "tinyrustlm.companion.loopback.rotation-committed.v1";
    public const string RevokeRequestSchema =
        "tinyrustlm.companion.loopback.revoke-request.v1";
    public const string RevokedResponseSchema =
        "tinyrustlm.companion.loopback.revoked.v1";
    public const string ErrorSchema =
        "tinyrustlm.companion.loopback.error.v1";
    public const string OperationProjectionSchema =
        "tinyrustlm.companion.loopback.operation-projection.v2";
    public const string CancelRequestSchema =
        "tinyrustlm.companion.loopback.cancel-request.v1";
    public const string DirectCompositionSeedStartRequestSchema =
        "tinyrustlm.companion.loopback.direct-composition-seed-start-request.v1";
    public const string DirectCompositionSeedStopRequestSchema =
        "tinyrustlm.companion.loopback.direct-composition-seed-stop-request.v1";
    public const string DirectCompositionSeedProjectionSchema =
        "tinyrustlm.companion.loopback.direct-composition-seed-projection.v1";
    public const int MaximumInstallationRecordBytes = 4_096;
    public const int MaximumPairingBeginRequestBytes = 2_048;
    public const int MaximumPairingBeginResponseBytes = 4_096;
    public const int MaximumPairingCompleteRequestBytes = 4_096;
    public const int MaximumPairingCompleteResponseBytes = 4_096;
    public const int MaximumSessionStatusBytes = 4_096;
    public const int MaximumRotationBeginBytes = 2_048;
    public const int MaximumRotationChallengeBytes = 4_096;
    public const int MaximumRotationCommitBytes = 4_096;
    public const int MaximumRotationCommittedBytes = 4_096;
    public const int MaximumRevokeRequestBytes = 1_024;
    public const int MaximumRevokedResponseBytes = 1_024;
    public const int MaximumErrorResponseBytes = 256;
    public const int MaximumAcquireRequestBytes = 65_536;
    public const int MaximumOperationProjectionBytes = 65_536;
    public const int MaximumCancelRequestBytes = 1_024;
    public const int MaximumDirectCompositionSeedStartRequestBytes = 1_024;
    public const int MaximumDirectCompositionSeedStopRequestBytes = 512;
    public const int MaximumDirectCompositionSeedProjectionBytes = 2_048;

    private const ulong MaximumJsonSafeInteger = 9_007_199_254_740_991;

    private static readonly HashSet<string> StableErrorCodes = new(StringComparer.Ordinal)
    {
        "request-malformed",
        "request-line-too-large",
        "request-headers-too-large",
        "request-header-not-allowed",
        "request-framing-invalid",
        "request-body-too-large",
        "request-body-timeout",
        "host-invalid",
        "origin-invalid",
        "cors-preflight-invalid",
        "route-not-found",
        "method-not-allowed",
        "media-type-invalid",
        "json-invalid",
        "contract-invalid",
        "pairing-code-expired",
        "pairing-claim-conflict",
        "pairing-capacity",
        "pairing-proof-invalid",
        "pairing-consumed",
        "capability-invalid",
        "capability-expired",
        "capability-idle-expired",
        "capability-revoked",
        "capability-replay",
        "capability-sequence",
        "session-request-in-flight",
        "rotation-conflict",
        "rotation-expired",
        "rotation-proof-invalid",
        "operation-not-found",
        "operation-terminal",
        "operation-not-available",
        "direct-composition-seed-not-found",
        "direct-composition-seed-not-available",
        "direct-composition-seed-operation-not-available",
        "direct-composition-seed-conflict",
        "direct-composition-seed-resource-limit",
        "direct-composition-seed-identity-drift",
        "artifact-role-invalid",
        "artifact-chunk-invalid",
        "artifact-identity-drift",
        "resource-limit",
        "companion-unavailable",
        "internal-failure"
    };

    private static readonly UTF8Encoding StrictUtf8 = new(
        encoderShouldEmitUTF8Identifier: false,
        throwOnInvalidBytes: true);

    public static byte[] EncodeInstallationRecordFile(CompanionInstallationRecord record)
    {
        ValidateInstallationRecord(record);
        using var stream = new MemoryStream(capacity: 128);
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            writer.WriteStartObject();
            writer.WriteString("schema", record.Schema);
            writer.WriteString("installationId", record.InstallationId);
            writer.WriteEndObject();
        }
        stream.WriteByte((byte)'\n');
        var bytes = stream.ToArray();
        if (bytes.Length > MaximumInstallationRecordBytes)
        {
            throw new CompanionProtocolException("installation-record-size");
        }
        return bytes;
    }

    public static CompanionInstallationRecord DecodeInstallationRecordFile(
        ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length is < 2 or > MaximumInstallationRecordBytes || bytes[^1] != (byte)'\n')
        {
            throw new CompanionProtocolException("installation-record-wire");
        }

        string text;
        try
        {
            text = StrictUtf8.GetString(bytes[..^1]);
        }
        catch (DecoderFallbackException)
        {
            throw new CompanionProtocolException("installation-record-wire");
        }

        CompanionInstallationRecord record;
        try
        {
            using var document = JsonDocument.Parse(text, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 16
            });
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new CompanionProtocolException("installation-record-wire");
            }
            var properties = document.RootElement.EnumerateObject().ToArray();
            if (properties.Length != 2 ||
                properties[0].Name != "schema" ||
                properties[1].Name != "installationId" ||
                properties[0].Value.ValueKind != JsonValueKind.String ||
                properties[1].Value.ValueKind != JsonValueKind.String)
            {
                throw new CompanionProtocolException("installation-record-wire");
            }
            record = new CompanionInstallationRecord(
                properties[0].Value.GetString()!,
                properties[1].Value.GetString()!);
        }
        catch (JsonException)
        {
            throw new CompanionProtocolException("installation-record-wire");
        }

        ValidateInstallationRecord(record);
        var canonical = EncodeInstallationRecordFile(record);
        if (!bytes.SequenceEqual(canonical))
        {
            throw new CompanionProtocolException("installation-record-canonical");
        }
        return record;
    }

    public static byte[] EncodePairingBeginRequest(CompanionPairingBeginRequest request)
    {
        ValidatePairingBeginRequest(request);
        return EncodeNetworkJson(
            MaximumPairingBeginRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("claimId", request.ClaimId);
                writer.WriteString("browserNonce", request.BrowserNonce);
                writer.WriteEndObject();
            });
    }

    public static CompanionPairingBeginRequest DecodePairingBeginRequest(
        ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumPairingBeginRequestBytes,
            ["schema", "claimId", "browserNonce"]);
        var request = new CompanionPairingBeginRequest(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]));
        ValidatePairingBeginRequest(request);
        RequireCanonical(bytes, EncodePairingBeginRequest(request));
        return request;
    }

    public static byte[] EncodePairingBeginResponse(CompanionPairingBeginResponse response)
    {
        ValidatePairingBeginResponse(response);
        return EncodeNetworkJson(
            MaximumPairingBeginResponseBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", response.Schema);
                writer.WriteString("protocolId", response.ProtocolId);
                writer.WriteString("installationId", response.InstallationId);
                writer.WriteString("processInstanceId", response.ProcessInstanceId);
                writer.WriteString("claimId", response.ClaimId);
                writer.WriteString("browserNonce", response.BrowserNonce);
                writer.WriteString("serverNonce", response.ServerNonce);
                writer.WriteString("sessionId", response.SessionId);
                writer.WriteNumber("keyEpoch", response.KeyEpoch);
                writer.WriteString("sessionExpiresAtUtc", response.SessionExpiresAtUtc);
                writer.WriteNumber("idleTimeoutSeconds", response.IdleTimeoutSeconds);
                writer.WriteString("pairingProof", response.PairingProof);
                writer.WriteEndObject();
            });
    }

    public static CompanionPairingBeginResponse DecodePairingBeginResponse(
        ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumPairingBeginResponseBytes,
            [
                "schema",
                "protocolId",
                "installationId",
                "processInstanceId",
                "claimId",
                "browserNonce",
                "serverNonce",
                "sessionId",
                "keyEpoch",
                "sessionExpiresAtUtc",
                "idleTimeoutSeconds",
                "pairingProof"
            ]);
        var response = new CompanionPairingBeginResponse(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireString(properties[3]),
            RequireString(properties[4]),
            RequireString(properties[5]),
            RequireString(properties[6]),
            RequireString(properties[7]),
            RequireUInt32(properties[8]),
            RequireString(properties[9]),
            RequireUInt32(properties[10]),
            RequireString(properties[11]));
        ValidatePairingBeginResponse(response);
        RequireCanonical(bytes, EncodePairingBeginResponse(response));
        return response;
    }

    public static byte[] EncodePairingCompleteRequest(CompanionPairingCompleteRequest request)
    {
        ValidatePairingCompleteRequest(request);
        return EncodeNetworkJson(
            MaximumPairingCompleteRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("claimId", request.ClaimId);
                writer.WriteString("browserNonce", request.BrowserNonce);
                writer.WriteString("serverNonce", request.ServerNonce);
                writer.WriteString("sessionId", request.SessionId);
                writer.WriteString("browserProof", request.BrowserProof);
                writer.WriteEndObject();
            });
    }

    public static CompanionPairingCompleteRequest DecodePairingCompleteRequest(
        ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumPairingCompleteRequestBytes,
            ["schema", "claimId", "browserNonce", "serverNonce", "sessionId", "browserProof"]);
        var request = new CompanionPairingCompleteRequest(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireString(properties[3]),
            RequireString(properties[4]),
            RequireString(properties[5]));
        ValidatePairingCompleteRequest(request);
        RequireCanonical(bytes, EncodePairingCompleteRequest(request));
        return request;
    }

    public static byte[] EncodePairingCompleteResponse(
        CompanionPairingCompleteResponse response)
    {
        ValidatePairingCompleteResponse(response);
        return EncodeNetworkJson(
            MaximumPairingCompleteResponseBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", response.Schema);
                writer.WriteString("protocolId", response.ProtocolId);
                writer.WriteString("installationId", response.InstallationId);
                writer.WriteString("processInstanceId", response.ProcessInstanceId);
                writer.WriteString("sessionId", response.SessionId);
                writer.WriteNumber("keyEpoch", response.KeyEpoch);
                writer.WriteString("sessionExpiresAtUtc", response.SessionExpiresAtUtc);
                writer.WriteNumber("idleTimeoutSeconds", response.IdleTimeoutSeconds);
                writer.WriteString("completionProof", response.CompletionProof);
                writer.WriteEndObject();
            });
    }

    public static CompanionPairingCompleteResponse DecodePairingCompleteResponse(
        ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumPairingCompleteResponseBytes,
            [
                "schema",
                "protocolId",
                "installationId",
                "processInstanceId",
                "sessionId",
                "keyEpoch",
                "sessionExpiresAtUtc",
                "idleTimeoutSeconds",
                "completionProof"
            ]);
        var response = new CompanionPairingCompleteResponse(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireString(properties[3]),
            RequireString(properties[4]),
            RequireUInt32(properties[5]),
            RequireString(properties[6]),
            RequireUInt32(properties[7]),
            RequireString(properties[8]));
        ValidatePairingCompleteResponse(response);
        RequireCanonical(bytes, EncodePairingCompleteResponse(response));
        return response;
    }

    public static byte[] EncodeSessionStatus(CompanionSessionStatus status)
    {
        ValidateSessionStatus(status);
        return EncodeNetworkJson(
            MaximumSessionStatusBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", status.Schema);
                writer.WriteString("protocolId", status.ProtocolId);
                writer.WriteString("installationId", status.InstallationId);
                writer.WriteString("processInstanceId", status.ProcessInstanceId);
                writer.WriteString("sessionId", status.SessionId);
                writer.WriteNumber("keyEpoch", status.KeyEpoch);
                writer.WriteNumber("acceptedSequence", status.AcceptedSequence);
                if (status.NextSequence is ulong nextSequence)
                {
                    writer.WriteNumber("nextSequence", nextSequence);
                }
                else
                {
                    writer.WriteNull("nextSequence");
                }
                writer.WriteString("sessionExpiresAtUtc", status.SessionExpiresAtUtc);
                writer.WriteString("keyExpiresAtUtc", status.KeyExpiresAtUtc);
                writer.WriteNumber("idleTimeoutSeconds", status.IdleTimeoutSeconds);
                writer.WriteEndObject();
            });
    }

    public static CompanionSessionStatus DecodeSessionStatus(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumSessionStatusBytes,
            [
                "schema",
                "protocolId",
                "installationId",
                "processInstanceId",
                "sessionId",
                "keyEpoch",
                "acceptedSequence",
                "nextSequence",
                "sessionExpiresAtUtc",
                "keyExpiresAtUtc",
                "idleTimeoutSeconds"
            ]);
        var status = new CompanionSessionStatus(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireString(properties[3]),
            RequireString(properties[4]),
            RequireUInt32(properties[5]),
            RequireUInt64(properties[6]),
            RequireNullableUInt64(properties[7]),
            RequireString(properties[8]),
            RequireString(properties[9]),
            RequireUInt32(properties[10]));
        ValidateSessionStatus(status);
        RequireCanonical(bytes, EncodeSessionStatus(status));
        return status;
    }

    public static byte[] EncodeRotationBegin(CompanionRotationBegin request)
    {
        ValidateRotationBegin(request);
        return EncodeNetworkJson(
            MaximumRotationBeginBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("rotationId", request.RotationId);
                writer.WriteString("browserNonce", request.BrowserNonce);
                writer.WriteEndObject();
            });
    }

    public static CompanionRotationBegin DecodeRotationBegin(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumRotationBeginBytes,
            ["schema", "rotationId", "browserNonce"]);
        var request = new CompanionRotationBegin(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]));
        ValidateRotationBegin(request);
        RequireCanonical(bytes, EncodeRotationBegin(request));
        return request;
    }

    public static byte[] EncodeRotationChallenge(CompanionRotationChallenge response)
    {
        ValidateRotationChallenge(response);
        return EncodeNetworkJson(
            MaximumRotationChallengeBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", response.Schema);
                writer.WriteString("rotationId", response.RotationId);
                writer.WriteString("browserNonce", response.BrowserNonce);
                writer.WriteString("serverNonce", response.ServerNonce);
                writer.WriteNumber("currentEpoch", response.CurrentEpoch);
                writer.WriteNumber("nextEpoch", response.NextEpoch);
                writer.WriteString("pendingExpiresAtUtc", response.PendingExpiresAtUtc);
                writer.WriteEndObject();
            });
    }

    public static CompanionRotationChallenge DecodeRotationChallenge(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumRotationChallengeBytes,
            [
                "schema",
                "rotationId",
                "browserNonce",
                "serverNonce",
                "currentEpoch",
                "nextEpoch",
                "pendingExpiresAtUtc"
            ]);
        var response = new CompanionRotationChallenge(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireString(properties[3]),
            RequireUInt32(properties[4]),
            RequireUInt32(properties[5]),
            RequireString(properties[6]));
        ValidateRotationChallenge(response);
        RequireCanonical(bytes, EncodeRotationChallenge(response));
        return response;
    }

    public static byte[] EncodeRotationCommit(CompanionRotationCommit request)
    {
        ValidateRotationCommit(request);
        return EncodeNetworkJson(
            MaximumRotationCommitBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("rotationId", request.RotationId);
                writer.WriteString("browserNonce", request.BrowserNonce);
                writer.WriteString("serverNonce", request.ServerNonce);
                writer.WriteNumber("currentEpoch", request.CurrentEpoch);
                writer.WriteNumber("nextEpoch", request.NextEpoch);
                writer.WriteString("newKeyProof", request.NewKeyProof);
                writer.WriteEndObject();
            });
    }

    public static CompanionRotationCommit DecodeRotationCommit(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumRotationCommitBytes,
            [
                "schema",
                "rotationId",
                "browserNonce",
                "serverNonce",
                "currentEpoch",
                "nextEpoch",
                "newKeyProof"
            ]);
        var request = new CompanionRotationCommit(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireString(properties[3]),
            RequireUInt32(properties[4]),
            RequireUInt32(properties[5]),
            RequireString(properties[6]));
        ValidateRotationCommit(request);
        RequireCanonical(bytes, EncodeRotationCommit(request));
        return request;
    }

    public static byte[] EncodeRotationCommitted(CompanionRotationCommitted response)
    {
        ValidateRotationCommitted(response);
        return EncodeNetworkJson(
            MaximumRotationCommittedBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", response.Schema);
                writer.WriteString("rotationId", response.RotationId);
                writer.WriteNumber("keyEpoch", response.KeyEpoch);
                writer.WriteString("keyExpiresAtUtc", response.KeyExpiresAtUtc);
                writer.WriteString("completionProof", response.CompletionProof);
                writer.WriteEndObject();
            });
    }

    public static CompanionRotationCommitted DecodeRotationCommitted(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumRotationCommittedBytes,
            ["schema", "rotationId", "keyEpoch", "keyExpiresAtUtc", "completionProof"]);
        var response = new CompanionRotationCommitted(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireUInt32(properties[2]),
            RequireString(properties[3]),
            RequireString(properties[4]));
        ValidateRotationCommitted(response);
        RequireCanonical(bytes, EncodeRotationCommitted(response));
        return response;
    }

    public static byte[] EncodeRevokeRequest(CompanionRevokeRequest request)
    {
        ValidateRevokeRequest(request);
        return EncodeNetworkJson(
            MaximumRevokeRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("revocationId", request.RevocationId);
                writer.WriteEndObject();
            });
    }

    public static CompanionRevokeRequest DecodeRevokeRequest(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumRevokeRequestBytes,
            ["schema", "revocationId"]);
        var request = new CompanionRevokeRequest(
            RequireString(properties[0]),
            RequireString(properties[1]));
        ValidateRevokeRequest(request);
        RequireCanonical(bytes, EncodeRevokeRequest(request));
        return request;
    }

    public static byte[] EncodeRevokedResponse(CompanionRevokedResponse response)
    {
        ValidateRevokedResponse(response);
        return EncodeNetworkJson(
            MaximumRevokedResponseBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", response.Schema);
                writer.WriteString("revocationId", response.RevocationId);
                writer.WriteBoolean("revoked", response.Revoked);
                writer.WriteEndObject();
            });
    }

    public static CompanionRevokedResponse DecodeRevokedResponse(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumRevokedResponseBytes,
            ["schema", "revocationId", "revoked"]);
        var response = new CompanionRevokedResponse(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireBoolean(properties[2]));
        ValidateRevokedResponse(response);
        RequireCanonical(bytes, EncodeRevokedResponse(response));
        return response;
    }

    public static byte[] EncodeError(CompanionLoopbackError error)
    {
        ValidateError(error);
        return EncodeNetworkJson(
            MaximumErrorResponseBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", error.Schema);
                writer.WriteString("code", error.Code);
                writer.WriteEndObject();
            });
    }

    public static CompanionLoopbackError DecodeError(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumErrorResponseBytes,
            ["schema", "code"]);
        var error = new CompanionLoopbackError(
            RequireString(properties[0]),
            RequireString(properties[1]));
        ValidateError(error);
        RequireCanonical(bytes, EncodeError(error));
        return error;
    }

    public static byte[] EncodeAcquireRequest(CompanionAcquireRequest request)
    {
        var normalized = CompanionContract.ValidateAndNormalize(request);
        return EncodeNetworkJson(
            MaximumAcquireRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", normalized.Schema);
                writer.WriteString("attemptId", normalized.AttemptId);
                writer.WriteString("route", AcquisitionRouteName(normalized.Route));
                writer.WriteString("modelId", normalized.ModelId);
                writer.WriteString("sourceRepository", normalized.SourceRepository);
                writer.WriteString("sourceRevision", normalized.SourceRevision);
                writer.WriteString("modelSourceLockSha256", normalized.ModelSourceLockSha256);
                writer.WriteString(
                    "tokenizerSourceLockSha256",
                    normalized.TokenizerSourceLockSha256);
                writer.WriteString(
                    "compositionProfileSha256",
                    normalized.CompositionProfileSha256);
                writer.WriteBoolean(
                    "sourceAcquisitionApproved",
                    normalized.SourceAcquisitionApproved);
                writer.WriteNumber("maximumSourceBytes", normalized.MaximumSourceBytes);
                writer.WriteEndObject();
            });
    }

    public static CompanionAcquireRequest DecodeAcquireRequest(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumAcquireRequestBytes,
            [
                "schema",
                "attemptId",
                "route",
                "modelId",
                "sourceRepository",
                "sourceRevision",
                "modelSourceLockSha256",
                "tokenizerSourceLockSha256",
                "compositionProfileSha256",
                "sourceAcquisitionApproved",
                "maximumSourceBytes"
            ]);
        var request = new CompanionAcquireRequest(
            RequireString(properties[0]),
            RequireString(properties[1]),
            ParseAcquisitionRoute(RequireString(properties[2])),
            RequireString(properties[3]),
            RequireString(properties[4]),
            RequireString(properties[5]),
            RequireString(properties[6]),
            RequireString(properties[7]),
            RequireString(properties[8]),
            RequireBoolean(properties[9]),
            RequireUInt64(properties[10]));
        CompanionAcquireRequest normalized;
        try
        {
            normalized = CompanionContract.ValidateAndNormalize(request);
        }
        catch (CompanionContractException)
        {
            throw new CompanionProtocolException("contract-invalid");
        }
        RequireCanonical(bytes, EncodeAcquireRequest(normalized));
        return normalized;
    }

    public static byte[] EncodeOperationProjection(CompanionOperationProjection projection)
    {
        ValidateOperationProjection(projection);
        return EncodeNetworkJson(
            MaximumOperationProjectionBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", projection.Schema);
                writer.WriteString("operationId", projection.OperationId);
                writer.WriteNumber("sequence", projection.Sequence);
                writer.WriteString("state", OperationStateName(projection.State));
                writer.WriteString("route", AcquisitionRouteName(projection.Route));
                writer.WriteNumber("phaseCompletedBytes", projection.PhaseCompletedBytes);
                if (projection.PhaseTotalBytes is ulong totalBytes)
                {
                    writer.WriteNumber("phaseTotalBytes", totalBytes);
                }
                else
                {
                    writer.WriteNull("phaseTotalBytes");
                }
                if (projection.Artifacts is null)
                {
                    writer.WriteNull("artifacts");
                }
                else
                {
                    WriteArtifactSet(writer, projection.Artifacts);
                }
                if (projection.ErrorCode is null)
                {
                    writer.WriteNull("errorCode");
                }
                else
                {
                    writer.WriteString("errorCode", projection.ErrorCode);
                }
                writer.WriteEndObject();
            });
    }

    public static CompanionOperationProjection DecodeOperationProjection(
        ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumOperationProjectionBytes,
            [
                "schema",
                "operationId",
                "sequence",
                "state",
                "route",
                "phaseCompletedBytes",
                "phaseTotalBytes",
                "artifacts",
                "errorCode"
            ]);
        var projection = new CompanionOperationProjection(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireUInt64(properties[2]),
            ParseOperationState(RequireString(properties[3])),
            ParseAcquisitionRoute(RequireString(properties[4])),
            RequireUInt64(properties[5]),
            RequireNullableUInt64(properties[6]),
            properties[7].ValueKind == JsonValueKind.Null
                ? null
                : ParseArtifactSet(properties[7]),
            RequireNullableString(properties[8]));
        ValidateOperationProjection(projection);
        RequireCanonical(bytes, EncodeOperationProjection(projection));
        return projection;
    }

    public static byte[] EncodeCancelRequest(CompanionCancelRequest request)
    {
        ValidateCancelRequest(request);
        return EncodeNetworkJson(
            MaximumCancelRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("cancellationId", request.CancellationId);
                writer.WriteEndObject();
            });
    }

    public static CompanionCancelRequest DecodeCancelRequest(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumCancelRequestBytes,
            ["schema", "cancellationId"]);
        var request = new CompanionCancelRequest(
            RequireString(properties[0]),
            RequireString(properties[1]));
        ValidateCancelRequest(request);
        RequireCanonical(bytes, EncodeCancelRequest(request));
        return request;
    }

    public static byte[] EncodeDirectCompositionSeedStartRequest(
        CompanionDirectCompositionSeedStartRequest request)
    {
        ValidateDirectCompositionSeedStartRequest(request);
        return EncodeNetworkJson(
            MaximumDirectCompositionSeedStartRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteString("operationId", request.OperationId);
                writer.WriteEndObject();
            });
    }

    public static CompanionDirectCompositionSeedStartRequest
        DecodeDirectCompositionSeedStartRequest(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumDirectCompositionSeedStartRequestBytes,
            ["schema", "operationId"]);
        var request = new CompanionDirectCompositionSeedStartRequest(
            RequireString(properties[0]),
            RequireString(properties[1]));
        ValidateDirectCompositionSeedStartRequest(request);
        RequireCanonical(bytes, EncodeDirectCompositionSeedStartRequest(request));
        return request;
    }

    public static byte[] EncodeDirectCompositionSeedStopRequest(
        CompanionDirectCompositionSeedStopRequest request)
    {
        ValidateDirectCompositionSeedStopRequest(request);
        return EncodeNetworkJson(
            MaximumDirectCompositionSeedStopRequestBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", request.Schema);
                writer.WriteEndObject();
            });
    }

    public static CompanionDirectCompositionSeedStopRequest
        DecodeDirectCompositionSeedStopRequest(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumDirectCompositionSeedStopRequestBytes,
            ["schema"]);
        var request = new CompanionDirectCompositionSeedStopRequest(
            RequireString(properties[0]));
        ValidateDirectCompositionSeedStopRequest(request);
        RequireCanonical(bytes, EncodeDirectCompositionSeedStopRequest(request));
        return request;
    }

    public static byte[] EncodeDirectCompositionSeedProjection(
        CompanionDirectCompositionSeedProjection projection)
    {
        ValidateDirectCompositionSeedProjection(projection);
        return EncodeNetworkJson(
            MaximumDirectCompositionSeedProjectionBytes,
            writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("schema", projection.Schema);
                writer.WriteString("operationId", projection.OperationId);
                writer.WriteNumber("sequence", projection.Sequence);
                writer.WriteString(
                    "state",
                    DirectCompositionSeedStateName(projection.State));
                writer.WriteString("compositionId", projection.CompositionId);
                WriteNullableString(writer, "protocol", projection.Protocol);
                WriteNullableString(writer, "boundOrigin", projection.BoundOrigin);
                WriteNullableString(
                    writer,
                    "allowedBrowserOrigin",
                    projection.AllowedBrowserOrigin);
                WriteNullableString(writer, "terminalCode", projection.TerminalCode);
                writer.WriteEndObject();
            });
    }

    public static CompanionDirectCompositionSeedProjection
        DecodeDirectCompositionSeedProjection(ReadOnlySpan<byte> bytes)
    {
        var properties = ParseNetworkObject(
            bytes,
            MaximumDirectCompositionSeedProjectionBytes,
            [
                "schema",
                "operationId",
                "sequence",
                "state",
                "compositionId",
                "protocol",
                "boundOrigin",
                "allowedBrowserOrigin",
                "terminalCode"
            ]);
        var projection = new CompanionDirectCompositionSeedProjection(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireUInt64(properties[2]),
            ParseDirectCompositionSeedState(RequireString(properties[3])),
            RequireString(properties[4]),
            RequireNullableString(properties[5]),
            RequireNullableString(properties[6]),
            RequireNullableString(properties[7]),
            RequireNullableString(properties[8]));
        ValidateDirectCompositionSeedProjection(projection);
        RequireCanonical(bytes, EncodeDirectCompositionSeedProjection(projection));
        return projection;
    }

    private static void ValidateInstallationRecord(CompanionInstallationRecord record)
    {
        ArgumentNullException.ThrowIfNull(record);
        if (record.Schema != InstallationSchema)
        {
            throw new CompanionProtocolException("installation-record-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(
            record.InstallationId,
            16,
            "installation-record-id");
    }

    private static void ValidatePairingBeginRequest(CompanionPairingBeginRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != PairingBeginRequestSchema)
        {
            throw new CompanionProtocolException("pairing-begin-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(request.ClaimId, 16, "pairing-claim-id");
        CompanionLoopbackProtocol.RequireNonce(request.BrowserNonce, "pairing-browser-nonce");
    }

    private static void ValidatePairingBeginResponse(CompanionPairingBeginResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.Schema != PairingBeginResponseSchema ||
            response.ProtocolId != CompanionLoopbackProtocol.ProtocolId)
        {
            throw new CompanionProtocolException("pairing-begin-response-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(
            response.InstallationId,
            16,
            "pairing-installation-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(
            response.ProcessInstanceId,
            16,
            "pairing-process-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(response.ClaimId, 16, "pairing-claim-id");
        CompanionLoopbackProtocol.RequireNonce(response.BrowserNonce, "pairing-browser-nonce");
        CompanionLoopbackProtocol.RequireNonce(response.ServerNonce, "pairing-server-nonce");
        CompanionLoopbackProtocol.RequireHexIdentifier(response.SessionId, 16, "pairing-session-id");
        if (response.KeyEpoch != 1 || response.IdleTimeoutSeconds != 900)
        {
            throw new CompanionProtocolException("pairing-begin-response-contract");
        }
        CompanionLoopbackProtocol.RequireTimestamp(
            response.SessionExpiresAtUtc,
            "pairing-session-expiry");
        RequireProof(response.PairingProof, "pairing-server-proof");
    }

    private static void ValidatePairingCompleteRequest(CompanionPairingCompleteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != PairingCompleteRequestSchema)
        {
            throw new CompanionProtocolException("pairing-complete-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(request.ClaimId, 16, "pairing-claim-id");
        CompanionLoopbackProtocol.RequireNonce(request.BrowserNonce, "pairing-browser-nonce");
        CompanionLoopbackProtocol.RequireNonce(request.ServerNonce, "pairing-server-nonce");
        CompanionLoopbackProtocol.RequireHexIdentifier(request.SessionId, 16, "pairing-session-id");
        RequireProof(request.BrowserProof, "pairing-browser-proof");
    }

    private static void ValidatePairingCompleteResponse(CompanionPairingCompleteResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.Schema != PairingCompleteResponseSchema ||
            response.ProtocolId != CompanionLoopbackProtocol.ProtocolId)
        {
            throw new CompanionProtocolException("pairing-complete-response-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(
            response.InstallationId,
            16,
            "pairing-installation-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(
            response.ProcessInstanceId,
            16,
            "pairing-process-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(response.SessionId, 16, "pairing-session-id");
        if (response.KeyEpoch != 1 || response.IdleTimeoutSeconds != 900)
        {
            throw new CompanionProtocolException("pairing-complete-response-contract");
        }
        CompanionLoopbackProtocol.RequireTimestamp(
            response.SessionExpiresAtUtc,
            "pairing-session-expiry");
        RequireProof(response.CompletionProof, "pairing-completion-proof");
    }

    private static void ValidateSessionStatus(CompanionSessionStatus status)
    {
        ArgumentNullException.ThrowIfNull(status);
        if (status.Schema != SessionStatusSchema ||
            status.ProtocolId != CompanionLoopbackProtocol.ProtocolId)
        {
            throw new CompanionProtocolException("session-status-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(
            status.InstallationId,
            16,
            "session-installation-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(
            status.ProcessInstanceId,
            16,
            "session-process-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(status.SessionId, 16, "session-id");
        var expectedNextSequence = status.AcceptedSequence < 1_000_000
            ? status.AcceptedSequence + 1
            : (ulong?)null;
        if (status.KeyEpoch is 0 or > 64 ||
            status.AcceptedSequence is 0 or > 1_000_000 ||
            status.NextSequence != expectedNextSequence ||
            status.IdleTimeoutSeconds != 900)
        {
            throw new CompanionProtocolException("session-status-contract");
        }
        CompanionLoopbackProtocol.RequireTimestamp(
            status.SessionExpiresAtUtc,
            "session-status-expiry");
        CompanionLoopbackProtocol.RequireTimestamp(
            status.KeyExpiresAtUtc,
            "session-status-key-expiry");
    }

    private static void ValidateRotationBegin(CompanionRotationBegin request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != RotationBeginSchema)
        {
            throw new CompanionProtocolException("rotation-begin-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(request.RotationId, 16, "rotation-id");
        CompanionLoopbackProtocol.RequireNonce(request.BrowserNonce, "rotation-browser-nonce");
    }

    private static void ValidateRotationChallenge(CompanionRotationChallenge response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.Schema != RotationChallengeSchema)
        {
            throw new CompanionProtocolException("rotation-challenge-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(response.RotationId, 16, "rotation-id");
        CompanionLoopbackProtocol.RequireNonce(response.BrowserNonce, "rotation-browser-nonce");
        CompanionLoopbackProtocol.RequireNonce(response.ServerNonce, "rotation-server-nonce");
        RequireEpochPair(response.CurrentEpoch, response.NextEpoch);
        CompanionLoopbackProtocol.RequireTimestamp(
            response.PendingExpiresAtUtc,
            "rotation-pending-expiry");
    }

    private static void ValidateRotationCommit(CompanionRotationCommit request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != RotationCommitSchema)
        {
            throw new CompanionProtocolException("rotation-commit-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(request.RotationId, 16, "rotation-id");
        CompanionLoopbackProtocol.RequireNonce(request.BrowserNonce, "rotation-browser-nonce");
        CompanionLoopbackProtocol.RequireNonce(request.ServerNonce, "rotation-server-nonce");
        RequireEpochPair(request.CurrentEpoch, request.NextEpoch);
        RequireProof(request.NewKeyProof, "rotation-new-key-proof");
    }

    private static void ValidateRotationCommitted(CompanionRotationCommitted response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.Schema != RotationCommittedSchema)
        {
            throw new CompanionProtocolException("rotation-committed-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(response.RotationId, 16, "rotation-id");
        if (response.KeyEpoch is 0 or > 64)
        {
            throw new CompanionProtocolException("rotation-committed-epoch");
        }
        CompanionLoopbackProtocol.RequireTimestamp(
            response.KeyExpiresAtUtc,
            "rotation-key-expiry");
        RequireProof(response.CompletionProof, "rotation-completion-proof");
    }

    private static void ValidateRevokeRequest(CompanionRevokeRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != RevokeRequestSchema)
        {
            throw new CompanionProtocolException("revoke-request-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(request.RevocationId, 16, "revocation-id");
    }

    private static void ValidateRevokedResponse(CompanionRevokedResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.Schema != RevokedResponseSchema || !response.Revoked)
        {
            throw new CompanionProtocolException("revoked-response-contract");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(response.RevocationId, 16, "revocation-id");
    }

    private static void ValidateError(CompanionLoopbackError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        if (error.Schema != ErrorSchema || !StableErrorCodes.Contains(error.Code))
        {
            throw new CompanionProtocolException("contract-invalid");
        }
    }

    private static void ValidateOperationProjection(CompanionOperationProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        if (projection.Schema != OperationProjectionSchema)
        {
            throw new CompanionProtocolException("operation-projection-schema");
        }
        try
        {
            CompanionContract.RequireDigest(projection.OperationId, "operation-id");
        }
        catch (CompanionContractException)
        {
            throw new CompanionProtocolException("operation-id");
        }
        if (projection.Sequence > MaximumJsonSafeInteger)
        {
            throw new CompanionProtocolException("operation-sequence");
        }
        _ = OperationStateName(projection.State);
        _ = AcquisitionRouteName(projection.Route);
        if (projection.PhaseCompletedBytes > CompanionContract.MaximumProgressBytes ||
            projection.PhaseTotalBytes > CompanionContract.MaximumProgressBytes ||
            projection.PhaseTotalBytes is ulong total &&
                (total == 0 || projection.PhaseCompletedBytes > total))
        {
            throw new CompanionProtocolException("operation-progress");
        }
        if (projection.Artifacts is not null)
        {
            try
            {
                CompanionContract.ValidateArtifactSet(projection.Artifacts);
            }
            catch (CompanionContractException exception)
            {
                throw new CompanionProtocolException(exception.Code == "artifact-total"
                    ? "operation-artifact-total"
                    : $"operation-{exception.Code}");
            }
        }
        if (projection.ErrorCode is not null && !IsWireErrorCode(projection.ErrorCode))
        {
            throw new CompanionProtocolException("operation-error-code");
        }
        if (projection.State == CompanionOperationState.Available)
        {
            if (projection.Artifacts is null ||
                projection.ErrorCode is not null)
            {
                throw new CompanionProtocolException("operation-available-fields");
            }
        }
        else if (projection.Artifacts is not null)
        {
            throw new CompanionProtocolException("operation-artifacts-premature");
        }
        if ((projection.State == CompanionOperationState.Rejected) !=
            (projection.ErrorCode is not null))
        {
            throw new CompanionProtocolException("operation-error-fields");
        }
    }

    private static void ValidateCancelRequest(CompanionCancelRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != CancelRequestSchema)
        {
            throw new CompanionProtocolException("cancel-request-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(
            request.CancellationId,
            16,
            "cancellation-id");
    }

    private static void ValidateDirectCompositionSeedStartRequest(
        CompanionDirectCompositionSeedStartRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != DirectCompositionSeedStartRequestSchema)
        {
            throw new CompanionProtocolException("contract-invalid");
        }
        try
        {
            CompanionContract.RequireDigest(
                request.OperationId,
                "direct-composition-seed-operation-id");
        }
        catch (CompanionContractException)
        {
            throw new CompanionProtocolException("contract-invalid");
        }
    }

    private static void ValidateDirectCompositionSeedStopRequest(
        CompanionDirectCompositionSeedStopRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != DirectCompositionSeedStopRequestSchema)
        {
            throw new CompanionProtocolException("contract-invalid");
        }
    }

    private static void ValidateDirectCompositionSeedProjection(
        CompanionDirectCompositionSeedProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        if (projection.Schema != DirectCompositionSeedProjectionSchema ||
            projection.Sequence is 0 or > MaximumJsonSafeInteger)
        {
            throw new CompanionProtocolException("contract-invalid");
        }
        try
        {
            CompanionContract.RequireDigest(
                projection.OperationId,
                "direct-composition-seed-operation-id");
            CompanionContract.RequireContentId(
                projection.CompositionId,
                "direct-composition-seed-composition-id");
        }
        catch (CompanionContractException)
        {
            throw new CompanionProtocolException("contract-invalid");
        }

        _ = DirectCompositionSeedStateName(projection.State);
        if (projection.State == CompanionDirectCompositionSeedState.Ready)
        {
            if (projection.Protocol != CompanionDirectCompositionSeedLauncher.Protocol ||
                projection.BoundOrigin is null ||
                !IsDirectCompositionSeedBoundOrigin(projection.BoundOrigin) ||
                projection.AllowedBrowserOrigin != CompanionLoopbackProtocol.ProductionOrigin ||
                projection.TerminalCode is not null)
            {
                throw new CompanionProtocolException("contract-invalid");
            }
            return;
        }

        if (projection.Protocol is not null ||
            projection.BoundOrigin is not null ||
            projection.AllowedBrowserOrigin is not null ||
            projection.TerminalCode is null ||
            !IsWireErrorCode(projection.TerminalCode))
        {
            throw new CompanionProtocolException("contract-invalid");
        }
    }

    private static bool IsDirectCompositionSeedBoundOrigin(string value)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            uri.Scheme == Uri.UriSchemeHttp &&
            uri.Host == "127.0.0.1" &&
            uri.Port is >= 1_024 and <= 65_535 &&
            !uri.IsDefaultPort &&
            string.IsNullOrEmpty(uri.UserInfo) &&
            uri.AbsolutePath == "/" &&
            string.IsNullOrEmpty(uri.Query) &&
            string.IsNullOrEmpty(uri.Fragment) &&
            value == $"http://127.0.0.1:{uri.Port}";
    }

    private static void WriteNullableString(
        Utf8JsonWriter writer,
        string propertyName,
        string? value)
    {
        if (value is null)
        {
            writer.WriteNull(propertyName);
        }
        else
        {
            writer.WriteString(propertyName, value);
        }
    }

    private static void WriteArtifactSet(Utf8JsonWriter writer, CompanionArtifactSet artifacts)
    {
        writer.WriteStartObject("artifacts");
        WriteArtifact(writer, "composition", artifacts.Composition);
        WriteArtifact(writer, "model", artifacts.Model);
        WriteArtifact(writer, "tokenizer", artifacts.Tokenizer);
        WriteArtifact(writer, "template", artifacts.Template);
        WriteArtifact(writer, "sampling", artifacts.Sampling);
        WriteArtifact(writer, "prompt", artifacts.Prompt);
        writer.WriteEndObject();
    }

    private static void WriteArtifact(
        Utf8JsonWriter writer,
        string role,
        CompanionArtifact artifact)
    {
        writer.WriteStartObject(role);
        writer.WriteString("kind", artifact.Kind);
        writer.WriteString("artifactId", artifact.ArtifactId);
        writer.WriteString("sha256", artifact.Sha256);
        writer.WriteNumber("byteCount", artifact.ByteCount);
        writer.WriteEndObject();
    }

    private static CompanionArtifactSet ParseArtifactSet(JsonElement value)
    {
        var roles = ParseObject(
            value,
            ["composition", "model", "tokenizer", "template", "sampling", "prompt"]);
        return new CompanionArtifactSet(
            ParseArtifact(roles[0]),
            ParseArtifact(roles[1]),
            ParseArtifact(roles[2]),
            ParseArtifact(roles[3]),
            ParseArtifact(roles[4]),
            ParseArtifact(roles[5]));
    }

    private static CompanionArtifact ParseArtifact(JsonElement value)
    {
        var properties = ParseObject(value, ["kind", "artifactId", "sha256", "byteCount"]);
        return new CompanionArtifact(
            RequireString(properties[0]),
            RequireString(properties[1]),
            RequireString(properties[2]),
            RequireUInt64(properties[3]));
    }

    private static string OperationStateName(CompanionOperationState value) => value switch
    {
        CompanionOperationState.Queued => "queued",
        CompanionOperationState.AcquiringSource => "acquiring-source",
        CompanionOperationState.Converting => "converting",
        CompanionOperationState.VerifyingComposition => "verifying-composition",
        CompanionOperationState.Available => "available",
        CompanionOperationState.Cancelled => "cancelled",
        CompanionOperationState.Rejected => "rejected",
        _ => throw new CompanionProtocolException("operation-state")
    };

    private static CompanionOperationState ParseOperationState(string value) => value switch
    {
        "queued" => CompanionOperationState.Queued,
        "acquiring-source" => CompanionOperationState.AcquiringSource,
        "converting" => CompanionOperationState.Converting,
        "verifying-composition" => CompanionOperationState.VerifyingComposition,
        "available" => CompanionOperationState.Available,
        "cancelled" => CompanionOperationState.Cancelled,
        "rejected" => CompanionOperationState.Rejected,
        _ => throw new CompanionProtocolException("operation-state")
    };

    private static string DirectCompositionSeedStateName(
        CompanionDirectCompositionSeedState value) => value switch
    {
        CompanionDirectCompositionSeedState.Ready => "ready",
        CompanionDirectCompositionSeedState.Stopped => "stopped",
        CompanionDirectCompositionSeedState.Failed => "failed",
        _ => throw new CompanionProtocolException("contract-invalid")
    };

    private static CompanionDirectCompositionSeedState ParseDirectCompositionSeedState(
        string value) => value switch
    {
        "ready" => CompanionDirectCompositionSeedState.Ready,
        "stopped" => CompanionDirectCompositionSeedState.Stopped,
        "failed" => CompanionDirectCompositionSeedState.Failed,
        _ => throw new CompanionProtocolException("contract-invalid")
    };

    private static string AcquisitionRouteName(CompanionAcquisitionRoute value) => value switch
    {
        CompanionAcquisitionRoute.Source => "source",
        _ => throw new CompanionProtocolException("operation-route")
    };

    private static CompanionAcquisitionRoute ParseAcquisitionRoute(string value) => value switch
    {
        "source" => CompanionAcquisitionRoute.Source,
        _ => throw new CompanionProtocolException("operation-route")
    };

    private static bool IsWireErrorCode(string value) =>
        value.Length is >= 3 and <= 64 &&
        value[0] is >= 'a' and <= 'z' &&
        value.All(character => character is (>= 'a' and <= 'z') or
            (>= '0' and <= '9') or '-');

    private static void RequireEpochPair(uint currentEpoch, uint nextEpoch)
    {
        if (currentEpoch is 0 or >= 64 || nextEpoch != currentEpoch + 1)
        {
            throw new CompanionProtocolException("rotation-epoch-order");
        }
    }

    private static byte[] EncodeNetworkJson(int maximumBytes, Action<Utf8JsonWriter> write)
    {
        using var stream = new MemoryStream(capacity: 512);
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            write(writer);
        }
        var bytes = stream.ToArray();
        if (bytes.Length == 0 || bytes.Length > maximumBytes)
        {
            throw new CompanionProtocolException("json-size");
        }
        return bytes;
    }

    private static JsonElement[] ParseNetworkObject(
        ReadOnlySpan<byte> bytes,
        int maximumBytes,
        IReadOnlyList<string> names)
    {
        if (bytes.Length == 0 || bytes.Length > maximumBytes)
        {
            throw new CompanionProtocolException("json-invalid");
        }
        try
        {
            using var document = JsonDocument.Parse(bytes.ToArray(), new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 16
            });
            return ParseObject(document.RootElement, names);
        }
        catch (JsonException)
        {
            throw new CompanionProtocolException("json-invalid");
        }
    }

    private static JsonElement[] ParseObject(
        JsonElement value,
        IReadOnlyList<string> names)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            throw new CompanionProtocolException("json-invalid");
        }
        var properties = value.EnumerateObject().ToArray();
        if (properties.Length != names.Count)
        {
            throw new CompanionProtocolException("json-invalid");
        }
        for (var index = 0; index < names.Count; index++)
        {
            if (!string.Equals(properties[index].Name, names[index], StringComparison.Ordinal))
            {
                throw new CompanionProtocolException("json-invalid");
            }
        }
        return properties.Select(property => property.Value.Clone()).ToArray();
    }

    private static string RequireString(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.String)
        {
            throw new CompanionProtocolException("json-invalid");
        }
        return value.GetString()!;
    }

    private static uint RequireUInt32(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Number ||
            !value.TryGetUInt32(out var result))
        {
            throw new CompanionProtocolException("json-invalid");
        }
        return result;
    }

    private static ulong RequireUInt64(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Number ||
            !value.TryGetUInt64(out var result))
        {
            throw new CompanionProtocolException("json-invalid");
        }
        return result;
    }

    private static ulong? RequireNullableUInt64(JsonElement value) =>
        value.ValueKind == JsonValueKind.Null
            ? null
            : RequireUInt64(value);

    private static string? RequireNullableString(JsonElement value) =>
        value.ValueKind == JsonValueKind.Null
            ? null
            : RequireString(value);

    private static bool RequireBoolean(JsonElement value)
    {
        if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            throw new CompanionProtocolException("json-invalid");
        }
        return value.GetBoolean();
    }

    private static void RequireCanonical(ReadOnlySpan<byte> actual, ReadOnlySpan<byte> canonical)
    {
        if (!actual.SequenceEqual(canonical))
        {
            throw new CompanionProtocolException("json-invalid");
        }
    }

    private static void RequireProof(string value, string code)
    {
        var decoded = CompanionLoopbackProtocol.DecodeBase64Url32(value, code);
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(decoded);
    }
}

public sealed record CompanionInstallationRecord(string Schema, string InstallationId);

public sealed record CompanionPairingBeginRequest(
    string Schema,
    string ClaimId,
    string BrowserNonce);

public sealed record CompanionPairingBeginResponse(
    string Schema,
    string ProtocolId,
    string InstallationId,
    string ProcessInstanceId,
    string ClaimId,
    string BrowserNonce,
    string ServerNonce,
    string SessionId,
    uint KeyEpoch,
    string SessionExpiresAtUtc,
    uint IdleTimeoutSeconds,
    string PairingProof);

public sealed record CompanionPairingCompleteRequest(
    string Schema,
    string ClaimId,
    string BrowserNonce,
    string ServerNonce,
    string SessionId,
    string BrowserProof);

public sealed record CompanionPairingCompleteResponse(
    string Schema,
    string ProtocolId,
    string InstallationId,
    string ProcessInstanceId,
    string SessionId,
    uint KeyEpoch,
    string SessionExpiresAtUtc,
    uint IdleTimeoutSeconds,
    string CompletionProof);

public sealed record CompanionSessionStatus(
    string Schema,
    string ProtocolId,
    string InstallationId,
    string ProcessInstanceId,
    string SessionId,
    uint KeyEpoch,
    ulong AcceptedSequence,
    ulong? NextSequence,
    string SessionExpiresAtUtc,
    string KeyExpiresAtUtc,
    uint IdleTimeoutSeconds);

public sealed record CompanionRotationBegin(
    string Schema,
    string RotationId,
    string BrowserNonce);

public sealed record CompanionRotationChallenge(
    string Schema,
    string RotationId,
    string BrowserNonce,
    string ServerNonce,
    uint CurrentEpoch,
    uint NextEpoch,
    string PendingExpiresAtUtc);

public sealed record CompanionRotationCommit(
    string Schema,
    string RotationId,
    string BrowserNonce,
    string ServerNonce,
    uint CurrentEpoch,
    uint NextEpoch,
    string NewKeyProof);

public sealed record CompanionRotationCommitted(
    string Schema,
    string RotationId,
    uint KeyEpoch,
    string KeyExpiresAtUtc,
    string CompletionProof);

public sealed record CompanionRevokeRequest(string Schema, string RevocationId);

public sealed record CompanionRevokedResponse(
    string Schema,
    string RevocationId,
    bool Revoked);

public sealed record CompanionLoopbackError(string Schema, string Code);

public sealed record CompanionDirectCompositionSeedStartRequest(
    string Schema,
    string OperationId);

public sealed record CompanionDirectCompositionSeedStopRequest(string Schema);

public sealed record CompanionDirectCompositionSeedProjection(
    string Schema,
    string OperationId,
    ulong Sequence,
    CompanionDirectCompositionSeedState State,
    string CompositionId,
    string? Protocol,
    string? BoundOrigin,
    string? AllowedBrowserOrigin,
    string? TerminalCode);
