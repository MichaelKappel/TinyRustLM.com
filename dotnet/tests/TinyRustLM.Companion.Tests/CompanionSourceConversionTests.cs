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
            result.Composition.Artifacts.Composition.Sha256,
            result.Operation.Artifacts.Composition.Sha256);
        Assert.Equal(
            result.Composition.Artifacts.Model.Sha256,
            result.Operation.Artifacts.Model.Sha256);
        Assert.NotNull(result.LiveObservation);
        Assert.Matches("^[0-9a-f]{64}$", result.Operation.SourceConversionIntentSha256!);
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
        Assert.Matches("^[0-9a-f]{64}$", cancelled.SourceConversionIntentSha256!);
        Assert.True(File.Exists(attempt));
    }

    [Fact]
    public async Task PreCancelledOperationNeverStartsConverterOrCreatesOutput()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request(), cancellation.Token));

        var cancelled = journal.Read(created.OperationId);
        Assert.Equal(CompanionOperationState.Cancelled, cancelled.State);
        Assert.Matches("^[0-9a-f]{64}$", cancelled.SourceConversionIntentSha256!);
        Assert.Null(cancelled.Artifacts);
        Assert.Null(cancelled.ErrorCode);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task ProcessStartFailureIsTypedAndTerminalWithoutCreatingOutput()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.InvalidTool());

        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request()));

        Assert.Equal("converter-process-start", error.Code);
        var rejected = journal.Read(created.OperationId);
        Assert.Equal(CompanionOperationState.Rejected, rejected.State);
        Assert.Equal(error.Code, rejected.ErrorCode);
        Assert.Matches("^[0-9a-f]{64}$", rejected.SourceConversionIntentSha256!);
        Assert.Null(rejected.Artifacts);
        Assert.False(Directory.Exists(fixture.OutputRoot));
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
        Assert.Equal(CompanionOperationState.Rejected, journal.Read(created.OperationId).State);
        Assert.Equal("companion-conversion-profile", journal.Read(created.OperationId).ErrorCode);
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

    [Theory]
    [InlineData(CompanionOperationState.Converting)]
    [InlineData(CompanionOperationState.VerifyingComposition)]
    public async Task DurablePassRecoversFromEitherAdmittedInterruptedState(
        CompanionOperationState interruptedState)
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        var live = await interrupted.Tool.ConvertCompositionAsync(interrupted.Intent);
        if (interruptedState == CompanionOperationState.VerifyingComposition)
        {
            interrupted.Journal.Advance(
                interrupted.Created.OperationId,
                CompanionOperationState.VerifyingComposition,
                CompanionAcquisitionBranch.Source);
        }
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Available, result.Status);
        Assert.Equal(CompanionOperationState.Available, result.Operation.State);
        Assert.Equal(live.Composition, result.Composition);
        Assert.Null(result.ErrorCode);
        Assert.Matches("^[0-9a-f]{64}$", result.Operation.SourceConversionIntentSha256!);
    }

    [Theory]
    [InlineData(CompanionOperationState.Converting)]
    [InlineData(CompanionOperationState.VerifyingComposition)]
    public async Task DurableNativeRejectionRecoversWithoutInventingCancellation(
        CompanionOperationState interruptedState)
    {
        using var fixture = new ConversionFixture(_parent, "terminal-rejection");
        var interrupted = PrepareInterruptedConversion(fixture);
        var native = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            interrupted.Tool.ConvertCompositionAsync(interrupted.Intent));
        Assert.Equal("qwen3-source-hash-mismatch", native.Code);
        if (interruptedState == CompanionOperationState.VerifyingComposition)
        {
            interrupted.Journal.Advance(
                interrupted.Created.OperationId,
                CompanionOperationState.VerifyingComposition,
                CompanionAcquisitionBranch.Source);
        }
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Rejected, result.Status);
        Assert.Equal(CompanionOperationState.Rejected, result.Operation.State);
        Assert.Equal("qwen3-source-hash-mismatch", result.ErrorCode);
        Assert.Equal(result.ErrorCode, result.Operation.ErrorCode);
        Assert.Null(result.Composition);
    }

    [Fact]
    public void AbsentAndPartialRootsStayPendingWithoutJournalMutationOrLaunch()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);
        var before = interrupted.Journal.Read(interrupted.Created.OperationId);

        var absent = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Pending, absent.Status);
        Assert.Equal("awaiting-terminal-evidence", absent.ErrorCode);
        Assert.Equal(before, absent.Operation);
        Assert.Equal(before, interrupted.Journal.Read(interrupted.Created.OperationId));
        Assert.False(Directory.Exists(fixture.OutputRoot));

        Directory.CreateDirectory(fixture.OutputRoot);
        File.WriteAllText(
            Path.Combine(fixture.OutputRoot, "composition.attempt.json"),
            "partial\n");
        var partial = coordinator.ReconcileTerminal(interrupted.Created.OperationId);
        Assert.Equal(CompanionSourceConversionReconciliationStatus.Pending, partial.Status);
        Assert.Equal(before, partial.Operation);
        Assert.Equal(before, interrupted.Journal.Read(interrupted.Created.OperationId));
        Assert.Single(Directory.GetFiles(fixture.OutputRoot));
    }

    [Fact]
    public async Task ConflictingTerminalFilesRejectWithoutRepairOrPathDisclosure()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        await interrupted.Tool.ConvertCompositionAsync(interrupted.Intent);
        var rejectionPath = Path.Combine(fixture.OutputRoot, "composition.rejection.json");
        File.WriteAllText(rejectionPath, "{}\n");
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Rejected, result.Status);
        Assert.Equal("companion-conversion-terminal-invalid", result.ErrorCode);
        Assert.DoesNotContain(
            fixture.Parent,
            result.ErrorCode!,
            StringComparison.OrdinalIgnoreCase);
        Assert.True(File.Exists(rejectionPath));
        Assert.True(File.Exists(
            Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json")));
    }

    [Fact]
    public async Task TamperedPrivateIntentBecomesBoundedRejectionWithoutOverwrite()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        await interrupted.Tool.ConvertCompositionAsync(interrupted.Intent);
        var intentPath = Path.Combine(
            fixture.OwnedRoot,
            "operations",
            interrupted.Created.OperationId,
            "source-conversion.intent.json");
        var tampered = File.ReadAllText(intentPath).Replace(
            "\"maximumSummaryBytes\":65536",
            "\"maximumSummaryBytes\":65535",
            StringComparison.Ordinal);
        File.WriteAllText(intentPath, tampered);
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Rejected, result.Status);
        Assert.Equal("companion-conversion-terminal-invalid", result.ErrorCode);
        Assert.Contains("65535", File.ReadAllText(intentPath), StringComparison.Ordinal);
    }

    [Fact]
    public async Task RecoveryUsesFrozenIdentitiesAfterOriginalSourcesDisappear()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture, privateTool: true);
        await interrupted.Tool.ConvertCompositionAsync(interrupted.Intent);
        File.Delete(fixture.ModelSourceLockPath);
        File.Delete(fixture.TokenizerSourceLockPath);
        Directory.Delete(fixture.ModelSourceDirectory);
        Directory.Delete(fixture.TokenizerSourceDirectory);
        fixture.RemovePrivateTool();
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Available, result.Status);
        Assert.Equal(CompanionOperationState.Available, result.Operation.State);
    }

    [Fact]
    public async Task LateCancellationAcceptsDurablePassWithoutFabricatingLiveObservation()
    {
        using var fixture = new ConversionFixture(_parent, "late-pass");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());
        using var cancellation = new CancellationTokenSource();
        var run = coordinator.RunAsync(created.OperationId, fixture.Request(), cancellation.Token);
        var terminal = Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json");
        await WaitForFile(terminal);
        cancellation.Cancel();

        var result = await run;

        Assert.Equal(CompanionOperationState.Available, result.Operation.State);
        Assert.Null(result.LiveObservation);
        Assert.True(File.Exists(terminal));
    }

    [Fact]
    public async Task LateCancellationPreservesValidNativeRejection()
    {
        using var fixture = new ConversionFixture(_parent, "late-rejection");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());
        using var cancellation = new CancellationTokenSource();
        var run = coordinator.RunAsync(created.OperationId, fixture.Request(), cancellation.Token);
        await WaitForFile(Path.Combine(fixture.OutputRoot, "composition.rejection.json"));
        cancellation.Cancel();

        var error = await Assert.ThrowsAsync<TinyRustLmException>(() => run);

        Assert.Equal("qwen3-source-hash-mismatch", error.Code);
        Assert.Equal(CompanionOperationState.Rejected, journal.Read(created.OperationId).State);
        Assert.Equal(error.Code, journal.Read(created.OperationId).ErrorCode);
    }

    [Fact]
    public async Task ReconciliationCannotOverwriteATerminalJournalState()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        await interrupted.Tool.ConvertCompositionAsync(interrupted.Intent);
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);
        var available = coordinator.ReconcileTerminal(interrupted.Created.OperationId).Operation;

        var error = Assert.Throws<CompanionContractException>(() =>
            coordinator.ReconcileTerminal(interrupted.Created.OperationId));

        Assert.Equal("companion-conversion-reconciliation-state", error.Code);
        Assert.Equal(available, interrupted.Journal.Read(interrupted.Created.OperationId));
    }

    [Fact]
    public async Task KnownLiveProtocolViolationCannotBeLaunderedByDurablePass()
    {
        using var fixture = new ConversionFixture(_parent, "unexpected-stderr");
        var (journal, created) = CreateAcquiringOperation(fixture);
        var coordinator = new CompanionSourceConversion(journal, fixture.Tool());

        var liveError = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            coordinator.RunAsync(created.OperationId, fixture.Request()));

        Assert.Equal("converter-unexpected-stderr", liveError.Code);
        var rejected = journal.Read(created.OperationId);
        Assert.Equal(CompanionOperationState.Rejected, rejected.State);
        Assert.True(File.Exists(
            Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json")));
        var reconciliationError = Assert.Throws<CompanionContractException>(() =>
            coordinator.ReconcileTerminal(created.OperationId));
        Assert.Equal("companion-conversion-reconciliation-state", reconciliationError.Code);
        Assert.Equal(rejected, journal.Read(created.OperationId));
    }

    [Theory]
    [InlineData("artifact-bytes")]
    [InlineData("malformed-receipt")]
    [InlineData("wrong-profile")]
    [InlineData("wrong-operation")]
    [InlineData("wrong-converter")]
    [InlineData("extra-file")]
    [InlineData("nested-directory")]
    public async Task DurablePassTamperingBecomesOneBoundedCompanionRejection(string fault)
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        var live = await interrupted.Tool.ConvertCompositionAsync(interrupted.Intent);
        var receipt = Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json");
        switch (fault)
        {
            case "artifact-bytes":
                File.AppendAllText(Path.Combine(fixture.OutputRoot, "model.slm2"), "tamper");
                break;
            case "malformed-receipt":
                File.WriteAllText(receipt, "{\n");
                break;
            case "wrong-profile":
                ReplaceFirst(receipt, TinyRustLmConversionTool.CompositionProfileSha256,
                    new string('0', 64));
                break;
            case "wrong-operation":
                ReplaceFirst(receipt, live.Composition.OperationId,
                    $"qwen3-composition-{new string('0', 64)}");
                break;
            case "wrong-converter":
                ReplaceFirst(receipt, live.Composition.ConverterExecutableSha256,
                    new string('0', 64));
                break;
            case "extra-file":
                File.WriteAllText(Path.Combine(fixture.OutputRoot, "unexpected.bin"), "x");
                break;
            case "nested-directory":
                Directory.CreateDirectory(Path.Combine(fixture.OutputRoot, "nested"));
                break;
            default:
                throw new InvalidOperationException(fault);
        }
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Rejected, result.Status);
        Assert.Equal("companion-conversion-terminal-invalid", result.ErrorCode);
        Assert.Equal(result.ErrorCode, result.Operation.ErrorCode);
        Assert.Null(result.Composition);
    }

    [Fact]
    public void OverLimitNonterminalInventoryIsInvalidRatherThanPending()
    {
        using var fixture = new ConversionFixture(_parent, "pass");
        var interrupted = PrepareInterruptedConversion(fixture);
        Directory.CreateDirectory(fixture.OutputRoot);
        for (var index = 0; index < 13; index++)
        {
            File.WriteAllText(Path.Combine(fixture.OutputRoot, $"partial-{index:D2}.bin"), "x");
        }
        var coordinator = new CompanionSourceConversion(interrupted.Journal, interrupted.Tool);

        var result = coordinator.ReconcileTerminal(interrupted.Created.OperationId);

        Assert.Equal(CompanionSourceConversionReconciliationStatus.Rejected, result.Status);
        Assert.Equal("companion-conversion-terminal-invalid", result.ErrorCode);
        Assert.Equal(13, Directory.GetFiles(fixture.OutputRoot).Length);
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
        fixture.OwnedRoot = root;
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

    private static InterruptedConversion PrepareInterruptedConversion(
        ConversionFixture fixture,
        bool privateTool = false)
    {
        var (journal, created) = CreateAcquiringOperation(fixture);
        var tool = fixture.Tool(privateTool);
        var intent = tool.CreateCompositionIntent(fixture.NativeRequest());
        var current = journal.Read(created.OperationId);
        var persisted = journal.PersistSourceConversionIntent(
            new CompanionSourceConversionIntent(
                CompanionContract.SourceConversionIntentSchema,
                created.OperationId,
                current.RequestSha256,
                intent));
        journal.Advance(
            created.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionBranch.Source,
            current.CompletedBytes,
            current.TotalBytes,
            sourceConversionIntentSha256: persisted.Sha256);
        return new InterruptedConversion(journal, created, tool, intent);
    }

    private static async Task WaitForFile(string path)
    {
        for (var index = 0; index < 1_000 && !File.Exists(path); index++)
        {
            await Task.Delay(10);
        }
        Assert.True(File.Exists(path));
    }

    private static void ReplaceFirst(string path, string expected, string replacement)
    {
        var text = File.ReadAllText(path);
        var index = text.IndexOf(expected, StringComparison.Ordinal);
        Assert.True(index >= 0);
        File.WriteAllText(
            path,
            text[..index] + replacement + text[(index + expected.Length)..]);
    }

    private sealed record InterruptedConversion(
        CompanionOperationJournal Journal,
        CompanionOperationRecord Created,
        TinyRustLmConversionTool Tool,
        TinyRustLmCompositionConversionIntent Intent);

    private sealed class ConversionFixture : IDisposable
    {
        private readonly string _privateToolDirectory;

        internal ConversionFixture(
            string parent,
            string scenario,
            string? profileOverride = null,
            string? modelLockOverride = null)
        {
            Directory.CreateDirectory(parent);
            Parent = Path.Combine(parent, $"case-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Parent);
            _privateToolDirectory = Path.Combine(Parent, "private-tool");
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
        internal string OwnedRoot { get; set; } = string.Empty;
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

        internal TinyRustLmCompositionConversionRequest NativeRequest() =>
            new(
                ModelSourceLockPath,
                AcquisitionRequest.ModelSourceLockSha256,
                ModelSourceDirectory,
                TokenizerSourceLockPath,
                AcquisitionRequest.TokenizerSourceLockSha256,
                TokenizerSourceDirectory,
                AcquisitionRequest.CompositionProfileSha256,
                OutputRoot);

        internal TinyRustLmConversionTool Tool(bool privateCopy = false) =>
            new(privateCopy ? CopyFixtureTool() : FixtureToolPath());

        internal TinyRustLmConversionTool InvalidTool()
        {
            var path = Path.Combine(
                Parent,
                OperatingSystem.IsWindows() ? "invalid-converter.exe" : "invalid-converter");
            File.WriteAllText(path, "not an executable");
            return new TinyRustLmConversionTool(path);
        }

        internal void RemovePrivateTool()
        {
            if (Directory.Exists(_privateToolDirectory))
            {
                Directory.Delete(_privateToolDirectory, recursive: true);
            }
        }

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

        private string CopyFixtureTool()
        {
            if (!Directory.Exists(_privateToolDirectory))
            {
                Directory.CreateDirectory(_privateToolDirectory);
                var sourceExecutable = FixtureToolPath();
                var sourceDirectory = Path.GetDirectoryName(sourceExecutable)
                    ?? throw new InvalidOperationException("Fixture tool has no directory.");
                foreach (var source in Directory.EnumerateFiles(
                    sourceDirectory,
                    "TinyRustLM.ConversionFixtureTool*"))
                {
                    File.Copy(
                        source,
                        Path.Combine(_privateToolDirectory, Path.GetFileName(source)));
                }
            }
            return Path.Combine(_privateToolDirectory, Path.GetFileName(FixtureToolPath()));
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
