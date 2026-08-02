using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedHostLocalControlGuardTests
{
    [Fact]
    public async Task RemoteControlIsRejectedBeforeTheApprovalPluginByDefault()
    {
        var gate = new RecordingApprovalGate();
        var guard = new SeedHostLocalControlGuard(gate);

        var error = await Assert.ThrowsAsync<SeedHostValidationException>(() =>
            guard.AuthorizeAsync(
                SeedHostLocalControlAction.StartService,
                Path.Combine(Path.GetTempPath(), "seed-fleet.v0.json"),
                new SeedHostLocalControlContext("localendpoint-test", "request-1", IsRemoteRequest: true))
                .AsTask());

        Assert.Equal("remote_control_disabled", error.Code);
        Assert.Equal(0, gate.RequestCount);
    }

    [Fact]
    public async Task ExactShortLivedApprovalCarriesTheRequiredRiskCategory()
    {
        var gate = new RecordingApprovalGate();
        var now = new DateTimeOffset(2026, 7, 13, 22, 0, 0, TimeSpan.Zero);
        var guard = new SeedHostLocalControlGuard(
            gate,
            timeProvider: new FixedTimeProvider(now));

        var authorization = await guard.AuthorizeAsync(
            SeedHostLocalControlAction.InstallService,
            Path.Combine(Path.GetTempPath(), "seed-fleet.v0.json"),
            new SeedHostLocalControlContext("localendpoint-test", "request-2"));

        Assert.Equal("approval-request-2", authorization.DecisionId);
        Assert.Equal(now.AddMinutes(2), authorization.ExpiresUtc);
        Assert.Equal(
            SeedHostLocalControlRiskCategory.LocalServiceInstallation,
            authorization.Intent.RiskCategory);
        Assert.False(authorization.Intent.IsRemoteRequest);
        Assert.Equal(1, gate.RequestCount);
    }

    [Fact]
    public async Task ExpiredOrMismatchedApprovalFailsClosed()
    {
        var now = new DateTimeOffset(2026, 7, 13, 22, 0, 0, TimeSpan.Zero);
        var gate = new RecordingApprovalGate(intent => new SeedHostLocalControlDecision(
            Approved: true,
            "stale-decision",
            SeedHostLocalControlAction.StopService,
            "different-correlation",
            now.Subtract(TimeSpan.FromSeconds(1))));
        var guard = new SeedHostLocalControlGuard(
            gate,
            timeProvider: new FixedTimeProvider(now));

        var error = await Assert.ThrowsAsync<SeedHostValidationException>(() =>
            guard.AuthorizeAsync(
                SeedHostLocalControlAction.RestartService,
                Path.Combine(Path.GetTempPath(), "seed-fleet.v0.json"),
                new SeedHostLocalControlContext("localendpoint-test", "request-3"))
                .AsTask());

        Assert.Equal("approval_contract_mismatch", error.Code);
    }

    private sealed class RecordingApprovalGate : ISeedHostLocalControlApprovalGate
    {
        private readonly Func<SeedHostLocalControlIntent, SeedHostLocalControlDecision> decision;

        internal RecordingApprovalGate(
            Func<SeedHostLocalControlIntent, SeedHostLocalControlDecision>? decision = null)
        {
            this.decision = decision ?? (intent => new SeedHostLocalControlDecision(
                Approved: true,
                $"approval-{intent.CorrelationId}",
                intent.Action,
                intent.CorrelationId,
                intent.RequestedUtc.AddMinutes(2)));
        }

        internal int RequestCount { get; private set; }

        public ValueTask<SeedHostLocalControlDecision> RequestApprovalAsync(
            SeedHostLocalControlIntent intent,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            RequestCount++;
            return ValueTask.FromResult(decision(intent));
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
