namespace TinyRustLM.SeedHost;

/// <summary>Base exception for public seed-host operations.</summary>
public class SeedHostException : Exception
{
    /// <summary>Creates a seed-host exception with a stable error code.</summary>
    public SeedHostException(string code, string message)
        : base(message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        Code = code;
    }

    /// <summary>Creates an SDK exception while preserving a loader cause.</summary>
    public SeedHostException(string code, string message, Exception innerException)
        : base(message, innerException)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        Code = code;
    }

    /// <summary>Stable machine-readable error code.</summary>
    public string Code { get; }
}

/// <summary>Exception raised before native execution when a managed contract is invalid.</summary>
public sealed class SeedHostValidationException : SeedHostException
{
    /// <summary>Creates a managed contract validation exception.</summary>
    public SeedHostValidationException(string code, string message)
        : base(code, message)
    {
    }
}
