use super::{AdmissionLimits, ArchiveAdmissionError};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct ValidatedPath {
    pub(super) collision_key: String,
    pub(super) normalized: String,
}

pub(super) fn validate(
    raw_name: &[u8],
    is_directory: bool,
    limits: AdmissionLimits,
) -> Result<ValidatedPath, ArchiveAdmissionError> {
    if raw_name.is_empty() || raw_name.len() > limits.maximum_member_name_bytes {
        return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
    }
    if raw_name[0] == b'/' {
        return Err(ArchiveAdmissionError::new("archive_member_path_absolute"));
    }
    if raw_name.contains(&b'\\') {
        return Err(ArchiveAdmissionError::new(
            "archive_member_path_nonportable",
        ));
    }
    if !raw_name.iter().all(|byte| (0x20..=0x7e).contains(byte)) {
        return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
    }

    let mut name = std::str::from_utf8(raw_name)
        .map_err(|_| ArchiveAdmissionError::new("archive_member_name_invalid"))?;
    if is_directory && name.ends_with('/') {
        name = &name[..name.len() - 1];
    } else if !is_directory && name.ends_with('/') {
        return Err(ArchiveAdmissionError::new("archive_member_type_forbidden"));
    }
    if name.is_empty() {
        return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
    }

    let components = name.split('/').collect::<Vec<_>>();
    if components.len() > limits.maximum_path_components {
        return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
    }
    for component in &components {
        if component.is_empty() {
            return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
        }
        if *component == "." || *component == ".." {
            return Err(ArchiveAdmissionError::new("archive_member_path_traversal"));
        }
        if component.len() > limits.maximum_path_component_bytes {
            return Err(ArchiveAdmissionError::new("archive_member_name_invalid"));
        }
        if component.ends_with('.')
            || component.ends_with(' ')
            || component.contains(':')
            || is_windows_reserved(component)
        {
            return Err(ArchiveAdmissionError::new(
                "archive_member_path_nonportable",
            ));
        }
    }

    Ok(ValidatedPath {
        collision_key: name.to_ascii_lowercase(),
        normalized: name.to_string(),
    })
}

fn is_windows_reserved(component: &str) -> bool {
    let lower = component.to_ascii_lowercase();
    let stem = lower.split('.').next().unwrap_or_default();
    matches!(stem, "con" | "prn" | "aux" | "nul" | "conin$" | "conout$")
        || stem.strip_prefix("com").is_some_and(|suffix| {
            matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
        || stem.strip_prefix("lpt").is_some_and(|suffix| {
            matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
}

pub(super) fn is_nested_archive_name(normalized_path: &str) -> bool {
    const SUFFIXES: &[&str] = &[
        ".tar.bz2", ".tar.gz", ".tar.xz", ".snupkg", ".nupkg", ".bz2", ".tgz", ".txz", ".7z",
        ".rar", ".tar", ".xz", ".zip", ".gz",
    ];
    let lower = normalized_path.to_ascii_lowercase();
    SUFFIXES.iter().any(|suffix| lower.ends_with(suffix))
}

pub(super) fn has_nested_archive_magic(content: &[u8]) -> bool {
    content.starts_with(b"PK\x03\x04")
        || content.starts_with(b"PK\x05\x06")
        || content.starts_with(b"PK\x07\x08")
        || content.starts_with(&[0x1f, 0x8b])
        || content.starts_with(b"BZh")
        || content.starts_with(&[0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
        || content.starts_with(b"Rar!\x1a\x07\x00")
        || content.starts_with(b"Rar!\x1a\x07\x01\x00")
        || content.starts_with(&[0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])
}
