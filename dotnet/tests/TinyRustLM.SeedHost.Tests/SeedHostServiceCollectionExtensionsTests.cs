using Microsoft.Extensions.DependencyInjection;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedHostServiceCollectionExtensionsTests
{
    [Fact]
    public async Task RegistrationUsesOneAuthorityStoreAdmissionServiceAndSupervisor()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-di-{Guid.NewGuid():N}");
        var services = new ServiceCollection();
        services.AddTinyRustLMSeedHost(new SeedHostRegistrationOptions(
            new SeedFleetStoreOptions(root),
            new SeedFleetProcessOptions()));

        await using var provider = services.BuildServiceProvider();
        Assert.Same(
            provider.GetRequiredService<IMiniModelAuthority>(),
            provider.GetRequiredService<IMiniModelAuthority>());
        Assert.Same(
            provider.GetRequiredService<SeedFleetStore>(),
            provider.GetRequiredService<SeedFleetStore>());
        Assert.Same(
            provider.GetRequiredService<SeedModelAdmissionService>(),
            provider.GetRequiredService<SeedModelAdmissionService>());
        Assert.Same(
            provider.GetRequiredService<SeedFleetProcessSupervisor>(),
            provider.GetRequiredService<SeedFleetProcessSupervisor>());
        Assert.Same(
            provider.GetRequiredService<SeedFleetLocalProbeService>(),
            provider.GetRequiredService<SeedFleetLocalProbeService>());
    }

    [Fact]
    public void LocalControlRegistrationRequiresAndReusesTheHostApprovalGate()
    {
        var gate = new ApprovalGate();
        var services = new ServiceCollection();
        services.AddSingleton<ISeedHostLocalControlApprovalGate>(gate);
        services.AddTinyRustLMSeedHostLocalControl();

        using var provider = services.BuildServiceProvider();
        Assert.Same(gate, provider.GetRequiredService<ISeedHostLocalControlApprovalGate>());
        Assert.Same(
            provider.GetRequiredService<SeedHostLocalControlGuard>(),
            provider.GetRequiredService<SeedHostLocalControlGuard>());
    }

    private sealed class ApprovalGate : ISeedHostLocalControlApprovalGate
    {
        public ValueTask<SeedHostLocalControlDecision> RequestApprovalAsync(
            SeedHostLocalControlIntent intent,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException("Registration test does not request approval.");
    }
}
