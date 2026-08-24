namespace TinyRustLM;

/// <summary>Caller-supplied hard limits for exact SLM2 inspection.</summary>
public sealed record Slm2InspectionPolicy(
    ulong MaximumFileBytes,
    uint MaximumTensors);

/// <summary>Validated architecture metadata from one exact SLM2 artifact.</summary>
public sealed record Slm2ModelSpec(
    string ArtifactClass,
    uint VocabularySize,
    uint ContextLength,
    uint EmbeddingSize,
    uint FeedForwardSize,
    uint LayerCount,
    uint HeadCount,
    uint KvHeadCount,
    uint HeadDimension,
    float RopeTheta,
    float NormalizationEpsilon,
    bool TiedEmbeddings,
    bool QkvBias,
    bool QkNormalization);

/// <summary>Cryptographic and structural inspection of one exact SLM2 artifact.</summary>
public sealed record Slm2Inspection(
    string FormatProfile,
    string FormatProfileSha256,
    string WeightProfile,
    string WeightProfileSha256,
    ulong ArtifactBytes,
    string ArtifactSha256,
    string ManifestSha256,
    string TensorLayoutSha256,
    ulong TensorCount,
    Slm2ModelSpec Model);

/// <summary>Exact SLM2 inspection API.</summary>
public interface ISlm2Inspector
{
    /// <summary>Validates and inspects one local SLM2 artifact under explicit limits.</summary>
    Slm2Inspection Inspect(string path, Slm2InspectionPolicy policy);
}
