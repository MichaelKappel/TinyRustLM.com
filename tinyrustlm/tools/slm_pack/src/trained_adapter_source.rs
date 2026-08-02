//! Trained low-rank adapter source layout validation.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::adapter::{
    build_low_rank_source_adapter_bytes, low_rank_adapter_apply_status, low_rank_adapter_checksum,
    validate_low_rank_adapter_bytes, LowRankSourceTensor,
};
use crate::blend::{hex64, parse_model_values};
use crate::slm_validate::{self, ValidationReport};
use crate::tensor_writer::{
    tensors_for_shape, tensors_for_shape_with_tied_output, ModelShape, TensorSpec, DTYPE_F32,
};
use crate::tokenizer_writer::TokenizerSection;

const ADAPTER_SOURCE_MANIFEST_NAME: &str = "adapter-source.manifest";
const ADAPTER_SOURCE_VERSION_EXACT: &str = "1";
const ADAPTER_SOURCE_VERSION_BOUNDED: &str = "2";
const ADAPTER_SOURCE_LAYOUT: &str = "low-rank-f32-factor-files-v1";
const ADAPTER_SOURCE_FORMAT: &str = "trained-low-rank-factors-v1";
const SOURCE_ALR1_ARTIFACT_VERSION: &str = "1";
const SOURCE_ALR1_ARTIFACT_KIND: &str = "trained-source-low-rank-f32-v1";
const SOURCE_ALR1_STATUS: &str = "artifact-written";
const SOURCE_ALR1_DTYPE: &str = "low-rank-f32-source-delta";
const SOURCE_ALR1_BASE_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const SOURCE_ALR1_REVIEWED_SOURCE_CONTRACT: &str = "matches-reviewed-adapter-source-base-contract";
const SOURCE_ALR1_REQUIRED_NEXT_GATE: &str =
    "runtime-smoke-plus-eval-plus-selector-adapter-family-route";
const LOW_RANK_PAYLOAD_HEADER_BYTES: usize = 16;
const DEFAULT_FACTOR_RANK: usize = 1;
const MAX_FACTOR_RANK: usize = 8;
const MAX_ABS_FACTOR: f32 = 64.0;
const MAX_ABS_RECONSTRUCTED_DELTA: f32 = 128.0;

struct NamedTensor {
    name: String,
    spec: TensorSpec,
}

struct AdapterSourceBundle {
    manifest_text: String,
    fields: HashMap<String, String>,
    shape: ModelShape,
    tied_output: bool,
    delta_l1_contract: DeltaL1Contract,
    stats: AdapterSourceStats,
    targets: Vec<AdapterSourceTarget>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DeltaL1Contract {
    ExactV1,
    UpperBoundV2,
}

impl DeltaL1Contract {
    fn aggregate_manifest_key(self) -> &'static str {
        match self {
            Self::ExactV1 => "adapter_source_delta_l1_microunits",
            Self::UpperBoundV2 => "adapter_source_delta_l1_upper_bound_microunits",
        }
    }

    fn source_target_manifest_key(self) -> &'static str {
        match self {
            Self::ExactV1 => "delta_l1_microunits",
            Self::UpperBoundV2 => "delta_l1_upper_bound_microunits",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::ExactV1 => "exact-v1",
            Self::UpperBoundV2 => "factor-product-upper-bound-v2",
        }
    }
}

struct AdapterSourceTarget {
    name: String,
    name_hash: u64,
    rank: u32,
    dims: [u32; 4],
    rows: usize,
    cols: usize,
    factor_rank: usize,
    a_values: Vec<f32>,
    b_values: Vec<f32>,
    factor_parameter_count: u64,
    delta_l1_microunits: u64,
}

#[derive(Default)]
struct AdapterSourceStats {
    target_tensor_count: usize,
    target_parameter_count: u64,
    factor_parameter_count: u64,
    delta_l1_microunits: u64,
}

/// Writes a reviewable trained low-rank adapter source fixture directory.
pub fn write_adapter_source_template_path(output_dir: &Path, shape_name: &str) -> io::Result<()> {
    let (shape, tied_output) = shape_for_name(shape_name)?;
    let base_tokenizer = tokenizer_contract_for_shape_name(shape_name)?;
    let targets = default_adapter_targets(&shape, tied_output)?;
    let factor_dir = output_dir.join("factors");
    fs::create_dir_all(&factor_dir)?;

    let mut manifest = String::new();
    push_line(
        &mut manifest,
        "tinyrustlm_trained_adapter_source_version",
        ADAPTER_SOURCE_VERSION_EXACT,
    );
    push_line(&mut manifest, "model_family", "tinyrustlm");
    push_line(
        &mut manifest,
        "adapter_source_layout",
        ADAPTER_SOURCE_LAYOUT,
    );
    push_line(&mut manifest, "adapter_format", ADAPTER_SOURCE_FORMAT);
    push_line(&mut manifest, "model_shape", shape_name);
    push_line(
        &mut manifest,
        "base_tied_output",
        if tied_output { "true" } else { "false" },
    );
    push_line(&mut manifest, "base_tokenizer", base_tokenizer);
    push_line(&mut manifest, "source_dtype", "f32");
    push_line(
        &mut manifest,
        "adapter_source_kind",
        "trained-adapter-fixture",
    );
    push_line(
        &mut manifest,
        "adapter_source_id",
        "tinyrustlm-local-trained-adapter-fixture",
    );
    push_line(
        &mut manifest,
        "adapter_source_license",
        "local-fixture-only",
    );
    push_line(
        &mut manifest,
        "adapter_source_dataset",
        "tinyrustlm-local-adapter-source-fixture",
    );
    push_line(
        &mut manifest,
        "adapter_training_summary",
        "Deterministic low-rank adapter source fixture for intake validation",
    );
    push_shape_lines(&mut manifest, &shape);
    push_line(
        &mut manifest,
        "target_tensor_count",
        &targets.len().to_string(),
    );

    for (index, target) in targets.iter().enumerate() {
        let (rows, cols) = matrix_shape(&target.spec)?;
        let rank = DEFAULT_FACTOR_RANK.min(rows.min(cols));
        let a_values = fixture_a_values(index, rows, rank);
        let b_values = fixture_b_values(index, rank, cols);
        let a_bytes = f32_values_to_bytes(&a_values);
        let b_bytes = f32_values_to_bytes(&b_values);
        let safe_name = factor_file_stem(&target.name);
        let a_file = format!("factors/{safe_name}.A.f32");
        let b_file = format!("factors/{safe_name}.B.f32");
        fs::write(output_dir.join(&a_file), &a_bytes)?;
        fs::write(output_dir.join(&b_file), &b_bytes)?;

        let prefix = format!("target.{index}");
        push_line(&mut manifest, &format!("{prefix}.name"), &target.name);
        push_line(
            &mut manifest,
            &format!("{prefix}.name_hash"),
            &format!("0x{:016x}", target.spec.name_hash),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.rank"),
            &target.spec.rank.to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.dims"),
            &dims_text(&target.spec),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.factor_rank"),
            &rank.to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.a_shape"),
            &format!("{rows},{rank}"),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.b_shape"),
            &format!("{rank},{cols}"),
        );
        push_line(&mut manifest, &format!("{prefix}.a_file"), &a_file);
        push_line(&mut manifest, &format!("{prefix}.b_file"), &b_file);
        push_line(
            &mut manifest,
            &format!("{prefix}.a_bytes"),
            &a_bytes.len().to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.b_bytes"),
            &b_bytes.len().to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.a_checksum"),
            &format!("0x{:016x}", source_checksum(&a_bytes)),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.b_checksum"),
            &format!("0x{:016x}", source_checksum(&b_bytes)),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.factor_parameter_count"),
            &factor_parameter_count(rows, cols, rank)?.to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.delta_l1_microunits"),
            &delta_l1_microunits(&a_values, &b_values, rows, cols, rank)?.to_string(),
        );
    }

    fs::write(output_dir.join(ADAPTER_SOURCE_MANIFEST_NAME), manifest)?;
    println!(
        "SLM trained adapter source template written: {}",
        output_dir.display()
    );
    Ok(())
}

