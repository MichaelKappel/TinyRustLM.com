#![forbid(unsafe_code)]
#![doc = "Public UAIX `.uai` memory and persona package validation boundary."]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Component, Path};
use zip::ZipArchive;

/// Stable plan schema kind returned by the memory harness.
pub const MEMORY_PACKAGE_PLAN_KIND: &str = "uaix.memory.package_plan.v0";
/// Stable package inspection schema kind returned by the memory harness.
pub const MEMORY_PACKAGE_INSPECTION_KIND: &str = "uaix.memory.package_inspection.v0";
/// Stable manifest inspection schema kind returned by the memory harness.
pub const MEMORY_MANIFEST_INSPECTION_KIND: &str = "uaix.memory.manifest_inspection.v0";
/// Stable setup catalog schema kind returned by the memory harness.
pub const MEMORY_SETUP_CATALOG_KIND: &str = "uaix.memory.setup_catalog.v0";
/// UAIX AI Memory Package Wizard authority URL.
pub const UAIX_MEMORY_WIZARD_URL: &str = "https://uaix.org/en-us/tools/ai-memory-package-wizard/";
/// UAIX advanced persona package authority URL.
pub const UAIX_PERSONA_PACK_URL: &str =
    "https://uaix.org/en-us/ai-memory/uai-files/persona-uai/personality-packs/";
/// UAIX agent communication operating model authority URL.
pub const UAIX_AGENT_COMMUNICATION_URL: &str =
    "https://uaix.org/en-us/ai-memory/agent-communication/";
/// UAIX Talisman System authority URL.
pub const UAIX_TALISMAN_SYSTEM_URL: &str = "https://uaix.org/en-us/ai-memory/talisman-system/";

const MAX_MEMORY_PACKAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_MEMORY_FILE_BYTES: u64 = 1024 * 1024;
const MAX_MEMORY_MANIFEST_BYTES: usize = 512 * 1024;
const MAX_MEMORY_FILE_COUNT: usize = 4096;

/// Public setup paths recognized by the UAIX memory harness.
#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UaixMemorySetup {
    /// Compact active-memory starter package.
    #[default]
    Base,
    /// Package includes Agent File Handoff intake/disposition records.
    AgentFileHandoff,
    /// Package includes a long-memory pointer ledger for LLM Wiki style durability.
    LlmWiki,
    /// Package includes both file intake and long-memory pointer-ledger records.
    FileHandoffLlmWiki,
    /// Package includes reviewed multi-agent communication and handoff records.
    MultiAgentCommunication,
    /// Package includes advanced Talisman anchor-governance review records.
    TalismanSystem,
    /// Package preserves an advanced persona/personality source profile.
    AdvancedPersonaProfile,
}

/// Advanced persona dimension switches used by the public memory harness.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AdvancedPersonaOptions {
    /// Include all documented persona dimension files unless a field is explicitly disabled.
    #[serde(default = "default_true")]
    pub include_all_persona_dimensions: bool,
    /// Include the content-triggered winter style axis.
    #[serde(default)]
    pub include_winter_style: bool,
    /// Include the content-triggered spring/fall style axis.
    #[serde(default)]
    pub include_spring_fall_style: bool,
    /// Include the content-triggered elevated fashion/style axis.
    #[serde(default)]
    pub include_super_fashion_style: bool,
    /// Include the content-triggered jewelry choices axis.
    #[serde(default)]
    pub include_jewelry_choices: bool,
    /// Reviewed religion/worldview depth from 0 to 10.
    #[serde(default)]
    pub religion_worldview_depth: u8,
    /// Reviewed political leaning depth from 0 to 10.
    #[serde(default)]
    pub political_leaning_depth: u8,
    /// Reviewed style depth from 0 to 10.
    #[serde(default)]
    pub sense_of_style_depth: u8,
    /// Reviewed physical appearance depth from 0 to 10.
    #[serde(default)]
    pub physical_appearance_depth: u8,
    /// Reviewed birth/age/generation depth from 0 to 10.
    #[serde(default)]
    pub birth_age_generation_depth: u8,
    /// Reviewed romantic orientation depth from 0 to 10.
    #[serde(default)]
    pub romantic_orientation_depth: u8,
}

impl Default for AdvancedPersonaOptions {
    fn default() -> Self {
        Self {
            include_all_persona_dimensions: true,
            include_winter_style: false,
            include_spring_fall_style: false,
            include_super_fashion_style: false,
            include_jewelry_choices: false,
            religion_worldview_depth: 0,
            political_leaning_depth: 0,
            sense_of_style_depth: 0,
            physical_appearance_depth: 0,
            birth_age_generation_depth: 0,
            romantic_orientation_depth: 0,
        }
    }
}

/// Public request that selects a UAIX memory package policy.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct UaixMemoryPackageRequest {
    /// Selected setup path.
    #[serde(default)]
    pub setup: UaixMemorySetup,
    /// Require project/developer code-bearing continuation records.
    #[serde(default)]
    pub code_like_artifacts: bool,
    /// Require local tool/connector permission records.
    #[serde(default)]
    pub tool_permissions: bool,
    /// Require delegated authority and credential-inventory routing records.
    #[serde(default)]
    pub delegated_operations: bool,
    /// Require deployment/audit proof records.
    #[serde(default)]
    pub deployment: bool,
    /// Require contact or stakeholder memory records.
    #[serde(default)]
    pub contact_memory: bool,
    /// Require calendar/deadline continuity records.
    #[serde(default)]
    pub calendar_scheduling: bool,
    /// Require tone, language, and audience continuity records.
    #[serde(default)]
    pub communication_style: bool,
    /// Require task and commitment state records.
    #[serde(default)]
    pub tasks_commitments: bool,
    /// Require routine and preference continuity records.
    #[serde(default)]
    pub routines_preferences: bool,
    /// Require safety/support boundary records.
    #[serde(default)]
    pub safety_support_boundaries: bool,
    /// Require source-note and archive provenance records.
    #[serde(default)]
    pub source_notes: bool,
    /// Require public-facing reply/publication boundary records.
    #[serde(default)]
    pub public_facing_boundaries: bool,
    /// Advanced persona dimension options.
    #[serde(default)]
    pub advanced_persona: AdvancedPersonaOptions,
}

/// Required file record with closed UAIX file-state policy.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryRequiredFile {
    /// Package-relative normalized path.
    pub path: String,
    /// UAIX closed file state.
    pub state: String,
    /// Record role used by validators and receivers.
    pub role: String,
    /// Public source rule behind the file requirement.
    pub source: String,
}

/// Public boundary statement for the memory harness package.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryBoundary {
    /// The package does not perform hosted import validation.
    pub hosted_import_validation: bool,
    /// The package does not write automatically to a repository or site.
    pub automatic_repository_writes: bool,
    /// The package does not automatically synchronize an LLM Wiki.
    pub automatic_llm_wiki_sync: bool,
    /// The package does not perform persona-fidelity certification.
    pub persona_fidelity_certification: bool,
    /// Persona source mutation is not allowed by the public harness.
    pub persona_source_mutation_allowed: bool,
    /// Consumers are expected to pair memory records with the TinyRustLM runtime harness.
    pub uses_tinyrustlm_runtime_harness: bool,
}

/// Machine-checkable summary of the UAIX file deck selected by a package plan.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryFileDeckSummary {
    /// Total required file count in the selected closed file set.
    pub total_required_files: u32,
    /// Files required by every supported UAIX memory package.
    pub universal_required_files: u32,
    /// Files required by the selected setup/profile family.
    pub profile_required_files: u32,
    /// Files required by the selected configuration.
    pub configuration_specific_required_files: u32,
    /// Files required only when package facts trigger them.
    pub content_triggered_required_files: u32,
    /// Files required by the advanced persona profile configuration.
    pub advanced_persona_required_files: u32,
    /// Required evidence files, including persona source evidence.
    pub evidence_files: u32,
    /// Required `.uai/exports/` files.
    pub export_files: u32,
    /// Required `.uai/personality/` dimension files.
    pub persona_dimension_files: u32,
    /// Content-triggered persona style-axis files.
    pub triggered_persona_style_axis_files: u32,
    /// The selected deck includes `.uai/exports/manifest.json`.
    pub includes_manifest_json: bool,
    /// The selected deck includes `.uai/exports/manifest-overlay.json`.
    pub includes_manifest_overlay: bool,
    /// The selected deck includes `.uai/exports/package-model.json`.
    pub includes_package_model: bool,
    /// The selected deck includes `.uai/exports/knowledge-graph.json`.
    pub includes_knowledge_graph: bool,
    /// The selected deck includes both `llms.uai` and `llms-full.uai`.
    pub includes_llms_exports: bool,
    /// The selected deck includes `.uai/agent-pickup.uai`.
    pub includes_agent_pickup: bool,
    /// The selected deck includes `.uai/archives/session-log.uai`.
    pub includes_session_log: bool,
    /// The selected deck binds persona source, preservation, and provenance evidence.
    pub includes_persona_source_evidence: bool,
    /// The harness expects the manifest to declare the full effective file set.
    pub closed_required_file_set: bool,
}

