//! Cross-language replay of the independent Node-authored Sampling2 vectors.

use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_sampling2::{
    fixed_score_from_bits, write_sampling2, GenerationController, GenerationStatus, Sampling2,
    Sampling2Config, Sampling2Policy, Sampling2State, SAMPLING2_ARTIFACT_SHA256,
};

const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/sampling2-format-vectors.v1.json");

fn document() -> Value {
    serde_json::from_slice(VECTOR_BYTES).unwrap()
}

fn artifact(document: &Value) -> Vec<u8> {
    decode_hex(document["artifact"]["artifactHex"].as_str().unwrap())
}

fn policy() -> Sampling2Policy {
    Sampling2Policy::exact_profile_limits()
}

fn parse_config(value: &Value) -> Sampling2Config {
    Sampling2Config::new(
        value["temperatureMillionths"].as_u64().unwrap() as u32,
        value["topK"].as_u64().unwrap() as u32,
        value["topPMillionths"].as_u64().unwrap() as u32,
        value["repetitionPenaltyMillionths"].as_u64().unwrap() as u32,
        value["repetitionWindow"].as_u64().unwrap() as u32,
        value["maximumNewTokens"].as_u64().unwrap() as u32,
    )
    .unwrap()
}

fn parse_state_hex(value: &str) -> Sampling2State {
    Sampling2State::from_bytes(decode_hex(value).try_into().unwrap()).unwrap()
}

fn parse_bits(value: &Value) -> Vec<u32> {
    value
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| u32::from_str_radix(entry.as_str().unwrap(), 16).unwrap())
        .collect()
}

#[test]
fn rust_writer_reproduces_the_independent_node_artifact() {
    let document = document();
    assert_eq!(
        document["independentOracle"]["implementation"],
        "tinyrustlm/tools/sampling2-reference.js"
    );
    let expected = artifact(&document);
    let mut actual = Vec::new();
    let identity = write_sampling2(&mut actual).unwrap();
    assert_eq!(actual, expected);
    assert_eq!(identity.byte_length, actual.len() as u64);
    assert_eq!(identity.sha256, Sha256::digest(&actual).as_slice());
    assert_eq!(hex_lower(&identity.sha256), SAMPLING2_ARTIFACT_SHA256);
    assert_eq!(document["artifact"]["sha256"], SAMPLING2_ARTIFACT_SHA256);
    assert_eq!(
        Sampling2::from_bytes(actual, policy()).unwrap().identity(),
        identity
    );
}

#[test]
fn rust_parser_rejects_every_node_authored_mutation() {
    let document = document();
    let original = artifact(&document);
    for mutation in document["artifact"]["mutations"].as_array().unwrap() {
        let mutated = apply_mutation(&original, mutation);
        assert_eq!(
            Sampling2::from_bytes(mutated, policy()).unwrap_err().code(),
            mutation["expectedError"].as_str().unwrap(),
            "{}",
            mutation["id"]
        );
    }
}

#[test]
fn rust_parser_rejects_every_registered_proper_prefix() {
    let document = document();
    let original = artifact(&document);
    assert_eq!(
        document["artifact"]["truncation"]["endExclusive"]
            .as_u64()
            .unwrap(),
        original.len() as u64
    );
    for length in 0..original.len() {
        assert!(Sampling2::from_bytes(original[..length].to_vec(), policy()).is_err());
    }
}

#[test]
fn rust_fixed_score_conversion_matches_every_node_case() {
    for entry in document()["fixedScoreCases"].as_array().unwrap() {
        let bits = u32::from_str_radix(entry["bitsHex"].as_str().unwrap(), 16).unwrap();
        assert_eq!(
            fixed_score_from_bits(bits).unwrap().unwrap().to_string(),
            entry["expectedQ20"].as_str().unwrap(),
            "{}",
            entry["id"]
        );
    }
}

#[test]
fn rust_splitmix_and_xoshiro_sequences_match_every_node_case() {
    for entry in document()["prngCases"].as_array().unwrap() {
        let seed = entry["seed"].as_str().unwrap().parse::<u64>().unwrap();
        let mut state = Sampling2State::from_seed(seed);
        assert_eq!(
            hex_lower(&state.to_bytes()),
            entry["initialStateHex"].as_str().unwrap()
        );
        let actual: Vec<String> = (0..8)
            .map(|_| state.next_u64().unwrap().to_string())
            .collect();
        let expected: Vec<String> = entry["firstEightU64"]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_str().unwrap().to_owned())
            .collect();
        assert_eq!(actual, expected, "{}", entry["seed"]);
        assert_eq!(
            hex_lower(&state.to_bytes()),
            entry["finalStateHex"].as_str().unwrap()
        );
    }
}

