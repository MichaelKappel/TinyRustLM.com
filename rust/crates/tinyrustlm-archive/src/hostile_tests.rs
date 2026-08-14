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

const GENERATED_ARCHIVE_CASES: usize = 64;
const GENERATED_ARCHIVE_SEED: u64 = 0x6f4d_26b9_8a31_c5e7;
const MUTATIONS_PER_FORMAT: usize = 128;

#[derive(Clone, Debug, Eq, PartialEq)]
struct LogicalMember {
    path: String,
    content: Vec<u8>,
}

type MemberVisit = (String, Vec<u8>);
type ScanWithVisitsResult = Result<(ArchiveAdmission, Vec<MemberVisit>), ArchiveAdmissionError>;

fn next_generated(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    *state ^ (*state >> 29)
}

fn shuffled_indices(length: usize, state: &mut u64) -> Vec<usize> {
    let mut indices = (0..length).collect::<Vec<_>>();
    for upper in (1..length).rev() {
        let bound = u64::try_from(upper + 1).expect("generated case bound fits u64");
        let selected = usize::try_from(next_generated(state) % bound)
            .expect("generated case index fits usize");
        indices.swap(upper, selected);
    }
    indices
}

fn generated_members(case_index: usize, state: &mut u64) -> Vec<LogicalMember> {
    let member_count =
        usize::try_from(next_generated(state) % 6 + 1).expect("generated member count fits usize");
    let mut members = Vec::with_capacity(member_count);
    for member_index in 0..member_count {
        let group = next_generated(state) % 17;
        let content_length = usize::try_from(next_generated(state) % 257)
            .expect("generated content length fits usize");
        let mut content = Vec::with_capacity(content_length);
        for _ in 0..content_length {
            content.push(
                u8::try_from(next_generated(state) >> 56).expect("the high byte of a u64 fits u8"),
            );
        }
        if let Some(first) = content.first_mut() {
            *first = b'@';
        }
        members.push(LogicalMember {
            path: format!("case-{case_index:03}/group-{group:02}/member-{member_index:02}.bin"),
            content,
        });
    }
    members
}

fn encode_logical_archive(
    format: ArchiveFormat,
    members: &[LogicalMember],
    order: &[usize],
) -> Vec<u8> {
    match format {
        ArchiveFormat::Zip => {
            let specs = order
                .iter()
                .enumerate()
                .map(|(position, member_index)| {
                    let member = &members[*member_index];
                    ZipSpec {
                        name: &member.path,
                        content: &member.content,
                        kind: ZipKind::File(if position % 2 == 0 {
                            CompressionMethod::Stored
                        } else {
                            CompressionMethod::Deflated
                        }),
                    }
                })
                .collect::<Vec<_>>();
            zip_bytes(&specs)
        }
        ArchiveFormat::TarGzip => {
            let specs = order
                .iter()
                .map(|member_index| {
                    let member = &members[*member_index];
                    TarSpec {
                        name: member.path.as_bytes(),
                        content: &member.content,
                        entry_type: b'0',
                        link_name: b"",
                    }
                })
                .collect::<Vec<_>>();
            tar_gzip(&specs)
        }
    }
}

fn reference_sha256(bytes: &[u8]) -> [u8; 32] {
    <sha2::Sha256 as sha2::Digest>::digest(bytes).into()
}

fn reference_hex(digest: &[u8; 32]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(64);
    for byte in digest {
        output.push(char::from(HEX[usize::from(*byte >> 4)]));
        output.push(char::from(HEX[usize::from(*byte & 0x0f)]));
    }
    output
}

fn reference_path_identity(path: &str) -> [u8; 32] {
    let mut hasher = sha2::Sha256::default();
    sha2::Digest::update(&mut hasher, b"tinyrustlm.archive-member-path.v1\0");
    sha2::Digest::update(&mut hasher, path.as_bytes());
    sha2::Digest::finalize(hasher).into()
}

fn reference_content_evidence(visits: &[MemberVisit]) -> (String, Vec<(String, String, u64)>, u64) {
    let mut sorted = visits.iter().collect::<Vec<_>>();
    sorted.sort_by(|left, right| left.0.cmp(&right.0));

    let mut manifest = sha2::Sha256::default();
    sha2::Digest::update(&mut manifest, b"tinyrustlm.archive-content-manifest.v1\0");
    sha2::Digest::update(
        &mut manifest,
        u64::try_from(sorted.len())
            .expect("generated visit count fits u64")
            .to_be_bytes(),
    );
    let mut evidence = Vec::with_capacity(sorted.len());
    let mut total = 0_u64;
    for (path, content) in sorted {
        let path_digest = reference_path_identity(path);
        let content_digest = reference_sha256(content);
        let content_length = u64::try_from(content.len()).expect("generated content fits u64");
        sha2::Digest::update(&mut manifest, path_digest);
        sha2::Digest::update(&mut manifest, content_digest);
        sha2::Digest::update(&mut manifest, content_length.to_be_bytes());
        total = total
            .checked_add(content_length)
            .expect("generated aggregate content fits u64");
        evidence.push((
            reference_hex(&path_digest),
            reference_hex(&content_digest),
            content_length,
        ));
    }
    let manifest_digest: [u8; 32] = sha2::Digest::finalize(manifest).into();
    (reference_hex(&manifest_digest), evidence, total)
}

