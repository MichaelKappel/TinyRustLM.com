use crate::generated_exports::{
    MAXIMUM_INPUT_BYTES, STATUS_BOUNDARY_ERROR, STATUS_INTERNAL_ERROR, STATUS_OK,
    STATUS_VERIFICATION_ERROR,
};
use std::collections::BTreeMap;
use std::sync::{Mutex, OnceLock};
use tinyrustlm_evidence::{finalize_campaign_plan_json, validate_campaign_plan_json};

const BYTE_LIMIT_ERROR: &[u8] = b"campaign_plan_byte_limit";
const BUFFER_IDENTITY_ERROR: &[u8] = b"campaign_plan_buffer_identity_invalid";
const COPY_LENGTH_ERROR: &[u8] = b"campaign_plan_copy_length_invalid";
const INTERNAL_ERROR: &[u8] = b"campaign_plan_wasm_internal_error";

#[derive(Default)]
struct BoundaryState {
    allocations: BTreeMap<usize, Box<[u8]>>,
    result: Vec<u8>,
    error: Vec<u8>,
}

static STATE: OnceLock<Mutex<BoundaryState>> = OnceLock::new();

fn state() -> &'static Mutex<BoundaryState> {
    STATE.get_or_init(|| Mutex::new(BoundaryState::default()))
}

fn set_error(state: &mut BoundaryState, error: &[u8]) {
    state.error.clear();
    state.error.extend_from_slice(error);
}

fn set_verifier_error(state: &mut BoundaryState, error: &[u8]) {
    state.result.clear();
    set_error(state, error);
}

fn lock_state() -> Result<std::sync::MutexGuard<'static, BoundaryState>, u32> {
    state().lock().map_err(|_| STATUS_INTERNAL_ERROR)
}

pub(crate) fn allocate(length: u32) -> *mut u8 {
    if length == 0 || length > MAXIMUM_INPUT_BYTES {
        if let Ok(mut state) = lock_state() {
            set_error(&mut state, BYTE_LIMIT_ERROR);
        }
        return core::ptr::null_mut();
    }
    let mut allocation = vec![0u8; length as usize].into_boxed_slice();
    let pointer = allocation.as_mut_ptr();
    let Ok(mut state) = lock_state() else {
        return core::ptr::null_mut();
    };
    if state.allocations.contains_key(&(pointer as usize)) {
        set_error(&mut state, INTERNAL_ERROR);
        return core::ptr::null_mut();
    }
    state.allocations.insert(pointer as usize, allocation);
    pointer
}

pub(crate) fn release(pointer: *mut u8, length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    let key = pointer as usize;
    let exact = !pointer.is_null()
        && state
            .allocations
            .get(&key)
            .is_some_and(|allocation| allocation.len() == length as usize);
    if !exact {
        set_error(&mut state, BUFFER_IDENTITY_ERROR);
        return STATUS_BOUNDARY_ERROR;
    }
    state.allocations.remove(&key);
    STATUS_OK
}

fn input_copy(pointer: *const u8, length: u32) -> Result<Vec<u8>, u32> {
    if pointer.is_null() || length == 0 || length > MAXIMUM_INPUT_BYTES {
        if let Ok(mut state) = lock_state() {
            set_verifier_error(&mut state, BYTE_LIMIT_ERROR);
        }
        return Err(STATUS_BOUNDARY_ERROR);
    }
    let mut state = lock_state()?;
    let Some(allocation) = state.allocations.get(&(pointer as usize)) else {
        set_verifier_error(&mut state, BUFFER_IDENTITY_ERROR);
        return Err(STATUS_BOUNDARY_ERROR);
    };
    if allocation.len() != length as usize {
        set_verifier_error(&mut state, BUFFER_IDENTITY_ERROR);
        return Err(STATUS_BOUNDARY_ERROR);
    }
    Ok(allocation.to_vec())
}

fn store_outcome(
    outcome: Result<
        tinyrustlm_evidence::FinalizedCampaignPlan,
        tinyrustlm_evidence::CampaignPlanError,
    >,
) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    state.result.clear();
    state.error.clear();
    match outcome {
        Ok(plan) => {
            state.result.extend_from_slice(plan.bytes());
            STATUS_OK
        }
        Err(error) => {
            state.error.extend_from_slice(error.code().as_bytes());
            STATUS_VERIFICATION_ERROR
        }
    }
}

pub(crate) fn finalize_campaign_plan(pointer: *const u8, length: u32) -> u32 {
    let input = match input_copy(pointer, length) {
        Ok(input) => input,
        Err(status) => return status,
    };
    store_outcome(finalize_campaign_plan_json(&input))
}