/// Validates a trained low-rank adapter source directory.
pub fn validate_adapter_source_path(source_dir: &Path) -> io::Result<()> {
    let stats = read_adapter_source(source_dir)?;
    println!("SLM trained adapter source validation: PASS");
    println!("adapter_source_dir: {}", source_dir.display());
    println!("target_tensor_count: {}", stats.target_tensor_count);
    println!("target_parameter_count: {}", stats.target_parameter_count);
    println!("factor_parameter_count: {}", stats.factor_parameter_count);
    println!("delta_l1_microunits: {}", stats.delta_l1_microunits);
    Ok(())
}

/// Converts a reviewed trained low-rank adapter source directory into ALR1.
pub fn convert_adapter_source_path(
    source_dir: &Path,
    base_parent: &Path,
    output_adapter: &Path,
    output_manifest: &Path,
) -> io::Result<()> {
    let bundle = read_adapter_source_bundle(source_dir)?;
    let base_bytes = fs::read(base_parent)?;
    let (adapter, manifest) = build_adapter_source_alr1_bytes_and_manifest(
        &bundle,
        &base_bytes,
        &base_parent.display().to_string(),
        &source_dir.display().to_string(),
        &output_adapter.display().to_string(),
    )?;
    if let Some(parent) = output_adapter.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_adapter, adapter)?;
    if let Some(parent) = output_manifest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_manifest, manifest)?;
    println!(
        "SLM trained adapter source ALR1 artifact written: {}",
        output_adapter.display()
    );
    println!(
        "SLM trained adapter source ALR1 manifest written: {}",
        output_manifest.display()
    );
    Ok(())
}

