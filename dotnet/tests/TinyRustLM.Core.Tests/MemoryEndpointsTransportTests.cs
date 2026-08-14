using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class MemoryEndpointsTransportTests
{
    [Fact]
    public void CanonicalMutationIsStableAndBodyBound()
    {
        var raw = Mutation();
        var canonical = MemoryEndpointsDistributedSyncTransport.CanonicalizeHostedRevisionMutation(raw);

        Assert.Equal("syncrev-parent", canonical.ParentRevisionId);
        Assert.Equal("goal", canonical.Scope);
        Assert.Equal(
            "10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f",
            canonical.BodyHash);
        Assert.Equal(
            "fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445",
            MemoryEndpointsDistributedSyncTransport.ComputeHostedRevisionMutationFingerprint(raw));
        Assert.Equal(
            MemoryEndpointsDistributedSyncTransport.ComputeHostedRevisionMutationFingerprint(raw),
            MemoryEndpointsDistributedSyncTransport.ComputeHostedRevisionMutationFingerprint(canonical));
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncTransport.ValidateIdempotencyKey("Bearer secret"));
    }

    [Fact]
    public void TypedResponsesRequireExplicitStatusCheckpointAndRedaction()
    {
        var applied = MemoryEndpointsDistributedSyncTransport.ParseRevisionDecisionResponse(
            DecisionJson("applied", string.Empty, 7, includeRevision: true, appliedHead: true));
        Assert.Equal(MemoryEndpointsHostedSyncStatus.Applied, applied.Status);
        Assert.True(applied.Confirmation.Persisted);

        var conflict = MemoryEndpointsDistributedSyncTransport.ParseRevisionDecisionResponse(
            DecisionJson("conflict", "parent_revision_mismatch", 8, includeRevision: true, appliedHead: false));
        Assert.Equal(MemoryEndpointsHostedSyncStatus.Conflict, conflict.Status);

        var rejected = MemoryEndpointsDistributedSyncTransport.ParseRevisionDecisionResponse(
            DecisionJson("rejected", "device_revoked", 0, includeRevision: false, appliedHead: false));
        Assert.Equal(MemoryEndpointsHostedSyncStatus.Rejected, rejected.Status);
        Assert.Null(rejected.Revision);

        var page = ChangePageJson(6, 7);
        Assert.Equal(
            (ulong)7,
            MemoryEndpointsDistributedSyncTransport.ParseChangePage(page, 6).Changes.NextAfterSequence);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncTransport.ParseChangePage(page, 5));
    }

    [Fact]
    public async Task ClientUsesProductionRoutesHeadersAndAuthoritativeIdentity()
    {
        var handler = new DistributedSyncHandler();
        var connector = CreateClient(handler);

        Assert.Equal(
            MemoryEndpointsDistributedSyncAvailabilityStatus.Live,
            (await connector.ProbeDistributedSyncAsync()).Status);
        var registered = await connector.RegisterSyncDeviceAsync(
            RegisterRequest(),
            "device-register-1");
        Assert.Equal((ulong)1, registered.Device.AuthorityEpoch);

        var decision = await connector.SubmitRevisionMutationAsync(Mutation(), "mutation-1");
        Assert.Equal(MemoryEndpointsHostedSyncStatus.Applied, decision.Status);

        var receipt = await connector.LookupRevisionReceiptAsync(new MemoryEndpointsReceiptLookupRequest(
            "mutation-1",
            "logical-memory-a",
            CanonicalMutation().BodyHash));
        Assert.NotNull(receipt);

        var changes = await connector.PullRevisionChangesAsync(6, 50);
        Assert.Equal((ulong)7, changes.NextAfterSequence);
        Assert.Single(changes.Items);

        var heads = await connector.ReadRevisionHeadsAsync("logical-memory-a");
        Assert.Equal("syncrev-applied", heads.Items[0].HeadRevisionId);

        var rotated = await connector.RotateSyncDeviceAsync(
            new MemoryEndpointsRotateDeviceRequest(
                "workspace-fixture",
                "tinyrustlm-agent",
                "device-a"),
            "device-rotate-1");
        Assert.Equal((ulong)2, rotated.Device.AuthorityEpoch);

        var revoked = await connector.RevokeSyncDeviceAsync(
            new MemoryEndpointsRevokeDeviceRequest(
                "workspace-fixture",
                "tinyrustlm-agent",
                "device-a"),
            "device-revoke-1");
        Assert.Equal(MemoryEndpointsHostedDeviceStatus.Revoked, revoked.Device.Status);

        var retention = await connector.GetSyncRetentionPolicyAsync();
        Assert.False(retention.Policy.HardForgetSupported);

        var probe = Assert.Single(handler.Requests, item => item.Uri.AbsolutePath.EndsWith("/capabilities"));
        Assert.Equal(string.Empty, probe.Authorization);
        Assert.All(handler.Requests.Where(item => !item.Uri.AbsolutePath.EndsWith("/capabilities")), item =>
        {
            Assert.Equal("Bearer session-only-test-value", item.Authorization);
            Assert.DoesNotContain("session-only-test-value", item.Uri.ToString(), StringComparison.Ordinal);
            Assert.DoesNotContain("session-only-test-value", item.Body, StringComparison.Ordinal);
        });
        var lookup = Assert.Single(handler.Requests, item => item.Uri.AbsolutePath.EndsWith("/receipts"));
        Assert.Equal(HttpMethod.Get, lookup.Method);
        Assert.Equal("mutation-1", lookup.IdempotencyKey);
        Assert.DoesNotContain("mutation-1", lookup.Uri.ToString(), StringComparison.Ordinal);
        Assert.Contains("after_sequence=6", Assert.Single(
            handler.Requests,
            item => item.Uri.AbsolutePath.EndsWith("/changes")).Uri.Query);
    }

    [Fact]
    public async Task ClientFailsClosedBeforeProbeAndOnNestedSafeNoOpFailure()
    {
        var unprobed = CreateClient(new DistributedSyncHandler());
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            unprobed.SubmitRevisionMutationAsync(Mutation(), "mutation-1"));

        var rejectedHandler = new DistributedSyncHandler(rejectIdempotency: true);
        var rejectedClient = CreateClient(rejectedHandler);
        Assert.Equal(
            MemoryEndpointsDistributedSyncAvailabilityStatus.Live,
            (await rejectedClient.ProbeDistributedSyncAsync()).Status);
        var error = await Assert.ThrowsAsync<MemoryEndpointsDistributedSyncException>(() =>
            rejectedClient.SubmitRevisionMutationAsync(Mutation(), "mutation-1"));
        Assert.Equal(HttpStatusCode.Conflict, error.StatusCode);
        Assert.Equal("idempotency_conflict", error.ErrorCode);
        Assert.True(error.SafeNoOp);
    }

    [Fact]
    public void UnknownFieldsAndExposedKeysAreRejected()
    {
        var decision = DecisionJson("applied", string.Empty, 7, includeRevision: true, appliedHead: true);
        var unknown = decision.Replace(
            "\"persisted\":true",
            "\"persisted\":true,\"silentLastWriteWins\":true",
            StringComparison.Ordinal);
        Assert.Throws<JsonException>(() =>
            MemoryEndpointsDistributedSyncTransport.ParseRevisionDecisionResponse(unknown));

        var exposed = decision.Replace(
            "\"idempotencyKeyExposed\":false",
            "\"idempotencyKeyExposed\":true",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncTransport.ParseRevisionDecisionResponse(exposed));
    }

    private static TinyRustLmMemoryEndpointsClient CreateClient(HttpMessageHandler handler) =>
        new(
            new MemoryEndpointsClientOptions(
                "workspace-fixture",
                "session-only-test-value",
                MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memoryendpoints.example"))),
            new HttpClient(handler));

    private static MemoryEndpointsRegisterDeviceRequest RegisterRequest() =>
        new(
            "workspace-fixture",
            "tinyrustlm-agent",
            "device-a",
            "TinyRustLM test device");

    private static MemoryEndpointsHostedRevisionMutation Mutation() =>
        new(
            " workspace-fixture ",
            " tinyrustlm-agent ",
            " device-a ",
            1,
            " logical-memory-a ",
            MemoryEndpointsHostedSyncOperation.Upsert,
            " syncrev-parent ",
            " Durable TinyRustLM memory ",
            "Public-safe durable memory.",
            " tinyrustlm://offline-sync/test ",
            " Goal ",
            " goal-tinyrustlm-hosted-memory ",
            " Handoff ",
            string.Empty);

    private static MemoryEndpointsHostedRevisionMutation CanonicalMutation() =>
        MemoryEndpointsDistributedSyncTransport.CanonicalizeHostedRevisionMutation(Mutation());

    private static string DecisionJson(
        string status,
        string conflictCode,
        ulong serverSequence,
        bool includeRevision,
        bool appliedHead)
    {
        var conflict = status == "conflict";
        var applied = status == "applied";
        var revision = includeRevision
            ? Revision(status, conflictCode, serverSequence)
            : null;
        var head = appliedHead || conflict
            ? Head(applied ? serverSequence : 7)
            : null;
        var revisionId = includeRevision ? $"syncrev-{status}" : string.Empty;
        return JsonSerializer.Serialize(new
        {
            ok = applied,
            persisted = true,
            receipt = Receipt(status, conflictCode, serverSequence, revisionId),
            revision,
            head,
            serverSequence,
            indexedThroughSequence = serverSequence == 0 ? 7UL : serverSequence,
            conflict,
            status,
            operatorSummary = OperatorSummary("mutation", status, conflictCode, serverSequence),
            receiptQueryUrl = $"/api/matm/sync/receipts?workspace_id=workspace-fixture&receipt_id=syncreceipt-{status}",
            changesQueryUrl = $"/api/matm/sync/changes?workspace_id=workspace-fixture&after_sequence={Math.Max(0, (long)serverSequence - 1)}",
            headsQueryUrl = "/api/matm/sync/heads?workspace_id=workspace-fixture&logical_memory_id=logical-memory-a",
            capabilityRoute = "/api/matm/sync/capabilities",
            confirmation = new
            {
                schemaVersion = "memoryendpoints.sync_mutation_confirmation.v1",
                persisted = true,
                receiptVisible = true,
                revisionVisibleInChanges = true,
                headVisible = true,
                changesCount = includeRevision ? 1 : 0,
                headsCount = appliedHead ? 1 : 0,
                receiptId = $"syncreceipt-{status}",
                revisionId,
                logicalMemoryId = "logical-memory-a",
                indexedThroughSequence = serverSequence == 0 ? 7UL : serverSequence,
                valuesRedacted = true,
                rawCredentialExposed = false,
                rawPayloadExposed = false
            },
            valuesRedacted = true,
            rawCredentialExposed = false,
            rawPayloadExposed = false
        });
    }

    private static object Receipt(
        string status,
        string conflictCode,
        ulong serverSequence,
        string revisionId) => new
    {
        receiptId = $"syncreceipt-{status}",
        workspaceId = "workspace-fixture",
        idempotencyKeyHash = $"sha256:{Sha256("mutation-1")}",
        bodyHash = CanonicalMutation().BodyHash,
        logicalMemoryId = "logical-memory-a",
        syncRevisionId = revisionId,
        serverSequence,
        status,
        conflict = status == "conflict",
        conflictCode,
        currentHeadRevisionId = status == "applied" ? "syncrev-parent" : "syncrev-current",
        httpStatus = status == "applied" ? "202 Accepted" : "409 Conflict",
        createdAt = "2026-07-10T22:01:00Z",
        idempotencyKeyExposed = false,
        valuesRedacted = true,
        rawCredentialExposed = false,
        rawPayloadExposed = false
    };

    private static object Revision(string status, string conflictCode, ulong serverSequence) => new
    {
        syncRevisionId = $"syncrev-{status}",
        workspaceId = "workspace-fixture",
        logicalMemoryId = "logical-memory-a",
        parentRevisionId = "syncrev-parent",
        memoryEventId = string.Empty,
        actorAgentId = "tinyrustlm-agent",
        deviceId = "device-a",
        deviceEpoch = 1,
        operation = "upsert",
        status,
        conflict = status == "conflict",
        conflictCode,
        serverSequence,
        bodyHash = CanonicalMutation().BodyHash,
        source = "tinyrustlm://offline-sync/test",
        title = "Durable TinyRustLM memory",
        summary = "Public-safe durable memory.",
        scope = "goal",
        scopeId = "goal-tinyrustlm-hosted-memory",
        memoryType = "handoff",
        tombstone = false,
        createdAt = "2026-07-10T22:01:00Z",
        valuesRedacted = true,
        rawPayloadExposed = false
    };

    private static object Head(ulong serverSequence) => new
    {
        logicalMemoryId = "logical-memory-a",
        workspaceId = "workspace-fixture",
        headRevisionId = serverSequence == 7 ? "syncrev-applied" : "syncrev-current",
        serverSequence,
        indexedThroughSequence = serverSequence,
        status = "active",
        updatedAt = "2026-07-10T22:01:00Z",
        valuesRedacted = true,
        rawPayloadExposed = false
    };

    private static object OperatorSummary(
        string action,
        string status,
        string conflictCode,
        ulong sequence) => new
    {
        schemaVersion = "memoryendpoints.sync_operator_summary.v1",
        action,
        status,
        serverSequence = sequence,
        conflict = status == "conflict",
        conflictCode,
        persisted = true,
        valuesRedacted = true,
        rawCredentialExposed = false,
        rawPayloadExposed = false
    };

    private static string ChangePageJson(ulong afterSequence, ulong nextSequence) =>
        JsonSerializer.Serialize(new
        {
            ok = true,
            changes = new
            {
                items = new[] { Revision("applied", string.Empty, nextSequence) },
                count = 1,
                hasMore = false,
                nextAfterSequence = nextSequence,
                indexedThroughSequence = nextSequence,
                checkpoint = new
                {
                    workspaceIdHash = $"sha256:{Sha256("workspace-fixture")}",
                    afterSequence,
                    nextAfterSequence = nextSequence,
                    valuesRedacted = true
                },
                valuesRedacted = true,
                rawCredentialExposed = false,
                rawPayloadExposed = false
            },
            valuesRedacted = true,
            rawCredentialExposed = false,
            rawPayloadExposed = false
        });

    private static string HeadsJson() => JsonSerializer.Serialize(new
    {
        ok = true,
        items = new[] { Head(7) },
        count = 1,
        filters = new { logicalMemoryId = "logical-memory-a" },
        valuesRedacted = true,
        rawCredentialExposed = false,
        rawPayloadExposed = false
    });

    private static string DeviceJson(string action, ulong epoch, string status) => JsonSerializer.Serialize(new
    {
        ok = true,
        persisted = true,
        visibleToAgent = true,
        deviceAuthorityPersisted = true,
        canonicalWorkspaceId = "workspace-fixture",
        canonicalDeviceId = "device-a",
        device = new
        {
            deviceId = "device-a",
            workspaceId = "workspace-fixture",
            agentId = "tinyrustlm-agent",
            label = "TinyRustLM test device",
            status,
            authorityEpoch = epoch,
            createdAt = "2026-07-10T22:00:00Z",
            updatedAt = "2026-07-10T22:01:00Z",
            revokedAt = status == "revoked" ? "2026-07-10T22:01:00Z" : null,
            valuesRedacted = true,
            rawPayloadExposed = false
        },
        capabilityRoute = "/api/matm/sync/capabilities",
        operatorSummary = new
        {
            schemaVersion = "memoryendpoints.sync_device_operator_summary.v1",
            action,
            deviceId = "device-a",
            status,
            authorityEpoch = epoch,
            persisted = true,
            valuesRedacted = true,
            rawCredentialExposed = false,
            rawPayloadExposed = false
        },
        valuesRedacted = true,
        rawCredentialExposed = false,
        rawPayloadExposed = false
    });

    private static string ReceiptLookupJson()
    {
        using var decision = JsonDocument.Parse(
            DecisionJson("applied", string.Empty, 7, includeRevision: true, appliedHead: true));
        return JsonSerializer.Serialize(new
        {
            ok = true,
            receipt = decision.RootElement.GetProperty("receipt"),
            operatorSummary = OperatorSummary("receipt", "applied", string.Empty, 7),
            valuesRedacted = true,
            rawCredentialExposed = false,
            rawPayloadExposed = false
        });
    }

    private static string RetentionJson()
    {
        using var capabilities = JsonDocument.Parse(ExampleCapabilities());
        return JsonSerializer.Serialize(new
        {
            ok = true,
            policy = new
            {
                schemaVersion = "memoryendpoints.sync_retention.v1",
                tombstoneRetentionDays = 30,
                hardForgetSupported = false,
                hardForgetBehavior = "safe_rejected_receipt",
                rawPrivatePayloadStored = false,
                valuesRedacted = true,
                rawCredentialExposed = false,
                rawPayloadExposed = false
            },
            capabilities = capabilities.RootElement.GetProperty("data"),
            valuesRedacted = true,
            rawCredentialExposed = false,
            rawPayloadExposed = false
        });
    }

    private static string ExampleCapabilities()
        => TestFixtureFiles.ReadText(
            "memoryendpoints-distributed-sync-capabilities-v1.example.json");

    private static string Sha256(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private sealed class DistributedSyncHandler(bool rejectIdempotency = false) : HttpMessageHandler
    {
        public List<RecordedRequest> Requests { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var body = request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Add(new RecordedRequest(
                request.Method,
                request.RequestUri!,
                request.Headers.Authorization?.ToString() ?? string.Empty,
                request.Headers.TryGetValues("Idempotency-Key", out var values)
                    ? values.Single()
                    : string.Empty,
                body));

            var path = request.RequestUri!.AbsolutePath;
            var status = HttpStatusCode.OK;
            string responseBody;
            if (path.EndsWith("/capabilities", StringComparison.Ordinal))
            {
                responseBody = ExampleCapabilities();
            }
            else if (path.EndsWith("/mutations", StringComparison.Ordinal) && rejectIdempotency)
            {
                status = HttpStatusCode.Conflict;
                responseBody = JsonSerializer.Serialize(new
                {
                    ok = false,
                    safeNoOp = true,
                    valuesRedacted = true,
                    rawCredentialExposed = false,
                    rawPayloadExposed = false,
                    error = new
                    {
                        code = "idempotency_conflict",
                        title = "Idempotency conflict",
                        detail = "The same key was reused with another body.",
                        safeNoOp = true,
                        valuesRedacted = true
                    }
                });
            }
            else if (path.EndsWith("/mutations", StringComparison.Ordinal))
            {
                status = HttpStatusCode.Accepted;
                responseBody = DecisionJson("applied", string.Empty, 7, true, true);
            }
            else if (path.EndsWith("/receipts", StringComparison.Ordinal))
            {
                responseBody = ReceiptLookupJson();
            }
            else if (path.EndsWith("/changes", StringComparison.Ordinal))
            {
                responseBody = ChangePageJson(6, 7);
            }
            else if (path.EndsWith("/heads", StringComparison.Ordinal))
            {
                responseBody = HeadsJson();
            }
            else if (path.EndsWith("/devices", StringComparison.Ordinal))
            {
                status = HttpStatusCode.Created;
                responseBody = DeviceJson("register", 1, "active");
            }
            else if (path.EndsWith("/devices/rotate", StringComparison.Ordinal))
            {
                responseBody = DeviceJson("rotate", 2, "active");
            }
            else if (path.EndsWith("/devices/revoke", StringComparison.Ordinal))
            {
                responseBody = DeviceJson("revoke", 2, "revoked");
            }
            else if (path.EndsWith("/retention", StringComparison.Ordinal))
            {
                responseBody = RetentionJson();
            }
            else
            {
                status = HttpStatusCode.NotFound;
                responseBody = "{}";
            }

            var response = new HttpResponseMessage(status)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            };
            response.Headers.CacheControl = new CacheControlHeaderValue { NoStore = true };
            return response;
        }
    }

    private sealed record RecordedRequest(
        HttpMethod Method,
        Uri Uri,
        string Authorization,
        string IdempotencyKey,
        string Body);
}