/// Public descriptor for one supported UAIX memory setup path.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemorySetupDescriptor {
    /// Stable setup identifier accepted by `UaixMemoryPackageRequest`.
    pub setup: UaixMemorySetup,
    /// Human-readable label for UI and package metadata.
    pub label: String,
    /// Short public summary of the setup boundary.
    pub summary: String,
    /// Canonical setup or guidance URL.
    pub setup_url: String,
    /// Public authority URLs used for this setup.
    pub authority_urls: Vec<String>,
    /// Public package-planning features included by this setup.
    pub package_features: Vec<String>,
    /// Private or hosted capabilities intentionally excluded.
    pub excluded_private_capabilities: Vec<String>,
}

/// Discoverable catalog of supported UAIX memory setup paths.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemorySetupCatalog {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Supported setup descriptors.
    pub setups: Vec<UaixMemorySetupDescriptor>,
    /// Supported setup count.
    pub setup_count: u32,
    /// Public authority URLs used by this catalog.
    pub source_urls: Vec<String>,
    /// Public harness boundary flags.
    pub boundary: UaixMemoryBoundary,
}

/// Required-file plan returned for a UAIX memory setup request.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryPackagePlan {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Selected setup path.
    pub setup: UaixMemorySetup,
    /// Required package-relative file records.
    pub required_files: Vec<UaixMemoryRequiredFile>,
    /// Machine-checkable summary of the selected UAIX file deck.
    pub file_deck: UaixMemoryFileDeckSummary,
    /// Required file count.
    pub required_file_count: u32,
    /// Public authority URLs used by this plan.
    pub source_urls: Vec<String>,
    /// Public harness boundary flags.
    pub boundary: UaixMemoryBoundary,
}

/// Status for a package-relative memory file.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryFileStatus {
    /// Package-relative normalized path.
    pub path: String,
    /// UAIX closed file state.
    pub state: String,
    /// Record role used by validators and receivers.
    pub role: String,
    /// Whether the file exists in the inspected package.
    pub exists: bool,
    /// File byte count when present.
    pub byte_count: u64,
    /// File SHA-256 when present.
    pub sha256: Option<String>,
}

/// Inspection status for one UAIX advanced persona dimension file.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixPersonaDimensionInspection {
    /// Stable human-readable dimension name.
    pub dimension: String,
    /// Package-relative normalized path.
    pub path: String,
    /// Whether the file exists in the inspected package.
    pub exists: bool,
    /// File byte count when present.
    pub byte_count: u64,
    /// File SHA-256 when present.
    pub sha256: Option<String>,
    /// Whether the file declares a depth-level field.
    pub declares_depth_level: bool,
    /// Parsed reviewed depth value from 0 to 10 when present.
    pub depth_level_0_to_10: Option<u8>,
    /// Whether the file declares a disclosure boundary.
    pub declares_disclosure_boundary: bool,
    /// Whether the file declares source confidence.
    pub declares_source_confidence: bool,
    /// Whether the file declares explicit non-inference rules.
    pub declares_non_inference_rules: bool,
    /// Whether this dimension file satisfies the public inspection rule.
    pub valid: bool,
    /// Non-fatal compatibility or evidence warnings.
    pub warnings: Vec<String>,
}

/// Inspection report for a directory, `.zip`, or `.uaix` UAIX memory package.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryPackageInspection {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// Inspected package path.
    pub package_path: String,
    /// Source type: `directory` or `archive`.
    pub package_source: String,
    /// Selected setup path.
    pub setup: UaixMemorySetup,
    /// Required-file statuses.
    pub required_files: Vec<UaixMemoryFileStatus>,
    /// Machine-checkable summary of the selected UAIX file deck.
    pub file_deck: UaixMemoryFileDeckSummary,
    /// Advanced persona dimension inspections when `advanced_persona_profile` is selected.
    pub persona_dimensions: Vec<UaixPersonaDimensionInspection>,
    /// Whether every required persona dimension declares review evidence markers.
    pub persona_dimensions_valid: bool,
    /// Count of persona dimension warnings.
    pub persona_dimension_warning_count: u32,
    /// Missing required package-relative paths.
    pub missing_required_files: Vec<String>,
    /// Required paths that were present on disk/in archive but absent from the manifest overlay.
    pub manifest_missing_required_files: Vec<String>,
    /// Whether the manifest overlay declares the full effective required-file set.
    pub manifest_declares_required_files: bool,
    /// Number of files visible in the inspected package.
    pub package_file_count: u32,
    /// Whether every required file is present and non-empty.
    pub valid: bool,
    /// Optional manifest inspection when a manifest file is present.
    pub manifest: Option<UaixMemoryManifestInspection>,
    /// Public harness boundary flags.
    pub boundary: UaixMemoryBoundary,
}

/// Inspection report for a UAIX memory manifest JSON document.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct UaixMemoryManifestInspection {
    /// Stable schema kind.
    pub kind: String,
    /// Stable schema version.
    pub version: u32,
    /// SHA-256 of the exact manifest text.
    pub manifest_sha256: String,
    /// Manifest-declared kind when discoverable.
    pub declared_kind: Option<String>,
    /// Manifest-declared setup or profile when discoverable.
    pub declared_setup: Option<String>,
    /// Whether the manifest declares or references advanced persona mode.
    pub advanced_persona_profile: bool,
    /// Count of manifest-declared file-like entries when discoverable.
    pub declared_file_count: u32,
    /// Normalized package-relative paths declared by the manifest.
    pub declared_file_paths: Vec<String>,
    /// Whether the JSON manifest was syntactically valid and object-shaped.
    pub valid: bool,
    /// Non-fatal compatibility warnings.
    pub warnings: Vec<String>,
}

/// Error returned by the public UAIX memory package SDK.
#[derive(Debug)]
pub enum UaixMemoryError {
    /// File-system access failed.
    Io(String),
    /// JSON parsing or request validation failed.
    InvalidJson(String),
    /// Package path, archive entry, or request value is unsupported.
    InvalidPackage(String),
    /// A configured safety limit was exceeded.
    LimitExceeded(String),
}

impl Display for UaixMemoryError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(message) => write!(formatter, "I/O error: {message}"),
            Self::InvalidJson(message) => write!(formatter, "invalid JSON: {message}"),
            Self::InvalidPackage(message) => write!(formatter, "invalid memory package: {message}"),
            Self::LimitExceeded(message) => {
                write!(formatter, "memory package limit exceeded: {message}")
            }
        }
    }
}

impl std::error::Error for UaixMemoryError {}

