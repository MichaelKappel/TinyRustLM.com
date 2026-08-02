//! Offline direct-parameter task-delta operator for model-breeding candidates.

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

const DELTA_OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "direct-parameter-task-delta";
const OPERATOR_STATUS: &str = "candidate-written";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const MIN_DELTA_WEIGHT_PPM: i64 = -1_000_000;
const MAX_DELTA_WEIGHT_PPM: i64 = 2_000_000;

/// Writes a task-delta candidate `.slm` plus a recomputable operator receipt.
pub(crate) fn write_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    delta_weight_ppm: &str,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let weight = parse_delta_weight_ppm(delta_weight_ppm)?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
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
    println!("SLM task-delta candidate written: {}", output_slm.display());
    println!(
        "SLM task-delta operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a task-delta candidate and receipt by recomputing the operator output.
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
    println!("SLM task-delta candidate validation: PASS");
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
    let receipt = parse_manifest(receipt_text, "task-delta operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_delta_operator_version",
        DELTA_OPERATOR_VERSION,
    )?;
    require_equal(&receipt, "delta_weight_unit", "parts-per-million")?;
    require_equal(&receipt, "base_parent_index", "0")?;
    require_equal(&receipt, "target_parent_index", "1")?;
    let weight = parse_delta_weight_ppm(require_key(&receipt, "delta_weight_ppm")?)?;
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
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        candidate_path,
        weight,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "task-delta candidate bytes do not match the operator receipt",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "task-delta operator receipt fields do not match recomputed output",
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
    let output_values = delta_values(&base, &target, delta_weight_ppm)?;
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
    )?;
    Ok((candidate, receipt))
}

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
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_delta_operator_version",
        DELTA_OPERATOR_VERSION,
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

fn delta_values(
    base: &ParsedModel,
    target: &ParsedModel,
    delta_weight_ppm: i64,
) -> io::Result<Vec<Vec<f32>>> {
    if !same_shape(&base.shape, &target.shape) {
        return Err(invalid("task-delta parents have different model shapes"));
    }
    if base.flags != target.flags {
        return Err(invalid("task-delta parents have different output flags"));
    }
    if base.tokenizer.bytes != target.tokenizer.bytes {
        return Err(invalid("task-delta parents have different tokenizer bytes"));
    }
    let target_by_hash = target
        .tensors
        .iter()
        .enumerate()
        .map(|(index, tensor)| (tensor.spec.name_hash, index))
        .collect::<HashMap<_, _>>();
    let delta_weight = delta_weight_ppm as f32 / PPM_DENOMINATOR as f32;
    let mut output = Vec::with_capacity(base.tensors.len());
    for base_tensor in &base.tensors {
        let Some(target_index) = target_by_hash.get(&base_tensor.spec.name_hash) else {
            return Err(invalid(
                "target parent is missing a tensor from the base parent",
            ));
        };
        let target_tensor = &target.tensors[*target_index];
        require_same_tensor_spec(&base_tensor.spec, &target_tensor.spec)?;
        let values = base_tensor
            .values
            .iter()
            .zip(target_tensor.values.iter())
            .map(|(base_value, target_value)| {
                base_value + (target_value - base_value) * delta_weight
            })
            .collect::<Vec<_>>();
        output.push(values);
    }
    Ok(output)
}

fn parse_delta_weight_ppm(value: &str) -> io::Result<i64> {
    let weight = value
        .parse::<i64>()
        .map_err(|_| invalid("task-delta weight must be an integer parts-per-million value"))?;
    if !(MIN_DELTA_WEIGHT_PPM..=MAX_DELTA_WEIGHT_PPM).contains(&weight) {
        return Err(invalid(
            "task-delta weight must be between -1000000 and 2000000",
        ));
    }
    Ok(weight)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compatibility;
    use crate::tensor_writer::{tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use crate::{build_model_file, build_model_file_from_values_with_flags, fixture_value};

    #[test]
    fn writes_and_validates_weighted_f32_task_delta_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "delta-f32", "task-vector-v1", "tiny")
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
        let parsed = parse_model_values(&candidate).unwrap();
        assert_eq!(parsed.tensors[0].values[0], 0.25);
        assert!(receipt.contains("operator_kind=direct-parameter-task-delta"));
        assert!(receipt.contains("delta_weight_ppm=500000"));
        assert!(receipt.contains("base_coefficient_ppm=500000"));
    }

    #[test]
    fn writes_and_validates_q8_task_delta_candidate() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "delta-q8", "task-vector-v1", "tiny")
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
    fn rejects_parent_checksum_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "delta-f32", "task-vector-v1", "tiny")
                .unwrap();
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
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    #[test]
    fn validation_rejects_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "delta-f32", "task-vector-v1", "tiny")
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
    fn rejects_invalid_task_delta_weight() {
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
