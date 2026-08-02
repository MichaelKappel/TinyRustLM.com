//! Parent `.slm` compatibility reports for future offline assembly operators.

use std::fs;
use std::io;
use std::path::Path;

use crate::slm_validate::{self, ValidationReport};

const COMPATIBILITY_VERSION: &str = "1";
const COMPATIBILITY_SCOPE: &str = "direct-parameter-family";

/// Validates two `.slm` files and either writes or prints a parent compatibility report.
pub(crate) fn report_path(left: &Path, right: &Path, output: Option<&Path>) -> io::Result<()> {
    let left_bytes = fs::read(left)?;
    let right_bytes = fs::read(right)?;
    let text = compatibility_text_for_bytes(
        &left_bytes,
        &left.display().to_string(),
        &right_bytes,
        &right.display().to_string(),
    )?;
    if let Some(output_path) = output {
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output_path, text)?;
        println!(
            "SLM parent compatibility report written: {}",
            output_path.display()
        );
    } else {
        print!("{text}");
    }
    Ok(())
}

pub(crate) fn compatibility_text_for_bytes(
    left_bytes: &[u8],
    left_path: &str,
    right_bytes: &[u8],
    right_path: &str,
) -> io::Result<String> {
    let left = slm_validate::validate_bytes(left_bytes, left_path)?;
    let right = slm_validate::validate_bytes(right_bytes, right_path)?;
    Ok(build_compatibility_text(&left, &right))
}

fn build_compatibility_text(left: &ValidationReport, right: &ValidationReport) -> String {
    let reasons = incompatibility_reasons(left, right);
    let compatible = reasons.is_empty();
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_parent_compatibility_version",
        COMPATIBILITY_VERSION,
    );
    push_line(&mut text, "compatibility_scope", COMPATIBILITY_SCOPE);
    push_line(
        &mut text,
        "compatibility_result",
        if compatible { "pass" } else { "fail" },
    );
    push_line(
        &mut text,
        "compatible_parent_set",
        if compatible { "true" } else { "false" },
    );
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, 0, left);
    push_parent_lines(&mut text, 1, right);
    push_line(&mut text, "compatibility_reasons", &reason_text(&reasons));
    push_line(
        &mut text,
        "operator_lane",
        "offline-model-breeding-parent-set",
    );
    push_line(
        &mut text,
        "decision",
        if compatible {
            "accepted-parent-set-for-offline-operators"
        } else {
            "use-distillation-or-source-conversion-route"
        },
    );
    push_line(
        &mut text,
        "candidate_gate",
        "slm-validate-plus-manifest-plus-runtime-smoke-plus-eval",
    );
    text
}

