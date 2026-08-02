//! Local tokenizers for TinyRustLM model files.

use crate::errors::ErrorCode;
use std::collections::HashMap;
use std::convert::TryInto;

/// Beginning-of-sequence token.
pub const BOS: u32 = 256;
/// End-of-sequence token.
pub const EOS: u32 = 257;
/// Padding token.
pub const PAD: u32 = 258;
/// Unknown token.
pub const UNK: u32 = 259;
/// Vocabulary size for phase-one byte tokenization.
pub const BYTE_VOCAB_SIZE: u32 = 260;

/// Tokenizer selected from a loaded `.slm` tokenizer section.
#[derive(Clone, Debug)]
pub enum Tokenizer {
    /// Fixed byte-tokenizer path used by phase-one models.
    Byte(ByteTokenizer),
    /// Custom BPE tokenizer path used by phase-two models.
    Bpe(CustomBpeTokenizer),
    /// Llama-compatible byte-fallback BPE tokenizer used by trained imports.
    LlamaBpe(LlamaBpeTokenizer),
    /// GPT2-compatible ByteLevel BPE tokenizer used by SmolLM-style imports.
    Gpt2Bpe(Gpt2BpeTokenizer),
}

impl Tokenizer {
    /// Parses a tokenizer section from `.slm` model bytes.
    ///
    /// `section` must point only at the tokenizer payload declared by the
    /// model header. The return value is the runtime tokenizer selected by
    /// the section magic.
    pub fn from_section(section: &[u8]) -> Result<Self, ErrorCode> {
        match section.get(0..4) {
            Some(b"BTOK") => {
                ByteTokenizer::validate_section(section)?;
                Ok(Self::Byte(ByteTokenizer::new()))
            }
            Some(b"BPE1") => Ok(Self::Bpe(CustomBpeTokenizer::from_section(section)?)),
            Some(b"LBPE") => Ok(Self::LlamaBpe(LlamaBpeTokenizer::from_section(section)?)),
            Some(b"GBPE") => Ok(Self::Gpt2Bpe(Gpt2BpeTokenizer::from_section(section)?)),
            _ => Err(ErrorCode::InvalidHeader),
        }
    }

    /// Encodes UTF-8 text into model token ids.
    ///
    /// `out` is cleared before tokens are written. The return value reports
    /// tokenizer validation or input-size failures.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        match self {
            Self::Byte(tokenizer) => tokenizer.encode(text, out),
            Self::Bpe(tokenizer) => tokenizer.encode(text, out),
            Self::LlamaBpe(tokenizer) => tokenizer.encode(text, out),
            Self::Gpt2Bpe(tokenizer) => tokenizer.encode(text, out),
        }
    }

    /// Decodes model token ids into UTF-8 text.
    ///
    /// `out` is cleared before decoded text is written. Unknown token ids
    /// outside the tokenizer vocabulary return an explicit error.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        self.decode_with_limit(tokens, out, usize::MAX)
    }

    /// Decodes model token ids while enforcing a maximum output byte count.
    ///
    /// `max_bytes` is the decoded UTF-8 byte budget. If decoded output would
    /// exceed the budget, `ErrorCode::OutputBufferExceeded` is returned and
    /// `out` is not replaced.
    pub fn decode_with_limit(
        &self,
        tokens: &[u32],
        out: &mut String,
        max_bytes: usize,
    ) -> Result<(), ErrorCode> {
        match self {
            Self::Byte(tokenizer) => tokenizer.decode_with_limit(tokens, out, max_bytes),
            Self::Bpe(tokenizer) => tokenizer.decode_with_limit(tokens, out, max_bytes),
            Self::LlamaBpe(tokenizer) => tokenizer.decode_with_limit(tokens, out, max_bytes),
            Self::Gpt2Bpe(tokenizer) => tokenizer.decode_with_limit(tokens, out, max_bytes),
        }
    }

    /// Returns a compact tokenizer label for diagnostics and tests.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Byte(_) => "byte-v1",
            Self::Bpe(_) => "bpe-v1",
            Self::LlamaBpe(_) => "llama-bpe-v1",
            Self::Gpt2Bpe(_) => "gpt2-bpe-v1",
        }
    }

    /// Beginning-of-sequence token id declared by the tokenizer section.
    pub fn bos_id(&self) -> u32 {
        match self {
            Self::Byte(_) => BOS,
            Self::Bpe(tokenizer) => tokenizer.bos,
            Self::LlamaBpe(tokenizer) => tokenizer.bos,
            Self::Gpt2Bpe(tokenizer) => tokenizer.bos,
        }
    }

    /// End-of-sequence token id declared by the tokenizer section.
    pub fn eos_id(&self) -> u32 {
        match self {
            Self::Byte(_) => EOS,
            Self::Bpe(tokenizer) => tokenizer.eos,
            Self::LlamaBpe(tokenizer) => tokenizer.eos,
            Self::Gpt2Bpe(tokenizer) => tokenizer.eos,
        }
    }

    /// Padding token id declared by the tokenizer section.
    pub fn pad_id(&self) -> u32 {
        match self {
            Self::Byte(_) => PAD,
            Self::Bpe(tokenizer) => tokenizer.pad,
            Self::LlamaBpe(tokenizer) => tokenizer.pad,
            Self::Gpt2Bpe(tokenizer) => tokenizer.pad,
        }
    }

    /// Unknown token id declared by the tokenizer section.
    pub fn unk_id(&self) -> u32 {
        match self {
            Self::Byte(_) => UNK,
            Self::Bpe(tokenizer) => tokenizer.unk,
            Self::LlamaBpe(tokenizer) => tokenizer.unk,
            Self::Gpt2Bpe(tokenizer) => tokenizer.unk,
        }
    }

    /// Returns true when `token` is the tokenizer's generation stop token.
    pub fn is_eos(&self, token: u32) -> bool {
        token == self.eos_id()
    }

    /// Removes one tokenizer-specific trailing EOS token from a prompt.
    pub fn prompt_tokens_without_eos<'a>(&self, tokens: &'a [u32]) -> &'a [u32] {
        if tokens.last().copied() == Some(self.eos_id()) {
            &tokens[..tokens.len() - 1]
        } else {
            tokens
        }
    }

    /// Non-content special ids that should not be sampled as generated text.
    pub fn non_content_special_ids(&self) -> Vec<u32> {
        let eos = self.eos_id();
        let mut ids = vec![self.bos_id(), self.unk_id()];
        if self.pad_id() != eos {
            ids.push(self.pad_id());
        }
        if let Self::Gpt2Bpe(tokenizer) = self {
            for (token, bytes) in tokenizer.token_bytes.iter().enumerate() {
                let token = token as u32;
                if bytes.is_none() && token != eos && !ids.contains(&token) {
                    ids.push(token);
                }
            }
            for (_, id) in &tokenizer.special_token_ids_by_bytes {
                if *id != eos && !ids.contains(id) {
                    ids.push(*id);
                }
            }
        }
        ids
    }

    /// Token ids that decode to unsafe control bytes and should not be sampled.
    pub fn unsafe_control_token_ids(&self) -> Vec<u32> {
        let mut ids = Vec::new();
        for byte in 0u8..=31 {
            if byte == b'\n' || byte == b'\r' {
                continue;
            }
            match self {
                Self::Byte(_) | Self::Bpe(_) => ids.push(u32::from(byte)),
                Self::LlamaBpe(tokenizer) => {
                    ids.push(tokenizer.byte_token_base + u32::from(byte));
                }
                Self::Gpt2Bpe(tokenizer) => {
                    if let Some(token) = tokenizer.token_ids_by_bytes.get(&[byte][..]) {
                        ids.push(*token);
                    }
                }
            }
        }
        ids
    }
}