/// Validates a trained adapter source ALR1 artifact by recomputing it.
pub fn validate_converted_adapter_source_path(
    source_dir: &Path,
    base_parent: &Path,
    adapter: &Path,
    manifest: &Path,
) -> io::Result<()> {
    let bundle = read_adapter_source_bundle(source_dir)?;
    let base_bytes = fs::read(base_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_adapter_source_alr1_text(
        &bundle,
        &base_bytes,
        &base_parent.display().to_string(),
        &source_dir.display().to_string(),
        &adapter.display().to_string(),
        &adapter_bytes,
        &manifest_text,
    )?;
    println!("SLM trained adapter source ALR1 validation: PASS");
    println!("adapter_source_dir: {}", source_dir.display());
    println!("base_parent: {}", base_parent.display());
    println!("adapter: {}", adapter.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

fn read_adapter_source(source_dir: &Path) -> io::Result<AdapterSourceStats> {
    Ok(read_adapter_source_bundle(source_dir)?.stats)
}

fn read_adapter_source_bundle(source_dir: &Path) -> io::Result<AdapterSourceBundle> {
    let manifest_path = source_dir.join(ADAPTER_SOURCE_MANIFEST_NAME);
    let manifest = fs::read_to_string(&manifest_path)?;
    let fields = parse_key_value_manifest(&manifest)?;
    let delta_l1_contract = validate_adapter_source_header(&fields)?;
    let (shape, tied_output) = shape_from_fields(&fields)?;
    validate_shape_name_and_tied_output(&fields, &shape, tied_output)?;
    let expected_tensors = named_tensors_for_shape(&shape, tied_output);
    let target_count = parse_usize_key(&fields, "target_tensor_count")?;
    if target_count == 0 {
        return Err(invalid(
            "adapter source requires at least one target tensor",
        ));
    }

    let mut seen = HashSet::new();
    let mut stats = AdapterSourceStats {
        target_tensor_count: target_count,
        ..AdapterSourceStats::default()
    };
    let mut targets = Vec::with_capacity(target_count);
    for index in 0..target_count {
        let prefix = format!("target.{index}");
        let name = require_key(&fields, &format!("{prefix}.name"))?;
        if !seen.insert(name.to_string()) {
            return Err(invalid("adapter source target tensor names must be unique"));
        }
        let expected = expected_tensors
            .iter()
            .find(|tensor| tensor.name == name)
            .ok_or_else(|| invalid("adapter source target tensor is not in the model shape"))?;
        let (rows, cols) = matrix_shape(&expected.spec)?;
        require_equal(
            &fields,
            &format!("{prefix}.name_hash"),
            &format!("0x{:016x}", expected.spec.name_hash),
        )?;
        require_equal(
            &fields,
            &format!("{prefix}.rank"),
            &expected.spec.rank.to_string(),
        )?;
        require_equal(
            &fields,
            &format!("{prefix}.dims"),
            &dims_text(&expected.spec),
        )?;
        let rank = parse_usize_key(&fields, &format!("{prefix}.factor_rank"))?;
        if rank == 0 || rank > MAX_FACTOR_RANK || rank > rows.min(cols) {
            return Err(invalid("adapter source factor_rank is out of range"));
        }
        require_equal(
            &fields,
            &format!("{prefix}.a_shape"),
            &format!("{rows},{rank}"),
        )?;
        require_equal(
            &fields,
            &format!("{prefix}.b_shape"),
            &format!("{rank},{cols}"),
        )?;

        let a_values = read_factor_file(source_dir, &fields, &prefix, "a", rows * rank)?;
        let b_values = read_factor_file(source_dir, &fields, &prefix, "b", rank * cols)?;
        let factor_count = factor_parameter_count(rows, cols, rank)?;
        let delta_l1 = match delta_l1_contract {
            DeltaL1Contract::ExactV1 => {
                delta_l1_microunits(&a_values, &b_values, rows, cols, rank)?
            }
            DeltaL1Contract::UpperBoundV2 => {
                delta_l1_upper_bound_microunits(&a_values, &b_values, rows, cols, rank)?
            }
        };
        require_equal(
            &fields,
            &format!("{prefix}.factor_parameter_count"),
            &factor_count.to_string(),
        )?;
        require_equal(
            &fields,
            &format!(
                "{prefix}.{}",
                delta_l1_contract.source_target_manifest_key()
            ),
            &delta_l1.to_string(),
        )?;
        stats.target_parameter_count = stats
            .target_parameter_count
            .checked_add((rows * cols) as u64)
            .ok_or_else(|| invalid("adapter source target parameter count overflow"))?;
        stats.factor_parameter_count = stats
            .factor_parameter_count
            .checked_add(factor_count)
            .ok_or_else(|| invalid("adapter source factor parameter count overflow"))?;
        stats.delta_l1_microunits = stats
            .delta_l1_microunits
            .checked_add(delta_l1)
            .ok_or_else(|| invalid("adapter source delta L1 count overflow"))?;
        targets.push(AdapterSourceTarget {
            name: name.to_string(),
            name_hash: expected.spec.name_hash,
            rank: expected.spec.rank,
            dims: expected.spec.dims,
            rows,
            cols,
            factor_rank: rank,
            a_values,
            b_values,
            factor_parameter_count: factor_count,
            delta_l1_microunits: delta_l1,
        });
    }
    reject_extra_target_keys(&fields, target_count, delta_l1_contract)?;
    Ok(AdapterSourceBundle {
        manifest_text: manifest,
        fields,
        shape,
        tied_output,
        delta_l1_contract,
        stats,
        targets,
    })
}

fn build_adapter_source_alr1_bytes_and_manifest(
    bundle: &AdapterSourceBundle,
    base_bytes: &[u8],
    base_path: &str,
    source_dir_path: &str,
    adapter_path: &str,
) -> io::Result<(Vec<u8>, String)> {
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let base = parse_model_values(base_bytes)?;
    validate_base_model_for_source(bundle, &base, &base_report)?;
    let source_tensors = bundle
        .targets
        .iter()
        .map(|target| LowRankSourceTensor {
            name_hash: target.name_hash,
            rank: target.rank,
            dims: target.dims,
            rows: target.rows,
            cols: target.cols,
            factor_rank: target.factor_rank,
            a_values: &target.a_values,
            b_values: &target.b_values,
        })
        .collect::<Vec<_>>();
    let adapter = build_low_rank_source_adapter_bytes(&base, &base_report, &source_tensors)?;
    validate_low_rank_adapter_bytes(&adapter)?;
    let manifest = build_adapter_source_alr1_manifest(
        bundle,
        source_dir_path,
        base_path,
        &base_report,
        adapter_path,
        &adapter,
    )?;
    Ok((adapter, manifest))
}

fn validate_adapter_source_alr1_text(
    bundle: &AdapterSourceBundle,
    base_bytes: &[u8],
    base_path: &str,
    source_dir_path: &str,
    adapter_path: &str,
    adapter_bytes: &[u8],
    manifest_text: &str,
) -> io::Result<()> {
    validate_low_rank_adapter_bytes(adapter_bytes)?;
    let (expected_adapter, expected_manifest) = build_adapter_source_alr1_bytes_and_manifest(
        bundle,
        base_bytes,
        base_path,
        source_dir_path,
        adapter_path,
    )?;
    if adapter_bytes != expected_adapter {
        return Err(invalid(
            "trained adapter source ALR1 bytes do not match recomputed source factors",
        ));
    }
    if manifest_text != expected_manifest {
        return Err(invalid(
            "trained adapter source ALR1 manifest fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn validate_base_model_for_source(
    bundle: &AdapterSourceBundle,
    base: &crate::blend::ParsedModel,
    base_report: &ValidationReport,
) -> io::Result<()> {
    if !shape_matches(&bundle.shape, &base.shape) {
        return Err(invalid(
            "adapter source model shape does not match base parent",
        ));
    }
    let base_tied_output = base.flags & 1 != 0;
    if bundle.tied_output != base_tied_output {
        return Err(invalid(
            "adapter source tied-output contract does not match base parent",
        ));
    }
    if base_report.output_contract_label()
        != if bundle.tied_output {
            "tied-output"
        } else {
            "explicit-output"
        }
    {
        return Err(invalid(
            "adapter source output contract does not match base parent",
        ));
    }
    match require_key(&bundle.fields, "base_tokenizer")? {
        "byte-v1" if base.tokenizer.bytes == TokenizerSection::phase_one().bytes => {}
        "inherit-from-base-parent"
            if inherited_smollm_tokenizer_matches(base_report.tokenizer_label()) => {}
        _ => {
            return Err(invalid(
                "adapter source base_tokenizer does not match base parent tokenizer",
            ))
        }
    }
    let base_by_hash = base
        .tensors
        .iter()
        .map(|tensor| (tensor.spec.name_hash, tensor))
        .collect::<HashMap<_, _>>();
    for target in &bundle.targets {
        let Some(base_tensor) = base_by_hash.get(&target.name_hash) else {
            return Err(invalid(
                "adapter source target tensor is missing from base parent",
            ));
        };
        if base_tensor.spec.rank != target.rank || base_tensor.spec.dims != target.dims {
            return Err(invalid(
                "adapter source target tensor shape does not match base parent",
            ));
        }
    }
    Ok(())
}

fn inherited_smollm_tokenizer_matches(tokenizer_label: &str) -> bool {
    matches!(tokenizer_label, "bpe-v1" | "gpt2-bpe-v1")
}

fn build_adapter_source_alr1_manifest(
    bundle: &AdapterSourceBundle,
    source_dir_path: &str,
    base_path: &str,
    base_report: &ValidationReport,
    adapter_path: &str,
    adapter_bytes: &[u8],
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_artifact_version",
        SOURCE_ALR1_ARTIFACT_VERSION,
    );
    push_line(
        &mut text,
        "adapter_artifact_kind",
        SOURCE_ALR1_ARTIFACT_KIND,
    );
    push_line(&mut text, "adapter_status", SOURCE_ALR1_STATUS);
    push_line(&mut text, "adapter_source_dir", source_dir_path);
    push_line(
        &mut text,
        "adapter_source_manifest",
        ADAPTER_SOURCE_MANIFEST_NAME,
    );
    push_line(
        &mut text,
        "adapter_source_manifest_checksum",
        &hex64(source_checksum(bundle.manifest_text.as_bytes())),
    );
    push_line(&mut text, "adapter_source_layout", ADAPTER_SOURCE_LAYOUT);
    push_line(&mut text, "adapter_source_format", ADAPTER_SOURCE_FORMAT);
    push_line(
        &mut text,
        "adapter_source_base_tokenizer_contract",
        require_key(&bundle.fields, "base_tokenizer")?,
    );
    push_line(
        &mut text,
        "adapter_source_kind",
        require_key(&bundle.fields, "adapter_source_kind")?,
    );
    push_line(
        &mut text,
        "adapter_source_id",
        require_key(&bundle.fields, "adapter_source_id")?,
    );
    push_line(
        &mut text,
        "adapter_source_license",
        require_key(&bundle.fields, "adapter_source_license")?,
    );
    push_line(
        &mut text,
        "adapter_source_dataset",
        require_key(&bundle.fields, "adapter_source_dataset")?,
    );
    push_line(
        &mut text,
        "adapter_training_summary",
        require_key(&bundle.fields, "adapter_training_summary")?,
    );
    push_line(&mut text, "base_parent_path", base_path);
    push_line(
        &mut text,
        "base_model_bytes",
        &base_report.file_bytes().to_string(),
    );
    push_line(
        &mut text,
        "base_slm_version",
        &base_report.slm_version().to_string(),
    );
    push_line(
        &mut text,
        "base_slm_checksum",
        &hex64(base_report.checksum()),
    );
    push_line(&mut text, "base_model_shape", &base_report.shape_summary());
    push_line(
        &mut text,
        "base_tensor_count",
        &base_report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "base_parameter_count",
        &base_report.parameter_count().to_string(),
    );
    push_line(
        &mut text,
        "base_quantization",
        base_report.quantization_label(),
    );
    push_line(
        &mut text,
        "base_output_contract",
        base_report.output_contract_label(),
    );
    push_line(
        &mut text,
        "base_tokenizer_checksum",
        &hex64(base_report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "base_tensor_layout_checksum",
        &hex64(base_report.tensor_layout_checksum()),
    );
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(low_rank_adapter_checksum(adapter_bytes)?),
    );
    push_line(
        &mut text,
        "adapter_tensor_count",
        &base_report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "adapter_parameter_count",
        &base_report.parameter_count().to_string(),
    );
    push_line(&mut text, "adapter_dtype", SOURCE_ALR1_DTYPE);
    push_line(
        &mut text,
        "adapter_model_shape",
        &base_report.shape_summary(),
    );
    push_line(
        &mut text,
        "adapter_base_quantization",
        base_report.quantization_label(),
    );
    push_line(
        &mut text,
        "adapter_output_contract",
        base_report.output_contract_label(),
    );
    push_line(
        &mut text,
        "adapter_tokenizer_checksum",
        &hex64(base_report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "adapter_tensor_layout_checksum",
        &hex64(base_report.tensor_layout_checksum()),
    );
    push_line(
        &mut text,
        "adapter_base_contract",
        SOURCE_ALR1_BASE_CONTRACT,
    );
    push_line(
        &mut text,
        "adapter_source_base_contract",
        SOURCE_ALR1_REVIEWED_SOURCE_CONTRACT,
    );
    push_line(&mut text, "adapter_low_rank_format", "ALR1");
    push_line(
        &mut text,
        "adapter_low_rank_component_cap",
        &MAX_FACTOR_RANK.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_payload_header_bytes",
        &LOW_RANK_PAYLOAD_HEADER_BYTES.to_string(),
    );
    push_line(&mut text, "adapter_low_rank_factor_dtype", "f32");
    push_line(
        &mut text,
        "adapter_low_rank_selection",
        "reviewed-trained-source-factors",
    );
    push_line(
        &mut text,
        "adapter_low_rank_scope",
        "adapter-source-target-matrix-tensors",
    );
    push_line(
        &mut text,
        "adapter_source_target_tensor_count",
        &bundle.stats.target_tensor_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_source_target_parameter_count",
        &bundle.stats.target_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_active_tensor_count",
        &bundle.stats.target_tensor_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_component_count",
        &source_component_count(bundle)?.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_factor_parameter_count",
        &bundle.stats.factor_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_factor_density_ppm",
        &ratio_ppm(
            bundle.stats.factor_parameter_count,
            bundle.stats.target_parameter_count,
        )?
        .to_string(),
    );
    push_line(
        &mut text,
        "adapter_source_delta_l1_contract",
        bundle.delta_l1_contract.label(),
    );
    push_line(
        &mut text,
        bundle.delta_l1_contract.aggregate_manifest_key(),
        &bundle.stats.delta_l1_microunits.to_string(),
    );
    for (index, target) in bundle.targets.iter().enumerate() {
        let prefix = format!("source_target.{index}");
        push_line(&mut text, &format!("{prefix}.name"), &target.name);
        push_line(
            &mut text,
            &format!("{prefix}.name_hash"),
            &hex64(target.name_hash),
        );
        push_line(
            &mut text,
            &format!("{prefix}.factor_rank"),
            &target.factor_rank.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.factor_parameter_count"),
            &target.factor_parameter_count.to_string(),
        );
        push_line(
            &mut text,
            &format!(
                "{prefix}.{}",
                bundle.delta_l1_contract.source_target_manifest_key()
            ),
            &target.delta_l1_microunits.to_string(),
        );
    }
    push_line(
        &mut text,
        "adapter_apply_status",
        low_rank_adapter_apply_status(base_report),
    );
    push_line(
        &mut text,
        "required_next_gate",
        SOURCE_ALR1_REQUIRED_NEXT_GATE,
    );
    Ok(text)
}

fn source_component_count(bundle: &AdapterSourceBundle) -> io::Result<u64> {
    bundle.targets.iter().try_fold(0u64, |acc, target| {
        acc.checked_add(target.factor_rank as u64)
            .ok_or_else(|| invalid("adapter source component count overflow"))
    })
}

fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u32> {
    if denominator == 0 {
        return Ok(0);
    }
    let scaled = (u128::from(numerator) * 1_000_000u128) / u128::from(denominator);
    if scaled > u128::from(u32::MAX) {
        return Err(invalid("adapter source ratio ppm overflow"));
    }
    Ok(scaled as u32)
}

fn validate_adapter_source_header(fields: &HashMap<String, String>) -> io::Result<DeltaL1Contract> {
    let delta_l1_contract = match require_key(fields, "tinyrustlm_trained_adapter_source_version")?
    {
        ADAPTER_SOURCE_VERSION_EXACT => DeltaL1Contract::ExactV1,
        ADAPTER_SOURCE_VERSION_BOUNDED => DeltaL1Contract::UpperBoundV2,
        _ => return Err(invalid("unsupported trained adapter source version")),
    };
    require_equal(fields, "model_family", "tinyrustlm")?;
    require_equal(fields, "adapter_source_layout", ADAPTER_SOURCE_LAYOUT)?;
    require_equal(fields, "adapter_format", ADAPTER_SOURCE_FORMAT)?;
    validate_shape_name_and_tokenizer_contract(fields)?;
    require_equal(fields, "source_dtype", "f32")?;
    match require_key(fields, "adapter_source_kind")? {
        "trained-adapter-fixture" | "trained-adapter-export" => {}
        _ => {
            return Err(invalid(
                "adapter_source_kind must be trained-adapter-fixture or trained-adapter-export",
            ));
        }
    }
    require_evidence_field(fields, "adapter_source_id")?;
    require_evidence_field(fields, "adapter_source_license")?;
    require_evidence_field(fields, "adapter_source_dataset")?;
    require_evidence_field(fields, "adapter_training_summary")?;
    Ok(delta_l1_contract)
}

fn shape_for_name(shape_name: &str) -> io::Result<(ModelShape, bool)> {
    match shape_name {
        "tiny-fixture" => Ok((ModelShape::tiny_fixture(), false)),
        "tiny-fixture-tied" => Ok((ModelShape::tiny_fixture(), true)),
        "tinylm16" => Ok((ModelShape::tinylm16(), false)),
        "tinylm16-tied" => Ok((ModelShape::tinylm16(), true)),
        "smollm2-135m-instruct-bpe" => Ok((ModelShape::smollm2_135m_instruct(), true)),
        "smollm2-360m-instruct-bpe" => Ok((ModelShape::smollm2_360m_instruct(), true)),
        "qwen3-0.6b-bpe" => Ok((ModelShape::qwen3_0_6b(), true)),
        _ => Err(invalid(
            "adapter-source-template shape must be tiny-fixture, tiny-fixture-tied, tinylm16, tinylm16-tied, smollm2-135m-instruct-bpe, smollm2-360m-instruct-bpe, or qwen3-0.6b-bpe",
        )),
    }
}

fn tokenizer_contract_for_shape_name(shape_name: &str) -> io::Result<&'static str> {
    match shape_name {
        "tiny-fixture" | "tiny-fixture-tied" | "tinylm16" | "tinylm16-tied" => Ok("byte-v1"),
        "smollm2-135m-instruct-bpe" | "smollm2-360m-instruct-bpe" | "qwen3-0.6b-bpe" => {
            Ok("inherit-from-base-parent")
        }
        _ => Err(invalid("adapter source model_shape is not supported")),
    }
}

fn validate_shape_name_and_tokenizer_contract(fields: &HashMap<String, String>) -> io::Result<()> {
    let shape_name = require_key(fields, "model_shape")?;
    let expected = tokenizer_contract_for_shape_name(shape_name)?;
    require_equal(fields, "base_tokenizer", expected)
}

fn shape_from_fields(fields: &HashMap<String, String>) -> io::Result<(ModelShape, bool)> {
    let shape_name = require_key(fields, "model_shape")?;
    let (expected_shape, _) = shape_for_name(shape_name)?;
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
        rope_theta: parse_positive_f32_key_or(fields, "rope_theta", expected_shape.rope_theta)?,
        rms_norm_epsilon: parse_positive_f32_key_or(
            fields,
            "rms_norm_epsilon",
            expected_shape.rms_norm_epsilon,
        )?,
    };
    if shape.vocab_size < 260 || shape.special_token_count < 4 {
        return Err(invalid(
            "adapter source shape must provide the required tokenizer vocabulary and special tokens",
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
        return Err(invalid("adapter source shape dimensions must be nonzero"));
    }
    shape
        .head_count
        .checked_mul(shape.head_dim)
        .ok_or_else(|| invalid("adapter source query width overflow"))?;
    if shape.kv_head_count > shape.head_count
        || !shape.head_count.is_multiple_of(shape.kv_head_count)
    {
        return Err(invalid(
            "adapter source kv_head_count must divide head_count",
        ));
    }
    let tied_output = match fields.get("base_tied_output").map(String::as_str) {
        Some("true") => true,
        Some("false") => false,
        _ => {
            return Err(invalid(
                "adapter source base_tied_output must be true or false",
            ));
        }
    };
    Ok((shape, tied_output))
}

fn validate_shape_name_and_tied_output(
    fields: &HashMap<String, String>,
    shape: &ModelShape,
    tied_output: bool,
) -> io::Result<()> {
    let shape_name = require_key(fields, "model_shape")?;
    let (expected_shape, expected_tied) = shape_for_name(shape_name)?;
    if !shape_matches(shape, &expected_shape) || tied_output != expected_tied {
        return Err(invalid(
            "adapter source model_shape and base_tied_output must match dimensions",
        ));
    }
    Ok(())
}

fn default_adapter_targets(shape: &ModelShape, tied_output: bool) -> io::Result<Vec<NamedTensor>> {
    let mut selected = Vec::new();
    for target_name in ["layers.0.wq.weight", "layers.0.w1.weight"] {
        let tensor = named_tensors_for_shape(shape, tied_output)
            .into_iter()
            .find(|entry| entry.name == target_name)
            .ok_or_else(|| invalid("adapter source template target tensor is missing"))?;
        selected.push(tensor);
    }
    Ok(selected)
}

fn named_tensors_for_shape(shape: &ModelShape, tied_output: bool) -> Vec<NamedTensor> {
    let tensors = if tied_output {
        tensors_for_shape_with_tied_output(shape, DTYPE_F32)
    } else {
        tensors_for_shape(shape, DTYPE_F32)
    };
    tensor_names_for_shape(shape, tied_output)
        .into_iter()
        .zip(tensors)
        .map(|(name, spec)| NamedTensor { name, spec })
        .collect()
}

fn tensor_names_for_shape(shape: &ModelShape, tied_output: bool) -> Vec<String> {
    let mut names = vec![
        "tok_embeddings.weight".to_string(),
        "norm.weight".to_string(),
    ];
    if !tied_output {
        names.push("output.weight".to_string());
    }
    for layer in 0..shape.layer_count {
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
            names.push(format!("layers.{layer}.{suffix}"));
        }
    }
    names
}

fn read_factor_file(
    source_dir: &Path,
    fields: &HashMap<String, String>,
    prefix: &str,
    side: &str,
    expected_values: usize,
) -> io::Result<Vec<f32>> {
    let relative_file = require_key(fields, &format!("{prefix}.{side}_file"))?;
    let path = safe_factor_path(source_dir, relative_file)?;
    let bytes = fs::read(&path)?;
    require_equal(
        fields,
        &format!("{prefix}.{side}_bytes"),
        &bytes.len().to_string(),
    )?;
    require_equal(
        fields,
        &format!("{prefix}.{side}_checksum"),
        &format!("0x{:016x}", source_checksum(&bytes)),
    )?;
    read_f32_values(&bytes, expected_values)
}

fn read_f32_values(bytes: &[u8], expected_values: usize) -> io::Result<Vec<f32>> {
    let expected_bytes = expected_values
        .checked_mul(4)
        .ok_or_else(|| invalid("adapter source factor byte length overflow"))?;
    if bytes.len() != expected_bytes {
        return Err(invalid(
            "adapter source factor byte length does not match shape",
        ));
    }
    let mut values = Vec::with_capacity(expected_values);
    let mut any_nonzero = false;
    for chunk in bytes.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() {
            return Err(invalid(
                "adapter source factor contains a non-finite f32 value",
            ));
        }
        if value.abs() > MAX_ABS_FACTOR {
            return Err(invalid(
                "adapter source factor contains an out-of-range f32 value",
            ));
        }
        any_nonzero |= value != 0.0;
        values.push(value);
    }
    if !any_nonzero {
        return Err(invalid("adapter source factor must not be entirely zero"));
    }
    Ok(values)
}

fn delta_l1_microunits(
    a_values: &[f32],
    b_values: &[f32],
    rows: usize,
    cols: usize,
    rank: usize,
) -> io::Result<u64> {
    let mut total = 0.0f64;
    for row in 0..rows {
        for col in 0..cols {
            let mut value = 0.0f32;
            for component in 0..rank {
                value += a_values[row * rank + component] * b_values[component * cols + col];
            }
            if !value.is_finite() {
                return Err(invalid("adapter source reconstructed delta is not finite"));
            }
            if value.abs() > MAX_ABS_RECONSTRUCTED_DELTA {
                return Err(invalid(
                    "adapter source reconstructed delta is out of range",
                ));
            }
            total += f64::from(value.abs());
        }
    }
    let scaled = (total * 1_000_000.0).round();
    if !scaled.is_finite() || scaled < 0.0 || scaled > u64::MAX as f64 {
        return Err(invalid("adapter source delta L1 value overflow"));
    }
    Ok(scaled as u64)
}

fn delta_l1_upper_bound_microunits(
    a_values: &[f32],
    b_values: &[f32],
    rows: usize,
    cols: usize,
    rank: usize,
) -> io::Result<u64> {
    let mut l1_bound = 0.0f64;
    let mut max_abs_bound = 0.0f64;
    for component in 0..rank {
        let mut a_l1 = 0.0f64;
        let mut b_l1 = 0.0f64;
        let mut a_max = 0.0f64;
        let mut b_max = 0.0f64;
        for row in 0..rows {
            let value = f64::from(a_values[row * rank + component].abs());
            a_l1 += value;
            a_max = a_max.max(value);
        }
        for col in 0..cols {
            let value = f64::from(b_values[component * cols + col].abs());
            b_l1 += value;
            b_max = b_max.max(value);
        }
        l1_bound += a_l1 * b_l1;
        max_abs_bound += a_max * b_max;
    }
    if !l1_bound.is_finite() || !max_abs_bound.is_finite() {
        return Err(invalid("adapter source delta upper bound is not finite"));
    }
    if max_abs_bound > f64::from(MAX_ABS_RECONSTRUCTED_DELTA) {
        return Err(invalid(
            "adapter source reconstructed delta upper bound is out of range",
        ));
    }
    let scaled = (l1_bound * 1_000_000.0).ceil();
    if scaled < 0.0 || scaled > u64::MAX as f64 {
        return Err(invalid("adapter source delta L1 upper bound overflow"));
    }
    Ok(scaled as u64)
}

fn factor_parameter_count(rows: usize, cols: usize, rank: usize) -> io::Result<u64> {
    let total = rows
        .checked_mul(rank)
        .and_then(|left| {
            rank.checked_mul(cols)
                .and_then(|right| left.checked_add(right))
        })
        .ok_or_else(|| invalid("adapter source factor parameter count overflow"))?;
    Ok(total as u64)
}

fn matrix_shape(spec: &TensorSpec) -> io::Result<(usize, usize)> {
    if spec.rank < 2 {
        return Err(invalid("adapter source target tensor must be a matrix"));
    }
    let rows = spec.dims[0] as usize;
    if rows == 0 {
        return Err(invalid("adapter source matrix row count is zero"));
    }
    let mut cols = 1usize;
    for dim in spec.dims.iter().take(spec.rank as usize).skip(1) {
        if *dim == 0 {
            return Err(invalid("adapter source matrix column dimension is zero"));
        }
        cols = cols
            .checked_mul(*dim as usize)
            .ok_or_else(|| invalid("adapter source matrix column count overflow"))?;
    }
    Ok((rows, cols))
}

fn safe_factor_path(source_dir: &Path, relative_file: &str) -> io::Result<PathBuf> {
    let path = Path::new(relative_file);
    if path.is_absolute() {
        return Err(invalid("adapter source factor file path must be relative"));
    }
    let mut components = path.components();
    match components.next() {
        Some(Component::Normal(first)) if first == "factors" => {}
        _ => {
            return Err(invalid(
                "adapter source factor files must live under factors/",
            ))
        }
    }
    for component in components {
        match component {
            Component::Normal(_) => {}
            _ => return Err(invalid("adapter source factor file path is not safe")),
        }
    }
    Ok(source_dir.join(path))
}

fn reject_extra_target_keys(
    fields: &HashMap<String, String>,
    target_count: usize,
    delta_l1_contract: DeltaL1Contract,
) -> io::Result<()> {
    for key in fields.keys() {
        if let Some(rest) = key.strip_prefix("target.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("adapter source key {key} is malformed")));
            };
            let index = index_text
                .parse::<usize>()
                .map_err(|_| invalid(&format!("adapter source key {key} has invalid index")))?;
            if index >= target_count {
                return Err(invalid(&format!(
                    "adapter source key {key} is outside declared target_tensor_count"
                )));
            }
            match field_name {
                "name"
                | "name_hash"
                | "rank"
                | "dims"
                | "factor_rank"
                | "a_shape"
                | "b_shape"
                | "a_file"
                | "b_file"
                | "a_bytes"
                | "b_bytes"
                | "a_checksum"
                | "b_checksum"
                | "factor_parameter_count" => {}
                field if field == delta_l1_contract.source_target_manifest_key() => {}
                _ => {
                    return Err(invalid(&format!(
                        "adapter source key {key} has unknown field"
                    )));
                }
            }
        }
    }
    Ok(())
}

fn fixture_a_values(target_index: usize, rows: usize, rank: usize) -> Vec<f32> {
    let mut values = Vec::with_capacity(rows * rank);
    for row in 0..rows {
        for component in 0..rank {
            let seed = (target_index + 1) as f32 * 0.00025;
            values.push(seed * (row as f32 + 1.0) * (component as f32 + 1.0));
        }
    }
    values
}

fn fixture_b_values(target_index: usize, rank: usize, cols: usize) -> Vec<f32> {
    let mut values = Vec::with_capacity(rank * cols);
    for component in 0..rank {
        for col in 0..cols {
            let seed = (target_index + 1) as f32 * 0.0001;
            let sign = if col % 2 == 0 { 1.0 } else { -1.0 };
            values.push(sign * seed * (component as f32 + 1.0) * (col as f32 + 1.0));
        }
    }
    values
}

fn f32_values_to_bytes(values: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for value in values {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes
}

fn factor_file_stem(name: &str) -> String {
    let mut file = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            file.push(ch);
        } else {
            file.push('_');
        }
    }
    file
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

fn parse_key_value_manifest(text: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "adapter source manifest line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            return Err(invalid(&format!(
                "adapter source manifest line {} has an empty key or value",
                line_index + 1
            )));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!(
                "duplicate adapter source manifest key {key}"
            )));
        }
    }
    Ok(fields)
}

