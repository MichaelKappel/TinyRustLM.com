use crate::receipt::{
    canonical_value_bytes, domain_digest, lowercase_hex, parse_utc, valid_content_id, valid_digest,
    valid_safe_id,
};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::net::{Ipv4Addr, Ipv6Addr};
use std::sync::OnceLock;
use url::{Host, Url};

const CONTRACT_REGISTRY_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/contract-family.v1.json");
const CONTRACT_REGISTRY_SHA256: &str =
    "27101971058e6e0332f4a59f72c1c13abdef34b6b388f37b4d886dcf7a2cdecc";
const MAXIMUM_SUBJECT_BYTES: usize = 2_097_152;
const MAXIMUM_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Clone, Debug)]
pub(crate) struct IdentitySubject {
    pub(crate) canonical_content_sha256: String,
    pub(crate) contract_class: String,
    pub(crate) schema: String,
    pub(crate) subject_id: String,
    pub(crate) value: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContractRegistry {
    contracts: Vec<ContractDescriptor>,
    limits: RegistryLimits,
    records: Vec<RecordDescriptor>,
    semantic_limits: SemanticLimits,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryLimits {
    maximum_array_items: usize,
    maximum_depth: usize,
    maximum_object_members: usize,
    maximum_string_code_units: usize,
    maximum_total_entries: usize,
    maximum_total_string_code_units: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SemanticLimits {
    maximum_outside_proof_lifetime_seconds: i128,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContractDescriptor {
    class: String,
    schema: String,
    maximum_bytes: usize,
    visibility: String,
    identity_domain: Option<String>,
    identity_field: Option<String>,
    canonical_hash_field: Option<String>,
    identity_excluded_fields: Vec<String>,
    fields: Vec<FieldDescriptor>,
}

#[derive(Deserialize)]
struct RecordDescriptor {
    name: String,
    fields: Vec<FieldDescriptor>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FieldDescriptor {
    name: String,
    #[serde(rename = "type")]
    field_type: String,
    required: bool,
    value: Option<Value>,
    values: Option<Vec<String>>,
    minimum: Option<i64>,
    maximum: Option<u64>,
    minimum_length: Option<usize>,
    maximum_length: Option<usize>,
    minimum_items: Option<usize>,
    maximum_items: Option<usize>,
    items: Option<String>,
    record: Option<String>,
    value_type: Option<String>,
    unique: Option<bool>,
    sorted: Option<bool>,
    unique_by: Option<String>,
    sorted_by: Option<String>,
}

struct RegistryIndex {
    registry: ContractRegistry,
    contracts: BTreeMap<String, usize>,
    records: BTreeMap<String, usize>,
}

static REGISTRY: OnceLock<RegistryIndex> = OnceLock::new();

pub(crate) fn validate_identity_subject_bytes(
    bytes: &[u8],
) -> Result<IdentitySubject, &'static str> {
    if bytes.is_empty() || bytes.len() > MAXIMUM_SUBJECT_BYTES {
        return Err("identity_byte_limit");
    }
    let value: Value =
        serde_json::from_slice(bytes).map_err(|_| "identity_registry_validation_failed")?;
    let object = value
        .as_object()
        .ok_or("identity_registry_validation_failed")?;
    let schema = object
        .get("schema")
        .and_then(Value::as_str)
        .ok_or("identity_registry_validation_failed")?;
    let index = registry()?;
    let contract_index = *index
        .contracts
        .get(schema)
        .ok_or("identity_registry_validation_failed")?;
    let contract = &index.registry.contracts[contract_index];
    if contract.class == "receipt" || contract.identity_domain.is_none() {
        return Err("identity_schema_not_supported");
    }
    if bytes.len() > contract.maximum_bytes {
        return Err("identity_byte_limit");
    }
    validate_limits(&value, &index.registry.limits)?;
    validate_object(
        &value,
        &contract.fields,
        contract.visibility == "public-safe",
        index,
    )?;
    validate_local_invariants(contract, &value, index)?;
    let canonical = canonical_value_bytes(&value).map_err(|_| "identity_wire_not_canonical")?;
    if canonical != bytes {
        return Err("identity_wire_not_canonical");
    }

    let identity_field = contract
        .identity_field
        .as_deref()
        .ok_or("identity_profile_invalid")?;
    let canonical_hash_field = contract
        .canonical_hash_field
        .as_deref()
        .ok_or("identity_profile_invalid")?;
    let identity_domain = contract
        .identity_domain
        .as_deref()
        .ok_or("identity_profile_invalid")?;
    let subject_id = object
        .get(identity_field)
        .and_then(Value::as_str)
        .ok_or("identity_profile_invalid")?;
    let canonical_hash = object
        .get(canonical_hash_field)
        .and_then(Value::as_str)
        .ok_or("identity_profile_invalid")?;
    let mut identity_content = value.clone();
    let identity_object = identity_content
        .as_object_mut()
        .ok_or("identity_profile_invalid")?;
    for field in &contract.identity_excluded_fields {
        identity_object
            .remove(field)
            .ok_or("identity_profile_invalid")?;
    }
    let identity_bytes =
        canonical_value_bytes(&identity_content).map_err(|_| "identity_profile_invalid")?;
    let digest = lowercase_hex(&domain_digest(identity_domain, &identity_bytes));
    let subject_equals_digest = contract
        .identity_excluded_fields
        .iter()
        .any(|field| field == identity_field);
    if canonical_hash != digest
        || (subject_equals_digest && subject_id != format!("sha256:{digest}"))
    {
        return Err("identity_material_mismatch");
    }
    Ok(IdentitySubject {
        canonical_content_sha256: digest,
        contract_class: contract.class.clone(),
        schema: contract.schema.clone(),
        subject_id: subject_id.to_owned(),
        value,
    })
}

fn registry() -> Result<&'static RegistryIndex, &'static str> {
    if lowercase_hex(&Sha256::digest(CONTRACT_REGISTRY_BYTES)) != CONTRACT_REGISTRY_SHA256 {
        return Err("identity_profile_invalid");
    }
    if let Some(index) = REGISTRY.get() {
        return Ok(index);
    }
    let registry: ContractRegistry =
        serde_json::from_slice(CONTRACT_REGISTRY_BYTES).map_err(|_| "identity_profile_invalid")?;
    let contracts = registry
        .contracts
        .iter()
        .enumerate()
        .map(|(position, contract)| (contract.schema.clone(), position))
        .collect::<BTreeMap<_, _>>();
    let records = registry
        .records
        .iter()
        .enumerate()
        .map(|(position, record)| (record.name.clone(), position))
        .collect::<BTreeMap<_, _>>();
    let candidate = RegistryIndex {
        registry,
        contracts,
        records,
    };
    let _ = REGISTRY.set(candidate);
    REGISTRY.get().ok_or("identity_profile_invalid")
}

fn validate_limits(value: &Value, limits: &RegistryLimits) -> Result<(), &'static str> {
    fn visit(
        value: &Value,
        depth: usize,
        limits: &RegistryLimits,
        entries: &mut usize,
        string_units: &mut usize,
    ) -> Result<(), &'static str> {
        if depth > limits.maximum_depth {
            return Err("identity_registry_validation_failed");
        }
        match value {
            Value::Null | Value::Bool(_) => {}
            Value::Number(number) => {
                let valid = number
                    .as_u64()
                    .is_some_and(|value| value <= MAXIMUM_SAFE_INTEGER)
                    || number
                        .as_i64()
                        .is_some_and(|value| value.unsigned_abs() <= MAXIMUM_SAFE_INTEGER);
                if !valid {
                    return Err("identity_registry_validation_failed");
                }
            }
            Value::String(value) => add_string(value, limits, string_units)?,
            Value::Array(values) => {
                if values.len() > limits.maximum_array_items {
                    return Err("identity_registry_validation_failed");
                }
                *entries = entries
                    .checked_add(values.len())
                    .ok_or("identity_registry_validation_failed")?;
                for entry in values {
                    visit(entry, depth + 1, limits, entries, string_units)?;
                }
            }
            Value::Object(values) => {
                if values.len() > limits.maximum_object_members {
                    return Err("identity_registry_validation_failed");
                }
                *entries = entries
                    .checked_add(values.len())
                    .ok_or("identity_registry_validation_failed")?;
                for (name, entry) in values {
                    add_string(name, limits, string_units)?;
                    visit(entry, depth + 1, limits, entries, string_units)?;
                }
            }
        }
        if *entries > limits.maximum_total_entries {
            return Err("identity_registry_validation_failed");
        }
        Ok(())
    }

    fn add_string(
        value: &str,
        limits: &RegistryLimits,
        total: &mut usize,
    ) -> Result<(), &'static str> {
        let units = value.encode_utf16().count();
        if units > limits.maximum_string_code_units {
            return Err("identity_registry_validation_failed");
        }
        *total = total
            .checked_add(units)
            .ok_or("identity_registry_validation_failed")?;
        if *total > limits.maximum_total_string_code_units {
            return Err("identity_registry_validation_failed");
        }
        Ok(())
    }

    visit(value, 1, limits, &mut 0, &mut 0)
}

fn validate_object(
    value: &Value,
    fields: &[FieldDescriptor],
    public_safe: bool,
    index: &RegistryIndex,
) -> Result<(), &'static str> {
    let object = value
        .as_object()
        .ok_or("identity_registry_validation_failed")?;
    let expected = fields
        .iter()
        .map(|field| field.name.as_str())
        .collect::<BTreeSet<_>>();
    if object.keys().any(|name| !expected.contains(name.as_str())) {
        return Err("identity_registry_validation_failed");
    }
    for field in fields {
        let Some(field_value) = object.get(&field.name) else {
            if field.required {
                return Err("identity_registry_validation_failed");
            }
            continue;
        };
        validate_type(field_value, &field.field_type, field, public_safe, index)?;
    }
    Ok(())
}

