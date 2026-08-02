#![allow(unsafe_code)]
#![doc = "Native C ABI for the public TinyRustLM NuGet SDK."]

use serde::Serialize;
use std::collections::BTreeMap;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_double};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use tinyrustlm_memory::{
    inspect_memory_manifest_text, inspect_memory_package_path_text, memory_required_files_text,
    supported_memory_setups,
};
use tinyrustlm_p2p::{
    apply_received_announcement_text, assemble_from_manifest_text, export_share_metadata_text,
    import_from_manifest_text, inspect_announcement_catalog_text,
    inspect_local_import_receipt_text, inspect_p2p_manifest_text, prepare_local_share_kit,
    validate_announcement_text, verify_signed_manifest_text, PrepareShareKitRequest,
};
use tinyrustlm_runtime_sdk::{runtime_capabilities, GenerationOptions, PublicRuntime, SDK_VERSION};
use tinyrustlm_slm::{inspect_slm_path, SlmLoadPolicy};

const NATIVE_ABI_VERSION: u32 = 7;

static NEXT_HANDLE: AtomicU64 = AtomicU64::new(1);
static RUNTIMES: LazyLock<Mutex<BTreeMap<u64, PublicRuntime>>> =
    LazyLock::new(|| Mutex::new(BTreeMap::new()));

/// Returns SDK and native ABI version details as a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_sdk_version_json() -> *mut c_char {
    json_ok(&VersionReport {
        sdk_version: SDK_VERSION,
        native_abi_version: NATIVE_ABI_VERSION,
        product: "TinyRustLM public NuGet SDK",
    })
}

/// Returns public capability details as a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_sdk_capabilities_json() -> *mut c_char {
    json_ok(&runtime_capabilities())
}

/// Releases strings returned by TinyRustLM native JSON functions.
///
/// Passing a null pointer is allowed.
///
/// # Safety
///
/// `ptr` must be null or a pointer previously returned by a TinyRustLM native
/// function. Each returned pointer must be freed at most once.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_string_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}

/// Inspects a `.slm` file path and returns a JSON envelope.
///
/// # Safety
///
/// `path` must be a valid, null-terminated UTF-8 C string for the duration of
/// the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_slm_inspect_path_json(path: *const c_char) -> *mut c_char {
    let path = match c_string(path, "path") {
        Ok(path) => path,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match inspect_slm_path(PathBuf::from(path)) {
        Ok(report) => json_ok(&report),
        Err(error) => json_error("slm_validation_failed", &error.to_string()),
    }
}

/// Creates a public runtime handle and returns it as a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_create_json() -> *mut c_char {
    let handle = NEXT_HANDLE.fetch_add(1, Ordering::Relaxed);
    match RUNTIMES.lock() {
        Ok(mut runtimes) => {
            runtimes.insert(handle, PublicRuntime::create());
            json_ok(&RuntimeHandle { handle })
        }
        Err(_) => json_error(
            "runtime_registry_unavailable",
            "runtime registry lock failed",
        ),
    }
}

/// Destroys a public runtime handle. Returns 0 on success.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_destroy(handle: u64) -> i32 {
    match RUNTIMES.lock() {
        Ok(mut runtimes) => {
            runtimes.remove(&handle);
            0
        }
        Err(_) => -1,
    }
}

/// Loads a `.slm` model into a runtime handle and returns a JSON envelope.
///
/// # Safety
///
/// `path` must be a valid, null-terminated UTF-8 C string for the duration of
/// the call. `expected_sha256` may be null; when non-null, it must also be a
/// valid, null-terminated UTF-8 C string.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_runtime_load_model_path_json(
    handle: u64,
    path: *const c_char,
    expected_sha256: *const c_char,
) -> *mut c_char {
    let path = match c_string(path, "path") {
        Ok(path) => path,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let expected_sha256 = match optional_c_string(expected_sha256, "expected_sha256") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let policy = SlmLoadPolicy {
        expected_sha256,
        ..SlmLoadPolicy::default()
    };
    with_runtime_mut(handle, |runtime| {
        runtime.load_model_path(PathBuf::from(path), &policy)
    })
}

/// Unloads the model attached to a runtime handle and returns a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_unload_model_json(handle: u64) -> *mut c_char {
    with_runtime_mut(handle, |runtime| {
        runtime
            .unload_model()
            .map(|()| StatusReport { status: "unloaded" })
    })
}

