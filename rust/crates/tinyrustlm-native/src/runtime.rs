use serde::{Deserialize, Serialize};
use std::collections::{btree_map::Entry, BTreeMap};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tinyrustlm_composition2::{
    Acg2Identity, Acg2Member, Acg2Read, MemberResolver, MemberRole, OperationIdentity,
    TranscriptState,
};
use tinyrustlm_runtime::{
    ConversationPolicy, ConversationRuntime, MemoryPlan, RuntimeOutput, RuntimePolicy,
    RuntimeState, RuntimeStep,
};
use tinyrustlm_sampling2::GenerationStatus;

use crate::files::{open_regular_file, read_regular_file};
use crate::model::hex_lower;
use crate::response::{parse_json, NativeError, NativeResult};

pub(crate) const RUNTIME_CREATE_SCHEMA: &str = "tinyrustlm.native.runtime_create/1";
pub(crate) const RUNTIME_ACTIVATION_SCHEMA: &str = "tinyrustlm.native.runtime_activation/1";
pub(crate) const MAXIMUM_RUNTIME_JSON_BYTES: usize = 65_536;
pub(crate) const MAXIMUM_PROMPT2_REQUEST_BYTES: usize = 16_777_216;
pub(crate) const MAXIMUM_RUNTIME_HANDLES: usize = 64;

pub(crate) const MAXIMUM_MODEL_BYTES: u64 = 17_179_869_184;
pub(crate) const MAXIMUM_SEQUENCE_TOKENS: u32 = 131_072;
pub(crate) const MAXIMUM_KV_BYTES: u64 = 17_179_869_184;
pub(crate) const MAXIMUM_SCRATCH_BYTES: u64 = 8_589_934_592;
pub(crate) const MAXIMUM_RESOLVED_MEMBER_BYTES: u64 = 19_327_352_832;
pub(crate) const MAXIMUM_RESIDENT_DEPENDENCY_BYTES: u64 = 2_147_483_648;
const ACG2_ARTIFACT_BYTES: u64 = 896;

type RuntimeCell = Arc<Mutex<ConversationRuntime>>;

