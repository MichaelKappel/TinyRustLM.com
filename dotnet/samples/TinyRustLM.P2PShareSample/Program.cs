using TinyRustLM;

if (args.Length == 0)
{
    Usage();
    return 2;
}

var client = new TinyRustLmP2PClient();
switch (args[0])
{
    case "prepare-acg2" when args.Length == 8:
        PrintShare(client.PrepareShareKit(Prepare(args, TinyRustLmP2PAdmission.ForAcg2Composition())));
        return 0;

    case "prepare-slm2" when args.Length == 9:
        PrintShare(client.PrepareShareKit(Prepare(args, TinyRustLmP2PAdmission.ForSlm2Model(args[8]))));
        return 0;

    case "inspect" when args.Length == 2:
        var manifest = client.InspectManifest(File.ReadAllBytes(args[1]));
        Console.WriteLine($"{manifest.ManifestId} {manifest.ArtifactSha256} {manifest.ArtifactBytes}");
        return 0;

    case "assemble-acg2" when args.Length == 4:
        PrintImport(client.AssembleArtifact(
            new AssembleArtifactRequest(
                args[2],
                args[3],
                TinyRustLmP2PAdmission.ForAcg2Composition()),
            File.ReadAllBytes(args[1])));
        return 0;

    case "assemble-slm2" when args.Length == 5:
        PrintImport(client.AssembleArtifact(
            new AssembleArtifactRequest(
                args[2],
                args[3],
                TinyRustLmP2PAdmission.ForSlm2Model(args[4])),
            File.ReadAllBytes(args[1])));
        return 0;

    default:
        Usage();
        return 2;
}

static PrepareShareKitRequest Prepare(string[] values, TinyRustLmP2PAdmission admission) => new(
    ArtifactPath: values[1],
    OutputDirectory: values[2],
    ArtifactManifestId: values[3],
    QualificationReceiptId: values[4],
    ProvenanceReceiptId: values[5],
    LicenseExpression: values[6],
    CreatedAtUtc: values[7],
    Admission: admission);

static void PrintShare(P2PShareKitReport report) =>
    Console.WriteLine($"{report.Manifest.ManifestId} {report.ManifestPath} {report.PieceDirectory}");

static void PrintImport(P2PImportedArtifact report) =>
    Console.WriteLine($"{report.ManifestId} {report.ArtifactSha256} {report.OutputPath}");

static void Usage()
{
    Console.Error.WriteLine("Commands:");
    Console.Error.WriteLine(
        "  prepare-acg2 <artifact> <new-output-dir> <artifact-manifest-id> <qualification-id> " +
        "<provenance-id> <license> <created-at-utc>");
    Console.Error.WriteLine(
        "  prepare-slm2 <artifact> <new-output-dir> <artifact-manifest-id> <qualification-id> " +
        "<provenance-id> <license> <created-at-utc> <composition.acg2>");
    Console.Error.WriteLine("  inspect <manifest.json>");
    Console.Error.WriteLine("  assemble-acg2 <manifest.json> <piece-dir> <new-output-path>");
    Console.Error.WriteLine(
        "  assemble-slm2 <manifest.json> <piece-dir> <new-output-path> <composition.acg2>");
}