fn push_parent_lines(text: &mut String, index: usize, report: &ValidationReport) {
    let prefix = format!("parent.{index}");
    push_line(text, &format!("{prefix}.path"), report.path());
    push_line(
        text,
        &format!("{prefix}.model_bytes"),
        &report.file_bytes().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.slm_version"),
        &report.slm_version().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.slm_checksum"),
        &hex64(report.checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.model_shape"),
        &report.shape_summary(),
    );
    push_line(
        text,
        &format!("{prefix}.tensor_count"),
        &report.tensor_count().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.parameter_count"),
        &report.parameter_count().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.quantization"),
        report.quantization_label(),
    );
    push_line(
        text,
        &format!("{prefix}.output_contract"),
        report.output_contract_label(),
    );
    push_line(
        text,
        &format!("{prefix}.flags"),
        &format!("0x{:08x}", report.flags()),
    );
    push_line(
        text,
        &format!("{prefix}.tokenizer_checksum"),
        &hex64(report.tokenizer_checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.tensor_layout_checksum"),
        &hex64(report.tensor_layout_checksum()),
    );
}

fn incompatibility_reasons(left: &ValidationReport, right: &ValidationReport) -> Vec<&'static str> {
    let mut reasons = Vec::new();
    if left.slm_version() != right.slm_version() {
        reasons.push("slm-version-mismatch");
    }
    if left.shape_summary() != right.shape_summary() {
        reasons.push("model-shape-mismatch");
    }
    if left.tokenizer_checksum() != right.tokenizer_checksum() {
        reasons.push("tokenizer-mismatch");
    }
    if left.output_contract_label() != right.output_contract_label() {
        reasons.push("output-contract-mismatch");
    }
    if left.quantization_label() != right.quantization_label() {
        reasons.push("quantization-mismatch");
    }
    if left.tensor_count() != right.tensor_count() {
        reasons.push("tensor-count-mismatch");
    }
    if left.parameter_count() != right.parameter_count() {
        reasons.push("parameter-count-mismatch");
    }
    if left.tensor_layout_checksum() != right.tensor_layout_checksum() {
        reasons.push("tensor-layout-mismatch");
    }
    reasons
}

fn reason_text(reasons: &[&'static str]) -> String {
    if reasons.is_empty() {
        "all-compatible".to_string()
    } else {
        reasons.join(";")
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tensor_writer::{
        tensors_for_shape, tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, ModelShape,
        DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::{ByteTokenizerSection, TokenizerSection};
    use crate::{build_model_file, build_model_file_with_flags};

    const FLAG_TIED_OUTPUT: u32 = 1;

    #[test]
    fn accepts_matching_parent_layouts() {
        let left = tiny_fixture_bytes();
        let right = tiny_fixture_bytes();

        let text =
            compatibility_text_for_bytes(&left, "parent-a.slm", &right, "parent-b.slm").unwrap();

        assert!(text.contains("compatibility_result=pass"));
        assert!(text.contains("compatible_parent_set=true"));
        assert!(text.contains("compatibility_reasons=all-compatible"));
        assert!(text.contains("decision=accepted-parent-set-for-offline-operators"));
    }

    #[test]
    fn rejects_quantization_layout_mismatch_for_direct_parameter_lane() {
        let left = tiny_fixture_bytes();
        let right = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();

        let text =
            compatibility_text_for_bytes(&left, "parent-a.slm", &right, "parent-q8.slm").unwrap();

        assert!(text.contains("compatibility_result=fail"));
        assert!(text.contains("compatible_parent_set=false"));
        assert!(text.contains("quantization-mismatch"));
        assert!(text.contains("tensor-layout-mismatch"));
        assert!(text.contains("decision=use-distillation-or-source-conversion-route"));
    }

    #[test]
    fn rejects_tokenizer_and_shape_mismatch() {
        let left = tiny_fixture_bytes();
        let bpe_shape = ModelShape {
            vocab_size: 262,
            ..ModelShape::tiny_fixture()
        };
        let right = build_model_file(
            &bpe_shape,
            &tensors_for_shape(&bpe_shape, DTYPE_F32),
            &TokenizerSection::tiny_bpe_demo(),
        )
        .unwrap();

        let text =
            compatibility_text_for_bytes(&left, "parent-a.slm", &right, "parent-bpe.slm").unwrap();

        assert!(text.contains("compatibility_result=fail"));
        assert!(text.contains("model-shape-mismatch"));
        assert!(text.contains("tokenizer-mismatch"));
    }

    #[test]
    fn rejects_output_contract_mismatch() {
        let left = tiny_fixture_bytes();
        let right = build_model_file_with_flags(
            &ModelShape::tiny_fixture(),
            &crate::tensor_writer::tiny_fixture_tied_tensors(),
            &ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        )
        .unwrap();

        let text =
            compatibility_text_for_bytes(&left, "parent-a.slm", &right, "parent-tied.slm").unwrap();

        assert!(text.contains("compatibility_result=fail"));
        assert!(text.contains("output-contract-mismatch"));
        assert!(text.contains("tensor-count-mismatch"));
        assert!(text.contains("tensor-layout-mismatch"));
    }

    fn tiny_fixture_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors(),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