/// Generates text from a prompt and returns a JSON envelope.
///
/// # Safety
///
/// `prompt` must be a valid, null-terminated UTF-8 C string for the duration of
/// the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_runtime_generate_json(
    handle: u64,
    prompt: *const c_char,
    max_new_tokens: u32,
    temperature: c_double,
    top_k: u32,
    top_p: c_double,
    seed: u32,
) -> *mut c_char {
    let prompt = match c_string(prompt, "prompt") {
        Ok(prompt) => prompt,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let options =
        match GenerationOptions::from_native(max_new_tokens, temperature, top_k, top_p, seed) {
            Ok(options) => options,
            Err(error) => return json_error("invalid_generation_options", &error.to_string()),
        };
    with_runtime_mut(handle, |runtime| runtime.generate(&prompt, options))
}

/// Generates one token from the current context and returns a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_step_json(handle: u64) -> *mut c_char {
    with_runtime_mut(handle, |runtime| runtime.step())
}

/// Resets a runtime context and returns a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_reset_json(handle: u64) -> *mut c_char {
    with_runtime_mut(handle, |runtime| {
        runtime.reset().map(|()| StatusReport { status: "reset" })
    })
}

/// Returns runtime diagnostics as a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_runtime_diagnostics_json(handle: u64) -> *mut c_char {
    with_runtime_ref(handle, |runtime| DiagnosticsReport {
        diagnostics: runtime.diagnostics(),
    })
}

/// Prepares a local P2P share kit from request JSON and returns a JSON envelope.
///
/// # Safety
///
/// `request_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_prepare_share_kit_json(
    request_json: *const c_char,
) -> *mut c_char {
    let request_json = match c_string(request_json, "request_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let request = match serde_json::from_str::<PrepareShareKitRequest>(&request_json) {
        Ok(request) => request,
        Err(error) => return json_error("invalid_json", &error.to_string()),
    };
    match prepare_local_share_kit(request) {
        Ok(report) => json_ok(&report),
        Err(error) => json_error("p2p_prepare_failed", &error.to_string()),
    }
}

/// Inspects P2P manifest JSON and returns a JSON envelope.
///
/// # Safety
///
/// `manifest_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_inspect_manifest_json(
    manifest_json: *const c_char,
) -> *mut c_char {
    let manifest_json = match c_string(manifest_json, "manifest_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match inspect_p2p_manifest_text(&manifest_json) {
        Ok(report) => json_ok(&report),
        Err(error) => json_error("p2p_manifest_invalid", &error.to_string()),
    }
}

/// Verifies a signed P2P manifest envelope against local public key JSON and returns a JSON envelope.
///
/// # Safety
///
/// `signed_manifest_json` and `public_key_json` must be valid,
/// null-terminated UTF-8 C strings for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_verify_signed_manifest_json(
    signed_manifest_json: *const c_char,
    public_key_json: *const c_char,
) -> *mut c_char {
    let signed_manifest_json = match c_string(signed_manifest_json, "signed_manifest_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let public_key_json = match c_string(public_key_json, "public_key_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match verify_signed_manifest_text(&signed_manifest_json, &public_key_json) {
        Ok(report) => json_ok(&report),
        Err(error) => json_error("p2p_signed_manifest_invalid", &error.to_string()),
    }
}

/// Creates a P2P import plan from manifest JSON and returns a JSON envelope.
///
/// # Safety
///
/// `manifest_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_import_from_manifest_json(
    manifest_json: *const c_char,
) -> *mut c_char {
    let manifest_json = match c_string(manifest_json, "manifest_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match import_from_manifest_text(&manifest_json) {
        Ok(plan) => json_ok(&plan),
        Err(error) => json_error("p2p_import_plan_failed", &error.to_string()),
    }
}

