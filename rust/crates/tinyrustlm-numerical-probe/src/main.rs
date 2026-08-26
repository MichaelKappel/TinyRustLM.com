#![forbid(unsafe_code)]
#![doc = "Create-only private scalar traces for preregistered numerical conformance."]

use std::collections::HashSet;
use std::env;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tinyrustlm_runtime::{
    select_greedy, RuntimePolicy, ScalarModel, ScalarSession, ScalarTraceSink, ScalarTraceStage,
};

const REQUEST_SCHEMA: &str = "tinyrustlm.scalar-numerical-probe-request.v1";
const RESULT_SCHEMA: &str = "tinyrustlm.scalar-numerical-probe-result.v1";
const TRACE_PROFILE_ID: &str = "tinyrustlm.scalar-full-stage-f32le/1";
const MAXIMUM_REQUEST_BYTES: u64 = 1_048_576;
const MAXIMUM_PATH_BYTES: usize = 4_096;
const MAXIMUM_OPERATION_ID_BYTES: usize = 160;
const MAXIMUM_CASE_ID_BYTES: usize = 96;
const MAXIMUM_CASES: u32 = 32;
const MAXIMUM_TOKENS_PER_CASE: u32 = 256;
const HASH_BUFFER_BYTES: usize = 1_048_576;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ProbeError {
    code: &'static str,
}

impl ProbeError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }
}

