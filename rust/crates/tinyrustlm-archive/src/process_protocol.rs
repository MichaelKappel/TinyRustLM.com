use crate::{scan_archive_bytes, ArchiveFormat, ARCHIVE_ADMISSION_PROFILE_SHA256};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::error::Error;
use std::fmt;
use std::fs::{self, File, Metadata};
use std::io::{Read, Write};
use std::path::Path;

/// The sole current archive-scan process profile identity.
pub const ARCHIVE_SCAN_PROCESS_PROFILE_ID: &str = "tinyrustlm.vnext.archive-scan-process.v1";
/// The SHA-256 of the sole current archive-scan process profile bytes.
pub const ARCHIVE_SCAN_PROCESS_PROFILE_SHA256: &str =
    "a5ab1ba16af4db2cf4660bee8c9efd9a32b018cc30211d2144f4c852912d05ad";
/// The strict archive-scan request schema.
const ARCHIVE_SCAN_REQUEST_SCHEMA: &str = "tinyrustlm.vnext.archive_scan_request.v1";
/// The strict archive-scan failure schema.
pub const ARCHIVE_SCAN_FAILURE_SCHEMA: &str = "tinyrustlm.vnext.archive_scan_failure.v1";
/// The maximum accepted canonical request size.
pub const ARCHIVE_SCAN_REQUEST_MAXIMUM_BYTES: usize = 16_384;

const ARCHIVE_SCAN_PROCESS_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/archive-scan-process-profile.v1.json");
const MAXIMUM_PATH_BYTES: usize = 16_384;
const WIRE_MAGIC: &[u8; 8] = b"TRASV1\0\0";
const MEMBER_RECORD_TYPE: u8 = 1;
const TERMINAL_RECORD_TYPE: u8 = 2;

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ArchiveScanRequest {
    archive_path: String,
    format: String,
    schema: String,
}

/// A bounded public-safe archive-scan process failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ArchiveScanProcessError {
    code: &'static str,
}

impl ArchiveScanProcessError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for ArchiveScanProcessError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for ArchiveScanProcessError {}

/// Executes one canonical path-bound request and writes the strict binary
/// member stream only after the complete archive passes admission.
pub fn execute_archive_scan_request_bytes<W: Write>(
    input: &[u8],
    output: &mut W,
) -> Result<(), ArchiveScanProcessError> {
    validate_process_profile()?;
    if input.is_empty() || input.len() > ARCHIVE_SCAN_REQUEST_MAXIMUM_BYTES {
        return Err(ArchiveScanProcessError::new(
            "archive_scan_request_byte_limit",
        ));
    }
    let request: ArchiveScanRequest = serde_json::from_slice(input)
        .map_err(|_| ArchiveScanProcessError::new("archive_scan_request_invalid"))?;
    let canonical = serde_json::to_vec(&request)
        .map_err(|_| ArchiveScanProcessError::new("archive_scan_request_invalid"))?;
    if canonical != input {
        return Err(ArchiveScanProcessError::new(
            "archive_scan_request_noncanonical",
        ));
    }
    if request.schema != ARCHIVE_SCAN_REQUEST_SCHEMA {
        return Err(ArchiveScanProcessError::new(
            "archive_scan_request_schema_invalid",
        ));
    }
    let format = parse_format(&request.format)?;
    let archive_bytes = read_archive(Path::new(&request.archive_path))?;
    let mut output_failed = false;
    let mut member_count = 0_u32;
    let mut total_content_bytes = 0_u64;
    let admission_result = scan_archive_bytes(format, &archive_bytes, |member, content| {
        if output_failed {
            return;
        }
        if member_count == 0 && output.write_all(WIRE_MAGIC).is_err() {
            output_failed = true;
            return;
        }
        if write_member_record(
            output,
            member.normalized_path(),
            member.content_sha256(),
            content,
        )
        .is_err()
        {
            output_failed = true;
            return;
        }
        member_count = match member_count.checked_add(1) {
            Some(value) => value,
            None => {
                output_failed = true;
                return;
            }
        };
        total_content_bytes = match total_content_bytes
            .checked_add(u64::try_from(content.len()).unwrap_or(u64::MAX))
        {
            Some(value) => value,
            None => {
                output_failed = true;
                return;
            }
        };
    });
    let admission = match admission_result {
        Ok(admission) => admission,
        Err(_) if output_failed || member_count != 0 => {
            return Err(ArchiveScanProcessError::new("archive_scan_output_failed"));
        }
        Err(error) => return Err(ArchiveScanProcessError::new(error.code())),
    };
    if output_failed
        || usize::try_from(member_count).ok() != Some(admission.members().len())
        || total_content_bytes != admission.total_uncompressed_bytes()
    {
        return Err(ArchiveScanProcessError::new("archive_scan_output_failed"));
    }
    write_terminal_record(
        output,
        member_count,
        total_content_bytes,
        format,
        admission.archive_sha256(),
        admission.content_manifest_sha256(),
    )
    .map_err(|_| ArchiveScanProcessError::new("archive_scan_output_failed"))?;
    output
        .flush()
        .map_err(|_| ArchiveScanProcessError::new("archive_scan_output_failed"))
}

