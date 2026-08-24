use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::Write;

use sha2::{Digest, Sha256};

/// Exact machine-readable Tokenizer2 profile identifier.
pub const TOKENIZER2_FORMAT_PROFILE_ID: &str = "org.minimodel.tokenizer2/2.0";
/// SHA-256 of the exact checked-in Tokenizer2 profile bytes.
pub const TOKENIZER2_FORMAT_PROFILE_SHA256: &str =
    "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de";
/// Exact byte length of the sole Qwen3 Tokenizer2 artifact bound by Prompt2.
pub const QWEN3_TOKENIZER2_ARTIFACT_BYTES: u64 = 7_038_773;
/// SHA-256 of the sole Qwen3 Tokenizer2 artifact bound by Prompt2.
pub const QWEN3_TOKENIZER2_ARTIFACT_SHA256: &str =
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";

pub(crate) const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/tokenizer2-format-profile.v1.json");
pub(crate) const MAGIC: &[u8; 8] = b"TOK2\r\n\x1a\n";
pub(crate) const FORMAT_ID: &[u8; 16] = b"minimodel.tok2\0\0";
pub(crate) const HEADER_BYTES: u64 = 192;
pub(crate) const SECTION_ALIGNMENT: u64 = 64;
pub(crate) const TOKEN_RECORD_BYTES: u64 = 24;
pub(crate) const MERGE_RECORD_BYTES: u64 = 16;
pub(crate) const NONE_TOKEN_ID: u32 = u32::MAX;
pub(crate) const MAXIMUM_EXACT_FILE_BYTES: u64 = 9_007_199_254_740_991;
pub(crate) const MAXIMUM_TOKENS: u32 = 1_048_576;
pub(crate) const MAXIMUM_ADDED_TOKENS: u32 = 65_536;
pub(crate) const MAXIMUM_MERGES: u32 = 1_048_576;
pub(crate) const MAXIMUM_TOKEN_BYTES: u32 = 1_048_576;
pub(crate) const TOKEN_FLAG_ADDED: u32 = 1;
pub(crate) const TOKEN_FLAG_SPECIAL: u32 = 2;
pub(crate) const TOKEN_FLAGS_MASK: u32 = TOKEN_FLAG_ADDED | TOKEN_FLAG_SPECIAL;

pub(crate) const BYTE_ORDER_MARKER: u32 = 0x0102_0304;
pub(crate) const ALGORITHM_PROFILE: u16 = 1;
pub(crate) const NORMALIZER_PROFILE: u16 = 1;
pub(crate) const PRETOKENIZER_PROFILE: u16 = 1;
pub(crate) const DECODER_PROFILE: u16 = 1;
pub(crate) const ADDED_MATCH_PROFILE: u16 = 1;
pub(crate) const NORMALIZATION_UNICODE: (u16, u16, u16) = (9, 0, 0);
pub(crate) const CATEGORY_UNICODE: (u16, u16, u16) = (16, 0, 0);

/// Stable bounded Tokenizer2 failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Tokenizer2Error {
    code: &'static str,
}

impl Tokenizer2Error {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for Tokenizer2Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Tokenizer2Error {}

/// One token in canonical ascending implicit-ID order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TokenDefinition<'a> {
    /// Exact decoded bytes emitted by this token.
    pub bytes: &'a [u8],
    /// Whether this token is matched atomically before normalization.
    pub added: bool,
    /// Whether decode-with-special-skipping omits this added token.
    pub special: bool,
}

/// One ranked BPE merge in ascending implicit-rank order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MergeDefinition {
    /// Left input token ID.
    pub left: u32,
    /// Right input token ID.
    pub right: u32,
    /// Output token ID, which must equal `256 + rank`.
    pub output: u32,
}

/// Complete declarative input for one canonical Tokenizer2 artifact.
#[derive(Clone, Copy, Debug)]
pub struct TokenizerSpec<'a> {
    /// All tokens in exact ascending ID order.
    pub tokens: &'a [TokenDefinition<'a>],
    /// Number of base BPE tokens before the contiguous added-token range.
    pub base_token_count: u32,
    /// All merge records in exact ascending rank order.
    pub merges: &'a [MergeDefinition],
    /// Optional beginning-of-sequence token ID; never automatically inserted.
    pub bos_token_id: Option<u32>,
    /// Optional end-of-sequence token ID.
    pub eos_token_id: Option<u32>,
    /// Optional padding token ID.
    pub pad_token_id: Option<u32>,
    /// Optional unknown token ID; algorithm profile 1 requires absence.
    pub unk_token_id: Option<u32>,
}

