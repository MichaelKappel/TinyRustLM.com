using System.Text.Json;
using TinyRustLM;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: TinyRustLM.P2PShareSample <model.slm> <output-dir> [https://peer.example/share]");
    return 2;
}

var client = new TinyRustLmP2PClient();
var report = client.PrepareLocalShareKit(new PrepareShareKitRequest(
    ModelPath: args[0],
    OutputDir: args[1],
    ManifestId: null,
    ModelId: null,
    PeerId: "sample-peer",
    PublicBaseUrl: args.Length > 2 ? args[2] : null,
    PieceSize: 1024 * 1024));

Console.WriteLine(JsonSerializer.Serialize(report, new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    WriteIndented = true
}));

var manifestJson = File.ReadAllText(report.ManifestPath);
if (!string.IsNullOrWhiteSpace(report.AnnouncementPath))
{
    var announcementJson = File.ReadAllText(report.AnnouncementPath);
    var announcement = client.ValidateAnnouncement(announcementJson);
    var catalogJson = client.ApplyReceivedAnnouncementJson(announcementJson);

    Console.WriteLine(JsonSerializer.Serialize(announcement, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = true
    }));
    Console.WriteLine(catalogJson);
}

var importOutputPath = Path.Combine(
    args[1],
    $"sample-imported-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}.slm");
var receipt = client.ImportFromManifest(manifestJson, args[1], importOutputPath);
var receiptInspection = client.InspectLocalImportReceipt(
    File.ReadAllText(receipt.ReceiptPath),
    importOutputPath);

Console.WriteLine(JsonSerializer.Serialize(receipt, new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    WriteIndented = true
}));
Console.WriteLine(JsonSerializer.Serialize(receiptInspection, new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    WriteIndented = true
}));
return 0;
