//! WASM memory boundary helpers.

#![allow(unsafe_code)]

use crate::errors::ErrorCode;

const MAX_TRANSFER_BYTES: usize = 256 * 1024 * 1024;
pub(crate) const MAX_MODEL_TRANSFER_BYTES: usize = 1024 * 1024 * 1024;
const MODEL_STORAGE_ALIGNMENT: usize = core::mem::align_of::<u64>();

/// Owns a browser-filled model allocation with alignment suitable for checked
/// little-endian scalar reads from validated tensor offsets.
#[derive(Debug)]
pub struct OwnedModelBytes {
    words: Vec<u64>,
    len: usize,
}

impl OwnedModelBytes {
    /// Copies model bytes into aligned ownership for native callers and tests.
    pub fn copy_from_slice(bytes: &[u8]) -> Result<Self, ErrorCode> {
        validate_model_length(bytes.len())?;
        let mut words = allocate_model_words(bytes.len()).ok_or(ErrorCode::InvalidLength)?;
        let destination = unsafe {
            core::slice::from_raw_parts_mut(words.as_mut_ptr().cast::<u8>(), bytes.len())
        };
        destination.copy_from_slice(bytes);
        Ok(Self {
            words,
            len: bytes.len(),
        })
    }

    /// Returns the exact model byte range, excluding zeroed alignment padding.
    pub fn as_slice(&self) -> &[u8] {
        unsafe { core::slice::from_raw_parts(self.words.as_ptr().cast::<u8>(), self.len) }
    }
}

fn model_word_count(len: usize) -> Option<usize> {
    len.checked_add(MODEL_STORAGE_ALIGNMENT - 1)
        .map(|padded| padded / MODEL_STORAGE_ALIGNMENT)
}

fn validate_model_length(len: usize) -> Result<(), ErrorCode> {
    if len == 0 || len > MAX_MODEL_TRANSFER_BYTES {
        return Err(ErrorCode::InvalidLength);
    }
    model_word_count(len).ok_or(ErrorCode::InvalidLength)?;
    Ok(())
}

fn allocate_model_words(len: usize) -> Option<Vec<u64>> {
    validate_model_length(len).ok()?;
    let word_count = model_word_count(len)?;
    let mut words = Vec::new();
    words.try_reserve_exact(word_count).ok()?;
    words.resize(word_count, 0);
    Some(words)
}

/// Allocates zero-initialized, aligned storage for a model transfer.
///
/// Unlike [`allocate_bytes`], this allocation is intended to move into runtime
/// ownership through [`take_model_bytes`] after the browser fills it.
pub fn allocate_model_bytes(len: usize) -> *mut u8 {
    let Some(mut words) = allocate_model_words(len) else {
        return core::ptr::null_mut();
    };
    let ptr = words.as_mut_ptr().cast::<u8>();
    core::mem::forget(words);
    ptr
}

/// Releases an unconsumed model transfer allocation.
///
/// # Safety
///
/// `ptr` and `len` must exactly match a live allocation returned by
/// [`allocate_model_bytes`]. The allocation must not have been consumed by
/// [`take_model_bytes`].
pub unsafe fn deallocate_model_bytes(ptr: *mut u8, len: usize) {
    if ptr.is_null() || validate_model_length(len).is_err() {
        return;
    }
    let Some(word_count) = model_word_count(len) else {
        return;
    };
    let _ = unsafe { Vec::from_raw_parts(ptr.cast::<u64>(), word_count, word_count) };
}

/// Consumes a model transfer allocation and returns its sole Rust owner.
///
/// # Safety
///
/// `ptr` and `len` must exactly match a live allocation returned by
/// [`allocate_model_bytes`]. No caller may read, write, or free `ptr` after
/// this function is called, including when later model validation fails.
pub unsafe fn take_model_bytes(ptr: *mut u8, len: usize) -> Result<OwnedModelBytes, ErrorCode> {
    if ptr.is_null() {
        return Err(ErrorCode::NullPointer);
    }
    validate_model_length(len)?;
    let word_count = model_word_count(len).ok_or(ErrorCode::InvalidLength)?;
    let words = unsafe { Vec::from_raw_parts(ptr.cast::<u64>(), word_count, word_count) };
    Ok(OwnedModelBytes { words, len })
}

