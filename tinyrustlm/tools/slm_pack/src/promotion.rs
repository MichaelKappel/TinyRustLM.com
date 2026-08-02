//! Candidate promotion sidecars for runtime-smoke and eval handoff.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::candidate;
use crate::lineage;

const PROMOTION_VERSION: &str = "1";
const PROMOTION_STATUS: &str = "pending-runtime-smoke-and-eval";
/// Default promotion scope recorded by promotion templates when the CLI caller omits one.
pub(crate) const DEFAULT_PROMOTION_SCOPE: &str = "browser-local-runtime-smoke-and-eval";
const RUNTIME_SMOKE_STATUS: &str = "pending";
const EVAL_STATUS: &str = "pending";
const PROMOTION_DECISION: &str = "pending";
const BROWSER_SELECTOR_STATUS: &str = "not-admitted";
const PUBLIC_CLAIM_STATUS: &str = "not-admitted";
const REQUIRED_NEXT_GATE: &str = "run-runtime-smoke-and-eval-sidecars-before-browser-selector";
const OPERATOR_RECEIPT_PREFIX: &str = "operator_receipt_";

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

/// Writes a candidate promotion template from validated candidate artifact inputs.
pub(crate) fn write_template_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    output: &Path,
    promoter_id: &str,
    promotion_scope: &str,
    operator_receipt: Option<&Path>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let operator_receipt_text = read_operator_receipt_binding(operator_receipt)?;
    let operator_receipt_binding = operator_receipt_text
        .as_ref()
        .map(|(path, text)| (path.as_str(), text.as_str()));
    let promotion_text = build_template_text_with_operator_receipt_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        promoter_id,
        promotion_scope,
        operator_receipt_binding,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, promotion_text)?;
    println!(
        "SLM candidate promotion template written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a candidate promotion sidecar against compatibility, lineage, candidate, and manifest.
pub(crate) fn validate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    promotion: &Path,
    operator_receipt: Option<&Path>,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion)?;
    let operator_receipt_text = read_operator_receipt_binding(operator_receipt)?;
    let operator_receipt_binding = operator_receipt_text
        .as_ref()
        .map(|(path, text)| (path.as_str(), text.as_str()));
    validate_text_with_operator_receipt_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        &promotion_text,
        operator_receipt_binding,
    )?;
    println!("SLM candidate promotion validation: PASS");
    println!("candidate_manifest: {}", candidate_manifest.display());
    println!("promotion: {}", promotion.display());
    Ok(())
}

#[cfg(test)]
pub(crate) fn build_template_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promoter_id: &str,
    promotion_scope: &str,
) -> io::Result<String> {
    build_template_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promoter_id,
        promotion_scope,
        None,
    )
}

/// Builds promotion text while optionally preserving the candidate manifest's producer receipt binding.
pub(crate) fn build_template_text_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promoter_id: &str,
    promotion_scope: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<String> {
    candidate::validate_manifest_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        operator_receipt,
    )?;
    validate_slug(promoter_id, "promoter_id")?;
    validate_value(promotion_scope, "promotion_scope")?;
    let candidate_fields = parse_manifest(candidate_manifest_text, "candidate artifact manifest")?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_candidate_promotion_version",
        PROMOTION_VERSION,
    );
    push_line(
        &mut text,
        "candidate_id",
        require_key(&candidate_fields, "candidate_id")?,
    );
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    push_line(&mut text, "promoter_id", promoter_id);
    push_line(&mut text, "promotion_scope", promotion_scope);
    push_line(
        &mut text,
        "operator_id",
        require_key(&candidate_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(&candidate_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(&candidate_fields, "resource_budget")?,
    );
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(&candidate_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        require_key(&candidate_fields, "lineage_manifest_checksum")?,
    );
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        &hex64(lineage::text_checksum(candidate_manifest_text.as_bytes())),
    );
    push_operator_receipt_lines(&mut text, &candidate_fields)?;
    push_candidate_lines(&mut text, &candidate_fields)?;
    push_line(
        &mut text,
        "candidate_admission_status",
        require_key(&candidate_fields, "candidate_admission_status")?,
    );
    push_line(
        &mut text,
        "candidate_parent_contract",
        require_key(&candidate_fields, "candidate_parent_contract")?,
    );
    push_line(&mut text, "runtime_smoke_status", RUNTIME_SMOKE_STATUS);
    push_line(&mut text, "eval_status", EVAL_STATUS);
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
pub(crate) fn validate_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
) -> io::Result<()> {
    validate_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        None,
    )
}

