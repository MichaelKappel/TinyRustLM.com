use crate::authority::verify_authority_graph;
use crate::receipt::{
    canonical_bytes, canonical_value_bytes, lowercase_hex, parse_utc, valid_content_id,
    valid_digest, valid_safe_id, validate_receipt_bytes, HashBinding, Receipt,
    RECEIPT_MAXIMUM_BYTES, RECEIPT_SCHEMA,
};
use crate::subject::validate_identity_subject_bytes;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;

/// The one current offline verification-bundle profile identity.
pub const OFFLINE_BUNDLE_PROFILE_ID: &str = "tinyrustlm.vnext.offline-bundle.v1";
/// The SHA-256 of the exact frozen offline verification-bundle profile bytes.
pub const OFFLINE_BUNDLE_PROFILE_SHA256: &str =
    "2b14f8e2d4d176e020d2c3e89d05dda07acc933bc76df6044ddd5b4e7d751756";

const MANIFEST_SCHEMA: &str = "tinyrustlm.vnext.offline_bundle_manifest.v1";
const CANONICAL_JSON_PROFILE: &str = "rfc8785-jcs+tinyrustlm.strict-json.v1";
const MANIFEST_STATE: &str = "complete";
const VERIFICATION_RECEIPT_TYPE: &str = "offline-verification-bundle";
const MANIFEST_HASH_NAME: &str = "offline-bundle-manifest";
const MAXIMUM_MANIFEST_BYTES: usize = 4_194_304;
const MAXIMUM_RECEIPTS: usize = 2_048;
const MAXIMUM_SUBJECTS: usize = 2_048;
const MAXIMUM_TARGET_SIGNATURES: usize = 512;
const MAXIMUM_TOTAL_RECEIPT_BYTES: usize = 67_108_864;
const MAXIMUM_TOTAL_SUBJECT_BYTES: usize = 67_108_864;

const EXPECTED_PROFILE_BINDINGS: &[ExpectedProfileBinding] = &[
    ExpectedProfileBinding {
        byte_length: 4_857,
        document_id: "tinyrustlm.vnext.campaign-projection.v1",
        document_kind: "profile",
        name: "campaign-projection-profile",
        sha256: "a5ed56eb0c0b924eaac3222bb814732bd36f2bfeae217477cf7549ae732d4ae9",
    },
    ExpectedProfileBinding {
        byte_length: 40_674,
        document_id: "tinyrustlm-vnext-2026-08-09-r5",
        document_kind: "contract-registry",
        name: "contract-registry",
        sha256: "dd1534f577f5468f94d4b3b4d7d8985751fd1ddc4a28a2ccee9f47462449bbf0",
    },
    ExpectedProfileBinding {
        byte_length: 3_625,
        document_id: "tinyrustlm.vnext.offline-bundle.v1",
        document_kind: "profile",
        name: "offline-bundle-profile",
        sha256: OFFLINE_BUNDLE_PROFILE_SHA256,
    },
    ExpectedProfileBinding {
        byte_length: 2_721,
        document_id: "tinyrustlm.vnext.phase-invalidation.v1",
        document_kind: "profile",
        name: "phase-invalidation-profile",
        sha256: "924c515b2cddc081c9cbeac7e4c51fde213264ef2dff5bffcbc335430aafcbff",
    },
    ExpectedProfileBinding {
        byte_length: 2_710,
        document_id: "tinyrustlm.vnext.protected-equality-custody.v1",
        document_kind: "profile",
        name: "protected-equality-custody-profile",
        sha256: "db66fccab135294d950f8e1350ac2bab0947aad14b4ec87ac1565a6463b6730a",
    },
    ExpectedProfileBinding {
        byte_length: 4_040,
        document_id: "tinyrustlm.vnext.public-safe-redaction.v1",
        document_kind: "profile",
        name: "public-safe-redaction-profile",
        sha256: "4044b25f180949b0c9ef49cd60244ebbd0bb1a81479c0c9676fe30c8608e0e26",
    },
    ExpectedProfileBinding {
        byte_length: 5_726,
        document_id: "tinyrustlm.vnext.ed25519-authority.v1",
        document_kind: "profile",
        name: "receipt-signature-profile",
        sha256: "c9f3c6813e3880ebff6c79d9975ba085405208260715b0c68eafdfb9cfcb5721",
    },
    ExpectedProfileBinding {
        byte_length: 3_372,
        document_id: "tinyrustlm.vnext.receipt-store.v1",
        document_kind: "profile",
        name: "receipt-store-profile",
        sha256: "1721e8d26cfd93617ce570a744796c8d95d5fc1fd628ac3ee94f1a484832ade5",
    },
];

