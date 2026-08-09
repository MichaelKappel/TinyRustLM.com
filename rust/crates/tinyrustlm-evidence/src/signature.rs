use crate::receipt::{
    canonical_base64, canonical_bytes, canonical_value_bytes, lowercase_hex, parse_utc,
    valid_content_id, valid_digest, valid_safe_id, RequiredNullable, SignatureEnvelope,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::error::Error;
use std::fmt;

/// The one current Ed25519 authority profile identity.
pub const SIGNATURE_PROFILE_ID: &str = "tinyrustlm.vnext.ed25519-authority.v1";
/// The SHA-256 of the exact frozen Ed25519 authority profile bytes.
pub const SIGNATURE_PROFILE_SHA256: &str =
    "9d1f0c65f91dc9b76bf5e430ee5f91ba787ab4622d72aae3c73c3a50c9f2a8b9";

const MAXIMUM_ENVELOPE_BYTES: usize = 16_384;
const MAXIMUM_ONLINE_LIFETIME_NANOSECONDS: i128 = 604_800_000_000_000;
const MAXIMUM_OUTSIDE_PROOF_LIFETIME_NANOSECONDS: i128 = 86_400_000_000_000;
const SUPPORTED_SCHEMAS: &[&str] = &[
    "tinyrustlm.vnext.artifact_manifest.v1",
    "tinyrustlm.vnext.claim.v2",
    "tinyrustlm.vnext.context.v1",
    "tinyrustlm.vnext.outside_proof.v2",
    "tinyrustlm.vnext.p2p_manifest.v1",
    "tinyrustlm.vnext.receipt.v1",
    "tinyrustlm.vnext.release_manifest.v2",
];

/// One bounded, stable signature-primitive failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SignatureError {
    code: &'static str,
}

impl SignatureError {
    /// Returns the stable machine-readable failure code.
    pub const fn code(&self) -> &'static str {
        self.code
    }
}

impl fmt::Display for SignatureError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for SignatureError {}

/// Exact canonical payload and domain-separated signing bytes.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignatureMaterial {
    payload_bytes: Vec<u8>,
    payload_sha256: String,
    signing_bytes: Vec<u8>,
    signing_bytes_sha256: String,
}

impl SignatureMaterial {
    /// Returns the exact canonical signed payload bytes.
    pub fn payload_bytes(&self) -> &[u8] {
        &self.payload_bytes
    }

    /// Returns the lowercase SHA-256 of the canonical payload bytes.
    pub fn payload_sha256(&self) -> &str {
        &self.payload_sha256
    }

    /// Returns `UTF8(signatureDomain) || 0x00 || canonical payload`.
    pub fn signing_bytes(&self) -> &[u8] {
        &self.signing_bytes
    }

    /// Returns the lowercase SHA-256 of the exact signing bytes.
    pub fn signing_bytes_sha256(&self) -> &str {
        &self.signing_bytes_sha256
    }
}

/// Canonical successful primitive-verification result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifiedSignature {
    bytes: Vec<u8>,
    sha256: String,
}

