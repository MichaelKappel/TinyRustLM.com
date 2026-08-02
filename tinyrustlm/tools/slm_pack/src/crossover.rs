//! Offline deterministic direct-parameter crossover operator for model-breeding candidates.

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

const CROSSOVER_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "deterministic-direct-parameter-crossover";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const DEFAULT_CROSSOVER_SEED: &str = "1469598103934665603";
const DEFAULT_PARENT0_KEEP_PPM: &str = "500000";
const SELECTION_METRIC: &str = "splitmix64-tensor-element-threshold";
const SELECTION_SCOPE: &str = "compatible-parent-tensor-values";
const TIE_BREAK: &str = "parent0-when-threshold-equal";

/// Writes a crossover candidate `.slm` plus a recomputable operator receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    left_parent: &Path,
    right_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    crossover_seed: Option<&str>,
    parent0_keep_ppm: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let left_bytes = fs::read(left_parent)?;
    let right_bytes = fs::read(right_parent)?;
    let seed = parse_crossover_seed(crossover_seed.unwrap_or(DEFAULT_CROSSOVER_SEED))?;
    let keep = parse_parent0_keep_ppm(parent0_keep_ppm.unwrap_or(DEFAULT_PARENT0_KEEP_PPM))?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &left_bytes,
        &left_parent.display().to_string(),
        &right_bytes,
        &right_parent.display().to_string(),
        &output_slm.display().to_string(),
        seed,
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
    println!("SLM crossover candidate written: {}", output_slm.display());
    println!(
        "SLM crossover operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a crossover candidate and receipt by recomputing the operator output.
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
    println!("SLM crossover candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

/// Recomputes crossover output from receipt fields and compares both artifacts.
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
    let receipt = parse_manifest(receipt_text, "crossover operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_crossover_operator_version",
        CROSSOVER_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", OPERATOR_KIND)?;
    require_equal(&receipt, "crossover_parent0_keep_unit", "parts-per-million")?;
    require_equal(&receipt, "crossover_selection_metric", SELECTION_METRIC)?;
    require_equal(&receipt, "crossover_selection_scope", SELECTION_SCOPE)?;
    require_equal(&receipt, "crossover_tie_break", TIE_BREAK)?;
    let seed = parse_crossover_seed(require_key(&receipt, "crossover_seed")?)?;
    let keep = parse_parent0_keep_ppm(require_key(&receipt, "crossover_parent0_keep_ppm")?)?;
    require_equal(
        &receipt,
        "crossover_parent1_keep_ppm",
        &(PPM_DENOMINATOR - keep).to_string(),
    )?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        left_bytes,
        left_path,
        right_bytes,
        right_path,
        candidate_path,
        seed,
        keep,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "crossover candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "crossover operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Builds the crossover `.slm` bytes and the receipt that can reproduce them.
fn build_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    left_bytes: &[u8],
    left_path: &str,
    right_bytes: &[u8],
    right_path: &str,
    candidate_path: &str,
    crossover_seed: u64,
    parent0_keep_ppm: u32,
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
    let (output_values, crossover_stats) =
        crossover_values(&left, &right, crossover_seed, parent0_keep_ppm)?;
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
        crossover_seed,
        parent0_keep_ppm,
        crossover_stats,
    )?;
    Ok((candidate, receipt))
}

/// Formats the manifest-style receipt for a deterministic crossover candidate.
#[allow(clippy::too_many_arguments)]
fn build_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    left_path: &str,
    right_path: &str,
    left_report: &ValidationReport,
    right_report: &ValidationReport,
    candidate_report: &ValidationReport,
    crossover_seed: u64,
    parent0_keep_ppm: u32,
    crossover_stats: CrossoverStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_crossover_operator_version",
        CROSSOVER_OPERATOR_VERSION,
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
    push_line(&mut text, "crossover_seed", &crossover_seed.to_string());
    push_line(
        &mut text,
        "crossover_parent0_keep_unit",
        "parts-per-million",
    );
    push_line(
        &mut text,
        "crossover_parent0_keep_ppm",
        &parent0_keep_ppm.to_string(),
    );
    push_line(
        &mut text,
        "crossover_parent1_keep_ppm",
        &(PPM_DENOMINATOR - parent0_keep_ppm).to_string(),
    );
    push_line(&mut text, "crossover_selection_metric", SELECTION_METRIC);
    push_line(&mut text, "crossover_selection_scope", SELECTION_SCOPE);
    push_line(&mut text, "crossover_tie_break", TIE_BREAK);
    push_line(
        &mut text,
        "crossover_total_parameter_count",
        &crossover_stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "crossover_parent0_parameter_count",
        &crossover_stats.parent0_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "crossover_parent1_parameter_count",
        &crossover_stats.parent1_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "crossover_parent0_density_ppm",
        &crossover_stats.parent0_density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "crossover_parent1_density_ppm",
        &crossover_stats.parent1_density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "crossover_mask_checksum",
        &hex64(crossover_stats.mask_checksum),
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

/// Selects each compatible tensor value from either parent and returns selection stats.
fn crossover_values(
    left: &ParsedModel,
    right: &ParsedModel,
    crossover_seed: u64,
    parent0_keep_ppm: u32,
) -> io::Result<(Vec<Vec<f32>>, CrossoverStats)> {
    if !same_shape(&left.shape, &right.shape) {
        return Err(invalid("crossover parents have different model shapes"));
    }
    if left.flags != right.flags {
        return Err(invalid("crossover parents have different output flags"));
    }
    if left.tokenizer.bytes != right.tokenizer.bytes {
        return Err(invalid("crossover parents have different tokenizer bytes"));
    }
    let right_by_hash = right
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let mut output = Vec::with_capacity(left.tensors.len());
    let mut stats = CrossoverStats {
        total_parameter_count: 0,
        parent0_parameter_count: 0,
        parent1_parameter_count: 0,
        parent0_density_ppm: 0,
        parent1_density_ppm: 0,
        mask_checksum: crossover_mask_seed(crossover_seed, parent0_keep_ppm),
    };
    for (tensor_index, left_tensor) in left.tensors.iter().enumerate() {
        let Some(right_index) = right_by_hash.get(&left_tensor.spec.name_hash) else {
            return Err(invalid(
                "right parent is missing a tensor from the left parent",
            ));
        };
        let right_tensor = &right.tensors[*right_index];
        require_same_tensor_spec(&left_tensor.spec, &right_tensor.spec)?;
        let mut values = Vec::with_capacity(left_tensor.values.len());
        for (value_index, (left_value, right_value)) in left_tensor
            .values
            .iter()
            .zip(right_tensor.values.iter())
            .enumerate()
        {
            let choose_left =
                choose_parent0(crossover_seed, tensor_index, value_index, parent0_keep_ppm);
            stats.total_parameter_count += 1;
            if choose_left {
                stats.parent0_parameter_count += 1;
                values.push(*left_value);
            } else {
                stats.parent1_parameter_count += 1;
                values.push(*right_value);
            }
            mix_mask_value(&mut stats.mask_checksum, tensor_index as u64);
            mix_mask_value(&mut stats.mask_checksum, value_index as u64);
            mix_mask_value(&mut stats.mask_checksum, if choose_left { 0 } else { 1 });
        }
        output.push(values);
    }
    stats.parent0_density_ppm =
        ratio_ppm(stats.parent0_parameter_count, stats.total_parameter_count)?;
    stats.parent1_density_ppm =
        ratio_ppm(stats.parent1_parameter_count, stats.total_parameter_count)?;
    mix_mask_value(&mut stats.mask_checksum, stats.total_parameter_count);
    mix_mask_value(&mut stats.mask_checksum, stats.parent0_parameter_count);
    mix_mask_value(&mut stats.mask_checksum, stats.parent1_parameter_count);
    Ok((output, stats))
}

/// Applies the keep threshold with fixed behavior for the two boundary values.
fn choose_parent0(
    crossover_seed: u64,
    tensor_index: usize,
    value_index: usize,
    parent0_keep_ppm: u32,
) -> bool {
    if parent0_keep_ppm == 0 {
        return false;
    }
    if parent0_keep_ppm >= PPM_DENOMINATOR {
        return true;
    }
    draw_ppm(crossover_seed, tensor_index, value_index) <= parent0_keep_ppm
}

/// Produces a parts-per-million draw from stable tensor and element coordinates.
fn draw_ppm(crossover_seed: u64, tensor_index: usize, value_index: usize) -> u32 {
    let mixed = splitmix64(
        crossover_seed
            ^ ((tensor_index as u64).wrapping_mul(0x9e37_79b9_7f4a_7c15))
            ^ ((value_index as u64).wrapping_mul(0xbf58_476d_1ce4_e5b9)),
    );
    (mixed % u64::from(PPM_DENOMINATOR) + 1) as u32
}

/// Scrambles a u64 using the SplitMix64 finalizer pattern.
fn splitmix64(mut value: u64) -> u64 {
    value = value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}

/// Starts the crossover mask checksum from operator parameters.
fn crossover_mask_seed(crossover_seed: u64, parent0_keep_ppm: u32) -> u64 {
    let mut acc = 0x6372_6f73_736f_7631u64;
    mix_mask_value(&mut acc, crossover_seed);
    mix_mask_value(&mut acc, u64::from(parent0_keep_ppm));
    acc
}

/// Folds one mask value into a compact deterministic checksum.
fn mix_mask_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(11).wrapping_mul(0x1000_0000_01b3);
}

/// Converts a count ratio into integer parts-per-million.
fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    let ppm = u128::from(numerator) * u128::from(PPM_DENOMINATOR) / u128::from(denominator);
    u64::try_from(ppm).map_err(|_| invalid("crossover ratio overflowed u64"))
}

