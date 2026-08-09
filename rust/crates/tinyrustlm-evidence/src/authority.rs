use crate::receipt::{
    canonical_bytes, canonical_value_bytes, lowercase_hex, parse_utc, valid_content_id,
    valid_safe_id, validate_receipt_bytes, AuthorityKey, AuthorityRegistry, KeyRevocation, Receipt,
    SignatureEnvelope, UtcInstant,
};
use crate::signature::verify_signature_primitive;
use crate::subject::{validate_identity_subject_bytes, IdentitySubject};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;

/// The one current authority-graph profile identity.
pub const AUTHORITY_PROFILE_ID: &str = "tinyrustlm.vnext.ed25519-authority.v1";
/// The SHA-256 of the exact frozen authority profile bytes.
pub const AUTHORITY_PROFILE_SHA256: &str =
    "b1f5f1347ee14e1219972607c58f97f7c2b8f26545d09d1c02eeec970f946b56";

const MAXIMUM_RECEIPTS: usize = 4096;
const MAXIMUM_SUBJECTS: usize = 2048;
const MAXIMUM_TOTAL_RECEIPT_BYTES: usize = 67_108_864;
const MAXIMUM_TOTAL_SUBJECT_BYTES: usize = 67_108_864;
const MAXIMUM_REGISTRIES: usize = 64;
const MAXIMUM_REGISTRY_DEPTH: usize = 64;
const MAXIMUM_SIGNATURES: usize = 1024;
const MAXIMUM_REVOCATIONS: usize = 256;
const MAXIMUM_CLOCK_SKEW_SECONDS: u32 = 3600;
const RECEIPT_SCHEMA: &str = "tinyrustlm.vnext.receipt.v1";
const OUTSIDE_PROOF_SCHEMA: &str = "tinyrustlm.vnext.outside_proof.v2";
const SUBJECT_HASH_BINDING: &str = "signed-subject-canonical-content";

/// One bounded, stable authority-graph verification failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AuthorityError {
    code: &'static str,
}

impl AuthorityError {
    /// Returns the stable machine-readable public-safe failure code.
    pub const fn code(&self) -> &'static str {
        self.code
    }
}

impl fmt::Display for AuthorityError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for AuthorityError {}

/// An immutable canonical authority-graph result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifiedAuthorityGraph {
    bytes: Vec<u8>,
    sha256: String,
}

