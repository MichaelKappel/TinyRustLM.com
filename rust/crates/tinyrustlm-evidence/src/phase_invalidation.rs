use crate::receipt::{
    canonical_value_bytes, domain_digest, lowercase_hex, valid_safe_id, validate_receipt_bytes,
    Receipt,
};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;

/// The one current semantic phase-invalidation profile identity.
pub const PHASE_INVALIDATION_PROFILE_ID: &str = "tinyrustlm.vnext.phase-invalidation.v1";
/// The SHA-256 of the exact frozen phase-invalidation profile bytes.
pub const PHASE_INVALIDATION_PROFILE_SHA256: &str =
    "4f9c0f02f9e7fc55c2793ca9bbf9edd9e659b5737cc23eda98e40cc675074875";
/// The one current semantic phase-invalidation result schema.
pub const PHASE_INVALIDATION_RESULT_SCHEMA: &str = "tinyrustlm.vnext.phase_invalidation_result.v1";

const OPERATION_IDENTITY_DOMAIN: &str = "tinyrustlm.phase-operation.identity.v1";
const MATERIAL_IDENTITY_DOMAIN: &str = "tinyrustlm.phase-material.identity.v1";
const RECEIPT_SET_IDENTITY_DOMAIN: &str = "tinyrustlm.phase-receipt-set.identity.v1";
const MAXIMUM_RECEIPTS: usize = 2048;
const MAXIMUM_RECEIPT_BYTES: usize = 262_144;
const MAXIMUM_TOTAL_RECEIPT_BYTES: usize = 67_108_864;
const MAXIMUM_GRAPH_EDGES: usize = 32_768;
const MAXIMUM_OPERATION_HEADS: usize = 64;
const MAXIMUM_RESULT_BYTES: usize = 4_194_304;
const SUPPORTED_RECEIPT_TYPES: &[&str] = &[
    "acquisition",
    "browser-round",
    "catalog-announcement",
    "conversation-evaluation",
    "conversion",
    "deployment",
    "discovery",
    "final-attestation",
    "lane-serve",
    "memory-continuity",
    "native-evaluation",
    "outside-proof",
    "p2p-preparation",
    "package",
    "public-readback",
    "qualification",
    "redaction-scan",
    "review",
    "screening",
    "site-synchronization",
    "structure",
    "training",
    "training-preparation",
];

/// A bounded semantic-currentness failure with a stable public-safe code.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PhaseInvalidationError {
    code: &'static str,
}

impl PhaseInvalidationError {
    /// Returns the stable public-safe failure code.
    pub fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for PhaseInvalidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for PhaseInvalidationError {}

/// One independently classified, canonical semantic-currentness result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinalizedPhaseInvalidation {
    bytes: Vec<u8>,
    sha256: String,
}

impl FinalizedPhaseInvalidation {
    /// Returns the exact canonical result bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Returns an independent owned copy of the canonical result bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.bytes.clone()
    }

    /// Returns the lowercase SHA-256 of the complete canonical result wire.
    pub fn sha256(&self) -> &str {
        &self.sha256
    }
}

#[derive(Clone)]
struct PhaseRecord {
    material_identity: String,
    operation_id: String,
    operation_identity: String,
    receipt: Receipt,
    subject_id: String,
}

#[derive(Clone, Copy)]
struct Classification {
    reason_code: Option<&'static str>,
    state: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputRecord<'a> {
    input_receipt_ids: &'a [String],
    material_identity: &'a str,
    operation_id: &'a str,
    operation_identity: &'a str,
    phase: &'a str,
    reason_code: Option<&'static str>,
    receipt_id: &'a str,
    receipt_type: &'a str,
    source_status: &'a str,
    state: &'static str,
    subject_id: &'a str,
    supersedes_receipt_ids: &'a [String],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PhaseResult<'a> {
    campaign_id: &'a str,
    conflicting_operation_identities: &'a [String],
    current_phase_receipt_ids: &'a [String],
    eligible_pass_phase_receipt_ids: &'a [String],
    health: &'static str,
    profile_id: &'static str,
    profile_sha256: &'static str,
    receipt_count: usize,
    receipt_set_sha256: &'a str,
    records: &'a [OutputRecord<'a>],
    retained_historical_receipt_ids: &'a [String],
    schema: &'static str,
    total_receipt_bytes: usize,
}

