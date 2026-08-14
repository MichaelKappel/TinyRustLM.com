namespace TinyRustLM.PackageCanonicalizer;

public sealed record CanonicalPackageResult(
    string Name,
    long ByteCount,
    string Sha256,
    int EntryCount,
    string EntryTimestampUtc);

public sealed class PackageCanonicalizationException : Exception
{
    public PackageCanonicalizationException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}

public static class NuGetPackageCanonicalizer
{
    public const string CanonicalEntryTimestampUtc = "1980-01-01T00:00:00Z";

    public static CanonicalPackageResult Canonicalize(string packagePath) =>
        throw new PackageCanonicalizationException(
            "package_canonicalizer_not_implemented",
            "NuGet package canonicalization is not implemented.");
}
