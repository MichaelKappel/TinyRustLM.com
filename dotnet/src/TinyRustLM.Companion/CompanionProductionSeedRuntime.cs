namespace TinyRustLM.Companion;

/// <summary>Owns the production local-seed service independently of conversion execution.</summary>
public sealed class CompanionProductionSeedRuntime : IAsyncDisposable
{
    private readonly CompanionDirectCompositionSeedService _service;

    /// <summary>Creates one runtime around its sole service owner.</summary>
    private CompanionProductionSeedRuntime(CompanionDirectCompositionSeedService service)
    {
        _service = service;
    }

    /// <summary>Gets the authenticated loopback service facade.</summary>
    public CompanionDirectCompositionSeedService SeedService => _service;

    /// <summary>Opens only application-owned state and the packaged seed executable.</summary>
    public static CompanionProductionSeedRuntime OpenFromPackageLayout(
        string applicationStateRoot)
    {
        try
        {
            var materializer = CompanionDirectCompositionSeedDescriptorMaterializer
                .OpenFromApplicationStateRoot(applicationStateRoot);
            return new CompanionProductionSeedRuntime(
                new CompanionDirectCompositionSeedService(
                    materializer,
                    () => CompanionDirectCompositionSeedLauncher.OpenFromPackageLayout(
                        materializer)));
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw new CompanionProtocolException("direct-composition-seed-state-invalid");
        }
        catch (CompanionDirectCompositionSeedLaunchException exception)
        {
            throw new CompanionProtocolException(exception.Code ==
                "direct-composition-seed-launch-platform"
                    ? "direct-composition-seed-platform-unsupported"
                    : "direct-composition-seed-tool-invalid");
        }
    }

    /// <summary>Stops any owned seed child and closes the runtime state.</summary>
    public ValueTask DisposeAsync() => _service.DisposeAsync();
}
