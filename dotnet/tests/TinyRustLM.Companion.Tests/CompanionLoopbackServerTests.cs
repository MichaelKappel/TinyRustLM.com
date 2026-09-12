using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionLoopbackServerTests : IDisposable
{
    private readonly CanonicalTestScratch _scratch = new("loopback");

    /// <summary>Removes this test instance's owned canonical fixture container.</summary>
    public void Dispose() => _scratch.Dispose();

    private const string InstallationId = "11111111111111111111111111111111";
    private const string ProcessInstanceId = "22222222222222222222222222222222";
    private const string Origin = "https://tinyrustlm.com";

    [Fact]
    public async Task BindsOnlyNumericLoopbackAndServesCanonicalPairing()
    {
        await using var server = await StartServerAsync();
        Assert.InRange(server.Port, (ushort)1_024, ushort.MaxValue);
        Assert.Equal($"127.0.0.1:{server.Port}", server.Host);

        var issued = server.IssuePairingCode();
        var codeFields = issued.Code.Split(':');
        Assert.Equal(3, codeFields.Length);
        Assert.Equal("TRLC1", codeFields[0]);
        Assert.Equal(server.Port.ToString(CultureInfo.InvariantCulture), codeFields[1]);
        var secret = CompanionLoopbackProtocol.DecodeBase64Url32(
            codeFields[2],
            "pairing-secret");
        try
        {
            var request = BeginRequest(0x31);
            var body = CompanionLoopbackWire.EncodePairingBeginRequest(request);
            var response = await SendAsync(server, PairingPost(server, BeginPath, body));

            Assert.Equal(200, response.Status);
            Assert.Equal(response.Body.Length, ParseContentLength(response));
            Assert.Equal("application/json", response.Header("Content-Type"));
            Assert.Equal("close", response.Header("Connection"));
            Assert.Equal("no-store", response.Header("Cache-Control"));
            Assert.Equal("no-cache", response.Header("Pragma"));
            Assert.Equal("nosniff", response.Header("X-Content-Type-Options"));
            Assert.Equal(Origin, response.Header("Access-Control-Allow-Origin"));
            Assert.Equal(
                "content-length, content-type, x-tinyrustlm-session, " +
                "x-tinyrustlm-epoch, x-tinyrustlm-sequence, " +
                "x-tinyrustlm-content-sha256, " +
                "x-tinyrustlm-response-metadata-sha256, " +
                "x-tinyrustlm-response-proof, x-tinyrustlm-artifact-role, " +
                "x-tinyrustlm-artifact-id, x-tinyrustlm-artifact-sha256, " +
                "x-tinyrustlm-artifact-bytes, x-tinyrustlm-chunk-index, " +
                "x-tinyrustlm-chunk-count, x-tinyrustlm-chunk-offset, " +
                "x-tinyrustlm-chunk-bytes",
                response.Header("Access-Control-Expose-Headers"));
            Assert.False(response.Headers.ContainsKey("Server"));
            Assert.False(response.Headers.ContainsKey("Set-Cookie"));
            Assert.False(response.Headers.ContainsKey("Content-Encoding"));
            Assert.False(response.Headers.ContainsKey("Access-Control-Allow-Credentials"));

            var begin = CompanionLoopbackWire.DecodePairingBeginResponse(response.Body);
            Assert.Equal(InstallationId, begin.InstallationId);
            Assert.Equal(ProcessInstanceId, begin.ProcessInstanceId);
            Assert.Equal(request.ClaimId, begin.ClaimId);
            Assert.True(CompanionLoopbackProtocol.VerifyPairingServerProof(
                secret,
                PairingContext(server, begin),
                begin.PairingProof));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
        }
    }

    [Fact]
    public async Task PreflightIsExactAndDoesNotConsumePairingAuthority()
    {
        await using var server = await StartServerAsync();
        _ = server.IssuePairingCode();
        var request = string.Join("\r\n",
        [
            $"OPTIONS {BeginPath} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}",
            "Access-Control-Request-Method: POST",
            "Access-Control-Request-Headers: X-TinyRustLM-Request-Proof, Content-Type",
            "Connection: close",
            string.Empty,
            string.Empty
        ]);

        var response = await SendAsync(server, Encoding.ASCII.GetBytes(request));
        Assert.Equal(204, response.Status);
        Assert.Empty(response.Body);
        Assert.False(response.Headers.ContainsKey("Content-Length"));
        Assert.False(response.Headers.ContainsKey("Content-Type"));
        Assert.Equal(Origin, response.Header("Access-Control-Allow-Origin"));
        Assert.Equal("POST", response.Header("Access-Control-Allow-Methods"));
        Assert.Equal(
            "content-type, x-tinyrustlm-request-proof",
            response.Header("Access-Control-Allow-Headers"));
        Assert.Equal("300", response.Header("Access-Control-Max-Age"));
        Assert.Equal(
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
            response.Header("Vary"));
        Assert.False(response.Headers.ContainsKey("Access-Control-Expose-Headers"));
        Assert.False(response.Headers.ContainsKey("Access-Control-Allow-Credentials"));
        Assert.False(response.Headers.ContainsKey("Access-Control-Allow-Private-Network"));
        Assert.False(response.Headers.ContainsKey("X-TinyRustLM-Response-Proof"));
        Assert.False(response.Headers.ContainsKey("Server"));

        var beginBody = CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x32));
        var begin = await SendAsync(server, PairingPost(server, BeginPath, beginBody));
        Assert.Equal(200, begin.Status);
    }

    [Fact]
    public async Task AuthorityTargetMethodAndHeaderFailuresAreClosed()
    {
        await using var server = await StartServerAsync();
        var body = CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x33));

        var wrongHost = await SendAsync(
            server,
            PairingPost(server, BeginPath, body, host: $"127.0.0.1:{server.Port - 1}"));
        AssertError(wrongHost, 421, "host-invalid", cors: false, proven: false);

        var wrongOrigin = await SendAsync(
            server,
            PairingPost(server, BeginPath, body, origin: "https://example.invalid"));
        AssertError(wrongOrigin, 403, "origin-invalid", cors: false, proven: false);

        var query = await SendAsync(server, PairingPost(server, $"{BeginPath}?x=1", body));
        AssertError(query, 400, "request-malformed", cors: false, proven: false);

        var encodedPath = await SendAsync(
            server,
            PairingPost(server, BeginPath.Replace("begin", "%62egin", StringComparison.Ordinal), body));
        AssertError(encodedPath, 400, "request-malformed", cors: false, proven: false);

        var wrongMethod = await SendAsync(
            server,
            BasicRequest(server, "GET", BeginPath, extraHeaders: []));
        AssertError(wrongMethod, 405, "method-not-allowed", cors: true, proven: false);

        var forbiddenHeader = await SendAsync(
            server,
            PairingPost(server, BeginPath, body, extraHeaders: ["Referer: https://tinyrustlm.com/"]));
        AssertError(
            forbiddenHeader,
            400,
            "request-header-not-allowed",
            cors: true,
            proven: false);

        var duplicateOrigin = await SendAsync(
            server,
            PairingPost(server, BeginPath, body, extraHeaders: [$"Origin: {Origin}"]));
        AssertError(
            duplicateOrigin,
            400,
            "request-header-not-allowed",
            cors: false,
            proven: false);
    }

    [Fact]
    public async Task AuthenticatedStatusAndNullServiceErrorsConsumeExactlyOneSequence()
    {
        await using var server = await StartServerAsync();
        using var session = await PairAsync(server, 0x41);

        var statusRequest = AuthenticatedRequest(
            server,
            session,
            "GET",
            SessionPath,
            sequence: 1,
            []);
        var status = await SendAsync(server, statusRequest);
        Assert.Equal(200, status.Status);
        AssertProven(server, session, status, "GET", SessionPath, 1);
        var statusBody = CompanionLoopbackWire.DecodeSessionStatus(status.Body);
        Assert.Equal((ulong)1, statusBody.AcceptedSequence);
        Assert.Equal((ulong)2, statusBody.NextSequence);

        var replay = await SendAsync(server, statusRequest);
        AssertError(replay, 403, "capability-sequence", cors: true, proven: false);

        var unavailable = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                OperationsPath,
                sequence: 2,
                "{}"u8.ToArray()));
        AssertError(unavailable, 409, "operation-not-available", cors: true, proven: true);
        AssertProven(server, session, unavailable, "POST", OperationsPath, 2);

        var malformed = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                RotationBeginPath,
                sequence: 3,
                "{}"u8.ToArray()));
        AssertError(malformed, 400, "json-invalid", cors: true, proven: true);
        AssertProven(server, session, malformed, "POST", RotationBeginPath, 3);

        var nextStatus = await SendAsync(
            server,
            AuthenticatedRequest(server, session, "GET", SessionPath, sequence: 4, []));
        AssertProven(server, session, nextStatus, "GET", SessionPath, 4);
        Assert.Equal(
            (ulong)4,
            CompanionLoopbackWire.DecodeSessionStatus(nextStatus.Body).AcceptedSequence);
    }

    [Fact]
    public async Task SuppliedOperationServiceDispatchesCreateReadCancelAndFailure()
    {
        var root = Path.Combine(_scratch.Path, "loopback-operations");
        Directory.CreateDirectory(root);
        try
        {
            var journal = new CompanionOperationJournal(
                CompanionOperationJournal.CreateOwnedRoot(Path.Combine(root, "owned")));
            var cancellableRequest = CompanionContractTests.Request() with
            {
                AttemptId = new string('3', 32)
            };
            var rejectedRequest = CompanionContractTests.Request() with
            {
                AttemptId = new string('4', 32)
            };
            var cancellableOperationId = CompanionContract.OperationId(cancellableRequest);
            var rejectedOperationId = CompanionContract.OperationId(rejectedRequest);
            var executor = new RecordingOperationExecutor(
                ensureStarted: operationId =>
                {
                    if (operationId == cancellableOperationId)
                    {
                        var privateRoot = Path.Combine(root, "executor", operationId);
                        _ = CompanionOperationTestEvidence.EnterAcquiringSource(
                            journal,
                            journal.Read(operationId),
                            privateRoot,
                            Path.Combine(privateRoot, "model-source"),
                            Path.Combine(privateRoot, "tokenizer-source"),
                            Path.Combine(privateRoot, "output"));
                    }
                    else if (operationId == rejectedOperationId)
                    {
                        journal.Advance(
                            operationId,
                            CompanionOperationState.Rejected,
                            CompanionAcquisitionRoute.Source,
                            errorCode: "source-rejected");
                    }
                    return Task.CompletedTask;
                },
                cancelAndWait: (operationId, _) =>
                {
                    journal.Advance(
                        operationId,
                        CompanionOperationState.Cancelled,
                        CompanionAcquisitionRoute.Source);
                    return Task.CompletedTask;
                });
            var service = new CompanionOperationService(
                journal,
                executor,
                new CompanionArtifactTransfer(journal));
            await using var server = await StartServerAsync(service);
            using var session = await PairAsync(server, 0x42);

            var createdResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "POST",
                    OperationsPath,
                    sequence: 1,
                    CompanionLoopbackWire.EncodeAcquireRequest(cancellableRequest)));
            Assert.Equal(200, createdResponse.Status);
            Assert.Equal(Origin, createdResponse.Header("Access-Control-Allow-Origin"));
            AssertProven(server, session, createdResponse, "POST", OperationsPath, 1);
            var created = CompanionLoopbackWire.DecodeOperationProjection(
                createdResponse.Body);
            Assert.Equal(cancellableOperationId, created.OperationId);
            Assert.Equal(CompanionOperationState.AcquiringSource, created.State);
            Assert.Equal((ulong)0, created.PhaseCompletedBytes);
            Assert.Equal(CompanionSourceDescriptor.PayloadBytes, created.PhaseTotalBytes);
            Assert.True(created.PhaseCompletedBytes <= created.PhaseTotalBytes);

            var statusPath = $"{OperationsPath}/{created.OperationId}";
            var statusResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "GET",
                    statusPath,
                    sequence: 2,
                    []));
            AssertProven(server, session, statusResponse, "GET", statusPath, 2);
            Assert.Equal(
                created,
                CompanionLoopbackWire.DecodeOperationProjection(statusResponse.Body));

            var cancelPath = $"{statusPath}/cancel";
            var cancelRequest = new CompanionCancelRequest(
                CompanionLoopbackWire.CancelRequestSchema,
                new string('c', 32));
            var cancelResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "POST",
                    cancelPath,
                    sequence: 3,
                    CompanionLoopbackWire.EncodeCancelRequest(cancelRequest)));
            AssertProven(server, session, cancelResponse, "POST", cancelPath, 3);
            Assert.Equal(
                CompanionOperationState.Cancelled,
                CompanionLoopbackWire.DecodeOperationProjection(cancelResponse.Body).State);

            var rejectedResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "POST",
                    OperationsPath,
                    sequence: 4,
                    CompanionLoopbackWire.EncodeAcquireRequest(rejectedRequest)));
            AssertProven(server, session, rejectedResponse, "POST", OperationsPath, 4);
            var rejected = CompanionLoopbackWire.DecodeOperationProjection(
                rejectedResponse.Body);
            Assert.Equal(rejectedOperationId, rejected.OperationId);
            Assert.Equal(CompanionOperationState.Rejected, rejected.State);
            Assert.Equal("source-rejected", rejected.ErrorCode);
            Assert.Equal(2, executor.EnsureStartedCount);
            Assert.Equal(1, executor.CancelCount);
            Assert.Equal(cancelRequest.CancellationId, executor.CancellationIds.Single());
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task SuppliedOperationServiceServesBoundedMetadataProvenArtifactChunk()
    {
        var root = Path.Combine(_scratch.Path, "loopback-artifact");
        try
        {
            using var fixture = new CompanionArtifactTransferTests.TransferFixture(
                root,
                "pass");
            var available = await fixture.CreateAvailableAsync();
            var service = new CompanionOperationService(
                fixture.Journal,
                new RecordingOperationExecutor(),
                new CompanionArtifactTransfer(fixture.Journal));
            await using var server = await StartServerAsync(service);
            using var session = await PairAsync(server, 0x43);

            var statusPath = $"{OperationsPath}/{available.OperationId}";
            var statusResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "GET",
                    statusPath,
                    sequence: 1,
                    []));
            AssertProven(server, session, statusResponse, "GET", statusPath, 1);
            Assert.Equal(
                CompanionOperationState.Available,
                CompanionLoopbackWire.DecodeOperationProjection(statusResponse.Body).State);

            var chunkPath = $"{statusPath}/artifacts/model/chunks/0";
            var chunkResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "GET",
                    chunkPath,
                    sequence: 2,
                    []));
            Assert.Equal(200, chunkResponse.Status);
            Assert.Equal("application/octet-stream", chunkResponse.Header("Content-Type"));
            Assert.Equal(Origin, chunkResponse.Header("Access-Control-Allow-Origin"));
            Assert.InRange(
                chunkResponse.Body.Length,
                1,
                CompanionArtifactTransfer.ChunkBytes);

            var model = available.Artifacts!.Model;
            var metadata = new CompanionArtifactResponseMetadata(
                available.OperationId,
                chunkResponse.Header("X-TinyRustLM-Artifact-Role"),
                chunkResponse.Header("X-TinyRustLM-Artifact-Id"),
                chunkResponse.Header("X-TinyRustLM-Artifact-SHA256"),
                ParseUInt64Header(chunkResponse, "X-TinyRustLM-Artifact-Bytes"),
                ParseUInt64Header(chunkResponse, "X-TinyRustLM-Chunk-Index"),
                ParseUInt64Header(chunkResponse, "X-TinyRustLM-Chunk-Count"),
                ParseUInt64Header(chunkResponse, "X-TinyRustLM-Chunk-Offset"),
                ParseUInt64Header(chunkResponse, "X-TinyRustLM-Chunk-Bytes"));
            Assert.Equal("model", metadata.ArtifactRole);
            Assert.Equal(model.ArtifactId, metadata.ArtifactId);
            Assert.Equal(model.Sha256, metadata.ArtifactSha256);
            Assert.Equal(model.ByteCount, metadata.ArtifactBytes);
            Assert.Equal((ulong)0, metadata.ChunkIndex);
            Assert.Equal((ulong)1, metadata.ChunkCount);
            Assert.Equal((ulong)0, metadata.ChunkOffset);
            Assert.Equal(checked((ulong)chunkResponse.Body.Length), metadata.ChunkBytes);
            Assert.Equal(model.Sha256, CompanionLoopbackProtocol.Sha256Hex(chunkResponse.Body));
            Assert.Equal(
                CompanionLoopbackProtocol.ComputeArtifactMetadataSha256(metadata),
                chunkResponse.Header("X-TinyRustLM-Response-Metadata-SHA256"));
            AssertProven(server, session, chunkResponse, "GET", chunkPath, 2);
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
    public async Task SuppliedOperationServiceRejectsUnboundAndArbitraryRequests()
    {
        var root = Path.Combine(_scratch.Path, "loopback-boundary");
        Directory.CreateDirectory(root);
        try
        {
            var journal = new CompanionOperationJournal(
                CompanionOperationJournal.CreateOwnedRoot(Path.Combine(root, "owned")));
            var executor = new RecordingOperationExecutor();
            var service = new CompanionOperationService(
                journal,
                executor,
                new CompanionArtifactTransfer(journal));
            await using var server = await StartServerAsync(service);
            using var session = await PairAsync(server, 0x44);
            var request = CompanionContractTests.Request() with
            {
                AttemptId = new string('5', 32)
            };
            var requestBody = CompanionLoopbackWire.EncodeAcquireRequest(request);
            var arbitraryRoute =
                $"{OperationsPath}/{new string('a', 64)}/run-local-command";

            var routeResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "GET",
                    arbitraryRoute,
                    sequence: 1,
                    []));
            AssertError(routeResponse, 404, "route-not-found", cors: true, proven: false);

            var wrongOrigin = await SendAsync(
                server,
                RequestWithBody(
                    server,
                    "POST",
                    OperationsPath,
                    requestBody,
                    server.Host,
                    "https://example.invalid",
                    AuthenticatedHeaders(
                        server,
                        session,
                        "POST",
                        OperationsPath,
                        sequence: 1,
                        requestBody)));
            AssertError(wrongOrigin, 403, "origin-invalid", cors: false, proven: false);

            var wrongProofHeaders = AuthenticatedHeaders(
                    server,
                    session,
                    "POST",
                    OperationsPath,
                    sequence: 1,
                    requestBody)
                .Select(header => header.StartsWith(
                        "X-TinyRustLM-Request-Proof:",
                        StringComparison.Ordinal)
                    ? "X-TinyRustLM-Request-Proof: " +
                        CompanionLoopbackProtocol.EncodeBase64Url(new byte[32])
                    : header)
                .ToArray();
            var wrongProof = await SendAsync(
                server,
                RequestWithBody(
                    server,
                    "POST",
                    OperationsPath,
                    requestBody,
                    server.Host,
                    Origin,
                    wrongProofHeaders));
            AssertError(wrongProof, 403, "capability-invalid", cors: true, proven: false);

            var arbitraryBody = Encoding.UTF8.GetBytes(
                "{\"command\":\"convert\",\"path\":\"C:/private\",\"url\":\"https://example.invalid/model\"}");
            var arbitrary = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "POST",
                    OperationsPath,
                    sequence: 1,
                    arbitraryBody));
            AssertError(arbitrary, 400, "json-invalid", cors: true, proven: true);
            AssertProven(server, session, arbitrary, "POST", OperationsPath, 1);

            var foreignPath = $"{OperationsPath}/{new string('f', 64)}";
            var foreign = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "GET",
                    foreignPath,
                    sequence: 2,
                    []));
            AssertError(foreign, 404, "operation-not-found", cors: true, proven: true);
            AssertProven(server, session, foreign, "GET", foreignPath, 2);

            var valid = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "POST",
                    OperationsPath,
                    sequence: 3,
                    requestBody));
            AssertProven(server, session, valid, "POST", OperationsPath, 3);
            Assert.Equal(
                CompanionContract.OperationId(request),
                CompanionLoopbackWire.DecodeOperationProjection(valid.Body).OperationId);
            Assert.Equal(1, executor.EnsureStartedCount);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task NullSeedServiceReturnsOnlyAProvenUnavailableProjection()
    {
        await using var server = await StartServerAsync();
        using var session = await PairAsync(server, 0x47);
        var operationId = CompanionContractTests.Digest('a');
        var body = CompanionLoopbackWire.EncodeDirectCompositionSeedStartRequest(
            new CompanionDirectCompositionSeedStartRequest(
                CompanionLoopbackWire.DirectCompositionSeedStartRequestSchema,
                operationId));

        var unavailable = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                DirectCompositionSeedsPath,
                sequence: 1,
                body));

        AssertError(
            unavailable,
            409,
            "direct-composition-seed-not-available",
            cors: true,
            proven: true);
        AssertProven(
            server,
            session,
            unavailable,
            "POST",
            DirectCompositionSeedsPath,
            sequence: 1);

        var arbitraryPath = $"{DirectCompositionSeedsPath}/{operationId}/command";
        var arbitrary = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "GET",
                arbitraryPath,
                sequence: 2,
                []));
        AssertError(arbitrary, 404, "route-not-found", cors: true, proven: false);

        var valid = await SendAsync(
            server,
            AuthenticatedRequest(server, session, "GET", SessionPath, sequence: 2, []));
        Assert.Equal(200, valid.Status);
        AssertProven(server, session, valid, "GET", SessionPath, sequence: 2);
    }

    [Fact]
    public async Task SeedServiceRoutesBindIdentityProofsAndRejectCallerAuthority()
    {
        var root = Path.Combine(_scratch.Path, "companion-seed-http");
        await using var harness = await CompanionDirectCompositionSeedTestHarness.CreateAsync(
            root,
            "success");
        await using var seeds = harness.CreateService();
        await using var server = await StartServerAsync(seedService: seeds);
        using var session = await PairAsync(server, 0x48);
        var start = new CompanionDirectCompositionSeedStartRequest(
            CompanionLoopbackWire.DirectCompositionSeedStartRequestSchema,
            harness.OperationId);
        var startBody = CompanionLoopbackWire.EncodeDirectCompositionSeedStartRequest(start);

        var startedResponse = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                DirectCompositionSeedsPath,
                sequence: 1,
                startBody));
        Assert.Equal(200, startedResponse.Status);
        var started = CompanionLoopbackWire.DecodeDirectCompositionSeedProjection(
            startedResponse.Body);
        Assert.Equal(harness.OperationId, started.OperationId);
        Assert.Equal(CompanionDirectCompositionSeedState.Ready, started.State);
        Assert.Equal(CompanionLoopbackProtocol.ProductionOrigin, started.AllowedBrowserOrigin);
        AssertProven(
            server,
            session,
            startedResponse,
            "POST",
            DirectCompositionSeedsPath,
            sequence: 1);

        var statusPath = $"{DirectCompositionSeedsPath}/{harness.OperationId}";
        var statusResponse = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "GET",
                statusPath,
                sequence: 2,
                []));
        Assert.Equal(started, CompanionLoopbackWire.DecodeDirectCompositionSeedProjection(
            statusResponse.Body));
        AssertProven(server, session, statusResponse, "GET", statusPath, sequence: 2);

        var foreignPath =
            $"{DirectCompositionSeedsPath}/{CompanionContractTests.Digest('f')}";
        var foreign = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "GET",
                foreignPath,
                sequence: 3,
                []));
        AssertError(
            foreign,
            404,
            "direct-composition-seed-not-found",
            cors: true,
            proven: true);
        AssertProven(server, session, foreign, "GET", foreignPath, sequence: 3);

        var hostileBody = Encoding.UTF8.GetBytes(
            $"{{\"schema\":\"{CompanionLoopbackWire.DirectCompositionSeedStartRequestSchema}\"," +
            $"\"operationId\":\"{harness.OperationId}\"," +
            "\"executablePath\":\"C:\\\\untrusted.exe\"}");
        var hostile = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                DirectCompositionSeedsPath,
                sequence: 4,
                hostileBody));
        AssertError(hostile, 400, "json-invalid", cors: true, proven: true);
        AssertProven(
            server,
            session,
            hostile,
            "POST",
            DirectCompositionSeedsPath,
            sequence: 4);

        var stopPath = $"{statusPath}/stop";
        var stopBody = CompanionLoopbackWire.EncodeDirectCompositionSeedStopRequest(
            new CompanionDirectCompositionSeedStopRequest(
                CompanionLoopbackWire.DirectCompositionSeedStopRequestSchema));
        var arbitraryPath = $"{stopPath}/extra";
        var arbitrary = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                arbitraryPath,
                sequence: 5,
                stopBody));
        AssertError(arbitrary, 404, "route-not-found", cors: true, proven: false);

        var stoppedResponse = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                stopPath,
                sequence: 5,
                stopBody));
        var stopped = CompanionLoopbackWire.DecodeDirectCompositionSeedProjection(
            stoppedResponse.Body);
        Assert.Equal(CompanionDirectCompositionSeedState.Stopped, stopped.State);
        Assert.Equal(2UL, stopped.Sequence);
        AssertProven(server, session, stoppedResponse, "POST", stopPath, sequence: 5);
    }

    [Fact]
    public async Task PreAuthenticationFailuresDoNotConsumeSequence()
    {
        await using var server = await StartServerAsync();
        using var session = await PairAsync(server, 0x45);
        var emptyHeaders = AuthenticatedHeaders(
            server,
            session,
            "GET",
            SessionPath,
            sequence: 1,
            []);

        var missingProof = await SendAsync(
            server,
            BasicRequest(
                server,
                "GET",
                SessionPath,
                emptyHeaders.Where(header =>
                    !header.StartsWith("X-TinyRustLM-Request-Proof:", StringComparison.Ordinal))
                    .ToArray()));
        AssertError(missingProof, 403, "capability-invalid", cors: true, proven: false);

        var duplicateSessionHeaders = emptyHeaders.ToList();
        duplicateSessionHeaders.Add($"X-TinyRustLM-Session: {session.SessionId}");
        var duplicateSession = await SendAsync(
            server,
            BasicRequest(server, "GET", SessionPath, duplicateSessionHeaders));
        AssertError(
            duplicateSession,
            400,
            "request-header-not-allowed",
            cors: false,
            proven: false);

        var wrongHashHeaders = emptyHeaders.Select(header =>
            header.StartsWith("X-TinyRustLM-Content-SHA256:", StringComparison.Ordinal)
                ? $"X-TinyRustLM-Content-SHA256: {new string('0', 64)}"
                : header).ToArray();
        var wrongHash = await SendAsync(
            server,
            BasicRequest(server, "GET", SessionPath, wrongHashHeaders));
        AssertError(wrongHash, 403, "capability-invalid", cors: true, proven: false);

        var getWithLengthHeaders = emptyHeaders.ToList();
        getWithLengthHeaders.Add("Content-Length: 0");
        var getWithLength = await SendAsync(
            server,
            BasicRequest(server, "GET", SessionPath, getWithLengthHeaders));
        AssertError(
            getWithLength,
            400,
            "request-framing-invalid",
            cors: true,
            proven: false);

        var oversizedBody = Enumerable.Repeat(
            (byte)' ',
            CompanionLoopbackWire.MaximumRotationBeginBytes + 1).ToArray();
        var oversized = await SendAsync(
            server,
            RequestWithBody(
                server,
                "POST",
                RotationBeginPath,
                oversizedBody,
                server.Host,
                Origin,
                AuthenticatedHeaders(
                    server,
                    session,
                    "POST",
                    RotationBeginPath,
                    sequence: 1,
                    oversizedBody)));
        AssertError(oversized, 413, "request-body-too-large", cors: true, proven: false);

        var valid = await SendAsync(
            server,
            AuthenticatedRequest(server, session, "GET", SessionPath, sequence: 1, []));
        AssertProven(server, session, valid, "GET", SessionPath, 1);
    }

    [Fact]
    public async Task RfcValidLeadingZeroContentLengthUsesProofBoundSemanticLength()
    {
        await using var server = await StartServerAsync();
        using var session = await PairAsync(server, 0x46);
        var requestBody = CompanionLoopbackWire.EncodeRotationBegin(
            new CompanionRotationBegin(
                CompanionLoopbackWire.RotationBeginSchema,
                new string('8', 32),
                CompanionLoopbackProtocol.EncodeBase64Url(
                    Enumerable.Repeat((byte)0x81, 32).ToArray())));
        var request = RequestWithBodyAndLength(
            server,
            "POST",
            RotationBeginPath,
            requestBody,
            $"0{requestBody.Length.ToString(CultureInfo.InvariantCulture)}",
            AuthenticatedHeaders(
                server,
                session,
                "POST",
                RotationBeginPath,
                sequence: 1,
                requestBody));

        var response = await SendAsync(server, request);
        Assert.Equal(200, response.Status);
        AssertProven(server, session, response, "POST", RotationBeginPath, 1);
        var challenge = CompanionLoopbackWire.DecodeRotationChallenge(response.Body);
        Assert.Equal((uint)1, challenge.CurrentEpoch);
        Assert.Equal((uint)2, challenge.NextEpoch);
    }

    [Fact]
    public async Task RotationReplayAndRevocationCrossTheRealHttpBoundary()
    {
        await using var server = await StartServerAsync();
        using var session = await PairAsync(server, 0x51);
        var rotationBegin = new CompanionRotationBegin(
            CompanionLoopbackWire.RotationBeginSchema,
            new string('6', 32),
            CompanionLoopbackProtocol.EncodeBase64Url(Enumerable.Repeat((byte)0x61, 32).ToArray()));
        var rotationBeginBytes = CompanionLoopbackWire.EncodeRotationBegin(rotationBegin);
        var challengeResponse = await SendAsync(
            server,
            AuthenticatedRequest(
                server,
                session,
                "POST",
                RotationBeginPath,
                sequence: 1,
                rotationBeginBytes));
        AssertProven(server, session, challengeResponse, "POST", RotationBeginPath, 1);
        var challenge = CompanionLoopbackWire.DecodeRotationChallenge(challengeResponse.Body);

        var rotationContext = new CompanionRotationProofContext(
            InstallationId,
            ProcessInstanceId,
            session.SessionId,
            challenge.RotationId,
            challenge.BrowserNonce,
            challenge.ServerNonce,
            challenge.CurrentEpoch,
            challenge.NextEpoch,
            server.Host,
            Origin);
        var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(session.Key, rotationContext);
        try
        {
            var commit = new CompanionRotationCommit(
                CompanionLoopbackWire.RotationCommitSchema,
                challenge.RotationId,
                challenge.BrowserNonce,
                challenge.ServerNonce,
                challenge.CurrentEpoch,
                challenge.NextEpoch,
                CompanionLoopbackProtocol.ComputeRotationNewKeyProof(newKey, rotationContext));
            var commitBytes = CompanionLoopbackWire.EncodeRotationCommit(commit);
            var commitRequest = AuthenticatedRequest(
                server,
                session,
                "POST",
                RotationCommitPath,
                sequence: 2,
                commitBytes);
            var committedResponse = await SendAsync(server, commitRequest);
            AssertProven(
                server,
                session,
                committedResponse,
                "POST",
                RotationCommitPath,
                2,
                proofKey: newKey);
            var committed = CompanionLoopbackWire.DecodeRotationCommitted(committedResponse.Body);
            Assert.Equal((uint)2, committed.KeyEpoch);
            Assert.True(CompanionLoopbackProtocol.VerifyRotationCompletionProof(
                newKey,
                rotationContext,
                CompanionLoopbackProtocol.Sha256Hex(commitBytes),
                committed.CompletionProof));

            var recovered = await SendAsync(server, commitRequest);
            Assert.Equal(committedResponse.Status, recovered.Status);
            Assert.Equal(committedResponse.Body, recovered.Body);
            Assert.Equal(
                committedResponse.Header("X-TinyRustLM-Response-Proof"),
                recovered.Header("X-TinyRustLM-Response-Proof"));

            session.ReplaceKey(newKey, epoch: 2);
            var newEpochStatus = await SendAsync(
                server,
                AuthenticatedRequest(server, session, "GET", SessionPath, sequence: 1, []));
            AssertProven(server, session, newEpochStatus, "GET", SessionPath, 1);

            var revoke = new CompanionRevokeRequest(
                CompanionLoopbackWire.RevokeRequestSchema,
                new string('7', 32));
            var revokedResponse = await SendAsync(
                server,
                AuthenticatedRequest(
                    server,
                    session,
                    "POST",
                    RevokePath,
                    sequence: 2,
                    CompanionLoopbackWire.EncodeRevokeRequest(revoke)));
            AssertProven(server, session, revokedResponse, "POST", RevokePath, 2);
            Assert.True(CompanionLoopbackWire.DecodeRevokedResponse(revokedResponse.Body).Revoked);

            var afterRevoke = await SendAsync(
                server,
                AuthenticatedRequest(server, session, "GET", SessionPath, sequence: 3, []));
            AssertError(afterRevoke, 410, "capability-revoked", cors: true, proven: false);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(newKey);
        }
    }

    [Fact]
    public async Task DuplicateContentLengthReturns400WithoutDispatch()
    {
        await using var server = await StartServerAsync();
        var issued = server.IssuePairingCode();
        var body = CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x70));
        var header = Encoding.ASCII.GetBytes(string.Join("\r\n",
        [
            $"POST {BeginPath} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}",
            "Content-Type: application/json",
            $"Content-Length: {body.Length}",
            $"Content-Length: {body.Length}",
            "Connection: close",
            string.Empty,
            string.Empty
        ]));
        var request = new byte[header.Length + body.Length];
        header.CopyTo(request, 0);
        body.CopyTo(request, header.Length);

        var rejected = await SendPossiblyParserRejectedAsync(server, request);
        AssertParserOwned(rejected, 400);
        Assert.Equal(0, server.PendingPairingCount);
        Assert.Equal(0, server.ActiveSessionCount);
        await AssertPairingAuthorityRemainsUsable(server, issued, body);
    }

    [Fact]
    public async Task ParserOwnedMalformedFramingReturns400WithoutDispatch()
    {
        await using var server = await StartServerAsync();
        var issued = server.IssuePairingCode();
        var body = CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x71));
        var header = Encoding.ASCII.GetBytes(string.Join("\r\n",
        [
            $"POST {BeginPath} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}",
            "Content-Type: application/json",
            $"Content-Length: {body.Length}",
            $"Content-Length: {body.Length}",
            "Transfer-Encoding: chunked",
            "Connection: close",
            string.Empty,
            string.Empty
        ]));
        var bytes = new byte[header.Length + body.Length];
        header.CopyTo(bytes, 0);
        body.CopyTo(bytes, header.Length);

        var rejected = await SendPossiblyParserRejectedAsync(server, bytes);
        AssertParserOwned(rejected, 400);
        Assert.Equal(0, server.PendingPairingCount);
        Assert.Equal(0, server.ActiveSessionCount);
        await AssertPairingAuthorityRemainsUsable(server, issued, body);
    }

    [Fact]
    public async Task ParserOwnedOverLimitRequestLineReturns414WithoutDispatch()
    {
        await using var server = await StartServerAsync();
        var issued = server.IssuePairingCode();
        var target = "/" + new string('a', CompanionLoopbackServer.MaximumRequestLineBytes + 256);
        var request = Encoding.ASCII.GetBytes(string.Join("\r\n",
        [
            $"GET {target} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}",
            "Connection: close",
            string.Empty,
            string.Empty
        ]));

        var rejected = await SendPossiblyParserRejectedAsync(server, request);
        AssertParserOwned(rejected, 414);
        Assert.Equal(0, server.PendingPairingCount);
        Assert.Equal(0, server.ActiveSessionCount);
        await AssertPairingAuthorityRemainsUsable(
            server,
            issued,
            CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x72)));
    }

    [Fact]
    public async Task ParserOwnedOverLimitHeaderCountReturns431WithoutDispatch()
    {
        await using var server = await StartServerAsync();
        var issued = server.IssuePairingCode();
        var lines = new List<string>
        {
            $"GET {SessionPath} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}"
        };
        lines.AddRange(Enumerable.Range(0, CompanionLoopbackServer.MaximumRequestHeaderCount)
            .Select(index => $"X-Flood-{index}: x"));
        lines.Add("Connection: close");
        lines.Add(string.Empty);
        lines.Add(string.Empty);

        var rejected = await SendPossiblyParserRejectedAsync(
            server,
            Encoding.ASCII.GetBytes(string.Join("\r\n", lines)));
        AssertParserOwned(rejected, 431);
        Assert.Equal(0, server.PendingPairingCount);
        Assert.Equal(0, server.ActiveSessionCount);
        await AssertPairingAuthorityRemainsUsable(
            server,
            issued,
            CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x73)));
    }

    [Fact]
    public async Task ParserOwnedOverLimitHeaderBytesReturns431WithoutDispatch()
    {
        await using var server = await StartServerAsync();
        var issued = server.IssuePairingCode();
        var request = Encoding.ASCII.GetBytes(string.Join("\r\n",
        [
            $"GET {SessionPath} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}",
            $"X-Flood: {new string('a', CompanionLoopbackServer.MaximumRequestHeaderBytes)}",
            "Connection: close",
            string.Empty,
            string.Empty
        ]));

        var rejected = await SendPossiblyParserRejectedAsync(server, request);
        AssertParserOwned(rejected, 431);
        Assert.Equal(0, server.PendingPairingCount);
        Assert.Equal(0, server.ActiveSessionCount);
        await AssertPairingAuthorityRemainsUsable(
            server,
            issued,
            CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x74)));
    }

    [Fact]
    public async Task GlobalBodyLimitReturns413WithoutDispatch()
    {
        await using var server = await StartServerAsync();
        var issued = server.IssuePairingCode();
        var body = Enumerable.Repeat(
            (byte)' ',
            CompanionLoopbackServer.MaximumRequestBodyBytes + 1).ToArray();
        var request = RequestWithBody(
            server,
            "POST",
            OperationsPath,
            body,
            server.Host,
            Origin,
            [
                $"X-TinyRustLM-Session: {new string('3', 32)}",
                "X-TinyRustLM-Epoch: 1",
                "X-TinyRustLM-Sequence: 1",
                $"X-TinyRustLM-Content-SHA256: {new string('0', 64)}",
                $"X-TinyRustLM-Request-Proof: {CompanionLoopbackProtocol.EncodeBase64Url(new byte[32])}"
            ]);

        var rejected = await SendPossiblyParserRejectedAsync(server, request);
        AssertParserOwned(rejected, 413);
        Assert.Equal(0, server.PendingPairingCount);
        Assert.Equal(0, server.ActiveSessionCount);
        await AssertPairingAuthorityRemainsUsable(
            server,
            issued,
            CompanionLoopbackWire.EncodePairingBeginRequest(BeginRequest(0x75)));
    }

    private static async Task AssertPairingAuthorityRemainsUsable(
        CompanionLoopbackServer server,
        CompanionIssuedPairingCode issued,
        byte[] body)
    {
        var secret = PairingSecret(issued);
        try
        {
            var valid = await SendAsync(server, PairingPost(server, BeginPath, body));
            Assert.Equal(200, valid.Status);
            var begin = CompanionLoopbackWire.DecodePairingBeginResponse(valid.Body);
            Assert.True(CompanionLoopbackProtocol.VerifyPairingServerProof(
                secret,
                PairingContext(server, begin),
                begin.PairingProof));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
        }
    }

    private static void AssertParserOwned(RawResponse? response, int status)
    {
        Assert.NotNull(response);
        Assert.Equal(status, response.Status);
        Assert.False(response.Headers.ContainsKey("Server"));
        Assert.False(response.Headers.ContainsKey("Access-Control-Allow-Origin"));
        Assert.False(response.Headers.ContainsKey("Access-Control-Expose-Headers"));
        Assert.False(response.Headers.ContainsKey("X-TinyRustLM-Session"));
        Assert.False(response.Headers.ContainsKey("X-TinyRustLM-Epoch"));
        Assert.False(response.Headers.ContainsKey("X-TinyRustLM-Sequence"));
        Assert.False(response.Headers.ContainsKey("X-TinyRustLM-Response-Metadata-SHA256"));
        Assert.False(response.Headers.ContainsKey("X-TinyRustLM-Response-Proof"));
    }

    private static string BeginPath => "/tinyrustlm-companion/1/pairings/begin";
    private static string CompletePath => "/tinyrustlm-companion/1/pairings/complete";
    private static string SessionPath => "/tinyrustlm-companion/1/session";
    private static string RotationBeginPath =>
        "/tinyrustlm-companion/1/session/rotation/begin";
    private static string RotationCommitPath =>
        "/tinyrustlm-companion/1/session/rotation/commit";
    private static string RevokePath => "/tinyrustlm-companion/1/session/revoke";
    private static string OperationsPath => "/tinyrustlm-companion/1/operations";
    private static string DirectCompositionSeedsPath =>
        "/tinyrustlm-companion/1/direct-composition-seeds";

    private Task<CompanionLoopbackServer> StartServerAsync(
        CompanionOperationService? operationService = null,
        CompanionDirectCompositionSeedService? seedService = null) =>
        CompanionLoopbackServer.StartAsync(
            new CompanionInstallationIdentity(
                _scratch.Path,
                InstallationId,
            ProcessInstanceId),
            operationService: operationService,
            seedService: seedService,
            cancellationToken: default);

    private static CompanionPairingBeginRequest BeginRequest(byte value) => new(
        CompanionLoopbackWire.PairingBeginRequestSchema,
        new string(value.ToString("x2", CultureInfo.InvariantCulture)[0], 32),
        CompanionLoopbackProtocol.EncodeBase64Url(Enumerable.Repeat(value, 32).ToArray()));

    private static CompanionPairingProofContext PairingContext(
        CompanionLoopbackServer server,
        CompanionPairingBeginResponse begin) => new(
            begin.InstallationId,
            begin.ProcessInstanceId,
            begin.ClaimId,
            begin.BrowserNonce,
            begin.ServerNonce,
            begin.SessionId,
            begin.KeyEpoch,
            server.Host,
            Origin,
            begin.SessionExpiresAtUtc,
            begin.IdleTimeoutSeconds);

    private static async Task<TestSession> PairAsync(
        CompanionLoopbackServer server,
        byte value)
    {
        var issued = server.IssuePairingCode();
        var secret = PairingSecret(issued);
        try
        {
            var beginRequest = BeginRequest(value);
            var beginResponse = await SendAsync(
                server,
                PairingPost(
                    server,
                    BeginPath,
                    CompanionLoopbackWire.EncodePairingBeginRequest(beginRequest)));
            Assert.Equal(200, beginResponse.Status);
            var begin = CompanionLoopbackWire.DecodePairingBeginResponse(beginResponse.Body);
            var context = PairingContext(server, begin);
            Assert.True(CompanionLoopbackProtocol.VerifyPairingServerProof(
                secret,
                context,
                begin.PairingProof));
            var key = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
            var completeRequest = new CompanionPairingCompleteRequest(
                CompanionLoopbackWire.PairingCompleteRequestSchema,
                begin.ClaimId,
                begin.BrowserNonce,
                begin.ServerNonce,
                begin.SessionId,
                CompanionLoopbackProtocol.ComputePairingBrowserProof(key, context));
            var completeRequestBytes = CompanionLoopbackWire.EncodePairingCompleteRequest(
                completeRequest);
            var completeResponse = await SendAsync(
                server,
                PairingPost(server, CompletePath, completeRequestBytes));
            Assert.Equal(200, completeResponse.Status);
            var complete = CompanionLoopbackWire.DecodePairingCompleteResponse(
                completeResponse.Body);
            Assert.True(CompanionLoopbackProtocol.VerifyPairingCompletionProof(
                key,
                context,
                CompanionLoopbackProtocol.Sha256Hex(completeRequestBytes),
                complete.CompletionProof));
            return new TestSession(complete.SessionId, complete.KeyEpoch, key);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
        }
    }

    private static byte[] PairingSecret(CompanionIssuedPairingCode issued) =>
        CompanionLoopbackProtocol.DecodeBase64Url32(
            issued.Code.Split(':')[2],
            "pairing-secret");

    private static byte[] PairingPost(
        CompanionLoopbackServer server,
        string path,
        byte[] body,
        string? host = null,
        string? origin = null,
        IReadOnlyList<string>? extraHeaders = null) =>
        RequestWithBody(
            server,
            "POST",
            path,
            body,
            host ?? server.Host,
            origin ?? Origin,
            extraHeaders ?? []);

    private static byte[] AuthenticatedRequest(
        CompanionLoopbackServer server,
        TestSession session,
        string method,
        string path,
        ulong sequence,
        byte[] body)
    {
        var headers = AuthenticatedHeaders(server, session, method, path, sequence, body);
        return method == "POST"
            ? RequestWithBody(server, method, path, body, server.Host, Origin, headers)
            : BasicRequest(server, method, path, headers);
    }

    private static IReadOnlyList<string> AuthenticatedHeaders(
        CompanionLoopbackServer server,
        TestSession session,
        string method,
        string path,
        ulong sequence,
        byte[] body)
    {
        var contentHash = CompanionLoopbackProtocol.Sha256Hex(body);
        var context = new CompanionRequestProofContext(
            InstallationId,
            ProcessInstanceId,
            session.SessionId,
            session.Epoch,
            sequence,
            method,
            server.Host,
            Origin,
            path,
            method == "POST" ? "application/json" : string.Empty,
            checked((ulong)body.Length),
            contentHash);
        return
        [
            $"X-TinyRustLM-Session: {session.SessionId}",
            $"X-TinyRustLM-Epoch: {session.Epoch.ToString(CultureInfo.InvariantCulture)}",
            $"X-TinyRustLM-Sequence: {sequence.ToString(CultureInfo.InvariantCulture)}",
            $"X-TinyRustLM-Content-SHA256: {contentHash}",
            $"X-TinyRustLM-Request-Proof: {CompanionLoopbackProtocol.ComputeRequestProof(session.Key, context)}"
        ];
    }

    private static byte[] RequestWithBodyAndLength(
        CompanionLoopbackServer server,
        string method,
        string path,
        byte[] body,
        string rawLength,
        IReadOnlyList<string> extraHeaders)
    {
        var lines = new List<string>
        {
            $"{method} {path} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}",
            "Content-Type: application/json",
            $"Content-Length: {rawLength}"
        };
        lines.AddRange(extraHeaders);
        lines.Add("Connection: close");
        lines.Add(string.Empty);
        lines.Add(string.Empty);
        var header = Encoding.ASCII.GetBytes(string.Join("\r\n", lines));
        var request = new byte[header.Length + body.Length];
        header.CopyTo(request, 0);
        body.CopyTo(request, header.Length);
        return request;
    }

    private static byte[] RequestWithBody(
        CompanionLoopbackServer server,
        string method,
        string path,
        byte[] body,
        string host,
        string origin,
        IReadOnlyList<string> extraHeaders)
    {
        var lines = new List<string>
        {
            $"{method} {path} HTTP/1.1",
            $"Host: {host}",
            $"Origin: {origin}",
            "Content-Type: application/json",
            $"Content-Length: {body.Length.ToString(CultureInfo.InvariantCulture)}"
        };
        lines.AddRange(extraHeaders);
        lines.Add("Connection: close");
        lines.Add(string.Empty);
        lines.Add(string.Empty);
        var header = Encoding.ASCII.GetBytes(string.Join("\r\n", lines));
        var request = new byte[header.Length + body.Length];
        header.CopyTo(request, 0);
        body.CopyTo(request, header.Length);
        return request;
    }

    private static byte[] BasicRequest(
        CompanionLoopbackServer server,
        string method,
        string path,
        IReadOnlyList<string> extraHeaders)
    {
        var lines = new List<string>
        {
            $"{method} {path} HTTP/1.1",
            $"Host: {server.Host}",
            $"Origin: {Origin}"
        };
        lines.AddRange(extraHeaders);
        lines.Add("Connection: close");
        lines.Add(string.Empty);
        lines.Add(string.Empty);
        return Encoding.ASCII.GetBytes(string.Join("\r\n", lines));
    }

    private static async Task<RawResponse> SendAsync(
        CompanionLoopbackServer server,
        byte[] request) =>
        await SendPossiblyParserRejectedAsync(server, request) ??
        throw new Xunit.Sdk.XunitException("The server closed without an HTTP response.");

    private static async Task<RawResponse?> SendPossiblyParserRejectedAsync(
        CompanionLoopbackServer server,
        byte[] request)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var client = new TcpClient(AddressFamily.InterNetwork);
        await client.ConnectAsync(IPAddress.Loopback, server.Port, timeout.Token);
        await using var stream = client.GetStream();
        await stream.WriteAsync(request, timeout.Token);
        await stream.FlushAsync(timeout.Token);

        using var response = new MemoryStream();
        var buffer = new byte[4_096];
        try
        {
            while (true)
            {
                var read = await stream.ReadAsync(buffer, timeout.Token);
                if (read == 0)
                {
                    break;
                }
                response.Write(buffer, 0, read);
            }
        }
        catch (IOException)
        {
            if (response.Length == 0)
            {
                return null;
            }
        }

        return response.Length == 0 ? null : RawResponse.Parse(response.ToArray());
    }

    private static void AssertError(
        RawResponse response,
        int status,
        string code,
        bool cors,
        bool proven)
    {
        Assert.Equal(status, response.Status);
        Assert.Equal(
            new CompanionLoopbackError(CompanionLoopbackWire.ErrorSchema, code),
            CompanionLoopbackWire.DecodeError(response.Body));
        Assert.Equal(cors, response.Headers.ContainsKey("Access-Control-Allow-Origin"));
        Assert.Equal(proven, response.Headers.ContainsKey("X-TinyRustLM-Response-Proof"));
        Assert.False(response.Headers.ContainsKey("Server"));
        Assert.Equal(response.Body.Length, ParseContentLength(response));
    }

    private static void AssertProven(
        CompanionLoopbackServer server,
        TestSession session,
        RawResponse response,
        string method,
        string path,
        ulong sequence,
        byte[]? proofKey = null)
    {
        Assert.Equal(session.SessionId, response.Header("X-TinyRustLM-Session"));
        Assert.Equal(
            session.Epoch.ToString(CultureInfo.InvariantCulture),
            response.Header("X-TinyRustLM-Epoch"));
        Assert.Equal(
            sequence.ToString(CultureInfo.InvariantCulture),
            response.Header("X-TinyRustLM-Sequence"));
        var contentHash = CompanionLoopbackProtocol.Sha256Hex(response.Body);
        Assert.Equal(contentHash, response.Header("X-TinyRustLM-Content-SHA256"));
        var metadataHash = response.Header("X-TinyRustLM-Response-Metadata-SHA256");
        var context = new CompanionResponseProofContext(
            InstallationId,
            ProcessInstanceId,
            session.SessionId,
            session.Epoch,
            sequence,
            method,
            path,
            response.Status,
            response.Header("Content-Type"),
            checked((ulong)response.Body.Length),
            metadataHash,
            contentHash);
        Assert.True(CompanionLoopbackProtocol.VerifyResponseProof(
            proofKey ?? session.Key,
            context,
            response.Header("X-TinyRustLM-Response-Proof")));
        Assert.Equal(server.Host, $"127.0.0.1:{server.Port}");
    }

    private static int ParseContentLength(RawResponse response) =>
        int.Parse(response.Header("Content-Length"), CultureInfo.InvariantCulture);

    private static ulong ParseUInt64Header(RawResponse response, string name) =>
        ulong.Parse(response.Header(name), CultureInfo.InvariantCulture);

    private sealed class RecordingOperationExecutor : ICompanionOperationExecutor
    {
        private readonly Func<string, Task> _ensureStarted;
        private readonly Func<string, string, Task> _cancelAndWait;

        internal RecordingOperationExecutor(
            Func<string, Task>? ensureStarted = null,
            Func<string, string, Task>? cancelAndWait = null)
        {
            _ensureStarted = ensureStarted ?? (_ => Task.CompletedTask);
            _cancelAndWait = cancelAndWait ?? ((_, _) => Task.CompletedTask);
        }

        internal int EnsureStartedCount { get; private set; }
        internal int CancelCount { get; private set; }
        internal List<string> CancellationIds { get; } = [];

        public Task EnsureStartedAsync(string operationId)
        {
            EnsureStartedCount++;
            return _ensureStarted(operationId);
        }

        public Task CancelAndWaitAsync(string operationId, string cancellationId)
        {
            CancelCount++;
            CancellationIds.Add(cancellationId);
            return _cancelAndWait(operationId, cancellationId);
        }
    }

    private sealed class TestSession : IDisposable
    {
        internal TestSession(string sessionId, uint epoch, byte[] key)
        {
            SessionId = sessionId;
            Epoch = epoch;
            Key = key;
        }

        internal string SessionId { get; }
        internal uint Epoch { get; private set; }
        internal byte[] Key { get; private set; }

        internal void ReplaceKey(ReadOnlySpan<byte> key, uint epoch)
        {
            CryptographicOperations.ZeroMemory(Key);
            Key = key.ToArray();
            Epoch = epoch;
        }

        public void Dispose()
        {
            CryptographicOperations.ZeroMemory(Key);
            Key = [];
        }
    }

    private sealed record RawResponse(
        int Status,
        IReadOnlyDictionary<string, string> Headers,
        byte[] Body)
    {
        internal string Header(string name) => Headers.TryGetValue(name, out var value)
            ? value
            : throw new Xunit.Sdk.XunitException($"Response header {name} is absent.");

        internal static RawResponse Parse(byte[] bytes)
        {
            ReadOnlySpan<byte> delimiter = "\r\n\r\n"u8;
            var headerEnd = bytes.AsSpan().IndexOf(delimiter);
            if (headerEnd < 0)
            {
                throw new Xunit.Sdk.XunitException("The response has no HTTP header terminator.");
            }
            var headerText = Encoding.ASCII.GetString(bytes, 0, headerEnd);
            var lines = headerText.Split("\r\n", StringSplitOptions.None);
            var statusParts = lines[0].Split(' ', 3, StringSplitOptions.None);
            if (statusParts.Length < 2 || statusParts[0] != "HTTP/1.1" ||
                !int.TryParse(statusParts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var status))
            {
                throw new Xunit.Sdk.XunitException("The response status line is invalid.");
            }
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var line in lines.Skip(1))
            {
                var separator = line.IndexOf(':');
                if (separator <= 0 || !headers.TryAdd(
                        line[..separator],
                        line[(separator + 1)..].TrimStart()))
                {
                    throw new Xunit.Sdk.XunitException("The response header set is invalid.");
                }
            }
            var bodyOffset = checked(headerEnd + delimiter.Length);
            return new RawResponse(status, headers, bytes[bodyOffset..]);
        }
    }
}
