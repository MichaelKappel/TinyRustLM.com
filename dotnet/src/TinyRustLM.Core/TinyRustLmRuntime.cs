namespace TinyRustLM;

/// <summary>Native-backed public TinyRustLM runtime harness.</summary>
public sealed class TinyRustLmRuntime : ITinyRustLmRuntime
{
    private const int MaxSamplingCandidates = 1024;

    private readonly NativeRuntimeHandle _handle;

    internal TinyRustLmRuntime(ulong handle)
    {
        _handle = new NativeRuntimeHandle(handle);
    }

    /// <inheritdoc />
    public TinyRustLmLoadReport LoadModel(string path, string? expectedSha256 = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        using var pathUtf8 = NativeJson.Utf8(path, nameof(path));
        using var shaUtf8 = NativeJson.Utf8(expectedSha256, nameof(expectedSha256));
        return NativeJson.Call<TinyRustLmLoadReport>(() =>
            NativeMethods.tinyrustlm_runtime_load_model_path_json(
                _handle.Value,
                pathUtf8.Pointer,
                shaUtf8.Pointer));
    }

    /// <inheritdoc />
    public void UnloadModel()
    {
        _ = NativeJson.Call<StatusReport>(() =>
            NativeMethods.tinyrustlm_runtime_unload_model_json(_handle.Value));
    }

    /// <inheritdoc />
    public TinyRustLmGenerationResult Generate(string prompt, TinyRustLmGenerationOptions? options = null)
    {
        ArgumentNullException.ThrowIfNull(prompt);
        var generationOptions = options ?? new TinyRustLmGenerationOptions();
        ValidateGenerationOptions(generationOptions);
        using var promptUtf8 = NativeJson.Utf8(prompt, nameof(prompt));
        return NativeJson.Call<TinyRustLmGenerationResult>(() =>
            NativeMethods.tinyrustlm_runtime_generate_json(
                _handle.Value,
                promptUtf8.Pointer,
                (uint)generationOptions.MaxNewTokens,
                generationOptions.Temperature,
                (uint)generationOptions.TopK,
                generationOptions.TopP,
                generationOptions.Seed));
    }

    /// <inheritdoc />
    public TinyRustLmGenerationResult Step()
    {
        return NativeJson.Call<TinyRustLmGenerationResult>(() =>
            NativeMethods.tinyrustlm_runtime_step_json(_handle.Value));
    }

    /// <inheritdoc />
    public void Reset()
    {
        _ = NativeJson.Call<StatusReport>(() =>
            NativeMethods.tinyrustlm_runtime_reset_json(_handle.Value));
    }

    /// <inheritdoc />
    public string GetDiagnostics()
    {
        var report = NativeJson.Call<DiagnosticsReport>(() =>
            NativeMethods.tinyrustlm_runtime_diagnostics_json(_handle.Value));
        return report.Diagnostics;
    }

    /// <inheritdoc />
    public void Dispose()
    {
        _handle.Dispose();
    }

    private sealed record StatusReport(string Status);

    private sealed record DiagnosticsReport(string Diagnostics);

    private static void ValidateGenerationOptions(TinyRustLmGenerationOptions options)
    {
        if (options.MaxNewTokens <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options.MaxNewTokens),
                options.MaxNewTokens,
                "MaxNewTokens must be greater than zero.");
        }
        if (!float.IsFinite(options.Temperature) || options.Temperature < 0.0f)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options.Temperature),
                options.Temperature,
                "Temperature must be finite and greater than or equal to zero.");
        }
        if (options.TopK <= 0 || options.TopK > MaxSamplingCandidates)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options.TopK),
                options.TopK,
                $"TopK must be between 1 and {MaxSamplingCandidates}.");
        }
        if (!float.IsFinite(options.TopP) || options.TopP <= 0.0f || options.TopP > 1.0f)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options.TopP),
                options.TopP,
                "TopP must be finite, greater than zero, and less than or equal to one.");
        }
    }
}
