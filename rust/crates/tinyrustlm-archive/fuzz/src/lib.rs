#![deny(missing_docs)]
#![forbid(unsafe_code)]

//! Bounded structure-aware input generation and invariant checking for the
//! sole TinyRustLM ZIP and tar-gzip admission authority.

use arbitrary::{Arbitrary, Error as ArbitraryError, Unstructured};
use flate2::write::GzEncoder;
use flate2::Compression;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::io::{Cursor, Write};
use tinyrustlm_archive::{scan_archive_bytes, ArchiveFormat};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Exact four-byte prefix for version-one structured fuzz programs.
pub const INPUT_MAGIC: &[u8; 4] = b"TAF1";
/// Largest complete structured input admitted by the harness.
pub const MAXIMUM_INPUT_BYTES: usize = 4_096;
/// Largest archive the bounded generator may materialize.
pub const MAXIMUM_MATERIALIZED_ARCHIVE_BYTES: usize = 65_536;
/// Frozen fuzz-profile identity.
pub const ARCHIVE_FUZZ_PROFILE_ID: &str = "tinyrustlm.vnext.archive-fuzz.v1";
/// SHA-256 of the exact checked-in fuzz profile.
pub const ARCHIVE_FUZZ_PROFILE_SHA256: &str =
    "5af6f00aef3540aa6969bb122dc2a3efdde9b39049c0dfbb15cc1e0fa29ce22e";

const ARCHIVE_FUZZ_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../../contracts/vnext/archive-fuzz-profile.v1.json");
const MAXIMUM_GENERATED_MEMBERS: usize = 4;
const MAXIMUM_GENERATED_MEMBER_BYTES: usize = 32;
const PATH_IDENTITY_DOMAIN: &[u8] = b"tinyrustlm.archive-member-path.v1\0";
const CONTENT_MANIFEST_DOMAIN: &[u8] = b"tinyrustlm.archive-content-manifest.v1\0";
const PROFILE_ERROR_CODES: &[&str] = &[
    "archive_comment_forbidden",
    "archive_expansion_ratio_limit",
    "archive_format_invalid",
    "archive_input_byte_limit",
    "archive_member_comment_forbidden",
    "archive_member_compression_forbidden",
    "archive_member_count_limit",
    "archive_member_encrypted",
    "archive_member_extra_field_forbidden",
    "archive_member_name_invalid",
    "archive_member_path_absolute",
    "archive_member_path_duplicate",
    "archive_member_path_nonportable",
    "archive_member_path_traversal",
    "archive_member_read_failed",
    "archive_member_size_limit",
    "archive_member_size_mismatch",
    "archive_member_type_forbidden",
    "archive_nested_forbidden",
    "archive_no_regular_members",
    "archive_profile_invalid",
    "archive_tar_gzip_invalid",
    "archive_total_size_limit",
    "archive_trailing_bytes",
    "archive_zip_invalid",
];

/// Archive format selected by a structured fuzz program.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StructuredFormat {
    /// ZIP input.
    Zip,
    /// One gzip stream containing a tar input.
    TarGzip,
}

impl StructuredFormat {
    const fn archive_format(self) -> ArchiveFormat {
        match self {
            Self::Zip => ArchiveFormat::Zip,
            Self::TarGzip => ArchiveFormat::TarGzip,
        }
    }

    /// Returns the frozen archive-format label.
    pub const fn label(self) -> &'static str {
        self.archive_format().label()
    }
}

/// Structured archive scenario selected by a fuzz program.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProgramMode {
    /// A bounded archive containing only regular portable members.
    Canonical,
    /// One or two members exercising the portable path contract.
    PathContract,
    /// A nested-archive suffix or nested magic sequence.
    NestedArchive,
    /// A forbidden member type or a directory carrying bytes.
    MemberType,
    /// A proper prefix of a canonical archive.
    Truncation,
    /// One bit flipped in a canonical archive.
    BitFlip,
    /// Non-container bytes after an otherwise canonical archive.
    TrailingData,
    /// The bounded payload is passed directly to the sole parser.
    RawContainer,
}

