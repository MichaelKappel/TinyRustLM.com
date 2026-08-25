using System.Security.Cryptography;
using System.Text;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionRotationStateTests
{
    private const string Host = "127.0.0.1:54321";
    private const string SessionPath = "/tinyrustlm-companion/1/session";
    private const string RotationBeginPath =
        "/tinyrustlm-companion/1/session/rotation/begin";
    private const string RotationCommitPath =
        "/tinyrustlm-companion/1/session/rotation/commit";
    private const string RevokePath = "/tinyrustlm-companion/1/session/revoke";

    [Fact]
    public void RotationRevocationAndStatusBodiesHaveOneCanonicalRepresentation()
    {
        var status = new CompanionSessionStatus(
            CompanionLoopbackWire.SessionStatusSchema,
            CompanionLoopbackProtocol.ProtocolId,
            Hex(0x11),
            Hex(0x12),
            Hex(0x13),
            2,
            7,
            8,
            "2026-08-24T20:00:00Z",
            "2026-08-24T12:15:00Z",
            900);
        var statusBytes = CompanionLoopbackWire.EncodeSessionStatus(status);
        Assert.Equal(status, CompanionLoopbackWire.DecodeSessionStatus(statusBytes));

        var exhausted = status with
        {
            AcceptedSequence = 1_000_000,
            NextSequence = null
        };
        var exhaustedBytes = CompanionLoopbackWire.EncodeSessionStatus(exhausted);
        Assert.Contains(
            "\"nextSequence\":null",
            Encoding.UTF8.GetString(exhaustedBytes),
            StringComparison.Ordinal);
        Assert.Equal(exhausted, CompanionLoopbackWire.DecodeSessionStatus(exhaustedBytes));
        AssertCode(
            "session-status-contract",
            () => CompanionLoopbackWire.DecodeSessionStatus(
                Replace(exhaustedBytes, "\"nextSequence\":null", "\"nextSequence\":1000001")));
        AssertCode(
            "session-status-contract",
            () => CompanionLoopbackWire.DecodeSessionStatus(
                Replace(statusBytes, "\"nextSequence\":8", "\"nextSequence\":null")));

        var begin = new CompanionRotationBegin(
            CompanionLoopbackWire.RotationBeginSchema,
            Hex(0x21),
            Nonce(0x22));
        Assert.Equal(
            begin,
            CompanionLoopbackWire.DecodeRotationBegin(
                CompanionLoopbackWire.EncodeRotationBegin(begin)));

        var challenge = new CompanionRotationChallenge(
            CompanionLoopbackWire.RotationChallengeSchema,
            begin.RotationId,
            begin.BrowserNonce,
            Nonce(0x23),
            1,
            2,
            "2026-08-24T12:02:00Z");
        Assert.Equal(
            challenge,
            CompanionLoopbackWire.DecodeRotationChallenge(
                CompanionLoopbackWire.EncodeRotationChallenge(challenge)));

        var commit = new CompanionRotationCommit(
            CompanionLoopbackWire.RotationCommitSchema,
            begin.RotationId,
            begin.BrowserNonce,
            challenge.ServerNonce,
            1,
            2,
            Proof(0x24));
        Assert.Equal(
            commit,
            CompanionLoopbackWire.DecodeRotationCommit(
                CompanionLoopbackWire.EncodeRotationCommit(commit)));

        var committed = new CompanionRotationCommitted(
            CompanionLoopbackWire.RotationCommittedSchema,
            begin.RotationId,
            2,
            "2026-08-24T12:15:00Z",
            Proof(0x25));
        Assert.Equal(
            committed,
            CompanionLoopbackWire.DecodeRotationCommitted(
                CompanionLoopbackWire.EncodeRotationCommitted(committed)));

        var revoke = new CompanionRevokeRequest(
            CompanionLoopbackWire.RevokeRequestSchema,
            Hex(0x31));
        Assert.Equal(
            revoke,
            CompanionLoopbackWire.DecodeRevokeRequest(
                CompanionLoopbackWire.EncodeRevokeRequest(revoke)));
        var revoked = new CompanionRevokedResponse(
            CompanionLoopbackWire.RevokedResponseSchema,
            revoke.RevocationId,
            true);
        Assert.Equal(
            revoked,
            CompanionLoopbackWire.DecodeRevokedResponse(
                CompanionLoopbackWire.EncodeRevokedResponse(revoked)));

        AssertCode(
            "json-invalid",
            () => CompanionLoopbackWire.DecodeRotationBegin(
                [.. " "u8, .. CompanionLoopbackWire.EncodeRotationBegin(begin)]));
        AssertCode(
            "rotation-epoch-order",
            () => CompanionLoopbackWire.DecodeRotationChallenge(
                Replace(
                    CompanionLoopbackWire.EncodeRotationChallenge(challenge),
                    "\"nextEpoch\":2",
                    "\"nextEpoch\":3")));
        AssertCode(
            "revoked-response-contract",
            () => CompanionLoopbackWire.DecodeRevokedResponse(
                Replace(
                    CompanionLoopbackWire.EncodeRevokedResponse(revoked),
                    "\"revoked\":true",
                    "\"revoked\":false")));
    }

    [Fact]
    public void RotationCommitsUnderNewKeyAndReplaysOnlyTheExactOldCommit()
    {
        using var fixture = PairedFixture.Create();
        var beginRequest = RotationBegin(0x50, 0x51);
        var beginBytes = CompanionLoopbackWire.EncodeRotationBegin(beginRequest);
        var beginAuthentication = AuthenticatedRequest(
            fixture,
            fixture.SessionKey,
            1,
            1,
            "POST",
            RotationBeginPath,
            beginBytes);

        CompanionRotationChallenge challenge;
        using (var lease = fixture.State.Authenticate(beginAuthentication))
        {
            var response = lease.BeginRotationAndMaterializeResponse(beginRequest);
            AssertProven(response, fixture.SessionKey, 1, 1, "POST", RotationBeginPath, 200);
            challenge = CompanionLoopbackWire.DecodeRotationChallenge(response.CopyBody());
        }

        var rotationContext = RotationContext(fixture, challenge);
        var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
            fixture.SessionKey,
            rotationContext);
        try
        {
            var commitRequest = RotationCommit(challenge, newKey, rotationContext);
            var commitBytes = CompanionLoopbackWire.EncodeRotationCommit(commitRequest);
            var commitAuthentication = AuthenticatedRequest(
                fixture,
                fixture.SessionKey,
                1,
                2,
                "POST",
                RotationCommitPath,
                commitBytes);

            CompanionProvenResponse committedResponse;
            using (var lease = fixture.State.Authenticate(commitAuthentication))
            {
                committedResponse = lease.CommitRotationAndMaterializeResponse(commitRequest);
            }
            AssertProven(
                committedResponse,
                newKey,
                1,
                2,
                "POST",
                RotationCommitPath,
                200);
            var committed = CompanionLoopbackWire.DecodeRotationCommitted(
                committedResponse.CopyBody());
            Assert.Equal(2u, committed.KeyEpoch);
            Assert.True(CompanionLoopbackProtocol.VerifyRotationCompletionProof(
                newKey,
                rotationContext,
                CompanionLoopbackProtocol.Sha256Hex(commitBytes),
                committed.CompletionProof));

            CompanionProvenResponse replayedResponse;
            using (var replayLease = fixture.State.Authenticate(commitAuthentication))
            {
                Assert.Null(replayLease.NextSequence);
                replayedResponse = replayLease.ReplayRotationCommit(commitRequest);
            }
            Assert.Equal(committedResponse.Context, replayedResponse.Context);
            Assert.Equal(committedResponse.Proof, replayedResponse.Proof);
            Assert.Equal(committedResponse.CopyBody(), replayedResponse.CopyBody());

            var otherOldKeyRequest = AuthenticatedRequest(
                fixture,
                fixture.SessionKey,
                1,
                2,
                "GET",
                SessionPath,
                []);
            AssertCode(
                "capability-revoked",
                () => fixture.State.Authenticate(otherOldKeyRequest));

            var statusAuthentication = AuthenticatedRequest(
                fixture,
                newKey,
                2,
                1,
                "GET",
                SessionPath,
                []);
            using var statusLease = fixture.State.Authenticate(statusAuthentication);
            var statusResponse = statusLease.MaterializeSessionStatus();
            AssertProven(statusResponse, newKey, 2, 1, "GET", SessionPath, 200);
            var status = CompanionLoopbackWire.DecodeSessionStatus(statusResponse.CopyBody());
            Assert.Equal(2u, status.KeyEpoch);
            Assert.Equal<ulong>(1, status.AcceptedSequence);
            Assert.Equal<ulong?>(2, status.NextSequence);
            Assert.Equal(fixture.Begin.SessionExpiresAtUtc, status.SessionExpiresAtUtc);
            Assert.Equal(committed.KeyExpiresAtUtc, status.KeyExpiresAtUtc);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(newKey);
        }
    }

    [Fact]
    public void InvalidRotationProofConsumesSequenceButLeavesPendingRotationRecoverable()
    {
        using var fixture = PairedFixture.Create();
        var beginRequest = RotationBegin(0x52, 0x53);
        var challenge = BeginRotation(fixture, fixture.SessionKey, 1, 1, beginRequest);
        var rotationContext = RotationContext(fixture, challenge);
        var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
            fixture.SessionKey,
            rotationContext);
        try
        {
            var validCommit = RotationCommit(challenge, newKey, rotationContext);
            var invalidCommit = validCommit with
            {
                NewKeyProof = MutateProof(validCommit.NewKeyProof)
            };
            var invalidBytes = CompanionLoopbackWire.EncodeRotationCommit(invalidCommit);
            var invalidAuthentication = AuthenticatedRequest(
                fixture,
                fixture.SessionKey,
                1,
                2,
                "POST",
                RotationCommitPath,
                invalidBytes);
            using (var lease = fixture.State.Authenticate(invalidAuthentication))
            {
                AssertCode(
                    "rotation-proof-invalid",
                    () => lease.CommitRotationAndMaterializeResponse(invalidCommit));
                var error = lease.MaterializeResponse(
                    403,
                    "application/json",
                    ErrorBody("rotation-proof-invalid"),
                    CompanionLoopbackProtocol.EmptySha256);
                AssertProven(
                    error,
                    fixture.SessionKey,
                    1,
                    2,
                    "POST",
                    RotationCommitPath,
                    403);
            }

            AssertCode(
                "capability-sequence",
                () => fixture.State.Authenticate(invalidAuthentication));

            var validBytes = CompanionLoopbackWire.EncodeRotationCommit(validCommit);
            var validAuthentication = AuthenticatedRequest(
                fixture,
                fixture.SessionKey,
                1,
                3,
                "POST",
                RotationCommitPath,
                validBytes);
            using var validLease = fixture.State.Authenticate(validAuthentication);
            var committed = validLease.CommitRotationAndMaterializeResponse(validCommit);
            AssertProven(committed, newKey, 1, 3, "POST", RotationCommitPath, 200);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(newKey);
        }
    }

    [Fact]
    public void PendingRotationIsIdempotentConflictingAndMonotonicallyExpired()
    {
        using var fixture = PairedFixture.Create();
        var request = RotationBegin(0x54, 0x55);
        var first = BeginRotation(fixture, fixture.SessionKey, 1, 1, request);
        var second = BeginRotation(fixture, fixture.SessionKey, 1, 2, request);
        Assert.Equal(first, second);

        var conflicting = RotationBegin(0x56, 0x57);
        var conflictingBytes = CompanionLoopbackWire.EncodeRotationBegin(conflicting);
        var conflictingAuthentication = AuthenticatedRequest(
            fixture,
            fixture.SessionKey,
            1,
            3,
            "POST",
            RotationBeginPath,
            conflictingBytes);
        using (var lease = fixture.State.Authenticate(conflictingAuthentication))
        {
            AssertCode(
                "rotation-conflict",
                () => lease.BeginRotationAndMaterializeResponse(conflicting));
            lease.MaterializeResponse(
                409,
                "application/json",
                ErrorBody("rotation-conflict"),
                CompanionLoopbackProtocol.EmptySha256);
        }

        fixture.Clock.Advance(TimeSpan.FromSeconds(120));
        var expiredBytes = CompanionLoopbackWire.EncodeRotationBegin(request);
        var expiredAuthentication = AuthenticatedRequest(
            fixture,
            fixture.SessionKey,
            1,
            4,
            "POST",
            RotationBeginPath,
            expiredBytes);
        using (var lease = fixture.State.Authenticate(expiredAuthentication))
        {
            AssertCode(
                "rotation-expired",
                () => lease.BeginRotationAndMaterializeResponse(request));
            lease.MaterializeResponse(
                410,
                "application/json",
                ErrorBody("rotation-expired"),
                CompanionLoopbackProtocol.EmptySha256);
        }

        var replacement = RotationBegin(0x58, 0x59);
        var replacementChallenge = BeginRotation(
            fixture,
            fixture.SessionKey,
            1,
            5,
            replacement);
        Assert.Equal(replacement.RotationId, replacementChallenge.RotationId);
    }

    [Fact]
    public void RotationResetsOnlyKeyAgeAndOldCommitReplayExpiresAfterThirtySeconds()
    {
        using var fixture = PairedFixture.Create();
        fixture.Clock.Advance(TimeSpan.FromSeconds(898));
        var request = RotationBegin(0x60, 0x61);
        var challenge = BeginRotation(fixture, fixture.SessionKey, 1, 1, request);
        fixture.Clock.Advance(TimeSpan.FromSeconds(1));
        var rotationContext = RotationContext(fixture, challenge);
        var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
            fixture.SessionKey,
            rotationContext);
        try
        {
            var commit = RotationCommit(challenge, newKey, rotationContext);
            var commitBytes = CompanionLoopbackWire.EncodeRotationCommit(commit);
            var oldCommitAuthentication = AuthenticatedRequest(
                fixture,
                fixture.SessionKey,
                1,
                2,
                "POST",
                RotationCommitPath,
                commitBytes);
            using (var lease = fixture.State.Authenticate(oldCommitAuthentication))
            {
                lease.CommitRotationAndMaterializeResponse(commit);
            }

            fixture.Clock.Advance(TimeSpan.FromSeconds(2));
            var firstStatusAuthentication = AuthenticatedRequest(
                fixture,
                newKey,
                2,
                1,
                "GET",
                SessionPath,
                []);
            using (var lease = fixture.State.Authenticate(firstStatusAuthentication))
            {
                var status = CompanionLoopbackWire.DecodeSessionStatus(
                    lease.MaterializeSessionStatus().CopyBody());
                Assert.Equal(fixture.Begin.SessionExpiresAtUtc, status.SessionExpiresAtUtc);
                Assert.Equal("2026-08-24T12:29:59Z", status.KeyExpiresAtUtc);
            }

            fixture.Clock.Advance(TimeSpan.FromSeconds(29));
            AssertCode(
                "capability-revoked",
                () => fixture.State.Authenticate(oldCommitAuthentication));

            var secondStatusAuthentication = AuthenticatedRequest(
                fixture,
                newKey,
                2,
                2,
                "GET",
                SessionPath,
                []);
            using var statusLease = fixture.State.Authenticate(secondStatusAuthentication);
            var statusResponse = statusLease.MaterializeSessionStatus();
            AssertProven(statusResponse, newKey, 2, 2, "GET", SessionPath, 200);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(newKey);
        }
    }

    [Fact]
    public void ExactOldCommitReplayIsRateBoundWithoutConsumingAnotherSequence()
    {
        using var fixture = PairedFixture.Create();
        var begin = RotationBegin(0x62, 0x63);
        var challenge = BeginRotation(fixture, fixture.SessionKey, 1, 1, begin);
        var context = RotationContext(fixture, challenge);
        var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
            fixture.SessionKey,
            context);
        try
        {
            var commit = RotationCommit(challenge, newKey, context);
            var commitBytes = CompanionLoopbackWire.EncodeRotationCommit(commit);
            var authentication = AuthenticatedRequest(
                fixture,
                fixture.SessionKey,
                1,
                2,
                "POST",
                RotationCommitPath,
                commitBytes);
            using (var lease = fixture.State.Authenticate(authentication))
            {
                lease.CommitRotationAndMaterializeResponse(commit);
            }

            for (var replayIndex = 0; replayIndex < 598; replayIndex++)
            {
                using var replayLease = fixture.State.Authenticate(authentication);
                var response = replayLease.ReplayRotationCommit(commit);
                Assert.Equal<ulong>(2, response.Context.Sequence);
            }
            AssertCode(
                "resource-limit",
                () => fixture.State.Authenticate(authentication));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(newKey);
        }
    }

    [Fact]
    public void RotationStopsAtRegisteredEpochCeilingWithoutChangingTheCurrentKey()
    {
        using var fixture = PairedFixture.Create();
        var currentKey = fixture.SessionKey.ToArray();
        try
        {
            for (uint epoch = 1; epoch < 64; epoch++)
            {
                var marker = checked((byte)epoch);
                var begin = RotationBegin(marker, checked((byte)(0x80 + marker)));
                var challenge = BeginRotation(fixture, currentKey, epoch, 1, begin);
                var context = RotationContext(fixture, challenge);
                var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
                    currentKey,
                    context);
                var commit = RotationCommit(challenge, newKey, context);
                var commitBytes = CompanionLoopbackWire.EncodeRotationCommit(commit);
                var commitAuthentication = AuthenticatedRequest(
                    fixture,
                    currentKey,
                    epoch,
                    2,
                    "POST",
                    RotationCommitPath,
                    commitBytes);
                using (var lease = fixture.State.Authenticate(commitAuthentication))
                {
                    var response = lease.CommitRotationAndMaterializeResponse(commit);
                    Assert.Equal(epoch, response.Context.KeyEpoch);
                }
                CryptographicOperations.ZeroMemory(currentKey);
                currentKey = newKey;
            }

            var disallowed = RotationBegin(0x70, 0x71);
            var disallowedBytes = CompanionLoopbackWire.EncodeRotationBegin(disallowed);
            var authentication = AuthenticatedRequest(
                fixture,
                currentKey,
                64,
                1,
                "POST",
                RotationBeginPath,
                disallowedBytes);
            using (var lease = fixture.State.Authenticate(authentication))
            {
                AssertCode(
                    "capability-expired",
                    () => lease.BeginRotationAndMaterializeResponse(disallowed));
                var error = lease.MaterializeResponse(
                    410,
                    "application/json",
                    ErrorBody("capability-expired"),
                    CompanionLoopbackProtocol.EmptySha256);
                AssertProven(error, currentKey, 64, 1, "POST", RotationBeginPath, 410);
            }

            var statusAuthentication = AuthenticatedRequest(
                fixture,
                currentKey,
                64,
                2,
                "GET",
                SessionPath,
                []);
            using var statusLease = fixture.State.Authenticate(statusAuthentication);
            var status = CompanionLoopbackWire.DecodeSessionStatus(
                statusLease.MaterializeSessionStatus().CopyBody());
            Assert.Equal(64u, status.KeyEpoch);
            Assert.Equal<ulong>(2, status.AcceptedSequence);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(currentKey);
        }
    }

    [Fact]
    public void RevocationIsProvenBeforeErasurePersistsInProcessAndRestartInvalidates()
    {
        using var fixture = PairedFixture.Create();
        var revoke = new CompanionRevokeRequest(
            CompanionLoopbackWire.RevokeRequestSchema,
            Hex(0x72));
        var revokeBytes = CompanionLoopbackWire.EncodeRevokeRequest(revoke);
        var authentication = AuthenticatedRequest(
            fixture,
            fixture.SessionKey,
            1,
            1,
            "POST",
            RevokePath,
            revokeBytes);
        using (var lease = fixture.State.Authenticate(authentication))
        {
            var response = lease.RevokeAndMaterializeResponse(revoke);
            AssertProven(response, fixture.SessionKey, 1, 1, "POST", RevokePath, 200);
            var body = CompanionLoopbackWire.DecodeRevokedResponse(response.CopyBody());
            Assert.Equal(revoke.RevocationId, body.RevocationId);
            Assert.True(body.Revoked);
        }
        Assert.Equal(0, fixture.State.ActiveSessionCount);

        fixture.Clock.Advance(TimeSpan.FromDays(1));
        var later = AuthenticatedRequest(
            fixture,
            fixture.SessionKey,
            1,
            2,
            "GET",
            SessionPath,
            []);
        AssertCode("capability-revoked", () => fixture.State.Authenticate(later));

        using var restarted = new CompanionCapabilityState(
            fixture.Begin.InstallationId,
            Hex(0x7f),
            54321,
            fixture.Clock,
            new CounterCryptographicRandom());
        AssertCode("capability-invalid", () => restarted.Authenticate(later));
    }

    [Fact]
    public void RevocationTombstonesAreProcessPersistentAndAdmissionBounded()
    {
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var state = new CompanionCapabilityState(
            Hex(0xa1),
            Hex(0xb1),
            54321,
            clock,
            new CounterCryptographicRandom(),
            maximumSessionRecords: 5);
        CompanionPairingBeginResponse? firstBegin = null;
        byte[]? firstKey = null;
        try
        {
            for (byte index = 0; index < 5; index++)
            {
                using var attempt = PairingAttempt.Create(state, index);
                state.CompletePairing(attempt.CompleteRequest);
                var revoke = new CompanionRevokeRequest(
                    CompanionLoopbackWire.RevokeRequestSchema,
                    Hex(checked((byte)(0x70 + index))));
                var revokeBytes = CompanionLoopbackWire.EncodeRevokeRequest(revoke);
                var authentication = AuthenticatedRequest(
                    attempt.Begin,
                    attempt.SessionKey,
                    1,
                    1,
                    "POST",
                    RevokePath,
                    revokeBytes);
                using var lease = state.Authenticate(authentication);
                lease.RevokeAndMaterializeResponse(revoke);
                if (index == 0)
                {
                    firstBegin = attempt.Begin;
                    firstKey = attempt.SessionKey.ToArray();
                }
            }
            Assert.Equal(0, state.ActiveSessionCount);

            using (var refused = PairingAttempt.Create(state, 5))
            {
                AssertCode(
                    "resource-limit",
                    () => state.CompletePairing(refused.CompleteRequest));
            }

            Assert.NotNull(firstBegin);
            Assert.NotNull(firstKey);
            var firstRevokedRequest = AuthenticatedRequest(
                firstBegin,
                firstKey,
                1,
                2,
                "GET",
                SessionPath,
                []);
            AssertCode(
                "capability-revoked",
                () => state.Authenticate(firstRevokedRequest));
        }
        finally
        {
            if (firstKey is not null)
            {
                CryptographicOperations.ZeroMemory(firstKey);
            }
        }
    }

    private static CompanionRotationChallenge BeginRotation(
        PairedFixture fixture,
        ReadOnlySpan<byte> key,
        uint epoch,
        ulong sequence,
        CompanionRotationBegin request)
    {
        var requestBytes = CompanionLoopbackWire.EncodeRotationBegin(request);
        var authentication = AuthenticatedRequest(
            fixture,
            key,
            epoch,
            sequence,
            "POST",
            RotationBeginPath,
            requestBytes);
        using var lease = fixture.State.Authenticate(authentication);
        var response = lease.BeginRotationAndMaterializeResponse(request);
        AssertProven(response, key, epoch, sequence, "POST", RotationBeginPath, 200);
        return CompanionLoopbackWire.DecodeRotationChallenge(response.CopyBody());
    }

    private static CompanionRotationBegin RotationBegin(byte id, byte nonce) =>
        new(CompanionLoopbackWire.RotationBeginSchema, Hex(id), Nonce(nonce));

    private static CompanionRotationCommit RotationCommit(
        CompanionRotationChallenge challenge,
        ReadOnlySpan<byte> newKey,
        CompanionRotationProofContext context) =>
        new(
            CompanionLoopbackWire.RotationCommitSchema,
            challenge.RotationId,
            challenge.BrowserNonce,
            challenge.ServerNonce,
            challenge.CurrentEpoch,
            challenge.NextEpoch,
            CompanionLoopbackProtocol.ComputeRotationNewKeyProof(newKey, context));

    private static CompanionRotationProofContext RotationContext(
        PairedFixture fixture,
        CompanionRotationChallenge challenge) =>
        new(
            fixture.Begin.InstallationId,
            fixture.Begin.ProcessInstanceId,
            fixture.Begin.SessionId,
            challenge.RotationId,
            challenge.BrowserNonce,
            challenge.ServerNonce,
            challenge.CurrentEpoch,
            challenge.NextEpoch,
            Host,
            CompanionLoopbackProtocol.ProductionOrigin);

    private static CompanionSessionAuthenticationRequest AuthenticatedRequest(
        PairedFixture fixture,
        ReadOnlySpan<byte> key,
        uint epoch,
        ulong sequence,
        string method,
        string path,
        ReadOnlySpan<byte> body) =>
        AuthenticatedRequest(
            fixture.Begin,
            key,
            epoch,
            sequence,
            method,
            path,
            body);

    private static CompanionSessionAuthenticationRequest AuthenticatedRequest(
        CompanionPairingBeginResponse begin,
        ReadOnlySpan<byte> key,
        uint epoch,
        ulong sequence,
        string method,
        string path,
        ReadOnlySpan<byte> body)
    {
        var context = new CompanionRequestProofContext(
            begin.InstallationId,
            begin.ProcessInstanceId,
            begin.SessionId,
            epoch,
            sequence,
            method,
            Host,
            CompanionLoopbackProtocol.ProductionOrigin,
            path,
            body.IsEmpty ? "" : "application/json",
            checked((ulong)body.Length),
            CompanionLoopbackProtocol.Sha256Hex(body));
        return new CompanionSessionAuthenticationRequest(
            context,
            CompanionLoopbackProtocol.ComputeRequestProof(key, context));
    }

    private static void AssertProven(
        CompanionProvenResponse response,
        ReadOnlySpan<byte> key,
        uint epoch,
        ulong sequence,
        string method,
        string path,
        int status)
    {
        Assert.Equal(epoch, response.Context.KeyEpoch);
        Assert.Equal(sequence, response.Context.Sequence);
        Assert.Equal(method, response.Context.RequestMethod);
        Assert.Equal(path, response.Context.RequestPath);
        Assert.Equal(status, response.Context.Status);
        Assert.True(CompanionLoopbackProtocol.VerifyResponseProof(
            key,
            response.Context,
            response.Proof));
    }

    private static byte[] ErrorBody(string code) =>
        Encoding.UTF8.GetBytes(
            $"{{\"schema\":\"tinyrustlm.companion.loopback.error.v1\",\"code\":\"{code}\"}}");

    private static byte[] Replace(byte[] bytes, string oldValue, string newValue) =>
        Encoding.UTF8.GetBytes(
            Encoding.UTF8.GetString(bytes).Replace(
                oldValue,
                newValue,
                StringComparison.Ordinal));

    private static string Hex(byte value) =>
        Convert.ToHexString(Enumerable.Repeat(value, 16).ToArray()).ToLowerInvariant();

    private static string Nonce(byte value) =>
        CompanionLoopbackProtocol.EncodeBase64Url(
            Enumerable.Repeat(value, 32).ToArray());

    private static string Proof(byte value) => Nonce(value);

    private static string MutateProof(string proof) =>
        string.Concat(proof[0] == 'A' ? 'B' : 'A', proof[1..]);

    private static void AssertCode(string code, Action action)
    {
        var exception = Assert.Throws<CompanionProtocolException>(action);
        Assert.Equal(code, exception.Code);
    }

    private static byte[] DecodePairingSecret(CompanionIssuedPairingCode issued)
    {
        var fields = issued.Code.Split(':');
        Assert.Equal(3, fields.Length);
        return CompanionLoopbackProtocol.DecodeBase64Url32(
            fields[2],
            "test-pairing-secret");
    }

    private sealed class PairingAttempt : IDisposable
    {
        private PairingAttempt(
            CompanionPairingBeginResponse begin,
            byte[] secret,
            byte[] sessionKey,
            CompanionPairingCompleteRequest completeRequest)
        {
            Begin = begin;
            Secret = secret;
            SessionKey = sessionKey;
            CompleteRequest = completeRequest;
        }

        internal CompanionPairingBeginResponse Begin { get; }

        internal byte[] Secret { get; }

        internal byte[] SessionKey { get; }

        internal CompanionPairingCompleteRequest CompleteRequest { get; }

        internal static PairingAttempt Create(
            CompanionCapabilityState state,
            byte index)
        {
            var issued = state.IssuePairingCode();
            var secret = DecodePairingSecret(issued);
            var marker = checked((byte)(0x40 + index));
            var begin = state.BeginPairing(new CompanionPairingBeginRequest(
                CompanionLoopbackWire.PairingBeginRequestSchema,
                Hex(marker),
                Nonce(checked((byte)(0x50 + index)))));
            var context = new CompanionPairingProofContext(
                begin.InstallationId,
                begin.ProcessInstanceId,
                begin.ClaimId,
                begin.BrowserNonce,
                begin.ServerNonce,
                begin.SessionId,
                begin.KeyEpoch,
                Host,
                CompanionLoopbackProtocol.ProductionOrigin,
                begin.SessionExpiresAtUtc,
                begin.IdleTimeoutSeconds);
            var sessionKey = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
            var complete = new CompanionPairingCompleteRequest(
                CompanionLoopbackWire.PairingCompleteRequestSchema,
                begin.ClaimId,
                begin.BrowserNonce,
                begin.ServerNonce,
                begin.SessionId,
                CompanionLoopbackProtocol.ComputePairingBrowserProof(sessionKey, context));
            return new PairingAttempt(begin, secret, sessionKey, complete);
        }

        public void Dispose()
        {
            CryptographicOperations.ZeroMemory(Secret);
            CryptographicOperations.ZeroMemory(SessionKey);
        }
    }

    private sealed class PairedFixture : IDisposable
    {
        private PairedFixture(
            CompanionCapabilityState state,
            ManualTimeProvider clock,
            CompanionPairingBeginResponse begin,
            byte[] sessionKey)
        {
            State = state;
            Clock = clock;
            Begin = begin;
            SessionKey = sessionKey;
        }

        internal CompanionCapabilityState State { get; }

        internal ManualTimeProvider Clock { get; }

        internal CompanionPairingBeginResponse Begin { get; }

        internal byte[] SessionKey { get; }

        internal static PairedFixture Create()
        {
            var clock = new ManualTimeProvider(
                new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
            var random = new CounterCryptographicRandom();
            var state = new CompanionCapabilityState(
                Hex(0xa1),
                Hex(0xb1),
                54321,
                clock,
                random);
            var issued = state.IssuePairingCode();
            var secret = CompanionRotationStateTests.DecodePairingSecret(issued);
            var beginRequest = new CompanionPairingBeginRequest(
                CompanionLoopbackWire.PairingBeginRequestSchema,
                Hex(0x40),
                Nonce(0x41));
            var begin = state.BeginPairing(beginRequest);
            var pairingContext = new CompanionPairingProofContext(
                begin.InstallationId,
                begin.ProcessInstanceId,
                begin.ClaimId,
                begin.BrowserNonce,
                begin.ServerNonce,
                begin.SessionId,
                begin.KeyEpoch,
                Host,
                CompanionLoopbackProtocol.ProductionOrigin,
                begin.SessionExpiresAtUtc,
                begin.IdleTimeoutSeconds);
            var sessionKey = CompanionLoopbackProtocol.DeriveSessionKey(secret, pairingContext);
            try
            {
                state.CompletePairing(new CompanionPairingCompleteRequest(
                    CompanionLoopbackWire.PairingCompleteRequestSchema,
                    begin.ClaimId,
                    begin.BrowserNonce,
                    begin.ServerNonce,
                    begin.SessionId,
                    CompanionLoopbackProtocol.ComputePairingBrowserProof(
                        sessionKey,
                        pairingContext)));
                return new PairedFixture(state, clock, begin, sessionKey);
            }
            catch
            {
                CryptographicOperations.ZeroMemory(sessionKey);
                state.Dispose();
                throw;
            }
            finally
            {
                CryptographicOperations.ZeroMemory(secret);
            }
        }

        public void Dispose()
        {
            CryptographicOperations.ZeroMemory(SessionKey);
            State.Dispose();
        }

    }

    private sealed class CounterCryptographicRandom : ICompanionCryptographicRandom
    {
        private byte _next = 1;

        public void Fill(Span<byte> destination)
        {
            destination.Fill(_next);
            _next = checked((byte)(_next + 1));
        }
    }

    internal sealed class ManualTimeProvider(DateTimeOffset initial) : TimeProvider
    {
        private DateTimeOffset _utcNow = initial;
        private long _timestamp;

        public override DateTimeOffset GetUtcNow() => _utcNow;

        public override long GetTimestamp() => _timestamp;

        public override long TimestampFrequency => TimeSpan.TicksPerSecond;

        internal void Advance(TimeSpan duration)
        {
            _utcNow += duration;
            _timestamp = checked(_timestamp + duration.Ticks);
        }
    }
}
