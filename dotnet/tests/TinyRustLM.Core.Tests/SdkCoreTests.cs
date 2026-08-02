using System.Text.Json;
using TinyRustLM;
using Xunit;

namespace TinyRustLM.Core.Tests;

public sealed class SdkCoreTests
{
    private const int MaxManifestJsonBytes = 1024 * 1024;
    private const int MaxAnnouncementJsonBytes = 256 * 1024;
    private const int MaxAnnouncementCatalogJsonBytes = 4 * 1024 * 1024;
    private const int MaxReceiptJsonBytes = 256 * 1024;

    [Fact]
    public void InspectorValidatesFixtureModel()
    {
        var inspector = new TinySlmInspector();
        var report = inspector.Inspect(FixtureModelPath());

        Assert.Equal("tinyrustlm.slm.inspection.v0", report.Kind);
        Assert.StartsWith("sha256:", report.Sha256, StringComparison.Ordinal);
        Assert.True(report.ByteCount > 0);
        Assert.True(report.TensorCount > 0);
    }

    [Fact]
    public void RuntimeLoadsAndGeneratesWithFixtureModel()
    {
        var factory = new TinyRustLmRuntimeFactory();
        using var runtime = factory.CreateRuntime();
        var load = runtime.LoadModel(FixtureModelPath());

        Assert.True(load.Inspection.TensorCount > 0);
        var result = runtime.Generate("hello", new TinyRustLmGenerationOptions(MaxNewTokens: 2));
        Assert.NotNull(result.Text);
        Assert.Contains("model_loaded", result.Diagnostics, StringComparison.Ordinal);
    }

    [Fact]
    public void RuntimePreservesEmptyPromptAcrossNativeBridge()
    {
        var factory = new TinyRustLmRuntimeFactory();
        using var runtime = factory.CreateRuntime();
        runtime.LoadModel(FixtureModelPath());

        var result = runtime.Generate(string.Empty, new TinyRustLmGenerationOptions(MaxNewTokens: 1));

        Assert.NotNull(result.Text);
        Assert.Contains("prompt_token_count", result.Diagnostics, StringComparison.Ordinal);
    }

