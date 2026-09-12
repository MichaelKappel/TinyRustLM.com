using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using TinyRustLM;

namespace TinyRustLM.Companion;

/// <summary>
/// Owns the sole source-only production operation service for one Companion installation.
/// </summary>
public sealed class CompanionProductionOperationRuntime : IAsyncDisposable
{
    private const string JournalDirectoryName = "source-operation-journal-v1";
    private const string WorkDirectoryName = "source-operation-work-v1";
    private readonly CompanionProductionOperationExecutor _executor;

    /// <summary>Creates one runtime from its service facade and sole executor owner.</summary>
    private CompanionProductionOperationRuntime(
        CompanionOperationService operationService,
        CompanionProductionOperationExecutor executor)
    {
        OperationService = operationService;
        _executor = executor;
    }

    /// <summary>Gets the production operation service exposed to the Companion protocol host.</summary>
    public CompanionOperationService OperationService { get; }

    /// <summary>
    /// Opens application-owned operation roots and requires the packaged native converter.
    /// </summary>
    public static CompanionProductionOperationRuntime OpenFromPackageLayout(
        string applicationStateRoot) =>
        OpenWithConverterPath(applicationStateRoot, ResolvePackagedConverterPath());

    /// <summary>Opens production roots with an injected converter path for focused verification.</summary>
    internal static CompanionProductionOperationRuntime OpenWithConverterPath(
        string applicationStateRoot,
        string converterPath)
    {
        var stateRoot = CompanionProductionFileSystem.RequireExistingDirectory(
            applicationStateRoot,
            "companion-operation-state-root");
        var journalRoot = Path.Combine(stateRoot, JournalDirectoryName);
        var workRoot = Path.Combine(stateRoot, WorkDirectoryName);
        var journal = OpenJournal(journalRoot);
        CompanionProductionFileSystem.OpenOrCreateOwnedRoot(
            workRoot,
            CompanionProductionFileSystem.WorkRootMarker,
            "companion-operation-work-root");

        if (!File.Exists(converterPath))
        {
            throw new CompanionProtocolException("converter-tool-missing");
        }

        string workerSha256;
        string converterSha256;
        TinyRustLmConversionTool conversionTool;
        try
        {
            var workerPath = typeof(CompanionProductionOperationExecutor).Assembly.Location;
            if (string.IsNullOrWhiteSpace(workerPath))
            {
                throw new CompanionProtocolException("operation-worker-asset-missing");
            }
            workerSha256 = CompanionProductionFileSystem.Sha256RegularFile(
                workerPath,
                "operation-worker-asset-invalid");
            converterSha256 = CompanionProductionFileSystem.Sha256RegularFile(
                converterPath,
                "converter-tool-invalid");
            conversionTool = new TinyRustLmConversionTool(converterPath);
            CompanionBuiltInSourceAssets.Validate();
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (PlatformNotSupportedException)
        {
            throw new CompanionProtocolException("operation-platform-unsupported");
        }
        catch (Exception error) when (
            error is ArgumentException or IOException or UnauthorizedAccessException)
        {
            throw new CompanionProtocolException("converter-tool-invalid");
        }

        var acquisition = CompanionSourceAcquisition.CreateProduction(journal);
        var conversion = new CompanionSourceConversion(journal, conversionTool);
        var executor = new CompanionProductionOperationExecutor(
            journal,
            acquisition,
            conversion,
            journalRoot,
            workRoot,
            workerSha256,
            converterSha256);
        try
        {
            executor.RecoverPendingOperations();
            var artifacts = new CompanionArtifactTransfer(journal);
            return new CompanionProductionOperationRuntime(
                new CompanionOperationService(journal, executor, artifacts),
                executor);
        }
        catch
        {
            executor.DisposeAsync().AsTask().GetAwaiter().GetResult();
            throw;
        }
    }

    /// <summary>Stops and disposes the runtime's sole production executor.</summary>
    public ValueTask DisposeAsync() => _executor.DisposeAsync();

    /// <summary>Creates or opens the fixed marked journal root and normalizes invalid custody.</summary>
    private static CompanionOperationJournal OpenJournal(string journalRoot)
    {
        try
        {
            if (!Directory.Exists(journalRoot) && !File.Exists(journalRoot))
            {
                try
                {
                    _ = CompanionOperationJournal.CreateOwnedRoot(journalRoot);
                }
                catch (CompanionContractException) when (Directory.Exists(journalRoot))
                {
                    // Another host may have completed the same create-only root.
                }
            }

            return new CompanionOperationJournal(journalRoot);
        }
        catch (CompanionContractException)
        {
            throw new CompanionProtocolException("operation-journal-invalid");
        }
    }

    /// <summary>Derives the sole packaged converter path for the current supported host RID.</summary>
    private static string ResolvePackagedConverterPath()
    {
        if (!Environment.Is64BitProcess)
        {
            throw new CompanionProtocolException("operation-platform-unsupported");
        }
        var architecture = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new CompanionProtocolException("operation-platform-unsupported")
        };
        var platform = OperatingSystem.IsWindows()
            ? "win"
            : OperatingSystem.IsLinux()
                ? "linux"
                : throw new CompanionProtocolException("operation-platform-unsupported");
        var fileName = OperatingSystem.IsWindows()
            ? "tinyrustlm-convert.exe"
            : "tinyrustlm-convert";
        return Path.Combine(
            AppContext.BaseDirectory,
            "tinyrustlm",
            "tools",
            $"{platform}-{architecture}",
            fileName);
    }
}

