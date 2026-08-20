#![deny(missing_docs)]
#![forbid(unsafe_code)]

//! Bounded raw-byte fuzz harness and stable replay invariants for the sole
//! unpromoted SLM2 model parser.

use std::io::Cursor;

use sha2::{Digest, Sha256};
use tinyrustlm_slm2::{
    build_piece_manifest, validate_model, ValidationPolicy, SLM2_FORMAT_PROFILE_ID,
    SLM2_FORMAT_PROFILE_SHA256,
};

/// Largest complete raw artifact forwarded to the SLM2 parser by this harness.
pub const MAXIMUM_INPUT_BYTES: usize = 1_048_576;
/// Largest tensor count admitted by the fuzz validation policy.
pub const MAXIMUM_TENSORS: u32 = 4_096;
/// Frozen SLM2 fuzz-profile identity.
pub const SLM2_FUZZ_PROFILE_ID: &str = "tinyrustlm.vnext.slm2-fuzz.v1";
/// SHA-256 of the exact checked-in SLM2 fuzz profile.
pub const SLM2_FUZZ_PROFILE_SHA256: &str =
    "ee114d831d180afdb15c2f8ea00e76212083fd764c605f2cf193f0770708a641";

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
    assert_eq!(SLM2_FORMAT_PROFILE_ID, "org.minimodel.slm2/2.0");
    assert_eq!(
        SLM2_FORMAT_PROFILE_SHA256,
        "f272caf64cacb7a4705fee0c958f15ee0cac3985d8728458a80f812913d66554"
    );
    assert_eq!(
        hex_sha256(&sha256(SLM2_FUZZ_PROFILE_BYTES)),
        SLM2_FUZZ_PROFILE_SHA256
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
        assert_eq!(report.tensor_count(), Some(2));
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
