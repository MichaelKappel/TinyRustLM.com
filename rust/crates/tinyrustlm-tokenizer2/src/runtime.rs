use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet};

use sha2::{Digest, Sha256};
use unicode_general_category::{get_general_category, GeneralCategory};
use unicode_normalization_alignments::UnicodeNormalization;

use crate::format::{
    canonical_layout, validate_profile_identity, Layout, Tokenizer2Error, TokenizerIdentity,
    ADDED_MATCH_PROFILE, ALGORITHM_PROFILE, BYTE_ORDER_MARKER, CATEGORY_UNICODE, DECODER_PROFILE,
    FORMAT_ID, HEADER_BYTES, MAGIC, MAXIMUM_ADDED_TOKENS, MAXIMUM_MERGES, MAXIMUM_TOKENS,
    MAXIMUM_TOKEN_BYTES, MERGE_RECORD_BYTES, NONE_TOKEN_ID, NORMALIZATION_UNICODE,
    NORMALIZER_PROFILE, PRETOKENIZER_PROFILE, TOKEN_FLAGS_MASK, TOKEN_FLAG_ADDED,
    TOKEN_FLAG_SPECIAL, TOKEN_RECORD_BYTES,
};

/// Exact resource ceilings for parsing and executing one Tokenizer2 artifact.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TokenizerPolicy {
    maximum_artifact_bytes: u64,
    maximum_input_bytes: u32,
    maximum_output_tokens: u32,
    maximum_decoded_bytes: u32,
}

impl TokenizerPolicy {
    /// Creates a nonzero bounded policy.
    pub fn new(
        maximum_artifact_bytes: u64,
        maximum_input_bytes: u32,
        maximum_output_tokens: u32,
        maximum_decoded_bytes: u32,
    ) -> Result<Self, Tokenizer2Error> {
        if maximum_artifact_bytes < HEADER_BYTES
            || maximum_input_bytes == 0
            || maximum_output_tokens == 0
            || maximum_decoded_bytes == 0
        {
            return Err(Tokenizer2Error::new("tokenizer2-invalid-policy"));
        }
        Ok(Self {
            maximum_artifact_bytes,
            maximum_input_bytes,
            maximum_output_tokens,
            maximum_decoded_bytes,
        })
    }

    /// Returns the maximum admitted artifact length.
    pub const fn maximum_artifact_bytes(self) -> u64 {
        self.maximum_artifact_bytes
    }

    /// Returns the maximum admitted input UTF-8 byte length.
    pub const fn maximum_input_bytes(self) -> u32 {
        self.maximum_input_bytes
    }

    /// Returns the maximum emitted or decoded input token count.
    pub const fn maximum_output_tokens(self) -> u32 {
        self.maximum_output_tokens
    }

    /// Returns the maximum assembled decoded byte length.
    pub const fn maximum_decoded_bytes(self) -> u32 {
        self.maximum_decoded_bytes
    }
}

/// Controls whether decoding includes exact special-token bytes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DecodeMode {
    /// Include every token byte string, including special added tokens.
    IncludeAll,
    /// Omit only added tokens whose canonical record has the special bit.
    SkipSpecial,
}

#[derive(Clone, Copy, Debug)]
struct TokenRecord {
    byte_offset: usize,
    byte_length: usize,
    flags: u32,
}

#[derive(Clone, Copy, Debug)]
struct MergeValue {
    output: u32,
    rank: u32,
}

#[derive(Clone, Copy, Debug)]
struct AddedToken {
    id: u32,
    byte_offset: usize,
    byte_length: usize,
}

#[derive(Debug)]
struct ParsedTokens {
    records: Vec<TokenRecord>,
    byte_token_ids: [u32; 256],
    added_tokens: Vec<AddedToken>,
}

/// Fully validated canonical Tokenizer2 artifact and deterministic runtime.
#[derive(Clone, Debug)]
pub struct Tokenizer2 {
    artifact: Vec<u8>,
    identity: TokenizerIdentity,
    records: Vec<TokenRecord>,
    merges: HashMap<u64, MergeValue>,
    byte_token_ids: [u32; 256],
    added_tokens: Vec<AddedToken>,
    base_token_count: u32,
    bos_token_id: Option<u32>,
    eos_token_id: Option<u32>,
    pad_token_id: Option<u32>,
    policy: TokenizerPolicy,
}

