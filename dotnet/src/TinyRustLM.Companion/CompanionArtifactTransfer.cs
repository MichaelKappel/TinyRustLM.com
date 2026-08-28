using System.Buffers;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using TinyRustLM;

namespace TinyRustLM.Companion;

/// <summary>One bounded, response-ready chunk from a journaled composition member.</summary>
public sealed record CompanionArtifactChunk(
    byte[] Bytes,
    CompanionArtifactResponseMetadata Metadata,
    string ContentSha256);

/// <summary>
/// Resolves and streams only the six members of an independently verified available composition.
/// </summary>
public sealed class CompanionArtifactTransfer
{
    public const int ChunkBytes = 4_194_304;
    public const ulong MaximumChunkCount = 16_384;

    private const int HashBufferBytes = 1_048_576;
    private const int MaximumCachedOperations = 64;

    private readonly CompanionOperationJournal _journal;
    private readonly ConcurrentDictionary<string, OperationTransferState> _operations =
        new(StringComparer.Ordinal);
    private readonly ConcurrentQueue<string> _cacheOrder = new();

    public CompanionArtifactTransfer(CompanionOperationJournal journal)
    {
        _journal = journal ?? throw new ArgumentNullException(nameof(journal));
    }

    public async Task<CompanionArtifactChunk> ReadChunkAsync(
        string operationId,
        string artifactRole,
        ulong chunkIndex,
        CancellationToken cancellationToken = default)
    {
        RequireOperationId(operationId);
        RequireArtifactRole(artifactRole);
        if (chunkIndex >= MaximumChunkCount)
        {
            throw Error("artifact-chunk-invalid");
        }

        var record = ReadAvailableOperation(operationId);
        var state = GetOrCreateState(operationId);
        var resolved = await ResolveSourceCompositionAsync(state, record, cancellationToken)
            .ConfigureAwait(false);
        if (!resolved.Artifacts.TryGetValue(artifactRole, out var artifact))
        {
            throw Error("artifact-role-invalid");
        }

        var chunkCount = checked(
            (artifact.Identity.ByteCount + checked((ulong)ChunkBytes - 1)) /
            checked((ulong)ChunkBytes));
        if (chunkCount is 0 or > MaximumChunkCount || chunkIndex >= chunkCount)
        {
            throw Error("artifact-chunk-invalid");
        }

        var verifiedSnapshot = await EnsureVerifiedAsync(artifact, cancellationToken)
            .ConfigureAwait(false);
        var chunkOffset = checked(chunkIndex * checked((ulong)ChunkBytes));
        var chunkLength = checked((int)Math.Min(
            checked((ulong)ChunkBytes),
            artifact.Identity.ByteCount - chunkOffset));
        var bytes = GC.AllocateUninitializedArray<byte>(chunkLength);

        try
        {
            var before = ObserveFile(artifact.Path, artifact.Identity.ByteCount);
            if (before != verifiedSnapshot)
            {
                verifiedSnapshot = await VerifyExactAsync(artifact, cancellationToken)
                    .ConfigureAwait(false);
            }

            await using (var stream = OpenArtifact(artifact.Path, FileOptions.RandomAccess))
            {
                if (checked((ulong)stream.Length) != artifact.Identity.ByteCount)
                {
                    throw Error("artifact-identity-drift");
                }
                stream.Seek(checked((long)chunkOffset), SeekOrigin.Begin);
                await stream.ReadExactlyAsync(bytes, cancellationToken).ConfigureAwait(false);
                if (stream.Position != checked((long)(chunkOffset + checked((ulong)chunkLength))) ||
                    checked((ulong)stream.Length) != artifact.Identity.ByteCount)
                {
                    throw Error("artifact-identity-drift");
                }
            }

            var after = ObserveFile(artifact.Path, artifact.Identity.ByteCount);
            if (after != verifiedSnapshot)
            {
                throw Error("artifact-identity-drift");
            }

            if (chunkIndex + 1 == chunkCount)
            {
                verifiedSnapshot = await VerifyExactAsync(artifact, cancellationToken)
                    .ConfigureAwait(false);
            }

            var metadata = new CompanionArtifactResponseMetadata(
                operationId,
                artifactRole,
                artifact.Identity.ArtifactId,
                artifact.Identity.Sha256,
                artifact.Identity.ByteCount,
                chunkIndex,
                chunkCount,
                chunkOffset,
                checked((ulong)chunkLength));
            _ = CompanionLoopbackProtocol.ComputeArtifactMetadataSha256(metadata);
            return new CompanionArtifactChunk(
                bytes,
                metadata,
                CompanionLoopbackProtocol.Sha256Hex(bytes));
        }
        catch
        {
            CryptographicOperations.ZeroMemory(bytes);
            throw;
        }
    }

