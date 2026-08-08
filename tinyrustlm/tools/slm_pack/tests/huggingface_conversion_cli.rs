//! Public CLI coverage for Hugging Face conversion request handoffs.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn pack_bin() -> &'static str {
    env!("CARGO_BIN_EXE_tinyrustlm-slm-pack")
}

fn unique_dir(name: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after UNIX_EPOCH")
        .as_millis();
    std::env::temp_dir().join(format!(
        "tinyrustlm-slm-pack-{name}-{}-{millis}",
        std::process::id()
    ))
}

fn output_text(output: &std::process::Output) -> String {
    format!(
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

fn replace_manifest_line(text: &str, key: &str, value: &str) -> String {
    let prefix = format!("{key}=");
    let mut replaced = false;
    let mut out = String::new();
    for line in text.lines() {
        if line.starts_with(&prefix) {
            out.push_str(&prefix);
            out.push_str(value);
            out.push('\n');
            replaced = true;
        } else {
            out.push_str(line);
            out.push('\n');
        }
    }
    assert!(replaced, "manifest key {key} should exist");
    out
}

fn write_huggingface_fixture(path: &Path) {
    let path_text = path.to_string_lossy().to_string();
    let output = Command::new(pack_bin())
        .args([
            "write-safetensors-fixture",
            &path_text,
            "tiny-fixture",
            "huggingface",
        ])
        .output()
        .expect("run write-safetensors-fixture");
    assert!(output.status.success(), "{}", output_text(&output));
    assert!(path.exists());
}

fn write_huggingface_shard_fixture(dir: &Path) {
    let dir_text = dir.to_string_lossy().to_string();
    let output = Command::new(pack_bin())
        .args([
            "write-safetensors-fixture-shards",
            &dir_text,
            "tiny-fixture",
            "huggingface",
        ])
        .output()
        .expect("run write-safetensors-fixture-shards");
    assert!(output.status.success(), "{}", output_text(&output));
    assert!(dir.join("model-00001-of-00002.safetensors").exists());
    assert!(dir.join("model-00002-of-00002.safetensors").exists());
}

#[test]
fn help_cli_prints_usage_without_writing_output_artifact() {
    let dir = unique_dir("help-does-not-write-output");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let output = Command::new(pack_bin())
        .current_dir(&dir)
        .arg("--help")
        .output()
        .expect("run --help");

    let text = output_text(&output);
    assert!(output.status.success(), "{text}");
    assert!(text.contains("usage: tinyrustlm-slm-pack"));
    assert!(text.contains("smollm2-360m-instruct-bpe"));
    assert!(
        !dir.join("--help").exists(),
        "--help must not be interpreted as an output .slm path"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn inspect_huggingface_conversion_request_cli_writes_report_without_source_bytes() {
    let dir = unique_dir("hf-conversion-request-inspect-cli");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let request_path = dir.join("example-org__tiny-source-model.minimodel-conversion-request.json");
    let report_path = dir.join("request.inspect");
    std::fs::write(
        &request_path,
        r#"{
  "request_kind": "minimodel.huggingface_conversion_request.v1",
  "source": {
    "kind": "huggingface_model",
    "model_id": "example-org/tiny-source-model",
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "license_id": "apache-2.0"
  },
  "requested_artifact": {
    "kind": "slm",
    "supported_source_shapes": ["tiny-fixture", "tinylm16"],
    "default_source_shape": "tiny-fixture",
    "default_quantization": "q8_0"
  },
  "local_conversion": {
    "source_format": "safetensors",
    "source_input_mode": "single-safetensors-file",
    "suggested_source_safetensors_file": "tiny-hf-source.safetensors",
    "suggested_source_safetensors_files": [
      {
        "file_name": "tiny-hf-source.safetensors",
        "sha256": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "byte_count": 4096
      }
    ],
    "known_peer_base_url": "http://127.0.0.1:8123/peer-pieces"
  }
}
"#,
    )
    .expect("write conversion request");

    let request_path_text = request_path.to_string_lossy().to_string();
    let report_path_text = report_path.to_string_lossy().to_string();
    let output = Command::new(pack_bin())
        .args([
            "inspect-huggingface-conversion-request",
            &request_path_text,
            &report_path_text,
        ])
        .output()
        .expect("run inspect-huggingface-conversion-request");
    assert!(output.status.success(), "{}", output_text(&output));
    let cli_text = output_text(&output);
    assert!(cli_text.contains("Hugging Face conversion request inspection: PASS"));
    assert!(cli_text.contains("source_model_id: example-org/tiny-source-model"));
    assert!(cli_text.contains("source_format: safetensors"));

    let report = std::fs::read_to_string(&report_path).expect("read request inspection report");
    assert!(report.contains("tinyrustlm_huggingface_conversion_request_inspection_version=1"));
    assert!(report.contains("inspection_status=pass"));
    assert!(report.contains("source_model_id=example-org/tiny-source-model"));
    assert!(report.contains("source_format=safetensors"));
    assert!(report.contains("source_input_mode=single-safetensors-file"));
    assert!(report.contains("request_sha256=sha256:"));
    assert!(report.contains("supported_source_shapes=tiny-fixture,tinylm16"));
    assert!(report.contains("default_source_shape=tiny-fixture"));
    assert!(report.contains("default_quantization=q8_0"));
    assert!(report.contains("suggested_source_safetensors_file=tiny-hf-source.safetensors"));
    assert!(report.contains("known_peer_base_url=http://127.0.0.1:8123/peer-pieces/"));
    assert!(report.contains("safetensors_expected_file_count=1"));
    assert!(report.contains("safetensors_expected_total_bytes=4096"));
    assert!(report.contains("safetensors_expected.0.file_name=tiny-hf-source.safetensors"));
    assert!(report.contains(
        "safetensors_expected.0.sha256=sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    ));
    assert!(report.contains("gguf_expected_file_count=0"));
    assert!(report.contains("project_server_serves_model_bytes=false"));
    assert!(report.contains("local_script_huggingface_download_requires_explicit_opt_in=true"));
    assert!(report.contains("required_next_gate=convert-huggingface-request"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn inspect_huggingface_conversion_request_cli_accepts_gguf_and_blocks_safetensors_converter() {
    let dir = unique_dir("hf-gguf-conversion-request-inspect-cli");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let request_path = dir.join("example-org__gguf-source.minimodel-conversion-request.json");
    let report_path = dir.join("gguf-request.inspect");
    let output_dir = dir.join("conversion-output");
    std::fs::write(
        &request_path,
        r#"{
  "request_kind": "minimodel.huggingface_conversion_request.v1",
  "source": {
    "kind": "huggingface_model",
    "model_id": "example-org/gguf-source",
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "license_id": "apache-2.0"
  },
  "requested_artifact": {
    "kind": "slm",
    "supported_source_shapes": ["tiny-fixture"],
    "default_source_shape": "tiny-fixture",
    "default_quantization": "q8_0"
  },
  "local_conversion": {
    "source_format": "gguf",
    "source_input_mode": "single-gguf-file",
    "suggested_source_safetensors_file": null,
    "suggested_source_gguf_file": "model-f16.gguf",
    "suggested_source_gguf_files": [
      {
        "file_name": "model-f16.gguf",
        "sha256": "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        "byte_count": 8192
      }
    ]
  }
}
"#,
    )
    .expect("write GGUF conversion request");

    let request_path_text = request_path.to_string_lossy().to_string();
    let report_path_text = report_path.to_string_lossy().to_string();
    let inspect_output = Command::new(pack_bin())
        .args([
            "inspect-huggingface-conversion-request",
            &request_path_text,
            &report_path_text,
        ])
        .output()
        .expect("run inspect-huggingface-conversion-request on GGUF request");
    assert!(
        inspect_output.status.success(),
        "{}",
        output_text(&inspect_output)
    );
    let report = std::fs::read_to_string(&report_path).expect("read GGUF request inspection");
    assert!(report.contains("source_format=gguf"));
    assert!(report.contains("source_input_mode=single-gguf-file"));
    assert!(report.contains("suggested_source_gguf_file=model-f16.gguf"));
    assert!(report.contains("gguf_expected_file_count=1"));
    assert!(report.contains("gguf_expected_total_bytes=8192"));
    assert!(report.contains("gguf_expected.0.file_name=model-f16.gguf"));
    assert!(report.contains(
        "gguf_expected.0.sha256=sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
    ));
    assert!(report.contains("required_next_gate=inspect-gguf-and-plan-gguf-source"));

    let missing_input = dir.join("model-f16.gguf").to_string_lossy().to_string();
    let output_dir_text = output_dir.to_string_lossy().to_string();
    let convert_output = Command::new(pack_bin())
        .args([
            "convert-huggingface-request",
            &request_path_text,
            &missing_input,
            &output_dir_text,
        ])
        .output()
        .expect("run convert-huggingface-request against GGUF request");
    let convert_text = output_text(&convert_output);
    assert!(!convert_output.status.success(), "{convert_text}");
    assert!(convert_text.contains("source_format=gguf must use inspect-gguf"));
    assert!(
        !output_dir.exists(),
        "GGUF request should be rejected before creating a safetensors conversion directory"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn convert_huggingface_request_cli_writes_verified_slm_preflight_and_receipt() {
    let dir = unique_dir("hf-conversion-cli");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let source_path = dir.join("tiny-hf-source.safetensors");
    let request_path = dir.join("example-org__tiny-source-model.minimodel-conversion-request.json");
    let output_dir = dir.join("conversion-output");
    write_huggingface_fixture(&source_path);
    std::fs::write(
        &request_path,
        r#"{
  "request_kind": "minimodel.huggingface_conversion_request.v1",
  "source": {
    "kind": "huggingface_model",
    "model_id": "example-org/tiny-source-model",
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "license_id": "apache-2.0"
  },
  "requested_artifact": {
    "kind": "slm",
    "default_source_shape": "tiny-fixture",
    "default_quantization": "q8_0"
  },
  "local_conversion": {
    "suggested_source_safetensors_file": "tiny-hf-source.safetensors",
    "known_peer_base_url": "http://127.0.0.1:8123/peer-pieces/"
  }
}
"#,
    )
    .expect("write conversion request");

    let request_path_text = request_path.to_string_lossy().to_string();
    let source_path_text = source_path.to_string_lossy().to_string();
    let output_dir_text = output_dir.to_string_lossy().to_string();
    let output = Command::new(pack_bin())
        .args([
            "convert-huggingface-request",
            &request_path_text,
            &source_path_text,
            &output_dir_text,
            "tiny-fixture",
            "q8_0",
        ])
        .output()
        .expect("run convert-huggingface-request");
    assert!(output.status.success(), "{}", output_text(&output));
    let cli_text = output_text(&output);
    assert!(cli_text.contains("Hugging Face conversion request: PASS"));
    assert!(cli_text.contains("source_model_id: example-org/tiny-source-model"));
    assert!(cli_text.contains("target_model_shape: tiny-fixture"));
    assert!(cli_text.contains("output_quantization: q8_0"));

    let output_slm = output_dir.join("example-org__tiny-source-model.q8_0.slm");
    let manifest = output_dir.join("example-org__tiny-source-model.q8_0.slm.manifest");
    assert!(output_slm.exists());
    assert!(manifest.exists());
    assert!(output_dir.join("source.inspect").exists());
    assert!(output_dir.join("source.plan").exists());

    let output_slm_text = output_slm.to_string_lossy().to_string();
    let validate_output = Command::new(pack_bin())
        .args(["validate", &output_slm_text])
        .output()
        .expect("run validate on converted slm");
    assert!(
        validate_output.status.success(),
        "{}",
        output_text(&validate_output)
    );

    let preflight_path = output_dir.join("tinyrustlm-conversion.preflight");
    let preflight = std::fs::read_to_string(&preflight_path).expect("read conversion preflight");
    assert!(preflight.contains("tinyrustlm_huggingface_conversion_preflight_version=1"));
    assert!(preflight.contains("source_model_id=example-org/tiny-source-model"));
    assert!(preflight.contains("request_sha256=sha256:"));
    assert!(preflight.contains("preflight_status=pass"));
    assert!(preflight.contains("source_contract_status=not-provided"));
    assert!(preflight.contains("known_peer_base_url=http://127.0.0.1:8123/peer-pieces/"));
    assert!(preflight.contains("conversion_decision=ready-for-local-conversion"));
    assert!(preflight.contains("output_slm_produced=pending-conversion"));
    assert!(preflight.contains("project_server_serves_model_bytes=false"));
    assert!(preflight.contains("project_server_runs_model_bytes=false"));
    assert!(preflight.contains("project_server_proxies_huggingface_bytes=false"));

    let receipt_path = output_dir.join("tinyrustlm-conversion.receipt");
    let receipt = std::fs::read_to_string(&receipt_path).expect("read conversion receipt");
    assert!(receipt.contains("tinyrustlm_huggingface_conversion_receipt_version=2"));
    assert!(receipt.contains("request_kind=minimodel.huggingface_conversion_request.v1"));
    assert!(receipt.contains("source_kind=huggingface_model"));
    assert!(receipt.contains("source_model_id=example-org/tiny-source-model"));
    assert!(receipt.contains("request_sha256=sha256:"));
    assert!(receipt.contains("source_contract_status=not-provided"));
    assert!(receipt.contains("known_peer_base_url=http://127.0.0.1:8123/peer-pieces/"));
    assert!(receipt.contains("target_model_shape=tiny-fixture"));
    assert!(receipt.contains("output_quantization=q8_0"));
    assert!(receipt.contains("output_slm="));
    assert!(receipt.contains("output_slm_sha256=sha256:"));
    assert!(receipt.contains("output_manifest_sha256=sha256:"));
    assert!(receipt.contains("project_server_serves_model_bytes=false"));
    assert!(receipt.contains("project_server_runs_model_bytes=false"));
    assert!(receipt.contains("project_server_proxies_huggingface_bytes=false"));
    assert!(receipt.contains("browser_import_rule=user-imports-local-slm"));
    assert!(receipt.contains("required_next_gate=minimodel-prepare-peer-share"));
    assert!(receipt.contains(
        "converted_once_publication_rule=external-proof-required-before-public-announcement"
    ));

    let receipt_path_text = receipt_path.to_string_lossy().to_string();
    let preflight_path_text = preflight_path.to_string_lossy().to_string();
    let manifest_text = manifest.to_string_lossy().to_string();
    let inspect_receipt_output = Command::new(pack_bin())
        .args([
            "inspect-huggingface-conversion-receipt",
            &receipt_path_text,
            &request_path_text,
            &preflight_path_text,
            &output_slm_text,
            &manifest_text,
        ])
        .output()
        .expect("run inspect-huggingface-conversion-receipt");
    assert!(
        inspect_receipt_output.status.success(),
        "{}",
        output_text(&inspect_receipt_output)
    );
    let inspect_text = output_text(&inspect_receipt_output);
    assert!(inspect_text.contains("Hugging Face conversion receipt inspection: PASS"));
    assert!(inspect_text.contains("request_sha256: sha256:"));
    assert!(inspect_text.contains("output_slm_sha256: sha256:"));

    let drift_receipt = output_dir.join("tinyrustlm-conversion.drift.receipt");
    std::fs::write(
        &drift_receipt,
        replace_manifest_line(
            &receipt,
            "output_slm_sha256",
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
    )
    .expect("write drifted receipt");
    let drift_receipt_text = drift_receipt.to_string_lossy().to_string();
    let drift_output = Command::new(pack_bin())
        .args([
            "inspect-huggingface-conversion-receipt",
            &drift_receipt_text,
            &request_path_text,
            &preflight_path_text,
            &output_slm_text,
            &manifest_text,
        ])
        .output()
        .expect("run inspect-huggingface-conversion-receipt on drifted receipt");
    assert!(
        !drift_output.status.success(),
        "{}",
        output_text(&drift_output)
    );
    assert!(output_text(&drift_output).contains("output_slm_sha256"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn convert_huggingface_request_cli_accepts_verified_shard_directory() {
    let dir = unique_dir("hf-conversion-cli-shards");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let source_dir = dir.join("source");
    let request_path = dir.join("example-org__tiny-sharded.minimodel-conversion-request.json");
    let output_dir = dir.join("conversion-output");
    write_huggingface_shard_fixture(&source_dir);

    let shard_one = source_dir.join("model-00001-of-00002.safetensors");
    let shard_two = source_dir.join("model-00002-of-00002.safetensors");
    let shard_one_bytes = std::fs::metadata(&shard_one)
        .expect("stat first shard")
        .len();
    let shard_two_bytes = std::fs::metadata(&shard_two)
        .expect("stat second shard")
        .len();
    std::fs::write(
        &request_path,
        format!(
            r#"{{
  "request_kind": "minimodel.huggingface_conversion_request.v1",
  "source": {{
    "kind": "huggingface_model",
    "model_id": "example-org/tiny-sharded",
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "license_id": "apache-2.0"
  }},
  "requested_artifact": {{
    "kind": "slm",
    "default_source_shape": "tiny-fixture",
    "default_quantization": "q8_0"
  }},
  "local_conversion": {{
    "suggested_source_safetensors_file": "model-00001-of-00002.safetensors",
    "suggested_source_safetensors_files": [
      {{
        "file_name": "model-00001-of-00002.safetensors",
        "byte_count": {shard_one_bytes}
      }},
      {{
        "file_name": "model-00002-of-00002.safetensors",
        "byte_count": {shard_two_bytes}
      }}
    ]
  }}
}}
"#
        ),
    )
    .expect("write sharded conversion request");

    let request_path_text = request_path.to_string_lossy().to_string();
    let source_dir_text = source_dir.to_string_lossy().to_string();
    let output_dir_text = output_dir.to_string_lossy().to_string();
    let output = Command::new(pack_bin())
        .args([
            "convert-huggingface-request",
            &request_path_text,
            &source_dir_text,
            &output_dir_text,
            "tiny-fixture",
            "q8_0",
        ])
        .output()
        .expect("run convert-huggingface-request against shard directory");
    assert!(output.status.success(), "{}", output_text(&output));

    let output_slm = output_dir.join("example-org__tiny-sharded.q8_0.slm");
    assert!(output_slm.exists());
    let output_slm_text = output_slm.to_string_lossy().to_string();
    let validate_output = Command::new(pack_bin())
        .args(["validate", &output_slm_text])
        .output()
        .expect("run validate on converted sharded slm");
    assert!(
        validate_output.status.success(),
        "{}",
        output_text(&validate_output)
    );

    let inspect =
        std::fs::read_to_string(output_dir.join("source.inspect")).expect("read source inspect");
    assert!(inspect.contains("source_file_count=2"));
    assert!(inspect.contains("model-00001-of-00002.safetensors"));
    assert!(inspect.contains("model-00002-of-00002.safetensors"));

    let plan = std::fs::read_to_string(output_dir.join("source.plan")).expect("read source plan");
    assert!(plan.contains("source_file_count=2"));
    assert!(plan.contains("tensor.0.source_path="));

    let preflight = std::fs::read_to_string(output_dir.join("tinyrustlm-conversion.preflight"))
        .expect("read sharded conversion preflight");
    assert!(preflight.contains("request_sha256=sha256:"));
    assert!(preflight.contains("preflight_status=pass"));
    assert!(preflight.contains("source_contract_status=pass"));
    assert!(preflight.contains("source_expected_file_count=2"));
    assert!(preflight.contains("source_verified_file_count=2"));
    assert!(preflight.contains("source_verified_sha256_count=0"));
    assert!(preflight.contains(&format!(
        "source_expected_total_bytes={}",
        shard_one_bytes + shard_two_bytes
    )));
    assert!(preflight.contains(&format!(
        "source_actual_total_bytes={}",
        shard_one_bytes + shard_two_bytes
    )));

    let receipt = std::fs::read_to_string(output_dir.join("tinyrustlm-conversion.receipt"))
        .expect("read sharded conversion receipt");
    assert!(receipt.contains("source_model_id=example-org/tiny-sharded"));
    assert!(receipt.contains("request_sha256=sha256:"));
    assert!(receipt.contains("output_slm_sha256=sha256:"));
    assert!(receipt.contains("output_manifest_sha256=sha256:"));
    assert!(receipt.contains("source_file_count=2"));
    assert!(receipt.contains("source_contract_status=pass"));
    assert!(receipt.contains("source_expected_file_count=2"));
    assert!(receipt.contains("source_verified_file_count=2"));
    assert!(receipt.contains("source_verified_sha256_count=0"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn convert_huggingface_request_cli_rejects_source_sha256_drift_before_output_slm() {
    let dir = unique_dir("hf-conversion-cli-sha-drift");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let source_path = dir.join("tiny-hf-source.safetensors");
    let request_path = dir.join("example-org__tiny-source-model.minimodel-conversion-request.json");
    let output_dir = dir.join("conversion-output");
    write_huggingface_fixture(&source_path);
    let source_byte_count = std::fs::metadata(&source_path)
        .expect("stat safetensors fixture")
        .len();
    std::fs::write(
        &request_path,
        format!(
            r#"{{
  "request_kind": "minimodel.huggingface_conversion_request.v1",
  "source": {{
    "kind": "huggingface_model",
    "model_id": "example-org/tiny-source-model",
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "license_id": "apache-2.0"
  }},
  "requested_artifact": {{
    "kind": "slm",
    "default_source_shape": "tiny-fixture",
    "default_quantization": "q8_0"
  }},
  "local_conversion": {{
    "suggested_source_safetensors_file": "tiny-hf-source.safetensors",
    "suggested_source_safetensors_files": [
      {{
        "file_name": "tiny-hf-source.safetensors",
        "sha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "byte_count": {source_byte_count}
      }}
    ]
  }}
}}
"#
        ),
    )
    .expect("write conversion request");

    let request_path_text = request_path.to_string_lossy().to_string();
    let source_path_text = source_path.to_string_lossy().to_string();
    let output_dir_text = output_dir.to_string_lossy().to_string();
    let output = Command::new(pack_bin())
        .args([
            "convert-huggingface-request",
            &request_path_text,
            &source_path_text,
            &output_dir_text,
            "tiny-fixture",
            "q8_0",
        ])
        .output()
        .expect("run convert-huggingface-request");

    assert!(!output.status.success(), "{}", output_text(&output));
    assert!(output_text(&output).contains("source SHA-256 mismatch"));
    assert!(output_dir.join("source.inspect").exists());
    assert!(output_dir.join("source.plan").exists());
    assert!(!output_dir.join("tinyrustlm-conversion.receipt").exists());
    assert!(!output_dir
        .join("example-org__tiny-source-model.q8_0.slm")
        .exists());

    let preflight = std::fs::read_to_string(output_dir.join("tinyrustlm-conversion.preflight"))
        .expect("read failed conversion preflight");
    assert!(preflight.contains("tinyrustlm_huggingface_conversion_preflight_version=1"));
    assert!(preflight.contains("request_sha256=sha256:"));
    assert!(preflight.contains("preflight_status=fail"));
    assert!(preflight.contains("source_contract_status=fail"));
    assert!(preflight.contains("source_expected_file_count=1"));
    assert!(preflight.contains("source_verified_sha256_count=0"));
    assert!(preflight.contains("conversion_decision=source-contract-rejected-before-conversion"));
    assert!(preflight.contains("failure_stage=huggingface-source-contract"));
    assert!(
        preflight.contains("required_next_gate=choose-matching-reviewed-source-or-wait-for-p2p")
    );
    assert!(preflight.contains("project_server_serves_model_bytes=false"));
    assert!(preflight.contains("project_server_runs_model_bytes=false"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn convert_huggingface_request_cli_rejects_unsafe_identifiers_before_source_read() {
    let dir = unique_dir("hf-conversion-cli-unsafe-identifiers");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create test directory");

    let cases = [
        (
            "model-id-control",
            r#""model_id": "example-org/tiny-source-model\n""#,
            r#""suggested_source_safetensors_file": "tiny-hf-source.safetensors""#,
            "source.model_id must be a safe model id",
        ),
        (
            "model-id-space",
            r#""model_id": "example org/tiny-source-model""#,
            r#""suggested_source_safetensors_file": "tiny-hf-source.safetensors""#,
            "source.model_id must be a safe model id",
        ),
        (
            "source-file-leading-space",
            r#""model_id": "example-org/tiny-source-model""#,
            r#""suggested_source_safetensors_file": " tiny-hf-source.safetensors""#,
            "suggested source file must be a safe .safetensors file name",
        ),
        (
            "source-file-path",
            r#""model_id": "example-org/tiny-source-model""#,
            r#""suggested_source_safetensors_files": [{"file_name": "nested/model.safetensors"}]"#,
            "suggested source file must be a safe .safetensors file name",
        ),
        (
            "known-peer-project-host",
            r#""model_id": "example-org/tiny-source-model""#,
            r#""suggested_source_safetensors_file": "tiny-hf-source.safetensors", "known_peer_base_url": "http://MiniModel.org/peer-pieces/""#,
            "known_peer_base_url must not use a project or Hugging Face host",
        ),
        (
            "known-peer-project-host-root-dot",
            r#""model_id": "example-org/tiny-source-model""#,
            r#""suggested_source_safetensors_file": "tiny-hf-source.safetensors", "known_peer_base_url": "http://MiniModel.org./peer-pieces/""#,
            "known_peer_base_url must not use a project or Hugging Face host",
        ),
        (
            "known-peer-unsafe-path",
            r#""model_id": "example-org/tiny-source-model""#,
            r#""suggested_source_safetensors_file": "tiny-hf-source.safetensors", "known_peer_base_url": "http://127.0.0.1:8123/peer-pieces/../secret/""#,
            "known_peer_base_url path must be a plain safe path",
        ),
    ];

    for (label, model_id_json, local_conversion_json, expected_error) in cases {
        let request_path = dir.join(format!("{label}.json"));
        let output_dir = dir.join(format!("{label}-output"));
        std::fs::write(
            &request_path,
            format!(
                r#"{{
  "request_kind": "minimodel.huggingface_conversion_request.v1",
  "source": {{
    "kind": "huggingface_model",
    {model_id_json},
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "license_id": "apache-2.0"
  }},
  "requested_artifact": {{
    "kind": "slm",
    "default_source_shape": "tiny-fixture",
    "default_quantization": "q8_0"
  }},
  "local_conversion": {{
    {local_conversion_json}
  }}
}}
"#
            ),
        )
        .expect("write conversion request");

        let request_path_text = request_path.to_string_lossy().to_string();
        let missing_source_text = dir
            .join("missing-source.safetensors")
            .to_string_lossy()
            .to_string();
        let output_dir_text = output_dir.to_string_lossy().to_string();
        let output = Command::new(pack_bin())
            .args([
                "convert-huggingface-request",
                &request_path_text,
                &missing_source_text,
                &output_dir_text,
                "tiny-fixture",
                "q8_0",
            ])
            .output()
            .expect("run convert-huggingface-request");

        let text = output_text(&output);
        assert!(!output.status.success(), "{text}");
        assert!(text.contains(expected_error), "{text}");
        assert!(
            !output_dir.exists(),
            "unsafe request should fail before creating output dir for {label}"
        );
    }

    let _ = std::fs::remove_dir_all(&dir);
}
