use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::Write;

use sha2::{Digest, Sha256};

pub(crate) const ARTIFACT_BYTES: usize = 512;
pub(crate) const WIRE_HEADER_BYTES: usize = 128;
pub(crate) const TOKENIZER_ARTIFACT_BYTES: usize = 7_038_773;
pub(crate) const TEMPLATE_ARTIFACT_BYTES: usize = 1_403;
pub(crate) const SAMPLING_ARTIFACT_BYTES: usize = 65_800;
pub(crate) const TOKENIZER_TOKEN_COUNT: u32 = 151_669;
pub(crate) const MODEL_VOCABULARY_SIZE: u32 = 151_936;
pub(crate) const MAXIMUM_MESSAGES: u32 = 256;
pub(crate) const MAXIMUM_CONTROL_INSERTIONS: u32 = 515;
pub(crate) const MAXIMUM_MESSAGE_CONTENT_BYTES: u32 = 262_144;
pub(crate) const MAXIMUM_TOTAL_CONTENT_BYTES: u32 = 1_048_576;
pub(crate) const MAXIMUM_RENDERED_BYTES: u32 = 1_114_112;
pub(crate) const MAXIMUM_PROMPT_TOKENS: u32 = 40_960;
pub(crate) const MAXIMUM_CONTEXT_TOKENS: u32 = 40_960;
pub(crate) const MAXIMUM_NEW_TOKENS: u32 = 4_096;
pub(crate) const MAXIMUM_STOP_TOKENS: u32 = 16;
pub(crate) const MAXIMUM_LOAD_BUNDLE_BYTES: usize = 16_777_216;
pub(crate) const MAXIMUM_REQUEST_BYTES: usize = 1_054_848;
pub(crate) const MAXIMUM_RESULT_BYTES: usize = 1_310_720;
pub(crate) const STOP_TOKEN_IDS: [u32; 2] = [151_645, 151_643];
pub(crate) const NONE_U32: u32 = u32::MAX;
pub(crate) const SECTION_ALIGNMENT: usize = 64;

const MAGIC: &[u8; 8] = b"PRM2\r\n\x1a\n";
const FORMAT_ID: &[u8; 16] = b"minimodel.prm2\0\0";
const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/prompt2-format-profile.v1.json");

pub(crate) const TOKENIZER_PROFILE_SHA256: &str =
    "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de";
pub(crate) const TOKENIZER_ARTIFACT_SHA256: &str =
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";
pub(crate) const TEMPLATE_PROFILE_SHA256: &str =
    "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa";
pub(crate) const TEMPLATE_ARTIFACT_SHA256: &str =
    "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8";
pub(crate) const SAMPLING_PROFILE_SHA256: &str =
    "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d";
pub(crate) const SAMPLING_ARTIFACT_SHA256: &str =
    "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89";
const SAMPLING_TABLE_SHA256: &str =
    "fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677";
pub(crate) const SOURCE_MODEL_CONFIG_SHA256: &str =
    "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd";
pub(crate) const SOURCE_TEMPLATE_SHA256: &str =
    "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8";
const SLM2_FORMAT_PROFILE_SHA256: &str =
    "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625";
const SLM2_RUNTIME_VECTOR_SHA256: &str =
    "c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1";

/// Exact Prompt2 2.0 profile identifier.
pub const PROMPT2_FORMAT_PROFILE_ID: &str = "org.minimodel.prompt2/2.0";

/// SHA-256 of the exact machine-readable Prompt2 profile bytes.
pub const PROMPT2_FORMAT_PROFILE_SHA256: &str =
    "b317ae0207522399e63125c57daf91d97432f95b26bd8fb71db746934ff05c8c";

/// SHA-256 of the sole canonical Prompt2 artifact.
pub const PROMPT2_ARTIFACT_SHA256: &str =
    "d3a123f327e7c4c3eb53d642c4b8d98c39a0b30bac2cc1970922612ae502f142";

/// Stable fail-closed Prompt2 error.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Prompt2Error {
    code: &'static str,
}

impl Prompt2Error {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for Prompt2Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Prompt2Error {}

/// Caller-selected ceiling for parsing the canonical Prompt2 artifact.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Prompt2Policy {
    maximum_artifact_bytes: u64,
}

impl Prompt2Policy {
    /// Creates a nonzero ceiling no larger than the frozen profile maximum.
    pub fn new(maximum_artifact_bytes: u64) -> Result<Self, Prompt2Error> {
        if maximum_artifact_bytes == 0 || maximum_artifact_bytes > ARTIFACT_BYTES as u64 {
            return Err(Prompt2Error::new("prompt2-policy"));
        }
        Ok(Self {
            maximum_artifact_bytes,
        })
    }

