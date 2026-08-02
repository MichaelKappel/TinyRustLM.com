using System.ComponentModel;
using System.Diagnostics;

namespace TinyRustLM.SeedHost;

/// <summary>Owns one long-running MiniModel process and its bounded stream drains.</summary>
internal sealed class OwnedMiniModelProcess : IAsyncDisposable
{
    private readonly Process process;
    private readonly BoundedStreamCapture standardOutput;
    private readonly BoundedStreamCapture standardError;
    private readonly Task outputPump;
    private readonly Task errorPump;
    private bool disposed;

    private OwnedMiniModelProcess(
        Process process,
        BoundedStreamCapture standardOutput,
        BoundedStreamCapture standardError)
    {
        this.process = process;
        this.standardOutput = standardOutput;
        this.standardError = standardError;
        outputPump = standardOutput.PumpAsync(process.StandardOutput.BaseStream);
        errorPump = standardError.PumpAsync(process.StandardError.BaseStream);
        ProcessId = process.Id;
    }

    internal int ProcessId { get; }

    internal bool HasExited
    {
        get
        {
            try
            {
                return process.HasExited;
            }
            catch (InvalidOperationException)
            {
                return true;
            }
        }
    }

    internal int? ExitCode => HasExited ? process.ExitCode : null;

    internal static OwnedMiniModelProcess Start(ProcessCommand command, int maximumCapturedBytes)
    {
        BoundedProcessRunner.Validate(
            command,
            new ProcessRunOptions(TimeSpan.FromMinutes(1), maximumCapturedBytes));
        var process = new Process
        {
            StartInfo = BoundedProcessRunner.CreateStartInfo(command),
            EnableRaisingEvents = true
        };
        try
        {
            if (!process.Start())
            {
                throw new SeedHostException(
                    "process_start_failed",
                    "MiniModel lane process did not start.");
            }
            return new OwnedMiniModelProcess(
                process,
                new BoundedStreamCapture(maximumCapturedBytes),
                new BoundedStreamCapture(maximumCapturedBytes));
        }
        catch (Exception error) when (error is Win32Exception or InvalidOperationException)
        {
            process.Dispose();
            throw new SeedHostException(
                "process_start_failed",
                "MiniModel lane process could not be started from the reviewed executable path.",
                error);
        }
    }

    internal async Task<int> WaitForExitAsync(CancellationToken cancellationToken)
    {
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        await Task.WhenAll(outputPump, errorPump).ConfigureAwait(false);
        return process.ExitCode;
    }

    internal string GetSafeDiagnostics()
    {
        var output = standardOutput.GetRedactedText().Trim();
        var error = standardError.GetRedactedText().Trim();
        if (output.Length == 0)
        {
            return error;
        }
        if (error.Length == 0)
        {
            return output;
        }
        return output + Environment.NewLine + error;
    }

    internal async Task KillAsync()
    {
        BoundedProcessRunner.KillProcessTree(process);
        try
        {
            await WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch (InvalidOperationException)
        {
            // The process was reaped concurrently.
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed)
        {
            return;
        }
        disposed = true;
        if (!HasExited)
        {
            await KillAsync().ConfigureAwait(false);
        }
        else
        {
            await Task.WhenAll(outputPump, errorPump).ConfigureAwait(false);
        }
        process.Dispose();
    }
}