impl Default for Tokenizer {
    fn default() -> Self {
        Self::Byte(ByteTokenizer::new())
    }
}

/// Phase-one byte tokenizer.
#[derive(Clone, Copy, Debug, Default)]
pub struct ByteTokenizer;

impl ByteTokenizer {
    /// Creates a new byte tokenizer.
    pub fn new() -> Self {
        Self
    }

    /// Validates a phase-one `BTOK` tokenizer section.
    ///
    /// The return value is `Ok(())` when the section declares the fixed byte
    /// vocabulary and special-token ids used by this runtime.
    pub fn validate_section(section: &[u8]) -> Result<(), ErrorCode> {
        if section.len() < 28 {
            return Err(ErrorCode::InvalidHeader);
        }
        if section.get(0..4) != Some(b"BTOK") {
            return Err(ErrorCode::InvalidHeader);
        }
        if read_u32(section, 4)? != 1
            || read_u32(section, 8)? != BYTE_VOCAB_SIZE
            || read_u32(section, 12)? != BOS
            || read_u32(section, 16)? != EOS
            || read_u32(section, 20)? != PAD
            || read_u32(section, 24)? != UNK
        {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(())
    }

    /// Encodes UTF-8 text into byte tokens with BOS and EOS delimiters.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        if text.len() + 2 > u32::MAX as usize {
            return Err(ErrorCode::InvalidLength);
        }
        out.clear();
        out.push(BOS);
        for byte in text.as_bytes() {
            out.push(u32::from(*byte));
        }
        out.push(EOS);
        Ok(())
    }

    /// Decodes byte tokens into UTF-8 text while ignoring BOS, EOS, and PAD.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        self.decode_with_limit(tokens, out, usize::MAX)
    }

    /// Decodes byte tokens into UTF-8 text with an output byte limit.
    pub fn decode_with_limit(
        &self,
        tokens: &[u32],
        out: &mut String,
        max_bytes: usize,
    ) -> Result<(), ErrorCode> {
        let mut bytes = Vec::with_capacity(tokens.len().min(max_bytes));
        for token in tokens {
            match *token {
                0..=255 => push_limited_byte(&mut bytes, *token as u8, max_bytes)?,
                BOS | EOS | PAD => {}
                UNK => push_limited_byte(&mut bytes, b'?', max_bytes)?,
                _ => return Err(ErrorCode::InvalidLength),
            }
        }
        let text = core::str::from_utf8(&bytes).map_err(|_| ErrorCode::InvalidUtf8)?;
        out.clear();
        out.push_str(text);
        Ok(())
    }
}

/// Custom phase-two BPE tokenizer with byte fallback.
#[derive(Clone, Debug)]
pub struct CustomBpeTokenizer {
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
    tokens: Vec<BpeToken>,
    merges: Vec<BpeMerge>,
}

#[derive(Clone, Debug)]
struct BpeToken {
    id: u32,
    bytes: Vec<u8>,
}

#[derive(Clone, Copy, Debug)]
struct BpeMerge {
    left: u32,
    right: u32,
    output: u32,
    rank: u32,
}

/// Llama-style BPE tokenizer with metaspace normalization and byte fallback.
#[derive(Clone, Debug)]
pub struct LlamaBpeTokenizer {
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
    byte_token_base: u32,
    token_bytes: Vec<Option<Vec<u8>>>,
    token_ids_by_bytes: HashMap<Vec<u8>, u32>,
    merges: HashMap<(u32, u32), BpeMerge>,
}

