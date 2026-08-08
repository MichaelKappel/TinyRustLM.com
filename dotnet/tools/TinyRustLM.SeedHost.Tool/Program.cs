using System.Text.Json;
using System.Text.Json.Serialization;
using TinyRustLM.SeedHost;

namespace TinyRustLM.SeedHost.Tool;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    static Program()
    {
        JsonOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
    }

    public static async Task<int> Main(string[] args)
    {
        var json = args.Any(value => string.Equals(value, "--json", StringComparison.Ordinal));
        try
        {
            var arguments = ToolArguments.Parse(args);
            if (arguments.HelpRequested || string.Equals(arguments.Command, "help", StringComparison.Ordinal))
            {
                WriteHelp();
                return 0;
            }
            using var cancellation = new CancellationTokenSource();
            ConsoleCancelEventHandler handler = (_, eventArgs) =>
            {
                eventArgs.Cancel = true;
                cancellation.Cancel();
            };
            Console.CancelKeyPress += handler;
            object result;
            try
            {
                result = await ExecuteAsync(arguments, json, cancellation.Token).ConfigureAwait(false);
            }
            finally
            {
                Console.CancelKeyPress -= handler;
            }
            WriteSuccess(result, json);
            return 0;
        }
        catch (OperationCanceledException)
        {
            WriteError("operation_cancelled", "Operation was cancelled.", json);
            return 4;
        }
        catch (SeedHostValidationException error)
        {
            WriteError(error.Code, error.Message, json);
            return 2;
        }
        catch (SeedHostException error)
        {
            WriteError(error.Code, error.Message, json);
            return 3;
        }
        catch (ArgumentException error)
        {
            WriteError("invalid_argument", error.Message, json);
            return 2;
        }
        catch (Exception)
        {
            WriteError(
                "unexpected_error",
                "The seed-host tool failed unexpectedly; rerun doctor and inspect the local service logs.",
                json);
            return 5;
        }
    }

    private static async Task<object> ExecuteAsync(
        ToolArguments arguments,
        bool jsonOutput,
        CancellationToken cancellationToken)
    {
        var authority = new MiniModelAuthority();
        return arguments.Command switch
        {
            "doctor" => RunSynchronous(cancellationToken, () => Doctor(arguments, authority)),
            "init" => await InitializeAsync(arguments, authority, cancellationToken)
                .ConfigureAwait(false),
            "inspect" or "status" => RunSynchronous(
                cancellationToken,
                () => Inspect(arguments, authority)),
            "add-model" => await AddModelAsync(arguments, authority, cancellationToken)
                .ConfigureAwait(false),
            "remove-model" => await RemoveModelAsync(arguments, authority, cancellationToken)
                .ConfigureAwait(false),
            "enable-model" => await SetModelEnabledAsync(
                    arguments,
                    authority,
                    enabled: true,
                    cancellationToken)
                .ConfigureAwait(false),
            "disable-model" => await SetModelEnabledAsync(
                    arguments,
                    authority,
                    enabled: false,
                    cancellationToken)
                .ConfigureAwait(false),
            "import" => await ImportAsync(arguments, authority, cancellationToken)
                .ConfigureAwait(false),
            "inspect-import-receipt" => RunSynchronous(
                cancellationToken,
                () => InspectImportReceipt(arguments, authority)),
            "probe-local" => await ProbeLocalAsync(arguments, authority, cancellationToken)
                .ConfigureAwait(false),
            "verify-external-probe" => RunSynchronous(
                cancellationToken,
                () => VerifyExternalProbe(arguments, authority)),
            "prepare-announcement" => RunSynchronous(
                cancellationToken,
                () => PrepareAnnouncement(arguments, authority)),
            "bridge" => await BridgeAsync(
                    arguments,
                    authority,
                    jsonOutput,
                    cancellationToken)
                .ConfigureAwait(false),
            "serve" => await ServeAsync(
                    arguments,
                    authority,
                    laneId: null,
                    cancellationToken)
                .ConfigureAwait(false),
            "serve-lane" => await ServeAsync(
                arguments,
                authority,
                arguments.Required("lane-id"),
                cancellationToken).ConfigureAwait(false),
            "install-service" => await ServiceOperationAsync(
                    arguments,
                    authority,
                    "install",
                    cancellationToken)
                .ConfigureAwait(false),
            "uninstall-service" => await ServiceOperationAsync(
                    arguments,
                    authority,
                    "uninstall",
                    cancellationToken)
                .ConfigureAwait(false),
            "start" => await ServiceOperationAsync(arguments, authority, "start", cancellationToken)
                .ConfigureAwait(false),
            "stop" => await ServiceOperationAsync(arguments, authority, "stop", cancellationToken)
                .ConfigureAwait(false),
            "restart" => await ServiceOperationAsync(
                    arguments,
                    authority,
                    "restart",
                    cancellationToken)
                .ConfigureAwait(false),
            _ => throw new SeedHostValidationException(
                "unknown_command",
                $"Unknown command '{arguments.Command}'. Run 'uaix-p2p-seed help'.")
        };
    }

    private static SeedHostDoctorReport Doctor(
        ToolArguments arguments,
        IMiniModelAuthority authority)
    {
        var executable = arguments.Optional("minimodel");
        var converter = arguments.Optional("converter");
        arguments.EnsureConsumed();
        return new SeedHostDoctor(authority).Run(executable, converter);
    }

    private static async Task<SeedFleetInspection> InitializeAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        CancellationToken cancellationToken)
    {
        var root = Path.GetFullPath(arguments.Optional("root") ?? DefaultRootDirectory());
        var fleetId = arguments.Required("fleet-id");
        arguments.EnsureConsumed();
        await using var store = new SeedFleetStore(new SeedFleetStoreOptions(root), authority);
        return await store.InitializeAsync(fleetId, cancellationToken).ConfigureAwait(false);
    }

    private static SeedFleetInspection Inspect(
        ToolArguments arguments,
        IMiniModelAuthority authority)
    {
        var config = ConfigurationPath(arguments);
        arguments.EnsureConsumed();
        return authority.InspectSeedFleet(config);
    }

    private static async Task<SeedModelAdmissionResult> AddModelAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        CancellationToken cancellationToken)
    {
        var config = ConfigurationPath(arguments);
        var modelId = arguments.Required("model-id");
        var artifact = Path.GetFullPath(arguments.Required("artifact"));
        var sourceModel = arguments.Optional("source-model");
        var provenance = sourceModel is null
            ? null
            : TrainedProvenance(arguments);
        var laneABind = arguments.Required("lane-a-bind");
        var laneAUrl = arguments.Required("lane-a-url");
        var laneBBind = arguments.Required("lane-b-bind");
        var laneBUrl = arguments.Required("lane-b-url");
        var disabled = arguments.Flag("disabled");
        arguments.EnsureConsumed();
        await using var store = StoreFromConfiguration(config, authority);
        var service = new SeedModelAdmissionService(store, authority);
        return await service.AdmitAsync(new SeedModelAdmissionOptions(
            modelId,
            artifact,
            [
                new SeedLaneAdmissionEndpoint("seed-a", laneABind, laneAUrl),
                new SeedLaneAdmissionEndpoint("seed-b", laneBBind, laneBUrl)
            ],
            sourceModel,
            provenance,
            Enabled: !disabled), cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Parse the complete fail-closed provenance contract for a trained source.</summary>
    private static PeerShareProvenance TrainedProvenance(ToolArguments arguments)
    {
        var tier = arguments.Required("quality-tier") switch
        {
            "conversation-proven-full-assistant-pending" =>
                PeerShareQualityTier.ConversationProvenFullAssistantPending,
            var value => throw new SeedHostValidationException(
                "unsupported_quality_tier",
                $"Unsupported quality tier '{value}'.")
        };
        return new PeerShareProvenance(
            arguments.Required("source-revision"),
            arguments.Required("source-license-id"),
            Path.GetFullPath(arguments.Required("source-license-file")),
            arguments.Required("source-license-sha256"),
            Path.GetFullPath(arguments.Required("modification-notice")),
            arguments.Required("modification-notice-sha256"),
            Path.GetFullPath(arguments.Required("conversation-evidence")),
            arguments.Required("conversation-evidence-sha256"),
            Path.GetFullPath(arguments.Required("quality-evidence")),
            arguments.Required("quality-evidence-sha256"),
            tier,
            arguments.Required("known-limitation"));
    }

    private static async Task<SeedFleetInspection> RemoveModelAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        CancellationToken cancellationToken)
    {
        var config = ConfigurationPath(arguments);
        var modelId = arguments.Required("model-id");
        arguments.EnsureConsumed();
        await using var store = StoreFromConfiguration(config, authority);
        return await store.RemoveModelAsync(modelId, cancellationToken).ConfigureAwait(false);
    }

    private static async Task<SeedFleetInspection> SetModelEnabledAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        bool enabled,
        CancellationToken cancellationToken)
    {
        var config = ConfigurationPath(arguments);
        var modelId = arguments.Required("model-id");
        arguments.EnsureConsumed();
        await using var store = StoreFromConfiguration(config, authority);
        return await store.SetModelEnabledAsync(modelId, enabled, cancellationToken)
            .ConfigureAwait(false);
    }

    private static async Task<PeerImportExecution> ImportAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        CancellationToken cancellationToken)
    {
        var request = Path.GetFullPath(arguments.Required("request"));
        var manifest = Path.GetFullPath(arguments.Required("manifest"));
        var output = Path.GetFullPath(arguments.Required("output"));
        var executable = arguments.Optional("minimodel");
        var timeoutSeconds = arguments.OptionalPositiveInt("timeout-seconds");
        arguments.EnsureConsumed();
        return await new SeedPeerImportService(authority).ImportAsync(
            new SeedPeerImportOptions(
                request,
                manifest,
                output,
                executable,
                timeoutSeconds is int seconds
                    ? TimeSpan.FromSeconds(seconds)
                    : null),
            cancellationToken).ConfigureAwait(false);
    }

    private static PeerImportReceiptInspection InspectImportReceipt(
        ToolArguments arguments,
        IMiniModelAuthority authority)
    {
        var receipt = Path.GetFullPath(arguments.Required("receipt"));
        var request = Path.GetFullPath(arguments.Required("request"));
        var preflight = Path.GetFullPath(arguments.Required("preflight"));
        var manifest = Path.GetFullPath(arguments.Required("manifest"));
        var artifact = Path.GetFullPath(arguments.Required("artifact"));
        arguments.EnsureConsumed();
        return authority.InspectPeerImportReceipt(
            receipt,
            request,
            preflight,
            manifest,
            artifact);
    }

    private static async Task<SeedFleetLocalProbeReport> ProbeLocalAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        CancellationToken cancellationToken)
    {
        var config = ConfigurationPath(arguments);
        arguments.EnsureConsumed();
        using var probe = new SeedFleetLocalProbeService(authority);
        return await probe.ProbeAsync(config, cancellationToken).ConfigureAwait(false);
    }

    private static ExternalProbeReceiptInspection VerifyExternalProbe(
        ToolArguments arguments,
        IMiniModelAuthority authority)
    {
        var receipt = Path.GetFullPath(arguments.Required("receipt"));
        var trust = Path.GetFullPath(arguments.Required("trust"));
        var config = ConfigurationPath(arguments);
        arguments.EnsureConsumed();
        return authority.InspectExternalProbeReceipt(receipt, trust, config);
    }

    private static SeedPeerSourceAnnouncementPreparation PrepareAnnouncement(
        ToolArguments arguments,
        IMiniModelAuthority authority)
    {
        var catalogEntry = Path.GetFullPath(arguments.Required("catalog-entry"));
        var output = Path.GetFullPath(arguments.Required("output"));
        var receipt = Path.GetFullPath(arguments.Required("receipt"));
        var trust = Path.GetFullPath(arguments.Required("trust"));
        var config = ConfigurationPath(arguments);
        arguments.EnsureConsumed();
        return new SeedAnnouncementService(authority).Prepare(
            new SeedAnnouncementPreparationOptions(
                catalogEntry,
                output,
                receipt,
                trust,
                config));
    }

    private static async Task<object> ServeAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        string? laneId,
        CancellationToken cancellationToken)
    {
        laneId ??= arguments.Optional("lane");
        var config = ConfigurationPath(arguments);
        var executable = arguments.Optional("minimodel");
        var durationSeconds = arguments.OptionalPositiveInt("duration-seconds");
        arguments.EnsureConsumed();
        await using var supervisor = new SeedFleetProcessSupervisor(
            new SeedFleetProcessOptions(MiniModelExecutablePath: executable),
            authority);
        var started = laneId is null
            ? await supervisor.StartAllAsync(config, cancellationToken).ConfigureAwait(false)
            : [await supervisor.StartLaneAsync(config, laneId, cancellationToken)
                .ConfigureAwait(false)];
        var deadline = durationSeconds is int seconds
            ? DateTimeOffset.UtcNow + TimeSpan.FromSeconds(seconds)
            : DateTimeOffset.MaxValue;
        while (!cancellationToken.IsCancellationRequested && DateTimeOffset.UtcNow < deadline)
        {
            var failed = supervisor.GetStatuses().FirstOrDefault(status =>
                status.State == SeedLaneProcessState.Failed);
            if (failed is not null)
            {
                throw new SeedHostException(
                    failed.ErrorCode ?? "lane_failed",
                    $"Seed lane '{failed.LaneId}' failed while serving. {failed.DiagnosticSummary}");
            }
            try
            {
                await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
        }
        var stopped = new List<SeedLaneProcessStatus>();
        foreach (var status in supervisor.GetStatuses()
            .Where(value => value.State is SeedLaneProcessState.Ready or SeedLaneProcessState.Starting)
            .OrderByDescending(value => value.LaneId, StringComparer.Ordinal))
        {
            stopped.Add(await supervisor.StopLaneAsync(status.LaneId).ConfigureAwait(false));
        }
        cancellationToken.ThrowIfCancellationRequested();
        return new { started, stopped };
    }

    private static async Task<object> BridgeAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        bool jsonOutput,
        CancellationToken cancellationToken)
    {
        if (jsonOutput)
        {
            throw new SeedHostValidationException(
                "bridge_json_unsupported",
                "The bridge command is interactive because it displays a one-time pairing code; --json is not supported.");
        }
        var root = Path.GetFullPath(arguments.Optional("root") ?? DefaultRootDirectory());
        var origin = arguments.Optional("origin") ?? "https://tinyrustlm.com";
        var port = arguments.OptionalPort("port") ?? 43127;
        var executable = arguments.Optional("minimodel");
        var converter = arguments.Optional("converter");
        var allowSharing = arguments.Flag("allow-sharing");
        var durationSeconds = arguments.OptionalPositiveInt("duration-seconds");
        arguments.EnsureConsumed();

        await using var bridge = new SeedHostBridgeServer(
            new SeedHostBridgeOptions(
                root,
                [origin],
                Port: port,
                AllowSharing: allowSharing,
                ConversionExecutablePath: converter),
            authority,
            executable);
        await bridge.StartAsync(cancellationToken).ConfigureAwait(false);
        var challenge = bridge.CreatePairingChallenge();
        var endpoint = bridge.Endpoint.AbsoluteUri;
        Console.Out.WriteLine("TinyRustLM local companion bridge");
        Console.Out.WriteLine($"Endpoint: {endpoint}");
        Console.Out.WriteLine($"Approved browser origin: {origin}");
        Console.Out.WriteLine($"One-time pairing code: {challenge.Code}");
        Console.Out.WriteLine($"Pairing code expires: {challenge.ExpiresUtc:O}");
        Console.Out.WriteLine("The code is held only as a digest and dies after one use or bridge shutdown.");
        Console.Out.Flush();

        var deadline = durationSeconds is int seconds
            ? DateTimeOffset.UtcNow + TimeSpan.FromSeconds(seconds)
            : DateTimeOffset.MaxValue;
        while (!cancellationToken.IsCancellationRequested && DateTimeOffset.UtcNow < deadline)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
        }
        cancellationToken.ThrowIfCancellationRequested();
        return new
        {
            state = "stopped",
            endpoint,
            approved_origin = origin,
            sharing_enabled = allowSharing,
            credentials_persisted = false
        };
    }

    private static async Task<SeedHostServiceOperationReport> ServiceOperationAsync(
        ToolArguments arguments,
        IMiniModelAuthority authority,
        string operation,
        CancellationToken cancellationToken)
    {
        var config = ConfigurationPath(arguments);
        var toolExecutable = arguments.Optional("tool-executable") ?? Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(toolExecutable))
        {
            throw new SeedHostValidationException(
                "tool_executable_required",
                "Service management requires the absolute installed uaix-p2p-seed executable path.");
        }
        var miniModel = new SeedHostDoctor(authority)
            .Run(arguments.Optional("minimodel"))
            .MiniModelExecutablePath;
        var prefix = arguments.Optional("service-prefix");
        arguments.EnsureConsumed();
        var plan = new SeedHostServicePlanner(authority).Create(new SeedHostServiceOptions(
            config,
            toolExecutable,
            miniModel,
            prefix));
        var manager = new SeedHostServiceManager();
        return operation switch
        {
            "install" => await manager.InstallAsync(plan, cancellationToken).ConfigureAwait(false),
            "uninstall" => await manager.UninstallAsync(plan, cancellationToken).ConfigureAwait(false),
            "start" => await manager.StartAsync(plan, cancellationToken).ConfigureAwait(false),
            "stop" => await manager.StopAsync(plan, cancellationToken).ConfigureAwait(false),
            "restart" => await manager.RestartAsync(plan, cancellationToken).ConfigureAwait(false),
            _ => throw new InvalidOperationException("Unsupported service operation.")
        };
    }

    /// <summary>Apply cancellation checkpoints around one bounded synchronous native operation.</summary>
    private static T RunSynchronous<T>(CancellationToken cancellationToken, Func<T> operation)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var result = operation();
        cancellationToken.ThrowIfCancellationRequested();
        return result;
    }

    private static SeedFleetStore StoreFromConfiguration(
        string configurationPath,
        IMiniModelAuthority authority)
    {
        var fullPath = Path.GetFullPath(configurationPath);
        var root = Path.GetDirectoryName(fullPath)
            ?? throw new SeedHostValidationException(
                "invalid_configuration_path",
                "Configuration path must have a parent directory.");
        return new SeedFleetStore(
            new SeedFleetStoreOptions(root, Path.GetFileName(fullPath)),
            authority);
    }

    private static string ConfigurationPath(ToolArguments arguments)
    {
        var explicitPath = arguments.Optional("config");
        if (explicitPath is not null)
        {
            return Path.GetFullPath(explicitPath);
        }
        var root = Path.GetFullPath(arguments.Optional("root") ?? DefaultRootDirectory());
        return Path.Combine(root, "seed-fleet.v0.json");
    }

    private static string DefaultRootDirectory()
    {
        if (OperatingSystem.IsWindows())
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "UAIX",
                "TinyRustLM",
                "SeedHost");
        }
        var dataHome = Environment.GetEnvironmentVariable("XDG_DATA_HOME");
        if (!string.IsNullOrWhiteSpace(dataHome))
        {
            return Path.Combine(dataHome, "uaix", "tinyrustlm", "seed-host");
        }
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".local",
            "share",
            "uaix",
            "tinyrustlm",
            "seed-host");
    }

    private static void WriteSuccess(object value, bool json)
    {
        if (json)
        {
            Console.Out.WriteLine(JsonSerializer.Serialize(
                new { ok = true, value, error = (object?)null },
                JsonOptions));
            return;
        }
        Console.Out.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
    }

    private static void WriteError(string code, string message, bool json)
    {
        if (json)
        {
            Console.Error.WriteLine(JsonSerializer.Serialize(
                new { ok = false, value = (object?)null, error = new { code, message } },
                JsonOptions));
            return;
        }
        Console.Error.WriteLine($"error [{code}]: {message}");
    }

    private static void WriteHelp()
    {
        Console.Out.WriteLine(
            """
            UAIX TinyRustLM P2P seed host

            Commands:
              doctor [--minimodel PATH] [--json]
              init --fleet-id ID [--root DIR] [--json]
              doctor [--minimodel PATH] [--converter PATH] [--json]
              inspect|status [--config FILE | --root DIR] [--json]
              add-model --model-id ID --artifact FILE
                --lane-a-bind IP:PORT --lane-a-url URL
                --lane-b-bind IP:PORT --lane-b-url URL
                [--source-model ID --source-revision COMMIT --source-license-id SPDX
                 --source-license-file FILE --source-license-sha256 SHA256
                 --modification-notice FILE --modification-notice-sha256 SHA256
                 --conversation-evidence FILE --conversation-evidence-sha256 SHA256
                 --quality-evidence FILE --quality-evidence-sha256 SHA256
                 --quality-tier conversation-proven-full-assistant-pending
                 --known-limitation ID]
                [--disabled] [--config FILE | --root DIR] [--json]
              remove-model|enable-model|disable-model --model-id ID
                [--config FILE | --root DIR] [--json]
              serve [--config FILE | --root DIR] [--minimodel PATH]
                [--lane seed-a|seed-b] [--duration-seconds N] [--json]
              serve-lane --lane-id seed-a|seed-b [--config FILE | --root DIR]
                [--minimodel PATH] [--duration-seconds N] [--json]
              bridge [--root DIR] [--origin EXACT_ORIGIN] [--port PORT]
                [--minimodel PATH] [--converter PATH] [--allow-sharing]
                [--duration-seconds N]
              import --request FILE --manifest FILE --output DIR
                [--minimodel PATH] [--timeout-seconds N] [--json]
              inspect-import-receipt --receipt FILE --request FILE --preflight FILE
                --manifest FILE --artifact FILE [--json]
              probe-local [--config FILE | --root DIR] [--json]
              verify-external-probe --receipt FILE --trust FILE
                [--config FILE | --root DIR] [--json]
              prepare-announcement --catalog-entry FILE --output FILE
                --receipt FILE --trust FILE [--config FILE | --root DIR] [--json]
              install-service|uninstall-service|start|stop|restart
                [--config FILE | --root DIR] [--tool-executable PATH]
                [--minimodel PATH] [--service-prefix NAME] [--json]

            The tool serves model bytes only from this user-run computer. Project websites do not
            host, run, or proxy model bytes. Public announcement remains disabled until an external
            observer supplies a current matching reachability receipt.
            """);
    }

    private sealed class ToolArguments
    {
        private readonly Dictionary<string, string?> options;

        private ToolArguments(
            string command,
            Dictionary<string, string?> options,
            bool helpRequested)
        {
            Command = command;
            this.options = options;
            HelpRequested = helpRequested;
        }

        internal string Command { get; }
        internal bool HelpRequested { get; }

        internal static ToolArguments Parse(IReadOnlyList<string> args)
        {
            var filtered = args.Where(value =>
                !string.Equals(value, "--json", StringComparison.Ordinal)).ToArray();
            var help = filtered.Any(value =>
                value is "--help" or "-h");
            if (filtered.Length == 0)
            {
                return new ToolArguments("help", new Dictionary<string, string?>(), true);
            }
            var command = filtered[0];
            if (command.StartsWith("-", StringComparison.Ordinal))
            {
                if (help)
                {
                    return new ToolArguments("help", new Dictionary<string, string?>(), true);
                }
                throw new SeedHostValidationException(
                    "missing_command",
                    "A seed-host command is required.");
            }
            var parsed = new Dictionary<string, string?>(StringComparer.Ordinal);
            for (var index = 1; index < filtered.Length; index++)
            {
                var token = filtered[index];
                if (token is "--help" or "-h")
                {
                    continue;
                }
                if (!token.StartsWith("--", StringComparison.Ordinal) || token.Length == 2)
                {
                    throw new SeedHostValidationException(
                        "unexpected_argument",
                        $"Unexpected positional argument '{token}'.");
                }
                var name = token[2..];
                string? value = null;
                if (index + 1 < filtered.Length
                    && !filtered[index + 1].StartsWith("--", StringComparison.Ordinal))
                {
                    value = filtered[++index];
                }
                if (!parsed.TryAdd(name, value))
                {
                    throw new SeedHostValidationException(
                        "duplicate_option",
                        $"Option '--{name}' was supplied more than once.");
                }
            }
            return new ToolArguments(command, parsed, help);
        }

        internal string Required(string name)
        {
            if (!options.Remove(name, out var value) || string.IsNullOrWhiteSpace(value))
            {
                throw new SeedHostValidationException(
                    "missing_option",
                    $"Required option '--{name}' is missing.");
            }
            if (value.Contains('\0'))
            {
                throw new SeedHostValidationException(
                    "invalid_option",
                    $"Option '--{name}' contains an embedded NUL character.");
            }
            return value;
        }

        internal string? Optional(string name)
        {
            if (!options.Remove(name, out var value))
            {
                return null;
            }
            if (string.IsNullOrWhiteSpace(value) || value.Contains('\0'))
            {
                throw new SeedHostValidationException(
                    "invalid_option",
                    $"Option '--{name}' requires a nonempty NUL-free value.");
            }
            return value;
        }

        internal bool Flag(string name)
        {
            if (!options.Remove(name, out var value))
            {
                return false;
            }
            if (value is not null)
            {
                throw new SeedHostValidationException(
                    "invalid_flag",
                    $"Flag '--{name}' does not accept a value.");
            }
            return true;
        }

        internal int? OptionalPositiveInt(string name)
        {
            var value = Optional(name);
            if (value is null)
            {
                return null;
            }
            if (!int.TryParse(value, out var parsed) || parsed <= 0 || parsed > 86_400)
            {
                throw new SeedHostValidationException(
                    "invalid_integer_option",
                    $"Option '--{name}' must be an integer from 1 through 86400.");
            }
            return parsed;
        }

        internal int? OptionalPort(string name)
        {
            var value = Optional(name);
            if (value is null)
            {
                return null;
            }
            if (!int.TryParse(value, out var parsed) || parsed is < 0 or > 65535)
            {
                throw new SeedHostValidationException(
                    "invalid_port_option",
                    $"Option '--{name}' must be an integer from 0 through 65535.");
            }
            return parsed;
        }

        internal void EnsureConsumed()
        {
            if (options.Count == 0)
            {
                return;
            }
            var name = options.Keys.Order(StringComparer.Ordinal).First();
            throw new SeedHostValidationException(
                "unknown_option",
                $"Unknown option '--{name}' for command '{Command}'.");
        }
    }
}
