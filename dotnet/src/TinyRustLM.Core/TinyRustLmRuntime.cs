namespace TinyRustLM;

/// <summary>One serialized managed owner for a native composition runtime.</summary>
public sealed class TinyRustLmRuntime : ITinyRustLmRuntime
{
    private readonly object _sync = new();
    private readonly TinyRustLmNativeContract _contract;
    private readonly NativeRuntimeHandle _handle;
    private bool _disposed;

    internal TinyRustLmRuntime(NativeRuntimeHandle handle, TinyRustLmNativeContract contract)
    {
        _handle = handle;
        _contract = contract;
    }

    /// <inheritdoc />
    public TinyRustLmRuntimeState GetState() => Locked(() =>
        NativeReportValidation.RuntimeState(NativeJson.Call<TinyRustLmRuntimeState>(() =>
            NativeMethods.tinyrustlm_runtime_state_json(_handle.Value))));

    /// <inheritdoc />
    public TinyRustLmRuntimeState ActivateComposition(
        TinyRustLmActivationRequest request,
        TinyRustLmOperationId expectedOperation)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(expectedOperation);
        ValidateActivation(request);
        var requestBytes = NativeJson.Serialize(
            new NativeActivationRequest(
                NativeContractAuthority.RuntimeActivationSchema,
                request.GraphPath,
                request.Members),
            _contract.Limits.MaximumRuntimeJsonBytes,
            nameof(request));
        var operation = expectedOperation.ToArray();
        return Locked(() => NativeReportValidation.RuntimeState(
            NativeJson.Call<TinyRustLmRuntimeState>(() =>
                NativeMethods.tinyrustlm_runtime_activate_json(
                    _handle.Value,
                    requestBytes,
                    (nuint)requestBytes.Length,
                    operation,
                    (nuint)operation.Length))));
    }

    /// <inheritdoc />
    public TinyRustLmRuntimeState AdvanceOperation(
        TinyRustLmOperationId expectedCurrent,
        TinyRustLmOperationId next)
    {
        ArgumentNullException.ThrowIfNull(expectedCurrent);
        ArgumentNullException.ThrowIfNull(next);
        var expectedBytes = expectedCurrent.ToArray();
        var nextBytes = next.ToArray();
        return Locked(() => NativeReportValidation.RuntimeState(
            NativeJson.Call<TinyRustLmRuntimeState>(() =>
                NativeMethods.tinyrustlm_runtime_advance_operation_json(
                    _handle.Value,
                    expectedBytes,
                    (nuint)expectedBytes.Length,
                    nextBytes,
                    (nuint)nextBytes.Length))));
    }

    /// <inheritdoc />
    public TinyRustLmRuntimeState SetTranscriptRevision(ulong transcriptRevision) => Locked(() =>
        NativeReportValidation.RuntimeState(NativeJson.Call<TinyRustLmRuntimeState>(() =>
            NativeMethods.tinyrustlm_runtime_set_transcript_json(
                _handle.Value,
                transcriptRevision))));

    /// <inheritdoc />
    public TinyRustLmRuntimeState BeginRequest(
        ReadOnlyMemory<byte> prompt2Request,
        TinyRustLmOperationId expectedOperation)
    {
        ArgumentNullException.ThrowIfNull(expectedOperation);
        ManagedValidation.RequireBytes(
            prompt2Request,
            nameof(prompt2Request),
            _contract.Limits.MaximumPrompt2RequestBytes);
        var requestBytes = prompt2Request.ToArray();
        var operation = expectedOperation.ToArray();
        return Locked(() => NativeReportValidation.RuntimeState(
            NativeJson.Call<TinyRustLmRuntimeState>(() =>
                NativeMethods.tinyrustlm_runtime_begin_request_json(
                    _handle.Value,
                    requestBytes,
                    (nuint)requestBytes.Length,
                    operation,
                    (nuint)operation.Length))));
    }

    /// <inheritdoc />
    public TinyRustLmRuntimeStep Step(bool cancelled = false) => Locked(() =>
        NativeReportValidation.RuntimeStep(NativeJson.Call<TinyRustLmRuntimeStep>(() =>
            NativeMethods.tinyrustlm_runtime_step_json(_handle.Value, cancelled ? (byte)1 : (byte)0))));

    /// <inheritdoc />
    public TinyRustLmRuntimeOutput Finish() => Locked(() =>
        NativeReportValidation.RuntimeOutput(NativeJson.Call<TinyRustLmRuntimeOutput>(() =>
            NativeMethods.tinyrustlm_runtime_finish_json(_handle.Value))));

    /// <inheritdoc />
    public void Dispose()
    {
        lock (_sync)
        {
            if (_disposed)
            {
                return;
            }

            try
            {
                _handle.DestroyChecked();
            }
            finally
            {
                _handle.Dispose();
                _disposed = true;
            }
        }
    }

    private T Locked<T>(Func<T> operation)
    {
        lock (_sync)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            return operation();
        }
    }

    private static void ValidateActivation(TinyRustLmActivationRequest request)
    {
        ManagedValidation.RequireText(request.GraphPath, nameof(request.GraphPath));
        ArgumentNullException.ThrowIfNull(request.Members);
        ManagedValidation.RequireText(request.Members.Model, nameof(request.Members.Model));
        ManagedValidation.RequireText(request.Members.Tokenizer, nameof(request.Members.Tokenizer));
        ManagedValidation.RequireText(request.Members.Template, nameof(request.Members.Template));
        ManagedValidation.RequireText(request.Members.Sampling, nameof(request.Members.Sampling));
        ManagedValidation.RequireText(request.Members.Prompt, nameof(request.Members.Prompt));
    }
}

internal sealed record NativeActivationRequest(
    string Schema,
    string GraphPath,
    TinyRustLmMemberPaths Members);