    private CompanionOperationRecord ReadAvailableOperation(string operationId)
    {
        CompanionOperationRecord record;
        try
        {
            record = _journal.Read(operationId);
        }
        catch (CompanionContractException error) when (
            error.Code is "journal-operation-missing")
        {
            throw Error("operation-not-found");
        }
        catch (CompanionContractException)
        {
            throw Error("internal-failure");
        }

        if (record.State != CompanionOperationState.Available)
        {
            throw Error("operation-not-available");
        }
        if (record.Branch != CompanionAcquisitionBranch.Source)
        {
            throw Error("operation-not-available");
        }
        if (record.Artifacts is null ||
            record.ErrorCode is not null ||
            record.SourceConversionIntentSha256 is null ||
            record.TotalBytes is not ulong totalBytes ||
            totalBytes == 0 ||
            record.CompletedBytes != totalBytes)
        {
            throw Error("artifact-identity-drift");
        }
        return record;
    }

    private OperationTransferState GetOrCreateState(string operationId)
    {
        if (_operations.TryGetValue(operationId, out var existing))
        {
            return existing;
        }

        var candidate = new OperationTransferState();
        var state = _operations.GetOrAdd(operationId, candidate);
        if (ReferenceEquals(candidate, state))
        {
            _cacheOrder.Enqueue(operationId);
            TrimCache();
        }
        return state;
    }

    private void TrimCache()
    {
        while (_operations.Count > MaximumCachedOperations &&
               _cacheOrder.TryDequeue(out var oldest))
        {
            _operations.TryRemove(oldest, out _);
        }
    }

