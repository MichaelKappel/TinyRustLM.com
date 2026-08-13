#![forbid(unsafe_code)]
#![doc = "Fail-closed bounded archive-member admission for TinyRustLM."]

use std::error::Error;
use std::fmt;
use std::io::{self, Read};

use sha2::{Digest, Sha256};

mod path_contract;
mod tar_gzip_format;
mod zip_format;

/// The sole current archive-admission profile identity.
pub const ARCHIVE_ADMISSION_PROFILE_ID: &str = "tinyrustlm.vnext.archive-admission.v1";
/// The SHA-256 of the sole current archive-admission profile bytes.
pub const ARCHIVE_ADMISSION_PROFILE_SHA256: &str =
    "05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031";
/// The maximum accepted compressed archive size.
pub const MAXIMUM_ARCHIVE_BYTES: usize = 536_870_912;
/// The maximum number of archive members, including directories.
pub const MAXIMUM_ARCHIVE_MEMBERS: usize = 16_384;
/// The maximum decoded size of one regular member.
pub const MAXIMUM_MEMBER_BYTES: u64 = 67_108_864;
/// The maximum aggregate decoded size of regular members.
pub const MAXIMUM_TOTAL_MEMBER_BYTES: u64 = 2_147_483_648;
/// The maximum decoded tar-container size.
pub const MAXIMUM_DECODED_CONTAINER_BYTES: u64 = 2_214_592_512;
/// The maximum decoded-to-compressed byte ratio.
pub const MAXIMUM_EXPANSION_RATIO: u64 = 200;

#[derive(Clone, Copy, Debug)]
struct AdmissionLimits {
    maximum_archive_bytes: usize,
    maximum_members: usize,
    maximum_member_name_bytes: usize,
    maximum_path_components: usize,
    maximum_path_component_bytes: usize,
    maximum_member_bytes: u64,
    maximum_total_member_bytes: u64,
    maximum_decoded_container_bytes: u64,
    maximum_expansion_ratio: u64,
}

const PROFILE_LIMITS: AdmissionLimits = AdmissionLimits {
    maximum_archive_bytes: MAXIMUM_ARCHIVE_BYTES,
    maximum_members: MAXIMUM_ARCHIVE_MEMBERS,
    maximum_member_name_bytes: 1_024,
    maximum_path_components: 64,
    maximum_path_component_bytes: 255,
    maximum_member_bytes: MAXIMUM_MEMBER_BYTES,
    maximum_total_member_bytes: MAXIMUM_TOTAL_MEMBER_BYTES,
    maximum_decoded_container_bytes: MAXIMUM_DECODED_CONTAINER_BYTES,
    maximum_expansion_ratio: MAXIMUM_EXPANSION_RATIO,
};

#[derive(Clone, Debug, Eq, PartialEq)]
struct ValidatedMember {
    source_index: usize,
    normalized_path: String,
    content_sha256: [u8; 32],
    uncompressed_bytes: u64,
}

#[derive(Debug)]
enum MemberReadFailure {
    Io(io::Error),
    SizeMismatch,
}

/// A compressed archive format admitted by the frozen profile.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ArchiveFormat {
    /// A ZIP container containing stored or deflated members.
    Zip,
    /// One gzip stream containing one POSIX tar archive.
    TarGzip,
}

impl ArchiveFormat {
    /// Returns the canonical format label used by archive evidence.
    pub const fn label(self) -> &'static str {
        match self {
            Self::Zip => "zip",
            Self::TarGzip => "tar-gzip",
        }
    }
}

/// A bounded public-safe archive-admission failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ArchiveAdmissionError {
    code: &'static str,
}

impl ArchiveAdmissionError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for ArchiveAdmissionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for ArchiveAdmissionError {}

/// A validated regular archive member presented to a post-admission consumer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ArchiveMember<'a> {
    normalized_path: &'a str,
    content_sha256: &'a str,
}

impl<'a> ArchiveMember<'a> {
    /// Returns the validated portable member path.
    pub const fn normalized_path(&self) -> &'a str {
        self.normalized_path
    }

    /// Returns the SHA-256 of the decoded member bytes.
    pub const fn content_sha256(&self) -> &'a str {
        self.content_sha256
    }
}

