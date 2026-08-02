use crate::sync::MemoryEndpointsSyncError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Stable revision-mutation schema kind.
pub const MEMORY_ENDPOINTS_REVISION_MUTATION_KIND: &str =
    "tinyrustlm.memory_endpoints.revision_mutation.v1";
/// Stable authoritative revision-head schema kind.
pub const MEMORY_ENDPOINTS_REVISION_HEAD_KIND: &str =
    "tinyrustlm.memory_endpoints.revision_head.v1";
/// Stable monotonic synchronization-checkpoint schema kind.
pub const MEMORY_ENDPOINTS_SYNC_CHECKPOINT_KIND: &str =
    "tinyrustlm.memory_endpoints.sync_checkpoint.v1";

const SEARCH_FRESHNESS_REPORT_KIND: &str = "tinyrustlm.memory_endpoints.search_freshness.v1";
const COMPACTION_PLAN_KIND: &str = "tinyrustlm.memory_endpoints.compaction_plan.v1";
const MAX_IDENTIFIER_CHARS: usize = 128;

/// Operation represented by one immutable revision mutation.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsRevisionOperation {
    /// Creates or updates an active memory revision.
    Upsert,
    /// Creates an authoritative soft-delete tombstone revision.
    Tombstone,
}

/// Requested erasure behavior for a revision mutation.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsEraseMode {
    /// The mutation is not a deletion.
    NotApplicable,
    /// Retain a tombstone for conflict prevention and audit.
    SoftDelete,
    /// Request irreversible erasure only when an explicit hosted capability exists.
    HardForgetRequested,
}

/// Authoritative state represented by a revision head.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsRevisionState {
    /// The memory head is active and retrievable.
    Active,
    /// The memory head is a deletion tombstone and cannot be resurrected implicitly.
    Tombstone,
}

/// Immutable candidate revision submitted by one device.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRevisionMutation {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stable logical memory identifier.
    pub memory_id: String,
    /// Candidate revision identifier generated once by the originating device.
    pub revision_id: String,
    /// Exact authoritative parent revision observed before the edit.
    pub parent_revision_id: Option<String>,
    /// SHA-256 of the exact public-safe revision body.
    pub body_sha256: String,
    /// SHA-256 of the normalized semantic body used only for exact deduplication.
    pub normalized_body_sha256: String,
    /// Immutable originating device identifier.
    pub device_id: String,
    /// Device authority epoch bound when the mutation was created.
    pub device_epoch: u64,
    /// Monotonic sequence assigned by the originating device.
    pub device_sequence: u64,
    /// Lamport time assigned by the originating device.
    pub lamport_time: u64,
    /// Upsert or tombstone operation.
    pub operation: MemoryEndpointsRevisionOperation,
    /// Erasure behavior requested by the operation.
    pub erase_mode: MemoryEndpointsEraseMode,
    /// Tombstone retention boundary in Unix milliseconds.
    pub retention_until_unix_ms: Option<u64>,
}

/// Current authoritative head of one logical memory.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRevisionHead {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stable logical memory identifier.
    pub memory_id: String,
    /// Current authoritative revision identifier.
    pub revision_id: String,
    /// Parent of the current revision, if one exists.
    pub parent_revision_id: Option<String>,
    /// SHA-256 of the exact accepted body.
    pub body_sha256: String,
    /// SHA-256 of the normalized semantic accepted body.
    pub normalized_body_sha256: String,
    /// Active or tombstone state.
    pub state: MemoryEndpointsRevisionState,
    /// Monotonic authoritative server sequence.
    pub server_sequence: u64,
    /// Device identifier whose mutation produced this head.
    pub accepted_device_id: String,
    /// Device epoch whose mutation produced this head.
    pub accepted_device_epoch: u64,
    /// Tombstone retention boundary, when the head is a tombstone.
    pub tombstone_retention_until_unix_ms: Option<u64>,
}

/// Current server-side authority state for one registered device.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsDeviceAuthority {
    /// Stable device identifier.
    pub device_id: String,
    /// Only this current epoch may submit queued mutations.
    pub current_epoch: u64,
    /// Whether all submissions from this device are revoked.
    pub revoked: bool,
}

