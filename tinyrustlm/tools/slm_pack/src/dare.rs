//! Offline DARE-style dropout/rescaled task-delta operator for model-breeding candidates.

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

const DARE_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "dropout-rescaled-task-delta";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const DEFAULT_DELTA_WEIGHT_PPM: &str = "1000000";
const DEFAULT_KEEP_PPM: &str = "500000";
const DEFAULT_DROPOUT_SEED: &str = "1469598103934665603";
const MIN_DELTA_WEIGHT_PPM: i64 = -1_000_000;
const MAX_DELTA_WEIGHT_PPM: i64 = 2_000_000;
const SELECTION_METRIC: &str = "splitmix64-nonzero-delta-threshold";
const SELECTION_SCOPE: &str = "nonzero-target-minus-base-deltas";
const TIE_BREAK: &str = "select-when-threshold-equal";
const RESCALE_STRATEGY: &str = "inverse-keep-rate";

/// Writes a DARE task-delta candidate `.slm` plus a recomputable receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    delta_weight_ppm: Option<&str>,
    keep_ppm: Option<&str>,
    dropout_seed: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let weight = parse_delta_weight_ppm(delta_weight_ppm.unwrap_or(DEFAULT_DELTA_WEIGHT_PPM))?;
    let keep = parse_keep_ppm(keep_ppm.unwrap_or(DEFAULT_KEEP_PPM))?;
    let seed = parse_dropout_seed(dropout_seed.unwrap_or(DEFAULT_DROPOUT_SEED))?;
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
        seed,
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, receipt)?;
    println!("SLM DARE candidate written: {}", output_slm.display());
    println!(
        "SLM DARE operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a DARE candidate and receipt by replaying the masked task delta.
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
    println!("SLM DARE candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

/// Recomputes DARE output from receipt parameters and compares both artifacts.
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
    let receipt = parse_manifest(receipt_text, "DARE operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_dare_operator_version",
        DARE_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", OPERATOR_KIND)?;
    require_equal(&receipt, "base_parent_index", "0")?;
    require_equal(&receipt, "target_parent_index", "1")?;
    require_equal(&receipt, "delta_weight_unit", "parts-per-million")?;
    require_equal(&receipt, "dare_keep_unit", "parts-per-million")?;
    require_equal(&receipt, "dare_drop_unit", "parts-per-million")?;
    require_equal(&receipt, "dare_selection_metric", SELECTION_METRIC)?;
    require_equal(&receipt, "dare_selection_scope", SELECTION_SCOPE)?;
    require_equal(&receipt, "dare_tie_break", TIE_BREAK)?;
    require_equal(&receipt, "dare_rescale_strategy", RESCALE_STRATEGY)?;
    let weight = parse_delta_weight_ppm(require_key(&receipt, "delta_weight_ppm")?)?;
    let keep = parse_keep_ppm(require_key(&receipt, "dare_keep_ppm")?)?;
    let seed = parse_dropout_seed(require_key(&receipt, "dare_dropout_seed")?)?;
    require_equal(
        &receipt,
        "dare_drop_ppm",
        &(PPM_DENOMINATOR - keep).to_string(),
    )?;
    require_equal(
        &receipt,
        "dare_rescale_multiplier_ppm",
        &rescale_multiplier_ppm(keep).to_string(),
    )?;
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
        seed,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "DARE candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "DARE operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Builds the DARE `.slm` bytes and the receipt that can reproduce them.
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
    dropout_seed: u64,
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
    let (output_values, dare_stats) =
        dare_values(&base, &target, delta_weight_ppm, keep_ppm, dropout_seed)?;
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
        dropout_seed,
        dare_stats,
    )?;
    Ok((candidate, receipt))
}

/// Formats the manifest-style receipt for a DARE operator output.
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
    dropout_seed: u64,
    dare_stats: DareStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_dare_operator_version",
        DARE_OPERATOR_VERSION,
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
    push_line(&mut text, "base_parent_index", "0");
    push_line(&mut text, "target_parent_index", "1");
    push_line(&mut text, "delta_weight_unit", "parts-per-million");
    push_line(&mut text, "delta_weight_ppm", &delta_weight_ppm.to_string());
    push_line(&mut text, "dare_keep_unit", "parts-per-million");
    push_line(&mut text, "dare_keep_ppm", &keep_ppm.to_string());
    push_line(&mut text, "dare_drop_unit", "parts-per-million");
    push_line(
        &mut text,
        "dare_drop_ppm",
        &(PPM_DENOMINATOR - keep_ppm).to_string(),
    );
    push_line(&mut text, "dare_dropout_seed", &dropout_seed.to_string());
    push_line(&mut text, "dare_selection_metric", SELECTION_METRIC);
    push_line(&mut text, "dare_selection_scope", SELECTION_SCOPE);
    push_line(&mut text, "dare_tie_break", TIE_BREAK);
    push_line(&mut text, "dare_rescale_strategy", RESCALE_STRATEGY);
    push_line(
        &mut text,
        "dare_rescale_multiplier_ppm",
        &rescale_multiplier_ppm(keep_ppm).to_string(),
    );
    push_line(
        &mut text,
        "dare_total_parameter_count",
        &dare_stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "dare_nonzero_delta_count",
        &dare_stats.nonzero_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "dare_selected_delta_count",
        &dare_stats.selected_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "dare_dropped_delta_count",
        &dare_stats.dropped_delta_count.to_string(),
    );
    push_line(
        &mut text,
        "dare_unchanged_parameter_count",
        &dare_stats.unchanged_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "dare_selection_density_ppm",
        &dare_stats.selection_density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "dare_nonzero_delta_retention_ppm",
        &dare_stats.nonzero_delta_retention_ppm.to_string(),
    );
    push_line(
        &mut text,
        "dare_mask_checksum",
        &hex64(dare_stats.mask_checksum),
    );
    push_line(
        &mut text,
        "dare_raw_delta_checksum",
        &hex64(dare_stats.raw_delta_checksum),
    );
    push_line(
        &mut text,
        "dare_rescaled_delta_checksum",
        &hex64(dare_stats.rescaled_delta_checksum),
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

/// Applies deterministic dropout to nonzero task deltas and rescales kept deltas.
fn dare_values(
    base: &ParsedModel,
    target: &ParsedModel,
    delta_weight_ppm: i64,
    keep_ppm: u32,
    dropout_seed: u64,
) -> io::Result<(Vec<Vec<f32>>, DareStats)> {
    if !same_shape(&base.shape, &target.shape) {
        return Err(invalid("DARE parents have different model shapes"));
    }
    if base.flags != target.flags {
        return Err(invalid("DARE parents have different output flags"));
    }
    if base.tokenizer.bytes != target.tokenizer.bytes {
        return Err(invalid("DARE parents have different tokenizer bytes"));
    }
    let target_by_hash = target
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let mut output = Vec::with_capacity(base.tensors.len());
    let mut stats = DareStats {
        total_parameter_count: 0,
        nonzero_delta_count: 0,
        selected_delta_count: 0,
        dropped_delta_count: 0,
        unchanged_parameter_count: 0,
        selection_density_ppm: 0,
        nonzero_delta_retention_ppm: 0,
        mask_checksum: dare_mask_seed(dropout_seed, delta_weight_ppm, keep_ppm),
        raw_delta_checksum: dare_raw_delta_seed(dropout_seed, delta_weight_ppm, keep_ppm),
        rescaled_delta_checksum: dare_rescaled_delta_seed(dropout_seed, delta_weight_ppm, keep_ppm),
    };
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let Some(target_index) = target_by_hash.get(&base_tensor.spec.name_hash) else {
            return Err(invalid(
                "target parent is missing a tensor from the base parent",
            ));
        };
        let target_tensor = &target.tensors[*target_index];
        require_same_tensor_spec(&base_tensor.spec, &target_tensor.spec)?;
        let mut values = Vec::with_capacity(base_tensor.values.len());
        for (value_index, (base_value, target_value)) in base_tensor
            .values
            .iter()
            .zip(target_tensor.values.iter())
            .enumerate()
        {
            stats.total_parameter_count += 1;
            let raw_delta = *target_value - *base_value;
            if raw_delta == 0.0 {
                stats.unchanged_parameter_count += 1;
                values.push(*base_value);
                continue;
            }
            stats.nonzero_delta_count += 1;
            let selected = choose_delta(dropout_seed, tensor_index, value_index, keep_ppm);
            mix_mask_value(&mut stats.mask_checksum, tensor_index as u64);
            mix_mask_value(&mut stats.mask_checksum, value_index as u64);
            mix_mask_value(&mut stats.mask_checksum, if selected { 1 } else { 0 });
            mix_delta_value(&mut stats.raw_delta_checksum, tensor_index as u64);
            mix_delta_value(&mut stats.raw_delta_checksum, value_index as u64);
            mix_delta_value(
                &mut stats.raw_delta_checksum,
                u64::from(raw_delta.to_bits()),
            );
            if selected {
                stats.selected_delta_count += 1;
                let applied_delta = rescaled_delta(raw_delta, delta_weight_ppm, keep_ppm)?;
                let output_value = *base_value + applied_delta;
                if !output_value.is_finite() {
                    return Err(invalid("DARE output produced a non-finite value"));
                }
                mix_delta_value(&mut stats.rescaled_delta_checksum, tensor_index as u64);
                mix_delta_value(&mut stats.rescaled_delta_checksum, value_index as u64);
                mix_delta_value(
                    &mut stats.rescaled_delta_checksum,
                    u64::from(applied_delta.to_bits()),
                );
                mix_delta_value(
                    &mut stats.rescaled_delta_checksum,
                    u64::from(output_value.to_bits()),
                );
                values.push(output_value);
            } else {
                stats.dropped_delta_count += 1;
                values.push(*base_value);
            }
        }
        output.push(values);
    }
    stats.selection_density_ppm =
        ratio_ppm(stats.selected_delta_count, stats.total_parameter_count)?;
    stats.nonzero_delta_retention_ppm =
        ratio_ppm(stats.selected_delta_count, stats.nonzero_delta_count)?;
    mix_mask_value(&mut stats.mask_checksum, stats.total_parameter_count);
    mix_mask_value(&mut stats.mask_checksum, stats.nonzero_delta_count);
    mix_mask_value(&mut stats.mask_checksum, stats.selected_delta_count);
    mix_delta_value(&mut stats.raw_delta_checksum, stats.nonzero_delta_count);
    mix_delta_value(
        &mut stats.rescaled_delta_checksum,
        stats.selected_delta_count,
    );
    Ok((output, stats))
}

/// Applies the keep threshold with stable behavior at the two boundary values.
fn choose_delta(dropout_seed: u64, tensor_index: usize, value_index: usize, keep_ppm: u32) -> bool {
    if keep_ppm == 0 {
        return false;
    }
    if keep_ppm >= PPM_DENOMINATOR {
        return true;
    }
    draw_ppm(dropout_seed, tensor_index, value_index) <= keep_ppm
}

/// Rescales a kept delta by delta_weight divided by the retained fraction.
fn rescaled_delta(raw_delta: f32, delta_weight_ppm: i64, keep_ppm: u32) -> io::Result<f32> {
    if keep_ppm == 0 || delta_weight_ppm == 0 {
        return Ok(0.0);
    }
    let scaled = f64::from(raw_delta) * delta_weight_ppm as f64 / f64::from(keep_ppm);
    if !scaled.is_finite() || scaled.abs() > f64::from(f32::MAX) {
        return Err(invalid("DARE rescaled delta overflowed finite f32 range"));
    }
    Ok(scaled as f32)
}

/// Reports the keep-rate inverse as an integer parts-per-million multiplier.
fn rescale_multiplier_ppm(keep_ppm: u32) -> u64 {
    if keep_ppm == 0 {
        return 0;
    }
    u64::from(PPM_DENOMINATOR) * u64::from(PPM_DENOMINATOR) / u64::from(keep_ppm)
}

/// Produces a parts-per-million draw from stable tensor and element coordinates.
fn draw_ppm(dropout_seed: u64, tensor_index: usize, value_index: usize) -> u32 {
    let mixed = splitmix64(coordinate_seed(dropout_seed, tensor_index, value_index));
    (mixed % u64::from(PPM_DENOMINATOR) + 1) as u32
}

/// Mixes the operator seed with tensor and element coordinates.
fn coordinate_seed(dropout_seed: u64, tensor_index: usize, value_index: usize) -> u64 {
    dropout_seed
        ^ ((tensor_index as u64).wrapping_mul(0x9e37_79b9_7f4a_7c15))
        ^ ((value_index as u64).wrapping_mul(0xbf58_476d_1ce4_e5b9))
}

/// Scrambles a u64 using the SplitMix64 finalizer pattern.
fn splitmix64(mut value: u64) -> u64 {
    value = value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}

/// Starts the DARE mask checksum from all operator parameters.
fn dare_mask_seed(dropout_seed: u64, delta_weight_ppm: i64, keep_ppm: u32) -> u64 {
    let mut acc = 0x6461_7265_6d73_6b31u64;
    mix_mask_value(&mut acc, dropout_seed);
    mix_mask_value(&mut acc, delta_weight_ppm as u64);
    mix_mask_value(&mut acc, u64::from(keep_ppm));
    acc
}

/// Starts the raw task-delta checksum from all operator parameters.
fn dare_raw_delta_seed(dropout_seed: u64, delta_weight_ppm: i64, keep_ppm: u32) -> u64 {
    let mut acc = 0x6461_7265_7261_7731u64;
    mix_delta_value(&mut acc, dropout_seed);
    mix_delta_value(&mut acc, delta_weight_ppm as u64);
    mix_delta_value(&mut acc, u64::from(keep_ppm));
    acc
}

/// Starts the rescaled delta checksum from all operator parameters.
fn dare_rescaled_delta_seed(dropout_seed: u64, delta_weight_ppm: i64, keep_ppm: u32) -> u64 {
    let mut acc = 0x6461_7265_7363_6c31u64;
    mix_delta_value(&mut acc, dropout_seed);
    mix_delta_value(&mut acc, delta_weight_ppm as u64);
    mix_delta_value(&mut acc, u64::from(keep_ppm));
    acc
}

/// Folds one mask value into a compact deterministic checksum.
fn mix_mask_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(11).wrapping_mul(0x1000_0000_01b3);
}

