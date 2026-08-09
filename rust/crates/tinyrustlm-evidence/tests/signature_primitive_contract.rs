//! Cross-language Ed25519 primitive parity and hostile rejection vectors.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tinyrustlm_evidence::{
    derive_signature_material, verify_signature_primitive, SIGNATURE_PROFILE_ID,
    SIGNATURE_PROFILE_SHA256,
};

const PROFILE: &[u8] =
    include_bytes!("../../../../contracts/vnext/receipt-signature-profile.v1.json");
const VECTORS: &[u8] =
    include_bytes!("../../../../contracts/vnext/receipt-signature-rust-vectors.v1.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct VectorCorpus {
    accepted_cases: Vec<AcceptCase>,
    profile_id: String,
    profile_sha256: String,
    rejection_cases: Vec<RejectCase>,
    schema: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AcceptCase {
    envelope_bytes_base64: String,
    name: String,
    payload_bytes_base64: String,
    payload_sha256: String,
    public_key_base64: String,
    result_bytes_base64: String,
    result_sha256: String,
    signing_bytes_base64: String,
    signing_bytes_sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RejectCase {
    envelope_bytes_base64: String,
    expected_error_code: String,
    name: String,
    public_key_base64: String,
}

fn corpus() -> VectorCorpus {
    serde_json::from_slice(VECTORS).expect("signature vectors must parse")
}

fn decode(value: &str) -> Vec<u8> {
    STANDARD.decode(value).expect("vector base64 must decode")
}

#[test]
fn rust_signature_profile_matches_the_exact_frozen_profile() {
    let vectors = corpus();
    assert_eq!(
        vectors.schema,
        "tinyrustlm.vnext.receipt_signature_rust_vectors.v1"
    );
    assert_eq!(vectors.profile_id, SIGNATURE_PROFILE_ID);
    assert_eq!(vectors.profile_sha256, SIGNATURE_PROFILE_SHA256);
    assert_eq!(
        format!("{:x}", Sha256::digest(PROFILE)),
        SIGNATURE_PROFILE_SHA256
    );
}

#[test]
fn rust_derives_and_verifies_the_exact_public_ed25519_vector() {
    for case in corpus().accepted_cases {
        let envelope = decode(&case.envelope_bytes_base64);
        let material = derive_signature_material(&envelope).unwrap_or_else(|error| {
            panic!("{} derivation rejected as {}", case.name, error.code())
        });
        assert_eq!(material.payload_bytes(), decode(&case.payload_bytes_base64));
        assert_eq!(material.payload_sha256(), case.payload_sha256);
        assert_eq!(material.signing_bytes(), decode(&case.signing_bytes_base64));
        assert_eq!(material.signing_bytes_sha256(), case.signing_bytes_sha256);

        let verified = verify_signature_primitive(&envelope, &case.public_key_base64)
            .unwrap_or_else(|error| {
                panic!("{} verification rejected as {}", case.name, error.code())
            });
        assert_eq!(verified.bytes(), decode(&case.result_bytes_base64));
        assert_eq!(verified.sha256(), case.result_sha256);

        let mut changed = verified.bytes().to_vec();
        changed[0] ^= 0xff;
        assert_eq!(verified.bytes(), decode(&case.result_bytes_base64));
    }
}

#[test]
fn rust_rejects_every_exact_node_primitive_rejection() {
    for case in corpus().rejection_cases {
        let envelope = decode(&case.envelope_bytes_base64);
        let error = verify_signature_primitive(&envelope, &case.public_key_base64)
            .expect_err(&format!("{} must reject", case.name));
        assert_eq!(error.code(), case.expected_error_code, "{}", case.name);
    }
}
