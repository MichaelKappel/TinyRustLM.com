namespace TinyRustLM.Companion;

/// <summary>
/// Owns idempotent scheduling and actual cancellation of one journaled acquisition operation.
/// </summary>
public interface ICompanionOperationExecutor
{
    /// <summary>
    /// Starts or recovers the exact operation without creating a second logical execution.
    /// </summary>
    Task EnsureStartedAsync(string operationId);

    /// <summary>
    /// Stops owned work and returns only after the journal contains authoritative terminal evidence.
    /// </summary>
    Task CancelAndWaitAsync(string operationId, string cancellationId);
}

/// <summary>
/// The public-safe operation boundary between authenticated loopback transport and private work.
/// </summary>
public sealed class CompanionOperationService
{
    private readonly CompanionOperationJournal _journal;
    private readonly ICompanionOperationExecutor _executor;
    private readonly CompanionArtifactTransfer _artifacts;

    public CompanionOperationService(
        CompanionOperationJournal journal,
        ICompanionOperationExecutor executor,
        CompanionArtifactTransfer artifacts)
    {
        _journal = journal ?? throw new ArgumentNullException(nameof(journal));
        _executor = executor ?? throw new ArgumentNullException(nameof(executor));
        _artifacts = artifacts ?? throw new ArgumentNullException(nameof(artifacts));
    }

    public async Task<CompanionOperationProjection> CreateOrReadAsync(
        CompanionAcquireRequest request)
    {
        CompanionOperationRecord current;
        try
        {
            current = _journal.CreateOrRead(request);
        }
        catch (CompanionContractException error)
        {
            throw Map(error);
        }

        if (!IsTerminal(current.State))
        {
            try
            {
                await _executor.EnsureStartedAsync(current.OperationId).ConfigureAwait(false);
            }
            catch (Exception error)
            {
                var terminal = TryReadTerminal(current.OperationId);
                if (terminal is not null)
                {
                    return Project(terminal);
                }
                throw NormalizeExecutorError(error);
            }
            current = ReadRecord(current.OperationId);
        }
        return Project(current);
    }

    public CompanionOperationProjection Read(string operationId) =>
        Project(ReadRecord(operationId));

    public async Task<CompanionOperationProjection> CancelAndWaitAsync(
        string operationId,
        CompanionCancelRequest request)
    {
        CompanionPersistedCancellationIntent cancellation;
        try
        {
            cancellation = _journal.BindCancellationIntent(operationId, request);
        }
        catch (CompanionContractException error)
        {
            throw Map(error);
        }

        var current = ReadRecord(operationId);
        if (IsTerminal(current.State))
        {
            return Project(current);
        }

        try
        {
            await _executor.CancelAndWaitAsync(
                operationId,
                cancellation.Request.CancellationId).ConfigureAwait(false);
        }
        catch (Exception error)
        {
            var terminal = TryReadTerminal(operationId);
            if (terminal is not null)
            {
                return Project(terminal);
            }
            throw NormalizeExecutorError(error);
        }

        current = ReadRecord(operationId);
        if (!IsTerminal(current.State))
        {
            throw new CompanionProtocolException("internal-failure");
        }
        return Project(current);
    }

    public Task<CompanionArtifactChunk> ReadArtifactChunkAsync(
        string operationId,
        string artifactRole,
        ulong chunkIndex,
        CancellationToken cancellationToken = default) =>
        _artifacts.ReadChunkAsync(
            operationId,
            artifactRole,
            chunkIndex,
            cancellationToken);

    private CompanionOperationRecord ReadRecord(string operationId)
    {
        try
        {
            return _journal.Read(operationId);
        }
        catch (CompanionContractException error)
        {
            throw Map(error);
        }
    }

    private CompanionOperationRecord? TryReadTerminal(string operationId)
    {
        try
        {
            var current = _journal.Read(operationId);
            return IsTerminal(current.State) ? current : null;
        }
        catch (CompanionContractException)
        {
            return null;
        }
    }

    private static CompanionOperationProjection Project(CompanionOperationRecord record)
    {
        var projection = new CompanionOperationProjection(
            CompanionLoopbackWire.OperationProjectionSchema,
            record.OperationId,
            record.Sequence,
            record.State,
            record.Route,
            record.PhaseCompletedBytes,
            record.PhaseTotalBytes,
            record.Artifacts,
            record.ErrorCode);
        _ = CompanionLoopbackWire.EncodeOperationProjection(projection);
        return projection;
    }

    private static bool IsTerminal(CompanionOperationState state) =>
        state is CompanionOperationState.Available or
            CompanionOperationState.Cancelled or
            CompanionOperationState.Rejected;

    private static CompanionProtocolException Map(CompanionContractException error) =>
        new(error.Code switch
        {
            "journal-operation-missing" or "journal-operation-id" => "operation-not-found",
            "journal-operation-terminal" => "operation-terminal",
            "journal-operation-busy" => "companion-unavailable",
            var code when code.StartsWith("acquire-", StringComparison.Ordinal) =>
                "contract-invalid",
            _ => "internal-failure"
        });

    private static CompanionProtocolException NormalizeExecutorError(Exception error) =>
        error switch
        {
            CompanionProtocolException protocol => protocol,
            OperationCanceledException => new CompanionProtocolException("companion-unavailable"),
            _ => new CompanionProtocolException("internal-failure")
        };
}