/// Folds one delta value into a compact deterministic checksum.
fn mix_delta_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0xbf58_476d_1ce4_e5b9);
    *acc = acc.rotate_left(7).wrapping_mul(0x94d0_49bb_1331_11eb);
}

/// Converts a count ratio into integer parts-per-million.
fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    let ppm = u128::from(numerator) * u128::from(PPM_DENOMINATOR) / u128::from(denominator);
    u64::try_from(ppm).map_err(|_| invalid("DARE ratio overflowed u64"))
}

/// Parses DARE task-delta weight as a signed parts-per-million value.
fn parse_delta_weight_ppm(value: &str) -> io::Result<i64> {
    let weight = value
        .parse::<i64>()
        .map_err(|_| invalid("DARE weight must be an integer parts-per-million value"))?;
    if !(MIN_DELTA_WEIGHT_PPM..=MAX_DELTA_WEIGHT_PPM).contains(&weight) {
        return Err(invalid("DARE weight must be between -1000000 and 2000000"));
    }
    Ok(weight)
}

/// Parses DARE retained-delta rate as an integer parts-per-million value.
fn parse_keep_ppm(value: &str) -> io::Result<u32> {
    let keep = value
        .parse::<u32>()
        .map_err(|_| invalid("DARE keep must be an integer parts-per-million value"))?;
    if keep > PPM_DENOMINATOR {
        return Err(invalid("DARE keep must be between 0 and 1000000"));
    }
    Ok(keep)
}

