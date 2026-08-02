//! Offline adapter/delta artifacts for modular model-breeding candidates.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{
    hex64, invalid, output_specs, parse_manifest, parse_model_values, parse_passing_compatibility,
    push_line, push_parent_lines, require_equal, require_key, require_parent_report,
    require_report_equal, require_same_tensor_spec, same_shape, ParsedModel,
};
use crate::build_model_file_from_values_with_flags;
use crate::lineage;
use crate::slm_validate::{self, ValidationReport};
use crate::writer::{align_to_64, write_f32, write_u32, write_u64};

const ADAPTER_ARTIFACT_VERSION: &str = "1";
const ADAPTER_BINARY_VERSION: u32 = 1;
const ADAPTER_ARTIFACT_KIND: &str = "raw-f32-task-delta-v1";
const SPARSE_ADAPTER_ARTIFACT_KIND: &str = "sparse-f32-task-delta-v1";
const LOW_RANK_ADAPTER_ARTIFACT_KIND: &str = "low-rank-f32-task-delta-v1";
const ADAPTER_STATUS: &str = "artifact-written";
const ADAPTER_DTYPE: &str = "f32-delta";
const SPARSE_ADAPTER_DTYPE: &str = "sparse-f32-delta";
const LOW_RANK_ADAPTER_DTYPE: &str = "low-rank-f32-delta";
const ADAPTER_BASE_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const ADAPTER_APPLY_STATUS_F32: &str = "runtime-f32-compatible-or-fuse-to-slm";
const ADAPTER_APPLY_STATUS_QUANTIZED: &str = "runtime-q8-q4-compatible-or-fuse-to-slm";
const LOW_RANK_APPLY_STATUS_F32: &str = "runtime-f32-compatible-low-rank";
const LOW_RANK_APPLY_STATUS_QUANTIZED: &str = "runtime-q8-q4-compatible-low-rank";
const REQUIRED_NEXT_GATE: &str = "fuse-to-slm-plus-candidate-manifest-plus-runtime-smoke-plus-eval";
const SPARSE_REQUIRED_NEXT_GATE: &str =
    "runtime-smoke-plus-eval-plus-selector-adapter-family-or-expand-to-adp1";
const LOW_RANK_REQUIRED_NEXT_GATE: &str =
    "runtime-smoke-plus-eval-plus-selector-adapter-family-route";
const ADAPTER_FUSE_VERSION: &str = "1";
const FUSE_OPERATOR_KIND: &str = "adapter-delta-fuse-to-slm";
const FUSE_OPERATOR_STATUS: &str = "candidate-written";
const FUSE_OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const FUSE_APPLY_STATUS: &str = "fused-to-slm-candidate";
const FUSE_MANIFEST_STATUS: &str = "validated";
const FUSE_REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const HEADER_LEN: usize = 64;
const ENTRY_LEN: usize = 64;
const CHECKSUM_OFFSET: usize = 56;
const MAGIC: &[u8; 4] = b"ADP1";
const SPARSE_MAGIC: &[u8; 4] = b"ASP1";
const LOW_RANK_MAGIC: &[u8; 4] = b"ALR1";
const SPARSE_PAIR_LEN: usize = 12;
const LOW_RANK_HEADER_LEN: usize = 16;
const DEFAULT_LOW_RANK_COMPONENTS: &str = "1";
const MAX_LOW_RANK_COMPONENTS: usize = 8;
const DEFAULT_SPARSE_KEEP_PPM: &str = "1000000";
const DEFAULT_DELTA_WEIGHT_PPM: &str = "1000000";
const MIN_DELTA_WEIGHT_PPM: i64 = -1_000_000;
const MAX_DELTA_WEIGHT_PPM: i64 = 2_000_000;
const PPM_DENOMINATOR: u32 = 1_000_000;

/// One reviewed trained-source low-rank tensor to pack into an ALR1 package.
pub(crate) struct LowRankSourceTensor<'a> {
    /// Stable tensor name hash.
    pub(crate) name_hash: u64,
    /// Logical tensor rank.
    pub(crate) rank: u32,
    /// Padded logical tensor dimensions.
    pub(crate) dims: [u32; 4],
    /// Matrix row count represented by A factors.
    pub(crate) rows: usize,
    /// Matrix column count represented by B factors.
    pub(crate) cols: usize,
    /// Number of low-rank components.
    pub(crate) factor_rank: usize,
    /// Row-major A factors with shape rows x factor_rank.
    pub(crate) a_values: &'a [f32],
    /// Row-major B factors with shape factor_rank x cols.
    pub(crate) b_values: &'a [f32],
}

/// Writes a raw f32 task-delta adapter artifact plus a recomputable manifest.
pub(crate) fn write_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_adapter: &Path,
    output_manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let (adapter, manifest) = build_artifact_bytes_and_manifest(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
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
        "SLM adapter-delta artifact written: {}",
        output_adapter.display()
    );
    println!(
        "SLM adapter-delta manifest written: {}",
        output_manifest.display()
    );
    Ok(())
}

/// Validates an adapter artifact and manifest by recomputing both from parents.
pub(crate) fn validate_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_artifact_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &manifest_text,
    )?;
    println!("SLM adapter-delta validation: PASS");
    println!("adapter: {}", adapter.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

/// Writes a sparse f32 task-delta adapter artifact plus a recomputable manifest.
pub(crate) fn write_sparse_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_adapter: &Path,
    output_manifest: &Path,
    delta_weight_ppm: Option<&str>,
    keep_ppm: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let (adapter, manifest) = build_sparse_artifact_bytes_and_manifest(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &output_adapter.display().to_string(),
        delta_weight_ppm,
        keep_ppm,
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
        "SLM sparse adapter-delta artifact written: {}",
        output_adapter.display()
    );
    println!(
        "SLM sparse adapter-delta manifest written: {}",
        output_manifest.display()
    );
    Ok(())
}

/// Validates a sparse adapter artifact and manifest by recomputing both from parents.
pub(crate) fn validate_sparse_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_sparse_artifact_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &manifest_text,
    )?;
    println!("SLM sparse adapter-delta validation: PASS");
    println!("adapter: {}", adapter.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

/// Writes a low-rank f32 task-delta adapter artifact plus a recomputable manifest.
pub(crate) fn write_low_rank_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_adapter: &Path,
    output_manifest: &Path,
    rank_limit: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let (adapter, manifest) = build_low_rank_artifact_bytes_and_manifest(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &output_adapter.display().to_string(),
        rank_limit,
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
        "SLM low-rank adapter-delta artifact written: {}",
        output_adapter.display()
    );
    println!(
        "SLM low-rank adapter-delta manifest written: {}",
        output_manifest.display()
    );
    Ok(())
}

