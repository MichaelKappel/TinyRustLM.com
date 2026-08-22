//! Native replay of preregistered Qwen3 Template2 source-parity cases.

use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::ExitCode;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tinyrustlm_template2::{
    write_template, Message, Role, Template2, Template2Policy, QWEN3_TEMPLATE2_ARTIFACT_SHA256,
    TEMPLATE2_FORMAT_PROFILE_ID, TEMPLATE2_FORMAT_PROFILE_SHA256,
};

const MAXIMUM_JSON_BYTES: u64 = 32 * 1024 * 1024;
const MAXIMUM_SOURCE_CLOSURE_FILE_BYTES: u64 = 4 * 1024 * 1024;
const HASH_BUFFER_BYTES: usize = 1024 * 1024;
const RESULT_SCHEMA: &str = "tinyrustlm.qwen3_template2_parity_result.v1";
const PROFILE_SCHEMA: &str = "tinyrustlm.vnext.qwen-template2-parity-preregistration.v1";
const PROFILE_ID: &str = "tinyrustlm.qwen3-template2-source-parity/1";
const PROFILE_FILE: &str = "qwen-template2-parity-preregistration.v1.json";
const REGISTERED_AT_UTC: &str = "2026-08-22T10:30:00Z";
const REGISTRATION_PARENT_COMMIT: &str = "81a6d53844761d10c0eb1563b5420788c1772f8f";
const CORPUS_SCHEMA: &str = "tinyrustlm.qwen3_template2_parity_cases.v1";
const CORPUS_ID: &str = "qwen3-0.6b-template2-parity-1024-v1";
const SOURCE_LOCK_SCHEMA: &str = "tinyrustlm.qwen3_template2_source_lock.v1";
const SOURCE_LOCK_SHA256: &str = "22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660";
const SOURCE_TEMPLATE_SHA256: &str =
    "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8";
const MODEL_CONFIG_SHA256: &str =
    "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd";
const TOKENIZER_CONFIG_SHA256: &str =
    "d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101";