/// GPT2 ByteLevel BPE tokenizer with source ids and explicit special markers.
#[derive(Clone, Debug)]
pub struct Gpt2BpeTokenizer {
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
    token_bytes: Vec<Option<Vec<u8>>>,
    token_ids_by_bytes: HashMap<Vec<u8>, u32>,
    special_token_ids_by_bytes: Vec<(Vec<u8>, u32)>,
    merges: HashMap<(u32, u32), BpeMerge>,
}

impl CustomBpeTokenizer {
    /// Parses a custom `BPE1` tokenizer section.
    ///
    /// The format is little-endian and self-contained: header, variable
    /// token table, and fixed merge table. The return value is a tokenizer
    /// with byte fallback and deterministic ranked merges.
    pub fn from_section(section: &[u8]) -> Result<Self, ErrorCode> {
        if section.len() < 36 || section.get(0..4) != Some(b"BPE1") {
            return Err(ErrorCode::InvalidHeader);
        }
        if read_u32(section, 4)? != 1 {
            return Err(ErrorCode::UnsupportedModelVersion);
        }
        let vocab_size = read_u32(section, 8)?;
        let bos = read_u32(section, 12)?;
        let eos = read_u32(section, 16)?;
        let pad = read_u32(section, 20)?;
        let unk = read_u32(section, 24)?;
        let token_count = read_u32(section, 28)? as usize;
        let merge_count = read_u32(section, 32)? as usize;
        if vocab_size < BYTE_VOCAB_SIZE
            || bos >= vocab_size
            || eos >= vocab_size
            || pad >= vocab_size
            || unk >= vocab_size
        {
            return Err(ErrorCode::InvalidHeader);
        }

        let mut offset = 36usize;
        let mut tokens = Vec::with_capacity(token_count);
        for _ in 0..token_count {
            let id = read_u32(section, offset)?;
            let len = read_u32(section, offset + 4)? as usize;
            offset = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
            let end = offset.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
            let bytes = section
                .get(offset..end)
                .ok_or(ErrorCode::InvalidHeader)?
                .to_vec();
            if id < BYTE_VOCAB_SIZE || id >= vocab_size || bytes.is_empty() {
                return Err(ErrorCode::InvalidHeader);
            }
            if tokens.iter().any(|token: &BpeToken| token.id == id) {
                return Err(ErrorCode::InvalidHeader);
            }
            tokens.push(BpeToken { id, bytes });
            offset = end;
        }

        let mut merges = Vec::with_capacity(merge_count);
        for _ in 0..merge_count {
            let end = offset.checked_add(16).ok_or(ErrorCode::InvalidLength)?;
            if end > section.len() {
                return Err(ErrorCode::InvalidHeader);
            }
            let left = read_u32(section, offset)?;
            let right = read_u32(section, offset + 4)?;
            let output = read_u32(section, offset + 8)?;
            let rank = read_u32(section, offset + 12)?;
            if left >= vocab_size
                || right >= vocab_size
                || output >= vocab_size
                || output < BYTE_VOCAB_SIZE
            {
                return Err(ErrorCode::InvalidHeader);
            }
            if !tokens.iter().any(|token| token.id == output) {
                return Err(ErrorCode::InvalidHeader);
            }
            merges.push(BpeMerge {
                left,
                right,
                output,
                rank,
            });
            offset = end;
        }
        if offset != section.len() {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(Self {
            vocab_size,
            bos,
            eos,
            pad,
            unk,
            tokens,
            merges,
        })
    }

    /// Encodes UTF-8 text with byte fallback and ranked BPE merges.
    ///
    /// The output always starts with BOS and ends with EOS when encoding
    /// succeeds.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        if text.len() + 2 > u32::MAX as usize {
            return Err(ErrorCode::InvalidLength);
        }
        let mut merged: Vec<u32> = text
            .as_bytes()
            .iter()
            .map(|byte| u32::from(*byte))
            .collect();
        self.apply_merges(&mut merged);
        out.clear();
        out.reserve(merged.len() + 2);
        out.push(self.bos);
        out.extend_from_slice(&merged);
        out.push(self.eos);
        Ok(())
    }

    /// Decodes byte fallback and token-table ids into UTF-8 text.
    ///
    /// Special tokens are skipped, UNK decodes to `?`, and invalid token ids
    /// return an explicit error.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        self.decode_with_limit(tokens, out, usize::MAX)
    }

    /// Decodes byte fallback and token-table ids with an output byte limit.
    pub fn decode_with_limit(
        &self,
        tokens: &[u32],
        out: &mut String,
        max_bytes: usize,
    ) -> Result<(), ErrorCode> {
        let mut bytes = Vec::with_capacity(tokens.len().min(max_bytes));
        for token in tokens {
            if *token == self.bos || *token == self.eos || *token == self.pad {
                continue;
            }
            if *token == self.unk {
                push_limited_byte(&mut bytes, b'?', max_bytes)?;
                continue;
            }
            match *token {
                0..=255 => push_limited_byte(&mut bytes, *token as u8, max_bytes)?,
                _ if *token < self.vocab_size => {
                    let Some(entry) = self.tokens.iter().find(|entry| entry.id == *token) else {
                        return Err(ErrorCode::InvalidLength);
                    };
                    extend_limited_bytes(&mut bytes, &entry.bytes, max_bytes)?;
                }
                _ => return Err(ErrorCode::InvalidLength),
            }
        }
        let text = core::str::from_utf8(&bytes).map_err(|_| ErrorCode::InvalidUtf8)?;
        out.clear();
        out.push_str(text);
        Ok(())
    }

    fn apply_merges(&self, tokens: &mut Vec<u32>) {
        while let Some((index, merge)) = self.best_merge(tokens) {
            tokens[index] = merge.output;
            tokens.remove(index + 1);
        }
    }

    fn best_merge(&self, tokens: &[u32]) -> Option<(usize, BpeMerge)> {
        if tokens.len() < 2 {
            return None;
        }
        let mut best: Option<(usize, BpeMerge)> = None;
        for index in 0..tokens.len() - 1 {
            let left = tokens[index];
            let right = tokens[index + 1];
            for merge in &self.merges {
                if merge.left == left && merge.right == right {
                    match best {
                        Some((_, current)) if current.rank <= merge.rank => {}
                        _ => best = Some((index, *merge)),
                    }
                }
            }
        }
        best
    }
}

