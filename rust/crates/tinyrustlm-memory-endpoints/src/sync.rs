use super::{
    contains_likely_secret, is_sha256_hex, validate_memory_record, MemoryEndpointsMemoryRecord,
    MemoryEndpointsScope, MemoryEndpointsSubmitPayload, MEMORY_ENDPOINTS_MEMORY_RECORD_KIND,
    MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE, MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt::{Display, Formatter};

/// Stable persisted outbox-entry schema kind.
pub const MEMORY_ENDPOINTS_OUTBOX_ENTRY_KIND: &str = "tinyrustlm.memory_endpoints.outbox_entry.v2";
/// Stable local-commit receipt schema kind.
pub const MEMORY_ENDPOINTS_LOCAL_RECEIPT_KIND: &str =
    "tinyrustlm.memory_endpoints.local_receipt.v2";
/// Stable authoritative hosted receipt schema kind.
pub const MEMORY_ENDPOINTS_AUTHORITATIVE_RECEIPT_KIND: &str =
    "tinyrustlm.memory_endpoints.authoritative_receipt.v1";

const PAYLOAD_DIGEST_DOMAIN: &str = "tinyrustlm.memory_endpoints.submit_payload.digest.v2";
const MAX_EVENT_ID_CHARS: usize = 64;
const MAX_DEVICE_ID_CHARS: usize = 96;
const MAX_REMOTE_ID_CHARS: usize = 128;
const MAX_ERROR_CODE_CHARS: usize = 96;

/// Durable state of one logical hosted-memory mutation.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsOutboxState {
    /// The public-safe operation and local receipt committed to durable local storage.
    SavedLocally,
    /// The operation is eligible for the next synchronization attempt.
    Queued,
    /// One synchronization leader currently owns the network attempt.
    Sending,
    /// A bounded retry is pending with the original body and idempotency key.
    RetryPending,
    /// A matching authoritative hosted receipt was verified and retained.
    Synchronized,
    /// Validation failed and the operation must never be sent automatically.
    Quarantined,
}

impl Display for MemoryEndpointsOutboxState {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            Self::SavedLocally => "saved_locally",
            Self::Queued => "queued",
            Self::Sending => "sending",
            Self::RetryPending => "retry_pending",
            Self::Synchronized => "synchronized",
            Self::Quarantined => "quarantined",
        };
        formatter.write_str(value)
    }
}

/// Public-safe retry metadata retained with a local outbox entry.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsRetryState {
    /// Number of network attempts begun for this logical operation.
    pub attempt_count: u32,
    /// Time at which the most recent attempt began, if any.
    pub last_attempt_at_unix_ms: Option<u64>,
    /// Earliest time at which a retry may begin, if one is scheduled.
    pub next_attempt_at_unix_ms: Option<u64>,
    /// Public-safe machine-readable failure category from the most recent attempt.
    pub last_error_code: Option<String>,
}

/// Receipt proving that one public-safe mutation committed to local durable storage.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsLocalReceipt {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stable logical event identifier.
    pub event_id: String,
    /// SHA-256 of the normalized semantic submit payload.
    pub payload_sha256: String,
    /// Non-secret local device identifier that authored the event.
    pub device_id: String,
    /// Local durable-commit time in Unix milliseconds.
    pub committed_at_unix_ms: u64,
}

/// Public-safe receipt proving acceptance by the authoritative hosted service.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsAuthoritativeReceipt {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stable logical event identifier supplied by the client.
    pub event_id: String,
    /// Original idempotency key supplied with every attempt.
    pub idempotency_key: String,
    /// SHA-256 of the exact normalized semantic payload accepted by the service.
    pub payload_sha256: String,
    /// Canonical hosted memory-event identifier returned by MemoryEndpoints.
    pub memory_event_id: String,
    /// Optional canonical hosted receipt identifier.
    pub receipt_id: Option<String>,
    /// Whether the authoritative response explicitly proves persistence.
    pub persisted: bool,
    /// Hosted acceptance time in Unix milliseconds.
    pub accepted_at_unix_ms: u64,
    /// Optional accepted revision identifier when revision support is available.
    pub revision_id: Option<String>,
    /// Optional monotonic hosted sequence when incremental synchronization is available.
    pub server_sequence: Option<u64>,
}