    /// Returns the exact frozen profile ceiling.
    pub const fn exact_profile_limits() -> Self {
        Self {
            maximum_artifact_bytes: ARTIFACT_BYTES as u64,
        }
    }

    /// Returns the admitted artifact byte ceiling.
    pub const fn maximum_artifact_bytes(self) -> u64 {
        self.maximum_artifact_bytes
    }
}

/// Exact whole-artifact identity.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Prompt2Identity {
    /// Exact artifact byte length.
    pub byte_length: u64,
    /// Plain SHA-256 over every exact artifact byte.
    pub sha256: [u8; 32],
}

/// Validated canonical Prompt2 artifact and its fixed composition policy.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Prompt2Artifact {
    identity: Prompt2Identity,
}

impl Prompt2Artifact {
    /// Parses and fully validates the sole canonical Prompt2 artifact.
    pub fn from_bytes(bytes: &[u8], policy: Prompt2Policy) -> Result<Self, Prompt2Error> {
        validate_profile_identity()?;
        if bytes.len() as u64 > policy.maximum_artifact_bytes {
            return Err(Prompt2Error::new("prompt2-artifact-limit"));
        }
        validate_header(bytes)?;
        if !all_zero(
            bytes
                .get(496..ARTIFACT_BYTES)
                .ok_or_else(|| Prompt2Error::new("prompt2-header"))?,
        ) {
            return Err(Prompt2Error::new("prompt2-reserved"));
        }
        validate_bound_fields(bytes)?;
        let digest: [u8; 32] = Sha256::digest(bytes).into();
        if hex_lower(&digest) != PROMPT2_ARTIFACT_SHA256 {
            return Err(Prompt2Error::new("prompt2-identity"));
        }
        Ok(Self {
            identity: Prompt2Identity {
                byte_length: bytes.len() as u64,
                sha256: digest,
            },
        })
    }

    /// Returns the exact whole-artifact identity.
    pub const fn identity(self) -> Prompt2Identity {
        self.identity
    }

    /// Returns the fixed model logit vocabulary size.
    pub const fn model_vocabulary_size(self) -> u32 {
        MODEL_VOCABULARY_SIZE
    }

    /// Returns the fixed maximum context-token count.
    pub const fn maximum_context_tokens(self) -> u32 {
        MAXIMUM_CONTEXT_TOKENS
    }

    /// Returns the exact ordered stop-token set owned by Template2.
    pub const fn stop_token_ids(self) -> [u32; 2] {
        STOP_TOKEN_IDS
    }
}

/// Writes the sole canonical Prompt2 artifact.
///
/// Durable callers must use an owned create-only same-directory staging file,
/// independently reparse and synchronize it, then promote it atomically.
pub fn write_prompt2<W: Write>(output: &mut W) -> Result<Prompt2Identity, Prompt2Error> {
    let artifact = canonical_artifact()?;
    output
        .write_all(&artifact)
        .map_err(|_| Prompt2Error::new("prompt2-write-failed"))?;
    let digest: [u8; 32] = Sha256::digest(artifact).into();
    Ok(Prompt2Identity {
        byte_length: artifact.len() as u64,
        sha256: digest,
    })
}

