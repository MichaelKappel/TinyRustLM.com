#![forbid(unsafe_code)]
#![doc = "Optional MemoryEndpoints.com connector contract for TinyRustLM memory sync."]

use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

mod distributed;
mod protocol;
mod retrieval;
mod sync;
mod transport;

pub use retrieval::{
    pack_memory_context, MemoryEndpointsCandidateSource, MemoryEndpointsContextBudget,
    MemoryEndpointsContextExclusion, MemoryEndpointsModelCapacityClass,
    MemoryEndpointsPackedContext, MemoryEndpointsPackedSelection,
    MemoryEndpointsRetrievalCandidate, MemoryEndpointsRetrievalPolicy,
    MemoryEndpointsRetrievalReceipt, MemoryEndpointsRetrievalStatus, MemoryEndpointsRetrievalTier,
};

pub use distributed::{
    decide_revision_mutation, plan_sync_compaction, report_search_freshness,
    validate_checkpoint_advance, MemoryEndpointsCompactionPlan, MemoryEndpointsDeviceAuthority,
    MemoryEndpointsEraseMode, MemoryEndpointsRetentionKind, MemoryEndpointsRetentionRecord,
    MemoryEndpointsRevisionDecision, MemoryEndpointsRevisionDecisionKind,
    MemoryEndpointsRevisionHead, MemoryEndpointsRevisionMutation, MemoryEndpointsRevisionOperation,
    MemoryEndpointsRevisionState, MemoryEndpointsSearchFreshness, MemoryEndpointsStaleIndexReport,
    MemoryEndpointsSyncCheckpoint, MEMORY_ENDPOINTS_REVISION_HEAD_KIND,
    MEMORY_ENDPOINTS_REVISION_MUTATION_KIND, MEMORY_ENDPOINTS_SYNC_CHECKPOINT_KIND,
};

pub use protocol::{
    parse_distributed_sync_capabilities, validate_distributed_sync_capabilities,
    MemoryEndpointsDistributedSyncCapabilities, MemoryEndpointsDistributedSyncCheckpointContract,
    MemoryEndpointsDistributedSyncDeviceContract, MemoryEndpointsDistributedSyncMutationContract,
    MemoryEndpointsDistributedSyncRetention, MemoryEndpointsDistributedSyncRoutes,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_CAPABILITIES_KIND,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_PULL_PAGE_SIZE,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_MAX_SUMMARY_CHARS,
    MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_PROTOCOL,
};

pub use sync::{
    deserialize_outbox_entry_text, memory_endpoints_payload_sha256, prepare_outbox_entry,
    validate_authoritative_receipt, validate_outbox_entry, MemoryEndpointsAuthoritativeReceipt,
    MemoryEndpointsLocalReceipt, MemoryEndpointsOutboxEntry, MemoryEndpointsOutboxState,
    MemoryEndpointsRetryState, MemoryEndpointsSyncError,
    MEMORY_ENDPOINTS_AUTHORITATIVE_RECEIPT_KIND, MEMORY_ENDPOINTS_LOCAL_RECEIPT_KIND,
    MEMORY_ENDPOINTS_OUTBOX_ENTRY_KIND,
};

