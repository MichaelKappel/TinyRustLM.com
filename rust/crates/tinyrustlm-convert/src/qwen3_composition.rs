use std::collections::BTreeSet;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_composition2::{
    prepare_composition, write_acg2, Acg2Graph, Acg2Identity, Acg2Member, Acg2Policy, Acg2Read,
    MemberResolver, MemberRole, ResourcePlan, ResourcePreflight, ACG2_FORMAT_PROFILE_ID,
    ACG2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_durability::{flush_owned_directory, DirectoryFlushObservation};
use tinyrustlm_prompt2::{
    write_prompt2, Prompt2Artifact, Prompt2Policy, PROMPT2_ARTIFACT_SHA256,
    PROMPT2_FORMAT_PROFILE_ID, PROMPT2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_sampling2::{
    write_sampling2, Sampling2, Sampling2Policy, SAMPLING2_ARTIFACT_SHA256,
    SAMPLING2_FORMAT_PROFILE_ID, SAMPLING2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_slm2::{
    validate_model, ArtifactClass, ModelIdentity, ModelSpec, ValidationPolicy,
    SLM2_FORMAT_PROFILE_ID, SLM2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_template2::{
    write_template, Template2, Template2Policy, QWEN3_TEMPLATE2_ARTIFACT_SHA256,
    QWEN3_TEMPLATE2_MODEL_CONFIG, QWEN3_TEMPLATE2_TOKENIZER_CONFIG, TEMPLATE2_FORMAT_PROFILE_ID,
    TEMPLATE2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_tokenizer2::{
    QWEN3_TOKENIZER2_ARTIFACT_BYTES, QWEN3_TOKENIZER2_ARTIFACT_SHA256,
    TOKENIZER2_FORMAT_PROFILE_ID, TOKENIZER2_FORMAT_PROFILE_SHA256,
};

use crate::qwen3::QWEN3_ARCHITECTURE_PROFILE_ID;
use crate::qwen_tokenizer2::{
    QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID, QWEN_TOKENIZER2_COMPOSITION_FILE,
    QWEN_TOKENIZER2_COMPOSITION_RECEIPT_FILE, QWEN_TOKENIZER2_CONVERSION_RECEIPT_SCHEMA,
};
use crate::{
    convert_locked_qwen3_source, convert_locked_qwen_tokenizer2_source, ConverterExecutionIdentity,
    ReceiptIdentity, QWEN3_SOURCE_LOCK_SCHEMA, QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA,
};

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/qwen3-composition-conversion-profile.v4.json");
const ATTEMPT_SCHEMA: &str = "tinyrustlm.qwen3_composition_attempt.v1";
const RECEIPT_SCHEMA: &str = "tinyrustlm.qwen3_composition_conversion_receipt.v1";
const REJECTION_SCHEMA: &str = "tinyrustlm.qwen3_composition_rejection.v1";
const SOURCE_LOCK_MAXIMUM_BYTES: u64 = 1_048_576;
const RECEIPT_MAXIMUM_BYTES: u64 = 1_048_576;
const SMALL_MEMBER_MAXIMUM_BYTES: u64 = 83_886_080;
const MODEL_MAXIMUM_BYTES: u64 = 2_147_483_648;
const MODEL_MAXIMUM_TENSORS: u32 = 2_048;
const RESIDENT_DEPENDENCY_MAXIMUM_BYTES: u64 = 83_886_080;
const STREAM_HASH_BUFFER_BYTES: u64 = 1_048_576;

const MODEL_FILE: &str = "model.slm2";
const TOKENIZER_FILE: &str = QWEN_TOKENIZER2_COMPOSITION_FILE;
const TEMPLATE_FILE: &str = "template.template2";
const SAMPLING_FILE: &str = "sampling.sampling2";
const PROMPT_FILE: &str = "prompt.prompt2";
const COMPOSITION_FILE: &str = "composition.acg2";
const ATTEMPT_FILE: &str = "composition.attempt.json";
const REJECTION_FILE: &str = "composition.rejection.json";
const RECEIPT_FILE: &str = "composition.conversion-receipt.json";

/// Exact complete-composition conversion profile identifier.
pub const QWEN3_COMPOSITION_CONVERSION_PROFILE_ID: &str =
    "tinyrustlm.qwen3-complete-composition-conversion/4";

/// SHA-256 of the exact complete-composition conversion profile bytes.
pub const QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256: &str =
    "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8";

/// Stable public-safe complete-composition conversion failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Qwen3CompositionConversionError {
    code: &'static str,
}

impl Qwen3CompositionConversionError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for Qwen3CompositionConversionError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Qwen3CompositionConversionError {}

/// Exact immutable identity for one emitted composition artifact.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CompositionArtifactIdentity {
    kind: &'static str,
    byte_length: u64,
    sha256: [u8; 32],
}

impl CompositionArtifactIdentity {
    /// Returns the closed artifact kind.
    pub const fn kind(self) -> &'static str {
        self.kind
    }

    /// Returns the exact artifact byte length.
    pub const fn byte_length(self) -> u64 {
        self.byte_length
    }

    /// Returns the plain SHA-256 over the complete artifact.
    pub const fn sha256(self) -> [u8; 32] {
        self.sha256
    }

    /// Returns the lowercase SHA-256 text.
    pub fn sha256_hex(self) -> String {
        hex_lower(&self.sha256)
    }
}

/// Successful identities from one terminal complete-composition transaction.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Qwen3CompositionConversionResult {
    output_root: PathBuf,
    receipt_path: PathBuf,
    operation_id: String,
    artifacts: [CompositionArtifactIdentity; 6],
    graph_identity: Acg2Identity,
}

impl Qwen3CompositionConversionResult {
    /// Returns the terminal create-only output root.
    pub fn output_root(&self) -> &Path {
        &self.output_root
    }

    /// Returns the terminal pass receipt path.
    pub fn receipt_path(&self) -> &Path {
        &self.receipt_path
    }

    /// Returns the deterministic operation identity.
    pub fn operation_id(&self) -> &str {
        &self.operation_id
    }

    /// Returns all six artifacts in model, tokenizer, template, sampling, prompt, graph order.
    pub const fn artifacts(&self) -> [CompositionArtifactIdentity; 6] {
        self.artifacts
    }

    /// Returns the independently parsed ACG2 identities.
    pub const fn graph_identity(&self) -> Acg2Identity {
        self.graph_identity
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct RawIdentity {
    byte_length: u64,
    sha256: [u8; 32],
}

impl RawIdentity {
    const fn artifact(self, kind: &'static str) -> CompositionArtifactIdentity {
        CompositionArtifactIdentity {
            kind,
            byte_length: self.byte_length,
            sha256: self.sha256,
        }
    }
}

#[derive(Clone, Debug)]
struct SourceRelationship {
    model_lock_sha256: String,
    tokenizer_lock_sha256: String,
}

struct OutputRoot {
    root: PathBuf,
    operation_id: String,
}

/// Converts one exact Qwen3 source and tokenizer into a complete verified six-artifact composition.
///
/// The output root must not exist. Once created it is terminal: success writes
/// the pass receipt last, while any failure preserves all bytes and writes one
/// create-only rejection when possible. A second invocation never resumes or
/// repairs an existing root.
pub fn convert_locked_qwen3_composition(
    model_source_lock_path: &Path,
    model_source_directory: &Path,
    tokenizer_source_lock_path: &Path,
    tokenizer_source_directory: &Path,
    output_root: &Path,
    execution: &ConverterExecutionIdentity,
) -> Result<Qwen3CompositionConversionResult, Qwen3CompositionConversionError> {
    validate_profile()?;
    let relationship =
        validate_source_relationship(model_source_lock_path, tokenizer_source_lock_path)?;
    let model_source_directory = validate_directory(
        model_source_directory,
        "composition-model-source-directory-invalid",
    )?;
    let tokenizer_source_directory = validate_directory(
        tokenizer_source_directory,
        "composition-tokenizer-source-directory-invalid",
    )?;
    if model_source_directory == tokenizer_source_directory {
        return Err(Qwen3CompositionConversionError::new(
            "composition-source-directories-not-distinct",
        ));
    }
    let output = prepare_output_root(
        output_root,
        &model_source_directory,
        &tokenizer_source_directory,
        &relationship,
        execution,
    )?;

    match run_started_transaction(
        &output,
        model_source_lock_path,
        &model_source_directory,
        tokenizer_source_lock_path,
        &tokenizer_source_directory,
        &relationship,
        execution,
    ) {
        Ok(result) => Ok(result),
        Err(error) => {
            if !output.root.join(RECEIPT_FILE).exists() {
                record_rejection(&output, error)?;
            }
            Err(error)
        }
    }
}

fn run_started_transaction(
    output: &OutputRoot,
    model_source_lock_path: &Path,
    model_source_directory: &Path,
    tokenizer_source_lock_path: &Path,
    tokenizer_source_directory: &Path,
    relationship: &SourceRelationship,
    execution: &ConverterExecutionIdentity,
) -> Result<Qwen3CompositionConversionResult, Qwen3CompositionConversionError> {
    write_attempt(output, relationship, execution)?;

    let model_result = convert_locked_qwen3_source(
        model_source_lock_path,
        model_source_directory,
        &output.root.join(MODEL_FILE),
        execution,
    )
    .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
    let model = validate_exact_model(model_result.model_path(), model_result.model_identity())?;

    let tokenizer_result = convert_locked_qwen_tokenizer2_source(
        tokenizer_source_lock_path,
        tokenizer_source_directory,
        &output.root.join(TOKENIZER_FILE),
        execution,
    )
    .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
    let tokenizer_identity = tokenizer_result.tokenizer_identity();
    let tokenizer = RawIdentity {
        byte_length: tokenizer_identity.byte_length,
        sha256: tokenizer_identity.sha256,
    };
    if tokenizer.byte_length != QWEN3_TOKENIZER2_ARTIFACT_BYTES
        || tokenizer.sha256_hex() != QWEN3_TOKENIZER2_ARTIFACT_SHA256
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-tokenizer-identity",
        ));
    }

    let template = write_template_member(&output.root.join(TEMPLATE_FILE))?;
    let sampling = write_sampling_member(&output.root.join(SAMPLING_FILE))?;
    let prompt = write_prompt_member(&output.root.join(PROMPT_FILE))?;

    let member_identities = [model, tokenizer, template, sampling, prompt];
    let graph = write_graph_member(&output.root.join(COMPOSITION_FILE), member_identities)?;
    let members_flush = flush_owned_directory(
        &output.root,
        Path::new("."),
        &format!("{}-members", output.operation_id),
    )
    .map_err(|_| Qwen3CompositionConversionError::new("composition-directory-flush-failed"))?;

    let resource_plan = verify_complete_composition(&output.root, graph, member_identities)?;
    validate_output_inventory(&output.root, false)?;

    let model_receipt = component_receipt(
        model_result.receipt_path(),
        "tinyrustlm.qwen3_conversion_receipt.v2",
        model_result.receipt_identity(),
    )?;
    let tokenizer_receipt = component_receipt(
        tokenizer_result.receipt_path(),
        QWEN_TOKENIZER2_CONVERSION_RECEIPT_SCHEMA,
        tokenizer_result.receipt_identity(),
    )?;
    let artifacts = [
        model.artifact("slm2"),
        tokenizer.artifact("tokenizer2"),
        template.artifact("template2"),
        sampling.artifact("sampling2"),
        prompt.artifact("prompt2"),
        graph.artifact("acg2"),
    ];
    let graph_bytes = read_bounded_regular_file(
        &output.root.join(COMPOSITION_FILE),
        SMALL_MEMBER_MAXIMUM_BYTES,
        "composition-graph-validation-failed",
    )?;
    let parsed_graph = Acg2Graph::from_bytes(&graph_bytes, Acg2Policy::exact_profile_limits())
        .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
    let graph_identity = parsed_graph.identity();

    let receipt = CompleteReceipt {
        schema: RECEIPT_SCHEMA,
        status: "pass",
        profile_id: QWEN3_COMPOSITION_CONVERSION_PROFILE_ID,
        profile_sha256: QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256,
        operation_id: &output.operation_id,
        converter: ConverterReceipt {
            implementation_version: execution.implementation_version(),
            executable_sha256: execution.executable_sha256(),
        },
        source: SourceReceipt {
            model_lock_sha256: &relationship.model_lock_sha256,
            tokenizer_lock_sha256: &relationship.tokenizer_lock_sha256,
            relationship_status: "exact",
        },
        artifacts: artifact_receipts(artifacts),
        graph: GraphReceipt {
            graph_identity_sha256: hex_lower(&graph_identity.graph_identity_sha256),
            member_table_sha256: hex_lower(&graph_identity.member_table_sha256),
            resolved_member_bytes: resource_plan.resolved_member_bytes(),
        },
        component_receipts: ComponentReceipts {
            model: model_receipt,
            tokenizer: tokenizer_receipt,
        },
        resource_plan: ResourceReceipt {
            model_artifact_bytes: resource_plan.model_artifact_bytes(),
            resident_dependency_artifact_bytes: resource_plan.resident_dependency_artifact_bytes(),
            model_tensor_count: resource_plan.model_tensor_count(),
            stream_hash_buffer_bytes: resource_plan.stream_hash_buffer_bytes(),
        },
        durability: durability_receipt(&members_flush),
        structural_composition_status: "verified",
        model_quality_status: "not-assessed-by-converter",
        source_framework_parity_status: "not-assessed-by-converter",
        native_runtime_status: "not-assessed-by-converter",
        browser_wasm_status: "not-assessed-by-converter",
        browser_chat_status: "not-assessed-by-converter",
        p2p_availability_status: "not-assessed-by-converter",
        publication_status: "not-assessed-by-converter",
        required_next_gate:
            "source-native-browser-numerical-parity-untouched-quality-and-product-chat",
    };
    let mut receipt_bytes = serde_json::to_vec_pretty(&receipt).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-receipt-serialization-failed")
    })?;
    receipt_bytes.push(b'\n');
    if receipt_bytes.len() as u64 > RECEIPT_MAXIMUM_BYTES {
        return Err(Qwen3CompositionConversionError::new(
            "composition-receipt-limit",
        ));
    }
    write_terminal_file(&output.root.join(RECEIPT_FILE), &receipt_bytes)?;
    flush_owned_directory(
        &output.root,
        Path::new("."),
        &format!("{}-complete", output.operation_id),
    )
    .map_err(|_| Qwen3CompositionConversionError::new("composition-terminal-flush-failed"))?;
    validate_output_inventory(&output.root, true)?;

    Ok(Qwen3CompositionConversionResult {
        output_root: output.root.clone(),
        receipt_path: output.root.join(RECEIPT_FILE),
        operation_id: output.operation_id.clone(),
        artifacts,
        graph_identity,
    })
}

