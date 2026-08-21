use std::collections::BTreeMap;
use std::sync::{Mutex, MutexGuard, OnceLock};

use tinyrustlm_tokenizer2::{DecodeMode, Tokenizer2, TokenizerPolicy};

use crate::exports::{
    MAXIMUM_ARTIFACT_BYTES, MAXIMUM_DECODED_BYTES, MAXIMUM_INPUT_BYTES, MAXIMUM_LIVE_ALLOCATIONS,
    MAXIMUM_LIVE_ALLOCATION_BYTES, MAXIMUM_OUTPUT_TOKENS, MAXIMUM_TRANSFER_BYTES,
    STATUS_BOUNDARY_ERROR, STATUS_INTERNAL_ERROR, STATUS_OK, STATUS_TOKENIZER_ERROR,
};

const ALLOCATION_LIMIT_ERROR: &[u8] = b"tokenizer2_wasm_allocation_limit";
const BUFFER_IDENTITY_ERROR: &[u8] = b"tokenizer2_wasm_buffer_identity_invalid";
const INPUT_ENCODING_ERROR: &[u8] = b"tokenizer2_wasm_input_utf8_invalid";
const INPUT_REQUIRED_ERROR: &[u8] = b"tokenizer2_wasm_input_required";
const INTERNAL_ERROR: &[u8] = b"tokenizer2_wasm_internal_error";
const MODE_ERROR: &[u8] = b"tokenizer2_wasm_decode_mode_invalid";
const TOKENIZER_REQUIRED_ERROR: &[u8] = b"tokenizer2_wasm_tokenizer_required";
const TOKENS_REQUIRED_ERROR: &[u8] = b"tokenizer2_wasm_tokens_required";
const TRANSFER_LIMIT_ERROR: &[u8] = b"tokenizer2_wasm_transfer_limit";

#[derive(Default)]
struct BoundaryState {
    allocations: BTreeMap<usize, Box<[u8]>>,
    allocation_bytes: usize,
    tokenizer: Option<Tokenizer2>,
    artifact_sha256: [u8; 32],
    token_ids: Vec<u32>,
    has_tokens: bool,
    decoded: Vec<u8>,
    error: Vec<u8>,
}

static STATE: OnceLock<Mutex<BoundaryState>> = OnceLock::new();

fn state() -> &'static Mutex<BoundaryState> {
    STATE.get_or_init(|| Mutex::new(BoundaryState::default()))
}

fn lock_state() -> Result<MutexGuard<'static, BoundaryState>, u32> {
    state().lock().map_err(|_| STATUS_INTERNAL_ERROR)
}

fn clear_result(state: &mut BoundaryState) {
    state.token_ids.clear();
    state.has_tokens = false;
    state.decoded.clear();
    state.error.clear();
}

fn fail(state: &mut BoundaryState, code: &[u8], status: u32) -> u32 {
    clear_result(state);
    state.error.extend_from_slice(code);
    status
}

fn tokenizer_fail(state: &mut BoundaryState, code: &'static str) -> u32 {
    fail(state, code.as_bytes(), STATUS_TOKENIZER_ERROR)
}

fn copy_bytes(bytes: &[u8]) -> Result<Vec<u8>, ()> {
    let mut copy = Vec::new();
    copy.try_reserve_exact(bytes.len()).map_err(|_| ())?;
    copy.extend_from_slice(bytes);
    Ok(copy)
}

fn input_copy(
    state: &BoundaryState,
    pointer: *const u8,
    length: u32,
    maximum: u32,
) -> Result<Vec<u8>, &'static [u8]> {
    if pointer.is_null() || length == 0 {
        return Err(INPUT_REQUIRED_ERROR);
    }
    if length > maximum {
        return Err(TRANSFER_LIMIT_ERROR);
    }
    let allocation = state
        .allocations
        .get(&(pointer as usize))
        .ok_or(BUFFER_IDENTITY_ERROR)?;
    if allocation.len() != length as usize {
        return Err(BUFFER_IDENTITY_ERROR);
    }
    copy_bytes(allocation).map_err(|_| INTERNAL_ERROR)
}

fn input_failure(state: &mut BoundaryState, code: &'static [u8]) -> u32 {
    if code == INTERNAL_ERROR {
        fail(state, code, STATUS_INTERNAL_ERROR)
    } else {
        fail(state, code, STATUS_BOUNDARY_ERROR)
    }
}