fn validate_type(
    value: &Value,
    field_type: &str,
    descriptor: &FieldDescriptor,
    public_safe: bool,
    index: &RegistryIndex,
) -> Result<(), &'static str> {
    if let Some(record_name) = field_type.strip_prefix("record:") {
        return validate_record(value, record_name, public_safe, index);
    }
    match field_type {
        "record" => validate_record(
            value,
            descriptor
                .record
                .as_deref()
                .ok_or("identity_profile_invalid")?,
            public_safe,
            index,
        ),
        "nullable" if value.is_null() => Ok(()),
        "nullable" => validate_type(
            value,
            descriptor
                .value_type
                .as_deref()
                .ok_or("identity_profile_invalid")?,
            descriptor,
            public_safe,
            index,
        ),
        "array" => validate_array(value, descriptor, public_safe, index),
        "literal" if descriptor.value.as_ref() == Some(value) => Ok(()),
        "literal" => Err("identity_registry_validation_failed"),
        "enum" => {
            let entry = value
                .as_str()
                .ok_or("identity_registry_validation_failed")?;
            if descriptor
                .values
                .as_ref()
                .is_some_and(|values| values.iter().any(|value| value == entry))
            {
                Ok(())
            } else {
                Err("identity_registry_validation_failed")
            }
        }
        "integer" => validate_integer(value, descriptor),
        primitive => validate_primitive(value, primitive, descriptor, public_safe),
    }
}

