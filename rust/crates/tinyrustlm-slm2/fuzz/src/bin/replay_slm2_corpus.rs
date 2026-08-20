#![forbid(unsafe_code)]

//! Stable-toolchain replay for the versioned raw SLM2 parser corpus.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::env;
use std::error::Error;
use std::ffi::{OsStr, OsString};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use tinyrustlm_slm2_fuzz::{
    exercise_bytes, hex_sha256, sha256, validate_profile_identity, ExerciseVerdict,
    CORPUS_MANIFEST_SCHEMA, MAXIMUM_CORPUS_ENTRIES, MAXIMUM_CORPUS_MANIFEST_BYTES,
    MAXIMUM_INPUT_BYTES, SLM2_FUZZ_PROFILE_ID, SLM2_FUZZ_PROFILE_SHA256,
};

const CORPUS_ID: &str = "tinyrustlm.vnext.slm2-fuzz-corpus.v1";
const FORMAT_PROFILE_ID: &str = "org.minimodel.slm2/2.0";
const FORMAT_PROFILE_SHA256: &str =
    "f272caf64cacb7a4705fee0c958f15ee0cac3985d8728458a80f812913d66554";
const SOURCE_VECTOR_ID: &str = "base-model-two-f32-tensors";
const SOURCE_VECTOR_ARTIFACT_SHA256: &str =
    "14ad14add8c8205e29040307eb42a4c749fb161fe7105e1de2bcbfc032ca81c4";

