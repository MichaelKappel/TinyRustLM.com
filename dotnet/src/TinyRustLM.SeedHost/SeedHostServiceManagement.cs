using System.Security;
using System.Text;

namespace TinyRustLM.SeedHost;

/// <summary>Inputs used to create two deterministic OS service definitions.</summary>
public sealed record SeedHostServiceOptions(
    string ConfigurationPath,
    string ToolExecutablePath,
    string MiniModelExecutablePath,
    string? ServiceNamePrefix = null);

/// <summary>One independently managed operating-system lane definition.</summary>
public sealed record SeedHostServiceDefinition(
    string ServiceName,
    string LaneId,
    string OwnedDefinitionPath,
    string DefinitionContent);

/// <summary>Deterministic service plan for one validated fleet.</summary>
public sealed record SeedHostServicePlan(
    string Platform,
    string FleetId,
    string ConfigurationPath,
    string ToolExecutablePath,
    string MiniModelExecutablePath,
    IReadOnlyList<SeedHostServiceDefinition> Definitions);

/// <summary>Result of an idempotent install, remove, start, or stop operation.</summary>
public sealed record SeedHostServiceOperationReport(
    string Operation,
    string Platform,
    string FleetId,
    IReadOnlyList<string> ServiceNames,
    bool ModelsRetained,
    bool Succeeded);

/// <summary>Creates OS-native lane definitions without installing or starting them.</summary>
public sealed class SeedHostServicePlanner
{
    private readonly IMiniModelAuthority authority;

    /// <summary>Create a planner over the authoritative MiniModel fleet validator.</summary>
    public SeedHostServicePlanner(IMiniModelAuthority authority)
    {
        ArgumentNullException.ThrowIfNull(authority);
        this.authority = authority;
    }

    /// <summary>Validate every executable and fleet path, then create a stable two-lane plan.</summary>
    public SeedHostServicePlan Create(SeedHostServiceOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var configurationPath = RequireRegularFile(
            options.ConfigurationPath,
            "invalid_configuration_path");
        var toolPath = RequireRegularFile(options.ToolExecutablePath, "invalid_tool_path");
        var miniModelPath = RequireRegularFile(
            options.MiniModelExecutablePath,
            "invalid_minimodel_path");
        _ = authority.InspectSeedFleet(configurationPath);
        var configuration = SeedFleetConfiguration.Parse(File.ReadAllText(configurationPath));
        var prefix = NormalizeServicePrefix(options.ServiceNamePrefix, configuration.FleetId);
        var root = Path.GetDirectoryName(configurationPath)
            ?? throw new SeedHostValidationException(
                "invalid_configuration_path",
                "Fleet configuration must have a parent directory.");
        var definitionRoot = Path.Combine(root, ".seed-host-service");
        var platform = OperatingSystem.IsWindows()
            ? "windows-scheduled-task"
            : OperatingSystem.IsLinux()
                ? "linux-systemd-user"
                : throw new PlatformNotSupportedException(
                    "Seed-host service installation supports Windows and Linux.");
        var definitions = configuration.Lanes
            .OrderBy(lane => lane.LaneId, StringComparer.Ordinal)
            .Select(lane => OperatingSystem.IsWindows()
                ? WindowsDefinition(
                    prefix,
                    lane.LaneId,
                    definitionRoot,
                    configurationPath,
                    toolPath,
                    miniModelPath)
                : SystemdDefinition(
                    prefix,
                    lane.LaneId,
                    definitionRoot,
                    configurationPath,
                    toolPath,
                    miniModelPath,
                    root))
            .ToArray();
        return new SeedHostServicePlan(
            platform,
            configuration.FleetId,
            configurationPath,
            toolPath,
            miniModelPath,
            definitions);
    }