const TOKENIZER_ARTIFACT_SHA256: &str =
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Preregistration {
    schema: String,
    profile_id: String,
    status: String,
    registered_at_utc: String,
    registration_parent_commit: String,
    source: SourceBinding,
    artifact: ArtifactBinding,
    corpus: CorpusBinding,
    oracle: OracleBinding,
    candidate: CandidateBinding,
    execution: ExecutionBinding,
    acceptance: AcceptanceBinding,
    claim_boundary: ClaimBoundary,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SourceBinding {
    model_id: String,
    revision: String,
    source_lock_path: String,
    source_lock_byte_length: u64,
    source_lock_sha256: String,
    tokenizer_config_sha256: String,
    source_template_byte_length: u32,
    source_template_sha256: String,
    model_config_sha256: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ArtifactBinding {
    format_profile_id: String,
    format_profile_sha256: String,
    byte_length: u64,
    sha256: String,
    tokenizer_artifact_sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CorpusBinding {
    path: String,
    schema: String,
    corpus_id: String,
    generator_path: String,
    generator_sha256: String,
    byte_length: u64,
    sha256: String,
    case_count: u32,
    category_counts: BTreeMap<String, u32>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct OracleBinding {
    implementation: String,
    python_version: String,
    jinja_version: String,
    markup_safe_version: String,
    script_path: String,
    script_sha256: String,
    environment_lock_path: String,
    environment_lock_byte_length: u64,
    environment_lock_sha256: String,
    launcher_sha256: String,
    base_interpreter_sha256: String,
    source_closure_sha256: String,
    network_allowed: bool,
    child_process_allowed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CandidateBinding {
    implementation: String,
    version: String,
    runner_path: String,
    runner_sha256: String,
    source_closure_sha256: String,
    source_closure: Vec<SourceClosureEntry>,
    executable_basename: String,
    executable_byte_length: u64,
    executable_sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SourceClosureEntry {
    path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ExecutionBinding {
    tools: Option<serde_json::Value>,
    add_generation_prompt: bool,
    enable_thinking: bool,
    required_oracle_runs: u32,
    required_candidate_runs: u32,
    maximum_messages: u32,
    maximum_content_bytes_per_message: u32,
    maximum_total_content_bytes_per_case: u32,
    maximum_rendered_bytes_per_case: u32,
    maximum_result_bytes: u64,
    comparison: String,
    best_of_n: bool,
    repair: bool,
    output_location: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AcceptanceBinding {
    corpus_committed_before_observation: bool,
    source_lock_revalidated: bool,
    source_rehashed_after_observation: bool,
    environment_rehashed_after_observation: bool,
    candidate_executable_rehashed_after_observation: bool,
    artifact_recreated_after_observation: bool,
    exact_case_order_required: bool,
    exact_rendered_bytes_required: bool,
    repeated_oracle_bytes_required: bool,
    repeated_candidate_bytes_required: bool,
    every_case_required: bool,
    mismatch_is_fatal: bool,
    raw_outputs_preserved: bool,
    network_request_maximum: u32,
    child_process_maximum: u32,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ClaimBoundary {
    template_source_parity_may_be_claimed_after_pass: bool,
    browser_wasm_may_be_claimed: bool,
    model_runtime_may_be_claimed: bool,
    model_quality_may_be_claimed: bool,
    release_may_be_claimed: bool,
    campaign_credit_may_be_claimed: bool,
    required_next_gate: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Corpus {
    schema: String,
    corpus_id: String,
    generator_profile_id: String,
    generator_sha256: String,
    seed_hex: String,
    source_lock_sha256: String,
    template2_profile_sha256: String,
    template2_artifact_sha256: String,
    source_template_sha256: String,
    case_count: u32,
    category_counts: BTreeMap<String, u32>,
    maximum_messages_per_case: u32,
    maximum_content_bytes_per_message: u32,
    maximum_total_content_bytes_per_case: u32,
    expected_rendered_bytes_present: bool,
    cases: Vec<Case>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Case {
    case_id: String,
    category: String,
    messages: Vec<WireMessage>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct WireMessage {
    role: WireRole,
    content: String,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum WireRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SourceLock {
    schema: String,
    model_id: String,
    revision: String,
    source_kind: String,
    parent_tokenizer_source_lock: FileIdentity,
    files: SourceFiles,
    chat_template: ChatTemplateIdentity,
    supported_execution: SupportedExecution,
    unsupported_execution: Vec<String>,
    runtime_source_template_execution: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct FileIdentity {
    path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SourceFiles {
    config: FileIdentity,
    tokenizer_config: FileIdentity,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ChatTemplateIdentity {
    json_member: String,
    value_type: String,
    utf8_byte_length: u32,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SupportedExecution {
    tools: Option<serde_json::Value>,
    add_generation_prompt: bool,
    enable_thinking: bool,
    roles: Vec<String>,
    content: String,
    ordering: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EnvironmentLock {
    schema: String,
    profile_id: String,
    platform: String,
    python_version: String,
    launcher: EnvironmentLauncher,
    base_interpreter: BaseInterpreter,
    packages: Vec<EnvironmentPackage>,
    package_roots: Vec<String>,
    exclusions: Vec<String>,
    execution: EnvironmentExecution,
    source_closure_sha256: String,
    file_count: u32,
    files: Vec<EnvironmentFile>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EnvironmentLauncher {
    relative_path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct BaseInterpreter {
    basename: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EnvironmentPackage {
    name: String,
    version: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EnvironmentExecution {
    isolated_mode: bool,
    bytecode_writes: bool,
    dedicated_empty_pycache_prefix: bool,
    network_allowed: bool,
    child_process_allowed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EnvironmentFile {
    path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultDocument {
    schema: &'static str,
    implementation: ImplementationIdentity,
    preregistration: PreregistrationIdentity,
    source: ResultSource,
    artifact: ArtifactBinding,
    corpus: ResultCorpus,
    summary: ResultSummary,
    results: Vec<ResultCase>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImplementationIdentity {
    kind: &'static str,
    name: &'static str,
    version: String,
    executable_sha256: String,
    source_identity_sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreregistrationIdentity {
    profile_id: String,
    profile_sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultSource {
    model_id: String,
    revision: String,
    source_template_sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultCorpus {
    corpus_id: String,
    sha256: String,
    case_count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultSummary {
    case_count: u32,
    total_rendered_bytes: u64,
    maximum_rendered_bytes: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultCase {
    case_id: String,
    rendered_byte_length: u32,
    rendered_sha256: String,
    rendered_utf8_hex: String,
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(code) => {
            let _ = writeln!(
                std::io::stderr(),
                "Qwen Template2 native parity failed: {code}"
            );
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), &'static str> {
    let arguments = env::args_os().collect::<Vec<_>>();
    if arguments.len() != 6 {
        return Err("qwen-template2-native-arguments-invalid");
    }
    let profile_path = absolute_existing(Path::new(&arguments[1]))?;
    let cases_path = absolute_existing(Path::new(&arguments[2]))?;
    let source_lock_path = absolute_existing(Path::new(&arguments[3]))?;
    let environment_lock_path = absolute_existing(Path::new(&arguments[4]))?;
    let output_path = absolute_output(Path::new(&arguments[5]))?;
    if profile_path.file_name().and_then(|name| name.to_str()) != Some(PROFILE_FILE) {
        return Err("qwen-template2-native-profile-invalid");
    }

    let profile_bytes = read_bounded(
        &profile_path,
        1024 * 1024,
        "qwen-template2-native-profile-invalid",
    )?;
    let profile: Preregistration =
        deserialize_exact(&profile_bytes, "qwen-template2-native-profile-invalid")?;
    let repository_root = validate_profile(
        &profile,
        &profile_path,
        &cases_path,
        &source_lock_path,
        &environment_lock_path,
    )?;
    validate_source_lock(&profile, &source_lock_path)?;
    validate_environment_lock(&profile, &environment_lock_path)?;
    validate_source_closure(&profile, &repository_root)?;
    validate_executable(&profile)?;
    let profile_sha256 = hex_lower(&Sha256::digest(&profile_bytes));

    let cases_bytes = read_bounded(
        &cases_path,
        MAXIMUM_JSON_BYTES,
        "qwen-template2-native-corpus-invalid",
    )?;
    if cases_bytes.len() as u64 != profile.corpus.byte_length
        || hex_lower(&Sha256::digest(&cases_bytes)) != profile.corpus.sha256
    {
        return Err("qwen-template2-native-corpus-invalid");
    }
    let corpus: Corpus = deserialize_exact(&cases_bytes, "qwen-template2-native-corpus-invalid")?;
    validate_corpus(&corpus, &profile)?;

    let template = create_template(&profile)?;
    let (results, total_rendered_bytes, maximum_rendered_bytes) =
        render_cases(&template, &corpus, &profile)?;
    validate_source_lock(&profile, &source_lock_path)?;
    validate_environment_lock(&profile, &environment_lock_path)?;
    validate_source_closure(&profile, &repository_root)?;
    validate_executable(&profile)?;

    let executable = env::current_exe().map_err(|_| "qwen-template2-native-executable-invalid")?;
    let document = ResultDocument {
        schema: RESULT_SCHEMA,
        implementation: ImplementationIdentity {
            kind: "candidate",
            name: "tinyrustlm-template2",
            version: env!("CARGO_PKG_VERSION").to_owned(),
            executable_sha256: sha256_file(
                &executable,
                "qwen-template2-native-executable-invalid",
            )?,
            source_identity_sha256: profile.candidate.source_closure_sha256.clone(),
        },
        preregistration: PreregistrationIdentity {
            profile_id: profile.profile_id.clone(),
            profile_sha256,
        },
        source: ResultSource {
            model_id: profile.source.model_id.clone(),
            revision: profile.source.revision.clone(),
            source_template_sha256: profile.source.source_template_sha256.clone(),
        },
        artifact: ArtifactBinding {
            format_profile_id: profile.artifact.format_profile_id.clone(),
            format_profile_sha256: profile.artifact.format_profile_sha256.clone(),
            byte_length: profile.artifact.byte_length,
            sha256: profile.artifact.sha256.clone(),
            tokenizer_artifact_sha256: profile.artifact.tokenizer_artifact_sha256.clone(),
        },
        corpus: ResultCorpus {
            corpus_id: profile.corpus.corpus_id.clone(),
            sha256: profile.corpus.sha256.clone(),
            case_count: profile.corpus.case_count,
        },
        summary: ResultSummary {
            case_count: results.len() as u32,
            total_rendered_bytes,
            maximum_rendered_bytes,
        },
        results,
    };
    let mut output = serde_json::to_vec_pretty(&document)
        .map_err(|_| "qwen-template2-native-output-serialization-failed")?;
    output.push(b'\n');
    if output.len() as u64 > profile.execution.maximum_result_bytes {
        return Err("qwen-template2-native-output-limit");
    }
    write_create_only(&output_path, &output)?;
    println!(
        "{{\n  \"schema\": \"{RESULT_SCHEMA}\",\n  \"status\": \"candidate-output-created\",\n  \"caseCount\": {},\n  \"totalRenderedBytes\": {total_rendered_bytes},\n  \"maximumRenderedBytes\": {maximum_rendered_bytes},\n  \"outputSha256\": \"{}\"\n}}",
        document.summary.case_count,
        hex_lower(&Sha256::digest(&output))
    );
    Ok(())
}

fn validate_profile(
    profile: &Preregistration,
    profile_path: &Path,
    cases_path: &Path,
    source_lock_path: &Path,
    environment_lock_path: &Path,
) -> Result<PathBuf, &'static str> {
    if profile.schema != PROFILE_SCHEMA
        || profile.profile_id != PROFILE_ID
        || profile.status != "registered-before-comparative-output"
        || profile.registered_at_utc != REGISTERED_AT_UTC
        || profile.registration_parent_commit != REGISTRATION_PARENT_COMMIT
        || profile.source.model_id != "Qwen/Qwen3-0.6B"
        || profile.source.revision != "c1899de289a04d12100db370d81485cdf75e47ca"
        || profile.source.source_lock_path
            != "contracts/vnext/qwen3-0.6b-template2-source-lock.v1.json"
        || profile.source.source_lock_byte_length != 1_580
        || profile.source.source_lock_sha256 != SOURCE_LOCK_SHA256
        || profile.source.tokenizer_config_sha256 != TOKENIZER_CONFIG_SHA256
        || profile.source.source_template_byte_length != 4_168
        || profile.source.source_template_sha256 != SOURCE_TEMPLATE_SHA256
        || profile.source.model_config_sha256 != MODEL_CONFIG_SHA256
        || profile.artifact.format_profile_id != TEMPLATE2_FORMAT_PROFILE_ID
        || profile.artifact.format_profile_sha256 != TEMPLATE2_FORMAT_PROFILE_SHA256
        || profile.artifact.byte_length != 1_403
        || profile.artifact.sha256 != QWEN3_TEMPLATE2_ARTIFACT_SHA256
        || profile.artifact.tokenizer_artifact_sha256 != TOKENIZER_ARTIFACT_SHA256
        || profile.corpus.path != "contracts/vnext/qwen-template2-parity-cases.v1.json"
        || profile.corpus.schema != CORPUS_SCHEMA
        || profile.corpus.corpus_id != CORPUS_ID
        || profile.corpus.generator_path != "tinyrustlm/tools/qwen-template2-parity-corpus.js"
        || profile.corpus.case_count != 1_024
        || profile.oracle.implementation != "jinja2-immutable-sandbox"
        || profile.oracle.python_version != "3.12.10"
        || profile.oracle.jinja_version != "3.1.6"
        || profile.oracle.markup_safe_version != "3.0.3"
        || profile.oracle.script_path != "tinyrustlm/tools/qwen-template2-source-oracle.py"
        || profile.oracle.environment_lock_path
            != "contracts/vnext/template2-source-oracle-environment-lock.v1.json"
        || profile.oracle.network_allowed
        || profile.oracle.child_process_allowed
        || profile.candidate.implementation != "tinyrustlm-template2"
        || profile.candidate.version != env!("CARGO_PKG_VERSION")
        || profile.candidate.runner_path
            != "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs"
    {
        return Err("qwen-template2-native-profile-invalid");
    }
    validate_execution(profile)?;
    validate_claims(profile)?;
    for digest in [
        &profile.corpus.generator_sha256,
        &profile.corpus.sha256,
        &profile.oracle.script_sha256,
        &profile.oracle.environment_lock_sha256,
        &profile.oracle.launcher_sha256,
        &profile.oracle.base_interpreter_sha256,
        &profile.oracle.source_closure_sha256,
        &profile.candidate.runner_sha256,
        &profile.candidate.source_closure_sha256,
        &profile.candidate.executable_sha256,
    ] {
        validate_sha256(digest)?;
    }
    if profile.corpus.byte_length == 0
        || profile.oracle.environment_lock_byte_length == 0
        || profile.candidate.executable_byte_length == 0
        || profile.candidate.executable_basename != executable_basename()
    {
        return Err("qwen-template2-native-profile-invalid");
    }

    let root = repository_root(profile_path)?;
    for (supplied, relative, expected_length, expected_hash) in [
        (
            cases_path,
            profile.corpus.path.as_str(),
            profile.corpus.byte_length,
            profile.corpus.sha256.as_str(),
        ),
        (
            source_lock_path,
            profile.source.source_lock_path.as_str(),
            profile.source.source_lock_byte_length,
            profile.source.source_lock_sha256.as_str(),
        ),
        (
            environment_lock_path,
            profile.oracle.environment_lock_path.as_str(),
            profile.oracle.environment_lock_byte_length,
            profile.oracle.environment_lock_sha256.as_str(),
        ),
    ] {
        validate_relative_path(relative)?;
        let expected = fs::canonicalize(root.join(relative))
            .map_err(|_| "qwen-template2-native-profile-invalid")?;
        if supplied != expected
            || read_bounded(
                supplied,
                MAXIMUM_JSON_BYTES,
                "qwen-template2-native-input-invalid",
            )?
            .len() as u64
                != expected_length
            || sha256_file(supplied, "qwen-template2-native-input-invalid")? != expected_hash
        {
            return Err("qwen-template2-native-input-invalid");
        }
    }
    Ok(root)
}

fn validate_execution(profile: &Preregistration) -> Result<(), &'static str> {
    let execution = &profile.execution;
    let acceptance = &profile.acceptance;
    if execution.tools.is_some()
        || !execution.add_generation_prompt
        || execution.enable_thinking
        || execution.required_oracle_runs != 2
        || execution.required_candidate_runs != 2
        || execution.maximum_messages != 16
        || execution.maximum_content_bytes_per_message != 32_768
        || execution.maximum_total_content_bytes_per_case != 65_536
        || execution.maximum_rendered_bytes_per_case != 131_072
        || execution.maximum_result_bytes != 16 * 1024 * 1024
        || execution.comparison != "exact-rendered-utf8-bytes-and-case-order"
        || execution.best_of_n
        || execution.repair
        || execution.output_location != "private-external-create-only"
        || !acceptance.corpus_committed_before_observation
        || !acceptance.source_lock_revalidated
        || !acceptance.source_rehashed_after_observation
        || !acceptance.environment_rehashed_after_observation
        || !acceptance.candidate_executable_rehashed_after_observation
        || !acceptance.artifact_recreated_after_observation
        || !acceptance.exact_case_order_required
        || !acceptance.exact_rendered_bytes_required
        || !acceptance.repeated_oracle_bytes_required
        || !acceptance.repeated_candidate_bytes_required
        || !acceptance.every_case_required
        || !acceptance.mismatch_is_fatal
        || !acceptance.raw_outputs_preserved
        || acceptance.network_request_maximum != 0
        || acceptance.child_process_maximum != 0
    {
        return Err("qwen-template2-native-profile-invalid");
    }
    Ok(())
}

fn validate_claims(profile: &Preregistration) -> Result<(), &'static str> {
    let claims = &profile.claim_boundary;
    if !claims.template_source_parity_may_be_claimed_after_pass
        || claims.browser_wasm_may_be_claimed
        || claims.model_runtime_may_be_claimed
        || claims.model_quality_may_be_claimed
        || claims.release_may_be_claimed
        || claims.campaign_credit_may_be_claimed
        || claims.required_next_gate
            != "deterministic-sampling-profile-and-template2-wasm-composition-conformance"
    {
        return Err("qwen-template2-native-profile-invalid");
    }
    Ok(())
}

fn validate_source_lock(
    profile: &Preregistration,
    source_lock_path: &Path,
) -> Result<(), &'static str> {
    let bytes = read_bounded(
        source_lock_path,
        1024 * 1024,
        "qwen-template2-native-source-lock-invalid",
    )?;
    if bytes.len() as u64 != profile.source.source_lock_byte_length
        || hex_lower(&Sha256::digest(&bytes)) != profile.source.source_lock_sha256
    {
        return Err("qwen-template2-native-source-lock-invalid");
    }
    let lock: SourceLock = deserialize_exact(&bytes, "qwen-template2-native-source-lock-invalid")?;
    if lock.schema != SOURCE_LOCK_SCHEMA
        || lock.model_id != profile.source.model_id
        || lock.revision != profile.source.revision
        || lock.source_kind != "upstream-checkpoint"
        || lock.parent_tokenizer_source_lock.path
            != "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
        || lock.parent_tokenizer_source_lock.byte_length != 1_108
        || lock.parent_tokenizer_source_lock.sha256
            != "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"
        || lock.files.config.path != "config.json"
        || lock.files.config.byte_length != 726
        || lock.files.config.sha256 != MODEL_CONFIG_SHA256
        || lock.files.tokenizer_config.path != "tokenizer_config.json"
        || lock.files.tokenizer_config.byte_length != 9_732
        || lock.files.tokenizer_config.sha256 != TOKENIZER_CONFIG_SHA256
        || lock.chat_template.json_member != "chat_template"
        || lock.chat_template.value_type != "string"
        || lock.chat_template.utf8_byte_length != 4_168
        || lock.chat_template.sha256 != SOURCE_TEMPLATE_SHA256
        || lock.supported_execution.tools.is_some()
        || !lock.supported_execution.add_generation_prompt
        || lock.supported_execution.enable_thinking
        || lock.supported_execution.roles != ["system", "user", "assistant"]
        || lock.supported_execution.content
            != "string-only-with-all-tokenizer-added-control-literals-forbidden"
        || lock.supported_execution.ordering
            != "optional-leading-system-then-strict-user-assistant-alternation-ending-user"
        || lock.unsupported_execution
            != [
                "tools",
                "tool-role-messages",
                "tool-calls",
                "reasoning-content-fields",
                "thinking-enabled-generation",
                "render-without-generation-prompt",
                "non-string-content",
            ]
        || lock.runtime_source_template_execution
    {
        return Err("qwen-template2-native-source-lock-invalid");
    }
    Ok(())
}

fn validate_environment_lock(
    profile: &Preregistration,
    environment_lock_path: &Path,
) -> Result<(), &'static str> {
    let bytes = read_bounded(
        environment_lock_path,
        1024 * 1024,
        "qwen-template2-native-environment-lock-invalid",
    )?;
    if bytes.len() as u64 != profile.oracle.environment_lock_byte_length
        || hex_lower(&Sha256::digest(&bytes)) != profile.oracle.environment_lock_sha256
    {
        return Err("qwen-template2-native-environment-lock-invalid");
    }
    let lock: EnvironmentLock =
        deserialize_exact(&bytes, "qwen-template2-native-environment-lock-invalid")?;
    if lock.schema != "tinyrustlm.template2_source_oracle_environment_lock.v1"
        || lock.profile_id != "tinyrustlm.template2-source-oracle-python/1"
        || lock.platform != "win-x64"
        || lock.python_version != profile.oracle.python_version
        || lock.launcher.relative_path != "Scripts/python.exe"
        || lock.launcher.byte_length != 274_424
        || lock.launcher.sha256 != profile.oracle.launcher_sha256
        || lock.base_interpreter.basename != "python.exe"
        || lock.base_interpreter.byte_length != 104_952
        || lock.base_interpreter.sha256 != profile.oracle.base_interpreter_sha256
        || lock.packages.len() != 2
        || lock.packages[0].name != "Jinja2"
        || lock.packages[0].version != profile.oracle.jinja_version
        || lock.packages[1].name != "MarkupSafe"
        || lock.packages[1].version != profile.oracle.markup_safe_version
        || lock.package_roots
            != [
                "Lib/site-packages/jinja2",
                "Lib/site-packages/jinja2-3.1.6.dist-info",
                "Lib/site-packages/markupsafe",
                "Lib/site-packages/markupsafe-3.0.3.dist-info",
            ]
        || lock.exclusions != ["__pycache__-directories", "pyc-files"]
        || !lock.execution.isolated_mode
        || lock.execution.bytecode_writes
        || !lock.execution.dedicated_empty_pycache_prefix
        || lock.execution.network_allowed
        || lock.execution.child_process_allowed
        || lock.source_closure_sha256 != profile.oracle.source_closure_sha256
        || lock.file_count != 44
        || lock.files.len() != 44
    {
        return Err("qwen-template2-native-environment-lock-invalid");
    }
    validate_environment_closure(&lock)
}

fn validate_environment_closure(lock: &EnvironmentLock) -> Result<(), &'static str> {
    let mut previous = None::<&str>;
    let mut canonical = Vec::new();
    for entry in &lock.files {
        validate_relative_path(&entry.path)?;
        validate_sha256(&entry.sha256)?;
        if previous.is_some_and(|value| value >= entry.path.as_str()) {
            return Err("qwen-template2-native-environment-lock-invalid");
        }
        previous = Some(&entry.path);
        canonical.extend_from_slice(entry.path.as_bytes());
        canonical.push(0);
        canonical.extend_from_slice(entry.byte_length.to_string().as_bytes());
        canonical.push(0);
        canonical.extend_from_slice(entry.sha256.as_bytes());
        canonical.push(b'\n');
    }
    if hex_lower(&Sha256::digest(&canonical)) != lock.source_closure_sha256 {
        return Err("qwen-template2-native-environment-lock-invalid");
    }
    Ok(())
}

fn validate_source_closure(
    profile: &Preregistration,
    repository_root: &Path,
) -> Result<(), &'static str> {
    const REQUIRED_PATHS: [&str; 7] = [
        "Cargo.lock",
        "Cargo.toml",
        "contracts/vnext/template2-format-profile.v1.json",
        "rust/crates/tinyrustlm-template2/Cargo.toml",
        "rust/crates/tinyrustlm-template2/examples/qwen_template2_parity.rs",
        "rust/crates/tinyrustlm-template2/src/format.rs",
        "rust/crates/tinyrustlm-template2/src/lib.rs",
    ];
    const REQUIRED_RUNTIME_PATH: &str = "rust/crates/tinyrustlm-template2/src/runtime.rs";
    if profile.candidate.source_closure.len() != REQUIRED_PATHS.len() + 1 {
        return Err("qwen-template2-native-source-closure-invalid");
    }
    let mut previous = None::<&str>;
    let mut canonical = Vec::new();
    let mut paths = Vec::with_capacity(profile.candidate.source_closure.len());
    let mut runner_seen = false;
    for entry in &profile.candidate.source_closure {
        validate_relative_path(&entry.path)?;
        validate_sha256(&entry.sha256)?;
        if previous.is_some_and(|value| value >= entry.path.as_str()) {
            return Err("qwen-template2-native-source-closure-invalid");
        }
        previous = Some(&entry.path);
        let bytes = read_bounded(
            &repository_root.join(&entry.path),
            MAXIMUM_SOURCE_CLOSURE_FILE_BYTES,
            "qwen-template2-native-source-closure-invalid",
        )?;
        if bytes.len() as u64 != entry.byte_length
            || hex_lower(&Sha256::digest(&bytes)) != entry.sha256
        {
            return Err("qwen-template2-native-source-closure-invalid");
        }
        paths.push(entry.path.as_str());
        runner_seen |= entry.path == profile.candidate.runner_path
            && entry.sha256 == profile.candidate.runner_sha256;
        canonical.extend_from_slice(entry.path.as_bytes());
        canonical.push(0);
        canonical.extend_from_slice(entry.byte_length.to_string().as_bytes());
        canonical.push(0);
        canonical.extend_from_slice(entry.sha256.as_bytes());
        canonical.push(b'\n');
    }
    let mut required = REQUIRED_PATHS.to_vec();
    required.push(REQUIRED_RUNTIME_PATH);
    required.sort_unstable();
    if paths != required
        || !runner_seen
        || hex_lower(&Sha256::digest(&canonical)) != profile.candidate.source_closure_sha256
    {
        return Err("qwen-template2-native-source-closure-invalid");
    }
    Ok(())
}

fn validate_executable(profile: &Preregistration) -> Result<(), &'static str> {
    let executable = env::current_exe().map_err(|_| "qwen-template2-native-executable-invalid")?;
    let executable =
        fs::canonicalize(executable).map_err(|_| "qwen-template2-native-executable-invalid")?;
    if executable.file_name().and_then(|name| name.to_str())
        != Some(profile.candidate.executable_basename.as_str())
        || read_bounded(
            &executable,
            64 * 1024 * 1024,
            "qwen-template2-native-executable-invalid",
        )?
        .len() as u64
            != profile.candidate.executable_byte_length
        || sha256_file(&executable, "qwen-template2-native-executable-invalid")?
            != profile.candidate.executable_sha256
    {
        return Err("qwen-template2-native-executable-invalid");
    }
    Ok(())
}

fn validate_corpus(corpus: &Corpus, profile: &Preregistration) -> Result<(), &'static str> {
    if corpus.schema != CORPUS_SCHEMA
        || corpus.corpus_id != CORPUS_ID
        || corpus.generator_profile_id != "tinyrustlm.qwen3-template2-parity-corpus/1"
        || corpus.generator_sha256 != profile.corpus.generator_sha256
        || corpus.seed_hex != "6115e5fc9bd68e4045529cb12f3088398fa91005572b6c92c9fe17c6627e4e99"
        || corpus.source_lock_sha256 != SOURCE_LOCK_SHA256
        || corpus.template2_profile_sha256 != TEMPLATE2_FORMAT_PROFILE_SHA256
        || corpus.template2_artifact_sha256 != QWEN3_TEMPLATE2_ARTIFACT_SHA256
        || corpus.source_template_sha256 != SOURCE_TEMPLATE_SHA256
        || corpus.case_count != 1_024
        || corpus.case_count as usize != corpus.cases.len()
        || corpus.category_counts != expected_category_counts()
        || corpus.category_counts != profile.corpus.category_counts
        || corpus.maximum_messages_per_case != profile.execution.maximum_messages
        || corpus.maximum_content_bytes_per_message
            != profile.execution.maximum_content_bytes_per_message
        || corpus.maximum_total_content_bytes_per_case
            != profile.execution.maximum_total_content_bytes_per_case
        || corpus.expected_rendered_bytes_present
    {
        return Err("qwen-template2-native-corpus-invalid");
    }
    let mut ids = HashSet::with_capacity(corpus.cases.len());
    let mut counts = BTreeMap::new();
    for case in &corpus.cases {
        if case.case_id.is_empty()
            || case.category.is_empty()
            || !ids.insert(case.case_id.as_str())
            || case.messages.is_empty()
            || case.messages.len() > profile.execution.maximum_messages as usize
        {
            return Err("qwen-template2-native-corpus-invalid");
        }
        *counts.entry(case.category.clone()).or_insert(0_u32) += 1;
        validate_message_sequence(case, profile)?;
    }
    if counts != corpus.category_counts {
        return Err("qwen-template2-native-corpus-invalid");
    }
    Ok(())
}

fn validate_message_sequence(case: &Case, profile: &Preregistration) -> Result<(), &'static str> {
    let mut conversational_index = 0_usize;
    let mut total_content_bytes = 0_u32;
    for (index, message) in case.messages.iter().enumerate() {
        let expected = if index == 0 && matches!(message.role, WireRole::System) {
            WireRole::System
        } else {
            let role = if conversational_index.is_multiple_of(2) {
                WireRole::User
            } else {
                WireRole::Assistant
            };
            conversational_index += 1;
            role
        };
        if std::mem::discriminant(&message.role) != std::mem::discriminant(&expected) {
            return Err("qwen-template2-native-corpus-invalid");
        }
        let length = u32::try_from(message.content.len())
            .map_err(|_| "qwen-template2-native-corpus-invalid")?;
        if length > profile.execution.maximum_content_bytes_per_message {
            return Err("qwen-template2-native-corpus-invalid");
        }
        total_content_bytes = total_content_bytes
            .checked_add(length)
            .ok_or("qwen-template2-native-corpus-invalid")?;
    }
    if !matches!(
        case.messages.last().map(|message| message.role),
        Some(WireRole::User)
    ) || total_content_bytes > profile.execution.maximum_total_content_bytes_per_case
    {
        return Err("qwen-template2-native-corpus-invalid");
    }
    Ok(())
}

fn expected_category_counts() -> BTreeMap<String, u32> {
    [
        ("bounded-long-content", 64),
        ("empty-content", 32),
        ("fixed-contract", 32),
        ("multi-turn", 256),
        ("multilingual-unicode", 128),
        ("ordinary-single-turn", 224),
        ("system-single-turn", 128),
        ("template-syntax-data", 64),
        ("whitespace-line-ending", 96),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_owned(), value))
    .collect()
}

fn create_template(profile: &Preregistration) -> Result<Template2, &'static str> {
    let mut bytes = Vec::new();
    let identity = write_template(&mut bytes).map_err(|_| "qwen-template2-native-artifact")?;
    if identity.byte_length != profile.artifact.byte_length
        || hex_lower(&identity.sha256) != profile.artifact.sha256
        || bytes.len() as u64 != profile.artifact.byte_length
        || hex_lower(&Sha256::digest(&bytes)) != profile.artifact.sha256
    {
        return Err("qwen-template2-native-artifact");
    }
    Template2::from_bytes(bytes, Template2Policy::exact_profile_limits())
        .map_err(|_| "qwen-template2-native-artifact")
}

fn render_cases(
    template: &Template2,
    corpus: &Corpus,
    profile: &Preregistration,
) -> Result<(Vec<ResultCase>, u64, u32), &'static str> {
    let mut results = Vec::with_capacity(corpus.cases.len());
    let mut total_rendered_bytes = 0_u64;
    let mut maximum_rendered_bytes = 0_u32;
    for case in &corpus.cases {
        let messages = case
            .messages
            .iter()
            .map(|message| Message {
                role: match message.role {
                    WireRole::System => Role::System,
                    WireRole::User => Role::User,
                    WireRole::Assistant => Role::Assistant,
                },
                content: &message.content,
            })
            .collect::<Vec<_>>();
        let rendered = template
            .render(&messages)
            .map_err(|_| "qwen-template2-native-render")?;
        let length = u32::try_from(rendered.as_bytes().len())
            .map_err(|_| "qwen-template2-native-output-limit")?;
        if length > profile.execution.maximum_rendered_bytes_per_case {
            return Err("qwen-template2-native-output-limit");
        }
        total_rendered_bytes = total_rendered_bytes
            .checked_add(u64::from(length))
            .ok_or("qwen-template2-native-output-limit")?;
        maximum_rendered_bytes = maximum_rendered_bytes.max(length);
        results.push(ResultCase {
            case_id: case.case_id.clone(),
            rendered_byte_length: length,
            rendered_sha256: hex_lower(&Sha256::digest(rendered.as_bytes())),
            rendered_utf8_hex: hex_lower(rendered.as_bytes()),
        });
    }
    Ok((results, total_rendered_bytes, maximum_rendered_bytes))
}

fn repository_root(profile_path: &Path) -> Result<PathBuf, &'static str> {
    let vnext = profile_path
        .parent()
        .ok_or("qwen-template2-native-profile-invalid")?;
    let contracts = vnext
        .parent()
        .ok_or("qwen-template2-native-profile-invalid")?;
    let root = contracts
        .parent()
        .ok_or("qwen-template2-native-profile-invalid")?;
    if vnext.file_name().and_then(|name| name.to_str()) != Some("vnext")
        || contracts.file_name().and_then(|name| name.to_str()) != Some("contracts")
    {
        return Err("qwen-template2-native-profile-invalid");
    }
    fs::canonicalize(root).map_err(|_| "qwen-template2-native-profile-invalid")
}

fn validate_relative_path(value: &str) -> Result<(), &'static str> {
    let path = Path::new(value);
    if value.is_empty()
        || value.contains('\\')
        || path.is_absolute()
        || path.components().any(|component| {
            !matches!(component, Component::Normal(_)) || component.as_os_str().to_str().is_none()
        })
    {
        return Err("qwen-template2-native-path-invalid");
    }
    Ok(())
}

fn validate_sha256(value: &str) -> Result<(), &'static str> {
    if value.len() != 64
        || value
            .bytes()
            .any(|byte| !matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
        || value.bytes().all(|byte| byte == b'0')
    {
        return Err("qwen-template2-native-digest-invalid");
    }
    Ok(())
}

fn executable_basename() -> &'static str {
    if cfg!(windows) {
        "qwen_template2_parity.exe"
    } else {
        "qwen_template2_parity"
    }
}

fn deserialize_exact<T: for<'de> Deserialize<'de>>(
    bytes: &[u8],
    code: &'static str,
) -> Result<T, &'static str> {
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let value = T::deserialize(&mut deserializer).map_err(|_| code)?;
    deserializer.end().map_err(|_| code)?;
    Ok(value)
}

fn absolute_existing(path: &Path) -> Result<PathBuf, &'static str> {
    if !path.is_absolute() {
        return Err("qwen-template2-native-input-path-invalid");
    }
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "qwen-template2-native-input-path-invalid")?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err("qwen-template2-native-input-path-invalid");
    }
    fs::canonicalize(path).map_err(|_| "qwen-template2-native-input-path-invalid")
}

fn absolute_output(path: &Path) -> Result<PathBuf, &'static str> {
    if !path.is_absolute() || path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err("qwen-template2-native-output-path-invalid");
    }
    let parent = path
        .parent()
        .ok_or("qwen-template2-native-output-path-invalid")?;
    let parent_metadata =
        fs::symlink_metadata(parent).map_err(|_| "qwen-template2-native-output-path-invalid")?;
    if !parent_metadata.file_type().is_dir() || parent_metadata.file_type().is_symlink() {
        return Err("qwen-template2-native-output-path-invalid");
    }
    let parent =
        fs::canonicalize(parent).map_err(|_| "qwen-template2-native-output-path-invalid")?;
    let name = path
        .file_name()
        .ok_or("qwen-template2-native-output-path-invalid")?;
    Ok(parent.join(name))
}

fn read_bounded(path: &Path, maximum: u64, code: &'static str) -> Result<Vec<u8>, &'static str> {
    let metadata = fs::symlink_metadata(path).map_err(|_| code)?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(code);
    }
    let length = metadata.len();
    if length == 0 || length > maximum || length > usize::MAX as u64 {
        return Err(code);
    }
    fs::read(path).map_err(|_| code)
}

fn sha256_file(path: &Path, code: &'static str) -> Result<String, &'static str> {
    let metadata = fs::symlink_metadata(path).map_err(|_| code)?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(code);
    }
    let mut file = File::open(path).map_err(|_| code)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    loop {
        let count = file.read(&mut buffer).map_err(|_| code)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex_lower(&hasher.finalize()))
}

fn write_create_only(path: &Path, bytes: &[u8]) -> Result<(), &'static str> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "qwen-template2-native-output-create-failed")?;
    file.write_all(bytes)
        .map_err(|_| "qwen-template2-native-output-write-failed")?;
    file.sync_all()
        .map_err(|_| "qwen-template2-native-output-flush-failed")
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
