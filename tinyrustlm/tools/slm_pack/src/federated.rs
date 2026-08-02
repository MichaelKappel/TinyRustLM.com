//! Offline federated/local-update operator for model-breeding candidates.

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

const FEDERATED_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "federated-local-update-average";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const DEFAULT_LOCAL_UPDATE_WEIGHT_PPM: &str = "1000000";
const UPDATE_STRATEGY: &str = "single-client-fedavg-v1";
const UPDATE_SCOPE: &str = "compatible-direct-parameter-delta";

/// Writes a federated local-update candidate `.slm` plus a recomputable receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    local_update_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    local_update_weight_ppm: Option<&str>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let local_update_bytes = fs::read(local_update_parent)?;
    let weight = parse_local_update_weight_ppm(
        local_update_weight_ppm.unwrap_or(DEFAULT_LOCAL_UPDATE_WEIGHT_PPM),
    )?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &local_update_bytes,
        &local_update_parent.display().to_string(),
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
    println!(
        "SLM federated local-update candidate written: {}",
        output_slm.display()
    );
    println!(
        "SLM federated operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a federated local-update candidate by replaying the receipt.
pub(crate) fn validate_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    local_update_parent: &Path,
    candidate_slm: &Path,
    receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let local_update_bytes = fs::read(local_update_parent)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_candidate_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &local_update_bytes,
        &local_update_parent.display().to_string(),
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
    )?;
    println!("SLM federated local-update candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

/// Recomputes federated output from receipt fields and compares both artifacts.
fn validate_candidate_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    local_update_bytes: &[u8],
    local_update_path: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "federated operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_federated_operator_version",
        FEDERATED_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", OPERATOR_KIND)?;
    require_equal(&receipt, "base_parent_index", "0")?;
    require_equal(&receipt, "local_update_parent_index", "1")?;
    require_equal(&receipt, "local_update_weight_unit", "parts-per-million")?;
    require_equal(&receipt, "local_update_strategy", UPDATE_STRATEGY)?;
    require_equal(&receipt, "local_update_scope", UPDATE_SCOPE)?;
    let weight = parse_local_update_weight_ppm(require_key(&receipt, "local_update_weight_ppm")?)?;
    require_equal(
        &receipt,
        "base_coefficient_ppm",
        &(PPM_DENOMINATOR - weight).to_string(),
    )?;
    require_equal(
        &receipt,
        "local_update_coefficient_ppm",
        &weight.to_string(),
    )?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        local_update_bytes,
        local_update_path,
        candidate_path,
        weight,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "federated candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "federated operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Builds the federated `.slm` bytes and receipt from compatible parent bytes.
fn build_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    local_update_bytes: &[u8],
    local_update_path: &str,
    candidate_path: &str,
    local_update_weight_ppm: u32,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let local_update_report = slm_validate::validate_bytes(local_update_bytes, local_update_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &local_update_report)?;

    let base = parse_model_values(base_bytes)?;
    let local_update = parse_model_values(local_update_bytes)?;
    let (output_values, stats) = federated_values(&base, &local_update, local_update_weight_ppm)?;
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
        local_update_path,
        &base_report,
        &local_update_report,
        &candidate_report,
        local_update_weight_ppm,
        stats,
    )?;
    Ok((candidate, receipt))
}