fn validate_record(
    value: &Value,
    name: &str,
    public_safe: bool,
    index: &RegistryIndex,
) -> Result<(), &'static str> {
    let position = *index.records.get(name).ok_or("identity_profile_invalid")?;
    validate_object(
        value,
        &index.registry.records[position].fields,
        public_safe,
        index,
    )
}

fn validate_array(
    value: &Value,
    descriptor: &FieldDescriptor,
    public_safe: bool,
    index: &RegistryIndex,
) -> Result<(), &'static str> {
    let values = value
        .as_array()
        .ok_or("identity_registry_validation_failed")?;
    let minimum = descriptor.minimum_items.ok_or("identity_profile_invalid")?;
    let maximum = descriptor.maximum_items.ok_or("identity_profile_invalid")?;
    if values.len() < minimum || values.len() > maximum {
        return Err("identity_registry_validation_failed");
    }
    let items = descriptor
        .items
        .as_deref()
        .ok_or("identity_profile_invalid")?;
    for entry in values {
        validate_type(entry, items, descriptor, public_safe, index)?;
    }
    let uniqueness_required = descriptor.unique == Some(true) || descriptor.unique_by.is_some();
    let sorting_required = descriptor.sorted == Some(true) || descriptor.sorted_by.is_some();
    if uniqueness_required || sorting_required {
        let mut keys = Vec::with_capacity(values.len());
        for entry in values {
            let key = if let Some(field) = descriptor
                .unique_by
                .as_deref()
                .or(descriptor.sorted_by.as_deref())
            {
                entry
                    .as_object()
                    .and_then(|object| object.get(field))
                    .and_then(Value::as_str)
                    .ok_or("identity_registry_validation_failed")?
            } else {
                entry
                    .as_str()
                    .ok_or("identity_registry_validation_failed")?
            };
            keys.push(key);
        }
        if uniqueness_required && keys.iter().collect::<BTreeSet<_>>().len() != keys.len() {
            return Err("identity_registry_validation_failed");
        }
        if sorting_required && keys.windows(2).any(|pair| pair[0] >= pair[1]) {
            return Err("identity_registry_validation_failed");
        }
    }
    Ok(())
}