impl Tokenizer2 {
    /// Parses and fully validates one exact canonical Tokenizer2 artifact.
    pub fn from_bytes(artifact: Vec<u8>, policy: TokenizerPolicy) -> Result<Self, Tokenizer2Error> {
        validate_profile_identity()?;
        let parsed = ParsedHeader::parse(&artifact, policy)?;
        let identity = TokenizerIdentity {
            byte_length: artifact.len() as u64,
            sha256: Sha256::digest(&artifact).into(),
        };
        let parsed_tokens = parse_tokens(&artifact, &parsed)?;
        let merges = parse_merges(&artifact, &parsed, &parsed_tokens.records)?;
        let ParsedTokens {
            records,
            byte_token_ids,
            mut added_tokens,
        } = parsed_tokens;

        added_tokens.sort_by(|left, right| {
            right
                .byte_length
                .cmp(&left.byte_length)
                .then(left.id.cmp(&right.id))
        });
        Ok(Self {
            artifact,
            identity,
            records,
            merges,
            byte_token_ids,
            added_tokens,
            base_token_count: parsed.base_token_count,
            bos_token_id: parsed.bos_token_id,
            eos_token_id: parsed.eos_token_id,
            pad_token_id: parsed.pad_token_id,
            policy,
        })
    }

    /// Returns the exact whole-artifact identity.
    pub const fn identity(&self) -> TokenizerIdentity {
        self.identity
    }

    /// Returns the complete vocabulary size.
    pub fn token_count(&self) -> u32 {
        self.records.len() as u32
    }

    /// Returns the base BPE vocabulary size.
    pub const fn base_token_count(&self) -> u32 {
        self.base_token_count
    }

    /// Returns the optional beginning-of-sequence token ID.
    pub const fn bos_token_id(&self) -> Option<u32> {
        self.bos_token_id
    }

    /// Returns the optional end-of-sequence token ID.
    pub const fn eos_token_id(&self) -> Option<u32> {
        self.eos_token_id
    }

    /// Returns the optional padding token ID.
    pub const fn pad_token_id(&self) -> Option<u32> {
        self.pad_token_id
    }

    /// Encodes UTF-8 text with exact added-token, NFC, split, ByteLevel, and BPE semantics.
    pub fn encode(&self, text: &str, output: &mut Vec<u32>) -> Result<(), Tokenizer2Error> {
        output.clear();
        if text.len() > self.policy.maximum_input_bytes as usize {
            return Err(Tokenizer2Error::new("tokenizer2-input-limit"));
        }

        let mut encoded = Vec::new();
        let mut offset = 0_usize;
        while offset < text.len() {
            if let Some((length, id)) = self.added_at(text.as_bytes(), offset) {
                push_token(&mut encoded, id, self.policy.maximum_output_tokens)?;
                offset += length;
                continue;
            }

            let start = offset;
            offset = next_char_end(text, offset)
                .ok_or_else(|| Tokenizer2Error::new("tokenizer2-input-boundary"))?;
            while offset < text.len() && self.added_at(text.as_bytes(), offset).is_none() {
                offset = next_char_end(text, offset)
                    .ok_or_else(|| Tokenizer2Error::new("tokenizer2-input-boundary"))?;
            }
            self.encode_unmatched_span(&text[start..offset], &mut encoded)?;
        }

        *output = encoded;
        Ok(())
    }

