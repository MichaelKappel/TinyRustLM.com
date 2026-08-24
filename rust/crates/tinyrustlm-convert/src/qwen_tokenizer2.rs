use std::collections::BTreeSet;
use std::error::Error;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_durability::flush_owned_directory;
use tinyrustlm_tokenizer2::{
    Tokenizer2, TokenizerIdentity, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID,
    TOKENIZER2_FORMAT_PROFILE_SHA256,
};

use crate::execution::ConverterExecutionIdentity;
use crate::qwen_tokenizer::{
    parse_qwen_tokenizer, ParsedQwenTokenizer, QwenTokenizerModelContract,
};

/// Exact source-lock schema for standalone Qwen Tokenizer2 conversion.
pub const QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA: &str = "tinyrustlm.qwen_tokenizer2_source_lock.v1";
/// Exact standalone Qwen-to-Tokenizer2 conversion profile identifier.
pub const QWEN_TOKENIZER2_CONVERSION_PROFILE_ID: &str = "tinyrustlm.qwen-bytelevel-to-tokenizer2/1";
/// SHA-256 of the exact checked-in standalone tokenizer conversion profile.
pub const QWEN_TOKENIZER2_CONVERSION_PROFILE_SHA256: &str =
    "f70465a08b41599fe59f41b850912d0d408f0ec67e84ebeb7591524d1b14e12b";

const QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID: &str = "tinyrustlm.qwen3-tokenizer-source/1";
const CONVERSION_RECEIPT_SCHEMA: &str = "tinyrustlm.qwen_tokenizer2_conversion_receipt.v1";
const SOURCE_LOCK_MAXIMUM_BYTES: u64 = 1_048_576;
const CONFIG_MAXIMUM_BYTES: u64 = 1_048_576;
const TOKENIZER_MAXIMUM_BYTES: u64 = 64 * 1_048_576;
const HASH_BUFFER_BYTES: usize = 1_048_576;
const REQUIRED_SOURCE_FILES: [&str; 5] = [
    "config.json",
    "merges.txt",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
];
const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/qwen-tokenizer2-conversion-profile.v1.json");

/// Stable public-safe failure from standalone Qwen Tokenizer2 conversion.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct QwenTokenizer2ConversionError {
    code: &'static str,
}

impl QwenTokenizer2ConversionError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the bounded stable error code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for QwenTokenizer2ConversionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for QwenTokenizer2ConversionError {}

/// Exact output identities from a completed standalone tokenizer conversion.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QwenTokenizer2ConversionResult {
    tokenizer_path: PathBuf,
    receipt_path: PathBuf,
    tokenizer_identity: TokenizerIdentity,
}

impl QwenTokenizer2ConversionResult {
    /// Returns the promoted canonical Tokenizer2 path.
    pub fn tokenizer_path(&self) -> &Path {
        &self.tokenizer_path
    }

    /// Returns the promoted create-only receipt path.
    pub fn receipt_path(&self) -> &Path {
        &self.receipt_path
    }

