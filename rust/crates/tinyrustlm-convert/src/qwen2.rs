use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_durability::flush_owned_directory;
use tinyrustlm_slm2::{
    required_model_tensors, validate_model, write_model, ArtifactClass, ModelIdentity, ModelSpec,
    TensorInput, TensorSpec, ValidationPolicy, SLM2_FORMAT_PROFILE_ID, SLM2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_tokenizer2::{
    Tokenizer2, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID, TOKENIZER2_FORMAT_PROFILE_SHA256,
};

use crate::qwen_tokenizer::{
    parse_qwen_tokenizer, ParsedQwenTokenizer, QwenTokenizerModelContract,
};

/// The sole current Qwen2 Safetensors to SLM2 conversion profile.
pub const QWEN2_CONVERSION_PROFILE_ID: &str = "tinyrustlm.qwen2-safetensors-to-slm2-f32/1";
/// The SHA-256 of the exact checked-in Qwen2 conversion profile bytes.
pub const QWEN2_CONVERSION_PROFILE_SHA256: &str =
    "db4d16ce83460856588bda98829a16bbc23805f82ecad0f40b9380c77ea092fc";
/// The exact source-lock schema consumed by this converter.
pub const QWEN2_SOURCE_LOCK_SCHEMA: &str = "tinyrustlm.qwen2_source_lock.v1";

const QWEN2_ARCHITECTURE_PROFILE_ID: &str = "tinyrustlm.qwen2-dense-gqa/1";
const CONVERSION_RECEIPT_SCHEMA: &str = "tinyrustlm.qwen2_conversion_receipt.v1";
const SOURCE_LOCK_MAXIMUM_BYTES: u64 = 1_048_576;
const CONFIG_MAXIMUM_BYTES: u64 = 1_048_576;
const TOKENIZER_CONFIG_MAXIMUM_BYTES: u64 = 1_048_576;
const TOKENIZER_MAXIMUM_BYTES: u64 = 64 * 1_048_576;
const SAFETENSORS_HEADER_MAXIMUM_BYTES: u64 = 16 * 1_048_576;
const HASH_BUFFER_BYTES: usize = 1_048_576;
const TENSOR_PAYLOAD_ALIGNMENT: u32 = 64;
const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/qwen2-safetensors-conversion-profile.v1.json");
const REQUIRED_SOURCE_FILES: [&str; 9] = [
    "LICENSE",
    "README.md",
    "config.json",
    "generation_config.json",
    "merges.txt",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
];

/// A bounded, public-safe converter failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Qwen2ConversionError {
    code: &'static str,
}

impl Qwen2ConversionError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for Qwen2ConversionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Qwen2ConversionError {}

/// Identity of the exact converter executable running one operation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConverterExecutionIdentity {
    implementation_version: String,
    executable_sha256: String,
}

impl ConverterExecutionIdentity {
    /// Creates a validated converter execution identity.
    pub fn new(
        implementation_version: impl Into<String>,
        executable_sha256: impl Into<String>,
    ) -> Result<Self, Qwen2ConversionError> {
        let result = Self {
            implementation_version: implementation_version.into(),
            executable_sha256: executable_sha256.into(),
        };
        if !valid_safe_identifier(&result.implementation_version, 128)
            || !valid_sha256(&result.executable_sha256)
        {
            return Err(Qwen2ConversionError::new(
                "qwen2-converter-identity-invalid",
            ));
        }
        Ok(result)
    }

    /// Returns the bounded implementation version.
    pub fn implementation_version(&self) -> &str {
        &self.implementation_version
    }

    /// Returns the lowercase executable SHA-256.
    pub fn executable_sha256(&self) -> &str {
        &self.executable_sha256
    }
}

/// Successful output identities from one complete conversion transaction.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Qwen2ConversionResult {
    model_path: PathBuf,
    tokenizer_path: PathBuf,
    template_path: PathBuf,
    receipt_path: PathBuf,
    model_identity: ModelIdentity,
}

impl Qwen2ConversionResult {
    /// Returns the promoted SLM2 model path.
    pub fn model_path(&self) -> &Path {
        &self.model_path
    }

    /// Returns the promoted exact tokenizer artifact path.
    pub fn tokenizer_path(&self) -> &Path {
        &self.tokenizer_path
    }

    /// Returns the promoted exact chat-template artifact path.
    pub fn template_path(&self) -> &Path {
        &self.template_path
    }

    /// Returns the promoted conversion receipt path.
    pub fn receipt_path(&self) -> &Path {
        &self.receipt_path
    }

