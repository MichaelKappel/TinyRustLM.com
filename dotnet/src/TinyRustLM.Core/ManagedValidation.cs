namespace TinyRustLM;

internal static class ManagedValidation
{
    internal static void RequireText(string value, string argumentName, int maximumCharacters = 4096)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        if (value.Length > maximumCharacters || value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException("The value is empty, too large, or contains an embedded NUL.", argumentName);
        }
    }

    internal static void RequireContentId(string value, string argumentName)
    {
        RequireText(value, argumentName, 71);
        if (!IsContentId(value))
        {
            throw new ArgumentException("The value must be an exact sha256 content ID.", argumentName);
        }
    }

    internal static void RequireDigest(string value, string argumentName)
    {
        RequireText(value, argumentName, 64);
        if (!IsDigest(value))
        {
            throw new ArgumentException("The value must be an exact lowercase SHA-256 digest.", argumentName);
        }
    }

    internal static bool IsContentId(string? value) =>
        value is { Length: 71 } &&
        value.StartsWith("sha256:", StringComparison.Ordinal) &&
        IsLowerHex(value.AsSpan(7));

    internal static bool IsDigest(string? value) =>
        value is { Length: 64 } && IsLowerHex(value);

    internal static bool IsOperationId(string? value) =>
        IsDigest(value) && value!.Any(character => character != '0');

    internal static bool IsFailureCode(string value) =>
        value.Length is > 0 and <= 128 && value.All(character =>
            character is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-');

    internal static void RequireBytes(ReadOnlyMemory<byte> value, string argumentName, ulong maximumBytes)
    {
        if (value.IsEmpty || (ulong)value.Length > maximumBytes)
        {
            throw new ArgumentException("The byte input must be nonempty and within the advertised limit.", argumentName);
        }
    }

    private static bool IsLowerHex(ReadOnlySpan<char> value)
    {
        foreach (var character in value)
        {
            if (character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f'))
            {
                return false;
            }
        }

        return true;
    }
}