type DynError = Box<dyn Error>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusManifest {
    schema: String,
    corpus_id: String,
    status: String,
    generator_id: String,
    fuzz_profile_id: String,
    fuzz_profile_sha256: String,
    format_profile_id: String,
    format_profile_sha256: String,
    source_vector_id: String,
    source_vector_artifact_sha256: String,
    entries: Vec<CorpusEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusEntry {
    id: String,
    file: String,
    bytes: u64,
    sha256: String,
    class: String,
    verdict: String,
    error_code: Option<String>,
    tensor_count: Option<usize>,
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
        eprintln!("SLM2 corpus replay failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), DynError> {
    validate_profile_identity();
    let arguments = env::args_os().skip(1).collect::<Vec<_>>();
    let manifest_path = parse_manifest_path(&arguments)?;
    let summary = replay_manifest(&manifest_path)?;
    println!("{}", serde_json::to_string(&summary)?);
    Ok(())
}

fn parse_manifest_path(arguments: &[OsString]) -> Result<PathBuf, DynError> {
    match arguments {
        [] => Ok(Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("corpus")
            .join("raw_slm2")
            .join("manifest.v1.json")),
        [flag, path] if flag == OsStr::new("--manifest") => Ok(PathBuf::from(path)),
        _ => Err(invalid(
            "usage: replay_slm2_corpus [--manifest <manifest.v1.json>]",
        )),
    }
}

fn replay_manifest(manifest_path: &Path) -> Result<ReplaySummary<'static>, DynError> {
    validate_profile_identity();
    let parent = manifest_path
        .parent()
        .ok_or_else(|| invalid("corpus manifest must have a parent directory"))?;
    reject_symlink(parent, "corpus directory")?;
    reject_symlink(manifest_path, "corpus manifest")?;
    let metadata = fs::metadata(manifest_path)?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAXIMUM_CORPUS_MANIFEST_BYTES
    {
        return Err(invalid("corpus manifest is not one bounded regular file"));
    }
    let manifest: CorpusManifest = serde_json::from_slice(&fs::read(manifest_path)?)?;
    validate_manifest_header(&manifest)?;
    validate_entry_order_and_identity(&manifest.entries)?;
    validate_exact_seed_set(parent, &manifest.entries)?;

    let canonical_parent = fs::canonicalize(parent)?;
    let mut admitted = 0_usize;
    let mut rejected = 0_usize;
    for entry in &manifest.entries {
        let seed_path = resolve_seed_path(parent, &canonical_parent, &entry.file)?;
        let seed_metadata = fs::metadata(&seed_path)?;
        if !seed_metadata.is_file()
            || seed_metadata.len() != entry.bytes
            || entry.bytes > MAXIMUM_INPUT_BYTES as u64
        {
            return Err(invalid(format!(
                "seed {} does not match its bounded byte count",
                entry.file
            )));
        }
        let bytes = fs::read(seed_path)?;
        if hex_sha256(&sha256(&bytes)) != entry.sha256 {
            return Err(invalid(format!("seed {} SHA-256 mismatch", entry.file)));
        }
        let report = exercise_bytes(&bytes);
        if report.input_bytes() as u64 != entry.bytes || report.input_sha256() != entry.sha256 {
            return Err(invalid(format!(
                "seed {} report identity mismatch",
                entry.file
            )));
        }
        let (verdict, error_code) = match report.verdict() {
            ExerciseVerdict::Admitted => {
                admitted += 1;
                ("admit", None)
            }
            ExerciseVerdict::Rejected(code) => {
                rejected += 1;
                ("reject", Some(code.as_str()))
            }
        };
        if verdict != entry.verdict
            || error_code != entry.error_code.as_deref()
            || report.tensor_count() != entry.tensor_count
        {
            return Err(invalid(format!(
                "seed {} verdict mismatch: observed verdict={verdict}, errorCode={error_code:?}, tensorCount={:?}",
                entry.file,
                report.tensor_count()
            )));
        }
    }
    Ok(ReplaySummary {
        schema: CORPUS_MANIFEST_SCHEMA,
        corpus_id: CORPUS_ID,
        status: "pass",
        entries: manifest.entries.len(),
        admitted,
        rejected,
    })
}

fn validate_manifest_header(manifest: &CorpusManifest) -> Result<(), DynError> {
    let exact = [
        ("schema", manifest.schema.as_str(), CORPUS_MANIFEST_SCHEMA),
        ("corpusId", manifest.corpus_id.as_str(), CORPUS_ID),
        ("status", manifest.status.as_str(), "frozen"),
        (
            "generatorId",
            manifest.generator_id.as_str(),
            "tinyrustlm.tools.generate-slm2-fuzz-corpus.v1",
        ),
        (
            "fuzzProfileId",
            manifest.fuzz_profile_id.as_str(),
            SLM2_FUZZ_PROFILE_ID,
        ),
        (
            "fuzzProfileSha256",
            manifest.fuzz_profile_sha256.as_str(),
            SLM2_FUZZ_PROFILE_SHA256,
        ),
        (
            "formatProfileId",
            manifest.format_profile_id.as_str(),
            FORMAT_PROFILE_ID,
        ),
        (
            "formatProfileSha256",
            manifest.format_profile_sha256.as_str(),
            FORMAT_PROFILE_SHA256,
        ),
        (
            "sourceVectorId",
            manifest.source_vector_id.as_str(),
            SOURCE_VECTOR_ID,
        ),
        (
            "sourceVectorArtifactSha256",
            manifest.source_vector_artifact_sha256.as_str(),
            SOURCE_VECTOR_ARTIFACT_SHA256,
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
    let mut prior: Option<&str> = None;
    for entry in entries {
        if entry.id.is_empty()
            || !entry
                .id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
            || prior.is_some_and(|value| value >= entry.id.as_str())
            || !ids.insert(entry.id.as_str())
            || !files.insert(entry.file.as_str())
            || !hashes.insert(entry.sha256.as_str())
        {
            return Err(invalid("corpus entry order or identity is noncanonical"));
        }
        prior = Some(&entry.id);
        if entry.sha256.len() != 64
            || !entry
                .sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || entry.class.is_empty()
            || !matches!(entry.verdict.as_str(), "admit" | "reject")
            || (entry.verdict == "admit") != entry.error_code.is_none()
            || (entry.verdict == "admit") != entry.tensor_count.is_some()
        {
            return Err(invalid(format!(
                "corpus entry {} has invalid bounded evidence",
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
            actual.insert(
                directory_entry
                    .file_name()
                    .into_string()
                    .map_err(|_| invalid("corpus seed filename is not UTF-8"))?,
            );
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
    if components.len() != 1
        || !matches!(components[0], Component::Normal(_))
        || relative.extension() != Some(OsStr::new("seed"))
        || !file.is_ascii()
    {
        return Err(invalid(format!(
            "seed path {file} must be one canonical relative filename"
        )));
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
    use serde_json::Value;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);

    struct FixtureDirectory(PathBuf);

    impl FixtureDirectory {
        fn manifest(&self) -> PathBuf {
            self.0.join("manifest.v1.json")
        }
    }

    impl Drop for FixtureDirectory {
        fn drop(&mut self) {
            let temp = env::temp_dir();
            let owned_name = self
                .0
                .file_name()
                .and_then(OsStr::to_str)
                .is_some_and(|name| name.starts_with("tinyrustlm-slm2-replay-test-"));
            assert_eq!(self.0.parent(), Some(temp.as_path()));
            assert!(owned_name);
            match fs::remove_dir_all(&self.0) {
                Ok(()) => {}
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                Err(error) => panic!("failed to remove owned replay fixture: {error}"),
            }
        }
    }

    fn copy_frozen_corpus() -> FixtureDirectory {
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("corpus")
            .join("raw_slm2");
        let unique = NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed);
        let target = env::temp_dir().join(format!(
            "tinyrustlm-slm2-replay-test-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&target).unwrap();
        for entry in fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_file() {
                fs::copy(entry.path(), target.join(entry.file_name())).unwrap();
            }
        }
        FixtureDirectory(target)
    }

    fn mutate_manifest(fixture: &FixtureDirectory, mutate: impl FnOnce(&mut Value)) {
        let path = fixture.manifest();
        let mut document: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        mutate(&mut document);
        fs::write(path, serde_json::to_vec_pretty(&document).unwrap()).unwrap();
    }

    fn replay_error(fixture: &FixtureDirectory) -> String {
        replay_manifest(&fixture.manifest())
            .expect_err("tampered corpus must fail replay")
            .to_string()
    }

    #[test]
    fn command_line_accepts_only_the_exact_manifest_shape() {
        assert!(parse_manifest_path(&[]).is_ok());
        assert!(parse_manifest_path(&[
            OsString::from("--manifest"),
            OsString::from("manifest.v1.json")
        ])
        .is_ok());
        assert!(parse_manifest_path(&[OsString::from("--manifest")]).is_err());
        assert!(parse_manifest_path(&[OsString::from("--unknown")]).is_err());
    }

    #[test]
    fn frozen_manifest_replays_exact_membership_and_verdicts() {
        let fixture = copy_frozen_corpus();
        let summary = replay_manifest(&fixture.manifest()).unwrap();
        assert_eq!(summary.schema, CORPUS_MANIFEST_SCHEMA);
        assert_eq!(summary.entries, 26);
        assert_eq!(summary.admitted, 1);
        assert_eq!(summary.rejected, 25);
    }

    #[test]
    fn rejects_extra_missing_and_byte_drifted_seeds() {
        let extra = copy_frozen_corpus();
        fs::write(extra.0.join("unexpected.seed"), b"unexpected").unwrap();
        assert!(replay_error(&extra).contains("does not exactly match"));

        let missing = copy_frozen_corpus();
        fs::remove_file(missing.0.join("02-legacy-slm1-short.seed")).unwrap();
        assert!(replay_error(&missing).contains("does not exactly match"));

        let drifted = copy_frozen_corpus();
        let path = drifted.0.join("01-canonical-valid-vector.seed");
        let mut bytes = fs::read(&path).unwrap();
        bytes[0] ^= 0x01;
        fs::write(path, bytes).unwrap();
        assert!(replay_error(&drifted).contains("SHA-256 mismatch"));
    }

    #[test]
    fn rejects_manifest_identity_order_and_verdict_drift() {
        let identity = copy_frozen_corpus();
        mutate_manifest(&identity, |document| {
            document["fuzzProfileSha256"] = Value::String("0".repeat(64));
        });
        assert!(replay_error(&identity).contains("fuzzProfileSha256"));

        let duplicate = copy_frozen_corpus();
        mutate_manifest(&duplicate, |document| {
            let entries = document["entries"].as_array_mut().unwrap();
            entries.insert(1, entries[0].clone());
        });
        assert!(replay_error(&duplicate).contains("order or identity is noncanonical"));

        let verdict = copy_frozen_corpus();
        mutate_manifest(&verdict, |document| {
            let entry = &mut document["entries"][0];
            entry["verdict"] = Value::String("reject".to_owned());
            entry["errorCode"] = Value::String("slm2-invalid-magic".to_owned());
            entry["tensorCount"] = Value::Null;
        });
        assert!(replay_error(&verdict).contains("verdict mismatch"));
    }

    #[test]
    fn rejects_noncanonical_paths_and_oversized_manifest_before_replay() {
        let fixture = copy_frozen_corpus();
        let canonical_parent = fs::canonicalize(&fixture.0).unwrap();
        for path in [
            "../escape.seed",
            "nested/model.seed",
            "model.bin",
            "m\u{00f6}del.seed",
        ] {
            assert!(resolve_seed_path(&fixture.0, &canonical_parent, path).is_err());
        }

        fs::write(
            fixture.manifest(),
            vec![b' '; MAXIMUM_CORPUS_MANIFEST_BYTES as usize + 1],
        )
        .unwrap();
        assert!(replay_error(&fixture).contains("bounded regular file"));
    }
}
