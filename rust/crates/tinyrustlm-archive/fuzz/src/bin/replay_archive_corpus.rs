#![forbid(unsafe_code)]

//! Stable-toolchain replay for the versioned structured archive corpus.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::env;
use std::error::Error;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use tinyrustlm_archive_fuzz::{
    decode_program, exercise_program, hex_sha256, sha256, validate_profile_identity,
    ARCHIVE_FUZZ_PROFILE_ID, ARCHIVE_FUZZ_PROFILE_SHA256, MAXIMUM_INPUT_BYTES,
};

const CORPUS_SCHEMA: &str = "tinyrustlm.vnext.archive_fuzz_corpus.v1";
const CORPUS_ID: &str = "tinyrustlm.vnext.archive-fuzz-corpus.v1";
const ARCHIVE_PROFILE_ID: &str = "tinyrustlm.vnext.archive-admission.v1";
const ARCHIVE_PROFILE_SHA256: &str =
    "05158f80e01817e31a2968bc4e2f9d1bb05fe53064384563f6546a5468046031";
const MAXIMUM_MANIFEST_BYTES: u64 = 131_072;
const MAXIMUM_CORPUS_ENTRIES: usize = 256;

type DynError = Box<dyn Error>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusManifest {
    schema: String,
    corpus_id: String,
    status: String,
    fuzz_profile_id: String,
    fuzz_profile_sha256: String,
    archive_profile_id: String,
    archive_profile_sha256: String,
    entries: Vec<CorpusEntry>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusEntry {
    id: String,
    file: String,
    bytes: u64,
    sha256: String,
    format: String,
    mode: String,
    verdict: String,
    callback_count: usize,
    materialized_archive_bytes: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReplaySummary<'a> {
    schema: &'a str,
    corpus_id: &'a str,
    status: &'a str,
    entries: usize,
    admitted: usize,
    rejected: usize,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("archive corpus replay failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), DynError> {
    validate_profile_identity();
    let arguments = env::args_os().skip(1).collect::<Vec<_>>();
    if arguments.len() == 2 && arguments[0] == OsStr::new("--observe-corpus") {
        return observe_corpus(Path::new(&arguments[1]));
    }
    let manifest_path = parse_manifest_path(&arguments)?;
    let summary = replay_manifest(&manifest_path)?;
    println!("{}", serde_json::to_string(&summary)?);
    Ok(())
}

fn replay_manifest(manifest_path: &Path) -> Result<ReplaySummary<'static>, DynError> {
    validate_profile_identity();
    let manifest_parent = manifest_path
        .parent()
        .ok_or_else(|| invalid("corpus manifest must have a parent directory"))?;
    reject_symlink(manifest_path, "corpus manifest")?;
    let manifest_metadata = fs::metadata(manifest_path)?;
    if !manifest_metadata.is_file() {
        return Err(invalid("corpus manifest is not a regular file"));
    }
    if manifest_metadata.len() == 0 || manifest_metadata.len() > MAXIMUM_MANIFEST_BYTES {
        return Err(invalid(format!(
            "corpus manifest byte length {} is outside 1..={MAXIMUM_MANIFEST_BYTES}",
            manifest_metadata.len()
        )));
    }
    let manifest_bytes = fs::read(manifest_path)?;
    let manifest: CorpusManifest = serde_json::from_slice(&manifest_bytes)?;
    validate_manifest_header(&manifest)?;
    validate_entry_order_and_identity(&manifest.entries)?;
    validate_exact_seed_set(manifest_parent, &manifest.entries)?;

    let canonical_parent = fs::canonicalize(manifest_parent)?;
    let mut admitted = 0_usize;
    let mut rejected = 0_usize;
    for entry in &manifest.entries {
        let seed_path = resolve_seed_path(manifest_parent, &canonical_parent, &entry.file)?;
        let seed_metadata = fs::metadata(&seed_path)?;
        if !seed_metadata.is_file() {
            return Err(invalid(format!(
                "seed {} is not a regular file",
                entry.file
            )));
        }
        if seed_metadata.len() != entry.bytes || entry.bytes > MAXIMUM_INPUT_BYTES as u64 {
            return Err(invalid(format!(
                "seed {} byte length does not match its bounded manifest entry",
                entry.file
            )));
        }
        let bytes = fs::read(&seed_path)?;
        if hex_sha256(&sha256(&bytes)) != entry.sha256 {
            return Err(invalid(format!("seed {} SHA-256 mismatch", entry.file)));
        }
        let program = decode_program(&bytes)
            .map_err(|_| invalid(format!("seed {} does not decode as TAF1", entry.file)))?;
        if program.format().label() != entry.format || program.mode().label() != entry.mode {
            return Err(invalid(format!(
                "seed {} decoded format or mode differs from its manifest entry",
                entry.file
            )));
        }
        let report = exercise_program(&program);
        if report.verdict().label() != entry.verdict
            || report.callback_count() != entry.callback_count
            || report.materialized_archive_bytes() != entry.materialized_archive_bytes
        {
            return Err(invalid(format!(
                "seed {} verdict mismatch: observed verdict={}, callbacks={}, materializedBytes={}",
                entry.file,
                report.verdict().label(),
                report.callback_count(),
                report.materialized_archive_bytes()
            )));
        }
        if report.verdict().label() == "admit" {
            admitted += 1;
        } else {
            rejected += 1;
        }
    }

    Ok(ReplaySummary {
        schema: CORPUS_SCHEMA,
        corpus_id: CORPUS_ID,
        status: "pass",
        entries: manifest.entries.len(),
        admitted,
        rejected,
    })
}

fn parse_manifest_path(arguments: &[std::ffi::OsString]) -> Result<PathBuf, DynError> {
    match arguments {
        [] => Ok(Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("corpus")
            .join("structured_archive")
            .join("manifest.v1.json")),
        [flag, path] if flag == OsStr::new("--manifest") => Ok(PathBuf::from(path)),
        _ => Err(invalid(
            "usage: replay_archive_corpus [--manifest <manifest.v1.json> | --observe-corpus <directory>]",
        )),
    }
}

fn observe_corpus(parent: &Path) -> Result<(), DynError> {
    let metadata = fs::metadata(parent)?;
    if !metadata.is_dir() {
        return Err(invalid("observed corpus path is not a directory"));
    }
    reject_symlink(parent, "observed corpus directory")?;
    let canonical_parent = fs::canonicalize(parent)?;
    let mut paths = fs::read_dir(parent)?
        .map(|entry| entry.map(|value| value.path()))
        .collect::<Result<Vec<_>, _>>()?;
    paths.retain(|path| path.extension() == Some(OsStr::new("seed")));
    paths.sort();
    if paths.is_empty() || paths.len() > MAXIMUM_CORPUS_ENTRIES {
        return Err(invalid(format!(
            "observed corpus seed count must be within 1..={MAXIMUM_CORPUS_ENTRIES}"
        )));
    }

    let mut entries = Vec::with_capacity(paths.len());
    for path in paths {
        let file = path
            .file_name()
            .and_then(OsStr::to_str)
            .ok_or_else(|| invalid("observed corpus filename is not UTF-8"))?;
        let verified_path = resolve_seed_path(parent, &canonical_parent, file)?;
        let bytes = fs::read(&verified_path)?;
        if bytes.is_empty() || bytes.len() > MAXIMUM_INPUT_BYTES {
            return Err(invalid(format!(
                "observed seed {file} byte length is outside 1..={MAXIMUM_INPUT_BYTES}"
            )));
        }
        let program = decode_program(&bytes)
            .map_err(|_| invalid(format!("observed seed {file} does not decode as TAF1")))?;
        let report = exercise_program(&program);
        let id = file
            .strip_suffix(".seed")
            .ok_or_else(|| invalid("observed corpus file lacks .seed suffix"))?
            .to_owned();
        entries.push(CorpusEntry {
            id,
            file: file.to_owned(),
            bytes: bytes.len() as u64,
            sha256: hex_sha256(&sha256(&bytes)),
            format: program.format().label().to_owned(),
            mode: program.mode().label().to_owned(),
            verdict: report.verdict().label().to_owned(),
            callback_count: report.callback_count(),
            materialized_archive_bytes: report.materialized_archive_bytes(),
        });
    }
    println!("{}", serde_json::to_string_pretty(&entries)?);
    Ok(())
}

fn validate_manifest_header(manifest: &CorpusManifest) -> Result<(), DynError> {
    let exact = [
        ("schema", manifest.schema.as_str(), CORPUS_SCHEMA),
        ("corpusId", manifest.corpus_id.as_str(), CORPUS_ID),
        ("status", manifest.status.as_str(), "frozen"),
        (
            "fuzzProfileId",
            manifest.fuzz_profile_id.as_str(),
            ARCHIVE_FUZZ_PROFILE_ID,
        ),
        (
            "fuzzProfileSha256",
            manifest.fuzz_profile_sha256.as_str(),
            ARCHIVE_FUZZ_PROFILE_SHA256,
        ),
        (
            "archiveProfileId",
            manifest.archive_profile_id.as_str(),
            ARCHIVE_PROFILE_ID,
        ),
        (
            "archiveProfileSha256",
            manifest.archive_profile_sha256.as_str(),
            ARCHIVE_PROFILE_SHA256,
        ),
    ];
    for (field, actual, expected) in exact {
        if actual != expected {
            return Err(invalid(format!(
                "corpus manifest {field} must be exact {expected}"
            )));
        }
    }
    if manifest.entries.is_empty() || manifest.entries.len() > MAXIMUM_CORPUS_ENTRIES {
        return Err(invalid(format!(
            "corpus entry count must be within 1..={MAXIMUM_CORPUS_ENTRIES}"
        )));
    }
    Ok(())
}

fn validate_entry_order_and_identity(entries: &[CorpusEntry]) -> Result<(), DynError> {
    let mut ids = BTreeSet::new();
    let mut files = BTreeSet::new();
    let mut hashes = BTreeSet::new();
    let mut previous_id: Option<&str> = None;
    for entry in entries {
        if entry.id.is_empty()
            || !entry
                .id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(invalid(format!(
                "corpus entry ID {} is noncanonical",
                entry.id
            )));
        }
        if previous_id.is_some_and(|previous| previous >= entry.id.as_str()) {
            return Err(invalid("corpus entries must be strictly sorted by ID"));
        }
        previous_id = Some(&entry.id);
        if !ids.insert(entry.id.as_str())
            || !files.insert(entry.file.as_str())
            || !hashes.insert(entry.sha256.as_str())
        {
            return Err(invalid(
                "corpus entry IDs, files, and hashes must be unique",
            ));
        }
        if entry.sha256.len() != 64
            || !entry
                .sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(invalid(format!(
                "corpus entry {} has a noncanonical SHA-256",
                entry.id
            )));
        }
    }
    Ok(())
}

