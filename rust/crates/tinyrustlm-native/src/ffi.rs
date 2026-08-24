use serde::Serialize;
use std::ffi::CString;
use std::os::raw::c_char;
use std::panic::{catch_unwind, AssertUnwindSafe};

use crate::model::{self, MAXIMUM_MODEL_REQUEST_JSON_BYTES, MODEL_INSPECTION_SCHEMA};
use crate::response::{self, NativeError, NativeResult};
use crate::runtime::{
    self, MAXIMUM_KV_BYTES, MAXIMUM_MODEL_BYTES, MAXIMUM_PROMPT2_REQUEST_BYTES,
    MAXIMUM_RESIDENT_DEPENDENCY_BYTES, MAXIMUM_RESOLVED_MEMBER_BYTES, MAXIMUM_RUNTIME_HANDLES,
    MAXIMUM_RUNTIME_JSON_BYTES, MAXIMUM_SCRATCH_BYTES, MAXIMUM_SEQUENCE_TOKENS,
    RUNTIME_ACTIVATION_SCHEMA, RUNTIME_CREATE_SCHEMA,
};
use crate::transport::{
    self, MAXIMUM_P2P_MANIFEST_BYTES, MAXIMUM_P2P_REQUEST_JSON_BYTES, P2P_ASSEMBLE_SCHEMA,
    P2P_PREPARE_SCHEMA,
};

