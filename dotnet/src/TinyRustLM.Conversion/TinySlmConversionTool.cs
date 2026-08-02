using System.Diagnostics;
using System.Reflection;

namespace TinyRustLM;

/// <summary>Result from an invoked TinyRustLM conversion command.</summary>
public sealed record SlmConversionCommandResult(
    int ExitCode,
    string StandardOutput,
    string StandardError,
    string Command,
    TimeSpan Duration)
{
    /// <summary>True when the command exited with code zero.</summary>
    public bool Succeeded => ExitCode == 0;
}

/// <summary>Options for converting a Hugging Face conversion request into a local .slm artifact.</summary>
public sealed record HuggingFaceSlmConversionOptions(
    string RequestJsonPath,
    string InputSafetensorsPathOrDirectory,
    string OutputDirectory,
    string SourceShape = "tinylm16",
    string Quantization = "q8_0");

/// <summary>Options for converting a GGUF source model into a local .slm artifact.</summary>
public sealed record GgufSlmConversionOptions(
    string InputGgufPath,
    string SourceShape,
    string OutputSourceDirectory,
    string OutputSlmPath,
    string Quantization = "q8_0");

/// <summary>
/// Local/private wrapper around the TinyRustLM Rust conversion tool.
/// This package is intended for controlled folder feeds and does not belong in the protected public SDK.
/// </summary>
public sealed class TinySlmConversionTool
{
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromMinutes(10);
    private readonly string _toolPath;
    private readonly TimeSpan _timeout;

