//! Cross-language Tokenizer2 vector and hostile-artifact conformance tests.

use serde::Deserialize;
use sha2::{Digest, Sha256};
use tinyrustlm_tokenizer2::{
    DecodeMode, Tokenizer2, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID,
    TOKENIZER2_FORMAT_PROFILE_SHA256,
};

const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/tokenizer2-format-vectors.v1.json");
const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/tokenizer2-format-profile.v1.json");
const INDEPENDENT_ORACLE_BYTES: &[u8] =
    include_bytes!("../../../../tinyrustlm/tools/tokenizer2-reference.js");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VectorDocument {
    schema: String,
    profile_id: String,
    profile_sha256: String,
    independent_oracle: IndependentOracle,
    oracle_scope: OracleScope,
    vectors: Vec<Vector>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct IndependentOracle {
    implementation: String,
    source_sha256: String,
    roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OracleScope {
    normalization: String,
    pretokenization: String,
    claim_beyond_vectors: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Vector {
    id: String,
    artifact_hex: String,
    artifact_byte_length: u64,
    artifact_sha256: String,
    header: Header,
    added_tokens: Vec<AddedToken>,
    pretoken_cases: Vec<PretokenCase>,
    encoding_cases: Vec<EncodingCase>,
    decoding_cases: Vec<DecodingCase>,
    mutations: Vec<Mutation>,
    truncation: Truncation,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Header {
    header_bytes: u32,
    version_major: u16,
    version_minor: u16,
    algorithm_profile: u16,
    file_size: u64,
    token_table_offset: u64,
    token_count: u32,
    token_record_bytes: u32,
    merge_table_offset: u64,
    merge_count: u32,
    merge_record_bytes: u32,
    byte_table_offset: u64,
    byte_table_length: u64,
    base_token_count: u32,
    added_token_count: u32,
    bos_token_id: Option<u32>,
    eos_token_id: Option<u32>,
    pad_token_id: Option<u32>,
    unk_token_id: Option<u32>,
    maximum_token_bytes: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AddedToken {
    id: u32,
    utf8_hex: String,
    special: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PretokenCase {
    id: String,
    normalized_input_utf8_hex: String,
    expected_piece_utf8_hex: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EncodingCase {
    id: String,
    input_utf8_hex: String,
    expected_token_ids: Vec<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DecodingCase {
    id: String,
    token_ids: Vec<u32>,
    mode: String,
    expected_utf8_hex: Option<String>,
    expected_error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Mutation {
    id: String,
    operation: String,
    offset: Option<usize>,
    value: Option<u8>,
    hex: Option<String>,
    expected_error: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Truncation {
    operation: String,
    start_inclusive: usize,
    end_exclusive: usize,
    expected: String,
}

fn policy() -> TokenizerPolicy {
    TokenizerPolicy::new(1_048_576, 65_536, 65_536, 262_144).unwrap()
}

fn document() -> VectorDocument {
    serde_json::from_slice(VECTOR_BYTES).unwrap()
}

fn canonical() -> (VectorDocument, Vec<u8>) {
    let document = document();
    assert_eq!(document.vectors.len(), 1);
    let artifact = decode_hex(&document.vectors[0].artifact_hex);
    (document, artifact)
}

#[test]
fn document_binds_profile_generator_and_narrow_oracle_scope() {
    let document = document();
    assert_eq!(
        document.schema,
        "tinyrustlm.vnext.tokenizer2-format-vectors.v1"
    );
    assert_eq!(document.profile_id, TOKENIZER2_FORMAT_PROFILE_ID);
    assert_eq!(document.profile_sha256, TOKENIZER2_FORMAT_PROFILE_SHA256);
    assert_eq!(
        hex_lower(&Sha256::digest(PROFILE_BYTES)),
        document.profile_sha256
    );
    assert_eq!(
        document.independent_oracle.implementation,
        "tinyrustlm/tools/tokenizer2-reference.js"
    );
    assert_eq!(
        hex_lower(&Sha256::digest(INDEPENDENT_ORACLE_BYTES)),
        document.independent_oracle.source_sha256
    );
    assert_eq!(
        document.independent_oracle.roles,
        ["vector-generator", "writer", "parser", "encoder", "decoder"]
    );
    assert_eq!(
        document.oracle_scope.normalization,
        "frozen-vector-code-points-stable-across-unicode-9-through-17"
    );
    assert_eq!(
        document.oracle_scope.pretokenization,
        "frozen-vector-code-points-only"
    );
    assert!(!document.oracle_scope.claim_beyond_vectors);
}

#[test]
fn canonical_artifact_identity_header_and_added_tokens_are_exact() {
    let (document, artifact) = canonical();
    let vector = &document.vectors[0];
    let tokenizer = Tokenizer2::from_bytes(artifact.clone(), policy()).unwrap();
    let header = &vector.header;
    assert_eq!(vector.id, "qwen-bytelevel-bpe-canonical-miniature");
    assert_eq!(artifact.len() as u64, vector.artifact_byte_length);
    assert_eq!(
        hex_lower(&Sha256::digest(&artifact)),
        vector.artifact_sha256
    );
    assert_eq!(
        tokenizer.identity().byte_length,
        vector.artifact_byte_length
    );
    assert_eq!(
        hex_lower(&tokenizer.identity().sha256),
        vector.artifact_sha256
    );
    assert_eq!(
        (
            header.header_bytes,
            header.version_major,
            header.version_minor,
            header.algorithm_profile
        ),
        (192, 2, 0, 1)
    );
    assert_eq!(header.file_size, vector.artifact_byte_length);
    assert_eq!(header.token_table_offset, 192);
    assert_eq!(header.token_count, 277);
    assert_eq!(header.token_record_bytes, 24);
    assert_eq!(header.merge_count, 15);
    assert_eq!(header.merge_record_bytes, 16);
    assert!(header.merge_table_offset > header.token_table_offset);
    assert!(header.byte_table_offset > header.merge_table_offset);
    assert_eq!(
        header.byte_table_offset + header.byte_table_length,
        header.file_size
    );
    assert_eq!(header.base_token_count, 271);
    assert_eq!(header.added_token_count, 6);
    assert_eq!(header.bos_token_id, None);
    assert_eq!(header.eos_token_id, Some(273));
    assert_eq!(header.pad_token_id, Some(271));
    assert_eq!(header.unk_token_id, None);
    assert_eq!(header.maximum_token_bytes, 13);
    assert_eq!(tokenizer.token_count(), header.token_count);
    assert_eq!(tokenizer.base_token_count(), header.base_token_count);
    assert_eq!(tokenizer.bos_token_id(), header.bos_token_id);
    assert_eq!(tokenizer.eos_token_id(), header.eos_token_id);
    assert_eq!(tokenizer.pad_token_id(), header.pad_token_id);
    assert_eq!(vector.added_tokens.len(), 6);
    assert_eq!(
        vector
            .added_tokens
            .iter()
            .map(|entry| (entry.id, entry.utf8_hex.as_str(), entry.special))
            .collect::<Vec<_>>(),
        [
            (271, "3c7c656e646f66746578747c3e", true),
            (272, "3c7c696d5f73746172747c3e", true),
            (273, "3c7c696d5f656e647c3e", true),
            (274, "3c7468696e6b3e", false),
            (275, "3c7c696d", false),
            (276, "65cc8121", false),
        ]
    );
}

#[test]
fn rust_runtime_matches_every_frozen_encoding_and_decoding_case() {
    let (document, artifact) = canonical();
    let vector = &document.vectors[0];
    let tokenizer = Tokenizer2::from_bytes(artifact, policy()).unwrap();
    assert_eq!(vector.pretoken_cases.len(), 11);
    assert!(vector.pretoken_cases.iter().all(|case| {
        !case.id.is_empty()
            && !case.expected_piece_utf8_hex.is_empty()
            && case.expected_piece_utf8_hex.concat() == case.normalized_input_utf8_hex
    }));

    for case in &vector.encoding_cases {
        let input = String::from_utf8(decode_hex(&case.input_utf8_hex)).unwrap();
        let mut output = vec![u32::MAX];
        tokenizer.encode(&input, &mut output).unwrap();
        assert_eq!(output, case.expected_token_ids, "{}", case.id);
    }

    for case in &vector.decoding_cases {
        let mode = match case.mode.as_str() {
            "include-all" => DecodeMode::IncludeAll,
            "skip-special" => DecodeMode::SkipSpecial,
            value => panic!("unexpected decode mode {value}"),
        };
        let mut output = String::from("stale");
        match (&case.expected_utf8_hex, &case.expected_error) {
            (Some(expected), None) => {
                tokenizer
                    .decode(&case.token_ids, mode, &mut output)
                    .unwrap();
                assert_eq!(hex_lower(output.as_bytes()), *expected, "{}", case.id);
            }
            (None, Some(expected)) => {
                let error = tokenizer
                    .decode(&case.token_ids, mode, &mut output)
                    .unwrap_err();
                assert_eq!(error.code(), expected, "{}", case.id);
                assert!(output.is_empty(), "{}", case.id);
            }
            _ => panic!("decode case {} has an invalid expectation", case.id),
        }
    }
}

#[test]
fn rust_parser_rejects_all_frozen_mutations_and_every_truncation() {
    let (document, artifact) = canonical();
    let vector = &document.vectors[0];
    assert_eq!(vector.mutations.len(), 13);
    for mutation in &vector.mutations {
        let mutated = apply_mutation(&artifact, mutation);
        let error = Tokenizer2::from_bytes(mutated, policy()).unwrap_err();
        assert_eq!(error.code(), mutation.expected_error, "{}", mutation.id);
    }

    assert_eq!(vector.truncation.operation, "every-prefix-length");
    assert_eq!(vector.truncation.start_inclusive, 0);
    assert_eq!(vector.truncation.end_exclusive, artifact.len());
    assert_eq!(vector.truncation.expected, "reject");
    for length in vector.truncation.start_inclusive..vector.truncation.end_exclusive {
        assert!(
            Tokenizer2::from_bytes(artifact[..length].to_vec(), policy()).is_err(),
            "truncated prefix {length} unexpectedly parsed"
        );
    }
}

fn apply_mutation(source: &[u8], mutation: &Mutation) -> Vec<u8> {
    let mut bytes = source.to_vec();
    match mutation.operation.as_str() {
        "xor-byte" => {
            bytes[mutation.offset.unwrap()] ^= mutation.value.unwrap();
        }
        "set-byte" => {
            bytes[mutation.offset.unwrap()] = mutation.value.unwrap();
        }
        "replace-hex" => {
            let replacement = decode_hex(mutation.hex.as_ref().unwrap());
            let offset = mutation.offset.unwrap();
            bytes[offset..offset + replacement.len()].copy_from_slice(&replacement);
        }
        "append-hex" => bytes.extend(decode_hex(mutation.hex.as_ref().unwrap())),
        operation => panic!("unsupported mutation operation {operation}"),
    }
    bytes
}

fn decode_hex(value: &str) -> Vec<u8> {
    assert!(value.len().is_multiple_of(2));
    (0..value.len())
        .step_by(2)
        .map(|offset| u8::from_str_radix(&value[offset..offset + 2], 16).unwrap())
        .collect()
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