fn validate_process_profile() -> Result<(), ArchiveScanProcessError> {
    let actual = format!("{:x}", Sha256::digest(ARCHIVE_SCAN_PROCESS_PROFILE_BYTES));
    if actual != ARCHIVE_SCAN_PROCESS_PROFILE_SHA256 {
        return Err(ArchiveScanProcessError::new(
            "archive_scan_process_profile_invalid",
        ));
    }
    Ok(())
}

fn parse_format(value: &str) -> Result<ArchiveFormat, ArchiveScanProcessError> {
    match value {
        "zip" => Ok(ArchiveFormat::Zip),
        "tar-gzip" => Ok(ArchiveFormat::TarGzip),
        _ => Err(ArchiveScanProcessError::new("archive_scan_format_invalid")),
    }
}

fn read_archive(path: &Path) -> Result<Vec<u8>, ArchiveScanProcessError> {
    let path_text = path
        .to_str()
        .ok_or_else(|| ArchiveScanProcessError::new("archive_scan_path_invalid"))?;
    if path_text.is_empty() || path_text.len() > MAXIMUM_PATH_BYTES || path_text.contains('\0') {
        return Err(ArchiveScanProcessError::new("archive_scan_path_invalid"));
    }
    if !path.is_absolute() {
        return Err(ArchiveScanProcessError::new(
            "archive_scan_path_not_absolute",
        ));
    }
    reject_link_components(path)?;
    let before = fs::symlink_metadata(path).map_err(path_metadata_error)?;
    validate_file_metadata(&before)?;
    if before.len() > crate::MAXIMUM_ARCHIVE_BYTES as u64 {
        return Err(ArchiveScanProcessError::new("archive_scan_path_size_limit"));
    }
    let mut file =
        File::open(path).map_err(|_| ArchiveScanProcessError::new("archive_scan_read_failed"))?;
    let opened = file
        .metadata()
        .map_err(|_| ArchiveScanProcessError::new("archive_scan_read_failed"))?;
    validate_file_metadata(&opened)?;
    if opened.len() != before.len() {
        return Err(ArchiveScanProcessError::new("archive_scan_path_changed"));
    }
    let mut bytes = Vec::with_capacity(usize::try_from(opened.len().min(65_536)).unwrap_or(65_536));
    (&mut file)
        .take(crate::MAXIMUM_ARCHIVE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| ArchiveScanProcessError::new("archive_scan_read_failed"))?;
    if bytes.len() > crate::MAXIMUM_ARCHIVE_BYTES {
        return Err(ArchiveScanProcessError::new("archive_scan_path_size_limit"));
    }
    if u64::try_from(bytes.len()).ok() != Some(opened.len()) {
        return Err(ArchiveScanProcessError::new("archive_scan_path_changed"));
    }
    reject_link_components(path)?;
    let after = fs::symlink_metadata(path)
        .map_err(|_| ArchiveScanProcessError::new("archive_scan_path_changed"))?;
    validate_file_metadata(&after)?;
    if after.len() != before.len() {
        return Err(ArchiveScanProcessError::new("archive_scan_path_changed"));
    }
    Ok(bytes)
}