/// Credential-free durable representation of one hosted-memory mutation.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MemoryEndpointsOutboxEntry {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Stable logical event identifier generated once before local commit.
    pub event_id: String,
    /// Non-secret local device identifier that authored the event.
    pub device_id: String,
    /// Stable idempotency key reused by every retry.
    pub idempotency_key: String,
    /// SHA-256 of the normalized semantic submit payload.
    pub payload_sha256: String,
    /// Public-safe MemoryEndpoints submit payload. Credentials are never part of this type.
    pub payload: MemoryEndpointsSubmitPayload,
    /// TinyRustLM short-term or long-term tier.
    pub scope: MemoryEndpointsScope,
    /// Current durable synchronization state.
    pub state: MemoryEndpointsOutboxState,
    /// Retry metadata for bounded network replay.
    pub retry: MemoryEndpointsRetryState,
    /// Receipt proving local durable commit.
    pub local_receipt: MemoryEndpointsLocalReceipt,
    /// Verified authoritative hosted receipt, present only after synchronization.
    pub authoritative_receipt: Option<MemoryEndpointsAuthoritativeReceipt>,
    /// Public-safe machine-readable quarantine reason, present only when quarantined.
    pub quarantine_reason: Option<String>,
    /// Entry creation time in Unix milliseconds.
    pub created_at_unix_ms: u64,
    /// Most recent durable state transition time in Unix milliseconds.
    pub updated_at_unix_ms: u64,
}

impl MemoryEndpointsOutboxEntry {
    /// Marks a locally committed operation eligible for synchronization.
    pub fn mark_queued(&mut self, now_unix_ms: u64) -> Result<(), MemoryEndpointsSyncError> {
        validate_outbox_entry(self)?;
        if self.state != MemoryEndpointsOutboxState::SavedLocally {
            return Err(MemoryEndpointsSyncError::InvalidTransition {
                from: self.state,
                action: "mark_queued",
            });
        }
        require_monotonic_time(self.updated_at_unix_ms, now_unix_ms)?;
        self.state = MemoryEndpointsOutboxState::Queued;
        self.updated_at_unix_ms = now_unix_ms;
        Ok(())
    }

    /// Begins one network attempt without changing event identity or payload bytes.
    pub fn begin_send(&mut self, now_unix_ms: u64) -> Result<(), MemoryEndpointsSyncError> {
        validate_outbox_entry(self)?;
        if !self.is_sendable(now_unix_ms) {
            return Err(MemoryEndpointsSyncError::InvalidTransition {
                from: self.state,
                action: "begin_send",
            });
        }
        require_monotonic_time(self.updated_at_unix_ms, now_unix_ms)?;
        self.retry.attempt_count = self.retry.attempt_count.checked_add(1).ok_or_else(|| {
            MemoryEndpointsSyncError::Invalid("attempt count overflow".to_string())
        })?;
        self.retry.last_attempt_at_unix_ms = Some(now_unix_ms);
        self.retry.next_attempt_at_unix_ms = None;
        self.retry.last_error_code = None;
        self.state = MemoryEndpointsOutboxState::Sending;
        self.updated_at_unix_ms = now_unix_ms;
        Ok(())
    }

    /// Schedules a bounded retry while preserving the original key and payload fingerprint.
    pub fn schedule_retry(
        &mut self,
        error_code: &str,
        next_attempt_at_unix_ms: u64,
        now_unix_ms: u64,
    ) -> Result<(), MemoryEndpointsSyncError> {
        validate_outbox_entry(self)?;
        if self.state != MemoryEndpointsOutboxState::Sending {
            return Err(MemoryEndpointsSyncError::InvalidTransition {
                from: self.state,
                action: "schedule_retry",
            });
        }
        validate_identifier("error_code", error_code, MAX_ERROR_CODE_CHARS)?;
        require_monotonic_time(self.updated_at_unix_ms, now_unix_ms)?;
        if next_attempt_at_unix_ms < now_unix_ms {
            return Err(MemoryEndpointsSyncError::Invalid(
                "next retry time must not precede the transition time".to_string(),
            ));
        }
        self.retry.next_attempt_at_unix_ms = Some(next_attempt_at_unix_ms);
        self.retry.last_error_code = Some(error_code.to_string());
        self.state = MemoryEndpointsOutboxState::RetryPending;
        self.updated_at_unix_ms = now_unix_ms;
        Ok(())
    }

