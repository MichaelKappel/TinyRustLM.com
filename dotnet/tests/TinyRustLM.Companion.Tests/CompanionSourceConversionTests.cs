using System.Runtime.InteropServices;
using System.Security.Cryptography;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionSourceConversionTests : IDisposable
{
    private readonly string _parent = Path.Combine(
        Path.GetTempPath(),
        $"tinyrustlm-companion-conversion-{Guid.NewGuid():N}");

    [Fact]
    public async Task SourceBranchBecomesAvailableOnlyAfterCompleteCompositionVerification()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());

        var result = await coordinator.RunAsync(created.OperationId, fixture.Request());

        Assert.Equal(CompanionOperationState.Available, result.Operation.State);
        Assert.Equal(CompanionAcquisitionBranch.Source, result.Operation.Branch);
        Assert.Equal((ulong)5, result.Operation.Sequence);
        Assert.NotNull(result.Operation.Artifacts);
        Assert.Equal(
            result.Conversion.Artifacts.Composition.Sha256,
            result.Operation.Artifacts.Composition.Sha256);
        Assert.Equal(
            result.Conversion.Artifacts.Model.Sha256,
            result.Operation.Artifacts.Model.Sha256);
        Assert.Equal(result.Operation.TotalBytes, result.Operation.CompletedBytes);
        Assert.Equal(result.Operation, journal.Read(created.OperationId));
        Assert.Equal(
            CompanionContract.OperationId(fixture.AcquisitionRequest),
            CompanionContract.OperationId(journal.ReadRequest(created.OperationId)));
    }

    [Fact]
    public async Task NativeFailureBecomesTerminalRejectionWithoutInventingAvailability()
    {
        using var fixture = new ConversionFixture(_parent, "error");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());

        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request()));

        Assert.Equal("qwen3-source-hash-mismatch", error.Code);
        var rejected = journal.Read(created.OperationId);
        Assert.Equal(CompanionOperationState.Rejected, rejected.State);
        Assert.Equal("qwen3-source-hash-mismatch", rejected.ErrorCode);
        Assert.Null(rejected.Artifacts);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task CancellationTerminatesProcessAndPreservesItsOwnedOutputEvidence()
    {
        using var fixture = new ConversionFixture(_parent, "hang");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());
        using var cancellation = new CancellationTokenSource();
        var run = coordinator.RunAsync(created.OperationId, fixture.Request(), cancellation.Token);
        var attempt = Path.Combine(fixture.OutputRoot, "composition.attempt.json");
        for (var index = 0; index < 500 && !File.Exists(attempt); index++)
        {
            await Task.Delay(10);
        }
        Assert.True(File.Exists(attempt));
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => run);

        var cancelled = journal.Read(created.OperationId);
        Assert.Equal(CompanionOperationState.Cancelled, cancelled.State);
        Assert.Null(cancelled.Artifacts);
        Assert.True(File.Exists(attempt));
    }

    [Fact]
    public async Task JournaledProfileDriftBlocksBeforeConversionStateOrOutput()
    {
        using var fixture = new ConversionFixture(_parent, "pass", new string('0', 64));
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());

        var error = await Assert.ThrowsAsync<CompanionContractException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request()));

        Assert.Equal("companion-conversion-profile", error.Code);
        Assert.Equal(CompanionOperationState.AcquiringSource, journal.Read(created.OperationId).State);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task JournaledSourceLockDriftRejectsBeforeProcessCreatesOutput()
    {
        using var fixture = new ConversionFixture(_parent, "pass", modelLockOverride: new string('0', 64));
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());

        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request()));

        Assert.Equal("converter-model-source-lock-identity", error.Code);
        var rejected = journal.Read(created.OperationId);
        Assert.Equal(CompanionOperationState.Rejected, rejected.State);
        Assert.Equal(error.Code, rejected.ErrorCode);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task CoordinatorRejectsWrongStartingStateWithoutLaunchingConverter()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.Create(fixture.AcquisitionRequest);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());

        var error = await Assert.ThrowsAsync<CompanionContractException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request()));

        Assert.Equal("companion-conversion-state", error.Code);
        Assert.Equal(CompanionOperationState.Queued, journal.Read(created.OperationId).State);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    public void Dispose()
    {
        if (Directory.Exists(_parent))
        {
            Directory.Delete(_parent, recursive: true);
        }
    }

    private static (CompanionOperationJournal Journal, CompanionOperationRecord Created)
        CreateAcquiringOperation(ConversionFixture fixture)
    {
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(fixture.Parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.Create(fixture.AcquisitionRequest);
        journal.Advance(
            created.OperationId,
            CompanionOperationState.CheckingPeers,
            CompanionAcquisitionBranch.Undecided);
        journal.Advance(
            created.OperationId,
            CompanionOperationState.AcquiringSource,
            CompanionAcquisitionBranch.Source,
            totalBytes: fixture.AcquisitionRequest.MaximumSourceBytes);
        return (journal, created);
    }

    private sealed class ConversionFixture : IDisposable
    {
        internal ConversionFixture(
            string parent,
            string scenario,
            string? profileOverride = null,
            string? modelLockOverride = null)
        {
            Directory.CreateDirectory(parent);
            Parent = Path.Combine(parent, $"case-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Parent);
            ModelSourceDirectory = Path.Combine(Parent, "model-source");
            Directory.CreateDirectory(ModelSourceDirectory);
            TokenizerSourceDirectory = Path.Combine(Parent, "tokenizer-source");
            Directory.CreateDirectory(TokenizerSourceDirectory);
            ModelSourceLockPath = Path.Combine(Parent, "model-source-lock.json");
            TokenizerSourceLockPath = Path.Combine(Parent, "tokenizer-source-lock.json");
            File.WriteAllText(ModelSourceLockPath, scenario);
            File.WriteAllText(TokenizerSourceLockPath, "fixture-tokenizer-lock");
            OutputRoot = Path.Combine(Parent, "composition-output");
            AcquisitionRequest = new CompanionAcquireRequest(
                CompanionContract.AcquisitionRequestSchema,
                "qwen3-0.6b",
                "Qwen/Qwen3-0.6B",
                new string('1', 40),
                modelLockOverride ?? Sha256File(ModelSourceLockPath),
                Sha256File(TokenizerSourceLockPath),
                profileOverride ?? TinyRustLmConversionTool.CompositionProfileSha256,
                SourceAcquisitionApproved: true,
                MaximumSourceBytes: 4_000_000_000,
                []);
        }

        internal string Parent { get; }
        internal string ModelSourceDirectory { get; }
        internal string ModelSourceLockPath { get; }
        internal string TokenizerSourceDirectory { get; }
        internal string TokenizerSourceLockPath { get; }
        internal string OutputRoot { get; }
        internal CompanionAcquireRequest AcquisitionRequest { get; }

        internal CompanionSourceConversionRequest Request() =>
            new(
                ModelSourceLockPath,
                ModelSourceDirectory,
                TokenizerSourceLockPath,
                TokenizerSourceDirectory,
                OutputRoot);

        internal TinyRustLmConversionTool Tool() => new(FixtureToolPath());

        public void Dispose()
        {
            if (Directory.Exists(Parent))
            {
                Directory.Delete(Parent, recursive: true);
            }
        }

        private static string FixtureToolPath()
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

    private static string Sha256File(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }
}