/// Validates a low-rank adapter artifact and manifest by recomputing both from parents.
pub(crate) fn validate_low_rank_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_low_rank_artifact_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &manifest_text,
    )?;
    println!("SLM low-rank adapter-delta validation: PASS");
    println!("adapter: {}", adapter.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

/// Fuses a validated adapter/delta artifact into a normal `.slm` candidate.
pub(crate) fn fuse_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    adapter_manifest: &Path,
    output_slm: &Path,
    output_receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let adapter_manifest_text = fs::read_to_string(adapter_manifest)?;
    let (candidate, receipt) = build_fused_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &adapter_manifest_text,
        &output_slm.display().to_string(),
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, receipt)?;
    println!(
        "SLM adapter-fused candidate written: {}",
        output_slm.display()
    );
    println!(
        "SLM adapter-fuse operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates an adapter-fused `.slm` candidate by recomputing it from parents.
pub(crate) fn validate_fused_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    adapter_manifest: &Path,
    candidate_slm: &Path,
    receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let adapter_manifest_text = fs::read_to_string(adapter_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_fused_candidate_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &adapter_manifest_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
    )?;
    println!("SLM adapter-fused candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

fn validate_artifact_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    manifest_text: &str,
) -> io::Result<()> {
    let manifest = parse_manifest(manifest_text, "adapter-delta manifest")?;
    require_equal(
        &manifest,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    )?;
    require_equal(&manifest, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND)?;
    let (expected_adapter, expected_manifest) = build_artifact_bytes_and_manifest(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_path,
    )?;
    if adapter_bytes != expected_adapter {
        return Err(invalid(
            "adapter-delta artifact bytes do not match recomputed parent deltas",
        ));
    }
    if manifest_text != expected_manifest {
        return Err(invalid(
            "adapter-delta manifest fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn validate_sparse_artifact_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    manifest_text: &str,
) -> io::Result<()> {
    let manifest = parse_manifest(manifest_text, "sparse adapter-delta manifest")?;
    require_equal(
        &manifest,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    )?;
    require_equal(
        &manifest,
        "adapter_artifact_kind",
        SPARSE_ADAPTER_ARTIFACT_KIND,
    )?;
    let delta_weight_ppm = require_key(&manifest, "adapter_delta_weight_ppm")?;
    let keep_ppm = require_key(&manifest, "adapter_sparse_keep_ppm")?;
    let (expected_adapter, expected_manifest) = build_sparse_artifact_bytes_and_manifest(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_path,
        Some(delta_weight_ppm),
        Some(keep_ppm),
    )?;
    if adapter_bytes != expected_adapter {
        return Err(invalid(
            "sparse adapter-delta artifact bytes do not match recomputed parent deltas",
        ));
    }
    if manifest_text != expected_manifest {
        return Err(invalid(
            "sparse adapter-delta manifest fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn validate_low_rank_artifact_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    manifest_text: &str,
) -> io::Result<()> {
    let manifest = parse_manifest(manifest_text, "low-rank adapter-delta manifest")?;
    require_equal(
        &manifest,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    )?;
    require_equal(
        &manifest,
        "adapter_artifact_kind",
        LOW_RANK_ADAPTER_ARTIFACT_KIND,
    )?;
    let rank_limit = require_key(&manifest, "adapter_low_rank_component_limit")?;
    let (expected_adapter, expected_manifest) = build_low_rank_artifact_bytes_and_manifest(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_path,
        Some(rank_limit),
    )?;
    if adapter_bytes != expected_adapter {
        return Err(invalid(
            "low-rank adapter-delta artifact bytes do not match recomputed parent deltas",
        ));
    }
    if manifest_text != expected_manifest {
        return Err(invalid(
            "low-rank adapter-delta manifest fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn validate_fused_candidate_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    adapter_manifest_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "adapter-fuse operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_adapter_fuse_version",
        ADAPTER_FUSE_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", FUSE_OPERATOR_KIND)?;
    require_equal(&receipt, "operator_status", FUSE_OPERATOR_STATUS)?;
    require_equal(&receipt, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND)?;
    require_equal(&receipt, "adapter_manifest_status", FUSE_MANIFEST_STATUS)?;
    require_equal(&receipt, "adapter_apply_status", FUSE_APPLY_STATUS)?;
    require_equal(&receipt, "candidate_parent_contract", ADAPTER_BASE_CONTRACT)?;
    require_equal(
        &receipt,
        "operator_output_status",
        FUSE_OPERATOR_OUTPUT_STATUS,
    )?;
    let (expected_candidate, expected_receipt) = build_fused_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_bytes,
        adapter_path,
        adapter_manifest_text,
        candidate_path,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "adapter-fused candidate bytes do not match recomputed output",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "adapter-fuse operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn build_fused_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    adapter_manifest_text: &str,
    candidate_path: &str,
) -> io::Result<(Vec<u8>, String)> {
    validate_artifact_text(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_bytes,
        adapter_path,
        adapter_manifest_text,
    )?;
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let target_report = slm_validate::validate_bytes(target_bytes, target_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &target_report)?;

    let base = parse_model_values(base_bytes)?;
    let adapter_deltas = read_adapter_deltas(adapter_bytes, &base, &base_report)?;
    let output_values = fused_values(&base, &adapter_deltas)?;
    let output_tensors = output_specs(&base);
    let candidate = build_model_file_from_values_with_flags(
        &base.shape,
        &output_tensors,
        &base.tokenizer,
        &output_values,
        base.flags,
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
    let receipt = build_fuse_receipt_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        adapter_path,
        adapter_manifest_text,
        adapter_bytes,
        &candidate_report,
    )?;
    Ok((candidate, receipt))
}

fn build_artifact_bytes_and_manifest(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_path: &str,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let target_report = slm_validate::validate_bytes(target_bytes, target_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &target_report)?;

    let base = parse_model_values(base_bytes)?;
    let target = parse_model_values(target_bytes)?;
    let adapter = build_adapter_bytes(&base, &target, &base_report)?;
    validate_adapter_bytes(&adapter)?;
    let manifest = build_manifest_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        adapter_path,
        &adapter,
    )?;
    Ok((adapter, manifest))
}

fn build_sparse_artifact_bytes_and_manifest(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_path: &str,
    delta_weight_ppm: Option<&str>,
    keep_ppm: Option<&str>,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let target_report = slm_validate::validate_bytes(target_bytes, target_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &target_report)?;

    let delta_weight =
        parse_delta_weight_ppm(delta_weight_ppm.unwrap_or(DEFAULT_DELTA_WEIGHT_PPM))?;
    let keep = parse_keep_ppm(keep_ppm.unwrap_or(DEFAULT_SPARSE_KEEP_PPM))?;
    let base = parse_model_values(base_bytes)?;
    let target = parse_model_values(target_bytes)?;
    let (adapter, stats) =
        build_sparse_adapter_bytes(&base, &target, &base_report, delta_weight, keep)?;
    validate_sparse_adapter_bytes(&adapter)?;
    let manifest = build_sparse_manifest_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        adapter_path,
        &adapter,
        delta_weight,
        keep,
        stats,
    )?;
    Ok((adapter, manifest))
}

fn build_low_rank_artifact_bytes_and_manifest(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_path: &str,
    rank_limit: Option<&str>,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let target_report = slm_validate::validate_bytes(target_bytes, target_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &target_report)?;

    let rank_limit = parse_low_rank_components(rank_limit.unwrap_or(DEFAULT_LOW_RANK_COMPONENTS))?;
    let base = parse_model_values(base_bytes)?;
    let target = parse_model_values(target_bytes)?;
    let (adapter, stats) = build_low_rank_adapter_bytes(&base, &target, &base_report, rank_limit)?;
    validate_low_rank_adapter_bytes(&adapter)?;
    let manifest = build_low_rank_manifest_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        adapter_path,
        &adapter,
        rank_limit,
        stats,
    )?;
    Ok((adapter, manifest))
}

fn build_adapter_bytes(
    base: &ParsedModel,
    target: &ParsedModel,
    base_report: &ValidationReport,
) -> io::Result<Vec<u8>> {
    validate_parent_models(base, target)?;
    let tensor_count = base.tensors.len();
    let directory_offset = HEADER_LEN;
    let data_offset = align_to_64(directory_offset + tensor_count * ENTRY_LEN);
    let mut tensor_offsets = Vec::with_capacity(tensor_count);
    let mut tensor_lengths = Vec::with_capacity(tensor_count);
    let mut tensor_checksums = Vec::with_capacity(tensor_count);
    let mut delta_values = Vec::with_capacity(tensor_count);
    let mut cursor = data_offset;

    for (base_tensor, target_tensor) in base.tensors.iter().zip(target.tensors.iter()) {
        require_same_tensor_spec(&base_tensor.spec, &target_tensor.spec)?;
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor);
        let mut deltas = Vec::with_capacity(base_tensor.values.len());
        for (base_value, target_value) in base_tensor.values.iter().zip(target_tensor.values.iter())
        {
            deltas.push(target_value - base_value);
        }
        let byte_length = deltas
            .len()
            .checked_mul(4)
            .ok_or_else(|| invalid("adapter tensor byte length overflow"))?;
        tensor_lengths.push(byte_length);
        cursor = cursor
            .checked_add(byte_length)
            .ok_or_else(|| invalid("adapter payload length overflow"))?;
        let mut payload = vec![0u8; byte_length];
        for (index, value) in deltas.iter().enumerate() {
            write_f32(&mut payload, index * 4, *value)?;
        }
        tensor_checksums.push(payload_checksum(&payload));
        delta_values.push(deltas);
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(MAGIC);
    write_u32(&mut bytes, 4, ADAPTER_BINARY_VERSION)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, tensor_count as u32)?;
    write_u32(&mut bytes, 16, base.flags)?;
    write_u32(&mut bytes, 20, ENTRY_LEN as u32)?;
    write_u64(&mut bytes, 24, base_report.parameter_count())?;
    write_u64(&mut bytes, 32, base_report.tensor_layout_checksum())?;
    write_u64(&mut bytes, 40, base_report.tokenizer_checksum())?;
    write_u64(&mut bytes, 48, data_offset as u64)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, 0)?;

    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = directory_offset + index * ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.spec.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.spec.rank)?;
        write_u32(&mut bytes, entry + 12, tensor.spec.dims[0])?;
        write_u32(&mut bytes, entry + 16, tensor.spec.dims[1])?;
        write_u32(&mut bytes, entry + 20, tensor.spec.dims[2])?;
        write_u32(&mut bytes, entry + 24, tensor.spec.dims[3])?;
        write_u32(&mut bytes, entry + 28, 0)?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index] as u64)?;
        write_u64(&mut bytes, entry + 40, tensor_lengths[index] as u64)?;
        write_u64(&mut bytes, entry + 48, tensor.spec.element_count() as u64)?;
        write_u64(&mut bytes, entry + 56, tensor_checksums[index])?;

        let start = tensor_offsets[index];
        for (value_index, value) in delta_values[index].iter().enumerate() {
            write_f32(&mut bytes, start + value_index * 4, *value)?;
        }
    }

    let checksum = adapter_checksum(&bytes)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, checksum)?;
    Ok(bytes)
}

