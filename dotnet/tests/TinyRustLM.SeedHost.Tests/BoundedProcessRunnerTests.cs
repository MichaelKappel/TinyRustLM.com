using System.Diagnostics;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class BoundedProcessRunnerTests
{
    [Fact]
    public async Task CancellationTerminatesThePendingProcess()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-host-process-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        var pidPath = Path.Combine(root, "child.pid");
        try
        {
            var command = SleepingCommand(pidPath);
            using var cancellation = new CancellationTokenSource();
            var runTask = BoundedProcessRunner.RunAsync(
                command,
                new ProcessRunOptions(TimeSpan.FromMinutes(1), 4096),
                cancellation.Token);

            await WaitForFileAsync(pidPath, TimeSpan.FromSeconds(10));
            var pid = int.Parse(await File.ReadAllTextAsync(pidPath));
            cancellation.Cancel();

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => runTask);
            await WaitForProcessExitAsync(pid, TimeSpan.FromSeconds(10));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void DiagnosticRedactionRemovesSecretsAndUrlUserInfo()
    {
        const string raw =
            "authorization=Bearer-secret token:abc123 password=hunter2 "
            + "https://alice:private@example.test/path?api_key=query-secret";

        var redacted = SeedHostDiagnosticsRedactor.Redact(raw);

        Assert.DoesNotContain("Bearer-secret", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("abc123", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("hunter2", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("alice:private", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("query-secret", redacted, StringComparison.Ordinal);
        Assert.Contains("[REDACTED]", redacted, StringComparison.Ordinal);
    }

    private static ProcessCommand SleepingCommand(string pidPath)
    {
        if (OperatingSystem.IsWindows())
        {
            var escapedPath = pidPath.Replace("'", "''", StringComparison.Ordinal);
            return new ProcessCommand(
                "powershell.exe",
                [
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    $"[IO.File]::WriteAllText('{escapedPath}', [string]$PID); Start-Sleep -Seconds 60"
                ],
                Path.GetDirectoryName(pidPath));
        }

        return new ProcessCommand(
            "/bin/sh",
            ["-c", "printf '%s' \"$$\" > \"$1\"; sleep 60", "seed-host-test", pidPath],
            Path.GetDirectoryName(pidPath));
    }

    private static async Task WaitForFileAsync(string path, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (!File.Exists(path))
        {
            Assert.True(DateTime.UtcNow < deadline, "Child process did not publish its PID.");
            await Task.Delay(25);
        }
    }

    private static async Task WaitForProcessExitAsync(int pid, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var process = Process.GetProcessById(pid);
                if (process.HasExited)
                {
                    return;
                }
            }
            catch (ArgumentException)
            {
                return;
            }
            await Task.Delay(25);
        }
        Assert.Fail($"Child process {pid} remained alive after cancellation.");
    }
}