impl Gpt2BpeTokenizer {
    /// Parses a `GBPE` tokenizer section.
    ///
    /// GPT2 ByteLevel BPE keeps source tokenizer ids intact. Token entries
    /// store decoded UTF-8 bytes, while the special table preserves raw
    /// prompt-template markers such as `<|im_start|>` for atomic encoding.
    pub fn from_section(section: &[u8]) -> Result<Self, ErrorCode> {
        if section.len() < 40 || section.get(0..4) != Some(b"GBPE") {
            return Err(ErrorCode::InvalidHeader);
        }
        if read_u32(section, 4)? != 1 {
            return Err(ErrorCode::UnsupportedModelVersion);
        }
        let vocab_size = read_u32(section, 8)?;
        let bos = read_u32(section, 12)?;
        let eos = read_u32(section, 16)?;
        let pad = read_u32(section, 20)?;
        let unk = read_u32(section, 24)?;
        let token_count = read_u32(section, 28)? as usize;
        let merge_count = read_u32(section, 32)? as usize;
        let special_count = read_u32(section, 36)? as usize;
        validate_gpt2_bpe_header(vocab_size, bos, eos, pad, unk)?;

        let mut token_bytes = vec![None; vocab_size as usize];
        let mut token_ids_by_bytes = HashMap::with_capacity(token_count);
        let mut offset = 40usize;
        for _ in 0..token_count {
            let id = read_u32(section, offset)?;
            let len = read_u32(section, offset + 4)? as usize;
            offset = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
            let end = offset.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
            let bytes = section
                .get(offset..end)
                .ok_or(ErrorCode::InvalidHeader)?
                .to_vec();
            if bytes.is_empty()
                || id >= vocab_size
                || id == bos
                || id == eos
                || id == pad
                || id == unk
            {
                return Err(ErrorCode::InvalidHeader);
            }
            if token_bytes[id as usize].is_some() {
                return Err(ErrorCode::InvalidHeader);
            }
            if token_ids_by_bytes.insert(bytes.clone(), id).is_some() {
                return Err(ErrorCode::InvalidHeader);
            }
            token_bytes[id as usize] = Some(bytes);
            offset = end;
        }

        let mut special_token_ids_by_bytes = Vec::with_capacity(special_count);
        for _ in 0..special_count {
            let id = read_u32(section, offset)?;
            let len = read_u32(section, offset + 4)? as usize;
            offset = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
            let end = offset.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
            let bytes = section
                .get(offset..end)
                .ok_or(ErrorCode::InvalidHeader)?
                .to_vec();
            if bytes.is_empty() || id >= vocab_size {
                return Err(ErrorCode::InvalidHeader);
            }
            if token_bytes[id as usize].is_some() {
                return Err(ErrorCode::InvalidHeader);
            }
            if special_token_ids_by_bytes
                .iter()
                .any(|(existing_bytes, existing_id)| existing_bytes == &bytes || *existing_id == id)
            {
                return Err(ErrorCode::InvalidHeader);
            }
            special_token_ids_by_bytes.push((bytes, id));
            offset = end;
        }
        special_token_ids_by_bytes
            .sort_by(|left, right| right.0.len().cmp(&left.0.len()).then(left.1.cmp(&right.1)));

        let mut merges = HashMap::with_capacity(merge_count);
        for _ in 0..merge_count {
            let end = offset.checked_add(16).ok_or(ErrorCode::InvalidLength)?;
            if end > section.len() {
                return Err(ErrorCode::InvalidHeader);
            }
            let left = read_u32(section, offset)?;
            let right = read_u32(section, offset + 4)?;
            let output = read_u32(section, offset + 8)?;
            let rank = read_u32(section, offset + 12)?;
            if left >= vocab_size
                || right >= vocab_size
                || output >= vocab_size
                || output == bos
                || output == eos
                || output == pad
                || output == unk
                || token_bytes[left as usize].is_none()
                || token_bytes[right as usize].is_none()
                || token_bytes[output as usize].is_none()
            {
                return Err(ErrorCode::InvalidHeader);
            }
            if merges
                .insert(
                    (left, right),
                    BpeMerge {
                        left,
                        right,
                        output,
                        rank,
                    },
                )
                .is_some()
            {
                return Err(ErrorCode::InvalidHeader);
            }
            offset = end;
        }
        if offset != section.len() {
            return Err(ErrorCode::InvalidHeader);
        }

        for byte in 0u8..=255 {
            if gpt2_bpe_required_prompt_byte(byte) && !token_ids_by_bytes.contains_key(&[byte][..])
            {
                return Err(ErrorCode::InvalidHeader);
            }
        }

        Ok(Self {
            vocab_size,
            bos,
            eos,
            pad,
            unk,
            token_bytes,
            token_ids_by_bytes,
            special_token_ids_by_bytes,
            merges,
        })
    }

