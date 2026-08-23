//! Cross-language Prompt2 artifact, request, result, and mutation replay tests.

use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_prompt2::{
    parse_request, parse_result, write_request, write_result, Prompt2Artifact, Prompt2Policy,
};

const VECTORS: &str = include_str!("../../../../contracts/vnext/prompt2-format-vectors.v1.json");

#[test]
fn rust_writer_and_parser_reproduce_the_node_artifact_and_mutations() {
    let vectors = vectors();
    let artifact = hex_bytes(text(&vectors["artifact"]["artifactHex"]));
    let mut written = Vec::new();
    let identity = tinyrustlm_prompt2::write_prompt2(&mut written).expect("Rust writer");
    assert_eq!(written, artifact);
    assert_eq!(
        identity.byte_length,
        number(&vectors["artifact"]["byteLength"])
    );
    assert_eq!(
        hex_lower(&identity.sha256),
        text(&vectors["artifact"]["sha256"])
    );
    for mutation in array(&vectors["artifact"]["mutations"]) {
        let mutated = apply_mutation(&artifact, mutation);
        let error = Prompt2Artifact::from_bytes(&mutated, Prompt2Policy::exact_profile_limits())
            .expect_err(text(&mutation["id"]));
        assert_eq!(
            error.code(),
            text(&mutation["expectedError"]),
            "{}",
            text(&mutation["id"])
        );
    }
}

#[test]
fn rust_request_wire_reproduces_every_node_case_and_mutation() {
    let vectors = vectors();
    for case in array(&vectors["requestCases"]) {
        let bytes = hex_bytes(text(&case["requestHex"]));
        assert_eq!(bytes.len() as u64, number(&case["byteLength"]));
        assert_eq!(sha256_hex(&bytes), text(&case["sha256"]));
        let request = parse_request(&bytes, 1_054_848)
            .unwrap_or_else(|error| panic!("{}: {error}", text(&case["id"])));
        assert_eq!(
            request.messages().len(),
            array(&case["parsed"]["messages"]).len()
        );
        assert_eq!(request.seed().to_string(), text(&case["parsed"]["seed"]));
        assert_eq!(
            request.sampling().temperature_millionths(),
            number(&case["parsed"]["config"]["temperatureMillionths"]) as u32
        );
        assert_eq!(
            request.sampling().top_k(),
            number(&case["parsed"]["config"]["topK"]) as u32
        );
        assert_eq!(
            request.sampling().top_p_millionths(),
            number(&case["parsed"]["config"]["topPMillionths"]) as u32
        );
        assert_eq!(
            request.sampling().repetition_penalty_millionths(),
            number(&case["parsed"]["config"]["repetitionPenaltyMillionths"]) as u32
        );
        assert_eq!(
            request.sampling().repetition_window(),
            number(&case["parsed"]["config"]["repetitionWindow"]) as u32
        );
        assert_eq!(
            request.sampling().maximum_new_tokens(),
            number(&case["parsed"]["config"]["maximumNewTokens"]) as u32
        );
        assert_eq!(write_request(&request).expect("Rust request writer"), bytes);
    }
    let base = hex_bytes(text(&vectors["requestCases"][0]["requestHex"]));
    for mutation in array(&vectors["requestMutations"]) {
        let mutated = apply_mutation(&base, mutation);
        let error = parse_request(&mutated, 1_054_848).expect_err(text(&mutation["id"]));
        assert_eq!(
            error.code(),
            text(&mutation["expectedError"]),
            "{}",
            text(&mutation["id"])
        );
    }
}

#[test]
fn rust_result_wire_reproduces_active_and_context_limit_cases() {
    let vectors = vectors();
    for case in array(&vectors["resultCases"]) {
        let chunks = array(&case["resultHexChunks"]);
        assert!(chunks.iter().all(|chunk| text(chunk).len() <= 65_536));
        let joined = chunks.iter().map(text).collect::<String>();
        let bytes = hex_bytes(&joined);
        assert_eq!(bytes.len() as u64, number(&case["byteLength"]));
        assert_eq!(sha256_hex(&bytes), text(&case["sha256"]));
        let result = parse_result(&bytes, 1_310_720)
            .unwrap_or_else(|error| panic!("{}: {error}", text(&case["id"])));
        assert_eq!(
            result.rendered_utf8(),
            text(&case["parsed"]["renderedUtf8"])
        );
        assert_eq!(
            result.token_ids().len() as u64,
            number(&case["parsed"]["tokenCount"])
        );
        let token_bytes: Vec<u8> = result
            .token_ids()
            .iter()
            .flat_map(|token_id| token_id.to_le_bytes())
            .collect();
        assert_eq!(
            sha256_hex(&token_bytes),
            text(&case["parsed"]["tokenIdsU32LeSha256"])
        );
        assert_eq!(write_result(&result).expect("Rust result writer"), bytes);
    }
    let first = &array(&vectors["resultCases"])[0];
    let joined = array(&first["resultHexChunks"])
        .iter()
        .map(text)
        .collect::<String>();
    let base = hex_bytes(&joined);
    for mutation in array(&vectors["resultMutations"]) {
        let mutated = apply_mutation(&base, mutation);
        let error = parse_result(&mutated, 1_310_720).expect_err(text(&mutation["id"]));
        assert_eq!(
            error.code(),
            text(&mutation["expectedError"]),
            "{}",
            text(&mutation["id"])
        );
    }
}

fn vectors() -> Value {
    serde_json::from_str(VECTORS).expect("Prompt2 vector JSON")
}

fn array(value: &Value) -> &[Value] {
    value.as_array().expect("array")
}

fn text(value: &Value) -> &str {
    value.as_str().expect("string")
}

fn number(value: &Value) -> u64 {
    value.as_u64().expect("u64")
}

fn apply_mutation(original: &[u8], mutation: &Value) -> Vec<u8> {
    let kind = text(&mutation["kind"]);
    if kind == "truncate" {
        return original[..number(&mutation["length"]) as usize].to_vec();
    }
    if kind == "append" {
        let mut output = original.to_vec();
        output.extend_from_slice(&hex_bytes(text(&mutation["hex"])));
        return output;
    }
    let mut output = original.to_vec();
    let offset = number(&mutation["offset"]) as usize;
    match kind {
        "xor" => output[offset] ^= number(&mutation["mask"]) as u8,
        "set-u16" => output[offset..offset + 2]
            .copy_from_slice(&(number(&mutation["value"]) as u16).to_le_bytes()),
        "set-u32" => output[offset..offset + 4]
            .copy_from_slice(&(number(&mutation["value"]) as u32).to_le_bytes()),
        "set-u64" => {
            output[offset..offset + 8].copy_from_slice(&number(&mutation["value"]).to_le_bytes())
        }
        "fill" => output[offset..offset + number(&mutation["length"]) as usize]
            .fill(number(&mutation["value"]) as u8),
        _ => panic!("unknown mutation {kind}"),
    }
    output
}

fn hex_bytes(value: &str) -> Vec<u8> {
    assert_eq!(value.len() % 2, 0);
    (0..value.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&value[index..index + 2], 16).expect("hex"))
        .collect()
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
