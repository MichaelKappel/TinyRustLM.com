//! Offline sparse task-delta operator for model-breeding candidates.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{
    hex64, invalid, output_specs, parse_manifest, parse_model_values, parse_passing_compatibility,
    push_line, push_parent_lines, require_equal, require_key, require_parent_report,
    require_report_equal, require_same_tensor_spec, same_shape, ParsedModel, PPM_DENOMINATOR,
};
use crate::build_model_file_from_values_with_flags;
use crate::lineage;
use crate::slm_validate::{self, ValidationReport};

const SPARSE_DELTA_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "sparse-direct-parameter-task-delta";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const DEFAULT_DELTA_WEIGHT_PPM: &str = "1000000";
const DEFAULT_KEEP_PPM: &str = "250000";
const MASK_METADATA_VERSION: &str = "1";
const MASK_METADATA_KIND: &str = "implicit-top-k-absolute-delta-mask";
const MASK_RETENTION_SCOPE: &str = "nonzero-target-minus-base-deltas";
const MIN_DELTA_WEIGHT_PPM: i64 = -1_000_000;
const MAX_DELTA_WEIGHT_PPM: i64 = 2_000_000;

/// Writes a sparse task-delta candidate `.slm` plus a recomputable receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    delta_weight_ppm: Option<&str>,
    keep_ppm: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let weight = parse_delta_weight_ppm(delta_weight_ppm.unwrap_or(DEFAULT_DELTA_WEIGHT_PPM))?;
    let keep = parse_keep_ppm(keep_ppm.unwrap_or(DEFAULT_KEEP_PPM))?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &output_slm.display().to_string(),
        weight,
        keep,
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
        "SLM sparse task-delta candidate written: {}",
        output_slm.display()
    );
    println!(
        "SLM sparse task-delta operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a sparse task-delta candidate and receipt by recomputing output.
pub(crate) fn validate_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    candidate_slm: &Path,
    receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_candidate_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
    )?;
    println!("SLM sparse task-delta candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

fn validate_candidate_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "sparse task-delta operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_sparse_delta_operator_version",
        SPARSE_DELTA_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "delta_weight_unit", "parts-per-million")?;
    require_equal(&receipt, "base_parent_index", "0")?;
    require_equal(&receipt, "target_parent_index", "1")?;
    let weight = parse_delta_weight_ppm(require_key(&receipt, "delta_weight_ppm")?)?;
    let keep = parse_keep_ppm(require_key(&receipt, "sparse_keep_ppm")?)?;
    require_equal(
        &receipt,
        "base_coefficient_ppm",
        &(i64::from(PPM_DENOMINATOR) - weight).to_string(),
    )?;
    require_equal(
        &receipt,
        "target_delta_coefficient_ppm",
        &weight.to_string(),
    )?;
    require_equal(&receipt, "sparse_keep_unit", "parts-per-million")?;
    require_equal(
        &receipt,
        "sparse_selection_metric",
        "absolute-target-minus-base-delta",
    )?;
    require_equal(
        &receipt,
        "sparse_selection_scope",
        "compatible-parent-tensor-values",
    )?;
    require_equal(
        &receipt,
        "sparse_tie_break",
        "tensor-order-then-element-index",
    )?;
    require_equal(
        &receipt,
        "sparse_mask_metadata_version",
        MASK_METADATA_VERSION,
    )?;
    require_equal(&receipt, "sparse_mask_kind", MASK_METADATA_KIND)?;
    require_equal(&receipt, "sparse_retention_scope", MASK_RETENTION_SCOPE)?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        candidate_path,
        weight,
        keep,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "sparse task-delta candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "sparse task-delta operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn build_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    candidate_path: &str,
    delta_weight_ppm: i64,
    keep_ppm: u32,
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
    let (output_values, sparse_stats) =
        sparse_delta_values(&base, &target, delta_weight_ppm, keep_ppm)?;
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
    let receipt = build_receipt_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        &candidate_report,
        delta_weight_ppm,
        keep_ppm,
        sparse_stats,
    )?;
    Ok((candidate, receipt))
}

