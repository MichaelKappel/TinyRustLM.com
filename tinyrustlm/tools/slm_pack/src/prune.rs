//! Offline deterministic magnitude pruning operator for model-breeding candidates.

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

const PRUNE_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "deterministic-magnitude-parameter-pruning";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const DEFAULT_KEEP_PPM: &str = "750000";
const DEFAULT_FLOOR_PPM: &str = "0";
const SELECTION_METRIC: &str = "largest-compatible-magnitude-with-floor";
const SELECTION_SCOPE: &str = "compatible-base-tensor-values";
const TIE_BREAK: &str = "lower-tensor-index-then-lower-element-index";
const VALUE_SOURCE: &str = "base-parent-kept-values-else-zero";
const FLOOR_UNIT: &str = "parts-per-million-of-max-parent-magnitude";

/// Writes a pruned candidate `.slm` plus a recomputable operator receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    reference_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    keep_ppm: Option<&str>,
    floor_ppm: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let reference_bytes = fs::read(reference_parent)?;
    let keep = parse_keep_ppm(keep_ppm.unwrap_or(DEFAULT_KEEP_PPM))?;
    let floor = parse_floor_ppm(floor_ppm.unwrap_or(DEFAULT_FLOOR_PPM))?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &reference_bytes,
        &reference_parent.display().to_string(),
        &output_slm.display().to_string(),
        keep,
        floor,
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, receipt)?;
    println!("SLM prune candidate written: {}", output_slm.display());
    println!(
        "SLM prune operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a prune candidate and receipt by recomputing the operator output.
pub(crate) fn validate_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    reference_parent: &Path,
    candidate_slm: &Path,
    receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let reference_bytes = fs::read(reference_parent)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_candidate_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &reference_bytes,
        &reference_parent.display().to_string(),
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
    )?;
    println!("SLM prune candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

/// Recomputes prune output from receipt fields and compares both artifacts.
fn validate_candidate_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    reference_bytes: &[u8],
    reference_path: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "prune operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_prune_operator_version",
        PRUNE_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", OPERATOR_KIND)?;
    require_equal(&receipt, "base_parent_index", "0")?;
    require_equal(&receipt, "reference_parent_index", "1")?;
    require_equal(&receipt, "prune_keep_unit", "parts-per-million")?;
    require_equal(&receipt, "prune_floor_unit", FLOOR_UNIT)?;
    require_equal(&receipt, "prune_selection_metric", SELECTION_METRIC)?;
    require_equal(&receipt, "prune_selection_scope", SELECTION_SCOPE)?;
    require_equal(&receipt, "prune_tie_break", TIE_BREAK)?;
    require_equal(&receipt, "prune_value_source", VALUE_SOURCE)?;
    let keep = parse_keep_ppm(require_key(&receipt, "prune_keep_ppm")?)?;
    let floor = parse_floor_ppm(require_key(&receipt, "prune_floor_ppm")?)?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        reference_bytes,
        reference_path,
        candidate_path,
        keep,
        floor,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "prune candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "prune operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Builds the pruned `.slm` bytes and receipt that can reproduce them.
fn build_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    reference_bytes: &[u8],
    reference_path: &str,
    candidate_path: &str,
    keep_ppm: u32,
    floor_ppm: u32,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let reference_report = slm_validate::validate_bytes(reference_bytes, reference_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &reference_report)?;

    let base = parse_model_values(base_bytes)?;
    let reference = parse_model_values(reference_bytes)?;
    let (output_values, prune_stats) = prune_values(&base, &reference, keep_ppm, floor_ppm)?;
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
        reference_path,
        &base_report,
        &reference_report,
        &candidate_report,
        keep_ppm,
        floor_ppm,
        prune_stats,
    )?;
    Ok((candidate, receipt))
}

