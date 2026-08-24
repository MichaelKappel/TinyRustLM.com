use std::collections::{BTreeMap, BTreeSet};
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::Arc;

use sha2::{Digest, Sha256};

use crate::cbor::{self, Value};
use crate::{hex_lower, sha256, validate_profile_identity, Slm2Error};

const MAGIC: [u8; 8] = *b"SLM2\r\n\x1a\n";
const FORMAT_ID: [u8; 16] = *b"minimodel.slm2\0\0";
const HEADER_BYTES: usize = 224;
const SECTION_ALIGNMENT: u64 = 64;
const QUANT_RECORD_BYTES: usize = 128;
const TENSOR_RECORD_BYTES: usize = 192;
const FORMAT_MAXIMUM_FILE_BYTES: u64 = 9_007_199_254_740_991;
const DEFAULT_MAXIMUM_FILE_BYTES: u64 = 68_719_476_736;
const MAXIMUM_MANIFEST_BYTES: u64 = 4_194_304;
const MAXIMUM_STRING_TABLE_BYTES: u64 = 16_777_216;
const MAXIMUM_STRINGS: u32 = 262_144;
const MAXIMUM_TENSORS: u32 = 262_144;
const STREAM_BUFFER_BYTES: usize = 1_048_576;
const TENSOR_LAYOUT_DOMAIN: &[u8] = b"tinyrustlm.slm2.tensor-layout.mixed-q8-row.v1\0";
const TENSOR_PAYLOAD_DOMAIN: &[u8] = b"tinyrustlm.slm2.tensor-payload.mixed-q8-row.v1\0";
const SCHEMA: &str = "org.minimodel.slm/2.0";
const ACTIVATION_PROFILE: &str = "tinyrustlm.silu-gated/1";
const ARCHITECTURE_PROFILE: &str = "tinyrustlm.decoder-transformer/1";
const ATTENTION_PROFILE: &str = "tinyrustlm.causal-gqa/1";
const NORMALIZATION_PROFILE: &str = "tinyrustlm.rmsnorm/1";
const POSITION_PROFILE: &str = "tinyrustlm.rope/1";
const KV_PROFILE: &str = "tinyrustlm.kv-f32/1";
const MINIMUM_RUNTIME: &str = "tinyrustlm.runtime/2.0";
const OPERATOR_PROFILE: &str = "tinyrustlm.decoder-q8-row-symmetric-f32-accumulate/1";
const TENSOR_PROFILE: &str = "tinyrustlm.tensor-mixed-q8-row-f32/1";
const TENSOR_ROLE_PROFILE: &str = "tinyrustlm.decoder-matrix-q8-normalization-bias-f32-roles/1";
const WEIGHT_PROFILE: &str = "tinyrustlm.weight-q8-row-symmetric-f32-scale/1";
const QUANTIZER_PROFILE: &str = "tinyrustlm.quantize-q8-row-symmetric-f32/1";
const SCALAR_KERNEL_PROFILE: &str = "tinyrustlm.matmul-q8-row-f32-scalar/1";

/// Exact stored scalar encoding admitted by the current SLM2 profile.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u16)]
pub enum ElementType {
    /// Finite little-endian IEEE-754 binary32.
    F32 = 1,
    /// Outer-row symmetric signed int8 with one binary32 scale per row.
    Q8RowSymmetric = 2,
}

impl ElementType {
    fn from_u16(value: u16) -> Result<Self, Slm2Error> {
        match value {
            1 => Ok(Self::F32),
            2 => Ok(Self::Q8RowSymmetric),
            _ => Err(Slm2Error::new("slm2-invalid-tensor-encoding")),
        }
    }
}

fn q8_scale_from_maximum(maximum: f32) -> Result<f32, Slm2Error> {
    let scale = if maximum == 0.0 {
        1.0_f32
    } else {
        maximum / 127.0_f32
    };
    if !scale.is_finite() || scale <= 0.0 || scale.to_bits() == (-0.0_f32).to_bits() {
        return Err(Slm2Error::new("slm2-invalid-q8-scale"));
    }
    Ok(scale)
}

fn quantize_q8_value(value: f32, scale: f32) -> Result<i8, Slm2Error> {
    if !value.is_finite() {
        return Err(Slm2Error::new("slm2-nonfinite-f32"));
    }
    let code = (value / scale).round().clamp(-127.0, 127.0) as i8;
    if code == i8::MIN {
        return Err(Slm2Error::new("slm2-invalid-q8-code"));
    }
    Ok(code)
}

/// Quantizes one nonempty finite F32 row with the exact registered Q8 rule.
pub fn quantize_q8_row_symmetric_f32(values: &[f32]) -> Result<(f32, Vec<i8>), Slm2Error> {
    if values.is_empty() {
        return Err(Slm2Error::new("slm2-invalid-q8-source"));
    }
    let mut maximum = 0.0_f32;
    for value in values {
        if !value.is_finite() {
            return Err(Slm2Error::new("slm2-nonfinite-f32"));
        }
        maximum = maximum.max(value.abs());
    }
    let scale = q8_scale_from_maximum(maximum)?;
    let codes = values
        .iter()
        .map(|value| quantize_q8_value(*value, scale))
        .collect::<Result<Vec<_>, _>>()?;
    if codes.iter().all(|code| *code == 0) && scale.to_bits() != 1.0_f32.to_bits() {
        return Err(Slm2Error::new("slm2-invalid-q8-scale"));
    }
    Ok((scale, codes))
}

/// Executes the exact ordered, binary32, no-FMA Q8 row-matrix kernel.
pub fn q8_row_symmetric_f32_matvec(
    payload: &[u8],
    rows: usize,
    columns: usize,
    input: &[f32],
) -> Result<Vec<f32>, Slm2Error> {
    let row_bytes = columns
        .checked_add(4)
        .ok_or_else(|| Slm2Error::new("slm2-q8-matvec-shape"))?;
    let expected = rows
        .checked_mul(row_bytes)
        .ok_or_else(|| Slm2Error::new("slm2-q8-matvec-shape"))?;
    if rows == 0 || columns == 0 || input.len() != columns || payload.len() != expected {
        return Err(Slm2Error::new("slm2-q8-matvec-shape"));
    }
    if input.iter().any(|value| !value.is_finite()) {
        return Err(Slm2Error::new("slm2-runtime-nonfinite"));
    }
    let mut output = Vec::new();
    output
        .try_reserve_exact(rows)
        .map_err(|_| Slm2Error::new("slm2-allocation"))?;
    for row in 0..rows {
        let start = row
            .checked_mul(row_bytes)
            .ok_or_else(|| Slm2Error::new("slm2-q8-matvec-shape"))?;
        let scale = f32::from_le_bytes(
            payload[start..start + 4]
                .try_into()
                .map_err(|_| Slm2Error::new("slm2-invalid-q8-payload"))?,
        );
        if !scale.is_finite() || scale <= 0.0 {
            return Err(Slm2Error::new("slm2-invalid-q8-payload"));
        }
        let mut sum = 0.0_f32;
        for (column, input_value) in input.iter().enumerate() {
            let code = payload[start + 4 + column] as i8;
            if code == i8::MIN {
                return Err(Slm2Error::new("slm2-invalid-q8-payload"));
            }
            let dequantized = scale * f32::from(code);
            let term = *input_value * dequantized;
            sum += term;
        }
        if !sum.is_finite() {
            return Err(Slm2Error::new("slm2-runtime-nonfinite"));
        }
        output.push(sum);
    }
    Ok(output)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct TensorStorage {
    element_type: ElementType,
    quant_profile_index: u16,
    stored_bytes: u64,
    block_elements: u32,
    block_bytes: u32,
    scale_type: u16,
    zero_point_type: u16,
    packing_order: u16,
    accumulator_type: u16,
    tail_rule: u16,
}

/// A model role admitted by the exact SLM2 2.0 profile.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
#[repr(u16)]
pub enum ArtifactClass {
    /// A complete general model or immutable base.
    BaseModel = 1,
    /// A complete independently executable specialist model.
    SpecialistModel = 2,
}

impl ArtifactClass {
    fn from_u16(value: u16) -> Result<Self, Slm2Error> {
        match value {
            1 => Ok(Self::BaseModel),
            2 => Ok(Self::SpecialistModel),
            _ => Err(Slm2Error::new("slm2-unsupported-artifact-class")),
        }
    }

    /// Returns the exact external artifact-class label.
    pub const fn label(self) -> &'static str {
        match self {
            Self::BaseModel => "base-model",
            Self::SpecialistModel => "specialist-model",
        }
    }
}

/// Closed architecture metadata for the sole SLM2 2.0 mixed-weight profile.
#[derive(Clone, Debug, PartialEq)]
pub struct ModelSpec {
    /// The exact model role.
    pub artifact_class: ArtifactClass,
    /// The tokenizer vocabulary size expected by the model.
    pub vocabulary_size: u32,
    /// The maximum model context in tokens.
    pub context_length: u32,
    /// The residual-stream width.
    pub embedding_size: u32,
    /// The feed-forward intermediate width.
    pub feed_forward_size: u32,
    /// The transformer block count.
    pub layer_count: u32,
    /// The query-head count.
    pub head_count: u32,
    /// The key/value-head count.
    pub kv_head_count: u32,
    /// The width of one attention head.
    pub head_dimension: u32,
    /// The positive finite RoPE theta value.
    pub rope_theta: f32,
    /// The positive finite RMSNorm epsilon value.
    pub normalization_epsilon: f32,
    /// Whether input embeddings and output projection share exact weights.
    pub tied_embeddings: bool,
    /// Whether every transformer layer carries Q, K, and V projection biases.
    pub qkv_bias: bool,
    /// Whether every transformer layer carries per-head Q and K normalization weights.
    pub qk_normalization: bool,
}

impl ModelSpec {
    fn validate(&self) -> Result<(), Slm2Error> {
        if [
            self.vocabulary_size,
            self.context_length,
            self.embedding_size,
            self.feed_forward_size,
            self.layer_count,
            self.head_count,
            self.kv_head_count,
            self.head_dimension,
        ]
        .contains(&0)
        {
            return Err(Slm2Error::new("slm2-invalid-model-metadata"));
        }
        if self.kv_head_count > self.head_count
            || !self.head_count.is_multiple_of(self.kv_head_count)
            || !self.rope_theta.is_finite()
            || self.rope_theta <= 0.0
            || !self.normalization_epsilon.is_finite()
            || self.normalization_epsilon <= 0.0
        {
            return Err(Slm2Error::new("slm2-invalid-model-metadata"));
        }
        self.head_count
            .checked_mul(self.head_dimension)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))?;
        self.kv_head_count
            .checked_mul(self.head_dimension)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))?;
        if i32::try_from(self.layer_count).is_err() {
            return Err(Slm2Error::new("slm2-invalid-model-metadata"));
        }
        Ok(())
    }
}

/// Canonical semantics for one tensor in the closed model registry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TensorSpec {
    semantic_role: String,
    canonical_name: String,
    layer: i32,
    subindex_0: i32,
    subindex_1: i32,
    rank: u8,
    shape: [u64; 8],
    payload_alignment: u32,
}

impl TensorSpec {
    /// Constructs and validates one canonical tensor specification.
    pub fn new(
        semantic_role: impl Into<String>,
        canonical_name: impl Into<String>,
        layer: i32,
        subindex_0: i32,
        subindex_1: i32,
        shape: &[u64],
        payload_alignment: u32,
    ) -> Result<Self, Slm2Error> {
        let rank = u8::try_from(shape.len()).map_err(|_| Slm2Error::new("slm2-invalid-tensor"))?;
        if rank > 8 {
            return Err(Slm2Error::new("slm2-invalid-tensor"));
        }
        let mut fixed_shape = [0_u64; 8];
        fixed_shape[..shape.len()].copy_from_slice(shape);
        let spec = Self {
            semantic_role: semantic_role.into(),
            canonical_name: canonical_name.into(),
            layer,
            subindex_0,
            subindex_1,
            rank,
            shape: fixed_shape,
            payload_alignment,
        };
        spec.validate()?;
        Ok(spec)
    }

    /// Returns the semantic tensor role.
    pub fn semantic_role(&self) -> &str {
        &self.semantic_role
    }

    /// Returns the canonical tensor name.
    pub fn canonical_name(&self) -> &str {
        &self.canonical_name
    }

    /// Returns the layer index, where `-1` means global.
    pub const fn layer(&self) -> i32 {
        self.layer
    }

    /// Returns the first semantic subindex.
    pub const fn subindex_0(&self) -> i32 {
        self.subindex_0
    }

    /// Returns the second semantic subindex.
    pub const fn subindex_1(&self) -> i32 {
        self.subindex_1
    }

    /// Returns the used logical dimensions in outer-to-inner order.
    pub fn shape(&self) -> &[u64] {
        &self.shape[..usize::from(self.rank)]
    }

