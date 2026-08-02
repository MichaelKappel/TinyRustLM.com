using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace TinyRustLM.SeedHost;

/// <summary>Configuration for independent MiniModel seed-lane processes.</summary>
public sealed record SeedFleetProcessOptions(
    string? MiniModelExecutablePath = null,
    TimeSpan? StartupTimeout = null,
    TimeSpan? ShutdownTimeout = null,
    TimeSpan? ProbeInterval = null,
    int MaximumDiagnosticBytes = 64 * 1024,
    int MaximumProbeResponseBytes = 1024 * 1024);

/// <summary>Observable lifecycle state for one independent seed-lane process.</summary>
public enum SeedLaneProcessState
{
    /// <summary>The lane has no active process.</summary>
    Stopped,

    /// <summary>The process is running but local readiness is not yet proven.</summary>
    Starting,

    /// <summary>Every enabled endpoint is locally reachable.</summary>
    Ready,

    /// <summary>An owned graceful shutdown has been requested.</summary>
    Stopping,

    /// <summary>The lane exited or failed validation unexpectedly.</summary>
    Failed
}

/// <summary>Safe process and readiness status for one seed lane.</summary>
public sealed record SeedLaneProcessStatus(
    string LaneId,
    SeedLaneProcessState State,
    int? ProcessId,
    DateTimeOffset? StartedAtUtc,
    int? ExitCode,
    int LocalEndpointCount,
    bool GracefulShutdown,
    string? ErrorCode,
    string DiagnosticSummary);

/// <summary>
/// Starts and stops two independent MiniModel lane processes over one read-only piece store.
/// Public methods are serialized; cancellation cleans up a partially started or stopping process.
/// </summary>
public sealed class SeedFleetProcessSupervisor : IAsyncDisposable
{
    private const string RuntimeDirectoryName = ".seed-host-runtime";
    private const string PeerStatusRoute = "minimodel.peer_status.v0.json";
    private readonly SeedFleetProcessOptions options;
    private readonly IMiniModelAuthority authority;
    private readonly ILogger<SeedFleetProcessSupervisor> logger;
    private readonly TimeProvider timeProvider;
    private readonly HttpClient httpClient;
    private readonly SemaphoreSlim lifecycleLock = new(1, 1);
    private readonly Dictionary<string, LaneRegistration> active = new(StringComparer.Ordinal);
    private readonly Dictionary<string, SeedLaneProcessStatus> latest = new(StringComparer.Ordinal);
    private readonly object statusGate = new();
    private bool disposed;