fn validate_profile() -> Result<(), Qwen3CompositionConversionError> {
    if hex_lower(&Sha256::digest(PROFILE_BYTES)) != QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256 {
        return Err(Qwen3CompositionConversionError::new(
            "composition-profile-drift",
        ));
    }
    let profile: Value = serde_json::from_slice(PROFILE_BYTES)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-profile-invalid"))?;
    if profile.get("profileId").and_then(Value::as_str)
        != Some(QWEN3_COMPOSITION_CONVERSION_PROFILE_ID)
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-profile-invalid",
        ));
    }
    Ok(())
}

fn validate_source_relationship(
    model_lock_path: &Path,
    tokenizer_lock_path: &Path,
) -> Result<SourceRelationship, Qwen3CompositionConversionError> {
    let model_bytes = read_bounded_regular_file(
        model_lock_path,
        SOURCE_LOCK_MAXIMUM_BYTES,
        "composition-model-source-lock-invalid",
    )?;
    let tokenizer_bytes = read_bounded_regular_file(
        tokenizer_lock_path,
        SOURCE_LOCK_MAXIMUM_BYTES,
        "composition-tokenizer-source-lock-invalid",
    )?;
    let model: Value = serde_json::from_slice(&model_bytes).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-model-source-lock-invalid")
    })?;
    let tokenizer: Value = serde_json::from_slice(&tokenizer_bytes).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-tokenizer-source-lock-invalid")
    })?;
    require_string(&model, "schema", "composition-model-source-lock-invalid")?
        .eq(QWEN3_SOURCE_LOCK_SCHEMA)
        .then_some(())
        .ok_or_else(|| {
            Qwen3CompositionConversionError::new("composition-model-source-lock-invalid")
        })?;
    require_string(
        &tokenizer,
        "schema",
        "composition-tokenizer-source-lock-invalid",
    )?
    .eq(QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA)
    .then_some(())
    .ok_or_else(|| {
        Qwen3CompositionConversionError::new("composition-tokenizer-source-lock-invalid")
    })?;
    for field in ["modelId", "revision"] {
        if require_string(&model, field, "composition-model-source-lock-invalid")?
            != require_string(
                &tokenizer,
                field,
                "composition-tokenizer-source-lock-invalid",
            )?
        {
            return Err(Qwen3CompositionConversionError::new(
                "composition-source-lock-mismatch",
            ));
        }
    }
    if require_string(
        &model,
        "architectureProfileId",
        "composition-model-source-lock-invalid",
    )? != QWEN3_ARCHITECTURE_PROFILE_ID
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-model-source-lock-invalid",
        ));
    }
    if require_string(
        &tokenizer,
        "architectureProfileId",
        "composition-tokenizer-source-lock-invalid",
    )? != QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-tokenizer-source-lock-invalid",
        ));
    }
    let model_files = model
        .get("files")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            Qwen3CompositionConversionError::new("composition-model-source-lock-invalid")
        })?;
    let tokenizer_files = tokenizer
        .get("files")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            Qwen3CompositionConversionError::new("composition-tokenizer-source-lock-invalid")
        })?;
    for field in ["config", "merges", "tokenizer", "tokenizerConfig", "vocab"] {
        if model_files.get(field) != tokenizer_files.get(field) {
            return Err(Qwen3CompositionConversionError::new(
                "composition-source-lock-mismatch",
            ));
        }
    }
    // Agreement between caller-supplied locks does not establish authority to emit
    // this frozen template. Component conversion subsequently verifies source bytes
    // against these admitted records; reject drift before creating any output.
    for (field, expected) in [
        ("config", QWEN3_TEMPLATE2_MODEL_CONFIG),
        ("tokenizerConfig", QWEN3_TEMPLATE2_TOKENIZER_CONFIG),
    ] {
        let record = &model["files"][field];
        if record.get("path").and_then(Value::as_str) != Some(expected.path)
            || record.get("byteLength").and_then(Value::as_u64) != Some(expected.byte_length)
            || record.get("sha256").and_then(Value::as_str)
                != Some(hex_lower(&expected.sha256).as_str())
        {
            return Err(Qwen3CompositionConversionError::new(
                "composition-template-source-mismatch",
            ));
        }
    }
    Ok(SourceRelationship {
        model_lock_sha256: sha256_bytes(&model_bytes),
        tokenizer_lock_sha256: sha256_bytes(&tokenizer_bytes),
    })
}

