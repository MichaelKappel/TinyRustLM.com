use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::{Read, SeekFrom};

use tinyrustlm_composition2::{
    prepare_composition, Acg2Graph, Acg2Identity, Acg2Member, Acg2Policy, ActivationState,
    MemberResolver, MemberRole, OperationIdentity, ResourcePlan, ResourcePreflight,
    TranscriptState,
};
use tinyrustlm_prompt2::Prompt2Plan;
use tinyrustlm_sampling2::GenerationStatus;

use crate::scalar::{MemoryPlan, RuntimePolicy, ScalarModel, ScalarSession};

/// A stable public-safe failure from the canonical conversation runtime.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeError {
    code: &'static str,
}

impl RuntimeError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for RuntimeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for RuntimeError {}

impl From<tinyrustlm_composition2::Acg2Error> for RuntimeError {
    fn from(value: tinyrustlm_composition2::Acg2Error) -> Self {
        Self::new(value.code())
    }
}

impl From<tinyrustlm_prompt2::Prompt2Error> for RuntimeError {
    fn from(value: tinyrustlm_prompt2::Prompt2Error) -> Self {
        Self::new(value.code())
    }
}

impl From<tinyrustlm_sampling2::Sampling2Error> for RuntimeError {
    fn from(value: tinyrustlm_sampling2::Sampling2Error) -> Self {
        Self::new(value.code())
    }
}

impl From<crate::scalar::ScalarRuntimeError> for RuntimeError {
    fn from(value: crate::scalar::ScalarRuntimeError) -> Self {
        Self::new(value.code())
    }
}

/// Complete mandatory ceilings for one canonical runtime instance.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ConversationPolicy {
    scalar: RuntimePolicy,
    maximum_resolved_member_bytes: u64,
    maximum_resident_dependency_bytes: u64,
    maximum_request_bytes: usize,
}

impl ConversationPolicy {
    /// Creates one policy with no implicit or unbounded limit.
    pub fn new(
        scalar: RuntimePolicy,
        maximum_resolved_member_bytes: u64,
        maximum_resident_dependency_bytes: u64,
        maximum_request_bytes: usize,
    ) -> Result<Self, RuntimeError> {
        if maximum_resolved_member_bytes == 0
            || maximum_resident_dependency_bytes == 0
            || maximum_request_bytes == 0
        {
            return Err(RuntimeError::new("runtime-invalid-policy"));
        }
        Ok(Self {
            scalar,
            maximum_resolved_member_bytes,
            maximum_resident_dependency_bytes,
            maximum_request_bytes,
        })
    }

    /// Returns the exact scalar model, context, KV, and scratch policy.
    pub const fn scalar(self) -> RuntimePolicy {
        self.scalar
    }

    /// Returns the maximum admitted sum of all graph member bytes.
    pub const fn maximum_resolved_member_bytes(self) -> u64 {
        self.maximum_resolved_member_bytes
    }

    /// Returns the maximum retained non-model dependency artifact bytes.
    pub const fn maximum_resident_dependency_bytes(self) -> u64 {
        self.maximum_resident_dependency_bytes
    }

    /// Returns the maximum accepted canonical Prompt2 request-wire bytes.
    pub const fn maximum_request_bytes(self) -> usize {
        self.maximum_request_bytes
    }
}

/// Observable lifecycle state of one runtime instance.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeState {
    /// No composition is active.
    Empty,
    /// One composition is active and no generation result is pending.
    ActiveIdle,
    /// A Sampling2 controller may advance.
    Generating,
    /// A terminal generation is ready for one exact decode.
    TerminalOutputReady,
}

/// One canonical generation transition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeStep {
    selected_token_id: Option<u32>,
    emitted_token_id: Option<u32>,
    status: GenerationStatus,
    committed_kv_bytes: u64,
}

impl RuntimeStep {
    /// Returns the Sampling2-selected token, including an invisible stop token.
    pub const fn selected_token_id(self) -> Option<u32> {
        self.selected_token_id
    }

    /// Returns the visible non-stop token, if this transition emitted one.
    pub const fn emitted_token_id(self) -> Option<u32> {
        self.emitted_token_id
    }