fn build_sparse_adapter_bytes(
    base: &ParsedModel,
    target: &ParsedModel,
    base_report: &ValidationReport,
    delta_weight_ppm: i64,
    keep_ppm: u32,
) -> io::Result<(Vec<u8>, SparseStats)> {
    validate_parent_models(base, target)?;
    let tensor_count = base.tensors.len();
    let directory_offset = HEADER_LEN;
    let data_offset = align_to_64(directory_offset + tensor_count * ENTRY_LEN);
    let mut ranked = Vec::new();
    let mut total_parameter_count = 0u64;

    for (tensor_index, (base_tensor, target_tensor)) in
        base.tensors.iter().zip(target.tensors.iter()).enumerate()
    {
        require_same_tensor_spec(&base_tensor.spec, &target_tensor.spec)?;
        total_parameter_count += base_tensor.values.len() as u64;
        for (value_index, (base_value, target_value)) in base_tensor
            .values
            .iter()
            .zip(target_tensor.values.iter())
            .enumerate()
        {
            let delta = target_value - base_value;
            let magnitude = delta.abs();
            if magnitude > 0.0 {
                ranked.push(RankedDelta {
                    magnitude,
                    tensor_index,
                    value_index,
                    delta,
                });
            }
        }
    }

    ranked.sort_by(compare_ranked_delta);
    let requested_keep = keep_count(total_parameter_count, keep_ppm)?;
    let kept_parameter_count = requested_keep.min(ranked.len() as u64);
    let delta_weight = delta_weight_ppm as f32 / PPM_DENOMINATOR as f32;
    let selected = ranked
        .iter()
        .take(kept_parameter_count as usize)
        .collect::<Vec<_>>();
    let mut selected_by_tensor = vec![Vec::<(usize, f32)>::new(); tensor_count];
    for entry in &selected {
        selected_by_tensor[entry.tensor_index]
            .push((entry.value_index, entry.delta * delta_weight));
    }
    for pairs in &mut selected_by_tensor {
        pairs.sort_by_key(|(value_index, _)| *value_index);
    }

    let mut tensor_offsets = Vec::with_capacity(tensor_count);
    let mut tensor_lengths = Vec::with_capacity(tensor_count);
    let mut tensor_checksums = Vec::with_capacity(tensor_count);
    let mut payloads = Vec::with_capacity(tensor_count);
    let mut cursor = data_offset;
    for pairs in &selected_by_tensor {
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor);
        let byte_length = pairs
            .len()
            .checked_mul(SPARSE_PAIR_LEN)
            .ok_or_else(|| invalid("sparse adapter tensor byte length overflow"))?;
        tensor_lengths.push(byte_length);
        cursor = cursor
            .checked_add(byte_length)
            .ok_or_else(|| invalid("sparse adapter payload length overflow"))?;
        let mut payload = vec![0u8; byte_length];
        for (pair_index, (value_index, delta)) in pairs.iter().enumerate() {
            let offset = pair_index * SPARSE_PAIR_LEN;
            write_u64(&mut payload, offset, *value_index as u64)?;
            write_f32(&mut payload, offset + 8, *delta)?;
        }
        tensor_checksums.push(payload_checksum(&payload));
        payloads.push(payload);
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(SPARSE_MAGIC);
    write_u32(&mut bytes, 4, ADAPTER_BINARY_VERSION)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, tensor_count as u32)?;
    write_u32(&mut bytes, 16, base.flags)?;
    write_u32(&mut bytes, 20, ENTRY_LEN as u32)?;
    write_u64(&mut bytes, 24, base_report.parameter_count())?;
    write_u64(&mut bytes, 32, base_report.tensor_layout_checksum())?;
    write_u64(&mut bytes, 40, base_report.tokenizer_checksum())?;
    write_u64(&mut bytes, 48, data_offset as u64)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, 0)?;

    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = directory_offset + index * ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.spec.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.spec.rank)?;
        write_u32(&mut bytes, entry + 12, tensor.spec.dims[0])?;
        write_u32(&mut bytes, entry + 16, tensor.spec.dims[1])?;
        write_u32(&mut bytes, entry + 20, tensor.spec.dims[2])?;
        write_u32(&mut bytes, entry + 24, tensor.spec.dims[3])?;
        write_u32(&mut bytes, entry + 28, 0)?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index] as u64)?;
        write_u64(&mut bytes, entry + 40, tensor_lengths[index] as u64)?;
        write_u64(&mut bytes, entry + 48, tensor.spec.element_count() as u64)?;
        write_u64(&mut bytes, entry + 56, tensor_checksums[index])?;

        let start = tensor_offsets[index];
        bytes[start..start + tensor_lengths[index]].copy_from_slice(&payloads[index]);
    }

    let checksum = adapter_checksum(&bytes)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, checksum)?;
    let nonzero_delta_count = ranked.len() as u64;
    let stats = SparseStats {
        total_parameter_count,
        nonzero_delta_count,
        kept_parameter_count,
        pruned_parameter_count: total_parameter_count - kept_parameter_count,
        unchanged_parameter_count: total_parameter_count - nonzero_delta_count,
        pruned_nonzero_delta_count: nonzero_delta_count - kept_parameter_count,
        density_ppm: ratio_ppm(kept_parameter_count, total_parameter_count)?,
        nonzero_delta_retention_ppm: ratio_ppm(kept_parameter_count, nonzero_delta_count)?,
        mask_checksum: sparse_mask_checksum(&selected, total_parameter_count),
    };
    Ok((bytes, stats))
}

fn build_low_rank_adapter_bytes(
    base: &ParsedModel,
    target: &ParsedModel,
    base_report: &ValidationReport,
    rank_limit: usize,
) -> io::Result<(Vec<u8>, LowRankStats)> {
    validate_parent_models(base, target)?;
    let tensor_count = base.tensors.len();
    let directory_offset = HEADER_LEN;
    let data_offset = align_to_64(directory_offset + tensor_count * ENTRY_LEN);
    let mut tensor_offsets = Vec::with_capacity(tensor_count);
    let mut tensor_lengths = Vec::with_capacity(tensor_count);
    let mut tensor_checksums = Vec::with_capacity(tensor_count);
    let mut payloads = Vec::with_capacity(tensor_count);
    let mut cursor = data_offset;
    let mut stats = LowRankStats::default();

    for (base_tensor, target_tensor) in base.tensors.iter().zip(target.tensors.iter()) {
        require_same_tensor_spec(&base_tensor.spec, &target_tensor.spec)?;
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor);
        let (payload, tensor_stats) =
            build_low_rank_tensor_payload(base_tensor, target_tensor, rank_limit)?;
        tensor_lengths.push(payload.len());
        cursor = cursor
            .checked_add(payload.len())
            .ok_or_else(|| invalid("low-rank adapter payload length overflow"))?;
        tensor_checksums.push(payload_checksum(&payload));
        stats.add(tensor_stats)?;
        payloads.push(payload);
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(LOW_RANK_MAGIC);
    write_u32(&mut bytes, 4, ADAPTER_BINARY_VERSION)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, tensor_count as u32)?;
    write_u32(&mut bytes, 16, base.flags)?;
    write_u32(&mut bytes, 20, ENTRY_LEN as u32)?;
    write_u64(&mut bytes, 24, base_report.parameter_count())?;
    write_u64(&mut bytes, 32, base_report.tensor_layout_checksum())?;
    write_u64(&mut bytes, 40, base_report.tokenizer_checksum())?;
    write_u64(&mut bytes, 48, data_offset as u64)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, 0)?;

    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = directory_offset + index * ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.spec.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.spec.rank)?;
        write_u32(&mut bytes, entry + 12, tensor.spec.dims[0])?;
        write_u32(&mut bytes, entry + 16, tensor.spec.dims[1])?;
        write_u32(&mut bytes, entry + 20, tensor.spec.dims[2])?;
        write_u32(&mut bytes, entry + 24, tensor.spec.dims[3])?;
        write_u32(&mut bytes, entry + 28, 0)?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index] as u64)?;
        write_u64(&mut bytes, entry + 40, tensor_lengths[index] as u64)?;
        write_u64(&mut bytes, entry + 48, tensor.spec.element_count() as u64)?;
        write_u64(&mut bytes, entry + 56, tensor_checksums[index])?;

        let start = tensor_offsets[index];
        bytes[start..start + tensor_lengths[index]].copy_from_slice(&payloads[index]);
    }

    let checksum = adapter_checksum(&bytes)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, checksum)?;
    Ok((bytes, stats))
}

