using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionDirectCompositionSeedLauncherTests : IDisposable
{
    private const string AllowedOrigin = "http://127.0.0.1:4173";
    private const string BindAddress = "127.0.0.1:41870";
    private const string ScenarioFileName = ".tinyrustlm-p2p-seed-fixture-scenario";
    private const string ProcessFileName = ".tinyrustlm-p2p-seed-fixture-process";
    private const string DescendantFileName = ".tinyrustlm-p2p-seed-fixture-descendant";

    private readonly string _parent = Path.Combine(
        ScratchRoot(),
        $"tinyrustlm-companion-seed-launch-{Guid.NewGuid():N}");

    [Fact]
    public async Task VerifiedPlanStartsOneFixtureAndReturnsExactReadiness()
    {
        using var harness = await Harness.CreateAsync(_parent, "success");
        var plan = await harness.CreatePlanAsync();

        var session = await harness.Launcher.LaunchAsync(plan);

        Assert.Equal(CompanionDirectCompositionSeedLauncher.Protocol, session.Readiness.Protocol);
        Assert.Equal(harness.Materialization.CompositionId, session.Readiness.CompositionId);
        Assert.Equal($"http://{BindAddress}", session.Readiness.BoundOrigin);
        Assert.Equal(AllowedOrigin, session.Readiness.AllowedBrowserOrigin);
        Assert.False(session.TerminalStatus.IsCompleted);

        await session.DisposeAsync();
        var first = await session.TerminalStatus;
        var second = await session.TerminalStatus;
        Assert.Same(first, second);
        Assert.Equal(CompanionDirectCompositionSeedTerminalState.OwnerStopped, first.State);
        Assert.Equal("direct-composition-seed-launch-stopped", first.Code);
    }

    [Theory]
    [InlineData("malformed-readiness", "direct-composition-seed-launch-readiness-json")]
    [InlineData("wrong-protocol", "direct-composition-seed-launch-readiness-mismatch")]
    [InlineData("wrong-composition", "direct-composition-seed-launch-readiness-mismatch")]
    [InlineData("wrong-bound-origin", "direct-composition-seed-launch-readiness-mismatch")]
    [InlineData("wrong-allowed-origin", "direct-composition-seed-launch-readiness-mismatch")]
    [InlineData("extra-output", "direct-composition-seed-launch-unexpected-stdout")]
    [InlineData("oversized-readiness", "direct-composition-seed-launch-readiness-output-limit")]
    [InlineData("stderr", "direct-composition-seed-launch-unexpected-stderr")]
    public async Task HostileStartupOutputIsTypedTerminalAndKillsTheChild(
        string scenario,
        string expectedCode)
    {
        using var harness = await Harness.CreateAsync(_parent, scenario);
        var plan = await harness.CreatePlanAsync();

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(() =>
            harness.Launcher.LaunchAsync(plan));

        Assert.Equal(expectedCode, error.Code);
        await RequireRecordedProcessExitedAsync(harness.DescriptorRoot, ProcessFileName);
        Assert.DoesNotContain(harness.Fixture.Parent, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReadinessTimeoutIsBoundedTypedAndKillsTheChild()
    {
        using var harness = await Harness.CreateAsync(
            _parent,
            "timeout",
            TimeSpan.FromMilliseconds(300));
        var plan = await harness.CreatePlanAsync();
        var stopwatch = Stopwatch.StartNew();

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(() =>
            harness.Launcher.LaunchAsync(plan));

        stopwatch.Stop();
        Assert.Equal("direct-composition-seed-launch-readiness-timeout", error.Code);
        Assert.InRange(stopwatch.Elapsed, TimeSpan.FromMilliseconds(100), TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task EarlyExitIsTypedAndNeverProducesAReadySession()
    {
        using var harness = await Harness.CreateAsync(_parent, "early-exit");
        var plan = await harness.CreatePlanAsync();

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(() =>
            harness.Launcher.LaunchAsync(plan));

        Assert.Equal("direct-composition-seed-launch-early-exit", error.Code);
        await RequireRecordedProcessExitedAsync(harness.DescriptorRoot, ProcessFileName);
    }

    [Fact]
    public async Task ParentCancellationAfterReadinessKillsTheEntireFixtureTree()
    {
        using var harness = await Harness.CreateAsync(_parent, "cancellation-tree");
        var plan = await harness.CreatePlanAsync();
        using var cancellation = new CancellationTokenSource();
        var session = await harness.Launcher.LaunchAsync(plan, cancellation.Token);
        var descendantPath = Path.Combine(harness.DescriptorRoot, DescendantFileName);
        await RequireFileAsync(descendantPath);
        var descendantPid = int.Parse(File.ReadAllText(descendantPath));

        cancellation.Cancel();
        var status = await session.TerminalStatus.WaitAsync(TimeSpan.FromSeconds(5));

        Assert.Equal(CompanionDirectCompositionSeedTerminalState.ParentCancelled, status.State);
        Assert.Equal("direct-composition-seed-launch-cancelled", status.Code);
        await RequireProcessExitedAsync(descendantPid);
        await session.DisposeAsync();
        Assert.Same(status, await session.TerminalStatus);
    }

    [Fact]
    public async Task OutputAfterValidatedReadinessBecomesImmutableProtocolFailure()
    {
        using var harness = await Harness.CreateAsync(_parent, "late-extra-output");
        var plan = await harness.CreatePlanAsync();
        var session = await harness.Launcher.LaunchAsync(plan);

        var status = await session.TerminalStatus.WaitAsync(TimeSpan.FromSeconds(5));

        Assert.Equal(CompanionDirectCompositionSeedTerminalState.ProtocolFailure, status.State);
        Assert.Equal("direct-composition-seed-launch-unexpected-stdout", status.Code);
        await session.DisposeAsync();
        Assert.Same(status, await session.TerminalStatus);
    }

    [Fact]
    public async Task LauncherPermitsOnlyOneActiveChildAndPlansAreSingleUse()
    {
        using var harness = await Harness.CreateAsync(_parent, "success");
        var firstPlan = await harness.CreatePlanAsync();
        var secondPlan = await harness.CreatePlanAsync();
        var first = await harness.Launcher.LaunchAsync(firstPlan);

        var activeError = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(
            () => harness.Launcher.LaunchAsync(secondPlan));
        var usedError = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(
            () => harness.Launcher.LaunchAsync(firstPlan));

        Assert.Equal("direct-composition-seed-launch-already-running", activeError.Code);
        Assert.Equal("direct-composition-seed-launch-plan-used", usedError.Code);
        await first.DisposeAsync();
    }

    [Fact]
    public async Task MemberIdentityDriftIsRejectedBeforeAnyChildStarts()
    {
        using var harness = await Harness.CreateAsync(_parent, "success");
        var plan = await harness.CreatePlanAsync();
        var memberPath = Path.Combine(harness.Fixture.OutputRoot, "model.slm2");
        var bytes = File.ReadAllBytes(memberPath);
        bytes[0] ^= 0x5a;
        File.WriteAllBytes(memberPath, bytes);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(() =>
            harness.Launcher.LaunchAsync(plan));

        Assert.Equal("direct-composition-seed-launch-identity-drift", error.Code);
        Assert.False(File.Exists(Path.Combine(harness.DescriptorRoot, ProcessFileName)));
    }

    [Fact]
    public async Task ReparseMemberDriftIsRejectedBeforeAnyChildStarts()
    {
        using var harness = await Harness.CreateAsync(_parent, "success");
        var plan = await harness.CreatePlanAsync();
        var memberPath = Path.Combine(harness.Fixture.OutputRoot, "model.slm2");
        var movedPath = Path.Combine(harness.Fixture.OutputRoot, "moved-model.slm2");
        File.Move(memberPath, movedPath);
        _ = File.CreateSymbolicLink(memberPath, movedPath);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedLaunchException>(() =>
            harness.Launcher.LaunchAsync(plan));

        Assert.Equal("direct-composition-seed-launch-identity-drift", error.Code);
        Assert.False(File.Exists(Path.Combine(harness.DescriptorRoot, ProcessFileName)));
    }

    [Theory]
    [InlineData("localhost:8080", AllowedOrigin, "direct-composition-seed-launch-bind")]
    [InlineData("127.0.0.1", AllowedOrigin, "direct-composition-seed-launch-bind")]
    [InlineData(BindAddress, "*", "direct-composition-seed-launch-origin")]
    [InlineData(BindAddress, "http://user@127.0.0.1:4173", "direct-composition-seed-launch-origin")]
    [InlineData(BindAddress, "http://127.0.0.1:4173/path", "direct-composition-seed-launch-origin")]
    [InlineData(BindAddress, "http://127.0.0.1:4173/", "direct-composition-seed-launch-origin")]
    public void BindAndOriginConfigurationMustBeExactCanonicalOrigins(
        string bind,
        string origin,
        string expectedCode)
    {
        var error = Assert.Throws<CompanionDirectCompositionSeedLaunchException>(() =>
            CompanionDirectCompositionSeedLaunchConfiguration.Create(bind, origin));

        Assert.Equal(expectedCode, error.Code);
    }

    [Fact]
    public void PublicLaunchSurfaceAcceptsNoExecutableOrMemberPaths()
    {
        Assert.Empty(typeof(CompanionDirectCompositionSeedLaunchPlan)
            .GetConstructors(BindingFlags.Public | BindingFlags.Instance));
        Assert.DoesNotContain(
            typeof(CompanionDirectCompositionSeedLaunchPlan).GetProperties(),
            property => property.Name.Contains("Path", StringComparison.Ordinal));
        Assert.DoesNotContain(
            typeof(CompanionDirectCompositionSeedLauncher).GetMethods(
                BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance),
            method => method.GetParameters().Any(parameter =>
                parameter.Name?.Contains("path", StringComparison.OrdinalIgnoreCase) == true &&
                parameter.Name != "applicationStateRoot"));
    }

    private sealed class Harness : IDisposable
    {
        private Harness(
            CompanionArtifactTransferTests.TransferFixture fixture,
            CompanionDirectCompositionSeedMaterialization materialization,
            CompanionDirectCompositionSeedLauncher launcher)
        {
            Fixture = fixture;
            Materialization = materialization;
            Launcher = launcher;
            DescriptorRoot = Path.GetDirectoryName(materialization.DescriptorPath)
                ?? throw new InvalidOperationException("Descriptor root is unavailable.");
        }

        internal CompanionArtifactTransferTests.TransferFixture Fixture { get; }

        internal CompanionDirectCompositionSeedMaterialization Materialization { get; }

        internal CompanionDirectCompositionSeedLauncher Launcher { get; }

        internal string DescriptorRoot { get; }

        internal static async Task<Harness> CreateAsync(
            string parent,
            string scenario,
            TimeSpan? readinessTimeout = null)
        {
            var fixture = new CompanionArtifactTransferTests.TransferFixture(
                parent,
                "rust-seed-pass");
            try
            {
                var available = await fixture.CreateAvailableAsync();
                var materializer = CompanionDirectCompositionSeedDescriptorMaterializer
                    .OpenForJournal(fixture.Journal, fixture.Parent);
                var materialization = await materializer.MaterializeAsync(available.OperationId);
                var descriptorRoot = Path.GetDirectoryName(materialization.DescriptorPath)!;
                File.WriteAllText(Path.Combine(descriptorRoot, ScenarioFileName), scenario);
                var launcher = CompanionDirectCompositionSeedLauncher.OpenForTests(
                    materializer,
                    FixtureToolPath(),
                    readinessTimeout ?? TimeSpan.FromSeconds(3));
                return new Harness(fixture, materialization, launcher);
            }
            catch
            {
                fixture.Dispose();
                throw;
            }
        }

        internal Task<CompanionDirectCompositionSeedLaunchPlan> CreatePlanAsync() =>
            Launcher.CreateLaunchPlanAsync(
                Materialization,
                CompanionDirectCompositionSeedLaunchConfiguration.Create(
                    BindAddress,
                    AllowedOrigin));

        public void Dispose() => Fixture.Dispose();
    }

    private static string FixtureToolPath()
    {
        var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent?.Name
            ?? throw new InvalidOperationException("Cannot determine test configuration.");
        var fileName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? "TinyRustLM.P2PSeedFixtureTool.exe"
            : "TinyRustLM.P2PSeedFixtureTool";
        return Path.Combine(
            RepositoryRoot(),
            "dotnet",
            "tools",
            "TinyRustLM.P2PSeedFixtureTool",
            "bin",
            configuration,
            "net8.0",
            fileName);
    }

    private static async Task RequireRecordedProcessExitedAsync(string root, string fileName)
    {
        var path = Path.Combine(root, fileName);
        await RequireFileAsync(path);
        await RequireProcessExitedAsync(int.Parse(File.ReadAllText(path)));
    }

    private static async Task RequireFileAsync(string path)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        while (!File.Exists(path) && DateTime.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(20));
        }
        Assert.True(File.Exists(path), $"Fixture evidence was not written: {Path.GetFileName(path)}");
    }

    private static async Task RequireProcessExitedAsync(int processId)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var process = Process.GetProcessById(processId);
                if (process.HasExited)
                {
                    return;
                }
            }
            catch (ArgumentException)
            {
                return;
            }
            await Task.Delay(TimeSpan.FromMilliseconds(20));
        }
        Assert.Fail($"Fixture process {processId} remained alive.");
    }

    private static string ScratchRoot()
    {
        var repositoryDrive = Path.GetPathRoot(RepositoryRoot());
        var tempDrive = Path.GetPathRoot(Path.GetTempPath());
        if (OperatingSystem.IsWindows() &&
            !string.Equals(repositoryDrive, tempDrive, StringComparison.OrdinalIgnoreCase))
        {
            return Path.Combine(repositoryDrive!, "Source", ".codex-tmp");
        }
        return Path.GetTempPath();
    }

    private static string RepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Cargo.toml")) &&
                File.Exists(Path.Combine(current.FullName, "dotnet", "TinyRustLM.sln")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Cannot locate repository root.");
    }

    public void Dispose()
    {
        if (Directory.Exists(_parent))
        {
            Directory.Delete(_parent, recursive: true);
        }
    }
}
