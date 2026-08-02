using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.SeedHost;

/// <summary>Paths and process limits for one resumable, Rust-authoritative peer import.</summary>
public sealed record SeedPeerImportOptions(
    string RequestPath,
    string ManifestPath,
    string OutputDirectory,
    string? MiniModelExecutablePath = null,
    TimeSpan? OperationTimeout = null);

/// <summary>Runs the reviewed Rust importer with hard cancellation and receipt reinspection.</summary>
public sealed class SeedPeerImportService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    private readonly IMiniModelAuthority authority;

    /// <summary>Create a cancellable peer import service.</summary>
    public SeedPeerImportService(IMiniModelAuthority authority)
    {
        this.authority = authority ?? throw new ArgumentNullException(nameof(authority));
    }

    /// <summary>
    /// Import or resume a model. Cancellation terminates the Rust process tree but retains only
    /// identity-bound staging pieces, which Rust revalidates on the next call.
    /// </summary>
    public async Task<PeerImportExecution> ImportAsync(
        SeedPeerImportOptions options,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(options);
        var requestPath = RequireRegularFile(options.RequestPath, "invalid_import_request");
        var manifestPath = RequireRegularFile(options.ManifestPath, "invalid_import_manifest");
        var outputDirectory = Path.GetFullPath(Required(options.OutputDirectory, "outputDirectory"));
        var outputParent = Path.GetDirectoryName(outputDirectory)
            ?? throw new SeedHostValidationException(
                "invalid_import_output",
                "Peer import output must have a parent directory.");
        Directory.CreateDirectory(outputParent);
        RequireRegularDirectory(outputParent, "invalid_import_output");
        if (Directory.Exists(outputDirectory))
        {
            RequireRegularDirectory(outputDirectory, "invalid_import_output");
        }
        else if (File.Exists(outputDirectory))
        {
            throw new SeedHostValidationException(
                "invalid_import_output",
                "Peer import output must not be an existing file.");
        }

        var executable = MiniModelExecutableLocator.Resolve(options.MiniModelExecutablePath);
        var timeout = options.OperationTimeout ?? TimeSpan.FromHours(12);
        var result = await BoundedProcessRunner.RunAsync(
            new ProcessCommand(
                executable,
                ["import-peer-request-json", requestPath, manifestPath, outputDirectory],
                outputParent),
            new ProcessRunOptions(timeout, 256 * 1024),
            cancellationToken).ConfigureAwait(false);
        if (result.ExitCode != 0)
        {
            throw new SeedHostException(
                "peer_import_failed",
                SafeFailureSummary(result.StandardError));
        }
        if (result.OutputTruncated)
        {
            throw new SeedHostException(
                "peer_import_report_truncated",
                "MiniModel import diagnostics exceeded the managed output boundary.");
        }
        PeerImportExecution report;
        try
        {
            report = JsonSerializer.Deserialize<PeerImportExecution>(
                    result.StandardOutput.Trim(),
                    JsonOptions)
                ?? throw new JsonException("Import report was empty.");
        }
        catch (JsonException error)
        {
            throw new SeedHostException(
                "invalid_import_report",
                "MiniModel returned an invalid resumable import report.",
                error);
        }
        RequireOwnedOutput(outputDirectory, report.OutputArtifactPath, "artifact");
        RequireOwnedOutput(outputDirectory, report.ReceiptPath, "receipt");
        RequireOwnedOutput(outputDirectory, report.PieceDirPath, "piece directory");
        RequireOwnedOutput(outputDirectory, report.ResumeStatePath, "resume state");
        RequireOwnedOutput(outputDirectory, report.StatusCheckPath, "status check");
        RequireOwnedOutput(outputDirectory, report.PreflightPath, "preflight");
        var receipt = authority.InspectPeerImportReceipt(
            report.ReceiptPath,
            requestPath,
            report.PreflightPath,
            manifestPath,
            report.OutputArtifactPath);
        if (receipt.ArtifactSha256 != report.ArtifactSha256
            || receipt.PieceSetSha256 != report.PieceSetSha256
            || receipt.MerkleRootSha256 != report.MerkleRootSha256
            || !receipt.PeerPieceBytesFetched
            || !receipt.ArtifactAssembledFromPeerPieces
            || receipt.ProjectServerServesModelBytes
            || receipt.ProjectServerRunsModelBytes
            || receipt.ProjectServerProxiesHuggingfaceBytes)
        {
            throw new SeedHostException(
                "import_receipt_contract_mismatch",
                "Rust import output did not match its independently reinspected receipt chain.");
        }
        return report;
    }

    private static string RequireRegularFile(string value, string errorCode)
    {
        var absolute = Path.GetFullPath(Required(value, nameof(value)));
        var information = new FileInfo(absolute);
        if (!information.Exists
            || information.Length <= 0
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                errorCode,
                "Peer import input must be a nonempty regular non-link file.");
        }
        return absolute;
    }

    private static void RequireRegularDirectory(string value, string errorCode)
    {
        var information = new DirectoryInfo(value);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                errorCode,
                "Peer import directories must be regular non-link directories.");
        }
    }

    private static void RequireOwnedOutput(string root, string value, string label)
    {
        var absoluteRoot = Path.GetFullPath(root).TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var absolute = Path.GetFullPath(Required(value, label));
        var comparison = OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;
        if (!absolute.StartsWith(absoluteRoot, comparison))
        {
            throw new SeedHostException(
                "native_output_escaped_import",
                $"MiniModel {label} escaped the owned import output directory.");
        }
    }

    private static string Required(string value, string argumentName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        if (value.Contains('\0'))
        {
            throw new ArgumentException("Path cannot contain an embedded NUL.", argumentName);
        }
        return value;
    }

    private static string SafeFailureSummary(string standardError)
    {
        const int maximumLength = 4096;
        var value = string.IsNullOrWhiteSpace(standardError)
            ? "MiniModel peer import failed without diagnostics."
            : standardError.Trim();
        return value.Length <= maximumLength ? value : value[..maximumLength];
    }
}
