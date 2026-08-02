using System.Diagnostics;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

[Collection("MiniModel native")]
public sealed class MiniModelAuthorityTests
{
    [Fact]
    public void CSharpFleetLoadsThroughBothRustCliAndNativeAbi()
    {
        var paths = MiniModelDevelopmentPaths.Find();
        Environment.SetEnvironmentVariable("MINIMODEL_NATIVE_PATH", paths.NativeLibrary);
        var root = Path.Combine(Path.GetTempPath(), $"seed-host-cross-language-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            var fleet = SeedFleetConfiguration.Create(
                "dotnet-rust-contract",
                [],
                [new SeedFleetLane("seed-a", []), new SeedFleetLane("seed-b", [])]);
            var configPath = Path.Combine(root, "seed-fleet.v0.json");
            File.WriteAllText(configPath, fleet.ToCanonicalJson());

            var cli = Process.Start(new ProcessStartInfo
            {
                FileName = paths.Cli,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                ArgumentList =
                {
                    "inspect-seed-fleet",
                    configPath
                }
            }) ?? throw new InvalidOperationException("Failed to start MiniModel CLI.");
            var stdout = cli.StandardOutput.ReadToEnd();
            var stderr = cli.StandardError.ReadToEnd();
            Assert.True(cli.WaitForExit(10_000), "MiniModel CLI timed out.");
            Assert.True(cli.ExitCode == 0, stdout + Environment.NewLine + stderr);
            Assert.Contains("fleet_id: dotnet-rust-contract", stdout, StringComparison.Ordinal);

            var authority = new MiniModelAuthority();
            Assert.Equal(2u, authority.NativeAbiVersion);
            var inspection = authority.InspectSeedFleet(configPath);
            Assert.Equal("dotnet-rust-contract", inspection.FleetId);
            Assert.Equal(20, inspection.TargetModelCount);
            Assert.Equal(0, inspection.AdmittedModelCount);
            Assert.Equal(20, inspection.RemainingModelCapacity);
            Assert.Equal(["seed-a", "seed-b"], inspection.LaneIds);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void NativeErrorsAndEmbeddedNulInputsFailClosed()
    {
        var paths = MiniModelDevelopmentPaths.Find();
        Environment.SetEnvironmentVariable("MINIMODEL_NATIVE_PATH", paths.NativeLibrary);
        var authority = new MiniModelAuthority();

        var nativeError = Assert.Throws<SeedHostException>(() =>
            authority.InspectSeedFleet(Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".json")));
        Assert.Equal("minimodel_operation_failed", nativeError.Code);
        Assert.DoesNotContain("panic", nativeError.Message, StringComparison.OrdinalIgnoreCase);

        var argumentError = Assert.Throws<ArgumentException>(() =>
            authority.InspectSeedFleet("bad\0path"));
        Assert.Equal("configPath", argumentError.ParamName);

        var receiptError = Assert.Throws<SeedHostException>(() =>
            authority.InspectExternalProbeReceipt(
                Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".receipt.json"),
                Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".trust.json"),
                Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".fleet.json")));
        Assert.Equal("minimodel_operation_failed", receiptError.Code);

        var receiptArgumentError = Assert.Throws<ArgumentException>(() =>
            authority.InspectExternalProbeReceipt(
                "bad\0receipt",
                "trust.json",
                "fleet.json"));
        Assert.Equal("receiptPath", receiptArgumentError.ParamName);
    }
}

[CollectionDefinition("MiniModel native", DisableParallelization = true)]
public sealed class MiniModelNativeCollection;

internal sealed record MiniModelDevelopmentPaths(string Cli, string NativeLibrary)
{
    internal static MiniModelDevelopmentPaths Find()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var depth = 0; depth < 12 && current is not null; depth++, current = current.Parent)
        {
            var rustRoot = current.Parent?.FullName;
            if (rustRoot is null)
            {
                continue;
            }
            var miniModelRoot = Path.Combine(rustRoot, "MiniModel.org");
            foreach (var profile in new[] { "release", "debug" })
            {
                var cli = Path.Combine(
                    miniModelRoot,
                    "target",
                    profile,
                    OperatingSystem.IsWindows() ? "minimodel.exe" : "minimodel");
                var native = Path.Combine(
                    miniModelRoot,
                    "target",
                    profile,
                    OperatingSystem.IsWindows()
                        ? "minimodel_native.dll"
                        : OperatingSystem.IsMacOS()
                            ? "libminimodel_native.dylib"
                            : "libminimodel_native.so");
                if (File.Exists(cli) && File.Exists(native))
                {
                    return new MiniModelDevelopmentPaths(cli, native);
                }
            }
        }
        throw new FileNotFoundException(
            "MiniModel release/debug CLI and native outputs were not found. Build the sibling MiniModel.org workspace first.");
    }
}
