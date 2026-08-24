using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

if (args.Length != 4)
{
    Console.Error.WriteLine("TinyRustLM conversion failed: fixture-arguments");
    return 1;
}

var command = args[0];
var sourceLock = args[1];
var output = args[3];
var scenario = File.ReadAllText(sourceLock).Trim();
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
        await Task.Delay(TimeSpan.FromMinutes(1));
        return 1;
}

var isModel = command == "qwen3-safetensors";
if (!isModel && command != "qwen-tokenizer2")
{
    Console.Error.WriteLine("TinyRustLM conversion failed: converter-cli-command-invalid");
    return 1;
}

var artifact = Encoding.ASCII.GetBytes(isModel ? "fixture-slm2" : "fixture-tokenizer2");
File.WriteAllBytes(output, artifact);
File.WriteAllText($"{output}.conversion-receipt.json", "{}\n", new UTF8Encoding(false));
var digest = Convert.ToHexString(SHA256.HashData(artifact)).ToLowerInvariant();
if (scenario == "hash-mismatch")
{
    digest = new string('0', 64);
}

var name = Path.GetFileName(output);
var summary = isModel
    ? new
    {
        schema = "tinyrustlm.qwen3_conversion_cli_summary.v1",
        status = "pass",
        modelFile = name,
        modelBytes = artifact.LongLength,
        modelSha256 = digest,
        receiptFile = $"{name}.conversion-receipt.json",
        requiredNextGate = "source-native-browser-numerical-parity-and-untouched-quality-qualification"
    }
    : (object)new
    {
        schema = "tinyrustlm.qwen_tokenizer2_conversion_cli_summary.v1",
        status = "pass",
        tokenizerFile = name,
        tokenizerBytes = artifact.LongLength,
        tokenizerSha256 = digest,
        receiptFile = $"{name}.conversion-receipt.json",
        requiredNextGate = "broad-source-oracle-parity-and-full-artifact-native-browser-wasm-replay"
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
    Console.WriteLine(JsonSerializer.Serialize(summary));
}

return 0;