    /// Returns the independently validated SLM2 identity.
    pub const fn model_identity(&self) -> &ModelIdentity {
        &self.model_identity
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Qwen2SourceLock {
    schema: String,
    model_id: String,
    revision: String,
    source_kind: String,
    artifact_class: String,
    architecture_profile_id: String,
    license_spdx: String,
    license_disposition: String,
    files: LockedFiles,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct LockedFiles {
    config: LockedFile,
    generation_config: LockedFile,
    license: LockedFile,
    merges: LockedFile,
    model: LockedFile,
    readme: LockedFile,
    tokenizer: LockedFile,
    tokenizer_config: LockedFile,
    vocab: LockedFile,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct LockedFile {
    path: String,
    byte_length: u64,
    sha256: String,
}

impl LockedFiles {
    fn entries(&self) -> [(&'static str, &LockedFile); 9] {
        [
            ("config.json", &self.config),
            ("generation_config.json", &self.generation_config),
            ("LICENSE", &self.license),
            ("merges.txt", &self.merges),
            ("model.safetensors", &self.model),
            ("README.md", &self.readme),
            ("tokenizer.json", &self.tokenizer),
            ("tokenizer_config.json", &self.tokenizer_config),
            ("vocab.json", &self.vocab),
        ]
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Qwen2Config {
    architectures: Vec<String>,
    attention_dropout: f64,
    bos_token_id: u32,
    eos_token_id: u32,
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
    rope_theta: f64,
    sliding_window: u32,
    tie_word_embeddings: bool,
    torch_dtype: String,
    transformers_version: String,
    use_cache: bool,
    use_sliding_window: bool,
    vocab_size: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SourceDtype {
    Bf16,
    F32,
}

impl SourceDtype {
    const fn source_bytes(self) -> u64 {
        match self {
            Self::Bf16 => 2,
            Self::F32 => 4,
        }
    }

    const fn label(self) -> &'static str {
        match self {
            Self::Bf16 => "BF16",
            Self::F32 => "F32",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawTensor {
    dtype: String,
    shape: Vec<u64>,
    data_offsets: [u64; 2],
}

struct SafetensorsHeader {
    tensors: BTreeMap<String, RawTensor>,
}

impl<'de> Deserialize<'de> for SafetensorsHeader {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct HeaderVisitor;

        impl<'de> Visitor<'de> for HeaderVisitor {
            type Value = SafetensorsHeader;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a safetensors header object with unique tensor names")
            }

            fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut tensors = BTreeMap::new();
                let mut metadata_seen = false;
                while let Some(name) = map.next_key::<String>()? {
                    if name == "__metadata__" {
                        if metadata_seen {
                            return Err(de::Error::duplicate_field("__metadata__"));
                        }
                        metadata_seen = true;
                        let _: BTreeMap<String, String> = map.next_value()?;
                        continue;
                    }
                    let tensor: RawTensor = map.next_value()?;
                    if tensors.insert(name.clone(), tensor).is_some() {
                        return Err(de::Error::custom(format_args!(
                            "duplicate tensor name {name}"
                        )));
                    }
                }
                Ok(SafetensorsHeader { tensors })
            }
        }

        deserializer.deserialize_map(HeaderVisitor)
    }
}

struct UniqueObject(BTreeMap<String, Value>);

impl<'de> Deserialize<'de> for UniqueObject {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct ObjectVisitor;

        impl<'de> Visitor<'de> for ObjectVisitor {
            type Value = UniqueObject;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a JSON object with unique keys")
            }

            fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut values = BTreeMap::new();
                while let Some(name) = map.next_key::<String>()? {
                    let value: Value = map.next_value()?;
                    if values.insert(name.clone(), value).is_some() {
                        return Err(de::Error::custom(format_args!(
                            "duplicate object key {name}"
                        )));
                    }
                }
                Ok(UniqueObject(values))
            }
        }

        deserializer.deserialize_map(ObjectVisitor)
    }
}

#[derive(Clone, Debug)]
struct SourceTensor {
    dtype: SourceDtype,
    shape: Vec<u64>,
    start: u64,
    end: u64,
}

struct InspectedSource {
    spec: ModelSpec,
    dtype: SourceDtype,
    data_offset: u64,
    tensors: BTreeMap<String, SourceTensor>,
    parameter_count: u64,
    tokenizer: ParsedQwenTokenizer,
}

struct TensorReader {
    path: PathBuf,
    source_payload_offset: u64,
    source_tensor_offset: u64,
    source_dtype: SourceDtype,
    output_length: u64,
    position: u64,
    file: Option<File>,
}

impl TensorReader {
    fn new(
        path: PathBuf,
        source_payload_offset: u64,
        tensor: &SourceTensor,
    ) -> Result<Self, Qwen2ConversionError> {
        let source_elements = tensor
            .end
            .checked_sub(tensor.start)
            .and_then(|length| length.checked_div(tensor.dtype.source_bytes()))
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-source-offset-invalid"))?;
        let output_length = source_elements
            .checked_mul(4)
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-source-offset-invalid"))?;
        Ok(Self {
            path,
            source_payload_offset,
            source_tensor_offset: tensor.start,
            source_dtype: tensor.dtype,
            output_length,
            position: 0,
            file: None,
        })
    }

    fn ensure_file(&mut self) -> io::Result<&mut File> {
        if self.file.is_none() {
            let mut file = File::open(&self.path)?;
            let element = self.position / 4;
            let source_position = self
                .source_payload_offset
                .checked_add(self.source_tensor_offset)
                .and_then(|offset| {
                    element
                        .checked_mul(self.source_dtype.source_bytes())
                        .and_then(|relative| offset.checked_add(relative))
                })
                .ok_or_else(|| io::Error::other("qwen2 source offset overflow"))?;
            file.seek(SeekFrom::Start(source_position))?;
            self.file = Some(file);
        }
        self.file
            .as_mut()
            .ok_or_else(|| io::Error::other("qwen2 source file unavailable"))
    }
}

impl Read for TensorReader {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        if self.position == self.output_length || output.is_empty() {
            self.file = None;
            return Ok(0);
        }
        if !self.position.is_multiple_of(4) || output.len() < 4 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "qwen2 tensor reads must be aligned f32 words",
            ));
        }
        let remaining = self.output_length - self.position;
        let requested = usize::try_from(remaining.min(output.len() as u64))
            .map_err(|_| io::Error::other("qwen2 tensor read overflow"))?;
        let count = requested - (requested % 4);
        match self.source_dtype {
            SourceDtype::F32 => self.ensure_file()?.read_exact(&mut output[..count])?,
            SourceDtype::Bf16 => {
                let mut source = [0_u8; 8192];
                let mut written = 0usize;
                while written < count {
                    let output_chunk = (count - written).min(source.len() * 2);
                    let source_chunk = output_chunk / 2;
                    self.ensure_file()?
                        .read_exact(&mut source[..source_chunk])?;
                    for (index, pair) in source[..source_chunk].chunks_exact(2).enumerate() {
                        let bf16 = u16::from_le_bytes([pair[0], pair[1]]);
                        let value = f32::from_bits(u32::from(bf16) << 16);
                        let destination = written + index * 4;
                        output[destination..destination + 4].copy_from_slice(&value.to_le_bytes());
                    }
                    written += output_chunk;
                }
            }
        }
        self.position += count as u64;
        if self.position == self.output_length {
            self.file = None;
        }
        Ok(count)
    }
}

