#![forbid(unsafe_code)]
#![doc = "Strict cross-language vNext campaign evidence verification."]

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;
use url::Url;

mod authority;
mod offline_bundle;
mod phase_invalidation;
mod receipt;
mod signature;
mod subject;

pub use authority::{
    verify_authority_graph, AuthorityError, VerifiedAuthorityGraph, AUTHORITY_PROFILE_ID,
    AUTHORITY_PROFILE_SHA256,
};
pub use offline_bundle::{
    verify_offline_bundle, OfflineBundleError, OfflineBundleVerificationInput,
    VerifiedOfflineBundle, OFFLINE_BUNDLE_PROFILE_ID, OFFLINE_BUNDLE_PROFILE_SHA256,
};
pub use phase_invalidation::{
    classify_phase_receipts, FinalizedPhaseInvalidation, PhaseInvalidationError,
    PHASE_INVALIDATION_PROFILE_ID, PHASE_INVALIDATION_PROFILE_SHA256,
    PHASE_INVALIDATION_RESULT_SCHEMA,
};
pub use signature::{
    derive_signature_material, verify_signature_primitive, SignatureError, SignatureMaterial,
    VerifiedSignature, SIGNATURE_PROFILE_ID, SIGNATURE_PROFILE_SHA256,
};

/// The one current campaign-plan schema.
pub const CAMPAIGN_PLAN_SCHEMA: &str = "tinyrustlm.vnext.campaign_plan.v1";
/// The one current campaign-projection profile identity.
pub const CAMPAIGN_PROJECTION_PROFILE_ID: &str = "tinyrustlm.vnext.campaign-projection.v1";
/// The domain used to derive a campaign plan identity from canonical draft bytes.
pub const CAMPAIGN_PLAN_IDENTITY_DOMAIN: &str = "tinyrustlm.campaign-plan.identity.v1";
/// The maximum accepted campaign-plan wire size.
pub const CAMPAIGN_PLAN_MAXIMUM_BYTES: usize = 1_048_576;
/// The exact number of qualifying model slots in one campaign plan.
pub const CAMPAIGN_MODEL_COUNT: usize = 20;
/// The exact number of clean-browser rounds in one campaign plan.
pub const CAMPAIGN_BROWSER_ROUND_COUNT: usize = 50;
/// The exact number of live memory-continuity rounds in one campaign plan.
pub const CAMPAIGN_MEMORY_ROUND_COUNT: usize = 25;
/// The exact number of outside-proof P2P lanes in one campaign plan.
pub const CAMPAIGN_P2P_LANE_COUNT: usize = 40;
/// The exact number of catalog announcements in one campaign plan.
pub const CAMPAIGN_ANNOUNCEMENT_COUNT: usize = 20;
const LANES_PER_MODEL: usize = 2;
const MINIMUM_RESTARTS_PER_MODEL: usize = 2;

/// A bounded campaign-plan validation error with a stable public-safe code.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CampaignPlanError {
    code: &'static str,
}

impl CampaignPlanError {
    /// Returns the stable public-safe failure code.
    pub fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for CampaignPlanError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for CampaignPlanError {}

/// One independently finalized and validated canonical campaign plan.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinalizedCampaignPlan {
    plan_id: String,
    plan_sha256: [u8; 32],
    bytes: Vec<u8>,
}

impl FinalizedCampaignPlan {
    /// Returns the domain-separated plan identity.
    pub fn plan_id(&self) -> &str {
        &self.plan_id
    }

    /// Returns the SHA-256 of the complete final canonical plan wire.
    pub fn plan_sha256(&self) -> [u8; 32] {
        self.plan_sha256
    }

    /// Returns the lowercase SHA-256 of the complete final canonical plan wire.
    pub fn plan_sha256_hex(&self) -> String {
        lowercase_hex(&self.plan_sha256)
    }