    /// Returns the controller state after this transition.
    pub const fn status(self) -> GenerationStatus {
        self.status
    }

    /// Returns exact committed F32 KV payload bytes after this transition.
    pub const fn committed_kv_bytes(self) -> u64 {
        self.committed_kv_bytes
    }
}

/// One terminal raw model output and the identities under which it was made.
#[derive(Debug, Eq, PartialEq)]
pub struct RuntimeOutput {
    text: String,
    token_ids: Vec<u32>,
    status: GenerationStatus,
    composition: Acg2Identity,
    operation: OperationIdentity,
    committed_kv_bytes: u64,
}

impl RuntimeOutput {
    /// Returns the exact decoded model output without repair or rewriting.
    pub fn text(&self) -> &str {
        &self.text
    }

    /// Returns visible generated non-stop IDs in exact order.
    pub fn token_ids(&self) -> &[u32] {
        &self.token_ids
    }

    /// Returns the terminal Sampling2 status.
    pub const fn status(&self) -> GenerationStatus {
        self.status
    }

    /// Returns the exact active composition identity.
    pub const fn composition(&self) -> Acg2Identity {
        self.composition
    }

    /// Returns the exact operation identity at completion.
    pub const fn operation(&self) -> OperationIdentity {
        self.operation
    }

    /// Returns exact committed F32 KV payload bytes at completion.
    pub const fn committed_kv_bytes(&self) -> u64 {
        self.committed_kv_bytes
    }
}

/// Sole host-facing owner of composition, prompt, sampling, scalar, and KV state.
#[derive(Debug)]
pub struct ConversationRuntime {
    policy: ConversationPolicy,
    activation: ActivationState,
    session: Option<ScalarSession>,
    committed_tokens: Vec<u32>,
    visible_tokens: Vec<u32>,
    logit_bits: Vec<u32>,
    generation: Option<Prompt2Plan>,
    state: RuntimeState,
}

impl ConversationRuntime {
    /// Creates an empty runtime under explicit operation and transcript state.
    pub const fn new(
        policy: ConversationPolicy,
        operation: OperationIdentity,
        transcript: TranscriptState,
    ) -> Self {
        Self {
            policy,
            activation: ActivationState::new(operation, transcript),
            session: None,
            committed_tokens: Vec::new(),
            visible_tokens: Vec::new(),
            logit_bits: Vec::new(),
            generation: None,
            state: RuntimeState::Empty,
        }
    }

    /// Returns the current lifecycle state.
    pub const fn state(&self) -> RuntimeState {
        self.state
    }

    /// Returns the current operation identity used for stale-message rejection.
    pub const fn operation(&self) -> OperationIdentity {
        self.activation.operation()
    }

    /// Returns the visible transcript revision, which activation never replaces.
    pub const fn transcript(&self) -> TranscriptState {
        self.activation.transcript()
    }

    /// Returns the active composition identity, if one is installed.
    pub fn active_identity(&self) -> Option<Acg2Identity> {
        self.activation.active_identity()
    }

    /// Returns current exact committed F32 KV payload bytes.
    pub const fn committed_kv_bytes(&self) -> u64 {
        self.activation.kv_cache_bytes()
    }

    /// Returns the exact retained model, reserved KV, and scratch plan.
    pub fn memory_plan(&self) -> Option<MemoryPlan> {
        self.session.as_ref().map(ScalarSession::memory_plan)
    }

    /// Advances an idle runtime from one exact operation identity to the next.
    ///
    /// The compare-and-swap shape prevents a stale host callback from making
    /// itself current. Composition, transcript, committed tokens, and KV remain
    /// unchanged.
    pub fn advance_operation(
        &mut self,
        expected_current: OperationIdentity,
        next: OperationIdentity,
    ) -> Result<(), RuntimeError> {
        if self.generation.is_some() {
            return Err(RuntimeError::new("runtime-generation-pending"));
        }
        if self.activation.operation() != expected_current {
            return Err(RuntimeError::new("acg2-stale-operation"));
        }
        self.activation.set_operation(next);
        Ok(())
    }

