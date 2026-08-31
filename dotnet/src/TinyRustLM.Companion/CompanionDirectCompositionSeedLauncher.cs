using System.Buffers;
using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TinyRustLM.Companion;

/// <summary>One validated operator configuration for a direct-composition seed process.</summary>
public sealed class CompanionDirectCompositionSeedLaunchConfiguration
{
    /// <summary>Creates one configuration from already canonicalized endpoint values.</summary>
    private CompanionDirectCompositionSeedLaunchConfiguration(
        string bindAddress,
        string allowedBrowserOrigin,
        IPEndPoint bindEndPoint)
    {
        BindAddress = bindAddress;
        AllowedBrowserOrigin = allowedBrowserOrigin;
        BindEndPoint = bindEndPoint;
    }

    /// <summary>Gets the exact canonical numeric IP endpoint passed to the seed.</summary>
    public string BindAddress { get; }

    /// <summary>Gets the sole exact canonical HTTP(S) browser origin admitted by the seed.</summary>
    public string AllowedBrowserOrigin { get; }

    /// <summary>Gets the parsed endpoint used to verify the child's reported binding.</summary>
    internal IPEndPoint BindEndPoint { get; }

    /// <summary>Validates explicit trusted configuration without supplying any path or default.</summary>
    public static CompanionDirectCompositionSeedLaunchConfiguration Create(
        string bindAddress,
        string allowedBrowserOrigin)
    {
        var endPoint = CompanionDirectCompositionSeedLaunchValidation.ParseBindAddress(bindAddress);
        CompanionDirectCompositionSeedLaunchValidation.RequireBrowserOrigin(allowedBrowserOrigin);
        return new CompanionDirectCompositionSeedLaunchConfiguration(
            bindAddress,
            allowedBrowserOrigin,
            endPoint);
    }
}

/// <summary>Opaque, launcher-owned, single-use authority to start one verified seed process.</summary>
public sealed class CompanionDirectCompositionSeedLaunchPlan
{
    // A plan is single-use even when launch fails before process creation.
    private int _claimed;

    /// <summary>Creates one launcher-owned plan from freshly verified immutable evidence.</summary>
    internal CompanionDirectCompositionSeedLaunchPlan(
        Guid owner,
        CompanionDirectCompositionSeedMaterialization materialization,
        CompanionDirectCompositionSeedLaunchEvidence evidence,
        CompanionDirectCompositionSeedLaunchConfiguration configuration,
        string executableSha256)
    {
        Owner = owner;
        Materialization = materialization;
        Evidence = evidence;
        Configuration = configuration;
        ExecutableSha256 = executableSha256;
    }

    /// <summary>Gets the exact durable operation identity represented by this plan.</summary>
    public string OperationId => Evidence.OperationId;

    /// <summary>Gets the exact ACG2 composition identity represented by this plan.</summary>
    public string CompositionId => Evidence.CompositionId;

    /// <summary>Gets the exact validated bind endpoint.</summary>
    public string BindAddress => Configuration.BindAddress;

    /// <summary>Gets the sole exact validated browser origin.</summary>
    public string AllowedBrowserOrigin => Configuration.AllowedBrowserOrigin;

    /// <summary>Gets the launcher instance authorized to consume this plan.</summary>
    internal Guid Owner { get; }

    /// <summary>Gets the original materialization identity bound into this plan.</summary>
    internal CompanionDirectCompositionSeedMaterialization Materialization { get; }

    /// <summary>Gets the freshly reverified descriptor and member evidence.</summary>
    internal CompanionDirectCompositionSeedLaunchEvidence Evidence { get; }

    /// <summary>Gets the validated endpoint and browser-origin configuration.</summary>
    internal CompanionDirectCompositionSeedLaunchConfiguration Configuration { get; }

    /// <summary>Gets the executable digest captured when the plan was created.</summary>
    internal string ExecutableSha256 { get; }

    /// <summary>Atomically consumes this plan and rejects every subsequent launch attempt.</summary>
    internal void Claim()
    {
        if (Interlocked.CompareExchange(ref _claimed, 1, 0) != 0)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-plan-used");
        }
    }
}

/// <summary>Exact public-safe readiness accepted from the managed seed child.</summary>
public sealed record CompanionDirectCompositionSeedReadiness(
    string Protocol,
    string CompositionId,
    string BoundOrigin,
    string AllowedBrowserOrigin);

