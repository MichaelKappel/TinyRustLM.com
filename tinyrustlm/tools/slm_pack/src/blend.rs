//! Offline direct-parameter blend operator for model-breeding candidates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::build_model_file_from_values_with_flags;
use crate::lineage;
use crate::slm_validate::{self, ValidationReport};
use crate::tensor_writer::{ModelShape, TensorSpec, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0};
use crate::tokenizer_writer::TokenizerSection;

const BLEND_OPERATOR_VERSION: &str = "1";
const COMPATIBILITY_VERSION: &str = "1";
const OPERATOR_KIND: &str = "direct-parameter-weighted-average";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
pub(crate) const PPM_DENOMINATOR: u32 = 1_000_000;

/// Writes a blended candidate `.slm` plus a recomputable operator receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    left_parent: &Path,
    right_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    parent0_weight_ppm: &str,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let left_bytes = fs::read(left_parent)?;
    let right_bytes = fs::read(right_parent)?;
    let weight = parse_weight_ppm(parent0_weight_ppm)?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &left_bytes,
        &left_parent.display().to_string(),
        &right_bytes,
        &right_parent.display().to_string(),
        &output_slm.display().to_string(),
        weight,
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, receipt)?;
    println!("SLM blended candidate written: {}", output_slm.display());
    println!(
        "SLM blend operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a blended candidate and receipt by recomputing the operator output.
pub(crate) fn validate_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    left_parent: &Path,
    right_parent: &Path,
    candidate_slm: &Path,
    receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let left_bytes = fs::read(left_parent)?;
    let right_bytes = fs::read(right_parent)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_candidate_text(
        &compatibility_text,
        &lineage_text,
        &left_bytes,
        &left_parent.display().to_string(),
        &right_bytes,
        &right_parent.display().to_string(),
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
    )?;
    println!("SLM blend candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

fn validate_candidate_text(
    compatibility_text: &str,
    lineage_text: &str,
    left_bytes: &[u8],
    left_path: &str,
    right_bytes: &[u8],
    right_path: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "blend operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_blend_operator_version",
        BLEND_OPERATOR_VERSION,
    )?;
    let weight = parse_weight_ppm(require_key(&receipt, "parent.0.weight_ppm")?)?;
    require_equal(
        &receipt,
        "parent.1.weight_ppm",
        &(PPM_DENOMINATOR - weight).to_string(),
    )?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        left_bytes,
        left_path,
        right_bytes,
        right_path,
        candidate_path,
        weight,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "blended candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "blend operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn build_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    left_bytes: &[u8],
    left_path: &str,
    right_bytes: &[u8],
    right_path: &str,
    candidate_path: &str,
    parent0_weight_ppm: u32,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let left_report = slm_validate::validate_bytes(left_bytes, left_path)?;
    let right_report = slm_validate::validate_bytes(right_bytes, right_path)?;
    require_parent_report(&compatibility, 0, &left_report)?;
    require_parent_report(&compatibility, 1, &right_report)?;

    let left = parse_model_values(left_bytes)?;
    let right = parse_model_values(right_bytes)?;
    let output_values = blend_values(&left, &right, parent0_weight_ppm)?;
    let output_tensors = output_specs(&left);
    let candidate = build_model_file_from_values_with_flags(
        &left.shape,
        &output_tensors,
        &left.tokenizer,
        &output_values,
        left.flags,
    )?;
    let candidate_report = slm_validate::validate_bytes(&candidate, candidate_path)?;
    require_report_equal(
        &compatibility,
        "parent.0.model_shape",
        &candidate_report.shape_summary(),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.quantization",
        candidate_report.quantization_label(),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.output_contract",
        candidate_report.output_contract_label(),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.tokenizer_checksum",
        &hex64(candidate_report.tokenizer_checksum()),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.tensor_layout_checksum",
        &hex64(candidate_report.tensor_layout_checksum()),
    )?;
    let receipt = build_receipt_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        left_path,
        right_path,
        &left_report,
        &right_report,
        &candidate_report,
        parent0_weight_ppm,
    )?;
    Ok((candidate, receipt))
}

