#![deny(missing_docs)]
#![forbid(unsafe_code)]

//! Bounded raw-byte fuzz harness and stable replay invariants for the sole
//! unpromoted SLM2 model parser.

use std::io::Cursor;
use std::sync::OnceLock;

use serde::Deserialize;
use sha2::{Digest, Sha256};
use tinyrustlm_slm2::{
    build_piece_manifest, required_model_tensors, validate_model, ValidationPolicy,
    SLM2_FORMAT_PROFILE_ID, SLM2_FORMAT_PROFILE_SHA256,
};

/// Largest complete raw artifact forwarded to the SLM2 parser by this harness.
pub const MAXIMUM_INPUT_BYTES: usize = 1_048_576;
/// Largest tensor count admitted by the fuzz validation policy.
pub const MAXIMUM_TENSORS: u32 = 4_096;
/// Frozen SLM2 fuzz-profile identity.
pub const SLM2_FUZZ_PROFILE_ID: &str = "tinyrustlm.vnext.slm2-fuzz.v1";
/// SHA-256 of the exact checked-in SLM2 fuzz profile.
pub const SLM2_FUZZ_PROFILE_SHA256: &str =
    "dc16fd2abf142e6a9c8a72bbfc3d998b980af486e094406d73933cae6732a487";
/// Exact schema required for one stable corpus manifest.
pub const CORPUS_MANIFEST_SCHEMA: &str = "tinyrustlm.vnext.slm2_fuzz_corpus.v1";
/// Largest stable corpus manifest admitted before JSON parsing.
pub const MAXIMUM_CORPUS_MANIFEST_BYTES: u64 = 131_072;
/// Largest exact stable corpus membership admitted by replay.
pub const MAXIMUM_CORPUS_ENTRIES: usize = 256;