/// <summary>Closed reasons for an immutable managed seed terminal result.</summary>
public enum CompanionDirectCompositionSeedTerminalState
{
    /// <summary>The session owner explicitly stopped the child.</summary>
    OwnerStopped,

    /// <summary>The parent cancellation token stopped the child.</summary>
    ParentCancelled,

    /// <summary>The child exited without an authorized stop request.</summary>
    UnexpectedExit,

    /// <summary>The child violated its bounded readiness or output protocol.</summary>
    ProtocolFailure
}

/// <summary>Immutable public-safe terminal result for one launched child.</summary>
public sealed record CompanionDirectCompositionSeedTerminalStatus(
    CompanionDirectCompositionSeedTerminalState State,
    string Code,
    int? ExitCode);

/// <summary>Stable public-safe launch failure.</summary>
public sealed class CompanionDirectCompositionSeedLaunchException : Exception
{
    /// <summary>Creates one launch failure carrying only its registered public-safe code.</summary>
    private CompanionDirectCompositionSeedLaunchException(string code)
        : base(code)
    {
        Code = code;
    }

    /// <summary>Gets the registered public-safe failure code.</summary>
    public string Code { get; }

    /// <summary>Creates one stable public-safe launch failure.</summary>
    internal static CompanionDirectCompositionSeedLaunchException Create(string code) => new(code);
}

/// <summary>
/// Derives and starts one packaged Rust seed under managed process custody. It never announces,
/// probes reachability, opens a firewall, or accepts caller-supplied artifact paths.
/// </summary>
public sealed class CompanionDirectCompositionSeedLauncher
{
    /// <summary>Gets the sole readiness protocol accepted from the seed child.</summary>
    public const string Protocol =
        CompanionDirectCompositionSeedDescriptorMaterializer.ProtocolProfile;

    private const int MaximumReadinessBytes = 2 * 1024;
    private const long MaximumExecutableBytes = 128L * 1024 * 1024;
    private static readonly TimeSpan ProductionReadinessTimeout = TimeSpan.FromSeconds(20);
    // Positional order must match the canonical six-member launch evidence.
    private static readonly string[] MemberFlags =
    [
        "--model",
        "--tokenizer",
        "--template",
        "--sampling",
        "--prompt",
        "--composition"
    ];

    private readonly CompanionDirectCompositionSeedDescriptorMaterializer _materializer;
    private readonly string _executablePath;
    private readonly string _executableSha256;
    private readonly TimeSpan _readinessTimeout;
    private readonly Guid _owner = Guid.NewGuid();
    // Zero is idle; one reserves the launcher's sole child-process slot.
    private int _active;