fn require_string<'a>(
    value: &'a Value,
    field: &str,
    code: &'static str,
) -> Result<&'a str, Qwen3CompositionConversionError> {
    value
        .get(field)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .ok_or_else(|| Qwen3CompositionConversionError::new(code))
}

fn prepare_output_root(
    requested: &Path,
    model_source: &Path,
    tokenizer_source: &Path,
    relationship: &SourceRelationship,
    execution: &ConverterExecutionIdentity,
) -> Result<OutputRoot, Qwen3CompositionConversionError> {
    if !requested.is_absolute() {
        return Err(Qwen3CompositionConversionError::new(
            "composition-output-path-invalid",
        ));
    }
    let parent = requested
        .parent()
        .ok_or_else(|| Qwen3CompositionConversionError::new("composition-output-path-invalid"))?;
    let parent = validate_directory(parent, "composition-output-parent-invalid")?;
    let name = requested
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| valid_file_name(value))
        .ok_or_else(|| Qwen3CompositionConversionError::new("composition-output-path-invalid"))?;
    let root = parent.join(name);
    if root.starts_with(model_source)
        || root.starts_with(tokenizer_source)
        || model_source.starts_with(&root)
        || tokenizer_source.starts_with(&root)
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-source-output-overlap",
        ));
    }
    if fs::symlink_metadata(&root).is_ok() {
        return Err(Qwen3CompositionConversionError::new(
            "composition-output-already-exists",
        ));
    }
    let operation_id = operation_id(relationship, execution);
    fs::create_dir(&root).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            Qwen3CompositionConversionError::new("composition-output-already-exists")
        } else {
            Qwen3CompositionConversionError::new("composition-output-create-failed")
        }
    })?;
    let metadata = fs::symlink_metadata(&root)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-output-create-failed"))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err(Qwen3CompositionConversionError::new(
            "composition-output-create-failed",
        ));
    }
    let canonical = fs::canonicalize(&root)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-output-create-failed"))?;
    if canonical != root {
        return Err(Qwen3CompositionConversionError::new(
            "composition-output-create-failed",
        ));
    }
    flush_owned_directory(&parent, Path::new("."), &format!("{operation_id}-root")).map_err(
        |_| Qwen3CompositionConversionError::new("composition-output-root-flush-failed"),
    )?;
    Ok(OutputRoot { root, operation_id })
}

fn operation_id(
    relationship: &SourceRelationship,
    execution: &ConverterExecutionIdentity,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"tinyrustlm.qwen3-complete-composition-operation.v1\0");
    hasher.update(QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256.as_bytes());
    hasher.update([0]);
    hasher.update(relationship.model_lock_sha256.as_bytes());
    hasher.update([0]);
    hasher.update(relationship.tokenizer_lock_sha256.as_bytes());
    hasher.update([0]);
    hasher.update(execution.implementation_version().as_bytes());
    hasher.update([0]);
    hasher.update(execution.executable_sha256().as_bytes());
    format!("qwen3-composition-{}", hex_lower(&hasher.finalize()))
}

fn write_attempt(
    output: &OutputRoot,
    relationship: &SourceRelationship,
    execution: &ConverterExecutionIdentity,
) -> Result<(), Qwen3CompositionConversionError> {
    let attempt = AttemptReceipt {
        schema: ATTEMPT_SCHEMA,
        status: "started",
        profile_id: QWEN3_COMPOSITION_CONVERSION_PROFILE_ID,
        profile_sha256: QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256,
        operation_id: &output.operation_id,
        model_lock_sha256: &relationship.model_lock_sha256,
        tokenizer_lock_sha256: &relationship.tokenizer_lock_sha256,
        converter_version: execution.implementation_version(),
        converter_executable_sha256: execution.executable_sha256(),
        terminal_rule: "existing-output-root-is-never-resumed",
    };
    let mut bytes = serde_json::to_vec_pretty(&attempt).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-attempt-serialization-failed")
    })?;
    bytes.push(b'\n');
    write_terminal_file(&output.root.join(ATTEMPT_FILE), &bytes)?;
    flush_owned_directory(
        &output.root,
        Path::new("."),
        &format!("{}-attempt", output.operation_id),
    )
    .map_err(|_| Qwen3CompositionConversionError::new("composition-attempt-flush-failed"))?;
    Ok(())
}

fn validate_exact_model(
    path: &Path,
    expected: &ModelIdentity,
) -> Result<RawIdentity, Qwen3CompositionConversionError> {
    let mut source = File::open(path)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-model-validation-failed"))?;
    let policy = ValidationPolicy::new(MODEL_MAXIMUM_BYTES, MODEL_MAXIMUM_TENSORS)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-model-validation-failed"))?;
    let model = validate_model(&mut source, policy)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-model-validation-failed"))?;
    if model.identity() != expected || !exact_model_spec(model.spec()) {
        return Err(Qwen3CompositionConversionError::new(
            "composition-model-profile-mismatch",
        ));
    }
    Ok(RawIdentity {
        byte_length: expected.byte_length(),
        sha256: *expected.artifact_sha256(),
    })
}

