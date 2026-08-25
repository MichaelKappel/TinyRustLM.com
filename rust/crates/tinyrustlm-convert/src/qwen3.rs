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
    SLM2_Q8_WEIGHT_PROFILE_ID, SLM2_Q8_WEIGHT_PROFILE_SHA256,
};

use crate::execution::ConverterExecutionIdentity;
use crate::receipt::ReceiptIdentity;

/// The sole current Qwen3 Safetensors to SLM2 conversion profile.
pub const QWEN3_CONVERSION_PROFILE_ID: &str = "tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/2";
/// The SHA-256 of the exact checked-in Qwen3 conversion profile bytes.
pub const QWEN3_CONVERSION_PROFILE_SHA256: &str =
    "fa2ce18f38129a6b106000d7802d1ea3995921e2b945ae5e52457908f548e7cf";
/// The exact source-lock schema consumed by this converter.
pub const QWEN3_SOURCE_LOCK_SCHEMA: &str = "tinyrustlm.qwen3_source_lock.v1";

pub(crate) const QWEN3_ARCHITECTURE_PROFILE_ID: &str = "tinyrustlm.qwen3-dense-gqa-qk-norm/1";
const CONVERSION_RECEIPT_SCHEMA: &str = "tinyrustlm.qwen3_conversion_receipt.v2";
const TENSOR_PROFILE_ID: &str = "tinyrustlm.tensor-mixed-q8-row-f32/1";
const PHYSICAL_TENSOR_INVENTORY_HASH_DOMAIN: &[u8] =
    b"tinyrustlm.qwen3.physical-source-tensor-inventory.v2\0";
const LOGICAL_TENSOR_INVENTORY_HASH_DOMAIN: &[u8] =
    b"tinyrustlm.qwen3.logical-output-tensor-inventory.v2\0";
const CANONICAL_EMBEDDING_SOURCE_TENSOR: &str = "model.embed_tokens.weight";
const REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR: &str = "lm_head.weight";
const SOURCE_LOCK_MAXIMUM_BYTES: u64 = 1_048_576;
const CONFIG_MAXIMUM_BYTES: u64 = 1_048_576;
const RECEIPT_MAXIMUM_BYTES: u64 = 1_048_576;
const SAFETENSORS_HEADER_MAXIMUM_BYTES: u64 = 16 * 1_048_576;
const HASH_BUFFER_BYTES: usize = 1_048_576;
const TENSOR_PAYLOAD_ALIGNMENT: u32 = 64;
const OUTPUT_MAXIMUM_BYTES: u64 = 68_719_476_736;
const OUTPUT_MAXIMUM_TENSORS: u32 = 262_144;
const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/qwen3-safetensors-conversion-profile.v2.json");
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
pub struct Qwen3ConversionError {
    code: &'static str,
}

impl Qwen3ConversionError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for Qwen3ConversionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Qwen3ConversionError {}

/// Successful output identities from one complete conversion transaction.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Qwen3ConversionResult {
    model_path: PathBuf,
    receipt_path: PathBuf,
    model_identity: ModelIdentity,
    receipt_identity: ReceiptIdentity,
}

impl Qwen3ConversionResult {
    /// Returns the promoted SLM2 model path.
    pub fn model_path(&self) -> &Path {
        &self.model_path
    }

    /// Returns the promoted conversion receipt path.
    pub fn receipt_path(&self) -> &Path {
        &self.receipt_path
    }

    /// Returns the independently validated SLM2 identity.
    pub const fn model_identity(&self) -> &ModelIdentity {
        &self.model_identity
    }