/// Allocates a byte buffer in WASM linear memory and returns its pointer.
///
/// The caller must pass the returned pointer and the same capacity to
/// [`deallocate_bytes`] when the browser no longer needs the transfer buffer.
pub fn allocate_bytes(len: usize) -> *mut u8 {
    if len == 0 || len > MAX_TRANSFER_BYTES {
        return core::ptr::null_mut();
    }
    let mut bytes: Vec<u8> = Vec::with_capacity(len);
    let ptr = bytes.as_mut_ptr();
    core::mem::forget(bytes);
    ptr
}

/// Releases a buffer previously returned by [`allocate_bytes`].
///
/// `ptr` must be the original pointer and `len` must be the original capacity.
///
/// # Safety
///
/// `ptr` must come from [`allocate_bytes`] with exactly the same `len`, and it
/// must not have been released already. Passing any other pointer or length is
/// undefined behavior because the function reconstructs the original allocation.
pub unsafe fn deallocate_bytes(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 && len <= MAX_TRANSFER_BYTES {
        let _ = Vec::from_raw_parts(ptr, 0, len);
    }
}

/// Validates a raw byte range and returns it as an immutable slice.
///
/// The caller must ensure the pointer is valid for `len` bytes for the duration
/// of the returned borrow.
///
/// # Safety
///
/// `ptr` must be non-null, aligned for `u8`, valid for `len` bytes, and must
/// remain immutable for the returned borrow lifetime.
pub unsafe fn slice_from_raw<'a>(ptr: *const u8, len: usize) -> Result<&'a [u8], ErrorCode> {
    if ptr.is_null() {
        return Err(ErrorCode::NullPointer);
    }
    if len == 0 || len > MAX_TRANSFER_BYTES {
        return Err(ErrorCode::InvalidLength);
    }
    Ok(core::slice::from_raw_parts(ptr, len))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owned_model_bytes_are_aligned_and_preserve_exact_length() {
        let source = b"unaligned-length-model";
        let owned = OwnedModelBytes::copy_from_slice(source).unwrap();

        assert_eq!(owned.as_slice(), source);
        assert_eq!(
            owned.as_slice().as_ptr() as usize % core::mem::align_of::<u64>(),
            0
        );
    }

    #[test]
    fn model_transfer_allocation_moves_into_single_owner() {
        let source = b"owned model transfer";
        let ptr = allocate_model_bytes(source.len());
        assert!(!ptr.is_null());

        unsafe {
            core::ptr::copy_nonoverlapping(source.as_ptr(), ptr, source.len());
        }
        let owned = unsafe { take_model_bytes(ptr, source.len()) }.unwrap();

        assert_eq!(owned.as_slice(), source);
    }

    #[test]
    fn model_transfer_boundary_rejects_invalid_lengths() {
        assert!(allocate_model_bytes(0).is_null());
        assert!(allocate_model_bytes(MAX_MODEL_TRANSFER_BYTES + 1).is_null());

        assert_eq!(
            unsafe { take_model_bytes(core::ptr::null_mut(), 1) }.unwrap_err(),
            ErrorCode::NullPointer
        );
        assert_eq!(
            unsafe { take_model_bytes(core::ptr::dangling_mut::<u8>(), 0) }.unwrap_err(),
            ErrorCode::InvalidLength
        );
    }

    #[test]
    fn transfer_boundary_allows_real_q8_assistant_model_size() {
        let real_q8_bytes = 136_863_168usize;
        assert!(real_q8_bytes < MAX_TRANSFER_BYTES);
    }

    #[test]
    fn transfer_boundary_rejects_zero_and_above_limit_lengths() {
        assert!(allocate_bytes(0).is_null());
        assert!(allocate_bytes(MAX_TRANSFER_BYTES + 1).is_null());

        let byte = 0u8;
        assert_eq!(
            unsafe { slice_from_raw(&byte as *const u8, 0) },
            Err(ErrorCode::InvalidLength)
        );
        assert_eq!(
            unsafe { slice_from_raw(&byte as *const u8, MAX_TRANSFER_BYTES + 1) },
            Err(ErrorCode::InvalidLength)
        );
    }
}