pub use transport::{
    canonicalize_hosted_revision_mutation, hosted_revision_mutation_body_hash,
    hosted_revision_mutation_fingerprint, parse_change_page, parse_device_authority_response,
    parse_read_heads_response, parse_receipt_lookup_response, parse_retention_policy_response,
    parse_revision_decision_response, serialize_hosted_revision_mutation, validate_change_page,
    validate_device_authority_response, validate_distributed_sync_idempotency_key,
    validate_hosted_revision_mutation, validate_read_heads_response,
    validate_receipt_lookup_request, validate_reconciliation_receipt,
    validate_register_device_request, validate_retention_policy_response,
    validate_revision_decision_response, validate_revoke_device_request,
    validate_rotate_device_request, MemoryEndpointsChangePage, MemoryEndpointsChangePageResponse,
    MemoryEndpointsDeviceAuthorityResponse, MemoryEndpointsDeviceOperatorSummary,
    MemoryEndpointsHeadsFilters, MemoryEndpointsHostedCheckpoint,
    MemoryEndpointsHostedDeviceAuthority, MemoryEndpointsHostedDeviceStatus,
    MemoryEndpointsHostedHeadStatus, MemoryEndpointsHostedRevision,
    MemoryEndpointsHostedRevisionHead, MemoryEndpointsHostedRevisionMutation,
    MemoryEndpointsHostedSyncOperation, MemoryEndpointsHostedSyncStatus,
    MemoryEndpointsMutationConfirmation, MemoryEndpointsMutationOperatorSummary,
    MemoryEndpointsReadHeadsResponse, MemoryEndpointsReceiptLookupRequest,
    MemoryEndpointsReceiptLookupResponse, MemoryEndpointsReconciliationReceipt,
    MemoryEndpointsRegisterDeviceRequest, MemoryEndpointsRetentionPolicy,
    MemoryEndpointsRetentionPolicyResponse, MemoryEndpointsRevisionDecisionResponse,
    MemoryEndpointsRevokeDeviceRequest, MemoryEndpointsRotateDeviceRequest,
};

/// Stable connector policy schema kind.
pub const MEMORY_ENDPOINTS_CONNECTOR_POLICY_KIND: &str =
    "tinyrustlm.memory_endpoints.connector_policy.v0";
/// Stable memory record schema kind.
pub const MEMORY_ENDPOINTS_MEMORY_RECORD_KIND: &str =
    "tinyrustlm.memory_endpoints.memory_record.v0";
/// Stable validation report schema kind.
pub const MEMORY_ENDPOINTS_VALIDATION_KIND: &str = "tinyrustlm.memory_endpoints.validation.v0";
/// Public-safe source label shared by Rust, .NET, and browser connector payloads.
pub const MEMORY_ENDPOINTS_CONNECTOR_SOURCE: &str = "TinyRustLM MemoryEndpoints connector";
/// Public MemoryEndpoints scope used for TinyRustLM project memory events.
pub const MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE: &str = "project";
/// Stable scope id used for TinyRustLM.com project memory events.
pub const MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID: &str = "tinyrustlm.com";

const MAX_SAFE_SUMMARY_CHARS: usize = 16 * 1024;
const MAX_TITLE_CHARS: usize = 160;
const MAX_AGENT_ID_CHARS: usize = 96;
const MAX_WORKSPACE_ID_CHARS: usize = 128;
const MAX_REFERENCE_COUNT: usize = 128;
const MAX_TAG_COUNT: usize = 32;

/// Memory tier selected for a MemoryEndpoints record.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsScope {
    /// Active working memory intended for short-term coordination.
    ShortTerm,
    /// Durable pointer-backed memory intended for long-term recall.
    LongTerm,
}

/// Workspace-key header mode for protected MemoryEndpoints routes.
#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEndpointsAuthHeaderMode {
    /// Send the workspace key as `Authorization: Bearer <WORKSPACE_KEY>`.
    #[default]
    AuthorizationBearer,
    /// Send the workspace key as `X-MemoryEndpoints-Key: <WORKSPACE_KEY>`.
    XMemoryEndpointsKey,
}

impl Display for MemoryEndpointsScope {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ShortTerm => write!(formatter, "short_term"),
            Self::LongTerm => write!(formatter, "long_term"),
        }
    }
}

impl MemoryEndpointsScope {
    /// Returns the public MemoryEndpoints `memoryType`/`memory_type` filter for this TinyRustLM tier.
    pub fn memory_type(&self) -> &'static str {
        match self {
            Self::ShortTerm => "status",
            Self::LongTerm => "handoff",
        }
    }
}