/// Whole-artifact identity returned by the canonical writer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TokenizerIdentity {
    /// Exact artifact byte length.
    pub byte_length: u64,
    /// Plain SHA-256 over all exact artifact bytes.
    pub sha256: [u8; 32],
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Layout {
    pub file_size: u64,
    pub token_table_offset: u64,
    pub merge_table_offset: u64,
    pub byte_table_offset: u64,
    pub byte_table_length: u64,
    pub maximum_token_bytes: u32,
}

/// Writes one canonical Tokenizer2 artifact after validating the complete spec.
///
/// The function validates every relationship before emitting the first byte.
/// Callers that require fail-atomic persistence must provide a create-only
/// same-directory staging file and promote it only after independent parsing.
pub fn write_tokenizer<W: Write>(
    spec: &TokenizerSpec<'_>,
    output: &mut W,
) -> Result<TokenizerIdentity, Tokenizer2Error> {
    validate_profile_identity()?;
    let layout = validate_spec(spec)?;
    let token_count = u32::try_from(spec.tokens.len())
        .map_err(|_| Tokenizer2Error::new("tokenizer2-token-count"))?;
    let merge_count = u32::try_from(spec.merges.len())
        .map_err(|_| Tokenizer2Error::new("tokenizer2-merge-count"))?;
    let added_token_count = token_count
        .checked_sub(spec.base_token_count)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-added-count"))?;

    let mut header = [0_u8; HEADER_BYTES as usize];
    header[0..8].copy_from_slice(MAGIC);
    header[8..24].copy_from_slice(FORMAT_ID);
    put_u32(&mut header, 24, HEADER_BYTES as u32);
    put_u16(&mut header, 28, 2);
    put_u16(&mut header, 30, 0);
    put_u32(&mut header, 32, BYTE_ORDER_MARKER);
    put_u16(&mut header, 36, ALGORITHM_PROFILE);
    put_u64(&mut header, 40, layout.file_size);
    put_u64(&mut header, 48, layout.token_table_offset);
    put_u32(&mut header, 56, token_count);
    put_u32(&mut header, 60, TOKEN_RECORD_BYTES as u32);
    put_u64(&mut header, 64, layout.merge_table_offset);
    put_u32(&mut header, 72, merge_count);
    put_u32(&mut header, 76, MERGE_RECORD_BYTES as u32);
    put_u64(&mut header, 80, layout.byte_table_offset);
    put_u64(&mut header, 88, layout.byte_table_length);
    put_u32(&mut header, 96, spec.base_token_count);
    put_u32(&mut header, 100, added_token_count);
    put_u32(&mut header, 104, encode_optional_id(spec.bos_token_id));
    put_u32(&mut header, 108, encode_optional_id(spec.eos_token_id));
    put_u32(&mut header, 112, encode_optional_id(spec.pad_token_id));
    put_u32(&mut header, 116, encode_optional_id(spec.unk_token_id));
    put_u32(&mut header, 120, layout.maximum_token_bytes);
    put_u16(&mut header, 124, NORMALIZER_PROFILE);
    put_u16(&mut header, 126, PRETOKENIZER_PROFILE);
    put_u16(&mut header, 128, DECODER_PROFILE);
    put_u16(&mut header, 130, ADDED_MATCH_PROFILE);
    put_u16(&mut header, 132, NORMALIZATION_UNICODE.0);
    put_u16(&mut header, 134, NORMALIZATION_UNICODE.1);
    put_u16(&mut header, 136, NORMALIZATION_UNICODE.2);
    put_u16(&mut header, 138, CATEGORY_UNICODE.0);
    put_u16(&mut header, 140, CATEGORY_UNICODE.1);
    put_u16(&mut header, 142, CATEGORY_UNICODE.2);

    let mut hasher = Sha256::new();
    let mut emitted = 0_u64;
    emit(output, &mut hasher, &mut emitted, &header)?;

    let mut relative_offset = 0_u64;
    for token in spec.tokens {
        let mut record = [0_u8; TOKEN_RECORD_BYTES as usize];
        put_u64(&mut record, 0, relative_offset);
        put_u32(
            &mut record,
            8,
            u32::try_from(token.bytes.len())
                .map_err(|_| Tokenizer2Error::new("tokenizer2-token-length"))?,
        );
        let flags = (u32::from(token.added) * TOKEN_FLAG_ADDED)
            | (u32::from(token.special) * TOKEN_FLAG_SPECIAL);
        put_u32(&mut record, 12, flags);
        emit(output, &mut hasher, &mut emitted, &record)?;
        relative_offset = relative_offset
            .checked_add(token.bytes.len() as u64)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-byte-table-length"))?;
    }
    emit_zeros_to(output, &mut hasher, &mut emitted, layout.merge_table_offset)?;

    for merge in spec.merges {
        let mut record = [0_u8; MERGE_RECORD_BYTES as usize];
        put_u32(&mut record, 0, merge.left);
        put_u32(&mut record, 4, merge.right);
        put_u32(&mut record, 8, merge.output);
        emit(output, &mut hasher, &mut emitted, &record)?;
    }
    emit_zeros_to(output, &mut hasher, &mut emitted, layout.byte_table_offset)?;

    for token in spec.tokens {
        emit(output, &mut hasher, &mut emitted, token.bytes)?;
    }
    if emitted != layout.file_size {
        return Err(Tokenizer2Error::new("tokenizer2-writer-length"));
    }

    Ok(TokenizerIdentity {
        byte_length: emitted,
        sha256: hasher.finalize().into(),
    })
}