impl ProgramMode {
    /// Returns the stable mode label used by corpus evidence.
    pub const fn label(self) -> &'static str {
        match self {
            Self::Canonical => "canonical",
            Self::PathContract => "path-contract",
            Self::NestedArchive => "nested-archive",
            Self::MemberType => "member-type",
            Self::Truncation => "truncation",
            Self::BitFlip => "bit-flip",
            Self::TrailingData => "trailing-data",
            Self::RawContainer => "raw-container",
        }
    }
}

/// One decoded version-one structured fuzz program.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FuzzProgram {
    format: StructuredFormat,
    mode: ProgramMode,
    payload: Vec<u8>,
}

impl FuzzProgram {
    /// Returns the selected archive format.
    pub const fn format(&self) -> StructuredFormat {
        self.format
    }

    /// Returns the selected structured scenario.
    pub const fn mode(&self) -> ProgramMode {
        self.mode
    }

    /// Returns the bounded generator instruction payload.
    pub fn payload(&self) -> &[u8] {
        &self.payload
    }
}

impl<'a> Arbitrary<'a> for FuzzProgram {
    fn arbitrary(input: &mut Unstructured<'a>) -> arbitrary::Result<Self> {
        let magic = input.bytes(INPUT_MAGIC.len())?;
        if magic != INPUT_MAGIC {
            return Err(ArbitraryError::IncorrectFormat);
        }
        let format = decode_format(u8::arbitrary(input)?);
        let mode = decode_mode(u8::arbitrary(input)?);
        let payload = input.bytes(input.len())?;
        if INPUT_MAGIC.len() + 2 + payload.len() > MAXIMUM_INPUT_BYTES {
            return Err(ArbitraryError::IncorrectFormat);
        }
        Ok(Self {
            format,
            mode,
            payload: payload.to_vec(),
        })
    }

    fn size_hint(depth: usize) -> (usize, Option<usize>) {
        let _ = depth;
        (INPUT_MAGIC.len() + 2, Some(MAXIMUM_INPUT_BYTES))
    }
}

/// Scanner outcome after all fuzz invariants have been checked.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ExerciseVerdict {
    /// Whole-archive admission succeeded.
    Admitted,
    /// Whole-archive admission rejected with one frozen profile code.
    Rejected(String),
}

impl ExerciseVerdict {
    /// Returns `admit` or the exact stable rejection code.
    pub fn label(&self) -> &str {
        match self {
            Self::Admitted => "admit",
            Self::Rejected(code) => code,
        }
    }
}

/// Bounded report returned by one structured fuzz execution.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExerciseReport {
    format: StructuredFormat,
    mode: ProgramMode,
    materialized_archive_bytes: usize,
    callback_count: usize,
    verdict: ExerciseVerdict,
}

impl ExerciseReport {
    /// Returns the selected format.
    pub const fn format(&self) -> StructuredFormat {
        self.format
    }

    /// Returns the selected mode.
    pub const fn mode(&self) -> ProgramMode {
        self.mode
    }

    /// Returns the exact compressed bytes presented to the parser.
    pub const fn materialized_archive_bytes(&self) -> usize {
        self.materialized_archive_bytes
    }

    /// Returns the number of post-admission callbacks.
    pub const fn callback_count(&self) -> usize {
        self.callback_count
    }

    /// Returns the scanner verdict after invariant validation.
    pub const fn verdict(&self) -> &ExerciseVerdict {
        &self.verdict
    }
}

#[derive(Clone, Debug)]
struct MemberSpec {
    name: String,
    content: Vec<u8>,
    kind: MemberKind,
}

#[derive(Clone, Copy, Debug)]
enum MemberKind {
    File(CompressionMethod),
    Directory,
    Symlink,
    HardLink,
    CharacterDevice,
    Fifo,
}

#[derive(Clone, Debug)]
struct MemberVisit {
    normalized_path: String,
    content_sha256: String,
    content: Vec<u8>,
}