    /// Returns the exact identity of the promoted conversion receipt.
    pub const fn receipt_identity(&self) -> ReceiptIdentity {
        self.receipt_identity
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Qwen3SourceLock {
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
    physical_parameter_count: u64,
    logical_parameter_count: u64,
    physical_tensor_inventory_sha256: String,
    logical_tensor_inventory_sha256: String,
    tied_output: TiedOutputProof,
}

struct TiedOutputProof {
    dtype: SourceDtype,
    shape: Vec<u64>,
    element_count: u64,
    byte_length: u64,
    canonical_embedding_sha256: String,
    redundant_output_sha256: String,
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
    ) -> Result<Self, Qwen3ConversionError> {
        let source_elements = tensor
            .end
            .checked_sub(tensor.start)
            .and_then(|length| length.checked_div(tensor.dtype.source_bytes()))
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
        let output_length = source_elements
            .checked_mul(4)
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
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
                .ok_or_else(|| io::Error::other("qwen3 source offset overflow"))?;
            file.seek(SeekFrom::Start(source_position))?;
            self.file = Some(file);
        }
        self.file
            .as_mut()
            .ok_or_else(|| io::Error::other("qwen3 source file unavailable"))
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
                "qwen3 tensor reads must be aligned f32 words",
            ));
        }
        let remaining = self.output_length - self.position;
        let requested = usize::try_from(remaining.min(output.len() as u64))
            .map_err(|_| io::Error::other("qwen3 tensor read overflow"))?;
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
                "qwen3 tensor seek is outside an aligned payload",
            ));
        }
        self.position =
            u64::try_from(next).map_err(|_| io::Error::other("qwen3 tensor seek overflow"))?;
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
    durability: DurabilityReceipt,
    conversion_claim: &'static str,
    model_quality_status: &'static str,
    source_framework_parity_status: &'static str,
    native_runtime_status: &'static str,
    browser_wasm_status: &'static str,
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
    files: &'a LockedFiles,
    source_model_sha256: &'a str,
    source_model_bytes: u64,
    source_dtype: &'static str,
    physical_tensor_count: usize,
    physical_parameter_count: u64,
    physical_tensor_inventory_sha256: &'a str,
    logical_tensor_count: usize,
    logical_parameter_count: u64,
    logical_tensor_inventory_sha256: &'a str,
    tied_output: TiedOutputReceipt<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TiedOutputReceipt<'a> {
    canonical_embedding_source_tensor: &'static str,
    redundant_output_source_tensor: &'static str,
    source_dtype: &'static str,
    shape: &'a [u64],
    element_count_each: u64,
    byte_length_each: u64,
    canonical_embedding_sha256: &'a str,
    redundant_output_sha256: &'a str,
    payloads_byte_identical: bool,
    comparison_method: &'static str,
    comparison_buffer_bytes: usize,
    logical_emission_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelReceipt {
    path: String,
    format_profile_id: &'static str,
    format_profile_sha256: &'static str,
    weight_profile_id: &'static str,
    weight_profile_sha256: &'static str,
    tensor_profile_id: &'static str,
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
struct DurabilityReceipt {
    operation_id: String,
    directory_identity_sha256: String,
    method: String,
    operating_system: String,
    architecture: String,
    status: String,
}

/// Converts one exact locked Qwen3 checkpoint into deterministic mixed-Q8 SLM2 bytes.
///
/// The source lock and source directory remain read-only. The model and
/// conversion receipt are create-only siblings. Tokenizer2 and Template2 have
/// separate accepted owners and are deliberately not emitted here. Interrupted
/// staging files are preserved and never accepted as complete output.
pub fn convert_locked_qwen3_source(
    source_lock_path: &Path,
    source_directory: &Path,
    output_model_path: &Path,
    execution: &ConverterExecutionIdentity,
) -> Result<Qwen3ConversionResult, Qwen3ConversionError> {
    validate_profile()?;
    let lock_bytes = read_bounded_regular_file(
        source_lock_path,
        SOURCE_LOCK_MAXIMUM_BYTES,
        "qwen3-source-lock-invalid",
    )?;
    let lock: Qwen3SourceLock = serde_json::from_slice(&lock_bytes)
        .map_err(|_| Qwen3ConversionError::new("qwen3-source-lock-invalid"))?;
    validate_source_lock(&lock)?;
    let source_directory = validate_directory(source_directory, "qwen3-source-directory-invalid")?;
    validate_source_inventory(&source_directory)?;
    let initial_identities = verify_locked_files(&source_directory, &lock.files)?;
    let source = inspect_source(&source_directory, &lock)?;

    let outputs = OutputPaths::new(output_model_path)?;
    outputs.validate_absent()?;
    if source_directory == outputs.parent {
        return Err(Qwen3ConversionError::new("qwen3-output-overlaps-source"));
    }

    let model_source = source_directory.join("model.safetensors");
    let mut inputs = build_tensor_inputs(&source, &model_source)?;
    let mut model_stage = create_new_file(&outputs.model_stage)?;
    let written_identity =
        write_model(&mut model_stage, &source.spec, &mut inputs).map_err(map_slm2_error)?;
    model_stage
        .sync_all()
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-flush-failed"))?;
    drop(model_stage);

    let mut staged_model = File::open(&outputs.model_stage)
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-validation-failed"))?;
    let validation_policy = ValidationPolicy::new(OUTPUT_MAXIMUM_BYTES, OUTPUT_MAXIMUM_TENSORS)
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-validation-failed"))?;
    let validated = validate_model(&mut staged_model, validation_policy)
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-validation-failed"))?;
    if validated.identity() != &written_identity || validated.spec() != &source.spec {
        return Err(Qwen3ConversionError::new("qwen3-output-validation-failed"));
    }
    let tensor_layout_sha256 = hex_lower(validated.tensor_layout_sha256());
    let tensor_count = validated.tensors().len();
    drop(staged_model);

    let final_identities = verify_locked_files(&source_directory, &lock.files)?;
    if initial_identities != final_identities {
        return Err(Qwen3ConversionError::new("qwen3-source-drift"));
    }

    promote_create_only(&outputs.model_stage, &outputs.model)?;
    let operation_id = format!(
        "qwen3-convert-{}",
        &written_identity.artifact_sha256_hex()[..20]
    );
    let durability = flush_owned_directory(&outputs.parent, Path::new("."), &operation_id)
        .map_err(|_| Qwen3ConversionError::new("qwen3-directory-flush-failed"))?;

    let receipt = ConversionReceipt {
        schema: CONVERSION_RECEIPT_SCHEMA,
        status: "pass",
        converter_profile_id: QWEN3_CONVERSION_PROFILE_ID,
        converter_profile_sha256: QWEN3_CONVERSION_PROFILE_SHA256,
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
            files: &lock.files,
            source_model_sha256: &lock.files.model.sha256,
            source_model_bytes: lock.files.model.byte_length,
            source_dtype: source.dtype.label(),
            physical_tensor_count: source.tensors.len(),
            physical_parameter_count: source.physical_parameter_count,
            physical_tensor_inventory_sha256: &source.physical_tensor_inventory_sha256,
            logical_tensor_count: tensor_count,
            logical_parameter_count: source.logical_parameter_count,
            logical_tensor_inventory_sha256: &source.logical_tensor_inventory_sha256,
            tied_output: TiedOutputReceipt {
                canonical_embedding_source_tensor: CANONICAL_EMBEDDING_SOURCE_TENSOR,
                redundant_output_source_tensor: REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR,
                source_dtype: source.tied_output.dtype.label(),
                shape: &source.tied_output.shape,
                element_count_each: source.tied_output.element_count,
                byte_length_each: source.tied_output.byte_length,
                canonical_embedding_sha256: &source.tied_output.canonical_embedding_sha256,
                redundant_output_sha256: &source.tied_output.redundant_output_sha256,
                payloads_byte_identical: true,
                comparison_method: "seekable-streamed-source-byte-comparison",
                comparison_buffer_bytes: HASH_BUFFER_BYTES,
                logical_emission_count: 1,
            },
        },
        model: ModelReceipt {
            path: outputs.model_name.clone(),
            format_profile_id: SLM2_FORMAT_PROFILE_ID,
            format_profile_sha256: SLM2_FORMAT_PROFILE_SHA256,
            weight_profile_id: SLM2_Q8_WEIGHT_PROFILE_ID,
            weight_profile_sha256: SLM2_Q8_WEIGHT_PROFILE_SHA256,
            tensor_profile_id: TENSOR_PROFILE_ID,
            byte_length: written_identity.byte_length(),
            artifact_sha256: written_identity.artifact_sha256_hex(),
            manifest_sha256: written_identity.manifest_sha256_hex(),
            tensor_layout_sha256,
            tensor_count,
            specification: model_spec_receipt(&source.spec),
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
        model_quality_status: "not-assessed-by-converter",
        source_framework_parity_status: "not-assessed-by-converter",
        native_runtime_status: "not-assessed-by-converter",
        browser_wasm_status: "not-assessed-by-converter",
        required_next_gate:
            "source-native-browser-numerical-parity-and-untouched-quality-qualification",
    };
    let mut receipt_bytes = serde_json::to_vec_pretty(&receipt)
        .map_err(|_| Qwen3ConversionError::new("qwen3-receipt-serialization-failed"))?;
    receipt_bytes.push(b'\n');
    let receipt_identity = ReceiptIdentity::from_bytes(&receipt_bytes);
    write_create_only_synced(&outputs.receipt_stage, &receipt_bytes)?;
    promote_create_only(&outputs.receipt_stage, &outputs.receipt)?;
    flush_owned_directory(
        &outputs.parent,
        Path::new("."),
        &format!("{operation_id}-receipt"),
    )
    .map_err(|_| Qwen3ConversionError::new("qwen3-directory-flush-failed"))?;
    let observed_receipt = read_bounded_regular_file(
        &outputs.receipt,
        RECEIPT_MAXIMUM_BYTES,
        "qwen3-output-validation-failed",
    )?;
    if observed_receipt != receipt_bytes {
        return Err(Qwen3ConversionError::new("qwen3-output-validation-failed"));
    }

    Ok(Qwen3ConversionResult {
        model_path: outputs.model,
        receipt_path: outputs.receipt,
        model_identity: written_identity,
        receipt_identity,
    })
}

fn validate_profile() -> Result<(), Qwen3ConversionError> {
    if sha256_bytes(PROFILE_BYTES) != QWEN3_CONVERSION_PROFILE_SHA256 {
        return Err(Qwen3ConversionError::new("qwen3-conversion-profile-drift"));
    }
    let profile: UniqueObject = serde_json::from_slice(PROFILE_BYTES)
        .map_err(|_| Qwen3ConversionError::new("qwen3-conversion-profile-invalid"))?;
    if profile.0.get("profileId").and_then(Value::as_str) != Some(QWEN3_CONVERSION_PROFILE_ID) {
        return Err(Qwen3ConversionError::new(
            "qwen3-conversion-profile-invalid",
        ));
    }
    Ok(())
}

fn validate_source_lock(lock: &Qwen3SourceLock) -> Result<(), Qwen3ConversionError> {
    if lock.schema != QWEN3_SOURCE_LOCK_SCHEMA
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
        || lock.architecture_profile_id != QWEN3_ARCHITECTURE_PROFILE_ID
        || lock.license_spdx != "Apache-2.0"
        || lock.license_disposition != "redistribution-and-conversion-approved"
    {
        return Err(Qwen3ConversionError::new("qwen3-source-lock-invalid"));
    }
    for (expected, locked) in lock.files.entries() {
        if locked.path != expected || locked.byte_length == 0 || !valid_sha256(&locked.sha256) {
            return Err(Qwen3ConversionError::new("qwen3-source-lock-invalid"));
        }
    }
    Ok(())
}

fn validate_source_inventory(source: &Path) -> Result<(), Qwen3ConversionError> {
    let mut actual = BTreeSet::new();
    let entries = fs::read_dir(source)
        .map_err(|_| Qwen3ConversionError::new("qwen3-source-inventory-invalid"))?;
    for entry in entries {
        let entry =
            entry.map_err(|_| Qwen3ConversionError::new("qwen3-source-inventory-invalid"))?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| Qwen3ConversionError::new("qwen3-source-inventory-invalid"))?;
        let metadata = fs::symlink_metadata(entry.path())
            .map_err(|_| Qwen3ConversionError::new("qwen3-source-inventory-invalid"))?;
        if metadata_is_link(&metadata) || !metadata.is_file() || !actual.insert(name) {
            return Err(Qwen3ConversionError::new("qwen3-source-inventory-invalid"));
        }
    }
    let expected = REQUIRED_SOURCE_FILES
        .iter()
        .map(|name| (*name).to_owned())
        .collect::<BTreeSet<_>>();
    if actual != expected {
        return Err(Qwen3ConversionError::new("qwen3-source-inventory-invalid"));
    }
    Ok(())
}

