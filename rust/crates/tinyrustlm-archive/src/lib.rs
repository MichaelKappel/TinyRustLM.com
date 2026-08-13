#![forbid(unsafe_code)]
#![doc = "Fail-closed bounded archive-member admission for TinyRustLM."]

use std::error::Error;
use std::fmt;

/// The sole current archive-admission profile identity.
pub const ARCHIVE_ADMISSION_PROFILE_ID: &str = "tinyrustlm.vnext.archive-admission.v1";
/// The SHA-256 of the sole current archive-admission profile bytes.
pub const ARCHIVE_ADMISSION_PROFILE_SHA256: &str =
    "05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031";
/// The maximum accepted compressed archive size.
pub const MAXIMUM_ARCHIVE_BYTES: usize = 536_870_912;

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
    _format: ArchiveFormat,
    _archive_bytes: &[u8],
    _visitor: F,
) -> Result<ArchiveAdmission, ArchiveAdmissionError>
where
    F: FnMut(ArchiveMember<'_>, &[u8]),
{
    Err(ArchiveAdmissionError::new("archive_format_invalid"))
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
    fn incomplete_scanner_fails_closed_without_visiting_members() {
        for format in [ArchiveFormat::Zip, ArchiveFormat::TarGzip] {
            let mut visits = 0_u8;
            let error = scan_archive_bytes(format, b"not-an-archive", |_, _| visits += 1)
                .expect_err("the incomplete scanner must reject every archive");

            assert_eq!(error.code(), "archive_format_invalid");
            assert_eq!(visits, 0);
        }
    }
}
