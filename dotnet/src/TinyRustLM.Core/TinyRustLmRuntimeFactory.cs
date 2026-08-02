namespace TinyRustLM;

/// <summary>Factory for native-backed TinyRustLM public runtime handles.</summary>
public sealed class TinyRustLmRuntimeFactory : ITinyRustLmRuntimeFactory
{
    /// <inheritdoc />
    public ITinyRustLmRuntime CreateRuntime()
    {
        var handle = NativeJson.Call<RuntimeHandle>(() => NativeMethods.tinyrustlm_runtime_create_json());
        return new TinyRustLmRuntime(handle.Handle);
    }

    /// <inheritdoc />
    public TinyRustLmSdkVersion GetVersion()
    {
        return NativeJson.Call<TinyRustLmSdkVersion>(() =>
            NativeMethods.tinyrustlm_sdk_version_json());
    }

    /// <inheritdoc />
    public TinyRustLmCapabilities GetCapabilities()
    {
        return NativeJson.Call<TinyRustLmCapabilities>(() =>
            NativeMethods.tinyrustlm_sdk_capabilities_json());
    }

    private sealed record RuntimeHandle(ulong Handle);
}