/// Externally visible decision for a revision mutation.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsRevisionDecisionKind {
    /// Candidate became the new authoritative head.
    Accepted,
    /// Candidate was semantically byte-identical to the current head.
    Deduplicated,
    /// Candidate diverged from a stale or missing parent and requires explicit resolution.
    Conflict,
    /// Candidate attempted to update a tombstoned memory without an explicit resurrection flow.
    BlockedByTombstone,
    /// Candidate device was revoked, relabeled, or used a stale authority epoch.
    BlockedByRevocation,
    /// Hard forget was requested without an explicit hosted capability and retention contract.
    UnsupportedHardForget,
}

/// Deterministic revision decision and optional replacement head.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRevisionDecision {
    /// Decision category.
    pub kind: MemoryEndpointsRevisionDecisionKind,
    /// Logical memory identifier.
    pub memory_id: String,
    /// Candidate revision identifier.
    pub candidate_revision_id: String,
    /// Current authoritative revision identifier, if one existed.
    pub current_revision_id: Option<String>,
    /// Deterministic public conflict identifier for conflict decisions.
    pub conflict_id: Option<String>,
    /// Stable machine-readable reason code.
    pub reason_code: String,
    /// Replacement head, present only for an accepted decision.
    pub next_head: Option<MemoryEndpointsRevisionHead>,
}

/// Decides one revision mutation without silently overwriting concurrent prose.
pub fn decide_revision_mutation(
    current: Option<&MemoryEndpointsRevisionHead>,
    mutation: &MemoryEndpointsRevisionMutation,
    authority: &MemoryEndpointsDeviceAuthority,
    next_server_sequence: u64,
    hard_forget_supported: bool,
) -> Result<MemoryEndpointsRevisionDecision, MemoryEndpointsSyncError> {
    validate_mutation(mutation)?;
    validate_authority(authority)?;
    if let Some(head) = current {
        validate_head(head)?;
        if head.memory_id != mutation.memory_id {
            return Err(invalid("revision head and mutation memory IDs differ"));
        }
        if next_server_sequence <= head.server_sequence {
            return Err(invalid(
                "next server sequence must advance the current head",
            ));
        }
    } else if next_server_sequence == 0 {
        return Err(invalid("next server sequence must be greater than zero"));
    }

    if authority.device_id != mutation.device_id
        || authority.revoked
        || authority.current_epoch != mutation.device_epoch
    {
        return Ok(decision(
            current,
            mutation,
            MemoryEndpointsRevisionDecisionKind::BlockedByRevocation,
            "device_revoked_or_epoch_mismatch",
            None,
            None,
        ));
    }
    if mutation.erase_mode == MemoryEndpointsEraseMode::HardForgetRequested
        && !hard_forget_supported
    {
        return Ok(decision(
            current,
            mutation,
            MemoryEndpointsRevisionDecisionKind::UnsupportedHardForget,
            "hard_forget_capability_unavailable",
            None,
            None,
        ));
    }

    let Some(head) = current else {
        if mutation.parent_revision_id.is_some() {
            return Ok(conflict_decision(None, mutation, "parent_revision_missing"));
        }
        return Ok(accepted_decision(None, mutation, next_server_sequence));
    };

    if mutation.revision_id == head.revision_id {
        if mutation.body_sha256 == head.body_sha256
            && mutation.normalized_body_sha256 == head.normalized_body_sha256
            && operation_state(mutation.operation) == head.state
        {
            return Ok(decision(
                Some(head),
                mutation,
                MemoryEndpointsRevisionDecisionKind::Deduplicated,
                "revision_already_accepted",
                None,
                None,
            ));
        }
        return Ok(conflict_decision(
            Some(head),
            mutation,
            "revision_id_reused_with_changed_body",
        ));
    }

    if head.state == MemoryEndpointsRevisionState::Tombstone {
        if mutation.operation == MemoryEndpointsRevisionOperation::Tombstone
            && mutation.normalized_body_sha256 == head.normalized_body_sha256
        {
            return Ok(decision(
                Some(head),
                mutation,
                MemoryEndpointsRevisionDecisionKind::Deduplicated,
                "tombstone_already_current",
                None,
                None,
            ));
        }
        return Ok(decision(
            Some(head),
            mutation,
            MemoryEndpointsRevisionDecisionKind::BlockedByTombstone,
            "stale_edit_cannot_resurrect_tombstone",
            None,
            None,
        ));
    }

    if mutation.normalized_body_sha256 == head.normalized_body_sha256 {
        return Ok(decision(
            Some(head),
            mutation,
            MemoryEndpointsRevisionDecisionKind::Deduplicated,
            "normalized_body_already_current",
            None,
            None,
        ));
    }
    if mutation.parent_revision_id.as_deref() != Some(head.revision_id.as_str()) {
        return Ok(conflict_decision(
            Some(head),
            mutation,
            "stale_parent_diverged",
        ));
    }

    Ok(accepted_decision(
        Some(head),
        mutation,
        next_server_sequence,
    ))
}

