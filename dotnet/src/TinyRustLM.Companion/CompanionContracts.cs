using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TinyRustLM.Companion;

public static partial class CompanionContract
{
    public const string AcquisitionRequestSchema = "tinyrustlm.companion.acquire.v1";
    public const string OperationRecordSchema = "tinyrustlm.companion.operation.v1";
    public const string OwnedRootMarker = "tinyrustlm.companion.owned-root.v1\n";
    public const int MaximumPeerCandidates = 2;
    public const ulong MaximumSourceBytes = 17_179_869_184;

    public static CompanionAcquireRequest ValidateAndNormalize(CompanionAcquireRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Schema != AcquisitionRequestSchema)
        {
            throw new CompanionContractException("acquire-schema");
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
        if (request.MaximumSourceBytes is 0 or > MaximumSourceBytes)
        {
            throw new CompanionContractException("acquire-source-size-limit");
        }

        var candidates = request.PeerCandidates?.ToArray()
            ?? throw new CompanionContractException("acquire-peer-candidates");
        if (candidates.Length > MaximumPeerCandidates)
        {
            throw new CompanionContractException("acquire-peer-candidate-count");
        }

        var normalizedCandidates = new List<CompanionPeerCandidate>(candidates.Length);
        var identities = new HashSet<string>(StringComparer.Ordinal);
        foreach (var candidate in candidates)
        {
            if (candidate is null)
            {
                throw new CompanionContractException("acquire-peer-candidate");
            }
            RequireContentId(candidate.ManifestId, "acquire-peer-manifest-id");
            var uri = ValidatePeerUri(candidate.ManifestUri);
            var identity = $"{candidate.ManifestId}\n{uri}";
            if (!identities.Add(identity))
            {
                throw new CompanionContractException("acquire-peer-duplicate");
            }
            normalizedCandidates.Add(new CompanionPeerCandidate(uri, candidate.ManifestId));
        }

        if (normalizedCandidates.Count == 0 && !request.SourceAcquisitionApproved)
        {
            throw new CompanionContractException("acquire-no-authorized-branch");
        }

        return request with
        {
            PeerCandidates = normalizedCandidates.AsReadOnly()
        };
    }

    public static string OperationId(CompanionAcquireRequest request)
    {
        var normalized = ValidateAndNormalize(request);
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            writer.WriteStartObject();
            writer.WriteString("schema", normalized.Schema);
            writer.WriteString("modelId", normalized.ModelId);
            writer.WriteString("sourceRepository", normalized.SourceRepository);
            writer.WriteString("sourceRevision", normalized.SourceRevision);
            writer.WriteString("modelSourceLockSha256", normalized.ModelSourceLockSha256);
            writer.WriteString("tokenizerSourceLockSha256", normalized.TokenizerSourceLockSha256);
            writer.WriteString("compositionProfileSha256", normalized.CompositionProfileSha256);
            writer.WriteBoolean("sourceAcquisitionApproved", normalized.SourceAcquisitionApproved);
            writer.WriteNumber("maximumSourceBytes", normalized.MaximumSourceBytes);
            writer.WriteStartArray("peerCandidates");
            foreach (var candidate in normalized.PeerCandidates)
            {
                writer.WriteStartObject();
                writer.WriteString("manifestUri", candidate.ManifestUri);
                writer.WriteString("manifestId", candidate.ManifestId);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        return Convert.ToHexString(SHA256.HashData(stream.ToArray())).ToLowerInvariant();
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
    }

    private static void RequireArtifact(CompanionArtifact value, string kind, string code)
    {
        if (value is null || value.Kind != kind || value.ByteCount == 0)
        {
            throw new CompanionContractException(code);
        }
        RequireContentId(value.ArtifactId, code);
        RequireDigest(value.Sha256, code);
    }

    private static string ValidatePeerUri(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 2_048 ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            uri.IsDefaultPort is false && uri.Port is < 1 or > 65535 ||
            string.IsNullOrWhiteSpace(uri.IdnHost) ||
            uri.AbsolutePath == "/" ||
            uri.AbsolutePath.EndsWith("/", StringComparison.Ordinal))
        {
            throw new CompanionContractException("acquire-peer-uri");
        }
        if (uri.HostNameType == UriHostNameType.IPv4 || uri.HostNameType == UriHostNameType.IPv6)
        {
            throw new CompanionContractException("acquire-peer-ip-literal");
        }

        return uri.GetComponents(
            UriComponents.SchemeAndServer | UriComponents.Path,
            UriFormat.UriEscaped);
    }

    internal static void RequireDigest(string value, string code)
    {
        if (value is null || !DigestPattern().IsMatch(value))
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
    string ModelId,
    string SourceRepository,
    string SourceRevision,
    string ModelSourceLockSha256,
    string TokenizerSourceLockSha256,
    string CompositionProfileSha256,
    bool SourceAcquisitionApproved,
    ulong MaximumSourceBytes,
    IReadOnlyList<CompanionPeerCandidate> PeerCandidates);

public sealed record CompanionPeerCandidate(string ManifestUri, string ManifestId);

public enum CompanionOperationState
{
    Queued,
    CheckingPeers,
    FetchingPeer,
    VerifyingPeer,
    AcquiringSource,
    Converting,
    VerifyingComposition,
    Available,
    Cancelled,
    Rejected
}

public enum CompanionAcquisitionBranch
{
    Undecided,
    Peer,
    Source,
    None
}

public sealed record CompanionArtifact(string Kind, string ArtifactId, string Sha256, ulong ByteCount);

public sealed record CompanionArtifactSet(
    CompanionArtifact Composition,
    CompanionArtifact Model,
    CompanionArtifact Tokenizer,
    CompanionArtifact Template,
    CompanionArtifact Sampling,
    CompanionArtifact Prompt);

public sealed record CompanionOperationRecord(
    string Schema,
    string OperationId,
    string RequestSha256,
    ulong Sequence,
    CompanionOperationState State,
    CompanionAcquisitionBranch Branch,
    string CreatedAtUtc,
    string UpdatedAtUtc,
    ulong CompletedBytes,
    ulong? TotalBytes,
    CompanionArtifactSet? Artifacts,
    string? ErrorCode);

public sealed class CompanionContractException : Exception
{
    public CompanionContractException(string code)
        : base(code)
    {
        Code = code;
    }

    public string Code { get; }
}
