//! Cross-language replay of the independent Node-authored Template2 vectors.

use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_template2::{
    write_template, ControlKind, Message, Role, Template2, Template2Policy,
    QWEN3_TEMPLATE2_ARTIFACT_SHA256,
};

const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/template2-format-vectors.v1.json");

fn document() -> Value {
    serde_json::from_slice(VECTOR_BYTES).unwrap()
}

fn vector(document: &Value) -> &Value {
    &document["vectors"][0]
}

fn artifact(vector: &Value) -> Vec<u8> {
    decode_hex(vector["artifactHex"].as_str().unwrap())
}

fn policy() -> Template2Policy {
    Template2Policy::exact_profile_limits()
}

#[test]
fn rust_writer_reproduces_the_independent_node_artifact() {
    let document = document();
    let vector = vector(&document);
    assert_eq!(
        document["independentOracle"]["implementation"],
        "tinyrustlm/tools/template2-reference.js"
    );
    let expected = artifact(vector);
    let mut actual = Vec::new();
    let identity = write_template(&mut actual).unwrap();
    assert_eq!(actual, expected);
    assert_eq!(actual.len() as u64, identity.byte_length);
    assert_eq!(identity.sha256, Sha256::digest(&actual).as_slice());
    assert_eq!(hex_lower(&identity.sha256), QWEN3_TEMPLATE2_ARTIFACT_SHA256);
    assert_eq!(vector["artifactSha256"], QWEN3_TEMPLATE2_ARTIFACT_SHA256);
}

#[test]
fn rust_renderer_reproduces_every_node_byte_and_insertion_vector() {
    let document = document();
    let vector = vector(&document);
    let template = Template2::from_bytes(artifact(vector), policy()).unwrap();
    assert_eq!(vector["renderCases"].as_array().unwrap().len(), 8);
    for case in vector["renderCases"].as_array().unwrap() {
        let message_values = case["messages"].as_array().unwrap();
        let messages: Vec<_> = message_values
            .iter()
            .map(|message| Message {
                role: parse_role(message["role"].as_str().unwrap()),
                content: message["content"].as_str().unwrap(),
            })
            .collect();
        let rendered = template.render(&messages).unwrap();
        assert_eq!(
            hex_lower(rendered.as_bytes()),
            case["expectedUtf8Hex"].as_str().unwrap(),
            "{}",
            case["id"]
        );
        let expected = case["expectedInsertions"].as_array().unwrap();
        assert_eq!(rendered.insertions().len(), expected.len());
        for (actual, expected) in rendered.insertions().iter().zip(expected) {
            assert_eq!(
                control_kind_name(actual.kind),
                expected["kind"].as_str().unwrap()
            );
            assert_eq!(
                actual.message_index.map(u64::from),
                expected["messageIndex"].as_u64()
            );
            assert_eq!(
                u64::from(actual.token_id),
                expected["tokenId"].as_u64().unwrap()
            );
            assert_eq!(actual.byte_offset, expected["byteOffset"].as_u64().unwrap());
        }
    }
}

#[test]
fn rust_rejects_every_node_forbidden_content_vector() {
    let document = document();
    let vector = vector(&document);
    let template = Template2::from_bytes(artifact(vector), policy()).unwrap();
    let cases = vector["forbiddenContentCases"].as_array().unwrap();
    assert_eq!(cases.len(), 26);
    for case in cases {
        let content = String::from_utf8(decode_hex(case["utf8Hex"].as_str().unwrap())).unwrap();
        let wrapped = format!("before{content}after");
        assert_eq!(
            template
                .render(&[Message {
                    role: Role::User,
                    content: &wrapped,
                }])
                .unwrap_err()
                .code(),
            case["expectedError"].as_str().unwrap()
        );
    }
}

#[test]
fn rust_parser_rejects_every_node_authored_mutation() {
    let document = document();
    let vector = vector(&document);
    let original = artifact(vector);
    let mutations = vector["mutations"].as_array().unwrap();
    assert_eq!(mutations.len(), 15);
    for mutation in mutations {
        let mutated = apply_mutation(&original, mutation);
        assert_eq!(
            Template2::from_bytes(mutated, policy()).unwrap_err().code(),
            mutation["expectedError"].as_str().unwrap(),
            "{}",
            mutation["id"]
        );
    }
}

#[test]
fn rust_parser_rejects_every_node_declared_truncation() {
    let document = document();
    let vector = vector(&document);
    let original = artifact(vector);
    assert_eq!(
        vector["truncation"]["endExclusive"].as_u64().unwrap(),
        original.len() as u64
    );
    for length in 0..original.len() {
        assert!(Template2::from_bytes(original[..length].to_vec(), policy()).is_err());
    }
}

fn parse_role(value: &str) -> Role {
    match value {
        "system" => Role::System,
        "user" => Role::User,
        "assistant" => Role::Assistant,
        _ => panic!("unknown vector role"),
    }
}

fn control_kind_name(value: ControlKind) -> &'static str {
    match value {
        ControlKind::MessageStart => "message-start",
        ControlKind::MessageEnd => "message-end",
        ControlKind::GenerationStart => "generation-start",
        ControlKind::ThinkingStart => "thinking-start",
        ControlKind::ThinkingEnd => "thinking-end",
    }
}

fn apply_mutation(original: &[u8], mutation: &Value) -> Vec<u8> {
    let operation = mutation["operation"].as_str().unwrap();
    let mut output = original.to_vec();
    match operation {
        "set-byte" => {
            let offset = mutation["offset"].as_u64().unwrap() as usize;
            output[offset] = mutation["value"].as_u64().unwrap() as u8;
        }
        "xor-byte" => {
            let offset = mutation["offset"].as_u64().unwrap() as usize;
            output[offset] ^= mutation["value"].as_u64().unwrap() as u8;
        }
        "replace-hex" => {
            let offset = mutation["offset"].as_u64().unwrap() as usize;
            let replacement = decode_hex(mutation["hex"].as_str().unwrap());
            output[offset..offset + replacement.len()].copy_from_slice(&replacement);
        }
        "append-hex" => output.extend_from_slice(&decode_hex(mutation["hex"].as_str().unwrap())),
        _ => panic!("unknown mutation operation"),
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

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