    /// <summary>Creates one launcher bound to a verified executable and readiness deadline.</summary>
    private CompanionDirectCompositionSeedLauncher(
        CompanionDirectCompositionSeedDescriptorMaterializer materializer,
        string executablePath,
        TimeSpan readinessTimeout)
    {
        _materializer = materializer;
        (_executablePath, _executableSha256) = RequireExecutable(executablePath);
        if (readinessTimeout < TimeSpan.FromMilliseconds(100) ||
            readinessTimeout > TimeSpan.FromMinutes(1))
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-policy");
        }
        _readinessTimeout = readinessTimeout;
    }

    /// <summary>Opens only the fixed state and packaged seed locations for this host RID.</summary>
    public static CompanionDirectCompositionSeedLauncher OpenFromApplicationStateRoot(
        string applicationStateRoot) => OpenFromPackageLayout(
            CompanionDirectCompositionSeedDescriptorMaterializer
                .OpenFromApplicationStateRoot(applicationStateRoot));

    /// <summary>Uses one runtime-owned materializer and the sole packaged executable path.</summary>
    internal static CompanionDirectCompositionSeedLauncher OpenFromPackageLayout(
        CompanionDirectCompositionSeedDescriptorMaterializer materializer)
    {
        ArgumentNullException.ThrowIfNull(materializer);
        return new CompanionDirectCompositionSeedLauncher(
            materializer,
            ResolvePackagedSeedPath(),
            ProductionReadinessTimeout);
    }

    /// <summary>Injects only a fixture executable while retaining production path derivation.</summary>
    internal static CompanionDirectCompositionSeedLauncher OpenForTests(
        CompanionDirectCompositionSeedDescriptorMaterializer materializer,
        string fixtureExecutablePath,
        TimeSpan readinessTimeout)
    {
        ArgumentNullException.ThrowIfNull(materializer);
        return new CompanionDirectCompositionSeedLauncher(
            materializer,
            fixtureExecutablePath,
            readinessTimeout);
    }

    /// <summary>Creates one opaque plan from a freshly reverified materialization.</summary>
    public async Task<CompanionDirectCompositionSeedLaunchPlan> CreateLaunchPlanAsync(
        CompanionDirectCompositionSeedMaterialization materialization,
        CompanionDirectCompositionSeedLaunchConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(materialization);
        ArgumentNullException.ThrowIfNull(configuration);
        var evidence = await ReverifyAsync(materialization, cancellationToken)
            .ConfigureAwait(false);
        RequireExecutableIdentity(_executableSha256);
        return new CompanionDirectCompositionSeedLaunchPlan(
            _owner,
            materialization,
            evidence,
            configuration,
            _executableSha256);
    }

    /// <summary>Starts exactly one child from a launcher-owned single-use plan.</summary>
    public async Task<CompanionDirectCompositionSeedSession> LaunchAsync(
        CompanionDirectCompositionSeedLaunchPlan plan,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(plan);
        if (plan.Owner != _owner)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-plan-owner");
        }
        plan.Claim();
        if (Interlocked.CompareExchange(ref _active, 1, 0) != 0)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-already-running");
        }

        Process? process = null;
        Task? stderrTask = null;
        Task? stdoutRemainderTask = null;
        Task<byte[]>? readinessTask = null;
        var handedOff = false;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            var evidence = await ReverifyAsync(plan.Materialization, cancellationToken)
                .ConfigureAwait(false);
            RequireSameEvidence(plan.Evidence, evidence);
            if (plan.ExecutableSha256 != _executableSha256)
            {
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-executable-drift");
            }
            RequireExecutableIdentity(plan.ExecutableSha256);

            var startInfo = CreateStartInfo(plan, evidence);
            process = StartProcess(startInfo);
            RequireExecutableIdentity(plan.ExecutableSha256);

            stderrTask = RequireNoOutputAsync(
                process.StandardError.BaseStream,
                process,
                "direct-composition-seed-launch-unexpected-stderr");
            readinessTask = ReadReadinessLineAsync(
                process.StandardOutput.BaseStream,
                process,
                cancellationToken);
            var exitTask = process.WaitForExitAsync(CancellationToken.None);
            var timeoutTask = Task.Delay(_readinessTimeout, CancellationToken.None);
            var cancellationTask = cancellationToken.CanBeCanceled
                ? Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken)
                : Task.Delay(Timeout.InfiniteTimeSpan, CancellationToken.None);

            _ = await Task.WhenAny(
                readinessTask,
                stderrTask,
                exitTask,
                timeoutTask,
                cancellationTask).ConfigureAwait(false);

            cancellationToken.ThrowIfCancellationRequested();
            if (stderrTask.IsFaulted)
            {
                await stderrTask.ConfigureAwait(false);
            }
            if (timeoutTask.IsCompleted)
            {
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-readiness-timeout");
            }
            if (!readinessTask.IsCompletedSuccessfully)
            {
                try
                {
                    await readinessTask.ConfigureAwait(false);
                }
                catch (CompanionDirectCompositionSeedLaunchException exception) when (
                    exception.Code == "direct-composition-seed-launch-early-exit")
                {
                    _ = await Task.WhenAny(
                        stderrTask,
                        exitTask,
                        timeoutTask,
                        cancellationTask).ConfigureAwait(false);
                    cancellationToken.ThrowIfCancellationRequested();
                    if (timeoutTask.IsCompleted && !exitTask.IsCompleted)
                    {
                        throw CompanionDirectCompositionSeedLaunchException.Create(
                            "direct-composition-seed-launch-readiness-timeout");
                    }
                    if (exitTask.IsCompleted)
                    {
                        await stderrTask.ConfigureAwait(false);
                    }
                    if (stderrTask.IsFaulted)
                    {
                        await stderrTask.ConfigureAwait(false);
                    }
                    throw;
                }
            }

            var readiness = ParseReadiness(
                readinessTask.Result,
                evidence.CompositionId,
                plan.Configuration);
            if (process.HasExited)
            {
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-early-exit");
            }
            stdoutRemainderTask = RequireNoOutputAsync(
                process.StandardOutput.BaseStream,
                process,
                "direct-composition-seed-launch-unexpected-stdout");
            await Task.Yield();
            if (stdoutRemainderTask.IsFaulted)
            {
                await stdoutRemainderTask.ConfigureAwait(false);
            }
            if (stderrTask.IsFaulted)
            {
                await stderrTask.ConfigureAwait(false);
            }
            cancellationToken.ThrowIfCancellationRequested();

            var session = new CompanionDirectCompositionSeedSession(
                process,
                readiness,
                stdoutRemainderTask,
                stderrTask,
                cancellationToken,
                ReleaseActive);
            process = null;
            handedOff = true;
            return session;
        }
        catch (OperationCanceledException)
        {
            if (process is not null)
            {
                await TerminateAndDrainAsync(
                    process,
                    readinessTask,
                    stdoutRemainderTask,
                    stderrTask).ConfigureAwait(false);
                process = null;
            }
            cancellationToken.ThrowIfCancellationRequested();
            throw;
        }
        catch (CompanionDirectCompositionSeedLaunchException)
        {
            if (process is not null)
            {
                await TerminateAndDrainAsync(
                    process,
                    readinessTask,
                    stdoutRemainderTask,
                    stderrTask).ConfigureAwait(false);
                process = null;
            }
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or InvalidOperationException)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-process-io");
        }
        finally
        {
            if (process is not null)
            {
                await TerminateAndDrainAsync(
                    process,
                    readinessTask,
                    stdoutRemainderTask,
                    stderrTask).ConfigureAwait(false);
            }
            if (!handedOff)
            {
                ReleaseActive();
            }
        }
    }

    /// <summary>Maps materializer rejection to the launcher's single identity-drift boundary.</summary>
    private async Task<CompanionDirectCompositionSeedLaunchEvidence> ReverifyAsync(
        CompanionDirectCompositionSeedMaterialization materialization,
        CancellationToken cancellationToken)
    {
        try
        {
            return await _materializer.ReverifyForLaunchAsync(materialization, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-identity-drift");
        }
    }

    /// <summary>Builds the exact shell-free child command from launcher-owned evidence.</summary>
    private ProcessStartInfo CreateStartInfo(
        CompanionDirectCompositionSeedLaunchPlan plan,
        CompanionDirectCompositionSeedLaunchEvidence evidence)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _executablePath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = new UTF8Encoding(false, true),
            StandardErrorEncoding = new UTF8Encoding(false, true),
            UseShellExecute = false,
            CreateNoWindow = true
        };
        AddArgument(startInfo, "--descriptor", evidence.DescriptorPath);
        AddArgument(startInfo, "--bind", plan.Configuration.BindAddress);
        AddArgument(startInfo, "--allow-origin", plan.Configuration.AllowedBrowserOrigin);
        for (var index = 0; index < MemberFlags.Length; index++)
        {
            AddArgument(startInfo, MemberFlags[index], evidence.MemberPaths[index]);
        }
        return startInfo;
    }

    /// <summary>Adds one flag/value pair without command-line string interpolation.</summary>
    private static void AddArgument(ProcessStartInfo startInfo, string flag, string value)
    {
        startInfo.ArgumentList.Add(flag);
        startInfo.ArgumentList.Add(value);
    }

    /// <summary>Starts the child once and normalizes process-creation failures.</summary>
    private static Process StartProcess(ProcessStartInfo startInfo)
    {
        try
        {
            return Process.Start(startInfo)
                ?? throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-process-start");
        }
        catch (CompanionDirectCompositionSeedLaunchException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is Win32Exception or InvalidOperationException)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-process-start");
        }
    }

    /// <summary>Reads exactly one bounded readiness line and rejects trailing stdout bytes.</summary>
    private static async Task<byte[]> ReadReadinessLineAsync(
        Stream stream,
        Process process,
        CancellationToken cancellationToken)
    {
        var line = new byte[MaximumReadinessBytes];
        var buffer = new byte[512];
        var length = 0;
        while (true)
        {
            var count = await stream.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (count == 0)
            {
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-early-exit");
            }
            var newline = buffer.AsSpan(0, count).IndexOf((byte)'\n');
            var bodyCount = newline >= 0 ? newline : count;
            if (length + bodyCount > line.Length)
            {
                TryKill(process);
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-readiness-output-limit");
            }
            buffer.AsSpan(0, bodyCount).CopyTo(line.AsSpan(length));
            length += bodyCount;
            if (newline < 0)
            {
                continue;
            }
            if (newline + 1 != count)
            {
                TryKill(process);
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-unexpected-stdout");
            }
            return line.AsSpan(0, length).ToArray();
        }
    }

    /// <summary>Requires a redirected stream to remain empty until child termination.</summary>
    private static async Task RequireNoOutputAsync(
        Stream stream,
        Process process,
        string code)
    {
        try
        {
            var buffer = new byte[1];
            if (await stream.ReadAsync(buffer).ConfigureAwait(false) != 0)
            {
                TryKill(process);
                throw CompanionDirectCompositionSeedLaunchException.Create(code);
            }
        }
        catch (CompanionDirectCompositionSeedLaunchException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or InvalidOperationException)
        {
            TryKill(process);
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-process-io");
        }
    }

    /// <summary>Parses and canonically re-encodes the child's exact readiness contract.</summary>
    private static CompanionDirectCompositionSeedReadiness ParseReadiness(
        byte[] bytes,
        string compositionId,
        CompanionDirectCompositionSeedLaunchConfiguration configuration)
    {
        try
        {
            using var document = JsonDocument.Parse(bytes, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 4
            });
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw ReadinessError("direct-composition-seed-launch-readiness-json");
            }
            var properties = document.RootElement.EnumerateObject().ToArray();
            string[] names =
            [
                "protocol",
                "compositionId",
                "boundOrigin",
                "allowedBrowserOrigin"
            ];
            if (properties.Length != names.Length ||
                properties.Where((property, index) => property.Name != names[index]).Any() ||
                properties.Any(static property => property.Value.ValueKind != JsonValueKind.String))
            {
                throw ReadinessError("direct-composition-seed-launch-readiness-json");
            }

            var protocol = properties[0].Value.GetString()!;
            var observedCompositionId = properties[1].Value.GetString()!;
            var boundOrigin = properties[2].Value.GetString()!;
            var allowedOrigin = properties[3].Value.GetString()!;
            if (protocol != Protocol ||
                observedCompositionId != compositionId ||
                allowedOrigin != configuration.AllowedBrowserOrigin ||
                !CompanionDirectCompositionSeedLaunchValidation.BoundOriginMatches(
                    boundOrigin,
                    configuration.BindEndPoint))
            {
                throw ReadinessError("direct-composition-seed-launch-readiness-mismatch");
            }

            var canonical = EncodeReadiness(
                protocol,
                observedCompositionId,
                boundOrigin,
                allowedOrigin);
            if (!bytes.SequenceEqual(canonical))
            {
                throw ReadinessError("direct-composition-seed-launch-readiness-json");
            }
            return new CompanionDirectCompositionSeedReadiness(
                protocol,
                observedCompositionId,
                boundOrigin,
                allowedOrigin);
        }
        catch (CompanionDirectCompositionSeedLaunchException)
        {
            throw;
        }
        catch (JsonException)
        {
            throw ReadinessError("direct-composition-seed-launch-readiness-json");
        }
    }

    /// <summary>Encodes readiness fields in their sole accepted canonical JSON order.</summary>
    private static byte[] EncodeReadiness(
        string protocol,
        string compositionId,
        string boundOrigin,
        string allowedBrowserOrigin)
    {
        var buffer = new ArrayBufferWriter<byte>(512);
        using var writer = new Utf8JsonWriter(buffer);
        writer.WriteStartObject();
        writer.WriteString("protocol", protocol);
        writer.WriteString("compositionId", compositionId);
        writer.WriteString("boundOrigin", boundOrigin);
        writer.WriteString("allowedBrowserOrigin", allowedBrowserOrigin);
        writer.WriteEndObject();
        writer.Flush();
        return buffer.WrittenSpan.ToArray();
    }

    /// <summary>Creates one stable readiness-protocol failure.</summary>
    private static CompanionDirectCompositionSeedLaunchException ReadinessError(string code) =>
        CompanionDirectCompositionSeedLaunchException.Create(code);

    /// <summary>Requires launch-time evidence to equal plan-time evidence exactly.</summary>
    private static void RequireSameEvidence(
        CompanionDirectCompositionSeedLaunchEvidence expected,
        CompanionDirectCompositionSeedLaunchEvidence observed)
    {
        if (expected.OperationId != observed.OperationId ||
            expected.CompositionId != observed.CompositionId ||
            expected.DescriptorPath != observed.DescriptorPath ||
            expected.DescriptorSha256 != observed.DescriptorSha256 ||
            !expected.MemberPaths.SequenceEqual(observed.MemberPaths, PathComparer))
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-identity-drift");
        }
    }

    /// <summary>Rehashes the executable and rejects path or content drift.</summary>
    private void RequireExecutableIdentity(string expectedSha256)
    {
        var (path, sha256) = RequireExecutable(_executablePath);
        if (!PathComparer.Equals(path, _executablePath) || sha256 != expectedSha256)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-executable-drift");
        }
    }

    /// <summary>Validates and hashes one bounded regular executable beneath non-reparse parents.</summary>
    private static (string Path, string Sha256) RequireExecutable(string path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
            {
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-executable");
            }
            var full = Path.GetFullPath(path);
            var info = new FileInfo(full);
            info.Refresh();
            if (!info.Exists ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0 ||
                info.Length is <= 0 or > MaximumExecutableBytes)
            {
                throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-executable");
            }
            for (var parent = info.Directory; parent is not null; parent = parent.Parent)
            {
                parent.Refresh();
                if (!parent.Exists || (parent.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    throw CompanionDirectCompositionSeedLaunchException.Create(
                        "direct-composition-seed-launch-executable");
                }
            }
            using var stream = new FileStream(
                full,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 1_048_576,
                FileOptions.SequentialScan);
            var sha256 = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
            return (full, sha256);
        }
        catch (CompanionDirectCompositionSeedLaunchException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is ArgumentException or IOException or UnauthorizedAccessException or
                NotSupportedException or PathTooLongException)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-executable");
        }
    }

    /// <summary>Derives the sole packaged seed path for the current supported host RID.</summary>
    private static string ResolvePackagedSeedPath()
    {
        if (!Environment.Is64BitProcess)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-platform");
        }
        var architecture = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-platform")
        };
        var platform = OperatingSystem.IsWindows()
            ? "win"
            : OperatingSystem.IsLinux()
                ? "linux"
                : throw CompanionDirectCompositionSeedLaunchException.Create(
                    "direct-composition-seed-launch-platform");
        var fileName = OperatingSystem.IsWindows()
            ? "tinyrustlm-p2p-seed.exe"
            : "tinyrustlm-p2p-seed";
        return Path.Combine(
            AppContext.BaseDirectory,
            "tinyrustlm",
            "tools",
            $"{platform}-{architecture}",
            fileName);
    }

    /// <summary>Terminates the child tree, drains bounded observers, and releases process handles.</summary>
    private static async Task TerminateAndDrainAsync(
        Process process,
        params Task?[] tasks)
    {
        TryKill(process);
        try
        {
            await process.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch (InvalidOperationException)
        {
        }
        foreach (var task in tasks)
        {
            if (task is null)
            {
                continue;
            }
            try
            {
                await task.ConfigureAwait(false);
            }
            catch (Exception exception) when (
                exception is CompanionDirectCompositionSeedLaunchException or
                    OperationCanceledException or IOException or ObjectDisposedException)
            {
            }
        }
        process.Dispose();
    }

    /// <summary>Best-effort terminates an owned child process tree without masking the primary result.</summary>
    internal static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (Exception exception) when (
            exception is InvalidOperationException or Win32Exception or NotSupportedException)
        {
        }
    }

    /// <summary>Releases the sole active child slot after custody has ended.</summary>
    private void ReleaseActive() => Interlocked.Exchange(ref _active, 0);

    /// <summary>Gets the path comparer matching the host filesystem's case semantics.</summary>
    private static StringComparer PathComparer => OperatingSystem.IsWindows()
        ? StringComparer.OrdinalIgnoreCase
        : StringComparer.Ordinal;
}