    /// Returns the required on-disk payload alignment.
    pub const fn payload_alignment(&self) -> u32 {
        self.payload_alignment
    }

    fn validate(&self) -> Result<(), Slm2Error> {
        if !is_machine_identifier(&self.semantic_role)
            || !is_machine_identifier(&self.canonical_name)
            || self.layer < -1
            || self.subindex_0 < -1
            || self.subindex_1 < -1
            || self.rank > 8
            || self.shape[..usize::from(self.rank)]
                .iter()
                .any(|dimension| *dimension == 0 || *dimension > u64::from(u32::MAX))
            || self.shape[usize::from(self.rank)..]
                .iter()
                .any(|dimension| *dimension != 0)
            || !valid_tensor_alignment(self.payload_alignment)
        {
            return Err(Slm2Error::new("slm2-invalid-tensor"));
        }
        self.logical_elements()?;
        Ok(())
    }

    fn logical_elements(&self) -> Result<u64, Slm2Error> {
        if self.rank == 0 {
            return Ok(1);
        }
        self.shape().iter().try_fold(1_u64, |product, dimension| {
            product
                .checked_mul(*dimension)
                .ok_or_else(|| Slm2Error::new("slm2-invalid-tensor"))
        })
    }

    fn expected_source_bytes(&self) -> Result<u64, Slm2Error> {
        self.logical_elements()?
            .checked_mul(4)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-tensor"))
    }

    fn storage(&self) -> Result<TensorStorage, Slm2Error> {
        if is_q8_role(&self.semantic_role) {
            if self.rank != 2 {
                return Err(Slm2Error::new("slm2-invalid-tensor-encoding"));
            }
            let rows = self.shape[0];
            let columns = self.shape[1];
            let block_elements = u32::try_from(columns)
                .map_err(|_| Slm2Error::new("slm2-invalid-tensor-encoding"))?;
            let block_bytes = block_elements
                .checked_add(4)
                .ok_or_else(|| Slm2Error::new("slm2-invalid-tensor-encoding"))?;
            let stored_bytes = rows
                .checked_mul(u64::from(block_bytes))
                .ok_or_else(|| Slm2Error::new("slm2-invalid-tensor-encoding"))?;
            Ok(TensorStorage {
                element_type: ElementType::Q8RowSymmetric,
                quant_profile_index: 0,
                stored_bytes,
                block_elements,
                block_bytes,
                scale_type: 1,
                zero_point_type: 0,
                packing_order: 1,
                accumulator_type: 1,
                tail_rule: 1,
            })
        } else if is_f32_role(&self.semantic_role) {
            Ok(TensorStorage {
                element_type: ElementType::F32,
                quant_profile_index: u16::MAX,
                stored_bytes: self.expected_source_bytes()?,
                block_elements: 0,
                block_bytes: 0,
                scale_type: 0,
                zero_point_type: 0,
                packing_order: 0,
                accumulator_type: 0,
                tail_rule: 0,
            })
        } else {
            Err(Slm2Error::new("slm2-invalid-tensor-registry"))
        }
    }
}

/// One tensor specification paired with a seekable exact payload source.
pub struct TensorInput<R> {
    spec: TensorSpec,
    reader: R,
}

impl<R> TensorInput<R> {
    /// Creates an input whose reader contains this tensor's finite F32 source values.
    ///
    /// The writer derives the sole stored encoding from the exact semantic role;
    /// callers cannot select an alternate format or quantization profile.
    pub const fn new(spec: TensorSpec, reader: R) -> Self {
        Self { spec, reader }
    }

    /// Returns the tensor specification.
    pub const fn spec(&self) -> &TensorSpec {
        &self.spec
    }
}

/// Materializes the exact required tensor descriptors for one closed model specification.
///
/// The result is in canonical tensor-key order. A converter may use this as its
/// sole destination registry; parser and writer validation reject any missing,
/// additional, renamed, reshaped, or incorrectly indexed tensor.
pub fn required_model_tensors(
    spec: &ModelSpec,
    payload_alignment: u32,
) -> Result<Vec<TensorSpec>, Slm2Error> {
    spec.validate()?;
    let query_width = u64::from(
        spec.head_count
            .checked_mul(spec.head_dimension)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))?,
    );
    let kv_width = u64::from(
        spec.kv_head_count
            .checked_mul(spec.head_dimension)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))?,
    );
    let embedding = u64::from(spec.embedding_size);
    let feed_forward = u64::from(spec.feed_forward_size);
    let vocabulary = u64::from(spec.vocabulary_size);
    let head_dimension = u64::from(spec.head_dimension);
    let per_layer = 9_usize
        .checked_add(if spec.qkv_bias { 3 } else { 0 })
        .and_then(|value| value.checked_add(if spec.qk_normalization { 2 } else { 0 }))
        .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))?;
    let capacity = usize::try_from(spec.layer_count)
        .ok()
        .and_then(|layers| layers.checked_mul(per_layer))
        .and_then(|layers| layers.checked_add(if spec.tied_embeddings { 2 } else { 3 }))
        .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))?;
    if capacity > MAXIMUM_TENSORS as usize {
        return Err(Slm2Error::new("slm2-invalid-model-metadata"));
    }
    let mut tensors = Vec::with_capacity(capacity);

    push_required_tensor(
        &mut tensors,
        "model.token-embedding.weight",
        "model.token-embedding.weight".to_owned(),
        -1,
        &[vocabulary, embedding],
        payload_alignment,
    )?;
    push_required_tensor(
        &mut tensors,
        "model.final-normalization.weight",
        "model.final-normalization.weight".to_owned(),
        -1,
        &[embedding],
        payload_alignment,
    )?;
    if !spec.tied_embeddings {
        push_required_tensor(
            &mut tensors,
            "model.output-projection.weight",
            "model.output-projection.weight".to_owned(),
            -1,
            &[vocabulary, embedding],
            payload_alignment,
        )?;
    }

    for layer in 0..spec.layer_count {
        let layer_index =
            i32::try_from(layer).map_err(|_| Slm2Error::new("slm2-invalid-model-metadata"))?;
        let prefix = format!("model.layers.{layer}");
        for (role, suffix, shape) in [
            (
                "layer.attention-normalization.weight",
                "attention-normalization.weight",
                vec![embedding],
            ),
            (
                "layer.feed-forward-normalization.weight",
                "feed-forward-normalization.weight",
                vec![embedding],
            ),
            (
                "layer.attention.query-projection.weight",
                "attention.query-projection.weight",
                vec![query_width, embedding],
            ),
            (
                "layer.attention.key-projection.weight",
                "attention.key-projection.weight",
                vec![kv_width, embedding],
            ),
            (
                "layer.attention.value-projection.weight",
                "attention.value-projection.weight",
                vec![kv_width, embedding],
            ),
            (
                "layer.attention.output-projection.weight",
                "attention.output-projection.weight",
                vec![embedding, query_width],
            ),
            (
                "layer.feed-forward.gate-projection.weight",
                "feed-forward.gate-projection.weight",
                vec![feed_forward, embedding],
            ),
            (
                "layer.feed-forward.down-projection.weight",
                "feed-forward.down-projection.weight",
                vec![embedding, feed_forward],
            ),
            (
                "layer.feed-forward.up-projection.weight",
                "feed-forward.up-projection.weight",
                vec![feed_forward, embedding],
            ),
        ] {
            push_required_tensor(
                &mut tensors,
                role,
                format!("{prefix}.{suffix}"),
                layer_index,
                &shape,
                payload_alignment,
            )?;
        }
        if spec.qkv_bias {
            for (role, suffix, shape) in [
                (
                    "layer.attention.query-projection.bias",
                    "attention.query-projection.bias",
                    query_width,
                ),
                (
                    "layer.attention.key-projection.bias",
                    "attention.key-projection.bias",
                    kv_width,
                ),
                (
                    "layer.attention.value-projection.bias",
                    "attention.value-projection.bias",
                    kv_width,
                ),
            ] {
                push_required_tensor(
                    &mut tensors,
                    role,
                    format!("{prefix}.{suffix}"),
                    layer_index,
                    &[shape],
                    payload_alignment,
                )?;
            }
        }
        if spec.qk_normalization {
            for (role, suffix) in [
                (
                    "layer.attention.query-normalization.weight",
                    "attention.query-normalization.weight",
                ),
                (
                    "layer.attention.key-normalization.weight",
                    "attention.key-normalization.weight",
                ),
            ] {
                push_required_tensor(
                    &mut tensors,
                    role,
                    format!("{prefix}.{suffix}"),
                    layer_index,
                    &[head_dimension],
                    payload_alignment,
                )?;
            }
        }
    }
    tensors.sort_by_key(tensor_sort_key);
    Ok(tensors)
}

fn push_required_tensor(
    tensors: &mut Vec<TensorSpec>,
    semantic_role: &str,
    canonical_name: String,
    layer: i32,
    shape: &[u64],
    payload_alignment: u32,
) -> Result<(), Slm2Error> {
    tensors.push(TensorSpec::new(
        semantic_role,
        canonical_name,
        layer,
        -1,
        -1,
        shape,
        payload_alignment,
    )?);
    Ok(())
}

/// Bounded reader policy for one validation operation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ValidationPolicy {
    maximum_file_bytes: u64,
    maximum_tensors: u32,
}

impl ValidationPolicy {
    /// Creates a policy no larger than the exact format limits.
    pub fn new(maximum_file_bytes: u64, maximum_tensors: u32) -> Result<Self, Slm2Error> {
        if maximum_file_bytes < HEADER_BYTES as u64
            || maximum_file_bytes > FORMAT_MAXIMUM_FILE_BYTES
            || maximum_tensors == 0
            || maximum_tensors > MAXIMUM_TENSORS
        {
            return Err(Slm2Error::new("slm2-invalid-policy"));
        }
        Ok(Self {
            maximum_file_bytes,
            maximum_tensors,
        })
    }

    /// Returns the maximum admitted complete file size.
    pub const fn maximum_file_bytes(self) -> u64 {
        self.maximum_file_bytes
    }

    /// Returns the maximum admitted tensor count.
    pub const fn maximum_tensors(self) -> u32 {
        self.maximum_tensors
    }
}

impl Default for ValidationPolicy {
    fn default() -> Self {
        Self {
            maximum_file_bytes: DEFAULT_MAXIMUM_FILE_BYTES,
            maximum_tensors: MAXIMUM_TENSORS,
        }
    }
}

/// Cryptographic identity emitted after complete writer or reader success.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModelIdentity {
    byte_length: u64,
    artifact_sha256: [u8; 32],
    manifest_sha256: [u8; 32],
}

impl ModelIdentity {
    /// Returns the exact complete artifact length.
    pub const fn byte_length(&self) -> u64 {
        self.byte_length
    }

    /// Returns the plain SHA-256 over all artifact bytes.
    pub const fn artifact_sha256(&self) -> &[u8; 32] {
        &self.artifact_sha256
    }

    /// Returns the plain SHA-256 over exact manifest bytes.
    pub const fn manifest_sha256(&self) -> &[u8; 32] {
        &self.manifest_sha256
    }

    /// Returns the lowercase hexadecimal artifact SHA-256.
    pub fn artifact_sha256_hex(&self) -> String {
        hex_lower(&self.artifact_sha256)
    }

    /// Returns the lowercase hexadecimal manifest SHA-256.
    pub fn manifest_sha256_hex(&self) -> String {
        hex_lower(&self.manifest_sha256)
    }
}

/// One fully validated tensor descriptor without payload allocation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidatedTensor {
    semantic_role: Arc<str>,
    canonical_name: Arc<str>,
    layer: i32,
    subindex_0: i32,
    subindex_1: i32,
    rank: u8,
    shape: [u64; 8],
    logical_elements: u64,
    element_type: ElementType,
    quant_profile_index: u16,
    stored_bytes: u64,
    payload_offset: u64,
    payload_length: u64,
    payload_alignment: u32,
    block_elements: u32,
    block_bytes: u32,
    scale_type: u16,
    zero_point_type: u16,
    packing_order: u16,
    accumulator_type: u16,
    tail_rule: u16,
    payload_sha256: [u8; 32],
}

impl ValidatedTensor {
    /// Returns the semantic tensor role.
    pub fn semantic_role(&self) -> &str {
        &self.semantic_role
    }

    /// Returns the canonical tensor name.
    pub fn canonical_name(&self) -> &str {
        &self.canonical_name
    }

    /// Returns the layer index, where `-1` means global.
    pub const fn layer(&self) -> i32 {
        self.layer
    }

    /// Returns the first semantic subindex.
    pub const fn subindex_0(&self) -> i32 {
        self.subindex_0
    }

    /// Returns the second semantic subindex.
    pub const fn subindex_1(&self) -> i32 {
        self.subindex_1
    }

