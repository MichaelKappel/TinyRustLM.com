namespace TinyRustLM;

/// <summary>Exception raised by the public TinyRustLM SDK.</summary>
public sealed class TinyRustLmException : Exception
{
    /// <summary>Creates an SDK exception.</summary>
    public TinyRustLmException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    /// <summary>Stable native or managed error code.</summary>
    public string Code { get; }
}
