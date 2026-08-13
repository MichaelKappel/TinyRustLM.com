use std::collections::BTreeSet;
use std::io::Cursor;

use zip::{CompressionMethod, ZipArchive};

use super::path_contract::{has_nested_archive_magic, is_nested_archive_name};
use super::{
    hex_sha256, path_contract, read_member_bytes, sha256_bytes, AdmissionLimits,
    ArchiveAdmissionError, ArchiveMember, MemberReadFailure, ValidatedMember,
};

#[derive(Debug)]
struct MemberPlan {
    normalized_path: String,
    source_index: usize,
    uncompressed_bytes: u64,
}

pub(super) fn validate_archive(
    archive_bytes: &[u8],
    limits: AdmissionLimits,
) -> Result<Vec<ValidatedMember>, ArchiveAdmissionError> {
    let mut archive = ZipArchive::new(Cursor::new(archive_bytes))
        .map_err(|_| ArchiveAdmissionError::new("archive_zip_invalid"))?;
    if archive.offset() != 0 {
        return Err(ArchiveAdmissionError::new("archive_zip_invalid"));
    }
    if !archive.comment().is_empty() {
        return Err(ArchiveAdmissionError::new("archive_comment_forbidden"));
    }
    validate_exact_end(archive_bytes)?;
    if archive.len() > limits.maximum_members {
        return Err(ArchiveAdmissionError::new("archive_member_count_limit"));
    }

    let mut collision_keys = BTreeSet::new();
    let mut plans = Vec::new();
    let mut total_uncompressed_bytes = 0_u64;
    for source_index in 0..archive.len() {
        let file = archive
            .by_index_raw(source_index)
            .map_err(|_| ArchiveAdmissionError::new("archive_zip_invalid"))?;
        let raw_name = file.name_raw();
        let path_is_directory = raw_name.ends_with(b"/");
        let validated_path = path_contract::validate(raw_name, path_is_directory, limits)?;
        if !collision_keys.insert(validated_path.collision_key) {
            return Err(ArchiveAdmissionError::new("archive_member_path_duplicate"));
        }
        if !file.comment().is_empty() {
            return Err(ArchiveAdmissionError::new(
                "archive_member_comment_forbidden",
            ));
        }
        if file.encrypted() {
            return Err(ArchiveAdmissionError::new("archive_member_encrypted"));
        }
        if !matches!(
            file.compression(),
            CompressionMethod::Stored | CompressionMethod::Deflated
        ) {
            return Err(ArchiveAdmissionError::new(
                "archive_member_compression_forbidden",
            ));
        }
        validate_extra_fields(file.extra_data().unwrap_or_default())?;
        validate_member_type(file.unix_mode(), path_is_directory)?;

        if path_is_directory {
            if file.size() != 0 || file.compressed_size() != 0 {
                return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
            }
            continue;
        }
        if is_nested_archive_name(&validated_path.normalized) {
            return Err(ArchiveAdmissionError::new("archive_nested_forbidden"));
        }
        if file.size() > limits.maximum_member_bytes {
            return Err(ArchiveAdmissionError::new("archive_member_size_limit"));
        }
        total_uncompressed_bytes = total_uncompressed_bytes
            .checked_add(file.size())
            .ok_or_else(|| ArchiveAdmissionError::new("archive_total_size_limit"))?;
        if total_uncompressed_bytes > limits.maximum_total_member_bytes {
            return Err(ArchiveAdmissionError::new("archive_total_size_limit"));
        }
        if exceeds_ratio(
            file.size(),
            file.compressed_size(),
            limits.maximum_expansion_ratio,
        ) {
            return Err(ArchiveAdmissionError::new("archive_expansion_ratio_limit"));
        }
        plans.push(MemberPlan {
            normalized_path: validated_path.normalized,
            source_index,
            uncompressed_bytes: file.size(),
        });
    }
    let archive_ratio_limit = u64::try_from(archive_bytes.len())
        .unwrap_or(u64::MAX)
        .saturating_mul(limits.maximum_expansion_ratio);
    if total_uncompressed_bytes > archive_ratio_limit {
        return Err(ArchiveAdmissionError::new("archive_expansion_ratio_limit"));
    }

    let mut validated = Vec::with_capacity(plans.len());
    for plan in plans {
        let mut file = archive
            .by_index(plan.source_index)
            .map_err(|_| ArchiveAdmissionError::new("archive_member_read_failed"))?;
        let content =
            read_member_bytes(&mut file, plan.uncompressed_bytes).map_err(map_member_error)?;
        if has_nested_archive_magic(&content) {
            return Err(ArchiveAdmissionError::new("archive_nested_forbidden"));
        }
        validated.push(ValidatedMember {
            source_index: plan.source_index,
            normalized_path: plan.normalized_path,
            content_sha256: sha256_bytes(&content),
            uncompressed_bytes: plan.uncompressed_bytes,
        });
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
    let mut archive = ZipArchive::new(Cursor::new(archive_bytes))
        .map_err(|_| ArchiveAdmissionError::new("archive_zip_invalid"))?;
    for member in members {
        let mut file = archive
            .by_index(member.source_index)
            .map_err(|_| ArchiveAdmissionError::new("archive_member_read_failed"))?;
        let content =
            read_member_bytes(&mut file, member.uncompressed_bytes).map_err(map_member_error)?;
        if sha256_bytes(&content) != member.content_sha256 {
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
    }
    Ok(())
}

fn validate_exact_end(archive_bytes: &[u8]) -> Result<(), ArchiveAdmissionError> {
    if archive_bytes.len() < 22
        || &archive_bytes[archive_bytes.len() - 22..archive_bytes.len() - 18] != b"PK\x05\x06"
        || archive_bytes[archive_bytes.len() - 2..] != [0, 0]
    {
        return Err(ArchiveAdmissionError::new("archive_trailing_bytes"));
    }
    Ok(())
}

fn validate_extra_fields(extra: &[u8]) -> Result<(), ArchiveAdmissionError> {
    let mut offset = 0_usize;
    let mut ids = BTreeSet::new();
    while offset < extra.len() {
        let header_end = offset
            .checked_add(4)
            .ok_or_else(|| ArchiveAdmissionError::new("archive_member_extra_field_forbidden"))?;
        if header_end > extra.len() {
            return Err(ArchiveAdmissionError::new(
                "archive_member_extra_field_forbidden",
            ));
        }
        let id = u16::from_le_bytes([extra[offset], extra[offset + 1]]);
        let length = usize::from(u16::from_le_bytes([extra[offset + 2], extra[offset + 3]]));
        let field_end = header_end
            .checked_add(length)
            .ok_or_else(|| ArchiveAdmissionError::new("archive_member_extra_field_forbidden"))?;
        if field_end > extra.len() || !matches!(id, 0x0001 | 0x5455) || !ids.insert(id) {
            return Err(ArchiveAdmissionError::new(
                "archive_member_extra_field_forbidden",
            ));
        }
        offset = field_end;
    }
    Ok(())
}

fn validate_member_type(
    unix_mode: Option<u32>,
    path_is_directory: bool,
) -> Result<(), ArchiveAdmissionError> {
    let type_bits = unix_mode.unwrap_or_default() & 0o170_000;
    let allowed = if path_is_directory {
        matches!(type_bits, 0 | 0o040_000)
    } else {
        matches!(type_bits, 0 | 0o100_000)
    };
    if !allowed {
        return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
    }
    Ok(())
}

fn exceeds_ratio(uncompressed: u64, compressed: u64, maximum_ratio: u64) -> bool {
    uncompressed != 0
        && (compressed == 0 || uncompressed > compressed.saturating_mul(maximum_ratio))
}

fn map_member_error(error: MemberReadFailure) -> ArchiveAdmissionError {
    match error {
        MemberReadFailure::Io(_) => ArchiveAdmissionError::new("archive_member_read_failed"),
        MemberReadFailure::SizeMismatch => {
            ArchiveAdmissionError::new("archive_member_size_mismatch")
        }
    }
}
