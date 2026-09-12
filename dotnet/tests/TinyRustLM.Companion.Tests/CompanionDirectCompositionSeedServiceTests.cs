using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionDirectCompositionSeedServiceTests : IDisposable
{
    private readonly CanonicalTestScratch _scratch = new("seed-service");
    private string _parent => _scratch.Path;

    [Fact]
    public async Task StartReadAndStopAreIdempotentAndRetainTerminalEvidence()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        await using var service = harness.CreateService();
        var start = StartRequest(harness.OperationId);

        var first = await service.StartOrReadAsync(start);
        var repeated = await service.StartOrReadAsync(start);
        var read = await service.ReadAsync(harness.OperationId);

        Assert.Equal(first, repeated);
        Assert.Equal(first, read);
        Assert.Equal(CompanionDirectCompositionSeedState.Ready, first.State);
        Assert.Equal(1UL, first.Sequence);
        Assert.Equal(CompanionDirectCompositionSeedLauncher.Protocol, first.Protocol);
        Assert.StartsWith("http://127.0.0.1:", first.BoundOrigin, StringComparison.Ordinal);
        Assert.Equal(CompanionLoopbackProtocol.ProductionOrigin, first.AllowedBrowserOrigin);
        Assert.Null(first.TerminalCode);
        var processId = await harness.ReadProcessIdAsync();

        var stopped = await service.StopAndWaitAsync(
            harness.OperationId,
            StopRequest());
        var stoppedAgain = await service.StopAndWaitAsync(
            harness.OperationId,
            StopRequest());

        Assert.Equal(stopped, stoppedAgain);
        Assert.Equal(CompanionDirectCompositionSeedState.Stopped, stopped.State);
        Assert.Equal(2UL, stopped.Sequence);
        Assert.Equal("direct-composition-seed-launch-stopped", stopped.TerminalCode);
        Assert.Null(stopped.Protocol);
        Assert.Null(stopped.BoundOrigin);
        Assert.Null(stopped.AllowedBrowserOrigin);
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(processId);
    }

    [Fact]
    public async Task MultipleSeedsRemainIndependentAndDuplicateStartsAreIdempotent()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        var secondOperationId = await harness.AddAvailableOperationAsync('b');
        await using var service = harness.CreateService();

        var first = await service.StartOrReadAsync(StartRequest(harness.OperationId));
        var firstProcessId = await harness.ReadProcessIdAsync();
        harness.SetScenario("success");
        var second = await service.StartOrReadAsync(StartRequest(secondOperationId));
        var secondProcessId = await harness.ReadProcessIdAsync();
        var firstAgain = await service.StartOrReadAsync(StartRequest(harness.OperationId));

        Assert.Equal(first, firstAgain);
        Assert.Equal(CompanionDirectCompositionSeedState.Ready, first.State);
        Assert.Equal(CompanionDirectCompositionSeedState.Ready, second.State);
        Assert.NotEqual(first.OperationId, second.OperationId);
        Assert.NotEqual(firstProcessId, secondProcessId);

        var firstStopped = await service.StopAndWaitAsync(
            harness.OperationId,
            StopRequest());
        Assert.Equal("direct-composition-seed-launch-stopped", firstStopped.TerminalCode);
        Assert.Equal(second, await service.ReadAsync(secondOperationId));
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(firstProcessId);

        var secondStopped = await service.StopAndWaitAsync(
            secondOperationId,
            StopRequest());
        Assert.Equal("direct-composition-seed-launch-stopped", secondStopped.TerminalCode);
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(secondProcessId);
    }

    [Fact]
    public async Task ExactDescriptorIsReconciledAcrossRuntimeOwnedServiceInstances()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        CompanionDirectCompositionSeedProjection first;
        await using (var service = harness.CreateService())
        {
            first = await service.StartOrReadAsync(StartRequest(harness.OperationId));
            _ = await service.StopAndWaitAsync(harness.OperationId, StopRequest());
        }

        await using var reopened = harness.CreateService();
        var second = await reopened.StartOrReadAsync(StartRequest(harness.OperationId));

        Assert.Equal(CompanionDirectCompositionSeedState.Ready, second.State);
        Assert.Equal(first.OperationId, second.OperationId);
        Assert.Equal(first.CompositionId, second.CompositionId);
        Assert.Equal(1UL, second.Sequence);
        _ = await reopened.StopAndWaitAsync(harness.OperationId, StopRequest());
    }

    [Fact]
    public async Task UnexpectedChildFailureReconcilesOnceAndNeverRelaunches()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "late-extra-output");
        await using var service = harness.CreateService();
        var start = StartRequest(harness.OperationId);
        var ready = await service.StartOrReadAsync(start);
        Assert.Equal(CompanionDirectCompositionSeedState.Ready, ready.State);

        var failed = await harness.ReadUntilAsync(
            service,
            CompanionDirectCompositionSeedState.Failed);
        var repeated = await service.StartOrReadAsync(start);
        var read = await service.ReadAsync(harness.OperationId);

        Assert.Equal(failed, repeated);
        Assert.Equal(failed, read);
        Assert.Equal(2UL, failed.Sequence);
        Assert.Equal(
            "direct-composition-seed-launch-unexpected-stdout",
            failed.TerminalCode);
    }

    [Fact]
    public async Task ChildFailureIsIsolatedFromEveryOtherSeedLifecycle()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        var failingOperationId = await harness.AddAvailableOperationAsync('b');
        await using var service = harness.CreateService();
        var healthy = await service.StartOrReadAsync(StartRequest(harness.OperationId));
        var healthyProcessId = await harness.ReadProcessIdAsync();

        harness.SetScenario("late-extra-output");
        _ = await service.StartOrReadAsync(StartRequest(failingOperationId));
        var failingProcessId = await harness.ReadProcessIdAsync();
        var failed = await CompanionDirectCompositionSeedTestHarness.ReadUntilAsync(
            service,
            failingOperationId,
            CompanionDirectCompositionSeedState.Failed);

        Assert.Equal(
            "direct-composition-seed-launch-unexpected-stdout",
            failed.TerminalCode);
        Assert.Equal(healthy, await service.ReadAsync(harness.OperationId));
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(
            failingProcessId);

        var stopped = await service.StopAndWaitAsync(harness.OperationId, StopRequest());
        Assert.Equal("direct-composition-seed-launch-stopped", stopped.TerminalCode);
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(
            healthyProcessId);
    }

    [Fact]
    public async Task StartupFailureIsAStableTerminalProjection()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "wrong-protocol");
        await using var service = harness.CreateService();
        var start = StartRequest(harness.OperationId);

        var failed = await service.StartOrReadAsync(start);
        var repeated = await service.StartOrReadAsync(start);

        Assert.Equal(failed, repeated);
        Assert.Equal(CompanionDirectCompositionSeedState.Failed, failed.State);
        Assert.Equal(1UL, failed.Sequence);
        Assert.Equal(
            "direct-composition-seed-launch-readiness-mismatch",
            failed.TerminalCode);
        Assert.Null(failed.BoundOrigin);
    }

    [Fact]
    public async Task RequestCancellationKillsStartupAndLeavesNoAdoptedLifecycle()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "timeout");
        await using var service = harness.CreateService();
        using var cancellation = new CancellationTokenSource();
        var pending = service.StartOrReadAsync(
            StartRequest(harness.OperationId),
            cancellation.Token);
        var processId = await harness.ReadProcessIdAsync();

        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(processId);

        harness.SetScenario("success");
        var ready = await service.StartOrReadAsync(StartRequest(harness.OperationId));
        Assert.Equal(CompanionDirectCompositionSeedState.Ready, ready.State);
        _ = await service.StopAndWaitAsync(harness.OperationId, StopRequest());
    }

    [Fact]
    public async Task RequestCancellationAfterReadinessDoesNotOwnTheSeedLifecycle()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        await using var service = harness.CreateService();
        using var cancellation = new CancellationTokenSource();
        var ready = await service.StartOrReadAsync(
            StartRequest(harness.OperationId),
            cancellation.Token);
        var processId = await harness.ReadProcessIdAsync();

        cancellation.Cancel();
        Assert.Equal(ready, await service.ReadAsync(harness.OperationId));

        var stopped = await service.StopAndWaitAsync(harness.OperationId, StopRequest());
        Assert.Equal(CompanionDirectCompositionSeedState.Stopped, stopped.State);
        Assert.Equal("direct-composition-seed-launch-stopped", stopped.TerminalCode);
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(processId);
    }

    [Fact]
    public async Task RuntimeDisposalTerminatesEveryOwnedChild()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        var secondOperationId = await harness.AddAvailableOperationAsync('b');
        var service = harness.CreateService();
        _ = await service.StartOrReadAsync(StartRequest(harness.OperationId));
        var firstProcessId = await harness.ReadProcessIdAsync();
        harness.SetScenario("success");
        _ = await service.StartOrReadAsync(StartRequest(secondOperationId));
        var secondProcessId = await harness.ReadProcessIdAsync();

        await service.DisposeAsync();
        await service.DisposeAsync();

        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(firstProcessId);
        await CompanionDirectCompositionSeedTestHarness.RequireProcessExitedAsync(secondProcessId);
    }

    [Fact]
    public async Task LifecycleCapacityIsExactAndDoesNotDisplaceExistingEvidence()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success");
        var operationIds = new List<string> { harness.OperationId };
        foreach (var digit in new[] { 'b', 'c', 'd', 'e' })
        {
            operationIds.Add(await harness.AddAvailableOperationAsync(digit));
        }
        await using var service = harness.CreateService();

        var admitted = new List<CompanionDirectCompositionSeedProjection>();
        foreach (var operationId in operationIds.Take(
            CompanionDirectCompositionSeedService.MaximumLifecyclesPerRuntime))
        {
            harness.SetScenario("success");
            admitted.Add(await service.StartOrReadAsync(StartRequest(operationId)));
        }

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.StartOrReadAsync(StartRequest(operationIds[^1])));
        Assert.Equal("direct-composition-seed-resource-limit", error.Code);
        Assert.Equal(
            admitted[0],
            await service.StartOrReadAsync(StartRequest(operationIds[0])));

        foreach (var operationId in operationIds.Take(
            CompanionDirectCompositionSeedService.MaximumLifecyclesPerRuntime))
        {
            var stopped = await service.StopAndWaitAsync(operationId, StopRequest());
            Assert.Equal("direct-composition-seed-launch-stopped", stopped.TerminalCode);
        }
    }

    [Fact]
    public async Task NonAvailableOperationAndCallerSuppliedAuthorityFailClosed()
    {
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            _parent,
            "success",
            createAvailable: false);
        await using var service = harness.CreateService();

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.StartOrReadAsync(StartRequest(harness.OperationId)));

        Assert.Equal("direct-composition-seed-operation-not-available", error.Code);
        Assert.False(File.Exists(harness.ProcessEvidencePath));
        Assert.Empty(typeof(CompanionDirectCompositionSeedService)
            .GetConstructors(BindingFlags.Public | BindingFlags.Instance));
        Assert.DoesNotContain(
            typeof(CompanionDirectCompositionSeedService).GetMethods(
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly),
            method => method.GetParameters().Any(parameter =>
                parameter.Name is not null &&
                new[] { "path", "url", "command", "executable", "bind", "origin" }
                    .Any(token => parameter.Name.Contains(
                        token,
                        StringComparison.OrdinalIgnoreCase))));
        Assert.Equal(
            new[] { "OperationId", "Schema" },
            typeof(CompanionDirectCompositionSeedStartRequest).GetProperties()
                .Select(property => property.Name)
                .Order(StringComparer.Ordinal)
                .ToArray());
    }

    [Fact]
    public void StrictCodecsExposeOnlyLocalTransportState()
    {
        var operationId = CompanionContractTests.Digest('a');
        var compositionId = $"sha256:{CompanionContractTests.Digest('b')}";
        var start = StartRequest(operationId);
        var stop = StopRequest();
        var projection = new CompanionDirectCompositionSeedProjection(
            CompanionLoopbackWire.DirectCompositionSeedProjectionSchema,
            operationId,
            1,
            CompanionDirectCompositionSeedState.Ready,
            compositionId,
            CompanionDirectCompositionSeedLauncher.Protocol,
            "http://127.0.0.1:48231",
            CompanionLoopbackProtocol.ProductionOrigin,
            null);

        Assert.Equal(
            start,
            CompanionLoopbackWire.DecodeDirectCompositionSeedStartRequest(
                CompanionLoopbackWire.EncodeDirectCompositionSeedStartRequest(start)));
        Assert.Equal(
            stop,
            CompanionLoopbackWire.DecodeDirectCompositionSeedStopRequest(
                CompanionLoopbackWire.EncodeDirectCompositionSeedStopRequest(stop)));
        var encoded = CompanionLoopbackWire.EncodeDirectCompositionSeedProjection(projection);
        Assert.Equal(
            projection,
            CompanionLoopbackWire.DecodeDirectCompositionSeedProjection(encoded));
        var text = Encoding.UTF8.GetString(encoded);
        Assert.DoesNotContain("qualification", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("announcement", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("admission", text, StringComparison.OrdinalIgnoreCase);

        var hostile = Encoding.UTF8.GetBytes(
            $"{{\"schema\":\"{CompanionLoopbackWire.DirectCompositionSeedStartRequestSchema}\"," +
            $"\"operationId\":\"{operationId}\",\"bindAddress\":\"0.0.0.0:1\"}}");
        Assert.Throws<CompanionProtocolException>(() =>
            CompanionLoopbackWire.DecodeDirectCompositionSeedStartRequest(hostile));
        Assert.Throws<CompanionProtocolException>(() =>
            CompanionLoopbackWire.EncodeDirectCompositionSeedProjection(
                projection with { BoundOrigin = "http://192.0.2.1:48231" }));
    }

    private static CompanionDirectCompositionSeedStartRequest StartRequest(
        string operationId) => new(
        CompanionLoopbackWire.DirectCompositionSeedStartRequestSchema,
        operationId);

    private static CompanionDirectCompositionSeedStopRequest StopRequest() => new(
        CompanionLoopbackWire.DirectCompositionSeedStopRequestSchema);

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
        _scratch.Dispose();
    }
}

