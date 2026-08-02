//! Tokenizer section writer.

/// Tokenizer section bytes.
pub struct TokenizerSection {
    /// Serialized tokenizer metadata.
    pub bytes: Vec<u8>,
}

/// One custom BPE token table entry.
pub struct BpeTokenSpec {
    /// Token id, which must be outside the byte fallback range.
    pub id: u32,
    /// UTF-8 bytes or raw byte sequence represented by the token.
    pub bytes: Vec<u8>,
}

/// One ranked custom BPE merge rule.
pub struct BpeMergeSpec {
    /// Left token id.
    pub left: u32,
    /// Right token id.
    pub right: u32,
    /// Output token id.
    pub output: u32,
    /// Lower rank values merge first.
    pub rank: u32,
}

/// One GPT2/ByteLevel special token entry that should be encoded atomically.
pub struct BpeSpecialTokenSpec {
    /// Source tokenizer id.
    pub id: u32,
    /// Literal UTF-8 bytes for the special marker.
    pub bytes: Vec<u8>,
}

/// Compatibility alias for the phase-one byte-tokenizer section.
pub type ByteTokenizerSection = TokenizerSection;

impl TokenizerSection {
    /// Creates a phase-one byte tokenizer metadata section.
    pub fn phase_one() -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BTOK");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&260u32.to_le_bytes());
        bytes.extend_from_slice(&256u32.to_le_bytes());
        bytes.extend_from_slice(&257u32.to_le_bytes());
        bytes.extend_from_slice(&258u32.to_le_bytes());
        bytes.extend_from_slice(&259u32.to_le_bytes());
        Self { bytes }
    }

    /// Creates a small deterministic BPE tokenizer metadata section for tests.
    ///
    /// The section uses byte fallback plus two merges: `t` + `h` -> `th`,
    /// then `th` + `e` -> `the`.
    pub fn tiny_bpe_demo() -> Self {
        let tokens = vec![
            BpeTokenSpec {
                id: 260,
                bytes: b"th".to_vec(),
            },
            BpeTokenSpec {
                id: 261,
                bytes: b"the".to_vec(),
            },
        ];
        let merges = vec![
            BpeMergeSpec {
                left: 116,
                right: 104,
                output: 260,
                rank: 0,
            },
            BpeMergeSpec {
                left: 260,
                right: 101,
                output: 261,
                rank: 1,
            },
        ];
        Self::bpe_from_parts(262, &tokens, &merges)
    }

    /// Creates a custom BPE tokenizer metadata section from manifest parts.
    ///
    /// The caller owns semantic validation; this writer serializes the
    /// self-contained `BPE1` section used by both runtime and native
    /// validation.
    pub fn bpe_from_parts(
        vocab_size: u32,
        tokens: &[BpeTokenSpec],
        merges: &[BpeMergeSpec],
    ) -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BPE1");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&vocab_size.to_le_bytes());
        bytes.extend_from_slice(&256u32.to_le_bytes());
        bytes.extend_from_slice(&257u32.to_le_bytes());
        bytes.extend_from_slice(&258u32.to_le_bytes());
        bytes.extend_from_slice(&259u32.to_le_bytes());
        bytes.extend_from_slice(&(tokens.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(merges.len() as u32).to_le_bytes());
        for token in tokens {
            write_token(&mut bytes, token.id, &token.bytes);
        }
        for merge in merges {
            write_merge(
                &mut bytes,
                merge.left,
                merge.right,
                merge.output,
                merge.rank,
            );
        }
        Self { bytes }
    }

    /// Creates a Llama-compatible byte-fallback BPE tokenizer section.
    ///
    /// `LBPE` keeps source tokenizer ids intact. This is required for
    /// Llama-family safetensors imports where `<unk>`, `<s>`, `</s>`, and
    /// byte-fallback ids already occupy the low vocabulary rows used by the
    /// trained tensors.
    pub fn llama_bpe_from_parts(
        vocab_size: u32,
        bos: u32,
        eos: u32,
        pad: u32,
        unk: u32,
        byte_token_base: u32,
        tokens: &[BpeTokenSpec],
        merges: &[BpeMergeSpec],
    ) -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"LBPE");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&vocab_size.to_le_bytes());
        bytes.extend_from_slice(&bos.to_le_bytes());
        bytes.extend_from_slice(&eos.to_le_bytes());
        bytes.extend_from_slice(&pad.to_le_bytes());
        bytes.extend_from_slice(&unk.to_le_bytes());
        bytes.extend_from_slice(&(tokens.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(merges.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&byte_token_base.to_le_bytes());
        for token in tokens {
            write_token(&mut bytes, token.id, &token.bytes);
        }
        for merge in merges {
            write_merge(
                &mut bytes,
                merge.left,
                merge.right,
                merge.output,
                merge.rank,
            );
        }
        Self { bytes }
    }

    /// Creates a GPT2-compatible ByteLevel BPE tokenizer section.
    ///
    /// `GBPE` keeps source tokenizer ids intact and stores decoded token
    /// bytes. Special markers are stored separately so prompt templates such
    /// as `<|im_start|>` encode atomically instead of byte-by-byte.
    pub fn gpt2_bpe_from_parts(
        vocab_size: u32,
        bos: u32,
        eos: u32,
        pad: u32,
        unk: u32,
        tokens: &[BpeTokenSpec],
        specials: &[BpeSpecialTokenSpec],
        merges: &[BpeMergeSpec],
    ) -> Self {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"GBPE");
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&vocab_size.to_le_bytes());
        bytes.extend_from_slice(&bos.to_le_bytes());
        bytes.extend_from_slice(&eos.to_le_bytes());
        bytes.extend_from_slice(&pad.to_le_bytes());
        bytes.extend_from_slice(&unk.to_le_bytes());
        bytes.extend_from_slice(&(tokens.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(merges.len() as u32).to_le_bytes());
        bytes.extend_from_slice(&(specials.len() as u32).to_le_bytes());
        for token in tokens {
            write_token(&mut bytes, token.id, &token.bytes);
        }
        for special in specials {
            write_token(&mut bytes, special.id, &special.bytes);
        }
        for merge in merges {
            write_merge(
                &mut bytes,
                merge.left,
                merge.right,
                merge.output,
                merge.rank,
            );
        }
        Self { bytes }
    }
}

