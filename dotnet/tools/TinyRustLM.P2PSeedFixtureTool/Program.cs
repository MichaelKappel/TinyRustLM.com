using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;

const string scenarioFileName = ".tinyrustlm-p2p-seed-fixture-scenario";
const string processFileName = ".tinyrustlm-p2p-seed-fixture-process";
const string descendantFileName = ".tinyrustlm-p2p-seed-fixture-descendant";
string[] expectedFlags =
[
    "--descriptor",
    "--bind",
    "--allow-origin",
    "--model",
    "--tokenizer",
    "--template",
    "--sampling",
    "--prompt",
    "--composition"
];
string[] expectedMemberNames =
[
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
];

if (args is ["--fixture-descendant", var descendantPath])
{
    File.WriteAllText(descendantPath, Environment.ProcessId.ToString());
    await Task.Delay(Timeout.InfiniteTimeSpan);
    return 0;
}

if (args.Length != expectedFlags.Length * 2)
{
    return 64;
}
for (var index = 0; index < expectedFlags.Length; index++)
{
    if (args[index * 2] != expectedFlags[index])
    {
        return 64;
    }
}
for (var index = 0; index < expectedMemberNames.Length; index++)
{
    if (Path.GetFileName(args[(index + 3) * 2 + 1]) != expectedMemberNames[index])
    {
        return 64;
    }
}

var descriptorPath = Path.GetFullPath(args[1]);
var descriptorRoot = Path.GetDirectoryName(descriptorPath)
    ?? throw new InvalidOperationException("Fixture descriptor parent is missing.");
File.WriteAllText(Path.Combine(descriptorRoot, processFileName), Environment.ProcessId.ToString());
var scenarioPath = Path.Combine(descriptorRoot, scenarioFileName);
var scenario = File.Exists(scenarioPath)
    ? File.ReadAllText(scenarioPath).Trim()
    : "success";

if (scenario == "early-exit")
{
    return 23;
}
if (scenario == "timeout")
{
    await Task.Delay(Timeout.InfiniteTimeSpan);
    return 0;
}
if (scenario == "stderr")
{
    await Console.OpenStandardError().WriteAsync("fixture-error"u8.ToArray());
    await Task.Delay(Timeout.InfiniteTimeSpan);
    return 0;
}
if (scenario == "oversized-readiness")
{
    await Console.OpenStandardOutput().WriteAsync(new byte[3 * 1024]);
    await Task.Delay(Timeout.InfiniteTimeSpan);
    return 0;
}
if (scenario == "malformed-readiness")
{
    await WriteStdoutAsync("{]\n");
    await Task.Delay(Timeout.InfiniteTimeSpan);
    return 0;
}

var descriptorBytes = File.ReadAllBytes(descriptorPath);
if (descriptorBytes.Length is < 2 or > 8 * 1024 || descriptorBytes[^1] != (byte)'\n')
{
    return 65;
}
using var descriptor = JsonDocument.Parse(descriptorBytes);
var compositionId = descriptor.RootElement.GetProperty("compositionId").GetString()
    ?? throw new InvalidOperationException("Fixture composition identity is missing.");
if (!IPEndPoint.TryParse(args[3], out var bindEndPoint))
{
    return 64;
}
var actualEndPoint = new IPEndPoint(
    bindEndPoint.Address,
    bindEndPoint.Port == 0 ? 48_231 : bindEndPoint.Port);
var protocol = scenario == "wrong-protocol"
    ? "tinyrustlm.direct-composition-http.invalid"
    : "tinyrustlm.direct-composition-http.v1";
if (scenario == "wrong-composition")
{
    compositionId = $"sha256:{new string('0', 64)}";
}
var boundOrigin = scenario == "wrong-bound-origin"
    ? "http://127.0.0.1:1"
    : $"http://{actualEndPoint}";
var allowedOrigin = scenario == "wrong-allowed-origin"
    ? "https://example.invalid"
    : args[5];
var readiness = JsonSerializer.Serialize(new
{
    protocol,
    compositionId,
    boundOrigin,
    allowedBrowserOrigin = allowedOrigin
});

if (scenario == "extra-output")
{
    await WriteStdoutAsync($"{readiness}\nextra");
    await Task.Delay(Timeout.InfiniteTimeSpan);
    return 0;
}
await WriteStdoutAsync($"{readiness}\n");
if (scenario == "late-extra-output")
{
    await Task.Delay(TimeSpan.FromMilliseconds(150));
    await WriteStdoutAsync("extra");
}
if (scenario == "cancellation-tree")
{
    var descendantEvidencePath = Path.Combine(descriptorRoot, descendantFileName);
    var startInfo = new ProcessStartInfo
    {
        FileName = Environment.ProcessPath
            ?? throw new InvalidOperationException("Fixture process path is unavailable."),
        UseShellExecute = false,
        CreateNoWindow = true
    };
    startInfo.ArgumentList.Add("--fixture-descendant");
    startInfo.ArgumentList.Add(descendantEvidencePath);
    _ = Process.Start(startInfo)
        ?? throw new InvalidOperationException("Fixture descendant did not start.");
    var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
    while (!File.Exists(descendantEvidencePath) && DateTime.UtcNow < deadline)
    {
        await Task.Delay(TimeSpan.FromMilliseconds(10));
    }
}
await Task.Delay(Timeout.InfiniteTimeSpan);
return 0;

static async Task WriteStdoutAsync(string value)
{
    var bytes = Encoding.UTF8.GetBytes(value);
    var stdout = Console.OpenStandardOutput();
    await stdout.WriteAsync(bytes);
    await stdout.FlushAsync();
}
