using System.Reflection;

namespace TinyRustLM.SeedHost;

internal static class TinyRustLMConversionExecutableLocator
{
    private const string EnvironmentVariableName = "TINYRUSTLM_CONVERTER_PATH";

    internal static string Resolve(string? configuredPath)
    {
        var resolved = TryResolve(configuredPath);
        return resolved ?? throw new SeedHostException(
            "conversion_executable_not_found",
            $"TinyRustLM conversion executable for RID {MiniModelNativeMethods.RuntimeIdentifier()} was not found in package-native locations.");
    }

    internal static string? TryResolve(string? configuredPath)
    {
        var fileName = OperatingSystem.IsWindows()
            ? "tinyrustlm-slm-pack.exe"
            : "tinyrustlm-slm-pack";
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return RequireReviewedFile(
                configuredPath,
                fileName,
                "configured_conversion_executable_not_found");
        }

        var environmentPath = Environment.GetEnvironmentVariable(EnvironmentVariableName);
        if (!string.IsNullOrWhiteSpace(environmentPath))
        {
            return RequireReviewedFile(
                environmentPath,
                fileName,
                "environment_conversion_executable_not_found");
        }

        foreach (var candidate in Candidates(fileName).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (IsReviewedFile(candidate))
            {
                return Path.GetFullPath(candidate);
            }
        }
        return null;
    }

    private static string RequireReviewedFile(string value, string fileName, string errorCode)
    {
        if (value.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "invalid_conversion_executable_path",
                "TinyRustLM conversion executable path cannot contain an embedded NUL character.");
        }
        var candidate = Directory.Exists(value) ? Path.Combine(value, fileName) : value;
        if (!IsReviewedFile(candidate))
        {
            throw new SeedHostException(
                errorCode,
                "Configured TinyRustLM conversion executable is missing, not a regular file, or is a link/reparse point.");
        }
        return Path.GetFullPath(candidate);
    }

    private static bool IsReviewedFile(string path)
    {
        try
        {
            var information = new FileInfo(path);
            return information.Exists
                && (information.Attributes & FileAttributes.ReparsePoint) == 0
                && information.LinkTarget is null;
        }
        catch (Exception error) when (
            error is ArgumentException or IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private static IEnumerable<string> Candidates(string fileName)
    {
        var rid = MiniModelNativeMethods.RuntimeIdentifier();
        var assemblyDirectory = Path.GetDirectoryName(
            typeof(TinyRustLMConversionExecutableLocator).Assembly.Location);
        foreach (var baseDirectory in new[] { AppContext.BaseDirectory, assemblyDirectory })
        {
            if (string.IsNullOrWhiteSpace(baseDirectory))
            {
                continue;
            }
            yield return Path.Combine(baseDirectory, fileName);
            yield return Path.Combine(baseDirectory, "runtimes", rid, "native", fileName);
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var depth = 0; depth < 12 && current is not null; depth++, current = current.Parent)
        {
            yield return Path.Combine(
                current.FullName,
                "artifacts",
                "seed-host-native",
                rid,
                fileName);
            yield return Path.Combine(current.FullName, "target", "release", fileName);
            yield return Path.Combine(current.FullName, "target", "debug", fileName);
        }
    }
}
