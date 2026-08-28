using System.Security.Cryptography;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class ReportIntakeMemoryTests
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
    public void ActiveIntakeBucketsContainOnlyPlaceholders()
    {
        var root = RepositoryRoot();

        foreach (var bucketName in new[] { "Content", "Improvement" })
        {
            var bucket = Path.Combine(root, "agent-file-handoff", bucketName);
            Assert.True(Directory.Exists(bucket), bucket);

            var activeEntries = Directory
                .EnumerateFileSystemEntries(bucket, "*", SearchOption.TopDirectoryOnly)
                .Where(path => !string.Equals(
                    Path.GetFileName(path),
                    ".gitkeep",
                    StringComparison.OrdinalIgnoreCase))
                .Select(path => Normalize(Path.GetRelativePath(root, path)))
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToArray();

            Assert.True(
                activeEntries.Length == 0,
                $"Active intake bucket {bucketName} is not complete: {string.Join(", ", activeEntries)}");
        }
    }

    [Fact]
    public void EveryHashedManifestRowMatchesTheDurableStoredBytes()
    {
        var root = RepositoryRoot();
        var reports = ReadAllManifestReports(root);

        Assert.True(reports.Count >= 80, $"Expected at least 80 checksum-bound rows, found {reports.Count}.");

        foreach (var report in reports)
        {
            var durablePath = ResolveDurablePath(root, report);
            AssertPathIsInsideRoot(root, durablePath);
            Assert.True(File.Exists(durablePath), Normalize(Path.GetRelativePath(root, durablePath)));

            var expectedHash = report.DurableSha256 ?? report.SourceSha256;
            var expectedBytes = report.DurableBytes ?? report.SourceBytes;
            Assert.Equal(expectedHash, Sha256Hex(durablePath));
            if (expectedBytes is long bytes)
            {
                Assert.Equal(bytes, new FileInfo(durablePath).Length);
            }
        }
    }

    [Fact]
    public void OutcomeLedgerRoutesEveryCurrentReviewedReportWithoutDuplicatingItIntoHotMemory()
    {
        var root = RepositoryRoot();
        var ledgerPath = Path.Combine(root, ".uai", "intake-outcome-ledger.uai");
        var ledger = File.ReadAllText(ledgerPath);

        Assert.Contains(CanonicalMemoryRoute, ledger, StringComparison.Ordinal);
        Assert.Contains(DecisionIndexRoute, ledger, StringComparison.Ordinal);

        var reports = CurrentBatchManifests
            .Select(route => Path.Combine(root, route.Replace('/', Path.DirectorySeparatorChar)))
            .SelectMany(ParseManifest)
            .ToArray();
        Assert.Equal(47, reports.Length);

        foreach (var report in reports)
        {
            var durableRoute = Normalize(Path.GetRelativePath(root, ResolveDurablePath(root, report)));
            Assert.Contains(durableRoute, ledger, StringComparison.Ordinal);
            Assert.Contains(report.SourceSha256, ledger, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static IReadOnlyList<ManifestReport> ReadAllManifestReports(string root)
    {
        var manifestRoot = Path.Combine(root, "docs", "report-intake");
        var manifests = Directory
            .EnumerateFiles(manifestRoot, "MANIFEST.md", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(manifests);
        return manifests.SelectMany(ParseManifest).ToArray();
    }

    private static IReadOnlyList<ManifestReport> ParseManifest(string manifestPath)
    {
        var lines = File.ReadAllLines(manifestPath);
        var headerIndex = -1;
        var headers = Array.Empty<string>();

        for (var index = 0; index < lines.Length; index++)
        {
            if (!lines[index].StartsWith('|'))
            {
                continue;
            }

            var candidate = SplitTableRow(lines[index]).Select(NormalizeHeader).ToArray();
            if (candidate.Contains("file", StringComparer.Ordinal)
                && candidate.Any(header => header is "sha256" or "sourcesha256"))
            {
                headerIndex = index;
                headers = candidate;
                break;
            }
        }

        if (headerIndex < 0)
        {
            return Array.Empty<ManifestReport>();
        }

        var fileIndex = Array.FindIndex(headers, header => header == "file");
        var sourceHashIndex = Array.FindIndex(headers, header => header == "sourcesha256");
        if (sourceHashIndex < 0)
        {
            sourceHashIndex = Array.FindIndex(headers, header => header == "sha256");
        }

        var sourceBytesIndex = Array.FindIndex(headers, header => header == "bytes");
        var durableHashIndex = Array.FindIndex(headers, header => header == "durablesha256");
        var durableBytesIndex = Array.FindIndex(headers, header => header == "durablebytes");
        var durablePathIndex = Array.FindIndex(headers, header => header is "durablepath" or "durabledocscopy");
        var reports = new List<ManifestReport>();

        for (var index = headerIndex + 1; index < lines.Length; index++)
        {
            var line = lines[index];
            if (!line.StartsWith('|'))
            {
                if (reports.Count > 0)
                {
                    break;
                }

                continue;
            }

            var cells = SplitTableRow(line);
            if (IsTableDivider(cells))
            {
                continue;
            }

            Assert.True(cells.Length > Math.Max(fileIndex, sourceHashIndex), line);
            reports.Add(new ManifestReport(
                ManifestPath: manifestPath,
                FileName: ParseFileName(cells[fileIndex]),
                SourceSha256: ParseSha256(cells[sourceHashIndex]),
                SourceBytes: ParseOptionalBytes(cells, sourceBytesIndex, line),
                DurablePath: ParseOptionalPath(cells, durablePathIndex),
                DurableSha256: ParseOptionalSha256(cells, durableHashIndex),
                DurableBytes: ParseOptionalBytes(cells, durableBytesIndex, line)));
        }

        Assert.NotEmpty(reports);
        return reports;
    }

    private static string ResolveDurablePath(string root, ManifestReport report)
    {
        if (!string.IsNullOrWhiteSpace(report.DurablePath))
        {
            return Path.GetFullPath(Path.Combine(
                root,
                report.DurablePath.Replace('/', Path.DirectorySeparatorChar)));
        }

        return Path.GetFullPath(Path.Combine(Path.GetDirectoryName(report.ManifestPath)!, report.FileName));
    }

    private static void AssertPathIsInsideRoot(string root, string path)
    {
        var normalizedRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        var normalizedPath = Path.GetFullPath(path);
        Assert.True(
            normalizedPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase),
            $"Manifest route escapes the repository: {normalizedPath}");
    }

    private static string[] SplitTableRow(string line) =>
        line.Trim().Trim('|').Split('|', StringSplitOptions.TrimEntries);

    private static bool IsTableDivider(IEnumerable<string> cells) =>
        cells.All(cell => cell.All(character => character is '-' or ':' or ' '));

    private static string NormalizeHeader(string cell) =>
        new(cell.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

    private static string ParseFileName(string cell)
    {
        var value = cell.Trim().Trim('`');
        if (!value.StartsWith('['))
        {
            return value;
        }

        var closeBracket = value.IndexOf(']');
        Assert.True(closeBracket > 1, cell);
        return value[1..closeBracket];
    }

    private static string? ParseOptionalPath(IReadOnlyList<string> cells, int index)
    {
        if (index < 0 || index >= cells.Count)
        {
            return null;
        }

        var value = cells[index].Trim();
        if (string.IsNullOrWhiteSpace(value) || value == "-" || value.StartsWith('['))
        {
            return null;
        }

        return value.Trim('`');
    }

    private static string ParseSha256(string cell)
    {
        var value = cell.Trim().Trim('`').ToLowerInvariant();
        Assert.Matches("^[0-9a-f]{64}$", value);
        return value;
    }

    private static string? ParseOptionalSha256(IReadOnlyList<string> cells, int index)
    {
        if (index < 0 || index >= cells.Count)
        {
            return null;
        }

        var value = cells[index].Trim().Trim('`');
        return string.IsNullOrWhiteSpace(value) || value == "-" ? null : ParseSha256(value);
    }

    private static long? ParseOptionalBytes(IReadOnlyList<string> cells, int index, string line)
    {
        if (index < 0 || index >= cells.Count)
        {
            return null;
        }

        var value = cells[index].Trim().Trim('`').Replace(",", string.Empty, StringComparison.Ordinal);
        if (string.IsNullOrWhiteSpace(value) || value == "-")
        {
            return null;
        }

        Assert.True(long.TryParse(value, out var bytes), line);
        return bytes;
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

    private static string Normalize(string path) => path.Replace('\\', '/');

    private static string Sha256Hex(string path)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(sha256.ComputeHash(stream)).ToLowerInvariant();
    }

    private readonly record struct ManifestReport(
        string ManifestPath,
        string FileName,
        string SourceSha256,
        long? SourceBytes,
        string? DurablePath,
        string? DurableSha256,
        long? DurableBytes);
}