/// <summary>Managed custody for one ready seed process and its immutable terminal result.</summary>
public sealed class CompanionDirectCompositionSeedSession : IAsyncDisposable
{
    private readonly Process _process;
    private readonly Task _stdoutTask;
    private readonly Task _stderrTask;
    private readonly CancellationToken _parentCancellation;
    private readonly Action _release;
    private readonly TaskCompletionSource<CompanionDirectCompositionSeedTerminalStatus> _terminal =
        new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly CancellationTokenRegistration _cancellationRegistration;
    private readonly Task _monitorTask;
    // Zero means running, one means owner stop, and two means parent cancellation.
    private int _stopRequest;
    private int _released;

    /// <summary>Assumes custody of one ready child and starts its sole terminal monitor.</summary>
    internal CompanionDirectCompositionSeedSession(
        Process process,
        CompanionDirectCompositionSeedReadiness readiness,
        Task stdoutTask,
        Task stderrTask,
        CancellationToken parentCancellation,
        Action release)
    {
        _process = process;
        Readiness = readiness;
        _stdoutTask = stdoutTask;
        _stderrTask = stderrTask;
        _parentCancellation = parentCancellation;
        _release = release;
        _cancellationRegistration = parentCancellation.Register(
            static state => ((CompanionDirectCompositionSeedSession)state!).CancelFromParent(),
            this);
        _monitorTask = MonitorAsync();
    }

