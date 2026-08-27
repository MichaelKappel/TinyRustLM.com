using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM;

/// <summary>Durable state of one logical MemoryEndpoints hosted-memory mutation.</summary>
[JsonConverter(typeof(MemoryEndpointsOutboxStateJsonConverter))]
public enum MemoryEndpointsOutboxState
{
    /// <summary>The public-safe operation and local receipt committed to durable local storage.</summary>
    SavedLocally,

    /// <summary>The operation is eligible for the next synchronization attempt.</summary>
    Queued,

    /// <summary>One synchronization leader currently owns the network attempt.</summary>
    Sending,

    /// <summary>A bounded retry is pending with the original body and idempotency key.</summary>
    RetryPending,

    /// <summary>A matching authoritative hosted receipt was verified and retained.</summary>
    Synchronized,

    /// <summary>Validation failed and the operation must never be sent automatically.</summary>
    Quarantined
}

/// <summary>Public-safe retry metadata retained with a local outbox entry.</summary>
public sealed record MemoryEndpointsRetryState(
    uint AttemptCount,
    long? LastAttemptAtUnixMs,
    long? NextAttemptAtUnixMs,
    string? LastErrorCode)
{
    /// <summary>Creates retry metadata for an operation that has not been sent.</summary>
    public static MemoryEndpointsRetryState Empty { get; } = new(0, null, null, null);
}

/// <summary>Receipt proving that one public-safe mutation committed to local durable storage.</summary>
public sealed record MemoryEndpointsLocalReceipt(
    string Kind,
    uint Version,
    string EventId,
    string PayloadSha256,
    string DeviceId,
    long CommittedAtUnixMs);

/// <summary>Public-safe receipt proving acceptance by the authoritative hosted service.</summary>
public sealed record MemoryEndpointsAuthoritativeReceipt(
    string Kind,
    uint Version,
    string EventId,
    string IdempotencyKey,
    string PayloadSha256,
    string MemoryEventId,
    string? ReceiptId,
    bool Persisted,
    long AcceptedAtUnixMs,
    string? RevisionId,
    ulong? ServerSequence);

/// <summary>Normalized public MemoryEndpoints memory-event submit payload.</summary>
public sealed record MemoryEndpointsSubmitPayload(
    string WorkspaceId,
    string ActorAgentId,
    string Kind,
    uint Version,
    string Scope,
    string ScopeId,
    string MemoryType,
    string Subject,
    string Title,
    string Summary,
    string Source,
    double Confidence,
    IReadOnlyList<string> UaiReferences,
    IReadOnlyList<string> Tags,
    string TinyrustlmMemoryTier,
    string? SourceSha256)
{
    /// <inheritdoc />
    public bool Equals(MemoryEndpointsSubmitPayload? other) =>
        other is not null &&
        WorkspaceId == other.WorkspaceId &&
        ActorAgentId == other.ActorAgentId &&
        Kind == other.Kind &&
        Version == other.Version &&
        Scope == other.Scope &&
        ScopeId == other.ScopeId &&
        MemoryType == other.MemoryType &&
        Subject == other.Subject &&
        Title == other.Title &&
        Summary == other.Summary &&
        Source == other.Source &&
        Confidence.Equals(other.Confidence) &&
        UaiReferences.SequenceEqual(other.UaiReferences, StringComparer.Ordinal) &&
        Tags.SequenceEqual(other.Tags, StringComparer.Ordinal) &&
        TinyrustlmMemoryTier == other.TinyrustlmMemoryTier &&
        SourceSha256 == other.SourceSha256;

    /// <inheritdoc />
    public override int GetHashCode()
    {
        var hash = new HashCode();
        hash.Add(WorkspaceId, StringComparer.Ordinal);
        hash.Add(ActorAgentId, StringComparer.Ordinal);
        hash.Add(Kind, StringComparer.Ordinal);
        hash.Add(Version);
        hash.Add(Scope, StringComparer.Ordinal);
        hash.Add(ScopeId, StringComparer.Ordinal);
        hash.Add(MemoryType, StringComparer.Ordinal);
        hash.Add(Subject, StringComparer.Ordinal);
        hash.Add(Title, StringComparer.Ordinal);
        hash.Add(Summary, StringComparer.Ordinal);
        hash.Add(Source, StringComparer.Ordinal);
        hash.Add(Confidence);
        foreach (var reference in UaiReferences)
        {
            hash.Add(reference, StringComparer.Ordinal);
        }
        foreach (var tag in Tags)
        {
            hash.Add(tag, StringComparer.Ordinal);
        }
        hash.Add(TinyrustlmMemoryTier, StringComparer.Ordinal);
        hash.Add(SourceSha256, StringComparer.Ordinal);
        return hash.ToHashCode();
    }
}