    /// Returns the independently reparsed Tokenizer2 identity.
    pub const fn tokenizer_identity(&self) -> TokenizerIdentity {
        self.tokenizer_identity
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct QwenTokenizer2SourceLock {
    schema: String,
    model_id: String,
    revision: String,
    source_kind: String,
    architecture_profile_id: String,
    files: LockedFiles,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct LockedFiles {
    config: LockedFile,
    merges: LockedFile,
    tokenizer: LockedFile,
    tokenizer_config: LockedFile,
    vocab: LockedFile,
}

impl LockedFiles {
    fn entries(&self) -> [(&'static str, &LockedFile); 5] {
        [
            ("config.json", &self.config),
            ("merges.txt", &self.merges),
            ("tokenizer.json", &self.tokenizer),
            ("tokenizer_config.json", &self.tokenizer_config),
            ("vocab.json", &self.vocab),
        ]
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct LockedFile {
    path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Qwen3Config {
    architectures: Vec<String>,
    attention_bias: bool,
    attention_dropout: f64,
    bos_token_id: u32,
    eos_token_id: u32,
    head_dim: u32,
    hidden_act: String,
    hidden_size: u32,
    initializer_range: f64,
    intermediate_size: u32,
    max_position_embeddings: u32,
    max_window_layers: u32,
    model_type: String,
    num_attention_heads: u32,
    num_hidden_layers: u32,
    num_key_value_heads: u32,
    rms_norm_eps: f64,
    #[serde(rename = "rope_scaling")]
    _rope_scaling: (),
    rope_theta: f64,
    #[serde(rename = "sliding_window")]
    _sliding_window: (),
    tie_word_embeddings: bool,
    torch_dtype: String,
    transformers_version: String,
    use_cache: bool,
    use_sliding_window: bool,
    vocab_size: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversionReceipt<'a> {
    schema: &'static str,
    status: &'static str,
    converter_profile_id: &'static str,
    converter_profile_sha256: &'static str,
    tokenizer_format_profile_id: &'static str,
    tokenizer_format_profile_sha256: &'static str,
    converter: ConverterReceipt<'a>,
    source: SourceReceipt<'a>,
    artifact: ArtifactReceipt,
    durability: DurabilityReceipt,
    conversion_claim: &'static str,
    source_oracle_parity_status: &'static str,
    browser_wasm_status: &'static str,
    model_runtime_status: &'static str,
    model_quality_status: &'static str,
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
    lock_sha256: String,
    model_id: &'a str,
    revision: &'a str,
    source_kind: &'a str,
    architecture_profile_id: &'a str,
    files: &'a LockedFiles,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtifactReceipt {
    path: String,
    byte_length: u64,
    sha256: String,
    token_count: u32,
    base_token_count: u32,
    merge_count: u32,
    added_token_count: u32,
    special_token_count: u32,
    bos_token_id: Option<u32>,
    eos_token_id: Option<u32>,
    pad_token_id: Option<u32>,
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

/// Converts an exact locked five-file Qwen tokenizer source into Tokenizer2.
///
/// Source files remain read-only. The artifact and receipt are create-only,
/// same-directory promoted outputs. A successful return proves deterministic
/// format conversion and independent Tokenizer2 parsing only; it does not
/// assert source-oracle parity, browser execution, model runtime, or quality.
pub fn convert_locked_qwen_tokenizer2_source(
    source_lock_path: &Path,
    source_directory: &Path,
    output_tokenizer_path: &Path,
    execution: &ConverterExecutionIdentity,
) -> Result<QwenTokenizer2ConversionResult, QwenTokenizer2ConversionError> {
    validate_profile()?;
    let lock_bytes = read_bounded_regular_file(
        source_lock_path,
        SOURCE_LOCK_MAXIMUM_BYTES,
        "qwen-tokenizer2-source-lock-invalid",
    )?;
    let lock: QwenTokenizer2SourceLock =
        parse_complete_json(&lock_bytes, "qwen-tokenizer2-source-lock-invalid")?;
    validate_source_lock(&lock)?;
    let source_directory =
        validate_directory(source_directory, "qwen-tokenizer2-source-directory-invalid")?;
    validate_source_inventory(&source_directory)?;
    let initial_identities = verify_locked_files(&source_directory, &lock.files)?;
    let parsed = inspect_source(&source_directory)?;

    let outputs = OutputPaths::new(output_tokenizer_path)?;
    outputs.validate_absent()?;
    if source_directory == outputs.parent {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-output-overlaps-source",
        ));
    }

    let mut stage = create_new_file(&outputs.tokenizer_stage)?;
    let written_identity = parsed
        .write(&mut stage)
        .map_err(|error| QwenTokenizer2ConversionError::new(error.code()))?;
    stage
        .sync_all()
        .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-flush-failed"))?;
    drop(stage);
    let artifact_bytes = read_bounded_regular_file(
        &outputs.tokenizer_stage,
        TOKENIZER_MAXIMUM_BYTES,
        "qwen-tokenizer2-output-validation-failed",
    )?;
    let policy = TokenizerPolicy::new(TOKENIZER_MAXIMUM_BYTES, 1_048_576, 1_048_576, 4_194_304)
        .map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-validation-failed")
        })?;
    let validated = Tokenizer2::from_bytes(artifact_bytes, policy).map_err(|_| {
        QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-validation-failed")
    })?;
    if validated.identity() != written_identity
        || validated.token_count() != parsed.token_count()
        || validated.base_token_count() != parsed.base_token_count()
        || validated.bos_token_id() != parsed.bos_token_id()
        || validated.eos_token_id() != parsed.eos_token_id()
        || validated.pad_token_id() != parsed.pad_token_id()
    {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-output-validation-failed",
        ));
    }
    let final_identities = verify_locked_files(&source_directory, &lock.files)?;
    if initial_identities != final_identities {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-source-drift",
        ));
    }

