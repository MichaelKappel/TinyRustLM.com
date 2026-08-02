//! Candidate artifact manifests for offline model-breeding output gates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::lineage;
use crate::slm_validate::{self, ValidationReport};

const CANDIDATE_ARTIFACT_VERSION: &str = "1";
const ARTIFACT_KIND_SLM: &str = "slm";
const CANDIDATE_STATUS_ARTIFACT_WRITTEN: &str = "artifact-written";
const CANDIDATE_ARTIFACT_STATUS: &str = "written";
const CANDIDATE_ADMISSION_STATUS: &str = "slm-validated";
const CANDIDATE_PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const CANDIDATE_EVAL_STATUS: &str = "pending";
const REQUIRED_NEXT_GATE: &str = "candidate-runtime-smoke-plus-eval-plus-provenance-promotion";
const OPERATOR_RECEIPT_STATUS_BOUND: &str = "receipt-bound";
const OPERATOR_RECEIPT_PREFIX: &str = "operator_receipt_";

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

// Keeps caller-supplied receipt text paired with the path recorded in the manifest.
#[derive(Clone, Copy)]
struct OperatorReceiptBinding<'a> {
    path: &'a str,
    text: &'a str,
}

// Holds receipt fields after they have been checked against lineage and candidate bytes.
struct ValidatedOperatorReceipt {
    checksum: String,
    operator_id: String,
    operator_kind: String,
    candidate_slm_checksum: String,
    candidate_artifact_bytes: String,
}

/// Writes a candidate artifact manifest bound to compatibility, lineage, a validated `.slm`, and optionally its producer receipt.
pub(crate) fn write_manifest_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    output: &Path,
    operator_receipt: Option<&Path>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let operator_receipt_text = read_operator_receipt_binding(operator_receipt)?;
    let operator_receipt_binding =
        operator_receipt_text
            .as_ref()
            .map(|(path, text)| OperatorReceiptBinding {
                path: path.as_str(),
                text: text.as_str(),
            });
    let manifest = build_manifest_text_with_operator_receipt(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        operator_receipt_binding,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, manifest)?;
    println!(
        "SLM candidate artifact manifest written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a candidate artifact manifest against compatibility, lineage, a `.slm`, and optionally its producer receipt.
pub(crate) fn validate_manifest_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    manifest: &Path,
    operator_receipt: Option<&Path>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let manifest_text = fs::read_to_string(manifest)?;
    let operator_receipt_text = read_operator_receipt_binding(operator_receipt)?;
    let operator_receipt_binding =
        operator_receipt_text
            .as_ref()
            .map(|(path, text)| OperatorReceiptBinding {
                path: path.as_str(),
                text: text.as_str(),
            });
    validate_manifest_text_with_operator_receipt(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &manifest_text,
        operator_receipt_binding,
    )?;
    println!("SLM candidate artifact validation: PASS");
    println!("lineage: {}", lineage_manifest.display());
    println!("candidate: {}", candidate_slm.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

/// Builds a candidate artifact manifest bound to compatibility, lineage, and `.slm` bytes.
#[cfg(test)]
pub(crate) fn build_manifest_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
) -> io::Result<String> {
    build_manifest_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        None,
    )
}

/// Builds candidate artifact manifest text while optionally binding a producer receipt path and text.
#[cfg(test)]
pub(crate) fn build_manifest_text_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<String> {
    let operator_receipt =
        operator_receipt.map(|(path, text)| OperatorReceiptBinding { path, text });
    build_manifest_text_with_operator_receipt(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        operator_receipt,
    )
}