    /// Applies a matching authoritative receipt and marks the operation synchronized.
    pub fn apply_authoritative_receipt(
        &mut self,
        receipt: MemoryEndpointsAuthoritativeReceipt,
        now_unix_ms: u64,
    ) -> Result<(), MemoryEndpointsSyncError> {
        validate_outbox_entry(self)?;
        if !matches!(
            self.state,
            MemoryEndpointsOutboxState::Queued
                | MemoryEndpointsOutboxState::Sending
                | MemoryEndpointsOutboxState::RetryPending
        ) {
            return Err(MemoryEndpointsSyncError::InvalidTransition {
                from: self.state,
                action: "apply_authoritative_receipt",
            });
        }
        validate_authoritative_receipt(self, &receipt)?;
        require_monotonic_time(self.updated_at_unix_ms, now_unix_ms)?;
        if now_unix_ms < receipt.accepted_at_unix_ms {
            return Err(MemoryEndpointsSyncError::Invalid(
                "receipt acceptance time must not follow the local transition time".to_string(),
            ));
        }
        self.retry.next_attempt_at_unix_ms = None;
        self.retry.last_error_code = None;
        self.authoritative_receipt = Some(receipt);
        self.state = MemoryEndpointsOutboxState::Synchronized;
        self.updated_at_unix_ms = now_unix_ms;
        Ok(())
    }

    /// Quarantines a structurally valid entry so it cannot be sent automatically.
    pub fn quarantine(
        &mut self,
        reason_code: &str,
        now_unix_ms: u64,
    ) -> Result<(), MemoryEndpointsSyncError> {
        validate_outbox_entry(self)?;
        if self.state == MemoryEndpointsOutboxState::Synchronized {
            return Err(MemoryEndpointsSyncError::InvalidTransition {
                from: self.state,
                action: "quarantine",
            });
        }
        validate_identifier("quarantine reason", reason_code, MAX_ERROR_CODE_CHARS)?;
        require_monotonic_time(self.updated_at_unix_ms, now_unix_ms)?;
        self.state = MemoryEndpointsOutboxState::Quarantined;
        self.quarantine_reason = Some(reason_code.to_string());
        self.updated_at_unix_ms = now_unix_ms;
        Ok(())
    }

    /// Returns whether the entry may be sent at the supplied time.
    pub fn is_sendable(&self, now_unix_ms: u64) -> bool {
        match self.state {
            MemoryEndpointsOutboxState::Queued => true,
            MemoryEndpointsOutboxState::RetryPending => self
                .retry
                .next_attempt_at_unix_ms
                .is_some_and(|next| next <= now_unix_ms),
            _ => false,
        }
    }
}

/// Error returned by deterministic MemoryEndpoints synchronization helpers.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MemoryEndpointsSyncError {
    /// Persisted JSON was syntactically invalid or had an unsupported shape.
    InvalidJson(String),
    /// A persisted or newly prepared value violated the public synchronization contract.
    Invalid(String),
    /// A state transition was not legal from the current durable state.
    InvalidTransition {
        /// Durable state at the time of the rejected transition.
        from: MemoryEndpointsOutboxState,
        /// Stable public action name that was rejected.
        action: &'static str,
    },
}

impl Display for MemoryEndpointsSyncError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidJson(message) => write!(formatter, "invalid outbox JSON: {message}"),
            Self::Invalid(message) => write!(formatter, "invalid outbox entry: {message}"),
            Self::InvalidTransition { from, action } => {
                write!(formatter, "cannot {action} from {from}")
            }
        }
    }
}

impl std::error::Error for MemoryEndpointsSyncError {}

