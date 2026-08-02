//! CLI coverage for the native TinyRustLM eval runner.

use std::path::{Path, PathBuf};
use std::process::Command;
use tinyrustlm_runtime::active_composition::ActiveCompositionBundle;
use tinyrustlm_runtime::content_identity::{ContentId, ExecutionBindings};
use tinyrustlm_runtime::model::Model;

fn eval_bin() -> PathBuf {
    if let Ok(path) = std::env::var("CARGO_BIN_EXE_tinyrustlm-eval") {
        return PathBuf::from(path);
    }
    if let Some(path) = option_env!("CARGO_BIN_EXE_tinyrustlm-eval") {
        return PathBuf::from(path);
    }

    let test_exe = std::env::current_exe().expect("resolve eval_cli test executable");
    let deps_dir = test_exe.parent().expect("test executable has deps parent");
    let target_dir = deps_dir.parent().expect("deps directory has target parent");
    target_dir.join(if cfg!(windows) {
        "tinyrustlm-eval.exe"
    } else {
        "tinyrustlm-eval"
    })
}

#[test]
fn tinyrustlm_eval_cli_writes_passed_eval_sidecar() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let manifest = write_eval_manifest(&model, "tiny-test-model-q8.manifest");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8.eval");
    let _ = std::fs::remove_file(&output_eval);
    let composition_graph = write_base_composition_graph(&model, "tiny-test-model-q8-base.acg1");

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            composition_graph.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run tinyrustlm-eval");

    assert!(output.status.success(), "{}", output_text(&output));
    let text = output_text(&output);
    assert!(text.contains("TinyRustLM eval cases: PASS"));
    assert!(text.contains("cases_passed: 2"));
    assert!(text.contains("cases_failed: 0"));

    let sidecar = std::fs::read_to_string(&output_eval).expect("read eval sidecar");
    assert!(sidecar.contains("tinyrustlm_eval_manifest_version=1"));
    assert!(sidecar.contains("gate=assistant-quality"));
    assert!(sidecar.contains("eval_status=pass"));
    assert!(sidecar.contains("task_eval_status=pass"));
    assert!(sidecar.contains("case_count=2"));
    assert!(sidecar.contains("cases_passed=2"));
    assert!(sidecar.contains("cases_failed=0"));
    assert!(sidecar.contains("quality_gate_policy=fixture-exact-v1"));
    assert!(sidecar.contains("prompt_format=raw-completion-v1"));
    assert!(sidecar.contains("case.0.runtime_prompt=hi"));
    assert!(sidecar.contains("case.0.required_json_keys=none"));
    assert!(sidecar.contains("case.0.quality_failures=none"));
    assert!(sidecar.contains("no_cheat_status=pass"));
    std::fs::remove_file(composition_graph).expect("remove base composition graph");
    std::fs::remove_file(manifest).expect("remove eval manifest");
    std::fs::remove_file(output_eval).expect("remove eval sidecar");
}

#[test]
fn tinyrustlm_eval_cli_rejects_fixture_output_for_honest_quality() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let manifest = write_eval_manifest(&model, "tiny-test-model-q8-honest.manifest");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-honest-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8-honest.eval");
    let _ = std::fs::remove_file(&output_eval);
    let composition_graph =
        write_base_composition_graph(&model, "tiny-test-model-q8-honest-base.acg1");

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            composition_graph.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run tinyrustlm-eval");

    assert!(!output.status.success(), "{}", output_text(&output));
    let text = output_text(&output);
    assert!(text.contains("TinyRustLM eval cases: FAIL"));
    assert!(text.contains("cases_failed: 12"));

    let sidecar = std::fs::read_to_string(&output_eval).expect("read eval sidecar");
    assert!(sidecar.contains("quality_gate_policy=honest-assistant-quality-v1"));
    assert!(sidecar.contains("eval_status=fail"));
    assert!(sidecar.contains("task_eval_status=fail"));
    assert!(sidecar.contains("fixed_case_count=6"));
    assert!(sidecar.contains("holdout_case_count=6"));
    assert!(sidecar.contains("holdout_seed=2026070801"));
    assert!(sidecar.contains("case_count=12"));
    assert!(sidecar.contains("case.0.origin=fixed"));
    assert!(sidecar.contains("case.6.origin=holdout"));
    assert!(sidecar.contains("no_cheat_status=fail"));
    assert!(sidecar.contains("case.0.prompt=what's up?"));
    assert!(sidecar.contains("case.0.runtime_prompt=what's up?"));
    assert!(sidecar.contains("case.0.required_result=quality"));
    assert!(sidecar.contains("case.0.expected=not-applicable"));
    assert!(sidecar.contains("case.4.output_format=json_object"));
    assert!(sidecar.contains("case.4.required_json_keys=status,reason"));
    assert!(sidecar.contains("runtime_error:"));
    assert!(sidecar.contains("empty_output"));
    assert!(sidecar.contains("too_short_for_assistant_quality"));
    assert!(sidecar.contains("malformed_json_object:expected_object_start"));
    assert!(sidecar.contains("generated_max_repeated_token_run"));
    assert!(sidecar.contains("generation_stop_reason"));
    assert!(sidecar.contains("sampling_repetition_penalty"));
    std::fs::remove_file(composition_graph).expect("remove base composition graph");
    std::fs::remove_file(manifest).expect("remove eval manifest");
    std::fs::remove_file(output_eval).expect("remove honest eval sidecar");
}

