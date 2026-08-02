//! Trained source-weight layout validation and conversion.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::provenance;
use crate::slm_validate;
use crate::tensor_writer::{
    tensors_for_shape, tensors_for_shape_with_qk_norm_and_tied_output,
    tensors_for_shape_with_qkv_bias_and_tied_output, tensors_for_shape_with_tied_output,
    ModelShape, TensorSpec, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q5_0, DTYPE_Q8_0,
};
use crate::tokenizer_writer::{BpeMergeSpec, BpeSpecialTokenSpec, BpeTokenSpec, TokenizerSection};
use crate::{build_model_file_from_values_with_flags, fixture_value};

const SOURCE_MANIFEST_NAME: &str = "source.manifest";
const SOURCE_VERSION: &str = "1";
const SOURCE_LAYOUT: &str = "raw-f32-tensor-files-v1";
pub(crate) const SOURCE_REVIEW_KIND: &str = "safetensors-candidate-review";
pub(crate) const SOURCE_REVIEW_STATUS: &str = "validated-before-extraction";
pub(crate) const SOURCE_REVIEW_REQUIRED_NEXT_GATE: &str = "extract-raw-f32-tensors";
pub(crate) const MIXED_Q8_EDGE_Q4_BODY_V1: &str = "mixed-q8-edge-q4-body-v1";
pub(crate) const MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1: &str = "mixed-q8-output-down-q4-body-v1";
pub(crate) const MIXED_Q8_MATRIX_F32_NORM_V1: &str = "mixed-q8-matrix-f32-norm-v1";
pub(crate) const MIXED_Q5_MATRIX_F32_NORM_V1: &str = "mixed-q5-matrix-f32-norm-v1";
const OUTPUT_QUANTIZATION_ERROR: &str = "converted output quantization must be f32, q8_0, q5_0, q4_0, mixed-q8-edge-q4-body-v1, mixed-q8-output-down-q4-body-v1, mixed-q8-matrix-f32-norm-v1, or mixed-q5-matrix-f32-norm-v1";
const MAX_ABS_SOURCE_MATRIX_WEIGHT: f32 = 64.0;
const MAX_ABS_SOURCE_NORM_WEIGHT: f32 = 256.0;
const MAX_ABS_SOURCE_PROJECTION_BIAS: f32 = 1024.0;
const FLAG_TIED_OUTPUT: u32 = 1;
const LLAMA_BPE_BOS: u32 = 1;
const LLAMA_BPE_EOS: u32 = 2;
const LLAMA_BPE_PAD: u32 = 2;
const LLAMA_BPE_UNK: u32 = 0;
const LLAMA_BPE_BYTE_TOKEN_BASE: u32 = 3;

struct SourceBundle {
    shape: ModelShape,
    tied_output: bool,
    tokenizer: TokenizerSection,
    tensors: Vec<TensorSpec>,
    values: Vec<Vec<f32>>,
}

#[derive(Clone, Copy)]
enum SourceTokenizerTemplate {
    Byte,
    TinyBpeDemo,
    ReviewedBpe,
    ReviewedGpt2Bpe,
}

struct SourceTemplate {
    shape: ModelShape,
    tied_output: bool,
    tokenizer: SourceTokenizerTemplate,
}

/// Reviewed source-shape contract shared with safetensors intake planning.
pub(crate) struct SourceShapeContract {
    /// Model dimensions expected by the raw source shape.
    pub shape: ModelShape,
    /// Whether the source shape omits `output.weight` and reuses embeddings.
    pub tied_output: bool,
    /// Stable tokenizer strategy label for review artifacts.
    pub tokenizer_strategy: &'static str,
    /// Whether conversion must receive a reviewed local tokenizer artifact.
    pub requires_tokenizer_artifact: bool,
    /// Source tokenizer BOS/EOS/PAD/UNK ids used by runtime generation.
    pub tokenizer_ids: SourceTokenizerIds,
}

/// Source tokenizer control-token ids preserved in the `.slm` tokenizer section.
#[derive(Clone, Copy)]
pub(crate) struct SourceTokenizerIds {
    pub bos: u32,
    pub eos: u32,
    pub pad: u32,
    pub unk: u32,
}

/// Ordered raw-source tensor expectation used by safetensors conversion planning.
pub(crate) struct SourceTensorExpectation {
    /// TinyRustLM tensor name expected by the raw-source manifest.
    pub name: String,
    /// Tensor dimensions in manifest order.
    pub dims: Vec<u64>,
    /// Safe relative output file path under the raw-source `tensors/` directory.
    pub relative_file: String,
    /// Byte count required by the raw f32 tensor payload.
    pub f32_bytes: u64,
}

/// Reviewed metadata attached to a raw-f32 trained export manifest.
pub(crate) struct SourceExportMetadata<'a> {
    /// Stable route or identifier for the reviewed source checkpoint.
    pub source_id: &'a str,
    /// License evidence or local review route attached to the source checkpoint.
    pub source_license: &'a str,
    /// Dataset or training corpus route attached to the source checkpoint.
    pub source_dataset: &'a str,
    /// Short training or extraction summary attached to the source checkpoint.
    pub source_training_summary: &'a str,
    /// Review artifact kind that authorized extraction, when available.
    pub source_review_kind: Option<&'a str>,
    /// Review validation status carried from the pre-extraction gate.
    pub source_review_status: Option<&'a str>,
    /// Checksum of the candidate-review artifact that authorized extraction.
    pub source_review_checksum: Option<&'a str>,
    /// Review-declared next gate that extraction consumes.
    pub source_review_required_next_gate: Option<&'a str>,
    /// Reviewed tokenizer rows to write instead of the shape template.
    pub source_tokenizer_override: Option<&'a SourceTokenizerOverride>,
}

/// Reviewed tokenizer manifest rows carried from a local source artifact.
pub(crate) struct SourceTokenizerOverride {
    /// Custom BPE token entries for ids outside byte fallback and specials.
    pub tokens: Vec<BpeTokenSpec>,
    /// Special token entries that should be encoded atomically.
    pub specials: Vec<BpeSpecialTokenSpec>,
    /// Ranked BPE merge rules that produce custom token ids.
    pub merges: Vec<BpeMergeSpec>,
}

/// Ordered f32 tensor payload ready to be written into a raw-source bundle.
pub(crate) struct SourceTensorPayload {
    /// TinyRustLM tensor name for this payload.
    pub name: String,
    /// Raw little-endian f32 bytes for the tensor.
    pub bytes: Vec<u8>,
}

/// Writes a reviewable raw-f32 trained-source fixture directory.
pub fn write_source_template_path(output_dir: &Path, shape_name: &str) -> io::Result<()> {
    let template = template_for_name(shape_name)?;
    let shape = template.shape;
    let tied_output = template.tied_output;
    let tensors = tensors_for_shape_and_output(&shape, DTYPE_F32, tied_output);
    let tensor_names = tensor_names_for_shape(&shape, tied_output);
    let tensor_dir = output_dir.join("tensors");
    fs::create_dir_all(&tensor_dir)?;

    let mut manifest = String::new();
    push_line(
        &mut manifest,
        "tinyrustlm_trained_source_version",
        SOURCE_VERSION,
    );
    push_line(&mut manifest, "model_family", "tinyrustlm");
    push_line(&mut manifest, "layout", SOURCE_LAYOUT);
    push_line(&mut manifest, "model_shape", shape_name);
    push_line(
        &mut manifest,
        "tied_output",
        if tied_output { "true" } else { "false" },
    );
    push_tokenizer_template_lines(&mut manifest, template.tokenizer)?;
    push_line(&mut manifest, "source_dtype", "f32");
    push_line(&mut manifest, "source_kind", "trained-source-fixture");
    push_line(
        &mut manifest,
        "source_id",
        "tinyrustlm-local-source-fixture",
    );
    push_line(&mut manifest, "source_license", "local-fixture-only");
    push_line(
        &mut manifest,
        "source_dataset",
        "tinyrustlm-local-conversion-fixture",
    );
    push_line(
        &mut manifest,
        "source_training_summary",
        "Deterministic source-weight fixture for conversion path validation",
    );
    push_shape_lines(&mut manifest, &shape);
    push_line(&mut manifest, "tensor_count", &tensors.len().to_string());

    for (index, tensor) in tensors.iter().enumerate() {
        let tensor_name = &tensor_names[index];
        let relative_file = format!("tensors/{}", tensor_file_name(tensor_name));
        let file_path = output_dir.join(&relative_file);
        let bytes = source_tensor_bytes(tensor)?;
        fs::write(&file_path, &bytes)?;

        let prefix = format!("tensor.{index}");
        push_line(&mut manifest, &format!("{prefix}.name"), tensor_name);
        push_line(
            &mut manifest,
            &format!("{prefix}.rank"),
            &tensor.rank.to_string(),
        );
        push_line(&mut manifest, &format!("{prefix}.dims"), &dims_text(tensor));
        push_line(&mut manifest, &format!("{prefix}.file"), &relative_file);
        push_line(
            &mut manifest,
            &format!("{prefix}.bytes"),
            &bytes.len().to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.checksum"),
            &format!("0x{:016x}", source_checksum(&bytes)),
        );
    }

    fs::write(output_dir.join(SOURCE_MANIFEST_NAME), manifest)?;
    println!("SLM source template written: {}", output_dir.display());
    Ok(())
}

/// Validates a raw-f32 trained-source directory and prints an admission report.
pub fn validate_source_path(source_dir: &Path) -> io::Result<()> {
    let bundle = read_source_bundle(source_dir)?;
    println!("SLM source validation: PASS");
    println!("source_dir: {}", source_dir.display());
    println!(
        "shape: vocab={} hidden={} layers={} heads={} kv_heads={} head_dim={} ffn={} context={}",
        bundle.shape.vocab_size,
        bundle.shape.hidden_size,
        bundle.shape.layer_count,
        bundle.shape.head_count,
        bundle.shape.kv_head_count,
        bundle.shape.head_dim,
        bundle.shape.ffn_size,
        bundle.shape.max_context
    );
    println!("tensor_count: {}", bundle.tensors.len());
    println!("source_dtype: f32");
    println!("tied_output: {}", bundle.tied_output);
    Ok(())
}

/// Converts a validated raw-f32 trained-source directory into an `.slm` artifact.
pub fn convert_trained_path(
    source_dir: &Path,
    output_slm: &Path,
    output_quantization: &str,
) -> io::Result<()> {
    let bundle = read_source_bundle(source_dir)?;
    let output_tensors =
        tensors_for_output_quantization(&bundle.shape, bundle.tied_output, output_quantization)?;
    let flags = if bundle.tied_output {
        FLAG_TIED_OUTPUT
    } else {
        0
    };
    let bytes = build_model_file_from_values_with_flags(
        &bundle.shape,
        &output_tensors,
        &bundle.tokenizer,
        &bundle.values,
        flags,
    )?;

    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, &bytes)?;
    let report = slm_validate::validate_bytes(&bytes, &output_slm.display().to_string())?;
    println!(
        "SLM converted trained source written: {}",
        output_slm.display()
    );
    println!("quantization: {}", report.quantization_label());
    println!("checksum: 0x{:016x}", report.checksum());

    let manifest = sidecar_manifest_path(output_slm);
    let quantization_profile = (validation_quantization_label(output_quantization)? == "mixed")
        .then_some(output_quantization);
    provenance::write_manifest_for_path_with_quantization_profile(
        output_slm,
        &manifest,
        "converted-trained",
        quantization_profile,
    )?;
    Ok(())
}

/// Confirms that a trained-source output quantization name maps to a supported `.slm` dtype.
pub(crate) fn validate_output_quantization(output_quantization: &str) -> io::Result<()> {
    match output_quantization {
        "f32"
        | "q8_0"
        | "q5_0"
        | "q4_0"
        | MIXED_Q8_EDGE_Q4_BODY_V1
        | MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1
        | MIXED_Q8_MATRIX_F32_NORM_V1
        | MIXED_Q5_MATRIX_F32_NORM_V1 => Ok(()),
        _ => Err(invalid(OUTPUT_QUANTIZATION_ERROR)),
    }
}

/// Returns the validator's coarse dtype label for a requested output profile.
pub(crate) fn validation_quantization_label(output_quantization: &str) -> io::Result<&'static str> {
    validate_output_quantization(output_quantization)?;
    if matches!(
        output_quantization,
        MIXED_Q8_EDGE_Q4_BODY_V1
            | MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1
            | MIXED_Q8_MATRIX_F32_NORM_V1
            | MIXED_Q5_MATRIX_F32_NORM_V1
    ) {
        Ok("mixed")
    } else {
        Ok(match output_quantization {
            "f32" => "f32",
            "q8_0" => "q8_0",
            "q5_0" => "q5_0",
            "q4_0" => "q4_0",
            _ => unreachable!("validated output quantization must be recognized"),
        })
    }
}

