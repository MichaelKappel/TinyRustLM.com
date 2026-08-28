using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace TinyRustLM.Companion;

public static partial class CompanionLoopbackProtocol
{
    public const string ProtocolId = "tinyrustlm.companion.loopback-capability/4";
    public const string ProductionOrigin = "https://tinyrustlm.com";
    public const string PairingServerProofDomain =
        "TinyRustLM companion pairing server proof 1";
    public const string PairingBrowserProofDomain =
        "TinyRustLM companion pairing browser proof 1";
    public const string PairingCompletionProofDomain =
        "TinyRustLM companion pairing completion proof 1";
    public const string SessionSaltDomain =
        "TinyRustLM companion session capability salt 1";
    public const string SessionKeyDomain =
        "TinyRustLM companion session capability key 1";
    public const string RequestProofDomain =
        "TinyRustLM companion request proof 1";
    public const string ResponseProofDomain =
        "TinyRustLM companion response proof 1";
    public const string RotationSaltDomain =
        "TinyRustLM companion rotated session salt 1";
    public const string RotationKeyDomain =
        "TinyRustLM companion rotated session key 1";
    public const string RotationNewKeyProofDomain =
        "TinyRustLM companion rotation new key proof 1";
    public const string RotationCompletionProofDomain =
        "TinyRustLM companion rotation completion proof 1";
    public const string ArtifactMetadataDomain =
        "TinyRustLM companion artifact response metadata 1";
    public const string EmptySha256 =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    public const int KeyBytes = 32;
    public const int MaximumTranscriptFields = 32;
    public const int MaximumTranscriptFieldBytes = 65_536;
    public const int MaximumTranscriptBytes = 131_072;

    private static readonly UTF8Encoding StrictUtf8 = new(
        encoderShouldEmitUTF8Identifier: false,
        throwOnInvalidBytes: true);

    public static byte[] EncodeTranscript(params string[] fields) =>
        EncodeTranscript((IReadOnlyList<string>)fields);

    public static byte[] EncodeTranscript(IReadOnlyList<string> fields)
    {
        ArgumentNullException.ThrowIfNull(fields);
        if (fields.Count is < 1 or > MaximumTranscriptFields)
        {
            throw new CompanionProtocolException("transcript-field-count");
        }

        var encoded = new byte[fields.Count][];
        var total = 0;
        try
        {
            for (var index = 0; index < fields.Count; index++)
            {
                if (fields[index] is null)
                {
                    throw new CompanionProtocolException("transcript-field-null");
                }
                try
                {
                    encoded[index] = StrictUtf8.GetBytes(fields[index]);
                }
                catch (EncoderFallbackException)
                {
                    throw new CompanionProtocolException("transcript-field-utf8");
                }
                if (encoded[index].Length > MaximumTranscriptFieldBytes)
                {
                    throw new CompanionProtocolException("transcript-field-size");
                }
                total = checked(total + sizeof(uint) + encoded[index].Length);
                if (total > MaximumTranscriptBytes)
                {
                    throw new CompanionProtocolException("transcript-size");
                }
            }
        }
        catch (OverflowException)
        {
            throw new CompanionProtocolException("transcript-size");
        }

        var result = GC.AllocateUninitializedArray<byte>(total);
        var offset = 0;
        foreach (var field in encoded)
        {
            BinaryPrimitives.WriteUInt32BigEndian(
                result.AsSpan(offset, sizeof(uint)),
                checked((uint)field.Length));
            offset += sizeof(uint);
            field.CopyTo(result, offset);
            offset += field.Length;
        }
        return result;
    }