/// Creates a deterministic, credential-free outbox entry and local receipt.
pub fn prepare_outbox_entry(
    record: &MemoryEndpointsMemoryRecord,
    event_id: &str,
    device_id: &str,
    committed_at_unix_ms: u64,
) -> Result<MemoryEndpointsOutboxEntry, MemoryEndpointsSyncError> {
    let report = validate_memory_record(record);
    if !report.valid {
        return Err(MemoryEndpointsSyncError::Invalid(
            report.failures.join("; "),
        ));
    }
    validate_identifier("event_id", event_id, MAX_EVENT_ID_CHARS)?;
    validate_identifier("device_id", device_id, MAX_DEVICE_ID_CHARS)?;
    if committed_at_unix_ms == 0 {
        return Err(MemoryEndpointsSyncError::Invalid(
            "commit time must be greater than zero".to_string(),
        ));
    }

    let payload = normalize_payload(&record.to_submit_payload());
    validate_submit_payload(&payload)?;
    let payload_sha256 = memory_endpoints_payload_sha256(&payload)?;
    let idempotency_key = idempotency_key(event_id, &payload_sha256)?;
    let local_receipt = MemoryEndpointsLocalReceipt {
        kind: MEMORY_ENDPOINTS_LOCAL_RECEIPT_KIND.to_string(),
        version: 2,
        event_id: event_id.to_string(),
        payload_sha256: payload_sha256.clone(),
        device_id: device_id.to_string(),
        committed_at_unix_ms,
    };

    Ok(MemoryEndpointsOutboxEntry {
        kind: MEMORY_ENDPOINTS_OUTBOX_ENTRY_KIND.to_string(),
        version: 2,
        event_id: event_id.to_string(),
        device_id: device_id.to_string(),
        idempotency_key,
        payload_sha256,
        payload,
        scope: record.scope,
        state: MemoryEndpointsOutboxState::SavedLocally,
        retry: MemoryEndpointsRetryState::default(),
        local_receipt,
        authoritative_receipt: None,
        quarantine_reason: None,
        created_at_unix_ms: committed_at_unix_ms,
        updated_at_unix_ms: committed_at_unix_ms,
    })
}

/// Computes the cross-runtime SHA-256 for a normalized semantic submit payload.
pub fn memory_endpoints_payload_sha256(
    payload: &MemoryEndpointsSubmitPayload,
) -> Result<String, MemoryEndpointsSyncError> {
    validate_submit_payload(payload)?;
    if payload != &normalize_payload(payload) {
        return Err(MemoryEndpointsSyncError::Invalid(
            "payload collections must be sorted, trimmed, and deduplicated".to_string(),
        ));
    }

    let mut material = Vec::new();
    append_string(&mut material, "domain", PAYLOAD_DIGEST_DOMAIN);
    append_string(&mut material, "workspace_id", &payload.workspace_id);
    append_string(&mut material, "actor_agent_id", &payload.actor_agent_id);
    append_string(&mut material, "kind", &payload.kind);
    append_u64(&mut material, "version", u64::from(payload.version));
    append_string(&mut material, "scope", &payload.scope);
    append_string(&mut material, "scope_id", &payload.scope_id);
    append_string(&mut material, "memory_type", &payload.memory_type);
    append_string(&mut material, "subject", &payload.subject);
    append_string(&mut material, "title", &payload.title);
    append_string(&mut material, "summary", &payload.summary);
    append_string(&mut material, "source", &payload.source);
    append_u64(
        &mut material,
        "confidence_micros",
        confidence_micros(payload.confidence)?,
    );
    append_array(&mut material, "uai_references", &payload.uai_references);
    append_array(&mut material, "tags", &payload.tags);
    append_string(
        &mut material,
        "tinyrustlm_memory_tier",
        &payload.tinyrustlm_memory_tier,
    );
    append_optional_string(
        &mut material,
        "source_sha256",
        payload.source_sha256.as_deref(),
    );

    let digest = Sha256::digest(material);
    Ok(hex_lower(&digest))
}

