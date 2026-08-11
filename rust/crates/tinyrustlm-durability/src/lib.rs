#![forbid(unsafe_code)]
#![doc = "Strict cross-platform durability primitives for TinyRustLM publication."]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::error::Error;
use std::fmt;
use std::fs::{self, File, Metadata, OpenOptions};
use std::io;
use std::path::{Component, Path, PathBuf};

/// The sole current successful directory-flush observation schema.
pub const DIRECTORY_FLUSH_OBSERVATION_SCHEMA: &str =
    "tinyrustlm.vnext.directory_flush_observation.v1";
/// The sole current directory-flush failure schema.
pub const DIRECTORY_FLUSH_FAILURE_SCHEMA: &str = "tinyrustlm.vnext.directory_flush_failure.v1";
/// The sole current directory-flush request schema.
pub const DIRECTORY_FLUSH_REQUEST_SCHEMA: &str = "tinyrustlm.vnext.directory_flush_request.v1";
/// The maximum accepted request wire size.
pub const DIRECTORY_FLUSH_REQUEST_MAXIMUM_BYTES: usize = 16_384;
/// The sole current directory-flush profile identity.
pub const DIRECTORY_FLUSH_PROFILE_ID: &str = "tinyrustlm.vnext.directory-flush.v1";
/// The SHA-256 of the sole current directory-flush profile bytes.
pub const DIRECTORY_FLUSH_PROFILE_SHA256: &str =
    "51effab85d325493e77ca57de5aa14bf7d3fa2fd3b5f16139baadc8979d395bb";
const DIRECTORY_IDENTITY_DOMAIN: &str = "tinyrustlm.directory-flush.scope.v1";
const DIRECTORY_FLUSH_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/directory-flush-profile.v1.json");
const MAXIMUM_OPERATION_ID_BYTES: usize = 160;
const MAXIMUM_PATH_BYTES: usize = 16_384;
const MAXIMUM_RELATIVE_COMPONENTS: usize = 64;
const MAXIMUM_COMPONENT_BYTES: usize = 255;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct DirectoryFlushRequest {
    operation_id: String,
    owned_root: String,
    relative_directory: String,
    schema: String,
}

#[cfg(windows)]
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;
#[cfg(windows)]
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
#[cfg(windows)]
const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
#[cfg(windows)]
const FILE_SHARE_READ: u32 = 0x0000_0001;
#[cfg(windows)]
const FILE_SHARE_WRITE: u32 = 0x0000_0002;
#[cfg(windows)]
const FILE_SHARE_DELETE: u32 = 0x0000_0004;
#[cfg(windows)]
const GENERIC_WRITE: u32 = 0x4000_0000;

/// A bounded public-safe durability failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DurabilityError {
    code: &'static str,
}

impl DurabilityError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for DurabilityError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for DurabilityError {}

/// Public-safe evidence that one exact owned directory handle was flushed.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryFlushObservation {
    architecture: String,
    directory_identity_sha256: String,
    method: String,
    operating_system: String,
    operation_id: String,
    profile_id: String,
    profile_sha256: String,
    schema: String,
    status: String,
}

impl DirectoryFlushObservation {
    /// Returns the observation schema.
    pub fn schema(&self) -> &str {
        &self.schema
    }

    /// Returns the caller-bound operation identifier.
    pub fn operation_id(&self) -> &str {
        &self.operation_id
    }

    /// Returns the frozen helper profile identity.
    pub fn profile_id(&self) -> &str {
        &self.profile_id
    }

    /// Returns the SHA-256 of the frozen helper profile bytes.
    pub fn profile_sha256(&self) -> &str {
        &self.profile_sha256
    }

    /// Returns the path-redacted identity of the exact directory scope.
    pub fn directory_identity_sha256(&self) -> &str {
        &self.directory_identity_sha256
    }

    /// Returns the platform-specific flush method.
    pub fn method(&self) -> &str {
        &self.method
    }

    /// Returns the operating-system identity compiled into the helper.
    pub fn operating_system(&self) -> &str {
        &self.operating_system
    }

    /// Returns the architecture identity compiled into the helper.
    pub fn architecture(&self) -> &str {
        &self.architecture
    }

    /// Returns `performed` only after the platform flush call succeeds.
    pub fn status(&self) -> &str {
        &self.status
    }
}

