use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::Write;

use sha2::{Digest, Sha256};

pub(crate) const HEADER_BYTES: usize = 256;
pub(crate) const WEIGHT_COUNT: usize = 8_193;
pub(crate) const WEIGHT_RECORD_BYTES: usize = 8;
pub(crate) const WEIGHT_TABLE_BYTES: usize = WEIGHT_COUNT * WEIGHT_RECORD_BYTES;
pub(crate) const FILE_BYTES: usize = HEADER_BYTES + WEIGHT_TABLE_BYTES;
pub(crate) const LOG_STEPS_PER_NATURAL_UNIT: u32 = 256;
pub(crate) const MAXIMUM_LOG_STEP: u32 = 8_192;
pub(crate) const WEIGHT_FRACTION_BITS: u16 = 48;
pub(crate) const LOGIT_FRACTION_BITS: u16 = 20;
pub(crate) const MAXIMUM_VOCABULARY_SIZE: u32 = 151_936;
pub(crate) const MAXIMUM_TOP_K: u32 = 1_024;
pub(crate) const MAXIMUM_REPETITION_WINDOW: u32 = 64;
pub(crate) const MAXIMUM_STOP_TOKENS: u32 = 16;
pub(crate) const MAXIMUM_NEW_TOKENS: u32 = 4_096;
pub(crate) const MAXIMUM_CONTEXT_TOKENS: u32 = 40_960;
pub(crate) const MILLION: u32 = 1_000_000;
pub(crate) const MAXIMUM_TEMPERATURE: u32 = 4_000_000;
pub(crate) const MINIMUM_REPETITION_PENALTY: u32 = 1_000_000;
pub(crate) const MAXIMUM_REPETITION_PENALTY: u32 = 2_000_000;
pub(crate) const MAGIC: &[u8; 8] = b"SMP2\r\n\x1a\n";
pub(crate) const FORMAT_ID: &[u8; 16] = b"minimodel.smp2\0\0";

/// Exact Sampling2 2.0 profile identifier.
pub const SAMPLING2_FORMAT_PROFILE_ID: &str = "org.minimodel.sampling2/2.0";

/// SHA-256 of the exact machine-readable Sampling2 profile bytes.
pub const SAMPLING2_FORMAT_PROFILE_SHA256: &str =
    "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d";

/// SHA-256 of the exact normative Q48 exponential-weight table bytes.
pub const SAMPLING2_WEIGHT_TABLE_SHA256: &str =
    "fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677";

/// SHA-256 of the sole canonical Sampling2 artifact.
pub const SAMPLING2_ARTIFACT_SHA256: &str =
    "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89";

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/sampling2-format-profile.v1.json");
pub(crate) const TABLE_BYTES: &[u8; WEIGHT_TABLE_BYTES] =
    include_bytes!("../../../../contracts/vnext/sampling2-exp-q48-table.v1.bin");

const TABLE_SHA256_BYTES: [u8; 32] = [
    0xfc, 0xe2, 0x34, 0x5b, 0xd4, 0xdd, 0xc5, 0x3f, 0x13, 0x7e, 0xcc, 0x36, 0xa4, 0x8a, 0xfc, 0xa0,
    0x2a, 0x73, 0xeb, 0xd3, 0x54, 0x9a, 0xcc, 0xe9, 0x42, 0x62, 0x8e, 0x44, 0x04, 0x29, 0xc6, 0x77,
];

/// Stable fail-closed Sampling2 error.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Sampling2Error {
    code: &'static str,
}

impl Sampling2Error {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for Sampling2Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Sampling2Error {}

/// Whole-artifact identity returned by the canonical writer and parser.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SamplingIdentity {
    /// Exact artifact byte length.
    pub byte_length: u64,
    /// Plain SHA-256 over every exact artifact byte.
    pub sha256: [u8; 32],
}

/// Writes the sole canonical Sampling2 2.0 artifact.
///
/// Durable callers must use an owned create-only same-directory staging file,
/// reparse and synchronize it, then promote it atomically.
pub fn write_sampling2<W: Write>(output: &mut W) -> Result<SamplingIdentity, Sampling2Error> {
    let artifact = canonical_artifact()?;
    output
        .write_all(&artifact)
        .map_err(|_| Sampling2Error::new("sampling2-write-failed"))?;
    Ok(SamplingIdentity {
        byte_length: artifact.len() as u64,
        sha256: Sha256::digest(&artifact).into(),
    })
}

pub(crate) fn validate_profile_identity() -> Result<(), Sampling2Error> {
    if hex_lower(&Sha256::digest(PROFILE_BYTES)) != SAMPLING2_FORMAT_PROFILE_SHA256 {
        return Err(Sampling2Error::new("sampling2-profile-drift"));
    }
    Ok(())
}

