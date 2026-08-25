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
    public const int MaximumInstallationRecordBytes = 4_096;
    public const int MaximumPairingBeginRequestBytes = 2_048;
    public const int MaximumPairingBeginResponseBytes = 4_096;
    public const int MaximumPairingCompleteRequestBytes = 4_096;
    public const int MaximumPairingCompleteResponseBytes = 4_096;

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
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new CompanionProtocolException("json-invalid");
            }
            var properties = document.RootElement.EnumerateObject().ToArray();
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
        catch (JsonException)
        {
            throw new CompanionProtocolException("json-invalid");
        }
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
