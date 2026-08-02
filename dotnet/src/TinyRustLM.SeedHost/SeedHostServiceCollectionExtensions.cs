using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace TinyRustLM.SeedHost;

/// <summary>Owned store and process settings registered for one seed-host application.</summary>
public sealed record SeedHostRegistrationOptions(
    SeedFleetStoreOptions Store,
    SeedFleetProcessOptions Processes);

/// <summary>Dependency-injection registration for the public seed-host ownership boundaries.</summary>
public static class SeedHostServiceCollectionExtensions
{
    /// <summary>Register one Rust authority, atomic fleet store, admission service, and lane supervisor.</summary>
    public static IServiceCollection AddTinyRustLMSeedHost(
        this IServiceCollection services,
        SeedHostRegistrationOptions options)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(options.Store);
        ArgumentNullException.ThrowIfNull(options.Processes);
        services.TryAddSingleton(options);
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IMiniModelAuthority, MiniModelAuthority>();
        services.TryAddSingleton(provider => new SeedFleetStore(
            provider.GetRequiredService<SeedHostRegistrationOptions>().Store,
            provider.GetRequiredService<IMiniModelAuthority>()));
        services.TryAddSingleton(provider => new SeedModelAdmissionService(
            provider.GetRequiredService<SeedFleetStore>(),
            provider.GetRequiredService<IMiniModelAuthority>()));
        services.TryAddSingleton(provider => new SeedFleetProcessSupervisor(
            provider.GetRequiredService<SeedHostRegistrationOptions>().Processes,
            provider.GetRequiredService<IMiniModelAuthority>(),
            provider.GetService<ILogger<SeedFleetProcessSupervisor>>()));
        services.TryAddSingleton(provider => new SeedFleetLocalProbeService(
            provider.GetRequiredService<IMiniModelAuthority>()));
        services.TryAddSingleton(provider => new SeedAnnouncementService(
            provider.GetRequiredService<IMiniModelAuthority>(),
            provider.GetRequiredService<TimeProvider>()));
        services.TryAddSingleton(provider => new SeedPeerImportService(
            provider.GetRequiredService<IMiniModelAuthority>()));
        return services;
    }

    /// <summary>
    /// Register the optional LocalEndpoint-compatible approval guard after the host registers its
    /// own <see cref="ISeedHostLocalControlApprovalGate"/> implementation. No approval plugin or
    /// remote-control capability is enabled by the core seed-host registration.
    /// </summary>
    public static IServiceCollection AddTinyRustLMSeedHostLocalControl(
        this IServiceCollection services,
        SeedHostLocalControlPolicy? policy = null)
    {
        ArgumentNullException.ThrowIfNull(services);
        var effectivePolicy = policy ?? new SeedHostLocalControlPolicy();
        services.TryAddSingleton(effectivePolicy);
        services.TryAddSingleton(provider => new SeedHostLocalControlGuard(
            provider.GetRequiredService<ISeedHostLocalControlApprovalGate>(),
            provider.GetRequiredService<SeedHostLocalControlPolicy>(),
            provider.GetService<TimeProvider>() ?? TimeProvider.System));
        return services;
    }
}
