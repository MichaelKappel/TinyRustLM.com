using System.Runtime.InteropServices;
using System.Security.Cryptography;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionArtifactTransferTests : IDisposable
{
    private readonly string _parent = Path.Combine(
        Path.GetTempPath(),
        $"tinyrustlm-companion-transfer-{Guid.NewGuid():N}");

    [Fact]
    public async Task StreamsTheExactJournaledMemberInFixedVerifiedChunks()
    {
        using var fixture = new TransferFixture(_parent, "large-pass");
        var available = await fixture.CreateAvailableAsync();
        var transfer = new CompanionArtifactTransfer(fixture.Journal);

        var first = await transfer.ReadChunkAsync(
            available.OperationId,
            "model",
            0);
        var second = await transfer.ReadChunkAsync(
            available.OperationId,
            "model",
            1);

        var expected = available.Artifacts!.Model;
        Assert.Equal(CompanionArtifactTransfer.ChunkBytes, first.Bytes.Length);
        Assert.Equal(17, second.Bytes.Length);
        Assert.Equal((ulong)2, first.Metadata.ChunkCount);
        Assert.Equal((ulong)0, first.Metadata.ChunkOffset);
        Assert.Equal((ulong)CompanionArtifactTransfer.ChunkBytes, second.Metadata.ChunkOffset);
        Assert.Equal(expected.ArtifactId, first.Metadata.ArtifactId);
        Assert.Equal(expected.Sha256, first.Metadata.ArtifactSha256);
        Assert.Equal(expected.ByteCount, first.Metadata.ArtifactBytes);
        Assert.Equal(
            CompanionLoopbackProtocol.Sha256Hex(first.Bytes),
            first.ContentSha256);
        Assert.Equal(
            CompanionLoopbackProtocol.Sha256Hex(second.Bytes),
            second.ContentSha256);

        using var complete = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        complete.AppendData(first.Bytes);
        complete.AppendData(second.Bytes);
        Assert.Equal(
            expected.Sha256,
            Convert.ToHexString(complete.GetHashAndReset()).ToLowerInvariant());
        Assert.DoesNotContain(fixture.Parent, first.Metadata.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ConcurrentReadsShareOneImmutableIdentityAndReturnExactBytes()
    {
        using var fixture = new TransferFixture(_parent, "large-pass");
        var available = await fixture.CreateAvailableAsync();
        var transfer = new CompanionArtifactTransfer(fixture.Journal);

        var reads = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            transfer.ReadChunkAsync(available.OperationId, "model", 0)));

        Assert.All(reads, value =>
        {
            Assert.Equal(reads[0].ContentSha256, value.ContentSha256);
            Assert.Equal(reads[0].Metadata, value.Metadata);
            Assert.True(reads[0].Bytes.AsSpan().SequenceEqual(value.Bytes));
        });
    }

    [Fact]
    public async Task SameLengthMutationAfterFirstChunkFailsTheFinalFullArtifactRecheck()
    {
        using var fixture = new TransferFixture(_parent, "large-pass");
        var available = await fixture.CreateAvailableAsync();
        var transfer = new CompanionArtifactTransfer(fixture.Journal);
        _ = await transfer.ReadChunkAsync(available.OperationId, "model", 0);
        var path = Path.Combine(fixture.OutputRoot, "model.slm2");
        var originalWriteTime = File.GetLastWriteTimeUtc(path);
        using (var stream = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.Read))
        {
            var original = stream.ReadByte();
            Assert.True(original >= 0);
            stream.Position = 0;
            stream.WriteByte(checked((byte)(original ^ 0x7f)));
            stream.Flush(flushToDisk: true);
        }
        File.SetLastWriteTimeUtc(path, originalWriteTime);
        Assert.Equal(originalWriteTime, File.GetLastWriteTimeUtc(path));

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync(available.OperationId, "model", 1));

        Assert.Equal("artifact-identity-drift", error.Code);
    }

    [Fact]
    public async Task MissingTerminalEvidenceCannotBeServedFromJournalClaims()
    {
        using var fixture = new TransferFixture(_parent, "pass");
        var available = await fixture.CreateAvailableAsync();
        File.Delete(Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json"));
        var transfer = new CompanionArtifactTransfer(fixture.Journal);

        var error = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync(available.OperationId, "composition", 0));

        Assert.Equal("artifact-identity-drift", error.Code);
        Assert.Equal(CompanionOperationState.Available, fixture.Journal.Read(available.OperationId).State);
    }

    [Fact]
    public async Task NonAvailableAndPeerOperationsRemainTruthfullyUnavailable()
    {
        using var fixture = new TransferFixture(_parent, "pass");
        var queued = fixture.CreateQueued();
        var transfer = new CompanionArtifactTransfer(fixture.Journal);

        var queuedError = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync(queued.OperationId, "model", 0));
        Assert.Equal("operation-not-available", queuedError.Code);

        var peer = fixture.CreateAvailablePeerOperation();
        var peerError = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync(peer.OperationId, "model", 0));
        Assert.Equal("operation-not-available", peerError.Code);
    }

    [Fact]
    public async Task InvalidIdentityRoleAndChunkIndexUseOnlyRegisteredErrors()
    {
        using var fixture = new TransferFixture(_parent, "pass");
        var queued = fixture.CreateQueued();
        var transfer = new CompanionArtifactTransfer(fixture.Journal);

        var identity = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync("not-an-operation", "model", 0));
        var role = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync(queued.OperationId, "receipt", 0));
        var index = await Assert.ThrowsAsync<CompanionProtocolException>(() =>
            transfer.ReadChunkAsync(
                queued.OperationId,
                "model",
                CompanionArtifactTransfer.MaximumChunkCount));

        Assert.Equal("operation-not-found", identity.Code);
        Assert.Equal("artifact-role-invalid", role.Code);
        Assert.Equal("artifact-chunk-invalid", index.Code);
    }

    public void Dispose()
    {
        if (Directory.Exists(_parent))
        {
            Directory.Delete(_parent, recursive: true);
        }
    }

    private sealed class TransferFixture : IDisposable
    {
        private readonly CompanionAcquireRequest _request;

        internal TransferFixture(string parent, string scenario)
        {
            Directory.CreateDirectory(parent);
            Parent = Path.Combine(parent, $"case-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Parent);
            ModelSourceDirectory = Path.Combine(Parent, "model-source");
            TokenizerSourceDirectory = Path.Combine(Parent, "tokenizer-source");
            Directory.CreateDirectory(ModelSourceDirectory);
            Directory.CreateDirectory(TokenizerSourceDirectory);
            ModelSourceLockPath = Path.Combine(Parent, "model-source-lock.json");
            TokenizerSourceLockPath = Path.Combine(Parent, "tokenizer-source-lock.json");
            File.WriteAllText(ModelSourceLockPath, scenario);
            File.WriteAllText(TokenizerSourceLockPath, "fixture-tokenizer-lock");
            OutputRoot = Path.Combine(Parent, "composition-output");
            var owned = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(Parent, "owned"));
            Journal = new CompanionOperationJournal(owned);
            _request = Request($"qwen3-{Guid.NewGuid():N}", []);
        }

        internal string Parent { get; }
        internal string ModelSourceDirectory { get; }
        internal string ModelSourceLockPath { get; }
        internal string TokenizerSourceDirectory { get; }
        internal string TokenizerSourceLockPath { get; }
        internal string OutputRoot { get; }
        internal CompanionOperationJournal Journal { get; }

        internal CompanionOperationRecord CreateQueued() => Journal.CreateOrRead(_request);

        internal async Task<CompanionOperationRecord> CreateAvailableAsync()
        {
            var created = Journal.CreateOrRead(_request);
            Journal.Advance(
                created.OperationId,
                CompanionOperationState.CheckingPeers,
                CompanionAcquisitionBranch.Undecided);
            Journal.Advance(
                created.OperationId,
                CompanionOperationState.AcquiringSource,
                CompanionAcquisitionBranch.Source,
                totalBytes: _request.MaximumSourceBytes);
            var conversion = new CompanionSourceConversion(
                Journal,
                new TinyRustLmConversionTool(FixtureToolPath()));
            var result = await conversion.RunAsync(
                created.OperationId,
                new CompanionSourceConversionRequest(
                    ModelSourceLockPath,
                    ModelSourceDirectory,
                    TokenizerSourceLockPath,
                    TokenizerSourceDirectory,
                    OutputRoot));
            return result.Operation;
        }

        internal CompanionOperationRecord CreateAvailablePeerOperation()
        {
            var request = Request(
                $"peer-{Guid.NewGuid():N}",
                [new CompanionPeerCandidate(
                    "https://peer.example.test/manifests/exact",
                    $"sha256:{new string('a', 64)}")]);
            var created = Journal.CreateOrRead(request);
            Journal.Advance(
                created.OperationId,
                CompanionOperationState.CheckingPeers,
                CompanionAcquisitionBranch.Undecided);
            Journal.Advance(
                created.OperationId,
                CompanionOperationState.FetchingPeer,
                CompanionAcquisitionBranch.Peer,
                totalBytes: 6);
            Journal.Advance(
                created.OperationId,
                CompanionOperationState.VerifyingPeer,
                CompanionAcquisitionBranch.Peer,
                completedBytes: 6,
                totalBytes: 6);
            return Journal.Advance(
                created.OperationId,
                CompanionOperationState.Available,
                CompanionAcquisitionBranch.Peer,
                completedBytes: 6,
                totalBytes: 6,
                artifacts: ArtifactSet());
        }

        public void Dispose()
        {
            if (Directory.Exists(Parent))
            {
                Directory.Delete(Parent, recursive: true);
            }
        }

        private CompanionAcquireRequest Request(
            string modelId,
            IReadOnlyList<CompanionPeerCandidate> peers) =>
            new(
                CompanionContract.AcquisitionRequestSchema,
                modelId,
                "Qwen/Qwen3-0.6B",
                new string('1', 40),
                Sha256File(ModelSourceLockPath),
                Sha256File(TokenizerSourceLockPath),
                TinyRustLmConversionTool.CompositionProfileSha256,
                SourceAcquisitionApproved: true,
                MaximumSourceBytes: 4_000_000_000,
                peers);

        private static CompanionArtifactSet ArtifactSet()
        {
            var digest = new string('b', 64);
            static CompanionArtifact Artifact(string kind, string digest) =>
                new(kind, $"sha256:{digest}", digest, 1);
            return new CompanionArtifactSet(
                Artifact("acg2", digest),
                Artifact("slm2", digest),
                Artifact("tokenizer2", digest),
                Artifact("template2", digest),
                Artifact("sampling2", digest),
                Artifact("prompt2", digest));
        }

        private static string FixtureToolPath()
        {
            var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent?.Name
                ?? throw new InvalidOperationException("Cannot determine test configuration.");
            var fileName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                ? "TinyRustLM.ConversionFixtureTool.exe"
                : "TinyRustLM.ConversionFixtureTool";
            return Path.Combine(
                RepositoryRoot(),
                "dotnet",
                "tools",
                "TinyRustLM.ConversionFixtureTool",
                "bin",
                configuration,
                "net8.0",
                fileName);
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

        private static string Sha256File(string path)
        {
            using var stream = File.OpenRead(path);
            return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        }
    }
}