/// Validates all structural, fingerprint, receipt, and state invariants of an outbox entry.
pub fn validate_outbox_entry(
    entry: &MemoryEndpointsOutboxEntry,
) -> Result<(), MemoryEndpointsSyncError> {
    if entry.kind != MEMORY_ENDPOINTS_OUTBOX_ENTRY_KIND || entry.version != 2 {
        return Err(MemoryEndpointsSyncError::Invalid(
            "unsupported outbox kind or version".to_string(),
        ));
    }
    validate_identifier("event_id", &entry.event_id, MAX_EVENT_ID_CHARS)?;
    validate_identifier("device_id", &entry.device_id, MAX_DEVICE_ID_CHARS)?;
    validate_submit_payload(&entry.payload)?;
    if entry.payload != normalize_payload(&entry.payload) {
        return Err(MemoryEndpointsSyncError::Invalid(
            "payload collections are not normalized".to_string(),
        ));
    }
    let actual_hash = memory_endpoints_payload_sha256(&entry.payload)?;
    if entry.payload_sha256 != actual_hash {
        return Err(MemoryEndpointsSyncError::Invalid(
            "payload fingerprint mismatch".to_string(),
        ));
    }
    if entry.idempotency_key != idempotency_key(&entry.event_id, &actual_hash)? {
        return Err(MemoryEndpointsSyncError::Invalid(
            "idempotency key does not match event and payload".to_string(),
        ));
    }
    let expected_scope = scope_for_tier(&entry.payload.tinyrustlm_memory_tier)?;
    if entry.scope != expected_scope {
        return Err(MemoryEndpointsSyncError::Invalid(
            "outbox scope does not match payload tier".to_string(),
        ));
    }
    validate_local_receipt(entry)?;
    if entry.created_at_unix_ms == 0 || entry.updated_at_unix_ms < entry.created_at_unix_ms {
        return Err(MemoryEndpointsSyncError::Invalid(
            "outbox timestamps are invalid".to_string(),
        ));
    }
    validate_retry_state(entry)?;

    match entry.state {
        MemoryEndpointsOutboxState::Synchronized => {
            let receipt = entry.authoritative_receipt.as_ref().ok_or_else(|| {
                MemoryEndpointsSyncError::Invalid(
                    "synchronized entry requires an authoritative receipt".to_string(),
                )
            })?;
            validate_authoritative_receipt(entry, receipt)?;
            if entry.quarantine_reason.is_some() {
                return Err(MemoryEndpointsSyncError::Invalid(
                    "synchronized entry cannot have a quarantine reason".to_string(),
                ));
            }
        }
        MemoryEndpointsOutboxState::Quarantined => {
            let reason = entry.quarantine_reason.as_deref().ok_or_else(|| {
                MemoryEndpointsSyncError::Invalid(
                    "quarantined entry requires a reason code".to_string(),
                )
            })?;
            validate_identifier("quarantine reason", reason, MAX_ERROR_CODE_CHARS)?;
            if entry.authoritative_receipt.is_some() {
                return Err(MemoryEndpointsSyncError::Invalid(
                    "quarantined entry cannot have an authoritative receipt".to_string(),
                ));
            }
        }
        _ => {
            if entry.authoritative_receipt.is_some() || entry.quarantine_reason.is_some() {
                return Err(MemoryEndpointsSyncError::Invalid(
                    "pending entry cannot contain terminal-state metadata".to_string(),
                ));
            }
        }
    }
    Ok(())
}

/// Validates an authoritative receipt against one immutable outbox operation.
pub fn validate_authoritative_receipt(
    entry: &MemoryEndpointsOutboxEntry,
    receipt: &MemoryEndpointsAuthoritativeReceipt,
) -> Result<(), MemoryEndpointsSyncError> {
    if receipt.kind != MEMORY_ENDPOINTS_AUTHORITATIVE_RECEIPT_KIND || receipt.version != 1 {
        return Err(MemoryEndpointsSyncError::Invalid(
            "unsupported authoritative receipt kind or version".to_string(),
        ));
    }
    if receipt.event_id != entry.event_id
        || receipt.idempotency_key != entry.idempotency_key
        || receipt.payload_sha256 != entry.payload_sha256
    {
        return Err(MemoryEndpointsSyncError::Invalid(
            "authoritative receipt does not match the local operation".to_string(),
        ));
    }
    if !receipt.persisted {
        return Err(MemoryEndpointsSyncError::Invalid(
            "authoritative receipt does not prove persistence".to_string(),
        ));
    }
    validate_identifier(
        "memory_event_id",
        &receipt.memory_event_id,
        MAX_REMOTE_ID_CHARS,
    )?;
    if let Some(receipt_id) = receipt.receipt_id.as_deref() {
        validate_identifier("receipt_id", receipt_id, MAX_REMOTE_ID_CHARS)?;
    }
    if let Some(revision_id) = receipt.revision_id.as_deref() {
        validate_identifier("revision_id", revision_id, MAX_REMOTE_ID_CHARS)?;
    }
    if receipt.accepted_at_unix_ms == 0 || receipt.server_sequence == Some(0) {
        return Err(MemoryEndpointsSyncError::Invalid(
            "authoritative receipt timestamp or sequence is invalid".to_string(),
        ));
    }
    Ok(())
}

