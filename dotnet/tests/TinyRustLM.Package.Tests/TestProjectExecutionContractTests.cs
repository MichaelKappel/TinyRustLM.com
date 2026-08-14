using System.Xml.Linq;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class TestProjectExecutionContractTests
{
    [Fact]
    public void EveryDotNetTestProjectExplicitlyEnablesTestExecution()
    {
        var root = RepositoryRoot();
        var testRoot = Path.Combine(root, "dotnet", "tests");
        var projects = Directory
            .EnumerateFiles(testRoot, "*.csproj", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(projects);

        var violations = new List<string>();
        foreach (var projectPath in projects)
        {
            var relativePath = Path.GetRelativePath(root, projectPath).Replace('\\', '/');
            var document = XDocument.Load(projectPath, LoadOptions.PreserveWhitespace);
            var project = document.Root;
            if (project is null || project.Name.LocalName != "Project")
            {
                violations.Add($"{relativePath}: missing Project root");
                continue;
            }

            var testProjectValues = project
                .Descendants()
                .Where(element => element.Name.LocalName == "IsTestProject")
                .Select(element => element.Value.Trim())
                .ToArray();
            if (testProjectValues.Length != 1
                || !string.Equals(testProjectValues[0], "true", StringComparison.OrdinalIgnoreCase))
            {
                violations.Add(
                    $"{relativePath}: requires exactly one explicit <IsTestProject>true</IsTestProject>");
            }

            var testSdkReferences = project
                .Descendants()
                .Where(element => element.Name.LocalName == "PackageReference")
                .Where(element => string.Equals(
                    element.Attribute("Include")?.Value,
                    "Microsoft.NET.Test.Sdk",
                    StringComparison.Ordinal))
                .ToArray();
            if (testSdkReferences.Length != 1)
            {
                violations.Add(
                    $"{relativePath}: requires exactly one Microsoft.NET.Test.Sdk package reference");
            }
        }

        Assert.True(
            violations.Count == 0,
            $"Test-project execution contract violations:{Environment.NewLine}{string.Join(Environment.NewLine, violations)}");
    }

    private static string RepositoryRoot()
    {
        var configured = Environment.GetEnvironmentVariable("TINYRUSTLM_REPO_ROOT");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var fullPath = Path.GetFullPath(configured);
            if (File.Exists(Path.Combine(fullPath, "Cargo.toml"))
                && File.Exists(Path.Combine(fullPath, "dotnet", "TinyRustLM.sln")))
            {
                return fullPath;
            }

            throw new InvalidOperationException(
                "TINYRUSTLM_REPO_ROOT does not identify a TinyRustLM repository root.");
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Cargo.toml"))
                && File.Exists(Path.Combine(current.FullName, "dotnet", "TinyRustLM.sln")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new InvalidOperationException("Could not locate TinyRustLM repository root.");
    }
}