fn verify_locked_files(
    source: &Path,
    files: &LockedFiles,
) -> Result<Vec<(String, u64, String)>, Qwen3ConversionError> {
    let mut identities = Vec::with_capacity(9);
    for (expected, locked) in files.entries() {
        let path = source.join(expected);
        let metadata = fs::symlink_metadata(&path)
            .map_err(|_| Qwen3ConversionError::new("qwen3-source-file-invalid"))?;
        if metadata_is_link(&metadata)
            || !metadata.is_file()
            || metadata.len() != locked.byte_length
        {
            return Err(Qwen3ConversionError::new("qwen3-source-file-invalid"));
        }
        let digest = sha256_file(&path)?;
        if digest != locked.sha256 {
            return Err(Qwen3ConversionError::new("qwen3-source-hash-mismatch"));
        }
        identities.push((expected.to_owned(), metadata.len(), digest));
    }
    Ok(identities)
}

fn inspect_source(
    source: &Path,
    lock: &Qwen3SourceLock,
) -> Result<InspectedSource, Qwen3ConversionError> {
    let config_bytes = read_bounded_regular_file(
        &source.join("config.json"),
        CONFIG_MAXIMUM_BYTES,
        "qwen3-config-invalid",
    )?;
    let config: Qwen3Config = serde_json::from_slice(&config_bytes)
        .map_err(|_| Qwen3ConversionError::new("qwen3-config-invalid"))?;
    let spec = model_spec_from_config(&config, &lock.artifact_class)?;
    let model_path = source.join("model.safetensors");
    let (data_offset, tensors, dtype, physical_parameter_count) =
        inspect_safetensors(&model_path, &config, &spec)?;
    let physical_tensor_inventory_sha256 = physical_tensor_inventory_sha256(&tensors)?;
    let (logical_parameter_count, logical_tensor_inventory_sha256) =
        logical_tensor_evidence(&spec)?;
    let tied_output = verify_tied_output_payload(&model_path, data_offset, &tensors)?;
    Ok(InspectedSource {
        spec,
        dtype,
        data_offset,
        tensors,
        physical_parameter_count,
        logical_parameter_count,
        physical_tensor_inventory_sha256,
        logical_tensor_inventory_sha256,
        tied_output,
    })
}