/// User-controlled policy for enabling hosted memory sync.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MemoryEndpointsConnectorPolicy {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Whether network sync is explicitly enabled by the user.
    pub enabled: bool,
    /// Configured MemoryEndpoints base URL. Secrets must not be embedded here.
    pub base_url: String,
    /// MemoryEndpoints workspace id.
    pub workspace_id: String,
    /// TinyRustLM agent id for this connector.
    pub agent_id: String,
    /// Header mode used when applying the workspace key to protected routes.
    #[serde(default)]
    pub auth_header_mode: MemoryEndpointsAuthHeaderMode,
    /// Whether short-term memory writes are allowed.
    pub allow_short_term: bool,
    /// Whether long-term memory writes are allowed.
    pub allow_long_term: bool,
    /// Human-readable secret source label such as environment, keychain, or local profile.
    pub secret_source: String,
}

impl MemoryEndpointsConnectorPolicy {
    /// Creates a disabled policy with no hosted sync.
    pub fn disabled() -> Self {
        Self {
            kind: MEMORY_ENDPOINTS_CONNECTOR_POLICY_KIND.to_string(),
            version: 1,
            enabled: false,
            base_url: String::new(),
            workspace_id: String::new(),
            agent_id: "tinyrustlm-agent".to_string(),
            auth_header_mode: MemoryEndpointsAuthHeaderMode::AuthorizationBearer,
            allow_short_term: false,
            allow_long_term: false,
            secret_source: "not-configured".to_string(),
        }
    }
}

/// Public-safe memory record sent to MemoryEndpoints by TinyRustLM Agent.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MemoryEndpointsMemoryRecord {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Short-term or long-term memory scope.
    pub scope: MemoryEndpointsScope,
    /// MemoryEndpoints workspace id.
    pub workspace_id: String,
    /// Sender agent id.
    pub agent_id: String,
    /// Short human label for the record.
    pub title: String,
    /// Public-safe summary. Must not contain raw credentials or private logs.
    pub safe_summary: String,
    /// `.uai`, docs, or wiki references that keep durable detail outside the summary.
    pub uai_references: Vec<String>,
    /// Optional search tags.
    pub tags: Vec<String>,
    /// Optional SHA-256 of the local source artifact being summarized.
    pub source_sha256: Option<String>,
}

/// Public MemoryEndpoints memory-event submit payload derived from a TinyRustLM memory record.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEndpointsSubmitPayload {
    /// MemoryEndpoints workspace id.
    pub workspace_id: String,
    /// Agent id that authored the public-safe memory event.
    pub actor_agent_id: String,
    /// Compatibility agent id for older connector implementations.
    pub agent_id: String,
    /// Stable TinyRustLM memory record kind.
    pub kind: String,
    /// Stable TinyRustLM memory record version.
    pub version: u32,
    /// MemoryEndpoints public scope, usually `project` for TinyRustLM.com.
    pub scope: String,
    /// Stable TinyRustLM project scope id.
    pub scope_id: String,
    /// MemoryEndpoints memory type such as `status` or `handoff`.
    pub memory_type: String,
    /// Public-safe subject.
    pub subject: String,
    /// Public-safe title.
    pub title: String,
    /// Public-safe summary required by MemoryEndpoints.
    pub summary: String,
    /// Compatibility summary for older TinyRustLM clients.
    pub safe_summary: String,
    /// Public-safe source label.
    pub source: String,
    /// Confidence from 0.0 to 1.0.
    pub confidence: f32,
    /// Durable `.uai`, docs, or wiki references.
    pub uai_references: Vec<String>,
    /// Search tags.
    pub tags: Vec<String>,
    /// TinyRustLM-specific memory tier.
    pub tinyrustlm_memory_tier: String,
    /// Optional source artifact checksum.
    pub source_sha256: Option<String>,
}

