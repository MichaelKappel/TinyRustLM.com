using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM;

/// <summary>Protected routes advertised by the live MemoryEndpoints distributed-sync service.</summary>
public sealed record MemoryEndpointsDistributedSyncRoutes(
    string RegisterDevice,
    string RotateDevice,
    string RevokeDevice,
    string SubmitMutation,
    string LookupReceipt,
    string Changes,
    string Heads,
    string Retention);

/// <summary>Mutation behavior advertised by the hosted authority.</summary>
public sealed record MemoryEndpointsDistributedSyncMutationContract(
    IReadOnlyList<string> Operations,
    bool HardForgetSupported,
    string HardForgetBehavior,
    string Idempotency,
    IReadOnlyList<string> RevisionFields,
    string ConflictSemantics,
    string TombstoneSemantics);

/// <summary>Incremental-pull checkpoint behavior advertised by the hosted authority.</summary>
public sealed record MemoryEndpointsDistributedSyncCheckpointContract(
    IReadOnlyList<string> ChangesQuery,
    bool MonotonicServerSequence,
    bool IndexedThroughWatermark,
    IReadOnlyList<string> PaginationFields);

/// <summary>Device-authority behavior advertised by the hosted authority.</summary>
public sealed record MemoryEndpointsDistributedSyncDeviceContract(
    bool AuthorityEpoch,
    bool RegisterRotateRevoke,
    string RevokedDeviceMutationBehavior,
    bool SecretMaterialStored);

/// <summary>Retention behavior advertised by the hosted authority.</summary>
public sealed record MemoryEndpointsDistributedSyncRetention(
    int TombstoneRetentionDays,
    bool HardForgetSupported,
    bool RawPrivatePayloadStored,
    bool ValuesRedacted);

/// <summary>Versioned fail-closed capability data returned by MemoryEndpoints.com.</summary>
public sealed record MemoryEndpointsDistributedSyncCapabilities(
    string SchemaVersion,
    string Status,
    string Protocol,
    string CapabilityRoute,
    MemoryEndpointsDistributedSyncRoutes Routes,
    MemoryEndpointsDistributedSyncMutationContract MutationContract,
    MemoryEndpointsDistributedSyncCheckpointContract CheckpointContract,
    MemoryEndpointsDistributedSyncDeviceContract DeviceContract,
    MemoryEndpointsDistributedSyncRetention Retention,
    bool PublicSafeOnly,
    bool RawCredentialExposed,
    bool RawPayloadExposed,
    bool ValuesRedacted);

/// <summary>Outcome of probing a service for authoritative distributed-sync support.</summary>
public enum MemoryEndpointsDistributedSyncAvailabilityStatus
{
    /// <summary>The service returned a complete, compatible, live authority contract.</summary>
    Live,

    /// <summary>The capability route returned HTTP 404 and must not be inferred from other routes.</summary>
    NotAdvertised,

    /// <summary>The route returned data that did not satisfy the complete authority contract.</summary>
    Incompatible
}

/// <summary>Public-safe result of distributed-sync capability negotiation.</summary>
public sealed record MemoryEndpointsDistributedSyncAvailability(
    MemoryEndpointsDistributedSyncAvailabilityStatus Status,
    string ReasonCode,
    MemoryEndpointsDistributedSyncCapabilities? Capabilities);

/// <summary>Deterministic validation and route-resolution rules for distributed-sync capabilities.</summary>
public static class MemoryEndpointsDistributedSyncProtocol
{
    /// <summary>Stable distributed-sync capability document schema.</summary>
    public const string CapabilitiesKind = "memoryendpoints.distributed_sync_capabilities.v1";

    /// <summary>Stable distributed-sync protocol label.</summary>
    public const string Protocol = "memoryendpoints-distributed-sync-v1";

    /// <summary>Maximum pull page accepted by the deployed protocol.</summary>
    public const int MaxPullPageSize = 200;

    /// <summary>Maximum public-safe mutation summary accepted by the deployed protocol.</summary>
    public const int MaxSummaryCharacters = 4_000;