/// Decodes one complete version-one corpus or fuzzer input.
pub fn decode_program(bytes: &[u8]) -> Result<FuzzProgram, ArbitraryError> {
    if bytes.len() > MAXIMUM_INPUT_BYTES {
        return Err(ArbitraryError::IncorrectFormat);
    }
    let mut input = Unstructured::new(bytes);
    FuzzProgram::arbitrary(&mut input)
}

/// Validates the frozen fuzz and archive profile identities.
pub fn validate_profile_identity() {
    assert_eq!(
        tinyrustlm_archive::ARCHIVE_ADMISSION_PROFILE_ID,
        "tinyrustlm.vnext.archive-admission.v1"
    );
    assert_eq!(
        tinyrustlm_archive::ARCHIVE_ADMISSION_PROFILE_SHA256,
        "05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031"
    );
    assert_eq!(
        hex_sha256(&sha256(ARCHIVE_FUZZ_PROFILE_BYTES)),
        ARCHIVE_FUZZ_PROFILE_SHA256
    );
}

/// Materializes and scans one program, panicking only when an invariant is
/// violated or the bounded in-memory writer itself fails.
pub fn exercise_program(program: &FuzzProgram) -> ExerciseReport {
    validate_profile_identity();
    let archive_bytes = materialize_archive(program);
    assert!(
        archive_bytes.len() <= MAXIMUM_MATERIALIZED_ARCHIVE_BYTES,
        "structured generator exceeded its frozen materialized-byte limit"
    );

    let format = program.format.archive_format();
    let mut visits = Vec::new();
    let result = scan_archive_bytes(format, &archive_bytes, |member, content| {
        let digest = hex_sha256(&sha256(content));
        assert_eq!(member.content_sha256(), digest);
        visits.push(MemberVisit {
            normalized_path: member.normalized_path().to_owned(),
            content_sha256: digest,
            content: content.to_vec(),
        });
    });

    let verdict = match result {
        Ok(admission) => {
            assert_eq!(admission.format(), format);
            assert!(!visits.is_empty(), "admission exposed no regular member");
            assert_eq!(
                admission.archive_sha256(),
                hex_sha256(&sha256(&archive_bytes))
            );
            assert_admission_matches_oracle(&admission, &visits);
            ExerciseVerdict::Admitted
        }
        Err(error) => {
            assert!(
                visits.is_empty(),
                "rejected archive invoked one or more consumer callbacks"
            );
            assert!(
                PROFILE_ERROR_CODES.contains(&error.code()),
                "parser emitted an error code outside the frozen profile: {}",
                error.code()
            );
            ExerciseVerdict::Rejected(error.code().to_owned())
        }
    };

    ExerciseReport {
        format: program.format,
        mode: program.mode,
        materialized_archive_bytes: archive_bytes.len(),
        callback_count: visits.len(),
        verdict,
    }
}

fn decode_format(selector: u8) -> StructuredFormat {
    match selector {
        b'Z' | b'z' => StructuredFormat::Zip,
        b'T' | b't' => StructuredFormat::TarGzip,
        value if value & 1 == 0 => StructuredFormat::Zip,
        _ => StructuredFormat::TarGzip,
    }
}

fn decode_mode(selector: u8) -> ProgramMode {
    match selector {
        b'V' | b'v' => ProgramMode::Canonical,
        b'P' | b'p' => ProgramMode::PathContract,
        b'N' | b'n' => ProgramMode::NestedArchive,
        b'M' | b'm' => ProgramMode::MemberType,
        b'X' | b'x' => ProgramMode::Truncation,
        b'B' | b'b' => ProgramMode::BitFlip,
        b'A' | b'a' => ProgramMode::TrailingData,
        b'R' | b'r' => ProgramMode::RawContainer,
        value => match value & 7 {
            0 => ProgramMode::Canonical,
            1 => ProgramMode::PathContract,
            2 => ProgramMode::NestedArchive,
            3 => ProgramMode::MemberType,
            4 => ProgramMode::Truncation,
            5 => ProgramMode::BitFlip,
            6 => ProgramMode::TrailingData,
            _ => ProgramMode::RawContainer,
        },
    }
}

