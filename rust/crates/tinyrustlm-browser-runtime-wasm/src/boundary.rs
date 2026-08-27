use serde::Serialize;
use tinyrustlm_composition2::{Acg2Identity, OperationIdentity, TranscriptState};
use tinyrustlm_runtime::{
    ConversationPolicy, ConversationRuntime, MemoryPlan, RuntimeError, RuntimeOutput,
    RuntimePolicy, RuntimeState, RuntimeStep,
};
use tinyrustlm_sampling2::GenerationStatus;

use crate::resolver::MemoryResolver;

pub(crate) const MAXIMUM_RESULT_BYTES: usize = 16_777_216;
const MAXIMUM_MODEL_BYTES: u32 = 2_147_483_648;
const MAXIMUM_SEQUENCE_TOKENS: u32 = 40_960;
const MAXIMUM_KV_BYTES: u32 = 2_147_483_648;
const MAXIMUM_SCRATCH_BYTES: u32 = 1_073_741_824;
const MAXIMUM_RESOLVED_MEMBER_BYTES: u32 = 2_281_701_376;
const MAXIMUM_RESIDENT_DEPENDENCY_BYTES: u32 = 134_217_728;
const MAXIMUM_REQUEST_BYTES: u32 = 16_777_216;
const MAXIMUM_LINEAR_MEMORY_BYTES: u32 = 3_221_225_472;
const SAMPLING_BYTES: u32 = 65_800;
const PROMPT_BYTES: u32 = 512;
const COMPOSITION_BYTES: u32 = 896;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum FailureClass {
    Boundary,
    Runtime,
    Internal,
}

