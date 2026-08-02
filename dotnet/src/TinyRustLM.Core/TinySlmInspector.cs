namespace TinyRustLM;

/// <summary>Native-backed .slm inspector for the public SDK.</summary>
public sealed class TinySlmInspector : ISlmInspector
{
    /// <inheritdoc />
    public SlmInspection Inspect(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        using var pathUtf8 = NativeJson.Utf8(path, nameof(path));
        return NativeJson.Call<SlmInspection>(() =>
            NativeMethods.tinyrustlm_slm_inspect_path_json(pathUtf8.Pointer));
    }
}