fn accepted_decision(
    current: Option<&MemoryEndpointsRevisionHead>,
    mutation: &MemoryEndpointsRevisionMutation,
    server_sequence: u64,
) -> MemoryEndpointsRevisionDecision {
    let head = MemoryEndpointsRevisionHead {
        kind: MEMORY_ENDPOINTS_REVISION_HEAD_KIND.to_string(),
        version: 1,
        memory_id: mutation.memory_id.clone(),
        revision_id: mutation.revision_id.clone(),
        parent_revision_id: mutation.parent_revision_id.clone(),
        body_sha256: mutation.body_sha256.clone(),
        normalized_body_sha256: mutation.normalized_body_sha256.clone(),
        state: operation_state(mutation.operation),
        server_sequence,
        accepted_device_id: mutation.device_id.clone(),
        accepted_device_epoch: mutation.device_epoch,
        tombstone_retention_until_unix_ms: mutation.retention_until_unix_ms,
    };
    decision(
        current,
        mutation,
        MemoryEndpointsRevisionDecisionKind::Accepted,
        "accepted_exact_parent",
        None,
        Some(head),
    )
}

fn conflict_decision(
    current: Option<&MemoryEndpointsRevisionHead>,
    mutation: &MemoryEndpointsRevisionMutation,
    reason_code: &str,
) -> MemoryEndpointsRevisionDecision {
    let current_revision = current
        .map(|head| head.revision_id.as_str())
        .unwrap_or("missing");
    let material = format!(
        "{}\n{}\n{}\n{}",
        mutation.memory_id, current_revision, mutation.revision_id, mutation.normalized_body_sha256
    );
    let digest = Sha256::digest(material.as_bytes());
    let conflict_id = format!("conflict-{}", &hex_lower(&digest)[..24]);
    decision(
        current,
        mutation,
        MemoryEndpointsRevisionDecisionKind::Conflict,
        reason_code,
        Some(conflict_id),
        None,
    )
}

fn decision(
    current: Option<&MemoryEndpointsRevisionHead>,
    mutation: &MemoryEndpointsRevisionMutation,
    kind: MemoryEndpointsRevisionDecisionKind,
    reason_code: &str,
    conflict_id: Option<String>,
    next_head: Option<MemoryEndpointsRevisionHead>,
) -> MemoryEndpointsRevisionDecision {
    MemoryEndpointsRevisionDecision {
        kind,
        memory_id: mutation.memory_id.clone(),
        candidate_revision_id: mutation.revision_id.clone(),
        current_revision_id: current.map(|head| head.revision_id.clone()),
        conflict_id,
        reason_code: reason_code.to_string(),
        next_head,
    }
}

/// Monotonic local checkpoint for a complete or incremental hosted pull.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsSyncCheckpoint {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// MemoryEndpoints workspace identifier.
    pub workspace_id: String,
    /// Local pull completion time in Unix milliseconds.
    pub pulled_at_unix_ms: u64,
    /// Highest authoritative server sequence observed, when available.
    pub max_server_sequence: Option<u64>,
    /// Highest creation time observed when no server sequence is available.
    pub max_created_at_unix_ms: u64,
    /// Lexically highest event at the highest creation time.
    pub max_event_id: String,
    /// Number of records represented by the snapshot.
    pub record_count: u64,
    /// Whether the checkpoint represents a complete snapshot boundary.
    pub complete_snapshot: bool,
}

