//! Loaded model metadata and tensor storage.

use crate::adapter::{
    parameter_count, read_f32, read_low_rank_delta_value, read_sparse_delta_pair, section_checksum,
    tensor_layout_checksum, AdapterDelta, AdapterDeltaPayload, AdapterDeltaPayloadKind,
    AdapterExpected,
};
use crate::artifact_digest::sha256_bytes;
use crate::content_identity::{Digest32, StandaloneModelIdentity};
use crate::errors::ErrorCode;
use crate::memory::OwnedModelBytes;
use crate::model_format::{
    name_hash, parse_slm, ParsedSlm, SlmHeader, TensorEntry, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q5_0,
    DTYPE_Q8_0,
};
use crate::ops::matvec_f32;
use crate::quant::{
    matvec_q4_0, matvec_q5_0, matvec_q8_0, pack_q4_pair, pack_q5_codes, packed_q5_len, q5_code_at,
    quantize_q4_block, quantize_q5_block, quantize_q8_row,
};
use crate::specialist_overlay::{SpecialistMatvec, SpecialistOverlay, SpecialistOverlayBase};
use crate::tokenizer::Tokenizer;
use std::collections::HashSet;
use std::convert::TryInto;

const FLAG_TIED_OUTPUT: u32 = 1;
const TOKENIZER_CHECKSUM_SEED: u64 = 0x746f6b656e697a65;

/// Loaded model directory and header.
#[derive(Debug)]
pub struct Model {
    parsed: ParsedSlm,
    tensors: Vec<LoadedTensor>,
    tokenizer: Tokenizer,
    model_bytes: u64,
    parameter_count: u64,
    tensor_layout_checksum: u64,
    tokenizer_checksum: u64,
    model_sha256: Digest32,
    top_level_indices: TopLevelTensorIndices,
    layer_indices: Vec<LayerTensorIndices>,
    backing: Option<OwnedModelBytes>,
}

/// Non-allocating runtime-compatibility inspection for validated `.slm` bytes.
///
/// This report is produced by the same tokenizer, tensor, and shape checks used
/// by [`Model::load`]. It intentionally contains compatibility identity only;
/// it does not claim model quality or expose authoring internals.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RuntimeModelInspection {
    /// Parsed `.slm` header proven by the runtime parser.
    pub header: SlmHeader,
    /// Runtime tokenizer implementation selected by the tokenizer section.
    pub tokenizer_kind: &'static str,
    /// Total logical parameter count across all tensor entries.
    pub parameter_count: u64,
    /// Stable tokenizer-section checksum used by runtime compatibility records.
    pub tokenizer_checksum: u64,
    /// Stable tensor-layout checksum used by runtime compatibility records.
    pub tensor_layout_checksum: u64,
    /// Number of f32 tensors.
    pub f32_tensor_count: u32,
    /// Number of q8_0 tensors.
    pub q8_0_tensor_count: u32,
    /// Number of q4_0 tensors.
    pub q4_0_tensor_count: u32,
    /// Number of q5_0 tensors.
    pub q5_0_tensor_count: u32,
}

struct ValidatedModelStructure {
    parsed: ParsedSlm,
    tokenizer: Tokenizer,
    inspection: RuntimeModelInspection,
}

/// Validates `.slm` bytes against the complete TinyRustLM runtime structure.
///
/// Unlike [`Model::load`], this operation does not copy tensor weights or
/// allocate generation state. It still validates tokenizer contents, required
/// tensors and shapes, duplicate tensor identities, and finite f32/scale data.
pub fn inspect_model_bytes(bytes: &[u8]) -> Result<RuntimeModelInspection, ErrorCode> {
    let validated = validate_model_structure(bytes)?;
    validate_tensor_payloads_without_allocation(bytes, &validated.parsed)?;
    Ok(validated.inspection)
}

/// Pre-resolved indices for model-level tensors used during generation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct TopLevelTensorIndices {
    /// Token embedding matrix index.
    pub(crate) tok_embeddings: usize,
    /// Final normalization weight index.
    pub(crate) norm: usize,
    /// Output projection matrix index, falling back to embeddings when tied.
    pub(crate) output_projection: usize,
}

/// Pre-resolved indices for one decoder layer's tensors.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct LayerTensorIndices {
    /// Attention RMSNorm weight index.
    pub(crate) attention_norm: usize,
    /// Feed-forward RMSNorm weight index.
    pub(crate) ffn_norm: usize,
    /// Query projection matrix index.
    pub(crate) wq: usize,
    /// Optional learned query projection bias index.
    pub(crate) q_bias: Option<usize>,
    /// Optional per-head query RMSNorm weight index.
    pub(crate) q_norm: Option<usize>,
    /// Key projection matrix index.
    pub(crate) wk: usize,
    /// Optional learned key projection bias index.
    pub(crate) k_bias: Option<usize>,
    /// Optional per-head key RMSNorm weight index.
    pub(crate) k_norm: Option<usize>,
    /// Value projection matrix index.
    pub(crate) wv: usize,
    /// Optional learned value projection bias index.
    pub(crate) v_bias: Option<usize>,
    /// Attention output projection matrix index.
    pub(crate) wo: usize,
    /// SwiGLU gate projection matrix index.
    pub(crate) w1: usize,
    /// Feed-forward down projection matrix index.
    pub(crate) w2: usize,
    /// SwiGLU up projection matrix index.
    pub(crate) w3: usize,
}

#[derive(Debug)]
struct LoadedTensor {
    entry: TensorEntry,
    storage: TensorStorage,
}

#[derive(Debug)]
enum TensorStorage {
    F32 {
        data: Vec<f32>,
    },
    Q8 {
        weights: Vec<i8>,
        scales: Vec<f32>,
    },
    Q4 {
        packed: QuantizedBytes,
        scales: Vec<f32>,
        block_size: usize,
    },
    Q5 {
        packed: QuantizedBytes,
        scales: Vec<f32>,
        block_size: usize,
    },
}

#[derive(Debug)]
enum QuantizedBytes {
    Owned(Vec<u8>),
    Backing { offset: usize, len: usize },
}

impl QuantizedBytes {
    fn as_bytes<'a>(&'a self, backing: Option<&'a [u8]>) -> Result<&'a [u8], ErrorCode> {
        match self {
            Self::Owned(bytes) => Ok(bytes),
            Self::Backing { offset, len } => {
                let bytes = backing.ok_or(ErrorCode::InvalidTensorDirectory)?;
                let end = offset.checked_add(*len).ok_or(ErrorCode::InvalidLength)?;
                bytes
                    .get(*offset..end)
                    .ok_or(ErrorCode::InvalidTensorDirectory)
            }
        }
    }

    fn materialize(&mut self, backing: Option<&[u8]>) -> Result<(), ErrorCode> {
        if matches!(self, Self::Owned(_)) {
            return Ok(());
        }
        let bytes = self.as_bytes(backing)?.to_vec();
        *self = Self::Owned(bytes);
        Ok(())
    }

    fn owned_bytes_mut(&mut self) -> Result<&mut [u8], ErrorCode> {
        match self {
            Self::Owned(bytes) => Ok(bytes),
            Self::Backing { .. } => Err(ErrorCode::InvalidTensorDirectory),
        }
    }
}

impl LoadedTensor {
    fn f32_data(&self) -> Result<&[f32], ErrorCode> {
        match &self.storage {
            TensorStorage::F32 { data } => Ok(data),
            TensorStorage::Q8 { .. } | TensorStorage::Q4 { .. } | TensorStorage::Q5 { .. } => {
                Err(ErrorCode::UnsupportedDType)
            }
        }
    }