fn canonical_artifact() -> Result<[u8; ARTIFACT_BYTES], Prompt2Error> {
    validate_profile_identity()?;
    let mut artifact = [0_u8; ARTIFACT_BYTES];
    artifact[0..8].copy_from_slice(MAGIC);
    artifact[8..24].copy_from_slice(FORMAT_ID);
    put_u32(&mut artifact, 24, ARTIFACT_BYTES as u32)?;
    put_u16(&mut artifact, 28, 2)?;
    put_u16(&mut artifact, 30, 0)?;
    put_u32(&mut artifact, 32, 0x0102_0304)?;
    put_u32(&mut artifact, 36, 0)?;
    put_u64(&mut artifact, 40, ARTIFACT_BYTES as u64)?;
    put_u64(&mut artifact, 48, TOKENIZER_ARTIFACT_BYTES as u64)?;
    put_u64(&mut artifact, 56, TEMPLATE_ARTIFACT_BYTES as u64)?;
    put_u64(&mut artifact, 64, SAMPLING_ARTIFACT_BYTES as u64)?;
    put_u64(&mut artifact, 72, ARTIFACT_BYTES as u64)?;
    put_u32(&mut artifact, 80, TOKENIZER_TOKEN_COUNT)?;
    put_u32(&mut artifact, 84, MODEL_VOCABULARY_SIZE)?;
    put_u32(&mut artifact, 88, MAXIMUM_MESSAGES)?;
    put_u32(&mut artifact, 92, MAXIMUM_CONTROL_INSERTIONS)?;
    put_u32(&mut artifact, 96, MAXIMUM_MESSAGE_CONTENT_BYTES)?;
    put_u32(&mut artifact, 100, MAXIMUM_TOTAL_CONTENT_BYTES)?;
    put_u32(&mut artifact, 104, MAXIMUM_RENDERED_BYTES)?;
    put_u32(&mut artifact, 108, MAXIMUM_PROMPT_TOKENS)?;
    put_u32(&mut artifact, 112, MAXIMUM_CONTEXT_TOKENS)?;
    put_u32(&mut artifact, 116, MAXIMUM_NEW_TOKENS)?;
    put_u32(&mut artifact, 120, MAXIMUM_STOP_TOKENS)?;
    put_u32(&mut artifact, 124, STOP_TOKEN_IDS.len() as u32)?;
    put_u32(&mut artifact, 128, STOP_TOKEN_IDS[0])?;
    put_u32(&mut artifact, 132, STOP_TOKEN_IDS[1])?;
    put_u16(&mut artifact, 136, 0)?;
    put_u16(&mut artifact, 138, 0)?;
    put_u16(&mut artifact, 140, 1)?;
    put_u16(&mut artifact, 142, 1)?;
    put_digest(&mut artifact, 144, TOKENIZER_PROFILE_SHA256)?;
    put_digest(&mut artifact, 176, TOKENIZER_ARTIFACT_SHA256)?;
    put_digest(&mut artifact, 208, TEMPLATE_PROFILE_SHA256)?;
    put_digest(&mut artifact, 240, TEMPLATE_ARTIFACT_SHA256)?;
    put_digest(&mut artifact, 272, SAMPLING_PROFILE_SHA256)?;
    put_digest(&mut artifact, 304, SAMPLING_ARTIFACT_SHA256)?;
    put_digest(&mut artifact, 336, SAMPLING_TABLE_SHA256)?;
    put_digest(&mut artifact, 368, SOURCE_MODEL_CONFIG_SHA256)?;
    put_digest(&mut artifact, 400, SOURCE_TEMPLATE_SHA256)?;
    put_digest(&mut artifact, 432, SLM2_FORMAT_PROFILE_SHA256)?;
    put_digest(&mut artifact, 464, SLM2_RUNTIME_VECTOR_SHA256)?;
    let digest: [u8; 32] = Sha256::digest(artifact).into();
    if hex_lower(&digest) != PROMPT2_ARTIFACT_SHA256 {
        return Err(Prompt2Error::new("prompt2-identity"));
    }
    Ok(artifact)
}

fn validate_header(bytes: &[u8]) -> Result<(), Prompt2Error> {
    if bytes.len() != ARTIFACT_BYTES
        || bytes.get(0..8) != Some(MAGIC)
        || bytes.get(8..24) != Some(FORMAT_ID)
        || get_u32(bytes, 24)? != ARTIFACT_BYTES as u32
        || get_u16(bytes, 28)? != 2
        || get_u16(bytes, 30)? != 0
        || get_u32(bytes, 32)? != 0x0102_0304
        || get_u32(bytes, 36)? != 0
        || get_u64(bytes, 40)? != ARTIFACT_BYTES as u64
    {
        return Err(Prompt2Error::new("prompt2-header"));
    }
    Ok(())
}

fn validate_bound_fields(bytes: &[u8]) -> Result<(), Prompt2Error> {
    let fields_match = get_u64(bytes, 48)? == TOKENIZER_ARTIFACT_BYTES as u64
        && get_u64(bytes, 56)? == TEMPLATE_ARTIFACT_BYTES as u64
        && get_u64(bytes, 64)? == SAMPLING_ARTIFACT_BYTES as u64
        && get_u64(bytes, 72)? == ARTIFACT_BYTES as u64
        && get_u32(bytes, 80)? == TOKENIZER_TOKEN_COUNT
        && get_u32(bytes, 84)? == MODEL_VOCABULARY_SIZE
        && get_u32(bytes, 88)? == MAXIMUM_MESSAGES
        && get_u32(bytes, 92)? == MAXIMUM_CONTROL_INSERTIONS
        && get_u32(bytes, 96)? == MAXIMUM_MESSAGE_CONTENT_BYTES
        && get_u32(bytes, 100)? == MAXIMUM_TOTAL_CONTENT_BYTES
        && get_u32(bytes, 104)? == MAXIMUM_RENDERED_BYTES
        && get_u32(bytes, 108)? == MAXIMUM_PROMPT_TOKENS
        && get_u32(bytes, 112)? == MAXIMUM_CONTEXT_TOKENS
        && get_u32(bytes, 116)? == MAXIMUM_NEW_TOKENS
        && get_u32(bytes, 120)? == MAXIMUM_STOP_TOKENS
        && get_u32(bytes, 124)? == STOP_TOKEN_IDS.len() as u32
        && get_u32(bytes, 128)? == STOP_TOKEN_IDS[0]
        && get_u32(bytes, 132)? == STOP_TOKEN_IDS[1]
        && get_u16(bytes, 136)? == 0
        && get_u16(bytes, 138)? == 0
        && get_u16(bytes, 140)? == 1
        && get_u16(bytes, 142)? == 1;
    if !fields_match {
        return Err(Prompt2Error::new("prompt2-header"));
    }
    let digests = [
        (144, TOKENIZER_PROFILE_SHA256),
        (176, TOKENIZER_ARTIFACT_SHA256),
        (208, TEMPLATE_PROFILE_SHA256),
        (240, TEMPLATE_ARTIFACT_SHA256),
        (272, SAMPLING_PROFILE_SHA256),
        (304, SAMPLING_ARTIFACT_SHA256),
        (336, SAMPLING_TABLE_SHA256),
        (368, SOURCE_MODEL_CONFIG_SHA256),
        (400, SOURCE_TEMPLATE_SHA256),
        (432, SLM2_FORMAT_PROFILE_SHA256),
        (464, SLM2_RUNTIME_VECTOR_SHA256),
    ];
    for (offset, expected) in digests {
        if bytes.get(offset..offset + 32) != Some(decode_hex_32(expected)?.as_slice()) {
            return Err(Prompt2Error::new("prompt2-dependency-identity"));
        }
    }
    Ok(())
}

