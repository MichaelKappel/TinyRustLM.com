#![forbid(unsafe_code)]
#![doc = "Public `.slm` validation, inspection, and safe-loading boundary."]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt::{Display, Formatter};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tinyrustlm_runtime::errors::ErrorCode;
use tinyrustlm_runtime::model::inspect_model_bytes;
use tinyrustlm_runtime::model_format::SLM_MAGIC;

/// Maximum model size accepted by the public safe loader by default.
///
/// The two-GiB desktop boundary admits the reviewed 925-MiB Qwen artifact while
/// retaining a finite allocation policy. Callers may choose a smaller limit.
pub const DEFAULT_MAX_SLM_BYTES: u64 = 2 * 1024 * 1024 * 1024;

/// Public inspection report for an `.slm` artifact.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SlmInspection {
    /// Stable SDK schema kind.
    pub kind: String,
    /// Stable SDK schema version.
    pub version: u32,
    /// Hex-encoded SHA-256 of the exact artifact bytes.
    pub sha256: String,
    /// Artifact byte length.
    pub byte_count: u64,
    /// `.slm` format version.
    pub slm_version: u32,
    /// Model type identifier from the header.
    pub model_type: u32,
    /// Token vocabulary size.
    pub vocab_size: u32,
    /// Transformer hidden width.
    pub hidden_size: u32,
    /// Transformer layer count.
    pub layer_count: u32,
    /// Attention head count.
    pub head_count: u32,
    /// Key/value attention head count.
    pub kv_head_count: u32,
    /// Per-head dimension.
    pub head_dim: u32,
    /// Feed-forward intermediate width.
    pub ffn_size: u32,
    /// Maximum context length.
    pub max_context: u32,
    /// Tokenizer section byte length.
    pub tokenizer_bytes: u64,
    /// Tensor directory entry count.
    pub tensor_count: u32,
    /// Count of f32 tensors.
    pub f32_tensor_count: u32,
    /// Count of q8_0 tensors.
    pub q8_0_tensor_count: u32,
    /// Count of q4_0 tensors.
    pub q4_0_tensor_count: u32,
    /// Count of q5_0 tensors.
    pub q5_0_tensor_count: u32,
    /// Human-readable quantization summary.
    pub quantization: String,
    /// Runtime checksum embedded in the `.slm` header.
    pub runtime_checksum: u64,
}

/// Runtime-derived identity used by manifests and P2P compatibility checks.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SlmCompatibilityIdentity {
    /// Stable SDK schema kind.
    pub kind: String,
    /// Stable SDK schema version.
    pub version: u32,
    /// Existing public artifact inspection report.
    pub inspection: SlmInspection,
    /// Runtime tokenizer implementation selected from the artifact.
    pub tokenizer_kind: String,
    /// Total logical parameter count across tensor directory entries.
    pub parameter_count: u64,
    /// Stable tokenizer-section compatibility checksum.
    pub tokenizer_checksum: u64,
    /// Stable tensor-layout compatibility checksum.
    pub tensor_layout_checksum: u64,
}

/// Public safe-loading policy for `.slm` artifacts.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SlmLoadPolicy {
    /// Maximum accepted file size.
    pub max_bytes: u64,
    /// When set, the artifact SHA-256 must match exactly.
    pub expected_sha256: Option<String>,
}

impl Default for SlmLoadPolicy {
    fn default() -> Self {
        Self {
            max_bytes: DEFAULT_MAX_SLM_BYTES,
            expected_sha256: None,
        }
    }
}

/// A safely loaded `.slm` artifact plus its inspection report.
#[derive(Clone, Debug)]
pub struct SafeLoadedSlm {
    path: PathBuf,
    inspection: SlmInspection,
    bytes: Arc<[u8]>,
}

impl SafeLoadedSlm {
    /// Returns the loaded artifact path.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Returns the inspection report proven while loading.
    pub fn inspection(&self) -> &SlmInspection {
        &self.inspection
    }

    /// Returns the validated `.slm` bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }
}

