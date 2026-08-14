using System.Text.Json;
using TinyRustLM.PackageCanonicalizer;

const int MaxPackageCount = 64;

if (args.Length < 2 ||
    args.Length > MaxPackageCount + 1 ||
    !string.Equals(args[0], "canonicalize", StringComparison.Ordinal))
{
    Console.Error.WriteLine("usage: tinyrustlm-package-canonicalizer canonicalize <absolute-package> [...]");
    return 2;
}

try
{
    var packagePaths = args.Skip(1).ToArray();
    if (packagePaths.Any(path =>
            string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path)))
    {
        Console.Error.WriteLine("package_canonicalization_failed:package_path_not_absolute");
        return 2;
    }

    packagePaths = packagePaths.Select(Path.GetFullPath).ToArray();
    if (packagePaths.Distinct(StringComparer.OrdinalIgnoreCase).Count() != packagePaths.Length)
    {
        Console.Error.WriteLine("package_canonicalization_failed:package_input_duplicate");
        return 2;
    }

    var results = packagePaths.Select(NuGetPackageCanonicalizer.Canonicalize).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(
        new
        {
            schema = "tinyrustlm.nuget.package_canonicalization.v1",
            packages = results
        },
        new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    return 0;
}
catch (PackageCanonicalizationException exception)
{
    Console.Error.WriteLine($"package_canonicalization_failed:{exception.Code}");
    return 1;
}
catch (ArgumentException)
{
    Console.Error.WriteLine("package_canonicalization_failed:package_path_invalid");
    return 2;
}
catch (NotSupportedException)
{
    Console.Error.WriteLine("package_canonicalization_failed:package_path_invalid");
    return 2;
}
catch (PathTooLongException)
{
    Console.Error.WriteLine("package_canonicalization_failed:package_path_invalid");
    return 2;
}
catch (Exception)
{
    Console.Error.WriteLine("package_canonicalization_failed:package_unexpected_failure");
    return 1;
}
