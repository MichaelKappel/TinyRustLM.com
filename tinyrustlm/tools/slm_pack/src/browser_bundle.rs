//! Browser bundles for graph-authorized converted models and validated runtimes.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tinyrustlm_runtime::eval_runner;

use crate::admission;
use crate::blend::{hex64, push_line};
use crate::candidate;
use crate::compatibility;
use crate::composition_graph;
use crate::lineage;
use crate::promotion;
use crate::provenance;
use crate::selector;
use crate::trained_source;

const SOURCE_MANIFEST_KIND: &str = "trained-source-manifest";
const SOURCE_MANIFEST_STATUS: &str = "reviewed-source-snapshot";
const SOURCE_VALIDATION_VERSION: &str = "1";
const SOURCE_VALIDATION_GATE: &str = "validate-source";
const SOURCE_VALIDATION_STATUS: &str = "pass";
const SOURCE_VALIDATION_DECISION: &str = "accepted-for-conversion";
const SOURCE_VALIDATION_NEXT_GATE: &str = "convert-raw-f32-source-to-slm";
const APP_FILES: [&str; 7] = [
    "index.html",
    "app.css",
    "active-conversation.js",
    "calculator-tool.js",
    "memory-endpoints-distributed-sync-v1.js",
    "memory-endpoints-sync.js",
    "app.js",
];
const RUNTIME_WASM_FILE: &str = "tinyrustlm.wasm";
const RUNTIME_WASM_MANIFEST_FILE: &str = "tinyrustlm.wasm.manifest";
const RUNTIME_WASM_SIMD_FILE: &str = "tinyrustlm-simd.wasm";
const RUNTIME_WASM_SIMD_MANIFEST_FILE: &str = "tinyrustlm-simd.wasm.manifest";
const RUNTIME_WASM_KIND: &str = "tinyrustlm-rust-wasm";
const RUNTIME_WASM_STATUS: &str = "validated-local-runtime";
const RUNTIME_WASM_NEXT_GATE: &str = "instantiate-wasm-runtime";

/// Writes a browser-loadable converted-trained selector bundle from a reviewed source directory.
pub(crate) fn write_converted_trained_bundle_path(
    root: &Path,
    source_dir: &Path,
    composition_graph_root: &Path,
    quantization: &str,
) -> io::Result<()> {
    let eval_cases_path = default_converted_trained_eval_cases_path();
    write_converted_trained_bundle_path_with_eval_cases(
        root,
        source_dir,
        composition_graph_root,
        quantization,
        &eval_cases_path,
    )
}

pub(crate) fn write_converted_trained_bundle_path_with_eval_cases(
    root: &Path,
    source_dir: &Path,
    composition_graph_root: &Path,
    quantization: &str,
    eval_cases_path: &Path,
) -> io::Result<()> {
    write_converted_trained_bundle_path_with_eval_cases_and_source_review(
        root,
        source_dir,
        composition_graph_root,
        quantization,
        eval_cases_path,
        None,
    )
}

pub(crate) fn write_converted_trained_bundle_path_with_eval_cases_and_source_review(
    root: &Path,
    source_dir: &Path,
    composition_graph_root: &Path,
    quantization: &str,
    eval_cases_path: &Path,
    source_review_path: Option<&Path>,
) -> io::Result<()> {
    let quantizations = converted_trained_quantizations(quantization)?;
    let models = root.join("models");
    let evidence_root = root.join("evidence");
    fs::create_dir_all(&models)?;
    fs::create_dir_all(&evidence_root)?;
    copy_browser_surface(root)?;

    let mut admission_paths = Vec::with_capacity(quantizations.len());
    let mut candidate_paths = Vec::with_capacity(quantizations.len());
    for entry_quantization in quantizations {
        let (admission_path, candidate_path) = write_converted_trained_bundle_entry(
            &models,
            &evidence_root,
            source_dir,
            composition_graph_root,
            entry_quantization,
            eval_cases_path,
            source_review_path,
        )?;
        admission_paths.push(admission_path);
        candidate_paths.push(candidate_path);
    }

    let registry_path = models.join("selector.registry");
    selector::write_registry_path(&registry_path, &admission_paths)?;
    selector::validate_registry_path(&registry_path, &admission_paths)?;

    println!(
        "SLM browser converted-trained bundle root: {}",
        root.display()
    );
    println!(
        "SLM browser converted-trained registry: {}",
        registry_path.display()
    );
    for candidate_path in candidate_paths {
        println!(
            "SLM browser converted-trained model: {}",
            candidate_path.display()
        );
    }
    Ok(())
}