impl VerifiedAuthorityGraph {
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

struct Documents {
    receipt_order: Vec<String>,
    receipts: BTreeMap<String, Receipt>,
    subjects: BTreeMap<String, IdentitySubject>,
}

struct Registries {
    by_id: BTreeMap<String, String>,
    chain: Vec<String>,
    root: String,
    terminal: String,
}

#[derive(Clone)]
struct RevocationHistory {
    revocation: KeyRevocation,
}

struct Revocations {
    history_by_key: BTreeMap<String, Vec<RevocationHistory>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthorityResult<'a> {
    authority_graph_verified: bool,
    campaign_id: &'a str,
    current_evidence_eligible_count: usize,
    environment: &'a str,
    registry_depth: usize,
    signature_count: usize,
    signatures: Vec<SignatureResult>,
    terminal_registry_current: bool,
    terminal_registry_receipt_id: &'a str,
    trusted_root_registry_receipt_id: &'a str,
    verification_time_utc: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SignatureResult {
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

enum SignedSubject<'a> {
    Receipt(&'a Receipt),
    Identity(&'a IdentitySubject),
}

impl SignedSubject<'_> {
    fn schema(&self) -> &str {
        match self {
            Self::Receipt(value) => &value.schema,
            Self::Identity(value) => &value.schema,
        }
    }

    fn subject_id(&self) -> &str {
        match self {
            Self::Receipt(value) => &value.receipt_id,
            Self::Identity(value) => &value.subject_id,
        }
    }

    fn canonical_content_sha256(&self) -> &str {
        match self {
            Self::Receipt(value) => &value.canonical_content_sha256,
            Self::Identity(value) => &value.canonical_content_sha256,
        }
    }
}

/// Verifies a complete bounded receipt authority graph from exact canonical wires.
#[allow(clippy::too_many_arguments)]
pub fn verify_authority_graph(
    campaign_id: &str,
    environment: &str,
    verification_time_utc: &str,
    trusted_root_registry_receipt_id: &str,
    expected_terminal_registry_receipt_id: &str,
    receipt_bytes: &[Vec<u8>],
    subject_bytes: &[Vec<u8>],
) -> Result<VerifiedAuthorityGraph, AuthorityError> {
    validate_input_values(
        campaign_id,
        environment,
        trusted_root_registry_receipt_id,
        expected_terminal_registry_receipt_id,
    )?;
    let verification_time = parse_utc(verification_time_utc)
        .map_err(|_| failure("authority_verification_time_invalid"))?;
    validate_byte_collection(
        receipt_bytes,
        MAXIMUM_RECEIPTS,
        MAXIMUM_TOTAL_RECEIPT_BYTES,
        "authority_receipt_input_invalid",
    )?;
    validate_byte_collection(
        subject_bytes,
        MAXIMUM_SUBJECTS,
        MAXIMUM_TOTAL_SUBJECT_BYTES,
        "authority_subject_input_invalid",
    )?;

    let documents = parse_documents(campaign_id, receipt_bytes, subject_bytes)?;
    let registries = build_registry_chain(
        environment,
        trusted_root_registry_receipt_id,
        expected_terminal_registry_receipt_id,
        &documents,
    )?;
    let signature_receipt_ids = documents
        .receipt_order
        .iter()
        .filter(|id| documents.receipts[*id].receipt_type == "signature-envelope")
        .cloned()
        .collect::<Vec<_>>();
    if signature_receipt_ids.len() > MAXIMUM_SIGNATURES {
        return Err(failure("authority_signature_count_invalid"));
    }
    let signature_index = signature_index(&signature_receipt_ids, &documents)?;
    validate_successor_signatures(&registries, &signature_index, &documents)?;
    let revocations = validate_revocations(&documents, &registries, &signature_index)?;
    let (signatures, terminal_registry_current) = verify_signatures(
        campaign_id,
        verification_time,
        &documents,
        &registries,
        &revocations,
        &signature_receipt_ids,
    )?;
    let current_evidence_eligible_count = signatures
        .iter()
        .filter(|entry| entry.current_evidence_eligible)
        .count();
    let result = AuthorityResult {
        authority_graph_verified: true,
        campaign_id,
        current_evidence_eligible_count,
        environment,
        registry_depth: registries.chain.len(),
        signature_count: signatures.len(),
        signatures,
        terminal_registry_current,
        terminal_registry_receipt_id: &registries.terminal,
        trusted_root_registry_receipt_id: &registries.root,
        verification_time_utc,
    };
    let value = serde_json::to_value(result).map_err(|_| failure("authority_result_invalid"))?;
    let bytes = canonical_value_bytes(&value).map_err(|_| failure("authority_result_invalid"))?;
    let sha256 = lowercase_hex(&Sha256::digest(&bytes));
    Ok(VerifiedAuthorityGraph { bytes, sha256 })
}

fn validate_input_values(
    campaign_id: &str,
    environment: &str,
    root: &str,
    terminal: &str,
) -> Result<(), AuthorityError> {
    if !valid_safe_id(campaign_id)
        || !matches!(environment, "development" | "production" | "staging")
        || !valid_content_id(root)
        || !valid_content_id(terminal)
    {
        return Err(failure("authority_input_value_invalid"));
    }
    Ok(())
}

fn validate_byte_collection(
    values: &[Vec<u8>],
    maximum_count: usize,
    maximum_bytes: usize,
    code: &'static str,
) -> Result<(), AuthorityError> {
    if values.len() > maximum_count {
        return Err(failure(code));
    }
    let total = values
        .iter()
        .try_fold(0usize, |total, value| total.checked_add(value.len()))
        .ok_or_else(|| failure(code))?;
    if total > maximum_bytes {
        return Err(failure(code));
    }
    Ok(())
}

fn parse_documents(
    campaign_id: &str,
    receipt_bytes: &[Vec<u8>],
    subject_bytes: &[Vec<u8>],
) -> Result<Documents, AuthorityError> {
    let mut receipt_order = Vec::with_capacity(receipt_bytes.len());
    let mut receipts = BTreeMap::new();
    for bytes in receipt_bytes {
        let receipt = validate_receipt_bytes(bytes)
            .map_err(|_| failure("authority_receipt_input_invalid"))?;
        if receipts.contains_key(&receipt.receipt_id) {
            return Err(failure("authority_receipt_duplicate"));
        }
        if receipt.campaign_id != campaign_id {
            return Err(failure("authority_campaign_mismatch"));
        }
        receipt_order.push(receipt.receipt_id.clone());
        receipts.insert(receipt.receipt_id.clone(), receipt);
    }

    let mut subjects = BTreeMap::new();
    for bytes in subject_bytes {
        if serde_json::from_slice::<Value>(bytes)
            .ok()
            .and_then(|value| {
                value
                    .get("schema")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            })
            .as_deref()
            == Some(RECEIPT_SCHEMA)
        {
            return Err(failure("authority_subject_receipt_wrong_collection"));
        }
        let subject = validate_identity_subject_bytes(bytes).map_err(failure)?;
        if subjects.contains_key(&subject.subject_id) || receipts.contains_key(&subject.subject_id)
        {
            return Err(failure("authority_subject_duplicate"));
        }
        if subject
            .value
            .get("campaignId")
            .and_then(Value::as_str)
            .is_some_and(|value| value != campaign_id)
        {
            return Err(failure("authority_campaign_mismatch"));
        }
        subjects.insert(subject.subject_id.clone(), subject);
    }
    Ok(Documents {
        receipt_order,
        receipts,
        subjects,
    })
}

fn build_registry_chain(
    environment: &str,
    trusted_root: &str,
    expected_terminal: &str,
    documents: &Documents,
) -> Result<Registries, AuthorityError> {
    let registry_ids = documents
        .receipt_order
        .iter()
        .filter(|id| documents.receipts[*id].receipt_type == "authority-registry")
        .cloned()
        .collect::<Vec<_>>();
    if registry_ids.is_empty() || registry_ids.len() > MAXIMUM_REGISTRIES {
        return Err(failure("authority_registry_count_invalid"));
    }
    let by_id = registry_ids
        .iter()
        .map(|id| (id.clone(), id.clone()))
        .collect::<BTreeMap<_, _>>();
    if !by_id.contains_key(trusted_root) {
        return Err(failure("trusted_root_registry_missing"));
    }
    if !by_id.contains_key(expected_terminal) {
        return Err(failure("terminal_registry_missing"));
    }
    for id in &registry_ids {
        let registry = authority_registry(&documents.receipts[id])?;
        if registry.environment != environment {
            return Err(failure("authority_registry_environment_mismatch"));
        }
        if registry.allowed_clock_skew_seconds > MAXIMUM_CLOCK_SKEW_SECONDS {
            return Err(failure("authority_registry_clock_skew_invalid"));
        }
    }
    if authority_registry(&documents.receipts[trusted_root])?
        .previous_registry_receipt_id
        .as_ref()
        .is_some()
    {
        return Err(failure("trusted_root_registry_not_root"));
    }

    let mut child_counts = BTreeMap::<String, usize>::new();
    for id in &registry_ids {
        if let Some(previous) = authority_registry(&documents.receipts[id])?
            .previous_registry_receipt_id
            .as_ref()
        {
            *child_counts.entry(previous.clone()).or_default() += 1;
        }
    }
    if child_counts.values().any(|count| *count > 1) {
        return Err(failure("authority_registry_fork"));
    }

    let mut reversed = Vec::new();
    let mut visited = BTreeSet::new();
    let mut cursor = expected_terminal.to_owned();
    loop {
        if !visited.insert(cursor.clone()) {
            return Err(failure("authority_registry_cycle"));
        }
        if reversed.len() >= MAXIMUM_REGISTRY_DEPTH {
            return Err(failure("authority_registry_depth_exceeded"));
        }
        reversed.push(cursor.clone());
        let previous = authority_registry(&documents.receipts[&cursor])?
            .previous_registry_receipt_id
            .as_ref()
            .cloned();
        let Some(previous) = previous else {
            break;
        };
        if !by_id.contains_key(&previous) {
            return Err(failure("authority_registry_predecessor_missing"));
        }
        cursor = previous;
    }
    reversed.reverse();
    if reversed.first().map(String::as_str) != Some(trusted_root) {
        return Err(failure("trusted_root_registry_chain_mismatch"));
    }
    if reversed.len() != registry_ids.len() {
        return Err(failure("authority_registry_unlinked"));
    }
    for (position, id) in reversed.iter().enumerate() {
        let current = &documents.receipts[id];
        let (current_effective, current_expires) = registry_times(current)?;
        if current_expires <= current_effective {
            return Err(failure("authority_registry_time_invalid"));
        }
        if position == 0 {
            continue;
        }
        let previous_id = &reversed[position - 1];
        let previous = &documents.receipts[previous_id];
        let (previous_effective, previous_expires) = registry_times(previous)?;
        if authority_registry(current)?
            .previous_registry_receipt_id
            .as_ref()
            != Some(previous_id)
            || current_effective <= previous_effective
        {
            return Err(failure("authority_registry_rollback"));
        }
        if current_effective > previous_expires {
            return Err(failure("authority_registry_gap"));
        }
    }
    Ok(Registries {
        by_id,
        chain: reversed,
        root: trusted_root.to_owned(),
        terminal: expected_terminal.to_owned(),
    })
}

fn signature_index(
    signature_ids: &[String],
    documents: &Documents,
) -> Result<BTreeMap<(String, String), Vec<String>>, AuthorityError> {
    let mut result = BTreeMap::<(String, String), Vec<String>>::new();
    for id in signature_ids {
        let envelope = signature_envelope(&documents.receipts[id])?;
        result
            .entry((envelope.signed_subject_id.clone(), envelope.scope.clone()))
            .or_default()
            .push(id.clone());
    }
    Ok(result)
}

fn require_one_signature(
    index: &BTreeMap<(String, String), Vec<String>>,
    subject_id: &str,
    scope: &str,
    missing_code: &'static str,
    duplicate_code: &'static str,
) -> Result<String, AuthorityError> {
    let values = index
        .get(&(subject_id.to_owned(), scope.to_owned()))
        .map(Vec::as_slice)
        .unwrap_or_default();
    match values {
        [] => Err(failure(missing_code)),
        [value] => Ok(value.clone()),
        _ => Err(failure(duplicate_code)),
    }
}

fn validate_successor_signatures(
    registries: &Registries,
    index: &BTreeMap<(String, String), Vec<String>>,
    documents: &Documents,
) -> Result<(), AuthorityError> {
    for pair in registries.chain.windows(2) {
        let signature_id = require_one_signature(
            index,
            &pair[1],
            "authority-registry",
            "registry_successor_signature_missing",
            "registry_successor_signature_duplicate",
        )?;
        if signature_envelope(&documents.receipts[&signature_id])?.authority_registry_receipt_id
            != pair[0]
        {
            return Err(failure("registry_successor_signature_registry_mismatch"));
        }
    }
    Ok(())
}

fn validate_key_continuity(previous: &Receipt, successor: &Receipt) -> Result<(), AuthorityError> {
    let before = key_map(authority_registry(previous)?);
    let after = key_map(authority_registry(successor)?);
    let successor_effective = registry_times(successor)?.0;
    for (key_id, old_key) in &before {
        let Some(new_key) = after.get(key_id) else {
            return Err(failure("registry_key_removed"));
        };
        if new_key.signer_id != old_key.signer_id
            || new_key.role != old_key.role
            || new_key.public_key != old_key.public_key
            || new_key.valid_from_utc != old_key.valid_from_utc
        {
            return Err(failure("registry_key_material_changed"));
        }
        if old_key.valid_until_utc.as_ref().is_some()
            && old_key.valid_until_utc.as_ref() != new_key.valid_until_utc.as_ref()
        {
            return Err(failure("registry_key_validity_changed"));
        }
        if old_key.valid_until_utc.as_ref().is_none()
            && new_key.valid_until_utc.as_ref().is_some_and(|value| {
                parse_utc(value).is_ok_and(|value| value < successor_effective)
            })
        {
            return Err(failure("registry_key_validity_changed"));
        }
        let transition_valid = match old_key.status.as_str() {
            "active" => matches!(new_key.status.as_str(), "active" | "retired" | "revoked"),
            "retired" => matches!(new_key.status.as_str(), "retired" | "revoked"),
            "revoked" => new_key.status == "revoked",
            _ => false,
        };
        if !transition_valid {
            return Err(failure("registry_key_status_rollback"));
        }
    }
    if after
        .iter()
        .any(|(key_id, key)| !before.contains_key(key_id) && key.status != "active")
    {
        return Err(failure("registry_new_key_not_active"));
    }
    Ok(())
}

fn validate_revocations(
    documents: &Documents,
    registries: &Registries,
    signature_index: &BTreeMap<(String, String), Vec<String>>,
) -> Result<Revocations, AuthorityError> {
    let revocation_ids = documents
        .receipt_order
        .iter()
        .filter(|id| documents.receipts[*id].receipt_type == "key-revocation")
        .cloned()
        .collect::<Vec<_>>();
    if revocation_ids.len() > MAXIMUM_REVOCATIONS {
        return Err(failure("authority_revocation_count_invalid"));
    }
    let mut by_transition = BTreeMap::<(String, String, String), String>::new();
    let mut history_by_key = BTreeMap::<String, Vec<RevocationHistory>>::new();
    for id in &revocation_ids {
        let receipt = &documents.receipts[id];
        let revocation = key_revocation(receipt)?;
        let Some(predecessor_id) = registries
            .by_id
            .get(&revocation.predecessor_registry_receipt_id)
        else {
            return Err(failure("revocation_registry_chain_invalid"));
        };
        let Some(successor_id) = registries
            .by_id
            .get(&revocation.authority_registry_receipt_id)
        else {
            return Err(failure("revocation_registry_chain_invalid"));
        };
        let predecessor = &documents.receipts[predecessor_id];
        let successor = &documents.receipts[successor_id];
        if authority_registry(successor)?
            .previous_registry_receipt_id
            .as_ref()
            != Some(predecessor_id)
        {
            return Err(failure("revocation_registry_chain_invalid"));
        }
        if revocation.effective_at_utc != authority_registry(successor)?.effective_at_utc {
            return Err(failure("revocation_effective_time_mismatch"));
        }
        let before = key_map(authority_registry(predecessor)?);
        let after = key_map(authority_registry(successor)?);
        let old_key = before.get(&revocation.key_id);
        let new_key = after.get(&revocation.key_id);
        if old_key.is_none_or(|key| key.role != revocation.role || key.status == "revoked")
            || new_key.is_none_or(|key| key.status != "revoked")
        {
            return Err(failure("revocation_key_transition_invalid"));
        }
        if let Some(replacement_id) = revocation.replacement_key_id.as_ref() {
            if after.get(replacement_id).is_none_or(|replacement| {
                replacement.status != "active" || replacement.role != revocation.role
            }) {
                return Err(failure("revocation_replacement_invalid"));
            }
        }
        let transition = (
            predecessor_id.clone(),
            successor_id.clone(),
            revocation.key_id.clone(),
        );
        if by_transition.insert(transition, id.clone()).is_some() {
            return Err(failure("registry_revocation_receipt_duplicate"));
        }
        history_by_key
            .entry(revocation.key_id.clone())
            .or_default()
            .push(RevocationHistory {
                revocation: revocation.clone(),
            });
        let signature_id = require_one_signature(
            signature_index,
            id,
            "key-revocation",
            "revocation_signature_missing",
            "revocation_signature_duplicate",
        )?;
        if signature_envelope(&documents.receipts[&signature_id])?.authority_registry_receipt_id
            != *predecessor_id
        {
            return Err(failure("revocation_signature_registry_mismatch"));
        }
    }

    for pair in registries.chain.windows(2) {
        let predecessor = &documents.receipts[&pair[0]];
        let successor = &documents.receipts[&pair[1]];
        validate_key_continuity(predecessor, successor)?;
        let before = key_map(authority_registry(predecessor)?);
        let after = key_map(authority_registry(successor)?);
        for (key_id, old_key) in before {
            let new_key = after[&key_id];
            let transition = (pair[0].clone(), pair[1].clone(), key_id);
            let revocation_present = by_transition.contains_key(&transition);
            let newly_revoked = old_key.status != "revoked" && new_key.status == "revoked";
            if newly_revoked && !revocation_present {
                return Err(failure("registry_revocation_receipt_missing"));
            }
            if !newly_revoked && revocation_present {
                return Err(failure("registry_revocation_receipt_unexpected"));
            }
        }
    }
    if by_transition.len() != revocation_ids.len() {
        return Err(failure("registry_revocation_receipt_unlinked"));
    }
    Ok(Revocations { history_by_key })
}

#[allow(clippy::too_many_arguments)]
fn verify_signatures(
    campaign_id: &str,
    verification_time: UtcInstant,
    documents: &Documents,
    registries: &Registries,
    revocations: &Revocations,
    signature_ids: &[String],
) -> Result<(Vec<SignatureResult>, bool), AuthorityError> {
    let terminal_keys = key_map(authority_registry(
        &documents.receipts[&registries.terminal],
    )?);
    let registry_is_current =
        terminal_registry_current(&documents.receipts[&registries.terminal], verification_time)?;
    let mut nonce_bindings = BTreeMap::<String, String>::new();
    let mut results = Vec::with_capacity(signature_ids.len());
    for signature_id in signature_ids {
        let receipt = &documents.receipts[signature_id];
        let envelope = signature_envelope(receipt)?;
        if envelope.campaign_id != campaign_id {
            return Err(failure("authority_campaign_mismatch"));
        }
        if !registries
            .by_id
            .contains_key(&envelope.authority_registry_receipt_id)
        {
            return Err(failure("signature_authority_registry_untrusted"));
        }
        let registry = &documents.receipts[&envelope.authority_registry_receipt_id];
        let subject = signed_subject(documents, envelope)?;
        let issued_at =
            parse_utc(&envelope.issued_at_utc).map_err(|_| failure("signature_time_invalid"))?;
        let expires_at = envelope
            .expires_at_utc
            .as_ref()
            .map(|value| parse_utc(value).map_err(|_| failure("signature_time_invalid")))
            .transpose()?;
        validate_receipt_bindings(receipt, &subject, &registry.receipt_id, issued_at)?;
        validate_scope_semantics(envelope, &subject, registry)?;

        let keys = key_map(authority_registry(registry)?);
        let key = keys
            .get(&envelope.key_id)
            .ok_or_else(|| failure("signature_key_missing"))?;
        if key.signer_id != envelope.signer_id {
            return Err(failure("signature_key_signer_mismatch"));
        }
        if key.role != envelope.role {
            return Err(failure("signature_key_role_mismatch"));
        }
        if key.status != "active" || !issue_inside_window(issued_at, registry, key)? {
            return Err(failure("signature_key_not_authorized_at_issue"));
        }
        let governance = matches!(
            envelope.scope.as_str(),
            "authority-registry" | "key-revocation"
        );
        let current_at_issue = registry_at_issue(&registries.chain, issued_at, documents)?;
        if !governance && current_at_issue.as_deref() != Some(registry.receipt_id.as_str()) {
            return Err(failure("signature_registry_not_current_at_issue"));
        }
        if governance {
            let subject_effective = match &subject {
                SignedSubject::Receipt(subject) if subject.receipt_type == "authority-registry" => {
                    &authority_registry(subject)?.effective_at_utc
                }
                SignedSubject::Receipt(subject) if subject.receipt_type == "key-revocation" => {
                    &key_revocation(subject)?.effective_at_utc
                }
                _ => return Err(failure("governance_signature_time_invalid")),
            };
            if issued_at
                > parse_utc(subject_effective)
                    .map_err(|_| failure("governance_signature_time_invalid"))?
            {
                return Err(failure("governance_signature_after_effective_time"));
            }
        }

        let envelope_bytes =
            canonical_bytes(envelope).map_err(|_| failure("signature_envelope_fields_invalid"))?;
        verify_signature_primitive(&envelope_bytes, &key.public_key)
            .map_err(|error| failure(error.code()))?;
        let nonce_key = [
            envelope.campaign_id.as_str(),
            envelope.key_id.as_str(),
            envelope.nonce_hash.as_str(),
            envelope.role.as_str(),
            envelope.scope.as_str(),
            envelope.signer_id.as_str(),
        ]
        .join("\0");
        if nonce_bindings
            .get(&nonce_key)
            .is_some_and(|prior| prior != signature_id)
        {
            return Err(failure("signature_nonce_replay"));
        }
        nonce_bindings.insert(nonce_key, signature_id.clone());

        let (authority_at_issue, mut stale_reasons) =
            revocation_impact(revocations, &envelope.key_id, issued_at)?;
        let terminal_key = terminal_keys.get(&envelope.key_id);
        if !registry_is_current {
            stale_reasons.insert("terminal-registry-not-current".to_owned());
        }
        if expires_at.is_some_and(|expires| verification_time >= expires) {
            stale_reasons.insert("signature-expired".to_owned());
        }
        match terminal_key {
            None => {
                stale_reasons.insert("key-not-in-terminal-registry".to_owned());
            }
            Some(key) => {
                if key.status == "retired" {
                    stale_reasons.insert("key-retired".to_owned());
                }
                if key.status == "revoked" {
                    stale_reasons.insert("key-revoked".to_owned());
                }
                let key_start = parse_utc(&key.valid_from_utc)
                    .map_err(|_| failure("authority_key_time_invalid"))?;
                let key_end = key
                    .valid_until_utc
                    .as_ref()
                    .map(|value| {
                        parse_utc(value).map_err(|_| failure("authority_key_time_invalid"))
                    })
                    .transpose()?;
                if verification_time < key_start
                    || key_end.is_some_and(|end| verification_time >= end)
                {
                    stale_reasons.insert("key-not-current".to_owned());
                }
            }
        }
        let temporal_current =
            registry_is_current && expires_at.is_none_or(|expires| verification_time < expires);
        let current_evidence_eligible =
            authority_at_issue && temporal_current && stale_reasons.is_empty();
        if governance && !authority_at_issue {
            return Err(failure("governance_authority_invalid"));
        }
        results.push(SignatureResult {
            authority_at_issue,
            authority_registry_receipt_id: envelope.authority_registry_receipt_id.clone(),
            current_evidence_eligible,
            key_id: envelope.key_id.clone(),
            role: envelope.role.clone(),
            scope: envelope.scope.clone(),
            signature_receipt_id: signature_id.clone(),
            signature_verified: true,
            signed_schema: envelope.signed_schema.clone(),
            signed_subject_id: envelope.signed_subject_id.clone(),
            signer_id: envelope.signer_id.clone(),
            stale_reasons: stale_reasons.into_iter().collect(),
            temporal_current,
        });
    }
    results.sort_by(|left, right| left.signature_receipt_id.cmp(&right.signature_receipt_id));
    Ok((results, registry_is_current))
}

fn signed_subject<'a>(
    documents: &'a Documents,
    envelope: &SignatureEnvelope,
) -> Result<SignedSubject<'a>, AuthorityError> {
    if envelope.signed_schema == RECEIPT_SCHEMA {
        return documents
            .receipts
            .get(&envelope.signed_subject_id)
            .map(SignedSubject::Receipt)
            .ok_or_else(|| failure("signature_subject_missing"));
    }
    documents
        .subjects
        .get(&envelope.signed_subject_id)
        .map(SignedSubject::Identity)
        .ok_or_else(|| failure("signature_subject_missing"))
}

fn validate_receipt_bindings(
    signature_receipt: &Receipt,
    subject: &SignedSubject<'_>,
    registry_id: &str,
    issued_at: UtcInstant,
) -> Result<(), AuthorityError> {
    if !signature_receipt
        .input_receipt_ids
        .iter()
        .any(|value| value == registry_id)
    {
        return Err(failure("signature_registry_input_missing"));
    }
    match subject {
        SignedSubject::Receipt(_) => {
            if !signature_receipt
                .input_receipt_ids
                .iter()
                .any(|value| value == subject.subject_id())
            {
                return Err(failure("signature_subject_receipt_input_missing"));
            }
        }
        SignedSubject::Identity(_) => {
            if !signature_receipt.input_hashes.iter().any(|binding| {
                binding.name == SUBJECT_HASH_BINDING
                    && binding.sha256 == subject.canonical_content_sha256()
            }) {
                return Err(failure("signature_subject_hash_binding_missing"));
            }
        }
    }
    let started = parse_utc(&signature_receipt.started_at_utc)
        .map_err(|_| failure("signature_receipt_time_invalid"))?;
    let completed = parse_utc(&signature_receipt.completed_at_utc)
        .map_err(|_| failure("signature_receipt_time_invalid"))?;
    if issued_at < started || issued_at > completed {
        return Err(failure("signature_issue_outside_receipt_time"));
    }
    Ok(())
}

fn validate_scope_semantics(
    envelope: &SignatureEnvelope,
    subject: &SignedSubject<'_>,
    authority_registry_receipt: &Receipt,
) -> Result<(), AuthorityError> {
    if subject.schema() != envelope.signed_schema {
        return Err(failure("signature_subject_schema_mismatch"));
    }
    match envelope.scope.as_str() {
        "authority-registry" => match subject {
            SignedSubject::Receipt(receipt)
                if receipt.receipt_type == "authority-registry"
                    && authority_registry(receipt)?
                        .previous_registry_receipt_id
                        .as_ref()
                        == Some(&envelope.authority_registry_receipt_id) => {}
            _ => return Err(failure("registry_successor_signature_subject_invalid")),
        },
        "key-revocation" => match subject {
            SignedSubject::Receipt(receipt)
                if receipt.receipt_type == "key-revocation"
                    && key_revocation(receipt)?.predecessor_registry_receipt_id
                        == envelope.authority_registry_receipt_id => {}
            _ => return Err(failure("revocation_signature_subject_invalid")),
        },
        "outside-proof" => match subject {
            SignedSubject::Identity(subject)
                if subject.schema == OUTSIDE_PROOF_SCHEMA
                    && subject.value.get("observerId").and_then(Value::as_str)
                        == Some(&envelope.signer_id)
                    && subject
                        .value
                        .get("observerRegistryId")
                        .and_then(Value::as_str)
                        == Some(&envelope.authority_registry_receipt_id)
                    && subject.value.get("campaignId").and_then(Value::as_str)
                        == Some(&envelope.campaign_id)
                    && subject.value.get("nonceHash").and_then(Value::as_str)
                        == Some(&envelope.nonce_hash)
                    && subject.value.get("issuedAtUtc").and_then(Value::as_str)
                        == Some(&envelope.issued_at_utc)
                    && subject.value.get("expiresAtUtc").and_then(Value::as_str)
                        == envelope.expires_at_utc.as_ref().map(String::as_str) => {}
            _ => return Err(failure("outside_proof_signature_binding_invalid")),
        },
        _ => {}
    }
    if authority_registry_receipt.receipt_id != envelope.authority_registry_receipt_id {
        return Err(failure("signature_authority_registry_mismatch"));
    }
    Ok(())
}

fn registry_at_issue(
    chain: &[String],
    issued_at: UtcInstant,
    documents: &Documents,
) -> Result<Option<String>, AuthorityError> {
    let mut selected = None;
    for id in chain {
        let (effective, expires) = registry_times(&documents.receipts[id])?;
        if effective <= issued_at && issued_at < expires {
            selected = Some(id.clone());
        }
    }
    Ok(selected)
}

fn issue_inside_window(
    issued_at: UtcInstant,
    registry_receipt: &Receipt,
    key: &AuthorityKey,
) -> Result<bool, AuthorityError> {
    let (effective, expires) = registry_times(registry_receipt)?;
    let key_start =
        parse_utc(&key.valid_from_utc).map_err(|_| failure("authority_key_time_invalid"))?;
    let key_end = key
        .valid_until_utc
        .as_ref()
        .map(|value| parse_utc(value).map_err(|_| failure("authority_key_time_invalid")))
        .transpose()?;
    Ok(effective <= issued_at
        && issued_at < expires
        && key_start <= issued_at
        && key_end.is_none_or(|end| issued_at < end))
}

fn terminal_registry_current(
    terminal: &Receipt,
    verification_time: UtcInstant,
) -> Result<bool, AuthorityError> {
    let registry = authority_registry(terminal)?;
    let (effective, expires) = registry_times(terminal)?;
    let skew = i128::from(registry.allowed_clock_skew_seconds) * 1_000_000_000;
    Ok(
        effective.nanoseconds - skew <= verification_time.nanoseconds
            && verification_time.nanoseconds < expires.nanoseconds + skew,
    )
}

fn revocation_impact(
    revocations: &Revocations,
    key_id: &str,
    issued_at: UtcInstant,
) -> Result<(bool, BTreeSet<String>), AuthorityError> {
    let mut authority_at_issue = true;
    let mut reasons = BTreeSet::new();
    for history in revocations
        .history_by_key
        .get(key_id)
        .map(Vec::as_slice)
        .unwrap_or_default()
    {
        match history.revocation.compromise_at_utc.as_ref() {
            None => {
                reasons.insert("key-compromise-time-unknown".to_owned());
            }
            Some(value) => {
                let compromise =
                    parse_utc(value).map_err(|_| failure("revocation_compromise_time_invalid"))?;
                if compromise <= issued_at {
                    authority_at_issue = false;
                    reasons.insert("key-compromised-at-issue".to_owned());
                } else {
                    reasons.insert("key-compromised-after-issue".to_owned());
                }
            }
        }
    }
    Ok((authority_at_issue, reasons))
}

fn authority_registry(receipt: &Receipt) -> Result<&AuthorityRegistry, AuthorityError> {
    receipt
        .authority_registry
        .as_ref()
        .ok_or_else(|| failure("authority_registry_payload_missing"))
}

fn key_revocation(receipt: &Receipt) -> Result<&KeyRevocation, AuthorityError> {
    receipt
        .key_revocation
        .as_ref()
        .ok_or_else(|| failure("key_revocation_payload_missing"))
}

fn signature_envelope(receipt: &Receipt) -> Result<&SignatureEnvelope, AuthorityError> {
    receipt
        .signature_envelope
        .as_ref()
        .ok_or_else(|| failure("signature_envelope_payload_missing"))
}

fn registry_times(receipt: &Receipt) -> Result<(UtcInstant, UtcInstant), AuthorityError> {
    let registry = authority_registry(receipt)?;
    Ok((
        parse_utc(&registry.effective_at_utc)
            .map_err(|_| failure("authority_registry_time_invalid"))?,
        parse_utc(&registry.expires_at_utc)
            .map_err(|_| failure("authority_registry_time_invalid"))?,
    ))
}

fn key_map(registry: &AuthorityRegistry) -> BTreeMap<String, &AuthorityKey> {
    registry
        .keys
        .iter()
        .map(|key| (key.key_id.clone(), key))
        .collect()
}

const fn failure(code: &'static str) -> AuthorityError {
    AuthorityError { code }
}
