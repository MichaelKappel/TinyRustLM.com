//! Canonical Tokenizer2 writer, parser, runtime, and hostile-input contract tests.

use std::collections::HashMap;

use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_tokenizer2::{
    write_tokenizer, DecodeMode, MergeDefinition, TokenDefinition, Tokenizer2, TokenizerPolicy,
    TokenizerSpec, TOKENIZER2_FORMAT_PROFILE_ID, TOKENIZER2_FORMAT_PROFILE_SHA256,
};

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/tokenizer2-format-profile.v1.json");
const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/tokenizer2-format-vectors.v1.json");

struct Fixture {
    token_bytes: Vec<Vec<u8>>,
    added: Vec<bool>,
    special: Vec<bool>,
    merges: Vec<MergeDefinition>,
    id_for_byte: [u32; 256],
}

impl Fixture {
    fn new() -> Self {
        let byte_order = gpt2_byte_order();
        let mut token_bytes = Vec::new();
        let mut id_for_byte = [u32::MAX; 256];
        for (id, byte) in byte_order.iter().enumerate() {
            token_bytes.push(vec![*byte]);
            id_for_byte[*byte as usize] = id as u32;
        }

        let mut merges = Vec::new();
        add_merge(
            &mut token_bytes,
            &mut merges,
            id_for_byte[b'h' as usize],
            id_for_byte[b'e' as usize],
            b"he",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            256,
            id_for_byte[b'l' as usize],
            b"hel",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            257,
            id_for_byte[b'l' as usize],
            b"hell",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            258,
            id_for_byte[b'o' as usize],
            b"hello",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            id_for_byte[b' ' as usize],
            id_for_byte[b'w' as usize],
            b" w",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            260,
            id_for_byte[b'o' as usize],
            b" wo",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            261,
            id_for_byte[b'r' as usize],
            b" wor",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            262,
            id_for_byte[b'l' as usize],
            b" worl",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            263,
            id_for_byte[b'd' as usize],
            b" world",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            id_for_byte[0xc3],
            id_for_byte[0xa9],
            &[0xc3, 0xa9],
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            id_for_byte[b'!' as usize],
            id_for_byte[b'!' as usize],
            b"!!",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            266,
            id_for_byte[b'!' as usize],
            b"!!!",
        );
        add_merge(
            &mut token_bytes,
            &mut merges,
            id_for_byte[b' ' as usize],
            id_for_byte[b' ' as usize],
            b"  ",
        );
        add_merge(&mut token_bytes, &mut merges, 268, 268, b"    ");
        add_merge(
            &mut token_bytes,
            &mut merges,
            id_for_byte[b'1' as usize],
            id_for_byte[b'2' as usize],
            b"12",
        );

        let base_count = token_bytes.len();
        for value in [
            b"<|endoftext|>".as_slice(),
            b"<|im_start|>",
            b"<|im_end|>",
            b"<think>",
            b"<|im",
            b"e\xcc\x81!",
        ] {
            token_bytes.push(value.to_vec());
        }
        let mut added = vec![false; token_bytes.len()];
        let mut special = vec![false; token_bytes.len()];
        for flag in added.iter_mut().skip(base_count) {
            *flag = true;
        }
        for flag in special.iter_mut().skip(base_count).take(3) {
            *flag = true;
        }
        Self {
            token_bytes,
            added,
            special,
            merges,
            id_for_byte,
        }
    }

    fn definitions(&self) -> Vec<TokenDefinition<'_>> {
        self.token_bytes
            .iter()
            .enumerate()
            .map(|(index, bytes)| TokenDefinition {
                bytes,
                added: self.added[index],
                special: self.special[index],
            })
            .collect()
    }

    fn bytes(&self) -> Vec<u8> {
        let definitions = self.definitions();
        let mut bytes = Vec::new();
        let identity = write_tokenizer(
            &TokenizerSpec {
                tokens: &definitions,
                base_token_count: 271,
                merges: &self.merges,
                bos_token_id: None,
                eos_token_id: Some(273),
                pad_token_id: Some(271),
                unk_token_id: None,
            },
            &mut bytes,
        )
        .unwrap();
        assert_eq!(identity.byte_length, bytes.len() as u64);
        assert_eq!(identity.sha256, Sha256::digest(&bytes).as_slice());
        bytes
    }

    fn tokenizer(&self) -> Tokenizer2 {
        let bytes = self.bytes();
        Tokenizer2::from_bytes(bytes, policy()).unwrap()
    }
}

fn add_merge(
    token_bytes: &mut Vec<Vec<u8>>,
    merges: &mut Vec<MergeDefinition>,
    left: u32,
    right: u32,
    output_bytes: &[u8],
) {
    let output = 256 + merges.len() as u32;
    token_bytes.push(output_bytes.to_vec());
    merges.push(MergeDefinition {
        left,
        right,
        output,
    });
}

fn gpt2_byte_order() -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend(b'!'..=b'~');
    bytes.extend(0xa1..=0xac);
    bytes.extend(0xae..=0xff);
    for byte in 0_u8..=u8::MAX {
        if !bytes.contains(&byte) {
            bytes.push(byte);
        }
    }
    assert_eq!(bytes.len(), 256);
    bytes
}

