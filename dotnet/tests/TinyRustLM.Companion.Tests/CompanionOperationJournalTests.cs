using TinyRustLM;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionOperationJournalTests : IDisposable
{
    private readonly string _parent = Path.Combine(
        Path.GetTempPath(),
        $"tinyrustlm-companion-tests-{Guid.NewGuid():N}");

    [Fact]
    public void JournalPersistsCreateOnlyHistoryAndTerminalComposition()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root, new FrozenTimeProvider());
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var checking = journal.Advance(
            created.OperationId,
            CompanionOperationState.CheckingPeers,
            CompanionAcquisitionBranch.Undecided);
        var acquiring = journal.Advance(
            created.OperationId,
            CompanionOperationState.AcquiringSource,
            CompanionAcquisitionBranch.Source,
            totalBytes: 4_000_000_000);
        var persisted = journal.PersistSourceConversionIntent(
            SourceIntent(created, _parent, "primary"));
        var converting = journal.Advance(
            created.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionBranch.Source,
            completedBytes: 4_000_000_000,
            totalBytes: 4_000_000_000,
            sourceConversionIntentSha256: persisted.Sha256);
        var verifying = journal.Advance(
            created.OperationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionBranch.Source);
        var available = journal.Advance(
            created.OperationId,
            CompanionOperationState.Available,
            CompanionAcquisitionBranch.Source,
            artifacts: CompanionContractTests.Artifacts());

        Assert.Equal((ulong)1, checking.Sequence);
        Assert.Equal((ulong)2, acquiring.Sequence);
        Assert.Equal((ulong)3, converting.Sequence);
        Assert.Equal((ulong)4, verifying.Sequence);
        Assert.Equal((ulong)5, available.Sequence);
        Assert.Equal(persisted.Sha256, converting.SourceConversionIntentSha256);
        Assert.Equal(persisted.Sha256, verifying.SourceConversionIntentSha256);
        Assert.Equal(persisted.Sha256, available.SourceConversionIntentSha256);
        Assert.Equal(available, new CompanionOperationJournal(root).Read(created.OperationId));
        var history = Directory.GetFiles(
            Path.Combine(root, "operations", created.OperationId, "history"),
            "*.json");
        Assert.Equal(6, history.Length);

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionBranch.Source,
            errorCode: "late-rejection"));
        Assert.Equal("journal-transition", error.Code);
    }

    [Fact]
    public void JournalRecoversDuplicateOperationAndRejectsInvalidTransition()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        Assert.Equal(
            created,
            new CompanionOperationJournal(root)
                .CreateOrRead(CompanionContractTests.Request()));
        var transition = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.Available,
            CompanionAcquisitionBranch.Source,
            artifacts: CompanionContractTests.Artifacts()));
        Assert.Equal("journal-transition", transition.Code);
    }

    [Fact]
    public async Task ConcurrentCreateOrReadElectsOneExactCommittedOperation()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var request = CompanionContractTests.Request();
        var tasks = Enumerable.Range(0, 10)
            .Select(_ => Task.Run(() =>
                new CompanionOperationJournal(root).CreateOrRead(request)))
            .ToArray();

        var records = await Task.WhenAll(tasks);
        Assert.All(records, record => Assert.Equal(records[0], record));
        var operationRoot = Path.Combine(root, "operations", records[0].OperationId);
        Assert.Single(Directory.GetFiles(Path.Combine(operationRoot, "history"), "*.json"));
        Assert.Equal(records[0], new CompanionOperationJournal(root).Read(records[0].OperationId));
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
    public void JournalRejectsAValidButTamperedImmutableRequest()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var requestPath = Path.Combine(root, "operations", created.OperationId, "request.json");
        var tampered = File.ReadAllText(requestPath).Replace(
            "qwen3-0.6b",
            "qwen3-0.7b",
            StringComparison.Ordinal);
        File.WriteAllText(requestPath, tampered);

        var error = Assert.Throws<CompanionContractException>(() =>
            journal.ReadRequest(created.OperationId));
        Assert.Equal("journal-request-identity", error.Code);
    }

    [Fact]
    public void JournalRejectsDuplicateRequestPropertiesBeforeInterpretingThem()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var requestPath = Path.Combine(root, "operations", created.OperationId, "request.json");
        var text = File.ReadAllText(requestPath).Replace(
            "\"modelId\":\"qwen3-0.6b\"",
            "\"modelId\":\"qwen3-0.6b\",\"modelId\":\"qwen3-0.6b\"",
            StringComparison.Ordinal);
        File.WriteAllText(requestPath, text);

        var error = Assert.Throws<CompanionContractException>(() =>
            journal.ReadRequest(created.OperationId));
        Assert.Equal("journal-request-json", error.Code);
    }

    [Fact]
    public void SourceIntentIsCanonicalCreateOnlyAndExactlyIdempotent()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = AdvanceToAcquiringSource(journal);
        var intent = SourceIntent(created, _parent, "idempotent");

        var first = journal.PersistSourceConversionIntent(intent);
        var second = journal.PersistSourceConversionIntent(intent);

        Assert.Equal(first, second);
        Assert.Matches("^[0-9a-f]{64}$", first.Sha256);
        var path = Path.Combine(
            root,
            "operations",
            created.OperationId,
            "source-conversion.intent.json");
        var bytes = File.ReadAllBytes(path);
        Assert.Equal((byte)'\n', bytes[^1]);
        Assert.Equal(first.Sha256, Sha256(bytes));
        using (var document = System.Text.Json.JsonDocument.Parse(bytes))
        {
            Assert.Equal(
                ["schema", "operationId", "requestSha256", "conversion"],
                document.RootElement.EnumerateObject().Select(property => property.Name));
            Assert.Equal(
                [
                    "schema",
                    "modelSourceLockPath",
                    "modelSourceLockSha256",
                    "modelSourceDirectory",
                    "tokenizerSourceLockPath",
                    "tokenizerSourceLockSha256",
                    "tokenizerSourceDirectory",
                    "compositionProfileSha256",
                    "outputRoot",
                    "converterExecutablePath",
                    "converterExecutableSha256",
                    "maximumDurationMilliseconds",
                    "maximumSummaryBytes",
                    "maximumErrorBytes",
                    "terminalRule"
                ],
                document.RootElement.GetProperty("conversion")
                    .EnumerateObject()
                    .Select(property => property.Name));
        }

        var changed = intent with
        {
            Conversion = intent.Conversion with
            {
                OutputRoot = Path.Combine(_parent, "different-output")
            }
        };
        var error = Assert.Throws<CompanionContractException>(() =>
            journal.PersistSourceConversionIntent(changed));
        Assert.Equal("journal-source-conversion-intent-conflict", error.Code);
        Assert.Equal(first.Sha256, Sha256(File.ReadAllBytes(path)));
    }

    [Fact]
    public void SourceIntentRejectsDuplicateUnknownAndNoncanonicalJson()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = AdvanceToAcquiringSource(journal);
        journal.PersistSourceConversionIntent(SourceIntent(created, _parent, "strict"));
        var path = Path.Combine(
            root,
            "operations",
            created.OperationId,
            "source-conversion.intent.json");
        var original = File.ReadAllText(path);

        var duplicate = original.Replace(
            "\"operationId\":",
            $"\"operationId\":\"{created.OperationId}\",\"operationId\":",
            StringComparison.Ordinal);
        File.WriteAllText(path, duplicate);
        var error = Assert.Throws<CompanionContractException>(() =>
            journal.ReadSourceConversionIntent(created.OperationId));
        Assert.Equal("journal-source-conversion-intent-json", error.Code);

        File.WriteAllText(path, original.TrimEnd('\r', '\n'));
        error = Assert.Throws<CompanionContractException>(() =>
            journal.ReadSourceConversionIntent(created.OperationId));
        Assert.Equal("journal-source-conversion-intent-canonical", error.Code);

        var unknown = original.TrimEnd('\r', '\n');
        unknown = $"{unknown[..^1]},\"unknown\":true}}\n";
        File.WriteAllText(path, unknown);
        error = Assert.Throws<CompanionContractException>(() =>
            journal.ReadSourceConversionIntent(created.OperationId));
        Assert.Equal("journal-source-conversion-intent-json", error.Code);
    }

    [Fact]
    public void ReplacementOperationSchemaRejectsPriorRecordWithoutMigration()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var current = Path.Combine(root, "operations", created.OperationId, "current.json");
        var prior = File.ReadAllText(current).Replace(
            "tinyrustlm.companion.operation.v2",
            "tinyrustlm.companion.operation.v1",
            StringComparison.Ordinal);
        File.WriteAllText(current, prior);

        var error = Assert.Throws<CompanionContractException>(() =>
            journal.Read(created.OperationId));

        Assert.Equal("journal-record-contract", error.Code);
    }

    [Fact]
    public void JournalRejectsNoncanonicalCurrentRecordAndUnprojectableProgress()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
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
            CompanionOperationState.CheckingPeers,
            CompanionAcquisitionBranch.Undecided,
            completedBytes: CompanionContract.MaximumProgressBytes + 1));
        Assert.Equal("journal-progress", progress.Code);
    }

    [Fact]
    public void PeerBranchCannotAcquireASourceConversionIntentHash()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.CreateOrRead(CompanionContractTests.Request());

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.CheckingPeers,
            CompanionAcquisitionBranch.Undecided,
            sourceConversionIntentSha256: CompanionContractTests.Digest('a')));

        Assert.Equal("journal-source-conversion-intent-transition", error.Code);
        Assert.Null(journal.Read(created.OperationId).SourceConversionIntentSha256);
    }

    [Fact]
    public void BoundSourceIntentHashCannotChangeOrReturnToNull()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = AdvanceToAcquiringSource(journal);
        var persisted = journal.PersistSourceConversionIntent(
            SourceIntent(created, _parent, "immutable"));
        var converting = journal.Advance(
            created.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionBranch.Source,
            sourceConversionIntentSha256: persisted.Sha256);

        var error = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionBranch.Source,
            sourceConversionIntentSha256: CompanionContractTests.Digest('f')));

        Assert.Equal("journal-source-conversion-intent-immutable", error.Code);
        Assert.Equal(converting, journal.Read(created.OperationId));
        var verifying = journal.Advance(
            created.OperationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionBranch.Source);
        Assert.Equal(persisted.Sha256, verifying.SourceConversionIntentSha256);
    }

    public void Dispose()
    {
        if (Directory.Exists(_parent))
        {
            Directory.Delete(_parent, recursive: true);
        }
    }

    private sealed class FrozenTimeProvider : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() =>
            new(2026, 8, 24, 20, 0, 0, TimeSpan.Zero);
    }

    private CompanionOperationRecord AdvanceToAcquiringSource(CompanionOperationJournal journal)
    {
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        journal.Advance(
            created.OperationId,
            CompanionOperationState.CheckingPeers,
            CompanionAcquisitionBranch.Undecided);
        journal.Advance(
            created.OperationId,
            CompanionOperationState.AcquiringSource,
            CompanionAcquisitionBranch.Source);
        return created;
    }

    private static CompanionSourceConversionIntent SourceIntent(
        CompanionOperationRecord operation,
        string parent,
        string suffix)
    {
        var intentRoot = Path.GetFullPath(Path.Combine(parent, $"intent-{suffix}"));
        var conversion = new TinyRustLmCompositionConversionIntent(
            TinyRustLmConversionTool.CompositionIntentSchema,
            Path.Combine(intentRoot, "model.lock.json"),
            CompanionContractTests.Digest('2'),
            Path.Combine(intentRoot, "model-source"),
            Path.Combine(intentRoot, "tokenizer.lock.json"),
            CompanionContractTests.Digest('3'),
            Path.Combine(intentRoot, "tokenizer-source"),
            TinyRustLmConversionTool.CompositionProfileSha256,
            Path.Combine(intentRoot, "composition-output"),
            Path.Combine(intentRoot, "tinyrustlm-convert.exe"),
            CompanionContractTests.Digest('4'),
            43_200_000,
            65_536,
            4_096,
            "existing-output-root-is-never-resumed");
        return new CompanionSourceConversionIntent(
            CompanionContract.SourceConversionIntentSchema,
            operation.OperationId,
            operation.RequestSha256,
            conversion);
    }

    private static string Sha256(byte[] bytes) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes))
            .ToLowerInvariant();
}
