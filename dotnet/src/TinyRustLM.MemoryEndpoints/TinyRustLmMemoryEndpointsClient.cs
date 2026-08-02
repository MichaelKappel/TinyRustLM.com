using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TinyRustLM;

/// <summary>Absolute MemoryEndpoints.com route URIs used by the optional connector.</summary>
public sealed record MemoryEndpointsRoutes(
    Uri RegisterAgent,
    Uri SendMessage,
    Uri ReadInbox,
    Uri AcknowledgeNotification,
    Uri SaveMemory,
    Uri SearchMemory)
{
    /// <summary>Protected route for listing MemoryEndpoints meeting rooms.</summary>
    public Uri? ListMeetingRooms { get; init; }

    /// <summary>Protected route for creating goal or task meeting rooms.</summary>
    public Uri? CreateMeetingRoom { get; init; }

    /// <summary>Protected route for posting public-safe meeting-room messages.</summary>
    public Uri? PostMeetingMessage { get; init; }

    /// <summary>Protected route for reading public-safe meeting-room messages.</summary>
    public Uri? ReadMeetingMessages { get; init; }

    /// <summary>Protected route for marking a meeting room as read by this agent.</summary>
    public Uri? MarkMeetingRoomRead { get; init; }

    /// <summary>Protected capability-negotiation route for authoritative distributed sync.</summary>
    public Uri? DistributedSyncCapabilities { get; init; }

    /// <summary>Builds the public MemoryEndpoints MATM route set from a service base URI.</summary>
    public static MemoryEndpointsRoutes FromBaseUri(Uri baseUri)
    {
        ArgumentNullException.ThrowIfNull(baseUri);
        var root = NormalizeMatmBaseUri(baseUri);
        return new MemoryEndpointsRoutes(
            AppendRoute(root, "/agents/register"),
            AppendRoute(root, "/agent-messages"),
            AppendRoute(root, "/current-message"),
            AppendRoute(root, "/notifications/ack"),
            AppendRoute(root, "/memory-events/submit"),
            AppendRoute(root, "/search"))
        {
            ListMeetingRooms = AppendRoute(root, "/meeting-rooms"),
            CreateMeetingRoom = AppendRoute(root, "/meeting-rooms"),
            PostMeetingMessage = AppendRoute(root, "/meeting-messages"),
            ReadMeetingMessages = AppendRoute(root, "/meeting-messages"),
            MarkMeetingRoomRead = AppendRoute(root, "/meeting-rooms/read"),
            DistributedSyncCapabilities = AppendRoute(root, "/sync/capabilities")
        };
    }

    private static string NormalizeMatmBaseUri(Uri baseUri)
    {
        if (!baseUri.IsAbsoluteUri)
        {
            throw new ArgumentException("MemoryEndpoints base URI must be absolute.", nameof(baseUri));
        }
        var root = baseUri.ToString().TrimEnd('/');
        return root.EndsWith("/api/matm", StringComparison.OrdinalIgnoreCase)
            ? root
            : $"{root}/api/matm";
    }

    private static Uri AppendRoute(string root, string route) =>
        new($"{root}{route}");
}

/// <summary>Workspace-key header mode for protected MemoryEndpoints.com routes.</summary>
public enum MemoryEndpointsAuthHeaderMode
{
    /// <summary>Send the workspace key as <c>Authorization: Bearer &lt;WORKSPACE_KEY&gt;</c>.</summary>
    AuthorizationBearer,

    /// <summary>Send the workspace key as <c>X-MemoryEndpoints-Key: &lt;WORKSPACE_KEY&gt;</c>.</summary>
    XMemoryEndpointsKey
}

/// <summary>Runtime options for the optional MemoryEndpoints.com connector.</summary>
public sealed class MemoryEndpointsClientOptions
{
    private const int MaxWorkspaceIdChars = 128;
    private const int MaxAgentIdChars = 96;
    private readonly string _bearerToken;

    /// <summary>Creates connector options from user-supplied MemoryEndpoints routes and token.</summary>
    public MemoryEndpointsClientOptions(
        string workspaceId,
        string bearerToken,
        MemoryEndpointsRoutes routes,
        string agentId = "tinyrustlm-agent",
        MemoryEndpointsAuthHeaderMode authHeaderMode = MemoryEndpointsAuthHeaderMode.AuthorizationBearer)
    {
        WorkspaceId = RequireIdentifier(workspaceId, nameof(workspaceId), MaxWorkspaceIdChars);
        AgentId = RequireIdentifier(agentId, nameof(agentId), MaxAgentIdChars);
        ArgumentNullException.ThrowIfNull(routes);
        Routes = ValidateRoutes(routes);
        _bearerToken = NormalizeBearerToken(bearerToken);
        AuthHeaderMode = authHeaderMode;
    }

    /// <summary>MemoryEndpoints workspace id.</summary>
    public string WorkspaceId { get; }

    /// <summary>TinyRustLM-side agent id.</summary>
    public string AgentId { get; }

    /// <summary>Configured MemoryEndpoints API route URIs.</summary>
    public MemoryEndpointsRoutes Routes { get; }

    /// <summary>Header mode used when applying the workspace key to protected routes.</summary>
    public MemoryEndpointsAuthHeaderMode AuthHeaderMode { get; }

    /// <summary>Returns a non-secret diagnostic string.</summary>
    public override string ToString() =>
        $"MemoryEndpointsClientOptions {{ WorkspaceId = {WorkspaceId}, AgentId = {AgentId}, AuthHeaderMode = {AuthHeaderMode}, Token = [REDACTED] }}";

    internal AuthenticationHeaderValue AuthorizationHeader =>
        new("Bearer", _bearerToken);

    internal void ApplyAuthentication(HttpRequestMessage request)
    {
        if (AuthHeaderMode == MemoryEndpointsAuthHeaderMode.XMemoryEndpointsKey)
        {
            request.Headers.TryAddWithoutValidation("X-MemoryEndpoints-Key", _bearerToken);
            return;
        }

        request.Headers.Authorization = AuthorizationHeader;
    }

