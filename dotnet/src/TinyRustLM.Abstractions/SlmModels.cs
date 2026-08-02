namespace TinyRustLM;

/// <summary>Inspection report for a validated TinyRustLM .slm artifact.</summary>
public sealed record SlmInspection(
    string Kind,
    int Version,
    string Sha256,
    long ByteCount,
    int SlmVersion,
    int ModelType,
    int VocabSize,
    int HiddenSize,
    int LayerCount,
    int HeadCount,
    int KvHeadCount,
    int HeadDim,
    int FfnSize,
    int MaxContext,
    long TokenizerBytes,
    int TensorCount,
    int F32TensorCount,
    int Q8_0TensorCount,
    int Q5_0TensorCount,
    int Q4_0TensorCount,
    string Quantization,
    ulong RuntimeChecksum);

/// <summary>Public .slm inspection API.</summary>
public interface ISlmInspector
{
    /// <summary>Validates and inspects a .slm model file.</summary>
    SlmInspection Inspect(string path);
}