fn require_evidence_field(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    if value == "pending" || value == "not-reviewed" || value == "not-provided" || value.len() < 8 {
        return Err(invalid(&format!(
            "adapter source field {key} must contain reviewed routing evidence"
        )));
    }
    Ok(())
}

fn parse_u32_key(fields: &HashMap<String, String>, key: &str) -> io::Result<u32> {
    require_key(fields, key)?
        .parse::<u32>()
        .map_err(|_| invalid(&format!("adapter source manifest key {key} must be a u32")))
}

fn parse_positive_f32_key_or(
    fields: &HashMap<String, String>,
    key: &str,
    fallback: f32,
) -> io::Result<f32> {
    let value = match fields.get(key) {
        Some(raw) => raw
            .parse::<f32>()
            .map_err(|_| invalid(&format!("adapter source manifest key {key} must be an f32")))?,
        None => fallback,
    };
    if !value.is_finite() || value <= 0.0 {
        return Err(invalid(&format!(
            "adapter source manifest key {key} must be finite and greater than zero"
        )));
    }
    Ok(value)
}

fn parse_usize_key(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    require_key(fields, key)?.parse::<usize>().map_err(|_| {
        invalid(&format!(
            "adapter source manifest key {key} must be a usize"
        ))
    })
}

fn require_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields.get(key).map(String::as_str).ok_or_else(|| {
        invalid(&format!(
            "adapter source manifest missing required key {key}"
        ))
    })
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "adapter source manifest key {key} was {actual}, expected {expected}"
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
    use crate::build_model_file_with_flags;
    use crate::tensor_writer::{
        name_hash, tensors_for_shape, tensors_for_shape_with_tied_output, DTYPE_Q8_0,
    };

    #[test]
    fn validates_generated_adapter_source_fixture() {
        let dir = temp_path("adapter-source-fixture");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();

        let manifest = fs::read_to_string(dir.join(ADAPTER_SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("adapter_source_layout=low-rank-f32-factor-files-v1"));
        assert!(manifest.contains("adapter_format=trained-low-rank-factors-v1"));
        assert!(manifest.contains("rope_theta=10000\n"));
        assert!(manifest.contains("rms_norm_epsilon=0.00001\n"));
        assert!(manifest.contains("target.0.name=layers.0.wq.weight"));
        assert!(manifest.contains("target.1.name=layers.0.w1.weight"));
        validate_adapter_source_path(&dir).unwrap();
    }

    #[test]
    fn validates_tied_adapter_source_fixture_without_output_tensor() {
        let dir = temp_path("adapter-source-tied-fixture");
        write_adapter_source_template_path(&dir, "tiny-fixture-tied").unwrap();

        let manifest = fs::read_to_string(dir.join(ADAPTER_SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-tied"));
        assert!(manifest.contains("base_tied_output=true"));
        assert!(!manifest.contains("target.0.name=output.weight"));
        validate_adapter_source_path(&dir).unwrap();
    }

    #[test]
    fn validates_smollm2_bpe_adapter_source_contract() {
        let dir = temp_path("adapter-source-smollm2-bpe");
        write_adapter_source_template_path(&dir, "smollm2-135m-instruct-bpe").unwrap();

        let manifest_path = dir.join(ADAPTER_SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("model_shape=smollm2-135m-instruct-bpe"));
        assert!(manifest.contains("base_tied_output=true"));
        assert!(manifest.contains("base_tokenizer=inherit-from-base-parent"));
        assert!(manifest.contains("vocab_size=49152\n"));
        assert!(manifest.contains("rope_theta=100000\n"));
        validate_adapter_source_path(&dir).unwrap();
    }

    #[test]
    fn validates_qwen3_adapter_source_with_wide_query_projection() {
        let dir = temp_path("adapter-source-qwen3-bpe");
        write_adapter_source_template_path(&dir, "qwen3-0.6b-bpe").unwrap();

        let manifest = fs::read_to_string(dir.join(ADAPTER_SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=qwen3-0.6b-bpe"));
        assert!(manifest.contains("base_tied_output=true"));
        assert!(manifest.contains("base_tokenizer=inherit-from-base-parent"));
        assert!(manifest.contains("vocab_size=151936\n"));
        assert!(manifest.contains("max_context=1024\n"));
        assert!(manifest.contains("target.0.name=layers.0.wq.weight"));
        assert!(manifest.contains("target.0.dims=2048,1024"));
        validate_adapter_source_path(&dir).unwrap();
    }

    #[test]
    fn validates_bounded_v2_adapter_source_without_dense_reconstruction() {
        let dir = temp_path("adapter-source-bounded-v2");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        upgrade_source_manifest_to_bounded_v2(&dir);

        validate_adapter_source_path(&dir).unwrap();

        let base_path = dir.join("base.slm");
        write_tiny_base(&base_path, DTYPE_F32, false);
        let adapter_path = dir.join("source.alr1");
        let output_manifest = dir.join("source.alr1.manifest");
        convert_adapter_source_path(&dir, &base_path, &adapter_path, &output_manifest).unwrap();
        let manifest = fs::read_to_string(output_manifest).unwrap();
        assert!(manifest.contains("adapter_source_delta_l1_contract=factor-product-upper-bound-v2"));
        assert!(manifest.contains("adapter_source_delta_l1_upper_bound_microunits="));
        assert!(manifest.contains("source_target.0.delta_l1_upper_bound_microunits="));
        assert!(!manifest.contains("source_target.0.delta_l1_microunits="));
    }

    #[test]
    fn bounded_v2_l1_metric_is_a_conservative_upper_bound() {
        let a = [1.0, -2.0, 3.0, 4.0];
        let b = [5.0, -6.0, 7.0, 8.0];
        let exact = delta_l1_microunits(&a, &b, 2, 2, 2).unwrap();
        let bound = delta_l1_upper_bound_microunits(&a, &b, 2, 2, 2).unwrap();

        assert_eq!(exact, 88_000_000);
        assert_eq!(bound, 134_000_000);
        assert!(bound >= exact);
    }

    #[test]
    fn rejects_smollm2_adapter_source_with_byte_tokenizer_contract() {
        let dir = temp_path("adapter-source-smollm2-wrong-tokenizer");
        write_adapter_source_template_path(&dir, "smollm2-135m-instruct-bpe").unwrap();
        let manifest_path = dir.join(ADAPTER_SOURCE_MANIFEST_NAME);
        replace_manifest_value(&manifest_path, "base_tokenizer", "byte-v1");

        let error = validate_adapter_source_path(&dir).unwrap_err();
        assert!(error.to_string().contains("base_tokenizer"));
    }

    #[test]
    fn smollm2_inherited_tokenizer_accepts_gpt2_and_legacy_bpe_only() {
        assert!(inherited_smollm_tokenizer_matches("gpt2-bpe-v1"));
        assert!(inherited_smollm_tokenizer_matches("bpe-v1"));
        assert!(!inherited_smollm_tokenizer_matches("llama-bpe-v1"));
        assert!(!inherited_smollm_tokenizer_matches("byte-v1"));
    }

    #[test]
    fn converts_adapter_source_to_alr1_fixture() {
        let dir = temp_path("adapter-source-alr1-fixture");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        let base_path = dir.join("base.slm");
        write_tiny_base(&base_path, DTYPE_F32, false);
        let adapter_path = dir.join("source.alr1");
        let manifest_path = dir.join("source.alr1.manifest");

        convert_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path).unwrap();

        let adapter = fs::read(&adapter_path).unwrap();
        assert_eq!(adapter.get(0..4), Some(&b"ALR1"[..]));
        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("adapter_artifact_kind=trained-source-low-rank-f32-v1"));
        assert!(manifest.contains("adapter_dtype=low-rank-f32-source-delta"));
        assert!(manifest.contains("adapter_source_base_tokenizer_contract=byte-v1"));
        assert!(manifest.contains("adapter_source_manifest_checksum=0x"));
        assert!(manifest.contains("source_target.0.name=layers.0.wq.weight"));
        validate_converted_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path)
            .unwrap();
    }

    #[test]
    fn converts_adapter_source_to_quantized_base_alr1_fixture() {
        let dir = temp_path("adapter-source-q8-alr1-fixture");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        let base_path = dir.join("base-q8.slm");
        write_tiny_base(&base_path, DTYPE_Q8_0, false);
        let adapter_path = dir.join("source-q8.alr1");
        let manifest_path = dir.join("source-q8.alr1.manifest");

        convert_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path).unwrap();

        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("base_quantization=q8_0"));
        assert!(manifest.contains("adapter_apply_status=runtime-q8-q4-compatible-low-rank"));
        validate_converted_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path)
            .unwrap();
    }

    #[test]
    fn rejects_adapter_source_alr1_base_contract_mismatch() {
        let dir = temp_path("adapter-source-alr1-base-mismatch");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        let base_path = dir.join("base-tied.slm");
        write_tiny_base(&base_path, DTYPE_F32, true);
        let adapter_path = dir.join("source.alr1");
        let manifest_path = dir.join("source.alr1.manifest");

        let error = convert_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path)
            .unwrap_err();
        assert!(error.to_string().contains("tied-output contract"));
    }

    #[test]
    fn rejects_adapter_source_alr1_artifact_drift() {
        let dir = temp_path("adapter-source-alr1-drift");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        let base_path = dir.join("base.slm");
        write_tiny_base(&base_path, DTYPE_F32, false);
        let adapter_path = dir.join("source.alr1");
        let manifest_path = dir.join("source.alr1.manifest");
        convert_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path).unwrap();

        let mut adapter = fs::read(&adapter_path).unwrap();
        let last = adapter.len() - 1;
        adapter[last] ^= 0x01;
        fs::write(&adapter_path, adapter).unwrap();

        let error =
            validate_converted_adapter_source_path(&dir, &base_path, &adapter_path, &manifest_path)
                .unwrap_err();
        assert!(error.to_string().contains("checksum mismatch"));
    }

    #[test]
    fn rejects_adapter_source_checksum_drift() {
        let dir = temp_path("adapter-source-checksum-drift");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();

        let manifest = fs::read_to_string(dir.join(ADAPTER_SOURCE_MANIFEST_NAME)).unwrap();
        let a_file = manifest
            .lines()
            .find_map(|line| line.strip_prefix("target.0.a_file="))
            .unwrap();
        let path = dir.join(a_file);
        let mut bytes = fs::read(&path).unwrap();
        bytes[0] ^= 0x01;
        fs::write(path, bytes).unwrap();

        let error = validate_adapter_source_path(&dir).unwrap_err();
        assert!(error.to_string().contains("target.0.a_checksum"));
    }

    #[test]
    fn rejects_adapter_source_path_escape() {
        let dir = temp_path("adapter-source-path-escape");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        replace_manifest_value(
            &dir.join(ADAPTER_SOURCE_MANIFEST_NAME),
            "target.0.a_file",
            "factors/../outside.f32",
        );

        let error = validate_adapter_source_path(&dir).unwrap_err();
        assert!(error.to_string().contains("factor file path is not safe"));
    }

    #[test]
    fn rejects_non_finite_adapter_source_factor() {
        let dir = temp_path("adapter-source-non-finite");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(ADAPTER_SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path).unwrap();
        let a_file = manifest
            .lines()
            .find_map(|line| line.strip_prefix("target.0.a_file="))
            .unwrap();
        let path = dir.join(a_file);
        let mut bytes = fs::read(&path).unwrap();
        bytes[0..4].copy_from_slice(&f32::NAN.to_le_bytes());
        fs::write(&path, &bytes).unwrap();
        replace_manifest_value(
            &manifest_path,
            "target.0.a_checksum",
            &format!("0x{:016x}", source_checksum(&bytes)),
        );

        let error = validate_adapter_source_path(&dir).unwrap_err();
        assert!(error.to_string().contains("non-finite"));
    }

    fn replace_manifest_value(path: &Path, key: &str, value: &str) {
        let text = fs::read_to_string(path).unwrap();
        let mut updated = String::new();
        for line in text.lines() {
            if line.starts_with(&format!("{key}=")) {
                updated.push_str(key);
                updated.push('=');
                updated.push_str(value);
                updated.push('\n');
            } else {
                updated.push_str(line);
                updated.push('\n');
            }
        }
        fs::write(path, updated).unwrap();
    }

    fn upgrade_source_manifest_to_bounded_v2(dir: &Path) {
        let path = dir.join(ADAPTER_SOURCE_MANIFEST_NAME);
        let text = fs::read_to_string(&path).unwrap();
        let fields = parse_key_value_manifest(&text).unwrap();
        let count = parse_usize_key(&fields, "target_tensor_count").unwrap();
        let mut bounds = HashMap::new();
        for index in 0..count {
            let prefix = format!("target.{index}");
            let a_shape = require_key(&fields, &format!("{prefix}.a_shape")).unwrap();
            let b_shape = require_key(&fields, &format!("{prefix}.b_shape")).unwrap();
            let a_dims = a_shape
                .split(',')
                .map(|value| value.parse::<usize>().unwrap())
                .collect::<Vec<_>>();
            let b_dims = b_shape
                .split(',')
                .map(|value| value.parse::<usize>().unwrap())
                .collect::<Vec<_>>();
            let rows = a_dims[0];
            let rank = a_dims[1];
            let cols = b_dims[1];
            assert_eq!(b_dims[0], rank);
            let a_file = require_key(&fields, &format!("{prefix}.a_file")).unwrap();
            let b_file = require_key(&fields, &format!("{prefix}.b_file")).unwrap();
            let a = read_f32_values(&fs::read(dir.join(a_file)).unwrap(), rows * rank).unwrap();
            let b = read_f32_values(&fs::read(dir.join(b_file)).unwrap(), rank * cols).unwrap();
            bounds.insert(
                format!("{prefix}.delta_l1_microunits"),
                delta_l1_upper_bound_microunits(&a, &b, rows, cols, rank).unwrap(),
            );
        }
        let mut updated = String::new();
        for line in text.lines() {
            if line.starts_with("tinyrustlm_trained_adapter_source_version=") {
                updated.push_str("tinyrustlm_trained_adapter_source_version=2\n");
            } else if let Some((key, _)) = line.split_once('=') {
                if let Some(bound) = bounds.get(key) {
                    updated.push_str(
                        &key.replace(".delta_l1_microunits", ".delta_l1_upper_bound_microunits"),
                    );
                    updated.push('=');
                    updated.push_str(&bound.to_string());
                    updated.push('\n');
                } else {
                    updated.push_str(line);
                    updated.push('\n');
                }
            } else {
                updated.push_str(line);
                updated.push('\n');
            }
        }
        fs::write(path, updated).unwrap();
    }

    fn write_tiny_base(path: &Path, dtype: u32, tied_output: bool) {
        let shape = ModelShape::tiny_fixture();
        let tensors = if tied_output {
            tensors_for_shape_with_tied_output(&shape, dtype)
        } else {
            tensors_for_shape(&shape, dtype)
        };
        let tokenizer = TokenizerSection::phase_one();
        let flags = if tied_output { 1 } else { 0 };
        let bytes = build_model_file_with_flags(&shape, &tensors, &tokenizer, flags).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn temp_path(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-{label}-{nanos}"))
    }

    #[test]
    fn name_hash_matches_tensor_spec_for_targets() {
        let dir = temp_path("adapter-source-hash");
        write_adapter_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest = fs::read_to_string(dir.join(ADAPTER_SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains(&format!(
            "target.0.name_hash=0x{:016x}",
            name_hash("layers.0.wq.weight")
        )));
    }
}
