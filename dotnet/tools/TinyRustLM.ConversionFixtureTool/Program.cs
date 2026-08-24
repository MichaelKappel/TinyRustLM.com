using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

const string profileId = "tinyrustlm.qwen3-complete-composition-conversion/1";
const string profileSha256 = "2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158";
const string nextGate = "source-native-browser-numerical-parity-untouched-quality-and-product-chat";
const string converterVersion = "fixture-1";

if (args.Length != 6)
{
    Console.Error.WriteLine("TinyRustLM conversion failed: fixture-arguments");
    return 1;
}

if (args[0] != "qwen3-composition")
{
    Console.Error.WriteLine("TinyRustLM conversion failed: converter-cli-command-invalid");
    return 1;
}

var modelLock = args[1];
var tokenizerLock = args[3];
var outputRoot = args[5];
var scenario = File.ReadAllText(modelLock).Trim();
switch (scenario)
{
    case "error":
        Console.Error.WriteLine("TinyRustLM conversion failed: qwen3-source-hash-mismatch");
        return 1;
    case "malformed-error":
        Console.Error.WriteLine("private path C:\\secret\\source");
        return 1;
    case "oversized":
        Console.Write(new string('x', 100_000));
        Console.Out.Flush();
        await Task.Delay(TimeSpan.FromMinutes(1));
        return 1;
    case "hang":
        Directory.CreateDirectory(outputRoot);
        File.WriteAllText(Path.Combine(outputRoot, "composition.attempt.json"), "preserved\n");
        await Task.Delay(TimeSpan.FromMinutes(1));
        return 1;
}

Directory.CreateDirectory(outputRoot);
var executableSha256 = Sha256File(Environment.ProcessPath
    ?? throw new InvalidOperationException("The fixture executable path is unavailable."));
var modelLockSha256 = Sha256File(modelLock);
var tokenizerLockSha256 = Sha256File(tokenizerLock);
var operationId = OperationId(
    profileSha256,
    modelLockSha256,
    tokenizerLockSha256,
    converterVersion,
    executableSha256);

var artifactMetadata = new[]
{
    new ArtifactMetadata(0, "slm2", "model.slm2", "org.minimodel.slm2/2.0",
        "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8"),
    new ArtifactMetadata(1, "tokenizer2", "tokenizer.tokenizer2", "org.minimodel.tokenizer2/2.0",
        "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de"),
    new ArtifactMetadata(2, "template2", "template.template2", "org.minimodel.template2/2.0",
        "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa"),
    new ArtifactMetadata(3, "sampling2", "sampling.sampling2", "org.minimodel.sampling2/2.0",
        "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d"),
    new ArtifactMetadata(4, "prompt2", "prompt.prompt2", "org.minimodel.prompt2/2.0",
        "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c"),
    new ArtifactMetadata(5, "acg2", "composition.acg2", "org.minimodel.acg2/2.0",
        "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be")
};
var artifacts = artifactMetadata.Select(metadata =>
{
    var bytes = Encoding.ASCII.GetBytes($"fixture-{metadata.Kind}");
    File.WriteAllBytes(Path.Combine(outputRoot, metadata.File), bytes);
    return new ArtifactIdentity(
        metadata,
        checked((ulong)bytes.LongLength),
        Sha256Bytes(bytes));
}).ToArray();

var modelReceipt = WriteEvidence(
    outputRoot,
    "model.slm2.conversion-receipt.json",
    new { schema = "fixture.model-receipt", status = "pass" });
var tokenizerReceipt = WriteEvidence(
    outputRoot,
    "tokenizer.tokenizer2.conversion-receipt.json",
    new { schema = "fixture.tokenizer-receipt", status = "pass" });
WriteEvidence(
    outputRoot,
    "composition.attempt.json",
    new
    {
        schema = "tinyrustlm.qwen3_composition_attempt.v1",
        status = "started",
        profileId,
        profileSha256,
        operationId,
        modelLockSha256,
        tokenizerLockSha256,
        converterVersion,
        converterExecutableSha256 = executableSha256,
        terminalRule = "existing-output-root-is-never-resumed"
    });