/// Validates that a synchronization checkpoint never moves backwards.
pub fn validate_checkpoint_advance(
    previous: Option<&MemoryEndpointsSyncCheckpoint>,
    candidate: &MemoryEndpointsSyncCheckpoint,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_checkpoint(candidate)?;
    let Some(previous) = previous else {
        return Ok(());
    };
    validate_checkpoint(previous)?;
    if previous.workspace_id != candidate.workspace_id {
        return Err(invalid("checkpoint workspace changed"));
    }
    if candidate.pulled_at_unix_ms < previous.pulled_at_unix_ms {
        return Err(invalid("checkpoint pull time moved backwards"));
    }
    match (previous.max_server_sequence, candidate.max_server_sequence) {
        (Some(_), None) => return Err(invalid("checkpoint dropped its server sequence")),
        (Some(left), Some(right)) if right < left => {
            return Err(invalid("checkpoint server sequence moved backwards"));
        }
        _ => {}
    }
    if candidate.max_server_sequence.is_none() && previous.max_server_sequence.is_none() {
        let backwards = candidate.max_created_at_unix_ms < previous.max_created_at_unix_ms
            || (candidate.max_created_at_unix_ms == previous.max_created_at_unix_ms
                && candidate.max_event_id < previous.max_event_id);
        if backwards {
            return Err(invalid("checkpoint event watermark moved backwards"));
        }
    }
    Ok(())
}

/// Search-index freshness relative to the latest accepted hosted receipt.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsSearchFreshness {
    /// Search has indexed the latest accepted sequence.
    Current,
    /// Search trails at least one accepted sequence.
    Stale,
    /// The hosted service did not expose enough sequence information.
    Unknown,
}

/// Public-safe stale-index report.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsStaleIndexReport {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Current, stale, or unknown freshness.
    pub freshness: MemoryEndpointsSearchFreshness,
    /// Latest accepted authoritative sequence, when known.
    pub accepted_server_sequence: Option<u64>,
    /// Latest indexed search sequence, when known.
    pub indexed_server_sequence: Option<u64>,
    /// Number of accepted sequences not yet indexed.
    pub sequence_lag: Option<u64>,
}

/// Reports search-index freshness without claiming currency when watermarks are absent.
pub fn report_search_freshness(
    accepted_server_sequence: Option<u64>,
    indexed_server_sequence: Option<u64>,
) -> Result<MemoryEndpointsStaleIndexReport, MemoryEndpointsSyncError> {
    let (freshness, lag) = match (accepted_server_sequence, indexed_server_sequence) {
        (Some(accepted), Some(indexed)) if accepted == 0 || indexed == 0 => {
            return Err(invalid(
                "search freshness sequences must be greater than zero",
            ));
        }
        (Some(accepted), Some(indexed)) if indexed > accepted => {
            return Err(invalid("search index sequence exceeds accepted sequence"));
        }
        (Some(accepted), Some(indexed)) if indexed < accepted => (
            MemoryEndpointsSearchFreshness::Stale,
            Some(accepted - indexed),
        ),
        (Some(_), Some(_)) => (MemoryEndpointsSearchFreshness::Current, Some(0)),
        _ => (MemoryEndpointsSearchFreshness::Unknown, None),
    };
    Ok(MemoryEndpointsStaleIndexReport {
        kind: SEARCH_FRESHNESS_REPORT_KIND.to_string(),
        version: 1,
        freshness,
        accepted_server_sequence,
        indexed_server_sequence,
        sequence_lag: lag,
    })
}

/// Record category considered by conservative synchronization compaction.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsRetentionKind {
    /// Current authoritative live head.
    LiveHead,
    /// Historical immutable revision.
    Revision,
    /// Explicit conflict object.
    Conflict,
    /// Authoritative deletion tombstone.
    Tombstone,
    /// Authoritative hosted receipt.
    AuthoritativeReceipt,
    /// Rebuildable search projection.
    SearchProjection,
}