impl VerifiedSignature {
    /// Returns the immutable canonical result bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Returns the lowercase SHA-256 of the canonical result bytes.
    pub fn sha256(&self) -> &str {
        &self.sha256
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SignedPayload<'a> {
    algorithm: &'a str,
    authority_registry_receipt_id: &'a str,
    campaign_id: &'a str,
    expires_at_utc: &'a RequiredNullable<String>,
    issued_at_utc: &'a str,
    key_id: &'a str,
    nonce_hash: &'a str,
    release_id: &'a RequiredNullable<String>,
    role: &'a str,
    scope: &'a str,
    signature_domain: &'a str,
    signed_schema: &'a str,
    signed_subject_id: &'a str,
    signer_id: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VerificationResult<'a> {
    algorithm: &'static str,
    authority_registry_receipt_id: &'a str,
    key_id: &'a str,
    role: &'a str,
    scope: &'a str,
    signature_verified: bool,
    signed_payload_sha256: &'a str,
    signed_schema: &'a str,
    signed_subject_id: &'a str,
    signer_id: &'a str,
}

/// Derives the exact frozen signing material from one canonical envelope wire.
pub fn derive_signature_material(
    envelope_bytes: &[u8],
) -> Result<SignatureMaterial, SignatureError> {
    let envelope = parse_envelope(envelope_bytes)?;
    derive_material(&envelope)
}

/// Verifies one canonical Ed25519 envelope against one raw public key.
pub fn verify_signature_primitive(
    envelope_bytes: &[u8],
    public_key_base64: &str,
) -> Result<VerifiedSignature, SignatureError> {
    let envelope = parse_envelope(envelope_bytes)?;
    let material = derive_material(&envelope)?;
    if envelope.signed_payload_sha256 != material.signing_bytes_sha256 {
        return Err(failure("signature_payload_hash_mismatch"));
    }
    let signature_bytes =
        decode_canonical_base64(&envelope.signature, 64, "signature_base64_invalid")?;
    let public_key_bytes =
        decode_canonical_base64(public_key_base64, 32, "signature_public_key_base64_invalid")?;
    let public_key_array: [u8; 32] = public_key_bytes
        .try_into()
        .map_err(|_| failure("signature_public_key_invalid"))?;
    let verifying_key = VerifyingKey::from_bytes(&public_key_array)
        .map_err(|_| failure("signature_public_key_invalid"))?;
    let signature_array: [u8; 64] = signature_bytes
        .try_into()
        .map_err(|_| failure("signature_base64_invalid"))?;
    let signature = Signature::from_bytes(&signature_array);
    verifying_key
        .verify_strict(&material.signing_bytes, &signature)
        .map_err(|_| failure("signature_invalid"))?;

    let result = VerificationResult {
        algorithm: "ed25519",
        authority_registry_receipt_id: &envelope.authority_registry_receipt_id,
        key_id: &envelope.key_id,
        role: &envelope.role,
        scope: &envelope.scope,
        signature_verified: true,
        signed_payload_sha256: &material.signing_bytes_sha256,
        signed_schema: &envelope.signed_schema,
        signed_subject_id: &envelope.signed_subject_id,
        signer_id: &envelope.signer_id,
    };
    let value = serde_json::to_value(result).map_err(|_| failure("signature_result_invalid"))?;
    let bytes = canonical_value_bytes(&value).map_err(|_| failure("signature_result_invalid"))?;
    let sha256 = lowercase_hex(&Sha256::digest(&bytes));
    Ok(VerifiedSignature { bytes, sha256 })
}

fn parse_envelope(bytes: &[u8]) -> Result<SignatureEnvelope, SignatureError> {
    if bytes.is_empty() || bytes.len() > MAXIMUM_ENVELOPE_BYTES {
        return Err(failure("signature_envelope_fields_invalid"));
    }
    let envelope: SignatureEnvelope =
        serde_json::from_slice(bytes).map_err(|_| failure("signature_envelope_fields_invalid"))?;
    let canonical =
        canonical_bytes(&envelope).map_err(|_| failure("signature_envelope_fields_invalid"))?;
    if canonical != bytes {
        return Err(failure("signature_envelope_fields_invalid"));
    }
    validate_envelope(&envelope)?;
    Ok(envelope)
}

fn validate_envelope(envelope: &SignatureEnvelope) -> Result<(), SignatureError> {
    if envelope.algorithm != "ed25519" {
        return Err(failure("signature_algorithm_invalid"));
    }
    let (domain, scopes) =
        role_binding(&envelope.role).ok_or_else(|| failure("signature_role_domain_invalid"))?;
    if envelope.signature_domain != domain {
        return Err(failure("signature_role_domain_invalid"));
    }
    if !scopes.contains(&envelope.scope.as_str()) {
        return Err(failure("signature_scope_invalid"));
    }
    if !valid_safe_id(&envelope.signer_id)
        || !valid_safe_id(&envelope.key_id)
        || !valid_safe_id(&envelope.campaign_id)
    {
        return Err(failure("signature_identifier_invalid"));
    }
    if !valid_content_id(&envelope.authority_registry_receipt_id)
        || !valid_content_id(&envelope.signed_subject_id)
        || envelope
            .release_id
            .as_ref()
            .is_some_and(|value| !valid_content_id(value))
    {
        return Err(failure("signature_content_id_invalid"));
    }
    if !SUPPORTED_SCHEMAS.contains(&envelope.signed_schema.as_str()) {
        return Err(failure("signature_schema_not_supported"));
    }
    if !valid_digest(&envelope.signed_payload_sha256) || !valid_digest(&envelope.nonce_hash) {
        return Err(failure("signature_hash_invalid"));
    }
    let issued =
        parse_utc(&envelope.issued_at_utc).map_err(|_| failure("signature_time_invalid"))?;
    let expires = envelope
        .expires_at_utc
        .as_ref()
        .map(|value| parse_utc(value).map_err(|_| failure("signature_time_invalid")))
        .transpose()?;
    match expires {
        None if envelope.role != "local-recorder" => {
            return Err(failure("signature_expiry_invalid"));
        }
        None => {}
        Some(expires) => {
            let maximum = if envelope.role == "outside-network-observer"
                && envelope.scope == "outside-proof"
            {
                MAXIMUM_OUTSIDE_PROOF_LIFETIME_NANOSECONDS
            } else {
                MAXIMUM_ONLINE_LIFETIME_NANOSECONDS
            };
            let lifetime = expires.nanoseconds - issued.nanoseconds;
            if lifetime <= 0 || lifetime > maximum {
                return Err(failure("signature_lifetime_invalid"));
            }
        }
    }
    if !canonical_base64(&envelope.signature, 64) {
        return Err(failure("signature_base64_invalid"));
    }
    Ok(())
}

fn derive_material(envelope: &SignatureEnvelope) -> Result<SignatureMaterial, SignatureError> {
    let payload = SignedPayload {
        algorithm: &envelope.algorithm,
        authority_registry_receipt_id: &envelope.authority_registry_receipt_id,
        campaign_id: &envelope.campaign_id,
        expires_at_utc: &envelope.expires_at_utc,
        issued_at_utc: &envelope.issued_at_utc,
        key_id: &envelope.key_id,
        nonce_hash: &envelope.nonce_hash,
        release_id: &envelope.release_id,
        role: &envelope.role,
        scope: &envelope.scope,
        signature_domain: &envelope.signature_domain,
        signed_schema: &envelope.signed_schema,
        signed_subject_id: &envelope.signed_subject_id,
        signer_id: &envelope.signer_id,
    };
    let value = serde_json::to_value(payload).map_err(|_| failure("signature_payload_invalid"))?;
    let payload_bytes =
        canonical_value_bytes(&value).map_err(|_| failure("signature_payload_invalid"))?;
    let payload_sha256 = lowercase_hex(&Sha256::digest(&payload_bytes));
    let mut signing_bytes =
        Vec::with_capacity(envelope.signature_domain.len() + 1usize + payload_bytes.len());
    signing_bytes.extend_from_slice(envelope.signature_domain.as_bytes());
    signing_bytes.push(0);
    signing_bytes.extend_from_slice(&payload_bytes);
    let signing_bytes_sha256 = lowercase_hex(&Sha256::digest(&signing_bytes));
    Ok(SignatureMaterial {
        payload_bytes,
        payload_sha256,
        signing_bytes,
        signing_bytes_sha256,
    })
}

fn role_binding(role: &str) -> Option<(&'static str, &'static [&'static str])> {
    match role {
        "local-recorder" => Some((
            "tinyrustlm.signature.local-recorder.v1",
            &["receipt-recording"],
        )),
        "outside-network-observer" => Some((
            "tinyrustlm.signature.outside-network-observer.v1",
            &["outside-proof"],
        )),
        "p2p-publisher" => Some((
            "tinyrustlm.signature.p2p-publisher.v1",
            &["p2p-publication"],
        )),
        "release-authorizer" => Some((
            "tinyrustlm.signature.release-authorizer.v1",
            &[
                "authority-registry",
                "key-revocation",
                "release-authorization",
            ],
        )),
        "site-publisher" => Some((
            "tinyrustlm.signature.site-publisher.v1",
            &["site-publication"],
        )),
        _ => None,
    }
}

fn decode_canonical_base64(
    value: &str,
    expected_bytes: usize,
    error_code: &'static str,
) -> Result<Vec<u8>, SignatureError> {
    let decoded = STANDARD.decode(value).map_err(|_| failure(error_code))?;
    if decoded.len() != expected_bytes || STANDARD.encode(&decoded) != value {
        return Err(failure(error_code));
    }
    Ok(decoded)
}

const fn failure(code: &'static str) -> SignatureError {
    SignatureError { code }
}