    /// <summary>Create a supervisor with an isolated, credential-free local health client.</summary>
    public SeedFleetProcessSupervisor(
        SeedFleetProcessOptions options,
        IMiniModelAuthority authority,
        ILogger<SeedFleetProcessSupervisor>? logger = null,
        TimeProvider? timeProvider = null)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(authority);
        ValidateOptions(options);
        this.options = options;
        this.authority = authority;
        this.logger = logger ?? NullLogger<SeedFleetProcessSupervisor>.Instance;
        this.timeProvider = timeProvider ?? TimeProvider.System;
        httpClient = new HttpClient(new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            ConnectTimeout = TimeSpan.FromSeconds(1),
            UseCookies = false,
            UseProxy = false
        })
        {
            Timeout = Timeout.InfiniteTimeSpan
        };
    }

    /// <summary>Validate the fleet and start one lane, returning only after local readiness.</summary>
    public async Task<SeedLaneProcessStatus> StartLaneAsync(
        string configurationPath,
        string laneId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        ArgumentException.ThrowIfNullOrWhiteSpace(configurationPath);
        ArgumentException.ThrowIfNullOrWhiteSpace(laneId);
        await lifecycleLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (active.TryGetValue(laneId, out var existing) && !existing.Process.HasExited)
            {
                throw new SeedHostException(
                    "lane_already_running",
                    $"Seed lane '{laneId}' already has an active process.");
            }
            if (existing is not null)
            {
                active.Remove(laneId);
                await existing.Process.DisposeAsync().ConfigureAwait(false);
            }

            var absoluteConfigurationPath = RequireRegularConfiguration(configurationPath);
            cancellationToken.ThrowIfCancellationRequested();
            _ = authority.InspectSeedFleet(absoluteConfigurationPath);
            cancellationToken.ThrowIfCancellationRequested();
            var configuration = SeedFleetConfiguration.Parse(
                await File.ReadAllTextAsync(absoluteConfigurationPath, cancellationToken)
                    .ConfigureAwait(false));
            var lane = configuration.Lanes.SingleOrDefault(candidate =>
                string.Equals(candidate.LaneId, laneId, StringComparison.Ordinal))
                ?? throw new SeedHostValidationException(
                    "lane_not_found",
                    $"Fleet does not contain lane '{laneId}'.");
            var enabledModels = configuration.Models
                .Where(model => model.Enabled)
                .Select(model => model.ModelId)
                .ToHashSet(StringComparer.Ordinal);
            var enabledEndpoints = lane.Endpoints
                .Where(endpoint => enabledModels.Contains(endpoint.ModelId))
                .ToArray();
            if (enabledEndpoints.Length == 0)
            {
                throw new SeedHostValidationException(
                    "lane_has_no_enabled_endpoints",
                    $"Seed lane '{laneId}' has no enabled model endpoint.");
            }

            var fleetRoot = Path.GetDirectoryName(absoluteConfigurationPath)
                ?? throw new SeedHostValidationException(
                    "invalid_fleet_root",
                    "Fleet configuration must have a parent directory.");
            var runtimeDirectory = Path.Combine(fleetRoot, RuntimeDirectoryName);
            EnsureOwnedRuntimeDirectory(runtimeDirectory);
            var shutdownPath = Path.Combine(runtimeDirectory, $"{laneId}.shutdown");
            RemoveStaleShutdownSignal(shutdownPath);
            var executable = MiniModelExecutableLocator.Resolve(options.MiniModelExecutablePath);
            var process = OwnedMiniModelProcess.Start(
                new ProcessCommand(
                    executable,
                    ["serve-seed-lane", absoluteConfigurationPath, laneId, shutdownPath],
                    fleetRoot),
                options.MaximumDiagnosticBytes);
            var registration = new LaneRegistration(
                laneId,
                absoluteConfigurationPath,
                shutdownPath,
                process,
                enabledEndpoints.Length,
                timeProvider.GetUtcNow());
            active.Add(laneId, registration);
            SetLatest(registration.Status(SeedLaneProcessState.Starting));
            logger.LogInformation(
                "MiniModel seed lane {LaneId} process {ProcessId} is starting.",
                laneId,
                process.ProcessId);
            try
            {
                await WaitForReadinessAsync(registration, enabledEndpoints, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch
            {
                await StopRegistrationAfterFailedStartAsync(registration).ConfigureAwait(false);
                active.Remove(laneId);
                throw;
            }

            registration.State = SeedLaneProcessState.Ready;
            registration.GracefulShutdown = false;
            SetLatest(registration.Status(SeedLaneProcessState.Ready));
            logger.LogInformation(
                "MiniModel seed lane {LaneId} is locally ready on {EndpointCount} endpoint(s).",
                laneId,
                enabledEndpoints.Length);
            registration.MonitorTask = MonitorUnexpectedExitAsync(registration);
            return registration.Status(SeedLaneProcessState.Ready);
        }
        finally
        {
            lifecycleLock.Release();
        }
    }

    /// <summary>Start both configured lanes as separate processes in stable lane-ID order.</summary>
    public async Task<IReadOnlyList<SeedLaneProcessStatus>> StartAllAsync(
        string configurationPath,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var absolutePath = RequireRegularConfiguration(configurationPath);
        var configuration = SeedFleetConfiguration.Parse(
            await File.ReadAllTextAsync(absolutePath, cancellationToken).ConfigureAwait(false));
        var results = new List<SeedLaneProcessStatus>(configuration.Lanes.Count);
        foreach (var lane in configuration.Lanes.OrderBy(value => value.LaneId, StringComparer.Ordinal))
        {
            results.Add(await StartLaneAsync(absolutePath, lane.LaneId, cancellationToken)
                .ConfigureAwait(false));
        }
        return results;
    }

    /// <summary>Gracefully stop one lane without changing any other lane process.</summary>
    public async Task<SeedLaneProcessStatus> StopLaneAsync(
        string laneId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        ArgumentException.ThrowIfNullOrWhiteSpace(laneId);
        await lifecycleLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!active.TryGetValue(laneId, out var registration))
            {
                lock (statusGate)
                {
                    if (latest.TryGetValue(laneId, out var previous)
                        && previous.State is SeedLaneProcessState.Stopped or SeedLaneProcessState.Failed)
                    {
                        return previous;
                    }
                }
                var stopped = new SeedLaneProcessStatus(
                    laneId,
                    SeedLaneProcessState.Stopped,
                    null,
                    null,
                    null,
                    0,
                    GracefulShutdown: true,
                    ErrorCode: null,
                    DiagnosticSummary: string.Empty);
                SetLatest(stopped);
                return stopped;
            }
            registration.State = SeedLaneProcessState.Stopping;
            SetLatest(registration.Status(SeedLaneProcessState.Stopping));
            var result = await StopRegistrationAsync(registration, cancellationToken)
                .ConfigureAwait(false);
            active.Remove(laneId);
            SetLatest(result);
            return result;
        }
        finally
        {
            lifecycleLock.Release();
        }
    }

    /// <summary>Return a stable snapshot without exposing command arguments or unredacted output.</summary>
    public IReadOnlyList<SeedLaneProcessStatus> GetStatuses()
    {
        ThrowIfDisposed();
        lock (statusGate)
        {
            return latest.Values
                .OrderBy(status => status.LaneId, StringComparer.Ordinal)
                .ToArray();
        }
    }

    private async Task WaitForReadinessAsync(
        LaneRegistration registration,
        IReadOnlyList<SeedFleetEndpoint> enabledEndpoints,
        CancellationToken cancellationToken)
    {
        var deadline = timeProvider.GetUtcNow() + EffectiveStartupTimeout;
        var probes = enabledEndpoints
            .Select(endpoint => new LocalProbe(
                endpoint.ModelId,
                BuildLocalStatusUri(endpoint)))
            .ToArray();
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (registration.Process.HasExited)
            {
                var exitCode = registration.Process.ExitCode;
                throw new SeedHostException(
                    "lane_start_failed",
                    $"MiniModel seed lane '{registration.LaneId}' exited with code {exitCode} before readiness. "
                    + registration.Process.GetSafeDiagnostics());
            }
            var allReady = true;
            foreach (var probe in probes)
            {
                if (!await ProbeEndpointAsync(probe, cancellationToken).ConfigureAwait(false))
                {
                    allReady = false;
                }
            }
            if (allReady)
            {
                return;
            }
            if (timeProvider.GetUtcNow() >= deadline)
            {
                throw new SeedHostException(
                    "lane_startup_timeout",
                    $"MiniModel seed lane '{registration.LaneId}' did not become locally ready within {EffectiveStartupTimeout}.");
            }
            await Task.Delay(EffectiveProbeInterval, timeProvider, cancellationToken)
                .ConfigureAwait(false);
        }
    }

    private async Task<bool> ProbeEndpointAsync(LocalProbe probe, CancellationToken cancellationToken)
    {
        using var attempt = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        attempt.CancelAfter(TimeSpan.FromSeconds(1));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, probe.Uri);
            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                attempt.Token).ConfigureAwait(false);
            var contentLength = response.Content.Headers.ContentLength;
            if (response.StatusCode != HttpStatusCode.OK
                || contentLength is not long boundedContentLength
                || boundedContentLength <= 0
                || boundedContentLength > options.MaximumProbeResponseBytes)
            {
                return false;
            }
            await using var stream = await response.Content.ReadAsStreamAsync(attempt.Token)
                .ConfigureAwait(false);
            using var memory = new MemoryStream(
                checked((int)Math.Min(
                    boundedContentLength,
                    options.MaximumProbeResponseBytes)));
            var buffer = new byte[8192];
            var total = 0;
            while (true)
            {
                var read = await stream.ReadAsync(buffer, attempt.Token).ConfigureAwait(false);
                if (read == 0)
                {
                    break;
                }
                total = checked(total + read);
                if (total > options.MaximumProbeResponseBytes)
                {
                    return false;
                }
                await memory.WriteAsync(buffer.AsMemory(0, read), attempt.Token)
                    .ConfigureAwait(false);
            }
            using var document = JsonDocument.Parse(memory.ToArray());
            var root = document.RootElement;
            return root.TryGetProperty("status_kind", out var kind)
                && string.Equals(
                    kind.GetString(),
                    "minimodel.peer_status",
                    StringComparison.Ordinal)
                && root.TryGetProperty("model_id", out var modelId)
                && string.Equals(modelId.GetString(), probe.ModelId, StringComparison.Ordinal);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return false;
        }
        catch (Exception error) when (
            error is HttpRequestException or IOException or JsonException)
        {
            return false;
        }
    }

    private async Task<SeedLaneProcessStatus> StopRegistrationAsync(
        LaneRegistration registration,
        CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Stopping MiniModel seed lane {LaneId} process {ProcessId}.",
            registration.LaneId,
            registration.Process.ProcessId);
        WriteShutdownSignal(registration.ShutdownPath);
        using var timeout = new CancellationTokenSource(EffectiveShutdownTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeout.Token);
        var forced = false;
        int exitCode;
        try
        {
            exitCode = await registration.Process.WaitForExitAsync(linked.Token)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            forced = true;
            await registration.Process.KillAsync().ConfigureAwait(false);
            exitCode = registration.Process.ExitCode ?? -1;
        }
        finally
        {
            RemoveOwnedShutdownSignal(registration.ShutdownPath);
        }
        var diagnostics = registration.Process.GetSafeDiagnostics();
        await registration.Process.DisposeAsync().ConfigureAwait(false);
        registration.GracefulShutdown = !forced && exitCode == 0;
        registration.ExitCode = exitCode;
        registration.State = registration.GracefulShutdown
            ? SeedLaneProcessState.Stopped
            : SeedLaneProcessState.Failed;
        registration.ErrorCode = registration.GracefulShutdown
            ? null
            : forced
                ? "lane_shutdown_timeout"
                : "lane_shutdown_failed";
        registration.Diagnostics = diagnostics;
        var status = registration.Status(registration.State);
        if (cancellationToken.IsCancellationRequested)
        {
            SetLatest(status);
            active.Remove(registration.LaneId);
            throw new OperationCanceledException(cancellationToken);
        }
        return status;
    }

    private async Task StopRegistrationAfterFailedStartAsync(LaneRegistration registration)
    {
        try
        {
            WriteShutdownSignal(registration.ShutdownPath);
            using var timeout = new CancellationTokenSource(EffectiveShutdownTimeout);
            try
            {
                _ = await registration.Process.WaitForExitAsync(timeout.Token)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                await registration.Process.KillAsync().ConfigureAwait(false);
            }
        }
        finally
        {
            RemoveOwnedShutdownSignal(registration.ShutdownPath);
            registration.State = SeedLaneProcessState.Failed;
            registration.ExitCode = registration.Process.ExitCode;
            registration.ErrorCode = "lane_start_failed";
            registration.Diagnostics = registration.Process.GetSafeDiagnostics();
            SetLatest(registration.Status(SeedLaneProcessState.Failed));
            await registration.Process.DisposeAsync().ConfigureAwait(false);
        }
    }

    private async Task MonitorUnexpectedExitAsync(LaneRegistration registration)
    {
        try
        {
            var exitCode = await registration.Process.WaitForExitAsync(CancellationToken.None)
                .ConfigureAwait(false);
            await lifecycleLock.WaitAsync().ConfigureAwait(false);
            try
            {
                if (!active.TryGetValue(registration.LaneId, out var current)
                    || !ReferenceEquals(current, registration)
                    || registration.State == SeedLaneProcessState.Stopping)
                {
                    return;
                }
                registration.ExitCode = exitCode;
                registration.State = SeedLaneProcessState.Failed;
                registration.ErrorCode = "lane_exited_unexpectedly";
                registration.Diagnostics = registration.Process.GetSafeDiagnostics();
                active.Remove(registration.LaneId);
                SetLatest(registration.Status(SeedLaneProcessState.Failed));
                logger.LogError(
                    "MiniModel seed lane {LaneId} exited unexpectedly with code {ExitCode}.",
                    registration.LaneId,
                    exitCode);
                await registration.Process.DisposeAsync().ConfigureAwait(false);
            }
            finally
            {
                lifecycleLock.Release();
            }
        }
        catch (ObjectDisposedException)
        {
            // An intentional stop disposed the process after its monitor completed.
        }
    }

    private static Uri BuildLocalStatusUri(SeedFleetEndpoint endpoint)
    {
        var bind = IPEndPoint.Parse(endpoint.BindAddress);
        var address = bind.Address;
        if (address.Equals(IPAddress.Any))
        {
            address = IPAddress.Loopback;
        }
        else if (address.Equals(IPAddress.IPv6Any))
        {
            address = IPAddress.IPv6Loopback;
        }
        var publicBase = new Uri(endpoint.PublicBaseUrl, UriKind.Absolute);
        var builder = new UriBuilder(publicBase)
        {
            Host = address.ToString(),
            Port = bind.Port
        };
        var localBase = builder.Uri.AbsoluteUri.EndsWith("/", StringComparison.Ordinal)
            ? builder.Uri
            : new Uri(builder.Uri.AbsoluteUri + '/', UriKind.Absolute);
        return new Uri(localBase, PeerStatusRoute);
    }

    private static string RequireRegularConfiguration(string path)
    {
        if (path.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "invalid_configuration_path",
                "Fleet configuration path cannot contain an embedded NUL character.");
        }
        var absolute = Path.GetFullPath(path);
        var information = new FileInfo(absolute);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "invalid_configuration_path",
                "Fleet configuration must be a regular non-link file.");
        }
        return absolute;
    }

    private static void EnsureOwnedRuntimeDirectory(string path)
    {
        Directory.CreateDirectory(path);
        var information = new DirectoryInfo(path);
        if ((information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "unsafe_runtime_directory",
                "Seed-host runtime directory must not be a link or reparse point.");
        }
    }

    private static void RemoveStaleShutdownSignal(string path)
    {
        if (!File.Exists(path) && !Directory.Exists(path))
        {
            return;
        }
        RemoveOwnedShutdownSignal(path);
    }

    private static void RemoveOwnedShutdownSignal(string path)
    {
        if (!File.Exists(path) && !Directory.Exists(path))
        {
            return;
        }
        var information = new FileInfo(path);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "unsafe_shutdown_signal",
                "Seed lane shutdown signal must be an owned regular non-link file.");
        }
        File.Delete(path);
    }

    private static void WriteShutdownSignal(string path)
    {
        try
        {
            using var stream = new FileStream(
                path,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                4096,
                FileOptions.WriteThrough);
            stream.Write("stop\n"u8);
            stream.Flush(flushToDisk: true);
        }
        catch (IOException error)
        {
            throw new SeedHostException(
                "shutdown_signal_failed",
                "Could not create the owned seed-lane shutdown signal.",
                error);
        }
    }

    private static void ValidateOptions(SeedFleetProcessOptions options)
    {
        ValidateDuration(options.StartupTimeout, TimeSpan.FromSeconds(30), "startup_timeout");
        ValidateDuration(options.ShutdownTimeout, TimeSpan.FromSeconds(10), "shutdown_timeout");
        ValidateDuration(options.ProbeInterval, TimeSpan.FromMilliseconds(100), "probe_interval");
        if (options.MaximumDiagnosticBytes is < 1024 or > 1024 * 1024)
        {
            throw new SeedHostValidationException(
                "invalid_diagnostic_limit",
                "MaximumDiagnosticBytes must be between 1 KiB and 1 MiB.");
        }
        if (options.MaximumProbeResponseBytes is < 1024 or > 4 * 1024 * 1024)
        {
            throw new SeedHostValidationException(
                "invalid_probe_limit",
                "MaximumProbeResponseBytes must be between 1 KiB and 4 MiB.");
        }
    }

    private static void ValidateDuration(TimeSpan? value, TimeSpan defaultValue, string label)
    {
        var duration = value ?? defaultValue;
        if (duration < TimeSpan.FromMilliseconds(10) || duration > TimeSpan.FromMinutes(10))
        {
            throw new SeedHostValidationException(
                $"invalid_{label}",
                $"{label} must be between 10 milliseconds and 10 minutes.");
        }
    }

    private TimeSpan EffectiveStartupTimeout => options.StartupTimeout ?? TimeSpan.FromSeconds(30);
    private TimeSpan EffectiveShutdownTimeout => options.ShutdownTimeout ?? TimeSpan.FromSeconds(10);
    private TimeSpan EffectiveProbeInterval => options.ProbeInterval ?? TimeSpan.FromMilliseconds(100);

    private void SetLatest(SeedLaneProcessStatus status)
    {
        lock (statusGate)
        {
            latest[status.LaneId] = status;
        }
    }

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(disposed, this);
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (disposed)
        {
            return;
        }
        await lifecycleLock.WaitAsync().ConfigureAwait(false);
        try
        {
            foreach (var registration in active.Values.ToArray())
            {
                try
                {
                    _ = await StopRegistrationAsync(registration, CancellationToken.None)
                        .ConfigureAwait(false);
                }
                catch (SeedHostException)
                {
                    await registration.Process.KillAsync().ConfigureAwait(false);
                    await registration.Process.DisposeAsync().ConfigureAwait(false);
                }
            }
            active.Clear();
            disposed = true;
            httpClient.Dispose();
        }
        finally
        {
            lifecycleLock.Release();
            lifecycleLock.Dispose();
        }
    }

    private sealed record LocalProbe(string ModelId, Uri Uri);

    private sealed class LaneRegistration
    {
        internal LaneRegistration(
            string laneId,
            string configurationPath,
            string shutdownPath,
            OwnedMiniModelProcess process,
            int endpointCount,
            DateTimeOffset startedAtUtc)
        {
            LaneId = laneId;
            ConfigurationPath = configurationPath;
            ShutdownPath = shutdownPath;
            Process = process;
            EndpointCount = endpointCount;
            StartedAtUtc = startedAtUtc;
        }

        internal string LaneId { get; }
        internal string ConfigurationPath { get; }
        internal string ShutdownPath { get; }
        internal OwnedMiniModelProcess Process { get; }
        internal int EndpointCount { get; }
        internal DateTimeOffset StartedAtUtc { get; }
        internal SeedLaneProcessState State { get; set; } = SeedLaneProcessState.Starting;
        internal int? ExitCode { get; set; }
        internal bool GracefulShutdown { get; set; }
        internal string? ErrorCode { get; set; }
        internal string Diagnostics { get; set; } = string.Empty;
        internal Task? MonitorTask { get; set; }

        internal SeedLaneProcessStatus Status(SeedLaneProcessState state) => new(
            LaneId,
            state,
            Process.ProcessId,
            StartedAtUtc,
            ExitCode,
            EndpointCount,
            GracefulShutdown,
            ErrorCode,
            Diagnostics);
    }
}