/// <summary>Credential-free durable representation of one hosted-memory mutation.</summary>
public sealed record MemoryEndpointsOutboxEntry(
    string Kind,
    uint Version,
    string EventId,
    string DeviceId,
    string IdempotencyKey,
    string PayloadSha256,
    MemoryEndpointsSubmitPayload Payload,
    string Scope,
    MemoryEndpointsOutboxState State,
    MemoryEndpointsRetryState Retry,
    MemoryEndpointsLocalReceipt LocalReceipt,
    MemoryEndpointsAuthoritativeReceipt? AuthoritativeReceipt,
    string? QuarantineReason,
    long CreatedAtUnixMs,
    long UpdatedAtUnixMs)
{
    /// <summary>Marks this locally committed operation eligible for synchronization.</summary>
    public MemoryEndpointsOutboxEntry MarkQueued(long nowUnixMs)
    {
        MemoryEndpointsSyncContract.ValidateOutboxEntry(this);
        RequireState(MemoryEndpointsOutboxState.SavedLocally, "mark queued");
        RequireMonotonicTime(nowUnixMs);
        return Validated(this with
        {
            State = MemoryEndpointsOutboxState.Queued,
            UpdatedAtUnixMs = nowUnixMs
        });
    }

    /// <summary>Begins one network attempt without changing event identity or payload.</summary>
    public MemoryEndpointsOutboxEntry BeginSend(long nowUnixMs)
    {
        MemoryEndpointsSyncContract.ValidateOutboxEntry(this);
        if (!IsSendable(nowUnixMs))
        {
            throw new InvalidOperationException($"Cannot begin send from {State}.");
        }
        RequireMonotonicTime(nowUnixMs);
        if (Retry.AttemptCount == uint.MaxValue)
        {
            throw new InvalidOperationException("MemoryEndpoints attempt count overflow.");
        }
        return Validated(this with
        {
            State = MemoryEndpointsOutboxState.Sending,
            Retry = Retry with
            {
                AttemptCount = Retry.AttemptCount + 1,
                LastAttemptAtUnixMs = nowUnixMs,
                NextAttemptAtUnixMs = null,
                LastErrorCode = null
            },
            UpdatedAtUnixMs = nowUnixMs
        });
    }

    /// <summary>Schedules a bounded retry while preserving the key and payload fingerprint.</summary>
    public MemoryEndpointsOutboxEntry ScheduleRetry(
        string errorCode,
        long nextAttemptAtUnixMs,
        long nowUnixMs)
    {
        MemoryEndpointsSyncContract.ValidateOutboxEntry(this);
        RequireState(MemoryEndpointsOutboxState.Sending, "schedule retry");
        MemoryEndpointsSyncContract.ValidateIdentifier("error code", errorCode, 96);
        RequireMonotonicTime(nowUnixMs);
        if (nextAttemptAtUnixMs < nowUnixMs)
        {
            throw new InvalidOperationException("Next retry time must not precede the transition time.");
        }
        return Validated(this with
        {
            State = MemoryEndpointsOutboxState.RetryPending,
            Retry = Retry with
            {
                NextAttemptAtUnixMs = nextAttemptAtUnixMs,
                LastErrorCode = errorCode
            },
            UpdatedAtUnixMs = nowUnixMs
        });
    }

    /// <summary>Applies a matching authoritative receipt and marks this operation synchronized.</summary>
    public MemoryEndpointsOutboxEntry ApplyAuthoritativeReceipt(
        MemoryEndpointsAuthoritativeReceipt receipt,
        long nowUnixMs)
    {
        ArgumentNullException.ThrowIfNull(receipt);
        MemoryEndpointsSyncContract.ValidateOutboxEntry(this);
        if (State is not (MemoryEndpointsOutboxState.Queued or
            MemoryEndpointsOutboxState.Sending or
            MemoryEndpointsOutboxState.RetryPending))
        {
            throw new InvalidOperationException($"Cannot apply authoritative receipt from {State}.");
        }
        MemoryEndpointsSyncContract.ValidateAuthoritativeReceipt(this, receipt);
        RequireMonotonicTime(nowUnixMs);
        if (nowUnixMs < receipt.AcceptedAtUnixMs)
        {
            throw new InvalidOperationException("Receipt acceptance time follows the local transition time.");
        }
        return Validated(this with
        {
            State = MemoryEndpointsOutboxState.Synchronized,
            Retry = Retry with { NextAttemptAtUnixMs = null, LastErrorCode = null },
            AuthoritativeReceipt = receipt,
            UpdatedAtUnixMs = nowUnixMs
        });
    }

    /// <summary>Quarantines a structurally valid entry so it cannot be sent automatically.</summary>
    public MemoryEndpointsOutboxEntry Quarantine(string reasonCode, long nowUnixMs)
    {
        MemoryEndpointsSyncContract.ValidateOutboxEntry(this);
        if (State == MemoryEndpointsOutboxState.Synchronized)
        {
            throw new InvalidOperationException("A synchronized entry cannot be quarantined.");
        }
        MemoryEndpointsSyncContract.ValidateIdentifier("quarantine reason", reasonCode, 96);
        RequireMonotonicTime(nowUnixMs);
        return Validated(this with
        {
            State = MemoryEndpointsOutboxState.Quarantined,
            QuarantineReason = reasonCode,
            UpdatedAtUnixMs = nowUnixMs
        });
    }

    /// <summary>Returns whether this entry may be sent at the supplied time.</summary>
    public bool IsSendable(long nowUnixMs) =>
        State == MemoryEndpointsOutboxState.Queued ||
        State == MemoryEndpointsOutboxState.RetryPending &&
        Retry.NextAttemptAtUnixMs is long next && next <= nowUnixMs;

    private MemoryEndpointsOutboxEntry Validated(MemoryEndpointsOutboxEntry candidate)
    {
        MemoryEndpointsSyncContract.ValidateOutboxEntry(candidate);
        return candidate;
    }

    private void RequireState(MemoryEndpointsOutboxState expected, string action)
    {
        if (State != expected)
        {
            throw new InvalidOperationException($"Cannot {action} from {State}.");
        }
    }

    private void RequireMonotonicTime(long candidate)
    {
        if (candidate < UpdatedAtUnixMs)
        {
            throw new InvalidOperationException("MemoryEndpoints state transition time moved backwards.");
        }
    }
}

