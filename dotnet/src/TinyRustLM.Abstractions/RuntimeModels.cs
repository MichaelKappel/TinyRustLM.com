using System.Text.Json.Serialization;

namespace TinyRustLM;

/// <summary>An immutable nonzero 32-byte runtime operation identity.</summary>
public sealed class TinyRustLmOperationId : IEquatable<TinyRustLmOperationId>
{
    /// <summary>The exact operation identity byte length.</summary>
    public const int ByteLength = 32;

    private readonly byte[] _bytes;

    /// <summary>Creates an operation identity from exactly 32 nonzero bytes.</summary>
    public TinyRustLmOperationId(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length != ByteLength || IsAllZero(bytes))
        {
            throw new ArgumentException("An operation identity must contain exactly 32 nonzero bytes.", nameof(bytes));
        }

        _bytes = bytes.ToArray();
    }

    /// <summary>Parses an exact 64-character lowercase hexadecimal operation identity.</summary>
    public static TinyRustLmOperationId Parse(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        if (value.Length != ByteLength * 2 || value.Any(character =>
                character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')))
        {
            throw new FormatException("An operation identity must be lowercase hexadecimal with exactly 64 characters.");
        }

        return new TinyRustLmOperationId(Convert.FromHexString(value));
    }

    /// <summary>Returns a defensive copy of the exact identity bytes.</summary>
    public byte[] ToArray() => (byte[])_bytes.Clone();

    /// <summary>Returns the exact lowercase hexadecimal identity.</summary>
    public override string ToString() => Convert.ToHexString(_bytes).ToLowerInvariant();

    /// <inheritdoc />
    public bool Equals(TinyRustLmOperationId? other) =>
        other is not null && _bytes.AsSpan().SequenceEqual(other._bytes);

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as TinyRustLmOperationId);

    /// <inheritdoc />
    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var value in _bytes)
        {
            hash.Add(value);
        }

        return hash.ToHashCode();
    }

    private static bool IsAllZero(ReadOnlySpan<byte> bytes)
    {
        byte aggregate = 0;
        foreach (var value in bytes)
        {
            aggregate |= value;
        }

        return aggregate == 0;
    }
}

/// <summary>Explicit resource ceilings for one native conversation runtime.</summary>
public sealed record TinyRustLmRuntimePolicy(
    ulong MaximumModelBytes,
    uint MaximumSequenceTokens,
    ulong MaximumKvBytes,
    ulong MaximumScratchBytes,
    ulong MaximumResolvedMemberBytes,
    ulong MaximumResidentDependencyBytes,
    ulong MaximumRequestBytes);

/// <summary>Exact local paths for the five members named by one ACG2 composition.</summary>
public sealed record TinyRustLmMemberPaths(
    string Model,
    string Tokenizer,
    string Template,
    string Sampling,
    string Prompt);

/// <summary>Inputs for fail-atomic activation of one exact ACG2 composition.</summary>
public sealed record TinyRustLmActivationRequest(
    string GraphPath,
    TinyRustLmMemberPaths Members);

/// <summary>Cryptographic identity of one active ACG2 composition.</summary>
public sealed record TinyRustLmCompositionIdentity(
    ulong ArtifactBytes,
    string ArtifactSha256,
    string GraphIdentitySha256,
    string MemberTableSha256);

/// <summary>Validated resident-memory plan for one active composition.</summary>
public sealed record TinyRustLmMemoryPlan(
    ulong ModelBytes,
    ulong KvBytes,
    ulong ScratchBytes);

/// <summary>One bounded observable runtime-state snapshot.</summary>
public sealed record TinyRustLmRuntimeState(
    string Schema,
    string State,
    string OperationId,
    ulong TranscriptRevision,
    TinyRustLmCompositionIdentity? ActiveComposition,
    ulong CommittedKvBytes,
    TinyRustLmMemoryPlan? MemoryPlan);

/// <summary>Closed terminal or active generation status.</summary>
public sealed record TinyRustLmGenerationStatus(
    string Kind,
    uint? StopTokenId);