fn model_spec_from_config(
    config: &Qwen3Config,
    artifact_class: &str,
) -> Result<ModelSpec, Qwen3ConversionError> {
    if config.architectures != ["Qwen3ForCausalLM"]
        || config.model_type != "qwen3"
        || config.hidden_act != "silu"
        || config.attention_bias
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
        || config.head_dim == 0
        || config.hidden_size == 0
        || config.intermediate_size == 0
        || config.max_position_embeddings == 0
        || config.max_window_layers == 0
        || config.max_window_layers > config.num_hidden_layers
        || config.transformers_version.is_empty()
        || config.bos_token_id >= config.vocab_size
        || config.eos_token_id >= config.vocab_size
        || !matches!(config.torch_dtype.as_str(), "bfloat16" | "float32")
        || config.num_attention_heads == 0
        || config.num_hidden_layers == 0
        || config.num_key_value_heads == 0
        || !config
            .num_attention_heads
            .is_multiple_of(config.num_key_value_heads)
        || config
            .head_dim
            .checked_mul(config.num_attention_heads)
            .is_none()
        || config
            .head_dim
            .checked_mul(config.num_key_value_heads)
            .is_none()
    {
        return Err(Qwen3ConversionError::new(
            "qwen3-config-semantics-unsupported",
        ));
    }
    let spec = ModelSpec {
        artifact_class: match artifact_class {
            "base-model" => ArtifactClass::BaseModel,
            "specialist-model" => ArtifactClass::SpecialistModel,
            _ => return Err(Qwen3ConversionError::new("qwen3-source-lock-invalid")),
        },
        vocabulary_size: config.vocab_size,
        context_length: config.max_position_embeddings,
        embedding_size: config.hidden_size,
        feed_forward_size: config.intermediate_size,
        layer_count: config.num_hidden_layers,
        head_count: config.num_attention_heads,
        kv_head_count: config.num_key_value_heads,
        head_dimension: config.head_dim,
        rope_theta: config.rope_theta as f32,
        normalization_epsilon: config.rms_norm_eps as f32,
        tied_embeddings: true,
        qkv_bias: false,
        qk_normalization: true,
    };
    required_model_tensors(&spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen3ConversionError::new("qwen3-config-semantics-unsupported"))?;
    Ok(spec)
}

