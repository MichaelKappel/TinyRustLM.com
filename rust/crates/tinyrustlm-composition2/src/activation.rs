use crate::format::{Acg2Error, Acg2Identity};
use crate::resolution::PreparedComposition;

/// Exact operation identity used to reject stale asynchronous completion.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OperationIdentity([u8; 32]);

impl OperationIdentity {
    /// Creates one nonzero operation identity.
    pub fn new(bytes: [u8; 32]) -> Result<Self, Acg2Error> {
        if bytes.iter().all(|byte| *byte == 0) {
            return Err(Acg2Error::new("acg2-stale-operation"));
        }
        Ok(Self(bytes))
    }

    /// Returns exact operation bytes.
    pub const fn bytes(self) -> [u8; 32] {
        self.0
    }

    fn from_graph(identity: Acg2Identity) -> Self {
        Self(identity.graph_identity_sha256)
    }
}

/// Bounded generation state invalidated by a successful composition swap.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct GenerationState {
    token_ids: Vec<u32>,
}

impl GenerationState {
    /// Returns generated non-stop tokens committed under the active graph.
    pub fn token_ids(&self) -> &[u32] {
        &self.token_ids
    }
}

/// Visible transcript state preserved across success and failure.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct TranscriptState {
    revision: u64,
}

impl TranscriptState {
    /// Creates one visible transcript revision.
    pub const fn new(revision: u64) -> Self {
        Self { revision }
    }

    /// Returns the current visible transcript revision.
    pub const fn revision(self) -> u64 {
        self.revision
    }
}

/// Sole transactional activation owner for one active composition.
#[derive(Debug)]
pub struct ActivationState {
    active: Option<PreparedComposition>,
    kv_cache_bytes: u64,
    generation: GenerationState,
    operation: OperationIdentity,
    transcript: TranscriptState,
}

impl ActivationState {
    /// Creates an empty activation owner with explicit operation and transcript state.
    pub const fn new(operation: OperationIdentity, transcript: TranscriptState) -> Self {
        Self {
            active: None,
            kv_cache_bytes: 0,
            generation: GenerationState {
                token_ids: Vec::new(),
            },
            operation,
            transcript,
        }
    }

    /// Returns the active graph identity, if one graph is active.
    pub fn active_identity(&self) -> Option<Acg2Identity> {
        self.active.as_ref().map(|active| active.graph().identity())
    }

    /// Borrows the sole active prepared composition without copying ownership.
    pub fn active(&self) -> Option<&PreparedComposition> {
        self.active.as_ref()
    }

    /// Returns current committed KV payload bytes.
    pub const fn kv_cache_bytes(&self) -> u64 {
        self.kv_cache_bytes
    }

    /// Returns current generated-token state.
    pub const fn generation(&self) -> &GenerationState {
        &self.generation
    }

    /// Returns current operation identity.
    pub const fn operation(&self) -> OperationIdentity {
        self.operation
    }

    /// Returns current visible transcript state.
    pub const fn transcript(&self) -> TranscriptState {
        self.transcript
    }

    /// Records exact active KV bytes without changing composition identity.
    pub fn set_kv_cache_bytes(&mut self, bytes: u64) {
        self.kv_cache_bytes = bytes;
    }

    /// Records one generated non-stop token under the active graph.
    pub fn record_generated_token(&mut self, token_id: u32) -> Result<(), Acg2Error> {
        self.generation
            .token_ids
            .try_reserve(1)
            .map_err(|_| Acg2Error::new("acg2-resource-preflight"))?;
        self.generation.token_ids.push(token_id);
        Ok(())
    }

    /// Advances the caller-owned operation identity.
    pub fn set_operation(&mut self, operation: OperationIdentity) {
        self.operation = operation;
    }

    /// Replaces visible transcript state without touching model state.
    pub fn set_transcript(&mut self, transcript: TranscriptState) {
        self.transcript = transcript;
    }

    /// Begins one generation transaction under the current operation identity.
    ///
    /// A stale identity returns before mutation. Success preserves composition,
    /// operation, and transcript state while clearing composition-bound KV and
    /// generated-token accounting for the next request.
    pub fn begin_generation(
        &mut self,
        expected_operation: OperationIdentity,
    ) -> Result<(), Acg2Error> {
        if expected_operation != self.operation {
            return Err(Acg2Error::new("acg2-stale-operation"));
        }
        self.kv_cache_bytes = 0;
        self.generation.token_ids.clear();
        Ok(())
    }

