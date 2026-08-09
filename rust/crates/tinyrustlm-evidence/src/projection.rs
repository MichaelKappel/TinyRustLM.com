use crate::authority::verify_authority_graph;
use crate::phase_invalidation::{classify_phase_receipts, is_supported_phase_receipt_type};
use crate::receipt::{
    canonical_value_bytes, lowercase_hex, parse_utc, valid_content_id, valid_digest, valid_safe_id,
    validate_receipt_bytes_detailed, Receipt,
};
use crate::subject::{validate_identity_subject_bytes, IdentitySubject};
use crate::{
    validate_campaign_plan_wire, Announcement, BrowserRound, CampaignPlanWire,
    FinalizedCampaignPlan, MemoryRound, ModelSlot, P2pLane, CAMPAIGN_ANNOUNCEMENT_COUNT,
    CAMPAIGN_BROWSER_ROUND_COUNT, CAMPAIGN_MEMORY_ROUND_COUNT, CAMPAIGN_MODEL_COUNT,
    CAMPAIGN_P2P_LANE_COUNT, CAMPAIGN_PLAN_MAXIMUM_BYTES, CAMPAIGN_PROJECTION_PROFILE_ID,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;
use url::Url;

/// The SHA-256 of the exact frozen campaign-projection profile bytes.
pub const CAMPAIGN_PROJECTION_PROFILE_SHA256: &str =
    "a5ed56eb0c0b924eaac3222bb814732bd36f2bfeae217477cf7549ae732d4ae9";
/// The one current canonical campaign-projection result schema.
pub const CAMPAIGN_PROJECTION_RESULT_SCHEMA: &str =
    "tinyrustlm.vnext.campaign_projection_result.v1";

const MAXIMUM_RESULT_BYTES: usize = 4_194_304;
const MAXIMUM_RECEIPTS: usize = 2_048;
const MAXIMUM_SUBJECTS: usize = 2_048;
const MAXIMUM_TOTAL_RECEIPT_BYTES: usize = 67_108_864;
const MAXIMUM_TOTAL_SUBJECT_BYTES: usize = 67_108_864;
const OUTSIDE_PROOF_SCHEMA: &str = "tinyrustlm.vnext.outside_proof.v2";
const OUTSIDE_PROOF_NETWORK_SCOPE: &str = "outside-host-and-local-network";
const OBJECTIVE_TYPES: &[&str] = &[
    "browser-round",
    "catalog-announcement",
    "memory-continuity",
    "qualification",
];
const RESULT_FIELDS: &[&str] = &[
    "authorityStatus",
    "authorityTerminalRegistryReceiptId",
    "blockerCodes",
    "campaignId",
    "campaignPlanId",
    "campaignPlanSha256",
    "complete",
    "conflictingLaneIds",
    "conflictingObjectiveSignatureSubjectIds",
    "conflictingOperationIdentities",
    "countedEvidence",
    "counts",
    "currentOperation",
    "environment",
    "objectiveReceiptCount",
    "objectiveSignatureCount",
    "phaseReceiptCount",
    "phaseStateCounts",
    "profileId",
    "profileSha256",
    "resumableState",
    "schema",
    "unplannedCurrentReceiptIds",
    "unsignedCurrentReceiptIds",
    "verificationTimeUtc",
];
const PLAN_FIELDS: &[&str] = &[
    "announcements",
    "applicationOrigin",
    "browserRounds",
    "campaignId",
    "createdAtUtc",
    "environment",
    "memoryContractId",
    "memoryRounds",
    "models",
    "p2pLanes",
    "planId",
    "profileId",
    "schema",
];
const BLOCKER_CODES: &[&str] = &[
    "authority_graph_unavailable",
    "authority_registry_not_current",
    "catalog_announcements_incomplete",
    "clean_browser_rounds_incomplete",
    "live_memory_rounds_incomplete",
    "objective_signature_conflicts",
    "outside_proof_conflicts",
    "outside_proofs_incomplete",
    "phase_conflicts_detected",
    "qualified_models_incomplete",
    "unplanned_current_objective_evidence",
    "unsigned_current_objective_evidence",
];

/// One complete caller-supplied campaign-projection input.
#[derive(Clone, Copy, Debug)]
pub struct CampaignProjectionInput<'a> {
    /// Exact canonical campaign-plan bytes.
    pub campaign_plan_bytes: &'a [u8],
    /// Caller-pinned SHA-256 of the exact campaign plan.
    pub expected_campaign_plan_sha256: &'a str,
    /// Caller-pinned campaign identity.
    pub expected_campaign_id: &'a str,
    /// Caller-pinned environment.
    pub expected_environment: &'a str,
    /// Optional caller-pinned terminal authority-registry receipt identity.
    pub expected_terminal_registry_receipt_id: Option<&'a str>,
    /// Exact canonical receipt wires.
    pub receipt_bytes: &'a [Vec<u8>],
    /// Exact canonical non-receipt subject wires.
    pub subject_bytes: &'a [Vec<u8>],
    /// Optional caller-pinned trusted authority root receipt identity.
    pub trusted_root_registry_receipt_id: Option<&'a str>,
    /// Caller-supplied projection verification time.
    pub verification_time_utc: &'a str,
}

/// One bounded campaign-projection failure with a stable public-safe code.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CampaignProjectionError {
    code: &'static str,
}

impl CampaignProjectionError {
    /// Returns the stable machine-readable public-safe failure code.
    pub const fn code(&self) -> &'static str {
        self.code
    }
}

impl fmt::Display for CampaignProjectionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for CampaignProjectionError {}

/// An immutable canonical campaign-projection result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifiedCampaignProjection {
    bytes: Vec<u8>,
    sha256: String,
}

impl VerifiedCampaignProjection {
    /// Returns the exact canonical result bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Returns the lowercase SHA-256 of the canonical result bytes.
    pub fn sha256(&self) -> &str {
        &self.sha256
    }

    /// Returns an independently owned copy of the canonical result bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.bytes.clone()
    }
}

struct ParsedInput<'a> {
    input: CampaignProjectionInput<'a>,
    finalized_plan: FinalizedCampaignPlan,
    plan: CampaignPlanWire,
}

struct ReceiptEntry {
    bytes: Vec<u8>,
    receipt: Receipt,
}