#[allow(clippy::too_many_arguments)]
fn build_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    candidate_report: &ValidationReport,
    delta_weight_ppm: i64,
    keep_ppm: u32,
    sparse_stats: SparseStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_sparse_delta_operator_version",
        SPARSE_DELTA_OPERATOR_VERSION,
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
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "delta_weight_unit", "parts-per-million");
    push_line(&mut text, "base_parent_index", "0");
    push_line(&mut text, "target_parent_index", "1");
    push_line(&mut text, "delta_weight_ppm", &delta_weight_ppm.to_string());
    push_line(
        &mut text,
        "base_coefficient_ppm",
        &(i64::from(PPM_DENOMINATOR) - delta_weight_ppm).to_string(),
    );
    push_line(
        &mut text,
        "target_delta_coefficient_ppm",
        &delta_weight_ppm.to_string(),
    );
    push_line(&mut text, "sparse_keep_unit", "parts-per-million");
    push_line(&mut text, "sparse_keep_ppm", &keep_ppm.to_string());
    push_line(
        &mut text,
        "sparse_selection_metric",
        "absolute-target-minus-base-delta",
    );
    push_line(
        &mut text,
        "sparse_selection_scope",
        "compatible-parent-tensor-values",
    );
    push_line(
        &mut text,
        "sparse_tie_break",
        "tensor-order-then-element-index",
    );
    push_line(
        &mut text,
        "sparse_total_parameter_count",
        &sparse_stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "sparse_nonzero_delta_count",
        &sparse_stats.nonzero_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "sparse_kept_parameter_count",
        &sparse_stats.kept_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "sparse_pruned_parameter_count",
        &sparse_stats.pruned_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "sparse_unchanged_parameter_count",
        &sparse_stats.unchanged_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "sparse_pruned_nonzero_delta_count",
        &sparse_stats.pruned_nonzero_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "sparse_density_ppm",
        &sparse_stats.density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "sparse_nonzero_delta_retention_ppm",
        &sparse_stats.nonzero_delta_retention_ppm.to_string(),
    );
    push_line(
        &mut text,
        "sparse_mask_metadata_version",
        MASK_METADATA_VERSION,
    );
    push_line(&mut text, "sparse_mask_kind", MASK_METADATA_KIND);
    push_line(&mut text, "sparse_retention_scope", MASK_RETENTION_SCOPE);
    push_line(
        &mut text,
        "sparse_mask_checksum",
        &hex64(sparse_stats.mask_checksum),
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

fn sparse_delta_values(
    base: &ParsedModel,
    target: &ParsedModel,
    delta_weight_ppm: i64,
    keep_ppm: u32,
) -> io::Result<(Vec<Vec<f32>>, SparseStats)> {
    if !same_shape(&base.shape, &target.shape) {
        return Err(invalid(
            "sparse task-delta parents have different model shapes",
        ));
    }
    if base.flags != target.flags {
        return Err(invalid(
            "sparse task-delta parents have different output flags",
        ));
    }
    if base.tokenizer.bytes != target.tokenizer.bytes {
        return Err(invalid(
            "sparse task-delta parents have different tokenizer bytes",
        ));
    }
    let target_by_hash = target
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let mut output = base
        .tensors
        .iter()
        .map(|tensor| tensor.values.clone())
        .collect::<Vec<_>>();
    let mut ranked = Vec::new();
    let mut total_parameter_count = 0u64;
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let Some(target_index) = target_by_hash.get(&base_tensor.spec.name_hash) else {
            return Err(invalid(
                "target parent is missing a tensor from the base parent",
            ));
        };
        let target_tensor = &target.tensors[*target_index];
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
    for entry in &selected {
        output[entry.tensor_index][entry.value_index] += entry.delta * delta_weight;
    }
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
    Ok((output, stats))
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
    u64::try_from(count).map_err(|_| invalid("sparse keep count overflowed u64"))
}

fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    let ppm = u128::from(numerator) * u128::from(PPM_DENOMINATOR) / u128::from(denominator);
    u64::try_from(ppm).map_err(|_| invalid("sparse ratio overflowed u64"))
}

