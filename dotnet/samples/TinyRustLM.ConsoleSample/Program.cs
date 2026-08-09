using TinyRustLM;

var memory = new TinyRustLmMemoryClient();
if (args.Length == 1 && string.Equals(args[0], "--memory-setups", StringComparison.OrdinalIgnoreCase))
{
    PrintMemorySetups(memory);
    return 0;
}

if (args.Length < 3)
{
    Console.Error.WriteLine(
        "Usage: TinyRustLM.ConsoleSample <model.slm> <composition.acg1> <composition-sha256> [prompt]");
    Console.Error.WriteLine("       TinyRustLM.ConsoleSample --memory-setups");
    return 2;
}

var modelPath = args[0];
var compositionPath = args[1];
var compositionSha256 = args[2];
var prompt = args.Length > 3 ? args[3] : "hello";

PrintMemoryPlanPreview(memory);

var inspector = new TinySlmInspector();
var inspection = inspector.Inspect(modelPath);
Console.WriteLine($"model: {inspection.Sha256} {inspection.ByteCount} bytes {inspection.Quantization}");

var factory = new TinyRustLmRuntimeFactory();
using var runtime = factory.CreateRuntime();
runtime.LoadModel(modelPath, inspection.Sha256);
runtime.ActivateComposition(compositionPath, compositionSha256);
var result = runtime.Generate(prompt, new TinyRustLmGenerationOptions(MaxNewTokens: 16));
Console.WriteLine(result.Text);
return 0;

static void PrintMemorySetups(TinyRustLmMemoryClient memory)
{
    var catalog = memory.GetSupportedSetups();
    Console.WriteLine($"UAIX memory setup catalog: {catalog.Kind} ({catalog.SetupCount} setups)");
    foreach (var setup in catalog.Setups)
    {
        Console.WriteLine($"- {setup.Setup}: {setup.Label}");
        Console.WriteLine($"  {setup.Summary}");
    }
}

static void PrintMemoryPlanPreview(TinyRustLmMemoryClient memory)
{
    var catalog = memory.GetSupportedSetups();
    var advancedPersona = catalog.Setups.First(setup =>
        string.Equals(setup.Setup, "advanced_persona_profile", StringComparison.Ordinal));
    var plan = memory.GetRequiredFiles(new UaixMemoryPackageRequest(
        Setup: advancedPersona.Setup,
        CodeLikeArtifacts: true,
        CommunicationStyle: true,
        AdvancedPersona: new UaixAdvancedPersonaOptions(SenseOfStyleDepth: 2)));

    Console.WriteLine($"memory setup: {advancedPersona.Label} ({plan.RequiredFileCount} required files)");
    Console.WriteLine(
        $"  deck: {plan.FileDeck.PersonaDimensionFiles} persona files, {plan.FileDeck.EvidenceFiles} evidence files, {plan.FileDeck.ExportFiles} exports");
    foreach (var requiredFile in plan.RequiredFiles.Take(5))
    {
        Console.WriteLine($"  {requiredFile.Path} [{requiredFile.State}]");
    }

    if (plan.RequiredFileCount > 5)
    {
        Console.WriteLine($"  ... {plan.RequiredFileCount - 5} more files planned by UAIX.Browser.Memory");
    }
}
