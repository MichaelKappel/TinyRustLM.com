using TinyRustLM;

namespace TinyRustLM.Companion;

public sealed record CompanionSourceConversionRequest(
    string ModelSourceLockPath,
    string ModelSourceDirectory,
    string TokenizerSourceLockPath,
    string TokenizerSourceDirectory,
    string OutputRoot);

public sealed record CompanionSourceConversionResult(
    CompanionOperationRecord Operation,
    TinyRustLmVerifiedComposition Composition,
    TinyRustLmCompositionConversionObservation? LiveObservation);

public enum CompanionSourceConversionReconciliationStatus
{
    /// <summary>The attempt has no terminal native evidence yet.</summary>
    Pending,

    /// <summary>The durable composition was verified and made available.</summary>
    Available,

    /// <summary>A native rejection or invalid terminal evidence was preserved.</summary>
    Rejected
}

public sealed record CompanionSourceConversionReconciliationResult(
    CompanionSourceConversionReconciliationStatus Status,
    CompanionOperationRecord Operation,
    TinyRustLmVerifiedComposition? Composition,
    string? ErrorCode);

public sealed class CompanionSourceConversion
{
    private readonly CompanionOperationJournal _journal;
    private readonly TinyRustLmConversionTool _tool;

    public CompanionSourceConversion(
        CompanionOperationJournal journal,
        TinyRustLmConversionTool tool)
    {
        _journal = journal ?? throw new ArgumentNullException(nameof(journal));
        _tool = tool ?? throw new ArgumentNullException(nameof(tool));
    }