    promote_create_only(&outputs.tokenizer_stage, &outputs.tokenizer)?;
    let operation_id = format!(
        "qwen-tokenizer2-convert-{}",
        &hex_lower(&written_identity.sha256)[..20]
    );
    let durability = flush_owned_directory(&outputs.parent, Path::new("."), &operation_id)
        .map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-directory-flush-failed")
        })?;
    let receipt = ConversionReceipt {
        schema: CONVERSION_RECEIPT_SCHEMA,
        status: "pass",
        converter_profile_id: QWEN_TOKENIZER2_CONVERSION_PROFILE_ID,
        converter_profile_sha256: QWEN_TOKENIZER2_CONVERSION_PROFILE_SHA256,
        tokenizer_format_profile_id: TOKENIZER2_FORMAT_PROFILE_ID,
        tokenizer_format_profile_sha256: TOKENIZER2_FORMAT_PROFILE_SHA256,
        converter: ConverterReceipt {
            implementation_version: execution.implementation_version(),
            executable_sha256: execution.executable_sha256(),
        },
        source: SourceReceipt {
            lock_sha256: sha256_bytes(&lock_bytes),
            model_id: &lock.model_id,
            revision: &lock.revision,
            source_kind: &lock.source_kind,
            architecture_profile_id: &lock.architecture_profile_id,
            files: &lock.files,
        },
        artifact: ArtifactReceipt {
            path: outputs.tokenizer_name.clone(),
            byte_length: written_identity.byte_length,
            sha256: hex_lower(&written_identity.sha256),
            token_count: parsed.token_count(),
            base_token_count: parsed.base_token_count(),
            merge_count: parsed.merge_count(),
            added_token_count: parsed.added_token_count(),
            special_token_count: parsed.special_token_count(),
            bos_token_id: parsed.bos_token_id(),
            eos_token_id: parsed.eos_token_id(),
            pad_token_id: parsed.pad_token_id(),
        },
        durability: DurabilityReceipt {
            operation_id: durability.operation_id().to_owned(),
            directory_identity_sha256: durability.directory_identity_sha256().to_owned(),
            method: durability.method().to_owned(),
            operating_system: durability.operating_system().to_owned(),
            architecture: durability.architecture().to_owned(),
            status: durability.status().to_owned(),
        },
        conversion_claim: "deterministic-tokenizer-format-conversion-only",
        source_oracle_parity_status: "not-assessed-by-converter",
        browser_wasm_status: "not-assessed-by-converter",
        model_runtime_status: "not-assessed-by-converter",
        model_quality_status: "not-assessed-by-converter",
        required_next_gate:
            "broad-source-oracle-parity-and-full-artifact-native-browser-wasm-replay",
    };
    let mut receipt_bytes = serde_json::to_vec_pretty(&receipt).map_err(|_| {
        QwenTokenizer2ConversionError::new("qwen-tokenizer2-receipt-serialization-failed")
    })?;
    receipt_bytes.push(b'\n');
    write_create_only_synced(&outputs.receipt_stage, &receipt_bytes)?;
    promote_create_only(&outputs.receipt_stage, &outputs.receipt)?;
    flush_owned_directory(
        &outputs.parent,
        Path::new("."),
        &format!("{operation_id}-receipt"),
    )
    .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-directory-flush-failed"))?;

    Ok(QwenTokenizer2ConversionResult {
        tokenizer_path: outputs.tokenizer,
        receipt_path: outputs.receipt,
        tokenizer_identity: written_identity,
    })
}

