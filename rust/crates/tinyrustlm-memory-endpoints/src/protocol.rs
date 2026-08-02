use crate::MemoryEndpointsSyncError;
use serde::{Deserialize, Serialize};

/// Stable distributed-sync capability document schema.
pub const MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_CAPABILITIES_KIND: &str =
    "memoryendpoints.distributed_sync_capabilities.v1";
/// Stable distributed-sync protocol label.
pub const MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_PROTOCOL: &str = "memoryendpoints-distributed-sync-v1";
/// Maximum pull page accepted by the deployed protocol.
pub const MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_PULL_PAGE_SIZE: u32 = 200;
/// Maximum public-safe mutation summary accepted by the deployed protocol.
pub const MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_SUMMARY_CHARS: usize = 4_000;

const MAX_CAPABILITY_DOCUMENT_BYTES: usize = 64 * 1024;
const CAPABILITY_ROUTE: &str = "/api/matm/sync/capabilities";

/// Protected routes advertised by the live MemoryEndpoints distributed-sync service.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDistributedSyncRoutes {
    /// Registers a stable device authority.
    pub register_device: String,
    /// Advances a device authority epoch.
    pub rotate_device: String,
    /// Revokes a device authority.
    pub revoke_device: String,
    /// Submits one conflict-safe public-safe mutation.
    pub submit_mutation: String,
    /// Resolves an uncertain write by receipt id or the original idempotency header.
    pub lookup_receipt: String,
    /// Pulls monotonic revisions after a committed checkpoint.
    pub changes: String,
    /// Reads authoritative logical-memory heads.
    pub heads: String,
    /// Reads tombstone and hard-forget policy.
    pub retention: String,
}

/// Mutation behavior advertised by the hosted authority.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDistributedSyncMutationContract {
    /// Supported wire operation names.
    pub operations: Vec<String>,
    /// Whether irreversible hard forget is available.
    pub hard_forget_supported: bool,
    /// Fail-closed behavior when hard forget is requested but unavailable.
    pub hard_forget_behavior: String,
    /// Human-readable idempotency requirement.
    pub idempotency: String,
    /// Revision fields returned by the service.
    pub revision_fields: Vec<String>,
    /// Human-readable stale-parent behavior.
    pub conflict_semantics: String,
    /// Human-readable tombstone behavior.
    pub tombstone_semantics: String,
}

/// Incremental-pull checkpoint behavior advertised by the hosted authority.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDistributedSyncCheckpointContract {
    /// Query fields accepted by the changes route.
    pub changes_query: Vec<String>,
    /// Whether server sequences are monotonic per workspace.
    pub monotonic_server_sequence: bool,
    /// Whether each page publishes its indexed-through watermark.
    pub indexed_through_watermark: bool,
    /// Required page and checkpoint fields.
    pub pagination_fields: Vec<String>,
}

/// Device-authority behavior advertised by the hosted authority.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDistributedSyncDeviceContract {
    /// Whether mutations bind a server-issued device authority epoch.
    pub authority_epoch: bool,
    /// Whether register, rotate, and revoke are all live.
    pub register_rotate_revoke: bool,
    /// Behavior for queued writes from a revoked device.
    pub revoked_device_mutation_behavior: String,
    /// Must remain false; the service stores no device credential material.
    pub secret_material_stored: bool,
}

/// Retention behavior advertised by the hosted authority.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDistributedSyncRetention {
    /// Number of days tombstoned heads remain authoritative.
    pub tombstone_retention_days: u32,
    /// Whether irreversible hard forget is available.
    pub hard_forget_supported: bool,
    /// Must remain false for this public-safe connector contract.
    pub raw_private_payload_stored: bool,
    /// Whether public responses are redacted.
    pub values_redacted: bool,
}

/// Versioned fail-closed capability data returned by MemoryEndpoints.com.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDistributedSyncCapabilities {
    /// Stable schema version.
    pub schema_version: String,
    /// Must be `live` before protected methods can run.
    pub status: String,
    /// Stable wire protocol label.
    pub protocol: String,
    /// Public capability route.
    pub capability_route: String,
    /// Protected route map.
    pub routes: MemoryEndpointsDistributedSyncRoutes,
    /// Hosted mutation semantics.
    pub mutation_contract: MemoryEndpointsDistributedSyncMutationContract,
    /// Incremental pull semantics.
    pub checkpoint_contract: MemoryEndpointsDistributedSyncCheckpointContract,
    /// Device authority semantics.
    pub device_contract: MemoryEndpointsDistributedSyncDeviceContract,
    /// Tombstone retention semantics.
    pub retention: MemoryEndpointsDistributedSyncRetention,
    /// Must be true for connector use.
    pub public_safe_only: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
    /// Must be true.
    pub values_redacted: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CapabilitiesEnvelope {
    ok: bool,
    data: MemoryEndpointsDistributedSyncCapabilities,
}

