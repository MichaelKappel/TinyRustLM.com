//! Cross-language campaign-projection parity and hostile rejection vectors.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use tinyrustlm_evidence::{
    project_campaign, validate_campaign_projection_result, CampaignProjectionInput,
    CAMPAIGN_PROJECTION_PROFILE_ID, CAMPAIGN_PROJECTION_PROFILE_SHA256,
    CAMPAIGN_PROJECTION_RESULT_SCHEMA,
};

const PROFILE: &[u8] =
    include_bytes!("../../../../contracts/vnext/campaign-projection-profile.v1.json");
const PUBLIC_SEED: &[u8] =
    include_bytes!("../../../../contracts/vnext/campaign-projection-public-seed.v1.json");
const VECTORS: &[u8] =
    include_bytes!("../../../../contracts/vnext/campaign-projection-rust-vectors.v1.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct VectorCorpus {
    accepted_cases: Vec<AcceptCase>,
    plan_wires: Vec<PlanWire>,
    profile_id: String,
    profile_sha256: String,
    public_seed_sha256: String,
    receipts: Vec<ReceiptWire>,
    rejection_cases: Vec<RejectCase>,
    result_rejection_cases: Vec<ResultRejectCase>,
    schema: String,
    subjects: Vec<SubjectWire>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct PlanWire {
    bytes_base64: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ReceiptWire {
    bytes_base64: String,
    receipt_id: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SubjectWire {
    bytes_base64: String,
    subject_id: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct InputCase {
    expected_campaign_id: String,
    expected_campaign_plan_sha256: String,
    expected_environment: String,
    expected_terminal_registry_receipt_id: Option<String>,
    plan_wire_name: String,
    receipt_bytes_base64: Vec<String>,
    receipt_ids: Vec<String>,
    subject_bytes_base64: Vec<String>,
    subject_ids: Vec<String>,
    trusted_root_registry_receipt_id: Option<String>,
    verification_time_utc: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AcceptCase {
    #[serde(flatten)]
    input: InputCase,
    name: String,
    result_bytes_base64: String,
    result_sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RejectCase {
    #[serde(flatten)]
    input: InputCase,
    expected_error_code: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ResultRejectCase {
    expected_error_code: String,
    name: String,
    result_bytes_base64: String,
}

struct MaterializedInput<'a> {
    input: &'a InputCase,
    plan: Vec<u8>,
    receipts: Vec<Vec<u8>>,
    subjects: Vec<Vec<u8>>,
}

fn corpus() -> VectorCorpus {
    serde_json::from_slice(VECTORS).expect("campaign-projection vectors must parse")
}

fn decode(value: &str) -> Vec<u8> {
    let bytes = STANDARD.decode(value).expect("vector base64 must decode");
    assert_eq!(
        STANDARD.encode(&bytes),
        value,
        "vector base64 must be canonical"
    );
    bytes
}

fn materialize<'a>(vectors: &VectorCorpus, input: &'a InputCase) -> MaterializedInput<'a> {
    let plans = vectors
        .plan_wires
        .iter()
        .map(|entry| (entry.name.as_str(), entry.bytes_base64.as_str()))
        .collect::<BTreeMap<_, _>>();
    let receipt_pool = vectors
        .receipts
        .iter()
        .map(|entry| (entry.receipt_id.as_str(), entry.bytes_base64.as_str()))
        .collect::<BTreeMap<_, _>>();
    let subject_pool = vectors
        .subjects
        .iter()
        .map(|entry| (entry.subject_id.as_str(), entry.bytes_base64.as_str()))
        .collect::<BTreeMap<_, _>>();
    let mut receipts = input
        .receipt_ids
        .iter()
        .map(|id| decode(receipt_pool[id.as_str()]))
        .collect::<Vec<_>>();
    receipts.extend(input.receipt_bytes_base64.iter().map(|value| decode(value)));
    let mut subjects = input
        .subject_ids
        .iter()
        .map(|id| decode(subject_pool[id.as_str()]))
        .collect::<Vec<_>>();
    subjects.extend(input.subject_bytes_base64.iter().map(|value| decode(value)));
    MaterializedInput {
        input,
        plan: decode(plans[input.plan_wire_name.as_str()]),
        receipts,
        subjects,
    }
}

fn project(
    materialized: &MaterializedInput<'_>,
) -> Result<
    tinyrustlm_evidence::VerifiedCampaignProjection,
    tinyrustlm_evidence::CampaignProjectionError,
> {
    let input = materialized.input;
    project_campaign(CampaignProjectionInput {
        campaign_plan_bytes: &materialized.plan,
        expected_campaign_plan_sha256: &input.expected_campaign_plan_sha256,
        expected_campaign_id: &input.expected_campaign_id,
        expected_environment: &input.expected_environment,
        expected_terminal_registry_receipt_id: input
            .expected_terminal_registry_receipt_id
            .as_deref(),
        receipt_bytes: &materialized.receipts,
        subject_bytes: &materialized.subjects,
        trusted_root_registry_receipt_id: input.trusted_root_registry_receipt_id.as_deref(),
        verification_time_utc: &input.verification_time_utc,
    })
}

#[test]
fn rust_projection_profile_matches_the_exact_frozen_profile_and_public_seed() {
    let vectors = corpus();
    assert_eq!(
        vectors.schema,
        "tinyrustlm.vnext.campaign_projection_rust_vectors.v1"
    );
    assert_eq!(vectors.profile_id, CAMPAIGN_PROJECTION_PROFILE_ID);
    assert_eq!(vectors.profile_sha256, CAMPAIGN_PROJECTION_PROFILE_SHA256);
    assert_eq!(
        format!("{:x}", Sha256::digest(PROFILE)),
        CAMPAIGN_PROJECTION_PROFILE_SHA256
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(PUBLIC_SEED)),
        vectors.public_seed_sha256
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(VECTORS)),
        "875e066e6f5f509552b9659ac76f32e2598659e2432384ad0b2ba4694c3e5a62"
    );
    assert_eq!(vectors.accepted_cases.len(), 11);
    assert_eq!(vectors.rejection_cases.len(), 22);
    assert_eq!(vectors.result_rejection_cases.len(), 8);
    assert_eq!(
        CAMPAIGN_PROJECTION_RESULT_SCHEMA,
        "tinyrustlm.vnext.campaign_projection_result.v1"
    );
    assert!(!VECTORS.windows(10).any(|value| value == b"privateKey"));
}

#[test]
fn rust_campaign_projection_matches_every_exact_node_result() {
    let vectors = corpus();
    for case in &vectors.accepted_cases {
        let materialized = materialize(&vectors, &case.input);
        let verified = project(&materialized)
            .unwrap_or_else(|error| panic!("{} rejected as {}", case.name, error.code()));
        assert_eq!(
            verified.bytes(),
            decode(&case.result_bytes_base64),
            "{}",
            case.name
        );
        assert_eq!(verified.sha256(), case.result_sha256, "{}", case.name);

        let mut changed = verified.to_bytes();
        changed[0] ^= 0xff;
        assert_eq!(
            verified.bytes(),
            decode(&case.result_bytes_base64),
            "{}",
            case.name
        );
    }
}

#[test]
fn rust_campaign_projection_rejects_every_exact_node_failure() {
    let vectors = corpus();
    for case in &vectors.rejection_cases {
        let materialized = materialize(&vectors, &case.input);
        let error = project(&materialized).expect_err(&format!("{} must reject", case.name));
        assert_eq!(error.code(), case.expected_error_code, "{}", case.name);
    }
}

#[test]
fn rust_projection_result_validator_matches_node() {
    let vectors = corpus();
    let canonical_plan = vectors
        .plan_wires
        .iter()
        .find(|entry| entry.name == "canonical")
        .map(|entry| decode(&entry.bytes_base64))
        .expect("canonical plan must exist");
    for case in &vectors.accepted_cases {
        let result = decode(&case.result_bytes_base64);
        let verified = validate_campaign_projection_result(&result, &canonical_plan)
            .unwrap_or_else(|error| panic!("{} rejected as {}", case.name, error.code()));
        assert_eq!(verified.bytes(), result, "{}", case.name);
    }
    for case in &vectors.result_rejection_cases {
        let result = decode(&case.result_bytes_base64);
        let error = validate_campaign_projection_result(&result, &canonical_plan)
            .expect_err(&format!("{} must reject", case.name));
        assert_eq!(error.code(), case.expected_error_code, "{}", case.name);
    }
}
