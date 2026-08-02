//! GGUF metadata intake and fail-closed standard-model conversion.

use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::Path;

use crate::tokenizer_writer::{BpeMergeSpec, BpeTokenSpec};
use crate::trained_source;

const GGUF_REPORT_VERSION: &str = "1";
const GGUF_SOURCE_PLAN_VERSION: &str = "1";
const GGUF_SUPPORTED_SOURCE_TENSOR_TYPES: &str =
    "F32, F16, BF16, Q2_K, Q3_K, Q4_0, Q4_1, Q4_K, Q5_0, Q5_1, Q5_K, Q6_K, Q8_0, Q8_1, or Q8_K";
const GGUF_MAGIC: &[u8; 4] = b"GGUF";
const DEFAULT_ALIGNMENT: u64 = 32;
const MAX_METADATA_KV_COUNT: u64 = 100_000;
const MAX_TENSOR_COUNT: u64 = 1_000_000;
const MAX_STRING_BYTES: u64 = 1024 * 1024;
const MAX_METADATA_ARRAY_ITEMS: u64 = 1_000_000;
const MAX_DIMENSIONS: u32 = 8;
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
const GGUF_SOURCE_PLAN_LAYOUT: &str = "gguf-to-raw-f32-source-plan-v1";
const RAW_SOURCE_LAYOUT: &str = "raw-f32-tensor-files-v1";
const GGUF_Q4_0_BLOCK_ELEMENTS: usize = 32;
const GGUF_Q4_0_BLOCK_BYTES: usize = 18;
const GGUF_Q4_0_FIXTURE_SCALE_BITS: u16 = 0x2800;
const GGUF_Q4_1_BLOCK_ELEMENTS: usize = 32;
const GGUF_Q4_1_BLOCK_BYTES: usize = 20;
const GGUF_Q4_1_FIXTURE_SCALE_BITS: u16 = 0x2400;
const GGUF_Q4_1_FIXTURE_MIN_BITS: u16 = 0x0000;
const GGUF_Q4_K_BLOCK_ELEMENTS: usize = 256;
const GGUF_Q4_K_BLOCK_BYTES: usize = 144;
const GGUF_Q4_K_SCALE_BYTES: usize = 12;
const GGUF_Q4_K_QUANT_BYTES: usize = 128;
const GGUF_Q4_K_GROUP_COUNT: usize = 8;
const GGUF_Q4_K_GROUP_ELEMENTS: usize = 32;
const GGUF_Q4_K_FIXTURE_SCALE_BITS: u16 = 0x2800;
const GGUF_Q4_K_FIXTURE_MIN_BITS: u16 = 0x0000;
const GGUF_Q4_K_FIXTURE_SUBSCALE: u8 = 1;
const GGUF_Q4_K_FIXTURE_SUBMIN: u8 = 0;
const GGUF_Q5_0_BLOCK_ELEMENTS: usize = 32;
const GGUF_Q5_0_BLOCK_BYTES: usize = 22;
const GGUF_Q5_0_FIXTURE_SCALE_BITS: u16 = 0x2400;
const GGUF_Q5_1_BLOCK_ELEMENTS: usize = 32;
const GGUF_Q5_1_BLOCK_BYTES: usize = 24;
const GGUF_Q5_1_FIXTURE_SCALE_BITS: u16 = 0x2000;
const GGUF_Q5_1_FIXTURE_MIN_BITS: u16 = 0x0000;
const GGUF_Q2_K_BLOCK_ELEMENTS: usize = 256;
const GGUF_Q2_K_BLOCK_BYTES: usize = 84;
const GGUF_Q2_K_SCALE_BYTES: usize = 16;
const GGUF_Q2_K_QUANT_BYTES: usize = 64;
const GGUF_Q2_K_GROUP_COUNT: usize = 16;
const GGUF_Q2_K_GROUP_ELEMENTS: usize = 16;
const GGUF_Q2_K_FIXTURE_SCALE: f32 = 0.01;
const GGUF_Q2_K_FIXTURE_MIN_BITS: u16 = 0x0000;
const GGUF_Q3_K_BLOCK_ELEMENTS: usize = 256;
const GGUF_Q3_K_BLOCK_BYTES: usize = 110;
const GGUF_Q3_K_HIGH_BYTES: usize = 32;
const GGUF_Q3_K_QUANT_BYTES: usize = 64;
const GGUF_Q3_K_SCALE_BYTES: usize = 12;
const GGUF_Q3_K_GROUP_COUNT: usize = 16;
const GGUF_Q3_K_GROUP_ELEMENTS: usize = 16;
const GGUF_Q3_K_FIXTURE_SCALE: f32 = 0.01;
const GGUF_Q5_K_BLOCK_ELEMENTS: usize = 256;
const GGUF_Q5_K_BLOCK_BYTES: usize = 176;
const GGUF_Q5_K_HIGH_BYTES: usize = 32;
const GGUF_Q5_K_QUANT_BYTES: usize = 128;
const GGUF_Q5_K_FIXTURE_SCALE_BITS: u16 = 0x2400;
const GGUF_Q5_K_FIXTURE_MIN_BITS: u16 = 0x0000;
const GGUF_Q5_K_FIXTURE_SUBSCALE: u8 = 1;
const GGUF_Q5_K_FIXTURE_SUBMIN: u8 = 0;
const GGUF_Q6_K_BLOCK_ELEMENTS: usize = 256;
const GGUF_Q6_K_BLOCK_BYTES: usize = 210;
const GGUF_Q6_K_LOW_BYTES: usize = 128;
const GGUF_Q6_K_HIGH_BYTES: usize = 64;
const GGUF_Q6_K_SCALE_COUNT: usize = 16;
const GGUF_Q6_K_SCALE_BYTES: usize = 16;
const GGUF_Q6_K_FIXTURE_SCALE_BITS: u16 = 0x2000;
const GGUF_Q6_K_FIXTURE_SUBSCALE: i8 = 1;
const GGUF_Q8_0_BLOCK_ELEMENTS: usize = 32;
const GGUF_Q8_0_BLOCK_BYTES: usize = 34;
const GGUF_Q8_0_FIXTURE_SCALE_BITS: u16 = 0x2000;
const GGUF_Q8_1_BLOCK_ELEMENTS: usize = 32;
const GGUF_Q8_1_BLOCK_BYTES: usize = 36;
const GGUF_Q8_1_FIXTURE_SCALE_BITS: u16 = 0x2000;
const GGUF_Q8_K_BLOCK_ELEMENTS: usize = 256;
const GGUF_Q8_K_BLOCK_BYTES: usize = 292;
const GGUF_Q8_K_QUANT_BYTES: usize = 256;
const GGUF_Q8_K_BSUM_COUNT: usize = 16;
const GGUF_Q8_K_BSUM_BYTES: usize = 32;
const GGUF_Q8_K_FIXTURE_SCALE: f32 = 0.01;

#[derive(Clone, Debug)]
struct TensorInfo {
    name: String,
    type_name: &'static str,
    shape: Vec<u64>,
    element_count: u64,
    relative_offset: u64,
    absolute_start: u64,
    byte_count: u64,
    absolute_end: u64,
}

#[derive(Debug, Default)]
struct TypeStats {
    tensor_count: u64,
    parameter_count: u64,
    data_bytes: u64,
}

#[derive(Debug)]
struct GgufInspection {
    source_path: String,
    file_bytes: u64,
    version: u32,
    metadata_kv_count: u64,
    tensor_count: u64,
    alignment: u64,
    architecture: Option<String>,
    model_name: Option<String>,
    tokenizer: GgufTokenizerMetadata,
    metadata_checksum: u64,
    tensor_directory_checksum: u64,
    tensor_directory_bytes: u64,
    tensor_data_offset: u64,
    tensor_data_bytes: u64,
    tensor_data_span_end: u64,
    tensors: Vec<TensorInfo>,
    type_stats: BTreeMap<&'static str, TypeStats>,
}

#[derive(Clone, Debug, Default)]
struct GgufTokenizerMetadata {
    model: Option<String>,
    token_count: Option<u64>,
    token_checksum: Option<u64>,
    tokens: Option<Vec<String>>,
    merge_count: Option<u64>,
    merge_checksum: Option<u64>,
    merges: Option<Vec<String>>,
}

#[derive(Debug)]
struct SourceTensorPlan {
    name: String,
    source_name: String,
    type_name: &'static str,
    shape: Vec<u64>,
    absolute_start: u64,
    absolute_end: u64,
    raw_source_file: String,
    raw_source_bytes: u64,
    conversion_action: &'static str,
}

#[derive(Debug)]
struct SourcePlan {
    inspection: GgufInspection,
    target_model_shape: String,
    target_vocab_size: u32,
    target_tokenizer_strategy: &'static str,
    tokenizer_compatibility_status: &'static str,
    conversion_status: &'static str,
    raw_source_bytes: u64,
    tensors: Vec<SourceTensorPlan>,
}

struct GgufReader {
    file: File,
    offset: u64,
}

#[derive(Clone, Copy)]
struct GgmlType {
    id: u32,
    name: &'static str,
    block_size: u64,
    type_size: u64,
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum SourceFixtureEncoding {
    F32,
    Q4_0,
    Q4_1,
    Q4K,
    Q5_0,
    Q5_1,
    Q2K,
    Q3K,
    Q5K,
    Q6K,
    Q8_0,
    Q8_1,
    Q8K,
}

enum MetadataValueSummary {
    U32(u32),
    U64(u64),
    String(String),
    StringArray {
        count: u64,
        checksum: u64,
        values: Option<Vec<String>>,
    },
    Other,
}

/// Reads a local `.gguf` file header and tensor directory without loading tensor data.
pub fn inspect_path(input: &Path, output_report: Option<&Path>) -> io::Result<()> {
    let inspection = inspect_input(input)?;
    let report = render_report(&inspection);
    if let Some(output) = output_report {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output, &report)?;
    }
    println!("GGUF inspection: PASS");
    println!("source_path: {}", inspection.source_path);
    println!("gguf_version: {}", inspection.version);
    println!("tensor_count: {}", inspection.tensor_count);
    println!("tensor_data_bytes: {}", inspection.tensor_data_bytes);
    Ok(())
}