fn write_converted_trained_bundle_entry(
    models: &Path,
    evidence_root: &Path,
    source_dir: &Path,
    composition_graph_root: &Path,
    quantization: &str,
    eval_cases_path: &Path,
    source_review_path: Option<&Path>,
) -> io::Result<(String, PathBuf)> {
    // Stages one converted source artifact and the evidence chain consumed by selector.registry.
    let candidate_id = converted_trained_candidate_id(quantization)?;
    let evidence = evidence_root.join(candidate_id);
    fs::create_dir_all(&evidence)?;
    let model_file = format!("{candidate_id}.slm");
    let candidate_path = models.join(&model_file);
    let composition_graph_file = format!("{model_file}.acg1");
    let source_composition_graph_path = composition_graph_root.join(format!("{candidate_id}.acg1"));
    let composition_graph_path = models.join(&composition_graph_file);
    let provenance_path = models.join(format!("{model_file}.manifest"));
    let compatibility_path = evidence.join("converted-trained.compat");
    let lineage_path = evidence.join("converted-trained.lineage");
    let candidate_manifest_path = evidence.join("converted-trained.candidate");
    let promotion_path = evidence.join("converted-trained.promotion");
    let runtime_path = evidence.join("converted-trained.runtime");
    let eval_path = evidence.join("converted-trained.eval");
    let admission_path = evidence.join("converted-trained.admission");

    trained_source::convert_trained_path(source_dir, &candidate_path, quantization)?;
    let mut source_manifest =
        write_converted_trained_source_manifest_snapshot(source_dir, &evidence)?;
    write_converted_trained_source_review_snapshot(
        &evidence,
        candidate_id,
        source_review_path,
        &mut source_manifest,
    )?;
    let source_validation = write_converted_trained_source_validation_snapshot(
        &evidence,
        candidate_id,
        &source_manifest,
    )?;
    provenance::validate_manifest_path(&candidate_path, &provenance_path)?;
    compatibility::report_path(&candidate_path, &candidate_path, Some(&compatibility_path))?;
    lineage::write_template_path(
        &compatibility_path,
        &lineage_path,
        candidate_id,
        "trained-source-conversion",
        "browser-file-backed-converted-trained",
    )?;
    candidate::write_manifest_path(
        &compatibility_path,
        &lineage_path,
        &candidate_path,
        &candidate_manifest_path,
        None,
    )?;
    promotion::write_template_path(
        &compatibility_path,
        &lineage_path,
        &candidate_path,
        &candidate_manifest_path,
        &promotion_path,
        "local-smoke-runner",
        promotion::DEFAULT_PROMOTION_SCOPE,
        None,
    )?;
    provenance::write_runtime_smoke_for_path(&candidate_path, &provenance_path, &runtime_path)?;
    composition_graph::stage_path(&source_composition_graph_path, &composition_graph_path)?;
    let eval_outcome = eval_runner::run_eval_to_sidecar(
        &candidate_path,
        &provenance_path,
        eval_cases_path,
        &composition_graph_path,
        &eval_path,
    )?;
    append_reviewed_eval_cases_route(&eval_path, source_review_path)?;
    if !eval_outcome.passed {
        return Err(invalid(&format!(
            "converted-trained browser bundle eval failed: {} passed, {} failed",
            eval_outcome.cases_passed, eval_outcome.cases_failed
        )));
    }
    provenance::quality_gate_path(
        &candidate_path,
        &provenance_path,
        "assistant-quality",
        Some(&eval_path),
    )?;
    admission::write_record_path(
        &compatibility_path,
        &lineage_path,
        &candidate_path,
        &candidate_manifest_path,
        &promotion_path,
        &provenance_path,
        &runtime_path,
        &eval_path,
        &admission_path,
        admission::DEFAULT_ADMISSION_SELECTOR_ID,
        None,
    )?;
    append_converted_trained_admission_route(&admission_path, candidate_id)?;
    append_converted_trained_source_manifest_route(
        &admission_path,
        candidate_id,
        &source_manifest,
    )?;
    append_converted_trained_source_validation_route(
        &admission_path,
        candidate_id,
        &source_validation,
    )?;
    append_converted_trained_runtime_smoke_route(&admission_path, candidate_id)?;
    append_converted_trained_eval_route(&admission_path, candidate_id)?;

    Ok((display_path(&admission_path), candidate_path))
}