/// <summary>Deterministic cross-runtime MemoryEndpoints outbox and receipt contract.</summary>
public static class MemoryEndpointsSyncContract
{
    /// <summary>Stable persisted outbox-entry schema kind.</summary>
    public const string OutboxEntryKind = "tinyrustlm.memory_endpoints.outbox_entry.v2";

    /// <summary>Stable local-commit receipt schema kind.</summary>
    public const string LocalReceiptKind = "tinyrustlm.memory_endpoints.local_receipt.v2";

    /// <summary>Stable authoritative hosted receipt schema kind.</summary>
    public const string AuthoritativeReceiptKind = "tinyrustlm.memory_endpoints.authoritative_receipt.v1";

    /// <summary>Stable public memory-record schema kind.</summary>
    public const string MemoryRecordKind = "tinyrustlm.memory_endpoints.memory_record.v1";

    /// <summary>Public-safe source label shared by Rust, .NET, and browser payloads.</summary>
    public const string ConnectorSource = "TinyRustLM MemoryEndpoints connector";

    private const string PayloadDigestDomain = "tinyrustlm.memory_endpoints.submit_payload.digest.v2";
    private static readonly JsonSerializerOptions PersistedJsonOptions = CreatePersistedJsonOptions();

    /// <summary>Creates a deterministic, credential-free outbox entry and local receipt.</summary>
    public static MemoryEndpointsOutboxEntry PrepareOutboxEntry(
        TinyRustLmMemoryEndpointRecord record,
        string workspaceId,
        string agentId,
        string eventId,
        string deviceId,
        long committedAtUnixMs)
    {
        ArgumentNullException.ThrowIfNull(record);
        ValidateMemoryRecord(record);
        ValidateIdentifier("workspace ID", workspaceId, 128);
        ValidateIdentifier("agent ID", agentId, 96);
        ValidateIdentifier("event ID", eventId, 64);
        ValidateIdentifier("device ID", deviceId, 96);
        if (committedAtUnixMs <= 0)
        {
            throw new InvalidOperationException("MemoryEndpoints commit time must be greater than zero.");
        }

        var payload = CreateSubmitPayload(record, workspaceId, agentId);
        var payloadSha256 = ComputePayloadSha256(payload);
        var idempotencyKey = CreateIdempotencyKey(eventId, payloadSha256);
        return new MemoryEndpointsOutboxEntry(
            OutboxEntryKind,
            2,
            eventId,
            deviceId,
            idempotencyKey,
            payloadSha256,
            payload,
            record.Scope,
            MemoryEndpointsOutboxState.SavedLocally,
            MemoryEndpointsRetryState.Empty,
            new MemoryEndpointsLocalReceipt(
                LocalReceiptKind,
                2,
                eventId,
                payloadSha256,
                deviceId,
                committedAtUnixMs),
            null,
            null,
            committedAtUnixMs,
            committedAtUnixMs);
    }

