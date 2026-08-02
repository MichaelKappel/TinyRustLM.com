#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-$REPO_ROOT/artifacts/packages}"
MODEL_PATH="${2:-$REPO_ROOT/tinyrustlm/models/tiny-test-model.slm}"
PACKAGE_VERSION="${3:-$("$REPO_ROOT/eng/get-package-version.sh")}"
CORE_PACKAGE_ID="${4:-${TINYRUSTLM_CONSUMER_CORE_PACKAGE_ID:-TinyRustLM.Core}}"
P2P_PACKAGE_ID="${5:-${TINYRUSTLM_CONSUMER_P2P_PACKAGE_ID:-TinyRustLM.P2P}}"
MEMORY_PACKAGE_ID="${6:-${TINYRUSTLM_CONSUMER_MEMORY_PACKAGE_ID:-TinyRustLM.Memory}}"
CONVERSION_PACKAGE_ID="${7:-${TINYRUSTLM_CONSUMER_CONVERSION_PACKAGE_ID:-}}"

if ! command -v dotnet >/dev/null 2>&1; then
  echo "dotnet CLI is required to run TinyRustLM clean consumer package verification." >&2
  exit 127
fi
if [[ -d "$PACKAGE_SOURCE" ]]; then
  PACKAGE_SOURCE="$(cd "$PACKAGE_SOURCE" && pwd)"
fi
if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Model fixture does not exist: $MODEL_PATH" >&2
  exit 1
fi
MODEL_DIR="$(cd "$(dirname "$MODEL_PATH")" && pwd)"
MODEL_PATH="$MODEL_DIR/$(basename "$MODEL_PATH")"

TEMP_ROOT="$(mktemp -d)"
PROJECT_DIR="$TEMP_ROOT/ConsumerSmoke"
export NUGET_PACKAGES="$TEMP_ROOT/packages"
export NUGET_HTTP_CACHE_PATH="$TEMP_ROOT/http-cache"
cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

dotnet new console --framework net8.0 --output "$PROJECT_DIR" >/dev/null
(
  cd "$PROJECT_DIR"
  dotnet add package "$CORE_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE" >/dev/null
  dotnet add package "$P2P_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE" >/dev/null
  dotnet add package "$MEMORY_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE" >/dev/null
  if [[ -n "$CONVERSION_PACKAGE_ID" ]]; then
    dotnet add package "$CONVERSION_PACKAGE_ID" --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE" >/dev/null
  fi
)

cat > "$PROJECT_DIR/Program.cs" <<'CS'
using System.Reflection;
using System.Text.Json;
using TinyRustLM;

var modelPath = args.Length > 0 ? args[0] : throw new ArgumentException("model path argument is required");
var memoryPackageId = args.Length > 1 ? args[1] : string.Empty;
var conversionPackageId = args.Length > 2 ? args[2] : string.Empty;
var inspector = new TinySlmInspector();
var inspection = inspector.Inspect(modelPath);
if (!inspection.Sha256.StartsWith("sha256:", StringComparison.Ordinal) || inspection.ByteCount <= 0)
{
    throw new InvalidOperationException("Package consumer could not inspect the .slm model.");
}