/// Parses and validates one persisted outbox JSON document.
pub fn deserialize_outbox_entry_text(
    json: &str,
) -> Result<MemoryEndpointsOutboxEntry, MemoryEndpointsSyncError> {
    let entry: MemoryEndpointsOutboxEntry = serde_json::from_str(json)
        .map_err(|error| MemoryEndpointsSyncError::InvalidJson(error.to_string()))?;
    validate_outbox_entry(&entry)?;
    Ok(entry)
}

fn validate_submit_payload(
    payload: &MemoryEndpointsSubmitPayload,
) -> Result<(), MemoryEndpointsSyncError> {
    let tier = scope_for_tier(&payload.tinyrustlm_memory_tier)?;
    let record = MemoryEndpointsMemoryRecord {
        kind: payload.kind.clone(),
        version: payload.version,
        scope: tier,
        workspace_id: payload.workspace_id.clone(),
        agent_id: payload.actor_agent_id.clone(),
        title: payload.title.clone(),
        safe_summary: payload.summary.clone(),
        uai_references: payload.uai_references.clone(),
        tags: payload.tags.clone(),
        source_sha256: payload.source_sha256.clone(),
    };
    let report = validate_memory_record(&record);
    if !report.valid {
        return Err(MemoryEndpointsSyncError::Invalid(
            report.failures.join("; "),
        ));
    }
    if payload.kind != MEMORY_ENDPOINTS_MEMORY_RECORD_KIND
        || payload.scope != MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE
        || payload.scope_id != MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID
        || payload.memory_type != tier.memory_type()
        || payload.subject != payload.title
    {
        return Err(MemoryEndpointsSyncError::Invalid(
            "submit payload contract fields are inconsistent".to_string(),
        ));
    }
    if payload.source.trim().is_empty()
        || contains_likely_secret(&payload.title)
        || contains_likely_secret(&payload.source)
        || payload.tags.iter().any(|tag| contains_likely_secret(tag))
    {
        return Err(MemoryEndpointsSyncError::Invalid(
            "submit payload contains unsafe public text".to_string(),
        ));
    }
    confidence_micros(payload.confidence)?;
    Ok(())
}

fn validate_local_receipt(
    entry: &MemoryEndpointsOutboxEntry,
) -> Result<(), MemoryEndpointsSyncError> {
    let receipt = &entry.local_receipt;
    if receipt.kind != MEMORY_ENDPOINTS_LOCAL_RECEIPT_KIND
        || receipt.version != 2
        || receipt.event_id != entry.event_id
        || receipt.payload_sha256 != entry.payload_sha256
        || receipt.device_id != entry.device_id
        || receipt.committed_at_unix_ms != entry.created_at_unix_ms
    {
        return Err(MemoryEndpointsSyncError::Invalid(
            "local receipt does not match the outbox operation".to_string(),
        ));
    }
    Ok(())
}

fn validate_retry_state(
    entry: &MemoryEndpointsOutboxEntry,
) -> Result<(), MemoryEndpointsSyncError> {
    if let Some(code) = entry.retry.last_error_code.as_deref() {
        validate_identifier("last_error_code", code, MAX_ERROR_CODE_CHARS)?;
    }
    match entry.state {
        MemoryEndpointsOutboxState::SavedLocally | MemoryEndpointsOutboxState::Queued => {
            if entry.retry.attempt_count == 0
                && (entry.retry.last_attempt_at_unix_ms.is_some()
                    || entry.retry.next_attempt_at_unix_ms.is_some()
                    || entry.retry.last_error_code.is_some())
            {
                return Err(MemoryEndpointsSyncError::Invalid(
                    "unattempted entry contains retry metadata".to_string(),
                ));
            }
        }
        MemoryEndpointsOutboxState::Sending => {
            if entry.retry.attempt_count == 0
                || entry.retry.last_attempt_at_unix_ms.is_none()
                || entry.retry.next_attempt_at_unix_ms.is_some()
                || entry.retry.last_error_code.is_some()
            {
                return Err(MemoryEndpointsSyncError::Invalid(
                    "sending entry has inconsistent retry metadata".to_string(),
                ));
            }
        }
        MemoryEndpointsOutboxState::RetryPending => {
            if entry.retry.attempt_count == 0
                || entry.retry.last_attempt_at_unix_ms.is_none()
                || entry.retry.next_attempt_at_unix_ms.is_none()
                || entry.retry.last_error_code.is_none()
            {
                return Err(MemoryEndpointsSyncError::Invalid(
                    "retry-pending entry has incomplete retry metadata".to_string(),
                ));
            }
        }
        MemoryEndpointsOutboxState::Synchronized | MemoryEndpointsOutboxState::Quarantined => {}
    }
    Ok(())
}

