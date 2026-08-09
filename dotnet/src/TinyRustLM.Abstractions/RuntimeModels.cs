using System.Text.Json.Serialization;

namespace TinyRustLM;

/// <summary>Generation options for the public TinyRustLM runtime harness.</summary>
/// <param name="MaxNewTokens">Requested output token count. Must be greater than zero.</param>
/// <param name="Temperature">Sampling temperature. Must be finite and greater than or equal to zero.</param>
/// <param name="TopK">Top-k candidate cap. Must be between 1 and 1024.</param>
/// <param name="TopP">Nucleus sampling threshold. Must be finite, greater than zero, and less than or equal to one.</param>
/// <param name="Seed">Deterministic sampling seed.</param>
public sealed record TinyRustLmGenerationOptions(
    int MaxNewTokens = 64,
    float Temperature = 0.7f,
    int TopK = 40,
    float TopP = 0.9f,
    uint Seed = 1);

/// <summary>Text and diagnostics produced by a generation call.</summary>
public sealed record TinyRustLmGenerationResult(string Text, string Diagnostics);

/// <summary>Report returned after a model is loaded.</summary>
public sealed record TinyRustLmLoadReport(SlmInspection Inspection, string Diagnostics);

/// <summary>Report returned after an immutable composition graph is activated.</summary>
public sealed record TinyRustLmCompositionActivationReport(
    long ByteCount,
    string Sha256,
    string Diagnostics);

/// <summary>Native SDK version report for diagnostics and support boundaries.</summary>
public sealed record TinyRustLmSdkVersion(
    string SdkVersion,
    int NativeAbiVersion,
    string Product);

/// <summary>Public runtime capability report.</summary>
public sealed record TinyRustLmCapabilities(
    string Kind,
    int Version,
    string SdkVersion,
    bool SlmValidation,
    bool ModelLoading,
    bool CompositionActivation,
    bool Generation,
    bool StepGeneration,
    bool Diagnostics,
    [property: JsonPropertyName("p2p_metadata_workflows")]
    bool P2PMetadataWorkflows,
    bool MemoryPackageWorkflows,
    IReadOnlyList<string> ExcludedPrivateCapabilities);

/// <summary>Public TinyRustLM runtime harness.</summary>
public interface ITinyRustLmRuntime : IDisposable
{
    /// <summary>Loads a validated .slm model into the runtime.</summary>
    TinyRustLmLoadReport LoadModel(string path, string? expectedSha256 = null);

    /// <summary>Activates an immutable .acg1 graph with its exact SHA-256 identity.</summary>
    TinyRustLmCompositionActivationReport ActivateComposition(
        string path,
        string expectedSha256);

    /// <summary>Unloads the active model.</summary>
    void UnloadModel();

    /// <summary>Generates text for a prompt.</summary>
    TinyRustLmGenerationResult Generate(string prompt, TinyRustLmGenerationOptions? options = null);

    /// <summary>Generates one token from the current context.</summary>
    TinyRustLmGenerationResult Step();

    /// <summary>Resets prompt and cache state.</summary>
    void Reset();

    /// <summary>Returns current runtime diagnostics.</summary>
    string GetDiagnostics();
}

/// <summary>Factory for public TinyRustLM runtime handles.</summary>
public interface ITinyRustLmRuntimeFactory
{
    /// <summary>Creates a runtime harness instance.</summary>
    ITinyRustLmRuntime CreateRuntime();

    /// <summary>Queries native SDK and ABI version details.</summary>
    TinyRustLmSdkVersion GetVersion();

    /// <summary>Queries public runtime capabilities.</summary>
    TinyRustLmCapabilities GetCapabilities();
}