fn policy() -> TokenizerPolicy {
    TokenizerPolicy::new(1_048_576, 65_536, 65_536, 262_144).unwrap()
}

fn read_u64(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap())
}

#[test]
fn checked_in_profile_identity_is_exact() {
    let value: Value = serde_json::from_slice(PROFILE_BYTES).unwrap();
    assert_eq!(value["profileId"], TOKENIZER2_FORMAT_PROFILE_ID);
    assert_eq!(value["status"], "development-unpromoted");
    assert_eq!(
        hex_lower(&Sha256::digest(PROFILE_BYTES)),
        TOKENIZER2_FORMAT_PROFILE_SHA256
    );
}

#[test]
fn writer_is_deterministic_and_parser_preserves_identity() {
    let fixture = Fixture::new();
    let first = fixture.bytes();
    let second = fixture.bytes();
    assert_eq!(first, second);
    let tokenizer = Tokenizer2::from_bytes(first.clone(), policy()).unwrap();
    assert_eq!(tokenizer.identity().byte_length, first.len() as u64);
    assert_eq!(
        tokenizer.identity().sha256,
        Sha256::digest(first).as_slice()
    );
    assert_eq!(tokenizer.token_count(), 277);
    assert_eq!(tokenizer.base_token_count(), 271);
    assert_eq!(tokenizer.bos_token_id(), None);
    assert_eq!(tokenizer.eos_token_id(), Some(273));
    assert_eq!(tokenizer.pad_token_id(), Some(271));
}

#[test]
fn rust_writer_reproduces_the_independently_generated_node_vector() {
    let document: Value = serde_json::from_slice(VECTOR_BYTES).unwrap();
    assert_eq!(
        document["independentOracle"]["implementation"],
        "tinyrustlm/tools/tokenizer2-reference.js"
    );
    let expected = decode_hex(document["vectors"][0]["artifactHex"].as_str().unwrap());
    assert_eq!(Fixture::new().bytes(), expected);
}

#[test]
fn encoding_applies_pretoken_boundaries_ranked_merges_and_nfc() {
    let fixture = Fixture::new();
    let tokenizer = fixture.tokenizer();
    let mut tokens = vec![999];
    tokenizer.encode("hello world", &mut tokens).unwrap();
    assert_eq!(tokens, [259, 264]);

    tokenizer.encode("e\u{0301}", &mut tokens).unwrap();
    assert_eq!(tokens, [265]);

    tokenizer.encode("!!!", &mut tokens).unwrap();
    assert_eq!(tokens, [267]);

    tokenizer.encode("    ", &mut tokens).unwrap();
    assert_eq!(tokens, [269]);

    tokenizer.encode("A12", &mut tokens).unwrap();
    assert_eq!(
        tokens,
        [
            fixture.id_for_byte[b'A' as usize],
            fixture.id_for_byte[b'1' as usize],
            fixture.id_for_byte[b'2' as usize]
        ]
    );
}

#[test]
fn pretokenizer_preserves_contraction_and_whitespace_lookahead_semantics() {
    let fixture = Fixture::new();
    let tokenizer = fixture.tokenizer();
    let mut tokens = Vec::new();
    tokenizer.encode("x'ST", &mut tokens).unwrap();
    assert_eq!(
        tokens,
        [
            fixture.id_for_byte[b'x' as usize],
            fixture.id_for_byte[b'\'' as usize],
            fixture.id_for_byte[b'S' as usize],
            fixture.id_for_byte[b'T' as usize]
        ]
    );

    tokenizer.encode("x  y", &mut tokens).unwrap();
    assert_eq!(
        tokens,
        [
            fixture.id_for_byte[b'x' as usize],
            fixture.id_for_byte[b' ' as usize],
            fixture.id_for_byte[b' ' as usize],
            fixture.id_for_byte[b'y' as usize]
        ]
    );

    tokenizer.encode("a\r\n  b", &mut tokens).unwrap();
    let mut decoded = String::new();
    tokenizer
        .decode(&tokens, DecodeMode::IncludeAll, &mut decoded)
        .unwrap();
    assert_eq!(decoded, "a\r\n  b");
}

#[test]
fn added_tokens_are_longest_exact_and_precede_normalization() {
    let fixture = Fixture::new();
    let tokenizer = fixture.tokenizer();
    let mut tokens = Vec::new();
    tokenizer
        .encode("<|im_start|>hello<|im_end|><think>", &mut tokens)
        .unwrap();
    assert_eq!(tokens, [272, 259, 273, 274]);

    tokenizer.encode("<|im_start|><|im", &mut tokens).unwrap();
    assert_eq!(tokens, [272, 275]);

    tokenizer.encode("e\u{0301}!", &mut tokens).unwrap();
    assert_eq!(tokens, [276]);

    tokenizer.encode("<|im_start|", &mut tokens).unwrap();
    assert_ne!(tokens, [272]);
    assert_eq!(tokens.first(), Some(&275));
}