#[test]
fn rust_u128_rejection_consumes_the_exact_registered_prng_state() {
    let document = document();
    let entry = &document["u128RejectionCase"];
    let bound = entry["bound"].as_str().unwrap().parse::<u128>().unwrap();
    let state_entry = &entry["prngState"];
    let mut state = parse_state_hex(state_entry["initialStateHex"].as_str().unwrap());
    let value = state.uniform_below(bound).unwrap();
    assert_eq!(
        value.to_string(),
        state_entry["expectedValue"].as_str().unwrap()
    );
    assert_eq!(
        hex_lower(&state.to_bytes()),
        state_entry["expectedStateHex"].as_str().unwrap()
    );
    assert_eq!(
        state.draw_count(),
        state_entry["expectedConsumedWords"].as_u64().unwrap()
    );
    assert!(state.draw_count() > 2, "the vector must exercise rejection");
}

#[test]
fn rust_sampler_matches_every_greedy_and_weighted_node_case() {
    let document = document();
    let sampling = Sampling2::from_bytes(artifact(&document), policy()).unwrap();
    for entry in document["sampleCases"].as_array().unwrap() {
        let bits = parse_bits(&entry["logitBitsHex"]);
        let history: Vec<u32> = entry["generatedHistory"]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_u64().unwrap() as u32)
            .collect();
        let result = sampling
            .sample_bits(
                &bits,
                &history,
                parse_config(&entry["config"]),
                parse_state_hex(entry["initialStateHex"].as_str().unwrap()),
            )
            .unwrap();
        assert_eq!(
            u64::from(result.token_id),
            entry["expectedTokenId"].as_u64().unwrap(),
            "{}",
            entry["id"]
        );
        assert_eq!(
            hex_lower(&result.state.to_bytes()),
            entry["expectedStateHex"].as_str().unwrap(),
            "{}",
            entry["id"]
        );
    }
}

#[test]
fn rust_generation_controller_matches_every_node_terminal_case() {
    let document = document();
    let sampling = Sampling2::from_bytes(artifact(&document), policy()).unwrap();
    for entry in document["generationCases"].as_array().unwrap() {
        let stop_token_ids: Vec<u32> = entry["stopTokenIds"]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_u64().unwrap() as u32)
            .collect();
        let mut controller = GenerationController::new(
            &sampling,
            parse_config(&entry["config"]),
            entry["promptTokenCount"].as_u64().unwrap() as u32,
            entry["vocabularySize"].as_u64().unwrap() as u32,
            &stop_token_ids,
            parse_state_hex(entry["initialStateHex"].as_str().unwrap()),
        )
        .unwrap();
        if !entry["logitBitsHex"].is_null() {
            let bits = parse_bits(&entry["logitBitsHex"]);
            controller
                .step_bits(&sampling, &bits, entry["cancelled"].as_bool().unwrap())
                .unwrap();
        }
        assert_eq!(
            status_name(controller.status()),
            entry["expectedStatus"].as_str().unwrap(),
            "{}",
            entry["id"]
        );
        let expected_generated: Vec<u32> = entry["expectedGenerated"]
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_u64().unwrap() as u32)
            .collect();
        assert_eq!(controller.generated_token_ids(), expected_generated);
        assert_eq!(
            terminal_token(controller.status()).map(u64::from),
            entry["expectedTerminalTokenId"].as_u64(),
            "{}",
            entry["id"]
        );
        assert_eq!(
            hex_lower(&controller.sampling_state().to_bytes()),
            entry["expectedStateHex"].as_str().unwrap(),
            "{}",
            entry["id"]
        );
    }
}

fn status_name(status: GenerationStatus) -> &'static str {
    match status {
        GenerationStatus::Active => "active",
        GenerationStatus::StopToken(_) => "stop-token",
        GenerationStatus::MaximumNewTokens => "maximum-new-tokens",
        GenerationStatus::ContextLimit => "context-limit",
        GenerationStatus::Cancelled => "cancelled",
    }
}

fn terminal_token(status: GenerationStatus) -> Option<u32> {
    match status {
        GenerationStatus::StopToken(token_id) => Some(token_id),
        _ => None,
    }
}

fn apply_mutation(original: &[u8], mutation: &Value) -> Vec<u8> {
    let mut output = original.to_vec();
    match mutation["operation"].as_str().unwrap() {
        "set-byte" => {
            output[mutation["offset"].as_u64().unwrap() as usize] =
                mutation["value"].as_u64().unwrap() as u8;
        }
        "xor-byte" => {
            output[mutation["offset"].as_u64().unwrap() as usize] ^=
                mutation["value"].as_u64().unwrap() as u8;
        }
        "replace-hex" => {
            let offset = mutation["offset"].as_u64().unwrap() as usize;
            let replacement = decode_hex(mutation["hex"].as_str().unwrap());
            output[offset..offset + replacement.len()].copy_from_slice(&replacement);
        }
        "append-hex" => output.extend_from_slice(&decode_hex(mutation["hex"].as_str().unwrap())),
        operation => panic!("unknown mutation operation {operation}"),
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