    public static string Sha256Hex(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    public static string EncodeBase64Url(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length == 0)
        {
            throw new CompanionProtocolException("base64url-empty");
        }
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static byte[] DecodeBase64Url32(string value, string code)
    {
        if (value is null || !Base64Url32Pattern().IsMatch(value))
        {
            throw new CompanionProtocolException(code);
        }
        try
        {
            var decoded = Convert.FromBase64String(
                value.Replace('-', '+').Replace('_', '/') + "=");
            if (decoded.Length != KeyBytes ||
                !string.Equals(EncodeBase64Url(decoded), value, StringComparison.Ordinal))
            {
                throw new CompanionProtocolException(code);
            }
            return decoded;
        }
        catch (FormatException)
        {
            throw new CompanionProtocolException(code);
        }
    }

    public static string ComputePairingServerProof(
        ReadOnlySpan<byte> pairingSecret,
        CompanionPairingProofContext context) =>
        Proof(pairingSecret, PairingFields(PairingServerProofDomain, context));

    public static byte[] DeriveSessionKey(
        ReadOnlySpan<byte> pairingSecret,
        CompanionPairingProofContext context)
    {
        RequireKey(pairingSecret, "pairing-secret");
        ValidatePairingContext(context);
        var saltTranscript = EncodeTranscript(PairingFields(SessionSaltDomain, context, false));
        var salt = SHA256.HashData(saltTranscript);
        var info = EncodeTranscript(PairingFields(SessionKeyDomain, context));
        return HkdfSha256(pairingSecret, salt, info);
    }

    public static string ComputePairingBrowserProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionPairingProofContext context) =>
        Proof(sessionKey, PairingFields(PairingBrowserProofDomain, context));

