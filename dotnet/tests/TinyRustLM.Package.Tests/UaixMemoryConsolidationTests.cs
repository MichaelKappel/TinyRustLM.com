using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed partial class UaixMemoryConsolidationTests
{
    private const string CanonicalMemoryRoute =
        "wiki/runtime-mirust/reports/tinyrustlm-working-product-memory-2026-09-19.md";

    private const string DecisionIndexRoute =
        "wiki/runtime-mirust/reports/tinyrustlm-report-intake-decision-index-2026-09-19.md";

    private const string SourceAuthorityRelocationRecord =
        ".uai/source-authority-relocation-2026-08-30.uai";

    private static readonly string[] CurrentUaixMemoryPaths =
    {
        ".uai/architecture.uai",
        ".uai/coding-standards.uai",
        ".uai/credential-inventory.uai",
        ".uai/file-handoff.uai",
        ".uai/index.uai",
        ".uai/intake-outcome-ledger.uai",
        ".uai/long-term-memory.uai",
        ".uai/memory-endpoints-coordination.uai",
        ".uai/next-recursive-prompt.uai",
        ".uai/operations.uai",
        ".uai/receiver-brief.uai",
        ".uai/report-synthesis.uai",
        ".uai/short-term-memory.uai",
        SourceAuthorityRelocationRecord,
        ".uai/startup-packet.uai",
        ".uai/storage-consolidation-2026-09-12.uai",
        ".uai/system-profile.uai",
        ".uai/taboo.uai",
        ".uai/talisman.uai",
        ".uai/test-plan.uai",
        ".uai/totem.uai",
        ".uai/workspace-guidance.uai",
        "tinyrustlm/authority/ecosystem-workspace.uai",
        "workspace.uai"
    };

    private static readonly string[] CurrentBatchManifests =
    {
        "docs/report-intake/2026-09-19/working-product-research/MANIFEST.md"
    };

    [Fact]
    public void CurrentUaixMemoryIsBoundedAndDeepRoutesToReviewedKnowledge()
    {
        var root = RepositoryRoot();
        // Inspect the declared memory boundary without traversing generated model environments.
        var paths = Directory
            .EnumerateFiles(Path.Combine(root, ".uai"), "*.uai", SearchOption.AllDirectories)
            .Concat(new[]
            {
                Path.Combine(root, "workspace.uai"),
                Path.Combine(root, "tinyrustlm", "authority", "ecosystem-workspace.uai")
            })
            .Select(path => Normalize(Path.GetRelativePath(root, path)))
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(CurrentUaixMemoryPaths, paths);

        long totalBytes = 0;
        foreach (var relative in paths)
        {
            var path = Path.Combine(
                root,
                relative.Replace('/', Path.DirectorySeparatorChar));
            var bytes = new FileInfo(path).Length;
            totalBytes += bytes;

            var ceiling = relative == ".uai/intake-outcome-ledger.uai" ? 400_000 : 48_000;
            Assert.True(bytes <= ceiling, $"{relative} is {bytes} bytes; ceiling is {ceiling}.");

            var text = File.ReadAllText(path);
            Assert.DoesNotMatch(StaleMemoryEndpointsPolicy(), text);
            if (relative == SourceAuthorityRelocationRecord)
            {
                Assert.Contains(
                    "profile: tinyrustlm.source_authority_relocation.v1",
                    text,
                    StringComparison.Ordinal);
                Assert.Contains(
                    "authority: sole current source, build, test, release, and deployment checkout",
                    text,
                    StringComparison.Ordinal);
                Assert.Contains(
                    "physical_active_tinyrustlm_source_duplicates_remaining: 0",
                    text,
                    StringComparison.Ordinal);
                continue;
            }

            if (relative == ".uai/storage-consolidation-2026-09-12.uai")
            {
                Assert.Contains("profile: tinyrustlm.storage-consolidation.2026-09-12", text, StringComparison.Ordinal);
                continue;
            }

            Assert.Contains(CanonicalMemoryRoute, text, StringComparison.Ordinal);
            Assert.Contains(DecisionIndexRoute, text, StringComparison.Ordinal);
        }

        Assert.True(totalBytes <= 600_000, $"Current UAI memory is {totalBytes} bytes; ceiling is 600000.");

        var workspace = File.ReadAllText(Path.Combine(root, "workspace.uai"));
        Assert.Contains(
            $"source_authority_receipt: {SourceAuthorityRelocationRecord}",
            workspace,
            StringComparison.Ordinal);
        Assert.Contains(
            $"  - {SourceAuthorityRelocationRecord}",
            workspace,
            StringComparison.Ordinal);
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

        Assert.Equal(16, reportCount);
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
        Assert.Contains("early alpha and has never had a working release", text, StringComparison.Ordinal);
        Assert.Contains("officially accepted by the project owner", text, StringComparison.Ordinal);
        Assert.Contains("browser client is loaded", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("no material v3 registration", text, StringComparison.Ordinal);
        Assert.Contains("MemoryEndpoints.com is authorized and strongly recommended", text, StringComparison.Ordinal);
        Assert.Contains("0/20", text, StringComparison.Ordinal);
        Assert.DoesNotContain("current uncommitted clean-cut work", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("a129fa3b50df4278234d863b138e3a8e9c65c9c3", text, StringComparison.Ordinal);
    }

    // Every durable pointer carries routing context and verifies the actual target bytes.
    [Fact]
    public void LongTermPointersHaveContextUniqueIdentityAndCurrentChecksums()
    {
        var root = RepositoryRoot();
        var ledger = File.ReadAllText(Path.Combine(root, ".uai", "long-term-memory.uai"));
        var records = Regex.Split(ledger, @"(?m)^  - id: ").Skip(1).ToArray();
        Assert.Equal(17, records.Length);
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var paths = new HashSet<string>(StringComparer.Ordinal);
        foreach (var record in records)
        {
            var lines = record.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            Assert.True(ids.Add(lines[0].Trim()), lines[0]);
            var fields = lines.Skip(1).Select(line => line.Trim().Split(": ", 2))
                .ToDictionary(parts => parts[0], parts => parts[1], StringComparer.Ordinal);
            foreach (var key in new[]
            {
                "path", "label", "summary", "authority", "review_state",
                "status", "last_reviewed_utc", "sha256"
            })
            {
                Assert.True(fields.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value), key);
            }
            var route = fields["path"];
            Assert.True(paths.Add(route), route);
            Assert.False(Path.IsPathRooted(route), route);
            Assert.DoesNotContain("..", route.Split('/'));
            var target = Path.GetFullPath(Path.Combine(root, route));
            Assert.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, target);
            Assert.True(File.Exists(target), route);
            Assert.Matches(Sha256Regex(), fields["sha256"]);
            var observed = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(target))).ToLowerInvariant();
            Assert.Equal(fields["sha256"], observed);
            Assert.True(DateTimeOffset.TryParse(fields["last_reviewed_utc"], out _));
        }
    }

    // Historical receipts keep their original results even as active guidance changes.
    [Theory]
    [InlineData(".uai/source-authority-relocation-2026-08-30.uai", "bc9382124d4adc0a266cf7069c9a273410e9d08290f7b5b6ec46852418c6a1a5")]
    [InlineData(".uai/storage-consolidation-2026-09-12.uai", "53f8bcba94ca59a9c2b5c8b695c899deca7d5311eb707c8ff95769252ef428dd")]
    public void DatedUaiReceiptsRemainByteExact(string route, string expectedSha256)
    {
        var bytes = File.ReadAllBytes(Path.Combine(RepositoryRoot(), route));
        Assert.Equal(expectedSha256, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
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
