use std::collections::HashSet;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::Write;

use sha2::{Digest, Sha256};

pub(crate) const HEADER_BYTES: u64 = 256;
pub(crate) const SECTION_ALIGNMENT: u64 = 64;
pub(crate) const LITERAL_RECORD_BYTES: u64 = 24;
pub(crate) const LITERAL_COUNT: u32 = 31;
pub(crate) const NONE_TOKEN_ID: u32 = u32::MAX;
pub(crate) const MAXIMUM_ARTIFACT_BYTES: u64 = 1_048_576;
pub(crate) const MAXIMUM_MESSAGES: u32 = 256;
pub(crate) const MAXIMUM_MESSAGE_CONTENT_BYTES: u32 = 262_144;
pub(crate) const MAXIMUM_TOTAL_CONTENT_BYTES: u32 = 1_048_576;
pub(crate) const MAXIMUM_RENDERED_BYTES: u32 = 1_114_112;
pub(crate) const MAXIMUM_PROMPT_TOKENS: u32 = 40_960;
pub(crate) const TOKENIZER_ARTIFACT_BYTES: u64 = 7_038_773;
pub(crate) const TOKENIZER_TOKEN_COUNT: u32 = 151_669;
pub(crate) const MODEL_VOCABULARY_SIZE: u32 = 151_936;
pub(crate) const END_OF_TEXT_TOKEN_ID: u32 = 151_643;
pub(crate) const MESSAGE_START_TOKEN_ID: u32 = 151_644;
pub(crate) const MESSAGE_END_TOKEN_ID: u32 = 151_645;
pub(crate) const THINKING_START_TOKEN_ID: u32 = 151_667;
pub(crate) const THINKING_END_TOKEN_ID: u32 = 151_668;
pub(crate) const FLAG_RENDERER_EMITTED: u16 = 1;
pub(crate) const FLAG_FORBIDDEN_CONTENT: u16 = 2;
pub(crate) const FLAG_ADDED_TOKEN: u16 = 4;
pub(crate) const FLAG_SPECIAL_TOKEN: u16 = 8;
pub(crate) const KNOWN_LITERAL_FLAGS: u16 = 15;
pub(crate) const MAGIC: &[u8; 8] = b"TPL2\r\n\x1a\n";
pub(crate) const FORMAT_ID: &[u8; 16] = b"minimodel.tpl2\0\0";

/// Exact Template2 2.0 profile identifier.
pub const TEMPLATE2_FORMAT_PROFILE_ID: &str = "org.minimodel.template2/2.0";

/// SHA-256 of the exact machine-readable Template2 profile bytes.
pub const TEMPLATE2_FORMAT_PROFILE_SHA256: &str =
    "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa";

/// SHA-256 of the sole canonical Qwen3 Template2 artifact.
pub const QWEN3_TEMPLATE2_ARTIFACT_SHA256: &str =
    "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8";

pub(crate) const TOKENIZER_SHA256: [u8; 32] = [
    0xcb, 0xbf, 0x90, 0x7e, 0xd9, 0x51, 0x50, 0xc4, 0xdb, 0x92, 0x0c, 0x36, 0xce, 0xe9, 0xab, 0x13,
    0xec, 0xa2, 0xa3, 0xc6, 0xd2, 0xdc, 0xff, 0xb6, 0xbf, 0x5d, 0x7a, 0xc5, 0xb9, 0x5b, 0x8f, 0x7b,
];
pub(crate) const SOURCE_TEMPLATE_SHA256: [u8; 32] = [
    0xa5, 0x5e, 0xe1, 0xb1, 0x66, 0x01, 0x28, 0xb7, 0x09, 0x87, 0x23, 0xe0, 0xab, 0xcd, 0x92, 0xca,
    0xa0, 0x78, 0x80, 0x61, 0x05, 0x1c, 0x62, 0xd5, 0x1c, 0xbe, 0x87, 0xd9, 0xcf, 0x19, 0x74, 0xd8,
];
pub(crate) const SOURCE_MODEL_CONFIG_SHA256: [u8; 32] = [
    0x66, 0x0d, 0xb3, 0xb7, 0x3d, 0x78, 0x81, 0x19, 0xc0, 0x45, 0x35, 0xe4, 0x8c, 0xf9, 0xbe, 0x5f,
    0x55, 0xbc, 0x31, 0x00, 0x84, 0x1a, 0x71, 0x86, 0x37, 0xae, 0x69, 0x5b, 0x44, 0x2f, 0x27, 0xdd,
];

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/template2-format-profile.v1.json");

