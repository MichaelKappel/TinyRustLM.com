using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TinyRustLM;

if (args.Length != 4)
{
    throw new ArgumentException("Expected SLM2 vectors, ACG2 vectors, work root, and conversion-package flag.");
}

Directory.CreateDirectory(args[2]);
var model = MaterializeVector(args[0], Path.Combine(args[2], "canonical.slm2"));
var graph = MaterializeVector(args[1], Path.Combine(args[2], "canonical.acg2"));

var inspector = new TinyRustLmSlm2Inspector();
var inspection = inspector.Inspect(
    model.Path,
    new Slm2InspectionPolicy(model.Bytes, 262_144));
Require(inspection.ArtifactBytes == model.Bytes, "SLM2 byte length drifted.");
Require(inspection.ArtifactSha256 == model.Sha256, "SLM2 identity drifted.");
Require(inspection.WeightProfile == "tinyrustlm.weight-q8-row-symmetric-f32-scale/1", "SLM2 weight profile drifted.");

var factory = new TinyRustLmRuntimeFactory();
var contract = factory.GetNativeContract();
Require(contract.Schema == "tinyrustlm.native_abi/1", "Native ABI schema drifted.");
Require(contract.AbiRevision == 1, "Native ABI revision drifted.");
Require(contract.Product == "TinyRustLM" && contract.PrelaunchSingleProduct, "Native product authority drifted.");
Require(contract.Symbols.Count == 15, "Native ABI symbol count drifted.");
Require(contract.Capabilities.SequenceEqual(new[]
{
    "slm2-inspection",
    "acg2-activation",
    "prompt2-sampling2-generation",
    "bounded-scalar-runtime",
    "composition-bound-direct-transport"
}, StringComparer.Ordinal), "Native capabilities drifted.");

var firstOperation = TinyRustLmOperationId.Parse(new string('1', 64));
var secondOperation = TinyRustLmOperationId.Parse(new string('2', 64));
using (var runtime = factory.CreateRuntime(
    new TinyRustLmRuntimePolicy(
        contract.Limits.MaximumModelBytes,
        contract.Limits.MaximumSequenceTokens,
        contract.Limits.MaximumKvBytes,
        contract.Limits.MaximumScratchBytes,
        contract.Limits.MaximumResolvedMemberBytes,
        contract.Limits.MaximumResidentDependencyBytes,
        contract.Limits.MaximumPrompt2RequestBytes),
    firstOperation))
{
    var state = runtime.GetState();
    Require(state.State == "empty" && state.OperationId == firstOperation.ToString(), "Runtime creation state drifted.");
    state = runtime.AdvanceOperation(firstOperation, secondOperation);
    Require(state.OperationId == secondOperation.ToString(), "Runtime operation CAS drifted.");
    state = runtime.SetTranscriptRevision(7);
    Require(state.TranscriptRevision == 7, "Runtime transcript revision drifted.");
}

var p2p = new TinyRustLmP2PClient();
var acgShare = p2p.PrepareShareKit(new PrepareShareKitRequest(
    graph.Path,
    Path.Combine(args[2], "share-acg2"),
    ContentId("acg2-artifact-manifest"),
    ContentId("acg2-qualification"),
    ContentId("acg2-provenance"),
    "Apache-2.0",
    "2026-08-24T00:00:00Z",
    TinyRustLmP2PAdmission.ForAcg2Composition()));
Require(acgShare.Schema == "tinyrustlm.native.p2p_share_kit/1", "ACG2 share report schema drifted.");
Require(acgShare.Manifest.ArtifactSha256 == graph.Sha256, "ACG2 share identity drifted.");
var acgManifestBytes = File.ReadAllBytes(acgShare.ManifestPath);
var inspectedAcgManifest = p2p.InspectManifest(acgManifestBytes);
Require(inspectedAcgManifest.ManifestId == acgShare.Manifest.ManifestId, "ACG2 manifest readback drifted.");
var importedGraphPath = Path.Combine(args[2], "consumer-smoke-assembled.acg2");
var importedGraph = p2p.AssembleArtifact(
    new AssembleArtifactRequest(
        acgShare.PieceDirectory,
        importedGraphPath,
        TinyRustLmP2PAdmission.ForAcg2Composition()),
    acgManifestBytes);
Require(importedGraph.ArtifactSha256 == graph.Sha256, "Assembled ACG2 identity drifted.");
Require(File.ReadAllBytes(importedGraphPath).SequenceEqual(File.ReadAllBytes(graph.Path)), "Assembled ACG2 bytes drifted.");

