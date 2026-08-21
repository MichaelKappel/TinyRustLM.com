//! Frozen raw exports for `tinyrustlm.tokenizer2-wasm/1`.
#![allow(unsafe_code)]

/// Frozen Tokenizer2 WASM ABI version.
pub const ABI_VERSION: u32 = 1;
/// Maximum one caller-owned transfer buffer.
pub const MAXIMUM_TRANSFER_BYTES: u32 = 16_777_216;
/// Maximum admitted Tokenizer2 artifact bytes.
pub const MAXIMUM_ARTIFACT_BYTES: u32 = 16_777_216;
/// Maximum one UTF-8 input in bytes.
pub const MAXIMUM_INPUT_BYTES: u32 = 32_768;
/// Maximum emitted token IDs.
pub const MAXIMUM_OUTPUT_TOKENS: u32 = 65_536;
/// Maximum decoded UTF-8 bytes.
pub const MAXIMUM_DECODED_BYTES: u32 = 131_072;
/// Maximum simultaneous caller-owned allocations.
pub(crate) const MAXIMUM_LIVE_ALLOCATIONS: usize = 2;
/// Maximum aggregate caller-owned allocation bytes.
pub(crate) const MAXIMUM_LIVE_ALLOCATION_BYTES: usize = 16_842_752;
/// Successful operation status.
pub(crate) const STATUS_OK: u32 = 0;
/// Invalid boundary state, ownership, or argument status.
pub(crate) const STATUS_BOUNDARY_ERROR: u32 = 1;
/// Canonical Tokenizer2 parser or runtime rejection status.
pub(crate) const STATUS_TOKENIZER_ERROR: u32 = 2;
/// Bounded internal-state failure status.
pub(crate) const STATUS_INTERNAL_ERROR: u32 = 3;

/// Returns the frozen ABI version.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_abi_version() -> u32 {
    ABI_VERSION
}

/// Returns the maximum caller-owned transfer bytes.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_max_transfer_bytes() -> u32 {
    MAXIMUM_TRANSFER_BYTES
}

/// Allocates one bounded caller-owned transfer buffer.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_allocate(length: u32) -> *mut u8 {
    crate::boundary::allocate(length)
}

/// Releases one exact caller-owned pointer-length pair.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_release(pointer: *mut u8, length: u32) -> u32 {
    crate::boundary::release(pointer, length)
}

/// Parses and transactionally activates one exact Tokenizer2 artifact.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_load(pointer: *const u8, length: u32) -> u32 {
    crate::boundary::load(pointer, length)
}

/// Encodes one exact UTF-8 input using the active tokenizer.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_encode(pointer: *const u8, length: u32) -> u32 {
    crate::boundary::encode(pointer, length)
}

/// Decodes the current token IDs under mode 0 include-all or mode 1 skip-special.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_decode_current(mode: u32) -> u32 {
    crate::boundary::decode_current(mode)
}

/// Returns the active vocabulary size.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_token_count() -> u32 {
    crate::boundary::token_count()
}

/// Returns the active base-BPE vocabulary size.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_base_token_count() -> u32 {
    crate::boundary::base_token_count()
}

/// Returns the active exact artifact byte length.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_artifact_len() -> u32 {
    crate::boundary::artifact_length()
}

/// Returns a pointer to the active 32-byte artifact SHA-256.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_artifact_sha256_ptr() -> *const u8 {
    crate::boundary::artifact_sha256_pointer()
}

/// Returns a pointer to the current immutable u32 token IDs.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_token_ids_ptr() -> *const u32 {
    crate::boundary::token_ids_pointer()
}

/// Returns the current token-ID count.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_token_ids_count() -> u32 {
    crate::boundary::token_ids_count()
}

/// Returns a pointer to the current exact decoded UTF-8 bytes.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_decoded_ptr() -> *const u8 {
    crate::boundary::decoded_pointer()
}

/// Returns the current exact decoded UTF-8 byte length.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_decoded_len() -> u32 {
    crate::boundary::decoded_length()
}

/// Returns a pointer to the current stable error-code bytes.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_error_ptr() -> *const u8 {
    crate::boundary::error_pointer()
}

/// Returns the current stable error-code byte length.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_error_len() -> u32 {
    crate::boundary::error_length()
}

/// Clears current token, decode, and error state while retaining the tokenizer.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_reset() -> u32 {
    crate::boundary::reset()
}

/// Releases tokenizer, transfer allocations, and all observable state.
#[no_mangle]
pub extern "C" fn trlm_tokenizer2_wasm_clear() -> u32 {
    crate::boundary::clear()
}