/// Formats the manifest-style receipt for a deterministic prune candidate.
#[allow(clippy::too_many_arguments)]
fn build_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    reference_path: &str,
    base_report: &ValidationReport,
    reference_report: &ValidationReport,
    candidate_report: &ValidationReport,
    keep_ppm: u32,
    floor_ppm: u32,
    prune_stats: PruneStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_prune_operator_version",
        PRUNE_OPERATOR_VERSION,
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
    push_parent_lines(
        &mut text,
        compatibility,
        1,
        reference_path,
        reference_report,
    )?;
    push_line(&mut text, "base_parent_index", "0");
    push_line(&mut text, "reference_parent_index", "1");
    push_line(&mut text, "prune_keep_unit", "parts-per-million");
    push_line(&mut text, "prune_keep_ppm", &keep_ppm.to_string());
    push_line(&mut text, "prune_floor_unit", FLOOR_UNIT);
    push_line(&mut text, "prune_floor_ppm", &floor_ppm.to_string());
    push_line(&mut text, "prune_selection_metric", SELECTION_METRIC);
    push_line(&mut text, "prune_selection_scope", SELECTION_SCOPE);
    push_line(&mut text, "prune_tie_break", TIE_BREAK);
    push_line(&mut text, "prune_value_source", VALUE_SOURCE);
    push_line(
        &mut text,
        "prune_total_parameter_count",
        &prune_stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "prune_requested_keep_count",
        &prune_stats.requested_keep_count.to_string(),
    );
    push_line(
        &mut text,
        "prune_kept_parameter_count",
        &prune_stats.kept_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "prune_pruned_parameter_count",
        &prune_stats.pruned_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "prune_changed_parameter_count",
        &prune_stats.changed_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "prune_keep_density_ppm",
        &prune_stats.keep_density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "prune_max_magnitude_bits",
        &format!("0x{:08x}", prune_stats.max_magnitude_bits),
    );
    push_line(
        &mut text,
        "prune_floor_threshold_bits",
        &format!("0x{:08x}", prune_stats.floor_threshold_bits),
    );
    push_line(
        &mut text,
        "prune_mask_checksum",
        &hex64(prune_stats.mask_checksum),
    );
    push_line(
        &mut text,
        "prune_output_value_checksum",
        &hex64(prune_stats.output_value_checksum),
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

/// Applies deterministic magnitude pruning and returns output values plus receipt stats.
fn prune_values(
    base: &ParsedModel,
    reference: &ParsedModel,
    keep_ppm: u32,
    floor_ppm: u32,
) -> io::Result<(Vec<Vec<f32>>, PruneStats)> {
    if !same_shape(&base.shape, &reference.shape) {
        return Err(invalid("prune parents have different model shapes"));
    }
    if base.flags != reference.flags {
        return Err(invalid("prune parents have different output flags"));
    }
    if base.tokenizer.bytes != reference.tokenizer.bytes {
        return Err(invalid("prune parents have different tokenizer bytes"));
    }
    let reference_by_hash = reference
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let mut ranked = Vec::new();
    let mut total_parameter_count = 0u64;
    let mut max_magnitude = 0.0f32;
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let Some(reference_index) = reference_by_hash.get(&base_tensor.spec.name_hash) else {
            return Err(invalid(
                "reference parent is missing a tensor from the base parent",
            ));
        };
        let reference_tensor = &reference.tensors[*reference_index];
        require_same_tensor_spec(&base_tensor.spec, &reference_tensor.spec)?;
        total_parameter_count += base_tensor.values.len() as u64;
        for (value_index, (base_value, reference_value)) in base_tensor
            .values
            .iter()
            .zip(reference_tensor.values.iter())
            .enumerate()
        {
            let score = base_value.abs().max(reference_value.abs());
            if !score.is_finite() {
                return Err(invalid("prune score is not finite"));
            }
            max_magnitude = max_magnitude.max(score);
            ranked.push(RankedMagnitude {
                score,
                tensor_index,
                value_index,
            });
        }
    }
    ranked.sort_by(compare_ranked_magnitude);
    let requested_keep_count = keep_count(total_parameter_count, keep_ppm)?;
    let floor_threshold = max_magnitude * (floor_ppm as f32 / PPM_DENOMINATOR as f32);
    let mut keep_masks = base
        .tensors
        .iter()
        .map(|tensor| vec![false; tensor.values.len()])
        .collect::<Vec<_>>();
    for (rank, entry) in ranked.iter().enumerate() {
        if rank as u64 >= requested_keep_count {
            break;
        }
        if entry.score >= floor_threshold {
            keep_masks[entry.tensor_index][entry.value_index] = true;
        }
    }
    let mut output = Vec::with_capacity(base.tensors.len());
    let mut stats = PruneStats {
        total_parameter_count,
        requested_keep_count,
        kept_parameter_count: 0,
        pruned_parameter_count: 0,
        changed_parameter_count: 0,
        keep_density_ppm: 0,
        max_magnitude_bits: max_magnitude.to_bits(),
        floor_threshold_bits: floor_threshold.to_bits(),
        mask_checksum: prune_mask_seed(keep_ppm, floor_ppm, floor_threshold),
        output_value_checksum: prune_value_seed(keep_ppm, floor_ppm),
    };
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let mut values = Vec::with_capacity(base_tensor.values.len());
        for (value_index, base_value) in base_tensor.values.iter().enumerate() {
            let keep = keep_masks[tensor_index][value_index];
            let output_value = if keep { *base_value } else { 0.0 };
            if keep {
                stats.kept_parameter_count += 1;
            } else {
                stats.pruned_parameter_count += 1;
            }
            if output_value != *base_value {
                stats.changed_parameter_count += 1;
            }
            mix_mask_value(&mut stats.mask_checksum, tensor_index as u64);
            mix_mask_value(&mut stats.mask_checksum, value_index as u64);
            mix_mask_value(&mut stats.mask_checksum, if keep { 1 } else { 0 });
            mix_value_checksum(&mut stats.output_value_checksum, tensor_index as u64);
            mix_value_checksum(&mut stats.output_value_checksum, value_index as u64);
            mix_value_checksum(
                &mut stats.output_value_checksum,
                u64::from(output_value.to_bits()),
            );
            values.push(output_value);
        }
        output.push(values);
    }
    stats.keep_density_ppm = ratio_ppm(stats.kept_parameter_count, stats.total_parameter_count)?;
    mix_mask_value(&mut stats.mask_checksum, stats.total_parameter_count);
    mix_mask_value(&mut stats.mask_checksum, stats.kept_parameter_count);
    mix_mask_value(&mut stats.mask_checksum, stats.pruned_parameter_count);
    mix_value_checksum(
        &mut stats.output_value_checksum,
        stats.changed_parameter_count,
    );
    Ok((output, stats))
}