/// Error returned by public `.slm` SDK operations.
#[derive(Debug)]
pub enum SlmError {
    /// File-system access failed.
    Io(String),
    /// The artifact exceeded the configured safe-loading byte budget.
    TooLarge {
        /// Actual artifact byte length.
        byte_count: u64,
        /// Configured maximum byte length.
        max_bytes: u64,
    },
    /// The artifact bytes did not parse as a supported `.slm`.
    InvalidModel(String),
    /// The computed SHA-256 did not match the caller's expected value.
    Sha256Mismatch {
        /// Expected caller-provided SHA-256.
        expected: String,
        /// Actual computed SHA-256.
        actual: String,
    },
}

impl Display for SlmError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(message) => write!(formatter, "I/O error: {message}"),
            Self::TooLarge {
                byte_count,
                max_bytes,
            } => write!(
                formatter,
                ".slm artifact is {byte_count} bytes, above policy limit {max_bytes}"
            ),
            Self::InvalidModel(message) => write!(formatter, "invalid .slm artifact: {message}"),
            Self::Sha256Mismatch { expected, actual } => write!(
                formatter,
                ".slm SHA-256 mismatch: expected {expected}, actual {actual}"
            ),
        }
    }
}

impl std::error::Error for SlmError {}

/// Validates and inspects `.slm` bytes.
pub fn inspect_slm_bytes(bytes: &[u8]) -> Result<SlmInspection, SlmError> {
    inspect_slm_compatibility_bytes(bytes).map(|identity| identity.inspection)
}

/// Validates `.slm` bytes and returns runtime-derived compatibility identity.
///
/// The TinyRustLM runtime is authoritative for tokenizer, required tensor,
/// shape, dtype, checksum, and finite payload validation. Consumers should use
/// this report instead of implementing an independent `.slm` parser.
pub fn inspect_slm_compatibility_bytes(bytes: &[u8]) -> Result<SlmCompatibilityIdentity, SlmError> {
    if bytes.len() < SLM_MAGIC.len() || bytes[0..4] != SLM_MAGIC {
        return Err(SlmError::InvalidModel(
            ErrorCode::InvalidModelMagic.message().to_string(),
        ));
    }
    let runtime = inspect_model_bytes(bytes)
        .map_err(|error| SlmError::InvalidModel(error.message().to_string()))?;
    let quantization = quantization_summary(
        runtime.f32_tensor_count,
        runtime.q8_0_tensor_count,
        runtime.q5_0_tensor_count,
        runtime.q4_0_tensor_count,
    );
    let header = runtime.header;
    let inspection = SlmInspection {
        kind: "tinyrustlm.slm.inspection.v0".to_string(),
        version: 1,
        sha256: sha256_bytes(bytes),
        byte_count: bytes.len() as u64,
        slm_version: header.version,
        model_type: header.model_type,
        vocab_size: header.vocab_size,
        hidden_size: header.hidden_size,
        layer_count: header.layer_count,
        head_count: header.head_count,
        kv_head_count: header.kv_head_count,
        head_dim: header.head_dim,
        ffn_size: header.ffn_size,
        max_context: header.max_context,
        tokenizer_bytes: header.tokenizer_length,
        tensor_count: header.tensor_count,
        f32_tensor_count: runtime.f32_tensor_count,
        q8_0_tensor_count: runtime.q8_0_tensor_count,
        q4_0_tensor_count: runtime.q4_0_tensor_count,
        q5_0_tensor_count: runtime.q5_0_tensor_count,
        quantization,
        runtime_checksum: header.checksum,
    };
    Ok(SlmCompatibilityIdentity {
        kind: "tinyrustlm.slm.compatibility-identity.v0".to_string(),
        version: 1,
        inspection,
        tokenizer_kind: runtime.tokenizer_kind.to_string(),
        parameter_count: runtime.parameter_count,
        tokenizer_checksum: runtime.tokenizer_checksum,
        tensor_layout_checksum: runtime.tensor_layout_checksum,
    })
}

/// Returns whether the byte slice is a valid supported `.slm` artifact.
pub fn validate_slm_bytes(bytes: &[u8]) -> bool {
    inspect_slm_bytes(bytes).is_ok()
}