/// Formats the receipt fields that make a local-update candidate replayable.
#[allow(clippy::too_many_arguments)]
fn build_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    local_update_path: &str,
    base_report: &ValidationReport,
    local_update_report: &ValidationReport,
    candidate_report: &ValidationReport,
    local_update_weight_ppm: u32,
    stats: FederatedStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_federated_operator_version",
        FEDERATED_OPERATOR_VERSION,
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
        local_update_path,
        local_update_report,
    )?;
    push_line(&mut text, "base_parent_index", "0");
    push_line(&mut text, "local_update_parent_index", "1");
    push_line(&mut text, "local_update_strategy", UPDATE_STRATEGY);
    push_line(&mut text, "local_update_scope", UPDATE_SCOPE);
    push_line(&mut text, "local_update_weight_unit", "parts-per-million");
    push_line(
        &mut text,
        "local_update_weight_ppm",
        &local_update_weight_ppm.to_string(),
    );
    push_line(
        &mut text,
        "base_coefficient_ppm",
        &(PPM_DENOMINATOR - local_update_weight_ppm).to_string(),
    );
    push_line(
        &mut text,
        "local_update_coefficient_ppm",
        &local_update_weight_ppm.to_string(),
    );
    push_line(
        &mut text,
        "local_update_total_parameter_count",
        &stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "local_update_changed_parameter_count",
        &stats.changed_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "local_update_changed_density_ppm",
        &stats.changed_density_ppm.to_string(),
    );
    push_line(
        &mut text,
        "local_update_delta_checksum",
        &hex64(stats.delta_checksum),
    );
    push_line(
        &mut text,
        "local_update_weighted_delta_checksum",
        &hex64(stats.weighted_delta_checksum),
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

/// Applies `base + weight * (local_update - base)` across compatible tensors.
fn federated_values(
    base: &ParsedModel,
    local_update: &ParsedModel,
    local_update_weight_ppm: u32,
) -> io::Result<(Vec<Vec<f32>>, FederatedStats)> {
    if !same_shape(&base.shape, &local_update.shape) {
        return Err(invalid("federated parents have different model shapes"));
    }
    if base.flags != local_update.flags {
        return Err(invalid("federated parents have different output flags"));
    }
    if base.tokenizer.bytes != local_update.tokenizer.bytes {
        return Err(invalid("federated parents have different tokenizer bytes"));
    }
    let update_by_hash = local_update
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let update_weight = local_update_weight_ppm as f32 / PPM_DENOMINATOR as f32;
    let mut output = Vec::with_capacity(base.tensors.len());
    let mut stats = FederatedStats {
        total_parameter_count: 0,
        changed_parameter_count: 0,
        changed_density_ppm: 0,
        delta_checksum: checksum_seed(0x6665_6464_656c_7631, local_update_weight_ppm),
        weighted_delta_checksum: checksum_seed(0x6665_6477_656c_7631, local_update_weight_ppm),
    };
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let Some(update_index) = update_by_hash.get(&base_tensor.spec.name_hash) else {
            return Err(invalid(
                "local update parent is missing a tensor from the base parent",
            ));
        };
        let update_tensor = &local_update.tensors[*update_index];
        require_same_tensor_spec(&base_tensor.spec, &update_tensor.spec)?;
        let mut values = Vec::with_capacity(base_tensor.values.len());
        for (value_index, (base_value, update_value)) in base_tensor
            .values
            .iter()
            .zip(update_tensor.values.iter())
            .enumerate()
        {
            let raw_delta = *update_value - *base_value;
            let weighted_delta = raw_delta * update_weight;
            let value = *base_value + weighted_delta;
            if !value.is_finite() {
                return Err(invalid(
                    "federated local update produced a non-finite value",
                ));
            }
            stats.total_parameter_count += 1;
            if value != *base_value {
                stats.changed_parameter_count += 1;
            }
            mix_checksum(&mut stats.delta_checksum, tensor_index as u64);
            mix_checksum(&mut stats.delta_checksum, value_index as u64);
            mix_checksum(&mut stats.delta_checksum, u64::from(raw_delta.to_bits()));
            mix_checksum(&mut stats.weighted_delta_checksum, tensor_index as u64);
            mix_checksum(&mut stats.weighted_delta_checksum, value_index as u64);
            mix_checksum(
                &mut stats.weighted_delta_checksum,
                u64::from(weighted_delta.to_bits()),
            );
            mix_checksum(
                &mut stats.weighted_delta_checksum,
                u64::from(value.to_bits()),
            );
            values.push(value);
        }
        output.push(values);
    }
    stats.changed_density_ppm =
        ratio_ppm(stats.changed_parameter_count, stats.total_parameter_count)?;
    mix_checksum(&mut stats.delta_checksum, stats.total_parameter_count);
    mix_checksum(&mut stats.delta_checksum, stats.changed_parameter_count);
    mix_checksum(
        &mut stats.weighted_delta_checksum,
        stats.changed_parameter_count,
    );
    Ok((output, stats))
}

