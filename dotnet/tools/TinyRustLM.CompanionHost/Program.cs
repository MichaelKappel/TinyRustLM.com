using TinyRustLM.Companion;

const string failurePrefix = "tinyrustlm-companion-host-failed:";

if (args.Length != 0)
{
    Console.Error.WriteLine($"{failurePrefix}arguments-invalid");
    return 2;
}

if (!Environment.UserInteractive || Console.IsOutputRedirected)
{
    Console.Error.WriteLine($"{failurePrefix}interactive-output-required");
    return 2;
}

using var shutdown = new CancellationTokenSource();
ConsoleCancelEventHandler cancelHandler = (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    shutdown.Cancel();
};
EventHandler processExitHandler = (_, _) => shutdown.Cancel();
Console.CancelKeyPress += cancelHandler;
AppDomain.CurrentDomain.ProcessExit += processExitHandler;

try
{
    var stateRoot = ResolveStateRoot();
    var identity = CompanionInstallation.OpenOrCreate(stateRoot);
    await using var operations =
        CompanionProductionOperationRuntime.OpenFromPackageLayout(stateRoot);
    await using var seeds =
        CompanionProductionSeedRuntime.OpenFromPackageLayout(stateRoot);
    await using var server = await CompanionLoopbackServer.StartAsync(
        identity,
        operationService: operations.OperationService,
        seedService: seeds.SeedService,
        cancellationToken: shutdown.Token).ConfigureAwait(false);

    var pairingCode = server.IssuePairingCode().Code;
    Console.Out.WriteLine(pairingCode);
    Console.Out.Flush();
    pairingCode = string.Empty;

    try
    {
        await Task.Delay(Timeout.InfiniteTimeSpan, shutdown.Token).ConfigureAwait(false);
    }
    catch (OperationCanceledException) when (shutdown.IsCancellationRequested)
    {
        // Normal interactive or process shutdown.
    }

    return 0;
}
catch (OperationCanceledException) when (shutdown.IsCancellationRequested)
{
    return 0;
}
catch (CompanionProtocolException exception)
{
    Console.Error.WriteLine($"{failurePrefix}{PublicStartupCode(exception.Code)}");
    return 1;
}
catch (Exception)
{
    Console.Error.WriteLine($"{failurePrefix}unexpected-failure");
    return 1;
}
finally
{
    Console.CancelKeyPress -= cancelHandler;
    AppDomain.CurrentDomain.ProcessExit -= processExitHandler;
}

static string ResolveStateRoot()
{
    string parent;
    try
    {
        parent = Environment.GetFolderPath(
            Environment.SpecialFolder.LocalApplicationData,
            Environment.SpecialFolderOption.DoNotVerify);
    }
    catch (Exception exception) when (
        exception is ArgumentException or PlatformNotSupportedException)
    {
        throw new CompanionProtocolException("installation-root-parent");
    }

    if (string.IsNullOrWhiteSpace(parent) ||
        !Path.IsPathFullyQualified(parent) ||
        !Directory.Exists(parent))
    {
        throw new CompanionProtocolException("installation-root-parent");
    }

    return Path.Combine(Path.GetFullPath(parent), "TinyRustLM.Companion");
}

static string PublicStartupCode(string code) => code switch
{
    "installation-root-invalid" or
    "installation-root-parent" or
    "installation-record-missing-nonempty-root" or
    "installation-platform-unsupported" or
    "installation-record-create" or
    "installation-record-wire" or
    "installation-record-file" or
    "installation-record-size" or
    "installation-record-canonical" or
    "installation-record-schema" or
    "installation-record-id" or
    "installation-permissions" or
    "installation-owner" or
    "process-instance-id" or
    "host-invalid" or
    "converter-tool-missing" or
    "converter-tool-invalid" or
    "operation-worker-asset-missing" or
    "operation-worker-asset-invalid" or
    "operation-platform-unsupported" or
    "companion-operation-state-root" or
    "operation-journal-invalid" or
    "companion-operation-work-root" or
    "source-lock-assets-invalid" or
    "source-descriptor-invalid" or
    "direct-composition-seed-state-invalid" or
    "direct-composition-seed-tool-invalid" or
    "direct-composition-seed-platform-unsupported" or
    "companion-unavailable" => code,
    _ => "unexpected-failure"
};