fn validate_integer(value: &Value, descriptor: &FieldDescriptor) -> Result<(), &'static str> {
    let minimum = descriptor.minimum.ok_or("identity_profile_invalid")?;
    let maximum = descriptor.maximum.ok_or("identity_profile_invalid")?;
    let valid = value.as_i64().is_some_and(|entry| {
        entry >= minimum && entry >= 0 && u64::try_from(entry).is_ok_and(|entry| entry <= maximum)
    }) || value
        .as_u64()
        .is_some_and(|entry| minimum <= 0 && entry <= maximum);
    if valid {
        Ok(())
    } else {
        Err("identity_registry_validation_failed")
    }
}

fn validate_primitive(
    value: &Value,
    primitive: &str,
    descriptor: &FieldDescriptor,
    public_safe: bool,
) -> Result<(), &'static str> {
    let entry = value
        .as_str()
        .ok_or("identity_registry_validation_failed")?;
    let valid = match primitive {
        "safe-id" => valid_safe_id(entry),
        "sha256" => valid_digest(entry),
        "content-id" => valid_content_id(entry),
        "source-revision" => valid_source_revision(entry),
        "utc" => parse_utc(entry).is_ok(),
        "date" => valid_date(entry),
        "semver" => valid_semver(entry),
        "https-url" => valid_https_url(entry, public_safe),
        "public-path" => valid_public_path(entry),
        "bounded-string" => valid_text(entry, descriptor, false),
        "bounded-text" => valid_text(entry, descriptor, true),
        _ => return Err("identity_profile_invalid"),
    };
    if valid {
        Ok(())
    } else {
        Err("identity_registry_validation_failed")
    }
}

fn validate_local_invariants(
    contract: &ContractDescriptor,
    value: &Value,
    index: &RegistryIndex,
) -> Result<(), &'static str> {
    match contract.class.as_str() {
        "artifact" => validate_artifact(value),
        "claim" => validate_claim(value),
        "context" => validate_context(value),
        "p2p" => validate_p2p(value),
        "proof" => validate_proof(value, index),
        "release" => validate_release(value),
        _ => Err("identity_schema_not_supported"),
    }
}

fn validate_artifact(value: &Value) -> Result<(), &'static str> {
    let object = object(value)?;
    let artifact_id = string(object, "artifactId")?;
    let artifact_sha256 = string(object, "artifactSha256")?;
    let class = string(object, "artifactClass")?;
    let format = string(object, "formatProfile")?;
    let expected = match class {
        "base-model" | "specialist-model" => "slm2.0",
        "composition" => "acg2.0",
        "low-rank-adapter" => "lora2.0",
        "sbom" => "cyclonedx-json-1.6",
        "template" => "template2.0",
        "tokenizer" => "tokenizer2.0",
        _ => return Err("identity_registry_validation_failed"),
    };
    require(artifact_id == format!("sha256:{artifact_sha256}") && format == expected)
}