/// Flushes one bounded directory beneath an owned absolute root.
///
/// A successful observation means only that the documented platform operation
/// returned success for the opened directory handle. It is not by itself a
/// physical power-loss or storage-device persistence claim.
pub fn flush_owned_directory(
    owned_root: &Path,
    relative_directory: &Path,
    operation_id: &str,
) -> Result<DirectoryFlushObservation, DurabilityError> {
    validate_profile()?;
    validate_operation_id(operation_id)?;
    let root = validate_root(owned_root)?;
    let relative = validate_relative_directory(relative_directory)?;
    let directory = validate_directory_scope(&root, &relative)?;
    let before = fs::symlink_metadata(&directory)
        .map_err(|error| path_io_error(error, "directory_path_missing"))?;
    validate_directory_metadata(&before)?;
    let handle = open_directory(&directory).map_err(open_error)?;
    let opened = handle
        .metadata()
        .map_err(|_| DurabilityError::new("directory_metadata_failed"))?;
    validate_directory_metadata(&opened)?;
    handle.sync_all().map_err(flush_error)?;
    let after = fs::symlink_metadata(&directory)
        .map_err(|_| DurabilityError::new("directory_path_changed"))?;
    validate_directory_metadata(&after)?;

    Ok(DirectoryFlushObservation {
        architecture: std::env::consts::ARCH.to_owned(),
        directory_identity_sha256: directory_identity(&root, &relative)?,
        method: flush_method().to_owned(),
        operating_system: std::env::consts::OS.to_owned(),
        operation_id: operation_id.to_owned(),
        profile_id: DIRECTORY_FLUSH_PROFILE_ID.to_owned(),
        profile_sha256: DIRECTORY_FLUSH_PROFILE_SHA256.to_owned(),
        schema: DIRECTORY_FLUSH_OBSERVATION_SCHEMA.to_owned(),
        status: "performed".to_owned(),
    })
}

fn validate_profile() -> Result<(), DurabilityError> {
    let actual = Sha256::digest(DIRECTORY_FLUSH_PROFILE_BYTES);
    if lowercase_hex(&actual) != DIRECTORY_FLUSH_PROFILE_SHA256 {
        return Err(DurabilityError::new("directory_profile_invalid"));
    }
    Ok(())
}

/// Executes one strict directory-flush request and returns a bounded,
/// path-redacted JSON observation.
pub fn execute_directory_flush_request_bytes(input: &[u8]) -> Result<Vec<u8>, DurabilityError> {
    if input.is_empty() || input.len() > DIRECTORY_FLUSH_REQUEST_MAXIMUM_BYTES {
        return Err(DurabilityError::new("directory_request_byte_limit"));
    }
    let request: DirectoryFlushRequest = serde_json::from_slice(input)
        .map_err(|_| DurabilityError::new("directory_request_invalid"))?;
    if request.schema != DIRECTORY_FLUSH_REQUEST_SCHEMA {
        return Err(DurabilityError::new("directory_request_schema_invalid"));
    }
    let observation = flush_owned_directory(
        Path::new(&request.owned_root),
        Path::new(&request.relative_directory),
        &request.operation_id,
    )?;
    let bytes = serde_json::to_vec(&observation)
        .map_err(|_| DurabilityError::new("directory_observation_serialize_failed"))?;
    if bytes.len() > DIRECTORY_FLUSH_REQUEST_MAXIMUM_BYTES {
        return Err(DurabilityError::new("directory_observation_byte_limit"));
    }
    Ok(bytes)
}

fn validate_operation_id(operation_id: &str) -> Result<(), DurabilityError> {
    let bytes = operation_id.as_bytes();
    if !(3..=MAXIMUM_OPERATION_ID_BYTES).contains(&bytes.len())
        || !(bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit())
        || !bytes.iter().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"._:-".contains(byte)
        })
    {
        return Err(DurabilityError::new("directory_operation_id_invalid"));
    }
    Ok(())
}

fn validate_root(owned_root: &Path) -> Result<PathBuf, DurabilityError> {
    if !owned_root.is_absolute() || path_byte_length(owned_root)? > MAXIMUM_PATH_BYTES {
        return Err(DurabilityError::new("directory_root_not_absolute"));
    }
    reject_link_components(owned_root, true)?;
    let metadata = fs::symlink_metadata(owned_root)
        .map_err(|error| path_io_error(error, "directory_root_missing"))?;
    if !metadata.is_dir() {
        return Err(DurabilityError::new("directory_root_not_directory"));
    }
    if metadata_is_link(&metadata) {
        return Err(DurabilityError::new("directory_root_link"));
    }
    fs::canonicalize(owned_root)
        .map_err(|_| DurabilityError::new("directory_root_canonicalize_failed"))
}

fn validate_relative_directory(relative: &Path) -> Result<PathBuf, DurabilityError> {
    if relative.as_os_str().is_empty()
        || relative.is_absolute()
        || path_byte_length(relative)? > MAXIMUM_PATH_BYTES
    {
        return Err(DurabilityError::new("directory_relative_path_invalid"));
    }
    let mut normalized = PathBuf::new();
    let mut component_count = 0usize;
    for component in relative.components() {
        let Component::Normal(segment) = component else {
            return Err(DurabilityError::new("directory_relative_path_invalid"));
        };
        let segment = segment
            .to_str()
            .ok_or_else(|| DurabilityError::new("directory_path_encoding_invalid"))?;
        if segment.is_empty() || segment.len() > MAXIMUM_COMPONENT_BYTES {
            return Err(DurabilityError::new("directory_relative_path_invalid"));
        }
        component_count += 1;
        if component_count > MAXIMUM_RELATIVE_COMPONENTS {
            return Err(DurabilityError::new("directory_relative_path_invalid"));
        }
        normalized.push(segment);
    }
    if component_count == 0 {
        return Err(DurabilityError::new("directory_relative_path_invalid"));
    }
    Ok(normalized)
}

