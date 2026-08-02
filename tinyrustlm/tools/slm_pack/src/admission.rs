//! Browser-selector admission records for evaluated model-breeding candidates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::candidate;
use crate::lineage;
use crate::promotion;
use crate::provenance;
use crate::slm_validate;

const ADMISSION_VERSION: &str = "2";
const DEFAULT_SELECTOR_ID: &str = "browser-local-selector";
const ADMISSION_STATUS: &str = "admitted-for-browser-selector";
const PROMOTION_STATUS: &str = "runtime-smoke-and-eval-passed";
const RUNTIME_SMOKE_STATUS: &str = "pass";
const EVAL_STATUS: &str = "pass";
const QUALITY_GATE: &str = "assistant-quality";
const PROMOTION_DECISION: &str = "accepted-for-browser-selector";
const BROWSER_SELECTOR_STATUS: &str = "admitted";
const PUBLIC_CLAIM_STATUS: &str = "bound-to-eval-scope";
const REQUIRED_NEXT_GATE: &str = "browser-selector-loads-model-and-activates-admitted-composition";
const OPERATOR_RECEIPT_PREFIX: &str = "operator_receipt_";

const PROMOTION_KEYS: [&str; 8] = [
    "candidate_id",
    "promotion_scope",
    "promoter_id",
    "operator_id",
    "operator_lane",
    "resource_budget",
    "compatibility_report_checksum",
    "lineage_manifest_checksum",
];

const CANDIDATE_KEYS: [&str; 11] = [
    "candidate_artifact_path",
    "candidate_artifact_bytes",
    "candidate_slm_version",
    "candidate_slm_checksum",
    "candidate_model_shape",
    "candidate_tensor_count",
    "candidate_parameter_count",
    "candidate_quantization",
    "candidate_output_contract",
    "candidate_tokenizer_checksum",
    "candidate_tensor_layout_checksum",
];

const OPERATOR_RECEIPT_KEYS: [&str; 7] = [
    "operator_receipt_status",
    "operator_receipt_path",
    "operator_receipt_checksum",
    "operator_receipt_operator_id",
    "operator_receipt_operator_kind",
    "operator_receipt_candidate_slm_checksum",
    "operator_receipt_candidate_artifact_bytes",
];

const COMPOSITION_GRAPH_KEYS: [&str; 11] = [
    "composition_graph_activation_status",
    "composition_graph_file",
    "composition_graph_bytes",
    "composition_graph_sha256",
    "composition_base_model_id",
    "composition_id",
    "composition_active_graph_sha256",
    "composition_route_policy_id",
    "composition_kv_format_id",
    "composition_position_policy_sha256",
    "composition_member_count",
];

/// Default selector id used when the admission CLI caller omits one.
pub(crate) const DEFAULT_ADMISSION_SELECTOR_ID: &str = DEFAULT_SELECTOR_ID;

struct Evidence {
    promotion: HashMap<String, String>,
    eval: HashMap<String, String>,
}