/// Public-safe compaction input describing one retained synchronization record.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRetentionRecord {
    /// Stable record identifier.
    pub record_id: String,
    /// Logical memory identifier.
    pub memory_id: String,
    /// Retention category.
    pub kind: MemoryEndpointsRetentionKind,
    /// Whether this record is a current authoritative head.
    pub is_current_head: bool,
    /// Whether this conflict or review remains unresolved.
    pub unresolved: bool,
    /// Tombstone retention boundary in Unix milliseconds.
    pub retention_until_unix_ms: Option<u64>,
}

/// Deterministic conservative compaction plan.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsCompactionPlan {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Sorted record identifiers that must remain.
    pub retained_ids: Vec<String>,
    /// Sorted record identifiers safe to compact or rebuild.
    pub compacted_ids: Vec<String>,
}

/// Plans conservative compaction while retaining heads, open conflicts, tombstones, and receipts.
pub fn plan_sync_compaction(
    records: &[MemoryEndpointsRetentionRecord],
    now_unix_ms: u64,
) -> Result<MemoryEndpointsCompactionPlan, MemoryEndpointsSyncError> {
    if now_unix_ms == 0 {
        return Err(invalid("compaction time must be greater than zero"));
    }
    let mut seen = std::collections::BTreeSet::new();
    let mut retained_ids = Vec::new();
    let mut compacted_ids = Vec::new();
    for record in records {
        validate_identifier("record_id", &record.record_id)?;
        validate_identifier("memory_id", &record.memory_id)?;
        if !seen.insert(record.record_id.clone()) {
            return Err(invalid("compaction input contains duplicate record IDs"));
        }
        let retain = record.is_current_head
            || matches!(
                record.kind,
                MemoryEndpointsRetentionKind::LiveHead
                    | MemoryEndpointsRetentionKind::AuthoritativeReceipt
            )
            || record.kind == MemoryEndpointsRetentionKind::Conflict && record.unresolved
            || record.kind == MemoryEndpointsRetentionKind::Tombstone
                && record
                    .retention_until_unix_ms
                    .is_none_or(|retention| retention >= now_unix_ms);
        if retain {
            retained_ids.push(record.record_id.clone());
        } else {
            compacted_ids.push(record.record_id.clone());
        }
    }
    retained_ids.sort();
    compacted_ids.sort();
    Ok(MemoryEndpointsCompactionPlan {
        kind: COMPACTION_PLAN_KIND.to_string(),
        version: 1,
        retained_ids,
        compacted_ids,
    })
}

fn validate_mutation(
    mutation: &MemoryEndpointsRevisionMutation,
) -> Result<(), MemoryEndpointsSyncError> {
    if mutation.kind != MEMORY_ENDPOINTS_REVISION_MUTATION_KIND || mutation.version != 1 {
        return Err(invalid("unsupported revision mutation kind or version"));
    }
    validate_identifier("memory_id", &mutation.memory_id)?;
    validate_identifier("revision_id", &mutation.revision_id)?;
    if let Some(parent) = mutation.parent_revision_id.as_deref() {
        validate_identifier("parent_revision_id", parent)?;
    }
    validate_sha256("body_sha256", &mutation.body_sha256)?;
    validate_sha256("normalized_body_sha256", &mutation.normalized_body_sha256)?;
    validate_identifier("device_id", &mutation.device_id)?;
    if mutation.device_epoch == 0 || mutation.device_sequence == 0 || mutation.lamport_time == 0 {
        return Err(invalid(
            "device epoch, sequence, and Lamport time must be positive",
        ));
    }
    match mutation.operation {
        MemoryEndpointsRevisionOperation::Upsert => {
            if mutation.erase_mode != MemoryEndpointsEraseMode::NotApplicable
                || mutation.retention_until_unix_ms.is_some()
            {
                return Err(invalid("upsert cannot carry deletion retention metadata"));
            }
        }
        MemoryEndpointsRevisionOperation::Tombstone => {
            if mutation.erase_mode == MemoryEndpointsEraseMode::NotApplicable
                || mutation
                    .retention_until_unix_ms
                    .is_none_or(|value| value == 0)
            {
                return Err(invalid(
                    "tombstone requires erase mode and retention boundary",
                ));
            }
        }
    }
    Ok(())
}