    private static MemoryEndpointsRoutes ValidateRoutes(MemoryEndpointsRoutes routes) =>
        routes with
        {
            RegisterAgent = ValidateRoute(routes.RegisterAgent, nameof(routes.RegisterAgent)),
            SendMessage = ValidateRoute(routes.SendMessage, nameof(routes.SendMessage)),
            ReadInbox = ValidateRoute(routes.ReadInbox, nameof(routes.ReadInbox)),
            AcknowledgeNotification = ValidateRoute(routes.AcknowledgeNotification, nameof(routes.AcknowledgeNotification)),
            SaveMemory = ValidateRoute(routes.SaveMemory, nameof(routes.SaveMemory)),
            SearchMemory = ValidateRoute(routes.SearchMemory, nameof(routes.SearchMemory)),
            ListMeetingRooms = ValidateOptionalRoute(routes.ListMeetingRooms, nameof(routes.ListMeetingRooms)),
            CreateMeetingRoom = ValidateOptionalRoute(routes.CreateMeetingRoom, nameof(routes.CreateMeetingRoom)),
            PostMeetingMessage = ValidateOptionalRoute(routes.PostMeetingMessage, nameof(routes.PostMeetingMessage)),
            ReadMeetingMessages = ValidateOptionalRoute(routes.ReadMeetingMessages, nameof(routes.ReadMeetingMessages)),
            MarkMeetingRoomRead = ValidateOptionalRoute(routes.MarkMeetingRoomRead, nameof(routes.MarkMeetingRoomRead)),
            DistributedSyncCapabilities = ValidateOptionalRoute(
                routes.DistributedSyncCapabilities,
                nameof(routes.DistributedSyncCapabilities))
        };

    private static Uri? ValidateOptionalRoute(Uri? uri, string name) =>
        uri is null ? null : ValidateRoute(uri, name);

    private static Uri ValidateRoute(Uri uri, string name)
    {
        ArgumentNullException.ThrowIfNull(uri, name);
        if (!uri.IsAbsoluteUri)
        {
            throw new ArgumentException("MemoryEndpoints route must be an absolute URI.", name);
        }
        if (uri.Scheme != Uri.UriSchemeHttps && !IsLoopbackHttp(uri))
        {
            throw new ArgumentException("MemoryEndpoints route must use HTTPS, except loopback HTTP for local tests.", name);
        }
        if (LooksLikeSecret(uri.ToString()))
        {
            throw new ArgumentException("MemoryEndpoints route must not contain bearer tokens, API keys, or passwords.", name);
        }

        return uri;
    }

    private static bool IsLoopbackHttp(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttp &&
        (IPAddress.TryParse(uri.Host, out var address) && IPAddress.IsLoopback(address) ||
         string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase));

    private static string NormalizeBearerToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ArgumentException("MemoryEndpoints bearer token is required.", nameof(token));
        }

        var trimmed = token.Trim();
        return trimmed.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? trimmed["Bearer ".Length..].Trim()
            : trimmed;
    }

    private static string RequireIdentifier(string value, string name, int maxChars)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value is required.", name);
        }
        var trimmed = value.Trim();
        if (trimmed.Length > maxChars)
        {
            throw new ArgumentException($"Value may not exceed {maxChars} characters.", name);
        }
        if (trimmed.Any(ch => !(char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' or '.')))
        {
            throw new ArgumentException("Value contains unsupported characters.", name);
        }

        return trimmed;
    }

    internal static bool LooksLikeSecret(string value)
    {
        var lower = value.ToLowerInvariant();
        return lower.Contains("bearer ", StringComparison.Ordinal) ||
               lower.Contains("api_key", StringComparison.Ordinal) ||
               lower.Contains("apikey", StringComparison.Ordinal) ||
               lower.Contains("password", StringComparison.Ordinal) ||
               lower.Contains("secret=", StringComparison.Ordinal) ||
               Regex.IsMatch(value, @"(?<![A-Za-z0-9])[A-Za-z0-9_-]{48,}(?![A-Za-z0-9])");
    }
}

/// <summary>Public-safe TinyRustLM memory record saved through MemoryEndpoints.com.</summary>
public sealed record TinyRustLmMemoryEndpointRecord(
    string Scope,
    string Title,
    string SafeSummary,
    IReadOnlyList<string>? UaiReferences = null,
    IReadOnlyList<string>? Tags = null,
    string? SourceSha256 = null)
{
    /// <summary>Creates a short-term working-memory record.</summary>
    public static TinyRustLmMemoryEndpointRecord ShortTerm(
        string title,
        string safeSummary,
        IReadOnlyList<string>? uaiReferences = null,
        IReadOnlyList<string>? tags = null,
        string? sourceSha256 = null) =>
        new("short_term", title, safeSummary, uaiReferences, tags, sourceSha256);

    /// <summary>Creates a long-term durable-memory record.</summary>
    public static TinyRustLmMemoryEndpointRecord LongTerm(
        string title,
        string safeSummary,
        IReadOnlyList<string> uaiReferences,
        IReadOnlyList<string>? tags = null,
        string? sourceSha256 = null) =>
        new("long_term", title, safeSummary, uaiReferences, tags, sourceSha256);
}

/// <summary>Agent registration metadata sent to MemoryEndpoints.com.</summary>
public sealed record MemoryEndpointsAgentRegistration(
    string DisplayName = "TinyRustLM Agent",
    string SafeSummary = "TinyRustLM Agent coordinating optional .uai memory sync for TinyRustLM and LocalEndpoints.");

/// <summary>Targeted public-safe agent message.</summary>
public sealed record MemoryEndpointsAgentMessage(
    string TargetAgentId,
    string SafeSummary,
    bool ResponseRequired = true);

/// <summary>Hosted-memory search request.</summary>
public sealed record MemoryEndpointsSearchRequest(
    string Query,
    string? Scope = null,
    string? MemoryTier = null,
    int Limit = 20);

/// <summary>Filters used when listing MemoryEndpoints meeting rooms for this agent.</summary>
public sealed record MemoryEndpointsMeetingRoomQuery(
    string? Scope = null,
    string? ScopeId = null,
    string? AgentId = null);

/// <summary>Request to create a focused MemoryEndpoints goal or task meeting room.</summary>
public sealed record MemoryEndpointsCreateMeetingRoomRequest(
    string Scope,
    string ScopeId,
    string Name,
    string? Label = null,
    string? Purpose = null);

/// <summary>Public-safe MemoryEndpoints meeting-room message.</summary>
public sealed record MemoryEndpointsMeetingMessage(
    string RoomId,
    string SafeSummary);

/// <summary>Request to read public-safe MemoryEndpoints meeting-room messages.</summary>
public sealed record MemoryEndpointsReadMeetingMessagesRequest(
    string RoomId,
    int Limit = 20);

/// <summary>Typed view of a MemoryEndpoints meeting-room transcript response.</summary>
public sealed record MemoryEndpointsMeetingTranscript(
    int Count,
    IReadOnlyList<MemoryEndpointsMeetingTranscriptItem> Items,
    string? SchemaVersion = null)
{
    private const int MaxSafeTextChars = 16 * 1024;

    /// <summary>Builds a typed transcript from the public MemoryEndpoints transcript JSON response.</summary>
    public static MemoryEndpointsMeetingTranscript FromJson(JsonElement response)
    {
        RejectExposureFlag(response, "rawCredentialExposed");
        RejectExposureFlag(response, "rawPayloadExposed");
        var count = TryGetInt32(response, "count");
        var schemaVersion = TryGetString(response, "schemaVersion");
        var items = new List<MemoryEndpointsMeetingTranscriptItem>();

        if (response.TryGetProperty("items", out var itemsElement) &&
            itemsElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in itemsElement.EnumerateArray())
            {
                RejectExposureFlag(item, "rawPayloadExposed");
                var safeSummary = RequireString(item, "safeSummary", "summary");
                RejectPublicSafeTranscriptText(safeSummary, "safeSummary");
                items.Add(new MemoryEndpointsMeetingTranscriptItem(
                    RequireString(item, "meetingMessageId", "messageId", "id"),
                    RequireString(item, "roomId", "room_id"),
                    RequireString(item, "senderAgentId", "agentId", "sender"),
                    safeSummary,
                    TryGetString(item, "createdAt"),
                    TryGetString(item, "scope"),
                    TryGetString(item, "scopeId", "scope_id"),
                    TryGetBoolean(item, "rawMessageBodyStored"),
                    TryGetBoolean(item, "rawPayloadExposed"),
                    TryGetBoolean(item, "valuesRedacted")));
            }
        }

        return new MemoryEndpointsMeetingTranscript(
            count ?? items.Count,
            items,
            schemaVersion);
    }

    private static void RejectExposureFlag(JsonElement element, string propertyName)
    {
        if (TryGetBoolean(element, propertyName))
        {
            throw new InvalidOperationException(
                $"MemoryEndpoints transcript response reported {propertyName}=true.");
        }
    }

    private static string RequireString(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            var value = TryGetString(element, propertyName);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        throw new InvalidOperationException(
            $"MemoryEndpoints transcript item is missing required field {propertyNames[0]}.");
    }

    private static string? TryGetString(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (element.ValueKind == JsonValueKind.Object &&
                element.TryGetProperty(propertyName, out var property) &&
                property.ValueKind == JsonValueKind.String)
            {
                return property.GetString();
            }
        }

        return null;
    }

    private static int? TryGetInt32(JsonElement element, string propertyName)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.Number &&
            property.TryGetInt32(out var value))
        {
            return value;
        }

        return null;
    }

    private static bool TryGetBoolean(JsonElement element, string propertyName) =>
        element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty(propertyName, out var property) &&
        property.ValueKind == JsonValueKind.True;

    private static void RejectPublicSafeTranscriptText(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"MemoryEndpoints transcript {name} is required.");
        }
        if (value.Length > MaxSafeTextChars)
        {
            throw new InvalidOperationException(
                $"MemoryEndpoints transcript {name} may not exceed {MaxSafeTextChars} characters.");
        }
        if (value.Any(ch => char.IsControl(ch) && ch is not '\r' and not '\n' and not '\t'))
        {
            throw new InvalidOperationException(
                $"MemoryEndpoints transcript {name} contains unsupported control characters.");
        }
        if (MemoryEndpointsClientOptions.LooksLikeSecret(value))
        {
            throw new InvalidOperationException(
                $"MemoryEndpoints transcript {name} appears to contain secret material.");
        }
    }
}

