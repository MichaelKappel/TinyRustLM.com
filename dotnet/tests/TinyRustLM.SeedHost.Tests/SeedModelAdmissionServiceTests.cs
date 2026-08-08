using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

[Collection("MiniModel native")]
public sealed class SeedModelAdmissionServiceTests
{
    [Fact]
    public async Task AdmissionWritesTwoStatesOverOneRustVerifiedPieceStore()
    {
        var paths = MiniModelDevelopmentPaths.Find();
        Environment.SetEnvironmentVariable("MINIMODEL_NATIVE_PATH", paths.NativeLibrary);
        var artifact = paths.FixtureArtifact;
        var root = Path.Combine(Path.GetTempPath(), $"seed-admission-{Guid.NewGuid():N}");
        var authority = new MiniModelAuthority();
        await using var store = new SeedFleetStore(new SeedFleetStoreOptions(root), authority);
        try
        {
            await store.InitializeAsync("admission-test");
            var laneAPort = FreePort();
            var laneBPort = FreePortExcept(laneAPort);
            var service = new SeedModelAdmissionService(store, authority);
            var provenance = ProvenanceFixture(root);

            var admitted = await service.AdmitAsync(new SeedModelAdmissionOptions(
                "tinyrustlm/admitted-q8",
                artifact,
                [
                    new SeedLaneAdmissionEndpoint(
                        "seed-a",
                        $"127.0.0.1:{laneAPort}",
                        $"http://127.0.0.1:{laneAPort}/models/admitted/"),
                    new SeedLaneAdmissionEndpoint(
                        "seed-b",
                        $"127.0.0.1:{laneBPort}",
                        $"http://127.0.0.1:{laneBPort}/models/admitted/")
                ],
                "TinyRustLM/Fixture-Q8",
                provenance));

            Assert.Equal(1, admitted.Fleet.AdmittedModelCount);
            Assert.Equal(2, admitted.Fleet.PeerEndpointCount);
            Assert.True(File.Exists(admitted.ManifestPath));
            Assert.True(Directory.Exists(admitted.PieceDirectory));
            Assert.True(File.Exists(admitted.LocalRoundTripReceiptPath));
            Assert.StartsWith("sha256:", admitted.LocalRoundTripReceiptSha256, StringComparison.Ordinal);
            var manifest = authority.InspectManifest(admitted.ManifestPath);
            Assert.Equal(
                "0123456789abcdef0123456789abcdef01234567",
                manifest.SourceRevision);
            Assert.Equal("Apache-2.0", manifest.SourceLicenseId);
            Assert.Equal(
                "conversation-proven-full-assistant-pending",
                manifest.QualityTier);
            Assert.Equal("strict-json", manifest.KnownLimitation);
            var configuration = await store.ReadConfigurationAsync();
            Assert.Single(configuration.Models);
            Assert.Equal(
                configuration.Models[0].PieceDirectory,
                configuration.Models.Select(model => model.PieceDirectory).Distinct().Single());
            Assert.All(configuration.Lanes, lane =>
            {
                var statePath = Path.Combine(root, lane.Endpoints.Single().StatePath);
                var state = authority.InspectPeerCompanionState(
                    statePath,
                    admitted.ManifestPath,
                    admitted.PieceDirectory);
                Assert.Equal("tinyrustlm/admitted-q8", state.ModelId);
                Assert.Equal(admitted.ArtifactSha256, state.ArtifactSha256);
            });
            Assert.Empty(Directory.EnumerateDirectories(root, ".admission-*"));
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
    public async Task TrainedAdmissionRequiresChecksumBoundProvenanceBeforeNativeWork()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-admission-required-{Guid.NewGuid():N}");
        var authority = new RejectUnexpectedNativeAuthority();
        await using var store = new SeedFleetStore(new SeedFleetStoreOptions(root), authority);
        var service = new SeedModelAdmissionService(store, authority);

        var error = await Assert.ThrowsAsync<SeedHostValidationException>(() =>
            service.AdmitAsync(new SeedModelAdmissionOptions(
                "tinyrustlm/trained-without-evidence",
                "missing.slm",
                [],
                "ExampleOrg/Trained")));

        Assert.Equal("missing_trained_provenance", error.Code);
        Assert.False(authority.WasCalled);
    }

    [Fact]
    public async Task PreCancelledAdmissionStopsBeforeConfigurationOrNativeWork()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-admission-cancel-{Guid.NewGuid():N}");
        var authority = new RejectUnexpectedNativeAuthority();
        await using var store = new SeedFleetStore(new SeedFleetStoreOptions(root), authority);
        var service = new SeedModelAdmissionService(store, authority);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.AdmitAsync(
                new SeedModelAdmissionOptions("tinyrustlm/cancelled", "missing.slm", []),
                cancellation.Token));