fn validate_head(head: &MemoryEndpointsRevisionHead) -> Result<(), MemoryEndpointsSyncError> {
    if head.kind != MEMORY_ENDPOINTS_REVISION_HEAD_KIND || head.version != 1 {
        return Err(invalid("unsupported revision head kind or version"));
    }
    validate_identifier("memory_id", &head.memory_id)?;
    validate_identifier("revision_id", &head.revision_id)?;
    if let Some(parent) = head.parent_revision_id.as_deref() {
        validate_identifier("parent_revision_id", parent)?;
    }
    validate_sha256("body_sha256", &head.body_sha256)?;
    validate_sha256("normalized_body_sha256", &head.normalized_body_sha256)?;
    validate_identifier("accepted_device_id", &head.accepted_device_id)?;
    if head.server_sequence == 0 || head.accepted_device_epoch == 0 {
        return Err(invalid(
            "revision head sequence and device epoch must be positive",
        ));
    }
    if (head.state == MemoryEndpointsRevisionState::Tombstone)
        != head.tombstone_retention_until_unix_ms.is_some()
    {
        return Err(invalid(
            "revision head tombstone retention metadata is inconsistent",
        ));
    }
    Ok(())
}

fn validate_authority(
    authority: &MemoryEndpointsDeviceAuthority,
) -> Result<(), MemoryEndpointsSyncError> {
    validate_identifier("authority.device_id", &authority.device_id)?;
    if authority.current_epoch == 0 {
        return Err(invalid("device authority epoch must be positive"));
    }
    Ok(())
}

fn validate_checkpoint(
    checkpoint: &MemoryEndpointsSyncCheckpoint,
) -> Result<(), MemoryEndpointsSyncError> {
    if checkpoint.kind != MEMORY_ENDPOINTS_SYNC_CHECKPOINT_KIND || checkpoint.version != 1 {
        return Err(invalid("unsupported checkpoint kind or version"));
    }
    validate_identifier("checkpoint.workspace_id", &checkpoint.workspace_id)?;
    if checkpoint.pulled_at_unix_ms == 0 || !checkpoint.complete_snapshot {
        return Err(invalid("checkpoint time or snapshot boundary is invalid"));
    }
    if checkpoint.max_server_sequence == Some(0) {
        return Err(invalid("checkpoint server sequence must be positive"));
    }
    if (checkpoint.max_created_at_unix_ms == 0) != checkpoint.max_event_id.is_empty() {
        return Err(invalid("checkpoint event watermark is incomplete"));
    }
    if !checkpoint.max_event_id.is_empty() {
        validate_identifier("checkpoint.max_event_id", &checkpoint.max_event_id)?;
    }
    Ok(())
}

fn operation_state(operation: MemoryEndpointsRevisionOperation) -> MemoryEndpointsRevisionState {
    match operation {
        MemoryEndpointsRevisionOperation::Upsert => MemoryEndpointsRevisionState::Active,
        MemoryEndpointsRevisionOperation::Tombstone => MemoryEndpointsRevisionState::Tombstone,
    }
}

fn validate_identifier(label: &str, value: &str) -> Result<(), MemoryEndpointsSyncError> {
    if value.is_empty()
        || value.len() > MAX_IDENTIFIER_CHARS
        || value
            .bytes()
            .any(|byte| !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.')))
    {
        return Err(invalid(&format!(
            "{label} is missing or contains unsupported characters"
        )));
    }
    Ok(())
}

fn validate_sha256(label: &str, value: &str) -> Result<(), MemoryEndpointsSyncError> {
    if value.len() != 64
        || value
            .bytes()
            .any(|byte| !(byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)))
    {
        return Err(invalid(&format!(
            "{label} must be 64 lowercase hex characters"
        )));
    }
    Ok(())
}

fn invalid(message: &str) -> MemoryEndpointsSyncError {
    MemoryEndpointsSyncError::Invalid(message.to_string())
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}