    private async Task<ResolvedComposition> ResolveSourceCompositionAsync(
        OperationTransferState state,
        CompanionOperationRecord operation,
        CancellationToken cancellationToken)
    {
        var cached = Volatile.Read(ref state.Resolved);
        if (cached is not null)
        {
            RequireCachedOperationIdentity(cached, operation);
            return cached;
        }

        await state.ResolveGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            cached = Volatile.Read(ref state.Resolved);
            if (cached is not null)
            {
                RequireCachedOperationIdentity(cached, operation);
                return cached;
            }

            cancellationToken.ThrowIfCancellationRequested();
            CompanionPersistedSourceConversionIntent persisted;
            CompanionAcquireRequest request;
            TinyRustLmCompositionTerminalInspection inspection;
            try
            {
                persisted = _journal.ReadSourceConversionIntent(operation.OperationId);
                request = _journal.ReadRequest(operation.OperationId);
                inspection = TinyRustLmConversionTool.InspectCompositionTerminal(
                    persisted.Intent.Conversion);
            }
            catch (Exception error) when (
                error is CompanionContractException or TinyRustLmException or
                    IOException or UnauthorizedAccessException)
            {
                throw Error("artifact-identity-drift");
            }
            cancellationToken.ThrowIfCancellationRequested();

            if (persisted.Sha256 != operation.SourceConversionIntentSha256 ||
                persisted.Intent.OperationId != operation.OperationId ||
                persisted.Intent.RequestSha256 != operation.RequestSha256 ||
                request.ModelSourceLockSha256 !=
                    persisted.Intent.Conversion.ModelSourceLockSha256 ||
                request.TokenizerSourceLockSha256 !=
                    persisted.Intent.Conversion.TokenizerSourceLockSha256 ||
                request.CompositionProfileSha256 !=
                    persisted.Intent.Conversion.CompositionProfileSha256 ||
                inspection.Status != TinyRustLmCompositionTerminalStatus.Pass ||
                inspection.Composition is null)
            {
                throw Error("artifact-identity-drift");
            }

            var composition = inspection.Composition;
            if (!PathEquals(
                    composition.OutputRoot,
                    persisted.Intent.Conversion.OutputRoot) ||
                composition.ModelSourceLockSha256 != request.ModelSourceLockSha256 ||
                composition.TokenizerSourceLockSha256 != request.TokenizerSourceLockSha256)
            {
                throw Error("artifact-identity-drift");
            }

            var artifacts = ResolveArtifacts(operation, composition);
            var resolved = new ResolvedComposition(
                operation.Sequence,
                operation.RequestSha256,
                operation.SourceConversionIntentSha256,
                artifacts);
            Volatile.Write(ref state.Resolved, resolved);
            return resolved;
        }
        finally
        {
            state.ResolveGate.Release();
        }
    }

    private static IReadOnlyDictionary<string, ResolvedArtifact> ResolveArtifacts(
        CompanionOperationRecord operation,
        TinyRustLmVerifiedComposition composition)
    {
        var journaled = operation.Artifacts ?? throw Error("artifact-identity-drift");
        var pairs = new[]
        {
            ResolveArtifact(
                "composition",
                "composition.acg2",
                journaled.Composition,
                composition.Artifacts.Composition,
                composition.OutputRoot),
            ResolveArtifact(
                "model",
                "model.slm2",
                journaled.Model,
                composition.Artifacts.Model,
                composition.OutputRoot),
            ResolveArtifact(
                "tokenizer",
                "tokenizer.tokenizer2",
                journaled.Tokenizer,
                composition.Artifacts.Tokenizer,
                composition.OutputRoot),
            ResolveArtifact(
                "template",
                "template.template2",
                journaled.Template,
                composition.Artifacts.Template,
                composition.OutputRoot),
            ResolveArtifact(
                "sampling",
                "sampling.sampling2",
                journaled.Sampling,
                composition.Artifacts.Sampling,
                composition.OutputRoot),
            ResolveArtifact(
                "prompt",
                "prompt.prompt2",
                journaled.Prompt,
                composition.Artifacts.Prompt,
                composition.OutputRoot)
        };
        var total = pairs.Aggregate(
            0UL,
            static (current, pair) => checked(current + pair.Value.Identity.ByteCount));
        if (operation.TotalBytes != total || operation.CompletedBytes != total)
        {
            throw Error("artifact-identity-drift");
        }
        return pairs.ToDictionary(
            static pair => pair.Key,
            static pair => pair.Value,
            StringComparer.Ordinal);
    }

    private static KeyValuePair<string, ResolvedArtifact> ResolveArtifact(
        string role,
        string requiredFileName,
        CompanionArtifact journaled,
        TinyRustLmCompositionArtifact verified,
        string outputRoot)
    {
        if (verified.FileName != requiredFileName ||
            verified.Kind != journaled.Kind ||
            verified.Sha256 != journaled.Sha256 ||
            verified.ByteLength != journaled.ByteCount ||
            journaled.ArtifactId != $"sha256:{verified.Sha256}")
        {
            throw Error("artifact-identity-drift");
        }

        string root;
        string expectedPath;
        string observedPath;
        try
        {
            root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(outputRoot));
            expectedPath = Path.GetFullPath(Path.Combine(root, requiredFileName));
            observedPath = Path.GetFullPath(verified.Path);
            RejectReparseAncestors(root);
        }
        catch (Exception error) when (
            error is ArgumentException or IOException or UnauthorizedAccessException or
                NotSupportedException)
        {
            throw Error("artifact-identity-drift");
        }

        if (!PathEquals(Path.GetDirectoryName(expectedPath), root) ||
            !PathEquals(expectedPath, observedPath) ||
            Path.GetFileName(observedPath) != requiredFileName)
        {
            throw Error("artifact-identity-drift");
        }
        _ = ObserveFile(observedPath, journaled.ByteCount);
        return new KeyValuePair<string, ResolvedArtifact>(
            role,
            new ResolvedArtifact(observedPath, journaled, new ArtifactVerificationState()));
    }

    private static void RequireCachedOperationIdentity(
        ResolvedComposition cached,
        CompanionOperationRecord operation)
    {
        if (cached.Sequence != operation.Sequence ||
            cached.RequestSha256 != operation.RequestSha256 ||
            cached.SourceConversionIntentSha256 != operation.SourceConversionIntentSha256)
        {
            throw Error("artifact-identity-drift");
        }
    }

    private static async Task<FileSnapshot> EnsureVerifiedAsync(
        ResolvedArtifact artifact,
        CancellationToken cancellationToken)
    {
        await artifact.Verification.Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var observed = ObserveFile(artifact.Path, artifact.Identity.ByteCount);
            if (artifact.Verification.Snapshot is FileSnapshot cached && cached == observed)
            {
                return cached;
            }
            var verified = await HashAndVerifyAsync(artifact, cancellationToken)
                .ConfigureAwait(false);
            artifact.Verification.Snapshot = verified;
            return verified;
        }
        finally
        {
            artifact.Verification.Gate.Release();
        }
    }

    private static async Task<FileSnapshot> VerifyExactAsync(
        ResolvedArtifact artifact,
        CancellationToken cancellationToken)
    {
        await artifact.Verification.Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var verified = await HashAndVerifyAsync(artifact, cancellationToken)
                .ConfigureAwait(false);
            artifact.Verification.Snapshot = verified;
            return verified;
        }
        finally
        {
            artifact.Verification.Gate.Release();
        }
    }

    private static async Task<FileSnapshot> HashAndVerifyAsync(
        ResolvedArtifact artifact,
        CancellationToken cancellationToken)
    {
        var before = ObserveFile(artifact.Path, artifact.Identity.ByteCount);
        string digest;
        var buffer = ArrayPool<byte>.Shared.Rent(HashBufferBytes);
        try
        {
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using var stream = OpenArtifact(
                artifact.Path,
                FileOptions.Asynchronous | FileOptions.SequentialScan);
            if (checked((ulong)stream.Length) != artifact.Identity.ByteCount)
            {
                throw Error("artifact-identity-drift");
            }
            while (true)
            {
                var read = await stream.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (read == 0)
                {
                    break;
                }
                hash.AppendData(buffer, 0, read);
            }
            if (checked((ulong)stream.Position) != artifact.Identity.ByteCount ||
                checked((ulong)stream.Length) != artifact.Identity.ByteCount)
            {
                throw Error("artifact-identity-drift");
            }
            digest = Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("artifact-identity-drift");
        }
        finally
        {
            CryptographicOperations.ZeroMemory(buffer);
            ArrayPool<byte>.Shared.Return(buffer);
        }

        var after = ObserveFile(artifact.Path, artifact.Identity.ByteCount);
        if (before != after || digest != artifact.Identity.Sha256)
        {
            throw Error("artifact-identity-drift");
        }
        return after;
    }

    private static FileStream OpenArtifact(string path, FileOptions options)
    {
        try
        {
            return new FileStream(
                path,
                new FileStreamOptions
                {
                    Mode = FileMode.Open,
                    Access = FileAccess.Read,
                    Share = FileShare.Read,
                    BufferSize = HashBufferBytes,
                    Options = options
                });
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("artifact-identity-drift");
        }
    }

    private static FileSnapshot ObserveFile(string path, ulong expectedBytes)
    {
        try
        {
            var info = new FileInfo(path);
            info.Refresh();
            if (!info.Exists ||
                info.Length <= 0 ||
                checked((ulong)info.Length) != expectedBytes ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
            {
                throw Error("artifact-identity-drift");
            }
            return new FileSnapshot(info.Length, info.LastWriteTimeUtc.Ticks);
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("artifact-identity-drift");
        }
    }

    private static void RejectReparseAncestors(string directory)
    {
        var current = new DirectoryInfo(directory);
        while (current is not null)
        {
            current.Refresh();
            if (!current.Exists ||
                (current.Attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw Error("artifact-identity-drift");
            }
            current = current.Parent;
        }
    }

    private static void RequireOperationId(string operationId)
    {
        try
        {
            CompanionContract.RequireDigest(operationId, "artifact-operation-id");
        }
        catch (CompanionContractException)
        {
            throw Error("operation-not-found");
        }
    }

    private static void RequireArtifactRole(string artifactRole)
    {
        if (artifactRole is not (
            "composition" or "model" or "tokenizer" or
            "template" or "sampling" or "prompt"))
        {
            throw Error("artifact-role-invalid");
        }
    }

    private static bool PathEquals(string? left, string? right) =>
        string.Equals(
            left,
            right,
            OperatingSystem.IsWindows()
                ? StringComparison.OrdinalIgnoreCase
                : StringComparison.Ordinal);

    private static CompanionProtocolException Error(string code) => new(code);

    private sealed class OperationTransferState
    {
        internal SemaphoreSlim ResolveGate { get; } = new(1, 1);
        internal ResolvedComposition? Resolved;
    }

    private sealed record ResolvedComposition(
        ulong Sequence,
        string RequestSha256,
        string SourceConversionIntentSha256,
        IReadOnlyDictionary<string, ResolvedArtifact> Artifacts);

    private sealed record ResolvedArtifact(
        string Path,
        CompanionArtifact Identity,
        ArtifactVerificationState Verification);

    private sealed class ArtifactVerificationState
    {
        internal SemaphoreSlim Gate { get; } = new(1, 1);
        internal FileSnapshot? Snapshot { get; set; }
    }

    private readonly record struct FileSnapshot(long Length, long LastWriteTimeUtcTicks);
}