/// Builds an ALR1 package from reviewed trained-source low-rank factors.
pub(crate) fn build_low_rank_source_adapter_bytes(
    base: &ParsedModel,
    base_report: &ValidationReport,
    source_tensors: &[LowRankSourceTensor<'_>],
) -> io::Result<Vec<u8>> {
    let mut source_by_hash = HashMap::new();
    for (index, source) in source_tensors.iter().enumerate() {
        if source_by_hash.insert(source.name_hash, index).is_some() {
            return Err(invalid("low-rank source tensor hashes must be unique"));
        }
    }
    let tensor_count = base.tensors.len();
    let directory_offset = HEADER_LEN;
    let data_offset = align_to_64(directory_offset + tensor_count * ENTRY_LEN);
    let mut tensor_offsets = Vec::with_capacity(tensor_count);
    let mut tensor_lengths = Vec::with_capacity(tensor_count);
    let mut tensor_checksums = Vec::with_capacity(tensor_count);
    let mut payloads = Vec::with_capacity(tensor_count);
    let mut cursor = data_offset;

    for tensor in &base.tensors {
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor);
        let payload = if let Some(source_index) = source_by_hash.get(&tensor.spec.name_hash) {
            build_low_rank_source_tensor_payload(tensor, &source_tensors[*source_index])?
        } else {
            Vec::new()
        };
        tensor_lengths.push(payload.len());
        cursor = cursor
            .checked_add(payload.len())
            .ok_or_else(|| invalid("low-rank source adapter payload length overflow"))?;
        tensor_checksums.push(payload_checksum(&payload));
        payloads.push(payload);
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(LOW_RANK_MAGIC);
    write_u32(&mut bytes, 4, ADAPTER_BINARY_VERSION)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, tensor_count as u32)?;
    write_u32(&mut bytes, 16, base.flags)?;
    write_u32(&mut bytes, 20, ENTRY_LEN as u32)?;
    write_u64(&mut bytes, 24, base_report.parameter_count())?;
    write_u64(&mut bytes, 32, base_report.tensor_layout_checksum())?;
    write_u64(&mut bytes, 40, base_report.tokenizer_checksum())?;
    write_u64(&mut bytes, 48, data_offset as u64)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, 0)?;

    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = directory_offset + index * ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.spec.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.spec.rank)?;
        write_u32(&mut bytes, entry + 12, tensor.spec.dims[0])?;
        write_u32(&mut bytes, entry + 16, tensor.spec.dims[1])?;
        write_u32(&mut bytes, entry + 20, tensor.spec.dims[2])?;
        write_u32(&mut bytes, entry + 24, tensor.spec.dims[3])?;
        write_u32(&mut bytes, entry + 28, 0)?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index] as u64)?;
        write_u64(&mut bytes, entry + 40, tensor_lengths[index] as u64)?;
        write_u64(&mut bytes, entry + 48, tensor.spec.element_count() as u64)?;
        write_u64(&mut bytes, entry + 56, tensor_checksums[index])?;

        let start = tensor_offsets[index];
        bytes[start..start + tensor_lengths[index]].copy_from_slice(&payloads[index]);
    }

    let checksum = adapter_checksum(&bytes)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, checksum)?;
    Ok(bytes)
}

fn build_low_rank_source_tensor_payload(
    tensor: &crate::blend::ParsedTensor,
    source: &LowRankSourceTensor<'_>,
) -> io::Result<Vec<u8>> {
    if tensor.spec.name_hash != source.name_hash
        || tensor.spec.rank != source.rank
        || tensor.spec.dims != source.dims
    {
        return Err(invalid(
            "low-rank source tensor identity does not match base model",
        ));
    }
    let (rows, cols) = low_rank_matrix_shape(&tensor.spec)?;
    if rows != source.rows || cols != source.cols {
        return Err(invalid(
            "low-rank source tensor matrix shape does not match base model",
        ));
    }
    if source.factor_rank == 0
        || source.factor_rank > MAX_LOW_RANK_COMPONENTS
        || source.factor_rank > rows.min(cols)
    {
        return Err(invalid("low-rank source factor rank is out of range"));
    }
    let expected_a = rows
        .checked_mul(source.factor_rank)
        .ok_or_else(|| invalid("low-rank source A factor length overflow"))?;
    let expected_b = source
        .factor_rank
        .checked_mul(cols)
        .ok_or_else(|| invalid("low-rank source B factor length overflow"))?;
    if source.a_values.len() != expected_a || source.b_values.len() != expected_b {
        return Err(invalid("low-rank source factor lengths do not match shape"));
    }
    for value in source.a_values.iter().chain(source.b_values.iter()) {
        if !value.is_finite() {
            return Err(invalid("low-rank source factor is not finite"));
        }
    }

    let factor_values = source
        .factor_rank
        .checked_mul(
            rows.checked_add(cols)
                .ok_or_else(|| invalid("low-rank source shape overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank source factor count overflow"))?;
    let byte_length = LOW_RANK_HEADER_LEN
        .checked_add(
            factor_values
                .checked_mul(4)
                .ok_or_else(|| invalid("low-rank source payload byte length overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank source payload byte length overflow"))?;
    let mut payload = vec![0u8; byte_length];
    write_u32(&mut payload, 0, rows as u32)?;
    write_u32(&mut payload, 4, cols as u32)?;
    write_u32(&mut payload, 8, source.factor_rank as u32)?;
    write_u32(&mut payload, 12, 0)?;
    let mut offset = LOW_RANK_HEADER_LEN;
    for component in 0..source.factor_rank {
        for row in 0..rows {
            write_f32(
                &mut payload,
                offset,
                source.a_values[row * source.factor_rank + component],
            )?;
            offset += 4;
        }
    }
    for component in 0..source.factor_rank {
        for col in 0..cols {
            write_f32(
                &mut payload,
                offset,
                source.b_values[component * cols + col],
            )?;
            offset += 4;
        }
    }
    Ok(payload)
}

fn build_low_rank_tensor_payload(
    base_tensor: &crate::blend::ParsedTensor,
    target_tensor: &crate::blend::ParsedTensor,
    rank_limit: usize,
) -> io::Result<(Vec<u8>, LowRankTensorStats)> {
    let element_count = base_tensor.spec.element_count();
    let mut stats = LowRankTensorStats {
        parameter_count: element_count as u64,
        ..LowRankTensorStats::default()
    };
    if base_tensor.spec.rank < 2 {
        return Ok((Vec::new(), stats));
    }
    let (rows, cols) = low_rank_matrix_shape(&base_tensor.spec)?;
    let mut residual = Vec::with_capacity(element_count);
    let mut initial_l1 = 0.0f64;
    for (base_value, target_value) in base_tensor.values.iter().zip(target_tensor.values.iter()) {
        let delta = target_value - base_value;
        initial_l1 += f64::from(delta.abs());
        residual.push(delta);
    }
    stats.matrix_tensor_count = 1;
    stats.matrix_parameter_count = element_count as u64;
    stats.initial_l1_microunits = l1_microunits(initial_l1)?;

    let components =
        low_rank_components(&mut residual, rows, cols, rank_limit.min(rows.min(cols)))?;
    if components.is_empty() {
        stats.residual_l1_microunits = stats.initial_l1_microunits;
        return Ok((Vec::new(), stats));
    }

    let factor_values = components
        .len()
        .checked_mul(
            rows.checked_add(cols)
                .ok_or_else(|| invalid("low-rank shape overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank factor count overflow"))?;
    let byte_length = LOW_RANK_HEADER_LEN
        .checked_add(
            factor_values
                .checked_mul(4)
                .ok_or_else(|| invalid("low-rank payload byte length overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank payload byte length overflow"))?;
    let mut payload = vec![0u8; byte_length];
    write_u32(&mut payload, 0, rows as u32)?;
    write_u32(&mut payload, 4, cols as u32)?;
    write_u32(&mut payload, 8, components.len() as u32)?;
    write_u32(&mut payload, 12, 0)?;
    let mut offset = LOW_RANK_HEADER_LEN;
    for component in &components {
        for value in &component.a {
            write_f32(&mut payload, offset, *value)?;
            offset += 4;
        }
    }
    for component in &components {
        for value in &component.b {
            write_f32(&mut payload, offset, *value)?;
            offset += 4;
        }
    }
    let residual_l1 = residual
        .iter()
        .fold(0.0f64, |acc, value| acc + f64::from(value.abs()));
    stats.active_tensor_count = 1;
    stats.component_count = components.len() as u64;
    stats.factor_parameter_count = factor_values as u64;
    stats.residual_l1_microunits = l1_microunits(residual_l1)?;
    Ok((payload, stats))
}

fn build_manifest_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    adapter_path: &str,
    adapter_bytes: &[u8],
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    );
    push_line(&mut text, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND);
    push_line(&mut text, "adapter_status", ADAPTER_STATUS);
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
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(read_u64(adapter_bytes, CHECKSUM_OFFSET)?),
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
    push_line(&mut text, "adapter_dtype", ADAPTER_DTYPE);
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
    push_line(&mut text, "adapter_base_contract", ADAPTER_BASE_CONTRACT);
    push_line(
        &mut text,
        "adapter_apply_status",
        adapter_apply_status(base_report),
    );
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

fn build_sparse_manifest_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    adapter_path: &str,
    adapter_bytes: &[u8],
    delta_weight_ppm: i64,
    keep_ppm: u32,
    stats: SparseStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    );
    push_line(
        &mut text,
        "adapter_artifact_kind",
        SPARSE_ADAPTER_ARTIFACT_KIND,
    );
    push_line(&mut text, "adapter_status", ADAPTER_STATUS);
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
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(read_u64(adapter_bytes, CHECKSUM_OFFSET)?),
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
    push_line(&mut text, "adapter_dtype", SPARSE_ADAPTER_DTYPE);
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
    push_line(&mut text, "adapter_base_contract", ADAPTER_BASE_CONTRACT);
    push_line(&mut text, "adapter_delta_weight_unit", "parts-per-million");
    push_line(
        &mut text,
        "adapter_delta_weight_ppm",
        &delta_weight_ppm.to_string(),
    );
    push_line(&mut text, "adapter_sparse_keep_unit", "parts-per-million");
    push_line(&mut text, "adapter_sparse_keep_ppm", &keep_ppm.to_string());
    push_line(
        &mut text,
        "adapter_sparse_pair_width_bytes",
        &SPARSE_PAIR_LEN.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_selection_metric",
        "absolute-target-minus-base-delta",
    );
    push_line(
        &mut text,
        "adapter_sparse_selection_scope",
        "global-compatible-parent-tensors",
    );
    push_line(
        &mut text,
        "adapter_sparse_tie_break",
        "tensor-index-then-value-index",
    );
    push_line(
        &mut text,
        "adapter_sparse_total_parameter_count",
        &stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_nonzero_delta_count",
        &stats.nonzero_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_kept_parameter_count",
        &stats.kept_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_pruned_parameter_count",
        &stats.pruned_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_unchanged_parameter_count",
        &stats.unchanged_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_pruned_nonzero_delta_count",
        &stats.pruned_nonzero_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_density_ppm",
        &stats.density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_nonzero_delta_retention_ppm",
        &stats.nonzero_delta_retention_ppm.to_string(),
    );
    push_line(
        &mut text,
        "adapter_sparse_mask_checksum",
        &hex64(stats.mask_checksum),
    );
    push_line(
        &mut text,
        "adapter_apply_status",
        adapter_apply_status(base_report),
    );
    push_line(&mut text, "required_next_gate", SPARSE_REQUIRED_NEXT_GATE);
    Ok(text)
}

fn build_low_rank_manifest_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    adapter_path: &str,
    adapter_bytes: &[u8],
    rank_limit: usize,
    stats: LowRankStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    );
    push_line(
        &mut text,
        "adapter_artifact_kind",
        LOW_RANK_ADAPTER_ARTIFACT_KIND,
    );
    push_line(&mut text, "adapter_status", ADAPTER_STATUS);
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
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(read_u64(adapter_bytes, CHECKSUM_OFFSET)?),
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
    push_line(&mut text, "adapter_dtype", LOW_RANK_ADAPTER_DTYPE);
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
    push_line(&mut text, "adapter_base_contract", ADAPTER_BASE_CONTRACT);
    push_line(&mut text, "adapter_low_rank_format", "ALR1");
    push_line(
        &mut text,
        "adapter_low_rank_component_limit",
        &rank_limit.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_component_cap",
        &MAX_LOW_RANK_COMPONENTS.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_payload_header_bytes",
        &LOW_RANK_HEADER_LEN.to_string(),
    );
    push_line(&mut text, "adapter_low_rank_factor_dtype", "f32");
    push_line(
        &mut text,
        "adapter_low_rank_selection",
        "deterministic-cross-residual",
    );
    push_line(
        &mut text,
        "adapter_low_rank_scope",
        "compatible-parent-matrix-tensors",
    );
    push_line(
        &mut text,
        "adapter_low_rank_matrix_tensor_count",
        &stats.matrix_tensor_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_active_tensor_count",
        &stats.active_tensor_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_component_count",
        &stats.component_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_total_parameter_count",
        &stats.parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_matrix_parameter_count",
        &stats.matrix_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_factor_parameter_count",
        &stats.factor_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_factor_density_ppm",
        &ratio_ppm(stats.factor_parameter_count, stats.matrix_parameter_count)?.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_initial_l1_microunits",
        &stats.initial_l1_microunits.to_string(),
    );
    push_line(
        &mut text,
        "adapter_low_rank_residual_l1_microunits",
        &stats.residual_l1_microunits.to_string(),
    );
    push_line(
        &mut text,
        "adapter_apply_status",
        low_rank_adapter_apply_status(base_report),
    );
    push_line(&mut text, "required_next_gate", LOW_RANK_REQUIRED_NEXT_GATE);
    Ok(text)
}