/// Parses the deterministic crossover seed from a CLI or receipt field.
fn parse_crossover_seed(value: &str) -> io::Result<u64> {
    value
        .parse::<u64>()
        .map_err(|_| invalid("crossover seed must be an unsigned 64-bit integer"))
}

/// Parses parent-zero retention as an integer parts-per-million value.
fn parse_parent0_keep_ppm(value: &str) -> io::Result<u32> {
    let keep = value.parse::<u32>().map_err(|_| {
        invalid("crossover parent0 keep must be an integer parts-per-million value")
    })?;
    if keep > PPM_DENOMINATOR {
        return Err(invalid(
            "crossover parent0 keep must be between 0 and 1000000",
        ));
    }
    Ok(keep)
}

/// Holds deterministic crossover selection counts and checksum metadata.
#[derive(Clone, Copy)]
struct CrossoverStats {
    total_parameter_count: u64,
    parent0_parameter_count: u64,
    parent1_parameter_count: u64,
    parent0_density_ppm: u64,
    parent1_density_ppm: u64,
    mask_checksum: u64,
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

    // Exercises the seed and keep parameters through candidate writing and receipt validation.
    #[test]
    fn writes_and_validates_seeded_f32_crossover_candidate() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-f32", "crossover-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            7,
            500_000,
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
        let left_values = parse_model_values(&left).unwrap();
        let right_values = parse_model_values(&right).unwrap();
        let candidate_values = parse_model_values(&candidate).unwrap();
        let mut selected_left = 0usize;
        let mut selected_right = 0usize;
        for ((candidate_tensor, left_tensor), right_tensor) in candidate_values
            .tensors
            .iter()
            .zip(left_values.tensors.iter())
            .zip(right_values.tensors.iter())
        {
            for ((candidate_value, left_value), right_value) in candidate_tensor
                .values
                .iter()
                .zip(left_tensor.values.iter())
                .zip(right_tensor.values.iter())
            {
                if candidate_value == left_value {
                    selected_left += 1;
                }
                if candidate_value == right_value {
                    selected_right += 1;
                }
            }
        }
        assert!(selected_left > 0);
        assert!(selected_right > 0);
        assert!(receipt.contains("operator_kind=deterministic-direct-parameter-crossover"));
        assert!(receipt.contains("crossover_seed=7"));
        assert!(receipt.contains("crossover_parent0_keep_ppm=500000"));
        assert!(receipt.contains("crossover_mask_checksum="));
    }

    // Exercises all path-level inputs plus default seed and keep parameters.
    #[test]
    fn path_writer_uses_default_seed_and_keep_then_validates() {
        let dir = unique_dir("path-defaults");
        fs::create_dir_all(&dir).unwrap();
        let left_path = dir.join("left.slm");
        let right_path = dir.join("right.slm");
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        fs::write(&left_path, &left).unwrap();
        fs::write(&right_path, &right).unwrap();
        let compatibility = compatibility::compatibility_text_for_bytes(
            &left,
            &left_path.display().to_string(),
            &right,
            &right_path.display().to_string(),
        )
        .unwrap();
        fs::write(&compatibility_path, &compatibility).unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-path", "crossover-v1", "tiny")
                .unwrap();
        fs::write(&lineage_path, &lineage).unwrap();

        write_candidate_path(
            &compatibility_path,
            &lineage_path,
            &left_path,
            &right_path,
            &candidate_path,
            &receipt_path,
            None,
            None,
        )
        .unwrap();
        validate_candidate_path(
            &compatibility_path,
            &lineage_path,
            &left_path,
            &right_path,
            &candidate_path,
            &receipt_path,
        )
        .unwrap();

        let receipt = fs::read_to_string(receipt_path).unwrap();
        assert!(receipt.contains("crossover_seed=1469598103934665603"));
        assert!(receipt.contains("crossover_parent0_keep_ppm=500000"));
    }

    // Covers the parent0_keep_ppm lower boundary where every value comes from parent 1.
    #[test]
    fn keep_zero_uses_right_parent_values() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-zero", "crossover-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            13,
            0,
        )
        .unwrap();

        let candidate_values = parse_model_values(&candidate).unwrap();
        let right_values = parse_model_values(&right).unwrap();
        for (candidate_tensor, right_tensor) in candidate_values
            .tensors
            .iter()
            .zip(right_values.tensors.iter())
        {
            assert_eq!(candidate_tensor.values, right_tensor.values);
        }
        assert!(receipt.contains("crossover_parent0_parameter_count=0"));
        assert!(receipt.contains("crossover_parent1_density_ppm=1000000"));
    }

    // Covers the parent0_keep_ppm upper boundary where every value comes from parent 0.
    #[test]
    fn keep_all_uses_left_parent_values() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-all", "crossover-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            13,
            1_000_000,
        )
        .unwrap();

        let candidate_values = parse_model_values(&candidate).unwrap();
        let left_values = parse_model_values(&left).unwrap();
        for (candidate_tensor, left_tensor) in candidate_values
            .tensors
            .iter()
            .zip(left_values.tensors.iter())
        {
            assert_eq!(candidate_tensor.values, left_tensor.values);
        }
        assert!(receipt.contains("crossover_parent1_parameter_count=0"));
        assert!(receipt.contains("crossover_parent0_density_ppm=1000000"));
    }

    // Confirms crossover_seed changes the selected mask and the produced candidate.
    #[test]
    fn crossover_seed_changes_selection_mask() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-seed", "crossover-v1", "tiny")
                .unwrap();

        let (candidate_a, receipt_a) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate-a.slm",
            1,
            500_000,
        )
        .unwrap();
        let (candidate_b, receipt_b) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate-b.slm",
            2,
            500_000,
        )
        .unwrap();

        let receipt_a_fields = parse_manifest(&receipt_a, "crossover receipt a").unwrap();
        let receipt_b_fields = parse_manifest(&receipt_b, "crossover receipt b").unwrap();
        assert_ne!(candidate_a, candidate_b);
        assert_ne!(
            receipt_a_fields.get("crossover_mask_checksum"),
            receipt_b_fields.get("crossover_mask_checksum")
        );
    }

    // Validates q8 parents keep their quantization route through crossover output.
    #[test]
    fn writes_and_validates_q8_crossover_candidate() {
        let left = tiny_q8_scaled_bytes(1.0);
        let right = tiny_q8_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-q8", "crossover-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            42,
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

    // Confirms parent parameters are tied to compatibility receipts by checksum.
    #[test]
    fn rejects_parent_checksum_drift() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-drift", "crossover-v1", "tiny")
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
            7,
            500_000,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    // Confirms validation catches candidate bytes that no longer match the receipt.
    #[test]
    fn validation_rejects_candidate_drift() {
        let left = tiny_f32_scaled_bytes(1.0);
        let right = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "cross-drift", "crossover-v1", "tiny")
                .unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &left,
            "left.slm",
            &right,
            "right.slm",
            "candidate.slm",
            7,
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

    // Covers parser behavior for the seed and parent0_keep_ppm inputs.
    #[test]
    fn rejects_invalid_crossover_parameters() {
        assert_eq!(
            parse_crossover_seed("18446744073709551616")
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_crossover_seed("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_crossover_seed("seed").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_parent0_keep_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_parent0_keep_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_parent0_keep_ppm("half").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    // Builds a tiny f32 model with all fixture values multiplied by scale.
    fn tiny_f32_scaled_bytes(scale: f32) -> Vec<u8> {
        build_tiny_bytes(tiny_fixture_tensors(), |tensor, index, _tensor_index| {
            fixture_value(tensor, index) * scale
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
        std::env::temp_dir().join(format!("tinyrustlm-crossover-{label}-{nanos}"))
    }
}