fn assert_admission_consistent(
    format: ArchiveFormat,
    archive_bytes: &[u8],
    admission: &ArchiveAdmission,
    visits: &[MemberVisit],
) {
    let (manifest_sha256, expected_members, total_bytes) = reference_content_evidence(visits);
    assert_eq!(admission.format(), format);
    assert_eq!(
        admission.archive_sha256(),
        reference_hex(&reference_sha256(archive_bytes))
    );
    assert_eq!(admission.content_manifest_sha256(), manifest_sha256);
    assert_eq!(admission.total_uncompressed_bytes(), total_bytes);
    assert_eq!(admission.members().len(), expected_members.len());
    for (actual, expected) in admission.members().iter().zip(expected_members) {
        assert_eq!(actual.path_identity_sha256(), expected.0);
        assert_eq!(actual.content_sha256(), expected.1);
        assert_eq!(actual.uncompressed_bytes(), expected.2);
    }
}

fn scan_with_visits(format: ArchiveFormat, archive_bytes: &[u8]) -> ScanWithVisitsResult {
    let mut visits = Vec::new();
    let admission = scan_archive_bytes(format, archive_bytes, |member, content| {
        visits.push((member.normalized_path().to_string(), content.to_vec()));
    })?;
    Ok((admission, visits))
}

fn profile_error_codes() -> std::collections::BTreeSet<String> {
    let profile: serde_json::Value =
        serde_json::from_slice(ARCHIVE_ADMISSION_PROFILE_BYTES).expect("frozen profile is JSON");
    profile["errorCodes"]
        .as_array()
        .expect("frozen profile declares errorCodes")
        .iter()
        .map(|code| {
            code.as_str()
                .expect("frozen error code is a string")
                .to_string()
        })
        .collect()
}

#[test]
fn generated_equivalent_formats_match_independent_content_evidence() {
    let mut state = GENERATED_ARCHIVE_SEED;
    for case_index in 0..GENERATED_ARCHIVE_CASES {
        let members = generated_members(case_index, &mut state);
        let zip_order = shuffled_indices(members.len(), &mut state);
        let tar_order = shuffled_indices(members.len(), &mut state);
        let zip = encode_logical_archive(ArchiveFormat::Zip, &members, &zip_order);
        let tar = encode_logical_archive(ArchiveFormat::TarGzip, &members, &tar_order);
        let (zip_admission, mut zip_visits) =
            scan_with_visits(ArchiveFormat::Zip, &zip).expect("generated ZIP must be admitted");
        let (tar_admission, mut tar_visits) = scan_with_visits(ArchiveFormat::TarGzip, &tar)
            .expect("generated tar-gzip must be admitted");

        assert_admission_consistent(ArchiveFormat::Zip, &zip, &zip_admission, &zip_visits);
        assert_admission_consistent(ArchiveFormat::TarGzip, &tar, &tar_admission, &tar_visits);
        assert_ne!(
            zip_admission.archive_sha256(),
            tar_admission.archive_sha256()
        );
        assert_eq!(
            zip_admission.content_manifest_sha256(),
            tar_admission.content_manifest_sha256()
        );
        assert_eq!(zip_admission.members(), tar_admission.members());
        assert_eq!(
            zip_admission.total_uncompressed_bytes(),
            tar_admission.total_uncompressed_bytes()
        );
        zip_visits.sort_by(|left, right| left.0.cmp(&right.0));
        tar_visits.sort_by(|left, right| left.0.cmp(&right.0));
        assert_eq!(zip_visits, tar_visits, "generated case {case_index}");
    }
}

fn single_member_verdict(format: ArchiveFormat, name: &str) -> Result<String, &'static str> {
    let bytes = match format {
        ArchiveFormat::Zip => zip_file(name, b"path-case", CompressionMethod::Stored),
        ArchiveFormat::TarGzip => tar_file(name, b"path-case"),
    };
    let mut visits = Vec::new();
    match scan_archive_bytes(format, &bytes, |member, content| {
        visits.push((member.normalized_path().to_string(), content.to_vec()));
    }) {
        Ok(admission) => {
            assert_admission_consistent(format, &bytes, &admission, &visits);
            assert_eq!(visits.len(), 1);
            Ok(visits[0].0.clone())
        }
        Err(error) => {
            assert!(visits.is_empty(), "rejected path {name} exposed content");
            Err(error.code())
        }
    }
}

