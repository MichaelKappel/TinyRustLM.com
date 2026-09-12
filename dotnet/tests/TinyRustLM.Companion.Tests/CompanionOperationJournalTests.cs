using TinyRustLM;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionOperationJournalTests : IDisposable
{
    private readonly CanonicalTestScratch _scratch = new("tests");
    private string _parent => _scratch.Path;

    [Fact]
    public void JournalPersistsCreateOnlyPhaseEvidenceAndTerminalComposition()
    {
        var journal = CreateJournal(out var root, new FrozenTimeProvider());
        var setup = PrepareAcquisition(journal, "primary");
        var receipt = CompanionOperationTestEvidence.PersistSourceReceipt(
            journal,
            setup.Operation,
            setup.Evidence,
            setup.ModelSourceRoot,
            setup.TokenizerSourceRoot);
        var conversionIntent = journal.PersistSourceConversionIntent(SourceIntent(setup));
        var converting = journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionRoute.Source,
            phaseCompletedBytes: CompanionSourceDescriptor.PayloadBytes,
            phaseTotalBytes: CompanionSourceDescriptor.PayloadBytes,
            sourceAcquisitionReceiptSha256: receipt.Sha256,
            sourceConversionIntentSha256: conversionIntent.Sha256);
        var verifying = journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionRoute.Source);
        var available = journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.Available,
            CompanionAcquisitionRoute.Source,
            artifacts: CompanionContractTests.Artifacts());

        Assert.Equal((ulong)1, setup.Acquiring.Sequence);
        Assert.Equal((ulong)2, converting.Sequence);
        Assert.Equal((ulong)3, verifying.Sequence);
        Assert.Equal((ulong)4, available.Sequence);
        Assert.Equal(setup.Evidence.Execution.Sha256, available.ExecutionIntentSha256);
        Assert.Equal(setup.Evidence.Acquisition.Sha256, available.SourceAcquisitionIntentSha256);
        Assert.Equal(receipt.Sha256, available.SourceAcquisitionReceiptSha256);
        Assert.Equal(conversionIntent.Sha256, available.SourceConversionIntentSha256);
        Assert.Equal(available, new CompanionOperationJournal(root).Read(available.OperationId));
        Assert.Equal(
            5,
            Directory.GetFiles(
                Path.Combine(root, "operations", available.OperationId, "history"),
                "*.json").Length);

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            available.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            errorCode: "late-rejection"));
        Assert.Equal("journal-transition", error.Code);
    }

    [Fact]
    public void JournalRecoversDuplicateOperationAndRejectsSkippedTransition()
    {
        var journal = CreateJournal(out var root);
        var request = CompanionContractTests.Request();
        var created = journal.CreateOrRead(request);

        Assert.Equal(created, new CompanionOperationJournal(root).CreateOrRead(request));
        var transition = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.Available,
            CompanionAcquisitionRoute.Source,
            artifacts: CompanionContractTests.Artifacts()));
        Assert.Equal("journal-transition", transition.Code);
    }

    [Fact]
    public void CreateOnlyHistoryRemainsAuthoritativeAfterInterruptedCurrentReplacement()
    {
        var journal = CreateJournal(out var root, new FrozenTimeProvider());
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var rejected = journal.Advance(
            created.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            errorCode: "fixture-rejected");
        var operationRoot = Path.Combine(root, "operations", created.OperationId);
        File.Copy(
            Path.Combine(operationRoot, "history", "00000000000000000000.json"),
            Path.Combine(operationRoot, "current.json"),
            overwrite: true);

        var recovered = new CompanionOperationJournal(root);

        Assert.Equal(rejected, recovered.Read(created.OperationId));
        Assert.Equal(
            rejected,
            recovered.CreateOrRead(CompanionContractTests.Request()));
        var terminal = Assert.Throws<CompanionContractException>(() => recovered.Advance(
            created.OperationId,
            CompanionOperationState.Cancelled,
            CompanionAcquisitionRoute.Source));
        Assert.Equal("journal-transition", terminal.Code);
    }

    [Fact]
    public void JournalRejectsCurrentCacheLagBeyondOneInterruptedReplacement()
    {
        var journal = CreateJournal(out var root, new FrozenTimeProvider());
        var setup = PrepareAcquisition(journal, "cache-rollback");
        var receipt = CompanionOperationTestEvidence.PersistSourceReceipt(
            journal,
            setup.Operation,
            setup.Evidence,
            setup.ModelSourceRoot,
            setup.TokenizerSourceRoot);
        var conversion = journal.PersistSourceConversionIntent(SourceIntent(setup));
        _ = journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionRoute.Source,
            sourceAcquisitionReceiptSha256: receipt.Sha256,
            sourceConversionIntentSha256: conversion.Sha256);
        var operationRoot = Path.Combine(root, "operations", setup.Operation.OperationId);
        File.Copy(
            Path.Combine(operationRoot, "history", "00000000000000000000.json"),
            Path.Combine(operationRoot, "current.json"),
            overwrite: true);

        var error = Assert.Throws<CompanionContractException>(() =>
            journal.Read(setup.Operation.OperationId));

        Assert.Equal("journal-current-history-mismatch", error.Code);
    }

    [Fact]
    public void MutationRepairsOneRecordCurrentCacheLagBeforeTransitionValidation()
    {
        var journal = CreateJournal(out var root, new FrozenTimeProvider());
        var setup = PrepareAcquisition(journal, "cache-repair-before-mutation");
        var operationRoot = Path.Combine(root, "operations", setup.Operation.OperationId);
        var currentPath = Path.Combine(operationRoot, "current.json");
        var acquiringHistoryPath = Path.Combine(
            operationRoot,
            "history",
            "00000000000000000001.json");
        File.Copy(
            Path.Combine(operationRoot, "history", "00000000000000000000.json"),
            currentPath,
            overwrite: true);

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.Available,
            CompanionAcquisitionRoute.Source,
            artifacts: CompanionContractTests.Artifacts()));

        Assert.Equal("journal-transition", error.Code);
        Assert.Equal(File.ReadAllBytes(acquiringHistoryPath), File.ReadAllBytes(currentPath));
        Assert.Equal(setup.Acquiring, journal.Read(setup.Operation.OperationId));
    }

    [Fact]
    public void JournalRejectsHistoryGapsAndCurrentRecordsOutsideHistory()
    {
        var journal = CreateJournal(out var root, new FrozenTimeProvider());
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var operationRoot = Path.Combine(root, "operations", created.OperationId);
        File.Copy(
            Path.Combine(operationRoot, "history", "00000000000000000000.json"),
            Path.Combine(operationRoot, "history", "00000000000000000002.json"));

        var gap = Assert.Throws<CompanionContractException>(() =>
            journal.Read(created.OperationId));

        Assert.Equal("journal-history-contract", gap.Code);
        File.Delete(Path.Combine(
            operationRoot,
            "history",
            "00000000000000000002.json"));
        File.WriteAllText(
            Path.Combine(operationRoot, "current.json"),
            File.ReadAllText(Path.Combine(
                operationRoot,
                "history",
                "00000000000000000000.json"))
                .Replace(
                    "\"phaseCompletedBytes\":0",
                    "\"phaseCompletedBytes\":1",
                    StringComparison.Ordinal));
        var mismatch = Assert.Throws<CompanionContractException>(() =>
            journal.Read(created.OperationId));
        Assert.Equal("journal-current-history-mismatch", mismatch.Code);
    }

    [Fact]
    public async Task ConcurrentCreateOrReadElectsOneExactCommittedOperation()
    {
        var journal = CreateJournal(out var root);
        var request = CompanionContractTests.Request();
        var tasks = Enumerable.Range(0, 10)
            .Select(_ => Task.Run(() => new CompanionOperationJournal(root).CreateOrRead(request)))
            .ToArray();

        var records = await Task.WhenAll(tasks);

        Assert.All(records, record => Assert.Equal(records[0], record));
        Assert.Single(Directory.GetFiles(
            Path.Combine(root, "operations", records[0].OperationId, "history"),
            "*.json"));
        Assert.Equal(records[0], journal.Read(records[0].OperationId));
    }

    [Fact]
    public async Task IdenticalOperationIdsInDistinctRootsDoNotShareMutationLocks()
    {
        Directory.CreateDirectory(_parent);
        const int rootCount = 12;
        var journals = Enumerable.Range(0, rootCount).Select(index =>
        {
            var root = CompanionOperationJournal.CreateOwnedRoot(
                Path.Combine(_parent, $"owned-{index:D2}"));
            return new CompanionOperationJournal(root);
        }).ToArray();
        var created = journals.Select(journal =>
            journal.CreateOrRead(CompanionContractTests.Request())).ToArray();
        using var release = new ManualResetEventSlim(initialState: false);
        var ready = 0;
        var tasks = journals.Select((journal, index) => Task.Run(() =>
        {
            Interlocked.Increment(ref ready);
            release.Wait();
            return journal.Advance(
                created[index].OperationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionRoute.Source,
                errorCode: "fixture-rejected");
        })).ToArray();
        while (Volatile.Read(ref ready) != rootCount)
        {
            await Task.Delay(1);
        }
        release.Set();

        var advanced = await Task.WhenAll(tasks);

        Assert.Single(created.Select(value => value.OperationId).Distinct(StringComparer.Ordinal));
        Assert.All(advanced, value => Assert.Equal(CompanionOperationState.Rejected, value.State));
    }

    [Fact]
    public void DistinctOperationMutationGatesAreReleasedAfterUse()
    {
        var journal = CreateJournal(out _);
        for (var index = 0; index < 128; index++)
        {
            var request = CompanionContractTests.Request() with
            {
                AttemptId = index.ToString("x32", System.Globalization.CultureInfo.InvariantCulture)
            };
            var created = journal.CreateOrRead(request);

            journal.Advance(
                created.OperationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionRoute.Source,
                errorCode: "fixture-rejected");

            Assert.Equal(0, journal.ActiveInProcessGateCount);
        }
    }

    /// <summary>Readers must not inspect a history file while the owning writer is publishing it.</summary>
    [Theory]
    [InlineData("read")]
    [InlineData("request")]
    [InlineData("existing")]
    public async Task ConcurrentReadersWaitForACompleteHistoryRecord(string readerKind)
    {
        using var clock = new PausingTimeProvider();
        var journal = CreateJournal(out var root, clock);
        var request = CompanionContractTests.Request();
        var created = journal.CreateOrRead(request);
        var other = new CompanionOperationJournal(root);
        var partialPath = Path.Combine(root, "operations", created.OperationId,
            "history", "00000000000000000001.json");
        clock.Arm();
        var writer = Task.Factory.StartNew(() => journal.Advance(created.OperationId,
            CompanionOperationState.Rejected, CompanionAcquisitionRoute.Source,
            errorCode: "fixture-rejected"), CancellationToken.None,
            TaskCreationOptions.LongRunning, TaskScheduler.Default);
        Task<CompanionOperationRecord>? reader = null;
        var partialCreated = false;
        try
        {
            Assert.True(clock.Entered.Wait(TimeSpan.FromSeconds(5)));
            // Hold the real operation lock while reproducing the observed zero-length write window.
            File.WriteAllBytes(partialPath, []);
            partialCreated = true;
            using var started = new ManualResetEventSlim();
            reader = Task.Factory.StartNew(() =>
            {
                started.Set();
                if (readerKind == "existing") return other.CreateOrRead(request);
                if (readerKind == "request") Assert.Equal(request, other.ReadRequest(created.OperationId));
                return other.Read(created.OperationId);
            }, CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
            Assert.True(started.Wait(TimeSpan.FromSeconds(5)));
            Assert.NotSame(reader, await Task.WhenAny(reader, Task.Delay(100)));
            File.Delete(partialPath);
            partialCreated = false;
            clock.Continue.Set();
            var written = await writer.WaitAsync(TimeSpan.FromSeconds(5));
            Assert.Equal(written, await reader.WaitAsync(TimeSpan.FromSeconds(5)));
            Assert.Equal(CompanionOperationState.Rejected, written.State);
            Assert.Equal(0, journal.ActiveInProcessGateCount);
        }
        finally
        {
            try
            {
                if (partialCreated)
                {
                    Assert.Equal(0, new FileInfo(partialPath).Length);
                    File.Delete(partialPath);
                }
            }
            finally
            {
                clock.Continue.Set();
                await writer;
                if (reader is not null) await reader;
            }
        }
    }

    /// <summary>A separately held process lock yields a typed busy result and leaves no gate reference.</summary>
    [Fact]
    public void ReadRespectsAnExclusiveProcessLockAndReleasesItsGate()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var lockPath = Path.Combine(root, "operations", created.OperationId, "operation.lock");
        using (var held = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
        {
            var error = Assert.Throws<CompanionContractException>(() => journal.Read(created.OperationId));
            Assert.Equal("journal-operation-busy", error.Code);
            Assert.Equal(0, journal.ActiveInProcessGateCount);
        }
        Assert.Equal(created, journal.Read(created.OperationId));
        Assert.Equal(0, journal.ActiveInProcessGateCount);
    }

    [Fact]
    public void JournalRequiresAnExactOwnedRootMarker()
    {
        Directory.CreateDirectory(_parent);
        var error = Assert.Throws<CompanionContractException>(() =>
            new CompanionOperationJournal(_parent));
        Assert.Equal("journal-root-marker", error.Code);
    }

    [Fact]
    public void MissingOperationRejectsBeforeCreatingALockFile()
    {
        var journal = CreateJournal(out var root);
        var operationId = CompanionContractTests.Digest('f');

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            operationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            errorCode: "fixture-rejected"));

        Assert.Equal("journal-operation-missing", error.Code);
        Assert.False(Directory.Exists(Path.Combine(root, "operations", operationId)));
    }

    [Fact]
    public void MarkerOnlyInterruptedRootIsNeverCompletedByTheConstructor()
    {
        Directory.CreateDirectory(_parent);
        File.WriteAllText(
            Path.Combine(_parent, ".tinyrustlm-companion-root"),
            CompanionContract.OwnedRootMarker);

        var error = Assert.Throws<CompanionContractException>(() =>
            new CompanionOperationJournal(_parent));

        Assert.Equal("journal-operations-root", error.Code);
        Assert.False(Directory.Exists(Path.Combine(_parent, "operations")));
    }

    [Fact]
    public void JournalRejectsTamperedOrDuplicateRequestProperties()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var requestPath = Path.Combine(root, "operations", created.OperationId, "request.json");
        var original = File.ReadAllText(requestPath);
        File.WriteAllText(
            requestPath,
            original.Replace(
                $"\"attemptId\":\"{new string('a', 32)}\"",
                $"\"attemptId\":\"{new string('b', 32)}\"",
                StringComparison.Ordinal));
        var tampered = Assert.Throws<CompanionContractException>(() =>
            journal.ReadRequest(created.OperationId));
        Assert.Equal("journal-request-identity", tampered.Code);

        File.WriteAllText(
            requestPath,
            original.Replace(
                "\"modelId\":\"qwen3-0.6b\"",
                "\"modelId\":\"qwen3-0.6b\",\"modelId\":\"qwen3-0.6b\"",
                StringComparison.Ordinal));
        var duplicate = Assert.Throws<CompanionContractException>(() =>
            journal.ReadRequest(created.OperationId));
        Assert.Equal("journal-request-json", duplicate.Code);
    }

    [Fact]
    public void AcquisitionEvidenceIsCanonicalCreateOnlyAndBoundToSourceState()
    {
        var journal = CreateJournal(out var root);
        var setup = PrepareAcquisition(journal, "evidence");
        var operationRoot = Path.Combine(root, "operations", setup.Operation.OperationId);
        var executionBytes = File.ReadAllBytes(Path.Combine(operationRoot, "execution.intent.json"));
        var acquisitionBytes = File.ReadAllBytes(
            Path.Combine(operationRoot, "source-acquisition.intent.json"));

        Assert.Equal((byte)'\n', executionBytes[^1]);
        Assert.Equal((byte)'\n', acquisitionBytes[^1]);
        Assert.Equal(setup.Evidence.Execution.Sha256, Sha256(executionBytes));
        Assert.Equal(setup.Evidence.Acquisition.Sha256, Sha256(acquisitionBytes));
        Assert.Equal(setup.Evidence.Execution.Sha256, setup.Acquiring.ExecutionIntentSha256);
        Assert.Equal(
            setup.Evidence.Acquisition.Sha256,
            setup.Acquiring.SourceAcquisitionIntentSha256);
        Assert.Null(setup.Acquiring.SourceAcquisitionReceiptSha256);
        Assert.Null(setup.Acquiring.SourceConversionIntentSha256);
    }

    [Fact]
    public void AcquisitionEvidenceRejectsEqualAndNestedCustodyRoots()
    {
        var privateRoot = Path.GetFullPath(Path.Combine(_parent, "nested-roots"));
        var sourceCacheRoot = Path.Combine(privateRoot, "source-cache");
        var intent = new CompanionSourceAcquisitionIntent(
            CompanionContract.SourceAcquisitionIntentSchema,
            CompanionContractTests.Digest('1'),
            CompanionContractTests.Digest('2'),
            CompanionContractTests.Digest('3'),
            CompanionSourceDescriptor.DescriptorId,
            CompanionSourceDescriptor.Repository,
            CompanionSourceDescriptor.Revision,
            CompanionSourceDescriptor.ModelSourceLockSha256,
            CompanionSourceDescriptor.TokenizerSourceLockSha256,
            CompanionSourceDescriptor.PayloadBytes,
            CompanionSourceDescriptor.PayloadInventorySchema,
            CompanionSourceDescriptor.PayloadInventorySha256,
            sourceCacheRoot,
            Path.Combine(sourceCacheRoot, "model"),
            Path.Combine(privateRoot, "tokenizer-source"),
            Path.Combine(privateRoot, "source-staging"),
            Path.Combine(privateRoot, "source-locks"),
            CompanionSourceDescriptor.InitialOrigin,
            CompanionSourceDescriptor.MaximumRedirects,
            CompanionSourceDescriptor.BufferBytes);

        var nested = Assert.Throws<CompanionContractException>(() =>
            CompanionOperationEvidenceCodec.Validate(intent));
        Assert.Equal("journal-source-acquisition-intent-root-collision", nested.Code);

        var equal = Assert.Throws<CompanionContractException>(() =>
            CompanionOperationEvidenceCodec.Validate(intent with
            {
                ModelSourceRoot = sourceCacheRoot
            }));
        Assert.Equal("journal-source-acquisition-intent-root-collision", equal.Code);
    }

    [Theory]
    [InlineData("schema")]
    [InlineData("digest")]
    public void SourceAcquisitionIntentRejectsPayloadInventoryAuthorityDrift(string field)
    {
        var setup = PrepareAcquisition(CreateJournal(out _), $"intent-inventory-{field}");
        var intent = setup.Evidence.Acquisition.Intent;
        var changed = field switch
        {
            "schema" => intent with { PayloadInventorySchema = "tinyrustlm.source-payload-inventory.v0" },
            "digest" => intent with { ExpectedPayloadInventorySha256 = CompanionContractTests.Digest('1') },
            _ => throw new ArgumentOutOfRangeException(nameof(field))
        };

        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionOperationEvidenceCodec.Validate(changed));

        Assert.Equal(
            $"journal-source-acquisition-intent-inventory-{field}",
            error.Code);
    }

    [Theory]
    [InlineData("schema")]
    [InlineData("digest")]
    public void SourceAcquisitionReceiptRejectsPayloadInventoryAuthorityDrift(string field)
    {
        var journal = CreateJournal(out _);
        var setup = PrepareAcquisition(journal, $"receipt-inventory-{field}");

        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionOperationTestEvidence.PersistSourceReceipt(
                journal,
                setup.Operation,
                setup.Evidence,
                setup.ModelSourceRoot,
                setup.TokenizerSourceRoot,
                payloadInventorySchema: field == "schema"
                    ? "tinyrustlm.source-payload-inventory.v0"
                    : null,
                payloadInventorySha256: field == "digest"
                    ? CompanionContractTests.Digest('2')
                    : null));

        Assert.Equal(
            $"journal-source-acquisition-receipt-inventory-{field}",
            error.Code);
    }

    [Fact]
    public void PhaseEvidenceCannotBeInjectedOnAnUnregisteredTransition()
    {
        var journal = CreateJournal(out _);
        var created = journal.CreateOrRead(CompanionContractTests.Request());

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            errorCode: "fixture-rejected",
            executionIntentSha256: CompanionContractTests.Digest('a')));

        Assert.Equal("journal-execution-intent-transition", error.Code);
        Assert.Null(journal.Read(created.OperationId).ExecutionIntentSha256);
    }

    [Fact]
    public void SourceConversionIntentIsCanonicalCreateOnlyAndExactlyIdempotent()
    {
        var journal = CreateJournal(out var root);
        var setup = PrepareAcquisition(journal, "idempotent");
        _ = CompanionOperationTestEvidence.PersistSourceReceipt(
            journal,
            setup.Operation,
            setup.Evidence,
            setup.ModelSourceRoot,
            setup.TokenizerSourceRoot);
        var intent = SourceIntent(setup);

        var first = journal.PersistSourceConversionIntent(intent);
        var second = journal.PersistSourceConversionIntent(intent);

        Assert.Equal(first, second);
        var path = Path.Combine(
            root,
            "operations",
            setup.Operation.OperationId,
            "source-conversion.intent.json");
        var bytes = File.ReadAllBytes(path);
        Assert.Equal((byte)'\n', bytes[^1]);
        Assert.Equal(first.Sha256, Sha256(bytes));

        var changed = intent with
        {
            Conversion = intent.Conversion with { MaximumDurationMilliseconds = 43_199_999 }
        };
        var conflict = Assert.Throws<CompanionContractException>(() =>
            journal.PersistSourceConversionIntent(changed));
        Assert.Equal("journal-source-conversion-intent-conflict", conflict.Code);
        Assert.Equal(first.Sha256, Sha256(File.ReadAllBytes(path)));
    }

    [Fact]
    public void SourceConversionIntentRejectsDuplicateUnknownAndNoncanonicalJson()
    {
        var journal = CreateJournal(out var root);
        var setup = PrepareAcquisition(journal, "strict");
        _ = CompanionOperationTestEvidence.PersistSourceReceipt(
            journal,
            setup.Operation,
            setup.Evidence,
            setup.ModelSourceRoot,
            setup.TokenizerSourceRoot);
        _ = journal.PersistSourceConversionIntent(SourceIntent(setup));
        var path = Path.Combine(
            root,
            "operations",
            setup.Operation.OperationId,
            "source-conversion.intent.json");
        var original = File.ReadAllText(path);

        File.WriteAllText(
            path,
            original.Replace(
                "\"operationId\":",
                $"\"operationId\":\"{setup.Operation.OperationId}\",\"operationId\":",
                StringComparison.Ordinal));
        var duplicate = Assert.Throws<CompanionContractException>(() =>
            journal.ReadSourceConversionIntent(setup.Operation.OperationId));
        Assert.Equal("journal-source-conversion-intent-json", duplicate.Code);

        File.WriteAllText(path, original.TrimEnd('\r', '\n'));
        var noncanonical = Assert.Throws<CompanionContractException>(() =>
            journal.ReadSourceConversionIntent(setup.Operation.OperationId));
        Assert.Equal("journal-source-conversion-intent-canonical", noncanonical.Code);

        var unknownText = original.TrimEnd('\r', '\n');
        File.WriteAllText(path, $"{unknownText[..^1]},\"unknown\":true}}\n");
        var unknown = Assert.Throws<CompanionContractException>(() =>
            journal.ReadSourceConversionIntent(setup.Operation.OperationId));
        Assert.Equal("journal-source-conversion-intent-json", unknown.Code);
    }

    [Fact]
    public void ReplacementOperationSchemaRejectsPriorRecordWithoutMigration()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var current = Path.Combine(root, "operations", created.OperationId, "current.json");
        File.WriteAllText(
            current,
            File.ReadAllText(current).Replace(
                CompanionContract.OperationRecordSchema,
                "tinyrustlm.companion.operation.v2",
                StringComparison.Ordinal));

        var error = Assert.Throws<CompanionContractException>(() =>
            journal.Read(created.OperationId));
        Assert.Equal("journal-record-contract", error.Code);
    }

    [Fact]
    public void JournalRejectsNoncanonicalRecordAndUnprojectableProgress()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var current = Path.Combine(root, "operations", created.OperationId, "current.json");
        var original = File.ReadAllBytes(current);
        File.WriteAllBytes(current, [(byte)' ', .. original]);
        var canonical = Assert.Throws<CompanionContractException>(() =>
            journal.Read(created.OperationId));
        Assert.Equal("journal-record-canonical", canonical.Code);

        File.WriteAllBytes(current, original);
        var progress = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            phaseCompletedBytes: CompanionContract.MaximumProgressBytes + 1,
            errorCode: "fixture-rejected"));
        Assert.Equal("journal-progress", progress.Code);
    }

    [Fact]
    public void BoundPhaseEvidenceCannotChangeOrReturnToNull()
    {
        var journal = CreateJournal(out _);
        var setup = PrepareAcquisition(journal, "immutable");
        var receipt = CompanionOperationTestEvidence.PersistSourceReceipt(
            journal,
            setup.Operation,
            setup.Evidence,
            setup.ModelSourceRoot,
            setup.TokenizerSourceRoot);
        var conversion = journal.PersistSourceConversionIntent(SourceIntent(setup));
        var converting = journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionRoute.Source,
            sourceAcquisitionReceiptSha256: receipt.Sha256,
            sourceConversionIntentSha256: conversion.Sha256);

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionRoute.Source,
            sourceConversionIntentSha256: CompanionContractTests.Digest('f')));
        Assert.Equal("journal-source-conversion-intent-immutable", error.Code);
        Assert.Equal(converting, journal.Read(setup.Operation.OperationId));

        var verifying = journal.Advance(
            setup.Operation.OperationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionRoute.Source);
        Assert.Equal(conversion.Sha256, verifying.SourceConversionIntentSha256);
    }

    [Fact]
    public void CancellationIntentIsCreateOnlyCanonicalAndExactlyIdempotent()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var request = new CompanionCancelRequest(
            CompanionLoopbackWire.CancelRequestSchema,
            new string('a', 32));

        var first = journal.BindCancellationIntent(created.OperationId, request);
        var replay = new CompanionOperationJournal(root)
            .BindCancellationIntent(created.OperationId, request);
        var read = journal.ReadCancellationIntent(created.OperationId);

        Assert.True(first.WasCreated);
        Assert.False(replay.WasCreated);
        Assert.False(read.WasCreated);
        Assert.Equal(first.Sha256, replay.Sha256);
        Assert.Equal(first.Sha256, read.Sha256);
        var path = Path.Combine(
            root,
            "operations",
            created.OperationId,
            "cancellation.intent.json");
        Assert.Equal(CompanionLoopbackWire.EncodeCancelRequest(request), File.ReadAllBytes(path));

        var conflict = Assert.Throws<CompanionContractException>(() =>
            journal.BindCancellationIntent(
                created.OperationId,
                request with { CancellationId = new string('b', 32) }));
        Assert.Equal("journal-operation-terminal", conflict.Code);
    }

    [Fact]
    public async Task ConcurrentExactCancellationBindsOneIntentAndNineReplays()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var request = new CompanionCancelRequest(
            CompanionLoopbackWire.CancelRequestSchema,
            new string('9', 32));

        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(() =>
            new CompanionOperationJournal(root)
                .BindCancellationIntent(created.OperationId, request))));

        Assert.Single(results, value => value.WasCreated);
        Assert.Equal(9, results.Count(value => !value.WasCreated));
        Assert.All(results, value => Assert.Equal(results[0].Sha256, value.Sha256));
    }

    [Fact]
    public void BoundCancellationReplaySurvivesTerminalRaceButNewIntentCannotReplaceIt()
    {
        var journal = CreateJournal(out _);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var request = new CompanionCancelRequest(
            CompanionLoopbackWire.CancelRequestSchema,
            new string('c', 32));
        var bound = journal.BindCancellationIntent(created.OperationId, request);
        var cancelled = journal.Advance(
            created.OperationId,
            CompanionOperationState.Cancelled,
            CompanionAcquisitionRoute.Source);

        var replay = journal.BindCancellationIntent(created.OperationId, request);
        var conflict = Assert.Throws<CompanionContractException>(() =>
            journal.BindCancellationIntent(
                created.OperationId,
                request with { CancellationId = new string('d', 32) }));

        Assert.False(replay.WasCreated);
        Assert.Equal(bound.Sha256, replay.Sha256);
        Assert.Equal("journal-operation-terminal", conflict.Code);
        Assert.Equal(cancelled, journal.Read(created.OperationId));
    }

    [Fact]
    public void FirstCancellationAfterTerminalEvidenceIsRejectedWithoutCreatingAnIntent()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        journal.Advance(
            created.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            errorCode: "source-unavailable");

        var error = Assert.Throws<CompanionContractException>(() =>
            journal.BindCancellationIntent(
                created.OperationId,
                new CompanionCancelRequest(
                    CompanionLoopbackWire.CancelRequestSchema,
                    new string('e', 32))));

        Assert.Equal("journal-operation-terminal", error.Code);
        Assert.False(File.Exists(Path.Combine(
            root,
            "operations",
            created.OperationId,
            "cancellation.intent.json")));
    }

    [Fact]
    public void CancellationIntentRejectsTamperInsteadOfRepairingOrReplacingIt()
    {
        var journal = CreateJournal(out var root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var request = new CompanionCancelRequest(
            CompanionLoopbackWire.CancelRequestSchema,
            new string('f', 32));
        journal.BindCancellationIntent(created.OperationId, request);
        var path = Path.Combine(
            root,
            "operations",
            created.OperationId,
            "cancellation.intent.json");
        File.WriteAllBytes(path, [(byte)' ', .. File.ReadAllBytes(path)]);

        var read = Assert.Throws<CompanionContractException>(() =>
            journal.ReadCancellationIntent(created.OperationId));
        var replay = Assert.Throws<CompanionContractException>(() =>
            journal.BindCancellationIntent(created.OperationId, request));

        Assert.Equal("journal-cancellation-intent-contract", read.Code);
        Assert.Equal("journal-cancellation-intent-contract", replay.Code);
        Assert.Equal((byte)' ', File.ReadAllBytes(path)[0]);
    }

    public void Dispose()
    {
        _scratch.Dispose();
    }

    private CompanionOperationJournal CreateJournal(
        out string root,
        TimeProvider? timeProvider = null)
    {
        Directory.CreateDirectory(_parent);
        root = CompanionOperationJournal.CreateOwnedRoot(
            Path.Combine(_parent, $"owned-{Guid.NewGuid():N}"));
        return new CompanionOperationJournal(root, timeProvider);
    }

    private AcquisitionSetup PrepareAcquisition(
        CompanionOperationJournal journal,
        string suffix)
    {
        var operation = journal.CreateOrRead(CompanionContractTests.Request());
        var privateRoot = Path.GetFullPath(Path.Combine(_parent, $"private-{suffix}"));
        var modelSourceRoot = Path.Combine(privateRoot, "model-source");
        var tokenizerSourceRoot = Path.Combine(privateRoot, "tokenizer-source");
        var outputRoot = Path.Combine(privateRoot, "composition-output");
        var evidence = CompanionOperationTestEvidence.EnterAcquiringSource(
            journal,
            operation,
            privateRoot,
            modelSourceRoot,
            tokenizerSourceRoot,
            outputRoot);
        return new AcquisitionSetup(
            operation,
            journal.Read(operation.OperationId),
            evidence,
            privateRoot,
            modelSourceRoot,
            tokenizerSourceRoot,
            outputRoot);
    }

    private static CompanionSourceConversionIntent SourceIntent(AcquisitionSetup setup)
    {
        var materializedLocks = Path.Combine(setup.PrivateRoot, "source-locks");
        var conversion = new TinyRustLmCompositionConversionIntent(
            TinyRustLmConversionTool.CompositionIntentSchema,
            Path.Combine(materializedLocks, "model.lock.json"),
            CompanionSourceDescriptor.ModelSourceLockSha256,
            setup.ModelSourceRoot,
            Path.Combine(materializedLocks, "tokenizer.lock.json"),
            CompanionSourceDescriptor.TokenizerSourceLockSha256,
            setup.TokenizerSourceRoot,
            TinyRustLmConversionTool.CompositionProfileSha256,
            setup.OutputRoot,
            Path.Combine(setup.PrivateRoot, "tinyrustlm-convert.exe"),
            CompanionContractTests.Digest('8'),
            43_200_000,
            65_536,
            4_096,
            "existing-output-root-is-never-resumed");
        return new CompanionSourceConversionIntent(
            CompanionContract.SourceConversionIntentSchema,
            setup.Operation.OperationId,
            setup.Operation.RequestSha256,
            conversion);
    }

    private static string Sha256(byte[] bytes) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes))
            .ToLowerInvariant();

    private sealed class FrozenTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() =>
            new(2026, 8, 24, 20, 0, 0, TimeSpan.Zero);
    }

    /// <summary>Pauses a single writer timestamp after it has acquired the actual operation lock.</summary>
    private sealed class PausingTimeProvider : TimeProvider, IDisposable
    {
        private int _armed;
        internal ManualResetEventSlim Entered { get; } = new();
        internal ManualResetEventSlim Continue { get; } = new();

        /// <summary>Arms the next timestamp without affecting initial operation creation.</summary>
        internal void Arm() => Interlocked.Exchange(ref _armed, 1);

        /// <summary>Exposes a deterministic in-progress write window, then returns a fixed valid timestamp.</summary>
        public override DateTimeOffset GetUtcNow()
        {
            if (Interlocked.Exchange(ref _armed, 0) != 0)
            {
                Entered.Set();
                if (!Continue.Wait(TimeSpan.FromSeconds(10))) throw new TimeoutException("Writer pause expired.");
            }
            return new(2026, 8, 24, 20, 0, 0, TimeSpan.Zero);
        }

        /// <summary>Releases synchronization resources after the writer and readers have exited.</summary>
        public void Dispose()
        {
            Entered.Dispose();
            Continue.Dispose();
        }
    }

    private sealed record AcquisitionSetup(
        CompanionOperationRecord Operation,
        CompanionOperationRecord Acquiring,
        CompanionTestAcquisitionEvidence Evidence,
        string PrivateRoot,
        string ModelSourceRoot,
        string TokenizerSourceRoot,
        string OutputRoot);
}