fn inspect_safetensors(
    path: &Path,
    config: &Qwen3Config,
    spec: &ModelSpec,
) -> Result<(u64, BTreeMap<String, SourceTensor>, SourceDtype, u64), Qwen3ConversionError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    if metadata_is_link(&metadata) || !metadata.is_file() || metadata.len() < 9 {
        return Err(Qwen3ConversionError::new("qwen3-safetensors-invalid"));
    }
    let mut file =
        File::open(path).map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    let mut length_bytes = [0_u8; 8];
    file.read_exact(&mut length_bytes)
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    let header_length = u64::from_le_bytes(length_bytes);
    if header_length == 0 || header_length > SAFETENSORS_HEADER_MAXIMUM_BYTES {
        return Err(Qwen3ConversionError::new("qwen3-safetensors-invalid"));
    }
    let data_offset = 8_u64
        .checked_add(header_length)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    if data_offset > metadata.len() {
        return Err(Qwen3ConversionError::new("qwen3-safetensors-invalid"));
    }
    let mut header_bytes = vec![
        0_u8;
        usize::try_from(header_length).map_err(|_| {
            Qwen3ConversionError::new("qwen3-safetensors-invalid")
        })?
    ];
    file.read_exact(&mut header_bytes)
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    let mut deserializer = serde_json::Deserializer::from_slice(&header_bytes);
    let header = SafetensorsHeader::deserialize(&mut deserializer)
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    deserializer
        .end()
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    if header.tensors.is_empty() {
        return Err(Qwen3ConversionError::new("qwen3-safetensors-invalid"));
    }

    let expected_dtype = match config.torch_dtype.as_str() {
        "bfloat16" => SourceDtype::Bf16,
        "float32" => SourceDtype::F32,
        _ => return Err(Qwen3ConversionError::new("qwen3-source-dtype-unsupported")),
    };
    let mut tensors = BTreeMap::new();
    let mut ranges = Vec::new();
    let mut parameter_count = 0_u64;
    for (name, raw) in header.tensors {
        let dtype = match raw.dtype.as_str() {
            "BF16" => SourceDtype::Bf16,
            "F32" => SourceDtype::F32,
            _ => return Err(Qwen3ConversionError::new("qwen3-source-dtype-unsupported")),
        };
        if dtype != expected_dtype {
            let code = if name == REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR {
                "qwen3-tied-output-dtype-mismatch"
            } else {
                "qwen3-source-dtype-unsupported"
            };
            return Err(Qwen3ConversionError::new(code));
        }
        if raw.shape.is_empty() || raw.shape.len() > 8 {
            return Err(Qwen3ConversionError::new("qwen3-safetensors-invalid"));
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
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
        let expected_bytes = elements
            .checked_mul(dtype.source_bytes())
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
        let [start, end] = raw.data_offsets;
        if start > end {
            return Err(Qwen3ConversionError::new("qwen3-safetensors-invalid"));
        }
        if end - start != expected_bytes {
            let code = if name == REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR {
                "qwen3-tied-output-length-mismatch"
            } else {
                "qwen3-safetensors-invalid"
            };
            return Err(Qwen3ConversionError::new(code));
        }
        parameter_count = parameter_count
            .checked_add(elements)
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
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
            return Err(Qwen3ConversionError::new("qwen3-safetensors-range-invalid"));
        }
        cursor = *end;
    }
    if cursor != metadata.len() - data_offset {
        return Err(Qwen3ConversionError::new("qwen3-safetensors-range-invalid"));
    }
    validate_tensor_inventory(spec, &tensors)?;
    Ok((data_offset, tensors, expected_dtype, parameter_count))
}

