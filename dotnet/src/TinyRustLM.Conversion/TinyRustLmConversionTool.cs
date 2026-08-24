using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TinyRustLM;

/// <summary>The two exact source-family conversions exposed by the current converter.</summary>
public enum TinyRustLmConversionKind
{
    /// <summary>Converts one locked Qwen3 safetensors source to mixed-Q8 SLM2.</summary>
    Qwen3Safetensors,

    /// <summary>Converts one locked Qwen tokenizer source to Tokenizer2.</summary>
    QwenTokenizer2
}

/// <summary>Create-only inputs for one exact local conversion transaction.</summary>
public sealed record TinyRustLmConversionRequest(
    TinyRustLmConversionKind Kind,
    string SourceLockPath,
    string SourceDirectory,
    string OutputPath);

/// <summary>Explicit process and output ceilings for a conversion transaction.</summary>
public sealed record TinyRustLmConversionPolicy(
    TimeSpan MaximumDuration,
    int MaximumSummaryBytes,
    int MaximumErrorBytes)
{
    /// <summary>Conservative defaults for one local conversion process.</summary>
    public static TinyRustLmConversionPolicy Default { get; } = new(
        TimeSpan.FromHours(12),
        65_536,
        4_096);
}

/// <summary>Verified identity and evidence paths from one completed conversion.</summary>
public sealed record TinyRustLmConversionResult(
    string Schema,
    TinyRustLmConversionKind Kind,
    string ArtifactPath,
    ulong ArtifactBytes,
    string ArtifactSha256,
    string ReceiptPath,
    string RequiredNextGate,
    string SummarySha256,
    TimeSpan Duration);

/// <summary>Fail-closed process owner for the sole current TinyRustLM converter.</summary>
public sealed partial class TinyRustLmConversionTool
{
    private const int HashBufferBytes = 1_048_576;
    private readonly TinyRustLmConversionPolicy _policy;
    private readonly string _toolPath;

    /// <summary>Creates a converter owner for one explicit regular executable file.</summary>
    public TinyRustLmConversionTool(
        string toolPath,
        TinyRustLmConversionPolicy? policy = null)
    {
        _toolPath = RequireExistingRegularFile(toolPath, nameof(toolPath));
        _policy = policy ?? TinyRustLmConversionPolicy.Default;
        if (_policy.MaximumDuration <= TimeSpan.Zero ||
            _policy.MaximumDuration > TimeSpan.FromDays(7) ||
            _policy.MaximumSummaryBytes is < 1 or > 1_048_576 ||
            _policy.MaximumErrorBytes is < 1 or > 65_536)
        {
            throw new ArgumentOutOfRangeException(nameof(policy));
        }
    }

