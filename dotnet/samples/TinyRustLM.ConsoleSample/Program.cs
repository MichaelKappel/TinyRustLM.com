using TinyRustLM;

if (args.Length != 8)
{
    Console.Error.WriteLine(
        "Usage: TinyRustLM.ConsoleSample <model.slm2> <tokenizer.tok2> <template.tpl2> " +
        "<sampling.sampling2> <prompt.prompt2> <composition.acg2> <request.prompt2-wire> " +
        "<operation-id-hex>");
    return 2;
}

var operation = TinyRustLmOperationId.Parse(args[7]);
var factory = new TinyRustLmRuntimeFactory();
var contract = factory.GetNativeContract();
var modelLength = checked((ulong)new FileInfo(args[0]).Length);
var inspection = new TinyRustLmSlm2Inspector().Inspect(
    args[0],
    new Slm2InspectionPolicy(modelLength, 262_144));
Console.WriteLine($"SLM2 {inspection.ArtifactSha256} ({inspection.ArtifactBytes} bytes)");

using var runtime = factory.CreateRuntime(
    new TinyRustLmRuntimePolicy(
        contract.Limits.MaximumModelBytes,
        contract.Limits.MaximumSequenceTokens,
        contract.Limits.MaximumKvBytes,
        contract.Limits.MaximumScratchBytes,
        contract.Limits.MaximumResolvedMemberBytes,
        contract.Limits.MaximumResidentDependencyBytes,
        contract.Limits.MaximumPrompt2RequestBytes),
    operation);
runtime.ActivateComposition(
    new TinyRustLmActivationRequest(
        args[5],
        new TinyRustLmMemberPaths(args[0], args[1], args[2], args[3], args[4])),
    operation);

var requestWire = File.ReadAllBytes(args[6]);
runtime.BeginRequest(requestWire, operation);
for (uint stepCount = 0; stepCount < contract.Limits.MaximumSequenceTokens; stepCount++)
{
    var step = runtime.Step();
    if (step.Status.Kind != "active")
    {
        var output = runtime.Finish();
        Console.Write(output.Text);
        return 0;
    }
}

Console.Error.WriteLine("The runtime exceeded its advertised sequence bound without a terminal state.");
return 1;