    /// <summary>Creates the normalized public submit payload used by direct and queued writes.</summary>
    public static MemoryEndpointsSubmitPayload CreateSubmitPayload(
        TinyRustLmMemoryEndpointRecord record,
        string workspaceId,
        string agentId)
    {
        ArgumentNullException.ThrowIfNull(record);
        ValidateMemoryRecord(record);
        ValidateIdentifier("workspace ID", workspaceId, 128);
        ValidateIdentifier("agent ID", agentId, 96);
        var memoryType = record.Scope == "long_term" ? "handoff" : "status";
        var tags = NormalizeSet((record.Tags ?? Array.Empty<string>()).Concat(new[]
        {
            "tinyrustlm",
            "memoryendpoints",
            record.Scope.Replace('_', '-'),
            "scope:tinyrustlm.com"
        }));
        return new MemoryEndpointsSubmitPayload(
            workspaceId,
            agentId,
            MemoryRecordKind,
            1,
            "project",
            "tinyrustlm.com",
            memoryType,
            record.Title,
            record.Title,
            record.SafeSummary,
            ConnectorSource,
            0.8,
            NormalizeSet(record.UaiReferences ?? Array.Empty<string>()),
            tags,
            record.Scope,
            record.SourceSha256);
    }

    /// <summary>Computes the cross-runtime SHA-256 for a normalized semantic submit payload.</summary>
    public static string ComputePayloadSha256(MemoryEndpointsSubmitPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        ValidateSubmitPayload(payload);
        if (!payload.UaiReferences.SequenceEqual(NormalizeSet(payload.UaiReferences), StringComparer.Ordinal) ||
            !payload.Tags.SequenceEqual(NormalizeSet(payload.Tags), StringComparer.Ordinal))
        {
            throw new InvalidOperationException(
                "MemoryEndpoints payload collections must be sorted, trimmed, and deduplicated.");
        }

        var material = new StringBuilder();
        AppendString(material, "domain", PayloadDigestDomain);
        AppendString(material, "workspace_id", payload.WorkspaceId);
        AppendString(material, "actor_agent_id", payload.ActorAgentId);
        AppendString(material, "kind", payload.Kind);
        AppendUnsigned(material, "version", payload.Version);
        AppendString(material, "scope", payload.Scope);
        AppendString(material, "scope_id", payload.ScopeId);
        AppendString(material, "memory_type", payload.MemoryType);
        AppendString(material, "subject", payload.Subject);
        AppendString(material, "title", payload.Title);
        AppendString(material, "summary", payload.Summary);
        AppendString(material, "source", payload.Source);
        AppendUnsigned(material, "confidence_micros", ConfidenceMicros(payload.Confidence));
        AppendArray(material, "uai_references", payload.UaiReferences);
        AppendArray(material, "tags", payload.Tags);
        AppendString(material, "tinyrustlm_memory_tier", payload.TinyrustlmMemoryTier);
        if (payload.SourceSha256 is null)
        {
            AppendUnsigned(material, "source_sha256_present", 0);
        }
        else
        {
            AppendUnsigned(material, "source_sha256_present", 1);
            AppendString(material, "source_sha256", payload.SourceSha256);
        }

        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(material.ToString()));
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    /// <summary>Validates all structural, fingerprint, receipt, and state invariants.</summary>
    public static void ValidateOutboxEntry(MemoryEndpointsOutboxEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        if (entry.Kind != OutboxEntryKind || entry.Version != 2)
        {
            throw new InvalidOperationException("Unsupported MemoryEndpoints outbox kind or version.");
        }
        ValidateIdentifier("event ID", entry.EventId, 64);
        ValidateIdentifier("device ID", entry.DeviceId, 96);
        ValidateSubmitPayload(entry.Payload);
        var normalizedHash = ComputePayloadSha256(entry.Payload);
        if (entry.PayloadSha256 != normalizedHash)
        {
            throw new InvalidOperationException("MemoryEndpoints payload fingerprint mismatch.");
        }
        if (entry.IdempotencyKey != CreateIdempotencyKey(entry.EventId, normalizedHash))
        {
            throw new InvalidOperationException("MemoryEndpoints idempotency key does not match its event and payload.");
        }
        if (entry.Scope != entry.Payload.TinyrustlmMemoryTier)
        {
            throw new InvalidOperationException("MemoryEndpoints outbox scope does not match payload tier.");
        }
        if (entry.LocalReceipt.Kind != LocalReceiptKind ||
            entry.LocalReceipt.Version != 2 ||
            entry.LocalReceipt.EventId != entry.EventId ||
            entry.LocalReceipt.PayloadSha256 != entry.PayloadSha256 ||
            entry.LocalReceipt.DeviceId != entry.DeviceId ||
            entry.LocalReceipt.CommittedAtUnixMs != entry.CreatedAtUnixMs)
        {
            throw new InvalidOperationException("MemoryEndpoints local receipt does not match its operation.");
        }
        if (entry.CreatedAtUnixMs <= 0 || entry.UpdatedAtUnixMs < entry.CreatedAtUnixMs)
        {
            throw new InvalidOperationException("MemoryEndpoints outbox timestamps are invalid.");
        }
        ValidateRetryState(entry);
        if (entry.State == MemoryEndpointsOutboxState.Synchronized)
        {
            if (entry.AuthoritativeReceipt is null || entry.QuarantineReason is not null)
            {
                throw new InvalidOperationException("Synchronized MemoryEndpoints entry requires only an authoritative receipt.");
            }
            ValidateAuthoritativeReceipt(entry, entry.AuthoritativeReceipt);
        }
        else if (entry.State == MemoryEndpointsOutboxState.Quarantined)
        {
            if (entry.QuarantineReason is null || entry.AuthoritativeReceipt is not null)
            {
                throw new InvalidOperationException("Quarantined MemoryEndpoints entry requires only a reason code.");
            }
            ValidateIdentifier("quarantine reason", entry.QuarantineReason, 96);
        }
        else if (entry.AuthoritativeReceipt is not null || entry.QuarantineReason is not null)
        {
            throw new InvalidOperationException("Pending MemoryEndpoints entry contains terminal-state metadata.");
        }
    }

