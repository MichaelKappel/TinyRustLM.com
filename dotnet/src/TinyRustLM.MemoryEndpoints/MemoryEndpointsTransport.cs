using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TinyRustLM;

/// <summary>Operation accepted by the deployed MemoryEndpoints sync mutation route.</summary>
public enum MemoryEndpointsHostedSyncOperation
{
    /// <summary>Creates or updates an active logical memory.</summary>
    Upsert,

    /// <summary>Creates an authoritative tombstoned head.</summary>
    Delete,

    /// <summary>Requests hard forget; v1 records a durable rejected receipt.</summary>
    HardForget
}

/// <summary>Durable hosted mutation status.</summary>
public enum MemoryEndpointsHostedSyncStatus
{
    /// <summary>The mutation became the current authoritative head.</summary>
    Applied,

    /// <summary>The mutation was durably recorded as a stale-parent conflict.</summary>
    Conflict,

    /// <summary>The mutation was durably rejected by authority or retention policy.</summary>
    Rejected
}

/// <summary>Hosted device lifecycle state.</summary>
public enum MemoryEndpointsHostedDeviceStatus
{
    /// <summary>The device may submit with its current authority epoch.</summary>
    Active,

    /// <summary>The device can no longer submit queued mutations.</summary>
    Revoked
}

/// <summary>Hosted logical-memory head state.</summary>
public enum MemoryEndpointsHostedHeadStatus
{
    /// <summary>The logical memory has an active head.</summary>
    Active,

    /// <summary>The logical memory has a deletion tombstone head.</summary>
    Tombstoned
}

/// <summary>Public-safe mutation accepted by the deployed hosted sync route.</summary>
public sealed record MemoryEndpointsHostedRevisionMutation(
    string WorkspaceId,
    string ActorAgentId,
    string DeviceId,
    ulong DeviceEpoch,
    string LogicalMemoryId,
    MemoryEndpointsHostedSyncOperation Operation,
    string? ParentRevisionId,
    string Title,
    string Summary,
    string SourceRef,
    string Scope,
    string ScopeId,
    string MemoryType,
    string BodyHash);

/// <summary>Request used to register a stable hosted sync device.</summary>
public sealed record MemoryEndpointsRegisterDeviceRequest(
    string WorkspaceId,
    string AgentId,
    string DeviceId,
    string Label);

/// <summary>Request used to rotate a device authority epoch.</summary>
public sealed record MemoryEndpointsRotateDeviceRequest(
    string WorkspaceId,
    string AgentId,
    string DeviceId);

/// <summary>Request used to revoke a hosted sync device.</summary>
public sealed record MemoryEndpointsRevokeDeviceRequest(
    string WorkspaceId,
    string AgentId,
    string DeviceId);

/// <summary>Redacted hosted device authority record.</summary>
public sealed record MemoryEndpointsHostedDeviceAuthority(
    string DeviceId,
    string WorkspaceId,
    string AgentId,
    string Label,
    MemoryEndpointsHostedDeviceStatus Status,
    ulong AuthorityEpoch,
    string CreatedAt,
    string UpdatedAt,
    string? RevokedAt,
    bool ValuesRedacted,
    bool RawPayloadExposed);