impl MemoryEndpointsMemoryRecord {
    /// Converts a validated TinyRustLM memory record into the public MemoryEndpoints submit contract.
    pub fn to_submit_payload(&self) -> MemoryEndpointsSubmitPayload {
        let tier = self.scope.to_string();
        let mut tags = self.tags.clone();
        for required in [
            "tinyrustlm".to_string(),
            "memoryendpoints".to_string(),
            tier.replace('_', "-"),
            format!("scope:{MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID}"),
        ] {
            if !tags.iter().any(|tag| tag == &required) {
                tags.push(required);
            }
        }
        tags.sort();
        tags.dedup();

        MemoryEndpointsSubmitPayload {
            workspace_id: self.workspace_id.clone(),
            actor_agent_id: self.agent_id.clone(),
            agent_id: self.agent_id.clone(),
            kind: self.kind.clone(),
            version: self.version,
            scope: MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE.to_string(),
            scope_id: MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID.to_string(),
            memory_type: self.scope.memory_type().to_string(),
            subject: self.title.clone(),
            title: self.title.clone(),
            summary: self.safe_summary.clone(),
            safe_summary: self.safe_summary.clone(),
            source: MEMORY_ENDPOINTS_CONNECTOR_SOURCE.to_string(),
            confidence: 0.8,
            uai_references: self.uai_references.clone(),
            tags,
            tinyrustlm_memory_tier: tier,
            source_sha256: self.source_sha256.clone(),
        }
    }
}

/// Validation result for connector policies and memory records.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct MemoryEndpointsValidationReport {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Whether the input satisfies the public connector contract.
    pub valid: bool,
    /// Machine-readable validation failures.
    pub failures: Vec<String>,
    /// Non-fatal guidance warnings.
    pub warnings: Vec<String>,
}

impl MemoryEndpointsValidationReport {
    fn valid() -> Self {
        Self {
            kind: MEMORY_ENDPOINTS_VALIDATION_KIND.to_string(),
            version: 1,
            valid: true,
            failures: Vec::new(),
            warnings: Vec::new(),
        }
    }

    fn invalid(failures: Vec<String>, warnings: Vec<String>) -> Self {
        Self {
            kind: MEMORY_ENDPOINTS_VALIDATION_KIND.to_string(),
            version: 1,
            valid: false,
            failures,
            warnings,
        }
    }
}

/// Error returned by MemoryEndpoints connector contract helpers.
#[derive(Debug)]
pub enum MemoryEndpointsError {
    /// JSON was syntactically invalid or had the wrong shape.
    InvalidJson(String),
}

impl Display for MemoryEndpointsError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidJson(message) => write!(formatter, "invalid JSON: {message}"),
        }
    }
}

impl std::error::Error for MemoryEndpointsError {}

/// Validates a connector policy JSON document.
pub fn validate_connector_policy_text(
    json: &str,
) -> Result<MemoryEndpointsValidationReport, MemoryEndpointsError> {
    let policy: MemoryEndpointsConnectorPolicy = serde_json::from_str(json)
        .map_err(|error| MemoryEndpointsError::InvalidJson(error.to_string()))?;
    Ok(validate_connector_policy(&policy))
}

/// Validates a memory record JSON document.
pub fn validate_memory_record_text(
    json: &str,
) -> Result<MemoryEndpointsValidationReport, MemoryEndpointsError> {
    let record: MemoryEndpointsMemoryRecord = serde_json::from_str(json)
        .map_err(|error| MemoryEndpointsError::InvalidJson(error.to_string()))?;
    Ok(validate_memory_record(&record))
}