fn validate_profile() -> Result<(), QwenTokenizer2ConversionError> {
    if sha256_bytes(PROFILE_BYTES) != QWEN_TOKENIZER2_CONVERSION_PROFILE_SHA256 {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-conversion-profile-drift",
        ));
    }
    let profile: Value =
        parse_complete_json(PROFILE_BYTES, "qwen-tokenizer2-conversion-profile-invalid")?;
    if profile.get("profileId").and_then(Value::as_str)
        != Some(QWEN_TOKENIZER2_CONVERSION_PROFILE_ID)
    {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-conversion-profile-invalid",
        ));
    }
    Ok(())
}

fn validate_source_lock(
    lock: &QwenTokenizer2SourceLock,
) -> Result<(), QwenTokenizer2ConversionError> {
    if lock.schema != QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA
        || !valid_model_id(&lock.model_id)
        || !valid_revision(&lock.revision)
        || !matches!(
            lock.source_kind.as_str(),
            "upstream-checkpoint" | "merged-trained-checkpoint"
        )
        || lock.architecture_profile_id != QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID
    {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-source-lock-invalid",
        ));
    }
    for (expected, file) in lock.files.entries() {
        if file.path != expected || file.byte_length == 0 || !valid_sha256(&file.sha256) {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-source-lock-invalid",
            ));
        }
    }
    Ok(())
}

fn inspect_source(source: &Path) -> Result<ParsedQwenTokenizer, QwenTokenizer2ConversionError> {
    let config_bytes = read_bounded_regular_file(
        &source.join("config.json"),
        CONFIG_MAXIMUM_BYTES,
        "qwen-tokenizer2-config-invalid",
    )?;
    let config: Qwen3Config = parse_complete_json(&config_bytes, "qwen-tokenizer2-config-invalid")?;
    validate_qwen3_config(&config)?;
    let tokenizer_bytes = read_bounded_regular_file(
        &source.join("tokenizer.json"),
        TOKENIZER_MAXIMUM_BYTES,
        "qwen-tokenizer2-tokenizer-invalid",
    )?;
    let tokenizer_config_bytes = read_bounded_regular_file(
        &source.join("tokenizer_config.json"),
        CONFIG_MAXIMUM_BYTES,
        "qwen-tokenizer2-tokenizer-config-invalid",
    )?;
    let vocab_bytes = read_bounded_regular_file(
        &source.join("vocab.json"),
        TOKENIZER_MAXIMUM_BYTES,
        "qwen-tokenizer2-vocab-invalid",
    )?;
    let merges_bytes = read_bounded_regular_file(
        &source.join("merges.txt"),
        TOKENIZER_MAXIMUM_BYTES,
        "qwen-tokenizer2-merges-invalid",
    )?;
    parse_qwen_tokenizer(
        &tokenizer_bytes,
        &tokenizer_config_bytes,
        &vocab_bytes,
        &merges_bytes,
        QwenTokenizerModelContract {
            vocabulary_size: config.vocab_size,
            bos_token_id: config.bos_token_id,
            eos_token_id: config.eos_token_id,
        },
    )
    .map_err(|error| QwenTokenizer2ConversionError::new(error.code()))
}

