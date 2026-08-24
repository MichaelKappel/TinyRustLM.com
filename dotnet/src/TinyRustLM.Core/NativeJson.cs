using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM;

internal static class NativeJson
{
    internal const int MaximumResponseBytes = 33_554_432;

    internal static readonly JsonSerializerOptions SerializerOptions = new()
    {
        AllowTrailingCommas = false,
        PropertyNameCaseInsensitive = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = false
    };

    internal static T Call<T>(Func<IntPtr> nativeCall, int maximumResponseBytes = MaximumResponseBytes)
        where T : class
    {
        var bytes = CallRaw(nativeCall, maximumResponseBytes);
        NativeEnvelope<T> envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<NativeEnvelope<T>>(bytes, SerializerOptions)
                ?? throw new TinyRustLmException("native-response-empty");
        }
        catch (JsonException)
        {
            throw new TinyRustLmException("native-response-json");
        }

        if (envelope.Ok)
        {
            if (envelope.Value is null || envelope.Error is not null)
            {
                throw new TinyRustLmException("native-response-envelope");
            }

            return envelope.Value;
        }

        if (envelope.Value is not null || envelope.Error is null ||
            !ManagedValidation.IsFailureCode(envelope.Error.Code))
        {
            throw new TinyRustLmException("native-response-envelope");
        }

        throw new TinyRustLmException(envelope.Error.Code);
    }

    internal static byte[] Serialize<T>(T value, ulong maximumBytes, string argumentName)
    {
        ArgumentNullException.ThrowIfNull(value, argumentName);
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, SerializerOptions);
        if (bytes.Length == 0 || (ulong)bytes.Length > maximumBytes)
        {
            throw new ArgumentException("The serialized request exceeds the advertised native limit.", argumentName);
        }

        return bytes;
    }

    private static byte[] CallRaw(Func<IntPtr> nativeCall, int maximumResponseBytes)
    {
        ArgumentNullException.ThrowIfNull(nativeCall);
        if (maximumResponseBytes <= 0 || maximumResponseBytes > MaximumResponseBytes)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumResponseBytes));
        }

        var pointer = nativeCall();
        if (pointer == IntPtr.Zero)
        {
            throw new TinyRustLmException("native-response-pointer");
        }

        try
        {
            var length = 0;
            while (length <= maximumResponseBytes && Marshal.ReadByte(pointer, length) != 0)
            {
                length++;
            }

            if (length == 0 || length > maximumResponseBytes)
            {
                throw new TinyRustLmException("native-response-size");
            }

            var bytes = new byte[length];
            Marshal.Copy(pointer, bytes, 0, length);
            return bytes;
        }
        finally
        {
            NativeMethods.tinyrustlm_string_free(pointer);
        }
    }

    private sealed record NativeEnvelope<T>(bool Ok, T? Value, NativeError? Error)
        where T : class;

    private sealed record NativeError(string Code);
}