fn validate_context(value: &Value) -> Result<(), &'static str> {
    let root = object(value)?;
    let segments = array(root, "segments")?;
    let mut current_users = 0usize;
    let mut product_policies = 0usize;
    for (position, segment) in segments.iter().enumerate() {
        let segment = object(segment)?;
        let ordinal = unsigned(segment, "ordinal")?;
        let role = string(segment, "role")?;
        let source = string(segment, "sourceKind")?;
        let trust = string(segment, "trust")?;
        let content = string(segment, "content")?;
        let content_hash = string(segment, "contentSha256")?;
        if ordinal != position as u64
            || content_hash != lowercase_hex(&Sha256::digest(content.as_bytes()))
        {
            return Err("identity_registry_validation_failed");
        }
        if source == "current-user" && role == "user" && trust == "authoritative" {
            current_users += 1;
        }
        if source == "product-policy" && role == "system" && trust == "authoritative" {
            product_policies += 1;
        }
        if matches!(source, "trusted-memory" | "untrusted-memory") {
            require(trust != "authoritative" && !array(segment, "sourceRecordIds")?.is_empty())?;
        }
        if matches!(
            source,
            "model-summary" | "quoted-text" | "retrieved-text" | "tool-output" | "untrusted-memory"
        ) {
            require(trust != "authoritative")?;
        }
        if source == "model-summary" {
            require(!array(segment, "sourceRecordIds")?.is_empty())?;
        }
        if source == "product-policy" {
            require(role == "system" && trust == "authoritative")?;
        }
    }
    require(current_users == 1 && product_policies == 1)?;
    let budget = object(
        root.get("tokenBudget")
            .ok_or("identity_registry_validation_failed")?,
    )?;
    let supplied = unsigned(budget, "suppliedTokens")?;
    let reserved = unsigned(budget, "reservedOutputTokens")?;
    let limit = unsigned(budget, "contextLimit")?;
    require(
        supplied
            .checked_add(reserved)
            .is_some_and(|sum| sum <= limit),
    )
}

fn validate_p2p(value: &Value) -> Result<(), &'static str> {
    let root = object(value)?;
    let artifact_id = string(root, "artifactId")?;
    let artifact_hash = string(root, "artifactSha256")?;
    require(artifact_id == format!("sha256:{artifact_hash}"))?;
    let pieces = array(root, "pieces")?;
    let piece_count = unsigned(root, "pieceCount")?;
    let piece_bytes = unsigned(root, "pieceBytes")?;
    let artifact_bytes = unsigned(root, "artifactBytes")?;
    require(piece_count == pieces.len() as u64)?;
    let mut expected_offset = 0u64;
    for (position, piece) in pieces.iter().enumerate() {
        let piece = object(piece)?;
        require(
            unsigned(piece, "index")? == position as u64
                && unsigned(piece, "offset")? == expected_offset,
        )?;
        let length = unsigned(piece, "length")?;
        if position + 1 < pieces.len() {
            require(length == piece_bytes)?;
        }
        expected_offset = expected_offset
            .checked_add(length)
            .ok_or("identity_registry_validation_failed")?;
    }
    require(expected_offset == artifact_bytes)?;
    require(string(root, "merkleRootSha256")? == merkle_root(artifact_bytes, pieces)?)
}

fn validate_proof(value: &Value, index: &RegistryIndex) -> Result<(), &'static str> {
    let object = object(value)?;
    require(unsigned(object, "completeTransferBytes")? > 0)?;
    let observed = parse_utc(string(object, "observedAtUtc")?)
        .map_err(|_| "identity_registry_validation_failed")?;
    let issued = parse_utc(string(object, "issuedAtUtc")?)
        .map_err(|_| "identity_registry_validation_failed")?;
    let expires = parse_utc(string(object, "expiresAtUtc")?)
        .map_err(|_| "identity_registry_validation_failed")?;
    let maximum = index
        .registry
        .semantic_limits
        .maximum_outside_proof_lifetime_seconds
        * 1_000_000_000;
    require(
        issued >= observed
            && expires > issued
            && expires.nanoseconds - issued.nanoseconds <= maximum,
    )
}

fn validate_release(value: &Value) -> Result<(), &'static str> {
    let object = object(value)?;
    let created = string(object, "createdAtUtc")?;
    require(created.get(..10) == Some(string(object, "releaseDate")?))
}

fn validate_claim(value: &Value) -> Result<(), &'static str> {
    let object = object(value)?;
    let effective = parse_utc(string(object, "effectiveAtUtc")?)
        .map_err(|_| "identity_registry_validation_failed")?;
    let verified = parse_utc(string(object, "lastVerifiedAtUtc")?)
        .map_err(|_| "identity_registry_validation_failed")?;
    let review = parse_utc(string(object, "reviewAtUtc")?)
        .map_err(|_| "identity_registry_validation_failed")?;
    if let Some(expires) = object.get("expiresAtUtc").and_then(Value::as_str) {
        let expires = parse_utc(expires).map_err(|_| "identity_registry_validation_failed")?;
        require(expires > effective)?;
    }
    require(verified >= effective && review >= verified)?;
    match string(object, "status")? {
        "published" => require(
            !array(object, "evidenceReceiptIds")?.is_empty()
                && !object.get("releaseId").is_none_or(Value::is_null)
                && array(object, "blockerCodes")?.is_empty(),
        ),
        "blocked" => require(!array(object, "blockerCodes")?.is_empty()),
        _ => Ok(()),
    }
}