    public static string ComputePairingCompletionProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionPairingProofContext context,
        string completeRequestSha256)
    {
        RequireSha256(completeRequestSha256, "pairing-complete-request-sha256");
        return Proof(
            sessionKey,
            PairingFields(PairingCompletionProofDomain, context)
                .Append(completeRequestSha256)
                .ToArray());
    }

    public static string ComputeRequestProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionRequestProofContext context)
    {
        ValidateRequestContext(context);
        return Proof(sessionKey,
        [
            RequestProofDomain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            Decimal(context.KeyEpoch),
            Decimal(context.Sequence),
            context.Method,
            context.Host,
            context.Origin,
            context.Path,
            context.ContentType,
            Decimal(context.ContentLength),
            context.ContentSha256
        ]);
    }

    public static string ComputeResponseProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionResponseProofContext context)
    {
        ValidateResponseContext(context);
        return Proof(sessionKey,
        [
            ResponseProofDomain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            Decimal(context.KeyEpoch),
            Decimal(context.Sequence),
            context.RequestMethod,
            context.RequestPath,
            Decimal(context.Status),
            context.ContentType,
            Decimal(context.ContentLength),
            context.ResponseMetadataSha256,
            context.ContentSha256
        ]);
    }

    public static byte[] DeriveRotatedSessionKey(
        ReadOnlySpan<byte> currentSessionKey,
        CompanionRotationProofContext context)
    {
        RequireKey(currentSessionKey, "rotation-current-key");
        ValidateRotationContext(context);
        var saltTranscript = EncodeTranscript(RotationFields(RotationSaltDomain, context));
        var salt = SHA256.HashData(saltTranscript);
        var info = EncodeTranscript(RotationFields(RotationKeyDomain, context));
        return HkdfSha256(currentSessionKey, salt, info);
    }

    public static string ComputeRotationNewKeyProof(
        ReadOnlySpan<byte> newSessionKey,
        CompanionRotationProofContext context) =>
        Proof(newSessionKey, RotationFields(RotationNewKeyProofDomain, context));

    public static string ComputeRotationCompletionProof(
        ReadOnlySpan<byte> newSessionKey,
        CompanionRotationProofContext context,
        string commitRequestSha256)
    {
        RequireSha256(commitRequestSha256, "rotation-commit-request-sha256");
        ValidateRotationContext(context);
        return Proof(newSessionKey,
        [
            RotationCompletionProofDomain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            context.RotationId,
            Decimal(context.NextEpoch),
            context.Host,
            context.Origin,
            commitRequestSha256
        ]);
    }

    public static string ComputeArtifactMetadataSha256(
        CompanionArtifactResponseMetadata metadata)
    {
        ValidateArtifactMetadata(metadata);
        return Sha256Hex(EncodeTranscript(
        [
            ArtifactMetadataDomain,
            metadata.OperationId,
            metadata.ArtifactRole,
            metadata.ArtifactId,
            metadata.ArtifactSha256,
            Decimal(metadata.ArtifactBytes),
            Decimal(metadata.ChunkIndex),
            Decimal(metadata.ChunkCount),
            Decimal(metadata.ChunkOffset),
            Decimal(metadata.ChunkBytes)
        ]));
    }

    public static bool VerifyPairingServerProof(
        ReadOnlySpan<byte> pairingSecret,
        CompanionPairingProofContext context,
        string proof) =>
        VerifyProof(
            pairingSecret,
            PairingFields(PairingServerProofDomain, context),
            proof);

    public static bool VerifyPairingBrowserProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionPairingProofContext context,
        string proof) =>
        VerifyProof(
            sessionKey,
            PairingFields(PairingBrowserProofDomain, context),
            proof);

    public static bool VerifyPairingCompletionProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionPairingProofContext context,
        string completeRequestSha256,
        string proof)
    {
        RequireSha256(completeRequestSha256, "pairing-complete-request-sha256");
        return VerifyProof(
            sessionKey,
            PairingFields(PairingCompletionProofDomain, context)
                .Append(completeRequestSha256)
                .ToArray(),
            proof);
    }

    public static bool VerifyRequestProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionRequestProofContext context,
        string proof)
    {
        ValidateRequestContext(context);
        return VerifyProof(sessionKey,
        [
            RequestProofDomain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            Decimal(context.KeyEpoch),
            Decimal(context.Sequence),
            context.Method,
            context.Host,
            context.Origin,
            context.Path,
            context.ContentType,
            Decimal(context.ContentLength),
            context.ContentSha256
        ], proof);
    }

    public static bool VerifyResponseProof(
        ReadOnlySpan<byte> sessionKey,
        CompanionResponseProofContext context,
        string proof)
    {
        ValidateResponseContext(context);
        return VerifyProof(sessionKey,
        [
            ResponseProofDomain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            Decimal(context.KeyEpoch),
            Decimal(context.Sequence),
            context.RequestMethod,
            context.RequestPath,
            Decimal(context.Status),
            context.ContentType,
            Decimal(context.ContentLength),
            context.ResponseMetadataSha256,
            context.ContentSha256
        ], proof);
    }

    public static bool VerifyRotationNewKeyProof(
        ReadOnlySpan<byte> newSessionKey,
        CompanionRotationProofContext context,
        string proof) =>
        VerifyProof(
            newSessionKey,
            RotationFields(RotationNewKeyProofDomain, context),
            proof);

    public static bool VerifyRotationCompletionProof(
        ReadOnlySpan<byte> newSessionKey,
        CompanionRotationProofContext context,
        string commitRequestSha256,
        string proof)
    {
        RequireSha256(commitRequestSha256, "rotation-commit-request-sha256");
        ValidateRotationContext(context);
        return VerifyProof(newSessionKey,
        [
            RotationCompletionProofDomain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            context.RotationId,
            Decimal(context.NextEpoch),
            context.Host,
            context.Origin,
            commitRequestSha256
        ], proof);
    }

    private static bool VerifyProof(
        ReadOnlySpan<byte> key,
        IReadOnlyList<string> fields,
        string proof)
    {
        byte[] actual;
        try
        {
            actual = DecodeBase64Url32(proof, "proof-encoding");
        }
        catch (CompanionProtocolException)
        {
            return false;
        }
        RequireKey(key, "proof-key");
        var transcript = EncodeTranscript(fields);
        var expected = HMACSHA256.HashData(key, transcript);
        try
        {
            return CryptographicOperations.FixedTimeEquals(expected, actual);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(expected);
            CryptographicOperations.ZeroMemory(actual);
        }
    }

    public static void RequireHexIdentifier(string value, int bytes, string code)
    {
        if (bytes is < 1 or > 64 || value is null || value.Length != bytes * 2 ||
            !LowerHexPattern().IsMatch(value))
        {
            throw new CompanionProtocolException(code);
        }
    }

    public static void RequireSha256(string value, string code) =>
        RequireHexIdentifier(value, 32, code);

    public static void RequireNonce(string value, string code)
    {
        var decoded = DecodeBase64Url32(value, code);
        CryptographicOperations.ZeroMemory(decoded);
    }

    public static void RequireTimestamp(string value, string code)
    {
        if (value is null || !TimestampPattern().IsMatch(value) ||
            !DateTimeOffset.TryParseExact(
                value,
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out _))
        {
            throw new CompanionProtocolException(code);
        }
    }

    private static string Proof(ReadOnlySpan<byte> key, IReadOnlyList<string> fields)
    {
        RequireKey(key, "proof-key");
        var transcript = EncodeTranscript(fields);
        var proof = HMACSHA256.HashData(key, transcript);
        try
        {
            return EncodeBase64Url(proof);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(proof);
        }
    }

    private static byte[] HkdfSha256(
        ReadOnlySpan<byte> inputKeyMaterial,
        ReadOnlySpan<byte> salt,
        ReadOnlySpan<byte> info)
    {
        RequireKey(inputKeyMaterial, "hkdf-input-key");
        if (salt.Length != KeyBytes || info.Length == 0 || info.Length > MaximumTranscriptBytes)
        {
            throw new CompanionProtocolException("hkdf-input");
        }
        var prk = HMACSHA256.HashData(salt, inputKeyMaterial);
        var expandInput = GC.AllocateUninitializedArray<byte>(checked(info.Length + 1));
        info.CopyTo(expandInput);
        expandInput[^1] = 1;
        try
        {
            return HMACSHA256.HashData(prk, expandInput);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(prk);
            CryptographicOperations.ZeroMemory(expandInput);
        }
    }

    private static string[] PairingFields(
        string domain,
        CompanionPairingProofContext context,
        bool includeExpiry = true)
    {
        ValidatePairingContext(context);
        var fields = new List<string>(includeExpiry ? 13 : 11)
        {
            domain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.ClaimId,
            context.BrowserNonce,
            context.ServerNonce,
            context.SessionId,
            Decimal(context.KeyEpoch),
            context.Host,
            context.Origin
        };
        if (includeExpiry)
        {
            fields.Add(context.SessionExpiresAtUtc);
            fields.Add(Decimal(context.IdleTimeoutSeconds));
        }
        return fields.ToArray();
    }

    private static string[] RotationFields(
        string domain,
        CompanionRotationProofContext context)
    {
        ValidateRotationContext(context);
        return
        [
            domain,
            ProtocolId,
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            context.RotationId,
            context.BrowserNonce,
            context.ServerNonce,
            Decimal(context.CurrentEpoch),
            Decimal(context.NextEpoch),
            context.Host,
            context.Origin
        ];
    }

    private static void ValidatePairingContext(CompanionPairingProofContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        RequireHexIdentifier(context.InstallationId, 16, "pairing-installation-id");
        RequireHexIdentifier(context.ProcessInstanceId, 16, "pairing-process-id");
        RequireHexIdentifier(context.ClaimId, 16, "pairing-claim-id");
        RequireNonce(context.BrowserNonce, "pairing-browser-nonce");
        RequireNonce(context.ServerNonce, "pairing-server-nonce");
        RequireHexIdentifier(context.SessionId, 16, "pairing-session-id");
        RequireEpoch(context.KeyEpoch, "pairing-key-epoch");
        RequireHostAndOrigin(context.Host, context.Origin);
        RequireTimestamp(context.SessionExpiresAtUtc, "pairing-session-expiry");
        if (context.IdleTimeoutSeconds != 900)
        {
            throw new CompanionProtocolException("pairing-idle-timeout");
        }
    }

    private static void ValidateRequestContext(CompanionRequestProofContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        RequireSessionIdentity(
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            context.KeyEpoch,
            context.Sequence);
        RequirePath(context.Path, "request-proof-context");
        if (context.Method is not ("GET" or "POST") ||
            context.ContentType is not ("" or "application/json") ||
            context.ContentLength > 65_536)
        {
            throw new CompanionProtocolException("request-proof-context");
        }
        RequireHostAndOrigin(context.Host, context.Origin);
        RequireSha256(context.ContentSha256, "request-content-sha256");
        if ((context.Method == "GET" &&
             (context.ContentLength != 0 || context.ContentType.Length != 0 ||
              context.ContentSha256 != EmptySha256)) ||
            (context.Method == "POST" && context.ContentType != "application/json"))
        {
            throw new CompanionProtocolException("request-proof-body");
        }
    }

    private static void ValidateResponseContext(CompanionResponseProofContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        RequireSessionIdentity(
            context.InstallationId,
            context.ProcessInstanceId,
            context.SessionId,
            context.KeyEpoch,
            context.Sequence);
        RequirePath(context.RequestPath, "response-proof-context");
        if (context.RequestMethod is not ("GET" or "POST") ||
            context.Status is < 100 or > 599 ||
            context.ContentType is not ("application/json" or "application/octet-stream") ||
            context.ContentLength > 4_194_304)
        {
            throw new CompanionProtocolException("response-proof-context");
        }
        RequireSha256(context.ResponseMetadataSha256, "response-metadata-sha256");
        RequireSha256(context.ContentSha256, "response-content-sha256");
    }

    private static void ValidateRotationContext(CompanionRotationProofContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        RequireHexIdentifier(context.InstallationId, 16, "rotation-installation-id");
        RequireHexIdentifier(context.ProcessInstanceId, 16, "rotation-process-id");
        RequireHexIdentifier(context.SessionId, 16, "rotation-session-id");
        RequireHexIdentifier(context.RotationId, 16, "rotation-id");
        RequireNonce(context.BrowserNonce, "rotation-browser-nonce");
        RequireNonce(context.ServerNonce, "rotation-server-nonce");
        RequireEpoch(context.CurrentEpoch, "rotation-current-epoch");
        RequireEpoch(context.NextEpoch, "rotation-next-epoch");
        if (context.NextEpoch != context.CurrentEpoch + 1)
        {
            throw new CompanionProtocolException("rotation-epoch-order");
        }
        RequireHostAndOrigin(context.Host, context.Origin);
    }

    private static void ValidateArtifactMetadata(CompanionArtifactResponseMetadata metadata)
    {
        ArgumentNullException.ThrowIfNull(metadata);
        RequireSha256(metadata.OperationId, "artifact-operation-id");
        if (metadata.ArtifactRole is not (
            "composition" or "model" or "tokenizer" or
            "template" or "sampling" or "prompt"))
        {
            throw new CompanionProtocolException("artifact-role");
        }
        CompanionContract.RequireContentId(metadata.ArtifactId, "artifact-id");
        RequireSha256(metadata.ArtifactSha256, "artifact-sha256");
        if (metadata.ArtifactId != $"sha256:{metadata.ArtifactSha256}")
        {
            throw new CompanionProtocolException("artifact-id");
        }
        if (metadata.ArtifactBytes is 0 or > 68_719_476_736 ||
            metadata.ChunkCount is 0 or > 16_384 ||
            metadata.ChunkIndex >= metadata.ChunkCount ||
            metadata.ChunkOffset != metadata.ChunkIndex * 4_194_304 ||
            metadata.ChunkBytes is 0 or > 4_194_304 ||
            metadata.ChunkOffset + metadata.ChunkBytes > metadata.ArtifactBytes ||
            (metadata.ChunkIndex + 1 < metadata.ChunkCount &&
             metadata.ChunkBytes != 4_194_304) ||
            (metadata.ChunkIndex + 1 == metadata.ChunkCount &&
             metadata.ChunkOffset + metadata.ChunkBytes != metadata.ArtifactBytes) ||
            metadata.ChunkCount != (metadata.ArtifactBytes + 4_194_303) / 4_194_304)
        {
            throw new CompanionProtocolException("artifact-metadata");
        }
    }

    private static void RequireSessionIdentity(
        string installationId,
        string processInstanceId,
        string sessionId,
        uint keyEpoch,
        ulong sequence)
    {
        RequireHexIdentifier(installationId, 16, "session-installation-id");
        RequireHexIdentifier(processInstanceId, 16, "session-process-id");
        RequireHexIdentifier(sessionId, 16, "session-id");
        RequireEpoch(keyEpoch, "session-key-epoch");
        if (sequence is 0 or > 1_000_000)
        {
            throw new CompanionProtocolException("session-sequence");
        }
    }

    private static void RequireHostAndOrigin(string host, string origin)
    {
        if (host is null || !HostPattern().IsMatch(host))
        {
            throw new CompanionProtocolException("host-invalid");
        }
        var separator = host.LastIndexOf(':');
        if (!ushort.TryParse(host.AsSpan(separator + 1), NumberStyles.None,
                CultureInfo.InvariantCulture, out var port) || port < 1_024)
        {
            throw new CompanionProtocolException("host-invalid");
        }
        if (!string.Equals(origin, ProductionOrigin, StringComparison.Ordinal))
        {
            throw new CompanionProtocolException("origin-invalid");
        }
    }

    private static void RequirePath(string path, string code)
    {
        if (path is null || path.Length > 1_024 || !PathPattern().IsMatch(path))
        {
            throw new CompanionProtocolException(code);
        }
    }

    private static void RequireEpoch(uint value, string code)
    {
        if (value is 0 or > 64)
        {
            throw new CompanionProtocolException(code);
        }
    }

    private static void RequireKey(ReadOnlySpan<byte> value, string code)
    {
        if (value.Length != KeyBytes)
        {
            throw new CompanionProtocolException(code);
        }
    }

    private static string Decimal(uint value) =>
        value.ToString(CultureInfo.InvariantCulture);

    private static string Decimal(ulong value) =>
        value.ToString(CultureInfo.InvariantCulture);

    private static string Decimal(int value) =>
        value.ToString(CultureInfo.InvariantCulture);

    [GeneratedRegex("^[0-9a-f]+$")]
    private static partial Regex LowerHexPattern();

    [GeneratedRegex("^[A-Za-z0-9_-]{43}$")]
    private static partial Regex Base64Url32Pattern();

    [GeneratedRegex("^127[.]0[.]0[.]1:(?:[1-9][0-9]{3,4})$")]
    private static partial Regex HostPattern();

    [GeneratedRegex("^(?:/[A-Za-z0-9._~-]+)+$")]
    private static partial Regex PathPattern();

    [GeneratedRegex("^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$")]
    private static partial Regex TimestampPattern();
}