    private const int MaxCapabilityDocumentBytes = 64 * 1024;
    private const string CapabilityRoute = "/api/matm/sync/capabilities";
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        MaxDepth = 32,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    /// <summary>Parses and validates one bounded live capability response envelope.</summary>
    public static MemoryEndpointsDistributedSyncCapabilities ParseCapabilities(string json)
    {
        if (string.IsNullOrEmpty(json) || Encoding.UTF8.GetByteCount(json) > MaxCapabilityDocumentBytes)
        {
            throw new ArgumentException(
                "Distributed-sync capability JSON is empty or exceeds 64 KiB.",
                nameof(json));
        }

        var envelope = JsonSerializer.Deserialize<CapabilitiesEnvelope>(json, SerializerOptions) ??
            throw new ArgumentException(
                "Distributed-sync capability JSON did not contain an object.",
                nameof(json));
        if (!envelope.Ok)
        {
            throw new ArgumentException(
                "Distributed-sync capability response was not successful.",
                nameof(json));
        }
        ValidateCapabilities(envelope.Data);
        return envelope.Data;
    }

    /// <summary>Validates every behavior used by the TinyRustLM hosted connector.</summary>
    public static void ValidateCapabilities(MemoryEndpointsDistributedSyncCapabilities capabilities)
    {
        ArgumentNullException.ThrowIfNull(capabilities);
        if (capabilities.SchemaVersion != CapabilitiesKind ||
            capabilities.Protocol != Protocol ||
            capabilities.Status != "live" ||
            capabilities.CapabilityRoute != CapabilityRoute)
        {
            throw new ArgumentException(
                "Unsupported or non-live distributed-sync capability document.",
                nameof(capabilities));
        }
        if (!capabilities.PublicSafeOnly ||
            !capabilities.ValuesRedacted ||
            capabilities.RawCredentialExposed ||
            capabilities.RawPayloadExposed)
        {
            throw new ArgumentException(
                "Distributed-sync capabilities violate the public-safe response boundary.",
                nameof(capabilities));
        }

        ValidateRoutes(capabilities.Routes);
        ValidateMutationContract(capabilities.MutationContract);
        ValidateCheckpointContract(capabilities.CheckpointContract);
        ValidateDeviceContract(capabilities.DeviceContract);
        ValidateRetention(capabilities.Retention);
    }

    /// <summary>Resolves an advertised protected route against the configured service origin.</summary>
    public static Uri ResolveRoute(Uri serviceBaseUri, string advertisedRoute)
    {
        ArgumentNullException.ThrowIfNull(serviceBaseUri);
        if (!serviceBaseUri.IsAbsoluteUri ||
            !string.IsNullOrEmpty(serviceBaseUri.UserInfo) ||
            !string.IsNullOrEmpty(serviceBaseUri.Query) ||
            !string.IsNullOrEmpty(serviceBaseUri.Fragment) ||
            serviceBaseUri.Scheme != Uri.UriSchemeHttps && !IsLoopbackHttp(serviceBaseUri))
        {
            throw new ArgumentException(
                "MemoryEndpoints service base URI must use HTTPS, except loopback HTTP for tests.",
                nameof(serviceBaseUri));
        }
        ValidateSyncRoute(advertisedRoute, nameof(advertisedRoute));
        return new Uri(new Uri(serviceBaseUri.GetLeftPart(UriPartial.Authority)), advertisedRoute);
    }