fn merkle_root(artifact_bytes: u64, pieces: &[Value]) -> Result<String, &'static str> {
    let mut nodes = Vec::with_capacity(pieces.len());
    for piece in pieces {
        let piece = object(piece)?;
        let index = unsigned(piece, "index")?;
        let length = unsigned(piece, "length")?;
        let hash = decode_hex(string(piece, "sha256")?)?;
        nodes.push(hash_parts(
            b"TinyRustLM-Merkle-Leaf-v1",
            &[&index.to_le_bytes(), &length.to_le_bytes(), &hash],
        ));
    }
    let mut level = 0u32;
    while nodes.len() > 1 {
        let mut parents = Vec::with_capacity(nodes.len().div_ceil(2));
        for (parent_index, pair) in nodes.chunks(2).enumerate() {
            let parent_index = parent_index as u64;
            let value = if pair.len() == 2 {
                hash_parts(
                    b"TinyRustLM-Merkle-Node-v1",
                    &[
                        &level.to_le_bytes(),
                        &parent_index.to_le_bytes(),
                        &pair[0],
                        &pair[1],
                    ],
                )
            } else {
                hash_parts(
                    b"TinyRustLM-Merkle-Carry-v1",
                    &[&level.to_le_bytes(), &parent_index.to_le_bytes(), &pair[0]],
                )
            };
            parents.push(value);
        }
        nodes = parents;
        level += 1;
    }
    let piece_count = pieces.len() as u64;
    Ok(lowercase_hex(&hash_parts(
        b"TinyRustLM-Merkle-Root-v1",
        &[
            &artifact_bytes.to_le_bytes(),
            &piece_count.to_le_bytes(),
            nodes.first().ok_or("identity_registry_validation_failed")?,
        ],
    )))
}

fn hash_parts(domain: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(domain);
    hasher.update([0]);
    for part in parts {
        hasher.update(part);
    }
    hasher.finalize().into()
}

fn decode_hex(value: &str) -> Result<[u8; 32], &'static str> {
    if !valid_digest(value) {
        return Err("identity_registry_validation_failed");
    }
    let mut output = [0u8; 32];
    for (position, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        output[position] = (hex_digit(pair[0])? << 4) | hex_digit(pair[1])?;
    }
    Ok(output)
}

fn hex_digit(value: u8) -> Result<u8, &'static str> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err("identity_registry_validation_failed"),
    }
}

fn object(value: &Value) -> Result<&serde_json::Map<String, Value>, &'static str> {
    value
        .as_object()
        .ok_or("identity_registry_validation_failed")
}

fn string<'a>(
    object: &'a serde_json::Map<String, Value>,
    name: &str,
) -> Result<&'a str, &'static str> {
    object
        .get(name)
        .and_then(Value::as_str)
        .ok_or("identity_registry_validation_failed")
}

fn array<'a>(
    object: &'a serde_json::Map<String, Value>,
    name: &str,
) -> Result<&'a [Value], &'static str> {
    object
        .get(name)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .ok_or("identity_registry_validation_failed")
}

fn unsigned(object: &serde_json::Map<String, Value>, name: &str) -> Result<u64, &'static str> {
    object
        .get(name)
        .and_then(Value::as_u64)
        .ok_or("identity_registry_validation_failed")
}

fn require(condition: bool) -> Result<(), &'static str> {
    if condition {
        Ok(())
    } else {
        Err("identity_registry_validation_failed")
    }
}

fn valid_source_revision(value: &str) -> bool {
    value
        .strip_prefix("git-sha1:")
        .is_some_and(|value| value.len() == 40 && lowercase_hex_text(value))
        || value
            .strip_prefix("sha256:")
            .is_some_and(|value| value.len() == 64 && lowercase_hex_text(value))
}

fn lowercase_hex_text(value: &str) -> bool {
    value
        .as_bytes()
        .iter()
        .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
    {
        return false;
    }
    parse_utc(&format!("{value}T00:00:00Z")).is_ok()
}