#[test]
fn generated_path_mutations_have_cross_format_verdict_parity() {
    for case_index in 0..32 {
        let leaf = format!("leaf-{case_index:02}.dat");
        let valid = format!("root-{case_index:02}/branch_{case_index:02}/{leaf}");
        let reserved = case_index % 9 + 1;
        let cases = [
            (valid.clone(), None),
            (format!("../{valid}"), Some("archive_member_path_traversal")),
            (
                format!("root-{case_index:02}/../{leaf}"),
                Some("archive_member_path_traversal"),
            ),
            (format!("./{valid}"), Some("archive_member_path_traversal")),
            (
                valid.replace('/', "\\"),
                Some("archive_member_path_nonportable"),
            ),
            (
                format!("root-{case_index:02}//{leaf}"),
                Some("archive_member_name_invalid"),
            ),
            (
                format!("root-{case_index:02}/COM{reserved}.bin"),
                Some("archive_member_path_nonportable"),
            ),
            (
                format!("root-{case_index:02}/trailing./{leaf}"),
                Some("archive_member_path_nonportable"),
            ),
            (
                format!("root-{case_index:02}/name:stream"),
                Some("archive_member_path_nonportable"),
            ),
            (format!("/{valid}"), Some("archive_member_path_absolute")),
            (
                format!("root-{case_index:02}/caf\u{e9}.dat"),
                Some("archive_member_name_invalid"),
            ),
        ];

        for (name, expected_error) in cases {
            let zip = single_member_verdict(ArchiveFormat::Zip, &name);
            let tar = single_member_verdict(ArchiveFormat::TarGzip, &name);
            assert_eq!(zip, tar, "cross-format path verdict for {name}");
            match expected_error {
                Some(code) => assert_eq!(zip, Err(code), "path {name}"),
                None => assert_eq!(zip.as_deref(), Ok(name.as_str()), "path {name}"),
            }
        }
    }
}

fn mutation_members() -> Vec<LogicalMember> {
    (0..6)
        .map(|index| LogicalMember {
            path: format!("mutation/group-{}/member-{index}.bin", index % 3),
            content: (0..128)
                .map(|offset| {
                    u8::try_from((index * 37 + offset * 19) % 251)
                        .expect("generated mutation byte fits u8")
                })
                .collect(),
        })
        .collect()
}

#[test]
fn every_proper_generated_archive_prefix_rejects_before_member_exposure() {
    let error_codes = profile_error_codes();
    let members = mutation_members();
    let order = (0..members.len()).collect::<Vec<_>>();
    for format in [ArchiveFormat::Zip, ArchiveFormat::TarGzip] {
        let archive = encode_logical_archive(format, &members, &order);
        for prefix_length in 0..archive.len() {
            let mut visits = 0_usize;
            let error = scan_archive_bytes(format, &archive[..prefix_length], |_, _| visits += 1)
                .expect_err("every proper archive prefix must be rejected");
            assert_eq!(
                visits, 0,
                "{format:?} prefix {prefix_length} exposed a member"
            );
            assert!(
                error_codes.contains(error.code()),
                "{format:?} prefix {prefix_length} returned undeclared code {}",
                error.code()
            );
        }
    }
}

#[test]
fn deterministic_single_bit_mutations_reject_or_emit_consistent_evidence() {
    let error_codes = profile_error_codes();
    let members = mutation_members();
    let order = [5, 2, 0, 4, 1, 3];
    for format in [ArchiveFormat::Zip, ArchiveFormat::TarGzip] {
        let archive = encode_logical_archive(format, &members, &order);
        let (baseline, baseline_visits) =
            scan_with_visits(format, &archive).expect("mutation baseline must be admitted");
        assert_admission_consistent(format, &archive, &baseline, &baseline_visits);

        let sample_count = MUTATIONS_PER_FORMAT.min(archive.len());
        let mut rejected = 0_usize;
        for sample_index in 0..sample_count {
            let offset = sample_index * archive.len() / sample_count;
            let mut mutated = archive.clone();
            mutated[offset] ^= 1_u8 << (sample_index % 8);
            let mut visits = Vec::new();
            match scan_archive_bytes(format, &mutated, |member, content| {
                visits.push((member.normalized_path().to_string(), content.to_vec()));
            }) {
                Ok(admission) => {
                    assert_admission_consistent(format, &mutated, &admission, &visits);
                }
                Err(error) => {
                    rejected += 1;
                    assert!(
                        visits.is_empty(),
                        "{format:?} mutation {sample_index} exposed partial content"
                    );
                    assert!(
                        error_codes.contains(error.code()),
                        "{format:?} mutation {sample_index} returned undeclared code {}",
                        error.code()
                    );
                }
            }
        }
        assert!(rejected > 0, "{format:?} mutations must exercise rejection");

        if format == ArchiveFormat::TarGzip {
            let mut metadata_only = archive.clone();
            metadata_only[9] ^= 1;
            let (admission, visits) = scan_with_visits(format, &metadata_only)
                .expect("changing the RFC 1952 OS byte preserves payload validity");
            assert_admission_consistent(format, &metadata_only, &admission, &visits);
            assert_ne!(baseline.archive_sha256(), admission.archive_sha256());
            assert_eq!(
                baseline.content_manifest_sha256(),
                admission.content_manifest_sha256()
            );
        }
    }
}
