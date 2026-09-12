using System.Reflection;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text.Json;
using TinyRustLM;
using TinyRustLM.Companion;

internal static class Program
{
    private const string HostSchema =
        "tinyrustlm.test.companion-direct-seed-wire-host.v1";
    private static string _dependencyRoot = string.Empty;

    // Accept only the canonical test assembly and operation-owned state root.
    public static async Task<int> Main(string[] args)
    {
        if (args.Length != 2)
        {
            Console.Error.WriteLine("direct-seed-wire-host-failed:arguments");
            return 2;
        }

        try
        {
            _dependencyRoot = Path.GetDirectoryName(Path.GetFullPath(args[0]))
                ?? throw new InvalidOperationException();
            AssemblyLoadContext.Default.Resolving += ResolveDependency;
            return await RunAsync(
                Path.GetFullPath(args[0]),
                Path.GetFullPath(args[1])).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            var observed = exception is TargetInvocationException { InnerException: { } inner }
                ? inner
                : exception;
            var code = observed is CompanionProtocolException protocol
                ? protocol.Code
                : observed.GetType().Name;
            Console.Error.WriteLine($"direct-seed-wire-host-failed:{code}");
            return 1;
        }
        finally
        {
            AssemblyLoadContext.Default.Resolving -= ResolveDependency;
        }
    }

    // Host the production loopback service over five synthetic journal operations.
    private static async Task<int> RunAsync(
        string testAssemblyPath,
        string fixtureRoot)
    {
        Directory.CreateDirectory(fixtureRoot);
        var tests = AssemblyLoadContext.Default.LoadFromAssemblyPath(testAssemblyPath);
        var harnessType = RequiredType(
            tests,
            "TinyRustLM.Companion.Tests.CompanionDirectCompositionSeedTestHarness");
        var createHarness = RequiredMethod(
            harnessType,
            "CreateAsync",
            BindingFlags.Static | BindingFlags.NonPublic,
            3);

        object? harness = null;
        CompanionDirectCompositionSeedService? seeds = null;
        CompanionLoopbackServer? server = null;
        try
        {
            harness = await AwaitResultAsync(createHarness.Invoke(
                null,
                [fixtureRoot, "success", true])).ConfigureAwait(false);
            var firstOperationId = RequiredStringProperty(harness, "OperationId");
            var variantOperationId = await CreateVariantOperationAsync(
                tests,
                harness).ConfigureAwait(false);
            var addAvailable = RequiredMethod(
                harnessType,
                "AddAvailableOperationAsync",
                BindingFlags.Instance | BindingFlags.NonPublic,
                1);
            var thirdOperationId = (string)await AwaitResultAsync(
                addAvailable.Invoke(harness, ['c'])).ConfigureAwait(false);
            var fourthOperationId = (string)await AwaitResultAsync(
                addAvailable.Invoke(harness, ['d'])).ConfigureAwait(false);
            var fifthOperationId = (string)await AwaitResultAsync(
                addAvailable.Invoke(harness, ['e'])).ConfigureAwait(false);

            var createService = RequiredMethod(
                harnessType,
                "CreateService",
                BindingFlags.Instance | BindingFlags.NonPublic,
                1);
            seeds = (CompanionDirectCompositionSeedService)(createService.Invoke(
                harness,
                [null]) ?? throw new InvalidOperationException());
            var identity = new CompanionInstallationIdentity(
                fixtureRoot,
                RandomHex(16),
                RandomHex(16));
            server = await CompanionLoopbackServer.StartAsync(
                identity,
                operationService: null,
                seedService: seeds,
                cancellationToken: default).ConfigureAwait(false);

            var processEvidencePath = RequiredStringProperty(
                harness,
                "ProcessEvidencePath");
            var metadata = new
            {
                schema = HostSchema,
                localOnly = true,
                fixtureKind = "synthetic-immutable-composition",
                host = server.Host,
                pairingCode = server.IssuePairingCode().Code,
                operationIds = new[]
                {
                    firstOperationId,
                    variantOperationId,
                    thirdOperationId,
                    fourthOperationId,
                    fifthOperationId
                },
                processEvidencePath
            };
            Console.Out.WriteLine(JsonSerializer.Serialize(metadata));
            Console.Out.Flush();

            var command = await Console.In.ReadLineAsync().ConfigureAwait(false);
            return command == "shutdown" ? 0 : 3;
        }
        finally
        {
            if (server is not null)
            {
                await server.DisposeAsync().ConfigureAwait(false);
            }
            if (seeds is not null)
            {
                await seeds.DisposeAsync().ConfigureAwait(false);
            }
            if (harness is IAsyncDisposable asyncDisposable)
            {
                await asyncDisposable.DisposeAsync().ConfigureAwait(false);
            }
        }
    }

    // Produce a second synthetic composition identity through the same canonical fixture.
    private static async Task<string> CreateVariantOperationAsync(
        Assembly tests,
        object harness)
    {
        var fixture = RequiredField(harness, "_fixture");
        var fixtureParent = RequiredStringProperty(fixture, "Parent");
        var operationRoot = Path.Combine(fixtureParent, "operation-b");
        Directory.CreateDirectory(operationRoot);
        var lockRoot = Path.Combine(operationRoot, "source-locks");
        Directory.CreateDirectory(lockRoot);
        var modelLockPath = Path.Combine(lockRoot, "model-source-lock.json");
        var tokenizerLockPath = Path.Combine(lockRoot, "tokenizer-source-lock.json");
        File.Copy(RequiredStringProperty(fixture, "ModelSourceLockPath"), modelLockPath);
        File.Copy(
            RequiredStringProperty(fixture, "TokenizerSourceLockPath"),
            tokenizerLockPath);
        var modelSourceRoot = RequiredStringProperty(fixture, "ModelSourceDirectory");
        var tokenizerSourceRoot = RequiredStringProperty(
            fixture,
            "TokenizerSourceDirectory");
        var outputRoot = Path.Combine(operationRoot, "composition-output");
        var journal = (CompanionOperationJournal)RequiredProperty(fixture, "Journal");

