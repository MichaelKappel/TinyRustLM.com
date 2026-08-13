use super::*;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::{Cursor, Write};
use zip::write::{FileOptions, FullFileOptions, SimpleFileOptions};
use zip::{CompressionMethod, ZipWriter};

#[derive(Clone, Copy)]
enum ZipKind {
    Directory,
    File(CompressionMethod),
    Symlink,
}

#[derive(Clone, Copy)]
struct ZipSpec<'a> {
    name: &'a str,
    content: &'a [u8],
    kind: ZipKind,
}

#[derive(Clone, Copy)]
struct TarSpec<'a> {
    name: &'a [u8],
    content: &'a [u8],
    entry_type: u8,
    link_name: &'a [u8],
}

fn zip_bytes(specs: &[ZipSpec<'_>]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    for spec in specs {
        let options = SimpleFileOptions::default();
        match spec.kind {
            ZipKind::Directory => writer.add_directory(spec.name, options).unwrap(),
            ZipKind::File(method) => {
                writer
                    .start_file(spec.name, options.compression_method(method))
                    .unwrap();
                writer.write_all(spec.content).unwrap();
            }
            ZipKind::Symlink => writer
                .add_symlink(spec.name, "target.txt", options)
                .unwrap(),
        }
    }
    writer.finish().unwrap().into_inner()
}

fn zip_file(name: &str, content: &[u8], method: CompressionMethod) -> Vec<u8> {
    zip_bytes(&[ZipSpec {
        name,
        content,
        kind: ZipKind::File(method),
    }])
}

fn write_octal(field: &mut [u8], value: u64) {
    field.fill(0);
    let digits = format!("{value:0width$o}", width = field.len() - 1);
    assert!(digits.len() < field.len());
    field[..digits.len()].copy_from_slice(digits.as_bytes());
}

fn tar_bytes(specs: &[TarSpec<'_>]) -> Vec<u8> {
    let mut output = Vec::new();
    for spec in specs {
        assert!(spec.name.len() <= 100);
        assert!(spec.link_name.len() <= 100);
        let mut header = [0_u8; 512];
        header[..spec.name.len()].copy_from_slice(spec.name);
        write_octal(&mut header[100..108], 0o644);
        write_octal(&mut header[108..116], 0);
        write_octal(&mut header[116..124], 0);
        write_octal(&mut header[124..136], spec.content.len() as u64);
        write_octal(&mut header[136..148], 0);
        header[148..156].fill(b' ');
        header[156] = spec.entry_type;
        header[157..157 + spec.link_name.len()].copy_from_slice(spec.link_name);
        header[257..263].copy_from_slice(b"ustar\0");
        header[263..265].copy_from_slice(b"00");
        let checksum = header.iter().map(|byte| u64::from(*byte)).sum::<u64>();
        let encoded_checksum = format!("{checksum:06o}\0 ");
        header[148..156].copy_from_slice(encoded_checksum.as_bytes());
        output.extend_from_slice(&header);
        output.extend_from_slice(spec.content);
        let padding = (512 - (spec.content.len() % 512)) % 512;
        output.resize(output.len() + padding, 0);
    }
    output.resize(output.len() + 1_024, 0);
    output
}

fn gzip(bytes: &[u8]) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(bytes).unwrap();
    encoder.finish().unwrap()
}

fn tar_gzip(specs: &[TarSpec<'_>]) -> Vec<u8> {
    gzip(&tar_bytes(specs))
}

fn tar_file(name: &str, content: &[u8]) -> Vec<u8> {
    tar_gzip(&[TarSpec {
        name: name.as_bytes(),
        content,
        entry_type: b'0',
        link_name: b"",
    }])
}

fn error_code(format: ArchiveFormat, bytes: &[u8]) -> &'static str {
    scan_archive_bytes(format, bytes, |_, _| {
        panic!("rejected archive exposed content")
    })
    .expect_err("archive should be rejected")
    .code()
}

fn error_code_with_limits(
    format: ArchiveFormat,
    bytes: &[u8],
    limits: AdmissionLimits,
) -> &'static str {
    scan_archive_bytes_with_limits(format, bytes, limits, |_, _| {
        panic!("rejected archive exposed content")
    })
    .expect_err("archive should be rejected")
    .code()
}