const NATIVE_ABI_SCHEMA: &str = "tinyrustlm.native_abi/1";
const NATIVE_ABI_REVISION: u32 = 1;
const NATIVE_ABI_SYMBOLS: [&str; 15] = [
    "tinyrustlm_native_contract_json",
    "tinyrustlm_p2p_assemble_json",
    "tinyrustlm_p2p_inspect_manifest_json",
    "tinyrustlm_p2p_prepare_share_kit_json",
    "tinyrustlm_runtime_activate_json",
    "tinyrustlm_runtime_advance_operation_json",
    "tinyrustlm_runtime_begin_request_json",
    "tinyrustlm_runtime_create_json",
    "tinyrustlm_runtime_destroy_json",
    "tinyrustlm_runtime_finish_json",
    "tinyrustlm_runtime_set_transcript_json",
    "tinyrustlm_runtime_state_json",
    "tinyrustlm_runtime_step_json",
    "tinyrustlm_slm2_inspect_json",
    "tinyrustlm_string_free",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContractReport {
    schema: &'static str,
    abi_revision: u32,
    package_version: &'static str,
    product: &'static str,
    prelaunch_single_product: bool,
    contracts: ContractSchemas,
    capabilities: [&'static str; 5],
    symbols: [&'static str; 15],
    limits: ContractLimits,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContractSchemas {
    model_inspection: &'static str,
    runtime_create: &'static str,
    runtime_activation: &'static str,
    p2p_prepare: &'static str,
    p2p_assemble: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContractLimits {
    maximum_model_request_json_bytes: usize,
    maximum_runtime_json_bytes: usize,
    maximum_prompt2_request_bytes: usize,
    maximum_p2p_request_json_bytes: usize,
    maximum_p2p_manifest_bytes: usize,
    maximum_runtime_handles: usize,
    maximum_model_bytes: u64,
    maximum_sequence_tokens: u32,
    maximum_kv_bytes: u64,
    maximum_scratch_bytes: u64,
    maximum_resolved_member_bytes: u64,
    maximum_resident_dependency_bytes: u64,
}

/// Returns the exact current native ABI contract as a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_native_contract_json() -> *mut c_char {
    guarded(|| {
        response::json(Ok(ContractReport {
            schema: NATIVE_ABI_SCHEMA,
            abi_revision: NATIVE_ABI_REVISION,
            package_version: env!("CARGO_PKG_VERSION"),
            product: "TinyRustLM",
            prelaunch_single_product: true,
            contracts: ContractSchemas {
                model_inspection: MODEL_INSPECTION_SCHEMA,
                runtime_create: RUNTIME_CREATE_SCHEMA,
                runtime_activation: RUNTIME_ACTIVATION_SCHEMA,
                p2p_prepare: P2P_PREPARE_SCHEMA,
                p2p_assemble: P2P_ASSEMBLE_SCHEMA,
            },
            capabilities: [
                "slm2-inspection",
                "acg2-activation",
                "prompt2-sampling2-generation",
                "bounded-scalar-runtime",
                "composition-bound-direct-transport",
            ],
            symbols: NATIVE_ABI_SYMBOLS,
            limits: ContractLimits {
                maximum_model_request_json_bytes: MAXIMUM_MODEL_REQUEST_JSON_BYTES,
                maximum_runtime_json_bytes: MAXIMUM_RUNTIME_JSON_BYTES,
                maximum_prompt2_request_bytes: MAXIMUM_PROMPT2_REQUEST_BYTES,
                maximum_p2p_request_json_bytes: MAXIMUM_P2P_REQUEST_JSON_BYTES,
                maximum_p2p_manifest_bytes: MAXIMUM_P2P_MANIFEST_BYTES,
                maximum_runtime_handles: MAXIMUM_RUNTIME_HANDLES,
                maximum_model_bytes: MAXIMUM_MODEL_BYTES,
                maximum_sequence_tokens: MAXIMUM_SEQUENCE_TOKENS,
                maximum_kv_bytes: MAXIMUM_KV_BYTES,
                maximum_scratch_bytes: MAXIMUM_SCRATCH_BYTES,
                maximum_resolved_member_bytes: MAXIMUM_RESOLVED_MEMBER_BYTES,
                maximum_resident_dependency_bytes: MAXIMUM_RESIDENT_DEPENDENCY_BYTES,
            },
        }))
    })
}

/// Releases a JSON string returned by this native ABI.
///
/// A null pointer is accepted as a no-op.
///
/// # Safety
///
/// `ptr` must be null or a pointer returned by this loaded TinyRustLM native
/// library, and each non-null pointer must be passed exactly once.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_string_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(unsafe { CString::from_raw(ptr) });
    }
}

/// Validates one exact SLM2 artifact under a caller-supplied bounded policy.
///
/// # Safety
///
/// `request_ptr` must identify `request_len` readable bytes for this call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_slm2_inspect_json(
    request_ptr: *const u8,
    request_len: usize,
) -> *mut c_char {
    guarded(|| {
        let request =
            match unsafe { copy_input(request_ptr, request_len, MAXIMUM_MODEL_REQUEST_JSON_BYTES) }
            {
                Ok(request) => request,
                Err(error) => return response::json::<()>(Err(error)),
            };
        response::json(model::inspect(&request))
    })
}

/// Creates one bounded empty conversation runtime.
///
/// # Safety
///
/// The request and operation pointers must identify their declared readable
/// byte ranges for this call. The operation identity must contain exactly 32
/// bytes.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_runtime_create_json(
    request_ptr: *const u8,
    request_len: usize,
    operation_ptr: *const u8,
    operation_len: usize,
    transcript_revision: u64,
) -> *mut c_char {
    guarded(|| {
        let request =
            match unsafe { copy_input(request_ptr, request_len, MAXIMUM_RUNTIME_JSON_BYTES) } {
                Ok(request) => request,
                Err(error) => return response::json::<()>(Err(error)),
            };
        let operation = match unsafe { copy_identity(operation_ptr, operation_len) } {
            Ok(operation) => operation,
            Err(error) => return response::json::<()>(Err(error)),
        };
        response::json(runtime::create(&request, operation, transcript_revision))
    })
}

/// Destroys one runtime handle and makes it permanently unreachable.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_destroy_json(handle: u64) -> *mut c_char {
    guarded(|| response::json(runtime::destroy(handle)))
}

/// Returns one bounded snapshot of observable runtime state.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_state_json(handle: u64) -> *mut c_char {
    guarded(|| response::json(runtime::state(handle)))
}

