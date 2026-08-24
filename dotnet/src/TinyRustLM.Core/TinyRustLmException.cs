namespace TinyRustLM;

/// <summary>Exception raised for a stable managed or native TinyRustLM failure code.</summary>
public sealed class TinyRustLmException : Exception
{
    /// <summary>Creates an SDK exception from one bounded public-safe code.</summary>
    public TinyRustLmException(string code)
        : base($"TinyRustLM operation failed with code '{ValidateCode(code)}'.")
    {
        Code = code;
    }

    /// <summary>Stable managed or native failure code.</summary>
    public string Code { get; }

    private static string ValidateCode(string code)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        if (!ManagedValidation.IsFailureCode(code))
        {
            throw new ArgumentException("A failure code must be bounded lowercase ASCII.", nameof(code));
        }

        return code;
    }
}