impl Seek for TensorReader {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        let next = match position {
            SeekFrom::Start(value) => i128::from(value),
            SeekFrom::End(value) => i128::from(self.output_length) + i128::from(value),
            SeekFrom::Current(value) => i128::from(self.position) + i128::from(value),
        };
        if next < 0 || next > i128::from(self.output_length) || next % 4 != 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "qwen2 tensor seek is outside an aligned payload",
            ));
        }
        self.position =
            u64::try_from(next).map_err(|_| io::Error::other("qwen2 tensor seek overflow"))?;
        self.file = None;
        Ok(self.position)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversionReceipt<'a> {
    schema: &'static str,
    status: &'static str,
    converter_profile_id: &'static str,
    converter_profile_sha256: &'static str,
    converter: ConverterReceipt<'a>,
    source: SourceReceipt<'a>,
    model: ModelReceipt,
    tokenizer: TokenizerReceipt,
    chat_template: SourceTemplateReceipt,
    durability: DurabilityReceipt,
    conversion_claim: &'static str,
    quality_status: &'static str,
    runtime_status: &'static str,
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
    artifact_class: &'a str,
    architecture_profile_id: &'a str,
    license_spdx: &'a str,
    license_disposition: &'a str,
    source_model_sha256: &'a str,
    source_model_bytes: u64,
    source_dtype: &'static str,
    tensor_count: usize,
    parameter_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelReceipt {
    path: String,
    format_profile_id: &'static str,
    format_profile_sha256: &'static str,
    byte_length: u64,
    artifact_sha256: String,
    manifest_sha256: String,
    tensor_layout_sha256: String,
    tensor_count: usize,
    specification: ModelSpecReceipt,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelSpecReceipt {
    artifact_class: &'static str,
    vocabulary_size: u32,
    context_length: u32,
    embedding_size: u32,
    feed_forward_size: u32,
    layer_count: u32,
    head_count: u32,
    kv_head_count: u32,
    head_dimension: u32,
    rope_theta: f32,
    normalization_epsilon: f32,
    tied_embeddings: bool,
    qkv_bias: bool,
    qk_normalization: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenizerReceipt {
    path: String,
    byte_length: u64,
    sha256: String,
    format_profile_id: &'static str,
    format_profile_sha256: &'static str,
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
struct SourceTemplateReceipt {
    path: String,
    byte_length: u64,
    sha256: String,
    source_format: &'static str,
    promotion_status: &'static str,
    required_next_gate: &'static str,
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

/// Converts one exact locked Qwen2 checkpoint into deterministic SLM2 F32 bytes.
///
/// The source lock and source directory remain read-only. The model, exact
/// tokenizer, exact chat template, and conversion receipt are create-only
/// siblings. Interrupted staging files are preserved and never accepted as
/// complete output.
pub fn convert_locked_qwen2_source(
    source_lock_path: &Path,
    source_directory: &Path,
    output_model_path: &Path,
    execution: &ConverterExecutionIdentity,
) -> Result<Qwen2ConversionResult, Qwen2ConversionError> {
    validate_profile()?;
    let lock_bytes = read_bounded_regular_file(
        source_lock_path,
        SOURCE_LOCK_MAXIMUM_BYTES,
        "qwen2-source-lock-invalid",
    )?;
    let lock: Qwen2SourceLock = serde_json::from_slice(&lock_bytes)
        .map_err(|_| Qwen2ConversionError::new("qwen2-source-lock-invalid"))?;
    validate_source_lock(&lock)?;
    let source_directory = validate_directory(source_directory, "qwen2-source-directory-invalid")?;
    validate_source_inventory(&source_directory)?;
    let initial_identities = verify_locked_files(&source_directory, &lock.files)?;
    let source = inspect_source(&source_directory, &lock)?;

    let outputs = OutputPaths::new(output_model_path)?;
    outputs.validate_absent()?;
    if source_directory == outputs.parent {
        return Err(Qwen2ConversionError::new("qwen2-output-overlaps-source"));
    }

    let model_source = source_directory.join("model.safetensors");
    let mut inputs = build_tensor_inputs(&source, &model_source)?;
    let mut model_stage = create_new_file(&outputs.model_stage)?;
    let written_identity =
        write_model(&mut model_stage, &source.spec, &mut inputs).map_err(map_slm2_error)?;
    model_stage
        .sync_all()
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-flush-failed"))?;
    drop(model_stage);

    let mut staged_model = File::open(&outputs.model_stage)
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-validation-failed"))?;
    let validated = validate_model(&mut staged_model, ValidationPolicy::default())
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-validation-failed"))?;
    if validated.identity() != &written_identity || validated.spec() != &source.spec {
        return Err(Qwen2ConversionError::new("qwen2-output-validation-failed"));
    }

    let mut tokenizer_stage = create_new_file(&outputs.tokenizer_stage)?;
    let written_tokenizer_identity = source
        .tokenizer
        .write(&mut tokenizer_stage)
        .map_err(|error| Qwen2ConversionError::new(error.code()))?;
    tokenizer_stage
        .sync_all()
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-flush-failed"))?;
    drop(tokenizer_stage);
    let tokenizer_artifact = read_bounded_regular_file(
        &outputs.tokenizer_stage,
        TOKENIZER_MAXIMUM_BYTES,
        "qwen2-tokenizer2-validation-failed",
    )?;
    let tokenizer_policy =
        TokenizerPolicy::new(TOKENIZER_MAXIMUM_BYTES, 1_048_576, 1_048_576, 4_194_304)
            .map_err(|_| Qwen2ConversionError::new("qwen2-tokenizer2-validation-failed"))?;
    let validated_tokenizer = Tokenizer2::from_bytes(tokenizer_artifact, tokenizer_policy)
        .map_err(|_| Qwen2ConversionError::new("qwen2-tokenizer2-validation-failed"))?;
    if validated_tokenizer.identity() != written_tokenizer_identity
        || validated_tokenizer.token_count() != source.tokenizer.token_count()
        || validated_tokenizer.base_token_count() != source.tokenizer.base_token_count()
        || validated_tokenizer.bos_token_id() != source.tokenizer.bos_token_id()
        || validated_tokenizer.eos_token_id() != source.tokenizer.eos_token_id()
        || validated_tokenizer.pad_token_id() != source.tokenizer.pad_token_id()
    {
        return Err(Qwen2ConversionError::new(
            "qwen2-tokenizer2-validation-failed",
        ));
    }
    write_create_only_synced(
        &outputs.template_stage,
        source.tokenizer.chat_template_bytes(),
    )?;
    let final_identities = verify_locked_files(&source_directory, &lock.files)?;
    if initial_identities != final_identities {
        return Err(Qwen2ConversionError::new("qwen2-source-drift"));
    }

    promote_create_only(&outputs.model_stage, &outputs.model)?;
    promote_create_only(&outputs.tokenizer_stage, &outputs.tokenizer)?;
    promote_create_only(&outputs.template_stage, &outputs.template)?;
    let operation_id = format!(
        "qwen2-convert-{}",
        &written_identity.artifact_sha256_hex()[..20]
    );
    let durability = flush_owned_directory(&outputs.parent, Path::new("."), &operation_id)
        .map_err(|_| Qwen2ConversionError::new("qwen2-directory-flush-failed"))?;

    let receipt = ConversionReceipt {
        schema: CONVERSION_RECEIPT_SCHEMA,
        status: "pass",
        converter_profile_id: QWEN2_CONVERSION_PROFILE_ID,
        converter_profile_sha256: QWEN2_CONVERSION_PROFILE_SHA256,
        converter: ConverterReceipt {
            implementation_version: execution.implementation_version(),
            executable_sha256: execution.executable_sha256(),
        },
        source: SourceReceipt {
            lock_sha256: sha256_bytes(&lock_bytes),
            model_id: &lock.model_id,
            revision: &lock.revision,
            source_kind: &lock.source_kind,
            artifact_class: &lock.artifact_class,
            architecture_profile_id: &lock.architecture_profile_id,
            license_spdx: &lock.license_spdx,
            license_disposition: &lock.license_disposition,
            source_model_sha256: &lock.files.model.sha256,
            source_model_bytes: lock.files.model.byte_length,
            source_dtype: source.dtype.label(),
            tensor_count: source.tensors.len(),
            parameter_count: source.parameter_count,
        },
        model: ModelReceipt {
            path: outputs.model_name.clone(),
            format_profile_id: SLM2_FORMAT_PROFILE_ID,
            format_profile_sha256: SLM2_FORMAT_PROFILE_SHA256,
            byte_length: written_identity.byte_length(),
            artifact_sha256: written_identity.artifact_sha256_hex(),
            manifest_sha256: written_identity.manifest_sha256_hex(),
            tensor_layout_sha256: hex_lower(validated.tensor_layout_sha256()),
            tensor_count: validated.tensors().len(),
            specification: model_spec_receipt(&source.spec),
        },
        tokenizer: TokenizerReceipt {
            path: outputs.tokenizer_name.clone(),
            byte_length: written_tokenizer_identity.byte_length,
            sha256: hex_lower(&written_tokenizer_identity.sha256),
            format_profile_id: TOKENIZER2_FORMAT_PROFILE_ID,
            format_profile_sha256: TOKENIZER2_FORMAT_PROFILE_SHA256,
            token_count: source.tokenizer.token_count(),
            base_token_count: source.tokenizer.base_token_count(),
            merge_count: source.tokenizer.merge_count(),
            added_token_count: source.tokenizer.added_token_count(),
            special_token_count: source.tokenizer.special_token_count(),
            bos_token_id: source.tokenizer.bos_token_id(),
            eos_token_id: source.tokenizer.eos_token_id(),
            pad_token_id: source.tokenizer.pad_token_id(),
        },
        chat_template: SourceTemplateReceipt {
            path: outputs.template_name.clone(),
            byte_length: source.tokenizer.chat_template_bytes().len() as u64,
            sha256: sha256_bytes(source.tokenizer.chat_template_bytes()),
            source_format: "publisher-jinja-text",
            promotion_status: "unpromoted-source-evidence-only",
            required_next_gate: "template2-exact-declarative-conversion-and-parity",
        },
        durability: DurabilityReceipt {
            operation_id: durability.operation_id().to_owned(),
            directory_identity_sha256: durability.directory_identity_sha256().to_owned(),
            method: durability.method().to_owned(),
            operating_system: durability.operating_system().to_owned(),
            architecture: durability.architecture().to_owned(),
            status: durability.status().to_owned(),
        },
        conversion_claim: "structural-and-byte-conversion-only",
        quality_status: "not-assessed-by-converter",
        runtime_status: "not-assessed-by-converter",
        required_next_gate:
            "untouched-source-slm2-native-slm2-wasm-quality-and-runtime-conformance",
    };
    let mut receipt_bytes = serde_json::to_vec_pretty(&receipt)
        .map_err(|_| Qwen2ConversionError::new("qwen2-receipt-serialization-failed"))?;
    receipt_bytes.push(b'\n');
    write_create_only_synced(&outputs.receipt_stage, &receipt_bytes)?;
    promote_create_only(&outputs.receipt_stage, &outputs.receipt)?;
    flush_owned_directory(
        &outputs.parent,
        Path::new("."),
        &format!("{operation_id}-receipt"),
    )
    .map_err(|_| Qwen2ConversionError::new("qwen2-directory-flush-failed"))?;

    Ok(Qwen2ConversionResult {
        model_path: outputs.model,
        tokenizer_path: outputs.tokenizer,
        template_path: outputs.template,
        receipt_path: outputs.receipt,
        model_identity: written_identity,
    })
}

fn validate_profile() -> Result<(), Qwen2ConversionError> {
    if sha256_bytes(PROFILE_BYTES) != QWEN2_CONVERSION_PROFILE_SHA256 {
        return Err(Qwen2ConversionError::new("qwen2-conversion-profile-drift"));
    }
    let profile: UniqueObject = serde_json::from_slice(PROFILE_BYTES)
        .map_err(|_| Qwen2ConversionError::new("qwen2-conversion-profile-invalid"))?;
    if profile.0.get("profileId").and_then(Value::as_str) != Some(QWEN2_CONVERSION_PROFILE_ID) {
        return Err(Qwen2ConversionError::new(
            "qwen2-conversion-profile-invalid",
        ));
    }
    Ok(())
}

fn validate_source_lock(lock: &Qwen2SourceLock) -> Result<(), Qwen2ConversionError> {
    if lock.schema != QWEN2_SOURCE_LOCK_SCHEMA
        || !valid_model_id(&lock.model_id)
        || !valid_revision(&lock.revision)
        || !matches!(
            lock.source_kind.as_str(),
            "upstream-checkpoint" | "merged-trained-checkpoint"
        )
        || !matches!(
            lock.artifact_class.as_str(),
            "base-model" | "specialist-model"
        )
        || lock.architecture_profile_id != QWEN2_ARCHITECTURE_PROFILE_ID
        || lock.license_spdx != "Apache-2.0"
        || lock.license_disposition != "redistribution-and-conversion-approved"
    {
        return Err(Qwen2ConversionError::new("qwen2-source-lock-invalid"));
    }
    for (expected, locked) in lock.files.entries() {
        if locked.path != expected || locked.byte_length == 0 || !valid_sha256(&locked.sha256) {
            return Err(Qwen2ConversionError::new("qwen2-source-lock-invalid"));
        }
    }
    Ok(())
}

fn validate_source_inventory(source: &Path) -> Result<(), Qwen2ConversionError> {
    let mut actual = BTreeSet::new();
    let entries = fs::read_dir(source)
        .map_err(|_| Qwen2ConversionError::new("qwen2-source-inventory-invalid"))?;
    for entry in entries {
        let entry =
            entry.map_err(|_| Qwen2ConversionError::new("qwen2-source-inventory-invalid"))?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| Qwen2ConversionError::new("qwen2-source-inventory-invalid"))?;
        let metadata = fs::symlink_metadata(entry.path())
            .map_err(|_| Qwen2ConversionError::new("qwen2-source-inventory-invalid"))?;
        if metadata_is_link(&metadata) || !metadata.is_file() || !actual.insert(name) {
            return Err(Qwen2ConversionError::new("qwen2-source-inventory-invalid"));
        }
    }
    let expected = REQUIRED_SOURCE_FILES
        .iter()
        .map(|name| (*name).to_owned())
        .collect::<BTreeSet<_>>();
    if actual != expected {
        return Err(Qwen2ConversionError::new("qwen2-source-inventory-invalid"));
    }
    Ok(())
}

fn verify_locked_files(
    source: &Path,
    files: &LockedFiles,
) -> Result<Vec<(String, u64, String)>, Qwen2ConversionError> {
    let mut identities = Vec::with_capacity(9);
    for (expected, locked) in files.entries() {
        let path = source.join(expected);
        let metadata = fs::symlink_metadata(&path)
            .map_err(|_| Qwen2ConversionError::new("qwen2-source-file-invalid"))?;
        if metadata_is_link(&metadata)
            || !metadata.is_file()
            || metadata.len() != locked.byte_length
        {
            return Err(Qwen2ConversionError::new("qwen2-source-file-invalid"));
        }
        let digest = sha256_file(&path)?;
        if digest != locked.sha256 {
            return Err(Qwen2ConversionError::new("qwen2-source-hash-mismatch"));
        }
        identities.push((expected.to_owned(), metadata.len(), digest));
    }
    Ok(identities)
}

fn inspect_source(
    source: &Path,
    lock: &Qwen2SourceLock,
) -> Result<InspectedSource, Qwen2ConversionError> {
    let config_bytes = read_bounded_regular_file(
        &source.join("config.json"),
        CONFIG_MAXIMUM_BYTES,
        "qwen2-config-invalid",
    )?;
    let config: Qwen2Config = serde_json::from_slice(&config_bytes)
        .map_err(|_| Qwen2ConversionError::new("qwen2-config-invalid"))?;
    let spec = model_spec_from_config(&config, &lock.artifact_class)?;
    let model_path = source.join("model.safetensors");
    let (data_offset, tensors, dtype, parameter_count) =
        inspect_safetensors(&model_path, &config, &spec)?;

    let tokenizer_bytes = read_bounded_regular_file(
        &source.join("tokenizer.json"),
        TOKENIZER_MAXIMUM_BYTES,
        "qwen2-tokenizer-invalid",
    )?;
    let tokenizer_config_bytes = read_bounded_regular_file(
        &source.join("tokenizer_config.json"),
        TOKENIZER_CONFIG_MAXIMUM_BYTES,
        "qwen2-tokenizer-config-invalid",
    )?;
    let vocab_bytes = read_bounded_regular_file(
        &source.join("vocab.json"),
        TOKENIZER_MAXIMUM_BYTES,
        "qwen2-tokenizer-vocab-invalid",
    )?;
    let merges_bytes = read_bounded_regular_file(
        &source.join("merges.txt"),
        TOKENIZER_MAXIMUM_BYTES,
        "qwen2-tokenizer-merges-invalid",
    )?;
    let tokenizer = parse_qwen_tokenizer(
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
    .map_err(|error| Qwen2ConversionError::new(error.code()))?;
    Ok(InspectedSource {
        spec,
        dtype,
        data_offset,
        tensors,
        parameter_count,
        tokenizer,
    })
}

fn model_spec_from_config(
    config: &Qwen2Config,
    artifact_class: &str,
) -> Result<ModelSpec, Qwen2ConversionError> {
    if config.architectures != ["Qwen2ForCausalLM"]
        || config.model_type != "qwen2"
        || config.hidden_act != "silu"
        || config.attention_dropout != 0.0
        || !config.initializer_range.is_finite()
        || config.initializer_range <= 0.0
        || !config.rms_norm_eps.is_finite()
        || config.rms_norm_eps <= 0.0
        || !config.rope_theta.is_finite()
        || config.rope_theta <= 0.0
        || !config.tie_word_embeddings
        || !config.use_cache
        || config.use_sliding_window
        || config.max_window_layers == 0
        || config.max_window_layers > config.num_hidden_layers
        || config.sliding_window != config.max_position_embeddings
        || config.transformers_version.is_empty()
        || config.bos_token_id >= config.vocab_size
        || config.eos_token_id >= config.vocab_size
        || !matches!(config.torch_dtype.as_str(), "bfloat16" | "float32")
        || config.num_attention_heads == 0
        || !config
            .hidden_size
            .is_multiple_of(config.num_attention_heads)
    {
        return Err(Qwen2ConversionError::new(
            "qwen2-config-semantics-unsupported",
        ));
    }
    let spec = ModelSpec {
        artifact_class: match artifact_class {
            "base-model" => ArtifactClass::BaseModel,
            "specialist-model" => ArtifactClass::SpecialistModel,
            _ => return Err(Qwen2ConversionError::new("qwen2-source-lock-invalid")),
        },
        vocabulary_size: config.vocab_size,
        context_length: config.max_position_embeddings,
        embedding_size: config.hidden_size,
        feed_forward_size: config.intermediate_size,
        layer_count: config.num_hidden_layers,
        head_count: config.num_attention_heads,
        kv_head_count: config.num_key_value_heads,
        head_dimension: config.hidden_size / config.num_attention_heads,
        rope_theta: config.rope_theta as f32,
        normalization_epsilon: config.rms_norm_eps as f32,
        tied_embeddings: true,
        qkv_bias: true,
        qk_normalization: false,
    };
    required_model_tensors(&spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen2ConversionError::new("qwen2-config-semantics-unsupported"))?;
    Ok(spec)
}

fn inspect_safetensors(
    path: &Path,
    config: &Qwen2Config,
    spec: &ModelSpec,
) -> Result<(u64, BTreeMap<String, SourceTensor>, SourceDtype, u64), Qwen2ConversionError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    if metadata_is_link(&metadata) || !metadata.is_file() || metadata.len() < 9 {
        return Err(Qwen2ConversionError::new("qwen2-safetensors-invalid"));
    }
    let mut file =
        File::open(path).map_err(|_| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    let mut length_bytes = [0_u8; 8];
    file.read_exact(&mut length_bytes)
        .map_err(|_| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    let header_length = u64::from_le_bytes(length_bytes);
    if header_length == 0 || header_length > SAFETENSORS_HEADER_MAXIMUM_BYTES {
        return Err(Qwen2ConversionError::new("qwen2-safetensors-invalid"));
    }
    let data_offset = 8_u64
        .checked_add(header_length)
        .ok_or_else(|| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    if data_offset > metadata.len() {
        return Err(Qwen2ConversionError::new("qwen2-safetensors-invalid"));
    }
    let mut header_bytes = vec![
        0_u8;
        usize::try_from(header_length).map_err(|_| {
            Qwen2ConversionError::new("qwen2-safetensors-invalid")
        })?
    ];
    file.read_exact(&mut header_bytes)
        .map_err(|_| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    let mut deserializer = serde_json::Deserializer::from_slice(&header_bytes);
    let header = SafetensorsHeader::deserialize(&mut deserializer)
        .map_err(|_| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    deserializer
        .end()
        .map_err(|_| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
    if header.tensors.is_empty() {
        return Err(Qwen2ConversionError::new("qwen2-safetensors-invalid"));
    }

    let expected_dtype = match config.torch_dtype.as_str() {
        "bfloat16" => SourceDtype::Bf16,
        "float32" => SourceDtype::F32,
        _ => return Err(Qwen2ConversionError::new("qwen2-source-dtype-unsupported")),
    };
    let mut tensors = BTreeMap::new();
    let mut ranges = Vec::new();
    let mut parameter_count = 0_u64;
    for (name, raw) in header.tensors {
        let dtype = match raw.dtype.as_str() {
            "BF16" => SourceDtype::Bf16,
            "F32" => SourceDtype::F32,
            _ => return Err(Qwen2ConversionError::new("qwen2-source-dtype-unsupported")),
        };
        if dtype != expected_dtype || raw.shape.is_empty() || raw.shape.len() > 8 {
            return Err(Qwen2ConversionError::new("qwen2-safetensors-invalid"));
        }
        let elements = raw
            .shape
            .iter()
            .try_fold(1_u64, |product, dimension| {
                if *dimension == 0 || *dimension > u64::from(u32::MAX) {
                    return None;
                }
                product.checked_mul(*dimension)
            })
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
        let expected_bytes = elements
            .checked_mul(dtype.source_bytes())
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
        let [start, end] = raw.data_offsets;
        if start > end || end - start != expected_bytes {
            return Err(Qwen2ConversionError::new("qwen2-safetensors-invalid"));
        }
        parameter_count = parameter_count
            .checked_add(elements)
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-safetensors-invalid"))?;
        ranges.push((start, end, name.clone()));
        tensors.insert(
            name,
            SourceTensor {
                dtype,
                shape: raw.shape,
                start,
                end,
            },
        );
    }
    ranges.sort();
    let mut cursor = 0_u64;
    for (start, end, _) in &ranges {
        if *start != cursor {
            return Err(Qwen2ConversionError::new("qwen2-safetensors-range-invalid"));
        }
        cursor = *end;
    }
    if cursor != metadata.len() - data_offset {
        return Err(Qwen2ConversionError::new("qwen2-safetensors-range-invalid"));
    }
    validate_tensor_inventory(spec, &tensors)?;
    Ok((data_offset, tensors, expected_dtype, parameter_count))
}

fn validate_tensor_inventory(
    spec: &ModelSpec,
    source: &BTreeMap<String, SourceTensor>,
) -> Result<(), Qwen2ConversionError> {
    let required = required_model_tensors(spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen2ConversionError::new("qwen2-tensor-registry-invalid"))?;
    if required.len() != source.len() {
        return Err(Qwen2ConversionError::new("qwen2-tensor-inventory-mismatch"));
    }
    let mut expected_names = BTreeSet::new();
    for target in &required {
        let source_name = source_name_for_target(target)?;
        if !expected_names.insert(source_name.clone()) {
            return Err(Qwen2ConversionError::new("qwen2-tensor-registry-invalid"));
        }
        let tensor = source
            .get(&source_name)
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-tensor-inventory-mismatch"))?;
        if tensor.shape != target.shape() {
            return Err(Qwen2ConversionError::new("qwen2-tensor-shape-mismatch"));
        }
    }
    if expected_names != source.keys().cloned().collect() {
        return Err(Qwen2ConversionError::new("qwen2-tensor-inventory-mismatch"));
    }
    Ok(())
}

fn build_tensor_inputs(
    source: &InspectedSource,
    model_path: &Path,
) -> Result<Vec<TensorInput<TensorReader>>, Qwen2ConversionError> {
    required_model_tensors(&source.spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen2ConversionError::new("qwen2-tensor-registry-invalid"))?
        .into_iter()
        .map(|target| {
            let source_name = source_name_for_target(&target)?;
            let tensor = source
                .tensors
                .get(&source_name)
                .ok_or_else(|| Qwen2ConversionError::new("qwen2-tensor-inventory-mismatch"))?;
            Ok(TensorInput::new(
                target,
                TensorReader::new(model_path.to_path_buf(), source.data_offset, tensor)?,
            ))
        })
        .collect()
}

fn source_name_for_target(target: &TensorSpec) -> Result<String, Qwen2ConversionError> {
    let layer = target.layer();
    let result = match target.semantic_role() {
        "model.token-embedding.weight" if layer == -1 => "model.embed_tokens.weight".to_owned(),
        "model.final-normalization.weight" if layer == -1 => "model.norm.weight".to_owned(),
        "layer.attention-normalization.weight" if layer >= 0 => {
            format!("model.layers.{layer}.input_layernorm.weight")
        }
        "layer.feed-forward-normalization.weight" if layer >= 0 => {
            format!("model.layers.{layer}.post_attention_layernorm.weight")
        }
        "layer.attention.query-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.q_proj.weight")
        }
        "layer.attention.key-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.k_proj.weight")
        }
        "layer.attention.value-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.v_proj.weight")
        }
        "layer.attention.output-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.o_proj.weight")
        }
        "layer.attention.query-projection.bias" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.q_proj.bias")
        }
        "layer.attention.key-projection.bias" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.k_proj.bias")
        }
        "layer.attention.value-projection.bias" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.v_proj.bias")
        }
        "layer.feed-forward.gate-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.mlp.gate_proj.weight")
        }
        "layer.feed-forward.down-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.mlp.down_proj.weight")
        }
        "layer.feed-forward.up-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.mlp.up_proj.weight")
        }
        _ => return Err(Qwen2ConversionError::new("qwen2-tensor-registry-invalid")),
    };
    Ok(result)
}