    /// <summary>Validates an authoritative receipt against one immutable outbox operation.</summary>
    public static void ValidateAuthoritativeReceipt(
        MemoryEndpointsOutboxEntry entry,
        MemoryEndpointsAuthoritativeReceipt receipt)
    {
        ArgumentNullException.ThrowIfNull(entry);
        ArgumentNullException.ThrowIfNull(receipt);
        if (receipt.Kind != AuthoritativeReceiptKind || receipt.Version != 1)
        {
            throw new InvalidOperationException("Unsupported MemoryEndpoints authoritative receipt kind or version.");
        }
        if (receipt.EventId != entry.EventId ||
            receipt.IdempotencyKey != entry.IdempotencyKey ||
            receipt.PayloadSha256 != entry.PayloadSha256)
        {
            throw new InvalidOperationException("MemoryEndpoints authoritative receipt does not match its local operation.");
        }
        if (!receipt.Persisted)
        {
            throw new InvalidOperationException("MemoryEndpoints authoritative receipt does not prove persistence.");
        }
        ValidateIdentifier("memory event ID", receipt.MemoryEventId, 128);
        ValidateOptionalIdentifier("receipt ID", receipt.ReceiptId, 128);
        ValidateOptionalIdentifier("revision ID", receipt.RevisionId, 128);
        if (receipt.AcceptedAtUnixMs <= 0 || receipt.ServerSequence == 0)
        {
            throw new InvalidOperationException("MemoryEndpoints receipt timestamp or sequence is invalid.");
        }
    }