/// Parses the deterministic DARE dropout seed.
fn parse_dropout_seed(value: &str) -> io::Result<u64> {
    value
        .parse::<u64>()
        .map_err(|_| invalid("DARE dropout seed must be an unsigned integer"))
}

/// Holds deterministic DARE selection counts and checksum metadata.
#[derive(Clone, Copy)]
struct DareStats {
    total_parameter_count: u64,
    nonzero_delta_count: u64,
    selected_delta_count: u64,
    dropped_delta_count: u64,
    unchanged_parameter_count: u64,
    selection_density_ppm: u64,
    nonzero_delta_retention_ppm: u64,
    mask_checksum: u64,
    raw_delta_checksum: u64,
    rescaled_delta_checksum: u64,
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

    // Exercises weight, keep rate, and seed through candidate writing and receipt validation.
    #[test]
    fn writes_and_validates_seeded_f32_dare_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-f32", "dare-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            500_000,
            7,
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
        assert!(any_value_differs(&candidate, &base));
        assert!(some_values_equal(&candidate, &base));
        assert!(receipt.contains("operator_kind=dropout-rescaled-task-delta"));
        assert!(receipt.contains("delta_weight_ppm=1000000"));
        assert!(receipt.contains("dare_keep_ppm=500000"));
        assert!(receipt.contains("dare_dropout_seed=7"));
        assert!(receipt.contains("dare_mask_checksum="));
        assert!(receipt.contains("dare_rescaled_delta_checksum="));
    }

    // Exercises all path-level inputs plus default weight, keep, and seed parameters.
    #[test]
    fn path_writer_uses_default_parameters_then_validates() {
        let dir = unique_dir("path-defaults");
        fs::create_dir_all(&dir).unwrap();
        let base_path = dir.join("base.slm");
        let target_path = dir.join("target.slm");
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(2.0);
        fs::write(&base_path, &base).unwrap();
        fs::write(&target_path, &target).unwrap();
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            &base_path.display().to_string(),
            &target,
            &target_path.display().to_string(),
        )
        .unwrap();
        fs::write(&compatibility_path, &compatibility).unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-path", "dare-v1", "tiny").unwrap();
        fs::write(&lineage_path, &lineage).unwrap();

        write_candidate_path(
            &compatibility_path,
            &lineage_path,
            &base_path,
            &target_path,
            &candidate_path,
            &receipt_path,
            None,
            None,
            None,
        )
        .unwrap();
        validate_candidate_path(
            &compatibility_path,
            &lineage_path,
            &base_path,
            &target_path,
            &candidate_path,
            &receipt_path,
        )
        .unwrap();

        let receipt = fs::read_to_string(receipt_path).unwrap();
        assert!(receipt.contains("delta_weight_ppm=1000000"));
        assert!(receipt.contains("dare_keep_ppm=500000"));
        assert!(receipt.contains("dare_dropout_seed=1469598103934665603"));
    }

    // Covers keep_ppm lower boundary where all nonzero deltas are dropped.
    #[test]
    fn keep_zero_preserves_base_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-zero", "dare-v1", "tiny").unwrap();

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
            11,
        )
        .unwrap();

        assert_same_values(&candidate, &base);
        assert!(receipt.contains("dare_keep_ppm=0"));
        assert!(receipt.contains("dare_selected_delta_count=0"));
        assert!(receipt.contains("dare_nonzero_delta_retention_ppm=0"));
        assert!(receipt.contains("dare_rescale_multiplier_ppm=0"));
    }

    // Covers keep_ppm upper boundary where full-weight DARE matches the target.
    #[test]
    fn keep_full_and_full_weight_matches_target_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-full", "dare-v1", "tiny").unwrap();

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
            13,
        )
        .unwrap();

        assert_close_values(&candidate, &target);
        assert!(receipt.contains("dare_keep_ppm=1000000"));
        assert!(receipt.contains("dare_drop_ppm=0"));
        assert!(receipt.contains("dare_nonzero_delta_retention_ppm=1000000"));
    }

    // Confirms dropout_seed changes the kept delta mask.
    #[test]
    fn dropout_seed_changes_selection_mask() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-seed", "dare-v1", "tiny").unwrap();

        let (candidate_a, receipt_a) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "a.slm",
            1_000_000,
            500_000,
            1,
        )
        .unwrap();
        let (candidate_b, receipt_b) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "b.slm",
            1_000_000,
            500_000,
            2,
        )
        .unwrap();

        let fields_a = parse_manifest(&receipt_a, "receipt a").unwrap();
        let fields_b = parse_manifest(&receipt_b, "receipt b").unwrap();
        assert_ne!(candidate_a, candidate_b);
        assert_ne!(
            fields_a.get("dare_mask_checksum"),
            fields_b.get("dare_mask_checksum")
        );
    }

    // Confirms delta_weight_ppm changes the rescaled delta and candidate bytes.
    #[test]
    fn delta_weight_changes_rescaled_candidate_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-weight", "dare-v1", "tiny").unwrap();

        let (small, small_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "small.slm",
            500_000,
            500_000,
            7,
        )
        .unwrap();
        let (large, large_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "large.slm",
            1_000_000,
            500_000,
            7,
        )
        .unwrap();

        let small_fields = parse_manifest(&small_receipt, "small receipt").unwrap();
        let large_fields = parse_manifest(&large_receipt, "large receipt").unwrap();
        assert_ne!(small, large);
        assert_ne!(
            small_fields.get("dare_rescaled_delta_checksum"),
            large_fields.get("dare_rescaled_delta_checksum")
        );
    }

    // Covers the accepted negative delta_weight_ppm boundary direction.
    #[test]
    fn negative_weight_extrapolates_away_from_target() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let expected = tiny_f32_scaled_bytes(0.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-negative", "dare-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            -500_000,
            1_000_000,
            7,
        )
        .unwrap();

        assert_close_values(&candidate, &expected);
        assert!(receipt.contains("delta_weight_ppm=-500000"));
        assert!(receipt.contains("dare_keep_ppm=1000000"));
    }

    // Validates q8 parents keep their quantization route through DARE output.
    #[test]
    fn writes_and_validates_q8_dare_candidate() {
        let base = tiny_q8_scaled_bytes(1.0);
        let target = tiny_q8_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-q8", "dare-v1", "tiny").unwrap();

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
            42,
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

    // Confirms base parameters are tied to compatibility receipts by checksum.
    #[test]
    fn rejects_parent_checksum_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-drift", "dare-v1", "tiny").unwrap();
        let changed_base = tiny_f32_scaled_bytes(2.0);

        let error = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &changed_base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            500_000,
            7,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    // Confirms validation catches candidate bytes that no longer match the receipt.
    #[test]
    fn validation_rejects_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "dare-drift", "dare-v1", "tiny").unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "candidate.slm",
            1_000_000,
            500_000,
            7,
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

    // Covers parser behavior for weight, keep, and seed inputs.
    #[test]
    fn rejects_invalid_dare_parameters() {
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
        assert_eq!(
            parse_dropout_seed("18446744073709551616")
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_dropout_seed("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_dropout_seed("seed").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    // Compares decoded tensor values between two `.slm` byte buffers exactly.
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

    // Compares decoded tensor values with a small tolerance for f32 recomputation.
    fn assert_close_values(candidate: &[u8], expected: &[u8]) {
        let candidate_values = parse_model_values(candidate).unwrap();
        let expected_values = parse_model_values(expected).unwrap();
        for (candidate_tensor, expected_tensor) in candidate_values
            .tensors
            .iter()
            .zip(expected_values.tensors.iter())
        {
            for (candidate_value, expected_value) in candidate_tensor
                .values
                .iter()
                .zip(expected_tensor.values.iter())
            {
                assert!((candidate_value - expected_value).abs() <= 0.000001);
            }
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

    // Detects whether any decoded tensor value is preserved between two `.slm` buffers.
    fn some_values_equal(candidate: &[u8], expected: &[u8]) -> bool {
        let candidate_values = parse_model_values(candidate).unwrap();
        let expected_values = parse_model_values(expected).unwrap();
        candidate_values
            .tensors
            .iter()
            .zip(expected_values.tensors.iter())
            .any(|(candidate_tensor, expected_tensor)| {
                candidate_tensor
                    .values
                    .iter()
                    .zip(expected_tensor.values.iter())
                    .any(|(candidate_value, expected_value)| candidate_value == expected_value)
            })
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
        std::env::temp_dir().join(format!("tinyrustlm-dare-{label}-{nanos}"))
    }
}