/// Returns a stable, public catalog of setup paths supported by the memory harness.
pub fn supported_memory_setups() -> UaixMemorySetupCatalog {
    let setups = vec![
        setup_descriptor(
            UaixMemorySetup::Base,
            "Base UAI package",
            "Compact active .uai startup memory with system profile, receiver brief, manifest overlay, exports, and launch-baseline anchors.",
            UAIX_MEMORY_WIZARD_URL,
            &[UAIX_MEMORY_WIZARD_URL],
            &[
                "ai_digest_script_data_ai_digest",
                "point_agent_urls",
                "local_browser_draft_restore",
                "prompt_nudges",
                "safe_structured_output_mode",
                "review_export_checks",
                "startup_packet",
                "system_profile",
                "receiver_brief",
                "agent_use_blocks_codex_claude_gpt",
                "raw_session_log",
                "family_aware_required_files",
                "dtmi_policy",
                "manifest_json",
                "manifest_overlay",
                "browser_generated_zip_package",
                "canonical_starter_zip_downloads",
                "package_model_json",
                "knowledge_graph_json",
                "llms_exports",
                "hot_uai_memory",
            ],
        ),
        setup_descriptor(
            UaixMemorySetup::AgentFileHandoff,
            "Agent File Handoff",
            "Adds active file intake, disposition guidance, proof-of-use ledger records, and intake completion evidence.",
            &format!("{UAIX_MEMORY_WIZARD_URL}#setup-file-handoff"),
            &[UAIX_MEMORY_WIZARD_URL],
            &[
                "file_handoff",
                "intake_completion_gate",
                "proof_of_use_ledger",
                "active_bucket_review",
            ],
        ),
        setup_descriptor(
            UaixMemorySetup::LlmWiki,
            "LLM Wiki",
            "Adds a long-term semantic pointer ledger while keeping .uai as active startup continuity memory.",
            &format!("{UAIX_MEMORY_WIZARD_URL}#setup-llm-wiki"),
            &[UAIX_MEMORY_WIZARD_URL],
            &[
                "long_term_pointer_ledger",
                "durable_memory_references",
                "hot_uai_startup_layer",
            ],
        ),
        setup_descriptor(
            UaixMemorySetup::FileHandoffLlmWiki,
            "File Handoff plus LLM Wiki",
            "Combines active file intake proof with durable pointer-ledger preservation without retiring hot .uai startup memory.",
            &format!("{UAIX_MEMORY_WIZARD_URL}#setup-file-handoff-llm-wiki"),
            &[UAIX_MEMORY_WIZARD_URL],
            &[
                "file_handoff",
                "intake_completion_gate",
                "proof_of_use_ledger",
                "long_term_pointer_ledger",
                "setup_quality_gate",
            ],
        ),
        setup_descriptor(
            UaixMemorySetup::MultiAgentCommunication,
            "Multi-Agent Communication",
            "Plans reviewed multi-agent communication, owners, shared state, next actions, open questions, and risk records while UAIX remains the memory boundary.",
            UAIX_MEMORY_WIZARD_URL,
            &[UAIX_MEMORY_WIZARD_URL, UAIX_AGENT_COMMUNICATION_URL],
            &[
                "agent_instructions",
                "review_owner_records",
                "shared_state",
                "handoff_next_actions",
                "open_questions",
                "coordination_risks",
            ],
        ),
        setup_descriptor(
            UaixMemorySetup::TalismanSystem,
            "Talisman System",
            "Plans Totem, Taboo, and Talisman anchor-governance review records, no-op/talk-back guidance, audit evidence, and rollback notes.",
            UAIX_TALISMAN_SYSTEM_URL,
            &[UAIX_MEMORY_WIZARD_URL, UAIX_TALISMAN_SYSTEM_URL],
            &[
                "talisman_anchor_governance",
                "totem_taboo_talisman_read_order",
                "human_review_owner",
                "anchor_change_risk",
                "audit_and_rollback_records",
            ],
        ),
        setup_descriptor(
            UaixMemorySetup::AdvancedPersonaProfile,
            "Advanced Persona / Personality Pack",
            "Preserves source persona evidence, detailed personality dimensions, fidelity evidence, variance records, and no silent source-persona mutation.",
            &format!("{UAIX_MEMORY_WIZARD_URL}#setup-advanced-persona"),
            &[UAIX_MEMORY_WIZARD_URL, UAIX_PERSONA_PACK_URL],
            &[
                "persona_entrypoint",
                "uaix_zip_txt_template_decks",
                "personality_dimension_files",
                "depth_level_0_to_10_dimension_evidence",
                "disclosure_boundary_evidence",
                "source_confidence_evidence",
                "non_inference_rules",
                "triggered_style_axes",
                "source_persona_preservation_rule",
                "source_excerpts",
                "fidelity_test_deck",
                "runtime_variance_template",
                "provenance_evidence",
            ],
        ),
    ];
    UaixMemorySetupCatalog {
        kind: MEMORY_SETUP_CATALOG_KIND.to_string(),
        version: 1,
        setup_count: setups.len() as u32,
        setups,
        source_urls: vec![
            UAIX_MEMORY_WIZARD_URL.to_string(),
            UAIX_PERSONA_PACK_URL.to_string(),
            UAIX_AGENT_COMMUNICATION_URL.to_string(),
            UAIX_TALISMAN_SYSTEM_URL.to_string(),
        ],
        boundary: memory_boundary(),
    }
}

/// Builds a deterministic UAIX memory required-file plan.
pub fn memory_required_files(
    request: &UaixMemoryPackageRequest,
) -> Result<UaixMemoryPackagePlan, UaixMemoryError> {
    validate_persona_depths(&request.advanced_persona)?;
    let mut files = BTreeMap::<String, UaixMemoryRequiredFile>::new();
    for (path, state, role, source) in universal_files() {
        insert_required(&mut files, path, state, role, source);
    }
    for (path, state, role, source) in baseline_files() {
        insert_required(&mut files, path, state, role, source);
    }
    if matches!(
        request.setup,
        UaixMemorySetup::AgentFileHandoff | UaixMemorySetup::FileHandoffLlmWiki
    ) {
        for (path, state, role, source) in file_handoff_files() {
            insert_required(&mut files, path, state, role, source);
        }
    }
    if matches!(
        request.setup,
        UaixMemorySetup::LlmWiki | UaixMemorySetup::FileHandoffLlmWiki
    ) {
        insert_required(
            &mut files,
            ".uai/long-term-memory.uai",
            "configuration_specific_required",
            "pointer_ledger",
            UAIX_MEMORY_WIZARD_URL,
        );
    }
    if request.code_like_artifacts || matches!(request.setup, UaixMemorySetup::FileHandoffLlmWiki) {
        for (path, state, role, source) in code_bearing_files() {
            insert_required(&mut files, path, state, role, source);
        }
    }
    if matches!(request.setup, UaixMemorySetup::MultiAgentCommunication) {
        for (path, state, role, source) in multi_agent_communication_files() {
            insert_required(&mut files, path, state, role, source);
        }
    }
    if matches!(request.setup, UaixMemorySetup::TalismanSystem) {
        for (path, state, role, source) in talisman_system_files() {
            insert_required(&mut files, path, state, role, source);
        }
    }
    for (enabled, path, role) in [
        (
            request.tool_permissions,
            ".uai/tool-permissions.uai",
            "permission_boundary",
        ),
        (
            request.delegated_operations,
            ".uai/credential-inventory.uai",
            "credential_inventory",
        ),
        (
            request.deployment,
            "reports/deployment-memory-and-test-report.uai",
            "deployment_proof",
        ),
        (
            request.contact_memory,
            ".uai/contact-memory.uai",
            "contact_memory",
        ),
        (
            request.calendar_scheduling,
            ".uai/calendar-and-scheduling.uai",
            "calendar_memory",
        ),
        (
            request.communication_style,
            ".uai/communication-style.uai",
            "communication_style",
        ),
        (
            request.tasks_commitments,
            ".uai/tasks-and-commitments.uai",
            "task_memory",
        ),
        (
            request.routines_preferences,
            ".uai/routines-and-preferences.uai",
            "preference_memory",
        ),
        (
            request.safety_support_boundaries,
            ".uai/safety-and-support-boundary.uai",
            "support_boundary",
        ),
        (
            request.source_notes,
            ".uai/source-notes.uai",
            "source_notes",
        ),
        (
            request.public_facing_boundaries,
            ".uai/public-facing-boundary.uai",
            "public_boundary",
        ),
    ] {
        if enabled {
            insert_required(
                &mut files,
                path,
                "content_triggered_required",
                role,
                UAIX_MEMORY_WIZARD_URL,
            );
        }
    }
    if matches!(request.setup, UaixMemorySetup::AdvancedPersonaProfile) {
        for (path, state, role, source) in advanced_persona_files(&request.advanced_persona) {
            insert_required(&mut files, path, state, role, source);
        }
    }
    let required_files = files.into_values().collect::<Vec<_>>();
    let file_deck = file_deck_summary(&required_files);
    Ok(UaixMemoryPackagePlan {
        kind: MEMORY_PACKAGE_PLAN_KIND.to_string(),
        version: 1,
        setup: request.setup,
        required_file_count: required_files.len() as u32,
        required_files,
        file_deck,
        source_urls: vec![
            UAIX_MEMORY_WIZARD_URL.to_string(),
            UAIX_PERSONA_PACK_URL.to_string(),
            UAIX_AGENT_COMMUNICATION_URL.to_string(),
            UAIX_TALISMAN_SYSTEM_URL.to_string(),
        ],
        boundary: memory_boundary(),
    })
}

/// Builds a required-file plan from JSON request text.
pub fn memory_required_files_text(
    request_json: Option<&str>,
) -> Result<UaixMemoryPackagePlan, UaixMemoryError> {
    let request = parse_request(request_json)?;
    memory_required_files(&request)
}

/// Inspects a memory package directory, `.zip`, or `.uaix` path.
pub fn inspect_memory_package_path(
    package_path: impl AsRef<Path>,
    request: &UaixMemoryPackageRequest,
) -> Result<UaixMemoryPackageInspection, UaixMemoryError> {
    let plan = memory_required_files(request)?;
    let package_path = package_path.as_ref();
    let source = load_package_source(package_path)?;
    let mut missing_required_files = Vec::new();
    let mut required_status = Vec::new();
    for required in &plan.required_files {
        let entry = source.entries.get(&required.path);
        let exists = entry.is_some_and(|item| item.byte_count > 0);
        if !exists {
            missing_required_files.push(required.path.clone());
        }
        required_status.push(UaixMemoryFileStatus {
            path: required.path.clone(),
            state: required.state.clone(),
            role: required.role.clone(),
            exists,
            byte_count: entry.map_or(0, |item| item.byte_count),
            sha256: entry.map(|item| item.sha256.clone()),
        });
    }
    let manifest = source
        .entries
        .get(".uai/manifest.uaix.json")
        .and_then(|entry| entry.text.as_deref())
        .map(inspect_memory_manifest_text)
        .transpose()?;
    let manifest_missing_required_files = manifest
        .as_ref()
        .map(|manifest| missing_manifest_declarations(&plan.required_files, manifest))
        .unwrap_or_else(|| {
            plan.required_files
                .iter()
                .map(|required| required.path.clone())
                .collect()
        });
    let manifest_declares_required_files =
        manifest.is_some() && manifest_missing_required_files.is_empty();
    let persona_dimensions = inspect_persona_dimensions(&source, request);
    let persona_dimension_warning_count = persona_dimensions
        .iter()
        .map(|dimension| dimension.warnings.len() as u32)
        .sum();
    let persona_dimensions_valid =
        !matches!(request.setup, UaixMemorySetup::AdvancedPersonaProfile)
            || persona_dimensions.iter().all(|dimension| dimension.valid);
    let files_present = plan.required_files.iter().all(|required| {
        source
            .entries
            .get(&required.path)
            .is_some_and(|entry| entry.byte_count > 0)
    });
    let manifest_valid = manifest.as_ref().is_some_and(|manifest| manifest.valid);
    Ok(UaixMemoryPackageInspection {
        kind: MEMORY_PACKAGE_INSPECTION_KIND.to_string(),
        version: 1,
        package_path: package_path.display().to_string(),
        package_source: source.source_type,
        setup: request.setup,
        required_files: required_status,
        file_deck: plan.file_deck,
        persona_dimensions,
        persona_dimensions_valid,
        persona_dimension_warning_count,
        missing_required_files,
        manifest_missing_required_files,
        manifest_declares_required_files,
        package_file_count: source.entries.len() as u32,
        valid: files_present
            && manifest_valid
            && manifest_declares_required_files
            && persona_dimensions_valid,
        manifest,
        boundary: plan.boundary,
    })
}

