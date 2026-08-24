using System.Text;
using System.Text.Json;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionLoopbackProtocolTests
{
    [Fact]
    public void TranscriptEncodingMatchesFrozenUtf8Vector()
    {
        var vectors = ReadVectors();
        var transcript = vectors.GetProperty("transcript");
        var fields = transcript.GetProperty("fields")
            .EnumerateArray()
            .Select(value => value.GetString()!)
            .ToArray();
        var bytes = CompanionLoopbackProtocol.EncodeTranscript(fields);

        Assert.Equal(transcript.GetProperty("hex").GetString(), Convert.ToHexString(bytes).ToLowerInvariant());
        Assert.Equal(transcript.GetProperty("sha256").GetString(), CompanionLoopbackProtocol.Sha256Hex(bytes));
        Assert.Throws<CompanionProtocolException>(() =>
            CompanionLoopbackProtocol.EncodeTranscript(new string('x', 65_537)));
        Assert.Throws<CompanionProtocolException>(() =>
            CompanionLoopbackProtocol.EncodeTranscript("\ud800"));
    }

    [Fact]
    public void PairingAndSessionKeyMatchIndependentOracleVectors()
    {
        var vectors = ReadVectors();
        var secret = Convert.FromHexString(
            vectors.GetProperty("pairingSecretHex").GetString()!);
        var context = PairingContext(vectors);
        var expected = vectors.GetProperty("pairingExpected");

        var serverProof = CompanionLoopbackProtocol.ComputePairingServerProof(
            secret,
            context);
        Assert.Equal(expected.GetProperty("serverProof").GetString(), serverProof);
        Assert.True(CompanionLoopbackProtocol.VerifyPairingServerProof(
            secret,
            context,
            serverProof));

        var sessionKey = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
        Assert.Equal(
            expected.GetProperty("sessionKeyHex").GetString(),
            Convert.ToHexString(sessionKey).ToLowerInvariant());
        var browserProof = CompanionLoopbackProtocol.ComputePairingBrowserProof(
            sessionKey,
            context);
        Assert.Equal(expected.GetProperty("browserProof").GetString(), browserProof);
        Assert.True(CompanionLoopbackProtocol.VerifyPairingBrowserProof(
            sessionKey,
            context,
            browserProof));

        var completeRequestSha256 = expected
            .GetProperty("completeRequestSha256")
            .GetString()!;
        var completionProof = CompanionLoopbackProtocol.ComputePairingCompletionProof(
            sessionKey,
            context,
            completeRequestSha256);
        Assert.Equal(expected.GetProperty("completionProof").GetString(), completionProof);
        Assert.True(CompanionLoopbackProtocol.VerifyPairingCompletionProof(
            sessionKey,
            context,
            completeRequestSha256,
            completionProof));

        Assert.False(CompanionLoopbackProtocol.VerifyPairingServerProof(
            secret,
            context,
            MutateProof(serverProof)));
        Assert.False(CompanionLoopbackProtocol.VerifyPairingCompletionProof(
            sessionKey,
            context,
            completeRequestSha256.Replace('0', '1'),
            completionProof));
    }

    [Fact]
    public void RequestResponseAndArtifactProofsMatchIndependentOracleVectors()
    {
        var vectors = ReadVectors();
        var sessionKey = Convert.FromHexString(vectors
            .GetProperty("pairingExpected")
            .GetProperty("sessionKeyHex")
            .GetString()!);
        var request = RequestContext(vectors);
        var requestProof = CompanionLoopbackProtocol.ComputeRequestProof(sessionKey, request);
        Assert.Equal(vectors.GetProperty("request").GetProperty("proof").GetString(), requestProof);
        Assert.True(CompanionLoopbackProtocol.VerifyRequestProof(
            sessionKey,
            request,
            requestProof));
        Assert.False(CompanionLoopbackProtocol.VerifyRequestProof(
            sessionKey,
            request with { Sequence = request.Sequence + 1 },
            requestProof));

        var response = ResponseContext(vectors);
        var responseBytes = Encoding.UTF8.GetBytes(vectors
            .GetProperty("response")
            .GetProperty("bodyUtf8")
            .GetString()!);
        Assert.Equal(response.ContentLength, checked((ulong)responseBytes.Length));
        Assert.Equal(response.ContentSha256, CompanionLoopbackProtocol.Sha256Hex(responseBytes));
        var responseProof = CompanionLoopbackProtocol.ComputeResponseProof(sessionKey, response);
        Assert.Equal(vectors.GetProperty("response").GetProperty("proof").GetString(), responseProof);
        Assert.True(CompanionLoopbackProtocol.VerifyResponseProof(
            sessionKey,
            response,
            responseProof));

        var metadata = ArtifactMetadata(vectors);
        var artifact = vectors.GetProperty("artifact");
        var metadataSha256 = CompanionLoopbackProtocol.ComputeArtifactMetadataSha256(metadata);
        Assert.Equal(artifact.GetProperty("metadataSha256").GetString(), metadataSha256);
        var artifactResponse = ArtifactResponseContext(vectors);
        var artifactProof = CompanionLoopbackProtocol.ComputeResponseProof(
            sessionKey,
            artifactResponse);
        Assert.Equal(artifact.GetProperty("responseProof").GetString(), artifactProof);

        var substitutedHash = CompanionLoopbackProtocol.ComputeArtifactMetadataSha256(
            metadata with { ArtifactRole = "template" });
        Assert.NotEqual(metadataSha256, substitutedHash);
        Assert.False(CompanionLoopbackProtocol.VerifyResponseProof(
            sessionKey,
            artifactResponse with { ResponseMetadataSha256 = substitutedHash },
            artifactProof));
    }

    [Fact]
    public void RotationMatchesIndependentOracleVectors()
    {
        var vectors = ReadVectors();
        var expected = vectors.GetProperty("rotationExpected");
        var currentKey = Convert.FromHexString(vectors
            .GetProperty("pairingExpected")
            .GetProperty("sessionKeyHex")
            .GetString()!);
        var context = RotationContext(vectors);
        var rotatedKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
            currentKey,
            context);
        Assert.Equal(
            expected.GetProperty("rotatedSessionKeyHex").GetString(),
            Convert.ToHexString(rotatedKey).ToLowerInvariant());

        var newKeyProof = CompanionLoopbackProtocol.ComputeRotationNewKeyProof(
            rotatedKey,
            context);
        Assert.Equal(expected.GetProperty("newKeyProof").GetString(), newKeyProof);
        Assert.True(CompanionLoopbackProtocol.VerifyRotationNewKeyProof(
            rotatedKey,
            context,
            newKeyProof));

        var requestSha256 = expected.GetProperty("commitRequestSha256").GetString()!;
        var completionProof = CompanionLoopbackProtocol.ComputeRotationCompletionProof(
            rotatedKey,
            context,
            requestSha256);
        Assert.Equal(expected.GetProperty("completionProof").GetString(), completionProof);
        Assert.True(CompanionLoopbackProtocol.VerifyRotationCompletionProof(
            rotatedKey,
            context,
            requestSha256,
            completionProof));
    }

    [Fact]
    public void InstallationRecordHasOneCanonicalFileRepresentation()
    {
        var vectors = ReadVectors();
        var installation = vectors.GetProperty("installationRecord");
        var record = new CompanionInstallationRecord(
            CompanionLoopbackWire.InstallationSchema,
            vectors.GetProperty("pairingContext").GetProperty("installationId").GetString()!);
        var encoded = CompanionLoopbackWire.EncodeInstallationRecordFile(record);

        Assert.Equal(
            installation.GetProperty("canonicalFileHex").GetString(),
            Convert.ToHexString(encoded).ToLowerInvariant());
        Assert.Equal(
            installation.GetProperty("sha256").GetString(),
            CompanionLoopbackProtocol.Sha256Hex(encoded));
        Assert.Equal(record, CompanionLoopbackWire.DecodeInstallationRecordFile(encoded));

        var canonical = Encoding.UTF8.GetString(encoded);
        foreach (var invalid in new[]
        {
            canonical.TrimEnd('\r', '\n'),
            $" {canonical}",
            canonical.Replace(",\"installationId\"", ", \"installationId\"", StringComparison.Ordinal),
            canonical.Replace(
                "\"installationId\"",
                "\"unknown\":true,\"installationId\"",
                StringComparison.Ordinal),
            canonical.Replace(
                "\"installationId\":",
                $"\"installationId\":\"{record.InstallationId}\",\"installationId\":",
                StringComparison.Ordinal),
            canonical.Replace(
                "\"schema\":\"tinyrustlm",
                "\"schema\":\"tin\\u0079rustlm",
                StringComparison.Ordinal)
        })
        {
            Assert.Throws<CompanionProtocolException>(() =>
                CompanionLoopbackWire.DecodeInstallationRecordFile(
                    Encoding.UTF8.GetBytes(invalid)));
        }
    }

    [Fact]
    public void ProtocolRejectsInvalidHostPathTimestampAndBodyShape()
    {
        var vectors = ReadVectors();
        var key = Convert.FromHexString(vectors
            .GetProperty("pairingExpected")
            .GetProperty("sessionKeyHex")
            .GetString()!);

        AssertCode("request-proof-context", () =>
            CompanionLoopbackProtocol.ComputeRequestProof(
                key,
                RequestContext(vectors) with
                {
                    Path = "/tinyrustlm-companion/1/session?probe=true"
                }));
        AssertCode("request-proof-body", () =>
            CompanionLoopbackProtocol.ComputeRequestProof(
                key,
                RequestContext(vectors) with
                {
                    ContentType = "application/json",
                    ContentSha256 = new string('a', 64)
                }));
        AssertCode("host-invalid", () =>
            CompanionLoopbackProtocol.ComputeRequestProof(
                key,
                RequestContext(vectors) with { Host = "localhost:54321" }));
        AssertCode("pairing-session-expiry", () =>
            CompanionLoopbackProtocol.ComputePairingServerProof(
                Convert.FromHexString(vectors.GetProperty("pairingSecretHex").GetString()!),
                PairingContext(vectors) with
                {
                    SessionExpiresAtUtc = "2026-02-30T07:00:00Z"
                }));
        AssertCode("pairing-session-expiry", () =>
            CompanionLoopbackProtocol.ComputePairingServerProof(
                Convert.FromHexString(vectors.GetProperty("pairingSecretHex").GetString()!),
                PairingContext(vectors) with
                {
                    SessionExpiresAtUtc = "0000-01-01T00:00:00Z"
                }));
    }

    private static JsonElement ReadVectors()
    {
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "companion-loopback-capability-vectors.v1.json");
        using var document = JsonDocument.Parse(File.ReadAllBytes(path));
        var root = document.RootElement.Clone();
        Assert.Equal(
            "tinyrustlm.companion.loopback-capability-vectors.v1",
            root.GetProperty("schema").GetString());
        Assert.Equal(
            CompanionLoopbackProtocol.ProtocolId,
            root.GetProperty("profileId").GetString());
        Assert.False(root.GetProperty("testMaterialIsSecret").GetBoolean());
        return root;
    }

    private static CompanionPairingProofContext PairingContext(JsonElement vectors)
    {
        var value = vectors.GetProperty("pairingContext");
        return new CompanionPairingProofContext(
            value.GetProperty("installationId").GetString()!,
            value.GetProperty("processInstanceId").GetString()!,
            value.GetProperty("claimId").GetString()!,
            value.GetProperty("browserNonce").GetString()!,
            value.GetProperty("serverNonce").GetString()!,
            value.GetProperty("sessionId").GetString()!,
            value.GetProperty("keyEpoch").GetUInt32(),
            value.GetProperty("host").GetString()!,
            value.GetProperty("origin").GetString()!,
            value.GetProperty("sessionExpiresAtUtc").GetString()!,
            value.GetProperty("idleTimeoutSeconds").GetUInt32());
    }

    private static CompanionRequestProofContext RequestContext(JsonElement vectors)
    {
        var pairing = vectors.GetProperty("pairingContext");
        var value = vectors.GetProperty("request");
        return new CompanionRequestProofContext(
            pairing.GetProperty("installationId").GetString()!,
            pairing.GetProperty("processInstanceId").GetString()!,
            pairing.GetProperty("sessionId").GetString()!,
            pairing.GetProperty("keyEpoch").GetUInt32(),
            value.GetProperty("sequence").GetUInt64(),
            value.GetProperty("method").GetString()!,
            pairing.GetProperty("host").GetString()!,
            pairing.GetProperty("origin").GetString()!,
            value.GetProperty("path").GetString()!,
            value.GetProperty("contentType").GetString()!,
            value.GetProperty("contentLength").GetUInt64(),
            value.GetProperty("contentSha256").GetString()!);
    }

    private static CompanionResponseProofContext ResponseContext(JsonElement vectors)
    {
        var pairing = vectors.GetProperty("pairingContext");
        var request = vectors.GetProperty("request");
        var value = vectors.GetProperty("response");
        return new CompanionResponseProofContext(
            pairing.GetProperty("installationId").GetString()!,
            pairing.GetProperty("processInstanceId").GetString()!,
            pairing.GetProperty("sessionId").GetString()!,
            pairing.GetProperty("keyEpoch").GetUInt32(),
            request.GetProperty("sequence").GetUInt64(),
            request.GetProperty("method").GetString()!,
            request.GetProperty("path").GetString()!,
            value.GetProperty("status").GetInt32(),
            value.GetProperty("contentType").GetString()!,
            value.GetProperty("contentLength").GetUInt64(),
            value.GetProperty("responseMetadataSha256").GetString()!,
            value.GetProperty("contentSha256").GetString()!);
    }

    private static CompanionArtifactResponseMetadata ArtifactMetadata(JsonElement vectors)
    {
        var value = vectors.GetProperty("artifact");
        return new CompanionArtifactResponseMetadata(
            value.GetProperty("operationId").GetString()!,
            value.GetProperty("role").GetString()!,
            value.GetProperty("artifactId").GetString()!,
            value.GetProperty("artifactSha256").GetString()!,
            value.GetProperty("artifactBytes").GetUInt64(),
            value.GetProperty("chunkIndex").GetUInt64(),
            value.GetProperty("chunkCount").GetUInt64(),
            value.GetProperty("chunkOffset").GetUInt64(),
            value.GetProperty("chunkBytes").GetUInt64());
    }

    private static CompanionResponseProofContext ArtifactResponseContext(JsonElement vectors)
    {
        var pairing = vectors.GetProperty("pairingContext");
        var value = vectors.GetProperty("artifact");
        return new CompanionResponseProofContext(
            pairing.GetProperty("installationId").GetString()!,
            pairing.GetProperty("processInstanceId").GetString()!,
            pairing.GetProperty("sessionId").GetString()!,
            pairing.GetProperty("keyEpoch").GetUInt32(),
            value.GetProperty("responseSequence").GetUInt64(),
            "GET",
            value.GetProperty("responsePath").GetString()!,
            200,
            "application/octet-stream",
            value.GetProperty("chunkBytes").GetUInt64(),
            value.GetProperty("metadataSha256").GetString()!,
            value.GetProperty("chunkContentSha256").GetString()!);
    }

    private static CompanionRotationProofContext RotationContext(JsonElement vectors)
    {
        var pairing = vectors.GetProperty("pairingContext");
        var value = vectors.GetProperty("rotationContext");
        return new CompanionRotationProofContext(
            pairing.GetProperty("installationId").GetString()!,
            pairing.GetProperty("processInstanceId").GetString()!,
            pairing.GetProperty("sessionId").GetString()!,
            value.GetProperty("rotationId").GetString()!,
            value.GetProperty("browserNonce").GetString()!,
            value.GetProperty("serverNonce").GetString()!,
            value.GetProperty("currentEpoch").GetUInt32(),
            value.GetProperty("nextEpoch").GetUInt32(),
            pairing.GetProperty("host").GetString()!,
            pairing.GetProperty("origin").GetString()!);
    }

    private static string MutateProof(string value) =>
        $"{(value[0] == 'A' ? 'B' : 'A')}{value[1..]}";

    private static void AssertCode(string code, Action action)
    {
        var error = Assert.Throws<CompanionProtocolException>(action);
        Assert.Equal(code, error.Code);
    }
}