fn exact_model_spec(spec: &ModelSpec) -> bool {
    matches!(
        spec.artifact_class,
        ArtifactClass::BaseModel | ArtifactClass::SpecialistModel
    ) && spec.vocabulary_size == 151_936
        && spec.context_length == 40_960
        && spec.embedding_size == 1_024
        && spec.feed_forward_size == 3_072
        && spec.layer_count == 28
        && spec.head_count == 16
        && spec.kv_head_count == 8
        && spec.head_dimension == 128
        && spec.rope_theta.to_bits() == 1_000_000_f32.to_bits()
        && spec.normalization_epsilon.to_bits() == 0.000_001_f32.to_bits()
        && spec.tied_embeddings
        && !spec.qkv_bias
        && spec.qk_normalization
}

fn write_template_member(path: &Path) -> Result<RawIdentity, Qwen3CompositionConversionError> {
    let identity = write_verified_member(
        path,
        SMALL_MEMBER_MAXIMUM_BYTES,
        |output| {
            let identity = write_template(output)
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            Ok(RawIdentity {
                byte_length: identity.byte_length,
                sha256: identity.sha256,
            })
        },
        |bytes| {
            let artifact = Template2::from_bytes(bytes, Template2Policy::exact_profile_limits())
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            let identity = artifact.identity();
            Ok(RawIdentity {
                byte_length: identity.byte_length,
                sha256: identity.sha256,
            })
        },
    )?;
    if identity.sha256_hex() != QWEN3_TEMPLATE2_ARTIFACT_SHA256 {
        return Err(Qwen3CompositionConversionError::new(
            "composition-template-identity",
        ));
    }
    Ok(identity)
}

fn write_sampling_member(path: &Path) -> Result<RawIdentity, Qwen3CompositionConversionError> {
    let identity = write_verified_member(
        path,
        SMALL_MEMBER_MAXIMUM_BYTES,
        |output| {
            let identity = write_sampling2(output)
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            Ok(RawIdentity {
                byte_length: identity.byte_length,
                sha256: identity.sha256,
            })
        },
        |bytes| {
            let artifact = Sampling2::from_bytes(bytes, Sampling2Policy::exact_profile_limits())
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            let identity = artifact.identity();
            Ok(RawIdentity {
                byte_length: identity.byte_length,
                sha256: identity.sha256,
            })
        },
    )?;
    if identity.sha256_hex() != SAMPLING2_ARTIFACT_SHA256 {
        return Err(Qwen3CompositionConversionError::new(
            "composition-sampling-identity",
        ));
    }
    Ok(identity)
}

fn write_prompt_member(path: &Path) -> Result<RawIdentity, Qwen3CompositionConversionError> {
    let identity = write_verified_member(
        path,
        SMALL_MEMBER_MAXIMUM_BYTES,
        |output| {
            let identity = write_prompt2(output)
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            Ok(RawIdentity {
                byte_length: identity.byte_length,
                sha256: identity.sha256,
            })
        },
        |bytes| {
            let artifact =
                Prompt2Artifact::from_bytes(&bytes, Prompt2Policy::exact_profile_limits())
                    .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            let identity = artifact.identity();
            Ok(RawIdentity {
                byte_length: identity.byte_length,
                sha256: identity.sha256,
            })
        },
    )?;
    if identity.sha256_hex() != PROMPT2_ARTIFACT_SHA256 {
        return Err(Qwen3CompositionConversionError::new(
            "composition-prompt-identity",
        ));
    }
    Ok(identity)
}

fn write_graph_member(
    path: &Path,
    identities: [RawIdentity; 5],
) -> Result<RawIdentity, Qwen3CompositionConversionError> {
    let members = [
        Acg2Member::new(
            MemberRole::Model,
            identities[0].byte_length,
            identities[0].sha256,
        ),
        Acg2Member::new(
            MemberRole::Tokenizer,
            identities[1].byte_length,
            identities[1].sha256,
        ),
        Acg2Member::new(
            MemberRole::Template,
            identities[2].byte_length,
            identities[2].sha256,
        ),
        Acg2Member::new(
            MemberRole::Sampling,
            identities[3].byte_length,
            identities[3].sha256,
        ),
        Acg2Member::new(
            MemberRole::Prompt,
            identities[4].byte_length,
            identities[4].sha256,
        ),
    ];
    let members = members
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?
        .try_into()
        .map_err(|_| Qwen3CompositionConversionError::new("composition-graph-members"))?;
    write_verified_member(
        path,
        SMALL_MEMBER_MAXIMUM_BYTES,
        |output| {
            let identity = write_acg2(output, &members)
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            Ok(RawIdentity {
                byte_length: identity.artifact_bytes,
                sha256: identity.artifact_sha256,
            })
        },
        |bytes| {
            let graph = Acg2Graph::from_bytes(&bytes, Acg2Policy::exact_profile_limits())
                .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
            let identity = graph.identity();
            Ok(RawIdentity {
                byte_length: identity.artifact_bytes,
                sha256: identity.artifact_sha256,
            })
        },
    )
}

fn write_verified_member<W, V>(
    path: &Path,
    maximum_bytes: u64,
    writer: W,
    verifier: V,
) -> Result<RawIdentity, Qwen3CompositionConversionError>
where
    W: FnOnce(&mut File) -> Result<RawIdentity, Qwen3CompositionConversionError>,
    V: FnOnce(Vec<u8>) -> Result<RawIdentity, Qwen3CompositionConversionError>,
{
    let stage = staging_path(path)?;
    require_absent(path)?;
    require_absent(&stage)?;
    let mut output = create_new_file(&stage)?;
    let written = writer(&mut output)?;
    output
        .sync_all()
        .map_err(|_| Qwen3CompositionConversionError::new("composition-member-flush-failed"))?;
    drop(output);
    let bytes = read_bounded_regular_file(
        &stage,
        maximum_bytes,
        "composition-member-validation-failed",
    )?;
    let parsed = verifier(bytes)?;
    if parsed != written || written.byte_length == 0 || written.byte_length > maximum_bytes {
        return Err(Qwen3CompositionConversionError::new(
            "composition-member-validation-failed",
        ));
    }
    promote_create_only(&stage, path)?;
    Ok(written)
}

fn verify_complete_composition(
    root: &Path,
    graph: RawIdentity,
    members: [RawIdentity; 5],
) -> Result<ResourcePlan, Qwen3CompositionConversionError> {
    let graph_bytes = read_bounded_regular_file(
        &root.join(COMPOSITION_FILE),
        SMALL_MEMBER_MAXIMUM_BYTES,
        "composition-graph-validation-failed",
    )?;
    let parsed = Acg2Graph::from_bytes(&graph_bytes, Acg2Policy::exact_profile_limits())
        .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
    if parsed.identity().artifact_bytes != graph.byte_length
        || parsed.identity().artifact_sha256 != graph.sha256
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-graph-validation-failed",
        ));
    }
    let paths = [
        root.join(MODEL_FILE),
        root.join(TOKENIZER_FILE),
        root.join(TEMPLATE_FILE),
        root.join(SAMPLING_FILE),
        root.join(PROMPT_FILE),
    ];
    let mut resolver = FileResolver { paths, members };
    let mut preflight = StrictPreflight {
        graph_identity: parsed.identity(),
        accepted: false,
    };
    let prepared = prepare_composition(parsed, &mut resolver, &mut preflight)
        .map_err(|error| Qwen3CompositionConversionError::new(error.code()))?;
    if !preflight.accepted || !exact_model_spec(prepared.model().spec()) {
        return Err(Qwen3CompositionConversionError::new(
            "composition-complete-verification-failed",
        ));
    }
    Ok(prepared.resource_plan())
}

struct FileResolver {
    paths: [PathBuf; 5],
    members: [RawIdentity; 5],
}

