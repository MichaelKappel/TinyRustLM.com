using System.Runtime.InteropServices;
using System.Text.Json;

namespace TinyRustLM;

internal static class NativeJson
{
    internal static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = true
    };

    internal static T Call<T>(Func<IntPtr> nativeCall)
    {
        var json = CallRaw(nativeCall);
        var envelope = JsonSerializer.Deserialize<NativeEnvelope<T>>(json, SerializerOptions)
            ?? throw new TinyRustLmException("invalid_native_response", "Native response was empty.");
        if (!envelope.Ok)
        {
            var error = envelope.Error ?? new NativeError("native_error", "Native operation failed.");
            throw new TinyRustLmException(error.Code, error.Message);
        }
        return envelope.Value ?? throw new TinyRustLmException(
            "invalid_native_response",
            "Native response did not include a value.");
    }

    internal static string CallRaw(Func<IntPtr> nativeCall)
    {
        var ptr = nativeCall();
        if (ptr == IntPtr.Zero)
        {
            throw new TinyRustLmException("null_native_response", "Native call returned a null response pointer.");
        }
        try
        {
            return Marshal.PtrToStringUTF8(ptr)
                ?? throw new TinyRustLmException("invalid_native_response", "Native response was not UTF-8.");
        }
        finally
        {
            NativeMethods.tinyrustlm_string_free(ptr);
        }
    }

    internal static Utf8NativeString Utf8(string? value, string? argumentName = null) =>
        new(value, argumentName);

    internal static void ThrowIfContainsEmbeddedNul(string? value, string argumentName)
    {
        if (value?.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException(
                "String arguments passed to TinyRustLM native code cannot contain embedded NUL characters.",
                argumentName);
        }
    }

    private sealed record NativeEnvelope<T>(bool Ok, T? Value, NativeError? Error);

    private sealed record NativeError(string Code, string Message);
}

internal sealed class Utf8NativeString : IDisposable
{
    internal Utf8NativeString(string? value, string? argumentName)
    {
        NativeJson.ThrowIfContainsEmbeddedNul(value, argumentName ?? "value");
        Pointer = value is null
            ? IntPtr.Zero
            : Marshal.StringToCoTaskMemUTF8(value);
    }

    internal IntPtr Pointer { get; }

    public void Dispose()
    {
        if (Pointer != IntPtr.Zero)
        {
            Marshal.FreeCoTaskMem(Pointer);
        }
    }
}