    /// Encodes UTF-8 text with GPT2 ByteLevel initial tokens and ranked BPE merges.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        if text.len() > u32::MAX as usize {
            return Err(ErrorCode::InvalidLength);
        }
        let mut tokens = Vec::with_capacity(text.len());
        let bytes = text.as_bytes();
        let mut offset = 0usize;
        while offset < bytes.len() {
            if let Some((special_len, special_id)) = self.special_at(&bytes[offset..]) {
                tokens.push(special_id);
                offset += special_len;
                continue;
            }
            let byte = bytes[offset];
            let Some(token) = self.token_ids_by_bytes.get(&[byte][..]).copied() else {
                return Err(ErrorCode::InvalidLength);
            };
            tokens.push(token);
            offset += 1;
        }
        self.apply_merges(&mut tokens);
        out.clear();
        out.extend_from_slice(&tokens);
        Ok(())
    }

    /// Decodes GPT2 ByteLevel token ids back into UTF-8 text.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        self.decode_with_limit(tokens, out, usize::MAX)
    }

    /// Decodes GPT2 ByteLevel token ids while enforcing an output byte limit.
    pub fn decode_with_limit(
        &self,
        tokens: &[u32],
        out: &mut String,
        max_bytes: usize,
    ) -> Result<(), ErrorCode> {
        let mut bytes = Vec::with_capacity(tokens.len().min(max_bytes));
        for token in tokens {
            if *token == self.bos
                || *token == self.eos
                || *token == self.pad
                || *token == self.unk
                || self.is_special_id(*token)
            {
                continue;
            }
            if *token >= self.vocab_size {
                return Err(ErrorCode::InvalidLength);
            }
            let Some(entry) = self.token_bytes[*token as usize].as_deref() else {
                return Err(ErrorCode::InvalidLength);
            };
            extend_limited_bytes(&mut bytes, entry, max_bytes)?;
        }
        let text = core::str::from_utf8(&bytes).map_err(|_| ErrorCode::InvalidUtf8)?;
        out.clear();
        out.push_str(text);
        Ok(())
    }

    fn special_at(&self, remaining: &[u8]) -> Option<(usize, u32)> {
        self.special_token_ids_by_bytes
            .iter()
            .find(|(bytes, _)| remaining.starts_with(bytes))
            .map(|(bytes, id)| (bytes.len(), *id))
    }

    fn is_special_id(&self, token: u32) -> bool {
        self.special_token_ids_by_bytes
            .iter()
            .any(|(_, special_id)| *special_id == token)
    }

    fn apply_merges(&self, tokens: &mut Vec<u32>) {
        while let Some((index, merge)) = self.best_merge(tokens) {
            tokens[index] = merge.output;
            tokens.remove(index + 1);
        }
    }

    fn best_merge(&self, tokens: &[u32]) -> Option<(usize, BpeMerge)> {
        if tokens.len() < 2 {
            return None;
        }
        let mut best: Option<(usize, BpeMerge)> = None;
        for index in 0..tokens.len() - 1 {
            if let Some(merge) = self.merges.get(&(tokens[index], tokens[index + 1])) {
                match best {
                    Some((_, current)) if current.rank <= merge.rank => {}
                    _ => best = Some((index, *merge)),
                }
            }
        }
        best
    }
}

impl LlamaBpeTokenizer {
    /// Parses an `LBPE` tokenizer section.
    ///
    /// `LBPE` preserves Llama-family tokenizer ids instead of remapping them
    /// into TinyRustLM's legacy byte-tokenizer range. The format stores
    /// special ids, a byte-fallback base, learned token bytes, and ranked BPE
    /// merge rows.
    pub fn from_section(section: &[u8]) -> Result<Self, ErrorCode> {
        if section.len() < 40 || section.get(0..4) != Some(b"LBPE") {
            return Err(ErrorCode::InvalidHeader);
        }
        if read_u32(section, 4)? != 1 {
            return Err(ErrorCode::UnsupportedModelVersion);
        }
        let vocab_size = read_u32(section, 8)?;
        let bos = read_u32(section, 12)?;
        let eos = read_u32(section, 16)?;
        let pad = read_u32(section, 20)?;
        let unk = read_u32(section, 24)?;
        let token_count = read_u32(section, 28)? as usize;
        let merge_count = read_u32(section, 32)? as usize;
        let byte_token_base = read_u32(section, 36)?;
        validate_llama_bpe_header(vocab_size, bos, eos, pad, unk, byte_token_base)?;

        let mut token_bytes = vec![None; vocab_size as usize];
        let mut token_ids_by_bytes = HashMap::with_capacity(token_count);
        let mut offset = 40usize;
        for _ in 0..token_count {
            let id = read_u32(section, offset)?;
            let len = read_u32(section, offset + 4)? as usize;
            offset = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
            let end = offset.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
            let bytes = section
                .get(offset..end)
                .ok_or(ErrorCode::InvalidHeader)?
                .to_vec();
            if bytes.is_empty()
                || id >= vocab_size
                || id == bos
                || id == eos
                || id == pad
                || id == unk
                || is_llama_byte_token(id, byte_token_base)
            {
                return Err(ErrorCode::InvalidHeader);
            }
            if token_bytes[id as usize].is_some() {
                return Err(ErrorCode::InvalidHeader);
            }
            if token_ids_by_bytes.insert(bytes.clone(), id).is_some() {
                return Err(ErrorCode::InvalidHeader);
            }
            token_bytes[id as usize] = Some(bytes);
            offset = end;
        }

        let mut merges = HashMap::with_capacity(merge_count);
        for _ in 0..merge_count {
            let end = offset.checked_add(16).ok_or(ErrorCode::InvalidLength)?;
            if end > section.len() {
                return Err(ErrorCode::InvalidHeader);
            }
            let left = read_u32(section, offset)?;
            let right = read_u32(section, offset + 4)?;
            let output = read_u32(section, offset + 8)?;
            let rank = read_u32(section, offset + 12)?;
            if left >= vocab_size
                || right >= vocab_size
                || output >= vocab_size
                || output == bos
                || output == eos
                || output == pad
                || output == unk
                || is_llama_byte_token(output, byte_token_base)
                || token_bytes[output as usize].is_none()
            {
                return Err(ErrorCode::InvalidHeader);
            }
            if merges
                .insert(
                    (left, right),
                    BpeMerge {
                        left,
                        right,
                        output,
                        rank,
                    },
                )
                .is_some()
            {
                return Err(ErrorCode::InvalidHeader);
            }
            offset = end;
        }
        if offset != section.len() {
            return Err(ErrorCode::InvalidHeader);
        }
        Ok(Self {
            vocab_size,
            bos,
            eos,
            pad,
            unk,
            byte_token_base,
            token_bytes,
            token_ids_by_bytes,
            merges,
        })
    }

