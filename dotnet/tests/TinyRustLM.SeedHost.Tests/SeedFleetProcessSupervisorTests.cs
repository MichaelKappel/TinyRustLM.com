using System.Net;
using System.Net.Sockets;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

[Collection("MiniModel native")]
public sealed class SeedFleetProcessSupervisorTests
{
    [Fact]
    public async Task TwoManagedLanesShareOneStoreAndStopIndependently()
    {
        var paths = MiniModelDevelopmentPaths.Find();
        Environment.SetEnvironmentVariable("MINIMODEL_NATIVE_PATH", paths.NativeLibrary);
        await using var fixture = await ManagedFleetFixture.CreateAsync(paths.Cli);
        await using var supervisor = new SeedFleetProcessSupervisor(
            new SeedFleetProcessOptions(
                MiniModelExecutablePath: paths.Cli,
                StartupTimeout: TimeSpan.FromSeconds(10),
                ShutdownTimeout: TimeSpan.FromSeconds(5),
                ProbeInterval: TimeSpan.FromMilliseconds(25)),
            new MiniModelAuthority());

        var started = await supervisor.StartAllAsync(fixture.ConfigurationPath);
        Assert.Equal(2, started.Count);
        Assert.All(started, status => Assert.Equal(SeedLaneProcessState.Ready, status.State));
        Assert.Equal(2, started.Select(status => status.ProcessId).Distinct().Count());
        Assert.Equal(HttpStatusCode.OK, await GetStatusAsync(fixture.LaneAUrl));
        Assert.Equal(HttpStatusCode.OK, await GetStatusAsync(fixture.LaneBUrl));
        using var localProbe = new SeedFleetLocalProbeService(
            new MiniModelAuthority(),
            new SeedFleetLocalProbeOptions(TimeSpan.FromSeconds(2)));
        var bothReachable = await localProbe.ProbeAsync(fixture.ConfigurationPath);
        Assert.True(
            bothReachable.ReachableEndpointCount == 2,
            FormatProbeFailure(bothReachable));
        Assert.True(bothReachable.AllEnabledEndpointsReachable);
        Assert.False(bothReachable.ExternallyReachable);
        Assert.False(bothReachable.AnnouncementEligible);

        var stoppedA = await supervisor.StopLaneAsync("seed-a");
        Assert.Equal(SeedLaneProcessState.Stopped, stoppedA.State);
        Assert.Equal(0, stoppedA.ExitCode);
        Assert.Equal(HttpStatusCode.OK, await GetStatusAsync(fixture.LaneBUrl));
        var oneReachable = await localProbe.ProbeAsync(fixture.ConfigurationPath);
        Assert.Equal(1, oneReachable.ReachableEndpointCount);
        Assert.False(oneReachable.AllEnabledEndpointsReachable);
        Assert.False(oneReachable.ExternallyReachable);
        Assert.False(oneReachable.AnnouncementEligible);
        Assert.Equal(
            SeedLaneProcessState.Ready,
            supervisor.GetStatuses().Single(status => status.LaneId == "seed-b").State);

        var stoppedB = await supervisor.StopLaneAsync("seed-b");
        Assert.Equal(SeedLaneProcessState.Stopped, stoppedB.State);
        Assert.Equal(0, stoppedB.ExitCode);
    }

    private static async Task<HttpStatusCode> GetStatusAsync(string baseUrl)
    {
        var uri = new Uri(new Uri(baseUrl), "minimodel.peer_status.v0.json");
        using var handler = new SocketsHttpHandler { UseProxy = false };
        using var client = new HttpClient(handler);
        using var response = await client.GetAsync(uri);
        _ = await response.Content.ReadAsByteArrayAsync();
        return response.StatusCode;
    }

    private static string FormatProbeFailure(SeedFleetLocalProbeReport report) =>
        string.Join(
            "; ",
            report.Endpoints.Select(endpoint =>
                $"{endpoint.LaneId}/{endpoint.ModelId}: {endpoint.ErrorCode ?? "reachable"}"));

    private sealed class ManagedFleetFixture : IAsyncDisposable
    {
        private ManagedFleetFixture(
            string root,
            string configurationPath,
            string laneAUrl,
            string laneBUrl)
        {
            Root = root;
            ConfigurationPath = configurationPath;
            LaneAUrl = laneAUrl;
            LaneBUrl = laneBUrl;
        }

