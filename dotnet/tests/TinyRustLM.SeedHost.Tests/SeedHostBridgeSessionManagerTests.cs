using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedHostBridgeSessionManagerTests
{
    private static readonly DateTimeOffset TestNow =
        new(2026, 7, 14, 1, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PairingCodeIsSingleUseAndCannotEscalateScopes()
    {
        var time = new AdjustableTimeProvider(TestNow);
        var manager = CreateManager(time);
        var challenge = manager.CreatePairingChallenge([
            SeedHostBridgeScope.Status,
            SeedHostBridgeScope.ModelsRead,
            SeedHostBridgeScope.ImportsCreate
        ]);

        var session = manager.Pair(
            "https://tinyrustlm.com",
            challenge.Code,
            [SeedHostBridgeScope.Status, SeedHostBridgeScope.ModelsRead]);

        Assert.NotEqual(challenge.Code, session.Capability);
        Assert.Equal("https://tinyrustlm.com", session.Origin);
        Assert.Equal(
            [SeedHostBridgeScope.Status, SeedHostBridgeScope.ModelsRead],
            session.Scopes);

        var replay = Assert.Throws<SeedHostValidationException>(() => manager.Pair(
            "https://tinyrustlm.com",
            challenge.Code,
            [SeedHostBridgeScope.Status]));
        Assert.Equal("bridge_pairing_code_consumed", replay.Code);

        var secondChallenge = manager.CreatePairingChallenge([
            SeedHostBridgeScope.Status,
            SeedHostBridgeScope.ModelsRead
        ]);
        var escalation = Assert.Throws<SeedHostValidationException>(() => manager.Pair(
            "https://tinyrustlm.com",
            secondChallenge.Code,
            [SeedHostBridgeScope.SharingManage]));
        Assert.Equal("bridge_scope_not_granted", escalation.Code);
    }

    [Fact]
    public void CapabilitiesAreOriginBoundShortLivedReplayProtectedAndRevocable()
    {
        var time = new AdjustableTimeProvider(TestNow);
        var manager = CreateManager(time);
        var challenge = manager.CreatePairingChallenge([
            SeedHostBridgeScope.Status,
            SeedHostBridgeScope.ImportsCreate
        ]);
        var session = manager.Pair(
            "https://tinyrustlm.com",
            challenge.Code,
            [SeedHostBridgeScope.Status, SeedHostBridgeScope.ImportsCreate]);

        var authorization = manager.Authorize(
            "https://tinyrustlm.com",
            session.Capability,
            SeedHostBridgeScope.ImportsCreate,
            requestId: "import-request-1",
            isMutation: true);
        Assert.Equal(session.SessionId, authorization.SessionId);

        var replay = Assert.Throws<SeedHostValidationException>(() => manager.Authorize(
            "https://tinyrustlm.com",
            session.Capability,
            SeedHostBridgeScope.ImportsCreate,
            requestId: "import-request-1",
            isMutation: true));
        Assert.Equal("bridge_request_replay", replay.Code);

        var wrongOrigin = Assert.Throws<SeedHostValidationException>(() => manager.Authorize(
            "https://other.example",
            session.Capability,
            SeedHostBridgeScope.Status));
        Assert.Equal("bridge_origin_mismatch", wrongOrigin.Code);

        manager.Revoke("https://tinyrustlm.com", session.Capability);
        var revoked = Assert.Throws<SeedHostValidationException>(() => manager.Authorize(
            "https://tinyrustlm.com",
            session.Capability,
            SeedHostBridgeScope.Status));
        Assert.Equal("bridge_capability_revoked", revoked.Code);

        var expiringChallenge = manager.CreatePairingChallenge([SeedHostBridgeScope.Status]);
        var expiringSession = manager.Pair(
            "https://tinyrustlm.com",
            expiringChallenge.Code,
            [SeedHostBridgeScope.Status]);
        time.Advance(TimeSpan.FromMinutes(6));
        var expired = Assert.Throws<SeedHostValidationException>(() => manager.Authorize(
            "https://tinyrustlm.com",
            expiringSession.Capability,
            SeedHostBridgeScope.Status));
        Assert.Equal("bridge_capability_expired", expired.Code);
    }

    [Fact]
    public void PairingRejectsExpiredCodesAndUnapprovedOrigins()
    {
        var time = new AdjustableTimeProvider(TestNow);
        var manager = CreateManager(time);
        var challenge = manager.CreatePairingChallenge([SeedHostBridgeScope.Status]);

        var originError = Assert.Throws<SeedHostValidationException>(() => manager.Pair(
            "https://attacker.example",
            challenge.Code,
            [SeedHostBridgeScope.Status]));
        Assert.Equal("bridge_origin_denied", originError.Code);

        time.Advance(TimeSpan.FromMinutes(3));
        var expiryError = Assert.Throws<SeedHostValidationException>(() => manager.Pair(
            "https://tinyrustlm.com",
            challenge.Code,
            [SeedHostBridgeScope.Status]));
        Assert.Equal("bridge_pairing_code_expired", expiryError.Code);
    }

    [Fact]
    public void RotationReplacesCapabilityWithoutChangingOriginOrScopes()
    {
        var time = new AdjustableTimeProvider(TestNow);
        var manager = CreateManager(time);
        var challenge = manager.CreatePairingChallenge([
            SeedHostBridgeScope.Status,
            SeedHostBridgeScope.ModelsRead
        ]);
        var original = manager.Pair(
            "https://tinyrustlm.com",
            challenge.Code,
            [SeedHostBridgeScope.Status, SeedHostBridgeScope.ModelsRead]);

        time.Advance(TimeSpan.FromMinutes(4));
        var rotated = manager.Rotate(
            "https://tinyrustlm.com",
            original.Capability);

        Assert.NotEqual(original.SessionId, rotated.SessionId);
        Assert.NotEqual(original.Capability, rotated.Capability);
        Assert.Equal(original.Origin, rotated.Origin);
        Assert.Equal(original.Scopes, rotated.Scopes);
        Assert.Equal(TestNow + TimeSpan.FromMinutes(9), rotated.ExpiresUtc);

        var oldCapability = Assert.Throws<SeedHostValidationException>(() => manager.Authorize(
            "https://tinyrustlm.com",
            original.Capability,
            SeedHostBridgeScope.Status));
        Assert.Equal("bridge_capability_revoked", oldCapability.Code);

        var authorization = manager.Authorize(
            "https://tinyrustlm.com",
            rotated.Capability,
            SeedHostBridgeScope.ModelsRead);
        Assert.Equal(rotated.SessionId, authorization.SessionId);
    }

    private static SeedHostBridgeSessionManager CreateManager(TimeProvider timeProvider) =>
        new(new SeedHostBridgeSecurityPolicy(
            AllowedOrigins: ["https://tinyrustlm.com", "https://other.example"],
            PairingLifetime: TimeSpan.FromMinutes(2),
            CapabilityLifetime: TimeSpan.FromMinutes(5),
            MaximumReplayEntriesPerSession: 32), timeProvider);

    private sealed class AdjustableTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        private DateTimeOffset utcNow = utcNow;

        public override DateTimeOffset GetUtcNow() => utcNow;

        internal void Advance(TimeSpan duration) => utcNow += duration;
    }
}
