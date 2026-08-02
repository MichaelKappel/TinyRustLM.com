use crate::protocol::{
    validate_distributed_sync_capabilities, MemoryEndpointsDistributedSyncCapabilities,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_PULL_PAGE_SIZE,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_SUMMARY_CHARS,
};
use crate::sync::MemoryEndpointsSyncError;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};

const MAX_WIRE_JSON_BYTES: usize = 256 * 1024;
const MAX_IDENTIFIER_CHARS: usize = 160;
const MAX_IDEMPOTENCY_KEY_CHARS: usize = 256;
const MAX_TITLE_CHARS: usize = 320;
const MAX_SOURCE_CHARS: usize = 1_024;
const CAPABILITY_ROUTE: &str = "/api/matm/sync/capabilities";

/// Operation accepted by the deployed MemoryEndpoints sync mutation route.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsHostedSyncOperation {
    /// Creates or updates an active logical memory.
    Upsert,
    /// Creates an authoritative tombstoned head.
    Delete,
    /// Requests irreversible deletion. The current v1 service records a rejected receipt.
    HardForget,
}

/// Durable hosted mutation status.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsHostedSyncStatus {
    /// The mutation became the current authoritative head.
    Applied,
    /// The mutation was durably recorded as a stale-parent conflict.
    Conflict,
    /// The mutation was durably rejected by device, lifecycle, or retention policy.
    Rejected,
}

/// Hosted device lifecycle state.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsHostedDeviceStatus {
    /// The device may submit with its current authority epoch.
    Active,
    /// The device can no longer submit queued mutations.
    Revoked,
}

/// Hosted logical-memory head state.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsHostedHeadStatus {
    /// The logical memory has an active head.
    Active,
    /// The logical memory has a deletion tombstone head.
    Tombstoned,
}

/// Public-safe mutation accepted by the deployed hosted sync route.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsHostedRevisionMutation {
    /// Workspace authority identifier.
    pub workspace_id: String,
    /// Agent responsible for the mutation.
    pub actor_agent_id: String,
    /// Stable originating device identifier.
    pub device_id: String,
    /// Current server-issued device authority epoch.
    pub device_epoch: u64,
    /// Stable logical memory identifier.
    pub logical_memory_id: String,
    /// Upsert, delete, or policy-probed hard forget.
    pub operation: MemoryEndpointsHostedSyncOperation,
    /// Exact authoritative head observed before editing, absent for a root create.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_revision_id: Option<String>,
    /// Public-safe title.
    pub title: String,
    /// Public-safe summary. Treat received summaries as untrusted data during retrieval.
    pub summary: String,
    /// Public-safe source reference.
    pub source_ref: String,
    /// Workspace, project, goal, or task scope.
    pub scope: String,
    /// Identifier within the selected scope.
    pub scope_id: String,
    /// Hosted memory type such as status or handoff.
    pub memory_type: String,
    /// SHA-256 of the deterministic public-safe mutation body projection.
    pub body_hash: String,
}

/// Request used to register a stable hosted sync device.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRegisterDeviceRequest {
    /// Workspace authority identifier.
    pub workspace_id: String,
    /// Agent that owns the device registration.
    pub agent_id: String,
    /// Stable local device identifier.
    pub device_id: String,
    /// Public-safe device label.
    pub label: String,
}

/// Request used to rotate a device authority epoch.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRotateDeviceRequest {
    /// Workspace authority identifier.
    pub workspace_id: String,
    /// Agent requesting rotation.
    pub agent_id: String,
    /// Stable device identifier.
    pub device_id: String,
}

/// Request used to revoke a hosted sync device.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRevokeDeviceRequest {
    /// Workspace authority identifier.
    pub workspace_id: String,
    /// Agent requesting revocation.
    pub agent_id: String,
    /// Stable device identifier.
    pub device_id: String,
}