fn validate_qwen3_config(config: &Qwen3Config) -> Result<(), QwenTokenizer2ConversionError> {
    if config.architectures != ["Qwen3ForCausalLM"]
        || config.attention_bias
        || config.attention_dropout != 0.0
        || config.bos_token_id >= config.vocab_size
        || config.eos_token_id >= config.vocab_size
        || config.head_dim == 0
        || config.hidden_act != "silu"
        || config.hidden_size == 0
        || !config.initializer_range.is_finite()
        || config.initializer_range <= 0.0
        || config.intermediate_size == 0
        || config.max_position_embeddings == 0
        || config.max_window_layers == 0
        || config.max_window_layers > config.num_hidden_layers
        || config.model_type != "qwen3"
        || config.num_attention_heads == 0
        || config.num_hidden_layers == 0
        || config.num_key_value_heads == 0
        || !config
            .num_attention_heads
            .is_multiple_of(config.num_key_value_heads)
        || !config.rms_norm_eps.is_finite()
        || config.rms_norm_eps <= 0.0
        || !config.rope_theta.is_finite()
        || config.rope_theta <= 0.0
        || !config.tie_word_embeddings
        || !matches!(config.torch_dtype.as_str(), "bfloat16" | "float32")
        || config.transformers_version.is_empty()
        || !config.use_cache
        || config.use_sliding_window
    {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-config-semantics-unsupported",
        ));
    }
    Ok(())
}

fn parse_complete_json<'a, T: Deserialize<'a>>(
    bytes: &'a [u8],
    code: &'static str,
) -> Result<T, QwenTokenizer2ConversionError> {
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let result =
        T::deserialize(&mut deserializer).map_err(|_| QwenTokenizer2ConversionError::new(code))?;
    deserializer
        .end()
        .map_err(|_| QwenTokenizer2ConversionError::new(code))?;
    Ok(result)
}

fn validate_source_inventory(source: &Path) -> Result<(), QwenTokenizer2ConversionError> {
    let mut actual = BTreeSet::new();
    for entry in fs::read_dir(source).map_err(|_| {
        QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-inventory-invalid")
    })? {
        let entry = entry.map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-inventory-invalid")
        })?;
        let name = entry.file_name().into_string().map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-inventory-invalid")
        })?;
        let metadata = fs::symlink_metadata(entry.path()).map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-inventory-invalid")
        })?;
        if metadata_is_link(&metadata) || !metadata.is_file() || !actual.insert(name) {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-source-inventory-invalid",
            ));
        }
    }
    let expected = REQUIRED_SOURCE_FILES
        .iter()
        .map(|name| (*name).to_owned())
        .collect::<BTreeSet<_>>();
    if actual != expected {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-source-inventory-invalid",
        ));
    }
    Ok(())
}

fn verify_locked_files(
    source: &Path,
    files: &LockedFiles,
) -> Result<Vec<(String, u64, String)>, QwenTokenizer2ConversionError> {
    let mut identities = Vec::with_capacity(5);
    for (expected, locked) in files.entries() {
        let path = source.join(expected);
        let metadata = fs::symlink_metadata(&path).map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-file-invalid")
        })?;
        if metadata_is_link(&metadata)
            || !metadata.is_file()
            || metadata.len() != locked.byte_length
        {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-source-file-invalid",
            ));
        }
        let digest = sha256_file(&path)?;
        if digest != locked.sha256 {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-source-hash-mismatch",
            ));
        }
        identities.push((expected.to_owned(), metadata.len(), digest));
    }
    Ok(identities)
}

struct OutputPaths {
    parent: PathBuf,
    tokenizer: PathBuf,
    receipt: PathBuf,
    tokenizer_stage: PathBuf,
    receipt_stage: PathBuf,
    tokenizer_name: String,
}