fn materialize_archive(program: &FuzzProgram) -> Vec<u8> {
    if program.mode == ProgramMode::RawContainer {
        return program.payload.clone();
    }

    let mut members = generated_members(&program.payload);
    match program.mode {
        ProgramMode::Canonical
        | ProgramMode::Truncation
        | ProgramMode::BitFlip
        | ProgramMode::TrailingData => {}
        ProgramMode::PathContract => apply_path_case(&mut members, &program.payload),
        ProgramMode::NestedArchive => apply_nested_case(&mut members, &program.payload),
        ProgramMode::MemberType => apply_member_type_case(&mut members, &program.payload),
        ProgramMode::RawContainer => unreachable!("raw mode returned before generation"),
    }

    let mut archive = encode_archive(program.format, &members, program.mode, &program.payload);
    match program.mode {
        ProgramMode::Truncation => {
            if archive.len() > 1 {
                let selector = usize::from(payload_byte(&program.payload, 0));
                let length = 1 + selector % (archive.len() - 1);
                archive.truncate(length);
            }
        }
        ProgramMode::BitFlip => {
            if !archive.is_empty() {
                let offset = usize::from(payload_byte(&program.payload, 0)) % archive.len();
                let bit = payload_byte(&program.payload, 1) & 7;
                archive[offset] ^= 1 << bit;
            }
        }
        ProgramMode::TrailingData => {
            if program.format == StructuredFormat::TarGzip
                && payload_byte(&program.payload, 0) == b'C'
            {
                let second = archive.clone();
                archive.extend_from_slice(&second);
            } else {
                archive.extend_from_slice(b"\xaa\x55");
            }
        }
        _ => {}
    }
    archive
}

fn generated_members(payload: &[u8]) -> Vec<MemberSpec> {
    let count = 1 + usize::from(payload_byte(payload, 0)) % MAXIMUM_GENERATED_MEMBERS;
    (0..count)
        .map(|index| {
            let selector = payload_byte(payload, index + 1);
            let length =
                1 + usize::from(payload_byte(payload, index + MAXIMUM_GENERATED_MEMBERS + 1))
                    % MAXIMUM_GENERATED_MEMBER_BYTES;
            let content = (0..length)
                .map(|offset| payload_byte(payload, index * 17 + offset + 9) ^ index as u8)
                .collect();
            MemberSpec {
                name: format!("d{index:02}/f{selector:02x}.txt"),
                content,
                kind: MemberKind::File(if selector & 1 == 0 {
                    CompressionMethod::Stored
                } else {
                    CompressionMethod::Deflated
                }),
            }
        })
        .collect()
}

fn apply_path_case(members: &mut Vec<MemberSpec>, payload: &[u8]) {
    let selector = payload_byte(payload, 0);
    if matches!(selector, b'D' | b'd') {
        members.clear();
        members.push(file_member("Case.txt", b"first"));
        members.push(file_member("case.TXT", b"second"));
        return;
    }
    members.truncate(1);
    members[0].name = match selector {
        b'A' | b'a' => "/absolute.txt",
        b'T' | b't' => "../escape.txt",
        b'B' | b'b' => "dir\\file.txt",
        b'R' | b'r' => "CON.txt",
        b'S' | b's' => "file.txt:stream",
        b'P' | b'p' => "trailing./file.txt",
        b'E' | b'e' => "dir//file.txt",
        _ => "dir/./file.txt",
    }
    .to_owned();
}

fn apply_nested_case(members: &mut Vec<MemberSpec>, payload: &[u8]) {
    members.truncate(1);
    if matches!(payload_byte(payload, 0), b'M' | b'm') {
        members[0].name = "payload.bin".to_owned();
        members[0].content = b"PK\x03\x04nested".to_vec();
    } else {
        members[0].name = "nested.zip".to_owned();
    }
}