/// Writes a tiny deterministic GGUF file for public CLI and parser tests.
pub fn write_fixture_path(output: &Path) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = fixture_bytes()?;
    fs::write(output, bytes)?;
    println!("GGUF fixture written: {}", output.display());
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture for conversion smoke tests.
pub fn write_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q8_0 matrix payloads.
pub fn write_q8_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q8_0(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q8_0 source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q8_1 matrix payloads.
pub fn write_q8_1_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q8_1(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q8_1 source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q8_K matrix payloads.
pub fn write_q8_k_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q8_k(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q8_K source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q4_0 matrix payloads.
pub fn write_q4_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q4_0(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q4_0 source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q4_1 matrix payloads.
pub fn write_q4_1_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q4_1(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q4_1 source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q4_K matrix payloads.
pub fn write_q4_k_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q4_k(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q4_K source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q5_0 matrix payloads.
pub fn write_q5_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q5_0(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q5_0 source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q5_1 matrix payloads.
pub fn write_q5_1_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q5_1(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q5_1 source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q2_K matrix payloads.
pub fn write_q2_k_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q2_k(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q2_K source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q3_K matrix payloads.
pub fn write_q3_k_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q3_k(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q3_K source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q5_K matrix payloads.
pub fn write_q5_k_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q5_k(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q5_K source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture with Q6_K matrix payloads.
pub fn write_q6_k_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes_with_q6_k(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF Q6_K source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Plans how a local `.gguf` tensor directory maps into raw f32 source files.
pub fn plan_source_path(
    input: &Path,
    shape_name: &str,
    output_plan: Option<&Path>,
) -> io::Result<()> {
    let plan = build_source_plan(input, shape_name)?;
    let report = render_source_plan(&plan);
    if let Some(output) = output_plan {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output, &report)?;
    }
    println!("GGUF source plan: PASS");
    println!("source_path: {}", plan.inspection.source_path);
    println!("target_model_shape: {}", plan.target_model_shape);
    println!("matched_tensor_count: {}", plan.tensors.len());
    println!("raw_source_bytes: {}", plan.raw_source_bytes);
    println!("conversion_status: {}", plan.conversion_status);
    Ok(())
}

/// Extracts checked GGUF tensors into the raw f32 trained-source layout.
pub fn extract_source_path(input: &Path, shape_name: &str, output_dir: &Path) -> io::Result<()> {
    let plan = build_source_plan(input, shape_name)?;
    let payloads = extract_source_payloads(input, &plan)?;
    let source_id = format!(
        "gguf-tensor-directory-{}",
        hex64(plan.inspection.tensor_directory_checksum)
    );
    let source_training_summary = format!(
        "Extracted {} checked GGUF tensors into TinyRustLM raw f32 source layout",
        plan.tensors.len()
    );
    let tokenizer_override = gguf_tokenizer_override_for_source_shape(&plan)?;
    let metadata = trained_source::SourceExportMetadata {
        source_id: &source_id,
        source_license: "local-gguf-source-review",
        source_dataset: "local-gguf-source-export",
        source_training_summary: &source_training_summary,
        source_review_kind: None,
        source_review_status: None,
        source_review_checksum: None,
        source_review_required_next_gate: None,
        source_tokenizer_override: tokenizer_override.as_ref(),
    };
    trained_source::write_source_export_path(output_dir, shape_name, &metadata, &payloads)?;
    println!("GGUF source extraction: PASS");
    println!("source_path: {}", plan.inspection.source_path);
    println!("target_model_shape: {}", plan.target_model_shape);
    println!("output_source_dir: {}", output_dir.display());
    println!("extracted_tensor_count: {}", payloads.len());
    println!("raw_source_bytes: {}", plan.raw_source_bytes);
    println!(
        "source_plan_mapping_checksum: {}",
        hex64(source_plan_mapping_checksum(&plan.tensors))
    );
    Ok(())
}

/// Converts checked GGUF tensors into an `.slm` through the raw source layout.
pub fn convert_source_path(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_slm: &Path,
    output_quantization: &str,
) -> io::Result<()> {
    trained_source::validate_output_quantization(output_quantization)?;
    extract_source_path(input, shape_name, output_source_dir)?;
    trained_source::validate_source_path(output_source_dir)?;
    trained_source::convert_trained_path(output_source_dir, output_slm, output_quantization)?;
    println!("GGUF trained conversion: PASS");
    println!("source_path: {}", input.display());
    println!("target_model_shape: {shape_name}");
    println!("output_quantization: {output_quantization}");
    println!("output_slm: {}", output_slm.display());
    Ok(())
}

fn inspect_input(input: &Path) -> io::Result<GgufInspection> {
    let mut reader = GgufReader::open(input)?;
    let file_bytes = reader.file.metadata()?.len();
    let magic = reader.read_bytes(4)?;
    if magic.as_slice() != GGUF_MAGIC {
        return invalid_data("not a GGUF file: missing GGUF magic");
    }
    let version = reader.read_u32()?;
    if version != 2 && version != 3 {
        return invalid_data(format!("unsupported GGUF version {version}"));
    }

    let tensor_count = reader.read_u64()?;
    let metadata_kv_count = reader.read_u64()?;
    if tensor_count == 0 {
        return invalid_data("GGUF inspection requires at least one tensor");
    }
    if tensor_count > MAX_TENSOR_COUNT {
        return invalid_data(format!(
            "GGUF tensor count {tensor_count} exceeds limit {MAX_TENSOR_COUNT}"
        ));
    }
    if metadata_kv_count > MAX_METADATA_KV_COUNT {
        return invalid_data(format!(
            "GGUF metadata count {metadata_kv_count} exceeds limit {MAX_METADATA_KV_COUNT}"
        ));
    }

    let mut metadata_checksum = FNV_OFFSET;
    let mut alignment = DEFAULT_ALIGNMENT;
    let mut architecture = None;
    let mut model_name = None;
    let mut tokenizer = GgufTokenizerMetadata::default();
    for _ in 0..metadata_kv_count {
        let key = reader.read_string()?;
        fnv_update(&mut metadata_checksum, key.as_bytes());
        let value_type = reader.read_u32()?;
        fnv_update(&mut metadata_checksum, &value_type.to_le_bytes());
        let capture_string_array = matches!(
            key.as_str(),
            "tokenizer.ggml.tokens" | "tokenizer.ggml.merges"
        );
        let value = read_metadata_value(
            &mut reader,
            value_type,
            &mut metadata_checksum,
            capture_string_array,
        )?;
        match (key.as_str(), value) {
            ("general.alignment", MetadataValueSummary::U32(value)) => {
                alignment = u64::from(value);
            }
            ("general.alignment", MetadataValueSummary::U64(value)) => {
                alignment = value;
            }
            ("general.architecture", MetadataValueSummary::String(value)) => {
                architecture = Some(value);
            }
            ("general.name", MetadataValueSummary::String(value)) => {
                model_name = Some(value);
            }
            ("tokenizer.ggml.model", MetadataValueSummary::String(value)) => {
                tokenizer.model = Some(value);
            }
            (
                "tokenizer.ggml.tokens",
                MetadataValueSummary::StringArray {
                    count,
                    checksum,
                    values,
                },
            ) => {
                tokenizer.token_count = Some(count);
                tokenizer.token_checksum = Some(checksum);
                tokenizer.tokens = values;
            }
            (
                "tokenizer.ggml.merges",
                MetadataValueSummary::StringArray {
                    count,
                    checksum,
                    values,
                },
            ) => {
                tokenizer.merge_count = Some(count);
                tokenizer.merge_checksum = Some(checksum);
                tokenizer.merges = values;
            }
            _ => {}
        }
    }
    validate_alignment(alignment)?;

    let tensor_directory_start = reader.offset;
    let mut tensor_directory_checksum = FNV_OFFSET;
    let mut tensors = Vec::new();
    for _ in 0..tensor_count {
        let tensor = read_tensor_info(&mut reader, &mut tensor_directory_checksum)?;
        tensors.push(tensor);
    }
    let tensor_directory_bytes = reader
        .offset
        .checked_sub(tensor_directory_start)
        .ok_or_else(|| invalid_data_error("GGUF tensor directory offset underflow"))?;
    let tensor_data_offset = align_to(reader.offset, alignment)?;
    if file_bytes < tensor_data_offset {
        return invalid_data(format!(
            "GGUF tensor data offset {tensor_data_offset} exceeds file size {file_bytes}"
        ));
    }

    let mut spans = Vec::new();
    let mut resolved_tensors = Vec::with_capacity(tensors.len());
    for mut tensor in tensors {
        if tensor.relative_offset % alignment != 0 {
            return invalid_data(format!(
                "GGUF tensor {} relative offset {} is not aligned to {} bytes",
                tensor.name, tensor.relative_offset, alignment
            ));
        }
        tensor.absolute_start = tensor_data_offset
            .checked_add(tensor.relative_offset)
            .ok_or_else(|| invalid_data_error("GGUF tensor absolute offset overflow"))?;
        tensor.absolute_end = tensor
            .absolute_start
            .checked_add(tensor.byte_count)
            .ok_or_else(|| invalid_data_error("GGUF tensor byte range overflow"))?;
        if tensor.absolute_end > file_bytes {
            return invalid_data(format!(
                "GGUF tensor {} ends at byte {} beyond file size {}",
                tensor.name, tensor.absolute_end, file_bytes
            ));
        }
        spans.push((
            tensor.absolute_start,
            tensor.absolute_end,
            tensor.name.clone(),
        ));
        resolved_tensors.push(tensor);
    }
    spans.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(&right.1)));
    let mut previous_end = tensor_data_offset;
    let mut previous_name = String::new();
    for (start, end, name) in spans {
        if start < previous_end {
            return invalid_data(format!(
                "GGUF tensor {name} overlaps previous tensor {previous_name}"
            ));
        }
        previous_end = end;
        previous_name = name;
    }

    let mut type_stats = BTreeMap::new();
    let mut tensor_data_bytes = 0u64;
    let mut tensor_data_span_end = tensor_data_offset;
    for tensor in &resolved_tensors {
        let stats = type_stats
            .entry(tensor.type_name)
            .or_insert_with(TypeStats::default);
        stats.tensor_count += 1;
        stats.parameter_count = stats
            .parameter_count
            .checked_add(tensor.element_count)
            .ok_or_else(|| invalid_data_error("GGUF type parameter count overflow"))?;
        stats.data_bytes = stats
            .data_bytes
            .checked_add(tensor.byte_count)
            .ok_or_else(|| invalid_data_error("GGUF type byte count overflow"))?;
        tensor_data_bytes = tensor_data_bytes
            .checked_add(tensor.byte_count)
            .ok_or_else(|| invalid_data_error("GGUF tensor data byte count overflow"))?;
        tensor_data_span_end = tensor_data_span_end.max(tensor.absolute_end);
    }

    Ok(GgufInspection {
        source_path: input.display().to_string(),
        file_bytes,
        version,
        metadata_kv_count,
        tensor_count,
        alignment,
        architecture,
        model_name,
        tokenizer,
        metadata_checksum,
        tensor_directory_checksum,
        tensor_directory_bytes,
        tensor_data_offset,
        tensor_data_bytes,
        tensor_data_span_end,
        tensors: resolved_tensors,
        type_stats,
    })
}

fn read_tensor_info(
    reader: &mut GgufReader,
    tensor_directory_checksum: &mut u64,
) -> io::Result<TensorInfo> {
    let name = reader.read_string()?;
    fnv_update(tensor_directory_checksum, name.as_bytes());
    let n_dimensions = reader.read_u32()?;
    fnv_update(tensor_directory_checksum, &n_dimensions.to_le_bytes());
    if n_dimensions == 0 || n_dimensions > MAX_DIMENSIONS {
        return invalid_data(format!(
            "GGUF tensor {name} has unsupported dimension count {n_dimensions}"
        ));
    }
    let mut shape = Vec::with_capacity(n_dimensions as usize);
    for _ in 0..n_dimensions {
        let dimension = reader.read_u64()?;
        fnv_update(tensor_directory_checksum, &dimension.to_le_bytes());
        if dimension == 0 {
            return invalid_data(format!("GGUF tensor {name} has a zero dimension"));
        }
        shape.push(dimension);
    }
    let type_id = reader.read_u32()?;
    fnv_update(tensor_directory_checksum, &type_id.to_le_bytes());
    let relative_offset = reader.read_u64()?;
    fnv_update(tensor_directory_checksum, &relative_offset.to_le_bytes());

    let ggml_type = ggml_type(type_id)
        .ok_or_else(|| invalid_data_error(format!("unsupported GGUF tensor type id {type_id}")))?;
    let element_count = element_count(&shape)?;
    let byte_count = tensor_byte_count(&name, element_count, ggml_type)?;
    Ok(TensorInfo {
        name,
        type_name: ggml_type.name,
        shape,
        element_count,
        relative_offset,
        absolute_start: 0,
        byte_count,
        absolute_end: 0,
    })
}

fn read_metadata_value(
    reader: &mut GgufReader,
    value_type: u32,
    checksum: &mut u64,
    capture_string_array_values: bool,
) -> io::Result<MetadataValueSummary> {
    match value_type {
        0 => {
            let value = reader.read_bytes(1)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        1 => {
            let value = reader.read_bytes(1)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        2 => {
            let value = reader.read_bytes(2)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        3 => {
            let value = reader.read_bytes(2)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        4 => {
            let value = reader.read_u32()?;
            fnv_update(checksum, &value.to_le_bytes());
            Ok(MetadataValueSummary::U32(value))
        }
        5 => {
            let value = reader.read_bytes(4)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        6 => {
            let value = reader.read_bytes(4)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        7 => {
            let value = reader.read_bytes(1)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        8 => {
            let value = reader.read_string()?;
            fnv_update(checksum, value.as_bytes());
            Ok(MetadataValueSummary::String(value))
        }
        9 => {
            let element_type = reader.read_u32()?;
            fnv_update(checksum, &element_type.to_le_bytes());
            if element_type == 9 {
                return invalid_data("nested GGUF metadata arrays are not supported");
            }
            let length = reader.read_u64()?;
            fnv_update(checksum, &length.to_le_bytes());
            if length > MAX_METADATA_ARRAY_ITEMS {
                return invalid_data(format!(
                    "GGUF metadata array length {length} exceeds limit {MAX_METADATA_ARRAY_ITEMS}"
                ));
            }
            if element_type == 8 {
                return read_string_array_metadata(
                    reader,
                    length,
                    checksum,
                    capture_string_array_values,
                );
            }
            for _ in 0..length {
                read_metadata_value(reader, element_type, checksum, false)?;
            }
            Ok(MetadataValueSummary::Other)
        }
        10 => {
            let value = reader.read_u64()?;
            fnv_update(checksum, &value.to_le_bytes());
            Ok(MetadataValueSummary::U64(value))
        }
        11 => {
            let value = reader.read_bytes(8)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        12 => {
            let value = reader.read_bytes(8)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        _ => invalid_data(format!("unsupported GGUF metadata value type {value_type}")),
    }
}

fn read_string_array_metadata(
    reader: &mut GgufReader,
    length: u64,
    metadata_checksum: &mut u64,
    capture_values: bool,
) -> io::Result<MetadataValueSummary> {
    let mut array_checksum = FNV_OFFSET;
    let mut values = if capture_values {
        let capacity = usize::try_from(length).map_err(|_| {
            invalid_data_error("GGUF tokenizer metadata array is too large for this host")
        })?;
        Some(Vec::with_capacity(capacity))
    } else {
        None
    };
    for index in 0..length {
        let value = reader.read_string()?;
        fnv_update(metadata_checksum, value.as_bytes());
        fnv_update(&mut array_checksum, &index.to_le_bytes());
        fnv_update(&mut array_checksum, &(value.len() as u64).to_le_bytes());
        fnv_update(&mut array_checksum, value.as_bytes());
        if let Some(values) = &mut values {
            values.push(value);
        }
    }
    Ok(MetadataValueSummary::StringArray {
        count: length,
        checksum: array_checksum,
        values,
    })
}

fn render_report(inspection: &GgufInspection) -> String {
    let mut out = String::new();
    push_field(
        &mut out,
        "tinyrustlm_gguf_inspection_version",
        GGUF_REPORT_VERSION,
    );
    push_field(
        &mut out,
        "source_layout",
        &format!("gguf-v{}", inspection.version),
    );
    push_field(&mut out, "source_path", &inspection.source_path);
    push_field(&mut out, "file_bytes", &inspection.file_bytes.to_string());
    push_field(&mut out, "gguf.version", &inspection.version.to_string());
    push_field(
        &mut out,
        "metadata_kv_count",
        &inspection.metadata_kv_count.to_string(),
    );
    push_field(
        &mut out,
        "tensor_count",
        &inspection.tensor_count.to_string(),
    );
    push_field(&mut out, "alignment", &inspection.alignment.to_string());
    push_field(
        &mut out,
        "architecture",
        inspection.architecture.as_deref().unwrap_or("unknown"),
    );
    push_field(
        &mut out,
        "model_name",
        inspection.model_name.as_deref().unwrap_or("unknown"),
    );
    push_field(
        &mut out,
        "tokenizer.model",
        inspection.tokenizer.model.as_deref().unwrap_or("unknown"),
    );
    push_optional_u64(
        &mut out,
        "tokenizer.token_count",
        inspection.tokenizer.token_count,
    );
    push_optional_hex64(
        &mut out,
        "tokenizer.token_checksum",
        inspection.tokenizer.token_checksum,
    );
    push_optional_u64(
        &mut out,
        "tokenizer.merge_count",
        inspection.tokenizer.merge_count,
    );
    push_optional_hex64(
        &mut out,
        "tokenizer.merge_checksum",
        inspection.tokenizer.merge_checksum,
    );
    push_field(
        &mut out,
        "metadata_checksum",
        &format!("0x{:016x}", inspection.metadata_checksum),
    );
    push_field(
        &mut out,
        "tensor_directory_checksum",
        &format!("0x{:016x}", inspection.tensor_directory_checksum),
    );
    push_field(
        &mut out,
        "tensor_directory_bytes",
        &inspection.tensor_directory_bytes.to_string(),
    );
    push_field(
        &mut out,
        "tensor_data_offset",
        &inspection.tensor_data_offset.to_string(),
    );
    push_field(
        &mut out,
        "tensor_data_bytes",
        &inspection.tensor_data_bytes.to_string(),
    );
    push_field(
        &mut out,
        "tensor_data_span_end",
        &inspection.tensor_data_span_end.to_string(),
    );
    push_field(
        &mut out,
        "type_stats_count",
        &inspection.type_stats.len().to_string(),
    );
    for (index, (type_name, stats)) in inspection.type_stats.iter().enumerate() {
        push_field(&mut out, &format!("type.{index}.name"), type_name);
        push_field(
            &mut out,
            &format!("type.{index}.tensor_count"),
            &stats.tensor_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("type.{index}.parameter_count"),
            &stats.parameter_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("type.{index}.data_bytes"),
            &stats.data_bytes.to_string(),
        );
    }
    for (index, tensor) in inspection.tensors.iter().enumerate() {
        push_field(&mut out, &format!("tensor.{index}.name"), &tensor.name);
        push_field(&mut out, &format!("tensor.{index}.type"), tensor.type_name);
        push_field(
            &mut out,
            &format!("tensor.{index}.shape"),
            &shape_text(&tensor.shape),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.element_count"),
            &tensor.element_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.relative_offset"),
            &tensor.relative_offset.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.absolute_start"),
            &tensor.absolute_start.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.byte_count"),
            &tensor.byte_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.absolute_end"),
            &tensor.absolute_end.to_string(),
        );
    }
    out
}

fn build_source_plan(input: &Path, shape_name: &str) -> io::Result<SourcePlan> {
    let inspection = inspect_input(input)?;
    let source_contract = trained_source::source_shape_contract(shape_name)?;
    let tokenizer_compatibility_status =
        validate_gguf_tokenizer_compatibility(&inspection.tokenizer, shape_name, &source_contract)?;
    let expectations = trained_source::source_tensor_expectations(shape_name)?;
    let mut by_name = BTreeMap::new();
    for tensor in &inspection.tensors {
        if by_name.insert(tensor.name.clone(), tensor).is_some() {
            return invalid_data("GGUF source plan found duplicate tensor names");
        }
    }

    let mut tensors = Vec::with_capacity(expectations.len());
    let mut raw_source_bytes = 0u64;
    let mut requires_decode = false;
    for expectation in expectations {
        let (source_name, tensor) = take_source_tensor(&mut by_name, &expectation.name)?;
        if tensor.shape != expectation.dims {
            return invalid_data(format!(
                "GGUF tensor {} shape was {}, expected {}",
                tensor.name,
                shape_text(&tensor.shape),
                shape_text(&expectation.dims)
            ));
        }
        let conversion_action = source_conversion_action(tensor.type_name)?;
        requires_decode |= conversion_action != "copy-f32";
        raw_source_bytes = raw_source_bytes
            .checked_add(expectation.f32_bytes)
            .ok_or_else(|| invalid_data_error("GGUF source plan raw byte count overflow"))?;
        tensors.push(SourceTensorPlan {
            name: expectation.name,
            source_name,
            type_name: tensor.type_name,
            shape: tensor.shape.clone(),
            absolute_start: tensor.absolute_start,
            absolute_end: tensor.absolute_end,
            raw_source_file: expectation.relative_file,
            raw_source_bytes: expectation.f32_bytes,
            conversion_action,
        });
    }
    if let Some(extra_name) = by_name.keys().next() {
        return invalid_data(format!(
            "GGUF source plan found unsupported tensor {extra_name}"
        ));
    }
    Ok(SourcePlan {
        inspection,
        target_model_shape: shape_name.to_string(),
        target_vocab_size: source_contract.shape.vocab_size,
        target_tokenizer_strategy: source_contract.tokenizer_strategy,
        tokenizer_compatibility_status,
        conversion_status: if requires_decode {
            "decode-required"
        } else {
            "copy-ready"
        },
        raw_source_bytes,
        tensors,
    })
}

fn validate_gguf_tokenizer_compatibility(
    tokenizer: &GgufTokenizerMetadata,
    shape_name: &str,
    source_contract: &trained_source::SourceShapeContract,
) -> io::Result<&'static str> {
    let Some(token_count) = tokenizer.token_count else {
        return Ok("not-declared");
    };
    let target_vocab_size = u64::from(source_contract.shape.vocab_size);
    if token_count != target_vocab_size {
        return invalid_data(format!(
            "GGUF tokenizer token count {token_count} does not match target vocab size {target_vocab_size} for source shape {shape_name}"
        ));
    }
    Ok("compatible-token-count")
}

fn gguf_tokenizer_override_for_source_shape(
    plan: &SourcePlan,
) -> io::Result<Option<trained_source::SourceTokenizerOverride>> {
    if plan.target_tokenizer_strategy != "manifest-bpe-v1" {
        return Ok(None);
    }

    let tokenizer = &plan.inspection.tokenizer;
    let (Some(tokens), Some(merges)) = (&tokenizer.tokens, &tokenizer.merges) else {
        if tokenizer.tokens.is_none() && tokenizer.merges.is_none() {
            return Ok(None);
        }
        return invalid_data(
            "GGUF BPE tokenizer import requires both tokenizer.ggml.tokens and tokenizer.ggml.merges",
        );
    };
    let target_vocab_size = usize::try_from(plan.target_vocab_size)
        .map_err(|_| invalid_data_error("target vocab size is too large for this host"))?;
    if tokens.len() != target_vocab_size {
        return invalid_data(format!(
            "GGUF tokenizer value count {} does not match target vocab size {}",
            tokens.len(),
            plan.target_vocab_size
        ));
    }
    if merges.is_empty() {
        return invalid_data("GGUF BPE tokenizer import requires at least one merge");
    }

    let mut token_id_by_text = BTreeMap::new();
    for id in 0u32..=255 {
        if let Some(ch) = char::from_u32(id) {
            token_id_by_text.insert(ch.to_string(), id);
        }
    }

    let mut bpe_tokens = Vec::new();
    for id in 260..plan.target_vocab_size {
        let token = &tokens[id as usize];
        if token.is_empty() {
            return invalid_data("GGUF BPE token entry is empty");
        }
        if token_id_by_text.insert(token.clone(), id).is_some() {
            return invalid_data(format!("GGUF BPE token text {token:?} is duplicated"));
        }
        bpe_tokens.push(BpeTokenSpec {
            id,
            bytes: token.as_bytes().to_vec(),
        });
    }

    let mut bpe_merges = Vec::with_capacity(merges.len());
    for (rank, merge) in merges.iter().enumerate() {
        let mut parts = merge.split_whitespace();
        let Some(left_text) = parts.next() else {
            return invalid_data("GGUF BPE merge entry is empty");
        };
        let Some(right_text) = parts.next() else {
            return invalid_data(format!("GGUF BPE merge {merge:?} must contain two tokens"));
        };
        if parts.next().is_some() {
            return invalid_data(format!("GGUF BPE merge {merge:?} must contain two tokens"));
        }
        let left = *token_id_by_text.get(left_text).ok_or_else(|| {
            invalid_data_error(format!(
                "GGUF BPE merge left token {left_text:?} is not declared"
            ))
        })?;
        let right = *token_id_by_text.get(right_text).ok_or_else(|| {
            invalid_data_error(format!(
                "GGUF BPE merge right token {right_text:?} is not declared"
            ))
        })?;
        let output_text = format!("{left_text}{right_text}");
        let output = *token_id_by_text.get(&output_text).ok_or_else(|| {
            invalid_data_error(format!(
                "GGUF BPE merge output token {output_text:?} is not declared"
            ))
        })?;
        let rank = u32::try_from(rank)
            .map_err(|_| invalid_data_error("GGUF BPE merge rank is too large"))?;
        bpe_merges.push(BpeMergeSpec {
            left,
            right,
            output,
            rank,
        });
    }

    Ok(Some(trained_source::SourceTokenizerOverride {
        tokens: bpe_tokens,
        specials: Vec::new(),
        merges: bpe_merges,
    }))
}

fn take_source_tensor<'a>(
    by_name: &mut BTreeMap<String, &'a TensorInfo>,
    local_name: &str,
) -> io::Result<(String, &'a TensorInfo)> {
    let aliases = source_tensor_aliases(local_name);
    let mut matches = Vec::new();
    for alias in &aliases {
        if by_name.contains_key(alias) {
            matches.push(alias.clone());
        }
    }
    if matches.len() > 1 {
        return invalid_data(format!(
            "GGUF source plan matched multiple source names for {local_name}: {}",
            matches.join(", ")
        ));
    }
    let Some(source_name) = matches.pop() else {
        return invalid_data(format!(
            "GGUF source plan missing tensor {local_name} (accepted source names: {})",
            aliases.join(", ")
        ));
    };
    let tensor = by_name
        .remove(&source_name)
        .ok_or_else(|| invalid_data_error("GGUF source plan alias lookup drifted"))?;
    Ok((source_name, tensor))
}

fn source_tensor_aliases(local_name: &str) -> Vec<String> {
    let mut names = vec![local_name.to_string()];
    if let Some(alias) = gguf_alias_for_local(local_name) {
        if !names.contains(&alias) {
            names.push(alias);
        }
    }
    names
}

fn gguf_alias_for_local(local_name: &str) -> Option<String> {
    match local_name {
        "tok_embeddings.weight" => Some("token_embd.weight".to_string()),
        "norm.weight" => Some("output_norm.weight".to_string()),
        "output.weight" => Some("output.weight".to_string()),
        _ => {
            let (layer, suffix) = local_layer_suffix(local_name)?;
            let alias_suffix = gguf_layer_alias_suffix(suffix)?;
            Some(format!("blk.{layer}.{alias_suffix}"))
        }
    }
}

fn local_layer_suffix(local_name: &str) -> Option<(&str, &str)> {
    let rest = local_name.strip_prefix("layers.")?;
    rest.split_once('.')
}

fn gguf_layer_alias_suffix(local_suffix: &str) -> Option<&'static str> {
    match local_suffix {
        "attention_norm.weight" => Some("attn_norm.weight"),
        "ffn_norm.weight" => Some("ffn_norm.weight"),
        "wq.weight" => Some("attn_q.weight"),
        "wk.weight" => Some("attn_k.weight"),
        "wv.weight" => Some("attn_v.weight"),
        "wo.weight" => Some("attn_output.weight"),
        "w1.weight" => Some("ffn_gate.weight"),
        "w2.weight" => Some("ffn_down.weight"),
        "w3.weight" => Some("ffn_up.weight"),
        _ => None,
    }
}

fn source_conversion_action(type_name: &str) -> io::Result<&'static str> {
    match type_name {
        "F32" => Ok("copy-f32"),
        "F16" => Ok("decode-f16"),
        "BF16" => Ok("decode-bf16"),
        "Q4_0" => Ok("dequant-q4_0"),
        "Q4_1" => Ok("dequant-q4_1"),
        "Q4_K" => Ok("dequant-q4_k"),
        "Q5_0" => Ok("dequant-q5_0"),
        "Q5_1" => Ok("dequant-q5_1"),
        "Q2_K" => Ok("dequant-q2_k"),
        "Q3_K" => Ok("dequant-q3_k"),
        "Q5_K" => Ok("dequant-q5_k"),
        "Q6_K" => Ok("dequant-q6_k"),
        "Q8_0" => Ok("dequant-q8_0"),
        "Q8_1" => Ok("dequant-q8_1"),
        "Q8_K" => Ok("dequant-q8_k"),
        _ => unsupported_source_tensor_type(type_name),
    }
}

fn extract_source_payloads(
    input: &Path,
    plan: &SourcePlan,
) -> io::Result<Vec<trained_source::SourceTensorPayload>> {
    let mut file = File::open(input)?;
    let mut payloads = Vec::with_capacity(plan.tensors.len());
    for tensor in &plan.tensors {
        let raw_len = tensor
            .absolute_end
            .checked_sub(tensor.absolute_start)
            .ok_or_else(|| invalid_data_error("GGUF tensor source offset underflow"))?;
        let raw_len = usize::try_from(raw_len)
            .map_err(|_| invalid_data_error("GGUF tensor slice is too large for this host"))?;
        let mut raw = vec![0u8; raw_len];
        file.seek(SeekFrom::Start(tensor.absolute_start))?;
        file.read_exact(&mut raw)?;
        let bytes = decode_source_tensor_to_f32(tensor.type_name, &raw)?;
        if bytes.len() as u64 != tensor.raw_source_bytes {
            return invalid_data(format!(
                "GGUF tensor {} decoded to {} bytes, expected {}",
                tensor.name,
                bytes.len(),
                tensor.raw_source_bytes
            ));
        }
        payloads.push(trained_source::SourceTensorPayload {
            name: tensor.name.clone(),
            bytes,
        });
    }
    Ok(payloads)
}

fn decode_source_tensor_to_f32(type_name: &str, raw: &[u8]) -> io::Result<Vec<u8>> {
    match type_name {
        "F32" => {
            if !raw.len().is_multiple_of(4) {
                return invalid_data("F32 GGUF payload length must divide by four");
            }
            Ok(raw.to_vec())
        }
        "F16" => decode_f16_payload_to_f32(raw),
        "BF16" => decode_bf16_payload_to_f32(raw),
        "Q4_0" => decode_q4_0_payload_to_f32(raw),
        "Q4_1" => decode_q4_1_payload_to_f32(raw),
        "Q4_K" => decode_q4_k_payload_to_f32(raw),
        "Q5_0" => decode_q5_0_payload_to_f32(raw),
        "Q5_1" => decode_q5_1_payload_to_f32(raw),
        "Q2_K" => decode_q2_k_payload_to_f32(raw),
        "Q3_K" => decode_q3_k_payload_to_f32(raw),
        "Q5_K" => decode_q5_k_payload_to_f32(raw),
        "Q6_K" => decode_q6_k_payload_to_f32(raw),
        "Q8_0" => decode_q8_0_payload_to_f32(raw),
        "Q8_1" => decode_q8_1_payload_to_f32(raw),
        "Q8_K" => decode_q8_k_payload_to_f32(raw),
        _ => unsupported_source_tensor_type(type_name),
    }
}

fn unsupported_source_tensor_type<T>(type_name: &str) -> io::Result<T> {
    invalid_data(format!(
        "GGUF source extraction only supports {GGUF_SUPPORTED_SOURCE_TENSOR_TYPES} tensors, not {type_name}"
    ))
}

fn decode_f16_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(2) {
        return invalid_data("F16 GGUF payload length must divide by two");
    }
    let mut bytes = Vec::with_capacity(raw.len() * 2);
    for chunk in raw.chunks_exact(2) {
        let bits = u16::from_le_bytes([chunk[0], chunk[1]]);
        bytes.extend_from_slice(&f16_bits_to_f32(bits).to_le_bytes());
    }
    Ok(bytes)
}

fn decode_bf16_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(2) {
        return invalid_data("BF16 GGUF payload length must divide by two");
    }
    let mut bytes = Vec::with_capacity(raw.len() * 2);
    for chunk in raw.chunks_exact(2) {
        let high = u16::from_le_bytes([chunk[0], chunk[1]]);
        bytes.extend_from_slice(&f32::from_bits(u32::from(high) << 16).to_le_bytes());
    }
    Ok(bytes)
}

fn decode_q4_0_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q4_0_BLOCK_BYTES) {
        return invalid_data("Q4_0 GGUF payload length must divide into 18-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q4_0_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q4_0_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q4_0_BLOCK_BYTES) {
        let scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        if !scale.is_finite() {
            return invalid_data("Q4_0 GGUF payload scale decoded a non-finite value");
        }
        let packed = &block[2..];
        for value in packed {
            let decoded = scale * f32::from((value & 0x0f) as i8 - 8);
            if !decoded.is_finite() {
                return invalid_data("Q4_0 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
        for value in packed {
            let decoded = scale * f32::from((value >> 4) as i8 - 8);
            if !decoded.is_finite() {
                return invalid_data("Q4_0 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q4_1_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q4_1_BLOCK_BYTES) {
        return invalid_data("Q4_1 GGUF payload length must divide into 20-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q4_1_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q4_1_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q4_1_BLOCK_BYTES) {
        let scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        let min = f16_bits_to_f32(u16::from_le_bytes([block[2], block[3]]));
        if !scale.is_finite() || !min.is_finite() {
            return invalid_data("Q4_1 GGUF payload scale/min decoded a non-finite value");
        }
        let packed = &block[4..];
        for value in packed {
            let decoded = (scale * f32::from(value & 0x0f)) + min;
            if !decoded.is_finite() {
                return invalid_data("Q4_1 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
        for value in packed {
            let decoded = (scale * f32::from(value >> 4)) + min;
            if !decoded.is_finite() {
                return invalid_data("Q4_1 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q4_k_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q4_K_BLOCK_BYTES) {
        return invalid_data("Q4_K GGUF payload length must divide into 144-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q4_K_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q4_K_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q4_K_BLOCK_BYTES) {
        let super_scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        let super_min = f16_bits_to_f32(u16::from_le_bytes([block[2], block[3]]));
        if !super_scale.is_finite() || !super_min.is_finite() {
            return invalid_data("Q4_K GGUF payload scale/min decoded a non-finite value");
        }
        let scales = &block[4..4 + GGUF_Q4_K_SCALE_BYTES];
        let quants =
            &block[4 + GGUF_Q4_K_SCALE_BYTES..4 + GGUF_Q4_K_SCALE_BYTES + GGUF_Q4_K_QUANT_BYTES];
        for pair in 0..(GGUF_Q4_K_GROUP_COUNT / 2) {
            let quant_offset = pair * GGUF_Q4_K_GROUP_ELEMENTS;
            let (scale_1, min_1) = k_scale_min_6bit(scales, pair * 2);
            let (scale_2, min_2) = k_scale_min_6bit(scales, pair * 2 + 1);
            let d1 = super_scale * f32::from(scale_1);
            let m1 = super_min * f32::from(min_1);
            let d2 = super_scale * f32::from(scale_2);
            let m2 = super_min * f32::from(min_2);
            let packed = &quants[quant_offset..quant_offset + GGUF_Q4_K_GROUP_ELEMENTS];
            for value in packed {
                let decoded = d1 * f32::from(value & 0x0f) - m1;
                if !decoded.is_finite() {
                    return invalid_data("Q4_K GGUF payload decoded a non-finite value");
                }
                bytes.extend_from_slice(&decoded.to_le_bytes());
            }
            for value in packed {
                let decoded = d2 * f32::from(value >> 4) - m2;
                if !decoded.is_finite() {
                    return invalid_data("Q4_K GGUF payload decoded a non-finite value");
                }
                bytes.extend_from_slice(&decoded.to_le_bytes());
            }
        }
    }
    Ok(bytes)
}

fn k_scale_min_6bit(scales: &[u8], group_index: usize) -> (u8, u8) {
    debug_assert_eq!(scales.len(), GGUF_Q4_K_SCALE_BYTES);
    debug_assert!(group_index < GGUF_Q4_K_GROUP_COUNT);
    if group_index < 4 {
        (scales[group_index] & 0x3f, scales[group_index + 4] & 0x3f)
    } else {
        (
            (scales[group_index + 4] & 0x0f) | ((scales[group_index - 4] >> 6) << 4),
            (scales[group_index + 4] >> 4) | ((scales[group_index] >> 6) << 4),
        )
    }
}

fn decode_q5_0_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q5_0_BLOCK_BYTES) {
        return invalid_data("Q5_0 GGUF payload length must divide into 22-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q5_0_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q5_0_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q5_0_BLOCK_BYTES) {
        let scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        if !scale.is_finite() {
            return invalid_data("Q5_0 GGUF payload scale decoded a non-finite value");
        }
        let high_bits = u32::from_le_bytes([block[2], block[3], block[4], block[5]]);
        let packed = &block[6..];
        for (index, value) in packed.iter().enumerate() {
            let high = (((high_bits >> index) << 4) & 0x10) as u8;
            let decoded = scale * f32::from(((value & 0x0f) | high) as i8 - 16);
            if !decoded.is_finite() {
                return invalid_data("Q5_0 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
        for (index, value) in packed.iter().enumerate() {
            let high = ((high_bits >> (index + 12)) & 0x10) as u8;
            let decoded = scale * f32::from(((value >> 4) | high) as i8 - 16);
            if !decoded.is_finite() {
                return invalid_data("Q5_0 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q5_1_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q5_1_BLOCK_BYTES) {
        return invalid_data("Q5_1 GGUF payload length must divide into 24-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q5_1_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q5_1_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q5_1_BLOCK_BYTES) {
        let scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        let min = f16_bits_to_f32(u16::from_le_bytes([block[2], block[3]]));
        if !scale.is_finite() || !min.is_finite() {
            return invalid_data("Q5_1 GGUF payload scale/min decoded a non-finite value");
        }
        let high_bits = u32::from_le_bytes([block[4], block[5], block[6], block[7]]);
        let packed = &block[8..];
        for (index, value) in packed.iter().enumerate() {
            let high = (((high_bits >> index) << 4) & 0x10) as u8;
            let decoded = (scale * f32::from((value & 0x0f) | high)) + min;
            if !decoded.is_finite() {
                return invalid_data("Q5_1 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
        for (index, value) in packed.iter().enumerate() {
            let high = ((high_bits >> (index + 12)) & 0x10) as u8;
            let decoded = (scale * f32::from((value >> 4) | high)) + min;
            if !decoded.is_finite() {
                return invalid_data("Q5_1 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&decoded.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q2_k_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q2_K_BLOCK_BYTES) {
        return invalid_data("Q2_K GGUF payload length must divide into 84-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q2_K_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q2_K_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q2_K_BLOCK_BYTES) {
        let scales = &block[..GGUF_Q2_K_SCALE_BYTES];
        let quants = &block[GGUF_Q2_K_SCALE_BYTES..GGUF_Q2_K_SCALE_BYTES + GGUF_Q2_K_QUANT_BYTES];
        let scale = f16_bits_to_f32(u16::from_le_bytes([
            block[GGUF_Q2_K_BLOCK_BYTES - 4],
            block[GGUF_Q2_K_BLOCK_BYTES - 3],
        ]));
        let min_scale = f16_bits_to_f32(u16::from_le_bytes([
            block[GGUF_Q2_K_BLOCK_BYTES - 2],
            block[GGUF_Q2_K_BLOCK_BYTES - 1],
        ]));
        if !scale.is_finite() || !min_scale.is_finite() {
            return invalid_data("Q2_K GGUF payload scale/min decoded a non-finite value");
        }
        let mut scale_index = 0;
        let mut quant_offset = 0;
        for _segment in 0..2 {
            let mut shift = 0;
            for _ in 0..4 {
                let sc = scales[scale_index];
                scale_index += 1;
                let dl = scale * f32::from(sc & 0x0f);
                let ml = min_scale * f32::from(sc >> 4);
                for lane in 0..16 {
                    let decoded =
                        dl * f32::from((quants[quant_offset + lane] >> shift) & 0x03) - ml;
                    if !decoded.is_finite() {
                        return invalid_data("Q2_K GGUF payload decoded a non-finite value");
                    }
                    bytes.extend_from_slice(&decoded.to_le_bytes());
                }

                let sc = scales[scale_index];
                scale_index += 1;
                let dl = scale * f32::from(sc & 0x0f);
                let ml = min_scale * f32::from(sc >> 4);
                for lane in 0..16 {
                    let decoded =
                        dl * f32::from((quants[quant_offset + lane + 16] >> shift) & 0x03) - ml;
                    if !decoded.is_finite() {
                        return invalid_data("Q2_K GGUF payload decoded a non-finite value");
                    }
                    bytes.extend_from_slice(&decoded.to_le_bytes());
                }

                shift += 2;
            }
            quant_offset += 32;
        }
    }
    Ok(bytes)
}

fn decode_q3_k_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q3_K_BLOCK_BYTES) {
        return invalid_data("Q3_K GGUF payload length must divide into 110-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q3_K_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q3_K_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q3_K_BLOCK_BYTES) {
        let high_bits = &block[..GGUF_Q3_K_HIGH_BYTES];
        let quants = &block[GGUF_Q3_K_HIGH_BYTES..GGUF_Q3_K_HIGH_BYTES + GGUF_Q3_K_QUANT_BYTES];
        let scale_bytes = &block[GGUF_Q3_K_HIGH_BYTES + GGUF_Q3_K_QUANT_BYTES
            ..GGUF_Q3_K_HIGH_BYTES + GGUF_Q3_K_QUANT_BYTES + GGUF_Q3_K_SCALE_BYTES];
        let scale = f16_bits_to_f32(u16::from_le_bytes([
            block[GGUF_Q3_K_BLOCK_BYTES - 2],
            block[GGUF_Q3_K_BLOCK_BYTES - 1],
        ]));
        if !scale.is_finite() {
            return invalid_data("Q3_K GGUF payload scale decoded a non-finite value");
        }
        let scale_codes = unpack_q3_k_scale_codes(scale_bytes);
        let mut scale_index = 0;
        let mut quant_offset = 0;
        let mut high_mask = 1u8;
        for _segment in 0..2 {
            let mut shift = 0;
            for _ in 0..4 {
                let dl = scale * f32::from(i16::from(scale_codes[scale_index]) - 32);
                scale_index += 1;
                for lane in 0..GGUF_Q3_K_GROUP_ELEMENTS {
                    let high_adjust = if (high_bits[lane] & high_mask) != 0 {
                        0i16
                    } else {
                        4i16
                    };
                    let level =
                        i16::from((quants[quant_offset + lane] >> shift) & 0x03) - high_adjust;
                    let decoded = dl * f32::from(level);
                    if !decoded.is_finite() {
                        return invalid_data("Q3_K GGUF payload decoded a non-finite value");
                    }
                    bytes.extend_from_slice(&decoded.to_le_bytes());
                }

                let dl = scale * f32::from(i16::from(scale_codes[scale_index]) - 32);
                scale_index += 1;
                for lane in 0..GGUF_Q3_K_GROUP_ELEMENTS {
                    let high_adjust =
                        if (high_bits[lane + GGUF_Q3_K_GROUP_ELEMENTS] & high_mask) != 0 {
                            0i16
                        } else {
                            4i16
                        };
                    let level =
                        i16::from((quants[quant_offset + lane + 16] >> shift) & 0x03) - high_adjust;
                    let decoded = dl * f32::from(level);
                    if !decoded.is_finite() {
                        return invalid_data("Q3_K GGUF payload decoded a non-finite value");
                    }
                    bytes.extend_from_slice(&decoded.to_le_bytes());
                }

                shift += 2;
                high_mask = high_mask.wrapping_shl(1);
            }
            quant_offset += 32;
        }
    }
    Ok(bytes)
}

fn unpack_q3_k_scale_codes(scales: &[u8]) -> [u8; GGUF_Q3_K_GROUP_COUNT] {
    debug_assert_eq!(scales.len(), GGUF_Q3_K_SCALE_BYTES);
    let mut codes = [0u8; GGUF_Q3_K_GROUP_COUNT];
    for group in 0..GGUF_Q3_K_GROUP_COUNT {
        let low = if group < 8 {
            scales[group] & 0x0f
        } else {
            (scales[group - 8] >> 4) & 0x0f
        };
        let high = (scales[8 + (group % 4)] >> (2 * (group / 4))) & 0x03;
        codes[group] = low | (high << 4);
    }
    codes
}

fn decode_q5_k_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q5_K_BLOCK_BYTES) {
        return invalid_data("Q5_K GGUF payload length must divide into 176-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q5_K_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q5_K_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q5_K_BLOCK_BYTES) {
        let super_scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        let super_min = f16_bits_to_f32(u16::from_le_bytes([block[2], block[3]]));
        if !super_scale.is_finite() || !super_min.is_finite() {
            return invalid_data("Q5_K GGUF payload scale/min decoded a non-finite value");
        }
        let scales = &block[4..4 + GGUF_Q4_K_SCALE_BYTES];
        let high_bits =
            &block[4 + GGUF_Q4_K_SCALE_BYTES..4 + GGUF_Q4_K_SCALE_BYTES + GGUF_Q5_K_HIGH_BYTES];
        let quants = &block[4 + GGUF_Q4_K_SCALE_BYTES + GGUF_Q5_K_HIGH_BYTES
            ..4 + GGUF_Q4_K_SCALE_BYTES + GGUF_Q5_K_HIGH_BYTES + GGUF_Q5_K_QUANT_BYTES];
        for pair in 0..(GGUF_Q4_K_GROUP_COUNT / 2) {
            let quant_offset = pair * GGUF_Q4_K_GROUP_ELEMENTS;
            let high_mask_1 = 1u8 << (pair * 2);
            let high_mask_2 = 2u8 << (pair * 2);
            let (scale_1, min_1) = k_scale_min_6bit(scales, pair * 2);
            let (scale_2, min_2) = k_scale_min_6bit(scales, pair * 2 + 1);
            let d1 = super_scale * f32::from(scale_1);
            let m1 = super_min * f32::from(min_1);
            let d2 = super_scale * f32::from(scale_2);
            let m2 = super_min * f32::from(min_2);
            let packed = &quants[quant_offset..quant_offset + GGUF_Q4_K_GROUP_ELEMENTS];
            for (lane, value) in packed.iter().enumerate() {
                let high = if (high_bits[lane] & high_mask_1) != 0 {
                    16
                } else {
                    0
                };
                let decoded = d1 * f32::from((*value & 0x0f) + high) - m1;
                if !decoded.is_finite() {
                    return invalid_data("Q5_K GGUF payload decoded a non-finite value");
                }
                bytes.extend_from_slice(&decoded.to_le_bytes());
            }
            for (lane, value) in packed.iter().enumerate() {
                let high = if (high_bits[lane] & high_mask_2) != 0 {
                    16
                } else {
                    0
                };
                let decoded = d2 * f32::from((*value >> 4) + high) - m2;
                if !decoded.is_finite() {
                    return invalid_data("Q5_K GGUF payload decoded a non-finite value");
                }
                bytes.extend_from_slice(&decoded.to_le_bytes());
            }
        }
    }
    Ok(bytes)
}

fn decode_q6_k_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q6_K_BLOCK_BYTES) {
        return invalid_data("Q6_K GGUF payload length must divide into 210-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q6_K_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q6_K_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q6_K_BLOCK_BYTES) {
        let ql = &block[..GGUF_Q6_K_LOW_BYTES];
        let qh = &block[GGUF_Q6_K_LOW_BYTES..GGUF_Q6_K_LOW_BYTES + GGUF_Q6_K_HIGH_BYTES];
        let scales_start = GGUF_Q6_K_LOW_BYTES + GGUF_Q6_K_HIGH_BYTES;
        let scales = &block[scales_start..scales_start + GGUF_Q6_K_SCALE_BYTES];
        let scale = f16_bits_to_f32(u16::from_le_bytes([
            block[GGUF_Q6_K_BLOCK_BYTES - 2],
            block[GGUF_Q6_K_BLOCK_BYTES - 1],
        ]));
        if !scale.is_finite() {
            return invalid_data("Q6_K GGUF payload scale decoded a non-finite value");
        }
        let mut block_values = [0.0f32; GGUF_Q6_K_BLOCK_ELEMENTS];
        for segment in 0..2 {
            let base = segment * 128;
            let ql_base = segment * 64;
            let qh_base = segment * 32;
            let scale_base = segment * 8;
            for lane in 0..32 {
                let local_scale = |offset: usize| -> f32 {
                    scale * f32::from(i8::from_ne_bytes([scales[scale_base + offset]]))
                };
                let scale_1 = local_scale(lane / 16);
                let scale_2 = local_scale((lane / 16) + 2);
                let scale_3 = local_scale((lane / 16) + 4);
                let scale_4 = local_scale((lane / 16) + 6);
                let high = qh[qh_base + lane];
                let q1 = i16::from((ql[ql_base + lane] & 0x0f) | ((high & 0x03) << 4)) - 32;
                let q2 =
                    i16::from((ql[ql_base + lane + 32] & 0x0f) | (((high >> 2) & 0x03) << 4)) - 32;
                let q3 = i16::from((ql[ql_base + lane] >> 4) | (((high >> 4) & 0x03) << 4)) - 32;
                let q4 =
                    i16::from((ql[ql_base + lane + 32] >> 4) | (((high >> 6) & 0x03) << 4)) - 32;
                block_values[base + lane] = scale_1 * f32::from(q1);
                block_values[base + lane + 32] = scale_2 * f32::from(q2);
                block_values[base + lane + 64] = scale_3 * f32::from(q3);
                block_values[base + lane + 96] = scale_4 * f32::from(q4);
            }
        }
        for value in block_values {
            if !value.is_finite() {
                return invalid_data("Q6_K GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q8_0_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q8_0_BLOCK_BYTES) {
        return invalid_data("Q8_0 GGUF payload length must divide into 34-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q8_0_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q8_0_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q8_0_BLOCK_BYTES) {
        let scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        if !scale.is_finite() {
            return invalid_data("Q8_0 GGUF payload scale decoded a non-finite value");
        }
        for encoded in &block[2..] {
            let value = scale * f32::from(i8::from_ne_bytes([*encoded]));
            if !value.is_finite() {
                return invalid_data("Q8_0 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q8_1_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q8_1_BLOCK_BYTES) {
        return invalid_data("Q8_1 GGUF payload length must divide into 36-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q8_1_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q8_1_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q8_1_BLOCK_BYTES) {
        let scale = f16_bits_to_f32(u16::from_le_bytes([block[0], block[1]]));
        let scaled_sum = f16_bits_to_f32(u16::from_le_bytes([block[2], block[3]]));
        if !scale.is_finite() || !scaled_sum.is_finite() {
            return invalid_data("Q8_1 GGUF payload scale/sum decoded a non-finite value");
        }
        for encoded in &block[4..] {
            let value = scale * f32::from(i8::from_ne_bytes([*encoded]));
            if !value.is_finite() {
                return invalid_data("Q8_1 GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn decode_q8_k_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if !raw.len().is_multiple_of(GGUF_Q8_K_BLOCK_BYTES) {
        return invalid_data("Q8_K GGUF payload length must divide into 292-byte blocks");
    }
    let block_count = raw.len() / GGUF_Q8_K_BLOCK_BYTES;
    let mut bytes = Vec::with_capacity(block_count * GGUF_Q8_K_BLOCK_ELEMENTS * 4);
    for block in raw.chunks_exact(GGUF_Q8_K_BLOCK_BYTES) {
        let scale = f32::from_le_bytes(block[0..4].try_into().expect("Q8_K scale bytes"));
        if !scale.is_finite() {
            return invalid_data("Q8_K GGUF payload scale decoded a non-finite value");
        }
        let quants = &block[4..4 + GGUF_Q8_K_QUANT_BYTES];
        let bsums_start = 4 + GGUF_Q8_K_QUANT_BYTES;
        let bsums = &block[bsums_start..bsums_start + GGUF_Q8_K_BSUM_BYTES];
        for group in 0..GGUF_Q8_K_BSUM_COUNT {
            let start = group * 16;
            let expected = quants[start..start + 16]
                .iter()
                .map(|encoded| i16::from(i8::from_ne_bytes([*encoded])))
                .sum::<i16>();
            let sum_offset = group * 2;
            let stored = i16::from_le_bytes([bsums[sum_offset], bsums[sum_offset + 1]]);
            if stored != expected {
                return invalid_data("Q8_K GGUF payload block sums do not match quantized values");
            }
        }
        for encoded in quants {
            let value = scale * f32::from(i8::from_ne_bytes([*encoded]));
            if !value.is_finite() {
                return invalid_data("Q8_K GGUF payload decoded a non-finite value");
            }
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    Ok(bytes)
}

fn f16_bits_to_f32(bits: u16) -> f32 {
    let sign = (u32::from(bits & 0x8000)) << 16;
    let exponent = (bits >> 10) & 0x001f;
    let fraction = bits & 0x03ff;
    let f32_bits = match exponent {
        0 => {
            if fraction == 0 {
                sign
            } else {
                let mut mantissa = fraction;
                let mut exponent_value = -14i32;
                while (mantissa & 0x0400) == 0 {
                    mantissa <<= 1;
                    exponent_value -= 1;
                }
                mantissa &= 0x03ff;
                sign | (((exponent_value + 127) as u32) << 23) | (u32::from(mantissa) << 13)
            }
        }
        0x001f => sign | 0x7f80_0000 | (u32::from(fraction) << 13),
        _ => sign | ((u32::from(exponent) + 112) << 23) | (u32::from(fraction) << 13),
    };
    f32::from_bits(f32_bits)
}

fn render_source_plan(plan: &SourcePlan) -> String {
    let mut out = String::new();
    push_field(
        &mut out,
        "tinyrustlm_gguf_source_plan_version",
        GGUF_SOURCE_PLAN_VERSION,
    );
    push_field(&mut out, "plan_layout", GGUF_SOURCE_PLAN_LAYOUT);
    push_field(
        &mut out,
        "source_layout",
        &format!("gguf-v{}", plan.inspection.version),
    );
    push_field(&mut out, "target_source_layout", RAW_SOURCE_LAYOUT);
    push_field(&mut out, "source_path", &plan.inspection.source_path);
    push_field(&mut out, "target_model_shape", &plan.target_model_shape);
    push_field(
        &mut out,
        "target_vocab_size",
        &plan.target_vocab_size.to_string(),
    );
    push_field(
        &mut out,
        "target_tokenizer_strategy",
        plan.target_tokenizer_strategy,
    );
    push_field(
        &mut out,
        "gguf_tokenizer_model",
        plan.inspection
            .tokenizer
            .model
            .as_deref()
            .unwrap_or("unknown"),
    );
    push_optional_u64(
        &mut out,
        "gguf_tokenizer_token_count",
        plan.inspection.tokenizer.token_count,
    );
    push_optional_hex64(
        &mut out,
        "gguf_tokenizer_token_checksum",
        plan.inspection.tokenizer.token_checksum,
    );
    push_optional_u64(
        &mut out,
        "gguf_tokenizer_merge_count",
        plan.inspection.tokenizer.merge_count,
    );
    push_optional_hex64(
        &mut out,
        "gguf_tokenizer_merge_checksum",
        plan.inspection.tokenizer.merge_checksum,
    );
    push_field(
        &mut out,
        "tokenizer_compatibility_status",
        plan.tokenizer_compatibility_status,
    );
    push_field(
        &mut out,
        "gguf_tensor_count",
        &plan.inspection.tensor_count.to_string(),
    );
    push_field(
        &mut out,
        "matched_tensor_count",
        &plan.tensors.len().to_string(),
    );
    push_field(
        &mut out,
        "gguf_tensor_data_bytes",
        &plan.inspection.tensor_data_bytes.to_string(),
    );
    push_field(
        &mut out,
        "raw_source_bytes",
        &plan.raw_source_bytes.to_string(),
    );
    push_field(
        &mut out,
        "tensor_directory_checksum",
        &hex64(plan.inspection.tensor_directory_checksum),
    );
    push_field(
        &mut out,
        "source_plan_mapping_checksum",
        &hex64(source_plan_mapping_checksum(&plan.tensors)),
    );
    push_field(&mut out, "conversion_status", plan.conversion_status);
    push_field(&mut out, "required_next_gate", "extract-raw-f32-tensors");
    for (index, tensor) in plan.tensors.iter().enumerate() {
        let prefix = format!("tensor.{index}");
        push_field(&mut out, &format!("{prefix}.name"), &tensor.name);
        push_field(
            &mut out,
            &format!("{prefix}.gguf_name"),
            &tensor.source_name,
        );
        push_field(&mut out, &format!("{prefix}.gguf_type"), tensor.type_name);
        push_field(
            &mut out,
            &format!("{prefix}.gguf_shape"),
            &shape_text(&tensor.shape),
        );
        push_field(
            &mut out,
            &format!("{prefix}.gguf_data_start"),
            &tensor.absolute_start.to_string(),
        );
        push_field(
            &mut out,
            &format!("{prefix}.gguf_data_end"),
            &tensor.absolute_end.to_string(),
        );
        push_field(
            &mut out,
            &format!("{prefix}.raw_source_file"),
            &tensor.raw_source_file,
        );
        push_field(
            &mut out,
            &format!("{prefix}.raw_source_bytes"),
            &tensor.raw_source_bytes.to_string(),
        );
        push_field(
            &mut out,
            &format!("{prefix}.conversion_action"),
            tensor.conversion_action,
        );
    }
    out
}

fn source_plan_mapping_checksum(tensors: &[SourceTensorPlan]) -> u64 {
    let mut checksum = FNV_OFFSET;
    for tensor in tensors {
        fnv_update(&mut checksum, tensor.name.as_bytes());
        fnv_update(&mut checksum, tensor.source_name.as_bytes());
        fnv_update(&mut checksum, tensor.type_name.as_bytes());
        fnv_update(&mut checksum, shape_text(&tensor.shape).as_bytes());
        fnv_update(&mut checksum, tensor.raw_source_file.as_bytes());
        fnv_update(&mut checksum, &tensor.raw_source_bytes.to_le_bytes());
        fnv_update(&mut checksum, tensor.conversion_action.as_bytes());
    }
    checksum
}

fn ggml_type(type_id: u32) -> Option<GgmlType> {
    let (name, block_size, type_size) = match type_id {
        0 => ("F32", 1, 4),
        1 => ("F16", 1, 2),
        2 => ("Q4_0", 32, 18),
        3 => ("Q4_1", 32, 20),
        6 => ("Q5_0", 32, 22),
        7 => ("Q5_1", 32, 24),
        8 => ("Q8_0", 32, 34),
        9 => ("Q8_1", 32, 36),
        10 => ("Q2_K", 256, 84),
        11 => ("Q3_K", 256, 110),
        12 => ("Q4_K", 256, 144),
        13 => ("Q5_K", 256, 176),
        14 => ("Q6_K", 256, 210),
        15 => ("Q8_K", 256, 292),
        24 => ("I8", 1, 1),
        25 => ("I16", 1, 2),
        26 => ("I32", 1, 4),
        27 => ("I64", 1, 8),
        28 => ("F64", 1, 8),
        30 => ("BF16", 1, 2),
        _ => return None,
    };
    Some(GgmlType {
        id: type_id,
        name,
        block_size,
        type_size,
    })
}

fn tensor_byte_count(name: &str, element_count: u64, ggml_type: GgmlType) -> io::Result<u64> {
    if !element_count.is_multiple_of(ggml_type.block_size) {
        return invalid_data(format!(
            "GGUF tensor {name} element count {element_count} is not divisible by block size {} for type {}",
            ggml_type.block_size, ggml_type.name
        ));
    }
    element_count
        .checked_div(ggml_type.block_size)
        .and_then(|blocks| blocks.checked_mul(ggml_type.type_size))
        .ok_or_else(|| {
            invalid_data_error(format!(
                "GGUF tensor {name} byte count overflow for type id {}",
                ggml_type.id
            ))
        })
}

fn element_count(shape: &[u64]) -> io::Result<u64> {
    let mut count = 1u64;
    for dimension in shape {
        count = count
            .checked_mul(*dimension)
            .ok_or_else(|| invalid_data_error("GGUF tensor element count overflow"))?;
    }
    Ok(count)
}

fn validate_alignment(alignment: u64) -> io::Result<()> {
    if alignment == 0 {
        return invalid_data("GGUF alignment must be non-zero");
    }
    if !alignment.is_power_of_two() {
        return invalid_data(format!("GGUF alignment {alignment} is not a power of two"));
    }
    Ok(())
}

fn align_to(value: u64, alignment: u64) -> io::Result<u64> {
    validate_alignment(alignment)?;
    let remainder = value % alignment;
    if remainder == 0 {
        return Ok(value);
    }
    value
        .checked_add(alignment - remainder)
        .ok_or_else(|| invalid_data_error("GGUF alignment overflow"))
}

fn push_field(out: &mut String, key: &str, value: &str) {
    out.push_str(key);
    out.push('=');
    out.push_str(value);
    out.push('\n');
}

fn push_optional_u64(out: &mut String, key: &str, value: Option<u64>) {
    match value {
        Some(value) => push_field(out, key, &value.to_string()),
        None => push_field(out, key, "unknown"),
    }
}

fn push_optional_hex64(out: &mut String, key: &str, value: Option<u64>) {
    match value {
        Some(value) => push_field(out, key, &hex64(value)),
        None => push_field(out, key, "unknown"),
    }
}

fn shape_text(shape: &[u64]) -> String {
    shape
        .iter()
        .map(u64::to_string)
        .collect::<Vec<_>>()
        .join("x")
}

fn fnv_update(checksum: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *checksum ^= u64::from(*byte);
        *checksum = checksum.wrapping_mul(FNV_PRIME);
    }
}

fn invalid_data<T>(message: impl Into<String>) -> io::Result<T> {
    Err(invalid_data_error(message))
}

fn invalid_data_error(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

impl GgufReader {
    fn open(path: &Path) -> io::Result<Self> {
        Ok(Self {
            file: File::open(path)?,
            offset: 0,
        })
    }

    fn read_bytes(&mut self, length: usize) -> io::Result<Vec<u8>> {
        let mut bytes = vec![0u8; length];
        self.file.read_exact(&mut bytes)?;
        self.offset = self
            .offset
            .checked_add(length as u64)
            .ok_or_else(|| invalid_data_error("GGUF reader offset overflow"))?;
        Ok(bytes)
    }

    fn read_u32(&mut self) -> io::Result<u32> {
        let bytes = self.read_bytes(4)?;
        Ok(u32::from_le_bytes(
            bytes.try_into().expect("u32 read length"),
        ))
    }

    fn read_u64(&mut self) -> io::Result<u64> {
        let bytes = self.read_bytes(8)?;
        Ok(u64::from_le_bytes(
            bytes.try_into().expect("u64 read length"),
        ))
    }

    fn read_string(&mut self) -> io::Result<String> {
        let length = self.read_u64()?;
        if length > MAX_STRING_BYTES {
            return invalid_data(format!(
                "GGUF string length {length} exceeds limit {MAX_STRING_BYTES}"
            ));
        }
        let bytes = self.read_bytes(length as usize)?;
        String::from_utf8(bytes).map_err(|_| invalid_data_error("GGUF string is not valid UTF-8"))
    }
}

fn fixture_bytes() -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(GGUF_MAGIC);
    write_u32_vec(&mut bytes, 3);
    write_u64_vec(&mut bytes, 2);
    write_u64_vec(&mut bytes, 3);
    write_metadata_string(&mut bytes, "general.architecture", "tinyrustlm-fixture")?;
    write_metadata_string(&mut bytes, "general.name", "TinyRustLM GGUF fixture")?;
    write_metadata_u32(&mut bytes, "general.alignment", DEFAULT_ALIGNMENT as u32)?;

    write_string_vec(&mut bytes, "token_embd.weight")?;
    write_u32_vec(&mut bytes, 2);
    write_u64_vec(&mut bytes, 4);
    write_u64_vec(&mut bytes, 2);
    write_u32_vec(&mut bytes, 0);
    write_u64_vec(&mut bytes, 0);

    write_string_vec(&mut bytes, "output.weight")?;
    write_u32_vec(&mut bytes, 2);
    write_u64_vec(&mut bytes, 4);
    write_u64_vec(&mut bytes, 2);
    write_u32_vec(&mut bytes, 1);
    write_u64_vec(&mut bytes, 32);

    let tensor_data_offset = align_to(bytes.len() as u64, DEFAULT_ALIGNMENT)?;
    bytes.resize(tensor_data_offset as usize, 0);
    bytes.extend_from_slice(&[0u8; 32]);
    bytes.extend_from_slice(&[0u8; 16]);
    Ok(bytes)
}

fn source_fixture_bytes(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::F32)
}

fn source_fixture_bytes_with_q4_0(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q4_0)
}

fn source_fixture_bytes_with_q4_1(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q4_1)
}

fn source_fixture_bytes_with_q4_k(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q4K)
}

fn source_fixture_bytes_with_q5_0(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q5_0)
}

fn source_fixture_bytes_with_q5_1(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q5_1)
}

fn source_fixture_bytes_with_q2_k(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q2K)
}

fn source_fixture_bytes_with_q3_k(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q3K)
}

fn source_fixture_bytes_with_q5_k(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q5K)
}

fn source_fixture_bytes_with_q6_k(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q6K)
}

fn source_fixture_bytes_with_q8_0(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q8_0)
}

fn source_fixture_bytes_with_q8_1(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q8_1)
}

fn source_fixture_bytes_with_q8_k(shape_name: &str) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding(shape_name, SourceFixtureEncoding::Q8K)
}

fn source_fixture_bytes_with_encoding(
    shape_name: &str,
    encoding: SourceFixtureEncoding,
) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding_and_token_count(shape_name, encoding, None)
}

#[cfg(test)]
fn source_fixture_bytes_with_tokenizer_token_count(
    shape_name: &str,
    token_count: u32,
) -> io::Result<Vec<u8>> {
    source_fixture_bytes_with_encoding_and_token_count(
        shape_name,
        SourceFixtureEncoding::F32,
        Some(token_count),
    )
}

fn source_fixture_bytes_with_encoding_and_token_count(
    shape_name: &str,
    encoding: SourceFixtureEncoding,
    tokenizer_token_count_override: Option<u32>,
) -> io::Result<Vec<u8>> {
    let source_contract = trained_source::source_shape_contract(shape_name)?;
    let expectations = trained_source::source_tensor_expectations(shape_name)?;
    let mut payloads = Vec::with_capacity(expectations.len());
    let mut tensor_type_ids = Vec::with_capacity(expectations.len());
    let mut relative_offsets = Vec::with_capacity(expectations.len());
    let mut cursor = 0u64;
    for (index, expectation) in expectations.iter().enumerate() {
        cursor = align_to(cursor, DEFAULT_ALIGNMENT)?;
        relative_offsets.push(cursor);
        let f32_payload = source_fixture_payload(index, expectation)?;
        let (tensor_type_id, payload) = match encoding {
            SourceFixtureEncoding::Q4_0 if q4_0_fixture_eligible(&f32_payload) => {
                (2, encode_q4_0_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q4_1 if q4_1_fixture_eligible(&f32_payload) => {
                (3, encode_q4_1_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q4K if q4_k_fixture_eligible(&f32_payload) => {
                (12, encode_q4_k_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q5_0 if q5_0_fixture_eligible(&f32_payload) => {
                (6, encode_q5_0_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q5_1 if q5_1_fixture_eligible(&f32_payload) => {
                (7, encode_q5_1_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q2K if q2_k_fixture_eligible(&f32_payload) => {
                (10, encode_q2_k_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q3K if q3_k_fixture_eligible(&f32_payload) => {
                (11, encode_q3_k_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q5K if q5_k_fixture_eligible(&f32_payload) => {
                (13, encode_q5_k_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q6K if q6_k_fixture_eligible(&f32_payload) => {
                (14, encode_q6_k_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q8_0 if q8_0_fixture_eligible(&f32_payload) => {
                (8, encode_q8_0_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q8_1 if q8_1_fixture_eligible(&f32_payload) => {
                (9, encode_q8_1_payload_from_f32(&f32_payload)?)
            }
            SourceFixtureEncoding::Q8K if q8_k_fixture_eligible(&f32_payload) => {
                (15, encode_q8_k_payload_from_f32(&f32_payload)?)
            }
            _ => (0, f32_payload),
        };
        cursor = cursor
            .checked_add(payload.len() as u64)
            .ok_or_else(|| invalid_data_error("GGUF source fixture tensor data overflow"))?;
        tensor_type_ids.push(tensor_type_id);
        payloads.push(payload);
    }

    let mut bytes = Vec::new();
    let source_shape_uses_bpe = source_contract.tokenizer_strategy == "manifest-bpe-v1";
    bytes.extend_from_slice(GGUF_MAGIC);
    write_u32_vec(&mut bytes, 3);
    write_u64_vec(&mut bytes, expectations.len() as u64);
    write_u64_vec(&mut bytes, if source_shape_uses_bpe { 7 } else { 6 });
    write_metadata_string(&mut bytes, "general.architecture", "tinyrustlm-fixture")?;
    write_metadata_string(&mut bytes, "general.name", "TinyRustLM GGUF source fixture")?;
    write_metadata_string(&mut bytes, "tinyrustlm.source_shape", shape_name)?;
    write_metadata_string(
        &mut bytes,
        "tokenizer.ggml.model",
        source_contract.tokenizer_strategy,
    )?;
    write_metadata_tokenizer_tokens(
        &mut bytes,
        tokenizer_token_count_override.unwrap_or(source_contract.shape.vocab_size),
        source_shape_uses_bpe,
    )?;
    if source_shape_uses_bpe {
        write_metadata_tokenizer_merges(&mut bytes)?;
    }
    write_metadata_u32(&mut bytes, "general.alignment", DEFAULT_ALIGNMENT as u32)?;

    for (index, expectation) in expectations.iter().enumerate() {
        let source_name =
            gguf_alias_for_local(&expectation.name).unwrap_or_else(|| expectation.name.clone());
        write_string_vec(&mut bytes, &source_name)?;
        write_u32_vec(&mut bytes, expectation.dims.len() as u32);
        for dimension in &expectation.dims {
            write_u64_vec(&mut bytes, *dimension);
        }
        write_u32_vec(&mut bytes, tensor_type_ids[index]);
        write_u64_vec(&mut bytes, relative_offsets[index]);
    }

    let tensor_data_offset = align_to(bytes.len() as u64, DEFAULT_ALIGNMENT)?;
    bytes.resize(tensor_data_offset as usize, 0);
    for (index, payload) in payloads.iter().enumerate() {
        let absolute_start = tensor_data_offset
            .checked_add(relative_offsets[index])
            .ok_or_else(|| invalid_data_error("GGUF source fixture absolute offset overflow"))?;
        if bytes.len() < absolute_start as usize {
            bytes.resize(absolute_start as usize, 0);
        }
        bytes.extend_from_slice(payload);
    }
    Ok(bytes)
}

fn q4_0_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q4_0_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q4_0_BLOCK_ELEMENTS * 4)
}

fn encode_q4_0_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q4_0_fixture_eligible(f32_payload) {
        return invalid_data("Q4_0 fixture source f32 payload must divide into 32-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q4_0_FIXTURE_SCALE_BITS);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q4_0_BLOCK_ELEMENTS * 4)) * GGUF_Q4_0_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q4_0_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q4_0_FIXTURE_SCALE_BITS.to_le_bytes());
        let mut quantized = [0u8; GGUF_Q4_0_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q4_0 fixture source f32 payload contains a non-finite value");
            }
            let rounded = (value / scale).round().clamp(-8.0, 7.0) as i8;
            quantized[index] = (rounded + 8) as u8;
        }
        for index in 0..(GGUF_Q4_0_BLOCK_ELEMENTS / 2) {
            encoded.push(quantized[index] | (quantized[index + 16] << 4));
        }
    }
    Ok(encoded)
}

fn q4_1_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q4_1_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q4_1_BLOCK_ELEMENTS * 4)
}

fn encode_q4_1_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q4_1_fixture_eligible(f32_payload) {
        return invalid_data("Q4_1 fixture source f32 payload must divide into 32-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q4_1_FIXTURE_SCALE_BITS);
    let min = f16_bits_to_f32(GGUF_Q4_1_FIXTURE_MIN_BITS);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q4_1_BLOCK_ELEMENTS * 4)) * GGUF_Q4_1_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q4_1_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q4_1_FIXTURE_SCALE_BITS.to_le_bytes());
        encoded.extend_from_slice(&GGUF_Q4_1_FIXTURE_MIN_BITS.to_le_bytes());
        let mut quantized = [0u8; GGUF_Q4_1_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q4_1 fixture source f32 payload contains a non-finite value");
            }
            quantized[index] = ((value - min) / scale).round().clamp(0.0, 15.0) as u8;
        }
        for index in 0..(GGUF_Q4_1_BLOCK_ELEMENTS / 2) {
            encoded.push(quantized[index] | (quantized[index + 16] << 4));
        }
    }
    Ok(encoded)
}

fn q4_k_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q4_K_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q4_K_BLOCK_ELEMENTS * 4)
}

fn encode_q4_k_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q4_k_fixture_eligible(f32_payload) {
        return invalid_data("Q4_K fixture source f32 payload must divide into 256-value blocks");
    }
    let super_scale = f16_bits_to_f32(GGUF_Q4_K_FIXTURE_SCALE_BITS);
    let super_min = f16_bits_to_f32(GGUF_Q4_K_FIXTURE_MIN_BITS);
    let group_scales = [GGUF_Q4_K_FIXTURE_SUBSCALE; GGUF_Q4_K_GROUP_COUNT];
    let group_mins = [GGUF_Q4_K_FIXTURE_SUBMIN; GGUF_Q4_K_GROUP_COUNT];
    let packed_scales = pack_k_scale_min_6bit(&group_scales, &group_mins);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q4_K_BLOCK_ELEMENTS * 4)) * GGUF_Q4_K_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q4_K_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q4_K_FIXTURE_SCALE_BITS.to_le_bytes());
        encoded.extend_from_slice(&GGUF_Q4_K_FIXTURE_MIN_BITS.to_le_bytes());
        encoded.extend_from_slice(&packed_scales);
        let mut quantized = [0u8; GGUF_Q4_K_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q4_K fixture source f32 payload contains a non-finite value");
            }
            let group = index / GGUF_Q4_K_GROUP_ELEMENTS;
            let d = super_scale * f32::from(group_scales[group]);
            let m = super_min * f32::from(group_mins[group]);
            quantized[index] = ((value + m) / d).round().clamp(0.0, 15.0) as u8;
        }
        for pair in 0..(GGUF_Q4_K_GROUP_COUNT / 2) {
            let base = pair * GGUF_Q4_K_GROUP_ELEMENTS * 2;
            for lane in 0..GGUF_Q4_K_GROUP_ELEMENTS {
                encoded.push(quantized[base + lane] | (quantized[base + lane + 32] << 4));
            }
        }
    }
    Ok(encoded)
}

fn pack_k_scale_min_6bit(
    scales: &[u8; GGUF_Q4_K_GROUP_COUNT],
    mins: &[u8; GGUF_Q4_K_GROUP_COUNT],
) -> [u8; GGUF_Q4_K_SCALE_BYTES] {
    let mut packed = [0u8; GGUF_Q4_K_SCALE_BYTES];
    for group in 0..GGUF_Q4_K_GROUP_COUNT {
        let scale = scales[group].min(63);
        let min = mins[group].min(63);
        if group < 4 {
            packed[group] = scale;
            packed[group + 4] = min;
        } else {
            packed[group + 4] = (scale & 0x0f) | ((min & 0x0f) << 4);
            packed[group - 4] |= (scale >> 4) << 6;
            packed[group] |= (min >> 4) << 6;
        }
    }
    packed
}

fn q5_0_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q5_0_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q5_0_BLOCK_ELEMENTS * 4)
}

fn encode_q5_0_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q5_0_fixture_eligible(f32_payload) {
        return invalid_data("Q5_0 fixture source f32 payload must divide into 32-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q5_0_FIXTURE_SCALE_BITS);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q5_0_BLOCK_ELEMENTS * 4)) * GGUF_Q5_0_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q5_0_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q5_0_FIXTURE_SCALE_BITS.to_le_bytes());
        let mut high_bits = 0u32;
        let mut quantized = [0u8; GGUF_Q5_0_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q5_0 fixture source f32 payload contains a non-finite value");
            }
            let rounded = (value / scale).round().clamp(-16.0, 15.0) as i8;
            let encoded_value = (rounded + 16) as u8;
            quantized[index] = encoded_value;
            if (encoded_value & 0x10) != 0 {
                high_bits |= 1u32 << index;
            }
        }
        encoded.extend_from_slice(&high_bits.to_le_bytes());
        for index in 0..(GGUF_Q5_0_BLOCK_ELEMENTS / 2) {
            encoded.push((quantized[index] & 0x0f) | ((quantized[index + 16] & 0x0f) << 4));
        }
    }
    Ok(encoded)
}

fn q5_1_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q5_1_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q5_1_BLOCK_ELEMENTS * 4)
}

fn encode_q5_1_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q5_1_fixture_eligible(f32_payload) {
        return invalid_data("Q5_1 fixture source f32 payload must divide into 32-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q5_1_FIXTURE_SCALE_BITS);
    let min = f16_bits_to_f32(GGUF_Q5_1_FIXTURE_MIN_BITS);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q5_1_BLOCK_ELEMENTS * 4)) * GGUF_Q5_1_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q5_1_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q5_1_FIXTURE_SCALE_BITS.to_le_bytes());
        encoded.extend_from_slice(&GGUF_Q5_1_FIXTURE_MIN_BITS.to_le_bytes());
        let mut high_bits = 0u32;
        let mut quantized = [0u8; GGUF_Q5_1_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q5_1 fixture source f32 payload contains a non-finite value");
            }
            let encoded_value = ((value - min) / scale).round().clamp(0.0, 31.0) as u8;
            quantized[index] = encoded_value;
            if (encoded_value & 0x10) != 0 {
                high_bits |= 1u32 << index;
            }
        }
        encoded.extend_from_slice(&high_bits.to_le_bytes());
        for index in 0..(GGUF_Q5_1_BLOCK_ELEMENTS / 2) {
            encoded.push((quantized[index] & 0x0f) | ((quantized[index + 16] & 0x0f) << 4));
        }
    }
    Ok(encoded)
}

fn q2_k_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q2_K_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q2_K_BLOCK_ELEMENTS * 4)
}

fn encode_q2_k_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q2_k_fixture_eligible(f32_payload) {
        return invalid_data("Q2_K fixture source f32 payload must divide into 256-value blocks");
    }
    let scale_bits = f32_to_f16_bits_for_fixture(GGUF_Q2_K_FIXTURE_SCALE);
    let scale = f16_bits_to_f32(scale_bits);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q2_K_BLOCK_ELEMENTS * 4)) * GGUF_Q2_K_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q2_K_BLOCK_ELEMENTS * 4) {
        let mut source_values = [0.0f32; GGUF_Q2_K_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q2_K fixture source f32 payload contains a non-finite value");
            }
            source_values[index] = value;
        }

        let mut scales = [0u8; GGUF_Q2_K_SCALE_BYTES];
        let mut levels = [0u8; GGUF_Q2_K_BLOCK_ELEMENTS];
        for (group, group_scale_ref) in scales.iter_mut().enumerate().take(GGUF_Q2_K_GROUP_COUNT) {
            let start = group * GGUF_Q2_K_GROUP_ELEMENTS;
            let max = source_values[start..start + GGUF_Q2_K_GROUP_ELEMENTS]
                .iter()
                .copied()
                .fold(0.0f32, f32::max);
            let group_scale = ((max / (scale * 3.0)).ceil() as u8).clamp(1, 15);
            *group_scale_ref = group_scale;
            let step = scale * f32::from(group_scale);
            for lane in 0..GGUF_Q2_K_GROUP_ELEMENTS {
                let index = start + lane;
                levels[index] = (source_values[index] / step).round().clamp(0.0, 3.0) as u8;
            }
        }

        let mut quants = [0u8; GGUF_Q2_K_QUANT_BYTES];
        for segment in (0..GGUF_Q2_K_BLOCK_ELEMENTS).step_by(128) {
            for lane in 0..32 {
                quants[(segment / 4) + lane] = levels[segment + lane]
                    | (levels[segment + lane + 32] << 2)
                    | (levels[segment + lane + 64] << 4)
                    | (levels[segment + lane + 96] << 6);
            }
        }

        encoded.extend_from_slice(&scales);
        encoded.extend_from_slice(&quants);
        encoded.extend_from_slice(&scale_bits.to_le_bytes());
        encoded.extend_from_slice(&GGUF_Q2_K_FIXTURE_MIN_BITS.to_le_bytes());
    }
    Ok(encoded)
}

fn q3_k_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q3_K_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q3_K_BLOCK_ELEMENTS * 4)
}

fn encode_q3_k_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q3_k_fixture_eligible(f32_payload) {
        return invalid_data("Q3_K fixture source f32 payload must divide into 256-value blocks");
    }
    let scale_bits = f32_to_f16_bits_for_fixture(GGUF_Q3_K_FIXTURE_SCALE);
    let scale = f16_bits_to_f32(scale_bits);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q3_K_BLOCK_ELEMENTS * 4)) * GGUF_Q3_K_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q3_K_BLOCK_ELEMENTS * 4) {
        let mut source_values = [0.0f32; GGUF_Q3_K_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q3_K fixture source f32 payload contains a non-finite value");
            }
            source_values[index] = value;
        }

        let mut scale_codes = [0u8; GGUF_Q3_K_GROUP_COUNT];
        let mut levels = [0u8; GGUF_Q3_K_BLOCK_ELEMENTS];
        for (group, scale_code_ref) in scale_codes
            .iter_mut()
            .enumerate()
            .take(GGUF_Q3_K_GROUP_COUNT)
        {
            let start = group * GGUF_Q3_K_GROUP_ELEMENTS;
            let max = source_values[start..start + GGUF_Q3_K_GROUP_ELEMENTS]
                .iter()
                .copied()
                .map(f32::abs)
                .fold(0.0f32, f32::max);
            let signed_scale = ((max / (scale * 3.0)).ceil() as i8).clamp(1, 31);
            *scale_code_ref = (signed_scale + 32) as u8;
            let step = scale * f32::from(signed_scale);
            for lane in 0..GGUF_Q3_K_GROUP_ELEMENTS {
                let index = start + lane;
                let signed_level = (source_values[index] / step).round().clamp(-4.0, 3.0) as i8;
                levels[index] = (signed_level + 4) as u8;
            }
        }

        let mut high_bits = [0u8; GGUF_Q3_K_HIGH_BYTES];
        let mut low_levels = [0u8; GGUF_Q3_K_BLOCK_ELEMENTS];
        let mut mask_index = 0;
        let mut high_mask = 1u8;
        for (index, level) in levels.iter().copied().enumerate() {
            let mut low = level;
            if low > 3 {
                high_bits[mask_index] |= high_mask;
                low -= 4;
            }
            low_levels[index] = low;
            mask_index += 1;
            if mask_index == GGUF_Q3_K_HIGH_BYTES {
                mask_index = 0;
                high_mask = high_mask.wrapping_shl(1);
            }
        }

        let mut quants = [0u8; GGUF_Q3_K_QUANT_BYTES];
        for segment in (0..GGUF_Q3_K_BLOCK_ELEMENTS).step_by(128) {
            for lane in 0..32 {
                quants[(segment / 4) + lane] = low_levels[segment + lane]
                    | (low_levels[segment + lane + 32] << 2)
                    | (low_levels[segment + lane + 64] << 4)
                    | (low_levels[segment + lane + 96] << 6);
            }
        }

        encoded.extend_from_slice(&high_bits);
        encoded.extend_from_slice(&quants);
        encoded.extend_from_slice(&pack_q3_k_scale_codes(&scale_codes));
        encoded.extend_from_slice(&scale_bits.to_le_bytes());
    }
    Ok(encoded)
}

fn pack_q3_k_scale_codes(codes: &[u8; GGUF_Q3_K_GROUP_COUNT]) -> [u8; GGUF_Q3_K_SCALE_BYTES] {
    let mut packed = [0u8; GGUF_Q3_K_SCALE_BYTES];
    for group in 0..GGUF_Q3_K_GROUP_COUNT {
        let code = codes[group] & 0x3f;
        let low = code & 0x0f;
        let high = (code >> 4) & 0x03;
        if group < 8 {
            packed[group] |= low;
        } else {
            packed[group - 8] |= low << 4;
        }
        packed[8 + (group % 4)] |= high << (2 * (group / 4));
    }
    packed
}

fn q5_k_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q5_K_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q5_K_BLOCK_ELEMENTS * 4)
}

fn encode_q5_k_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q5_k_fixture_eligible(f32_payload) {
        return invalid_data("Q5_K fixture source f32 payload must divide into 256-value blocks");
    }
    let super_scale = f16_bits_to_f32(GGUF_Q5_K_FIXTURE_SCALE_BITS);
    let super_min = f16_bits_to_f32(GGUF_Q5_K_FIXTURE_MIN_BITS);
    let group_scales = [GGUF_Q5_K_FIXTURE_SUBSCALE; GGUF_Q4_K_GROUP_COUNT];
    let group_mins = [GGUF_Q5_K_FIXTURE_SUBMIN; GGUF_Q4_K_GROUP_COUNT];
    let packed_scales = pack_k_scale_min_6bit(&group_scales, &group_mins);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q5_K_BLOCK_ELEMENTS * 4)) * GGUF_Q5_K_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q5_K_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q5_K_FIXTURE_SCALE_BITS.to_le_bytes());
        encoded.extend_from_slice(&GGUF_Q5_K_FIXTURE_MIN_BITS.to_le_bytes());
        encoded.extend_from_slice(&packed_scales);
        let mut quantized = [0u8; GGUF_Q5_K_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q5_K fixture source f32 payload contains a non-finite value");
            }
            let group = index / GGUF_Q4_K_GROUP_ELEMENTS;
            let d = super_scale * f32::from(group_scales[group]);
            let m = super_min * f32::from(group_mins[group]);
            quantized[index] = ((value + m) / d).round().clamp(0.0, 31.0) as u8;
        }
        let mut high_bits = [0u8; GGUF_Q5_K_HIGH_BYTES];
        let mut low_bits = [0u8; GGUF_Q5_K_QUANT_BYTES];
        for pair in 0..(GGUF_Q4_K_GROUP_COUNT / 2) {
            let base = pair * GGUF_Q4_K_GROUP_ELEMENTS * 2;
            let high_mask_1 = 1u8 << (pair * 2);
            let high_mask_2 = 2u8 << (pair * 2);
            let low_base = pair * GGUF_Q4_K_GROUP_ELEMENTS;
            for lane in 0..GGUF_Q4_K_GROUP_ELEMENTS {
                let q1 = quantized[base + lane];
                let q2 = quantized[base + lane + 32];
                if (q1 & 0x10) != 0 {
                    high_bits[lane] |= high_mask_1;
                }
                if (q2 & 0x10) != 0 {
                    high_bits[lane] |= high_mask_2;
                }
                low_bits[low_base + lane] = (q1 & 0x0f) | ((q2 & 0x0f) << 4);
            }
        }
        encoded.extend_from_slice(&high_bits);
        encoded.extend_from_slice(&low_bits);
    }
    Ok(encoded)
}

fn q6_k_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q6_K_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q6_K_BLOCK_ELEMENTS * 4)
}

fn encode_q6_k_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q6_k_fixture_eligible(f32_payload) {
        return invalid_data("Q6_K fixture source f32 payload must divide into 256-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q6_K_FIXTURE_SCALE_BITS);
    let subscale = f32::from(GGUF_Q6_K_FIXTURE_SUBSCALE);
    let step = scale * subscale;
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q6_K_BLOCK_ELEMENTS * 4)) * GGUF_Q6_K_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q6_K_BLOCK_ELEMENTS * 4) {
        let mut levels = [0u8; GGUF_Q6_K_BLOCK_ELEMENTS];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q6_K fixture source f32 payload contains a non-finite value");
            }
            let quantized = (value / step).round().clamp(-32.0, 31.0) as i8;
            levels[index] = (quantized + 32) as u8;
        }
        let mut low = [0u8; GGUF_Q6_K_LOW_BYTES];
        let mut high = [0u8; GGUF_Q6_K_HIGH_BYTES];
        for segment in 0..2 {
            let base = segment * 128;
            let low_base = segment * 64;
            let high_base = segment * 32;
            for lane in 0..32 {
                let q1 = levels[base + lane];
                let q2 = levels[base + lane + 32];
                let q3 = levels[base + lane + 64];
                let q4 = levels[base + lane + 96];
                low[low_base + lane] = (q1 & 0x0f) | ((q3 & 0x0f) << 4);
                low[low_base + lane + 32] = (q2 & 0x0f) | ((q4 & 0x0f) << 4);
                high[high_base + lane] =
                    (q1 >> 4) | ((q2 >> 4) << 2) | ((q3 >> 4) << 4) | ((q4 >> 4) << 6);
            }
        }
        encoded.extend_from_slice(&low);
        encoded.extend_from_slice(&high);
        encoded.extend(std::iter::repeat_n(
            GGUF_Q6_K_FIXTURE_SUBSCALE as u8,
            GGUF_Q6_K_SCALE_COUNT,
        ));
        encoded.extend_from_slice(&GGUF_Q6_K_FIXTURE_SCALE_BITS.to_le_bytes());
    }
    Ok(encoded)
}

