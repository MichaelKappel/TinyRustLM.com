#![deny(unsafe_code)]
#![doc = "Bounded, no-follow build scratch inspection for TinyRustLM custody."]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;
use std::fs;
use std::path::{Component, Path, PathBuf};

/// The sole current scratch-inspection request schema.
pub const SCRATCH_INSPECTION_REQUEST_SCHEMA: &str =
    "tinyrustlm.build-scratch-inspection-request.v1";
/// The sole current successful scratch-inspection observation schema.
pub const SCRATCH_INSPECTION_OBSERVATION_SCHEMA: &str =
    "tinyrustlm.build-scratch-inspection-observation.v1";
/// The sole current accepted-junction observation schema.
pub const SCRATCH_INSPECTION_JUNCTION_SCHEMA: &str =
    "tinyrustlm.build-scratch-inspection-junction.v1";
/// The sole current scratch-inspection failure schema.
pub const SCRATCH_INSPECTION_FAILURE_SCHEMA: &str =
    "tinyrustlm.build-scratch-inspection-failure.v1";
/// The sole current scratch-inspection profile identity.
pub const SCRATCH_INSPECTION_PROFILE_ID: &str = "tinyrustlm.build-scratch-inspection/1";
/// The SHA-256 of the sole current scratch-inspection profile bytes.
pub const SCRATCH_INSPECTION_PROFILE_SHA256: &str =
    "08a2c5cb57cff8b260972129efcdfbcd2e598b51a5d6660f3c11c83a0be05aef";
/// Maximum accepted request bytes.
pub const SCRATCH_INSPECTION_MAXIMUM_REQUEST_BYTES: usize = 262_144;
/// Maximum emitted observation bytes.
pub const SCRATCH_INSPECTION_MAXIMUM_OBSERVATION_BYTES: usize = 1_048_576;
/// Maximum entries admitted by the protocol profile.
pub const SCRATCH_INSPECTION_MAXIMUM_ENTRIES: u64 = 131_072;
/// Maximum aggregate regular-file bytes admitted by the protocol profile.
pub const SCRATCH_INSPECTION_MAXIMUM_AGGREGATE_BYTES: u64 = 1_073_741_824;
/// Maximum junction records admitted by the protocol profile.
pub const SCRATCH_INSPECTION_MAXIMUM_JUNCTIONS: u64 = 64;
/// Maximum UTF-8 bytes in an admitted absolute or relative path.
pub const SCRATCH_INSPECTION_MAXIMUM_PATH_BYTES: u64 = 16_384;

const SCRATCH_INSPECTION_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/build-scratch-inspector-profile.v1.json");
const MAXIMUM_PATH_COMPONENTS: usize = 128;
const MAXIMUM_COMPONENT_BYTES: usize = 255;
const IDENTITY_DOMAIN: &[u8] = b"tinyrustlm.build-scratch-file-identity.v1";
const INVENTORY_DOMAIN: &[u8] = b"tinyrustlm.build-scratch-inventory.v1";
const OPERATION_ID_MAXIMUM_BYTES: usize = 160;

/// A bounded public-safe scratch-inspection failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ScratchInspectionError {
    code: &'static str,
}

impl ScratchInspectionError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for ScratchInspectionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for ScratchInspectionError {}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ScratchInspectionRequest {
    maximum_aggregate_bytes: u64,
    maximum_entry_count: u64,
    maximum_junction_count: u64,
    maximum_path_bytes: u64,
    operation_id: String,
    owned_root: String,
    profile_id: String,
    profile_sha256: String,
    required_root_entries: Vec<RequiredRootEntry>,
    schema: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RequiredRootEntry {
    kind: String,
    name: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct JunctionObservation {
    link_identity_sha256: String,
    relative_path: String,
    reparse_data_sha256: String,
    reparse_tag: String,
    schema: &'static str,
    target_identity_sha256: String,
    target_relative_path: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScratchInspectionObservation {
    aggregate_bytes: u64,
    directory_count: u64,
    entry_count: u64,
    file_count: u64,
    inventory_sha256: String,
    junction_count: u64,
    junctions: Vec<JunctionObservation>,
    operation_id: String,
    profile_id: &'static str,
    profile_sha256: &'static str,
    root_identity_sha256: String,
    schema: &'static str,
    status: &'static str,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct InventoryRecord {
    content_sha256: Option<String>,
    identity_sha256: String,
    kind: &'static str,
    relative_path: String,
    size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct InventorySnapshot {
    aggregate_bytes: u64,
    directory_count: u64,
    entry_count: u64,
    file_count: u64,
    inventory_sha256: String,
    junctions: Vec<JunctionObservation>,
    root_identity_sha256: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct DirectEntry {
    attributes: u32,
    identity_sha256: String,
    size: u64,
    volume_serial: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ObservedRootEntry {
    kind: &'static str,
    name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScratchInspectionFailure<'a> {
    error_code: &'a str,
    schema: &'static str,
    status: &'static str,
}

/// Executes one canonical bounded scratch-inspection request.
pub fn execute_scratch_inspection_request_bytes(
    input: &[u8],
) -> Result<Vec<u8>, ScratchInspectionError> {
    if input.is_empty() || input.len() > SCRATCH_INSPECTION_MAXIMUM_REQUEST_BYTES {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_request_byte_limit",
        ));
    }
    let request: ScratchInspectionRequest = serde_json::from_slice(input)
        .map_err(|_| ScratchInspectionError::new("scratch_inspection_request_invalid"))?;
    let canonical = serde_json::to_vec(&request)
        .map_err(|_| ScratchInspectionError::new("scratch_inspection_request_invalid"))?;
    if canonical != input {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_request_noncanonical",
        ));
    }
    validate_request(&request)?;
    let first = inspect_once(&request)?;
    let second = inspect_once(&request)?;
    if first != second {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_snapshot_drift",
        ));
    }
    let observation = ScratchInspectionObservation {
        aggregate_bytes: first.aggregate_bytes,
        directory_count: first.directory_count,
        entry_count: first.entry_count,
        file_count: first.file_count,
        inventory_sha256: first.inventory_sha256,
        junction_count: first.junctions.len() as u64,
        junctions: first.junctions,
        operation_id: request.operation_id,
        profile_id: SCRATCH_INSPECTION_PROFILE_ID,
        profile_sha256: SCRATCH_INSPECTION_PROFILE_SHA256,
        root_identity_sha256: first.root_identity_sha256,
        schema: SCRATCH_INSPECTION_OBSERVATION_SCHEMA,
        status: "pass",
    };
    let bytes = serde_json::to_vec(&observation)
        .map_err(|_| ScratchInspectionError::new("scratch_inspection_observation_invalid"))?;
    if bytes.len() > SCRATCH_INSPECTION_MAXIMUM_OBSERVATION_BYTES {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_observation_byte_limit",
        ));
    }
    Ok(bytes)
}