    /// Returns the exact owned canonical plan bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Returns an independent owned copy of the canonical plan bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.bytes.clone()
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CampaignPlanDraft {
    announcements: Vec<Announcement>,
    application_origin: String,
    browser_rounds: Vec<BrowserRound>,
    campaign_id: String,
    created_at_utc: String,
    environment: String,
    memory_contract_id: String,
    memory_rounds: Vec<MemoryRound>,
    models: Vec<ModelSlot>,
    p2p_lanes: Vec<P2pLane>,
    profile_id: String,
    schema: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CampaignPlanWire {
    announcements: Vec<Announcement>,
    application_origin: String,
    browser_rounds: Vec<BrowserRound>,
    campaign_id: String,
    created_at_utc: String,
    environment: String,
    memory_contract_id: String,
    memory_rounds: Vec<MemoryRound>,
    models: Vec<ModelSlot>,
    p2p_lanes: Vec<P2pLane>,
    plan_id: String,
    profile_id: String,
    schema: String,
}

impl CampaignPlanWire {
    fn draft(&self) -> CampaignPlanDraft {
        CampaignPlanDraft {
            announcements: self.announcements.clone(),
            application_origin: self.application_origin.clone(),
            browser_rounds: self.browser_rounds.clone(),
            campaign_id: self.campaign_id.clone(),
            created_at_utc: self.created_at_utc.clone(),
            environment: self.environment.clone(),
            memory_contract_id: self.memory_contract_id.clone(),
            memory_rounds: self.memory_rounds.clone(),
            models: self.models.clone(),
            p2p_lanes: self.p2p_lanes.clone(),
            profile_id: self.profile_id.clone(),
            schema: self.schema.clone(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelSlot {
    artifact_id: String,
    artifact_sha256: String,
    model_slot_id: String,
    qualification_operation_id: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserRound {
    memory_continuity_required: bool,
    model_slot_id: String,
    operation_id: String,
    restart_id: String,
    round_id: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemoryRound {
    browser_round_id: String,
    company_id_hash: String,
    memory_round_id: String,
    model_slot_id: String,
    operation_id: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct P2pLane {
    lane_id: String,
    model_slot_id: String,
    process_instance_id: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Announcement {
    announcement_id: String,
    model_slot_id: String,
    operation_id: String,
}

/// Finalizes one bounded exact campaign-plan draft from strict JSON bytes.
pub fn finalize_campaign_plan_json(
    draft_bytes: &[u8],
) -> Result<FinalizedCampaignPlan, CampaignPlanError> {
    require_input_bytes(draft_bytes)?;
    let draft: CampaignPlanDraft =
        serde_json::from_slice(draft_bytes).map_err(|_| failure("campaign_plan_invalid"))?;
    finalize_campaign_plan(draft)
}

/// Validates one final campaign-plan wire and rejects any noncanonical bytes.
pub fn validate_campaign_plan_json(
    plan_bytes: &[u8],
) -> Result<FinalizedCampaignPlan, CampaignPlanError> {
    require_input_bytes(plan_bytes)?;
    let wire: CampaignPlanWire =
        serde_json::from_slice(plan_bytes).map_err(|_| failure("campaign_plan_invalid"))?;
    let expected_plan_id = wire.plan_id.clone();
    let finalized = finalize_campaign_plan(wire.draft())?;
    if expected_plan_id != finalized.plan_id || plan_bytes != finalized.bytes {
        return Err(failure("campaign_plan_identity_mismatch"));
    }
    Ok(finalized)
}

fn finalize_campaign_plan(
    draft: CampaignPlanDraft,
) -> Result<FinalizedCampaignPlan, CampaignPlanError> {
    validate_draft(&draft)?;
    let draft_bytes = canonical_draft_bytes(&draft);
    let mut identity = Sha256::new();
    identity.update(CAMPAIGN_PLAN_IDENTITY_DOMAIN.as_bytes());
    identity.update([0]);
    identity.update(&draft_bytes);
    let plan_id = format!("sha256:{}", lowercase_hex(&identity.finalize()));
    let bytes = canonical_plan_bytes(&draft, &plan_id);
    if bytes.len() > CAMPAIGN_PLAN_MAXIMUM_BYTES {
        return Err(failure("campaign_plan_byte_limit"));
    }
    let plan_sha256: [u8; 32] = Sha256::digest(&bytes).into();
    Ok(FinalizedCampaignPlan {
        plan_id,
        plan_sha256,
        bytes,
    })
}

fn validate_draft(draft: &CampaignPlanDraft) -> Result<(), CampaignPlanError> {
    if draft.schema != CAMPAIGN_PLAN_SCHEMA
        || draft.profile_id != CAMPAIGN_PROJECTION_PROFILE_ID
        || !matches!(
            draft.environment.as_str(),
            "development" | "production" | "staging"
        )
    {
        return Err(failure("campaign_plan_profile_invalid"));
    }
    require_safe_id(&draft.campaign_id, "campaign_plan_value_invalid")?;
    require_content_id(&draft.memory_contract_id, "campaign_plan_value_invalid")?;
    require_utc(&draft.created_at_utc, "campaign_plan_value_invalid")?;
    require_origin(&draft.application_origin)?;

    validate_models(&draft.models)?;
    let model_ids: BTreeSet<&str> = draft
        .models
        .iter()
        .map(|model| model.model_slot_id.as_str())
        .collect();
    validate_browser_rounds(&draft.browser_rounds, &model_ids)?;
    validate_memory_rounds(&draft.memory_rounds, &draft.browser_rounds, &model_ids)?;
    validate_lanes(&draft.p2p_lanes, &model_ids)?;
    validate_announcements(&draft.announcements, &model_ids)?;

    let operation_ids = draft
        .models
        .iter()
        .map(|value| value.qualification_operation_id.as_str())
        .chain(
            draft
                .browser_rounds
                .iter()
                .map(|value| value.operation_id.as_str()),
        )
        .chain(
            draft
                .memory_rounds
                .iter()
                .map(|value| value.operation_id.as_str()),
        )
        .chain(
            draft
                .announcements
                .iter()
                .map(|value| value.operation_id.as_str()),
        );
    require_unique(operation_ids, "campaign_plan_operation_identity_invalid")
}

fn validate_models(models: &[ModelSlot]) -> Result<(), CampaignPlanError> {
    if models.len() != CAMPAIGN_MODEL_COUNT
        || !strictly_sorted(models.iter().map(|value| value.model_slot_id.as_str()))
    {
        return Err(failure("campaign_plan_model_identity_invalid"));
    }
    for model in models {
        require_safe_id(&model.model_slot_id, "campaign_plan_model_identity_invalid")?;
        require_safe_id(
            &model.qualification_operation_id,
            "campaign_plan_model_identity_invalid",
        )?;
        require_digest(
            &model.artifact_sha256,
            "campaign_plan_model_identity_invalid",
        )?;
        require_content_id(&model.artifact_id, "campaign_plan_model_identity_invalid")?;
        if model.artifact_id != format!("sha256:{}", model.artifact_sha256) {
            return Err(failure("campaign_plan_model_identity_invalid"));
        }
    }
    require_unique(
        models.iter().map(|value| value.artifact_id.as_str()),
        "campaign_plan_model_identity_invalid",
    )?;
    require_unique(
        models.iter().map(|value| value.artifact_sha256.as_str()),
        "campaign_plan_model_identity_invalid",
    )?;
    require_unique(
        models
            .iter()
            .map(|value| value.qualification_operation_id.as_str()),
        "campaign_plan_model_identity_invalid",
    )
}

fn validate_browser_rounds(
    rounds: &[BrowserRound],
    model_ids: &BTreeSet<&str>,
) -> Result<(), CampaignPlanError> {
    let code = "campaign_plan_browser_schedule_invalid";
    if rounds.len() != CAMPAIGN_BROWSER_ROUND_COUNT
        || !strictly_sorted(rounds.iter().map(|value| value.round_id.as_str()))
        || rounds
            .iter()
            .filter(|value| value.memory_continuity_required)
            .count()
            != CAMPAIGN_MEMORY_ROUND_COUNT
    {
        return Err(failure(code));
    }
    let mut restarts: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::new();
    for round in rounds {
        for value in [
            &round.model_slot_id,
            &round.operation_id,
            &round.restart_id,
            &round.round_id,
        ] {
            require_safe_id(value, code)?;
        }
        if !model_ids.contains(round.model_slot_id.as_str()) {
            return Err(failure(code));
        }
        restarts
            .entry(round.model_slot_id.as_str())
            .or_default()
            .insert(round.restart_id.as_str());
    }
    require_unique(rounds.iter().map(|value| value.round_id.as_str()), code)?;
    require_unique(rounds.iter().map(|value| value.operation_id.as_str()), code)?;
    require_unique(rounds.iter().map(|value| value.restart_id.as_str()), code)?;
    if model_ids.iter().any(|model_id| {
        restarts.get(model_id).map_or(0, BTreeSet::len) < MINIMUM_RESTARTS_PER_MODEL
    }) {
        return Err(failure(code));
    }
    Ok(())
}

fn validate_memory_rounds(
    rounds: &[MemoryRound],
    browser_rounds: &[BrowserRound],
    model_ids: &BTreeSet<&str>,
) -> Result<(), CampaignPlanError> {
    let code = "campaign_plan_memory_schedule_invalid";
    if rounds.len() != CAMPAIGN_MEMORY_ROUND_COUNT
        || !strictly_sorted(rounds.iter().map(|value| value.memory_round_id.as_str()))
    {
        return Err(failure(code));
    }
    let browser_by_id: BTreeMap<&str, &BrowserRound> = browser_rounds
        .iter()
        .map(|round| (round.round_id.as_str(), round))
        .collect();
    for round in rounds {
        for value in [
            &round.browser_round_id,
            &round.memory_round_id,
            &round.model_slot_id,
            &round.operation_id,
        ] {
            require_safe_id(value, code)?;
        }
        require_digest(&round.company_id_hash, code)?;
        let Some(browser) = browser_by_id.get(round.browser_round_id.as_str()) else {
            return Err(failure(code));
        };
        if !model_ids.contains(round.model_slot_id.as_str())
            || !browser.memory_continuity_required
            || browser.model_slot_id != round.model_slot_id
        {
            return Err(failure(code));
        }
    }
    require_unique(
        rounds.iter().map(|value| value.browser_round_id.as_str()),
        code,
    )?;
    require_unique(
        rounds.iter().map(|value| value.company_id_hash.as_str()),
        code,
    )?;
    require_unique(
        rounds.iter().map(|value| value.memory_round_id.as_str()),
        code,
    )?;
    require_unique(rounds.iter().map(|value| value.operation_id.as_str()), code)?;
    let designated: BTreeSet<&str> = browser_rounds
        .iter()
        .filter(|round| round.memory_continuity_required)
        .map(|round| round.round_id.as_str())
        .collect();
    let bound: BTreeSet<&str> = rounds
        .iter()
        .map(|round| round.browser_round_id.as_str())
        .collect();
    if designated != bound {
        return Err(failure(code));
    }
    Ok(())
}

fn validate_lanes(lanes: &[P2pLane], model_ids: &BTreeSet<&str>) -> Result<(), CampaignPlanError> {
    let code = "campaign_plan_lane_identity_invalid";
    if lanes.len() != CAMPAIGN_P2P_LANE_COUNT
        || !strictly_sorted(lanes.iter().map(|value| value.lane_id.as_str()))
    {
        return Err(failure(code));
    }
    let mut model_counts: BTreeMap<&str, usize> = BTreeMap::new();
    for lane in lanes {
        for value in [
            &lane.lane_id,
            &lane.model_slot_id,
            &lane.process_instance_id,
        ] {
            require_safe_id(value, code)?;
        }
        if !model_ids.contains(lane.model_slot_id.as_str()) {
            return Err(failure(code));
        }
        *model_counts.entry(lane.model_slot_id.as_str()).or_default() += 1;
    }
    require_unique(
        lanes.iter().map(|value| value.process_instance_id.as_str()),
        code,
    )?;
    if model_ids
        .iter()
        .any(|model_id| model_counts.get(model_id).copied() != Some(LANES_PER_MODEL))
    {
        return Err(failure(code));
    }
    Ok(())
}

fn validate_announcements(
    announcements: &[Announcement],
    model_ids: &BTreeSet<&str>,
) -> Result<(), CampaignPlanError> {
    let code = "campaign_plan_announcement_schedule_invalid";
    if announcements.len() != CAMPAIGN_ANNOUNCEMENT_COUNT
        || !strictly_sorted(
            announcements
                .iter()
                .map(|value| value.announcement_id.as_str()),
        )
    {
        return Err(failure(code));
    }
    for announcement in announcements {
        for value in [
            &announcement.announcement_id,
            &announcement.model_slot_id,
            &announcement.operation_id,
        ] {
            require_safe_id(value, code)?;
        }
        if !model_ids.contains(announcement.model_slot_id.as_str()) {
            return Err(failure(code));
        }
    }
    require_unique(
        announcements
            .iter()
            .map(|value| value.announcement_id.as_str()),
        code,
    )?;
    require_unique(
        announcements
            .iter()
            .map(|value| value.model_slot_id.as_str()),
        code,
    )?;
    require_unique(
        announcements
            .iter()
            .map(|value| value.operation_id.as_str()),
        code,
    )
}

fn require_input_bytes(bytes: &[u8]) -> Result<(), CampaignPlanError> {
    if bytes.is_empty() || bytes.len() > CAMPAIGN_PLAN_MAXIMUM_BYTES {
        Err(failure("campaign_plan_byte_limit"))
    } else {
        Ok(())
    }
}

fn require_safe_id(value: &str, code: &'static str) -> Result<(), CampaignPlanError> {
    let bytes = value.as_bytes();
    if !(3..=160).contains(&bytes.len())
        || !matches!(bytes[0], b'a'..=b'z' | b'0'..=b'9')
        || !bytes
            .iter()
            .all(|byte| matches!(byte, b'a'..=b'z' | b'0'..=b'9' | b'.' | b'_' | b':' | b'-'))
    {
        return Err(failure(code));
    }
    Ok(())
}

fn require_digest(value: &str, code: &'static str) -> Result<(), CampaignPlanError> {
    if value.len() != 64
        || !value
            .as_bytes()
            .iter()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
    {
        return Err(failure(code));
    }
    Ok(())
}

fn require_content_id(value: &str, code: &'static str) -> Result<(), CampaignPlanError> {
    match value.strip_prefix("sha256:") {
        Some(digest) => require_digest(digest, code),
        None => Err(failure(code)),
    }
}

fn require_origin(value: &str) -> Result<(), CampaignPlanError> {
    let url = Url::parse(value).map_err(|_| failure("campaign_plan_value_invalid"))?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || url.origin().ascii_serialization() != value
    {
        return Err(failure("campaign_plan_value_invalid"));
    }
    Ok(())
}

fn require_utc(value: &str, code: &'static str) -> Result<(), CampaignPlanError> {
    let bytes = value.as_bytes();
    let base_shape = bytes.len() >= 20
        && bytes.get(4) == Some(&b'-')
        && bytes.get(7) == Some(&b'-')
        && bytes.get(10) == Some(&b'T')
        && bytes.get(13) == Some(&b':')
        && bytes.get(16) == Some(&b':')
        && bytes.last() == Some(&b'Z')
        && [0..4, 5..7, 8..10, 11..13, 14..16, 17..19]
            .into_iter()
            .flatten()
            .all(|index| bytes[index].is_ascii_digit());
    if !base_shape {
        return Err(failure(code));
    }
    if bytes.len() != 20 {
        let fraction_length = bytes.len().saturating_sub(21);
        if bytes.get(19) != Some(&b'.')
            || !(1..=9).contains(&fraction_length)
            || !bytes[20..bytes.len() - 1].iter().all(u8::is_ascii_digit)
        {
            return Err(failure(code));
        }
    }
    let year = parse_decimal(&bytes[0..4]);
    let month = parse_decimal(&bytes[5..7]);
    let day = parse_decimal(&bytes[8..10]);
    let hour = parse_decimal(&bytes[11..13]);
    let minute = parse_decimal(&bytes[14..16]);
    let second = parse_decimal(&bytes[17..19]);
    if year < 100
        || !(1..=12).contains(&month)
        || day == 0
        || day > days_in_month(year, month)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return Err(failure(code));
    }
    Ok(())
}

fn parse_decimal(bytes: &[u8]) -> u32 {
    bytes
        .iter()
        .fold(0u32, |value, byte| value * 10 + u32::from(byte - b'0'))
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        4 | 6 | 9 | 11 => 30,
        2 if year.is_multiple_of(400) || (year.is_multiple_of(4) && !year.is_multiple_of(100)) => {
            29
        }
        2 => 28,
        _ => 31,
    }
}

fn strictly_sorted<'a>(values: impl IntoIterator<Item = &'a str>) -> bool {
    let mut previous: Option<&str> = None;
    for value in values {
        if previous.is_some_and(|prior| value <= prior) {
            return false;
        }
        previous = Some(value);
    }
    true
}

fn require_unique<'a>(
    values: impl IntoIterator<Item = &'a str>,
    code: &'static str,
) -> Result<(), CampaignPlanError> {
    let mut seen = BTreeSet::new();
    if values.into_iter().any(|value| !seen.insert(value)) {
        Err(failure(code))
    } else {
        Ok(())
    }
}

fn canonical_draft_bytes(draft: &CampaignPlanDraft) -> Vec<u8> {
    let mut output = Vec::with_capacity(24 * 1024);
    output.push(b'{');
    write_announcements_field(&mut output, &draft.announcements);
    write_string_field(&mut output, "applicationOrigin", &draft.application_origin);
    write_browser_rounds_field(&mut output, &draft.browser_rounds);
    write_string_field(&mut output, "campaignId", &draft.campaign_id);
    write_string_field(&mut output, "createdAtUtc", &draft.created_at_utc);
    write_string_field(&mut output, "environment", &draft.environment);
    write_string_field(&mut output, "memoryContractId", &draft.memory_contract_id);
    write_memory_rounds_field(&mut output, &draft.memory_rounds);
    write_models_field(&mut output, &draft.models);
    write_p2p_lanes_field(&mut output, &draft.p2p_lanes);
    write_string_field(&mut output, "profileId", &draft.profile_id);
    write_last_string_field(&mut output, "schema", &draft.schema);
    output.push(b'}');
    output
}

fn canonical_plan_bytes(draft: &CampaignPlanDraft, plan_id: &str) -> Vec<u8> {
    let mut output = Vec::with_capacity(24 * 1024);
    output.push(b'{');
    write_announcements_field(&mut output, &draft.announcements);
    write_string_field(&mut output, "applicationOrigin", &draft.application_origin);
    write_browser_rounds_field(&mut output, &draft.browser_rounds);
    write_string_field(&mut output, "campaignId", &draft.campaign_id);
    write_string_field(&mut output, "createdAtUtc", &draft.created_at_utc);
    write_string_field(&mut output, "environment", &draft.environment);
    write_string_field(&mut output, "memoryContractId", &draft.memory_contract_id);
    write_memory_rounds_field(&mut output, &draft.memory_rounds);
    write_models_field(&mut output, &draft.models);
    write_p2p_lanes_field(&mut output, &draft.p2p_lanes);
    write_string_field(&mut output, "planId", plan_id);
    write_string_field(&mut output, "profileId", &draft.profile_id);
    write_last_string_field(&mut output, "schema", &draft.schema);
    output.push(b'}');
    output
}

fn write_string_field(output: &mut Vec<u8>, name: &str, value: &str) {
    write_json_string(output, name);
    output.push(b':');
    write_json_string(output, value);
    output.push(b',');
}

fn write_last_string_field(output: &mut Vec<u8>, name: &str, value: &str) {
    write_json_string(output, name);
    output.push(b':');
    write_json_string(output, value);
}

fn write_announcements_field(output: &mut Vec<u8>, values: &[Announcement]) {
    write_json_string(output, "announcements");
    output.extend_from_slice(b":[");
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            output.push(b',');
        }
        output.push(b'{');
        write_string_field(output, "announcementId", &value.announcement_id);
        write_string_field(output, "modelSlotId", &value.model_slot_id);
        write_last_string_field(output, "operationId", &value.operation_id);
        output.push(b'}');
    }
    output.extend_from_slice(b"],");
}

fn write_browser_rounds_field(output: &mut Vec<u8>, values: &[BrowserRound]) {
    write_json_string(output, "browserRounds");
    output.extend_from_slice(b":[");
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            output.push(b',');
        }
        output.push(b'{');
        write_json_string(output, "memoryContinuityRequired");
        output.push(b':');
        output.extend_from_slice(if value.memory_continuity_required {
            b"true"
        } else {
            b"false"
        });
        output.push(b',');
        write_string_field(output, "modelSlotId", &value.model_slot_id);
        write_string_field(output, "operationId", &value.operation_id);
        write_string_field(output, "restartId", &value.restart_id);
        write_last_string_field(output, "roundId", &value.round_id);
        output.push(b'}');
    }
    output.extend_from_slice(b"],");
}

fn write_memory_rounds_field(output: &mut Vec<u8>, values: &[MemoryRound]) {
    write_json_string(output, "memoryRounds");
    output.extend_from_slice(b":[");
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            output.push(b',');
        }
        output.push(b'{');
        write_string_field(output, "browserRoundId", &value.browser_round_id);
        write_string_field(output, "companyIdHash", &value.company_id_hash);
        write_string_field(output, "memoryRoundId", &value.memory_round_id);
        write_string_field(output, "modelSlotId", &value.model_slot_id);
        write_last_string_field(output, "operationId", &value.operation_id);
        output.push(b'}');
    }
    output.extend_from_slice(b"],");
}