/// Resolves and fail-atomically activates one exact ACG2 composition.
///
/// # Safety
///
/// The request and operation pointers must identify their declared readable
/// byte ranges for this call. The operation identity must contain exactly 32
/// bytes.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_runtime_activate_json(
    handle: u64,
    request_ptr: *const u8,
    request_len: usize,
    expected_operation_ptr: *const u8,
    expected_operation_len: usize,
) -> *mut c_char {
    guarded(|| {
        let request =
            match unsafe { copy_input(request_ptr, request_len, MAXIMUM_RUNTIME_JSON_BYTES) } {
                Ok(request) => request,
                Err(error) => return response::json::<()>(Err(error)),
            };
        let operation =
            match unsafe { copy_identity(expected_operation_ptr, expected_operation_len) } {
                Ok(operation) => operation,
                Err(error) => return response::json::<()>(Err(error)),
            };
        response::json(runtime::activate(handle, &request, operation))
    })
}

/// Compare-and-swaps the current operation identity while no generation is pending.
///
/// # Safety
///
/// Both identity pointers must identify their declared readable byte ranges for
/// this call. Each identity must contain exactly 32 bytes.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_runtime_advance_operation_json(
    handle: u64,
    expected_current_ptr: *const u8,
    expected_current_len: usize,
    next_ptr: *const u8,
    next_len: usize,
) -> *mut c_char {
    guarded(|| {
        let expected = match unsafe { copy_identity(expected_current_ptr, expected_current_len) } {
            Ok(identity) => identity,
            Err(error) => return response::json::<()>(Err(error)),
        };
        let next = match unsafe { copy_identity(next_ptr, next_len) } {
            Ok(identity) => identity,
            Err(error) => return response::json::<()>(Err(error)),
        };
        response::json(runtime::advance_operation(handle, expected, next))
    })
}

/// Replaces the presentation-owned transcript revision outside generation.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_set_transcript_json(
    handle: u64,
    transcript_revision: u64,
) -> *mut c_char {
    guarded(|| response::json(runtime::set_transcript(handle, transcript_revision)))
}

/// Compiles and prefills one exact Prompt2 request wire.
///
/// # Safety
///
/// The request and operation pointers must identify their declared readable
/// byte ranges for this call. The operation identity must contain exactly 32
/// bytes.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_runtime_begin_request_json(
    handle: u64,
    request_ptr: *const u8,
    request_len: usize,
    expected_operation_ptr: *const u8,
    expected_operation_len: usize,
) -> *mut c_char {
    guarded(|| {
        let request =
            match unsafe { copy_input(request_ptr, request_len, MAXIMUM_PROMPT2_REQUEST_BYTES) } {
                Ok(request) => request,
                Err(error) => return response::json::<()>(Err(error)),
            };
        let operation =
            match unsafe { copy_identity(expected_operation_ptr, expected_operation_len) } {
                Ok(operation) => operation,
                Err(error) => return response::json::<()>(Err(error)),
            };
        response::json(runtime::begin_request(handle, &request, operation))
    })
}

/// Advances generation exactly once, optionally observing cancellation.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_step_json(handle: u64, cancelled: u8) -> *mut c_char {
    guarded(|| {
        let cancelled = match cancelled {
            0 => false,
            1 => true,
            _ => return response::error("native-boolean"),
        };
        response::json(runtime::step(handle, cancelled))
    })
}

/// Decodes and consumes one terminal raw model output exactly once.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_finish_json(handle: u64) -> *mut c_char {
    guarded(|| response::json(runtime::finish(handle)))
}

/// Creates one composition-bound, create-only P2P share kit.
///
/// # Safety
///
/// `request_ptr` must identify `request_len` readable bytes for this call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_prepare_share_kit_json(
    request_ptr: *const u8,
    request_len: usize,
) -> *mut c_char {
    guarded(|| {
        let request =
            match unsafe { copy_input(request_ptr, request_len, MAXIMUM_P2P_REQUEST_JSON_BYTES) } {
                Ok(request) => request,
                Err(error) => return response::json::<()>(Err(error)),
            };
        response::json(transport::prepare(&request))
    })
}