    /// <summary>Creates a conversion wrapper for an explicit tinyrustlm-slm-pack executable path.</summary>
    public TinySlmConversionTool(string toolPath, TimeSpan? timeout = null)
    {
        if (string.IsNullOrWhiteSpace(toolPath))
        {
            throw new ArgumentException("Tool path is required.", nameof(toolPath));
        }
        if (!File.Exists(toolPath))
        {
            throw new FileNotFoundException("TinyRustLM conversion tool was not found.", toolPath);
        }

        _toolPath = Path.GetFullPath(toolPath);
        _timeout = timeout ?? DefaultTimeout;
        if (_timeout <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(timeout), "Timeout must be greater than zero.");
        }
    }

    /// <summary>Creates a wrapper for the conversion executable bundled in the NuGet package layout.</summary>
    public static TinySlmConversionTool FromPackageLayout(TimeSpan? timeout = null)
    {
        var assemblyPath = Assembly.GetExecutingAssembly().Location;
        if (string.IsNullOrWhiteSpace(assemblyPath))
        {
            throw new InvalidOperationException("Cannot locate the TinyRustLM.Conversion assembly on disk.");
        }

        var rid = OperatingSystem.IsWindows() ? "win-x64" : "linux-x64";
        var toolFileName = OperatingSystem.IsWindows() ? "tinyrustlm-slm-pack.exe" : "tinyrustlm-slm-pack";
        var outputToolPath = Path.Combine(AppContext.BaseDirectory, "tinyrustlm", "tools", rid, toolFileName);
        if (File.Exists(outputToolPath))
        {
            return new TinySlmConversionTool(outputToolPath, timeout);
        }

        var packageRoot = LocatePackageRoot(Path.GetDirectoryName(assemblyPath)!);
        var toolPath = Path.Combine(packageRoot, "tools", rid, toolFileName);
        return new TinySlmConversionTool(toolPath, timeout);
    }

    /// <summary>Validates a produced .slm artifact using the Rust validator.</summary>
    public SlmConversionCommandResult ValidateSlm(string slmPath) =>
        Run("validate", RequirePath(slmPath, nameof(slmPath)));

    /// <summary>Inspects a Hugging Face conversion-request JSON document without converting model bytes.</summary>
    public SlmConversionCommandResult InspectHuggingFaceConversionRequest(
        string requestJsonPath,
        string? outputReportPath = null)
    {
        var arguments = new List<string>
        {
            "inspect-huggingface-conversion-request",
            RequirePath(requestJsonPath, nameof(requestJsonPath))
        };
        if (!string.IsNullOrWhiteSpace(outputReportPath))
        {
            arguments.Add(Path.GetFullPath(outputReportPath));
        }

        return Run(arguments);
    }

    /// <summary>Runs a local Hugging Face request conversion through tinyrustlm-slm-pack.</summary>
    public SlmConversionCommandResult ConvertHuggingFaceRequest(HuggingFaceSlmConversionOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        return Run(
            "convert-huggingface-request",
            RequirePath(options.RequestJsonPath, nameof(options.RequestJsonPath)),
            RequirePath(options.InputSafetensorsPathOrDirectory, nameof(options.InputSafetensorsPathOrDirectory)),
            RequireValue(options.OutputDirectory, nameof(options.OutputDirectory)),
            RequireValue(options.SourceShape, nameof(options.SourceShape)),
            RequireValue(options.Quantization, nameof(options.Quantization)));
    }

    /// <summary>Inspects a GGUF source model and writes an optional report sidecar.</summary>
    public SlmConversionCommandResult InspectGguf(string inputGgufPath, string? outputReportPath = null)
    {
        var arguments = new List<string>
        {
            "inspect-gguf",
            RequirePath(inputGgufPath, nameof(inputGgufPath))
        };
        if (!string.IsNullOrWhiteSpace(outputReportPath))
        {
            arguments.Add(Path.GetFullPath(outputReportPath));
        }

        return Run(arguments);
    }

    /// <summary>Runs a local GGUF conversion through tinyrustlm-slm-pack.</summary>
    public SlmConversionCommandResult ConvertGguf(GgufSlmConversionOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        return Run(
            "convert-gguf-trained",
            RequirePath(options.InputGgufPath, nameof(options.InputGgufPath)),
            RequireValue(options.SourceShape, nameof(options.SourceShape)),
            RequireValue(options.OutputSourceDirectory, nameof(options.OutputSourceDirectory)),
            RequireValue(options.OutputSlmPath, nameof(options.OutputSlmPath)),
            RequireValue(options.Quantization, nameof(options.Quantization)));
    }

    /// <summary>Inspects conversion receipt sidecars after a Hugging Face conversion.</summary>
    public SlmConversionCommandResult InspectHuggingFaceConversionReceipt(
        string receiptPath,
        string requestJsonPath,
        string preflightPath,
        string outputSlmPath,
        string outputManifestPath) =>
        Run(
            "inspect-huggingface-conversion-receipt",
            RequirePath(receiptPath, nameof(receiptPath)),
            RequirePath(requestJsonPath, nameof(requestJsonPath)),
            RequirePath(preflightPath, nameof(preflightPath)),
            RequirePath(outputSlmPath, nameof(outputSlmPath)),
            RequirePath(outputManifestPath, nameof(outputManifestPath)));

    private static string LocatePackageRoot(string startDirectory)
    {
        var current = new DirectoryInfo(startDirectory);
        while (current is not null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "tools")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException("Could not locate the TinyRustLM.Conversion package root with a tools directory.");
    }

    private SlmConversionCommandResult Run(params string[] arguments) => Run((IReadOnlyList<string>)arguments);

    private SlmConversionCommandResult Run(IReadOnlyList<string> arguments)
    {
        var command = string.Join(" ", arguments.Select(argument => argument.Contains(' ') ? $"\"{argument}\"" : argument));
        var startInfo = new ProcessStartInfo
        {
            FileName = _toolPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        var stopwatch = Stopwatch.StartNew();
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Failed to start TinyRustLM conversion tool.");
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        var timeoutMilliseconds = _timeout.TotalMilliseconds >= int.MaxValue
            ? int.MaxValue
            : Math.Max(1, (int)Math.Ceiling(_timeout.TotalMilliseconds));
        if (!process.WaitForExit(timeoutMilliseconds))
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
            }

            throw new TimeoutException($"TinyRustLM conversion command timed out after {_timeout}.");
        }

        var standardOutput = outputTask.GetAwaiter().GetResult();
        var standardError = errorTask.GetAwaiter().GetResult();
        stopwatch.Stop();
        return new SlmConversionCommandResult(
            process.ExitCode,
            standardOutput,
            standardError,
            $"{_toolPath} {command}",
            stopwatch.Elapsed);
    }

    private static string RequirePath(string value, string parameterName)
    {
        var path = RequireValue(value, parameterName);
        return Path.GetFullPath(path);
    }

    private static string RequireValue(string value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value is required.", parameterName);
        }
        if (value.Contains('\0'))
        {
            throw new ArgumentException("Value must not contain embedded NUL characters.", parameterName);
        }

        return value;
    }
}
