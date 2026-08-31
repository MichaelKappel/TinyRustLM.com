using TinyRustLM.Companion;

namespace TinyRustLM.Companion.Tests;

internal sealed record CompanionTestAcquisitionEvidence(
    CompanionPersistedExecutionIntent Execution,
    CompanionPersistedSourceAcquisitionIntent Acquisition);

internal static class CompanionOperationTestEvidence
{
    internal static CompanionTestAcquisitionEvidence EnterAcquiringSource(
        CompanionOperationJournal journal,
        CompanionOperationRecord operation,
        string privateRoot,
        string modelSourceRoot,
        string tokenizerSourceRoot,
        string conversionOutputRoot,
        string? installedConverterSha256 = null,
        string? installedWorkerSha256 = null)
    {
        var request = journal.ReadRequest(operation.OperationId);
        var sourceStagingRoot = FullPath(privateRoot, "source-staging");
        var materializedLockRoot = FullPath(privateRoot, "source-locks");
        var execution = journal.PersistExecutionIntent(new CompanionExecutionIntent(
            CompanionContract.ExecutionIntentSchema,
            operation.OperationId,
            operation.RequestSha256,
            request.AttemptId,
            installedWorkerSha256 ?? CompanionContractTests.Digest('7'),
            installedConverterSha256 ?? CompanionContractTests.Digest('8'),
            CompanionSourceDescriptor.DescriptorId,
            CompanionSourceDescriptor.CacheLogicalId,
            sourceStagingRoot,
            materializedLockRoot,
            Path.GetFullPath(conversionOutputRoot),
            CompanionSourceDescriptor.NetworkProfileId,
            CompanionSourceDescriptor.ResourcePolicyId));
        var acquisition = journal.PersistSourceAcquisitionIntent(
            new CompanionSourceAcquisitionIntent(
                CompanionContract.SourceAcquisitionIntentSchema,
                operation.OperationId,
                operation.RequestSha256,
                execution.Sha256,
                CompanionSourceDescriptor.DescriptorId,
                CompanionSourceDescriptor.Repository,
                CompanionSourceDescriptor.Revision,
                CompanionSourceDescriptor.ModelSourceLockSha256,
                CompanionSourceDescriptor.TokenizerSourceLockSha256,
                CompanionSourceDescriptor.PayloadBytes,
                CompanionSourceDescriptor.PayloadInventorySchema,
                CompanionSourceDescriptor.PayloadInventorySha256,
                FullPath(privateRoot, "source-cache"),
                Path.GetFullPath(modelSourceRoot),
                Path.GetFullPath(tokenizerSourceRoot),
                sourceStagingRoot,
                materializedLockRoot,
                CompanionSourceDescriptor.InitialOrigin,
                CompanionSourceDescriptor.MaximumRedirects,
                CompanionSourceDescriptor.BufferBytes));
        journal.Advance(
            operation.OperationId,
            CompanionOperationState.AcquiringSource,
            CompanionAcquisitionRoute.Source,
            phaseTotalBytes: CompanionSourceDescriptor.PayloadBytes,
            executionIntentSha256: execution.Sha256,
            sourceAcquisitionIntentSha256: acquisition.Sha256);
        return new CompanionTestAcquisitionEvidence(execution, acquisition);
    }

    internal static CompanionPersistedSourceAcquisitionReceipt PersistSourceReceipt(
        CompanionOperationJournal journal,
        CompanionOperationRecord operation,
        CompanionTestAcquisitionEvidence evidence,
        string modelSourceRoot,
        string tokenizerSourceRoot,
        string? payloadInventorySchema = null,
        string? payloadInventorySha256 = null) =>
        journal.PersistSourceAcquisitionReceipt(new CompanionSourceAcquisitionReceipt(
            CompanionContract.SourceAcquisitionReceiptSchema,
            operation.OperationId,
            operation.RequestSha256,
            evidence.Execution.Sha256,
            evidence.Acquisition.Sha256,
            CompanionSourceDescriptor.DescriptorId,
            CompanionSourceDescriptor.ModelSourceLockSha256,
            CompanionSourceDescriptor.TokenizerSourceLockSha256,
            payloadInventorySchema ?? CompanionSourceDescriptor.PayloadInventorySchema,
            payloadInventorySha256 ?? CompanionSourceDescriptor.PayloadInventorySha256,
            CompanionSourceDescriptor.FileCount,
            CompanionSourceDescriptor.PayloadBytes,
            Path.GetFullPath(modelSourceRoot),
            Path.GetFullPath(tokenizerSourceRoot)));

    private static string FullPath(string parent, string child) =>
        Path.GetFullPath(Path.Combine(parent, child));
}