/// <summary>One raw deterministic generation transition.</summary>
public sealed record TinyRustLmRuntimeStep(
    string Schema,
    uint? SelectedTokenId,
    uint? EmittedTokenId,
    TinyRustLmGenerationStatus Status,
    ulong CommittedKvBytes);

/// <summary>One consumed terminal raw output with its exact runtime bindings.</summary>
public sealed record TinyRustLmRuntimeOutput(
    string Schema,
    string Text,
    IReadOnlyList<uint> TokenIds,
    TinyRustLmGenerationStatus Status,
    TinyRustLmCompositionIdentity Composition,
    string OperationId,
    ulong CommittedKvBytes);

/// <summary>Exact schema identities advertised by the current native ABI.</summary>
public sealed record TinyRustLmNativeContracts(
    string ModelInspection,
    string RuntimeCreate,
    string RuntimeActivation,
    [property: JsonPropertyName("p2pPrepare")]
    string P2PPrepare,
    [property: JsonPropertyName("p2pAssemble")]
    string P2PAssemble);

/// <summary>Hard ceilings advertised by the current native ABI.</summary>
public sealed record TinyRustLmNativeLimits(
    ulong MaximumModelRequestJsonBytes,
    ulong MaximumRuntimeJsonBytes,
    ulong MaximumPrompt2RequestBytes,
    [property: JsonPropertyName("maximumP2pRequestJsonBytes")]
    ulong MaximumP2PRequestJsonBytes,
    [property: JsonPropertyName("maximumP2pManifestBytes")]
    ulong MaximumP2PManifestBytes,
    ulong MaximumRuntimeHandles,
    ulong MaximumModelBytes,
    uint MaximumSequenceTokens,
    ulong MaximumKvBytes,
    ulong MaximumScratchBytes,
    ulong MaximumResolvedMemberBytes,
    ulong MaximumResidentDependencyBytes);

/// <summary>Self-description of the sole current native ABI.</summary>
public sealed record TinyRustLmNativeContract(
    string Schema,
    uint AbiRevision,
    string PackageVersion,
    string Product,
    bool PrelaunchSingleProduct,
    TinyRustLmNativeContracts Contracts,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<string> Symbols,
    TinyRustLmNativeLimits Limits);

/// <summary>One composition-owned TinyRustLM conversation runtime.</summary>
public interface ITinyRustLmRuntime : IDisposable
{
    /// <summary>Returns a fresh bounded state snapshot.</summary>
    TinyRustLmRuntimeState GetState();

    /// <summary>Fail-atomically resolves and activates one exact ACG2 composition.</summary>
    TinyRustLmRuntimeState ActivateComposition(
        TinyRustLmActivationRequest request,
        TinyRustLmOperationId expectedOperation);

    /// <summary>Compare-and-swaps the operation identity outside generation.</summary>
    TinyRustLmRuntimeState AdvanceOperation(
        TinyRustLmOperationId expectedCurrent,
        TinyRustLmOperationId next);

    /// <summary>Replaces the presentation-owned transcript revision outside generation.</summary>
    TinyRustLmRuntimeState SetTranscriptRevision(ulong transcriptRevision);

    /// <summary>Compiles and prefills one exact canonical Prompt2 request wire.</summary>
    TinyRustLmRuntimeState BeginRequest(
        ReadOnlyMemory<byte> prompt2Request,
        TinyRustLmOperationId expectedOperation);

    /// <summary>Advances generation exactly once.</summary>
    TinyRustLmRuntimeStep Step(bool cancelled = false);

    /// <summary>Consumes one terminal raw output exactly once.</summary>
    TinyRustLmRuntimeOutput Finish();
}

/// <summary>Factory and native-contract authority for conversation runtimes.</summary>
public interface ITinyRustLmRuntimeFactory
{
    /// <summary>Returns the validated exact native ABI contract.</summary>
    TinyRustLmNativeContract GetNativeContract();

    /// <summary>Creates one empty bounded runtime with explicit initial state.</summary>
    ITinyRustLmRuntime CreateRuntime(
        TinyRustLmRuntimePolicy policy,
        TinyRustLmOperationId initialOperation,
        ulong transcriptRevision = 0);
}