    /// Returns the logical dimensions.
    pub fn shape(&self) -> &[u64] {
        &self.shape[..usize::from(self.rank)]
    }

    /// Returns the checked logical element count.
    pub const fn logical_elements(&self) -> u64 {
        self.logical_elements
    }

    /// Returns the exact on-disk element encoding.
    pub const fn element_type(&self) -> ElementType {
        self.element_type
    }

    /// Returns zero for Q8-row tensors and `u16::MAX` for F32 tensors.
    pub const fn quant_profile_index(&self) -> u16 {
        self.quant_profile_index
    }

    /// Returns the exact stored byte count before payload placement.
    pub const fn stored_bytes(&self) -> u64 {
        self.stored_bytes
    }

    /// Returns the absolute file offset of payload bytes.
    pub const fn payload_offset(&self) -> u64 {
        self.payload_offset
    }

    /// Returns the exact payload byte length.
    pub const fn payload_length(&self) -> u64 {
        self.payload_length
    }

    /// Returns the required payload alignment.
    pub const fn payload_alignment(&self) -> u32 {
        self.payload_alignment
    }

    /// Returns logical elements in one Q8 row block, or zero for F32.
    pub const fn block_elements(&self) -> u32 {
        self.block_elements
    }

    /// Returns bytes in one Q8 row block, or zero for F32.
    pub const fn block_bytes(&self) -> u32 {
        self.block_bytes
    }

    /// Returns the exact scale encoding enum.
    pub const fn scale_type(&self) -> u16 {
        self.scale_type
    }

    /// Returns the exact zero-point encoding enum.
    pub const fn zero_point_type(&self) -> u16 {
        self.zero_point_type
    }

    /// Returns the exact payload packing-order enum.
    pub const fn packing_order(&self) -> u16 {
        self.packing_order
    }

    /// Returns the exact accumulator enum.
    pub const fn accumulator_type(&self) -> u16 {
        self.accumulator_type
    }

    /// Returns the exact tail-rule enum.
    pub const fn tail_rule(&self) -> u16 {
        self.tail_rule
    }

    /// Returns the domain-separated tensor payload SHA-256.
    pub const fn payload_sha256(&self) -> &[u8; 32] {
        &self.payload_sha256
    }
}

/// A completely validated SLM2 model candidate that remains inactive.
#[derive(Clone, Debug, PartialEq)]
pub struct ValidatedModel {
    identity: ModelIdentity,
    spec: ModelSpec,
    tensor_layout_sha256: [u8; 32],
    tensors: Vec<ValidatedTensor>,
}

impl ValidatedModel {
    /// Returns complete artifact and manifest identities.
    pub const fn identity(&self) -> &ModelIdentity {
        &self.identity
    }

    /// Returns the validated closed model metadata.
    pub const fn spec(&self) -> &ModelSpec {
        &self.spec
    }

    /// Returns the domain-separated canonical tensor-layout SHA-256.
    pub const fn tensor_layout_sha256(&self) -> &[u8; 32] {
        &self.tensor_layout_sha256
    }

    /// Returns validated tensor descriptors in canonical order.
    pub fn tensors(&self) -> &[ValidatedTensor] {
        &self.tensors
    }
}

#[derive(Clone)]
struct PreparedTensor {
    spec: TensorSpec,
    storage: TensorStorage,
    source_index: usize,
    logical_elements: u64,
    payload_length: u64,
    payload_relative_offset: u64,
    payload_hash: [u8; 32],
    source_hash: [u8; 32],
    role_string_id: u32,
    name_string_id: u32,
}

type TensorSortKey = (Vec<u8>, i32, i32, i32, Vec<u8>);

#[derive(Clone, Copy)]
struct Header {
    artifact_class: ArtifactClass,
    file_size: u64,
    manifest_offset: u64,
    manifest_length: u64,
    string_table_offset: u64,
    string_table_length: u64,
    quant_table_offset: u64,
    tensor_table_offset: u64,
    tensor_count: u32,
    payload_offset: u64,
    payload_length: u64,
}