fn default_converted_trained_eval_cases_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/assistant-quality-eval-cases.txt")
}

struct ConvertedTrainedSourceManifestSnapshot {
    checksum: String,
    source_kind: String,
    source_id: String,
    model_shape: String,
    source_dtype: String,
    tied_output: String,
    tensor_count: String,
    source_review: Option<ConvertedTrainedSourceReviewSnapshot>,
}

struct ConvertedTrainedSourceReviewSnapshot {
    kind: String,
    path: Option<String>,
    status: String,
    checksum: String,
    required_next_gate: String,
}

struct ConvertedTrainedSourceValidationSnapshot {
    checksum: String,
}

fn append_converted_trained_admission_route(
    admission_path: &Path,
    candidate_id: &str,
) -> io::Result<()> {
    // Carries the selector admission sidecar as a browser-verifiable route on the record itself.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "admission_path",
        &converted_trained_admission_registry_path(candidate_id),
    );
    fs::write(admission_path, admission)
}

fn write_converted_trained_source_manifest_snapshot(
    source_dir: &Path,
    evidence_dir: &Path,
) -> io::Result<ConvertedTrainedSourceManifestSnapshot> {
    // Carries the reviewed trained-source manifest into the browser evidence folder for audits.
    let target = evidence_dir.join("converted-trained.source.manifest");
    fs::copy(source_dir.join("source.manifest"), &target)?;
    let text = fs::read_to_string(target)?;
    let fields = provenance::parse_manifest(&text)?;
    Ok(ConvertedTrainedSourceManifestSnapshot {
        checksum: hex64(provenance::text_checksum(text.as_bytes())),
        source_kind: manifest_field(&fields, "source_kind")?.to_string(),
        source_id: manifest_field(&fields, "source_id")?.to_string(),
        model_shape: manifest_field(&fields, "model_shape")?.to_string(),
        source_dtype: manifest_field(&fields, "source_dtype")?.to_string(),
        tied_output: manifest_field(&fields, "tied_output")?.to_string(),
        tensor_count: manifest_field(&fields, "tensor_count")?.to_string(),
        source_review: converted_trained_source_review_snapshot(&fields)?,
    })
}

fn write_converted_trained_source_validation_snapshot(
    evidence_dir: &Path,
    candidate_id: &str,
    source_manifest: &ConvertedTrainedSourceManifestSnapshot,
) -> io::Result<ConvertedTrainedSourceValidationSnapshot> {
    // Records the validate-source gate as browser-routed evidence before conversion is admitted.
    let target = evidence_dir.join("converted-trained.source.validation");
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_source_validation_version",
        SOURCE_VALIDATION_VERSION,
    );
    push_line(&mut text, "source_validation_gate", SOURCE_VALIDATION_GATE);
    push_line(
        &mut text,
        "source_validation_status",
        SOURCE_VALIDATION_STATUS,
    );
    push_line(
        &mut text,
        "source_validation_decision",
        SOURCE_VALIDATION_DECISION,
    );
    push_line(
        &mut text,
        "source_manifest_path",
        &converted_trained_source_manifest_registry_path(candidate_id),
    );
    push_line(
        &mut text,
        "source_manifest_checksum",
        &source_manifest.checksum,
    );
    push_line(&mut text, "source_kind", &source_manifest.source_kind);
    push_line(&mut text, "source_id", &source_manifest.source_id);
    push_line(&mut text, "model_shape", &source_manifest.model_shape);
    push_line(&mut text, "source_dtype", &source_manifest.source_dtype);
    push_line(&mut text, "tied_output", &source_manifest.tied_output);
    push_line(&mut text, "tensor_count", &source_manifest.tensor_count);
    if let Some(source_review) = &source_manifest.source_review {
        push_line(&mut text, "source_review_checksum", &source_review.checksum);
    }
    push_line(&mut text, "required_next_gate", SOURCE_VALIDATION_NEXT_GATE);
    fs::write(&target, &text)?;
    Ok(ConvertedTrainedSourceValidationSnapshot {
        checksum: hex64(provenance::text_checksum(text.as_bytes())),
    })
}

