use std::sync::{Mutex, MutexGuard, OnceLock};

use crate::{
    write_acg2, Acg2Graph, Acg2Member, Acg2Policy, MemberRole, ACG2_FORMAT_PROFILE_SHA256,
};

const INPUT_CAPACITY: usize = 897;
const ABI_VERSION: u32 = 1;
const STATUS_OK: u32 = 0;
const STATUS_BOUNDARY_ERROR: u32 = 1;
const STATUS_FORMAT_ERROR: u32 = 2;
const STATUS_INTERNAL_ERROR: u32 = 3;

struct WasmState {
    input: [u8; INPUT_CAPACITY],
    output: Vec<u8>,
    error: Vec<u8>,
}

impl Default for WasmState {
    fn default() -> Self {
        Self {
            input: [0; INPUT_CAPACITY],
            output: Vec::new(),
            error: Vec::new(),
        }
    }
}

static STATE: OnceLock<Mutex<WasmState>> = OnceLock::new();

fn state() -> &'static Mutex<WasmState> {
    STATE.get_or_init(|| Mutex::new(WasmState::default()))
}

fn lock_state() -> Result<MutexGuard<'static, WasmState>, u32> {
    state().lock().map_err(|_| STATUS_INTERNAL_ERROR)
}

fn pointer(bytes: &[u8]) -> *const u8 {
    if bytes.is_empty() {
        core::ptr::null()
    } else {
        bytes.as_ptr()
    }
}

fn clear_result(state: &mut WasmState) {
    state.output.clear();
    state.error.clear();
}

fn fail(state: &mut WasmState, code: &str, status: u32) -> u32 {
    clear_result(state);
    state.error.extend_from_slice(code.as_bytes());
    status
}

fn fixture_members() -> Result<[Acg2Member; 5], u32> {
    let definitions = [
        (
            MemberRole::Model,
            8_704,
            "4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502",
        ),
        (
            MemberRole::Tokenizer,
            7_038_773,
            "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b",
        ),
        (
            MemberRole::Template,
            1_403,
            "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8",
        ),
        (
            MemberRole::Sampling,
            65_800,
            "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89",
        ),
        (
            MemberRole::Prompt,
            512,
            "27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3",
        ),
    ];
    let mut members =
        [Acg2Member::new(MemberRole::Model, 1, [1; 32]).map_err(|_| STATUS_INTERNAL_ERROR)?; 5];
    for (index, (role, byte_length, digest)) in definitions.into_iter().enumerate() {
        members[index] = Acg2Member::new(role, byte_length, parse_digest(digest)?)
            .map_err(|_| STATUS_INTERNAL_ERROR)?;
    }
    Ok(members)
}

fn parse_digest(value: &str) -> Result<[u8; 32], u32> {
    if value.len() != 64 {
        return Err(STATUS_INTERNAL_ERROR);
    }
    let mut output = [0_u8; 32];
    for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        output[index] = (nibble(pair[0])? << 4) | nibble(pair[1])?;
    }
    Ok(output)
}

fn nibble(value: u8) -> Result<u8, u32> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err(STATUS_INTERNAL_ERROR),
    }
}

/// Returns the frozen raw ACG2 conformance ABI version.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_abi_version() -> u32 {
    ABI_VERSION
}

/// Returns the fixed writable input capacity.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_input_capacity() -> u32 {
    INPUT_CAPACITY as u32
}

/// Returns a pointer to the fixed input region.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_input_ptr() -> *mut u8 {
    lock_state()
        .map(|mut state| state.input.as_mut_ptr())
        .unwrap_or(core::ptr::null_mut())
}

/// Writes the independent Rust canonical graph into the output region.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_generate() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_result(&mut state);
    let members = match fixture_members() {
        Ok(members) => members,
        Err(status) => return fail(&mut state, "acg2-conformance-fixture", status),
    };
    let mut output = Vec::new();
    match write_acg2(&mut output, &members) {
        Ok(_) => {
            state.output = output;
            STATUS_OK
        }
        Err(error) => fail(&mut state, error.code(), STATUS_FORMAT_ERROR),
    }
}

/// Parses `input[0..length]` and emits artifact, graph, table, and sum identities.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_parse(length: u32) -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_result(&mut state);
    let Ok(length) = usize::try_from(length) else {
        return fail(&mut state, "acg2-artifact-limit", STATUS_BOUNDARY_ERROR);
    };
    if length > INPUT_CAPACITY {
        return fail(&mut state, "acg2-artifact-limit", STATUS_BOUNDARY_ERROR);
    }
    let input = state.input[..length].to_vec();
    match Acg2Graph::from_bytes(&input, Acg2Policy::exact_profile_limits()) {
        Ok(graph) => {
            let identity = graph.identity();
            state.output.extend_from_slice(&identity.artifact_sha256);
            state
                .output
                .extend_from_slice(&identity.graph_identity_sha256);
            state
                .output
                .extend_from_slice(&identity.member_table_sha256);
            state
                .output
                .extend_from_slice(&graph.resolved_member_bytes().to_le_bytes());
            STATUS_OK
        }
        Err(error) => fail(&mut state, error.code(), STATUS_FORMAT_ERROR),
    }
}

/// Returns the exact ACG2 profile SHA-256 as lowercase ASCII.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_profile() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    clear_result(&mut state);
    state
        .output
        .extend_from_slice(ACG2_FORMAT_PROFILE_SHA256.as_bytes());
    STATUS_OK
}

/// Returns the current immutable output byte length.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_output_len() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.output.len()).ok())
        .unwrap_or(0)
}

/// Returns a pointer to current immutable output bytes until the next call.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_output_ptr() -> *const u8 {
    lock_state()
        .map(|state| pointer(&state.output))
        .unwrap_or(core::ptr::null())
}

/// Returns the current stable error-code byte length.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_error_len() -> u32 {
    lock_state()
        .ok()
        .and_then(|state| u32::try_from(state.error.len()).ok())
        .unwrap_or(0)
}

/// Returns a pointer to the current stable error code until the next call.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_error_ptr() -> *const u8 {
    lock_state()
        .map(|state| pointer(&state.error))
        .unwrap_or(core::ptr::null())
}

/// Clears input, output, and error state.
#[allow(unsafe_code)]
#[no_mangle]
pub extern "C" fn trlm_acg2_conformance_clear() -> u32 {
    let Ok(mut state) = lock_state() else {
        return STATUS_INTERNAL_ERROR;
    };
    *state = WasmState::default();
    STATUS_OK
}