public sealed record CompanionPairingProofContext(
    string InstallationId,
    string ProcessInstanceId,
    string ClaimId,
    string BrowserNonce,
    string ServerNonce,
    string SessionId,
    uint KeyEpoch,
    string Host,
    string Origin,
    string SessionExpiresAtUtc,
    uint IdleTimeoutSeconds);

public sealed record CompanionRequestProofContext(
    string InstallationId,
    string ProcessInstanceId,
    string SessionId,
    uint KeyEpoch,
    ulong Sequence,
    string Method,
    string Host,
    string Origin,
    string Path,
    string ContentType,
    ulong ContentLength,
    string ContentSha256);

public sealed record CompanionResponseProofContext(
    string InstallationId,
    string ProcessInstanceId,
    string SessionId,
    uint KeyEpoch,
    ulong Sequence,
    string RequestMethod,
    string RequestPath,
    int Status,
    string ContentType,
    ulong ContentLength,
    string ResponseMetadataSha256,
    string ContentSha256);

public sealed record CompanionRotationProofContext(
    string InstallationId,
    string ProcessInstanceId,
    string SessionId,
    string RotationId,
    string BrowserNonce,
    string ServerNonce,
    uint CurrentEpoch,
    uint NextEpoch,
    string Host,
    string Origin);

public sealed record CompanionArtifactResponseMetadata(
    string OperationId,
    string ArtifactRole,
    string ArtifactId,
    string ArtifactSha256,
    ulong ArtifactBytes,
    ulong ChunkIndex,
    ulong ChunkCount,
    ulong ChunkOffset,
    ulong ChunkBytes);

public sealed class CompanionProtocolException : Exception
{
    public CompanionProtocolException(string code)
        : base(code)
    {
        Code = code;
    }

    public string Code { get; }
}
