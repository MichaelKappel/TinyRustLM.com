using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedFleetStoreTests
{
    [Fact]
    public async Task AddDisableEnableAndRemoveUseAtomicValidatedConfiguration()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-fleet-store-{Guid.NewGuid():N}");
        var authority = new ConfigurationOnlyAuthority();
        var store = new SeedFleetStore(new SeedFleetStoreOptions(root), authority);
        try
        {
            var initialized = await store.InitializeAsync("store-test");
            Assert.Equal(0, initialized.AdmittedModelCount);

            var model = new SeedFleetModel(
                "tinyrustlm/store-model",
                Enabled: true,
                "shares/model/model.minimodel.manifest.v0",
                "shares/model/model.peer-pieces",
                $"sha256:{new string('a', 64)}");
            var added = await store.AddModelAsync(model, Endpoints(model.ModelId));
            Assert.Equal(1, added.AdmittedModelCount);
            Assert.Equal(1, added.ActiveModelCount);

            var disabled = await store.SetModelEnabledAsync(model.ModelId, enabled: false);
            Assert.Equal(1, disabled.AdmittedModelCount);
            Assert.Equal(0, disabled.ActiveModelCount);
            Assert.False((await store.ReadConfigurationAsync()).Models[0].Enabled);

            var enabled = await store.SetModelEnabledAsync(model.ModelId, enabled: true);
            Assert.Equal(1, enabled.ActiveModelCount);

            var removed = await store.RemoveModelAsync(model.ModelId);
            Assert.Equal(0, removed.AdmittedModelCount);
            Assert.Empty((await store.ReadConfigurationAsync()).Models);
            Assert.DoesNotContain(
                Directory.EnumerateFiles(root, "*.tmp-*", SearchOption.TopDirectoryOnly),
                _ => true);
        }
        finally
        {
            if (Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }

    [Fact]
    public async Task ConcurrentAdmissionsDoNotLoseUpdates()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-fleet-concurrency-{Guid.NewGuid():N}");
        var store = new SeedFleetStore(
            new SeedFleetStoreOptions(root),
            new ConfigurationOnlyAuthority());
        try
        {
            await store.InitializeAsync("concurrent-test");
            var modelA = Model("a", 'a');
            var modelB = Model("b", 'b');
            await Task.WhenAll(
                store.AddModelAsync(modelA, Endpoints(modelA.ModelId)).AsTask(),
                store.AddModelAsync(modelB, Endpoints(modelB.ModelId)).AsTask());

            var configuration = await store.ReadConfigurationAsync();
            Assert.Equal(2, configuration.Models.Count);
            Assert.Equal(
                ["tinyrustlm/a", "tinyrustlm/b"],
                configuration.Models.Select(model => model.ModelId));
        }
        finally
        {
            if (Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }

    private static SeedFleetModel Model(string suffix, char hashCharacter) => new(
        $"tinyrustlm/{suffix}",
        Enabled: true,
        $"shares/{suffix}/{suffix}.minimodel.manifest.v0",
        $"shares/{suffix}/{suffix}.peer-pieces",
        $"sha256:{new string(hashCharacter, 64)}");

    private static IReadOnlyList<SeedLaneEndpointAssignment> Endpoints(string modelId) =>
    [
        new("seed-a", new SeedFleetEndpoint(
            modelId,
            $"states/seed-a-{modelId.Split('/')[1]}.json",
            $"127.0.0.1:{19000 + modelId[^1]}",
            $"http://127.0.0.1:{19000 + modelId[^1]}/models/a/")),
        new("seed-b", new SeedFleetEndpoint(
            modelId,
            $"states/seed-b-{modelId.Split('/')[1]}.json",
            $"127.0.0.1:{20000 + modelId[^1]}",
            $"http://127.0.0.1:{20000 + modelId[^1]}/models/b/"))
    ];

    private sealed class ConfigurationOnlyAuthority : IMiniModelAuthority
    {
        public uint NativeAbiVersion => 1;

        public SeedFleetInspection InspectSeedFleet(string configPath)
        {
            var configuration = SeedFleetConfiguration.Parse(File.ReadAllText(configPath));
            var active = configuration.Models.Where(model => model.Enabled).ToArray();
            return new SeedFleetInspection(
                configPath,
                configuration.FleetId,
                20,
                configuration.Models.Count,
                active.Length,
                20 - configuration.Models.Count,
                2,
                active.Length * 2,
                configuration.Lanes.Select(lane => lane.LaneId).ToArray(),
                configuration.Models.Select(model => model.ModelId).ToArray(),
                active.Select(model => model.ModelId).ToArray(),
                "external-probe-required");
        }

        public MiniModelManifestInspection InspectManifest(string manifestPath) => throw Unused();
        public ExternalProbeReceiptInspection InspectExternalProbeReceipt(
            string receiptPath,
            string trustPath,
            string configPath) => throw Unused();
        public SeedPeerSourceAnnouncementPreparation PrepareSeedAnnouncement(
            string catalogEntryPath,
            string outputPath,
            string receiptPath,
            string trustPath,
            string configPath) => throw Unused();
        public MiniModelArtifactVerification VerifyArtifact(string manifestPath, string artifactPath) => throw Unused();
        public PeerPieceInspection InspectPeerPieceDirectory(string manifestPath, string pieceDirectory) => throw Unused();
        public PeerCompanionInspection InspectPeerCompanionState(string statePath, string manifestPath, string pieceDirectory) => throw Unused();
        public PeerCompanionStateWrite WritePeerCompanionState(string manifestPath, string pieceDirectory, string outputPath, string knownPeerBaseUrl) => throw Unused();
        public PeerSharePreparation PreparePeerShare(string artifactPath, string outputDirectory, string modelId, string? sourceHuggingFaceModelId = null, string? knownPeerBaseUrl = null, PeerShareProvenance? provenance = null) => throw Unused();
        public LocalPeerRoundTripVerification VerifyLocalPeerRoundTrip(string manifestPath, string artifactPath, string pieceDirectory, string workDirectory, string receiptPath) => throw Unused();
        public PeerStatusCheck CheckPeerStatus(string manifestPath, string peerBaseUrl, string outputPath) => throw Unused();
        public PeerImportPreflight PreflightPeerImport(string requestPath, string manifestPath, string outputPath) => throw Unused();
        public PeerImportExecution ExecutePeerImport(string requestPath, string manifestPath, string outputDirectory) => throw Unused();
        public PeerImportReceiptInspection InspectPeerImportReceipt(string receiptPath, string requestPath, string preflightPath, string manifestPath, string artifactPath) => throw Unused();

        private static NotSupportedException Unused() => new("Test authority operation is not used.");
    }
}