/// Validates promotion text while optionally recomputing the producer receipt binding it carries.
pub(crate) fn validate_text_with_operator_receipt_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    operator_receipt: Option<(&str, &str)>,
) -> io::Result<()> {
    candidate::validate_manifest_text_with_operator_receipt_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        operator_receipt,
    )?;
    let candidate_fields = parse_manifest(candidate_manifest_text, "candidate artifact manifest")?;
    let promotion = parse_manifest(promotion_text, "promotion")?;
    require_equal(
        &promotion,
        "tinyrustlm_candidate_promotion_version",
        PROMOTION_VERSION,
    )?;
    require_equal(
        &promotion,
        "candidate_id",
        require_key(&candidate_fields, "candidate_id")?,
    )?;
    require_equal(&promotion, "promotion_status", PROMOTION_STATUS)?;
    validate_slug(require_key(&promotion, "promoter_id")?, "promoter_id")?;
    validate_value(
        require_key(&promotion, "promotion_scope")?,
        "promotion_scope",
    )?;
    require_equal(
        &promotion,
        "operator_id",
        require_key(&candidate_fields, "operator_id")?,
    )?;
    require_equal(
        &promotion,
        "operator_lane",
        require_key(&candidate_fields, "operator_lane")?,
    )?;
    require_equal(
        &promotion,
        "resource_budget",
        require_key(&candidate_fields, "resource_budget")?,
    )?;
    require_equal(
        &promotion,
        "compatibility_report_checksum",
        require_key(&candidate_fields, "compatibility_report_checksum")?,
    )?;
    require_equal(
        &promotion,
        "lineage_manifest_checksum",
        require_key(&candidate_fields, "lineage_manifest_checksum")?,
    )?;
    require_equal(
        &promotion,
        "candidate_manifest_checksum",
        &hex64(lineage::text_checksum(candidate_manifest_text.as_bytes())),
    )?;
    require_operator_receipt_lines(&candidate_fields, &promotion)?;
    require_candidate_lines(&candidate_fields, &promotion)?;
    require_equal(
        &promotion,
        "candidate_admission_status",
        require_key(&candidate_fields, "candidate_admission_status")?,
    )?;
    require_equal(
        &promotion,
        "candidate_parent_contract",
        require_key(&candidate_fields, "candidate_parent_contract")?,
    )?;
    require_equal(&promotion, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&promotion, "eval_status", EVAL_STATUS)?;
    require_equal(&promotion, "promotion_decision", PROMOTION_DECISION)?;
    require_equal(
        &promotion,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    )?;
    require_equal(&promotion, "public_claim_status", PUBLIC_CLAIM_STATUS)?;
    require_equal(&promotion, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

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
    candidate_fields: &HashMap<String, String>,
) -> io::Result<()> {
    if candidate_fields.contains_key("operator_receipt_status") {
        for key in OPERATOR_RECEIPT_KEYS {
            push_line(text, key, require_key(candidate_fields, key)?);
        }
    }
    Ok(())
}

fn require_operator_receipt_lines(
    candidate_fields: &HashMap<String, String>,
    promotion: &HashMap<String, String>,
) -> io::Result<()> {
    if candidate_fields.contains_key("operator_receipt_status") {
        for key in OPERATOR_RECEIPT_KEYS {
            require_equal(promotion, key, require_key(candidate_fields, key)?)?;
        }
        return Ok(());
    }
    reject_unbound_operator_receipt_fields(promotion)
}

fn reject_unbound_operator_receipt_fields(promotion: &HashMap<String, String>) -> io::Result<()> {
    if let Some(key) = promotion
        .keys()
        .find(|key| key.starts_with(OPERATOR_RECEIPT_PREFIX))
    {
        return Err(invalid(&format!(
            "promotion has operator receipt field {key} without a bound candidate receipt"
        )));
    }
    Ok(())
}

fn push_candidate_lines(
    text: &mut String,
    candidate_fields: &HashMap<String, String>,
) -> io::Result<()> {
    for key in CANDIDATE_KEYS {
        push_line(text, key, require_key(candidate_fields, key)?);
    }
    Ok(())
}