// Builds the same candidate manifest while optionally checksum-binding the producer receipt.
fn build_manifest_text_with_operator_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    operator_receipt: Option<OperatorReceiptBinding<'_>>,
) -> io::Result<String> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    validate_candidate_contract(&lineage_fields, &report)?;
    let validated_operator_receipt = operator_receipt
        .as_ref()
        .map(|binding| validate_operator_receipt(binding, &lineage_fields, &report))
        .transpose()?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_candidate_artifact_version",
        CANDIDATE_ARTIFACT_VERSION,
    );
    push_line(
        &mut text,
        "candidate_id",
        require_key(&lineage_fields, "candidate_id")?,
    );
    push_line(
        &mut text,
        "candidate_status",
        CANDIDATE_STATUS_ARTIFACT_WRITTEN,
    );
    push_line(&mut text, "artifact_kind", ARTIFACT_KIND_SLM);
    push_line(
        &mut text,
        "operator_id",
        require_key(&lineage_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(&lineage_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(&lineage_fields, "resource_budget")?,
    );
    if let (Some(binding), Some(receipt)) = (operator_receipt, validated_operator_receipt.as_ref())
    {
        push_operator_receipt_lines(&mut text, binding, receipt);
    }
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(&lineage_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    );
    push_line(
        &mut text,
        "compatibility_scope",
        require_key(&lineage_fields, "compatibility_scope")?,
    );
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, &lineage_fields, 0)?;
    push_parent_lines(&mut text, &lineage_fields, 1)?;
    push_candidate_lines(&mut text, &report);
    push_line(
        &mut text,
        "candidate_artifact_status",
        CANDIDATE_ARTIFACT_STATUS,
    );
    push_line(
        &mut text,
        "candidate_admission_status",
        CANDIDATE_ADMISSION_STATUS,
    );
    push_line(
        &mut text,
        "candidate_parent_contract",
        CANDIDATE_PARENT_CONTRACT,
    );
    push_line(&mut text, "candidate_eval_status", CANDIDATE_EVAL_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

/// Validates candidate artifact manifest text against compatibility, lineage, and `.slm` bytes.
#[allow(dead_code)]
pub(crate) fn validate_manifest_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    manifest_text: &str,
) -> io::Result<()> {
    validate_manifest_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        manifest_text,
        None,
    )
}

/// Validates candidate artifact manifest text while optionally recomputing its producer receipt binding.
pub(crate) fn validate_manifest_text_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    manifest_text: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<()> {
    let operator_receipt =
        operator_receipt.map(|(path, text)| OperatorReceiptBinding { path, text });
    validate_manifest_text_with_operator_receipt(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        manifest_text,
        operator_receipt,
    )
}