/// Returns ordered raw-source tensor expectations for a supported TinyRustLM source shape.
pub(crate) fn source_tensor_expectations(
    shape_name: &str,
) -> io::Result<Vec<SourceTensorExpectation>> {
    let template = template_for_name(shape_name)?;
    let tensors = tensors_for_shape_and_output(&template.shape, DTYPE_F32, template.tied_output);
    let tensor_names = tensor_names_for_shape(&template.shape, template.tied_output);
    let mut expectations = Vec::with_capacity(tensors.len());
    for (index, tensor) in tensors.iter().enumerate() {
        let name = tensor_names[index].clone();
        let dims = tensor
            .dims
            .iter()
            .take(tensor.rank as usize)
            .map(|dim| u64::from(*dim))
            .collect::<Vec<_>>();
        let f32_bytes = (tensor.element_count() as u64)
            .checked_mul(4)
            .ok_or_else(|| invalid("source tensor f32 byte length overflow"))?;
        expectations.push(SourceTensorExpectation {
            relative_file: format!("tensors/{}", tensor_file_name(&name)),
            name,
            dims,
            f32_bytes,
        });
    }
    Ok(expectations)
}

/// Returns shape, output-head, and tokenizer metadata for a supported source shape.
pub(crate) fn source_shape_contract(shape_name: &str) -> io::Result<SourceShapeContract> {
    let template = template_for_name(shape_name)?;
    let tokenizer_ids = tokenizer_ids_for_template(&template);
    let tokenizer_strategy = match template.tokenizer {
        SourceTokenizerTemplate::Byte => "byte-tokenizer-v1",
        SourceTokenizerTemplate::TinyBpeDemo => "manifest-bpe-v1",
        SourceTokenizerTemplate::ReviewedBpe => "llama-bpe-v1",
        SourceTokenizerTemplate::ReviewedGpt2Bpe => "gpt2-bpe-v1",
    };
    let requires_tokenizer_artifact = matches!(
        template.tokenizer,
        SourceTokenizerTemplate::ReviewedBpe | SourceTokenizerTemplate::ReviewedGpt2Bpe
    );
    Ok(SourceShapeContract {
        shape: template.shape,
        tied_output: template.tied_output,
        tokenizer_strategy,
        requires_tokenizer_artifact,
        tokenizer_ids,
    })
}

/// Writes a reviewed raw-f32 trained export directory from ordered tensor payloads.
pub(crate) fn write_source_export_path(
    output_dir: &Path,
    shape_name: &str,
    metadata: &SourceExportMetadata<'_>,
    payloads: &[SourceTensorPayload],
) -> io::Result<()> {
    validate_evidence_value("source_id", metadata.source_id)?;
    validate_evidence_value("source_license", metadata.source_license)?;
    validate_evidence_value("source_dataset", metadata.source_dataset)?;
    validate_evidence_value("source_training_summary", metadata.source_training_summary)?;
    validate_source_review_metadata(metadata)?;

    let template = template_for_name(shape_name)?;
    let shape = template.shape;
    let tied_output = template.tied_output;
    let tensors = tensors_for_shape_and_output(&shape, DTYPE_F32, tied_output);
    let tensor_names = tensor_names_for_shape(&shape, tied_output);
    if payloads.len() != tensors.len() {
        return Err(invalid(
            "source export payload count does not match target source shape",
        ));
    }

    let tensor_dir = output_dir.join("tensors");
    fs::create_dir_all(&tensor_dir)?;
    let mut manifest = String::new();
    push_line(
        &mut manifest,
        "tinyrustlm_trained_source_version",
        SOURCE_VERSION,
    );
    push_line(&mut manifest, "model_family", "tinyrustlm");
    push_line(&mut manifest, "layout", SOURCE_LAYOUT);
    push_line(&mut manifest, "model_shape", shape_name);
    push_line(
        &mut manifest,
        "tied_output",
        if tied_output { "true" } else { "false" },
    );
    push_source_tokenizer_lines(
        &mut manifest,
        template.tokenizer,
        metadata.source_tokenizer_override,
        &shape,
    )?;
    push_line(&mut manifest, "source_dtype", "f32");
    push_line(&mut manifest, "source_kind", "trained-export");
    push_line(&mut manifest, "source_id", metadata.source_id);
    push_line(&mut manifest, "source_license", metadata.source_license);
    push_line(&mut manifest, "source_dataset", metadata.source_dataset);
    push_line(
        &mut manifest,
        "source_training_summary",
        metadata.source_training_summary,
    );
    if let (Some(kind), Some(status), Some(checksum), Some(required_next_gate)) = (
        metadata.source_review_kind,
        metadata.source_review_status,
        metadata.source_review_checksum,
        metadata.source_review_required_next_gate,
    ) {
        push_line(&mut manifest, "source_review_kind", kind);
        push_line(&mut manifest, "source_review_status", status);
        push_line(&mut manifest, "source_review_checksum", checksum);
        push_line(
            &mut manifest,
            "source_review_required_next_gate",
            required_next_gate,
        );
    }
    push_shape_lines(&mut manifest, &shape);
    push_line(&mut manifest, "tensor_count", &tensors.len().to_string());

    for (index, tensor) in tensors.iter().enumerate() {
        let expected_name = &tensor_names[index];
        let payload = &payloads[index];
        if payload.name != *expected_name {
            return Err(invalid(&format!(
                "source export payload {index} was {}, expected {expected_name}",
                payload.name
            )));
        }
        validate_raw_f32_tensor_bytes(&payload.bytes, tensor, expected_name)?;
        let relative_file = format!("tensors/{}", tensor_file_name(expected_name));
        let file_path = output_dir.join(&relative_file);
        fs::write(&file_path, &payload.bytes)?;

        let prefix = format!("tensor.{index}");
        push_line(&mut manifest, &format!("{prefix}.name"), expected_name);
        push_line(
            &mut manifest,
            &format!("{prefix}.rank"),
            &tensor.rank.to_string(),
        );
        push_line(&mut manifest, &format!("{prefix}.dims"), &dims_text(tensor));
        push_line(&mut manifest, &format!("{prefix}.file"), &relative_file);
        push_line(
            &mut manifest,
            &format!("{prefix}.bytes"),
            &payload.bytes.len().to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.checksum"),
            &format!("0x{:016x}", source_checksum(&payload.bytes)),
        );
    }

    fs::write(output_dir.join(SOURCE_MANIFEST_NAME), manifest)?;
    Ok(())
}

fn read_source_bundle(source_dir: &Path) -> io::Result<SourceBundle> {
    let manifest_path = source_dir.join(SOURCE_MANIFEST_NAME);
    let manifest = fs::read_to_string(&manifest_path)?;
    let fields = parse_key_value_manifest(&manifest)?;
    validate_source_header(&fields)?;
    let shape = shape_from_fields(&fields)?;
    let tied_output = tied_output_from_fields(&fields)?;
    validate_shape_name_and_tied_output(&fields, &shape, tied_output)?;
    validate_shape_name_and_tokenizer(&fields)?;
    let tokenizer = tokenizer_from_fields(&fields, &shape)?;
    let expected_tensors = tensors_for_shape_and_output(&shape, DTYPE_F32, tied_output);
    let expected_names = tensor_names_for_shape(&shape, tied_output);
    require_equal(&fields, "tensor_count", &expected_tensors.len().to_string())?;

    let mut values = Vec::with_capacity(expected_tensors.len());
    for (index, expected) in expected_tensors.iter().enumerate() {
        let name = &expected_names[index];
        let prefix = format!("tensor.{index}");
        require_equal(&fields, &format!("{prefix}.name"), name)?;
        require_equal(
            &fields,
            &format!("{prefix}.rank"),
            &expected.rank.to_string(),
        )?;
        require_equal(&fields, &format!("{prefix}.dims"), &dims_text(expected))?;
        let relative_file = require_key(&fields, &format!("{prefix}.file"))?;
        let tensor_path = safe_tensor_path(source_dir, relative_file)?;
        let bytes = fs::read(&tensor_path)?;
        require_equal(
            &fields,
            &format!("{prefix}.bytes"),
            &bytes.len().to_string(),
        )?;
        require_equal(
            &fields,
            &format!("{prefix}.checksum"),
            &format!("0x{:016x}", source_checksum(&bytes)),
        )?;
        values.push(read_raw_f32_values(&bytes, expected, name)?);
    }

    Ok(SourceBundle {
        shape,
        tied_output,
        tokenizer,
        tensors: expected_tensors,
        values,
    })
}

fn validate_source_header(fields: &HashMap<String, String>) -> io::Result<()> {
    require_equal(fields, "tinyrustlm_trained_source_version", SOURCE_VERSION)?;
    require_equal(fields, "model_family", "tinyrustlm")?;
    require_equal(fields, "layout", SOURCE_LAYOUT)?;
    match require_key(fields, "tokenizer")? {
        "byte-v1" | "bpe-v1" | "llama-bpe-v1" | "gpt2-bpe-v1" => {}
        _ => {
            return Err(invalid(
                "source tokenizer must be byte-v1, bpe-v1, llama-bpe-v1, or gpt2-bpe-v1",
            ));
        }
    }
    require_equal(fields, "source_dtype", "f32")?;
    match require_key(fields, "source_kind")? {
        "trained-source-fixture" | "trained-export" => {}
        _ => {
            return Err(invalid(
                "source_kind must be trained-source-fixture or trained-export",
            ));
        }
    }
    require_evidence_field(fields, "source_id")?;
    require_evidence_field(fields, "source_license")?;
    require_evidence_field(fields, "source_dataset")?;
    require_evidence_field(fields, "source_training_summary")?;
    validate_source_review_fields(fields)?;
    Ok(())
}

