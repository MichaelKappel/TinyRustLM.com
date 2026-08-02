//! Promotion ledgers for admitted model-breeding candidates.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::Path;

use crate::admission;
use crate::provenance;

const LEDGER_VERSION: &str = "1";
const LEDGER_SCOPE: &str = "model-breeding-promotion-history";
const LEDGER_STATUS: &str = "admitted-records-only";
const ENTRY_STATUS: &str = "promoted-and-admitted";
const ZERO_CHECKSUM: &str = "0x0000000000000000";
const REQUIRED_NEXT_GATE: &str = "selector-registry-or-offline-population-review";

const ENTRY_KEYS: [&str; 32] = [
    "candidate_id",
    "selector_id",
    "admission_status",
    "promotion_status",
    "operator_id",
    "operator_lane",
    "resource_budget",
    "candidate_artifact_path",
    "candidate_artifact_bytes",
    "candidate_slm_checksum",
    "candidate_model_shape",
    "candidate_quantization",
    "candidate_output_contract",
    "candidate_tokenizer_checksum",
    "candidate_tensor_layout_checksum",
    "candidate_manifest_checksum",
    "promotion_manifest_checksum",
    "provenance_manifest_checksum",
    "runtime_smoke_manifest_checksum",
    "eval_manifest_checksum",
    "eval_case_evidence_checksum",
    "runtime_smoke_status",
    "eval_status",
    "quality_gate",
    "quality_scope",
    "quality_boundary",
    "eval_dataset",
    "case_count",
    "cases_passed",
    "promotion_decision",
    "browser_selector_status",
    "public_claim_status",
];

/// Writes a promotion ledger from one or more selector admission records.
pub(crate) fn write_ledger_path(output: &Path, admission_paths: &[String]) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths, "promotion-ledger")?;
    let ledger = build_ledger_text(&admission_texts)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, ledger)?;
    println!("SLM promotion ledger written: {}", output.display());
    Ok(())
}

/// Validates a promotion ledger against its selector admission records.
pub(crate) fn validate_ledger_path(ledger: &Path, admission_paths: &[String]) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths, "validate-promotion-ledger")?;
    let ledger_text = fs::read_to_string(ledger)?;
    validate_ledger_text(&ledger_text, &admission_texts)?;
    println!("SLM promotion ledger validation: PASS");
    println!("ledger: {}", ledger.display());
    println!("admissions: {}", admission_paths.len());
    Ok(())
}

fn read_admissions(admission_paths: &[String], command: &str) -> io::Result<Vec<String>> {
    if admission_paths.is_empty() {
        return Err(invalid(&format!(
            "{command} requires at least one admission record"
        )));
    }
    admission_paths
        .iter()
        .map(|path| fs::read_to_string(Path::new(path)))
        .collect()
}

pub(crate) fn build_ledger_text(admission_texts: &[String]) -> io::Result<String> {
    if admission_texts.is_empty() {
        return Err(invalid(
            "promotion ledger requires at least one admission record",
        ));
    }
    let mut candidate_ids = HashSet::new();
    let mut slm_checksums = HashSet::new();
    let mut admission_checksums = Vec::with_capacity(admission_texts.len());
    let mut entries = String::new();
    let mut previous_checksum = ZERO_CHECKSUM.to_string();

    for (index, admission_text) in admission_texts.iter().enumerate() {
        let fields = admission::validate_record_summary_text(admission_text)?;
        let candidate_id = require_key(&fields, "candidate_id")?.to_string();
        if !candidate_ids.insert(candidate_id.clone()) {
            return Err(invalid(&format!(
                "duplicate promotion ledger candidate_id {candidate_id}"
            )));
        }
        let slm_checksum = require_key(&fields, "candidate_slm_checksum")?.to_string();
        if !slm_checksums.insert(slm_checksum.clone()) {
            return Err(invalid(&format!(
                "duplicate promotion ledger candidate checksum {slm_checksum}"
            )));
        }
        let admission_checksum = hex64(provenance::text_checksum(admission_text.as_bytes()));
        admission_checksums.push(admission_checksum.clone());

        let mut payload = String::new();
        push_entry_lines(
            &mut payload,
            "",
            index,
            &fields,
            &admission_checksum,
            &previous_checksum,
            None,
        )?;
        let entry_checksum = hex64(provenance::text_checksum(payload.as_bytes()));
        let prefix = format!("entry.{index}");
        push_entry_lines(
            &mut entries,
            &prefix,
            index,
            &fields,
            &admission_checksum,
            &previous_checksum,
            Some(&entry_checksum),
        )?;
        previous_checksum = entry_checksum;
    }

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_promotion_ledger_version",
        LEDGER_VERSION,
    );
    push_line(&mut text, "ledger_scope", LEDGER_SCOPE);
    push_line(&mut text, "ledger_status", LEDGER_STATUS);
    push_line(&mut text, "entry_count", &admission_texts.len().to_string());
    push_line(
        &mut text,
        "admission_set_checksum",
        &admission_set_checksum(&admission_checksums),
    );
    push_line(&mut text, "ledger_chain_checksum", &previous_checksum);
    text.push_str(&entries);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

pub(crate) fn validate_ledger_text(
    ledger_text: &str,
    admission_texts: &[String],
) -> io::Result<()> {
    let expected_text = build_ledger_text(admission_texts)?;
    let expected = parse_manifest(&expected_text, "expected promotion ledger")?;
    let actual = parse_manifest(ledger_text, "promotion ledger")?;
    require_equal(
        &actual,
        "tinyrustlm_promotion_ledger_version",
        LEDGER_VERSION,
    )?;
    require_equal(&actual, "ledger_scope", LEDGER_SCOPE)?;
    require_equal(&actual, "ledger_status", LEDGER_STATUS)?;
    require_equal(&actual, "required_next_gate", REQUIRED_NEXT_GATE)?;
    for (key, expected_value) in &expected {
        require_equal(&actual, key, expected_value)?;
    }
    for key in actual.keys() {
        if !expected.contains_key(key) {
            return Err(invalid(&format!("unexpected promotion ledger key {key}")));
        }
    }
    Ok(())
}

