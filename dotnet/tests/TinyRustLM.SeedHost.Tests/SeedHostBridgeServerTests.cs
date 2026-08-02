using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedHostBridgeServerTests
{
    private const string AllowedOrigin = "https://tinyrustlm.com";

    [Fact]
    public async Task PublicPackageConstructorStartsAndStopsInteractiveBridge()
    {
        var root = Path.Combine(Path.GetTempPath(), $"seed-bridge-public-{Guid.NewGuid():N}");
        try
        {
            await using var server = new SeedHostBridgeServer(new SeedHostBridgeOptions(
                root,
                [AllowedOrigin],
                Port: 0));
            await server.StartAsync();
            Assert.Equal("127.0.0.1", server.Endpoint.Host);
            var challenge = server.CreatePairingChallenge();
            Assert.False(string.IsNullOrWhiteSpace(challenge.Code));
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
    public async Task ServerBindsOnlyIpv4LoopbackAndEnforcesHostOriginProtocolAndCors()
    {
        await using var fixture = await BridgeFixture.StartAsync();
        Assert.Equal(IPAddress.Loopback, fixture.Server.Endpoint.Host is "127.0.0.1"
            ? IPAddress.Loopback
            : IPAddress.None);

        using var healthy = Request(HttpMethod.Get, "/v1/health");
        using var healthyResponse = await fixture.Client.SendAsync(healthy);
        Assert.Equal(HttpStatusCode.OK, healthyResponse.StatusCode);
        var health = await ReadJsonAsync(healthyResponse);
        Assert.Equal(1, health.RootElement.GetProperty("protocol_version").GetInt32());
        Assert.Equal("unpaired", health.RootElement.GetProperty("pairing_state").GetString());

        using var wrongHost = Request(HttpMethod.Get, "/v1/health");
        wrongHost.Headers.Host = "attacker.example";
        using var wrongHostResponse = await fixture.Client.SendAsync(wrongHost);
        Assert.Equal(HttpStatusCode.BadRequest, wrongHostResponse.StatusCode);
        Assert.Equal("bridge_host_denied", await ErrorCodeAsync(wrongHostResponse));

        using var wrongOrigin = Request(HttpMethod.Get, "/v1/health", "https://attacker.example");
        using var wrongOriginResponse = await fixture.Client.SendAsync(wrongOrigin);
        Assert.Equal(HttpStatusCode.Forbidden, wrongOriginResponse.StatusCode);
        Assert.Equal("bridge_origin_denied", await ErrorCodeAsync(wrongOriginResponse));

        using var missingVersion = new HttpRequestMessage(HttpMethod.Get, "/v1/health");
        missingVersion.Headers.TryAddWithoutValidation("Origin", AllowedOrigin);
        using var missingVersionResponse = await fixture.Client.SendAsync(missingVersion);
        Assert.Equal(HttpStatusCode.UpgradeRequired, missingVersionResponse.StatusCode);
        Assert.Equal("bridge_protocol_version_required", await ErrorCodeAsync(missingVersionResponse));

        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/v1/pair");
        preflight.Headers.TryAddWithoutValidation("Origin", AllowedOrigin);
        preflight.Headers.TryAddWithoutValidation("Access-Control-Request-Method", "POST");
        preflight.Headers.TryAddWithoutValidation(
            "Access-Control-Request-Headers",
            "content-type,x-tinyrustlm-bridge-version");
        preflight.Headers.TryAddWithoutValidation("Access-Control-Request-Private-Network", "true");
        using var preflightResponse = await fixture.Client.SendAsync(preflight);
        Assert.Equal(HttpStatusCode.NoContent, preflightResponse.StatusCode);
        Assert.Equal(AllowedOrigin, Header(preflightResponse, "Access-Control-Allow-Origin"));
        Assert.Equal("true", Header(preflightResponse, "Access-Control-Allow-Private-Network"));
        Assert.Equal("Origin", Header(preflightResponse, "Vary"));
    }

    [Fact]
    public async Task PairingIsSingleUseAndRevocationImmediatelyInvalidatesCapability()
    {
        await using var fixture = await BridgeFixture.StartAsync();
        var challenge = fixture.Server.CreatePairingChallenge();
        var pairBody = new
        {
            code = challenge.Code,
            requested_scopes = new[] { "status", "models_read" }
        };

        using var pairRequest = JsonRequest(HttpMethod.Post, "/v1/pair", pairBody);
        using var pairResponse = await fixture.Client.SendAsync(pairRequest);
        Assert.Equal(HttpStatusCode.OK, pairResponse.StatusCode);
        var pairJson = await ReadJsonAsync(pairResponse);
        var capability = pairJson.RootElement.GetProperty("capability").GetString();
        Assert.False(string.IsNullOrWhiteSpace(capability));
        Assert.DoesNotContain(challenge.Code, await pairResponse.Content.ReadAsStringAsync());

        using var replayRequest = JsonRequest(HttpMethod.Post, "/v1/pair", pairBody);
        using var replayResponse = await fixture.Client.SendAsync(replayRequest);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        Assert.Equal("bridge_pairing_code_consumed", await ErrorCodeAsync(replayResponse));

        using var statusRequest = AuthorizedRequest(HttpMethod.Get, "/v1/status", capability!);
        using var statusResponse = await fixture.Client.SendAsync(statusRequest);
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var status = await ReadJsonAsync(statusResponse);
        Assert.Equal(2u, status.RootElement.GetProperty("native_abi_version").GetUInt32());

        using var rotateRequest = AuthorizedRequest(
            HttpMethod.Post,
            "/v1/session/rotate",
            capability!,
            requestId: "rotate-1");
        rotateRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        using var rotateResponse = await fixture.Client.SendAsync(rotateRequest);
        Assert.Equal(HttpStatusCode.OK, rotateResponse.StatusCode);
        using var rotateJson = await ReadJsonAsync(rotateResponse);
        var rotatedCapability = rotateJson.RootElement.GetProperty("capability").GetString();
        Assert.False(string.IsNullOrWhiteSpace(rotatedCapability));
        Assert.NotEqual(capability, rotatedCapability);

        using var supersededRequest = AuthorizedRequest(HttpMethod.Get, "/v1/status", capability!);
        using var supersededResponse = await fixture.Client.SendAsync(supersededRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, supersededResponse.StatusCode);
        Assert.Equal("bridge_capability_revoked", await ErrorCodeAsync(supersededResponse));

        using var revokeRequest = AuthorizedRequest(
            HttpMethod.Post,
            "/v1/session/revoke",
            rotatedCapability!,
            requestId: "revoke-1");
        revokeRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        using var revokeResponse = await fixture.Client.SendAsync(revokeRequest);
        Assert.Equal(HttpStatusCode.NoContent, revokeResponse.StatusCode);

        using var revokedRequest = AuthorizedRequest(HttpMethod.Get, "/v1/status", rotatedCapability!);
        using var revokedResponse = await fixture.Client.SendAsync(revokedRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, revokedResponse.StatusCode);
        Assert.Equal("bridge_capability_revoked", await ErrorCodeAsync(revokedResponse));
    }

    [Fact]
    public async Task PairingRejectsMalformedChunkedAndOversizedBodiesWithoutEchoingSecrets()
    {
        await using var fixture = await BridgeFixture.StartAsync(maxRequestBytes: 512);
        var challenge = fixture.Server.CreatePairingChallenge();

        using var malformed = Request(HttpMethod.Post, "/v1/pair");
        malformed.Content = new StringContent("{not-json", Encoding.UTF8, "application/json");
        using var malformedResponse = await fixture.Client.SendAsync(malformed);
        Assert.Equal(HttpStatusCode.BadRequest, malformedResponse.StatusCode);
        Assert.Equal("bridge_json_invalid", await ErrorCodeAsync(malformedResponse));
        Assert.DoesNotContain(challenge.Code, await malformedResponse.Content.ReadAsStringAsync());

        using var chunked = Request(HttpMethod.Post, "/v1/pair");
        chunked.Headers.TransferEncodingChunked = true;
        chunked.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        chunked.Content.Headers.ContentLength = null;
        using var chunkedResponse = await fixture.Client.SendAsync(chunked);
        Assert.Equal(HttpStatusCode.LengthRequired, chunkedResponse.StatusCode);
        Assert.Equal("bridge_content_length_required", await ErrorCodeAsync(chunkedResponse));

        using var oversized = Request(HttpMethod.Post, "/v1/pair");
        oversized.Content = new StringContent(
            JsonSerializer.Serialize(new { code = new string('x', 600), requested_scopes = new[] { "status" } }),
            Encoding.UTF8,
            "application/json");
        using var oversizedResponse = await fixture.Client.SendAsync(oversized);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, oversizedResponse.StatusCode);
        Assert.Equal("bridge_request_too_large", await ErrorCodeAsync(oversizedResponse));
    }

    [Fact]
    public async Task ProductionRequestBudgetAcceptsRepresentativeLargeModelImportEnvelope()
    {
        var productionLimit = new SeedHostBridgeOptions(".", [AllowedOrigin]).MaximumRequestBytes;
        Assert.Equal(8 * 1024 * 1024, productionLimit);
        await using var fixture = await BridgeFixture.StartAsync(maxRequestBytes: productionLimit);
        var capability = await PairAsync(fixture, "imports_create");
        var body = new
        {
            manifest_text = new string('m', 136_737),
            peer_import_requests = new[] { new string('p', 8_192), new string('q', 8_192) }
        };
        using var request = AuthorizedRequest(
            HttpMethod.Post,
            "/v1/imports",
            capability,
            requestId: "large-import-1");
        request.Content = JsonBody(body);
        Assert.True(request.Content.Headers.ContentLength > 64 * 1024);

        using var response = await fixture.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(1, fixture.Operations.StartImportCount);
    }

    [Fact]
    public async Task ScopedImportRoutesAreReplaySafeAndStreamOnlyOperationApprovedBytes()
    {
        await using var fixture = await BridgeFixture.StartAsync();
        var capability = await PairAsync(
            fixture,
            "models_read",
            "imports_create",
            "imports_read",
            "imports_cancel",
            "models_stream");

        using var importRequest = AuthorizedRequest(
            HttpMethod.Post,
            "/v1/imports",
            capability,
            requestId: "import-request-1");
        importRequest.Content = JsonBody(new
        {
            manifest_text = "manifest",
            peer_import_requests = new[] { "{\"request\":\"peer\"}" }
        });
        using var importResponse = await fixture.Client.SendAsync(importRequest);
        Assert.Equal(HttpStatusCode.Accepted, importResponse.StatusCode);
        using var importJson = await ReadJsonAsync(importResponse);
        Assert.Equal("import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            importJson.RootElement.GetProperty("operation_id").GetString());

        using var replayRequest = AuthorizedRequest(
            HttpMethod.Post,
            "/v1/imports",
            capability,
            requestId: "import-request-1");
        replayRequest.Content = JsonBody(new
        {
            manifest_text = "manifest",
            peer_import_requests = new[] { "{\"request\":\"peer\"}" }
        });
        using var replayResponse = await fixture.Client.SendAsync(replayRequest);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        Assert.Equal("bridge_request_replay", await ErrorCodeAsync(replayResponse));
        Assert.Equal(1, fixture.Operations.StartImportCount);

        var operationId = fixture.Operations.Status.OperationId;
        using var statusRequest = AuthorizedRequest(
            HttpMethod.Get,
            $"/v1/imports/{operationId}",
            capability);
        using var statusResponse = await fixture.Client.SendAsync(statusRequest);
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);

        using var modelsRequest = AuthorizedRequest(HttpMethod.Get, "/v1/models", capability);
        using var modelsResponse = await fixture.Client.SendAsync(modelsRequest);
        Assert.Equal(HttpStatusCode.OK, modelsResponse.StatusCode);
        using var modelsJson = await ReadJsonAsync(modelsResponse);
        Assert.Single(modelsJson.RootElement.GetProperty("models").EnumerateArray());

        using var rangedRequest = AuthorizedRequest(
            HttpMethod.Get,
            $"/v1/models/{operationId}/content",
            capability);
        rangedRequest.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 1);
        using var rangedResponse = await fixture.Client.SendAsync(rangedRequest);
        Assert.Equal(HttpStatusCode.RequestedRangeNotSatisfiable, rangedResponse.StatusCode);
        Assert.Equal(0, fixture.Operations.OpenModelCount);

        using var contentRequest = AuthorizedRequest(
            HttpMethod.Get,
            $"/v1/models/{operationId}/content",
            capability);
        using var contentResponse = await fixture.Client.SendAsync(
            contentRequest,
            HttpCompletionOption.ResponseHeadersRead);
        Assert.Equal(HttpStatusCode.OK, contentResponse.StatusCode);
        Assert.Equal("application/octet-stream", contentResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal(fixture.Operations.ModelBytes.Length, contentResponse.Content.Headers.ContentLength);
        Assert.Equal(
            "Content-Length, X-TinyRustLM-Model-Id, X-TinyRustLM-Artifact-Sha256",
            Header(contentResponse, "Access-Control-Expose-Headers"));
        Assert.Equal("sha256:artifact", Header(contentResponse, "X-TinyRustLM-Artifact-Sha256"));
        Assert.Equal(fixture.Operations.ModelBytes, await contentResponse.Content.ReadAsByteArrayAsync());
        Assert.Equal(1, fixture.Operations.OpenModelCount);
    }

    [Fact]
    public async Task SharingRequiresHostOptInDedicatedScopeAndReplaySafeClosedActions()
    {
        await using (var disabled = await BridgeFixture.StartAsync())
        {
            var challenge = disabled.Server.CreatePairingChallenge();
            using var request = JsonRequest(HttpMethod.Post, "/v1/pair", new
            {
                code = challenge.Code,
                requested_scopes = new[] { "status", "sharing_manage" }
            });
            using var response = await disabled.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("bridge_scope_not_granted", await ErrorCodeAsync(response));
        }

        await using var fixture = await BridgeFixture.StartAsync(allowSharing: true);
        var readOnlyCapability = await PairAsync(fixture, "status");
        using (var deniedRequest = AuthorizedRequest(
            HttpMethod.Get,
            "/v1/sharing",
            readOnlyCapability))
        using (var deniedResponse = await fixture.Client.SendAsync(deniedRequest))
        {
            Assert.Equal(HttpStatusCode.Forbidden, deniedResponse.StatusCode);
            Assert.Equal("bridge_scope_denied", await ErrorCodeAsync(deniedResponse));
        }

        var capability = await PairAsync(fixture, "status", "sharing_manage");
        using (var statusRequest = AuthorizedRequest(HttpMethod.Get, "/v1/sharing", capability))
        using (var statusResponse = await fixture.Client.SendAsync(statusRequest))
        {
            Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
            using var status = await ReadJsonAsync(statusResponse);
            Assert.True(status.RootElement.GetProperty("sharing_enabled").GetBoolean());
            Assert.False(status.RootElement.GetProperty("initialized").GetBoolean());
        }

        using (var initializeRequest = AuthorizedRequest(
            HttpMethod.Post,
            "/v1/sharing/initialize",
            capability,
            requestId: "sharing-initialize-1"))
        {
            initializeRequest.Content = JsonBody(new { fleet_id = "browser-seed-fleet" });
            using var initializeResponse = await fixture.Client.SendAsync(initializeRequest);
            Assert.Equal(HttpStatusCode.OK, initializeResponse.StatusCode);
        }

        var operationId = fixture.Operations.Status.OperationId;
        var admissionBody = new
        {
            lane_endpoints = new[]
            {
                new { lane_id = "seed-a", bind_address = "0.0.0.0:18123", public_base_url = "http://peer.example:18123/model/" },
                new { lane_id = "seed-b", bind_address = "0.0.0.0:18124", public_base_url = "http://peer.example:18124/model/" }
            }
        };
        using (var admitRequest = AuthorizedRequest(
            HttpMethod.Post,
            $"/v1/sharing/imports/{operationId}/admit",
            capability,
            requestId: "sharing-admit-1"))
        {
            admitRequest.Content = JsonBody(admissionBody);
            using var admitResponse = await fixture.Client.SendAsync(admitRequest);
            Assert.Equal(HttpStatusCode.OK, admitResponse.StatusCode);
            Assert.DoesNotContain("public_base_url", await admitResponse.Content.ReadAsStringAsync());
            Assert.DoesNotContain("manifest", await admitResponse.Content.ReadAsStringAsync());
        }

        using (var replayRequest = AuthorizedRequest(
            HttpMethod.Post,
            $"/v1/sharing/imports/{operationId}/admit",
            capability,
            requestId: "sharing-admit-1"))
        {
            replayRequest.Content = JsonBody(admissionBody);
            using var replayResponse = await fixture.Client.SendAsync(replayRequest);
            Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
            Assert.Equal("bridge_request_replay", await ErrorCodeAsync(replayResponse));
        }

        using (var enableRequest = AuthorizedRequest(
            HttpMethod.Post,
            $"/v1/sharing/imports/{operationId}/enable",
            capability,
            requestId: "sharing-enable-1"))
        {
            enableRequest.Content = JsonBody(new { });
            using var enableResponse = await fixture.Client.SendAsync(enableRequest);
            Assert.Equal(HttpStatusCode.OK, enableResponse.StatusCode);
        }
        Assert.Equal(1, fixture.Operations.InitializeSharingCount);
        Assert.Equal(1, fixture.Operations.AdmitSharingCount);
        Assert.Equal(1, fixture.Operations.EnableSharingCount);
    }

    private static async Task<string> PairAsync(BridgeFixture fixture, params string[] scopes)
    {
        var challenge = fixture.Server.CreatePairingChallenge();
        using var request = JsonRequest(HttpMethod.Post, "/v1/pair", new
        {
            code = challenge.Code,
            requested_scopes = scopes
        });
        using var response = await fixture.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = await ReadJsonAsync(response);
        return json.RootElement.GetProperty("capability").GetString()!;
    }

    private static HttpRequestMessage Request(
        HttpMethod method,
        string path,
        string origin = AllowedOrigin)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.TryAddWithoutValidation("Origin", origin);
        request.Headers.TryAddWithoutValidation("X-TinyRustLM-Bridge-Version", "1");
        return request;
    }

    private static HttpRequestMessage JsonRequest(HttpMethod method, string path, object body)
    {
        var request = Request(method, path);
        request.Content = JsonBody(body);
        return request;
    }

    private static HttpContent JsonBody(object body) => new StringContent(
        JsonSerializer.Serialize(body),
        Encoding.UTF8,
        "application/json");

    private static HttpRequestMessage AuthorizedRequest(
        HttpMethod method,
        string path,
        string capability,
        string? requestId = null)
    {
        var request = Request(method, path);
        request.Headers.TryAddWithoutValidation(
            "X-TinyRustLM-Bridge-Capability",
            capability);
        if (requestId is not null)
        {
            request.Headers.TryAddWithoutValidation(
                "X-TinyRustLM-Bridge-Request-Id",
                requestId);
        }
        return request;
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync());

    private static async Task<string> ErrorCodeAsync(HttpResponseMessage response)
    {
        using var json = await ReadJsonAsync(response);
        return json.RootElement.GetProperty("error").GetProperty("code").GetString()!;
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
            ? Assert.Single(values)
            : throw new Xunit.Sdk.XunitException($"Response header '{name}' was missing.");

    private sealed class BridgeFixture : IAsyncDisposable
    {
        private BridgeFixture(
            SeedHostBridgeServer server,
            HttpClient client,
            string root,
            StubBridgeOperations operations)
        {
            Server = server;
            Client = client;
            Root = root;
            Operations = operations;
        }

        internal SeedHostBridgeServer Server { get; }
        internal HttpClient Client { get; }
        internal StubBridgeOperations Operations { get; }
        private string Root { get; }

        internal static async Task<BridgeFixture> StartAsync(
            int maxRequestBytes = 16 * 1024,
            bool allowSharing = false)
        {
            var root = Path.Combine(Path.GetTempPath(), $"seed-bridge-http-{Guid.NewGuid():N}");
            var operations = new StubBridgeOperations();
            var server = new SeedHostBridgeServer(
                new SeedHostBridgeOptions(
                    root,
                    [AllowedOrigin],
                    Port: 0,
                    MaximumRequestBytes: maxRequestBytes,
                    AllowSharing: allowSharing),
                operations);
            await server.StartAsync();
            return new BridgeFixture(
                server,
                new HttpClient { BaseAddress = server.Endpoint, Timeout = TimeSpan.FromSeconds(5) },
                root,
                operations);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Server.DisposeAsync();
            if (Directory.Exists(Root))
            {
                Directory.Delete(Root, recursive: true);
            }
        }
    }

    private sealed class StubBridgeOperations :
        ISeedHostBridgeOperations,
        ISeedHostBridgeSharingOperations
    {
        internal byte[] ModelBytes { get; } = [0x53, 0x4c, 0x4d, 0x31, 1, 2, 3, 4];
        internal int StartImportCount { get; private set; }
        internal int OpenModelCount { get; private set; }
        internal int InitializeSharingCount { get; private set; }
        internal int AdmitSharingCount { get; private set; }
        internal int EnableSharingCount { get; private set; }
        internal SeedHostBridgeImportStatus Status { get; } = new(
            "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            SeedHostBridgeImportState.Available,
            "example/conversation-model",
            8,
            1,
            1,
            0,
            0,
            0,
            false,
            "sha256:artifact",
            false,
            null,
            DateTimeOffset.UnixEpoch,
            DateTimeOffset.UnixEpoch);

        public uint NativeAbiVersion => 2;

        public ValueTask<SeedHostBridgeRuntimeStatus> GetStatusAsync(
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return ValueTask.FromResult(new SeedHostBridgeRuntimeStatus(
                "ready",
                NativeAbiVersion,
                ModelCount: 0,
                ActiveImportCount: 0,
                SharingEnabled: false));
        }

        public ValueTask<SeedHostBridgeImportStatus> StartImportAsync(
            SeedHostBridgeImportSubmission submission,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            StartImportCount++;
            return ValueTask.FromResult(Status);
        }

        public ValueTask<SeedHostBridgeImportStatus> GetImportAsync(
            string operationId,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(Status.OperationId, operationId);
            return ValueTask.FromResult(Status);
        }

        public ValueTask<SeedHostBridgeImportStatus> CancelImportAsync(
            string operationId,
            CancellationToken cancellationToken = default) =>
            GetImportAsync(operationId, cancellationToken);

        public ValueTask<IReadOnlyList<SeedHostBridgeModelInfo>> ListModelsAsync(
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return ValueTask.FromResult<IReadOnlyList<SeedHostBridgeModelInfo>>
            ([new(
                Status.OperationId,
                Status.ModelId!,
                Status.ArtifactByteCount,
                Status.ArtifactSha256!,
                Status.VerifiedPieceCount)]);
        }

        public ValueTask<SeedHostBridgeModelContent> OpenModelAsync(
            string operationId,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(Status.OperationId, operationId);
            OpenModelCount++;
            return ValueTask.FromResult(new SeedHostBridgeModelContent(
                new MemoryStream(ModelBytes, writable: false),
                Status.ModelId!,
                ModelBytes.Length,
                Status.ArtifactSha256!));
        }

        public ValueTask<SeedHostBridgeSharingStatus> GetSharingAsync(
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return ValueTask.FromResult(SharingStatus(InitializeSharingCount > 0));
        }

        public ValueTask<SeedHostBridgeSharingStatus> InitializeSharingAsync(
            string fleetId,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal("browser-seed-fleet", fleetId);
            InitializeSharingCount++;
            return ValueTask.FromResult(SharingStatus(initialized: true));
        }

        public ValueTask<SeedHostBridgeSharingStatus> AdmitImportForSharingAsync(
            string operationId,
            IReadOnlyList<SeedLaneAdmissionEndpoint> laneEndpoints,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(Status.OperationId, operationId);
            Assert.Equal(2, laneEndpoints.Count);
            Assert.Equal(["seed-a", "seed-b"], laneEndpoints.Select(value => value.LaneId));
            AdmitSharingCount++;
            return ValueTask.FromResult(SharingStatus(initialized: true, admitted: true));
        }

        public ValueTask<SeedHostBridgeSharingStatus> SetImportSharingEnabledAsync(
            string operationId,
            bool enabled,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(Status.OperationId, operationId);
            Assert.True(enabled);
            EnableSharingCount++;
            return ValueTask.FromResult(SharingStatus(initialized: true, admitted: true, enabled: true));
        }

        public ValueTask<SeedHostBridgeSharingStatus> RemoveImportFromSharingAsync(
            string operationId,
            CancellationToken cancellationToken = default) =>
            ValueTask.FromResult(SharingStatus(initialized: true));

        private SeedHostBridgeSharingStatus SharingStatus(
            bool initialized,
            bool admitted = false,
            bool enabled = false) => new(
                SharingEnabled: true,
                Initialized: initialized,
                FleetId: initialized ? "browser-seed-fleet" : null,
                TargetModelCount: 20,
                AdmittedModelCount: admitted ? 1 : 0,
                RemainingModelCapacity: admitted ? 19 : 20,
                ReplicaLaneCount: 2,
                AdvertisementStatus: "external-proof-required",
                Models: admitted
                    ? [new(Status.OperationId, Status.ModelId!, enabled, "external-proof-required")]
                    : []);

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