impl MemberResolver for FileResolver {
    fn open(&mut self, role: MemberRole, identity: Acg2Member) -> Option<Box<dyn Acg2Read>> {
        let index = role.ordinal() as usize;
        let expected = self.members.get(index)?;
        if identity.artifact_bytes() != expected.byte_length
            || identity.artifact_sha256() != expected.sha256
        {
            return None;
        }
        let path = self.paths.get(index)?;
        let metadata = fs::symlink_metadata(path).ok()?;
        if metadata_is_link(&metadata)
            || !metadata.is_file()
            || metadata.len() != expected.byte_length
        {
            return None;
        }
        File::open(path)
            .ok()
            .map(|file| Box::new(file) as Box<dyn Acg2Read>)
    }
}

struct StrictPreflight {
    graph_identity: Acg2Identity,
    accepted: bool,
}

impl ResourcePreflight for StrictPreflight {
    fn accept(&mut self, plan: ResourcePlan) -> bool {
        self.accepted = plan.graph_identity() == self.graph_identity
            && plan.model_artifact_bytes() > 0
            && plan.model_artifact_bytes() <= MODEL_MAXIMUM_BYTES
            && plan.resident_dependency_artifact_bytes() > 0
            && plan.resident_dependency_artifact_bytes() <= RESIDENT_DEPENDENCY_MAXIMUM_BYTES
            && plan.model_tensor_count() > 0
            && plan.model_tensor_count() <= MODEL_MAXIMUM_TENSORS
            && plan.stream_hash_buffer_bytes() == STREAM_HASH_BUFFER_BYTES;
        self.accepted
    }
}

fn component_receipt(
    path: &Path,
    expected_schema: &str,
    expected_identity: ReceiptIdentity,
) -> Result<ComponentReceipt, Qwen3CompositionConversionError> {
    let bytes = read_bounded_regular_file(
        path,
        RECEIPT_MAXIMUM_BYTES,
        "composition-component-receipt-invalid",
    )?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-component-receipt-invalid")
    })?;
    if value.get("schema").and_then(Value::as_str) != Some(expected_schema)
        || value.get("status").and_then(Value::as_str) != Some("pass")
    {
        return Err(Qwen3CompositionConversionError::new(
            "composition-component-receipt-invalid",
        ));
    }
    let observed_identity = ReceiptIdentity::from_bytes(&bytes);
    if observed_identity != expected_identity {
        return Err(Qwen3CompositionConversionError::new(
            "composition-component-receipt-invalid",
        ));
    }
    let file = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            Qwen3CompositionConversionError::new("composition-component-receipt-invalid")
        })?
        .to_owned();
    Ok(ComponentReceipt {
        file,
        byte_length: observed_identity.byte_length(),
        sha256: observed_identity.sha256_hex(),
    })
}

fn validate_output_inventory(
    root: &Path,
    completed: bool,
) -> Result<(), Qwen3CompositionConversionError> {
    let mut expected = BTreeSet::from([
        ATTEMPT_FILE.to_owned(),
        MODEL_FILE.to_owned(),
        "model.slm2.conversion-receipt.json".to_owned(),
        TOKENIZER_FILE.to_owned(),
        QWEN_TOKENIZER2_COMPOSITION_RECEIPT_FILE.to_owned(),
        TEMPLATE_FILE.to_owned(),
        SAMPLING_FILE.to_owned(),
        PROMPT_FILE.to_owned(),
        COMPOSITION_FILE.to_owned(),
    ]);
    if completed {
        expected.insert(RECEIPT_FILE.to_owned());
    }
    let mut observed = BTreeSet::new();
    let entries = fs::read_dir(root).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-output-inventory-invalid")
    })?;
    for entry in entries {
        let entry = entry.map_err(|_| {
            Qwen3CompositionConversionError::new("composition-output-inventory-invalid")
        })?;
        let name = entry.file_name().into_string().map_err(|_| {
            Qwen3CompositionConversionError::new("composition-output-inventory-invalid")
        })?;
        let metadata = fs::symlink_metadata(entry.path()).map_err(|_| {
            Qwen3CompositionConversionError::new("composition-output-inventory-invalid")
        })?;
        if metadata_is_link(&metadata) || !metadata.is_file() || !observed.insert(name) {
            return Err(Qwen3CompositionConversionError::new(
                "composition-output-inventory-invalid",
            ));
        }
    }
    if observed != expected {
        return Err(Qwen3CompositionConversionError::new(
            "composition-output-inventory-invalid",
        ));
    }
    Ok(())
}

fn record_rejection(
    output: &OutputRoot,
    error: Qwen3CompositionConversionError,
) -> Result<(), Qwen3CompositionConversionError> {
    let rejection = RejectionReceipt {
        schema: REJECTION_SCHEMA,
        status: "rejected",
        profile_id: QWEN3_COMPOSITION_CONVERSION_PROFILE_ID,
        profile_sha256: QWEN3_COMPOSITION_CONVERSION_PROFILE_SHA256,
        operation_id: &output.operation_id,
        error_code: error.code(),
        safe_no_op: false,
        retryable: false,
    };
    let mut bytes = serde_json::to_vec_pretty(&rejection).map_err(|_| {
        Qwen3CompositionConversionError::new("composition-rejection-serialization-failed")
    })?;
    bytes.push(b'\n');
    write_terminal_file(&output.root.join(REJECTION_FILE), &bytes)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-rejection-write-failed"))?;
    flush_owned_directory(
        &output.root,
        Path::new("."),
        &format!("{}-rejected", output.operation_id),
    )
    .map_err(|_| Qwen3CompositionConversionError::new("composition-rejection-flush-failed"))?;
    Ok(())
}

fn write_terminal_file(path: &Path, bytes: &[u8]) -> Result<(), Qwen3CompositionConversionError> {
    if bytes.is_empty() || bytes.len() as u64 > RECEIPT_MAXIMUM_BYTES {
        return Err(Qwen3CompositionConversionError::new(
            "composition-evidence-limit",
        ));
    }
    let stage = staging_path(path)?;
    require_absent(path)?;
    require_absent(&stage)?;
    let mut file = create_new_file(&stage)?;
    file.write_all(bytes)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-evidence-write-failed"))?;
    file.sync_all()
        .map_err(|_| Qwen3CompositionConversionError::new("composition-evidence-flush-failed"))?;
    drop(file);
    let observed = read_bounded_regular_file(
        &stage,
        RECEIPT_MAXIMUM_BYTES,
        "composition-evidence-validation-failed",
    )?;
    if observed != bytes {
        return Err(Qwen3CompositionConversionError::new(
            "composition-evidence-validation-failed",
        ));
    }
    promote_create_only(&stage, path)
}

#[cfg(test)]
fn write_create_only_bytes(
    path: &Path,
    bytes: &[u8],
) -> Result<(), Qwen3CompositionConversionError> {
    let mut file = create_new_file(path)?;
    file.write_all(bytes)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-output-write-failed"))?;
    file.sync_all()
        .map_err(|_| Qwen3CompositionConversionError::new("composition-output-flush-failed"))
}

fn create_new_file(path: &Path) -> Result<File, Qwen3CompositionConversionError> {
    OpenOptions::new()
        .write(true)
        .read(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                Qwen3CompositionConversionError::new("composition-output-already-exists")
            } else {
                Qwen3CompositionConversionError::new("composition-output-create-failed")
            }
        })
}

fn require_absent(path: &Path) -> Result<(), Qwen3CompositionConversionError> {
    if fs::symlink_metadata(path).is_ok() {
        Err(Qwen3CompositionConversionError::new(
            "composition-output-already-exists",
        ))
    } else {
        Ok(())
    }
}

fn staging_path(path: &Path) -> Result<PathBuf, Qwen3CompositionConversionError> {
    let parent = path
        .parent()
        .ok_or_else(|| Qwen3CompositionConversionError::new("composition-output-path-invalid"))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| Qwen3CompositionConversionError::new("composition-output-path-invalid"))?;
    Ok(parent.join(format!(".{name}.staging")))
}

fn promote_create_only(
    source: &Path,
    destination: &Path,
) -> Result<(), Qwen3CompositionConversionError> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-output-promotion-failed"))?;
    if metadata_is_link(&metadata) || !metadata.is_file() {
        return Err(Qwen3CompositionConversionError::new(
            "composition-output-promotion-failed",
        ));
    }
    match fs::hard_link(source, destination) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(Qwen3CompositionConversionError::new(
                "composition-output-already-exists",
            ));
        }
        Err(_) => {
            return Err(Qwen3CompositionConversionError::new(
                "composition-output-promotion-failed",
            ));
        }
    }
    fs::remove_file(source)
        .map_err(|_| Qwen3CompositionConversionError::new("composition-output-promotion-failed"))
}