/// Inspects a memory package path from JSON request text.
pub fn inspect_memory_package_path_text(
    package_path: impl AsRef<Path>,
    request_json: Option<&str>,
) -> Result<UaixMemoryPackageInspection, UaixMemoryError> {
    let request = parse_request(request_json)?;
    inspect_memory_package_path(package_path, &request)
}

/// Inspects a UAIX memory manifest JSON document.
pub fn inspect_memory_manifest_text(
    manifest_json: &str,
) -> Result<UaixMemoryManifestInspection, UaixMemoryError> {
    if manifest_json.len() > MAX_MEMORY_MANIFEST_BYTES {
        return Err(UaixMemoryError::LimitExceeded(format!(
            "manifest JSON exceeds {MAX_MEMORY_MANIFEST_BYTES} bytes"
        )));
    }
    let manifest: Value = serde_json::from_str(manifest_json)
        .map_err(|error| UaixMemoryError::InvalidJson(error.to_string()))?;
    let Some(object) = manifest.as_object() else {
        return Err(UaixMemoryError::InvalidJson(
            "memory manifest must be a JSON object".to_string(),
        ));
    };
    let declared_kind = object
        .get("kind")
        .or_else(|| object.get("package_kind"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let declared_setup = object
        .get("setup")
        .or_else(|| object.get("setup_mode"))
        .or_else(|| object.get("profile"))
        .or_else(|| object.get("package_profile"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let (declared_file_paths, mut warnings, manifest_paths_valid) =
        declared_manifest_file_paths(&manifest);
    let declared_file_count = declared_file_paths.len() as u32;
    let advanced_persona_profile = value_contains_string(&manifest, "advanced_persona_profile");
    if declared_file_count == 0 {
        warnings.push(
            "manifest did not expose a recognizable files, entries, or archive_entries array"
                .to_string(),
        );
    }
    if declared_kind.is_none() {
        warnings.push("manifest kind was not declared".to_string());
    }
    Ok(UaixMemoryManifestInspection {
        kind: MEMORY_MANIFEST_INSPECTION_KIND.to_string(),
        version: 1,
        manifest_sha256: sha256_bytes(manifest_json.as_bytes()),
        declared_kind,
        declared_setup,
        advanced_persona_profile,
        declared_file_count,
        declared_file_paths,
        valid: manifest_paths_valid,
        warnings,
    })
}

fn missing_manifest_declarations(
    required_files: &[UaixMemoryRequiredFile],
    manifest: &UaixMemoryManifestInspection,
) -> Vec<String> {
    let declared = manifest
        .declared_file_paths
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    required_files
        .iter()
        .filter_map(|required| {
            if declared.contains(required.path.as_str()) {
                None
            } else {
                Some(required.path.clone())
            }
        })
        .collect()
}

fn parse_request(request_json: Option<&str>) -> Result<UaixMemoryPackageRequest, UaixMemoryError> {
    match request_json {
        None => Ok(UaixMemoryPackageRequest::default()),
        Some(text) if text.trim().is_empty() => Ok(UaixMemoryPackageRequest::default()),
        Some(text) => serde_json::from_str::<UaixMemoryPackageRequest>(text)
            .map_err(|error| UaixMemoryError::InvalidJson(error.to_string())),
    }
}

fn validate_persona_depths(options: &AdvancedPersonaOptions) -> Result<(), UaixMemoryError> {
    for (name, depth) in [
        ("religion_worldview_depth", options.religion_worldview_depth),
        ("political_leaning_depth", options.political_leaning_depth),
        ("sense_of_style_depth", options.sense_of_style_depth),
        (
            "physical_appearance_depth",
            options.physical_appearance_depth,
        ),
        (
            "birth_age_generation_depth",
            options.birth_age_generation_depth,
        ),
        (
            "romantic_orientation_depth",
            options.romantic_orientation_depth,
        ),
    ] {
        if depth > 10 {
            return Err(UaixMemoryError::InvalidPackage(format!(
                "{name} must be between 0 and 10"
            )));
        }
    }
    Ok(())
}

fn setup_descriptor(
    setup: UaixMemorySetup,
    label: &str,
    summary: &str,
    setup_url: &str,
    authority_urls: &[&str],
    package_features: &[&str],
) -> UaixMemorySetupDescriptor {
    UaixMemorySetupDescriptor {
        setup,
        label: label.to_string(),
        summary: summary.to_string(),
        setup_url: setup_url.to_string(),
        authority_urls: authority_urls
            .iter()
            .map(|url| (*url).to_string())
            .collect(),
        package_features: package_features
            .iter()
            .map(|feature| (*feature).to_string())
            .collect(),
        excluded_private_capabilities: vec![
            "hosted_import_validation".to_string(),
            "automatic_repository_writes".to_string(),
            "automatic_llm_wiki_sync".to_string(),
            "talisman_runtime_enforcement".to_string(),
            "persona_fidelity_certification".to_string(),
            "memory_ranking_or_optimization".to_string(),
        ],
    }
}

fn universal_files() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        (
            ".uai/memory-maintenance.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/identity.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/world-context.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/totem.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/taboo.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/talisman.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/short-term-memory.uai",
            "universal_required",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
    ]
}

fn baseline_files() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        (
            ".uai/manifest.uaix.json",
            "configuration_specific_required",
            "manifest",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/startup-packet.uai",
            "profile_required",
            "startup_packet",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/system-profile.uai",
            "profile_required",
            "system_profile",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/receiver-brief.uai",
            "profile_required",
            "receiver_brief",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/index.uai",
            "profile_required",
            "index",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/context.uai",
            "profile_required",
            "context",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/constraints.uai",
            "profile_required",
            "constraints",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/progress.uai",
            "profile_required",
            "progress",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/operations.uai",
            "profile_required",
            "operations",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/test-plan.uai",
            "profile_required",
            "test_plan",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/decisions.uai",
            "profile_required",
            "decisions",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/memory.uai",
            "profile_required",
            "memory",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/agent-pickup.uai",
            "configuration_specific_required",
            "agent_pickup",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/archives/session-log.uai",
            "configuration_specific_required",
            "session_log",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/exports/manifest.json",
            "configuration_specific_required",
            "export",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/exports/manifest-overlay.json",
            "configuration_specific_required",
            "export",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/exports/package-model.json",
            "configuration_specific_required",
            "export",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/exports/knowledge-graph.json",
            "configuration_specific_required",
            "export",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/exports/llms.uai",
            "configuration_specific_required",
            "export",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/exports/llms-full.uai",
            "configuration_specific_required",
            "export",
            UAIX_MEMORY_WIZARD_URL,
        ),
    ]
}

fn file_handoff_files() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        (
            ".uai/file-handoff.uai",
            "configuration_specific_required",
            "file_handoff",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/intake-outcome-ledger.uai",
            "configuration_specific_required",
            "proof_of_use",
            UAIX_MEMORY_WIZARD_URL,
        ),
    ]
}

fn code_bearing_files() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        (
            ".uai/coding-standards.uai",
            "content_triggered_required",
            "coding_standards",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/architecture.uai",
            "content_triggered_required",
            "architecture",
            UAIX_MEMORY_WIZARD_URL,
        ),
        (
            ".uai/next-recursive-prompt.uai",
            "content_triggered_required",
            "continuation_prompt",
            UAIX_MEMORY_WIZARD_URL,
        ),
    ]
}

fn multi_agent_communication_files() -> Vec<(&'static str, &'static str, &'static str, &'static str)>
{
    vec![
        (
            ".uai/agent-instructions.uai",
            "configuration_specific_required",
            "multi_agent_instruction",
            UAIX_AGENT_COMMUNICATION_URL,
        ),
        (
            ".uai/owners.uai",
            "configuration_specific_required",
            "review_owner",
            UAIX_AGENT_COMMUNICATION_URL,
        ),
        (
            ".uai/current-state.uai",
            "configuration_specific_required",
            "shared_state",
            UAIX_AGENT_COMMUNICATION_URL,
        ),
        (
            ".uai/next-actions.uai",
            "configuration_specific_required",
            "handoff_next_action",
            UAIX_AGENT_COMMUNICATION_URL,
        ),
        (
            ".uai/open-questions.uai",
            "configuration_specific_required",
            "handoff_question",
            UAIX_AGENT_COMMUNICATION_URL,
        ),
        (
            ".uai/risk-register.uai",
            "configuration_specific_required",
            "coordination_risk",
            UAIX_AGENT_COMMUNICATION_URL,
        ),
    ]
}

