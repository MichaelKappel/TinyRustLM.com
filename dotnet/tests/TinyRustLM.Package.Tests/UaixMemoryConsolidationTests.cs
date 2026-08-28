using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed partial class UaixMemoryConsolidationTests
{
    private const string CanonicalMemoryRoute =
        "wiki/runtime-mirust/reports/tinyrustlm-enterprise-intake-and-production-runtime-clean-cut-memory-2026-08-28.md";

    private const string DecisionIndexRoute =
        "wiki/runtime-mirust/reports/tinyrustlm-report-intake-decision-index-2026-08-28.md";

    private static readonly string[] CurrentBatchManifests =
    {
        "docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md",
        "docs/report-intake/2026-08-27/omi-computational-architectures-research/MANIFEST.md",
        "docs/report-intake/2026-08-27/ontological-machine-intelligence-research/MANIFEST.md"
    };

    [Fact]
    public void CurrentUaixMemoryIsBoundedAndDeepRoutesToReviewedKnowledge()
    {
        var root = RepositoryRoot();
        var paths = Directory
            .EnumerateFiles(root, "*.uai", SearchOption.AllDirectories)
            .Where(path => !IsGeneratedOrExternal(root, path))
            .Append(Path.Combine(root, "workspace.uai"))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(21, paths.Length);

        long totalBytes = 0;
        foreach (var path in paths)
        {
            var relative = Normalize(Path.GetRelativePath(root, path));
            var bytes = new FileInfo(path).Length;
            totalBytes += bytes;

            var ceiling = relative == ".uai/intake-outcome-ledger.uai" ? 400_000 : 48_000;
            Assert.True(bytes <= ceiling, $"{relative} is {bytes} bytes; ceiling is {ceiling}.");

            var text = File.ReadAllText(path);
            Assert.Contains(CanonicalMemoryRoute, text, StringComparison.Ordinal);
            Assert.Contains(DecisionIndexRoute, text, StringComparison.Ordinal);
            Assert.DoesNotMatch(StaleMemoryEndpointsPolicy(), text);
        }

        Assert.True(totalBytes <= 600_000, $"Current UAI memory is {totalBytes} bytes; ceiling is 600000.");
    }

    [Fact]
    public void DecisionIndexCoversEveryCurrentReportExactlyOnce()
    {
        var root = RepositoryRoot();
        var indexPath = Path.Combine(root, DecisionIndexRoute.Replace('/', Path.DirectorySeparatorChar));
        Assert.True(File.Exists(indexPath), indexPath);
        var index = File.ReadAllText(indexPath);

        var reportCount = 0;
        foreach (var manifestRoute in CurrentBatchManifests)
        {
            var manifestPath = Path.Combine(root, manifestRoute.Replace('/', Path.DirectorySeparatorChar));
            var manifestDirectory = Normalize(Path.GetRelativePath(root, Path.GetDirectoryName(manifestPath)!));
            foreach (var fileName in ParseReportNames(manifestPath))
            {
                var reportRoute = $"{manifestDirectory}/{fileName}";
                Assert.Single(
                    Regex.Matches(index, Regex.Escape(reportRoute), RegexOptions.CultureInvariant)
                        .Cast<Match>());
                reportCount++;
            }
        }

        Assert.Equal(47, reportCount);
        foreach (var required in new[]
        {
            "Adopted production invariants",
            "Research-only backlog",
            "Rejected directions",
            "Corrections that override report prose",
            "Facts requiring local or authorized verification",
            "MemoryEndpoints.com is authorized and strongly recommended",
            "Reports are advisory inputs, not execution evidence"
        })
        {
            Assert.Contains(required, index, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void CanonicalResumeNodeReflectsCurrentCompanionAndPolicyTruth()
    {
        var root = RepositoryRoot();
        var path = Path.Combine(root, CanonicalMemoryRoute.Replace('/', Path.DirectorySeparatorChar));
        var text = File.ReadAllText(path);

        Assert.Contains(DecisionIndexRoute, text, StringComparison.Ordinal);
        Assert.Contains("operation-not-available", text, StringComparison.Ordinal);
        Assert.Contains("browser client is not loaded", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("MemoryEndpoints.com is authorized and strongly recommended", text, StringComparison.Ordinal);
        Assert.Contains("0/20", text, StringComparison.Ordinal);
        Assert.DoesNotContain("current uncommitted clean-cut work", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("a129fa3b50df4278234d863b138e3a8e9c65c9c3", text, StringComparison.Ordinal);
    }

    private static IReadOnlyList<string> ParseReportNames(string manifestPath)
    {
        var reports = new List<string>();
        foreach (var line in File.ReadLines(manifestPath))
        {
            if (!line.StartsWith('|'))
            {
                continue;
            }

            var cells = line.Trim().Trim('|').Split('|', StringSplitOptions.TrimEntries);
            if (cells.Length < 3
                || !cells.Any(cell => Sha256Regex().IsMatch(cell.Trim('`', ' '))))
            {
                continue;
            }

            var fileName = cells[0].Trim().Trim('`');
            if (fileName.StartsWith('['))
            {
                var end = fileName.IndexOf(']');
                Assert.True(end > 1, line);
                fileName = fileName[1..end];
            }

            reports.Add(fileName);
        }

        Assert.NotEmpty(reports);
        return reports;
    }

    private static bool IsGeneratedOrExternal(string root, string path)
    {
        var relative = Normalize(Path.GetRelativePath(root, path));
        return relative.StartsWith("target/", StringComparison.OrdinalIgnoreCase)
            || relative.Contains("/bin/", StringComparison.OrdinalIgnoreCase)
            || relative.Contains("/obj/", StringComparison.OrdinalIgnoreCase)
            || relative.Contains("/node_modules/", StringComparison.OrdinalIgnoreCase);
    }

    private static string Normalize(string path) => path.Replace('\\', '/');

    private static string RepositoryRoot()
    {
        var configured = Environment.GetEnvironmentVariable("TINYRUSTLM_REPO_ROOT");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(configured);
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

    [GeneratedRegex("^[0-9a-fA-F]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256Regex();

    [GeneratedRegex(
        @"(?i)MemoryEndpoints\s+(?:is|remains)\s+unauthori[sz]ed|MemoryEndpoints\s+unauthori[sz]ed|unauthori[sz]ed(?:\s+and)?\s+disconnected\s+MemoryEndpoints")]
    private static partial Regex StaleMemoryEndpointsPolicy();
}