pub(crate) fn validate_profile_identity() -> Result<(), Prompt2Error> {
    if hex_lower(&Sha256::digest(PROFILE_BYTES)) != PROMPT2_FORMAT_PROFILE_SHA256 {
        return Err(Prompt2Error::new("prompt2-profile-drift"));
    }
    Ok(())
}

pub(crate) fn digest_matches(bytes: &[u8], expected: &str) -> Result<bool, Prompt2Error> {
    let digest: [u8; 32] = Sha256::digest(bytes).into();
    Ok(digest == decode_hex_32(expected)?)
}

pub(crate) fn align_up(value: usize) -> Result<usize, Prompt2Error> {
    let remainder = value % SECTION_ALIGNMENT;
    if remainder == 0 {
        Ok(value)
    } else {
        value
            .checked_add(SECTION_ALIGNMENT - remainder)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))
    }
}

pub(crate) fn all_zero(bytes: &[u8]) -> bool {
    bytes.iter().all(|byte| *byte == 0)
}

pub(crate) fn get_u16(bytes: &[u8], offset: usize) -> Result<u16, Prompt2Error> {
    Ok(u16::from_le_bytes(
        bytes
            .get(offset..offset + 2)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
            .try_into()
            .map_err(|_| Prompt2Error::new("prompt2-arithmetic"))?,
    ))
}

pub(crate) fn get_u32(bytes: &[u8], offset: usize) -> Result<u32, Prompt2Error> {
    Ok(u32::from_le_bytes(
        bytes
            .get(offset..offset + 4)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
            .try_into()
            .map_err(|_| Prompt2Error::new("prompt2-arithmetic"))?,
    ))
}

pub(crate) fn get_u64(bytes: &[u8], offset: usize) -> Result<u64, Prompt2Error> {
    Ok(u64::from_le_bytes(
        bytes
            .get(offset..offset + 8)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
            .try_into()
            .map_err(|_| Prompt2Error::new("prompt2-arithmetic"))?,
    ))
}

pub(crate) fn put_u16(bytes: &mut [u8], offset: usize, value: u16) -> Result<(), Prompt2Error> {
    bytes
        .get_mut(offset..offset + 2)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

pub(crate) fn put_u32(bytes: &mut [u8], offset: usize, value: u32) -> Result<(), Prompt2Error> {
    bytes
        .get_mut(offset..offset + 4)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

pub(crate) fn put_u64(bytes: &mut [u8], offset: usize, value: u64) -> Result<(), Prompt2Error> {
    bytes
        .get_mut(offset..offset + 8)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn put_digest(bytes: &mut [u8], offset: usize, value: &str) -> Result<(), Prompt2Error> {
    bytes
        .get_mut(offset..offset + 32)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?
        .copy_from_slice(&decode_hex_32(value)?);
    Ok(())
}

fn decode_hex_32(value: &str) -> Result<[u8; 32], Prompt2Error> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(Prompt2Error::new("prompt2-dependency-identity"));
    }
    let mut output = [0_u8; 32];
    for (index, byte) in output.iter_mut().enumerate() {
        let high = hex_nibble(value.as_bytes()[index * 2])?;
        let low = hex_nibble(value.as_bytes()[index * 2 + 1])?;
        *byte = (high << 4) | low;
    }
    Ok(output)
}

fn hex_nibble(value: u8) -> Result<u8, Prompt2Error> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err(Prompt2Error::new("prompt2-dependency-identity")),
    }
}

pub(crate) fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}
