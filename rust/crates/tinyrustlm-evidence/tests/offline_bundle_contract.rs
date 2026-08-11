//! Cross-language offline-bundle closure parity and hostile rejection vectors.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tinyrustlm_evidence::{
    verify_offline_bundle, OfflineBundleVerificationInput, OFFLINE_BUNDLE_PROFILE_ID,
    OFFLINE_BUNDLE_PROFILE_SHA256,
};

const PROFILE: &[u8] =
    include_bytes!("../../../../contracts/vnext/offline-verification-bundle-profile.v1.json");
const PUBLIC_SEED: &[u8] =
    include_bytes!("../../../../contracts/vnext/authority-graph-public-seed.v1.json");
const VECTORS: &[u8] =
    include_bytes!("../../../../contracts/vnext/offline-bundle-rust-vectors.v1.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct VectorCorpus {
    accepted_cases: Vec<AcceptCase>,
    authority_public_seed_sha256: String,
    profile_id: String,
    profile_sha256: String,
    rejection_cases: Vec<RejectCase>,
    schema: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct InputCase {
    bundle_manifest_bytes_base64: String,
    expected_bundle_manifest_sha256: String,
    expected_campaign_id: String,
    expected_environment: String,
    expected_terminal_registry_receipt_id: String,
    receipt_bytes_base64: Vec<String>,
    subject_bytes_base64: Vec<String>,
    trusted_root_registry_receipt_id: String,
    verification_receipt_bytes_base64: String,
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
    serde_json::from_slice(VECTORS).expect("offline-bundle vectors must parse")
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
) -> Result<tinyrustlm_evidence::VerifiedOfflineBundle, tinyrustlm_evidence::OfflineBundleError> {
    let manifest = decode(&input.bundle_manifest_bytes_base64);
    let verification_receipt = decode(&input.verification_receipt_bytes_base64);
    let receipts = decode_all(&input.receipt_bytes_base64);
    let subjects = decode_all(&input.subject_bytes_base64);
    verify_offline_bundle(OfflineBundleVerificationInput {
        bundle_manifest_bytes: &manifest,
        expected_bundle_manifest_sha256: &input.expected_bundle_manifest_sha256,
        expected_campaign_id: &input.expected_campaign_id,
        expected_environment: &input.expected_environment,
        expected_terminal_registry_receipt_id: &input.expected_terminal_registry_receipt_id,
        receipt_bytes: &receipts,
        subject_bytes: &subjects,
        trusted_root_registry_receipt_id: &input.trusted_root_registry_receipt_id,
        verification_receipt_bytes: &verification_receipt,
        verification_time_utc: &input.verification_time_utc,
    })
}

#[test]
fn rust_offline_profile_matches_the_exact_frozen_profile_and_public_seed() {
    let vectors = corpus();
    assert_eq!(
        vectors.schema,
        "tinyrustlm.vnext.offline_bundle_rust_vectors.v1"
    );
    assert_eq!(vectors.profile_id, OFFLINE_BUNDLE_PROFILE_ID);
    assert_eq!(vectors.profile_sha256, OFFLINE_BUNDLE_PROFILE_SHA256);
    assert_eq!(
        format!("{:x}", Sha256::digest(PROFILE)),
        OFFLINE_BUNDLE_PROFILE_SHA256
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(PUBLIC_SEED)),
        vectors.authority_public_seed_sha256
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(VECTORS)),
        "a630802b2db449d00c7029152ae0198e743114d1f42d241bebd8980e19491b3c"
    );
    assert_eq!(vectors.accepted_cases.len(), 3);
    assert_eq!(vectors.rejection_cases.len(), 31);
    assert!(!VECTORS.windows(10).any(|value| value == b"privateKey"));
}

#[test]
fn rust_offline_bundle_matches_every_exact_node_result() {
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
fn rust_offline_bundle_rejects_every_exact_node_failure() {
    for case in corpus().rejection_cases {
        let error = verify(&case.input).expect_err(&format!("{} must reject", case.name));
        assert_eq!(error.code(), case.expected_error_code, "{}", case.name);
    }
}