/// Assembles local P2P pieces from manifest JSON and returns a verified receipt envelope.
///
/// # Safety
///
/// `manifest_json`, `share_kit_root`, and `output_path` must be valid,
/// null-terminated UTF-8 C strings for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_assemble_from_manifest_json(
    manifest_json: *const c_char,
    share_kit_root: *const c_char,
    output_path: *const c_char,
) -> *mut c_char {
    let manifest_json = match c_string(manifest_json, "manifest_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let share_kit_root = match c_string(share_kit_root, "share_kit_root") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let output_path = match c_string(output_path, "output_path") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match assemble_from_manifest_text(&manifest_json, share_kit_root, output_path) {
        Ok(receipt) => json_ok(&receipt),
        Err(error) => json_error("p2p_import_assembly_failed", &error.to_string()),
    }
}

/// Inspects a local P2P import receipt against an output `.slm` and returns a JSON envelope.
///
/// # Safety
///
/// `receipt_json` and `output_path` must be valid, null-terminated UTF-8 C
/// strings for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_inspect_local_import_receipt_json(
    receipt_json: *const c_char,
    output_path: *const c_char,
) -> *mut c_char {
    let receipt_json = match c_string(receipt_json, "receipt_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let output_path = match c_string(output_path, "output_path") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match inspect_local_import_receipt_text(&receipt_json, output_path) {
        Ok(inspection) => json_ok(&inspection),
        Err(error) => json_error("p2p_receipt_invalid", &error.to_string()),
    }
}

/// Exports share metadata from manifest JSON and returns a JSON envelope.
///
/// # Safety
///
/// `manifest_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_export_share_metadata_json(
    manifest_json: *const c_char,
) -> *mut c_char {
    let manifest_json = match c_string(manifest_json, "manifest_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match export_share_metadata_text(&manifest_json) {
        Ok(metadata) => json_ok(&metadata),
        Err(error) => json_error("p2p_share_metadata_failed", &error.to_string()),
    }
}

/// Validates announcement JSON and returns a JSON envelope.
///
/// # Safety
///
/// `announcement_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_validate_announcement_json(
    announcement_json: *const c_char,
) -> *mut c_char {
    let announcement_json = match c_string(announcement_json, "announcement_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match validate_announcement_text(&announcement_json) {
        Ok(announcement) => json_ok(&announcement),
        Err(error) => json_error("p2p_announcement_invalid", &error.to_string()),
    }
}

/// Applies a received announcement to a local catalog and returns a JSON envelope.
///
/// # Safety
///
/// `announcement_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call. `existing_catalog_json` may be null; when non-null, it
/// must also be a valid, null-terminated UTF-8 C string.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_apply_received_announcement_json(
    announcement_json: *const c_char,
    existing_catalog_json: *const c_char,
) -> *mut c_char {
    let announcement_json = match c_string(announcement_json, "announcement_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let existing_catalog_json =
        match optional_c_string(existing_catalog_json, "existing_catalog_json") {
            Ok(value) => value,
            Err(error) => return json_error("invalid_argument", &error),
        };
    match apply_received_announcement_text(&announcement_json, existing_catalog_json.as_deref()) {
        Ok(catalog) => json_ok(&catalog),
        Err(error) => json_error("p2p_apply_announcement_failed", &error.to_string()),
    }
}

/// Inspects announcement catalog JSON and returns a JSON envelope.
///
/// # Safety
///
/// `catalog_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_p2p_inspect_announcement_catalog_json(
    catalog_json: *const c_char,
) -> *mut c_char {
    let catalog_json = match c_string(catalog_json, "catalog_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match inspect_announcement_catalog_text(&catalog_json) {
        Ok(inspection) => json_ok(&inspection),
        Err(error) => json_error("p2p_catalog_invalid", &error.to_string()),
    }
}