var factory = new TinyRustLmRuntimeFactory();
var version = factory.GetVersion();
if (version.Product != "TinyRustLM public NuGet SDK" || version.NativeAbiVersion < 1)
{
    throw new InvalidOperationException("Package consumer version report did not expose the public native SDK boundary.");
}
var capabilities = factory.GetCapabilities();
if (!capabilities.SlmValidation || !capabilities.Generation || !capabilities.P2PMetadataWorkflows)
{
    throw new InvalidOperationException("Package consumer capability report did not expose the public SDK surface.");
}
if (!capabilities.ExcludedPrivateCapabilities.Any(item => item.Contains("model conversion", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Package consumer capability report did not declare the protected private boundary.");
}

var memory = new TinyRustLmMemoryClient();
var memoryCatalog = memory.GetSupportedSetups();
var expectedMemorySetups = new[]
{
    "base",
    "agent_file_handoff",
    "llm_wiki",
    "file_handoff_llm_wiki",
    "multi_agent_communication",
    "talisman_system",
    "advanced_persona_profile"
};
if (memoryCatalog.Kind != "uaix.memory.setup_catalog.v0"
    || memoryCatalog.SetupCount < expectedMemorySetups.Length
    || memoryCatalog.Boundary.HostedImportValidation
    || memoryCatalog.Boundary.AutomaticRepositoryWrites
    || !memoryCatalog.Boundary.UsesTinyrustlmRuntimeHarness)
{
    throw new InvalidOperationException("Package consumer UAIX memory setup catalog did not expose the protected local harness boundary.");
}
foreach (var setup in expectedMemorySetups)
{
    if (!memoryCatalog.Setups.Any(candidate => candidate.Setup == setup))
    {
        throw new InvalidOperationException($"Package consumer UAIX memory setup catalog omitted {setup}.");
    }
}
if (!memoryCatalog.SourceUrls.Any(url => url.Contains("ai-memory-package-wizard", StringComparison.OrdinalIgnoreCase))
    || !memoryCatalog.SourceUrls.Any(url => url.Contains("personality-packs", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Package consumer UAIX memory catalog did not expose the Wizard and persona-pack authorities.");
}
var baseSetup = memoryCatalog.Setups.SingleOrDefault(setup => setup.Setup == "base");
var expectedWizardFeatures = new[]
{
    "ai_digest_script_data_ai_digest",
    "point_agent_urls",
    "local_browser_draft_restore",
    "safe_structured_output_mode",
    "canonical_starter_zip_downloads",
    "package_model_json",
    "knowledge_graph_json"
};
if (baseSetup is null || expectedWizardFeatures.Any(feature => !baseSetup.PackageFeatures.Contains(feature)))
{
    throw new InvalidOperationException("Package consumer UAIX memory catalog did not expose the Wizard digest, setup URL, starter ZIP, and export-deck feature flags.");
}
var advancedPersona = memoryCatalog.Setups.SingleOrDefault(setup => setup.Setup == "advanced_persona_profile");
if (advancedPersona is null
    || !advancedPersona.AuthorityUrls.Any(url => url.Contains("personality-packs", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Package consumer UAIX memory catalog did not expose advanced persona authority metadata.");
}
var expectedPersonaFeatures = new[]
{
    "uaix_zip_txt_template_decks",
    "source_persona_preservation_rule",
    "depth_level_0_to_10_dimension_evidence",
    "disclosure_boundary_evidence",
    "source_confidence_evidence",
    "non_inference_rules",
    "triggered_style_axes"
};
if (expectedPersonaFeatures.Any(feature => !advancedPersona.PackageFeatures.Contains(feature)))
{
    throw new InvalidOperationException("Package consumer UAIX memory catalog did not expose the advanced persona deck and preservation feature flags.");
}
var memoryRequest = new UaixMemoryPackageRequest(
    Setup: "advanced_persona_profile",
    CodeLikeArtifacts: true,
    Deployment: true,
    CommunicationStyle: true,
    SourceNotes: true,
    AdvancedPersona: new UaixAdvancedPersonaOptions(SenseOfStyleDepth: 3));
var memoryPlan = memory.GetRequiredFiles(memoryRequest);
var memoryPlanJson = memory.GetRequiredFilesJson(memoryRequest);
if (memoryPlan.Kind != "uaix.memory.package_plan.v0"
    || memoryPlan.Setup != "advanced_persona_profile"
    || memoryPlan.RequiredFileCount != 62
    || memoryPlan.FileDeck.TotalRequiredFiles != memoryPlan.RequiredFileCount
    || !memoryPlan.FileDeck.ClosedRequiredFileSet
    || !memoryPlan.FileDeck.IncludesManifestJson
    || !memoryPlan.FileDeck.IncludesManifestOverlay
    || !memoryPlan.FileDeck.IncludesPackageModel
    || !memoryPlan.FileDeck.IncludesKnowledgeGraph
    || !memoryPlan.FileDeck.IncludesLlmsExports
    || !memoryPlan.FileDeck.IncludesAgentPickup
    || !memoryPlan.FileDeck.IncludesSessionLog
    || !memoryPlan.FileDeck.IncludesPersonaSourceEvidence
    || memoryPlan.FileDeck.UniversalRequiredFiles != 7
    || memoryPlan.FileDeck.ProfileRequiredFiles != 11
    || memoryPlan.FileDeck.ConfigurationSpecificRequiredFiles != 10
    || memoryPlan.FileDeck.ContentTriggeredRequiredFiles != 10
    || memoryPlan.FileDeck.AdvancedPersonaRequiredFiles != 24
    || memoryPlan.FileDeck.PersonaDimensionFiles != 22
    || memoryPlan.FileDeck.TriggeredPersonaStyleAxisFiles != 4
    || memoryPlan.FileDeck.EvidenceFiles != 5
    || memoryPlan.FileDeck.ExportFiles != 6
    || !memoryPlan.Boundary.UsesTinyrustlmRuntimeHarness
    || memoryPlan.Boundary.AutomaticRepositoryWrites
    || memoryPlan.Boundary.PersonaSourceMutationAllowed
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/agent-pickup.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/exports/package-model.json")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/personality/religion-worldview.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/personality/sense-of-winter.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/evidence/provenance.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/coding-standards.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == "reports/deployment-memory-and-test-report.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/communication-style.uai")
    || !memoryPlan.RequiredFiles.Any(file => file.Path == ".uai/source-notes.uai")
    || !memoryPlanJson.Contains("\"kind\": \"uaix.memory.package_plan.v0\"", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Package consumer UAIX memory advanced persona plan did not validate.");
}
var memoryManifestPaths = new[]
{
    ".uai/agent-pickup.uai",
    ".uai/persona.uai",
    ".uai/personality/religion-worldview.uai"
};
var memoryManifestJson = JsonSerializer.Serialize(new
{
    kind = "uaix.memory.manifest.v0",
    setup_mode = "advanced_persona_profile",
    files = memoryManifestPaths.Select(path => new { path }).ToArray()
}, new JsonSerializerOptions { WriteIndented = true });
var memoryManifest = memory.InspectManifest(memoryManifestJson);
if (memoryManifest.Kind != "uaix.memory.manifest_inspection.v0"
    || !memoryManifest.Valid
    || !memoryManifest.AdvancedPersonaProfile
    || memoryManifest.DeclaredFileCount != memoryManifestPaths.Length
    || !memoryManifest.DeclaredFilePaths.Contains(".uai/personality/religion-worldview.uai"))
{
    throw new InvalidOperationException("Package consumer UAIX memory manifest inspection did not validate.");
}

var memoryPackageRoot = Path.Combine(Path.GetTempPath(), $"tinyrustlm-consumer-memory-{Guid.NewGuid():N}");
try
{
    foreach (var file in memoryPlan.RequiredFiles)
    {
        var filePath = Path.Combine(
            memoryPackageRoot,
            file.Path.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        var content = file.Path.StartsWith(".uai/personality/", StringComparison.Ordinal)
            ? $"{file.Path}\ndepth_level_0_to_10: 6\ndisclosure_boundary: reviewed\nsource_confidence: high\nnon-inference rules: do not infer beyond source evidence\n"
            : $"required {file.Path}";
        File.WriteAllText(filePath, content);
    }
    var fullMemoryManifest = new
    {
        kind = "uaix.memory.manifest.v0",
        setup_mode = "advanced_persona_profile",
        files = memoryPlan.RequiredFiles.Select(file => new { path = file.Path }).ToArray()
    };
    File.WriteAllText(
        Path.Combine(memoryPackageRoot, ".uai", "manifest.uaix.json"),
        JsonSerializer.Serialize(fullMemoryManifest, new JsonSerializerOptions { WriteIndented = true }));
    var memoryPackageInspection = memory.InspectPackage(memoryPackageRoot, memoryRequest);
    if (!memoryPackageInspection.Valid
        || memoryPackageInspection.MissingRequiredFiles.Count != 0
        || memoryPackageInspection.ManifestMissingRequiredFiles.Count != 0
        || !memoryPackageInspection.ManifestDeclaresRequiredFiles
        || !memoryPackageInspection.RequiredFiles.Any(file => file.Path == "reports/deployment-memory-and-test-report.uai" && file.Exists)
        || memoryPackageInspection.FileDeck.TotalRequiredFiles != 62
        || !memoryPackageInspection.FileDeck.IncludesPersonaSourceEvidence
        || !memoryPackageInspection.PersonaDimensionsValid
        || !memory.ValidatePackage(memoryPackageRoot, memoryRequest))
    {
        throw new InvalidOperationException("Package consumer UAIX memory package inspection did not validate the full deployment report file deck.");
    }
}
finally
{
    if (Directory.Exists(memoryPackageRoot))
    {
        Directory.Delete(memoryPackageRoot, recursive: true);
    }
}

using (var runtime = factory.CreateRuntime())
{
    runtime.LoadModel(modelPath, inspection.Sha256);
    var generated = runtime.Generate("hello", new TinyRustLmGenerationOptions(MaxNewTokens: 2));
    if (generated.Diagnostics.Length == 0 || !runtime.GetDiagnostics().Contains("model_loaded", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Package consumer runtime diagnostics were not available.");
    }
}

var outputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-consumer-share-{Guid.NewGuid():N}");
var p2p = new TinyRustLmP2PClient();
var unsafeOutputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-consumer-share-unsafe-{Guid.NewGuid():N}");
try
{
    p2p.PrepareLocalShareKit(new PrepareShareKitRequest(
        ModelPath: modelPath,
        OutputDir: unsafeOutputDir,
        ManifestId: "consumer-smoke-unsafe-url",
        ModelId: "consumer-smoke-model",
        PeerId: "consumer-smoke-peer",
        PublicBaseUrl: "https://example.com/peer?download=1",
        PieceSize: 4096));
    throw new InvalidOperationException("Package consumer accepted an unsafe P2P announcement base URL.");
}
catch (TinyRustLmException ex) when (ex.Message.Contains("public_base_url", StringComparison.Ordinal))
{
}
if (File.Exists(Path.Combine(unsafeOutputDir, "tinyrustlm.p2p-manifest.v0.json"))
    || File.Exists(Path.Combine(unsafeOutputDir, "tinyrustlm.p2p-announcement.v0.json")))
{
    throw new InvalidOperationException("Package consumer wrote P2P metadata after rejecting an unsafe base URL.");
}

P2PShareKitReport shareReport = p2p.PrepareLocalShareKit(new PrepareShareKitRequest(
    ModelPath: modelPath,
    OutputDir: outputDir,
    ManifestId: "consumer-smoke-share",
    ModelId: "consumer-smoke-model",
    PeerId: "consumer-smoke-peer",
    PublicBaseUrl: "http://127.0.0.1:8123/peer",
    PieceSize: 4096));

if (shareReport.Kind != "tinyrustlm.p2p_share_kit_report.v0"
    || !File.Exists(shareReport.ManifestPath)
    || !File.Exists(shareReport.ShareMetadataPath)
    || shareReport.Manifest.Boundary.ManifestContainsModelBytes
    || shareReport.Manifest.Boundary.ExposesPrivateRouting
    || !shareReport.Manifest.Boundary.RequiresPieceSha256Validation
    || !shareReport.Manifest.Boundary.RequiresArtifactSha256Validation)
{
    throw new InvalidOperationException("Package consumer typed P2P share report did not validate.");
}
if (string.IsNullOrWhiteSpace(shareReport.AnnouncementPath) || !File.Exists(shareReport.AnnouncementPath))
{
    throw new InvalidOperationException("Package consumer P2P share report did not expose an announcement path.");
}
var announcementJson = File.ReadAllText(shareReport.AnnouncementPath);
var announcement = p2p.ValidateAnnouncement(announcementJson);
var validatedAnnouncementJson = p2p.ValidateAnnouncementJson(announcementJson);
var catalog = p2p.ApplyReceivedAnnouncement(announcementJson);
var catalogJson = p2p.ApplyReceivedAnnouncementJson(announcementJson);
var duplicateCatalog = p2p.ApplyReceivedAnnouncement(announcementJson, catalogJson);
var catalogInspection = p2p.InspectAnnouncementCatalog(catalogJson);
var catalogInspectionJson = p2p.InspectAnnouncementCatalogJson(catalogJson);
if (announcement.Kind != "tinyrustlm.p2p_announcement.v0"
    || announcement.PeerId != "consumer-smoke-peer"
    || announcement.ManifestId != "consumer-smoke-share"
    || !announcement.PeerConsent
    || !validatedAnnouncementJson.Contains("\"kind\": \"tinyrustlm.p2p_announcement.v0\"", StringComparison.Ordinal)
    || catalog.Kind != "tinyrustlm.p2p_announcement_catalog.v0"
    || catalog.Announcements.Count != 1
    || duplicateCatalog.Announcements.Count != 1
    || !catalogJson.Contains("\"announcements\": [", StringComparison.Ordinal)
    || catalogInspection.Kind != "tinyrustlm.p2p_announcement_catalog_inspection.v0"
    || catalogInspection.AnnouncementCount != 1
    || catalogInspection.PeerCount != 1
    || catalogInspection.ManifestCount != 1
    || catalogInspection.ModelCount != 1
    || !catalogInspection.Valid
    || !catalogInspectionJson.Contains(
        "\"kind\": \"tinyrustlm.p2p_announcement_catalog_inspection.v0\"",
        StringComparison.Ordinal))
{
    throw new InvalidOperationException("Package consumer P2P announcement/catalog handoff did not validate.");
}
var manifestJson = File.ReadAllText(shareReport.ManifestPath);
var manifest = p2p.InspectManifest(manifestJson);
var invalidSignedManifestJson = JsonSerializer.Serialize(new
{
    kind = "tinyrustlm.p2p_signed_manifest.v0",
    version = 1,
    manifest = JsonSerializer.Deserialize<JsonElement>(manifestJson),
    signature = new
    {
        kind = "external-signature-v0",
        key_id = "consumer-smoke-key",
        publisher_id = "consumer-smoke-publisher",
        public_key_route = "keys/consumer-smoke-key.public-key.json",
        payload_sha256 = manifest.ManifestSha256,
        value = "ed25519-base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
    }
}, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower });
try
{
    p2p.VerifySignedManifest(invalidSignedManifestJson, "{\"key_kind\":\"minimodel.public_key.v0\"}");
    throw new InvalidOperationException("Package consumer accepted an invalid signed P2P manifest.");
}
catch (TinyRustLmException ex) when (ex.Code == "p2p_signed_manifest_invalid")
{
}
try
{
    p2p.VerifySignedManifestJson(invalidSignedManifestJson, "{\"key_kind\":\"minimodel.public_key.v0\"}");
    throw new InvalidOperationException("Package consumer accepted an invalid signed P2P manifest JSON handoff.");
}
catch (TinyRustLmException ex) when (ex.Code == "p2p_signed_manifest_invalid")
{
}
P2PShareMetadata metadata = p2p.ExportShareMetadata(manifestJson);
var plan = p2p.ImportFromManifest(manifestJson);
var assembledPath = Path.Combine(outputDir, "consumer-smoke-assembled.slm");
var receipt = p2p.ImportFromManifest(manifestJson, outputDir, assembledPath);
var receiptInspection = p2p.InspectLocalImportReceipt(File.ReadAllText(receipt.ReceiptPath), assembledPath);
if (!manifest.Valid || plan.RequiredPieces.Count != manifest.PieceCount)
{
    throw new InvalidOperationException("Package consumer P2P manifest/import plan did not validate.");
}
if (metadata.Kind != "tinyrustlm.p2p_share_metadata.v0"
    || metadata.ManifestSha256 != manifest.ManifestSha256
    || metadata.ArtifactSha256 != manifest.ArtifactSha256
    || metadata.Boundary.ManifestContainsModelBytes
    || metadata.Boundary.ExposesPrivateRouting)
{
    throw new InvalidOperationException("Package consumer typed P2P share metadata did not validate.");
}
if (!File.Exists(assembledPath)
    || !File.Exists(receipt.ReceiptPath)
    || receipt.OutputSha256 != manifest.ArtifactSha256
    || receipt.OutputByteCount != manifest.ArtifactByteCount
    || receipt.VerifiedPieceCount != manifest.PieceCount
    || receipt.Boundary.NetworkFetchPerformed
    || receipt.Boundary.PrivateRoutingUsed
    || !receipt.Boundary.PieceSha256Verified
    || !receipt.Boundary.ArtifactSha256Verified
    || !receipt.Boundary.SlmValidationPerformed)
{
    throw new InvalidOperationException("Package consumer P2P local assembly receipt did not validate.");
}
if (!receiptInspection.Valid
    || receiptInspection.InspectedOutputSha256 != receipt.OutputSha256
    || receiptInspection.InspectedOutputByteCount != receipt.OutputByteCount
    || receiptInspection.VerifiedPieceCount != receipt.VerifiedPieceCount
    || !receiptInspection.Boundary.SlmValidationPerformed)
{
    throw new InvalidOperationException("Package consumer P2P local import receipt inspection did not validate.");
}
if (manifestJson.Contains("\"manifest_contains_model_bytes\": true", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Package consumer manifest exposed model bytes.");
}

if (!string.IsNullOrWhiteSpace(conversionPackageId))
{
    var conversionAssembly = Assembly.Load(new AssemblyName("TinyRustLM.Conversion"));
    var toolType = conversionAssembly.GetType("TinyRustLM.TinySlmConversionTool", throwOnError: true)!;
    var fromPackageLayout = toolType.GetMethod(
        "FromPackageLayout",
        BindingFlags.Public | BindingFlags.Static,
        binder: null,
        types: new[] { typeof(TimeSpan?) },
        modifiers: null) ?? throw new InvalidOperationException("TinyRustLM conversion package did not expose FromPackageLayout.");
    var validateSlm = toolType.GetMethod(
        "ValidateSlm",
        BindingFlags.Public | BindingFlags.Instance,
        binder: null,
        types: new[] { typeof(string) },
        modifiers: null) ?? throw new InvalidOperationException("TinyRustLM conversion package did not expose ValidateSlm.");
    var conversionTool = fromPackageLayout.Invoke(null, new object?[] { TimeSpan.FromSeconds(30) })
        ?? throw new InvalidOperationException("TinyRustLM conversion package did not create a conversion tool.");
    var conversionResult = validateSlm.Invoke(conversionTool, new object?[] { modelPath })
        ?? throw new InvalidOperationException("TinyRustLM conversion package did not return a validation result.");
    var resultType = conversionResult.GetType();
    var exitCode = (int)(resultType.GetProperty("ExitCode")?.GetValue(conversionResult)
        ?? throw new InvalidOperationException("TinyRustLM conversion result did not expose ExitCode."));
    var stderr = (string)(resultType.GetProperty("StandardError")?.GetValue(conversionResult) ?? string.Empty);
    if (exitCode != 0)
    {
        throw new InvalidOperationException($"Package consumer conversion validation failed with exit code {exitCode}: {stderr}");
    }
}

Console.WriteLine($"TinyRustLM consumer smoke passed: {inspection.Sha256} {plan.RequiredPieces.Count} pieces, memory files {memoryPlan.RequiredFileCount} via {memoryPackageId}, conversion {(string.IsNullOrWhiteSpace(conversionPackageId) ? "skipped" : "validated")}, assembled {receipt.OutputPath}, receipt {receipt.ReceiptPath}, receipt inspection {receiptInspection.ReceiptSha256}");
CS

dotnet run --project "$PROJECT_DIR" --configuration Release -- "$MODEL_PATH" "$MEMORY_PACKAGE_ID" "$CONVERSION_PACKAGE_ID"
echo "TinyRustLM consumer package source verified: $PACKAGE_SOURCE @ $PACKAGE_VERSION"