/// Writes one deterministic SLM2 artifact from seekable tensor sources.
///
/// The destination must be a newly owned staging stream. The function writes
/// sequentially, hashes every emitted byte, and returns only after a second
/// source pass proves that tensor bytes did not drift after descriptor hashing.
pub fn write_model<W, R>(
    destination: &mut W,
    spec: &ModelSpec,
    tensors: &mut [TensorInput<R>],
) -> Result<ModelIdentity, Slm2Error>
where
    W: Write + Seek,
    R: Read + Seek,
{
    validate_profile_identity()?;
    spec.validate()?;
    let destination_length = destination
        .seek(SeekFrom::End(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    if destination_length != 0 {
        return Err(Slm2Error::new("slm2-destination-not-empty"));
    }
    destination
        .seek(SeekFrom::Start(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    if tensors.is_empty() || tensors.len() > MAXIMUM_TENSORS as usize {
        return Err(Slm2Error::new("slm2-invalid-tensor-count"));
    }

    let mut order: Vec<usize> = (0..tensors.len()).collect();
    for tensor in tensors.iter() {
        tensor.spec.validate()?;
    }
    order.sort_by(|left, right| {
        tensor_sort_key(&tensors[*left].spec).cmp(&tensor_sort_key(&tensors[*right].spec))
    });
    validate_writer_uniqueness(tensors, &order)?;

    let mut string_set = BTreeSet::new();
    for profile in [
        WEIGHT_PROFILE,
        QUANTIZER_PROFILE,
        SCALAR_KERNEL_PROFILE,
        TENSOR_ROLE_PROFILE,
    ] {
        string_set.insert(profile.to_owned());
    }
    for index in &order {
        string_set.insert(tensors[*index].spec.semantic_role.clone());
        string_set.insert(tensors[*index].spec.canonical_name.clone());
    }
    let strings: Vec<String> = string_set.into_iter().collect();
    let string_ids: BTreeMap<&str, u32> = strings
        .iter()
        .enumerate()
        .map(|(index, value)| {
            Ok((
                value.as_str(),
                u32::try_from(index).map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?,
            ))
        })
        .collect::<Result<_, Slm2Error>>()?;

    let sorted_specs: Vec<&TensorSpec> = order.iter().map(|index| &tensors[*index].spec).collect();
    validate_tensor_registry(spec, &sorted_specs)?;
    let tensor_layout_sha256 = hash_tensor_layout(spec.artifact_class, &sorted_specs)?;
    let manifest = encode_manifest(spec, &tensor_layout_sha256)?;
    if manifest.is_empty() || manifest.len() as u64 > MAXIMUM_MANIFEST_BYTES {
        return Err(Slm2Error::new("slm2-invalid-manifest-size"));
    }
    let manifest_sha256 = sha256(&manifest);
    let string_table = encode_string_table(&strings)?;
    let quant_table = encode_quantization_record(&string_ids)?;

    let manifest_offset = align_up(HEADER_BYTES as u64, SECTION_ALIGNMENT)?;
    let string_table_offset = align_up(
        checked_end(manifest_offset, manifest.len() as u64)?,
        SECTION_ALIGNMENT,
    )?;
    let quant_table_offset = align_up(
        checked_end(string_table_offset, string_table.len() as u64)?,
        SECTION_ALIGNMENT,
    )?;
    let tensor_table_offset = align_up(
        checked_end(quant_table_offset, quant_table.len() as u64)?,
        SECTION_ALIGNMENT,
    )?;
    let tensor_table_length = (tensors.len() as u64)
        .checked_mul(TENSOR_RECORD_BYTES as u64)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    let payload_offset = align_up(
        checked_end(tensor_table_offset, tensor_table_length)?,
        SECTION_ALIGNMENT,
    )?;

    let mut prepared = Vec::with_capacity(tensors.len());
    let mut absolute_cursor = payload_offset;
    let mut buffer = vec![0_u8; STREAM_BUFFER_BYTES];
    for index in &order {
        let input = &mut tensors[*index];
        let source_bytes = source_length(&mut input.reader)?;
        let expected_source_bytes = input.spec.expected_source_bytes()?;
        if source_bytes != expected_source_bytes {
            return Err(Slm2Error::new("slm2-tensor-size-mismatch"));
        }
        let logical_elements = input.spec.logical_elements()?;
        let storage = input.spec.storage()?;
        let payload_length = storage.stored_bytes;
        let absolute_offset = align_up(absolute_cursor, u64::from(input.spec.payload_alignment))?;
        let next_cursor = checked_end(absolute_offset, payload_length)?;
        if next_cursor > DEFAULT_MAXIMUM_FILE_BYTES {
            return Err(Slm2Error::new("slm2-file-size-limit"));
        }
        let (payload_hash, source_hash) = scan_tensor_source(
            &mut input.reader,
            spec.artifact_class,
            &input.spec,
            source_bytes,
            storage,
            &mut buffer,
        )?;
        let payload_relative_offset = absolute_offset
            .checked_sub(payload_offset)
            .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
        absolute_cursor = next_cursor;
        prepared.push(PreparedTensor {
            spec: input.spec.clone(),
            storage,
            source_index: *index,
            logical_elements,
            payload_length,
            payload_relative_offset,
            payload_hash,
            source_hash,
            role_string_id: *string_ids
                .get(input.spec.semantic_role.as_str())
                .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?,
            name_string_id: *string_ids
                .get(input.spec.canonical_name.as_str())
                .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?,
        });
    }

    let file_size = absolute_cursor;
    if file_size > DEFAULT_MAXIMUM_FILE_BYTES {
        return Err(Slm2Error::new("slm2-file-size-limit"));
    }
    let header = Header {
        artifact_class: spec.artifact_class,
        file_size,
        manifest_offset,
        manifest_length: manifest.len() as u64,
        string_table_offset,
        string_table_length: string_table.len() as u64,
        quant_table_offset,
        tensor_table_offset,
        tensor_count: u32::try_from(prepared.len())
            .map_err(|_| Slm2Error::new("slm2-invalid-tensor-count"))?,
        payload_offset,
        payload_length: file_size
            .checked_sub(payload_offset)
            .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?,
    };
    let header_bytes = encode_header(header)?;
    let tensor_table = encode_tensor_table(&prepared)?;

    let mut output = HashedOutput::new(destination);
    output.write_all(&header_bytes)?;
    output.write_zeros_to(manifest_offset)?;
    output.write_all(&manifest)?;
    output.write_zeros_to(string_table_offset)?;
    output.write_all(&string_table)?;
    output.write_zeros_to(quant_table_offset)?;
    output.write_all(&quant_table)?;
    output.write_zeros_to(tensor_table_offset)?;
    output.write_all(&tensor_table)?;
    output.write_zeros_to(payload_offset)?;

    for tensor in &prepared {
        let absolute_offset = checked_end(payload_offset, tensor.payload_relative_offset)?;
        output.write_zeros_to(absolute_offset)?;
        let input = &mut tensors[tensor.source_index];
        let current_length = source_length(&mut input.reader)?;
        if current_length != tensor.spec.expected_source_bytes()? {
            return Err(Slm2Error::new("slm2-source-drift"));
        }
        let (copied_hash, copied_source_hash) = copy_tensor_source(
            &mut input.reader,
            &mut output,
            spec.artifact_class,
            &tensor.spec,
            current_length,
            tensor.storage,
            &mut buffer,
        )?;
        if copied_hash != tensor.payload_hash || copied_source_hash != tensor.source_hash {
            return Err(Slm2Error::new("slm2-source-drift"));
        }
    }

    if output.written != file_size {
        return Err(Slm2Error::new("slm2-writer-size-drift"));
    }
    output.flush()?;
    let artifact_sha256 = output.finalize();
    Ok(ModelIdentity {
        byte_length: file_size,
        artifact_sha256,
        manifest_sha256,
    })
}

/// Validates one SLM2 model through bounded random reads and streaming hashes.
pub fn validate_model<R>(
    source: &mut R,
    policy: ValidationPolicy,
) -> Result<ValidatedModel, Slm2Error>
where
    R: Read + Seek,
{
    validate_profile_identity()?;
    let actual_size = source_length(source)?;
    if actual_size < HEADER_BYTES as u64 {
        return Err(Slm2Error::new("slm2-truncated-header"));
    }
    if actual_size > FORMAT_MAXIMUM_FILE_BYTES || actual_size > policy.maximum_file_bytes {
        return Err(Slm2Error::new("slm2-file-size-limit"));
    }

    let mut raw_header = [0_u8; HEADER_BYTES];
    read_exact_at(source, 0, &mut raw_header)?;
    let header = decode_header(&raw_header, actual_size, policy)?;
    validate_section_padding(source, &header)?;

    let manifest_length = usize::try_from(header.manifest_length)
        .map_err(|_| Slm2Error::new("slm2-invalid-manifest-size"))?;
    let mut manifest_bytes = vec![0_u8; manifest_length];
    read_exact_at(source, header.manifest_offset, &mut manifest_bytes)?;
    let manifest_sha256 = sha256(&manifest_bytes);
    let (spec, expected_layout_sha256) = decode_manifest(&manifest_bytes, header.artifact_class)?;

    let string_length = usize::try_from(header.string_table_length)
        .map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?;
    let mut string_bytes = vec![0_u8; string_length];
    read_exact_at(source, header.string_table_offset, &mut string_bytes)?;
    let strings = decode_string_table(&string_bytes)?;
    let mut quantization_bytes = [0_u8; QUANT_RECORD_BYTES];
    read_exact_at(source, header.quant_table_offset, &mut quantization_bytes)?;
    decode_quantization_record(&quantization_bytes, &strings)?;

    let mut tensors = Vec::with_capacity(header.tensor_count as usize);
    for index in 0..header.tensor_count {
        let record_offset = header
            .tensor_table_offset
            .checked_add(u64::from(index) * TENSOR_RECORD_BYTES as u64)
            .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
        let mut record = [0_u8; TENSOR_RECORD_BYTES];
        read_exact_at(source, record_offset, &mut record)?;
        tensors.push(decode_tensor_record(
            &record,
            header.payload_offset,
            &strings,
        )?);
    }
    validate_tensor_order(&tensors)?;

    let layout_specs: Vec<TensorSpec> = tensors
        .iter()
        .map(validated_tensor_spec)
        .collect::<Result<_, _>>()?;
    let layout_refs: Vec<&TensorSpec> = layout_specs.iter().collect();
    validate_tensor_registry(&spec, &layout_refs)?;
    let actual_layout_sha256 = hash_tensor_layout(spec.artifact_class, &layout_refs)?;
    if actual_layout_sha256 != expected_layout_sha256 {
        return Err(Slm2Error::new("slm2-layout-hash-drift"));
    }

    let mut cursor = header.payload_offset;
    let mut buffer = vec![0_u8; STREAM_BUFFER_BYTES];
    for tensor in &tensors {
        let expected_offset = align_up(cursor, u64::from(tensor.payload_alignment))?;
        if tensor.payload_offset != expected_offset {
            return Err(Slm2Error::new("slm2-invalid-payload-layout"));
        }
        validate_zero_range(source, cursor, tensor.payload_offset, &mut buffer)?;
        let spec_for_hash = validated_tensor_spec(tensor)?;
        let actual_hash = scan_tensor_at(
            source,
            spec.artifact_class,
            &spec_for_hash,
            validated_tensor_storage(tensor),
            tensor.payload_offset,
            tensor.payload_length,
            &mut buffer,
        )?;
        if actual_hash != tensor.payload_sha256 {
            return Err(Slm2Error::new("slm2-payload-hash-drift"));
        }
        cursor = checked_end(tensor.payload_offset, tensor.payload_length)?;
    }
    if cursor != actual_size {
        return Err(Slm2Error::new("slm2-trailing-bytes"));
    }

    let artifact_sha256 = hash_entire_source(source, actual_size, &mut buffer)?;
    Ok(ValidatedModel {
        identity: ModelIdentity {
            byte_length: actual_size,
            artifact_sha256,
            manifest_sha256,
        },
        spec,
        tensor_layout_sha256: actual_layout_sha256,
        tensors,
    })
}

fn encode_manifest(
    spec: &ModelSpec,
    tensor_layout_sha256: &[u8; 32],
) -> Result<Vec<u8>, Slm2Error> {
    let body = cbor::map(vec![
        (
            "activation_profile",
            Value::Text(ACTIVATION_PROFILE.to_owned()),
        ),
        (
            "architecture_profile",
            Value::Text(ARCHITECTURE_PROFILE.to_owned()),
        ),
        (
            "attention_profile",
            Value::Text(ATTENTION_PROFILE.to_owned()),
        ),
        (
            "context_length",
            Value::Unsigned(u64::from(spec.context_length)),
        ),
        (
            "embedding_size",
            Value::Unsigned(u64::from(spec.embedding_size)),
        ),
        (
            "feed_forward_size",
            Value::Unsigned(u64::from(spec.feed_forward_size)),
        ),
        ("head_count", Value::Unsigned(u64::from(spec.head_count))),
        (
            "head_dimension",
            Value::Unsigned(u64::from(spec.head_dimension)),
        ),
        (
            "kv_head_count",
            Value::Unsigned(u64::from(spec.kv_head_count)),
        ),
        ("layer_count", Value::Unsigned(u64::from(spec.layer_count))),
        (
            "normalization_epsilon_bits",
            Value::Unsigned(u64::from(spec.normalization_epsilon.to_bits())),
        ),
        (
            "normalization_profile",
            Value::Text(NORMALIZATION_PROFILE.to_owned()),
        ),
        ("position_profile", Value::Text(POSITION_PROFILE.to_owned())),
        (
            "rope_theta_bits",
            Value::Unsigned(u64::from(spec.rope_theta.to_bits())),
        ),
        ("qk_normalization", Value::Bool(spec.qk_normalization)),
        ("qkv_bias", Value::Bool(spec.qkv_bias)),
        (
            "tensor_layout_sha256",
            Value::Bytes(tensor_layout_sha256.to_vec()),
        ),
        ("tied_embeddings", Value::Bool(spec.tied_embeddings)),
        (
            "vocabulary_size",
            Value::Unsigned(u64::from(spec.vocabulary_size)),
        ),
    ]);
    let requirements = cbor::map(vec![
        ("kv_profile", Value::Text(KV_PROFILE.to_owned())),
        ("minimum_runtime", Value::Text(MINIMUM_RUNTIME.to_owned())),
        ("operator_profile", Value::Text(OPERATOR_PROFILE.to_owned())),
        (
            "tensor_role_profile",
            Value::Text(TENSOR_ROLE_PROFILE.to_owned()),
        ),
        ("tensor_profile", Value::Text(TENSOR_PROFILE.to_owned())),
    ]);
    let manifest = cbor::map(vec![
        (
            "artifact_class",
            Value::Unsigned(u64::from(spec.artifact_class as u16)),
        ),
        ("body", body),
        ("dependencies", Value::Array(Vec::new())),
        ("extensions", Value::Array(Vec::new())),
        ("requirements", requirements),
        ("schema", Value::Text(SCHEMA.to_owned())),
    ]);
    cbor::encode(&manifest, cbor::PROFILE_LIMITS)
}

fn decode_manifest(
    bytes: &[u8],
    header_class: ArtifactClass,
) -> Result<(ModelSpec, [u8; 32]), Slm2Error> {
    let value = cbor::decode_exact(bytes, cbor::PROFILE_LIMITS)?;
    let top = exact_map(
        &value,
        &[
            "artifact_class",
            "body",
            "dependencies",
            "extensions",
            "requirements",
            "schema",
        ],
    )?;
    let class_value = required(top, "artifact_class")?.as_unsigned()?;
    let class = ArtifactClass::from_u16(
        u16::try_from(class_value).map_err(|_| Slm2Error::new("slm2-invalid-model-metadata"))?,
    )?;
    if class != header_class
        || required(top, "schema")?.as_text()? != SCHEMA
        || !required(top, "dependencies")?.as_array()?.is_empty()
        || !required(top, "extensions")?.as_array()?.is_empty()
    {
        return Err(Slm2Error::new("slm2-invalid-model-metadata"));
    }

    let requirements = exact_map(
        required(top, "requirements")?,
        &[
            "kv_profile",
            "minimum_runtime",
            "operator_profile",
            "tensor_role_profile",
            "tensor_profile",
        ],
    )?;
    for (key, literal) in [
        ("kv_profile", KV_PROFILE),
        ("minimum_runtime", MINIMUM_RUNTIME),
        ("operator_profile", OPERATOR_PROFILE),
        ("tensor_role_profile", TENSOR_ROLE_PROFILE),
        ("tensor_profile", TENSOR_PROFILE),
    ] {
        if required(requirements, key)?.as_text()? != literal {
            return Err(Slm2Error::new("slm2-invalid-model-metadata"));
        }
    }

    let body = exact_map(
        required(top, "body")?,
        &[
            "activation_profile",
            "architecture_profile",
            "attention_profile",
            "context_length",
            "embedding_size",
            "feed_forward_size",
            "head_count",
            "head_dimension",
            "kv_head_count",
            "layer_count",
            "normalization_epsilon_bits",
            "normalization_profile",
            "position_profile",
            "qk_normalization",
            "qkv_bias",
            "rope_theta_bits",
            "tensor_layout_sha256",
            "tied_embeddings",
            "vocabulary_size",
        ],
    )?;
    for (key, literal) in [
        ("activation_profile", ACTIVATION_PROFILE),
        ("architecture_profile", ARCHITECTURE_PROFILE),
        ("attention_profile", ATTENTION_PROFILE),
        ("normalization_profile", NORMALIZATION_PROFILE),
        ("position_profile", POSITION_PROFILE),
    ] {
        if required(body, key)?.as_text()? != literal {
            return Err(Slm2Error::new("slm2-invalid-model-metadata"));
        }
    }
    let spec = ModelSpec {
        artifact_class: class,
        vocabulary_size: positive_u32(body, "vocabulary_size")?,
        context_length: positive_u32(body, "context_length")?,
        embedding_size: positive_u32(body, "embedding_size")?,
        feed_forward_size: positive_u32(body, "feed_forward_size")?,
        layer_count: positive_u32(body, "layer_count")?,
        head_count: positive_u32(body, "head_count")?,
        kv_head_count: positive_u32(body, "kv_head_count")?,
        head_dimension: positive_u32(body, "head_dimension")?,
        rope_theta: positive_f32_bits(body, "rope_theta_bits")?,
        normalization_epsilon: positive_f32_bits(body, "normalization_epsilon_bits")?,
        tied_embeddings: required(body, "tied_embeddings")?.as_bool()?,
        qkv_bias: required(body, "qkv_bias")?.as_bool()?,
        qk_normalization: required(body, "qk_normalization")?.as_bool()?,
    };
    spec.validate()?;
    let digest_bytes = required(body, "tensor_layout_sha256")?.as_bytes()?;
    let digest: [u8; 32] = digest_bytes
        .try_into()
        .map_err(|_| Slm2Error::new("slm2-invalid-model-metadata"))?;
    if digest == [0_u8; 32] {
        return Err(Slm2Error::new("slm2-invalid-model-metadata"));
    }
    Ok((spec, digest))
}

fn validate_tensor_registry(spec: &ModelSpec, actual: &[&TensorSpec]) -> Result<(), Slm2Error> {
    let expected = required_model_tensors(spec, 64)
        .map_err(|_| Slm2Error::new("slm2-invalid-tensor-registry"))?;
    if actual.len() != expected.len()
        || actual.iter().zip(&expected).any(|(actual, expected)| {
            actual.semantic_role != expected.semantic_role
                || actual.canonical_name != expected.canonical_name
                || actual.layer != expected.layer
                || actual.subindex_0 != -1
                || actual.subindex_1 != -1
                || actual.shape() != expected.shape()
        })
    {
        return Err(Slm2Error::new("slm2-invalid-tensor-registry"));
    }
    Ok(())
}

fn exact_map<'a>(value: &'a Value, expected: &[&str]) -> Result<&'a [(String, Value)], Slm2Error> {
    let entries = value.as_map()?;
    if entries.len() != expected.len()
        || entries
            .iter()
            .any(|(key, _)| !expected.iter().any(|expected_key| key == expected_key))
    {
        return Err(Slm2Error::new("slm2-invalid-model-metadata"));
    }
    Ok(entries)
}

fn required<'a>(entries: &'a [(String, Value)], key: &str) -> Result<&'a Value, Slm2Error> {
    entries
        .iter()
        .find_map(|(candidate, value)| (candidate == key).then_some(value))
        .ok_or_else(|| Slm2Error::new("slm2-invalid-model-metadata"))
}

fn positive_u32(entries: &[(String, Value)], key: &str) -> Result<u32, Slm2Error> {
    let value = u32::try_from(required(entries, key)?.as_unsigned()?)
        .map_err(|_| Slm2Error::new("slm2-invalid-model-metadata"))?;
    if value == 0 {
        return Err(Slm2Error::new("slm2-invalid-model-metadata"));
    }
    Ok(value)
}

fn positive_f32_bits(entries: &[(String, Value)], key: &str) -> Result<f32, Slm2Error> {
    let bits = u32::try_from(required(entries, key)?.as_unsigned()?)
        .map_err(|_| Slm2Error::new("slm2-invalid-model-metadata"))?;
    let value = f32::from_bits(bits);
    if !value.is_finite() || value <= 0.0 {
        return Err(Slm2Error::new("slm2-invalid-model-metadata"));
    }
    Ok(value)
}