/// Returns one canonical bounded failure document.
pub fn scratch_inspection_failure_bytes(code: &str) -> Vec<u8> {
    serde_json::to_vec(&ScratchInspectionFailure {
        error_code: code,
        schema: SCRATCH_INSPECTION_FAILURE_SCHEMA,
        status: "failed",
    })
    .expect("fixed scratch-inspection failure serialization")
}

fn validate_request(request: &ScratchInspectionRequest) -> Result<(), ScratchInspectionError> {
    if request.schema != SCRATCH_INSPECTION_REQUEST_SCHEMA
        || request.profile_id != SCRATCH_INSPECTION_PROFILE_ID
        || request.profile_sha256 != SCRATCH_INSPECTION_PROFILE_SHA256
    {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_request_contract",
        ));
    }
    if !valid_operation_id(&request.operation_id) {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_operation_id_invalid",
        ));
    }
    if request.maximum_entry_count == 0
        || request.maximum_entry_count > SCRATCH_INSPECTION_MAXIMUM_ENTRIES
        || request.maximum_aggregate_bytes == 0
        || request.maximum_aggregate_bytes > SCRATCH_INSPECTION_MAXIMUM_AGGREGATE_BYTES
        || request.maximum_junction_count > SCRATCH_INSPECTION_MAXIMUM_JUNCTIONS
        || request.maximum_path_bytes == 0
        || request.maximum_path_bytes > SCRATCH_INSPECTION_MAXIMUM_PATH_BYTES
    {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_request_limit_invalid",
        ));
    }
    if request.required_root_entries.len() > 32 {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_root_layout_invalid",
        ));
    }
    let mut previous_root_name = None;
    for entry in &request.required_root_entries {
        validate_component(&entry.name)?;
        if !matches!(
            entry.kind.as_str(),
            "directory" | "junction" | "regular-file"
        ) {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_root_layout_invalid",
            ));
        }
        let key = canonical_relative_key(&entry.name);
        if previous_root_name
            .as_ref()
            .is_some_and(|previous| previous >= &key)
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_root_layout_invalid",
            ));
        }
        previous_root_name = Some(key);
    }
    let root = Path::new(&request.owned_root);
    if !root.is_absolute()
        || request.owned_root.len() > request.maximum_path_bytes as usize
        || !request.owned_root.is_ascii()
        || request.owned_root.contains('\0')
    {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_root_invalid",
        ));
    }
    if sha256_hex(SCRATCH_INSPECTION_PROFILE_BYTES) != SCRATCH_INSPECTION_PROFILE_SHA256 {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_profile_identity",
        ));
    }
    Ok(())
}

fn valid_operation_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= OPERATION_ID_MAXIMUM_BYTES
        && value.is_ascii()
        && value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_alphanumeric() || (index > 0 && matches!(byte, b'.' | b'_' | b'/' | b'-'))
        })
}

fn inspect_once(
    request: &ScratchInspectionRequest,
) -> Result<InventorySnapshot, ScratchInspectionError> {
    #[cfg(windows)]
    {
        windows::inspect_once(request)
    }
    #[cfg(not(windows))]
    {
        let _ = request;
        Err(ScratchInspectionError::new(
            "scratch_inspection_unsupported",
        ))
    }
}

fn validate_component(component: &str) -> Result<(), ScratchInspectionError> {
    if component.is_empty()
        || component == "."
        || component == ".."
        || !component.is_ascii()
        || component.len() > MAXIMUM_COMPONENT_BYTES
        || component.ends_with([' ', '.'])
        || component.bytes().any(|byte| {
            byte < 0x20
                || matches!(
                    byte,
                    b'<' | b'>' | b':' | b'"' | b'/' | b'\\' | b'|' | b'?' | b'*'
                )
        })
    {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_path_component_invalid",
        ));
    }
    Ok(())
}

fn relative_text(path: &Path, maximum_bytes: u64) -> Result<String, ScratchInspectionError> {
    let mut components = Vec::new();
    for component in path.components() {
        let Component::Normal(value) = component else {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_relative_path_invalid",
            ));
        };
        let value = value.to_str().ok_or_else(|| {
            ScratchInspectionError::new("scratch_inspection_path_encoding_invalid")
        })?;
        validate_component(value)?;
        components.push(value);
    }
    if components.is_empty() || components.len() > MAXIMUM_PATH_COMPONENTS {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_relative_path_invalid",
        ));
    }
    let text = components.join("/");
    if text.len() > maximum_bytes as usize {
        return Err(ScratchInspectionError::new(
            "scratch_inspection_path_byte_limit",
        ));
    }
    Ok(text)
}

fn canonical_relative_key(value: &str) -> String {
    value.to_ascii_lowercase()
}

