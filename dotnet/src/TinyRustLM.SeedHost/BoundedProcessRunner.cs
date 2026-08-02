using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace TinyRustLM.SeedHost;

internal sealed record ProcessCommand(
    string FileName,
    IReadOnlyList<string> Arguments,
    string? WorkingDirectory = null);

internal sealed record ProcessRunOptions(
    TimeSpan Timeout,
    int MaximumCapturedBytes);

internal sealed record ProcessRunResult(
    int ExitCode,
    string StandardOutput,
    string StandardError,
    TimeSpan Elapsed,
    bool OutputTruncated);

/// <summary>Runs one argument-list command with bounded diagnostics and hard cancellation.</summary>
internal static class BoundedProcessRunner
{
    internal static async Task<ProcessRunResult> RunAsync(
        ProcessCommand command,
        ProcessRunOptions options,
        CancellationToken cancellationToken)
    {
        Validate(command, options);
        cancellationToken.ThrowIfCancellationRequested();

        using var process = new Process
        {
            StartInfo = CreateStartInfo(command),
            EnableRaisingEvents = true
        };
        try
        {
            if (!process.Start())
            {
                throw new SeedHostException(
                    "process_start_failed",
                    "MiniModel process did not start.");
            }
        }
        catch (Exception error) when (error is Win32Exception or InvalidOperationException)
        {
            throw new SeedHostException(
                "process_start_failed",
                "MiniModel process could not be started from the reviewed executable path.",
                error);
        }

        var standardOutput = new BoundedStreamCapture(options.MaximumCapturedBytes);
        var standardError = new BoundedStreamCapture(options.MaximumCapturedBytes);
        var outputPump = standardOutput.PumpAsync(process.StandardOutput.BaseStream);
        var errorPump = standardError.PumpAsync(process.StandardError.BaseStream);
        var stopwatch = Stopwatch.StartNew();
        using var timeout = new CancellationTokenSource(options.Timeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeout.Token);
        try
        {
            await process.WaitForExitAsync(linked.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            KillProcessTree(process);
            await WaitAfterKillAsync(process).ConfigureAwait(false);
            await Task.WhenAll(outputPump, errorPump).ConfigureAwait(false);
            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(cancellationToken);
            }
            throw new SeedHostException(
                "process_timeout",
                $"MiniModel process exceeded its {options.Timeout} execution limit.");
        }

        await Task.WhenAll(outputPump, errorPump).ConfigureAwait(false);
        stopwatch.Stop();
        return new ProcessRunResult(
            process.ExitCode,
            standardOutput.GetRedactedText(),
            standardError.GetRedactedText(),
            stopwatch.Elapsed,
            standardOutput.Truncated || standardError.Truncated);
    }

    internal static ProcessStartInfo CreateStartInfo(ProcessCommand command)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = command.FileName,
            WorkingDirectory = command.WorkingDirectory ?? string.Empty,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = false
        };
        foreach (var argument in command.Arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }
        return startInfo;
    }

    internal static void KillProcessTree(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (Exception error) when (
            error is InvalidOperationException or NotSupportedException or Win32Exception)
        {
            // The process either exited concurrently or the platform already reclaimed it.
        }
    }

    private static async Task WaitAfterKillAsync(Process process)
    {
        try
        {
            await process.WaitForExitAsync().ConfigureAwait(false);
        }
        catch (InvalidOperationException)
        {
            // A concurrently reaped process is already stopped.
        }
    }

    internal static void Validate(ProcessCommand command, ProcessRunOptions options)
    {
        ArgumentNullException.ThrowIfNull(command);
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrWhiteSpace(command.FileName) || command.FileName.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "invalid_process_file_name",
                "A NUL-free executable path is required.");
        }
        if (command.Arguments is null || command.Arguments.Count > 256)
        {
            throw new SeedHostValidationException(
                "invalid_process_arguments",
                "A MiniModel command may contain at most 256 arguments.");
        }
        if (command.Arguments.Any(argument =>
            argument is null || argument.Length > 32_768 || argument.Contains('\0')))
        {
            throw new SeedHostValidationException(
                "invalid_process_arguments",
                "MiniModel arguments must be bounded NUL-free strings.");
        }
        if (command.WorkingDirectory is not null
            && (!Directory.Exists(command.WorkingDirectory)
                || command.WorkingDirectory.Contains('\0')))
        {
            throw new SeedHostValidationException(
                "invalid_working_directory",
                "The process working directory must be an existing NUL-free directory.");
        }
        if (options.Timeout <= TimeSpan.Zero || options.Timeout > TimeSpan.FromDays(1))
        {
            throw new SeedHostValidationException(
                "invalid_process_timeout",
                "Process timeout must be greater than zero and no more than one day.");
        }
        if (options.MaximumCapturedBytes is < 1024 or > 1024 * 1024)
        {
            throw new SeedHostValidationException(
                "invalid_diagnostic_limit",
                "Captured process diagnostics must be limited to 1 KiB through 1 MiB per stream.");
        }
    }
}

/// <summary>Captures a prefix while continuously draining the complete child stream.</summary>
internal sealed class BoundedStreamCapture
{
    private readonly byte[] captured;
    private readonly object gate = new();
    private int length;

    internal BoundedStreamCapture(int maximumBytes)
    {
        captured = new byte[maximumBytes];
    }

    internal bool Truncated { get; private set; }

    internal async Task PumpAsync(Stream source)
    {
        var buffer = new byte[8192];
        while (true)
        {
            var read = await source.ReadAsync(buffer).ConfigureAwait(false);
            if (read == 0)
            {
                return;
            }
            lock (gate)
            {
                var writable = Math.Min(read, captured.Length - length);
                if (writable > 0)
                {
                    Buffer.BlockCopy(buffer, 0, captured, length, writable);
                    length += writable;
                }
                if (writable != read)
                {
                    Truncated = true;
                }
            }
        }
    }

    internal string GetRedactedText()
    {
        lock (gate)
        {
            var text = Encoding.UTF8.GetString(captured, 0, length);
            if (Truncated)
            {
                text += Environment.NewLine + "[diagnostics truncated]";
            }
            return SeedHostDiagnosticsRedactor.Redact(text);
        }
    }
}

/// <summary>Removes common secret fields and URI user-info from safe diagnostics.</summary>
internal static partial class SeedHostDiagnosticsRedactor
{
    internal static string Redact(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }
        var redacted = UrlUserInfoRegex().Replace(value, "$1[REDACTED]@");
        redacted = SecretQueryRegex().Replace(redacted, "$1[REDACTED]");
        return SecretFieldRegex().Replace(redacted, "$1$2[REDACTED]");
    }

    [GeneratedRegex(
        @"(?i)\b(https?://)[^/\s@]+@",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking)]
    private static partial Regex UrlUserInfoRegex();

    [GeneratedRegex(
        @"(?i)([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)=)[^&#\s]*",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking)]
    private static partial Regex SecretQueryRegex();

    [GeneratedRegex(
        """(?i)\b(authorization|proxy-authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)""",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking)]
    private static partial Regex SecretFieldRegex();
}