struct OutputPaths {
    parent: PathBuf,
    model: PathBuf,
    tokenizer: PathBuf,
    template: PathBuf,
    receipt: PathBuf,
    model_stage: PathBuf,
    tokenizer_stage: PathBuf,
    template_stage: PathBuf,
    receipt_stage: PathBuf,
    model_name: String,
    tokenizer_name: String,
    template_name: String,
}

impl OutputPaths {
    fn new(model: &Path) -> Result<Self, Qwen2ConversionError> {
        if !model.is_absolute()
            || model.extension().and_then(|value| value.to_str()) != Some("slm2")
        {
            return Err(Qwen2ConversionError::new("qwen2-output-path-invalid"));
        }
        let parent = model
            .parent()
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-output-path-invalid"))?;
        let parent = validate_directory(parent, "qwen2-output-directory-invalid")?;
        let model_name = model
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| valid_file_name(value))
            .ok_or_else(|| Qwen2ConversionError::new("qwen2-output-path-invalid"))?
            .to_owned();
        let model = parent.join(&model_name);
        let tokenizer_name = format!("{model_name}.tokenizer.tok2");
        let template_name = format!("{model_name}.chat-template.txt");
        let receipt_name = format!("{model_name}.conversion-receipt.json");
        let tokenizer = parent.join(&tokenizer_name);
        let template = parent.join(&template_name);
        let receipt = parent.join(&receipt_name);
        Ok(Self {
            parent: parent.clone(),
            model: model.clone(),
            tokenizer: tokenizer.clone(),
            template: template.clone(),
            receipt: receipt.clone(),
            model_stage: parent.join(format!(".{model_name}.staging")),
            tokenizer_stage: parent.join(format!(".{tokenizer_name}.staging")),
            template_stage: parent.join(format!(".{template_name}.staging")),
            receipt_stage: parent.join(format!(".{receipt_name}.staging")),
            model_name,
            tokenizer_name,
            template_name,
        })
    }

    fn validate_absent(&self) -> Result<(), Qwen2ConversionError> {
        for path in [
            &self.model,
            &self.tokenizer,
            &self.template,
            &self.receipt,
            &self.model_stage,
            &self.tokenizer_stage,
            &self.template_stage,
            &self.receipt_stage,
        ] {
            if fs::symlink_metadata(path).is_ok() {
                return Err(Qwen2ConversionError::new("qwen2-output-already-exists"));
            }
        }
        Ok(())
    }
}