fn read_bounded_regular_file(
    path: &Path,
    maximum_bytes: u64,
    code: &'static str,
) -> Result<Vec<u8>, Qwen3CompositionConversionError> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| Qwen3CompositionConversionError::new(code))?;
    if metadata_is_link(&metadata)
        || !metadata.is_file()
        || metadata.len() == 0
        || metadata.len() > maximum_bytes
    {
        return Err(Qwen3CompositionConversionError::new(code));
    }
    let mut file = File::open(path).map_err(|_| Qwen3CompositionConversionError::new(code))?;
    let length =
        usize::try_from(metadata.len()).map_err(|_| Qwen3CompositionConversionError::new(code))?;
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| Qwen3CompositionConversionError::new(code))?;
    file.read_to_end(&mut bytes)
        .map_err(|_| Qwen3CompositionConversionError::new(code))?;
    if bytes.len() != length {
        return Err(Qwen3CompositionConversionError::new(code));
    }
    Ok(bytes)
}

fn validate_directory(
    path: &Path,
    code: &'static str,
) -> Result<PathBuf, Qwen3CompositionConversionError> {
    if !path.is_absolute() {
        return Err(Qwen3CompositionConversionError::new(code));
    }
    let metadata =
        fs::symlink_metadata(path).map_err(|_| Qwen3CompositionConversionError::new(code))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err(Qwen3CompositionConversionError::new(code));
    }
    fs::canonicalize(path).map_err(|_| Qwen3CompositionConversionError::new(code))
}

fn valid_file_name(value: &str) -> bool {
    let bytes = value.as_bytes();
    (1..=160).contains(&bytes.len())
        && bytes[0] != b'.'
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(*byte, b'.' | b'-' | b'_'))
}

#[cfg(unix)]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(windows)]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

fn sha256_bytes(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
}