/// Classifies exact canonical receipt bytes under the frozen semantic-currentness profile.
pub fn classify_phase_receipts(
    campaign_id: &str,
    receipt_bytes: &[Vec<u8>],
) -> Result<FinalizedPhaseInvalidation, PhaseInvalidationError> {
    if !valid_safe_id(campaign_id) {
        return Err(failure("phase_campaign_invalid"));
    }
    if receipt_bytes.is_empty() || receipt_bytes.len() > MAXIMUM_RECEIPTS {
        return Err(failure("phase_receipt_count_invalid"));
    }

    let mut total_receipt_bytes = 0usize;
    let mut by_id = BTreeMap::<String, PhaseRecord>::new();
    for bytes in receipt_bytes {
        if bytes.is_empty() || bytes.len() > MAXIMUM_RECEIPT_BYTES {
            return Err(failure("phase_receipt_byte_limit"));
        }
        total_receipt_bytes = total_receipt_bytes
            .checked_add(bytes.len())
            .ok_or_else(|| failure("phase_receipt_total_byte_limit"))?;
        if total_receipt_bytes > MAXIMUM_TOTAL_RECEIPT_BYTES {
            return Err(failure("phase_receipt_total_byte_limit"));
        }
        let receipt =
            validate_receipt_bytes(bytes).map_err(|_| failure("phase_receipt_invalid"))?;
        if receipt.campaign_id != campaign_id {
            return Err(failure("phase_receipt_campaign_mismatch"));
        }
        if !SUPPORTED_RECEIPT_TYPES.contains(&receipt.receipt_type.as_str()) {
            return Err(failure("phase_receipt_type_invalid"));
        }
        let phase_identity = phase_identity(&receipt)?;
        let receipt_id = receipt.receipt_id.clone();
        if by_id
            .insert(
                receipt_id,
                PhaseRecord {
                    material_identity: phase_identity.material_identity,
                    operation_id: phase_identity.operation_id,
                    operation_identity: phase_identity.operation_identity,
                    receipt,
                    subject_id: phase_identity.subject_id,
                },
            )
            .is_some()
        {
            return Err(failure("phase_receipt_duplicate"));
        }
    }

    validate_graph(&by_id)?;
    topological_order(&by_id, EdgeKind::Dependency)?;
    topological_order(&by_id, EdgeKind::Supersession)?;
    topological_order(&by_id, EdgeKind::Combined)?;

    let superseded = by_id
        .values()
        .flat_map(|record| record.receipt.supersedes_receipt_ids.iter().cloned())
        .collect::<BTreeSet<_>>();
    let mut heads_by_operation = BTreeMap::<String, Vec<String>>::new();
    for (receipt_id, record) in &by_id {
        if !superseded.contains(receipt_id) {
            heads_by_operation
                .entry(record.operation_identity.clone())
                .or_default()
                .push(receipt_id.clone());
        }
    }

    let mut states = BTreeMap::<String, Classification>::new();
    for receipt_id in &superseded {
        states.insert(
            receipt_id.clone(),
            Classification {
                reason_code: Some("explicit-supersession"),
                state: "superseded",
            },
        );
    }
    let mut conflicting_operation_identities = Vec::new();
    for (operation_identity, heads) in &mut heads_by_operation {
        heads.sort();
        if heads.len() > MAXIMUM_OPERATION_HEADS {
            return Err(failure("phase_operation_head_limit"));
        }
        if heads.len() > 1 {
            conflicting_operation_identities.push(operation_identity.clone());
            for receipt_id in heads {
                states.insert(
                    receipt_id.clone(),
                    Classification {
                        reason_code: Some("unresolved-operation-heads"),
                        state: "conflict",
                    },
                );
            }
        }
    }

    for receipt_id in topological_order(&by_id, EdgeKind::Dependency)? {
        if states.contains_key(&receipt_id) {
            continue;
        }
        let record = by_id
            .get(&receipt_id)
            .ok_or_else(|| failure("phase_receipt_graph_invalid"))?;
        let parent_states = record
            .receipt
            .input_receipt_ids
            .iter()
            .map(|parent_id| {
                states
                    .get(parent_id)
                    .copied()
                    .ok_or_else(|| failure("phase_receipt_graph_invalid"))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let classification = if parent_states
            .iter()
            .any(|parent| !matches!(parent.state, "current-pass" | "current-nonpass"))
        {
            Classification {
                reason_code: Some("noncurrent-ancestor"),
                state: "stale",
            }
        } else if parent_states
            .iter()
            .any(|parent| parent.state == "current-nonpass")
        {
            Classification {
                reason_code: Some("nonpass-ancestor"),
                state: "stale",
            }
        } else {
            Classification {
                reason_code: None,
                state: if is_nonpass_status(&record.receipt.status) {
                    "current-nonpass"
                } else {
                    "current-pass"
                },
            }
        };
        states.insert(receipt_id, classification);
    }

    finalize_result(
        campaign_id,
        &by_id,
        &states,
        conflicting_operation_identities,
        total_receipt_bytes,
    )
}

struct PhaseIdentity {
    material_identity: String,
    operation_id: String,
    operation_identity: String,
    subject_id: String,
}

fn phase_identity(receipt: &Receipt) -> Result<PhaseIdentity, PhaseInvalidationError> {
    let operation_id = parameter(receipt, "operation_id")?;
    let subject_id = parameter(receipt, "subject_id")?;
    let operation_value = json!({
        "campaignId": receipt.campaign_id,
        "operation_id": operation_id,
        "phase": receipt.phase,
        "receiptType": receipt.receipt_type,
        "subject_id": subject_id,
    });
    let operation_identity = content_identity(OPERATION_IDENTITY_DOMAIN, &operation_value)?;
    let material_value = json!({
        "configurationSha256": receipt.configuration_sha256,
        "inputHashes": receipt.input_hashes,
        "inputReceiptIds": receipt.input_receipt_ids,
        "operationIdentity": operation_identity,
        "runtime": receipt.runtime,
        "sourceRevision": receipt.source_revision,
        "tools": receipt.tools,
    });
    let material_identity = content_identity(MATERIAL_IDENTITY_DOMAIN, &material_value)?;
    Ok(PhaseIdentity {
        material_identity,
        operation_id: operation_id.to_owned(),
        operation_identity,
        subject_id: subject_id.to_owned(),
    })
}

fn parameter<'a>(receipt: &'a Receipt, name: &str) -> Result<&'a str, PhaseInvalidationError> {
    let value = receipt
        .public_parameters
        .iter()
        .find(|parameter| parameter.name == name)
        .map(|parameter| parameter.value.as_str())
        .ok_or_else(|| failure("phase_receipt_parameters_invalid"))?;
    if !valid_safe_id(value) {
        return Err(failure("phase_receipt_parameters_invalid"));
    }
    Ok(value)
}

