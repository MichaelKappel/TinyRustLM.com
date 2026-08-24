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
        var created = journal.Create(CompanionContractTests.Request());
        var checking = journal.Advance(
            created.OperationId,
            CompanionOperationState.CheckingPeers,
            CompanionAcquisitionBranch.Undecided);
        var acquiring = journal.Advance(
            created.OperationId,
            CompanionOperationState.AcquiringSource,
            CompanionAcquisitionBranch.Source,
            totalBytes: 4_000_000_000);
        var converting = journal.Advance(
            created.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionBranch.Source,
            completedBytes: 4_000_000_000,
            totalBytes: 4_000_000_000);
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
    public void JournalRejectsDuplicateOperationAndInvalidTransition()
    {
        Directory.CreateDirectory(_parent);
        var root = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(_parent, "owned"));
        var journal = new CompanionOperationJournal(root);
        var created = journal.Create(CompanionContractTests.Request());

        var duplicate = Assert.Throws<CompanionContractException>(() =>
            journal.Create(CompanionContractTests.Request()));
        Assert.Equal("journal-operation-exists", duplicate.Code);
        var transition = Assert.Throws<CompanionContractException>(() => journal.Advance(
            created.OperationId,
            CompanionOperationState.Available,
            CompanionAcquisitionBranch.Source,
            artifacts: CompanionContractTests.Artifacts()));
        Assert.Equal("journal-transition", transition.Code);
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
        var created = journal.Create(CompanionContractTests.Request());
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
        var created = journal.Create(CompanionContractTests.Request());
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
}