fn talisman_system_files() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        (
            ".uai/agent-instructions.uai",
            "configuration_specific_required",
            "anchor_no_op_instruction",
            UAIX_TALISMAN_SYSTEM_URL,
        ),
        (
            ".uai/owners.uai",
            "configuration_specific_required",
            "anchor_review_owner",
            UAIX_TALISMAN_SYSTEM_URL,
        ),
        (
            ".uai/risk-register.uai",
            "configuration_specific_required",
            "anchor_change_risk",
            UAIX_TALISMAN_SYSTEM_URL,
        ),
        (
            "reports/deployment-memory-and-test-report.uai",
            "configuration_specific_required",
            "anchor_audit_and_rollback",
            UAIX_TALISMAN_SYSTEM_URL,
        ),
    ]
}

fn advanced_persona_files(
    options: &AdvancedPersonaOptions,
) -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    let mut files = vec![
        (
            ".uai/readme.human",
            "configuration_specific_required",
            "human_explanation",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/persona.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/identity.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/religion-worldview.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/political-leaning.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/sense-of-style.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/physical-appearance.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/birth-age-generation.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/romantic-orientation.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/voice.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/values.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/temperament.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/reasoning-style.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/emotional-patterns.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/relationship-style.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/behavioral-patterns.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/boundaries.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/examples-dialogue.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/adaptation-rules.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/personality/preservation-rules.uai",
            "required_for_advanced_persona_profile",
            "ai_instruction",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/evidence/source-excerpts.uai",
            "required_for_advanced_persona_profile",
            "evidence",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/evidence/source-platform-profile.uai",
            "required_for_advanced_persona_profile",
            "evidence",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/evidence/persona-fidelity-test-deck.uai",
            "required_for_advanced_persona_profile",
            "evidence",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/evidence/variance-report-template.uai",
            "required_for_advanced_persona_profile",
            "evidence",
            UAIX_PERSONA_PACK_URL,
        ),
        (
            ".uai/evidence/provenance.uai",
            "required_for_advanced_persona_profile",
            "evidence",
            UAIX_PERSONA_PACK_URL,
        ),
    ];
    let include_all = options.include_all_persona_dimensions;
    for (enabled, path) in [
        (
            include_all || options.include_winter_style || options.sense_of_style_depth > 0,
            ".uai/personality/sense-of-winter.uai",
        ),
        (
            include_all || options.include_spring_fall_style || options.sense_of_style_depth > 0,
            ".uai/personality/sense-of-spring-fall.uai",
        ),
        (
            include_all || options.include_super_fashion_style || options.sense_of_style_depth > 0,
            ".uai/personality/super-fashion-style.uai",
        ),
        (
            include_all || options.include_jewelry_choices || options.sense_of_style_depth > 0,
            ".uai/personality/jewelry-choices.uai",
        ),
    ] {
        if enabled {
            files.push((
                path,
                "content_triggered_required",
                "ai_instruction",
                UAIX_PERSONA_PACK_URL,
            ));
        }
    }
    files
}

fn advanced_persona_dimension_specs(
    options: &AdvancedPersonaOptions,
) -> Vec<(&'static str, &'static str)> {
    let include_all = options.include_all_persona_dimensions;
    let mut dimensions = vec![
        (
            "Religion and worldview",
            ".uai/personality/religion-worldview.uai",
        ),
        (
            "Political leaning",
            ".uai/personality/political-leaning.uai",
        ),
        ("Sense of style", ".uai/personality/sense-of-style.uai"),
        (
            "Physical appearance",
            ".uai/personality/physical-appearance.uai",
        ),
        (
            "Birth, age, and generation",
            ".uai/personality/birth-age-generation.uai",
        ),
        (
            "Romantic orientation",
            ".uai/personality/romantic-orientation.uai",
        ),
    ];
    for (enabled, dimension, path) in [
        (
            include_all || options.include_winter_style || options.sense_of_style_depth > 0,
            "Winter style",
            ".uai/personality/sense-of-winter.uai",
        ),
        (
            include_all || options.include_spring_fall_style || options.sense_of_style_depth > 0,
            "Spring/fall style",
            ".uai/personality/sense-of-spring-fall.uai",
        ),
        (
            include_all || options.include_super_fashion_style || options.sense_of_style_depth > 0,
            "Super fashion/style",
            ".uai/personality/super-fashion-style.uai",
        ),
        (
            include_all || options.include_jewelry_choices || options.sense_of_style_depth > 0,
            "Jewelry choices",
            ".uai/personality/jewelry-choices.uai",
        ),
    ] {
        if enabled {
            dimensions.push((dimension, path));
        }
    }
    dimensions
}

fn inspect_persona_dimensions(
    source: &PackageSource,
    request: &UaixMemoryPackageRequest,
) -> Vec<UaixPersonaDimensionInspection> {
    if !matches!(request.setup, UaixMemorySetup::AdvancedPersonaProfile) {
        return Vec::new();
    }
    advanced_persona_dimension_specs(&request.advanced_persona)
        .into_iter()
        .map(|(dimension, path)| inspect_persona_dimension(source, dimension, path))
        .collect()
}

fn inspect_persona_dimension(
    source: &PackageSource,
    dimension: &str,
    path: &str,
) -> UaixPersonaDimensionInspection {
    let entry = source.entries.get(path);
    let exists = entry.is_some_and(|entry| entry.byte_count > 0);
    let mut warnings = Vec::new();
    if !exists {
        warnings.push("persona dimension file is missing or empty".to_string());
    }
    let text = entry.and_then(|entry| entry.text.as_deref()).unwrap_or("");
    if exists && text.is_empty() {
        warnings.push("persona dimension file is not valid UTF-8 text".to_string());
    }
    let depth_level_0_to_10 = extract_depth_level_0_to_10(text);
    let declares_depth_level =
        text_contains_marker(text, &["depth_level_0_to_10", "depth level 0 to 10"]);
    if exists && !declares_depth_level {
        warnings.push("persona dimension did not declare depth_level_0_to_10".to_string());
    }
    if exists && depth_level_0_to_10.is_none() {
        warnings.push(
            "persona dimension did not provide a parsed depth value from 0 to 10".to_string(),
        );
    }
    let declares_disclosure_boundary =
        text_contains_marker(text, &["disclosure_boundary", "disclosure boundary"]);
    if exists && !declares_disclosure_boundary {
        warnings.push("persona dimension did not declare a disclosure boundary".to_string());
    }
    let declares_source_confidence =
        text_contains_marker(text, &["source_confidence", "source confidence"]);
    if exists && !declares_source_confidence {
        warnings.push("persona dimension did not declare source confidence".to_string());
    }
    let declares_non_inference_rules = text_contains_marker(
        text,
        &[
            "non_inference",
            "non-inference",
            "non inference",
            "do not infer",
            "no inference",
        ],
    );
    if exists && !declares_non_inference_rules {
        warnings.push("persona dimension did not declare non-inference rules".to_string());
    }
    let valid = exists
        && !text.is_empty()
        && declares_depth_level
        && depth_level_0_to_10.is_some()
        && declares_disclosure_boundary
        && declares_source_confidence
        && declares_non_inference_rules;
    UaixPersonaDimensionInspection {
        dimension: dimension.to_string(),
        path: path.to_string(),
        exists,
        byte_count: entry.map_or(0, |entry| entry.byte_count),
        sha256: entry.map(|entry| entry.sha256.clone()),
        declares_depth_level,
        depth_level_0_to_10,
        declares_disclosure_boundary,
        declares_source_confidence,
        declares_non_inference_rules,
        valid,
        warnings,
    }
}