fn apply_member_type_case(members: &mut Vec<MemberSpec>, payload: &[u8]) {
    members.truncate(1);
    members[0].content.clear();
    members[0].kind = match payload_byte(payload, 0) {
        b'D' | b'd' => {
            members[0].name = "directory/".to_owned();
            members[0].content.push(b'x');
            MemberKind::Directory
        }
        b'H' | b'h' => MemberKind::HardLink,
        b'C' | b'c' => MemberKind::CharacterDevice,
        b'F' | b'f' => MemberKind::Fifo,
        _ => MemberKind::Symlink,
    };
}

fn file_member(name: &str, content: &[u8]) -> MemberSpec {
    MemberSpec {
        name: name.to_owned(),
        content: content.to_vec(),
        kind: MemberKind::File(CompressionMethod::Stored),
    }
}

fn encode_archive(
    format: StructuredFormat,
    members: &[MemberSpec],
    mode: ProgramMode,
    payload: &[u8],
) -> Vec<u8> {
    match format {
        StructuredFormat::Zip => encode_zip(members, mode, payload),
        StructuredFormat::TarGzip => encode_tar_gzip(members),
    }
}

fn encode_zip(members: &[MemberSpec], mode: ProgramMode, payload: &[u8]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    if mode == ProgramMode::MemberType && matches!(payload_byte(payload, 0), b'C' | b'c') {
        writer.set_comment("fuzz-comment");
    }
    for member in members {
        let options = SimpleFileOptions::default();
        match member.kind {
            MemberKind::File(method) => {
                writer
                    .start_file(&member.name, options.compression_method(method))
                    .expect("bounded in-memory ZIP member must start");
                writer
                    .write_all(&member.content)
                    .expect("bounded in-memory ZIP member must write");
            }
            MemberKind::Directory => writer
                .add_directory(&member.name, options)
                .expect("bounded in-memory ZIP directory must write"),
            MemberKind::Symlink | MemberKind::HardLink | MemberKind::Fifo => writer
                .add_symlink(&member.name, "target.txt", options)
                .expect("bounded in-memory ZIP link must write"),
            MemberKind::CharacterDevice => {
                writer
                    .start_file(&member.name, options)
                    .expect("bounded in-memory ZIP member must start");
            }
        }
    }
    writer
        .finish()
        .expect("bounded in-memory ZIP must finish")
        .into_inner()
}

fn encode_tar_gzip(members: &[MemberSpec]) -> Vec<u8> {
    let mut tar = Vec::new();
    for member in members {
        append_tar_member(&mut tar, member);
    }
    tar.resize(tar.len() + 1_024, 0);
    let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
    encoder
        .write_all(&tar)
        .expect("bounded in-memory gzip stream must write");
    encoder
        .finish()
        .expect("bounded in-memory gzip stream must finish")
}

fn append_tar_member(output: &mut Vec<u8>, member: &MemberSpec) {
    let name = member.name.as_bytes();
    assert!(
        name.len() <= 100,
        "fuzz-generated tar path exceeded ustar name field"
    );
    let mut header = [0_u8; 512];
    header[..name.len()].copy_from_slice(name);
    write_octal(&mut header[100..108], 0o644);
    write_octal(&mut header[108..116], 0);
    write_octal(&mut header[116..124], 0);
    write_octal(&mut header[124..136], member.content.len() as u64);
    write_octal(&mut header[136..148], 0);
    header[148..156].fill(b' ');
    header[156] = match member.kind {
        MemberKind::File(_) => b'0',
        MemberKind::HardLink => b'1',
        MemberKind::Symlink => b'2',
        MemberKind::CharacterDevice => b'3',
        MemberKind::Directory => b'5',
        MemberKind::Fifo => b'6',
    };
    if matches!(member.kind, MemberKind::HardLink | MemberKind::Symlink) {
        header[157..167].copy_from_slice(b"target.txt");
    }
    header[257..263].copy_from_slice(b"ustar\0");
    header[263..265].copy_from_slice(b"00");
    let checksum = header.iter().map(|byte| u64::from(*byte)).sum::<u64>();
    let encoded_checksum = format!("{checksum:06o}\0 ");
    header[148..156].copy_from_slice(encoded_checksum.as_bytes());
    output.extend_from_slice(&header);
    output.extend_from_slice(&member.content);
    let padding = (512 - member.content.len() % 512) % 512;
    output.resize(output.len() + padding, 0);
}