fn encode_string_table(strings: &[String]) -> Result<Vec<u8>, Slm2Error> {
    if strings.is_empty() || strings.len() > MAXIMUM_STRINGS as usize {
        return Err(Slm2Error::new("slm2-invalid-string-table"));
    }
    let mut pool = Vec::new();
    let mut offsets = Vec::with_capacity(strings.len() + 1);
    offsets.push(0_u32);
    let mut prior: Option<&[u8]> = None;
    for string in strings {
        if !is_machine_identifier(string) {
            return Err(Slm2Error::new("slm2-invalid-string-table"));
        }
        if prior.is_some_and(|value| value >= string.as_bytes()) {
            return Err(Slm2Error::new("slm2-invalid-string-table"));
        }
        pool.extend_from_slice(string.as_bytes());
        offsets.push(
            u32::try_from(pool.len()).map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?,
        );
        prior = Some(string.as_bytes());
    }
    let mut output = Vec::new();
    output.extend_from_slice(
        &u32::try_from(strings.len())
            .map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?
            .to_le_bytes(),
    );
    output.extend_from_slice(
        &u32::try_from(pool.len())
            .map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?
            .to_le_bytes(),
    );
    for offset in offsets {
        output.extend_from_slice(&offset.to_le_bytes());
    }
    output.extend_from_slice(&pool);
    if output.len() as u64 > MAXIMUM_STRING_TABLE_BYTES {
        return Err(Slm2Error::new("slm2-invalid-string-table"));
    }
    Ok(output)
}

fn decode_string_table(bytes: &[u8]) -> Result<Vec<Arc<str>>, Slm2Error> {
    if bytes.len() < 12 || bytes.len() as u64 > MAXIMUM_STRING_TABLE_BYTES {
        return Err(Slm2Error::new("slm2-invalid-string-table"));
    }
    let count = read_u32_slice(bytes, 0)?;
    let pool_length = read_u32_slice(bytes, 4)?;
    if count == 0 || count > MAXIMUM_STRINGS {
        return Err(Slm2Error::new("slm2-invalid-string-table"));
    }
    let offsets_bytes = u64::from(count)
        .checked_add(1)
        .and_then(|value| value.checked_mul(4))
        .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?;
    let pool_start = 8_u64
        .checked_add(offsets_bytes)
        .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?;
    let expected_length = pool_start
        .checked_add(u64::from(pool_length))
        .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?;
    if expected_length != bytes.len() as u64 || read_u32_slice(bytes, 8)? != 0 {
        return Err(Slm2Error::new("slm2-invalid-string-table"));
    }
    let pool_start =
        usize::try_from(pool_start).map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?;
    let mut strings = Vec::with_capacity(count as usize);
    let mut prior: Option<Arc<str>> = None;
    for index in 0..count {
        let start = read_u32_slice(bytes, 8 + index as usize * 4)?;
        let end = read_u32_slice(bytes, 8 + (index as usize + 1) * 4)?;
        if start >= end || end > pool_length {
            return Err(Slm2Error::new("slm2-invalid-string-table"));
        }
        let absolute_start = pool_start
            .checked_add(start as usize)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?;
        let absolute_end = pool_start
            .checked_add(end as usize)
            .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?;
        let string = std::str::from_utf8(
            bytes
                .get(absolute_start..absolute_end)
                .ok_or_else(|| Slm2Error::new("slm2-invalid-string-table"))?,
        )
        .map_err(|_| Slm2Error::new("slm2-invalid-string-table"))?;
        if !is_machine_identifier(string)
            || prior
                .as_deref()
                .is_some_and(|prior_value| prior_value.as_bytes() >= string.as_bytes())
        {
            return Err(Slm2Error::new("slm2-invalid-string-table"));
        }
        let owned: Arc<str> = Arc::from(string);
        prior = Some(Arc::clone(&owned));
        strings.push(owned);
    }
    if read_u32_slice(bytes, 8 + count as usize * 4)? != pool_length {
        return Err(Slm2Error::new("slm2-invalid-string-table"));
    }
    Ok(strings)
}

fn encode_quantization_record(
    string_ids: &BTreeMap<&str, u32>,
) -> Result<[u8; QUANT_RECORD_BYTES], Slm2Error> {
    let mut bytes = [0_u8; QUANT_RECORD_BYTES];
    put_u16(&mut bytes, 0, 1)?;
    for (offset, profile) in [
        (4, WEIGHT_PROFILE),
        (8, QUANTIZER_PROFILE),
        (12, SCALAR_KERNEL_PROFILE),
        (16, TENSOR_ROLE_PROFILE),
    ] {
        put_u32(
            &mut bytes,
            offset,
            *string_ids
                .get(profile)
                .ok_or_else(|| Slm2Error::new("slm2-invalid-quantization"))?,
        )?;
    }
    put_u16(&mut bytes, 20, ElementType::F32 as u16)?;
    put_u16(&mut bytes, 22, ElementType::Q8RowSymmetric as u16)?;
    put_u16(&mut bytes, 24, 8)?;
    put_u16(&mut bytes, 26, 1)?;
    put_i16(&mut bytes, 28, -127)?;
    put_i16(&mut bytes, 30, 127)?;
    put_u16(&mut bytes, 32, 1)?;
    put_u16(&mut bytes, 36, 1)?;
    put_u16(&mut bytes, 38, 1)?;
    put_u16(&mut bytes, 40, 1)?;
    put_u16(&mut bytes, 42, 1)?;
    put_u32(&mut bytes, 48, 127.0_f32.to_bits())?;
    put_u32(&mut bytes, 52, 1.0_f32.to_bits())?;
    Ok(bytes)
}

fn decode_quantization_record(
    bytes: &[u8; QUANT_RECORD_BYTES],
    strings: &[Arc<str>],
) -> Result<(), Slm2Error> {
    if read_u16(bytes, 0)? != 1
        || read_u16(bytes, 2)? != 0
        || read_u16(bytes, 20)? != ElementType::F32 as u16
        || read_u16(bytes, 22)? != ElementType::Q8RowSymmetric as u16
        || read_u16(bytes, 24)? != 8
        || read_u16(bytes, 26)? != 1
        || read_i16(bytes, 28)? != -127
        || read_i16(bytes, 30)? != 127
        || read_u16(bytes, 32)? != 1
        || read_u16(bytes, 34)? != 0
        || read_u16(bytes, 36)? != 1
        || read_u16(bytes, 38)? != 1
        || read_u16(bytes, 40)? != 1
        || read_u16(bytes, 42)? != 1
        || read_u16(bytes, 44)? != 0
        || read_u16(bytes, 46)? != 0
        || read_u32(bytes, 48)? != 127.0_f32.to_bits()
        || read_u32(bytes, 52)? != 1.0_f32.to_bits()
        || bytes[56..].iter().any(|byte| *byte != 0)
    {
        return Err(Slm2Error::new("slm2-invalid-quantization"));
    }
    for (offset, expected) in [
        (4, WEIGHT_PROFILE),
        (8, QUANTIZER_PROFILE),
        (12, SCALAR_KERNEL_PROFILE),
        (16, TENSOR_ROLE_PROFILE),
    ] {
        let id = read_u32(bytes, offset)?;
        if strings.get(id as usize).map(AsRef::as_ref) != Some(expected) {
            return Err(Slm2Error::new("slm2-invalid-quantization"));
        }
    }
    Ok(())
}

fn encode_tensor_table(tensors: &[PreparedTensor]) -> Result<Vec<u8>, Slm2Error> {
    let length = tensors
        .len()
        .checked_mul(TENSOR_RECORD_BYTES)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    let mut output = vec![0_u8; length];
    for (index, tensor) in tensors.iter().enumerate() {
        let start = index * TENSOR_RECORD_BYTES;
        let record = &mut output[start..start + TENSOR_RECORD_BYTES];
        put_u16(record, 0, 1)?;
        record[2] = tensor.spec.rank;
        put_u16(record, 4, tensor.storage.element_type as u16)?;
        put_u16(record, 6, tensor.storage.quant_profile_index)?;
        put_u32(record, 8, tensor.role_string_id)?;
        put_u32(record, 12, tensor.name_string_id)?;
        put_i32(record, 16, tensor.spec.layer)?;
        put_i32(record, 20, tensor.spec.subindex_0)?;
        put_i32(record, 24, tensor.spec.subindex_1)?;
        for (dimension_index, dimension) in tensor.spec.shape.iter().enumerate() {
            put_u64(record, 32 + dimension_index * 8, *dimension)?;
        }
        put_u64(record, 96, tensor.logical_elements)?;
        put_u64(record, 104, tensor.storage.stored_bytes)?;
        put_u64(record, 112, tensor.payload_relative_offset)?;
        put_u64(record, 120, tensor.payload_length)?;
        put_u32(record, 128, tensor.spec.payload_alignment)?;
        put_u32(record, 132, tensor.storage.block_elements)?;
        put_u32(record, 136, tensor.storage.block_bytes)?;
        put_u16(record, 140, tensor.storage.scale_type)?;
        put_u16(record, 142, tensor.storage.zero_point_type)?;
        put_u16(record, 144, tensor.storage.packing_order)?;
        put_u16(record, 146, tensor.storage.accumulator_type)?;
        put_u16(record, 148, tensor.storage.tail_rule)?;
        record[160..192].copy_from_slice(&tensor.payload_hash);
    }
    Ok(output)
}

fn decode_tensor_record(
    record: &[u8; TENSOR_RECORD_BYTES],
    payload_base: u64,
    strings: &[Arc<str>],
) -> Result<ValidatedTensor, Slm2Error> {
    if read_u16(record, 0)? != 1
        || record[3] != 0
        || read_u32(record, 28)? != 0
        || read_u16(record, 150)? != 0
        || read_u32(record, 152)? != 0
        || read_u32(record, 156)? != 0
    {
        return Err(Slm2Error::new("slm2-invalid-tensor"));
    }
    let rank = record[2];
    if rank > 8 {
        return Err(Slm2Error::new("slm2-invalid-tensor"));
    }
    let role_id = read_u32(record, 8)?;
    let name_id = read_u32(record, 12)?;
    let semantic_role = strings
        .get(role_id as usize)
        .cloned()
        .ok_or_else(|| Slm2Error::new("slm2-invalid-tensor"))?;
    let canonical_name = strings
        .get(name_id as usize)
        .cloned()
        .ok_or_else(|| Slm2Error::new("slm2-invalid-tensor"))?;
    let layer = read_i32(record, 16)?;
    let subindex_0 = read_i32(record, 20)?;
    let subindex_1 = read_i32(record, 24)?;
    let mut shape = [0_u64; 8];
    for (index, dimension) in shape.iter_mut().enumerate() {
        *dimension = read_u64(record, 32 + index * 8)?;
    }
    let spec = TensorSpec {
        semantic_role: semantic_role.to_string(),
        canonical_name: canonical_name.to_string(),
        layer,
        subindex_0,
        subindex_1,
        rank,
        shape,
        payload_alignment: read_u32(record, 128)?,
    };
    spec.validate()?;
    let logical_elements = spec.logical_elements()?;
    let expected_storage = spec.storage()?;
    let element_type = ElementType::from_u16(read_u16(record, 4)?)?;
    let quant_profile_index = read_u16(record, 6)?;
    let stored_bytes = read_u64(record, 104)?;
    let payload_length = read_u64(record, 120)?;
    if read_u64(record, 96)? != logical_elements
        || stored_bytes != payload_length
        || element_type != expected_storage.element_type
        || quant_profile_index != expected_storage.quant_profile_index
        || stored_bytes != expected_storage.stored_bytes
        || read_u32(record, 132)? != expected_storage.block_elements
        || read_u32(record, 136)? != expected_storage.block_bytes
        || read_u16(record, 140)? != expected_storage.scale_type
        || read_u16(record, 142)? != expected_storage.zero_point_type
        || read_u16(record, 144)? != expected_storage.packing_order
        || read_u16(record, 146)? != expected_storage.accumulator_type
        || read_u16(record, 148)? != expected_storage.tail_rule
    {
        return Err(Slm2Error::new("slm2-invalid-tensor-encoding"));
    }
    let payload_offset = payload_base
        .checked_add(read_u64(record, 112)?)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    let payload_sha256: [u8; 32] = record[160..192]
        .try_into()
        .map_err(|_| Slm2Error::new("slm2-invalid-tensor"))?;
    if payload_sha256 == [0_u8; 32] {
        return Err(Slm2Error::new("slm2-invalid-tensor"));
    }
    Ok(ValidatedTensor {
        semantic_role,
        canonical_name,
        layer,
        subindex_0,
        subindex_1,
        rank,
        shape,
        logical_elements,
        element_type,
        quant_profile_index,
        stored_bytes,
        payload_offset,
        payload_length,
        payload_alignment: spec.payload_alignment,
        block_elements: expected_storage.block_elements,
        block_bytes: expected_storage.block_bytes,
        scale_type: expected_storage.scale_type,
        zero_point_type: expected_storage.zero_point_type,
        packing_order: expected_storage.packing_order,
        accumulator_type: expected_storage.accumulator_type,
        tail_rule: expected_storage.tail_rule,
        payload_sha256,
    })
}