const EXPECTED_SCHEMA_BINDINGS: &[ExpectedSchemaBinding] = &[
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.artifact_manifest.v1",
        sha256: "f25892c5e3109bbc2c41c84ffa599de519d44c807186d590a29b9b0891afd729",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.claim.v2",
        sha256: "c124b1b59415a82f12be9ec9b1d8955852730b144e506ffd4ae0ebf63b2e5814",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.companion_message.v1",
        sha256: "1d539d60b97bb752406a12033f9469cf6c12dc8dc425d89eb514f2f5c22ba157",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.context.v1",
        sha256: "6baf28b3bfb663e0e9e4e2c4076d646a7513c3cda5231cf79e11227fb113e547",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.outside_proof.v2",
        sha256: "cddf74cb7a57c8ccd7bfcb2d4587d2f5b9a949b351c9c4adec01fbd1ad75bdac",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.p2p_manifest.v1",
        sha256: "43c2961a31e623946650b0998cd72467dae6861ab4c0ba964d5f4f74efccd54f",
    },
    ExpectedSchemaBinding {
        name: RECEIPT_SCHEMA,
        sha256: "55e8a406b618686d13452109331b627e084dedbbee464676ec0e4035d5319feb",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.release_manifest.v3",
        sha256: "0e03d1ab9445c9b668c92ade439aac71965267272bce854d88a10542a0deca58",
    },
    ExpectedSchemaBinding {
        name: "tinyrustlm.vnext.worker_message.v1",
        sha256: "8f83f0b58c4f9a3956fa7434990854ea00f7620cb127d91f4387a0f2f3bcea0e",
    },
];

struct ExpectedProfileBinding {
    byte_length: usize,
    document_id: &'static str,
    document_kind: &'static str,
    name: &'static str,
    sha256: &'static str,
}

struct ExpectedSchemaBinding {
    name: &'static str,
    sha256: &'static str,
}

/// One complete caller-supplied offline-bundle verification input.
#[derive(Clone, Copy, Debug)]
pub struct OfflineBundleVerificationInput<'a> {
    /// Exact canonical manifest bytes.
    pub bundle_manifest_bytes: &'a [u8],
    /// Caller-pinned SHA-256 of the exact manifest bytes.
    pub expected_bundle_manifest_sha256: &'a str,
    /// Caller-pinned campaign identity.
    pub expected_campaign_id: &'a str,
    /// Caller-pinned environment.
    pub expected_environment: &'a str,
    /// Caller-pinned terminal authority-registry receipt identity.
    pub expected_terminal_registry_receipt_id: &'a str,
    /// Exact canonical member receipt wires, excluding the verification receipt.
    pub receipt_bytes: &'a [Vec<u8>],
    /// Exact canonical non-receipt subject wires.
    pub subject_bytes: &'a [Vec<u8>],
    /// Caller-pinned trusted authority root receipt identity.
    pub trusted_root_registry_receipt_id: &'a str,
    /// Exact canonical offline-verification-bundle receipt wire.
    pub verification_receipt_bytes: &'a [u8],
    /// Caller-supplied verification time.
    pub verification_time_utc: &'a str,
}

/// One bounded, stable offline-bundle verification failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OfflineBundleError {
    code: &'static str,
}

impl OfflineBundleError {
    /// Returns the stable machine-readable public-safe failure code.
    pub const fn code(&self) -> &'static str {
        self.code
    }
}

impl fmt::Display for OfflineBundleError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for OfflineBundleError {}

/// An immutable canonical offline-bundle verification result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifiedOfflineBundle {
    bytes: Vec<u8>,
    sha256: String,
}