struct Evidence {
    receipts: Vec<ReceiptEntry>,
    subjects: Vec<IdentitySubject>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhaseRecord {
    operation_id: String,
    phase: String,
    receipt_id: String,
    receipt_type: String,
    state: String,
    subject_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhaseResult {
    conflicting_operation_identities: Vec<String>,
    receipt_count: usize,
    records: Vec<PhaseRecord>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthoritySignature {
    current_evidence_eligible: bool,
    role: String,
    scope: String,
    signature_receipt_id: String,
    signed_schema: String,
    signed_subject_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityResult {
    signatures: Vec<AuthoritySignature>,
    terminal_registry_current: bool,
    terminal_registry_receipt_id: String,
}

struct PlanIndex<'a> {
    plan: &'a CampaignPlanWire,
    model_by_id: BTreeMap<&'a str, &'a ModelSlot>,
    model_by_qualification_operation: BTreeMap<&'a str, &'a ModelSlot>,
    browser_by_id: BTreeMap<&'a str, &'a BrowserRound>,
    browser_by_operation: BTreeMap<&'a str, &'a BrowserRound>,
    memory_by_operation: BTreeMap<&'a str, &'a MemoryRound>,
    announcement_by_operation: BTreeMap<&'a str, &'a Announcement>,
}

impl<'a> PlanIndex<'a> {
    fn new(plan: &'a CampaignPlanWire) -> Self {
        Self {
            plan,
            model_by_id: plan
                .models
                .iter()
                .map(|entry| (entry.model_slot_id.as_str(), entry))
                .collect(),
            model_by_qualification_operation: plan
                .models
                .iter()
                .map(|entry| (entry.qualification_operation_id.as_str(), entry))
                .collect(),
            browser_by_id: plan
                .browser_rounds
                .iter()
                .map(|entry| (entry.round_id.as_str(), entry))
                .collect(),
            browser_by_operation: plan
                .browser_rounds
                .iter()
                .map(|entry| (entry.operation_id.as_str(), entry))
                .collect(),
            memory_by_operation: plan
                .memory_rounds
                .iter()
                .map(|entry| (entry.operation_id.as_str(), entry))
                .collect(),
            announcement_by_operation: plan
                .announcements
                .iter()
                .map(|entry| (entry.operation_id.as_str(), entry))
                .collect(),
        }
    }
}

#[derive(Clone)]
enum ObjectiveMatch {
    Qualification { model_slot_id: String },
    Browser { round_id: String },
    Memory { memory_round_id: String },
    Announcement { announcement_id: String },
}

#[derive(Clone)]
struct ExactObjective {
    matched: ObjectiveMatch,
    receipt: Receipt,
    record: PhaseRecord,
}

#[derive(Default)]
struct CountedEvidenceMaps {
    qualification_by_model: BTreeMap<String, String>,
    browser_by_round: BTreeMap<String, String>,
    memory_by_round: BTreeMap<String, String>,
    proof_by_lane: BTreeMap<String, String>,
    announcement_by_model: BTreeMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutsideProof {
    checked_routes: Vec<CheckedRoute>,
    complete_transfer_bytes: u64,
    complete_transfer_sha256: String,
    endpoint: String,
    expires_at_utc: String,
    issued_at_utc: String,
    lane_id: String,
    model_artifact_id: String,
    network_scope: String,
    observed_at_utc: String,
    p2p_manifest_id: String,
    process_instance_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckedRoute {
    byte_length: u64,
    method: String,
    path: String,
    response_sha256: String,
    status: u16,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CountValue {
    current: usize,
    target: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ProjectionCounts {
    announced_models: CountValue,
    clean_browser_rounds: CountValue,
    live_memory_rounds: CountValue,
    outside_proven_lanes: CountValue,
    qualified_models: CountValue,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CurrentOperation {
    operation_id: Option<String>,
    phase: Option<String>,
    state: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct PhaseStateCounts {
    conflict: usize,
    #[serde(rename = "current-nonpass")]
    current_nonpass: usize,
    #[serde(rename = "current-pass")]
    current_pass: usize,
    stale: usize,
    superseded: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CountedEvidence {
    announced_model_receipt_ids: Vec<String>,
    browser_round_receipt_ids: Vec<String>,
    memory_round_receipt_ids: Vec<String>,
    outside_proof_subject_ids: Vec<String>,
    qualification_receipt_ids: Vec<String>,
    signature_receipt_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ProjectionResult {
    authority_status: String,
    authority_terminal_registry_receipt_id: Option<String>,
    blocker_codes: Vec<String>,
    campaign_id: String,
    campaign_plan_id: String,
    campaign_plan_sha256: String,
    complete: bool,
    conflicting_lane_ids: Vec<String>,
    conflicting_objective_signature_subject_ids: Vec<String>,
    conflicting_operation_identities: Vec<String>,
    counted_evidence: CountedEvidence,
    counts: ProjectionCounts,
    current_operation: CurrentOperation,
    environment: String,
    objective_receipt_count: usize,
    objective_signature_count: usize,
    phase_receipt_count: usize,
    phase_state_counts: PhaseStateCounts,
    profile_id: String,
    profile_sha256: String,
    resumable_state: String,
    schema: String,
    unplanned_current_receipt_ids: Vec<String>,
    unsigned_current_receipt_ids: Vec<String>,
    verification_time_utc: String,
}

/// Projects exact current, authorized campaign evidence onto one immutable campaign plan.
pub fn project_campaign(
    input: CampaignProjectionInput<'_>,
) -> Result<VerifiedCampaignProjection, CampaignProjectionError> {
    let parsed = parse_input(input)?;
    let evidence = parse_evidence(&parsed)?;
    let phase = classify_phases(&parsed, &evidence)?;
    let authority = verify_authority(&parsed)?;
    project(parsed, evidence, phase, authority)
}

fn parse_input(
    input: CampaignProjectionInput<'_>,
) -> Result<ParsedInput<'_>, CampaignProjectionError> {
    if !valid_digest(input.expected_campaign_plan_sha256)
        || !valid_safe_id(input.expected_campaign_id)
        || !matches!(
            input.expected_environment,
            "development" | "production" | "staging"
        )
        || parse_utc(input.verification_time_utc).is_err()
        || input.trusted_root_registry_receipt_id.is_some()
            != input.expected_terminal_registry_receipt_id.is_some()
        || input
            .trusted_root_registry_receipt_id
            .is_some_and(|value| !valid_content_id(value))
        || input
            .expected_terminal_registry_receipt_id
            .is_some_and(|value| !valid_content_id(value))
    {
        return Err(failure("campaign_projection_input_invalid"));
    }
    if lowercase_hex(&Sha256::digest(input.campaign_plan_bytes))
        != input.expected_campaign_plan_sha256
    {
        return Err(failure("campaign_plan_hash_mismatch"));
    }
    let (finalized_plan, plan) = validate_projection_plan(input.campaign_plan_bytes)?;
    if plan.campaign_id != input.expected_campaign_id
        || plan.environment != input.expected_environment
    {
        return Err(failure("campaign_plan_projection_mismatch"));
    }
    validate_collection(
        input.receipt_bytes,
        MAXIMUM_RECEIPTS,
        MAXIMUM_TOTAL_RECEIPT_BYTES,
        "campaign_projection_receipt_input_invalid",
    )?;
    validate_collection(
        input.subject_bytes,
        MAXIMUM_SUBJECTS,
        MAXIMUM_TOTAL_SUBJECT_BYTES,
        "campaign_projection_subject_input_invalid",
    )?;
    Ok(ParsedInput {
        input,
        finalized_plan,
        plan,
    })
}

fn validate_projection_plan(
    bytes: &[u8],
) -> Result<(FinalizedCampaignPlan, CampaignPlanWire), CampaignProjectionError> {
    if bytes.is_empty() || bytes.len() > CAMPAIGN_PLAN_MAXIMUM_BYTES {
        return Err(failure("campaign_plan_byte_limit"));
    }
    let value: Value =
        serde_json::from_slice(bytes).map_err(|_| failure("campaign_plan_invalid"))?;
    if !exact_fields(&value, PLAN_FIELDS) {
        return Err(failure("campaign_plan_fields_invalid"));
    }
    validate_campaign_plan_wire(bytes).map_err(|error| failure(error.code()))
}

fn validate_collection(
    values: &[Vec<u8>],
    maximum_count: usize,
    maximum_bytes: usize,
    code: &'static str,
) -> Result<(), CampaignProjectionError> {
    if values.len() > maximum_count {
        return Err(failure(code));
    }
    let total = values
        .iter()
        .try_fold(0usize, |sum, value| sum.checked_add(value.len()))
        .ok_or_else(|| failure(code))?;
    if total > maximum_bytes {
        return Err(failure(code));
    }
    Ok(())
}

fn parse_evidence(parsed: &ParsedInput<'_>) -> Result<Evidence, CampaignProjectionError> {
    let mut receipts = BTreeMap::new();
    for bytes in parsed.input.receipt_bytes {
        let receipt =
            validate_receipt_bytes_detailed(bytes).map_err(|error| failure(error.code()))?;
        if receipts.contains_key(&receipt.receipt_id) {
            return Err(failure("campaign_projection_receipt_duplicate"));
        }
        if receipt.campaign_id != parsed.input.expected_campaign_id {
            return Err(failure("campaign_projection_campaign_mismatch"));
        }
        receipts.insert(
            receipt.receipt_id.clone(),
            ReceiptEntry {
                bytes: bytes.clone(),
                receipt,
            },
        );
    }
    let receipt_ids = receipts.keys().cloned().collect::<BTreeSet<_>>();
    let mut subjects = BTreeMap::new();
    for bytes in parsed.input.subject_bytes {
        let subject = validate_identity_subject_bytes(bytes).map_err(failure)?;
        if subjects.contains_key(&subject.subject_id) || receipt_ids.contains(&subject.subject_id) {
            return Err(failure("campaign_projection_subject_duplicate"));
        }
        if subject.value.get("campaignId").is_some()
            && subject.value.get("campaignId").and_then(Value::as_str)
                != Some(parsed.input.expected_campaign_id)
        {
            return Err(failure("campaign_projection_campaign_mismatch"));
        }
        subjects.insert(subject.subject_id.clone(), subject);
    }
    Ok(Evidence {
        receipts: receipts.into_values().collect(),
        subjects: subjects.into_values().collect(),
    })
}

fn classify_phases(
    parsed: &ParsedInput<'_>,
    evidence: &Evidence,
) -> Result<PhaseResult, CampaignProjectionError> {
    let phase_bytes = evidence
        .receipts
        .iter()
        .filter(|entry| is_supported_phase_receipt_type(&entry.receipt.receipt_type))
        .map(|entry| entry.bytes.clone())
        .collect::<Vec<_>>();
    if phase_bytes.is_empty() {
        return Ok(PhaseResult {
            conflicting_operation_identities: Vec::new(),
            receipt_count: 0,
            records: Vec::new(),
        });
    }
    let result = classify_phase_receipts(parsed.input.expected_campaign_id, &phase_bytes)
        .map_err(|error| failure(error.code()))?;
    serde_json::from_slice(result.bytes())
        .map_err(|_| failure("campaign_projection_phase_result_invalid"))
}

fn verify_authority(
    parsed: &ParsedInput<'_>,
) -> Result<Option<AuthorityResult>, CampaignProjectionError> {
    let Some(root) = parsed.input.trusted_root_registry_receipt_id else {
        return Ok(None);
    };
    let terminal = parsed
        .input
        .expected_terminal_registry_receipt_id
        .ok_or_else(|| failure("campaign_projection_input_invalid"))?;
    let result = verify_authority_graph(
        parsed.input.expected_campaign_id,
        parsed.input.expected_environment,
        parsed.input.verification_time_utc,
        root,
        terminal,
        parsed.input.receipt_bytes,
        parsed.input.subject_bytes,
    )
    .map_err(|error| failure(error.code()))?;
    serde_json::from_slice(result.bytes())
        .map(Some)
        .map_err(|_| failure("campaign_projection_authority_result_invalid"))
}

fn exact_fields(value: &Value, expected: &[&str]) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    let actual = object.keys().map(String::as_str).collect::<BTreeSet<_>>();
    let expected = expected.iter().copied().collect::<BTreeSet<_>>();
    actual == expected
}

fn parameter_map(receipt: &Receipt) -> BTreeMap<&str, &str> {
    receipt
        .public_parameters
        .iter()
        .map(|entry| (entry.name.as_str(), entry.value.as_str()))
        .collect()
}

fn exact_parameters(receipt: &Receipt, expected: &[(&str, &str)]) -> bool {
    let actual = parameter_map(receipt);
    let expected = expected.iter().copied().collect::<BTreeMap<_, _>>();
    actual == expected
}

fn exact_output_hashes(receipt: &Receipt, expected: &[(&str, &str)]) -> bool {
    let actual = receipt
        .output_hashes
        .iter()
        .map(|entry| (entry.name.as_str(), entry.sha256.as_str()))
        .collect::<BTreeMap<_, _>>();
    let expected = expected.iter().copied().collect::<BTreeMap<_, _>>();
    receipt.output_hashes.len() == expected.len() && actual == expected
}

fn exact_output_names(receipt: &Receipt, expected: &[&str]) -> bool {
    let actual = receipt
        .output_hashes
        .iter()
        .map(|entry| entry.name.as_str())
        .collect::<BTreeSet<_>>();
    let expected = expected.iter().copied().collect::<BTreeSet<_>>();
    receipt.output_hashes.len() == expected.len() && actual == expected
}

fn has_input_hash(receipt: &Receipt, name: &str, digest: &str) -> bool {
    receipt
        .input_hashes
        .iter()
        .any(|entry| entry.name == name && entry.sha256 == digest)
}

fn objective_binding(receipt_type: &str) -> Option<(&'static str, &'static str)> {
    match receipt_type {
        "qualification" | "browser-round" | "memory-continuity" => {
            Some(("local-recorder", "receipt-recording"))
        }
        "catalog-announcement" => Some(("p2p-publisher", "p2p-publication")),
        _ => None,
    }
}

fn phase_match(
    receipt_type: &str,
    record: &PhaseRecord,
    receipt: &Receipt,
    index: &PlanIndex<'_>,
) -> Option<ObjectiveMatch> {
    match receipt_type {
        "qualification" => match_qualification(record, receipt, index),
        "browser-round" => match_browser(record, receipt, index),
        "memory-continuity" => match_memory(record, receipt, index),
        "catalog-announcement" => match_announcement(record, receipt, index),
        _ => None,
    }
}

fn match_qualification(
    record: &PhaseRecord,
    receipt: &Receipt,
    index: &PlanIndex<'_>,
) -> Option<ObjectiveMatch> {
    let slot = index
        .model_by_qualification_operation
        .get(record.operation_id.as_str())?;
    let expected = [
        ("artifact_id", slot.artifact_id.as_str()),
        ("artifact_sha256", slot.artifact_sha256.as_str()),
        ("model_slot_id", slot.model_slot_id.as_str()),
        ("operation_id", slot.qualification_operation_id.as_str()),
        ("subject_id", slot.artifact_id.as_str()),
    ];
    if record.phase != "qualification"
        || record.receipt_type != "qualification"
        || record.subject_id != slot.artifact_id
        || !exact_parameters(receipt, &expected)
        || !exact_output_hashes(
            receipt,
            &[("qualified-artifact", slot.artifact_sha256.as_str())],
        )
        || receipt.runtime.execution_class != "local"
    {
        return None;
    }
    Some(ObjectiveMatch::Qualification {
        model_slot_id: slot.model_slot_id.clone(),
    })
}

fn match_browser(
    record: &PhaseRecord,
    receipt: &Receipt,
    index: &PlanIndex<'_>,
) -> Option<ObjectiveMatch> {
    let round = index
        .browser_by_operation
        .get(record.operation_id.as_str())?;
    let slot = index.model_by_id.get(round.model_slot_id.as_str())?;
    let parameters = parameter_map(receipt);
    let turn_count = parameters.get("turn_count").copied().unwrap_or_default();
    if record.phase != "browser-round"
        || record.receipt_type != "browser-round"
        || record.subject_id != round.round_id
        || parameters.len() != 9
        || parameters.get("operation_id") != Some(&round.operation_id.as_str())
        || parameters.get("subject_id") != Some(&round.round_id.as_str())
        || parameters.get("artifact_id") != Some(&slot.artifact_id.as_str())
        || parameters.get("fresh_profile_created") != Some(&"true")
        || parameters.get("model_slot_id") != Some(&slot.model_slot_id.as_str())
        || parameters.get("profile_deleted") != Some(&"true")
        || parameters.get("restart_id") != Some(&round.restart_id.as_str())
        || parameters.get("round_id") != Some(&round.round_id.as_str())
        || !matches!(turn_count.as_bytes(), [b'2'..=b'6'])
        || !exact_output_names(
            receipt,
            &["conversation-evidence", "profile-deletion-proof"],
        )
        || receipt.runtime.architecture != "wasm32"
        || receipt.runtime.execution_class != "browser"
        || receipt.runtime.operating_system != "browser"
    {
        return None;
    }
    Some(ObjectiveMatch::Browser {
        round_id: round.round_id.clone(),
    })
}

fn match_memory(
    record: &PhaseRecord,
    receipt: &Receipt,
    index: &PlanIndex<'_>,
) -> Option<ObjectiveMatch> {
    let memory = index
        .memory_by_operation
        .get(record.operation_id.as_str())?;
    let round = index.browser_by_id.get(memory.browser_round_id.as_str())?;
    let slot = index.model_by_id.get(memory.model_slot_id.as_str())?;
    let expected = [
        ("artifact_id", slot.artifact_id.as_str()),
        ("browser_round_id", round.round_id.as_str()),
        ("company_closed", "true"),
        ("company_deleted", "true"),
        ("company_id_hash", memory.company_id_hash.as_str()),
        ("first_profile_deleted", "true"),
        ("long_term_restored", "true"),
        ("memory_contract_id", index.plan.memory_contract_id.as_str()),
        ("memory_round_id", memory.memory_round_id.as_str()),
        ("model_slot_id", slot.model_slot_id.as_str()),
        ("operation_id", memory.operation_id.as_str()),
        ("post_delete_rejected", "true"),
        ("replay_rejected", "true"),
        ("second_profile_deleted", "true"),
        ("secret_scan_clear", "true"),
        ("short_term_restored", "true"),
        ("subject_id", memory.memory_round_id.as_str()),
    ];
    let memory_contract_digest = index
        .plan
        .memory_contract_id
        .strip_prefix("sha256:")
        .unwrap_or_default();
    if record.phase != "memory-continuity"
        || record.receipt_type != "memory-continuity"
        || record.subject_id != memory.memory_round_id
        || !exact_parameters(receipt, &expected)
        || !has_input_hash(receipt, "memory-contract", memory_contract_digest)
        || !exact_output_names(receipt, &["cleanup-proof", "restore-proof", "secret-scan"])
        || receipt.runtime.execution_class != "live-service"
    {
        return None;
    }
    Some(ObjectiveMatch::Memory {
        memory_round_id: memory.memory_round_id.clone(),
    })
}

fn match_announcement(
    record: &PhaseRecord,
    receipt: &Receipt,
    index: &PlanIndex<'_>,
) -> Option<ObjectiveMatch> {
    let announcement = index
        .announcement_by_operation
        .get(record.operation_id.as_str())?;
    let slot = index.model_by_id.get(announcement.model_slot_id.as_str())?;
    let expected = [
        ("announcement_id", announcement.announcement_id.as_str()),
        ("artifact_id", slot.artifact_id.as_str()),
        ("live_readback_verified", "true"),
        ("model_slot_id", slot.model_slot_id.as_str()),
        ("operation_id", announcement.operation_id.as_str()),
        ("public_https", "true"),
        ("subject_id", announcement.announcement_id.as_str()),
    ];
    if record.phase != "catalog-announcement"
        || record.receipt_type != "catalog-announcement"
        || record.subject_id != announcement.announcement_id
        || !exact_parameters(receipt, &expected)
        || !exact_output_names(receipt, &["announcement-metadata", "catalog-readback"])
        || receipt.runtime.execution_class != "live-service"
    {
        return None;
    }
    Some(ObjectiveMatch::Announcement {
        announcement_id: announcement.announcement_id.clone(),
    })
}

fn current_signatures_by_subject(
    authority: Option<&AuthorityResult>,
) -> BTreeMap<String, Vec<AuthoritySignature>> {
    let mut result = BTreeMap::<String, Vec<AuthoritySignature>>::new();
    if let Some(authority) = authority {
        for signature in &authority.signatures {
            if signature.current_evidence_eligible {
                result
                    .entry(signature.signed_subject_id.clone())
                    .or_default()
                    .push(signature.clone());
            }
        }
    }
    for signatures in result.values_mut() {
        signatures
            .sort_by(|left, right| left.signature_receipt_id.cmp(&right.signature_receipt_id));
    }
    result
}

fn expected_signatures<'a>(
    signatures: &'a BTreeMap<String, Vec<AuthoritySignature>>,
    subject_id: &str,
    role: &str,
    scope: &str,
) -> Vec<&'a AuthoritySignature> {
    signatures
        .get(subject_id)
        .into_iter()
        .flatten()
        .filter(|entry| entry.role == role && entry.scope == scope)
        .collect()
}

fn current_signed<'a>(
    value: Option<&ExactObjective>,
    receipt_type: &str,
    signatures: &'a BTreeMap<String, Vec<AuthoritySignature>>,
) -> Option<&'a AuthoritySignature> {
    let value = value?;
    if value.record.state != "current-pass" {
        return None;
    }
    let (role, scope) = objective_binding(receipt_type)?;
    let values = expected_signatures(signatures, &value.receipt.receipt_id, role, scope);
    if values.len() == 1 {
        Some(values[0])
    } else {
        None
    }
}

fn exact_outside_proof(
    subject: &IdentitySubject,
    lane: &P2pLane,
    slot: &ModelSlot,
    verification_time_nanoseconds: i128,
) -> bool {
    if subject.schema != OUTSIDE_PROOF_SCHEMA {
        return false;
    }
    let Ok(proof) = serde_json::from_value::<OutsideProof>(subject.value.clone()) else {
        return false;
    };
    if proof.model_artifact_id != slot.artifact_id
        || proof.lane_id != lane.lane_id
        || proof.process_instance_id != lane.process_instance_id
        || proof.network_scope != OUTSIDE_PROOF_NETWORK_SCOPE
        || proof.complete_transfer_sha256 != slot.artifact_sha256
        || proof.complete_transfer_bytes < 1
        || !valid_content_id(&proof.p2p_manifest_id)
    {
        return false;
    }
    let Ok(endpoint) = Url::parse(&proof.endpoint) else {
        return false;
    };
    if endpoint.scheme() != "https"
        || !endpoint.username().is_empty()
        || endpoint.password().is_some()
        || format!("{}/", endpoint.origin().ascii_serialization()) != proof.endpoint
    {
        return false;
    }
    if proof.checked_routes.len() != 3 {
        return false;
    }
    let routes = proof
        .checked_routes
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let (Some(artifact), Some(_manifest), Some(_piece)) = (
        routes.get("/artifact"),
        routes.get("/manifest"),
        routes.get("/pieces/0"),
    ) else {
        return false;
    };
    if routes.len() != 3
        || proof
            .checked_routes
            .iter()
            .any(|entry| entry.method != "GET" || entry.status != 200 || entry.byte_length < 1)
        || artifact.response_sha256 != slot.artifact_sha256
    {
        return false;
    }
    let (Ok(issued), Ok(observed), Ok(expires)) = (
        parse_utc(&proof.issued_at_utc),
        parse_utc(&proof.observed_at_utc),
        parse_utc(&proof.expires_at_utc),
    ) else {
        return false;
    };
    observed <= issued && issued < expires && verification_time_nanoseconds < expires.nanoseconds
}

fn project(
    parsed: ParsedInput<'_>,
    evidence: Evidence,
    phase: PhaseResult,
    authority: Option<AuthorityResult>,
) -> Result<VerifiedCampaignProjection, CampaignProjectionError> {
    let signatures = current_signatures_by_subject(authority.as_ref());
    let index = PlanIndex::new(&parsed.plan);
    let records_by_id = phase
        .records
        .iter()
        .map(|entry| (entry.receipt_id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let mut phase_state_counts = PhaseStateCounts::default();
    for record in &phase.records {
        match record.state.as_str() {
            "conflict" => phase_state_counts.conflict += 1,
            "current-nonpass" => phase_state_counts.current_nonpass += 1,
            "current-pass" => phase_state_counts.current_pass += 1,
            "stale" => phase_state_counts.stale += 1,
            "superseded" => phase_state_counts.superseded += 1,
            _ => return Err(failure("campaign_projection_phase_result_invalid")),
        }
    }

    let mut unplanned_current_receipt_ids = Vec::new();
    let mut unsigned_current_receipt_ids = Vec::new();
    let mut conflicting_objective_signature_subject_ids = Vec::new();
    let mut exact_by_id = BTreeMap::<String, ExactObjective>::new();
    for entry in &evidence.receipts {
        let receipt = &entry.receipt;
        if !OBJECTIVE_TYPES.contains(&receipt.receipt_type.as_str()) {
            continue;
        }
        let Some(record) = records_by_id.get(receipt.receipt_id.as_str()).copied() else {
            continue;
        };
        let matched = phase_match(&receipt.receipt_type, record, receipt, &index);
        let is_current = matches!(record.state.as_str(), "current-pass" | "current-nonpass");
        let Some(matched) = matched else {
            if is_current {
                unplanned_current_receipt_ids.push(receipt.receipt_id.clone());
            }
            continue;
        };
        exact_by_id.insert(
            receipt.receipt_id.clone(),
            ExactObjective {
                matched,
                receipt: receipt.clone(),
                record: record.clone(),
            },
        );
        if !is_current {
            continue;
        }
        let (role, scope) = objective_binding(&receipt.receipt_type)
            .ok_or_else(|| failure("campaign_projection_profile_invalid"))?;
        let expected = expected_signatures(&signatures, &receipt.receipt_id, role, scope);
        if expected.is_empty() {
            unsigned_current_receipt_ids.push(receipt.receipt_id.clone());
        }
        if expected.len() > 1 {
            conflicting_objective_signature_subject_ids.push(receipt.receipt_id.clone());
        }
    }
    unplanned_current_receipt_ids.sort();
    unsigned_current_receipt_ids.sort();
    conflicting_objective_signature_subject_ids.sort();

    let mut used_signature_ids = BTreeSet::new();
    let mut counted = CountedEvidenceMaps::default();
    for slot in &index.plan.models {
        let value = exact_by_id.values().find(|entry| {
            matches!(
                &entry.matched,
                ObjectiveMatch::Qualification { model_slot_id }
                    if model_slot_id == &slot.model_slot_id
            )
        });
        let Some(value) = value else {
            continue;
        };
        let Some(signature) = current_signed(Some(value), "qualification", &signatures) else {
            continue;
        };
        counted
            .qualification_by_model
            .insert(slot.model_slot_id.clone(), value.receipt.receipt_id.clone());
        used_signature_ids.insert(signature.signature_receipt_id.clone());
    }
    for round in &index.plan.browser_rounds {
        let value = exact_by_id.values().find(|entry| {
            matches!(
                &entry.matched,
                ObjectiveMatch::Browser { round_id } if round_id == &round.round_id
            )
        });
        let Some(value) = value else {
            continue;
        };
        let Some(signature) = current_signed(Some(value), "browser-round", &signatures) else {
            continue;
        };
        let Some(qualification_id) = counted.qualification_by_model.get(&round.model_slot_id)
        else {
            continue;
        };
        if !value.receipt.input_receipt_ids.contains(qualification_id) {
            continue;
        }
        counted
            .browser_by_round
            .insert(round.round_id.clone(), value.receipt.receipt_id.clone());
        used_signature_ids.insert(signature.signature_receipt_id.clone());
    }
    for memory in &index.plan.memory_rounds {
        let value = exact_by_id.values().find(|entry| {
            matches!(
                &entry.matched,
                ObjectiveMatch::Memory { memory_round_id }
                    if memory_round_id == &memory.memory_round_id
            )
        });
        let Some(value) = value else {
            continue;
        };
        let Some(signature) = current_signed(Some(value), "memory-continuity", &signatures) else {
            continue;
        };
        let Some(browser_id) = counted.browser_by_round.get(&memory.browser_round_id) else {
            continue;
        };
        if !value.receipt.input_receipt_ids.contains(browser_id) {
            continue;
        }
        counted.memory_by_round.insert(
            memory.memory_round_id.clone(),
            value.receipt.receipt_id.clone(),
        );
        used_signature_ids.insert(signature.signature_receipt_id.clone());
    }

    let mut conflicting_lane_ids = Vec::new();
    let verification_time = parse_utc(parsed.input.verification_time_utc)
        .map_err(|_| failure("campaign_projection_input_invalid"))?;
    if authority.is_some() {
        for lane in &index.plan.p2p_lanes {
            let slot = index
                .model_by_id
                .get(lane.model_slot_id.as_str())
                .ok_or_else(|| failure("campaign_projection_plan_index_invalid"))?;
            let mut candidates = Vec::<(&AuthoritySignature, &IdentitySubject)>::new();
            for subject in &evidence.subjects {
                if !exact_outside_proof(subject, lane, slot, verification_time.nanoseconds) {
                    continue;
                }
                for signature in expected_signatures(
                    &signatures,
                    &subject.subject_id,
                    "outside-network-observer",
                    "outside-proof",
                )
                .into_iter()
                .filter(|entry| entry.signed_schema == OUTSIDE_PROOF_SCHEMA)
                {
                    candidates.push((signature, subject));
                }
            }
            if candidates.len() > 1 {
                conflicting_lane_ids.push(lane.lane_id.clone());
            } else if let Some((signature, subject)) = candidates.first() {
                counted
                    .proof_by_lane
                    .insert(lane.lane_id.clone(), subject.subject_id.clone());
                used_signature_ids.insert(signature.signature_receipt_id.clone());
            }
        }
    }
    conflicting_lane_ids.sort();

    for announcement in &index.plan.announcements {
        let value = exact_by_id.values().find(|entry| {
            matches!(
                &entry.matched,
                ObjectiveMatch::Announcement { announcement_id }
                    if announcement_id == &announcement.announcement_id
            )
        });
        let Some(value) = value else {
            continue;
        };
        let Some(signature) = current_signed(Some(value), "catalog-announcement", &signatures)
        else {
            continue;
        };
        let Some(qualification_id) = counted
            .qualification_by_model
            .get(&announcement.model_slot_id)
        else {
            continue;
        };
        if !value.receipt.input_receipt_ids.contains(qualification_id)
            || index
                .plan
                .p2p_lanes
                .iter()
                .filter(|lane| lane.model_slot_id == announcement.model_slot_id)
                .any(|lane| !counted.proof_by_lane.contains_key(&lane.lane_id))
        {
            continue;
        }
        counted.announcement_by_model.insert(
            announcement.model_slot_id.clone(),
            value.receipt.receipt_id.clone(),
        );
        used_signature_ids.insert(signature.signature_receipt_id.clone());
    }

    let counts = projection_counts(&counted);
    let mut blocker_codes = projection_blockers(
        authority.as_ref(),
        &phase,
        &counts,
        &conflicting_lane_ids,
        &conflicting_objective_signature_subject_ids,
        &unplanned_current_receipt_ids,
        &unsigned_current_receipt_ids,
    );
    blocker_codes.sort();
    let complete = blocker_codes.is_empty();
    let blocked = authority.is_none()
        || !phase.conflicting_operation_identities.is_empty()
        || !conflicting_lane_ids.is_empty()
        || !conflicting_objective_signature_subject_ids.is_empty()
        || !unplanned_current_receipt_ids.is_empty();
    let current_operation = current_operation(authority.is_some(), &index, &counted, complete);
    let result = ProjectionResult {
        authority_status: if authority.is_some() {
            "verified".to_owned()
        } else {
            "unavailable".to_owned()
        },
        authority_terminal_registry_receipt_id: authority
            .as_ref()
            .map(|value| value.terminal_registry_receipt_id.clone()),
        blocker_codes,
        campaign_id: parsed.input.expected_campaign_id.to_owned(),
        campaign_plan_id: parsed.finalized_plan.plan_id().to_owned(),
        campaign_plan_sha256: parsed.finalized_plan.plan_sha256_hex(),
        complete,
        conflicting_lane_ids,
        conflicting_objective_signature_subject_ids,
        conflicting_operation_identities: phase.conflicting_operation_identities,
        counted_evidence: counted_evidence(&counted, &used_signature_ids),
        counts,
        current_operation,
        environment: parsed.input.expected_environment.to_owned(),
        objective_receipt_count: evidence
            .receipts
            .iter()
            .filter(|entry| OBJECTIVE_TYPES.contains(&entry.receipt.receipt_type.as_str()))
            .count(),
        objective_signature_count: used_signature_ids.len(),
        phase_receipt_count: phase.receipt_count,
        phase_state_counts,
        profile_id: CAMPAIGN_PROJECTION_PROFILE_ID.to_owned(),
        profile_sha256: CAMPAIGN_PROJECTION_PROFILE_SHA256.to_owned(),
        resumable_state: if complete {
            "complete"
        } else if blocked {
            "blocked"
        } else {
            "resumable"
        }
        .to_owned(),
        schema: CAMPAIGN_PROJECTION_RESULT_SCHEMA.to_owned(),
        unplanned_current_receipt_ids,
        unsigned_current_receipt_ids,
        verification_time_utc: parsed.input.verification_time_utc.to_owned(),
    };
    finalize_result(&result)
}

fn projection_counts(counted: &CountedEvidenceMaps) -> ProjectionCounts {
    ProjectionCounts {
        announced_models: CountValue {
            current: counted.announcement_by_model.len(),
            target: CAMPAIGN_ANNOUNCEMENT_COUNT,
        },
        clean_browser_rounds: CountValue {
            current: counted.browser_by_round.len(),
            target: CAMPAIGN_BROWSER_ROUND_COUNT,
        },
        live_memory_rounds: CountValue {
            current: counted.memory_by_round.len(),
            target: CAMPAIGN_MEMORY_ROUND_COUNT,
        },
        outside_proven_lanes: CountValue {
            current: counted.proof_by_lane.len(),
            target: CAMPAIGN_P2P_LANE_COUNT,
        },
        qualified_models: CountValue {
            current: counted.qualification_by_model.len(),
            target: CAMPAIGN_MODEL_COUNT,
        },
    }
}

fn projection_blockers(
    authority: Option<&AuthorityResult>,
    phase: &PhaseResult,
    counts: &ProjectionCounts,
    conflicting_lane_ids: &[String],
    conflicting_objective_signature_subject_ids: &[String],
    unplanned_current_receipt_ids: &[String],
    unsigned_current_receipt_ids: &[String],
) -> Vec<String> {
    let mut blockers = Vec::new();
    if authority.is_none() {
        blockers.push("authority_graph_unavailable");
    } else if authority.is_some_and(|value| !value.terminal_registry_current) {
        blockers.push("authority_registry_not_current");
    }
    if !phase.conflicting_operation_identities.is_empty() {
        blockers.push("phase_conflicts_detected");
    }
    if !conflicting_lane_ids.is_empty() {
        blockers.push("outside_proof_conflicts");
    }
    if !conflicting_objective_signature_subject_ids.is_empty() {
        blockers.push("objective_signature_conflicts");
    }
    if !unplanned_current_receipt_ids.is_empty() {
        blockers.push("unplanned_current_objective_evidence");
    }
    if !unsigned_current_receipt_ids.is_empty() {
        blockers.push("unsigned_current_objective_evidence");
    }
    if counts.qualified_models.current != CAMPAIGN_MODEL_COUNT {
        blockers.push("qualified_models_incomplete");
    }
    if counts.clean_browser_rounds.current != CAMPAIGN_BROWSER_ROUND_COUNT {
        blockers.push("clean_browser_rounds_incomplete");
    }
    if counts.live_memory_rounds.current != CAMPAIGN_MEMORY_ROUND_COUNT {
        blockers.push("live_memory_rounds_incomplete");
    }
    if counts.outside_proven_lanes.current != CAMPAIGN_P2P_LANE_COUNT {
        blockers.push("outside_proofs_incomplete");
    }
    if counts.announced_models.current != CAMPAIGN_ANNOUNCEMENT_COUNT {
        blockers.push("catalog_announcements_incomplete");
    }
    blockers.into_iter().map(str::to_owned).collect()
}

fn current_operation(
    authority_available: bool,
    index: &PlanIndex<'_>,
    counted: &CountedEvidenceMaps,
    complete: bool,
) -> CurrentOperation {
    if complete {
        return CurrentOperation {
            operation_id: None,
            phase: None,
            state: "complete".to_owned(),
        };
    }
    if !authority_available {
        return CurrentOperation {
            operation_id: None,
            phase: None,
            state: "blocked".to_owned(),
        };
    }
    if let Some(model) = index.plan.models.iter().find(|entry| {
        !counted
            .qualification_by_model
            .contains_key(&entry.model_slot_id)
    }) {
        return pending_operation("qualification", &model.qualification_operation_id);
    }
    if let Some(round) = index
        .plan
        .browser_rounds
        .iter()
        .find(|entry| !counted.browser_by_round.contains_key(&entry.round_id))
    {
        return pending_operation("browser-round", &round.operation_id);
    }
    if let Some(memory) = index
        .plan
        .memory_rounds
        .iter()
        .find(|entry| !counted.memory_by_round.contains_key(&entry.memory_round_id))
    {
        return pending_operation("memory-continuity", &memory.operation_id);
    }
    if let Some(lane) = index
        .plan
        .p2p_lanes
        .iter()
        .find(|entry| !counted.proof_by_lane.contains_key(&entry.lane_id))
    {
        return pending_operation("outside-proof", &lane.lane_id);
    }
    if let Some(announcement) = index.plan.announcements.iter().find(|entry| {
        !counted
            .announcement_by_model
            .contains_key(&entry.model_slot_id)
    }) {
        return pending_operation("catalog-announcement", &announcement.operation_id);
    }
    CurrentOperation {
        operation_id: None,
        phase: None,
        state: "blocked".to_owned(),
    }
}

fn pending_operation(phase: &str, operation_id: &str) -> CurrentOperation {
    CurrentOperation {
        operation_id: Some(operation_id.to_owned()),
        phase: Some(phase.to_owned()),
        state: "pending".to_owned(),
    }
}

fn counted_evidence(
    counted: &CountedEvidenceMaps,
    signature_ids: &BTreeSet<String>,
) -> CountedEvidence {
    fn sorted_values(values: &BTreeMap<String, String>) -> Vec<String> {
        let mut result = values.values().cloned().collect::<Vec<_>>();
        result.sort();
        result
    }
    CountedEvidence {
        announced_model_receipt_ids: sorted_values(&counted.announcement_by_model),
        browser_round_receipt_ids: sorted_values(&counted.browser_by_round),
        memory_round_receipt_ids: sorted_values(&counted.memory_by_round),
        outside_proof_subject_ids: sorted_values(&counted.proof_by_lane),
        qualification_receipt_ids: sorted_values(&counted.qualification_by_model),
        signature_receipt_ids: signature_ids.iter().cloned().collect(),
    }
}

fn finalize_result(
    result: &ProjectionResult,
) -> Result<VerifiedCampaignProjection, CampaignProjectionError> {
    let value =
        serde_json::to_value(result).map_err(|_| failure("campaign_projection_result_invalid"))?;
    let bytes =
        canonical_value_bytes(&value).map_err(|_| failure("campaign_projection_result_invalid"))?;
    if bytes.len() > MAXIMUM_RESULT_BYTES {
        return Err(failure("campaign_projection_result_byte_limit"));
    }
    let sha256 = lowercase_hex(&Sha256::digest(&bytes));
    Ok(VerifiedCampaignProjection { bytes, sha256 })
}

/// Validates one canonical campaign-projection result against its exact campaign plan.
pub fn validate_campaign_projection_result(
    result_bytes: &[u8],
    campaign_plan_bytes: &[u8],
) -> Result<VerifiedCampaignProjection, CampaignProjectionError> {
    if result_bytes.is_empty() || result_bytes.len() > MAXIMUM_RESULT_BYTES {
        return Err(failure("campaign_projection_result_byte_limit"));
    }
    let value: Value = serde_json::from_slice(result_bytes)
        .map_err(|_| failure("campaign_projection_result_json_invalid"))?;
    let canonical = canonical_value_bytes(&value)
        .map_err(|_| failure("campaign_projection_result_json_invalid"))?;
    if canonical != result_bytes {
        return Err(failure("campaign_projection_result_wire_not_canonical"));
    }
    if !exact_fields(&value, RESULT_FIELDS) {
        return Err(failure("campaign_projection_result_fields_invalid"));
    }
    let result: ProjectionResult = serde_json::from_value(value)
        .map_err(|_| failure("campaign_projection_result_fields_invalid"))?;
    let (plan_result, plan) = validate_projection_plan(campaign_plan_bytes)?;
    validate_result(&result, &plan_result, &plan)?;
    Ok(VerifiedCampaignProjection {
        sha256: lowercase_hex(&Sha256::digest(&canonical)),
        bytes: canonical,
    })
}

fn validate_result(
    result: &ProjectionResult,
    plan_result: &FinalizedCampaignPlan,
    plan: &CampaignPlanWire,
) -> Result<(), CampaignProjectionError> {
    if result.schema != CAMPAIGN_PROJECTION_RESULT_SCHEMA
        || result.profile_id != CAMPAIGN_PROJECTION_PROFILE_ID
        || result.profile_sha256 != CAMPAIGN_PROJECTION_PROFILE_SHA256
        || result.campaign_id != plan.campaign_id
        || result.environment != plan.environment
        || result.campaign_plan_id != plan.plan_id
        || result.campaign_plan_sha256 != plan_result.plan_sha256_hex()
    {
        return Err(failure("campaign_projection_result_plan_mismatch"));
    }
    if parse_utc(&result.verification_time_utc).is_err() {
        return Err(failure("campaign_projection_result_time_invalid"));
    }
    if !matches!(result.authority_status.as_str(), "unavailable" | "verified")
        || result.authority_status == "unavailable"
            && result.authority_terminal_registry_receipt_id.is_some()
        || result.authority_status == "verified"
            && result
                .authority_terminal_registry_receipt_id
                .as_deref()
                .is_none_or(|value| !valid_content_id(value))
    {
        return Err(failure("campaign_projection_result_authority_invalid"));
    }
    validate_counts(&result.counts)?;
    validate_counted_evidence(result)?;
    validate_totals(result)?;
    validate_phase_state_counts(result)?;
    validate_result_id_sets(result)?;
    validate_blockers(result)?;
    validate_state(result)?;
    validate_operation(result, plan)
}

fn validate_counts(counts: &ProjectionCounts) -> Result<(), CampaignProjectionError> {
    let values = [
        (&counts.announced_models, CAMPAIGN_ANNOUNCEMENT_COUNT),
        (&counts.clean_browser_rounds, CAMPAIGN_BROWSER_ROUND_COUNT),
        (&counts.live_memory_rounds, CAMPAIGN_MEMORY_ROUND_COUNT),
        (&counts.outside_proven_lanes, CAMPAIGN_P2P_LANE_COUNT),
        (&counts.qualified_models, CAMPAIGN_MODEL_COUNT),
    ];
    if values
        .iter()
        .any(|(count, target)| count.target != *target || count.current > *target)
        || counts.live_memory_rounds.current > counts.clean_browser_rounds.current
        || counts.announced_models.current > counts.qualified_models.current
        || counts.announced_models.current * 2 > counts.outside_proven_lanes.current
    {
        return Err(failure("campaign_projection_result_counts_invalid"));
    }
    Ok(())
}

fn validate_counted_evidence(result: &ProjectionResult) -> Result<(), CampaignProjectionError> {
    let evidence = &result.counted_evidence;
    let valid = sorted_unique(
        &evidence.announced_model_receipt_ids,
        CAMPAIGN_ANNOUNCEMENT_COUNT,
        valid_content_id,
    ) && sorted_unique(
        &evidence.browser_round_receipt_ids,
        CAMPAIGN_BROWSER_ROUND_COUNT,
        valid_content_id,
    ) && sorted_unique(
        &evidence.memory_round_receipt_ids,
        CAMPAIGN_MEMORY_ROUND_COUNT,
        valid_content_id,
    ) && sorted_unique(
        &evidence.outside_proof_subject_ids,
        CAMPAIGN_P2P_LANE_COUNT,
        valid_content_id,
    ) && sorted_unique(
        &evidence.qualification_receipt_ids,
        CAMPAIGN_MODEL_COUNT,
        valid_content_id,
    ) && sorted_unique(
        &evidence.signature_receipt_ids,
        MAXIMUM_RECEIPTS,
        valid_content_id,
    );
    if !valid {
        return Err(failure("campaign_projection_result_evidence_invalid"));
    }
    if evidence.announced_model_receipt_ids.len() != result.counts.announced_models.current
        || evidence.browser_round_receipt_ids.len() != result.counts.clean_browser_rounds.current
        || evidence.memory_round_receipt_ids.len() != result.counts.live_memory_rounds.current
        || evidence.outside_proof_subject_ids.len() != result.counts.outside_proven_lanes.current
        || evidence.qualification_receipt_ids.len() != result.counts.qualified_models.current
    {
        return Err(failure("campaign_projection_result_counts_invalid"));
    }
    let receipt_ids = evidence
        .announced_model_receipt_ids
        .iter()
        .chain(evidence.browser_round_receipt_ids.iter())
        .chain(evidence.memory_round_receipt_ids.iter())
        .chain(evidence.qualification_receipt_ids.iter())
        .collect::<Vec<_>>();
    let objective_count = result.counts.announced_models.current
        + result.counts.clean_browser_rounds.current
        + result.counts.live_memory_rounds.current
        + result.counts.outside_proven_lanes.current
        + result.counts.qualified_models.current;
    if receipt_ids.iter().copied().collect::<BTreeSet<_>>().len() != receipt_ids.len()
        || evidence.signature_receipt_ids.len() != objective_count
    {
        return Err(failure("campaign_projection_result_evidence_invalid"));
    }
    Ok(())
}

fn validate_totals(result: &ProjectionResult) -> Result<(), CampaignProjectionError> {
    let counted_receipts = result.counted_evidence.announced_model_receipt_ids.len()
        + result.counted_evidence.browser_round_receipt_ids.len()
        + result.counted_evidence.memory_round_receipt_ids.len()
        + result.counted_evidence.qualification_receipt_ids.len();
    if result.objective_receipt_count > MAXIMUM_RECEIPTS
        || result.objective_signature_count > MAXIMUM_RECEIPTS
        || result.phase_receipt_count > MAXIMUM_RECEIPTS
        || result.objective_receipt_count < counted_receipts
        || result.objective_signature_count != result.counted_evidence.signature_receipt_ids.len()
        || result.phase_receipt_count < result.objective_receipt_count
    {
        return Err(failure("campaign_projection_result_totals_invalid"));
    }
    Ok(())
}

fn validate_phase_state_counts(result: &ProjectionResult) -> Result<(), CampaignProjectionError> {
    let values = [
        result.phase_state_counts.conflict,
        result.phase_state_counts.current_nonpass,
        result.phase_state_counts.current_pass,
        result.phase_state_counts.stale,
        result.phase_state_counts.superseded,
    ];
    if values.iter().any(|value| *value > MAXIMUM_RECEIPTS)
        || values.iter().sum::<usize>() != result.phase_receipt_count
    {
        return Err(failure("campaign_projection_result_phase_counts_invalid"));
    }
    Ok(())
}

fn validate_result_id_sets(result: &ProjectionResult) -> Result<(), CampaignProjectionError> {
    if !sorted_unique(
        &result.conflicting_operation_identities,
        MAXIMUM_RECEIPTS,
        valid_content_id,
    ) || !sorted_unique(
        &result.conflicting_lane_ids,
        CAMPAIGN_P2P_LANE_COUNT,
        valid_safe_id,
    ) || !sorted_unique(
        &result.conflicting_objective_signature_subject_ids,
        MAXIMUM_RECEIPTS,
        valid_content_id,
    ) {
        return Err(failure("campaign_projection_result_conflicts_invalid"));
    }
    if !sorted_unique(
        &result.unsigned_current_receipt_ids,
        MAXIMUM_RECEIPTS,
        valid_content_id,
    ) || !sorted_unique(
        &result.unplanned_current_receipt_ids,
        MAXIMUM_RECEIPTS,
        valid_content_id,
    ) {
        return Err(failure("campaign_projection_result_current_ids_invalid"));
    }
    Ok(())
}

fn validate_blockers(result: &ProjectionResult) -> Result<(), CampaignProjectionError> {
    if !sorted_unique(
        &result.blocker_codes,
        BLOCKER_CODES.len(),
        valid_blocker_code,
    ) || result
        .blocker_codes
        .iter()
        .any(|code| !BLOCKER_CODES.contains(&code.as_str()))
    {
        return Err(failure("campaign_projection_result_blockers_invalid"));
    }
    let blockers = result
        .blocker_codes
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    let matches = |code: &str, condition: bool| blockers.contains(code) == condition;
    if !matches(
        "authority_graph_unavailable",
        result.authority_status == "unavailable",
    ) || blockers.contains("authority_registry_not_current")
        && result.authority_status != "verified"
        || !matches(
            "phase_conflicts_detected",
            !result.conflicting_operation_identities.is_empty(),
        )
        || !matches(
            "outside_proof_conflicts",
            !result.conflicting_lane_ids.is_empty(),
        )
        || !matches(
            "objective_signature_conflicts",
            !result
                .conflicting_objective_signature_subject_ids
                .is_empty(),
        )
        || !matches(
            "unplanned_current_objective_evidence",
            !result.unplanned_current_receipt_ids.is_empty(),
        )
        || !matches(
            "unsigned_current_objective_evidence",
            !result.unsigned_current_receipt_ids.is_empty(),
        )
        || !matches(
            "qualified_models_incomplete",
            result.counts.qualified_models.current != CAMPAIGN_MODEL_COUNT,
        )
        || !matches(
            "clean_browser_rounds_incomplete",
            result.counts.clean_browser_rounds.current != CAMPAIGN_BROWSER_ROUND_COUNT,
        )
        || !matches(
            "live_memory_rounds_incomplete",
            result.counts.live_memory_rounds.current != CAMPAIGN_MEMORY_ROUND_COUNT,
        )
        || !matches(
            "outside_proofs_incomplete",
            result.counts.outside_proven_lanes.current != CAMPAIGN_P2P_LANE_COUNT,
        )
        || !matches(
            "catalog_announcements_incomplete",
            result.counts.announced_models.current != CAMPAIGN_ANNOUNCEMENT_COUNT,
        )
    {
        return Err(failure("campaign_projection_result_blockers_invalid"));
    }
    Ok(())
}

fn validate_state(result: &ProjectionResult) -> Result<(), CampaignProjectionError> {
    if !matches!(
        result.resumable_state.as_str(),
        "blocked" | "complete" | "resumable"
    ) {
        return Err(failure("campaign_projection_result_state_invalid"));
    }
    let all_targets_reached = result.counts.announced_models.current == CAMPAIGN_ANNOUNCEMENT_COUNT
        && result.counts.clean_browser_rounds.current == CAMPAIGN_BROWSER_ROUND_COUNT
        && result.counts.live_memory_rounds.current == CAMPAIGN_MEMORY_ROUND_COUNT
        && result.counts.outside_proven_lanes.current == CAMPAIGN_P2P_LANE_COUNT
        && result.counts.qualified_models.current == CAMPAIGN_MODEL_COUNT;
    if result.complete != (all_targets_reached && result.blocker_codes.is_empty()) {
        return Err(failure("campaign_projection_result_state_invalid"));
    }
    let structurally_blocked = result.authority_status == "unavailable"
        || !result.conflicting_operation_identities.is_empty()
        || !result.conflicting_lane_ids.is_empty()
        || !result
            .conflicting_objective_signature_subject_ids
            .is_empty()
        || !result.unplanned_current_receipt_ids.is_empty();
    let expected = if result.complete {
        "complete"
    } else if structurally_blocked {
        "blocked"
    } else {
        "resumable"
    };
    if result.resumable_state != expected {
        return Err(failure("campaign_projection_result_state_invalid"));
    }
    Ok(())
}

fn validate_operation(
    result: &ProjectionResult,
    plan: &CampaignPlanWire,
) -> Result<(), CampaignProjectionError> {
    if !matches!(
        result.current_operation.state.as_str(),
        "blocked" | "complete" | "pending"
    ) {
        return Err(failure("campaign_projection_result_operation_invalid"));
    }
    let planned = plan
        .models
        .iter()
        .map(|entry| (entry.qualification_operation_id.as_str(), "qualification"))
        .chain(
            plan.browser_rounds
                .iter()
                .map(|entry| (entry.operation_id.as_str(), "browser-round")),
        )
        .chain(
            plan.memory_rounds
                .iter()
                .map(|entry| (entry.operation_id.as_str(), "memory-continuity")),
        )
        .chain(
            plan.p2p_lanes
                .iter()
                .map(|entry| (entry.lane_id.as_str(), "outside-proof")),
        )
        .chain(
            plan.announcements
                .iter()
                .map(|entry| (entry.operation_id.as_str(), "catalog-announcement")),
        )
        .collect::<BTreeMap<_, _>>();
    if result.current_operation.state == "pending" {
        let valid = result
            .current_operation
            .operation_id
            .as_deref()
            .zip(result.current_operation.phase.as_deref())
            .is_some_and(|(operation, phase)| planned.get(operation) == Some(&phase));
        if !valid {
            return Err(failure("campaign_projection_result_operation_invalid"));
        }
        return Ok(());
    }
    let all_targets_reached = result.counts.announced_models.current == CAMPAIGN_ANNOUNCEMENT_COUNT
        && result.counts.clean_browser_rounds.current == CAMPAIGN_BROWSER_ROUND_COUNT
        && result.counts.live_memory_rounds.current == CAMPAIGN_MEMORY_ROUND_COUNT
        && result.counts.outside_proven_lanes.current == CAMPAIGN_P2P_LANE_COUNT
        && result.counts.qualified_models.current == CAMPAIGN_MODEL_COUNT;
    if result.current_operation.operation_id.is_some()
        || result.current_operation.phase.is_some()
        || (result.current_operation.state == "complete") != result.complete
        || result.current_operation.state == "blocked"
            && !all_targets_reached
            && result.authority_status != "unavailable"
    {
        return Err(failure("campaign_projection_result_operation_invalid"));
    }
    Ok(())
}

fn sorted_unique(values: &[String], maximum: usize, predicate: impl Fn(&str) -> bool) -> bool {
    values.len() <= maximum
        && values.iter().all(|value| predicate(value))
        && values.windows(2).all(|pair| pair[0] < pair[1])
}

fn valid_blocker_code(value: &str) -> bool {
    let bytes = value.as_bytes();
    (3..=80).contains(&bytes.len())
        && bytes[0].is_ascii_lowercase()
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'_')
}

const fn failure(code: &'static str) -> CampaignProjectionError {
    CampaignProjectionError { code }
}