    /// <summary>Serializes one validated outbox entry without credentials or unknown fields.</summary>
    public static string SerializeOutboxEntry(MemoryEndpointsOutboxEntry entry)
    {
        ValidateOutboxEntry(entry);
        return JsonSerializer.Serialize(entry, PersistedJsonOptions);
    }

    /// <summary>Deserializes and validates one strict credential-free outbox entry.</summary>
    public static MemoryEndpointsOutboxEntry DeserializeOutboxEntry(string json)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(json);
        var entry = JsonSerializer.Deserialize<MemoryEndpointsOutboxEntry>(json, PersistedJsonOptions)
            ?? throw new JsonException("MemoryEndpoints outbox JSON was null.");
        ValidateOutboxEntry(entry);
        return entry;
    }

    internal static void ValidateIdentifier(string label, string value, int maxChars)
    {
        if (string.IsNullOrEmpty(value) ||
            value.Length > maxChars ||
            value.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch is not '-' and not '_' and not '.'))
        {
            throw new InvalidOperationException(
                $"MemoryEndpoints {label} is missing or contains unsupported characters.");
        }
    }

    private static JsonSerializerOptions CreatePersistedJsonOptions() => new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = false
    };

    private static void ValidateMemoryRecord(TinyRustLmMemoryEndpointRecord record)
    {
        if (record.Scope is not ("short_term" or "long_term"))
        {
            throw new InvalidOperationException("MemoryEndpoints scope must be short_term or long_term.");
        }
        ValidatePublicText("title", record.Title);
        ValidatePublicText("summary", record.SafeSummary);
        foreach (var reference in record.UaiReferences ?? Array.Empty<string>())
        {
            var normalized = reference.Replace('\\', '/');
            if (string.IsNullOrWhiteSpace(normalized) ||
                normalized.Contains("..", StringComparison.Ordinal) ||
                normalized.Contains(':') ||
                normalized.StartsWith('/') ||
                !(normalized.StartsWith(".uai/", StringComparison.Ordinal) ||
                  normalized.StartsWith("docs/", StringComparison.Ordinal) ||
                  normalized.StartsWith("wiki/", StringComparison.Ordinal) ||
                  normalized.EndsWith(".uai", StringComparison.Ordinal)))
            {
                throw new InvalidOperationException("MemoryEndpoints references must be safe .uai/docs/wiki paths.");
            }
        }
        if (record.Scope == "long_term" && (record.UaiReferences is null || record.UaiReferences.Count == 0))
        {
            throw new InvalidOperationException("Long-term MemoryEndpoints records require a durable reference.");
        }
        if (record.SourceSha256 is not null && !IsSha256(record.SourceSha256))
        {
            throw new InvalidOperationException("MemoryEndpoints source SHA-256 is invalid.");
        }
        foreach (var tag in record.Tags ?? Array.Empty<string>())
        {
            ValidatePublicText("tag", tag);
        }
    }

    private static void ValidateSubmitPayload(MemoryEndpointsSubmitPayload payload)
    {
        ValidateIdentifier("workspace ID", payload.WorkspaceId, 128);
        ValidateIdentifier("actor agent ID", payload.ActorAgentId, 96);
        if (payload.Kind != MemoryRecordKind ||
            payload.Version != 1 ||
            payload.Scope != "project" ||
            payload.ScopeId != "tinyrustlm.com" ||
            payload.MemoryType != (payload.TinyrustlmMemoryTier == "long_term" ? "handoff" : "status") ||
            payload.TinyrustlmMemoryTier is not ("short_term" or "long_term") ||
            payload.Subject != payload.Title ||
            payload.Source != ConnectorSource)
        {
            throw new InvalidOperationException("MemoryEndpoints submit payload contract fields are inconsistent.");
        }
        ValidateMemoryRecord(new TinyRustLmMemoryEndpointRecord(
            payload.TinyrustlmMemoryTier,
            payload.Title,
            payload.Summary,
            payload.UaiReferences,
            payload.Tags,
            payload.SourceSha256));
        _ = ConfidenceMicros(payload.Confidence);
    }

    private static void ValidateRetryState(MemoryEndpointsOutboxEntry entry)
    {
        if (entry.Retry.LastErrorCode is not null)
        {
            ValidateIdentifier("last error code", entry.Retry.LastErrorCode, 96);
        }
        if (entry.State is MemoryEndpointsOutboxState.SavedLocally or MemoryEndpointsOutboxState.Queued)
        {
            if (entry.Retry.AttemptCount == 0 &&
                (entry.Retry.LastAttemptAtUnixMs is not null ||
                 entry.Retry.NextAttemptAtUnixMs is not null ||
                 entry.Retry.LastErrorCode is not null))
            {
                throw new InvalidOperationException("Unattempted MemoryEndpoints entry contains retry metadata.");
            }
        }
        else if (entry.State == MemoryEndpointsOutboxState.Sending)
        {
            if (entry.Retry.AttemptCount == 0 ||
                entry.Retry.LastAttemptAtUnixMs is null ||
                entry.Retry.NextAttemptAtUnixMs is not null ||
                entry.Retry.LastErrorCode is not null)
            {
                throw new InvalidOperationException("Sending MemoryEndpoints entry has inconsistent retry metadata.");
            }
        }
        else if (entry.State == MemoryEndpointsOutboxState.RetryPending &&
            (entry.Retry.AttemptCount == 0 ||
             entry.Retry.LastAttemptAtUnixMs is null ||
             entry.Retry.NextAttemptAtUnixMs is null ||
             entry.Retry.LastErrorCode is null))
        {
            throw new InvalidOperationException("Retry-pending MemoryEndpoints entry has incomplete retry metadata.");
        }
    }

    private static string CreateIdempotencyKey(string eventId, string payloadSha256)
    {
        ValidateIdentifier("event ID", eventId, 64);
        if (!IsSha256(payloadSha256))
        {
            throw new InvalidOperationException("MemoryEndpoints payload fingerprint is invalid.");
        }
        return $"tinyrustlm-memory-v2-{eventId}-{payloadSha256[..24]}";
    }

    private static IReadOnlyList<string> NormalizeSet(IEnumerable<string> values)
    {
        var normalized = new SortedSet<string>(Utf8OrdinalComparer.Instance);
        foreach (var value in values)
        {
            var trimmed = value.Trim();
            if (trimmed.Length > 0)
            {
                normalized.Add(trimmed);
            }
        }
        return normalized.ToArray();
    }

    private static void ValidatePublicText(string label, string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 16 * 1024)
        {
            throw new InvalidOperationException($"MemoryEndpoints public-safe {label} is missing or too long.");
        }
        if (value.Any(ch => char.IsControl(ch) && ch is not '\r' and not '\n' and not '\t') ||
            MemoryEndpointsClientOptions.LooksLikeSecret(value))
        {
            throw new InvalidOperationException($"MemoryEndpoints public-safe {label} is unsafe.");
        }
    }

    private static bool IsSha256(string value) =>
        value.Length == 64 && value.All(ch => ch is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static ulong ConfidenceMicros(double confidence)
    {
        if (!double.IsFinite(confidence) || confidence is < 0 or > 1)
        {
            throw new InvalidOperationException("MemoryEndpoints confidence must be finite and between zero and one.");
        }
        return checked((ulong)Math.Round(confidence * 1_000_000, MidpointRounding.AwayFromZero));
    }

    private static void AppendString(StringBuilder output, string name, string value) =>
        output.Append(name)
            .Append(':')
            .Append(Encoding.UTF8.GetByteCount(value))
            .Append(':')
            .Append(value)
            .Append('\n');

    private static void AppendUnsigned(StringBuilder output, string name, ulong value) =>
        AppendString(output, name, value.ToString(System.Globalization.CultureInfo.InvariantCulture));

    private static void AppendArray(StringBuilder output, string name, IReadOnlyList<string> values)
    {
        AppendUnsigned(output, $"{name}_count", checked((ulong)values.Count));
        foreach (var value in values)
        {
            AppendString(output, name, value);
        }
    }

    private static void ValidateOptionalIdentifier(string label, string? value, int maxChars)
    {
        if (value is not null)
        {
            ValidateIdentifier(label, value, maxChars);
        }
    }

    private sealed class Utf8OrdinalComparer : IComparer<string>
    {
        public static Utf8OrdinalComparer Instance { get; } = new();

        public int Compare(string? x, string? y)
        {
            if (ReferenceEquals(x, y))
            {
                return 0;
            }
            if (x is null)
            {
                return -1;
            }
            if (y is null)
            {
                return 1;
            }
            return Encoding.UTF8.GetBytes(x).AsSpan().SequenceCompareTo(Encoding.UTF8.GetBytes(y));
        }
    }
}