pub(crate) fn validate_profile_identity() -> Result<(), Tokenizer2Error> {
    let digest = Sha256::digest(PROFILE_BYTES);
    if hex_lower(&digest) != TOKENIZER2_FORMAT_PROFILE_SHA256 {
        return Err(Tokenizer2Error::new("tokenizer2-profile-drift"));
    }
    if unicode_normalization_alignments::UNICODE_VERSION != (9, 0, 0)
        || unicode_general_category::UNICODE_VERSION != (16, 0, 0)
    {
        return Err(Tokenizer2Error::new("tokenizer2-unicode-drift"));
    }
    Ok(())
}

fn validate_spec(spec: &TokenizerSpec<'_>) -> Result<Layout, Tokenizer2Error> {
    let token_count = u32::try_from(spec.tokens.len())
        .map_err(|_| Tokenizer2Error::new("tokenizer2-token-count"))?;
    let merge_count = u32::try_from(spec.merges.len())
        .map_err(|_| Tokenizer2Error::new("tokenizer2-merge-count"))?;
    if !(256..=MAXIMUM_TOKENS).contains(&token_count) {
        return Err(Tokenizer2Error::new("tokenizer2-token-count"));
    }
    if merge_count > MAXIMUM_MERGES
        || spec.base_token_count
            != 256_u32
                .checked_add(merge_count)
                .ok_or_else(|| Tokenizer2Error::new("tokenizer2-base-closure"))?
        || spec.base_token_count > token_count
    {
        return Err(Tokenizer2Error::new("tokenizer2-base-closure"));
    }
    let added_count = token_count - spec.base_token_count;
    if added_count > MAXIMUM_ADDED_TOKENS {
        return Err(Tokenizer2Error::new("tokenizer2-added-count"));
    }
    validate_optional_ids(spec, token_count)?;

    let mut byte_owner = [NONE_TOKEN_ID; 256];
    let mut token_ids_by_bytes = HashMap::with_capacity(spec.tokens.len());
    let mut byte_table_length = 0_u64;
    let mut maximum_token_bytes = 0_u32;
    for (index, token) in spec.tokens.iter().enumerate() {
        let id = index as u32;
        let length = u32::try_from(token.bytes.len())
            .map_err(|_| Tokenizer2Error::new("tokenizer2-token-length"))?;
        if length == 0 || length > MAXIMUM_TOKEN_BYTES {
            return Err(Tokenizer2Error::new("tokenizer2-token-length"));
        }
        if id < spec.base_token_count {
            if token.added || token.special {
                return Err(Tokenizer2Error::new("tokenizer2-token-flags"));
            }
        } else if !token.added {
            return Err(Tokenizer2Error::new("tokenizer2-token-flags"));
        } else if std::str::from_utf8(token.bytes).is_err() {
            return Err(Tokenizer2Error::new("tokenizer2-added-utf8"));
        }
        if token_ids_by_bytes.insert(token.bytes, id).is_some() {
            return Err(Tokenizer2Error::new("tokenizer2-duplicate-token"));
        }
        if id < 256 {
            if length != 1 {
                return Err(Tokenizer2Error::new("tokenizer2-byte-alphabet"));
            }
            let byte = token.bytes[0] as usize;
            if byte_owner[byte] != NONE_TOKEN_ID {
                return Err(Tokenizer2Error::new("tokenizer2-byte-alphabet"));
            }
            byte_owner[byte] = id;
        }
        byte_table_length = byte_table_length
            .checked_add(u64::from(length))
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-byte-table-length"))?;
        maximum_token_bytes = maximum_token_bytes.max(length);
    }
    if byte_owner.contains(&NONE_TOKEN_ID) {
        return Err(Tokenizer2Error::new("tokenizer2-byte-alphabet"));
    }

    let mut pairs = HashSet::with_capacity(spec.merges.len());
    let mut outputs = HashSet::with_capacity(spec.merges.len());
    for (rank, merge) in spec.merges.iter().enumerate() {
        let expected_output = 256_u32
            .checked_add(rank as u32)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-merge-output"))?;
        if merge.left >= spec.base_token_count
            || merge.right >= spec.base_token_count
            || merge.output != expected_output
            || merge.output >= spec.base_token_count
        {
            return Err(Tokenizer2Error::new("tokenizer2-merge-id"));
        }
        if !pairs.insert((merge.left, merge.right)) {
            return Err(Tokenizer2Error::new("tokenizer2-duplicate-merge"));
        }
        if !outputs.insert(merge.output) {
            return Err(Tokenizer2Error::new("tokenizer2-duplicate-output"));
        }
        let left = spec.tokens[merge.left as usize].bytes;
        let right = spec.tokens[merge.right as usize].bytes;
        let output = spec.tokens[merge.output as usize].bytes;
        if output.len() != left.len().saturating_add(right.len())
            || !output.starts_with(left)
            || !output.ends_with(right)
        {
            return Err(Tokenizer2Error::new("tokenizer2-merge-bytes"));
        }
    }

    canonical_layout(
        token_count,
        merge_count,
        byte_table_length,
        maximum_token_bytes,
    )
}