impl RawIdentity {
    fn sha256_hex(self) -> String {
        hex_lower(&self.sha256)
    }
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AttemptReceipt<'a> {
    schema: &'static str,
    status: &'static str,
    profile_id: &'static str,
    profile_sha256: &'static str,
    operation_id: &'a str,
    model_lock_sha256: &'a str,
    tokenizer_lock_sha256: &'a str,
    converter_version: &'a str,
    converter_executable_sha256: &'a str,
    terminal_rule: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RejectionReceipt<'a> {
    schema: &'static str,
    status: &'static str,
    profile_id: &'static str,
    profile_sha256: &'static str,
    operation_id: &'a str,
    error_code: &'static str,
    safe_no_op: bool,
    retryable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompleteReceipt<'a> {
    schema: &'static str,
    status: &'static str,
    profile_id: &'static str,
    profile_sha256: &'static str,
    operation_id: &'a str,
    converter: ConverterReceipt<'a>,
    source: SourceReceipt<'a>,
    artifacts: Vec<ArtifactReceipt>,
    graph: GraphReceipt,
    component_receipts: ComponentReceipts,
    resource_plan: ResourceReceipt,
    durability: DurabilityReceipt,
    structural_composition_status: &'static str,
    model_quality_status: &'static str,
    source_framework_parity_status: &'static str,
    native_runtime_status: &'static str,
    browser_wasm_status: &'static str,
    browser_chat_status: &'static str,
    p2p_availability_status: &'static str,
    publication_status: &'static str,
    required_next_gate: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConverterReceipt<'a> {
    implementation_version: &'a str,
    executable_sha256: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceReceipt<'a> {
    model_lock_sha256: &'a str,
    tokenizer_lock_sha256: &'a str,
    relationship_status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtifactReceipt {
    ordinal: u32,
    kind: &'static str,
    file: &'static str,
    format_profile_id: &'static str,
    format_profile_sha256: &'static str,
    byte_length: u64,
    sha256: String,
}

fn artifact_receipts(artifacts: [CompositionArtifactIdentity; 6]) -> Vec<ArtifactReceipt> {
    let metadata = [
        (
            MODEL_FILE,
            SLM2_FORMAT_PROFILE_ID,
            SLM2_FORMAT_PROFILE_SHA256,
        ),
        (
            TOKENIZER_FILE,
            TOKENIZER2_FORMAT_PROFILE_ID,
            TOKENIZER2_FORMAT_PROFILE_SHA256,
        ),
        (
            TEMPLATE_FILE,
            TEMPLATE2_FORMAT_PROFILE_ID,
            TEMPLATE2_FORMAT_PROFILE_SHA256,
        ),
        (
            SAMPLING_FILE,
            SAMPLING2_FORMAT_PROFILE_ID,
            SAMPLING2_FORMAT_PROFILE_SHA256,
        ),
        (
            PROMPT_FILE,
            PROMPT2_FORMAT_PROFILE_ID,
            PROMPT2_FORMAT_PROFILE_SHA256,
        ),
        (
            COMPOSITION_FILE,
            ACG2_FORMAT_PROFILE_ID,
            ACG2_FORMAT_PROFILE_SHA256,
        ),
    ];
    artifacts
        .into_iter()
        .zip(metadata)
        .enumerate()
        .map(
            |(ordinal, (artifact, (file, profile_id, profile_sha256)))| ArtifactReceipt {
                ordinal: ordinal as u32,
                kind: artifact.kind,
                file,
                format_profile_id: profile_id,
                format_profile_sha256: profile_sha256,
                byte_length: artifact.byte_length,
                sha256: artifact.sha256_hex(),
            },
        )
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphReceipt {
    graph_identity_sha256: String,
    member_table_sha256: String,
    resolved_member_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ComponentReceipt {
    file: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ComponentReceipts {
    model: ComponentReceipt,
    tokenizer: ComponentReceipt,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResourceReceipt {
    model_artifact_bytes: u64,
    resident_dependency_artifact_bytes: u64,
    model_tensor_count: u32,
    stream_hash_buffer_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DurabilityReceipt {
    operation_id: String,
    directory_identity_sha256: String,
    method: String,
    operating_system: String,
    architecture: String,
    status: String,
}

fn durability_receipt(observation: &DirectoryFlushObservation) -> DurabilityReceipt {
    DurabilityReceipt {
        operation_id: observation.operation_id().to_owned(),
        directory_identity_sha256: observation.directory_identity_sha256().to_owned(),
        method: observation.method().to_owned(),
        operating_system: observation.operating_system().to_owned(),
        architecture: observation.architecture().to_owned(),
        status: observation.status().to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    static NEXT_TEST_ROOT: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn profile_identity_and_exact_model_shape_are_closed() {
        validate_profile().expect("profile");
        assert_eq!(TOKENIZER_FILE, "tokenizer.tokenizer2");
        assert_eq!(
            Path::new(TOKENIZER_FILE)
                .extension()
                .and_then(|value| value.to_str()),
            Some(crate::qwen_tokenizer2::QWEN_TOKENIZER2_FILE_EXTENSION)
        );
        assert_eq!(
            QWEN_TOKENIZER2_COMPOSITION_RECEIPT_FILE,
            "tokenizer.tokenizer2.conversion-receipt.json"
        );
        assert_eq!(
            QWEN_TOKENIZER2_CONVERSION_RECEIPT_SCHEMA,
            "tinyrustlm.qwen_tokenizer2_conversion_receipt.v2"
        );
        let exact = exact_spec(ArtifactClass::BaseModel);
        assert!(exact_model_spec(&exact));
        let mut wrong = exact.clone();
        wrong.vocabulary_size -= 1;
        assert!(!exact_model_spec(&wrong));
    }

    #[test]
    fn source_relationship_binds_shared_revision_and_files() {
        let root = test_root("source-locks");
        fs::create_dir(&root).expect("root");
        let pinned: Value = serde_json::from_slice(include_bytes!(
            "../../../../contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
        ))
        .expect("pinned tokenizer lock");
        let shared = |path: &str| {
            serde_json::json!({
                "path": path,
                "byteLength": 1,
                "sha256": "1111111111111111111111111111111111111111111111111111111111111111"
            })
        };
        let model = serde_json::json!({
            "schema": QWEN3_SOURCE_LOCK_SCHEMA,
            "modelId": "Qwen/Qwen3-0.6B",
            "revision": "1111111111111111111111111111111111111111",
            "architectureProfileId": QWEN3_ARCHITECTURE_PROFILE_ID,
            "files": {
                "config": pinned["files"]["config"].clone(),
                "generationConfig": shared("generation_config.json"),
                "license": shared("LICENSE"),
                "merges": shared("merges.txt"),
                "model": shared("model.safetensors"),
                "readme": shared("README.md"),
                "tokenizer": shared("tokenizer.json"),
                "tokenizerConfig": pinned["files"]["tokenizerConfig"].clone(),
                "vocab": shared("vocab.json")
            }
        });
        let tokenizer = serde_json::json!({
            "schema": QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA,
            "modelId": "Qwen/Qwen3-0.6B",
            "revision": "1111111111111111111111111111111111111111",
            "architectureProfileId": QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID,
            "files": {
                "config": pinned["files"]["config"].clone(),
                "merges": shared("merges.txt"),
                "tokenizer": shared("tokenizer.json"),
                "tokenizerConfig": pinned["files"]["tokenizerConfig"].clone(),
                "vocab": shared("vocab.json")
            }
        });
        let model_path = root.join("model.json");
        let tokenizer_path = root.join("tokenizer.json");
        write_create_only_bytes(&model_path, &serde_json::to_vec(&model).unwrap()).unwrap();
        write_create_only_bytes(&tokenizer_path, &serde_json::to_vec(&tokenizer).unwrap()).unwrap();
        let relationship =
            validate_source_relationship(&model_path, &tokenizer_path).expect("relationship");
        let execution = ConverterExecutionIdentity::new(
            "0.1.8",
            "2222222222222222222222222222222222222222222222222222222222222222",
        )
        .unwrap();
        assert_eq!(
            operation_id(&relationship, &execution),
            operation_id(&relationship, &execution)
        );
        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn accepted_checked_in_model_and_tokenizer_locks_form_one_relationship() {
        let repository_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let relationship = validate_source_relationship(
            &repository_root.join("contracts/vnext/qwen3-0.6b-base-source-lock.v2.json"),
            &repository_root.join("contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"),
        )
        .expect("accepted source relationship");
        assert_eq!(
            relationship.model_lock_sha256,
            "50a8c29e36398a9a088e4d9a224dad186809d34b1e050299d3ce3de7a01b7d0e"
        );
        assert_eq!(
            relationship.tokenizer_lock_sha256,
            "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"
        );
    }

    /// Matching locks cannot admit a different model configuration to the fixed template.
    #[test]
    fn template_model_source_identity_is_checked_before_output_creation() {
        assert_template_source_identity_rejected_before_output("config");
    }

    /// Matching tokenizer identities must still bind the exact source chat template.
    #[test]
    fn template_tokenizer_source_identity_is_checked_before_output_creation() {
        assert_template_source_identity_rejected_before_output("tokenizerConfig");
    }

    /// Exercises jointly changed identity fields through the public conversion boundary.
    fn assert_template_source_identity_rejected_before_output(source_field: &str) {
        let root = test_root(&format!("template-source-{source_field}"));
        fs::create_dir(&root).expect("root");
        let model_source = root.join("model-source");
        let tokenizer_source = root.join("tokenizer-source");
        fs::create_dir(&model_source).expect("model source");
        fs::create_dir(&tokenizer_source).expect("tokenizer source");
        let original_model: Value = serde_json::from_slice(include_bytes!(
            "../../../../contracts/vnext/qwen3-0.6b-base-source-lock.v2.json"
        ))
        .expect("model lock");
        let original_tokenizer: Value = serde_json::from_slice(include_bytes!(
            "../../../../contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
        ))
        .expect("tokenizer lock");
        let original_length = original_model["files"][source_field]["byteLength"]
            .as_u64()
            .expect("pinned byte length");
        let execution = ConverterExecutionIdentity::new(
            "0.1.8",
            "2222222222222222222222222222222222222222222222222222222222222222",
        )
        .expect("execution");
        let mut observations = Vec::new();
        for (identity_field, replacement) in [
            ("path", Value::String("different-config.json".to_owned())),
            ("byteLength", Value::from(original_length + 1)),
            (
                "sha256",
                Value::String(
                    "1111111111111111111111111111111111111111111111111111111111111111".to_owned(),
                ),
            ),
        ] {
            let mut model = original_model.clone();
            let mut tokenizer = original_tokenizer.clone();
            model["files"][source_field][identity_field] = replacement.clone();
            tokenizer["files"][source_field][identity_field] = replacement;
            let model_path = root.join(format!("{identity_field}-model-lock.json"));
            let tokenizer_path = root.join(format!("{identity_field}-tokenizer-lock.json"));
            fs::write(&model_path, serde_json::to_vec(&model).expect("model JSON"))
                .expect("model lock");
            fs::write(
                &tokenizer_path,
                serde_json::to_vec(&tokenizer).expect("tokenizer JSON"),
            )
            .expect("tokenizer lock");
            let output_root = root.join(format!("{identity_field}-output"));
            let error = convert_locked_qwen3_composition(
                &model_path,
                &model_source,
                &tokenizer_path,
                &tokenizer_source,
                &output_root,
                &execution,
            )
            .expect_err("different template source must reject");
            observations.push((identity_field, error.code(), output_root.exists()));
        }
        fs::remove_dir_all(&root).expect("cleanup");
        for (identity_field, error_code, output_created) in observations {
            assert_eq!(
                error_code, "composition-template-source-mismatch",
                "{source_field}.{identity_field}"
            );
            assert!(
                !output_created,
                "{source_field}.{identity_field} must reject before creating output"
            );
        }
    }

    #[test]
    fn component_receipt_must_match_the_exact_producer_identity() {
        let root = test_root("component-receipt-identity");
        fs::create_dir(&root).expect("root");
        let path = root.join("component-receipt.json");
        let original = b"{\"schema\":\"receipt.test\",\"status\":\"pass\",\"value\":1}\n";
        let changed = b"{\"schema\":\"receipt.test\",\"status\":\"pass\",\"value\":2}\n";
        fs::write(&path, original).expect("write original receipt");
        let identity = ReceiptIdentity::from_bytes(original);

        let accepted = component_receipt(&path, "receipt.test", identity).expect("receipt");
        assert_eq!(accepted.byte_length, identity.byte_length());
        assert_eq!(accepted.sha256, identity.sha256_hex());

        fs::write(&path, changed).expect("replace receipt bytes");
        assert_eq!(
            component_receipt(&path, "receipt.test", identity)
                .err()
                .expect("changed receipt bytes must fail")
                .code(),
            "composition-component-receipt-invalid"
        );

        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn source_relationship_rejects_profile_identity_and_shared_source_drift() {
        let root = test_root("source-relationship-drift");
        fs::create_dir(&root).expect("root");
        let model: Value = serde_json::from_slice(include_bytes!(
            "../../../../contracts/vnext/qwen3-0.6b-base-source-lock.v2.json"
        ))
        .expect("model lock");
        let tokenizer: Value = serde_json::from_slice(include_bytes!(
            "../../../../contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
        ))
        .expect("tokenizer lock");
        let assert_rejected =
            |name: &str, model: &Value, tokenizer: &Value, expected: &'static str| {
                let model_path = root.join(format!("{name}-model.json"));
                let tokenizer_path = root.join(format!("{name}-tokenizer.json"));
                fs::write(&model_path, serde_json::to_vec(model).expect("model JSON"))
                    .expect("write model");
                fs::write(
                    &tokenizer_path,
                    serde_json::to_vec(tokenizer).expect("tokenizer JSON"),
                )
                .expect("write tokenizer");
                assert_eq!(
                    validate_source_relationship(&model_path, &tokenizer_path)
                        .expect_err("relationship must reject")
                        .code(),
                    expected,
                    "{name}"
                );
            };

        let mut wrong_model_profile = model.clone();
        wrong_model_profile["architectureProfileId"] =
            Value::String(QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID.to_owned());
        assert_rejected(
            "wrong-model-profile",
            &wrong_model_profile,
            &tokenizer,
            "composition-model-source-lock-invalid",
        );

        let mut wrong_tokenizer_profile = tokenizer.clone();
        wrong_tokenizer_profile["architectureProfileId"] =
            Value::String(QWEN3_ARCHITECTURE_PROFILE_ID.to_owned());
        assert_rejected(
            "wrong-tokenizer-profile",
            &model,
            &wrong_tokenizer_profile,
            "composition-tokenizer-source-lock-invalid",
        );

        let mut wrong_model_id = tokenizer.clone();
        wrong_model_id["modelId"] = Value::String("Qwen/another-model".to_owned());
        assert_rejected(
            "model-id-drift",
            &model,
            &wrong_model_id,
            "composition-source-lock-mismatch",
        );

        let mut wrong_revision = tokenizer.clone();
        wrong_revision["revision"] =
            Value::String("1111111111111111111111111111111111111111".to_owned());
        assert_rejected(
            "revision-drift",
            &model,
            &wrong_revision,
            "composition-source-lock-mismatch",
        );

        let mut wrong_shared_file = tokenizer.clone();
        wrong_shared_file["files"]["config"]["sha256"] = Value::String(
            "1111111111111111111111111111111111111111111111111111111111111111".to_owned(),
        );
        assert_rejected(
            "shared-file-drift",
            &model,
            &wrong_shared_file,
            "composition-source-lock-mismatch",
        );

        let mut wrong_tokenizer_config = tokenizer.clone();
        wrong_tokenizer_config["files"]["tokenizerConfig"]["byteLength"] = Value::from(9_733);
        assert_rejected(
            "shared-tokenizer-config-drift",
            &model,
            &wrong_tokenizer_config,
            "composition-source-lock-mismatch",
        );

        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn fixed_members_are_written_reparsed_and_promoted_create_only() {
        let root = test_root("fixed-members");
        fs::create_dir(&root).expect("root");
        let template = write_template_member(&root.join(TEMPLATE_FILE)).expect("template");
        let sampling = write_sampling_member(&root.join(SAMPLING_FILE)).expect("sampling");
        let prompt = write_prompt_member(&root.join(PROMPT_FILE)).expect("prompt");
        assert_eq!(template.sha256_hex(), QWEN3_TEMPLATE2_ARTIFACT_SHA256);
        assert_eq!(sampling.sha256_hex(), SAMPLING2_ARTIFACT_SHA256);
        assert_eq!(prompt.sha256_hex(), PROMPT2_ARTIFACT_SHA256);
        assert_eq!(
            write_template_member(&root.join(TEMPLATE_FILE))
                .expect_err("collision")
                .code(),
            "composition-output-already-exists"
        );
        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn rejection_is_terminal_and_create_only() {
        let root = test_root("rejection");
        fs::create_dir(&root).expect("root");
        let output = OutputRoot {
            root: root.clone(),
            operation_id: "qwen3-composition-test".into(),
        };
        let error = Qwen3CompositionConversionError::new("composition-test-rejection");
        record_rejection(&output, error).expect("rejection");
        assert_eq!(
            record_rejection(&output, error)
                .expect_err("terminal collision")
                .code(),
            "composition-rejection-write-failed"
        );
        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn started_failure_preserves_attempt_and_terminal_rejection() {
        let root = test_root("started-failure");
        fs::create_dir(&root).expect("root");
        let model_source = root.join("model-source");
        let tokenizer_source = root.join("tokenizer-source");
        fs::create_dir(&model_source).expect("model source");
        fs::create_dir(&tokenizer_source).expect("tokenizer source");
        let pinned: Value = serde_json::from_slice(include_bytes!(
            "../../../../contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
        ))
        .expect("pinned tokenizer lock");
        let shared = |path: &str| {
            serde_json::json!({
                "path": path,
                "byteLength": 1,
                "sha256": "1111111111111111111111111111111111111111111111111111111111111111"
            })
        };
        let model_lock = serde_json::json!({
            "schema": QWEN3_SOURCE_LOCK_SCHEMA,
            "modelId": "Qwen/Qwen3-0.6B",
            "revision": "1111111111111111111111111111111111111111",
            "architectureProfileId": QWEN3_ARCHITECTURE_PROFILE_ID,
            "files": {
                "config": pinned["files"]["config"].clone(),
                "merges": shared("merges.txt"),
                "tokenizer": shared("tokenizer.json"),
                "tokenizerConfig": pinned["files"]["tokenizerConfig"].clone(),
                "vocab": shared("vocab.json")
            }
        });
        let tokenizer_lock = serde_json::json!({
            "schema": QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA,
            "modelId": "Qwen/Qwen3-0.6B",
            "revision": "1111111111111111111111111111111111111111",
            "architectureProfileId": QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID,
            "files": {
                "config": pinned["files"]["config"].clone(),
                "merges": shared("merges.txt"),
                "tokenizer": shared("tokenizer.json"),
                "tokenizerConfig": pinned["files"]["tokenizerConfig"].clone(),
                "vocab": shared("vocab.json")
            }
        });
        let model_lock_path = root.join("model-lock.json");
        let tokenizer_lock_path = root.join("tokenizer-lock.json");
        write_create_only_bytes(
            &model_lock_path,
            &serde_json::to_vec(&model_lock).expect("model lock bytes"),
        )
        .expect("model lock");
        write_create_only_bytes(
            &tokenizer_lock_path,
            &serde_json::to_vec(&tokenizer_lock).expect("tokenizer lock bytes"),
        )
        .expect("tokenizer lock");
        let output_root = root.join("output");
        let execution = ConverterExecutionIdentity::new(
            "0.1.8",
            "2222222222222222222222222222222222222222222222222222222222222222",
        )
        .expect("execution");

        let error = convert_locked_qwen3_composition(
            &model_lock_path,
            &model_source,
            &tokenizer_lock_path,
            &tokenizer_source,
            &output_root,
            &execution,
        )
        .expect_err("invalid source must reject after the transaction starts");
        assert!(!error.code().is_empty());
        assert!(output_root.join(ATTEMPT_FILE).is_file());
        assert!(output_root.join(REJECTION_FILE).is_file());
        assert!(!output_root.join(RECEIPT_FILE).exists());
        let rejection: Value = serde_json::from_slice(
            &read_bounded_regular_file(
                &output_root.join(REJECTION_FILE),
                RECEIPT_MAXIMUM_BYTES,
                "test-rejection-invalid",
            )
            .expect("rejection bytes"),
        )
        .expect("rejection JSON");
        assert_eq!(
            rejection.get("status").and_then(Value::as_str),
            Some("rejected")
        );
        assert_eq!(
            rejection.get("safeNoOp").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            rejection.get("retryable").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            rejection.get("errorCode").and_then(Value::as_str),
            Some(error.code())
        );

        assert_eq!(
            convert_locked_qwen3_composition(
                &model_lock_path,
                &model_source,
                &tokenizer_lock_path,
                &tokenizer_source,
                &output_root,
                &execution,
            )
            .expect_err("terminal root must not resume")
            .code(),
            "composition-output-already-exists"
        );
        fs::remove_dir_all(&root).expect("cleanup");
    }

    fn exact_spec(artifact_class: ArtifactClass) -> ModelSpec {
        ModelSpec {
            artifact_class,
            vocabulary_size: 151_936,
            context_length: 40_960,
            embedding_size: 1_024,
            feed_forward_size: 3_072,
            layer_count: 28,
            head_count: 16,
            kv_head_count: 8,
            head_dimension: 128,
            rope_theta: 1_000_000.0,
            normalization_epsilon: 0.000_001,
            tied_embeddings: true,
            qkv_bias: false,
            qk_normalization: true,
        }
    }

    fn test_root(label: &str) -> PathBuf {
        let id = NEXT_TEST_ROOT.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "tinyrustlm-composition-{label}-{}-{id}",
            std::process::id()
        ))
    }
}