impl Display for ProbeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for ProbeError {}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProbeRequest {
    schema: String,
    operation_id: String,
    composition_result_sha256: String,
    composition_root: String,
    model: ModelRequest,
    evidence_parent: String,
    output_root: String,
    trace_profile_id: String,
    policy: ProbePolicy,
    cases: Vec<ProbeCase>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelRequest {
    file_name: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProbePolicy {
    maximum_model_bytes: u64,
    maximum_sequence_tokens: u32,
    maximum_kv_bytes: u64,
    maximum_scratch_bytes: u64,
    maximum_trace_bytes: u64,
    maximum_cases: u32,
    maximum_tokens_per_case: u32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProbeCase {
    id: String,
    token_ids: Vec<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeResult {
    schema: &'static str,
    operation_id: String,
    status: &'static str,
    claim: &'static str,
    request: ContentIdentity,
    composition_result_sha256: String,
    trace_profile_id: &'static str,
    model: ModelResult,
    model_spec: ModelSpecResult,
    policy: ProbePolicy,
    memory_plan: MemoryPlanResult,
    case_count: u32,
    trace_file_count: u32,
    trace_byte_length: u64,
    cases: Vec<CaseResult>,
    durability: DurabilityResult,
    required_next_gate: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentIdentity {
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelResult {
    file_name: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelSpecResult {
    vocabulary_size: u32,
    context_length: u32,
    embedding_size: u32,
    feed_forward_size: u32,
    layer_count: u32,
    head_count: u32,
    kv_head_count: u32,
    head_dimension: u32,
    rope_theta_f32_bits: String,
    normalization_epsilon_f32_bits: String,
    tied_embeddings: bool,
    qkv_bias: bool,
    qk_normalization: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryPlanResult {
    model_bytes: u64,
    reserved_kv_bytes: u64,
    scratch_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseResult {
    id: String,
    token_count: u32,
    token_ids_le_u32_sha256: String,
    steps: Vec<StepResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StepResult {
    step: u32,
    position_before: u32,
    position_after: u32,
    committed_kv_bytes: u64,
    greedy_token_id: u32,
    trace_file: String,
    trace_byte_length: u64,
    trace_sha256: String,
    stages: Vec<StageResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StageResult {
    stage: &'static str,
    layer: Option<u32>,
    offset_bytes: u64,
    element_count: u64,
    byte_length: u64,
    f32le_sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DurabilityResult {
    trace_files_synced: bool,
    result_file_synced: bool,
    directory_sync_claimed: bool,
}

struct TracePackWriter {
    file: BufWriter<File>,
    file_hasher: Sha256,
    byte_length: u64,
    maximum_bytes: u64,
    stages: Vec<StageResult>,
    error: Option<ProbeError>,
}

impl TracePackWriter {
    fn create(path: &Path, maximum_bytes: u64) -> Result<Self, ProbeError> {
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|_| ProbeError::new("scalar-probe-trace-create"))?;
        Ok(Self {
            file: BufWriter::new(file),
            file_hasher: Sha256::new(),
            byte_length: 0,
            maximum_bytes,
            stages: Vec::new(),
            error: None,
        })
    }

    fn finish(mut self) -> Result<(u64, String, Vec<StageResult>), ProbeError> {
        if let Some(error) = self.error {
            return Err(error);
        }
        self.file
            .flush()
            .map_err(|_| ProbeError::new("scalar-probe-trace-flush"))?;
        self.file
            .get_ref()
            .sync_all()
            .map_err(|_| ProbeError::new("scalar-probe-trace-sync"))?;
        Ok((
            self.byte_length,
            hex_lower(&self.file_hasher.finalize()),
            self.stages,
        ))
    }
}

impl ScalarTraceSink for TracePackWriter {
    fn record(&mut self, stage: ScalarTraceStage, values: &[f32]) {
        if self.error.is_some() {
            return;
        }
        let element_count = match u64::try_from(values.len()) {
            Ok(value) => value,
            Err(_) => {
                self.error = Some(ProbeError::new("scalar-probe-trace-overflow"));
                return;
            }
        };
        let byte_length = match element_count.checked_mul(4) {
            Some(value) => value,
            None => {
                self.error = Some(ProbeError::new("scalar-probe-trace-overflow"));
                return;
            }
        };
        let next = match self.byte_length.checked_add(byte_length) {
            Some(value) => value,
            None => {
                self.error = Some(ProbeError::new("scalar-probe-trace-overflow"));
                return;
            }
        };
        if next > self.maximum_bytes {
            self.error = Some(ProbeError::new("scalar-probe-trace-budget"));
            return;
        }

        let mut stage_hasher = Sha256::new();
        for value in values {
            if !value.is_finite() {
                self.error = Some(ProbeError::new("scalar-probe-nonfinite"));
                return;
            }
            let bytes = value.to_le_bytes();
            if self.file.write_all(&bytes).is_err() {
                self.error = Some(ProbeError::new("scalar-probe-trace-write"));
                return;
            }
            self.file_hasher.update(bytes);
            stage_hasher.update(bytes);
        }
        let (label, layer) = stage_label(stage);
        self.stages.push(StageResult {
            stage: label,
            layer,
            offset_bytes: self.byte_length,
            element_count,
            byte_length,
            f32le_sha256: hex_lower(&stage_hasher.finalize()),
        });
        self.byte_length = next;
    }
}

fn stage_label(stage: ScalarTraceStage) -> (&'static str, Option<u32>) {
    match stage {
        ScalarTraceStage::TokenEmbedding => ("token-embedding", None),
        ScalarTraceStage::AttentionNormalized(layer) => ("attention-normalized", Some(layer)),
        ScalarTraceStage::QueryAfterRope(layer) => ("query-after-rope", Some(layer)),
        ScalarTraceStage::KeyAfterRope(layer) => ("key-after-rope", Some(layer)),
        ScalarTraceStage::Value(layer) => ("value", Some(layer)),
        ScalarTraceStage::Attention(layer) => ("attention", Some(layer)),
        ScalarTraceStage::PostAttentionResidual(layer) => ("post-attention-residual", Some(layer)),
        ScalarTraceStage::FeedForwardNormalized(layer) => ("feed-forward-normalized", Some(layer)),
        ScalarTraceStage::FeedForwardActivated(layer) => ("feed-forward-activated", Some(layer)),
        ScalarTraceStage::PostFeedForwardResidual(layer) => {
            ("post-feed-forward-residual", Some(layer))
        }
        ScalarTraceStage::FinalNormalized => ("final-normalized", None),
        ScalarTraceStage::Logits => ("logits", None),
    }
}

fn read_request(path: &Path) -> Result<(ProbeRequest, ContentIdentity), ProbeError> {
    require_regular_file(path, "scalar-probe-request-file")?;
    let metadata = fs::metadata(path).map_err(|_| ProbeError::new("scalar-probe-request-file"))?;
    if metadata.len() == 0 || metadata.len() > MAXIMUM_REQUEST_BYTES {
        return Err(ProbeError::new("scalar-probe-request-size"));
    }
    let bytes = fs::read(path).map_err(|_| ProbeError::new("scalar-probe-request-read"))?;
    let request: ProbeRequest =
        serde_json::from_slice(&bytes).map_err(|_| ProbeError::new("scalar-probe-request-json"))?;
    let canonical = canonical_json(&request)?;
    if bytes != canonical {
        return Err(ProbeError::new("scalar-probe-request-canonical"));
    }
    Ok((
        request,
        ContentIdentity {
            byte_length: metadata.len(),
            sha256: sha256_bytes(&bytes),
        },
    ))
}

fn canonical_json<T: Serialize>(value: &T) -> Result<Vec<u8>, ProbeError> {
    let mut bytes = serde_json::to_vec_pretty(value)
        .map_err(|_| ProbeError::new("scalar-probe-json-serialize"))?;
    bytes.push(b'\n');
    Ok(bytes)
}

fn validate_request(request: &ProbeRequest) -> Result<(PathBuf, PathBuf), ProbeError> {
    if request.schema != REQUEST_SCHEMA || request.trace_profile_id != TRACE_PROFILE_ID {
        return Err(ProbeError::new("scalar-probe-request-profile"));
    }
    require_identifier(
        &request.operation_id,
        MAXIMUM_OPERATION_ID_BYTES,
        "scalar-probe-operation-id",
    )?;
    require_sha256(&request.composition_result_sha256)?;
    require_sha256(&request.model.sha256)?;
    if request.model.file_name != "model.slm2"
        || request.model.byte_length < 224
        || request.model.byte_length > request.policy.maximum_model_bytes
    {
        return Err(ProbeError::new("scalar-probe-model-identity"));
    }
    validate_policy(request.policy)?;
    if request.cases.is_empty()
        || u32::try_from(request.cases.len()).ok() > Some(request.policy.maximum_cases)
    {
        return Err(ProbeError::new("scalar-probe-case-count"));
    }
    let mut case_ids = HashSet::new();
    for case in &request.cases {
        require_identifier(&case.id, MAXIMUM_CASE_ID_BYTES, "scalar-probe-case-id")?;
        if !case_ids.insert(case.id.as_str()) {
            return Err(ProbeError::new("scalar-probe-case-id"));
        }
        if case.token_ids.is_empty()
            || u32::try_from(case.token_ids.len()).ok()
                > Some(request.policy.maximum_tokens_per_case)
            || u32::try_from(case.token_ids.len()).ok()
                > Some(request.policy.maximum_sequence_tokens)
        {
            return Err(ProbeError::new("scalar-probe-case-tokens"));
        }
    }

    let composition_root = require_existing_directory(&request.composition_root)?;
    let model_path = composition_root.join(&request.model.file_name);
    require_regular_file(&model_path, "scalar-probe-model-file")?;
    if model_path
        .parent()
        .and_then(|parent| parent.canonicalize().ok())
        .as_ref()
        != Some(&composition_root)
    {
        return Err(ProbeError::new("scalar-probe-model-path"));
    }

    let evidence_parent = require_existing_directory(&request.evidence_parent)?;
    let output_root = require_absolute_ascii_path(&request.output_root)?;
    let expected_output_name = format!("{}-scalar", request.operation_id);
    if output_root.file_name().and_then(|name| name.to_str()) != Some(expected_output_name.as_str())
        || output_root
            .parent()
            .and_then(|parent| parent.canonicalize().ok())
            .as_ref()
            != Some(&evidence_parent)
    {
        return Err(ProbeError::new("scalar-probe-output-path"));
    }
    if fs::symlink_metadata(&output_root).is_ok() {
        return Err(ProbeError::new("scalar-probe-output-exists"));
    }
    Ok((model_path, output_root))
}

fn validate_policy(policy: ProbePolicy) -> Result<(), ProbeError> {
    if policy.maximum_model_bytes < 224
        || policy.maximum_sequence_tokens == 0
        || policy.maximum_kv_bytes == 0
        || policy.maximum_scratch_bytes == 0
        || policy.maximum_trace_bytes == 0
        || policy.maximum_cases == 0
        || policy.maximum_cases > MAXIMUM_CASES
        || policy.maximum_tokens_per_case == 0
        || policy.maximum_tokens_per_case > MAXIMUM_TOKENS_PER_CASE
        || policy.maximum_tokens_per_case > policy.maximum_sequence_tokens
    {
        return Err(ProbeError::new("scalar-probe-policy"));
    }
    Ok(())
}

fn require_identifier(
    value: &str,
    maximum_bytes: usize,
    code: &'static str,
) -> Result<(), ProbeError> {
    if value.is_empty()
        || value.len() > maximum_bytes
        || !value.is_ascii()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        || !value
            .bytes()
            .next()
            .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        || !value
            .bytes()
            .last()
            .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    {
        return Err(ProbeError::new(code));
    }
    Ok(())
}

fn require_sha256(value: &str) -> Result<(), ProbeError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(ProbeError::new("scalar-probe-sha256"));
    }
    Ok(())
}

fn require_absolute_ascii_path(value: &str) -> Result<PathBuf, ProbeError> {
    if value.is_empty()
        || value.len() > MAXIMUM_PATH_BYTES
        || !value.is_ascii()
        || value.contains('\0')
    {
        return Err(ProbeError::new("scalar-probe-path"));
    }
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(ProbeError::new("scalar-probe-path"));
    }
    Ok(path)
}

fn require_existing_directory(value: &str) -> Result<PathBuf, ProbeError> {
    let path = require_absolute_ascii_path(value)?;
    let link_metadata =
        fs::symlink_metadata(&path).map_err(|_| ProbeError::new("scalar-probe-directory"))?;
    if !link_metadata.file_type().is_dir() || link_metadata.file_type().is_symlink() {
        return Err(ProbeError::new("scalar-probe-directory"));
    }
    path.canonicalize()
        .map_err(|_| ProbeError::new("scalar-probe-directory"))
}

fn require_regular_file(path: &Path, code: &'static str) -> Result<(), ProbeError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| ProbeError::new(code))?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(ProbeError::new(code));
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, ProbeError> {
    let file = File::open(path).map_err(|_| ProbeError::new("scalar-probe-model-read"))?;
    let mut reader = BufReader::with_capacity(HASH_BUFFER_BYTES, file);
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];
    let mut hasher = Sha256::new();
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|_| ProbeError::new("scalar-probe-model-read"))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex_lower(&hasher.finalize()))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
}

fn token_sha256(token_ids: &[u32]) -> String {
    let mut hasher = Sha256::new();
    for token_id in token_ids {
        hasher.update(token_id.to_le_bytes());
    }
    hex_lower(&hasher.finalize())
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

fn expected_stage_count(layer_count: u32) -> Result<usize, ProbeError> {
    let count = u64::from(layer_count)
        .checked_mul(9)
        .and_then(|value| value.checked_add(3))
        .ok_or_else(|| ProbeError::new("scalar-probe-trace-overflow"))?;
    usize::try_from(count).map_err(|_| ProbeError::new("scalar-probe-trace-overflow"))
}

fn execute(request_path: &Path) -> Result<ProbeResult, ProbeError> {
    let (request, request_identity) = read_request(request_path)?;
    let (model_path, output_root) = validate_request(&request)?;
    let model_metadata =
        fs::metadata(&model_path).map_err(|_| ProbeError::new("scalar-probe-model-file"))?;
    if model_metadata.len() != request.model.byte_length
        || sha256_file(&model_path)? != request.model.sha256
    {
        return Err(ProbeError::new("scalar-probe-model-drift"));
    }

    let runtime_policy = RuntimePolicy::new(
        request.policy.maximum_model_bytes,
        request.policy.maximum_sequence_tokens,
        request.policy.maximum_kv_bytes,
        request.policy.maximum_scratch_bytes,
    )
    .map_err(|error| ProbeError::new(error.code()))?;
    let model_bytes =
        fs::read(&model_path).map_err(|_| ProbeError::new("scalar-probe-model-read"))?;
    let model = ScalarModel::from_bytes(model_bytes, runtime_policy)
        .map_err(|error| ProbeError::new(error.code()))?;
    if model.artifact_sha256_hex() != request.model.sha256 {
        return Err(ProbeError::new("scalar-probe-model-drift"));
    }
    let spec = model.spec().clone();
    let mut session =
        ScalarSession::new(model, runtime_policy).map_err(|error| ProbeError::new(error.code()))?;
    let memory_plan = session.memory_plan();

    fs::create_dir(&output_root).map_err(|_| ProbeError::new("scalar-probe-output-create"))?;
    let mut case_results = Vec::with_capacity(request.cases.len());
    let mut trace_bytes = 0_u64;
    let mut trace_files = 0_u32;
    let expected_stages = expected_stage_count(spec.layer_count)?;

    for (case_index, case) in request.cases.iter().enumerate() {
        session.reset();
        let mut steps = Vec::with_capacity(case.token_ids.len());
        for (step_index, token_id) in case.token_ids.iter().enumerate() {
            let remaining = request
                .policy
                .maximum_trace_bytes
                .checked_sub(trace_bytes)
                .ok_or_else(|| ProbeError::new("scalar-probe-trace-budget"))?;
            let trace_file = format!("case-{case_index:03}-step-{step_index:03}.f32le");
            let trace_path = output_root.join(&trace_file);
            let position_before = session
                .position()
                .map_err(|error| ProbeError::new(error.code()))?;
            let mut writer = TracePackWriter::create(&trace_path, remaining)?;
            let logits = session
                .forward_token_traced(*token_id, &mut writer)
                .map_err(|error| ProbeError::new(error.code()))?;
            let greedy_token_id =
                select_greedy(logits).map_err(|error| ProbeError::new(error.code()))?;
            let (byte_length, trace_sha256, stages) = writer.finish()?;
            if stages.len() != expected_stages {
                return Err(ProbeError::new("scalar-probe-trace-shape"));
            }
            trace_bytes = trace_bytes
                .checked_add(byte_length)
                .ok_or_else(|| ProbeError::new("scalar-probe-trace-overflow"))?;
            trace_files = trace_files
                .checked_add(1)
                .ok_or_else(|| ProbeError::new("scalar-probe-trace-overflow"))?;
            steps.push(StepResult {
                step: u32::try_from(step_index)
                    .map_err(|_| ProbeError::new("scalar-probe-trace-overflow"))?,
                position_before,
                position_after: session
                    .position()
                    .map_err(|error| ProbeError::new(error.code()))?,
                committed_kv_bytes: session
                    .committed_kv_bytes()
                    .map_err(|error| ProbeError::new(error.code()))?,
                greedy_token_id,
                trace_file,
                trace_byte_length: byte_length,
                trace_sha256,
                stages,
            });
        }
        case_results.push(CaseResult {
            id: case.id.clone(),
            token_count: u32::try_from(case.token_ids.len())
                .map_err(|_| ProbeError::new("scalar-probe-case-tokens"))?,
            token_ids_le_u32_sha256: token_sha256(&case.token_ids),
            steps,
        });
    }

    let result = ProbeResult {
        schema: RESULT_SCHEMA,
        operation_id: request.operation_id,
        status: "completed",
        claim: "private-scalar-traces-created-not-numerical-parity",
        request: request_identity,
        composition_result_sha256: request.composition_result_sha256,
        trace_profile_id: TRACE_PROFILE_ID,
        model: ModelResult {
            file_name: request.model.file_name,
            byte_length: request.model.byte_length,
            sha256: request.model.sha256,
        },
        model_spec: ModelSpecResult {
            vocabulary_size: spec.vocabulary_size,
            context_length: spec.context_length,
            embedding_size: spec.embedding_size,
            feed_forward_size: spec.feed_forward_size,
            layer_count: spec.layer_count,
            head_count: spec.head_count,
            kv_head_count: spec.kv_head_count,
            head_dimension: spec.head_dimension,
            rope_theta_f32_bits: format!("{:08x}", spec.rope_theta.to_bits()),
            normalization_epsilon_f32_bits: format!("{:08x}", spec.normalization_epsilon.to_bits()),
            tied_embeddings: spec.tied_embeddings,
            qkv_bias: spec.qkv_bias,
            qk_normalization: spec.qk_normalization,
        },
        policy: request.policy,
        memory_plan: MemoryPlanResult {
            model_bytes: memory_plan.model_bytes,
            reserved_kv_bytes: memory_plan.kv_bytes,
            scratch_bytes: memory_plan.scratch_bytes,
        },
        case_count: u32::try_from(case_results.len())
            .map_err(|_| ProbeError::new("scalar-probe-case-count"))?,
        trace_file_count: trace_files,
        trace_byte_length: trace_bytes,
        cases: case_results,
        durability: DurabilityResult {
            trace_files_synced: true,
            result_file_synced: true,
            directory_sync_claimed: false,
        },
        required_next_gate: "independent-source-and-scalar-trace-verification",
    };
    let result_path = output_root.join("probe.json");
    let result_bytes = canonical_json(&result)?;
    let mut result_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(result_path)
        .map_err(|_| ProbeError::new("scalar-probe-result-create"))?;
    result_file
        .write_all(&result_bytes)
        .map_err(|_| ProbeError::new("scalar-probe-result-write"))?;
    result_file
        .flush()
        .map_err(|_| ProbeError::new("scalar-probe-result-flush"))?;
    result_file
        .sync_all()
        .map_err(|_| ProbeError::new("scalar-probe-result-sync"))?;
    Ok(result)
}

fn run() -> Result<(), ProbeError> {
    let mut arguments = env::args_os();
    let _program = arguments.next();
    let request = arguments
        .next()
        .ok_or_else(|| ProbeError::new("scalar-probe-arguments"))?;
    if arguments.next().is_some() {
        return Err(ProbeError::new("scalar-probe-arguments"));
    }
    let result = execute(Path::new(&request))?;
    println!("{}:{}", result.status, result.operation_id);
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("scalar-probe-error:{}", error.code);
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    const Q8_VECTORS: &str =
        include_str!("../../../../contracts/vnext/slm2-q8-weight-vectors.v1.json");
    static TEST_ID: AtomicU64 = AtomicU64::new(0);

    struct TestRoot {
        path: PathBuf,
    }

    impl TestRoot {
        fn create() -> Self {
            let id = TEST_ID.fetch_add(1, Ordering::Relaxed);
            let path = env::temp_dir().join(format!(
                "tinyrustlm-numerical-probe-{}-{id}",
                std::process::id()
            ));
            fs::create_dir(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            assert!(self.path.starts_with(env::temp_dir()));
            if self.path.exists() {
                fs::remove_dir_all(&self.path).unwrap();
            }
        }
    }

    fn fixture_bytes() -> Vec<u8> {
        let value: serde_json::Value = serde_json::from_str(Q8_VECTORS).unwrap();
        let hex = value["canonical"]["artifactHex"].as_str().unwrap();
        hex.as_bytes()
            .chunks_exact(2)
            .map(|pair| {
                let high = char::from(pair[0]).to_digit(16).unwrap() as u8;
                let low = char::from(pair[1]).to_digit(16).unwrap() as u8;
                (high << 4) | low
            })
            .collect()
    }

    fn request(root: &TestRoot) -> (PathBuf, PathBuf, ProbeRequest) {
        let composition = root.path.join("composition");
        let evidence = root.path.join("evidence");
        fs::create_dir(&composition).unwrap();
        fs::create_dir(&evidence).unwrap();
        let model_bytes = fixture_bytes();
        fs::write(composition.join("model.slm2"), &model_bytes).unwrap();
        let operation_id = "fixture-scalar-operation".to_string();
        let output = evidence.join(format!("{operation_id}-scalar"));
        let request = ProbeRequest {
            schema: REQUEST_SCHEMA.to_string(),
            operation_id,
            composition_result_sha256: "1".repeat(64),
            composition_root: composition.to_string_lossy().into_owned(),
            model: ModelRequest {
                file_name: "model.slm2".to_string(),
                byte_length: u64::try_from(model_bytes.len()).unwrap(),
                sha256: sha256_bytes(&model_bytes),
            },
            evidence_parent: evidence.to_string_lossy().into_owned(),
            output_root: output.to_string_lossy().into_owned(),
            trace_profile_id: TRACE_PROFILE_ID.to_string(),
            policy: ProbePolicy {
                maximum_model_bytes: 1 << 20,
                maximum_sequence_tokens: 4,
                maximum_kv_bytes: 1 << 20,
                maximum_scratch_bytes: 1 << 20,
                maximum_trace_bytes: 16 << 20,
                maximum_cases: 4,
                maximum_tokens_per_case: 4,
            },
            cases: vec![ProbeCase {
                id: "two-token-fixture".to_string(),
                token_ids: vec![1, 2],
            }],
        };
        let request_path = root.path.join("request.json");
        fs::write(&request_path, canonical_json(&request).unwrap()).unwrap();
        (request_path, output, request)
    }

    #[test]
    fn creates_bounded_create_only_trace_packs() {
        let root = TestRoot::create();
        let (request_path, output, request) = request(&root);
        let result = execute(&request_path).unwrap();
        assert_eq!(result.schema, RESULT_SCHEMA);
        assert_eq!(result.status, "completed");
        assert_eq!(result.model.sha256, request.model.sha256);
        assert_eq!(result.model_spec.layer_count, 1);
        assert_eq!(result.case_count, 1);
        assert_eq!(result.trace_file_count, 2);
        assert_eq!(result.cases[0].steps.len(), 2);
        assert_eq!(result.cases[0].steps[0].stages.len(), 12);
        assert_eq!(result.cases[0].steps[0].position_before, 0);
        assert_eq!(result.cases[0].steps[0].position_after, 1);
        assert_eq!(result.cases[0].steps[1].position_before, 1);
        assert_eq!(result.cases[0].steps[1].position_after, 2);
        for step in &result.cases[0].steps {
            let bytes = fs::read(output.join(&step.trace_file)).unwrap();
            assert_eq!(u64::try_from(bytes.len()).unwrap(), step.trace_byte_length);
            assert_eq!(sha256_bytes(&bytes), step.trace_sha256);
            let covered = step
                .stages
                .iter()
                .map(|stage| stage.byte_length)
                .sum::<u64>();
            assert_eq!(covered, step.trace_byte_length);
        }
        let manifest = fs::read(output.join("probe.json")).unwrap();
        assert_eq!(manifest, canonical_json(&result).unwrap());
    }

    #[test]
    fn rejects_noncanonical_or_unknown_request_before_output() {
        let root = TestRoot::create();
        let (request_path, output, request) = request(&root);
        fs::write(&request_path, serde_json::to_vec(&request).unwrap()).unwrap();
        assert_eq!(
            execute(&request_path).unwrap_err().code,
            "scalar-probe-request-canonical"
        );
        assert!(!output.exists());

        let mut value = serde_json::to_value(&request).unwrap();
        value["unknown"] = serde_json::Value::Bool(true);
        fs::write(
            &request_path,
            format!("{}\n", serde_json::to_string_pretty(&value).unwrap()),
        )
        .unwrap();
        assert_eq!(
            execute(&request_path).unwrap_err().code,
            "scalar-probe-request-json"
        );
        assert!(!output.exists());
    }

    #[test]
    fn rejects_model_drift_before_output() {
        let root = TestRoot::create();
        let (request_path, output, mut request) = request(&root);
        request.model.sha256 = "0".repeat(64);
        fs::write(&request_path, canonical_json(&request).unwrap()).unwrap();
        assert_eq!(
            execute(&request_path).unwrap_err().code,
            "scalar-probe-model-drift"
        );
        assert!(!output.exists());
    }

    #[test]
    fn rejects_existing_output_without_overwrite() {
        let root = TestRoot::create();
        let (request_path, output, _request) = request(&root);
        execute(&request_path).unwrap();
        let prior = fs::read(output.join("probe.json")).unwrap();
        assert_eq!(
            execute(&request_path).unwrap_err().code,
            "scalar-probe-output-exists"
        );
        assert_eq!(fs::read(output.join("probe.json")).unwrap(), prior);
    }

    #[test]
    fn preserves_partial_trace_when_the_registered_budget_is_too_small() {
        let root = TestRoot::create();
        let (request_path, output, mut request) = request(&root);
        request.policy.maximum_trace_bytes = 4;
        fs::write(&request_path, canonical_json(&request).unwrap()).unwrap();
        assert_eq!(
            execute(&request_path).unwrap_err().code,
            "scalar-probe-trace-budget"
        );
        assert!(output.exists());
        assert!(!output.join("probe.json").exists());
        assert!(output.join("case-000-step-000.f32le").exists());
    }
}