#[derive(Clone, Copy, Debug)]
pub(crate) struct ExpectedLiteral {
    pub kind: u16,
    pub bytes: &'static [u8],
    pub flags: u16,
    pub token_id: u32,
}

pub(crate) const EXPECTED_LITERALS: [ExpectedLiteral; 31] = [
    expected(1, b"<|im_start|>", 15, MESSAGE_START_TOKEN_ID),
    expected(2, b"<|im_end|>", 15, MESSAGE_END_TOKEN_ID),
    expected(3, b"system", 1, NONE_TOKEN_ID),
    expected(4, b"user", 1, NONE_TOKEN_ID),
    expected(5, b"assistant", 1, NONE_TOKEN_ID),
    expected(6, b"\n", 1, NONE_TOKEN_ID),
    expected(7, b"<think>\n\n</think>\n\n", 1, NONE_TOKEN_ID),
    expected(8, b"<|endoftext|>", 14, 151_643),
    expected(8, b"<|object_ref_start|>", 14, 151_646),
    expected(8, b"<|object_ref_end|>", 14, 151_647),
    expected(8, b"<|box_start|>", 14, 151_648),
    expected(8, b"<|box_end|>", 14, 151_649),
    expected(8, b"<|quad_start|>", 14, 151_650),
    expected(8, b"<|quad_end|>", 14, 151_651),
    expected(8, b"<|vision_start|>", 14, 151_652),
    expected(8, b"<|vision_end|>", 14, 151_653),
    expected(8, b"<|vision_pad|>", 14, 151_654),
    expected(8, b"<|image_pad|>", 14, 151_655),
    expected(8, b"<|video_pad|>", 14, 151_656),
    expected(8, b"<tool_call>", 6, 151_657),
    expected(8, b"</tool_call>", 6, 151_658),
    expected(8, b"<|fim_prefix|>", 6, 151_659),
    expected(8, b"<|fim_middle|>", 6, 151_660),
    expected(8, b"<|fim_suffix|>", 6, 151_661),
    expected(8, b"<|fim_pad|>", 6, 151_662),
    expected(8, b"<|repo_name|>", 6, 151_663),
    expected(8, b"<|file_sep|>", 6, 151_664),
    expected(8, b"<tool_response>", 6, 151_665),
    expected(8, b"</tool_response>", 6, 151_666),
    expected(8, b"<think>", 6, THINKING_START_TOKEN_ID),
    expected(8, b"</think>", 6, THINKING_END_TOKEN_ID),
];

const fn expected(kind: u16, bytes: &'static [u8], flags: u16, token_id: u32) -> ExpectedLiteral {
    ExpectedLiteral {
        kind,
        bytes,
        flags,
        token_id,
    }
}

/// Stable fail-closed Template2 error.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Template2Error {
    code: &'static str,
}