    /// Replaces presentation-owned transcript revision outside generation.
    pub fn set_transcript(&mut self, transcript: TranscriptState) -> Result<(), RuntimeError> {
        if self.generation.is_some() {
            return Err(RuntimeError::new("runtime-generation-pending"));
        }
        self.activation.set_transcript(transcript);
        Ok(())
    }

    /// Fully prepares and transactionally activates one exact ACG2 composition.
    pub fn activate<R: MemberResolver>(
        &mut self,
        graph_bytes: &[u8],
        resolver: &mut R,
        expected_operation: OperationIdentity,
    ) -> Result<Acg2Identity, RuntimeError> {
        if self.generation.is_some() {
            return Err(RuntimeError::new("runtime-generation-pending"));
        }
        let graph = Acg2Graph::from_bytes(graph_bytes, Acg2Policy::exact_profile_limits())?;
        let mut preflight = PolicyPreflight {
            policy: self.policy,
        };
        let candidate = prepare_composition(graph, resolver, &mut preflight)?;
        let model_member = graph.member(MemberRole::Model);
        let model_bytes = read_exact_model_member(resolver, model_member)?;
        let model = ScalarModel::from_bytes(model_bytes, self.policy.scalar)?;
        if model.artifact_sha256() != candidate.model().identity().artifact_sha256()
            || model.spec() != candidate.model().spec()
        {
            return Err(RuntimeError::new("runtime-model-identity"));
        }
        let session = ScalarSession::new(model, self.policy.scalar)?;
        let maximum_tokens = checked_usize(self.policy.scalar.maximum_sequence_tokens())?;
        let vocabulary_size = checked_usize(session.spec().vocabulary_size)?;
        let logit_bytes = u64::from(session.spec().vocabulary_size)
            .checked_mul(4)
            .ok_or_else(|| RuntimeError::new("runtime-arithmetic"))?;
        let total_scratch = session
            .memory_plan()
            .scratch_bytes
            .checked_add(logit_bytes)
            .ok_or_else(|| RuntimeError::new("runtime-arithmetic"))?;
        if total_scratch > self.policy.scalar.maximum_scratch_bytes() {
            return Err(RuntimeError::new("runtime-scratch-budget"));
        }
        let mut committed_tokens = Vec::new();
        committed_tokens
            .try_reserve_exact(maximum_tokens)
            .map_err(|_| RuntimeError::new("runtime-allocation"))?;
        let mut visible_tokens = Vec::new();
        visible_tokens
            .try_reserve_exact(maximum_tokens)
            .map_err(|_| RuntimeError::new("runtime-allocation"))?;
        let mut logit_bits = Vec::new();
        logit_bits
            .try_reserve_exact(vocabulary_size)
            .map_err(|_| RuntimeError::new("runtime-allocation"))?;

        self.activation.activate(candidate, expected_operation)?;
        self.session = Some(session);
        self.committed_tokens = committed_tokens;
        self.visible_tokens = visible_tokens;
        self.logit_bits = logit_bits;
        self.generation = None;
        self.state = RuntimeState::ActiveIdle;
        Ok(graph.identity())
    }