impl VerifiedOfflineBundle {
    /// Returns the exact canonical verification result bytes.
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

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Manifest {
    bundle_state: String,
    campaign_id: String,
    canonical_json_profile: String,
    created_at_utc: String,
    environment: String,
    expected_terminal_registry_receipt_id: String,
    profile_bindings: Vec<ProfileBinding>,
    profile_id: String,
    receipts: Vec<ReceiptMember>,
    schema: String,
    schema_hashes: Vec<SchemaBinding>,
    subjects: Vec<SubjectMember>,
    target_signature_receipt_ids: Vec<String>,
    totals: ManifestTotals,
    trusted_root_registry_receipt_id: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ProfileBinding {
    byte_length: usize,
    document_id: String,
    document_kind: String,
    name: String,
    sha256: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SchemaBinding {
    name: String,
    sha256: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ReceiptMember {
    byte_length: usize,
    receipt_id: String,
    receipt_type: String,
    schema: String,
    sha256: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SubjectMember {
    byte_length: usize,
    contract_class: String,
    schema: String,
    sha256: String,
    subject_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ManifestTotals {
    receipt_count: usize,
    subject_count: usize,
    total_receipt_bytes: usize,
    total_subject_bytes: usize,
}

struct ParsedReceiptMember {
    metadata: ReceiptMember,
    receipt: Receipt,
}

struct ParsedSubjectMember {
    metadata: SubjectMember,
}

struct Members {
    receipts: BTreeMap<String, ParsedReceiptMember>,
    subjects: BTreeMap<String, ParsedSubjectMember>,
    total_receipt_bytes: usize,
    total_subject_bytes: usize,
}

struct Categories {
    all_receipt_ids: Vec<String>,
    authority_registry_receipt_ids: Vec<String>,
    revocation_receipt_ids: Vec<String>,
    signature_envelope_receipt_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AuthorityResult {
    authority_graph_verified: bool,
    campaign_id: String,
    current_evidence_eligible_count: usize,
    environment: String,
    registry_depth: usize,
    signature_count: usize,
    signatures: Vec<AuthoritySignature>,
    terminal_registry_current: bool,
    terminal_registry_receipt_id: String,
    trusted_root_registry_receipt_id: String,
    verification_time_utc: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AuthoritySignature {
    authority_at_issue: bool,
    authority_registry_receipt_id: String,
    current_evidence_eligible: bool,
    key_id: String,
    role: String,
    scope: String,
    signature_receipt_id: String,
    signature_verified: bool,
    signed_schema: String,
    signed_subject_id: String,
    signer_id: String,
    stale_reasons: Vec<String>,
    temporal_current: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OfflineBundleResult<'a> {
    authority: AuthorityResult,
    bundle_manifest_sha256: &'a str,
    campaign_id: &'a str,
    environment: &'a str,
    offline_bundle_verified: bool,
    profile_id: &'static str,
    profile_sha256: &'static str,
    receipt_count: usize,
    subject_count: usize,
    target_current_evidence_eligible_count: usize,
    target_signature_receipt_ids: &'a [String],
    terminal_registry_receipt_id: &'a str,
    total_receipt_bytes: usize,
    total_subject_bytes: usize,
    trusted_root_registry_receipt_id: &'a str,
    verification_receipt_id: &'a str,
    verification_time_utc: &'a str,
}

/// Verifies one exact, bounded, closed offline evidence bundle without host I/O.
pub fn verify_offline_bundle(
    input: OfflineBundleVerificationInput<'_>,
) -> Result<VerifiedOfflineBundle, OfflineBundleError> {
    validate_input(&input)?;
    let verification_time = parse_utc(input.verification_time_utc)
        .map_err(|_| failure("offline_bundle_verification_time_invalid"))?;
    validate_collection(
        input.receipt_bytes,
        MAXIMUM_RECEIPTS,
        MAXIMUM_TOTAL_RECEIPT_BYTES,
        "offline_bundle_receipt_input_invalid",
    )?;
    validate_collection(
        input.subject_bytes,
        MAXIMUM_SUBJECTS,
        MAXIMUM_TOTAL_SUBJECT_BYTES,
        "offline_bundle_subject_input_invalid",
    )?;
    if input.verification_receipt_bytes.is_empty()
        || input.verification_receipt_bytes.len() > RECEIPT_MAXIMUM_BYTES
    {
        return Err(failure("offline_bundle_verification_receipt_input_invalid"));
    }

    let (manifest, manifest_sha256) = parse_manifest(
        input.bundle_manifest_bytes,
        input.expected_bundle_manifest_sha256,
    )?;
    if manifest.campaign_id != input.expected_campaign_id {
        return Err(failure("offline_bundle_campaign_mismatch"));
    }
    if manifest.environment != input.expected_environment {
        return Err(failure("offline_bundle_environment_mismatch"));
    }
    if manifest.trusted_root_registry_receipt_id != input.trusted_root_registry_receipt_id {
        return Err(failure("offline_bundle_trust_pin_mismatch"));
    }
    if manifest.expected_terminal_registry_receipt_id != input.expected_terminal_registry_receipt_id
    {
        return Err(failure("offline_bundle_terminal_pin_mismatch"));
    }
    let created_at = parse_utc(&manifest.created_at_utc)
        .map_err(|_| failure("offline_bundle_creation_time_invalid"))?;
    if created_at > verification_time {
        return Err(failure("offline_bundle_created_in_future"));
    }

    let members = parse_members(
        input.receipt_bytes,
        input.subject_bytes,
        input.expected_campaign_id,
    )?;
    require_exact_members(&members, &manifest)?;
    let categories = categories(&members);
    let verification_receipt = parse_verification_receipt(input.verification_receipt_bytes)?;
    require_verification_receipt(
        &verification_receipt,
        &manifest,
        &manifest_sha256,
        &categories,
    )?;

    let authority = verify_authority_graph(
        input.expected_campaign_id,
        input.expected_environment,
        input.verification_time_utc,
        input.trusted_root_registry_receipt_id,
        input.expected_terminal_registry_receipt_id,
        input.receipt_bytes,
        input.subject_bytes,
    )
    .map_err(|error| failure(error.code()))?;
    let authority: AuthorityResult = serde_json::from_slice(authority.bytes())
        .map_err(|_| failure("offline_bundle_authority_result_invalid"))?;
    if !authority.terminal_registry_current {
        return Err(failure("offline_bundle_terminal_registry_stale"));
    }
    require_closed_membership(&members, &manifest, &authority)?;

    let result = OfflineBundleResult {
        authority,
        bundle_manifest_sha256: &manifest_sha256,
        campaign_id: input.expected_campaign_id,
        environment: input.expected_environment,
        offline_bundle_verified: true,
        profile_id: OFFLINE_BUNDLE_PROFILE_ID,
        profile_sha256: OFFLINE_BUNDLE_PROFILE_SHA256,
        receipt_count: members.receipts.len(),
        subject_count: members.subjects.len(),
        target_current_evidence_eligible_count: manifest.target_signature_receipt_ids.len(),
        target_signature_receipt_ids: &manifest.target_signature_receipt_ids,
        terminal_registry_receipt_id: input.expected_terminal_registry_receipt_id,
        total_receipt_bytes: members.total_receipt_bytes,
        total_subject_bytes: members.total_subject_bytes,
        trusted_root_registry_receipt_id: input.trusted_root_registry_receipt_id,
        verification_receipt_id: &verification_receipt.receipt_id,
        verification_time_utc: input.verification_time_utc,
    };
    let value =
        serde_json::to_value(result).map_err(|_| failure("offline_bundle_result_invalid"))?;
    let bytes =
        canonical_value_bytes(&value).map_err(|_| failure("offline_bundle_result_invalid"))?;
    let sha256 = lowercase_hex(&Sha256::digest(&bytes));
    Ok(VerifiedOfflineBundle { bytes, sha256 })
}

fn validate_input(input: &OfflineBundleVerificationInput<'_>) -> Result<(), OfflineBundleError> {
    if !valid_digest(input.expected_bundle_manifest_sha256)
        || !valid_safe_id(input.expected_campaign_id)
        || !matches!(
            input.expected_environment,
            "development" | "production" | "staging"
        )
        || !valid_content_id(input.trusted_root_registry_receipt_id)
        || !valid_content_id(input.expected_terminal_registry_receipt_id)
    {
        return Err(failure("offline_bundle_input_value_invalid"));
    }
    if parse_utc(input.verification_time_utc).is_err() {
        return Err(failure("offline_bundle_verification_time_invalid"));
    }
    Ok(())
}

fn validate_collection(
    values: &[Vec<u8>],
    maximum_count: usize,
    maximum_bytes: usize,
    code: &'static str,
) -> Result<usize, OfflineBundleError> {
    if values.len() > maximum_count {
        return Err(failure(code));
    }
    values.iter().try_fold(0usize, |total, bytes| {
        total
            .checked_add(bytes.len())
            .filter(|value| *value <= maximum_bytes)
            .ok_or_else(|| failure(code))
    })
}

fn parse_manifest(
    bytes: &[u8],
    expected_sha256: &str,
) -> Result<(Manifest, String), OfflineBundleError> {
    if bytes.is_empty() || bytes.len() > MAXIMUM_MANIFEST_BYTES {
        return Err(failure("offline_bundle_manifest_invalid"));
    }
    serde_json::from_slice::<serde_json::Value>(bytes)
        .map_err(|_| failure("offline_bundle_manifest_invalid"))?;
    let manifest: Manifest = serde_json::from_slice(bytes)
        .map_err(|_| failure("offline_bundle_manifest_fields_invalid"))?;
    validate_manifest(&manifest)?;
    let canonical =
        canonical_bytes(&manifest).map_err(|_| failure("offline_bundle_manifest_invalid"))?;
    if canonical != bytes {
        return Err(failure("offline_bundle_manifest_noncanonical"));
    }
    let actual = lowercase_hex(&Sha256::digest(bytes));
    if actual != expected_sha256 {
        return Err(failure("offline_bundle_manifest_hash_mismatch"));
    }
    Ok((manifest, actual))
}

fn validate_manifest(manifest: &Manifest) -> Result<(), OfflineBundleError> {
    if manifest.schema != MANIFEST_SCHEMA
        || manifest.profile_id != OFFLINE_BUNDLE_PROFILE_ID
        || manifest.bundle_state != MANIFEST_STATE
        || manifest.canonical_json_profile != CANONICAL_JSON_PROFILE
    {
        return Err(failure("offline_bundle_manifest_profile_invalid"));
    }
    if !valid_safe_id(&manifest.campaign_id)
        || !matches!(
            manifest.environment.as_str(),
            "development" | "production" | "staging"
        )
        || !valid_content_id(&manifest.trusted_root_registry_receipt_id)
        || !valid_content_id(&manifest.expected_terminal_registry_receipt_id)
    {
        return Err(failure("offline_bundle_manifest_value_invalid"));
    }
    if parse_utc(&manifest.created_at_utc).is_err() {
        return Err(failure("offline_bundle_creation_time_invalid"));
    }
    if !profile_bindings_match(&manifest.profile_bindings) {
        return Err(failure("offline_bundle_profile_binding_mismatch"));
    }
    if !schema_bindings_match(&manifest.schema_hashes) {
        return Err(failure("offline_bundle_schema_binding_mismatch"));
    }
    if !strict_content_ids(
        &manifest.target_signature_receipt_ids,
        1,
        MAXIMUM_TARGET_SIGNATURES,
    ) {
        return Err(failure("offline_bundle_target_list_invalid"));
    }
    validate_manifest_members(manifest)?;
    let total_receipt_bytes = manifest
        .receipts
        .iter()
        .try_fold(0usize, |total, entry| total.checked_add(entry.byte_length))
        .ok_or_else(|| failure("offline_bundle_totals_invalid"))?;
    let total_subject_bytes = manifest
        .subjects
        .iter()
        .try_fold(0usize, |total, entry| total.checked_add(entry.byte_length))
        .ok_or_else(|| failure("offline_bundle_totals_invalid"))?;
    if manifest.totals.receipt_count != manifest.receipts.len()
        || manifest.totals.subject_count != manifest.subjects.len()
        || manifest.totals.total_receipt_bytes != total_receipt_bytes
        || manifest.totals.total_subject_bytes != total_subject_bytes
        || total_receipt_bytes > MAXIMUM_TOTAL_RECEIPT_BYTES
        || total_subject_bytes > MAXIMUM_TOTAL_SUBJECT_BYTES
    {
        return Err(failure("offline_bundle_totals_invalid"));
    }
    Ok(())
}

fn profile_bindings_match(values: &[ProfileBinding]) -> bool {
    values.len() == EXPECTED_PROFILE_BINDINGS.len()
        && values
            .iter()
            .zip(EXPECTED_PROFILE_BINDINGS)
            .all(|(actual, expected)| {
                actual.byte_length == expected.byte_length
                    && actual.document_id == expected.document_id
                    && actual.document_kind == expected.document_kind
                    && actual.name == expected.name
                    && actual.sha256 == expected.sha256
            })
}

fn schema_bindings_match(values: &[SchemaBinding]) -> bool {
    values.len() == EXPECTED_SCHEMA_BINDINGS.len()
        && values
            .iter()
            .zip(EXPECTED_SCHEMA_BINDINGS)
            .all(|(actual, expected)| {
                actual.name == expected.name && actual.sha256 == expected.sha256
            })
}

fn validate_manifest_members(manifest: &Manifest) -> Result<(), OfflineBundleError> {
    if manifest.receipts.len() > MAXIMUM_RECEIPTS
        || !manifest
            .receipts
            .windows(2)
            .all(|pair| pair[0].receipt_id < pair[1].receipt_id)
        || !manifest.receipts.iter().all(|entry| {
            valid_content_id(&entry.receipt_id)
                && entry.schema == RECEIPT_SCHEMA
                && !entry.receipt_type.is_empty()
                && (1..=RECEIPT_MAXIMUM_BYTES).contains(&entry.byte_length)
                && valid_digest(&entry.sha256)
        })
    {
        return Err(failure("offline_bundle_manifest_receipts_invalid"));
    }
    if manifest.subjects.len() > MAXIMUM_SUBJECTS
        || !manifest
            .subjects
            .windows(2)
            .all(|pair| pair[0].subject_id < pair[1].subject_id)
        || !manifest.subjects.iter().all(|entry| {
            valid_content_id(&entry.subject_id)
                && valid_safe_id(&entry.contract_class)
                && valid_safe_id(&entry.schema)
                && (1..=MAXIMUM_TOTAL_SUBJECT_BYTES).contains(&entry.byte_length)
                && valid_digest(&entry.sha256)
        })
    {
        return Err(failure("offline_bundle_manifest_subjects_invalid"));
    }
    Ok(())
}

fn strict_content_ids(values: &[String], minimum: usize, maximum: usize) -> bool {
    (minimum..=maximum).contains(&values.len())
        && values.iter().all(|value| valid_content_id(value))
        && values.windows(2).all(|pair| pair[0] < pair[1])
}

fn parse_members(
    receipt_bytes: &[Vec<u8>],
    subject_bytes: &[Vec<u8>],
    campaign_id: &str,
) -> Result<Members, OfflineBundleError> {
    let mut receipts = BTreeMap::new();
    for bytes in receipt_bytes {
        let receipt =
            validate_receipt_bytes(bytes).map_err(|_| failure("offline_bundle_receipt_invalid"))?;
        if receipts.contains_key(&receipt.receipt_id) {
            return Err(failure("offline_bundle_receipt_duplicate"));
        }
        if receipt.receipt_type == VERIFICATION_RECEIPT_TYPE {
            return Err(failure("offline_bundle_recursive_receipt"));
        }
        if receipt.campaign_id != campaign_id {
            return Err(failure("offline_bundle_campaign_mismatch"));
        }
        let metadata = ReceiptMember {
            byte_length: bytes.len(),
            receipt_id: receipt.receipt_id.clone(),
            receipt_type: receipt.receipt_type.clone(),
            schema: receipt.schema.clone(),
            sha256: lowercase_hex(&Sha256::digest(bytes)),
        };
        receipts.insert(
            receipt.receipt_id.clone(),
            ParsedReceiptMember { metadata, receipt },
        );
    }

    let mut subjects = BTreeMap::new();
    for bytes in subject_bytes {
        let subject = validate_identity_subject_bytes(bytes)
            .map_err(|_| failure("offline_bundle_subject_invalid"))?;
        if subjects.contains_key(&subject.subject_id) || receipts.contains_key(&subject.subject_id)
        {
            return Err(failure("offline_bundle_subject_duplicate"));
        }
        if subject
            .value
            .as_object()
            .and_then(|value| value.get("campaignId"))
            .is_some_and(|value| value.as_str() != Some(campaign_id))
        {
            return Err(failure("offline_bundle_campaign_mismatch"));
        }
        let metadata = SubjectMember {
            byte_length: bytes.len(),
            contract_class: subject.contract_class.clone(),
            schema: subject.schema.clone(),
            sha256: lowercase_hex(&Sha256::digest(bytes)),
            subject_id: subject.subject_id.clone(),
        };
        subjects.insert(subject.subject_id.clone(), ParsedSubjectMember { metadata });
    }

    Ok(Members {
        receipts,
        subjects,
        total_receipt_bytes: receipt_bytes.iter().map(Vec::len).sum(),
        total_subject_bytes: subject_bytes.iter().map(Vec::len).sum(),
    })
}

fn require_exact_members(members: &Members, manifest: &Manifest) -> Result<(), OfflineBundleError> {
    for expected in &manifest.receipts {
        let actual = members
            .receipts
            .get(&expected.receipt_id)
            .ok_or_else(|| failure("offline_bundle_receipt_missing"))?;
        if actual.metadata.sha256 != expected.sha256 {
            return Err(failure("offline_bundle_member_hash_mismatch"));
        }
        if actual.metadata != *expected {
            return Err(failure("offline_bundle_member_metadata_mismatch"));
        }
    }
    if members.receipts.len() != manifest.receipts.len() {
        return Err(failure("offline_bundle_receipt_extra"));
    }
    for expected in &manifest.subjects {
        let actual = members
            .subjects
            .get(&expected.subject_id)
            .ok_or_else(|| failure("offline_bundle_subject_missing"))?;
        if actual.metadata.sha256 != expected.sha256 {
            return Err(failure("offline_bundle_member_hash_mismatch"));
        }
        if actual.metadata != *expected {
            return Err(failure("offline_bundle_member_metadata_mismatch"));
        }
    }
    if members.subjects.len() != manifest.subjects.len() {
        return Err(failure("offline_bundle_subject_extra"));
    }
    Ok(())
}

fn categories(members: &Members) -> Categories {
    let mut result = Categories {
        all_receipt_ids: Vec::with_capacity(members.receipts.len()),
        authority_registry_receipt_ids: Vec::new(),
        revocation_receipt_ids: Vec::new(),
        signature_envelope_receipt_ids: Vec::new(),
    };
    for (id, member) in &members.receipts {
        result.all_receipt_ids.push(id.clone());
        match member.receipt.receipt_type.as_str() {
            "authority-registry" => result.authority_registry_receipt_ids.push(id.clone()),
            "key-revocation" => result.revocation_receipt_ids.push(id.clone()),
            "signature-envelope" => result.signature_envelope_receipt_ids.push(id.clone()),
            _ => {}
        }
    }
    result
}

fn parse_verification_receipt(bytes: &[u8]) -> Result<Receipt, OfflineBundleError> {
    validate_receipt_bytes(bytes)
        .map_err(|_| failure("offline_bundle_verification_receipt_invalid"))
}

fn require_verification_receipt(
    receipt: &Receipt,
    manifest: &Manifest,
    manifest_sha256: &str,
    categories: &Categories,
) -> Result<(), OfflineBundleError> {
    let payload = receipt
        .offline_bundle
        .as_ref()
        .ok_or_else(|| failure("offline_bundle_verification_receipt_invalid"))?;
    if receipt.receipt_type != VERIFICATION_RECEIPT_TYPE
        || receipt.status != "pass"
        || receipt.campaign_id != manifest.campaign_id
    {
        return Err(failure("offline_bundle_verification_receipt_invalid"));
    }
    if payload.bundle_manifest_sha256 != manifest_sha256
        || payload.created_at_utc != manifest.created_at_utc
        || !hash_bindings_match(&payload.schema_hashes, &manifest.schema_hashes)
    {
        return Err(failure("offline_bundle_receipt_manifest_binding_mismatch"));
    }
    if payload.receipt_ids != categories.all_receipt_ids
        || payload.signature_envelope_receipt_ids != categories.signature_envelope_receipt_ids
        || payload.authority_registry_receipt_ids != categories.authority_registry_receipt_ids
        || payload.revocation_receipt_ids != categories.revocation_receipt_ids
    {
        return Err(failure("offline_bundle_receipt_categories_mismatch"));
    }
    if receipt.input_receipt_ids != categories.all_receipt_ids {
        return Err(failure("offline_bundle_receipt_parents_mismatch"));
    }
    if receipt.input_hashes.len() != 1
        || receipt.input_hashes[0].name != MANIFEST_HASH_NAME
        || receipt.input_hashes[0].sha256 != manifest_sha256
    {
        return Err(failure("offline_bundle_receipt_manifest_binding_mismatch"));
    }
    if receipt.started_at_utc != manifest.created_at_utc
        || receipt.completed_at_utc != manifest.created_at_utc
        || categories
            .all_receipt_ids
            .binary_search(&receipt.receipt_id)
            .is_ok()
    {
        return Err(failure("offline_bundle_verification_receipt_invalid"));
    }
    Ok(())
}

fn hash_bindings_match(actual: &[HashBinding], expected: &[SchemaBinding]) -> bool {
    actual.len() == expected.len()
        && actual
            .iter()
            .zip(expected)
            .all(|(left, right)| left.name == right.name && left.sha256 == right.sha256)
}

fn require_closed_membership(
    members: &Members,
    manifest: &Manifest,
    authority: &AuthorityResult,
) -> Result<(), OfflineBundleError> {
    let signature_index = signature_index(members);
    let mut required_receipt_ids = BTreeSet::new();
    let mut required_subject_ids = BTreeSet::new();

    for (id, member) in &members.receipts {
        match member.receipt.receipt_type.as_str() {
            "authority-registry" => {
                required_receipt_ids.insert(id.clone());
                if member
                    .receipt
                    .authority_registry
                    .as_ref()
                    .and_then(|value| value.previous_registry_receipt_id.as_ref())
                    .is_some()
                {
                    required_receipt_ids.insert(one_signature(
                        &signature_index,
                        id,
                        "authority-registry",
                    )?);
                }
            }
            "key-revocation" => {
                required_receipt_ids.insert(id.clone());
                required_receipt_ids.insert(one_signature(&signature_index, id, "key-revocation")?);
            }
            _ => {}
        }
    }

    let authority_by_signature = authority
        .signatures
        .iter()
        .map(|entry| (entry.signature_receipt_id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    for id in &manifest.target_signature_receipt_ids {
        let member = members
            .receipts
            .get(id)
            .filter(|entry| entry.receipt.receipt_type == "signature-envelope")
            .ok_or_else(|| failure("offline_bundle_target_signature_missing"))?;
        let envelope = member
            .receipt
            .signature_envelope
            .as_ref()
            .ok_or_else(|| failure("offline_bundle_target_signature_missing"))?;
        if matches!(
            envelope.scope.as_str(),
            "authority-registry" | "key-revocation"
        ) {
            return Err(failure("offline_bundle_target_signature_invalid"));
        }
        required_receipt_ids.insert(id.clone());
        if envelope.signed_schema == RECEIPT_SCHEMA {
            required_receipt_ids.insert(envelope.signed_subject_id.clone());
        } else {
            required_subject_ids.insert(envelope.signed_subject_id.clone());
        }
        if !authority_by_signature
            .get(id.as_str())
            .is_some_and(|entry| entry.current_evidence_eligible)
        {
            return Err(failure("offline_bundle_target_stale"));
        }
    }

    let mut pending = required_receipt_ids.iter().cloned().collect::<Vec<_>>();
    let mut index = 0usize;
    while index < pending.len() {
        let id = &pending[index];
        let member = members
            .receipts
            .get(id)
            .ok_or_else(|| failure("offline_bundle_receipt_closure_incomplete"))?;
        for parent in collect_parent_receipt_ids(&member.receipt) {
            if !members.receipts.contains_key(&parent) {
                return Err(failure("offline_bundle_receipt_closure_incomplete"));
            }
            if required_receipt_ids.insert(parent.clone()) {
                pending.push(parent);
            }
        }
        index += 1;
    }
    if required_receipt_ids.len() != members.receipts.len()
        || members
            .receipts
            .keys()
            .any(|id| !required_receipt_ids.contains(id))
    {
        return Err(failure("offline_bundle_receipt_unlinked"));
    }
    for id in &required_subject_ids {
        if !members.subjects.contains_key(id) {
            return Err(failure("offline_bundle_subject_missing"));
        }
    }
    if required_subject_ids.len() != members.subjects.len()
        || members
            .subjects
            .keys()
            .any(|id| !required_subject_ids.contains(id))
    {
        return Err(failure("offline_bundle_subject_unlinked"));
    }
    Ok(())
}

fn signature_index(members: &Members) -> BTreeMap<(String, String), Vec<String>> {
    let mut result = BTreeMap::<(String, String), Vec<String>>::new();
    for (id, member) in &members.receipts {
        if member.receipt.receipt_type != "signature-envelope" {
            continue;
        }
        if let Some(envelope) = member.receipt.signature_envelope.as_ref() {
            result
                .entry((envelope.signed_subject_id.clone(), envelope.scope.clone()))
                .or_default()
                .push(id.clone());
        }
    }
    result
}

fn one_signature(
    index: &BTreeMap<(String, String), Vec<String>>,
    subject_id: &str,
    scope: &str,
) -> Result<String, OfflineBundleError> {
    let values = index
        .get(&(subject_id.to_owned(), scope.to_owned()))
        .map(Vec::as_slice)
        .unwrap_or_default();
    if values.len() != 1 {
        return Err(failure("offline_bundle_governance_signature_invalid"));
    }
    Ok(values[0].clone())
}

fn collect_parent_receipt_ids(receipt: &Receipt) -> BTreeSet<String> {
    let mut parents = BTreeSet::new();
    parents.extend(receipt.input_receipt_ids.iter().cloned());
    parents.extend(receipt.supersedes_receipt_ids.iter().cloned());
    if let Some(value) = receipt.attestation_reference.as_ref() {
        parents.insert(value.clone());
    }
    if let Some(value) = receipt.signature_envelope.as_ref() {
        parents.insert(value.authority_registry_receipt_id.clone());
        if value.signed_schema == RECEIPT_SCHEMA {
            parents.insert(value.signed_subject_id.clone());
        }
    }
    if let Some(value) = receipt.authority_registry.as_ref() {
        if let Some(previous) = value.previous_registry_receipt_id.as_ref() {
            parents.insert(previous.clone());
        }
    }
    if let Some(value) = receipt.key_revocation.as_ref() {
        parents.insert(value.authority_registry_receipt_id.clone());
        parents.insert(value.predecessor_registry_receipt_id.clone());
    }
    if let Some(value) = receipt.offline_bundle.as_ref() {
        parents.extend(value.receipt_ids.iter().cloned());
        parents.extend(value.signature_envelope_receipt_ids.iter().cloned());
        parents.extend(value.authority_registry_receipt_ids.iter().cloned());
        parents.extend(value.revocation_receipt_ids.iter().cloned());
    }
    parents
}

const fn failure(code: &'static str) -> OfflineBundleError {
    OfflineBundleError { code }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_ID: &str =
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    #[test]
    fn rejects_resource_excess_before_parsing_untrusted_members() {
        let receipts = vec![Vec::new(); MAXIMUM_RECEIPTS + 1];
        let input = OfflineBundleVerificationInput {
            bundle_manifest_bytes: b"{}",
            expected_bundle_manifest_sha256:
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            expected_campaign_id: "campaign-vnext-001",
            expected_environment: "production",
            expected_terminal_registry_receipt_id: VALID_ID,
            receipt_bytes: &receipts,
            subject_bytes: &[],
            trusted_root_registry_receipt_id: VALID_ID,
            verification_receipt_bytes: b"{}",
            verification_time_utc: "2026-08-09T00:30:00Z",
        };
        assert_eq!(
            verify_offline_bundle(input).unwrap_err().code(),
            "offline_bundle_receipt_input_invalid"
        );
    }

    #[test]
    fn rejects_oversized_manifest_and_verification_receipt() {
        let manifest = vec![b' '; MAXIMUM_MANIFEST_BYTES + 1];
        let input = OfflineBundleVerificationInput {
            bundle_manifest_bytes: &manifest,
            expected_bundle_manifest_sha256:
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            expected_campaign_id: "campaign-vnext-001",
            expected_environment: "production",
            expected_terminal_registry_receipt_id: VALID_ID,
            receipt_bytes: &[],
            subject_bytes: &[],
            trusted_root_registry_receipt_id: VALID_ID,
            verification_receipt_bytes: b"{}",
            verification_time_utc: "2026-08-09T00:30:00Z",
        };
        assert_eq!(
            verify_offline_bundle(input).unwrap_err().code(),
            "offline_bundle_manifest_invalid"
        );

        let verification_receipt = vec![b' '; RECEIPT_MAXIMUM_BYTES + 1];
        let input = OfflineBundleVerificationInput {
            bundle_manifest_bytes: b"{}",
            verification_receipt_bytes: &verification_receipt,
            ..input
        };
        assert_eq!(
            verify_offline_bundle(input).unwrap_err().code(),
            "offline_bundle_verification_receipt_input_invalid"
        );
    }
}