    [Fact]
    public void CapabilitiesDeclareProtectedBoundary()
    {
        var factory = new TinyRustLmRuntimeFactory();
        var version = factory.GetVersion();
        var capabilities = factory.GetCapabilities();

        Assert.Equal("TinyRustLM public NuGet SDK", version.Product);
        Assert.False(string.IsNullOrWhiteSpace(version.SdkVersion));
        Assert.True(version.NativeAbiVersion >= 1);
        Assert.True(capabilities.SlmValidation);
        Assert.True(capabilities.P2PMetadataWorkflows);
        Assert.True(capabilities.MemoryPackageWorkflows);
        Assert.Contains(capabilities.ExcludedPrivateCapabilities, item =>
            item.Contains("model conversion", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(capabilities.ExcludedPrivateCapabilities, item =>
            string.IsNullOrWhiteSpace(item));
    }

    [Fact]
    public void MemoryClientPlansAndInspectsUaixPersonaPackages()
    {
        var client = new TinyRustLmMemoryClient();
        var catalog = client.GetSupportedSetups();
        var catalogJson = client.GetSupportedSetupsJson();
        var setupNames = catalog.Setups.Select(setup => setup.Setup).ToArray();
        var expectedSetups = new[]
        {
            "base",
            "agent_file_handoff",
            "llm_wiki",
            "file_handoff_llm_wiki",
            "multi_agent_communication",
            "talisman_system",
            "advanced_persona_profile"
        };

        Assert.Equal("uaix.memory.setup_catalog.v0", catalog.Kind);
        Assert.Equal(expectedSetups.Length, catalog.SetupCount);
        foreach (var setup in expectedSetups)
        {
            Assert.Contains(setup, setupNames);
        }
        Assert.Contains(catalog.SourceUrls, url => url.Contains("ai-memory-package-wizard", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(catalog.SourceUrls, url => url.Contains("personality-packs", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(catalog.SourceUrls, url => url.Contains("talisman-system", StringComparison.OrdinalIgnoreCase));
        var baseSetup = Assert.Single(catalog.Setups, setup => setup.Setup == "base");
        foreach (var feature in new[]
        {
            "ai_digest_script_data_ai_digest",
            "point_agent_urls",
            "local_browser_draft_restore",
            "prompt_nudges",
            "safe_structured_output_mode",
            "review_export_checks",
            "canonical_starter_zip_downloads",
            "agent_use_blocks_codex_claude_gpt",
            "raw_session_log",
            "family_aware_required_files",
            "dtmi_policy",
            "manifest_json",
            "package_model_json",
            "knowledge_graph_json"
        })
        {
            Assert.Contains(feature, baseSetup.PackageFeatures);
        }
        var advancedPersonaSetup = Assert.Single(
            catalog.Setups,
            setup => setup.Setup == "advanced_persona_profile");
        foreach (var feature in new[]
        {
            "uaix_zip_txt_template_decks",
            "source_persona_preservation_rule",
            "depth_level_0_to_10_dimension_evidence",
            "disclosure_boundary_evidence",
            "source_confidence_evidence",
            "non_inference_rules",
            "triggered_style_axes"
        })
        {
            Assert.Contains(feature, advancedPersonaSetup.PackageFeatures);
        }
        Assert.All(catalog.Setups, setup =>
        {
            Assert.False(string.IsNullOrWhiteSpace(setup.Label));
            Assert.False(string.IsNullOrWhiteSpace(setup.SetupUrl));
            Assert.NotEmpty(setup.AuthorityUrls);
            Assert.NotEmpty(setup.PackageFeatures);
            Assert.Contains(setup.ExcludedPrivateCapabilities, item =>
                item.Contains("automatic_repository_writes", StringComparison.OrdinalIgnoreCase));
        });
        Assert.False(catalog.Boundary.AutomaticRepositoryWrites);
        Assert.Contains("\"kind\": \"uaix.memory.setup_catalog.v0\"", catalogJson, StringComparison.Ordinal);

        var request = new UaixMemoryPackageRequest(
            Setup: "advanced_persona_profile",
            CodeLikeArtifacts: true,
            Deployment: true,
            CommunicationStyle: true,
            SourceNotes: true,
            AdvancedPersona: new UaixAdvancedPersonaOptions(SenseOfStyleDepth: 3));
        var plan = client.GetRequiredFiles(request);
        var planJson = client.GetRequiredFilesJson(request);

        Assert.Equal("uaix.memory.package_plan.v0", plan.Kind);
        Assert.Equal(62, plan.RequiredFileCount);
        Assert.Equal(plan.RequiredFileCount, plan.FileDeck.TotalRequiredFiles);
        Assert.True(plan.FileDeck.ClosedRequiredFileSet);
        Assert.True(plan.FileDeck.IncludesManifestJson);
        Assert.True(plan.FileDeck.IncludesManifestOverlay);
        Assert.True(plan.FileDeck.IncludesPackageModel);
        Assert.True(plan.FileDeck.IncludesKnowledgeGraph);
        Assert.True(plan.FileDeck.IncludesLlmsExports);
        Assert.True(plan.FileDeck.IncludesAgentPickup);
        Assert.True(plan.FileDeck.IncludesSessionLog);
        Assert.True(plan.FileDeck.IncludesPersonaSourceEvidence);
        Assert.Equal(7, plan.FileDeck.UniversalRequiredFiles);
        Assert.Equal(11, plan.FileDeck.ProfileRequiredFiles);
        Assert.Equal(10, plan.FileDeck.ConfigurationSpecificRequiredFiles);
        Assert.Equal(10, plan.FileDeck.ContentTriggeredRequiredFiles);
        Assert.Equal(24, plan.FileDeck.AdvancedPersonaRequiredFiles);
        Assert.Equal(22, plan.FileDeck.PersonaDimensionFiles);
        Assert.Equal(4, plan.FileDeck.TriggeredPersonaStyleAxisFiles);
        Assert.Equal(5, plan.FileDeck.EvidenceFiles);
        Assert.Equal(6, plan.FileDeck.ExportFiles);
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/agent-pickup.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/archives/session-log.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/exports/manifest-overlay.json");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/exports/package-model.json");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/exports/knowledge-graph.json");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/coding-standards.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == "reports/deployment-memory-and-test-report.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/communication-style.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/source-notes.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/personality/sense-of-winter.uai");
        Assert.Contains(plan.RequiredFiles, file => file.Path == ".uai/evidence/provenance.uai");
        Assert.False(plan.Boundary.PersonaSourceMutationAllowed);
        Assert.True(plan.Boundary.UsesTinyrustlmRuntimeHarness);
        Assert.Contains("ai-memory-package-wizard", string.Join('\n', plan.SourceUrls), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"kind\": \"uaix.memory.package_plan.v0\"", planJson, StringComparison.Ordinal);

        const string manifestJson = """
            {
              "kind": "uaix.memory.manifest.v0",
              "setup_mode": "advanced_persona_profile",
              "files": [
                { "path": ".uai/persona.uai" }
              ]
            }
            """;
        var manifest = client.InspectManifest(manifestJson);

        Assert.Equal("uaix.memory.manifest_inspection.v0", manifest.Kind);
        Assert.True(manifest.Valid);
        Assert.True(manifest.AdvancedPersonaProfile);
        Assert.Equal(1, manifest.DeclaredFileCount);
        Assert.Contains(".uai/persona.uai", manifest.DeclaredFilePaths);

        var multiAgentPlan = client.GetRequiredFiles(new UaixMemoryPackageRequest(Setup: "multi_agent_communication"));
        Assert.Equal("multi_agent_communication", multiAgentPlan.Setup);
        Assert.Contains(multiAgentPlan.RequiredFiles, file => file.Path == ".uai/agent-instructions.uai");
        Assert.Contains(multiAgentPlan.RequiredFiles, file => file.Path == ".uai/current-state.uai");
        Assert.Contains(multiAgentPlan.RequiredFiles, file => file.Path == ".uai/next-actions.uai");
        Assert.Contains(multiAgentPlan.SourceUrls, url => url.Contains("agent-communication", StringComparison.OrdinalIgnoreCase));

        var talismanPlan = client.GetRequiredFiles(new UaixMemoryPackageRequest(Setup: "talisman_system"));
        Assert.Equal("talisman_system", talismanPlan.Setup);
        Assert.Contains(talismanPlan.RequiredFiles, file => file.Path == ".uai/totem.uai");
        Assert.Contains(talismanPlan.RequiredFiles, file => file.Path == ".uai/taboo.uai");
        Assert.Contains(talismanPlan.RequiredFiles, file => file.Path == ".uai/talisman.uai");
        Assert.Contains(talismanPlan.RequiredFiles, file => file.Path == "reports/deployment-memory-and-test-report.uai");
        Assert.Contains(talismanPlan.SourceUrls, url => url.Contains("talisman-system", StringComparison.OrdinalIgnoreCase));
        Assert.False(talismanPlan.Boundary.AutomaticRepositoryWrites);
        Assert.False(talismanPlan.Boundary.HostedImportValidation);

        var contentPlan = client.GetRequiredFiles(new UaixMemoryPackageRequest(
            Deployment: true,
            ContactMemory: true,
            CalendarScheduling: true,
            CommunicationStyle: true,
            TasksCommitments: true,
            RoutinesPreferences: true,
            SafetySupportBoundaries: true,
            PublicFacingBoundaries: true));
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == "reports/deployment-memory-and-test-report.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/contact-memory.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/calendar-and-scheduling.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/communication-style.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/tasks-and-commitments.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/routines-and-preferences.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/safety-and-support-boundary.uai");
        Assert.Contains(contentPlan.RequiredFiles, file => file.Path == ".uai/public-facing-boundary.uai");

        var root = Path.Combine(Path.GetTempPath(), $"tinyrustlm-memory-dotnet-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(root, ".uai"));
        File.WriteAllText(Path.Combine(root, ".uai", "memory-maintenance.uai"), "active");
        File.WriteAllText(Path.Combine(root, ".uai", "manifest.uaix.json"), manifestJson);
        try
        {
            var inspection = client.InspectPackage(root);

            Assert.Equal("uaix.memory.package_inspection.v0", inspection.Kind);
            Assert.Equal("directory", inspection.PackageSource);
            Assert.False(inspection.Valid);
            Assert.False(client.ValidatePackage(root));
            Assert.NotNull(inspection.Manifest);
            Assert.Contains(".uai/identity.uai", inspection.MissingRequiredFiles);
            Assert.False(inspection.ManifestDeclaresRequiredFiles);
            Assert.Contains(".uai/identity.uai", inspection.ManifestMissingRequiredFiles);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }

        var personaRoot = Path.Combine(Path.GetTempPath(), $"tinyrustlm-memory-persona-dotnet-{Guid.NewGuid():N}");
        var personaDimensionPaths = new HashSet<string>(
            plan.RequiredFiles
                .Where(file => file.Path.StartsWith(".uai/personality/", StringComparison.Ordinal)
                    && file.Path is not ".uai/personality/identity.uai"
                    && file.Path is not ".uai/personality/voice.uai"
                    && file.Path is not ".uai/personality/values.uai"
                    && file.Path is not ".uai/personality/temperament.uai"
                    && file.Path is not ".uai/personality/reasoning-style.uai"
                    && file.Path is not ".uai/personality/emotional-patterns.uai"
                    && file.Path is not ".uai/personality/relationship-style.uai"
                    && file.Path is not ".uai/personality/behavioral-patterns.uai"
                    && file.Path is not ".uai/personality/boundaries.uai"
                    && file.Path is not ".uai/personality/examples-dialogue.uai"
                    && file.Path is not ".uai/personality/adaptation-rules.uai"
                    && file.Path is not ".uai/personality/preservation-rules.uai")
                .Select(file => file.Path),
            StringComparer.Ordinal);
        try
        {
            foreach (var file in plan.RequiredFiles)
            {
                var filePath = Path.Combine(
                    personaRoot,
                    file.Path.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                var content = personaDimensionPaths.Contains(file.Path)
                    ? $"{file.Path}\ndepth_level_0_to_10: 6\ndisclosure_boundary: reviewed\nsource_confidence: high\nnon-inference rules: do not infer beyond source evidence\n"
                    : $"required {file.Path}";
                File.WriteAllText(filePath, content);
            }

            var fullManifest = new
            {
                kind = "uaix.memory.manifest.v0",
                setup_mode = "advanced_persona_profile",
                files = plan.RequiredFiles.Select(file => new { path = file.Path }).ToArray()
            };
            File.WriteAllText(
                Path.Combine(personaRoot, ".uai", "manifest.uaix.json"),
                JsonSerializer.Serialize(fullManifest, new JsonSerializerOptions { WriteIndented = true }));

            var personaInspection = client.InspectPackage(personaRoot, request);
            Assert.True(
                personaInspection.Valid,
                JsonSerializer.Serialize(personaInspection, new JsonSerializerOptions { WriteIndented = true }));
            Assert.Equal(plan.RequiredFileCount, personaInspection.FileDeck.TotalRequiredFiles);
            Assert.True(personaInspection.FileDeck.IncludesPersonaSourceEvidence);
            Assert.True(personaInspection.PersonaDimensionsValid);
            Assert.Equal(0, personaInspection.PersonaDimensionWarningCount);
            Assert.NotEmpty(personaInspection.PersonaDimensions);
            Assert.All(personaInspection.PersonaDimensions, dimension =>
            {
                Assert.True(dimension.Valid);
                Assert.True(dimension.DeclaresDepthLevel);
                Assert.Equal((byte?)6, dimension.DepthLevel0To10);
                Assert.True(dimension.DeclaresDisclosureBoundary);
                Assert.True(dimension.DeclaresSourceConfidence);
                Assert.True(dimension.DeclaresNonInferenceRules);
            });

            File.WriteAllText(
                Path.Combine(personaRoot, ".uai", "personality", "religion-worldview.uai"),
                "depth_level_0_to_10: 6\ndisclosure_boundary: reviewed\nsource_confidence: high\n");
            var driftedPersonaInspection = client.InspectPackage(personaRoot, request);
            Assert.False(driftedPersonaInspection.Valid);
            Assert.False(driftedPersonaInspection.PersonaDimensionsValid);
            Assert.True(driftedPersonaInspection.PersonaDimensionWarningCount > 0);
            var religion = Assert.Single(
                driftedPersonaInspection.PersonaDimensions,
                dimension => dimension.Path == ".uai/personality/religion-worldview.uai");
            Assert.False(religion.Valid);
            Assert.False(religion.DeclaresNonInferenceRules);
            Assert.Contains(religion.Warnings, warning =>
                warning.Contains("non-inference", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            if (Directory.Exists(personaRoot))
            {
                Directory.Delete(personaRoot, recursive: true);
            }
        }

        var oversizedManifest = new string('x', (512 * 1024) + 1);
        var error = Assert.Throws<ArgumentException>(() => client.InspectManifest(oversizedManifest));
        Assert.Equal("manifestJson", error.ParamName);
        Assert.Contains("handoff limit", error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(InvalidGenerationOptions))]
    public void RuntimeRejectsInvalidGenerationOptionsBeforeNativeCall(
        TinyRustLmGenerationOptions options,
        string parameterName)
    {
        var factory = new TinyRustLmRuntimeFactory();
        using var runtime = factory.CreateRuntime();

        var error = Assert.Throws<ArgumentOutOfRangeException>(() =>
            runtime.Generate("hello", options));

        Assert.Equal(parameterName, error.ParamName);
    }

    [Theory]
    [MemberData(nameof(EmbeddedNulInputs))]
    public void PublicApisRejectEmbeddedNulStringsBeforeNativeCall(
        Action action,
        string parameterName)
    {
        var error = Assert.Throws<ArgumentException>(action);

        Assert.Equal(parameterName, error.ParamName);
        Assert.Contains("embedded NUL", error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(InvalidPrepareShareKitRequests))]
    public void P2PClientRejectsInvalidPrepareShareKitRequestsBeforeNativeCall(
        PrepareShareKitRequest request,
        string parameterName)
    {
        var error = Assert.ThrowsAny<ArgumentException>(() =>
            new TinyRustLmP2PClient().PrepareLocalShareKit(request));

        Assert.Equal(parameterName, error.ParamName);
    }

    [Theory]
    [MemberData(nameof(OversizedP2PJsonHandoffs))]
    public void P2PClientRejectsOversizedJsonHandoffsBeforeNativeCall(
        Action action,
        string parameterName)
    {
        var error = Assert.Throws<ArgumentException>(action);

        Assert.Equal(parameterName, error.ParamName);
        Assert.Contains("UTF-8 byte budget", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void P2PClientPreparesMetadataOnlyShareKit()
    {
        var outputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-p2p-{Guid.NewGuid():N}");
        var client = new TinyRustLmP2PClient();
        var report = client.PrepareLocalShareKit(new PrepareShareKitRequest(
            FixtureModelPath(),
            outputDir,
            ManifestId: "dotnet-fixture-share",
            ModelId: "dotnet-fixture-model",
            PeerId: "dotnet-peer",
            PublicBaseUrl: "http://127.0.0.1:8123/peer",
            PieceSize: 4096));
        var reportJson = client.PrepareLocalShareKitJson(new PrepareShareKitRequest(
            FixtureModelPath(),
            Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-p2p-json-{Guid.NewGuid():N}"),
            ManifestId: "dotnet-fixture-share-json",
            ModelId: "dotnet-fixture-model-json",
            PeerId: "dotnet-peer",
            PublicBaseUrl: "http://127.0.0.1:8123/peer",
            PieceSize: 4096));

        using var rawReport = JsonDocument.Parse(reportJson);
        Assert.Equal("tinyrustlm.p2p_share_kit_report.v0", report.Kind);
        Assert.Equal("dotnet-fixture-share", report.Manifest.ManifestId);
        Assert.True(File.Exists(report.ManifestPath));
        Assert.True(File.Exists(report.ShareMetadataPath));
        Assert.False(report.Manifest.Boundary.ManifestContainsModelBytes);
        Assert.False(report.Manifest.Boundary.ExposesPrivateRouting);
        Assert.True(report.Manifest.Boundary.RequiresPieceSha256Validation);
        Assert.True(report.Manifest.Boundary.RequiresArtifactSha256Validation);
        Assert.Equal("tinyrustlm.p2p_share_kit_report.v0", rawReport.RootElement.GetProperty("kind").GetString());

        var manifestJson = File.ReadAllText(report.ManifestPath);
        Assert.False(string.IsNullOrWhiteSpace(report.AnnouncementPath));
        var announcementJson = File.ReadAllText(report.AnnouncementPath!);
        var announcement = client.ValidateAnnouncement(announcementJson);
        var validatedAnnouncementJson = client.ValidateAnnouncementJson(announcementJson);
        var catalog = client.ApplyReceivedAnnouncement(announcementJson);
        var catalogJson = client.ApplyReceivedAnnouncementJson(announcementJson);
        var duplicateCatalog = client.ApplyReceivedAnnouncement(announcementJson, catalogJson);
        var catalogInspection = client.InspectAnnouncementCatalog(catalogJson);
        var catalogInspectionJson = client.InspectAnnouncementCatalogJson(catalogJson);
        var conflictingAnnouncementJson = JsonSerializer.Serialize(
            announcement with
            {
                ManifestSha256 = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            NativeJson.SerializerOptions);
        var conflictError = Assert.Throws<TinyRustLmException>(() =>
            client.ApplyReceivedAnnouncement(conflictingAnnouncementJson, catalogJson));
        var oversizedCatalogJson = new string('x', (4 * 1024 * 1024) + 1);
        var oversizedInspectError = Assert.Throws<ArgumentException>(() =>
            client.InspectAnnouncementCatalog(oversizedCatalogJson));
        var oversizedApplyError = Assert.Throws<ArgumentException>(() =>
            client.ApplyReceivedAnnouncement(announcementJson, oversizedCatalogJson));
        var inspection = client.InspectManifest(manifestJson);
        var invalidSignedManifestJson = JsonSerializer.Serialize(new
        {
            kind = "tinyrustlm.p2p_signed_manifest.v0",
            version = 1,
            manifest = JsonSerializer.Deserialize<JsonElement>(manifestJson, NativeJson.SerializerOptions),
            signature = new
            {
                kind = "external-signature-v0",
                key_id = "dotnet-key",
                publisher_id = "dotnet-publisher",
                public_key_route = "keys/dotnet-key.public-key.json",
                payload_sha256 = inspection.ManifestSha256,
                value = "ed25519-base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
            }
        }, NativeJson.SerializerOptions);
        var invalidSignedError = Assert.Throws<TinyRustLmException>(() =>
            client.VerifySignedManifest(invalidSignedManifestJson, "{\"key_kind\":\"minimodel.public_key.v0\"}"));
        var plan = client.ImportFromManifest(manifestJson);
        var metadata = client.ExportShareMetadata(manifestJson);
        var metadataJson = client.ExportShareMetadataJson(manifestJson);
        var assembledPath = Path.Combine(outputDir, "dotnet-fixture-assembled.slm");
        var receipt = client.ImportFromManifest(manifestJson, outputDir, assembledPath);
        var receiptInspection = client.InspectLocalImportReceipt(
            File.ReadAllText(receipt.ReceiptPath),
            assembledPath);

        Assert.Equal("dotnet-fixture-share", inspection.ManifestId);
        Assert.Equal("p2p_signed_manifest_invalid", invalidSignedError.Code);
        Assert.Equal("tinyrustlm.p2p_announcement.v0", announcement.Kind);
        Assert.Equal("dotnet-peer", announcement.PeerId);
        Assert.Equal("dotnet-fixture-share", announcement.ManifestId);
        Assert.Equal(inspection.ManifestSha256, announcement.ManifestSha256);
        Assert.Contains("\"kind\": \"tinyrustlm.p2p_announcement.v0\"", validatedAnnouncementJson, StringComparison.Ordinal);
        Assert.Equal("tinyrustlm.p2p_announcement_catalog.v0", catalog.Kind);
        Assert.Single(catalog.Announcements);
        Assert.Single(duplicateCatalog.Announcements);
        Assert.Equal("tinyrustlm.p2p_announcement_catalog_inspection.v0", catalogInspection.Kind);
        Assert.Equal(1, catalogInspection.AnnouncementCount);
        Assert.Equal(1, catalogInspection.PeerCount);
        Assert.Equal(1, catalogInspection.ManifestCount);
        Assert.Equal(1, catalogInspection.ModelCount);
        Assert.Equal(announcement.ArtifactByteCount, catalogInspection.TotalAnnouncedArtifactBytes);
        Assert.True(catalogInspection.Valid);
        Assert.Contains(
            "\"kind\": \"tinyrustlm.p2p_announcement_catalog_inspection.v0\"",
            catalogInspectionJson,
            StringComparison.Ordinal);
        Assert.Equal("p2p_apply_announcement_failed", conflictError.Code);
        Assert.Contains("conflicting metadata", conflictError.Message, StringComparison.Ordinal);
        Assert.Equal("catalogJson", oversizedInspectError.ParamName);
        Assert.Contains("UTF-8 byte budget", oversizedInspectError.Message, StringComparison.Ordinal);
        Assert.Equal("existingCatalogJson", oversizedApplyError.ParamName);
        Assert.Contains("UTF-8 byte budget", oversizedApplyError.Message, StringComparison.Ordinal);
        Assert.Contains("\"announcements\": [", catalogJson, StringComparison.Ordinal);
        Assert.Equal("tinyrustlm.p2p_share_metadata.v0", metadata.Kind);
        Assert.Equal(inspection.ManifestSha256, metadata.ManifestSha256);
        Assert.Contains("\"kind\": \"tinyrustlm.p2p_share_metadata.v0\"", metadataJson, StringComparison.Ordinal);
        Assert.Equal(inspection.PieceCount, plan.RequiredPieces.Count);
        Assert.True(File.Exists(assembledPath));
        Assert.True(File.Exists(receipt.ReceiptPath));
        Assert.Equal(inspection.ArtifactSha256, receipt.OutputSha256);
        Assert.Equal(inspection.ArtifactByteCount, receipt.OutputByteCount);
        Assert.Equal(inspection.PieceCount, receipt.VerifiedPieceCount);
        Assert.False(receipt.Boundary.NetworkFetchPerformed);
        Assert.False(receipt.Boundary.PrivateRoutingUsed);
        Assert.True(receipt.Boundary.PieceSha256Verified);
        Assert.True(receipt.Boundary.ArtifactSha256Verified);
        Assert.True(receipt.Boundary.SlmValidationPerformed);
        Assert.Equal("tinyrustlm.p2p_local_import_receipt_inspection.v0", receiptInspection.Kind);
        Assert.Equal(receipt.OutputSha256, receiptInspection.InspectedOutputSha256);
        Assert.Equal(receipt.OutputByteCount, receiptInspection.InspectedOutputByteCount);
        Assert.Equal(receipt.VerifiedPieceCount, receiptInspection.VerifiedPieceCount);
        Assert.True(receiptInspection.Valid);
        Assert.True(receiptInspection.Boundary.SlmValidationPerformed);
        Assert.False(manifestJson.Contains("\"manifest_contains_model_bytes\": true", StringComparison.Ordinal));
    }

    [Fact]
    public void P2PClientRejectsUnsafeAnnouncementBaseUrl()
    {
        var outputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-p2p-unsafe-{Guid.NewGuid():N}");
        var client = new TinyRustLmP2PClient();

        var error = Assert.Throws<TinyRustLmException>(() => client.PrepareLocalShareKit(
            new PrepareShareKitRequest(
                FixtureModelPath(),
                outputDir,
                ManifestId: "dotnet-fixture-unsafe-url",
                ModelId: "dotnet-fixture-model",
                PeerId: "dotnet-peer",
                PublicBaseUrl: "https://example.com/peer?download=1",
                PieceSize: 4096)));

        Assert.Contains("public_base_url", error.Message, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(outputDir, "tinyrustlm.p2p-manifest.v0.json")));
        Assert.False(File.Exists(Path.Combine(outputDir, "tinyrustlm.p2p-announcement.v0.json")));
    }

    private static string FixtureModelPath()
    {
        var configured = Environment.GetEnvironmentVariable("TINYRUSTLM_FIXTURE_MODEL");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && current is not null; i++, current = current.Parent)
        {
            var candidate = Path.Combine(current.FullName, "tinyrustlm", "models", "tiny-test-model.slm");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException("Could not locate tinyrustlm/models/tiny-test-model.slm.");
    }

    public static IEnumerable<object[]> InvalidGenerationOptions()
    {
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(MaxNewTokens: 0),
            "MaxNewTokens"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(MaxNewTokens: -1),
            "MaxNewTokens"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(Temperature: float.NaN),
            "Temperature"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(Temperature: -0.1f),
            "Temperature"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopK: 0),
            "TopK"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopK: 1025),
            "TopK"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopP: 0.0f),
            "TopP"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopP: float.PositiveInfinity),
            "TopP"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopP: 1.1f),
            "TopP"
        };
    }

    public static IEnumerable<object[]> EmbeddedNulInputs()
    {
        yield return new object[]
        {
            (Action)(() => new TinySlmInspector().Inspect("bad\0path.slm")),
            "path"
        };
        yield return new object[]
        {
            (Action)(() =>
            {
                var factory = new TinyRustLmRuntimeFactory();
                using var runtime = factory.CreateRuntime();
                runtime.LoadModel("bad\0path.slm");
            }),
            "path"
        };
        yield return new object[]
        {
            (Action)(() =>
            {
                var factory = new TinyRustLmRuntimeFactory();
                using var runtime = factory.CreateRuntime();
                runtime.Generate("hello\0world");
            }),
            "prompt"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectManifest("{\"kind\":\"x\"}\0")),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().VerifySignedManifest("{\"kind\":\"x\"}\0", "{}")),
            "signedManifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().VerifySignedManifest("{\"kind\":\"x\"}", "{}\0")),
            "publicKeyJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().PrepareLocalShareKit(new PrepareShareKitRequest(
                "bad\0path.slm",
                Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-nul-{Guid.NewGuid():N}")))),
            "ModelPath"
        };
    }

    public static IEnumerable<object[]> InvalidPrepareShareKitRequests()
    {
        yield return new object[]
        {
            null!,
            "request"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(null!, Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid")),
            "ModelPath"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest("   ", Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid")),
            "ModelPath"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(FixtureModelPath(), null!),
            "OutputDir"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(FixtureModelPath(), "   "),
            "OutputDir"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(
                FixtureModelPath(),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid"),
                PieceSize: 1023),
            "PieceSize"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(
                FixtureModelPath(),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid"),
                PieceSize: (16 * 1024 * 1024) + 1),
            "PieceSize"
        };
    }

    public static IEnumerable<object[]> OversizedP2PJsonHandoffs()
    {
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectManifest(
                OversizedJson(MaxManifestJsonBytes))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ImportFromManifest(
                OversizedJson(MaxManifestJsonBytes))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ImportFromManifest(
                OversizedJson(MaxManifestJsonBytes),
                Path.GetTempPath(),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-oversized.slm"))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().VerifySignedManifest(
                OversizedJson(MaxManifestJsonBytes),
                "{}")),
            "signedManifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().VerifySignedManifest(
                "{\"kind\":\"tinyrustlm.p2p_signed_manifest.v0\"}",
                OversizedJson(16 * 1024))),
            "publicKeyJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ExportShareMetadataJson(
                OversizedJson(MaxManifestJsonBytes))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectLocalImportReceipt(
                OversizedJson(MaxReceiptJsonBytes),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-oversized.slm"))),
            "receiptJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ValidateAnnouncement(
                OversizedJson(MaxAnnouncementJsonBytes))),
            "announcementJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ApplyReceivedAnnouncement(
                "{\"kind\":\"tinyrustlm.p2p_announcement.v0\"}",
                OversizedJson(MaxAnnouncementCatalogJsonBytes))),
            "existingCatalogJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectAnnouncementCatalog(
                OversizedJson(MaxAnnouncementCatalogJsonBytes))),
            "catalogJson"
        };
    }

    private static string OversizedJson(int maxBytes) => new('x', maxBytes + 1);
}