    /// Compiles one Prompt2 wire and transactionally establishes its prefill.
    pub fn begin_request(
        &mut self,
        request_bytes: &[u8],
        expected_operation: OperationIdentity,
    ) -> Result<RuntimeState, RuntimeError> {
        if self.state != RuntimeState::ActiveIdle || self.generation.is_some() {
            return Err(RuntimeError::new("runtime-not-idle"));
        }
        if request_bytes.len() > self.policy.maximum_request_bytes {
            return Err(RuntimeError::new("runtime-request-limit"));
        }
        let plan = self
            .activation
            .active()
            .ok_or_else(|| RuntimeError::new("runtime-composition-required"))?
            .prompt()
            .compile_request_bytes(request_bytes, self.policy.maximum_request_bytes)?;
        let prompt_tokens = plan.result().token_ids();
        if prompt_tokens.is_empty()
            || prompt_tokens.len() > checked_usize(self.policy.scalar.maximum_sequence_tokens())?
        {
            return Err(RuntimeError::new("runtime-sequence-limit"));
        }
        let maximum_tokens = checked_usize(self.policy.scalar.maximum_sequence_tokens())?;
        if self.visible_tokens.capacity() < maximum_tokens {
            self.visible_tokens
                .try_reserve_exact(maximum_tokens - self.visible_tokens.capacity())
                .map_err(|_| RuntimeError::new("runtime-allocation"))?;
        }
        self.activation.begin_generation(expected_operation)?;
        self.visible_tokens.clear();

        let session = self
            .session
            .as_mut()
            .ok_or_else(|| RuntimeError::new("runtime-session-required"))?;
        let observed_position = checked_usize(session.position()?)?;
        let reuse = observed_position == self.committed_tokens.len()
            && prompt_tokens.starts_with(&self.committed_tokens);
        let start = if reuse {
            self.committed_tokens.len()
        } else {
            session.reset();
            self.committed_tokens.clear();
            self.logit_bits.clear();
            0
        };

        for token_id in &prompt_tokens[start..] {
            let logits = match session.forward_token(*token_id) {
                Ok(logits) => logits,
                Err(error) => {
                    self.abort_generation_state()?;
                    return Err(error.into());
                }
            };
            if let Err(error) = store_logit_bits(&mut self.logit_bits, logits) {
                self.abort_generation_state()?;
                return Err(error);
            }
            if self.committed_tokens.len() == self.committed_tokens.capacity() {
                self.abort_generation_state()?;
                return Err(RuntimeError::new("runtime-sequence-limit"));
            }
            self.committed_tokens.push(*token_id);
        }
        if self.logit_bits.is_empty() {
            self.abort_generation_state()?;
            return Err(RuntimeError::new("runtime-logits-required"));
        }
        let kv_bytes = session.committed_kv_bytes()?;
        self.activation.set_kv_cache_bytes(kv_bytes);
        self.state = match plan.controller().status() {
            GenerationStatus::Active => RuntimeState::Generating,
            GenerationStatus::ContextLimit => RuntimeState::TerminalOutputReady,
            _ => {
                self.abort_generation_state()?;
                return Err(RuntimeError::new("runtime-controller-state"));
            }
        };
        self.generation = Some(plan);
        Ok(self.state)
    }

    /// Advances Sampling2 and scalar KV exactly once.
    pub fn step(&mut self, cancelled: bool) -> Result<RuntimeStep, RuntimeError> {
        if self.state != RuntimeState::Generating {
            return Err(RuntimeError::new("runtime-not-generating"));
        }
        let transition = {
            let sampling = self
                .activation
                .active()
                .ok_or_else(|| RuntimeError::new("runtime-composition-required"))?
                .prompt()
                .sampling();
            self.generation
                .as_mut()
                .ok_or_else(|| RuntimeError::new("runtime-controller-required"))?
                .controller_mut()
                .step_bits(sampling, &self.logit_bits, cancelled)?
        };
        let mut emitted_token_id = None;
        if let Some(token_id) = transition.selected_token_id {
            if self.committed_tokens.len() == self.committed_tokens.capacity() {
                self.abort_generation_state()?;
                return Err(RuntimeError::new("runtime-sequence-limit"));
            }
            let logits = match self
                .session
                .as_mut()
                .ok_or_else(|| RuntimeError::new("runtime-session-required"))?
                .forward_token(token_id)
            {
                Ok(logits) => logits,
                Err(error) => {
                    self.abort_generation_state()?;
                    return Err(error.into());
                }
            };
            if let Err(error) = store_logit_bits(&mut self.logit_bits, logits) {
                self.abort_generation_state()?;
                return Err(error);
            }
            self.committed_tokens.push(token_id);
            if !matches!(transition.status, GenerationStatus::StopToken(_)) {
                if self.visible_tokens.len() == self.visible_tokens.capacity() {
                    self.abort_generation_state()?;
                    return Err(RuntimeError::new("runtime-sequence-limit"));
                }
                self.visible_tokens.push(token_id);
                if let Err(error) = self.activation.record_generated_token(token_id) {
                    self.abort_generation_state()?;
                    return Err(error.into());
                }
                emitted_token_id = Some(token_id);
            }
            let kv_bytes = self
                .session
                .as_ref()
                .ok_or_else(|| RuntimeError::new("runtime-session-required"))?
                .committed_kv_bytes()?;
            self.activation.set_kv_cache_bytes(kv_bytes);
        }
        if transition.status != GenerationStatus::Active {
            self.state = RuntimeState::TerminalOutputReady;
        }
        Ok(RuntimeStep {
            selected_token_id: transition.selected_token_id,
            emitted_token_id,
            status: transition.status,
            committed_kv_bytes: self.activation.kv_cache_bytes(),
        })
    }