fn result_pointer<T>(values: &[T]) -> *const T {
    if values.is_empty() {
        core::ptr::null()
    } else {
        values.as_ptr()
    }
}

pub(crate) fn allocate(length: u32) -> *mut u8 {
    let Ok(mut state) = lock_state() else {
        return core::ptr::null_mut();
    };
    state.error.clear();
    if length == 0 || length > MAXIMUM_TRANSFER_BYTES {
        state.error.extend_from_slice(TRANSFER_LIMIT_ERROR);
        return core::ptr::null_mut();
    }
    let Some(next_total) = state.allocation_bytes.checked_add(length as usize) else {
        state.error.extend_from_slice(INTERNAL_ERROR);
        return core::ptr::null_mut();
    };
    if state.allocations.len() >= MAXIMUM_LIVE_ALLOCATIONS
        || next_total > MAXIMUM_LIVE_ALLOCATION_BYTES
    {
        state.error.extend_from_slice(ALLOCATION_LIMIT_ERROR);
        return core::ptr::null_mut();
    }
    let mut allocation = Vec::new();
    if allocation.try_reserve_exact(length as usize).is_err() {
        state.error.extend_from_slice(INTERNAL_ERROR);
        return core::ptr::null_mut();
    }
    allocation.resize(length as usize, 0);
    let mut allocation = allocation.into_boxed_slice();
    let pointer = allocation.as_mut_ptr();
    if state.allocations.contains_key(&(pointer as usize)) {
        state.error.clear();
        state.error.extend_from_slice(INTERNAL_ERROR);
        return core::ptr::null_mut();
    }
    state.allocations.insert(pointer as usize, allocation);
    state.allocation_bytes = next_total;
    pointer
}

pub(crate) fn release(pointer: *mut u8, length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    state.error.clear();
    let key = pointer as usize;
    let valid = !pointer.is_null()
        && state
            .allocations
            .get(&key)
            .is_some_and(|allocation| allocation.len() == length as usize);
    if !valid {
        state.error.extend_from_slice(BUFFER_IDENTITY_ERROR);
        return STATUS_BOUNDARY_ERROR;
    }
    let Some(allocation) = state.allocations.remove(&key) else {
        state.error.extend_from_slice(INTERNAL_ERROR);
        return STATUS_INTERNAL_ERROR;
    };
    let Some(next_total) = state.allocation_bytes.checked_sub(allocation.len()) else {
        state.error.extend_from_slice(INTERNAL_ERROR);
        return STATUS_INTERNAL_ERROR;
    };
    state.allocation_bytes = next_total;
    STATUS_OK
}

pub(crate) fn load(pointer: *const u8, length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_result(&mut state);
    let artifact = match input_copy(&state, pointer, length, MAXIMUM_ARTIFACT_BYTES) {
        Ok(bytes) => bytes,
        Err(code) => return input_failure(&mut state, code),
    };
    let policy = match TokenizerPolicy::new(
        u64::from(MAXIMUM_ARTIFACT_BYTES),
        MAXIMUM_INPUT_BYTES,
        MAXIMUM_OUTPUT_TOKENS,
        MAXIMUM_DECODED_BYTES,
    ) {
        Ok(policy) => policy,
        Err(error) => return tokenizer_fail(&mut state, error.code()),
    };
    match Tokenizer2::from_bytes(artifact, policy) {
        Ok(tokenizer) => {
            state.artifact_sha256 = tokenizer.identity().sha256;
            state.tokenizer = Some(tokenizer);
            STATUS_OK
        }
        Err(error) => tokenizer_fail(&mut state, error.code()),
    }
}

pub(crate) fn encode(pointer: *const u8, length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_result(&mut state);
    if state.tokenizer.is_none() {
        return fail(&mut state, TOKENIZER_REQUIRED_ERROR, STATUS_BOUNDARY_ERROR);
    }
    let bytes = if length == 0 && pointer.is_null() {
        Vec::new()
    } else {
        match input_copy(&state, pointer, length, MAXIMUM_INPUT_BYTES) {
            Ok(bytes) => bytes,
            Err(code) => return input_failure(&mut state, code),
        }
    };
    let text = match std::str::from_utf8(&bytes) {
        Ok(text) => text,
        Err(_) => return fail(&mut state, INPUT_ENCODING_ERROR, STATUS_BOUNDARY_ERROR),
    };
    let mut token_ids = Vec::new();
    let outcome = state
        .tokenizer
        .as_ref()
        .expect("tokenizer checked above")
        .encode(text, &mut token_ids);
    match outcome {
        Ok(()) => {
            state.token_ids = token_ids;
            state.has_tokens = true;
            STATUS_OK
        }
        Err(error) => tokenizer_fail(&mut state, error.code()),
    }
}

