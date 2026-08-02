using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

[Collection("MiniModel native")]
public sealed class SeedHostServicePlannerTests
{
    [Fact]
    public async Task ServicePlanIsDeterministicAndKeepsLanesIndependent()
    {
        var paths = MiniModelDevelopmentPaths.Find();
        Environment.SetEnvironmentVariable("MINIMODEL_NATIVE_PATH", paths.NativeLibrary);
        var root = Path.Combine(Path.GetTempPath(), $"seed-service-plan-{Guid.NewGuid():N}");
        var authority = new MiniModelAuthority();
        await using var store = new SeedFleetStore(new SeedFleetStoreOptions(root), authority);
        try
        {
            await store.InitializeAsync("service-plan");
            var options = new SeedHostServiceOptions(
                store.ConfigurationPath,
                typeof(SeedHostServicePlannerTests).Assembly.Location,
                paths.Cli);
            var planner = new SeedHostServicePlanner(authority);

            var first = planner.Create(options);
            var second = planner.Create(options);

            Assert.Equal(first.Platform, second.Platform);
            Assert.Equal(first.FleetId, second.FleetId);
            Assert.Equal(first.ConfigurationPath, second.ConfigurationPath);
            Assert.Equal(first.ToolExecutablePath, second.ToolExecutablePath);
            Assert.Equal(first.MiniModelExecutablePath, second.MiniModelExecutablePath);
            Assert.Equal(first.Definitions, second.Definitions);
            Assert.Equal(2, first.Definitions.Count);
            Assert.Equal(
                ["seed-a", "seed-b"],
                first.Definitions.Select(value => value.LaneId));
            Assert.Equal(2, first.Definitions.Select(value => value.ServiceName).Distinct().Count());
            Assert.All(first.Definitions, definition =>
            {
                Assert.Contains(definition.LaneId, definition.DefinitionContent, StringComparison.Ordinal);
                Assert.Contains("Restart", definition.DefinitionContent, StringComparison.OrdinalIgnoreCase);
                Assert.Contains(store.ConfigurationPath, definition.DefinitionContent, StringComparison.Ordinal);
                Assert.StartsWith(root, definition.OwnedDefinitionPath, StringComparison.OrdinalIgnoreCase);
            });
        }
        finally
        {
            if (Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }
}