/// Orders pruning candidates by descending magnitude with stable coordinate ties.
fn compare_ranked_magnitude(left: &RankedMagnitude, right: &RankedMagnitude) -> Ordering {
    right
        .score
        .total_cmp(&left.score)
        .then_with(|| left.tensor_index.cmp(&right.tensor_index))
        .then_with(|| left.value_index.cmp(&right.value_index))
}

/// Converts a keep rate into a deterministic ceil-count for selected parameters.
fn keep_count(total_parameter_count: u64, keep_ppm: u32) -> io::Result<u64> {
    if total_parameter_count == 0 || keep_ppm == 0 {
        return Ok(0);
    }
    let numerator =
        u128::from(total_parameter_count) * u128::from(keep_ppm) + u128::from(PPM_DENOMINATOR - 1);
    let count = numerator / u128::from(PPM_DENOMINATOR);
    u64::try_from(count).map_err(|_| invalid("prune keep count overflowed u64"))
}

/// Converts a count ratio into integer parts-per-million.
fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    let ppm = u128::from(numerator) * u128::from(PPM_DENOMINATOR) / u128::from(denominator);
    u64::try_from(ppm).map_err(|_| invalid("prune ratio overflowed u64"))
}

/// Starts the pruning mask checksum from operator parameters and floor threshold.
fn prune_mask_seed(keep_ppm: u32, floor_ppm: u32, floor_threshold: f32) -> u64 {
    let mut acc = 0x7072_756e_656d_7631u64;
    mix_mask_value(&mut acc, u64::from(keep_ppm));
    mix_mask_value(&mut acc, u64::from(floor_ppm));
    mix_mask_value(&mut acc, u64::from(floor_threshold.to_bits()));
    acc
}

