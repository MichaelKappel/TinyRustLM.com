using System.Text.Json;
using TinyRustLM.PackageCanonicalizer;

if (args.Length < 2 || !string.Equals(args[0], "canonicalize", StringComparison.Ordinal))
{
    Console.Error.WriteLine("usage: tinyrustlm-package-canonicalizer canonicalize <absolute-package> [...]");
    return 2;
}

try
{
    var results = args.Skip(1).Select(NuGetPackageCanonicalizer.Canonicalize).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(results));
    return 0;
}
catch (PackageCanonicalizationException exception)
{
    Console.Error.WriteLine($"package_canonicalization_failed:{exception.Code}");
    return 1;
}