/// Validates a connector policy.
pub fn validate_connector_policy(
    policy: &MemoryEndpointsConnectorPolicy,
) -> MemoryEndpointsValidationReport {
    let mut failures = Vec::new();
    let mut warnings = Vec::new();
    require_kind(
        &policy.kind,
        MEMORY_ENDPOINTS_CONNECTOR_POLICY_KIND,
        "policy.kind",
        &mut failures,
    );
    if policy.version != 1 {
        failures.push("policy.version must be 1".to_string());
    }
    if !policy.enabled {
        warnings.push("connector disabled; no hosted memory sync will run".to_string());
    }
    validate_public_identifier(
        "policy.workspace_id",
        &policy.workspace_id,
        MAX_WORKSPACE_ID_CHARS,
        &mut failures,
    );
    validate_public_identifier(
        "policy.agent_id",
        &policy.agent_id,
        MAX_AGENT_ID_CHARS,
        &mut failures,
    );
    if policy.enabled && !is_allowed_endpoint_url(&policy.base_url) {
        failures.push(
            "policy.base_url must be https:// or loopback http://127.0.0.1/localhost".to_string(),
        );
    }
    if contains_likely_secret(&policy.base_url) || contains_likely_secret(&policy.secret_source) {
        failures.push("policy must not embed bearer tokens, API keys, or passwords".to_string());
    }
    if policy.enabled && !policy.allow_short_term && !policy.allow_long_term {
        failures.push("enabled policy must allow at least one memory scope".to_string());
    }

    report(failures, warnings)
}

/// Validates a public-safe memory record.
pub fn validate_memory_record(
    record: &MemoryEndpointsMemoryRecord,
) -> MemoryEndpointsValidationReport {
    let mut failures = Vec::new();
    let mut warnings = Vec::new();
    require_kind(
        &record.kind,
        MEMORY_ENDPOINTS_MEMORY_RECORD_KIND,
        "record.kind",
        &mut failures,
    );
    if record.version != 1 {
        failures.push("record.version must be 1".to_string());
    }
    validate_public_identifier(
        "record.workspace_id",
        &record.workspace_id,
        MAX_WORKSPACE_ID_CHARS,
        &mut failures,
    );
    validate_public_identifier(
        "record.agent_id",
        &record.agent_id,
        MAX_AGENT_ID_CHARS,
        &mut failures,
    );
    validate_public_text(
        "record.title",
        &record.title,
        MAX_TITLE_CHARS,
        &mut failures,
    );
    validate_public_text(
        "record.safe_summary",
        &record.safe_summary,
        MAX_SAFE_SUMMARY_CHARS,
        &mut failures,
    );
    if contains_likely_secret(&record.safe_summary) {
        failures.push("record.safe_summary appears to contain secret material".to_string());
    }
    if record.uai_references.len() > MAX_REFERENCE_COUNT {
        failures.push(format!(
            "record.uai_references may contain at most {MAX_REFERENCE_COUNT} entries"
        ));
    }
    if record.tags.len() > MAX_TAG_COUNT {
        failures.push(format!(
            "record.tags may contain at most {MAX_TAG_COUNT} entries"
        ));
    }
    for reference in &record.uai_references {
        if !is_safe_memory_reference(reference) {
            failures.push(format!(
                "record.uai_references contains unsafe path '{reference}'"
            ));
        }
    }
    if record.scope == MemoryEndpointsScope::LongTerm && record.uai_references.is_empty() {
        warnings.push(
            "long_term records should include .uai/docs/wiki references for durable detail"
                .to_string(),
        );
    }
    if let Some(source_sha256) = &record.source_sha256 {
        if !is_sha256_hex(source_sha256) {
            failures.push("record.source_sha256 must be 64 lowercase hex characters".to_string());
        }
    }

    report(failures, warnings)
}

/// Serializes a validated MemoryEndpoints memory record.
pub fn serialize_memory_record(
    record: &MemoryEndpointsMemoryRecord,
) -> Result<String, serde_json::Error> {
    serde_json::to_string(record)
}

fn report(failures: Vec<String>, warnings: Vec<String>) -> MemoryEndpointsValidationReport {
    if failures.is_empty() {
        let mut report = MemoryEndpointsValidationReport::valid();
        report.warnings = warnings;
        report
    } else {
        MemoryEndpointsValidationReport::invalid(failures, warnings)
    }
}