fn encode_header(header: Header) -> Result<[u8; HEADER_BYTES], Slm2Error> {
    let mut bytes = [0_u8; HEADER_BYTES];
    bytes[0..8].copy_from_slice(&MAGIC);
    bytes[8..24].copy_from_slice(&FORMAT_ID);
    put_u32(&mut bytes, 24, HEADER_BYTES as u32)?;
    put_u16(&mut bytes, 28, 2)?;
    put_u16(&mut bytes, 30, 0)?;
    put_u32(&mut bytes, 32, 0x0102_0304)?;
    put_u16(&mut bytes, 36, header.artifact_class as u16)?;
    put_u64(&mut bytes, 40, header.file_size)?;
    put_u64(&mut bytes, 48, header.manifest_offset)?;
    put_u64(&mut bytes, 56, header.manifest_length)?;
    put_u64(&mut bytes, 64, header.string_table_offset)?;
    put_u64(&mut bytes, 72, header.string_table_length)?;
    put_u64(&mut bytes, 80, header.quant_table_offset)?;
    put_u32(&mut bytes, 88, 1)?;
    put_u32(&mut bytes, 92, QUANT_RECORD_BYTES as u32)?;
    put_u64(&mut bytes, 96, header.tensor_table_offset)?;
    put_u32(&mut bytes, 104, header.tensor_count)?;
    put_u32(&mut bytes, 108, TENSOR_RECORD_BYTES as u32)?;
    put_u64(&mut bytes, 144, header.payload_offset)?;
    put_u64(&mut bytes, 152, header.payload_length)?;
    Ok(bytes)
}

fn decode_header(
    bytes: &[u8; HEADER_BYTES],
    actual_size: u64,
    policy: ValidationPolicy,
) -> Result<Header, Slm2Error> {
    if bytes[0..8] != MAGIC {
        return Err(Slm2Error::new("slm2-invalid-magic"));
    }
    if bytes[8..24] != FORMAT_ID {
        return Err(Slm2Error::new("slm2-invalid-format-id"));
    }
    if read_u16(bytes, 28)? != 2 || read_u16(bytes, 30)? != 0 {
        return Err(Slm2Error::new("slm2-unsupported-version"));
    }
    if read_u32(bytes, 24)? != HEADER_BYTES as u32 {
        return Err(Slm2Error::new("slm2-invalid-header-size"));
    }
    if read_u32(bytes, 32)? != 0x0102_0304 {
        return Err(Slm2Error::new("slm2-invalid-byte-order"));
    }
    let artifact_class = ArtifactClass::from_u16(read_u16(bytes, 36)?)?;
    if read_u16(bytes, 38)? != 0 || bytes[160..224].iter().any(|byte| *byte != 0) {
        return Err(Slm2Error::new("slm2-invalid-header-flags"));
    }
    let file_size = read_u64(bytes, 40)?;
    if file_size != actual_size
        || file_size > policy.maximum_file_bytes
        || file_size > FORMAT_MAXIMUM_FILE_BYTES
    {
        return Err(Slm2Error::new("slm2-file-size-mismatch"));
    }
    if bytes[112..144].iter().any(|byte| *byte != 0) {
        return Err(Slm2Error::new("slm2-unsupported-table"));
    }
    let manifest_offset = read_u64(bytes, 48)?;
    let manifest_length = read_u64(bytes, 56)?;
    let string_table_offset = read_u64(bytes, 64)?;
    let string_table_length = read_u64(bytes, 72)?;
    let quant_table_offset = read_u64(bytes, 80)?;
    let quant_count = read_u32(bytes, 88)?;
    let quant_record_size = read_u32(bytes, 92)?;
    let tensor_table_offset = read_u64(bytes, 96)?;
    let tensor_count = read_u32(bytes, 104)?;
    let tensor_record_size = read_u32(bytes, 108)?;
    let payload_offset = read_u64(bytes, 144)?;
    let payload_length = read_u64(bytes, 152)?;
    if quant_count != 1 || quant_record_size != QUANT_RECORD_BYTES as u32 {
        return Err(Slm2Error::new("slm2-invalid-quantization"));
    }
    if manifest_length == 0
        || manifest_length > MAXIMUM_MANIFEST_BYTES
        || string_table_length == 0
        || string_table_length > MAXIMUM_STRING_TABLE_BYTES
        || tensor_count == 0
        || tensor_count > policy.maximum_tensors
        || tensor_count > MAXIMUM_TENSORS
        || tensor_record_size != TENSOR_RECORD_BYTES as u32
    {
        return Err(Slm2Error::new("slm2-invalid-section"));
    }
    let expected_manifest_offset = align_up(HEADER_BYTES as u64, SECTION_ALIGNMENT)?;
    let expected_string_offset = align_up(
        checked_end(manifest_offset, manifest_length)?,
        SECTION_ALIGNMENT,
    )?;
    let expected_quant_offset = align_up(
        checked_end(string_table_offset, string_table_length)?,
        SECTION_ALIGNMENT,
    )?;
    let tensor_table_length = u64::from(tensor_count)
        .checked_mul(TENSOR_RECORD_BYTES as u64)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    let expected_tensor_offset = align_up(
        checked_end(quant_table_offset, QUANT_RECORD_BYTES as u64)?,
        SECTION_ALIGNMENT,
    )?;
    let expected_payload_offset = align_up(
        checked_end(tensor_table_offset, tensor_table_length)?,
        SECTION_ALIGNMENT,
    )?;
    if manifest_offset != expected_manifest_offset
        || string_table_offset != expected_string_offset
        || quant_table_offset != expected_quant_offset
        || tensor_table_offset != expected_tensor_offset
        || payload_offset != expected_payload_offset
        || payload_length == 0
        || checked_end(payload_offset, payload_length)? != file_size
    {
        return Err(Slm2Error::new("slm2-invalid-section-layout"));
    }
    Ok(Header {
        artifact_class,
        file_size,
        manifest_offset,
        manifest_length,
        string_table_offset,
        string_table_length,
        quant_table_offset,
        tensor_table_offset,
        tensor_count,
        payload_offset,
        payload_length,
    })
}

fn validate_section_padding<R: Read + Seek>(
    source: &mut R,
    header: &Header,
) -> Result<(), Slm2Error> {
    let mut buffer = vec![0_u8; STREAM_BUFFER_BYTES];
    validate_zero_range(
        source,
        HEADER_BYTES as u64,
        header.manifest_offset,
        &mut buffer,
    )?;
    validate_zero_range(
        source,
        checked_end(header.manifest_offset, header.manifest_length)?,
        header.string_table_offset,
        &mut buffer,
    )?;
    validate_zero_range(
        source,
        checked_end(header.string_table_offset, header.string_table_length)?,
        header.quant_table_offset,
        &mut buffer,
    )?;
    validate_zero_range(
        source,
        checked_end(header.quant_table_offset, QUANT_RECORD_BYTES as u64)?,
        header.tensor_table_offset,
        &mut buffer,
    )?;
    let tensor_end = header
        .tensor_table_offset
        .checked_add(u64::from(header.tensor_count) * TENSOR_RECORD_BYTES as u64)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    validate_zero_range(source, tensor_end, header.payload_offset, &mut buffer)
}

fn validate_writer_uniqueness<R>(
    tensors: &[TensorInput<R>],
    order: &[usize],
) -> Result<(), Slm2Error> {
    let mut names = BTreeSet::new();
    let mut prior_key: Option<TensorSortKey> = None;
    for index in order {
        let spec = &tensors[*index].spec;
        let key = tensor_sort_key(spec);
        if prior_key.as_ref().is_some_and(|prior| prior >= &key)
            || !names.insert(spec.canonical_name.as_bytes())
        {
            return Err(Slm2Error::new("slm2-duplicate-tensor"));
        }
        prior_key = Some(key);
    }
    Ok(())
}

fn validate_tensor_order(tensors: &[ValidatedTensor]) -> Result<(), Slm2Error> {
    let mut names = BTreeSet::new();
    let mut prior: Option<TensorSortKey> = None;
    for tensor in tensors {
        let key = (
            tensor.semantic_role.as_bytes().to_vec(),
            tensor.layer,
            tensor.subindex_0,
            tensor.subindex_1,
            tensor.canonical_name.as_bytes().to_vec(),
        );
        if prior.as_ref().is_some_and(|value| value >= &key)
            || !names.insert(tensor.canonical_name.as_bytes())
        {
            return Err(Slm2Error::new("slm2-invalid-tensor-order"));
        }
        prior = Some(key);
    }
    Ok(())
}

fn tensor_sort_key(spec: &TensorSpec) -> TensorSortKey {
    (
        spec.semantic_role.as_bytes().to_vec(),
        spec.layer,
        spec.subindex_0,
        spec.subindex_1,
        spec.canonical_name.as_bytes().to_vec(),
    )
}

fn validated_tensor_spec(tensor: &ValidatedTensor) -> Result<TensorSpec, Slm2Error> {
    TensorSpec::new(
        tensor.semantic_role.to_string(),
        tensor.canonical_name.to_string(),
        tensor.layer,
        tensor.subindex_0,
        tensor.subindex_1,
        tensor.shape(),
        tensor.payload_alignment,
    )
}

fn validated_tensor_storage(tensor: &ValidatedTensor) -> TensorStorage {
    TensorStorage {
        element_type: tensor.element_type,
        quant_profile_index: tensor.quant_profile_index,
        stored_bytes: tensor.stored_bytes,
        block_elements: tensor.block_elements,
        block_bytes: tensor.block_bytes,
        scale_type: tensor.scale_type,
        zero_point_type: tensor.zero_point_type,
        packing_order: tensor.packing_order,
        accumulator_type: tensor.accumulator_type,
        tail_rule: tensor.tail_rule,
    }
}

fn hash_tensor_layout(
    artifact_class: ArtifactClass,
    tensors: &[&TensorSpec],
) -> Result<[u8; 32], Slm2Error> {
    let mut hasher = Sha256::new();
    hasher.update(TENSOR_LAYOUT_DOMAIN);
    hasher.update((artifact_class as u16).to_le_bytes());
    hasher.update(
        u32::try_from(tensors.len())
            .map_err(|_| Slm2Error::new("slm2-invalid-tensor-count"))?
            .to_le_bytes(),
    );
    for tensor in tensors {
        update_tensor_descriptor(&mut hasher, tensor, tensor.storage()?)?;
    }
    Ok(hasher.finalize().into())
}

fn tensor_payload_hasher(
    artifact_class: ArtifactClass,
    spec: &TensorSpec,
    storage: TensorStorage,
    payload_length: u64,
) -> Result<Sha256, Slm2Error> {
    let mut hasher = Sha256::new();
    hasher.update(TENSOR_PAYLOAD_DOMAIN);
    hasher.update((artifact_class as u16).to_le_bytes());
    update_tensor_descriptor(&mut hasher, spec, storage)?;
    hasher.update(payload_length.to_le_bytes());
    Ok(hasher)
}

fn update_tensor_descriptor(
    hasher: &mut Sha256,
    spec: &TensorSpec,
    storage: TensorStorage,
) -> Result<(), Slm2Error> {
    update_identifier(hasher, &spec.semantic_role)?;
    update_identifier(hasher, &spec.canonical_name)?;
    hasher.update(spec.layer.to_le_bytes());
    hasher.update(spec.subindex_0.to_le_bytes());
    hasher.update(spec.subindex_1.to_le_bytes());
    hasher.update(u32::from(spec.rank).to_le_bytes());
    for dimension in spec.shape {
        hasher.update(dimension.to_le_bytes());
    }
    hasher.update(spec.logical_elements()?.to_le_bytes());
    hasher.update((storage.element_type as u16).to_le_bytes());
    hasher.update(storage.quant_profile_index.to_le_bytes());
    hasher.update(storage.stored_bytes.to_le_bytes());
    hasher.update(spec.payload_alignment.to_le_bytes());
    hasher.update(storage.block_elements.to_le_bytes());
    hasher.update(storage.block_bytes.to_le_bytes());
    hasher.update(storage.scale_type.to_le_bytes());
    hasher.update(storage.zero_point_type.to_le_bytes());
    hasher.update(storage.packing_order.to_le_bytes());
    hasher.update(storage.accumulator_type.to_le_bytes());
    hasher.update(storage.tail_rule.to_le_bytes());
    hasher.update([0_u8]);
    hasher.update(0_u16.to_le_bytes());
    hasher.update(0_u32.to_le_bytes());
    hasher.update(0_u32.to_le_bytes());
    Ok(())
}

