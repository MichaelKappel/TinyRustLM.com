//! Cross-language ACG2 hostile-vector and alternate-identity replay.

use serde_json::Value;
use tinyrustlm_composition2::{Acg2Graph, Acg2Policy};

const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/acg2-format-vectors.v1.json");

#[test]
fn every_registered_hostile_artifact_has_the_node_verdict() {
    let vectors: Value = serde_json::from_slice(VECTOR_BYTES).expect("vector JSON");
    let mutations = vectors["canonical"]["mutations"]
        .as_array()
        .expect("mutations");
    assert_eq!(mutations.len(), 32);
    for mutation in mutations {
        let bytes = decode_hex(mutation["artifactHex"].as_str().unwrap());
        let expected = mutation["expectedError"].as_str().unwrap();
        let actual = Acg2Graph::from_bytes(&bytes, Acg2Policy::exact_profile_limits())
            .expect_err(mutation["id"].as_str().unwrap())
            .code();
        assert_eq!(actual, expected, "{}", mutation["id"]);
    }
}

#[test]
fn alternate_model_graph_is_valid_and_cryptographically_distinct() {
    let vectors: Value = serde_json::from_slice(VECTOR_BYTES).expect("vector JSON");
    let canonical = parse(&vectors["canonical"]);
    let alternate = parse(&vectors["alternateValidModel"]);
    assert_ne!(
        canonical.member(tinyrustlm_composition2::MemberRole::Model),
        alternate.member(tinyrustlm_composition2::MemberRole::Model)
    );
    assert_eq!(canonical.members()[1..], alternate.members()[1..]);
    assert_ne!(canonical.identity(), alternate.identity());
    assert_eq!(
        hex_lower(&alternate.identity().artifact_sha256),
        vectors["alternateValidModel"]["artifactSha256"]
            .as_str()
            .unwrap()
    );
}

fn parse(value: &Value) -> Acg2Graph {
    Acg2Graph::from_bytes(
        &decode_hex(value["artifactHex"].as_str().unwrap()),
        Acg2Policy::exact_profile_limits(),
    )
    .expect("valid graph")
}

fn decode_hex(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| (nibble(pair[0]) << 4) | nibble(pair[1]))
        .collect()
}

fn nibble(value: u8) -> u8 {
    match value {
        b'0'..=b'9' => value - b'0',
        b'a'..=b'f' => value - b'a' + 10,
        _ => panic!("non-hex vector"),
    }
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