fn push_entry_lines(
    text: &mut String,
    prefix: &str,
    sequence: usize,
    fields: &HashMap<String, String>,
    admission_checksum: &str,
    previous_checksum: &str,
    entry_checksum: Option<&str>,
) -> io::Result<()> {
    push_prefixed_line(text, prefix, "sequence", &sequence.to_string());
    for key in ENTRY_KEYS {
        push_prefixed_line(text, prefix, key, require_key(fields, key)?);
    }
    push_prefixed_line(text, prefix, "admission_checksum", admission_checksum);
    push_prefixed_line(text, prefix, "previous_entry_checksum", previous_checksum);
    push_prefixed_line(text, prefix, "ledger_entry_status", ENTRY_STATUS);
    if let Some(entry_checksum) = entry_checksum {
        push_prefixed_line(text, prefix, "entry_checksum", entry_checksum);
    }
    Ok(())
}

fn push_prefixed_line(text: &mut String, prefix: &str, key: &str, value: &str) {
    if prefix.is_empty() {
        push_line(text, key, value);
    } else {
        push_line(text, &format!("{prefix}.{key}"), value);
    }
}

fn admission_set_checksum(admission_checksums: &[String]) -> String {
    let mut source = String::new();
    for admission_checksum in admission_checksums {
        push_line(&mut source, "admission_checksum", admission_checksum);
    }
    hex64(provenance::text_checksum(source.as_bytes()))
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
        if value.is_empty() || value.contains('\r') || value.contains('\n') {
            return Err(invalid(&format!("{label} key {key} has an invalid value")));
        }
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
            "promotion ledger key {key} was {actual}, expected {expected}"
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
    use crate::promotion;
    use crate::slm_validate;
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_promotion_ledger_from_admissions() {
        let first = fixture_admission(
            "tiny-q8-candidate",
            "target/promotion-ledger/tiny-q8.slm",
            DTYPE_Q8_0,
        );
        let second = fixture_admission(
            "tiny-f32-candidate",
            "target/promotion-ledger/tiny-f32.slm",
            DTYPE_F32,
        );

        let ledger = build_ledger_text(&[first.clone(), second.clone()]).unwrap();

        validate_ledger_text(&ledger, &[first, second]).unwrap();
        assert!(ledger.contains("ledger_status=admitted-records-only"));
        assert!(ledger.contains("entry_count=2"));
        assert!(ledger.contains("entry.0.ledger_entry_status=promoted-and-admitted"));
        assert!(ledger.contains("entry.1.previous_entry_checksum=0x"));
    }

    #[test]
    fn rejects_empty_ledger_input() {
        let error = build_ledger_text(&[]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("at least one admission"));
    }

    #[test]
    fn rejects_duplicate_candidate_id() {
        let left = fixture_admission("candidate-a", "target/ledger/a.slm", DTYPE_Q8_0);
        let right = fixture_admission("candidate-a", "target/ledger/b.slm", DTYPE_F32);

        let error = build_ledger_text(&[left, right]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("duplicate promotion ledger candidate_id"));
    }

    #[test]
    fn rejects_duplicate_candidate_checksum() {
        let left = fixture_admission("candidate-a", "target/ledger/a.slm", DTYPE_Q8_0);
        let right = fixture_admission("candidate-b", "target/ledger/b.slm", DTYPE_Q8_0);

        let error = build_ledger_text(&[left, right]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("duplicate promotion ledger candidate checksum"));
    }

    #[test]
    fn rejects_ledger_entry_drift() {
        let admission = fixture_admission("candidate-a", "target/ledger/a.slm", DTYPE_Q8_0);
        let ledger = build_ledger_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.ledger_entry_status=promoted-and-admitted",
                "entry.0.ledger_entry_status=pending",
            );

        let error = validate_ledger_text(&ledger, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("ledger_entry_status"));
    }

    #[test]
    fn rejects_unexpected_ledger_key() {
        let admission = fixture_admission("candidate-a", "target/ledger/a.slm", DTYPE_Q8_0);
        let mut ledger = build_ledger_text(std::slice::from_ref(&admission)).unwrap();
        ledger.push_str("entry.0.extra=yes\n");

        let error = validate_ledger_text(&ledger, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("unexpected promotion ledger key"));
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str, dtype: u32) -> String {
        let candidate = tiny_fixture_bytes(dtype);
        let compatibility = compatibility::compatibility_text_for_bytes(
            &candidate,
            "left.slm",
            &candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, candidate_id, "operator-a", "fit")
                .unwrap();
        let candidate_manifest =
            candidate::build_manifest_text(&compatibility, &lineage, &candidate, candidate_path)
                .unwrap();
        let promotion = promotion::build_template_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(&candidate, candidate_path).unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest);
        admission::build_record_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            &promotion,
            &provenance_manifest,
            &runtime_smoke,
            &eval,
            admission::DEFAULT_ADMISSION_SELECTOR_ID,
        )
        .unwrap()
    }

    fn passing_eval_text(report: &slm_validate::ValidationReport, manifest: &str) -> String {
        provenance::build_reviewed_honest_quality_eval_text(report, manifest, "converted-trained")
    }

    fn tiny_fixture_bytes(dtype: u32) -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(dtype),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