/// Parses and validates one bounded live capability response envelope.
pub fn parse_distributed_sync_capabilities(
    json: &str,
) -> Result<MemoryEndpointsDistributedSyncCapabilities, MemoryEndpointsSyncError> {
    if json.is_empty() || json.len() > MAX_CAPABILITY_DOCUMENT_BYTES {
        return Err(invalid(
            "distributed-sync capability JSON is empty or exceeds 64 KiB",
        ));
    }
    let envelope = serde_json::from_str::<CapabilitiesEnvelope>(json).map_err(|error| {
        invalid(&format!(
            "invalid distributed-sync capability JSON: {error}"
        ))
    })?;
    if !envelope.ok {
        return Err(invalid(
            "distributed-sync capability response was not successful",
        ));
    }
    validate_distributed_sync_capabilities(&envelope.data)?;
    Ok(envelope.data)
}

/// Validates that a capability document proves every behavior used by the connector.
pub fn validate_distributed_sync_capabilities(
    capabilities: &MemoryEndpointsDistributedSyncCapabilities,
) -> Result<(), MemoryEndpointsSyncError> {
    if capabilities.schema_version != MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_CAPABILITIES_KIND
        || capabilities.protocol != MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_PROTOCOL
        || capabilities.status != "live"
        || capabilities.capability_route != CAPABILITY_ROUTE
    {
        return Err(invalid(
            "unsupported or non-live distributed-sync capability document",
        ));
    }
    if !capabilities.public_safe_only
        || !capabilities.values_redacted
        || capabilities.raw_credential_exposed
        || capabilities.raw_payload_exposed
    {
        return Err(invalid(
            "distributed-sync capabilities violate the public-safe response boundary",
        ));
    }

    validate_routes(&capabilities.routes)?;
    validate_mutation_contract(&capabilities.mutation_contract)?;
    validate_checkpoint_contract(&capabilities.checkpoint_contract)?;
    validate_device_contract(&capabilities.device_contract)?;
    validate_retention(&capabilities.retention)?;
    Ok(())
}

fn validate_routes(
    routes: &MemoryEndpointsDistributedSyncRoutes,
) -> Result<(), MemoryEndpointsSyncError> {
    let expected = [
        (&routes.register_device, "/api/matm/sync/devices"),
        (&routes.rotate_device, "/api/matm/sync/devices/rotate"),
        (&routes.revoke_device, "/api/matm/sync/devices/revoke"),
        (&routes.submit_mutation, "/api/matm/sync/mutations"),
        (&routes.lookup_receipt, "/api/matm/sync/receipts"),
        (&routes.changes, "/api/matm/sync/changes"),
        (&routes.heads, "/api/matm/sync/heads"),
        (&routes.retention, "/api/matm/sync/retention"),
    ];
    if expected.iter().any(|(actual, required)| actual != required) {
        return Err(invalid(
            "distributed-sync capability routes do not match the supported v1 contract",
        ));
    }
    Ok(())
}

fn validate_mutation_contract(
    contract: &MemoryEndpointsDistributedSyncMutationContract,
) -> Result<(), MemoryEndpointsSyncError> {
    let operations = ["upsert", "delete", "hard_forget"];
    let revision_fields = [
        "logicalMemoryId",
        "parentRevisionId",
        "syncRevisionId",
        "serverSequence",
        "bodyHash",
        "conflict",
        "conflictCode",
    ];
    if contract
        .operations
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        != operations
        || contract
            .revision_fields
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            != revision_fields
        || contract.hard_forget_supported
        || contract.hard_forget_behavior != "safe_rejected_receipt"
        || !contract.idempotency.contains("Idempotency-Key")
        || contract.conflict_semantics.trim().is_empty()
        || contract.tombstone_semantics.trim().is_empty()
    {
        return Err(invalid(
            "distributed-sync mutation contract is incomplete or unsupported",
        ));
    }
    Ok(())
}

fn validate_checkpoint_contract(
    contract: &MemoryEndpointsDistributedSyncCheckpointContract,
) -> Result<(), MemoryEndpointsSyncError> {
    let query = [
        "workspace_id",
        "after_sequence",
        "limit",
        "logical_memory_id",
    ];
    let fields = [
        "items",
        "hasMore",
        "nextAfterSequence",
        "indexedThroughSequence",
        "checkpoint",
    ];
    if !contract.monotonic_server_sequence
        || !contract.indexed_through_watermark
        || contract
            .changes_query
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            != query
        || contract
            .pagination_fields
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            != fields
    {
        return Err(invalid(
            "distributed-sync checkpoint contract is incomplete or unsupported",
        ));
    }
    Ok(())
}

fn validate_device_contract(
    contract: &MemoryEndpointsDistributedSyncDeviceContract,
) -> Result<(), MemoryEndpointsSyncError> {
    if !contract.authority_epoch
        || !contract.register_rotate_revoke
        || contract.revoked_device_mutation_behavior != "safe_rejected_receipt"
        || contract.secret_material_stored
    {
        return Err(invalid(
            "distributed-sync device contract is incomplete or unsafe",
        ));
    }
    Ok(())
}

fn validate_retention(
    retention: &MemoryEndpointsDistributedSyncRetention,
) -> Result<(), MemoryEndpointsSyncError> {
    if retention.tombstone_retention_days == 0
        || retention.tombstone_retention_days > 3_650
        || retention.hard_forget_supported
        || retention.raw_private_payload_stored
        || !retention.values_redacted
    {
        return Err(invalid(
            "distributed-sync retention contract is incomplete or unsafe",
        ));
    }
    Ok(())
}

fn invalid(message: &str) -> MemoryEndpointsSyncError {
    MemoryEndpointsSyncError::Invalid(message.to_string())
}