    /// <summary>Gets the exact validated readiness emitted by the child.</summary>
    public CompanionDirectCompositionSeedReadiness Readiness { get; }

    /// <summary>Completes once with the child's immutable public-safe terminal result.</summary>
    public Task<CompanionDirectCompositionSeedTerminalStatus> TerminalStatus => _terminal.Task;

    /// <summary>Stops this owned child tree and waits for its immutable terminal result.</summary>
    public async ValueTask DisposeAsync()
    {
        _ = Interlocked.CompareExchange(ref _stopRequest, 1, 0);
        CompanionDirectCompositionSeedLauncher.TryKill(_process);
        await _monitorTask.ConfigureAwait(false);
    }

    /// <summary>Records parent cancellation before terminating the owned child tree.</summary>
    private void CancelFromParent()
    {
        Interlocked.Exchange(ref _stopRequest, 2);
        CompanionDirectCompositionSeedLauncher.TryKill(_process);
    }

    /// <summary>Observes child exit and streams once, then publishes one immutable terminal status.</summary>
    private async Task MonitorAsync()
    {
        string? protocolFailure = null;
        try
        {
            var exitTask = _process.WaitForExitAsync(CancellationToken.None);
            _ = await Task.WhenAny(exitTask, _stdoutTask, _stderrTask).ConfigureAwait(false);
            try
            {
                await _stdoutTask.ConfigureAwait(false);
            }
            catch (CompanionDirectCompositionSeedLaunchException exception)
            {
                protocolFailure = exception.Code;
            }
            try
            {
                await _stderrTask.ConfigureAwait(false);
            }
            catch (CompanionDirectCompositionSeedLaunchException exception)
            {
                protocolFailure ??= exception.Code;
            }
            if (protocolFailure is not null)
            {
                CompanionDirectCompositionSeedLauncher.TryKill(_process);
            }
            await exitTask.ConfigureAwait(false);
        }
        catch (Exception exception) when (
            exception is IOException or InvalidOperationException or Win32Exception or
                NotSupportedException)
        {
            protocolFailure ??= "direct-composition-seed-launch-process-io";
            CompanionDirectCompositionSeedLauncher.TryKill(_process);
            try
            {
                await _process.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception waitException) when (
                waitException is InvalidOperationException or Win32Exception or
                    NotSupportedException)
            {
            }
        }
        finally
        {
            var status = CreateTerminalStatus(protocolFailure);
            try
            {
                _cancellationRegistration.Dispose();
                _process.Dispose();
            }
            finally
            {
                if (Interlocked.Exchange(ref _released, 1) == 0)
                {
                    _release();
                }
                _terminal.TrySetResult(status);
            }
        }
    }