fn write_models_field(output: &mut Vec<u8>, values: &[ModelSlot]) {
    write_json_string(output, "models");
    output.extend_from_slice(b":[");
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            output.push(b',');
        }
        output.push(b'{');
        write_string_field(output, "artifactId", &value.artifact_id);
        write_string_field(output, "artifactSha256", &value.artifact_sha256);
        write_string_field(output, "modelSlotId", &value.model_slot_id);
        write_last_string_field(
            output,
            "qualificationOperationId",
            &value.qualification_operation_id,
        );
        output.push(b'}');
    }
    output.extend_from_slice(b"],");
}

fn write_p2p_lanes_field(output: &mut Vec<u8>, values: &[P2pLane]) {
    write_json_string(output, "p2pLanes");
    output.extend_from_slice(b":[");
    for (index, value) in values.iter().enumerate() {
        if index != 0 {
            output.push(b',');
        }
        output.push(b'{');
        write_string_field(output, "laneId", &value.lane_id);
        write_string_field(output, "modelSlotId", &value.model_slot_id);
        write_last_string_field(output, "processInstanceId", &value.process_instance_id);
        output.push(b'}');
    }
    output.extend_from_slice(b"],");
}

fn write_json_string(output: &mut Vec<u8>, value: &str) {
    serde_json::to_writer(output, value).expect("writing a string to Vec cannot fail");
}

fn lowercase_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[usize::from(byte >> 4)]));
        output.push(char::from(HEX[usize::from(byte & 0x0f)]));
    }
    output
}

const fn failure(code: &'static str) -> CampaignPlanError {
    CampaignPlanError { code }
}