    /// Decodes token IDs under the selected explicit special-token mode.
    pub fn decode(
        &self,
        tokens: &[u32],
        mode: DecodeMode,
        output: &mut String,
    ) -> Result<(), Tokenizer2Error> {
        output.clear();
        if tokens.len() > self.policy.maximum_output_tokens as usize {
            return Err(Tokenizer2Error::new("tokenizer2-token-limit"));
        }
        let mut bytes = Vec::new();
        for id in tokens {
            let record = self
                .records
                .get(*id as usize)
                .ok_or_else(|| Tokenizer2Error::new("tokenizer2-unknown-id"))?;
            if mode == DecodeMode::SkipSpecial && record.flags & TOKEN_FLAG_SPECIAL != 0 {
                continue;
            }
            let next_length = bytes
                .len()
                .checked_add(record.byte_length)
                .ok_or_else(|| Tokenizer2Error::new("tokenizer2-decode-limit"))?;
            if next_length > self.policy.maximum_decoded_bytes as usize {
                return Err(Tokenizer2Error::new("tokenizer2-decode-limit"));
            }
            bytes.extend_from_slice(self.token_bytes(record));
        }
        let decoded = String::from_utf8(bytes)
            .map_err(|_| Tokenizer2Error::new("tokenizer2-decoded-utf8"))?;
        *output = decoded;
        Ok(())
    }

    fn encode_unmatched_span(
        &self,
        span: &str,
        output: &mut Vec<u32>,
    ) -> Result<(), Tokenizer2Error> {
        let normalized: String = span.nfc().map(|entry| entry.0).collect();
        if normalized.len() > self.policy.maximum_input_bytes as usize {
            return Err(Tokenizer2Error::new("tokenizer2-normalized-limit"));
        }
        let mut offset = 0_usize;
        while offset < normalized.len() {
            let end = next_pretoken_end(&normalized, offset)?;
            self.encode_pretoken(&normalized.as_bytes()[offset..end], output)?;
            offset = end;
        }
        Ok(())
    }

    fn encode_pretoken(&self, bytes: &[u8], output: &mut Vec<u32>) -> Result<(), Tokenizer2Error> {
        let initial: Vec<u32> = bytes
            .iter()
            .map(|byte| self.byte_token_ids[*byte as usize])
            .collect();
        let merged = apply_bpe(&initial, &self.merges);
        let next_length = output
            .len()
            .checked_add(merged.len())
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-output-limit"))?;
        if next_length > self.policy.maximum_output_tokens as usize {
            return Err(Tokenizer2Error::new("tokenizer2-output-limit"));
        }
        output.extend_from_slice(&merged);
        Ok(())
    }

    fn added_at(&self, input: &[u8], offset: usize) -> Option<(usize, u32)> {
        self.added_tokens.iter().find_map(|added| {
            let end = offset.checked_add(added.byte_length)?;
            let candidate = input.get(offset..end)?;
            let expected = self
                .artifact
                .get(added.byte_offset..added.byte_offset + added.byte_length)?;
            (candidate == expected).then_some((added.byte_length, added.id))
        })
    }

    fn token_bytes(&self, record: &TokenRecord) -> &[u8] {
        &self.artifact[record.byte_offset..record.byte_offset + record.byte_length]
    }
}

#[derive(Clone, Copy, Debug)]
struct ParsedHeader {
    token_count: u32,
    merge_count: u32,
    base_token_count: u32,
    added_token_count: u32,
    bos_token_id: Option<u32>,
    eos_token_id: Option<u32>,
    pad_token_id: Option<u32>,
    maximum_token_bytes: u32,
    layout: Layout,
}