    /// <summary>Classifies terminal custody with cancellation precedence over protocol failure.</summary>
    private CompanionDirectCompositionSeedTerminalStatus CreateTerminalStatus(
        string? protocolFailure)
    {
        var stopRequest = Volatile.Read(ref _stopRequest);
        if (_parentCancellation.IsCancellationRequested || stopRequest == 2)
        {
            return new(
                CompanionDirectCompositionSeedTerminalState.ParentCancelled,
                "direct-composition-seed-launch-cancelled",
                ExitCodeOrNull());
        }
        if (stopRequest == 1)
        {
            return new(
                CompanionDirectCompositionSeedTerminalState.OwnerStopped,
                "direct-composition-seed-launch-stopped",
                ExitCodeOrNull());
        }
        if (protocolFailure is not null)
        {
            return new(
                CompanionDirectCompositionSeedTerminalState.ProtocolFailure,
                protocolFailure,
                ExitCodeOrNull());
        }
        return new(
            CompanionDirectCompositionSeedTerminalState.UnexpectedExit,
            "direct-composition-seed-launch-process-exit",
            ExitCodeOrNull());
    }

    /// <summary>Returns the child exit code only when it is safely observable.</summary>
    private int? ExitCodeOrNull()
    {
        try
        {
            return _process.HasExited ? _process.ExitCode : null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }
}

/// <summary>Validates the exact endpoint and origin forms admitted by seed launch.</summary>
internal static class CompanionDirectCompositionSeedLaunchValidation
{
    /// <summary>Parses one canonical numeric IPv4 or IPv6 bind endpoint.</summary>
    internal static IPEndPoint ParseBindAddress(string value)
    {
        if (value is not { Length: >= 3 and <= 80 } ||
            !IPEndPoint.TryParse(value, out var endPoint) ||
            endPoint.ToString() != value ||
            endPoint.Address.AddressFamily is not (
                AddressFamily.InterNetwork or AddressFamily.InterNetworkV6))
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-bind");
        }
        return endPoint;
    }

