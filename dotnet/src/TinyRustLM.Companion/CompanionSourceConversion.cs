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
    TinyRustLmCompositionConversionResult Conversion);

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
            throw new CompanionContractException("companion-conversion-profile");
        }

        current = _journal.Advance(
            operationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionBranch.Source,
            current.CompletedBytes,
            current.TotalBytes);
        TinyRustLmCompositionConversionResult conversion;
        try
        {
            conversion = await _tool.ConvertCompositionAsync(
                new TinyRustLmCompositionConversionRequest(
                    request.ModelSourceLockPath,
                    acquisition.ModelSourceLockSha256,
                    request.ModelSourceDirectory,
                    request.TokenizerSourceLockPath,
                    acquisition.TokenizerSourceLockSha256,
                    request.TokenizerSourceDirectory,
                    acquisition.CompositionProfileSha256,
                    request.OutputRoot),
                cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
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

        if (conversion.ModelSourceLockSha256 != acquisition.ModelSourceLockSha256 ||
            conversion.TokenizerSourceLockSha256 != acquisition.TokenizerSourceLockSha256)
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
            artifacts = ToCompanionArtifacts(conversion.Artifacts);
            CompanionContract.ValidateArtifactSet(artifacts);
            totalBytes = conversion.Artifacts.InCanonicalOrder()
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

        _journal.Advance(
            operationId,
            CompanionOperationState.VerifyingComposition,
            CompanionAcquisitionBranch.Source,
            totalBytes,
            totalBytes);
        var available = _journal.Advance(
            operationId,
            CompanionOperationState.Available,
            CompanionAcquisitionBranch.Source,
            totalBytes,
            totalBytes,
            artifacts);
        return new CompanionSourceConversionResult(available, conversion);
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