    /// Encodes text using Llama metaspace normalization and ranked BPE merges.
    ///
    /// Llama chat/tokenizer JSONs prefix BOS through post-processing but do
    /// not append EOS to prompt text. Generation stop handling is therefore
    /// driven by sampled EOS, not by an EOS included in the prompt context.
    pub fn encode(&self, text: &str, out: &mut Vec<u32>) -> Result<(), ErrorCode> {
        if text.len() + 1 > u32::MAX as usize {
            return Err(ErrorCode::InvalidLength);
        }
        let mut merged = self.initial_llama_tokens(text);
        self.apply_merges(&mut merged);
        out.clear();
        out.reserve(merged.len() + 1);
        out.push(self.bos);
        out.extend_from_slice(&merged);
        Ok(())
    }

    /// Decodes Llama token ids back into UTF-8 text.
    pub fn decode(&self, tokens: &[u32], out: &mut String) -> Result<(), ErrorCode> {
        self.decode_with_limit(tokens, out, usize::MAX)
    }

    /// Decodes Llama token ids while enforcing an output byte limit.
    pub fn decode_with_limit(
        &self,
        tokens: &[u32],
        out: &mut String,
        max_bytes: usize,
    ) -> Result<(), ErrorCode> {
        let mut bytes = Vec::with_capacity(tokens.len().min(max_bytes));
        for token in tokens {
            if *token == self.bos || *token == self.eos || *token == self.pad {
                continue;
            }
            if *token == self.unk {
                push_limited_byte(&mut bytes, b'?', max_bytes)?;
                continue;
            }
            if is_llama_byte_token(*token, self.byte_token_base) {
                push_limited_byte(&mut bytes, (*token - self.byte_token_base) as u8, max_bytes)?;
                continue;
            }
            if *token >= self.vocab_size {
                return Err(ErrorCode::InvalidLength);
            }
            let Some(entry) = self.token_bytes[*token as usize].as_deref() else {
                return Err(ErrorCode::InvalidLength);
            };
            extend_limited_bytes(&mut bytes, entry, max_bytes)?;
        }
        let text = core::str::from_utf8(&bytes).map_err(|_| ErrorCode::InvalidUtf8)?;
        let decoded = decode_llama_metaspace(text);
        if decoded.len() > max_bytes {
            return Err(ErrorCode::OutputBufferExceeded);
        }
        out.clear();
        out.push_str(&decoded);
        Ok(())
    }

    fn initial_llama_tokens(&self, text: &str) -> Vec<u32> {
        let normalized = llama_metaspace_normalize(text);
        let mut tokens = Vec::with_capacity(normalized.len());
        for ch in normalized.chars() {
            let mut buffer = [0u8; 4];
            let bytes = ch.encode_utf8(&mut buffer).as_bytes();
            if let Some(token) = self.token_ids_by_bytes.get(bytes) {
                tokens.push(*token);
            } else {
                for byte in bytes {
                    tokens.push(self.byte_token_base + u32::from(*byte));
                }
            }
        }
        tokens
    }

    fn apply_merges(&self, tokens: &mut Vec<u32>) {
        while let Some((index, merge)) = self.best_merge(tokens) {
            tokens[index] = merge.output;
            tokens.remove(index + 1);
        }
    }

    fn best_merge(&self, tokens: &[u32]) -> Option<(usize, BpeMerge)> {
        if tokens.len() < 2 {
            return None;
        }
        let mut best: Option<(usize, BpeMerge)> = None;
        for index in 0..tokens.len() - 1 {
            if let Some(merge) = self.merges.get(&(tokens[index], tokens[index + 1])) {
                match best {
                    Some((_, current)) if current.rank <= merge.rank => {}
                    _ => best = Some((index, *merge)),
                }
            }
        }
        best
    }
}

