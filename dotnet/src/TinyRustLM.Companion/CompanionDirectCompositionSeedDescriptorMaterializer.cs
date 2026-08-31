using System.Buffers;
using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TinyRustLM;

namespace TinyRustLM.Companion;

/// <summary>Immutable result of one create-only direct-composition seed descriptor write.</summary>
public sealed record CompanionDirectCompositionSeedMaterialization(
    string OperationId,
    string CompositionId,
    string DescriptorPath,
    ulong DescriptorBytes,
    string DescriptorSha256);

/// <summary>Internal, freshly verified launch evidence whose paths never cross the public API.</summary>
internal sealed record CompanionDirectCompositionSeedLaunchEvidence(
    string OperationId,
    string CompositionId,
    string DescriptorPath,
    string DescriptorSha256,
    IReadOnlyList<string> MemberPaths);

/// <summary>Stable public-safe failure from direct-composition seed materialization.</summary>
public sealed class CompanionDirectCompositionSeedException : Exception
{
    /// <summary>Creates one failure carrying only its registered public-safe code.</summary>
    public CompanionDirectCompositionSeedException(string code)
        : base(code)
    {
        Code = code;
    }

    /// <summary>Gets the registered public-safe failure code.</summary>
    public string Code { get; }
}

/// <summary>
/// Materializes one Rust seed CLI descriptor from an independently reverified available operation.
/// </summary>
public sealed class CompanionDirectCompositionSeedDescriptorMaterializer
{
    /// <summary>Gets the sole descriptor schema identity emitted by this materializer.</summary>
    public const string DescriptorSchema = "tinyrustlm.direct-composition-seed/1";

    /// <summary>Gets the sole direct-composition HTTP protocol profile.</summary>
    public const string ProtocolProfile = "tinyrustlm.direct-composition-http.v1";

    /// <summary>Gets the required ACG2 composition profile identity.</summary>
    public const string Acg2CompositionProfile = "org.minimodel.acg2/2.0";

    /// <summary>Gets the registered SHA-256 identity of the required ACG2 profile.</summary>
    public const string Acg2CompositionProfileSha256 =
        "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be";

    /// <summary>Gets the fixed journal directory beneath application state.</summary>
    internal const string JournalDirectoryName = "source-operation-journal-v1";

    /// <summary>Gets the fixed descriptor directory beneath application state.</summary>
    internal const string DescriptorDirectoryName = "direct-composition-seeds-v1";

    private const string DescriptorRootMarkerName = ".owner";
    private const string DescriptorRootMarker =
        "tinyrustlm.companion.direct-composition-seed-root.v1\n";
    private const int MaximumDescriptorBytes = 8 * 1024;
    private const int HashBufferBytes = 1_048_576;
    private const int Acg2ArtifactBytes = 896;
    private const int Acg2HeaderBytes = 256;
    private const int Acg2MemberCount = 5;
    private const int Acg2MemberRecordBytes = 128;
    private const int Acg2MemberTableOffset = 256;
    private const int Acg2MemberTableBytes = 640;
    private const ulong MaximumDirectArtifactBytes = 68_719_476_736;
    private const ulong MaximumDirectCompositionBytes = 68_787_701_384;
    private const ulong MaximumAcg2ResolvedMemberBytes = 68_787_700_488;
    private static readonly byte[] Acg2Magic = "ACG2\r\n\x1a\n"u8.ToArray();
    private static readonly byte[] Acg2FormatId = "minimodel.acg2\0\0"u8.ToArray();
    private static readonly byte[] Acg2GraphDomain =
        "tinyrustlm.acg2.champion-graph.v1\0"u8.ToArray();
    // Array order is the canonical six-member descriptor and Rust CLI order.
    private static readonly MemberContract[] MemberContracts =
    [
        new("model.slm2", "slm2",
            "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8",
            68_719_476_736),
        new("tokenizer.tokenizer2", "tokenizer2",
            "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de",
            67_108_864),
        new("template.template2", "template2",
            "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
            1_048_576),
        new("sampling.sampling2", "sampling2",
            "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d",
            65_800),
        new("prompt.prompt2", "prompt2",
            "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c",
            512),
        new("composition.acg2", "acg2", Acg2CompositionProfileSha256,
            Acg2ArtifactBytes)
    ];

    private readonly CompanionOperationJournal _journal;
    private readonly string _descriptorRoot;
    private readonly SemaphoreSlim _materializationGate = new(1, 1);

    /// <summary>Creates one materializer bound to fixed journal and descriptor roots.</summary>
    private CompanionDirectCompositionSeedDescriptorMaterializer(
        CompanionOperationJournal journal,
        string descriptorRoot)
    {
        _journal = journal;
        _descriptorRoot = descriptorRoot;
    }

