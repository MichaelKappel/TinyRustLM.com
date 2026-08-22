//! Focused Sampling2 format, configuration, and terminal-state contract tests.

use sha2::{Digest, Sha256};
use tinyrustlm_sampling2::{
    fixed_score_from_bits, write_sampling2, GenerationController, GenerationStatus, Sampling2,
    Sampling2Config, Sampling2Policy, Sampling2State, SAMPLING2_ARTIFACT_SHA256,
    SAMPLING2_FORMAT_PROFILE_ID, SAMPLING2_FORMAT_PROFILE_SHA256, SAMPLING2_WEIGHT_TABLE_SHA256,
};

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/sampling2-format-profile.v1.json");
const TABLE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/sampling2-exp-q48-table.v1.bin");

fn artifact() -> Vec<u8> {
    let mut bytes = Vec::new();
    write_sampling2(&mut bytes).unwrap();
    bytes
}

fn sampling() -> Sampling2 {
    Sampling2::from_bytes(artifact(), Sampling2Policy::exact_profile_limits()).unwrap()
}

fn greedy(maximum_new_tokens: u32) -> Sampling2Config {
    Sampling2Config::new(0, 1, 1_000_000, 1_100_000, 64, maximum_new_tokens).unwrap()
}

#[test]
fn source_control_identities_are_exact() {
    assert_eq!(SAMPLING2_FORMAT_PROFILE_ID, "org.minimodel.sampling2/2.0");
    assert_eq!(
        hex_lower(&Sha256::digest(PROFILE_BYTES)),
        SAMPLING2_FORMAT_PROFILE_SHA256
    );
    assert_eq!(
        hex_lower(&Sha256::digest(TABLE_BYTES)),
        SAMPLING2_WEIGHT_TABLE_SHA256
    );
    let bytes = artifact();
    assert_eq!(bytes.len(), 65_800);
    assert_eq!(
        hex_lower(&Sha256::digest(&bytes)),
        SAMPLING2_ARTIFACT_SHA256
    );
    assert_eq!(sampling().profile_id(), SAMPLING2_FORMAT_PROFILE_ID);
}

#[test]
fn a_lower_valid_policy_rejects_the_fixed_artifact_without_changing_its_identity() {
    let lower = Sampling2Policy::new(65_799, 151_936, 1_024, 64, 16, 4_096, 40_960).unwrap();
    assert_eq!(
        Sampling2::from_bytes(artifact(), lower).unwrap_err().code(),
        "sampling2-artifact-limit"
    );
}

#[test]
fn explicit_configuration_rejects_invalid_or_implicit_combinations() {
    assert_eq!(
        Sampling2Config::new(0, 2, 1_000_000, 1_000_000, 0, 1)
            .unwrap_err()
            .code(),
        "sampling2-config"
    );
    assert_eq!(
        Sampling2Config::new(0, 1, 999_999, 1_000_000, 0, 1)
            .unwrap_err()
            .code(),
        "sampling2-config"
    );
    assert_eq!(
        Sampling2Config::new(4_000_001, 1, 1_000_000, 1_000_000, 0, 1)
            .unwrap_err()
            .code(),
        "sampling2-config"
    );
    assert_eq!(
        Sampling2Config::new(1, 1, 1_000_000, 999_999, 0, 1)
            .unwrap_err()
            .code(),
        "sampling2-config"
    );
}

#[test]
fn nonfinite_and_range_rules_fail_closed() {
    assert_eq!(
        fixed_score_from_bits(f32::NAN.to_bits())
            .unwrap_err()
            .code(),
        "sampling2-logit-nan"
    );
    assert_eq!(
        fixed_score_from_bits(f32::INFINITY.to_bits())
            .unwrap_err()
            .code(),
        "sampling2-logit-positive-infinity"
    );
    assert_eq!(
        fixed_score_from_bits(f32::NEG_INFINITY.to_bits()).unwrap(),
        None
    );
    assert_eq!(
        fixed_score_from_bits(32_769_f32.to_bits())
            .unwrap_err()
            .code(),
        "sampling2-logit-range"
    );
}

#[test]
fn greedy_ties_use_lowest_token_and_consume_no_state() {
    let sampling = sampling();
    let initial = Sampling2State::from_seed(42);
    let result = sampling
        .sample_f32(&[1.0, 1.0, 0.0], &[], greedy(8), initial)
        .unwrap();
    assert_eq!(result.token_id, 0);
    assert_eq!(result.state, initial);
}

#[test]
fn failed_sampling_returns_no_mutated_state() {
    let sampling = sampling();
    let initial = Sampling2State::from_seed(42);
    let error = sampling
        .sample_f32(&[f32::NAN], &[], greedy(8), initial)
        .unwrap_err();
    assert_eq!(error.code(), "sampling2-logit-nan");
    assert_eq!(initial.draw_count(), 0);
}

#[test]
fn stop_tokens_are_terminal_metadata_and_never_generated_content() {
    let sampling = sampling();
    let mut controller = GenerationController::new(
        &sampling,
        greedy(8),
        4,
        3,
        &[2],
        Sampling2State::from_seed(1),
    )
    .unwrap();
    let result = controller
        .step_bits(
            &sampling,
            &[0_f32.to_bits(), 1_f32.to_bits(), 2_f32.to_bits()],
            false,
        )
        .unwrap();
    assert_eq!(result.selected_token_id, Some(2));
    assert_eq!(result.status, GenerationStatus::StopToken(2));
    assert!(controller.generated_token_ids().is_empty());
    assert_eq!(
        controller
            .step_bits(&sampling, &[], true)
            .unwrap_err()
            .code(),
        "sampling2-generation-terminal"
    );
}

#[test]
fn cancellation_precedes_logit_validation_and_random_draws() {
    let sampling = sampling();
    let initial = Sampling2State::from_seed(9);
    let mut controller = GenerationController::new(
        &sampling,
        Sampling2Config::new(600_000, 1, 950_000, 1_100_000, 0, 8).unwrap(),
        1,
        3,
        &[2],
        initial,
    )
    .unwrap();
    let result = controller.step_bits(&sampling, &[], true).unwrap();
    assert_eq!(result.selected_token_id, None);
    assert_eq!(result.status, GenerationStatus::Cancelled);
    assert_eq!(controller.sampling_state(), initial);
}

#[test]
fn generation_rejects_a_prompt_above_the_policy_context_limit_as_config() {
    let sampling = sampling();
    assert_eq!(
        GenerationController::new(
            &sampling,
            greedy(8),
            40_961,
            3,
            &[2],
            Sampling2State::from_seed(1),
        )
        .unwrap_err()
        .code(),
        "sampling2-config"
    );
}

#[test]
fn all_zero_serialized_state_is_rejected() {
    assert_eq!(
        Sampling2State::from_bytes([0_u8; 40]).unwrap_err().code(),
        "sampling2-prng-state"
    );
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
