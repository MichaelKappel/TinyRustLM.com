#![deny(unsafe_code)]
#![doc = "Raw WASM conformance boundary for the scalar SLM2 correctness runtime."]

use std::sync::{Mutex, MutexGuard, OnceLock};
use tinyrustlm_slm2_runtime::{select_greedy, RuntimePolicy, ScalarSession};

const CANONICAL_MODEL: &[u8] =
    include_bytes!("../../tinyrustlm-slm2/fuzz/corpus/raw_slm2/01-canonical-valid-vector.seed");
const MAXIMUM_SEQUENCE_TOKENS: u32 = 128;
const MAXIMUM_KV_BYTES: u64 = 8_192;
const MAXIMUM_SCRATCH_BYTES: u64 = 1_048_576;
const LOGIT_BYTES: usize = 128;

/// Frozen raw conformance ABI version.
pub const ABI_VERSION: u32 = 1;
/// Successful operation status.
pub const STATUS_OK: u32 = 0;
/// Invalid ABI state or argument status.
pub const STATUS_BOUNDARY_ERROR: u32 = 1;
/// Scalar runtime rejection status.
pub const STATUS_RUNTIME_ERROR: u32 = 2;
/// Poisoned or otherwise unavailable internal-state status.
pub const STATUS_INTERNAL_ERROR: u32 = 3;

#[derive(Default)]
struct ConformanceState {
    error: Vec<u8>,
    greedy_token: u32,
    logits: Vec<u8>,
    session: Option<ScalarSession>,
}

static STATE: OnceLock<Mutex<ConformanceState>> = OnceLock::new();

fn state() -> &'static Mutex<ConformanceState> {
    STATE.get_or_init(|| Mutex::new(ConformanceState::default()))
}

fn lock_state() -> Result<MutexGuard<'static, ConformanceState>, u32> {
    state().lock().map_err(|_| STATUS_INTERNAL_ERROR)
}

fn clear_output(state: &mut ConformanceState) {
    state.error.clear();
    state.logits.clear();
    state.greedy_token = 0;
}

fn fail(state: &mut ConformanceState, code: &str, status: u32) -> u32 {
    clear_output(state);
    state.error.extend_from_slice(code.as_bytes());
    status
}

fn result_pointer(bytes: &[u8]) -> *const u8 {
    if bytes.is_empty() {
        core::ptr::null()
    } else {
        bytes.as_ptr()
    }
}

/// Returns the frozen conformance ABI version.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_abi_version() -> u32 {
    ABI_VERSION
}

/// Activates a fresh canonical-fixture session with one exact sequence ceiling.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_reset(maximum_sequence_tokens: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_output(&mut state);
    state.session = None;
    if maximum_sequence_tokens == 0 || maximum_sequence_tokens > MAXIMUM_SEQUENCE_TOKENS {
        return fail(
            &mut state,
            "slm2-conformance-sequence-limit",
            STATUS_BOUNDARY_ERROR,
        );
    }
    let mut logits = Vec::new();
    if logits.try_reserve_exact(LOGIT_BYTES).is_err() {
        return fail(
            &mut state,
            "slm2-conformance-allocation",
            STATUS_INTERNAL_ERROR,
        );
    }
    let model_bytes = match u64::try_from(CANONICAL_MODEL.len()) {
        Ok(length) => length,
        Err(_) => {
            return fail(
                &mut state,
                "slm2-conformance-model-size",
                STATUS_INTERNAL_ERROR,
            )
        }
    };
    let policy = match RuntimePolicy::new(
        model_bytes,
        maximum_sequence_tokens,
        MAXIMUM_KV_BYTES,
        MAXIMUM_SCRATCH_BYTES,
    ) {
        Ok(policy) => policy,
        Err(error) => return fail(&mut state, error.code(), STATUS_RUNTIME_ERROR),
    };
    match ScalarSession::from_bytes(CANONICAL_MODEL.to_vec(), policy) {
        Ok(session) => {
            state.logits = logits;
            state.session = Some(session);
            STATUS_OK
        }
        Err(error) => fail(&mut state, error.code(), STATUS_RUNTIME_ERROR),
    }
}

/// Executes one token and stores little-endian f32 logits for readback.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_forward(token_id: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_output(&mut state);
    let Some(_) = state.session.as_ref() else {
        return fail(
            &mut state,
            "slm2-conformance-session-required",
            STATUS_BOUNDARY_ERROR,
        );
    };
    if state.logits.capacity() < LOGIT_BYTES {
        return fail(
            &mut state,
            "slm2-conformance-buffer-capacity",
            STATUS_INTERNAL_ERROR,
        );
    }
    let outcome = {
        let session = state.session.as_mut().expect("session checked above");
        match session.forward_token(token_id) {
            Err(error) => Err((error.code(), STATUS_RUNTIME_ERROR)),
            Ok(logits) if logits.len().checked_mul(4) != Some(LOGIT_BYTES) => {
                Err(("slm2-conformance-logit-shape", STATUS_INTERNAL_ERROR))
            }
            Ok(logits) => match select_greedy(logits) {
                Err(error) => Err((error.code(), STATUS_RUNTIME_ERROR)),
                Ok(greedy_token) => {
                    let mut encoded = [0_u8; LOGIT_BYTES];
                    for (index, logit) in logits.iter().enumerate() {
                        let start = index * 4;
                        encoded[start..start + 4].copy_from_slice(&logit.to_le_bytes());
                    }
                    Ok((greedy_token, encoded))
                }
            },
        }
    };
    let (greedy_token, encoded) = match outcome {
        Ok(outcome) => outcome,
        Err((error, status)) => return fail(&mut state, error, status),
    };
    state.greedy_token = greedy_token;
    state.logits.extend_from_slice(&encoded);
    STATUS_OK
}

/// Returns the current committed token position, or `u32::MAX` on failure.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_position() -> u32 {
    let Ok(state) = lock_state() else {
        return u32::MAX;
    };
    state
        .session
        .as_ref()
        .and_then(|session| session.position().ok())
        .unwrap_or(u32::MAX)
}

/// Returns current committed KV payload bytes, or `u64::MAX` on failure.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_kv_bytes() -> u64 {
    let Ok(state) = lock_state() else {
        return u64::MAX;
    };
    state
        .session
        .as_ref()
        .and_then(|session| session.committed_kv_bytes().ok())
        .unwrap_or(u64::MAX)
}

/// Returns the most recent successful lowest-ID greedy token.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_greedy_token() -> u32 {
    lock_state()
        .map(|state| state.greedy_token)
        .unwrap_or(u32::MAX)
}

/// Returns the current little-endian f32 logits byte length.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_logits_len() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.logits.len()).ok())
        .unwrap_or(0)
}

/// Returns a pointer to the current immutable logits bytes until the next call.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_logits_ptr() -> *const u8 {
    lock_state()
        .map(|state| result_pointer(&state.logits))
        .unwrap_or(core::ptr::null())
}

/// Returns the current stable error-code byte length.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_error_len() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.error.len()).ok())
        .unwrap_or(0)
}

/// Returns a pointer to the current stable error code until the next call.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_error_ptr() -> *const u8 {
    lock_state()
        .map(|state| result_pointer(&state.error))
        .unwrap_or(core::ptr::null())
}

/// Releases the canonical session and all observable result state.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_slm2_conformance_clear() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    *state = ConformanceState::default();
    STATUS_OK
}