fn validate_tensor_inventory(
    spec: &ModelSpec,
    source: &BTreeMap<String, SourceTensor>,
) -> Result<(), Qwen3ConversionError> {
    let required = required_model_tensors(spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen3ConversionError::new("qwen3-tensor-registry-invalid"))?;
    let mut expected_names = BTreeSet::new();
    for target in &required {
        let source_name = source_name_for_target(target)?;
        if !expected_names.insert(source_name.clone()) {
            return Err(Qwen3ConversionError::new("qwen3-tensor-registry-invalid"));
        }
        let tensor = source
            .get(&source_name)
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-tensor-inventory-mismatch"))?;
        if tensor.shape != target.shape() {
            return Err(Qwen3ConversionError::new("qwen3-tensor-shape-mismatch"));
        }
    }
    let source_names = source.keys().cloned().collect::<BTreeSet<_>>();
    if !source.contains_key(REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR) && source_names == expected_names {
        return Err(Qwen3ConversionError::new("qwen3-tied-output-required"));
    }
    let mut expected_physical_names = expected_names;
    if !expected_physical_names.insert(REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR.to_owned()) {
        return Err(Qwen3ConversionError::new("qwen3-tensor-registry-invalid"));
    }
    if expected_physical_names != source_names {
        return Err(Qwen3ConversionError::new("qwen3-tensor-inventory-mismatch"));
    }
    let embedding = source
        .get(CANONICAL_EMBEDDING_SOURCE_TENSOR)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-tensor-inventory-mismatch"))?;
    let tied_output = source
        .get(REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-tied-output-required"))?;
    if tied_output.dtype != embedding.dtype {
        return Err(Qwen3ConversionError::new(
            "qwen3-tied-output-dtype-mismatch",
        ));
    }
    if tied_output.shape != embedding.shape {
        return Err(Qwen3ConversionError::new(
            "qwen3-tied-output-shape-mismatch",
        ));
    }
    if tied_output.end - tied_output.start != embedding.end - embedding.start {
        return Err(Qwen3ConversionError::new(
            "qwen3-tied-output-length-mismatch",
        ));
    }
    Ok(())
}

fn physical_tensor_inventory_sha256(
    tensors: &BTreeMap<String, SourceTensor>,
) -> Result<String, Qwen3ConversionError> {
    let mut hasher = Sha256::new();
    hasher.update(PHYSICAL_TENSOR_INVENTORY_HASH_DOMAIN);
    let tensor_count = u32::try_from(tensors.len())
        .map_err(|_| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    hasher.update(tensor_count.to_le_bytes());
    for (name, tensor) in tensors {
        hash_bounded_bytes(&mut hasher, name.as_bytes())?;
        hash_bounded_bytes(&mut hasher, tensor.dtype.label().as_bytes())?;
        let rank = u32::try_from(tensor.shape.len())
            .map_err(|_| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
        hasher.update(rank.to_le_bytes());
        for dimension in &tensor.shape {
            hasher.update(dimension.to_le_bytes());
        }
        hasher.update(tensor.start.to_le_bytes());
        hasher.update(tensor.end.to_le_bytes());
    }
    Ok(hex_lower(&hasher.finalize()))
}

fn logical_tensor_evidence(spec: &ModelSpec) -> Result<(u64, String), Qwen3ConversionError> {
    let tensors = required_model_tensors(spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen3ConversionError::new("qwen3-tensor-registry-invalid"))?;
    let mut hasher = Sha256::new();
    hasher.update(LOGICAL_TENSOR_INVENTORY_HASH_DOMAIN);
    let tensor_count = u32::try_from(tensors.len())
        .map_err(|_| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    hasher.update(tensor_count.to_le_bytes());
    let mut parameter_count = 0_u64;
    for tensor in tensors {
        hash_bounded_bytes(&mut hasher, tensor.semantic_role().as_bytes())?;
        hash_bounded_bytes(&mut hasher, tensor.canonical_name().as_bytes())?;
        hasher.update(tensor.layer().to_le_bytes());
        hasher.update(tensor.subindex_0().to_le_bytes());
        hasher.update(tensor.subindex_1().to_le_bytes());
        let rank = u32::try_from(tensor.shape().len())
            .map_err(|_| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
        hasher.update(rank.to_le_bytes());
        let elements = tensor
            .shape()
            .iter()
            .try_fold(1_u64, |product, dimension| product.checked_mul(*dimension));
        for dimension in tensor.shape() {
            hasher.update(dimension.to_le_bytes());
        }
        hasher.update(tensor.payload_alignment().to_le_bytes());
        parameter_count = parameter_count
            .checked_add(
                elements.ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?,
            )
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    }
    Ok((parameter_count, hex_lower(&hasher.finalize())))
}

fn verify_tied_output_payload(
    path: &Path,
    data_offset: u64,
    tensors: &BTreeMap<String, SourceTensor>,
) -> Result<TiedOutputProof, Qwen3ConversionError> {
    let embedding = tensors
        .get(CANONICAL_EMBEDDING_SOURCE_TENSOR)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-tensor-inventory-mismatch"))?;
    let tied_output = tensors
        .get(REDUNDANT_TIED_OUTPUT_SOURCE_TENSOR)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-tied-output-required"))?;
    let byte_length = embedding
        .end
        .checked_sub(embedding.start)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    let element_count = byte_length
        .checked_div(embedding.dtype.source_bytes())
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    let embedding_offset = data_offset
        .checked_add(embedding.start)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    let tied_output_offset = data_offset
        .checked_add(tied_output.start)
        .ok_or_else(|| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    let mut embedding_file =
        File::open(path).map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    let mut tied_output_file =
        File::open(path).map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    embedding_file
        .seek(SeekFrom::Start(embedding_offset))
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    tied_output_file
        .seek(SeekFrom::Start(tied_output_offset))
        .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
    let mut embedding_buffer = vec![0_u8; HASH_BUFFER_BYTES];
    let mut tied_output_buffer = vec![0_u8; HASH_BUFFER_BYTES];
    let mut embedding_hasher = Sha256::new();
    let mut tied_output_hasher = Sha256::new();
    let mut remaining = byte_length;
    while remaining != 0 {
        let count = usize::try_from(remaining.min(HASH_BUFFER_BYTES as u64))
            .map_err(|_| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
        embedding_file
            .read_exact(&mut embedding_buffer[..count])
            .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
        tied_output_file
            .read_exact(&mut tied_output_buffer[..count])
            .map_err(|_| Qwen3ConversionError::new("qwen3-safetensors-invalid"))?;
        embedding_hasher.update(&embedding_buffer[..count]);
        tied_output_hasher.update(&tied_output_buffer[..count]);
        if embedding_buffer[..count] != tied_output_buffer[..count] {
            return Err(Qwen3ConversionError::new(
                "qwen3-tied-output-payload-mismatch",
            ));
        }
        remaining -= count as u64;
    }
    Ok(TiedOutputProof {
        dtype: embedding.dtype,
        shape: embedding.shape.clone(),
        element_count,
        byte_length,
        canonical_embedding_sha256: hex_lower(&embedding_hasher.finalize()),
        redundant_output_sha256: hex_lower(&tied_output_hasher.finalize()),
    })
}

fn hash_bounded_bytes(hasher: &mut Sha256, bytes: &[u8]) -> Result<(), Qwen3ConversionError> {
    let length = u32::try_from(bytes.len())
        .map_err(|_| Qwen3ConversionError::new("qwen3-arithmetic-overflow"))?;
    hasher.update(length.to_le_bytes());
    hasher.update(bytes);
    Ok(())
}

fn build_tensor_inputs(
    source: &InspectedSource,
    model_path: &Path,
) -> Result<Vec<TensorInput<TensorReader>>, Qwen3ConversionError> {
    required_model_tensors(&source.spec, TENSOR_PAYLOAD_ALIGNMENT)
        .map_err(|_| Qwen3ConversionError::new("qwen3-tensor-registry-invalid"))?
        .into_iter()
        .map(|target| {
            let source_name = source_name_for_target(&target)?;
            let tensor = source
                .tensors
                .get(&source_name)
                .ok_or_else(|| Qwen3ConversionError::new("qwen3-tensor-inventory-mismatch"))?;
            Ok(TensorInput::new(
                target,
                TensorReader::new(model_path.to_path_buf(), source.data_offset, tensor)?,
            ))
        })
        .collect()
}

fn source_name_for_target(target: &TensorSpec) -> Result<String, Qwen3ConversionError> {
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
        "layer.attention.query-normalization.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.q_norm.weight")
        }
        "layer.attention.key-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.k_proj.weight")
        }
        "layer.attention.key-normalization.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.k_norm.weight")
        }
        "layer.attention.value-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.v_proj.weight")
        }
        "layer.attention.output-projection.weight" if layer >= 0 => {
            format!("model.layers.{layer}.self_attn.o_proj.weight")
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
        _ => return Err(Qwen3ConversionError::new("qwen3-tensor-registry-invalid")),
    };
    Ok(result)
}