        var contractType = RequiredType(
            tests,
            "TinyRustLM.Companion.Tests.CompanionContractTests");
        var requestFactory = RequiredMethod(
            contractType,
            "Request",
            BindingFlags.Static | BindingFlags.NonPublic,
            0);
        var template = (CompanionAcquireRequest)(requestFactory.Invoke(null, null)
            ?? throw new InvalidOperationException());
        var request = template with { AttemptId = new string('b', 32) };
        var created = journal.CreateOrRead(request);
        // Vary synthetic input data through the canonical fixture, never by rewriting its source.
        File.WriteAllText(
            Path.Combine(modelSourceRoot, ".tinyrustlm-conversion-fixture-scenario"),
            "rust-seed-variant-pass");
        var toolPath = RequiredMethod(fixture.GetType(), "FixtureToolPath",
            BindingFlags.Static | BindingFlags.NonPublic, 0).Invoke(null, null) as string
            ?? throw new InvalidOperationException();
        var tool = new TinyRustLmConversionTool(toolPath);
        var conversionIntent = tool.CreateCompositionIntent(
            new TinyRustLmCompositionConversionRequest(
                modelLockPath,
                request.ModelSourceLockSha256,
                modelSourceRoot,
                tokenizerLockPath,
                request.TokenizerSourceLockSha256,
                tokenizerSourceRoot,
                request.CompositionProfileSha256,
                outputRoot));

        var evidenceType = RequiredType(
            tests,
            "TinyRustLM.Companion.Tests.CompanionOperationTestEvidence");
        var enterAcquiring = RequiredMethod(
            evidenceType,
            "EnterAcquiringSource",
            BindingFlags.Static | BindingFlags.NonPublic,
            8);
        var evidence = enterAcquiring.Invoke(
            null,
            [
                journal,
                created,
                operationRoot,
                modelSourceRoot,
                tokenizerSourceRoot,
                outputRoot,
                conversionIntent.ConverterExecutableSha256,
                null
            ]) ?? throw new InvalidOperationException();
        var persistSourceReceipt = RequiredMethod(
            evidenceType,
            "PersistSourceReceipt",
            BindingFlags.Static | BindingFlags.NonPublic,
            7);
        _ = persistSourceReceipt.Invoke(
            null,
            [
                journal,
                created,
                evidence,
                modelSourceRoot,
                tokenizerSourceRoot,
                null,
                null
            ]);

        var conversion = new CompanionSourceConversion(journal, tool);
        _ = await conversion.RunAsync(
            created.OperationId,
            new CompanionSourceConversionRequest(
                modelLockPath,
                modelSourceRoot,
                tokenizerLockPath,
                tokenizerSourceRoot,
                outputRoot)).ConfigureAwait(false);
        return created.OperationId;
    }

    // Resolve test-only dependencies beside the explicitly selected test assembly.
    private static Assembly? ResolveDependency(
        AssemblyLoadContext context,
        AssemblyName name)
    {
        var candidate = Path.Combine(_dependencyRoot, $"{name.Name}.dll");
        return File.Exists(candidate) ? context.LoadFromAssemblyPath(candidate) : null;
    }

    // Require one exact internal test type; never fall back to another harness.
    private static Type RequiredType(Assembly assembly, string name) =>
        assembly.GetType(name, throwOnError: true, ignoreCase: false)
        ?? throw new InvalidOperationException();

    // Bind a single reflected method by name, flags and parameter count.
    private static MethodInfo RequiredMethod(
        Type type,
        string name,
        BindingFlags flags,
        int parameterCount) =>
        type.GetMethods(flags).Single(method =>
            method.Name == name && method.GetParameters().Length == parameterCount);

    // Read one private fixture field needed by this integration boundary.
    private static object RequiredField(object value, string name) =>
        value.GetType().GetField(
            name,
            BindingFlags.Instance | BindingFlags.NonPublic)?.GetValue(value)
        ?? throw new InvalidOperationException();

    // Resolve one named fixture property without implementation substitution.
    private static object RequiredProperty(object value, string name) =>
        value.GetType().GetProperty(
            name,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)?.GetValue(value)
        ?? throw new InvalidOperationException();

    // Require string-valued fixture paths and identities.
    private static string RequiredStringProperty(object value, string name) =>
        RequiredProperty(value, name) as string ?? throw new InvalidOperationException();

    // Await a reflected Task and require its typed result.
    private static async Task<object> AwaitResultAsync(object? value)
    {
        if (value is not Task task)
        {
            throw new InvalidOperationException();
        }
        await task.ConfigureAwait(false);
        return task.GetType().GetProperty("Result")?.GetValue(task)
            ?? throw new InvalidOperationException();
    }

    // Create a fresh bounded test identity for this local host instance.
    private static string RandomHex(int byteCount) =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(byteCount)).ToLowerInvariant();
}