fn validate_llama_bpe_header(
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
    byte_token_base: u32,
) -> Result<(), ErrorCode> {
    let byte_token_end = byte_token_base
        .checked_add(255)
        .ok_or(ErrorCode::InvalidLength)?;
    if vocab_size <= byte_token_end
        || bos >= vocab_size
        || eos >= vocab_size
        || pad >= vocab_size
        || unk >= vocab_size
        || is_llama_byte_token(bos, byte_token_base)
        || is_llama_byte_token(eos, byte_token_base)
        || is_llama_byte_token(pad, byte_token_base)
        || is_llama_byte_token(unk, byte_token_base)
    {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn validate_gpt2_bpe_header(
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
) -> Result<(), ErrorCode> {
    if vocab_size < 260
        || bos >= vocab_size
        || eos >= vocab_size
        || pad >= vocab_size
        || unk >= vocab_size
    {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn is_llama_byte_token(token: u32, byte_token_base: u32) -> bool {
    token >= byte_token_base && token < byte_token_base.saturating_add(256)
}

fn gpt2_bpe_required_prompt_byte(byte: u8) -> bool {
    matches!(byte, b'\t' | b'\n' | b'\r' | 0x20..=0x7e)
}

fn llama_metaspace_normalize(text: &str) -> String {
    let mut normalized = String::with_capacity(text.len() + 3);
    normalized.push('▁');
    for ch in text.chars() {
        if ch == ' ' {
            normalized.push('▁');
        } else {
            normalized.push(ch);
        }
    }
    normalized
}

fn decode_llama_metaspace(text: &str) -> String {
    let decoded = text.replace('▁', " ");
    decoded
        .strip_prefix(" ")
        .unwrap_or(decoded.as_str())
        .to_string()
}

fn push_limited_byte(bytes: &mut Vec<u8>, byte: u8, max_bytes: usize) -> Result<(), ErrorCode> {
    if bytes.len() >= max_bytes {
        return Err(ErrorCode::OutputBufferExceeded);
    }
    bytes.push(byte);
    Ok(())
}

fn extend_limited_bytes(
    bytes: &mut Vec<u8>,
    source: &[u8],
    max_bytes: usize,
) -> Result<(), ErrorCode> {
    let next_len = bytes
        .len()
        .checked_add(source.len())
        .ok_or(ErrorCode::OutputBufferExceeded)?;
    if next_len > max_bytes {
        return Err(ErrorCode::OutputBufferExceeded);
    }
    bytes.extend_from_slice(source);
    Ok(())
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u32::from_le_bytes(
        slice.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_bpe_section() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BPE1");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&262u32.to_le_bytes());
        bytes.extend_from_slice(&BOS.to_le_bytes());
        bytes.extend_from_slice(&EOS.to_le_bytes());
        bytes.extend_from_slice(&PAD.to_le_bytes());
        bytes.extend_from_slice(&UNK.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(b"th");
        bytes.extend_from_slice(&261u32.to_le_bytes());
        bytes.extend_from_slice(&3u32.to_le_bytes());
        bytes.extend_from_slice(b"the");
        bytes.extend_from_slice(&116u32.to_le_bytes());
        bytes.extend_from_slice(&104u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&101u32.to_le_bytes());
        bytes.extend_from_slice(&261u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes
    }

    fn tiny_llama_bpe_section() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"LBPE");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&264u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&5u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&3u32.to_le_bytes());
        for (id, token) in [
            (259u32, "▁"),
            (260u32, "h"),
            (261u32, "i"),
            (262u32, "▁h"),
            (263u32, "▁hi"),
        ] {
            bytes.extend_from_slice(&id.to_le_bytes());
            bytes.extend_from_slice(&(token.len() as u32).to_le_bytes());
            bytes.extend_from_slice(token.as_bytes());
        }
        bytes.extend_from_slice(&259u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&262u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&262u32.to_le_bytes());
        bytes.extend_from_slice(&261u32.to_le_bytes());
        bytes.extend_from_slice(&263u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes
    }

    fn tiny_gpt2_bpe_section() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"GBPE");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&257u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        for byte in 0u32..=255 {
            bytes.extend_from_slice(&(byte + 3).to_le_bytes());
            bytes.extend_from_slice(&1u32.to_le_bytes());
            bytes.push(byte as u8);
        }
        bytes.extend_from_slice(&259u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(b"hi");
        for (id, token) in [(1u32, "<|im_start|>"), (2u32, "<|im_end|>")] {
            bytes.extend_from_slice(&id.to_le_bytes());
            bytes.extend_from_slice(&(token.len() as u32).to_le_bytes());
            bytes.extend_from_slice(token.as_bytes());
        }
        bytes.extend_from_slice(&(u32::from(b'h') + 3).to_le_bytes());
        bytes.extend_from_slice(&(u32::from(b'i') + 3).to_le_bytes());
        bytes.extend_from_slice(&259u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes
    }

    fn partial_gpt2_bpe_section_with_extra_special() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"GBPE");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&261u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&99u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&3u32.to_le_bytes());
        for byte in [b'\t', b'\n', b'\r'].into_iter().chain(0x20u8..=0x7e) {
            bytes.extend_from_slice(&(u32::from(byte) + 4).to_le_bytes());
            bytes.extend_from_slice(&1u32.to_le_bytes());
            bytes.push(byte);
        }
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(b"hi");
        for (id, token) in [
            (1u32, "<|im_start|>"),
            (2u32, "<|im_end|>"),
            (3u32, "<repo_name>"),
        ] {
            bytes.extend_from_slice(&id.to_le_bytes());
            bytes.extend_from_slice(&(token.len() as u32).to_le_bytes());
            bytes.extend_from_slice(token.as_bytes());
        }
        bytes.extend_from_slice(&(u32::from(b'h') + 4).to_le_bytes());
        bytes.extend_from_slice(&(u32::from(b'i') + 4).to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes
    }

    #[test]
    fn byte_tokenizer_round_trip() {
        let tokenizer = ByteTokenizer::new();
        let mut tokens = Vec::new();
        tokenizer.encode("hello", &mut tokens).unwrap();
        assert_eq!(tokens, [BOS, 104, 101, 108, 108, 111, EOS]);
        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "hello");
    }

    #[test]
    fn byte_tokenizer_decode_reports_output_buffer_limit() {
        let tokenizer = ByteTokenizer::new();
        let mut decoded = String::from("previous");
        assert_eq!(
            tokenizer
                .decode_with_limit(&[BOS, 104, 105, EOS], &mut decoded, 1)
                .unwrap_err(),
            ErrorCode::OutputBufferExceeded
        );
        assert_eq!(decoded, "previous");
    }

    #[test]
    fn utf8_prompt_handling() {
        let tokenizer = ByteTokenizer::new();
        let mut tokens = Vec::new();
        tokenizer.encode("local ai", &mut tokens).unwrap();
        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "local ai");
    }

    #[test]
    fn custom_bpe_merges_and_decodes() {
        let tokenizer = Tokenizer::from_section(&tiny_bpe_section()).unwrap();
        assert_eq!(tokenizer.label(), "bpe-v1");
        let mut tokens = Vec::new();
        tokenizer.encode("the", &mut tokens).unwrap();
        assert_eq!(tokens, [BOS, 261, EOS]);
        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "the");
    }

    #[test]
    fn custom_bpe_decode_reports_output_buffer_limit() {
        let tokenizer = Tokenizer::from_section(&tiny_bpe_section()).unwrap();
        let mut decoded = String::from("previous");
        assert_eq!(
            tokenizer
                .decode_with_limit(&[BOS, 261, EOS], &mut decoded, 2)
                .unwrap_err(),
            ErrorCode::OutputBufferExceeded
        );
        assert_eq!(decoded, "previous");
    }

    #[test]
    fn llama_bpe_round_trip_uses_llama_special_ids() {
        let tokenizer = Tokenizer::from_section(&tiny_llama_bpe_section()).unwrap();
        assert_eq!(tokenizer.label(), "llama-bpe-v1");
        assert_eq!(tokenizer.bos_id(), 1);
        assert_eq!(tokenizer.eos_id(), 2);
        assert_eq!(tokenizer.pad_id(), 2);
        assert_eq!(tokenizer.unk_id(), 0);

        let mut tokens = Vec::new();
        tokenizer.encode("hi", &mut tokens).unwrap();
        assert_eq!(tokens, [1, 263]);
        assert_eq!(tokenizer.prompt_tokens_without_eos(&tokens), &[1, 263]);

        let mut decoded = String::new();
        tokenizer.decode(&[1, 263, 2], &mut decoded).unwrap();
        assert_eq!(decoded, "hi");
    }

    #[test]
    fn llama_bpe_falls_back_to_utf8_bytes_without_remapping_specials() {
        let tokenizer = Tokenizer::from_section(&tiny_llama_bpe_section()).unwrap();
        let mut tokens = Vec::new();
        tokenizer.encode("🙂", &mut tokens).unwrap();
        assert_eq!(tokens[0], 1);
        assert_eq!(tokens[1], 259);
        assert!(tokens[2..].iter().all(|token| (3..=258).contains(token)));

        let mut decoded = String::new();
        tokenizer.decode(&tokens, &mut decoded).unwrap();
        assert_eq!(decoded, "🙂");
    }

    #[test]
    fn gpt2_bpe_scans_chat_specials_and_merges_bytelevel_tokens() {
        let tokenizer = Tokenizer::from_section(&tiny_gpt2_bpe_section()).unwrap();
        assert_eq!(tokenizer.label(), "gpt2-bpe-v1");
        assert_eq!(tokenizer.bos_id(), 1);
        assert_eq!(tokenizer.eos_id(), 2);
        assert_eq!(tokenizer.unk_id(), 0);

        let mut tokens = Vec::new();
        tokenizer
            .encode("<|im_start|>assistant\nhi<|im_end|>", &mut tokens)
            .unwrap();
        assert_eq!(tokens.first().copied(), Some(1));
        assert_eq!(tokens.last().copied(), Some(2));
        assert!(tokens.contains(&259));

        let mut decoded = String::new();
        tokenizer.decode(&[1, 259, 2], &mut decoded).unwrap();
        assert_eq!(decoded, "hi");
    }

    #[test]
    fn gpt2_bpe_accepts_partial_bytelevel_alphabet_and_extra_specials() {
        let tokenizer =
            Tokenizer::from_section(&partial_gpt2_bpe_section_with_extra_special()).unwrap();

        let mut tokens = Vec::new();
        tokenizer.encode("<repo_name>hi!", &mut tokens).unwrap();
        assert_eq!(tokens.first().copied(), Some(3));
        assert!(tokens.contains(&260));

        let mut decoded = String::new();
        tokenizer.decode(&[3, 260, 2], &mut decoded).unwrap();
        assert_eq!(decoded, "hi");

        let missing_control = String::from_utf8(vec![4]).unwrap();
        assert_eq!(
            tokenizer.encode(&missing_control, &mut tokens).unwrap_err(),
            ErrorCode::InvalidLength
        );

        let suppressed = tokenizer.non_content_special_ids();
        assert!(suppressed.contains(&3));
        assert!(suppressed.contains(&131));
        assert!(!suppressed.contains(&2));
    }

    #[test]
    fn custom_bpe_rejects_invalid_merge_output() {
        let mut section = tiny_bpe_section();
        let output_offset = section.len() - 8;
        section[output_offset..output_offset + 4].copy_from_slice(&300u32.to_le_bytes());
        assert_eq!(
            Tokenizer::from_section(&section).unwrap_err(),
            ErrorCode::InvalidHeader
        );
    }
}
