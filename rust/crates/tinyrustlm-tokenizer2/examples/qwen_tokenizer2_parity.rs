//! Native replay of preregistered Qwen Tokenizer2 source-parity cases.

use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::ExitCode;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tinyrustlm_tokenizer2::{
    DecodeMode, Tokenizer2, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID,
};

const MAXIMUM_JSON_BYTES: u64 = 64 * 1024 * 1024;
const HASH_BUFFER_BYTES: usize = 1024 * 1024;
const RESULT_SCHEMA: &str = "tinyrustlm.qwen_tokenizer2_parity_result.v1";
const PROFILE_SCHEMA: &str = "tinyrustlm.vnext.qwen-tokenizer2-parity-preregistration.v1";
const PROFILE_ID: &str = "tinyrustlm.qwen-tokenizer2-source-parity/1";
const PROFILE_FILE: &str = "qwen-tokenizer2-parity-preregistration.v1.json";
const CORPUS_SCHEMA: &str = "tinyrustlm.qwen_tokenizer2_parity_cases.v1";
const CORPUS_ID: &str = "qwen3-0.6b-tokenizer2-parity-2048-v1";
const SOURCE_LOCK_SHA256: &str = "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70";
const ARTIFACT_SHA256: &str = "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceBinding {
    model_id: String,
    revision: String,
    source_lock_path: String,
    source_lock_sha256: String,
    tokenizer_path: String,
    tokenizer_sha256: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ArtifactBinding {
    format_profile_id: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OracleBinding {
    implementation: String,
    version: String,
    source_revision: String,
    script_path: String,
    script_sha256: String,
    python_version: String,
    python_executable_sha256: String,
    wheel_file: String,
    wheel_sha256: String,
    environment_lock_sha256: String,
    network_allowed: bool,
    child_process_allowed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CandidateBinding {
    implementation: String,
    version: String,
    runner_path: String,
    runner_sha256: String,
    source_closure_sha256: String,
    source_closure: Vec<SourceClosureEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceClosureEntry {
    path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExecutionBinding {
    add_special_tokens: bool,
    decode_modes: Vec<String>,
    required_oracle_runs: u32,
    required_candidate_runs: u32,
    maximum_input_bytes: u32,
    maximum_output_tokens: u32,
    maximum_decoded_bytes: u32,
    comparison: String,
    best_of_n: bool,
    repair: bool,
    output_location: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AcceptanceBinding {
    corpus_committed_before_observation: bool,
    source_lock_revalidated: bool,
    source_rehashed_after_observation: bool,
    exact_case_order_required: bool,
    exact_token_ids_required: bool,
    exact_include_all_decode_required: bool,
    exact_skip_special_decode_required: bool,
    repeated_oracle_bytes_required: bool,
    repeated_candidate_bytes_required: bool,
    every_case_required: bool,
    mismatch_is_fatal: bool,
    raw_outputs_preserved: bool,
    network_request_maximum: u32,
    child_process_maximum: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ClaimBoundary {
    tokenizer_source_parity_may_be_claimed_after_pass: bool,
    browser_wasm_may_be_claimed: bool,
    model_runtime_may_be_claimed: bool,
    model_quality_may_be_claimed: bool,
    release_may_be_claimed: bool,
    campaign_credit_may_be_claimed: bool,
    required_next_gate: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusDocument {
    schema: String,
    corpus_id: String,
    generator_profile_id: String,
    seed_hex: String,
    source_lock_sha256: String,
    tokenizer_artifact_sha256: String,
    case_count: u32,
    category_counts: BTreeMap<String, u32>,
    cases: Vec<ParityCase>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ParityCase {
    case_id: String,
    category: String,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultDocument {
    schema: &'static str,
    implementation: ImplementationIdentity,
    preregistration: PreregistrationIdentity,
    source: ResultSource,
    artifact: ResultArtifact,
    corpus: ResultCorpus,
    summary: ResultSummary,
    results: Vec<CaseResult>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImplementationIdentity {
    kind: &'static str,
    name: &'static str,
    version: String,
    executable_sha256: String,
    source_identity_sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreregistrationIdentity {
    profile_id: String,
    profile_sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultSource {
    model_id: String,
    revision: String,
    tokenizer_sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultArtifact {
    format_profile_id: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultCorpus {
    corpus_id: String,
    sha256: String,
    case_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResultSummary {
    case_count: u32,
    total_token_count: u64,
    maximum_token_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseResult {
    case_id: String,
    token_ids: Vec<u32>,
    decode_include_all: String,
    decode_skip_special: String,
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(code) => {
            let _ = writeln!(
                std::io::stderr(),
                "Qwen Tokenizer2 native parity failed: {code}"
            );
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), &'static str> {
    let arguments = env::args_os().collect::<Vec<_>>();
    if arguments.len() != 5 {
        return Err("qwen-tokenizer2-native-arguments-invalid");
    }
    let profile_path = absolute_existing(Path::new(&arguments[1]))?;
    let cases_path = absolute_existing(Path::new(&arguments[2]))?;
    let artifact_path = absolute_existing(Path::new(&arguments[3]))?;
    let output_path = absolute_output(Path::new(&arguments[4]))?;
    if profile_path.file_name().and_then(|name| name.to_str()) != Some(PROFILE_FILE) {
        return Err("qwen-tokenizer2-native-profile-invalid");
    }

    let profile_bytes = read_bounded(
        &profile_path,
        1024 * 1024,
        "qwen-tokenizer2-native-profile-invalid",
    )?;
    let profile: Preregistration =
        deserialize_exact(&profile_bytes, "qwen-tokenizer2-native-profile-invalid")?;
    validate_profile(&profile, &profile_path, &cases_path)?;
    let profile_sha256 = hex_lower(&Sha256::digest(&profile_bytes));

    let cases_bytes = read_bounded(
        &cases_path,
        MAXIMUM_JSON_BYTES,
        "qwen-tokenizer2-native-corpus-invalid",
    )?;
    if cases_bytes.len() as u64 != profile.corpus.byte_length
        || hex_lower(&Sha256::digest(&cases_bytes)) != profile.corpus.sha256
    {
        return Err("qwen-tokenizer2-native-corpus-invalid");
    }
    let corpus: CorpusDocument =
        deserialize_exact(&cases_bytes, "qwen-tokenizer2-native-corpus-invalid")?;
    validate_corpus(&corpus, &profile)?;

    let artifact = read_bounded(
        &artifact_path,
        profile.artifact.byte_length,
        "qwen-tokenizer2-native-artifact-invalid",
    )?;
    if artifact.len() as u64 != profile.artifact.byte_length
        || hex_lower(&Sha256::digest(&artifact)) != profile.artifact.sha256
    {
        return Err("qwen-tokenizer2-native-artifact-invalid");
    }
    let policy = TokenizerPolicy::new(
        profile.artifact.byte_length,
        profile.execution.maximum_input_bytes,
        profile.execution.maximum_output_tokens,
        profile.execution.maximum_decoded_bytes,
    )
    .map_err(|_| "qwen-tokenizer2-native-policy-invalid")?;
    let tokenizer = Tokenizer2::from_bytes(artifact, policy)
        .map_err(|_| "qwen-tokenizer2-native-artifact-invalid")?;

    let mut results = Vec::with_capacity(corpus.cases.len());
    let mut total_token_count = 0_u64;
    let mut maximum_token_count = 0_u32;
    for case in corpus.cases {
        let mut token_ids = Vec::new();
        tokenizer
            .encode(&case.text, &mut token_ids)
            .map_err(|_| "qwen-tokenizer2-native-execution-failed")?;
        let mut decode_include_all = String::new();
        tokenizer
            .decode(&token_ids, DecodeMode::IncludeAll, &mut decode_include_all)
            .map_err(|_| "qwen-tokenizer2-native-execution-failed")?;
        let mut decode_skip_special = String::new();
        tokenizer
            .decode(
                &token_ids,
                DecodeMode::SkipSpecial,
                &mut decode_skip_special,
            )
            .map_err(|_| "qwen-tokenizer2-native-execution-failed")?;
        total_token_count = total_token_count
            .checked_add(token_ids.len() as u64)
            .ok_or("qwen-tokenizer2-native-output-limit")?;
        maximum_token_count = maximum_token_count.max(token_ids.len() as u32);
        results.push(CaseResult {
            case_id: case.case_id,
            token_ids,
            decode_include_all,
            decode_skip_special,
        });
    }

    let executable = env::current_exe().map_err(|_| "qwen-tokenizer2-native-executable-invalid")?;
    let document = ResultDocument {
        schema: RESULT_SCHEMA,
        implementation: ImplementationIdentity {
            kind: "candidate",
            name: "tinyrustlm-tokenizer2",
            version: env!("CARGO_PKG_VERSION").to_owned(),
            executable_sha256: sha256_file(
                &executable,
                "qwen-tokenizer2-native-executable-invalid",
            )?,
            source_identity_sha256: profile.candidate.source_closure_sha256.clone(),
        },
        preregistration: PreregistrationIdentity {
            profile_id: profile.profile_id,
            profile_sha256,
        },
        source: ResultSource {
            model_id: profile.source.model_id,
            revision: profile.source.revision,
            tokenizer_sha256: profile.source.tokenizer_sha256,
        },
        artifact: ResultArtifact {
            format_profile_id: profile.artifact.format_profile_id,
            byte_length: profile.artifact.byte_length,
            sha256: profile.artifact.sha256,
        },
        corpus: ResultCorpus {
            corpus_id: profile.corpus.corpus_id,
            sha256: profile.corpus.sha256,
            case_count: profile.corpus.case_count,
        },
        summary: ResultSummary {
            case_count: results.len() as u32,
            total_token_count,
            maximum_token_count,
        },
        results,
    };
    let mut output = serde_json::to_vec_pretty(&document)
        .map_err(|_| "qwen-tokenizer2-native-output-serialization-failed")?;
    output.push(b'\n');
    if output.len() as u64 > MAXIMUM_JSON_BYTES {
        return Err("qwen-tokenizer2-native-output-limit");
    }
    write_create_only(&output_path, &output)?;
    println!(
        "{{\n  \"schema\": \"{RESULT_SCHEMA}\",\n  \"status\": \"candidate-output-created\",\n  \"caseCount\": {},\n  \"totalTokenCount\": {total_token_count},\n  \"maximumTokenCount\": {maximum_token_count},\n  \"outputSha256\": \"{}\"\n}}",
        document.summary.case_count,
        hex_lower(&Sha256::digest(&output))
    );
    Ok(())
}

fn validate_profile(
    profile: &Preregistration,
    profile_path: &Path,
    cases_path: &Path,
) -> Result<(), &'static str> {
    if profile.schema != PROFILE_SCHEMA
        || profile.profile_id != PROFILE_ID
        || profile.status != "registered-before-comparative-output"
        || profile.registered_at_utc != "2026-08-21T07:00:00Z"
        || profile.registration_parent_commit != "8210bda0614ef0b9237327d36d05e08f34c799df"
        || profile.source.source_lock_sha256 != SOURCE_LOCK_SHA256
        || profile.source.source_lock_path
            != "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
        || profile.source.tokenizer_path != "tokenizer.json"
        || profile.artifact.format_profile_id != TOKENIZER2_FORMAT_PROFILE_ID
        || profile.artifact.byte_length != 7_038_773
        || profile.artifact.sha256 != ARTIFACT_SHA256
        || profile.corpus.path != "contracts/vnext/qwen-tokenizer2-parity-cases.v1.json"
        || profile.corpus.schema != CORPUS_SCHEMA
        || profile.corpus.corpus_id != CORPUS_ID
        || profile.corpus.case_count != 2048
        || profile.candidate.implementation != "tinyrustlm-tokenizer2"
        || profile.candidate.version != env!("CARGO_PKG_VERSION")
        || profile.candidate.runner_path
            != "rust/crates/tinyrustlm-tokenizer2/examples/qwen_tokenizer2_parity.rs"
        || profile.execution.add_special_tokens
        || profile.execution.decode_modes != ["include-all", "skip-special"]
        || profile.execution.required_oracle_runs != 2
        || profile.execution.required_candidate_runs != 2
        || profile.execution.comparison != "exact-token-ids-and-exact-decoded-unicode"
        || profile.execution.best_of_n
        || profile.execution.repair
        || profile.execution.output_location != "private-external-create-only"
    {
        return Err("qwen-tokenizer2-native-profile-invalid");
    }
    validate_inert_profile_fields(profile)?;
    let root = repository_root(profile_path)?;
    let expected_cases = root.join(&profile.corpus.path);
    if fs::canonicalize(cases_path).ok() != fs::canonicalize(expected_cases).ok() {
        return Err("qwen-tokenizer2-native-corpus-invalid");
    }
    validate_source_closure(profile, &root)
}

fn validate_inert_profile_fields(profile: &Preregistration) -> Result<(), &'static str> {
    let oracle = &profile.oracle;
    let acceptance = &profile.acceptance;
    let claims = &profile.claim_boundary;
    if oracle.implementation != "huggingface-tokenizers"
        || oracle.version != "0.22.2"
        || oracle.source_revision != "f383101a26663708484cac0727792aad74f78234"
        || oracle.script_path != "tinyrustlm/tools/qwen-tokenizer2-source-oracle.py"
        || oracle.script_sha256.len() != 64
        || oracle.python_version != "3.12.10"
        || oracle.python_executable_sha256.len() != 64
        || oracle.wheel_file != "tokenizers-0.22.2-cp39-abi3-win_amd64.whl"
        || oracle.wheel_sha256.len() != 64
        || oracle.environment_lock_sha256.len() != 64
        || oracle.network_allowed
        || oracle.child_process_allowed
        || profile.corpus.generator_path != "tinyrustlm/tools/qwen-tokenizer2-parity-corpus.js"
        || profile.corpus.generator_sha256.len() != 64
        || !acceptance.corpus_committed_before_observation
        || !acceptance.source_lock_revalidated
        || !acceptance.source_rehashed_after_observation
        || !acceptance.exact_case_order_required
        || !acceptance.exact_token_ids_required
        || !acceptance.exact_include_all_decode_required
        || !acceptance.exact_skip_special_decode_required
        || !acceptance.repeated_oracle_bytes_required
        || !acceptance.repeated_candidate_bytes_required
        || !acceptance.every_case_required
        || !acceptance.mismatch_is_fatal
        || !acceptance.raw_outputs_preserved
        || acceptance.network_request_maximum != 0
        || acceptance.child_process_maximum != 0
        || !claims.tokenizer_source_parity_may_be_claimed_after_pass
        || claims.browser_wasm_may_be_claimed
        || claims.model_runtime_may_be_claimed
        || claims.model_quality_may_be_claimed
        || claims.release_may_be_claimed
        || claims.campaign_credit_may_be_claimed
        || claims.required_next_gate
            != "full-artifact-real-chromium-wasm-parity-and-resource-evidence"
    {
        return Err("qwen-tokenizer2-native-profile-invalid");
    }
    Ok(())
}

fn validate_source_closure(profile: &Preregistration, root: &Path) -> Result<(), &'static str> {
    if profile.candidate.source_closure.is_empty() || profile.candidate.source_closure.len() > 32 {
        return Err("qwen-tokenizer2-native-source-closure-invalid");
    }
    let mut previous = None::<&str>;
    let mut canonical = Vec::new();
    let mut runner_seen = false;
    for entry in &profile.candidate.source_closure {
        validate_relative_path(&entry.path)?;
        if previous.is_some_and(|value| value >= entry.path.as_str()) {
            return Err("qwen-tokenizer2-native-source-closure-invalid");
        }
        previous = Some(&entry.path);
        let path = root.join(&entry.path);
        let bytes = read_bounded(
            &path,
            4 * 1024 * 1024,
            "qwen-tokenizer2-native-source-closure-invalid",
        )?;
        if bytes.len() as u64 != entry.byte_length
            || hex_lower(&Sha256::digest(&bytes)) != entry.sha256
        {
            return Err("qwen-tokenizer2-native-source-closure-invalid");
        }
        runner_seen |= entry.path == profile.candidate.runner_path
            && entry.sha256 == profile.candidate.runner_sha256;
        canonical.extend_from_slice(entry.path.as_bytes());
        canonical.push(0);
        canonical.extend_from_slice(entry.byte_length.to_string().as_bytes());
        canonical.push(0);
        canonical.extend_from_slice(entry.sha256.as_bytes());
        canonical.push(b'\n');
    }
    if !runner_seen
        || hex_lower(&Sha256::digest(&canonical)) != profile.candidate.source_closure_sha256
    {
        return Err("qwen-tokenizer2-native-source-closure-invalid");
    }
    Ok(())
}

fn validate_corpus(corpus: &CorpusDocument, profile: &Preregistration) -> Result<(), &'static str> {
    if corpus.schema != CORPUS_SCHEMA
        || corpus.corpus_id != CORPUS_ID
        || corpus.generator_profile_id != "tinyrustlm.qwen-tokenizer2-parity-corpus/1"
        || corpus.seed_hex != "6f2c4f41805f1297"
        || corpus.source_lock_sha256 != SOURCE_LOCK_SHA256
        || corpus.tokenizer_artifact_sha256 != ARTIFACT_SHA256
        || corpus.case_count != 2048
        || corpus.category_counts != profile.corpus.category_counts
        || corpus.cases.len() != 2048
        || corpus.category_counts != expected_category_counts()
    {
        return Err("qwen-tokenizer2-native-corpus-invalid");
    }
    let mut ids = HashSet::with_capacity(corpus.cases.len());
    let mut texts = HashSet::with_capacity(corpus.cases.len());
    let mut counts = BTreeMap::<String, u32>::new();
    for case in &corpus.cases {
        if case.case_id.is_empty()
            || case.category.is_empty()
            || !ids.insert(case.case_id.as_str())
            || !texts.insert(case.text.as_str())
            || case.text.len() > profile.execution.maximum_input_bytes as usize
        {
            return Err("qwen-tokenizer2-native-corpus-invalid");
        }
        *counts.entry(case.category.clone()).or_default() += 1;
    }
    if counts != corpus.category_counts {
        return Err("qwen-tokenizer2-native-corpus-invalid");
    }
    Ok(())
}

fn expected_category_counts() -> BTreeMap<String, u32> {
    [
        ("added-token-exact", 104),
        ("added-token-near-miss", 104),
        ("adversarial-boundary", 96),
        ("chat-serialization", 64),
        ("code-json", 128),
        ("combining-boundary", 96),
        ("contractions-case", 128),
        ("emoji-joiners", 96),
        ("empty-minimal", 16),
        ("long-input", 16),
        ("multilingual", 256),
        ("numbers-units", 128),
        ("ordinary-conversation", 240),
        ("punctuation-symbols", 160),
        ("randomized-unicode-mix", 96),
        ("unicode-normalization", 160),
        ("whitespace-linebreak", 160),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_owned(), value))
    .collect()
}

fn repository_root(profile_path: &Path) -> Result<PathBuf, &'static str> {
    let vnext = profile_path
        .parent()
        .ok_or("qwen-tokenizer2-native-profile-invalid")?;
    let contracts = vnext
        .parent()
        .ok_or("qwen-tokenizer2-native-profile-invalid")?;
    let root = contracts
        .parent()
        .ok_or("qwen-tokenizer2-native-profile-invalid")?;
    if vnext.file_name().and_then(|name| name.to_str()) != Some("vnext")
        || contracts.file_name().and_then(|name| name.to_str()) != Some("contracts")
    {
        return Err("qwen-tokenizer2-native-profile-invalid");
    }
    fs::canonicalize(root).map_err(|_| "qwen-tokenizer2-native-profile-invalid")
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
        return Err("qwen-tokenizer2-native-source-closure-invalid");
    }
    Ok(())
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
        return Err("qwen-tokenizer2-native-input-path-invalid");
    }
    fs::canonicalize(path).map_err(|_| "qwen-tokenizer2-native-input-path-invalid")
}

fn absolute_output(path: &Path) -> Result<PathBuf, &'static str> {
    if !path.is_absolute() || path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err("qwen-tokenizer2-native-output-path-invalid");
    }
    let parent = path
        .parent()
        .ok_or("qwen-tokenizer2-native-output-path-invalid")?;
    let parent =
        fs::canonicalize(parent).map_err(|_| "qwen-tokenizer2-native-output-path-invalid")?;
    let name = path
        .file_name()
        .ok_or("qwen-tokenizer2-native-output-path-invalid")?;
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
        .map_err(|_| "qwen-tokenizer2-native-output-create-failed")?;
    file.write_all(bytes)
        .map_err(|_| "qwen-tokenizer2-native-output-write-failed")?;
    file.sync_all()
        .map_err(|_| "qwen-tokenizer2-native-output-flush-failed")
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