fn append_converted_trained_source_manifest_route(
    admission_path: &Path,
    candidate_id: &str,
    source_manifest: &ConvertedTrainedSourceManifestSnapshot,
) -> io::Result<()> {
    // Extends the reviewed admission with the browser-verifiable source evidence route.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "source_manifest_path",
        &converted_trained_source_manifest_registry_path(candidate_id),
    );
    push_line(
        &mut admission,
        "source_manifest_checksum",
        &source_manifest.checksum,
    );
    push_line(&mut admission, "source_manifest_kind", SOURCE_MANIFEST_KIND);
    push_line(
        &mut admission,
        "source_manifest_status",
        SOURCE_MANIFEST_STATUS,
    );
    push_line(
        &mut admission,
        "source_manifest_source_kind",
        &source_manifest.source_kind,
    );
    push_line(
        &mut admission,
        "source_manifest_source_id",
        &source_manifest.source_id,
    );
    push_line(
        &mut admission,
        "source_manifest_model_shape",
        &source_manifest.model_shape,
    );
    if let Some(source_review) = &source_manifest.source_review {
        push_line(&mut admission, "source_review_kind", &source_review.kind);
        if let Some(path) = &source_review.path {
            push_line(&mut admission, "source_review_path", path);
        }
        push_line(
            &mut admission,
            "source_review_status",
            &source_review.status,
        );
        push_line(
            &mut admission,
            "source_review_checksum",
            &source_review.checksum,
        );
        push_line(
            &mut admission,
            "source_review_required_next_gate",
            &source_review.required_next_gate,
        );
    }
    fs::write(admission_path, admission)
}

fn append_converted_trained_source_validation_route(
    admission_path: &Path,
    candidate_id: &str,
    source_validation: &ConvertedTrainedSourceValidationSnapshot,
) -> io::Result<()> {
    // Extends the reviewed admission with the browser-verifiable source validation sidecar.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "source_validation_path",
        &converted_trained_source_validation_registry_path(candidate_id),
    );
    push_line(
        &mut admission,
        "source_validation_checksum",
        &source_validation.checksum,
    );
    fs::write(admission_path, admission)
}

fn converted_trained_source_review_snapshot(
    fields: &std::collections::HashMap<String, String>,
) -> io::Result<Option<ConvertedTrainedSourceReviewSnapshot>> {
    // Carries safetensors review evidence forward only when the copied source manifest has it.
    let keys = [
        "source_review_kind",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(None);
    }
    let kind = manifest_field(fields, "source_review_kind")?.to_string();
    let status = manifest_field(fields, "source_review_status")?.to_string();
    let checksum = manifest_field(fields, "source_review_checksum")?.to_string();
    let required_next_gate =
        manifest_field(fields, "source_review_required_next_gate")?.to_string();
    if kind != trained_source::SOURCE_REVIEW_KIND {
        return Err(invalid("converted-trained source review kind is invalid"));
    }
    if status != trained_source::SOURCE_REVIEW_STATUS {
        return Err(invalid("converted-trained source review status is invalid"));
    }
    validate_hex64_text(&checksum, "source_review_checksum")?;
    if required_next_gate != trained_source::SOURCE_REVIEW_REQUIRED_NEXT_GATE {
        return Err(invalid(
            "converted-trained source review required_next_gate is invalid",
        ));
    }
    Ok(Some(ConvertedTrainedSourceReviewSnapshot {
        kind,
        path: None,
        status,
        checksum,
        required_next_gate,
    }))
}