fn template_for_name(shape_name: &str) -> io::Result<SourceTemplate> {
    match shape_name {
        "tiny-fixture" => Ok(SourceTemplate {
            shape: ModelShape::tiny_fixture(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tiny-fixture-tied" => Ok(SourceTemplate {
            shape: ModelShape::tiny_fixture(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tiny-fixture-bpe" => Ok(SourceTemplate {
            shape: tiny_bpe_fixture_shape(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::TinyBpeDemo,
        }),
        "tinylm16" => Ok(SourceTemplate {
            shape: ModelShape::tinylm16(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tinylm16-tied" => Ok(SourceTemplate {
            shape: ModelShape::tinylm16(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tinylm16-bpe" => Ok(SourceTemplate {
            shape: tinylm16_bpe_shape(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::TinyBpeDemo,
        }),
        "stories15m-bpe" => Ok(SourceTemplate {
            shape: ModelShape::stories15m(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::ReviewedBpe,
        }),
        "smollm2-135m-instruct-bpe" => Ok(SourceTemplate {
            shape: ModelShape::smollm2_135m_instruct(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::ReviewedGpt2Bpe,
        }),
        "smollm2-360m-instruct-bpe" => Ok(SourceTemplate {
            shape: ModelShape::smollm2_360m_instruct(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::ReviewedGpt2Bpe,
        }),
        "qwen3-0.6b-bpe" => Ok(SourceTemplate {
            shape: ModelShape::qwen3_0_6b(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::ReviewedGpt2Bpe,
        }),
        "qwen2.5-1.5b-bpe" => Ok(SourceTemplate {
            shape: ModelShape::qwen2_5_1_5b(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::ReviewedGpt2Bpe,
        }),
        _ => Err(invalid(
            "source-template shape must be tiny-fixture, tiny-fixture-tied, tiny-fixture-bpe, tinylm16, tinylm16-tied, tinylm16-bpe, stories15m-bpe, smollm2-135m-instruct-bpe, smollm2-360m-instruct-bpe, qwen3-0.6b-bpe, or qwen2.5-1.5b-bpe",
        )),
    }
}

fn tiny_bpe_fixture_shape() -> ModelShape {
    ModelShape {
        vocab_size: 262,
        ..ModelShape::tiny_fixture()
    }
}

// Keeps the TinyLM-16M tensor layout while selecting the manifest-native BPE path.
fn tinylm16_bpe_shape() -> ModelShape {
    ModelShape {
        vocab_size: 262,
        ..ModelShape::tinylm16()
    }
}

fn shape_from_fields(fields: &HashMap<String, String>) -> io::Result<ModelShape> {
    let shape_name = require_key(fields, "model_shape")?;
    let template = template_for_name(shape_name)?;
    let shape = ModelShape {
        vocab_size: parse_u32_key(fields, "vocab_size")?,
        special_token_count: parse_u32_key(fields, "special_token_count")?,
        hidden_size: parse_u32_key(fields, "hidden_size")?,
        layer_count: parse_u32_key(fields, "layer_count")?,
        head_count: parse_u32_key(fields, "head_count")?,
        kv_head_count: parse_u32_key(fields, "kv_head_count")?,
        head_dim: parse_u32_key(fields, "head_dim")?,
        ffn_size: parse_u32_key(fields, "ffn_size")?,
        max_context: parse_u32_key(fields, "max_context")?,
        rope_theta: parse_positive_f32_key_or(fields, "rope_theta", template.shape.rope_theta)?,
        rms_norm_epsilon: parse_positive_f32_key_or(
            fields,
            "rms_norm_epsilon",
            template.shape.rms_norm_epsilon,
        )?,
    };
    if shape.vocab_size < 260 || shape.special_token_count < 4 {
        return Err(invalid(
            "source shape must support the phase-one byte tokenizer",
        ));
    }
    if shape.hidden_size == 0
        || shape.layer_count == 0
        || shape.head_count == 0
        || shape.kv_head_count == 0
        || shape.head_dim == 0
        || shape.ffn_size == 0
        || shape.max_context == 0
    {
        return Err(invalid("source shape dimensions must be nonzero"));
    }
    shape
        .head_count
        .checked_mul(shape.head_dim)
        .ok_or_else(|| invalid("source query width overflow"))?;
    if shape.kv_head_count > shape.head_count
        || !shape.head_count.is_multiple_of(shape.kv_head_count)
    {
        return Err(invalid("source kv_head_count must divide head_count"));
    }
    if matches!(shape_name, "tiny-fixture" | "tiny-fixture-tied")
        && !shape_matches(&shape, &ModelShape::tiny_fixture())
    {
        return Err(invalid(
            "model_shape=tiny-fixture does not match dimensions",
        ));
    }
    if shape_name == "tiny-fixture-bpe" && !shape_matches(&shape, &tiny_bpe_fixture_shape()) {
        return Err(invalid(
            "model_shape=tiny-fixture-bpe does not match dimensions",
        ));
    }
    if matches!(shape_name, "tinylm16" | "tinylm16-tied")
        && !shape_matches(&shape, &ModelShape::tinylm16())
    {
        return Err(invalid("model_shape=tinylm16 does not match dimensions"));
    }
    if shape_name == "tinylm16-bpe" && !shape_matches_except_vocab(&shape, &ModelShape::tinylm16())
    {
        return Err(invalid(
            "model_shape=tinylm16-bpe must match TinyLM-16M dimensions except vocab_size",
        ));
    }
    if shape_name == "stories15m-bpe" && !shape_matches(&shape, &ModelShape::stories15m()) {
        return Err(invalid(
            "model_shape=stories15m-bpe does not match Stories-15M dimensions",
        ));
    }
    if shape_name == "smollm2-135m-instruct-bpe"
        && !shape_matches(&shape, &ModelShape::smollm2_135m_instruct())
    {
        return Err(invalid(
            "model_shape=smollm2-135m-instruct-bpe does not match SmolLM2-135M-Instruct dimensions",
        ));
    }
    if shape_name == "smollm2-360m-instruct-bpe"
        && !shape_matches(&shape, &ModelShape::smollm2_360m_instruct())
    {
        return Err(invalid(
            "model_shape=smollm2-360m-instruct-bpe does not match SmolLM2-360M-Instruct dimensions",
        ));
    }
    if shape_name == "qwen3-0.6b-bpe" && !shape_matches(&shape, &ModelShape::qwen3_0_6b()) {
        return Err(invalid(
            "model_shape=qwen3-0.6b-bpe does not match Qwen3-0.6B dimensions",
        ));
    }
    if shape_name == "qwen2.5-1.5b-bpe" && !shape_matches(&shape, &ModelShape::qwen2_5_1_5b()) {
        return Err(invalid(
            "model_shape=qwen2.5-1.5b-bpe does not match Qwen2.5-1.5B dimensions",
        ));
    }
    if !matches!(
        shape_name,
        "tiny-fixture"
            | "tiny-fixture-tied"
            | "tiny-fixture-bpe"
            | "tinylm16"
            | "tinylm16-tied"
            | "tinylm16-bpe"
            | "stories15m-bpe"
            | "smollm2-135m-instruct-bpe"
            | "smollm2-360m-instruct-bpe"
            | "qwen3-0.6b-bpe"
            | "qwen2.5-1.5b-bpe"
    ) {
        return Err(invalid(
            "model_shape must be tiny-fixture, tiny-fixture-tied, tiny-fixture-bpe, tinylm16, tinylm16-tied, tinylm16-bpe, stories15m-bpe, smollm2-135m-instruct-bpe, smollm2-360m-instruct-bpe, qwen3-0.6b-bpe, or qwen2.5-1.5b-bpe",
        ));
    }
    Ok(shape)
}

fn tied_output_from_fields(fields: &HashMap<String, String>) -> io::Result<bool> {
    match fields.get("tied_output").map(String::as_str) {
        Some("true") => Ok(true),
        Some("false") | None => Ok(false),
        Some(_) => Err(invalid(
            "source manifest key tied_output must be true or false",
        )),
    }
}

fn validate_shape_name_and_tied_output(
    fields: &HashMap<String, String>,
    _shape: &ModelShape,
    tied_output: bool,
) -> io::Result<()> {
    let shape_name = require_key(fields, "model_shape")?;
    let shape_name_is_tied = matches!(
        shape_name,
        "tiny-fixture-tied"
            | "tinylm16-tied"
            | "stories15m-bpe"
            | "smollm2-135m-instruct-bpe"
            | "smollm2-360m-instruct-bpe"
            | "qwen3-0.6b-bpe"
            | "qwen2.5-1.5b-bpe"
    );
    if shape_name_is_tied != tied_output {
        return Err(invalid(
            "source manifest model_shape and tied_output must agree",
        ));
    }
    Ok(())
}

fn validate_shape_name_and_tokenizer(fields: &HashMap<String, String>) -> io::Result<()> {
    let shape_name = require_key(fields, "model_shape")?;
    let tokenizer = require_key(fields, "tokenizer")?;
    let expected = match shape_name {
        "tiny-fixture-bpe" | "tinylm16-bpe" => "bpe-v1",
        "stories15m-bpe" => "llama-bpe-v1",
        "smollm2-135m-instruct-bpe"
        | "smollm2-360m-instruct-bpe"
        | "qwen3-0.6b-bpe"
        | "qwen2.5-1.5b-bpe" => "gpt2-bpe-v1",
        _ => "byte-v1",
    };
    if tokenizer != expected {
        return Err(invalid(
            "source manifest model_shape and tokenizer must agree",
        ));
    }
    Ok(())
}

fn tokenizer_from_fields(
    fields: &HashMap<String, String>,
    shape: &ModelShape,
) -> io::Result<TokenizerSection> {
    match require_key(fields, "tokenizer")? {
        "byte-v1" => Ok(TokenizerSection::phase_one()),
        "bpe-v1" => bpe_tokenizer_from_fields(fields, shape.vocab_size),
        "llama-bpe-v1" => llama_bpe_tokenizer_from_fields(fields, shape.vocab_size),
        "gpt2-bpe-v1" => gpt2_bpe_tokenizer_from_fields(fields, shape),
        _ => Err(invalid(
            "source tokenizer must be byte-v1, bpe-v1, llama-bpe-v1, or gpt2-bpe-v1",
        )),
    }
}

fn bpe_tokenizer_from_fields(
    fields: &HashMap<String, String>,
    vocab_size: u32,
) -> io::Result<TokenizerSection> {
    let (tokens, merges) = bpe_parts_from_fields(fields)?;
    validate_bpe_parts(vocab_size, &tokens, &merges)?;
    Ok(TokenizerSection::bpe_from_parts(
        vocab_size, &tokens, &merges,
    ))
}

fn llama_bpe_tokenizer_from_fields(
    fields: &HashMap<String, String>,
    vocab_size: u32,
) -> io::Result<TokenizerSection> {
    let (tokens, merges) = bpe_parts_from_fields(fields)?;
    validate_llama_bpe_parts(vocab_size, &tokens, &merges)?;
    Ok(TokenizerSection::llama_bpe_from_parts(
        vocab_size,
        LLAMA_BPE_BOS,
        LLAMA_BPE_EOS,
        LLAMA_BPE_PAD,
        LLAMA_BPE_UNK,
        LLAMA_BPE_BYTE_TOKEN_BASE,
        &tokens,
        &merges,
    ))
}

fn gpt2_bpe_tokenizer_from_fields(
    fields: &HashMap<String, String>,
    shape: &ModelShape,
) -> io::Result<TokenizerSection> {
    let vocab_size = shape.vocab_size;
    let (tokens, specials, merges) = gpt2_bpe_parts_from_fields(fields)?;
    validate_gpt2_bpe_parts(vocab_size, &tokens, &specials, &merges)?;
    let ids = gpt2_tokenizer_ids_for_shape(shape);
    Ok(TokenizerSection::gpt2_bpe_from_parts(
        vocab_size, ids.bos, ids.eos, ids.pad, ids.unk, &tokens, &specials, &merges,
    ))
}

fn tokenizer_ids_for_template(template: &SourceTemplate) -> SourceTokenizerIds {
    match template.tokenizer {
        SourceTokenizerTemplate::Byte | SourceTokenizerTemplate::TinyBpeDemo => {
            SourceTokenizerIds {
                bos: 256,
                eos: 257,
                pad: 258,
                unk: 259,
            }
        }
        SourceTokenizerTemplate::ReviewedBpe => SourceTokenizerIds {
            bos: LLAMA_BPE_BOS,
            eos: LLAMA_BPE_EOS,
            pad: LLAMA_BPE_PAD,
            unk: LLAMA_BPE_UNK,
        },
        SourceTokenizerTemplate::ReviewedGpt2Bpe => gpt2_tokenizer_ids_for_shape(&template.shape),
    }
}

fn gpt2_tokenizer_ids_for_shape(shape: &ModelShape) -> SourceTokenizerIds {
    if shape_matches(shape, &ModelShape::qwen3_0_6b())
        || shape_matches(shape, &ModelShape::qwen2_5_1_5b())
    {
        SourceTokenizerIds {
            bos: 151643,
            eos: 151645,
            pad: 151643,
            unk: 151643,
        }
    } else {
        SourceTokenizerIds {
            bos: 1,
            eos: 2,
            pad: 2,
            unk: 0,
        }
    }
}

fn bpe_parts_from_fields(
    fields: &HashMap<String, String>,
) -> io::Result<(Vec<BpeTokenSpec>, Vec<BpeMergeSpec>)> {
    let token_count = parse_usize_key(fields, "bpe_token_count")?;
    let merge_count = parse_usize_key(fields, "bpe_merge_count")?;
    if token_count == 0 || merge_count == 0 {
        return Err(invalid(
            "BPE source tokenizer requires at least one token and one merge",
        ));
    }
    let mut tokens = Vec::with_capacity(token_count);
    for index in 0..token_count {
        let prefix = format!("bpe.token.{index}");
        let id = parse_u32_key(fields, &format!("{prefix}.id"))?;
        let bytes = parse_hex_bytes(require_key(fields, &format!("{prefix}.bytes_hex"))?)?;
        tokens.push(BpeTokenSpec { id, bytes });
    }

    let mut merges = Vec::with_capacity(merge_count);
    for index in 0..merge_count {
        let prefix = format!("bpe.merge.{index}");
        let left = parse_u32_key(fields, &format!("{prefix}.left"))?;
        let right = parse_u32_key(fields, &format!("{prefix}.right"))?;
        let output = parse_u32_key(fields, &format!("{prefix}.output"))?;
        let rank = parse_u32_key(fields, &format!("{prefix}.rank"))?;
        merges.push(BpeMergeSpec {
            left,
            right,
            output,
            rank,
        });
    }
    reject_extra_bpe_keys(fields, token_count, merge_count)?;
    Ok((tokens, merges))
}

fn gpt2_bpe_parts_from_fields(
    fields: &HashMap<String, String>,
) -> io::Result<(
    Vec<BpeTokenSpec>,
    Vec<BpeSpecialTokenSpec>,
    Vec<BpeMergeSpec>,
)> {
    let token_count = parse_usize_key(fields, "bpe_token_count")?;
    let special_count = parse_usize_key(fields, "bpe_special_count")?;
    let merge_count = parse_usize_key(fields, "bpe_merge_count")?;
    if token_count == 0 || special_count == 0 || merge_count == 0 {
        return Err(invalid(
            "GPT2 BPE source tokenizer requires tokens, specials, and merges",
        ));
    }
    let mut tokens = Vec::with_capacity(token_count);
    for index in 0..token_count {
        let prefix = format!("bpe.token.{index}");
        let id = parse_u32_key(fields, &format!("{prefix}.id"))?;
        let bytes = parse_hex_bytes(require_key(fields, &format!("{prefix}.bytes_hex"))?)?;
        tokens.push(BpeTokenSpec { id, bytes });
    }
    let mut specials = Vec::with_capacity(special_count);
    for index in 0..special_count {
        let prefix = format!("bpe.special.{index}");
        let id = parse_u32_key(fields, &format!("{prefix}.id"))?;
        let bytes = parse_hex_bytes(require_key(fields, &format!("{prefix}.bytes_hex"))?)?;
        specials.push(BpeSpecialTokenSpec { id, bytes });
    }

    let mut merges = Vec::with_capacity(merge_count);
    for index in 0..merge_count {
        let prefix = format!("bpe.merge.{index}");
        let left = parse_u32_key(fields, &format!("{prefix}.left"))?;
        let right = parse_u32_key(fields, &format!("{prefix}.right"))?;
        let output = parse_u32_key(fields, &format!("{prefix}.output"))?;
        let rank = parse_u32_key(fields, &format!("{prefix}.rank"))?;
        merges.push(BpeMergeSpec {
            left,
            right,
            output,
            rank,
        });
    }
    reject_extra_gpt2_bpe_keys(fields, token_count, special_count, merge_count)?;
    Ok((tokens, specials, merges))
}

/// Validates reusable BPE parts before they are written or converted.
fn validate_bpe_parts(
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    if tokens.is_empty() || merges.is_empty() {
        return Err(invalid(
            "BPE source tokenizer requires at least one token and one merge",
        ));
    }
    let mut token_ids = HashSet::with_capacity(tokens.len());
    for token in tokens {
        if token.id < 260 || token.id >= vocab_size || token.bytes.is_empty() {
            return Err(invalid(
                "BPE token entry is outside the declared vocabulary",
            ));
        }
        if !token_ids.insert(token.id) {
            return Err(invalid("BPE token ids must be unique"));
        }
    }
    let mut merge_ranks = HashSet::with_capacity(merges.len());
    for merge in merges {
        if merge.left >= vocab_size
            || merge.right >= vocab_size
            || merge.output >= vocab_size
            || merge.output < 260
        {
            return Err(invalid("BPE merge ids must stay inside vocabulary"));
        }
        if !token_ids.contains(&merge.output) {
            return Err(invalid("BPE merge output must reference a declared token"));
        }
        if !merge_ranks.insert(merge.rank) {
            return Err(invalid("BPE merge ranks must be unique"));
        }
    }
    Ok(())
}

/// Validates Llama-style BPE rows that preserve source tokenizer ids.
fn validate_llama_bpe_parts(
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    if tokens.is_empty() || merges.is_empty() {
        return Err(invalid(
            "Llama BPE source tokenizer requires at least one token and one merge",
        ));
    }
    let byte_token_end = LLAMA_BPE_BYTE_TOKEN_BASE
        .checked_add(255)
        .ok_or_else(|| invalid("Llama BPE byte fallback range overflows"))?;
    if vocab_size <= byte_token_end {
        return Err(invalid(
            "Llama BPE vocabulary is too small for byte fallback",
        ));
    }
    let mut token_ids = HashSet::with_capacity(tokens.len());
    for token in tokens {
        if token.id >= vocab_size
            || token.bytes.is_empty()
            || llama_bpe_is_special(token.id)
            || llama_bpe_is_byte_fallback(token.id)
        {
            return Err(invalid(
                "Llama BPE token entry is outside the declared vocabulary",
            ));
        }
        if !token_ids.insert(token.id) {
            return Err(invalid("Llama BPE token ids must be unique"));
        }
    }
    let mut merge_ranks = HashSet::with_capacity(merges.len());
    for merge in merges {
        if merge.left >= vocab_size
            || merge.right >= vocab_size
            || merge.output >= vocab_size
            || llama_bpe_is_special(merge.output)
            || llama_bpe_is_byte_fallback(merge.output)
        {
            return Err(invalid("Llama BPE merge ids must stay inside vocabulary"));
        }
        if !token_ids.contains(&merge.output) {
            return Err(invalid(
                "Llama BPE merge output must reference a declared token",
            ));
        }
        if !merge_ranks.insert(merge.rank) {
            return Err(invalid("Llama BPE merge ranks must be unique"));
        }
    }
    Ok(())
}

/// Validates GPT2/ByteLevel BPE rows that preserve source tokenizer ids.
fn validate_gpt2_bpe_parts(
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    specials: &[BpeSpecialTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    if tokens.is_empty() || specials.is_empty() || merges.is_empty() {
        return Err(invalid(
            "GPT2 BPE source tokenizer requires tokens, specials, and merges",
        ));
    }
    let special_ids = specials
        .iter()
        .map(|special| special.id)
        .collect::<HashSet<_>>();
    let mut token_ids = HashSet::with_capacity(tokens.len());
    let mut token_bytes = HashSet::with_capacity(tokens.len());
    for token in tokens {
        if token.id >= vocab_size || token.bytes.is_empty() || special_ids.contains(&token.id) {
            return Err(invalid(
                "GPT2 BPE token entry is outside the declared vocabulary",
            ));
        }
        if !token_ids.insert(token.id) {
            return Err(invalid("GPT2 BPE token ids must be unique"));
        }
        if !token_bytes.insert(token.bytes.as_slice()) {
            return Err(invalid("GPT2 BPE token bytes must be unique"));
        }
    }
    for byte in 0u8..=255 {
        if gpt2_bpe_required_prompt_byte(byte) && !token_bytes.contains(&[byte][..]) {
            return Err(invalid(
                "GPT2 BPE tokenizer is missing required prompt byte tokens",
            ));
        }
    }
    let mut seen_special_ids = HashSet::with_capacity(specials.len());
    let mut seen_special_bytes = HashSet::with_capacity(specials.len());
    for special in specials {
        if special.id >= vocab_size || special.bytes.is_empty() {
            return Err(invalid(
                "GPT2 BPE special entry is outside the declared vocabulary",
            ));
        }
        if !seen_special_ids.insert(special.id) {
            return Err(invalid("GPT2 BPE special ids must be unique"));
        }
        if !seen_special_bytes.insert(special.bytes.as_slice()) {
            return Err(invalid("GPT2 BPE special bytes must be unique"));
        }
        if token_bytes.contains(special.bytes.as_slice()) {
            return Err(invalid("GPT2 BPE specials must not duplicate token rows"));
        }
    }
    let mut merge_ranks = HashSet::with_capacity(merges.len());
    for merge in merges {
        if merge.left >= vocab_size
            || merge.right >= vocab_size
            || merge.output >= vocab_size
            || special_ids.contains(&merge.left)
            || special_ids.contains(&merge.right)
            || special_ids.contains(&merge.output)
        {
            return Err(invalid("GPT2 BPE merge ids must stay inside vocabulary"));
        }
        if !token_ids.contains(&merge.left) || !token_ids.contains(&merge.right) {
            return Err(invalid(
                "GPT2 BPE merge inputs must reference declared tokens",
            ));
        }
        if !token_ids.contains(&merge.output) {
            return Err(invalid(
                "GPT2 BPE merge output must reference a declared token",
            ));
        }
        if !merge_ranks.insert(merge.rank) {
            return Err(invalid("GPT2 BPE merge ranks must be unique"));
        }
    }
    Ok(())
}

fn llama_bpe_is_special(token: u32) -> bool {
    matches!(token, LLAMA_BPE_UNK | LLAMA_BPE_BOS | LLAMA_BPE_EOS)
}

fn llama_bpe_is_byte_fallback(token: u32) -> bool {
    token >= LLAMA_BPE_BYTE_TOKEN_BASE && token < LLAMA_BPE_BYTE_TOKEN_BASE.saturating_add(256)
}

fn gpt2_bpe_required_prompt_byte(byte: u8) -> bool {
    matches!(byte, b'\t' | b'\n' | b'\r' | 0x20..=0x7e)
}

fn tensors_for_shape_and_output(
    shape: &ModelShape,
    dtype: u32,
    tied_output: bool,
) -> Vec<TensorSpec> {
    if tied_output && shape_uses_qk_norm(shape) {
        tensors_for_shape_with_qk_norm_and_tied_output(shape, dtype)
    } else if tied_output && shape_uses_qkv_bias(shape) {
        tensors_for_shape_with_qkv_bias_and_tied_output(shape, dtype)
    } else if tied_output {
        tensors_for_shape_with_tied_output(shape, dtype)
    } else {
        tensors_for_shape(shape, dtype)
    }
}

/// Selects deterministic tensor dtypes for a uniform output or a versioned mixed profile.
pub(crate) fn tensors_for_output_quantization(
    shape: &ModelShape,
    tied_output: bool,
    output_quantization: &str,
) -> io::Result<Vec<TensorSpec>> {
    let uniform_dtype = match output_quantization {
        "f32" => Some(DTYPE_F32),
        "q8_0" => Some(DTYPE_Q8_0),
        "q5_0" => Some(DTYPE_Q5_0),
        "q4_0" => Some(DTYPE_Q4_0),
        MIXED_Q8_EDGE_Q4_BODY_V1
        | MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1
        | MIXED_Q8_MATRIX_F32_NORM_V1
        | MIXED_Q5_MATRIX_F32_NORM_V1 => None,
        _ => return Err(invalid(OUTPUT_QUANTIZATION_ERROR)),
    };
    if let Some(dtype) = uniform_dtype {
        return Ok(tensors_for_shape_and_output(shape, dtype, tied_output));
    }
    if shape.layer_count < 3
        && matches!(
            output_quantization,
            MIXED_Q8_EDGE_Q4_BODY_V1 | MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1
        )
    {
        return Err(invalid(
            "mixed-q8-edge-q4-body-v1 requires at least three transformer layers",
        ));
    }

    let source_specs = tensors_for_shape_and_output(shape, DTYPE_F32, tied_output);
    let names = tensor_names_for_shape(shape, tied_output);
    if names.len() != source_specs.len() {
        return Err(invalid(
            "mixed quantization profile tensor-name and tensor-spec counts differ",
        ));
    }
    names
        .iter()
        .zip(source_specs.iter())
        .map(|(name, spec)| {
            let dtype = mixed_profile_dtype(output_quantization, name, shape.layer_count)?;
            tensor_spec_with_dtype(name, spec, dtype)
        })
        .collect()
}

fn mixed_profile_dtype(profile: &str, name: &str, layer_count: u32) -> io::Result<u32> {
    match name {
        "tok_embeddings.weight" | "output.weight" => {
            return Ok(if profile == MIXED_Q5_MATRIX_F32_NORM_V1 {
                DTYPE_Q5_0
            } else {
                DTYPE_Q8_0
            });
        }
        "norm.weight" => return Ok(DTYPE_F32),
        _ => {}
    }
    let layer_suffix = name
        .strip_prefix("layers.")
        .ok_or_else(|| invalid("mixed quantization profile encountered an unknown tensor name"))?;
    let (layer_text, suffix) = layer_suffix
        .split_once('.')
        .ok_or_else(|| invalid("mixed quantization profile layer tensor name is malformed"))?;
    let layer = layer_text
        .parse::<u32>()
        .map_err(|_| invalid("mixed quantization profile layer index is invalid"))?;
    if layer >= layer_count {
        return Err(invalid(
            "mixed quantization profile layer index exceeds model shape",
        ));
    }
    if matches!(
        suffix,
        "attention_norm.weight"
            | "ffn_norm.weight"
            | "q_norm.weight"
            | "k_norm.weight"
            | "wq.bias"
            | "wk.bias"
            | "wv.bias"
    ) {
        return Ok(DTYPE_F32);
    }
    if !matches!(
        suffix,
        "wq.weight"
            | "wk.weight"
            | "wv.weight"
            | "wo.weight"
            | "w1.weight"
            | "w2.weight"
            | "w3.weight"
    ) {
        return Err(invalid(
            "mixed quantization profile encountered an unsupported layer tensor",
        ));
    }
    if layer == 0 || layer + 1 == layer_count {
        return Ok(if profile == MIXED_Q5_MATRIX_F32_NORM_V1 {
            DTYPE_Q5_0
        } else {
            DTYPE_Q8_0
        });
    }
    match profile {
        MIXED_Q8_EDGE_Q4_BODY_V1 => Ok(DTYPE_Q4_0),
        MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1 => {
            if matches!(suffix, "wo.weight" | "w2.weight") {
                Ok(DTYPE_Q8_0)
            } else {
                Ok(DTYPE_Q4_0)
            }
        }
        MIXED_Q8_MATRIX_F32_NORM_V1 => Ok(DTYPE_Q8_0),
        MIXED_Q5_MATRIX_F32_NORM_V1 => Ok(DTYPE_Q5_0),
        _ => Err(invalid(OUTPUT_QUANTIZATION_ERROR)),
    }
}

fn tensor_spec_with_dtype(name: &str, source: &TensorSpec, dtype: u32) -> io::Result<TensorSpec> {
    let rank = source.rank as usize;
    let dims = source
        .dims
        .get(..rank)
        .ok_or_else(|| invalid("mixed quantization profile tensor rank exceeds dimensions"))?;
    match dtype {
        DTYPE_F32 => Ok(TensorSpec::f32(name, dims, source.seed)),
        DTYPE_Q8_0 => Ok(TensorSpec::q8(name, dims, source.seed)),
        DTYPE_Q4_0 => Ok(TensorSpec::q4(name, dims, source.seed)),
        DTYPE_Q5_0 => Ok(TensorSpec::q5(name, dims, source.seed)),
        _ => Err(invalid(
            "mixed quantization profile selected an unsupported tensor dtype",
        )),
    }
}

fn read_raw_f32_values(
    bytes: &[u8],
    tensor: &TensorSpec,
    tensor_name: &str,
) -> io::Result<Vec<f32>> {
    validate_raw_f32_tensor_bytes(bytes, tensor, tensor_name)?;
    let mut values = Vec::with_capacity(tensor.element_count());
    for chunk in bytes.chunks_exact(4) {
        values.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    Ok(values)
}

fn validate_raw_f32_tensor_bytes(
    bytes: &[u8],
    tensor: &TensorSpec,
    tensor_name: &str,
) -> io::Result<()> {
    let expected_bytes = tensor.element_count().checked_mul(4).ok_or_else(|| {
        invalid("source tensor byte length overflow while validating f32 payload")
    })?;
    if bytes.len() != expected_bytes {
        return Err(invalid("source tensor byte length does not match shape"));
    }

    let absolute_limit = if tensor_name.ends_with(".bias") {
        MAX_ABS_SOURCE_PROJECTION_BIAS
    } else if tensor.rank == 1 {
        MAX_ABS_SOURCE_NORM_WEIGHT
    } else {
        MAX_ABS_SOURCE_MATRIX_WEIGHT
    };
    let mut any_nonzero = false;
    for chunk in bytes.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() {
            return Err(invalid("source tensor contains a non-finite f32 value"));
        }
        if value.abs() > absolute_limit {
            return Err(invalid(&format!(
                "source tensor 0x{:016x} contains f32 value {} above absolute limit {}",
                tensor.name_hash, value, absolute_limit
            )));
        }
        any_nonzero |= value != 0.0;
    }
    if !any_nonzero {
        return Err(invalid("source tensor must not be entirely zero"));
    }
    Ok(())
}

fn source_tensor_bytes(tensor: &TensorSpec) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::with_capacity(tensor.element_count() * 4);
    for elem in 0..tensor.element_count() {
        bytes.extend_from_slice(&fixture_value(tensor, elem).to_le_bytes());
    }
    Ok(bytes)
}

fn safe_tensor_path(source_dir: &Path, relative_file: &str) -> io::Result<PathBuf> {
    let path = Path::new(relative_file);
    if path.is_absolute() {
        return Err(invalid("source tensor file path must be relative"));
    }
    let mut components = path.components();
    match components.next() {
        Some(Component::Normal(first)) if first == "tensors" => {}
        _ => return Err(invalid("source tensor files must live under tensors/")),
    }
    for component in components {
        match component {
            Component::Normal(_) => {}
            _ => return Err(invalid("source tensor file path is not safe")),
        }
    }
    Ok(source_dir.join(path))
}

fn tensor_names_for_shape(shape: &ModelShape, tied_output: bool) -> Vec<String> {
    let mut names = vec![
        "tok_embeddings.weight".to_string(),
        "norm.weight".to_string(),
    ];
    if !tied_output {
        names.push("output.weight".to_string());
    }
    let qk_norm = shape_uses_qk_norm(shape);
    let qkv_bias = shape_uses_qkv_bias(shape);
    let per_layer = if qk_norm {
        11usize
    } else if qkv_bias {
        12usize
    } else {
        9usize
    };
    names.reserve(shape.layer_count as usize * per_layer);
    for layer in 0..shape.layer_count {
        let mut suffixes = vec!["attention_norm.weight", "ffn_norm.weight", "wq.weight"];
        if qkv_bias {
            suffixes.push("wq.bias");
        }
        if qk_norm {
            suffixes.push("q_norm.weight");
        }
        suffixes.extend(["wk.weight"]);
        if qkv_bias {
            suffixes.push("wk.bias");
        }
        if qk_norm {
            suffixes.push("k_norm.weight");
        }
        suffixes.push("wv.weight");
        if qkv_bias {
            suffixes.push("wv.bias");
        }
        suffixes.extend(["wo.weight", "w1.weight", "w2.weight", "w3.weight"]);
        for suffix in suffixes {
            names.push(format!("layers.{layer}.{suffix}"));
        }
    }
    names
}

fn shape_uses_qk_norm(shape: &ModelShape) -> bool {
    shape_matches(shape, &ModelShape::qwen3_0_6b())
}

fn shape_uses_qkv_bias(shape: &ModelShape) -> bool {
    shape_matches(shape, &ModelShape::qwen2_5_1_5b())
}

fn tensor_file_name(name: &str) -> String {
    let mut file = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            file.push(ch);
        } else {
            file.push('_');
        }
    }
    file.push_str(".f32");
    file
}

fn dims_text(tensor: &TensorSpec) -> String {
    let mut text = String::new();
    for (index, dim) in tensor.dims.iter().take(tensor.rank as usize).enumerate() {
        if index > 0 {
            text.push(',');
        }
        text.push_str(&dim.to_string());
    }
    text
}

fn push_shape_lines(text: &mut String, shape: &ModelShape) {
    push_line(text, "vocab_size", &shape.vocab_size.to_string());
    push_line(
        text,
        "special_token_count",
        &shape.special_token_count.to_string(),
    );
    push_line(text, "hidden_size", &shape.hidden_size.to_string());
    push_line(text, "layer_count", &shape.layer_count.to_string());
    push_line(text, "head_count", &shape.head_count.to_string());
    push_line(text, "kv_head_count", &shape.kv_head_count.to_string());
    push_line(text, "head_dim", &shape.head_dim.to_string());
    push_line(text, "ffn_size", &shape.ffn_size.to_string());
    push_line(text, "max_context", &shape.max_context.to_string());
    push_line(text, "rope_theta", &shape.rope_theta.to_string());
    push_line(
        text,
        "rms_norm_epsilon",
        &shape.rms_norm_epsilon.to_string(),
    );
}

/// Writes tokenizer rows from either a reviewed override or the shape template.
fn push_source_tokenizer_lines(
    text: &mut String,
    tokenizer: SourceTokenizerTemplate,
    tokenizer_override: Option<&SourceTokenizerOverride>,
    shape: &ModelShape,
) -> io::Result<()> {
    match tokenizer_override {
        Some(override_rows) => {
            if !matches!(
                tokenizer,
                SourceTokenizerTemplate::TinyBpeDemo
                    | SourceTokenizerTemplate::ReviewedBpe
                    | SourceTokenizerTemplate::ReviewedGpt2Bpe
            ) {
                return Err(invalid(
                    "source tokenizer override requires a BPE source model_shape",
                ));
            }
            match tokenizer {
                SourceTokenizerTemplate::TinyBpeDemo => push_bpe_tokenizer_lines(
                    text,
                    shape.vocab_size,
                    &override_rows.tokens,
                    &override_rows.merges,
                ),
                SourceTokenizerTemplate::ReviewedBpe => push_llama_bpe_tokenizer_lines(
                    text,
                    shape.vocab_size,
                    &override_rows.tokens,
                    &override_rows.merges,
                ),
                SourceTokenizerTemplate::ReviewedGpt2Bpe => push_gpt2_bpe_tokenizer_lines(
                    text,
                    shape.vocab_size,
                    &override_rows.tokens,
                    &override_rows.specials,
                    &override_rows.merges,
                ),
                SourceTokenizerTemplate::Byte => unreachable!(),
            }
        }
        None => push_tokenizer_template_lines(text, tokenizer),
    }
}

/// Writes tokenizer rows supplied by a source-shape template.
fn push_tokenizer_template_lines(
    text: &mut String,
    tokenizer: SourceTokenizerTemplate,
) -> io::Result<()> {
    match tokenizer {
        SourceTokenizerTemplate::Byte => {
            push_line(text, "tokenizer", "byte-v1");
            Ok(())
        }
        SourceTokenizerTemplate::TinyBpeDemo => {
            let tokens = tiny_bpe_token_specs();
            let merges = tiny_bpe_merge_specs();
            push_bpe_tokenizer_lines(text, 262, &tokens, &merges)
        }
        SourceTokenizerTemplate::ReviewedBpe => Err(invalid(
            "source-template stories15m-bpe requires a reviewed Llama BPE tokenizer artifact",
        )),
        SourceTokenizerTemplate::ReviewedGpt2Bpe => Err(invalid(
            "source-template GPT2/ByteLevel BPE shapes require a reviewed tokenizer artifact",
        )),
    }
}

/// Writes BPE tokenizer rows after validating ids, ranks, and vocabulary bounds.
fn push_bpe_tokenizer_lines(
    text: &mut String,
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    validate_bpe_parts(vocab_size, tokens, merges)?;
    push_line(text, "tokenizer", "bpe-v1");
    push_line(text, "bpe_token_count", &tokens.len().to_string());
    push_line(text, "bpe_merge_count", &merges.len().to_string());
    for (index, token) in tokens.iter().enumerate() {
        let prefix = format!("bpe.token.{index}");
        push_line(text, &format!("{prefix}.id"), &token.id.to_string());
        push_line(
            text,
            &format!("{prefix}.bytes_hex"),
            &hex_bytes(&token.bytes),
        );
    }
    for (index, merge) in merges.iter().enumerate() {
        let prefix = format!("bpe.merge.{index}");
        push_line(text, &format!("{prefix}.left"), &merge.left.to_string());
        push_line(text, &format!("{prefix}.right"), &merge.right.to_string());
        push_line(text, &format!("{prefix}.output"), &merge.output.to_string());
        push_line(text, &format!("{prefix}.rank"), &merge.rank.to_string());
    }
    Ok(())
}

/// Writes Llama BPE tokenizer rows after validating preserved source ids.
fn push_llama_bpe_tokenizer_lines(
    text: &mut String,
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    validate_llama_bpe_parts(vocab_size, tokens, merges)?;
    push_line(text, "tokenizer", "llama-bpe-v1");
    push_line(text, "bpe_token_count", &tokens.len().to_string());
    push_line(text, "bpe_merge_count", &merges.len().to_string());
    for (index, token) in tokens.iter().enumerate() {
        let prefix = format!("bpe.token.{index}");
        push_line(text, &format!("{prefix}.id"), &token.id.to_string());
        push_line(
            text,
            &format!("{prefix}.bytes_hex"),
            &hex_bytes(&token.bytes),
        );
    }
    for (index, merge) in merges.iter().enumerate() {
        let prefix = format!("bpe.merge.{index}");
        push_line(text, &format!("{prefix}.left"), &merge.left.to_string());
        push_line(text, &format!("{prefix}.right"), &merge.right.to_string());
        push_line(text, &format!("{prefix}.output"), &merge.output.to_string());
        push_line(text, &format!("{prefix}.rank"), &merge.rank.to_string());
    }
    Ok(())
}

/// Writes GPT2/ByteLevel BPE tokenizer rows after validating source ids.
fn push_gpt2_bpe_tokenizer_lines(
    text: &mut String,
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    specials: &[BpeSpecialTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    validate_gpt2_bpe_parts(vocab_size, tokens, specials, merges)?;
    push_line(text, "tokenizer", "gpt2-bpe-v1");
    push_line(text, "bpe_token_count", &tokens.len().to_string());
    push_line(text, "bpe_special_count", &specials.len().to_string());
    push_line(text, "bpe_merge_count", &merges.len().to_string());
    for (index, token) in tokens.iter().enumerate() {
        let prefix = format!("bpe.token.{index}");
        push_line(text, &format!("{prefix}.id"), &token.id.to_string());
        push_line(
            text,
            &format!("{prefix}.bytes_hex"),
            &hex_bytes(&token.bytes),
        );
    }
    for (index, special) in specials.iter().enumerate() {
        let prefix = format!("bpe.special.{index}");
        push_line(text, &format!("{prefix}.id"), &special.id.to_string());
        push_line(
            text,
            &format!("{prefix}.bytes_hex"),
            &hex_bytes(&special.bytes),
        );
    }
    for (index, merge) in merges.iter().enumerate() {
        let prefix = format!("bpe.merge.{index}");
        push_line(text, &format!("{prefix}.left"), &merge.left.to_string());
        push_line(text, &format!("{prefix}.right"), &merge.right.to_string());
        push_line(text, &format!("{prefix}.output"), &merge.output.to_string());
        push_line(text, &format!("{prefix}.rank"), &merge.rank.to_string());
    }
    Ok(())
}

fn tiny_bpe_token_specs() -> Vec<BpeTokenSpec> {
    vec![
        BpeTokenSpec {
            id: 260,
            bytes: b"th".to_vec(),
        },
        BpeTokenSpec {
            id: 261,
            bytes: b"the".to_vec(),
        },
    ]
}

fn tiny_bpe_merge_specs() -> Vec<BpeMergeSpec> {
    vec![
        BpeMergeSpec {
            left: 116,
            right: 104,
            output: 260,
            rank: 0,
        },
        BpeMergeSpec {
            left: 260,
            right: 101,
            output: 261,
            rank: 1,
        },
    ]
}

fn shape_matches(a: &ModelShape, b: &ModelShape) -> bool {
    a.vocab_size == b.vocab_size
        && a.special_token_count == b.special_token_count
        && a.hidden_size == b.hidden_size
        && a.layer_count == b.layer_count
        && a.head_count == b.head_count
        && a.kv_head_count == b.kv_head_count
        && a.head_dim == b.head_dim
        && a.ffn_size == b.ffn_size
        && a.max_context == b.max_context
        && a.rope_theta.to_bits() == b.rope_theta.to_bits()
        && a.rms_norm_epsilon.to_bits() == b.rms_norm_epsilon.to_bits()
}

fn shape_matches_except_vocab(a: &ModelShape, b: &ModelShape) -> bool {
    a.special_token_count == b.special_token_count
        && a.hidden_size == b.hidden_size
        && a.layer_count == b.layer_count
        && a.head_count == b.head_count
        && a.kv_head_count == b.kv_head_count
        && a.head_dim == b.head_dim
        && a.ffn_size == b.ffn_size
        && a.max_context == b.max_context
        && a.rope_theta.to_bits() == b.rope_theta.to_bits()
        && a.rms_norm_epsilon.to_bits() == b.rms_norm_epsilon.to_bits()
}

fn sidecar_manifest_path(output_slm: &Path) -> PathBuf {
    let mut value = output_slm.as_os_str().to_os_string();
    value.push(".manifest");
    PathBuf::from(value)
}

fn parse_key_value_manifest(text: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "source manifest line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            return Err(invalid(&format!(
                "source manifest line {} has an empty key or value",
                line_index + 1
            )));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate source manifest key {key}")));
        }
    }
    Ok(fields)
}

fn require_evidence_field(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    validate_evidence_value(key, value)
}

fn validate_source_review_metadata(metadata: &SourceExportMetadata<'_>) -> io::Result<()> {
    let values = [
        metadata.source_review_kind,
        metadata.source_review_status,
        metadata.source_review_checksum,
        metadata.source_review_required_next_gate,
    ];
    if values.iter().all(|value| value.is_none()) {
        return Ok(());
    }
    let kind = metadata
        .source_review_kind
        .ok_or_else(|| invalid("source review metadata missing source_review_kind"))?;
    let status = metadata
        .source_review_status
        .ok_or_else(|| invalid("source review metadata missing source_review_status"))?;
    let checksum = metadata
        .source_review_checksum
        .ok_or_else(|| invalid("source review metadata missing source_review_checksum"))?;
    let required_next_gate = metadata.source_review_required_next_gate.ok_or_else(|| {
        invalid("source review metadata missing source_review_required_next_gate")
    })?;
    validate_source_review_record(kind, status, checksum, required_next_gate)
}

fn validate_source_review_fields(fields: &HashMap<String, String>) -> io::Result<()> {
    let keys = [
        "source_review_kind",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(());
    }
    let kind = require_key(fields, "source_review_kind")?;
    let status = require_key(fields, "source_review_status")?;
    let checksum = require_key(fields, "source_review_checksum")?;
    let required_next_gate = require_key(fields, "source_review_required_next_gate")?;
    validate_source_review_record(kind, status, checksum, required_next_gate)
}

fn validate_source_review_record(
    kind: &str,
    status: &str,
    checksum: &str,
    required_next_gate: &str,
) -> io::Result<()> {
    if kind != SOURCE_REVIEW_KIND {
        return Err(invalid("source_review_kind is invalid"));
    }
    if status != SOURCE_REVIEW_STATUS {
        return Err(invalid("source_review_status is invalid"));
    }
    validate_hex64_text("source_review_checksum", checksum)?;
    if required_next_gate != SOURCE_REVIEW_REQUIRED_NEXT_GATE {
        return Err(invalid("source_review_required_next_gate is invalid"));
    }
    Ok(())
}

fn validate_evidence_value(key: &str, value: &str) -> io::Result<()> {
    if value == "pending" || value == "not-reviewed" || value == "not-provided" || value.len() < 8 {
        return Err(invalid(&format!(
            "source field {key} must contain reviewed routing evidence"
        )));
    }
    Ok(())
}

fn validate_hex64_text(key: &str, value: &str) -> io::Result<()> {
    let Some(rest) = value.strip_prefix("0x") else {
        return Err(invalid(&format!(
            "source field {key} must be a hex64 checksum"
        )));
    };
    if rest.len() != 16 || !rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!(
            "source field {key} must be a hex64 checksum"
        )));
    }
    Ok(())
}

fn parse_u32_key(fields: &HashMap<String, String>, key: &str) -> io::Result<u32> {
    require_key(fields, key)?
        .parse::<u32>()
        .map_err(|_| invalid(&format!("source manifest key {key} must be a u32")))
}

fn parse_positive_f32_key_or(
    fields: &HashMap<String, String>,
    key: &str,
    fallback: f32,
) -> io::Result<f32> {
    let value = match fields.get(key) {
        Some(raw) => raw
            .parse::<f32>()
            .map_err(|_| invalid(&format!("source manifest key {key} must be an f32")))?,
        None => fallback,
    };
    if !value.is_finite() || value <= 0.0 {
        return Err(invalid(&format!(
            "source manifest key {key} must be finite and greater than zero"
        )));
    }
    Ok(value)
}

fn parse_usize_key(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    require_key(fields, key)?
        .parse::<usize>()
        .map_err(|_| invalid(&format!("source manifest key {key} must be a usize")))
}

fn reject_extra_bpe_keys(
    fields: &HashMap<String, String>,
    token_count: usize,
    merge_count: usize,
) -> io::Result<()> {
    for key in fields.keys() {
        if let Some(rest) = key.strip_prefix("bpe.token.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("BPE token key {key} is malformed")));
            };
            let index = index_text
                .parse::<usize>()
                .map_err(|_| invalid(&format!("BPE token key {key} has invalid index")))?;
            if index >= token_count {
                return Err(invalid(&format!(
                    "BPE token key {key} is outside declared bpe_token_count"
                )));
            }
            match field_name {
                "id" | "bytes_hex" => {}
                _ => return Err(invalid(&format!("BPE token key {key} has unknown field"))),
            }
        }
        if let Some(rest) = key.strip_prefix("bpe.merge.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("BPE merge key {key} is malformed")));
            };
            let index = index_text
                .parse::<usize>()
                .map_err(|_| invalid(&format!("BPE merge key {key} has invalid index")))?;
            if index >= merge_count {
                return Err(invalid(&format!(
                    "BPE merge key {key} is outside declared bpe_merge_count"
                )));
            }
            match field_name {
                "left" | "right" | "output" | "rank" => {}
                _ => return Err(invalid(&format!("BPE merge key {key} has unknown field"))),
            }
        }
    }
    Ok(())
}

