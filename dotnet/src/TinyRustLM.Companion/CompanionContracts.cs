using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace TinyRustLM.Companion;

public static partial class CompanionContract
{
    public const string AcquisitionRequestSchema = "tinyrustlm.companion.acquire.v2";
    public const string OperationRecordSchema = "tinyrustlm.companion.operation.v3";
    public const string ExecutionIntentSchema = "tinyrustlm.companion.execution-intent.v1";
    public const string SourceAcquisitionIntentSchema =
        "tinyrustlm.companion.source-acquisition-intent.v1";
    public const string SourceAcquisitionReceiptSchema =
        "tinyrustlm.companion.source-acquisition-receipt.v1";
    public const string SourceConversionIntentSchema =
        "tinyrustlm.companion.source-conversion-intent.v1";
    public const string OwnedRootMarker = "tinyrustlm.companion.owned-root.v1\n";
    public const ulong MaximumSourceBytes = 17_179_869_184;
    public const ulong MaximumArtifactBytes = 68_719_476_736;
    public const ulong MaximumCompositionBytes = 73_014_444_032;
    public const ulong MaximumProgressBytes = MaximumSourceBytes * 5;

    public static CompanionAcquireRequest ValidateAndNormalize(CompanionAcquireRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != AcquisitionRequestSchema)
        {
            throw new CompanionContractException("acquire-schema");
        }
        RequireAttemptId(request.AttemptId, "acquire-attempt-id");
        if (request.Route != CompanionAcquisitionRoute.Source)
        {
            throw new CompanionContractException("acquire-route");
        }
        if (!ModelIdPattern().IsMatch(request.ModelId ?? string.Empty))
        {
            throw new CompanionContractException("acquire-model-id");
        }
        if (!RepositoryPattern().IsMatch(request.SourceRepository ?? string.Empty))
        {
            throw new CompanionContractException("acquire-source-repository");
        }
        if (!RevisionPattern().IsMatch(request.SourceRevision ?? string.Empty))
        {
            throw new CompanionContractException("acquire-source-revision");
        }

        RequireDigest(request.ModelSourceLockSha256, "acquire-model-source-lock");
        RequireDigest(request.TokenizerSourceLockSha256, "acquire-tokenizer-source-lock");
        RequireDigest(request.CompositionProfileSha256, "acquire-composition-profile");
        if (!request.SourceAcquisitionApproved)
        {
            throw new CompanionContractException("acquire-source-approval");
        }
        if (request.MaximumSourceBytes is 0 or > MaximumSourceBytes)
        {
            throw new CompanionContractException("acquire-source-size-limit");
        }
        CompanionSourceDescriptor.RequireSupported(request);
        return request;
    }

    public static string OperationId(CompanionAcquireRequest request)
    {
        var bytes = CompanionLoopbackWire.EncodeAcquireRequest(request);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }

    public static void ValidateArtifactSet(CompanionArtifactSet value)
    {
        ArgumentNullException.ThrowIfNull(value);
        RequireArtifact(value.Composition, "acg2", "artifact-composition");
        RequireArtifact(value.Model, "slm2", "artifact-model");
        RequireArtifact(value.Tokenizer, "tokenizer2", "artifact-tokenizer");
        RequireArtifact(value.Template, "template2", "artifact-template");
        RequireArtifact(value.Sampling, "sampling2", "artifact-sampling");
        RequireArtifact(value.Prompt, "prompt2", "artifact-prompt");
        var total = value.All.Aggregate(
            0UL,
            static (current, artifact) => checked(current + artifact.ByteCount));
        if (total > MaximumCompositionBytes)
        {
            throw new CompanionContractException("artifact-total");
        }
    }

    private static void RequireArtifact(CompanionArtifact value, string kind, string code)
    {
        if (value is null || value.Kind != kind ||
            value.ByteCount is 0 or > MaximumArtifactBytes)
        {
            throw new CompanionContractException(code);
        }
        RequireContentId(value.ArtifactId, code);
        RequireDigest(value.Sha256, code);
        if (value.ArtifactId != $"sha256:{value.Sha256}")
        {
            throw new CompanionContractException(code);
        }
    }

    internal static void RequireDigest(string value, string code)
    {
        if (value is null || !DigestPattern().IsMatch(value))
        {
            throw new CompanionContractException(code);
        }
    }

    internal static void RequireAttemptId(string value, string code)
    {
        if (value is null || !AttemptIdPattern().IsMatch(value))
        {
            throw new CompanionContractException(code);
        }
    }

    internal static void RequireContentId(string value, string code)
    {
        if (value is null || !ContentIdPattern().IsMatch(value))
        {
            throw new CompanionContractException(code);
        }
    }

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$")]
    private static partial Regex ModelIdPattern();

    [GeneratedRegex("^[0-9a-f]{32}$")]
    private static partial Regex AttemptIdPattern();

    [GeneratedRegex("^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,94}[A-Za-z0-9])?/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,94}[A-Za-z0-9])?$")]
    private static partial Regex RepositoryPattern();

    [GeneratedRegex("^[0-9a-f]{40}$")]
    private static partial Regex RevisionPattern();

    [GeneratedRegex("^[0-9a-f]{64}$")]
    private static partial Regex DigestPattern();

    [GeneratedRegex("^[a-z0-9][a-z0-9._:-]{7,255}$")]
    private static partial Regex ContentIdPattern();
}