fn require_candidate_lines(
    candidate_fields: &HashMap<String, String>,
    promotion: &HashMap<String, String>,
) -> io::Result<()> {
    for key in CANDIDATE_KEYS {
        require_equal(promotion, key, require_key(candidate_fields, key)?)?;
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
    use crate::candidate;
    use crate::compatibility;
    use crate::lineage;
    use crate::slm_validate;
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_and_validates_promotion_template() {
        let fixture = PromotionFixture::new();

        let promotion = build_template_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            "local-smoke-runner",
            DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();

        validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &promotion,
        )
        .unwrap();
        assert!(promotion.contains("promotion_status=pending-runtime-smoke-and-eval"));
        assert!(promotion.contains("runtime_smoke_status=pending"));
        assert!(promotion.contains("browser_selector_status=not-admitted"));
    }

    #[test]
    fn writes_and_validates_operator_receipt_bound_promotion_template() {
        let fixture = PromotionFixture::new();
        let receipt = operator_receipt_text(&fixture.lineage, &fixture.candidate, "candidate.slm");
        let candidate_manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();

        let promotion = build_template_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            "local-smoke-runner",
            DEFAULT_PROMOTION_SCOPE,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();

        validate_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        assert!(promotion.contains("operator_receipt_status=receipt-bound"));
        assert!(promotion.contains(&format!(
            "operator_receipt_checksum={}",
            hex64(lineage::text_checksum(receipt.as_bytes()))
        )));
        assert!(promotion
            .contains("operator_receipt_operator_kind=deterministic-bounded-parameter-mutation"));
    }

    #[test]
    fn path_functions_accept_bound_operator_receipt_input() {
        let fixture = PromotionFixture::new();
        let dir = unique_temp_dir("promotion-operator-receipt");
        fs::create_dir_all(&dir).unwrap();
        let compatibility_path = dir.join("parents.compat");
        let lineage_path = dir.join("candidate.lineage");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let candidate_manifest_path = dir.join("candidate.candidate");
        let promotion_path = dir.join("candidate.promotion");
        let receipt = operator_receipt_text(
            &fixture.lineage,
            &fixture.candidate,
            &candidate_path.display().to_string(),
        );
        fs::write(&compatibility_path, &fixture.compatibility).unwrap();
        fs::write(&lineage_path, &fixture.lineage).unwrap();
        fs::write(&candidate_path, &fixture.candidate).unwrap();
        fs::write(&receipt_path, receipt).unwrap();

        candidate::write_manifest_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            Some(&receipt_path),
        )
        .unwrap();
        write_template_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            &promotion_path,
            "local-smoke-runner",
            DEFAULT_PROMOTION_SCOPE,
            Some(&receipt_path),
        )
        .unwrap();
        validate_path(
            &compatibility_path,
            &lineage_path,
            &candidate_path,
            &candidate_manifest_path,
            &promotion_path,
            Some(&receipt_path),
        )
        .unwrap();
        let promotion = fs::read_to_string(&promotion_path).unwrap();
        assert!(promotion.contains(&format!("operator_receipt_path={}", receipt_path.display())));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn validation_rejects_candidate_manifest_checksum_drift() {
        let fixture = PromotionFixture::new();
        let promotion = fixture.promotion();
        let changed_manifest = format!("{}# checksum-affecting note\n", fixture.candidate_manifest);

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &changed_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_manifest_checksum"));
    }

    #[test]
    fn validation_rejects_candidate_artifact_drift() {
        let fixture = PromotionFixture::new();
        let promotion = fixture.promotion();
        let changed_candidate = tiny_fixture_f32_bytes();

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &changed_candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate artifact contract"));
    }

    #[test]
    fn validation_rejects_bound_promotion_without_operator_receipt_input() {
        let fixture = PromotionFixture::new();
        let receipt = operator_receipt_text(&fixture.lineage, &fixture.candidate, "candidate.slm");
        let candidate_manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let promotion = build_template_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            "local-smoke-runner",
            DEFAULT_PROMOTION_SCOPE,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator receipt binding"));
    }

    #[test]
    fn validation_rejects_operator_receipt_promotion_checksum_drift() {
        let fixture = PromotionFixture::new();
        let receipt = operator_receipt_text(&fixture.lineage, &fixture.candidate, "candidate.slm");
        let expected_checksum = hex64(lineage::text_checksum(receipt.as_bytes()));
        let candidate_manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let promotion = build_template_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            "local-smoke-runner",
            DEFAULT_PROMOTION_SCOPE,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let drifted_promotion = promotion.replace(
            &format!("operator_receipt_checksum={expected_checksum}"),
            "operator_receipt_checksum=0x0000000000000000",
        );

        let error = validate_text_with_operator_receipt_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &candidate_manifest,
            &drifted_promotion,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_checksum"));
    }

    #[test]
    fn validation_rejects_promotion_overclaim() {
        let fixture = PromotionFixture::new();
        let promotion = fixture
            .promotion()
            .replace("promotion_decision=pending", "promotion_decision=accepted");

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("promotion_decision"));
    }

    #[test]
    fn rejects_invalid_promoter_id() {
        let fixture = PromotionFixture::new();

        let error = build_template_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            "bad promoter",
            DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("promoter_id"));
    }

    struct PromotionFixture {
        compatibility: String,
        lineage: String,
        candidate: Vec<u8>,
        candidate_manifest: String,
    }

    impl PromotionFixture {
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
            Self {
                compatibility,
                lineage,
                candidate,
                candidate_manifest,
            }
        }

        fn promotion(&self) -> String {
            build_template_text(
                &self.compatibility,
                &self.lineage,
                &self.candidate,
                "candidate.slm",
                &self.candidate_manifest,
                "local-smoke-runner",
                DEFAULT_PROMOTION_SCOPE,
            )
            .unwrap()
        }
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
            "candidate-manifest-plus-promotion-plus-runtime-smoke-plus-eval",
        );
        text
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-promotion-{label}-{nonce}"))
    }
}
