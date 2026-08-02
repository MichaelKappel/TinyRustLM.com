using System.Net;
using System.Text.Json;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class MemoryEndpointsClientTests
{
    [Fact]
    public async Task PreparedOutboxSendUsesOriginalIdempotencyKeyAndPayload()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var client = new TinyRustLmMemoryEndpointsClient(Options("secret-token-value"), httpClient);
        var entry = client.PrepareMemoryOutboxEntry(
                TinyRustLmMemoryEndpointRecord.ShortTerm(
                    "Queued TinyRustLM slice",
                    "Public-safe browser work is committed locally before hosted synchronization.",
                    new[] { ".uai/short-term-memory.uai" }),
                "event-0123456789abcdef",
                "device-browser-a",
                1_720_000_000_000)
            .MarkQueued(1_720_000_000_010)
            .BeginSend(1_720_000_000_020);

        await client.SendOutboxEntryAsync(entry);

        var request = Assert.Single(handler.Requests);
        Assert.Equal(entry.IdempotencyKey, request.IdempotencyKey);
        Assert.Contains($"\"source\":\"{MemoryEndpointsSyncContract.ConnectorSource}\"", request.Content, StringComparison.Ordinal);
        Assert.Contains($"\"summary\":\"{entry.Payload.Summary}\"", request.Content, StringComparison.Ordinal);
        Assert.DoesNotContain("secret-token-value", request.Content, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SaveMemoryPostsPublicSafeShortTermRecord()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var options = Options("secret-token-value");
        var client = new TinyRustLmMemoryEndpointsClient(options, httpClient);

        var response = await client.SaveMemoryAsync(TinyRustLmMemoryEndpointRecord.ShortTerm(
            "Current TinyRustLM slice",
            "Short-term memory records the optional MemoryEndpoints connector implementation.",
            new[] { ".uai/short-term-memory.uai" },
            new[] { "tinyrustlm", "memoryendpoints" }));

        Assert.True(response.GetProperty("ok").GetBoolean());
        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("Bearer secret-token-value", request.Authorization);
        Assert.StartsWith("tinyrustlm-agent-", request.IdempotencyKey, StringComparison.Ordinal);
        Assert.Contains("\"workspaceId\":\"workspace-demo\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"actorAgentId\":\"tinyrustlm-agent\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"agentId\":\"tinyrustlm-agent\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"scope\":\"project\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"scopeId\":\"tinyrustlm.com\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"memoryType\":\"status\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"summary\":\"Short-term memory records the optional MemoryEndpoints connector implementation.\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"tinyrustlmMemoryTier\":\"short_term\"", request.Content, StringComparison.Ordinal);
        Assert.Contains("\"uaiReferences\":[\".uai/short-term-memory.uai\"]", request.Content, StringComparison.Ordinal);
        Assert.DoesNotContain("secret-token-value", request.Content, StringComparison.Ordinal);
        Assert.DoesNotContain("secret-token-value", options.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task RegisterAndInboxUseTinyRustLmAgentIdentity()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var client = new TinyRustLmMemoryEndpointsClient(Options("Bearer wrapped-token"), httpClient);

        await client.RegisterAgentAsync();
        await client.ReadInboxAsync();

        Assert.Equal(2, handler.Requests.Count);
        Assert.Contains("\"displayName\":\"TinyRustLM Agent\"", handler.Requests[0].Content, StringComparison.Ordinal);
        Assert.Equal(HttpMethod.Get, handler.Requests[1].Method);
        Assert.Contains("workspaceId=workspace-demo", handler.Requests[1].RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("agentId=tinyrustlm-agent", handler.Requests[1].RequestUri.Query, StringComparison.Ordinal);
        Assert.All(handler.Requests, request => Assert.Equal("Bearer wrapped-token", request.Authorization));
    }

    [Fact]
    public void RejectsSecretLikePublicMemoryAndUnsafeLongTermRecords()
    {
        using var httpClient = new HttpClient(new RecordingHandler());
        var client = new TinyRustLmMemoryEndpointsClient(Options("secret-token-value"), httpClient);

        Assert.Throws<ArgumentException>(() => client.SaveMemoryAsync(TinyRustLmMemoryEndpointRecord.ShortTerm(
            "Bad",
            "Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")).GetAwaiter().GetResult());

        Assert.Throws<ArgumentException>(() => client.SaveMemoryAsync(TinyRustLmMemoryEndpointRecord.LongTerm(
            "No references",
            "Long-term records must point to durable .uai memory.",
            Array.Empty<string>())).GetAwaiter().GetResult());

        Assert.Throws<ArgumentException>(() => new MemoryEndpointsClientOptions(
            "workspace-demo",
            "secret-token-value",
            Options("secret-token-value").Routes with
            {
                SaveMemory = new Uri("https://memory.example/save?api_key=secret")
            }));
    }

    [Fact]
    public async Task SearchMemoryUsesProtectedGetWithProjectScope()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var client = new TinyRustLmMemoryEndpointsClient(Options("secret-token-value"), httpClient);

        await client.SearchMemoryAsync(new MemoryEndpointsSearchRequest("hosted memory", Limit: 5));

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal("Bearer secret-token-value", request.Authorization);
        Assert.Contains("workspaceId=workspace-demo", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("agentId=tinyrustlm-agent", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("actor_agent_id=tinyrustlm-agent", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("query=hosted%20memory", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("scope=project", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("scopeId=tinyrustlm.com", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("limit=5", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.DoesNotContain("memory_type=", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Empty(request.Content);
    }

    [Fact]
    public async Task SearchMemoryCanFilterTinyRustLmMemoryTier()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var client = new TinyRustLmMemoryEndpointsClient(Options("secret-token-value"), httpClient);

        await client.SearchMemoryAsync(new MemoryEndpointsSearchRequest(
            "durable hosted memory",
            MemoryTier: "long_term",
            Limit: 5));

        var request = Assert.Single(handler.Requests);
        Assert.Contains("memory_type=handoff", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("scope=project", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("scopeId=tinyrustlm.com", request.RequestUri.Query, StringComparison.Ordinal);

        Assert.Throws<ArgumentException>(() => client.SearchMemoryAsync(new MemoryEndpointsSearchRequest(
            "bad tier",
            MemoryTier: "private")).GetAwaiter().GetResult());
    }

    [Fact]
    public async Task AlternateWorkspaceKeyHeaderUsesPublicConnectorContract()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var options = Options("alternate-secret-token", MemoryEndpointsAuthHeaderMode.XMemoryEndpointsKey);
        var client = new TinyRustLmMemoryEndpointsClient(options, httpClient);

        await client.SearchMemoryAsync(new MemoryEndpointsSearchRequest("hosted memory", Limit: 5));

        var request = Assert.Single(handler.Requests);
        Assert.Empty(request.Authorization);
        Assert.Equal("alternate-secret-token", request.MemoryEndpointsKey);
        Assert.DoesNotContain("alternate-secret-token", options.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void RoutesCanBeBuiltFromMemoryEndpointsBaseUri()
    {
        var routes = MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memoryendpoints.example"));

        Assert.Equal("https://memoryendpoints.example/api/matm/agents/register", routes.RegisterAgent.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/agent-messages", routes.SendMessage.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/current-message", routes.ReadInbox.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/notifications/ack", routes.AcknowledgeNotification.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/memory-events/submit", routes.SaveMemory.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/search", routes.SearchMemory.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/meeting-rooms", routes.ListMeetingRooms?.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/meeting-rooms", routes.CreateMeetingRoom?.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/meeting-messages", routes.PostMeetingMessage?.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/meeting-messages", routes.ReadMeetingMessages?.ToString());
        Assert.Equal("https://memoryendpoints.example/api/matm/meeting-rooms/read", routes.MarkMeetingRoomRead?.ToString());

        var matmRoutes = MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memoryendpoints.example/api/matm"));
        Assert.Equal(routes.SearchMemory, matmRoutes.SearchMemory);
    }

    [Fact]
    public async Task MeetingRoomWorkflowUsesPublicSafeGoalLane()
    {
        var handler = new RecordingHandler();
        using var httpClient = new HttpClient(handler);
        var options = new MemoryEndpointsClientOptions(
            "workspace-demo",
            "secret-token-value",
            MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memory.example")),
            authHeaderMode: MemoryEndpointsAuthHeaderMode.XMemoryEndpointsKey);
        var client = new TinyRustLmMemoryEndpointsClient(options, httpClient);

        await client.ListMeetingRoomsAsync(new MemoryEndpointsMeetingRoomQuery("goal", "goal-tinyrustlm-hosted-memory"));
        await client.CreateMeetingRoomAsync(new MemoryEndpointsCreateMeetingRoomRequest(
            "goal",
            "goal-tinyrustlm-hosted-memory",
            "TinyRustLM Hosted Memory Connector",
            "TinyRustLM Hosted Memory Connector",
            "Focused public-safe coordination for hosted memory."));
        await client.PostMeetingMessageAsync(new MemoryEndpointsMeetingMessage(
            "room-demo",
            "TinyRustLM public-safe hosted memory status."));
        await client.ReadMeetingMessagesAsync(new MemoryEndpointsReadMeetingMessagesRequest("room-demo", Limit: 7));
        await client.MarkMeetingRoomReadAsync("room-demo");

        Assert.Equal(5, handler.Requests.Count);
        Assert.All(handler.Requests, request =>
        {
            Assert.Empty(request.Authorization);
            Assert.Equal("secret-token-value", request.MemoryEndpointsKey);
            Assert.DoesNotContain("secret-token-value", request.Content, StringComparison.Ordinal);
        });

        Assert.Equal(HttpMethod.Get, handler.Requests[0].Method);
        Assert.Equal("/api/matm/meeting-rooms", handler.Requests[0].RequestUri.AbsolutePath);
        Assert.Contains("agent_id=tinyrustlm-agent", handler.Requests[0].RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("scope=goal", handler.Requests[0].RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("scope_id=goal-tinyrustlm-hosted-memory", handler.Requests[0].RequestUri.Query, StringComparison.Ordinal);

        Assert.Equal(HttpMethod.Post, handler.Requests[1].Method);
        Assert.Equal("/api/matm/meeting-rooms", handler.Requests[1].RequestUri.AbsolutePath);
        Assert.StartsWith("tinyrustlm-agent-", handler.Requests[1].IdempotencyKey, StringComparison.Ordinal);
        Assert.Contains("\"workspaceId\":\"workspace-demo\"", handler.Requests[1].Content, StringComparison.Ordinal);
        Assert.Contains("\"scope\":\"goal\"", handler.Requests[1].Content, StringComparison.Ordinal);
        Assert.Contains("\"scopeId\":\"goal-tinyrustlm-hosted-memory\"", handler.Requests[1].Content, StringComparison.Ordinal);
        Assert.Contains("\"creatorAgentId\":\"tinyrustlm-agent\"", handler.Requests[1].Content, StringComparison.Ordinal);

        Assert.Equal("/api/matm/meeting-messages", handler.Requests[2].RequestUri.AbsolutePath);
        Assert.Contains("\"roomId\":\"room-demo\"", handler.Requests[2].Content, StringComparison.Ordinal);
        Assert.Contains("\"senderAgentId\":\"tinyrustlm-agent\"", handler.Requests[2].Content, StringComparison.Ordinal);
        Assert.Contains("\"safeSummary\":\"TinyRustLM public-safe hosted memory status.\"", handler.Requests[2].Content, StringComparison.Ordinal);

        Assert.Equal(HttpMethod.Get, handler.Requests[3].Method);
        Assert.Equal("/api/matm/meeting-messages", handler.Requests[3].RequestUri.AbsolutePath);
        Assert.Contains("roomId=room-demo", handler.Requests[3].RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("limit=7", handler.Requests[3].RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("agent_id=tinyrustlm-agent", handler.Requests[3].RequestUri.Query, StringComparison.Ordinal);

        Assert.Equal("/api/matm/meeting-rooms/read", handler.Requests[4].RequestUri.AbsolutePath);
        Assert.Contains("\"roomId\":\"room-demo\"", handler.Requests[4].Content, StringComparison.Ordinal);
        Assert.Contains("\"agentId\":\"tinyrustlm-agent\"", handler.Requests[4].Content, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReadMeetingTranscriptNormalizesLiveItemsShape()
    {
        var handler = new RecordingHandler();
        handler.EnqueueJsonResponse(new
        {
            count = 1,
            ok = true,
            rawCredentialExposed = false,
            rawPayloadExposed = false,
            schemaVersion = "matm.meeting_messages.v1",
            valuesRedacted = true,
            items = new[]
            {
                new
                {
                    createdAt = "2026-07-10T06:00:00Z",
                    meetingMessageId = "message-demo",
                    rawMessageBodyStored = false,
                    rawPayloadExposed = false,
                    roomId = "room-demo",
                    safeSummary = "Public-safe coordinator routing for TinyRustLM hosted memory.",
                    scope = "goal",
                    scopeId = "goal-tinyrustlm-hosted-memory",
                    senderAgentId = "codex-agent",
                    valuesRedacted = true,
                    workspaceId = "workspace-demo"
                }
            }
        });
        using var httpClient = new HttpClient(handler);
        var client = new TinyRustLmMemoryEndpointsClient(new MemoryEndpointsClientOptions(
            "workspace-demo",
            "secret-token-value",
            MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memory.example"))), httpClient);

        var transcript = await client.ReadMeetingTranscriptAsync(
            new MemoryEndpointsReadMeetingMessagesRequest("room-demo", Limit: 3));

        Assert.Equal(1, transcript.Count);
        Assert.Equal("matm.meeting_messages.v1", transcript.SchemaVersion);
        var item = Assert.Single(transcript.Items);
        Assert.Equal("message-demo", item.MeetingMessageId);
        Assert.Equal("room-demo", item.RoomId);
        Assert.Equal("codex-agent", item.SenderAgentId);
        Assert.Equal("Public-safe coordinator routing for TinyRustLM hosted memory.", item.SafeSummary);
        Assert.Equal("2026-07-10T06:00:00Z", item.CreatedAt);
        Assert.Equal("goal", item.Scope);
        Assert.Equal("goal-tinyrustlm-hosted-memory", item.ScopeId);
        Assert.False(item.RawMessageBodyStored);
        Assert.False(item.RawPayloadExposed);
        Assert.True(item.ValuesRedacted);

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal("/api/matm/meeting-messages", request.RequestUri.AbsolutePath);
        Assert.Contains("roomId=room-demo", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("limit=3", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.Contains("agent_id=tinyrustlm-agent", request.RequestUri.Query, StringComparison.Ordinal);
        Assert.DoesNotContain("secret-token-value", request.RequestUri.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReadMeetingTranscriptRejectsUnsafeTranscriptResponses()
    {
        var handler = new RecordingHandler();
        handler.EnqueueJsonResponse(new
        {
            count = 1,
            ok = true,
            rawCredentialExposed = false,
            rawPayloadExposed = true,
            items = Array.Empty<object>()
        });
        using var httpClient = new HttpClient(handler);
        var client = new TinyRustLmMemoryEndpointsClient(new MemoryEndpointsClientOptions(
            "workspace-demo",
            "secret-token-value",
            MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memory.example"))), httpClient);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.ReadMeetingTranscriptAsync(new MemoryEndpointsReadMeetingMessagesRequest("room-demo")));
        Assert.Contains("rawPayloadExposed", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void MeetingRoomApiFailsClosedWithoutRoutesAndRejectsUnsafeInput()
    {
        using var httpClient = new HttpClient(new RecordingHandler());
        var client = new TinyRustLmMemoryEndpointsClient(Options("secret-token-value"), httpClient);

        Assert.Throws<InvalidOperationException>(() => client.ListMeetingRoomsAsync().GetAwaiter().GetResult());
        Assert.Throws<ArgumentException>(() => client.CreateMeetingRoomAsync(new MemoryEndpointsCreateMeetingRoomRequest(
            "project",
            "project-demo",
            "Bad scope")).GetAwaiter().GetResult());
        Assert.Throws<ArgumentException>(() => client.PostMeetingMessageAsync(new MemoryEndpointsMeetingMessage(
            "room-demo",
            "Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")).GetAwaiter().GetResult());
        Assert.Throws<ArgumentOutOfRangeException>(() => client.ReadMeetingMessagesAsync(new MemoryEndpointsReadMeetingMessagesRequest(
            "room-demo",
            Limit: 0)).GetAwaiter().GetResult());
    }

    private static MemoryEndpointsClientOptions Options(
        string token,
        MemoryEndpointsAuthHeaderMode authHeaderMode = MemoryEndpointsAuthHeaderMode.AuthorizationBearer) =>
        new(
            "workspace-demo",
            token,
            new MemoryEndpointsRoutes(
                new Uri("https://memory.example/register"),
                new Uri("https://memory.example/send"),
                new Uri("https://memory.example/inbox"),
                new Uri("https://memory.example/ack"),
                new Uri("https://memory.example/save"),
                new Uri("https://memory.example/search")),
            authHeaderMode: authHeaderMode);

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<RecordedRequest> Requests { get; } = new();
        private Queue<string> JsonResponses { get; } = new();

        public void EnqueueJsonResponse(object response) =>
            JsonResponses.Enqueue(JsonSerializer.Serialize(response));

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var content = request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Add(new RecordedRequest(
                request.Method,
                request.RequestUri!,
                request.Headers.Authorization?.ToString() ?? string.Empty,
                request.Headers.TryGetValues("X-MemoryEndpoints-Key", out var memoryEndpointsKeyValues)
                    ? memoryEndpointsKeyValues.Single()
                    : string.Empty,
                request.Headers.TryGetValues("Idempotency-Key", out var values)
                    ? values.Single()
                    : string.Empty,
                content));

            var responseJson = JsonResponses.Count > 0
                ? JsonResponses.Dequeue()
                : JsonSerializer.Serialize(new { ok = true });

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };
        }
    }

    private sealed record RecordedRequest(
        HttpMethod Method,
        Uri RequestUri,
        string Authorization,
        string MemoryEndpointsKey,
        string IdempotencyKey,
        string Content);
}