fn validate_optional_ids(
    spec: &TokenizerSpec<'_>,
    token_count: u32,
) -> Result<(), Tokenizer2Error> {
    for id in [spec.bos_token_id, spec.eos_token_id, spec.pad_token_id]
        .into_iter()
        .flatten()
    {
        if id >= token_count {
            return Err(Tokenizer2Error::new("tokenizer2-special-id"));
        }
    }
    if spec.unk_token_id.is_some() {
        return Err(Tokenizer2Error::new("tokenizer2-unknown-token-forbidden"));
    }
    Ok(())
}

pub(crate) fn canonical_layout(
    token_count: u32,
    merge_count: u32,
    byte_table_length: u64,
    maximum_token_bytes: u32,
) -> Result<Layout, Tokenizer2Error> {
    let token_table_length = u64::from(token_count)
        .checked_mul(TOKEN_RECORD_BYTES)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?;
    let merge_table_offset = align_up(
        HEADER_BYTES
            .checked_add(token_table_length)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?,
        SECTION_ALIGNMENT,
    )?;
    let merge_table_length = u64::from(merge_count)
        .checked_mul(MERGE_RECORD_BYTES)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?;
    let byte_table_offset = align_up(
        merge_table_offset
            .checked_add(merge_table_length)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?,
        SECTION_ALIGNMENT,
    )?;
    let file_size = byte_table_offset
        .checked_add(byte_table_length)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?;
    if file_size > MAXIMUM_EXACT_FILE_BYTES {
        return Err(Tokenizer2Error::new("tokenizer2-file-size"));
    }
    Ok(Layout {
        file_size,
        token_table_offset: HEADER_BYTES,
        merge_table_offset,
        byte_table_offset,
        byte_table_length,
        maximum_token_bytes,
    })
}

fn align_up(value: u64, alignment: u64) -> Result<u64, Tokenizer2Error> {
    let mask = alignment - 1;
    value
        .checked_add(mask)
        .map(|sum| sum & !mask)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))
}

fn emit<W: Write>(
    output: &mut W,
    hasher: &mut Sha256,
    emitted: &mut u64,
    bytes: &[u8],
) -> Result<(), Tokenizer2Error> {
    output
        .write_all(bytes)
        .map_err(|_| Tokenizer2Error::new("tokenizer2-write-failed"))?;
    hasher.update(bytes);
    *emitted = emitted
        .checked_add(bytes.len() as u64)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-writer-length"))?;
    Ok(())
}

fn emit_zeros_to<W: Write>(
    output: &mut W,
    hasher: &mut Sha256,
    emitted: &mut u64,
    target: u64,
) -> Result<(), Tokenizer2Error> {
    if *emitted > target {
        return Err(Tokenizer2Error::new("tokenizer2-writer-layout"));
    }
    const ZEROES: [u8; 64] = [0; 64];
    while *emitted < target {
        let remaining = (target - *emitted) as usize;
        emit(
            output,
            hasher,
            emitted,
            &ZEROES[..remaining.min(ZEROES.len())],
        )?;
    }
    Ok(())
}

const fn encode_optional_id(value: Option<u32>) -> u32 {
    match value {
        Some(id) => id,
        None => NONE_TOKEN_ID,
    }
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

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