/// Starts the output-value checksum from operator parameters.
fn prune_value_seed(keep_ppm: u32, floor_ppm: u32) -> u64 {
    let mut acc = 0x7072_756e_6576_7631u64;
    mix_value_checksum(&mut acc, u64::from(keep_ppm));
    mix_value_checksum(&mut acc, u64::from(floor_ppm));
    acc
}

/// Folds one mask decision ingredient into a compact deterministic checksum.
fn mix_mask_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(11).wrapping_mul(0x1000_0000_01b3);
}

/// Folds one output-value ingredient into a compact deterministic checksum.
fn mix_value_checksum(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0xbf58_476d_1ce4_e5b9);
    *acc = acc.rotate_left(13).wrapping_mul(0x1000_0000_01b3);
}

/// Parses pruning retention as an integer parts-per-million value.
fn parse_keep_ppm(value: &str) -> io::Result<u32> {
    let keep = value
        .parse::<u32>()
        .map_err(|_| invalid("prune keep must be an integer parts-per-million value"))?;
    if keep > PPM_DENOMINATOR {
        return Err(invalid("prune keep must be between 0 and 1000000"));
    }
    Ok(keep)
}

/// Parses pruning floor as an integer parts-per-million value.
fn parse_floor_ppm(value: &str) -> io::Result<u32> {
    let floor = value
        .parse::<u32>()
        .map_err(|_| invalid("prune floor must be an integer parts-per-million value"))?;
    if floor > PPM_DENOMINATOR {
        return Err(invalid("prune floor must be between 0 and 1000000"));
    }
    Ok(floor)
}

/// Holds one magnitude-ranked parameter coordinate.
struct RankedMagnitude {
    score: f32,
    tensor_index: usize,
    value_index: usize,
}

/// Holds deterministic pruning counts and checksum metadata.
#[derive(Clone, Copy)]
struct PruneStats {
    total_parameter_count: u64,
    requested_keep_count: u64,
    kept_parameter_count: u64,
    pruned_parameter_count: u64,
    changed_parameter_count: u64,
    keep_density_ppm: u64,
    max_magnitude_bits: u32,
    floor_threshold_bits: u32,
    mask_checksum: u64,
    output_value_checksum: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compatibility;
    use crate::tensor_writer::{tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use crate::{build_model_file_from_values_with_flags, fixture_value};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Exercises keep and floor parameters through candidate writing and receipt validation.
    #[test]
    fn writes_and_validates_prune_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-f32", "prune-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            500_000,
            0,
        )
        .unwrap();

        validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(any_value_differs(&candidate, &base));
        assert!(receipt.contains("operator_kind=deterministic-magnitude-parameter-pruning"));
        assert!(receipt.contains("prune_keep_ppm=500000"));
        assert!(receipt.contains("prune_floor_ppm=0"));
        assert!(receipt.contains("prune_mask_checksum="));
        assert!(receipt.contains("prune_output_value_checksum="));
    }

    // Exercises all path-level inputs plus default keep and floor parameters.
    #[test]
    fn path_writer_uses_default_parameters_then_validates() {
        let dir = unique_dir("path-defaults");
        fs::create_dir_all(&dir).unwrap();
        let base_path = dir.join("base.slm");
        let reference_path = dir.join("reference.slm");
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        fs::write(&base_path, &base).unwrap();
        fs::write(&reference_path, &reference).unwrap();
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            &base_path.display().to_string(),
            &reference,
            &reference_path.display().to_string(),
        )
        .unwrap();
        fs::write(&compatibility_path, &compatibility).unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-path", "prune-v1", "tiny").unwrap();
        fs::write(&lineage_path, &lineage).unwrap();

        write_candidate_path(
            &compatibility_path,
            &lineage_path,
            &base_path,
            &reference_path,
            &candidate_path,
            &receipt_path,
            None,
            None,
        )
        .unwrap();
        validate_candidate_path(
            &compatibility_path,
            &lineage_path,
            &base_path,
            &reference_path,
            &candidate_path,
            &receipt_path,
        )
        .unwrap();

        let receipt = fs::read_to_string(receipt_path).unwrap();
        assert!(receipt.contains("prune_keep_ppm=750000"));
        assert!(receipt.contains("prune_floor_ppm=0"));
    }

    // Covers the keep_ppm lower boundary where every base value is pruned.
    #[test]
    fn keep_zero_prunes_all_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-zero", "prune-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            0,
            0,
        )
        .unwrap();

        let candidate_values = parse_model_values(&candidate).unwrap();
        for tensor in candidate_values.tensors {
            assert!(tensor.values.iter().all(|value| *value == 0.0));
        }
        assert!(receipt.contains("prune_kept_parameter_count=0"));
        assert!(receipt.contains("prune_keep_density_ppm=0"));
    }

    // Covers the keep_ppm upper boundary where floor zero preserves the base.
    #[test]
    fn keep_all_preserves_base_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-all", "prune-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            1_000_000,
            0,
        )
        .unwrap();

        assert_same_values(&candidate, &base);
        assert!(receipt.contains("prune_pruned_parameter_count=0"));
        assert!(receipt.contains("prune_keep_density_ppm=1000000"));
    }

    // Confirms floor_ppm can prune lower-magnitude values inside the keep set.
    #[test]
    fn floor_ppm_changes_candidate_values() {
        let base = tiny_f32_descending_bytes();
        let reference = tiny_f32_descending_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-floor", "prune-v1", "tiny")
                .unwrap();

        let (no_floor, no_floor_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "no-floor.slm",
            1_000_000,
            0,
        )
        .unwrap();
        let (high_floor, high_floor_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "high-floor.slm",
            1_000_000,
            900_000,
        )
        .unwrap();

        assert_ne!(no_floor, high_floor);
        assert_same_values(&no_floor, &base);
        assert_ne!(
            parse_manifest(&no_floor_receipt, "no floor").unwrap()["prune_mask_checksum"],
            parse_manifest(&high_floor_receipt, "high floor").unwrap()["prune_mask_checksum"]
        );
        assert!(high_floor_receipt.contains("prune_floor_ppm=900000"));
    }

    // Confirms the compatible reference parent participates in magnitude ranking.
    #[test]
    fn reference_parent_magnitude_changes_mask() {
        let base = tiny_f32_uniform_bytes();
        let reference_a = tiny_f32_with_spike(0, 0, 1000.0);
        let reference_b = tiny_f32_with_spike(0, 1, 1000.0);
        let compatibility_a = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &reference_a,
            "ref-a.slm",
        )
        .unwrap();
        let compatibility_b = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &reference_b,
            "ref-b.slm",
        )
        .unwrap();
        let lineage_a =
            lineage::build_template_text(&compatibility_a, "prune-ref-a", "prune-v1", "tiny")
                .unwrap();
        let lineage_b =
            lineage::build_template_text(&compatibility_b, "prune-ref-b", "prune-v1", "tiny")
                .unwrap();

        let (candidate_a, receipt_a) = build_candidate_bytes_and_receipt(
            &compatibility_a,
            &lineage_a,
            &base,
            "base.slm",
            &reference_a,
            "ref-a.slm",
            "candidate-a.slm",
            1,
            0,
        )
        .unwrap();
        let (candidate_b, receipt_b) = build_candidate_bytes_and_receipt(
            &compatibility_b,
            &lineage_b,
            &base,
            "base.slm",
            &reference_b,
            "ref-b.slm",
            "candidate-b.slm",
            1,
            0,
        )
        .unwrap();

        assert_ne!(candidate_a, candidate_b);
        assert_ne!(
            parse_manifest(&receipt_a, "receipt a").unwrap()["prune_mask_checksum"],
            parse_manifest(&receipt_b, "receipt b").unwrap()["prune_mask_checksum"]
        );
    }

    // Validates q8 parents keep their quantization route through pruning output.
    #[test]
    fn writes_and_validates_q8_prune_candidate() {
        let base = tiny_q8_scaled_bytes(1.0);
        let reference = tiny_q8_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-q8", "prune-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            500_000,
            0,
        )
        .unwrap();

        slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("candidate_quantization=q8_0"));
    }

    // Confirms base parameters are tied to compatibility receipts by checksum.
    #[test]
    fn rejects_parent_checksum_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-drift", "prune-v1", "tiny")
                .unwrap();
        let changed_base = tiny_f32_scaled_bytes(3.0);

        let error = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &changed_base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            500_000,
            0,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    // Confirms validation catches candidate bytes that no longer match the receipt.
    #[test]
    fn validation_rejects_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "prune-drift", "prune-v1", "tiny")
                .unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            500_000,
            0,
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    // Covers parser behavior for keep and floor inputs.
    #[test]
    fn rejects_invalid_prune_parameters() {
        assert_eq!(
            parse_keep_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_keep_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_keep_ppm("many").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_floor_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_floor_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_floor_ppm("high").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    // Compares decoded tensor values between two `.slm` byte buffers.
    fn assert_same_values(candidate: &[u8], expected: &[u8]) {
        let candidate_values = parse_model_values(candidate).unwrap();
        let expected_values = parse_model_values(expected).unwrap();
        for (candidate_tensor, expected_tensor) in candidate_values
            .tensors
            .iter()
            .zip(expected_values.tensors.iter())
        {
            assert_eq!(candidate_tensor.values, expected_tensor.values);
        }
    }

    // Detects whether any decoded tensor value differs between two `.slm` buffers.
    fn any_value_differs(candidate: &[u8], expected: &[u8]) -> bool {
        let candidate_values = parse_model_values(candidate).unwrap();
        let expected_values = parse_model_values(expected).unwrap();
        candidate_values
            .tensors
            .iter()
            .zip(expected_values.tensors.iter())
            .any(|(candidate_tensor, expected_tensor)| {
                candidate_tensor.values != expected_tensor.values
            })
    }

    // Builds a tiny f32 model with all fixture values multiplied by scale.
    fn tiny_f32_scaled_bytes(scale: f32) -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |tensor, index, _tensor_index| {
            fixture_value(tensor, index) * scale
        })
    }

    // Builds a tiny f32 model with descending positive values for floor tests.
    fn tiny_f32_descending_bytes() -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |_tensor, index, tensor_index| {
            let coordinate = tensor_index * 1000 + index;
            (10_000usize.saturating_sub(coordinate)) as f32
        })
    }

    // Builds a tiny f32 model with stable nonzero unique values.
    fn tiny_f32_uniform_bytes() -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |_tensor, index, tensor_index| {
            1.0 + (tensor_index as f32 * 0.01) + (index as f32 * 0.001)
        })
    }

    // Builds a tiny f32 reference with one large magnitude coordinate.
    fn tiny_f32_with_spike(spike_tensor: usize, spike_index: usize, spike: f32) -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |_tensor, index, tensor_index| {
            if tensor_index == spike_tensor && index == spike_index {
                spike
            } else {
                1.0
            }
        })
    }

    // Builds a tiny q8 model with all fixture values multiplied by scale.
    fn tiny_q8_scaled_bytes(scale: f32) -> Vec<u8> {
        build_tiny_bytes(
            tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            |tensor, index, _tensor_index| fixture_value(tensor, index) * scale,
        )
    }

    // Packs a tiny fixture model from caller-supplied tensor values.
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

    // Creates an isolated temp directory for path-level operator tests.
    fn unique_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-prune-{label}-{nanos}"))
    }
}
