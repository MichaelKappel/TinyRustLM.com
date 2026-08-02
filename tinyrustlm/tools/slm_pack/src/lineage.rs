//! Candidate lineage manifests for future offline assembly operators.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

const LINEAGE_VERSION: &str = "1";
const COMPATIBILITY_VERSION: &str = "1";
const CANDIDATE_STATUS_PLANNED: &str = "planned";
const CANDIDATE_ARTIFACT_STATUS: &str = "not-written";
const REQUIRED_NEXT_GATE: &str =
    "operator-output-slm-validation-plus-manifest-plus-runtime-smoke-plus-eval";

const PARENT_KEYS: [&str; 9] = [
    "path",
    "slm_checksum",
    "model_shape",
    "tensor_count",
    "parameter_count",
    "quantization",
    "output_contract",
    "tokenizer_checksum",
    "tensor_layout_checksum",
];

/// Writes a candidate lineage template from a passing parent compatibility report.
pub(crate) fn write_template_path(
    compatibility: &Path,
    output: &Path,
    candidate_id: &str,
    operator_id: &str,
    resource_budget: &str,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let text = build_template_text(
        &compatibility_text,
        candidate_id,
        operator_id,
        resource_budget,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, text)?;
    println!(
        "SLM candidate lineage template written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a candidate lineage manifest against its parent compatibility report.
pub(crate) fn validate_path(compatibility: &Path, lineage: &Path) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage)?;
    validate_text(&compatibility_text, &lineage_text)?;
    println!("SLM candidate lineage validation: PASS");
    println!("compatibility: {}", compatibility.display());
    println!("lineage: {}", lineage.display());
    Ok(())
}

/// Builds a candidate lineage template from a passing compatibility report.
pub(crate) fn build_template_text(
    compatibility_text: &str,
    candidate_id: &str,
    operator_id: &str,
    resource_budget: &str,
) -> io::Result<String> {
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    validate_slug(candidate_id, "candidate_id")?;
    validate_slug(operator_id, "operator_id")?;
    validate_value(resource_budget, "resource_budget")?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_candidate_lineage_version",
        LINEAGE_VERSION,
    );
    push_line(&mut text, "candidate_id", candidate_id);
    push_line(&mut text, "candidate_status", CANDIDATE_STATUS_PLANNED);
    push_line(&mut text, "operator_id", operator_id);
    push_line(
        &mut text,
        "operator_lane",
        require_key(&compatibility, "operator_lane")?,
    );
    push_line(&mut text, "resource_budget", resource_budget);
    push_line(
        &mut text,
        "compatibility_report_checksum",
        &hex64(text_checksum(compatibility_text.as_bytes())),
    );
    push_line(
        &mut text,
        "compatibility_scope",
        require_key(&compatibility, "compatibility_scope")?,
    );
    push_line(&mut text, "compatibility_result", "pass");
    push_line(&mut text, "compatible_parent_set", "true");
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, &compatibility, 0)?;
    push_parent_lines(&mut text, &compatibility, 1)?;
    push_line(
        &mut text,
        "candidate_artifact_status",
        CANDIDATE_ARTIFACT_STATUS,
    );
    push_line(&mut text, "candidate_artifact_path", "pending");
    push_line(&mut text, "candidate_slm_checksum", "pending");
    push_line(&mut text, "candidate_manifest_path", "pending");
    push_line(&mut text, "candidate_eval_path", "pending");
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

/// Validates candidate lineage text against its parent compatibility report.
pub(crate) fn validate_text(compatibility_text: &str, lineage_text: &str) -> io::Result<()> {
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage = parse_manifest(lineage_text, "lineage")?;
    require_equal(
        &lineage,
        "tinyrustlm_candidate_lineage_version",
        LINEAGE_VERSION,
    )?;
    validate_slug(require_key(&lineage, "candidate_id")?, "candidate_id")?;
    require_equal(&lineage, "candidate_status", CANDIDATE_STATUS_PLANNED)?;
    validate_slug(require_key(&lineage, "operator_id")?, "operator_id")?;
    require_equal(
        &lineage,
        "operator_lane",
        require_key(&compatibility, "operator_lane")?,
    )?;
    validate_value(require_key(&lineage, "resource_budget")?, "resource_budget")?;
    require_equal(
        &lineage,
        "compatibility_report_checksum",
        &hex64(text_checksum(compatibility_text.as_bytes())),
    )?;
    require_equal(
        &lineage,
        "compatibility_scope",
        require_key(&compatibility, "compatibility_scope")?,
    )?;
    require_equal(&lineage, "compatibility_result", "pass")?;
    require_equal(&lineage, "compatible_parent_set", "true")?;
    require_equal(&lineage, "parent_count", "2")?;
    require_parent_lines(&compatibility, &lineage, 0)?;
    require_parent_lines(&compatibility, &lineage, 1)?;
    require_equal(
        &lineage,
        "candidate_artifact_status",
        CANDIDATE_ARTIFACT_STATUS,
    )?;
    require_equal(&lineage, "candidate_artifact_path", "pending")?;
    require_equal(&lineage, "candidate_slm_checksum", "pending")?;
    require_equal(&lineage, "candidate_manifest_path", "pending")?;
    require_equal(&lineage, "candidate_eval_path", "pending")?;
    require_equal(&lineage, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

fn parse_passing_compatibility(text: &str) -> io::Result<HashMap<String, String>> {
    let fields = parse_manifest(text, "compatibility")?;
    require_equal(
        &fields,
        "tinyrustlm_parent_compatibility_version",
        COMPATIBILITY_VERSION,
    )?;
    require_equal(&fields, "compatibility_result", "pass")?;
    require_equal(&fields, "compatible_parent_set", "true")?;
    require_equal(&fields, "compatibility_reasons", "all-compatible")?;
    require_equal(&fields, "parent_count", "2")?;
    require_equal(
        &fields,
        "decision",
        "accepted-parent-set-for-offline-operators",
    )?;
    require_key(&fields, "compatibility_scope")?;
    require_key(&fields, "operator_lane")?;
    for index in 0..2 {
        for key in PARENT_KEYS {
            let full_key = format!("parent.{index}.{key}");
            require_key(&fields, &full_key)?;
        }
    }
    Ok(fields)
}

fn push_parent_lines(
    text: &mut String,
    compatibility: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let compatibility_key = format!("parent.{index}.{key}");
        let lineage_key = format!("parent.{index}.{key}");
        push_line(
            text,
            &lineage_key,
            require_key(compatibility, &compatibility_key)?,
        );
    }
    Ok(())
}

fn require_parent_lines(
    compatibility: &HashMap<String, String>,
    lineage: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let full_key = format!("parent.{index}.{key}");
        require_equal(lineage, &full_key, require_key(compatibility, &full_key)?)?;
    }
    Ok(())
}