fn q8_0_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q8_0_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q8_0_BLOCK_ELEMENTS * 4)
}

fn encode_q8_0_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q8_0_fixture_eligible(f32_payload) {
        return invalid_data("Q8_0 fixture source f32 payload must divide into 32-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q8_0_FIXTURE_SCALE_BITS);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q8_0_BLOCK_ELEMENTS * 4)) * GGUF_Q8_0_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q8_0_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q8_0_FIXTURE_SCALE_BITS.to_le_bytes());
        for chunk in block.chunks_exact(4) {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q8_0 fixture source f32 payload contains a non-finite value");
            }
            let quantized = (value / scale).round().clamp(-128.0, 127.0) as i8;
            encoded.push(quantized as u8);
        }
    }
    Ok(encoded)
}

fn q8_1_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q8_1_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q8_1_BLOCK_ELEMENTS * 4)
}

fn encode_q8_1_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q8_1_fixture_eligible(f32_payload) {
        return invalid_data("Q8_1 fixture source f32 payload must divide into 32-value blocks");
    }
    let scale = f16_bits_to_f32(GGUF_Q8_1_FIXTURE_SCALE_BITS);
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q8_1_BLOCK_ELEMENTS * 4)) * GGUF_Q8_1_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q8_1_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q8_1_FIXTURE_SCALE_BITS.to_le_bytes());
        let mut quantized = [0i8; GGUF_Q8_1_BLOCK_ELEMENTS];
        let mut sum = 0i32;
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q8_1 fixture source f32 payload contains a non-finite value");
            }
            let encoded_value = (value / scale).round().clamp(-128.0, 127.0) as i8;
            quantized[index] = encoded_value;
            sum += i32::from(encoded_value);
        }
        encoded.extend_from_slice(&f32_to_f16_bits_for_fixture(scale * sum as f32).to_le_bytes());
        for value in quantized {
            encoded.push(value as u8);
        }
    }
    Ok(encoded)
}