/// <summary>Enforces fixed-path, regular-file, and marked-root production filesystem policy.</summary>
internal static class CompanionProductionFileSystem
{
    /// <summary>Gets the exact ownership marker for the production work root.</summary>
    internal const string WorkRootMarker =
        "tinyrustlm.companion.source-operation-work-root.v1\n";

    /// <summary>Gets the ownership-marker prefix for each operation work root.</summary>
    internal const string OperationRootMarkerPrefix =
        "tinyrustlm.companion.source-operation-root.v1:";

    /// <summary>Requires one absolute existing non-reparse directory.</summary>
    internal static string RequireExistingDirectory(string path, string code)
    {
        var full = RequireFullPath(path, code);
        try
        {
            if (!Directory.Exists(full) || File.Exists(full))
            {
                throw new CompanionProtocolException(code);
            }
            RejectReparsePoint(full, code);
            return full;
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw new CompanionProtocolException(code);
        }
    }

    /// <summary>Opens or create-only marks one direct child root owned by this application.</summary>
    internal static string OpenOrCreateOwnedRoot(
        string path,
        string marker,
        string code)
    {
        var full = RequireFullPath(path, code);
        var parent = Path.GetDirectoryName(full);
        if (string.IsNullOrWhiteSpace(parent))
        {
            throw new CompanionProtocolException(code);
        }
        _ = RequireExistingDirectory(parent, code);

        if (!Directory.Exists(full) && !File.Exists(full))
        {
            Directory.CreateDirectory(full);
            try
            {
                WriteCreateOnly(Path.Combine(full, ".owner"), Encoding.ASCII.GetBytes(marker));
            }
            catch (IOException) when (File.Exists(Path.Combine(full, ".owner")))
            {
            }
        }

        _ = RequireExistingDirectory(full, code);
        var markerPath = Path.Combine(full, ".owner");
        byte[] observed;
        try
        {
            observed = File.ReadAllBytes(markerPath);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new CompanionProtocolException(code);
        }
        if (!observed.AsSpan().SequenceEqual(Encoding.ASCII.GetBytes(marker)))
        {
            throw new CompanionProtocolException(code);
        }
        return full;
    }

    /// <summary>Writes and flushes one new file without replacing an existing entry.</summary>
    internal static void WriteCreateOnly(string path, ReadOnlySpan<byte> bytes)
    {
        using var stream = new FileStream(
            path,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 4_096,
            FileOptions.WriteThrough);
        stream.Write(bytes);
        stream.Flush(flushToDisk: true);
    }

