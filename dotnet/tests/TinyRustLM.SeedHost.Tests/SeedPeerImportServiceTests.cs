using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

[Collection("MiniModel native")]
public sealed class SeedPeerImportServiceTests
{
    [Fact]
    public async Task ManagedImportRunsCancellableRustPathAndReinspectsReceipt()
    {
        var paths = MiniModelDevelopmentPaths.Find();
        Environment.SetEnvironmentVariable("MINIMODEL_NATIVE_PATH", paths.NativeLibrary);
        var miniModelRoot = paths.SourceRoot;
        var manifest = Path.Combine(
            miniModelRoot,
            "examples",
            "tiny-test-model-q8.minimodel.manifest.v0");
        var requestTemplate = Path.Combine(
            miniModelRoot,
            "examples",
            "tiny-test-model-q8.minimodel-peer-import-request.json");
        var artifact = paths.FixtureArtifact;
        Assert.True(File.Exists(manifest));
        Assert.True(File.Exists(requestTemplate));
        Assert.True(File.Exists(artifact));

        var root = Path.Combine(Path.GetTempPath(), $"seed-managed-import-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        Process? server = null;
        try
        {
            var pieceDirectory = Path.Combine(root, "sender-pieces");
            var statePath = Path.Combine(root, "sender-state.json");
            var requestPath = Path.Combine(root, "request.json");
            var outputDirectory = Path.Combine(root, "imported");
            var port = FreePort();
            var bindAddress = $"127.0.0.1:{port}";
            var peerBaseUrl = $"http://{bindAddress}/peer/";
            RunCli(paths.Cli, "export-peer-pieces", manifest, artifact, pieceDirectory);
            RunCli(
                paths.Cli,
                "write-peer-companion-state",
                manifest,
                pieceDirectory,
                statePath,
                peerBaseUrl);
            File.WriteAllText(
                requestPath,
                File.ReadAllText(requestTemplate).Replace(
                    "http://127.0.0.1:8123/",
                    peerBaseUrl,
                    StringComparison.Ordinal));
            server = StartServer(paths.Cli, statePath, manifest, pieceDirectory, bindAddress);
            await WaitForPeerAsync(peerBaseUrl, server);

            var service = new SeedPeerImportService(new MiniModelAuthority());
            var report = await service.ImportAsync(new SeedPeerImportOptions(
                requestPath,
                manifest,
                outputDirectory,
                paths.Cli,
                TimeSpan.FromMinutes(1)));

            Assert.False(report.Resumed);
            Assert.Equal(1, report.DownloadedPieceCount);
            Assert.Equal(0, report.ReusedPieceCount);
            Assert.Equal(1, report.TransferConcurrency);
            Assert.True(File.Exists(report.OutputArtifactPath));
            Assert.True(File.Exists(report.ReceiptPath));
            Assert.True(File.Exists(report.ResumeStatePath));
            Assert.Equal(File.ReadAllBytes(artifact), File.ReadAllBytes(report.OutputArtifactPath));
        }
        finally
        {
            StopServer(server);
            if (Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }

    private static void RunCli(string executable, params string[] arguments)
    {
        using var process = Process.Start(StartInfo(executable, arguments))
            ?? throw new InvalidOperationException("Failed to start MiniModel CLI.");
        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        Assert.True(process.WaitForExit(30_000), "MiniModel CLI timed out.");
        Assert.True(process.ExitCode == 0, stdout + Environment.NewLine + stderr);
    }

    private static Process StartServer(
        string executable,
        string statePath,
        string manifestPath,
        string pieceDirectory,
        string bindAddress)
    {
        var startInfo = StartInfo(
            executable,
            ["serve-peer-companion", statePath, manifestPath, pieceDirectory, bindAddress]);
        return Process.Start(startInfo)
            ?? throw new InvalidOperationException("Failed to start MiniModel peer server.");
    }

    private static ProcessStartInfo StartInfo(string executable, IReadOnlyList<string> arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }
        return startInfo;
    }

    private static async Task WaitForPeerAsync(string baseUrl, Process server)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
        var deadline = DateTimeOffset.UtcNow + TimeSpan.FromSeconds(10);
        while (DateTimeOffset.UtcNow < deadline)
        {
            Assert.False(server.HasExited, "MiniModel peer server exited before readiness.");
            try
            {
                using var response = await client.GetAsync(
                    new Uri(new Uri(baseUrl), "minimodel.peer_status.v0.json"));
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // Listener startup is asynchronous.
            }
            catch (TaskCanceledException)
            {
                // Retry until the bounded readiness deadline.
            }
            await Task.Delay(50);
        }
        throw new TimeoutException("MiniModel peer server did not become ready.");
    }

    private static void StopServer(Process? server)
    {
        if (server is null)
        {
            return;
        }
        using (server)
        {
            if (!server.HasExited)
            {
                server.Kill(entireProcessTree: true);
                server.WaitForExit(5_000);
            }
        }
    }

    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }
}