/// Builds a UAIX memory required-file plan and returns a JSON envelope.
///
/// # Safety
///
/// `request_json` may be null. When non-null, it must be a valid,
/// null-terminated UTF-8 C string for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_memory_required_files_json(
    request_json: *const c_char,
) -> *mut c_char {
    let request_json = match optional_c_string(request_json, "request_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match memory_required_files_text(request_json.as_deref()) {
        Ok(plan) => json_ok(&plan),
        Err(error) => json_error("memory_plan_failed", &error.to_string()),
    }
}

/// Returns the supported UAIX memory setup catalog as a JSON envelope.
#[no_mangle]
pub extern "C" fn tinyrustlm_memory_supported_setups_json() -> *mut c_char {
    json_ok(&supported_memory_setups())
}

/// Inspects a UAIX memory package directory, `.zip`, or `.uaix` archive and returns a JSON envelope.
///
/// # Safety
///
/// `package_path` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call. `request_json` may be null; when non-null, it must
/// also be a valid, null-terminated UTF-8 C string.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_memory_inspect_package_path_json(
    package_path: *const c_char,
    request_json: *const c_char,
) -> *mut c_char {
    let package_path = match c_string(package_path, "package_path") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    let request_json = match optional_c_string(request_json, "request_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match inspect_memory_package_path_text(PathBuf::from(package_path), request_json.as_deref()) {
        Ok(inspection) => json_ok(&inspection),
        Err(error) => json_error("memory_package_invalid", &error.to_string()),
    }
}

/// Inspects a UAIX memory manifest JSON document and returns a JSON envelope.
///
/// # Safety
///
/// `manifest_json` must be a valid, null-terminated UTF-8 C string for the
/// duration of the call.
#[no_mangle]
pub unsafe extern "C" fn tinyrustlm_memory_inspect_manifest_json(
    manifest_json: *const c_char,
) -> *mut c_char {
    let manifest_json = match c_string(manifest_json, "manifest_json") {
        Ok(value) => value,
        Err(error) => return json_error("invalid_argument", &error),
    };
    match inspect_memory_manifest_text(&manifest_json) {
        Ok(inspection) => json_ok(&inspection),
        Err(error) => json_error("memory_manifest_invalid", &error.to_string()),
    }
}

#[derive(Serialize)]
struct VersionReport<'a> {
    sdk_version: &'a str,
    native_abi_version: u32,
    product: &'a str,
}

#[derive(Serialize)]
struct RuntimeHandle {
    handle: u64,
}

#[derive(Serialize)]
struct StatusReport {
    status: &'static str,
}

#[derive(Serialize)]
struct DiagnosticsReport {
    diagnostics: String,
}

#[derive(Serialize)]
struct Envelope<T: Serialize> {
    ok: bool,
    value: Option<T>,
    error: Option<ErrorEnvelope>,
}

#[derive(Serialize)]
struct ErrorEnvelope {
    code: String,
    message: String,
}

fn with_runtime_mut<T, E, F>(handle: u64, operation: F) -> *mut c_char
where
    T: Serialize,
    E: ToString,
    F: FnOnce(&mut PublicRuntime) -> Result<T, E>,
{
    let mut guard = match RUNTIMES.lock() {
        Ok(guard) => guard,
        Err(_) => {
            return json_error(
                "runtime_registry_unavailable",
                "runtime registry lock failed",
            )
        }
    };
    let Some(runtime) = guard.get_mut(&handle) else {
        return json_error("runtime_not_found", "runtime handle was not found");
    };
    match operation(runtime) {
        Ok(value) => json_ok(&value),
        Err(error) => json_error("runtime_operation_failed", &error.to_string()),
    }
}