fn is_component_prefix(left: &str, right: &str) -> bool {
    let left = canonical_relative_key(left);
    let right = canonical_relative_key(right);
    right == left
        || right
            .strip_prefix(&left)
            .is_some_and(|rest| rest.starts_with('/'))
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn identity_sha256(volume_serial: u32, file_index: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(IDENTITY_DOMAIN);
    hasher.update([0]);
    hasher.update(volume_serial.to_le_bytes());
    hasher.update(file_index.to_le_bytes());
    format!("{:x}", hasher.finalize())
}

fn inventory_sha256(records: &[InventoryRecord]) -> Result<String, ScratchInspectionError> {
    let bytes = serde_json::to_vec(records)
        .map_err(|_| ScratchInspectionError::new("scratch_inspection_inventory_invalid"))?;
    let mut hasher = Sha256::new();
    hasher.update(INVENTORY_DOMAIN);
    hasher.update([0]);
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(windows)]
#[allow(unsafe_code)]
mod windows {
    use super::*;
    use std::fs::File;
    use std::io::Read;
    use std::mem::{self, MaybeUninit};
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::{FromRawHandle, RawHandle};
    use windows_sys::Win32::Foundation::{CloseHandle, GENERIC_READ, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
        FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ,
        FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::Ioctl::FSCTL_GET_REPARSE_POINT;
    use windows_sys::Win32::System::SystemServices::IO_REPARSE_TAG_MOUNT_POINT;
    use windows_sys::Win32::System::IO::DeviceIoControl;

    const MAXIMUM_REPARSE_BYTES: usize = 16_384;

    struct OwnedNativeHandle(HANDLE);

    impl OwnedNativeHandle {
        fn open(path: &Path, desired_access: u32) -> Result<Self, ScratchInspectionError> {
            let wide = wide_path(path)?;
            let handle = unsafe {
                CreateFileW(
                    wide.as_ptr(),
                    desired_access,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                    std::ptr::null(),
                    OPEN_EXISTING,
                    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                    std::ptr::null_mut(),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_path_open_failed",
                ));
            }
            Ok(Self(handle))
        }

        fn into_file(self) -> File {
            let raw = self.0;
            mem::forget(self);
            unsafe { File::from_raw_handle(raw as RawHandle) }
        }
    }

    impl Drop for OwnedNativeHandle {
        fn drop(&mut self) {
            if self.0 != INVALID_HANDLE_VALUE {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    pub(super) fn inspect_once(
        request: &ScratchInspectionRequest,
    ) -> Result<InventorySnapshot, ScratchInspectionError> {
        let requested_root = normalize_windows_path_text(&request.owned_root)?;
        let canonical_root_path = fs::canonicalize(Path::new(&request.owned_root))
            .map_err(|_| ScratchInspectionError::new("scratch_inspection_root_missing"))?;
        let canonical_root =
            normalize_windows_path_text(canonical_root_path.to_str().ok_or_else(|| {
                ScratchInspectionError::new("scratch_inspection_path_encoding_invalid")
            })?)?;
        if !requested_root.eq_ignore_ascii_case(&canonical_root) {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_root_noncanonical",
            ));
        }
        let root_path = PathBuf::from(&canonical_root);
        validate_absolute_directory_components(&root_path)?;
        let root_handle = OwnedNativeHandle::open(&root_path, FILE_READ_ATTRIBUTES)?;
        let root = handle_information(root_handle.0)?;
        if root.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
            || root.attributes & FILE_ATTRIBUTE_DIRECTORY == 0
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_root_not_direct_directory",
            ));
        }

        let mut pending = vec![(root_path.clone(), PathBuf::new())];
        let mut paths = BTreeSet::new();
        let mut direct_directories = BTreeMap::new();
        let mut records = Vec::new();
        let mut observed_root_entries = Vec::new();
        let mut junctions = Vec::new();
        let mut aggregate_bytes = 0_u64;
        let mut directory_count = 0_u64;
        let mut entry_count = 0_u64;
        let mut file_count = 0_u64;

        while let Some((directory_path, relative_directory)) = pending.pop() {
            let directory_handle = OwnedNativeHandle::open(&directory_path, FILE_READ_ATTRIBUTES)?;
            let directory_before = handle_information(directory_handle.0)?;
            if directory_before.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
                || directory_before.attributes & FILE_ATTRIBUTE_DIRECTORY == 0
            {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_directory_drift",
                ));
            }
            let mut entries = fs::read_dir(&directory_path)
                .map_err(|_| ScratchInspectionError::new("scratch_inspection_read_directory"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|_| ScratchInspectionError::new("scratch_inspection_read_directory"))?;
            entries.sort_by(|left, right| {
                let left = left.file_name().to_string_lossy().into_owned();
                let right = right.file_name().to_string_lossy().into_owned();
                canonical_relative_key(&left)
                    .cmp(&canonical_relative_key(&right))
                    .then_with(|| left.cmp(&right))
            });
            let mut prior_name = None;
            for entry in entries {
                let name = entry.file_name().into_string().map_err(|_| {
                    ScratchInspectionError::new("scratch_inspection_path_encoding_invalid")
                })?;
                validate_component(&name)?;
                let folded_name = canonical_relative_key(&name);
                if prior_name.as_ref() == Some(&folded_name) {
                    return Err(ScratchInspectionError::new(
                        "scratch_inspection_case_collision",
                    ));
                }
                prior_name = Some(folded_name);
                let relative = relative_directory.join(&name);
                let is_root_entry = relative_directory.as_os_str().is_empty();
                let relative_text = relative_text(&relative, request.maximum_path_bytes)?;
                let relative_key = canonical_relative_key(&relative_text);
                if !paths.insert(relative_key.clone()) {
                    return Err(ScratchInspectionError::new(
                        "scratch_inspection_case_collision",
                    ));
                }
                entry_count = entry_count
                    .checked_add(1)
                    .ok_or_else(|| ScratchInspectionError::new("scratch_inspection_entry_limit"))?;
                if entry_count > request.maximum_entry_count {
                    return Err(ScratchInspectionError::new(
                        "scratch_inspection_entry_limit",
                    ));
                }
                let entry_path = directory_path.join(&name);
                let info = direct_entry(&entry_path)?;
                if info.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                    if junctions.len() as u64 >= request.maximum_junction_count {
                        return Err(ScratchInspectionError::new(
                            "scratch_inspection_junction_limit",
                        ));
                    }
                    let observation = inspect_junction(
                        &root_path,
                        &canonical_root,
                        root.volume_serial,
                        &entry_path,
                        &relative_text,
                        &info,
                        request.maximum_path_bytes,
                    )?;
                    records.push(InventoryRecord {
                        content_sha256: Some(observation.reparse_data_sha256.clone()),
                        identity_sha256: observation.link_identity_sha256.clone(),
                        kind: "junction",
                        relative_path: relative_text,
                        size: 0,
                    });
                    junctions.push(observation);
                    if is_root_entry {
                        observed_root_entries.push(ObservedRootEntry {
                            kind: "junction",
                            name,
                        });
                    }
                    continue;
                }
                if info.attributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
                    directory_count = directory_count.checked_add(1).ok_or_else(|| {
                        ScratchInspectionError::new("scratch_inspection_entry_limit")
                    })?;
                    direct_directories.insert(relative_key, info.identity_sha256.clone());
                    records.push(InventoryRecord {
                        content_sha256: None,
                        identity_sha256: info.identity_sha256,
                        kind: "directory",
                        relative_path: relative_text,
                        size: 0,
                    });
                    pending.push((entry_path, relative));
                    if is_root_entry {
                        observed_root_entries.push(ObservedRootEntry {
                            kind: "directory",
                            name,
                        });
                    }
                    continue;
                }
                file_count = file_count
                    .checked_add(1)
                    .ok_or_else(|| ScratchInspectionError::new("scratch_inspection_entry_limit"))?;
                aggregate_bytes = aggregate_bytes.checked_add(info.size).ok_or_else(|| {
                    ScratchInspectionError::new("scratch_inspection_aggregate_byte_limit")
                })?;
                if aggregate_bytes > request.maximum_aggregate_bytes {
                    return Err(ScratchInspectionError::new(
                        "scratch_inspection_aggregate_byte_limit",
                    ));
                }
                let content_sha256 = hash_direct_file(&entry_path, &info)?;
                records.push(InventoryRecord {
                    content_sha256: Some(content_sha256),
                    identity_sha256: info.identity_sha256,
                    kind: "regular-file",
                    relative_path: relative_text,
                    size: info.size,
                });
                if is_root_entry {
                    observed_root_entries.push(ObservedRootEntry {
                        kind: "regular-file",
                        name,
                    });
                }
            }
            let directory_after = direct_entry(&directory_path)?;
            if directory_after != directory_before
                || handle_information(directory_handle.0)? != directory_before
            {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_directory_drift",
                ));
            }
        }

        if handle_information(root_handle.0)? != root || direct_entry(&root_path)? != root {
            return Err(ScratchInspectionError::new("scratch_inspection_root_drift"));
        }

        validate_root_layout(&request.required_root_entries, &observed_root_entries)?;

        junctions.sort_by(|left, right| {
            canonical_relative_key(&left.relative_path)
                .cmp(&canonical_relative_key(&right.relative_path))
        });
        validate_junction_targets(&junctions, &direct_directories)?;
        records.sort_by(|left, right| {
            canonical_relative_key(&left.relative_path)
                .cmp(&canonical_relative_key(&right.relative_path))
        });
        Ok(InventorySnapshot {
            aggregate_bytes,
            directory_count,
            entry_count,
            file_count,
            inventory_sha256: inventory_sha256(&records)?,
            junctions,
            root_identity_sha256: root.identity_sha256,
        })
    }

    fn validate_root_layout(
        required: &[RequiredRootEntry],
        observed: &[ObservedRootEntry],
    ) -> Result<(), ScratchInspectionError> {
        if required.len() != observed.len()
            || required.iter().zip(observed).any(|(required, observed)| {
                !required.name.eq_ignore_ascii_case(&observed.name)
                    || required.name != observed.name
                    || required.kind != observed.kind
            })
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_root_layout_mismatch",
            ));
        }
        Ok(())
    }

    fn inspect_junction(
        root_path: &Path,
        canonical_root: &str,
        root_volume_serial: u32,
        link_path: &Path,
        link_relative: &str,
        initial: &DirectEntry,
        maximum_path_bytes: u64,
    ) -> Result<JunctionObservation, ScratchInspectionError> {
        if initial.attributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_not_directory",
            ));
        }
        let handle = OwnedNativeHandle::open(link_path, FILE_READ_ATTRIBUTES)?;
        let link = handle_information(handle.0)?;
        if &link != initial {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_entry_drift",
            ));
        }
        let reparse_data = reparse_data(handle.0)?;
        let (tag, substitute_name) = parse_mount_point_reparse_data(&reparse_data)?;
        if tag != IO_REPARSE_TAG_MOUNT_POINT {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_tag_rejected",
            ));
        }
        let target_text = normalize_substitute_name(&substitute_name)?;
        let target_relative = strict_target_relative(canonical_root, &target_text)?;
        if is_component_prefix(&target_relative, link_relative)
            || is_component_prefix(link_relative, &target_relative)
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_cycle",
            ));
        }
        let target_path = direct_target_path(root_path, &target_relative)?;
        let canonical_target_path = fs::canonicalize(&target_path)
            .map_err(|_| ScratchInspectionError::new("scratch_inspection_junction_dangling"))?;
        let canonical_target =
            normalize_windows_path_text(canonical_target_path.to_str().ok_or_else(|| {
                ScratchInspectionError::new("scratch_inspection_path_encoding_invalid")
            })?)?;
        if !canonical_target.eq_ignore_ascii_case(&target_text) {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_target_alias",
            ));
        }
        let target = direct_entry(&target_path)?;
        if target.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_target_chain",
            ));
        }
        if target.attributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_target_not_directory",
            ));
        }
        if target.volume_serial != root_volume_serial {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_cross_volume",
            ));
        }
        if target.identity_sha256 == link.identity_sha256 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_cycle",
            ));
        }
        let target_relative = relative_text(Path::new(&target_relative), maximum_path_bytes)?;
        Ok(JunctionObservation {
            link_identity_sha256: link.identity_sha256,
            relative_path: link_relative.to_owned(),
            reparse_data_sha256: sha256_hex(&reparse_data),
            reparse_tag: format!("0x{tag:08x}"),
            schema: SCRATCH_INSPECTION_JUNCTION_SCHEMA,
            target_identity_sha256: target.identity_sha256,
            target_relative_path: target_relative,
        })
    }

    fn validate_junction_targets(
        junctions: &[JunctionObservation],
        direct_directories: &BTreeMap<String, String>,
    ) -> Result<(), ScratchInspectionError> {
        let mut target_paths = BTreeSet::new();
        let mut target_identities = BTreeSet::new();
        for junction in junctions {
            let target_key = canonical_relative_key(&junction.target_relative_path);
            let direct_identity = direct_directories.get(&target_key).ok_or_else(|| {
                ScratchInspectionError::new("scratch_inspection_junction_target_uninventoried")
            })?;
            if direct_identity != &junction.target_identity_sha256 {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_junction_target_drift",
                ));
            }
            if !target_paths.insert(target_key) {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_junction_duplicate_target",
                ));
            }
            if !target_identities.insert(junction.target_identity_sha256.clone()) {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_junction_duplicate_identity",
                ));
            }
        }
        Ok(())
    }

    fn validate_absolute_directory_components(path: &Path) -> Result<(), ScratchInspectionError> {
        let mut components = path.components();
        let prefix = components.next();
        let root = components.next();
        if !matches!(prefix, Some(Component::Prefix(_)))
            || !matches!(root, Some(Component::RootDir))
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_root_invalid",
            ));
        }
        let mut current = PathBuf::from(
            path.components()
                .next()
                .expect("validated prefix")
                .as_os_str(),
        );
        current.push("\\");
        for component in components {
            let Component::Normal(value) = component else {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_root_invalid",
                ));
            };
            let text = value.to_str().ok_or_else(|| {
                ScratchInspectionError::new("scratch_inspection_path_encoding_invalid")
            })?;
            validate_component(text)?;
            current.push(value);
            let info = direct_entry(&current)?;
            if info.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
                || info.attributes & FILE_ATTRIBUTE_DIRECTORY == 0
            {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_root_component_not_direct",
                ));
            }
        }
        Ok(())
    }

    fn direct_target_path(root: &Path, relative: &str) -> Result<PathBuf, ScratchInspectionError> {
        let mut current = root.to_path_buf();
        let components = relative.split('/').collect::<Vec<_>>();
        if components.is_empty() || components.len() > MAXIMUM_PATH_COMPONENTS {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_target_invalid",
            ));
        }
        for component in components {
            validate_component(component)?;
            current.push(component);
            let info = direct_entry(&current)
                .map_err(|_| ScratchInspectionError::new("scratch_inspection_junction_dangling"))?;
            if info.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_junction_target_chain",
                ));
            }
            if info.attributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
                return Err(ScratchInspectionError::new(
                    "scratch_inspection_junction_target_not_directory",
                ));
            }
        }
        Ok(current)
    }

    fn strict_target_relative(
        canonical_root: &str,
        target: &str,
    ) -> Result<String, ScratchInspectionError> {
        let root_key = canonical_root.to_ascii_lowercase();
        let target_key = target.to_ascii_lowercase();
        let prefix = format!("{root_key}\\");
        if !target_key.starts_with(&prefix) {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_external_target",
            ));
        }
        let relative = &target[canonical_root.len() + 1..];
        let components = relative.split('\\').collect::<Vec<_>>();
        if components.is_empty() || components.len() > MAXIMUM_PATH_COMPONENTS {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_target_invalid",
            ));
        }
        for component in &components {
            validate_component(component)?;
        }
        Ok(components.join("/"))
    }

    fn normalize_substitute_name(value: &str) -> Result<String, ScratchInspectionError> {
        let Some(value) = value.strip_prefix("\\??\\") else {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_junction_target_namespace",
            ));
        };
        normalize_windows_path_text(value)
    }

    fn normalize_windows_path_text(value: &str) -> Result<String, ScratchInspectionError> {
        let value = value.strip_prefix("\\\\?\\").unwrap_or(value);
        if !value.is_ascii()
            || value.len() < 3
            || value.as_bytes()[1] != b':'
            || value.as_bytes()[2] != b'\\'
            || !value.as_bytes()[0].is_ascii_alphabetic()
            || value.starts_with("\\\\")
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_path_namespace_invalid",
            ));
        }
        let mut components = value[3..].split('\\').collect::<Vec<_>>();
        if components.last() == Some(&"") {
            components.pop();
        }
        if components.len() > MAXIMUM_PATH_COMPONENTS
            || components.iter().any(|part| part.is_empty())
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_path_component_invalid",
            ));
        }
        for component in &components {
            validate_component(component)?;
        }
        let drive = (value.as_bytes()[0] as char).to_ascii_uppercase();
        if components.is_empty() {
            Ok(format!("{drive}:\\"))
        } else {
            Ok(format!("{drive}:\\{}", components.join("\\")))
        }
    }

    fn hash_direct_file(
        path: &Path,
        expected: &DirectEntry,
    ) -> Result<String, ScratchInspectionError> {
        let handle = OwnedNativeHandle::open(path, GENERIC_READ)?;
        let before = handle_information(handle.0)?;
        if &before != expected
            || before.attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT) != 0
        {
            return Err(ScratchInspectionError::new("scratch_inspection_file_drift"));
        }
        let mut file = handle.into_file();
        let mut hasher = Sha256::new();
        let mut buffer = vec![0_u8; 1_048_576];
        let mut total = 0_u64;
        loop {
            let read = file
                .read(&mut buffer)
                .map_err(|_| ScratchInspectionError::new("scratch_inspection_file_read"))?;
            if read == 0 {
                break;
            }
            total = total
                .checked_add(read as u64)
                .ok_or_else(|| ScratchInspectionError::new("scratch_inspection_file_drift"))?;
            if total > expected.size {
                return Err(ScratchInspectionError::new("scratch_inspection_file_drift"));
            }
            hasher.update(&buffer[..read]);
        }
        if total != expected.size {
            return Err(ScratchInspectionError::new("scratch_inspection_file_drift"));
        }
        let after = handle_information(file.as_raw_handle() as HANDLE)?;
        if &after != expected {
            return Err(ScratchInspectionError::new("scratch_inspection_file_drift"));
        }
        Ok(format!("{:x}", hasher.finalize()))
    }

    fn direct_entry(path: &Path) -> Result<DirectEntry, ScratchInspectionError> {
        let handle = OwnedNativeHandle::open(path, FILE_READ_ATTRIBUTES)?;
        handle_information(handle.0)
    }

    fn handle_information(handle: HANDLE) -> Result<DirectEntry, ScratchInspectionError> {
        let mut information = MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::zeroed();
        if unsafe { GetFileInformationByHandle(handle, information.as_mut_ptr()) } == 0 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_identity_failed",
            ));
        }
        let information = unsafe { information.assume_init() };
        let file_index =
            ((information.nFileIndexHigh as u64) << 32) | information.nFileIndexLow as u64;
        let size = ((information.nFileSizeHigh as u64) << 32) | information.nFileSizeLow as u64;
        Ok(DirectEntry {
            attributes: information.dwFileAttributes,
            identity_sha256: identity_sha256(information.dwVolumeSerialNumber, file_index),
            size,
            volume_serial: information.dwVolumeSerialNumber,
        })
    }

    fn reparse_data(handle: HANDLE) -> Result<Vec<u8>, ScratchInspectionError> {
        let mut buffer = vec![0_u8; MAXIMUM_REPARSE_BYTES];
        let mut returned = 0_u32;
        let result = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_GET_REPARSE_POINT,
                std::ptr::null(),
                0,
                buffer.as_mut_ptr().cast(),
                buffer.len() as u32,
                &mut returned,
                std::ptr::null_mut(),
            )
        };
        if result == 0 || returned < 8 || returned as usize > buffer.len() {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_read_failed",
            ));
        }
        buffer.truncate(returned as usize);
        Ok(buffer)
    }

    fn parse_mount_point_reparse_data(
        bytes: &[u8],
    ) -> Result<(u32, String), ScratchInspectionError> {
        if bytes.len() < 16 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_data_invalid",
            ));
        }
        let tag = u32::from_le_bytes(bytes[0..4].try_into().expect("four bytes"));
        if tag != IO_REPARSE_TAG_MOUNT_POINT {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_tag_rejected",
            ));
        }
        let data_length = u16::from_le_bytes(bytes[4..6].try_into().expect("two bytes")) as usize;
        if data_length < 8 || data_length + 8 != bytes.len() {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_data_invalid",
            ));
        }
        let substitute_offset =
            u16::from_le_bytes(bytes[8..10].try_into().expect("two bytes")) as usize;
        let substitute_length =
            u16::from_le_bytes(bytes[10..12].try_into().expect("two bytes")) as usize;
        let print_offset =
            u16::from_le_bytes(bytes[12..14].try_into().expect("two bytes")) as usize;
        let print_length =
            u16::from_le_bytes(bytes[14..16].try_into().expect("two bytes")) as usize;
        let path_buffer_length = data_length - 8;
        validate_utf16_range(substitute_offset, substitute_length, path_buffer_length)?;
        validate_utf16_range(print_offset, print_length, path_buffer_length)?;
        if substitute_length == 0 {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_data_invalid",
            ));
        }
        let start = 16 + substitute_offset;
        let end = start + substitute_length;
        let units = bytes[start..end]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        let substitute = String::from_utf16(&units).map_err(|_| {
            ScratchInspectionError::new("scratch_inspection_reparse_target_encoding")
        })?;
        if substitute.contains('\0') {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_target_encoding",
            ));
        }
        Ok((tag, substitute))
    }

    fn validate_utf16_range(
        offset: usize,
        length: usize,
        available: usize,
    ) -> Result<(), ScratchInspectionError> {
        if !offset.is_multiple_of(2)
            || !length.is_multiple_of(2)
            || offset > available
            || length > available.saturating_sub(offset)
        {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_reparse_data_invalid",
            ));
        }
        Ok(())
    }

    fn wide_path(path: &Path) -> Result<Vec<u16>, ScratchInspectionError> {
        let mut wide = path.as_os_str().encode_wide().collect::<Vec<_>>();
        if wide.is_empty() || wide.contains(&0) {
            return Err(ScratchInspectionError::new(
                "scratch_inspection_path_encoding_invalid",
            ));
        }
        wide.push(0);
        Ok(wide)
    }

    use std::os::windows::io::AsRawHandle;

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::time::{SystemTime, UNIX_EPOCH};
        use windows_sys::Win32::Foundation::GENERIC_WRITE;
        use windows_sys::Win32::System::Ioctl::FSCTL_SET_REPARSE_POINT;

        struct TestTree {
            base: PathBuf,
            links: Vec<PathBuf>,
            root: PathBuf,
        }

        impl TestTree {
            fn new(label: &str) -> Self {
                let unique = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("system time")
                    .as_nanos();
                let base = std::env::temp_dir().join(format!(
                    "tinyrustlm-scratch-inspection-{label}-{}-{unique}",
                    std::process::id()
                ));
                let root = base.join("owned");
                fs::create_dir_all(&root).expect("create owned test root");
                Self {
                    base,
                    links: Vec::new(),
                    root,
                }
            }

            fn junction(&mut self, relative: &str, target: &Path) {
                let link = self.root.join(relative);
                fs::create_dir(&link).expect("create empty junction directory");
                let target =
                    normalize_windows_path_text(target.to_str().expect("ASCII junction target"))
                        .expect("normalize junction target");
                let buffer = set_mount_point_buffer(&target);
                let handle =
                    OwnedNativeHandle::open(&link, GENERIC_WRITE).expect("open junction directory");
                let mut returned = 0_u32;
                let result = unsafe {
                    DeviceIoControl(
                        handle.0,
                        FSCTL_SET_REPARSE_POINT,
                        buffer.as_ptr().cast(),
                        buffer.len() as u32,
                        std::ptr::null_mut(),
                        0,
                        &mut returned,
                        std::ptr::null_mut(),
                    )
                };
                assert_ne!(result, 0, "set mount-point reparse data");
                drop(handle);
                self.links.push(link);
            }

            fn request(&self, operation_id: &str, root_entries: &[(&str, &str)]) -> Vec<u8> {
                let root = normalize_windows_path_text(
                    fs::canonicalize(&self.root)
                        .expect("canonicalize owned root")
                        .to_str()
                        .expect("ASCII owned root"),
                )
                .expect("normalize owned root");
                serde_json::to_vec(&ScratchInspectionRequest {
                    maximum_aggregate_bytes: 1_048_576,
                    maximum_entry_count: 1_024,
                    maximum_junction_count: 16,
                    maximum_path_bytes: 4_096,
                    operation_id: operation_id.to_owned(),
                    owned_root: root,
                    profile_id: SCRATCH_INSPECTION_PROFILE_ID.to_owned(),
                    profile_sha256: SCRATCH_INSPECTION_PROFILE_SHA256.to_owned(),
                    required_root_entries: root_entries
                        .iter()
                        .map(|(name, kind)| RequiredRootEntry {
                            kind: (*kind).to_owned(),
                            name: (*name).to_owned(),
                        })
                        .collect(),
                    schema: SCRATCH_INSPECTION_REQUEST_SCHEMA.to_owned(),
                })
                .expect("serialize request")
            }
        }

        impl Drop for TestTree {
            fn drop(&mut self) {
                for link in self.links.iter().rev() {
                    let _ = fs::remove_dir(link);
                }
                let _ = fs::remove_dir_all(&self.base);
            }
        }

        fn set_mount_point_buffer(target: &str) -> Vec<u8> {
            let substitute = format!("\\??\\{target}\0")
                .encode_utf16()
                .collect::<Vec<_>>();
            let print = format!("{target}\0").encode_utf16().collect::<Vec<_>>();
            let substitute_length = (substitute.len() - 1) * 2;
            let print_offset = substitute.len() * 2;
            let print_length = (print.len() - 1) * 2;
            let path_bytes = (substitute.len() + print.len()) * 2;
            let data_length = 8 + path_bytes;
            let mut bytes = Vec::with_capacity(data_length + 8);
            bytes.extend_from_slice(&IO_REPARSE_TAG_MOUNT_POINT.to_le_bytes());
            bytes.extend_from_slice(&(data_length as u16).to_le_bytes());
            bytes.extend_from_slice(&0_u16.to_le_bytes());
            bytes.extend_from_slice(&0_u16.to_le_bytes());
            bytes.extend_from_slice(&(substitute_length as u16).to_le_bytes());
            bytes.extend_from_slice(&(print_offset as u16).to_le_bytes());
            bytes.extend_from_slice(&(print_length as u16).to_le_bytes());
            for unit in substitute.into_iter().chain(print) {
                bytes.extend_from_slice(&unit.to_le_bytes());
            }
            bytes
        }

        fn mount_point_buffer(target: &str, print: &str) -> Vec<u8> {
            let target = target.encode_utf16().collect::<Vec<_>>();
            let print = print.encode_utf16().collect::<Vec<_>>();
            let target_bytes = target.len() * 2;
            let print_bytes = print.len() * 2;
            let data_length = 8 + target_bytes + print_bytes;
            let mut bytes = Vec::with_capacity(data_length + 8);
            bytes.extend_from_slice(&IO_REPARSE_TAG_MOUNT_POINT.to_le_bytes());
            bytes.extend_from_slice(&(data_length as u16).to_le_bytes());
            bytes.extend_from_slice(&0_u16.to_le_bytes());
            bytes.extend_from_slice(&0_u16.to_le_bytes());
            bytes.extend_from_slice(&(target_bytes as u16).to_le_bytes());
            bytes.extend_from_slice(&(target_bytes as u16).to_le_bytes());
            bytes.extend_from_slice(&(print_bytes as u16).to_le_bytes());
            for unit in target.into_iter().chain(print) {
                bytes.extend_from_slice(&unit.to_le_bytes());
            }
            bytes
        }

        #[test]
        fn strict_mount_point_parser_accepts_one_complete_buffer() {
            let bytes = mount_point_buffer("\\??\\E:\\owned\\target", "E:\\owned\\target");
            let (tag, target) = parse_mount_point_reparse_data(&bytes).expect("parse mount point");
            assert_eq!(tag, IO_REPARSE_TAG_MOUNT_POINT);
            assert_eq!(target, "\\??\\E:\\owned\\target");
        }

        #[test]
        fn strict_mount_point_parser_rejects_wrong_tag_and_ranges() {
            let mut wrong_tag = mount_point_buffer("\\??\\E:\\owned\\target", "");
            wrong_tag[0..4].copy_from_slice(&0xA000_000C_u32.to_le_bytes());
            assert_eq!(
                parse_mount_point_reparse_data(&wrong_tag)
                    .expect_err("symbolic link tag must fail")
                    .code(),
                "scratch_inspection_reparse_tag_rejected"
            );

            let mut odd_range = mount_point_buffer("\\??\\E:\\owned\\target", "");
            odd_range[8..10].copy_from_slice(&1_u16.to_le_bytes());
            assert_eq!(
                parse_mount_point_reparse_data(&odd_range)
                    .expect_err("odd UTF-16 offset must fail")
                    .code(),
                "scratch_inspection_reparse_data_invalid"
            );

            let mut truncated = mount_point_buffer("\\??\\E:\\owned\\target", "");
            truncated.pop();
            assert_eq!(
                parse_mount_point_reparse_data(&truncated)
                    .expect_err("truncated data must fail")
                    .code(),
                "scratch_inspection_reparse_data_invalid"
            );
        }

        #[test]
        fn target_namespace_and_containment_are_exact() {
            assert_eq!(
                normalize_substitute_name("\\??\\E:\\owned\\target").expect("normalize target"),
                "E:\\owned\\target"
            );
            assert_eq!(
                strict_target_relative("E:\\owned", "E:\\owned\\target").expect("contained target"),
                "target"
            );
            assert_eq!(
                strict_target_relative("E:\\owned", "E:\\owned-escape\\target")
                    .expect_err("prefix escape must fail")
                    .code(),
                "scratch_inspection_junction_external_target"
            );
            assert_eq!(
                normalize_substitute_name("\\??\\UNC\\host\\share")
                    .expect_err("UNC must fail")
                    .code(),
                "scratch_inspection_path_namespace_invalid"
            );
        }

        #[test]
        fn frozen_profile_and_failure_documents_are_exact() {
            assert_eq!(
                sha256_hex(SCRATCH_INSPECTION_PROFILE_BYTES),
                SCRATCH_INSPECTION_PROFILE_SHA256
            );
            assert_eq!(
                scratch_inspection_failure_bytes("scratch_inspection_test"),
                br#"{"errorCode":"scratch_inspection_test","schema":"tinyrustlm.build-scratch-inspection-failure.v1","status":"failed"}"#
            );
        }

        #[test]
        fn one_real_same_root_sibling_junction_is_observed() {
            let mut tree = TestTree::new("accepted-junction");
            let target = tree.root.join("target");
            fs::create_dir(&target).expect("create target");
            fs::write(target.join("marker.bin"), b"abc").expect("write marker");
            tree.junction("link", &target);

            let bytes = execute_scratch_inspection_request_bytes(&tree.request(
                "accepted-junction-operation",
                &[("link", "junction"), ("target", "directory")],
            ))
            .expect("inspect accepted junction");
            let value: serde_json::Value =
                serde_json::from_slice(&bytes).expect("parse observation");

            assert_eq!(value["status"], "pass");
            assert_eq!(value["entryCount"], 3);
            assert_eq!(value["directoryCount"], 1);
            assert_eq!(value["fileCount"], 1);
            assert_eq!(value["aggregateBytes"], 3);
            assert_eq!(value["junctionCount"], 1);
            assert_eq!(value["junctions"][0]["relativePath"], "link");
            assert_eq!(value["junctions"][0]["targetRelativePath"], "target");
            assert_eq!(value["junctions"][0]["reparseTag"], "0xa0000003");
            assert_eq!(
                serde_json::to_vec(&value).expect("canonical observation"),
                bytes
            );
        }

        #[test]
        fn external_junction_target_is_rejected() {
            let mut tree = TestTree::new("external-target");
            let external = tree.base.join("external");
            fs::create_dir(&external).expect("create external target");
            tree.junction("link", &external);

            assert_eq!(
                execute_scratch_inspection_request_bytes(
                    &tree.request("external-target-operation", &[("link", "junction")])
                )
                .expect_err("external target must fail")
                .code(),
                "scratch_inspection_junction_external_target"
            );
        }

        #[test]
        fn duplicate_junction_target_is_rejected() {
            let mut tree = TestTree::new("duplicate-target");
            let target = tree.root.join("target");
            fs::create_dir(&target).expect("create target");
            tree.junction("link-a", &target);
            tree.junction("link-b", &target);

            assert_eq!(
                execute_scratch_inspection_request_bytes(&tree.request(
                    "duplicate-target-operation",
                    &[
                        ("link-a", "junction"),
                        ("link-b", "junction"),
                        ("target", "directory"),
                    ],
                ))
                .expect_err("duplicate target must fail")
                .code(),
                "scratch_inspection_junction_duplicate_target"
            );
        }

        #[test]
        fn chained_junction_target_is_rejected() {
            let mut tree = TestTree::new("chained-target");
            let actual = tree.root.join("actual");
            fs::create_dir(&actual).expect("create actual target");
            tree.junction("target-link", &actual);
            let target_link = tree.root.join("target-link");
            tree.junction("link", &target_link);

            assert_eq!(
                execute_scratch_inspection_request_bytes(&tree.request(
                    "chained-target-operation",
                    &[
                        ("actual", "directory"),
                        ("link", "junction"),
                        ("target-link", "junction"),
                    ],
                ))
                .expect_err("chained target must fail")
                .code(),
                "scratch_inspection_junction_target_chain"
            );
        }

        #[test]
        fn ancestor_target_is_rejected_as_a_cycle() {
            let mut tree = TestTree::new("ancestor-target");
            let parent = tree.root.join("parent");
            fs::create_dir(&parent).expect("create parent target");
            tree.junction("parent/link", &parent);

            assert_eq!(
                execute_scratch_inspection_request_bytes(
                    &tree.request("ancestor-target-operation", &[("parent", "directory")])
                )
                .expect_err("ancestor target must fail")
                .code(),
                "scratch_inspection_junction_cycle"
            );
        }

        #[test]
        fn dangling_junction_target_is_rejected() {
            let mut tree = TestTree::new("dangling-target");
            let target = tree.root.join("target");
            fs::create_dir(&target).expect("create target");
            tree.junction("link", &target);
            fs::remove_dir(&target).expect("remove target");

            assert_eq!(
                execute_scratch_inspection_request_bytes(
                    &tree.request("dangling-target-operation", &[("link", "junction")])
                )
                .expect_err("dangling target must fail")
                .code(),
                "scratch_inspection_junction_dangling"
            );
        }

        #[test]
        fn noncanonical_unknown_and_over_limit_requests_are_rejected() {
            let tree = TestTree::new("request-rejections");
            let mut noncanonical = tree.request("noncanonical-operation", &[]);
            noncanonical.push(b'\n');
            assert_eq!(
                execute_scratch_inspection_request_bytes(&noncanonical)
                    .expect_err("noncanonical request must fail")
                    .code(),
                "scratch_inspection_request_noncanonical"
            );

            let mut unknown: serde_json::Value =
                serde_json::from_slice(&tree.request("unknown-field-operation", &[]))
                    .expect("parse request");
            unknown["unknown"] = serde_json::Value::Bool(true);
            assert_eq!(
                execute_scratch_inspection_request_bytes(
                    &serde_json::to_vec(&unknown).expect("serialize unknown request")
                )
                .expect_err("unknown request field must fail")
                .code(),
                "scratch_inspection_request_invalid"
            );

            let mut over_limit: ScratchInspectionRequest =
                serde_json::from_slice(&tree.request("over-limit-operation", &[]))
                    .expect("parse request");
            over_limit.maximum_entry_count = SCRATCH_INSPECTION_MAXIMUM_ENTRIES + 1;
            assert_eq!(
                execute_scratch_inspection_request_bytes(
                    &serde_json::to_vec(&over_limit).expect("serialize over-limit request")
                )
                .expect_err("over-limit request must fail")
                .code(),
                "scratch_inspection_request_limit_invalid"
            );
        }
    }
}