fn adapter_apply_status(base_report: &ValidationReport) -> &'static str {
    if base_report.quantization_label() == "f32" {
        ADAPTER_APPLY_STATUS_F32
    } else {
        ADAPTER_APPLY_STATUS_QUANTIZED
    }
}

/// Returns the runtime apply-status label for an ALR1 package over a base model.
pub(crate) fn low_rank_adapter_apply_status(base_report: &ValidationReport) -> &'static str {
    if base_report.quantization_label() == "f32" {
        LOW_RANK_APPLY_STATUS_F32
    } else {
        LOW_RANK_APPLY_STATUS_QUANTIZED
    }
}

/// Reads the stored ALR1 package checksum from the fixed header field.
pub(crate) fn low_rank_adapter_checksum(adapter_bytes: &[u8]) -> io::Result<u64> {
    read_u64(adapter_bytes, CHECKSUM_OFFSET)
}

fn build_fuse_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    adapter_path: &str,
    adapter_manifest_text: &str,
    adapter_bytes: &[u8],
    candidate_report: &ValidationReport,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_fuse_version",
        ADAPTER_FUSE_VERSION,
    );
    push_line(&mut text, "operator_kind", FUSE_OPERATOR_KIND);
    push_line(&mut text, "operator_status", FUSE_OPERATOR_STATUS);
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
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND);
    push_line(&mut text, "adapter_source_parent_index", "0");
    push_line(&mut text, "adapter_target_parent_index", "1");
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_manifest_checksum",
        &hex64(lineage::text_checksum(adapter_manifest_text.as_bytes())),
    );
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(read_u64(adapter_bytes, CHECKSUM_OFFSET)?),
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
    push_line(&mut text, "adapter_dtype", ADAPTER_DTYPE);
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
    push_line(&mut text, "adapter_base_contract", ADAPTER_BASE_CONTRACT);
    push_line(&mut text, "adapter_manifest_status", FUSE_MANIFEST_STATUS);
    push_line(&mut text, "adapter_apply_status", FUSE_APPLY_STATUS);
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
    push_line(
        &mut text,
        "candidate_parent_contract",
        ADAPTER_BASE_CONTRACT,
    );
    push_line(
        &mut text,
        "operator_output_status",
        FUSE_OPERATOR_OUTPUT_STATUS,
    );
    push_line(&mut text, "required_next_gate", FUSE_REQUIRED_NEXT_GATE);
    Ok(text)
}

fn read_adapter_deltas(
    bytes: &[u8],
    base: &ParsedModel,
    base_report: &ValidationReport,
) -> io::Result<Vec<Vec<f32>>> {
    validate_adapter_bytes(bytes)?;
    let tensor_count = read_u32(bytes, 12)? as usize;
    if tensor_count != base.tensors.len() {
        return Err(invalid(
            "adapter tensor count does not match base parent tensor count",
        ));
    }
    if read_u32(bytes, 16)? != base.flags {
        return Err(invalid(
            "adapter output flags do not match base parent output flags",
        ));
    }
    if read_u64(bytes, 24)? != base_report.parameter_count() {
        return Err(invalid(
            "adapter parameter count does not match base parent parameter count",
        ));
    }
    if read_u64(bytes, 32)? != base_report.tensor_layout_checksum() {
        return Err(invalid(
            "adapter tensor layout checksum does not match base parent",
        ));
    }
    if read_u64(bytes, 40)? != base_report.tokenizer_checksum() {
        return Err(invalid(
            "adapter tokenizer checksum does not match base parent",
        ));
    }
    let data_offset = read_u64(bytes, 48)? as usize;
    let mut output = Vec::with_capacity(tensor_count);
    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = HEADER_LEN + index * ENTRY_LEN;
        if read_u64(bytes, entry)? != tensor.spec.name_hash {
            return Err(invalid(
                "adapter tensor name hash does not match base parent",
            ));
        }
        if read_u32(bytes, entry + 8)? != tensor.spec.rank {
            return Err(invalid("adapter tensor rank does not match base parent"));
        }
        for dim_index in 0..4 {
            if read_u32(bytes, entry + 12 + dim_index * 4)? != tensor.spec.dims[dim_index] {
                return Err(invalid("adapter tensor dims do not match base parent"));
            }
        }
        if read_u32(bytes, entry + 28)? != 0 {
            return Err(invalid("adapter tensor reserved field is not zero"));
        }
        let byte_offset = read_u64(bytes, entry + 32)? as usize;
        if byte_offset < data_offset || !byte_offset.is_multiple_of(64) {
            return Err(invalid("adapter tensor payload offset is invalid"));
        }
        let byte_length = read_u64(bytes, entry + 40)? as usize;
        let element_count = read_u64(bytes, entry + 48)? as usize;
        if element_count != tensor.spec.element_count() {
            return Err(invalid(
                "adapter tensor element count does not match base parent",
            ));
        }
        let expected_byte_length = element_count
            .checked_mul(4)
            .ok_or_else(|| invalid("adapter tensor byte length overflow"))?;
        if byte_length != expected_byte_length {
            return Err(invalid(
                "adapter tensor byte length does not match element count",
            ));
        }
        let mut values = Vec::with_capacity(element_count);
        for value_index in 0..element_count {
            let value = read_f32(bytes, byte_offset + value_index * 4)?;
            if !value.is_finite() {
                return Err(invalid("adapter tensor delta is not finite"));
            }
            values.push(value);
        }
        output.push(values);
    }
    Ok(output)
}