/// Writes a browser-selector admission record after runtime-smoke and eval evidence pass.
pub(crate) fn write_record_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    promotion_manifest: &Path,
    provenance_manifest: &Path,
    runtime_smoke: &Path,
    eval_manifest: &Path,
    output: &Path,
    selector_id: &str,
    operator_receipt: Option<&Path>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion_manifest)?;
    let provenance_text = fs::read_to_string(provenance_manifest)?;
    let runtime_smoke_text = fs::read_to_string(runtime_smoke)?;
    let eval_text = fs::read_to_string(eval_manifest)?;
    let operator_receipt_text = read_operator_receipt_binding(operator_receipt)?;
    let operator_receipt_binding = operator_receipt_text
        .as_ref()
        .map(|(path, text)| (path.as_str(), text.as_str()));
    let admission = build_record_text_with_operator_receipt_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        &promotion_text,
        &provenance_text,
        &runtime_smoke_text,
        &eval_text,
        selector_id,
        operator_receipt_binding,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, admission)?;
    println!(
        "SLM selector admission record written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a browser-selector admission record against all model-breeding evidence.
pub(crate) fn validate_record_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    promotion_manifest: &Path,
    provenance_manifest: &Path,
    runtime_smoke: &Path,
    eval_manifest: &Path,
    admission: &Path,
    operator_receipt: Option<&Path>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion_manifest)?;
    let provenance_text = fs::read_to_string(provenance_manifest)?;
    let runtime_smoke_text = fs::read_to_string(runtime_smoke)?;
    let eval_text = fs::read_to_string(eval_manifest)?;
    let admission_text = fs::read_to_string(admission)?;
    let operator_receipt_text = read_operator_receipt_binding(operator_receipt)?;
    let operator_receipt_binding = operator_receipt_text
        .as_ref()
        .map(|(path, text)| (path.as_str(), text.as_str()));
    validate_record_text_with_operator_receipt_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        &promotion_text,
        &provenance_text,
        &runtime_smoke_text,
        &eval_text,
        &admission_text,
        operator_receipt_binding,
    )?;
    println!("SLM selector admission validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("admission: {}", admission.display());
    Ok(())
}

#[cfg(test)]
pub(crate) fn build_record_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    selector_id: &str,
) -> io::Result<String> {
    build_record_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        selector_id,
        None,
    )
}

/// Builds selector admission text while optionally preserving two-parent producer receipt provenance.
pub(crate) fn build_record_text_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    selector_id: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<String> {
    validate_slug(selector_id, "selector_id")?;
    let evidence = validate_evidence_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        operator_receipt,
    )?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_selector_admission_version",
        ADMISSION_VERSION,
    );
    for key in PROMOTION_KEYS {
        push_line(&mut text, key, require_key(&evidence.promotion, key)?);
    }
    push_line(&mut text, "selector_id", selector_id);
    push_line(&mut text, "admission_status", ADMISSION_STATUS);
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        require_key(&evidence.promotion, "candidate_manifest_checksum")?,
    );
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &hex64(lineage::text_checksum(promotion_text.as_bytes())),
    );
    push_operator_receipt_lines(&mut text, &evidence.promotion)?;
    push_line(
        &mut text,
        "provenance_manifest_checksum",
        &hex64(provenance::text_checksum(provenance_text.as_bytes())),
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &hex64(provenance::text_checksum(runtime_smoke_text.as_bytes())),
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &hex64(provenance::text_checksum(eval_text.as_bytes())),
    );
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &provenance::eval_case_evidence_checksum(&evidence.eval)?,
    );
    for key in COMPOSITION_GRAPH_KEYS {
        push_line(&mut text, key, require_key(&evidence.eval, key)?);
    }
    for key in CANDIDATE_KEYS {
        push_line(&mut text, key, require_key(&evidence.promotion, key)?);
    }
    push_line(&mut text, "runtime_smoke_status", RUNTIME_SMOKE_STATUS);
    push_line(&mut text, "eval_status", EVAL_STATUS);
    push_line(&mut text, "quality_gate", QUALITY_GATE);
    push_line(
        &mut text,
        "quality_scope",
        require_key(&evidence.eval, "quality_scope")?,
    );
    push_line(
        &mut text,
        "quality_boundary",
        require_key(&evidence.eval, "quality_boundary")?,
    );
    push_line(
        &mut text,
        "eval_dataset",
        require_key(&evidence.eval, "eval_dataset")?,
    );
    push_line(
        &mut text,
        "case_count",
        require_key(&evidence.eval, "case_count")?,
    );
    push_line(
        &mut text,
        "cases_passed",
        require_key(&evidence.eval, "cases_passed")?,
    );
    push_line(
        &mut text,
        "cases_failed",
        require_key(&evidence.eval, "cases_failed")?,
    );
    push_line(&mut text, "promotion_decision", PROMOTION_DECISION);
    push_line(
        &mut text,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    );
    push_line(&mut text, "public_claim_status", PUBLIC_CLAIM_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

#[allow(dead_code)]
fn validate_record_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    admission_text: &str,
) -> io::Result<()> {
    validate_record_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        admission_text,
        None,
    )
}