fn valid_semver(value: &str) -> bool {
    if value.is_empty() || value.len() > 128 {
        return false;
    }
    let (without_build, build) = value
        .split_once('+')
        .map_or((value, None), |(left, right)| (left, Some(right)));
    if build.is_some_and(|value| !valid_semver_identifiers(value, false)) {
        return false;
    }
    let (core, prerelease) = without_build
        .split_once('-')
        .map_or((without_build, None), |(left, right)| (left, Some(right)));
    let core = core.split('.').collect::<Vec<_>>();
    core.len() == 3
        && core.iter().all(|part| valid_numeric_identifier(part))
        && prerelease.is_none_or(|value| valid_semver_identifiers(value, true))
}

fn valid_semver_identifiers(value: &str, reject_numeric_leading_zero: bool) -> bool {
    !value.is_empty()
        && value.split('.').all(|part| {
            !part.is_empty()
                && part
                    .as_bytes()
                    .iter()
                    .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
                && (!reject_numeric_leading_zero
                    || !part.as_bytes().iter().all(u8::is_ascii_digit)
                    || valid_numeric_identifier(part))
        })
}

fn valid_numeric_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.as_bytes().iter().all(u8::is_ascii_digit)
        && (value == "0" || !value.starts_with('0'))
}

fn valid_text(value: &str, descriptor: &FieldDescriptor, whitespace: bool) -> bool {
    let length = value.encode_utf16().count();
    if length < descriptor.minimum_length.unwrap_or(usize::MAX)
        || length > descriptor.maximum_length.unwrap_or(0)
    {
        return false;
    }
    value.chars().all(|character| {
        let code = character as u32;
        (whitespace && matches!(code, 0x09 | 0x0a | 0x0d))
            || !(code <= 0x1f || (0x7f..=0x9f).contains(&code))
    })
}

fn valid_public_path(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 2048
        && value.starts_with('/')
        && !value.starts_with("//")
        && value
            .as_bytes()
            .iter()
            .all(|byte| (0x21..=0x7e).contains(byte))
        && !value.as_bytes().iter().any(|byte| b"?#\\".contains(byte))
        && !has_forbidden_percent_encoding(value)
        && !value
            .split('/')
            .any(|segment| matches!(segment, "." | ".."))
}

fn valid_https_url(value: &str, public_safe: bool) -> bool {
    if value.is_empty()
        || value.len() > 2048
        || !value
            .as_bytes()
            .iter()
            .all(|byte| (0x21..=0x7e).contains(byte))
        || value.contains('\\')
        || has_forbidden_percent_encoding(value)
    {
        return false;
    }
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.as_str() != value
    {
        return false;
    }
    !public_safe || url.host().is_some_and(|host| !private_host(host))
}

fn has_forbidden_percent_encoding(value: &str) -> bool {
    let lowercase = value.to_ascii_lowercase();
    lowercase.contains("%2e") || lowercase.contains("%2f") || lowercase.contains("%5c")
}

fn private_host(host: Host<&str>) -> bool {
    match host {
        Host::Domain(value) => value == "localhost" || value.ends_with(".localhost"),
        Host::Ipv4(value) => private_ipv4(value),
        Host::Ipv6(value) => private_ipv6(value),
    }
}

fn private_ipv4(value: Ipv4Addr) -> bool {
    let [first, second, ..] = value.octets();
    first == 0
        || first == 10
        || first == 127
        || (first == 100 && (64..=127).contains(&second))
        || (first == 169 && second == 254)
        || (first == 172 && (16..=31).contains(&second))
        || (first == 192 && second == 168)
        || first >= 224
}