fn fused_values(base: &ParsedModel, adapter_deltas: &[Vec<f32>]) -> io::Result<Vec<Vec<f32>>> {
    if adapter_deltas.len() != base.tensors.len() {
        return Err(invalid("adapter deltas do not match base tensor count"));
    }
    let mut output = Vec::with_capacity(base.tensors.len());
    for (tensor, deltas) in base.tensors.iter().zip(adapter_deltas.iter()) {
        if tensor.values.len() != deltas.len() {
            return Err(invalid(
                "adapter delta tensor length does not match base tensor length",
            ));
        }
        let values = tensor
            .values
            .iter()
            .zip(deltas.iter())
            .map(|(base_value, delta)| base_value + delta)
            .collect::<Vec<_>>();
        output.push(values);
    }
    Ok(output)
}

fn validate_parent_models(base: &ParsedModel, target: &ParsedModel) -> io::Result<()> {
    if !same_shape(&base.shape, &target.shape) {
        return Err(invalid("adapter parents have different model shapes"));
    }
    if base.flags != target.flags {
        return Err(invalid("adapter parents have different output flags"));
    }
    if base.tokenizer.bytes != target.tokenizer.bytes {
        return Err(invalid("adapter parents have different tokenizer bytes"));
    }
    if base.tensors.len() != target.tensors.len() {
        return Err(invalid("adapter parents have different tensor counts"));
    }
    Ok(())
}

fn validate_adapter_bytes(bytes: &[u8]) -> io::Result<()> {
    if bytes.get(0..4) != Some(MAGIC) {
        return Err(invalid("adapter artifact has invalid magic"));
    }
    let version = read_u32(bytes, 4)?;
    if version != ADAPTER_BINARY_VERSION {
        return Err(invalid("adapter artifact has unsupported version"));
    }
    let header_len = read_u32(bytes, 8)? as usize;
    if header_len != HEADER_LEN {
        return Err(invalid("adapter artifact has invalid header length"));
    }
    let tensor_count = read_u32(bytes, 12)? as usize;
    let entry_len = read_u32(bytes, 20)? as usize;
    if entry_len != ENTRY_LEN {
        return Err(invalid("adapter artifact has invalid entry length"));
    }
    let data_offset = read_u64(bytes, 48)? as usize;
    let directory_end = HEADER_LEN
        .checked_add(
            tensor_count
                .checked_mul(ENTRY_LEN)
                .ok_or_else(|| invalid("adapter directory length overflow"))?,
        )
        .ok_or_else(|| invalid("adapter directory end overflow"))?;
    if data_offset < directory_end || !data_offset.is_multiple_of(64) {
        return Err(invalid("adapter artifact has invalid data offset"));
    }
    if read_u64(bytes, CHECKSUM_OFFSET)? != adapter_checksum(bytes)? {
        return Err(invalid("adapter artifact checksum mismatch"));
    }
    for index in 0..tensor_count {
        let entry = HEADER_LEN + index * ENTRY_LEN;
        let byte_offset = read_u64(bytes, entry + 32)? as usize;
        let byte_length = read_u64(bytes, entry + 40)? as usize;
        let element_count = read_u64(bytes, entry + 48)? as usize;
        let expected_byte_length = element_count
            .checked_mul(4)
            .ok_or_else(|| invalid("adapter tensor byte length overflow"))?;
        if byte_length != expected_byte_length {
            return Err(invalid(
                "adapter tensor byte length does not match element count",
            ));
        }
        let end = byte_offset
            .checked_add(byte_length)
            .ok_or_else(|| invalid("adapter tensor payload end overflow"))?;
        let payload = bytes
            .get(byte_offset..end)
            .ok_or_else(|| invalid("adapter tensor payload escapes artifact"))?;
        if read_u64(bytes, entry + 56)? != payload_checksum(payload) {
            return Err(invalid("adapter tensor payload checksum mismatch"));
        }
    }
    Ok(())
}

fn validate_sparse_adapter_bytes(bytes: &[u8]) -> io::Result<()> {
    if bytes.get(0..4) != Some(SPARSE_MAGIC) {
        return Err(invalid("sparse adapter artifact has invalid magic"));
    }
    let version = read_u32(bytes, 4)?;
    if version != ADAPTER_BINARY_VERSION {
        return Err(invalid("sparse adapter artifact has unsupported version"));
    }
    let header_len = read_u32(bytes, 8)? as usize;
    if header_len != HEADER_LEN {
        return Err(invalid("sparse adapter artifact has invalid header length"));
    }
    let tensor_count = read_u32(bytes, 12)? as usize;
    let entry_len = read_u32(bytes, 20)? as usize;
    if entry_len != ENTRY_LEN {
        return Err(invalid("sparse adapter artifact has invalid entry length"));
    }
    let data_offset = read_u64(bytes, 48)? as usize;
    let directory_end = HEADER_LEN
        .checked_add(
            tensor_count
                .checked_mul(ENTRY_LEN)
                .ok_or_else(|| invalid("sparse adapter directory length overflow"))?,
        )
        .ok_or_else(|| invalid("sparse adapter directory end overflow"))?;
    if data_offset < directory_end || !data_offset.is_multiple_of(64) {
        return Err(invalid("sparse adapter artifact has invalid data offset"));
    }
    if read_u64(bytes, CHECKSUM_OFFSET)? != adapter_checksum(bytes)? {
        return Err(invalid("sparse adapter artifact checksum mismatch"));
    }
    for index in 0..tensor_count {
        let entry = HEADER_LEN + index * ENTRY_LEN;
        let byte_offset = read_u64(bytes, entry + 32)? as usize;
        let byte_length = read_u64(bytes, entry + 40)? as usize;
        let element_count = read_u64(bytes, entry + 48)? as usize;
        if !byte_length.is_multiple_of(SPARSE_PAIR_LEN)
            || byte_length / SPARSE_PAIR_LEN > element_count
        {
            return Err(invalid(
                "sparse adapter tensor byte length does not match sparse pairs",
            ));
        }
        let end = byte_offset
            .checked_add(byte_length)
            .ok_or_else(|| invalid("sparse adapter tensor payload end overflow"))?;
        let payload = bytes
            .get(byte_offset..end)
            .ok_or_else(|| invalid("sparse adapter tensor payload escapes artifact"))?;
        if read_u64(bytes, entry + 56)? != payload_checksum(payload) {
            return Err(invalid("sparse adapter tensor payload checksum mismatch"));
        }
        let mut previous_index = None;
        for pair_index in 0..byte_length / SPARSE_PAIR_LEN {
            let pair_offset = byte_offset + pair_index * SPARSE_PAIR_LEN;
            let value_index = read_u64(bytes, pair_offset)? as usize;
            if value_index >= element_count
                || previous_index.is_some_and(|previous| value_index <= previous)
            {
                return Err(invalid("sparse adapter tensor value index is invalid"));
            }
            let delta = read_f32(bytes, pair_offset + 8)?;
            if !delta.is_finite() {
                return Err(invalid("sparse adapter tensor delta is not finite"));
            }
            previous_index = Some(value_index);
        }
    }
    Ok(())
}

