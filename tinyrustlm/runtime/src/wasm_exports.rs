//! Raw WebAssembly exports for handwritten JavaScript.

#![allow(unsafe_code)]

use crate::content_identity::Digest32;
use crate::errors::ErrorCode;
use crate::generate::Runtime;
use crate::memory::{
    allocate_bytes, allocate_model_bytes, deallocate_bytes, deallocate_model_bytes, slice_from_raw,
    take_model_bytes,
};
use std::sync::Mutex;

static RUNTIME: Mutex<Option<Runtime>> = Mutex::new(None);

/// Allocates `len` bytes in WASM linear memory.
#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    allocate_bytes(len)
}

/// Releases a buffer previously returned by [`alloc`].
///
/// # Safety
///
/// `ptr` and `len` must exactly match a live allocation returned by [`alloc`].
/// The buffer must not be used again after this call.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    deallocate_bytes(ptr, len);
}

/// Allocates aligned storage that can move into runtime model ownership.
#[no_mangle]
pub extern "C" fn alloc_model(len: usize) -> *mut u8 {
    allocate_model_bytes(len)
}

/// Releases a model allocation that was never consumed by [`load_model_owned`].
///
/// # Safety
///
/// `ptr` and `len` must exactly match a live allocation returned by
/// [`alloc_model`]. The allocation must not already have been consumed.
#[no_mangle]
pub unsafe extern "C" fn dealloc_model(ptr: *mut u8, len: usize) {
    unsafe { deallocate_model_bytes(ptr, len) };
}

/// Initializes runtime state.
#[no_mangle]
pub extern "C" fn init_runtime() -> u32 {
    match RUNTIME.lock() {
        Ok(mut runtime) => {
            *runtime = Some(Runtime::new());
            ErrorCode::Ok.as_u32()
        }
        Err(_) => ErrorCode::GenerationFailed.as_u32(),
    }
}

/// Loads a model from bytes already copied into WASM memory.
///
/// # Safety
///
/// `ptr` must point to `len` readable bytes in WASM linear memory for the
/// duration of this call.
#[no_mangle]
pub unsafe extern "C" fn load_model(ptr: *const u8, len: usize) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    with_runtime_mut(|runtime| runtime.load_model(bytes))
}

/// Consumes browser-filled model storage and loads it without copying packed
/// quantized tensors into a second full-model allocation.
///
/// # Safety
///
/// `ptr` and `len` must exactly match a live allocation returned by
/// [`alloc_model`]. Ownership is consumed on every return path; callers must
/// never read, write, or free the pointer after invoking this function.
#[no_mangle]
pub unsafe extern "C" fn load_model_owned(ptr: *mut u8, len: usize) -> u32 {
    let bytes = match unsafe { take_model_bytes(ptr, len) } {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    with_runtime_mut(move |runtime| runtime.load_model_owned(bytes))
}

/// Starts an incremental identity digest for one exact browser artifact.
#[no_mangle]
pub extern "C" fn begin_artifact_digest(expected_len: usize) -> u32 {
    with_runtime_mut(|runtime| runtime.begin_artifact_digest(expected_len))
}

/// Adds one bounded slice from a browser-owned artifact transfer.
///
/// # Safety
///
/// `ptr` must point to `len` readable bytes in WASM linear memory for the
/// duration of this call.
#[no_mangle]
pub unsafe extern "C" fn update_artifact_digest(ptr: *const u8, len: usize) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    with_runtime_mut(|runtime| runtime.update_artifact_digest(bytes))
}

/// Finalizes the active artifact digest into the runtime result buffer.
#[no_mangle]
pub extern "C" fn finish_artifact_digest() -> u32 {
    with_runtime_mut(|runtime| runtime.finish_artifact_digest())
}