    /// Performs one infallible ownership swap after the sole stale-operation check.
    ///
    /// Every candidate validation and resource check has already succeeded. A
    /// stale identity returns before mutation. Success installs one graph,
    /// clears incompatible KV and generation state, advances operation identity
    /// to the graph identity, and preserves the visible transcript.
    pub fn activate(
        &mut self,
        candidate: PreparedComposition,
        expected_operation: OperationIdentity,
    ) -> Result<(), Acg2Error> {
        if expected_operation != self.operation {
            return Err(Acg2Error::new("acg2-stale-operation"));
        }
        let next_operation = OperationIdentity::from_graph(candidate.graph().identity());
        self.active = Some(candidate);
        self.kv_cache_bytes = 0;
        self.generation.token_ids.clear();
        self.operation = next_operation;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::format::{write_acg2, Acg2Graph, Acg2Member, Acg2Policy, MemberRole};

    use super::*;

    fn fixture_graph(model_byte_length: u64, marker: u8) -> Acg2Graph {
        let members = [
            Acg2Member::new(MemberRole::Model, model_byte_length, [marker; 32]).unwrap(),
            Acg2Member::new(MemberRole::Tokenizer, 7_038_773, [2; 32]).unwrap(),
            Acg2Member::new(MemberRole::Template, 1_403, [3; 32]).unwrap(),
            Acg2Member::new(MemberRole::Sampling, 65_800, [4; 32]).unwrap(),
            Acg2Member::new(MemberRole::Prompt, 512, [5; 32]).unwrap(),
        ];
        let mut bytes = Vec::new();
        write_acg2(&mut bytes, &members).unwrap();
        Acg2Graph::from_bytes(&bytes, Acg2Policy::exact_profile_limits()).unwrap()
    }

    #[test]
    fn stale_operation_preserves_every_observable_state() {
        let operation = OperationIdentity::new([9; 32]).unwrap();
        let mut state = ActivationState::new(operation, TranscriptState::new(7));
        let initial = PreparedComposition::fixture(fixture_graph(8_704, 1));
        state.activate(initial, operation).unwrap();
        state.set_kv_cache_bytes(4_096);
        state.record_generated_token(42).unwrap();
        state.set_transcript(TranscriptState::new(8));
        let identity = state.active_identity();
        let operation_after_first = state.operation();
        let error = state
            .activate(
                PreparedComposition::fixture(fixture_graph(8_705, 6)),
                OperationIdentity::new([8; 32]).unwrap(),
            )
            .unwrap_err();
        assert_eq!(error.code(), "acg2-stale-operation");
        assert_eq!(state.active_identity(), identity);
        assert_eq!(state.kv_cache_bytes(), 4_096);
        assert_eq!(state.generation().token_ids(), [42]);
        assert_eq!(state.operation(), operation_after_first);
        assert_eq!(state.transcript(), TranscriptState::new(8));
    }

    #[test]
    fn successful_swap_clears_model_state_and_preserves_transcript() {
        let operation = OperationIdentity::new([9; 32]).unwrap();
        let mut state = ActivationState::new(operation, TranscriptState::new(12));
        state
            .activate(
                PreparedComposition::fixture(fixture_graph(8_704, 1)),
                operation,
            )
            .unwrap();
        state.set_kv_cache_bytes(8_192);
        state.record_generated_token(7).unwrap();
        let old_identity = state.active_identity();
        let current_operation = state.operation();
        state
            .activate(
                PreparedComposition::fixture(fixture_graph(8_705, 6)),
                current_operation,
            )
            .unwrap();
        assert_ne!(state.active_identity(), old_identity);
        assert_eq!(state.kv_cache_bytes(), 0);
        assert!(state.generation().token_ids().is_empty());
        assert_eq!(state.transcript(), TranscriptState::new(12));
        assert_eq!(
            state.operation().bytes(),
            state.active_identity().unwrap().graph_identity_sha256
        );
    }

    #[test]
    fn active_borrow_preserves_the_single_prepared_owner() {
        let operation = OperationIdentity::new([9; 32]).unwrap();
        let mut state = ActivationState::new(operation, TranscriptState::new(4));
        assert!(state.active().is_none());
        state
            .activate(
                PreparedComposition::fixture(fixture_graph(8_704, 1)),
                operation,
            )
            .unwrap();
        assert_eq!(
            state.active().unwrap().graph().identity(),
            state.active_identity().unwrap()
        );
    }

    #[test]
    fn begin_generation_is_stale_safe_and_clears_only_request_state() {
        let operation = OperationIdentity::new([9; 32]).unwrap();
        let transcript = TranscriptState::new(15);
        let mut state = ActivationState::new(operation, transcript);
        state
            .activate(
                PreparedComposition::fixture(fixture_graph(8_704, 1)),
                operation,
            )
            .unwrap();
        state.set_kv_cache_bytes(4_096);
        state.record_generated_token(17).unwrap();
        let identity = state.active_identity();
        let current_operation = state.operation();

        assert_eq!(
            state
                .begin_generation(OperationIdentity::new([8; 32]).unwrap())
                .unwrap_err()
                .code(),
            "acg2-stale-operation"
        );
        assert_eq!(state.active_identity(), identity);
        assert_eq!(state.operation(), current_operation);
        assert_eq!(state.transcript(), transcript);
        assert_eq!(state.kv_cache_bytes(), 4_096);
        assert_eq!(state.generation().token_ids(), [17]);

        state.begin_generation(current_operation).unwrap();
        assert_eq!(state.active_identity(), identity);
        assert_eq!(state.operation(), current_operation);
        assert_eq!(state.transcript(), transcript);
        assert_eq!(state.kv_cache_bytes(), 0);
        assert!(state.generation().token_ids().is_empty());
    }

    #[test]
    fn zero_operation_identity_rejects() {
        assert_eq!(
            OperationIdentity::new([0; 32]).unwrap_err().code(),
            "acg2-stale-operation"
        );
    }
}