/// Validates the standalone ALR1 binary structure and checksums.
pub(crate) fn validate_low_rank_adapter_bytes(bytes: &[u8]) -> io::Result<()> {
    if bytes.get(0..4) != Some(LOW_RANK_MAGIC) {
        return Err(invalid("low-rank adapter artifact has invalid magic"));
    }
    let version = read_u32(bytes, 4)?;
    if version != ADAPTER_BINARY_VERSION {
        return Err(invalid("low-rank adapter artifact has unsupported version"));
    }
    let header_len = read_u32(bytes, 8)? as usize;
    if header_len != HEADER_LEN {
        return Err(invalid(
            "low-rank adapter artifact has invalid header length",
        ));
    }
    let tensor_count = read_u32(bytes, 12)? as usize;
    let entry_len = read_u32(bytes, 20)? as usize;
    if entry_len != ENTRY_LEN {
        return Err(invalid(
            "low-rank adapter artifact has invalid entry length",
        ));
    }
    let data_offset = read_u64(bytes, 48)? as usize;
    let directory_end = HEADER_LEN
        .checked_add(
            tensor_count
                .checked_mul(ENTRY_LEN)
                .ok_or_else(|| invalid("low-rank adapter directory length overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank adapter directory end overflow"))?;
    if data_offset < directory_end || !data_offset.is_multiple_of(64) {
        return Err(invalid("low-rank adapter artifact has invalid data offset"));
    }
    if read_u64(bytes, CHECKSUM_OFFSET)? != adapter_checksum(bytes)? {
        return Err(invalid("low-rank adapter artifact checksum mismatch"));
    }
    for index in 0..tensor_count {
        let entry = HEADER_LEN + index * ENTRY_LEN;
        let byte_offset = read_u64(bytes, entry + 32)? as usize;
        let byte_length = read_u64(bytes, entry + 40)? as usize;
        let element_count = read_u64(bytes, entry + 48)? as usize;
        let end = byte_offset
            .checked_add(byte_length)
            .ok_or_else(|| invalid("low-rank adapter tensor payload end overflow"))?;
        let payload = bytes
            .get(byte_offset..end)
            .ok_or_else(|| invalid("low-rank adapter tensor payload escapes artifact"))?;
        if read_u64(bytes, entry + 56)? != payload_checksum(payload) {
            return Err(invalid("low-rank adapter tensor payload checksum mismatch"));
        }
        validate_low_rank_payload(bytes, byte_offset, byte_length, element_count)?;
    }
    Ok(())
}

fn validate_low_rank_payload(
    bytes: &[u8],
    byte_offset: usize,
    byte_length: usize,
    element_count: usize,
) -> io::Result<()> {
    if byte_length == 0 {
        return Ok(());
    }
    if byte_length < LOW_RANK_HEADER_LEN {
        return Err(invalid("low-rank adapter payload is too short"));
    }
    let rows = read_u32(bytes, byte_offset)? as usize;
    let cols = read_u32(bytes, byte_offset + 4)? as usize;
    let factor_rank = read_u32(bytes, byte_offset + 8)? as usize;
    if read_u32(bytes, byte_offset + 12)? != 0
        || rows == 0
        || cols == 0
        || factor_rank == 0
        || factor_rank > MAX_LOW_RANK_COMPONENTS
        || factor_rank > rows.min(cols)
        || rows
            .checked_mul(cols)
            .ok_or_else(|| invalid("low-rank adapter shape overflow"))?
            != element_count
    {
        return Err(invalid("low-rank adapter payload shape is invalid"));
    }
    let factor_values = factor_rank
        .checked_mul(
            rows.checked_add(cols)
                .ok_or_else(|| invalid("low-rank adapter factor count overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank adapter factor count overflow"))?;
    let expected_byte_length = LOW_RANK_HEADER_LEN
        .checked_add(
            factor_values
                .checked_mul(4)
                .ok_or_else(|| invalid("low-rank adapter payload length overflow"))?,
        )
        .ok_or_else(|| invalid("low-rank adapter payload length overflow"))?;
    if byte_length != expected_byte_length {
        return Err(invalid(
            "low-rank adapter tensor byte length does not match factors",
        ));
    }
    for value_index in 0..factor_values {
        let value = read_f32(bytes, byte_offset + LOW_RANK_HEADER_LEN + value_index * 4)?;
        if !value.is_finite() {
            return Err(invalid("low-rank adapter factor is not finite"));
        }
    }
    Ok(())
}

fn adapter_checksum(bytes: &[u8]) -> io::Result<u64> {
    if bytes.len() < HEADER_LEN {
        return Err(invalid("adapter artifact is too short"));
    }
    let mut acc = 0x6164617074657231u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (CHECKSUM_OFFSET..CHECKSUM_OFFSET + 8).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 3);
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    Ok(acc)
}

fn payload_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x64656c7461663332u64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn compare_ranked_delta(left: &RankedDelta, right: &RankedDelta) -> Ordering {
    right
        .magnitude
        .partial_cmp(&left.magnitude)
        .unwrap_or(Ordering::Equal)
        .then_with(|| left.tensor_index.cmp(&right.tensor_index))
        .then_with(|| left.value_index.cmp(&right.value_index))
}

fn keep_count(total_parameter_count: u64, keep_ppm: u32) -> io::Result<u64> {
    if total_parameter_count == 0 || keep_ppm == 0 {
        return Ok(0);
    }
    let numerator =
        u128::from(total_parameter_count) * u128::from(keep_ppm) + u128::from(PPM_DENOMINATOR - 1);
    let count = numerator / u128::from(PPM_DENOMINATOR);
    u64::try_from(count).map_err(|_| invalid("sparse adapter keep count overflowed u64"))
}

fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    let ppm = u128::from(numerator) * u128::from(PPM_DENOMINATOR) / u128::from(denominator);
    u64::try_from(ppm).map_err(|_| invalid("sparse adapter ratio overflowed u64"))
}

fn sparse_mask_checksum(selected: &[&RankedDelta], total_parameter_count: u64) -> u64 {
    let mut acc = 0x6173_7031_6d61_736bu64;
    mix_sparse_value(&mut acc, total_parameter_count);
    mix_sparse_value(&mut acc, selected.len() as u64);
    for entry in selected {
        mix_sparse_value(&mut acc, entry.tensor_index as u64);
        mix_sparse_value(&mut acc, entry.value_index as u64);
    }
    acc
}

fn mix_sparse_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(11).wrapping_mul(0x1000_0000_01b3);
}

fn low_rank_matrix_shape(spec: &crate::tensor_writer::TensorSpec) -> io::Result<(usize, usize)> {
    if spec.rank < 2 {
        return Err(invalid("low-rank adapter requires a matrix tensor"));
    }
    let rows = spec.dims[0] as usize;
    if rows == 0 {
        return Err(invalid("low-rank adapter matrix row count is zero"));
    }
    let mut cols = 1usize;
    for dim in spec.dims.iter().take(spec.rank as usize).skip(1) {
        if *dim == 0 {
            return Err(invalid("low-rank adapter matrix column dimension is zero"));
        }
        cols = cols
            .checked_mul(*dim as usize)
            .ok_or_else(|| invalid("low-rank adapter matrix column count overflow"))?;
    }
    Ok((rows, cols))
}

fn low_rank_components(
    residual: &mut [f32],
    rows: usize,
    cols: usize,
    rank_limit: usize,
) -> io::Result<Vec<LowRankComponent>> {
    let mut components = Vec::new();
    for _ in 0..rank_limit {
        let mut pivot_index = None;
        let mut pivot_magnitude = 0.0f32;
        for (index, value) in residual.iter().enumerate() {
            if !value.is_finite() {
                return Err(invalid("low-rank adapter residual is not finite"));
            }
            let magnitude = value.abs();
            if magnitude > pivot_magnitude {
                pivot_magnitude = magnitude;
                pivot_index = Some(index);
            }
        }
        let Some(pivot_index) = pivot_index else {
            break;
        };
        if pivot_magnitude == 0.0 {
            break;
        }
        let pivot = residual[pivot_index];
        let pivot_row = pivot_index / cols;
        let pivot_col = pivot_index % cols;
        let mut a = vec![0.0f32; rows];
        let mut b = vec![0.0f32; cols];
        for (row, value) in a.iter_mut().enumerate().take(rows) {
            *value = residual[row * cols + pivot_col];
        }
        for (col, value) in b.iter_mut().enumerate().take(cols) {
            *value = residual[pivot_row * cols + col] / pivot;
            if !value.is_finite() {
                return Err(invalid("low-rank adapter factor is not finite"));
            }
        }
        for (row, a_value) in a.iter().copied().enumerate().take(rows) {
            for (col, b_value) in b.iter().copied().enumerate().take(cols) {
                let index = row * cols + col;
                residual[index] -= a_value * b_value;
                if !residual[index].is_finite() {
                    return Err(invalid("low-rank adapter residual update is not finite"));
                }
            }
        }
        components.push(LowRankComponent { a, b });
    }
    Ok(components)
}

fn l1_microunits(value: f64) -> io::Result<u64> {
    let scaled = (value * 1_000_000.0).round();
    if !scaled.is_finite() || scaled < 0.0 || scaled > u64::MAX as f64 {
        return Err(invalid("low-rank adapter L1 value overflow"));
    }
    Ok(scaled as u64)
}

fn parse_low_rank_components(value: &str) -> io::Result<usize> {
    let rank = value
        .parse::<usize>()
        .map_err(|_| invalid("low-rank adapter component limit must be an integer"))?;
    if rank == 0 || rank > MAX_LOW_RANK_COMPONENTS {
        return Err(invalid("low-rank adapter component limit is out of range"));
    }
    Ok(rank)
}

fn parse_delta_weight_ppm(value: &str) -> io::Result<i64> {
    let weight = value
        .parse::<i64>()
        .map_err(|_| invalid("sparse adapter weight must be an integer parts-per-million value"))?;
    if !(MIN_DELTA_WEIGHT_PPM..=MAX_DELTA_WEIGHT_PPM).contains(&weight) {
        return Err(invalid(
            "sparse adapter weight must be between -1000000 and 2000000",
        ));
    }
    Ok(weight)
}

fn parse_keep_ppm(value: &str) -> io::Result<u32> {
    let keep = value
        .parse::<u32>()
        .map_err(|_| invalid("sparse adapter keep must be an integer parts-per-million value"))?;
    if keep > PPM_DENOMINATOR {
        return Err(invalid("sparse adapter keep must be between 0 and 1000000"));
    }
    Ok(keep)
}

struct RankedDelta {
    magnitude: f32,
    tensor_index: usize,
    value_index: usize,
    delta: f32,
}

#[derive(Clone, Copy)]
struct SparseStats {
    total_parameter_count: u64,
    nonzero_delta_count: u64,
    kept_parameter_count: u64,
    pruned_parameter_count: u64,
    unchanged_parameter_count: u64,
    pruned_nonzero_delta_count: u64,
    density_ppm: u64,
    nonzero_delta_retention_ppm: u64,
    mask_checksum: u64,
}