/// Validates one complete immutable composition graph without changing runtime state.
///
/// # Safety
///
/// `ptr` must point to `len` readable `ACG1` bytes and `sha256_ptr` must point
/// to exactly `sha256_len == 32` readable digest bytes for the duration of this
/// call.
#[no_mangle]
pub unsafe extern "C" fn validate_composition_graph(
    ptr: *const u8,
    len: usize,
    sha256_ptr: *const u8,
    sha256_len: usize,
) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let sha256 = match digest_from_raw(sha256_ptr, sha256_len) {
        Ok(sha256) => sha256,
        Err(error) => return set_error(error),
    };
    with_runtime_mut(|runtime| runtime.validate_composition_graph(bytes, sha256))
}

/// Atomically activates one complete immutable composition graph.
///
/// # Safety
///
/// `ptr` must point to `len` readable `ACG1` bytes and `sha256_ptr` must point
/// to exactly `sha256_len == 32` readable digest bytes for the duration of this
/// call.
#[no_mangle]
pub unsafe extern "C" fn activate_composition_graph(
    ptr: *const u8,
    len: usize,
    sha256_ptr: *const u8,
    sha256_len: usize,
) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let sha256 = match digest_from_raw(sha256_ptr, sha256_len) {
        Ok(sha256) => sha256,
        Err(error) => return set_error(error),
    };
    with_runtime_mut(|runtime| runtime.activate_composition_graph(bytes, sha256))
}

/// Generates text from a UTF-8 prompt copied into WASM memory.
///
/// # Safety
///
/// `ptr` must point to `len` readable UTF-8 bytes in WASM linear memory for the
/// duration of this call.
#[no_mangle]
pub unsafe extern "C" fn generate(ptr: *const u8, len: usize, max_new_tokens: u32) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let prompt = match core::str::from_utf8(bytes) {
        Ok(prompt) => prompt,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    with_runtime_mut(|runtime| runtime.generate(prompt, max_new_tokens))
}