    private static SeedHostServiceDefinition WindowsDefinition(
        string prefix,
        string laneId,
        string definitionRoot,
        string configurationPath,
        string toolPath,
        string miniModelPath)
    {
        var serviceName = $"\\UAIX\\TinyRustLM\\SeedHost\\{prefix}-{laneId}";
        var arguments = string.Join(' ', new[]
        {
            "serve-lane",
            "--lane-id", QuoteWindowsArgument(laneId),
            "--config", QuoteWindowsArgument(configurationPath),
            "--minimodel", QuoteWindowsArgument(miniModelPath)
        });
        var command = SecurityElement.Escape(toolPath)
            ?? throw new SeedHostValidationException("invalid_tool_path", "Tool path is not XML-safe.");
        var escapedArguments = SecurityElement.Escape(arguments)
            ?? throw new SeedHostValidationException("invalid_service_arguments", "Service arguments are not XML-safe.");
        var content = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
              <RegistrationInfo>
                <Description>UAIX TinyRustLM MiniModel seed lane {laneId}</Description>
              </RegistrationInfo>
              <Triggers>
                <LogonTrigger><Enabled>true</Enabled></LogonTrigger>
              </Triggers>
              <Principals>
                <Principal id="Author">
                  <LogonType>InteractiveToken</LogonType>
                  <RunLevel>LeastPrivilege</RunLevel>
                </Principal>
              </Principals>
              <Settings>
                <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
                <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
                <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
                <StartWhenAvailable>true</StartWhenAvailable>
                <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
                <RestartOnFailure><Interval>PT1M</Interval><Count>5</Count></RestartOnFailure>
              </Settings>
              <Actions Context="Author">
                <Exec><Command>{command}</Command><Arguments>{escapedArguments}</Arguments></Exec>
              </Actions>
            </Task>
            """ + Environment.NewLine;
        return new SeedHostServiceDefinition(
            serviceName,
            laneId,
            Path.Combine(definitionRoot, $"{prefix}-{laneId}.task.xml"),
            content);
    }

    private static SeedHostServiceDefinition SystemdDefinition(
        string prefix,
        string laneId,
        string definitionRoot,
        string configurationPath,
        string toolPath,
        string miniModelPath,
        string fleetRoot)
    {
        var serviceName = $"uaix-tinyrustlm-seed-{prefix}-{laneId}.service";
        var content = $"""
            [Unit]
            Description=UAIX TinyRustLM MiniModel seed lane {laneId}
            After=network-online.target
            Wants=network-online.target

            [Service]
            Type=simple
            ExecStart={QuoteSystemdArgument(toolPath)} serve-lane --lane-id {QuoteSystemdArgument(laneId)} --config {QuoteSystemdArgument(configurationPath)} --minimodel {QuoteSystemdArgument(miniModelPath)}
            Restart=on-failure
            RestartSec=5s
            NoNewPrivileges=true
            PrivateTmp=true
            ProtectSystem=strict
            ProtectHome=read-only
            ReadOnlyPaths={QuoteSystemdArgument(fleetRoot)}
            ReadWritePaths={QuoteSystemdArgument(Path.Combine(fleetRoot, ".seed-host-runtime"))}

            [Install]
            WantedBy=default.target
            """ + Environment.NewLine;
        return new SeedHostServiceDefinition(
            serviceName,
            laneId,
            Path.Combine(definitionRoot, serviceName),
            content);
    }

    private static string NormalizeServicePrefix(string? requested, string fleetId)
    {
        var source = string.IsNullOrWhiteSpace(requested) ? fleetId : requested;
        if (source.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "invalid_service_name",
                "Service name prefix cannot contain an embedded NUL character.");
        }
        var normalized = new string(source
            .ToLowerInvariant()
            .Select(character => char.IsAsciiLetterOrDigit(character) ? character : '-')
            .ToArray()).Trim('-');
        while (normalized.Contains("--", StringComparison.Ordinal))
        {
            normalized = normalized.Replace("--", "-", StringComparison.Ordinal);
        }
        if (normalized.Length is < 1 or > 48)
        {
            throw new SeedHostValidationException(
                "invalid_service_name",
                "Service name prefix must normalize to 1 through 48 ASCII characters.");
        }
        return normalized;
    }

    private static string RequireRegularFile(string path, string errorCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        if (path.Contains('\0'))
        {
            throw new SeedHostValidationException(errorCode, "Service file path contains embedded NUL.");
        }
        var absolute = Path.GetFullPath(path);
        var information = new FileInfo(absolute);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                errorCode,
                "Service file path must identify a regular non-link file.");
        }
        return absolute;
    }

    private static string QuoteWindowsArgument(string value) =>
        value.Any(character => char.IsWhiteSpace(character) || character == '"')
            ? $"\"{value.Replace("\"", "\\\"", StringComparison.Ordinal)}\""
            : value;

    private static string QuoteSystemdArgument(string value) =>
        $"\"{value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal)}\"";
}

/// <summary>Installs and controls only service definitions produced by <see cref="SeedHostServicePlanner"/>.</summary>
public sealed class SeedHostServiceManager
{
    private readonly ProcessRunOptions processOptions = new(TimeSpan.FromSeconds(30), 64 * 1024);

    /// <summary>Write owned definitions and idempotently register both lane services.</summary>
    public async Task<SeedHostServiceOperationReport> InstallAsync(
        SeedHostServicePlan plan,
        CancellationToken cancellationToken = default)
    {
        ValidatePlan(plan);
        foreach (var definition in plan.Definitions)
        {
            WriteDefinitionAtomically(definition);
        }
        if (OperatingSystem.IsWindows())
        {
            foreach (var definition in plan.Definitions)
            {
                await RunRequiredAsync(
                    "schtasks.exe",
                    ["/Create", "/F", "/TN", definition.ServiceName, "/XML", definition.OwnedDefinitionPath],
                    Path.GetDirectoryName(plan.ConfigurationPath),
                    "service_install_failed",
                    cancellationToken).ConfigureAwait(false);
            }
        }
        else if (OperatingSystem.IsLinux())
        {
            var unitDirectory = UserSystemdDirectory();
            Directory.CreateDirectory(unitDirectory);
            foreach (var definition in plan.Definitions)
            {
                var installedPath = Path.Combine(unitDirectory, definition.ServiceName);
                WriteTextAtomically(installedPath, definition.DefinitionContent);
            }
            await RunRequiredAsync(
                "systemctl",
                ["--user", "daemon-reload"],
                null,
                "service_install_failed",
                cancellationToken).ConfigureAwait(false);
            await RunRequiredAsync(
                "systemctl",
                ["--user", "enable", "--now", .. plan.Definitions.Select(value => value.ServiceName)],
                null,
                "service_install_failed",
                cancellationToken).ConfigureAwait(false);
        }
        else
        {
            throw new PlatformNotSupportedException("Seed-host services support Windows and Linux.");
        }
        return Report("install", plan);
    }

    /// <summary>Start both previously installed lane definitions.</summary>
    public Task<SeedHostServiceOperationReport> StartAsync(
        SeedHostServicePlan plan,
        CancellationToken cancellationToken = default) =>
        ControlAsync("start", plan, cancellationToken);

    /// <summary>Stop both lane definitions without deleting models or fleet configuration.</summary>
    public Task<SeedHostServiceOperationReport> StopAsync(
        SeedHostServicePlan plan,
        CancellationToken cancellationToken = default) =>
        ControlAsync("stop", plan, cancellationToken);

    /// <summary>Restart both lane definitions through the platform service manager.</summary>
    public async Task<SeedHostServiceOperationReport> RestartAsync(
        SeedHostServicePlan plan,
        CancellationToken cancellationToken = default)
    {
        _ = await StopAsync(plan, cancellationToken).ConfigureAwait(false);
        _ = await StartAsync(plan, cancellationToken).ConfigureAwait(false);
        return Report("restart", plan);
    }

    /// <summary>Remove only owned service definitions and retain all model and fleet data.</summary>
    public async Task<SeedHostServiceOperationReport> UninstallAsync(
        SeedHostServicePlan plan,
        CancellationToken cancellationToken = default)
    {
        ValidatePlan(plan);
        if (OperatingSystem.IsWindows())
        {
            foreach (var definition in plan.Definitions)
            {
                _ = await RunOptionalAsync(
                    "schtasks.exe",
                    ["/End", "/TN", definition.ServiceName],
                    cancellationToken).ConfigureAwait(false);
                _ = await RunOptionalAsync(
                    "schtasks.exe",
                    ["/Delete", "/F", "/TN", definition.ServiceName],
                    cancellationToken).ConfigureAwait(false);
                DeleteOwnedDefinition(definition.OwnedDefinitionPath);
            }
        }
        else if (OperatingSystem.IsLinux())
        {
            _ = await RunOptionalAsync(
                "systemctl",
                ["--user", "disable", "--now", .. plan.Definitions.Select(value => value.ServiceName)],
                cancellationToken).ConfigureAwait(false);
            var unitDirectory = UserSystemdDirectory();
            foreach (var definition in plan.Definitions)
            {
                DeleteOwnedDefinition(Path.Combine(unitDirectory, definition.ServiceName));
                DeleteOwnedDefinition(definition.OwnedDefinitionPath);
            }
            await RunRequiredAsync(
                "systemctl",
                ["--user", "daemon-reload"],
                null,
                "service_uninstall_failed",
                cancellationToken).ConfigureAwait(false);
        }
        else
        {
            throw new PlatformNotSupportedException("Seed-host services support Windows and Linux.");
        }
        return Report("uninstall", plan);
    }

    private async Task<SeedHostServiceOperationReport> ControlAsync(
        string operation,
        SeedHostServicePlan plan,
        CancellationToken cancellationToken)
    {
        ValidatePlan(plan);
        if (OperatingSystem.IsWindows())
        {
            foreach (var definition in plan.Definitions)
            {
                var verb = operation == "start" ? "/Run" : "/End";
                await RunRequiredAsync(
                    "schtasks.exe",
                    [verb, "/TN", definition.ServiceName],
                    null,
                    $"service_{operation}_failed",
                    cancellationToken).ConfigureAwait(false);
            }
        }
        else if (OperatingSystem.IsLinux())
        {
            await RunRequiredAsync(
                "systemctl",
                ["--user", operation, .. plan.Definitions.Select(value => value.ServiceName)],
                null,
                $"service_{operation}_failed",
                cancellationToken).ConfigureAwait(false);
        }
        else
        {
            throw new PlatformNotSupportedException("Seed-host services support Windows and Linux.");
        }
        return Report(operation, plan);
    }

    private async Task RunRequiredAsync(
        string executable,
        IReadOnlyList<string> arguments,
        string? workingDirectory,
        string errorCode,
        CancellationToken cancellationToken)
    {
        var result = await BoundedProcessRunner.RunAsync(
            new ProcessCommand(executable, arguments, workingDirectory),
            processOptions,
            cancellationToken).ConfigureAwait(false);
        if (result.ExitCode != 0)
        {
            throw new SeedHostException(
                errorCode,
                $"Operating-system service command failed with exit code {result.ExitCode}. {result.StandardError}");
        }
    }

    private async Task<ProcessRunResult> RunOptionalAsync(
        string executable,
        IReadOnlyList<string> arguments,
        CancellationToken cancellationToken) =>
        await BoundedProcessRunner.RunAsync(
            new ProcessCommand(executable, arguments),
            processOptions,
            cancellationToken).ConfigureAwait(false);

    private static void WriteDefinitionAtomically(SeedHostServiceDefinition definition)
    {
        var directory = Path.GetDirectoryName(definition.OwnedDefinitionPath)
            ?? throw new SeedHostValidationException(
                "invalid_service_definition_path",
                "Service definition must have a parent directory.");
        Directory.CreateDirectory(directory);
        var information = new DirectoryInfo(directory);
        if ((information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "unsafe_service_definition_directory",
                "Service definition directory cannot be a link or reparse point.");
        }
        WriteTextAtomically(definition.OwnedDefinitionPath, definition.DefinitionContent);
    }

    private static void WriteTextAtomically(string path, string content)
    {
        var temporary = path + $".tmp-{Guid.NewGuid():N}";
        try
        {
            using (var stream = new FileStream(
                temporary,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                16 * 1024,
                FileOptions.WriteThrough))
            {
                var bytes = new UTF8Encoding(false).GetBytes(content);
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static void DeleteOwnedDefinition(string path)
    {
        if (!File.Exists(path))
        {
            return;
        }
        var information = new FileInfo(path);
        if ((information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "unsafe_service_definition",
                "Refusing to remove a linked service definition.");
        }
        File.Delete(path);
    }

    private static string UserSystemdDirectory()
    {
        var configHome = Environment.GetEnvironmentVariable("XDG_CONFIG_HOME");
        if (string.IsNullOrWhiteSpace(configHome))
        {
            configHome = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".config");
        }
        return Path.Combine(configHome, "systemd", "user");
    }

    private static void ValidatePlan(SeedHostServicePlan plan)
    {
        ArgumentNullException.ThrowIfNull(plan);
        if (plan.Definitions is null
            || plan.Definitions.Count != SeedFleetConfiguration.RequiredReplicaLaneCount
            || plan.Definitions.Select(value => value.LaneId).Distinct(StringComparer.Ordinal).Count()
                != SeedFleetConfiguration.RequiredReplicaLaneCount)
        {
            throw new SeedHostValidationException(
                "invalid_service_plan",
                "Service plan must contain exactly two distinct lane definitions.");
        }
    }

    private static SeedHostServiceOperationReport Report(
        string operation,
        SeedHostServicePlan plan) => new(
            operation,
            plan.Platform,
            plan.FleetId,
            plan.Definitions.Select(value => value.ServiceName).ToArray(),
            ModelsRetained: true,
            Succeeded: true);
}