fn reject_link_components(path: &Path) -> Result<(), ArchiveScanProcessError> {
    let ancestors = path.ancestors().collect::<Vec<_>>();
    for ancestor in ancestors.into_iter().rev() {
        if ancestor.as_os_str().is_empty() {
            continue;
        }
        let metadata = fs::symlink_metadata(ancestor).map_err(path_metadata_error)?;
        if metadata_is_link(&metadata) {
            return Err(ArchiveScanProcessError::new("archive_scan_path_link"));
        }
    }
    Ok(())
}

fn path_metadata_error(error: std::io::Error) -> ArchiveScanProcessError {
    if error.kind() == std::io::ErrorKind::NotFound {
        ArchiveScanProcessError::new("archive_scan_path_missing")
    } else {
        ArchiveScanProcessError::new("archive_scan_path_invalid")
    }
}

fn validate_file_metadata(metadata: &Metadata) -> Result<(), ArchiveScanProcessError> {
    if metadata_is_link(metadata) {
        return Err(ArchiveScanProcessError::new("archive_scan_path_link"));
    }
    if !metadata.is_file() {
        return Err(ArchiveScanProcessError::new("archive_scan_path_not_file"));
    }
    Ok(())
}

#[cfg(windows)]
fn metadata_is_link(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0000_0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn metadata_is_link(metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn write_member_record<W: Write>(
    output: &mut W,
    path: &str,
    content_sha256: &str,
    content: &[u8],
) -> std::io::Result<()> {
    let path_length = u16::try_from(path.len()).map_err(|_| std::io::ErrorKind::InvalidData)?;
    let content_length =
        u64::try_from(content.len()).map_err(|_| std::io::ErrorKind::InvalidData)?;
    if content_sha256.len() != 64 {
        return Err(std::io::ErrorKind::InvalidData.into());
    }
    output.write_all(&[MEMBER_RECORD_TYPE])?;
    output.write_all(&path_length.to_be_bytes())?;
    output.write_all(&content_length.to_be_bytes())?;
    output.write_all(content_sha256.as_bytes())?;
    output.write_all(path.as_bytes())?;
    output.write_all(content)
}

fn write_terminal_record<W: Write>(
    output: &mut W,
    member_count: u32,
    total_content_bytes: u64,
    format: ArchiveFormat,
    archive_sha256: &str,
    content_manifest_sha256: &str,
) -> std::io::Result<()> {
    if archive_sha256.len() != 64
        || content_manifest_sha256.len() != 64
        || ARCHIVE_ADMISSION_PROFILE_SHA256.len() != 64
        || ARCHIVE_SCAN_PROCESS_PROFILE_SHA256.len() != 64
    {
        return Err(std::io::ErrorKind::InvalidData.into());
    }
    output.write_all(&[TERMINAL_RECORD_TYPE])?;
    output.write_all(&member_count.to_be_bytes())?;
    output.write_all(&total_content_bytes.to_be_bytes())?;
    output.write_all(&[match format {
        ArchiveFormat::Zip => 1,
        ArchiveFormat::TarGzip => 2,
    }])?;
    output.write_all(archive_sha256.as_bytes())?;
    output.write_all(content_manifest_sha256.as_bytes())?;
    output.write_all(ARCHIVE_ADMISSION_PROFILE_SHA256.as_bytes())?;
    output.write_all(ARCHIVE_SCAN_PROCESS_PROFILE_SHA256.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::time::{SystemTime, UNIX_EPOCH};
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn test_zip_members(members: &[(&str, &[u8])]) -> Vec<u8> {
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, content) in members {
            writer
                .start_file(name, SimpleFileOptions::default())
                .expect("start member");
            writer.write_all(content).expect("write member");
        }
        writer.finish().expect("finish archive").into_inner()
    }

    fn test_zip(name: &str, content: &[u8]) -> Vec<u8> {
        test_zip_members(&[(name, content)])
    }

    fn write_archive(label: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "tinyrustlm-archive-process-{label}-{}.zip",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));
        fs::write(&path, bytes).expect("write archive");
        path
    }

    fn request(path: &Path, format: &str) -> Vec<u8> {
        serde_json::to_vec(&ArchiveScanRequest {
            archive_path: path.to_string_lossy().into_owned(),
            format: format.to_owned(),
            schema: ARCHIVE_SCAN_REQUEST_SCHEMA.to_owned(),
        })
        .expect("request")
    }

    #[test]
    fn frozen_process_profile_identity_matches_canonical_bytes() {
        assert_eq!(
            format!("{:x}", Sha256::digest(ARCHIVE_SCAN_PROCESS_PROFILE_BYTES)),
            ARCHIVE_SCAN_PROCESS_PROFILE_SHA256
        );
    }

    #[test]
    fn canonical_request_emits_one_member_and_terminal_record() {
        let path = write_archive("valid", &test_zip("docs/readme.txt", b"hello"));
        let mut output = Vec::new();

        execute_archive_scan_request_bytes(&request(&path, "zip"), &mut output)
            .expect("scan archive");

        assert_eq!(&output[..8], WIRE_MAGIC);
        assert_eq!(output[8], MEMBER_RECORD_TYPE);
        let path_length = u16::from_be_bytes([output[9], output[10]]) as usize;
        let content_length = u64::from_be_bytes(output[11..19].try_into().unwrap()) as usize;
        let path_start = 83;
        let content_start = path_start + path_length;
        assert_eq!(&output[path_start..content_start], b"docs/readme.txt");
        assert_eq!(
            &output[content_start..content_start + content_length],
            b"hello"
        );
        assert_eq!(output[content_start + content_length], TERMINAL_RECORD_TYPE);
        fs::remove_file(path).expect("remove archive");
    }

    #[test]
    fn noncanonical_and_unknown_requests_fail_without_output() {
        let path = write_archive("request", &test_zip("file.txt", b"content"));
        let mut noncanonical = request(&path, "zip");
        noncanonical.push(b'\n');
        let mut output = Vec::new();
        let error = execute_archive_scan_request_bytes(&noncanonical, &mut output)
            .expect_err("noncanonical request must fail");
        assert_eq!(error.code(), "archive_scan_request_noncanonical");
        assert!(output.is_empty());

        let unknown = format!(
            "{{\"archivePath\":{},\"format\":\"zip\",\"schema\":\"{}\",\"unknown\":true}}",
            serde_json::to_string(&path.to_string_lossy()).unwrap(),
            ARCHIVE_SCAN_REQUEST_SCHEMA
        );
        let error = execute_archive_scan_request_bytes(unknown.as_bytes(), &mut output)
            .expect_err("unknown field must fail");
        assert_eq!(error.code(), "archive_scan_request_invalid");
        assert!(output.is_empty());
        fs::remove_file(path).expect("remove archive");
    }

    #[test]
    fn rejected_archive_exposes_no_wire_bytes() {
        let path = write_archive(
            "hostile",
            &test_zip_members(&[
                ("docs/accepted.txt", b"public"),
                (r"docs\readme.txt", b"secret"),
            ]),
        );
        let mut output = Vec::new();

        let error = execute_archive_scan_request_bytes(&request(&path, "zip"), &mut output)
            .expect_err("hostile archive must fail");

        assert_eq!(error.code(), "archive_member_path_nonportable");
        assert!(output.is_empty());
        fs::remove_file(path).expect("remove archive");
    }
}
