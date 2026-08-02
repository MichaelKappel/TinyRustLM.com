using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedAnnouncementServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 13, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void ExpiredExternalProofCannotReachAnnouncementPreparation()
    {
        var authority = new AnnouncementAuthority(Inspection("2026-07-13T11:59:59Z"));
        var service = new SeedAnnouncementService(authority, new FixedTimeProvider(Now));

        var error = Assert.Throws<SeedHostValidationException>(() =>
            service.Prepare(Options()));

        Assert.Equal("external_probe_expired", error.Code);
        Assert.Equal(0, authority.PrepareCallCount);
    }

    [Fact]
    public void CurrentExternalProofIsReverifiedAndConsumedByRustAuthority()
    {
        var inspection = Inspection("2026-07-13T12:09:59Z");
        var authority = new AnnouncementAuthority(inspection);
        var service = new SeedAnnouncementService(authority, new FixedTimeProvider(Now));

        var prepared = service.Prepare(Options());

        Assert.Equal(1, authority.InspectCallCount);
        Assert.Equal(1, authority.PrepareCallCount);
        Assert.Equal(inspection.ReceiptSha256, prepared.ExternalProbeReceiptSha256);
        Assert.True(prepared.AnnouncementEligible);
        Assert.False(prepared.Advertised);
    }

    [Fact]
    public void ManagedBoundaryRejectsAContradictoryNativePreparationResult()
    {
        var inspection = Inspection("2026-07-13T12:09:59Z");
        var authority = new AnnouncementAuthority(
            inspection,
            Preparation(inspection) with { Advertised = true });
        var service = new SeedAnnouncementService(authority, new FixedTimeProvider(Now));

        var error = Assert.Throws<SeedHostException>(() => service.Prepare(Options()));

        Assert.Equal("native_contract_mismatch", error.Code);
    }

    private static SeedAnnouncementPreparationOptions Options() => new(
        "model.catalog.json",
        "model.announcement.json",
        "external.receipt.json",
        "external.trust.json",
        "seed-fleet.v0.json");

    private static ExternalProbeReceiptInspection Inspection(string expiresUtc) => new(
        "external.receipt.json",
        Hash('a'),
        "receipt-a",
        "outside-observer",
        "outside-key-v0",
        Hash('b'),
        "fleet-a",
        "seed-a",
        "tinyrustlm/model-a",
        "http://peer.example.test:8123/models/a/",
        Hash('c'),
        Hash('d'),
        "2026-07-13T11:59:30Z",
        expiresUtc,
        4,
        "observer-v0",
        "outside-host-and-local-network",
        Hash('e'),
        ExternallyReachable: true,
        AnnouncementEligible: true,
        ProjectServerServesModelBytes: false,
        ProjectServerRunsModelBytes: false,
        ProjectServerProxiesModelBytes: false);

    private static SeedPeerSourceAnnouncementPreparation Preparation(
        ExternalProbeReceiptInspection inspection) => new(
            "model.announcement.json",
            Hash('f'),
            "external-probe-replay-v0/receipt.consumed.json",
            inspection.FleetId,
            inspection.LaneId,
            inspection.ModelId,
            inspection.ArtifactSha256,
            inspection.PieceSetSha256,
            inspection.PublicBaseUrl,
            inspection.ReceiptId,
            inspection.ReceiptSha256,
            inspection.ExpiresUtc,
            ExternallyReachable: true,
            AnnouncementEligible: true,
            Advertised: false,
            ProjectServerServesModelBytes: false,
            ProjectServerRunsModelBytes: false,
            ProjectServerProxiesModelBytes: false);

    private static string Hash(char value) => $"sha256:{new string(value, 64)}";

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class AnnouncementAuthority : IMiniModelAuthority
    {
        private readonly ExternalProbeReceiptInspection inspection;
        private readonly SeedPeerSourceAnnouncementPreparation preparation;

        internal AnnouncementAuthority(
            ExternalProbeReceiptInspection inspection,
            SeedPeerSourceAnnouncementPreparation? preparation = null)
        {
            this.inspection = inspection;
            this.preparation = preparation ?? Preparation(inspection);
        }

        internal int InspectCallCount { get; private set; }
        internal int PrepareCallCount { get; private set; }
        public uint NativeAbiVersion => 1;

        public ExternalProbeReceiptInspection InspectExternalProbeReceipt(
            string receiptPath,
            string trustPath,
            string configPath)
        {
            InspectCallCount++;
            return inspection;
        }

        public SeedPeerSourceAnnouncementPreparation PrepareSeedAnnouncement(
            string catalogEntryPath,
            string outputPath,
            string receiptPath,
            string trustPath,
            string configPath)
        {
            PrepareCallCount++;
            return preparation;
        }

        public SeedFleetInspection InspectSeedFleet(string configPath) => throw Unused();
        public MiniModelManifestInspection InspectManifest(string manifestPath) => throw Unused();
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

        private static NotSupportedException Unused() => new("Test operation is not used.");
    }
}
