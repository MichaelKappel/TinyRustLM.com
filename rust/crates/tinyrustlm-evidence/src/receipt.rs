use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::net::{Ipv4Addr, Ipv6Addr};
use url::{Host, Url};

pub(crate) const RECEIPT_SCHEMA: &str = "tinyrustlm.vnext.receipt.v1";
pub(crate) const RECEIPT_IDENTITY_DOMAIN: &str = "tinyrustlm.receipt.content.v1";
pub(crate) const RECEIPT_MAXIMUM_BYTES: usize = 262_144;

const RECEIPT_TYPES: &[&str] = &[
    "acquisition",
    "authority-registry",
    "browser-round",
    "catalog-announcement",
    "conversation-evaluation",
    "conversion",
    "deployment",
    "discovery",
    "final-attestation",
    "key-revocation",
    "lane-serve",
    "memory-continuity",
    "native-evaluation",
    "offline-verification-bundle",
    "outside-proof",
    "p2p-preparation",
    "package",
    "public-readback",
    "qualification",
    "redaction-scan",
    "review",
    "screening",
    "signature-envelope",
    "site-synchronization",
    "structure",
    "training",
    "training-preparation",
];
const ROLES: &[&str] = &[
    "local-recorder",
    "outside-network-observer",
    "p2p-publisher",
    "release-authorizer",
    "site-publisher",
];
const SIGNED_SCHEMAS: &[&str] = &[
    "tinyrustlm.vnext.artifact_manifest.v1",
    "tinyrustlm.vnext.claim.v1",
    "tinyrustlm.vnext.companion_message.v1",
    "tinyrustlm.vnext.context.v1",
    "tinyrustlm.vnext.outside_proof.v2",
    "tinyrustlm.vnext.p2p_manifest.v1",
    "tinyrustlm.vnext.receipt.v1",
    "tinyrustlm.vnext.release_manifest.v1",
    "tinyrustlm.vnext.worker_message.v1",
];

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum RequiredNullable<T> {
    Null,
    Value(T),
}

impl<T> RequiredNullable<T> {
    pub(crate) fn as_ref(&self) -> Option<&T> {
        match self {
            Self::Null => None,
            Self::Value(value) => Some(value),
        }
    }

    fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }
}