pub(crate) fn decode_current(mode: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    state.decoded.clear();
    state.error.clear();
    let decode_mode = match mode {
        0 => DecodeMode::IncludeAll,
        1 => DecodeMode::SkipSpecial,
        _ => return fail(&mut state, MODE_ERROR, STATUS_BOUNDARY_ERROR),
    };
    if state.tokenizer.is_none() {
        return fail(&mut state, TOKENIZER_REQUIRED_ERROR, STATUS_BOUNDARY_ERROR);
    }
    if !state.has_tokens {
        return fail(&mut state, TOKENS_REQUIRED_ERROR, STATUS_BOUNDARY_ERROR);
    }
    let mut decoded = String::new();
    let outcome = state
        .tokenizer
        .as_ref()
        .expect("tokenizer checked above")
        .decode(&state.token_ids, decode_mode, &mut decoded);
    match outcome {
        Ok(()) => {
            state.decoded = decoded.into_bytes();
            STATUS_OK
        }
        Err(error) => tokenizer_fail(&mut state, error.code()),
    }
}

pub(crate) fn token_count() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| state.tokenizer.as_ref().map(Tokenizer2::token_count))
        .unwrap_or(0)
}

pub(crate) fn base_token_count() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| state.tokenizer.as_ref().map(Tokenizer2::base_token_count))
        .unwrap_or(0)
}

pub(crate) fn artifact_length() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| {
            state
                .tokenizer
                .as_ref()
                .and_then(|tokenizer| u32::try_from(tokenizer.identity().byte_length).ok())
        })
        .unwrap_or(0)
}

pub(crate) fn artifact_sha256_pointer() -> *const u8 {
    let Ok(state) = lock_state() else {
        return core::ptr::null();
    };
    if state.tokenizer.is_some() {
        state.artifact_sha256.as_ptr()
    } else {
        core::ptr::null()
    }
}

pub(crate) fn token_ids_pointer() -> *const u32 {
    lock_state()
        .map(|state| result_pointer(&state.token_ids))
        .unwrap_or(core::ptr::null())
}

pub(crate) fn token_ids_count() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.token_ids.len()).ok())
        .unwrap_or(0)
}

pub(crate) fn decoded_pointer() -> *const u8 {
    lock_state()
        .map(|state| result_pointer(&state.decoded))
        .unwrap_or(core::ptr::null())
}

pub(crate) fn decoded_length() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.decoded.len()).ok())
        .unwrap_or(0)
}

pub(crate) fn error_pointer() -> *const u8 {
    lock_state()
        .map(|state| result_pointer(&state.error))
        .unwrap_or(core::ptr::null())
}

pub(crate) fn error_length() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.error.len()).ok())
        .unwrap_or(0)
}

pub(crate) fn reset() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_result(&mut state);
    STATUS_OK
}

pub(crate) fn clear() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    *state = BoundaryState::default();
    STATUS_OK
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transfer_allocations_require_exact_pointer_and_length_identity() {
        clear();
        assert!(allocate(0).is_null());
        assert!(allocate(MAXIMUM_TRANSFER_BYTES + 1).is_null());
        let pointer = allocate(16);
        assert!(!pointer.is_null());
        assert_eq!(release(pointer, 15), STATUS_BOUNDARY_ERROR);
        assert_eq!(release(pointer, 16), STATUS_OK);
        assert_eq!(release(pointer, 16), STATUS_BOUNDARY_ERROR);
        assert_eq!(clear(), STATUS_OK);
    }

    #[test]
    fn operations_require_loaded_tokenizer_and_owned_input() {
        clear();
        assert_eq!(encode(core::ptr::dangling(), 1), STATUS_BOUNDARY_ERROR);
        assert_eq!(decode_current(0), STATUS_BOUNDARY_ERROR);
        assert_eq!(decode_current(2), STATUS_BOUNDARY_ERROR);
        assert_eq!(clear(), STATUS_OK);
    }
}