struct LowRankComponent {
    a: Vec<f32>,
    b: Vec<f32>,
}

#[derive(Clone, Copy, Default)]
struct LowRankStats {
    parameter_count: u64,
    matrix_tensor_count: u64,
    active_tensor_count: u64,
    component_count: u64,
    matrix_parameter_count: u64,
    factor_parameter_count: u64,
    initial_l1_microunits: u64,
    residual_l1_microunits: u64,
}

impl LowRankStats {
    fn add(&mut self, tensor: LowRankTensorStats) -> io::Result<()> {
        self.parameter_count = checked_add_low_rank(self.parameter_count, tensor.parameter_count)?;
        self.matrix_tensor_count =
            checked_add_low_rank(self.matrix_tensor_count, tensor.matrix_tensor_count)?;
        self.active_tensor_count =
            checked_add_low_rank(self.active_tensor_count, tensor.active_tensor_count)?;
        self.component_count = checked_add_low_rank(self.component_count, tensor.component_count)?;
        self.matrix_parameter_count =
            checked_add_low_rank(self.matrix_parameter_count, tensor.matrix_parameter_count)?;
        self.factor_parameter_count =
            checked_add_low_rank(self.factor_parameter_count, tensor.factor_parameter_count)?;
        self.initial_l1_microunits =
            checked_add_low_rank(self.initial_l1_microunits, tensor.initial_l1_microunits)?;
        self.residual_l1_microunits =
            checked_add_low_rank(self.residual_l1_microunits, tensor.residual_l1_microunits)?;
        Ok(())
    }
}

#[derive(Clone, Copy, Default)]
struct LowRankTensorStats {
    parameter_count: u64,
    matrix_tensor_count: u64,
    active_tensor_count: u64,
    component_count: u64,
    matrix_parameter_count: u64,
    factor_parameter_count: u64,
    initial_l1_microunits: u64,
    residual_l1_microunits: u64,
}

fn checked_add_low_rank(left: u64, right: u64) -> io::Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| invalid("low-rank adapter statistic overflow"))
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

fn read_f32(bytes: &[u8], offset: usize) -> io::Result<f32> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| invalid("f32 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading f32"))?;
    Ok(f32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compatibility;
    use crate::tensor_writer::{tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use crate::{build_model_file, build_model_file_from_values_with_flags, fixture_value};

    #[test]
    fn writes_and_validates_f32_adapter_delta_artifact() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();

        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
        )
        .unwrap();
        assert_eq!(adapter.get(0..4), Some(&MAGIC[..]));
        assert!(manifest.contains("adapter_artifact_kind=raw-f32-task-delta-v1"));
        assert!(manifest.contains("adapter_apply_status=runtime-f32-compatible-or-fuse-to-slm"));
    }

    #[test]
    fn writes_and_validates_q8_adapter_delta_artifact() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-q8", "adapter-delta-v1", "tiny")
                .unwrap();

        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        validate_adapter_bytes(&adapter).unwrap();
        validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
        )
        .unwrap();
        assert!(manifest.contains("adapter_base_quantization=q8_0"));
        assert!(manifest.contains("adapter_apply_status=runtime-q8-q4-compatible-or-fuse-to-slm"));
    }

    #[test]
    fn writes_and_validates_sparse_f32_adapter_delta_artifact() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-adapter-f32",
            "sparse-adapter-delta-v1",
            "tiny",
        )
        .unwrap();

        let (adapter, manifest) = build_sparse_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.asp1",
            Some("1000000"),
            Some("250000"),
        )
        .unwrap();
        let (raw_adapter, _) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.adp1",
        )
        .unwrap();

        validate_sparse_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.asp1",
            &manifest,
        )
        .unwrap();
        assert_eq!(adapter.get(0..4), Some(&SPARSE_MAGIC[..]));
        assert!(adapter.len() < raw_adapter.len());
        assert!(manifest.contains("adapter_artifact_kind=sparse-f32-task-delta-v1"));
        assert!(manifest.contains("adapter_sparse_keep_ppm=250000"));
        assert!(manifest.contains("adapter_sparse_pair_width_bytes=12"));
        assert!(manifest.contains("adapter_sparse_mask_checksum="));
    }

    #[test]
    fn writes_and_validates_sparse_q8_adapter_delta_artifact() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-adapter-q8",
            "sparse-adapter-delta-v1",
            "tiny",
        )
        .unwrap();

        let (adapter, manifest) = build_sparse_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.asp1",
            None,
            None,
        )
        .unwrap();

        validate_sparse_adapter_bytes(&adapter).unwrap();
        validate_sparse_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.asp1",
            &manifest,
        )
        .unwrap();
        assert!(manifest.contains("adapter_base_quantization=q8_0"));
        assert!(manifest.contains("adapter_sparse_kept_parameter_count=0"));
        assert!(manifest.contains("adapter_apply_status=runtime-q8-q4-compatible-or-fuse-to-slm"));
    }

    #[test]
    fn writes_and_validates_low_rank_f32_adapter_delta_artifact() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "low-rank-adapter-f32",
            "low-rank-adapter-delta-v1",
            "tiny",
        )
        .unwrap();

        let (adapter, manifest) = build_low_rank_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.alr1",
            Some("1"),
        )
        .unwrap();

        validate_low_rank_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.alr1",
            &manifest,
        )
        .unwrap();
        assert_eq!(adapter.get(0..4), Some(&LOW_RANK_MAGIC[..]));
        assert!(manifest.contains("adapter_artifact_kind=low-rank-f32-task-delta-v1"));
        assert!(manifest.contains("adapter_low_rank_format=ALR1"));
        assert!(manifest.contains("adapter_low_rank_component_limit=1"));
        assert!(manifest.contains("adapter_apply_status=runtime-f32-compatible-low-rank"));
    }

    #[test]
    fn writes_and_validates_low_rank_q8_adapter_delta_artifact() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "low-rank-adapter-q8",
            "low-rank-adapter-delta-v1",
            "tiny",
        )
        .unwrap();

        let (adapter, manifest) = build_low_rank_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.alr1",
            None,
        )
        .unwrap();

        validate_low_rank_adapter_bytes(&adapter).unwrap();
        validate_low_rank_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.alr1",
            &manifest,
        )
        .unwrap();
        assert!(manifest.contains("adapter_base_quantization=q8_0"));
        assert!(manifest.contains("adapter_low_rank_component_count=0"));
        assert!(manifest.contains("adapter_apply_status=runtime-q8-q4-compatible-low-rank"));
    }

    #[test]
    fn fuses_f32_adapter_delta_into_slm_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        let (candidate, receipt) = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            "candidate.slm",
        )
        .unwrap();

        validate_fused_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("adapter_apply_status=fused-to-slm-candidate"));
        assert!(
            receipt.contains("required_next_gate=candidate-manifest-plus-runtime-smoke-plus-eval")
        );

        let candidate_model = parse_model_values(&candidate).unwrap();
        let target_model = parse_model_values(&target).unwrap();
        for (candidate_tensor, target_tensor) in candidate_model
            .tensors
            .iter()
            .zip(target_model.tensors.iter())
        {
            require_same_tensor_spec(&candidate_tensor.spec, &target_tensor.spec).unwrap();
            for (candidate_value, target_value) in candidate_tensor
                .values
                .iter()
                .zip(target_tensor.values.iter())
            {
                assert!((candidate_value - target_value).abs() < 0.000001);
            }
        }
    }

    #[test]
    fn fuses_q8_adapter_delta_into_slm_candidate() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-q8", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        let (candidate, receipt) = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            "candidate.slm",
        )
        .unwrap();

        slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        validate_fused_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("candidate_quantization=q8_0"));
    }

    #[test]
    fn rejects_parent_checksum_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let changed_base = tiny_f32_scaled_bytes(2.0);

        let error = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &changed_base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    #[test]
    fn validation_rejects_adapter_byte_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (mut adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let last = adapter.len() - 1;
        adapter[last] ^= 0x01;

        let error = validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("artifact bytes"));
    }

    #[test]
    fn validation_rejects_manifest_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let changed_manifest = manifest.replace(
            "adapter_apply_status=runtime-f32-compatible-or-fuse-to-slm",
            "adapter_apply_status=fused",
        );

        let error = validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &changed_manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest fields"));
    }

    #[test]
    fn fuse_rejects_adapter_manifest_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let changed_manifest = manifest.replace(
            "adapter_apply_status=runtime-f32-compatible-or-fuse-to-slm",
            "adapter_apply_status=fused",
        );

        let error = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &changed_manifest,
            "candidate.slm",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest fields"));
    }

    #[test]
    fn validation_rejects_fused_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let (mut candidate, receipt) = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            "candidate.slm",
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_fused_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
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
            &crate::tensor_writer::ModelShape::tiny_fixture(),
            &tensors,
            &ByteTokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap()
    }

    fn tiny_q8_bytes() -> Vec<u8> {
        build_model_file(
            &crate::tensor_writer::ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