fn reject_extra_gpt2_bpe_keys(
    fields: &HashMap<String, String>,
    token_count: usize,
    special_count: usize,
    merge_count: usize,
) -> io::Result<()> {
    reject_extra_bpe_keys(fields, token_count, merge_count)?;
    for key in fields.keys() {
        if let Some(rest) = key.strip_prefix("bpe.special.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("BPE special key {key} is malformed")));
            };
            let index = index_text
                .parse::<usize>()
                .map_err(|_| invalid(&format!("BPE special key {key} has invalid index")))?;
            if index >= special_count {
                return Err(invalid(&format!(
                    "BPE special key {key} is outside declared bpe_special_count"
                )));
            }
            match field_name {
                "id" | "bytes_hex" => {}
                _ => {
                    return Err(invalid(&format!("BPE special key {key} has unknown field")));
                }
            }
        }
    }
    Ok(())
}

fn parse_hex_bytes(value: &str) -> io::Result<Vec<u8>> {
    if !value.len().is_multiple_of(2) {
        return Err(invalid("BPE token bytes_hex must have even length"));
    }
    let mut bytes = Vec::with_capacity(value.len() / 2);
    for pair in value.as_bytes().chunks_exact(2) {
        let high = hex_nibble(pair[0])?;
        let low = hex_nibble(pair[1])?;
        bytes.push((high << 4) | low);
    }
    Ok(bytes)
}