internal sealed class CompanionDirectCompositionSeedTestHarness : IAsyncDisposable
{
    private const string ScenarioFileName = ".tinyrustlm-p2p-seed-fixture-scenario";
    private const string ProcessFileName = ".tinyrustlm-p2p-seed-fixture-process";
    private readonly CompanionArtifactTransferTests.TransferFixture _fixture;
    private readonly CompanionDirectCompositionSeedDescriptorMaterializer _materializer;
    private readonly string _containerRoot;

    private CompanionDirectCompositionSeedTestHarness(
        CompanionArtifactTransferTests.TransferFixture fixture,
        CompanionDirectCompositionSeedDescriptorMaterializer materializer,
        string operationId,
        string descriptorRoot,
        string containerRoot)
    {
        _fixture = fixture;
        _materializer = materializer;
        OperationId = operationId;
        DescriptorRoot = descriptorRoot;
        _containerRoot = containerRoot;
    }

    internal string OperationId { get; }

    internal string DescriptorRoot { get; }

    internal string ProcessEvidencePath => Path.Combine(DescriptorRoot, ProcessFileName);

    internal void SetScenario(string scenario)
    {
        File.WriteAllText(Path.Combine(DescriptorRoot, ScenarioFileName), scenario);
        File.Delete(ProcessEvidencePath);
    }

