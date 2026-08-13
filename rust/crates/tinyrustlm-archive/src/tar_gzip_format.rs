use std::collections::BTreeSet;
use std::io::{self, Cursor, Read};

use flate2::bufread::GzDecoder;
use tar::{Archive, Header};

use super::path_contract::{has_nested_archive_magic, is_nested_archive_name};
use super::{
    hex_sha256, path_contract, read_member_bytes, sha256_bytes, AdmissionLimits,
    ArchiveAdmissionError, ArchiveMember, MemberReadFailure, ValidatedMember,
};

const RATIO_LIMIT_MARKER: &str = "tinyrustlm-archive-expansion-ratio-limit";
const CONTAINER_LIMIT_MARKER: &str = "tinyrustlm-archive-decoded-container-limit";

struct CappedReader<R> {
    inner: R,
    decoded_bytes: u64,
    limit: u64,
    marker: &'static str,
}

impl<R> CappedReader<R> {
    fn new(inner: R, limit: u64, marker: &'static str) -> Self {
        Self {
            inner,
            decoded_bytes: 0,
            limit,
            marker,
        }
    }

    fn into_parts(self) -> (R, u64) {
        (self.inner, self.decoded_bytes)
    }
}

impl<R: Read> Read for CappedReader<R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }
        let remaining = self.limit.saturating_sub(self.decoded_bytes);
        let allowed = usize::try_from(remaining.saturating_add(1))
            .unwrap_or(usize::MAX)
            .min(buffer.len());
        let read = self.inner.read(&mut buffer[..allowed])?;
        let next = self.decoded_bytes.saturating_add(read as u64);
        if next > self.limit {
            return Err(io::Error::new(io::ErrorKind::InvalidData, self.marker));
        }
        self.decoded_bytes = next;
        Ok(read)
    }
}

pub(super) fn validate_archive(
    archive_bytes: &[u8],
    limits: AdmissionLimits,
) -> Result<Vec<ValidatedMember>, ArchiveAdmissionError> {
    let compressed_bytes = u64::try_from(archive_bytes.len()).unwrap_or(u64::MAX);
    let ratio_limit = compressed_bytes.saturating_mul(limits.maximum_expansion_ratio);
    let (decoded_limit, marker) = if ratio_limit < limits.maximum_decoded_container_bytes {
        (ratio_limit, RATIO_LIMIT_MARKER)
    } else {
        (
            limits.maximum_decoded_container_bytes,
            CONTAINER_LIMIT_MARKER,
        )
    };
    let decoder = GzDecoder::new(Cursor::new(archive_bytes));
    let capped = CappedReader::new(decoder, decoded_limit, marker);
    let mut archive = Archive::new(capped);
    let mut collision_keys = BTreeSet::new();
    let mut validated = Vec::new();
    let mut visible_members = 0_usize;
    let mut expected_decoded_bytes = 1_024_u64;
    let mut total_uncompressed_bytes = 0_u64;

    {
        let entries = archive
            .entries()
            .map_err(|error| map_tar_error(&error, "archive_tar_gzip_invalid"))?;
        for (source_index, next) in entries.enumerate() {
            visible_members = visible_members
                .checked_add(1)
                .ok_or_else(|| ArchiveAdmissionError::new("archive_member_count_limit"))?;
            if visible_members > limits.maximum_members {
                return Err(ArchiveAdmissionError::new("archive_member_count_limit"));
            }
            let mut entry =
                next.map_err(|error| map_tar_error(&error, "archive_tar_gzip_invalid"))?;
            let raw_path = raw_header_path(entry.header())?;
            let effective_path = entry.path_bytes().into_owned();
            let entry_type = entry.header().entry_type();
            let is_directory = entry_type.is_dir();
            let validated_path = path_contract::validate(&raw_path, is_directory, limits)?;
            if raw_path != effective_path {
                return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
            }
            if entry
                .pax_extensions()
                .map_err(|error| map_tar_error(&error, "archive_tar_gzip_invalid"))?
                .is_some()
            {
                return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
            }
            if !collision_keys.insert(validated_path.collision_key) {
                return Err(ArchiveAdmissionError::new("archive_member_path_duplicate"));
            }
            let entry_size = entry.size();
            let padded_size = round_to_tar_block(entry_size)
                .ok_or_else(|| ArchiveAdmissionError::new("archive_total_size_limit"))?;
            expected_decoded_bytes = expected_decoded_bytes
                .checked_add(512)
                .and_then(|value| value.checked_add(padded_size))
                .ok_or_else(|| ArchiveAdmissionError::new("archive_total_size_limit"))?;

            if is_directory {
                if entry_size != 0 {
                    return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
                }
                continue;
            }
            if !entry_type.is_file() {
                return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
            }
            if is_nested_archive_name(&validated_path.normalized) {
                return Err(ArchiveAdmissionError::new("archive_nested_forbidden"));
            }
            if entry_size > limits.maximum_member_bytes {
                return Err(ArchiveAdmissionError::new("archive_member_size_limit"));
            }
            total_uncompressed_bytes = total_uncompressed_bytes
                .checked_add(entry_size)
                .ok_or_else(|| ArchiveAdmissionError::new("archive_total_size_limit"))?;
            if total_uncompressed_bytes > limits.maximum_total_member_bytes {
                return Err(ArchiveAdmissionError::new("archive_total_size_limit"));
            }
            if total_uncompressed_bytes > ratio_limit {
                return Err(ArchiveAdmissionError::new("archive_expansion_ratio_limit"));
            }
            let content = read_member_bytes(&mut entry, entry_size).map_err(map_member_error)?;
            if has_nested_archive_magic(&content) {
                return Err(ArchiveAdmissionError::new("archive_nested_forbidden"));
            }
            validated.push(ValidatedMember {
                source_index,
                normalized_path: validated_path.normalized,
                content_sha256: sha256_bytes(&content),
                uncompressed_bytes: entry_size,
            });
        }
    }

    let mut capped = archive.into_inner();
    let mut tail = [0_u8; 8_192];
    loop {
        let read = capped
            .read(&mut tail)
            .map_err(|error| map_tar_error(&error, "archive_tar_gzip_invalid"))?;
        if read == 0 {
            break;
        }
    }
    let (decoder, decoded_bytes) = capped.into_parts();
    let cursor = decoder.into_inner();
    if usize::try_from(cursor.position()).ok() != Some(archive_bytes.len()) {
        return Err(ArchiveAdmissionError::new("archive_trailing_bytes"));
    }
    if decoded_bytes > limits.maximum_decoded_container_bytes {
        return Err(ArchiveAdmissionError::new("archive_total_size_limit"));
    }
    if decoded_bytes != expected_decoded_bytes {
        return Err(ArchiveAdmissionError::new("archive_tar_gzip_invalid"));
    }
    Ok(validated)
}