impl ParsedHeader {
    fn parse(bytes: &[u8], policy: TokenizerPolicy) -> Result<Self, Tokenizer2Error> {
        let file_size =
            u64::try_from(bytes.len()).map_err(|_| Tokenizer2Error::new("tokenizer2-file-size"))?;
        if file_size > policy.maximum_artifact_bytes || bytes.len() < HEADER_BYTES as usize {
            return Err(Tokenizer2Error::new("tokenizer2-file-size"));
        }
        if bytes.get(0..8) != Some(MAGIC)
            || bytes.get(8..24) != Some(FORMAT_ID)
            || read_u32(bytes, 24)? != HEADER_BYTES as u32
            || read_u16(bytes, 28)? != 2
            || read_u16(bytes, 30)? != 0
            || read_u32(bytes, 32)? != BYTE_ORDER_MARKER
            || read_u16(bytes, 36)? != ALGORITHM_PROFILE
            || read_u16(bytes, 38)? != 0
            || read_u64(bytes, 40)? != file_size
        {
            return Err(Tokenizer2Error::new("tokenizer2-header"));
        }
        if read_u32(bytes, 60)? != TOKEN_RECORD_BYTES as u32
            || read_u32(bytes, 76)? != MERGE_RECORD_BYTES as u32
            || read_u16(bytes, 124)? != NORMALIZER_PROFILE
            || read_u16(bytes, 126)? != PRETOKENIZER_PROFILE
            || read_u16(bytes, 128)? != DECODER_PROFILE
            || read_u16(bytes, 130)? != ADDED_MATCH_PROFILE
            || (
                read_u16(bytes, 132)?,
                read_u16(bytes, 134)?,
                read_u16(bytes, 136)?,
            ) != NORMALIZATION_UNICODE
            || (
                read_u16(bytes, 138)?,
                read_u16(bytes, 140)?,
                read_u16(bytes, 142)?,
            ) != CATEGORY_UNICODE
            || bytes[144..HEADER_BYTES as usize]
                .iter()
                .any(|byte| *byte != 0)
        {
            return Err(Tokenizer2Error::new("tokenizer2-profile"));
        }

        let token_count = read_u32(bytes, 56)?;
        let merge_count = read_u32(bytes, 72)?;
        let base_token_count = read_u32(bytes, 96)?;
        let added_token_count = read_u32(bytes, 100)?;
        let maximum_token_bytes = read_u32(bytes, 120)?;
        let byte_table_length = read_u64(bytes, 88)?;
        if !(256..=MAXIMUM_TOKENS).contains(&token_count)
            || merge_count > MAXIMUM_MERGES
            || added_token_count > MAXIMUM_ADDED_TOKENS
            || base_token_count != 256_u32.saturating_add(merge_count)
            || base_token_count
                .checked_add(added_token_count)
                .filter(|sum| *sum == token_count)
                .is_none()
            || maximum_token_bytes == 0
            || maximum_token_bytes > MAXIMUM_TOKEN_BYTES
        {
            return Err(Tokenizer2Error::new("tokenizer2-counts"));
        }
        if read_u32(bytes, 116)? != NONE_TOKEN_ID {
            return Err(Tokenizer2Error::new("tokenizer2-unknown-token-forbidden"));
        }
        let bos_token_id = decode_optional_id(read_u32(bytes, 104)?, token_count)?;
        let eos_token_id = decode_optional_id(read_u32(bytes, 108)?, token_count)?;
        let pad_token_id = decode_optional_id(read_u32(bytes, 112)?, token_count)?;
        let layout = canonical_layout(
            token_count,
            merge_count,
            byte_table_length,
            maximum_token_bytes,
        )?;
        if read_u64(bytes, 48)? != layout.token_table_offset
            || read_u64(bytes, 64)? != layout.merge_table_offset
            || read_u64(bytes, 80)? != layout.byte_table_offset
            || layout.file_size != file_size
        {
            return Err(Tokenizer2Error::new("tokenizer2-layout"));
        }
        let token_end = layout
            .token_table_offset
            .checked_add(u64::from(token_count) * TOKEN_RECORD_BYTES)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?;
        let merge_end = layout
            .merge_table_offset
            .checked_add(u64::from(merge_count) * MERGE_RECORD_BYTES)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-layout-overflow"))?;
        ensure_zero_range(bytes, token_end, layout.merge_table_offset)?;
        ensure_zero_range(bytes, merge_end, layout.byte_table_offset)?;

        Ok(Self {
            token_count,
            merge_count,
            base_token_count,
            added_token_count,
            bos_token_id,
            eos_token_id,
            pad_token_id,
            maximum_token_bytes,
            layout,
        })
    }
}