fn build_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    left_path: &str,
    right_path: &str,
    left_report: &ValidationReport,
    right_report: &ValidationReport,
    candidate_report: &ValidationReport,
    parent0_weight_ppm: u32,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_blend_operator_version",
        BLEND_OPERATOR_VERSION,
    );
    push_line(&mut text, "operator_kind", OPERATOR_KIND);
    push_line(&mut text, "operator_status", OPERATOR_STATUS);
    push_line(
        &mut text,
        "candidate_id",
        require_key(lineage_fields, "candidate_id")?,
    );
    push_line(
        &mut text,
        "operator_id",
        require_key(lineage_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(lineage_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(lineage_fields, "resource_budget")?,
    );
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(lineage_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    );
    push_line(
        &mut text,
        "compatibility_scope",
        require_key(compatibility, "compatibility_scope")?,
    );
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, compatibility, 0, left_path, left_report)?;
    push_parent_lines(&mut text, compatibility, 1, right_path, right_report)?;
    push_line(&mut text, "blend_weight_unit", "parts-per-million");
    push_line(
        &mut text,
        "parent.0.weight_ppm",
        &parent0_weight_ppm.to_string(),
    );
    push_line(
        &mut text,
        "parent.1.weight_ppm",
        &(PPM_DENOMINATOR - parent0_weight_ppm).to_string(),
    );
    push_line(
        &mut text,
        "candidate_artifact_path",
        candidate_report.path(),
    );
    push_line(
        &mut text,
        "candidate_artifact_bytes",
        &candidate_report.file_bytes().to_string(),
    );
    push_line(
        &mut text,
        "candidate_slm_version",
        &candidate_report.slm_version().to_string(),
    );
    push_line(
        &mut text,
        "candidate_slm_checksum",
        &hex64(candidate_report.checksum()),
    );
    push_line(
        &mut text,
        "candidate_model_shape",
        &candidate_report.shape_summary(),
    );
    push_line(
        &mut text,
        "candidate_tensor_count",
        &candidate_report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "candidate_parameter_count",
        &candidate_report.parameter_count().to_string(),
    );
    push_line(
        &mut text,
        "candidate_quantization",
        candidate_report.quantization_label(),
    );
    push_line(
        &mut text,
        "candidate_output_contract",
        candidate_report.output_contract_label(),
    );
    push_line(
        &mut text,
        "candidate_tokenizer_checksum",
        &hex64(candidate_report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "candidate_tensor_layout_checksum",
        &hex64(candidate_report.tensor_layout_checksum()),
    );
    push_line(&mut text, "candidate_parent_contract", PARENT_CONTRACT);
    push_line(&mut text, "operator_output_status", OPERATOR_OUTPUT_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

pub(crate) fn push_parent_lines(
    text: &mut String,
    compatibility: &HashMap<String, String>,
    index: usize,
    actual_path: &str,
    report: &ValidationReport,
) -> io::Result<()> {
    let prefix = format!("parent.{index}");
    push_line(
        text,
        &format!("{prefix}.compatibility_path"),
        require_key(compatibility, &format!("{prefix}.path"))?,
    );
    push_line(text, &format!("{prefix}.actual_path"), actual_path);
    push_line(
        text,
        &format!("{prefix}.model_bytes"),
        &report.file_bytes().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.slm_checksum"),
        &hex64(report.checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.model_shape"),
        &report.shape_summary(),
    );
    push_line(
        text,
        &format!("{prefix}.quantization"),
        report.quantization_label(),
    );
    push_line(
        text,
        &format!("{prefix}.output_contract"),
        report.output_contract_label(),
    );
    push_line(
        text,
        &format!("{prefix}.tokenizer_checksum"),
        &hex64(report.tokenizer_checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.tensor_layout_checksum"),
        &hex64(report.tensor_layout_checksum()),
    );
    Ok(())
}

fn blend_values(
    left: &ParsedModel,
    right: &ParsedModel,
    parent0_weight_ppm: u32,
) -> io::Result<Vec<Vec<f32>>> {
    if !same_shape(&left.shape, &right.shape) {
        return Err(invalid("blend parents have different model shapes"));
    }
    if left.flags != right.flags {
        return Err(invalid("blend parents have different output flags"));
    }
    if left.tokenizer.bytes != right.tokenizer.bytes {
        return Err(invalid("blend parents have different tokenizer bytes"));
    }
    let right_by_hash = right
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let left_weight = parent0_weight_ppm as f32 / PPM_DENOMINATOR as f32;
    let right_weight = 1.0 - left_weight;
    let mut output = Vec::with_capacity(left.tensors.len());
    for left_tensor in &left.tensors {
        let Some(right_index) = right_by_hash.get(&left_tensor.spec.name_hash) else {
            return Err(invalid(
                "right parent is missing a tensor from the left parent",
            ));
        };
        let right_tensor = &right.tensors[*right_index];
        require_same_tensor_spec(&left_tensor.spec, &right_tensor.spec)?;
        let values = left_tensor
            .values
            .iter()
            .zip(right_tensor.values.iter())
            .map(|(left_value, right_value)| {
                left_value.mul_add(left_weight, right_value * right_weight)
            })
            .collect::<Vec<_>>();
        output.push(values);
    }
    Ok(output)
}

pub(crate) fn output_specs(model: &ParsedModel) -> Vec<TensorSpec> {
    model
        .tensors
        .iter()
        .map(|tensor| TensorSpec {
            name_hash: tensor.spec.name_hash,
            dtype: tensor.spec.dtype,
            rank: tensor.spec.rank,
            dims: tensor.spec.dims,
            seed: 0,
            block_size: tensor.spec.block_size,
        })
        .collect()
}

pub(crate) fn require_parent_report(
    compatibility: &HashMap<String, String>,
    index: usize,
    report: &ValidationReport,
) -> io::Result<()> {
    let prefix = format!("parent.{index}");
    require_report_equal(
        compatibility,
        &format!("{prefix}.model_bytes"),
        &report.file_bytes().to_string(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.slm_version"),
        &report.slm_version().to_string(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.slm_checksum"),
        &hex64(report.checksum()),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.model_shape"),
        &report.shape_summary(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.tensor_count"),
        &report.tensor_count().to_string(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.parameter_count"),
        &report.parameter_count().to_string(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.quantization"),
        report.quantization_label(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.output_contract"),
        report.output_contract_label(),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.tokenizer_checksum"),
        &hex64(report.tokenizer_checksum()),
    )?;
    require_report_equal(
        compatibility,
        &format!("{prefix}.tensor_layout_checksum"),
        &hex64(report.tensor_layout_checksum()),
    )?;
    Ok(())
}

pub(crate) fn parse_passing_compatibility(text: &str) -> io::Result<HashMap<String, String>> {
    let fields = parse_manifest(text, "compatibility")?;
    require_equal(
        &fields,
        "tinyrustlm_parent_compatibility_version",
        COMPATIBILITY_VERSION,
    )?;
    require_equal(&fields, "compatibility_result", "pass")?;
    require_equal(&fields, "compatible_parent_set", "true")?;
    require_equal(&fields, "parent_count", "2")?;
    require_equal(&fields, "compatibility_reasons", "all-compatible")?;
    require_equal(
        &fields,
        "decision",
        "accepted-parent-set-for-offline-operators",
    )?;
    Ok(fields)
}

pub(crate) struct ParsedModel {
    pub(crate) shape: ModelShape,
    pub(crate) flags: u32,
    pub(crate) tokenizer: TokenizerSection,
    pub(crate) tensors: Vec<ParsedTensor>,
}

pub(crate) struct ParsedTensor {
    pub(crate) spec: TensorSpec,
    pub(crate) values: Vec<f32>,
}

struct Header {
    flags: u32,
    vocab_size: u32,
    special_token_count: u32,
    hidden_size: u32,
    layer_count: u32,
    head_count: u32,
    kv_head_count: u32,
    head_dim: u32,
    ffn_size: u32,
    max_context: u32,
    rope_theta: f32,
    rms_norm_epsilon: f32,
    tokenizer_offset: u64,
    tokenizer_length: u64,
    tensor_directory_offset: u64,
    tensor_count: u32,
}

struct TensorEntry {
    spec: TensorSpec,
    byte_offset: u64,
    byte_length: u64,
    scale_offset: u64,
}

pub(crate) fn parse_model_values(bytes: &[u8]) -> io::Result<ParsedModel> {
    let header = parse_header(bytes)?;
    let tokenizer = tokenizer_section(bytes, &header)?;
    let entries = parse_tensor_entries(bytes, &header)?;
    let mut tensors = Vec::with_capacity(entries.len());
    for entry in entries {
        let values = read_tensor_values(bytes, &entry)?;
        tensors.push(ParsedTensor {
            spec: entry.spec,
            values,
        });
    }
    Ok(ParsedModel {
        shape: ModelShape {
            vocab_size: header.vocab_size,
            special_token_count: header.special_token_count,
            hidden_size: header.hidden_size,
            layer_count: header.layer_count,
            head_count: header.head_count,
            kv_head_count: header.kv_head_count,
            head_dim: header.head_dim,
            ffn_size: header.ffn_size,
            max_context: header.max_context,
            rope_theta: header.rope_theta,
            rms_norm_epsilon: header.rms_norm_epsilon,
        },
        flags: header.flags,
        tokenizer,
        tensors,
    })
}

fn parse_header(bytes: &[u8]) -> io::Result<Header> {
    if bytes.get(0..4) != Some(b"SLM1") {
        return Err(invalid("blend parent has invalid SLM magic"));
    }
    Ok(Header {
        flags: read_u32(bytes, 16)?,
        vocab_size: read_u32(bytes, 20)?,
        special_token_count: read_u32(bytes, 24)?,
        hidden_size: read_u32(bytes, 28)?,
        layer_count: read_u32(bytes, 32)?,
        head_count: read_u32(bytes, 36)?,
        kv_head_count: read_u32(bytes, 40)?,
        head_dim: read_u32(bytes, 44)?,
        ffn_size: read_u32(bytes, 48)?,
        max_context: read_u32(bytes, 52)?,
        rope_theta: read_f32_at(bytes, 56)?,
        rms_norm_epsilon: read_f32_at(bytes, 60)?,
        tokenizer_offset: read_u64(bytes, 64)?,
        tokenizer_length: read_u64(bytes, 72)?,
        tensor_directory_offset: read_u64(bytes, 80)?,
        tensor_count: read_u32(bytes, 88)?,
    })
}

fn tokenizer_section(bytes: &[u8], header: &Header) -> io::Result<TokenizerSection> {
    let start = as_usize(header.tokenizer_offset)?;
    let len = as_usize(header.tokenizer_length)?;
    let end = start
        .checked_add(len)
        .ok_or_else(|| invalid("tokenizer range overflow"))?;
    let tokenizer = bytes
        .get(start..end)
        .ok_or_else(|| invalid("tokenizer range escapes blend parent"))?;
    Ok(TokenizerSection {
        bytes: tokenizer.to_vec(),
    })
}

fn parse_tensor_entries(bytes: &[u8], header: &Header) -> io::Result<Vec<TensorEntry>> {
    let start = as_usize(header.tensor_directory_offset)?;
    let mut tensors = Vec::with_capacity(header.tensor_count as usize);
    for index in 0..header.tensor_count as usize {
        let base = start
            .checked_add(index * 64)
            .ok_or_else(|| invalid("tensor directory offset overflow"))?;
        let spec = TensorSpec {
            name_hash: read_u64(bytes, base)?,
            dtype: read_u32(bytes, base + 8)?,
            rank: read_u32(bytes, base + 12)?,
            dims: [
                read_u32(bytes, base + 16)?,
                read_u32(bytes, base + 20)?,
                read_u32(bytes, base + 24)?,
                read_u32(bytes, base + 28)?,
            ],
            seed: 0,
            block_size: read_u32(bytes, base + 56)?,
        };
        tensors.push(TensorEntry {
            spec,
            byte_offset: read_u64(bytes, base + 32)?,
            byte_length: read_u64(bytes, base + 40)?,
            scale_offset: read_u64(bytes, base + 48)?,
        });
    }
    Ok(tensors)
}

fn read_tensor_values(bytes: &[u8], entry: &TensorEntry) -> io::Result<Vec<f32>> {
    match entry.spec.dtype {
        DTYPE_F32 => read_f32_values(bytes, entry),
        DTYPE_Q8_0 => read_q8_values(bytes, entry),
        DTYPE_Q4_0 => read_q4_values(bytes, entry),
        _ => Err(invalid("blend parent uses unsupported tensor dtype")),
    }
}

fn read_f32_values(bytes: &[u8], entry: &TensorEntry) -> io::Result<Vec<f32>> {
    let start = as_usize(entry.byte_offset)?;
    let len = as_usize(entry.byte_length)?;
    let payload = bytes
        .get(start..start + len)
        .ok_or_else(|| invalid("f32 tensor payload escapes blend parent"))?;
    let mut values = Vec::with_capacity(payload.len() / 4);
    for chunk in payload.chunks_exact(4) {
        values.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    Ok(values)
}

fn read_q8_values(bytes: &[u8], entry: &TensorEntry) -> io::Result<Vec<f32>> {
    let rows = entry.spec.rows();
    let cols = entry.spec.cols_per_row();
    let start = as_usize(entry.byte_offset)?;
    let scale_start = as_usize(entry.scale_offset)?;
    let payload = bytes
        .get(start..start + rows * cols)
        .ok_or_else(|| invalid("q8 tensor payload escapes blend parent"))?;
    let scales = bytes
        .get(scale_start..scale_start + rows * 4)
        .ok_or_else(|| invalid("q8 scale payload escapes blend parent"))?;
    let mut values = Vec::with_capacity(rows * cols);
    for row in 0..rows {
        let scale = read_f32_at(scales, row * 4)?;
        for col in 0..cols {
            let quantized = payload[row * cols + col] as i8;
            values.push(quantized as f32 * scale);
        }
    }
    Ok(values)
}

fn read_q4_values(bytes: &[u8], entry: &TensorEntry) -> io::Result<Vec<f32>> {
    let rows = entry.spec.rows();
    let cols = entry.spec.cols_per_row();
    let block = entry.spec.block_size as usize;
    if block == 0 || !cols.is_multiple_of(block) {
        return Err(invalid("q4 tensor block layout is invalid for blending"));
    }
    let blocks_per_row = cols / block;
    let start = as_usize(entry.byte_offset)?;
    let scale_start = as_usize(entry.scale_offset)?;
    let payload_len = rows
        .checked_mul(cols)
        .and_then(|elements| elements.checked_div(2))
        .ok_or_else(|| invalid("q4 tensor payload length overflow"))?;
    let payload = bytes
        .get(start..start + payload_len)
        .ok_or_else(|| invalid("q4 tensor payload escapes blend parent"))?;
    let scale_len = rows
        .checked_mul(blocks_per_row)
        .and_then(|scales| scales.checked_mul(4))
        .ok_or_else(|| invalid("q4 scale payload length overflow"))?;
    let scales = bytes
        .get(scale_start..scale_start + scale_len)
        .ok_or_else(|| invalid("q4 scale payload escapes blend parent"))?;
    let mut values = Vec::with_capacity(rows * cols);
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let scale = read_f32_at(scales, (row * blocks_per_row + block_index) * 4)?;
            for col in 0..block {
                let absolute_col = block_index * block + col;
                let byte = payload[(row * cols + absolute_col) / 2];
                let nibble = if absolute_col.is_multiple_of(2) {
                    byte & 0x0f
                } else {
                    byte >> 4
                };
                values.push(sign_extend_q4(nibble) as f32 * scale);
            }
        }
    }
    Ok(values)
}

pub(crate) fn require_same_tensor_spec(left: &TensorSpec, right: &TensorSpec) -> io::Result<()> {
    if left.name_hash != right.name_hash
        || left.dtype != right.dtype
        || left.rank != right.rank
        || left.dims != right.dims
        || left.block_size != right.block_size
    {
        return Err(invalid("blend parents have different tensor layouts"));
    }
    Ok(())
}

pub(crate) fn same_shape(left: &ModelShape, right: &ModelShape) -> bool {
    left.vocab_size == right.vocab_size
        && left.special_token_count == right.special_token_count
        && left.hidden_size == right.hidden_size
        && left.layer_count == right.layer_count
        && left.head_count == right.head_count
        && left.kv_head_count == right.kv_head_count
        && left.head_dim == right.head_dim
        && left.ffn_size == right.ffn_size
        && left.max_context == right.max_context
}

pub(crate) fn parse_manifest(text: &str, label: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "{label} line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty()
            || !key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
        {
            return Err(invalid(&format!(
                "{label} line {} has an invalid key",
                line_index + 1
            )));
        }
        if value.is_empty() || value.contains('\n') || value.contains('\r') {
            return Err(invalid(&format!("{key} has an invalid value")));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate {label} key {key}")));
        }
    }
    Ok(fields)
}

fn parse_weight_ppm(value: &str) -> io::Result<u32> {
    let weight = value
        .parse::<u32>()
        .map_err(|_| invalid("blend weight must be an integer parts-per-million value"))?;
    if weight > PPM_DENOMINATOR {
        return Err(invalid("blend weight must be between 0 and 1000000"));
    }
    Ok(weight)
}

pub(crate) fn require_key<'a>(
    fields: &'a HashMap<String, String>,
    key: &str,
) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("manifest missing required key {key}")))
}

pub(crate) fn require_equal(
    fields: &HashMap<String, String>,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "manifest key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

pub(crate) fn require_report_equal(
    fields: &HashMap<String, String>,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "operator expected {key} {actual}, current artifact has {expected}"
        )));
    }
    Ok(())
}

fn read_u32(bytes: &[u8], offset: usize) -> io::Result<u32> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| invalid("u32 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading u32"))?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u64(bytes: &[u8], offset: usize) -> io::Result<u64> {
    let end = offset
        .checked_add(8)
        .ok_or_else(|| invalid("u64 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading u64"))?;
    Ok(u64::from_le_bytes([
        slice[0], slice[1], slice[2], slice[3], slice[4], slice[5], slice[6], slice[7],
    ]))
}

fn read_f32_at(bytes: &[u8], offset: usize) -> io::Result<f32> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| invalid("f32 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading f32"))?;
    Ok(f32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn sign_extend_q4(nibble: u8) -> i8 {
    if nibble & 0x08 != 0 {
        (nibble as i8) - 16
    } else {
        nibble as i8
    }
}

fn as_usize(value: u64) -> io::Result<usize> {
    usize::try_from(value).map_err(|_| invalid("value does not fit in usize"))
}

pub(crate) fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

pub(crate) fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

pub(crate) fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compatibility;
    use crate::tensor_writer::{tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use crate::{build_model_file, build_model_file_from_values_with_flags, fixture_value};

    #[test]
    fn parsed_model_preserves_header_numerical_configuration() {
        let mut shape = ModelShape::tiny_fixture();
        shape.rope_theta = 100_000.0;
        shape.rms_norm_epsilon = 1e-6;
        let tensors = tiny_fixture_tensors();
        let bytes = build_model_file(&shape, &tensors, &ByteTokenizerSection::phase_one()).unwrap();

        let parsed = parse_model_values(&bytes).unwrap();

        assert_eq!(parsed.shape.rope_theta, 100_000.0);
        assert_eq!(parsed.shape.rms_norm_epsilon, 1e-6);
    }

    #[test]
    fn writes_and_validates_weighted_f32_blend_candidate() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "blend-f32", "average-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            250_000,
        )
        .unwrap();

        validate_candidate_text(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        let parsed = parse_model_values(&candidate).unwrap();
        assert_eq!(parsed.tensors[0].values[0], 0.3125);
        assert!(receipt.contains("operator_kind=direct-parameter-weighted-average"));
        assert!(receipt.contains("parent.0.weight_ppm=250000"));
        assert!(receipt.contains("parent.1.weight_ppm=750000"));
    }

    #[test]
    fn writes_and_validates_q8_blend_candidate() {
        let left = tiny_q8_bytes();
        let right = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "blend-q8", "average-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            500_000,
        )
        .unwrap();

        slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        validate_candidate_text(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("candidate_quantization=q8_0"));
    }

    #[test]
    fn rejects_parent_checksum_drift() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "blend-f32", "average-v1", "tiny")
                .unwrap();
        let changed_left = tiny_f32_scaled_bytes(2.0);

        let error = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &changed_left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            500_000,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    #[test]
    fn validation_rejects_candidate_drift() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "blend-f32", "average-v1", "tiny")
                .unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            500_000,
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_candidate_text(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    #[test]
    fn rejects_invalid_blend_weight() {
        let error = parse_weight_ppm("1000001").unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    fn tiny_f32_scaled_bytes(scale: f32) -> Vec<u8> {
        let tensors = tiny_fixture_tensors();
        let values = tensors
            .iter()
            .map(|tensor| {
                (0..tensor.element_count())
                    .map(|index| fixture_value(tensor, index) * scale)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        build_model_file_from_values_with_flags(
            &ModelShape::tiny_fixture(),
            &tensors,
            &ByteTokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap()
    }

    fn tiny_q8_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
