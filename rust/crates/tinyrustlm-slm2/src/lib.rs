#![forbid(unsafe_code)]
#![doc = "Strict streaming implementation of the unpromoted SLM2 model format."]

use std::error::Error;
use std::fmt;

use sha2::{Digest, Sha256};

mod cbor;
mod format;
mod piece;

pub use format::{
    required_model_tensors, validate_model, write_model, ArtifactClass, ModelIdentity, ModelSpec,
    TensorInput, TensorSpec, ValidatedModel, ValidatedTensor, ValidationPolicy,
};
pub use piece::{build_piece_manifest, PieceIdentity, PieceManifest, PIECE_BYTES};

/// The exact machine-readable SLM2 format profile identity.
pub const SLM2_FORMAT_PROFILE_ID: &str = "org.minimodel.slm2/2.0";
/// The SHA-256 of the exact machine-readable SLM2 format profile bytes.
pub const SLM2_FORMAT_PROFILE_SHA256: &str =
    "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625";
const SLM2_FORMAT_PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/slm2-format-profile.v1.json");

/// A bounded public-safe SLM2 failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Slm2Error {
    code: &'static str,
}

impl Slm2Error {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for Slm2Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Slm2Error {}

pub(crate) fn validate_profile_identity() -> Result<(), Slm2Error> {
    let digest = Sha256::digest(SLM2_FORMAT_PROFILE_BYTES);
    if hex_lower(&digest) != SLM2_FORMAT_PROFILE_SHA256 {
        return Err(Slm2Error::new("slm2-profile-drift"));
    }
    Ok(())
}

pub(crate) fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

pub(crate) fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checked_in_profile_identity_is_exact() {
        validate_profile_identity().unwrap();
        let parsed: serde_json::Value = serde_json::from_slice(SLM2_FORMAT_PROFILE_BYTES).unwrap();
        assert_eq!(parsed["profileId"], SLM2_FORMAT_PROFILE_ID);
        assert_eq!(parsed["status"], "development-unpromoted");
    }
}