    private static void ValidateRoutes(MemoryEndpointsDistributedSyncRoutes routes)
    {
        ArgumentNullException.ThrowIfNull(routes);
        var expected = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [nameof(routes.RegisterDevice)] = "/api/matm/sync/devices",
            [nameof(routes.RotateDevice)] = "/api/matm/sync/devices/rotate",
            [nameof(routes.RevokeDevice)] = "/api/matm/sync/devices/revoke",
            [nameof(routes.SubmitMutation)] = "/api/matm/sync/mutations",
            [nameof(routes.LookupReceipt)] = "/api/matm/sync/receipts",
            [nameof(routes.Changes)] = "/api/matm/sync/changes",
            [nameof(routes.Heads)] = "/api/matm/sync/heads",
            [nameof(routes.Retention)] = "/api/matm/sync/retention"
        };
        var actual = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [nameof(routes.RegisterDevice)] = routes.RegisterDevice,
            [nameof(routes.RotateDevice)] = routes.RotateDevice,
            [nameof(routes.RevokeDevice)] = routes.RevokeDevice,
            [nameof(routes.SubmitMutation)] = routes.SubmitMutation,
            [nameof(routes.LookupReceipt)] = routes.LookupReceipt,
            [nameof(routes.Changes)] = routes.Changes,
            [nameof(routes.Heads)] = routes.Heads,
            [nameof(routes.Retention)] = routes.Retention
        };
        foreach (var entry in expected)
        {
            ValidateSyncRoute(actual[entry.Key], entry.Key);
            if (actual[entry.Key] != entry.Value)
            {
                throw new ArgumentException(
                    "Distributed-sync capability routes do not match the supported v1 contract.",
                    nameof(routes));
            }
        }
    }

    private static void ValidateMutationContract(MemoryEndpointsDistributedSyncMutationContract contract)
    {
        ArgumentNullException.ThrowIfNull(contract);
        string[] operations = ["upsert", "delete", "hard_forget"];
        string[] revisionFields =
        [
            "logicalMemoryId",
            "parentRevisionId",
            "syncRevisionId",
            "serverSequence",
            "bodyHash",
            "conflict",
            "conflictCode"
        ];
        if (!contract.Operations.SequenceEqual(operations, StringComparer.Ordinal) ||
            !contract.RevisionFields.SequenceEqual(revisionFields, StringComparer.Ordinal) ||
            contract.HardForgetSupported ||
            contract.HardForgetBehavior != "safe_rejected_receipt" ||
            !contract.Idempotency.Contains("Idempotency-Key", StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(contract.ConflictSemantics) ||
            string.IsNullOrWhiteSpace(contract.TombstoneSemantics))
        {
            throw new ArgumentException(
                "Distributed-sync mutation contract is incomplete or unsupported.",
                nameof(contract));
        }
    }

    private static void ValidateCheckpointContract(MemoryEndpointsDistributedSyncCheckpointContract contract)
    {
        ArgumentNullException.ThrowIfNull(contract);
        string[] query = ["workspace_id", "after_sequence", "limit", "logical_memory_id"];
        string[] fields =
        [
            "items",
            "hasMore",
            "nextAfterSequence",
            "indexedThroughSequence",
            "checkpoint"
        ];
        if (!contract.MonotonicServerSequence ||
            !contract.IndexedThroughWatermark ||
            !contract.ChangesQuery.SequenceEqual(query, StringComparer.Ordinal) ||
            !contract.PaginationFields.SequenceEqual(fields, StringComparer.Ordinal))
        {
            throw new ArgumentException(
                "Distributed-sync checkpoint contract is incomplete or unsupported.",
                nameof(contract));
        }
    }

    private static void ValidateDeviceContract(MemoryEndpointsDistributedSyncDeviceContract contract)
    {
        ArgumentNullException.ThrowIfNull(contract);
        if (!contract.AuthorityEpoch ||
            !contract.RegisterRotateRevoke ||
            contract.RevokedDeviceMutationBehavior != "safe_rejected_receipt" ||
            contract.SecretMaterialStored)
        {
            throw new ArgumentException(
                "Distributed-sync device contract is incomplete or unsafe.",
                nameof(contract));
        }
    }

    private static void ValidateRetention(MemoryEndpointsDistributedSyncRetention retention)
    {
        ArgumentNullException.ThrowIfNull(retention);
        if (retention.TombstoneRetentionDays is < 1 or > 3650 ||
            retention.HardForgetSupported ||
            retention.RawPrivatePayloadStored ||
            !retention.ValuesRedacted)
        {
            throw new ArgumentException(
                "Distributed-sync retention contract is incomplete or unsafe.",
                nameof(retention));
        }
    }

    private static void ValidateSyncRoute(string route, string name)
    {
        const string prefix = "/api/matm/sync/";
        if (string.IsNullOrWhiteSpace(route) ||
            !route.StartsWith(prefix, StringComparison.Ordinal) ||
            route.Length <= prefix.Length ||
            route.Length > 192 ||
            route.Contains("..", StringComparison.Ordinal) ||
            route.Contains('?') ||
            route.Contains('#') ||
            route.Any(ch => !(char.IsAsciiLetterOrDigit(ch) || ch is '/' or '-' or '_' or '.')))
        {
            throw new ArgumentException(
                $"Distributed-sync route {name} is outside the protected sync namespace.",
                name);
        }
    }

    private static bool IsLoopbackHttp(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttp &&
        (IPAddress.TryParse(uri.Host, out var address) && IPAddress.IsLoopback(address) ||
         string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase));

    private sealed record CapabilitiesEnvelope(
        bool Ok,
        MemoryEndpointsDistributedSyncCapabilities Data);
}