fn private_ipv6(value: Ipv6Addr) -> bool {
    let [first, ..] = value.octets();
    value.is_unspecified()
        || value.is_loopback()
        || first == 0xfc
        || first == 0xfd
        || (first == 0xfe && (value.octets()[1] & 0xc0) == 0x80)
        || first == 0xff
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    const CORPUS: &[u8] = include_bytes!("../../../../contracts/vnext/contract-corpus.v1.json");

    fn corpus_case(case_id: &str) -> Vec<u8> {
        let corpus: Value = serde_json::from_slice(CORPUS).expect("contract corpus must parse");
        let encoded = corpus["cases"]
            .as_array()
            .expect("cases must be an array")
            .iter()
            .find(|entry| entry["id"] == case_id)
            .and_then(|entry| entry["payloadBase64"].as_str())
            .expect("requested case must exist");
        STANDARD.decode(encoded).expect("payload must decode")
    }

    fn finalized_corpus_case(case_id: &str) -> Vec<u8> {
        let mut value: Value =
            serde_json::from_slice(&corpus_case(case_id)).expect("corpus document must parse");
        let index = registry().expect("registry must remain valid");
        let schema = value["schema"]
            .as_str()
            .expect("corpus document must name its schema");
        let contract = &index.registry.contracts[index.contracts[schema]];
        let object = value
            .as_object_mut()
            .expect("corpus document must be an object");
        for name in &contract.identity_excluded_fields {
            object.remove(name);
        }
        let identity_bytes =
            canonical_value_bytes(&value).expect("identity draft must canonicalize");
        let digest = lowercase_hex(&domain_digest(
            contract
                .identity_domain
                .as_deref()
                .expect("identity domain must exist"),
            &identity_bytes,
        ));
        let object = value
            .as_object_mut()
            .expect("corpus document must be an object");
        object.insert(
            contract
                .canonical_hash_field
                .as_deref()
                .expect("canonical hash field must exist")
                .to_owned(),
            Value::String(digest.clone()),
        );
        let identity_field = contract
            .identity_field
            .as_deref()
            .expect("identity field must exist");
        if contract
            .identity_excluded_fields
            .iter()
            .any(|field| field == identity_field)
        {
            object.insert(
                identity_field.to_owned(),
                Value::String(format!("sha256:{digest}")),
            );
        }
        canonical_value_bytes(&value).expect("final identity document must canonicalize")
    }

    #[test]
    fn accepts_every_non_receipt_identity_contract_from_the_frozen_corpus() {
        let expected = [
            ("valid-artifact", "artifact"),
            ("valid-claim", "claim"),
            ("valid-context", "context"),
            ("valid-p2p", "p2p"),
            ("valid-proof", "proof"),
            ("valid-release", "release"),
        ];
        for (case_id, class) in expected {
            let bytes = finalized_corpus_case(case_id);
            let subject = validate_identity_subject_bytes(&bytes)
                .unwrap_or_else(|code| panic!("{case_id} rejected as {code}"));
            let index = registry().expect("registry must remain valid");
            let contract = &index.registry.contracts[index.contracts[&subject.schema]];
            assert_eq!(contract.class, class, "{case_id}");
            assert!(valid_content_id(&subject.subject_id), "{case_id}");
            assert!(valid_digest(&subject.canonical_content_sha256), "{case_id}");
        }
    }

    #[test]
    fn rejects_noncanonical_unknown_missing_and_identity_tampered_subjects() {
        let proof = finalized_corpus_case("valid-proof");
        let value: Value = serde_json::from_slice(&proof).expect("proof must parse");
        let pretty = serde_json::to_vec_pretty(&value).expect("pretty proof must serialize");
        assert_eq!(
            validate_identity_subject_bytes(&pretty).unwrap_err(),
            "identity_wire_not_canonical"
        );

        let mut unknown = value.clone();
        unknown
            .as_object_mut()
            .expect("proof must be an object")
            .insert(
                "legacyId".to_owned(),
                Value::String("unsupported".to_owned()),
            );
        let unknown = canonical_value_bytes(&unknown).expect("unknown proof must canonicalize");
        assert_eq!(
            validate_identity_subject_bytes(&unknown).unwrap_err(),
            "identity_registry_validation_failed"
        );

        let mut missing = value.clone();
        missing
            .as_object_mut()
            .expect("proof must be an object")
            .remove("laneId");
        let missing = canonical_value_bytes(&missing).expect("missing proof must canonicalize");
        assert_eq!(
            validate_identity_subject_bytes(&missing).unwrap_err(),
            "identity_registry_validation_failed"
        );

        let mut tampered = value;
        tampered
            .as_object_mut()
            .expect("proof must be an object")
            .insert(
                "proofId".to_owned(),
                Value::String(format!("sha256:{}", "f".repeat(64))),
            );
        let tampered = canonical_value_bytes(&tampered).expect("tampered proof must canonicalize");
        assert_eq!(
            validate_identity_subject_bytes(&tampered).unwrap_err(),
            "identity_material_mismatch"
        );
    }
}
