//! Cross-language campaign-plan contract tests.

use serde_json::Value;
use tinyrustlm_evidence::{
    finalize_campaign_plan_json, validate_campaign_plan_json, CAMPAIGN_ANNOUNCEMENT_COUNT,
    CAMPAIGN_BROWSER_ROUND_COUNT, CAMPAIGN_MEMORY_ROUND_COUNT, CAMPAIGN_MODEL_COUNT,
    CAMPAIGN_P2P_LANE_COUNT, CAMPAIGN_PLAN_IDENTITY_DOMAIN, CAMPAIGN_PLAN_MAXIMUM_BYTES,
    CAMPAIGN_PLAN_SCHEMA, CAMPAIGN_PROJECTION_PROFILE_ID,
};

const DRAFT: &[u8] =
    include_bytes!("../../../../contracts/vnext/campaign-plan-draft-parity-fixture.v1.json");
const PLAN: &[u8] =
    include_bytes!("../../../../contracts/vnext/campaign-plan-parity-fixture.v1.json");

#[test]
fn rust_finalization_matches_the_frozen_node_plan() {
    let finalized = finalize_campaign_plan_json(DRAFT).expect("draft must finalize");
    assert_eq!(finalized.bytes(), PLAN);
    assert_eq!(finalized.to_bytes(), PLAN);
    assert_eq!(
        finalized.plan_id(),
        "sha256:0207e508652790aa158bdb0c13c10c2aefe401e9cfc48b98bc9dc05dcdb63a7e"
    );
    assert_eq!(
        finalized.plan_sha256_hex(),
        "89c487682ff69f7982d7cb24eda9fcff10702164c8ccb3608e748cf145339b19"
    );
}

#[test]
fn rust_validation_accepts_only_the_exact_final_wire() {
    let validated = validate_campaign_plan_json(PLAN).expect("plan must validate");
    assert_eq!(validated.bytes(), PLAN);

    let mut trailing = PLAN.to_vec();
    trailing.push(b'\n');
    assert_eq!(
        validate_campaign_plan_json(&trailing)
            .expect_err("trailing bytes must reject")
            .code(),
        "campaign_plan_identity_mismatch"
    );
}

#[test]
fn rust_constants_match_the_frozen_projection_profile() {
    let profile_path = format!(
        "{}/../../../contracts/vnext/campaign-projection-profile.v1.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let profile: Value = serde_json::from_slice(
        &std::fs::read(profile_path).expect("projection profile must be readable"),
    )
    .expect("projection profile must be JSON");
    assert_eq!(profile["planSchema"], CAMPAIGN_PLAN_SCHEMA);
    assert_eq!(profile["profileId"], CAMPAIGN_PROJECTION_PROFILE_ID);
    assert_eq!(profile["planIdentityDomain"], CAMPAIGN_PLAN_IDENTITY_DOMAIN);
    assert_eq!(
        profile["limits"]["maximumPlanBytes"],
        CAMPAIGN_PLAN_MAXIMUM_BYTES
    );
    assert_eq!(
        profile["objectiveTargets"]["qualifiedModels"],
        CAMPAIGN_MODEL_COUNT
    );
    assert_eq!(
        profile["objectiveTargets"]["cleanBrowserRounds"],
        CAMPAIGN_BROWSER_ROUND_COUNT
    );
    assert_eq!(
        profile["objectiveTargets"]["liveMemoryRounds"],
        CAMPAIGN_MEMORY_ROUND_COUNT
    );
    assert_eq!(
        profile["objectiveTargets"]["outsideProvenLanes"],
        CAMPAIGN_P2P_LANE_COUNT
    );
    assert_eq!(
        profile["objectiveTargets"]["announcedModels"],
        CAMPAIGN_ANNOUNCEMENT_COUNT
    );
}