pub(crate) fn validate_campaign_plan(pointer: *const u8, length: u32) -> u32 {
    let input = match input_copy(pointer, length) {
        Ok(input) => input,
        Err(status) => return status,
    };
    store_outcome(validate_campaign_plan_json(&input))
}

pub(crate) fn result_length() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.result.len()).ok())
        .unwrap_or(0)
}

pub(crate) fn error_length() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.error.len()).ok())
        .unwrap_or(0)
}

fn copy_current(pointer: *mut u8, length: u32, copy_error: bool) -> u32 {
    if pointer.is_null() || length == 0 || length > MAXIMUM_INPUT_BYTES {
        return STATUS_BOUNDARY_ERROR;
    }
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    let source = if copy_error {
        state.error.clone()
    } else {
        state.result.clone()
    };
    let Some(allocation) = state.allocations.get_mut(&(pointer as usize)) else {
        return STATUS_BOUNDARY_ERROR;
    };
    if allocation.len() != length as usize || source.len() != length as usize {
        if !copy_error {
            set_error(&mut state, COPY_LENGTH_ERROR);
        }
        return STATUS_BOUNDARY_ERROR;
    }
    allocation.copy_from_slice(&source);
    STATUS_OK
}

pub(crate) fn copy_result(pointer: *mut u8, length: u32) -> u32 {
    copy_current(pointer, length, false)
}

pub(crate) fn copy_error(pointer: *mut u8, length: u32) -> u32 {
    copy_current(pointer, length, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{MutexGuard, OnceLock};

    const DRAFT: &[u8] =
        include_bytes!("../../../../contracts/vnext/campaign-plan-draft-parity-fixture.v1.json");
    const PLAN: &[u8] =
        include_bytes!("../../../../contracts/vnext/campaign-plan-parity-fixture.v1.json");

    fn serial() -> MutexGuard<'static, ()> {
        static TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        TEST_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("boundary test lock must remain available")
    }

    fn write_allocation(pointer: *mut u8, bytes: &[u8]) {
        let mut state = lock_state().expect("boundary state must remain available");
        let allocation = state
            .allocations
            .get_mut(&(pointer as usize))
            .expect("test allocation must exist");
        assert_eq!(allocation.len(), bytes.len());
        allocation.copy_from_slice(bytes);
    }

    fn read_current_result() -> Vec<u8> {
        let length = result_length();
        let pointer = allocate(length);
        assert!(!pointer.is_null());
        assert_eq!(copy_result(pointer, length), STATUS_OK);
        let state = lock_state().expect("boundary state must remain available");
        let result = state
            .allocations
            .get(&(pointer as usize))
            .expect("result allocation must exist")
            .to_vec();
        drop(state);
        assert_eq!(release(pointer, length), STATUS_OK);
        result
    }

    #[test]
    fn rejects_unowned_and_mismatched_buffers_without_dereferencing_them() {
        let _serial = serial();
        assert_eq!(
            finalize_campaign_plan(core::ptr::dangling(), 8),
            STATUS_BOUNDARY_ERROR
        );
        let pointer = allocate(16);
        assert!(!pointer.is_null());
        assert_eq!(release(pointer, 15), STATUS_BOUNDARY_ERROR);
        assert_eq!(release(pointer, 16), STATUS_OK);
        assert_eq!(release(pointer, 16), STATUS_BOUNDARY_ERROR);
    }

    #[test]
    fn enforces_allocation_bounds() {
        let _serial = serial();
        assert!(allocate(0).is_null());
        assert!(allocate(MAXIMUM_INPUT_BYTES + 1).is_null());
    }

    #[test]
    fn finalizes_and_validates_exact_owned_bytes() {
        let _serial = serial();
        let draft_pointer = allocate(DRAFT.len() as u32);
        assert!(!draft_pointer.is_null());
        write_allocation(draft_pointer, DRAFT);
        assert_eq!(
            finalize_campaign_plan(draft_pointer, DRAFT.len() as u32),
            STATUS_OK
        );
        assert_eq!(release(core::ptr::dangling_mut(), 8), STATUS_BOUNDARY_ERROR);
        assert_eq!(read_current_result(), PLAN);
        assert_eq!(release(draft_pointer, DRAFT.len() as u32), STATUS_OK);

        assert_eq!(
            validate_campaign_plan(core::ptr::dangling(), 8),
            STATUS_BOUNDARY_ERROR
        );
        assert_eq!(result_length(), 0);

        let plan_pointer = allocate(PLAN.len() as u32);
        assert!(!plan_pointer.is_null());
        write_allocation(plan_pointer, PLAN);
        assert_eq!(
            validate_campaign_plan(plan_pointer, PLAN.len() as u32),
            STATUS_OK
        );
        assert_eq!(read_current_result(), PLAN);
        assert_eq!(release(plan_pointer, PLAN.len() as u32), STATUS_OK);
    }
}