#[test]
fn decode_modes_are_explicit_and_invalid_utf8_fails_atomically() {
    let fixture = Fixture::new();
    let tokenizer = fixture.tokenizer();
    let mut output = String::from("stale");
    tokenizer
        .decode(&[272, 259, 273, 274], DecodeMode::IncludeAll, &mut output)
        .unwrap();
    assert_eq!(output, "<|im_start|>hello<|im_end|><think>");
    tokenizer
        .decode(&[272, 259, 273, 274], DecodeMode::SkipSpecial, &mut output)
        .unwrap();
    assert_eq!(output, "hello<think>");

    let invalid = fixture.id_for_byte[0xc3];
    assert_eq!(
        tokenizer
            .decode(&[invalid], DecodeMode::IncludeAll, &mut output)
            .unwrap_err()
            .code(),
        "tokenizer2-decoded-utf8"
    );
    assert!(output.is_empty());
}

#[test]
fn policy_limits_leave_outputs_empty() {
    let fixture = Fixture::new();
    let bytes = fixture.bytes();
    let tokenizer =
        Tokenizer2::from_bytes(bytes, TokenizerPolicy::new(1_048_576, 4, 1, 4).unwrap()).unwrap();
    let mut tokens = vec![123];
    assert_eq!(
        tokenizer.encode("hello", &mut tokens).unwrap_err().code(),
        "tokenizer2-input-limit"
    );
    assert!(tokens.is_empty());

    let mut output = String::from("stale");
    assert_eq!(
        tokenizer
            .decode(&[259, 259], DecodeMode::IncludeAll, &mut output)
            .unwrap_err()
            .code(),
        "tokenizer2-token-limit"
    );
    assert!(output.is_empty());
}

#[test]
fn every_truncation_is_rejected() {
    let bytes = Fixture::new().bytes();
    for length in 0..bytes.len() {
        let result = Tokenizer2::from_bytes(bytes[..length].to_vec(), policy());
        assert!(result.is_err(), "truncation {length} unexpectedly passed");
    }
}

#[test]
fn nonzero_padding_and_trailing_bytes_are_rejected() {
    let fixture = Fixture::new();
    let bytes = fixture.bytes();
    let merge_offset = read_u64(&bytes, 64) as usize;
    let token_count = u32::from_le_bytes(bytes[56..60].try_into().unwrap()) as usize;
    let token_end = 192 + token_count * 24;
    assert!(token_end < merge_offset);
    let mut padding = bytes.clone();
    padding[token_end] = 1;
    assert_eq!(
        Tokenizer2::from_bytes(padding, policy())
            .unwrap_err()
            .code(),
        "tokenizer2-padding"
    );

    let mut trailing = bytes;
    trailing.push(0);
    assert_eq!(
        Tokenizer2::from_bytes(trailing, policy())
            .unwrap_err()
            .code(),
        "tokenizer2-header"
    );
}

#[test]
fn token_and_merge_identity_mutations_are_rejected() {
    let bytes = Fixture::new().bytes();
    let byte_table_offset = read_u64(&bytes, 80) as usize;
    let mut duplicate = bytes.clone();
    duplicate[byte_table_offset + 1] = duplicate[byte_table_offset];
    assert_eq!(
        Tokenizer2::from_bytes(duplicate, policy())
            .unwrap_err()
            .code(),
        "tokenizer2-duplicate-token"
    );

    let merge_offset = read_u64(&bytes, 64) as usize;
    let mut wrong_output = bytes;
    wrong_output[merge_offset + 8..merge_offset + 12].copy_from_slice(&257_u32.to_le_bytes());
    assert_eq!(
        Tokenizer2::from_bytes(wrong_output, policy())
            .unwrap_err()
            .code(),
        "tokenizer2-merge-record"
    );
}

#[test]
fn writer_rejects_noncanonical_source_definitions_before_output() {
    let fixture = Fixture::new();
    let mut tokens = fixture.definitions();
    tokens[1].bytes = tokens[0].bytes;
    let mut output = vec![7, 8, 9];
    let error = write_tokenizer(
        &TokenizerSpec {
            tokens: &tokens,
            base_token_count: 271,
            merges: &fixture.merges,
            bos_token_id: None,
            eos_token_id: Some(273),
            pad_token_id: Some(271),
            unk_token_id: None,
        },
        &mut output,
    )
    .unwrap_err();
    assert_eq!(error.code(), "tokenizer2-duplicate-token");
    assert_eq!(output, [7, 8, 9]);
}

#[test]
fn gpt2_byte_order_is_a_bijection() {
    let order = gpt2_byte_order();
    let counts = order.into_iter().fold(HashMap::new(), |mut counts, byte| {
        *counts.entry(byte).or_insert(0_u32) += 1;
        counts
    });
    assert_eq!(counts.len(), 256);
    assert!(counts.values().all(|count| *count == 1));
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

fn decode_hex(value: &str) -> Vec<u8> {
    assert!(value.len().is_multiple_of(2));
    (0..value.len())
        .step_by(2)
        .map(|offset| u8::from_str_radix(&value[offset..offset + 2], 16).unwrap())
        .collect()
}