fn require_kind(actual: &str, expected: &str, label: &str, failures: &mut Vec<String>) {
    if actual != expected {
        failures.push(format!("{label} must be {expected}"));
    }
}

fn validate_public_identifier(
    label: &str,
    value: &str,
    max_chars: usize,
    failures: &mut Vec<String>,
) {
    validate_public_text(label, value, max_chars, failures);
    if value
        .chars()
        .any(|ch| !(ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.')))
    {
        failures.push(format!("{label} contains unsupported characters"));
    }
}

fn validate_public_text(label: &str, value: &str, max_chars: usize, failures: &mut Vec<String>) {
    if value.trim().is_empty() {
        failures.push(format!("{label} is required"));
    }
    if value.chars().count() > max_chars {
        failures.push(format!("{label} exceeds {max_chars} characters"));
    }
    if value
        .chars()
        .any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))
    {
        failures.push(format!("{label} contains unsafe control characters"));
    }
}

fn is_allowed_endpoint_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.starts_with("https://")
        || lower.starts_with("http://127.0.0.1/")
        || lower.starts_with("http://127.0.0.1:")
        || lower.starts_with("http://localhost/")
        || lower.starts_with("http://localhost:")
}

fn contains_likely_secret(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("bearer ")
        || lower.contains("api_key")
        || lower.contains("apikey")
        || lower.contains("password")
        || lower.contains("secret=")
        || value
            .split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '_' && ch != '-')
            .any(|part| part.len() >= 48 && !is_sha256_hex(part))
}