const SLM2_FUZZ_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../../contracts/vnext/slm2-fuzz-profile.v1.json");
const ALLOWED_PARSER_ERROR_CODES: &[&str] = &[
    "slm2-file-size-limit",
    "slm2-file-size-mismatch",
    "slm2-invalid-byte-order",
    "slm2-invalid-format-id",
    "slm2-invalid-header",
    "slm2-invalid-header-flags",
    "slm2-invalid-header-size",
    "slm2-invalid-magic",
    "slm2-invalid-manifest-size",
    "slm2-invalid-metadata",
    "slm2-invalid-model-metadata",
    "slm2-invalid-payload-layout",
    "slm2-invalid-section",
    "slm2-invalid-section-layout",
    "slm2-invalid-string-table",
    "slm2-invalid-tensor",
    "slm2-invalid-tensor-order",
    "slm2-invalid-tensor-registry",
    "slm2-io",
    "slm2-layout-hash-drift",
    "slm2-nonfinite-f32",
    "slm2-nonzero-padding",
    "slm2-offset-overflow",
    "slm2-payload-hash-drift",
    "slm2-profile-drift",
    "slm2-tensor-size-mismatch",
    "slm2-trailing-bytes",
    "slm2-truncated-header",
    "slm2-unsupported-artifact-class",
    "slm2-unsupported-table",
    "slm2-unsupported-version",
];
const ACCEPTED_ARTIFACT_CHECKS: &[&str] = &[
    "identity-byte-length-equals-input-length",
    "identity-sha256-equals-independent-sha256",
    "piece-manifest-byte-length-equals-input-length",
    "piece-manifest-sha256-equals-independent-sha256",
    "piece-manifest-sha256-equals-model-identity",
    "tensor-count-within-policy",
    "tensor-registry-matches-public-required-registry",
    "all-payload-ranges-within-input",
];
const REJECTED_ARTIFACT_CHECKS: &[&str] = &[
    "stable-error-code-is-in-allowlist",
    "no-panic",
    "no-activation",
    "no-output-file",
    "no-network",
];
const SEED_CLASSES: &[&str] = &[
    "canonical-valid-vector",
    "legacy-or-truncated-envelope",
    "header-identity-and-version-mutation",
    "section-layout-and-padding-mutation",
    "noncanonical-metadata",
    "string-table-mutation",
    "tensor-table-mutation",
    "tensor-registry-mutation",
    "layout-identity-mutation",
    "payload-layout-mutation",
    "payload-finiteness-and-identity-mutation",
    "trailing-byte-mutation",
];
const PROHIBITED_BEHAVIORS: &[&str] = &[
    "unbounded-input-forwarding",
    "panic-as-rejection",
    "parser-output-repair",
    "best-of-n-parser-selection",
    "activation-of-fuzzed-artifacts",
    "network-access",
    "model-byte-publication",
    "fuzz-result-as-production-qualification",
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FuzzProfile {
    schema: String,
    profile_id: String,
    version: u32,
    status: String,
    format_profile_id: String,
    format_profile_sha256: String,
    input: InputProfile,
    validation_policy: ValidationPolicyProfile,
    target: TargetProfile,
    allowed_parser_error_codes: Vec<String>,
    seed_classes: Vec<String>,
    stable_replay: StableReplayProfile,
    prohibited: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct InputProfile {
    kind: String,
    maximum_bytes: usize,
    empty_input: String,
    oversized_input: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ValidationPolicyProfile {
    maximum_file_bytes: usize,
    maximum_tensors: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TargetProfile {
    parser: String,
    accepted_artifact_checks: Vec<String>,
    rejected_artifact_checks: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StableReplayProfile {
    manifest_schema: String,
    manifest_status: String,
    exact_seed_set_required: bool,
    seed_symlinks_allowed: bool,
    manifest_maximum_bytes: u64,
    maximum_entries: usize,
}

/// Stable outcome after one bounded parser exercise.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ExerciseVerdict {
    /// The complete artifact passed the exact parser and all independent harness invariants.
    Admitted,
    /// The parser rejected the bytes with one profile-allowlisted stable code.
    Rejected(String),
}

impl ExerciseVerdict {
    /// Returns `admit` or `reject` for corpus receipts.
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Admitted => "admit",
            Self::Rejected(_) => "reject",
        }
    }

    /// Returns the stable parser error for a rejection.
    pub fn error_code(&self) -> Option<&str> {
        match self {
            Self::Admitted => None,
            Self::Rejected(code) => Some(code),
        }
    }
}

/// Bounded report returned by one raw-byte parser exercise.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExerciseReport {
    input_bytes: usize,
    input_sha256: String,
    tensor_count: Option<usize>,
    verdict: ExerciseVerdict,
}

impl ExerciseReport {
    /// Returns the exact complete input length.
    pub const fn input_bytes(&self) -> usize {
        self.input_bytes
    }

    /// Returns the independent plain SHA-256 of the complete input.
    pub fn input_sha256(&self) -> &str {
        &self.input_sha256
    }

    /// Returns the validated tensor count only for an admitted artifact.
    pub const fn tensor_count(&self) -> Option<usize> {
        self.tensor_count
    }

    /// Returns the stable exercise verdict.
    pub const fn verdict(&self) -> &ExerciseVerdict {
        &self.verdict
    }
}

/// Verifies that the exact fuzz and format profiles remain bound to this harness.
pub fn validate_profile_identity() {
    static VALIDATED: OnceLock<()> = OnceLock::new();
    VALIDATED.get_or_init(validate_frozen_profile);
}

fn validate_frozen_profile() {
    assert_eq!(SLM2_FORMAT_PROFILE_ID, "org.minimodel.slm2/2.0");
    assert_eq!(
        SLM2_FORMAT_PROFILE_SHA256,
        "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625"
    );
    assert_eq!(
        hex_sha256(&sha256(SLM2_FUZZ_PROFILE_BYTES)),
        SLM2_FUZZ_PROFILE_SHA256
    );

    let profile: FuzzProfile = serde_json::from_slice(SLM2_FUZZ_PROFILE_BYTES)
        .expect("frozen SLM2 fuzz profile must have the exact typed shape");
    assert_eq!(profile.schema, "tinyrustlm.vnext.slm2-fuzz-profile.v1");
    assert_eq!(profile.profile_id, SLM2_FUZZ_PROFILE_ID);
    assert_eq!(profile.version, 1);
    assert_eq!(profile.status, "development-unpromoted");
    assert_eq!(profile.format_profile_id, SLM2_FORMAT_PROFILE_ID);
    assert_eq!(profile.format_profile_sha256, SLM2_FORMAT_PROFILE_SHA256);

    assert_eq!(profile.input.kind, "raw-complete-slm2-artifact-bytes");
    assert_eq!(profile.input.maximum_bytes, MAXIMUM_INPUT_BYTES);
    assert_eq!(profile.input.empty_input, "parser-rejection");
    assert_eq!(
        profile.input.oversized_input,
        "harness-rejection-before-parser"
    );
    assert_eq!(
        profile.validation_policy.maximum_file_bytes,
        MAXIMUM_INPUT_BYTES
    );
    assert_eq!(profile.validation_policy.maximum_tensors, MAXIMUM_TENSORS);

    assert_eq!(profile.target.parser, "tinyrustlm_slm2::validate_model");
    assert_strings_eq(
        &profile.target.accepted_artifact_checks,
        ACCEPTED_ARTIFACT_CHECKS,
    );
    assert_strings_eq(
        &profile.target.rejected_artifact_checks,
        REJECTED_ARTIFACT_CHECKS,
    );
    assert_strings_eq(
        &profile.allowed_parser_error_codes,
        ALLOWED_PARSER_ERROR_CODES,
    );
    assert_strings_eq(&profile.seed_classes, SEED_CLASSES);

    assert_eq!(
        profile.stable_replay.manifest_schema,
        CORPUS_MANIFEST_SCHEMA
    );
    assert_eq!(profile.stable_replay.manifest_status, "frozen");
    assert!(profile.stable_replay.exact_seed_set_required);
    assert!(!profile.stable_replay.seed_symlinks_allowed);
    assert_eq!(
        profile.stable_replay.manifest_maximum_bytes,
        MAXIMUM_CORPUS_MANIFEST_BYTES
    );
    assert_eq!(
        profile.stable_replay.maximum_entries,
        MAXIMUM_CORPUS_ENTRIES
    );
    assert_strings_eq(&profile.prohibited, PROHIBITED_BEHAVIORS);
}

fn assert_strings_eq(actual: &[String], expected: &[&str]) {
    assert_eq!(
        actual.iter().map(String::as_str).collect::<Vec<_>>(),
        expected
    );
}

/// Exercises one bounded complete byte string and asserts cross-component invariants.
///
/// Callers must reject oversized data before invoking this function. That contract
/// keeps the parser, independent digest, and piece oracle within the frozen limit.
pub fn exercise_bytes(bytes: &[u8]) -> ExerciseReport {
    validate_profile_identity();
    assert!(
        bytes.len() <= MAXIMUM_INPUT_BYTES,
        "fuzz caller forwarded input above the frozen byte limit"
    );
    let independent_digest = sha256(bytes);
    let independent_hex = hex_sha256(&independent_digest);
    let policy = ValidationPolicy::new(MAXIMUM_INPUT_BYTES as u64, MAXIMUM_TENSORS)
        .expect("frozen fuzz validation policy must remain valid");
    let mut source = Cursor::new(bytes);
    let (tensor_count, verdict) = match validate_model(&mut source, policy) {
        Ok(model) => {
            assert_eq!(model.identity().byte_length(), bytes.len() as u64);
            assert_eq!(model.identity().artifact_sha256(), &independent_digest);
            assert!(model.tensors().len() <= MAXIMUM_TENSORS as usize);
            let required = required_model_tensors(model.spec(), 64)
                .expect("parser-admitted model must have one bounded required tensor registry");
            assert_eq!(model.tensors().len(), required.len());
            for (actual, expected) in model.tensors().iter().zip(&required) {
                assert_eq!(actual.semantic_role(), expected.semantic_role());
                assert_eq!(actual.canonical_name(), expected.canonical_name());
                assert_eq!(actual.layer(), expected.layer());
                assert_eq!(actual.subindex_0(), -1);
                assert_eq!(actual.subindex_1(), -1);
                assert_eq!(actual.shape(), expected.shape());
            }
            for tensor in model.tensors() {
                let end = tensor
                    .payload_offset()
                    .checked_add(tensor.payload_length())
                    .expect("validated tensor payload range overflowed");
                assert!(end <= bytes.len() as u64);
            }
            let pieces = build_piece_manifest(&mut Cursor::new(bytes))
                .expect("parser-admitted bounded artifact must produce piece identities");
            assert_eq!(pieces.artifact_byte_length(), bytes.len() as u64);
            assert_eq!(pieces.artifact_sha256(), &independent_digest);
            assert_eq!(pieces.artifact_sha256(), model.identity().artifact_sha256());
            (Some(model.tensors().len()), ExerciseVerdict::Admitted)
        }
        Err(error) => {
            assert!(
                ALLOWED_PARSER_ERROR_CODES.contains(&error.code()),
                "parser emitted error outside the frozen fuzz profile: {}",
                error.code()
            );
            (None, ExerciseVerdict::Rejected(error.code().to_owned()))
        }
    };
    ExerciseReport {
        input_bytes: bytes.len(),
        input_sha256: independent_hex,
        tensor_count,
        verdict,
    }
}

/// Computes an independent SHA-256 digest for replay evidence.
pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

/// Encodes a digest as canonical lowercase hexadecimal.
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

    const VECTOR_BYTES: &[u8] =
        include_bytes!("../../../../../contracts/vnext/slm2-format-vectors.v1.json");

    fn vector_artifact() -> Vec<u8> {
        let document: serde_json::Value = serde_json::from_slice(VECTOR_BYTES).unwrap();
        let hex = document["vectors"][0]["artifactHex"].as_str().unwrap();
        hex.as_bytes()
            .chunks_exact(2)
            .map(|pair| {
                let high = char::from(pair[0]).to_digit(16).unwrap() as u8;
                let low = char::from(pair[1]).to_digit(16).unwrap() as u8;
                (high << 4) | low
            })
            .collect()
    }

    #[test]
    fn canonical_vector_admits_and_reproduces_identity() {
        let bytes = vector_artifact();
        let report = exercise_bytes(&bytes);
        assert_eq!(report.verdict(), &ExerciseVerdict::Admitted);
        assert_eq!(report.tensor_count(), Some(11));
        assert_eq!(report.input_sha256(), hex_sha256(&sha256(&bytes)));
    }

    #[test]
    fn arbitrary_and_legacy_bytes_reject_without_activation() {
        for bytes in [
            b"".as_slice(),
            b"SLM1".as_slice(),
            b"not-a-model".as_slice(),
        ] {
            let report = exercise_bytes(bytes);
            assert!(matches!(report.verdict(), ExerciseVerdict::Rejected(_)));
            assert_eq!(report.tensor_count(), None);
        }
    }
}