fn with_runtime_ref<T, F>(handle: u64, operation: F) -> *mut c_char
where
    T: Serialize,
    F: FnOnce(&PublicRuntime) -> T,
{
    let guard = match RUNTIMES.lock() {
        Ok(guard) => guard,
        Err(_) => {
            return json_error(
                "runtime_registry_unavailable",
                "runtime registry lock failed",
            )
        }
    };
    let Some(runtime) = guard.get(&handle) else {
        return json_error("runtime_not_found", "runtime handle was not found");
    };
    json_ok(&operation(runtime))
}

fn json_ok<T: Serialize>(value: &T) -> *mut c_char {
    let envelope = Envelope {
        ok: true,
        value: Some(value),
        error: None,
    };
    json_to_c_string(&envelope)
}

fn json_error(code: &str, message: &str) -> *mut c_char {
    let envelope: Envelope<()> = Envelope {
        ok: false,
        value: None,
        error: Some(ErrorEnvelope {
            code: code.to_string(),
            message: message.to_string(),
        }),
    };
    json_to_c_string(&envelope)
}

fn json_to_c_string<T: Serialize>(value: &T) -> *mut c_char {
    let text = serde_json::to_string(value).unwrap_or_else(|error| {
        format!(
            "{{\"ok\":false,\"value\":null,\"error\":{{\"code\":\"serialization_failed\",\"message\":\"{}\"}}}}",
            escape_json_for_fallback(&error.to_string())
        )
    });
    CString::new(text)
        .unwrap_or_else(|_| CString::new("{\"ok\":false,\"value\":null,\"error\":{\"code\":\"nul_byte\",\"message\":\"native response contained an interior NUL\"}}").expect("static CString"))
        .into_raw()
}

unsafe fn c_string(ptr: *const c_char, label: &str) -> Result<String, String> {
    if ptr.is_null() {
        return Err(format!("{label} pointer was null"));
    }
    CStr::from_ptr(ptr)
        .to_str()
        .map(str::to_string)
        .map_err(|_| format!("{label} was not valid UTF-8"))
}

unsafe fn optional_c_string(ptr: *const c_char, label: &str) -> Result<Option<String>, String> {
    if ptr.is_null() {
        return Ok(None);
    }
    let value = c_string(ptr, label)?;
    if value.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(value))
    }
}

fn escape_json_for_fallback(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;

    #[test]
    fn version_and_capabilities_are_json_envelopes() {
        let ptr = tinyrustlm_sdk_version_json();
        let text = unsafe { c_string(ptr, "version").expect("version") };
        unsafe {
            tinyrustlm_string_free(ptr);
        }
        assert!(text.contains("\"ok\":true"));
        let capabilities = runtime_capabilities();
        assert!(capabilities
            .excluded_private_capabilities
            .iter()
            .any(|item| item.contains("model conversion")));
    }

    #[test]
    fn creates_and_destroys_runtime_handle() {
        let ptr = tinyrustlm_runtime_create_json();
        let text = unsafe { c_string(ptr, "create").expect("create") };
        unsafe {
            tinyrustlm_string_free(ptr);
        }
        assert!(text.contains("\"handle\""));
    }

    #[test]
    fn native_generate_rejects_invalid_generation_options_before_runtime_operation() {
        let prompt = CString::new("hello").expect("prompt");
        let ptr =
            unsafe { tinyrustlm_runtime_generate_json(0, prompt.as_ptr(), 0, 0.7, 40, 0.9, 1) };
        let text = unsafe { c_string(ptr, "generate").expect("generate") };
        unsafe {
            tinyrustlm_string_free(ptr);
        }
        assert!(text.contains("\"ok\":false"), "{text}");
        assert!(text.contains("\"invalid_generation_options\""), "{text}");
        assert!(text.contains("max_new_tokens"), "{text}");
        assert!(!text.contains("runtime_not_found"), "{text}");
    }
}