    fn copy_f32(&self, backing: Option<&[u8]>, out: &mut [f32]) -> Result<(), ErrorCode> {
        let expected = tensor_element_count(&self.entry)?;
        if out.len() != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        match &self.storage {
            TensorStorage::F32 { data } => {
                out.copy_from_slice(data);
                Ok(())
            }
            TensorStorage::Q8 { weights, scales } => {
                let (rows, cols) = tensor_matrix_shape(&self.entry)?;
                if scales.len() != rows {
                    return Err(ErrorCode::ShapeMismatch);
                }
                for (row, scale) in scales.iter().copied().enumerate().take(rows) {
                    let start = row * cols;
                    for col in 0..cols {
                        out[start + col] = f32::from(weights[start + col]) * scale;
                    }
                }
                Ok(())
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => copy_q4_to_f32(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                &self.entry,
                out,
            ),
            TensorStorage::Q5 {
                packed,
                scales,
                block_size,
            } => copy_q5_to_f32(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                &self.entry,
                out,
            ),
        }
    }

    fn copy_row_f32(
        &self,
        backing: Option<&[u8]>,
        row: usize,
        cols: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        let (rows, expected_cols) = tensor_matrix_shape(&self.entry)?;
        if row >= rows || cols != expected_cols || out.len() != cols {
            return Err(ErrorCode::ShapeMismatch);
        }
        match &self.storage {
            TensorStorage::F32 { data } => {
                let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                out.copy_from_slice(&data[start..start + cols]);
                Ok(())
            }
            TensorStorage::Q8 { weights, scales } => {
                let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let scale = scales[row];
                for col in 0..cols {
                    out[col] = f32::from(weights[start + col]) * scale;
                }
                Ok(())
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => copy_q4_row_to_f32(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                &self.entry,
                row,
                cols,
                out,
            ),
            TensorStorage::Q5 {
                packed,
                scales,
                block_size,
            } => copy_q5_row_to_f32(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                &self.entry,
                row,
                cols,
                out,
            ),
        }
    }

    fn matvec(
        &self,
        backing: Option<&[u8]>,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        let expected = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
        if tensor_element_count(&self.entry)? != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        match &self.storage {
            TensorStorage::F32 { data } => matvec_f32(data, rows, cols, vector, out),
            TensorStorage::Q8 { weights, scales } => {
                matvec_q8_0(weights, scales, rows, cols, vector, out)
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => matvec_q4_0(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                rows,
                cols,
                vector,
                out,
            ),
            TensorStorage::Q5 {
                packed,
                scales,
                block_size,
            } => matvec_q5_0(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                rows,
                cols,
                vector,
                out,
            ),
        }
    }

    fn validate_adapter_payload(
        &self,
        backing: Option<&[u8]>,
        bytes: &[u8],
        payload: AdapterDeltaPayload,
    ) -> Result<(), ErrorCode> {
        if tensor_element_count(&self.entry)? != payload.element_count {
            return Err(ErrorCode::ShapeMismatch);
        }
        match payload.kind {
            AdapterDeltaPayloadKind::RawF32 => {
                for value_index in 0..payload.element_count {
                    let value = self.f32_value_at(backing, value_index)?
                        + adapter_delta_value(bytes, payload, value_index)?;
                    if !value.is_finite() {
                        return Err(ErrorCode::InvalidHeader);
                    }
                }
            }
            AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
                for pair_index in 0..pair_count {
                    let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                    let value = self.f32_value_at(backing, value_index)? + delta;
                    if !value.is_finite() {
                        return Err(ErrorCode::InvalidHeader);
                    }
                }
            }
            AdapterDeltaPayloadKind::LowRankF32 { .. } => {
                for value_index in 0..payload.element_count {
                    let value = self.f32_value_at(backing, value_index)?
                        + read_low_rank_delta_value(bytes, payload, value_index)?;
                    if !value.is_finite() {
                        return Err(ErrorCode::InvalidHeader);
                    }
                }
            }
        }
        Ok(())
    }

    fn apply_adapter_payload(
        &mut self,
        backing: Option<&[u8]>,
        bytes: &[u8],
        payload: AdapterDeltaPayload,
    ) -> Result<(), ErrorCode> {
        self.materialize_quantized(backing)?;
        match &mut self.storage {
            TensorStorage::F32 { data } => apply_f32_adapter_payload(data, bytes, payload),
            TensorStorage::Q8 { weights, scales } => {
                apply_q8_adapter_payload(&self.entry, weights, scales, bytes, payload)
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => apply_q4_adapter_payload(
                &self.entry,
                packed.owned_bytes_mut()?,
                scales,
                *block_size,
                bytes,
                payload,
            ),
            TensorStorage::Q5 {
                packed,
                scales,
                block_size,
            } => apply_q5_adapter_payload(
                &self.entry,
                packed.owned_bytes_mut()?,
                scales,
                *block_size,
                bytes,
                payload,
            ),
        }
    }

    fn materialize_quantized(&mut self, backing: Option<&[u8]>) -> Result<(), ErrorCode> {
        match &mut self.storage {
            TensorStorage::F32 { .. } => Ok(()),
            TensorStorage::Q8 { .. } => Ok(()),
            TensorStorage::Q4 { packed, .. } | TensorStorage::Q5 { packed, .. } => {
                packed.materialize(backing)
            }
        }
    }

    fn f32_value_at(&self, backing: Option<&[u8]>, value_index: usize) -> Result<f32, ErrorCode> {
        match &self.storage {
            TensorStorage::F32 { data } => data
                .get(value_index)
                .copied()
                .ok_or(ErrorCode::ShapeMismatch),
            TensorStorage::Q8 { weights, scales } => {
                let (_rows, cols) = tensor_matrix_shape(&self.entry)?;
                let row = value_index / cols;
                let weight = weights.get(value_index).ok_or(ErrorCode::ShapeMismatch)?;
                let scale = scales.get(row).ok_or(ErrorCode::ShapeMismatch)?;
                Ok(f32::from(*weight) * *scale)
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => q4_value_at(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                &self.entry,
                value_index,
            ),
            TensorStorage::Q5 {
                packed,
                scales,
                block_size,
            } => q5_value_at(
                packed.as_bytes(backing)?,
                scales,
                *block_size,
                &self.entry,
                value_index,
            ),
        }
    }
}

impl Model {
    /// Parses and validates model bytes into a loaded model directory.
    pub fn load(bytes: &[u8]) -> Result<Self, ErrorCode> {
        Self::load_internal(bytes, false)
    }

    /// Parses model bytes while retaining one aligned allocation for compact
    /// quantized tensor payloads.
    pub fn load_owned(backing: OwnedModelBytes) -> Result<Self, ErrorCode> {
        let mut model = Self::load_internal(backing.as_slice(), true)?;
        model.backing = Some(backing);
        Ok(model)
    }

    fn load_internal(bytes: &[u8], retain_quantized_backing: bool) -> Result<Self, ErrorCode> {
        let ValidatedModelStructure {
            parsed,
            tokenizer,
            inspection,
        } = validate_model_structure(bytes)?;
        let tensors = load_tensors(bytes, &parsed, retain_quantized_backing)?;
        let top_level_indices = resolve_top_level_indices(&parsed)?;
        let layer_indices = resolve_layer_indices(&parsed)?;
        let model_sha256 = sha256_bytes(bytes)?;
        let model_bytes = u64::try_from(bytes.len()).map_err(|_| ErrorCode::InvalidLength)?;
        Ok(Self {
            parsed,
            tensors,
            tokenizer,
            model_bytes,
            parameter_count: inspection.parameter_count,
            tensor_layout_checksum: inspection.tensor_layout_checksum,
            tokenizer_checksum: inspection.tokenizer_checksum,
            model_sha256,
            top_level_indices,
            layer_indices,
            backing: None,
        })
    }

    /// Returns a tensor entry by stable tensor name.
    pub fn tensor(&self, name: &str) -> Option<TensorEntry> {
        let hash = name_hash(name);
        self.parsed
            .tensors
            .iter()
            .copied()
            .find(|entry| entry.name_hash == hash)
    }

    /// Returns the parsed model view.
    pub fn parsed(&self) -> &ParsedSlm {
        &self.parsed
    }

    /// Returns parsed model header values.
    pub fn header(&self) -> &SlmHeader {
        &self.parsed.header
    }

    /// Returns the tokenizer parsed from the model tokenizer section.
    pub fn tokenizer(&self) -> &Tokenizer {
        &self.tokenizer
    }

    /// Returns the SHA-256 of the exact model bytes used for this loaded model.
    pub fn model_sha256(&self) -> Digest32 {
        self.model_sha256
    }

    /// Returns the exact byte count of the loaded standalone model artifact.
    pub fn model_bytes(&self) -> u64 {
        self.model_bytes
    }

    /// Returns pre-resolved top-level tensor indices used by generation.
    pub(crate) fn top_level_indices(&self) -> TopLevelTensorIndices {
        self.top_level_indices
    }

    /// Returns pre-resolved tensor indices for a decoder layer.
    pub(crate) fn layer_indices(&self, layer: usize) -> Result<LayerTensorIndices, ErrorCode> {
        self.layer_indices
            .get(layer)
            .copied()
            .ok_or(ErrorCode::MissingTensor)
    }

    /// Returns a loaded f32 tensor by stable tensor name.
    pub fn tensor_f32(&self, name: &str) -> Result<&[f32], ErrorCode> {
        self.loaded_tensor(name)?.f32_data()
    }

    /// Copies a named tensor into caller-owned f32 storage.
    pub fn copy_tensor_f32(&self, name: &str, out: &mut [f32]) -> Result<(), ErrorCode> {
        self.loaded_tensor(name)?
            .copy_f32(self.backing_bytes(), out)
    }

    /// Copies one row from a named tensor into caller-owned f32 storage.
    pub fn copy_tensor_row_f32(
        &self,
        name: &str,
        row: usize,
        cols: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor(name)?
            .copy_row_f32(self.backing_bytes(), row, cols, out)
    }

    /// Copies a pre-resolved tensor into caller-owned f32 storage.
    pub(crate) fn copy_tensor_f32_by_index(
        &self,
        index: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor_by_index(index)?
            .copy_f32(self.backing_bytes(), out)
    }

    /// Returns one pre-resolved f32 tensor without allocating or dequantizing.
    pub(crate) fn tensor_f32_by_index(&self, index: usize) -> Result<&[f32], ErrorCode> {
        self.loaded_tensor_by_index(index)?.f32_data()
    }

    /// Copies one row from a pre-resolved tensor into caller-owned f32 storage.
    pub(crate) fn copy_tensor_row_f32_by_index(
        &self,
        index: usize,
        row: usize,
        cols: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor_by_index(index)?
            .copy_row_f32(self.backing_bytes(), row, cols, out)
    }

    /// Computes a matrix-vector product for a named tensor using its native storage.
    pub fn matvec(
        &self,
        name: &str,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        let hash = name_hash(name);
        self.tensors
            .iter()
            .find(|tensor| tensor.entry.name_hash == hash)
            .ok_or(ErrorCode::MissingTensor)?
            .matvec(self.backing_bytes(), rows, cols, vector, out)
    }

    /// Computes a matrix-vector product for a pre-resolved tensor index.
    pub(crate) fn matvec_by_index(
        &self,
        index: usize,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor_by_index(index)?
            .matvec(self.backing_bytes(), rows, cols, vector, out)
    }

    /// Parses an immutable specialist overlay bound to this exact model identity.
    pub fn parse_specialist_overlay(
        &self,
        bytes: &[u8],
        expected_package_sha256: Digest32,
        base: &StandaloneModelIdentity,
    ) -> Result<SpecialistOverlay, ErrorCode> {
        if base.model_sha256() != self.model_sha256 {
            return Err(ErrorCode::InvalidHeader);
        }
        SpecialistOverlay::parse(
            bytes,
            expected_package_sha256,
            SpecialistOverlayBase::from_identity(base),
            &self.parsed.tensors,
        )
    }

    /// Runs one native base matvec and adds one validated immutable overlay.
    pub fn matvec_with_specialist_overlay(
        &self,
        overlay: &SpecialistOverlay,
        operation: SpecialistMatvec<'_>,
    ) -> Result<(), ErrorCode> {
        if overlay.base_model_sha256() != self.model_sha256 {
            return Err(ErrorCode::InvalidHeader);
        }
        overlay.validate_apply(
            operation.tensor_index,
            operation.rows,
            operation.cols,
            operation.vector,
            operation.output,
            operation.scratch,
        )?;
        self.matvec_by_index(
            operation.tensor_index,
            operation.rows,
            operation.cols,
            operation.vector,
            operation.output,
        )?;
        overlay.add_to_output(
            operation.tensor_index,
            operation.vector,
            operation.output,
            operation.scratch,
        )
    }

    /// Returns a compact runtime quantization label for diagnostics.
    pub fn quantization_mode(&self) -> &'static str {
        quantization_mode_for_entries(&self.parsed.tensors)
    }

    /// Validates an `ADP1`, `ASP1`, or `ALR1` adapter-delta package for this loaded model.
    pub fn validate_adapter_delta(&self, bytes: &[u8]) -> Result<(), ErrorCode> {
        let adapter = self.parse_adapter_delta(bytes)?;
        self.validate_adapter_payloads(bytes, &adapter)
    }

    /// Applies an `ADP1`, `ASP1`, or `ALR1` adapter-delta package to loaded tensors.
    pub fn apply_adapter_delta(&mut self, bytes: &[u8]) -> Result<(), ErrorCode> {
        let adapter = self.parse_adapter_delta(bytes)?;
        self.validate_adapter_payloads(bytes, &adapter)?;
        let backing = self.backing.as_ref().map(OwnedModelBytes::as_slice);
        for (tensor, payload) in self.tensors.iter_mut().zip(adapter.entries()) {
            tensor.apply_adapter_payload(backing, bytes, payload)?;
        }
        Ok(())
    }

    fn parse_adapter_delta(&self, bytes: &[u8]) -> Result<AdapterDelta, ErrorCode> {
        let expected = AdapterExpected {
            flags: self.parsed.header.flags,
            tensors: &self.parsed.tensors,
            parameter_count: self.parameter_count,
            tensor_layout_checksum: self.tensor_layout_checksum,
            tokenizer_checksum: self.tokenizer_checksum,
        };
        AdapterDelta::parse(bytes, &expected)
    }

    fn validate_adapter_payloads(
        &self,
        bytes: &[u8],
        adapter: &AdapterDelta,
    ) -> Result<(), ErrorCode> {
        let backing = self.backing_bytes();
        for (tensor, payload) in self.tensors.iter().zip(adapter.entries()) {
            tensor.validate_adapter_payload(backing, bytes, payload)?;
        }
        Ok(())
    }

    fn loaded_tensor(&self, name: &str) -> Result<&LoadedTensor, ErrorCode> {
        let hash = name_hash(name);
        self.tensors
            .iter()
            .find(|tensor| tensor.entry.name_hash == hash)
            .ok_or(ErrorCode::MissingTensor)
    }

    fn loaded_tensor_by_index(&self, index: usize) -> Result<&LoadedTensor, ErrorCode> {
        self.tensors.get(index).ok_or(ErrorCode::MissingTensor)
    }

    fn backing_bytes(&self) -> Option<&[u8]> {
        self.backing.as_ref().map(OwnedModelBytes::as_slice)
    }
}

fn validate_model_structure(bytes: &[u8]) -> Result<ValidatedModelStructure, ErrorCode> {
    let parsed = parse_slm(bytes)?;
    let tokenizer_section = tokenizer_section(bytes, &parsed.header)?;
    let tokenizer = Tokenizer::from_section(tokenizer_section)?;
    validate_unique_tensor_names(&parsed)?;
    validate_required_tensors(&parsed)?;
    validate_required_shapes(&parsed)?;

    let mut f32_tensor_count = 0u32;
    let mut q8_0_tensor_count = 0u32;
    let mut q4_0_tensor_count = 0u32;
    let mut q5_0_tensor_count = 0u32;
    for tensor in &parsed.tensors {
        match tensor.dtype {
            DTYPE_F32 => f32_tensor_count += 1,
            DTYPE_Q8_0 => q8_0_tensor_count += 1,
            DTYPE_Q4_0 => q4_0_tensor_count += 1,
            DTYPE_Q5_0 => q5_0_tensor_count += 1,
            _ => return Err(ErrorCode::UnsupportedDType),
        }
    }

    let inspection = RuntimeModelInspection {
        header: parsed.header,
        tokenizer_kind: tokenizer.label(),
        parameter_count: parameter_count(&parsed.tensors)?,
        tokenizer_checksum: section_checksum(tokenizer_section, TOKENIZER_CHECKSUM_SEED),
        tensor_layout_checksum: tensor_layout_checksum(&parsed.tensors),
        f32_tensor_count,
        q8_0_tensor_count,
        q4_0_tensor_count,
        q5_0_tensor_count,
    };
    Ok(ValidatedModelStructure {
        parsed,
        tokenizer,
        inspection,
    })
}

fn validate_unique_tensor_names(parsed: &ParsedSlm) -> Result<(), ErrorCode> {
    let mut names = HashSet::with_capacity(parsed.tensors.len());
    for tensor in &parsed.tensors {
        if !names.insert(tensor.name_hash) {
            return Err(ErrorCode::InvalidTensorDirectory);
        }
    }
    Ok(())
}

fn validate_tensor_payloads_without_allocation(
    bytes: &[u8],
    parsed: &ParsedSlm,
) -> Result<(), ErrorCode> {
    for tensor in &parsed.tensors {
        match tensor.dtype {
            DTYPE_F32 => validate_f32_payload_without_allocation(bytes, tensor)?,
            DTYPE_Q8_0 => {
                let (rows, _) = tensor_matrix_shape(tensor)?;
                validate_scale_payload_without_allocation(bytes, tensor.scale_offset, rows)?;
            }
            DTYPE_Q4_0 | DTYPE_Q5_0 => {
                let (rows, cols) = tensor_matrix_shape(tensor)?;
                let block_size = tensor.block_size as usize;
                let blocks_per_row = cols
                    .checked_div(block_size)
                    .ok_or(ErrorCode::InvalidTensorDirectory)?;
                let scale_count = rows
                    .checked_mul(blocks_per_row)
                    .ok_or(ErrorCode::InvalidLength)?;
                validate_scale_payload_without_allocation(bytes, tensor.scale_offset, scale_count)?;
            }
            _ => return Err(ErrorCode::UnsupportedDType),
        }
    }
    Ok(())
}

fn validate_f32_payload_without_allocation(
    bytes: &[u8],
    tensor: &TensorEntry,
) -> Result<(), ErrorCode> {
    let byte_length = usize::try_from(tensor.byte_length).map_err(|_| ErrorCode::InvalidLength)?;
    let raw = tensor_bytes(bytes, tensor.byte_offset, byte_length)?;
    for chunk in raw.chunks_exact(4) {
        let value = f32::from_le_bytes(chunk.try_into().map_err(|_| ErrorCode::InvalidHeader)?);
        if !value.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn validate_scale_payload_without_allocation(
    bytes: &[u8],
    offset: u64,
    count: usize,
) -> Result<(), ErrorCode> {
    let byte_length = count.checked_mul(4).ok_or(ErrorCode::InvalidLength)?;
    let raw = tensor_bytes(bytes, offset, byte_length)?;
    for chunk in raw.chunks_exact(4) {
        let scale = f32::from_le_bytes(chunk.try_into().map_err(|_| ErrorCode::InvalidHeader)?);
        if !scale.is_finite() || scale <= 0.0 {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn quantization_mode_for_entries(tensors: &[TensorEntry]) -> &'static str {
    let mut has_f32 = false;
    let mut has_q8 = false;
    let mut has_q4 = false;
    let mut has_q5 = false;
    for tensor in tensors {
        match tensor.dtype {
            DTYPE_F32 => has_f32 = true,
            DTYPE_Q8_0 => has_q8 = true,
            DTYPE_Q4_0 => has_q4 = true,
            DTYPE_Q5_0 => has_q5 = true,
            _ => {}
        }
    }
    match (has_f32, has_q8, has_q5, has_q4) {
        (true, false, false, false) => "f32",
        (_, true, false, false) => "q8_0",
        (_, false, true, false) => "q5_0",
        (_, false, false, true) => "q4_0",
        (_, true, true, _) | (_, true, _, true) | (_, _, true, true) => "mixed",
        _ => "none",
    }
}

fn tokenizer_section<'a>(bytes: &'a [u8], header: &SlmHeader) -> Result<&'a [u8], ErrorCode> {
    let start = usize::try_from(header.tokenizer_offset).map_err(|_| ErrorCode::InvalidLength)?;
    let len = usize::try_from(header.tokenizer_length).map_err(|_| ErrorCode::InvalidLength)?;
    let end = start.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
    bytes.get(start..end).ok_or(ErrorCode::InvalidHeader)
}

fn validate_required_tensors(parsed: &ParsedSlm) -> Result<(), ErrorCode> {
    let mut required = vec![name_hash("tok_embeddings.weight"), name_hash("norm.weight")];
    if parsed.header.flags & FLAG_TIED_OUTPUT == 0 {
        required.push(name_hash("output.weight"));
    }
    for layer in 0..parsed.header.layer_count {
        for suffix in [
            "attention_norm.weight",
            "ffn_norm.weight",
            "wq.weight",
            "wk.weight",
            "wv.weight",
            "wo.weight",
            "w1.weight",
            "w2.weight",
            "w3.weight",
        ] {
            required.push(name_hash(&format!("layers.{layer}.{suffix}")));
        }
    }
    for hash in required {
        if !parsed.tensors.iter().any(|entry| entry.name_hash == hash) {
            return Err(ErrorCode::MissingTensor);
        }
    }
    Ok(())
}

fn validate_required_shapes(parsed: &ParsedSlm) -> Result<(), ErrorCode> {
    let header = &parsed.header;
    require_shape(
        parsed,
        "tok_embeddings.weight",
        &[header.vocab_size, header.hidden_size],
    )?;
    require_shape(parsed, "norm.weight", &[header.hidden_size])?;
    if header.flags & FLAG_TIED_OUTPUT == 0 {
        require_shape(
            parsed,
            "output.weight",
            &[header.vocab_size, header.hidden_size],
        )?;
    }
    let q_projection_rows = header.head_count * header.head_dim;
    let mut qk_norm_contract = None;
    let mut qkv_bias_contract = None;
    for layer in 0..header.layer_count {
        let prefix = format!("layers.{layer}");
        let kv_projection_rows = header.kv_head_count * header.head_dim;
        require_shape(
            parsed,
            &format!("{prefix}.attention_norm.weight"),
            &[header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.ffn_norm.weight"),
            &[header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.wq.weight"),
            &[q_projection_rows, header.hidden_size],
        )?;
        let q_bias = find_tensor_index_optional(parsed, &format!("{prefix}.wq.bias"));
        let k_bias = find_tensor_index_optional(parsed, &format!("{prefix}.wk.bias"));
        let v_bias = find_tensor_index_optional(parsed, &format!("{prefix}.wv.bias"));
        if q_bias.is_some() != k_bias.is_some() || q_bias.is_some() != v_bias.is_some() {
            return Err(ErrorCode::MissingTensor);
        }
        if q_bias.is_some() {
            require_f32_shape(parsed, &format!("{prefix}.wq.bias"), &[q_projection_rows])?;
            require_f32_shape(parsed, &format!("{prefix}.wk.bias"), &[kv_projection_rows])?;
            require_f32_shape(parsed, &format!("{prefix}.wv.bias"), &[kv_projection_rows])?;
        }
        match qkv_bias_contract {
            Some(expected) if expected != q_bias.is_some() => return Err(ErrorCode::MissingTensor),
            None => qkv_bias_contract = Some(q_bias.is_some()),
            _ => {}
        }
        let q_norm = find_tensor_index_optional(parsed, &format!("{prefix}.q_norm.weight"));
        let k_norm = find_tensor_index_optional(parsed, &format!("{prefix}.k_norm.weight"));
        if q_norm.is_some() != k_norm.is_some() {
            return Err(ErrorCode::MissingTensor);
        }
        if q_norm.is_some() {
            require_shape(
                parsed,
                &format!("{prefix}.q_norm.weight"),
                &[header.head_dim],
            )?;
            require_shape(
                parsed,
                &format!("{prefix}.k_norm.weight"),
                &[header.head_dim],
            )?;
        }
        match qk_norm_contract {
            Some(expected) if expected != q_norm.is_some() => return Err(ErrorCode::MissingTensor),
            None => qk_norm_contract = Some(q_norm.is_some()),
            _ => {}
        }
        require_shape(
            parsed,
            &format!("{prefix}.wk.weight"),
            &[kv_projection_rows, header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.wv.weight"),
            &[kv_projection_rows, header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.wo.weight"),
            &[header.hidden_size, q_projection_rows],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.w1.weight"),
            &[header.ffn_size, header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.w2.weight"),
            &[header.hidden_size, header.ffn_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.w3.weight"),
            &[header.ffn_size, header.hidden_size],
        )?;
    }
    Ok(())
}

fn resolve_top_level_indices(parsed: &ParsedSlm) -> Result<TopLevelTensorIndices, ErrorCode> {
    let tok_embeddings = find_tensor_index(parsed, "tok_embeddings.weight")?;
    let norm = find_tensor_index(parsed, "norm.weight")?;
    let output_projection = if parsed.header.flags & FLAG_TIED_OUTPUT != 0 {
        tok_embeddings
    } else {
        find_tensor_index(parsed, "output.weight")?
    };
    Ok(TopLevelTensorIndices {
        tok_embeddings,
        norm,
        output_projection,
    })
}

fn resolve_layer_indices(parsed: &ParsedSlm) -> Result<Vec<LayerTensorIndices>, ErrorCode> {
    let mut layers = Vec::with_capacity(parsed.header.layer_count as usize);
    for layer in 0..parsed.header.layer_count {
        let prefix = format!("layers.{layer}");
        layers.push(LayerTensorIndices {
            attention_norm: find_tensor_index(parsed, &format!("{prefix}.attention_norm.weight"))?,
            ffn_norm: find_tensor_index(parsed, &format!("{prefix}.ffn_norm.weight"))?,
            wq: find_tensor_index(parsed, &format!("{prefix}.wq.weight"))?,
            q_bias: find_tensor_index_optional(parsed, &format!("{prefix}.wq.bias")),
            q_norm: find_tensor_index_optional(parsed, &format!("{prefix}.q_norm.weight")),
            wk: find_tensor_index(parsed, &format!("{prefix}.wk.weight"))?,
            k_bias: find_tensor_index_optional(parsed, &format!("{prefix}.wk.bias")),
            k_norm: find_tensor_index_optional(parsed, &format!("{prefix}.k_norm.weight")),
            wv: find_tensor_index(parsed, &format!("{prefix}.wv.weight"))?,
            v_bias: find_tensor_index_optional(parsed, &format!("{prefix}.wv.bias")),
            wo: find_tensor_index(parsed, &format!("{prefix}.wo.weight"))?,
            w1: find_tensor_index(parsed, &format!("{prefix}.w1.weight"))?,
            w2: find_tensor_index(parsed, &format!("{prefix}.w2.weight"))?,
            w3: find_tensor_index(parsed, &format!("{prefix}.w3.weight"))?,
        });
    }
    Ok(layers)
}

fn find_tensor_index(parsed: &ParsedSlm, name: &str) -> Result<usize, ErrorCode> {
    let hash = name_hash(name);
    parsed
        .tensors
        .iter()
        .position(|entry| entry.name_hash == hash)
        .ok_or(ErrorCode::MissingTensor)
}

fn find_tensor_index_optional(parsed: &ParsedSlm, name: &str) -> Option<usize> {
    let hash = name_hash(name);
    parsed
        .tensors
        .iter()
        .position(|entry| entry.name_hash == hash)
}

fn require_shape(parsed: &ParsedSlm, name: &str, expected: &[u32]) -> Result<(), ErrorCode> {
    let hash = name_hash(name);
    let entry = parsed
        .tensors
        .iter()
        .find(|tensor| tensor.name_hash == hash)
        .ok_or(ErrorCode::MissingTensor)?;
    if !matches!(
        entry.dtype,
        DTYPE_F32 | DTYPE_Q8_0 | DTYPE_Q4_0 | DTYPE_Q5_0
    ) {
        return Err(ErrorCode::UnsupportedDType);
    }
    if tensor_dims(entry) != expected {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(())
}

fn require_f32_shape(parsed: &ParsedSlm, name: &str, expected: &[u32]) -> Result<(), ErrorCode> {
    let hash = name_hash(name);
    let entry = parsed
        .tensors
        .iter()
        .find(|tensor| tensor.name_hash == hash)
        .ok_or(ErrorCode::MissingTensor)?;
    if entry.dtype != DTYPE_F32 {
        return Err(ErrorCode::UnsupportedDType);
    }
    if tensor_dims(entry) != expected {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(())
}

fn load_tensors(
    bytes: &[u8],
    parsed: &ParsedSlm,
    retain_quantized_backing: bool,
) -> Result<Vec<LoadedTensor>, ErrorCode> {
    let mut tensors = Vec::with_capacity(parsed.tensors.len());
    for entry in &parsed.tensors {
        let storage = match entry.dtype {
            DTYPE_F32 => load_f32_tensor(bytes, entry)?,
            DTYPE_Q8_0 => load_q8_tensor(bytes, entry)?,
            DTYPE_Q4_0 => load_q4_tensor(bytes, entry, retain_quantized_backing)?,
            DTYPE_Q5_0 => load_q5_tensor(bytes, entry, retain_quantized_backing)?,
            _ => return Err(ErrorCode::UnsupportedDType),
        };
        tensors.push(LoadedTensor {
            entry: *entry,
            storage,
        });
    }
    Ok(tensors)
}

fn load_f32_tensor(bytes: &[u8], entry: &TensorEntry) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    let expected_bytes = element_count
        .checked_mul(4)
        .ok_or(ErrorCode::InvalidLength)?;
    if entry.byte_length as usize != expected_bytes {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let raw = tensor_bytes(bytes, entry.byte_offset, expected_bytes)?;
    let mut f32_data = Vec::with_capacity(element_count);
    for chunk in raw.chunks_exact(4) {
        let value = f32::from_le_bytes(chunk.try_into().map_err(|_| ErrorCode::InvalidHeader)?);
        if !value.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
        f32_data.push(value);
    }
    Ok(TensorStorage::F32 { data: f32_data })
}

fn load_q8_tensor(bytes: &[u8], entry: &TensorEntry) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    if entry.byte_length as usize != element_count || entry.scale_offset == 0 {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let (rows, _cols) = tensor_matrix_shape(entry)?;
    let raw = tensor_bytes(bytes, entry.byte_offset, element_count)?;
    let scales = scale_values(bytes, entry.scale_offset, rows)?;
    let mut weights = Vec::with_capacity(element_count);
    for value in raw {
        weights.push(*value as i8);
    }
    Ok(TensorStorage::Q8 { weights, scales })
}

fn load_q4_tensor(
    bytes: &[u8],
    entry: &TensorEntry,
    retain_quantized_backing: bool,
) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    if !element_count.is_multiple_of(2) || entry.scale_offset == 0 || entry.block_size == 0 {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let (rows, cols) = tensor_matrix_shape(entry)?;
    let block_size = entry.block_size as usize;
    if block_size == 0 || !block_size.is_multiple_of(2) || !cols.is_multiple_of(block_size) {
        return Err(ErrorCode::ShapeMismatch);
    }
    let packed_len = element_count / 2;
    if entry.byte_length as usize != packed_len {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let blocks_per_row = cols / block_size;
    let raw = tensor_bytes(bytes, entry.byte_offset, packed_len)?;
    let packed = quantized_bytes(entry.byte_offset, raw, retain_quantized_backing)?;
    let scales = scale_values(
        bytes,
        entry.scale_offset,
        rows.checked_mul(blocks_per_row)
            .ok_or(ErrorCode::InvalidLength)?,
    )?;
    Ok(TensorStorage::Q4 {
        packed,
        scales,
        block_size,
    })
}

fn load_q5_tensor(
    bytes: &[u8],
    entry: &TensorEntry,
    retain_quantized_backing: bool,
) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    if entry.scale_offset == 0 || entry.block_size == 0 {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let (rows, cols) = tensor_matrix_shape(entry)?;
    let block_size = entry.block_size as usize;
    if !block_size.is_multiple_of(8) || !cols.is_multiple_of(block_size) {
        return Err(ErrorCode::ShapeMismatch);
    }
    let packed_len = packed_q5_len(element_count)?;
    if entry.byte_length as usize != packed_len {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let blocks_per_row = cols / block_size;
    let raw = tensor_bytes(bytes, entry.byte_offset, packed_len)?;
    let packed = quantized_bytes(entry.byte_offset, raw, retain_quantized_backing)?;
    let scales = scale_values(
        bytes,
        entry.scale_offset,
        rows.checked_mul(blocks_per_row)
            .ok_or(ErrorCode::InvalidLength)?,
    )?;
    Ok(TensorStorage::Q5 {
        packed,
        scales,
        block_size,
    })
}

fn quantized_bytes(
    offset: u64,
    bytes: &[u8],
    retain_backing: bool,
) -> Result<QuantizedBytes, ErrorCode> {
    if retain_backing {
        Ok(QuantizedBytes::Backing {
            offset: usize::try_from(offset).map_err(|_| ErrorCode::InvalidLength)?,
            len: bytes.len(),
        })
    } else {
        Ok(QuantizedBytes::Owned(bytes.to_vec()))
    }
}

fn tensor_bytes(bytes: &[u8], offset: u64, len: usize) -> Result<&[u8], ErrorCode> {
    let start = usize::try_from(offset).map_err(|_| ErrorCode::InvalidLength)?;
    let end = start.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
    bytes
        .get(start..end)
        .ok_or(ErrorCode::InvalidTensorDirectory)
}

fn scale_values(bytes: &[u8], offset: u64, count: usize) -> Result<Vec<f32>, ErrorCode> {
    let byte_len = count.checked_mul(4).ok_or(ErrorCode::InvalidLength)?;
    let raw = tensor_bytes(bytes, offset, byte_len)?;
    let mut scales = Vec::with_capacity(count);
    for chunk in raw.chunks_exact(4) {
        let scale = f32::from_le_bytes(chunk.try_into().map_err(|_| ErrorCode::InvalidHeader)?);
        if !scale.is_finite() || scale <= 0.0 {
            return Err(ErrorCode::InvalidHeader);
        }
        scales.push(scale);
    }
    Ok(scales)
}

fn copy_q4_to_f32(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    for row in 0..rows {
        let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
        copy_q4_row_to_f32(
            packed,
            scales,
            block_size,
            entry,
            row,
            cols,
            &mut out[start..start + cols],
        )?;
    }
    Ok(())
}

fn copy_q4_row_to_f32(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    row: usize,
    cols: usize,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    let (rows, expected_cols) = tensor_matrix_shape(entry)?;
    if row >= rows
        || cols != expected_cols
        || out.len() != cols
        || block_size == 0
        || !block_size.is_multiple_of(2)
        || !cols.is_multiple_of(block_size)
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row_byte_start = row
        .checked_mul(bytes_per_row)
        .ok_or(ErrorCode::InvalidLength)?;
    for byte_index in 0..bytes_per_row {
        let col = byte_index * 2;
        let scale = scales[row * blocks_per_row + col / block_size];
        let pair = packed[row_byte_start + byte_index];
        out[col] = f32::from(sign_extend_4(pair & 0x0f)) * scale;
        out[col + 1] = f32::from(sign_extend_4(pair >> 4)) * scale;
    }
    Ok(())
}

fn copy_q5_to_f32(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    for row in 0..rows {
        let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
        copy_q5_row_to_f32(
            packed,
            scales,
            block_size,
            entry,
            row,
            cols,
            &mut out[start..start + cols],
        )?;
    }
    Ok(())
}

fn copy_q5_row_to_f32(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    row: usize,
    cols: usize,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    let (rows, expected_cols) = tensor_matrix_shape(entry)?;
    if row >= rows
        || cols != expected_cols
        || out.len() != cols
        || !block_size.is_multiple_of(8)
        || !cols.is_multiple_of(block_size)
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let element_count = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
    let blocks_per_row = cols / block_size;
    if packed.len() != packed_q5_len(element_count)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
    for (col, value) in out.iter_mut().enumerate() {
        let scale = scales[row * blocks_per_row + col / block_size];
        *value = f32::from(q5_code_at(packed, row_start + col)?) * scale;
    }
    Ok(())
}

fn apply_f32_adapter_payload(
    data: &mut [f32],
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    if data.len() != payload.element_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    match payload.kind {
        AdapterDeltaPayloadKind::RawF32 => {
            for (value_index, value) in data.iter_mut().enumerate() {
                *value += adapter_delta_value(bytes, payload, value_index)?;
            }
        }
        AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
            for pair_index in 0..pair_count {
                let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                let value = data.get_mut(value_index).ok_or(ErrorCode::ShapeMismatch)?;
                *value += delta;
            }
        }
        AdapterDeltaPayloadKind::LowRankF32 { .. } => {
            for (value_index, value) in data.iter_mut().enumerate() {
                *value += read_low_rank_delta_value(bytes, payload, value_index)?;
            }
        }
    }
    Ok(())
}

fn apply_q8_adapter_payload(
    entry: &TensorEntry,
    weights: &mut [i8],
    scales: &mut [f32],
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if payload.element_count != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
        || weights.len() != payload.element_count
        || scales.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut row_values = vec![0.0f32; cols];
    let mut row_weights = vec![0i8; cols];
    match payload.kind {
        AdapterDeltaPayloadKind::RawF32 => {
            for (row, scale) in scales.iter_mut().enumerate().take(rows) {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let base_scale = *scale;
                for (col, row_value) in row_values.iter_mut().enumerate().take(cols) {
                    let index = row_start + col;
                    *row_value = f32::from(weights[index]) * base_scale
                        + adapter_delta_value(bytes, payload, index)?;
                }
                *scale = quantize_q8_row(&row_values, &mut row_weights)?;
                weights[row_start..row_start + cols].copy_from_slice(&row_weights);
            }
        }
        AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
            let mut pair_index = 0usize;
            for (row, scale) in scales.iter_mut().enumerate().take(rows) {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let row_end = row_start
                    .checked_add(cols)
                    .ok_or(ErrorCode::InvalidLength)?;
                let base_scale = *scale;
                for (col, row_value) in row_values.iter_mut().enumerate().take(cols) {
                    *row_value = f32::from(weights[row_start + col]) * base_scale;
                }
                while pair_index < pair_count {
                    let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                    if value_index >= row_end {
                        break;
                    }
                    if value_index < row_start {
                        return Err(ErrorCode::ShapeMismatch);
                    }
                    row_values[value_index - row_start] += delta;
                    pair_index += 1;
                }
                *scale = quantize_q8_row(&row_values, &mut row_weights)?;
                weights[row_start..row_start + cols].copy_from_slice(&row_weights);
            }
            if pair_index != pair_count {
                return Err(ErrorCode::ShapeMismatch);
            }
        }
        AdapterDeltaPayloadKind::LowRankF32 { .. } => {
            for (row, scale) in scales.iter_mut().enumerate().take(rows) {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let base_scale = *scale;
                for (col, row_value) in row_values.iter_mut().enumerate().take(cols) {
                    let index = row_start + col;
                    *row_value = f32::from(weights[index]) * base_scale
                        + read_low_rank_delta_value(bytes, payload, index)?;
                }
                *scale = quantize_q8_row(&row_values, &mut row_weights)?;
                weights[row_start..row_start + cols].copy_from_slice(&row_weights);
            }
        }
    }
    Ok(())
}

fn apply_q4_adapter_payload(
    entry: &TensorEntry,
    packed: &mut [u8],
    scales: &mut [f32],
    block_size: usize,
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if block_size == 0
        || !block_size.is_multiple_of(2)
        || !cols.is_multiple_of(block_size)
        || payload.element_count != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut block_weights = vec![0i8; block_size];
    match payload.kind {
        AdapterDeltaPayloadKind::RawF32 => {
            let mut block_values = vec![0.0f32; block_size];
            for row in 0..rows {
                for block in 0..blocks_per_row {
                    let scale_index = row * blocks_per_row + block;
                    let base_scale = scales[scale_index];
                    for (block_col, block_value) in
                        block_values.iter_mut().enumerate().take(block_size)
                    {
                        let col = block * block_size + block_col;
                        let index = row * cols + col;
                        let byte_index = row * bytes_per_row + col / 2;
                        let byte = packed[byte_index];
                        let nibble = if col.is_multiple_of(2) {
                            byte & 0x0f
                        } else {
                            byte >> 4
                        };
                        *block_value = f32::from(sign_extend_4(nibble)) * base_scale
                            + adapter_delta_value(bytes, payload, index)?;
                    }
                    scales[scale_index] = quantize_q4_block(&block_values, &mut block_weights)?;
                    let byte_start = row * bytes_per_row + block * (block_size / 2);
                    for pair in 0..block_size / 2 {
                        packed[byte_start + pair] =
                            pack_q4_pair(block_weights[pair * 2], block_weights[pair * 2 + 1]);
                    }
                }
            }
        }
        AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
            let mut row_values = vec![0.0f32; cols];
            let mut pair_index = 0usize;
            for row in 0..rows {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let row_end = row_start
                    .checked_add(cols)
                    .ok_or(ErrorCode::InvalidLength)?;
                for (col, row_value) in row_values.iter_mut().enumerate().take(cols) {
                    let byte_index = row * bytes_per_row + col / 2;
                    let byte = packed[byte_index];
                    let nibble = if col.is_multiple_of(2) {
                        byte & 0x0f
                    } else {
                        byte >> 4
                    };
                    let scale = scales[row * blocks_per_row + col / block_size];
                    *row_value = f32::from(sign_extend_4(nibble)) * scale;
                }
                while pair_index < pair_count {
                    let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                    if value_index >= row_end {
                        break;
                    }
                    if value_index < row_start {
                        return Err(ErrorCode::ShapeMismatch);
                    }
                    row_values[value_index - row_start] += delta;
                    pair_index += 1;
                }
                for block in 0..blocks_per_row {
                    let scale_index = row * blocks_per_row + block;
                    let value_start = block * block_size;
                    scales[scale_index] = quantize_q4_block(
                        &row_values[value_start..value_start + block_size],
                        &mut block_weights,
                    )?;
                    let byte_start = row * bytes_per_row + block * (block_size / 2);
                    for pair in 0..block_size / 2 {
                        packed[byte_start + pair] =
                            pack_q4_pair(block_weights[pair * 2], block_weights[pair * 2 + 1]);
                    }
                }
            }
            if pair_index != pair_count {
                return Err(ErrorCode::ShapeMismatch);
            }
        }
        AdapterDeltaPayloadKind::LowRankF32 { .. } => {
            let mut block_values = vec![0.0f32; block_size];
            for row in 0..rows {
                for block in 0..blocks_per_row {
                    let scale_index = row * blocks_per_row + block;
                    let base_scale = scales[scale_index];
                    for (block_col, block_value) in
                        block_values.iter_mut().enumerate().take(block_size)
                    {
                        let col = block * block_size + block_col;
                        let index = row * cols + col;
                        let byte_index = row * bytes_per_row + col / 2;
                        let byte = packed[byte_index];
                        let nibble = if col.is_multiple_of(2) {
                            byte & 0x0f
                        } else {
                            byte >> 4
                        };
                        *block_value = f32::from(sign_extend_4(nibble)) * base_scale
                            + read_low_rank_delta_value(bytes, payload, index)?;
                    }
                    scales[scale_index] = quantize_q4_block(&block_values, &mut block_weights)?;
                    let byte_start = row * bytes_per_row + block * (block_size / 2);
                    for pair in 0..block_size / 2 {
                        packed[byte_start + pair] =
                            pack_q4_pair(block_weights[pair * 2], block_weights[pair * 2 + 1]);
                    }
                }
            }
        }
    }
    Ok(())
}

fn apply_q5_adapter_payload(
    entry: &TensorEntry,
    packed: &mut [u8],
    scales: &mut [f32],
    block_size: usize,
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if !block_size.is_multiple_of(8)
        || !cols.is_multiple_of(block_size)
        || payload.element_count != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
        || packed.len() != packed_q5_len(payload.element_count)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let blocks_per_row = cols / block_size;
    if scales.len()
        != rows
            .checked_mul(blocks_per_row)
            .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }

    let bytes_per_block = packed_q5_len(block_size)?;
    let mut block_values = vec![0.0f32; block_size];
    let mut block_codes = vec![0i8; block_size];
    let mut packed_block = vec![0u8; bytes_per_block];
    let mut sparse_pair_index = 0usize;

    for row in 0..rows {
        for block in 0..blocks_per_row {
            let block_start = row
                .checked_mul(cols)
                .and_then(|value| value.checked_add(block * block_size))
                .ok_or(ErrorCode::InvalidLength)?;
            let block_end = block_start
                .checked_add(block_size)
                .ok_or(ErrorCode::InvalidLength)?;
            let scale_index = row * blocks_per_row + block;
            let base_scale = scales[scale_index];
            for (block_col, value) in block_values.iter_mut().enumerate() {
                let value_index = block_start + block_col;
                *value = f32::from(q5_code_at(packed, value_index)?) * base_scale;
                match payload.kind {
                    AdapterDeltaPayloadKind::RawF32 => {
                        *value += adapter_delta_value(bytes, payload, value_index)?;
                    }
                    AdapterDeltaPayloadKind::LowRankF32 { .. } => {
                        *value += read_low_rank_delta_value(bytes, payload, value_index)?;
                    }
                    AdapterDeltaPayloadKind::SparseF32 { .. } => {}
                }
            }
            if let AdapterDeltaPayloadKind::SparseF32 { pair_count } = payload.kind {
                while sparse_pair_index < pair_count {
                    let (value_index, delta) =
                        read_sparse_delta_pair(bytes, payload, sparse_pair_index)?;
                    if value_index >= block_end {
                        break;
                    }
                    if value_index < block_start {
                        return Err(ErrorCode::ShapeMismatch);
                    }
                    block_values[value_index - block_start] += delta;
                    sparse_pair_index += 1;
                }
            }

            scales[scale_index] = quantize_q5_block(&block_values, &mut block_codes)?;
            pack_q5_codes(&block_codes, &mut packed_block)?;
            let byte_start = scale_index
                .checked_mul(bytes_per_block)
                .ok_or(ErrorCode::InvalidLength)?;
            packed[byte_start..byte_start + bytes_per_block].copy_from_slice(&packed_block);
        }
    }
    if let AdapterDeltaPayloadKind::SparseF32 { pair_count } = payload.kind {
        if sparse_pair_index != pair_count {
            return Err(ErrorCode::ShapeMismatch);
        }
    }
    Ok(())
}

fn q4_value_at(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    value_index: usize,
) -> Result<f32, ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if block_size == 0 || !block_size.is_multiple_of(2) || !cols.is_multiple_of(block_size) {
        return Err(ErrorCode::ShapeMismatch);
    }
    let element_count = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
    if value_index >= element_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row = value_index / cols;
    let col = value_index % cols;
    let byte = packed[row * bytes_per_row + col / 2];
    let nibble = if col.is_multiple_of(2) {
        byte & 0x0f
    } else {
        byte >> 4
    };
    let scale = scales[row * blocks_per_row + col / block_size];
    Ok(f32::from(sign_extend_4(nibble)) * scale)
}

fn q5_value_at(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    value_index: usize,
) -> Result<f32, ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if !block_size.is_multiple_of(8) || !cols.is_multiple_of(block_size) {
        return Err(ErrorCode::ShapeMismatch);
    }
    let element_count = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
    if value_index >= element_count
        || packed.len() != packed_q5_len(element_count)?
        || scales.len()
            != rows
                .checked_mul(cols / block_size)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row = value_index / cols;
    let col = value_index % cols;
    let scale = scales[row * (cols / block_size) + col / block_size];
    Ok(f32::from(q5_code_at(packed, value_index)?) * scale)
}

fn adapter_delta_value(
    bytes: &[u8],
    payload: AdapterDeltaPayload,
    value_index: usize,
) -> Result<f32, ErrorCode> {
    if !matches!(payload.kind, AdapterDeltaPayloadKind::RawF32) {
        return Err(ErrorCode::ShapeMismatch);
    }
    if value_index >= payload.element_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    let delta_offset = payload
        .byte_offset
        .checked_add(value_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
        .ok_or(ErrorCode::InvalidLength)?;
    read_f32(bytes, delta_offset)
}

fn tensor_dims(entry: &TensorEntry) -> Vec<u32> {
    [entry.dim0, entry.dim1, entry.dim2, entry.dim3]
        .into_iter()
        .take(entry.rank as usize)
        .collect()
}

fn tensor_element_count(entry: &TensorEntry) -> Result<usize, ErrorCode> {
    let mut total = 1usize;
    for dim in tensor_dims(entry) {
        if dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        total = total
            .checked_mul(dim as usize)
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok(total)
}

fn tensor_matrix_shape(entry: &TensorEntry) -> Result<(usize, usize), ErrorCode> {
    let dims = tensor_dims(entry);
    if dims.is_empty() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let rows = if dims.len() == 1 { 1 } else { dims[0] as usize };
    let mut cols = 1usize;
    let col_dims = if dims.len() == 1 {
        &dims[..]
    } else {
        &dims[1..]
    };
    for dim in col_dims {
        cols = cols
            .checked_mul(*dim as usize)
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok((rows, cols))
}

fn sign_extend_4(value: u8) -> i8 {
    let nibble = (value & 0x0f) as i8;
    if nibble >= 8 {
        nibble - 16
    } else {
        nibble
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model_format::{simple_checksum, HEADER_LEN, SLM_VERSION, TENSOR_ENTRY_LEN};
    use crate::ops::matvec_f32;

    const ADAPTER_HEADER_LEN: usize = 64;
    const ADAPTER_ENTRY_LEN: usize = 64;
    const ADAPTER_CHECKSUM_OFFSET: usize = 56;

    #[test]
    fn loaded_model_retains_exact_cryptographic_artifact_identity() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let actual = model
            .model_sha256()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        assert_eq!(
            actual,
            "17d79ee766578729d2b69090547e819e011d76115519514e19ac3754de610a1a"
        );
    }
    const LOW_RANK_PAYLOAD_HEADER_LEN: usize = 16;

    fn valid_header_without_tensors() -> Vec<u8> {
        let tokenizer = {
            let mut bytes = Vec::new();
            bytes.extend_from_slice(b"BTOK");
            bytes.extend_from_slice(&1u32.to_le_bytes());
            bytes.extend_from_slice(&260u32.to_le_bytes());
            bytes.extend_from_slice(&256u32.to_le_bytes());
            bytes.extend_from_slice(&257u32.to_le_bytes());
            bytes.extend_from_slice(&258u32.to_le_bytes());
            bytes.extend_from_slice(&259u32.to_le_bytes());
            bytes
        };
        let directory_offset = ((HEADER_LEN + tokenizer.len() + 63) & !63) as u64;
        let tensor_data_offset = ((directory_offset as usize + TENSOR_ENTRY_LEN + 63) & !63) as u64;
        let mut bytes = vec![0u8; tensor_data_offset as usize];
        bytes[0..4].copy_from_slice(b"SLM1");
        bytes[4..8].copy_from_slice(&SLM_VERSION.to_le_bytes());
        bytes[8..12].copy_from_slice(&(HEADER_LEN as u32).to_le_bytes());
        bytes[12..16].copy_from_slice(&1u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&0u32.to_le_bytes());
        bytes[20..24].copy_from_slice(&260u32.to_le_bytes());
        bytes[24..28].copy_from_slice(&4u32.to_le_bytes());
        bytes[28..32].copy_from_slice(&8u32.to_le_bytes());
        bytes[32..36].copy_from_slice(&1u32.to_le_bytes());
        bytes[36..40].copy_from_slice(&2u32.to_le_bytes());
        bytes[40..44].copy_from_slice(&2u32.to_le_bytes());
        bytes[44..48].copy_from_slice(&4u32.to_le_bytes());
        bytes[48..52].copy_from_slice(&16u32.to_le_bytes());
        bytes[52..56].copy_from_slice(&16u32.to_le_bytes());
        bytes[56..60].copy_from_slice(&10000.0f32.to_le_bytes());
        bytes[60..64].copy_from_slice(&0.00001f32.to_le_bytes());
        bytes[64..72].copy_from_slice(&(HEADER_LEN as u64).to_le_bytes());
        bytes[72..80].copy_from_slice(&(tokenizer.len() as u64).to_le_bytes());
        bytes[80..88].copy_from_slice(&directory_offset.to_le_bytes());
        bytes[88..92].copy_from_slice(&0u32.to_le_bytes());
        bytes[92..100].copy_from_slice(&tensor_data_offset.to_le_bytes());
        bytes[100..108].copy_from_slice(&0u64.to_le_bytes());
        bytes[HEADER_LEN..HEADER_LEN + tokenizer.len()].copy_from_slice(&tokenizer);
        let checksum = simple_checksum(&bytes);
        bytes[100..108].copy_from_slice(&checksum.to_le_bytes());
        bytes
    }

    fn build_adapter_bytes<F>(model: &Model, mut delta: F) -> Vec<u8>
    where
        F: FnMut(usize, usize, &TensorEntry) -> f32,
    {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for (tensor_index, tensor) in tensors.iter().enumerate() {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let element_count = tensor_element_count(tensor).unwrap();
            let byte_length = element_count * 4;
            lengths.push(byte_length);
            let mut payload = vec![0u8; byte_length];
            for value_index in 0..element_count {
                let value = delta(tensor_index, value_index, tensor);
                payload[value_index * 4..value_index * 4 + 4].copy_from_slice(&value.to_le_bytes());
            }
            cursor += byte_length;
            payloads.push(payload);
        }

        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ADP1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, model.parameter_count);
        write_u64(&mut bytes, 32, model.tensor_layout_checksum);
        write_u64(&mut bytes, 40, model.tokenizer_checksum);
        write_u64(&mut bytes, 48, data_offset as u64);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, 0);

        for (index, tensor) in tensors.iter().enumerate() {
            let entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
            write_u64(&mut bytes, entry, tensor.name_hash);
            write_u32(&mut bytes, entry + 8, tensor.rank);
            write_u32(&mut bytes, entry + 12, tensor.dim0);
            write_u32(&mut bytes, entry + 16, tensor.dim1);
            write_u32(&mut bytes, entry + 20, tensor.dim2);
            write_u32(&mut bytes, entry + 24, tensor.dim3);
            write_u32(&mut bytes, entry + 28, 0);
            write_u64(&mut bytes, entry + 32, offsets[index] as u64);
            write_u64(&mut bytes, entry + 40, lengths[index] as u64);
            write_u64(
                &mut bytes,
                entry + 48,
                tensor_element_count(tensor).unwrap() as u64,
            );
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            let start = offsets[index];
            bytes[start..start + lengths[index]].copy_from_slice(&payloads[index]);
        }
        refresh_adapter_checksum(&mut bytes);
        bytes
    }

    fn build_sparse_adapter_bytes<F>(model: &Model, mut delta: F) -> Vec<u8>
    where
        F: FnMut(usize, usize, &TensorEntry) -> Option<f32>,
    {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for (tensor_index, tensor) in tensors.iter().enumerate() {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let element_count = tensor_element_count(tensor).unwrap();
            let mut payload = Vec::new();
            for value_index in 0..element_count {
                if let Some(value) = delta(tensor_index, value_index, tensor) {
                    payload.extend_from_slice(&(value_index as u64).to_le_bytes());
                    payload.extend_from_slice(&value.to_le_bytes());
                }
            }
            lengths.push(payload.len());
            cursor += payload.len();
            payloads.push(payload);
        }

        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ASP1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, model.parameter_count);
        write_u64(&mut bytes, 32, model.tensor_layout_checksum);
        write_u64(&mut bytes, 40, model.tokenizer_checksum);
        write_u64(&mut bytes, 48, data_offset as u64);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, 0);

        for (index, tensor) in tensors.iter().enumerate() {
            let entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
            write_u64(&mut bytes, entry, tensor.name_hash);
            write_u32(&mut bytes, entry + 8, tensor.rank);
            write_u32(&mut bytes, entry + 12, tensor.dim0);
            write_u32(&mut bytes, entry + 16, tensor.dim1);
            write_u32(&mut bytes, entry + 20, tensor.dim2);
            write_u32(&mut bytes, entry + 24, tensor.dim3);
            write_u32(&mut bytes, entry + 28, 0);
            write_u64(&mut bytes, entry + 32, offsets[index] as u64);
            write_u64(&mut bytes, entry + 40, lengths[index] as u64);
            write_u64(
                &mut bytes,
                entry + 48,
                tensor_element_count(tensor).unwrap() as u64,
            );
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            let start = offsets[index];
            bytes[start..start + lengths[index]].copy_from_slice(&payloads[index]);
        }
        refresh_adapter_checksum(&mut bytes);
        bytes
    }

    fn build_low_rank_adapter_bytes<F>(model: &Model, mut factors: F) -> Vec<u8>
    where
        F: FnMut(usize, &TensorEntry) -> Option<(usize, usize, Vec<f32>, Vec<f32>)>,
    {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for (tensor_index, tensor) in tensors.iter().enumerate() {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let payload = if let Some((rows, cols, a_values, b_values)) =
                factors(tensor_index, tensor)
            {
                let factor_rank = a_values.len() / rows;
                assert!(factor_rank > 0);
                assert_eq!(a_values.len(), factor_rank * rows);
                assert_eq!(b_values.len(), factor_rank * cols);
                assert_eq!(tensor_element_count(tensor).unwrap(), rows * cols);
                let mut payload =
                    vec![0u8; LOW_RANK_PAYLOAD_HEADER_LEN + (a_values.len() + b_values.len()) * 4];
                write_u32(&mut payload, 0, rows as u32);
                write_u32(&mut payload, 4, cols as u32);
                write_u32(&mut payload, 8, factor_rank as u32);
                write_u32(&mut payload, 12, 0);
                let mut offset = LOW_RANK_PAYLOAD_HEADER_LEN;
                for value in a_values.iter().chain(b_values.iter()) {
                    payload[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
                    offset += 4;
                }
                payload
            } else {
                Vec::new()
            };
            lengths.push(payload.len());
            cursor += payload.len();
            payloads.push(payload);
        }

        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ALR1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, model.parameter_count);
        write_u64(&mut bytes, 32, model.tensor_layout_checksum);
        write_u64(&mut bytes, 40, model.tokenizer_checksum);
        write_u64(&mut bytes, 48, data_offset as u64);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, 0);

        for (index, tensor) in tensors.iter().enumerate() {
            let entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
            write_u64(&mut bytes, entry, tensor.name_hash);
            write_u32(&mut bytes, entry + 8, tensor.rank);
            write_u32(&mut bytes, entry + 12, tensor.dim0);
            write_u32(&mut bytes, entry + 16, tensor.dim1);
            write_u32(&mut bytes, entry + 20, tensor.dim2);
            write_u32(&mut bytes, entry + 24, tensor.dim3);
            write_u32(&mut bytes, entry + 28, 0);
            write_u64(&mut bytes, entry + 32, offsets[index] as u64);
            write_u64(&mut bytes, entry + 40, lengths[index] as u64);
            write_u64(
                &mut bytes,
                entry + 48,
                tensor_element_count(tensor).unwrap() as u64,
            );
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            let start = offsets[index];
            bytes[start..start + lengths[index]].copy_from_slice(&payloads[index]);
        }
        refresh_adapter_checksum(&mut bytes);
        bytes
    }

    fn refresh_adapter_checksum(bytes: &mut [u8]) {
        write_u64(bytes, ADAPTER_CHECKSUM_OFFSET, 0);
        let checksum = adapter_checksum(bytes);
        write_u64(bytes, ADAPTER_CHECKSUM_OFFSET, checksum);
    }

    fn align_to_64(value: usize) -> usize {
        (value + 63) & !63
    }

    fn adapter_checksum(bytes: &[u8]) -> u64 {
        let mut acc = 0x6164617074657231u64;
        for (index, byte) in bytes.iter().enumerate() {
            let value = if (ADAPTER_CHECKSUM_OFFSET..ADAPTER_CHECKSUM_OFFSET + 8).contains(&index) {
                0
            } else {
                *byte
            };
            acc ^= u64::from(value).wrapping_add((index as u64) << 3);
            acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
        }
        acc
    }

    fn adapter_payload_checksum(bytes: &[u8]) -> u64 {
        let mut acc = 0x64656c7461663332u64;
        for (index, byte) in bytes.iter().enumerate() {
            acc ^= u64::from(*byte).wrapping_add((index as u64) << 1);
            acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
        }
        acc
    }

    fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
        bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn write_u64(bytes: &mut [u8], offset: usize, value: u64) {
        bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    }

    fn refresh_slm_checksum(bytes: &mut [u8]) {
        write_u64(bytes, 100, 0);
        let checksum = simple_checksum(bytes);
        write_u64(bytes, 100, checksum);
    }

    #[test]
    fn missing_tensor_rejection() {
        let error = Model::load(&valid_header_without_tensors()).unwrap_err();
        assert_eq!(error, ErrorCode::MissingTensor);
    }

    #[test]
    fn runtime_inspection_matches_loaded_q8_compatibility_identity() {
        let bytes = include_bytes!("../../models/tiny-test-model-q8.slm");

        let inspection = inspect_model_bytes(bytes).unwrap();

        assert_eq!(inspection.header.tensor_count, 12);
        assert_eq!(inspection.tokenizer_kind, "byte-v1");
        assert_eq!(inspection.parameter_count, 4_824);
        assert_eq!(inspection.tokenizer_checksum, 0x288f65d94c26743e);
        assert_eq!(inspection.tensor_layout_checksum, 0xd8fb6e636a8badd6);
        assert_eq!(inspection.f32_tensor_count, 0);
        assert_eq!(inspection.q8_0_tensor_count, 12);
        assert_eq!(inspection.q4_0_tensor_count, 0);
        assert_eq!(inspection.q5_0_tensor_count, 0);
    }

    #[test]
    fn model_load_rejects_non_finite_f32_payload_after_checksum_refresh() {
        let mut bytes = include_bytes!("../../models/tiny-test-model.slm").to_vec();
        let parsed = parse_slm(&bytes).unwrap();
        let tensor = parsed
            .tensors
            .iter()
            .find(|entry| entry.name_hash == name_hash("output.weight"))
            .unwrap();
        let start = tensor.byte_offset as usize;
        bytes[start..start + 4].copy_from_slice(&f32::NAN.to_le_bytes());
        refresh_slm_checksum(&mut bytes);

        assert_eq!(
            inspect_model_bytes(&bytes).unwrap_err(),
            ErrorCode::InvalidHeader
        );
        assert_eq!(Model::load(&bytes).unwrap_err(), ErrorCode::InvalidHeader);
    }

    #[test]
    fn model_load_rejects_non_positive_q8_scale_after_checksum_refresh() {
        let mut bytes = include_bytes!("../../models/tiny-test-model-q8.slm").to_vec();
        let parsed = parse_slm(&bytes).unwrap();
        let tensor = parsed
            .tensors
            .iter()
            .find(|entry| entry.name_hash == name_hash("output.weight"))
            .unwrap();
        let start = tensor.scale_offset as usize;
        bytes[start..start + 4].copy_from_slice(&0.0f32.to_le_bytes());
        refresh_slm_checksum(&mut bytes);

        assert_eq!(
            inspect_model_bytes(&bytes).unwrap_err(),
            ErrorCode::InvalidHeader
        );
        assert_eq!(Model::load(&bytes).unwrap_err(), ErrorCode::InvalidHeader);
    }

    #[test]
    fn runtime_inspection_rejects_duplicate_tensor_identity() {
        let mut bytes = include_bytes!("../../models/tiny-test-model-q8.slm").to_vec();
        let parsed = parse_slm(&bytes).unwrap();
        let directory = parsed.header.tensor_directory_offset as usize;
        let first_name_hash = parsed.tensors[0].name_hash;
        write_u64(&mut bytes, directory + 64, first_name_hash);
        refresh_slm_checksum(&mut bytes);

        assert_eq!(
            inspect_model_bytes(&bytes).unwrap_err(),
            ErrorCode::InvalidTensorDirectory
        );
        assert_eq!(
            Model::load(&bytes).unwrap_err(),
            ErrorCode::InvalidTensorDirectory
        );
    }

    #[test]
    fn q8_named_matvec_matches_copied_reference() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let vector = [1.0f32; 8];
        let mut direct = [0.0f32; 260];
        let mut decoded = [0.0f32; 260];
        model
            .matvec("output.weight", 260, 8, &vector, &mut direct)
            .unwrap();
        let mut copied = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut copied).unwrap();
        matvec_f32(&copied, 260, 8, &vector, &mut decoded).unwrap();
        for index in 0..direct.len() {
            assert!((direct[index] - decoded[index]).abs() < 0.0001);
        }
    }

    #[test]
    fn q4_named_matvec_matches_copied_reference() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q4.slm")).unwrap();
        let vector = [1.0f32; 8];
        let mut direct = [0.0f32; 260];
        let mut decoded = [0.0f32; 260];
        model
            .matvec("output.weight", 260, 8, &vector, &mut direct)
            .unwrap();
        let mut copied = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut copied).unwrap();
        matvec_f32(&copied, 260, 8, &vector, &mut decoded).unwrap();
        for index in 0..direct.len() {
            assert!((direct[index] - decoded[index]).abs() < 0.0001);
        }
    }

    #[test]
    fn owned_q4_model_keeps_packed_weights_in_one_backing_allocation() {
        let bytes = include_bytes!("../../models/tiny-test-model-q4.slm");
        let owned = OwnedModelBytes::copy_from_slice(bytes).unwrap();
        let model = Model::load_owned(owned).unwrap();
        let output = model.loaded_tensor("output.weight").unwrap();

        assert_eq!(model.backing.as_ref().unwrap().as_slice(), bytes);
        assert!(matches!(
            output.storage,
            TensorStorage::Q4 {
                packed: QuantizedBytes::Backing { .. },
                ..
            }
        ));

        let vector = [1.0f32; 8];
        let mut direct = [0.0f32; 260];
        let mut decoded = [0.0f32; 260];
        model
            .matvec("output.weight", 260, 8, &vector, &mut direct)
            .unwrap();
        let mut copied = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut copied).unwrap();
        matvec_f32(&copied, 260, 8, &vector, &mut decoded).unwrap();
        for index in 0..direct.len() {
            assert!((direct[index] - decoded[index]).abs() < 0.0001);
        }
    }

    #[test]
    fn q5_named_matvec_matches_copied_reference() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q5.slm")).unwrap();
        let vector = [1.0f32; 8];
        let mut direct = [0.0f32; 260];
        let mut decoded = [0.0f32; 260];
        model
            .matvec("output.weight", 260, 8, &vector, &mut direct)
            .unwrap();
        let mut copied = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut copied).unwrap();
        matvec_f32(&copied, 260, 8, &vector, &mut decoded).unwrap();
        for index in 0..direct.len() {
            assert!((direct[index] - decoded[index]).abs() < 0.0001);
        }
        assert_eq!(model.quantization_mode(), "q5_0");
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn applies_f32_adapter_delta_to_loaded_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                0.25
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after[0], before[0] + 0.25);
        assert_eq!(after[1], before[1]);
    }

    #[test]
    fn validates_f32_adapter_delta_without_mutating_tensor() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                0.25
            } else {
                0.0
            }
        });

        model.validate_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after, before);
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_f32_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                Some(0.25)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after[0], before[0] + 0.25);
        assert_eq!(after[1], before[1]);
    }

    #[test]
    fn applies_low_rank_adapter_delta_to_loaded_f32_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_low_rank_adapter_bytes(&model, |_tensor_index, tensor| {
            if tensor.name_hash != name_hash("output.weight") {
                return None;
            }
            let (rows, cols) = tensor_matrix_shape(tensor).unwrap();
            let mut a = vec![0.0f32; rows];
            let b = vec![1.0f32; cols];
            a[0] = 0.25;
            Some((rows, cols, a, b))
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after[0], before[0] + 0.25);
        assert_eq!(after[7], before[7] + 0.25);
        assert_eq!(after[8], before[8]);
    }

    #[test]
    fn adapter_identity_drift_rejects_without_mutating_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let mut adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                0.25
            } else {
                0.0
            }
        });
        write_u32(&mut adapter, 16, model.header().flags ^ 1);
        refresh_adapter_checksum(&mut adapter);

        assert_eq!(
            model.apply_adapter_delta(&adapter).unwrap_err(),
            ErrorCode::ShapeMismatch
        );

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after, before);
    }

    #[test]
    fn applies_q8_adapter_delta_to_loaded_compact_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 4.0);
        assert_eq!(model.quantization_mode(), "q8_0");
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_q8_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                Some(1.0)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 4.0);
        assert_eq!(model.quantization_mode(), "q8_0");
    }

    #[test]
    fn applies_low_rank_adapter_delta_to_loaded_q8_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_low_rank_adapter_bytes(&model, |_tensor_index, tensor| {
            if tensor.name_hash != name_hash("output.weight") {
                return None;
            }
            let (rows, cols) = tensor_matrix_shape(tensor).unwrap();
            let mut a = vec![0.0f32; rows];
            let b = vec![1.0f32; cols];
            a[0] = 1.0;
            Some((rows, cols, a, b))
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 4.0);
        assert_eq!(model.quantization_mode(), "q8_0");
    }

    #[test]
    fn applies_q4_adapter_delta_to_loaded_compact_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q4.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 3.0);
        assert_eq!(model.quantization_mode(), "q4_0");
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn owned_q4_model_materializes_quantized_tensors_before_adapter_mutation() {
        let owned =
            OwnedModelBytes::copy_from_slice(include_bytes!("../../models/tiny-test-model-q4.slm"))
                .unwrap();
        let mut model = Model::load_owned(owned).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        assert!(matches!(
            model.loaded_tensor("output.weight").unwrap().storage,
            TensorStorage::Q4 {
                packed: QuantizedBytes::Owned(_),
                ..
            }
        ));
        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert!(after[..8].iter().sum::<f32>() > 3.0);
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_q4_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q4.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                Some(1.0)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 3.0);
        assert_eq!(model.quantization_mode(), "q4_0");
    }

    #[test]
    fn applies_raw_adapter_delta_to_loaded_q5_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q5.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert!(after[..8].iter().sum::<f32>() > before[..8].iter().sum::<f32>() + 4.0);
        assert_eq!(model.quantization_mode(), "q5_0");
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_q5_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q5.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                Some(1.0)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert!(after[..8].iter().sum::<f32>() > before[..8].iter().sum::<f32>() + 4.0);
        assert_eq!(model.quantization_mode(), "q5_0");
    }

    #[test]
    fn applies_low_rank_adapter_delta_to_loaded_q5_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q5.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_low_rank_adapter_bytes(&model, |_tensor_index, tensor| {
            if tensor.name_hash != name_hash("output.weight") {
                return None;
            }
            let (rows, cols) = tensor_matrix_shape(tensor).unwrap();
            let mut a = vec![0.0f32; rows];
            let b = vec![1.0f32; cols];
            a[0] = 1.0;
            Some((rows, cols, a, b))
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert!(after[..8].iter().sum::<f32>() > before[..8].iter().sum::<f32>() + 4.0);
        assert_eq!(model.quantization_mode(), "q5_0");
    }

    #[test]
    fn q8_adapter_identity_drift_rejects_without_mutating_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let mut adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });
        write_u32(&mut adapter, 16, model.header().flags ^ 1);
        refresh_adapter_checksum(&mut adapter);

        assert_eq!(
            model.apply_adapter_delta(&adapter).unwrap_err(),
            ErrorCode::ShapeMismatch
        );

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after, before);
        assert_eq!(model.quantization_mode(), "q8_0");
    }

    #[test]
    fn quantized_tensor_f32_borrow_is_rejected() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn tied_output_projection_uses_embedding_tensor_index() {
        let mut parsed = parse_slm(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        parsed.header.flags |= FLAG_TIED_OUTPUT;

        let top_level = resolve_top_level_indices(&parsed).unwrap();

        assert_eq!(top_level.output_projection, top_level.tok_embeddings);
        assert_ne!(top_level.norm, top_level.output_projection);
    }

    #[test]
    fn tied_output_fixture_loads_without_output_tensor() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-tied.slm")).unwrap();
        let top_level = model.top_level_indices();

        assert!(model.tensor("output.weight").is_none());
        assert_eq!(top_level.output_projection, top_level.tok_embeddings);
        assert_eq!(
            model.parsed().tensors[top_level.tok_embeddings].name_hash,
            name_hash("tok_embeddings.weight")
        );
    }

    #[test]
    fn loaded_model_exposes_pre_resolved_tensor_indices() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let top_level = model.top_level_indices();
        let layer = model.layer_indices(0).unwrap();

        assert_ne!(top_level.tok_embeddings, top_level.output_projection);
        assert_eq!(
            model.parsed().tensors[top_level.tok_embeddings].name_hash,
            name_hash("tok_embeddings.weight")
        );
        assert_eq!(
            model.parsed().tensors[layer.wq].name_hash,
            name_hash("layers.0.wq.weight")
        );
        assert_eq!(
            model.layer_indices(1).unwrap_err(),
            ErrorCode::MissingTensor
        );
    }

    fn parsed_gqa_shape(kv_rows: u32) -> ParsedSlm {
        let header = SlmHeader {
            version: 1,
            header_length: 108,
            model_type: 1,
            flags: 0,
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 8,
            layer_count: 1,
            head_count: 4,
            kv_head_count: 2,
            head_dim: 2,
            ffn_size: 16,
            max_context: 16,
            rope_theta: 10_000.0,
            rms_norm_epsilon: 1e-5,
            tokenizer_offset: 128,
            tokenizer_length: 16,
            tensor_directory_offset: 192,
            tensor_count: 12,
            tensor_data_offset: 1024,
            checksum: 1,
        };
        ParsedSlm {
            header,
            tensors: vec![
                test_tensor("tok_embeddings.weight", &[260, 8]),
                test_tensor("norm.weight", &[8]),
                test_tensor("output.weight", &[260, 8]),
                test_tensor("layers.0.attention_norm.weight", &[8]),
                test_tensor("layers.0.ffn_norm.weight", &[8]),
                test_tensor("layers.0.wq.weight", &[8, 8]),
                test_tensor("layers.0.wk.weight", &[kv_rows, 8]),
                test_tensor("layers.0.wv.weight", &[kv_rows, 8]),
                test_tensor("layers.0.wo.weight", &[8, 8]),
                test_tensor("layers.0.w1.weight", &[16, 8]),
                test_tensor("layers.0.w2.weight", &[8, 16]),
                test_tensor("layers.0.w3.weight", &[16, 8]),
            ],
        }
    }

    fn test_tensor(name: &str, dims: &[u32]) -> TensorEntry {
        let mut padded = [1u32; 4];
        for (index, dim) in dims.iter().copied().enumerate() {
            padded[index] = dim;
        }
        TensorEntry {
            name_hash: name_hash(name),
            dtype: DTYPE_F32,
            rank: dims.len() as u32,
            dim0: padded[0],
            dim1: padded[1],
            dim2: padded[2],
            dim3: padded[3],
            byte_offset: 0,
            byte_length: 0,
            scale_offset: 0,
            block_size: 0,
        }
    }

    #[test]
    fn required_shapes_accept_grouped_query_kv_projection_rows() {
        let parsed = parsed_gqa_shape(4);

        validate_required_shapes(&parsed).unwrap();
    }

    #[test]
    fn required_shapes_reject_full_hidden_kv_rows_for_grouped_query_attention() {
        let parsed = parsed_gqa_shape(8);

        assert_eq!(
            validate_required_shapes(&parsed).unwrap_err(),
            ErrorCode::ShapeMismatch
        );
    }

    fn parsed_wide_query_shape(layer_count: u32, qk_norm_layers: u32) -> ParsedSlm {
        let header = SlmHeader {
            version: 1,
            header_length: 108,
            model_type: 1,
            flags: 0,
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 8,
            layer_count,
            head_count: 4,
            kv_head_count: 2,
            head_dim: 4,
            ffn_size: 16,
            max_context: 16,
            rope_theta: 10_000.0,
            rms_norm_epsilon: 1e-5,
            tokenizer_offset: 128,
            tokenizer_length: 16,
            tensor_directory_offset: 192,
            tensor_count: 3 + layer_count * 9 + qk_norm_layers * 2,
            tensor_data_offset: 1024,
            checksum: 1,
        };
        let mut tensors = vec![
            test_tensor("tok_embeddings.weight", &[260, 8]),
            test_tensor("norm.weight", &[8]),
            test_tensor("output.weight", &[260, 8]),
        ];
        for layer in 0..layer_count {
            let prefix = format!("layers.{layer}");
            tensors.extend([
                test_tensor(&format!("{prefix}.attention_norm.weight"), &[8]),
                test_tensor(&format!("{prefix}.ffn_norm.weight"), &[8]),
                test_tensor(&format!("{prefix}.wq.weight"), &[16, 8]),
                test_tensor(&format!("{prefix}.wk.weight"), &[8, 8]),
                test_tensor(&format!("{prefix}.wv.weight"), &[8, 8]),
                test_tensor(&format!("{prefix}.wo.weight"), &[8, 16]),
                test_tensor(&format!("{prefix}.w1.weight"), &[16, 8]),
                test_tensor(&format!("{prefix}.w2.weight"), &[8, 16]),
                test_tensor(&format!("{prefix}.w3.weight"), &[16, 8]),
            ]);
            if layer < qk_norm_layers {
                tensors.push(test_tensor(&format!("{prefix}.q_norm.weight"), &[4]));
                tensors.push(test_tensor(&format!("{prefix}.k_norm.weight"), &[4]));
            }
        }
        ParsedSlm { header, tensors }
    }

    #[test]
    fn required_shapes_accept_wide_query_and_paired_qk_norms() {
        let parsed = parsed_wide_query_shape(1, 1);

        validate_required_shapes(&parsed).unwrap();
        let layer = resolve_layer_indices(&parsed).unwrap()[0];
        assert!(layer.q_norm.is_some());
        assert!(layer.k_norm.is_some());
    }

    #[test]
    fn required_shapes_reject_half_declared_qk_norms() {
        let mut parsed = parsed_wide_query_shape(1, 1);
        parsed
            .tensors
            .retain(|tensor| tensor.name_hash != name_hash("layers.0.k_norm.weight"));

        assert_eq!(
            validate_required_shapes(&parsed).unwrap_err(),
            ErrorCode::MissingTensor
        );
    }

    #[test]
    fn required_shapes_reject_mixed_qk_norm_layer_contracts() {
        let parsed = parsed_wide_query_shape(2, 1);

        assert_eq!(
            validate_required_shapes(&parsed).unwrap_err(),
            ErrorCode::MissingTensor
        );
    }

    #[test]
    fn required_shapes_accept_paired_f32_projection_biases() {
        let mut parsed = parsed_wide_query_shape(1, 0);
        parsed.tensors.push(test_tensor("layers.0.wq.bias", &[16]));
        parsed.tensors.push(test_tensor("layers.0.wk.bias", &[8]));
        parsed.tensors.push(test_tensor("layers.0.wv.bias", &[8]));

        validate_required_shapes(&parsed).unwrap();
        let layer = resolve_layer_indices(&parsed).unwrap()[0];
        assert!(layer.q_bias.is_some());
        assert!(layer.k_bias.is_some());
        assert!(layer.v_bias.is_some());
    }

    #[test]
    fn required_shapes_reject_partial_projection_bias_contract() {
        let mut parsed = parsed_wide_query_shape(1, 0);
        parsed.tensors.push(test_tensor("layers.0.wq.bias", &[16]));
        parsed.tensors.push(test_tensor("layers.0.wk.bias", &[8]));

        assert_eq!(
            validate_required_shapes(&parsed).unwrap_err(),
            ErrorCode::MissingTensor
        );
    }

    #[test]
    fn required_shapes_reject_quantized_projection_bias() {
        let mut parsed = parsed_wide_query_shape(1, 0);
        parsed.tensors.push(test_tensor("layers.0.wq.bias", &[16]));
        parsed.tensors.push(test_tensor("layers.0.wk.bias", &[8]));
        parsed.tensors.push(test_tensor("layers.0.wv.bias", &[8]));
        parsed.tensors.last_mut().unwrap().dtype = DTYPE_Q8_0;

        assert_eq!(
            validate_required_shapes(&parsed).unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }
}