/// Safely loads a `.slm` file from disk and validates it before returning bytes.
pub fn safe_load_slm_from_path(
    path: impl AsRef<Path>,
    policy: &SlmLoadPolicy,
) -> Result<SafeLoadedSlm, SlmError> {
    let path = path.as_ref();
    let metadata = fs::metadata(path).map_err(|error| SlmError::Io(error.to_string()))?;
    let byte_count = metadata.len();
    if byte_count > policy.max_bytes {
        return Err(SlmError::TooLarge {
            byte_count,
            max_bytes: policy.max_bytes,
        });
    }
    let bytes = fs::read(path).map_err(|error| SlmError::Io(error.to_string()))?;
    let inspection = inspect_slm_bytes(&bytes)?;
    if let Some(expected) = policy.expected_sha256.as_deref() {
        if !expected.eq_ignore_ascii_case(&inspection.sha256) {
            return Err(SlmError::Sha256Mismatch {
                expected: expected.to_string(),
                actual: inspection.sha256.clone(),
            });
        }
    }
    Ok(SafeLoadedSlm {
        path: path.to_path_buf(),
        inspection,
        bytes: Arc::from(bytes.into_boxed_slice()),
    })
}

/// Inspects a `.slm` file from disk with the default safe-loading byte budget.
pub fn inspect_slm_path(path: impl AsRef<Path>) -> Result<SlmInspection, SlmError> {
    safe_load_slm_from_path(path, &SlmLoadPolicy::default()).map(|loaded| loaded.inspection)
}

fn quantization_summary(f32_count: u32, q8_count: u32, q5_count: u32, q4_count: u32) -> String {
    let mut modes = Vec::with_capacity(4);
    if f32_count > 0 {
        modes.push("f32");
    }
    if q8_count > 0 {
        modes.push("q8_0");
    }
    if q5_count > 0 {
        modes.push("q5_0");
    }
    if q4_count > 0 {
        modes.push("q4_0");
    }
    match modes.as_slice() {
        [] => "empty".to_string(),
        [mode] => (*mode).to_string(),
        _ => format!("mixed-{}", modes.join("-")),
    }
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("sha256:{}", hex_lower(&hasher.finalize()))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use tinyrustlm_runtime::model_format::SLM_VERSION;

    fn fixture_model() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model.slm")
    }

    #[test]
    fn inspects_fixture_model() {
        let report = inspect_slm_path(fixture_model()).expect("inspection");
        assert_eq!(report.kind, "tinyrustlm.slm.inspection.v0");
        assert_eq!(report.version, 1);
        assert_eq!(report.slm_version, SLM_VERSION);
        assert!(report.byte_count > 0);
        assert!(report.sha256.starts_with("sha256:"));
        assert!(report.tensor_count > 0);
        assert_eq!(report.quantization, "f32");
    }

    #[test]
    fn exposes_runtime_compatibility_identity_without_reparsing() {
        let bytes = fs::read(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../tinyrustlm/models/tiny-test-model-q8.slm"),
        )
        .expect("q8 fixture");

        let identity = inspect_slm_compatibility_bytes(&bytes).expect("compatibility identity");

        assert_eq!(identity.kind, "tinyrustlm.slm.compatibility-identity.v0");
        assert_eq!(identity.version, 1);
        assert_eq!(identity.inspection.quantization, "q8_0");
        assert_eq!(identity.tokenizer_kind, "byte-v1");
        assert_eq!(identity.parameter_count, 4_824);
        assert_eq!(identity.tokenizer_checksum, 0x288f65d94c26743e);
        assert_eq!(identity.tensor_layout_checksum, 0xd8fb6e636a8badd6);
    }

    #[test]
    fn rejects_sha256_drift() {
        let path = fixture_model();
        let policy = SlmLoadPolicy {
            expected_sha256: Some(format!("sha256:{}", "0".repeat(64))),
            ..SlmLoadPolicy::default()
        };
        let error = safe_load_slm_from_path(path, &policy).expect_err("sha mismatch");
        assert!(error.to_string().contains("SHA-256 mismatch"));
    }

    #[test]
    fn rejects_invalid_magic() {
        let error = inspect_slm_bytes(b"not an slm").expect_err("invalid");
        assert!(error.to_string().contains("invalid model magic"));
    }

    #[test]
    fn inspects_q5_fixture_model() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../tinyrustlm/models/tiny-test-model-q5.slm");

        let report = inspect_slm_path(path).expect("q5 inspection");

        assert_eq!(report.q5_0_tensor_count, report.tensor_count);
        assert_eq!(report.q4_0_tensor_count, 0);
        assert_eq!(report.q8_0_tensor_count, 0);
        assert_eq!(report.quantization, "q5_0");
    }
}