fn file_deck_summary(required_files: &[UaixMemoryRequiredFile]) -> UaixMemoryFileDeckSummary {
    let contains_path = |target: &str| required_files.iter().any(|file| file.path == target);
    let count_state = |state: &str| {
        required_files
            .iter()
            .filter(|file| file.state == state)
            .count() as u32
    };
    let evidence_files = required_files
        .iter()
        .filter(|file| file.role == "evidence" || file.path.starts_with(".uai/evidence/"))
        .count() as u32;
    let export_files = required_files
        .iter()
        .filter(|file| file.role == "export" || file.path.starts_with(".uai/exports/"))
        .count() as u32;
    let persona_dimension_files = required_files
        .iter()
        .filter(|file| file.path.starts_with(".uai/personality/"))
        .count() as u32;
    let triggered_persona_style_axis_files = required_files
        .iter()
        .filter(|file| {
            file.state == "content_triggered_required" && file.path.starts_with(".uai/personality/")
        })
        .count() as u32;
    let includes_persona_source_evidence = [
        ".uai/persona.uai",
        ".uai/personality/preservation-rules.uai",
        ".uai/evidence/source-excerpts.uai",
        ".uai/evidence/provenance.uai",
    ]
    .iter()
    .all(|path| contains_path(path));
    UaixMemoryFileDeckSummary {
        total_required_files: required_files.len() as u32,
        universal_required_files: count_state("universal_required"),
        profile_required_files: count_state("profile_required"),
        configuration_specific_required_files: count_state("configuration_specific_required"),
        content_triggered_required_files: count_state("content_triggered_required"),
        advanced_persona_required_files: count_state("required_for_advanced_persona_profile"),
        evidence_files,
        export_files,
        persona_dimension_files,
        triggered_persona_style_axis_files,
        includes_manifest_json: contains_path(".uai/exports/manifest.json"),
        includes_manifest_overlay: contains_path(".uai/exports/manifest-overlay.json"),
        includes_package_model: contains_path(".uai/exports/package-model.json"),
        includes_knowledge_graph: contains_path(".uai/exports/knowledge-graph.json"),
        includes_llms_exports: contains_path(".uai/exports/llms.uai")
            && contains_path(".uai/exports/llms-full.uai"),
        includes_agent_pickup: contains_path(".uai/agent-pickup.uai"),
        includes_session_log: contains_path(".uai/archives/session-log.uai"),
        includes_persona_source_evidence,
        closed_required_file_set: true,
    }
}

fn insert_required(
    files: &mut BTreeMap<String, UaixMemoryRequiredFile>,
    path: &str,
    state: &str,
    role: &str,
    source: &str,
) {
    files
        .entry(path.to_string())
        .or_insert_with(|| UaixMemoryRequiredFile {
            path: path.to_string(),
            state: state.to_string(),
            role: role.to_string(),
            source: source.to_string(),
        });
}

fn memory_boundary() -> UaixMemoryBoundary {
    UaixMemoryBoundary {
        hosted_import_validation: false,
        automatic_repository_writes: false,
        automatic_llm_wiki_sync: false,
        persona_fidelity_certification: false,
        persona_source_mutation_allowed: false,
        uses_tinyrustlm_runtime_harness: true,
    }
}

struct PackageSource {
    source_type: String,
    entries: BTreeMap<String, PackageEntry>,
}

struct PackageEntry {
    byte_count: u64,
    sha256: String,
    text: Option<String>,
}

fn load_package_source(path: &Path) -> Result<PackageSource, UaixMemoryError> {
    let metadata = fs::metadata(path).map_err(|error| UaixMemoryError::Io(error.to_string()))?;
    if metadata.is_dir() {
        return load_directory(path);
    }
    if metadata.len() > MAX_MEMORY_PACKAGE_BYTES {
        return Err(UaixMemoryError::LimitExceeded(format!(
            "package exceeds {MAX_MEMORY_PACKAGE_BYTES} bytes"
        )));
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension == "zip" || extension == "uaix" {
        return load_archive(path);
    }
    Err(UaixMemoryError::InvalidPackage(
        "memory package path must be a directory, .zip, or .uaix archive".to_string(),
    ))
}

fn load_directory(root: &Path) -> Result<PackageSource, UaixMemoryError> {
    let mut entries = BTreeMap::new();
    visit_directory(root, root, &mut entries)?;
    Ok(PackageSource {
        source_type: "directory".to_string(),
        entries,
    })
}

fn visit_directory(
    root: &Path,
    current: &Path,
    entries: &mut BTreeMap<String, PackageEntry>,
) -> Result<(), UaixMemoryError> {
    if entries.len() > MAX_MEMORY_FILE_COUNT {
        return Err(UaixMemoryError::LimitExceeded(format!(
            "package file count exceeds {MAX_MEMORY_FILE_COUNT}"
        )));
    }
    for entry in fs::read_dir(current).map_err(|error| UaixMemoryError::Io(error.to_string()))? {
        let entry = entry.map_err(|error| UaixMemoryError::Io(error.to_string()))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|error| UaixMemoryError::Io(error.to_string()))?;
        if metadata.is_dir() {
            visit_directory(root, &path, entries)?;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|error| UaixMemoryError::InvalidPackage(error.to_string()))?;
        let Some(normalized) = normalize_relative_path(relative) else {
            continue;
        };
        if !is_memory_package_path(&normalized) {
            continue;
        }
        if metadata.len() > MAX_MEMORY_FILE_BYTES {
            return Err(UaixMemoryError::LimitExceeded(format!(
                "{normalized} exceeds {MAX_MEMORY_FILE_BYTES} bytes"
            )));
        }
        let bytes = fs::read(&path).map_err(|error| UaixMemoryError::Io(error.to_string()))?;
        entries.insert(normalized, package_entry(bytes));
    }
    Ok(())
}

fn load_archive(path: &Path) -> Result<PackageSource, UaixMemoryError> {
    let bytes = fs::read(path).map_err(|error| UaixMemoryError::Io(error.to_string()))?;
    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|error| UaixMemoryError::InvalidPackage(error.to_string()))?;
    if archive.len() > MAX_MEMORY_FILE_COUNT {
        return Err(UaixMemoryError::LimitExceeded(format!(
            "archive file count exceeds {MAX_MEMORY_FILE_COUNT}"
        )));
    }
    let mut entries = BTreeMap::new();
    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| UaixMemoryError::InvalidPackage(error.to_string()))?;
        if file.is_dir() {
            continue;
        }
        let Some(normalized) = normalize_archive_name(file.name()) else {
            return Err(UaixMemoryError::InvalidPackage(format!(
                "archive entry has unsafe path: {}",
                file.name()
            )));
        };
        if !is_memory_package_path(&normalized) {
            continue;
        }
        if file.size() > MAX_MEMORY_FILE_BYTES {
            return Err(UaixMemoryError::LimitExceeded(format!(
                "{normalized} exceeds {MAX_MEMORY_FILE_BYTES} bytes"
            )));
        }
        let mut bytes = Vec::with_capacity(file.size() as usize);
        file.read_to_end(&mut bytes)
            .map_err(|error| UaixMemoryError::Io(error.to_string()))?;
        entries.insert(normalized, package_entry(bytes));
    }
    Ok(PackageSource {
        source_type: "archive".to_string(),
        entries,
    })
}

fn normalize_relative_path(path: &Path) -> Option<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            _ => return None,
        }
    }
    Some(parts.join("/"))
}

fn normalize_archive_name(name: &str) -> Option<String> {
    let replaced = name.replace('\\', "/");
    if replaced.starts_with('/') || replaced.contains('\0') {
        return None;
    }
    let mut parts = Vec::new();
    for part in replaced.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return None;
        }
        parts.push(part);
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

fn is_memory_package_path(path: &str) -> bool {
    path.starts_with(".uai/")
        || path == "AGENTS.md"
        || path == "workspace.uai"
        || path.starts_with("agent-file-handoff/")
        || path == "reports/deployment-memory-and-test-report.uai"
}

fn package_entry(bytes: Vec<u8>) -> PackageEntry {
    let text = if bytes.len() <= MAX_MEMORY_MANIFEST_BYTES {
        String::from_utf8(bytes.clone()).ok()
    } else {
        None
    };
    PackageEntry {
        byte_count: bytes.len() as u64,
        sha256: sha256_bytes(&bytes),
        text,
    }
}

fn declared_manifest_file_paths(value: &Value) -> (Vec<String>, Vec<String>, bool) {
    let mut paths = BTreeSet::new();
    let mut warnings = Vec::new();
    collect_declared_manifest_file_paths(value, &mut paths, &mut warnings);
    let valid = warnings
        .iter()
        .all(|warning| !warning.starts_with("manifest declared unsafe file path"));
    (paths.into_iter().collect(), warnings, valid)
}

fn collect_declared_manifest_file_paths(
    value: &Value,
    paths: &mut BTreeSet<String>,
    warnings: &mut Vec<String>,
) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_declared_manifest_file_paths(item, paths, warnings);
            }
        }
        Value::Object(object) => {
            for (key, nested) in object {
                if matches!(
                    key.as_str(),
                    "files" | "entries" | "archive_entries" | "required_files"
                ) {
                    collect_file_array_paths(nested, paths, warnings);
                } else {
                    collect_declared_manifest_file_paths(nested, paths, warnings);
                }
            }
        }
        _ => {}
    }
}

fn collect_file_array_paths(
    value: &Value,
    paths: &mut BTreeSet<String>,
    warnings: &mut Vec<String>,
) {
    let Value::Array(items) = value else {
        warnings.push("manifest file declarations were not an array".to_string());
        return;
    };
    for item in items {
        match item {
            Value::String(path) => collect_declared_path(path, paths, warnings),
            Value::Object(object) => {
                let path = ["path", "name", "entry", "archive_path", "relative_path"]
                    .iter()
                    .find_map(|key| object.get(*key).and_then(Value::as_str));
                if let Some(path) = path {
                    collect_declared_path(path, paths, warnings);
                } else {
                    warnings.push(
                        "manifest file declaration omitted path, name, entry, archive_path, or relative_path"
                            .to_string(),
                    );
                }
            }
            _ => warnings.push("manifest file declaration was not a string or object".to_string()),
        }
    }
}