/// Path-redacted evidence for one admitted regular member.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArchiveMemberEvidence {
    path_identity_sha256: String,
    content_sha256: String,
    uncompressed_bytes: u64,
}

impl ArchiveMemberEvidence {
    /// Returns the domain-separated identity of the normalized member path.
    pub fn path_identity_sha256(&self) -> &str {
        &self.path_identity_sha256
    }

    /// Returns the SHA-256 of the decoded member bytes.
    pub fn content_sha256(&self) -> &str {
        &self.content_sha256
    }

    /// Returns the exact decoded member length.
    pub const fn uncompressed_bytes(&self) -> u64 {
        self.uncompressed_bytes
    }
}

/// Whole-archive admission evidence emitted only after every member passes.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArchiveAdmission {
    archive_sha256: String,
    content_manifest_sha256: String,
    format: ArchiveFormat,
    members: Vec<ArchiveMemberEvidence>,
    total_uncompressed_bytes: u64,
}

impl ArchiveAdmission {
    /// Returns the SHA-256 of the exact compressed input bytes.
    pub fn archive_sha256(&self) -> &str {
        &self.archive_sha256
    }

    /// Returns the sorted path-redacted content-manifest SHA-256.
    pub fn content_manifest_sha256(&self) -> &str {
        &self.content_manifest_sha256
    }

    /// Returns the admitted archive format.
    pub const fn format(&self) -> ArchiveFormat {
        self.format
    }

    /// Returns path-redacted evidence for every regular member.
    pub fn members(&self) -> &[ArchiveMemberEvidence] {
        &self.members
    }

    /// Returns the sum of decoded regular-member bytes.
    pub const fn total_uncompressed_bytes(&self) -> u64 {
        self.total_uncompressed_bytes
    }
}