fn validate_exact_seed_set(parent: &Path, entries: &[CorpusEntry]) -> Result<(), DynError> {
    let expected = entries
        .iter()
        .map(|entry| entry.file.as_str())
        .collect::<BTreeSet<_>>();
    let mut actual = BTreeSet::new();
    for directory_entry in fs::read_dir(parent)? {
        let directory_entry = directory_entry?;
        if directory_entry.path().extension() == Some(OsStr::new("seed")) {
            let name = directory_entry
                .file_name()
                .into_string()
                .map_err(|_| invalid("corpus seed filename is not UTF-8"))?;
            actual.insert(name);
        }
    }
    if actual.iter().map(String::as_str).collect::<BTreeSet<_>>() != expected {
        return Err(invalid(
            "manifest seed list does not exactly match the corpus directory",
        ));
    }
    Ok(())
}

fn resolve_seed_path(
    parent: &Path,
    canonical_parent: &Path,
    file: &str,
) -> Result<PathBuf, DynError> {
    let relative = Path::new(file);
    let components = relative.components().collect::<Vec<_>>();
    if components.len() != 1 || !matches!(components[0], Component::Normal(_)) {
        return Err(invalid(format!(
            "seed path {file} must be one relative filename"
        )));
    }
    if relative.extension() != Some(OsStr::new("seed")) || !file.is_ascii() {
        return Err(invalid(format!("seed path {file} is noncanonical")));
    }
    let path = parent.join(relative);
    reject_symlink(&path, "corpus seed")?;
    let canonical = fs::canonicalize(&path)?;
    if canonical.parent() != Some(canonical_parent) {
        return Err(invalid(format!(
            "seed path {file} escapes the corpus directory"
        )));
    }
    Ok(path)
}