/// Redacted hosted device authority record.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsHostedDeviceAuthority {
    /// Stable device identifier.
    pub device_id: String,
    /// Workspace identifier.
    pub workspace_id: String,
    /// Owning agent identifier.
    pub agent_id: String,
    /// Public-safe label.
    pub label: String,
    /// Active or revoked state.
    pub status: MemoryEndpointsHostedDeviceStatus,
    /// Current authority epoch.
    pub authority_epoch: u64,
    /// ISO-8601 creation time.
    pub created_at: String,
    /// ISO-8601 update time.
    pub updated_at: String,
    /// ISO-8601 revocation time, when revoked.
    pub revoked_at: Option<String>,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Public-safe operator summary returned by device authority routes.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDeviceOperatorSummary {
    /// Stable summary schema.
    pub schema_version: String,
    /// Register, rotate, or revoke.
    pub action: String,
    /// Device identifier.
    pub device_id: String,
    /// Resulting device state.
    pub status: MemoryEndpointsHostedDeviceStatus,
    /// Resulting authority epoch.
    pub authority_epoch: u64,
    /// Must be true after authoritative readback.
    pub persisted: bool,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Authoritative response from register, rotate, or revoke.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDeviceAuthorityResponse {
    /// Successful response marker.
    pub ok: bool,
    /// Must be true after server readback.
    pub persisted: bool,
    /// Whether the device is visible through the authorized workspace.
    pub visible_to_agent: bool,
    /// Whether device authority readback succeeded.
    pub device_authority_persisted: bool,
    /// Canonical workspace identifier.
    pub canonical_workspace_id: String,
    /// Canonical device identifier.
    pub canonical_device_id: String,
    /// Resulting device authority.
    pub device: MemoryEndpointsHostedDeviceAuthority,
    /// Public capability route.
    pub capability_route: String,
    /// Redacted operator summary.
    pub operator_summary: MemoryEndpointsDeviceOperatorSummary,
    /// True only on an exact idempotent replay.
    #[serde(default)]
    pub idempotent_replay: bool,
    /// Must remain false when present.
    #[serde(default)]
    pub idempotency_key_exposed: bool,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Body-free durable hosted mutation receipt.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsReconciliationReceipt {
    /// Stable hosted receipt identifier.
    pub receipt_id: String,
    /// Workspace identifier.
    pub workspace_id: String,
    /// One-way SHA-256 of the idempotency key.
    pub idempotency_key_hash: String,
    /// Hash of the public-safe mutation body projection.
    pub body_hash: String,
    /// Logical memory identifier.
    pub logical_memory_id: String,
    /// Server-assigned revision identifier, empty for a rejected write.
    pub sync_revision_id: String,
    /// Workspace-monotonic sequence, zero for a rejected write without a revision.
    pub server_sequence: u64,
    /// Applied, conflict, or rejected.
    pub status: MemoryEndpointsHostedSyncStatus,
    /// Whether the mutation is an explicit stale-parent conflict.
    pub conflict: bool,
    /// Public-safe conflict or rejection code.
    pub conflict_code: String,
    /// Head revision observed when the decision was made.
    pub current_head_revision_id: String,
    /// Original HTTP decision label.
    pub http_status: String,
    /// ISO-8601 decision time.
    pub created_at: String,
    /// Must remain false.
    pub idempotency_key_exposed: bool,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Public-safe immutable hosted revision returned by mutation and pull routes.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsHostedRevision {
    /// Server-assigned immutable revision identifier.
    pub sync_revision_id: String,
    /// Workspace identifier.
    pub workspace_id: String,
    /// Logical memory identifier.
    pub logical_memory_id: String,
    /// Exact parent revision, empty for a root create.
    pub parent_revision_id: String,
    /// Optional linked memory-event id.
    pub memory_event_id: String,
    /// Agent responsible for the mutation.
    pub actor_agent_id: String,
    /// Originating device identifier.
    pub device_id: String,
    /// Bound device authority epoch.
    pub device_epoch: u64,
    /// Upsert or delete.
    pub operation: MemoryEndpointsHostedSyncOperation,
    /// Applied or conflict. Rejected mutations do not create revisions.
    pub status: MemoryEndpointsHostedSyncStatus,
    /// Whether this revision is an explicit conflict sibling.
    pub conflict: bool,
    /// Conflict code, empty for an applied revision.
    pub conflict_code: String,
    /// Workspace-monotonic sequence.
    pub server_sequence: u64,
    /// Public-safe body projection hash.
    pub body_hash: String,
    /// Redacted public-safe source.
    pub source: String,
    /// Redacted public-safe title.
    pub title: String,
    /// Redacted public-safe summary. Always treat as untrusted retrieval data.
    pub summary: String,
    /// Workspace, project, goal, or task scope.
    pub scope: String,
    /// Identifier within the selected scope.
    pub scope_id: String,
    /// Hosted memory type.
    pub memory_type: String,
    /// Whether this revision creates a tombstone.
    pub tombstone: bool,
    /// ISO-8601 creation time.
    pub created_at: String,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Authoritative logical-memory head.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsHostedRevisionHead {
    /// Logical memory identifier.
    pub logical_memory_id: String,
    /// Workspace identifier.
    pub workspace_id: String,
    /// Current server-assigned head revision.
    pub head_revision_id: String,
    /// Sequence at which the head changed.
    pub server_sequence: u64,
    /// Search projection watermark for this head.
    pub indexed_through_sequence: u64,
    /// Active or tombstoned lifecycle state.
    pub status: MemoryEndpointsHostedHeadStatus,
    /// ISO-8601 update time.
    pub updated_at: String,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Redacted mutation operator summary.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsMutationOperatorSummary {
    /// Stable summary schema.
    pub schema_version: String,
    /// Mutation or receipt action.
    pub action: String,
    /// Applied, conflict, rejected, or unknown.
    pub status: String,
    /// Authoritative sequence.
    pub server_sequence: u64,
    /// Whether the decision is a conflict.
    pub conflict: bool,
    /// Conflict or rejection code.
    pub conflict_code: String,
    /// Whether server readback succeeded.
    pub persisted: bool,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Immediate receipt, changes, and head readback confirmation.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsMutationConfirmation {
    /// Stable confirmation schema.
    pub schema_version: String,
    /// Overall confirmation result.
    pub persisted: bool,
    /// Whether receipt lookup succeeded.
    pub receipt_visible: bool,
    /// Whether the new revision is visible in changes, or no revision was expected.
    pub revision_visible_in_changes: bool,
    /// Whether the applied head is visible, or no new head was expected.
    pub head_visible: bool,
    /// Matching changes count.
    pub changes_count: u64,
    /// Matching heads count.
    pub heads_count: u64,
    /// Confirmed receipt identifier.
    pub receipt_id: String,
    /// Confirmed revision identifier, empty for rejected writes.
    pub revision_id: String,
    /// Confirmed logical memory identifier.
    pub logical_memory_id: String,
    /// Indexed-through watermark observed during confirmation.
    pub indexed_through_sequence: u64,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Typed response from one hosted mutation submission or exact replay.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRevisionDecisionResponse {
    /// True only when the mutation was applied.
    pub ok: bool,
    /// Must be true because every decision is durably receipt-backed.
    pub persisted: bool,
    /// Durable body-free receipt.
    pub receipt: MemoryEndpointsReconciliationReceipt,
    /// Immutable revision, absent only for a rejected mutation.
    pub revision: Option<MemoryEndpointsHostedRevision>,
    /// Current authoritative head, when one exists.
    pub head: Option<MemoryEndpointsHostedRevisionHead>,
    /// Decision sequence, zero for a rejected mutation without a revision.
    pub server_sequence: u64,
    /// Search/head index watermark returned with the decision.
    pub indexed_through_sequence: u64,
    /// Whether the decision is a stale-parent conflict.
    pub conflict: bool,
    /// Applied, conflict, or rejected.
    pub status: MemoryEndpointsHostedSyncStatus,
    /// Redacted operator summary.
    pub operator_summary: MemoryEndpointsMutationOperatorSummary,
    /// Protected receipt readback path with public identifiers only.
    pub receipt_query_url: String,
    /// Protected changes readback path with public identifiers only.
    pub changes_query_url: String,
    /// Protected head readback path with public identifiers only.
    pub heads_query_url: String,
    /// Public capability route.
    pub capability_route: String,
    /// Immediate authoritative readback confirmation.
    pub confirmation: MemoryEndpointsMutationConfirmation,
    /// True only on an exact same-body retry.
    #[serde(default)]
    pub idempotent_replay: bool,
    /// Must remain false when present.
    #[serde(default)]
    pub idempotency_key_exposed: bool,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Response from receipt lookup by the original idempotency header or receipt id.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsReceiptLookupResponse {
    /// Successful lookup marker.
    pub ok: bool,
    /// Durable body-free receipt.
    pub receipt: MemoryEndpointsReconciliationReceipt,
    /// Redacted operator summary.
    pub operator_summary: MemoryEndpointsMutationOperatorSummary,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Inputs retained locally to validate an uncertain receipt lookup.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsReceiptLookupRequest {
    /// Original idempotency key, sent only in the protected request header.
    pub idempotency_key: String,
    /// Expected logical memory identifier.
    pub logical_memory_id: String,
    /// Expected public-safe mutation body hash.
    pub body_hash: String,
}

/// Redacted checkpoint included in every changes page.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsHostedCheckpoint {
    /// One-way workspace identifier hash.
    pub workspace_id_hash: String,
    /// Requested starting sequence.
    pub after_sequence: u64,
    /// Sequence to commit only after applying the complete page transactionally.
    pub next_after_sequence: u64,
    /// Must be true.
    pub values_redacted: bool,
}

/// Inner monotonic hosted change page.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsChangePage {
    /// Revisions in strictly increasing server-sequence order.
    pub items: Vec<MemoryEndpointsHostedRevision>,
    /// Number of returned revisions.
    pub count: usize,
    /// Whether another page exists.
    pub has_more: bool,
    /// Sequence to request after transactional page application.
    pub next_after_sequence: u64,
    /// Latest revision sequence accepted by the authority.
    pub indexed_through_sequence: u64,
    /// Redacted checkpoint details.
    pub checkpoint: MemoryEndpointsHostedCheckpoint,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Top-level response from the hosted changes route.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsChangePageResponse {
    /// Successful response marker.
    pub ok: bool,
    /// Monotonic change page.
    pub changes: MemoryEndpointsChangePage,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Filters echoed by the hosted heads route.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsHeadsFilters {
    /// Optional logical-memory filter.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logical_memory_id: Option<String>,
}

/// Response from authoritative head readback.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsReadHeadsResponse {
    /// Successful response marker.
    pub ok: bool,
    /// Authoritative heads sorted by logical memory identifier.
    pub items: Vec<MemoryEndpointsHostedRevisionHead>,
    /// Number of returned heads.
    pub count: usize,
    /// Applied logical-memory filter, if any.
    pub filters: MemoryEndpointsHeadsFilters,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Hosted tombstone retention policy.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRetentionPolicy {
    /// Stable policy schema.
    pub schema_version: String,
    /// Number of days tombstoned heads remain authoritative.
    pub tombstone_retention_days: u32,
    /// Whether irreversible hard forget is supported.
    pub hard_forget_supported: bool,
    /// Durable rejection behavior when hard forget is unavailable.
    pub hard_forget_behavior: String,
    /// Must remain false.
    pub raw_private_payload_stored: bool,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Response from the hosted retention route.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRetentionPolicyResponse {
    /// Successful response marker.
    pub ok: bool,
    /// Hosted retention policy.
    pub policy: MemoryEndpointsRetentionPolicy,
    /// Capability data repeated for consistency checking.
    pub capabilities: MemoryEndpointsDistributedSyncCapabilities,
    /// Must be true.
    pub values_redacted: bool,
    /// Must remain false.
    pub raw_credential_exposed: bool,
    /// Must remain false.
    pub raw_payload_exposed: bool,
}

/// Canonicalizes a mutation and recomputes its body hash.
pub fn canonicalize_hosted_revision_mutation(
    mutation: &MemoryEndpointsHostedRevisionMutation,
) -> Result<MemoryEndpointsHostedRevisionMutation, MemoryEndpointsSyncError> {
    let mut canonical = mutation.clone();
    canonical.workspace_id = canonical.workspace_id.trim().to_string();
    canonical.actor_agent_id = canonical.actor_agent_id.trim().to_string();
    canonical.device_id = canonical.device_id.trim().to_string();
    canonical.logical_memory_id = canonical.logical_memory_id.trim().to_string();
    canonical.parent_revision_id = canonical
        .parent_revision_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    canonical.title = canonical.title.trim().to_string();
    canonical.source_ref = canonical.source_ref.trim().to_string();
    canonical.scope = canonical.scope.trim().to_ascii_lowercase();
    canonical.scope_id = canonical.scope_id.trim().to_string();
    canonical.memory_type = canonical.memory_type.trim().to_ascii_lowercase();
    canonical.body_hash = hosted_revision_mutation_body_hash(&canonical)?;
    validate_hosted_revision_mutation(&canonical)?;
    Ok(canonical)
}

/// Computes the public-safe body hash stored by MemoryEndpoints receipts and revisions.
pub fn hosted_revision_mutation_body_hash(
    mutation: &MemoryEndpointsHostedRevisionMutation,
) -> Result<String, MemoryEndpointsSyncError> {
    let operation = match mutation.operation {
        MemoryEndpointsHostedSyncOperation::Upsert => "upsert",
        MemoryEndpointsHostedSyncOperation::Delete => "delete",
        MemoryEndpointsHostedSyncOperation::HardForget => "hard_forget",
    };
    let projection = json!({
        "logicalMemoryId": mutation.logical_memory_id,
        "operation": operation,
        "parentRevisionId": mutation.parent_revision_id.as_deref().unwrap_or(""),
        "source": mutation.source_ref,
        "summary": mutation.summary,
        "title": mutation.title,
    });
    let bytes = serde_json::to_vec(&projection).map_err(|error| {
        invalid(&format!(
            "failed to serialize mutation body projection: {error}"
        ))
    })?;
    Ok(sha256_hex(&bytes))
}

/// Serializes a canonical hosted mutation using a stable field order.
pub fn serialize_hosted_revision_mutation(
    mutation: &MemoryEndpointsHostedRevisionMutation,
) -> Result<String, MemoryEndpointsSyncError> {
    let canonical = canonicalize_hosted_revision_mutation(mutation)?;
    serde_json::to_string(&canonical)
        .map_err(|error| invalid(&format!("failed to serialize hosted mutation: {error}")))
}

/// Computes a cross-runtime fingerprint for one canonical hosted mutation request body.
pub fn hosted_revision_mutation_fingerprint(
    mutation: &MemoryEndpointsHostedRevisionMutation,
) -> Result<String, MemoryEndpointsSyncError> {
    Ok(sha256_hex(
        serialize_hosted_revision_mutation(mutation)?.as_bytes(),
    ))
}

/// Validates a public-safe hosted mutation before network use.
pub fn validate_hosted_revision_mutation(
    mutation: &MemoryEndpointsHostedRevisionMutation,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("workspaceId", &mutation.workspace_id)?;
    validate_identifier("actorAgentId", &mutation.actor_agent_id)?;
    validate_identifier("deviceId", &mutation.device_id)?;
    validate_identifier("logicalMemoryId", &mutation.logical_memory_id)?;
    if let Some(parent) = &mutation.parent_revision_id {
        validate_identifier("parentRevisionId", parent)?;
    }
    if mutation.device_epoch == 0 {
        return Err(invalid("deviceEpoch must be greater than zero"));
    }
    validate_public_text("title", &mutation.title, MAX_TITLE_CHARS)?;
    validate_public_text(
        "summary",
        &mutation.summary,
        MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_SUMMARY_CHARS,
    )?;
    validate_public_text("sourceRef", &mutation.source_ref, MAX_SOURCE_CHARS)?;
    validate_identifier("scopeId", &mutation.scope_id)?;
    if !matches!(
        mutation.scope.as_str(),
        "workspace" | "project" | "goal" | "task"
    ) {
        return Err(invalid(
            "scope is not supported by the hosted sync contract",
        ));
    }
    if !matches!(mutation.memory_type.as_str(), "status" | "handoff" | "note") {
        return Err(invalid(
            "memoryType is not supported by the hosted sync contract",
        ));
    }
    validate_sha256("bodyHash", &mutation.body_hash)?;
    let expected = hosted_revision_mutation_body_hash(mutation)?;
    if mutation.body_hash != expected {
        return Err(invalid(
            "bodyHash does not match the deterministic public-safe mutation projection",
        ));
    }
    Ok(())
}

/// Validates an idempotency key retained only in session memory or a credential-free outbox row.
pub fn validate_distributed_sync_idempotency_key(
    key: &str,
) -> Result<(), MemoryEndpointsSyncError> {
    if key.is_empty()
        || key.len() > MAX_IDEMPOTENCY_KEY_CHARS
        || key.bytes().any(|byte| {
            !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
        })
        || looks_like_secret(key)
    {
        return Err(invalid("idempotency key is missing, malformed, or unsafe"));
    }
    Ok(())
}

/// Validates a register-device request.
pub fn validate_register_device_request(
    request: &MemoryEndpointsRegisterDeviceRequest,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("workspaceId", &request.workspace_id)?;
    validate_identifier("agentId", &request.agent_id)?;
    validate_identifier("deviceId", &request.device_id)?;
    validate_public_text("label", &request.label, MAX_TITLE_CHARS)
}

/// Validates a rotate-device request.
pub fn validate_rotate_device_request(
    request: &MemoryEndpointsRotateDeviceRequest,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("workspaceId", &request.workspace_id)?;
    validate_identifier("agentId", &request.agent_id)?;
    validate_identifier("deviceId", &request.device_id)
}

/// Validates a revoke-device request.
pub fn validate_revoke_device_request(
    request: &MemoryEndpointsRevokeDeviceRequest,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("workspaceId", &request.workspace_id)?;
    validate_identifier("agentId", &request.agent_id)?;
    validate_identifier("deviceId", &request.device_id)
}

/// Validates receipt-lookup identity retained by the local outbox.
pub fn validate_receipt_lookup_request(
    request: &MemoryEndpointsReceiptLookupRequest,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_distributed_sync_idempotency_key(&request.idempotency_key)?;
    validate_identifier("logicalMemoryId", &request.logical_memory_id)?;
    validate_sha256("bodyHash", &request.body_hash)
}

/// Parses and validates one mutation response.
pub fn parse_revision_decision_response(
    json: &str,
) -> Result<MemoryEndpointsRevisionDecisionResponse, MemoryEndpointsSyncError> {
    let response = parse_bounded(json, "mutation decision")?;
    validate_revision_decision_response(&response)?;
    Ok(response)
}

/// Parses and validates one receipt lookup response.
pub fn parse_receipt_lookup_response(
    json: &str,
) -> Result<MemoryEndpointsReceiptLookupResponse, MemoryEndpointsSyncError> {
    let response: MemoryEndpointsReceiptLookupResponse = parse_bounded(json, "receipt lookup")?;
    validate_redaction(
        response.values_redacted,
        response.raw_credential_exposed,
        response.raw_payload_exposed,
    )?;
    if !response.ok || !response.operator_summary.persisted {
        return Err(invalid("receipt lookup was not authoritative"));
    }
    validate_operator_summary(&response.operator_summary, "receipt")?;
    validate_reconciliation_receipt(&response.receipt)?;
    Ok(response)
}

/// Parses and validates one hosted changes response at a requested checkpoint.
pub fn parse_change_page(
    json: &str,
    requested_after_sequence: u64,
) -> Result<MemoryEndpointsChangePageResponse, MemoryEndpointsSyncError> {
    let response: MemoryEndpointsChangePageResponse = parse_bounded(json, "change page")?;
    validate_redaction(
        response.values_redacted,
        response.raw_credential_exposed,
        response.raw_payload_exposed,
    )?;
    if !response.ok {
        return Err(invalid("change page response was not successful"));
    }
    validate_change_page(&response.changes, requested_after_sequence)?;
    Ok(response)
}

/// Parses and validates authoritative head readback.
pub fn parse_read_heads_response(
    json: &str,
) -> Result<MemoryEndpointsReadHeadsResponse, MemoryEndpointsSyncError> {
    let response = parse_bounded(json, "heads response")?;
    validate_read_heads_response(&response)?;
    Ok(response)
}

/// Parses and validates a device authority response.
pub fn parse_device_authority_response(
    json: &str,
) -> Result<MemoryEndpointsDeviceAuthorityResponse, MemoryEndpointsSyncError> {
    let response = parse_bounded(json, "device authority response")?;
    validate_device_authority_response(&response)?;
    Ok(response)
}

/// Parses and validates hosted retention policy readback.
pub fn parse_retention_policy_response(
    json: &str,
) -> Result<MemoryEndpointsRetentionPolicyResponse, MemoryEndpointsSyncError> {
    let response = parse_bounded(json, "retention response")?;
    validate_retention_policy_response(&response)?;
    Ok(response)
}

/// Validates a durable mutation decision and all nested authority evidence.
pub fn validate_revision_decision_response(
    response: &MemoryEndpointsRevisionDecisionResponse,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_redaction(
        response.values_redacted,
        response.raw_credential_exposed,
        response.raw_payload_exposed,
    )?;
    if !response.persisted || response.capability_route != CAPABILITY_ROUTE {
        return Err(invalid("mutation decision was not durably confirmed"));
    }
    if response.idempotency_key_exposed {
        return Err(invalid("mutation response exposed the idempotency key"));
    }
    validate_reconciliation_receipt(&response.receipt)?;
    validate_operator_summary(&response.operator_summary, "mutation")?;
    validate_confirmation(&response.confirmation, &response.receipt)?;
    validate_protected_query(&response.receipt_query_url, "/api/matm/sync/receipts?")?;
    validate_protected_query(&response.changes_query_url, "/api/matm/sync/changes?")?;
    validate_protected_query(&response.heads_query_url, "/api/matm/sync/heads?")?;

    if response.receipt.status != response.status
        || response.receipt.server_sequence != response.server_sequence
        || response.receipt.receipt_id != response.confirmation.receipt_id
        || response.receipt.logical_memory_id != response.confirmation.logical_memory_id
    {
        return Err(invalid("mutation response identity fields disagree"));
    }
    match response.status {
        MemoryEndpointsHostedSyncStatus::Applied => {
            let revision = response
                .revision
                .as_ref()
                .ok_or_else(|| invalid("applied decision is missing its revision"))?;
            let head = response
                .head
                .as_ref()
                .ok_or_else(|| invalid("applied decision is missing its head"))?;
            if !response.ok
                || response.conflict
                || response.server_sequence == 0
                || revision.sync_revision_id != response.receipt.sync_revision_id
                || head.head_revision_id != revision.sync_revision_id
                || !response.confirmation.revision_visible_in_changes
                || !response.confirmation.head_visible
            {
                return Err(invalid(
                    "applied mutation decision is internally inconsistent",
                ));
            }
            validate_hosted_revision(revision)?;
            validate_hosted_revision_head(head)?;
        }
        MemoryEndpointsHostedSyncStatus::Conflict => {
            let revision = response
                .revision
                .as_ref()
                .ok_or_else(|| invalid("conflict decision is missing its revision"))?;
            if response.ok
                || !response.conflict
                || response.server_sequence == 0
                || !revision.conflict
                || revision.conflict_code != response.receipt.conflict_code
                || !is_supported_conflict_code(&response.receipt.conflict_code)
            {
                return Err(invalid(
                    "conflict mutation decision is internally inconsistent",
                ));
            }
            validate_hosted_revision(revision)?;
            if let Some(head) = &response.head {
                validate_hosted_revision_head(head)?;
            }
        }
        MemoryEndpointsHostedSyncStatus::Rejected => {
            if response.ok
                || response.conflict
                || response.revision.is_some()
                || response.server_sequence != 0
                || response.receipt.conflict_code.is_empty()
            {
                return Err(invalid(
                    "rejected mutation decision is internally inconsistent",
                ));
            }
            if let Some(head) = &response.head {
                validate_hosted_revision_head(head)?;
            }
        }
    }
    Ok(())
}

/// Validates one body-free receipt.
pub fn validate_reconciliation_receipt(
    receipt: &MemoryEndpointsReconciliationReceipt,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("receiptId", &receipt.receipt_id)?;
    validate_identifier("workspaceId", &receipt.workspace_id)?;
    validate_identifier("logicalMemoryId", &receipt.logical_memory_id)?;
    validate_sha256_prefix("idempotencyKeyHash", &receipt.idempotency_key_hash)?;
    validate_sha256("bodyHash", &receipt.body_hash)?;
    if !receipt.sync_revision_id.is_empty() {
        validate_identifier("syncRevisionId", &receipt.sync_revision_id)?;
    }
    if !receipt.current_head_revision_id.is_empty() {
        validate_identifier("currentHeadRevisionId", &receipt.current_head_revision_id)?;
    }
    validate_timestamp("createdAt", &receipt.created_at)?;
    validate_redaction(
        receipt.values_redacted,
        receipt.raw_credential_exposed,
        receipt.raw_payload_exposed,
    )?;
    if receipt.idempotency_key_exposed {
        return Err(invalid("receipt exposed the idempotency key"));
    }
    match receipt.status {
        MemoryEndpointsHostedSyncStatus::Applied => {
            if receipt.conflict
                || !receipt.conflict_code.is_empty()
                || receipt.server_sequence == 0
                || receipt.sync_revision_id.is_empty()
            {
                return Err(invalid("applied receipt is internally inconsistent"));
            }
        }
        MemoryEndpointsHostedSyncStatus::Conflict => {
            if !receipt.conflict
                || !is_supported_conflict_code(&receipt.conflict_code)
                || receipt.server_sequence == 0
                || receipt.sync_revision_id.is_empty()
            {
                return Err(invalid("conflict receipt is internally inconsistent"));
            }
        }
        MemoryEndpointsHostedSyncStatus::Rejected => {
            if receipt.conflict
                || receipt.conflict_code.is_empty()
                || receipt.server_sequence != 0
                || !receipt.sync_revision_id.is_empty()
            {
                return Err(invalid("rejected receipt is internally inconsistent"));
            }
        }
    }
    Ok(())
}

/// Validates a monotonic changes page against its requested checkpoint.
pub fn validate_change_page(
    page: &MemoryEndpointsChangePage,
    requested_after_sequence: u64,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_redaction(
        page.values_redacted,
        page.raw_credential_exposed,
        page.raw_payload_exposed,
    )?;
    if page.count != page.items.len()
        || page.count > MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_PULL_PAGE_SIZE as usize
        || page.checkpoint.after_sequence != requested_after_sequence
        || page.checkpoint.next_after_sequence != page.next_after_sequence
        || !page.checkpoint.values_redacted
    {
        return Err(invalid(
            "change page count or checkpoint metadata is invalid",
        ));
    }
    validate_sha256_prefix("workspaceIdHash", &page.checkpoint.workspace_id_hash)?;
    let mut previous = requested_after_sequence;
    for revision in &page.items {
        validate_hosted_revision(revision)?;
        if revision.server_sequence <= previous {
            return Err(invalid("change page sequences are not strictly monotonic"));
        }
        previous = revision.server_sequence;
    }
    if page.next_after_sequence != previous
        || page.indexed_through_sequence < page.next_after_sequence
        || page.has_more && page.items.is_empty()
    {
        return Err(invalid("change page continuation metadata is unsafe"));
    }
    Ok(())
}

/// Validates authoritative heads and response redaction.
pub fn validate_read_heads_response(
    response: &MemoryEndpointsReadHeadsResponse,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_redaction(
        response.values_redacted,
        response.raw_credential_exposed,
        response.raw_payload_exposed,
    )?;
    if !response.ok || response.count != response.items.len() {
        return Err(invalid("heads response count is invalid"));
    }
    if let Some(logical_memory_id) = &response.filters.logical_memory_id {
        validate_identifier("filters.logicalMemoryId", logical_memory_id)?;
    }
    let mut previous = "";
    for head in &response.items {
        validate_hosted_revision_head(head)?;
        if head.logical_memory_id.as_str() < previous {
            return Err(invalid("heads response is not deterministically sorted"));
        }
        previous = &head.logical_memory_id;
    }
    Ok(())
}

/// Validates device authority readback.
pub fn validate_device_authority_response(
    response: &MemoryEndpointsDeviceAuthorityResponse,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_redaction(
        response.values_redacted,
        response.raw_credential_exposed,
        response.raw_payload_exposed,
    )?;
    if !response.ok
        || !response.persisted
        || !response.visible_to_agent
        || !response.device_authority_persisted
        || response.capability_route != CAPABILITY_ROUTE
        || response.idempotency_key_exposed
        || response.canonical_workspace_id != response.device.workspace_id
        || response.canonical_device_id != response.device.device_id
    {
        return Err(invalid(
            "device authority response was not durably confirmed",
        ));
    }
    validate_identifier("deviceId", &response.device.device_id)?;
    validate_identifier("workspaceId", &response.device.workspace_id)?;
    validate_identifier("agentId", &response.device.agent_id)?;
    validate_public_text("label", &response.device.label, MAX_TITLE_CHARS)?;
    validate_timestamp("createdAt", &response.device.created_at)?;
    validate_timestamp("updatedAt", &response.device.updated_at)?;
    if response.device.authority_epoch == 0
        || !response.device.values_redacted
        || response.device.raw_payload_exposed
        || response.operator_summary.authority_epoch != response.device.authority_epoch
        || response.operator_summary.device_id != response.device.device_id
        || response.operator_summary.status != response.device.status
        || !response.operator_summary.persisted
        || !response.operator_summary.values_redacted
        || response.operator_summary.raw_credential_exposed
        || response.operator_summary.raw_payload_exposed
        || response.operator_summary.schema_version
            != "memoryendpoints.sync_device_operator_summary.v1"
    {
        return Err(invalid(
            "device authority metadata is internally inconsistent",
        ));
    }
    match response.device.status {
        MemoryEndpointsHostedDeviceStatus::Active if response.device.revoked_at.is_some() => {
            Err(invalid("active device has a revocation time"))
        }
        MemoryEndpointsHostedDeviceStatus::Revoked => {
            let revoked_at = response
                .device
                .revoked_at
                .as_deref()
                .ok_or_else(|| invalid("revoked device is missing its revocation time"))?;
            validate_timestamp("revokedAt", revoked_at)
        }
        _ => Ok(()),
    }
}

/// Validates hosted retention readback and its repeated capability data.
pub fn validate_retention_policy_response(
    response: &MemoryEndpointsRetentionPolicyResponse,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_redaction(
        response.values_redacted,
        response.raw_credential_exposed,
        response.raw_payload_exposed,
    )?;
    validate_distributed_sync_capabilities(&response.capabilities)?;
    if !response.ok
        || response.policy.schema_version != "memoryendpoints.sync_retention.v1"
        || response.policy.tombstone_retention_days == 0
        || response.policy.tombstone_retention_days > 3_650
        || response.policy.hard_forget_supported
        || response.policy.hard_forget_behavior != "safe_rejected_receipt"
        || response.policy.raw_private_payload_stored
        || !response.policy.values_redacted
        || response.policy.raw_credential_exposed
        || response.policy.raw_payload_exposed
        || response.policy.tombstone_retention_days
            != response.capabilities.retention.tombstone_retention_days
    {
        return Err(invalid(
            "retention policy response is incomplete or inconsistent",
        ));
    }
    Ok(())
}

fn validate_hosted_revision(
    revision: &MemoryEndpointsHostedRevision,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("syncRevisionId", &revision.sync_revision_id)?;
    validate_identifier("workspaceId", &revision.workspace_id)?;
    validate_identifier("logicalMemoryId", &revision.logical_memory_id)?;
    if !revision.parent_revision_id.is_empty() {
        validate_identifier("parentRevisionId", &revision.parent_revision_id)?;
    }
    if !revision.memory_event_id.is_empty() {
        validate_identifier("memoryEventId", &revision.memory_event_id)?;
    }
    validate_identifier("actorAgentId", &revision.actor_agent_id)?;
    if !revision.device_id.is_empty() {
        validate_identifier("deviceId", &revision.device_id)?;
    }
    validate_sha256("bodyHash", &revision.body_hash)?;
    validate_public_text("source", &revision.source, MAX_SOURCE_CHARS)?;
    validate_public_text("title", &revision.title, MAX_TITLE_CHARS)?;
    validate_public_text(
        "summary",
        &revision.summary,
        MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_SUMMARY_CHARS,
    )?;
    validate_identifier("scopeId", &revision.scope_id)?;
    validate_timestamp("createdAt", &revision.created_at)?;
    if revision.server_sequence == 0
        || !revision.values_redacted
        || revision.raw_payload_exposed
        || revision.status == MemoryEndpointsHostedSyncStatus::Rejected
        || revision.tombstone != (revision.operation == MemoryEndpointsHostedSyncOperation::Delete)
        || revision.conflict != (revision.status == MemoryEndpointsHostedSyncStatus::Conflict)
        || revision.conflict && !is_supported_conflict_code(&revision.conflict_code)
    {
        return Err(invalid("hosted revision metadata is invalid"));
    }
    Ok(())
}

fn validate_hosted_revision_head(
    head: &MemoryEndpointsHostedRevisionHead,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("logicalMemoryId", &head.logical_memory_id)?;
    validate_identifier("workspaceId", &head.workspace_id)?;
    validate_identifier("headRevisionId", &head.head_revision_id)?;
    validate_timestamp("updatedAt", &head.updated_at)?;
    if head.server_sequence == 0
        || head.indexed_through_sequence < head.server_sequence
        || !head.values_redacted
        || head.raw_payload_exposed
    {
        return Err(invalid("hosted head metadata is invalid"));
    }
    Ok(())
}

fn validate_operator_summary(
    summary: &MemoryEndpointsMutationOperatorSummary,
    expected_action: &str,
) -> Result<(), MemoryEndpointsSyncError> {
    if summary.schema_version != "memoryendpoints.sync_operator_summary.v1"
        || summary.action != expected_action
        || !summary.persisted
        || !summary.values_redacted
        || summary.raw_credential_exposed
        || summary.raw_payload_exposed
    {
        return Err(invalid("operator summary is incomplete or unsafe"));
    }
    Ok(())
}

fn validate_confirmation(
    confirmation: &MemoryEndpointsMutationConfirmation,
    receipt: &MemoryEndpointsReconciliationReceipt,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_redaction(
        confirmation.values_redacted,
        confirmation.raw_credential_exposed,
        confirmation.raw_payload_exposed,
    )?;
    if confirmation.schema_version != "memoryendpoints.sync_mutation_confirmation.v1"
        || !confirmation.persisted
        || !confirmation.receipt_visible
        || confirmation.receipt_id != receipt.receipt_id
        || confirmation.revision_id != receipt.sync_revision_id
        || confirmation.logical_memory_id != receipt.logical_memory_id
    {
        return Err(invalid("mutation confirmation identity is invalid"));
    }
    Ok(())
}

fn parse_bounded<T: DeserializeOwned>(
    json: &str,
    label: &str,
) -> Result<T, MemoryEndpointsSyncError> {
    if json.is_empty() || json.len() > MAX_WIRE_JSON_BYTES {
        return Err(invalid(&format!(
            "{label} JSON is empty or exceeds 256 KiB"
        )));
    }
    serde_json::from_str(json).map_err(|error| invalid(&format!("invalid {label} JSON: {error}")))
}

fn validate_identifier(name: &str, value: &str) -> Result<(), MemoryEndpointsSyncError> {
    if value.is_empty()
        || value.len() > MAX_IDENTIFIER_CHARS
        || value.bytes().any(|byte| {
            !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':' | b'@'))
        })
    {
        return Err(invalid(&format!("{name} is missing or malformed")));
    }
    Ok(())
}

fn validate_public_text(
    name: &str,
    value: &str,
    max_chars: usize,
) -> Result<(), MemoryEndpointsSyncError> {
    if value.trim().is_empty()
        || value.chars().count() > max_chars
        || value
            .chars()
            .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
        || looks_like_secret(value)
    {
        return Err(invalid(&format!("{name} is not bounded public-safe text")));
    }
    Ok(())
}

fn validate_sha256(name: &str, value: &str) -> Result<(), MemoryEndpointsSyncError> {
    if value.len() != 64
        || value
            .bytes()
            .any(|byte| !byte.is_ascii_hexdigit() || byte.is_ascii_uppercase())
    {
        return Err(invalid(&format!("{name} is not lowercase SHA-256")));
    }
    Ok(())
}

fn validate_sha256_prefix(name: &str, value: &str) -> Result<(), MemoryEndpointsSyncError> {
    let hash = value
        .strip_prefix("sha256:")
        .ok_or_else(|| invalid(&format!("{name} is missing its sha256 prefix")))?;
    validate_sha256(name, hash)
}

fn validate_timestamp(name: &str, value: &str) -> Result<(), MemoryEndpointsSyncError> {
    if value.len() < 16 || value.len() > 64 || !value.contains('T') {
        return Err(invalid(&format!(
            "{name} is not a bounded ISO-8601 timestamp"
        )));
    }
    Ok(())
}

fn validate_redaction(
    values_redacted: bool,
    raw_credential_exposed: bool,
    raw_payload_exposed: bool,
) -> Result<(), MemoryEndpointsSyncError> {
    if !values_redacted || raw_credential_exposed || raw_payload_exposed {
        return Err(invalid("hosted response violates the redaction boundary"));
    }
    Ok(())
}

fn validate_protected_query(
    value: &str,
    expected_prefix: &str,
) -> Result<(), MemoryEndpointsSyncError> {
    if !value.starts_with(expected_prefix)
        || value.contains('#')
        || value.contains("..")
        || looks_like_secret(value)
    {
        return Err(invalid(
            "hosted readback URL is outside the protected sync contract",
        ));
    }
    Ok(())
}

fn looks_like_secret(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase();
    [
        "bearer ",
        "api_key",
        "apikey",
        "password=",
        "token=",
        "private key",
    ]
    .iter()
    .any(|marker| normalized.contains(marker))
}

fn is_supported_conflict_code(value: &str) -> bool {
    matches!(
        value,
        "parent_revision_mismatch" | "tombstone_resurrection_blocked" | "head_not_found"
    )
}

fn sha256_hex(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn invalid(message: &str) -> MemoryEndpointsSyncError {
    MemoryEndpointsSyncError::Invalid(message.to_string())
}