fn update_identifier(hasher: &mut Sha256, value: &str) -> Result<(), Slm2Error> {
    hasher.update(
        u32::try_from(value.len())
            .map_err(|_| Slm2Error::new("slm2-invalid-identifier"))?
            .to_le_bytes(),
    );
    hasher.update(value.as_bytes());
    Ok(())
}

fn scan_tensor_source<R: Read + Seek>(
    reader: &mut R,
    artifact_class: ArtifactClass,
    spec: &TensorSpec,
    source_length: u64,
    storage: TensorStorage,
    buffer: &mut [u8],
) -> Result<([u8; 32], [u8; 32]), Slm2Error> {
    process_tensor_source(
        reader,
        artifact_class,
        spec,
        source_length,
        storage,
        buffer,
        |_| Ok(()),
    )
}

fn copy_tensor_source<R: Read + Seek, W: Write>(
    reader: &mut R,
    output: &mut HashedOutput<'_, W>,
    artifact_class: ArtifactClass,
    spec: &TensorSpec,
    source_length: u64,
    storage: TensorStorage,
    buffer: &mut [u8],
) -> Result<([u8; 32], [u8; 32]), Slm2Error> {
    process_tensor_source(
        reader,
        artifact_class,
        spec,
        source_length,
        storage,
        buffer,
        |chunk| output.write_all(chunk),
    )
}

fn scan_tensor_at<R: Read + Seek>(
    source: &mut R,
    artifact_class: ArtifactClass,
    spec: &TensorSpec,
    storage: TensorStorage,
    offset: u64,
    payload_length: u64,
    buffer: &mut [u8],
) -> Result<[u8; 32], Slm2Error> {
    source
        .seek(SeekFrom::Start(offset))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    let mut hasher = tensor_payload_hasher(artifact_class, spec, storage, payload_length)?;
    match storage.element_type {
        ElementType::F32 => stream_f32_bytes(source, payload_length, buffer, |chunk| {
            hasher.update(chunk);
            Ok(())
        })?,
        ElementType::Q8RowSymmetric => {
            validate_q8_payload(source, spec, storage, buffer, |chunk| {
                hasher.update(chunk);
                Ok(())
            })?;
        }
    }
    Ok(hasher.finalize().into())
}

fn process_tensor_source<R, F>(
    reader: &mut R,
    artifact_class: ArtifactClass,
    spec: &TensorSpec,
    source_length: u64,
    storage: TensorStorage,
    buffer: &mut [u8],
    mut output_visitor: F,
) -> Result<([u8; 32], [u8; 32]), Slm2Error>
where
    R: Read + Seek,
    F: FnMut(&[u8]) -> Result<(), Slm2Error>,
{
    if source_length != spec.expected_source_bytes()? || storage != spec.storage()? {
        return Err(Slm2Error::new("slm2-tensor-size-mismatch"));
    }
    let mut payload_hasher =
        tensor_payload_hasher(artifact_class, spec, storage, storage.stored_bytes)?;
    let mut source_hasher = Sha256::new();
    match storage.element_type {
        ElementType::F32 => {
            reader
                .seek(SeekFrom::Start(0))
                .map_err(|_| Slm2Error::new("slm2-io"))?;
            stream_f32_bytes(reader, source_length, buffer, |chunk| {
                source_hasher.update(chunk);
                payload_hasher.update(chunk);
                output_visitor(chunk)
            })?;
        }
        ElementType::Q8RowSymmetric => {
            quantize_q8_source(
                reader,
                spec,
                source_length,
                buffer,
                &mut source_hasher,
                |chunk| {
                    payload_hasher.update(chunk);
                    output_visitor(chunk)
                },
            )?;
        }
    }
    Ok((
        payload_hasher.finalize().into(),
        source_hasher.finalize().into(),
    ))
}

fn stream_f32_bytes<R, F>(
    reader: &mut R,
    length: u64,
    buffer: &mut [u8],
    mut visitor: F,
) -> Result<(), Slm2Error>
where
    R: Read,
    F: FnMut(&[u8]) -> Result<(), Slm2Error>,
{
    if buffer.is_empty() || !buffer.len().is_multiple_of(4) || !length.is_multiple_of(4) {
        return Err(Slm2Error::new("slm2-invalid-stream-buffer"));
    }
    let mut remaining = length;
    while remaining > 0 {
        let count = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
        reader
            .read_exact(&mut buffer[..count])
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        for bytes in buffer[..count].chunks_exact(4) {
            let bits = u32::from_le_bytes(
                bytes
                    .try_into()
                    .map_err(|_| Slm2Error::new("slm2-invalid-f32"))?,
            );
            if !f32::from_bits(bits).is_finite() {
                return Err(Slm2Error::new("slm2-nonfinite-f32"));
            }
        }
        visitor(&buffer[..count])?;
        remaining -= count as u64;
    }
    Ok(())
}

fn quantize_q8_source<R, F>(
    reader: &mut R,
    spec: &TensorSpec,
    source_length: u64,
    buffer: &mut [u8],
    source_hasher: &mut Sha256,
    mut visitor: F,
) -> Result<(), Slm2Error>
where
    R: Read + Seek,
    F: FnMut(&[u8]) -> Result<(), Slm2Error>,
{
    if spec.rank != 2
        || buffer.is_empty()
        || !buffer.len().is_multiple_of(4)
        || source_length != spec.expected_source_bytes()?
    {
        return Err(Slm2Error::new("slm2-invalid-stream-buffer"));
    }
    let rows = spec.shape[0];
    let columns = spec.shape[1];
    let row_source_bytes = columns
        .checked_mul(4)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    let mut code_buffer = vec![0_u8; (buffer.len() / 4).max(1)];
    for row in 0..rows {
        let row_offset = row
            .checked_mul(row_source_bytes)
            .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
        reader
            .seek(SeekFrom::Start(row_offset))
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        let mut remaining = row_source_bytes;
        let mut maximum = 0.0_f32;
        while remaining > 0 {
            let count = usize::try_from(remaining.min(buffer.len() as u64))
                .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
            reader
                .read_exact(&mut buffer[..count])
                .map_err(|_| Slm2Error::new("slm2-io"))?;
            source_hasher.update(&buffer[..count]);
            for raw in buffer[..count].chunks_exact(4) {
                let value = f32::from_le_bytes(
                    raw.try_into()
                        .map_err(|_| Slm2Error::new("slm2-invalid-f32"))?,
                );
                if !value.is_finite() {
                    return Err(Slm2Error::new("slm2-nonfinite-f32"));
                }
                maximum = maximum.max(value.abs());
            }
            remaining -= count as u64;
        }
        let scale = q8_scale_from_maximum(maximum)?;
        visitor(&scale.to_le_bytes())?;
        reader
            .seek(SeekFrom::Start(row_offset))
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        let mut remaining = row_source_bytes;
        while remaining > 0 {
            let count = usize::try_from(remaining.min(buffer.len() as u64))
                .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
            reader
                .read_exact(&mut buffer[..count])
                .map_err(|_| Slm2Error::new("slm2-io"))?;
            let code_count = count / 4;
            for (index, raw) in buffer[..count].chunks_exact(4).enumerate() {
                let value = f32::from_le_bytes(
                    raw.try_into()
                        .map_err(|_| Slm2Error::new("slm2-invalid-f32"))?,
                );
                let code = quantize_q8_value(value, scale)?;
                code_buffer[index] = code as u8;
            }
            visitor(&code_buffer[..code_count])?;
            remaining -= count as u64;
        }
    }
    Ok(())
}

fn validate_q8_payload<R, F>(
    reader: &mut R,
    spec: &TensorSpec,
    storage: TensorStorage,
    buffer: &mut [u8],
    mut visitor: F,
) -> Result<(), Slm2Error>
where
    R: Read,
    F: FnMut(&[u8]) -> Result<(), Slm2Error>,
{
    if spec.rank != 2 || storage != spec.storage()? || buffer.is_empty() {
        return Err(Slm2Error::new("slm2-invalid-q8-payload"));
    }
    let rows = spec.shape[0];
    let columns = spec.shape[1];
    let mut codes = vec![
        0_u8;
        buffer
            .len()
            .min(usize::try_from(columns).unwrap_or(usize::MAX).max(1),)
    ];
    for _ in 0..rows {
        let mut scale_bytes = [0_u8; 4];
        reader
            .read_exact(&mut scale_bytes)
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        let scale = f32::from_le_bytes(scale_bytes);
        if !scale.is_finite() || scale <= 0.0 || scale.to_bits() == (-0.0_f32).to_bits() {
            return Err(Slm2Error::new("slm2-invalid-q8-payload"));
        }
        visitor(&scale_bytes)?;
        let mut remaining = columns;
        let mut all_zero = true;
        while remaining > 0 {
            let count = usize::try_from(remaining.min(codes.len() as u64))
                .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
            reader
                .read_exact(&mut codes[..count])
                .map_err(|_| Slm2Error::new("slm2-io"))?;
            if codes[..count].contains(&(i8::MIN as u8)) {
                return Err(Slm2Error::new("slm2-invalid-q8-payload"));
            }
            all_zero &= codes[..count].iter().all(|byte| *byte == 0);
            visitor(&codes[..count])?;
            remaining -= count as u64;
        }
        if all_zero && u32::from_le_bytes(scale_bytes) != 1.0_f32.to_bits() {
            return Err(Slm2Error::new("slm2-invalid-q8-payload"));
        }
    }
    Ok(())
}