pub(crate) fn validate_embedded_table() -> Result<(), Sampling2Error> {
    let digest: [u8; 32] = Sha256::digest(TABLE_BYTES).into();
    if digest != TABLE_SHA256_BYTES || hex_lower(&digest) != SAMPLING2_WEIGHT_TABLE_SHA256 {
        return Err(Sampling2Error::new("sampling2-table-hash"));
    }
    let mut prior = None;
    for index in 0..WEIGHT_COUNT {
        let weight = u64::from_le_bytes(
            TABLE_BYTES[index * 8..index * 8 + 8]
                .try_into()
                .map_err(|_| Sampling2Error::new("sampling2-table-values"))?,
        );
        if weight == 0 || prior.is_some_and(|value| weight > value) {
            return Err(Sampling2Error::new("sampling2-table-values"));
        }
        prior = Some(weight);
    }
    if u64::from_le_bytes(TABLE_BYTES[0..8].try_into().expect("fixed table slice")) != 1_u64 << 48
        || u64::from_le_bytes(
            TABLE_BYTES[WEIGHT_TABLE_BYTES - 8..]
                .try_into()
                .expect("fixed table slice"),
        ) != 4
    {
        return Err(Sampling2Error::new("sampling2-table-values"));
    }
    Ok(())
}

fn canonical_artifact() -> Result<Vec<u8>, Sampling2Error> {
    validate_profile_identity()?;
    validate_embedded_table()?;
    let mut artifact = vec![0_u8; FILE_BYTES];
    artifact[0..8].copy_from_slice(MAGIC);
    artifact[8..24].copy_from_slice(FORMAT_ID);
    put_u32(&mut artifact, 24, HEADER_BYTES as u32);
    put_u16(&mut artifact, 28, 2);
    put_u16(&mut artifact, 30, 0);
    put_u32(&mut artifact, 32, 0x0102_0304);
    put_u16(&mut artifact, 36, 1);
    put_u16(&mut artifact, 38, 0);
    put_u64(&mut artifact, 40, FILE_BYTES as u64);
    put_u64(&mut artifact, 48, HEADER_BYTES as u64);
    put_u32(&mut artifact, 56, WEIGHT_COUNT as u32);
    put_u32(&mut artifact, 60, WEIGHT_RECORD_BYTES as u32);
    put_u32(&mut artifact, 64, LOG_STEPS_PER_NATURAL_UNIT);
    put_u32(&mut artifact, 68, MAXIMUM_LOG_STEP);
    put_u16(&mut artifact, 72, WEIGHT_FRACTION_BITS);
    put_u16(&mut artifact, 74, 1);
    put_u16(&mut artifact, 76, 1);
    put_u16(&mut artifact, 78, 1);
    put_u32(&mut artifact, 80, MAXIMUM_VOCABULARY_SIZE);
    put_u32(&mut artifact, 84, MAXIMUM_TOP_K);
    put_u32(&mut artifact, 88, MAXIMUM_REPETITION_WINDOW);
    put_u32(&mut artifact, 92, MAXIMUM_STOP_TOKENS);
    put_u32(&mut artifact, 96, MAXIMUM_NEW_TOKENS);
    put_u32(&mut artifact, 100, MAXIMUM_CONTEXT_TOKENS);
    put_u32(&mut artifact, 104, MILLION);
    put_u16(&mut artifact, 108, LOGIT_FRACTION_BITS);
    put_u16(&mut artifact, 110, 1);
    put_u32(&mut artifact, 112, 1);
    put_u32(&mut artifact, 116, MAXIMUM_TEMPERATURE);
    put_u32(&mut artifact, 120, 1);
    put_u32(&mut artifact, 124, MILLION);
    put_u32(&mut artifact, 128, MINIMUM_REPETITION_PENALTY);
    put_u32(&mut artifact, 132, MAXIMUM_REPETITION_PENALTY);
    artifact[136..168].copy_from_slice(&TABLE_SHA256_BYTES);
    artifact[HEADER_BYTES..].copy_from_slice(TABLE_BYTES);
    if hex_lower(&Sha256::digest(&artifact)) != SAMPLING2_ARTIFACT_SHA256 {
        return Err(Sampling2Error::new("sampling2-artifact-identity"));
    }
    Ok(artifact)
}

pub(crate) fn table_sha256_bytes() -> &'static [u8; 32] {
    &TABLE_SHA256_BYTES
}

pub(crate) fn get_u16(bytes: &[u8], offset: usize) -> Result<u16, Sampling2Error> {
    Ok(u16::from_le_bytes(
        bytes
            .get(offset..offset + 2)
            .ok_or_else(|| Sampling2Error::new("sampling2-header"))?
            .try_into()
            .map_err(|_| Sampling2Error::new("sampling2-header"))?,
    ))
}

pub(crate) fn get_u32(bytes: &[u8], offset: usize) -> Result<u32, Sampling2Error> {
    Ok(u32::from_le_bytes(
        bytes
            .get(offset..offset + 4)
            .ok_or_else(|| Sampling2Error::new("sampling2-header"))?
            .try_into()
            .map_err(|_| Sampling2Error::new("sampling2-header"))?,
    ))
}

pub(crate) fn get_u64(bytes: &[u8], offset: usize) -> Result<u64, Sampling2Error> {
    Ok(u64::from_le_bytes(
        bytes
            .get(offset..offset + 8)
            .ok_or_else(|| Sampling2Error::new("sampling2-header"))?
            .try_into()
            .map_err(|_| Sampling2Error::new("sampling2-header"))?,
    ))
}

pub(crate) fn all_zero(bytes: &[u8]) -> bool {
    bytes.iter().all(|byte| *byte == 0)
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

fn put_u16(bytes: &mut [u8], offset: usize, value: u16) {
    bytes[offset..offset + 2].copy_from_slice(&value.to_le_bytes());
}

fn put_u32(bytes: &mut [u8], offset: usize, value: u32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn put_u64(bytes: &mut [u8], offset: usize, value: u64) {
    bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}