fn parse_tokens(artifact: &[u8], header: &ParsedHeader) -> Result<ParsedTokens, Tokenizer2Error> {
    let mut records = Vec::with_capacity(header.token_count as usize);
    let mut byte_token_ids = [NONE_TOKEN_ID; 256];
    let mut added_tokens = Vec::with_capacity(header.added_token_count as usize);
    let mut byte_strings = HashMap::<Vec<u8>, u32>::with_capacity(header.token_count as usize);
    let mut expected_relative_offset = 0_u64;
    let mut actual_maximum = 0_u32;

    for id in 0..header.token_count {
        let record_offset = header
            .layout
            .token_table_offset
            .checked_add(u64::from(id) * TOKEN_RECORD_BYTES)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-token-record"))?;
        let record_offset = usize::try_from(record_offset)
            .map_err(|_| Tokenizer2Error::new("tokenizer2-token-record"))?;
        let relative_offset = read_u64(artifact, record_offset)?;
        let byte_length = read_u32(artifact, record_offset + 8)?;
        let flags = read_u32(artifact, record_offset + 12)?;
        if read_u64(artifact, record_offset + 16)? != 0
            || relative_offset != expected_relative_offset
            || byte_length == 0
            || byte_length > MAXIMUM_TOKEN_BYTES
            || flags & !TOKEN_FLAGS_MASK != 0
        {
            return Err(Tokenizer2Error::new("tokenizer2-token-record"));
        }
        if id < header.base_token_count {
            if flags != 0 {
                return Err(Tokenizer2Error::new("tokenizer2-token-flags"));
            }
        } else if flags & TOKEN_FLAG_ADDED == 0 {
            return Err(Tokenizer2Error::new("tokenizer2-token-flags"));
        }

        let absolute_offset = header
            .layout
            .byte_table_offset
            .checked_add(relative_offset)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-token-range"))?;
        let absolute_end = absolute_offset
            .checked_add(u64::from(byte_length))
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-token-range"))?;
        if absolute_end > header.layout.file_size {
            return Err(Tokenizer2Error::new("tokenizer2-token-range"));
        }
        let absolute_offset = usize::try_from(absolute_offset)
            .map_err(|_| Tokenizer2Error::new("tokenizer2-token-range"))?;
        let absolute_end = usize::try_from(absolute_end)
            .map_err(|_| Tokenizer2Error::new("tokenizer2-token-range"))?;
        let token_bytes = &artifact[absolute_offset..absolute_end];
        if byte_strings.insert(token_bytes.to_vec(), id).is_some() {
            return Err(Tokenizer2Error::new("tokenizer2-duplicate-token"));
        }
        if id < 256 {
            if byte_length != 1 || byte_token_ids[token_bytes[0] as usize] != NONE_TOKEN_ID {
                return Err(Tokenizer2Error::new("tokenizer2-byte-alphabet"));
            }
            byte_token_ids[token_bytes[0] as usize] = id;
        }
        if flags & TOKEN_FLAG_ADDED != 0 {
            std::str::from_utf8(token_bytes)
                .map_err(|_| Tokenizer2Error::new("tokenizer2-added-utf8"))?;
            added_tokens.push(AddedToken {
                id,
                byte_offset: absolute_offset,
                byte_length: byte_length as usize,
            });
        }
        records.push(TokenRecord {
            byte_offset: absolute_offset,
            byte_length: byte_length as usize,
            flags,
        });
        expected_relative_offset = expected_relative_offset
            .checked_add(u64::from(byte_length))
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-byte-table-length"))?;
        actual_maximum = actual_maximum.max(byte_length);
    }
    if expected_relative_offset != header.layout.byte_table_length
        || actual_maximum != header.maximum_token_bytes
        || byte_token_ids.contains(&NONE_TOKEN_ID)
        || added_tokens.len() != header.added_token_count as usize
    {
        return Err(Tokenizer2Error::new("tokenizer2-token-closure"));
    }
    Ok(ParsedTokens {
        records,
        byte_token_ids,
        added_tokens,
    })
}