/// <summary>Typed public-safe message from a MemoryEndpoints meeting-room transcript.</summary>
public sealed record MemoryEndpointsMeetingTranscriptItem(
    string MeetingMessageId,
    string RoomId,
    string SenderAgentId,
    string SafeSummary,
    string? CreatedAt = null,
    string? Scope = null,
    string? ScopeId = null,
    bool RawMessageBodyStored = false,
    bool RawPayloadExposed = false,
    bool ValuesRedacted = true);

/// <summary>HTTP client for the optional MemoryEndpoints.com TinyRustLM connector.</summary>
public sealed class TinyRustLmMemoryEndpointsClient
{
    private const int MaxSafeTextChars = 16 * 1024;
    private const int MaxDistributedSyncResponseBytes = 256 * 1024;
    private const string TinyRustLmMemoryScope = "project";
    private const string TinyRustLmMemoryScopeId = "tinyrustlm.com";
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false
    };

    private readonly HttpClient _httpClient;
    private readonly MemoryEndpointsClientOptions _options;
    private MemoryEndpointsDistributedSyncCapabilities? _distributedSyncCapabilities;

    /// <summary>Creates a connector around a caller-owned <see cref="HttpClient"/>.</summary>
    public TinyRustLmMemoryEndpointsClient(MemoryEndpointsClientOptions options, HttpClient? httpClient = null)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _httpClient = httpClient ?? new HttpClient();
    }

    /// <summary>Prepares a credential-free durable outbox entry bound to this client identity.</summary>
    public MemoryEndpointsOutboxEntry PrepareMemoryOutboxEntry(
        TinyRustLmMemoryEndpointRecord record,
        string eventId,
        string deviceId,
        long committedAtUnixMs) =>
        MemoryEndpointsSyncContract.PrepareOutboxEntry(
            record,
            _options.WorkspaceId,
            _options.AgentId,
            eventId,
            deviceId,
            committedAtUnixMs);

    /// <summary>Sends one validated prepared outbox entry with its original idempotency key.</summary>
    public Task<JsonElement> SendOutboxEntryAsync(
        MemoryEndpointsOutboxEntry entry,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entry);
        MemoryEndpointsSyncContract.ValidateOutboxEntry(entry);
        if (entry.State != MemoryEndpointsOutboxState.Sending)
        {
            throw new InvalidOperationException(
                "A prepared MemoryEndpoints entry must be in sending state before transport.");
        }
        if (entry.Payload.WorkspaceId != _options.WorkspaceId ||
            entry.Payload.AgentId != _options.AgentId)
        {
            throw new InvalidOperationException(
                "Prepared MemoryEndpoints entry does not belong to this client identity.");
        }
        return SendAsync(
            HttpMethod.Post,
            _options.Routes.SaveMemory,
            entry.Payload,
            entry.IdempotencyKey,
            cancellationToken);
    }

    /// <summary>Probes the service for a complete live distributed-sync authority contract.</summary>
    public async Task<MemoryEndpointsDistributedSyncAvailability> ProbeDistributedSyncAsync(
        CancellationToken cancellationToken = default)
    {
        Volatile.Write(ref _distributedSyncCapabilities, null);
        var uri = RequireConfiguredRoute(
            _options.Routes.DistributedSyncCapabilities,
            nameof(_options.Routes.DistributedSyncCapabilities));
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        using var response = await _httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return new MemoryEndpointsDistributedSyncAvailability(
                MemoryEndpointsDistributedSyncAvailabilityStatus.NotAdvertised,
                "not_advertised",
                null);
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"MemoryEndpoints distributed-sync probe failed with {(int)response.StatusCode} {response.ReasonPhrase}.",
                null,
                response.StatusCode);
        }

        var responseText = await ReadBoundedResponseTextAsync(
            response,
            64 * 1024,
            cancellationToken).ConfigureAwait(false);
        try
        {
            RequireNoStore(response);
            var capabilities = MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(responseText);
            Volatile.Write(ref _distributedSyncCapabilities, capabilities);
            return new MemoryEndpointsDistributedSyncAvailability(
                MemoryEndpointsDistributedSyncAvailabilityStatus.Live,
                "live",
                capabilities);
        }
        catch (Exception error) when (error is ArgumentException or JsonException or InvalidOperationException)
        {
            return new MemoryEndpointsDistributedSyncAvailability(
                MemoryEndpointsDistributedSyncAvailabilityStatus.Incompatible,
                "invalid_contract",
                null);
        }
    }

    /// <summary>Submits or exactly replays one public-safe hosted revision mutation.</summary>
    public async Task<MemoryEndpointsRevisionDecisionResponse> SubmitRevisionMutationAsync(
        MemoryEndpointsHostedRevisionMutation mutation,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(mutation);
        var capabilities = RequireLiveDistributedSyncCapabilities();
        MemoryEndpointsDistributedSyncTransport.ValidateIdempotencyKey(idempotencyKey);
        var canonical = MemoryEndpointsDistributedSyncTransport.CanonicalizeHostedRevisionMutation(mutation);
        if (canonical.WorkspaceId != _options.WorkspaceId ||
            canonical.ActorAgentId != _options.AgentId)
        {
            throw new ArgumentException("Hosted mutation belongs to another client identity.", nameof(mutation));
        }
        var body = MemoryEndpointsDistributedSyncTransport.SerializeHostedRevisionMutation(canonical);
        if (Encoding.UTF8.GetByteCount(body) > 128 * 1024)
        {
            throw new ArgumentException("Hosted mutation exceeds the client byte limit.", nameof(mutation));
        }
        var result = await SendDistributedSyncAsync(
            HttpMethod.Post,
            ResolveDistributedSyncRoute(capabilities.Routes.SubmitMutation),
            body,
            idempotencyKey,
            new[] { HttpStatusCode.Accepted, HttpStatusCode.Conflict },
            cancellationToken).ConfigureAwait(false);
        MemoryEndpointsRevisionDecisionResponse decision;
        try
        {
            decision = MemoryEndpointsDistributedSyncTransport.ParseRevisionDecisionResponse(result.Body);
        }
        catch (Exception error) when (error is ArgumentException or JsonException)
        {
            throw MemoryEndpointsDistributedSyncTransport.ParseFailure(result.StatusCode, result.Body);
        }
        if (decision.Receipt.WorkspaceId != canonical.WorkspaceId ||
            decision.Receipt.LogicalMemoryId != canonical.LogicalMemoryId ||
            decision.Receipt.BodyHash != canonical.BodyHash)
        {
            throw new InvalidOperationException("Hosted decision does not match the submitted mutation identity.");
        }
        return decision;
    }

    /// <summary>Looks up an authoritative receipt after an uncertain network result.</summary>
    public async Task<MemoryEndpointsReconciliationReceipt?> LookupRevisionReceiptAsync(
        MemoryEndpointsReceiptLookupRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        MemoryEndpointsDistributedSyncTransport.ValidateReceiptLookupRequest(request);
        var capabilities = RequireLiveDistributedSyncCapabilities();
        var uri = AddQuery(
            ResolveDistributedSyncRoute(capabilities.Routes.LookupReceipt),
            ("workspace_id", _options.WorkspaceId));
        var result = await SendDistributedSyncAsync(
            HttpMethod.Get,
            uri,
            null,
            request.IdempotencyKey,
            new[] { HttpStatusCode.OK, HttpStatusCode.NotFound },
            cancellationToken).ConfigureAwait(false);
        if (result.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        var receipt = MemoryEndpointsDistributedSyncTransport
            .ParseReceiptLookupResponse(result.Body)
            .Receipt;
        if (receipt.LogicalMemoryId != request.LogicalMemoryId ||
            receipt.BodyHash != request.BodyHash)
        {
            throw new InvalidOperationException("Looked-up receipt does not match the uncertain operation.");
        }
        return receipt;
    }

    /// <summary>Pulls one strictly monotonic page after a committed local checkpoint.</summary>
    public async Task<MemoryEndpointsChangePage> PullRevisionChangesAsync(
        ulong afterServerSequence,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var capabilities = RequireLiveDistributedSyncCapabilities();
        if (limit < 1 || limit > MemoryEndpointsDistributedSyncProtocol.MaxPullPageSize)
        {
            throw new ArgumentOutOfRangeException(nameof(limit), "Limit exceeds the hosted pull-page bound.");
        }
        var uri = AddQuery(
            ResolveDistributedSyncRoute(capabilities.Routes.Changes),
            ("workspace_id", _options.WorkspaceId),
            ("after_sequence", afterServerSequence.ToString(CultureInfo.InvariantCulture)),
            ("limit", limit.ToString(CultureInfo.InvariantCulture)));
        var result = await SendDistributedSyncAsync(
            HttpMethod.Get,
            uri,
            null,
            null,
            new[] { HttpStatusCode.OK },
            cancellationToken).ConfigureAwait(false);
        return MemoryEndpointsDistributedSyncTransport
            .ParseChangePage(result.Body, afterServerSequence)
            .Changes;
    }

    /// <summary>Reads current authoritative heads without relying on hosted search.</summary>
    public async Task<MemoryEndpointsReadHeadsResponse> ReadRevisionHeadsAsync(
        string? logicalMemoryId = null,
        CancellationToken cancellationToken = default)
    {
        if (logicalMemoryId is not null)
        {
            RejectIdentifier(logicalMemoryId, nameof(logicalMemoryId));
        }
        var capabilities = RequireLiveDistributedSyncCapabilities();
        var parameters = new List<(string Name, string Value)>
        {
            ("workspace_id", _options.WorkspaceId)
        };
        if (logicalMemoryId is not null)
        {
            parameters.Add(("logical_memory_id", logicalMemoryId));
        }
        var uri = AddQuery(
            ResolveDistributedSyncRoute(capabilities.Routes.Heads),
            parameters.ToArray());
        var result = await SendDistributedSyncAsync(
            HttpMethod.Get,
            uri,
            null,
            null,
            new[] { HttpStatusCode.OK },
            cancellationToken).ConfigureAwait(false);
        var response = MemoryEndpointsDistributedSyncTransport.ParseReadHeadsResponse(result.Body);
        if (logicalMemoryId is not null &&
            (response.Filters.LogicalMemoryId != logicalMemoryId ||
             response.Items.Any(item => item.LogicalMemoryId != logicalMemoryId)))
        {
            throw new InvalidOperationException("Head response does not match the requested logical memory.");
        }
        return response;
    }

    /// <summary>Registers a stable device and obtains its initial authority epoch.</summary>
    public Task<MemoryEndpointsDeviceAuthorityResponse> RegisterSyncDeviceAsync(
        MemoryEndpointsRegisterDeviceRequest request,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        MemoryEndpointsDistributedSyncTransport.ValidateRegisterDeviceRequest(request);
        ValidateSyncRequestIdentity(request.WorkspaceId, request.AgentId);
        return SendDeviceAuthorityRequestAsync(
            RequireLiveDistributedSyncCapabilities().Routes.RegisterDevice,
            request,
            request.DeviceId,
            idempotencyKey,
            new[] { HttpStatusCode.Created },
            cancellationToken);
    }

    /// <summary>Rotates a device epoch without rewriting queued operation identity.</summary>
    public async Task<MemoryEndpointsDeviceAuthorityResponse> RotateSyncDeviceAsync(
        MemoryEndpointsRotateDeviceRequest request,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        MemoryEndpointsDistributedSyncTransport.ValidateRotateDeviceRequest(request);
        ValidateSyncRequestIdentity(request.WorkspaceId, request.AgentId);
        var response = await SendDeviceAuthorityRequestAsync(
            RequireLiveDistributedSyncCapabilities().Routes.RotateDevice,
            request,
            request.DeviceId,
            idempotencyKey,
            new[] { HttpStatusCode.OK },
            cancellationToken).ConfigureAwait(false);
        if (response.Device.Status != MemoryEndpointsHostedDeviceStatus.Active)
        {
            throw new InvalidOperationException("Device rotation did not return active authority.");
        }
        return response;
    }

    /// <summary>Revokes a device and every authority epoch assigned to it.</summary>
    public async Task<MemoryEndpointsDeviceAuthorityResponse> RevokeSyncDeviceAsync(
        MemoryEndpointsRevokeDeviceRequest request,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        MemoryEndpointsDistributedSyncTransport.ValidateRevokeDeviceRequest(request);
        ValidateSyncRequestIdentity(request.WorkspaceId, request.AgentId);
        var response = await SendDeviceAuthorityRequestAsync(
            RequireLiveDistributedSyncCapabilities().Routes.RevokeDevice,
            request,
            request.DeviceId,
            idempotencyKey,
            new[] { HttpStatusCode.OK },
            cancellationToken).ConfigureAwait(false);
        if (response.Device.Status != MemoryEndpointsHostedDeviceStatus.Revoked)
        {
            throw new InvalidOperationException("Device revocation response did not revoke the device.");
        }
        return response;
    }

    /// <summary>Reads hosted tombstone and hard-forget policy.</summary>
    public async Task<MemoryEndpointsRetentionPolicyResponse> GetSyncRetentionPolicyAsync(
        CancellationToken cancellationToken = default)
    {
        var capabilities = RequireLiveDistributedSyncCapabilities();
        var uri = AddQuery(
            ResolveDistributedSyncRoute(capabilities.Routes.Retention),
            ("workspace_id", _options.WorkspaceId));
        var result = await SendDistributedSyncAsync(
            HttpMethod.Get,
            uri,
            null,
            null,
            new[] { HttpStatusCode.OK },
            cancellationToken).ConfigureAwait(false);
        var policy = MemoryEndpointsDistributedSyncTransport.ParseRetentionPolicyResponse(result.Body);
        if (policy.Policy.TombstoneRetentionDays != capabilities.Retention.TombstoneRetentionDays ||
            policy.Policy.HardForgetSupported != capabilities.Retention.HardForgetSupported)
        {
            throw new InvalidOperationException("Retention policy is weaker than the negotiated capability.");
        }
        return policy;
    }

    /// <summary>Registers or refreshes the TinyRustLM Agent identity in MemoryEndpoints.com.</summary>
    public Task<JsonElement> RegisterAgentAsync(
        MemoryEndpointsAgentRegistration? registration = null,
        CancellationToken cancellationToken = default)
    {
        registration ??= new MemoryEndpointsAgentRegistration();
        RejectPublicSecret(registration.DisplayName, nameof(registration.DisplayName));
        RejectPublicSecret(registration.SafeSummary, nameof(registration.SafeSummary));
        return PostJsonAsync(
            _options.Routes.RegisterAgent,
            new
            {
                workspaceId = _options.WorkspaceId,
                agentId = _options.AgentId,
                displayName = registration.DisplayName,
                safeSummary = registration.SafeSummary
            },
            cancellationToken);
    }

    /// <summary>Sends a targeted public-safe message to another MemoryEndpoints agent.</summary>
    public Task<JsonElement> SendMessageAsync(
        MemoryEndpointsAgentMessage message,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        RejectIdentifier(message.TargetAgentId, nameof(message.TargetAgentId));
        RejectPublicSecret(message.SafeSummary, nameof(message.SafeSummary));
        return PostJsonAsync(
            _options.Routes.SendMessage,
            new
            {
                workspaceId = _options.WorkspaceId,
                senderAgentId = _options.AgentId,
                targetAgentId = message.TargetAgentId,
                safeSummary = message.SafeSummary,
                responseRequired = message.ResponseRequired
            },
            cancellationToken);
    }

    /// <summary>Saves a short-term or long-term public-safe memory record.</summary>
    public Task<JsonElement> SaveMemoryAsync(
        TinyRustLmMemoryEndpointRecord record,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(record);
        ValidateMemoryRecord(record);
        return PostJsonAsync(
            _options.Routes.SaveMemory,
            MemoryEndpointsSyncContract.CreateSubmitPayload(
                record,
                _options.WorkspaceId,
                _options.AgentId),
            cancellationToken);
    }

    /// <summary>Searches hosted public-safe memory for the configured workspace.</summary>
    public Task<JsonElement> SearchMemoryAsync(
        MemoryEndpointsSearchRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        RejectPublicSecret(request.Query, nameof(request.Query));
        var memoryType = MemoryTypeForSearchTier(request.MemoryTier);
        if (request.Limit is < 1 or > 100)
        {
            throw new ArgumentOutOfRangeException(nameof(request.Limit), "Limit must be between 1 and 100.");
        }

        var values = new List<(string Name, string Value)>
        {
            ("workspaceId", _options.WorkspaceId),
            ("agentId", _options.AgentId),
            ("actor_agent_id", _options.AgentId),
            ("query", request.Query),
            ("scope", string.IsNullOrWhiteSpace(request.Scope) ? TinyRustLmMemoryScope : request.Scope),
            ("scopeId", TinyRustLmMemoryScopeId),
            ("limit", request.Limit.ToString(CultureInfo.InvariantCulture))
        };
        if (!string.IsNullOrWhiteSpace(memoryType))
        {
            values.Add(("memory_type", memoryType));
        }

        var uri = AddQuery(_options.Routes.SearchMemory, values.ToArray());
        return SendAsync(HttpMethod.Get, uri, null, null, cancellationToken);
    }

    /// <summary>Reads the TinyRustLM Agent inbox lane.</summary>
    public Task<JsonElement> ReadInboxAsync(CancellationToken cancellationToken = default)
    {
        var uri = AddQuery(
            _options.Routes.ReadInbox,
            ("workspaceId", _options.WorkspaceId),
            ("agentId", _options.AgentId));
        return SendAsync(HttpMethod.Get, uri, null, null, cancellationToken);
    }

    /// <summary>Acknowledges one MemoryEndpoints notification as read.</summary>
    public Task<JsonElement> AcknowledgeNotificationAsync(
        string notificationId,
        CancellationToken cancellationToken = default)
    {
        RejectIdentifier(notificationId, nameof(notificationId));
        return PostJsonAsync(
            _options.Routes.AcknowledgeNotification,
            new
            {
                workspaceId = _options.WorkspaceId,
                notificationId,
                consumerAgentId = _options.AgentId,
                status = "read"
            },
            cancellationToken);
    }

    /// <summary>Lists MemoryEndpoints meeting rooms visible to this agent.</summary>
    public Task<JsonElement> ListMeetingRoomsAsync(
        MemoryEndpointsMeetingRoomQuery? query = null,
        CancellationToken cancellationToken = default)
    {
        query ??= new MemoryEndpointsMeetingRoomQuery();
        var agentId = string.IsNullOrWhiteSpace(query.AgentId) ? _options.AgentId : query.AgentId.Trim();
        RejectIdentifier(agentId, nameof(query.AgentId));
        if (!string.IsNullOrWhiteSpace(query.Scope))
        {
            RejectMeetingScope(query.Scope, allowCompanyWorkspaceProject: true, nameof(query.Scope));
        }
        if (!string.IsNullOrWhiteSpace(query.ScopeId))
        {
            RejectIdentifier(query.ScopeId, nameof(query.ScopeId));
        }

        var values = new List<(string Name, string Value)>
        {
            ("agent_id", agentId)
        };
        if (!string.IsNullOrWhiteSpace(query.Scope))
        {
            values.Add(("scope", query.Scope.Trim()));
        }
        if (!string.IsNullOrWhiteSpace(query.ScopeId))
        {
            values.Add(("scope_id", query.ScopeId.Trim()));
        }

        var uri = AddQuery(
            RequireConfiguredRoute(_options.Routes.ListMeetingRooms, nameof(_options.Routes.ListMeetingRooms)),
            values.ToArray());
        return SendAsync(HttpMethod.Get, uri, null, null, cancellationToken);
    }

    /// <summary>Creates a public-safe goal or task meeting room for focused coordination.</summary>
    public Task<JsonElement> CreateMeetingRoomAsync(
        MemoryEndpointsCreateMeetingRoomRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        RejectMeetingScope(request.Scope, allowCompanyWorkspaceProject: false, nameof(request.Scope));
        RejectIdentifier(request.ScopeId, nameof(request.ScopeId));
        RejectPublicSecret(request.Name, nameof(request.Name));
        RejectOptionalPublicSecret(request.Label, nameof(request.Label));
        RejectOptionalPublicSecret(request.Purpose, nameof(request.Purpose));
        return PostJsonAsync(
            RequireConfiguredRoute(_options.Routes.CreateMeetingRoom, nameof(_options.Routes.CreateMeetingRoom)),
            new
            {
                workspaceId = _options.WorkspaceId,
                scope = request.Scope.Trim(),
                scopeId = request.ScopeId.Trim(),
                name = request.Name,
                label = request.Label,
                purpose = request.Purpose,
                creatorAgentId = _options.AgentId,
                agentId = _options.AgentId
            },
            cancellationToken);
    }

    /// <summary>Posts a public-safe message to a MemoryEndpoints meeting room.</summary>
    public Task<JsonElement> PostMeetingMessageAsync(
        MemoryEndpointsMeetingMessage message,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        RejectIdentifier(message.RoomId, nameof(message.RoomId));
        RejectPublicSecret(message.SafeSummary, nameof(message.SafeSummary));
        return PostJsonAsync(
            RequireConfiguredRoute(_options.Routes.PostMeetingMessage, nameof(_options.Routes.PostMeetingMessage)),
            new
            {
                workspaceId = _options.WorkspaceId,
                roomId = message.RoomId,
                senderAgentId = _options.AgentId,
                safeSummary = message.SafeSummary
            },
            cancellationToken);
    }

    /// <summary>Reads public-safe messages from one MemoryEndpoints meeting room.</summary>
    public Task<JsonElement> ReadMeetingMessagesAsync(
        MemoryEndpointsReadMeetingMessagesRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        RejectIdentifier(request.RoomId, nameof(request.RoomId));
        if (request.Limit is < 1 or > 100)
        {
            throw new ArgumentOutOfRangeException(nameof(request.Limit), "Limit must be between 1 and 100.");
        }

        var uri = AddQuery(
            RequireConfiguredRoute(_options.Routes.ReadMeetingMessages, nameof(_options.Routes.ReadMeetingMessages)),
            ("roomId", request.RoomId),
            ("limit", request.Limit.ToString(CultureInfo.InvariantCulture)),
            ("agent_id", _options.AgentId));
        return SendAsync(HttpMethod.Get, uri, null, null, cancellationToken);
    }

    /// <summary>Reads and normalizes public-safe MemoryEndpoints meeting-room messages.</summary>
    public async Task<MemoryEndpointsMeetingTranscript> ReadMeetingTranscriptAsync(
        MemoryEndpointsReadMeetingMessagesRequest request,
        CancellationToken cancellationToken = default)
    {
        var response = await ReadMeetingMessagesAsync(request, cancellationToken).ConfigureAwait(false);
        return MemoryEndpointsMeetingTranscript.FromJson(response);
    }

    /// <summary>Marks a MemoryEndpoints meeting room read for the configured agent.</summary>
    public Task<JsonElement> MarkMeetingRoomReadAsync(
        string roomId,
        CancellationToken cancellationToken = default)
    {
        RejectIdentifier(roomId, nameof(roomId));
        return PostJsonAsync(
            RequireConfiguredRoute(_options.Routes.MarkMeetingRoomRead, nameof(_options.Routes.MarkMeetingRoomRead)),
            new
            {
                workspaceId = _options.WorkspaceId,
                roomId,
                agentId = _options.AgentId
            },
            cancellationToken);
    }

    private Task<JsonElement> PostJsonAsync(
        Uri uri,
        object payload,
        CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, uri, payload, $"tinyrustlm-agent-{Guid.NewGuid():N}", cancellationToken);

    private MemoryEndpointsDistributedSyncCapabilities RequireLiveDistributedSyncCapabilities()
    {
        var capabilities = Volatile.Read(ref _distributedSyncCapabilities) ??
            throw new InvalidOperationException(
                "Distributed sync is unavailable until ProbeDistributedSyncAsync returns Live.");
        MemoryEndpointsDistributedSyncProtocol.ValidateCapabilities(capabilities);
        return capabilities;
    }

    private Uri ResolveDistributedSyncRoute(string advertisedRoute)
    {
        var capabilityUri = RequireConfiguredRoute(
            _options.Routes.DistributedSyncCapabilities,
            nameof(_options.Routes.DistributedSyncCapabilities));
        return MemoryEndpointsDistributedSyncProtocol.ResolveRoute(capabilityUri, advertisedRoute);
    }

    private async Task<MemoryEndpointsDeviceAuthorityResponse> SendDeviceAuthorityRequestAsync<TRequest>(
        string advertisedRoute,
        TRequest request,
        string expectedDeviceId,
        string idempotencyKey,
        IReadOnlyCollection<HttpStatusCode> acceptedStatusCodes,
        CancellationToken cancellationToken)
    {
        MemoryEndpointsDistributedSyncTransport.ValidateIdempotencyKey(idempotencyKey);
        var result = await SendDistributedSyncAsync(
            HttpMethod.Post,
            ResolveDistributedSyncRoute(advertisedRoute),
            JsonSerializer.Serialize(request, SerializerOptions),
            idempotencyKey,
            acceptedStatusCodes,
            cancellationToken).ConfigureAwait(false);
        var authority = MemoryEndpointsDistributedSyncTransport.ParseDeviceAuthorityResponse(result.Body);
        if (authority.Device.DeviceId != expectedDeviceId)
        {
            throw new InvalidOperationException("Device authority response does not match the requested device.");
        }
        return authority;
    }

    private void ValidateSyncRequestIdentity(string workspaceId, string agentId)
    {
        if (workspaceId != _options.WorkspaceId || agentId != _options.AgentId)
        {
            throw new ArgumentException("Distributed-sync request belongs to another client identity.");
        }
    }

    private async Task<DistributedSyncHttpResponse> SendDistributedSyncAsync(
        HttpMethod method,
        Uri uri,
        string? body,
        string? idempotencyKey,
        IReadOnlyCollection<HttpStatusCode> acceptedStatusCodes,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, uri);
        _options.ApplyAuthentication(request);
        if (idempotencyKey is not null)
        {
            MemoryEndpointsDistributedSyncTransport.ValidateIdempotencyKey(idempotencyKey);
            request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        }
        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        using var response = await _httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        var responseText = await ReadBoundedResponseTextAsync(
            response,
            MaxDistributedSyncResponseBytes,
            cancellationToken).ConfigureAwait(false);
        RequireNoStore(response);
        if (!acceptedStatusCodes.Contains(response.StatusCode))
        {
            throw MemoryEndpointsDistributedSyncTransport.ParseFailure(response.StatusCode, responseText);
        }
        if (string.IsNullOrWhiteSpace(responseText))
        {
            throw new InvalidOperationException("Distributed-sync response body is required.");
        }
        return new DistributedSyncHttpResponse(response.StatusCode, responseText);
    }

    private static async Task<string> ReadBoundedResponseTextAsync(
        HttpResponseMessage response,
        int maxBytes,
        CancellationToken cancellationToken)
    {
        if (response.Content.Headers.ContentLength is > 0 and var contentLength && contentLength > maxBytes)
        {
            throw new InvalidOperationException("MemoryEndpoints response exceeds its byte limit.");
        }
        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        using var output = new MemoryStream();
        var buffer = new byte[8192];
        while (true)
        {
            var read = await input.ReadAsync(buffer.AsMemory(), cancellationToken).ConfigureAwait(false);
            if (read == 0)
            {
                break;
            }
            if (output.Length + read > maxBytes)
            {
                throw new InvalidOperationException("MemoryEndpoints response exceeds its byte limit.");
            }
            output.Write(buffer, 0, read);
        }
        try
        {
            return new UTF8Encoding(false, true).GetString(output.ToArray());
        }
        catch (DecoderFallbackException error)
        {
            throw new InvalidOperationException("MemoryEndpoints response is not valid UTF-8.", error);
        }
    }

    private static void RequireNoStore(HttpResponseMessage response)
    {
        if (response.Headers.CacheControl?.NoStore != true)
        {
            throw new InvalidOperationException(
                "Distributed-sync protected responses must include Cache-Control: no-store.");
        }
    }

    private async Task<JsonElement> SendAsync(
        HttpMethod method,
        Uri uri,
        object? payload,
        string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, uri);
        _options.ApplyAuthentication(request);
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        }
        if (payload is not null)
        {
            var json = JsonSerializer.Serialize(payload, SerializerOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"MemoryEndpoints request failed with {(int)response.StatusCode} {response.ReasonPhrase}.",
                null,
                response.StatusCode);
        }
        if (string.IsNullOrWhiteSpace(responseText))
        {
            return JsonSerializer.SerializeToElement(new { ok = true }, SerializerOptions);
        }

        using var document = JsonDocument.Parse(responseText);
        return document.RootElement.Clone();
    }

    private static void ValidateMemoryRecord(TinyRustLmMemoryEndpointRecord record)
    {
        if (record.Scope is not ("short_term" or "long_term"))
        {
            throw new ArgumentException("Memory scope must be short_term or long_term.", nameof(record));
        }
        RejectPublicSecret(record.Title, nameof(record.Title));
        RejectPublicSecret(record.SafeSummary, nameof(record.SafeSummary));
        foreach (var reference in record.UaiReferences ?? Array.Empty<string>())
        {
            if (reference.Contains("..", StringComparison.Ordinal) ||
                reference.Contains(':') ||
                reference.StartsWith('/') ||
                !(reference.StartsWith(".uai/", StringComparison.Ordinal) ||
                  reference.StartsWith("docs/", StringComparison.Ordinal) ||
                  reference.StartsWith("wiki/", StringComparison.Ordinal) ||
                  reference.EndsWith(".uai", StringComparison.Ordinal)))
            {
                throw new ArgumentException("UAI references must be safe .uai/docs/wiki relative paths.", nameof(record));
            }
        }
        if (record.Scope == "long_term" && (record.UaiReferences is null || record.UaiReferences.Count == 0))
        {
            throw new ArgumentException("Long-term MemoryEndpoints records require at least one .uai/docs/wiki reference.", nameof(record));
        }
        if (record.SourceSha256 is not null &&
            !Regex.IsMatch(record.SourceSha256, "^[0-9a-f]{64}$", RegexOptions.CultureInvariant))
        {
            throw new ArgumentException("SourceSha256 must be 64 lowercase hex characters.", nameof(record));
        }
    }

    private static string MemoryTypeFor(string scope) =>
        scope == "long_term" ? "handoff" : "status";

    private static string MemoryTypeForSearchTier(string? memoryTier)
    {
        if (string.IsNullOrWhiteSpace(memoryTier))
        {
            return string.Empty;
        }

        return memoryTier.Trim() switch
        {
            "short_term" => "status",
            "long_term" => "handoff",
            "all" => string.Empty,
            _ => throw new ArgumentException("MemoryTier must be all, short_term, or long_term.", nameof(memoryTier))
        };
    }

    private static string[] TagsFor(TinyRustLmMemoryEndpointRecord record)
    {
        var tags = new SortedSet<string>(StringComparer.Ordinal)
        {
            "tinyrustlm",
            "memoryendpoints",
            record.Scope.Replace('_', '-'),
            $"scope:{TinyRustLmMemoryScopeId}"
        };
        foreach (var tag in record.Tags ?? Array.Empty<string>())
        {
            var cleaned = tag.Trim();
            if (!string.IsNullOrWhiteSpace(cleaned))
            {
                tags.Add(cleaned);
            }
        }

        return tags.ToArray();
    }

    private static Uri RequireConfiguredRoute(Uri? route, string name) =>
        route ?? throw new InvalidOperationException(
            $"MemoryEndpoints route {name} is not configured. Use MemoryEndpointsRoutes.FromBaseUri or set the optional meeting-room route.");

    private static void RejectMeetingScope(string value, bool allowCompanyWorkspaceProject, string name)
    {
        var trimmed = value.Trim();
        var allowed = allowCompanyWorkspaceProject
            ? new[] { "company", "workspace", "project", "goal", "task" }
            : new[] { "goal", "task" };
        if (!allowed.Contains(trimmed, StringComparer.Ordinal))
        {
            throw new ArgumentException(
                allowCompanyWorkspaceProject
                    ? "Meeting scope must be company, workspace, project, goal, or task."
                    : "Created meeting-room scope must be goal or task.",
                name);
        }
    }

    private static void RejectIdentifier(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.Length > 128 ||
            value.Any(ch => !(char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' or '.')))
        {
            throw new ArgumentException("Identifier is required and may contain only letters, digits, dash, underscore, or dot.", name);
        }
    }

    private static void RejectPublicSecret(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Public-safe text is required.", name);
        }
        if (value.Length > MaxSafeTextChars)
        {
            throw new ArgumentException($"Public-safe text may not exceed {MaxSafeTextChars} characters.", name);
        }
        if (value.Any(ch => char.IsControl(ch) && ch is not '\r' and not '\n' and not '\t'))
        {
            throw new ArgumentException("Public-safe text contains unsupported control characters.", name);
        }
        if (MemoryEndpointsClientOptions.LooksLikeSecret(value))
        {
            throw new ArgumentException("Public-safe text appears to contain secret material.", name);
        }
    }

    private static void RejectOptionalPublicSecret(string? value, string name)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            RejectPublicSecret(value, name);
        }
    }

    private static Uri AddQuery(Uri uri, params (string Name, string Value)[] values)
    {
        var separator = string.IsNullOrEmpty(uri.Query) ? "?" : "&";
        var query = string.Join(
            "&",
            values.Select(value =>
                $"{Uri.EscapeDataString(value.Name)}={Uri.EscapeDataString(value.Value)}"));
        return new Uri(uri + separator + query);
    }

    private readonly record struct DistributedSyncHttpResponse(
        HttpStatusCode StatusCode,
        string Body);
}