#[test]
fn accepts_zip_stored_and_deflated_only_after_whole_archive_admission() {
    let bytes = zip_bytes(&[
        ZipSpec {
            name: "docs/readme.txt",
            content: b"hello",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
        ZipSpec {
            name: "model/config.json",
            content: br#"{"kind":"test"}"#,
            kind: ZipKind::File(CompressionMethod::Deflated),
        },
    ]);
    let mut visited = Vec::new();
    let admission = scan_archive_bytes(ArchiveFormat::Zip, &bytes, |member, content| {
        visited.push((member.normalized_path().to_string(), content.to_vec()));
    })
    .unwrap();

    assert_eq!(admission.format(), ArchiveFormat::Zip);
    assert_eq!(admission.members().len(), 2);
    assert_eq!(admission.total_uncompressed_bytes(), 20);
    assert_eq!(
        visited[0],
        ("docs/readme.txt".to_string(), b"hello".to_vec())
    );
    assert_eq!(visited[1].0, "model/config.json");
}

#[test]
fn accepts_tar_gzip_regular_files_and_zero_length_directories() {
    let bytes = tar_gzip(&[
        TarSpec {
            name: b"docs/",
            content: b"",
            entry_type: b'5',
            link_name: b"",
        },
        TarSpec {
            name: b"docs/readme.txt",
            content: b"hello",
            entry_type: b'0',
            link_name: b"",
        },
    ]);
    let mut visited = Vec::new();
    let admission = scan_archive_bytes(ArchiveFormat::TarGzip, &bytes, |member, content| {
        visited.push((member.normalized_path().to_string(), content.to_vec()));
    })
    .unwrap();

    assert_eq!(admission.format(), ArchiveFormat::TarGzip);
    assert_eq!(admission.members().len(), 1);
    assert_eq!(admission.total_uncompressed_bytes(), 5);
    assert_eq!(
        visited,
        [("docs/readme.txt".to_string(), b"hello".to_vec())]
    );
}

#[test]
fn content_manifest_is_order_independent_but_archive_identity_is_not() {
    let first = zip_bytes(&[
        ZipSpec {
            name: "a.txt",
            content: b"alpha",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
        ZipSpec {
            name: "b.txt",
            content: b"beta",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
    ]);
    let second = zip_bytes(&[
        ZipSpec {
            name: "b.txt",
            content: b"beta",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
        ZipSpec {
            name: "a.txt",
            content: b"alpha",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
    ]);
    let first = scan_archive_bytes(ArchiveFormat::Zip, &first, |_, _| {}).unwrap();
    let second = scan_archive_bytes(ArchiveFormat::Zip, &second, |_, _| {}).unwrap();

    assert_ne!(first.archive_sha256(), second.archive_sha256());
    assert_eq!(
        first.content_manifest_sha256(),
        second.content_manifest_sha256()
    );
}

#[test]
fn rejects_absolute_traversal_and_nonportable_paths_in_both_formats() {
    let cases = [
        ("/absolute.txt", "archive_member_path_absolute"),
        ("../escape.txt", "archive_member_path_traversal"),
        ("folder/../escape.txt", "archive_member_path_traversal"),
        ("./file.txt", "archive_member_path_traversal"),
        ("folder\\file.txt", "archive_member_path_nonportable"),
        ("folder//file.txt", "archive_member_name_invalid"),
        ("C:/drive.txt", "archive_member_path_nonportable"),
        ("con.txt", "archive_member_path_nonportable"),
        ("folder/LPT9.log", "archive_member_path_nonportable"),
        ("name:stream", "archive_member_path_nonportable"),
        ("trailing.", "archive_member_path_nonportable"),
        ("trailing ", "archive_member_path_nonportable"),
        ("caf\u{e9}.txt", "archive_member_name_invalid"),
    ];
    for (name, expected) in cases {
        assert_eq!(
            error_code(
                ArchiveFormat::Zip,
                &zip_file(name, b"x", CompressionMethod::Stored)
            ),
            expected,
            "ZIP path {name}"
        );
        assert_eq!(
            error_code(ArchiveFormat::TarGzip, &tar_file(name, b"x")),
            expected,
            "tar path {name}"
        );
    }
}

#[test]
fn rejects_portable_case_insensitive_duplicate_paths() {
    let zip = zip_bytes(&[
        ZipSpec {
            name: "Model/Config.json",
            content: b"a",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
        ZipSpec {
            name: "model/config.JSON",
            content: b"b",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
    ]);
    let tar = tar_gzip(&[
        TarSpec {
            name: b"Model/Config.json",
            content: b"a",
            entry_type: b'0',
            link_name: b"",
        },
        TarSpec {
            name: b"model/config.JSON",
            content: b"b",
            entry_type: b'0',
            link_name: b"",
        },
    ]);

    assert_eq!(
        error_code(ArchiveFormat::Zip, &zip),
        "archive_member_path_duplicate"
    );
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, &tar),
        "archive_member_path_duplicate"
    );
}

#[test]
fn rejects_zip_and_tar_links_and_special_members() {
    let zip = zip_bytes(&[ZipSpec {
        name: "link",
        content: b"",
        kind: ZipKind::Symlink,
    }]);
    assert_eq!(
        error_code(ArchiveFormat::Zip, &zip),
        "archive_member_type_forbidden"
    );

    for entry_type in [b'1', b'2', b'3', b'4', b'6'] {
        let tar = tar_gzip(&[TarSpec {
            name: b"special",
            content: b"",
            entry_type,
            link_name: b"target",
        }]);
        assert_eq!(
            error_code(ArchiveFormat::TarGzip, &tar),
            "archive_member_type_forbidden"
        );
    }
}

#[test]
fn rejects_nested_archives_by_name_and_magic() {
    for (format, bytes) in [
        (
            ArchiveFormat::Zip,
            zip_file("nested.tar.gz", b"not nested", CompressionMethod::Stored),
        ),
        (
            ArchiveFormat::TarGzip,
            tar_file("nested.zip", b"not nested"),
        ),
        (
            ArchiveFormat::Zip,
            zip_file(
                "payload.bin",
                b"PK\x03\x04nested",
                CompressionMethod::Stored,
            ),
        ),
        (
            ArchiveFormat::TarGzip,
            tar_file("payload.bin", b"\x1f\x8bnested"),
        ),
    ] {
        assert_eq!(error_code(format, &bytes), "archive_nested_forbidden");
    }
}

#[test]
fn rejects_zip_and_tar_gzip_expansion_bombs() {
    let content = vec![0_u8; 1_048_576];
    let zip = zip_file("zeros.bin", &content, CompressionMethod::Deflated);
    let tar = tar_file("zeros.bin", &content);

    assert_eq!(
        error_code(ArchiveFormat::Zip, &zip),
        "archive_expansion_ratio_limit"
    );
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, &tar),
        "archive_expansion_ratio_limit"
    );
}

#[test]
fn rejects_archive_member_and_aggregate_limits_with_small_test_bounds() {
    let two_files = zip_bytes(&[
        ZipSpec {
            name: "a",
            content: b"abc",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
        ZipSpec {
            name: "b",
            content: b"def",
            kind: ZipKind::File(CompressionMethod::Stored),
        },
    ]);
    assert_eq!(
        error_code_with_limits(
            ArchiveFormat::Zip,
            &two_files,
            AdmissionLimits {
                maximum_members: 1,
                ..PROFILE_LIMITS
            }
        ),
        "archive_member_count_limit"
    );
    assert_eq!(
        error_code_with_limits(
            ArchiveFormat::Zip,
            &two_files,
            AdmissionLimits {
                maximum_member_bytes: 2,
                ..PROFILE_LIMITS
            }
        ),
        "archive_member_size_limit"
    );
    assert_eq!(
        error_code_with_limits(
            ArchiveFormat::Zip,
            &two_files,
            AdmissionLimits {
                maximum_total_member_bytes: 5,
                ..PROFILE_LIMITS
            }
        ),
        "archive_total_size_limit"
    );
    assert_eq!(
        error_code_with_limits(
            ArchiveFormat::Zip,
            &two_files,
            AdmissionLimits {
                maximum_archive_bytes: two_files.len() - 1,
                ..PROFILE_LIMITS
            }
        ),
        "archive_input_byte_limit"
    );
}

#[test]
fn rejects_small_ratio_and_decoded_container_limits_before_exposure() {
    let content = vec![0_u8; 4_096];
    let zip = zip_file("zeros", &content, CompressionMethod::Deflated);
    assert_eq!(
        error_code_with_limits(
            ArchiveFormat::Zip,
            &zip,
            AdmissionLimits {
                maximum_expansion_ratio: 2,
                ..PROFILE_LIMITS
            }
        ),
        "archive_expansion_ratio_limit"
    );

    let tar = tar_file("small", b"x");
    assert_eq!(
        error_code_with_limits(
            ArchiveFormat::TarGzip,
            &tar,
            AdmissionLimits {
                maximum_decoded_container_bytes: 1_023,
                ..PROFILE_LIMITS
            }
        ),
        "archive_total_size_limit"
    );
}

#[test]
fn rejects_zip_comments_unknown_extra_fields_and_trailing_bytes() {
    let mut commented = ZipWriter::new(Cursor::new(Vec::new()));
    commented.set_comment("comment");
    commented
        .start_file("file", SimpleFileOptions::default())
        .unwrap();
    commented.write_all(b"x").unwrap();
    let commented = commented.finish().unwrap().into_inner();
    assert_eq!(
        error_code(ArchiveFormat::Zip, &commented),
        "archive_comment_forbidden"
    );

    let mut with_extra = ZipWriter::new(Cursor::new(Vec::new()));
    let mut options: FullFileOptions<'_> = FileOptions::default();
    options
        .add_extra_data(0xcafe, Box::from(&b"x"[..]), false)
        .unwrap();
    with_extra.start_file("file", options).unwrap();
    with_extra.write_all(b"x").unwrap();
    let with_extra = with_extra.finish().unwrap().into_inner();
    assert_eq!(
        error_code(ArchiveFormat::Zip, &with_extra),
        "archive_member_extra_field_forbidden"
    );

    let mut trailing = zip_file("file", b"x", CompressionMethod::Stored);
    trailing.extend_from_slice(b"trailing");
    assert_eq!(
        error_code(ArchiveFormat::Zip, &trailing),
        "archive_trailing_bytes"
    );
}

#[test]
fn rejects_tar_gzip_trailing_bytes_concatenated_streams_and_directory_payloads() {
    let first = tar_file("first", b"a");
    let second = tar_file("second", b"b");
    let mut concatenated = first.clone();
    concatenated.extend_from_slice(&second);
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, &concatenated),
        "archive_trailing_bytes"
    );

    let mut trailing = first;
    trailing.extend_from_slice(b"trailing");
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, &trailing),
        "archive_trailing_bytes"
    );

    let directory_payload = tar_gzip(&[TarSpec {
        name: b"directory/",
        content: b"x",
        entry_type: b'5',
        link_name: b"",
    }]);
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, &directory_payload),
        "archive_member_type_forbidden"
    );
}