    /// Decodes and consumes one terminal raw output exactly once.
    pub fn finish(&mut self) -> Result<RuntimeOutput, RuntimeError> {
        if self.state != RuntimeState::TerminalOutputReady {
            return Err(RuntimeError::new("runtime-output-not-ready"));
        }
        let status = self
            .generation
            .as_ref()
            .ok_or_else(|| RuntimeError::new("runtime-controller-required"))?
            .controller()
            .status();
        if status == GenerationStatus::Active {
            return Err(RuntimeError::new("runtime-controller-state"));
        }
        let mut text = String::new();
        self.activation
            .active()
            .ok_or_else(|| RuntimeError::new("runtime-composition-required"))?
            .prompt()
            .decode_generated(&self.visible_tokens, &mut text)?;
        let composition = self
            .activation
            .active_identity()
            .ok_or_else(|| RuntimeError::new("runtime-composition-required"))?;
        let output = RuntimeOutput {
            text,
            token_ids: std::mem::take(&mut self.visible_tokens),
            status,
            composition,
            operation: self.activation.operation(),
            committed_kv_bytes: self.activation.kv_cache_bytes(),
        };
        self.generation = None;
        self.state = RuntimeState::ActiveIdle;
        Ok(output)
    }

    fn abort_generation_state(&mut self) -> Result<(), RuntimeError> {
        if let Some(session) = self.session.as_mut() {
            session.reset();
        }
        self.committed_tokens.clear();
        self.visible_tokens.clear();
        self.logit_bits.clear();
        self.generation = None;
        let operation = self.activation.operation();
        self.activation.begin_generation(operation)?;
        self.state = if self.activation.active().is_some() {
            RuntimeState::ActiveIdle
        } else {
            RuntimeState::Empty
        };
        Ok(())
    }
}

struct PolicyPreflight {
    policy: ConversationPolicy,
}

impl ResourcePreflight for PolicyPreflight {
    fn accept(&mut self, plan: ResourcePlan) -> bool {
        plan.resolved_member_bytes() <= self.policy.maximum_resolved_member_bytes
            && plan.model_artifact_bytes() <= self.policy.scalar.maximum_model_bytes()
            && plan.resident_dependency_artifact_bytes()
                <= self.policy.maximum_resident_dependency_bytes
            && plan.stream_hash_buffer_bytes() == 1_048_576
    }
}

fn read_exact_model_member<R: MemberResolver>(
    resolver: &mut R,
    member: Acg2Member,
) -> Result<Vec<u8>, RuntimeError> {
    let mut source = resolver
        .open(MemberRole::Model, member)
        .ok_or_else(|| RuntimeError::new("runtime-model-open"))?;
    let observed = source
        .seek(SeekFrom::End(0))
        .map_err(|_| RuntimeError::new("runtime-model-length"))?;
    if observed != member.artifact_bytes() {
        return Err(RuntimeError::new("runtime-model-length"));
    }
    source
        .seek(SeekFrom::Start(0))
        .map_err(|_| RuntimeError::new("runtime-model-length"))?;
    let length = checked_usize_u64(observed)?;
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| RuntimeError::new("runtime-allocation"))?;
    source
        .take(observed)
        .read_to_end(&mut bytes)
        .map_err(|_| RuntimeError::new("runtime-model-read"))?;
    if bytes.len() != length {
        return Err(RuntimeError::new("runtime-model-length"));
    }
    Ok(bytes)
}