fn validate_directory_scope(root: &Path, relative: &Path) -> Result<PathBuf, DurabilityError> {
    let directory = root.join(relative);
    if !directory.starts_with(root) {
        return Err(DurabilityError::new("directory_path_escape"));
    }
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(segment) = component else {
            return Err(DurabilityError::new("directory_relative_path_invalid"));
        };
        current.push(segment);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| path_io_error(error, "directory_path_missing"))?;
        if metadata_is_link(&metadata) {
            return Err(DurabilityError::new("directory_path_link"));
        }
        if !metadata.is_dir() {
            return Err(DurabilityError::new("directory_path_not_directory"));
        }
    }
    let canonical = fs::canonicalize(&directory)
        .map_err(|_| DurabilityError::new("directory_path_canonicalize_failed"))?;
    if !canonical.starts_with(root) {
        return Err(DurabilityError::new("directory_path_escape"));
    }
    Ok(canonical)
}

fn reject_link_components(path: &Path, root_scope: bool) -> Result<(), DurabilityError> {
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component.as_os_str());
        if matches!(component, Component::Prefix(_) | Component::RootDir) {
            continue;
        }
        if !matches!(component, Component::Normal(_)) {
            return Err(DurabilityError::new(if root_scope {
                "directory_root_not_absolute"
            } else {
                "directory_relative_path_invalid"
            }));
        }
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| path_io_error(error, "directory_root_missing"))?;
        if metadata_is_link(&metadata) {
            return Err(DurabilityError::new("directory_root_link"));
        }
        if !metadata.is_dir() {
            return Err(DurabilityError::new("directory_root_not_directory"));
        }
    }
    Ok(())
}

fn validate_directory_metadata(metadata: &Metadata) -> Result<(), DurabilityError> {
    if metadata_is_link(metadata) {
        return Err(DurabilityError::new("directory_path_link"));
    }
    if !metadata.is_dir() {
        return Err(DurabilityError::new("directory_path_not_directory"));
    }
    Ok(())
}

#[cfg(windows)]
fn metadata_is_link(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn metadata_is_link(metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(windows)]
fn open_directory(directory: &Path) -> io::Result<File> {
    use std::os::windows::fs::OpenOptionsExt;

    let mut options = OpenOptions::new();
    options
        .write(true)
        .access_mode(GENERIC_WRITE)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT);
    options.open(directory)
}

#[cfg(unix)]
fn open_directory(directory: &Path) -> io::Result<File> {
    OpenOptions::new().read(true).open(directory)
}

#[cfg(not(any(unix, windows)))]
fn open_directory(_directory: &Path) -> io::Result<File> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "directory flush is unsupported on this platform",
    ))
}

#[cfg(windows)]
const fn flush_method() -> &'static str {
    "win32-backup-semantics-flush-file-buffers"
}

#[cfg(unix)]
const fn flush_method() -> &'static str {
    "posix-directory-fsync"
}

#[cfg(not(any(unix, windows)))]
const fn flush_method() -> &'static str {
    "unsupported-platform"
}

fn directory_identity(root: &Path, relative: &Path) -> Result<String, DurabilityError> {
    let root = path_text(root)?;
    let relative = relative
        .components()
        .map(|component| component.as_os_str().to_str())
        .collect::<Option<Vec<_>>>()
        .ok_or_else(|| DurabilityError::new("directory_path_encoding_invalid"))?
        .join("/");
    let mut hasher = Sha256::new();
    hasher.update(DIRECTORY_IDENTITY_DOMAIN.as_bytes());
    hasher.update([0]);
    hasher.update(root.as_bytes());
    hasher.update([0]);
    hasher.update(relative.as_bytes());
    Ok(lowercase_hex(&hasher.finalize()))
}

fn path_byte_length(path: &Path) -> Result<usize, DurabilityError> {
    Ok(path_text(path)?.len())
}

fn path_text(path: &Path) -> Result<&str, DurabilityError> {
    path.to_str()
        .ok_or_else(|| DurabilityError::new("directory_path_encoding_invalid"))
}

fn lowercase_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

fn path_io_error(error: io::Error, missing_code: &'static str) -> DurabilityError {
    match error.kind() {
        io::ErrorKind::NotFound => DurabilityError::new(missing_code),
        io::ErrorKind::PermissionDenied => DurabilityError::new("directory_path_access_denied"),
        _ => DurabilityError::new("directory_path_inspection_failed"),
    }
}

fn open_error(error: io::Error) -> DurabilityError {
    match error.kind() {
        io::ErrorKind::NotFound => DurabilityError::new("directory_path_changed"),
        io::ErrorKind::PermissionDenied => DurabilityError::new("directory_open_denied"),
        io::ErrorKind::Unsupported => DurabilityError::new("directory_flush_unsupported"),
        _ => DurabilityError::new("directory_open_failed"),
    }
}

fn flush_error(error: io::Error) -> DurabilityError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => DurabilityError::new("directory_flush_denied"),
        io::ErrorKind::Unsupported | io::ErrorKind::InvalidInput => {
            DurabilityError::new("directory_flush_unsupported")
        }
        _ => DurabilityError::new("directory_flush_failed"),
    }
}