/// <summary>Public-safe operator summary returned by device authority routes.</summary>
public sealed record MemoryEndpointsDeviceOperatorSummary(
    string SchemaVersion,
    string Action,
    string DeviceId,
    MemoryEndpointsHostedDeviceStatus Status,
    ulong AuthorityEpoch,
    bool Persisted,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Authoritative response from register, rotate, or revoke.</summary>
public sealed record MemoryEndpointsDeviceAuthorityResponse(
    bool Ok,
    bool Persisted,
    bool VisibleToAgent,
    bool DeviceAuthorityPersisted,
    string CanonicalWorkspaceId,
    string CanonicalDeviceId,
    MemoryEndpointsHostedDeviceAuthority Device,
    string CapabilityRoute,
    MemoryEndpointsDeviceOperatorSummary OperatorSummary,
    bool IdempotentReplay,
    bool IdempotencyKeyExposed,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Body-free durable hosted mutation receipt.</summary>
public sealed record MemoryEndpointsReconciliationReceipt(
    string ReceiptId,
    string WorkspaceId,
    string IdempotencyKeyHash,
    string BodyHash,
    string LogicalMemoryId,
    string SyncRevisionId,
    ulong ServerSequence,
    MemoryEndpointsHostedSyncStatus Status,
    bool Conflict,
    string ConflictCode,
    string CurrentHeadRevisionId,
    string HttpStatus,
    string CreatedAt,
    bool IdempotencyKeyExposed,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Public-safe immutable hosted revision returned by mutation and pull routes.</summary>
public sealed record MemoryEndpointsHostedRevision(
    string SyncRevisionId,
    string WorkspaceId,
    string LogicalMemoryId,
    string ParentRevisionId,
    string MemoryEventId,
    string ActorAgentId,
    string DeviceId,
    ulong DeviceEpoch,
    MemoryEndpointsHostedSyncOperation Operation,
    MemoryEndpointsHostedSyncStatus Status,
    bool Conflict,
    string ConflictCode,
    ulong ServerSequence,
    string BodyHash,
    string Source,
    string Title,
    string Summary,
    string Scope,
    string ScopeId,
    string MemoryType,
    bool Tombstone,
    string CreatedAt,
    bool ValuesRedacted,
    bool RawPayloadExposed);

/// <summary>Authoritative logical-memory head.</summary>
public sealed record MemoryEndpointsHostedRevisionHead(
    string LogicalMemoryId,
    string WorkspaceId,
    string HeadRevisionId,
    ulong ServerSequence,
    ulong IndexedThroughSequence,
    MemoryEndpointsHostedHeadStatus Status,
    string UpdatedAt,
    bool ValuesRedacted,
    bool RawPayloadExposed);

/// <summary>Redacted mutation operator summary.</summary>
public sealed record MemoryEndpointsMutationOperatorSummary(
    string SchemaVersion,
    string Action,
    string Status,
    ulong ServerSequence,
    bool Conflict,
    string ConflictCode,
    bool Persisted,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Immediate receipt, changes, and head readback confirmation.</summary>
public sealed record MemoryEndpointsMutationConfirmation(
    string SchemaVersion,
    bool Persisted,
    bool ReceiptVisible,
    bool RevisionVisibleInChanges,
    bool HeadVisible,
    ulong ChangesCount,
    ulong HeadsCount,
    string ReceiptId,
    string RevisionId,
    string LogicalMemoryId,
    ulong IndexedThroughSequence,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Typed response from one hosted mutation submission or exact replay.</summary>
public sealed record MemoryEndpointsRevisionDecisionResponse(
    bool Ok,
    bool Persisted,
    MemoryEndpointsReconciliationReceipt Receipt,
    MemoryEndpointsHostedRevision? Revision,
    MemoryEndpointsHostedRevisionHead? Head,
    ulong ServerSequence,
    ulong IndexedThroughSequence,
    bool Conflict,
    MemoryEndpointsHostedSyncStatus Status,
    MemoryEndpointsMutationOperatorSummary OperatorSummary,
    string ReceiptQueryUrl,
    string ChangesQueryUrl,
    string HeadsQueryUrl,
    string CapabilityRoute,
    MemoryEndpointsMutationConfirmation Confirmation,
    bool IdempotentReplay,
    bool IdempotencyKeyExposed,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Response from lookup by the original idempotency header or receipt id.</summary>
public sealed record MemoryEndpointsReceiptLookupResponse(
    bool Ok,
    MemoryEndpointsReconciliationReceipt Receipt,
    MemoryEndpointsMutationOperatorSummary OperatorSummary,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Inputs retained locally to validate an uncertain receipt lookup.</summary>
public sealed record MemoryEndpointsReceiptLookupRequest(
    string IdempotencyKey,
    string LogicalMemoryId,
    string BodyHash);

/// <summary>Redacted checkpoint included in every changes page.</summary>
public sealed record MemoryEndpointsHostedCheckpoint(
    string WorkspaceIdHash,
    ulong AfterSequence,
    ulong NextAfterSequence,
    bool ValuesRedacted);

/// <summary>Inner monotonic hosted change page.</summary>
public sealed record MemoryEndpointsChangePage(
    IReadOnlyList<MemoryEndpointsHostedRevision> Items,
    int Count,
    bool HasMore,
    ulong NextAfterSequence,
    ulong IndexedThroughSequence,
    MemoryEndpointsHostedCheckpoint Checkpoint,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Top-level response from the hosted changes route.</summary>
public sealed record MemoryEndpointsChangePageResponse(
    bool Ok,
    MemoryEndpointsChangePage Changes,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Filters echoed by the hosted heads route.</summary>
public sealed record MemoryEndpointsHeadsFilters(string? LogicalMemoryId);

/// <summary>Response from authoritative head readback.</summary>
public sealed record MemoryEndpointsReadHeadsResponse(
    bool Ok,
    IReadOnlyList<MemoryEndpointsHostedRevisionHead> Items,
    int Count,
    MemoryEndpointsHeadsFilters Filters,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Hosted tombstone retention policy.</summary>
public sealed record MemoryEndpointsRetentionPolicy(
    string SchemaVersion,
    int TombstoneRetentionDays,
    bool HardForgetSupported,
    string HardForgetBehavior,
    bool RawPrivatePayloadStored,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Response from the hosted retention route.</summary>
public sealed record MemoryEndpointsRetentionPolicyResponse(
    bool Ok,
    MemoryEndpointsRetentionPolicy Policy,
    MemoryEndpointsDistributedSyncCapabilities Capabilities,
    bool ValuesRedacted,
    bool RawCredentialExposed,
    bool RawPayloadExposed);

/// <summary>Typed fail-closed failure returned by a hosted distributed-sync route.</summary>
public sealed class MemoryEndpointsDistributedSyncException : HttpRequestException
{
    internal MemoryEndpointsDistributedSyncException(
        HttpStatusCode statusCode,
        string errorCode,
        bool safeNoOp)
        : base(
            $"MemoryEndpoints distributed sync failed with {(int)statusCode} ({errorCode}).",
            null,
            statusCode)
    {
        ErrorCode = errorCode;
        SafeNoOp = safeNoOp;
    }

    /// <summary>Public-safe machine-readable service error code.</summary>
    public string ErrorCode { get; }

    /// <summary>Whether the service explicitly reported that no mutation occurred.</summary>
    public bool SafeNoOp { get; }
}

/// <summary>Strict deterministic hosted distributed-sync wire contract.</summary>
public static class MemoryEndpointsDistributedSyncTransport
{
    private const int MaxWireJsonBytes = 256 * 1024;
    private const int MaxIdentifierChars = 160;
    private const int MaxIdempotencyKeyChars = 256;
    private const int MaxTitleChars = 320;
    private const int MaxSourceChars = 1_024;
    private const string CapabilityRoute = "/api/matm/sync/capabilities";
    private static readonly Regex Identifier = new(
        "^[A-Za-z0-9._:@-]+$",
        RegexOptions.CultureInvariant);
    private static readonly Regex IdempotencyKey = new(
        "^[A-Za-z0-9._:-]{1,256}$",
        RegexOptions.CultureInvariant);
    private static readonly Regex Sha256 = new(
        "^[0-9a-f]{64}$",
        RegexOptions.CultureInvariant);
    private static readonly JsonSerializerOptions SerializerOptions = CreateSerializerOptions();

    /// <summary>Canonicalizes a mutation and recomputes its body hash.</summary>
    public static MemoryEndpointsHostedRevisionMutation CanonicalizeHostedRevisionMutation(
        MemoryEndpointsHostedRevisionMutation mutation)
    {
        ArgumentNullException.ThrowIfNull(mutation);
        var canonical = mutation with
        {
            WorkspaceId = mutation.WorkspaceId.Trim(),
            ActorAgentId = mutation.ActorAgentId.Trim(),
            DeviceId = mutation.DeviceId.Trim(),
            LogicalMemoryId = mutation.LogicalMemoryId.Trim(),
            ParentRevisionId = string.IsNullOrWhiteSpace(mutation.ParentRevisionId)
                ? null
                : mutation.ParentRevisionId.Trim(),
            Title = mutation.Title.Trim(),
            SourceRef = mutation.SourceRef.Trim(),
            Scope = mutation.Scope.Trim().ToLowerInvariant(),
            ScopeId = mutation.ScopeId.Trim(),
            MemoryType = mutation.MemoryType.Trim().ToLowerInvariant(),
            BodyHash = string.Empty
        };
        canonical = canonical with
        {
            BodyHash = ComputeHostedRevisionMutationBodyHash(canonical)
        };
        ValidateHostedRevisionMutation(canonical);
        return canonical;
    }

    /// <summary>Computes the public-safe body hash stored by hosted receipts and revisions.</summary>
    public static string ComputeHostedRevisionMutationBodyHash(
        MemoryEndpointsHostedRevisionMutation mutation)
    {
        ArgumentNullException.ThrowIfNull(mutation);
        var projection = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["logicalMemoryId"] = mutation.LogicalMemoryId,
            ["operation"] = OperationName(mutation.Operation),
            ["parentRevisionId"] = mutation.ParentRevisionId ?? string.Empty,
            ["source"] = mutation.SourceRef,
            ["summary"] = mutation.Summary,
            ["title"] = mutation.Title
        };
        return Sha256Hex(JsonSerializer.Serialize(projection, SerializerOptions));
    }

    /// <summary>Serializes a canonical hosted mutation using a stable field order.</summary>
    public static string SerializeHostedRevisionMutation(MemoryEndpointsHostedRevisionMutation mutation) =>
        JsonSerializer.Serialize(CanonicalizeHostedRevisionMutation(mutation), SerializerOptions);

    /// <summary>Computes a cross-runtime fingerprint for a canonical hosted mutation request.</summary>
    public static string ComputeHostedRevisionMutationFingerprint(
        MemoryEndpointsHostedRevisionMutation mutation) =>
        Sha256Hex(SerializeHostedRevisionMutation(mutation));

    /// <summary>Validates one hosted mutation before network use.</summary>
    public static void ValidateHostedRevisionMutation(MemoryEndpointsHostedRevisionMutation mutation)
    {
        ArgumentNullException.ThrowIfNull(mutation);
        ValidateIdentifier(mutation.WorkspaceId, nameof(mutation.WorkspaceId));
        ValidateIdentifier(mutation.ActorAgentId, nameof(mutation.ActorAgentId));
        ValidateIdentifier(mutation.DeviceId, nameof(mutation.DeviceId));
        ValidateIdentifier(mutation.LogicalMemoryId, nameof(mutation.LogicalMemoryId));
        if (mutation.ParentRevisionId is not null)
        {
            ValidateIdentifier(mutation.ParentRevisionId, nameof(mutation.ParentRevisionId));
        }
        if (mutation.DeviceEpoch == 0)
        {
            throw new ArgumentOutOfRangeException(nameof(mutation.DeviceEpoch));
        }
        ValidatePublicText(mutation.Title, MaxTitleChars, nameof(mutation.Title));
        ValidatePublicText(
            mutation.Summary,
            MemoryEndpointsDistributedSyncProtocol.MaxSummaryCharacters,
            nameof(mutation.Summary));
        ValidatePublicText(mutation.SourceRef, MaxSourceChars, nameof(mutation.SourceRef));
        ValidateIdentifier(mutation.ScopeId, nameof(mutation.ScopeId));
        if (mutation.Scope is not ("workspace" or "project" or "goal" or "task"))
        {
            throw new ArgumentException("Scope is not supported by hosted sync.", nameof(mutation.Scope));
        }
        if (mutation.MemoryType is not ("status" or "handoff" or "note"))
        {
            throw new ArgumentException(
                "Memory type is not supported by hosted sync.",
                nameof(mutation.MemoryType));
        }
        ValidateSha256(mutation.BodyHash, nameof(mutation.BodyHash));
        if (!string.Equals(
                mutation.BodyHash,
                ComputeHostedRevisionMutationBodyHash(mutation),
                StringComparison.Ordinal))
        {
            throw new ArgumentException(
                "Body hash does not match the deterministic mutation projection.",
                nameof(mutation.BodyHash));
        }
    }

    /// <summary>Validates an idempotency key retained only in session memory or an outbox row.</summary>
    public static void ValidateIdempotencyKey(string idempotencyKey)
    {
        if (string.IsNullOrEmpty(idempotencyKey) ||
            idempotencyKey.Length > MaxIdempotencyKeyChars ||
            !IdempotencyKey.IsMatch(idempotencyKey) ||
            MemoryEndpointsClientOptions.LooksLikeSecret(idempotencyKey))
        {
            throw new ArgumentException(
                "Distributed-sync idempotency key is missing, malformed, or unsafe.",
                nameof(idempotencyKey));
        }
    }

    /// <summary>Validates a register-device request.</summary>
    public static void ValidateRegisterDeviceRequest(MemoryEndpointsRegisterDeviceRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateIdentifier(request.WorkspaceId, nameof(request.WorkspaceId));
        ValidateIdentifier(request.AgentId, nameof(request.AgentId));
        ValidateIdentifier(request.DeviceId, nameof(request.DeviceId));
        ValidatePublicText(request.Label, MaxTitleChars, nameof(request.Label));
    }

    /// <summary>Validates a rotate-device request.</summary>
    public static void ValidateRotateDeviceRequest(MemoryEndpointsRotateDeviceRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateIdentifier(request.WorkspaceId, nameof(request.WorkspaceId));
        ValidateIdentifier(request.AgentId, nameof(request.AgentId));
        ValidateIdentifier(request.DeviceId, nameof(request.DeviceId));
    }

    /// <summary>Validates a revoke-device request.</summary>
    public static void ValidateRevokeDeviceRequest(MemoryEndpointsRevokeDeviceRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateIdentifier(request.WorkspaceId, nameof(request.WorkspaceId));
        ValidateIdentifier(request.AgentId, nameof(request.AgentId));
        ValidateIdentifier(request.DeviceId, nameof(request.DeviceId));
    }

    /// <summary>Validates receipt-lookup identity retained by the local outbox.</summary>
    public static void ValidateReceiptLookupRequest(MemoryEndpointsReceiptLookupRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateIdempotencyKey(request.IdempotencyKey);
        ValidateIdentifier(request.LogicalMemoryId, nameof(request.LogicalMemoryId));
        ValidateSha256(request.BodyHash, nameof(request.BodyHash));
    }

    /// <summary>Parses and validates one hosted mutation response.</summary>
    public static MemoryEndpointsRevisionDecisionResponse ParseRevisionDecisionResponse(string json)
    {
        var response = Deserialize<MemoryEndpointsRevisionDecisionResponse>(json, "mutation decision");
        ValidateRevisionDecisionResponse(response);
        return response;
    }

    /// <summary>Parses and validates receipt lookup response.</summary>
    public static MemoryEndpointsReceiptLookupResponse ParseReceiptLookupResponse(string json)
    {
        var response = Deserialize<MemoryEndpointsReceiptLookupResponse>(json, "receipt lookup");
        ValidateRedaction(
            response.ValuesRedacted,
            response.RawCredentialExposed,
            response.RawPayloadExposed);
        if (!response.Ok || !response.OperatorSummary.Persisted)
        {
            throw new ArgumentException("Receipt lookup was not authoritative.", nameof(json));
        }
        ValidateOperatorSummary(response.OperatorSummary, "receipt");
        ValidateReconciliationReceipt(response.Receipt);
        return response;
    }

    /// <summary>Parses and validates one hosted changes page at a requested checkpoint.</summary>
    public static MemoryEndpointsChangePageResponse ParseChangePage(
        string json,
        ulong requestedAfterSequence)
    {
        var response = Deserialize<MemoryEndpointsChangePageResponse>(json, "change page");
        ValidateRedaction(
            response.ValuesRedacted,
            response.RawCredentialExposed,
            response.RawPayloadExposed);
        if (!response.Ok)
        {
            throw new ArgumentException("Change page response was not successful.", nameof(json));
        }
        ValidateChangePage(response.Changes, requestedAfterSequence);
        return response;
    }

    /// <summary>Parses and validates authoritative head readback.</summary>
    public static MemoryEndpointsReadHeadsResponse ParseReadHeadsResponse(string json)
    {
        var response = Deserialize<MemoryEndpointsReadHeadsResponse>(json, "heads response");
        ValidateReadHeadsResponse(response);
        return response;
    }

    /// <summary>Parses and validates a device authority response.</summary>
    public static MemoryEndpointsDeviceAuthorityResponse ParseDeviceAuthorityResponse(string json)
    {
        var response = Deserialize<MemoryEndpointsDeviceAuthorityResponse>(json, "device authority");
        ValidateDeviceAuthorityResponse(response);
        return response;
    }

    /// <summary>Parses and validates hosted retention readback.</summary>
    public static MemoryEndpointsRetentionPolicyResponse ParseRetentionPolicyResponse(string json)
    {
        var response = Deserialize<MemoryEndpointsRetentionPolicyResponse>(json, "retention response");
        ValidateRetentionPolicyResponse(response);
        return response;
    }

    /// <summary>Parses a public-safe service failure without exposing its detail string.</summary>
    public static MemoryEndpointsDistributedSyncException ParseFailure(
        HttpStatusCode statusCode,
        string json)
    {
        try
        {
            var response = Deserialize<FailureResponse>(json, "failure response");
            if (response.Ok ||
                !response.SafeNoOp ||
                !response.ValuesRedacted ||
                response.RawCredentialExposed ||
                response.RawPayloadExposed ||
                response.Error is null ||
                string.IsNullOrWhiteSpace(response.Error.Code) ||
                !response.Error.SafeNoOp ||
                !response.Error.ValuesRedacted)
            {
                throw new JsonException("Failure response did not satisfy the safe no-op boundary.");
            }
            return new MemoryEndpointsDistributedSyncException(
                statusCode,
                response.Error.Code,
                true);
        }
        catch (Exception error) when (error is JsonException or ArgumentException)
        {
            return new MemoryEndpointsDistributedSyncException(
                statusCode,
                "invalid_redacted_failure",
                false);
        }
    }

    /// <summary>Validates a durable mutation decision and nested readback evidence.</summary>
    public static void ValidateRevisionDecisionResponse(
        MemoryEndpointsRevisionDecisionResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        ValidateRedaction(
            response.ValuesRedacted,
            response.RawCredentialExposed,
            response.RawPayloadExposed);
        if (!response.Persisted ||
            response.CapabilityRoute != CapabilityRoute ||
            response.IdempotencyKeyExposed)
        {
            throw new ArgumentException("Mutation decision was not durably confirmed.", nameof(response));
        }
        ValidateReconciliationReceipt(response.Receipt);
        ValidateOperatorSummary(response.OperatorSummary, "mutation");
        ValidateConfirmation(response.Confirmation, response.Receipt);
        ValidateProtectedQuery(response.ReceiptQueryUrl, "/api/matm/sync/receipts?");
        ValidateProtectedQuery(response.ChangesQueryUrl, "/api/matm/sync/changes?");
        ValidateProtectedQuery(response.HeadsQueryUrl, "/api/matm/sync/heads?");
        if (response.Receipt.Status != response.Status ||
            response.Receipt.ServerSequence != response.ServerSequence ||
            response.Receipt.ReceiptId != response.Confirmation.ReceiptId ||
            response.Receipt.LogicalMemoryId != response.Confirmation.LogicalMemoryId)
        {
            throw new ArgumentException("Mutation response identity fields disagree.", nameof(response));
        }

        switch (response.Status)
        {
            case MemoryEndpointsHostedSyncStatus.Applied:
                if (!response.Ok ||
                    response.Conflict ||
                    response.ServerSequence == 0 ||
                    response.Revision is null ||
                    response.Head is null ||
                    response.Revision.SyncRevisionId != response.Receipt.SyncRevisionId ||
                    response.Head.HeadRevisionId != response.Revision.SyncRevisionId ||
                    !response.Confirmation.RevisionVisibleInChanges ||
                    !response.Confirmation.HeadVisible)
                {
                    throw new ArgumentException("Applied decision is internally inconsistent.", nameof(response));
                }
                ValidateHostedRevision(response.Revision);
                ValidateHostedRevisionHead(response.Head);
                break;
            case MemoryEndpointsHostedSyncStatus.Conflict:
                if (response.Ok ||
                    !response.Conflict ||
                    response.ServerSequence == 0 ||
                    response.Revision is null ||
                    !response.Revision.Conflict ||
                    response.Revision.ConflictCode != response.Receipt.ConflictCode ||
                    !IsSupportedConflictCode(response.Receipt.ConflictCode))
                {
                    throw new ArgumentException("Conflict decision is internally inconsistent.", nameof(response));
                }
                ValidateHostedRevision(response.Revision);
                if (response.Head is not null)
                {
                    ValidateHostedRevisionHead(response.Head);
                }
                break;
            case MemoryEndpointsHostedSyncStatus.Rejected:
                if (response.Ok ||
                    response.Conflict ||
                    response.Revision is not null ||
                    response.ServerSequence != 0 ||
                    string.IsNullOrWhiteSpace(response.Receipt.ConflictCode))
                {
                    throw new ArgumentException("Rejected decision is internally inconsistent.", nameof(response));
                }
                if (response.Head is not null)
                {
                    ValidateHostedRevisionHead(response.Head);
                }
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(response));
        }
    }

    /// <summary>Validates one body-free durable receipt.</summary>
    public static void ValidateReconciliationReceipt(MemoryEndpointsReconciliationReceipt receipt)
    {
        ArgumentNullException.ThrowIfNull(receipt);
        ValidateIdentifier(receipt.ReceiptId, nameof(receipt.ReceiptId));
        ValidateIdentifier(receipt.WorkspaceId, nameof(receipt.WorkspaceId));
        ValidateIdentifier(receipt.LogicalMemoryId, nameof(receipt.LogicalMemoryId));
        ValidateSha256Prefix(receipt.IdempotencyKeyHash, nameof(receipt.IdempotencyKeyHash));
        ValidateSha256(receipt.BodyHash, nameof(receipt.BodyHash));
        if (!string.IsNullOrEmpty(receipt.SyncRevisionId))
        {
            ValidateIdentifier(receipt.SyncRevisionId, nameof(receipt.SyncRevisionId));
        }
        if (!string.IsNullOrEmpty(receipt.CurrentHeadRevisionId))
        {
            ValidateIdentifier(receipt.CurrentHeadRevisionId, nameof(receipt.CurrentHeadRevisionId));
        }
        ValidateTimestamp(receipt.CreatedAt, nameof(receipt.CreatedAt));
        ValidateRedaction(
            receipt.ValuesRedacted,
            receipt.RawCredentialExposed,
            receipt.RawPayloadExposed);
        if (receipt.IdempotencyKeyExposed)
        {
            throw new ArgumentException("Receipt exposed the idempotency key.", nameof(receipt));
        }
        if (receipt.Status == MemoryEndpointsHostedSyncStatus.Applied &&
            (receipt.Conflict ||
             receipt.ConflictCode.Length != 0 ||
             receipt.ServerSequence == 0 ||
             receipt.SyncRevisionId.Length == 0) ||
            receipt.Status == MemoryEndpointsHostedSyncStatus.Conflict &&
            (!receipt.Conflict ||
             !IsSupportedConflictCode(receipt.ConflictCode) ||
             receipt.ServerSequence == 0 ||
             receipt.SyncRevisionId.Length == 0) ||
            receipt.Status == MemoryEndpointsHostedSyncStatus.Rejected &&
            (receipt.Conflict ||
             receipt.ConflictCode.Length == 0 ||
             receipt.ServerSequence != 0 ||
             receipt.SyncRevisionId.Length != 0))
        {
            throw new ArgumentException("Receipt status metadata is inconsistent.", nameof(receipt));
        }
    }

    /// <summary>Validates a monotonic changes page against its requested checkpoint.</summary>
    public static void ValidateChangePage(
        MemoryEndpointsChangePage page,
        ulong requestedAfterSequence)
    {
        ArgumentNullException.ThrowIfNull(page);
        ValidateRedaction(page.ValuesRedacted, page.RawCredentialExposed, page.RawPayloadExposed);
        if (page.Count != page.Items.Count ||
            page.Count > MemoryEndpointsDistributedSyncProtocol.MaxPullPageSize ||
            page.Checkpoint.AfterSequence != requestedAfterSequence ||
            page.Checkpoint.NextAfterSequence != page.NextAfterSequence ||
            !page.Checkpoint.ValuesRedacted)
        {
            throw new ArgumentException("Change page count or checkpoint is invalid.", nameof(page));
        }
        ValidateSha256Prefix(page.Checkpoint.WorkspaceIdHash, nameof(page.Checkpoint.WorkspaceIdHash));
        var previous = requestedAfterSequence;
        foreach (var revision in page.Items)
        {
            ValidateHostedRevision(revision);
            if (revision.ServerSequence <= previous)
            {
                throw new ArgumentException("Change page sequences are not monotonic.", nameof(page));
            }
            previous = revision.ServerSequence;
        }
        if (page.NextAfterSequence != previous ||
            page.IndexedThroughSequence < page.NextAfterSequence ||
            page.HasMore && page.Items.Count == 0)
        {
            throw new ArgumentException("Change page continuation is unsafe.", nameof(page));
        }
    }

    /// <summary>Validates authoritative heads and response redaction.</summary>
    public static void ValidateReadHeadsResponse(MemoryEndpointsReadHeadsResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        ValidateRedaction(
            response.ValuesRedacted,
            response.RawCredentialExposed,
            response.RawPayloadExposed);
        if (!response.Ok || response.Count != response.Items.Count)
        {
            throw new ArgumentException("Heads response count is invalid.", nameof(response));
        }
        if (response.Filters.LogicalMemoryId is not null)
        {
            ValidateIdentifier(response.Filters.LogicalMemoryId, nameof(response.Filters.LogicalMemoryId));
        }
        string? previous = null;
        foreach (var head in response.Items)
        {
            ValidateHostedRevisionHead(head);
            if (previous is not null &&
                string.CompareOrdinal(previous, head.LogicalMemoryId) > 0)
            {
                throw new ArgumentException("Heads are not deterministically sorted.", nameof(response));
            }
            previous = head.LogicalMemoryId;
        }
    }

    /// <summary>Validates device authority readback.</summary>
    public static void ValidateDeviceAuthorityResponse(MemoryEndpointsDeviceAuthorityResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        ValidateRedaction(
            response.ValuesRedacted,
            response.RawCredentialExposed,
            response.RawPayloadExposed);
        if (!response.Ok ||
            !response.Persisted ||
            !response.VisibleToAgent ||
            !response.DeviceAuthorityPersisted ||
            response.CapabilityRoute != CapabilityRoute ||
            response.IdempotencyKeyExposed ||
            response.CanonicalWorkspaceId != response.Device.WorkspaceId ||
            response.CanonicalDeviceId != response.Device.DeviceId)
        {
            throw new ArgumentException("Device authority was not durably confirmed.", nameof(response));
        }
        ValidateIdentifier(response.Device.DeviceId, nameof(response.Device.DeviceId));
        ValidateIdentifier(response.Device.WorkspaceId, nameof(response.Device.WorkspaceId));
        ValidateIdentifier(response.Device.AgentId, nameof(response.Device.AgentId));
        ValidatePublicText(response.Device.Label, MaxTitleChars, nameof(response.Device.Label));
        ValidateTimestamp(response.Device.CreatedAt, nameof(response.Device.CreatedAt));
        ValidateTimestamp(response.Device.UpdatedAt, nameof(response.Device.UpdatedAt));
        if (response.Device.AuthorityEpoch == 0 ||
            !response.Device.ValuesRedacted ||
            response.Device.RawPayloadExposed ||
            response.OperatorSummary.SchemaVersion !=
                "memoryendpoints.sync_device_operator_summary.v1" ||
            response.OperatorSummary.AuthorityEpoch != response.Device.AuthorityEpoch ||
            response.OperatorSummary.DeviceId != response.Device.DeviceId ||
            response.OperatorSummary.Status != response.Device.Status ||
            !response.OperatorSummary.Persisted ||
            !response.OperatorSummary.ValuesRedacted ||
            response.OperatorSummary.RawCredentialExposed ||
            response.OperatorSummary.RawPayloadExposed)
        {
            throw new ArgumentException("Device authority metadata is inconsistent.", nameof(response));
        }
        if (response.Device.Status == MemoryEndpointsHostedDeviceStatus.Active &&
            response.Device.RevokedAt is not null)
        {
            throw new ArgumentException("Active device has a revocation time.", nameof(response));
        }
        if (response.Device.Status == MemoryEndpointsHostedDeviceStatus.Revoked)
        {
            ValidateTimestamp(
                response.Device.RevokedAt ?? string.Empty,
                nameof(response.Device.RevokedAt));
        }
    }

    /// <summary>Validates hosted retention readback and repeated capabilities.</summary>
    public static void ValidateRetentionPolicyResponse(
        MemoryEndpointsRetentionPolicyResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        ValidateRedaction(
            response.ValuesRedacted,
            response.RawCredentialExposed,
            response.RawPayloadExposed);
        MemoryEndpointsDistributedSyncProtocol.ValidateCapabilities(response.Capabilities);
        if (!response.Ok ||
            response.Policy.SchemaVersion != "memoryendpoints.sync_retention.v1" ||
            response.Policy.TombstoneRetentionDays is < 1 or > 3650 ||
            response.Policy.HardForgetSupported ||
            response.Policy.HardForgetBehavior != "safe_rejected_receipt" ||
            response.Policy.RawPrivatePayloadStored ||
            !response.Policy.ValuesRedacted ||
            response.Policy.RawCredentialExposed ||
            response.Policy.RawPayloadExposed ||
            response.Policy.TombstoneRetentionDays !=
                response.Capabilities.Retention.TombstoneRetentionDays)
        {
            throw new ArgumentException("Retention policy is incomplete or inconsistent.", nameof(response));
        }
    }

    private static void ValidateHostedRevision(MemoryEndpointsHostedRevision revision)
    {
        ValidateIdentifier(revision.SyncRevisionId, nameof(revision.SyncRevisionId));
        ValidateIdentifier(revision.WorkspaceId, nameof(revision.WorkspaceId));
        ValidateIdentifier(revision.LogicalMemoryId, nameof(revision.LogicalMemoryId));
        if (revision.ParentRevisionId.Length != 0)
        {
            ValidateIdentifier(revision.ParentRevisionId, nameof(revision.ParentRevisionId));
        }
        if (revision.MemoryEventId.Length != 0)
        {
            ValidateIdentifier(revision.MemoryEventId, nameof(revision.MemoryEventId));
        }
        ValidateIdentifier(revision.ActorAgentId, nameof(revision.ActorAgentId));
        if (revision.DeviceId.Length != 0)
        {
            ValidateIdentifier(revision.DeviceId, nameof(revision.DeviceId));
        }
        ValidateSha256(revision.BodyHash, nameof(revision.BodyHash));
        ValidatePublicText(revision.Source, MaxSourceChars, nameof(revision.Source));
        ValidatePublicText(revision.Title, MaxTitleChars, nameof(revision.Title));
        ValidatePublicText(
            revision.Summary,
            MemoryEndpointsDistributedSyncProtocol.MaxSummaryCharacters,
            nameof(revision.Summary));
        ValidateIdentifier(revision.ScopeId, nameof(revision.ScopeId));
        ValidateTimestamp(revision.CreatedAt, nameof(revision.CreatedAt));
        if (revision.ServerSequence == 0 ||
            !revision.ValuesRedacted ||
            revision.RawPayloadExposed ||
            revision.Status == MemoryEndpointsHostedSyncStatus.Rejected ||
            revision.Tombstone != (revision.Operation == MemoryEndpointsHostedSyncOperation.Delete) ||
            revision.Conflict != (revision.Status == MemoryEndpointsHostedSyncStatus.Conflict) ||
            revision.Conflict && !IsSupportedConflictCode(revision.ConflictCode))
        {
            throw new ArgumentException("Hosted revision metadata is invalid.", nameof(revision));
        }
    }

    private static void ValidateHostedRevisionHead(MemoryEndpointsHostedRevisionHead head)
    {
        ValidateIdentifier(head.LogicalMemoryId, nameof(head.LogicalMemoryId));
        ValidateIdentifier(head.WorkspaceId, nameof(head.WorkspaceId));
        ValidateIdentifier(head.HeadRevisionId, nameof(head.HeadRevisionId));
        ValidateTimestamp(head.UpdatedAt, nameof(head.UpdatedAt));
        if (head.ServerSequence == 0 ||
            head.IndexedThroughSequence < head.ServerSequence ||
            !head.ValuesRedacted ||
            head.RawPayloadExposed)
        {
            throw new ArgumentException("Hosted head metadata is invalid.", nameof(head));
        }
    }

    private static void ValidateOperatorSummary(
        MemoryEndpointsMutationOperatorSummary summary,
        string expectedAction)
    {
        if (summary.SchemaVersion != "memoryendpoints.sync_operator_summary.v1" ||
            summary.Action != expectedAction ||
            !summary.Persisted ||
            !summary.ValuesRedacted ||
            summary.RawCredentialExposed ||
            summary.RawPayloadExposed)
        {
            throw new ArgumentException("Operator summary is incomplete or unsafe.", nameof(summary));
        }
    }

    private static void ValidateConfirmation(
        MemoryEndpointsMutationConfirmation confirmation,
        MemoryEndpointsReconciliationReceipt receipt)
    {
        ValidateRedaction(
            confirmation.ValuesRedacted,
            confirmation.RawCredentialExposed,
            confirmation.RawPayloadExposed);
        if (confirmation.SchemaVersion != "memoryendpoints.sync_mutation_confirmation.v1" ||
            !confirmation.Persisted ||
            !confirmation.ReceiptVisible ||
            confirmation.ReceiptId != receipt.ReceiptId ||
            confirmation.RevisionId != receipt.SyncRevisionId ||
            confirmation.LogicalMemoryId != receipt.LogicalMemoryId)
        {
            throw new ArgumentException("Mutation confirmation identity is invalid.", nameof(confirmation));
        }
    }

    private static T Deserialize<T>(string json, string label)
    {
        if (string.IsNullOrEmpty(json) || Encoding.UTF8.GetByteCount(json) > MaxWireJsonBytes)
        {
            throw new ArgumentException($"{label} JSON is empty or exceeds 256 KiB.", nameof(json));
        }
        return JsonSerializer.Deserialize<T>(json, SerializerOptions) ??
            throw new ArgumentException($"{label} JSON did not contain an object.", nameof(json));
    }

    private static void ValidateIdentifier(string value, string name)
    {
        if (string.IsNullOrEmpty(value) ||
            value.Length > MaxIdentifierChars ||
            !Identifier.IsMatch(value))
        {
            throw new ArgumentException("Identifier is missing or malformed.", name);
        }
    }

    private static void ValidatePublicText(string value, int maxCharacters, string name)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.EnumerateRunes().Count() > maxCharacters ||
            value.Any(character => char.IsControl(character) && character is not ('\n' or '\r' or '\t')) ||
            MemoryEndpointsClientOptions.LooksLikeSecret(value))
        {
            throw new ArgumentException("Value is not bounded public-safe text.", name);
        }
    }

    private static void ValidateSha256(string value, string name)
    {
        if (string.IsNullOrEmpty(value) || !Sha256.IsMatch(value))
        {
            throw new ArgumentException("Value is not lowercase SHA-256.", name);
        }
    }

    private static void ValidateSha256Prefix(string value, string name)
    {
        if (!value.StartsWith("sha256:", StringComparison.Ordinal))
        {
            throw new ArgumentException("Value is missing its SHA-256 prefix.", name);
        }
        ValidateSha256(value[7..], name);
    }

    private static void ValidateTimestamp(string value, string name)
    {
        if (value.Length is < 16 or > 64 || !value.Contains('T'))
        {
            throw new ArgumentException("Value is not a bounded ISO-8601 timestamp.", name);
        }
    }

    private static void ValidateRedaction(
        bool valuesRedacted,
        bool rawCredentialExposed,
        bool rawPayloadExposed)
    {
        if (!valuesRedacted || rawCredentialExposed || rawPayloadExposed)
        {
            throw new ArgumentException("Hosted response violates the redaction boundary.");
        }
    }

    private static void ValidateProtectedQuery(string value, string expectedPrefix)
    {
        if (!value.StartsWith(expectedPrefix, StringComparison.Ordinal) ||
            value.Contains('#') ||
            value.Contains("..", StringComparison.Ordinal) ||
            MemoryEndpointsClientOptions.LooksLikeSecret(value))
        {
            throw new ArgumentException("Hosted readback URL is outside the protected sync contract.");
        }
    }

    private static string OperationName(MemoryEndpointsHostedSyncOperation operation) => operation switch
    {
        MemoryEndpointsHostedSyncOperation.Upsert => "upsert",
        MemoryEndpointsHostedSyncOperation.Delete => "delete",
        MemoryEndpointsHostedSyncOperation.HardForget => "hard_forget",
        _ => throw new ArgumentOutOfRangeException(nameof(operation))
    };

    private static bool IsSupportedConflictCode(string value) =>
        value is "parent_revision_mismatch" or "tombstone_resurrection_blocked" or "head_not_found";

    private static string Sha256Hex(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static JsonSerializerOptions CreateSerializerOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            MaxDepth = 32,
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            WriteIndented = false
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower, false));
        return options;
    }

    private sealed record FailureResponse(
        bool Ok,
        bool SafeNoOp,
        bool ValuesRedacted,
        bool RawCredentialExposed,
        bool RawPayloadExposed,
        FailureDetail Error);

    private sealed record FailureDetail(
        string Code,
        string Title,
        string Detail,
        bool SafeNoOp,
        bool ValuesRedacted);
}