    /// <summary>Hashes one absolute regular non-reparse file and normalizes filesystem errors.</summary>
    internal static string Sha256RegularFile(string path, string code)
    {
        var full = RequireFullPath(path, code);
        try
        {
            if (!File.Exists(full) || Directory.Exists(full))
            {
                throw new CompanionProtocolException(code);
            }
            RejectReparsePoint(full, code);
            using var stream = new FileStream(
                full,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                checked((int)CompanionSourceDescriptor.BufferBytes),
                FileOptions.SequentialScan);
            return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw new CompanionProtocolException(code);
        }
    }

    /// <summary>Rejects a filesystem entry that redirects path resolution.</summary>
    internal static void RejectReparsePoint(string path, string code)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionProtocolException(code);
        }
    }

    /// <summary>Canonicalizes one fully qualified path or returns the supplied policy error.</summary>
    internal static string RequireFullPath(string path, string code)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
            {
                throw new CompanionProtocolException(code);
            }
            return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (Exception error) when (
            error is ArgumentException or NotSupportedException or PathTooLongException)
        {
            throw new CompanionProtocolException(code);
        }
    }
}

/// <summary>Owns and self-verifies the compiled immutable source-lock documents.</summary>
internal static class CompanionBuiltInSourceAssets
{
    /// <summary>Gets the fixed model source-lock filename.</summary>
    internal const string ModelLockFileName = "qwen3-0.6b-base-source-lock.v2.json";

    /// <summary>Gets the fixed tokenizer source-lock filename.</summary>
    internal const string TokenizerLockFileName =
        "qwen3-0.6b-tokenizer2-source-lock.v1.json";