fn write_octal(field: &mut [u8], value: u64) {
    field.fill(0);
    let digits = format!("{value:0width$o}", width = field.len() - 1);
    assert!(digits.len() < field.len());
    field[..digits.len()].copy_from_slice(digits.as_bytes());
}

fn payload_byte(payload: &[u8], index: usize) -> u8 {
    payload
        .get(index % payload.len().max(1))
        .copied()
        .unwrap_or_else(|| (index as u8).wrapping_mul(73).wrapping_add(19))
}

fn assert_admission_matches_oracle(
    admission: &tinyrustlm_archive::ArchiveAdmission,
    visits: &[MemberVisit],
) {
    let mut sorted = visits.to_vec();
    sorted.sort_by(|left, right| left.normalized_path.cmp(&right.normalized_path));
    let unique = sorted
        .iter()
        .map(|visit| visit.normalized_path.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(unique.len(), sorted.len());
    assert_eq!(admission.members().len(), sorted.len());

    let mut manifest = Sha256::new();
    manifest.update(CONTENT_MANIFEST_DOMAIN);
    manifest.update((sorted.len() as u64).to_be_bytes());
    let mut total = 0_u64;
    for (visit, evidence) in sorted.iter().zip(admission.members()) {
        let mut path_hasher = Sha256::new();
        path_hasher.update(PATH_IDENTITY_DOMAIN);
        path_hasher.update(visit.normalized_path.as_bytes());
        let path_digest: [u8; 32] = path_hasher.finalize().into();
        let content_digest = sha256(&visit.content);
        let length = visit.content.len() as u64;
        assert_eq!(evidence.path_identity_sha256(), hex_sha256(&path_digest));
        assert_eq!(evidence.content_sha256(), visit.content_sha256);
        assert_eq!(evidence.content_sha256(), hex_sha256(&content_digest));
        assert_eq!(evidence.uncompressed_bytes(), length);
        manifest.update(path_digest);
        manifest.update(content_digest);
        manifest.update(length.to_be_bytes());
        total = total
            .checked_add(length)
            .expect("bounded oracle total overflow");
    }
    let manifest_digest: [u8; 32] = manifest.finalize().into();
    assert_eq!(
        admission.content_manifest_sha256(),
        hex_sha256(&manifest_digest)
    );
    assert_eq!(admission.total_uncompressed_bytes(), total);
}

/// Computes SHA-256 for replay and manifest verification.
pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

/// Encodes a digest as lowercase hexadecimal.
pub fn hex_sha256(digest: &[u8; 32]) -> String {
    let mut output = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write as _;
        write!(&mut output, "{byte:02x}").expect("writing to a String cannot fail");
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_rejects_unknown_magic_and_oversized_inputs() {
        assert!(decode_program(b"NOPEZV").is_err());
        assert!(decode_program(&vec![0_u8; MAXIMUM_INPUT_BYTES + 1]).is_err());
    }

    #[test]
    fn canonical_programs_admit_both_formats() {
        for bytes in [b"TAF1ZVseed".as_slice(), b"TAF1TVseed".as_slice()] {
            let program = decode_program(bytes).expect("canonical seed must decode");
            let report = exercise_program(&program);
            assert_eq!(report.verdict(), &ExerciseVerdict::Admitted);
            assert!(report.callback_count() > 0);
        }
    }

    #[test]
    fn hostile_programs_reject_before_callbacks() {
        for bytes in [b"TAF1ZPT".as_slice(), b"TAF1TMH".as_slice()] {
            let program = decode_program(bytes).expect("hostile seed must decode");
            let report = exercise_program(&program);
            assert!(matches!(report.verdict(), ExerciseVerdict::Rejected(_)));
            assert_eq!(report.callback_count(), 0);
        }
    }
}