fn parse_merges(
    artifact: &[u8],
    header: &ParsedHeader,
    records: &[TokenRecord],
) -> Result<HashMap<u64, MergeValue>, Tokenizer2Error> {
    let mut merges = HashMap::with_capacity(header.merge_count as usize);
    let mut outputs = HashSet::with_capacity(header.merge_count as usize);
    for rank in 0..header.merge_count {
        let offset = header
            .layout
            .merge_table_offset
            .checked_add(u64::from(rank) * MERGE_RECORD_BYTES)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-merge-record"))?;
        let offset =
            usize::try_from(offset).map_err(|_| Tokenizer2Error::new("tokenizer2-merge-record"))?;
        let left = read_u32(artifact, offset)?;
        let right = read_u32(artifact, offset + 4)?;
        let output = read_u32(artifact, offset + 8)?;
        if read_u32(artifact, offset + 12)? != 0
            || left >= header.base_token_count
            || right >= header.base_token_count
            || output != 256 + rank
            || output >= header.base_token_count
        {
            return Err(Tokenizer2Error::new("tokenizer2-merge-record"));
        }
        let key = pair_key(left, right);
        if merges.insert(key, MergeValue { output, rank }).is_some() {
            return Err(Tokenizer2Error::new("tokenizer2-duplicate-merge"));
        }
        if !outputs.insert(output) {
            return Err(Tokenizer2Error::new("tokenizer2-duplicate-output"));
        }
        let left_bytes = record_bytes(artifact, &records[left as usize]);
        let right_bytes = record_bytes(artifact, &records[right as usize]);
        let output_bytes = record_bytes(artifact, &records[output as usize]);
        if output_bytes.len() != left_bytes.len().saturating_add(right_bytes.len())
            || !output_bytes.starts_with(left_bytes)
            || !output_bytes.ends_with(right_bytes)
        {
            return Err(Tokenizer2Error::new("tokenizer2-merge-bytes"));
        }
    }
    if outputs.len() != header.base_token_count.saturating_sub(256) as usize {
        return Err(Tokenizer2Error::new("tokenizer2-merge-closure"));
    }
    Ok(merges)
}

fn record_bytes<'a>(artifact: &'a [u8], record: &TokenRecord) -> &'a [u8] {
    &artifact[record.byte_offset..record.byte_offset + record.byte_length]
}

#[derive(Clone, Copy, Debug)]
struct BpeNode {
    id: u32,
    previous: Option<usize>,
    next: Option<usize>,
    generation: u32,
    active: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct BpeCandidate {
    rank: u32,
    left: usize,
    right: usize,
    left_generation: u32,
    right_generation: u32,
    output: u32,
}

impl Ord for BpeCandidate {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .rank
            .cmp(&self.rank)
            .then_with(|| other.left.cmp(&self.left))
            .then_with(|| other.right.cmp(&self.right))
            .then_with(|| other.left_generation.cmp(&self.left_generation))
            .then_with(|| other.right_generation.cmp(&self.right_generation))
    }
}

impl PartialOrd for BpeCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn apply_bpe(initial: &[u32], merges: &HashMap<u64, MergeValue>) -> Vec<u32> {
    if initial.len() < 2 {
        return initial.to_vec();
    }
    let mut nodes: Vec<BpeNode> = initial
        .iter()
        .enumerate()
        .map(|(index, id)| BpeNode {
            id: *id,
            previous: index.checked_sub(1),
            next: (index + 1 < initial.len()).then_some(index + 1),
            generation: 0,
            active: true,
        })
        .collect();
    let mut candidates = BinaryHeap::new();
    for left in 0..initial.len() - 1 {
        push_candidate(left, &nodes, merges, &mut candidates);
    }

    while let Some(candidate) = candidates.pop() {
        if !candidate_is_current(candidate, &nodes, merges) {
            continue;
        }
        let previous = nodes[candidate.left].previous;
        let next = nodes[candidate.right].next;
        nodes[candidate.left].id = candidate.output;
        nodes[candidate.left].next = next;
        nodes[candidate.left].generation = nodes[candidate.left].generation.wrapping_add(1);
        nodes[candidate.right].active = false;
        nodes[candidate.right].generation = nodes[candidate.right].generation.wrapping_add(1);
        if let Some(next_index) = next {
            nodes[next_index].previous = Some(candidate.left);
        }
        if let Some(previous_index) = previous {
            push_candidate(previous_index, &nodes, merges, &mut candidates);
        }
        push_candidate(candidate.left, &nodes, merges, &mut candidates);
    }