fn store_logit_bits(output: &mut Vec<u32>, logits: &[f32]) -> Result<(), RuntimeError> {
    if logits.len() > output.capacity() || logits.iter().any(|logit| !logit.is_finite()) {
        return Err(RuntimeError::new("runtime-logits"));
    }
    output.clear();
    output.extend(logits.iter().map(|logit| logit.to_bits()));
    Ok(())
}

fn checked_usize(value: u32) -> Result<usize, RuntimeError> {
    usize::try_from(value).map_err(|_| RuntimeError::new("runtime-arithmetic"))
}

fn checked_usize_u64(value: u64) -> Result<usize, RuntimeError> {
    usize::try_from(value).map_err(|_| RuntimeError::new("runtime-arithmetic"))
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use tinyrustlm_composition2::{Acg2Member, Acg2Read};

    use super::*;

    struct EmptyResolver;

    impl MemberResolver for EmptyResolver {
        fn open(&mut self, _role: MemberRole, _identity: Acg2Member) -> Option<Box<dyn Acg2Read>> {
            Some(Box::new(Cursor::new(Vec::new())))
        }
    }

    fn policy() -> ConversationPolicy {
        ConversationPolicy::new(
            RuntimePolicy::new(1 << 20, 128, 1 << 20, 1 << 20).unwrap(),
            1 << 24,
            1 << 24,
            1 << 20,
        )
        .unwrap()
    }

    #[test]
    fn policy_rejects_every_implicit_zero_ceiling() {
        let scalar = RuntimePolicy::new(1 << 20, 128, 1 << 20, 1 << 20).unwrap();
        assert_eq!(
            ConversationPolicy::new(scalar, 0, 1, 1).unwrap_err().code(),
            "runtime-invalid-policy"
        );
        assert_eq!(
            ConversationPolicy::new(scalar, 1, 0, 1).unwrap_err().code(),
            "runtime-invalid-policy"
        );
        assert_eq!(
            ConversationPolicy::new(scalar, 1, 1, 0).unwrap_err().code(),
            "runtime-invalid-policy"
        );
    }

    #[test]
    fn malformed_activation_and_request_leave_the_empty_runtime_unchanged() {
        let operation = OperationIdentity::new([7; 32]).unwrap();
        let transcript = TranscriptState::new(11);
        let mut runtime = ConversationRuntime::new(policy(), operation, transcript);
        assert_eq!(
            runtime
                .activate(&[0; 896], &mut EmptyResolver, operation)
                .unwrap_err()
                .code(),
            "acg2-header"
        );
        assert_eq!(runtime.state(), RuntimeState::Empty);
        assert_eq!(runtime.operation(), operation);
        assert_eq!(runtime.transcript(), transcript);
        assert!(runtime.active_identity().is_none());
        assert_eq!(runtime.committed_kv_bytes(), 0);
        assert_eq!(
            runtime.begin_request(&[], operation).unwrap_err().code(),
            "runtime-not-idle"
        );
    }

    #[test]
    fn operation_advance_is_compare_and_swap_and_preserves_runtime_state() {
        let initial = OperationIdentity::new([7; 32]).unwrap();
        let next = OperationIdentity::new([8; 32]).unwrap();
        let transcript = TranscriptState::new(11);
        let mut runtime = ConversationRuntime::new(policy(), initial, transcript);
        assert_eq!(
            runtime
                .advance_operation(OperationIdentity::new([9; 32]).unwrap(), next)
                .unwrap_err()
                .code(),
            "acg2-stale-operation"
        );
        assert_eq!(runtime.operation(), initial);
        assert_eq!(runtime.transcript(), transcript);
        assert_eq!(runtime.state(), RuntimeState::Empty);

        runtime.advance_operation(initial, next).unwrap();
        assert_eq!(runtime.operation(), next);
        assert_eq!(runtime.transcript(), transcript);
        assert_eq!(runtime.state(), RuntimeState::Empty);
    }
}
