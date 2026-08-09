//! Cross-language authority-graph parity and hostile rejection vectors.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tinyrustlm_evidence::{verify_authority_graph, AUTHORITY_PROFILE_ID, AUTHORITY_PROFILE_SHA256};

const PROFILE: &[u8] =
    include_bytes!("../../../../contracts/vnext/receipt-signature-profile.v1.json");
const PUBLIC_SEED: &[u8] =
    include_bytes!("../../../../contracts/vnext/authority-graph-public-seed.v1.json");
const VECTORS: &[u8] =
    include_bytes!("../../../../contracts/vnext/authority-graph-rust-vectors.v1.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct VectorCorpus {
    accepted_cases: Vec<AcceptCase>,
    profile_id: String,
    profile_sha256: String,
    public_seed_sha256: String,
    rejection_cases: Vec<RejectCase>,
    schema: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct InputCase {
    campaign_id: String,
    environment: String,
    expected_terminal_registry_receipt_id: String,
    receipt_bytes_base64: Vec<String>,
    subject_bytes_base64: Vec<String>,
    trusted_root_registry_receipt_id: String,
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

fn corpus() -> VectorCorpus {
    serde_json::from_slice(VECTORS).expect("authority graph vectors must parse")
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

fn decode_all(values: &[String]) -> Vec<Vec<u8>> {
    values.iter().map(|value| decode(value)).collect()
}

fn verify(
    input: &InputCase,
) -> Result<tinyrustlm_evidence::VerifiedAuthorityGraph, tinyrustlm_evidence::AuthorityError> {
    let receipts = decode_all(&input.receipt_bytes_base64);
    let subjects = decode_all(&input.subject_bytes_base64);
    verify_authority_graph(
        &input.campaign_id,
        &input.environment,
        &input.verification_time_utc,
        &input.trusted_root_registry_receipt_id,
        &input.expected_terminal_registry_receipt_id,
        &receipts,
        &subjects,
    )
}

#[test]
fn rust_authority_profile_matches_the_exact_frozen_profile_and_public_seed() {
    let vectors = corpus();
    assert_eq!(
        vectors.schema,
        "tinyrustlm.vnext.authority_graph_rust_vectors.v1"
    );
    assert_eq!(vectors.profile_id, AUTHORITY_PROFILE_ID);
    assert_eq!(vectors.profile_sha256, AUTHORITY_PROFILE_SHA256);
    assert_eq!(
        format!("{:x}", Sha256::digest(PROFILE)),
        AUTHORITY_PROFILE_SHA256
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(PUBLIC_SEED)),
        vectors.public_seed_sha256
    );
    assert_eq!(vectors.accepted_cases.len(), 9);
    assert_eq!(vectors.rejection_cases.len(), 26);
    assert!(!PUBLIC_SEED.windows(10).any(|value| value == b"privateKey"));
}

#[test]
fn rust_authority_graph_matches_every_exact_node_result() {
    for case in corpus().accepted_cases {
        let verified = verify(&case.input)
            .unwrap_or_else(|error| panic!("{} rejected as {}", case.name, error.code()));
        assert_eq!(
            verified.bytes(),
            decode(&case.result_bytes_base64),
            "{}",
            case.name
        );
        assert_eq!(verified.sha256(), case.result_sha256, "{}", case.name);

        let mut changed = verified.bytes().to_vec();
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
fn rust_authority_graph_rejects_every_exact_node_failure() {
    for case in corpus().rejection_cases {
        let error = verify(&case.input).expect_err(&format!("{} must reject", case.name));
        assert_eq!(error.code(), case.expected_error_code, "{}", case.name);
    }
}