fn write_token(bytes: &mut Vec<u8>, id: u32, text: &[u8]) {
    bytes.extend_from_slice(&id.to_le_bytes());
    bytes.extend_from_slice(&(text.len() as u32).to_le_bytes());
    bytes.extend_from_slice(text);
}

fn write_merge(bytes: &mut Vec<u8>, left: u32, right: u32, output: u32, rank: u32) {
    bytes.extend_from_slice(&left.to_le_bytes());
    bytes.extend_from_slice(&right.to_le_bytes());
    bytes.extend_from_slice(&output.to_le_bytes());
    bytes.extend_from_slice(&rank.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiny_bpe_demo_writes_self_describing_section() {
        let section = TokenizerSection::tiny_bpe_demo();
        assert_eq!(section.bytes.get(0..4), Some(&b"BPE1"[..]));
        assert!(section.bytes.len() > ByteTokenizerSection::phase_one().bytes.len());
    }

    #[test]
    fn llama_bpe_writes_self_describing_section() {
        let section = TokenizerSection::llama_bpe_from_parts(
            264,
            1,
            2,
            2,
            0,
            3,
            &[BpeTokenSpec {
                id: 259,
                bytes: "▁".as_bytes().to_vec(),
            }],
            &[],
        );
        assert_eq!(section.bytes.get(0..4), Some(&b"LBPE"[..]));
        assert_eq!(
            u32::from_le_bytes(section.bytes[36..40].try_into().unwrap()),
            3
        );
    }

    #[test]
    fn gpt2_bpe_writes_self_describing_section() {
        let section = TokenizerSection::gpt2_bpe_from_parts(
            260,
            1,
            2,
            2,
            0,
            &[BpeTokenSpec {
                id: 17,
                bytes: b"!".to_vec(),
            }],
            &[BpeSpecialTokenSpec {
                id: 1,
                bytes: b"<|im_start|>".to_vec(),
            }],
            &[],
        );
        assert_eq!(section.bytes.get(0..4), Some(&b"GBPE"[..]));
        assert_eq!(
            u32::from_le_bytes(section.bytes[36..40].try_into().unwrap()),
            1
        );
    }
}
