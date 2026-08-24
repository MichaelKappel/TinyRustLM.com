namespace TinyRustLM;

/// <summary>Creates bounded conversation runtimes over the exact current native contract.</summary>
public sealed class TinyRustLmRuntimeFactory : ITinyRustLmRuntimeFactory
{
    /// <inheritdoc />
    public TinyRustLmNativeContract GetNativeContract() => NativeContractAuthority.Get();

    /// <inheritdoc />
    public ITinyRustLmRuntime CreateRuntime(
        TinyRustLmRuntimePolicy policy,
        TinyRustLmOperationId initialOperation,
        ulong transcriptRevision = 0)
    {
        ArgumentNullException.ThrowIfNull(policy);
        ArgumentNullException.ThrowIfNull(initialOperation);
        var contract = NativeContractAuthority.Get();
        ValidatePolicy(policy, contract.Limits);
        var request = NativeJson.Serialize(
            new NativeRuntimeCreateRequest(
                NativeContractAuthority.RuntimeCreateSchema,
                policy.MaximumModelBytes,
                policy.MaximumSequenceTokens,
                policy.MaximumKvBytes,
                policy.MaximumScratchBytes,
                policy.MaximumResolvedMemberBytes,
                policy.MaximumResidentDependencyBytes,
                policy.MaximumRequestBytes),
            contract.Limits.MaximumRuntimeJsonBytes,
            nameof(policy));
        var operation = initialOperation.ToArray();
        var report = NativeJson.Call<NativeRuntimeHandleReport>(() =>
            NativeMethods.tinyrustlm_runtime_create_json(
                request,
                (nuint)request.Length,
                operation,
                (nuint)operation.Length,
                transcriptRevision));
        if (report.Handle == 0)
        {
            throw new TinyRustLmException("native-runtime-handle-report");
        }

        var handle = new NativeRuntimeHandle(report.Handle);
        try
        {
            NativeReportValidation.RequireSchema(report.Schema, "tinyrustlm.native.runtime_handle/1");
            var state = NativeReportValidation.RuntimeState(report.State);
            if (state.State != "empty" ||
                state.OperationId != initialOperation.ToString() ||
                state.TranscriptRevision != transcriptRevision)
            {
                throw new TinyRustLmException("native-runtime-create-report");
            }

            return new TinyRustLmRuntime(handle, contract);
        }
        catch
        {
            handle.Dispose();
            throw;
        }
    }

    private static void ValidatePolicy(TinyRustLmRuntimePolicy policy, TinyRustLmNativeLimits limits)
    {
        if (policy.MaximumModelBytes is 0 || policy.MaximumModelBytes > limits.MaximumModelBytes ||
            policy.MaximumSequenceTokens is 0 || policy.MaximumSequenceTokens > limits.MaximumSequenceTokens ||
            policy.MaximumKvBytes is 0 || policy.MaximumKvBytes > limits.MaximumKvBytes ||
            policy.MaximumScratchBytes is 0 || policy.MaximumScratchBytes > limits.MaximumScratchBytes ||
            policy.MaximumResolvedMemberBytes is 0 ||
            policy.MaximumResolvedMemberBytes > limits.MaximumResolvedMemberBytes ||
            policy.MaximumResidentDependencyBytes is 0 ||
            policy.MaximumResidentDependencyBytes > limits.MaximumResidentDependencyBytes ||
            policy.MaximumRequestBytes is 0 || policy.MaximumRequestBytes > limits.MaximumPrompt2RequestBytes)
        {
            throw new ArgumentOutOfRangeException(nameof(policy), "Every runtime ceiling must be positive and within the native contract.");
        }
    }
}

internal sealed record NativeRuntimeCreateRequest(
    string Schema,
    ulong MaximumModelBytes,
    uint MaximumSequenceTokens,
    ulong MaximumKvBytes,
    ulong MaximumScratchBytes,
    ulong MaximumResolvedMemberBytes,
    ulong MaximumResidentDependencyBytes,
    ulong MaximumRequestBytes);

internal sealed record NativeRuntimeHandleReport(
    string Schema,
    ulong Handle,
    TinyRustLmRuntimeState State);