fn collect_declared_path(path: &str, paths: &mut BTreeSet<String>, warnings: &mut Vec<String>) {
    let Some(normalized) = normalize_archive_name(path) else {
        warnings.push(format!("manifest declared unsafe file path: {path}"));
        return;
    };
    if !is_memory_package_path(&normalized) {
        warnings.push(format!(
            "manifest declared out-of-scope file path: {normalized}"
        ));
        return;
    }
    paths.insert(normalized);
}

fn value_contains_string(value: &Value, needle: &str) -> bool {
    match value {
        Value::String(text) => text.eq_ignore_ascii_case(needle) || text.contains(needle),
        Value::Array(items) => items.iter().any(|item| value_contains_string(item, needle)),
        Value::Object(object) => object
            .iter()
            .any(|(key, item)| key.contains(needle) || value_contains_string(item, needle)),
        _ => false,
    }
}

fn text_contains_marker(text: &str, markers: &[&str]) -> bool {
    let normalized = text.to_ascii_lowercase();
    markers
        .iter()
        .any(|marker| normalized.contains(&marker.to_ascii_lowercase()))
}

fn extract_depth_level_0_to_10(text: &str) -> Option<u8> {
    let normalized = text.to_ascii_lowercase();
    for marker in ["depth_level_0_to_10", "depth level 0 to 10"] {
        let Some(index) = normalized.find(marker) else {
            continue;
        };
        let tail = &normalized[index + marker.len()..];
        let mut digits = String::new();
        for character in tail.chars() {
            if character.is_ascii_digit() {
                digits.push(character);
                continue;
            }
            if !digits.is_empty() {
                break;
            }
        }
        if digits.is_empty() {
            continue;
        }
        if let Ok(value) = digits.parse::<u8>() {
            if value <= 10 {
                return Some(value);
            }
        }
    }
    None
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn advanced_persona_plan_includes_required_dimension_files() {
        let request = UaixMemoryPackageRequest {
            setup: UaixMemorySetup::AdvancedPersonaProfile,
            ..UaixMemoryPackageRequest::default()
        };
        let plan = memory_required_files(&request).expect("plan");
        let paths = plan
            .required_files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<BTreeSet<_>>();
        assert!(paths.contains(".uai/persona.uai"));
        assert!(paths.contains(".uai/agent-pickup.uai"));
        assert!(paths.contains(".uai/archives/session-log.uai"));
        assert!(paths.contains(".uai/exports/manifest-overlay.json"));
        assert!(paths.contains(".uai/exports/package-model.json"));
        assert!(paths.contains(".uai/exports/knowledge-graph.json"));
        assert!(paths.contains(".uai/personality/religion-worldview.uai"));
        assert!(paths.contains(".uai/personality/sense-of-winter.uai"));
        assert!(paths.contains(".uai/evidence/provenance.uai"));
        assert_eq!(
            plan.file_deck.total_required_files,
            plan.required_file_count
        );
        assert!(plan.file_deck.closed_required_file_set);
        assert!(plan.file_deck.includes_manifest_json);
        assert!(plan.file_deck.includes_manifest_overlay);
        assert!(plan.file_deck.includes_package_model);
        assert!(plan.file_deck.includes_knowledge_graph);
        assert!(plan.file_deck.includes_llms_exports);
        assert!(plan.file_deck.includes_agent_pickup);
        assert!(plan.file_deck.includes_session_log);
        assert!(plan.file_deck.includes_persona_source_evidence);
        assert_eq!(plan.file_deck.total_required_files, 56);
        assert_eq!(plan.file_deck.universal_required_files, 7);
        assert_eq!(plan.file_deck.profile_required_files, 11);
        assert_eq!(plan.file_deck.configuration_specific_required_files, 10);
        assert_eq!(plan.file_deck.content_triggered_required_files, 4);
        assert_eq!(plan.file_deck.advanced_persona_required_files, 24);
        assert_eq!(plan.file_deck.persona_dimension_files, 22);
        assert_eq!(plan.file_deck.triggered_persona_style_axis_files, 4);
        assert_eq!(plan.file_deck.evidence_files, 5);
        assert_eq!(plan.file_deck.export_files, 6);
        assert!(!plan.boundary.persona_source_mutation_allowed);
        assert!(plan.boundary.uses_tinyrustlm_runtime_harness);
    }

    #[test]
    fn content_triggered_advanced_persona_plan_matches_browser_filedeck_smoke() {
        let request = UaixMemoryPackageRequest {
            setup: UaixMemorySetup::AdvancedPersonaProfile,
            code_like_artifacts: true,
            deployment: true,
            communication_style: true,
            source_notes: true,
            advanced_persona: AdvancedPersonaOptions {
                sense_of_style_depth: 3,
                ..AdvancedPersonaOptions::default()
            },
            ..UaixMemoryPackageRequest::default()
        };
        let plan = memory_required_files(&request).expect("plan");
        let paths = plan
            .required_files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<BTreeSet<_>>();
        assert!(paths.contains(".uai/coding-standards.uai"));
        assert!(paths.contains(".uai/architecture.uai"));
        assert!(paths.contains(".uai/next-recursive-prompt.uai"));
        assert!(paths.contains("reports/deployment-memory-and-test-report.uai"));
        assert!(paths.contains(".uai/communication-style.uai"));
        assert!(paths.contains(".uai/source-notes.uai"));
        assert_eq!(plan.required_file_count, 62);
        assert_eq!(plan.file_deck.total_required_files, 62);
        assert_eq!(plan.file_deck.universal_required_files, 7);
        assert_eq!(plan.file_deck.profile_required_files, 11);
        assert_eq!(plan.file_deck.configuration_specific_required_files, 10);
        assert_eq!(plan.file_deck.content_triggered_required_files, 10);
        assert_eq!(plan.file_deck.advanced_persona_required_files, 24);
        assert_eq!(plan.file_deck.persona_dimension_files, 22);
        assert_eq!(plan.file_deck.triggered_persona_style_axis_files, 4);
        assert_eq!(plan.file_deck.evidence_files, 5);
        assert_eq!(plan.file_deck.export_files, 6);
        assert!(plan.file_deck.includes_manifest_overlay);
        assert!(plan.file_deck.includes_package_model);
        assert!(plan.file_deck.includes_knowledge_graph);
        assert!(plan.file_deck.includes_llms_exports);
        assert!(plan.file_deck.includes_persona_source_evidence);
    }

    #[test]
    fn advanced_persona_package_inspects_dimension_evidence_markers() {
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-memory-persona-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));
        let request = UaixMemoryPackageRequest {
            setup: UaixMemorySetup::AdvancedPersonaProfile,
            code_like_artifacts: true,
            deployment: true,
            communication_style: true,
            source_notes: true,
            ..UaixMemoryPackageRequest::default()
        };
        let plan = memory_required_files(&request).expect("plan");
        let dimension_paths = advanced_persona_dimension_specs(&request.advanced_persona)
            .into_iter()
            .map(|(_, path)| path)
            .collect::<BTreeSet<_>>();
        for file in &plan.required_files {
            let path = root.join(file.path.replace('/', std::path::MAIN_SEPARATOR_STR));
            fs::create_dir_all(path.parent().expect("parent")).expect("create parent");
            let content = if dimension_paths.contains(file.path.as_str()) {
                format!(
                    "{}\ndepth_level_0_to_10: 7\ndisclosure_boundary: reviewed\nsource_confidence: high\nnon-inference rules: do not infer beyond reviewed source\n",
                    file.path
                )
            } else {
                format!("required {}", file.path)
            };
            fs::write(&path, content).expect("write required");
        }
        let manifest = serde_json::json!({
            "kind": "uaix.memory.manifest.v0",
            "setup_mode": "advanced_persona_profile",
            "files": plan
                .required_files
                .iter()
                .map(|file| serde_json::json!({ "path": file.path }))
                .collect::<Vec<_>>()
        });
        fs::write(
            root.join(".uai/manifest.uaix.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest"),
        )
        .expect("write manifest");

        let inspection = inspect_memory_package_path(&root, &request).expect("inspection");
        assert!(inspection.valid);
        assert!(inspection.required_files.iter().any(|file| {
            file.path == "reports/deployment-memory-and-test-report.uai" && file.exists
        }));
        assert!(inspection.missing_required_files.is_empty());
        assert!(inspection.manifest_missing_required_files.is_empty());
        assert_eq!(
            inspection.file_deck.total_required_files,
            plan.required_file_count
        );
        assert!(inspection.file_deck.includes_persona_source_evidence);
        assert!(inspection.persona_dimensions_valid);
        assert_eq!(inspection.persona_dimension_warning_count, 0);
        assert!(inspection
            .persona_dimensions
            .iter()
            .all(|dimension| dimension.depth_level_0_to_10 == Some(7)));

        fs::write(
            root.join(".uai/personality/religion-worldview.uai"),
            "depth_level_0_to_10: 7\ndisclosure_boundary: reviewed\nsource_confidence: high\n",
        )
        .expect("drift dimension");
        let drifted = inspect_memory_package_path(&root, &request).expect("drifted inspection");
        assert!(!drifted.valid);
        assert!(!drifted.persona_dimensions_valid);
        assert!(drifted.persona_dimension_warning_count > 0);
        let religion = drifted
            .persona_dimensions
            .iter()
            .find(|dimension| dimension.path == ".uai/personality/religion-worldview.uai")
            .expect("religion dimension");
        assert!(!religion.valid);
        assert!(!religion.declares_non_inference_rules);
        assert!(religion
            .warnings
            .iter()
            .any(|warning| warning.contains("non-inference")));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn wizard_setup_modes_include_multi_agent_and_talisman_records() {
        let catalog = supported_memory_setups();
        assert_eq!(catalog.kind, MEMORY_SETUP_CATALOG_KIND);
        assert_eq!(catalog.setup_count, 7);
        let setup_names = catalog
            .setups
            .iter()
            .map(|descriptor| descriptor.setup)
            .collect::<BTreeSet<_>>();
        for setup in [
            UaixMemorySetup::Base,
            UaixMemorySetup::AgentFileHandoff,
            UaixMemorySetup::LlmWiki,
            UaixMemorySetup::FileHandoffLlmWiki,
            UaixMemorySetup::MultiAgentCommunication,
            UaixMemorySetup::TalismanSystem,
            UaixMemorySetup::AdvancedPersonaProfile,
        ] {
            assert!(setup_names.contains(&setup));
        }
        assert!(catalog
            .setups
            .iter()
            .all(|descriptor| !descriptor.excluded_private_capabilities.is_empty()));
        let base = catalog
            .setups
            .iter()
            .find(|descriptor| descriptor.setup == UaixMemorySetup::Base)
            .expect("base setup descriptor");
        for feature in [
            "ai_digest_script_data_ai_digest",
            "point_agent_urls",
            "local_browser_draft_restore",
            "prompt_nudges",
            "safe_structured_output_mode",
            "review_export_checks",
            "agent_use_blocks_codex_claude_gpt",
            "raw_session_log",
            "family_aware_required_files",
            "dtmi_policy",
            "manifest_json",
            "canonical_starter_zip_downloads",
            "package_model_json",
            "knowledge_graph_json",
        ] {
            assert!(base.package_features.iter().any(|item| item == feature));
        }
        let advanced_persona = catalog
            .setups
            .iter()
            .find(|descriptor| descriptor.setup == UaixMemorySetup::AdvancedPersonaProfile)
            .expect("advanced persona descriptor");
        for feature in [
            "uaix_zip_txt_template_decks",
            "source_persona_preservation_rule",
            "depth_level_0_to_10_dimension_evidence",
            "disclosure_boundary_evidence",
            "source_confidence_evidence",
            "non_inference_rules",
            "triggered_style_axes",
        ] {
            assert!(advanced_persona
                .package_features
                .iter()
                .any(|item| item == feature));
        }
        assert!(catalog
            .source_urls
            .iter()
            .any(|url| url.contains("ai-memory-package-wizard")));

        let multi_agent = memory_required_files(&UaixMemoryPackageRequest {
            setup: UaixMemorySetup::MultiAgentCommunication,
            ..UaixMemoryPackageRequest::default()
        })
        .expect("multi-agent plan");
        let multi_agent_paths = multi_agent
            .required_files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<BTreeSet<_>>();
        assert!(multi_agent_paths.contains(".uai/agent-instructions.uai"));
        assert!(multi_agent_paths.contains(".uai/current-state.uai"));
        assert!(multi_agent_paths.contains(".uai/next-actions.uai"));
        assert!(multi_agent_paths.contains(".uai/risk-register.uai"));
        assert!(multi_agent
            .source_urls
            .iter()
            .any(|url| url.contains("agent-communication")));
        assert!(multi_agent.boundary.uses_tinyrustlm_runtime_harness);

        let talisman = memory_required_files(&UaixMemoryPackageRequest {
            setup: UaixMemorySetup::TalismanSystem,
            ..UaixMemoryPackageRequest::default()
        })
        .expect("talisman plan");
        let talisman_paths = talisman
            .required_files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<BTreeSet<_>>();
        assert!(talisman_paths.contains(".uai/totem.uai"));
        assert!(talisman_paths.contains(".uai/taboo.uai"));
        assert!(talisman_paths.contains(".uai/talisman.uai"));
        assert!(talisman_paths.contains(".uai/owners.uai"));
        assert!(talisman_paths.contains("reports/deployment-memory-and-test-report.uai"));
        assert!(talisman
            .source_urls
            .iter()
            .any(|url| url.contains("talisman-system")));
        assert!(!talisman.boundary.automatic_repository_writes);
        assert!(!talisman.boundary.hosted_import_validation);

        let content_triggered = memory_required_files(&UaixMemoryPackageRequest {
            contact_memory: true,
            calendar_scheduling: true,
            communication_style: true,
            tasks_commitments: true,
            routines_preferences: true,
            safety_support_boundaries: true,
            public_facing_boundaries: true,
            deployment: true,
            ..UaixMemoryPackageRequest::default()
        })
        .expect("content-triggered plan");
        let content_paths = content_triggered
            .required_files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<BTreeSet<_>>();
        assert!(content_paths.contains(".uai/contact-memory.uai"));
        assert!(content_paths.contains(".uai/calendar-and-scheduling.uai"));
        assert!(content_paths.contains(".uai/communication-style.uai"));
        assert!(content_paths.contains(".uai/tasks-and-commitments.uai"));
        assert!(content_paths.contains(".uai/routines-and-preferences.uai"));
        assert!(content_paths.contains(".uai/safety-and-support-boundary.uai"));
        assert!(content_paths.contains(".uai/public-facing-boundary.uai"));
        assert!(content_paths.contains("reports/deployment-memory-and-test-report.uai"));
    }

    #[test]
    fn manifest_inspection_detects_advanced_persona_profile() {
        let manifest = r#"{
            "kind":"uaix.memory.manifest.v0",
            "setup_mode":"advanced_persona_profile",
            "files":[{"path":".uai/persona.uai"}]
        }"#;
        let inspection = inspect_memory_manifest_text(manifest).expect("inspection");
        assert!(inspection.valid);
        assert!(inspection.advanced_persona_profile);
        assert_eq!(inspection.declared_file_count, 1);
        assert_eq!(
            inspection.declared_file_paths,
            vec![".uai/persona.uai".to_string()]
        );
        assert_eq!(
            inspection.declared_setup.as_deref(),
            Some("advanced_persona_profile")
        );
    }

    #[test]
    fn directory_inspection_reports_missing_required_files() {
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-memory-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".uai")).expect("create");
        fs::write(root.join(".uai/memory-maintenance.uai"), "current").expect("write");
        let inspection = inspect_memory_package_path(
            &root,
            &UaixMemoryPackageRequest {
                setup: UaixMemorySetup::Base,
                ..UaixMemoryPackageRequest::default()
            },
        )
        .expect("inspection");
        assert!(!inspection.valid);
        assert!(inspection
            .missing_required_files
            .iter()
            .any(|path| path == ".uai/identity.uai"));
        assert!(inspection
            .manifest_missing_required_files
            .iter()
            .any(|path| path == ".uai/identity.uai"));
        assert!(!inspection.manifest_declares_required_files);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn package_validation_requires_manifest_to_declare_required_files() {
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-memory-manifest-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));
        let request = UaixMemoryPackageRequest::default();
        let plan = memory_required_files(&request).expect("plan");
        for file in &plan.required_files {
            let path = root.join(file.path.replace('/', std::path::MAIN_SEPARATOR_STR));
            fs::create_dir_all(path.parent().expect("parent")).expect("create parent");
            fs::write(&path, format!("required {}", file.path)).expect("write required");
        }
        let manifest_path = root.join(".uai/manifest.uaix.json");
        let declared = plan
            .required_files
            .iter()
            .filter(|file| file.path != ".uai/identity.uai")
            .map(|file| serde_json::json!({ "path": file.path }))
            .collect::<Vec<_>>();
        let partial_manifest = serde_json::json!({
            "kind": "uaix.memory.manifest.v0",
            "setup_mode": "base",
            "files": declared
        });
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&partial_manifest).expect("manifest"),
        )
        .expect("write manifest");

        let inspection = inspect_memory_package_path(&root, &request).expect("inspection");
        assert!(inspection.missing_required_files.is_empty());
        assert!(!inspection.valid);
        assert!(!inspection.manifest_declares_required_files);
        assert_eq!(
            inspection.manifest_missing_required_files,
            vec![".uai/identity.uai".to_string()]
        );

        let complete_manifest = serde_json::json!({
            "kind": "uaix.memory.manifest.v0",
            "setup_mode": "base",
            "files": plan
                .required_files
                .iter()
                .map(|file| serde_json::json!({ "path": file.path }))
                .collect::<Vec<_>>()
        });
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&complete_manifest).expect("manifest"),
        )
        .expect("write manifest");

        let inspection = inspect_memory_package_path(&root, &request).expect("inspection");
        assert!(inspection.manifest_declares_required_files);
        assert!(inspection.manifest_missing_required_files.is_empty());
        assert!(inspection.valid);
        let _ = fs::remove_dir_all(root);
    }
}