impl FailureClass {
    pub(crate) const fn status(self) -> u32 {
        match self {
            Self::Boundary => crate::STATUS_BOUNDARY_REJECTED,
            Self::Runtime => crate::STATUS_RUNTIME_REJECTED,
            Self::Internal => crate::STATUS_INTERNAL_FAILURE,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct BoundaryFailure {
    class: FailureClass,
    code: &'static str,
}

impl BoundaryFailure {
    pub(crate) const fn boundary(code: &'static str) -> Self {
        Self {
            class: FailureClass::Boundary,
            code,
        }
    }

    pub(crate) const fn internal(code: &'static str) -> Self {
        Self {
            class: FailureClass::Internal,
            code,
        }
    }

    pub(crate) const fn class(self) -> FailureClass {
        self.class
    }

    pub(crate) const fn code(self) -> &'static str {
        self.code
    }
}

impl From<RuntimeError> for BoundaryFailure {
    fn from(value: RuntimeError) -> Self {
        Self {
            class: FailureClass::Runtime,
            code: value.code(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub(crate) enum TransferKind {
    ExpectedOperation = 1,
    NextOperation = 2,
    Model = 3,
    Tokenizer = 4,
    Template = 5,
    Sampling = 6,
    Prompt = 7,
    Composition = 8,
    PromptRequest = 9,
}

impl TransferKind {
    pub(crate) fn parse(value: u32) -> Result<Self, BoundaryFailure> {
        match value {
            1 => Ok(Self::ExpectedOperation),
            2 => Ok(Self::NextOperation),
            3 => Ok(Self::Model),
            4 => Ok(Self::Tokenizer),
            5 => Ok(Self::Template),
            6 => Ok(Self::Sampling),
            7 => Ok(Self::Prompt),
            8 => Ok(Self::Composition),
            9 => Ok(Self::PromptRequest),
            _ => Err(BoundaryFailure::boundary("browser-runtime-transfer-kind")),
        }
    }

    fn accepts_length(
        self,
        length: u32,
        policy: Option<BoundaryPolicy>,
    ) -> Result<bool, BoundaryFailure> {
        if length == 0 {
            return Ok(false);
        }
        match self {
            Self::ExpectedOperation | Self::NextOperation => Ok(length == 32),
            Self::Composition => require_policy(policy).map(|_| length == COMPOSITION_BYTES),
            Self::Model => require_policy(policy).map(|value| length <= value.maximum_model_bytes),
            Self::Tokenizer => require_policy(policy).map(|_| length <= 67_108_864),
            Self::Template => require_policy(policy).map(|_| length <= 1_048_576),
            Self::Sampling => require_policy(policy).map(|_| length == SAMPLING_BYTES),
            Self::Prompt => require_policy(policy).map(|_| length == PROMPT_BYTES),
            Self::PromptRequest => {
                require_policy(policy).map(|value| length <= value.maximum_request_bytes)
            }
        }
    }
}

fn require_policy(policy: Option<BoundaryPolicy>) -> Result<BoundaryPolicy, BoundaryFailure> {
    policy.ok_or_else(|| BoundaryFailure::boundary("browser-runtime-create-required"))
}

struct PendingTransfer {
    kind: TransferKind,
    bytes: Vec<u8>,
}

#[derive(Default)]
struct StagedTransfers {
    expected_operation: Option<Vec<u8>>,
    next_operation: Option<Vec<u8>>,
    model: Option<Vec<u8>>,
    tokenizer: Option<Vec<u8>>,
    template: Option<Vec<u8>>,
    sampling: Option<Vec<u8>>,
    prompt: Option<Vec<u8>>,
    composition: Option<Vec<u8>>,
    prompt_request: Option<Vec<u8>>,
}

impl StagedTransfers {
    fn get(&self, kind: TransferKind) -> Option<&Vec<u8>> {
        match kind {
            TransferKind::ExpectedOperation => self.expected_operation.as_ref(),
            TransferKind::NextOperation => self.next_operation.as_ref(),
            TransferKind::Model => self.model.as_ref(),
            TransferKind::Tokenizer => self.tokenizer.as_ref(),
            TransferKind::Template => self.template.as_ref(),
            TransferKind::Sampling => self.sampling.as_ref(),
            TransferKind::Prompt => self.prompt.as_ref(),
            TransferKind::Composition => self.composition.as_ref(),
            TransferKind::PromptRequest => self.prompt_request.as_ref(),
        }
    }

    fn insert(&mut self, kind: TransferKind, bytes: Vec<u8>) -> Result<(), BoundaryFailure> {
        let slot = match kind {
            TransferKind::ExpectedOperation => &mut self.expected_operation,
            TransferKind::NextOperation => &mut self.next_operation,
            TransferKind::Model => &mut self.model,
            TransferKind::Tokenizer => &mut self.tokenizer,
            TransferKind::Template => &mut self.template,
            TransferKind::Sampling => &mut self.sampling,
            TransferKind::Prompt => &mut self.prompt,
            TransferKind::Composition => &mut self.composition,
            TransferKind::PromptRequest => &mut self.prompt_request,
        };
        if slot.is_some() {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-duplicate",
            ));
        }
        *slot = Some(bytes);
        Ok(())
    }

    fn take(&mut self, kind: TransferKind) -> Option<Vec<u8>> {
        match kind {
            TransferKind::ExpectedOperation => self.expected_operation.take(),
            TransferKind::NextOperation => self.next_operation.take(),
            TransferKind::Model => self.model.take(),
            TransferKind::Tokenizer => self.tokenizer.take(),
            TransferKind::Template => self.template.take(),
            TransferKind::Sampling => self.sampling.take(),
            TransferKind::Prompt => self.prompt.take(),
            TransferKind::Composition => self.composition.take(),
            TransferKind::PromptRequest => self.prompt_request.take(),
        }
    }

    fn byte_length(&self) -> u64 {
        [
            self.expected_operation.as_ref(),
            self.next_operation.as_ref(),
            self.model.as_ref(),
            self.tokenizer.as_ref(),
            self.template.as_ref(),
            self.sampling.as_ref(),
            self.prompt.as_ref(),
            self.composition.as_ref(),
            self.prompt_request.as_ref(),
        ]
        .into_iter()
        .flatten()
        .map(|bytes| bytes.len() as u64)
        .sum()
    }

    fn clear_activation_candidate(&mut self) {
        self.model = None;
        self.tokenizer = None;
        self.template = None;
        self.sampling = None;
        self.prompt = None;
        self.composition = None;
    }

    #[cfg(test)]
    fn activation_candidate_is_empty(&self) -> bool {
        self.model.is_none()
            && self.tokenizer.is_none()
            && self.template.is_none()
            && self.sampling.is_none()
            && self.prompt.is_none()
            && self.composition.is_none()
    }
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct BoundaryPolicy {
    maximum_model_bytes: u32,
    maximum_sequence_tokens: u32,
    maximum_kv_bytes: u32,
    maximum_scratch_bytes: u32,
    maximum_resolved_member_bytes: u32,
    maximum_resident_dependency_bytes: u32,
    maximum_request_bytes: u32,
    maximum_linear_memory_bytes: u32,
}

impl BoundaryPolicy {
    #[allow(clippy::too_many_arguments)]
    fn new(
        maximum_model_bytes: u32,
        maximum_sequence_tokens: u32,
        maximum_kv_bytes: u32,
        maximum_scratch_bytes: u32,
        maximum_resolved_member_bytes: u32,
        maximum_resident_dependency_bytes: u32,
        maximum_request_bytes: u32,
        maximum_linear_memory_bytes: u32,
    ) -> Result<Self, BoundaryFailure> {
        let values = [
            maximum_model_bytes,
            maximum_sequence_tokens,
            maximum_kv_bytes,
            maximum_scratch_bytes,
            maximum_resolved_member_bytes,
            maximum_resident_dependency_bytes,
            maximum_request_bytes,
            maximum_linear_memory_bytes,
        ];
        if values.contains(&0)
            || maximum_model_bytes > MAXIMUM_MODEL_BYTES
            || maximum_sequence_tokens > MAXIMUM_SEQUENCE_TOKENS
            || maximum_kv_bytes > MAXIMUM_KV_BYTES
            || maximum_scratch_bytes > MAXIMUM_SCRATCH_BYTES
            || maximum_resolved_member_bytes > MAXIMUM_RESOLVED_MEMBER_BYTES
            || maximum_resident_dependency_bytes > MAXIMUM_RESIDENT_DEPENDENCY_BYTES
            || maximum_request_bytes > MAXIMUM_REQUEST_BYTES
            || maximum_linear_memory_bytes > MAXIMUM_LINEAR_MEMORY_BYTES
        {
            return Err(BoundaryFailure::boundary("browser-runtime-policy"));
        }
        let peak = u64::from(maximum_model_bytes)
            .checked_mul(2)
            .and_then(|value| value.checked_add(u64::from(maximum_kv_bytes)))
            .and_then(|value| value.checked_add(u64::from(maximum_scratch_bytes)))
            .and_then(|value| value.checked_add(u64::from(maximum_resident_dependency_bytes)))
            .and_then(|value| value.checked_add(u64::from(maximum_request_bytes)))
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-policy"))?;
        let required_resolved_member_bytes = maximum_model_bytes
            .checked_add(maximum_resident_dependency_bytes)
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-policy"))?;
        if peak > u64::from(maximum_linear_memory_bytes)
            || maximum_resolved_member_bytes < required_resolved_member_bytes
        {
            return Err(BoundaryFailure::boundary("browser-runtime-policy"));
        }
        Ok(Self {
            maximum_model_bytes,
            maximum_sequence_tokens,
            maximum_kv_bytes,
            maximum_scratch_bytes,
            maximum_resolved_member_bytes,
            maximum_resident_dependency_bytes,
            maximum_request_bytes,
            maximum_linear_memory_bytes,
        })
    }

    fn conversation(self) -> Result<ConversationPolicy, BoundaryFailure> {
        let scalar = RuntimePolicy::new(
            u64::from(self.maximum_model_bytes),
            self.maximum_sequence_tokens,
            u64::from(self.maximum_kv_bytes),
            u64::from(self.maximum_scratch_bytes),
        )
        .map_err(|error| BoundaryFailure {
            class: FailureClass::Runtime,
            code: error.code(),
        })?;
        ConversationPolicy::new(
            scalar,
            u64::from(self.maximum_resolved_member_bytes),
            u64::from(self.maximum_resident_dependency_bytes),
            self.maximum_request_bytes as usize,
        )
        .map_err(BoundaryFailure::from)
    }
}

#[derive(Default)]
pub(crate) struct BoundaryState {
    pending: Option<PendingTransfer>,
    staged: StagedTransfers,
    policy: Option<BoundaryPolicy>,
    runtime: Option<ConversationRuntime>,
    result: Vec<u8>,
    error: Vec<u8>,
    released: bool,
}

impl BoundaryState {
    pub(crate) fn clear_observation(&mut self) {
        self.result.clear();
        self.error.clear();
    }

    pub(crate) fn record_failure(&mut self, failure: BoundaryFailure) {
        self.result.clear();
        self.error.clear();
        self.error.extend_from_slice(failure.code().as_bytes());
    }

    pub(crate) fn result(&self) -> &[u8] {
        &self.result
    }

    pub(crate) fn set_result(&mut self, result: Vec<u8>) {
        self.result = result;
    }

    pub(crate) fn error(&self) -> &[u8] {
        &self.error
    }

    pub(crate) fn begin_transfer(
        &mut self,
        kind: u32,
        length: u32,
    ) -> Result<*mut u8, BoundaryFailure> {
        self.require_live_module()?;
        if self.pending.is_some() {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-pending",
            ));
        }
        let kind = TransferKind::parse(kind)?;
        if self.staged.get(kind).is_some() {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-duplicate",
            ));
        }
        if !kind.accepts_length(length, self.policy)? {
            return Err(BoundaryFailure::boundary("browser-runtime-transfer-length"));
        }
        let projected = self
            .estimated_owned_bytes()
            .checked_add(u64::from(length))
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-memory-policy"))?;
        if let Some(policy) = self.policy {
            if projected > u64::from(policy.maximum_linear_memory_bytes) {
                return Err(BoundaryFailure::boundary("browser-runtime-memory-policy"));
            }
        }
        let length = length as usize;
        let mut bytes = Vec::new();
        bytes
            .try_reserve_exact(length)
            .map_err(|_| BoundaryFailure::internal("browser-runtime-allocation"))?;
        bytes.resize(length, 0);
        let pointer = bytes.as_mut_ptr();
        self.pending = Some(PendingTransfer { kind, bytes });
        Ok(pointer)
    }

    pub(crate) fn commit_transfer(
        &mut self,
        kind: u32,
        pointer: *const u8,
        length: u32,
    ) -> Result<(), BoundaryFailure> {
        self.require_live_module()?;
        let Some(pending) = self.pending.take() else {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-required",
            ));
        };
        let parsed = TransferKind::parse(kind)?;
        if pending.kind != parsed
            || pending.bytes.as_ptr() != pointer
            || pending.bytes.len() != length as usize
        {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-identity",
            ));
        }
        self.staged.insert(parsed, pending.bytes)
    }

    pub(crate) fn cancel_transfer(&mut self) -> Result<(), BoundaryFailure> {
        self.require_live_module()?;
        if self.pending.take().is_none() {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-required",
            ));
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create(
        &mut self,
        maximum_model_bytes: u32,
        maximum_sequence_tokens: u32,
        maximum_kv_bytes: u32,
        maximum_scratch_bytes: u32,
        maximum_resolved_member_bytes: u32,
        maximum_resident_dependency_bytes: u32,
        maximum_request_bytes: u32,
        maximum_linear_memory_bytes: u32,
        transcript_revision_low: u32,
        transcript_revision_high: u32,
    ) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        if self.runtime.is_some() || self.policy.is_some() {
            return Err(BoundaryFailure::boundary("browser-runtime-already-created"));
        }
        let operation = self.take_operation(TransferKind::ExpectedOperation)?;
        let policy = BoundaryPolicy::new(
            maximum_model_bytes,
            maximum_sequence_tokens,
            maximum_kv_bytes,
            maximum_scratch_bytes,
            maximum_resolved_member_bytes,
            maximum_resident_dependency_bytes,
            maximum_request_bytes,
            maximum_linear_memory_bytes,
        )?;
        if observed_linear_memory_bytes() > u64::from(policy.maximum_linear_memory_bytes) {
            return Err(BoundaryFailure::boundary("browser-runtime-memory-policy"));
        }
        let transcript = join_u64(transcript_revision_low, transcript_revision_high);
        let runtime = ConversationRuntime::new(
            policy.conversation()?,
            operation,
            TranscriptState::new(transcript),
        );
        self.policy = Some(policy);
        self.runtime = Some(runtime);
        self.state_result()
    }

    pub(crate) fn activate(&mut self) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        self.require_created()?;
        let operation = self.take_operation(TransferKind::ExpectedOperation);
        let candidate = self.take_activation_candidate();
        let operation = operation?;
        let (composition, mut resolver) = candidate?;
        let runtime = self.runtime_mut()?;
        runtime.activate(&composition, &mut resolver, operation)?;
        self.enforce_observed_memory()?;
        self.state_result()
    }

    pub(crate) fn advance_operation(&mut self) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        self.require_created()?;
        let expected = self.take_operation(TransferKind::ExpectedOperation);
        let next = self.take_operation(TransferKind::NextOperation);
        let expected = expected?;
        let next = next?;
        if expected == next {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-operation-identity",
            ));
        }
        self.runtime_mut()?.advance_operation(expected, next)?;
        self.state_result()
    }

    pub(crate) fn set_transcript(
        &mut self,
        revision_low: u32,
        revision_high: u32,
    ) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        self.require_created()?;
        let expected = self.take_operation(TransferKind::ExpectedOperation)?;
        let runtime = self.runtime_mut()?;
        if runtime.operation() != expected {
            return Err(BoundaryFailure {
                class: FailureClass::Runtime,
                code: "acg2-stale-operation",
            });
        }
        runtime.set_transcript(TranscriptState::new(join_u64(revision_low, revision_high)))?;
        self.state_result()
    }

    pub(crate) fn begin_request(&mut self) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        self.require_created()?;
        let expected = self.take_operation(TransferKind::ExpectedOperation);
        let request = self
            .staged
            .take(TransferKind::PromptRequest)
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-request-required"));
        let expected = expected?;
        let request = request?;
        self.runtime_mut()?.begin_request(&request, expected)?;
        self.state_result()
    }

    pub(crate) fn step(&mut self, cancelled: u32) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        self.require_created()?;
        if cancelled > 1 {
            return Err(BoundaryFailure::boundary("browser-runtime-cancelled-value"));
        }
        let expected = self.take_operation(TransferKind::ExpectedOperation)?;
        let runtime = self.runtime_mut()?;
        require_current_operation(runtime, expected)?;
        let step = runtime.step(cancelled == 1)?;
        encode_json(&StepReport::from(step))
    }

    pub(crate) fn finish(&mut self) -> Result<Vec<u8>, BoundaryFailure> {
        self.require_live_module()?;
        self.require_no_pending()?;
        self.require_created()?;
        let expected = self.take_operation(TransferKind::ExpectedOperation)?;
        let runtime = self.runtime_mut()?;
        require_current_operation(runtime, expected)?;
        let output = runtime.finish()?;
        encode_json(&OutputReport::from(output))
    }

    pub(crate) fn release(&mut self) -> Result<(), BoundaryFailure> {
        self.require_live_module()?;
        self.require_created()?;
        *self = Self {
            released: true,
            ..Self::default()
        };
        Ok(())
    }

    fn take_operation(&mut self, kind: TransferKind) -> Result<OperationIdentity, BoundaryFailure> {
        let bytes = self
            .staged
            .take(kind)
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-operation-required"))?;
        let bytes: [u8; 32] = bytes
            .try_into()
            .map_err(|_| BoundaryFailure::boundary("browser-runtime-operation-identity"))?;
        OperationIdentity::new(bytes).map_err(|error| BoundaryFailure {
            class: FailureClass::Runtime,
            code: error.code(),
        })
    }

    fn take_activation_candidate(&mut self) -> Result<(Vec<u8>, MemoryResolver), BoundaryFailure> {
        let model = self.staged.model.take();
        let tokenizer = self.staged.tokenizer.take();
        let template = self.staged.template.take();
        let sampling = self.staged.sampling.take();
        let prompt = self.staged.prompt.take();
        let composition = self.staged.composition.take();
        match (model, tokenizer, template, sampling, prompt, composition) {
            (
                Some(model),
                Some(tokenizer),
                Some(template),
                Some(sampling),
                Some(prompt),
                Some(graph),
            ) => Ok((
                graph,
                MemoryResolver::new(model, tokenizer, template, sampling, prompt),
            )),
            _ => {
                self.staged.clear_activation_candidate();
                Err(BoundaryFailure::boundary(
                    "browser-runtime-composition-required",
                ))
            }
        }
    }

    fn runtime_mut(&mut self) -> Result<&mut ConversationRuntime, BoundaryFailure> {
        self.runtime
            .as_mut()
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-create-required"))
    }

    fn require_no_pending(&mut self) -> Result<(), BoundaryFailure> {
        if self.pending.take().is_some() {
            return Err(BoundaryFailure::boundary(
                "browser-runtime-transfer-pending",
            ));
        }
        Ok(())
    }

    fn require_live_module(&self) -> Result<(), BoundaryFailure> {
        if self.released {
            Err(BoundaryFailure::boundary("browser-runtime-released"))
        } else {
            Ok(())
        }
    }

    fn require_created(&self) -> Result<(), BoundaryFailure> {
        match (self.policy.is_some(), self.runtime.is_some()) {
            (true, true) => Ok(()),
            (false, false) => Err(BoundaryFailure::boundary("browser-runtime-create-required")),
            _ => Err(BoundaryFailure::internal("browser-runtime-state")),
        }
    }

    fn estimated_owned_bytes(&self) -> u64 {
        let pending = self
            .pending
            .as_ref()
            .map_or(0, |pending| pending.bytes.len() as u64);
        let runtime = self.runtime.as_ref().map_or(0, |runtime| {
            runtime.memory_plan().map_or(0, |plan| {
                plan.model_bytes
                    .saturating_add(plan.kv_bytes)
                    .saturating_add(plan.scratch_bytes)
                    .saturating_add(u64::from(
                        self.policy
                            .map_or(0, |policy| policy.maximum_resident_dependency_bytes),
                    ))
            })
        });
        pending
            .saturating_add(self.staged.byte_length())
            .saturating_add(runtime)
            .saturating_add(self.result.len() as u64)
            .saturating_add(self.error.len() as u64)
    }

    fn enforce_observed_memory(&self) -> Result<(), BoundaryFailure> {
        let policy = require_policy(self.policy)?;
        if self.estimated_owned_bytes() > u64::from(policy.maximum_linear_memory_bytes)
            || observed_linear_memory_bytes() > u64::from(policy.maximum_linear_memory_bytes)
        {
            return Err(BoundaryFailure::boundary("browser-runtime-memory-policy"));
        }
        Ok(())
    }

    fn state_result(&self) -> Result<Vec<u8>, BoundaryFailure> {
        encode_json(&StateReport::from_state(self)?)
    }
}

