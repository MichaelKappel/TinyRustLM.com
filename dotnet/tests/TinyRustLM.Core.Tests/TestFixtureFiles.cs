namespace TinyRustLM.Tests;

internal static class TestFixtureFiles
{
    private const string FixtureDirectory = "fixtures";

    internal static string ReadText(string fileName) => File.ReadAllText(Require(fileName));

    internal static string Require(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)
            || !string.Equals(fileName, Path.GetFileName(fileName), StringComparison.Ordinal))
        {
            throw new ArgumentException("Fixture name must be one plain file name.", nameof(fileName));
        }

        var path = Path.Combine(AppContext.BaseDirectory, FixtureDirectory, fileName);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Required test fixture is missing: {fileName}", path);
        }

        return path;
    }

    internal static string RequireConfigured(string configuredPath, string variableName)
    {
        if (!Path.IsPathFullyQualified(configuredPath))
        {
            throw new InvalidOperationException($"{variableName} must be an absolute file path.");
        }

        var fullPath = Path.GetFullPath(configuredPath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"{variableName} does not identify a file.", fullPath);
        }

        return fullPath;
    }
}