impl OutputPaths {
    fn new(tokenizer: &Path) -> Result<Self, QwenTokenizer2ConversionError> {
        if !tokenizer.is_absolute()
            || tokenizer.extension().and_then(|value| value.to_str()) != Some("tok2")
        {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-output-path-invalid",
            ));
        }
        let parent = tokenizer.parent().ok_or_else(|| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-path-invalid")
        })?;
        let parent = validate_directory(parent, "qwen-tokenizer2-output-directory-invalid")?;
        let tokenizer_name = tokenizer
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| valid_file_name(value))
            .ok_or_else(|| {
                QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-path-invalid")
            })?
            .to_owned();
        let tokenizer = parent.join(&tokenizer_name);
        let receipt_name = format!("{tokenizer_name}.conversion-receipt.json");
        Ok(Self {
            parent: parent.clone(),
            tokenizer: tokenizer.clone(),
            receipt: parent.join(&receipt_name),
            tokenizer_stage: parent.join(format!(".{tokenizer_name}.staging")),
            receipt_stage: parent.join(format!(".{receipt_name}.staging")),
            tokenizer_name,
        })
    }

    fn validate_absent(&self) -> Result<(), QwenTokenizer2ConversionError> {
        for path in [
            &self.tokenizer,
            &self.receipt,
            &self.tokenizer_stage,
            &self.receipt_stage,
        ] {
            if fs::symlink_metadata(path).is_ok() {
                return Err(QwenTokenizer2ConversionError::new(
                    "qwen-tokenizer2-output-already-exists",
                ));
            }
        }
        Ok(())
    }
}

fn create_new_file(path: &Path) -> Result<File, QwenTokenizer2ConversionError> {
    OpenOptions::new()
        .write(true)
        .read(true)
        .create_new(true)
        .open(path)
        .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-create-failed"))
}

fn write_create_only_synced(
    path: &Path,
    bytes: &[u8],
) -> Result<(), QwenTokenizer2ConversionError> {
    let mut file = create_new_file(path)?;
    file.write_all(bytes)
        .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-write-failed"))?;
    file.sync_all()
        .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-flush-failed"))
}

fn promote_create_only(
    source: &Path,
    destination: &Path,
) -> Result<(), QwenTokenizer2ConversionError> {
    let metadata = fs::symlink_metadata(source).map_err(|_| {
        QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-promotion-failed")
    })?;
    if metadata_is_link(&metadata) || !metadata.is_file() {
        return Err(QwenTokenizer2ConversionError::new(
            "qwen-tokenizer2-output-promotion-failed",
        ));
    }
    match fs::hard_link(source, destination) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-output-already-exists",
            ));
        }
        Err(_) => {
            return Err(QwenTokenizer2ConversionError::new(
                "qwen-tokenizer2-output-promotion-failed",
            ));
        }
    }
    fs::remove_file(source)
        .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-output-promotion-failed"))
}

fn read_bounded_regular_file(
    path: &Path,
    maximum_bytes: u64,
    code: &'static str,
) -> Result<Vec<u8>, QwenTokenizer2ConversionError> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| QwenTokenizer2ConversionError::new(code))?;
    if metadata_is_link(&metadata)
        || !metadata.is_file()
        || metadata.len() == 0
        || metadata.len() > maximum_bytes
    {
        return Err(QwenTokenizer2ConversionError::new(code));
    }
    fs::read(path).map_err(|_| QwenTokenizer2ConversionError::new(code))
}

fn validate_directory(
    path: &Path,
    code: &'static str,
) -> Result<PathBuf, QwenTokenizer2ConversionError> {
    if !path.is_absolute() {
        return Err(QwenTokenizer2ConversionError::new(code));
    }
    let metadata =
        fs::symlink_metadata(path).map_err(|_| QwenTokenizer2ConversionError::new(code))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err(QwenTokenizer2ConversionError::new(code));
    }
    fs::canonicalize(path).map_err(|_| QwenTokenizer2ConversionError::new(code))
}

fn sha256_file(path: &Path) -> Result<String, QwenTokenizer2ConversionError> {
    let mut file = File::open(path)
        .map_err(|_| QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-file-invalid"))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let count = file.read(&mut buffer).map_err(|_| {
            QwenTokenizer2ConversionError::new("qwen-tokenizer2-source-file-invalid")
        })?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex_lower(&hasher.finalize()))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
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

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn valid_revision(value: &str) -> bool {
    value.len() == 40
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn valid_model_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && !value.starts_with('/')
        && !value.ends_with('/')
        && !value.contains("//")
        && !value.contains("..")
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'.' | b'_' | b'-'))
}

fn valid_file_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 255
        && value != "."
        && value != ".."
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

#[cfg(windows)]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}