impl Template2Error {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for Template2Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Template2Error {}

/// Whole-artifact identity returned by the canonical writer and parser.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TemplateIdentity {
    /// Exact artifact byte length.
    pub byte_length: u64,
    /// Plain SHA-256 over every exact artifact byte.
    pub sha256: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct Layout {
    pub file_size: u64,
    pub literal_table_offset: u64,
    pub literal_table_end: u64,
    pub byte_table_offset: u64,
    pub byte_table_length: u64,
}

/// Writes the sole canonical Qwen3 Template2 2.0 artifact.
///
/// Callers requiring durable publication must write to a create-only owned
/// same-directory staging file, reparse and sync it, then promote atomically.
pub fn write_template<W: Write>(output: &mut W) -> Result<TemplateIdentity, Template2Error> {
    let artifact = canonical_artifact()?;
    output
        .write_all(&artifact)
        .map_err(|_| Template2Error::new("template2-write-failed"))?;
    Ok(TemplateIdentity {
        byte_length: artifact.len() as u64,
        sha256: Sha256::digest(&artifact).into(),
    })
}

pub(crate) fn validate_profile_identity() -> Result<(), Template2Error> {
    if hex_lower(&Sha256::digest(PROFILE_BYTES)) != TEMPLATE2_FORMAT_PROFILE_SHA256 {
        return Err(Template2Error::new("template2-profile-drift"));
    }
    Ok(())
}

pub(crate) fn canonical_layout() -> Result<Layout, Template2Error> {
    let literal_table_offset = HEADER_BYTES;
    let literal_table_length = u64::from(LITERAL_COUNT)
        .checked_mul(LITERAL_RECORD_BYTES)
        .ok_or_else(|| Template2Error::new("template2-layout"))?;
    let literal_table_end = literal_table_offset
        .checked_add(literal_table_length)
        .ok_or_else(|| Template2Error::new("template2-layout"))?;
    let byte_table_offset = align_up(literal_table_end, SECTION_ALIGNMENT)?;
    let byte_table_length = EXPECTED_LITERALS.iter().try_fold(0_u64, |total, literal| {
        total
            .checked_add(literal.bytes.len() as u64)
            .ok_or_else(|| Template2Error::new("template2-layout"))
    })?;
    let file_size = byte_table_offset
        .checked_add(byte_table_length)
        .ok_or_else(|| Template2Error::new("template2-layout"))?;
    Ok(Layout {
        file_size,
        literal_table_offset,
        literal_table_end,
        byte_table_offset,
        byte_table_length,
    })
}

fn canonical_artifact() -> Result<Vec<u8>, Template2Error> {
    validate_profile_identity()?;
    validate_expected_literals()?;
    let layout = canonical_layout()?;
    let file_size = usize::try_from(layout.file_size)
        .map_err(|_| Template2Error::new("template2-file-size"))?;
    let mut artifact = vec![0_u8; file_size];
    artifact[0..8].copy_from_slice(MAGIC);
    artifact[8..24].copy_from_slice(FORMAT_ID);
    put_u32(&mut artifact, 24, HEADER_BYTES as u32);
    put_u16(&mut artifact, 28, 2);
    put_u16(&mut artifact, 30, 0);
    put_u32(&mut artifact, 32, 0x0102_0304);
    put_u16(&mut artifact, 36, 1);
    put_u64(&mut artifact, 40, layout.file_size);
    put_u64(&mut artifact, 48, layout.literal_table_offset);
    put_u32(&mut artifact, 56, LITERAL_COUNT);
    put_u32(&mut artifact, 60, LITERAL_RECORD_BYTES as u32);
    put_u64(&mut artifact, 64, layout.byte_table_offset);
    put_u64(&mut artifact, 72, layout.byte_table_length);
    artifact[80..112].copy_from_slice(&TOKENIZER_SHA256);
    artifact[112..144].copy_from_slice(&SOURCE_TEMPLATE_SHA256);
    artifact[144..176].copy_from_slice(&SOURCE_MODEL_CONFIG_SHA256);
    put_u32(&mut artifact, 176, 4_168);
    put_u64(&mut artifact, 180, TOKENIZER_ARTIFACT_BYTES);
    put_u32(&mut artifact, 188, TOKENIZER_TOKEN_COUNT);
    put_u32(&mut artifact, 192, MODEL_VOCABULARY_SIZE);
    put_u32(&mut artifact, 196, MESSAGE_START_TOKEN_ID);
    put_u32(&mut artifact, 200, MESSAGE_END_TOKEN_ID);
    put_u32(&mut artifact, 204, MESSAGE_END_TOKEN_ID);
    put_u32(&mut artifact, 208, END_OF_TEXT_TOKEN_ID);
    put_u32(&mut artifact, 212, MAXIMUM_MESSAGES);
    put_u32(&mut artifact, 216, MAXIMUM_MESSAGE_CONTENT_BYTES);
    put_u32(&mut artifact, 220, MAXIMUM_TOTAL_CONTENT_BYTES);
    put_u32(&mut artifact, 224, MAXIMUM_RENDERED_BYTES);
    put_u32(&mut artifact, 228, MAXIMUM_PROMPT_TOKENS);
    put_u16(&mut artifact, 234, 3);
    put_u16(&mut artifact, 236, 1);
    put_u16(&mut artifact, 238, 1);
    put_u16(&mut artifact, 240, 1);
    put_u16(&mut artifact, 244, 1);

    let mut relative_offset = 0_u64;
    for (index, literal) in EXPECTED_LITERALS.iter().enumerate() {
        let record_offset =
            layout.literal_table_offset as usize + index * LITERAL_RECORD_BYTES as usize;
        put_u64(&mut artifact, record_offset, relative_offset);
        put_u32(
            &mut artifact,
            record_offset + 8,
            u32::try_from(literal.bytes.len())
                .map_err(|_| Template2Error::new("template2-literal-record"))?,
        );
        put_u16(&mut artifact, record_offset + 12, literal.kind);
        put_u16(&mut artifact, record_offset + 14, literal.flags);
        put_u32(&mut artifact, record_offset + 16, literal.token_id);
        let byte_offset = usize::try_from(layout.byte_table_offset + relative_offset)
            .map_err(|_| Template2Error::new("template2-layout"))?;
        artifact[byte_offset..byte_offset + literal.bytes.len()].copy_from_slice(literal.bytes);
        relative_offset = relative_offset
            .checked_add(literal.bytes.len() as u64)
            .ok_or_else(|| Template2Error::new("template2-layout"))?;
    }
    if relative_offset != layout.byte_table_length {
        return Err(Template2Error::new("template2-layout"));
    }
    Ok(artifact)
}

fn validate_expected_literals() -> Result<(), Template2Error> {
    if EXPECTED_LITERALS.len() != LITERAL_COUNT as usize {
        return Err(Template2Error::new("template2-literal-count"));
    }
    let mut bytes = HashSet::with_capacity(EXPECTED_LITERALS.len());
    let mut token_ids = HashSet::with_capacity(EXPECTED_LITERALS.len());
    for (index, literal) in EXPECTED_LITERALS.iter().enumerate() {
        let expected_kind = if index < 7 { index as u16 + 1 } else { 8 };
        if literal.kind != expected_kind
            || literal.bytes.is_empty()
            || std::str::from_utf8(literal.bytes).is_err()
            || literal.flags & !KNOWN_LITERAL_FLAGS != 0
            || literal.flags & FLAG_RENDERER_EMITTED == 0 && index < 7
            || literal.flags & FLAG_SPECIAL_TOKEN != 0 && literal.flags & FLAG_ADDED_TOKEN == 0
            || ((literal.flags & FLAG_ADDED_TOKEN != 0) == (literal.token_id == NONE_TOKEN_ID))
            || literal.token_id != NONE_TOKEN_ID && literal.token_id >= TOKENIZER_TOKEN_COUNT
        {
            return Err(Template2Error::new("template2-literal-profile"));
        }
        if !bytes.insert(literal.bytes) {
            return Err(Template2Error::new("template2-duplicate-literal"));
        }
        if literal.token_id != NONE_TOKEN_ID && !token_ids.insert(literal.token_id) {
            return Err(Template2Error::new("template2-duplicate-token-id"));
        }
    }
    Ok(())
}

fn align_up(value: u64, alignment: u64) -> Result<u64, Template2Error> {
    let mask = alignment - 1;
    value
        .checked_add(mask)
        .map(|sum| sum & !mask)
        .ok_or_else(|| Template2Error::new("template2-layout"))
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

pub(crate) fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