        Assert.False(authority.WasCalled);
        Assert.False(Directory.Exists(root));
    }

    private static PeerShareProvenance ProvenanceFixture(string root)
    {
        var input = Path.Combine(root, "provenance-input");
        Directory.CreateDirectory(input);
        var license = WriteEvidence(input, "LICENSE.txt", "Apache License 2.0 test fixture\n");
        var notice = WriteEvidence(
            input,
            "NOTICE.md",
            "Converted to .slm q8_0; no training performed.\n");
        var conversation = WriteEvidence(
            input,
            "conversation.evidence",
            "evidence_status=pass\nconversation_turn_count=2\n");
        var evaluation = WriteEvidence(
            input,
            "quality.eval",
            "eval_status=fail\ncases_passed=10\ncases_failed=2\n");
        return new PeerShareProvenance(
            "0123456789abcdef0123456789abcdef01234567",
            "Apache-2.0",
            license.Path,
            license.Sha256,
            notice.Path,
            notice.Sha256,
            conversation.Path,
            conversation.Sha256,
            evaluation.Path,
            evaluation.Sha256,
            PeerShareQualityTier.ConversationProvenFullAssistantPending,
            "strict-json");
    }

    private static (string Path, string Sha256) WriteEvidence(
        string directory,
        string fileName,
        string content)
    {
        var path = Path.Combine(directory, fileName);
        var bytes = Encoding.UTF8.GetBytes(content);
        File.WriteAllBytes(path, bytes);
        return (path, $"sha256:{Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()}");
    }

    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static int FreePortExcept(int excluded)
    {
        var port = FreePort();
        while (port == excluded)
        {
            port = FreePort();
        }
        return port;
    }

    private sealed class RejectUnexpectedNativeAuthority : IMiniModelAuthority
    {
        public bool WasCalled { get; private set; }
        public uint NativeAbiVersion => Unexpected<uint>();
        public MiniModelManifestInspection InspectManifest(string manifestPath) => Unexpected<MiniModelManifestInspection>();
        public MiniModelArtifactVerification VerifyArtifact(string manifestPath, string artifactPath) => Unexpected<MiniModelArtifactVerification>();
        public PeerPieceInspection InspectPeerPieceDirectory(string manifestPath, string pieceDirectory) => Unexpected<PeerPieceInspection>();
        public PeerCompanionInspection InspectPeerCompanionState(string statePath, string manifestPath, string pieceDirectory) => Unexpected<PeerCompanionInspection>();
        public PeerCompanionStateWrite WritePeerCompanionState(string manifestPath, string pieceDirectory, string outputPath, string knownPeerBaseUrl) => Unexpected<PeerCompanionStateWrite>();
        public SeedFleetInspection InspectSeedFleet(string configPath) => Unexpected<SeedFleetInspection>();
        public ExternalProbeReceiptInspection InspectExternalProbeReceipt(string receiptPath, string trustPath, string configPath) => Unexpected<ExternalProbeReceiptInspection>();
        public SeedPeerSourceAnnouncementPreparation PrepareSeedAnnouncement(string catalogEntryPath, string outputPath, string receiptPath, string trustPath, string configPath) => Unexpected<SeedPeerSourceAnnouncementPreparation>();
        public PeerSharePreparation PreparePeerShare(string artifactPath, string outputDirectory, string modelId, string? sourceHuggingFaceModelId = null, string? knownPeerBaseUrl = null, PeerShareProvenance? provenance = null) => Unexpected<PeerSharePreparation>();
        public LocalPeerRoundTripVerification VerifyLocalPeerRoundTrip(string manifestPath, string artifactPath, string pieceDirectory, string workDirectory, string receiptPath) => Unexpected<LocalPeerRoundTripVerification>();
        public PeerStatusCheck CheckPeerStatus(string manifestPath, string peerBaseUrl, string outputPath) => Unexpected<PeerStatusCheck>();
        public PeerImportPreflight PreflightPeerImport(string requestPath, string manifestPath, string outputPath) => Unexpected<PeerImportPreflight>();
        public PeerImportExecution ExecutePeerImport(string requestPath, string manifestPath, string outputDirectory) => Unexpected<PeerImportExecution>();
        public PeerImportReceiptInspection InspectPeerImportReceipt(string receiptPath, string requestPath, string preflightPath, string manifestPath, string artifactPath) => Unexpected<PeerImportReceiptInspection>();

        private T Unexpected<T>()
        {
            WasCalled = true;
            throw new InvalidOperationException("Native authority must not be called.");
        }
    }
}