/// Validates one exact registered P2P manifest.
///
/// # Safety
///
/// `manifest_ptr` must identify `manifest_len` readable bytes for this call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_inspect_manifest_json(
    manifest_ptr: *const u8,
    manifest_len: usize,
) -> *mut c_char {
    guarded(|| {
        let manifest =
            match unsafe { copy_input(manifest_ptr, manifest_len, MAXIMUM_P2P_MANIFEST_BYTES) } {
                Ok(manifest) => manifest,
                Err(error) => return response::json::<()>(Err(error)),
            };
        response::json(transport::inspect(&manifest))
    })
}

/// Verifies, admits, and create-only assembles an artifact from fixed pieces.
///
/// # Safety
///
/// Both pointers must identify their declared readable byte ranges for this
/// call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_assemble_json(
    request_ptr: *const u8,
    request_len: usize,
    manifest_ptr: *const u8,
    manifest_len: usize,
) -> *mut c_char {
    guarded(|| {
        let request =
            match unsafe { copy_input(request_ptr, request_len, MAXIMUM_P2P_REQUEST_JSON_BYTES) } {
                Ok(request) => request,
                Err(error) => return response::json::<()>(Err(error)),
            };
        let manifest =
            match unsafe { copy_input(manifest_ptr, manifest_len, MAXIMUM_P2P_MANIFEST_BYTES) } {
                Ok(manifest) => manifest,
                Err(error) => return response::json::<()>(Err(error)),
            };
        response::json(transport::assemble(&request, &manifest))
    })
}

fn guarded(operation: impl FnOnce() -> *mut c_char) -> *mut c_char {
    catch_unwind(AssertUnwindSafe(operation)).unwrap_or_else(|_| response::error("native-panic"))
}

unsafe fn copy_input(
    ptr: *const u8,
    length: usize,
    maximum_length: usize,
) -> NativeResult<Vec<u8>> {
    if length == 0 {
        return Err(NativeError::new("native-input-empty"));
    }
    if length > maximum_length {
        return Err(NativeError::new("native-input-size"));
    }
    if ptr.is_null() {
        return Err(NativeError::new("native-input-pointer"));
    }
    let source = unsafe { std::slice::from_raw_parts(ptr, length) };
    let mut owned = Vec::new();
    owned
        .try_reserve_exact(length)
        .map_err(|_| NativeError::new("native-allocation"))?;
    owned.extend_from_slice(source);
    Ok(owned)
}