fn normalize_payload(payload: &MemoryEndpointsSubmitPayload) -> MemoryEndpointsSubmitPayload {
    let mut normalized = payload.clone();
    normalized.uai_references = normalize_set(&payload.uai_references);
    normalized.tags = normalize_set(&payload.tags);
    normalized
}

fn normalize_set(values: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = values
        .iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn scope_for_tier(value: &str) -> Result<MemoryEndpointsScope, MemoryEndpointsSyncError> {
    match value {
        "short_term" => Ok(MemoryEndpointsScope::ShortTerm),
        "long_term" => Ok(MemoryEndpointsScope::LongTerm),
        _ => Err(MemoryEndpointsSyncError::Invalid(
            "memory tier must be short_term or long_term".to_string(),
        )),
    }
}

fn idempotency_key(
    event_id: &str,
    payload_sha256: &str,
) -> Result<String, MemoryEndpointsSyncError> {
    validate_identifier("event_id", event_id, MAX_EVENT_ID_CHARS)?;
    if !is_sha256_hex(payload_sha256) {
        return Err(MemoryEndpointsSyncError::Invalid(
            "payload fingerprint must be 64 lowercase hex characters".to_string(),
        ));
    }
    Ok(format!(
        "tinyrustlm-memory-v2-{event_id}-{}",
        &payload_sha256[..24]
    ))
}

fn confidence_micros(value: f32) -> Result<u64, MemoryEndpointsSyncError> {
    if !value.is_finite() || !(0.0..=1.0).contains(&value) {
        return Err(MemoryEndpointsSyncError::Invalid(
            "confidence must be finite and between zero and one".to_string(),
        ));
    }
    Ok((f64::from(value) * 1_000_000.0).round() as u64)
}

fn append_string(output: &mut Vec<u8>, name: &str, value: &str) {
    output.extend_from_slice(name.as_bytes());
    output.push(b':');
    output.extend_from_slice(value.len().to_string().as_bytes());
    output.push(b':');
    output.extend_from_slice(value.as_bytes());
    output.push(b'\n');
}

fn append_u64(output: &mut Vec<u8>, name: &str, value: u64) {
    append_string(output, name, &value.to_string());
}

fn append_array(output: &mut Vec<u8>, name: &str, values: &[String]) {
    append_u64(output, &format!("{name}_count"), values.len() as u64);
    for value in values {
        append_string(output, name, value);
    }
}

fn append_optional_string(output: &mut Vec<u8>, name: &str, value: Option<&str>) {
    match value {
        Some(value) => {
            append_u64(output, &format!("{name}_present"), 1);
            append_string(output, name, value);
        }
        None => append_u64(output, &format!("{name}_present"), 0),
    }
}

fn validate_identifier(
    label: &str,
    value: &str,
    max_chars: usize,
) -> Result<(), MemoryEndpointsSyncError> {
    if value.is_empty()
        || value.len() > max_chars
        || value
            .bytes()
            .any(|byte| !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.')))
    {
        return Err(MemoryEndpointsSyncError::Invalid(format!(
            "{label} is missing or contains unsupported characters"
        )));
    }
    Ok(())
}

fn require_monotonic_time(previous: u64, candidate: u64) -> Result<(), MemoryEndpointsSyncError> {
    if candidate < previous {
        return Err(MemoryEndpointsSyncError::Invalid(
            "state transition time moved backwards".to_string(),
        ));
    }
    Ok(())
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