        private string Root { get; }
        internal string ConfigurationPath { get; }
        internal string LaneAUrl { get; }
        internal string LaneBUrl { get; }

        internal static async Task<ManagedFleetFixture> CreateAsync(string cliPath)
        {
            var artifact = FindFixtureArtifact(cliPath);
            var root = Path.Combine(Path.GetTempPath(), $"managed-seed-fleet-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                const string modelId = "tinyrustlm/managed-seed-test-q8";
                var shareDirectory = Path.Combine(root, "share");
                await RunCliAsync(cliPath, root,
                    "prepare-peer-share", artifact, shareDirectory, modelId, "TinyRustLM/Fixture-Q8");
                var manifestPath = Path.Combine(
                    shareDirectory,
                    "tiny-test-model-q8.minimodel.manifest.v0");
                var pieceDirectory = Path.Combine(
                    shareDirectory,
                    "tiny-test-model-q8.peer-pieces");
                var laneAPort = FreePort();
                var laneBPort = FreePortExcept(laneAPort);
                var laneAUrl = $"http://127.0.0.1:{laneAPort}/models/test/";
                var laneBUrl = $"http://127.0.0.1:{laneBPort}/models/test/";
                var laneAState = Path.Combine(root, "seed-a.state.json");
                var laneBState = Path.Combine(root, "seed-b.state.json");
                await RunCliAsync(cliPath, root,
                    "write-peer-companion-state", manifestPath, pieceDirectory, laneAState, laneAUrl);
                await RunCliAsync(cliPath, root,
                    "write-peer-companion-state", manifestPath, pieceDirectory, laneBState, laneBUrl);

                var model = new SeedFleetModel(
                    modelId,
                    Enabled: true,
                    Relative(root, manifestPath),
                    Relative(root, pieceDirectory));
                var configuration = SeedFleetConfiguration.Create(
                    "managed-process-test",
                    [model],
                    [
                        new SeedFleetLane("seed-a", [new SeedFleetEndpoint(
                            modelId,
                            Relative(root, laneAState),
                            $"127.0.0.1:{laneAPort}",
                            laneAUrl)]),
                        new SeedFleetLane("seed-b", [new SeedFleetEndpoint(
                            modelId,
                            Relative(root, laneBState),
                            $"127.0.0.1:{laneBPort}",
                            laneBUrl)])
                    ]);
                var configurationPath = Path.Combine(root, "seed-fleet.v0.json");
                await File.WriteAllTextAsync(configurationPath, configuration.ToCanonicalJson());
                return new ManagedFleetFixture(root, configurationPath, laneAUrl, laneBUrl);
            }
            catch
            {
                Directory.Delete(root, recursive: true);
                throw;
            }
        }

        public ValueTask DisposeAsync()
        {
            if (Directory.Exists(Root))
            {
                Directory.Delete(Root, recursive: true);
            }
            return ValueTask.CompletedTask;
        }

        private static async Task RunCliAsync(
            string cliPath,
            string workingDirectory,
            params string[] arguments)
        {
            var result = await BoundedProcessRunner.RunAsync(
                new ProcessCommand(cliPath, arguments, workingDirectory),
                new ProcessRunOptions(TimeSpan.FromSeconds(15), 64 * 1024),
                CancellationToken.None);
            Assert.True(
                result.ExitCode == 0,
                result.StandardOutput + Environment.NewLine + result.StandardError);
        }

        private static string FindFixtureArtifact(string cliPath)
        {
            var miniModelRoot = Directory.GetParent(
                Directory.GetParent(Path.GetDirectoryName(cliPath)!)!.FullName)!.FullName;
            var artifact = Path.Combine(miniModelRoot, "artifacts", "demo", "tiny-test-model-q8.slm");
            Assert.True(File.Exists(artifact), $"Missing MiniModel fixture {artifact}");
            return artifact;
        }

        private static int FreePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        private static int FreePortExcept(int excluded)
        {
            var port = FreePort();
            while (port == excluded)
            {
                port = FreePort();
            }
            return port;
        }

        private static string Relative(string root, string path) =>
            Path.GetRelativePath(root, path).Replace('\\', '/');
    }
}
