//! Offline deterministic bounded mutation operator for model-breeding candidates.

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

const MUTATION_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "deterministic-bounded-parameter-mutation";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const DEFAULT_MUTATION_SEED: &str = "1099511628211";
const DEFAULT_MUTATION_RATE_PPM: &str = "10000";
const DEFAULT_MUTATION_MAGNITUDE_PPM: &str = "50000";
const SELECTION_METRIC: &str = "splitmix64-tensor-element-threshold";
const SELECTION_SCOPE: &str = "compatible-base-tensor-values";
const TIE_BREAK: &str = "mutate-when-threshold-equal";
const VALUE_SCALE: &str = "max-abs-parent-value-or-one";

/// Writes a bounded mutation candidate `.slm` plus a recomputable operator receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    reference_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    mutation_seed: Option<&str>,
    mutation_rate_ppm: Option<&str>,
    mutation_magnitude_ppm: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let reference_bytes = fs::read(reference_parent)?;
    let seed = parse_mutation_seed(mutation_seed.unwrap_or(DEFAULT_MUTATION_SEED))?;
    let rate = parse_mutation_rate_ppm(mutation_rate_ppm.unwrap_or(DEFAULT_MUTATION_RATE_PPM))?;
    let magnitude = parse_mutation_magnitude_ppm(
        mutation_magnitude_ppm.unwrap_or(DEFAULT_MUTATION_MAGNITUDE_PPM),
    )?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &reference_bytes,
        &reference_parent.display().to_string(),
        &output_slm.display().to_string(),
        seed,
        rate,
        magnitude,
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, receipt)?;
    println!("SLM mutation candidate written: {}", output_slm.display());
    println!(
        "SLM mutation operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a mutation candidate and receipt by recomputing the operator output.
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
    println!("SLM mutation candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

/// Recomputes mutation output from receipt fields and compares both artifacts.
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
    let receipt = parse_manifest(receipt_text, "mutation operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_mutation_operator_version",
        MUTATION_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", OPERATOR_KIND)?;
    require_equal(&receipt, "base_parent_index", "0")?;
    require_equal(&receipt, "reference_parent_index", "1")?;
    require_equal(&receipt, "mutation_rate_unit", "parts-per-million")?;
    require_equal(
        &receipt,
        "mutation_magnitude_unit",
        "parts-per-million-of-value-scale",
    )?;
    require_equal(&receipt, "mutation_selection_metric", SELECTION_METRIC)?;
    require_equal(&receipt, "mutation_selection_scope", SELECTION_SCOPE)?;
    require_equal(&receipt, "mutation_tie_break", TIE_BREAK)?;
    require_equal(&receipt, "mutation_value_scale", VALUE_SCALE)?;
    let seed = parse_mutation_seed(require_key(&receipt, "mutation_seed")?)?;
    let rate = parse_mutation_rate_ppm(require_key(&receipt, "mutation_rate_ppm")?)?;
    let magnitude = parse_mutation_magnitude_ppm(require_key(&receipt, "mutation_magnitude_ppm")?)?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        reference_bytes,
        reference_path,
        candidate_path,
        seed,
        rate,
        magnitude,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "mutation candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "mutation operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Builds the mutation `.slm` bytes and the receipt that can reproduce them.
fn build_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    reference_bytes: &[u8],
    reference_path: &str,
    candidate_path: &str,
    mutation_seed: u64,
    mutation_rate_ppm: u32,
    mutation_magnitude_ppm: u32,
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
    let (output_values, mutation_stats) = mutation_values(
        &base,
        &reference,
        mutation_seed,
        mutation_rate_ppm,
        mutation_magnitude_ppm,
    )?;
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
        mutation_seed,
        mutation_rate_ppm,
        mutation_magnitude_ppm,
        mutation_stats,
    )?;
    Ok((candidate, receipt))
}

/// Formats the manifest-style receipt for a deterministic mutation candidate.
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
    mutation_seed: u64,
    mutation_rate_ppm: u32,
    mutation_magnitude_ppm: u32,
    mutation_stats: MutationStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_mutation_operator_version",
        MUTATION_OPERATOR_VERSION,
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
    push_line(&mut text, "mutation_seed", &mutation_seed.to_string());
    push_line(&mut text, "mutation_rate_unit", "parts-per-million");
    push_line(
        &mut text,
        "mutation_rate_ppm",
        &mutation_rate_ppm.to_string(),
    );
    push_line(
        &mut text,
        "mutation_magnitude_unit",
        "parts-per-million-of-value-scale",
    );
    push_line(
        &mut text,
        "mutation_magnitude_ppm",
        &mutation_magnitude_ppm.to_string(),
    );
    push_line(&mut text, "mutation_selection_metric", SELECTION_METRIC);
    push_line(&mut text, "mutation_selection_scope", SELECTION_SCOPE);
    push_line(&mut text, "mutation_tie_break", TIE_BREAK);
    push_line(&mut text, "mutation_value_scale", VALUE_SCALE);
    push_line(
        &mut text,
        "mutation_total_parameter_count",
        &mutation_stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "mutation_selected_parameter_count",
        &mutation_stats.selected_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "mutation_changed_parameter_count",
        &mutation_stats.changed_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "mutation_selection_density_ppm",
        &mutation_stats.selection_density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "mutation_mask_checksum",
        &hex64(mutation_stats.mask_checksum),
    );
    push_line(
        &mut text,
        "mutation_delta_checksum",
        &hex64(mutation_stats.delta_checksum),
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

/// Mutates selected compatible tensor values and returns output values plus receipt stats.
fn mutation_values(
    base: &ParsedModel,
    reference: &ParsedModel,
    mutation_seed: u64,
    mutation_rate_ppm: u32,
    mutation_magnitude_ppm: u32,
) -> io::Result<(Vec<Vec<f32>>, MutationStats)> {
    if !same_shape(&base.shape, &reference.shape) {
        return Err(invalid("mutation parents have different model shapes"));
    }
    if base.flags != reference.flags {
        return Err(invalid("mutation parents have different output flags"));
    }
    if base.tokenizer.bytes != reference.tokenizer.bytes {
        return Err(invalid("mutation parents have different tokenizer bytes"));
    }
    let reference_by_hash = reference
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let mut output = Vec::with_capacity(base.tensors.len());
    let mut stats = MutationStats {
        total_parameter_count: 0,
        selected_parameter_count: 0,
        changed_parameter_count: 0,
        selection_density_ppm: 0,
        mask_checksum: mutation_mask_seed(mutation_seed, mutation_rate_ppm, mutation_magnitude_ppm),
        delta_checksum: mutation_delta_seed(
            mutation_seed,
            mutation_rate_ppm,
            mutation_magnitude_ppm,
        ),
    };
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let Some(reference_index) = reference_by_hash.get(&base_tensor.spec.name_hash) else {
            return Err(invalid(
                "reference parent is missing a tensor from the base parent",
            ));
        };
        let reference_tensor = &reference.tensors[*reference_index];
        require_same_tensor_spec(&base_tensor.spec, &reference_tensor.spec)?;
        let mut values = Vec::with_capacity(base_tensor.values.len());
        for (value_index, (base_value, reference_value)) in base_tensor
            .values
            .iter()
            .zip(reference_tensor.values.iter())
            .enumerate()
        {
            let selected =
                choose_mutation(mutation_seed, tensor_index, value_index, mutation_rate_ppm);
            stats.total_parameter_count += 1;
            mix_mask_value(&mut stats.mask_checksum, tensor_index as u64);
            mix_mask_value(&mut stats.mask_checksum, value_index as u64);
            mix_mask_value(&mut stats.mask_checksum, if selected { 1 } else { 0 });
            if selected {
                stats.selected_parameter_count += 1;
                let delta = mutation_delta(
                    mutation_seed,
                    tensor_index,
                    value_index,
                    *base_value,
                    *reference_value,
                    mutation_magnitude_ppm,
                )?;
                let mutated = *base_value + delta;
                if !mutated.is_finite() {
                    return Err(invalid("mutation produced a non-finite tensor value"));
                }
                if mutated != *base_value {
                    stats.changed_parameter_count += 1;
                }
                mix_delta_value(&mut stats.delta_checksum, tensor_index as u64);
                mix_delta_value(&mut stats.delta_checksum, value_index as u64);
                mix_delta_value(&mut stats.delta_checksum, u64::from(delta.to_bits()));
                mix_delta_value(&mut stats.delta_checksum, u64::from(mutated.to_bits()));
                values.push(mutated);
            } else {
                values.push(*base_value);
            }
        }
        output.push(values);
    }
    stats.selection_density_ppm =
        ratio_ppm(stats.selected_parameter_count, stats.total_parameter_count)?;
    mix_mask_value(&mut stats.mask_checksum, stats.total_parameter_count);
    mix_mask_value(&mut stats.mask_checksum, stats.selected_parameter_count);
    mix_delta_value(&mut stats.delta_checksum, stats.changed_parameter_count);
    Ok((output, stats))
}

/// Applies the mutation-rate threshold with fixed behavior for boundary values.
fn choose_mutation(
    mutation_seed: u64,
    tensor_index: usize,
    value_index: usize,
    mutation_rate_ppm: u32,
) -> bool {
    if mutation_rate_ppm == 0 {
        return false;
    }
    if mutation_rate_ppm >= PPM_DENOMINATOR {
        return true;
    }
    draw_ppm(mutation_seed, tensor_index, value_index) <= mutation_rate_ppm
}

/// Computes a bounded signed perturbation for a selected tensor value.
fn mutation_delta(
    mutation_seed: u64,
    tensor_index: usize,
    value_index: usize,
    base_value: f32,
    reference_value: f32,
    mutation_magnitude_ppm: u32,
) -> io::Result<f32> {
    if mutation_magnitude_ppm == 0 {
        return Ok(0.0);
    }
    let scale = base_value.abs().max(reference_value.abs()).max(1.0);
    let magnitude = mutation_magnitude_ppm as f32 / PPM_DENOMINATOR as f32;
    let unit = draw_unit(mutation_seed, tensor_index, value_index);
    let sign = if draw_sign(mutation_seed, tensor_index, value_index) {
        1.0
    } else {
        -1.0
    };
    let delta = sign * scale * magnitude * unit;
    if !delta.is_finite() {
        return Err(invalid("mutation delta overflowed finite f32 range"));
    }
    Ok(delta)
}

/// Produces a parts-per-million draw from stable tensor and element coordinates.
fn draw_ppm(mutation_seed: u64, tensor_index: usize, value_index: usize) -> u32 {
    let mixed = splitmix64(coordinate_seed(mutation_seed, tensor_index, value_index));
    (mixed % u64::from(PPM_DENOMINATOR) + 1) as u32
}

/// Produces a unit interval multiplier from the same deterministic coordinate key.
fn draw_unit(mutation_seed: u64, tensor_index: usize, value_index: usize) -> f32 {
    let mixed = splitmix64(
        coordinate_seed(mutation_seed, tensor_index, value_index) ^ 0xd134_2543_de82_ef95,
    );
    (mixed % u64::from(PPM_DENOMINATOR) + 1) as f32 / PPM_DENOMINATOR as f32
}

/// Chooses the deterministic sign for one mutation coordinate.
fn draw_sign(mutation_seed: u64, tensor_index: usize, value_index: usize) -> bool {
    (splitmix64(coordinate_seed(mutation_seed, tensor_index, value_index) ^ 0x94d0_49bb_1331_11eb)
        & 1)
        == 1
}

/// Mixes the operator seed with tensor and element coordinates.
fn coordinate_seed(mutation_seed: u64, tensor_index: usize, value_index: usize) -> u64 {
    mutation_seed
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

/// Starts the mutation selection-mask checksum from operator parameters.
fn mutation_mask_seed(
    mutation_seed: u64,
    mutation_rate_ppm: u32,
    mutation_magnitude_ppm: u32,
) -> u64 {
    let mut acc = 0x6d75_7461_7465_7631u64;
    mix_mask_value(&mut acc, mutation_seed);
    mix_mask_value(&mut acc, u64::from(mutation_rate_ppm));
    mix_mask_value(&mut acc, u64::from(mutation_magnitude_ppm));
    acc
}

/// Starts the mutation delta checksum from operator parameters.
fn mutation_delta_seed(
    mutation_seed: u64,
    mutation_rate_ppm: u32,
    mutation_magnitude_ppm: u32,
) -> u64 {
    let mut acc = 0x6465_6c74_616d_7631u64;
    mix_delta_value(&mut acc, mutation_seed);
    mix_delta_value(&mut acc, u64::from(mutation_rate_ppm));
    mix_delta_value(&mut acc, u64::from(mutation_magnitude_ppm));
    acc
}

/// Folds one mask value into a compact deterministic checksum.
fn mix_mask_value(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(11).wrapping_mul(0x1000_0000_01b3);
}

/// Folds one selected delta value into a compact deterministic checksum.
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
    u64::try_from(ppm).map_err(|_| invalid("mutation ratio overflowed u64"))
}

/// Parses the deterministic mutation seed from a CLI or receipt field.
fn parse_mutation_seed(value: &str) -> io::Result<u64> {
    value
        .parse::<u64>()
        .map_err(|_| invalid("mutation seed must be an unsigned 64-bit integer"))
}

/// Parses mutation rate as an integer parts-per-million value.
fn parse_mutation_rate_ppm(value: &str) -> io::Result<u32> {
    let rate = value
        .parse::<u32>()
        .map_err(|_| invalid("mutation rate must be an integer parts-per-million value"))?;
    if rate > PPM_DENOMINATOR {
        return Err(invalid("mutation rate must be between 0 and 1000000"));
    }
    Ok(rate)
}

/// Parses mutation magnitude as an integer parts-per-million value.
fn parse_mutation_magnitude_ppm(value: &str) -> io::Result<u32> {
    let magnitude = value
        .parse::<u32>()
        .map_err(|_| invalid("mutation magnitude must be an integer parts-per-million value"))?;
    if magnitude > PPM_DENOMINATOR {
        return Err(invalid("mutation magnitude must be between 0 and 1000000"));
    }
    Ok(magnitude)
}

/// Holds deterministic mutation selection counts and checksum metadata.
#[derive(Clone, Copy)]
struct MutationStats {
    total_parameter_count: u64,
    selected_parameter_count: u64,
    changed_parameter_count: u64,
    selection_density_ppm: u64,
    mask_checksum: u64,
    delta_checksum: u64,
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

    // Exercises seed, rate, and magnitude through candidate writing and receipt validation.
    #[test]
    fn writes_and_validates_seeded_f32_mutation_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "mut-f32", "mutation-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            7,
            1_000_000,
            100_000,
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
        assert_ne!(
            parse_model_values(&candidate).unwrap().tensors[0].values,
            parse_model_values(&base).unwrap().tensors[0].values
        );
        assert!(receipt.contains("operator_kind=deterministic-bounded-parameter-mutation"));
        assert!(receipt.contains("mutation_seed=7"));
        assert!(receipt.contains("mutation_rate_ppm=1000000"));
        assert!(receipt.contains("mutation_magnitude_ppm=100000"));
        assert!(receipt.contains("mutation_mask_checksum="));
        assert!(receipt.contains("mutation_delta_checksum="));
    }

    // Exercises all path-level inputs plus default seed, rate, and magnitude parameters.
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
            lineage::build_template_text(&compatibility, "mut-path", "mutation-v1", "tiny")
                .unwrap();
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
        assert!(receipt.contains("mutation_seed=1099511628211"));
        assert!(receipt.contains("mutation_rate_ppm=10000"));
        assert!(receipt.contains("mutation_magnitude_ppm=50000"));
    }

    // Covers the mutation_rate_ppm lower boundary where the base is preserved.
    #[test]
    fn rate_zero_preserves_base_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "mut-rate-zero", "mutation-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            13,
            0,
            1_000_000,
        )
        .unwrap();

        assert_same_values(&candidate, &base);
        assert!(receipt.contains("mutation_selected_parameter_count=0"));
        assert!(receipt.contains("mutation_selection_density_ppm=0"));
    }

    // Covers the mutation_magnitude_ppm lower boundary while selection still occurs.
    #[test]
    fn magnitude_zero_preserves_base_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "mut-mag-zero", "mutation-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            13,
            1_000_000,
            0,
        )
        .unwrap();

        assert_same_values(&candidate, &base);
        assert!(receipt.contains("mutation_selection_density_ppm=1000000"));
        assert!(receipt.contains("mutation_changed_parameter_count=0"));
    }

    // Confirms mutation_seed changes the selected mask and produced candidate.
    #[test]
    fn mutation_seed_changes_selection_mask() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "mut-seed", "mutation-v1", "tiny")
                .unwrap();

        let (candidate_a, receipt_a) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate-a.slm",
            1,
            500_000,
            100_000,
        )
        .unwrap();
        let (candidate_b, receipt_b) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate-b.slm",
            2,
            500_000,
            100_000,
        )
        .unwrap();

        let receipt_a_fields = parse_manifest(&receipt_a, "mutation receipt a").unwrap();
        let receipt_b_fields = parse_manifest(&receipt_b, "mutation receipt b").unwrap();
        assert_ne!(candidate_a, candidate_b);
        assert_ne!(
            receipt_a_fields.get("mutation_mask_checksum"),
            receipt_b_fields.get("mutation_mask_checksum")
        );
    }

    // Confirms mutation_magnitude_ppm changes the bounded perturbation size.
    #[test]
    fn mutation_magnitude_changes_candidate_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let reference = tiny_f32_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "mut-mag", "mutation-v1", "tiny").unwrap();

        let (small, small_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "small.slm",
            7,
            1_000_000,
            1,
        )
        .unwrap();
        let (large, large_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "large.slm",
            7,
            1_000_000,
            250_000,
        )
        .unwrap();

        let small_fields = parse_manifest(&small_receipt, "small mutation receipt").unwrap();
        let large_fields = parse_manifest(&large_receipt, "large mutation receipt").unwrap();
        assert_ne!(small, large);
        assert_ne!(
            small_fields.get("mutation_delta_checksum"),
            large_fields.get("mutation_delta_checksum")
        );
    }

    // Confirms the compatible reference parent participates in the perturbation scale.
    #[test]
    fn reference_parent_scale_changes_candidate_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let small_reference = tiny_f32_scaled_bytes(2.0);
        let large_reference = tiny_f32_scaled_bytes(5.0);
        let small_compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &small_reference,
            "small-ref.slm",
        )
        .unwrap();
        let large_compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &large_reference,
            "large-ref.slm",
        )
        .unwrap();
        let small_lineage =
            lineage::build_template_text(&small_compatibility, "mut-ref-a", "mutation-v1", "tiny")
                .unwrap();
        let large_lineage =
            lineage::build_template_text(&large_compatibility, "mut-ref-b", "mutation-v1", "tiny")
                .unwrap();

        let (small_candidate, _) = build_candidate_bytes_and_receipt(
            &small_compatibility,
            &small_lineage,
            &base,
            "base.slm",
            &small_reference,
            "small-ref.slm",
            "small-candidate.slm",
            99,
            1_000_000,
            100_000,
        )
        .unwrap();
        let (large_candidate, _) = build_candidate_bytes_and_receipt(
            &large_compatibility,
            &large_lineage,
            &base,
            "base.slm",
            &large_reference,
            "large-ref.slm",
            "large-candidate.slm",
            99,
            1_000_000,
            100_000,
        )
        .unwrap();

        assert_ne!(small_candidate, large_candidate);
    }

    // Validates q8 parents keep their quantization route through mutation output.
    #[test]
    fn writes_and_validates_q8_mutation_candidate() {
        let base = tiny_q8_scaled_bytes(1.0);
        let reference = tiny_q8_scaled_bytes(2.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &reference, "ref.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "mut-q8", "mutation-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            42,
            1_000_000,
            250_000,
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
            lineage::build_template_text(&compatibility, "mut-drift", "mutation-v1", "tiny")
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
            7,
            1_000_000,
            100_000,
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
            lineage::build_template_text(&compatibility, "mut-drift", "mutation-v1", "tiny")
                .unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &reference,
            "ref.slm",
            "candidate.slm",
            7,
            1_000_000,
            100_000,
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

    // Covers parser behavior for seed, rate, and magnitude inputs.
    #[test]
    fn rejects_invalid_mutation_parameters() {
        assert_eq!(
            parse_mutation_seed("18446744073709551616")
                .unwrap_err()
                .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_seed("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_seed("seed").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_rate_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_rate_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_rate_ppm("half").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_magnitude_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_magnitude_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_mutation_magnitude_ppm("wide").unwrap_err().kind(),
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
        std::env::temp_dir().join(format!("tinyrustlm-mutation-{label}-{nanos}"))
    }
}