public sealed record CompanionAcquireRequest(
    string Schema,
    string AttemptId,
    CompanionAcquisitionRoute Route,
    string ModelId,
    string SourceRepository,
    string SourceRevision,
    string ModelSourceLockSha256,
    string TokenizerSourceLockSha256,
    string CompositionProfileSha256,
    bool SourceAcquisitionApproved,
    ulong MaximumSourceBytes);

public enum CompanionAcquisitionRoute
{
    Source
}

public enum CompanionOperationState
{
    Queued,
    AcquiringSource,
    Converting,
    VerifyingComposition,
    Available,
    Cancelled,
    Rejected
}

public sealed record CompanionArtifact(string Kind, string ArtifactId, string Sha256, ulong ByteCount);

public sealed record CompanionArtifactSet(
    CompanionArtifact Composition,
    CompanionArtifact Model,
    CompanionArtifact Tokenizer,
    CompanionArtifact Template,
    CompanionArtifact Sampling,
    CompanionArtifact Prompt)
{
    public IReadOnlyList<CompanionArtifact> All =>
        [Composition, Model, Tokenizer, Template, Sampling, Prompt];
}

public sealed record CompanionOperationProjection(
    string Schema,
    string OperationId,
    ulong Sequence,
    CompanionOperationState State,
    CompanionAcquisitionRoute Route,
    ulong PhaseCompletedBytes,
    ulong? PhaseTotalBytes,
    CompanionArtifactSet? Artifacts,
    string? ErrorCode);

public sealed record CompanionCancelRequest(string Schema, string CancellationId);

public sealed record CompanionOperationRecord(
    string Schema,
    string OperationId,
    string RequestSha256,
    ulong Sequence,
    CompanionOperationState State,
    CompanionAcquisitionRoute Route,
    string CreatedAtUtc,
    string UpdatedAtUtc,
    ulong PhaseCompletedBytes,
    ulong? PhaseTotalBytes,
    CompanionArtifactSet? Artifacts,
    string? ErrorCode,
    string? ExecutionIntentSha256,
    string? SourceAcquisitionIntentSha256,
    string? SourceAcquisitionReceiptSha256,
    string? SourceConversionIntentSha256);

public sealed class CompanionContractException : Exception
{
    public CompanionContractException(string code)
        : base(code)
    {
        Code = code;
    }

    public string Code { get; }
}