fn write_converted_trained_source_review_snapshot(
    evidence_dir: &Path,
    candidate_id: &str,
    source_review_path: Option<&Path>,
    source_manifest: &mut ConvertedTrainedSourceManifestSnapshot,
) -> io::Result<()> {
    // Copies a supplied safetensors review report into the served evidence route.
    let Some(source_review) = &mut source_manifest.source_review else {
        return Ok(());
    };
    let Some(source_review_path) = source_review_path else {
        return Ok(());
    };
    let target = evidence_dir.join("converted-trained.source.review");
    fs::copy(source_review_path, &target)?;
    let text = fs::read_to_string(&target)?;
    let checksum = hex64(provenance::text_checksum(text.as_bytes()));
    if checksum != source_review.checksum {
        return Err(invalid(
            "converted-trained source review sidecar checksum did not match source manifest",
        ));
    }
    source_review.path = Some(converted_trained_source_review_registry_path(candidate_id));
    Ok(())
}

fn append_converted_trained_eval_route(
    admission_path: &Path,
    candidate_id: &str,
) -> io::Result<()> {
    // Extends the reviewed admission with the browser-verifiable eval sidecar route.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "eval_path",
        &format!("../evidence/{candidate_id}/converted-trained.eval"),
    );
    fs::write(admission_path, admission)
}

fn append_converted_trained_runtime_smoke_route(
    admission_path: &Path,
    candidate_id: &str,
) -> io::Result<()> {
    // Extends the admission with the browser-verifiable runtime-smoke sidecar route.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "runtime_smoke_path",
        &format!("../evidence/{candidate_id}/converted-trained.runtime"),
    );
    fs::write(admission_path, admission)
}

fn converted_trained_source_manifest_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the copied source manifest evidence.
    format!("../evidence/{candidate_id}/converted-trained.source.manifest")
}

fn converted_trained_source_review_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the copied candidate-review evidence.
    format!("../evidence/{candidate_id}/converted-trained.source.review")
}

fn converted_trained_source_validation_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the source-validation evidence.
    format!("../evidence/{candidate_id}/converted-trained.source.validation")
}

fn converted_trained_admission_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the selector admission evidence.
    format!("../evidence/{candidate_id}/converted-trained.admission")
}

fn append_reviewed_eval_cases_route(
    eval_path: &Path,
    source_review_path: Option<&Path>,
) -> io::Result<()> {
    // Binds the browser-fetched eval sidecar back to the reviewed eval case route.
    let Some(source_review_path) = source_review_path else {
        return Ok(());
    };
    let review_text = fs::read_to_string(source_review_path)?;
    let review_fields = provenance::parse_manifest(&review_text)?;
    let eval_cases_route = manifest_field(&review_fields, "eval_cases_route")?;
    if eval_cases_route == "pending-eval-cases" {
        return Err(invalid(
            "converted-trained source review eval_cases_route is pending",
        ));
    }
    let mut eval_text = fs::read_to_string(eval_path)?;
    let eval_fields = provenance::parse_manifest(&eval_text)?;
    if let Some(existing) = eval_fields.get("eval_cases_route") {
        if existing != eval_cases_route {
            return Err(invalid(
                "converted-trained eval sidecar eval_cases_route does not match source review",
            ));
        }
        return Ok(());
    }
    if !eval_text.ends_with('\n') {
        eval_text.push('\n');
    }
    push_line(&mut eval_text, "eval_cases_route", eval_cases_route);
    fs::write(eval_path, eval_text)
}

fn converted_trained_quantizations(quantization: &str) -> io::Result<Vec<&'static str>> {
    // Expands the converted-trained CLI selector into one or all browser model entries.
    match quantization {
        "f32" => Ok(vec!["f32"]),
        "q8_0" => Ok(vec!["q8_0"]),
        "q4_0" => Ok(vec!["q4_0"]),
        "all" => Ok(vec!["f32", "q8_0", "q4_0"]),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "browser-converted-trained-bundle quantization must be f32, q8_0, q4_0, or all",
        )),
    }
}

pub(crate) fn validate_converted_trained_bundle_quantization(quantization: &str) -> io::Result<()> {
    // Lets source-intake bridges reject unsupported browser bundle selectors before writing files.
    converted_trained_quantizations(quantization).map(|_| ())
}

