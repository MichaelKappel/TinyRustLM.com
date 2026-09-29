using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TinyRustLM;
using TinyRustLM.ConversationProbe;

// One bounded line protocol; the owner encodes dependent turns from actual prior raw output.
if (args.Length != 0) return 2;
Console.OutputEncoding = new UTF8Encoding(false, true);
var leases = new List<FileStream>();
try
{
    using var input = Console.OpenStandardInput();
    var request = JsonSerializer.Deserialize<ProbeRequest>(ReadLine(input, 65536), ConversationProbe.Json)
        ?? throw new InvalidDataException();
    if (request.Schema != "tinyrustlm.native-conversation-request/1" ||
        !Path.IsPathFullyQualified(request.CompositionRoot) ||
        !Path.IsPathFullyQualified(request.NativePath) || request.Policy is null)
        throw new InvalidDataException();
    string[] names = ["model.slm2", "tokenizer.tokenizer2", "template.template2", "sampling.sampling2",
        "prompt.prompt2", "composition.acg2"];
    if (request.Members is null || request.Members.Length != names.Length) throw new InvalidDataException();
    for (var index = 0; index < names.Length; index++)
    {
        var member = request.Members[index];
        if (member.Name != names[index] || member.Bytes <= 0) throw new InvalidDataException();
        HoldExactFile(Path.Combine(request.CompositionRoot, member.Name), member.Bytes, member.Sha256);
    }
    HoldExactFile(request.NativePath, new FileInfo(request.NativePath).Length, request.NativeSha256);
    Environment.SetEnvironmentVariable("TINYRUSTLM_NATIVE_PATH", request.NativePath);
    ConversationProbe.ValidateCases(request.Cases, request.Policy.MaximumRequestBytes);
    var operation = TinyRustLmOperationId.Parse(request.OperationId);
    var factory = new TinyRustLmRuntimeFactory();
    var paths = names.Select(name => Path.Combine(request.CompositionRoot, name)).ToArray();
    var activation = new TinyRustLmActivationRequest(paths[5],
        new TinyRustLmMemberPaths(paths[0], paths[1], paths[2], paths[3], paths[4]));
    Console.WriteLine("{\"kind\":\"ready\"}");
    Console.Out.Flush();
    var result = ConversationProbe.Capture(request.Cases,
        index => ConversationProbe.DecodeWire(JsonSerializer.Deserialize<ProbeWire>(
            ReadLine(input, 2 * 1024 * 1024), ConversationProbe.Json) ?? throw new InvalidDataException(),
            request.Cases[index].Id, request.Policy.MaximumRequestBytes),
        operation, request.Policy.MaximumSequenceTokens,
        () => factory.CreateRuntime(request.Policy, operation), runtime => runtime.ActivateComposition(activation, operation),
        captured: value => { Console.WriteLine(JsonSerializer.Serialize(new { kind = "case", value }, ConversationProbe.Json)); Console.Out.Flush(); },
        generationStarted: id => { Console.WriteLine(JsonSerializer.Serialize(new { kind = "case-started", id }, ConversationProbe.Json)); Console.Out.Flush(); });
    Console.WriteLine(JsonSerializer.Serialize(new { kind = "terminal", value = result }, ConversationProbe.Json));
    return result.Status == "captured" ? 0 : 1;
}
catch (Exception error) when (error is not OutOfMemoryException)
{
    Console.Error.WriteLine("conversation-probe-input-or-activation");
    return 1;
}
finally { foreach (var lease in leases) lease.Dispose(); }

// FileShare.Read holds the hashed input against Windows mutation while the SDK reads the same paths.
void HoldExactFile(string file, long length, string digest)
{
    if ((File.GetAttributes(file) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
        throw new InvalidDataException();
    var lease = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read);
    leases.Add(lease);
    if (lease.Length != length || Convert.ToHexString(SHA256.HashData(lease)).ToLowerInvariant() != digest)
        throw new InvalidDataException();
}

// Bound memory before reading a line; CR is rejected rather than silently normalizing wire metadata.
byte[] ReadLine(Stream input, int maximum)
{
    using var line = new MemoryStream();
    for (var count = 0; count <= maximum; count++)
    {
        var value = input.ReadByte();
        if (value == '\n') return line.ToArray();
        if (value < 0 || value == '\r' || count == maximum) throw new InvalidDataException();
        line.WriteByte((byte)value);
    }
    throw new InvalidDataException();
}