fn reject_symlink(path: &Path, label: &str) -> Result<(), DynError> {
    if fs::symlink_metadata(path)?.file_type().is_symlink() {
        return Err(invalid(format!("{label} must not be a symbolic link")));
    }
    Ok(())
}

fn invalid(message: impl Into<String>) -> DynError {
    Box::new(io::Error::new(io::ErrorKind::InvalidData, message.into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    struct TempCorpus {
        root: PathBuf,
    }

    impl TempCorpus {
        fn copy(label: &str) -> Self {
            let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let root = env::temp_dir().join(format!(
                "tinyrustlm-archive-fuzz-{label}-{}-{sequence}",
                std::process::id()
            ));
            fs::create_dir(&root).expect("unique temporary corpus must be created");
            for entry in fs::read_dir(checked_in_corpus_directory())
                .expect("checked-in corpus directory must be readable")
            {
                let entry = entry.expect("checked-in corpus entry must be readable");
                if entry.path().extension() == Some(OsStr::new("seed"))
                    || entry.file_name() == OsStr::new("manifest.v1.json")
                {
                    fs::copy(entry.path(), root.join(entry.file_name()))
                        .expect("temporary corpus file must copy");
                }
            }
            Self { root }
        }

        fn manifest(&self) -> PathBuf {
            self.root.join("manifest.v1.json")
        }
    }

    impl Drop for TempCorpus {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.root).expect("owned temporary corpus must be removed");
        }
    }

    fn checked_in_corpus_directory() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("corpus")
            .join("structured_archive")
    }

    fn entry(id: &str, hash_byte: char) -> CorpusEntry {
        CorpusEntry {
            id: id.to_owned(),
            file: format!("{id}.seed"),
            bytes: 8,
            sha256: hash_byte.to_string().repeat(64),
            format: "zip".to_owned(),
            mode: "canonical".to_owned(),
            verdict: "admit".to_owned(),
            callback_count: 1,
            materialized_archive_bytes: 100,
        }
    }

    fn manifest(entries: Vec<CorpusEntry>) -> CorpusManifest {
        CorpusManifest {
            schema: CORPUS_SCHEMA.to_owned(),
            corpus_id: CORPUS_ID.to_owned(),
            status: "frozen".to_owned(),
            fuzz_profile_id: ARCHIVE_FUZZ_PROFILE_ID.to_owned(),
            fuzz_profile_sha256: ARCHIVE_FUZZ_PROFILE_SHA256.to_owned(),
            archive_profile_id: ARCHIVE_PROFILE_ID.to_owned(),
            archive_profile_sha256: ARCHIVE_PROFILE_SHA256.to_owned(),
            entries,
        }
    }

    #[test]
    fn exact_manifest_header_is_required() {
        let valid = manifest(vec![entry("01-first", 'a')]);
        assert!(validate_manifest_header(&valid).is_ok());
        let mut wrong_status = valid;
        wrong_status.status = "draft".to_owned();
        assert!(validate_manifest_header(&wrong_status).is_err());
    }

    #[test]
    fn entry_order_and_identity_are_strict() {
        let sorted = vec![entry("01-first", 'a'), entry("02-second", 'b')];
        assert!(validate_entry_order_and_identity(&sorted).is_ok());

        let unsorted = vec![entry("02-second", 'b'), entry("01-first", 'a')];
        assert!(validate_entry_order_and_identity(&unsorted).is_err());

        let duplicate_hash = vec![entry("01-first", 'a'), entry("02-second", 'a')];
        assert!(validate_entry_order_and_identity(&duplicate_hash).is_err());

        let noncanonical = vec![entry("Uppercase", 'a')];
        assert!(validate_entry_order_and_identity(&noncanonical).is_err());
    }

    #[test]
    fn command_line_accepts_only_the_exact_manifest_shape() {
        assert!(parse_manifest_path(&[]).is_ok());
        let explicit = [
            OsString::from("--manifest"),
            OsString::from("manifest.v1.json"),
        ];
        assert_eq!(
            parse_manifest_path(&explicit).expect("exact manifest arguments must parse"),
            PathBuf::from("manifest.v1.json")
        );
        assert!(parse_manifest_path(&[OsString::from("--manifest")]).is_err());
        assert!(parse_manifest_path(&[OsString::from("--unknown")]).is_err());
    }

    #[test]
    fn checked_in_manifest_replays_exactly() {
        let summary = replay_manifest(&checked_in_corpus_directory().join("manifest.v1.json"))
            .expect("checked-in corpus must replay");
        assert_eq!(summary.entries, 29);
        assert_eq!(summary.admitted, 2);
        assert_eq!(summary.rejected, 27);
    }

    #[test]
    fn seed_hash_drift_fails_closed() {
        let corpus = TempCorpus::copy("hash-drift");
        let mut seed = fs::OpenOptions::new()
            .append(true)
            .open(corpus.root.join("01-canonical-zip.seed"))
            .expect("temporary seed must open");
        seed.write_all(b"drift")
            .expect("temporary seed must mutate");
        assert!(replay_manifest(&corpus.manifest()).is_err());
    }

    #[test]
    fn unlisted_seed_fails_closed() {
        let corpus = TempCorpus::copy("unlisted-seed");
        fs::write(corpus.root.join("unlisted.seed"), b"TAF1ZVextra")
            .expect("temporary unlisted seed must write");
        assert!(replay_manifest(&corpus.manifest()).is_err());
    }
}