#[test]
fn rejects_empty_malformed_truncated_and_corrupt_archives() {
    assert_eq!(
        error_code(ArchiveFormat::Zip, b""),
        "archive_format_invalid"
    );
    assert_eq!(
        error_code(ArchiveFormat::Zip, b"PK\x03\x04broken"),
        "archive_zip_invalid"
    );
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, b"\x1f\x8bbroken"),
        "archive_tar_gzip_invalid"
    );

    let mut corrupt = zip_file("payload", b"distinct-payload", CompressionMethod::Stored);
    let offset = corrupt
        .windows(b"distinct-payload".len())
        .position(|window| window == b"distinct-payload")
        .unwrap();
    corrupt[offset] ^= 0xff;
    assert_eq!(
        error_code(ArchiveFormat::Zip, &corrupt),
        "archive_member_read_failed"
    );
}

#[test]
fn rejects_archives_without_regular_members() {
    let zip = zip_bytes(&[ZipSpec {
        name: "only-directory/",
        content: b"",
        kind: ZipKind::Directory,
    }]);
    let tar = tar_gzip(&[TarSpec {
        name: b"only-directory/",
        content: b"",
        entry_type: b'5',
        link_name: b"",
    }]);
    assert_eq!(
        error_code(ArchiveFormat::Zip, &zip),
        "archive_no_regular_members"
    );
    assert_eq!(
        error_code(ArchiveFormat::TarGzip, &tar),
        "archive_no_regular_members"
    );
}