    internal static async Task<CompanionDirectCompositionSeedTestHarness> CreateAsync(
        string parent,
        string scenario,
        bool createAvailable = true)
    {
        var fixture = new CompanionArtifactTransferTests.TransferFixture(
            parent,
            "rust-seed-pass");
        try
        {
            var operation = createAvailable
                ? await fixture.CreateAvailableAsync()
                : fixture.CreateQueued();
            var materializer = CompanionDirectCompositionSeedDescriptorMaterializer
                .OpenForJournal(fixture.Journal, fixture.Parent);
            var descriptorRoot = Path.Combine(
                fixture.Parent,
                CompanionDirectCompositionSeedDescriptorMaterializer.DescriptorDirectoryName);
            File.WriteAllText(Path.Combine(descriptorRoot, ScenarioFileName), scenario);
            return new CompanionDirectCompositionSeedTestHarness(
                fixture,
                materializer,
                operation.OperationId,
                descriptorRoot,
                parent);
        }
        catch
        {
            fixture.Dispose();
            throw;
        }
    }

    internal CompanionDirectCompositionSeedService CreateService(
        TimeSpan? readinessTimeout = null)
    {
        return new CompanionDirectCompositionSeedService(
            _materializer,
            () => CompanionDirectCompositionSeedLauncher.OpenForTests(
                _materializer,
                FixtureToolPath(),
                readinessTimeout ?? TimeSpan.FromSeconds(3)));
    }