struct OutputPaths {
    parent: PathBuf,
    model: PathBuf,
    receipt: PathBuf,
    model_stage: PathBuf,
    receipt_stage: PathBuf,
    model_name: String,
}

impl OutputPaths {
    fn new(model: &Path) -> Result<Self, Qwen3ConversionError> {
        if !model.is_absolute()
            || model.extension().and_then(|value| value.to_str()) != Some("slm2")
        {
            return Err(Qwen3ConversionError::new("qwen3-output-path-invalid"));
        }
        let parent = model
            .parent()
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-output-path-invalid"))?;
        let parent = validate_directory(parent, "qwen3-output-directory-invalid")?;
        let model_name = model
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| valid_file_name(value))
            .ok_or_else(|| Qwen3ConversionError::new("qwen3-output-path-invalid"))?
            .to_owned();
        let model = parent.join(&model_name);
        let receipt_name = format!("{model_name}.conversion-receipt.json");
        let receipt = parent.join(&receipt_name);
        Ok(Self {
            parent: parent.clone(),
            model: model.clone(),
            receipt: receipt.clone(),
            model_stage: parent.join(format!(".{model_name}.staging")),
            receipt_stage: parent.join(format!(".{receipt_name}.staging")),
            model_name,
        })
    }

    fn validate_absent(&self) -> Result<(), Qwen3ConversionError> {
        for path in [
            &self.model,
            &self.receipt,
            &self.model_stage,
            &self.receipt_stage,
        ] {
            if fs::symlink_metadata(path).is_ok() {
                return Err(Qwen3ConversionError::new("qwen3-output-already-exists"));
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

fn create_new_file(path: &Path) -> Result<File, Qwen3ConversionError> {
    OpenOptions::new()
        .write(true)
        .read(true)
        .create_new(true)
        .open(path)
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-create-failed"))
}

fn write_create_only_synced(path: &Path, bytes: &[u8]) -> Result<(), Qwen3ConversionError> {
    let mut file = create_new_file(path)?;
    file.write_all(bytes)
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-write-failed"))?;
    file.sync_all()
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-flush-failed"))
}

fn promote_create_only(source: &Path, destination: &Path) -> Result<(), Qwen3ConversionError> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|_| Qwen3ConversionError::new("qwen3-output-promotion-failed"))?;
    if metadata_is_link(&metadata) || !metadata.is_file() {
        return Err(Qwen3ConversionError::new("qwen3-output-promotion-failed"));
    }
    match fs::hard_link(source, destination) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            return Err(Qwen3ConversionError::new("qwen3-output-already-exists"));
        }
        Err(_) => return Err(Qwen3ConversionError::new("qwen3-output-promotion-failed")),
    }
    fs::remove_file(source).map_err(|_| Qwen3ConversionError::new("qwen3-output-promotion-failed"))
}

