#![deny(unsafe_code)]
#![doc = "Production raw WebAssembly boundary for the canonical SLM2 browser runtime."]

mod boundary;
mod resolver;

use std::sync::{Mutex, MutexGuard, OnceLock};

use boundary::{BoundaryFailure, BoundaryState};

/// Exact production browser runtime ABI version.
pub const ABI_VERSION: u32 = 1;
/// Successful boundary operation.
pub const STATUS_OK: u32 = 0;
/// Rejection by the closed transport or policy boundary.
pub const STATUS_BOUNDARY_REJECTED: u32 = 1;
/// Rejection by the canonical runtime or one of its artifact owners.
pub const STATUS_RUNTIME_REJECTED: u32 = 2;
/// Internal allocation, locking, or result-serialization failure.
pub const STATUS_INTERNAL_FAILURE: u32 = 3;

static STATE: OnceLock<Mutex<BoundaryState>> = OnceLock::new();

fn state() -> &'static Mutex<BoundaryState> {
    STATE.get_or_init(|| Mutex::new(BoundaryState::default()))
}

fn lock_state() -> Result<MutexGuard<'static, BoundaryState>, u32> {
    state().lock().map_err(|_| STATUS_INTERNAL_FAILURE)
}

fn run_status(
    operation: impl FnOnce(&mut BoundaryState) -> Result<Option<Vec<u8>>, BoundaryFailure>,
) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_FAILURE;
    };
    state.clear_observation();
    match operation(&mut state) {
        Ok(result) => {
            if let Some(result) = result {
                if result.len() > boundary::MAXIMUM_RESULT_BYTES {
                    let failure = BoundaryFailure::internal("browser-runtime-result-limit");
                    state.record_failure(failure);
                    return STATUS_INTERNAL_FAILURE;
                }
                state.set_result(result);
            }
            STATUS_OK
        }
        Err(failure) => {
            let status = failure.class().status();
            state.record_failure(failure);
            status
        }
    }
}

fn bytes_pointer(bytes: &[u8]) -> *const u8 {
    if bytes.is_empty() {
        core::ptr::null()
    } else {
        bytes.as_ptr()
    }
}

/// Returns the exact production browser runtime ABI version.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_abi_version() -> u32 {
    ABI_VERSION
}

/// Begins one bounded WASM-owned transfer and returns its writable pointer.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_transfer_begin(kind: u32, length: u32) -> *mut u8 {
    let Ok(mut state) = lock_state() else {
        return core::ptr::null_mut();
    };
    state.clear_observation();
    match state.begin_transfer(kind, length) {
        Ok(pointer) => pointer,
        Err(failure) => {
            state.record_failure(failure);
            core::ptr::null_mut()
        }
    }
}

/// Commits the exact pending transfer without copying its bytes.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_transfer_commit(
    kind: u32,
    pointer: *const u8,
    length: u32,
) -> u32 {
    run_status(|state| {
        state.commit_transfer(kind, pointer, length)?;
        Ok(None)
    })
}

/// Drops the exact pending transfer without committing it.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_transfer_cancel() -> u32 {
    run_status(|state| {
        state.cancel_transfer()?;
        Ok(None)
    })
}

/// Creates the one immutable-policy runtime from a staged operation identity.
#[allow(clippy::too_many_arguments)]
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_create(
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
) -> u32 {
    run_status(|state| {
        state
            .create(
                maximum_model_bytes,
                maximum_sequence_tokens,
                maximum_kv_bytes,
                maximum_scratch_bytes,
                maximum_resolved_member_bytes,
                maximum_resident_dependency_bytes,
                maximum_request_bytes,
                maximum_linear_memory_bytes,
                transcript_revision_low,
                transcript_revision_high,
            )
            .map(Some)
    })
}

/// Validates and transactionally activates one staged ACG2 composition.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_activate() -> u32 {
    run_status(|state| state.activate().map(Some))
}

/// Compare-and-swaps the current staged expected and next operation identities.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_advance_operation() -> u32 {
    run_status(|state| state.advance_operation().map(Some))
}

/// Replaces the presentation-owned transcript revision under exact operation authority.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_set_transcript(
    revision_low: u32,
    revision_high: u32,
) -> u32 {
    run_status(|state| state.set_transcript(revision_low, revision_high).map(Some))
}

/// Compiles and prefills one staged Prompt2 request under exact operation authority.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_begin_request() -> u32 {
    run_status(|state| state.begin_request().map(Some))
}

/// Advances the canonical Sampling2 and scalar runtime exactly once.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_step(cancelled: u32) -> u32 {
    run_status(|state| state.step(cancelled).map(Some))
}

/// Consumes and returns one terminal raw output exactly once.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_finish() -> u32 {
    run_status(|state| state.finish().map(Some))
}

/// Drops every runtime, transfer, result, model, and KV owner permanently.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_release() -> u32 {
    run_status(|state| {
        state.release()?;
        Ok(None)
    })
}

/// Returns the current immutable success-result pointer until the next mutation.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_result_ptr() -> *const u8 {
    lock_state()
        .map(|state| bytes_pointer(state.result()))
        .unwrap_or(core::ptr::null())
}

/// Returns the current bounded success-result byte length.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_result_len() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.result().len()).ok())
        .unwrap_or(0)
}

/// Returns the current stable error-code pointer until the next mutation.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_error_ptr() -> *const u8 {
    lock_state()
        .map(|state| bytes_pointer(state.error()))
        .unwrap_or(core::ptr::null())
}

/// Returns the current stable error-code byte length.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn tinyrustlm_browser_runtime_error_len() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.error().len()).ok())
        .unwrap_or(0)
}