    /// <summary>Creates a converter owner for the exact tool copied from the package.</summary>
    public static TinyRustLmConversionTool FromPackageLayout(
        TinyRustLmConversionPolicy? policy = null)
    {
        var rid = RuntimeIdentifier();
        var fileName = OperatingSystem.IsWindows()
            ? "tinyrustlm-convert.exe"
            : "tinyrustlm-convert";
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "tinyrustlm",
            "tools",
            rid,
            fileName);
        return new TinyRustLmConversionTool(path, policy);
    }

    /// <summary>Runs one create-only conversion and verifies the promoted artifact identity.</summary>
    public async Task<TinyRustLmConversionResult> ConvertAsync(
        TinyRustLmConversionRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var sourceLock = RequireExistingRegularFile(request.SourceLockPath, nameof(request.SourceLockPath));
        var sourceDirectory = RequireExistingDirectory(request.SourceDirectory, nameof(request.SourceDirectory));
        var outputPath = RequireCreateOnlyOutput(request.OutputPath, nameof(request.OutputPath));
        var command = request.Kind switch
        {
            TinyRustLmConversionKind.Qwen3Safetensors => "qwen3-safetensors",
            TinyRustLmConversionKind.QwenTokenizer2 => "qwen-tokenizer2",
            _ => throw new ArgumentOutOfRangeException(nameof(request))
        };

        var startInfo = new ProcessStartInfo
        {
            FileName = _toolPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = new UTF8Encoding(false, true),
            StandardErrorEncoding = new UTF8Encoding(false, true),
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add(command);
        startInfo.ArgumentList.Add(sourceLock);
        startInfo.ArgumentList.Add(sourceDirectory);
        startInfo.ArgumentList.Add(outputPath);

        var stopwatch = Stopwatch.StartNew();
        using var process = Process.Start(startInfo)
            ?? throw new TinyRustLmException("converter-process-start");
        var stdoutTask = ReadBoundedAsync(
            process.StandardOutput.BaseStream,
            _policy.MaximumSummaryBytes,
            process);
        var stderrTask = ReadBoundedAsync(
            process.StandardError.BaseStream,
            _policy.MaximumErrorBytes,
            process);

        using var timeout = new CancellationTokenSource(_policy.MaximumDuration);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeout.Token);
        try
        {
            await process.WaitForExitAsync(linked.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            TryKill(process);
            await process.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
            await DrainAfterTermination(stdoutTask, stderrTask).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            throw new TinyRustLmException("converter-timeout");
        }

        byte[] stdout;
        byte[] stderr;
        try
        {
            await Task.WhenAll(stdoutTask, stderrTask).ConfigureAwait(false);
            stdout = stdoutTask.Result;
            stderr = stderrTask.Result;
        }
        catch (ConversionOutputLimitException)
        {
            throw new TinyRustLmException("converter-output-limit");
        }

        stopwatch.Stop();
        if (process.ExitCode != 0)
        {
            throw new TinyRustLmException(ParseFailureCode(stderr));
        }
        if (stderr.Length != 0)
        {
            throw new TinyRustLmException("converter-unexpected-stderr");
        }

        return VerifySummary(
            request.Kind,
            outputPath,
            stdout,
            stopwatch.Elapsed);
    }

    private static TinyRustLmConversionResult VerifySummary(
        TinyRustLmConversionKind kind,
        string outputPath,
        byte[] summaryBytes,
        TimeSpan duration)
    {
        NativeConversionSummary summary;
        try
        {
            summary = JsonSerializer.Deserialize<NativeConversionSummary>(summaryBytes, JsonOptions)
                ?? throw new TinyRustLmException("converter-summary-json");
        }
        catch (JsonException)
        {
            throw new TinyRustLmException("converter-summary-json");
        }

        var expected = kind switch
        {
            TinyRustLmConversionKind.Qwen3Safetensors => new SummaryExpectation(
                "tinyrustlm.qwen3_conversion_cli_summary.v1",
                summary.ModelFile,
                summary.ModelBytes,
                summary.ModelSha256,
                "source-native-browser-numerical-parity-and-untouched-quality-qualification"),
            TinyRustLmConversionKind.QwenTokenizer2 => new SummaryExpectation(
                "tinyrustlm.qwen_tokenizer2_conversion_cli_summary.v1",
                summary.TokenizerFile,
                summary.TokenizerBytes,
                summary.TokenizerSha256,
                "broad-source-oracle-parity-and-full-artifact-native-browser-wasm-replay"),
            _ => throw new TinyRustLmException("converter-summary-kind")
        };

        var outputName = Path.GetFileName(outputPath);
        var receiptName = $"{outputName}.conversion-receipt.json";
        if (summary.Schema != expected.Schema ||
            summary.Status != "pass" ||
            expected.ArtifactFile != outputName ||
            expected.ArtifactBytes is null or 0 ||
            !IsDigest(expected.ArtifactSha256) ||
            summary.ReceiptFile != receiptName ||
            summary.RequiredNextGate != expected.RequiredNextGate ||
            summary.ModelFile is not null != (kind == TinyRustLmConversionKind.Qwen3Safetensors) ||
            summary.TokenizerFile is not null != (kind == TinyRustLmConversionKind.QwenTokenizer2))
        {
            throw new TinyRustLmException("converter-summary-contract");
        }

        var receiptPath = Path.Combine(Path.GetDirectoryName(outputPath)!, receiptName);
        RequireExistingRegularFile(outputPath, nameof(outputPath));
        RequireExistingRegularFile(receiptPath, nameof(receiptPath));
        var actualBytes = checked((ulong)new FileInfo(outputPath).Length);
        var actualSha256 = Sha256File(outputPath);
        if (actualBytes != expected.ArtifactBytes.Value ||
            actualSha256 != expected.ArtifactSha256)
        {
            throw new TinyRustLmException("converter-artifact-identity");
        }

        return new TinyRustLmConversionResult(
            expected.Schema,
            kind,
            outputPath,
            actualBytes,
            actualSha256,
            receiptPath,
            expected.RequiredNextGate,
            Convert.ToHexString(SHA256.HashData(summaryBytes)).ToLowerInvariant(),
            duration);
    }

    private static async Task<byte[]> ReadBoundedAsync(
        Stream stream,
        int maximumBytes,
        Process process)
    {
        using var output = new MemoryStream(Math.Min(maximumBytes, 16_384));
        var buffer = new byte[4_096];
        while (true)
        {
            var count = await stream.ReadAsync(buffer).ConfigureAwait(false);
            if (count == 0)
            {
                return output.ToArray();
            }
            if (output.Length + count > maximumBytes)
            {
                TryKill(process);
                throw new ConversionOutputLimitException();
            }

            output.Write(buffer, 0, count);
        }
    }

    private static async Task DrainAfterTermination(params Task<byte[]>[] tasks)
    {
        try
        {
            await Task.WhenAll(tasks).ConfigureAwait(false);
        }
        catch (ConversionOutputLimitException)
        {
        }
    }

    private static string ParseFailureCode(byte[] stderr)
    {
        string text;
        try
        {
            text = new UTF8Encoding(false, true).GetString(stderr).TrimEnd('\r', '\n');
        }
        catch (DecoderFallbackException)
        {
            return "converter-process-failed";
        }

        var match = FailureLine().Match(text);
        return match.Success ? match.Groups[1].Value : "converter-process-failed";
    }

    private static string RequireExistingRegularFile(string value, string argumentName)
    {
        var path = RequirePath(value, argumentName);
        if (!File.Exists(path) ||
            (File.GetAttributes(path) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
        {
            throw new FileNotFoundException("A regular file is required.", path);
        }

        return path;
    }

    private static string RequireExistingDirectory(string value, string argumentName)
    {
        var path = RequirePath(value, argumentName);
        if (!Directory.Exists(path) ||
            (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new DirectoryNotFoundException("A non-reparse directory is required.");
        }

        return path;
    }

    private static string RequireCreateOnlyOutput(string value, string argumentName)
    {
        var path = RequirePath(value, argumentName);
        var parent = Path.GetDirectoryName(path);
        if (string.IsNullOrWhiteSpace(parent))
        {
            throw new ArgumentException("The output requires an existing parent directory.", argumentName);
        }

        _ = RequireExistingDirectory(parent, argumentName);
        if (File.Exists(path) || Directory.Exists(path))
        {
            throw new IOException("The conversion output path already exists.");
        }

        return path;
    }

    private static string RequirePath(string value, string argumentName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        if (value.Length > 32_767 || value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException("The path is too large or contains an embedded NUL.", argumentName);
        }

        return Path.GetFullPath(value);
    }

    private static string Sha256File(string path)
    {
        using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            HashBufferBytes,
            FileOptions.SequentialScan);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }

    private static bool IsDigest(string? value) =>
        value is { Length: 64 } && value.All(character =>
            character is (>= '0' and <= '9') or (>= 'a' and <= 'f'));

    private static string RuntimeIdentifier()
    {
        if (!Environment.Is64BitProcess)
        {
            throw new PlatformNotSupportedException("TinyRustLM conversion requires a 64-bit process.");
        }

        var architecture = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new PlatformNotSupportedException("TinyRustLM conversion supports x64 and arm64.")
        };
        if (OperatingSystem.IsWindows())
        {
            return $"win-{architecture}";
        }
        if (OperatingSystem.IsLinux())
        {
            return $"linux-{architecture}";
        }

        throw new PlatformNotSupportedException("Packaged TinyRustLM conversion supports Windows and Linux.");
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (InvalidOperationException)
        {
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        AllowTrailingCommas = false,
        PropertyNameCaseInsensitive = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    [GeneratedRegex("^TinyRustLM conversion failed: ([a-z0-9-]{1,128})$", RegexOptions.CultureInvariant)]
    private static partial Regex FailureLine();

    private sealed record NativeConversionSummary(
        string Schema,
        string Status,
        string? ModelFile,
        ulong? ModelBytes,
        string? ModelSha256,
        string? TokenizerFile,
        ulong? TokenizerBytes,
        string? TokenizerSha256,
        string ReceiptFile,
        string RequiredNextGate);

    private sealed record SummaryExpectation(
        string Schema,
        string? ArtifactFile,
        ulong? ArtifactBytes,
        string? ArtifactSha256,
        string RequiredNextGate);

    private sealed class ConversionOutputLimitException : Exception;
}
