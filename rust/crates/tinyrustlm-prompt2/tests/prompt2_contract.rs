//! Independent Prompt2 profile, artifact, and load-bundle contract tests.

use sha2::{Digest, Sha256};
use tinyrustlm_prompt2::{
    parse_load_bundle, write_load_bundle, write_prompt2, Prompt2Artifact, Prompt2LoadBundle,
    Prompt2Policy, Prompt2Runtime, PROMPT2_ARTIFACT_SHA256, PROMPT2_FORMAT_PROFILE_ID,
    PROMPT2_FORMAT_PROFILE_SHA256,
};

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/prompt2-format-profile.v1.json");

#[test]
fn profile_and_writer_close_the_sole_artifact_identity() {
    assert_eq!(PROMPT2_FORMAT_PROFILE_ID, "org.minimodel.prompt2/2.0");
    assert_eq!(
        hex_lower(&Sha256::digest(PROFILE_BYTES)),
        PROMPT2_FORMAT_PROFILE_SHA256
    );
    let mut bytes = Vec::new();
    let identity = write_prompt2(&mut bytes).expect("canonical writer");
    assert_eq!(bytes.len(), 512);
    assert_eq!(identity.byte_length, 512);
    assert_eq!(hex_lower(&identity.sha256), PROMPT2_ARTIFACT_SHA256);
    let parsed = Prompt2Artifact::from_bytes(&bytes, Prompt2Policy::exact_profile_limits())
        .expect("canonical parser");
    assert_eq!(parsed.identity(), identity);
    assert_eq!(parsed.model_vocabulary_size(), 151_936);
    assert_eq!(parsed.maximum_context_tokens(), 40_960);
    assert_eq!(parsed.stop_token_ids(), [151_645, 151_643]);
}

#[test]
fn every_proper_artifact_prefix_and_surplus_byte_rejects() {
    let mut bytes = Vec::new();
    write_prompt2(&mut bytes).expect("canonical writer");
    for length in 0..bytes.len() {
        let error =
            Prompt2Artifact::from_bytes(&bytes[..length], Prompt2Policy::exact_profile_limits())
                .expect_err("proper prefix must reject");
        assert!(matches!(
            error.code(),
            "prompt2-header" | "prompt2-artifact-limit"
        ));
    }
    bytes.push(0);
    assert_eq!(
        Prompt2Artifact::from_bytes(&bytes, Prompt2Policy::exact_profile_limits())
            .expect_err("surplus byte")
            .code(),
        "prompt2-artifact-limit"
    );
}

#[test]
fn load_bundle_geometry_is_exact_and_fake_dependencies_fail_closed() {
    let mut prompt = Vec::new();
    write_prompt2(&mut prompt).expect("prompt writer");
    let tokenizer = vec![0x11; 7_038_773];
    let template = vec![0x22; 1_403];
    let sampling = vec![0x33; 65_800];
    let parts = Prompt2LoadBundle::new(&prompt, &tokenizer, &template, &sampling)
        .expect("length-valid parts");
    let bytes = write_load_bundle(parts).expect("load writer");
    assert_eq!(bytes.len(), 7_106_616);
    let parsed = parse_load_bundle(&bytes, 16_777_216).expect("load parser");
    assert_eq!(parsed.prompt2(), prompt);
    assert_eq!(parsed.tokenizer2(), tokenizer);
    assert_eq!(parsed.template2(), template);
    assert_eq!(parsed.sampling2(), sampling);
    assert_eq!(
        Prompt2Runtime::from_load_bundle(&bytes, 16_777_216)
            .expect_err("fake dependency bytes")
            .code(),
        "prompt2-dependency-identity"
    );
    assert_eq!(
        parse_load_bundle(&bytes, bytes.len() - 1)
            .expect_err("caller ceiling")
            .code(),
        "prompt2-load-bundle"
    );
}

#[test]
fn policies_are_closed_and_never_expand_the_profile() {
    assert_eq!(
        Prompt2Policy::new(0).expect_err("zero policy").code(),
        "prompt2-policy"
    );
    assert_eq!(
        Prompt2Policy::new(513).expect_err("expanded policy").code(),
        "prompt2-policy"
    );
    assert_eq!(
        parse_load_bundle(&[0; 128], 16_777_217)
            .expect_err("expanded load policy")
            .code(),
        "prompt2-policy"
    );
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