fn read_bounded_regular_file(
    path: &Path,
    maximum_bytes: u64,
    code: &'static str,
) -> Result<Vec<u8>, Qwen3ConversionError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| Qwen3ConversionError::new(code))?;
    if metadata_is_link(&metadata)
        || !metadata.is_file()
        || metadata.len() == 0
        || metadata.len() > maximum_bytes
    {
        return Err(Qwen3ConversionError::new(code));
    }
    fs::read(path).map_err(|_| Qwen3ConversionError::new(code))
}

fn validate_directory(path: &Path, code: &'static str) -> Result<PathBuf, Qwen3ConversionError> {
    if !path.is_absolute() {
        return Err(Qwen3ConversionError::new(code));
    }
    let metadata = fs::symlink_metadata(path).map_err(|_| Qwen3ConversionError::new(code))?;
    if metadata_is_link(&metadata) || !metadata.is_dir() {
        return Err(Qwen3ConversionError::new(code));
    }
    fs::canonicalize(path).map_err(|_| Qwen3ConversionError::new(code))
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

fn sha256_file(path: &Path) -> Result<String, Qwen3ConversionError> {
    let mut file =
        File::open(path).map_err(|_| Qwen3ConversionError::new("qwen3-source-file-invalid"))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| Qwen3ConversionError::new("qwen3-source-file-invalid"))?;
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

fn map_slm2_error(error: tinyrustlm_slm2::Slm2Error) -> Qwen3ConversionError {
    match error.code() {
        "slm2-nonfinite-f32" => Qwen3ConversionError::new("qwen3-source-nonfinite"),
        "slm2-source-drift" => Qwen3ConversionError::new("qwen3-source-drift"),
        _ => Qwen3ConversionError::new("qwen3-output-write-failed"),
    }
}