    /// <summary>
    /// Opens the fixed journal and descriptor roots beneath one application-owned state root.
    /// </summary>
    public static CompanionDirectCompositionSeedDescriptorMaterializer
        OpenFromApplicationStateRoot(string applicationStateRoot)
    {
        var stateRoot = RequireDirectoryTree(
            applicationStateRoot,
            "direct-composition-seed-state-root");
        CompanionOperationJournal journal;
        try
        {
            journal = new CompanionOperationJournal(
                Path.Combine(stateRoot, JournalDirectoryName));
        }
        catch (CompanionContractException)
        {
            throw Error("direct-composition-seed-journal");
        }
        return Create(journal, stateRoot);
    }

    /// <summary>Opens fixed descriptor storage around an already-owned journal for focused tests.</summary>
    internal static CompanionDirectCompositionSeedDescriptorMaterializer OpenForJournal(
        CompanionOperationJournal journal,
        string applicationStateRoot)
    {
        ArgumentNullException.ThrowIfNull(journal);
        var stateRoot = RequireDirectoryTree(
            applicationStateRoot,
            "direct-composition-seed-state-root");
        return Create(journal, stateRoot);
    }

    /// <summary>
    /// Revalidates one available operation and writes its sole canonical descriptor create-only.
    /// </summary>
    public async Task<CompanionDirectCompositionSeedMaterialization> MaterializeAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        await _materializationGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await MaterializeExclusiveAsync(
                    operationId,
                    allowExisting: false,
                    cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            _materializationGate.Release();
        }
    }

    /// <summary>
    /// Creates the fixed descriptor or reconciles an existing byte-identical descriptor.
    /// </summary>
    internal async Task<CompanionDirectCompositionSeedMaterialization>
        MaterializeOrReadAsync(
            string operationId,
            CancellationToken cancellationToken = default)
    {
        await _materializationGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await MaterializeExclusiveAsync(
                    operationId,
                    allowExisting: true,
                    cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            _materializationGate.Release();
        }
    }

    /// <summary>
    /// Reopens the fixed journal and descriptor, then independently rehashes the closed member set.
    /// </summary>
    internal async Task<CompanionDirectCompositionSeedLaunchEvidence> ReverifyForLaunchAsync(
        CompanionDirectCompositionSeedMaterialization materialization,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(materialization);
        await _materializationGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await ReverifyForLaunchExclusiveAsync(materialization, cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            _materializationGate.Release();
        }
    }

    /// <summary>Creates one materializer with a fixed derived descriptor root.</summary>
    private static CompanionDirectCompositionSeedDescriptorMaterializer Create(
        CompanionOperationJournal journal,
        string stateRoot)
    {
        var descriptorRoot = OpenDescriptorRoot(stateRoot);
        return new CompanionDirectCompositionSeedDescriptorMaterializer(journal, descriptorRoot);
    }

    /// <summary>Performs one serialized materialization without accepting any file paths.</summary>
    private async Task<CompanionDirectCompositionSeedMaterialization> MaterializeExclusiveAsync(
        string operationId,
        bool allowExisting,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var evidence = ResolveEvidence(operationId, cancellationToken);
        var targetPath = TargetPath(evidence.Operation.OperationId);
        if (!allowExisting)
        {
            RequireTargetAbsent(targetPath);
        }

        var opened = OpenMembers(evidence.Members);
        string? stagingPath = null;
        try
        {
            byte[]? acg2Bytes = null;
            foreach (var member in opened)
            {
                var captured = await HashAndVerifyAsync(
                    member,
                    member.Member.Ordinal == Acg2MemberCount,
                    cancellationToken).ConfigureAwait(false);
                if (captured is not null)
                {
                    acg2Bytes = captured;
                }
            }

            var graphIdentity = ValidateAcg2Closure(
                acg2Bytes ?? throw Error("direct-composition-seed-identity-drift"),
                evidence.Members,
                evidence.Composition.GraphIdentitySha256);
            RequireUnchangedOperation(evidence.Operation);
            var descriptor = EncodeCanonicalDescriptor(graphIdentity, evidence.Members);
            var materialization = new CompanionDirectCompositionSeedMaterialization(
                evidence.Operation.OperationId,
                $"sha256:{graphIdentity}",
                targetPath,
                checked((ulong)descriptor.LongLength),
                ComputeSha256(descriptor));
            if (allowExisting && File.Exists(targetPath))
            {
                VerifyDescriptorFile(
                    targetPath,
                    descriptor,
                    "direct-composition-seed-identity-drift");
                RequireStableMembers(opened);
                RequireUnchangedOperation(evidence.Operation);
                cancellationToken.ThrowIfCancellationRequested();
                return materialization;
            }

            stagingPath = WriteStagingDescriptor(evidence.Operation.OperationId, descriptor);
            RequireStableMembers(opened);
            RequireUnchangedOperation(evidence.Operation);
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                PromoteDescriptor(stagingPath, targetPath);
            }
            catch (CompanionDirectCompositionSeedException exception) when (
                allowExisting && exception.Code == "direct-composition-seed-exists")
            {
                VerifyDescriptorFile(
                    targetPath,
                    descriptor,
                    "direct-composition-seed-identity-drift");
                RequireStableMembers(opened);
                RequireUnchangedOperation(evidence.Operation);
                cancellationToken.ThrowIfCancellationRequested();
                return materialization;
            }
            stagingPath = null;
            VerifyDescriptorFile(targetPath, descriptor, "direct-composition-seed-write");
            return materialization;
        }
        finally
        {
            foreach (var member in opened)
            {
                member.Stream.Dispose();
            }
            DeleteOwnedStaging(stagingPath);
        }
    }

    /// <summary>Reverifies one materialization without accepting or deriving from its paths.</summary>
    private async Task<CompanionDirectCompositionSeedLaunchEvidence>
        ReverifyForLaunchExclusiveAsync(
            CompanionDirectCompositionSeedMaterialization materialization,
            CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!IsSha256(materialization.OperationId) ||
            materialization.CompositionId is not { Length: 71 } suppliedCompositionId ||
            !suppliedCompositionId.StartsWith("sha256:", StringComparison.Ordinal) ||
            !IsSha256(suppliedCompositionId[7..]) ||
            string.IsNullOrWhiteSpace(materialization.DescriptorPath) ||
            !IsSha256(materialization.DescriptorSha256) ||
            materialization.DescriptorBytes is 0 or > MaximumDescriptorBytes)
        {
            throw Error("direct-composition-seed-identity-drift");
        }
        var evidence = ResolveEvidence(materialization.OperationId, cancellationToken);
        var targetPath = TargetPath(evidence.Operation.OperationId);
        var opened = OpenMembers(evidence.Members);
        try
        {
            byte[]? acg2Bytes = null;
            foreach (var member in opened)
            {
                var captured = await HashAndVerifyAsync(
                    member,
                    member.Member.Ordinal == Acg2MemberCount,
                    cancellationToken).ConfigureAwait(false);
                if (captured is not null)
                {
                    acg2Bytes = captured;
                }
            }

            var graphIdentity = ValidateAcg2Closure(
                acg2Bytes ?? throw Error("direct-composition-seed-identity-drift"),
                evidence.Members,
                evidence.Composition.GraphIdentitySha256);
            var descriptor = EncodeCanonicalDescriptor(graphIdentity, evidence.Members);
            var compositionId = $"sha256:{graphIdentity}";
            if (materialization.OperationId != evidence.Operation.OperationId ||
                materialization.CompositionId != compositionId ||
                !PathEquals(materialization.DescriptorPath, targetPath) ||
                materialization.DescriptorBytes != checked((ulong)descriptor.LongLength) ||
                materialization.DescriptorSha256 != ComputeSha256(descriptor))
            {
                throw Error("direct-composition-seed-identity-drift");
            }

            VerifyDescriptorFile(
                targetPath,
                descriptor,
                "direct-composition-seed-identity-drift");
            RequireStableMembers(opened);
            RequireUnchangedOperation(evidence.Operation);
            cancellationToken.ThrowIfCancellationRequested();
            return new CompanionDirectCompositionSeedLaunchEvidence(
                evidence.Operation.OperationId,
                compositionId,
                targetPath,
                materialization.DescriptorSha256,
                Array.AsReadOnly(evidence.Members.Select(static member => member.Path).ToArray()));
        }
        finally
        {
            foreach (var member in opened)
            {
                member.Stream.Dispose();
            }
        }
    }

    /// <summary>Resolves durable operation evidence and its exact fixed member paths.</summary>
    private Evidence ResolveEvidence(string operationId, CancellationToken cancellationToken)
    {
        CompanionOperationRecord operation;
        try
        {
            operation = _journal.Read(operationId);
        }
        catch (CompanionContractException)
        {
            throw Error("direct-composition-seed-operation-not-found");
        }

        if (operation.State != CompanionOperationState.Available)
        {
            throw Error("direct-composition-seed-operation-not-available");
        }
        if (operation.Route != CompanionAcquisitionRoute.Source ||
            operation.Artifacts is null ||
            operation.ErrorCode is not null ||
            operation.SourceConversionIntentSha256 is null ||
            operation.PhaseTotalBytes is not ulong phaseTotal ||
            phaseTotal == 0 ||
            operation.PhaseCompletedBytes != phaseTotal)
        {
            throw Error("direct-composition-seed-identity-drift");
        }

        cancellationToken.ThrowIfCancellationRequested();
        CompanionAcquireRequest request;
        CompanionPersistedSourceConversionIntent persisted;
        TinyRustLmCompositionTerminalInspection inspection;
        try
        {
            CompanionContract.ValidateArtifactSet(operation.Artifacts);
            request = _journal.ReadRequest(operation.OperationId);
            persisted = _journal.ReadSourceConversionIntent(operation.OperationId);
            inspection = TinyRustLmConversionTool.InspectCompositionTerminal(
                persisted.Intent.Conversion);
        }
        catch (Exception exception) when (
            exception is CompanionContractException or TinyRustLmException or IOException or
                UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("direct-composition-seed-identity-drift");
        }
        cancellationToken.ThrowIfCancellationRequested();

        if (persisted.Sha256 != operation.SourceConversionIntentSha256 ||
            persisted.Intent.OperationId != operation.OperationId ||
            persisted.Intent.RequestSha256 != operation.RequestSha256 ||
            request.ModelSourceLockSha256 != persisted.Intent.Conversion.ModelSourceLockSha256 ||
            request.TokenizerSourceLockSha256 !=
                persisted.Intent.Conversion.TokenizerSourceLockSha256 ||
            request.CompositionProfileSha256 != TinyRustLmConversionTool.CompositionProfileSha256 ||
            request.CompositionProfileSha256 !=
                persisted.Intent.Conversion.CompositionProfileSha256 ||
            inspection.Status != TinyRustLmCompositionTerminalStatus.Pass ||
            inspection.Composition is null)
        {
            throw Error("direct-composition-seed-identity-drift");
        }

        var composition = inspection.Composition;
        if (composition.Schema != TinyRustLmConversionTool.VerifiedCompositionSchema ||
            !PathEquals(composition.OutputRoot, persisted.Intent.Conversion.OutputRoot) ||
            composition.ModelSourceLockSha256 != request.ModelSourceLockSha256 ||
            composition.TokenizerSourceLockSha256 != request.TokenizerSourceLockSha256 ||
            !IsSha256(composition.GraphIdentitySha256))
        {
            throw Error("direct-composition-seed-identity-drift");
        }

        var members = ResolveMembers(operation, composition);
        return new Evidence(operation, composition, members);
    }

    /// <summary>Cross-binds journal identities to the six inspected artifacts in Rust CLI order.</summary>
    private static ResolvedMember[] ResolveMembers(
        CompanionOperationRecord operation,
        TinyRustLmVerifiedComposition composition)
    {
        var journaled = operation.Artifacts
            ?? throw Error("direct-composition-seed-identity-drift");
        var journalMembers = new[]
        {
            journaled.Model,
            journaled.Tokenizer,
            journaled.Template,
            journaled.Sampling,
            journaled.Prompt,
            journaled.Composition
        };
        var verifiedMembers = composition.Artifacts.InCanonicalOrder();
        var outputRoot = RequireDirectoryTree(
            composition.OutputRoot,
            "direct-composition-seed-identity-drift");
        var resolved = new ResolvedMember[MemberContracts.Length];
        var paths = new HashSet<string>(PathComparer);
        ulong total = 0;

        try
        {
            for (var index = 0; index < resolved.Length; index++)
            {
                var contract = MemberContracts[index];
                var identity = journalMembers[index];
                var verified = verifiedMembers[index];
                var expectedPath = Path.GetFullPath(Path.Combine(outputRoot, contract.FileName));
                var observedPath = Path.GetFullPath(verified.Path);
                if (verified.FileName != contract.FileName ||
                    verified.Kind != contract.Kind ||
                    identity.Kind != contract.Kind ||
                    identity.ArtifactId != $"sha256:{identity.Sha256}" ||
                    verified.Sha256 != identity.Sha256 ||
                    verified.ByteLength != identity.ByteCount ||
                    !IsSha256(identity.Sha256) ||
                    identity.ByteCount is 0 or > MaximumDirectArtifactBytes ||
                    identity.ByteCount > contract.MaximumBytes ||
                    (index == Acg2MemberCount && identity.ByteCount != Acg2ArtifactBytes) ||
                    !PathEquals(Path.GetDirectoryName(expectedPath), outputRoot) ||
                    !PathEquals(expectedPath, observedPath) ||
                    Path.GetFileName(observedPath) != contract.FileName ||
                    !paths.Add(observedPath))
                {
                    throw Error("direct-composition-seed-identity-drift");
                }
                total = checked(total + identity.ByteCount);
                resolved[index] = new ResolvedMember(
                    index,
                    contract,
                    identity,
                    observedPath);
            }
        }
        catch (Exception exception) when (
            exception is ArgumentException or IOException or NotSupportedException or
                OverflowException)
        {
            throw Error("direct-composition-seed-identity-drift");
        }

        if (total > MaximumDirectCompositionBytes ||
            operation.PhaseTotalBytes != total ||
            operation.PhaseCompletedBytes != total)
        {
            throw Error("direct-composition-seed-identity-drift");
        }
        return resolved;
    }

    /// <summary>Opens every exact regular member while denying writers for this transaction.</summary>
    private static List<OpenedMember> OpenMembers(IReadOnlyList<ResolvedMember> members)
    {
        var opened = new List<OpenedMember>(members.Count);
        try
        {
            foreach (var member in members)
            {
                var before = ObserveMember(member);
                var stream = new FileStream(
                    member.Path,
                    new FileStreamOptions
                    {
                        Mode = FileMode.Open,
                        Access = FileAccess.Read,
                        Share = FileShare.Read,
                        BufferSize = HashBufferBytes,
                        Options = FileOptions.Asynchronous | FileOptions.SequentialScan
                    });
                if (checked((ulong)stream.Length) != member.Identity.ByteCount)
                {
                    stream.Dispose();
                    throw Error("direct-composition-seed-identity-drift");
                }
                opened.Add(new OpenedMember(member, stream, before));
            }
            return opened;
        }
        catch (CompanionDirectCompositionSeedException)
        {
            foreach (var member in opened)
            {
                member.Stream.Dispose();
            }
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            foreach (var member in opened)
            {
                member.Stream.Dispose();
            }
            throw Error("direct-composition-seed-identity-drift");
        }
    }

    /// <summary>Streams and hashes one open member, optionally retaining only the bounded ACG2 bytes.</summary>
    private static async Task<byte[]?> HashAndVerifyAsync(
        OpenedMember opened,
        bool capture,
        CancellationToken cancellationToken)
    {
        var buffer = ArrayPool<byte>.Shared.Rent(HashBufferBytes);
        byte[]? captured = capture
            ? GC.AllocateUninitializedArray<byte>(checked((int)opened.Member.Identity.ByteCount))
            : null;
        try
        {
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            ulong observed = 0;
            while (observed < opened.Member.Identity.ByteCount)
            {
                var requested = checked((int)Math.Min(
                    checked((ulong)buffer.Length),
                    opened.Member.Identity.ByteCount - observed));
                var count = await opened.Stream.ReadAsync(
                    buffer.AsMemory(0, requested),
                    cancellationToken).ConfigureAwait(false);
                if (count == 0)
                {
                    throw Error("direct-composition-seed-identity-drift");
                }
                hash.AppendData(buffer, 0, count);
                if (captured is not null)
                {
                    buffer.AsSpan(0, count).CopyTo(
                        captured.AsSpan(checked((int)observed), count));
                }
                observed += checked((ulong)count);
            }
            if (await opened.Stream.ReadAsync(
                    buffer.AsMemory(0, 1),
                    cancellationToken).ConfigureAwait(false) != 0 ||
                checked((ulong)opened.Stream.Length) != opened.Member.Identity.ByteCount ||
                HexLower(hash.GetHashAndReset()) != opened.Member.Identity.Sha256 ||
                ObserveMember(opened.Member) != opened.Snapshot)
            {
                throw Error("direct-composition-seed-identity-drift");
            }
            return captured;
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("direct-composition-seed-identity-drift");
        }
        finally
        {
            CryptographicOperations.ZeroMemory(buffer);
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    /// <summary>Requires every opened member path to retain its pre-hash snapshot.</summary>
    private static void RequireStableMembers(IEnumerable<OpenedMember> members)
    {
        foreach (var member in members)
        {
            if (ObserveMember(member.Member) != member.Snapshot ||
                checked((ulong)member.Stream.Length) != member.Member.Identity.ByteCount)
            {
                throw Error("direct-composition-seed-identity-drift");
            }
        }
    }

    /// <summary>Observes one exact regular non-reparse member and its bounded snapshot.</summary>
    private static FileSnapshot ObserveMember(ResolvedMember member)
    {
        try
        {
            var info = new FileInfo(member.Path);
            info.Refresh();
            if (!info.Exists ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0 ||
                info.Length <= 0 ||
                checked((ulong)info.Length) != member.Identity.ByteCount)
            {
                throw Error("direct-composition-seed-identity-drift");
            }
            return new FileSnapshot(info.Length, info.LastWriteTimeUtc.Ticks);
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("direct-composition-seed-identity-drift");
        }
    }

    /// <summary>Parses the exact ACG2 binary and binds its graph to all five member identities.</summary>
    private static string ValidateAcg2Closure(
        byte[] artifact,
        IReadOnlyList<ResolvedMember> members,
        string receiptGraphIdentity)
    {
        var bytes = artifact.AsSpan();
        if (bytes.Length != Acg2ArtifactBytes ||
            !bytes[..8].SequenceEqual(Acg2Magic) ||
            !bytes.Slice(8, 16).SequenceEqual(Acg2FormatId) ||
            ReadUInt16(bytes, 24) != 2 ||
            ReadUInt16(bytes, 26) != 0 ||
            bytes[28] != 1 ||
            bytes[29] != 1 ||
            ReadUInt16(bytes, 30) != 0 ||
            ReadUInt32(bytes, 32) != Acg2HeaderBytes ||
            ReadUInt32(bytes, 36) != Acg2MemberCount ||
            ReadUInt32(bytes, 40) != Acg2MemberRecordBytes ||
            !AllZero(bytes.Slice(44, 4)) ||
            ReadUInt64(bytes, 48) != Acg2ArtifactBytes ||
            ReadUInt64(bytes, 56) != Acg2MemberTableOffset ||
            ReadUInt64(bytes, 64) != Acg2MemberTableBytes ||
            !AllZero(bytes.Slice(144, 112)))
        {
            throw Error("direct-composition-seed-identity-drift");
        }

        ulong resolvedBytes = 0;
        for (var index = 0; index < Acg2MemberCount; index++)
        {
            var offset = Acg2MemberTableOffset + index * Acg2MemberRecordBytes;
            var expectedCode = checked((ushort)(index + 1));
            var member = members[index];
            if (ReadUInt16(bytes, offset) != 1 ||
                ReadUInt16(bytes, offset + 2) != expectedCode ||
                ReadUInt16(bytes, offset + 4) != expectedCode ||
                ReadUInt16(bytes, offset + 6) != 0 ||
                ReadUInt32(bytes, offset + 8) != index ||
                !AllZero(bytes.Slice(offset + 12, 4)) ||
                ReadUInt64(bytes, offset + 16) != member.Identity.ByteCount ||
                !DigestEquals(bytes.Slice(offset + 24, 32), member.Identity.Sha256) ||
                !DigestEquals(
                    bytes.Slice(offset + 56, 32),
                    member.Contract.FormatProfileSha256) ||
                !AllZero(bytes.Slice(offset + 88, 40)))
            {
                throw Error("direct-composition-seed-identity-drift");
            }
            resolvedBytes = checked(resolvedBytes + member.Identity.ByteCount);
        }
        if (resolvedBytes > MaximumAcg2ResolvedMemberBytes ||
            ReadUInt64(bytes, 72) != resolvedBytes)
        {
            throw Error("direct-composition-seed-identity-drift");
        }

        var memberTable = bytes.Slice(Acg2MemberTableOffset, Acg2MemberTableBytes);
        var memberTableSha256 = SHA256.HashData(memberTable);
        var graphIdentity = DeriveGraphIdentity(memberTable, resolvedBytes);
        if (!CryptographicOperations.FixedTimeEquals(bytes.Slice(112, 32), memberTableSha256) ||
            !CryptographicOperations.FixedTimeEquals(bytes.Slice(80, 32), graphIdentity) ||
            !DigestEquals(graphIdentity, receiptGraphIdentity))
        {
            throw Error("direct-composition-seed-identity-drift");
        }
        return Convert.ToHexString(graphIdentity).ToLowerInvariant();
    }

    /// <summary>Derives the Rust ACG2 domain-separated graph identity.</summary>
    private static byte[] DeriveGraphIdentity(ReadOnlySpan<byte> memberTable, ulong resolvedBytes)
    {
        Span<byte> framing = stackalloc byte[17];
        BinaryPrimitives.WriteUInt16LittleEndian(framing, 2);
        BinaryPrimitives.WriteUInt16LittleEndian(framing[2..], 0);
        framing[4] = 1;
        BinaryPrimitives.WriteUInt32LittleEndian(framing[5..], Acg2MemberCount);
        BinaryPrimitives.WriteUInt64LittleEndian(framing[9..], resolvedBytes);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData(Acg2GraphDomain);
        hash.AppendData(framing);
        hash.AppendData(memberTable);
        return hash.GetHashAndReset();
    }

    /// <summary>Encodes the sole compact Rust-compatible descriptor representation.</summary>
    private static byte[] EncodeCanonicalDescriptor(
        string graphIdentity,
        IReadOnlyList<ResolvedMember> members)
    {
        var buffer = new ArrayBufferWriter<byte>(1_024);
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("schema", DescriptorSchema);
            writer.WriteString("protocol", ProtocolProfile);
            writer.WriteString("compositionProfile", Acg2CompositionProfile);
            writer.WriteString("compositionProfileSha256", Acg2CompositionProfileSha256);
            writer.WriteString("compositionId", $"sha256:{graphIdentity}");
            writer.WriteStartArray("members");
            foreach (var member in members)
            {
                writer.WriteStartObject();
                writer.WriteString("name", member.Contract.FileName);
                writer.WriteNumber("bytes", member.Identity.ByteCount);
                writer.WriteString("sha256", member.Identity.Sha256);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        if (buffer.WrittenCount + 1 > MaximumDescriptorBytes)
        {
            throw Error("direct-composition-seed-descriptor");
        }
        var descriptor = GC.AllocateUninitializedArray<byte>(buffer.WrittenCount + 1);
        buffer.WrittenSpan.CopyTo(descriptor);
        descriptor[^1] = (byte)'\n';
        return descriptor;
    }

    /// <summary>Creates and flushes one uniquely owned same-directory staging descriptor.</summary>
    private string WriteStagingDescriptor(string operationId, ReadOnlySpan<byte> descriptor)
    {
        RequireDirectoryTree(_descriptorRoot, "direct-composition-seed-root");
        var path = Path.Combine(
            _descriptorRoot,
            $".{operationId}.{Guid.NewGuid():N}.staging");
        try
        {
            using var stream = new FileStream(
                path,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 4_096,
                FileOptions.WriteThrough);
            stream.Write(descriptor);
            stream.Flush(flushToDisk: true);
            if (OperatingSystem.IsLinux())
            {
                File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }
            return path;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("direct-composition-seed-write");
        }
    }

    /// <summary>Atomically promotes one owned staging file without replacing any target.</summary>
    private static void PromoteDescriptor(string stagingPath, string targetPath)
    {
        try
        {
            File.Move(stagingPath, targetPath);
        }
        catch (IOException) when (File.Exists(targetPath) || Directory.Exists(targetPath))
        {
            throw Error("direct-composition-seed-exists");
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("direct-composition-seed-write");
        }
    }

    /// <summary>Reopens the promoted descriptor and requires exact canonical bytes.</summary>
    private static void VerifyDescriptorFile(
        string path,
        ReadOnlySpan<byte> expected,
        string code)
    {
        try
        {
            var info = new FileInfo(path);
            info.Refresh();
            if (!info.Exists || info.Length != expected.Length ||
                info.Length > MaximumDescriptorBytes ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
            {
                throw Error(code);
            }
            var observed = File.ReadAllBytes(path);
            if (!observed.AsSpan().SequenceEqual(expected))
            {
                throw Error(code);
            }
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error(code);
        }
    }

    /// <summary>Requires the available terminal record to remain byte-for-byte equivalent.</summary>
    private void RequireUnchangedOperation(CompanionOperationRecord expected)
    {
        try
        {
            if (_journal.Read(expected.OperationId) != expected)
            {
                throw Error("direct-composition-seed-identity-drift");
            }
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw;
        }
        catch (CompanionContractException)
        {
            throw Error("direct-composition-seed-identity-drift");
        }
    }

    /// <summary>Creates or validates the sole fixed descriptor root and ownership marker.</summary>
    private static string OpenDescriptorRoot(string stateRoot)
    {
        var root = Path.Combine(stateRoot, DescriptorDirectoryName);
        try
        {
            var created = false;
            if (File.Exists(root))
            {
                throw Error("direct-composition-seed-root");
            }
            if (!Directory.Exists(root))
            {
                Directory.CreateDirectory(root);
                created = true;
                if (OperatingSystem.IsLinux())
                {
                    File.SetUnixFileMode(
                        root,
                        UnixFileMode.UserRead | UnixFileMode.UserWrite |
                            UnixFileMode.UserExecute);
                }
            }
            root = RequireDirectoryTree(root, "direct-composition-seed-root");
            var markerPath = Path.Combine(root, DescriptorRootMarkerName);
            if (!File.Exists(markerPath) && !Directory.Exists(markerPath))
            {
                if (!created)
                {
                    throw Error("direct-composition-seed-root");
                }
                try
                {
                    using var stream = new FileStream(
                        markerPath,
                        FileMode.CreateNew,
                        FileAccess.Write,
                        FileShare.None,
                        bufferSize: 4_096,
                        FileOptions.WriteThrough);
                    stream.Write(Encoding.ASCII.GetBytes(DescriptorRootMarker));
                    stream.Flush(flushToDisk: true);
                }
                catch (IOException) when (File.Exists(markerPath))
                {
                    // Another opener may have completed the same fixed marker.
                }
            }
            var marker = new FileInfo(markerPath);
            marker.Refresh();
            if (!marker.Exists || marker.Length != DescriptorRootMarker.Length ||
                (marker.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0 ||
                File.ReadAllText(markerPath, Encoding.ASCII) != DescriptorRootMarker)
            {
                throw Error("direct-composition-seed-root");
            }
            return root;
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw Error("direct-composition-seed-root");
        }
    }

    /// <summary>Normalizes one existing directory and rejects every reparse ancestor.</summary>
    private static string RequireDirectoryTree(string path, string code)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
            {
                throw Error(code);
            }
            var full = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
            var current = new DirectoryInfo(full);
            while (current is not null)
            {
                current.Refresh();
                if (!current.Exists ||
                    (current.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    throw Error(code);
                }
                current = current.Parent;
            }
            return full;
        }
        catch (CompanionDirectCompositionSeedException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is ArgumentException or IOException or UnauthorizedAccessException or
                NotSupportedException or PathTooLongException)
        {
            throw Error(code);
        }
    }

    /// <summary>Returns the fixed descriptor path for one validated journal operation identity.</summary>
    private string TargetPath(string operationId) =>
        Path.Combine(_descriptorRoot, $"{operationId}.json");

    /// <summary>Rejects any preexisting regular, directory, or reparse target.</summary>
    private static void RequireTargetAbsent(string targetPath)
    {
        if (File.Exists(targetPath) || Directory.Exists(targetPath))
        {
            throw Error("direct-composition-seed-exists");
        }
    }

    /// <summary>Deletes only a uniquely named same-root staging file after failed promotion.</summary>
    private void DeleteOwnedStaging(string? path)
    {
        if (path is null ||
            !PathEquals(Path.GetDirectoryName(path), _descriptorRoot) ||
            !Path.GetFileName(path).StartsWith(".", StringComparison.Ordinal) ||
            !Path.GetFileName(path).EndsWith(".staging", StringComparison.Ordinal))
        {
            return;
        }
        try
        {
            _ = RequireDirectoryTree(_descriptorRoot, "direct-composition-seed-root");
            File.Delete(path);
        }
        catch (Exception exception) when (
            exception is CompanionDirectCompositionSeedException or IOException or
                UnauthorizedAccessException or NotSupportedException)
        {
            // A failed cleanup never changes the original typed operation failure.
        }
    }

    /// <summary>Returns one lowercase SHA-256 from exact bytes.</summary>
    private static string ComputeSha256(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    /// <summary>Returns one lowercase SHA-256 from an already finalized digest.</summary>
    private static string HexLower(ReadOnlySpan<byte> digest) =>
        Convert.ToHexString(digest).ToLowerInvariant();

    /// <summary>Checks one exact lowercase nonzero SHA-256 value.</summary>
    private static bool IsSha256(string value) =>
        value is { Length: 64 } && value.All(static character =>
            character is (>= '0' and <= '9') or (>= 'a' and <= 'f')) &&
        value.Any(static character => character != '0');

    /// <summary>Compares one binary digest to its lowercase hexadecimal identity.</summary>
    private static bool DigestEquals(ReadOnlySpan<byte> digest, string expected)
    {
        if (!IsSha256(expected))
        {
            return false;
        }
        var decoded = Convert.FromHexString(expected);
        return CryptographicOperations.FixedTimeEquals(digest, decoded);
    }

    /// <summary>Returns whether every reserved byte is zero.</summary>
    private static bool AllZero(ReadOnlySpan<byte> bytes) =>
        bytes.IndexOfAnyExcept((byte)0) < 0;

    /// <summary>Reads one little-endian unsigned 16-bit field.</summary>
    private static ushort ReadUInt16(ReadOnlySpan<byte> bytes, int offset) =>
        BinaryPrimitives.ReadUInt16LittleEndian(bytes.Slice(offset, sizeof(ushort)));

    /// <summary>Reads one little-endian unsigned 32-bit field.</summary>
    private static uint ReadUInt32(ReadOnlySpan<byte> bytes, int offset) =>
        BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(offset, sizeof(uint)));

    /// <summary>Reads one little-endian unsigned 64-bit field.</summary>
    private static ulong ReadUInt64(ReadOnlySpan<byte> bytes, int offset) =>
        BinaryPrimitives.ReadUInt64LittleEndian(bytes.Slice(offset, sizeof(ulong)));

    /// <summary>Compares canonical paths using the host filesystem's case semantics.</summary>
    private static bool PathEquals(string? left, string? right) =>
        string.Equals(left, right, PathComparison);

    /// <summary>Creates one stable public-safe materialization error.</summary>
    private static CompanionDirectCompositionSeedException Error(string code) => new(code);

    /// <summary>Gets the path comparer matching the host filesystem's case semantics.</summary>
    private static StringComparer PathComparer => OperatingSystem.IsWindows()
        ? StringComparer.OrdinalIgnoreCase
        : StringComparer.Ordinal;

    /// <summary>Gets the path comparison matching the host filesystem's case semantics.</summary>
    private static StringComparison PathComparison => OperatingSystem.IsWindows()
        ? StringComparison.OrdinalIgnoreCase
        : StringComparison.Ordinal;

    /// <summary>Groups one journal operation with its independently resolved composition evidence.</summary>
    private sealed record Evidence(
        CompanionOperationRecord Operation,
        TinyRustLmVerifiedComposition Composition,
        ResolvedMember[] Members);

    /// <summary>Defines one fixed member name, role, profile, and resource ceiling.</summary>
    private sealed record MemberContract(
        string FileName,
        string Kind,
        string FormatProfileSha256,
        ulong MaximumBytes);

    /// <summary>Binds one ordered contract member to its verified identity and private path.</summary>
    private sealed record ResolvedMember(
        int Ordinal,
        MemberContract Contract,
        CompanionArtifact Identity,
        string Path);

    /// <summary>Holds one exclusively opened member and its pre-hash filesystem snapshot.</summary>
    private sealed record OpenedMember(
        ResolvedMember Member,
        FileStream Stream,
        FileSnapshot Snapshot);

    /// <summary>Captures the stable file attributes rechecked after streaming verification.</summary>
    private readonly record struct FileSnapshot(long Length, long LastWriteTimeUtcTicks);
}