impl<T: Serialize> Serialize for RequiredNullable<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Null => serializer.serialize_none(),
            Self::Value(value) => serializer.serialize_some(value),
        }
    }
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for RequiredNullable<T> {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Option::<T>::deserialize(deserializer).map(|value| match value {
            Some(value) => Self::Value(value),
            None => Self::Null,
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Receipt {
    pub(crate) attestation_reference: RequiredNullable<String>,
    pub(crate) attempt_id: String,
    pub(crate) authority_registry: RequiredNullable<AuthorityRegistry>,
    pub(crate) blocker_code: RequiredNullable<String>,
    pub(crate) campaign_id: String,
    pub(crate) canonical_content_sha256: String,
    pub(crate) completed_at_utc: String,
    pub(crate) configuration_sha256: String,
    pub(crate) error: RequiredNullable<ReceiptError>,
    pub(crate) external_evidence_references: Vec<ExternalReference>,
    pub(crate) input_hashes: Vec<HashBinding>,
    pub(crate) input_receipt_ids: Vec<String>,
    pub(crate) key_revocation: RequiredNullable<KeyRevocation>,
    pub(crate) offline_bundle: RequiredNullable<OfflineBundle>,
    pub(crate) output_hashes: Vec<HashBinding>,
    pub(crate) phase: String,
    pub(crate) public_parameters: Vec<PublicParameter>,
    pub(crate) receipt_id: String,
    pub(crate) receipt_type: String,
    pub(crate) redaction: Redaction,
    pub(crate) runtime: Runtime,
    pub(crate) schema: String,
    pub(crate) signature_envelope: RequiredNullable<SignatureEnvelope>,
    pub(crate) source_revision: String,
    pub(crate) started_at_utc: String,
    pub(crate) status: String,
    pub(crate) supersedes_receipt_ids: Vec<String>,
    pub(crate) tools: Vec<Tool>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct HashBinding {
    pub(crate) name: String,
    pub(crate) sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Tool {
    pub(crate) binary_sha256: String,
    pub(crate) name: String,
    pub(crate) version: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Runtime {
    pub(crate) architecture: String,
    pub(crate) execution_class: String,
    pub(crate) operating_system: String,
    pub(crate) runtime_identifier: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct PublicParameter {
    pub(crate) name: String,
    pub(crate) unit: RequiredNullable<String>,
    pub(crate) value: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct ReceiptError {
    code: String,
    failure_step: String,
    retry_status: String,
    rollback_status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct ExternalReference {
    kind: String,
    value: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Redaction {
    decision: String,
    profile: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct SignatureEnvelope {
    pub(crate) algorithm: String,
    pub(crate) authority_registry_receipt_id: String,
    pub(crate) campaign_id: String,
    pub(crate) expires_at_utc: RequiredNullable<String>,
    pub(crate) issued_at_utc: String,
    pub(crate) key_id: String,
    pub(crate) nonce_hash: String,
    pub(crate) release_id: RequiredNullable<String>,
    pub(crate) role: String,
    pub(crate) scope: String,
    pub(crate) signature: String,
    pub(crate) signature_domain: String,
    pub(crate) signed_payload_sha256: String,
    pub(crate) signed_schema: String,
    pub(crate) signed_subject_id: String,
    pub(crate) signer_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct AuthorityRegistry {
    pub(crate) allowed_clock_skew_seconds: u32,
    pub(crate) effective_at_utc: String,
    pub(crate) environment: String,
    pub(crate) expires_at_utc: String,
    pub(crate) keys: Vec<AuthorityKey>,
    pub(crate) previous_registry_receipt_id: RequiredNullable<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct AuthorityKey {
    pub(crate) key_id: String,
    pub(crate) public_key: String,
    pub(crate) role: String,
    pub(crate) signer_id: String,
    pub(crate) status: String,
    pub(crate) valid_from_utc: String,
    pub(crate) valid_until_utc: RequiredNullable<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct KeyRevocation {
    pub(crate) authority_registry_receipt_id: String,
    pub(crate) compromise_at_utc: RequiredNullable<String>,
    pub(crate) effective_at_utc: String,
    pub(crate) key_id: String,
    pub(crate) predecessor_registry_receipt_id: String,
    pub(crate) reason_code: String,
    pub(crate) replacement_key_id: RequiredNullable<String>,
    pub(crate) role: String,
    pub(crate) scope: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct OfflineBundle {
    pub(crate) authority_registry_receipt_ids: Vec<String>,
    pub(crate) bundle_manifest_sha256: String,
    pub(crate) created_at_utc: String,
    pub(crate) receipt_ids: Vec<String>,
    pub(crate) revocation_receipt_ids: Vec<String>,
    pub(crate) schema_hashes: Vec<HashBinding>,
    pub(crate) signature_envelope_receipt_ids: Vec<String>,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) struct UtcInstant {
    pub(crate) nanoseconds: i128,
}

pub(crate) fn validate_receipt_bytes(bytes: &[u8]) -> Result<Receipt, ()> {
    if bytes.is_empty() || bytes.len() > RECEIPT_MAXIMUM_BYTES {
        return Err(());
    }
    let receipt: Receipt = serde_json::from_slice(bytes).map_err(|_| ())?;
    validate_receipt(&receipt)?;
    let canonical = canonical_bytes(&receipt)?;
    if canonical != bytes {
        return Err(());
    }
    let mut content = serde_json::to_value(&receipt).map_err(|_| ())?;
    let object = content.as_object_mut().ok_or(())?;
    object.remove("canonicalContentSha256").ok_or(())?;
    object.remove("receiptId").ok_or(())?;
    let digest = domain_digest(RECEIPT_IDENTITY_DOMAIN, &canonical_value_bytes(&content)?);
    let digest_hex = lowercase_hex(&digest);
    if receipt.canonical_content_sha256 != digest_hex
        || receipt.receipt_id != format!("sha256:{digest_hex}")
    {
        return Err(());
    }
    Ok(receipt)
}

pub(crate) fn canonical_value_bytes(value: &Value) -> Result<Vec<u8>, ()> {
    let mut output = Vec::new();
    write_canonical_value(&mut output, value)?;
    Ok(output)
}

pub(crate) fn domain_digest(domain: &str, bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(domain.as_bytes());
    hasher.update([0]);
    hasher.update(bytes);
    hasher.finalize().into()
}

pub(crate) fn lowercase_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

pub(crate) fn valid_safe_id(value: &str) -> bool {
    let bytes = value.as_bytes();
    (3..=160).contains(&bytes.len())
        && (bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit())
        && bytes.iter().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"._:-".contains(byte)
        })
}

fn validate_receipt(receipt: &Receipt) -> Result<(), ()> {
    if receipt.schema != RECEIPT_SCHEMA
        || !valid_content_id(&receipt.receipt_id)
        || !valid_digest(&receipt.canonical_content_sha256)
        || !RECEIPT_TYPES.contains(&receipt.receipt_type.as_str())
        || !valid_safe_id(&receipt.campaign_id)
        || !valid_safe_id(&receipt.attempt_id)
        || !valid_safe_id(&receipt.phase)
        || !["blocked", "fail", "pass", "rejected", "stale", "superseded"]
            .contains(&receipt.status.as_str())
        || !valid_source_revision(&receipt.source_revision)
        || !strict_strings(&receipt.input_receipt_ids, 0, 2048, valid_content_id)
        || !strict_by(&receipt.input_hashes, 0, 256, |value| value.name.as_str())
        || !receipt.input_hashes.iter().all(valid_hash_binding)
        || !strict_by(&receipt.output_hashes, 0, 256, |value| value.name.as_str())
        || !receipt.output_hashes.iter().all(valid_hash_binding)
        || !strict_by(&receipt.tools, 1, 32, |value| value.name.as_str())
        || !receipt.tools.iter().all(valid_tool)
        || !valid_digest(&receipt.configuration_sha256)
        || !valid_runtime(&receipt.runtime)
        || !strict_by(&receipt.public_parameters, 0, 128, |value| {
            value.name.as_str()
        })
        || !receipt.public_parameters.iter().all(valid_public_parameter)
        || !strict_by(&receipt.external_evidence_references, 0, 64, |value| {
            value.value.as_str()
        })
        || !receipt
            .external_evidence_references
            .iter()
            .all(valid_external_reference)
        || receipt.redaction.profile != "tinyrustlm.vnext.public_safe.v1"
        || receipt.redaction.decision != "public-safe"
        || !valid_nullable(&receipt.attestation_reference, |value| {
            valid_content_id(value)
        })
        || !strict_strings(&receipt.supersedes_receipt_ids, 0, 64, valid_content_id)
    {
        return Err(());
    }
    let started = parse_utc(&receipt.started_at_utc)?;
    let completed = parse_utc(&receipt.completed_at_utc)?;
    if completed < started {
        return Err(());
    }
    if let Some(error) = receipt.error.as_ref() {
        if !valid_receipt_error(error) {
            return Err(());
        }
    }
    if matches!(receipt.status.as_str(), "fail" | "rejected") && receipt.error.is_null() {
        return Err(());
    }
    if receipt.status == "pass" && !receipt.error.is_null() {
        return Err(());
    }
    if !valid_nullable(&receipt.blocker_code, |value| valid_safe_id(value))
        || receipt.status == "blocked" && receipt.blocker_code.is_null()
    {
        return Err(());
    }
    validate_security_payloads(receipt)?;
    if receipt.receipt_type == "redaction-scan"
        && !receipt
            .input_hashes
            .iter()
            .any(|value| value.name == "target-canonical-content")
    {
        return Err(());
    }
    Ok(())
}

fn validate_security_payloads(receipt: &Receipt) -> Result<(), ()> {
    let expected = [
        ("signature-envelope", !receipt.signature_envelope.is_null()),
        ("authority-registry", !receipt.authority_registry.is_null()),
        ("key-revocation", !receipt.key_revocation.is_null()),
        (
            "offline-verification-bundle",
            !receipt.offline_bundle.is_null(),
        ),
    ];
    if expected
        .iter()
        .any(|(receipt_type, present)| (receipt.receipt_type == *receipt_type) != *present)
    {
        return Err(());
    }
    if expected
        .iter()
        .any(|(receipt_type, _)| receipt.receipt_type == *receipt_type)
        && receipt.status != "pass"
    {
        return Err(());
    }
    if let Some(value) = receipt.signature_envelope.as_ref() {
        validate_signature_envelope(value)?;
        if value.campaign_id != receipt.campaign_id {
            return Err(());
        }
    }
    if let Some(value) = receipt.authority_registry.as_ref() {
        validate_authority_registry(value)?;
    }
    if let Some(value) = receipt.key_revocation.as_ref() {
        validate_key_revocation(value)?;
    }
    if let Some(value) = receipt.offline_bundle.as_ref() {
        validate_offline_bundle(value)?;
    }
    Ok(())
}

fn validate_signature_envelope(value: &SignatureEnvelope) -> Result<(), ()> {
    let issued = parse_utc(&value.issued_at_utc)?;
    let expected_domain = match value.role.as_str() {
        "local-recorder" => "tinyrustlm.signature.local-recorder.v1",
        "outside-network-observer" => "tinyrustlm.signature.outside-network-observer.v1",
        "p2p-publisher" => "tinyrustlm.signature.p2p-publisher.v1",
        "release-authorizer" => "tinyrustlm.signature.release-authorizer.v1",
        "site-publisher" => "tinyrustlm.signature.site-publisher.v1",
        _ => return Err(()),
    };
    if value.algorithm != "ed25519"
        || value.signature_domain != expected_domain
        || !valid_safe_id(&value.signer_id)
        || !valid_safe_id(&value.key_id)
        || !valid_content_id(&value.authority_registry_receipt_id)
        || !valid_content_id(&value.signed_subject_id)
        || !SIGNED_SCHEMAS.contains(&value.signed_schema.as_str())
        || !valid_safe_id(&value.campaign_id)
        || !valid_nullable(&value.release_id, |value| valid_content_id(value))
        || !valid_safe_id(&value.scope)
        || !valid_digest(&value.signed_payload_sha256)
        || !valid_digest(&value.nonce_hash)
        || !canonical_base64(&value.signature, 64)
    {
        return Err(());
    }
    match value.expires_at_utc.as_ref() {
        None if value.role == "local-recorder" => Ok(()),
        None => Err(()),
        Some(expires) => {
            let expires = parse_utc(expires)?;
            let duration = expires.nanoseconds - issued.nanoseconds;
            if duration <= 0 || duration > 604_800_000_000_000 {
                Err(())
            } else {
                Ok(())
            }
        }
    }
}

fn validate_authority_registry(value: &AuthorityRegistry) -> Result<(), ()> {
    let effective = parse_utc(&value.effective_at_utc)?;
    let expires = parse_utc(&value.expires_at_utc)?;
    if !["development", "production", "staging"].contains(&value.environment.as_str())
        || !valid_nullable(&value.previous_registry_receipt_id, |value| {
            valid_content_id(value)
        })
        || expires <= effective
        || expires.nanoseconds - effective.nanoseconds > 31_536_000_000_000_000
        || value.allowed_clock_skew_seconds > 3600
        || !strict_by(&value.keys, 1, 64, |key| key.key_id.as_str())
    {
        return Err(());
    }
    for key in &value.keys {
        let from = parse_utc(&key.valid_from_utc)?;
        if !valid_safe_id(&key.key_id)
            || !valid_safe_id(&key.signer_id)
            || !ROLES.contains(&key.role.as_str())
            || !canonical_base64(&key.public_key, 32)
            || !["active", "retired", "revoked"].contains(&key.status.as_str())
            || from >= expires
        {
            return Err(());
        }
        if let Some(until) = key.valid_until_utc.as_ref() {
            if parse_utc(until)? <= from {
                return Err(());
            }
        }
    }
    Ok(())
}

fn validate_key_revocation(value: &KeyRevocation) -> Result<(), ()> {
    let effective = parse_utc(&value.effective_at_utc)?;
    if !valid_content_id(&value.authority_registry_receipt_id)
        || !valid_safe_id(&value.key_id)
        || !ROLES.contains(&value.role.as_str())
        || !valid_safe_id(&value.reason_code)
        || !valid_safe_id(&value.scope)
        || !valid_content_id(&value.predecessor_registry_receipt_id)
        || !valid_nullable(&value.replacement_key_id, |value| valid_safe_id(value))
    {
        return Err(());
    }
    if let Some(compromise) = value.compromise_at_utc.as_ref() {
        if parse_utc(compromise)? > effective {
            return Err(());
        }
    }
    Ok(())
}

fn validate_offline_bundle(value: &OfflineBundle) -> Result<(), ()> {
    if !valid_digest(&value.bundle_manifest_sha256)
        || !strict_strings(&value.receipt_ids, 1, 2048, valid_content_id)
        || !strict_strings(
            &value.signature_envelope_receipt_ids,
            1,
            1024,
            valid_content_id,
        )
        || !strict_strings(
            &value.authority_registry_receipt_ids,
            1,
            64,
            valid_content_id,
        )
        || !strict_strings(&value.revocation_receipt_ids, 0, 256, valid_content_id)
        || !strict_by(&value.schema_hashes, 9, 32, |entry| entry.name.as_str())
        || !value.schema_hashes.iter().all(valid_hash_binding)
        || parse_utc(&value.created_at_utc).is_err()
    {
        return Err(());
    }
    Ok(())
}

fn valid_hash_binding(value: &HashBinding) -> bool {
    valid_safe_id(&value.name) && valid_digest(&value.sha256)
}

fn valid_tool(value: &Tool) -> bool {
    valid_safe_id(&value.name)
        && valid_bounded_text(&value.version, 1, 64)
        && valid_digest(&value.binary_sha256)
}

fn valid_runtime(value: &Runtime) -> bool {
    valid_safe_id(&value.runtime_identifier)
        && ["browser", "linux", "macos", "windows"].contains(&value.operating_system.as_str())
        && ["aarch64", "wasm32", "x86_64"].contains(&value.architecture.as_str())
        && [
            "browser",
            "deployment",
            "emulated",
            "fixture",
            "live-service",
            "local",
            "outside-network",
            "package",
            "physical-hardware",
        ]
        .contains(&value.execution_class.as_str())
}

fn valid_public_parameter(value: &PublicParameter) -> bool {
    valid_safe_id(&value.name)
        && valid_bounded_text(&value.value, 1, 512)
        && valid_nullable(&value.unit, |value| valid_safe_id(value))
}

fn valid_receipt_error(value: &ReceiptError) -> bool {
    valid_safe_id(&value.code)
        && valid_safe_id(&value.failure_step)
        && ["none", "retryable", "terminal"].contains(&value.retry_status.as_str())
        && ["completed", "failed", "not-required", "pending"]
            .contains(&value.rollback_status.as_str())
}

fn valid_external_reference(value: &ExternalReference) -> bool {
    valid_bounded_text(&value.value, 1, 2048)
        && match value.kind.as_str() {
            "https" => valid_public_url(&value.value),
            "receipt" => valid_content_id(&value.value),
            _ => false,
        }
}

fn valid_public_url(value: &str) -> bool {
    if !value
        .as_bytes()
        .iter()
        .all(|byte| (0x21..=0x7e).contains(byte))
        || value.contains('\\')
        || contains_forbidden_percent_encoding(value)
    {
        return false;
    }
    let Ok(parsed) = Url::parse(value) else {
        return false;
    };
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.as_str() != value
    {
        return false;
    }
    match parsed.host() {
        Some(Host::Domain(host)) => {
            let host = host.to_ascii_lowercase();
            host != "localhost" && !host.ends_with(".localhost")
        }
        Some(Host::Ipv4(host)) => public_ipv4(host),
        Some(Host::Ipv6(host)) => public_ipv6(host),
        None => false,
    }
}

fn public_ipv4(value: Ipv4Addr) -> bool {
    let [a, b, _, _] = value.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || a == 100 && (64..=127).contains(&b)
        || a == 169 && b == 254
        || a == 172 && (16..=31).contains(&b)
        || a == 192 && b == 168)
}

fn public_ipv6(value: Ipv6Addr) -> bool {
    let octets = value.octets();
    !(value.is_unspecified()
        || value.is_loopback()
        || octets[0] & 0xfe == 0xfc
        || octets[0] == 0xfe && octets[1] & 0xc0 == 0x80
        || octets[0] == 0xff)
}

fn contains_forbidden_percent_encoding(value: &str) -> bool {
    value.as_bytes().windows(3).any(|window| {
        window[0] == b'%'
            && matches!(
                [
                    window[1].to_ascii_lowercase(),
                    window[2].to_ascii_lowercase()
                ],
                [b'2', b'e'] | [b'2', b'f'] | [b'5', b'c']
            )
    })
}

fn valid_nullable<T>(value: &RequiredNullable<T>, validator: impl Fn(&T) -> bool) -> bool {
    value.as_ref().is_none_or(validator)
}

fn strict_strings(
    values: &[String],
    minimum: usize,
    maximum: usize,
    validator: impl Fn(&str) -> bool,
) -> bool {
    (minimum..=maximum).contains(&values.len())
        && values.iter().all(|value| validator(value))
        && values.windows(2).all(|pair| pair[0] < pair[1])
}

fn strict_by<T>(values: &[T], minimum: usize, maximum: usize, key: impl Fn(&T) -> &str) -> bool {
    (minimum..=maximum).contains(&values.len())
        && values.windows(2).all(|pair| key(&pair[0]) < key(&pair[1]))
}

pub(crate) fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

pub(crate) fn valid_content_id(value: &str) -> bool {
    value.strip_prefix("sha256:").is_some_and(valid_digest)
}

fn valid_source_revision(value: &str) -> bool {
    value.strip_prefix("git-sha1:").is_some_and(|digest| {
        digest.len() == 40
            && digest
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    }) || value.strip_prefix("sha256:").is_some_and(valid_digest)
}

fn valid_bounded_text(value: &str, minimum: usize, maximum: usize) -> bool {
    let length = value.encode_utf16().count();
    (minimum..=maximum).contains(&length)
        && value.chars().all(|character| {
            let code = u32::from(character);
            code > 31 && !(127..=159).contains(&code)
        })
}

pub(crate) fn canonical_base64(value: &str, expected_bytes: usize) -> bool {
    STANDARD
        .decode(value)
        .is_ok_and(|bytes| bytes.len() == expected_bytes && STANDARD.encode(bytes) == value)
}

pub(crate) fn canonical_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>, ()> {
    let value = serde_json::to_value(value).map_err(|_| ())?;
    canonical_value_bytes(&value)
}

fn write_canonical_value(output: &mut Vec<u8>, value: &Value) -> Result<(), ()> {
    match value {
        Value::Null => output.extend_from_slice(b"null"),
        Value::Bool(true) => output.extend_from_slice(b"true"),
        Value::Bool(false) => output.extend_from_slice(b"false"),
        Value::Number(number) => {
            if !number.is_u64() && !number.is_i64() {
                return Err(());
            }
            output.extend_from_slice(number.to_string().as_bytes());
        }
        Value::String(value) => {
            serde_json::to_writer(output, value).map_err(|_| ())?;
        }
        Value::Array(values) => {
            output.push(b'[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                write_canonical_value(output, value)?;
            }
            output.push(b']');
        }
        Value::Object(values) => {
            output.push(b'{');
            let mut keys = values.keys().collect::<Vec<_>>();
            keys.sort_unstable_by(|left, right| utf16_cmp(left, right));
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                serde_json::to_writer(&mut *output, key).map_err(|_| ())?;
                output.push(b':');
                write_canonical_value(output, values.get(*key).ok_or(())?)?;
            }
            output.push(b'}');
        }
    }
    Ok(())
}

fn utf16_cmp(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}

pub(crate) fn parse_utc(value: &str) -> Result<UtcInstant, ()> {
    let bytes = value.as_bytes();
    if bytes.len() < 20
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
        || bytes.last() != Some(&b'Z')
    {
        return Err(());
    }
    let year = parse_decimal(&bytes[0..4])?;
    let month = parse_decimal(&bytes[5..7])?;
    let day = parse_decimal(&bytes[8..10])?;
    let hour = parse_decimal(&bytes[11..13])?;
    let minute = parse_decimal(&bytes[14..16])?;
    let second = parse_decimal(&bytes[17..19])?;
    if year < 100
        || !(1..=12).contains(&month)
        || day == 0
        || day > days_in_month(year, month)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return Err(());
    }
    let fraction = &bytes[19..bytes.len() - 1];
    let nanos = if fraction.is_empty() {
        0
    } else {
        if fraction[0] != b'.'
            || !(2..=10).contains(&fraction.len())
            || !fraction[1..].iter().all(u8::is_ascii_digit)
        {
            return Err(());
        }
        let mut digits = [b'0'; 9];
        digits[..fraction.len() - 1].copy_from_slice(&fraction[1..]);
        i128::from(parse_decimal(&digits)?)
    };
    let days = days_from_civil(i128::from(year), i128::from(month), i128::from(day));
    let seconds =
        days * 86_400 + i128::from(hour) * 3600 + i128::from(minute) * 60 + i128::from(second);
    Ok(UtcInstant {
        nanoseconds: seconds * 1_000_000_000 + nanos,
    })
}

fn parse_decimal(bytes: &[u8]) -> Result<u32, ()> {
    if bytes.is_empty() || !bytes.iter().all(u8::is_ascii_digit) {
        return Err(());
    }
    Ok(bytes
        .iter()
        .fold(0u32, |value, byte| value * 10 + u32::from(byte - b'0')))
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year.is_multiple_of(400) || year.is_multiple_of(4) && !year.is_multiple_of(100) => 29,
        2 => 28,
        _ => 0,
    }
}

fn days_from_civil(year: i128, month: i128, day: i128) -> i128 {
    let year = year - i128::from(month <= 2);
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let adjusted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    const VECTORS: &[u8] =
        include_bytes!("../../../../contracts/vnext/phase-invalidation-rust-vectors.v1.json");

    fn vector_receipt(case_name: &str) -> Vec<u8> {
        let corpus: Value = serde_json::from_slice(VECTORS).expect("vectors must parse");
        let entry = corpus["cases"]
            .as_array()
            .expect("cases must be an array")
            .iter()
            .find(|entry| entry["name"] == case_name)
            .expect("case must exist");
        let encoded = entry["receiptBytesBase64"][0]
            .as_str()
            .expect("receipt vector must be base64");
        STANDARD.decode(encoded).expect("base64 must decode")
    }

    fn rejection_receipt(case_name: &str) -> Vec<u8> {
        let corpus: Value = serde_json::from_slice(VECTORS).expect("vectors must parse");
        let entry = corpus["rejectionCases"]
            .as_array()
            .expect("rejectionCases must be an array")
            .iter()
            .find(|entry| entry["name"] == case_name)
            .expect("rejection case must exist");
        let encoded = entry["receiptBytesBase64"][0]
            .as_str()
            .expect("receipt vector must be base64");
        STANDARD.decode(encoded).expect("base64 must decode")
    }

    #[test]
    fn receipt_wire_rejects_missing_unknown_duplicate_and_identity_drift() {
        let bytes = vector_receipt("baseline-lineage");
        assert!(validate_receipt_bytes(&bytes).is_ok());
        assert!(validate_receipt_bytes(&[bytes.as_slice(), b"\n"].concat()).is_err());

        let mut value: Value = serde_json::from_slice(&bytes).expect("receipt must parse");
        value
            .as_object_mut()
            .expect("receipt must be an object")
            .remove("blockerCode");
        assert!(validate_receipt_bytes(&canonical_value_bytes(&value).unwrap()).is_err());

        let mut value: Value = serde_json::from_slice(&bytes).expect("receipt must parse");
        value
            .as_object_mut()
            .expect("receipt must be an object")
            .insert("unknown".to_owned(), Value::Null);
        assert!(validate_receipt_bytes(&canonical_value_bytes(&value).unwrap()).is_err());

        let mut value: Value = serde_json::from_slice(&bytes).expect("receipt must parse");
        value["attemptId"] = Value::String("acquisition-mutated-001".to_owned());
        assert!(validate_receipt_bytes(&canonical_value_bytes(&value).unwrap()).is_err());

        let marker = b"\"schema\":\"tinyrustlm.vnext.receipt.v1\"";
        let position = bytes
            .windows(marker.len())
            .position(|window| window == marker)
            .expect("schema marker must exist");
        let mut duplicate = Vec::new();
        duplicate.extend_from_slice(&bytes[..position]);
        duplicate.extend_from_slice(marker);
        duplicate.push(b',');
        duplicate.extend_from_slice(&bytes[position..]);
        assert!(validate_receipt_bytes(&duplicate).is_err());
    }

    #[test]
    fn receipt_primitives_enforce_exact_ids_time_order_and_public_urls() {
        assert!(valid_safe_id("model-alpha:001"));
        assert!(!valid_safe_id("Model-alpha:001"));
        assert!(!valid_safe_id("ab"));
        assert!(!valid_safe_id("model alpha"));

        let whole = parse_utc("2026-08-09T01:10:00Z").unwrap();
        let fraction = parse_utc("2026-08-09T01:10:00.000000001Z").unwrap();
        assert!(fraction > whole);
        assert!(parse_utc("2026-02-29T00:00:00Z").is_err());
        assert!(parse_utc("2024-02-29T00:00:00Z").is_ok());
        assert!(parse_utc("2026-08-09T01:10:00.0000000000Z").is_err());

        assert!(valid_public_url("https://example.com/path"));
        assert!(!valid_public_url("https://localhost/path"));
        assert!(!valid_public_url("https://127.0.0.1/path"));
        assert!(!valid_public_url("https://example.com/%2e%2e/path"));
        assert!(!valid_public_url("https://example.com/path?secret=value"));
    }

    #[test]
    fn receipt_security_payload_shape_is_validated_before_phase_filtering() {
        let bytes = rejection_receipt("unsupported-receipt-type");
        let mut receipt = validate_receipt_bytes(&bytes).expect("registry receipt must validate");
        assert_eq!(receipt.receipt_type, "authority-registry");
        receipt.receipt_type = "acquisition".to_owned();
        assert!(validate_receipt(&receipt).is_err());

        let registry = receipt
            .authority_registry
            .as_ref()
            .expect("registry payload must exist");
        assert_eq!(registry.keys.len(), 1);
        assert!(canonical_base64(&registry.keys[0].public_key, 32));
    }
}
