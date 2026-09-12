using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionOperationServiceTests : IDisposable
{
    private readonly CanonicalTestScratch _scratch = new("service");
    private string _parent => _scratch.Path;

    [Fact]
    public async Task CreateOrReadUsesOneDeterministicOperationAndRecoversItsProjection()
    {
        var journal = CreateJournal();
        var executor = new RecordingExecutor(
            ensureStarted: operationId =>
            {
                var current = journal.Read(operationId);
                if (current.State == CompanionOperationState.Queued)
                {
                    var privateRoot = Path.Combine(_parent, "executor");
                    _ = CompanionOperationTestEvidence.EnterAcquiringSource(
                        journal,
                        current,
                        privateRoot,
                        Path.Combine(privateRoot, "model-source"),
                        Path.Combine(privateRoot, "tokenizer-source"),
                        Path.Combine(privateRoot, "output"));
                }
                return Task.CompletedTask;
            });
        var service = Service(journal, executor);
        var request = CompanionContractTests.Request();

        var first = await service.CreateOrReadAsync(request);
        var replay = await service.CreateOrReadAsync(request);
        var read = service.Read(first.OperationId);

        Assert.Equal(CompanionContract.OperationId(request), first.OperationId);
        Assert.Equal(first, replay);
        Assert.Equal(first, read);
        Assert.Equal(CompanionOperationState.AcquiringSource, first.State);
        Assert.Equal(2, executor.EnsureStartedCount);
        Assert.All(executor.StartedOperationIds, value => Assert.Equal(first.OperationId, value));
        Assert.Equal(
            CompanionLoopbackWire.EncodeOperationProjection(first),
            CompanionLoopbackWire.EncodeOperationProjection(read));
    }

    [Fact]
    public async Task CancellationBindsOnceAndReturnsOnlyAfterActualTerminalState()
    {
        var journal = CreateJournal();
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var executor = new RecordingExecutor(
            cancelAndWait: (operationId, _) =>
            {
                Assert.Equal(
                    CompanionLoopbackWire.CancelRequestSchema,
                    journal.ReadCancellationIntent(operationId).Request.Schema);
                journal.Advance(
                    operationId,
                    CompanionOperationState.Cancelled,
                    CompanionAcquisitionRoute.Source);
                return Task.CompletedTask;
            });
        var service = Service(journal, executor);
        var request = Cancel('a');

        var cancelled = await service.CancelAndWaitAsync(created.OperationId, request);
        var replay = await service.CancelAndWaitAsync(created.OperationId, request);

        Assert.Equal(CompanionOperationState.Cancelled, cancelled.State);
        Assert.Equal(cancelled, replay);
        Assert.Equal(1, executor.CancelCount);
        Assert.Equal(request.CancellationId, executor.CancellationIds.Single());
        Assert.Equal(cancelled, service.Read(created.OperationId));
    }

    [Fact]
    public async Task TerminalEvidenceWinsCancellationRaceEvenWhenExecutorReportsFailure()
    {
        var journal = CreateJournal();
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var executor = new RecordingExecutor(
            cancelAndWait: (operationId, _) =>
            {
                journal.Advance(
                    operationId,
                    CompanionOperationState.Rejected,
                    CompanionAcquisitionRoute.Source,
                    errorCode: "source-rejected");
                throw new IOException("private failure must not cross the service boundary");
            });
        var service = Service(journal, executor);

        var result = await service.CancelAndWaitAsync(created.OperationId, Cancel('b'));

        Assert.Equal(CompanionOperationState.Rejected, result.State);
        Assert.Equal("source-rejected", result.ErrorCode);
        Assert.Equal(1, executor.CancelCount);
    }

    [Fact]
    public async Task CancellationCannotReturnSuccessWhileOwnedWorkRemainsNonterminal()
    {
        var journal = CreateJournal();
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var executor = new RecordingExecutor(cancelAndWait: (_, _) => Task.CompletedTask);
        var service = Service(journal, executor);

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.CancelAndWaitAsync(created.OperationId, Cancel('c')));

        Assert.Equal("internal-failure", error.Code);
        Assert.Equal(CompanionOperationState.Queued, journal.Read(created.OperationId).State);
        Assert.Equal(Cancel('c'), journal.ReadCancellationIntent(created.OperationId).Request);
    }

    [Fact]
    public async Task DifferentOrFirstLateCancellationReturnsOperationTerminal()
    {
        var journal = CreateJournal();
        var created = journal.CreateOrRead(CompanionContractTests.Request());
        var executor = new RecordingExecutor(
            cancelAndWait: (operationId, _) =>
            {
                journal.Advance(
                    operationId,
                    CompanionOperationState.Cancelled,
                    CompanionAcquisitionRoute.Source);
                return Task.CompletedTask;
            });
        var service = Service(journal, executor);
        _ = await service.CancelAndWaitAsync(created.OperationId, Cancel('d'));

        var different = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.CancelAndWaitAsync(created.OperationId, Cancel('e')));

        var secondRequest = CompanionContractTests.Request() with
        {
            AttemptId = new string('1', 32)
        };
        var terminal = journal.CreateOrRead(secondRequest);
        journal.Advance(
            terminal.OperationId,
            CompanionOperationState.Rejected,
            CompanionAcquisitionRoute.Source,
            errorCode: "source-rejected");
        var late = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.CancelAndWaitAsync(terminal.OperationId, Cancel('f')));

        Assert.Equal("operation-terminal", different.Code);
        Assert.Equal("operation-terminal", late.Code);
        Assert.Equal(1, executor.CancelCount);
    }

    [Fact]
    public async Task ExecutorFailureReturnsBoundedErrorUnlessItCommittedTerminalEvidence()
    {
        var journal = CreateJournal();
        var executor = new RecordingExecutor(
            ensureStarted: _ => throw new IOException("private path E:/must/not/leak"));
        var service = Service(journal, executor);

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.CreateOrReadAsync(CompanionContractTests.Request()));

        Assert.Equal("internal-failure", error.Code);
        Assert.DoesNotContain("E:/", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MissingAndMalformedOperationIdsMapToOnePublicNotFoundError()
    {
        var journal = CreateJournal();
        var service = Service(journal, new RecordingExecutor());

        var malformed = Assert.Throws<CompanionProtocolException>(() =>
            service.Read("malformed"));
        var missing = Assert.Throws<CompanionProtocolException>(() =>
            service.Read(new string('a', 64)));
        var missingCancel = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.CancelAndWaitAsync(new string('b', 64), Cancel('1')));

        Assert.Equal("operation-not-found", malformed.Code);
        Assert.Equal("operation-not-found", missing.Code);
        Assert.Equal("operation-not-found", missingCancel.Code);
    }

    public void Dispose()
    {
        _scratch.Dispose();
    }

    private CompanionOperationJournal CreateJournal()
    {
        Directory.CreateDirectory(_parent);
        var root = Path.Combine(_parent, $"owned-{Guid.NewGuid():N}");
        return new CompanionOperationJournal(CompanionOperationJournal.CreateOwnedRoot(root));
    }

    private static CompanionOperationService Service(
        CompanionOperationJournal journal,
        ICompanionOperationExecutor executor) =>
        new(journal, executor, new CompanionArtifactTransfer(journal));

    private static CompanionCancelRequest Cancel(char value) =>
        new(CompanionLoopbackWire.CancelRequestSchema, new string(value, 32));

    private sealed class RecordingExecutor : ICompanionOperationExecutor
    {
        private readonly Func<string, Task> _ensureStarted;
        private readonly Func<string, string, Task> _cancelAndWait;

        internal RecordingExecutor(
            Func<string, Task>? ensureStarted = null,
            Func<string, string, Task>? cancelAndWait = null)
        {
            _ensureStarted = ensureStarted ?? (_ => Task.CompletedTask);
            _cancelAndWait = cancelAndWait ?? ((_, _) => Task.CompletedTask);
        }

        internal int EnsureStartedCount { get; private set; }
        internal int CancelCount { get; private set; }
        internal List<string> StartedOperationIds { get; } = [];
        internal List<string> CancellationIds { get; } = [];

        public Task EnsureStartedAsync(string operationId)
        {
            EnsureStartedCount++;
            StartedOperationIds.Add(operationId);
            return _ensureStarted(operationId);
        }

        public Task CancelAndWaitAsync(string operationId, string cancellationId)
        {
            CancelCount++;
            CancellationIds.Add(cancellationId);
            return _cancelAndWait(operationId, cancellationId);
        }
    }
}
