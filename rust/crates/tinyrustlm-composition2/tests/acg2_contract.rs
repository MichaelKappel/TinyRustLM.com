//! Independent ACG2 profile, writer, parser, policy, and prefix tests.

use std::io::{self, Write};

use serde_json::Value;
use sha2::{Digest, Sha256};
use tinyrustlm_composition2::{
    write_acg2, Acg2Graph, Acg2Member, Acg2Policy, MemberRole, ACG2_FORMAT_PROFILE_ID,
    ACG2_FORMAT_PROFILE_SHA256,
};

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/acg2-format-profile.v1.json");
const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/acg2-format-vectors.v1.json");

#[test]
fn profile_and_writer_close_all_canonical_identities() {
    let profile: Value = serde_json::from_slice(PROFILE_BYTES).expect("profile JSON");
    let vectors: Value = serde_json::from_slice(VECTOR_BYTES).expect("vector JSON");
    assert_eq!(profile["profileId"], ACG2_FORMAT_PROFILE_ID);
    assert_eq!(profile["status"], "implemented-unpromoted");
    assert_eq!(
        hex_lower(&Sha256::digest(PROFILE_BYTES)),
        ACG2_FORMAT_PROFILE_SHA256
    );
    let members = members(&vectors["canonical"]["members"]);
    let mut artifact = Vec::new();
    let identity = write_acg2(&mut artifact, &members).expect("canonical writer");
    assert_eq!(artifact.len(), 896);
    assert_eq!(
        hex_lower(&artifact),
        vectors["canonical"]["artifactHex"].as_str().unwrap()
    );
    assert_eq!(
        hex_lower(&identity.artifact_sha256),
        vectors["canonical"]["artifactSha256"].as_str().unwrap()
    );
    assert_eq!(
        hex_lower(&identity.graph_identity_sha256),
        vectors["canonical"]["graphIdentitySha256"]
            .as_str()
            .unwrap()
    );
    assert_eq!(
        hex_lower(&identity.member_table_sha256),
        vectors["canonical"]["memberTableSha256"].as_str().unwrap()
    );
    let graph = Acg2Graph::from_bytes(&artifact, Acg2Policy::exact_profile_limits())
        .expect("canonical parser");
    assert_eq!(graph.identity(), identity);
    assert_eq!(graph.resolved_member_bytes(), 7_115_192);
}

#[test]
fn every_proper_prefix_and_surplus_byte_rejects() {
    let vectors: Value = serde_json::from_slice(VECTOR_BYTES).expect("vector JSON");
    let artifact = decode_hex(vectors["canonical"]["artifactHex"].as_str().unwrap());
    for length in 0..artifact.len() {
        assert_eq!(
            Acg2Graph::from_bytes(&artifact[..length], Acg2Policy::exact_profile_limits())
                .expect_err("proper prefix")
                .code(),
            "acg2-header"
        );
    }
    let mut surplus = artifact;
    surplus.push(0);
    assert_eq!(
        Acg2Graph::from_bytes(&surplus, Acg2Policy::exact_profile_limits())
            .expect_err("surplus")
            .code(),
        "acg2-artifact-limit"
    );
}

#[test]
fn policies_and_member_constructors_never_expand_the_profile() {
    assert_eq!(
        Acg2Policy::new(0).expect_err("zero policy").code(),
        "acg2-policy"
    );
    assert_eq!(
        Acg2Policy::new(897).expect_err("expanded policy").code(),
        "acg2-policy"
    );
    assert_eq!(
        Acg2Member::new(MemberRole::Model, 0, [1; 32])
            .expect_err("zero length")
            .code(),
        "acg2-member-length"
    );
    assert_eq!(
        Acg2Member::new(MemberRole::Prompt, 513, [1; 32])
            .expect_err("prompt over limit")
            .code(),
        "acg2-member-length"
    );
    assert_eq!(
        Acg2Member::new(MemberRole::Model, 1, [0; 32])
            .expect_err("zero digest")
            .code(),
        "acg2-member-identity"
    );
}

#[test]
fn writer_propagates_output_failure_without_partial_success() {
    let vectors: Value = serde_json::from_slice(VECTOR_BYTES).expect("vector JSON");
    let members = members(&vectors["canonical"]["members"]);
    let mut output = RefusingWriter;
    assert_eq!(
        write_acg2(&mut output, &members)
            .expect_err("write refusal")
            .code(),
        "acg2-write-failed"
    );
}

struct RefusingWriter;

impl Write for RefusingWriter {
    fn write(&mut self, _bytes: &[u8]) -> io::Result<usize> {
        Err(io::Error::new(io::ErrorKind::WriteZero, "refused"))
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn members(value: &Value) -> [Acg2Member; 5] {
    let entries = value.as_array().expect("member array");
    std::array::from_fn(|index| {
        let member = &entries[index];
        Acg2Member::new(
            MemberRole::from_name(member["role"].as_str().unwrap()).unwrap(),
            member["artifactBytes"].as_u64().unwrap(),
            digest(member["artifactSha256"].as_str().unwrap()),
        )
        .unwrap()
    })
}

fn digest(value: &str) -> [u8; 32] {
    decode_hex(value).try_into().expect("32-byte digest")
}

fn decode_hex(value: &str) -> Vec<u8> {
    assert_eq!(value.len() % 2, 0);
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