fn hash_entire_source<R: Read + Seek>(
    source: &mut R,
    length: u64,
    buffer: &mut [u8],
) -> Result<[u8; 32], Slm2Error> {
    source
        .seek(SeekFrom::Start(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    let mut remaining = length;
    let mut hasher = Sha256::new();
    while remaining > 0 {
        let count = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
        source
            .read_exact(&mut buffer[..count])
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        hasher.update(&buffer[..count]);
        remaining -= count as u64;
    }
    Ok(hasher.finalize().into())
}

fn validate_zero_range<R: Read + Seek>(
    source: &mut R,
    start: u64,
    end: u64,
    buffer: &mut [u8],
) -> Result<(), Slm2Error> {
    if end < start {
        return Err(Slm2Error::new("slm2-invalid-section-layout"));
    }
    source
        .seek(SeekFrom::Start(start))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    let mut remaining = end - start;
    while remaining > 0 {
        let count = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
        source
            .read_exact(&mut buffer[..count])
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        if buffer[..count].iter().any(|byte| *byte != 0) {
            return Err(Slm2Error::new("slm2-nonzero-padding"));
        }
        remaining -= count as u64;
    }
    Ok(())
}

fn source_length<R: Seek>(reader: &mut R) -> Result<u64, Slm2Error> {
    let length = reader
        .seek(SeekFrom::End(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    reader
        .seek(SeekFrom::Start(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    Ok(length)
}

fn read_exact_at<R: Read + Seek>(
    source: &mut R,
    offset: u64,
    output: &mut [u8],
) -> Result<(), Slm2Error> {
    source
        .seek(SeekFrom::Start(offset))
        .and_then(|_| source.read_exact(output))
        .map_err(|_| Slm2Error::new("slm2-io"))
}

fn align_up(value: u64, alignment: u64) -> Result<u64, Slm2Error> {
    if alignment == 0 || !alignment.is_power_of_two() {
        return Err(Slm2Error::new("slm2-invalid-alignment"));
    }
    value
        .checked_add(alignment - 1)
        .map(|sum| sum & !(alignment - 1))
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))
}

fn checked_end(offset: u64, length: u64) -> Result<u64, Slm2Error> {
    offset
        .checked_add(length)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))
}

fn valid_tensor_alignment(value: u32) -> bool {
    (64..=4096).contains(&value) && value.is_power_of_two()
}

fn is_q8_role(role: &str) -> bool {
    matches!(
        role,
        "model.token-embedding.weight"
            | "model.output-projection.weight"
            | "layer.attention.query-projection.weight"
            | "layer.attention.key-projection.weight"
            | "layer.attention.value-projection.weight"
            | "layer.attention.output-projection.weight"
            | "layer.feed-forward.gate-projection.weight"
            | "layer.feed-forward.down-projection.weight"
            | "layer.feed-forward.up-projection.weight"
    )
}

fn is_f32_role(role: &str) -> bool {
    matches!(
        role,
        "model.final-normalization.weight"
            | "layer.attention-normalization.weight"
            | "layer.feed-forward-normalization.weight"
            | "layer.attention.query-normalization.weight"
            | "layer.attention.key-normalization.weight"
            | "layer.attention.query-projection.bias"
            | "layer.attention.key-projection.bias"
            | "layer.attention.value-projection.bias"
    )
}

fn is_machine_identifier(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.is_empty()
        || bytes.len() > 255
        || !bytes[0].is_ascii_lowercase() && !bytes[0].is_ascii_digit()
        || value.starts_with('/')
        || value.ends_with('/')
    {
        return false;
    }
    if bytes.iter().any(|byte| {
        !byte.is_ascii_lowercase()
            && !byte.is_ascii_digit()
            && !matches!(*byte, b'.' | b'_' | b'/' | b'-')
    }) {
        return false;
    }
    !value
        .split('/')
        .any(|component| component.is_empty() || component == "." || component == "..")
}

struct HashedOutput<'a, W> {
    inner: &'a mut W,
    hasher: Sha256,
    written: u64,
}

impl<'a, W: Write> HashedOutput<'a, W> {
    fn new(inner: &'a mut W) -> Self {
        Self {
            inner,
            hasher: Sha256::new(),
            written: 0,
        }
    }

    fn write_all(&mut self, bytes: &[u8]) -> Result<(), Slm2Error> {
        self.inner
            .write_all(bytes)
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        self.hasher.update(bytes);
        self.written = self
            .written
            .checked_add(bytes.len() as u64)
            .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
        Ok(())
    }

    fn write_zeros_to(&mut self, target: u64) -> Result<(), Slm2Error> {
        if target < self.written {
            return Err(Slm2Error::new("slm2-writer-layout-drift"));
        }
        let zeros = [0_u8; 4096];
        let mut remaining = target - self.written;
        while remaining > 0 {
            let count = usize::try_from(remaining.min(zeros.len() as u64))
                .map_err(|_| Slm2Error::new("slm2-offset-overflow"))?;
            self.write_all(&zeros[..count])?;
            remaining -= count as u64;
        }
        Ok(())
    }

    fn flush(&mut self) -> Result<(), Slm2Error> {
        self.inner.flush().map_err(|_| Slm2Error::new("slm2-io"))
    }

    fn finalize(self) -> [u8; 32] {
        self.hasher.finalize().into()
    }
}

fn put_u16(output: &mut [u8], offset: usize, value: u16) -> Result<(), Slm2Error> {
    put_bytes(output, offset, &value.to_le_bytes())
}

fn put_i16(output: &mut [u8], offset: usize, value: i16) -> Result<(), Slm2Error> {
    put_bytes(output, offset, &value.to_le_bytes())
}

fn put_u32(output: &mut [u8], offset: usize, value: u32) -> Result<(), Slm2Error> {
    put_bytes(output, offset, &value.to_le_bytes())
}

fn put_i32(output: &mut [u8], offset: usize, value: i32) -> Result<(), Slm2Error> {
    put_bytes(output, offset, &value.to_le_bytes())
}

fn put_u64(output: &mut [u8], offset: usize, value: u64) -> Result<(), Slm2Error> {
    put_bytes(output, offset, &value.to_le_bytes())
}

fn put_bytes(output: &mut [u8], offset: usize, value: &[u8]) -> Result<(), Slm2Error> {
    let end = offset
        .checked_add(value.len())
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    output
        .get_mut(offset..end)
        .ok_or_else(|| Slm2Error::new("slm2-invalid-header"))?
        .copy_from_slice(value);
    Ok(())
}

fn read_u16(input: &[u8], offset: usize) -> Result<u16, Slm2Error> {
    Ok(u16::from_le_bytes(read_array(input, offset)?))
}

fn read_i16(input: &[u8], offset: usize) -> Result<i16, Slm2Error> {
    Ok(i16::from_le_bytes(read_array(input, offset)?))
}

fn read_u32(input: &[u8], offset: usize) -> Result<u32, Slm2Error> {
    Ok(u32::from_le_bytes(read_array(input, offset)?))
}

fn read_i32(input: &[u8], offset: usize) -> Result<i32, Slm2Error> {
    Ok(i32::from_le_bytes(read_array(input, offset)?))
}

fn read_u64(input: &[u8], offset: usize) -> Result<u64, Slm2Error> {
    Ok(u64::from_le_bytes(read_array(input, offset)?))
}

fn read_u32_slice(input: &[u8], offset: usize) -> Result<u32, Slm2Error> {
    read_u32(input, offset).map_err(|_| Slm2Error::new("slm2-invalid-string-table"))
}

fn read_array<const N: usize>(input: &[u8], offset: usize) -> Result<[u8; N], Slm2Error> {
    let end = offset
        .checked_add(N)
        .ok_or_else(|| Slm2Error::new("slm2-offset-overflow"))?;
    input
        .get(offset..end)
        .ok_or_else(|| Slm2Error::new("slm2-invalid-header"))?
        .try_into()
        .map_err(|_| Slm2Error::new("slm2-invalid-header"))
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

    fn reference_spec() -> ModelSpec {
        ModelSpec {
            artifact_class: ArtifactClass::BaseModel,
            vocabulary_size: 32,
            context_length: 128,
            embedding_size: 8,
            feed_forward_size: 16,
            layer_count: 1,
            head_count: 2,
            kv_head_count: 1,
            head_dimension: 8,
            rope_theta: 10_000.0,
            normalization_epsilon: 0.000_01,
            tied_embeddings: true,
            qkv_bias: false,
            qk_normalization: false,
        }
    }

    fn f32_bytes(values: &[f32]) -> Vec<u8> {
        values
            .iter()
            .flat_map(|value| value.to_le_bytes())
            .collect()
    }

    fn reference_tensors() -> Vec<TensorInput<Cursor<Vec<u8>>>> {
        let mut tensors = required_model_tensors(&reference_spec(), 64)
            .unwrap()
            .into_iter()
            .enumerate()
            .map(|(tensor_index, spec)| {
                let count = usize::try_from(spec.logical_elements().unwrap()).unwrap();
                let values = (0..count)
                    .map(|value_index| (tensor_index * 10_000 + value_index + 1) as f32 / 1024.0)
                    .collect::<Vec<_>>();
                TensorInput::new(spec, Cursor::new(f32_bytes(&values)))
            })
            .collect::<Vec<_>>();
        tensors.reverse();
        tensors
    }

    fn write_fixture() -> (Vec<u8>, ModelIdentity) {
        let mut tensors = reference_tensors();
        let mut output = Cursor::new(Vec::new());
        let identity = write_model(&mut output, &reference_spec(), &mut tensors).unwrap();
        (output.into_inner(), identity)
    }

    #[test]
    fn writer_is_deterministic_and_reader_reproduces_every_identity() {
        let (first, identity) = write_fixture();
        let (second, second_identity) = write_fixture();
        assert_eq!(first, second);
        assert_eq!(identity, second_identity);
        let validated =
            validate_model(&mut Cursor::new(&first), ValidationPolicy::default()).unwrap();
        assert_eq!(validated.identity(), &identity);
        assert_eq!(validated.spec(), &reference_spec());
        assert_eq!(validated.tensors().len(), 11);
        assert!(validated
            .tensors()
            .iter()
            .any(|tensor| tensor.canonical_name() == "model.token-embedding.weight"));
        assert!(validated
            .tensors()
            .iter()
            .all(|tensor| tensor.payload_alignment() == 64));
    }

    #[test]
    fn reader_rejects_slm1_and_header_or_padding_mutation() {
        assert_eq!(
            validate_model(&mut Cursor::new(b"SLM1"), ValidationPolicy::default())
                .unwrap_err()
                .code(),
            "slm2-truncated-header"
        );
        let (bytes, _) = write_fixture();
        let mut wrong_magic = bytes.clone();
        wrong_magic[0] ^= 1;
        assert_eq!(
            validate_model(&mut Cursor::new(wrong_magic), ValidationPolicy::default())
                .unwrap_err()
                .code(),
            "slm2-invalid-magic"
        );
        let mut padding = bytes;
        padding[224] = 1;
        assert_eq!(
            validate_model(&mut Cursor::new(padding), ValidationPolicy::default())
                .unwrap_err()
                .code(),
            "slm2-nonzero-padding"
        );
    }

    #[test]
    fn reader_rejects_payload_hash_and_nonfinite_value_mutation() {
        let (bytes, _) = write_fixture();
        let payload_offset = u64::from_le_bytes(bytes[144..152].try_into().unwrap()) as usize;
        let tensor_table_offset = u64::from_le_bytes(bytes[96..104].try_into().unwrap()) as usize;
        let tensor_relative = u64::from_le_bytes(
            bytes[tensor_table_offset + 112..tensor_table_offset + 120]
                .try_into()
                .unwrap(),
        ) as usize;
        let offset = payload_offset + tensor_relative;

        let mut drift = bytes.clone();
        drift[offset] ^= 1;
        assert_eq!(
            validate_model(&mut Cursor::new(drift), ValidationPolicy::default())
                .unwrap_err()
                .code(),
            "slm2-payload-hash-drift"
        );

        let mut nonfinite = bytes;
        nonfinite[offset..offset + 4].copy_from_slice(&f32::NAN.to_bits().to_le_bytes());
        assert_eq!(
            validate_model(&mut Cursor::new(nonfinite), ValidationPolicy::default())
                .unwrap_err()
                .code(),
            "slm2-nonfinite-f32"
        );
    }

    #[test]
    fn writer_rejects_shape_size_nonfinite_and_duplicate_names() {
        let mut short = reference_tensors();
        short[0].reader = Cursor::new(Vec::new());
        assert_eq!(
            write_model(&mut Cursor::new(Vec::new()), &reference_spec(), &mut short,)
                .unwrap_err()
                .code(),
            "slm2-tensor-size-mismatch"
        );

        let mut nonfinite = reference_tensors();
        nonfinite[0].reader.get_mut()[..4].copy_from_slice(&f32::INFINITY.to_le_bytes());
        assert_eq!(
            write_model(
                &mut Cursor::new(Vec::new()),
                &reference_spec(),
                &mut nonfinite,
            )
            .unwrap_err()
            .code(),
            "slm2-nonfinite-f32"
        );

        let mut duplicate = reference_tensors();
        let duplicate_spec = duplicate[0].spec.clone();
        let duplicate_values = vec![0_u8; duplicate_spec.expected_source_bytes().unwrap() as usize];
        duplicate.push(TensorInput::new(
            duplicate_spec,
            Cursor::new(duplicate_values),
        ));
        assert_eq!(
            write_model(
                &mut Cursor::new(Vec::new()),
                &reference_spec(),
                &mut duplicate,
            )
            .unwrap_err()
            .code(),
            "slm2-duplicate-tensor"
        );
    }

    #[test]
    fn machine_identifier_and_checked_shapes_are_strict() {
        for name in ["", "/x", "x/", "x//y", "x/../y", "X", "x:y", "x y"] {
            assert!(TensorSpec::new("role", name, -1, -1, -1, &[1], 64).is_err());
        }
        assert!(TensorSpec::new("role", "name", -2, -1, -1, &[1], 64).is_err());
        assert!(TensorSpec::new("role", "name", -1, -1, -1, &[0], 64).is_err());
        assert!(TensorSpec::new("role", "name", -1, -1, -1, &[1], 96).is_err());
    }

    #[test]
    fn tensor_registry_is_exact_and_conditionally_complete() {
        let base = reference_spec();
        let tensors = required_model_tensors(&base, 256).unwrap();
        assert_eq!(tensors.len(), 11);
        assert!(tensors
            .iter()
            .all(|tensor| tensor.payload_alignment() == 256));
        assert!(!tensors
            .iter()
            .any(|tensor| tensor.semantic_role().ends_with(".bias")));

        let expanded = ModelSpec {
            tied_embeddings: false,
            qkv_bias: true,
            qk_normalization: true,
            ..base
        };
        let expanded_tensors = required_model_tensors(&expanded, 64).unwrap();
        assert_eq!(expanded_tensors.len(), 17);
        assert!(expanded_tensors
            .iter()
            .any(|tensor| tensor.semantic_role() == "model.output-projection.weight"));
        assert_eq!(
            expanded_tensors
                .iter()
                .filter(|tensor| tensor.semantic_role().ends_with(".bias"))
                .count(),
            3
        );
        assert_eq!(
            expanded_tensors
                .iter()
                .filter(|tensor| tensor.semantic_role().contains("-normalization.weight"))
                .count(),
            5
        );
        let oversized = ModelSpec {
            layer_count: i32::MAX as u32,
            ..expanded
        };
        assert_eq!(
            required_model_tensors(&oversized, 64).unwrap_err().code(),
            "slm2-invalid-model-metadata"
        );

        let mut missing = reference_tensors();
        missing.pop();
        assert_eq!(
            write_model(
                &mut Cursor::new(Vec::new()),
                &reference_spec(),
                &mut missing,
            )
            .unwrap_err()
            .code(),
            "slm2-invalid-tensor-registry"
        );
    }
}