fn converted_trained_candidate_id(quantization: &str) -> io::Result<&'static str> {
    // Keeps generated browser model ids aligned with the quantization lane they stage.
    match quantization {
        "f32" => Ok("converted-trained-f32"),
        "q8_0" => Ok("converted-trained-q8"),
        "q4_0" => Ok("converted-trained-q4"),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "converted-trained candidate quantization must be f32, q8_0, or q4_0",
        )),
    }
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn validate_hex64_text(value: &str, label: &str) -> io::Result<()> {
    let Some(rest) = value.strip_prefix("0x") else {
        return Err(invalid(&format!("{label} is not a hex64 checksum")));
    };
    if rest.len() != 16 || !rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!("{label} is not a hex64 checksum")));
    }
    Ok(())
}

fn copy_browser_surface(root: &Path) -> io::Result<()> {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..");
    let app_source = source_root.join("app");
    let runtime_source = source_root.join("runtime");
    let app_target = root.join("app");
    let runtime_target = root.join("runtime");
    fs::create_dir_all(&app_target)?;
    fs::create_dir_all(&runtime_target)?;
    for file_name in APP_FILES {
        fs::copy(app_source.join(file_name), app_target.join(file_name))?;
    }
    let runtime_bytes = fs::read(runtime_source.join(RUNTIME_WASM_FILE))?;
    fs::write(runtime_target.join(RUNTIME_WASM_FILE), &runtime_bytes)?;
    fs::write(
        runtime_target.join(RUNTIME_WASM_MANIFEST_FILE),
        runtime_wasm_manifest_text(&runtime_bytes, "tinyrustlm.wasm"),
    )?;
    let simd_source = runtime_source.join(RUNTIME_WASM_SIMD_FILE);
    if simd_source.exists() {
        let simd_bytes = fs::read(&simd_source)?;
        fs::write(runtime_target.join(RUNTIME_WASM_SIMD_FILE), &simd_bytes)?;
        fs::write(
            runtime_target.join(RUNTIME_WASM_SIMD_MANIFEST_FILE),
            runtime_wasm_manifest_text(&simd_bytes, RUNTIME_WASM_SIMD_FILE),
        )?;
    }
    Ok(())
}

pub(crate) fn write_runtime_wasm_manifest_path(
    wasm_path: &Path,
    manifest_path: &Path,
) -> io::Result<()> {
    let runtime_bytes = fs::read(wasm_path)?;
    let file_name = wasm_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| invalid("runtime WASM path must end in a UTF-8 file name"))?;
    if !file_name.ends_with(".wasm")
        || !file_name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
    {
        return Err(invalid("runtime WASM file name is not route-safe"));
    }
    fs::write(
        manifest_path,
        runtime_wasm_manifest_text(&runtime_bytes, file_name),
    )
}

fn runtime_wasm_manifest_text(runtime_bytes: &[u8], file_name: &str) -> String {
    let mut text = String::new();
    push_line(&mut text, "tinyrustlm_wasm_manifest_version", "1");
    push_line(&mut text, "runtime_kind", RUNTIME_WASM_KIND);
    push_line(&mut text, "runtime_status", RUNTIME_WASM_STATUS);
    push_line(
        &mut text,
        "runtime_wasm_path",
        &format!("../runtime/{file_name}"),
    );
    push_line(
        &mut text,
        "runtime_wasm_bytes",
        &runtime_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "runtime_wasm_checksum",
        &hex64(provenance::text_checksum(runtime_bytes)),
    );
    push_line(&mut text, "required_next_gate", RUNTIME_WASM_NEXT_GATE);
    text
}

fn display_path(path: &Path) -> String {
    path.display().to_string()
}