fn model_spec_receipt(spec: &ModelSpec) -> ModelSpecReceipt {
    ModelSpecReceipt {
        artifact_class: spec.artifact_class.label(),
        vocabulary_size: spec.vocabulary_size,
        context_length: spec.context_length,
        embedding_size: spec.embedding_size,
        feed_forward_size: spec.feed_forward_size,
        layer_count: spec.layer_count,
        head_count: spec.head_count,
        kv_head_count: spec.kv_head_count,
        head_dimension: spec.head_dimension,
        rope_theta: spec.rope_theta,
        normalization_epsilon: spec.normalization_epsilon,
        tied_embeddings: spec.tied_embeddings,
        qkv_bias: spec.qkv_bias,
        qk_normalization: spec.qk_normalization,
    }
}

fn create_new_file(path: &Path) -> Result<File, Qwen2ConversionError> {
    OpenOptions::new()
        .write(true)
        .read(true)
        .create_new(true)
        .open(path)
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-create-failed"))
}

fn write_create_only_synced(path: &Path, bytes: &[u8]) -> Result<(), Qwen2ConversionError> {
    let mut file = create_new_file(path)?;
    file.write_all(bytes)
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-write-failed"))?;
    file.sync_all()
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-flush-failed"))
}

fn promote_create_only(source: &Path, destination: &Path) -> Result<(), Qwen2ConversionError> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|_| Qwen2ConversionError::new("qwen2-output-promotion-failed"))?;
    if metadata_is_link(&metadata) || !metadata.is_file() {
        return Err(Qwen2ConversionError::new("qwen2-output-promotion-failed"));
    }
    match fs::hard_link(source, destination) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            return Err(Qwen2ConversionError::new("qwen2-output-already-exists"));
        }
        Err(_) => return Err(Qwen2ConversionError::new("qwen2-output-promotion-failed")),
    }
    fs::remove_file(source).map_err(|_| Qwen2ConversionError::new("qwen2-output-promotion-failed"))
}