    internal async Task<string> AddAvailableOperationAsync(char attemptDigit)
    {
        if (attemptDigit is not (>= '0' and <= '9') and not (>= 'b' and <= 'f'))
        {
            throw new ArgumentOutOfRangeException(nameof(attemptDigit));
        }

        var operationRoot = Path.Combine(_fixture.Parent, $"operation-{attemptDigit}");
        Directory.CreateDirectory(operationRoot);
        var lockRoot = Path.Combine(operationRoot, "source-locks");
        Directory.CreateDirectory(lockRoot);
        var modelLockPath = Path.Combine(lockRoot, "model-source-lock.json");
        var tokenizerLockPath = Path.Combine(lockRoot, "tokenizer-source-lock.json");
        File.Copy(_fixture.ModelSourceLockPath, modelLockPath);
        File.Copy(_fixture.TokenizerSourceLockPath, tokenizerLockPath);
        var outputRoot = Path.Combine(operationRoot, "composition-output");
        var request = CompanionContractTests.Request() with
        {
            AttemptId = new string(attemptDigit, 32)
        };
        var created = _fixture.Journal.CreateOrRead(request);
        var tool = new TinyRustLmConversionTool(ConversionFixtureToolPath());
        var conversionIntent = tool.CreateCompositionIntent(
            new TinyRustLmCompositionConversionRequest(
                modelLockPath,
                request.ModelSourceLockSha256,
                _fixture.ModelSourceDirectory,
                tokenizerLockPath,
                request.TokenizerSourceLockSha256,
                _fixture.TokenizerSourceDirectory,
                request.CompositionProfileSha256,
                outputRoot));
        var evidence = CompanionOperationTestEvidence.EnterAcquiringSource(
            _fixture.Journal,
            created,
            operationRoot,
            _fixture.ModelSourceDirectory,
            _fixture.TokenizerSourceDirectory,
            outputRoot,
            conversionIntent.ConverterExecutableSha256);
        _ = CompanionOperationTestEvidence.PersistSourceReceipt(
            _fixture.Journal,
            created,
            evidence,
            _fixture.ModelSourceDirectory,
            _fixture.TokenizerSourceDirectory);
        var conversion = new CompanionSourceConversion(_fixture.Journal, tool);
        var result = await conversion.RunAsync(
            created.OperationId,
            new CompanionSourceConversionRequest(
                modelLockPath,
                _fixture.ModelSourceDirectory,
                tokenizerLockPath,
                _fixture.TokenizerSourceDirectory,
                outputRoot));
        return result.Operation.OperationId;
    }

