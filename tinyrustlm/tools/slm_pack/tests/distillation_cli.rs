//! Public CLI coverage for frozen distillation dataset evidence.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn pack_bin() -> &'static str {
    env!("CARGO_BIN_EXE_tinyrustlm-slm-pack")
}

#[test]
fn distillation_dataset_cli_freezes_validates_and_detects_record_drift() {
    let root = unique_dir("distillation-cli");
    let records = root.join("records");
    std::fs::create_dir_all(&records).expect("create records directory");
    std::fs::write(
        records.join("privacy.prompt.txt"),
        "Describe one benefit of processing private notes on the user's own device.",
    )
    .expect("write prompt");
    std::fs::write(
        records.join("privacy.response.txt"),
        "Local processing can keep the note text from being transmitted to a remote service.",
    )
    .expect("write response");
    std::fs::write(
        root.join("distillation-dataset-source.manifest"),
        source_manifest(),
    )
    .expect("write source manifest");
    let exclusion = root.join("eval.txt");
    std::fs::write(
        &exclusion,
        "tinyrustlm_eval_cases_version=1\ncase_count=1\ncase.0.prompt=Explain why verified model hashes matter before loading.\n",
    )
    .expect("write eval exclusion");
    let frozen = root.join("distillation-dataset.manifest");

    let freeze = Command::new(pack_bin())
        .arg("freeze-distillation-dataset")
        .arg(&root)
        .arg(&frozen)
        .arg(&exclusion)
        .output()
        .expect("run freeze-distillation-dataset");
    assert!(freeze.status.success(), "{}", output_text(&freeze));
    assert!(output_text(&freeze).contains("distillation dataset frozen"));

    let validate = validate_command(&root, &frozen, &exclusion);
    assert!(validate.status.success(), "{}", output_text(&validate));
    assert!(output_text(&validate).contains("validation: PASS"));

    std::fs::write(
        records.join("privacy.response.txt"),
        "The response changed after dataset freeze.",
    )
    .expect("drift response");
    let drift = validate_command(&root, &frozen, &exclusion);
    assert!(!drift.status.success());
    assert!(output_text(&drift).contains("does not match recomputed evidence"));

    let _ = std::fs::remove_dir_all(root);
}

fn validate_command(root: &Path, frozen: &Path, exclusion: &Path) -> std::process::Output {
    Command::new(pack_bin())
        .arg("validate-distillation-dataset")
        .arg(root)
        .arg(frozen)
        .arg(exclusion)
        .output()
        .expect("run validate-distillation-dataset")
}

fn source_manifest() -> String {
    let hash = format!("sha256:{}", "a".repeat(64));
    format!(
        "tinyrustlm_distillation_dataset_source_version=1\n\
dataset_id=cli-test-distillation\n\
dataset_split=train\n\
dataset_license_route=reviewed-cli-test-license-ledger\n\
dataset_purpose=cli-test-sequence-distillation\n\
teacher_model_id=teacher/model\n\
teacher_revision=teacher-revision\n\
teacher_weight_sha256={hash}\n\
teacher_tokenizer_sha256={hash}\n\
teacher_generation_profile=teacher-final-answer-v1\n\
student_model_id=student/model\n\
student_revision=student-revision\n\
student_weight_sha256={hash}\n\
student_tokenizer_sha256={hash}\n\
tokenizer_alignment=cross-tokenizer-sequence-only\n\
record_count=1\n\
record.0.id=privacy\n\
record.0.task_family=uaix-memory-grounding\n\
record.0.prompt_file=records/privacy.prompt.txt\n\
record.0.response_file=records/privacy.response.txt\n\
record.0.source_id=cli-test-source\n\
record.0.source_license=cli-test-only\n\
record.0.source_record_id=privacy-one\n\
record.0.target_kind=teacher-final-answer\n\
record.0.teacher_reasoning_included=false\n"
    )
}

fn unique_dir(label: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should follow epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("tinyrustlm-{label}-{}-{nonce}", std::process::id()))
}

fn output_text(output: &std::process::Output) -> String {
    format!(
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}
