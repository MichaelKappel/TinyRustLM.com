use crate::generated_exports::{
    MAXIMUM_LIVE_ALLOCATIONS, MAXIMUM_LIVE_ALLOCATION_BYTES, MAXIMUM_PLAN_BYTES,
    MAXIMUM_PROJECTION_METADATA_BYTES, MAXIMUM_RECEIPT_BYTES, MAXIMUM_RECEIPT_INPUTS,
    MAXIMUM_RESULT_BYTES, MAXIMUM_SUBJECT_BYTES, MAXIMUM_SUBJECT_INPUTS,
    MAXIMUM_TOTAL_RECEIPT_BYTES, MAXIMUM_TOTAL_SUBJECT_BYTES, MAXIMUM_TRANSFER_BYTES,
    STATUS_BOUNDARY_ERROR, STATUS_INTERNAL_ERROR, STATUS_OK, STATUS_VERIFICATION_ERROR,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::{Mutex, OnceLock};
use tinyrustlm_evidence::{
    classify_phase_receipts, finalize_campaign_plan_json, project_campaign,
    validate_campaign_plan_json,
    validate_campaign_projection_result as verify_campaign_projection_result,
    CampaignProjectionInput,
};

const ALLOCATION_LIMIT_ERROR: &[u8] = b"campaign_evidence_allocation_limit";
const BUFFER_IDENTITY_ERROR: &[u8] = b"campaign_evidence_buffer_identity_invalid";
const CAMPAIGN_ID_BYTE_LIMIT_ERROR: &[u8] = b"campaign_evidence_campaign_id_byte_limit";
const CAMPAIGN_ID_ENCODING_ERROR: &[u8] = b"campaign_evidence_campaign_id_encoding_invalid";
const COPY_LENGTH_ERROR: &[u8] = b"campaign_evidence_copy_length_invalid";
const INTERNAL_ERROR: &[u8] = b"campaign_evidence_wasm_internal_error";
const PLAN_BYTE_LIMIT_ERROR: &[u8] = b"campaign_plan_byte_limit";
const PROJECTION_METADATA_BYTE_LIMIT_ERROR: &[u8] =
    b"campaign_evidence_projection_metadata_byte_limit";
const PROJECTION_METADATA_ERROR: &[u8] = b"campaign_evidence_projection_metadata_invalid";
const RECEIPT_BYTE_LIMIT_ERROR: &[u8] = b"campaign_evidence_receipt_byte_limit";
const RECEIPT_COUNT_ERROR: &[u8] = b"campaign_evidence_receipt_count_invalid";
const RECEIPT_TOTAL_ERROR: &[u8] = b"campaign_evidence_receipt_total_byte_limit";
const RESULT_BYTE_LIMIT_ERROR: &[u8] = b"campaign_projection_result_byte_limit";
const STAGE_COUNT_ERROR: &[u8] = b"campaign_evidence_stage_count_mismatch";
const STAGE_MISSING_ERROR: &[u8] = b"campaign_evidence_stage_missing";
const SUBJECT_BYTE_LIMIT_ERROR: &[u8] = b"campaign_evidence_subject_byte_limit";
const SUBJECT_COUNT_ERROR: &[u8] = b"campaign_evidence_subject_count_invalid";
const SUBJECT_STAGE_ERROR: &[u8] = b"campaign_evidence_subject_stage_invalid";
const SUBJECT_TOTAL_ERROR: &[u8] = b"campaign_evidence_subject_total_byte_limit";
const TRANSFER_BYTE_LIMIT_ERROR: &[u8] = b"campaign_evidence_transfer_byte_limit";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProjectionMetadata {
    expected_campaign_id: String,
    expected_campaign_plan_sha256: String,
    expected_environment: String,
    expected_terminal_registry_receipt_id: Option<String>,
    trusted_root_registry_receipt_id: Option<String>,
    verification_time_utc: String,
}

enum StagedOperation {
    PhaseInvalidation {
        campaign_id: String,
        expected_receipt_count: usize,
        receipt_bytes: Vec<Vec<u8>>,
        total_receipt_bytes: usize,
    },
    CampaignProjection {
        metadata: ProjectionMetadata,
        campaign_plan_bytes: Vec<u8>,
        expected_receipt_count: usize,
        expected_subject_count: usize,
        receipt_bytes: Vec<Vec<u8>>,
        subject_bytes: Vec<Vec<u8>>,
        total_receipt_bytes: usize,
        total_subject_bytes: usize,
    },
}

#[derive(Default)]
struct BoundaryState {
    allocations: BTreeMap<usize, Box<[u8]>>,
    allocation_bytes: usize,
    result: Vec<u8>,
    error: Vec<u8>,
    stage: Option<StagedOperation>,
}

enum ExecutionFailure {
    Boundary(&'static [u8]),
    Verification(&'static str),
    Internal,
}

static STATE: OnceLock<Mutex<BoundaryState>> = OnceLock::new();

fn state() -> &'static Mutex<BoundaryState> {
    STATE.get_or_init(|| Mutex::new(BoundaryState::default()))
}

fn lock_state() -> Result<std::sync::MutexGuard<'static, BoundaryState>, u32> {
    state().lock().map_err(|_| STATUS_INTERNAL_ERROR)
}

fn clear_operation_state(state: &mut BoundaryState) {
    state.stage = None;
    state.result.clear();
    state.error.clear();
}

fn fail_locked(state: &mut BoundaryState, error: &[u8], status: u32) -> u32 {
    state.stage = None;
    state.result.clear();
    state.error.clear();
    state.error.extend_from_slice(error);
    status
}

fn boundary_failure(state: &mut BoundaryState, error: &[u8]) -> u32 {
    fail_locked(state, error, STATUS_BOUNDARY_ERROR)
}

fn internal_failure(state: &mut BoundaryState) -> u32 {
    fail_locked(state, INTERNAL_ERROR, STATUS_INTERNAL_ERROR)
}

fn copy_bytes(bytes: &[u8]) -> Result<Vec<u8>, ()> {
    let mut copy = Vec::new();
    copy.try_reserve_exact(bytes.len()).map_err(|_| ())?;
    copy.extend_from_slice(bytes);
    Ok(copy)
}

fn input_copy_locked(
    state: &BoundaryState,
    pointer: *const u8,
    length: u32,
    maximum: u32,
    limit_error: &'static [u8],
) -> Result<Vec<u8>, &'static [u8]> {
    if pointer.is_null() || length == 0 || length > maximum {
        return Err(limit_error);
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

fn status_for_input_error(state: &mut BoundaryState, error: &'static [u8]) -> u32 {
    if error == INTERNAL_ERROR {
        internal_failure(state)
    } else {
        boundary_failure(state, error)
    }
}

fn empty_reserved<T>(capacity: usize) -> Result<Vec<T>, ()> {
    let mut values = Vec::new();
    values.try_reserve_exact(capacity).map_err(|_| ())?;
    Ok(values)
}

pub(crate) fn allocate(length: u32) -> *mut u8 {
    let Ok(mut state) = lock_state() else {
        return core::ptr::null_mut();
    };
    if length == 0 || length > MAXIMUM_TRANSFER_BYTES {
        boundary_failure(&mut state, TRANSFER_BYTE_LIMIT_ERROR);
        return core::ptr::null_mut();
    }
    let Some(next_total) = state.allocation_bytes.checked_add(length as usize) else {
        internal_failure(&mut state);
        return core::ptr::null_mut();
    };
    if state.allocations.len() >= MAXIMUM_LIVE_ALLOCATIONS
        || next_total > MAXIMUM_LIVE_ALLOCATION_BYTES
    {
        boundary_failure(&mut state, ALLOCATION_LIMIT_ERROR);
        return core::ptr::null_mut();
    }
    let mut allocation = Vec::new();
    if allocation.try_reserve_exact(length as usize).is_err() {
        internal_failure(&mut state);
        return core::ptr::null_mut();
    }
    allocation.resize(length as usize, 0);
    let mut allocation = allocation.into_boxed_slice();
    let pointer = allocation.as_mut_ptr();
    if state.allocations.contains_key(&(pointer as usize)) {
        internal_failure(&mut state);
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
    let key = pointer as usize;
    let exact = !pointer.is_null()
        && state
            .allocations
            .get(&key)
            .is_some_and(|allocation| allocation.len() == length as usize);
    if !exact {
        return boundary_failure(&mut state, BUFFER_IDENTITY_ERROR);
    }
    let Some(allocation) = state.allocations.remove(&key) else {
        return internal_failure(&mut state);
    };
    let Some(next_total) = state.allocation_bytes.checked_sub(allocation.len()) else {
        return internal_failure(&mut state);
    };
    state.allocation_bytes = next_total;
    STATUS_OK
}

fn store_verifier_outcome(
    state: &mut BoundaryState,
    outcome: Result<Vec<u8>, &'static str>,
) -> u32 {
    state.stage = None;
    state.result.clear();
    state.error.clear();
    match outcome {
        Ok(bytes) if bytes.is_empty() || bytes.len() > MAXIMUM_RESULT_BYTES as usize => {
            internal_failure(state)
        }
        Ok(bytes) => {
            state.result = bytes;
            STATUS_OK
        }
        Err(error) => {
            state.error.extend_from_slice(error.as_bytes());
            STATUS_VERIFICATION_ERROR
        }
    }
}

fn direct_one<F>(
    pointer: *const u8,
    length: u32,
    maximum: u32,
    limit_error: &'static [u8],
    operation: F,
) -> u32
where
    F: FnOnce(&[u8]) -> Result<Vec<u8>, &'static str>,
{
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_operation_state(&mut state);
    let input = match input_copy_locked(&state, pointer, length, maximum, limit_error) {
        Ok(input) => input,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let outcome = operation(&input);
    store_verifier_outcome(&mut state, outcome)
}

pub(crate) fn finalize_campaign_plan(pointer: *const u8, length: u32) -> u32 {
    direct_one(
        pointer,
        length,
        MAXIMUM_PLAN_BYTES,
        PLAN_BYTE_LIMIT_ERROR,
        |input| {
            finalize_campaign_plan_json(input)
                .map(|plan| plan.to_bytes())
                .map_err(|error| error.code())
        },
    )
}

pub(crate) fn validate_campaign_plan(pointer: *const u8, length: u32) -> u32 {
    direct_one(
        pointer,
        length,
        MAXIMUM_PLAN_BYTES,
        PLAN_BYTE_LIMIT_ERROR,
        |input| {
            validate_campaign_plan_json(input)
                .map(|plan| plan.to_bytes())
                .map_err(|error| error.code())
        },
    )
}

pub(crate) fn begin_phase_invalidation(
    campaign_pointer: *const u8,
    campaign_length: u32,
    receipt_count: u32,
) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_operation_state(&mut state);
    if receipt_count > MAXIMUM_RECEIPT_INPUTS {
        return boundary_failure(&mut state, RECEIPT_COUNT_ERROR);
    }
    let campaign_bytes = match input_copy_locked(
        &state,
        campaign_pointer,
        campaign_length,
        MAXIMUM_PROJECTION_METADATA_BYTES,
        CAMPAIGN_ID_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let campaign_id = match std::str::from_utf8(&campaign_bytes) {
        Ok(value) => value.to_owned(),
        Err(_) => return boundary_failure(&mut state, CAMPAIGN_ID_ENCODING_ERROR),
    };
    let receipt_bytes = match empty_reserved(receipt_count as usize) {
        Ok(values) => values,
        Err(()) => return internal_failure(&mut state),
    };
    state.stage = Some(StagedOperation::PhaseInvalidation {
        campaign_id,
        expected_receipt_count: receipt_count as usize,
        receipt_bytes,
        total_receipt_bytes: 0,
    });
    STATUS_OK
}

fn parse_projection_metadata(bytes: &[u8]) -> Result<ProjectionMetadata, ExecutionFailure> {
    let metadata: ProjectionMetadata = serde_json::from_slice(bytes)
        .map_err(|_| ExecutionFailure::Boundary(PROJECTION_METADATA_ERROR))?;
    let canonical = serde_json::to_vec(&metadata).map_err(|_| ExecutionFailure::Internal)?;
    if canonical != bytes {
        return Err(ExecutionFailure::Boundary(PROJECTION_METADATA_ERROR));
    }
    Ok(metadata)
}

pub(crate) fn begin_campaign_projection(
    metadata_pointer: *const u8,
    metadata_length: u32,
    plan_pointer: *const u8,
    plan_length: u32,
    receipt_count: u32,
    subject_count: u32,
) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_operation_state(&mut state);
    if receipt_count > MAXIMUM_RECEIPT_INPUTS {
        return boundary_failure(&mut state, RECEIPT_COUNT_ERROR);
    }
    if subject_count > MAXIMUM_SUBJECT_INPUTS {
        return boundary_failure(&mut state, SUBJECT_COUNT_ERROR);
    }
    let metadata_bytes = match input_copy_locked(
        &state,
        metadata_pointer,
        metadata_length,
        MAXIMUM_PROJECTION_METADATA_BYTES,
        PROJECTION_METADATA_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let campaign_plan_bytes = match input_copy_locked(
        &state,
        plan_pointer,
        plan_length,
        MAXIMUM_PLAN_BYTES,
        PLAN_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let metadata = match parse_projection_metadata(&metadata_bytes) {
        Ok(metadata) => metadata,
        Err(ExecutionFailure::Boundary(error)) => {
            return boundary_failure(&mut state, error);
        }
        Err(ExecutionFailure::Internal) => return internal_failure(&mut state),
        Err(ExecutionFailure::Verification(_)) => return internal_failure(&mut state),
    };
    let receipt_bytes = match empty_reserved(receipt_count as usize) {
        Ok(values) => values,
        Err(()) => return internal_failure(&mut state),
    };
    let subject_bytes = match empty_reserved(subject_count as usize) {
        Ok(values) => values,
        Err(()) => return internal_failure(&mut state),
    };
    state.stage = Some(StagedOperation::CampaignProjection {
        metadata,
        campaign_plan_bytes,
        expected_receipt_count: receipt_count as usize,
        expected_subject_count: subject_count as usize,
        receipt_bytes,
        subject_bytes,
        total_receipt_bytes: 0,
        total_subject_bytes: 0,
    });
    STATUS_OK
}

fn checked_append_total(current: usize, added: usize, maximum: usize) -> Result<usize, ()> {
    let next = current.checked_add(added).ok_or(())?;
    if next > maximum {
        return Err(());
    }
    Ok(next)
}

pub(crate) fn append_receipt(pointer: *const u8, length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    state.result.clear();
    state.error.clear();
    let bytes = match input_copy_locked(
        &state,
        pointer,
        length,
        MAXIMUM_RECEIPT_BYTES,
        RECEIPT_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let appended = match state.stage.as_mut() {
        Some(StagedOperation::PhaseInvalidation {
            expected_receipt_count,
            receipt_bytes,
            total_receipt_bytes,
            ..
        })
        | Some(StagedOperation::CampaignProjection {
            expected_receipt_count,
            receipt_bytes,
            total_receipt_bytes,
            ..
        }) => {
            if receipt_bytes.len() >= *expected_receipt_count {
                Err(RECEIPT_COUNT_ERROR)
            } else {
                match checked_append_total(
                    *total_receipt_bytes,
                    bytes.len(),
                    MAXIMUM_TOTAL_RECEIPT_BYTES,
                ) {
                    Ok(total) => {
                        *total_receipt_bytes = total;
                        receipt_bytes.push(bytes);
                        Ok(())
                    }
                    Err(()) => Err(RECEIPT_TOTAL_ERROR),
                }
            }
        }
        None => Err(STAGE_MISSING_ERROR),
    };
    match appended {
        Ok(()) => STATUS_OK,
        Err(error) => boundary_failure(&mut state, error),
    }
}

pub(crate) fn append_subject(pointer: *const u8, length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    state.result.clear();
    state.error.clear();
    let bytes = match input_copy_locked(
        &state,
        pointer,
        length,
        MAXIMUM_SUBJECT_BYTES,
        SUBJECT_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let appended = match state.stage.as_mut() {
        Some(StagedOperation::CampaignProjection {
            expected_subject_count,
            subject_bytes,
            total_subject_bytes,
            ..
        }) => {
            if subject_bytes.len() >= *expected_subject_count {
                Err(SUBJECT_COUNT_ERROR)
            } else {
                match checked_append_total(
                    *total_subject_bytes,
                    bytes.len(),
                    MAXIMUM_TOTAL_SUBJECT_BYTES,
                ) {
                    Ok(total) => {
                        *total_subject_bytes = total;
                        subject_bytes.push(bytes);
                        Ok(())
                    }
                    Err(()) => Err(SUBJECT_TOTAL_ERROR),
                }
            }
        }
        Some(StagedOperation::PhaseInvalidation { .. }) => Err(SUBJECT_STAGE_ERROR),
        None => Err(STAGE_MISSING_ERROR),
    };
    match appended {
        Ok(()) => STATUS_OK,
        Err(error) => boundary_failure(&mut state, error),
    }
}

fn execute_phase(
    campaign_id: &str,
    expected_receipt_count: usize,
    receipt_bytes: &[Vec<u8>],
) -> Result<Vec<u8>, ExecutionFailure> {
    if receipt_bytes.len() != expected_receipt_count {
        return Err(ExecutionFailure::Boundary(STAGE_COUNT_ERROR));
    }
    classify_phase_receipts(campaign_id, receipt_bytes)
        .map(|result| result.to_bytes())
        .map_err(|error| ExecutionFailure::Verification(error.code()))
}

fn execute_projection(
    metadata: &ProjectionMetadata,
    campaign_plan_bytes: &[u8],
    expected_receipt_count: usize,
    expected_subject_count: usize,
    receipt_bytes: &[Vec<u8>],
    subject_bytes: &[Vec<u8>],
) -> Result<Vec<u8>, ExecutionFailure> {
    if receipt_bytes.len() != expected_receipt_count
        || subject_bytes.len() != expected_subject_count
    {
        return Err(ExecutionFailure::Boundary(STAGE_COUNT_ERROR));
    }
    project_campaign(CampaignProjectionInput {
        campaign_plan_bytes,
        expected_campaign_plan_sha256: &metadata.expected_campaign_plan_sha256,
        expected_campaign_id: &metadata.expected_campaign_id,
        expected_environment: &metadata.expected_environment,
        expected_terminal_registry_receipt_id: metadata
            .expected_terminal_registry_receipt_id
            .as_deref(),
        receipt_bytes,
        subject_bytes,
        trusted_root_registry_receipt_id: metadata.trusted_root_registry_receipt_id.as_deref(),
        verification_time_utc: &metadata.verification_time_utc,
    })
    .map(|result| result.to_bytes())
    .map_err(|error| ExecutionFailure::Verification(error.code()))
}

pub(crate) fn execute_staged() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    state.result.clear();
    state.error.clear();
    let Some(stage) = state.stage.take() else {
        return boundary_failure(&mut state, STAGE_MISSING_ERROR);
    };
    let outcome = match stage {
        StagedOperation::PhaseInvalidation {
            campaign_id,
            expected_receipt_count,
            receipt_bytes,
            ..
        } => execute_phase(&campaign_id, expected_receipt_count, &receipt_bytes),
        StagedOperation::CampaignProjection {
            metadata,
            campaign_plan_bytes,
            expected_receipt_count,
            expected_subject_count,
            receipt_bytes,
            subject_bytes,
            ..
        } => execute_projection(
            &metadata,
            &campaign_plan_bytes,
            expected_receipt_count,
            expected_subject_count,
            &receipt_bytes,
            &subject_bytes,
        ),
    };
    match outcome {
        Ok(bytes) => store_verifier_outcome(&mut state, Ok(bytes)),
        Err(ExecutionFailure::Boundary(error)) => boundary_failure(&mut state, error),
        Err(ExecutionFailure::Verification(error)) => {
            store_verifier_outcome(&mut state, Err(error))
        }
        Err(ExecutionFailure::Internal) => internal_failure(&mut state),
    }
}

pub(crate) fn validate_campaign_projection_result(
    result_pointer: *const u8,
    result_length: u32,
    plan_pointer: *const u8,
    plan_length: u32,
) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_operation_state(&mut state);
    let result_bytes = match input_copy_locked(
        &state,
        result_pointer,
        result_length,
        MAXIMUM_RESULT_BYTES,
        RESULT_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let plan_bytes = match input_copy_locked(
        &state,
        plan_pointer,
        plan_length,
        MAXIMUM_PLAN_BYTES,
        PLAN_BYTE_LIMIT_ERROR,
    ) {
        Ok(bytes) => bytes,
        Err(error) => return status_for_input_error(&mut state, error),
    };
    let outcome = verify_campaign_projection_result(&result_bytes, &plan_bytes)
        .map(|result| result.to_bytes())
        .map_err(|error| error.code());
    store_verifier_outcome(&mut state, outcome)
}

pub(crate) fn reset() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_operation_state(&mut state);
    STATUS_OK
}

pub(crate) fn result_length() -> u32 {
    match lock_state() {
        Ok(state) => u32::try_from(state.result.len())
            .ok()
            .map_or(0, |value| value),
        Err(_) => 0,
    }
}

pub(crate) fn error_length() -> u32 {
    match lock_state() {
        Ok(state) => u32::try_from(state.error.len())
            .ok()
            .map_or(0, |value| value),
        Err(_) => 0,
    }
}

fn copy_current(pointer: *mut u8, length: u32, copy_error: bool) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    if pointer.is_null() || length == 0 || length > MAXIMUM_TRANSFER_BYTES {
        return boundary_failure(&mut state, TRANSFER_BYTE_LIMIT_ERROR);
    }
    let source = if copy_error {
        match copy_bytes(&state.error) {
            Ok(bytes) => bytes,
            Err(()) => return internal_failure(&mut state),
        }
    } else {
        match copy_bytes(&state.result) {
            Ok(bytes) => bytes,
            Err(()) => return internal_failure(&mut state),
        }
    };
    let Some(allocation) = state.allocations.get_mut(&(pointer as usize)) else {
        return boundary_failure(&mut state, BUFFER_IDENTITY_ERROR);
    };
    if allocation.len() != length as usize || source.len() != length as usize {
        return boundary_failure(&mut state, COPY_LENGTH_ERROR);
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

    fn clean_state() {
        let mut state = lock_state().expect("boundary state must remain available");
        state.allocations.clear();
        state.allocation_bytes = 0;
        clear_operation_state(&mut state);
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
    fn rejects_unowned_mismatched_and_excessive_allocations() {
        let _serial = serial();
        clean_state();
        assert_eq!(
            finalize_campaign_plan(core::ptr::dangling(), 8),
            STATUS_BOUNDARY_ERROR
        );
        assert!(allocate(0).is_null());
        assert!(allocate(MAXIMUM_TRANSFER_BYTES + 1).is_null());
        let mut pointers = Vec::new();
        for _ in 0..MAXIMUM_LIVE_ALLOCATIONS {
            let pointer = allocate(1);
            assert!(!pointer.is_null());
            pointers.push(pointer);
        }
        assert!(allocate(1).is_null());
        for pointer in pointers {
            assert_eq!(release(pointer, 1), STATUS_OK);
        }
        let pointer = allocate(16);
        assert!(!pointer.is_null());
        assert_eq!(release(pointer, 15), STATUS_BOUNDARY_ERROR);
        assert_eq!(release(pointer, 16), STATUS_OK);
        assert_eq!(release(pointer, 16), STATUS_BOUNDARY_ERROR);
    }

    #[test]
    fn finalizes_and_validates_exact_plan_bytes() {
        let _serial = serial();
        clean_state();
        let draft_pointer = allocate(DRAFT.len() as u32);
        assert!(!draft_pointer.is_null());
        write_allocation(draft_pointer, DRAFT);
        assert_eq!(
            finalize_campaign_plan(draft_pointer, DRAFT.len() as u32),
            STATUS_OK
        );
        assert_eq!(read_current_result(), PLAN);
        assert_eq!(release(draft_pointer, DRAFT.len() as u32), STATUS_OK);

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

    #[test]
    fn stage_failures_and_execution_destroy_prior_evidence() {
        let _serial = serial();
        clean_state();
        let campaign = b"campaign-test";
        let campaign_pointer = allocate(campaign.len() as u32);
        assert!(!campaign_pointer.is_null());
        write_allocation(campaign_pointer, campaign);
        assert_eq!(
            begin_phase_invalidation(campaign_pointer, campaign.len() as u32, 1),
            STATUS_OK
        );
        assert_eq!(release(campaign_pointer, campaign.len() as u32), STATUS_OK);
        assert_eq!(
            append_subject(core::ptr::dangling(), 8),
            STATUS_BOUNDARY_ERROR
        );
        assert_eq!(execute_staged(), STATUS_BOUNDARY_ERROR);

        let campaign_pointer = allocate(campaign.len() as u32);
        assert!(!campaign_pointer.is_null());
        write_allocation(campaign_pointer, campaign);
        assert_eq!(
            begin_phase_invalidation(campaign_pointer, campaign.len() as u32, 0),
            STATUS_OK
        );
        assert_eq!(release(campaign_pointer, campaign.len() as u32), STATUS_OK);
        assert_eq!(execute_staged(), STATUS_VERIFICATION_ERROR);
        assert_eq!(execute_staged(), STATUS_BOUNDARY_ERROR);
        assert_eq!(reset(), STATUS_OK);
    }
}