fn manifest_field<'a>(
    fields: &'a std::collections::HashMap<String, String>,
    key: &str,
) -> io::Result<&'a str> {
    fields.get(key).map(String::as_str).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("manifest missing {key}"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tinyrustlm_runtime::active_composition::ActiveCompositionBundle;
    use tinyrustlm_runtime::content_identity::{ContentId, ExecutionBindings};
    use tinyrustlm_runtime::model::Model;

    fn write_base_composition_graphs(temp: &Path, source: &Path, quantization: &str) -> PathBuf {
        let graph_root = temp.join("composition-graphs");
        fs::create_dir_all(&graph_root).unwrap();
        for entry_quantization in converted_trained_quantizations(quantization).unwrap() {
            let candidate_id = converted_trained_candidate_id(entry_quantization).unwrap();
            let model_path = temp.join(format!("{candidate_id}.graph-source.slm"));
            trained_source::convert_trained_path(source, &model_path, entry_quantization).unwrap();
            let model_bytes = fs::read(&model_path).unwrap();
            let model = Model::load(&model_bytes).unwrap();
            let bindings =
                ExecutionBindings::new([0x33; 32], [0x44; 32], [0x55; 32], [0x66; 32], [0x77; 32])
                    .unwrap();
            let route =
                ContentId::parse_display(&format!("route-sha256-{}", "88".repeat(32))).unwrap();
            let bundle = ActiveCompositionBundle::build(&model, bindings, route, &[]).unwrap();
            fs::write(
                graph_root.join(format!("{candidate_id}.acg1")),
                bundle.bytes(),
            )
            .unwrap();
        }
        graph_root
    }

    #[test]
    fn writes_browser_converted_trained_bundle_from_source() {
        let temp = unique_dir("converted-trained");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();
        let graph_root = write_base_composition_graphs(&temp, &source, "q8_0");

        let error =
            write_converted_trained_bundle_path(&root, &source, &graph_root, "q8_0").unwrap_err();

        assert!(error
            .to_string()
            .contains("quality_gate_policy was fixture-exact-v1"));
        let manifest = fs::read_to_string(
            root.join("models")
                .join("converted-trained-q8.slm.manifest"),
        )
        .unwrap();
        assert!(manifest.contains("source_kind=converted-trained"));
        assert!(manifest.contains("quality_claim=runtime-compatible-not-quality-verified"));
        assert!(manifest.contains("trained_quality_claim=pending-evaluation"));
        assert!(root
            .join("models")
            .join("converted-trained-q8.slm")
            .exists());
        assert!(root
            .join("models")
            .join("converted-trained-q8.slm.acg1")
            .exists());
        assert!(!root
            .join("evidence")
            .join("converted-trained-q8")
            .join("converted-trained.admission")
            .exists());
        let eval = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.eval"),
        )
        .unwrap();
        assert!(eval.contains("quality_gate_policy=fixture-exact-v1"));
        let runtime = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.runtime"),
        )
        .unwrap();
        assert!(runtime.contains("gate=runtime-smoke"));
        assert!(runtime.contains("runtime_smoke_status=pass"));
        assert_converted_trained_source_manifest_snapshot(&root, "converted-trained-q8");
        assert!(root.join("app").join("app.js").exists());
        assert_runtime_manifest(&root);

        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn rejects_browser_converted_trained_bundle_when_runtime_eval_fails() {
        let temp = unique_dir("converted-trained-eval-fail");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        let eval_cases = temp.join("mismatched-eval-cases.txt");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();
        let graph_root = write_base_composition_graphs(&temp, &source, "q8_0");
        fs::write(
            &eval_cases,
            "tinyrustlm_eval_cases_version=1\nscope=tiny-fixture-runtime-eval-only\nquality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=Intentional mismatch for bundle admission test\ncase_count=1\ncase.0.prompt=hi\ncase.0.max_new_tokens=1\ncase.0.expected_text=not-e\ncase.0.required_result=exact\n",
        )
        .unwrap();

        let error = write_converted_trained_bundle_path_with_eval_cases(
            &root,
            &source,
            &graph_root,
            "q8_0",
            &eval_cases,
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("converted-trained browser bundle eval failed"));
        let eval = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.eval"),
        )
        .unwrap();
        assert!(eval.contains("eval_status=fail"));
        assert!(eval.contains("task_eval_status=fail"));
        assert!(eval.contains("case.0.status=fail"));
        assert!(!root
            .join("evidence")
            .join("converted-trained-q8")
            .join("converted-trained.admission")
            .exists());
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn rejects_browser_converted_trained_bundle_unknown_quantization() {
        let temp = unique_dir("converted-trained-quantization");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();

        let error = write_converted_trained_bundle_path(&root, &source, &root, "bf16").unwrap_err();

        assert!(error.to_string().contains(
            "browser-converted-trained-bundle quantization must be f32, q8_0, q4_0, or all"
        ));
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn writes_all_browser_converted_trained_bundle_from_source() {
        let temp = unique_dir("converted-trained-all");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();
        let graph_root = write_base_composition_graphs(&temp, &source, "all");

        let error =
            write_converted_trained_bundle_path(&root, &source, &graph_root, "all").unwrap_err();

        assert!(error
            .to_string()
            .contains("quality_gate_policy was fixture-exact-v1"));
        assert!(!root.join("models").join("selector.registry").exists());
        assert!(root
            .join("models")
            .join("converted-trained-f32.slm")
            .exists());
        assert!(!root
            .join("evidence")
            .join("converted-trained-f32")
            .join("converted-trained.admission")
            .exists());
        assert!(root.join("app").join("app.js").exists());
        assert_runtime_manifest(&root);

        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn writes_standalone_runtime_manifest() {
        let root = unique_dir("runtime-manifest");
        fs::create_dir_all(&root).unwrap();
        let wasm_path = root.join("tinyrustlm.wasm");
        let manifest_path = root.join("tinyrustlm.wasm.manifest");
        fs::write(&wasm_path, [0x00, 0x61, 0x73, 0x6d]).unwrap();

        write_runtime_wasm_manifest_path(&wasm_path, &manifest_path).unwrap();

        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("tinyrustlm_wasm_manifest_version=1"));
        assert!(manifest.contains("runtime_kind=tinyrustlm-rust-wasm"));
        assert!(manifest.contains("runtime_status=validated-local-runtime"));
        assert!(manifest.contains("runtime_wasm_path=../runtime/tinyrustlm.wasm"));
        assert!(manifest.contains("runtime_wasm_bytes=4"));
        assert!(manifest.contains(&format!(
            "runtime_wasm_checksum={}",
            hex64(provenance::text_checksum(&[0x00, 0x61, 0x73, 0x6d]))
        )));
        assert!(manifest.contains("required_next_gate=instantiate-wasm-runtime"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn standalone_runtime_manifest_binds_simd_artifact_route() {
        let root = unique_dir("runtime-simd-manifest");
        fs::create_dir_all(&root).unwrap();
        let wasm_path = root.join("tinyrustlm-simd.wasm");
        let manifest_path = root.join("tinyrustlm-simd.wasm.manifest");
        fs::write(&wasm_path, [0x00, 0x61, 0x73, 0x6d]).unwrap();

        write_runtime_wasm_manifest_path(&wasm_path, &manifest_path).unwrap();

        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("runtime_wasm_path=../runtime/tinyrustlm-simd.wasm"));

        fs::remove_dir_all(root).unwrap();
    }

    fn assert_converted_trained_source_manifest_snapshot(
        root: &Path,
        candidate_id: &str,
    ) -> String {
        // Confirms each browser evidence lane preserves the reviewed source manifest route.
        let source_manifest = fs::read_to_string(
            root.join("evidence")
                .join(candidate_id)
                .join("converted-trained.source.manifest"),
        )
        .unwrap();
        assert!(source_manifest.contains("tinyrustlm_trained_source_version=1"));
        assert!(source_manifest.contains("source_kind=trained-source-fixture"));
        assert!(source_manifest.contains("source_id=tinyrustlm-local-source-fixture"));
        assert!(source_manifest.contains("model_shape=tiny-fixture"));
        hex64(provenance::text_checksum(source_manifest.as_bytes()))
    }

    fn assert_runtime_manifest(root: &Path) {
        let wasm_path = root.join("runtime").join("tinyrustlm.wasm");
        let manifest_path = root.join("runtime").join("tinyrustlm.wasm.manifest");
        let wasm_bytes = fs::read(&wasm_path).unwrap();
        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("tinyrustlm_wasm_manifest_version=1"));
        assert!(manifest.contains("runtime_kind=tinyrustlm-rust-wasm"));
        assert!(manifest.contains("runtime_status=validated-local-runtime"));
        assert!(manifest.contains("runtime_wasm_path=../runtime/tinyrustlm.wasm"));
        assert!(manifest.contains(&format!("runtime_wasm_bytes={}", wasm_bytes.len())));
        assert!(manifest.contains(&format!(
            "runtime_wasm_checksum={}",
            hex64(provenance::text_checksum(&wasm_bytes))
        )));
        assert!(manifest.contains("required_next_gate=instantiate-wasm-runtime"));
    }

    fn unique_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-browser-bundle-{label}-{nanos}"))
    }
}