internal sealed class MemoryEndpointsOutboxStateJsonConverter : JsonConverter<MemoryEndpointsOutboxState>
{
    public override MemoryEndpointsOutboxState Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options) =>
        reader.GetString() switch
        {
            "saved_locally" => MemoryEndpointsOutboxState.SavedLocally,
            "queued" => MemoryEndpointsOutboxState.Queued,
            "sending" => MemoryEndpointsOutboxState.Sending,
            "retry_pending" => MemoryEndpointsOutboxState.RetryPending,
            "synchronized" => MemoryEndpointsOutboxState.Synchronized,
            "quarantined" => MemoryEndpointsOutboxState.Quarantined,
            _ => throw new JsonException("Unsupported MemoryEndpoints outbox state.")
        };

    public override void Write(
        Utf8JsonWriter writer,
        MemoryEndpointsOutboxState value,
        JsonSerializerOptions options) =>
        writer.WriteStringValue(value switch
        {
            MemoryEndpointsOutboxState.SavedLocally => "saved_locally",
            MemoryEndpointsOutboxState.Queued => "queued",
            MemoryEndpointsOutboxState.Sending => "sending",
            MemoryEndpointsOutboxState.RetryPending => "retry_pending",
            MemoryEndpointsOutboxState.Synchronized => "synchronized",
            MemoryEndpointsOutboxState.Quarantined => "quarantined",
            _ => throw new JsonException("Unsupported MemoryEndpoints outbox state.")
        });
}
