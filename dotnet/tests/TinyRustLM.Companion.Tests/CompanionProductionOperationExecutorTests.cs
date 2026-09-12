using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using TinyRustLM;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionProductionOperationExecutorTests : IDisposable
{
    private readonly CanonicalTestScratch _scratch = new("production-executor");
    private string _parent => _scratch.Path;

    [Fact]
    public void BuiltInSourceClosureHasOnlyPinnedFilesAndPublicDestinations()
    {
        CompanionBuiltInSourceAssets.Validate();
        Assert.Equal(
            CompanionSourceDescriptor.FileCount,
            checked((uint)CompanionSourceAcquisition.Files.Count));
        Assert.Equal(
            CompanionSourceDescriptor.PayloadBytes,
            CompanionSourceAcquisition.Files.Aggregate(
                0UL,
                static (total, file) => checked(total + file.ByteLength)));
        Assert.Equal(
            CompanionSourceDescriptor.PayloadInventorySha256,
            CompanionSourcePayloadInventory.ComputeSha256(
                CompanionSourceAcquisition.Files.Select(static file =>
                    new CompanionSourcePayloadMember(
                        file.Path,
                        file.ByteLength,
                        file.Sha256))));

        foreach (var file in CompanionSourceAcquisition.Files)
        {
            var uri = CompanionHuggingFaceSourceTransport.InitialUri(file);
            Assert.Equal(Uri.UriSchemeHttps, uri.Scheme);
            Assert.Equal("huggingface.co", uri.Host);
            Assert.Contains(
                $"/{CompanionSourceDescriptor.Repository}/resolve/" +
                $"{CompanionSourceDescriptor.Revision}/",
                uri.AbsolutePath,
                StringComparison.Ordinal);
            Assert.DoesNotContain("/main/", uri.AbsolutePath, StringComparison.Ordinal);
            Assert.Equal("?download=true", uri.Query);
        }

        var arbitrary = CompanionSourceAcquisition.Files[0] with
        {
            Path = "https://example.invalid/model"
        };
        Assert.Throws<CompanionContractException>(() =>
            CompanionHuggingFaceSourceTransport.InitialUri(arbitrary));
        Assert.False(CompanionHuggingFaceSourceTransport.IsPublicAddress(
            IPAddress.Loopback));
        Assert.False(CompanionHuggingFaceSourceTransport.IsPublicAddress(
            IPAddress.Parse("10.0.0.1")));
        Assert.False(CompanionHuggingFaceSourceTransport.IsPublicAddress(
            IPAddress.Parse("169.254.10.1")));
        Assert.False(CompanionHuggingFaceSourceTransport.IsPublicAddress(
            IPAddress.Parse("fc00::1")));
        Assert.True(CompanionHuggingFaceSourceTransport.IsPublicAddress(
            IPAddress.Parse("8.8.8.8")));
        Assert.True(CompanionHuggingFaceSourceTransport.IsPublicAddress(
            IPAddress.Parse("2606:4700:4700::1111")));

        var initial = CompanionHuggingFaceSourceTransport.InitialUri(
            CompanionSourceAcquisition.Files[0]);
        foreach (var rejectedRedirect in new[]
        {
            "http://example.com/model",
            "https://user@example.com/model",
            "https://example.com:444/model",
            "https://8.8.8.8/model",
            "https://example.com/model#fragment"
        })
        {
            Assert.Throws<CompanionContractException>(() =>
                CompanionHuggingFaceSourceTransport.ValidateRedirect(
                    initial,
                    new Uri(rejectedRedirect)));
        }
    }

    [Fact]
    public void MissingPackagedConverterIsAnActionableStartupFailure()
    {
        Directory.CreateDirectory(_parent);
        var missing = Path.Combine(_parent, "missing", "tinyrustlm-convert");

        var error = Assert.Throws<CompanionProtocolException>(() =>
            CompanionProductionOperationRuntime.OpenWithConverterPath(_parent, missing));

        Assert.Equal("converter-tool-missing", error.Code);
        Assert.Empty(Directory.GetDirectories(
            Path.Combine(_parent, "source-operation-journal-v1", "operations")));
    }

    [Fact]
    public async Task ConcurrentStartsOwnOneWorkerAndCancellationCommitsTerminalEvidence()
    {
        Directory.CreateDirectory(_parent);
        var fixture = CreateExecutorFixture(new BlockingSourceTransport());
        await using var executor = fixture.Executor;
        var service = new CompanionOperationService(
            fixture.Journal,
            executor,
            new CompanionArtifactTransfer(fixture.Journal));
        var request = CompanionContractTests.Request() with
        {
            AttemptId = new string('6', 32)
        };

        var created = await service.CreateOrReadAsync(request);
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            executor.EnsureStartedAsync(created.OperationId)));
        await fixture.Transport.Started.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var acquiring = await WaitForStateAsync(
            fixture.Journal,
            created.OperationId,
            CompanionOperationState.AcquiringSource);
        Assert.Equal((ulong)0, acquiring.PhaseCompletedBytes);
        Assert.Equal(CompanionSourceDescriptor.PayloadBytes, acquiring.PhaseTotalBytes);
        Assert.Equal(1, fixture.Transport.CallCount);
        Assert.Equal("LICENSE", fixture.Transport.RequestedFiles.Single().Path);

        var cancellation = new CompanionCancelRequest(
            CompanionLoopbackWire.CancelRequestSchema,
            new string('d', 32));
        var terminal = await service.CancelAndWaitAsync(created.OperationId, cancellation);

        Assert.Equal(CompanionOperationState.Cancelled, terminal.State);
        Assert.Equal(
            cancellation,
            fixture.Journal.ReadCancellationIntent(created.OperationId).Request);
        var execution = fixture.Journal.ReadExecutionIntent(created.OperationId).Intent;
        var operationRoot = Path.Combine(fixture.WorkRoot, created.OperationId);
        Assert.Equal(CompanionSourceDescriptor.DescriptorId, execution.SourceDescriptorId);
        Assert.Equal(
            Path.Combine(operationRoot, "source-staging"),
            execution.SourceAcquisitionRoot);
        Assert.Equal(
            Path.Combine(operationRoot, "source-locks"),
            execution.MaterializedLockRoot);
        Assert.Equal(
            Path.Combine(operationRoot, "composition-output"),
            execution.ConversionOutputRoot);
        Assert.Equal(
            CompanionSourceDescriptor.NetworkProfileId,
            execution.NetworkProfileId);
    }

    [Fact]
    public async Task UnsupportedSourceIdentityNeverReachesTransport()
    {
        Directory.CreateDirectory(_parent);
        var fixture = CreateExecutorFixture(new RejectingSourceTransport());
        await using var executor = fixture.Executor;
        var service = new CompanionOperationService(
            fixture.Journal,
            executor,
            new CompanionArtifactTransfer(fixture.Journal));
        var request = CompanionContractTests.Request() with
        {
            AttemptId = new string('8', 32),
            SourceRepository = "example.invalid/arbitrary"
        };

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            service.CreateOrReadAsync(request));

        Assert.Equal("contract-invalid", error.Code);
        Assert.Equal(0, fixture.Transport.CallCount);
    }

    [Fact]
    public async Task ExistingOwnerLeasePreventsASecondWorkerFromWriting()
    {
        Directory.CreateDirectory(_parent);
        var fixture = CreateExecutorFixture(new BlockingSourceTransport());
        await using var executor = fixture.Executor;
        var service = new CompanionOperationService(
            fixture.Journal,
            executor,
            new CompanionArtifactTransfer(fixture.Journal));
        var request = CompanionContractTests.Request() with
        {
            AttemptId = new string('9', 32)
        };
        var created = fixture.Journal.CreateOrRead(request);
        var ownerPath = Path.Combine(
            fixture.JournalRoot,
            "operations",
            created.OperationId,
            "operation.owner.lock");

        using (var owner = new FileStream(
            ownerPath,
            FileMode.OpenOrCreate,
            FileAccess.ReadWrite,
            FileShare.None))
        {
            await executor.EnsureStartedAsync(created.OperationId);
            await Task.Delay(100);
            Assert.Equal(
                CompanionOperationState.Queued,
                fixture.Journal.Read(created.OperationId).State);
            Assert.Equal(0, fixture.Transport.CallCount);
        }

        using var startTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (!fixture.Transport.Started.Task.IsCompleted)
        {
            await executor.EnsureStartedAsync(created.OperationId);
            await Task.Delay(25, startTimeout.Token);
        }
        Assert.Equal(1, fixture.Transport.CallCount);

        var terminal = await service.CancelAndWaitAsync(
            created.OperationId,
            new CompanionCancelRequest(
                CompanionLoopbackWire.CancelRequestSchema,
                new string('e', 32)));
        Assert.Equal(CompanionOperationState.Cancelled, terminal.State);
    }

    [Fact]
    public async Task RestartRejectsInstalledWorkerDriftBeforeSourceTransport()
    {
        Directory.CreateDirectory(_parent);
        var fixture = CreateExecutorFixture(new RejectingSourceTransport());
        await using var executor = fixture.Executor;
        var request = CompanionContractTests.Request() with
        {
            AttemptId = new string('a', 32)
        };
        var created = fixture.Journal.CreateOrRead(request);
        var operationRoot = Path.Combine(fixture.WorkRoot, created.OperationId);
        _ = CompanionOperationTestEvidence.EnterAcquiringSource(
            fixture.Journal,
            created,
            operationRoot,
            Path.Combine(operationRoot, "model-source"),
            Path.Combine(operationRoot, "tokenizer-source"),
            Path.Combine(operationRoot, "composition-output"),
            installedConverterSha256: Sha256File(
                typeof(CompanionProductionOperationExecutorTests).Assembly.Location));

        executor.RecoverPendingOperations();
        var terminal = await WaitForStateAsync(
            fixture.Journal,
            created.OperationId,
            CompanionOperationState.Rejected);

        Assert.Equal("operation-worker-drift", terminal.ErrorCode);
        Assert.Equal(0, fixture.Transport.CallCount);
        Assert.False(Directory.Exists(Path.Combine(operationRoot, "source-staging")));
    }

    [Fact]
    public async Task PendingConversionAtStartupRejectsWithoutRelaunch()
    {
        Directory.CreateDirectory(_parent);
        var fixture = CreateExecutorFixture(new RejectingSourceTransport());
        await using var executor = fixture.Executor;
        var request = CompanionContractTests.Request() with
        {
            AttemptId = new string('7', 32)
        };
        var created = fixture.Journal.CreateOrRead(request);
        var operationMarker =
            $"{CompanionProductionFileSystem.OperationRootMarkerPrefix}{created.OperationId}\n";
        var privateRoot = CompanionProductionFileSystem.OpenOrCreateOwnedRoot(
            Path.Combine(fixture.WorkRoot, created.OperationId),
            operationMarker,
            "test-operation-root");
        var modelSource = Path.Combine(privateRoot, "model-source");
        var tokenizerSource = Path.Combine(privateRoot, "tokenizer-source");
        var outputRoot = Path.Combine(privateRoot, "composition-output");
        Directory.CreateDirectory(modelSource);
        Directory.CreateDirectory(tokenizerSource);
        var converterPath = typeof(CompanionProductionOperationExecutorTests).Assembly.Location;
        var converterSha256 = Sha256File(converterPath);
        var evidence = CompanionOperationTestEvidence.EnterAcquiringSource(
            fixture.Journal,
            created,
            privateRoot,
            modelSource,
            tokenizerSource,
            outputRoot,
            installedConverterSha256: converterSha256,
            installedWorkerSha256: Sha256File(
                typeof(CompanionProductionOperationExecutor).Assembly.Location));
        var receipt = CompanionOperationTestEvidence.PersistSourceReceipt(
            fixture.Journal,
            created,
            evidence,
            modelSource,
            tokenizerSource);
        var lockRoot = evidence.Execution.Intent.MaterializedLockRoot;
        Directory.CreateDirectory(lockRoot);
        File.WriteAllBytes(
            Path.Combine(lockRoot, CompanionBuiltInSourceAssets.ModelLockFileName),
            CompanionBuiltInSourceAssets.ModelLockBytes);
        File.WriteAllBytes(
            Path.Combine(lockRoot, CompanionBuiltInSourceAssets.TokenizerLockFileName),
            CompanionBuiltInSourceAssets.TokenizerLockBytes);
        var tool = new TinyRustLmConversionTool(converterPath);
        var nativeIntent = tool.CreateCompositionIntent(
            new TinyRustLmCompositionConversionRequest(
                Path.Combine(lockRoot, CompanionBuiltInSourceAssets.ModelLockFileName),
                request.ModelSourceLockSha256,
                modelSource,
                Path.Combine(lockRoot, CompanionBuiltInSourceAssets.TokenizerLockFileName),
                request.TokenizerSourceLockSha256,
                tokenizerSource,
                request.CompositionProfileSha256,
                outputRoot));
        var conversionIntent = fixture.Journal.PersistSourceConversionIntent(
            new CompanionSourceConversionIntent(
                CompanionContract.SourceConversionIntentSchema,
                created.OperationId,
                created.RequestSha256,
                nativeIntent));
        fixture.Journal.Advance(
            created.OperationId,
            CompanionOperationState.Converting,
            CompanionAcquisitionRoute.Source,
            phaseTotalBytes: CompanionSourceDescriptor.PayloadBytes,
            sourceAcquisitionReceiptSha256: receipt.Sha256,
            sourceConversionIntentSha256: conversionIntent.Sha256);

        executor.RecoverPendingOperations();
        var terminal = await WaitForStateAsync(
            fixture.Journal,
            created.OperationId,
            CompanionOperationState.Rejected);

        Assert.Equal("operation-owner-lost", terminal.ErrorCode);
        Assert.False(Directory.Exists(outputRoot));
        Assert.Equal(0, fixture.Transport.CallCount);
    }

    public void Dispose()
    {
        _scratch.Dispose();
    }

    private ExecutorFixture<TTransport> CreateExecutorFixture<TTransport>(TTransport transport)
        where TTransport : class, ICompanionSourceTransport
    {
        var journalRoot = CompanionOperationJournal.CreateOwnedRoot(
            Path.Combine(_parent, $"journal-{Guid.NewGuid():N}"));
        var workRoot = CompanionProductionFileSystem.OpenOrCreateOwnedRoot(
            Path.Combine(_parent, $"work-{Guid.NewGuid():N}"),
            CompanionProductionFileSystem.WorkRootMarker,
            "test-work-root");
        var journal = new CompanionOperationJournal(journalRoot);
        var acquisition = new CompanionSourceAcquisition(journal, transport);
        var converterPath = typeof(CompanionProductionOperationExecutorTests).Assembly.Location;
        var conversion = new CompanionSourceConversion(
            journal,
            new TinyRustLmConversionTool(converterPath));
        var executor = new CompanionProductionOperationExecutor(
            journal,
            acquisition,
            conversion,
            journalRoot,
            workRoot,
            Sha256File(typeof(CompanionProductionOperationExecutor).Assembly.Location),
            Sha256File(converterPath));
        return new ExecutorFixture<TTransport>(
            journal,
            executor,
            transport,
            journalRoot,
            workRoot);
    }

    private static async Task<CompanionOperationRecord> WaitForStateAsync(
        CompanionOperationJournal journal,
        string operationId,
        CompanionOperationState expected)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (true)
        {
            var current = journal.Read(operationId);
            if (current.State == expected)
            {
                return current;
            }
            await Task.Delay(25, timeout.Token);
        }
    }

    private static string Sha256File(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }

    private sealed record ExecutorFixture<TTransport>(
        CompanionOperationJournal Journal,
        CompanionProductionOperationExecutor Executor,
        TTransport Transport,
        string JournalRoot,
        string WorkRoot)
        where TTransport : class, ICompanionSourceTransport;

    private sealed class BlockingSourceTransport : ICompanionSourceTransport
    {
        private int _callCount;

        internal TaskCompletionSource Started { get; } = new(
            TaskCreationOptions.RunContinuationsAsynchronously);
        internal int CallCount => Volatile.Read(ref _callCount);
        internal ConcurrentQueue<CompanionBuiltInSourceFile> RequestedFiles { get; } = new();

        public async Task DownloadAsync(
            CompanionBuiltInSourceFile file,
            string partialPath,
            CancellationToken cancellationToken)
        {
            _ = partialPath;
            Interlocked.Increment(ref _callCount);
            RequestedFiles.Enqueue(file);
            Started.TrySetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
        }

        public void Dispose()
        {
        }
    }

    private sealed class RejectingSourceTransport : ICompanionSourceTransport
    {
        private int _callCount;

        internal int CallCount => Volatile.Read(ref _callCount);

        public Task DownloadAsync(
            CompanionBuiltInSourceFile file,
            string partialPath,
            CancellationToken cancellationToken)
        {
            _ = file;
            _ = partialPath;
            _ = cancellationToken;
            Interlocked.Increment(ref _callCount);
            throw new Xunit.Sdk.XunitException("Source transport must not run during reconciliation.");
        }

        public void Dispose()
        {
        }
    }
}