fn sparse_mask_checksum(selected: &[&RankedDelta], total_parameter_count: u64) -> u64 {
    let mut acc = 0x7265_7461_696e_6d31u64;
    mix_mask_value(&mut acc, total_parameter_count);
    mix_mask_value(&mut acc, selected.len() as u64);
    for entry in selected {
        mix_mask_value(&mut acc, entry.tensor_index as u64);
        mix_mask_value(&mut acc, entry.value_index as u64);
    }
    acc
}

fn mix_mask_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(11).wrapping_mul(0x1000_0000_01b3);
}

fn parse_delta_weight_ppm(value: &str) -> io::Result<i64> {
    let weight = value.parse::<i64>().map_err(|_| {
        invalid("sparse task-delta weight must be an integer parts-per-million value")
    })?;
    if !(MIN_DELTA_WEIGHT_PPM..=MAX_DELTA_WEIGHT_PPM).contains(&weight) {
        return Err(invalid(
            "sparse task-delta weight must be between -1000000 and 2000000",
        ));
    }
    Ok(weight)
}

fn parse_keep_ppm(value: &str) -> io::Result<u32> {
    let keep = value
        .parse::<u32>()
        .map_err(|_| invalid("sparse keep must be an integer parts-per-million value"))?;
    if keep > PPM_DENOMINATOR {
        return Err(invalid("sparse keep must be between 0 and 1000000"));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compatibility;
    use crate::tensor_writer::{tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use crate::{build_model_file_from_values_with_flags, fixture_value};

    #[test]
    fn writes_and_validates_sparse_f32_task_delta_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_index_delta_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-f32",
            "sparse-task-vector",
            "tiny",
        )
        .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            250_000,
        )
        .unwrap();

        validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        let base_values = parse_model_values(&base).unwrap();
        let candidate_values = parse_model_values(&candidate).unwrap();
        let target_values = parse_model_values(&target).unwrap();
        let mut base_preserved = 0usize;
        let mut target_selected = 0usize;
        for ((candidate_tensor, base_tensor), target_tensor) in candidate_values
            .tensors
            .iter()
            .zip(base_values.tensors.iter())
            .zip(target_values.tensors.iter())
        {
            for ((candidate_value, base_value), target_value) in candidate_tensor
                .values
                .iter()
                .zip(base_tensor.values.iter())
                .zip(target_tensor.values.iter())
            {
                if candidate_value == base_value {
                    base_preserved += 1;
                }
                if candidate_value == target_value {
                    target_selected += 1;
                }
            }
        }
        assert!(base_preserved > 0);
        assert!(target_selected > 0);
        assert!(receipt.contains("operator_kind=sparse-direct-parameter-task-delta"));
        assert!(receipt.contains("sparse_keep_ppm=250000"));
        assert!(receipt.contains("sparse_kept_parameter_count="));
        assert!(receipt.contains("sparse_mask_metadata_version=1"));
        assert!(receipt.contains("sparse_mask_kind=implicit-top-k-absolute-delta-mask"));
        assert!(receipt.contains("sparse_mask_checksum="));
        assert!(receipt.contains("sparse_nonzero_delta_retention_ppm="));
    }

    #[test]
    fn keep_all_matches_target_values_for_f32_task_delta() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-all",
            "sparse-task-vector",
            "tiny",
        )
        .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            1_000_000,
        )
        .unwrap();

        let candidate_values = parse_model_values(&candidate).unwrap();
        let target_values = parse_model_values(&target).unwrap();
        for (candidate_tensor, target_tensor) in candidate_values
            .tensors
            .iter()
            .zip(target_values.tensors.iter())
        {
            assert_eq!(candidate_tensor.values, target_tensor.values);
        }
        assert!(receipt.contains("sparse_keep_ppm=1000000"));
        assert!(receipt.contains("sparse_pruned_nonzero_delta_count=0"));
        assert!(receipt.contains("sparse_nonzero_delta_retention_ppm=1000000"));
    }

    #[test]
    fn keep_zero_preserves_base_values_for_f32_task_delta() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-zero",
            "sparse-task-vector",
            "tiny",
        )
        .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            0,
        )
        .unwrap();

        let candidate_values = parse_model_values(&candidate).unwrap();
        let base_values = parse_model_values(&base).unwrap();
        for (candidate_tensor, base_tensor) in candidate_values
            .tensors
            .iter()
            .zip(base_values.tensors.iter())
        {
            assert_eq!(candidate_tensor.values, base_tensor.values);
        }
        assert!(receipt.contains("sparse_kept_parameter_count=0"));
        assert!(receipt.contains("sparse_density_ppm=0"));
        assert!(receipt.contains("sparse_nonzero_delta_retention_ppm=0"));
        assert!(receipt.contains("sparse_retention_scope=nonzero-target-minus-base-deltas"));
    }

    #[test]
    fn sparse_mask_checksum_changes_with_selected_positions() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_index_delta_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-mask",
            "sparse-task-vector",
            "tiny",
        )
        .unwrap();

        let (_, sparse_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "sparse.slm",
            1_000_000,
            250_000,
        )
        .unwrap();
        let (_, denser_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "dense.slm",
            1_000_000,
            500_000,
        )
        .unwrap();

        let sparse_fields = parse_manifest(&sparse_receipt, "sparse receipt").unwrap();
        let denser_fields = parse_manifest(&denser_receipt, "denser receipt").unwrap();
        assert_ne!(
            sparse_fields.get("sparse_mask_checksum"),
            denser_fields.get("sparse_mask_checksum")
        );
        assert_ne!(
            sparse_fields.get("sparse_density_ppm"),
            denser_fields.get("sparse_density_ppm")
        );
    }

    #[test]
    fn writes_and_validates_sparse_q8_task_delta_candidate() {
        let base = tiny_q8_scaled_bytes(1.0);
        let target = tiny_q8_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "sparse-q8", "sparse-task-vector", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            500_000,
            500_000,
        )
        .unwrap();

        slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("candidate_quantization=q8_0"));
    }

    #[test]
    fn validation_rejects_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            "sparse-drift",
            "sparse-task-vector",
            "tiny",
        )
        .unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            250_000,
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    #[test]
    fn rejects_invalid_sparse_parameters() {
        assert_eq!(
            parse_delta_weight_ppm("-1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_delta_weight_ppm("2000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_delta_weight_ppm("1.5").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_keep_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_keep_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_keep_ppm("half").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    fn tiny_f32_scaled_bytes(scale: f32) -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |tensor, index, _tensor_index| {
            fixture_value(tensor, index) * scale
        })
    }

    fn tiny_f32_index_delta_bytes() -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |tensor, index, tensor_index| {
            fixture_value(tensor, index) + ((tensor_index + index) as f32 * 0.001)
        })
    }

    fn tiny_q8_scaled_bytes(scale: f32) -> Vec<u8> {
        build_tiny_bytes(
            tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            |tensor, index, _tensor_index| fixture_value(tensor, index) * scale,
        )
    }

    fn build_tiny_bytes<F>(tensors: Vec<crate::tensor_writer::TensorSpec>, mut value: F) -> Vec<u8>
    where
        F: FnMut(&crate::tensor_writer::TensorSpec, usize, usize) -> f32,
    {
        let values = tensors
            .iter()
            .enumerate()
            .map(|(tensor_index, tensor)| {
                (0..tensor.element_count())
                    .map(|index| value(tensor, index, tensor_index))
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
}