    let mut output = Vec::new();
    let mut current = Some(0_usize);
    while let Some(index) = current {
        if nodes[index].active {
            output.push(nodes[index].id);
        }
        current = nodes[index].next;
    }
    output
}

fn push_candidate(
    left: usize,
    nodes: &[BpeNode],
    merges: &HashMap<u64, MergeValue>,
    candidates: &mut BinaryHeap<BpeCandidate>,
) {
    if !nodes[left].active {
        return;
    }
    let Some(right) = nodes[left].next else {
        return;
    };
    if !nodes[right].active {
        return;
    }
    let Some(merge) = merges.get(&pair_key(nodes[left].id, nodes[right].id)) else {
        return;
    };
    candidates.push(BpeCandidate {
        rank: merge.rank,
        left,
        right,
        left_generation: nodes[left].generation,
        right_generation: nodes[right].generation,
        output: merge.output,
    });
}

fn candidate_is_current(
    candidate: BpeCandidate,
    nodes: &[BpeNode],
    merges: &HashMap<u64, MergeValue>,
) -> bool {
    let left = nodes[candidate.left];
    let right = nodes[candidate.right];
    left.active
        && right.active
        && left.next == Some(candidate.right)
        && left.generation == candidate.left_generation
        && right.generation == candidate.right_generation
        && merges
            .get(&pair_key(left.id, right.id))
            .is_some_and(|merge| merge.rank == candidate.rank && merge.output == candidate.output)
}

const fn pair_key(left: u32, right: u32) -> u64 {
    (left as u64) << 32 | right as u64
}

fn next_pretoken_end(text: &str, start: usize) -> Result<usize, Tokenizer2Error> {
    let (current, current_end) = char_at(text, start)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-pretokenizer-boundary"))?;

    if current == '\'' {
        for suffix in ["s", "t", "re", "ve", "m", "ll", "d"] {
            if let Some(end) = folded_ascii_suffix_end(text, current_end, suffix) {
                return Ok(end);
            }
        }
    }

    if is_letter(current) {
        return Ok(consume_while(text, current_end, is_letter));
    }
    if current != '\r' && current != '\n' && !is_letter(current) && !is_number(current) {
        if let Some((next, next_end)) = char_at(text, current_end) {
            if is_letter(next) {
                return Ok(consume_while(text, next_end, is_letter));
            }
        }
    }

    if is_number(current) {
        return Ok(current_end);
    }

    let mut symbol_start = start;
    if current == ' ' {
        let Some((next, _)) = char_at(text, current_end) else {
            return whitespace_end(text, start, current);
        };
        if !is_space(next) && !is_letter(next) && !is_number(next) {
            symbol_start = current_end;
        }
    }
    if symbol_start < text.len() {
        let (symbol, symbol_end) = char_at(text, symbol_start)
            .ok_or_else(|| Tokenizer2Error::new("tokenizer2-pretokenizer-boundary"))?;
        if !is_space(symbol) && !is_letter(symbol) && !is_number(symbol) {
            let mut end = consume_while(text, symbol_end, |value| {
                !is_space(value) && !is_letter(value) && !is_number(value)
            });
            end = consume_while(text, end, |value| value == '\r' || value == '\n');
            return Ok(end);
        }
    }

    whitespace_end(text, start, current)
}

fn whitespace_end(text: &str, start: usize, current: char) -> Result<usize, Tokenizer2Error> {
    if !is_space(current) {
        return Err(Tokenizer2Error::new("tokenizer2-pretokenizer-gap"));
    }
    let mut cursor = start;
    let mut last_line_end = None;
    let mut boundaries = Vec::new();
    while let Some((value, end)) = char_at(text, cursor) {
        if !is_space(value) {
            break;
        }
        boundaries.push(end);
        if value == '\r' || value == '\n' {
            last_line_end = Some(end);
        }
        cursor = end;
    }
    if let Some(end) = last_line_end {
        return Ok(end);
    }
    if cursor == text.len() {
        return Ok(cursor);
    }
    if boundaries.len() >= 2 {
        return Ok(boundaries[boundaries.len() - 2]);
    }
    Ok(cursor)
}