var createOnlyRejected = false;
try
{
    _ = p2p.AssembleArtifact(
        new AssembleArtifactRequest(
            acgShare.PieceDirectory,
            importedGraphPath,
            TinyRustLmP2PAdmission.ForAcg2Composition()),
        acgManifestBytes);
}
catch (TinyRustLmException)
{
    createOnlyRejected = true;
}
Require(createOnlyRejected, "Existing ACG2 output was not rejected.");
Require(File.ReadAllBytes(importedGraphPath).SequenceEqual(File.ReadAllBytes(graph.Path)), "Create-only rejection changed ACG2 bytes.");

var slmShare = p2p.PrepareShareKit(new PrepareShareKitRequest(
    model.Path,
    Path.Combine(args[2], "share-slm2"),
    ContentId("slm2-artifact-manifest"),
    ContentId("slm2-qualification"),
    ContentId("slm2-provenance"),
    "Apache-2.0",
    "2026-08-24T00:00:01Z",
    TinyRustLmP2PAdmission.ForSlm2Model(graph.Path)));
Require(slmShare.Manifest.ArtifactSha256 == model.Sha256, "SLM2 share identity drifted.");
Require(slmShare.Manifest.CompositionArtifactIds.SequenceEqual(new[] { $"sha256:{graph.Sha256}" }), "SLM2 composition binding drifted.");
var slmManifestBytes = File.ReadAllBytes(slmShare.ManifestPath);
var inspectedSlmManifest = p2p.InspectManifest(slmManifestBytes);
Require(inspectedSlmManifest.ManifestId == slmShare.Manifest.ManifestId, "SLM2 manifest readback drifted.");
var importedModelPath = Path.Combine(args[2], "consumer-smoke-assembled.slm2");
var importedModel = p2p.AssembleArtifact(
    new AssembleArtifactRequest(
        slmShare.PieceDirectory,
        importedModelPath,
        TinyRustLmP2PAdmission.ForSlm2Model(graph.Path)),
    slmManifestBytes);
Require(importedModel.ArtifactSha256 == model.Sha256, "Assembled SLM2 identity drifted.");
Require(File.ReadAllBytes(importedModelPath).SequenceEqual(File.ReadAllBytes(model.Path)), "Assembled SLM2 bytes drifted.");

var tamperedManifest = (byte[])slmManifestBytes.Clone();
tamperedManifest[tamperedManifest.Length / 2] ^= 1;
var tamperRejected = false;
try
{
    _ = p2p.InspectManifest(tamperedManifest);
}
catch (TinyRustLmException)
{
    tamperRejected = true;
}
Require(tamperRejected, "Tampered canonical manifest was not rejected.");

if (args[3] == "required")
{
    var type = Type.GetType(
        "TinyRustLM.TinyRustLmConversionTool, TinyRustLM.Conversion",
        throwOnError: true)!;
    var method = type.GetMethod(
        "FromPackageLayout",
        BindingFlags.Public | BindingFlags.Static)
        ?? throw new InvalidOperationException("Conversion package factory is missing.");
    _ = method.Invoke(null, new object?[] { null });
    Console.WriteLine("consumer-smoke-conversion-package");
}

Console.WriteLine("consumer-smoke-native-contract-15");
Console.WriteLine("consumer-smoke-slm2-inspected");
Console.WriteLine("consumer-smoke-acg2-assembled");
Console.WriteLine("consumer-smoke-slm2-assembled");
Console.WriteLine("consumer-smoke-create-only-rejected");
Console.WriteLine("consumer-smoke-manifest-tamper-rejected");

static VectorArtifact MaterializeVector(string vectorPath, string outputPath)
{
    using var document = JsonDocument.Parse(File.ReadAllBytes(vectorPath));
    var canonical = document.RootElement.GetProperty("canonical");
    var bytes = Convert.FromHexString(canonical.GetProperty("artifactHex").GetString()
        ?? throw new InvalidOperationException("Vector artifactHex is missing."));
    var expectedBytes = canonical.GetProperty("artifactByteLength").GetUInt64();
    var expectedSha256 = canonical.GetProperty("artifactSha256").GetString()
        ?? throw new InvalidOperationException("Vector artifactSha256 is missing.");
    Require((ulong)bytes.Length == expectedBytes, "Vector byte length is dishonest.");
    Require(Sha256(bytes) == expectedSha256, "Vector SHA-256 is dishonest.");
    File.WriteAllBytes(outputPath, bytes);
    return new VectorArtifact(outputPath, expectedBytes, expectedSha256);
}

static string ContentId(string label) => $"sha256:{Sha256(Encoding.UTF8.GetBytes(label))}";

static string Sha256(byte[] bytes) =>
    Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

static void Require(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}

internal sealed record VectorArtifact(string Path, ulong Bytes, string Sha256);