    /// <summary>Requires canonical HTTPS or explicitly ported loopback HTTP without a URL suffix.</summary>
    internal static void RequireBrowserOrigin(string value)
    {
        if (value is not { Length: >= 8 and <= 256 } ||
            !value.All(static character => character is >= (char)0x21 and <= (char)0x7e) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && !IsExplicitLoopbackHttpOrigin(uri)) ||
            string.IsNullOrEmpty(uri.Host) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            uri.AbsolutePath != "/" ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            CanonicalOrigin(uri) != value)
        {
            throw CompanionDirectCompositionSeedLaunchException.Create(
                "direct-composition-seed-launch-origin");
        }
    }

    /// <summary>Recognizes only canonical local development hosts with an explicit non-default port.</summary>
    private static bool IsExplicitLoopbackHttpOrigin(Uri uri)
    {
        if (uri.Scheme != Uri.UriSchemeHttp || uri.IsDefaultPort || uri.Port is < 1 or > 65_535)
        {
            return false;
        }
        if (string.Equals(uri.IdnHost, "localhost", StringComparison.Ordinal))
        {
            return true;
        }
        return IPAddress.TryParse(uri.IdnHost, out var address) &&
            (address.Equals(IPAddress.Loopback) || address.Equals(IPAddress.IPv6Loopback));
    }

    /// <summary>Checks that reported HTTP readiness binds the configured address and allowed port.</summary>
    internal static bool BoundOriginMatches(string value, IPEndPoint configured)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            uri.Scheme != "http" ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            uri.AbsolutePath != "/" ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            !IPAddress.TryParse(uri.IdnHost, out var address) ||
            !address.Equals(configured.Address))
        {
            return false;
        }
        var port = uri.Port;
        if (port is < 1 or > ushort.MaxValue ||
            (configured.Port != 0 && configured.Port != port))
        {
            return false;
        }
        return value == $"http://{new IPEndPoint(configured.Address, port)}";
    }

    /// <summary>Builds the sole lowercase host and default-port representation of an origin.</summary>
    private static string CanonicalOrigin(Uri uri)
    {
        string host;
        if (IPAddress.TryParse(uri.IdnHost, out var address))
        {
            host = address.AddressFamily == AddressFamily.InterNetworkV6
                ? $"[{address}]"
                : address.ToString();
        }
        else
        {
            host = uri.IdnHost.ToLowerInvariant();
        }
        var port = uri.IsDefaultPort ? string.Empty : $":{uri.Port}";
        return $"{uri.Scheme.ToLowerInvariant()}://{host}{port}";
    }
}