fn q8_k_fixture_eligible(f32_payload: &[u8]) -> bool {
    f32_payload.len() >= GGUF_Q8_K_BLOCK_ELEMENTS * 4
        && f32_payload
            .len()
            .is_multiple_of(GGUF_Q8_K_BLOCK_ELEMENTS * 4)
}

fn encode_q8_k_payload_from_f32(f32_payload: &[u8]) -> io::Result<Vec<u8>> {
    if !q8_k_fixture_eligible(f32_payload) {
        return invalid_data("Q8_K fixture source f32 payload must divide into 256-value blocks");
    }
    let mut encoded = Vec::with_capacity(
        (f32_payload.len() / (GGUF_Q8_K_BLOCK_ELEMENTS * 4)) * GGUF_Q8_K_BLOCK_BYTES,
    );
    for block in f32_payload.chunks_exact(GGUF_Q8_K_BLOCK_ELEMENTS * 4) {
        encoded.extend_from_slice(&GGUF_Q8_K_FIXTURE_SCALE.to_le_bytes());
        let mut quantized = [0i8; GGUF_Q8_K_BLOCK_ELEMENTS];
        let mut block_sums = [0i16; GGUF_Q8_K_BSUM_COUNT];
        for (index, chunk) in block.chunks_exact(4).enumerate() {
            let value = f32::from_le_bytes(chunk.try_into().expect("f32 fixture chunk length"));
            if !value.is_finite() {
                return invalid_data("Q8_K fixture source f32 payload contains a non-finite value");
            }
            let encoded_value = (value / GGUF_Q8_K_FIXTURE_SCALE)
                .round()
                .clamp(-128.0, 127.0) as i8;
            quantized[index] = encoded_value;
            block_sums[index / 16] += i16::from(encoded_value);
        }
        for value in quantized {
            encoded.push(value as u8);
        }
        for sum in block_sums {
            encoded.extend_from_slice(&sum.to_le_bytes());
        }
    }
    Ok(encoded)
}