var graphIdentitySha256 = Sha256Text("fixture-graph-identity");
var receiptArtifacts = artifacts.Select(value => new
{
    ordinal = value.Metadata.Ordinal,
    kind = value.Metadata.Kind,
    file = value.Metadata.File,
    formatProfileId = value.Metadata.FormatProfileId,
    formatProfileSha256 = value.Metadata.FormatProfileSha256,
    byteLength = value.ByteLength,
    sha256 = scenario == "receipt-hash-mismatch" && value.Metadata.Ordinal == 0
        ? new string('0', 64)
        : value.Sha256
}).ToArray();
var terminalReceipt = new
{
    schema = "tinyrustlm.qwen3_composition_conversion_receipt.v1",
    status = "pass",
    profileId,
    profileSha256,
    operationId,
    converter = new
    {
        implementationVersion = converterVersion,
        executableSha256
    },
    source = new
    {
        modelLockSha256 = scenario == "source-hash-mismatch" ? new string('0', 64) : modelLockSha256,
        tokenizerLockSha256,
        relationshipStatus = "exact"
    },
    artifacts = receiptArtifacts,
    graph = new
    {
        graphIdentitySha256,
        memberTableSha256 = Sha256Text("fixture-member-table"),
        resolvedMemberBytes = artifacts.Aggregate(0UL, (total, value) => total + value.ByteLength)
    },
    componentReceipts = new
    {
        model = new
        {
            file = modelReceipt.File,
            byteLength = modelReceipt.ByteLength,
            sha256 = modelReceipt.Sha256
        },
        tokenizer = new
        {
            file = tokenizerReceipt.File,
            byteLength = tokenizerReceipt.ByteLength,
            sha256 = tokenizerReceipt.Sha256
        }
    },
    resourcePlan = new
    {
        modelArtifactBytes = artifacts[0].ByteLength,
        residentDependencyArtifactBytes = artifacts
            .Skip(1)
            .Aggregate(0UL, (total, value) => total + value.ByteLength),
        modelTensorCount = 1,
        streamHashBufferBytes = 1_048_576
    },
    durability = new
    {
        operationId,
        directoryIdentitySha256 = Sha256Text("fixture-directory"),
        method = "fixture-fsync",
        operatingSystem = "fixture",
        architecture = "x64",
        status = "flushed"
    },
    structuralCompositionStatus = "verified",
    modelQualityStatus = "not-assessed-by-converter",
    sourceFrameworkParityStatus = "not-assessed-by-converter",
    nativeRuntimeStatus = "not-assessed-by-converter",
    browserWasmStatus = "not-assessed-by-converter",
    browserChatStatus = "not-assessed-by-converter",
    p2pAvailabilityStatus = "not-assessed-by-converter",
    publicationStatus = "not-assessed-by-converter",
    requiredNextGate = nextGate
};
var terminalReceiptPath = Path.Combine(outputRoot, "composition.conversion-receipt.json");
WriteEvidence(outputRoot, "composition.conversion-receipt.json", terminalReceipt);
if (scenario == "duplicate-receipt")
{
    var text = File.ReadAllText(terminalReceiptPath).Replace(
        "\"status\":\"pass\"",
        "\"status\":\"pass\",\"status\":\"pass\"",
        StringComparison.Ordinal);
    File.WriteAllText(terminalReceiptPath, text, new UTF8Encoding(false));
}
if (scenario == "unknown-receipt")
{
    var text = File.ReadAllText(terminalReceiptPath).TrimEnd('\r', '\n');
    File.WriteAllText(
        terminalReceiptPath,
        $"{text[..^1]},\"unknown\":true}}\n",
        new UTF8Encoding(false));
}

if (scenario == "extra-file")
{
    File.WriteAllText(Path.Combine(outputRoot, "unregistered.txt"), "unexpected");
}
if (scenario == "missing-receipt")
{
    File.Delete(Path.Combine(outputRoot, "composition.conversion-receipt.json"));
}

var summaryArtifacts = artifacts.Select(value => new
{
    kind = value.Metadata.Kind,
    file = value.Metadata.File,
    byteLength = value.ByteLength,
    sha256 = scenario == "hash-mismatch" && value.Metadata.Ordinal == 0
        ? new string('0', 64)
        : value.Sha256
}).ToArray();
var summary = new
{
    schema = "tinyrustlm.qwen3_composition_conversion_cli_summary.v1",
    status = "pass",
    operationId,
    outputDirectory = Path.GetFileName(outputRoot),
    receiptFile = "composition.conversion-receipt.json",
    artifacts = summaryArtifacts,
    graphIdentitySha256,
    requiredNextGate = nextGate
};

if (scenario == "unexpected-stderr")
{
    Console.Error.Write("unexpected");
}
if (scenario == "malformed-json")
{
    Console.Write("{");
}
else
{
    var text = JsonSerializer.Serialize(summary);
    if (scenario == "duplicate-summary")
    {
        text = text.Replace(
            "\"status\":\"pass\"",
            "\"status\":\"pass\",\"status\":\"pass\"",
            StringComparison.Ordinal);
    }
    if (scenario == "unknown-summary")
    {
        text = $"{text[..^1]},\"unknown\":true}}";
    }
    Console.WriteLine(text);
}
return 0;

static EvidenceIdentity WriteEvidence(string root, string file, object value)
{
    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value) + "\n");
    File.WriteAllBytes(Path.Combine(root, file), bytes);
    return new EvidenceIdentity(file, checked((ulong)bytes.LongLength), Sha256Bytes(bytes));
}

static string OperationId(
    string profileSha256,
    string modelLockSha256,
    string tokenizerLockSha256,
    string converterVersion,
    string executableSha256)
{
    using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    AppendAscii(hash, "tinyrustlm.qwen3-complete-composition-operation.v1\0");
    AppendAscii(hash, profileSha256);
    hash.AppendData([0]);
    AppendAscii(hash, modelLockSha256);
    hash.AppendData([0]);
    AppendAscii(hash, tokenizerLockSha256);
    hash.AppendData([0]);
    AppendAscii(hash, converterVersion);
    hash.AppendData([0]);
    AppendAscii(hash, executableSha256);
    return $"qwen3-composition-{Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant()}";
}

static void AppendAscii(IncrementalHash hash, string value) =>
    hash.AppendData(Encoding.ASCII.GetBytes(value));

static string Sha256Text(string value) => Sha256Bytes(Encoding.ASCII.GetBytes(value));

static string Sha256Bytes(byte[] bytes) =>
    Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

static string Sha256File(string path)
{
    using var stream = File.OpenRead(path);
    return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
}

internal sealed record ArtifactMetadata(
    uint Ordinal,
    string Kind,
    string File,
    string FormatProfileId,
    string FormatProfileSha256);

internal sealed record ArtifactIdentity(
    ArtifactMetadata Metadata,
    ulong ByteLength,
    string Sha256);

internal sealed record EvidenceIdentity(string File, ulong ByteLength, string Sha256);