fn validate_graph(by_id: &BTreeMap<String, PhaseRecord>) -> Result<(), PhaseInvalidationError> {
    let mut edge_count = 0usize;
    for record in by_id.values() {
        let dependencies = record
            .receipt
            .input_receipt_ids
            .iter()
            .collect::<BTreeSet<_>>();
        for target_id in record
            .receipt
            .input_receipt_ids
            .iter()
            .chain(record.receipt.supersedes_receipt_ids.iter())
        {
            edge_count = edge_count
                .checked_add(1)
                .ok_or_else(|| failure("phase_receipt_graph_invalid"))?;
            if edge_count > MAXIMUM_GRAPH_EDGES || !by_id.contains_key(target_id) {
                return Err(failure("phase_receipt_graph_invalid"));
            }
        }
        for target_id in &record.receipt.supersedes_receipt_ids {
            if dependencies.contains(target_id) {
                return Err(failure("phase_supersession_dependency_overlap"));
            }
            if by_id
                .get(target_id)
                .is_none_or(|target| target.operation_identity != record.operation_identity)
            {
                return Err(failure("phase_supersession_operation_mismatch"));
            }
        }
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum EdgeKind {
    Combined,
    Dependency,
    Supersession,
}

fn topological_order(
    by_id: &BTreeMap<String, PhaseRecord>,
    edge_kind: EdgeKind,
) -> Result<Vec<String>, PhaseInvalidationError> {
    let mut indegree = by_id
        .keys()
        .map(|receipt_id| (receipt_id.clone(), 0usize))
        .collect::<BTreeMap<_, _>>();
    let mut dependents = by_id
        .keys()
        .map(|receipt_id| (receipt_id.clone(), Vec::<String>::new()))
        .collect::<BTreeMap<_, _>>();
    let mut edge_count = 0usize;
    for (receipt_id, record) in by_id {
        for parent_id in selected_edges(record, edge_kind) {
            edge_count += 1;
            if edge_count > MAXIMUM_GRAPH_EDGES {
                return Err(failure("phase_receipt_graph_edge_limit"));
            }
            *indegree
                .get_mut(receipt_id)
                .ok_or_else(|| failure("phase_receipt_graph_invalid"))? += 1;
            dependents
                .get_mut(parent_id)
                .ok_or_else(|| failure("phase_receipt_graph_invalid"))?
                .push(receipt_id.clone());
        }
    }
    for values in dependents.values_mut() {
        values.sort();
    }
    let mut ready = indegree
        .iter()
        .filter(|(_, value)| **value == 0)
        .map(|(receipt_id, _)| receipt_id.clone())
        .collect::<BTreeSet<_>>();
    let mut ordered = Vec::with_capacity(by_id.len());
    while let Some(receipt_id) = ready.pop_first() {
        ordered.push(receipt_id.clone());
        for dependent in dependents
            .get(&receipt_id)
            .ok_or_else(|| failure("phase_receipt_graph_invalid"))?
        {
            let value = indegree
                .get_mut(dependent)
                .ok_or_else(|| failure("phase_receipt_graph_invalid"))?;
            *value -= 1;
            if *value == 0 {
                ready.insert(dependent.clone());
            }
        }
    }
    if ordered.len() != by_id.len() {
        return Err(failure("phase_receipt_graph_invalid"));
    }
    Ok(ordered)
}

fn selected_edges(record: &PhaseRecord, edge_kind: EdgeKind) -> Vec<&String> {
    match edge_kind {
        EdgeKind::Dependency => record.receipt.input_receipt_ids.iter().collect(),
        EdgeKind::Supersession => record.receipt.supersedes_receipt_ids.iter().collect(),
        EdgeKind::Combined => record
            .receipt
            .input_receipt_ids
            .iter()
            .chain(record.receipt.supersedes_receipt_ids.iter())
            .collect(),
    }
}

fn finalize_result(
    campaign_id: &str,
    by_id: &BTreeMap<String, PhaseRecord>,
    states: &BTreeMap<String, Classification>,
    conflicting_operation_identities: Vec<String>,
    total_receipt_bytes: usize,
) -> Result<FinalizedPhaseInvalidation, PhaseInvalidationError> {
    let records = by_id
        .values()
        .map(|record| {
            let classification = states
                .get(&record.receipt.receipt_id)
                .ok_or_else(|| failure("phase_receipt_graph_invalid"))?;
            Ok(OutputRecord {
                input_receipt_ids: &record.receipt.input_receipt_ids,
                material_identity: &record.material_identity,
                operation_id: &record.operation_id,
                operation_identity: &record.operation_identity,
                phase: &record.receipt.phase,
                reason_code: classification.reason_code,
                receipt_id: &record.receipt.receipt_id,
                receipt_type: &record.receipt.receipt_type,
                source_status: &record.receipt.status,
                state: classification.state,
                subject_id: &record.subject_id,
                supersedes_receipt_ids: &record.receipt.supersedes_receipt_ids,
            })
        })
        .collect::<Result<Vec<_>, PhaseInvalidationError>>()?;
    let current_phase_receipt_ids = selected_receipt_ids(&records, |record| {
        matches!(record.state, "current-pass" | "current-nonpass")
    });
    let eligible_pass_phase_receipt_ids =
        selected_receipt_ids(&records, |record| record.state == "current-pass");
    let retained_historical_receipt_ids = selected_receipt_ids(&records, |record| {
        !matches!(record.state, "current-pass" | "current-nonpass")
    });
    let receipt_ids = by_id.keys().cloned().collect::<Vec<_>>();
    let receipt_ids_value =
        serde_json::to_value(&receipt_ids).map_err(|_| failure("phase_result_invalid"))?;
    let receipt_set_sha256 = lowercase_hex(&domain_digest(
        RECEIPT_SET_IDENTITY_DOMAIN,
        &canonical_value_bytes(&receipt_ids_value).map_err(|_| failure("phase_result_invalid"))?,
    ));
    let health = if conflicting_operation_identities.is_empty() {
        "healthy"
    } else {
        "invalid"
    };
    let result = PhaseResult {
        campaign_id,
        conflicting_operation_identities: &conflicting_operation_identities,
        current_phase_receipt_ids: &current_phase_receipt_ids,
        eligible_pass_phase_receipt_ids: &eligible_pass_phase_receipt_ids,
        health,
        profile_id: PHASE_INVALIDATION_PROFILE_ID,
        profile_sha256: PHASE_INVALIDATION_PROFILE_SHA256,
        receipt_count: by_id.len(),
        receipt_set_sha256: &receipt_set_sha256,
        records: &records,
        retained_historical_receipt_ids: &retained_historical_receipt_ids,
        schema: PHASE_INVALIDATION_RESULT_SCHEMA,
        total_receipt_bytes,
    };
    let value = serde_json::to_value(result).map_err(|_| failure("phase_result_invalid"))?;
    let bytes = canonical_value_bytes(&value).map_err(|_| failure("phase_result_invalid"))?;
    if bytes.len() > MAXIMUM_RESULT_BYTES {
        return Err(failure("phase_result_byte_limit"));
    }
    let sha256 = lowercase_hex(&Sha256::digest(&bytes));
    Ok(FinalizedPhaseInvalidation { bytes, sha256 })
}

fn selected_receipt_ids(
    records: &[OutputRecord<'_>],
    predicate: impl Fn(&OutputRecord<'_>) -> bool,
) -> Vec<String> {
    records
        .iter()
        .filter(|record| predicate(record))
        .map(|record| record.receipt_id.to_owned())
        .collect()
}

fn content_identity(
    domain: &str,
    value: &serde_json::Value,
) -> Result<String, PhaseInvalidationError> {
    let bytes = canonical_value_bytes(value).map_err(|_| failure("phase_identity_invalid"))?;
    Ok(format!(
        "sha256:{}",
        lowercase_hex(&domain_digest(domain, &bytes))
    ))
}

fn is_nonpass_status(value: &str) -> bool {
    matches!(
        value,
        "blocked" | "fail" | "rejected" | "stale" | "superseded"
    )
}

const fn failure(code: &'static str) -> PhaseInvalidationError {
    PhaseInvalidationError { code }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    const VECTORS: &[u8] =
        include_bytes!("../../../../contracts/vnext/phase-invalidation-rust-vectors.v1.json");

    fn sample_receipt() -> Receipt {
        let corpus: serde_json::Value =
            serde_json::from_slice(VECTORS).expect("vectors must parse");
        let encoded = corpus["cases"][0]["receiptBytesBase64"][0]
            .as_str()
            .expect("receipt must be base64");
        let bytes = STANDARD.decode(encoded).expect("base64 must decode");
        validate_receipt_bytes(&bytes).expect("receipt must validate")
    }

    fn record(receipt: Receipt, operation_identity: &str) -> PhaseRecord {
        PhaseRecord {
            material_identity: format!("sha256:{}", "1".repeat(64)),
            operation_id: "operation-cycle-001".to_owned(),
            operation_identity: operation_identity.to_owned(),
            receipt,
            subject_id: "model-cycle-001".to_owned(),
        }
    }

    #[test]
    fn topological_classification_rejects_combined_cycles() {
        let first_id = format!("sha256:{}", "1".repeat(64));
        let second_id = format!("sha256:{}", "2".repeat(64));
        let mut first = sample_receipt();
        first.receipt_id.clone_from(&first_id);
        first.input_receipt_ids = vec![second_id.clone()];
        let mut second = sample_receipt();
        second.receipt_id.clone_from(&second_id);
        second.input_receipt_ids = vec![first_id.clone()];
        let records = BTreeMap::from([
            (first_id, record(first, "operation-cycle-a")),
            (second_id, record(second, "operation-cycle-b")),
        ]);
        assert_eq!(
            topological_order(&records, EdgeKind::Combined)
                .expect_err("cycle must reject")
                .code(),
            "phase_receipt_graph_invalid"
        );
    }

    #[test]
    fn public_api_rejects_campaign_and_receipt_count_limits_first() {
        assert_eq!(
            classify_phase_receipts("INVALID", &[vec![1]])
                .expect_err("invalid campaign must reject")
                .code(),
            "phase_campaign_invalid"
        );
        assert_eq!(
            classify_phase_receipts("campaign-limit-001", &[])
                .expect_err("empty input must reject")
                .code(),
            "phase_receipt_count_invalid"
        );
        let too_many = vec![vec![1]; MAXIMUM_RECEIPTS + 1];
        assert_eq!(
            classify_phase_receipts("campaign-limit-001", &too_many)
                .expect_err("receipt count must reject")
                .code(),
            "phase_receipt_count_invalid"
        );
    }
}