/// Validates one immutable archive and visits regular members only after the
/// entire archive has passed metadata, path, type, size, ratio, nesting, and
/// content-integrity checks.
pub fn scan_archive_bytes<F>(
    format: ArchiveFormat,
    archive_bytes: &[u8],
    visitor: F,
) -> Result<ArchiveAdmission, ArchiveAdmissionError>
where
    F: FnMut(ArchiveMember<'_>, &[u8]),
{
    scan_archive_bytes_with_limits(format, archive_bytes, PROFILE_LIMITS, visitor)
}

fn scan_archive_bytes_with_limits<F>(
    format: ArchiveFormat,
    archive_bytes: &[u8],
    limits: AdmissionLimits,
    mut visitor: F,
) -> Result<ArchiveAdmission, ArchiveAdmissionError>
where
    F: FnMut(ArchiveMember<'_>, &[u8]),
{
    validate_limits(limits)?;
    if archive_bytes.is_empty() {
        return Err(ArchiveAdmissionError::new("archive_format_invalid"));
    }
    if archive_bytes.len() > limits.maximum_archive_bytes {
        return Err(ArchiveAdmissionError::new("archive_input_byte_limit"));
    }
    let magic_matches = match format {
        ArchiveFormat::Zip => matches!(
            archive_bytes.get(..4),
            Some(b"PK\x03\x04" | b"PK\x05\x06" | b"PK\x07\x08")
        ),
        ArchiveFormat::TarGzip => archive_bytes.starts_with(&[0x1f, 0x8b]),
    };
    if !magic_matches {
        return Err(ArchiveAdmissionError::new("archive_format_invalid"));
    }

    let members = match format {
        ArchiveFormat::Zip => zip_format::validate_archive(archive_bytes, limits)?,
        ArchiveFormat::TarGzip => tar_gzip_format::validate_archive(archive_bytes, limits)?,
    };
    if members.is_empty() {
        return Err(ArchiveAdmissionError::new("archive_no_regular_members"));
    }
    let admission = build_admission(format, archive_bytes, &members)?;

    match format {
        ArchiveFormat::Zip => zip_format::deliver_members(archive_bytes, &members, &mut visitor)?,
        ArchiveFormat::TarGzip => {
            tar_gzip_format::deliver_members(archive_bytes, &members, &mut visitor)?
        }
    }
    Ok(admission)
}

fn validate_limits(limits: AdmissionLimits) -> Result<(), ArchiveAdmissionError> {
    if limits.maximum_archive_bytes == 0
        || limits.maximum_members == 0
        || limits.maximum_member_name_bytes == 0
        || limits.maximum_path_components == 0
        || limits.maximum_path_component_bytes == 0
        || limits.maximum_member_bytes == 0
        || limits.maximum_total_member_bytes == 0
        || limits.maximum_decoded_container_bytes == 0
        || limits.maximum_expansion_ratio == 0
    {
        return Err(ArchiveAdmissionError::new("archive_profile_invalid"));
    }
    Ok(())
}

fn read_member_bytes<R: Read>(
    reader: &mut R,
    expected_bytes: u64,
) -> Result<Vec<u8>, MemberReadFailure> {
    let initial_capacity = usize::try_from(expected_bytes.min(65_536)).unwrap_or(65_536);
    let mut content = Vec::with_capacity(initial_capacity);
    reader
        .take(expected_bytes.saturating_add(1))
        .read_to_end(&mut content)
        .map_err(MemberReadFailure::Io)?;
    if u64::try_from(content.len()).ok() != Some(expected_bytes) {
        return Err(MemberReadFailure::SizeMismatch);
    }
    Ok(content)
}

fn sha256_bytes(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

fn hex_sha256(digest: &[u8; 32]) -> String {
    let mut output = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write as _;
        write!(&mut output, "{byte:02x}").expect("writing to a String cannot fail");
    }
    output
}

fn path_identity(normalized_path: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"tinyrustlm.archive-member-path.v1\0");
    hasher.update(normalized_path.as_bytes());
    hasher.finalize().into()
}

fn build_admission(
    format: ArchiveFormat,
    archive_bytes: &[u8],
    members: &[ValidatedMember],
) -> Result<ArchiveAdmission, ArchiveAdmissionError> {
    let mut sorted = members.iter().collect::<Vec<_>>();
    sorted.sort_by(|left, right| left.normalized_path.cmp(&right.normalized_path));
    let mut manifest_hasher = Sha256::new();
    manifest_hasher.update(b"tinyrustlm.archive-content-manifest.v1\0");
    manifest_hasher.update(
        u64::try_from(sorted.len())
            .map_err(|_| ArchiveAdmissionError::new("archive_member_count_limit"))?
            .to_be_bytes(),
    );
    let mut evidence = Vec::with_capacity(sorted.len());
    let mut total_uncompressed_bytes = 0_u64;
    for member in sorted {
        let path_sha256 = path_identity(&member.normalized_path);
        manifest_hasher.update(path_sha256);
        manifest_hasher.update(member.content_sha256);
        manifest_hasher.update(member.uncompressed_bytes.to_be_bytes());
        total_uncompressed_bytes = total_uncompressed_bytes
            .checked_add(member.uncompressed_bytes)
            .ok_or_else(|| ArchiveAdmissionError::new("archive_total_size_limit"))?;
        evidence.push(ArchiveMemberEvidence {
            path_identity_sha256: hex_sha256(&path_sha256),
            content_sha256: hex_sha256(&member.content_sha256),
            uncompressed_bytes: member.uncompressed_bytes,
        });
    }
    let manifest_sha256: [u8; 32] = manifest_hasher.finalize().into();
    Ok(ArchiveAdmission {
        archive_sha256: hex_sha256(&sha256_bytes(archive_bytes)),
        content_manifest_sha256: hex_sha256(&manifest_sha256),
        format,
        members: evidence,
        total_uncompressed_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};

    #[test]
    fn frozen_profile_identity_matches_canonical_bytes() {
        let bytes = include_bytes!("../../../../contracts/vnext/archive-admission-profile.v1.json");
        let actual = format!("{:x}", Sha256::digest(bytes));

        assert_eq!(actual, ARCHIVE_ADMISSION_PROFILE_SHA256);
    }

    #[test]
    fn invalid_magic_fails_closed_without_visiting_members() {
        for format in [ArchiveFormat::Zip, ArchiveFormat::TarGzip] {
            let mut visits = 0_u8;
            let error = scan_archive_bytes(format, b"not-an-archive", |_, _| visits += 1)
                .expect_err("invalid magic must reject the archive");

            assert_eq!(error.code(), "archive_format_invalid");
            assert_eq!(visits, 0);
        }
    }
}

#[cfg(test)]
mod hostile_tests;