fn require_current_operation(
    runtime: &ConversationRuntime,
    expected: OperationIdentity,
) -> Result<(), BoundaryFailure> {
    if runtime.operation() != expected {
        return Err(BoundaryFailure {
            class: FailureClass::Runtime,
            code: "acg2-stale-operation",
        });
    }
    Ok(())
}

fn join_u64(low: u32, high: u32) -> u64 {
    u64::from(low) | (u64::from(high) << 32)
}

#[cfg(target_arch = "wasm32")]
fn observed_linear_memory_bytes() -> u64 {
    (core::arch::wasm32::memory_size::<0>() as u64).saturating_mul(65_536)
}

#[cfg(not(target_arch = "wasm32"))]
const fn observed_linear_memory_bytes() -> u64 {
    0
}

fn encode_json<T: Serialize>(value: &T) -> Result<Vec<u8>, BoundaryFailure> {
    let bytes = serde_json::to_vec(value)
        .map_err(|_| BoundaryFailure::internal("browser-runtime-result-serialization"))?;
    if bytes.is_empty() || bytes.len() > MAXIMUM_RESULT_BYTES {
        return Err(BoundaryFailure::internal("browser-runtime-result-limit"));
    }
    Ok(bytes)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StateReport {
    schema: &'static str,
    state: &'static str,
    operation_id: String,
    transcript_revision: u64,
    active_composition: Option<IdentityReport>,
    committed_kv_bytes: u64,
    memory_plan: Option<MemoryPlanReport>,
    observed_linear_memory_bytes: u64,
    maximum_linear_memory_bytes: u32,
}

impl StateReport {
    fn from_state(state: &BoundaryState) -> Result<Self, BoundaryFailure> {
        let runtime = state
            .runtime
            .as_ref()
            .ok_or_else(|| BoundaryFailure::boundary("browser-runtime-create-required"))?;
        let policy = require_policy(state.policy)?;
        Ok(Self {
            schema: "tinyrustlm.browser_runtime_wasm.state/1",
            state: runtime_state_label(runtime.state()),
            operation_id: hex_lower(&runtime.operation().bytes()),
            transcript_revision: runtime.transcript().revision(),
            active_composition: runtime.active_identity().map(IdentityReport::from),
            committed_kv_bytes: runtime.committed_kv_bytes(),
            memory_plan: runtime.memory_plan().map(MemoryPlanReport::from),
            observed_linear_memory_bytes: observed_linear_memory_bytes(),
            maximum_linear_memory_bytes: policy.maximum_linear_memory_bytes,
        })
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StepReport {
    schema: &'static str,
    selected_token_id: Option<u32>,
    emitted_token_id: Option<u32>,
    status: GenerationStatusReport,
    committed_kv_bytes: u64,
}

impl From<RuntimeStep> for StepReport {
    fn from(step: RuntimeStep) -> Self {
        Self {
            schema: "tinyrustlm.browser_runtime_wasm.step/1",
            selected_token_id: step.selected_token_id(),
            emitted_token_id: step.emitted_token_id(),
            status: GenerationStatusReport::from(step.status()),
            committed_kv_bytes: step.committed_kv_bytes(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputReport {
    schema: &'static str,
    text: String,
    token_ids: Vec<u32>,
    status: GenerationStatusReport,
    composition: IdentityReport,
    operation_id: String,
    committed_kv_bytes: u64,
}

impl From<RuntimeOutput> for OutputReport {
    fn from(output: RuntimeOutput) -> Self {
        Self {
            schema: "tinyrustlm.browser_runtime_wasm.output/1",
            text: output.text().to_owned(),
            token_ids: output.token_ids().to_vec(),
            status: GenerationStatusReport::from(output.status()),
            composition: IdentityReport::from(output.composition()),
            operation_id: hex_lower(&output.operation().bytes()),
            committed_kv_bytes: output.committed_kv_bytes(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IdentityReport {
    artifact_bytes: u64,
    artifact_sha256: String,
    graph_identity_sha256: String,
    member_table_sha256: String,
}

impl From<Acg2Identity> for IdentityReport {
    fn from(identity: Acg2Identity) -> Self {
        Self {
            artifact_bytes: identity.artifact_bytes,
            artifact_sha256: hex_lower(&identity.artifact_sha256),
            graph_identity_sha256: hex_lower(&identity.graph_identity_sha256),
            member_table_sha256: hex_lower(&identity.member_table_sha256),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryPlanReport {
    model_bytes: u64,
    kv_bytes: u64,
    scratch_bytes: u64,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerationStatusReport {
    kind: &'static str,
    stop_token_id: Option<u32>,
}

impl From<GenerationStatus> for GenerationStatusReport {
    fn from(status: GenerationStatus) -> Self {
        match status {
            GenerationStatus::Active => Self {
                kind: "active",
                stop_token_id: None,
            },
            GenerationStatus::StopToken(token_id) => Self {
                kind: "stop-token",
                stop_token_id: Some(token_id),
            },
            GenerationStatus::MaximumNewTokens => Self {
                kind: "maximum-new-tokens",
                stop_token_id: None,
            },
            GenerationStatus::ContextLimit => Self {
                kind: "context-limit",
                stop_token_id: None,
            },
            GenerationStatus::Cancelled => Self {
                kind: "cancelled",
                stop_token_id: None,
            },
        }
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

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stage(state: &mut BoundaryState, kind: TransferKind, bytes: &[u8]) {
        let pointer = state
            .begin_transfer(kind as u32, bytes.len() as u32)
            .expect("begin transfer");
        state
            .pending
            .as_mut()
            .expect("pending transfer")
            .bytes
            .copy_from_slice(bytes);
        state
            .commit_transfer(kind as u32, pointer, bytes.len() as u32)
            .expect("commit transfer");
    }

    fn create_state() -> BoundaryState {
        let mut state = BoundaryState::default();
        stage(&mut state, TransferKind::ExpectedOperation, &[7; 32]);
        state
            .create(
                1 << 20,
                128,
                1 << 20,
                1 << 20,
                2 << 20,
                1 << 20,
                1 << 20,
                8 << 20,
                11,
                0,
            )
            .expect("create runtime");
        state
    }

    #[test]
    fn policy_rejects_zero_hard_ceiling_and_impossible_transactional_peak() {
        let valid = [1, 1, 1, 1, 2, 1, 1, 8];
        for index in 0..valid.len() {
            let mut values = valid;
            values[index] = 0;
            assert_eq!(
                policy_from_values(values).expect_err("zero ceiling").code(),
                "browser-runtime-policy",
                "zero index {index}"
            );
        }
        let hard_ceilings = [
            MAXIMUM_MODEL_BYTES,
            MAXIMUM_SEQUENCE_TOKENS,
            MAXIMUM_KV_BYTES,
            MAXIMUM_SCRATCH_BYTES,
            MAXIMUM_RESOLVED_MEMBER_BYTES,
            MAXIMUM_RESIDENT_DEPENDENCY_BYTES,
            MAXIMUM_REQUEST_BYTES,
            MAXIMUM_LINEAR_MEMORY_BYTES,
        ];
        for (index, ceiling) in hard_ceilings.into_iter().enumerate() {
            let mut values = valid;
            values[index] = ceiling + 1;
            assert_eq!(
                policy_from_values(values).expect_err("hard ceiling").code(),
                "browser-runtime-policy",
                "hard ceiling index {index}"
            );
        }
        assert_eq!(
            BoundaryPolicy::new(1024, 1, 1024, 1024, 2048, 1024, 1024, 4096)
                .expect_err("transactional peak")
                .code(),
            "browser-runtime-policy"
        );
        assert_eq!(
            BoundaryPolicy::new(1024, 1, 1, 1, 1024, 1024, 1, 4096)
                .expect_err("resolved member sum")
                .code(),
            "browser-runtime-policy"
        );
    }

    fn policy_from_values(values: [u32; 8]) -> Result<BoundaryPolicy, BoundaryFailure> {
        BoundaryPolicy::new(
            values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7],
        )
    }

    #[test]
    fn uninitialized_module_rejects_runtime_commands_and_release() {
        let mut state = BoundaryState::default();
        assert_eq!(
            state.activate().expect_err("activate").code(),
            "browser-runtime-create-required"
        );
        assert_eq!(
            state.advance_operation().expect_err("advance").code(),
            "browser-runtime-create-required"
        );
        assert_eq!(
            state.set_transcript(1, 0).expect_err("transcript").code(),
            "browser-runtime-create-required"
        );
        assert_eq!(
            state.begin_request().expect_err("request").code(),
            "browser-runtime-create-required"
        );
        assert_eq!(
            state.step(0).expect_err("step").code(),
            "browser-runtime-create-required"
        );
        assert_eq!(
            state.finish().expect_err("finish").code(),
            "browser-runtime-create-required"
        );
        assert_eq!(
            state.release().expect_err("release").code(),
            "browser-runtime-create-required"
        );
        assert!(!state.released);
    }

    #[test]
    fn transfer_identity_mismatch_drops_the_pending_allocation() {
        let mut state = BoundaryState::default();
        let pointer = state
            .begin_transfer(TransferKind::ExpectedOperation as u32, 32)
            .expect("begin");
        assert_eq!(
            state
                .commit_transfer(TransferKind::ExpectedOperation as u32, pointer, 31)
                .expect_err("length mismatch")
                .code(),
            "browser-runtime-transfer-identity"
        );
        assert!(state.pending.is_none());
        assert!(state.staged.get(TransferKind::ExpectedOperation).is_none());
    }

    #[test]
    fn duplicate_committed_kind_never_replaces_original_bytes() {
        let mut state = BoundaryState::default();
        stage(&mut state, TransferKind::ExpectedOperation, &[7; 32]);
        assert_eq!(
            state
                .begin_transfer(TransferKind::ExpectedOperation as u32, 32)
                .expect_err("duplicate")
                .code(),
            "browser-runtime-transfer-duplicate"
        );
        assert_eq!(
            state
                .staged
                .get(TransferKind::ExpectedOperation)
                .expect("original"),
            &[7; 32]
        );
    }

    #[test]
    fn stale_operation_rejects_before_transcript_mutation() {
        let mut state = create_state();
        stage(&mut state, TransferKind::ExpectedOperation, &[8; 32]);
        assert_eq!(
            state
                .set_transcript(19, 0)
                .expect_err("stale operation")
                .code(),
            "acg2-stale-operation"
        );
        assert_eq!(state.runtime.as_ref().unwrap().transcript().revision(), 11);
    }

    #[test]
    fn malformed_candidate_is_consumed_and_empty_runtime_is_preserved() {
        let mut state = create_state();
        stage(&mut state, TransferKind::ExpectedOperation, &[7; 32]);
        stage(&mut state, TransferKind::Model, &[1; 1024]);
        stage(&mut state, TransferKind::Tokenizer, &[2]);
        stage(&mut state, TransferKind::Template, &[3]);
        stage(
            &mut state,
            TransferKind::Sampling,
            &[4; SAMPLING_BYTES as usize],
        );
        stage(
            &mut state,
            TransferKind::Prompt,
            &[5; PROMPT_BYTES as usize],
        );
        stage(
            &mut state,
            TransferKind::Composition,
            &[0; COMPOSITION_BYTES as usize],
        );

        assert_eq!(
            state.activate().expect_err("malformed graph").code(),
            "acg2-header"
        );
        assert_eq!(state.runtime.as_ref().unwrap().state(), RuntimeState::Empty);
        assert!(state.staged.activation_candidate_is_empty());
    }

    #[test]
    fn release_drops_every_owner_and_prevents_module_reuse() {
        let mut state = create_state();
        stage(&mut state, TransferKind::ExpectedOperation, &[7; 32]);
        state.result.extend_from_slice(b"private result");
        state.error.extend_from_slice(b"bounded-error");

        state.release().expect("release");

        assert!(state.runtime.is_none());
        assert!(state.policy.is_none());
        assert!(state.pending.is_none());
        assert_eq!(state.staged.byte_length(), 0);
        assert!(state.result.is_empty());
        assert!(state.error.is_empty());
        assert_eq!(
            state
                .begin_transfer(TransferKind::ExpectedOperation as u32, 32)
                .expect_err("released")
                .code(),
            "browser-runtime-released"
        );
    }
}