// Validates candidate manifests and recomputes optional producer-receipt bindings.
fn validate_manifest_text_with_operator_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    manifest_text: &str,
    operator_receipt: Option<OperatorReceiptBinding<'_>>,
) -> io::Result<()> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let manifest = parse_manifest(manifest_text, "candidate artifact manifest")?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    validate_candidate_contract(&lineage_fields, &report)?;
    let validated_operator_receipt = operator_receipt
        .as_ref()
        .map(|binding| validate_operator_receipt(binding, &lineage_fields, &report))
        .transpose()?;

    require_equal(
        &manifest,
        "tinyrustlm_candidate_artifact_version",
        CANDIDATE_ARTIFACT_VERSION,
    )?;
    require_equal(
        &manifest,
        "candidate_id",
        require_key(&lineage_fields, "candidate_id")?,
    )?;
    require_equal(
        &manifest,
        "candidate_status",
        CANDIDATE_STATUS_ARTIFACT_WRITTEN,
    )?;
    require_equal(&manifest, "artifact_kind", ARTIFACT_KIND_SLM)?;
    require_equal(
        &manifest,
        "operator_id",
        require_key(&lineage_fields, "operator_id")?,
    )?;
    require_equal(
        &manifest,
        "operator_lane",
        require_key(&lineage_fields, "operator_lane")?,
    )?;
    require_equal(
        &manifest,
        "resource_budget",
        require_key(&lineage_fields, "resource_budget")?,
    )?;
    if let (Some(binding), Some(receipt)) = (operator_receipt, validated_operator_receipt.as_ref())
    {
        require_operator_receipt_lines(&manifest, binding, receipt)?;
    } else {
        reject_unbound_operator_receipt_fields(&manifest)?;
    }
    require_equal(
        &manifest,
        "compatibility_report_checksum",
        require_key(&lineage_fields, "compatibility_report_checksum")?,
    )?;
    require_equal(
        &manifest,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    )?;
    require_equal(
        &manifest,
        "compatibility_scope",
        require_key(&lineage_fields, "compatibility_scope")?,
    )?;
    require_equal(&manifest, "parent_count", "2")?;
    require_parent_lines(&lineage_fields, &manifest, 0)?;
    require_parent_lines(&lineage_fields, &manifest, 1)?;
    require_candidate_lines(&manifest, &report)?;
    require_equal(
        &manifest,
        "candidate_artifact_status",
        CANDIDATE_ARTIFACT_STATUS,
    )?;
    require_equal(
        &manifest,
        "candidate_admission_status",
        CANDIDATE_ADMISSION_STATUS,
    )?;
    require_equal(
        &manifest,
        "candidate_parent_contract",
        CANDIDATE_PARENT_CONTRACT,
    )?;
    require_equal(&manifest, "candidate_eval_status", CANDIDATE_EVAL_STATUS)?;
    require_equal(&manifest, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

// Reads an optional operator receipt once while preserving the display path for manifest output.
fn read_operator_receipt_binding(
    operator_receipt: Option<&Path>,
) -> io::Result<Option<(String, String)>> {
    operator_receipt
        .map(|path| {
            let text = fs::read_to_string(path)?;
            Ok((path.display().to_string(), text))
        })
        .transpose()
}

// Checks the receipt identity fields before its checksum is allowed into the candidate manifest.
fn validate_operator_receipt(
    binding: &OperatorReceiptBinding<'_>,
    lineage_fields: &HashMap<String, String>,
    report: &ValidationReport,
) -> io::Result<ValidatedOperatorReceipt> {
    let receipt_fields = parse_manifest(binding.text, "operator receipt")?;
    require_equal(
        &receipt_fields,
        "candidate_id",
        require_key(lineage_fields, "candidate_id")?,
    )?;
    require_equal(
        &receipt_fields,
        "operator_id",
        require_key(lineage_fields, "operator_id")?,
    )?;
    require_equal(
        &receipt_fields,
        "candidate_artifact_bytes",
        &report.file_bytes().to_string(),
    )?;
    require_equal(
        &receipt_fields,
        "candidate_slm_checksum",
        &hex64(report.checksum()),
    )?;
    Ok(ValidatedOperatorReceipt {
        checksum: hex64(lineage::text_checksum(binding.text.as_bytes())),
        operator_id: require_key(&receipt_fields, "operator_id")?.to_string(),
        operator_kind: require_key(&receipt_fields, "operator_kind")?.to_string(),
        candidate_slm_checksum: require_key(&receipt_fields, "candidate_slm_checksum")?.to_string(),
        candidate_artifact_bytes: require_key(&receipt_fields, "candidate_artifact_bytes")?
            .to_string(),
    })
}

// Records the producer receipt binding as manifest fields that can be recomputed later.
fn push_operator_receipt_lines(
    text: &mut String,
    binding: OperatorReceiptBinding<'_>,
    receipt: &ValidatedOperatorReceipt,
) {
    push_line(
        text,
        "operator_receipt_status",
        OPERATOR_RECEIPT_STATUS_BOUND,
    );
    push_line(text, "operator_receipt_path", binding.path);
    push_line(text, "operator_receipt_checksum", &receipt.checksum);
    push_line(text, "operator_receipt_operator_id", &receipt.operator_id);
    push_line(
        text,
        "operator_receipt_operator_kind",
        &receipt.operator_kind,
    );
    push_line(
        text,
        "operator_receipt_candidate_slm_checksum",
        &receipt.candidate_slm_checksum,
    );
    push_line(
        text,
        "operator_receipt_candidate_artifact_bytes",
        &receipt.candidate_artifact_bytes,
    );
}

// Recomputes every stored producer receipt field during candidate manifest validation.
fn require_operator_receipt_lines(
    manifest: &HashMap<String, String>,
    binding: OperatorReceiptBinding<'_>,
    receipt: &ValidatedOperatorReceipt,
) -> io::Result<()> {
    require_equal(
        manifest,
        "operator_receipt_status",
        OPERATOR_RECEIPT_STATUS_BOUND,
    )?;
    require_equal(manifest, "operator_receipt_path", binding.path)?;
    require_equal(manifest, "operator_receipt_checksum", &receipt.checksum)?;
    require_equal(
        manifest,
        "operator_receipt_operator_id",
        &receipt.operator_id,
    )?;
    require_equal(
        manifest,
        "operator_receipt_operator_kind",
        &receipt.operator_kind,
    )?;
    require_equal(
        manifest,
        "operator_receipt_candidate_slm_checksum",
        &receipt.candidate_slm_checksum,
    )?;
    require_equal(
        manifest,
        "operator_receipt_candidate_artifact_bytes",
        &receipt.candidate_artifact_bytes,
    )?;
    Ok(())
}

// Keeps bound manifests from validating unless the caller supplies the referenced receipt.
fn reject_unbound_operator_receipt_fields(manifest: &HashMap<String, String>) -> io::Result<()> {
    if let Some(key) = manifest
        .keys()
        .find(|key| key.starts_with(OPERATOR_RECEIPT_PREFIX))
    {
        return Err(invalid(&format!(
            "operator receipt binding requires an input receipt for {key}"
        )));
    }
    Ok(())
}

fn validate_candidate_contract(
    lineage_fields: &HashMap<String, String>,
    report: &ValidationReport,
) -> io::Result<()> {
    require_report_equal(
        lineage_fields,
        "parent.0.model_shape",
        &report.shape_summary(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.tensor_count",
        &report.tensor_count().to_string(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.parameter_count",
        &report.parameter_count().to_string(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.quantization",
        report.quantization_label(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.output_contract",
        report.output_contract_label(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    )?;
    Ok(())
}

fn push_parent_lines(
    text: &mut String,
    lineage_fields: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let full_key = format!("parent.{index}.{key}");
        push_line(text, &full_key, require_key(lineage_fields, &full_key)?);
    }
    Ok(())
}

fn require_parent_lines(
    lineage_fields: &HashMap<String, String>,
    manifest: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let full_key = format!("parent.{index}.{key}");
        require_equal(manifest, &full_key, require_key(lineage_fields, &full_key)?)?;
    }
    Ok(())
}

fn push_candidate_lines(text: &mut String, report: &ValidationReport) {
    push_line(text, "candidate_artifact_path", report.path());
    push_line(
        text,
        "candidate_artifact_bytes",
        &report.file_bytes().to_string(),
    );
    push_line(
        text,
        "candidate_slm_version",
        &report.slm_version().to_string(),
    );
    push_line(text, "candidate_slm_checksum", &hex64(report.checksum()));
    push_line(text, "candidate_model_shape", &report.shape_summary());
    push_line(
        text,
        "candidate_tensor_count",
        &report.tensor_count().to_string(),
    );
    push_line(
        text,
        "candidate_parameter_count",
        &report.parameter_count().to_string(),
    );
    push_line(text, "candidate_quantization", report.quantization_label());
    push_line(
        text,
        "candidate_output_contract",
        report.output_contract_label(),
    );
    push_line(
        text,
        "candidate_tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    );
    push_line(
        text,
        "candidate_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    );
}

fn require_candidate_lines(
    manifest: &HashMap<String, String>,
    report: &ValidationReport,
) -> io::Result<()> {
    require_equal(manifest, "candidate_artifact_path", report.path())?;
    require_equal(
        manifest,
        "candidate_artifact_bytes",
        &report.file_bytes().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_slm_version",
        &report.slm_version().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_slm_checksum",
        &hex64(report.checksum()),
    )?;
    require_equal(manifest, "candidate_model_shape", &report.shape_summary())?;
    require_equal(
        manifest,
        "candidate_tensor_count",
        &report.tensor_count().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_parameter_count",
        &report.parameter_count().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_quantization",
        report.quantization_label(),
    )?;
    require_equal(
        manifest,
        "candidate_output_contract",
        report.output_contract_label(),
    )?;
    require_equal(
        manifest,
        "candidate_tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    )?;
    require_equal(
        manifest,
        "candidate_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    )?;
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

fn require_report_equal(
    fields: &HashMap<String, String>,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "candidate artifact contract expected {key} {actual}, candidate had {expected}"
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
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_and_validates_candidate_artifact_manifest() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();

        let manifest =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap();

        validate_manifest_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap();
        assert!(manifest.contains("candidate_status=artifact-written"));
        assert!(manifest.contains("candidate_admission_status=slm-validated"));
        assert!(
            manifest.contains("candidate_parent_contract=matches-parent-direct-parameter-contract")
        );
        assert!(manifest.contains(
            "required_next_gate=candidate-runtime-smoke-plus-eval-plus-provenance-promotion"
        ));
    }

    #[test]
    fn writes_and_validates_operator_receipt_binding() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let receipt = operator_receipt_text(&lineage, &candidate, "candidate.slm");

        let manifest = build_manifest_text_with_operator_receipt(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            Some(OperatorReceiptBinding {
                path: "candidate.operator",
                text: &receipt,
            }),
        )
        .unwrap();

        validate_manifest_text_with_operator_receipt(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
            Some(OperatorReceiptBinding {
                path: "candidate.operator",
                text: &receipt,
            }),
        )
        .unwrap();
        assert!(manifest.contains("operator_receipt_status=receipt-bound"));
        assert!(manifest.contains("operator_receipt_path=candidate.operator"));
        assert!(manifest.contains(&format!(
            "operator_receipt_checksum={}",
            hex64(lineage::text_checksum(receipt.as_bytes()))
        )));
        assert!(manifest
            .contains("operator_receipt_operator_kind=deterministic-bounded-parameter-mutation"));
    }

    #[test]
    fn path_functions_accept_unbound_and_bound_operator_receipt_inputs() {
        let dir = unique_temp_dir("operator-receipt-path");
        fs::create_dir_all(&dir).unwrap();
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let unbound_manifest_path = dir.join("unbound.candidate");
        let bound_manifest_path = dir.join("bound.candidate");
        let receipt =
            operator_receipt_text(&lineage, &candidate, &candidate_path.display().to_string());
        fs::write(&compatibility_path, compatibility).unwrap();
        fs::write(&lineage_path, lineage).unwrap();
        fs::write(&candidate_path, candidate).unwrap();
        fs::write(&receipt_path, receipt).unwrap();

        write_manifest_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &unbound_manifest_path,
            None,
        )
        .unwrap();
        validate_manifest_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &unbound_manifest_path,
            None,
        )
        .unwrap();
        write_manifest_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &bound_manifest_path,
            Some(&receipt_path),
        )
        .unwrap();
        validate_manifest_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &bound_manifest_path,
            Some(&receipt_path),
        )
        .unwrap();
        let bound_manifest = fs::read_to_string(&bound_manifest_path).unwrap();
        assert!(
            bound_manifest.contains(&format!("operator_receipt_path={}", receipt_path.display()))
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_candidate_artifact_that_breaks_parent_contract() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_f32_bytes();

        let error =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate artifact contract"));
    }

    #[test]
    fn validation_rejects_lineage_checksum_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let manifest =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap();
        let changed_lineage = format!("{lineage}# checksum-affecting note\n");

        let error = validate_manifest_text(
            &compatibility,
            &changed_lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("lineage_manifest_checksum"));
    }

    #[test]
    fn validation_rejects_candidate_artifact_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let manifest =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap();
        let changed_candidate = tiny_fixture_f32_bytes();

        let error = validate_manifest_text(
            &compatibility,
            &lineage,
            &changed_candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate artifact contract"));
    }

    #[test]
    fn validation_rejects_manifest_field_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let manifest = build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm")
            .unwrap()
            .replace(
                "candidate_eval_status=pending",
                "candidate_eval_status=pass",
            );

        let error = validate_manifest_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_eval_status"));
    }

    #[test]
    fn validation_rejects_operator_receipt_checksum_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let receipt = operator_receipt_text(&lineage, &candidate, "candidate.slm");
        let manifest = build_manifest_text_with_operator_receipt(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            Some(OperatorReceiptBinding {
                path: "candidate.operator",
                text: &receipt,
            }),
        )
        .unwrap();
        let drifted_receipt = format!("{receipt}# checksum drift\n");

        let error = validate_manifest_text_with_operator_receipt(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
            Some(OperatorReceiptBinding {
                path: "candidate.operator",
                text: &drifted_receipt,
            }),
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_checksum"));
    }

    #[test]
    fn validation_rejects_bound_manifest_without_operator_receipt_input() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let receipt = operator_receipt_text(&lineage, &candidate, "candidate.slm");
        let manifest = build_manifest_text_with_operator_receipt(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            Some(OperatorReceiptBinding {
                path: "candidate.operator",
                text: &receipt,
            }),
        )
        .unwrap();

        let error = validate_manifest_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator receipt binding"));
    }

    #[test]
    fn build_rejects_operator_receipt_candidate_checksum_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let receipt = operator_receipt_text(&lineage, &candidate, "candidate.slm");
        let report = slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        let bad_receipt = receipt.replace(
            &format!("candidate_slm_checksum={}", hex64(report.checksum())),
            "candidate_slm_checksum=0x0000000000000000",
        );

        let error = build_manifest_text_with_operator_receipt(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            Some(OperatorReceiptBinding {
                path: "candidate.operator",
                text: &bad_receipt,
            }),
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_slm_checksum"));
    }

    fn passing_compatibility_text() -> String {
        let left = tiny_fixture_q8_bytes();
        let right = tiny_fixture_q8_bytes();
        compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm").unwrap()
    }

    fn lineage_text(compatibility: &str) -> String {
        lineage::build_template_text(compatibility, "tiny-q8-candidate", "operator-a", "fit")
            .unwrap()
    }

    fn operator_receipt_text(lineage_text: &str, candidate: &[u8], candidate_path: &str) -> String {
        let lineage_fields = parse_manifest(lineage_text, "lineage").unwrap();
        let report = slm_validate::validate_bytes(candidate, candidate_path).unwrap();
        let mut text = String::new();
        push_line(
            &mut text,
            "operator_kind",
            "deterministic-bounded-parameter-mutation",
        );
        push_line(
            &mut text,
            "candidate_id",
            require_key(&lineage_fields, "candidate_id").unwrap(),
        );
        push_line(
            &mut text,
            "operator_id",
            require_key(&lineage_fields, "operator_id").unwrap(),
        );
        push_line(&mut text, "candidate_artifact_path", report.path());
        push_line(
            &mut text,
            "candidate_artifact_bytes",
            &report.file_bytes().to_string(),
        );
        push_line(
            &mut text,
            "candidate_slm_checksum",
            &hex64(report.checksum()),
        );
        push_line(
            &mut text,
            "required_next_gate",
            "candidate-manifest-plus-runtime-smoke-plus-eval",
        );
        text
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-candidate-{label}-{nonce}"))
    }

    fn tiny_fixture_q8_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }

    fn tiny_fixture_f32_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_F32),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