fn f32_to_f16_bits_for_fixture(value: f32) -> u16 {
    if value == 0.0 {
        return 0;
    }
    let bits = value.to_bits();
    let sign = ((bits >> 16) & 0x8000) as u16;
    let exponent = ((bits >> 23) & 0xff) as i32 - 127 + 15;
    let mantissa = bits & 0x007f_ffff;
    if exponent <= 0 {
        return sign;
    }
    if exponent >= 0x1f {
        return sign | 0x7c00;
    }
    sign | ((exponent as u16) << 10) | ((mantissa >> 13) as u16)
}

fn source_fixture_payload(
    tensor_index: usize,
    expectation: &trained_source::SourceTensorExpectation,
) -> io::Result<Vec<u8>> {
    let element_count = expectation
        .f32_bytes
        .checked_div(4)
        .ok_or_else(|| invalid_data_error("GGUF source fixture f32 byte underflow"))?;
    let element_count = usize::try_from(element_count)
        .map_err(|_| invalid_data_error("GGUF source fixture tensor is too large for this host"))?;
    let mut bytes = Vec::with_capacity(element_count * 4);
    for index in 0..element_count {
        let value = ((tensor_index + 1) as f32 * 0.01) + ((index % 97) as f32 * 0.0001);
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    Ok(bytes)
}

fn write_metadata_string(bytes: &mut Vec<u8>, key: &str, value: &str) -> io::Result<()> {
    write_string_vec(bytes, key)?;
    write_u32_vec(bytes, 8);
    write_string_vec(bytes, value)
}

fn write_metadata_u32(bytes: &mut Vec<u8>, key: &str, value: u32) -> io::Result<()> {
    write_string_vec(bytes, key)?;
    write_u32_vec(bytes, 4);
    write_u32_vec(bytes, value);
    Ok(())
}

fn write_metadata_tokenizer_tokens(
    bytes: &mut Vec<u8>,
    token_count: u32,
    source_shape_uses_bpe: bool,
) -> io::Result<()> {
    write_string_vec(bytes, "tokenizer.ggml.tokens")?;
    write_u32_vec(bytes, 9);
    write_u32_vec(bytes, 8);
    write_u64_vec(bytes, u64::from(token_count));
    for id in 0..token_count {
        let token = if source_shape_uses_bpe {
            match id {
                260 => "to".to_string(),
                261 => "ton".to_string(),
                _ => format!("tinyrustlm_token_{id}"),
            }
        } else {
            format!("tinyrustlm_token_{id}")
        };
        write_string_vec(bytes, &token)?;
    }
    Ok(())
}

fn write_metadata_tokenizer_merges(bytes: &mut Vec<u8>) -> io::Result<()> {
    write_string_vec(bytes, "tokenizer.ggml.merges")?;
    write_u32_vec(bytes, 9);
    write_u32_vec(bytes, 8);
    write_u64_vec(bytes, 2);
    write_string_vec(bytes, "t o")?;
    write_string_vec(bytes, "to n")?;
    Ok(())
}

fn write_string_vec(bytes: &mut Vec<u8>, value: &str) -> io::Result<()> {
    write_u64_vec(bytes, value.len() as u64);
    bytes.write_all(value.as_bytes())
}

fn write_u32_vec(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn write_u64_vec(bytes: &mut Vec<u8>, value: u64) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_path(name: &str) -> std::path::PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after UNIX_EPOCH")
            .as_millis();
        std::env::temp_dir().join(format!(
            "tinyrustlm-gguf-{name}-{}-{millis}.gguf",
            std::process::id()
        ))
    }

    fn unique_dir(name: &str) -> std::path::PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after UNIX_EPOCH")
            .as_millis();
        std::env::temp_dir().join(format!(
            "tinyrustlm-gguf-{name}-{}-{millis}",
            std::process::id()
        ))
    }

    #[test]
    fn fixture_inspection_reports_metadata_and_tensor_bounds() {
        let path = unique_path("fixture");
        write_fixture_path(&path).expect("write GGUF fixture");

        let inspection = inspect_input(&path).expect("inspect GGUF fixture");

        assert_eq!(inspection.version, 3);
        assert_eq!(inspection.metadata_kv_count, 3);
        assert_eq!(inspection.tensor_count, 2);
        assert_eq!(inspection.alignment, DEFAULT_ALIGNMENT);
        assert_eq!(
            inspection.architecture.as_deref(),
            Some("tinyrustlm-fixture")
        );
        assert_eq!(
            inspection.model_name.as_deref(),
            Some("TinyRustLM GGUF fixture")
        );
        assert_eq!(inspection.tensors[0].name, "token_embd.weight");
        assert_eq!(inspection.tensors[0].type_name, "F32");
        assert_eq!(inspection.tensors[0].byte_count, 32);
        assert_eq!(inspection.tensors[1].name, "output.weight");
        assert_eq!(inspection.tensors[1].type_name, "F16");
        assert_eq!(inspection.tensors[1].relative_offset, 32);
        assert_eq!(inspection.tensor_data_bytes, 48);

        let report = render_report(&inspection);
        assert!(report.contains("tinyrustlm_gguf_inspection_version=1"));
        assert!(report.contains("source_layout=gguf-v3"));
        assert!(report.contains("tensor.0.name=token_embd.weight"));
        assert!(report.contains("tensor.1.type=F16"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-source.gguf");
        let output_dir = dir.join("raw-source");
        write_source_fixture_path(&input, "tiny-fixture").expect("write GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "copy-ready");
        assert!(report.contains("tinyrustlm_gguf_source_plan_version=1"));
        assert!(report.contains("plan_layout=gguf-to-raw-f32-source-plan-v1"));
        assert!(report.contains("target_vocab_size=260"));
        assert!(report.contains("target_tokenizer_strategy=byte-tokenizer-v1"));
        assert!(report.contains("gguf_tokenizer_model=byte-tokenizer-v1"));
        assert!(report.contains("gguf_tokenizer_token_count=260"));
        assert!(report.contains("gguf_tokenizer_token_checksum=0x"));
        assert!(report.contains("tokenizer_compatibility_status=compatible-token-count"));
        assert!(report.contains("tensor.0.gguf_name=token_embd.weight"));
        assert!(report.contains("tensor.3.gguf_name=blk.0.attn_norm.weight"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_gguf_tokenizer_token_count_mismatch_for_source_plan() {
        let path = unique_path("source-tokenizer-mismatch");
        let bytes = source_fixture_bytes_with_tokenizer_token_count("tiny-fixture", 259)
            .expect("build mismatched GGUF source fixture");
        fs::write(&path, bytes).expect("write mismatched GGUF source fixture");

        let error = build_source_plan(&path, "tiny-fixture")
            .expect_err("GGUF tokenizer mismatch should fail planning");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("GGUF tokenizer token count 259 does not match target vocab size 260"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn bpe_source_fixture_imports_gguf_tokenizer_override() {
        let dir = unique_dir("source-bpe-gguf-tokenizer");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-bpe-source.gguf");
        let output_dir = dir.join("raw-source");
        write_source_fixture_path(&input, "tiny-fixture-bpe")
            .expect("write BPE GGUF source fixture");

        let plan =
            build_source_plan(&input, "tiny-fixture-bpe").expect("build BPE GGUF source plan");
        let report = render_source_plan(&plan);

        assert!(report.contains("target_vocab_size=262"));
        assert!(report.contains("target_tokenizer_strategy=manifest-bpe-v1"));
        assert!(report.contains("gguf_tokenizer_token_count=262"));
        assert!(report.contains("gguf_tokenizer_merge_count=2"));
        assert!(report.contains("tokenizer_compatibility_status=compatible-token-count"));

        extract_source_path(&input, "tiny-fixture-bpe", &output_dir)
            .expect("extract BPE GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate BPE GGUF raw source");
        let manifest =
            fs::read_to_string(output_dir.join("source.manifest")).expect("read source manifest");
        assert!(manifest.contains("tokenizer=bpe-v1"));
        assert!(manifest.contains("bpe.token.0.id=260"));
        assert!(manifest.contains("bpe.token.0.bytes_hex=746f"));
        assert!(manifest.contains("bpe.token.1.id=261"));
        assert!(manifest.contains("bpe.token.1.bytes_hex=746f6e"));
        assert!(manifest.contains("bpe.merge.0.left=116"));
        assert!(manifest.contains("bpe.merge.0.right=111"));
        assert!(manifest.contains("bpe.merge.0.output=260"));
        assert!(!manifest.contains("bpe.token.0.bytes_hex=7468"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_gguf_bpe_merge_with_undeclared_token() {
        let path = unique_path("source-bpe-bad-merge");
        let mut bytes =
            source_fixture_bytes("tiny-fixture-bpe").expect("build BPE GGUF source fixture");
        let merge_position =
            find_subsequence(&bytes, b"to n").expect("fixture should contain second BPE merge");
        bytes[merge_position..merge_position + 4].copy_from_slice(b"tx n");
        fs::write(&path, bytes).expect("write bad-merge GGUF source fixture");

        let error = extract_source_path(&path, "tiny-fixture-bpe", &unique_dir("bad-merge-output"))
            .expect_err("bad GGUF BPE merge should fail extraction");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("GGUF BPE merge left token \"tx\" is not declared"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn q4_0_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q4-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q4-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q4_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q4_0 GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build Q4_0 GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q4_0"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q4_0"));
        assert!(report.contains("tensor.1.gguf_type=F32"));
        assert!(report.contains("tensor.1.conversion_action=copy-f32"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract Q4_0 GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q4_0 raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q4_1_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q4-1-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q4-1-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q4_1_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q4_1 GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build Q4_1 GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q4_1"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q4_1"));
        assert!(report.contains("tensor.1.gguf_type=F32"));
        assert!(report.contains("tensor.1.conversion_action=copy-f32"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract Q4_1 GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q4_1 raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q4_k_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q4-k-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q4-k-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q4_k_source_fixture_path(&input, "tinylm16").expect("write Q4_K GGUF source fixture");

        let plan = build_source_plan(&input, "tinylm16").expect("build Q4_K GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q4_K"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q4_k"));

        extract_source_path(&input, "tinylm16", &output_dir).expect("extract Q4_K GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q4_K raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q5_0_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q5-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q5-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q5_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q5_0 GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build Q5_0 GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q5_0"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q5_0"));
        assert!(report.contains("tensor.1.gguf_type=F32"));
        assert!(report.contains("tensor.1.conversion_action=copy-f32"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract Q5_0 GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q5_0 raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q5_1_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q5-1-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q5-1-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q5_1_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q5_1 GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build Q5_1 GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q5_1"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q5_1"));
        assert!(report.contains("tensor.1.gguf_type=F32"));
        assert!(report.contains("tensor.1.conversion_action=copy-f32"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract Q5_1 GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q5_1 raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q2_k_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q2-k-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q2-k-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q2_k_source_fixture_path(&input, "tinylm16").expect("write Q2_K GGUF source fixture");

        let plan = build_source_plan(&input, "tinylm16").expect("build Q2_K GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q2_K"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q2_k"));

        extract_source_path(&input, "tinylm16", &output_dir).expect("extract Q2_K GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q2_K raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q3_k_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q3-k-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q3-k-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q3_k_source_fixture_path(&input, "tinylm16").expect("write Q3_K GGUF source fixture");

        let plan = build_source_plan(&input, "tinylm16").expect("build Q3_K GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q3_K"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q3_k"));

        extract_source_path(&input, "tinylm16", &output_dir).expect("extract Q3_K GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q3_K raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q5_k_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q5-k-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q5-k-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q5_k_source_fixture_path(&input, "tinylm16").expect("write Q5_K GGUF source fixture");

        let plan = build_source_plan(&input, "tinylm16").expect("build Q5_K GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q5_K"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q5_k"));

        extract_source_path(&input, "tinylm16", &output_dir).expect("extract Q5_K GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q5_K raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q6_k_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q6-k-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q6-k-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q6_k_source_fixture_path(&input, "tinylm16").expect("write Q6_K GGUF source fixture");

        let plan = build_source_plan(&input, "tinylm16").expect("build Q6_K GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q6_K"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q6_k"));

        extract_source_path(&input, "tinylm16", &output_dir).expect("extract Q6_K GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q6_K raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q8_0_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q8-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q8-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q8_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q8_0 GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build Q8_0 GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q8_0"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q8_0"));
        assert!(report.contains("tensor.1.gguf_type=F32"));
        assert!(report.contains("tensor.1.conversion_action=copy-f32"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract Q8_0 GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q8_0 raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q8_1_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q8-1-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q8-1-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q8_1_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q8_1 GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build Q8_1 GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q8_1"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q8_1"));
        assert!(report.contains("tensor.1.gguf_type=F32"));
        assert!(report.contains("tensor.1.conversion_action=copy-f32"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract Q8_1 GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q8_1 raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn q8_k_source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-q8-k-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q8-k-source.gguf");
        let output_dir = dir.join("raw-source");
        write_q8_k_source_fixture_path(&input, "tinylm16").expect("write Q8_K GGUF source fixture");

        let plan = build_source_plan(&input, "tinylm16").expect("build Q8_K GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("conversion_status=decode-required"));
        assert!(report.contains("tensor.0.gguf_type=Q8_K"));
        assert!(report.contains("tensor.0.conversion_action=dequant-q8_k"));

        extract_source_path(&input, "tinylm16", &output_dir).expect("extract Q8_K GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate Q8_K raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_source_fixture_to_slm() {
        let dir = unique_dir("source-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-source-q8.slm");
        write_source_fixture_path(&input, "tiny-fixture").expect("write GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q8_0")
            .expect("convert GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q4_0_source_fixture_to_slm() {
        let dir = unique_dir("source-q4-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q4-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q4-source-q4.slm");
        write_q4_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q4_0 GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q4_0")
            .expect("convert Q4_0 GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q4_1_source_fixture_to_slm() {
        let dir = unique_dir("source-q4-1-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q4-1-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q4-1-source-q4.slm");
        write_q4_1_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q4_1 GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q4_0")
            .expect("convert Q4_1 GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q4_k_source_fixture_to_slm() {
        let dir = unique_dir("source-q4-k-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q4-k-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q4-k-source-q8.slm");
        write_q4_k_source_fixture_path(&input, "tinylm16").expect("write Q4_K GGUF source fixture");

        convert_source_path(&input, "tinylm16", &source_dir, &output_slm, "q8_0")
            .expect("convert Q4_K GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q5_0_source_fixture_to_slm() {
        let dir = unique_dir("source-q5-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q5-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q5-source-q8.slm");
        write_q5_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q5_0 GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q8_0")
            .expect("convert Q5_0 GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q5_1_source_fixture_to_slm() {
        let dir = unique_dir("source-q5-1-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q5-1-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q5-1-source-q8.slm");
        write_q5_1_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q5_1 GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q8_0")
            .expect("convert Q5_1 GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q2_k_source_fixture_to_slm() {
        let dir = unique_dir("source-q2-k-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q2-k-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q2-k-source-q8.slm");
        write_q2_k_source_fixture_path(&input, "tinylm16").expect("write Q2_K GGUF source fixture");

        convert_source_path(&input, "tinylm16", &source_dir, &output_slm, "q8_0")
            .expect("convert Q2_K GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q3_k_source_fixture_to_slm() {
        let dir = unique_dir("source-q3-k-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q3-k-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q3-k-source-q8.slm");
        write_q3_k_source_fixture_path(&input, "tinylm16").expect("write Q3_K GGUF source fixture");

        convert_source_path(&input, "tinylm16", &source_dir, &output_slm, "q8_0")
            .expect("convert Q3_K GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q5_k_source_fixture_to_slm() {
        let dir = unique_dir("source-q5-k-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q5-k-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q5-k-source-q8.slm");
        write_q5_k_source_fixture_path(&input, "tinylm16").expect("write Q5_K GGUF source fixture");

        convert_source_path(&input, "tinylm16", &source_dir, &output_slm, "q8_0")
            .expect("convert Q5_K GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q6_k_source_fixture_to_slm() {
        let dir = unique_dir("source-q6-k-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q6-k-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q6-k-source-q8.slm");
        write_q6_k_source_fixture_path(&input, "tinylm16").expect("write Q6_K GGUF source fixture");

        convert_source_path(&input, "tinylm16", &source_dir, &output_slm, "q8_0")
            .expect("convert Q6_K GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q8_0_source_fixture_to_slm() {
        let dir = unique_dir("source-q8-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q8-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q8-source-q8.slm");
        write_q8_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q8_0 GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q8_0")
            .expect("convert Q8_0 GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q8_1_source_fixture_to_slm() {
        let dir = unique_dir("source-q8-1-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q8-1-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q8-1-source-q8.slm");
        write_q8_1_source_fixture_path(&input, "tiny-fixture")
            .expect("write Q8_1 GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q8_0")
            .expect("convert Q8_1 GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_q8_k_source_fixture_to_slm() {
        let dir = unique_dir("source-q8-k-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-q8-k-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-q8-k-source-q8.slm");
        write_q8_k_source_fixture_path(&input, "tinylm16").expect("write Q8_K GGUF source fixture");

        convert_source_path(&input, "tinylm16", &source_dir, &output_slm, "q8_0")
            .expect("convert Q8_K GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_unsupported_tensor_for_source_extraction() {
        let path = unique_path("unsupported-source-type");
        let mut bytes = source_fixture_bytes("tiny-fixture").expect("build GGUF source fixture");
        let type_position = find_subsequence(&bytes, b"token_embd.weight")
            .expect("first tensor name")
            + "token_embd.weight".len()
            + 4
            + 8
            + 8;
        bytes[type_position..type_position + 4].copy_from_slice(&24u32.to_le_bytes());
        fs::write(&path, bytes).expect("write quantized GGUF fixture");

        let error = build_source_plan(&path, "tiny-fixture")
            .expect_err("unsupported source extraction should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains(&format!(
            "only supports {GGUF_SUPPORTED_SOURCE_TENSOR_TYPES}"
        )));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_overlapping_tensor_ranges() {
        let path = unique_path("overlap");
        let mut bytes = fixture_bytes().expect("build GGUF fixture");
        let offset_position = find_subsequence(&bytes, b"output.weight")
            .expect("output tensor name")
            + "output.weight".len()
            + 4
            + 8
            + 8
            + 4;
        bytes[offset_position..offset_position + 8].copy_from_slice(&0u64.to_le_bytes());
        fs::write(&path, bytes).expect("write overlapping GGUF fixture");

        let error = inspect_input(&path).expect_err("overlap should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("overlaps previous tensor"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unaligned_tensor_offset() {
        let path = unique_path("unaligned-offset");
        let mut bytes = fixture_bytes().expect("build GGUF fixture");
        let offset_position = find_subsequence(&bytes, b"output.weight")
            .expect("output tensor name")
            + "output.weight".len()
            + 4
            + 8
            + 8
            + 4;
        bytes[offset_position..offset_position + 8].copy_from_slice(&16u64.to_le_bytes());
        fs::write(&path, bytes).expect("write unaligned GGUF fixture");

        let error = inspect_input(&path).expect_err("unaligned offset should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("is not aligned"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unsupported_tensor_type() {
        let path = unique_path("unsupported-type");
        let mut bytes = fixture_bytes().expect("build GGUF fixture");
        let type_position = find_subsequence(&bytes, b"token_embd.weight")
            .expect("first tensor name")
            + "token_embd.weight".len()
            + 4
            + 8
            + 8;
        bytes[type_position..type_position + 4].copy_from_slice(&999u32.to_le_bytes());
        fs::write(&path, bytes).expect("write unsupported GGUF fixture");

        let error = inspect_input(&path).expect_err("unsupported type should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("unsupported GGUF tensor type id 999"));

        let _ = fs::remove_file(path);
    }

    fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
        haystack
            .windows(needle.len())
            .position(|window| window == needle)
    }
}