#[test]
fn tinyrustlm_eval_cli_records_strict_multi_turn_one_call_evidence() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let manifest = write_eval_manifest(&model, "tiny-test-model-q8-strict.manifest");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-strict-multi-turn-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8-strict-multi-turn.eval");
    let _ = std::fs::remove_file(&output_eval);
    let composition_graph =
        write_base_composition_graph(&model, "tiny-test-model-q8-strict-base.acg1");

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            composition_graph.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run strict multi-turn tinyrustlm-eval");

    assert!(!output.status.success(), "{}", output_text(&output));
    let sidecar = std::fs::read_to_string(&output_eval).expect("read strict eval sidecar");
    assert!(sidecar.contains("quality_gate_policy=one-call-conversation-quality-v1"));
    assert!(sidecar.contains("generation_contract=one-call-unmodified-v1"));
    assert!(sidecar.contains("generation_retries_allowed=false"));
    assert!(sidecar.contains("response_repairs_allowed=false"));
    assert!(sidecar.contains("field_assembly_allowed=false"));
    assert!(sidecar.contains("no_cheat_status=pass"));
    assert!(sidecar.contains("no_cheat_failure_count=0"));
    assert!(!sidecar.contains("quality_failure_case_count=0"));
    assert!(sidecar.contains("case.0.history_turn_count=2"));
    assert!(sidecar.contains("case.0.history.1.user=I just told you my name is Riley."));
    assert!(sidecar.contains("case.0.required_answer_terms=riley"));
    assert!(sidecar.contains("case.0.output_transform=none"));
    assert!(sidecar.contains("[Conversation history]"));
    assert!(!sidecar.contains("text_quality_retry_prompt"));
    assert!(!sidecar.contains("field_generation"));
    assert!(!sidecar.contains("assistant response is already prefixed"));
    std::fs::remove_file(composition_graph).expect("remove base composition graph");
    std::fs::remove_file(manifest).expect("remove eval manifest");
    std::fs::remove_file(output_eval).expect("remove strict eval sidecar");
}

#[test]
fn tinyrustlm_eval_cli_materializes_seeded_holdouts_for_freeze() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-honest-eval-cases.txt");
    let output_path = temp_output("assistant-quality-honest.materialized.txt");
    let _ = std::fs::remove_file(&output_path);

    let output = Command::new(eval_bin())
        .args([
            "materialize-exclusions".as_ref(),
            cases.as_os_str(),
            output_path.as_os_str(),
        ])
        .output()
        .expect("materialize eval exclusions");

    assert!(output.status.success(), "{}", output_text(&output));
    let stdout = output_text(&output);
    assert!(stdout.contains("TinyRustLM eval exclusions: PASS"));
    assert!(stdout.contains("case_count: 12"));
    assert!(stdout.contains("fixed_case_count: 6"));
    assert!(stdout.contains("generated_holdout_count: 6"));
    let materialized = std::fs::read_to_string(&output_path).expect("read materialized exclusions");
    assert!(materialized.contains("holdout_count=0"));
    assert!(materialized.contains("case_count=12"));
    assert!(materialized.contains("case.0.origin=fixed"));
    assert!(materialized.contains("case.6.origin=materialized-holdout"));
    assert!(materialized.contains("case.0.prompt=what's up?"));
    assert!(!materialized.contains("case.0.actual="));

    let repeated = Command::new(eval_bin())
        .args([
            "materialize-exclusions".as_ref(),
            cases.as_os_str(),
            output_path.as_os_str(),
        ])
        .output()
        .expect("reject existing materialized exclusion");
    assert!(!repeated.status.success());
    assert!(output_text(&repeated).contains("already exists"));
    std::fs::remove_file(output_path).expect("remove materialized exclusion fixture");
}

#[test]
fn tinyrustlm_eval_cli_activates_composition_graph_before_generation() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let manifest = write_eval_manifest(&model, "tiny-test-model-q8-composed.manifest");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8-composed.eval");
    let _ = std::fs::remove_file(&output_eval);
    let composition_graph =
        write_base_composition_graph(&model, "tiny-test-model-q8-composed-base.acg1");

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            composition_graph.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run composed tinyrustlm-eval");

    assert!(output.status.success(), "{}", output_text(&output));
    let sidecar = std::fs::read_to_string(&output_eval).expect("read composed eval sidecar");
    assert!(sidecar.contains("composition_graph_activation_status=activated-before-eval"));
    assert!(sidecar.contains("composition_graph_file=tinyrustlm-eval-cli-"));
    assert!(sidecar.contains("composition_graph_bytes=512"));
    assert!(sidecar.contains("composition_graph_sha256=sha256:"));
    assert!(sidecar.contains("composition_base_model_id=model-sha256-"));
    assert!(sidecar.contains("composition_id=composition-sha256-"));
    assert!(sidecar.contains("composition_active_graph_sha256=sha256:"));
    assert!(sidecar.contains("composition_route_policy_id=route-sha256-"));
    assert!(sidecar.contains("composition_kv_format_id=kv-format-sha256-"));
    assert!(sidecar.contains("composition_position_policy_sha256=sha256:"));
    assert!(sidecar.contains("composition_member_count=0"));
    assert!(sidecar.contains("\"composition_active\": true"));
    assert!(sidecar.contains("\"active_composition_member_count\": 0"));
    assert!(sidecar.contains("\"composition_activation_count\": 1"));
    assert!(!sidecar.contains("\"active_composition_id\": \"none\""));
    assert!(!sidecar.contains("adapter_apply"));
    assert!(output_text(&output).contains("eval progress: case 2/2 PASS"));
    assert!(!PathBuf::from(format!("{}.progress", output_eval.display())).exists());
    std::fs::remove_file(composition_graph).expect("remove base composition graph");
    std::fs::remove_file(manifest).expect("remove eval manifest");
    std::fs::remove_file(output_eval).expect("remove composed eval sidecar");
}

