using System.Security.Cryptography;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class ReportIntakeMemoryTests
{
    private static readonly string[] ValidProcessedOutcomes =
    {
        "incorporated",
        "rejected-with-reason",
        "preserved-to-durable-memory",
        "kept-active-with-reason"
    };

    [Fact]
    public void ActiveIntakeBucketsContainOnlyPlaceholders()
    {
        var root = RepositoryRoot();

        foreach (var bucketName in new[] { "Content", "Improvement" })
        {
            var bucket = Path.Combine(root, "agent-file-handoff", bucketName);
            Assert.True(Directory.Exists(bucket), bucket);

            var activeEntries = Directory.EnumerateFileSystemEntries(bucket, "*", SearchOption.TopDirectoryOnly)
                .Where(path => !string.Equals(Path.GetFileName(path), ".gitkeep", StringComparison.OrdinalIgnoreCase))
                .Select(path => Path.GetRelativePath(root, path).Replace('\\', '/'))
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToArray();

            Assert.True(
                activeEntries.Length == 0,
                $"Active intake bucket {bucketName} is not complete: {string.Join(", ", activeEntries)}");
        }
    }

    [Fact]
    public void EveryHashedDurableManifestRowMatchesStoredBytes()
    {
        var root = RepositoryRoot();
        var manifests = Directory.GetFiles(
            Path.Combine(root, "docs", "report-intake"),
            "MANIFEST.md",
            SearchOption.AllDirectories);

        Assert.NotEmpty(manifests);
        var verifiedRows = 0;

        foreach (var manifestPath in manifests)
        {
            foreach (var report in ParseHashedManifest(manifestPath))
            {
                var durablePath = ResolveDurablePath(root, manifestPath, report);
                Assert.True(File.Exists(durablePath), durablePath);
                Assert.Equal(report.DurableSha256 ?? report.Sha256, Sha256Hex(durablePath));
                if ((report.DurableBytes ?? report.Bytes) is long expectedBytes)
                {
                    Assert.Equal(expectedBytes, new FileInfo(durablePath).Length);
                }

                verifiedRows++;
            }
        }

        Assert.True(verifiedRows >= 80, $"Expected at least 80 checksum-bound durable rows, found {verifiedRows}.");
    }

    [Fact]
    public void CurrentReportBatchesHaveOneValidProcessedOutcomePerSource()
    {
        var root = RepositoryRoot();
        var ledger = File.ReadAllText(Path.Combine(root, ".uai", "intake-outcome-ledger.uai"));

        foreach (var batch in new[] { "2026-07-08", "2026-07-10" })
        {
            var manifestPath = Path.Combine(root, "docs", "report-intake", batch, "MANIFEST.md");
            var reports = ParseHashedManifest(manifestPath);
            Assert.NotEmpty(reports);

            foreach (var report in reports)
            {
                Assert.False(string.IsNullOrWhiteSpace(report.SourcePath), $"Missing source path for {report.FileName}.");
                Assert.False(string.IsNullOrWhiteSpace(report.DurablePath), $"Missing durable path for {report.FileName}.");
                var block = FindLedgerEntry(ledger, report.SourcePath!);
                Assert.Contains($"docs_evidence_path: {report.DurablePath}", block, StringComparison.Ordinal);
                Assert.Contains($"sha256: {report.Sha256}", block, StringComparison.OrdinalIgnoreCase);
                Assert.Contains("source_removed: true", block, StringComparison.Ordinal);

                var outcome = ReadLedgerValue(block, "processed_outcome");
                Assert.Contains(outcome, ValidProcessedOutcomes);
                Assert.NotEqual("kept-active-with-reason", outcome);
            }
        }
    }

    [Fact]
    public void MemoryConnectorIntakeIsDistilledAcrossAllSixDomains()
    {
        var root = RepositoryRoot();
        var batchDirectory = Path.Combine(root, "docs", "report-intake", "2026-07-10");
        var manifest = File.ReadAllText(Path.Combine(batchDirectory, "MANIFEST.md"));
        var reports = ParseHashedManifest(Path.Combine(batchDirectory, "MANIFEST.md"));
        var synthesis = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-memory-endpoints-intake-synthesis-2026-07-10.md"));
        var tddPlan = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-memory-endpoints-intake-tdd-plan-2026-07-10.md"));
        var durableMemory = File.ReadAllText(Path.Combine(
            root,
            "wiki",
            "runtime-mirust",
            "reports",
            "tinyrustlm-memory-endpoints-intake-memory-2026-07-10.md"));
        var haystack = string.Join('\n', synthesis, tddPlan, durableMemory);

        Assert.Equal(12, reports.Count);
        Assert.Contains("Preserved Markdown files: 12", manifest, StringComparison.Ordinal);

        foreach (var required in new[]
        {
            "production deployment and relay",
            "retrieval and context packing",
            "Rust and .NET connector",
            "distributed synchronization and recovery",
            "memory distribution and lifecycle",
            "security and threat model",
            "direct browser CORS",
            "status",
            "handoff",
            "idempotency",
            "tombstone",
            "prompt injection",
            "no silent overwrite",
            "no test weakening"
        })
        {
            Assert.Contains(required, haystack, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void BrowserMemoryAndNotificationIntakeUsesLiveContracts()
    {
        var root = RepositoryRoot();
        var batchDirectory = Path.Combine(
            root,
            "docs",
            "report-intake",
            "2026-07-12",
            "memory-connectors-and-notifications");
        var manifestPath = Path.Combine(batchDirectory, "MANIFEST.md");
        var reports = ParseHashedManifest(manifestPath);
        var synthesis = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-browser-memory-notification-synthesis-2026-07-12.md"));
        var tddPlan = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-browser-memory-notification-tdd-plan-2026-07-12.md"));
        const string durableRoute =
            "wiki/runtime-mirust/reports/tinyrustlm-browser-memory-notification-intake-memory-2026-07-12.md";
        var durableMemory = File.ReadAllText(Path.Combine(
            root,
            durableRoute.Replace('/', Path.DirectorySeparatorChar)));
        var ledger = File.ReadAllText(Path.Combine(root, ".uai", "intake-outcome-ledger.uai"));
        var haystack = string.Join('\n', synthesis, tddPlan, durableMemory);

        Assert.Equal(4, reports.Count);

        foreach (var required in new[]
        {
            "memoryendpoints.virtual_uai_contract.v1",
            "12 required records",
            "service worker is not a security boundary",
            "saved locally; synchronization pending",
            "expectedRevision",
            "durable cursor",
            "SSE",
            "hint channel",
            "current-message",
            "responseRequired",
            "no inbound port",
            "no silent promotion",
            "locked UI",
            "first-class package/record/startup routes"
        })
        {
            Assert.Contains(required, haystack, StringComparison.OrdinalIgnoreCase);
        }

        foreach (var report in reports)
        {
            Assert.False(string.IsNullOrWhiteSpace(report.SourcePath));
            Assert.False(string.IsNullOrWhiteSpace(report.DurablePath));
            var block = FindLedgerEntry(ledger, report.SourcePath!);
            Assert.Contains($"docs_evidence_path: {report.DurablePath}", block, StringComparison.Ordinal);
            Assert.Contains($"sha256: {report.Sha256}", block, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("processed_outcome: preserved-to-durable-memory", block, StringComparison.Ordinal);
            Assert.Contains("source_removed: true", block, StringComparison.Ordinal);
        }

        foreach (var relativePath in new[]
        {
            ".uai/short-term-memory.uai",
            ".uai/long-term-memory.uai",
            ".uai/index.uai",
            ".uai/report-synthesis.uai",
            ".uai/test-plan.uai",
            ".uai/file-handoff.uai",
            ".uai/intake-outcome-ledger.uai"
        })
        {
            var text = File.ReadAllText(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            Assert.Contains("docs/report-intake/2026-07-12/memory-connectors-and-notifications/MANIFEST.md", text);
            Assert.Contains(durableRoute, text);
        }
    }

    [Fact]
    public void DotNetP2PSeedHostIntakeIsPairedCorrectedAndRouted()
    {
        var root = RepositoryRoot();
        var batchDirectory = Path.Combine(
            root,
            "docs",
            "report-intake",
            "2026-07-13",
            "dotnet-p2p-seed-host");
        var manifestPath = Path.Combine(batchDirectory, "MANIFEST.md");
        var reports = ParseHashedManifest(manifestPath);
        var synthesis = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-dotnet-p2p-seed-host-intake-synthesis-2026-07-13.md"));
        var tddPlan = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-dotnet-p2p-seed-host-intake-tdd-plan-2026-07-13.md"));
        const string durableRoute =
            "wiki/runtime-mirust/reports/tinyrustlm-dotnet-p2p-seed-host-intake-memory-2026-07-13.md";
        var durableMemory = File.ReadAllText(Path.Combine(
            root,
            durableRoute.Replace('/', Path.DirectorySeparatorChar)));
        var ledger = File.ReadAllText(Path.Combine(root, ".uai", "intake-outcome-ledger.uai"));
        var haystack = string.Join('\n', synthesis, tddPlan, durableMemory);

        Assert.Equal(12, reports.Count);

        foreach (var required in new[]
        {
            "release and ABI",
            "network and reachability",
            "resumable import",
            "service lifecycle",
            "provenance and catalog trust",
            "web and companion UX",
            "exactly two lane processes",
            "not forty processes",
            "Rust remains authoritative",
            "external reachability",
            "single-use receipt",
            "no model bytes",
            "no persisted credentials",
            "conversation-proven",
            "runtime-smoke-only",
            "SourceLink",
            ".snupkg",
            "wrong architecture",
            "center column",
            "render exactly once",
            "no test weakening"
        })
        {
            Assert.Contains(required, haystack, StringComparison.OrdinalIgnoreCase);
        }

        foreach (var report in reports)
        {
            Assert.False(string.IsNullOrWhiteSpace(report.SourcePath));
            Assert.False(string.IsNullOrWhiteSpace(report.DurablePath));
            var block = FindLedgerEntry(ledger, report.SourcePath!);
            Assert.Contains($"docs_evidence_path: {report.DurablePath}", block, StringComparison.Ordinal);
            Assert.Contains($"sha256: {report.Sha256}", block, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("processed_outcome: preserved-to-durable-memory", block, StringComparison.Ordinal);
            Assert.Contains("source_removed: true", block, StringComparison.Ordinal);
        }

        foreach (var relativePath in new[]
        {
            ".uai/short-term-memory.uai",
            ".uai/long-term-memory.uai",
            ".uai/index.uai",
            ".uai/report-synthesis.uai",
            ".uai/test-plan.uai",
            ".uai/file-handoff.uai",
            ".uai/intake-outcome-ledger.uai"
        })
        {
            var text = File.ReadAllText(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            Assert.Contains(
                "docs/report-intake/2026-07-13/dotnet-p2p-seed-host/MANIFEST.md",
                text,
                StringComparison.Ordinal);
            Assert.Contains(durableRoute, text, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void DeeperSmallModelResearchIsPairedCorrectedAndRouted()
    {
        var root = RepositoryRoot();
        var batchDirectory = Path.Combine(
            root,
            "docs",
            "report-intake",
            "2026-07-15",
            "deeper-small-model-research");
        var manifestPath = Path.Combine(batchDirectory, "MANIFEST.md");
        var reports = ParseHashedManifest(manifestPath);
        var synthesis = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-deeper-small-model-research-intake-synthesis-2026-07-15.md"));
        var tddPlan = File.ReadAllText(Path.Combine(
            batchDirectory,
            "tinyrustlm-deeper-small-model-research-intake-tdd-delta-2026-07-15.md"));
        const string manifestRoute =
            "docs/report-intake/2026-07-15/deeper-small-model-research/MANIFEST.md";
        const string durableRoute =
            "wiki/runtime-mirust/reports/tinyrustlm-deeper-small-model-research-intake-synthesis-2026-07-15.md";
        var durableMemory = File.ReadAllText(Path.Combine(
            root,
            durableRoute.Replace('/', Path.DirectorySeparatorChar)));
        var ledger = File.ReadAllText(Path.Combine(root, ".uai", "intake-outcome-ledger.uai"));
        var haystack = string.Join('\n', synthesis, tddPlan, durableMemory);

        Assert.Equal(13, reports.Count);
        Assert.Equal(12, reports.Count(report => report.SourcePath?.EndsWith("research-prompts.md", StringComparison.Ordinal) is false));
        Assert.Single(
            reports,
            report => report.SourcePath?.EndsWith("research-prompts.md", StringComparison.Ordinal) is true);

        foreach (var required in new[]
        {
            "318 unresolved",
            "4/8",
            "8B-A1B",
            "all 668 draft records",
            "whole-record SHA-256",
            "CKA-guided QAD",
            "SPRT",
            "24-case fault-injection",
            "no unreviewed record enters training",
            "trusted exclusion service",
            "simplest supported PTQ tier",
            "No additional general research report is needed"
        })
        {
            Assert.Contains(required, haystack, StringComparison.OrdinalIgnoreCase);
        }

        foreach (var report in reports)
        {
            Assert.False(string.IsNullOrWhiteSpace(report.SourcePath));
            Assert.False(string.IsNullOrWhiteSpace(report.DurablePath));
            var block = FindLedgerEntry(ledger, report.SourcePath!);
            Assert.Contains($"docs_evidence_path: {report.DurablePath}", block, StringComparison.Ordinal);
            Assert.Contains($"sha256: {report.Sha256}", block, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("processed_outcome: preserved-to-durable-memory", block, StringComparison.Ordinal);
            Assert.Contains("source_removed: true", block, StringComparison.Ordinal);
            Assert.Contains("proof_of_use:", block, StringComparison.Ordinal);
            Assert.Contains("routing_summary:", block, StringComparison.Ordinal);
        }

        foreach (var relativePath in new[]
        {
            ".uai/short-term-memory.uai",
            ".uai/long-term-memory.uai",
            ".uai/index.uai",
            ".uai/report-synthesis.uai",
            ".uai/test-plan.uai",
            ".uai/file-handoff.uai",
            ".uai/intake-outcome-ledger.uai"
        })
        {
            var text = File.ReadAllText(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            Assert.Contains(manifestRoute, text, StringComparison.Ordinal);
            Assert.Contains(durableRoute, text, StringComparison.Ordinal);
        }

        var durableHash = Sha256Hex(Path.Combine(
            root,
            durableRoute.Replace('/', Path.DirectorySeparatorChar)));
        Assert.Contains(durableHash, File.ReadAllText(Path.Combine(root, ".uai", "long-term-memory.uai")), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void HotMemoryRoutesToDurableBackupAndHostedReadbackEvidence()
    {
        var root = RepositoryRoot();
        const string manifestRoute = "docs/report-intake/2026-07-10/MANIFEST.md";
        const string synthesisRoute = "docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-synthesis-2026-07-10.md";
        const string tddRoute = "docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-tdd-plan-2026-07-10.md";
        const string durableRoute = "wiki/runtime-mirust/reports/tinyrustlm-memory-endpoints-intake-memory-2026-07-10.md";
        const string hostedEvidenceRoute = "docs/report-intake/2026-07-10/MEMORYENDPOINTS-DISTRIBUTION.md";

        foreach (var relativePath in new[]
        {
            ".uai/short-term-memory.uai",
            ".uai/report-synthesis.uai",
            ".uai/test-plan.uai",
            ".uai/long-term-memory.uai",
            ".uai/intake-outcome-ledger.uai",
            ".uai/index.uai",
            ".uai/file-handoff.uai"
        })
        {
            var text = File.ReadAllText(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            Assert.Contains(manifestRoute, text, StringComparison.Ordinal);
            Assert.Contains(synthesisRoute, text, StringComparison.Ordinal);
            Assert.Contains(tddRoute, text, StringComparison.Ordinal);
            Assert.Contains(durableRoute, text, StringComparison.Ordinal);
            Assert.Contains(hostedEvidenceRoute, text, StringComparison.Ordinal);
        }

        var durablePath = Path.Combine(root, durableRoute.Replace('/', Path.DirectorySeparatorChar));
        var durableHash = Sha256Hex(durablePath);
        var longTerm = File.ReadAllText(Path.Combine(root, ".uai", "long-term-memory.uai"));
        Assert.Contains("stable_id: tinyrustlm_memory_endpoints_intake_current", longTerm, StringComparison.Ordinal);
        Assert.Contains($"sha256: {durableHash}", longTerm, StringComparison.OrdinalIgnoreCase);

        var hostedEvidence = File.ReadAllText(Path.Combine(
            root,
            hostedEvidenceRoute.Replace('/', Path.DirectorySeparatorChar)));
        Assert.Contains("memoryType=status", hostedEvidence, StringComparison.Ordinal);
        Assert.Contains("memoryType=handoff", hostedEvidence, StringComparison.Ordinal);
        Assert.Contains("visibleInSearch=true", hostedEvidence, StringComparison.Ordinal);
        Assert.Contains("tier isolation", hostedEvidence, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("workspace key", hostedEvidence, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void EarlierBleedingEdgePlanRetainsItsNoCheatBoundary()
    {
        var root = RepositoryRoot();
        var tddPlan = File.ReadAllText(Path.Combine(
            root,
            "docs",
            "report-intake",
            "2026-07-08",
            "tinyrustlm-bleeding-edge-tdd-plan-2026-07-08.md"));
        var durableMemory = File.ReadAllText(Path.Combine(
            root,
            "wiki",
            "runtime-mirust",
            "reports",
            "tinyrustlm-bleeding-edge-system-plan-memory-2026-07-08.md"));

        Assert.Contains("No test should be weakened to make a bad model pass", tddPlan, StringComparison.Ordinal);
        Assert.Contains("No browser-side fake assistant output", durableMemory, StringComparison.Ordinal);
    }

    private static IReadOnlyList<ManifestReport> ParseHashedManifest(string manifestPath)
    {
        Assert.True(File.Exists(manifestPath), manifestPath);
        var lines = File.ReadAllLines(manifestPath);
        var headerIndex = Array.FindIndex(lines, line =>
            line.StartsWith('|')
            && SplitTableRow(line).Any(cell =>
                NormalizeHeader(cell) is "sha256" or "sourcesha256"));

        if (headerIndex < 0)
        {
            return Array.Empty<ManifestReport>();
        }

        var headers = SplitTableRow(lines[headerIndex]).Select(NormalizeHeader).ToArray();
        var fileIndex = Array.FindIndex(headers, header => header is "file" or "report");
        var hashIndex = Array.FindIndex(headers, header => header is "sha256" or "sourcesha256");
        var bytesIndex = Array.FindIndex(headers, header => header == "bytes");
        var durableHashIndex = Array.FindIndex(headers, header => header == "durablesha256");
        var durableBytesIndex = Array.FindIndex(headers, header => header == "durablebytes");
        var sourceIndex = Array.FindIndex(headers, header => header == "sourcepath");
        var durableIndex = Array.FindIndex(headers, header => header is "durablepath" or "durabledocscopy");
        Assert.True(fileIndex >= 0 && hashIndex >= 0, manifestPath);

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
            if (cells.All(cell => cell.All(character => character is '-' or ':' or ' ')))
            {
                continue;
            }

            Assert.True(cells.Length > Math.Max(fileIndex, hashIndex), line);
            var fileName = ParseFileName(cells[fileIndex]);
            var hash = cells[hashIndex].Trim().Trim('`').ToLowerInvariant();
            Assert.Matches("^[0-9a-f]{64}$", hash);

            long? bytes = null;
            if (bytesIndex >= 0 && bytesIndex < cells.Length)
            {
                Assert.True(long.TryParse(cells[bytesIndex].Replace(",", string.Empty), out var parsedBytes), line);
                bytes = parsedBytes;
            }

            long? durableBytes = null;
            if (durableBytesIndex >= 0 && durableBytesIndex < cells.Length)
            {
                Assert.True(
                    long.TryParse(cells[durableBytesIndex].Replace(",", string.Empty), out var parsedDurableBytes),
                    line);
                durableBytes = parsedDurableBytes;
            }

            string? durableHash = null;
            if (durableHashIndex >= 0 && durableHashIndex < cells.Length)
            {
                durableHash = cells[durableHashIndex].Trim().Trim('`').ToLowerInvariant();
                Assert.Matches("^[0-9a-f]{64}$", durableHash);
            }

            reports.Add(new ManifestReport(
                fileName,
                hash,
                bytes,
                durableHash,
                durableBytes,
                sourceIndex >= 0 && sourceIndex < cells.Length ? ParseCodeCell(cells[sourceIndex]) : null,
                durableIndex >= 0 && durableIndex < cells.Length ? ParseDurableCell(cells[durableIndex]) : null));
        }

        return reports;
    }

    private static string FindLedgerEntry(string ledger, string sourcePath)
    {
        var marker = $"  - source_path: {sourcePath}";
        var start = ledger.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Ledger entry missing for {sourcePath}.");
        var next = ledger.IndexOf("\n  - source_path: ", start + marker.Length, StringComparison.Ordinal);
        return next >= 0 ? ledger[start..next] : ledger[start..];
    }

    private static string ReadLedgerValue(string block, string key)
    {
        var prefix = $"    {key}: ";
        var line = block.Split('\n').FirstOrDefault(candidate => candidate.StartsWith(prefix, StringComparison.Ordinal));
        Assert.False(string.IsNullOrWhiteSpace(line), $"Missing {key} in ledger block: {block}");
        return line![prefix.Length..].Trim();
    }

    private static string ResolveDurablePath(string root, string manifestPath, ManifestReport report)
    {
        if (!string.IsNullOrWhiteSpace(report.DurablePath))
        {
            return Path.GetFullPath(Path.Combine(
                root,
                report.DurablePath.Replace('/', Path.DirectorySeparatorChar)));
        }

        return Path.Combine(Path.GetDirectoryName(manifestPath)!, report.FileName);
    }

    private static string[] SplitTableRow(string line) =>
        line.Trim().Trim('|').Split('|', StringSplitOptions.TrimEntries);

    private static string NormalizeHeader(string cell) =>
        new(cell.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

    private static string ParseFileName(string cell)
    {
        var value = cell.Trim().Trim('`');
        if (value.StartsWith('['))
        {
            var closeBracket = value.IndexOf(']');
            Assert.True(closeBracket > 1, cell);
            value = value[1..closeBracket];
        }

        return value;
    }

    private static string ParseCodeCell(string cell) => cell.Trim().Trim('`');

    private static string ParseDurableCell(string cell)
    {
        var value = cell.Trim();
        if (value.StartsWith('['))
        {
            return null!;
        }

        return ParseCodeCell(value);
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

    private static string Sha256Hex(string path)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(sha256.ComputeHash(stream)).ToLowerInvariant();
    }

    private readonly record struct ManifestReport(
        string FileName,
        string Sha256,
        long? Bytes,
        string? DurableSha256,
        long? DurableBytes,
        string? SourcePath,
        string? DurablePath);
}