    internal async Task<int> ReadProcessIdAsync()
    {
        await RequireFileAsync(ProcessEvidencePath);
        return int.Parse(File.ReadAllText(ProcessEvidencePath));
    }

    internal async Task<CompanionDirectCompositionSeedProjection> ReadUntilAsync(
        CompanionDirectCompositionSeedService service,
        CompanionDirectCompositionSeedState state)
        => await ReadUntilAsync(service, OperationId, state);

    internal static async Task<CompanionDirectCompositionSeedProjection> ReadUntilAsync(
        CompanionDirectCompositionSeedService service,
        string operationId,
        CompanionDirectCompositionSeedState state)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        CompanionDirectCompositionSeedProjection? projection = null;
        while (DateTime.UtcNow < deadline)
        {
            projection = await service.ReadAsync(operationId);
            if (projection.State == state)
            {
                return projection;
            }
            await Task.Delay(TimeSpan.FromMilliseconds(20));
        }
        throw new Xunit.Sdk.XunitException(
            $"Seed state remained {projection?.State.ToString() ?? "unknown"}.");
    }

    internal static async Task RequireProcessExitedAsync(int processId)
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
        throw new Xunit.Sdk.XunitException($"Fixture process {processId} remained alive.");
    }

    public ValueTask DisposeAsync()
    {
        _fixture.Dispose();
        if (Directory.Exists(_containerRoot) &&
            !Directory.EnumerateFileSystemEntries(_containerRoot).Any())
        {
            Directory.Delete(_containerRoot);
        }
        return ValueTask.CompletedTask;
    }

    private static async Task RequireFileAsync(string path)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        while (!File.Exists(path) && DateTime.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(20));
        }
        if (!File.Exists(path))
        {
            throw new Xunit.Sdk.XunitException(
                $"Fixture evidence was not written: {Path.GetFileName(path)}");
        }
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

    private static string ConversionFixtureToolPath()
    {
        var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent?.Name
            ?? throw new InvalidOperationException("Cannot determine test configuration.");
        var fileName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? "TinyRustLM.ConversionFixtureTool.exe"
            : "TinyRustLM.ConversionFixtureTool";
        return Path.Combine(
            RepositoryRoot(),
            "dotnet",
            "tools",
            "TinyRustLM.ConversionFixtureTool",
            "bin",
            configuration,
            "net8.0",
            fileName);
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
}