#[test]
fn tinyrustlm_eval_cli_rejects_removed_graphless_contract_without_output() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let manifest = write_eval_manifest(&model, "tiny-test-model-q8-graphless.manifest");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8-graphless.eval");
    let _ = std::fs::remove_file(&output_eval);

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run removed graphless eval contract");

    assert!(!output.status.success(), "{}", output_text(&output));
    assert!(output_text(&output).contains(
        "evaluation requires <model.slm> <model.manifest> <eval-cases.txt> <composition.acg1> <output.eval>"
    ));
    assert!(!output_eval.exists());
    assert!(!PathBuf::from(format!("{}.progress", output_eval.display())).exists());
    std::fs::remove_file(manifest).expect("remove eval manifest");
}

#[test]
fn tinyrustlm_eval_cli_rejects_wrong_model_graph_before_evidence() {
    let tinyrustlm_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("runtime crate lives under tinyrustlm");
    let model = tinyrustlm_root
        .join("models")
        .join("tiny-test-model-q8.slm");
    let other_model = tinyrustlm_root.join("models").join("tiny-test-model.slm");
    let manifest = write_eval_manifest(&model, "tiny-test-model-q8-wrong-graph.manifest");
    let composition_graph =
        write_base_composition_graph(&other_model, "tiny-test-model-wrong-base.acg1");
    let cases = tinyrustlm_root
        .join("tests")
        .join("fixtures")
        .join("assistant-quality-eval-cases.txt");
    let output_eval = temp_output("tiny-test-model-q8-wrong-graph.eval");
    let _ = std::fs::remove_file(&output_eval);

    let output = Command::new(eval_bin())
        .args([
            model.as_os_str(),
            manifest.as_os_str(),
            cases.as_os_str(),
            composition_graph.as_os_str(),
            output_eval.as_os_str(),
        ])
        .output()
        .expect("run eval with graph for different model");

    assert!(!output.status.success(), "{}", output_text(&output));
    assert!(output_text(&output).contains("composition graph validation failed"));
    assert!(!output_eval.exists());
    assert!(!PathBuf::from(format!("{}.progress", output_eval.display())).exists());
    std::fs::remove_file(composition_graph).expect("remove wrong-model composition graph");
    std::fs::remove_file(manifest).expect("remove eval manifest");
}

fn write_eval_manifest(model_path: &Path, name: &str) -> PathBuf {
    let model_bytes = std::fs::read(model_path).expect("read model for eval manifest");
    let model = Model::load(&model_bytes).expect("load model for eval manifest");
    let output_path = temp_output(name);
    let _ = std::fs::remove_file(&output_path);
    std::fs::write(
        &output_path,
        format!(
            "tinyrustlm_slm_manifest_version=1\n\
             model_bytes={}\n\
             slm_checksum=0x{:016x}\n\
             source_kind=deterministic-smoke\n\
             prompt_format=raw-completion-v1\n",
            model_bytes.len(),
            model.header().checksum,
        ),
    )
    .expect("write eval manifest");
    output_path
}

fn write_base_composition_graph(model_path: &Path, name: &str) -> PathBuf {
    let model_bytes = std::fs::read(model_path).expect("read model for composition graph");
    let model = Model::load(&model_bytes).expect("load model for composition graph");
    let bindings =
        ExecutionBindings::new([0x33; 32], [0x44; 32], [0x55; 32], [0x66; 32], [0x77; 32])
            .expect("build execution bindings");
    let route_policy_id = ContentId::parse_display(&format!("route-sha256-{}", "88".repeat(32)))
        .expect("build route policy identity");
    let bundle = ActiveCompositionBundle::build(&model, bindings, route_policy_id, &[])
        .expect("build base composition graph");
    let output_path = temp_output(name);
    let _ = std::fs::remove_file(&output_path);
    std::fs::write(&output_path, bundle.bytes()).expect("write base composition graph");
    output_path
}

fn temp_output(name: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("tinyrustlm-eval-cli-{nanos}-{name}"))
}

fn output_text(output: &std::process::Output) -> String {
    format!(
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}