    private const string ModelLockBase64 =
        "ewogICJzY2hlbWEiOiAidGlueXJ1c3RsbS5xd2VuM19zb3VyY2VfbG9jay52MSIsCiAgIm1vZGVsSWQiOiAiUXdlbi9Rd2VuMy0wLjZCIiwKICAicmV2aXNpb24iOiAiYzE4OTlkZTI4OWEwNGQxMjEwMGRiMzcwZDgxNDg1Y2RmNzVlNDdjYSIsCiAgInNvdXJjZUtpbmQiOiAidXBzdHJlYW0tY2hlY2twb2ludCIsCiAgImFydGlmYWN0Q2xhc3MiOiAiYmFzZS1tb2RlbCIsCiAgImFyY2hpdGVjdHVyZVByb2ZpbGVJZCI6ICJ0aW55cnVzdGxtLnF3ZW4zLWRlbnNlLWdxYS1xay1ub3JtLzEiLAogICJsaWNlbnNlU3BkeCI6ICJBcGFjaGUtMi4wIiwKICAibGljZW5zZURpc3Bvc2l0aW9uIjogInJlZGlzdHJpYnV0aW9uLWFuZC1jb252ZXJzaW9uLWFwcHJvdmVkIiwKICAiZmlsZXMiOiB7CiAgICAiY29uZmlnIjogewogICAgICAicGF0aCI6ICJjb25maWcuanNvbiIsCiAgICAgICJieXRlTGVuZ3RoIjogNzI2LAogICAgICAic2hhMjU2IjogIjY2MGRiM2I3M2Q3ODgxMTljMDQ1MzVlNDhjZjliZTVmNTViYzMxMDA4NDFhNzE4NjM3YWU2OTViNDQyZjI3ZGQiCiAgICB9LAogICAgImdlbmVyYXRpb25Db25maWciOiB7CiAgICAgICJwYXRoIjogImdlbmVyYXRpb25fY29uZmlnLmpzb24iLAogICAgICAiYnl0ZUxlbmd0aCI6IDIzOSwKICAgICAgInNoYTI1NiI6ICIyMzI1ZGEwZjE1YmI4NDhlMDE4YzVhZTA3MWI3OTQzMzMyZTlmODcxZDZiNjBlMmVkMjJjYTk3ZDRjYjk5M2QyIgogICAgfSwKICAgICJsaWNlbnNlIjogewogICAgICAicGF0aCI6ICJMSUNFTlNFIiwKICAgICAgImJ5dGVMZW5ndGgiOiAxMTM0MywKICAgICAgInNoYTI1NiI6ICI4MzJkZDllMDBhNjhkZDgzYjNjM2ZiOWY1NTg4ZGFkN2RjZjMzN2EwZGI1MGY3ZDk0ODNmMzEwY2QyOTJlOTJlIgogICAgfSwKICAgICJtZXJnZXMiOiB7CiAgICAgICJwYXRoIjogIm1lcmdlcy50eHQiLAogICAgICAiYnl0ZUxlbmd0aCI6IDE2NzE4NTMsCiAgICAgICJzaGEyNTYiOiAiODgzMWU0ZjFhMDQ0NDcxMzQwZjdjMGE4M2Q3YmQ3MTMwNmE1Yjg2N2U5NWZkODcwZjc0ZDBjNTMwOGE5MDRkNSIKICAgIH0sCiAgICAibW9kZWwiOiB7CiAgICAgICJwYXRoIjogIm1vZGVsLnNhZmV0ZW5zb3JzIiwKICAgICAgImJ5dGVMZW5ndGgiOiAxNTAzMzAwMzI4LAogICAgICAic2hhMjU2IjogImY0N2Y3MTE3N2YzMmJjZDEwMWI3NTczZWM5MTcxZTZhNTdmNGY0ZDMxMTQ4ZDM4ZTM4MjMwNmY0Mjk5Njg3NGIiCiAgICB9LAogICAgInJlYWRtZSI6IHsKICAgICAgInBhdGgiOiAiUkVBRE1FLm1kIiwKICAgICAgImJ5dGVMZW5ndGgiOiAxMzk2NSwKICAgICAgInNoYTI1NiI6ICIxYWI2NGEyNmZjYjNiNDYxNDIzYjg5YTQzM2E4Yzg1OGYxYmY4ZDQwODZmOTc5Y2JiM2ZmODc4ZDQ3Y2YyMGU5IgogICAgfSwKICAgICJ0b2tlbml6ZXIiOiB7CiAgICAgICJwYXRoIjogInRva2VuaXplci5qc29uIiwKICAgICAgImJ5dGVMZW5ndGgiOiAxMTQyMjY1NCwKICAgICAgInNoYTI1NiI6ICJhZWIxMzMwN2E3MWFjZDhmZTgxODYxZDk0YWQ1NGFiNjg5ZGY3NzMzMTg4MDllZWQzY2JlNzk0YjQ0OTJkYWU0IgogICAgfSwKICAgICJ0b2tlbml6ZXJDb25maWciOiB7CiAgICAgICJwYXRoIjogInRva2VuaXplcl9jb25maWcuanNvbiIsCiAgICAgICJieXRlTGVuZ3RoIjogOTczMiwKICAgICAgInNoYTI1NiI6ICJkNWQwOWYwN2I0OGMzMDg2YzUwOGIzMGQxYzkxMTRiZDExODkxNDViNzRlOTgyYTI2NTM1MGM5MjNhY2Q4MTAxIgogICAgfSwKICAgICJ2b2NhYiI6IHsKICAgICAgInBhdGgiOiAidm9jYWIuanNvbiIsCiAgICAgICJieXRlTGVuZ3RoIjogMjc3NjgzMywKICAgICAgInNoYTI1NiI6ICJjYTEwZDdlOWZiM2VkMTg1NzVkZDFlMjc3YTI1NzljMTZkMTA4ZTMyZjI3NDM5Njg0YWZhMGUxMGIxNDQwOTEwIgogICAgfQogIH0KfQo=";
    private const string TokenizerLockBase64 =
        "ewogICJzY2hlbWEiOiAidGlueXJ1c3RsbS5xd2VuX3Rva2VuaXplcjJfc291cmNlX2xvY2sudjEiLAogICJtb2RlbElkIjogIlF3ZW4vUXdlbjMtMC42QiIsCiAgInJldmlzaW9uIjogImMxODk5ZGUyODlhMDRkMTIxMDBkYjM3MGQ4MTQ4NWNkZjc1ZTQ3Y2EiLAogICJzb3VyY2VLaW5kIjogInVwc3RyZWFtLWNoZWNrcG9pbnQiLAogICJhcmNoaXRlY3R1cmVQcm9maWxlSWQiOiAidGlueXJ1c3RsbS5xd2VuMy10b2tlbml6ZXItc291cmNlLzEiLAogICJmaWxlcyI6IHsKICAgICJjb25maWciOiB7CiAgICAgICJwYXRoIjogImNvbmZpZy5qc29uIiwKICAgICAgImJ5dGVMZW5ndGgiOiA3MjYsCiAgICAgICJzaGEyNTYiOiAiNjYwZGIzYjczZDc4ODExOWMwNDUzNWU0OGNmOWJlNWY1NWJjMzEwMDg0MWE3MTg2MzdhZTY5NWI0NDJmMjdkZCIKICAgIH0sCiAgICAibWVyZ2VzIjogewogICAgICAicGF0aCI6ICJtZXJnZXMudHh0IiwKICAgICAgImJ5dGVMZW5ndGgiOiAxNjcxODUzLAogICAgICAic2hhMjU2IjogIjg4MzFlNGYxYTA0NDQ3MTM0MGY3YzBhODNkN2JkNzEzMDZhNWI4NjdlOTVmZDg3MGY3NGQwYzUzMDhhOTA0ZDUiCiAgICB9LAogICAgInRva2VuaXplciI6IHsKICAgICAgInBhdGgiOiAidG9rZW5pemVyLmpzb24iLAogICAgICAiYnl0ZUxlbmd0aCI6IDExNDIyNjU0LAogICAgICAic2hhMjU2IjogImFlYjEzMzA3YTcxYWNkOGZlODE4NjFkOTRhZDU0YWI2ODlkZjc3MzMxODgwOWVlZDNjYmU3OTRiNDQ5MmRhZTQiCiAgICB9LAogICAgInRva2VuaXplckNvbmZpZyI6IHsKICAgICAgInBhdGgiOiAidG9rZW5pemVyX2NvbmZpZy5qc29uIiwKICAgICAgImJ5dGVMZW5ndGgiOiA5NzMyLAogICAgICAic2hhMjU2IjogImQ1ZDA5ZjA3YjQ4YzMwODZjNTA4YjMwZDFjOTExNGJkMTE4OTE0NWI3NGU5ODJhMjY1MzUwYzkyM2FjZDgxMDEiCiAgICB9LAogICAgInZvY2FiIjogewogICAgICAicGF0aCI6ICJ2b2NhYi5qc29uIiwKICAgICAgImJ5dGVMZW5ndGgiOiAyNzc2ODMzLAogICAgICAic2hhMjU2IjogImNhMTBkN2U5ZmIzZWQxODU3NWRkMWUyNzdhMjU3OWMxNmQxMDhlMzJmMjc0Mzk2ODRhZmEwZTEwYjE0NDA5MTAiCiAgICB9CiAgfQp9Cg==";

    /// <summary>Gets a fresh byte array containing the exact model source lock.</summary>
    internal static byte[] ModelLockBytes => Convert.FromBase64String(ModelLockBase64);

    /// <summary>Gets a fresh byte array containing the exact tokenizer source lock.</summary>
    internal static byte[] TokenizerLockBytes => Convert.FromBase64String(TokenizerLockBase64);

    /// <summary>Rehashes both compiled lock documents against their registered identities.</summary>
    internal static void Validate()
    {
        RequireDigest(ModelLockBytes, CompanionSourceDescriptor.ModelSourceLockSha256);
        RequireDigest(
            TokenizerLockBytes,
            CompanionSourceDescriptor.TokenizerSourceLockSha256);
    }

    /// <summary>Requires one compiled lock document to have its exact expected digest.</summary>
    private static void RequireDigest(byte[] bytes, string expected)
    {
        var actual = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (actual != expected)
        {
            throw new CompanionProtocolException("source-lock-assets-invalid");
        }
    }
}
