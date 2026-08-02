using System.Text;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedHostBridgeOperationsTests
{
    private static readonly byte[] ArtifactBytes = [0x53, 0x4c, 0x4d, 0x31, 1, 2, 3, 4];
    private const string ManifestSha256 = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
    private const string ArtifactSha256 = "sha256:2222222222222222222222222222222222222222222222222222222222222222";
    private const string MerkleRootSha256 = "sha256:3333333333333333333333333333333333333333333333333333333333333333";
    private const string PieceSetSha256 = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
    private const string OtherPieceSetSha256 = "sha256:5555555555555555555555555555555555555555555555555555555555555555";

    [Fact]
    public async Task ImportIsIdempotentResumableAfterRestartAndStreamsOnlyRevalidatedBytes()
    {
        var root = TemporaryRoot();
        try
        {
            var authority = new BridgeAuthority();
            var firstImporter = new BridgeImporter(blockUntilCancelled: true);
            string operationId;
            await using (var first = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(root),
                authority,
                firstImporter))
            {
                var started = await first.StartImportAsync(Submission());
                operationId = started.OperationId;
                await WaitForStateAsync(first, operationId, SeedHostBridgeImportState.Importing);
            }

            var secondImporter = new BridgeImporter(reportResumed: true);
            await using var resumed = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(root),
                authority,
                secondImporter);
            var interrupted = await resumed.GetImportAsync(operationId);
            Assert.Equal(SeedHostBridgeImportState.Resumable, interrupted.State);
            Assert.True(interrupted.CanResume);
            Assert.DoesNotContain(root, interrupted.ToString(), StringComparison.OrdinalIgnoreCase);

            var duplicate = await resumed.StartImportAsync(Submission());
            Assert.Equal(operationId, duplicate.OperationId);
            var completed = await WaitForStateAsync(
                resumed,
                operationId,
                SeedHostBridgeImportState.Available);
            Assert.Equal(1, secondImporter.CallCount);
            Assert.Equal(ArtifactBytes.Length, completed.ArtifactByteCount);
            Assert.Equal(1, completed.VerifiedPieceCount);
            Assert.True(completed.WasResumed);
            Assert.Equal(0, completed.DownloadedPieceCount);
            Assert.Equal(1, completed.ReusedPieceCount);

            var models = await resumed.ListModelsAsync();
            var model = Assert.Single(models);
            Assert.Equal(operationId, model.OperationId);
            Assert.Equal("example/conversation-model", model.ModelId);

            await using (var content = await resumed.OpenModelAsync(operationId))
            {
                using var buffer = new MemoryStream();
                await content.Content.CopyToAsync(buffer);
                Assert.Equal(ArtifactBytes, buffer.ToArray());
                Assert.Equal(ArtifactBytes.Length, content.ByteCount);
            }

            secondImporter.TamperArtifact();
            authority.RejectReceipt = true;
            var error = await Assert.ThrowsAsync<SeedHostException>(() =>
                resumed.OpenModelAsync(operationId).AsTask());
            Assert.Equal("bridge_model_revalidation_failed", error.Code);
        }
        finally
        {
            DeleteRoot(root);
        }
    }

    [Fact]
    public async Task TwoPeerIdentityDisagreementFailsBeforeAnyPieceImport()
    {
        var root = TemporaryRoot();
        try
        {
            var authority = new BridgeAuthority { DriftSecondPeer = true };
            var importer = new BridgeImporter();
            await using var operations = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(root),
                authority,
                importer);

            var started = await operations.StartImportAsync(Submission(peerCount: 2));
            var failed = await WaitForStateAsync(
                operations,
                started.OperationId,
                SeedHostBridgeImportState.Failed);

            Assert.Equal("bridge_peer_identity_mismatch", failed.ErrorCode);
            Assert.Equal(0, importer.CallCount);
            Assert.Equal(2, authority.PreflightCount);
        }
        finally
        {
            DeleteRoot(root);
        }
    }

    [Fact]
    public async Task RustPeerPreflightRejectionHasAnExplicitBridgeStageCode()
    {
        var root = TemporaryRoot();
        try
        {
            var authority = new BridgeAuthority { RejectSecondPeerPreflight = true };
            var importer = new BridgeImporter();
            await using var operations = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(root),
                authority,
                importer);

            var started = await operations.StartImportAsync(Submission(peerCount: 2));
            var failed = await WaitForStateAsync(
                operations,
                started.OperationId,
                SeedHostBridgeImportState.Failed);

            Assert.Equal("bridge_peer_preflight_rejected", failed.ErrorCode);
            Assert.Equal(0, importer.CallCount);
            Assert.Equal(2, authority.PreflightCount);
        }
        finally
        {
            DeleteRoot(root);
        }
    }

    [Fact]
    public async Task CancellationRetainsOnlyResumableStateAndSecretLikeMetadataIsNeverPersisted()
    {
        var root = TemporaryRoot();
        try
        {
            var authority = new BridgeAuthority();
            var importer = new BridgeImporter(blockUntilCancelled: true);
            await using var operations = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(root),
                authority,
                importer);

            var secretError = await Assert.ThrowsAsync<SeedHostValidationException>(() =>
                operations.StartImportAsync(new SeedHostBridgeImportSubmission(
                    ManifestText(),
                    ["{\"access_token\":\"do-not-persist\"}"])).AsTask());
            Assert.Equal("bridge_import_contains_credentials", secretError.Code);
            Assert.Empty(Directory.EnumerateFileSystemEntries(root));

            var started = await operations.StartImportAsync(Submission());
            await WaitForStateAsync(operations, started.OperationId, SeedHostBridgeImportState.Importing);
            var canceled = await operations.CancelImportAsync(started.OperationId);
            Assert.Equal(SeedHostBridgeImportState.Resumable, canceled.State);
            Assert.True(canceled.CanResume);
            Assert.Null(canceled.ArtifactSha256);
            Assert.DoesNotContain("peer-a.example", canceled.ToString(), StringComparison.OrdinalIgnoreCase);

            var persistedText = string.Join(
                "\n",
                Directory.EnumerateFiles(root, "bridge-import-state.v1.json", SearchOption.AllDirectories)
                    .Select(File.ReadAllText));
            Assert.DoesNotContain("token", persistedText, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("peer-a.example", persistedText, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            DeleteRoot(root);
        }
    }

    [Fact]
    public async Task SharingAdmitsOnlyARevalidatedImportAndRemovalRetainsOwnedBytes()
    {
        var root = TemporaryRoot();
        try
        {
            var authority = new BridgeAuthority();
            var importer = new BridgeImporter();
            await using var operations = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(
                    Path.Combine(root, "operations"),
                    SharingRootDirectory: root,
                    AllowSharing: true),
                authority,
                importer);
            var sharing = Assert.IsAssignableFrom<ISeedHostBridgeSharingOperations>(operations);

            var before = await sharing.GetSharingAsync();
            Assert.True(before.SharingEnabled);
            Assert.False(before.Initialized);
            Assert.Empty(before.Models);

            var initialized = await sharing.InitializeSharingAsync("browser-seed-fleet");
            Assert.True(initialized.Initialized);
            Assert.Equal(20, initialized.RemainingModelCapacity);

            var started = await operations.StartImportAsync(Submission());
            var available = await WaitForStateAsync(
                operations,
                started.OperationId,
                SeedHostBridgeImportState.Available);
            var endpoints = new[]
            {
                new SeedLaneAdmissionEndpoint("seed-a", "0.0.0.0:18123", "http://peer.example:18123/model/"),
                new SeedLaneAdmissionEndpoint("seed-b", "0.0.0.0:18124", "http://peer.example:18124/model/")
            };
            var admitted = await sharing.AdmitImportForSharingAsync(started.OperationId, endpoints);
            var model = Assert.Single(admitted.Models);
            Assert.Equal(started.OperationId, model.OperationId);
            Assert.Equal(available.ModelId, model.ModelId);
            Assert.False(model.Enabled);
            Assert.Equal("external-proof-required", model.AnnouncementState);
            Assert.Equal(1, authority.PieceInspectionCount);
            Assert.Equal(2, authority.StateWriteCount);

            var repeated = await sharing.AdmitImportForSharingAsync(started.OperationId, endpoints);
            Assert.Single(repeated.Models);
            Assert.Equal(2, authority.PieceInspectionCount);
            Assert.Equal(2, authority.StateWriteCount);
            var conflict = await Assert.ThrowsAsync<SeedHostValidationException>(() =>
                sharing.AdmitImportForSharingAsync(
                    started.OperationId,
                    [
                        endpoints[0],
                        endpoints[1] with { PublicBaseUrl = "http://other-peer.example:18124/model/" }
                    ]).AsTask());
            Assert.Equal("bridge_sharing_admission_conflict", conflict.Code);
            Assert.Equal(2, authority.StateWriteCount);

            var enabled = await sharing.SetImportSharingEnabledAsync(started.OperationId, true);
            Assert.True(Assert.Single(enabled.Models).Enabled);
            var disabled = await sharing.SetImportSharingEnabledAsync(started.OperationId, false);
            Assert.False(Assert.Single(disabled.Models).Enabled);

            var artifactPath = importer.ArtifactPath;
            Assert.True(File.Exists(artifactPath));
            var removed = await sharing.RemoveImportFromSharingAsync(started.OperationId);
            Assert.Empty(removed.Models);
            Assert.True(File.Exists(artifactPath));
        }
        finally
        {
            DeleteRoot(root);
        }
    }

    [Fact]
    public async Task ImportRejectsARustReportThatNamesAPieceDirectoryOutsideItsDataRoot()
    {
        var root = TemporaryRoot();
        try
        {
            await using var operations = new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(root),
                new BridgeAuthority(),
                new BridgeImporter(reportDifferentPieceDirectory: true));
            var started = await operations.StartImportAsync(Submission());
            var resumable = await WaitForStateAsync(
                operations,
                started.OperationId,
                SeedHostBridgeImportState.Resumable);
            Assert.Equal("bridge_import_piece_path_mismatch", resumable.ErrorCode);
            Assert.Null(resumable.ArtifactSha256);
        }
        finally
        {
            DeleteRoot(root);
        }
    }

    private static SeedHostBridgeImportSubmission Submission(int peerCount = 1)
    {
        var requests = Enumerable.Range(0, peerCount)
            .Select(index => $$"""
                {
                  "request_kind": "fixture",
                  "peer_label": "lane-{{(char)('a' + index)}}"
                }
                """)
            .ToArray();
        return new SeedHostBridgeImportSubmission(ManifestText(), requests);
    }

    private static string ManifestText() =>
        "model.id=example/conversation-model\nartifact.byte_count=8\n";

    private static async Task<SeedHostBridgeImportStatus> WaitForStateAsync(
        SeedHostBridgeOperations operations,
        string operationId,
        SeedHostBridgeImportState expected)
    {
        var deadline = DateTimeOffset.UtcNow + TimeSpan.FromSeconds(5);
        SeedHostBridgeImportStatus? current = null;
        while (DateTimeOffset.UtcNow < deadline)
        {
            current = await operations.GetImportAsync(operationId);
            if (current.State == expected)
            {
                return current;
            }
            await Task.Delay(20);
        }
        throw new Xunit.Sdk.XunitException(
            $"Import did not reach {expected}; current state was {current?.State} ({current?.ErrorCode}).");
    }

    private static string TemporaryRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-bridge-operations-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        return root;
    }

    private static void DeleteRoot(string root)
    {
        if (Directory.Exists(root))
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private sealed class BridgeImporter(
        bool blockUntilCancelled = false,
        bool reportDifferentPieceDirectory = false,
        bool reportResumed = false) : ISeedHostBridgeImporter
    {
        private string? artifactPath;

        internal int CallCount { get; private set; }
        internal string ArtifactPath => Assert.IsType<string>(artifactPath);

        public async Task<PeerImportExecution> ImportAsync(
            SeedPeerImportOptions options,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            if (blockUntilCancelled)
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            }
            Directory.CreateDirectory(options.OutputDirectory);
            var pieces = Path.Combine(options.OutputDirectory, "verified-pieces");
            Directory.CreateDirectory(pieces);
            File.WriteAllBytes(Path.Combine(pieces, "piece-000000.bin"), ArtifactBytes);
            artifactPath = Path.Combine(options.OutputDirectory, "model.slm");
            File.WriteAllBytes(artifactPath, ArtifactBytes);
            var receipt = Path.Combine(options.OutputDirectory, "model.minimodel-receipt");
            var resume = Path.Combine(options.OutputDirectory, "resume.json");
            var status = Path.Combine(options.OutputDirectory, "status.json");
            var preflight = Path.Combine(options.OutputDirectory, "preflight.json");
            File.WriteAllText(receipt, "receipt");
            File.WriteAllText(resume, "{}");
            File.WriteAllText(status, "{}");
            File.WriteAllText(preflight, "{}");
            var reportedPieces = pieces;
            if (reportDifferentPieceDirectory)
            {
                reportedPieces = Path.Combine(
                    Path.GetDirectoryName(options.OutputDirectory)!,
                    "unowned-report-pieces");
                Directory.CreateDirectory(reportedPieces);
                File.WriteAllBytes(Path.Combine(reportedPieces, "piece-000000.bin"), ArtifactBytes);
            }
            return new PeerImportExecution(
                options.RequestPath,
                status,
                preflight,
                "http://peer-a.example/pieces/",
                "http://peer-a.example/pieces/minimodel.peer_companion_state.v0.json",
                "validated",
                reportedPieces,
                PieceSetSha256,
                artifactPath,
                receipt,
                resume,
                1,
                reportResumed ? 0 : 1,
                reportResumed ? 1 : 0,
                0,
                0,
                1,
                reportResumed,
                ManifestSha256,
                ArtifactSha256,
                MerkleRootSha256);
        }

        internal void TamperArtifact()
        {
            Assert.NotNull(artifactPath);
            File.AppendAllText(artifactPath, "tampered", Encoding.UTF8);
        }
    }

    private sealed class BridgeAuthority : IMiniModelAuthority
    {
        internal bool DriftSecondPeer { get; init; }
        internal bool RejectSecondPeerPreflight { get; init; }
        internal bool RejectReceipt { get; set; }
        internal int PreflightCount { get; private set; }
        internal int PieceInspectionCount { get; private set; }
        internal int StateWriteCount { get; private set; }

        public uint NativeAbiVersion => 2;

        public MiniModelManifestInspection InspectManifest(string manifestPath) => new(
            manifestPath,
            ManifestSha256,
            "example/conversation-model",
            ArtifactBytes.Length,
            ArtifactSha256,
            ArtifactBytes.Length,
            1,
            MerkleRootSha256,
            "huggingface",
            "Example/Conversation",
            "0123456789abcdef",
            "Apache-2.0",
            null,
            null,
            null,
            null,
            "conversation-proven",
            "conversation-proven",
            "full-assistant-pending",
            "strict-json",
            "broader-evaluation",
            null,
            null,
            null,
            null,
            "accepted",
            "ed25519");

        public PeerImportPreflight PreflightPeerImport(
            string requestPath,
            string manifestPath,
            string outputPath)
        {
            PreflightCount++;
            if (RejectSecondPeerPreflight && File.ReadAllText(requestPath).Contains("lane-b"))
            {
                throw new SeedHostException(
                    "minimodel_operation_failed",
                    "Rust rejected the selected peer during identity preflight.");
            }
            File.WriteAllText(outputPath, "preflight");
            var drift = DriftSecondPeer && File.ReadAllText(requestPath).Contains("lane-b");
            return new PeerImportPreflight(
                requestPath,
                outputPath,
                "http://peer.example/pieces/",
                "http://peer.example/pieces/minimodel.peer_piece_set.v0",
                drift ? OtherPieceSetSha256 : PieceSetSha256,
                "http://peer.example/pieces/minimodel.peer_companion_state.v0.json",
                "validated",
                "validated",
                "minimodel.peer_status.v0.json",
                "minimodel.peer_piece_set.v0",
                "minimodel.peer_companion_state.v0.json",
                "validated",
                true,
                true,
                true,
                true,
                1,
                ManifestSha256,
                ArtifactSha256,
                MerkleRootSha256);
        }

        public PeerImportReceiptInspection InspectPeerImportReceipt(
            string receiptPath,
            string requestPath,
            string preflightPath,
            string manifestPath,
            string artifactPath)
        {
            if (RejectReceipt)
            {
                throw new SeedHostException("receipt_rejected", "fixture receipt rejected");
            }
            return new PeerImportReceiptInspection(
                receiptPath,
                "sha256:receipt",
                requestPath,
                "sha256:request",
                preflightPath,
                "sha256:preflight",
                ManifestSha256,
                "example/conversation-model",
                artifactPath,
                ArtifactSha256,
                "validated",
                true,
                true,
                true,
                true,
                "http://peer.example/pieces/",
                "http://peer.example/pieces/minimodel.peer_companion_state.v0.json",
                "validated",
                PieceSetSha256,
                1,
                MerkleRootSha256,
                true,
                true,
                true,
                true,
                false,
                false,
                false);
        }

        public MiniModelArtifactVerification VerifyArtifact(string manifestPath, string artifactPath) =>
            throw new NotSupportedException();
        public PeerPieceInspection InspectPeerPieceDirectory(string manifestPath, string pieceDirectory)
        {
            PieceInspectionCount++;
            Assert.True(File.Exists(Path.Combine(pieceDirectory, "piece-000000.bin")));
            return new PeerPieceInspection(
                Path.Combine(pieceDirectory, "minimodel.peer_piece_set.v0"),
                PieceSetSha256,
                "example/conversation-model",
                ArtifactBytes.Length,
                1,
                ManifestSha256,
                ArtifactSha256,
                MerkleRootSha256);
        }

        public PeerCompanionInspection InspectPeerCompanionState(
            string statePath,
            string manifestPath,
            string pieceDirectory) => new(
                statePath,
                "minimodel.peer_companion_state.v0.json",
                Path.Combine(pieceDirectory, "minimodel.peer_piece_set.v0"),
                PieceSetSha256,
                "example/conversation-model",
                File.ReadAllText(statePath),
                ArtifactBytes.Length,
                1,
                ManifestSha256,
                ArtifactSha256,
                MerkleRootSha256);

        public PeerCompanionStateWrite WritePeerCompanionState(
            string manifestPath,
            string pieceDirectory,
            string outputPath,
            string knownPeerBaseUrl)
        {
            StateWriteCount++;
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            File.WriteAllText(outputPath, knownPeerBaseUrl);
            return new PeerCompanionStateWrite(
                outputPath,
                "example/conversation-model",
                knownPeerBaseUrl,
                1,
                ManifestSha256,
                ArtifactSha256,
                MerkleRootSha256);
        }

        public SeedFleetInspection InspectSeedFleet(string configPath)
        {
            var config = SeedFleetConfiguration.Parse(File.ReadAllText(configPath));
            return new SeedFleetInspection(
                configPath,
                config.FleetId,
                20,
                config.Models.Count,
                config.Models.Count(value => value.Enabled),
                20 - config.Models.Count,
                2,
                config.Lanes.Sum(value => value.Endpoints.Count),
                config.Lanes.Select(value => value.LaneId).ToArray(),
                config.Models.Select(value => value.ModelId).ToArray(),
                config.Models.Where(value => value.Enabled).Select(value => value.ModelId).ToArray(),
                config.Models.Any(value => value.Enabled)
                    ? "external-proof-required"
                    : "not-advertised");
        }
        public ExternalProbeReceiptInspection InspectExternalProbeReceipt(string receiptPath, string trustPath, string configPath) =>
            throw new NotSupportedException();
        public SeedPeerSourceAnnouncementPreparation PrepareSeedAnnouncement(string catalogEntryPath, string outputPath, string receiptPath, string trustPath, string configPath) =>
            throw new NotSupportedException();
        public PeerSharePreparation PreparePeerShare(string artifactPath, string outputDirectory, string modelId, string? sourceHuggingFaceModelId = null, string? knownPeerBaseUrl = null, PeerShareProvenance? provenance = null) =>
            throw new NotSupportedException();
        public LocalPeerRoundTripVerification VerifyLocalPeerRoundTrip(string manifestPath, string artifactPath, string pieceDirectory, string workDirectory, string receiptPath) =>
            throw new NotSupportedException();
        public PeerStatusCheck CheckPeerStatus(string manifestPath, string peerBaseUrl, string outputPath) =>
            throw new NotSupportedException();
        public PeerImportExecution ExecutePeerImport(string requestPath, string manifestPath, string outputDirectory) =>
            throw new NotSupportedException();
    }
}