fn folded_ascii_suffix_end(text: &str, start: usize, suffix: &str) -> Option<usize> {
    let mut offset = start;
    for expected in suffix.chars() {
        let (actual, end) = char_at(text, offset)?;
        if !folds_to_ascii(actual, expected) {
            return None;
        }
        offset = end;
    }
    Some(offset)
}

fn folds_to_ascii(actual: char, expected: char) -> bool {
    actual.eq_ignore_ascii_case(&expected) || expected == 's' && actual == '\u{017f}'
}

fn consume_while(text: &str, mut offset: usize, predicate: impl Fn(char) -> bool) -> usize {
    while let Some((value, end)) = char_at(text, offset) {
        if !predicate(value) {
            break;
        }
        offset = end;
    }
    offset
}

fn char_at(text: &str, offset: usize) -> Option<(char, usize)> {
    let value = text.get(offset..)?.chars().next()?;
    Some((value, offset + value.len_utf8()))
}

fn next_char_end(text: &str, offset: usize) -> Option<usize> {
    char_at(text, offset).map(|(_, end)| end)
}

fn is_letter(value: char) -> bool {
    matches!(
        get_general_category(value),
        GeneralCategory::UppercaseLetter
            | GeneralCategory::LowercaseLetter
            | GeneralCategory::TitlecaseLetter
            | GeneralCategory::ModifierLetter
            | GeneralCategory::OtherLetter
    )
}

fn is_number(value: char) -> bool {
    matches!(
        get_general_category(value),
        GeneralCategory::DecimalNumber
            | GeneralCategory::LetterNumber
            | GeneralCategory::OtherNumber
    )
}

fn is_space(value: char) -> bool {
    matches!(
        value,
        '\u{0009}'..='\u{000d}'
            | '\u{0020}'
            | '\u{0085}'
            | '\u{00a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
    )
}

fn push_token(output: &mut Vec<u32>, id: u32, maximum: u32) -> Result<(), Tokenizer2Error> {
    if output.len() >= maximum as usize {
        return Err(Tokenizer2Error::new("tokenizer2-output-limit"));
    }
    output.push(id);
    Ok(())
}

fn decode_optional_id(value: u32, token_count: u32) -> Result<Option<u32>, Tokenizer2Error> {
    if value == NONE_TOKEN_ID {
        return Ok(None);
    }
    if value >= token_count {
        return Err(Tokenizer2Error::new("tokenizer2-special-id"));
    }
    Ok(Some(value))
}

fn ensure_zero_range(bytes: &[u8], start: u64, end: u64) -> Result<(), Tokenizer2Error> {
    let start = usize::try_from(start).map_err(|_| Tokenizer2Error::new("tokenizer2-padding"))?;
    let end = usize::try_from(end).map_err(|_| Tokenizer2Error::new("tokenizer2-padding"))?;
    let range = bytes
        .get(start..end)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-padding"))?;
    if range.iter().any(|byte| *byte != 0) {
        return Err(Tokenizer2Error::new("tokenizer2-padding"));
    }
    Ok(())
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, Tokenizer2Error> {
    let end = offset
        .checked_add(2)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-truncated"))?;
    let value = bytes
        .get(offset..end)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-truncated"))?;
    Ok(u16::from_le_bytes(value.try_into().map_err(|_| {
        Tokenizer2Error::new("tokenizer2-truncated")
    })?))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, Tokenizer2Error> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-truncated"))?;
    let value = bytes
        .get(offset..end)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-truncated"))?;
    Ok(u32::from_le_bytes(value.try_into().map_err(|_| {
        Tokenizer2Error::new("tokenizer2-truncated")
    })?))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, Tokenizer2Error> {
    let end = offset
        .checked_add(8)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-truncated"))?;
    let value = bytes
        .get(offset..end)
        .ok_or_else(|| Tokenizer2Error::new("tokenizer2-truncated"))?;
    Ok(u64::from_le_bytes(value.try_into().map_err(|_| {
        Tokenizer2Error::new("tokenizer2-truncated")
    })?))
}