pub(super) fn deliver_members<F>(
    archive_bytes: &[u8],
    members: &[ValidatedMember],
    visitor: &mut F,
) -> Result<(), ArchiveAdmissionError>
where
    F: FnMut(ArchiveMember<'_>, &[u8]),
{
    let decoder = GzDecoder::new(Cursor::new(archive_bytes));
    let mut archive = Archive::new(decoder);
    let entries = archive
        .entries()
        .map_err(|_| ArchiveAdmissionError::new("archive_tar_gzip_invalid"))?;
    let mut delivered = 0_usize;
    for (source_index, next) in entries.enumerate() {
        let mut entry =
            next.map_err(|_| ArchiveAdmissionError::new("archive_member_read_failed"))?;
        let Some(member) = members.get(delivered) else {
            break;
        };
        if source_index != member.source_index {
            continue;
        }
        let content =
            read_member_bytes(&mut entry, member.uncompressed_bytes).map_err(map_member_error)?;
        if entry.path_bytes().as_ref() != member.normalized_path.as_bytes()
            || sha256_bytes(&content) != member.content_sha256
        {
            return Err(ArchiveAdmissionError::new("archive_member_read_failed"));
        }
        let content_sha256 = hex_sha256(&member.content_sha256);
        visitor(
            ArchiveMember {
                normalized_path: &member.normalized_path,
                content_sha256: &content_sha256,
            },
            &content,
        );
        delivered += 1;
    }
    if delivered != members.len() {
        return Err(ArchiveAdmissionError::new("archive_member_read_failed"));
    }
    Ok(())
}

fn raw_header_path(header: &Header) -> Result<Vec<u8>, ArchiveAdmissionError> {
    let name = trim_nul(&header.as_old().name);
    let prefix = header
        .as_ustar()
        .map(|ustar| trim_nul(&ustar.prefix))
        .unwrap_or_default();
    let mut path = Vec::with_capacity(prefix.len().saturating_add(name.len()).saturating_add(1));
    if !prefix.is_empty() {
        path.extend_from_slice(prefix);
        path.push(b'/');
    }
    path.extend_from_slice(name);
    if path.is_empty() {
        return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
    }
    Ok(path)
}

fn trim_nul(field: &[u8]) -> &[u8] {
    let end = field
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(field.len());
    &field[..end]
}

fn round_to_tar_block(size: u64) -> Option<u64> {
    size.checked_add(511).map(|value| value / 512 * 512)
}

fn map_member_error(error: MemberReadFailure) -> ArchiveAdmissionError {
    match error {
        MemberReadFailure::Io(error) => map_tar_error(&error, "archive_member_read_failed"),
        MemberReadFailure::SizeMismatch => {
            ArchiveAdmissionError::new("archive_member_size_mismatch")
        }
    }
}

fn map_tar_error(error: &io::Error, fallback: &'static str) -> ArchiveAdmissionError {
    let message = error.to_string();
    if message.contains(RATIO_LIMIT_MARKER) {
        ArchiveAdmissionError::new("archive_expansion_ratio_limit")
    } else if message.contains(CONTAINER_LIMIT_MARKER) {
        ArchiveAdmissionError::new("archive_total_size_limit")
    } else {
        ArchiveAdmissionError::new(fallback)
    }
}