fn parse_manifest(text: &str, label: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "{label} line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        validate_key(key, label, line_index + 1)?;
        validate_value(value, key)?;
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate {label} key {key}")));
        }
    }
    Ok(fields)
}

fn validate_key(key: &str, label: &str, line_number: usize) -> io::Result<()> {
    if key.is_empty()
        || !key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
    {
        return Err(invalid(&format!(
            "{label} line {line_number} has an invalid key"
        )));
    }
    Ok(())
}

fn validate_value(value: &str, key: &str) -> io::Result<()> {
    if value.is_empty() || value.contains('\n') || value.contains('\r') {
        return Err(invalid(&format!("{key} has an invalid value")));
    }
    Ok(())
}

fn validate_slug(value: &str, key: &str) -> io::Result<()> {
    validate_value(value, key)?;
    if value.len() > 96
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(invalid(&format!("{key} must be an ASCII slug")));
    }
    Ok(())
}

fn require_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("manifest missing required key {key}")))
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "manifest key {key} was {actual}, expected {expected}"
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

/// Returns the stable checksum used to bind line-based model-breeding manifests.
pub(crate) fn text_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x6c696e6561676531u64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 2);
        acc = acc.rotate_left(9).wrapping_mul(0x100000001b3);
    }
    acc
}

fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_model_file;
    use crate::compatibility;
    use crate::tensor_writer::{
        tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_lineage_template_for_compatible_parents() {
        let compatibility = passing_compatibility_text();
        let lineage = build_template_text(
            &compatibility,
            "tiny-q8-candidate",
            "identity-parent-set",
            "browser-local-16m-budget",
        )
        .unwrap();

        validate_text(&compatibility, &lineage).unwrap();
        assert!(lineage.contains("candidate_status=planned"));
        assert!(lineage.contains("candidate_artifact_status=not-written"));
        assert!(lineage.contains("parent.0.tensor_layout_checksum="));
        assert!(lineage.contains("required_next_gate=operator-output-slm-validation-plus-manifest-plus-runtime-smoke-plus-eval"));
    }

    #[test]
    fn rejects_failed_compatibility_report() {
        let left = tiny_fixture_q8_bytes();
        let right = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors(),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm")
                .unwrap();

        let error = build_template_text(
            &compatibility,
            "tiny-q8-candidate",
            "identity-parent-set",
            "fit",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn validation_rejects_compatibility_checksum_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = build_template_text(
            &compatibility,
            "tiny-q8-candidate",
            "identity-parent-set",
            "fit",
        )
        .unwrap();
        let changed = compatibility.replace("left.slm", "other-left.slm");

        let error = validate_text(&changed, &lineage).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("compatibility_report_checksum"));
    }

    #[test]
    fn validation_rejects_parent_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = build_template_text(
            &compatibility,
            "tiny-q8-candidate",
            "identity-parent-set",
            "fit",
        )
        .unwrap()
        .replace("parent.1.quantization=q8_0", "parent.1.quantization=f32");

        let error = validate_text(&compatibility, &lineage).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.1.quantization"));
    }

    #[test]
    fn rejects_non_slug_candidate_id() {
        let compatibility = passing_compatibility_text();

        let error = build_template_text(
            &compatibility,
            "bad candidate",
            "identity-parent-set",
            "fit",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_id"));
    }

    fn passing_compatibility_text() -> String {
        let left = tiny_fixture_q8_bytes();
        let right = tiny_fixture_q8_bytes();
        compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm").unwrap()
    }

    fn tiny_fixture_q8_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