/// Validates selector admission text while recomputing optional producer receipt provenance.
pub(crate) fn validate_record_text_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    admission_text: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<()> {
    let evidence = validate_evidence_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        operator_receipt,
    )?;
    let admission = parse_manifest(admission_text, "admission")?;
    require_equal(
        &admission,
        "tinyrustlm_selector_admission_version",
        ADMISSION_VERSION,
    )?;
    for key in PROMOTION_KEYS {
        require_equal(&admission, key, require_key(&evidence.promotion, key)?)?;
    }
    validate_slug(require_key(&admission, "selector_id")?, "selector_id")?;
    require_equal(&admission, "admission_status", ADMISSION_STATUS)?;
    require_equal(&admission, "promotion_status", PROMOTION_STATUS)?;
    require_equal(
        &admission,
        "candidate_manifest_checksum",
        require_key(&evidence.promotion, "candidate_manifest_checksum")?,
    )?;
    require_equal(
        &admission,
        "promotion_manifest_checksum",
        &hex64(lineage::text_checksum(promotion_text.as_bytes())),
    )?;
    require_operator_receipt_lines(&evidence.promotion, &admission)?;
    require_equal(
        &admission,
        "provenance_manifest_checksum",
        &hex64(provenance::text_checksum(provenance_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "runtime_smoke_manifest_checksum",
        &hex64(provenance::text_checksum(runtime_smoke_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "eval_manifest_checksum",
        &hex64(provenance::text_checksum(eval_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "eval_case_evidence_checksum",
        &provenance::eval_case_evidence_checksum(&evidence.eval)?,
    )?;
    for key in COMPOSITION_GRAPH_KEYS {
        require_equal(&admission, key, require_key(&evidence.eval, key)?)?;
    }
    for key in CANDIDATE_KEYS {
        require_equal(&admission, key, require_key(&evidence.promotion, key)?)?;
    }
    require_equal(&admission, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&admission, "eval_status", EVAL_STATUS)?;
    require_equal(&admission, "quality_gate", QUALITY_GATE)?;
    require_equal(
        &admission,
        "quality_scope",
        require_key(&evidence.eval, "quality_scope")?,
    )?;
    require_equal(
        &admission,
        "quality_boundary",
        require_key(&evidence.eval, "quality_boundary")?,
    )?;
    require_equal(
        &admission,
        "eval_dataset",
        require_key(&evidence.eval, "eval_dataset")?,
    )?;
    require_equal(
        &admission,
        "case_count",
        require_key(&evidence.eval, "case_count")?,
    )?;
    require_equal(
        &admission,
        "cases_passed",
        require_key(&evidence.eval, "cases_passed")?,
    )?;
    require_equal(
        &admission,
        "cases_failed",
        require_key(&evidence.eval, "cases_failed")?,
    )?;
    require_equal(&admission, "promotion_decision", PROMOTION_DECISION)?;
    require_equal(
        &admission,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    )?;
    require_equal(&admission, "public_claim_status", PUBLIC_CLAIM_STATUS)?;
    require_equal(&admission, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

/// Validates the self-contained selector-facing fields in an admission record.
pub(crate) fn validate_record_summary_text(
    admission_text: &str,
) -> io::Result<HashMap<String, String>> {
    let admission = parse_manifest(admission_text, "admission")?;
    require_equal(
        &admission,
        "tinyrustlm_selector_admission_version",
        ADMISSION_VERSION,
    )?;
    for key in PROMOTION_KEYS {
        require_key(&admission, key)?;
    }
    validate_slug(require_key(&admission, "selector_id")?, "selector_id")?;
    require_equal(&admission, "admission_status", ADMISSION_STATUS)?;
    require_equal(&admission, "promotion_status", PROMOTION_STATUS)?;
    for key in [
        "candidate_manifest_checksum",
        "promotion_manifest_checksum",
        "provenance_manifest_checksum",
        "runtime_smoke_manifest_checksum",
        "eval_manifest_checksum",
        "eval_case_evidence_checksum",
    ] {
        require_hex64(&admission, key)?;
    }
    provenance::validate_composition_graph_evidence(&admission)?;
    for key in CANDIDATE_KEYS {
        require_key(&admission, key)?;
    }
    validate_operator_receipt_summary(&admission)?;
    require_positive_usize(&admission, "candidate_artifact_bytes")?;
    require_positive_usize(&admission, "candidate_slm_version")?;
    require_hex64(&admission, "candidate_slm_checksum")?;
    require_positive_usize(&admission, "candidate_tensor_count")?;
    require_positive_usize(&admission, "candidate_parameter_count")?;
    require_hex64(&admission, "candidate_tokenizer_checksum")?;
    require_hex64(&admission, "candidate_tensor_layout_checksum")?;
    require_equal(&admission, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&admission, "eval_status", EVAL_STATUS)?;
    require_equal(&admission, "quality_gate", QUALITY_GATE)?;
    for key in ["quality_scope", "quality_boundary", "eval_dataset"] {
        require_key(&admission, key)?;
    }
    let case_count = require_positive_usize(&admission, "case_count")?;
    let cases_passed = require_usize(&admission, "cases_passed")?;
    let cases_failed = require_usize(&admission, "cases_failed")?;
    if cases_passed != case_count || cases_failed != 0 {
        return Err(invalid(
            "admission case totals must show every declared case passed and zero failed cases",
        ));
    }
    require_equal(&admission, "promotion_decision", PROMOTION_DECISION)?;
    require_equal(
        &admission,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    )?;
    require_equal(&admission, "public_claim_status", PUBLIC_CLAIM_STATUS)?;
    require_equal(&admission, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(admission)
}

// Recomputes every upstream admission prerequisite, including optional operator receipt binding.
fn validate_evidence_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<Evidence> {
    candidate::validate_manifest_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        operator_receipt,
    )?;
    promotion::validate_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        operator_receipt,
    )?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    let runtime_smoke =
        provenance::validate_runtime_smoke_text(&report, provenance_text, runtime_smoke_text)?;
    provenance::validate_quality_gate(&report, provenance_text, QUALITY_GATE, Some(eval_text))?;
    let promotion = parse_manifest(promotion_text, "promotion")?;
    let eval = provenance::parse_manifest(eval_text)?;
    require_equal(&runtime_smoke, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&eval, "eval_status", EVAL_STATUS)?;
    require_equal(&eval, "task_eval_status", EVAL_STATUS)?;
    require_equal(&eval, "cases_failed", "0")?;
    Ok(Evidence { promotion, eval })
}

// Reads an optional operator receipt once while preserving its display path for validation.
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

fn push_operator_receipt_lines(
    text: &mut String,
    promotion: &HashMap<String, String>,
) -> io::Result<()> {
    if promotion.contains_key("operator_receipt_status") {
        for key in OPERATOR_RECEIPT_KEYS {
            push_line(text, key, require_key(promotion, key)?);
        }
    }
    Ok(())
}

fn require_operator_receipt_lines(
    promotion: &HashMap<String, String>,
    admission: &HashMap<String, String>,
) -> io::Result<()> {
    if promotion.contains_key("operator_receipt_status") {
        for key in OPERATOR_RECEIPT_KEYS {
            require_equal(admission, key, require_key(promotion, key)?)?;
        }
        return Ok(());
    }
    reject_unbound_operator_receipt_fields(admission)
}

fn validate_operator_receipt_summary(admission: &HashMap<String, String>) -> io::Result<()> {
    if admission.contains_key("operator_receipt_status") {
        require_equal(admission, "operator_receipt_status", "receipt-bound")?;
        require_key(admission, "operator_receipt_path")?;
        require_hex64(admission, "operator_receipt_checksum")?;
        require_key(admission, "operator_receipt_operator_id")?;
        require_key(admission, "operator_receipt_operator_kind")?;
        require_hex64(admission, "operator_receipt_candidate_slm_checksum")?;
        require_positive_usize(admission, "operator_receipt_candidate_artifact_bytes")?;
        return Ok(());
    }
    reject_unbound_operator_receipt_fields(admission)
}

fn reject_unbound_operator_receipt_fields(fields: &HashMap<String, String>) -> io::Result<()> {
    if let Some(key) = fields
        .keys()
        .find(|key| key.starts_with(OPERATOR_RECEIPT_PREFIX))
    {
        return Err(invalid(&format!(
            "admission has operator receipt field {key} without a bound promotion receipt"
        )));
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

fn require_hex64(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    let Some(hex) = value.strip_prefix("0x") else {
        return Err(invalid(&format!(
            "manifest key {key} must be a hex checksum"
        )));
    };
    if hex.len() != 16 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!(
            "manifest key {key} must be a hex checksum"
        )));
    }
    Ok(())
}

fn require_positive_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    let value = require_usize(fields, key)?;
    if value == 0 {
        return Err(invalid(&format!(
            "manifest key {key} must be greater than zero"
        )));
    }
    Ok(value)
}

fn require_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    let value = require_key(fields, key)?;
    value
        .parse::<usize>()
        .map_err(|_| invalid(&format!("manifest key {key} must be a usize")))
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
    use crate::tensor_writer::{tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_and_validates_selector_admission_record() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission();

        validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap();
        assert!(admission.contains("tinyrustlm_selector_admission_version=2"));
        assert!(admission.contains("admission_status=admitted-for-browser-selector"));
        assert!(admission.contains("eval_case_evidence_checksum=0x"));
        assert!(admission.contains("composition_graph_sha256=sha256:"));
        assert!(admission.contains("composition_id=composition-sha256-"));
        assert!(admission.contains("composition_route_policy_id=route-sha256-"));
        assert!(admission.contains("composition_kv_format_id=kv-format-sha256-"));
        assert!(admission.contains("browser_selector_status=admitted"));
        assert!(admission.contains("public_claim_status=bound-to-eval-scope"));
    }

    #[test]
    fn summary_rejects_graph_identity_drift() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission().replace(
            "composition_id=composition-sha256-",
            "composition_id=route-sha256-",
        );

        let error = validate_record_summary_text(&admission).unwrap_err();

        assert!(error.to_string().contains("composition_id"));
    }

    #[test]
    fn writes_and_validates_operator_receipt_bound_admission_record() {
        let fixture = AdmissionFixture::new();
        let receipt = operator_receipt_text(&fixture.lineage, &fixture.candidate, "candidate.slm");
        let (candidate_manifest, promotion) = receipt_bound_candidate_and_promotion(
            &fixture,
            "candidate.slm",
            "candidate.operator",
            &receipt,
        );

        let admission = build_record_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            DEFAULT_SELECTOR_ID,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();

        validate_record_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &admission,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        validate_record_summary_text(&admission).unwrap();
        assert!(admission.contains("operator_receipt_status=receipt-bound"));
        assert!(admission.contains(&format!(
            "operator_receipt_checksum={}",
            hex64(lineage::text_checksum(receipt.as_bytes()))
        )));
        assert!(admission
            .contains("operator_receipt_operator_kind=deterministic-bounded-parameter-mutation"));
    }

    #[test]
    fn path_functions_accept_bound_operator_receipt_input() {
        let dir = unique_temp_dir("admission-operator-receipt");
        fs::create_dir_all(&dir).unwrap();
        let candidate = tiny_fixture_q8_bytes();
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let candidate_manifest_path = dir.join("candidate.candidate");
        let promotion_path = dir.join("candidate.promotion");
        let provenance_path = dir.join("candidate.manifest");
        let runtime_path = dir.join("candidate.runtime");
        let eval_path = dir.join("candidate.eval");
        let admission_path = dir.join("candidate.admission");

        let compatibility = compatibility::compatibility_text_for_bytes(
            &candidate,
            "left.slm",
            &candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "tiny-q8-candidate", "operator-a", "fit")
                .unwrap();
        let receipt =
            operator_receipt_text(&lineage, &candidate, &candidate_path.display().to_string());
        fs::write(&compatibility_path, compatibility).unwrap();
        fs::write(&lineage_path, lineage).unwrap();
        fs::write(&candidate_path, &candidate).unwrap();
        fs::write(&receipt_path, receipt).unwrap();
        candidate::write_manifest_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            Some(&receipt_path),
        )
        .unwrap();
        promotion::write_template_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            &promotion_path,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
            Some(&receipt_path),
        )
        .unwrap();

        let report =
            slm_validate::validate_bytes(&candidate, &candidate_path.display().to_string())
                .unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest);
        fs::write(&provenance_path, provenance_manifest).unwrap();
        fs::write(&runtime_path, runtime_smoke).unwrap();
        fs::write(&eval_path, eval).unwrap();

        write_record_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            &promotion_path,
            &provenance_path,
            &runtime_path,
            &eval_path,
            &admission_path,
            DEFAULT_SELECTOR_ID,
            Some(&receipt_path),
        )
        .unwrap();
        validate_record_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            &promotion_path,
            &provenance_path,
            &runtime_path,
            &eval_path,
            &admission_path,
            Some(&receipt_path),
        )
        .unwrap();
        let admission = fs::read_to_string(&admission_path).unwrap();
        assert!(admission.contains(&format!("operator_receipt_path={}", receipt_path.display())));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_runtime_smoke_drift() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission();
        let changed_smoke = fixture.runtime_smoke.replace(
            "runtime_smoke_decision=accepted-for-runtime-smoke",
            "runtime_smoke_decision=pending",
        );

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &changed_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("runtime_smoke_decision"));
    }

    #[test]
    fn validation_rejects_bound_admission_without_operator_receipt_input() {
        let fixture = AdmissionFixture::new();
        let receipt = operator_receipt_text(&fixture.lineage, &fixture.candidate, "candidate.slm");
        let (candidate_manifest, promotion) = receipt_bound_candidate_and_promotion(
            &fixture,
            "candidate.slm",
            "candidate.operator",
            &receipt,
        );
        let admission = build_record_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            DEFAULT_SELECTOR_ID,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator receipt binding"));
    }

    #[test]
    fn validation_rejects_operator_receipt_admission_checksum_drift() {
        let fixture = AdmissionFixture::new();
        let receipt = operator_receipt_text(&fixture.lineage, &fixture.candidate, "candidate.slm");
        let expected_checksum = hex64(lineage::text_checksum(receipt.as_bytes()));
        let (candidate_manifest, promotion) = receipt_bound_candidate_and_promotion(
            &fixture,
            "candidate.slm",
            "candidate.operator",
            &receipt,
        );
        let admission = build_record_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            DEFAULT_SELECTOR_ID,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let drifted_admission = admission.replace(
            &format!("operator_receipt_checksum={expected_checksum}"),
            "operator_receipt_checksum=0x0000000000000000",
        );

        let error = validate_record_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &drifted_admission,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_checksum"));
    }

    #[test]
    fn rejects_eval_manifest_drift() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission();
        let changed_eval = fixture
            .eval
            .replace("case.0.error=ok\n", "case.0.error=runtime\n");

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &changed_eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("case.0.error"));
    }

    #[test]
    fn rejects_admission_overclaim() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission().replace(
            "public_claim_status=bound-to-eval-scope",
            "public_claim_status=unbounded",
        );

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("public_claim_status"));
    }

    #[test]
    fn rejects_invalid_selector_id() {
        let fixture = AdmissionFixture::new();

        let error = build_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            "bad selector",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_id"));
    }

    #[test]
    fn summary_rejects_incomplete_case_totals() {
        let fixture = AdmissionFixture::new();
        let admission = fixture
            .admission()
            .replace("cases_passed=2", "cases_passed=1");

        let error = validate_record_summary_text(&admission).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("case totals"));
    }

    struct AdmissionFixture {
        compatibility: String,
        lineage: String,
        candidate: Vec<u8>,
        candidate_manifest: String,
        promotion: String,
        provenance_manifest: String,
        runtime_smoke: String,
        eval: String,
    }

    impl AdmissionFixture {
        fn new() -> Self {
            let candidate = tiny_fixture_q8_bytes();
            let compatibility = compatibility::compatibility_text_for_bytes(
                &candidate,
                "left.slm",
                &candidate,
                "right.slm",
            )
            .unwrap();
            let lineage = lineage::build_template_text(
                &compatibility,
                "tiny-q8-candidate",
                "operator-a",
                "fit",
            )
            .unwrap();
            let candidate_manifest = candidate::build_manifest_text(
                &compatibility,
                &lineage,
                &candidate,
                "candidate.slm",
            )
            .unwrap();
            let promotion = promotion::build_template_text(
                &compatibility,
                &lineage,
                &candidate,
                "candidate.slm",
                &candidate_manifest,
                "local-smoke-runner",
                promotion::DEFAULT_PROMOTION_SCOPE,
            )
            .unwrap();
            let report = slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
            let provenance_manifest =
                provenance::build_manifest_text(&report, "converted-trained").unwrap();
            let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
            let runtime_smoke = provenance::build_runtime_smoke_text(
                &report,
                &provenance_manifest,
                &manifest_fields,
            )
            .unwrap();
            let eval = passing_eval_text(&report, &provenance_manifest);
            Self {
                compatibility,
                lineage,
                candidate,
                candidate_manifest,
                promotion,
                provenance_manifest,
                runtime_smoke,
                eval,
            }
        }

        fn admission(&self) -> String {
            build_record_text(
                &self.compatibility,
                &self.lineage,
                &self.candidate,
                "candidate.slm",
                &self.candidate_manifest,
                &self.promotion,
                &self.provenance_manifest,
                &self.runtime_smoke,
                &self.eval,
                DEFAULT_SELECTOR_ID,
            )
            .unwrap()
        }
    }

    fn passing_eval_text(report: &slm_validate::ValidationReport, manifest: &str) -> String {
        provenance::build_reviewed_honest_quality_eval_text(report, manifest, "converted-trained")
    }

    fn receipt_bound_candidate_and_promotion(
        fixture: &AdmissionFixture,
        candidate_path: &str,
        receipt_path: &str,
        receipt: &str,
    ) -> (String, String) {
        let candidate_manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            candidate_path,
            Some((receipt_path, receipt)),
        )
        .unwrap();
        let promotion = promotion::build_template_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
            Some((receipt_path, receipt)),
        )
        .unwrap();
        (candidate_manifest, promotion)
    }

    fn operator_receipt_text(lineage_text: &str, candidate: &[u8], candidate_path: &str) -> String {
        let lineage_fields = parse_manifest(lineage_text, "lineage").unwrap();
        let report = slm_validate::validate_bytes(candidate, candidate_path).unwrap();
        let mut text = String::new();
        push_line(&mut text, "tinyrustlm_operator_receipt_version", "1");
        push_line(
            &mut text,
            "operator_kind",
            "deterministic-bounded-parameter-mutation",
        );
        push_line(&mut text, "operator_status", "operator-output-written");
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
            "candidate-manifest-plus-promotion-plus-admission",
        );
        text
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-admission-{label}-{nonce}"))
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