/// Evaluates a bounded UTF-8 arithmetic expression without invoking a model.
///
/// # Safety
///
/// `ptr` must point to `len` readable UTF-8 bytes in WASM linear memory for the
/// duration of this call.
#[no_mangle]
pub unsafe extern "C" fn calculate(ptr: *const u8, len: usize) -> u32 {
    let bytes = match slice_from_raw(ptr, len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let expression = match core::str::from_utf8(bytes) {
        Ok(expression) => expression,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    with_runtime_mut(|runtime| runtime.calculate(expression))
}

/// Generates a strict status/reason JSON object from two model-derived fields.
///
/// # Safety
///
/// `status_ptr/status_len` and `reason_ptr/reason_len` must point to readable
/// UTF-8 bytes in WASM linear memory for the duration of this call.
#[no_mangle]
pub unsafe extern "C" fn generate_status_reason_json(
    status_ptr: *const u8,
    status_len: usize,
    reason_ptr: *const u8,
    reason_len: usize,
    status_max_tokens: u32,
    reason_max_tokens: u32,
) -> u32 {
    let status_bytes = match slice_from_raw(status_ptr, status_len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let reason_bytes = match slice_from_raw(reason_ptr, reason_len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let status_prompt = match core::str::from_utf8(status_bytes) {
        Ok(prompt) => prompt,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    let reason_prompt = match core::str::from_utf8(reason_bytes) {
        Ok(prompt) => prompt,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    with_runtime_mut(|runtime| {
        runtime.generate_status_reason_json(
            status_prompt,
            reason_prompt,
            status_max_tokens,
            reason_max_tokens,
        )
    })
}

/// Generates two complete model-derived sentences from two rendered prompts.
///
/// # Safety
///
/// `first_ptr/first_len` and `second_ptr/second_len` must point to readable
/// UTF-8 bytes in WASM linear memory for the duration of this call.
#[no_mangle]
pub unsafe extern "C" fn generate_two_sentence_text(
    first_ptr: *const u8,
    first_len: usize,
    second_ptr: *const u8,
    second_len: usize,
    first_max_tokens: u32,
    second_max_tokens: u32,
) -> u32 {
    let first_bytes = match slice_from_raw(first_ptr, first_len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let second_bytes = match slice_from_raw(second_ptr, second_len) {
        Ok(bytes) => bytes,
        Err(error) => return set_error(error),
    };
    let first_prompt = match core::str::from_utf8(first_bytes) {
        Ok(prompt) => prompt,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    let second_prompt = match core::str::from_utf8(second_bytes) {
        Ok(prompt) => prompt,
        Err(_) => return set_error(ErrorCode::InvalidUtf8),
    };
    with_runtime_mut(|runtime| {
        runtime.generate_two_sentence_text(
            first_prompt,
            second_prompt,
            first_max_tokens,
            second_max_tokens,
        )
    })
}

/// Configures decoding with temperature, top-k, top-p, and a deterministic seed.
#[no_mangle]
pub extern "C" fn set_sampling_config(temperature: f32, top_k: u32, top_p: f32, seed: u32) -> u32 {
    with_runtime_mut(|runtime| runtime.configure_sampling(temperature, top_k, top_p, seed))
}

/// Configures decoding with an explicit model- or preset-bound repetition penalty.
#[no_mangle]
pub extern "C" fn set_sampling_config_v2(
    temperature: f32,
    top_k: u32,
    top_p: f32,
    seed: u32,
    repetition_penalty: f32,
) -> u32 {
    with_runtime_mut(|runtime| {
        runtime.configure_sampling_with_repetition(
            temperature,
            top_k,
            top_p,
            seed,
            repetition_penalty,
        )
    })
}

/// Generates a single token and writes its decoded text to the last-result buffer.
#[no_mangle]
pub extern "C" fn generate_next_token() -> u32 {
    with_runtime_mut(|runtime| runtime.generate_next_token())
}

/// Returns a pointer to the last result bytes.
#[no_mangle]
pub extern "C" fn last_result_ptr() -> *const u8 {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.last_result().as_ptr())
            .unwrap_or(core::ptr::null()),
        Err(_) => core::ptr::null(),
    }
}

/// Returns the byte length of the last result.
#[no_mangle]
pub extern "C" fn last_result_len() -> usize {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.last_result().len())
            .unwrap_or(0),
        Err(_) => 0,
    }
}

/// Returns a pointer to diagnostics bytes.
#[no_mangle]
pub extern "C" fn get_diagnostics_ptr() -> *const u8 {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.diagnostics().as_ptr())
            .unwrap_or(core::ptr::null()),
        Err(_) => core::ptr::null(),
    }
}

/// Returns the byte length of diagnostics.
#[no_mangle]
pub extern "C" fn get_diagnostics_len() -> usize {
    match RUNTIME.lock() {
        Ok(guard) => guard
            .as_ref()
            .map(|runtime| runtime.diagnostics().len())
            .unwrap_or(0),
        Err(_) => 0,
    }
}

/// Resets the current context.
#[no_mangle]
pub extern "C" fn reset_context() -> u32 {
    with_runtime_mut(|runtime| runtime.reset_context())
}

/// Frees the loaded model.
#[no_mangle]
pub extern "C" fn free_model() -> u32 {
    with_runtime_mut(|runtime| runtime.free_model())
}

fn with_runtime_mut<F>(operation: F) -> u32
where
    F: FnOnce(&mut Runtime) -> ErrorCode,
{
    let Ok(mut guard) = RUNTIME.lock() else {
        return ErrorCode::GenerationFailed.as_u32();
    };
    match guard.as_mut() {
        Some(runtime) => operation(runtime).as_u32(),
        None => ErrorCode::ModelNotLoaded.as_u32(),
    }
}

unsafe fn digest_from_raw(ptr: *const u8, len: usize) -> Result<Digest32, ErrorCode> {
    if len != 32 {
        return Err(ErrorCode::InvalidLength);
    }
    let bytes = unsafe { slice_from_raw(ptr, len)? };
    let mut digest = [0u8; 32];
    digest.copy_from_slice(bytes);
    Ok(digest)
}

fn set_error(error: ErrorCode) -> u32 {
    let Ok(mut guard) = RUNTIME.lock() else {
        return error.as_u32();
    };
    if guard.is_none() {
        *guard = Some(Runtime::new());
    }
    if let Some(runtime) = guard.as_mut() {
        runtime.record_boundary_error(error);
    }
    error.as_u32()
}
