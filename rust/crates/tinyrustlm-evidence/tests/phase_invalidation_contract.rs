//! Cross-language semantic-currentness parity and rejection vectors.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tinyrustlm_evidence::{
    classify_phase_receipts, PHASE_INVALIDATION_PROFILE_ID, PHASE_INVALIDATION_PROFILE_SHA256,
};

const PROFILE: &[u8] =
    include_bytes!("../../../../contracts/vnext/phase-invalidation-profile.v1.json");
const VECTORS: &[u8] =
    include_bytes!("../../../../contracts/vnext/phase-invalidation-rust-vectors.v1.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct VectorCorpus {
    campaign_id: String,
    cases: Vec<AcceptCase>,
    profile_id: String,
    profile_sha256: String,
    rejection_cases: Vec<RejectCase>,
    schema: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AcceptCase {
    name: String,
    receipt_bytes_base64: Vec<String>,
    result_bytes_base64: String,
    result_sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RejectCase {
    campaign_id: String,
    expected_error_code: String,
    name: String,
    receipt_bytes_base64: Vec<String>,
}

fn decode_receipts(values: &[String]) -> Vec<Vec<u8>> {
    values
        .iter()
        .map(|value| STANDARD.decode(value).expect("vector base64 must decode"))
        .collect()
}

fn corpus() -> VectorCorpus {
    serde_json::from_slice(VECTORS).expect("phase invalidation vectors must parse")
}

#[test]
fn rust_profile_identity_matches_the_frozen_node_profile() {
    let vectors = corpus();
    let profile_sha256 = format!("{:x}", Sha256::digest(PROFILE));
    assert_eq!(
        vectors.schema,
        "tinyrustlm.vnext.phase_invalidation_rust_vectors.v1"
    );
    assert_eq!(vectors.profile_id, PHASE_INVALIDATION_PROFILE_ID);
    assert_eq!(vectors.profile_sha256, PHASE_INVALIDATION_PROFILE_SHA256);
    assert_eq!(profile_sha256, PHASE_INVALIDATION_PROFILE_SHA256);
}

#[test]
fn rust_classification_matches_every_exact_node_result() {
    let vectors = corpus();
    for case in vectors.cases {
        let receipts = decode_receipts(&case.receipt_bytes_base64);
        let result = classify_phase_receipts(&vectors.campaign_id, &receipts)
            .unwrap_or_else(|error| panic!("{} rejected as {}", case.name, error.code()));
        let expected = STANDARD
            .decode(case.result_bytes_base64)
            .expect("result vector base64 must decode");
        assert_eq!(result.bytes(), expected, "{} bytes drifted", case.name);
        assert_eq!(
            result.sha256(),
            case.result_sha256,
            "{} hash drifted",
            case.name
        );
        let mut changed = result.bytes().to_vec();
        changed[0] ^= 0xff;
        assert_eq!(
            result.bytes(),
            expected,
            "{} exposed mutable bytes",
            case.name
        );
    }
}

#[test]
fn rust_rejects_every_exact_node_rejection_case() {
    let vectors = corpus();
    for case in vectors.rejection_cases {
        let receipts = decode_receipts(&case.receipt_bytes_base64);
        let error = classify_phase_receipts(&case.campaign_id, &receipts)
            .expect_err(&format!("{} must reject", case.name));
        assert_eq!(
            error.code(),
            case.expected_error_code,
            "{} code drifted",
            case.name
        );
    }
}