fn hex_nibble(byte: u8) -> io::Result<u8> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err(invalid("BPE token bytes_hex contains a non-hex digit")),
    }
}

fn hex_bytes(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut text = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        text.push(HEX[(byte >> 4) as usize] as char);
        text.push(HEX[(byte & 0x0f) as usize] as char);
    }
    text
}

fn require_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("source manifest missing required key {key}")))
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "source manifest key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

fn source_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x6eed0e9da4d94a4fu64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 3);
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    acc
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tensor_writer::name_hash;

    #[test]
    fn legacy_smollm_manifest_uses_named_numerical_defaults() {
        let expected = ModelShape::smollm2_360m_instruct();
        let mut fields = HashMap::new();
        fields.insert(
            "model_shape".to_string(),
            "smollm2-360m-instruct-bpe".to_string(),
        );
        fields.insert("vocab_size".to_string(), expected.vocab_size.to_string());
        fields.insert(
            "special_token_count".to_string(),
            expected.special_token_count.to_string(),
        );
        fields.insert("hidden_size".to_string(), expected.hidden_size.to_string());
        fields.insert("layer_count".to_string(), expected.layer_count.to_string());
        fields.insert("head_count".to_string(), expected.head_count.to_string());
        fields.insert(
            "kv_head_count".to_string(),
            expected.kv_head_count.to_string(),
        );
        fields.insert("head_dim".to_string(), expected.head_dim.to_string());
        fields.insert("ffn_size".to_string(), expected.ffn_size.to_string());
        fields.insert("max_context".to_string(), expected.max_context.to_string());

        let shape = shape_from_fields(&fields).unwrap();

        assert_eq!(shape.rope_theta, 100_000.0);
        assert_eq!(shape.rms_norm_epsilon, 1e-5);
    }

    #[test]
    fn source_manifest_rejects_non_finite_numerical_configuration() {
        let expected = ModelShape::tiny_fixture();
        let mut fields = HashMap::new();
        fields.insert("model_shape".to_string(), "tiny-fixture".to_string());
        fields.insert("vocab_size".to_string(), expected.vocab_size.to_string());
        fields.insert(
            "special_token_count".to_string(),
            expected.special_token_count.to_string(),
        );
        fields.insert("hidden_size".to_string(), expected.hidden_size.to_string());
        fields.insert("layer_count".to_string(), expected.layer_count.to_string());
        fields.insert("head_count".to_string(), expected.head_count.to_string());
        fields.insert(
            "kv_head_count".to_string(),
            expected.kv_head_count.to_string(),
        );
        fields.insert("head_dim".to_string(), expected.head_dim.to_string());
        fields.insert("ffn_size".to_string(), expected.ffn_size.to_string());
        fields.insert("max_context".to_string(), expected.max_context.to_string());
        fields.insert("rope_theta".to_string(), "NaN".to_string());

        let error = shape_from_fields(&fields)
            .err()
            .expect("non-finite rope_theta must be rejected");

        assert!(error.to_string().contains("rope_theta must be finite"));
    }

    #[test]
    fn validates_generated_source_fixture() {
        let dir = temp_path("source-fixture");
        write_source_template_path(&dir, "tiny-fixture").unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("rope_theta=10000\n"));
        assert!(manifest.contains("rms_norm_epsilon=0.00001\n"));

        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn converts_source_fixture_to_all_supported_slm_quantizations() {
        let dir = temp_path("source-convert");
        write_source_template_path(&dir, "tiny-fixture").unwrap();

        for quantization in ["f32", "q8_0", "q5_0", "q4_0"] {
            let output = dir.join(format!("converted-{quantization}.slm"));
            convert_trained_path(&dir, &output, quantization).unwrap();
            slm_validate::validate_path(&output).unwrap();
            provenance::validate_manifest_path(&output, &sidecar_manifest_path(&output)).unwrap();
        }
        cleanup(&dir);
    }

    #[test]
    fn validates_output_quantization_parameter_before_conversion() {
        for quantization in [
            "f32",
            "q8_0",
            "q5_0",
            "q4_0",
            MIXED_Q8_EDGE_Q4_BODY_V1,
            MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1,
            MIXED_Q8_MATRIX_F32_NORM_V1,
            MIXED_Q5_MATRIX_F32_NORM_V1,
        ] {
            validate_output_quantization(quantization).unwrap();
        }

        let error = validate_output_quantization("q2_0").unwrap_err();

        assert!(error.to_string().contains(OUTPUT_QUANTIZATION_ERROR));
    }

    #[test]
    fn mixed_profile_assigns_model_sensitive_tensors_deterministically() {
        let shape = ModelShape::tinylm16();
        let names = tensor_names_for_shape(&shape, false);
        let tensors =
            tensors_for_output_quantization(&shape, false, MIXED_Q8_EDGE_Q4_BODY_V1).unwrap();
        let dtype_for = |name: &str| {
            let index = names
                .iter()
                .position(|candidate| candidate == name)
                .unwrap();
            tensors[index].dtype
        };

        assert_eq!(dtype_for("tok_embeddings.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("norm.weight"), DTYPE_F32);
        assert_eq!(dtype_for("output.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.0.wq.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.wq.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.2.w2.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.3.w3.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.attention_norm.weight"), DTYPE_F32);
        assert_eq!(dtype_for("layers.2.ffn_norm.weight"), DTYPE_F32);
    }

    #[test]
    fn output_down_profile_keeps_sensitive_middle_projections_in_q8() {
        let shape = ModelShape::tinylm16();
        let names = tensor_names_for_shape(&shape, true);
        let tensors =
            tensors_for_output_quantization(&shape, true, MIXED_Q8_OUTPUT_DOWN_Q4_BODY_V1).unwrap();
        let dtype_for = |name: &str| {
            let index = names
                .iter()
                .position(|candidate| candidate == name)
                .unwrap();
            tensors[index].dtype
        };

        assert_eq!(dtype_for("tok_embeddings.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.0.w1.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.wo.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.w2.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.wq.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.1.wk.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.1.wv.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.1.w1.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.1.w3.weight"), DTYPE_Q4_0);
        assert_eq!(dtype_for("layers.2.ffn_norm.weight"), DTYPE_F32);
        assert_eq!(dtype_for("layers.3.w3.weight"), DTYPE_Q8_0);
    }

    #[test]
    fn q8_matrix_profile_keeps_every_norm_in_f32() {
        let shape = ModelShape::tinylm16();
        let names = tensor_names_for_shape(&shape, true);
        let tensors =
            tensors_for_output_quantization(&shape, true, MIXED_Q8_MATRIX_F32_NORM_V1).unwrap();
        let dtype_for = |name: &str| {
            let index = names
                .iter()
                .position(|candidate| candidate == name)
                .unwrap();
            tensors[index].dtype
        };

        assert_eq!(dtype_for("tok_embeddings.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("norm.weight"), DTYPE_F32);
        assert_eq!(dtype_for("layers.0.attention_norm.weight"), DTYPE_F32);
        assert_eq!(dtype_for("layers.1.ffn_norm.weight"), DTYPE_F32);
        assert_eq!(dtype_for("layers.1.wq.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.wk.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.wv.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.1.wo.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.2.w1.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.2.w2.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.2.w3.weight"), DTYPE_Q8_0);
        assert_eq!(dtype_for("layers.3.w3.weight"), DTYPE_Q8_0);
    }

    #[test]
    fn q8_matrix_profile_does_not_require_middle_layers() {
        let tensors = tensors_for_output_quantization(
            &ModelShape::tiny_fixture(),
            false,
            MIXED_Q8_MATRIX_F32_NORM_V1,
        )
        .unwrap();

        assert!(tensors.iter().any(|tensor| tensor.dtype == DTYPE_F32));
        assert!(tensors.iter().any(|tensor| tensor.dtype == DTYPE_Q8_0));
        assert!(tensors.iter().all(|tensor| tensor.dtype != DTYPE_Q4_0));
    }

    #[test]
    fn q5_matrix_profile_keeps_norms_in_f32_and_uses_sixty_four_value_blocks() {
        let shape = ModelShape::qwen3_0_6b();
        let names = tensor_names_for_shape(&shape, true);
        let tensors =
            tensors_for_output_quantization(&shape, true, MIXED_Q5_MATRIX_F32_NORM_V1).unwrap();
        let tensor_for = |name: &str| {
            let index = names
                .iter()
                .position(|candidate| candidate == name)
                .unwrap();
            &tensors[index]
        };

        assert_eq!(tensor_for("tok_embeddings.weight").dtype, DTYPE_Q5_0);
        assert_eq!(tensor_for("tok_embeddings.weight").block_size, 64);
        assert_eq!(tensor_for("norm.weight").dtype, DTYPE_F32);
        assert_eq!(tensor_for("layers.0.q_norm.weight").dtype, DTYPE_F32);
        assert_eq!(tensor_for("layers.0.k_norm.weight").dtype, DTYPE_F32);
        assert_eq!(tensor_for("layers.1.wq.weight").dtype, DTYPE_Q5_0);
        assert_eq!(tensor_for("layers.1.wq.weight").block_size, 64);
        assert!(tensors.iter().all(|tensor| tensor.dtype != DTYPE_Q4_0));
        assert!(tensors.iter().all(|tensor| tensor.dtype != DTYPE_Q8_0));
    }

    #[test]
    fn mixed_profile_serializes_as_a_deterministic_valid_mixed_directory() {
        let shape = ModelShape {
            layer_count: 3,
            ..ModelShape::tiny_fixture()
        };
        let tensors =
            tensors_for_output_quantization(&shape, false, MIXED_Q8_EDGE_Q4_BODY_V1).unwrap();
        let values = tensors
            .iter()
            .map(|tensor| {
                (0..tensor.element_count())
                    .map(|index| fixture_value(tensor, index))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();

        let first = build_model_file_from_values_with_flags(
            &shape,
            &tensors,
            &TokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap();
        let second = build_model_file_from_values_with_flags(
            &shape,
            &tensors,
            &TokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(&first, "mixed-profile.slm").unwrap();

        assert_eq!(first, second);
        assert_eq!(report.quantization_label(), "mixed");
    }

    #[test]
    fn mixed_profile_rejects_a_model_without_middle_blocks() {
        let error = tensors_for_output_quantization(
            &ModelShape::tiny_fixture(),
            false,
            MIXED_Q8_EDGE_Q4_BODY_V1,
        )
        .err()
        .expect("a one-layer model cannot satisfy the mixed profile");

        assert!(error
            .to_string()
            .contains("requires at least three transformer layers"));
    }

    #[test]
    fn returns_ordered_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("tiny-fixture-tied").unwrap();

        assert_eq!(expectations.len(), 11);
        assert_eq!(expectations[0].name, "tok_embeddings.weight");
        assert_eq!(expectations[0].dims, vec![260, 8]);
        assert_eq!(
            expectations[0].relative_file,
            "tensors/tok_embeddings_weight.f32"
        );
        assert_eq!(expectations[0].f32_bytes, 260 * 8 * 4);
        assert!(!expectations
            .iter()
            .any(|expectation| expectation.name == "output.weight"));
    }

    #[test]
    fn returns_tinylm16_bpe_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("tinylm16-bpe").unwrap();
        let template = template_for_name("tinylm16-bpe").unwrap();

        assert!(matches!(
            template.tokenizer,
            SourceTokenizerTemplate::TinyBpeDemo
        ));
        assert_eq!(template.shape.hidden_size, 512);
        assert_eq!(template.shape.vocab_size, 262);
        assert_eq!(expectations.len(), 39);
        assert_eq!(expectations[0].name, "tok_embeddings.weight");
        assert_eq!(expectations[0].dims, vec![262, 512]);
        assert_eq!(expectations[2].name, "output.weight");
        assert_eq!(expectations[2].dims, vec![262, 512]);
        assert_eq!(expectations[0].f32_bytes, 262 * 512 * 4);
    }

    #[test]
    fn returns_stories15m_bpe_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("stories15m-bpe").unwrap();
        let contract = source_shape_contract("stories15m-bpe").unwrap();
        let parameter_count = expectations
            .iter()
            .map(|expectation| expectation.f32_bytes / 4)
            .sum::<u64>();

        assert_eq!(contract.shape.vocab_size, 32000);
        assert_eq!(contract.shape.hidden_size, 288);
        assert_eq!(contract.shape.layer_count, 6);
        assert_eq!(contract.shape.head_count, 6);
        assert_eq!(contract.shape.kv_head_count, 6);
        assert_eq!(contract.shape.head_dim, 48);
        assert_eq!(contract.shape.ffn_size, 768);
        assert_eq!(contract.shape.max_context, 256);
        assert!(contract.tied_output);
        assert_eq!(contract.tokenizer_strategy, "llama-bpe-v1");
        assert!(contract.requires_tokenizer_artifact);
        assert_eq!(expectations.len(), 56);
        assert_eq!(parameter_count, 15_191_712);
        assert_eq!(expectations[0].name, "tok_embeddings.weight");
        assert_eq!(expectations[0].dims, vec![32000, 288]);
        assert!(!expectations
            .iter()
            .any(|expectation| expectation.name == "output.weight"));
    }

    #[test]
    fn returns_smollm2_instruct_gpt2_bpe_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("smollm2-135m-instruct-bpe").unwrap();
        let contract = source_shape_contract("smollm2-135m-instruct-bpe").unwrap();

        assert_eq!(contract.shape.vocab_size, 49152);
        assert_eq!(contract.shape.hidden_size, 576);
        assert_eq!(contract.shape.layer_count, 30);
        assert_eq!(contract.shape.head_count, 9);
        assert_eq!(contract.shape.kv_head_count, 3);
        assert_eq!(contract.shape.head_dim, 64);
        assert_eq!(contract.shape.ffn_size, 1536);
        assert_eq!(contract.shape.max_context, 8192);
        assert!(contract.tied_output);
        assert_eq!(contract.tokenizer_strategy, "gpt2-bpe-v1");
        assert!(contract.requires_tokenizer_artifact);
        assert_eq!(expectations.len(), 272);
        assert!(!expectations
            .iter()
            .any(|expectation| expectation.name == "output.weight"));
        let wk = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.wk.weight")
            .unwrap();
        let wv = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.wv.weight")
            .unwrap();
        assert_eq!(wk.dims, vec![192, 576]);
        assert_eq!(wv.dims, vec![192, 576]);
    }

    #[test]
    fn returns_smollm2_360m_instruct_gpt2_bpe_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("smollm2-360m-instruct-bpe").unwrap();
        let contract = source_shape_contract("smollm2-360m-instruct-bpe").unwrap();

        assert_eq!(contract.shape.vocab_size, 49152);
        assert_eq!(contract.shape.hidden_size, 960);
        assert_eq!(contract.shape.layer_count, 32);
        assert_eq!(contract.shape.head_count, 15);
        assert_eq!(contract.shape.kv_head_count, 5);
        assert_eq!(contract.shape.head_dim, 64);
        assert_eq!(contract.shape.ffn_size, 2560);
        assert_eq!(contract.shape.max_context, 8192);
        assert!(contract.tied_output);
        assert_eq!(contract.tokenizer_strategy, "gpt2-bpe-v1");
        assert!(contract.requires_tokenizer_artifact);
        assert_eq!(expectations.len(), 290);
        assert_eq!(expectations[0].name, "tok_embeddings.weight");
        assert_eq!(expectations[0].dims, vec![49152, 960]);
        assert!(!expectations
            .iter()
            .any(|expectation| expectation.name == "output.weight"));
        let wk = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.wk.weight")
            .unwrap();
        let wv = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.wv.weight")
            .unwrap();
        assert_eq!(wk.dims, vec![320, 960]);
        assert_eq!(wv.dims, vec![320, 960]);
    }

    #[test]
    fn returns_qwen3_0_6b_source_contract_with_wide_queries_and_qk_norms() {
        let expectations = source_tensor_expectations("qwen3-0.6b-bpe").unwrap();
        let contract = source_shape_contract("qwen3-0.6b-bpe").unwrap();

        assert_eq!(contract.shape.vocab_size, 151936);
        assert_eq!(contract.shape.hidden_size, 1024);
        assert_eq!(contract.shape.layer_count, 28);
        assert_eq!(contract.shape.head_count, 16);
        assert_eq!(contract.shape.kv_head_count, 8);
        assert_eq!(contract.shape.head_dim, 128);
        assert_eq!(contract.shape.ffn_size, 3072);
        assert_eq!(contract.shape.max_context, 1024);
        assert_eq!(contract.shape.rope_theta, 1_000_000.0);
        assert_eq!(contract.shape.rms_norm_epsilon, 1e-6);
        assert!(contract.tied_output);
        assert_eq!(contract.tokenizer_strategy, "gpt2-bpe-v1");
        assert!(contract.requires_tokenizer_artifact);
        assert_eq!(contract.tokenizer_ids.bos, 151643);
        assert_eq!(contract.tokenizer_ids.eos, 151645);
        assert_eq!(contract.tokenizer_ids.pad, 151643);
        assert_eq!(contract.tokenizer_ids.unk, 151643);
        assert_eq!(expectations.len(), 310);
        assert!(!expectations
            .iter()
            .any(|expectation| expectation.name == "output.weight"));

        let wq = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.wq.weight")
            .unwrap();
        let wo = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.wo.weight")
            .unwrap();
        let q_norm = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.q_norm.weight")
            .unwrap();
        let k_norm = expectations
            .iter()
            .find(|expectation| expectation.name == "layers.0.k_norm.weight")
            .unwrap();
        assert_eq!(wq.dims, vec![2048, 1024]);
        assert_eq!(wo.dims, vec![1024, 2048]);
        assert_eq!(q_norm.dims, vec![128]);
        assert_eq!(k_norm.dims, vec![128]);
    }

    #[test]
    fn returns_qwen2_5_1_5b_source_contract_with_projection_biases() {
        let expectations = source_tensor_expectations("qwen2.5-1.5b-bpe").unwrap();
        let contract = source_shape_contract("qwen2.5-1.5b-bpe").unwrap();

        assert_eq!(contract.shape.vocab_size, 151936);
        assert_eq!(contract.shape.hidden_size, 1536);
        assert_eq!(contract.shape.layer_count, 28);
        assert_eq!(contract.shape.head_count, 12);
        assert_eq!(contract.shape.kv_head_count, 2);
        assert_eq!(contract.shape.head_dim, 128);
        assert_eq!(contract.shape.ffn_size, 8960);
        assert_eq!(contract.shape.max_context, 1024);
        assert_eq!(contract.shape.rope_theta, 1_000_000.0);
        assert_eq!(contract.shape.rms_norm_epsilon, 1e-6);
        assert!(contract.tied_output);
        assert_eq!(contract.tokenizer_strategy, "gpt2-bpe-v1");
        assert_eq!(expectations.len(), 338);

        for (name, dims) in [
            ("layers.0.wq.bias", vec![1536]),
            ("layers.0.wk.bias", vec![256]),
            ("layers.0.wv.bias", vec![256]),
        ] {
            let expectation = expectations
                .iter()
                .find(|expectation| expectation.name == name)
                .unwrap_or_else(|| panic!("missing source expectation {name}"));
            assert_eq!(expectation.dims, dims);
        }

        let names = tensor_names_for_shape(&contract.shape, true);
        let tensors = tensors_for_output_quantization(&contract.shape, true, "q4_0").unwrap();
        for name in ["layers.0.wq.bias", "layers.0.wk.bias", "layers.0.wv.bias"] {
            let index = names
                .iter()
                .position(|candidate| candidate == name)
                .unwrap();
            assert_eq!(tensors[index].dtype, DTYPE_F32);
        }
        let wq = names
            .iter()
            .position(|candidate| candidate == "layers.0.wq.weight")
            .unwrap();
        assert_eq!(tensors[wq].dtype, DTYPE_Q4_0);
    }

    #[test]
    fn stories15m_source_template_requires_reviewed_bpe_tokenizer() {
        let dir = temp_path("stories15m-template-requires-tokenizer");

        let error = write_source_template_path(&dir, "stories15m-bpe").unwrap_err();

        assert!(error
            .to_string()
            .contains("requires a reviewed Llama BPE tokenizer artifact"));
        cleanup(&dir);
    }

    #[test]
    fn writes_reviewed_source_export_and_validates_metadata() {
        let dir = temp_path("source-export");
        let payloads = one_f32_payloads("tiny-fixture-tied");
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-001",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: Some(SOURCE_REVIEW_STATUS),
            source_review_checksum: Some("0x00000000000000f1"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: None,
        };

        write_source_export_path(&dir, "tiny-fixture-tied", &metadata, &payloads).unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("source_kind=trained-export"));
        assert!(manifest.contains("source_id=reviewed-source-001"));
        assert!(manifest.contains("source_license=reviewed-local-license"));
        assert!(manifest.contains("source_dataset=reviewed-local-dataset"));
        assert!(manifest
            .contains("source_training_summary=Reviewed local safetensors extraction route"));
        assert!(manifest.contains("source_review_kind=safetensors-candidate-review"));
        assert!(manifest.contains("source_review_status=validated-before-extraction"));
        assert!(manifest.contains("source_review_checksum=0x00000000000000f1"));
        assert!(manifest.contains("source_review_required_next_gate=extract-raw-f32-tensors"));
        assert!(manifest.contains("model_shape=tiny-fixture-tied"));
        assert!(!manifest.contains("output.weight"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn writes_reviewed_source_export_with_bpe_tokenizer_override() {
        let dir = temp_path("source-export-bpe-override");
        let payloads = one_f32_payloads("tiny-fixture-bpe");
        let tokenizer_override = SourceTokenizerOverride {
            tokens: vec![BpeTokenSpec {
                id: 260,
                bytes: b"to".to_vec(),
            }],
            specials: Vec::new(),
            merges: vec![BpeMergeSpec {
                left: 116,
                right: 111,
                output: 260,
                rank: 0,
            }],
        };
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-bpe",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local BPE safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: Some(SOURCE_REVIEW_STATUS),
            source_review_checksum: Some("0x00000000000000b1"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: Some(&tokenizer_override),
        };

        write_source_export_path(&dir, "tiny-fixture-bpe", &metadata, &payloads).unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-bpe"));
        assert!(manifest.contains("tokenizer=bpe-v1"));
        assert!(manifest.contains("bpe_token_count=1"));
        assert!(manifest.contains("bpe_merge_count=1"));
        assert!(manifest.contains("bpe.token.0.bytes_hex=746f"));
        assert!(manifest.contains("bpe.merge.0.right=111"));
        assert!(!manifest.contains("bpe.token.0.bytes_hex=7468"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn writes_reviewed_stories_source_export_with_llama_bpe_tokenizer_override() {
        let dir = temp_path("source-export-stories-llama-bpe-override");
        let payloads = one_f32_payloads("stories15m-bpe");
        let tokenizer_override = SourceTokenizerOverride {
            tokens: vec![
                BpeTokenSpec {
                    id: 259,
                    bytes: "▁".as_bytes().to_vec(),
                },
                BpeTokenSpec {
                    id: 260,
                    bytes: b"t".to_vec(),
                },
                BpeTokenSpec {
                    id: 261,
                    bytes: "▁t".as_bytes().to_vec(),
                },
            ],
            specials: Vec::new(),
            merges: vec![BpeMergeSpec {
                left: 259,
                right: 260,
                output: 261,
                rank: 0,
            }],
        };
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-stories15m",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local Llama BPE safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: Some(SOURCE_REVIEW_STATUS),
            source_review_checksum: Some("0x000000000000015f"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: Some(&tokenizer_override),
        };

        write_source_export_path(&dir, "stories15m-bpe", &metadata, &payloads).unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=stories15m-bpe"));
        assert!(manifest.contains("tied_output=true"));
        assert!(manifest.contains("tokenizer=llama-bpe-v1"));
        assert!(manifest.contains("bpe_token_count=3"));
        assert!(manifest.contains("bpe_merge_count=1"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn rejects_source_export_metadata_without_reviewed_evidence() {
        let dir = temp_path("source-export-metadata");
        let payloads = one_f32_payloads("tiny-fixture");
        let metadata = SourceExportMetadata {
            source_id: "pending",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: None,
            source_review_status: None,
            source_review_checksum: None,
            source_review_required_next_gate: None,
            source_tokenizer_override: None,
        };

        let error =
            write_source_export_path(&dir, "tiny-fixture", &metadata, &payloads).unwrap_err();

        assert!(error.to_string().contains("source field source_id"));
    }

    #[test]
    fn rejects_source_export_partial_review_metadata() {
        let dir = temp_path("source-export-partial-review");
        let payloads = one_f32_payloads("tiny-fixture");
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-001",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: None,
            source_review_checksum: Some("0x00000000000000f1"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: None,
        };

        let error =
            write_source_export_path(&dir, "tiny-fixture", &metadata, &payloads).unwrap_err();

        assert!(error.to_string().contains("source_review_status"));
    }

    #[test]
    fn rejects_source_export_payload_name_mismatch() {
        let dir = temp_path("source-export-payload-name");
        let mut payloads = one_f32_payloads("tiny-fixture");
        payloads[0].name = "wrong.weight".to_string();
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-001",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: None,
            source_review_status: None,
            source_review_checksum: None,
            source_review_required_next_gate: None,
            source_tokenizer_override: None,
        };

        let error =
            write_source_export_path(&dir, "tiny-fixture", &metadata, &payloads).unwrap_err();

        assert!(error
            .to_string()
            .contains("source export payload 0 was wrong.weight"));
    }

    #[test]
    fn validates_generated_tied_source_fixture_without_output_tensor() {
        let dir = temp_path("source-tied-fixture");
        write_source_template_path(&dir, "tiny-fixture-tied").unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-tied"));
        assert!(manifest.contains("tied_output=true"));
        assert!(manifest.contains("tensor_count=11"));
        assert!(!manifest.contains("output.weight"));
        assert!(!dir.join("tensors").join("output_weight.f32").exists());
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn rejects_tied_output_manifest_shape_disagreement() {
        let dir = temp_path("source-tied-disagreement");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path)
            .unwrap()
            .replace("tied_output=false", "tied_output=true");
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("model_shape and tied_output"));
        cleanup(&dir);
    }

    #[test]
    fn converts_tied_source_fixture_to_all_supported_slm_quantizations() {
        let dir = temp_path("source-tied-convert");
        write_source_template_path(&dir, "tiny-fixture-tied").unwrap();

        for quantization in ["f32", "q8_0", "q4_0"] {
            let output = dir.join(format!("tied-converted-{quantization}.slm"));
            convert_trained_path(&dir, &output, quantization).unwrap();
            let bytes = fs::read(&output).unwrap();
            let report =
                slm_validate::validate_bytes(&bytes, &output.display().to_string()).unwrap();
            assert_eq!(read_u32_le(&bytes, 16) & FLAG_TIED_OUTPUT, FLAG_TIED_OUTPUT);
            assert_eq!(report.tensor_count(), 11);
            assert!(!contains_tensor_hash(&bytes, name_hash("output.weight")));
            assert!(contains_tensor_hash(
                &bytes,
                name_hash("tok_embeddings.weight")
            ));
            provenance::validate_manifest_path(&output, &sidecar_manifest_path(&output)).unwrap();
        }
        cleanup(&dir);
    }

    #[test]
    fn validates_generated_bpe_source_fixture() {
        let dir = temp_path("source-bpe-fixture");
        write_source_template_path(&dir, "tiny-fixture-bpe").unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-bpe"));
        assert!(manifest.contains("tokenizer=bpe-v1"));
        assert!(manifest.contains("vocab_size=262"));
        assert!(manifest.contains("bpe.token.1.bytes_hex=746865"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn converts_bpe_source_fixture_to_bpe_slm() {
        let dir = temp_path("source-bpe-convert");
        write_source_template_path(&dir, "tiny-fixture-bpe").unwrap();
        let output = dir.join("bpe-converted-q8.slm");

        convert_trained_path(&dir, &output, "q8_0").unwrap();

        let bytes = fs::read(&output).unwrap();
        let report = slm_validate::validate_bytes(&bytes, &output.display().to_string()).unwrap();
        assert!(report.shape_summary().starts_with("vocab=262,"));
        assert_eq!(bytes[108..112], *b"BPE1");
        provenance::validate_manifest_path(&output, &sidecar_manifest_path(&output)).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn rejects_bpe_source_manifest_without_matching_shape() {
        let dir = temp_path("source-bpe-shape-mismatch");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path)
            .unwrap()
            .replace("tokenizer=byte-v1", "tokenizer=bpe-v1");
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("source manifest model_shape and tokenizer must agree"));
        cleanup(&dir);
    }

    #[test]
    fn rejects_bpe_source_merge_outside_vocab() {
        let dir = temp_path("source-bpe-merge-output");
        write_source_template_path(&dir, "tiny-fixture-bpe").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path)
            .unwrap()
            .replace("bpe.merge.1.output=261", "bpe.merge.1.output=300");
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("inside vocabulary"));
        cleanup(&dir);
    }

    #[test]
    fn rejects_source_checksum_drift() {
        let dir = temp_path("source-drift");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let first_tensor = dir.join("tensors").join("tok_embeddings_weight.f32");
        let mut bytes = fs::read(&first_tensor).unwrap();
        bytes[0] ^= 0x01;
        fs::write(first_tensor, bytes).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        cleanup(&dir);
    }

    #[test]
    fn rejects_non_finite_source_weight() {
        let dir = temp_path("source-nan");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let tensor_file = dir.join("tensors").join("tok_embeddings_weight.f32");
        let mut bytes = fs::read(&tensor_file).unwrap();
        bytes[0..4].copy_from_slice(&f32::NAN.to_le_bytes());
        fs::write(&tensor_file, &bytes).unwrap();
        refresh_manifest_checksum(
            &dir.join(SOURCE_MANIFEST_NAME),
            "tensor.0.checksum",
            source_checksum(&bytes),
        );

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        cleanup(&dir);
    }

    #[test]
    fn source_range_policy_allows_reviewed_norm_scales_but_bounds_matrices() {
        let norm = TensorSpec::f32("norm.weight", &[1], 1);
        validate_raw_f32_tensor_bytes(&192.0f32.to_le_bytes(), &norm, "norm.weight").unwrap();

        let excessive_norm = 256.5f32.to_le_bytes();
        assert!(
            validate_raw_f32_tensor_bytes(&excessive_norm, &norm, "norm.weight")
                .unwrap_err()
                .to_string()
                .contains("absolute limit 256")
        );

        let matrix = TensorSpec::f32("matrix.weight", &[1, 1], 1);
        assert!(
            validate_raw_f32_tensor_bytes(&64.5f32.to_le_bytes(), &matrix, "matrix.weight")
                .unwrap_err()
                .to_string()
                .contains("absolute limit 64")
        );

        let bias = TensorSpec::f32("layers.0.wk.bias", &[1], 1);
        validate_raw_f32_tensor_bytes(&316.0f32.to_le_bytes(), &bias, "layers.0.wk.bias").unwrap();
        assert!(
            validate_raw_f32_tensor_bytes(&1024.5f32.to_le_bytes(), &bias, "layers.0.wk.bias")
                .unwrap_err()
                .to_string()
                .contains("absolute limit 1024")
        );
    }

    #[test]
    fn rejects_source_path_traversal() {
        let dir = temp_path("source-path");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path).unwrap().replace(
            "tensor.0.file=tensors/tok_embeddings_weight.f32",
            "tensor.0.file=../tok_embeddings_weight.f32",
        );
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        cleanup(&dir);
    }

    fn refresh_manifest_checksum(manifest_path: &Path, key: &str, checksum: u64) {
        let mut updated = String::new();
        let prefix = format!("{key}=");
        for line in fs::read_to_string(manifest_path).unwrap().lines() {
            if line.starts_with(&prefix) {
                updated.push_str(&format!("{key}=0x{checksum:016x}\n"));
            } else {
                updated.push_str(line);
                updated.push('\n');
            }
        }
        fs::write(manifest_path, updated).unwrap();
    }

    fn read_u32_le(bytes: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ])
    }

    fn read_u64_le(bytes: &[u8], offset: usize) -> u64 {
        u64::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ])
    }

    fn contains_tensor_hash(bytes: &[u8], hash: u64) -> bool {
        let directory = read_u64_le(bytes, 80) as usize;
        let count = read_u32_le(bytes, 88) as usize;
        (0..count).any(|index| read_u64_le(bytes, directory + index * 64) == hash)
    }

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-{name}-{}-{nanos}", std::process::id()))
    }

    fn one_f32_payloads(shape_name: &str) -> Vec<SourceTensorPayload> {
        source_tensor_expectations(shape_name)
            .unwrap()
            .into_iter()
            .map(|expectation| {
                let mut bytes = Vec::with_capacity(expectation.f32_bytes as usize);
                for _ in 0..(expectation.f32_bytes / 4) {
                    bytes.extend_from_slice(&1.0f32.to_le_bytes());
                }
                SourceTensorPayload {
                    name: expectation.name,
                    bytes,
                }
            })
            .collect()
    }

    fn cleanup(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }
}