fn read_bounded_regular_file(
    path: &Path,
    maximum_bytes: u64,
    code: &'static str,
) -> Result<Vec<u8>, Qwen2ConversionError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| Qwen2ConversionError::new(code))?;
    if metadata_is_link(&metadata)
        || !metadata.is_file()
        || metadata.len() == 0
        || metadata.len() > maximum_bytes
    {
        return Err(Qwen2ConversionError::new(code));
    }
    fs::read(path).map_err(|_| Qwen2ConversionError::new(code))
}

fn validate_directory(path: &Path, code: &'static str) -> Result<PathBuf, Qwen2ConversionError> {
    if !path.is_absolute() {
        return Err(Qwen2ConversionError::new(code));
    }
    let metadata = fs::symlink_metadata(path).map_err(|_| Qwen2ConversionError::new(code))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err(Qwen2ConversionError::new(code));
    }
    fs::canonicalize(path).map_err(|_| Qwen2ConversionError::new(code))
}

#[cfg(windows)]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn metadata_is_link(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn sha256_file(path: &Path) -> Result<String, Qwen2ConversionError> {
    let mut file =
        File::open(path).map_err(|_| Qwen2ConversionError::new("qwen2-source-hash-failed"))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| Qwen2ConversionError::new("qwen2-source-hash-failed"))?;
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
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn valid_safe_identifier(value: &str, maximum: usize) -> bool {
    !value.is_empty()
        && value.len() <= maximum
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b'/' | b':')
        })
}

fn valid_model_id(value: &str) -> bool {
    valid_safe_identifier(value, 200) && value.contains('/')
}

fn valid_revision(value: &str) -> bool {
    matches!(value.len(), 40 | 64)
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn valid_file_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 200
        && value != "."
        && value != ".."
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn map_slm2_error(error: tinyrustlm_slm2::Slm2Error) -> Qwen2ConversionError {
    match error.code() {
        "slm2-nonfinite-f32" => Qwen2ConversionError::new("qwen2-source-nonfinite"),
        "slm2-source-drift" => Qwen2ConversionError::new("qwen2-source-drift"),
        _ => Qwen2ConversionError::new("qwen2-slm2-write-failed"),
    }
}