fn is_safe_memory_reference(value: &str) -> bool {
    let normalized = value.replace('\\', "/");
    !normalized.contains("..")
        && !normalized.starts_with('/')
        && !normalized.contains(':')
        && (normalized.starts_with(".uai/")
            || normalized.starts_with("docs/")
            || normalized.starts_with("wiki/")
            || normalized.ends_with(".uai"))
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64
        && value
            .chars()
            .all(|ch| ch.is_ascii_hexdigit() && !ch.is_ascii_uppercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_short_and_long_term_records_without_secret_leakage() {
        let short = MemoryEndpointsMemoryRecord {
            kind: MEMORY_ENDPOINTS_MEMORY_RECORD_KIND.to_string(),
            version: 1,
            scope: MemoryEndpointsScope::ShortTerm,
            workspace_id: "workspace-demo".to_string(),
            agent_id: "tinyrustlm-agent".to_string(),
            title: "Current TinyRustLM slice".to_string(),
            safe_summary: "Short-term note references the local .uai plan and contains no secrets."
                .to_string(),
            uai_references: vec![".uai/short-term-memory.uai".to_string()],
            tags: vec!["tinyrustlm".to_string(), "short-term".to_string()],
            source_sha256: None,
        };
        assert!(validate_memory_record(&short).valid);

        let mut long = short.clone();
        long.scope = MemoryEndpointsScope::LongTerm;
        long.title = "Durable implementation plan".to_string();
        long.uai_references = vec!["wiki/runtime-mirust/reports/memory-plan.md".to_string()];
        long.source_sha256 =
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string());
        assert!(validate_memory_record(&long).valid);
    }

    #[test]
    fn maps_tinyrustlm_tiers_to_public_memory_event_contract() {
        assert_eq!(MemoryEndpointsScope::ShortTerm.memory_type(), "status");
        assert_eq!(MemoryEndpointsScope::LongTerm.memory_type(), "handoff");

        let record = MemoryEndpointsMemoryRecord {
            kind: MEMORY_ENDPOINTS_MEMORY_RECORD_KIND.to_string(),
            version: 1,
            scope: MemoryEndpointsScope::LongTerm,
            workspace_id: "workspace-demo".to_string(),
            agent_id: "tinyrustlm-agent".to_string(),
            title: "Durable implementation plan".to_string(),
            safe_summary:
                "Long-term hosted memory keeps public-safe summaries plus .uai references."
                    .to_string(),
            uai_references: vec![".uai/long-term-memory.uai".to_string()],
            tags: vec!["custom".to_string()],
            source_sha256: None,
        };

        let payload = record.to_submit_payload();

        assert_eq!(payload.workspace_id, "workspace-demo");
        assert_eq!(payload.actor_agent_id, "tinyrustlm-agent");
        assert_eq!(payload.scope, MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE);
        assert_eq!(payload.scope_id, MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID);
        assert_eq!(payload.memory_type, "handoff");
        assert_eq!(payload.summary, record.safe_summary);
        assert_eq!(payload.tinyrustlm_memory_tier, "long_term");
        assert!(payload.tags.contains(&"long-term".to_string()));
        assert!(payload
            .tags
            .contains(&format!("scope:{MEMORY_ENDPOINTS_TINYRUSTLM_SCOPE_ID}")));
    }

    #[test]
    fn rejects_secret_like_memory_and_unsafe_references() {
        let record = MemoryEndpointsMemoryRecord {
            kind: MEMORY_ENDPOINTS_MEMORY_RECORD_KIND.to_string(),
            version: 1,
            scope: MemoryEndpointsScope::ShortTerm,
            workspace_id: "workspace-demo".to_string(),
            agent_id: "tinyrustlm-agent".to_string(),
            title: "bad".to_string(),
            safe_summary: "Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".to_string(),
            uai_references: vec!["../secret.txt".to_string()],
            tags: Vec::new(),
            source_sha256: Some("not-a-sha".to_string()),
        };
        let report = validate_memory_record(&record);
        assert!(!report.valid);
        assert!(report
            .failures
            .iter()
            .any(|failure| failure.contains("secret material")));
        assert!(report
            .failures
            .iter()
            .any(|failure| failure.contains("unsafe path")));
    }

    #[test]
    fn connector_policy_fails_closed_without_opt_in() {
        let disabled = MemoryEndpointsConnectorPolicy::disabled();
        let report = validate_connector_policy(&disabled);
        assert!(!report.valid);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("connector disabled")));

        let enabled = MemoryEndpointsConnectorPolicy {
            kind: MEMORY_ENDPOINTS_CONNECTOR_POLICY_KIND.to_string(),
            version: 1,
            enabled: true,
            base_url: "https://memoryendpoints.example".to_string(),
            workspace_id: "workspace-demo".to_string(),
            agent_id: "tinyrustlm-agent".to_string(),
            auth_header_mode: MemoryEndpointsAuthHeaderMode::XMemoryEndpointsKey,
            allow_short_term: true,
            allow_long_term: true,
            secret_source: "environment:MEMORYENDPOINTS_TOKEN".to_string(),
        };
        assert!(validate_connector_policy(&enabled).valid);
        assert_eq!(
            enabled.auth_header_mode,
            MemoryEndpointsAuthHeaderMode::XMemoryEndpointsKey
        );
    }

    #[test]
    fn connector_policy_defaults_to_authorization_header_for_existing_json() {
        let json = serde_json::json!({
            "kind": MEMORY_ENDPOINTS_CONNECTOR_POLICY_KIND,
            "version": 1,
            "enabled": true,
            "base_url": "https://memoryendpoints.example",
            "workspace_id": "workspace-demo",
            "agent_id": "tinyrustlm-agent",
            "allow_short_term": true,
            "allow_long_term": true,
            "secret_source": "environment:MEMORYENDPOINTS_TOKEN"
        })
        .to_string();

        let policy: MemoryEndpointsConnectorPolicy = serde_json::from_str(&json).unwrap();

        assert_eq!(
            policy.auth_header_mode,
            MemoryEndpointsAuthHeaderMode::AuthorizationBearer
        );
        assert!(validate_connector_policy(&policy).valid);
    }
}