    public async Task<CompanionSourceConversionResult> RunAsync(
        string operationId,
        CompanionSourceConversionRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var current = _journal.Read(operationId);
        if (current.State != CompanionOperationState.AcquiringSource ||
            current.Branch != CompanionAcquisitionBranch.Source ||
            current.Artifacts is not null ||
            current.ErrorCode is not null)
        {
            throw new CompanionContractException("companion-conversion-state");
        }
        var acquisition = _journal.ReadRequest(operationId);
        if (acquisition.CompositionProfileSha256 != TinyRustLmConversionTool.CompositionProfileSha256)
        {
            const string code = "companion-conversion-profile";
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            throw new CompanionContractException(code);
        }

        TinyRustLmCompositionConversionIntent conversionIntent;
        CompanionPersistedSourceConversionIntent persistedIntent;
        try
        {
            conversionIntent = _tool.CreateCompositionIntent(
                new TinyRustLmCompositionConversionRequest(
                    request.ModelSourceLockPath,
                    acquisition.ModelSourceLockSha256,
                    request.ModelSourceDirectory,
                    request.TokenizerSourceLockPath,
                    acquisition.TokenizerSourceLockSha256,
                    request.TokenizerSourceDirectory,
                    acquisition.CompositionProfileSha256,
                    request.OutputRoot));
            persistedIntent = _journal.PersistSourceConversionIntent(
                new CompanionSourceConversionIntent(
                    CompanionContract.SourceConversionIntentSchema,
                    operationId,
                    current.RequestSha256,
                    conversionIntent));
            current = _journal.Advance(
                operationId,
                CompanionOperationState.Converting,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                sourceConversionIntentSha256: persistedIntent.Sha256);
        }
        catch (TinyRustLmException error)
        {
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: error.Code);
            throw;
        }
        catch (CompanionContractException error)
        {
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: error.Code);
            throw;
        }
        catch (Exception error) when (error is ArgumentException or IOException or UnauthorizedAccessException)
        {
            const string code = "companion-conversion-input";
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            throw new CompanionContractException(code);
        }

        TinyRustLmCompositionConversionResult conversion;
        try
        {
            conversion = await _tool.ConvertCompositionAsync(conversionIntent, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            TinyRustLmCompositionTerminalInspection inspection;
            try
            {
                inspection = TinyRustLmConversionTool.InspectCompositionTerminal(conversionIntent);
            }
            catch (TinyRustLmException)
            {
                const string code = "companion-conversion-terminal-invalid";
                _journal.Advance(
                    operationId,
                    CompanionOperationState.Rejected,
                    CompanionAcquisitionBranch.Source,
                    current.CompletedBytes,
                    current.TotalBytes,
                    errorCode: code);
                throw new CompanionContractException(code);
            }

            if (inspection.Status == TinyRustLmCompositionTerminalStatus.Pass)
            {
                return CompleteAvailable(
                    operationId,
                    inspection.Composition ?? throw new CompanionContractException(
                        "companion-conversion-terminal-invalid"),
                    liveObservation: null);
            }
            if (inspection.Status == TinyRustLmCompositionTerminalStatus.Rejected)
            {
                var code = inspection.ErrorCode ?? "companion-conversion-terminal-invalid";
                _journal.Advance(
                    operationId,
                    CompanionOperationState.Rejected,
                    CompanionAcquisitionBranch.Source,
                    current.CompletedBytes,
                    current.TotalBytes,
                    errorCode: code);
                throw new TinyRustLmException(code);
            }

            _journal.Advance(
                operationId,
                CompanionOperationState.Cancelled,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes);
            throw;
        }
        catch (TinyRustLmException error)
        {
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: error.Code);
            throw;
        }
        catch (Exception error) when (error is ArgumentException or IOException or UnauthorizedAccessException)
        {
            const string code = "companion-conversion-input";
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            throw new CompanionContractException(code);
        }

        if (conversion.Composition.ModelSourceLockSha256 != acquisition.ModelSourceLockSha256 ||
            conversion.Composition.TokenizerSourceLockSha256 != acquisition.TokenizerSourceLockSha256)
        {
            const string code = "companion-conversion-source-identity";
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            throw new CompanionContractException(code);
        }

        return CompleteAvailable(
            operationId,
            conversion.Composition,
            conversion.Observation);
    }

    public CompanionSourceConversionReconciliationResult ReconcileTerminal(string operationId)
    {
        var current = _journal.Read(operationId);
        if (current.Branch != CompanionAcquisitionBranch.Source ||
            current.State is not (CompanionOperationState.Converting or
                CompanionOperationState.VerifyingComposition) ||
            current.SourceConversionIntentSha256 is null ||
            current.Artifacts is not null ||
            current.ErrorCode is not null)
        {
            throw new CompanionContractException("companion-conversion-reconciliation-state");
        }

        CompanionPersistedSourceConversionIntent persisted;
        TinyRustLmCompositionTerminalInspection inspection;
        try
        {
            persisted = _journal.ReadSourceConversionIntent(operationId);
            inspection = TinyRustLmConversionTool.InspectCompositionTerminal(
                persisted.Intent.Conversion);
        }
        catch (Exception error) when (error is CompanionContractException or TinyRustLmException)
        {
            const string code = "companion-conversion-terminal-invalid";
            var rejected = _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            return new CompanionSourceConversionReconciliationResult(
                CompanionSourceConversionReconciliationStatus.Rejected,
                rejected,
                null,
                code);
        }

        if (inspection.Status == TinyRustLmCompositionTerminalStatus.Pending)
        {
            return new CompanionSourceConversionReconciliationResult(
                CompanionSourceConversionReconciliationStatus.Pending,
                current,
                null,
                "awaiting-terminal-evidence");
        }
        if (inspection.Status == TinyRustLmCompositionTerminalStatus.Rejected)
        {
            var code = inspection.ErrorCode ?? "companion-conversion-terminal-invalid";
            var rejected = _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            return new CompanionSourceConversionReconciliationResult(
                CompanionSourceConversionReconciliationStatus.Rejected,
                rejected,
                null,
                code);
        }

        var completed = CompleteAvailable(
            operationId,
            inspection.Composition ?? throw new CompanionContractException(
                "companion-conversion-terminal-invalid"),
            liveObservation: null);
        return new CompanionSourceConversionReconciliationResult(
            CompanionSourceConversionReconciliationStatus.Available,
            completed.Operation,
            completed.Composition,
            null);
    }

    private CompanionSourceConversionResult CompleteAvailable(
        string operationId,
        TinyRustLmVerifiedComposition composition,
        TinyRustLmCompositionConversionObservation? liveObservation)
    {
        var current = _journal.Read(operationId);
        if (current.Branch != CompanionAcquisitionBranch.Source ||
            current.State is not (CompanionOperationState.Converting or
                CompanionOperationState.VerifyingComposition))
        {
            throw new CompanionContractException("companion-conversion-completion-state");
        }
        var acquisition = _journal.ReadRequest(operationId);
        if (composition.ModelSourceLockSha256 != acquisition.ModelSourceLockSha256 ||
            composition.TokenizerSourceLockSha256 != acquisition.TokenizerSourceLockSha256)
        {
            const string code = "companion-conversion-source-identity";
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            throw new CompanionContractException(code);
        }

        CompanionArtifactSet artifacts;
        ulong totalBytes;
        try
        {
            artifacts = ToCompanionArtifacts(composition.Artifacts);
            CompanionContract.ValidateArtifactSet(artifacts);
            totalBytes = composition.Artifacts.InCanonicalOrder()
                .Aggregate(0UL, (total, artifact) => checked(total + artifact.ByteLength));
        }
        catch (Exception error) when (error is CompanionContractException or OverflowException)
        {
            const string code = "companion-conversion-result";
            _journal.Advance(
                operationId,
                CompanionOperationState.Rejected,
                CompanionAcquisitionBranch.Source,
                current.CompletedBytes,
                current.TotalBytes,
                errorCode: code);
            throw new CompanionContractException(code);
        }

        if (current.State == CompanionOperationState.Converting)
        {
            _journal.Advance(
                operationId,
                CompanionOperationState.VerifyingComposition,
                CompanionAcquisitionBranch.Source,
                totalBytes,
                totalBytes);
        }
        var available = _journal.Advance(
            operationId,
            CompanionOperationState.Available,
            CompanionAcquisitionBranch.Source,
            totalBytes,
            totalBytes,
            artifacts);
        return new CompanionSourceConversionResult(
            available,
            composition,
            liveObservation);
    }

    private static CompanionArtifactSet ToCompanionArtifacts(
        TinyRustLmCompositionArtifactSet artifacts) =>
        new(
            ToCompanionArtifact(artifacts.Composition),
            ToCompanionArtifact(artifacts.Model),
            ToCompanionArtifact(artifacts.Tokenizer),
            ToCompanionArtifact(artifacts.Template),
            ToCompanionArtifact(artifacts.Sampling),
            ToCompanionArtifact(artifacts.Prompt));

    private static CompanionArtifact ToCompanionArtifact(TinyRustLmCompositionArtifact artifact) =>
        new(
            artifact.Kind,
            $"sha256:{artifact.Sha256}",
            artifact.Sha256,
            artifact.ByteLength);
}
