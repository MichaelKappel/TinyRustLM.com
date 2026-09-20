using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class ConversionToolTests
{
    /// <summary>Bounds apply to accumulated bytes, including short reads and an exact-limit EOF.</summary>
    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 1)]
    [InlineData(4096, 4096)]
    [InlineData(4097, 4096)]
    public async Task BoundedOutputEnforcesExactByteLimit(int length, int limit)
    {
        var bytes = Enumerable.Range(0, length).Select(index => (byte)(index % 251)).ToArray();
        using var stream = new ObservedAsyncReadStream(bytes, 7);
        using var cancellation = new CancellationTokenSource();
        if (length <= limit)
        {
            Assert.Equal(bytes, await TinyRustLmConversionTool.ReadBoundedAsync(stream, limit, cancellation.Token));
        }
        else
        {
            var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
                TinyRustLmConversionTool.ReadBoundedAsync(stream, limit, cancellation.Token));
            Assert.Equal("converter-output-limit", error.Code);
        }
        Assert.Equal(cancellation.Token, stream.LastToken);
        Assert.InRange(stream.MaximumRequestedBytes, 1, 4096);
        Assert.True(stream.CanRead);
    }

    /// <summary>Even streams ignoring their token cannot return late data or EOF after cancellation.</summary>
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task BoundedOutputRejectsLateReadAfterCancellation(int cancelOnRead)
    {
        using var cancellation = new CancellationTokenSource();
        using var stream = new ObservedAsyncReadStream(new byte[5], 3, read =>
        {
            if (read == cancelOnRead) cancellation.Cancel();
        });
        if (cancelOnRead == 0) cancellation.Cancel();
        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            TinyRustLmConversionTool.ReadBoundedAsync(stream, 10, cancellation.Token));
        Assert.Equal(cancellation.Token, error.CancellationToken);
        Assert.Equal(cancelOnRead, stream.Reads);
        Assert.True(stream.CanRead);
    }

    /// <summary>Cancellation must reach the pending read itself, not only the next loop iteration.</summary>
    [Fact]
    public async Task BoundedOutputCancelsAnOutstandingRead()
    {
        using var cancellation = new CancellationTokenSource();
        using var stream = new StalledReadStream();
        var read = TinyRustLmConversionTool.ReadBoundedAsync(stream, 10, cancellation.Token);
        await stream.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        cancellation.Cancel();
        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => read.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Equal(cancellation.Token, error.CancellationToken);
        Assert.True(stream.CanRead);
    }

    /// <summary>Partial output followed by an I/O fault is a fault, never a successful truncated body.</summary>
    [Fact]
    public async Task BoundedOutputPreservesReadFailure()
    {
        var failure = new IOException("fixture-output-read");
        using var stream = new ObservedAsyncReadStream(new byte[5], 3, read =>
        {
            if (read == 2) throw failure;
        });
        Assert.Same(failure, await Assert.ThrowsAsync<IOException>(() =>
            TinyRustLmConversionTool.ReadBoundedAsync(stream, 10, CancellationToken.None)));
        Assert.Equal(2, stream.Reads);
        Assert.True(stream.CanRead);
    }

    /// <summary>An exited converter cannot keep observation alive through inherited descendant pipes.</summary>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ExitedConverterWithOpenPipesHonorsCallerAndDeadline(bool cancelCaller)
    {
        using var fixture = new ConversionFixture("held-output");
        var policy = new TinyRustLmConversionPolicy(
            TimeSpan.FromSeconds(cancelCaller ? 20 : 5), 65_536, 4096);
        var tool = fixture.Tool(policy);
        var intent = tool.CreateCompositionIntent(fixture.Request());
        using var cancellation = new CancellationTokenSource();
        var conversion = tool.ConvertCompositionAsync(intent, cancellation.Token);
        Process? parent = null;
        Process? child = null;
        try
        {
            var control = Path.Combine(fixture.ModelSourceDirectory, "pipe-processes.json");
            using var admission = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            string? controlBytes = null;
            while (controlBytes is null)
            {
                try
                {
                    controlBytes = await File.ReadAllTextAsync(control, admission.Token);
                    using var probe = JsonDocument.Parse(controlBytes);
                }
                catch (Exception error) when (error is IOException or JsonException)
                {
                    controlBytes = null;
                    await Task.Delay(20, admission.Token);
                }
            }
            using var identities = JsonDocument.Parse(controlBytes);
            parent = Process.GetProcessById(identities.RootElement.GetProperty("parentId").GetInt32());
            child = Process.GetProcessById(identities.RootElement.GetProperty("childId").GetInt32());
            Assert.Equal(intent.ConverterExecutablePath, parent.MainModule!.FileName);
            Assert.Equal(intent.ConverterExecutablePath, child.MainModule!.FileName);
            File.WriteAllText(Path.Combine(fixture.ModelSourceDirectory, "release-parent"), "exit");
            await parent.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
            Assert.False(child.HasExited);
            Assert.False(conversion.IsCompleted);

            if (cancelCaller)
            {
                cancellation.Cancel();
                var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
                    conversion.WaitAsync(TimeSpan.FromSeconds(8)));
                Assert.Equal(cancellation.Token, error.CancellationToken);
            }
            else
            {
                var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
                    conversion.WaitAsync(TimeSpan.FromSeconds(8)));
                Assert.Equal("converter-timeout", error.Code);
            }
            Assert.Equal("preserved\n", File.ReadAllText(Path.Combine(fixture.OutputRoot, "composition.attempt.json")));
        }
        finally
        {
            cancellation.Cancel();
            // The test owns the descendant independently; production does not adopt orphan PIDs.
            foreach (var ownedProcess in new[] { parent, child })
            {
                if (ownedProcess is null) continue;
                if (!ownedProcess.HasExited) ownedProcess.Kill(entireProcessTree: true);
                await ownedProcess.WaitForExitAsync();
                ownedProcess.Dispose();
            }
            try { await conversion; }
            catch (Exception error) when (error is OperationCanceledException or TinyRustLmException) { }
        }
    }

    /// <summary>Chunk boundaries and short reads must not change the standard SHA-256 identity.</summary>
    [Theory]
    [InlineData(0, 3, false)]
    [InlineData(1, 3, true)]
    [InlineData(257, 3, true)]
    [InlineData(1_048_576, 1_048_576, false)]
    [InlineData(1_048_583, 1_048_576, true)]
    public void StreamHashMatchesIndependentDigestAndLeavesStreamOpen(
        int length, int maximumRead, bool supplyToken)
    {
        var payload = Enumerable.Range(0, length + 2).Select(value => (byte)(value % 251)).ToArray();
        using var stream = new ObservedReadStream(payload, maximumRead);
        stream.Position = 2;
        using var cancellation = new CancellationTokenSource();

        var digest = supplyToken
            ? TinyRustLmConversionTool.Sha256Stream(stream, cancellation.Token)
            : TinyRustLmConversionTool.Sha256Stream(stream);

        Assert.Equal(Convert.ToHexString(SHA256.HashData(payload.AsSpan(2))).ToLowerInvariant(), digest);
        Assert.Equal(payload.Length, stream.Position);
        Assert.InRange(stream.MaximumRequestedBytes, 1, 1_048_576);
        Assert.True(stream.CanRead);
    }

    /// <summary>Cancellation on entry, partial data, or EOF must stop reads and preserve the token.</summary>
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void StreamHashStopsAtCancellationIncludingEof(int cancelOnRead)
    {
        using var cancellation = new CancellationTokenSource();
        using var stream = new ObservedReadStream(new byte[5], 3, read =>
        {
            if (read == cancelOnRead) cancellation.Cancel();
        });
        if (cancelOnRead == 0) cancellation.Cancel();

        var error = Assert.Throws<OperationCanceledException>(() =>
            TinyRustLmConversionTool.Sha256Stream(stream, cancellation.Token));

        Assert.Equal(cancellation.Token, error.CancellationToken);
        Assert.Equal(cancelOnRead, stream.Reads);
        Assert.True(stream.CanRead);
    }

    /// <summary>A read error after partial input cannot become a digest or close the caller's stream.</summary>
    [Fact]
    public void StreamHashPreservesReadFailure()
    {
        var failure = new IOException("fixture-read-failure");
        using var stream = new ObservedReadStream(new byte[5], 3, read =>
        {
            if (read == 2) throw failure;
        });

        Assert.Same(failure, Assert.Throws<IOException>(() => TinyRustLmConversionTool.Sha256Stream(stream)));
        Assert.Equal(2, stream.Reads);
        Assert.True(stream.CanRead);
    }

    /// <summary>A stopped caller must not inspect changed inputs or launch a converter.</summary>
    [Fact]
    public async Task PrecancelledConversionDoesNotRevalidateInputsOrCreateOutput()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        File.Delete(fixture.ModelSourceLockPath);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            tool.ConvertCompositionAsync(intent, cancellation.Token));

        Assert.Equal(cancellation.Token, error.CancellationToken);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task CompleteCompositionVerifiesSummaryReceiptLineageAndAllSixArtifacts()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        var result = await tool.ConvertCompositionAsync(intent);
        var composition = result.Composition;

        Assert.Equal(TinyRustLmConversionTool.VerifiedCompositionSchema, composition.Schema);
        Assert.StartsWith("qwen3-composition-", composition.OperationId, StringComparison.Ordinal);
        Assert.Equal(fixture.OutputRoot, composition.OutputRoot);
        Assert.Equal(
            Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json"),
            composition.ReceiptPath);
        Assert.Equal(64, composition.ReceiptSha256.Length);
        Assert.Equal(TinyRustLmConversionTool.LiveObservationSchema, result.Observation.Schema);
        Assert.Equal(64, result.Observation.SummarySha256.Length);
        Assert.Equal(64, composition.GraphIdentitySha256.Length);
        Assert.Equal(Sha256File(fixture.ModelSourceLockPath), composition.ModelSourceLockSha256);
        Assert.Equal(
            Sha256File(fixture.TokenizerSourceLockPath),
            composition.TokenizerSourceLockSha256);
        Assert.Equal("fixture-1", composition.ConverterVersion);
        Assert.Equal(64, composition.ConverterExecutableSha256.Length);
        Assert.Equal(
            "source-native-browser-numerical-parity-untouched-quality-and-product-chat",
            composition.RequiredNextGate);

        var artifacts = composition.Artifacts.InCanonicalOrder();
        Assert.Equal(6, artifacts.Count);
        Assert.Equal(
            ["slm2", "tokenizer2", "template2", "sampling2", "prompt2", "acg2"],
            artifacts.Select(value => value.Kind));
        Assert.Equal(
            [
                "model.slm2",
                "tokenizer.tokenizer2",
                "template.template2",
                "sampling.sampling2",
                "prompt.prompt2",
                "composition.acg2"
            ],
            artifacts.Select(value => value.FileName));
        Assert.All(artifacts, artifact =>
        {
            Assert.True(artifact.ByteLength > 0);
            Assert.Equal(64, artifact.Sha256.Length);
            Assert.True(File.Exists(artifact.Path));
        });
    }

    [Fact]
    public async Task ConverterPreservesOnlyExactBoundedFailureCode()
    {
        using var fixture = new ConversionFixture("error");
        var tool = fixture.Tool();
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(tool.CreateCompositionIntent(fixture.Request())));
        Assert.Equal("qwen3-source-hash-mismatch", error.Code);

        fixture.SetScenario("malformed-error");
        error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(tool.CreateCompositionIntent(fixture.Request())));
        Assert.Equal("converter-process-failed", error.Code);
        Assert.DoesNotContain("secret", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("hash-mismatch", "converter-artifact-identity")]
    [InlineData("receipt-hash-mismatch", "converter-receipt-artifacts")]
    [InlineData("source-hash-mismatch", "converter-receipt-contract")]
    [InlineData("durability-operation", "converter-receipt-contract")]
    [InlineData("durability-status", "converter-receipt-contract")]
    [InlineData("malformed-json", "converter-summary-json")]
    [InlineData("duplicate-summary", "converter-summary-json")]
    [InlineData("unknown-summary", "converter-summary-json")]
    [InlineData("duplicate-receipt", "converter-receipt-json")]
    [InlineData("unknown-receipt", "converter-receipt-json")]
    [InlineData("unexpected-stderr", "converter-unexpected-stderr")]
    [InlineData("extra-file", "converter-output-inventory")]
    [InlineData("missing-receipt", "converter-output-inventory")]
    public async Task ConverterRejectsDishonestMalformedOrIncompleteSuccess(
        string scenario,
        string expectedCode)
    {
        using var fixture = new ConversionFixture(scenario);
        var tool = fixture.Tool();
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(tool.CreateCompositionIntent(fixture.Request())));
        Assert.Equal(expectedCode, error.Code);
    }

    [Theory]
    [InlineData("oversized")]
    [InlineData("oversized-error")]
    public async Task ConverterKillsOutputFloodAndTimeoutWithoutDeletingEvidence(string scenario)
    {
        using var fixture = new ConversionFixture(scenario);
        var policy = new TinyRustLmConversionPolicy(TimeSpan.FromSeconds(10), 1024, 1024);
        var tool = fixture.Tool(policy);
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(tool.CreateCompositionIntent(fixture.Request())));
        Assert.Equal("converter-output-limit", error.Code);

        fixture.SetScenario("hang");
        policy = new TinyRustLmConversionPolicy(TimeSpan.FromMilliseconds(100), 1024, 1024);
        tool = fixture.Tool(policy);
        error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(tool.CreateCompositionIntent(fixture.Request())));
        Assert.Equal("converter-timeout", error.Code);
        Assert.Equal(
            "preserved\n",
            File.ReadAllText(Path.Combine(fixture.OutputRoot, "composition.attempt.json")));
    }

    [Fact]
    public async Task ConverterHonorsCancellationPreservesEvidenceAndNeverResumesTerminalRoot()
    {
        using var fixture = new ConversionFixture("hang");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        var evidencePath = Path.Combine(fixture.OutputRoot, "composition.attempt.json");
        var evidenceWritten = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);
        using var watcher = new FileSystemWatcher(
            Path.GetDirectoryName(fixture.OutputRoot)!,
            Path.GetFileName(evidencePath))
        {
            IncludeSubdirectories = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite |
                NotifyFilters.Size
        };
        void ObserveEvidence()
        {
            try
            {
                using var stream = new FileStream(
                    evidencePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.None);
                using var reader = new StreamReader(stream);
                if (reader.ReadToEnd() == "preserved\n")
                {
                    evidenceWritten.TrySetResult();
                }
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
            }
        }
        watcher.Created += (_, _) => ObserveEvidence();
        watcher.Changed += (_, _) => ObserveEvidence();
        watcher.Error += (_, error) => evidenceWritten.TrySetException(error.GetException());
        watcher.EnableRaisingEvents = true;

        using var cancellation = new CancellationTokenSource();
        var conversion = tool.ConvertCompositionAsync(intent, cancellation.Token);
        ObserveEvidence();
        var firstCompleted = await Task.WhenAny(conversion, evidenceWritten.Task);
        Assert.Same(evidenceWritten.Task, firstCompleted);
        await evidenceWritten.Task;
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => conversion);
        Assert.True(Directory.Exists(fixture.OutputRoot));
        Assert.Equal("preserved\n", File.ReadAllText(evidencePath));

        await Assert.ThrowsAsync<IOException>(() =>
            tool.ConvertCompositionAsync(intent));
    }

    [Fact]
    public void ManagedSurfaceHasNoComponentConversionSuccessApi()
    {
        var assembly = typeof(TinyRustLmConversionTool).Assembly;
        Assert.Null(assembly.GetType("TinyRustLM.TinyRustLmConversionKind", throwOnError: false));
        Assert.DoesNotContain(
            typeof(TinyRustLmConversionTool).GetMethods(),
            method => method.Name == "ConvertAsync");
        Assert.Contains(
            typeof(TinyRustLmConversionTool).GetMethods(),
            method => method.Name == nameof(TinyRustLmConversionTool.ConvertCompositionAsync));
        Assert.Contains(
            typeof(TinyRustLmConversionTool).GetMethods(),
            method => method.Name == nameof(TinyRustLmConversionTool.CreateCompositionIntent));
        Assert.DoesNotContain(
            typeof(TinyRustLmConversionTool).GetMethods(),
            method => method.Name == nameof(TinyRustLmConversionTool.ConvertCompositionAsync) &&
                method.GetParameters()[0].ParameterType ==
                    typeof(TinyRustLmCompositionConversionRequest));
    }

    [Theory]
    [InlineData("model")]
    [InlineData("tokenizer")]
    [InlineData("profile")]
    public void ConverterRejectsRequestIdentityDriftBeforeStartingProcess(string identity)
    {
        using var fixture = new ConversionFixture("pass");
        var request = fixture.Request();
        request = identity switch
        {
            "model" => request with { ModelSourceLockSha256 = new string('0', 64) },
            "tokenizer" => request with { TokenizerSourceLockSha256 = new string('0', 64) },
            "profile" => request with { CompositionProfileSha256 = new string('0', 64) },
            _ => throw new InvalidOperationException()
        };
        var error = Assert.Throws<TinyRustLmException>(() =>
            fixture.Tool().CreateCompositionIntent(request));
        Assert.Equal($"converter-{identity}-source-lock-identity".Replace(
            "profile-source-lock",
            "composition-profile",
            StringComparison.Ordinal), error.Code);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public void IntentCanonicalizesAndBindsEveryLaunchInputBeforeOutput()
    {
        using var fixture = new ConversionFixture("pass");
        var policy = new TinyRustLmConversionPolicy(TimeSpan.FromMinutes(17), 32_768, 2_048);
        var tool = fixture.Tool(policy);

        var intent = tool.CreateCompositionIntent(fixture.Request());

        Assert.Equal(TinyRustLmConversionTool.CompositionIntentSchema, intent.Schema);
        Assert.Equal(Path.GetFullPath(fixture.ModelSourceLockPath), intent.ModelSourceLockPath);
        Assert.Equal(Path.GetFullPath(fixture.ModelSourceDirectory), intent.ModelSourceDirectory);
        Assert.Equal(
            Path.GetFullPath(fixture.TokenizerSourceLockPath),
            intent.TokenizerSourceLockPath);
        Assert.Equal(
            Path.GetFullPath(fixture.TokenizerSourceDirectory),
            intent.TokenizerSourceDirectory);
        Assert.Equal(Path.GetFullPath(fixture.OutputRoot), intent.OutputRoot);
        Assert.Equal(Sha256File(fixture.ModelSourceLockPath), intent.ModelSourceLockSha256);
        Assert.Equal(
            Sha256File(fixture.TokenizerSourceLockPath),
            intent.TokenizerSourceLockSha256);
        Assert.Equal(TinyRustLmConversionTool.CompositionProfileSha256,
            intent.CompositionProfileSha256);
        Assert.Equal(64, intent.ConverterExecutableSha256.Length);
        Assert.Equal(17 * 60 * 1000, intent.MaximumDurationMilliseconds);
        Assert.Equal(32_768, intent.MaximumSummaryBytes);
        Assert.Equal(2_048, intent.MaximumErrorBytes);
        Assert.Equal("existing-output-root-is-never-resumed", intent.TerminalRule);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task LaunchRejectsSourceDriftAgainstPersistableIntentBeforeOutput()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        File.WriteAllText(fixture.ModelSourceLockPath, "changed-after-intent");

        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(intent));

        Assert.Equal("converter-intent-file-drift", error.Code);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Fact]
    public async Task TerminalInspectorReconstructsDurablePassWithoutLiveObservations()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        var live = await tool.ConvertCompositionAsync(intent);

        var inspection = TinyRustLmConversionTool.InspectCompositionTerminal(intent);

        Assert.Equal(TinyRustLmCompositionTerminalStatus.Pass, inspection.Status);
        Assert.Null(inspection.ErrorCode);
        Assert.Equal(live.Composition, inspection.Composition);
    }

    [Fact]
    public async Task ManagedInspectionCommandReturnsCanonicalReadOnlyPass()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        var live = await tool.ConvertCompositionAsync(intent);
        var intentBytes = TinyRustLmCompositionInspectionCommand.SerializeIntent(intent);

        var result = TinyRustLmCompositionInspectionCommand.Execute(intentBytes);

        Assert.Equal(0, result.ExitCode);
        Assert.Empty(result.Stderr);
        using var document = JsonDocument.Parse(result.Stdout);
        Assert.Equal(TinyRustLmCompositionInspectionCommand.ResultSchema,
            document.RootElement.GetProperty("schema").GetString());
        Assert.Equal("pass", document.RootElement.GetProperty("status").GetString());
        Assert.Equal("read-only-no-converter-launch",
            document.RootElement.GetProperty("operation").GetString());
        Assert.Equal(live.Composition.OperationId,
            document.RootElement.GetProperty("composition").GetProperty("operationId")
                .GetString());
        var resultText = System.Text.Encoding.UTF8.GetString(result.Stdout);
        Assert.EndsWith("\n", resultText,
            StringComparison.Ordinal);
        Assert.DoesNotContain('\r', resultText);
    }

    [Fact]
    public void ManagedInspectionCommandReportsPendingWithoutLaunching()
    {
        using var fixture = new ConversionFixture("pass");
        var intent = fixture.Tool().CreateCompositionIntent(fixture.Request());

        var result = TinyRustLmCompositionInspectionCommand.Execute(
            TinyRustLmCompositionInspectionCommand.SerializeIntent(intent));

        Assert.Equal(3, result.ExitCode);
        Assert.Empty(result.Stderr);
        using var document = JsonDocument.Parse(result.Stdout);
        Assert.Equal("pending", document.RootElement.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null,
            document.RootElement.GetProperty("composition").ValueKind);
    }

    [Fact]
    public async Task ManagedInspectionCommandReportsVerifiedNativeRejection()
    {
        using var fixture = new ConversionFixture("terminal-rejection");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        var failure = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(intent));
        Assert.Equal("qwen3-source-hash-mismatch", failure.Code);

        var result = TinyRustLmCompositionInspectionCommand.Execute(
            TinyRustLmCompositionInspectionCommand.SerializeIntent(intent));

        Assert.Equal(2, result.ExitCode);
        Assert.Empty(result.Stderr);
        using var document = JsonDocument.Parse(result.Stdout);
        Assert.Equal("rejected", document.RootElement.GetProperty("status").GetString());
        Assert.Equal("qwen3-source-hash-mismatch",
            document.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public void ManagedInspectionCommandRejectsNoncanonicalOrExtendedIntent()
    {
        using var fixture = new ConversionFixture("pass");
        var intent = fixture.Tool().CreateCompositionIntent(fixture.Request());
        var canonical = TinyRustLmCompositionInspectionCommand.SerializeIntent(intent);
        using var document = JsonDocument.Parse(canonical);
        var compact = JsonSerializer.SerializeToUtf8Bytes(document.RootElement);

        var noncanonical = TinyRustLmCompositionInspectionCommand.Execute(compact);
        var extended = TinyRustLmCompositionInspectionCommand.Execute(
            System.Text.Encoding.UTF8.GetBytes(
                System.Text.Encoding.UTF8.GetString(canonical).Replace(
                    "\n}",
                    ",\n  \"unexpected\": true\n}",
                    StringComparison.Ordinal)));

        Assert.Equal(1, noncanonical.ExitCode);
        Assert.Empty(noncanonical.Stdout);
        Assert.Contains("managed-inspection-intent-canonical",
            System.Text.Encoding.UTF8.GetString(noncanonical.Stderr),
            StringComparison.Ordinal);
        Assert.Equal(1, extended.ExitCode);
        Assert.Empty(extended.Stdout);
        Assert.Contains("managed-inspection-intent-json",
            System.Text.Encoding.UTF8.GetString(extended.Stderr),
            StringComparison.Ordinal);
    }

    [Fact]
    public void TerminalInspectorTreatsAbsentAndBoundedPartialRootsAsPending()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());

        var absent = TinyRustLmConversionTool.InspectCompositionTerminal(intent);
        Assert.Equal(TinyRustLmCompositionTerminalStatus.Pending, absent.Status);
        Assert.Null(absent.Composition);
        Assert.Null(absent.ErrorCode);

        Directory.CreateDirectory(fixture.OutputRoot);
        File.WriteAllText(
            Path.Combine(fixture.OutputRoot, "composition.attempt.json"),
            "incomplete\n");
        var partial = TinyRustLmConversionTool.InspectCompositionTerminal(intent);
        Assert.Equal(TinyRustLmCompositionTerminalStatus.Pending, partial.Status);
        Assert.Null(partial.Composition);
        Assert.Null(partial.ErrorCode);
    }

    [Fact]
    public async Task TerminalInspectorVerifiesNativeRejectionAndAttemptLineage()
    {
        using var fixture = new ConversionFixture("terminal-rejection");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        var failure = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(intent));
        Assert.Equal("qwen3-source-hash-mismatch", failure.Code);

        var inspection = TinyRustLmConversionTool.InspectCompositionTerminal(intent);

        Assert.Equal(TinyRustLmCompositionTerminalStatus.Rejected, inspection.Status);
        Assert.Equal("qwen3-source-hash-mismatch", inspection.ErrorCode);
        Assert.Null(inspection.Composition);
    }

    [Theory]
    [InlineData("malformed-rejection", "converter-rejection-json")]
    [InlineData("unknown-rejection", "converter-rejection-json")]
    [InlineData("safe-no-op", "converter-rejection-contract")]
    [InlineData("rejection-operation", "converter-rejection-contract")]
    [InlineData("attempt-source", "converter-attempt-contract")]
    [InlineData("attempt-converter", "converter-attempt-contract")]
    [InlineData("nested-directory", "converter-output-inventory")]
    public async Task TerminalInspectorRejectsTamperedNativeRejection(
        string fault,
        string expectedCode)
    {
        using var fixture = new ConversionFixture("terminal-rejection");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        await Assert.ThrowsAsync<TinyRustLmException>(() =>
            tool.ConvertCompositionAsync(intent));
        var rejection = Path.Combine(fixture.OutputRoot, "composition.rejection.json");
        var attempt = Path.Combine(fixture.OutputRoot, "composition.attempt.json");
        switch (fault)
        {
            case "malformed-rejection":
                File.WriteAllText(rejection, "{\n");
                break;
            case "unknown-rejection":
                AddUnknownProperty(rejection);
                break;
            case "safe-no-op":
                ReplaceFirst(rejection, "\"safeNoOp\":false", "\"safeNoOp\":true");
                break;
            case "rejection-operation":
                ReplaceFirst(
                    rejection,
                    ReadStringProperty(rejection, "operationId"),
                    $"qwen3-composition-{new string('0', 64)}");
                break;
            case "attempt-source":
                ReplaceFirst(attempt, intent.ModelSourceLockSha256, new string('0', 64));
                break;
            case "attempt-converter":
                ReplaceFirst(attempt, intent.ConverterExecutableSha256, new string('0', 64));
                break;
            case "nested-directory":
                Directory.CreateDirectory(Path.Combine(fixture.OutputRoot, "nested"));
                break;
            default:
                throw new InvalidOperationException(fault);
        }

        var error = Assert.Throws<TinyRustLmException>(() =>
            TinyRustLmConversionTool.InspectCompositionTerminal(intent));

        Assert.Equal(expectedCode, error.Code);
    }

    [Fact]
    public async Task TerminalInspectorRejectsPassAndRejectionCollision()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        await tool.ConvertCompositionAsync(intent);
        File.WriteAllText(
            Path.Combine(fixture.OutputRoot, "composition.rejection.json"),
            "{}\n");

        var error = Assert.Throws<TinyRustLmException>(() =>
            TinyRustLmConversionTool.InspectCompositionTerminal(intent));

        Assert.Equal("converter-terminal-collision", error.Code);
    }

    [Fact]
    public void TerminalInspectorRejectsAnOutputPathThatIsAFile()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());
        File.WriteAllText(fixture.OutputRoot, "not-a-directory");

        var error = Assert.Throws<TinyRustLmException>(() =>
            TinyRustLmConversionTool.InspectCompositionTerminal(intent));

        Assert.Equal("converter-output-inventory", error.Code);
        Assert.Equal("not-a-directory", File.ReadAllText(fixture.OutputRoot));
    }

    [Fact]
    public void IntentContractRejectsNoncanonicalOverlapAndFractionalPolicy()
    {
        using var fixture = new ConversionFixture("pass");
        var tool = fixture.Tool();
        var intent = tool.CreateCompositionIntent(fixture.Request());

        var relative = intent with { OutputRoot = "relative-output" };
        var error = Assert.Throws<TinyRustLmException>(() =>
            TinyRustLmConversionTool.ValidateCompositionIntent(relative));
        Assert.Equal("converter-intent-path", error.Code);

        var overlapping = intent with { OutputRoot = intent.ModelSourceDirectory };
        error = Assert.Throws<TinyRustLmException>(() =>
            TinyRustLmConversionTool.ValidateCompositionIntent(overlapping));
        Assert.Equal("converter-intent-tree-overlap", error.Code);

        Assert.Throws<ArgumentOutOfRangeException>(() => new TinyRustLmConversionTool(
            intent.ConverterExecutablePath,
            new TinyRustLmConversionPolicy(
                TimeSpan.FromTicks(TimeSpan.TicksPerMillisecond + 1),
                1024,
                1024)));
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    [Theory]
    [InlineData((int)FileAttributes.Normal, false)]
    [InlineData((int)FileAttributes.ReadOnly, false)]
    [InlineData((int)FileAttributes.Directory, true)]
    [InlineData((int)FileAttributes.ReparsePoint, true)]
    [InlineData((int)(FileAttributes.Directory | FileAttributes.ReparsePoint), true)]
    public void OutputInventoryPolicyRejectsDirectoriesAndReparseEntries(
        int rawAttributes,
        bool expectedInvalid)
    {
        Assert.Equal(
            expectedInvalid,
            TinyRustLmConversionTool.IsInvalidOutputEntry((FileAttributes)rawAttributes));
    }

    /// <summary>Supplies short async reads, deliberately ignoring cancellation to test late-result rejection.</summary>
    private sealed class ObservedAsyncReadStream(byte[] payload, int maximumRead, Action<int>? afterRead = null)
        : MemoryStream(payload)
    {
        internal int Reads { get; private set; }
        internal int MaximumRequestedBytes { get; private set; }
        internal CancellationToken LastToken { get; private set; }

        /// <summary>Records the supplied token and notifies the test after reading data or EOF.</summary>
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            LastToken = cancellationToken;
            MaximumRequestedBytes = Math.Max(MaximumRequestedBytes, buffer.Length);
            var count = base.Read(buffer.Span[..Math.Min(buffer.Length, maximumRead)]);
            Reads++;
            afterRead?.Invoke(Reads);
            return ValueTask.FromResult(count);
        }
    }

    /// <summary>A cancellable pending read supplies a deterministic liveness test without a socket.</summary>
    private sealed class StalledReadStream : MemoryStream
    {
        internal TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <summary>Signals admission, then remains pending until the exact supplied token is cancelled.</summary>
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            Started.TrySetResult();
            await Task.Delay(Timeout.Infinite, cancellationToken);
            return 0;
        }
    }

    /// <summary>Supplies deterministic short reads and read-boundary cancellation without timing races.</summary>
    private sealed class ObservedReadStream(byte[] payload, int maximumRead, Action<int>? afterRead = null)
        : MemoryStream(payload)
    {
        internal int Reads { get; private set; }
        internal int MaximumRequestedBytes { get; private set; }

        /// <summary>Records the requested bound and invokes the observer after the actual read, including EOF.</summary>
        public override int Read(byte[] buffer, int offset, int count)
        {
            MaximumRequestedBytes = Math.Max(MaximumRequestedBytes, count);
            var result = base.Read(buffer, offset, Math.Min(count, maximumRead));
            Reads++;
            afterRead?.Invoke(Reads);
            return result;
        }
    }

    private sealed class ConversionFixture : IDisposable
    {
        private readonly string _root;

        internal ConversionFixture(string scenario)
        {
            _root = Path.Combine(Path.GetTempPath(), $"tinyrustlm-conversion-{Guid.NewGuid():N}");
            Directory.CreateDirectory(_root);
            ModelSourceDirectory = Path.Combine(_root, "model-source");
            Directory.CreateDirectory(ModelSourceDirectory);
            TokenizerSourceDirectory = Path.Combine(_root, "tokenizer-source");
            Directory.CreateDirectory(TokenizerSourceDirectory);
            ModelSourceLockPath = Path.Combine(_root, "model-source-lock.json");
            TokenizerSourceLockPath = Path.Combine(_root, "tokenizer-source-lock.json");
            OutputRoot = Path.Combine(_root, "composition-output");
            SetScenario(scenario);
        }

        internal string ModelSourceDirectory { get; }
        internal string ModelSourceLockPath { get; }
        internal string TokenizerSourceDirectory { get; }
        internal string TokenizerSourceLockPath { get; }
        internal string OutputRoot { get; }

        internal void SetScenario(string scenario)
        {
            if (Directory.Exists(OutputRoot))
            {
                Directory.Delete(OutputRoot, recursive: true);
            }
            File.WriteAllText(ModelSourceLockPath, "fixture-model-lock");
            File.WriteAllText(TokenizerSourceLockPath, "fixture-tokenizer-lock");
            File.WriteAllText(
                Path.Combine(ModelSourceDirectory, ".tinyrustlm-conversion-fixture-scenario"),
                scenario);
        }

        internal TinyRustLmCompositionConversionRequest Request() =>
            new(
                ModelSourceLockPath,
                Sha256File(ModelSourceLockPath),
                ModelSourceDirectory,
                TokenizerSourceLockPath,
                Sha256File(TokenizerSourceLockPath),
                TokenizerSourceDirectory,
                TinyRustLmConversionTool.CompositionProfileSha256,
                OutputRoot);

        internal TinyRustLmConversionTool Tool(TinyRustLmConversionPolicy? policy = null) =>
            new(FixtureToolPath(), policy);

        public void Dispose()
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }

        /// <summary>Use this build's declared fixture output, including owned artifacts layouts.</summary>
        private static string FixtureToolPath()
        {
            var assembly = typeof(ConversionToolTests).Assembly
                .GetCustomAttributes<AssemblyMetadataAttribute>()
                .Single(attribute => attribute.Key == "TinyRustLM.Fixture.TinyRustLM.ConversionFixtureTool")
                .Value ?? throw new InvalidOperationException("Conversion fixture binding is missing.");
            var relative = Path.GetRelativePath(RepositoryRoot(), assembly);
            if (!Path.IsPathFullyQualified(assembly) || Path.IsPathRooted(relative) ||
                relative == ".." || relative.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal) ||
                Path.GetFileName(assembly) != "TinyRustLM.ConversionFixtureTool.dll")
            {
                throw new InvalidOperationException("Conversion fixture binding is outside canonical output.");
            }
            var executable = Path.ChangeExtension(assembly,
                RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? ".exe" : null);
            var file = new FileInfo(executable);
            if (!file.Exists || file.Length == 0 || (file.Attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new IOException("Bound conversion fixture executable is missing or linked.");
            }
            return executable;
        }

        private static string RepositoryRoot()
        {
            var current = new DirectoryInfo(AppContext.BaseDirectory);
            while (current is not null)
            {
                if (File.Exists(Path.Combine(current.FullName, "Cargo.toml")) &&
                    File.Exists(Path.Combine(current.FullName, "dotnet", "TinyRustLM.sln")))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }
            throw new DirectoryNotFoundException("Cannot locate repository root.");
        }
    }

    private static string Sha256File(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }

    private static void ReplaceFirst(string path, string expected, string replacement)
    {
        var text = File.ReadAllText(path);
        var index = text.IndexOf(expected, StringComparison.Ordinal);
        Assert.True(index >= 0);
        File.WriteAllText(
            path,
            text[..index] + replacement + text[(index + expected.Length)..]);
    }

    private static void AddUnknownProperty(string path)
    {
        var text = File.ReadAllText(path).TrimEnd('\r', '\n');
        File.WriteAllText(path, $"{text[..^1]},\"unknown\":true}}\n");
    }

    private static string ReadStringProperty(string path, string name)
    {
        using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllBytes(path));
        return document.RootElement.GetProperty(name).GetString()
            ?? throw new InvalidOperationException(name);
    }
}