static NEXT_HANDLE: AtomicU64 = AtomicU64::new(1);
static RUNTIMES: LazyLock<Mutex<BTreeMap<u64, RuntimeCell>>> =
    LazyLock::new(|| Mutex::new(BTreeMap::new()));

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RuntimeCreateRequest {
    schema: String,
    maximum_model_bytes: u64,
    maximum_sequence_tokens: u32,
    maximum_kv_bytes: u64,
    maximum_scratch_bytes: u64,
    maximum_resolved_member_bytes: u64,
    maximum_resident_dependency_bytes: u64,
    maximum_request_bytes: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ActivationRequest {
    schema: String,
    graph_path: PathBuf,
    members: MemberPaths,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemberPaths {
    model: PathBuf,
    tokenizer: PathBuf,
    template: PathBuf,
    sampling: PathBuf,
    prompt: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeHandleReport {
    schema: &'static str,
    handle: u64,
    state: RuntimeStateReport,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeDestroyReport {
    schema: &'static str,
    handle: u64,
    destroyed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeStateReport {
    schema: &'static str,
    state: &'static str,
    operation_id: String,
    transcript_revision: u64,
    active_composition: Option<Acg2IdentityReport>,
    committed_kv_bytes: u64,
    memory_plan: Option<MemoryPlanReport>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Acg2IdentityReport {
    artifact_bytes: u64,
    artifact_sha256: String,
    graph_identity_sha256: String,
    member_table_sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryPlanReport {
    model_bytes: u64,
    kv_bytes: u64,
    scratch_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerationStatusReport {
    kind: &'static str,
    stop_token_id: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeStepReport {
    schema: &'static str,
    selected_token_id: Option<u32>,
    emitted_token_id: Option<u32>,
    status: GenerationStatusReport,
    committed_kv_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeOutputReport {
    schema: &'static str,
    text: String,
    token_ids: Vec<u32>,
    status: GenerationStatusReport,
    composition: Acg2IdentityReport,
    operation_id: String,
    committed_kv_bytes: u64,
}

pub(crate) fn create(
    request_bytes: &[u8],
    operation_bytes: [u8; 32],
    transcript_revision: u64,
) -> NativeResult<RuntimeHandleReport> {
    let request: RuntimeCreateRequest = parse_json(request_bytes)?;
    if request.schema != RUNTIME_CREATE_SCHEMA
        || request.maximum_model_bytes > MAXIMUM_MODEL_BYTES
        || request.maximum_sequence_tokens > MAXIMUM_SEQUENCE_TOKENS
        || request.maximum_kv_bytes > MAXIMUM_KV_BYTES
        || request.maximum_scratch_bytes > MAXIMUM_SCRATCH_BYTES
        || request.maximum_resolved_member_bytes > MAXIMUM_RESOLVED_MEMBER_BYTES
        || request.maximum_resident_dependency_bytes > MAXIMUM_RESIDENT_DEPENDENCY_BYTES
        || request.maximum_request_bytes > MAXIMUM_PROMPT2_REQUEST_BYTES as u64
    {
        return Err(NativeError::new("native-runtime-policy"));
    }
    let scalar = RuntimePolicy::new(
        request.maximum_model_bytes,
        request.maximum_sequence_tokens,
        request.maximum_kv_bytes,
        request.maximum_scratch_bytes,
    )
    .map_err(|error| NativeError::new(error.code()))?;
    let maximum_request_bytes = usize::try_from(request.maximum_request_bytes)
        .map_err(|_| NativeError::new("native-arithmetic"))?;
    let policy = ConversationPolicy::new(
        scalar,
        request.maximum_resolved_member_bytes,
        request.maximum_resident_dependency_bytes,
        maximum_request_bytes,
    )
    .map_err(|error| NativeError::new(error.code()))?;
    let operation =
        OperationIdentity::new(operation_bytes).map_err(|error| NativeError::new(error.code()))?;
    let runtime =
        ConversationRuntime::new(policy, operation, TranscriptState::new(transcript_revision));
    let state = state_report(&runtime);
    let handle = insert_runtime(runtime)?;
    Ok(RuntimeHandleReport {
        schema: "tinyrustlm.native.runtime_handle/1",
        handle,
        state,
    })
}

pub(crate) fn destroy(handle: u64) -> NativeResult<RuntimeDestroyReport> {
    if handle == 0 {
        return Err(NativeError::new("native-runtime-handle"));
    }
    let mut runtimes = RUNTIMES
        .lock()
        .map_err(|_| NativeError::new("native-runtime-registry"))?;
    if runtimes.remove(&handle).is_none() {
        return Err(NativeError::new("native-runtime-handle"));
    }
    Ok(RuntimeDestroyReport {
        schema: "tinyrustlm.native.runtime_destroy/1",
        handle,
        destroyed: true,
    })
}

pub(crate) fn state(handle: u64) -> NativeResult<RuntimeStateReport> {
    with_runtime(handle, |runtime| Ok(state_report(runtime)))
}

pub(crate) fn activate(
    handle: u64,
    request_bytes: &[u8],
    expected_operation: [u8; 32],
) -> NativeResult<RuntimeStateReport> {
    let request: ActivationRequest = parse_json(request_bytes)?;
    if request.schema != RUNTIME_ACTIVATION_SCHEMA {
        return Err(NativeError::new("native-contract"));
    }
    let graph = read_regular_file(&request.graph_path, ACG2_ARTIFACT_BYTES)?;
    let operation = OperationIdentity::new(expected_operation)
        .map_err(|error| NativeError::new(error.code()))?;
    let mut resolver = PathMemberResolver {
        members: request.members,
    };
    with_runtime(handle, move |runtime| {
        runtime
            .activate(&graph, &mut resolver, operation)
            .map_err(|error| NativeError::new(error.code()))?;
        Ok(state_report(runtime))
    })
}

pub(crate) fn advance_operation(
    handle: u64,
    expected_current: [u8; 32],
    next: [u8; 32],
) -> NativeResult<RuntimeStateReport> {
    let expected_current =
        OperationIdentity::new(expected_current).map_err(|error| NativeError::new(error.code()))?;
    let next = OperationIdentity::new(next).map_err(|error| NativeError::new(error.code()))?;
    with_runtime(handle, |runtime| {
        runtime
            .advance_operation(expected_current, next)
            .map_err(|error| NativeError::new(error.code()))?;
        Ok(state_report(runtime))
    })
}

pub(crate) fn set_transcript(
    handle: u64,
    transcript_revision: u64,
) -> NativeResult<RuntimeStateReport> {
    with_runtime(handle, |runtime| {
        runtime
            .set_transcript(TranscriptState::new(transcript_revision))
            .map_err(|error| NativeError::new(error.code()))?;
        Ok(state_report(runtime))
    })
}

pub(crate) fn begin_request(
    handle: u64,
    request_bytes: &[u8],
    expected_operation: [u8; 32],
) -> NativeResult<RuntimeStateReport> {
    let operation = OperationIdentity::new(expected_operation)
        .map_err(|error| NativeError::new(error.code()))?;
    with_runtime(handle, |runtime| {
        runtime
            .begin_request(request_bytes, operation)
            .map_err(|error| NativeError::new(error.code()))?;
        Ok(state_report(runtime))
    })
}

pub(crate) fn step(handle: u64, cancelled: bool) -> NativeResult<RuntimeStepReport> {
    with_runtime(handle, |runtime| {
        let step = runtime
            .step(cancelled)
            .map_err(|error| NativeError::new(error.code()))?;
        Ok(step_report(step))
    })
}

pub(crate) fn finish(handle: u64) -> NativeResult<RuntimeOutputReport> {
    with_runtime(handle, |runtime| {
        let output = runtime
            .finish()
            .map_err(|error| NativeError::new(error.code()))?;
        Ok(output_report(output))
    })
}

fn insert_runtime(runtime: ConversationRuntime) -> NativeResult<u64> {
    let mut runtimes = RUNTIMES
        .lock()
        .map_err(|_| NativeError::new("native-runtime-registry"))?;
    if runtimes.len() >= MAXIMUM_RUNTIME_HANDLES {
        return Err(NativeError::new("native-runtime-limit"));
    }
    let runtime = Arc::new(Mutex::new(runtime));
    for _ in 0..=MAXIMUM_RUNTIME_HANDLES {
        let handle = NEXT_HANDLE.fetch_add(1, Ordering::Relaxed);
        if handle == 0 {
            continue;
        }
        if let Entry::Vacant(entry) = runtimes.entry(handle) {
            entry.insert(Arc::clone(&runtime));
            return Ok(handle);
        }
    }
    Err(NativeError::new("native-runtime-handle"))
}

fn with_runtime<T>(
    handle: u64,
    operation: impl FnOnce(&mut ConversationRuntime) -> NativeResult<T>,
) -> NativeResult<T> {
    if handle == 0 {
        return Err(NativeError::new("native-runtime-handle"));
    }
    let runtime = {
        let runtimes = RUNTIMES
            .lock()
            .map_err(|_| NativeError::new("native-runtime-registry"))?;
        runtimes
            .get(&handle)
            .cloned()
            .ok_or_else(|| NativeError::new("native-runtime-handle"))?
    };
    let mut runtime = runtime
        .lock()
        .map_err(|_| NativeError::new("native-runtime-state"))?;
    operation(&mut runtime)
}

fn state_report(runtime: &ConversationRuntime) -> RuntimeStateReport {
    RuntimeStateReport {
        schema: "tinyrustlm.native.runtime_state/1",
        state: runtime_state_label(runtime.state()),
        operation_id: hex_lower(&runtime.operation().bytes()),
        transcript_revision: runtime.transcript().revision(),
        active_composition: runtime.active_identity().map(identity_report),
        committed_kv_bytes: runtime.committed_kv_bytes(),
        memory_plan: runtime.memory_plan().map(MemoryPlanReport::from),
    }
}

fn step_report(step: RuntimeStep) -> RuntimeStepReport {
    RuntimeStepReport {
        schema: "tinyrustlm.native.runtime_step/1",
        selected_token_id: step.selected_token_id(),
        emitted_token_id: step.emitted_token_id(),
        status: generation_status_report(step.status()),
        committed_kv_bytes: step.committed_kv_bytes(),
    }
}

fn output_report(output: RuntimeOutput) -> RuntimeOutputReport {
    RuntimeOutputReport {
        schema: "tinyrustlm.native.runtime_output/1",
        text: output.text().to_owned(),
        token_ids: output.token_ids().to_vec(),
        status: generation_status_report(output.status()),
        composition: identity_report(output.composition()),
        operation_id: hex_lower(&output.operation().bytes()),
        committed_kv_bytes: output.committed_kv_bytes(),
    }
}

fn identity_report(identity: Acg2Identity) -> Acg2IdentityReport {
    Acg2IdentityReport {
        artifact_bytes: identity.artifact_bytes,
        artifact_sha256: hex_lower(&identity.artifact_sha256),
        graph_identity_sha256: hex_lower(&identity.graph_identity_sha256),
        member_table_sha256: hex_lower(&identity.member_table_sha256),
    }
}

fn generation_status_report(status: GenerationStatus) -> GenerationStatusReport {
    match status {
        GenerationStatus::Active => GenerationStatusReport {
            kind: "active",
            stop_token_id: None,
        },
        GenerationStatus::StopToken(token_id) => GenerationStatusReport {
            kind: "stop-token",
            stop_token_id: Some(token_id),
        },
        GenerationStatus::MaximumNewTokens => GenerationStatusReport {
            kind: "maximum-new-tokens",
            stop_token_id: None,
        },
        GenerationStatus::ContextLimit => GenerationStatusReport {
            kind: "context-limit",
            stop_token_id: None,
        },
        GenerationStatus::Cancelled => GenerationStatusReport {
            kind: "cancelled",
            stop_token_id: None,
        },
    }
}

const fn runtime_state_label(state: RuntimeState) -> &'static str {
    match state {
        RuntimeState::Empty => "empty",
        RuntimeState::ActiveIdle => "active-idle",
        RuntimeState::Generating => "generating",
        RuntimeState::TerminalOutputReady => "terminal-output-ready",
    }
}

impl From<MemoryPlan> for MemoryPlanReport {
    fn from(plan: MemoryPlan) -> Self {
        Self {
            model_bytes: plan.model_bytes,
            kv_bytes: plan.kv_bytes,
            scratch_bytes: plan.scratch_bytes,
        }
    }
}

struct PathMemberResolver {
    members: MemberPaths,
}

impl PathMemberResolver {
    fn path(&self, role: MemberRole) -> &Path {
        match role {
            MemberRole::Model => &self.members.model,
            MemberRole::Tokenizer => &self.members.tokenizer,
            MemberRole::Template => &self.members.template,
            MemberRole::Sampling => &self.members.sampling,
            MemberRole::Prompt => &self.members.prompt,
        }
    }
}

impl MemberResolver for PathMemberResolver {
    fn open(&mut self, role: MemberRole, _identity: Acg2Member) -> Option<Box<dyn Acg2Read>> {
        open_regular_file(self.path(role))
            .ok()
            .map(|file| Box::new(file) as Box<dyn Acg2Read>)
    }
}