#[test]
fn rust_rejects_profile_value_and_json_shape_drift() {
    assert_error(
        mutate_draft(|draft| draft["profileId"] = Value::String("wrong-profile".into())),
        "campaign_plan_profile_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            draft["applicationOrigin"] = Value::String("https://tinyrustlm.com/".into());
        }),
        "campaign_plan_value_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            draft["createdAtUtc"] = Value::String("2026-02-29T00:00:00Z".into());
        }),
        "campaign_plan_value_invalid",
    );
    let duplicate = String::from_utf8(DRAFT.to_vec())
        .expect("draft is UTF-8")
        .replacen(
            "{\"announcements\"",
            "{\"schema\":\"tinyrustlm.vnext.campaign_plan.v1\",\"announcements\"",
            1,
        );
    assert_error(duplicate.into_bytes(), "campaign_plan_invalid");
    assert_error(
        mutate_draft(|draft| draft["unknown"] = Value::Bool(true)),
        "campaign_plan_invalid",
    );
}

#[test]
fn rust_rejects_model_and_global_operation_identity_drift() {
    assert_error(
        mutate_draft(|draft| {
            draft["models"].as_array_mut().expect("models").pop();
        }),
        "campaign_plan_model_identity_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            let models = draft["models"].as_array_mut().expect("models");
            models[1]["artifactId"] = models[0]["artifactId"].clone();
            models[1]["artifactSha256"] = models[0]["artifactSha256"].clone();
        }),
        "campaign_plan_model_identity_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            let operation = draft["models"][0]["qualificationOperationId"].clone();
            draft["browserRounds"][0]["operationId"] = operation;
        }),
        "campaign_plan_operation_identity_invalid",
    );
}

#[test]
fn rust_rejects_browser_memory_lane_and_announcement_drift() {
    assert_error(
        mutate_draft(|draft| {
            for round in draft["browserRounds"].as_array_mut().expect("rounds") {
                if round["modelSlotId"] == "model-01" {
                    round["restartId"] = Value::String("restart-one".into());
                }
            }
        }),
        "campaign_plan_browser_schedule_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            draft["memoryRounds"][0]["browserRoundId"] = Value::String("round-26".into());
        }),
        "campaign_plan_memory_schedule_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            let process = draft["p2pLanes"][0]["processInstanceId"].clone();
            draft["p2pLanes"][1]["processInstanceId"] = process;
        }),
        "campaign_plan_lane_identity_invalid",
    );
    assert_error(
        mutate_draft(|draft| {
            let model = draft["announcements"][0]["modelSlotId"].clone();
            draft["announcements"][1]["modelSlotId"] = model;
        }),
        "campaign_plan_announcement_schedule_invalid",
    );
}

#[test]
fn rust_final_plan_rejects_identity_and_wire_drift() {
    let mut plan: Value = serde_json::from_slice(PLAN).expect("plan JSON");
    plan["planId"] = Value::String(format!("sha256:{}", "0".repeat(64)));
    let changed = serde_json::to_vec(&plan).expect("plan bytes");
    assert_eq!(
        validate_campaign_plan_json(&changed)
            .expect_err("changed identity must reject")
            .code(),
        "campaign_plan_identity_mismatch"
    );

    let pretty =
        serde_json::to_vec_pretty(&serde_json::from_slice::<Value>(PLAN).expect("plan JSON"))
            .expect("pretty plan");
    assert_eq!(
        validate_campaign_plan_json(&pretty)
            .expect_err("noncanonical wire must reject")
            .code(),
        "campaign_plan_identity_mismatch"
    );
}

fn mutate_draft(mutate: impl FnOnce(&mut Value)) -> Vec<u8> {
    let mut value: Value = serde_json::from_slice(DRAFT).expect("draft JSON");
    mutate(&mut value);
    serde_json::to_vec(&value).expect("mutated draft")
}

fn assert_error(bytes: Vec<u8>, code: &str) {
    assert_eq!(
        finalize_campaign_plan_json(&bytes)
            .expect_err("invalid campaign plan must reject")
            .code(),
        code
    );
}