unsafe fn copy_identity(ptr: *const u8, length: usize) -> NativeResult<[u8; 32]> {
    if length != 32 {
        return Err(NativeError::new("native-operation-identity"));
    }
    let bytes = unsafe { copy_input(ptr, length, 32) }?;
    let mut identity = [0_u8; 32];
    identity.copy_from_slice(&bytes);
    Ok(identity)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::ffi::CStr;

    fn take_json(ptr: *mut c_char) -> Value {
        assert!(!ptr.is_null());
        let text = unsafe { CStr::from_ptr(ptr) }
            .to_str()
            .expect("native JSON must be UTF-8")
            .to_owned();
        unsafe { tinyrustlm_string_free(ptr) };
        serde_json::from_str(&text).expect("native response must be JSON")
    }

    fn create_request() -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({
            "schema": RUNTIME_CREATE_SCHEMA,
            "maximumModelBytes": 1_000_000,
            "maximumSequenceTokens": 128,
            "maximumKvBytes": 1_000_000,
            "maximumScratchBytes": 1_000_000,
            "maximumResolvedMemberBytes": 2_000_000,
            "maximumResidentDependencyBytes": 1_000_000,
            "maximumRequestBytes": 4_096
        }))
        .unwrap()
    }

    #[test]
    fn contract_reports_only_the_current_bounded_surface() {
        let report = take_json(tinyrustlm_native_contract_json());
        assert_eq!(report["ok"], true);
        assert_eq!(report["value"]["schema"], NATIVE_ABI_SCHEMA);
        assert_eq!(report["value"]["abiRevision"], 1);
        assert_eq!(report["value"]["prelaunchSingleProduct"], true);
        assert_eq!(report["value"]["capabilities"].as_array().unwrap().len(), 5);
        assert_eq!(
            report["value"]["symbols"],
            serde_json::to_value(NATIVE_ABI_SYMBOLS).unwrap()
        );
    }

    #[test]
    fn runtime_operation_identity_is_compare_and_swap_bounded() {
        let request = create_request();
        let initial = [7_u8; 32];
        let created = take_json(unsafe {
            tinyrustlm_runtime_create_json(
                request.as_ptr(),
                request.len(),
                initial.as_ptr(),
                initial.len(),
                4,
            )
        });
        assert_eq!(created["ok"], true, "{created}");
        let handle = created["value"]["handle"].as_u64().unwrap();
        assert_eq!(created["value"]["state"]["state"], "empty");
        assert_eq!(created["value"]["state"]["transcriptRevision"], 4);

        let next = [8_u8; 32];
        let advanced = take_json(unsafe {
            tinyrustlm_runtime_advance_operation_json(
                handle,
                initial.as_ptr(),
                initial.len(),
                next.as_ptr(),
                next.len(),
            )
        });
        assert_eq!(advanced["ok"], true, "{advanced}");
        assert_eq!(advanced["value"]["operationId"], "08".repeat(32));

        let stale = take_json(unsafe {
            tinyrustlm_runtime_advance_operation_json(
                handle,
                initial.as_ptr(),
                initial.len(),
                next.as_ptr(),
                next.len(),
            )
        });
        assert_eq!(stale["ok"], false);
        assert_eq!(stale["error"]["code"], "acg2-stale-operation");
        assert!(stale["error"].get("message").is_none());

        let destroyed = take_json(tinyrustlm_runtime_destroy_json(handle));
        assert_eq!(destroyed["value"]["destroyed"], true);
        let missing = take_json(tinyrustlm_runtime_state_json(handle));
        assert_eq!(missing["error"]["code"], "native-runtime-handle");
    }

    #[test]
    fn pointer_lengths_and_closed_booleans_fail_before_runtime_access() {
        let null = take_json(unsafe { tinyrustlm_slm2_inspect_json(std::ptr::null(), 1) });
        assert_eq!(null["error"]["code"], "native-input-pointer");
        assert!(null["error"].get("message").is_none());

        let identity = [1_u8; 31];
        let request = create_request();
        let wrong_identity = take_json(unsafe {
            tinyrustlm_runtime_create_json(
                request.as_ptr(),
                request.len(),
                identity.as_ptr(),
                identity.len(),
                0,
            )
        });
        assert_eq!(wrong_identity["error"]["code"], "native-operation-identity");

        let invalid_boolean = take_json(tinyrustlm_runtime_step_json(u64::MAX, 2));
        assert_eq!(invalid_boolean["error"]["code"], "native-boolean");
    }

    #[test]
    fn runtime_policy_json_is_closed_and_explicit() {
        let request = serde_json::to_vec(&serde_json::json!({
            "schema": RUNTIME_CREATE_SCHEMA,
            "maximumModelBytes": 1_000_000,
            "maximumSequenceTokens": 128,
            "maximumKvBytes": 1_000_000,
            "maximumScratchBytes": 1_000_000,
            "maximumResolvedMemberBytes": 2_000_000,
            "maximumResidentDependencyBytes": 1_000_000,
            "maximumRequestBytes": 4_096,
            "fallback": true
        }))
        .unwrap();
        let identity = [1_u8; 32];
        let report = take_json(unsafe {
            tinyrustlm_runtime_create_json(
                request.as_ptr(),
                request.len(),
                identity.as_ptr(),
                identity.len(),
                0,
            )
        });
        assert_eq!(report["error"]["code"], "native-json");
    }
}