/// Starts a compact checksum from the operator kind and local-update weight.
fn checksum_seed(seed: u64, local_update_weight_ppm: u32) -> u64 {
    let mut acc = seed;
    mix_checksum(&mut acc, u64::from(local_update_weight_ppm));
    acc
}

/// Folds one u64 into a deterministic receipt checksum.
fn mix_checksum(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(9).wrapping_mul(0x1000_0000_01b3);
}

/// Converts a count ratio into integer parts-per-million.
fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    let ppm = u128::from(numerator) * u128::from(PPM_DENOMINATOR) / u128::from(denominator);
    u64::try_from(ppm).map_err(|_| invalid("federated ratio overflowed u64"))
}

/// Parses local update weight as an integer parts-per-million value.
fn parse_local_update_weight_ppm(value: &str) -> io::Result<u32> {
    let weight = value
        .parse::<u32>()
        .map_err(|_| invalid("local update weight must be an integer parts-per-million value"))?;
    if weight > PPM_DENOMINATOR {
        return Err(invalid("local update weight must be between 0 and 1000000"));
    }
    Ok(weight)
}

/// Holds receipt metadata for the federated local-update delta.
#[derive(Clone, Copy)]
struct FederatedStats {
    total_parameter_count: u64,
    changed_parameter_count: u64,
    changed_density_ppm: u64,
    delta_checksum: u64,
    weighted_delta_checksum: u64,
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

    // Exercises lineage, compatibility, both parent byte inputs, and update weight.
    #[test]
    fn writes_and_validates_weighted_f32_federated_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(3.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-f32", "federated-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "candidate.slm",
            250_000,
        )
        .unwrap();

        validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert_ne!(
            parse_model_values(&candidate).unwrap().tensors[0].values,
            parse_model_values(&base).unwrap().tensors[0].values
        );
        assert!(receipt.contains("operator_kind=federated-local-update-average"));
        assert!(receipt.contains("local_update_strategy=single-client-fedavg-v1"));
        assert!(receipt.contains("local_update_weight_ppm=250000"));
        assert!(receipt.contains("base_coefficient_ppm=750000"));
        assert!(receipt.contains("local_update_delta_checksum="));
        assert!(receipt.contains("local_update_weighted_delta_checksum="));
    }

    // Exercises path-level IO and the default local_update_weight_ppm parameter.
    #[test]
    fn path_writer_uses_default_weight_then_validates() {
        let dir = unique_dir("path-defaults");
        fs::create_dir_all(&dir).unwrap();
        let base_path = dir.join("base.slm");
        let local_path = dir.join("local.slm");
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(2.0);
        fs::write(&base_path, &base).unwrap();
        fs::write(&local_path, &local_update).unwrap();
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            &base_path.display().to_string(),
            &local_update,
            &local_path.display().to_string(),
        )
        .unwrap();
        fs::write(&compatibility_path, &compatibility).unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-path", "federated-v1", "tiny")
                .unwrap();
        fs::write(&lineage_path, &lineage).unwrap();

        write_candidate_path(
            &compatibility_path,
            &lineage_path,
            &base_path,
            &local_path,
            &candidate_path,
            &receipt_path,
            None,
        )
        .unwrap();
        validate_candidate_path(
            &compatibility_path,
            &lineage_path,
            &base_path,
            &local_path,
            &candidate_path,
            &receipt_path,
        )
        .unwrap();

        let receipt = fs::read_to_string(receipt_path).unwrap();
        assert!(receipt.contains("local_update_weight_ppm=1000000"));
        assert_same_values(&fs::read(candidate_path).unwrap(), &local_update);
    }

    // Covers the local_update_weight_ppm lower boundary where the base is preserved.
    #[test]
    fn weight_zero_preserves_base_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(3.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-zero", "federated-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "candidate.slm",
            0,
        )
        .unwrap();

        assert_same_values(&candidate, &base);
        assert!(receipt.contains("base_coefficient_ppm=1000000"));
        assert!(receipt.contains("local_update_changed_parameter_count=0"));
        assert!(receipt.contains("local_update_changed_density_ppm=0"));
    }

    // Covers the upper boundary where the local update becomes the candidate.
    #[test]
    fn weight_full_uses_local_update_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(3.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-full", "federated-v1", "tiny")
                .unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "candidate.slm",
            1_000_000,
        )
        .unwrap();

        assert_same_values(&candidate, &local_update);
        let receipt_fields = parse_manifest(&receipt, "federated full update receipt").unwrap();
        assert!(receipt.contains("base_coefficient_ppm=0"));
        let changed = receipt_fields
            .get("local_update_changed_parameter_count")
            .unwrap()
            .parse::<u64>()
            .unwrap();
        let total = receipt_fields
            .get("local_update_total_parameter_count")
            .unwrap()
            .parse::<u64>()
            .unwrap();
        assert!(changed > 0);
        assert!(changed <= total);
    }

    // Confirms local_update_weight_ppm changes the candidate values and checksum.
    #[test]
    fn local_update_weight_changes_candidate_values() {
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(3.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-weight", "federated-v1", "tiny")
                .unwrap();

        let (small, small_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "small.slm",
            250_000,
        )
        .unwrap();
        let (large, large_receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "large.slm",
            750_000,
        )
        .unwrap();

        let small_fields = parse_manifest(&small_receipt, "small fed receipt").unwrap();
        let large_fields = parse_manifest(&large_receipt, "large fed receipt").unwrap();
        assert_ne!(small, large);
        assert_ne!(
            small_fields.get("local_update_weighted_delta_checksum"),
            large_fields.get("local_update_weighted_delta_checksum")
        );
    }

    // Validates q8 parents keep their quantization route through federated output.
    #[test]
    fn writes_and_validates_q8_federated_candidate() {
        let base = tiny_q8_scaled_bytes(1.0);
        let local_update = tiny_q8_scaled_bytes(2.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-q8", "federated-v1", "tiny").unwrap();

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "candidate.slm",
            500_000,
        )
        .unwrap();

        slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("candidate_quantization=q8_0"));
    }

    // Confirms base parameters are tied to compatibility reports by checksum.
    #[test]
    fn rejects_parent_checksum_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(2.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-drift", "federated-v1", "tiny")
                .unwrap();
        let changed_base = tiny_f32_scaled_bytes(3.0);

        let error = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &changed_base,
            "base.slm",
            &local_update,
            "local.slm",
            "candidate.slm",
            500_000,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    // Confirms validation catches candidate bytes that no longer match the receipt.
    #[test]
    fn validation_rejects_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let local_update = tiny_f32_scaled_bytes(2.0);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &base,
            "base.slm",
            &local_update,
            "local.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "fed-drift", "federated-v1", "tiny")
                .unwrap();
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            "candidate.slm",
            500_000,
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &local_update,
            "local.slm",
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    // Covers parser behavior for local_update_weight_ppm.
    #[test]
    fn rejects_invalid_local_update_weight() {
        assert_eq!(
            parse_local_update_weight_ppm("1000001").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_local_update_weight_ppm("-1").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            parse_local_update_weight_ppm("half").unwrap_err().kind(),
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
        std::env::temp_dir().join(format!("tinyrustlm-federated-{label}-{nanos}"))
    }
}
