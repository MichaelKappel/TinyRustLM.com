#![forbid(unsafe_code)]
#![doc = "Typed Local Connect approval policy validation for TinyRustLM."]

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// The browser policy kind accepted by the Local Connect endpoint gate.
pub const POLICY_KIND: &str = "tinyrustlm.local_connect_approval_policy.v0";

/// The current Local Connect approval policy schema version.
pub const POLICY_VERSION: u64 = 2;

const MAX_APPROVED_APPS: usize = 40;
const MAX_APPROVED_APP_CHARS: usize = 96;

/// All Local Connect app-control categories in UI display order.
pub const ALL_CATEGORIES: &[Category] = &[
    Category::Browser,
    Category::Email,
    Category::Documents,
    Category::Files,
    Category::Terminal,
    Category::Secrets,
];

/// Local Connect approval mode selected by the user.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApprovalMode {
    /// Prompt for each local app-control request unless a category is blocked.
    Ask,
    /// Allow only selected categories or named approved apps without prompting.
    Selected,
    /// Allow local control by default on a deliberately non-sensitive machine.
    Full,
}

impl ApprovalMode {
    fn parse(value: &str) -> Result<Self, PolicyError> {
        match value {
            "ask" => Ok(Self::Ask),
            "selected" => Ok(Self::Selected),
            "full" => Ok(Self::Full),
            _ => Err(PolicyError::new(format!("unknown approval_mode '{value}'"))),
        }
    }

    /// Returns the stable policy string for this approval mode.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ask => "ask",
            Self::Selected => "selected",
            Self::Full => "full",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Ask => "Ask every time",
            Self::Selected => "Always approve selected",
            Self::Full => "Full local-control lab mode",
        }
    }
}

/// Local Connect category-level approval rule.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApprovalLevel {
    /// Prompt before permitting a request in this category.
    Ask,
    /// Permit this category without prompting.
    Always,
    /// Block this category even when broader modes would otherwise allow it.
    Deny,
}

impl ApprovalLevel {
    fn parse(value: &str) -> Result<Self, PolicyError> {
        match value {
            "ask" => Ok(Self::Ask),
            "always" => Ok(Self::Always),
            "deny" => Ok(Self::Deny),
            _ => Err(PolicyError::new(format!(
                "unknown category approval level '{value}'"
            ))),
        }
    }

    /// Returns the stable policy string for this approval level.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ask => "ask",
            Self::Always => "always",
            Self::Deny => "deny",
        }
    }
}

/// Local Connect app category.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum Category {
    /// Browser app control.
    Browser,
    /// Email app control.
    Email,
    /// Document and office-suite app control.
    Documents,
    /// File and folder management.
    Files,
    /// Terminal and script execution.
    Terminal,
    /// Password, payment, account, and security settings.
    Secrets,
}

impl Category {
    /// Parses a stable category identifier.
    pub fn parse(value: &str) -> Result<Self, PolicyError> {
        category_spec_by_id(value)
            .map(|spec| spec.category)
            .ok_or_else(|| PolicyError::new(format!("unknown category '{value}'")))
    }

    /// Returns the stable category identifier.
    pub fn as_str(self) -> &'static str {
        category_spec(self).id
    }

    /// Returns the category label shown to users.
    pub fn label(self) -> &'static str {
        category_spec(self).label
    }

    /// Returns the category risk level shown to users.
    pub fn risk(self) -> &'static str {
        category_spec(self).risk
    }

    /// Returns the category risk warning shown to users.
    pub fn warning(self) -> &'static str {
        category_spec(self).warning
    }
}

#[derive(Clone, Copy)]
struct CategorySpec {
    category: Category,
    id: &'static str,
    label: &'static str,
    risk: &'static str,
    warning: &'static str,
}

const CATEGORY_SPECS: &[CategorySpec] = &[
    CategorySpec {
        category: Category::Browser,
        id: "browser",
        label: "Browsers",
        risk: "medium",
        warning:
            "Can read pages, submit forms, download files, and act inside signed-in browser sessions.",
    },
    CategorySpec {
        category: Category::Email,
        id: "email",
        label: "Email apps",
        risk: "high",
        warning: "Can read, send, delete, or forward messages and attachments.",
    },
    CategorySpec {
        category: Category::Documents,
        id: "documents",
        label: "Docs and office",
        risk: "medium",
        warning: "Can edit documents, spreadsheets, and local business records.",
    },
    CategorySpec {
        category: Category::Files,
        id: "files",
        label: "Files and folders",
        risk: "high",
        warning: "Can move, overwrite, upload, or delete local files.",
    },
    CategorySpec {
        category: Category::Terminal,
        id: "terminal",
        label: "Terminal and scripts",
        risk: "critical",
        warning: "Can execute commands, install software, and change system state.",
    },
    CategorySpec {
        category: Category::Secrets,
        id: "secrets",
        label: "Passwords, payments, settings",
        risk: "critical",
        warning: "Can affect credentials, accounts, money movement, and security settings.",
    },
];

/// Validated Local Connect approval policy.
#[derive(Debug, Eq, PartialEq)]
pub struct ApprovalPolicy {
    mode: ApprovalMode,
    full_control_non_sensitive_machine_acknowledged: bool,
    category_rules: BTreeMap<Category, ApprovalLevel>,
    approved_apps: Vec<String>,
    approved_app_bindings: Vec<ApprovedAppBinding>,
}

impl ApprovalPolicy {
    /// Returns the user's selected approval mode.
    pub fn mode(&self) -> ApprovalMode {
        self.mode
    }

    /// Reports whether full local-control lab mode is active.
    pub fn full_local_control(&self) -> bool {
        self.mode == ApprovalMode::Full
    }

    /// Reports whether the user acknowledged that full control is for a non-sensitive local machine.
    pub fn full_control_non_sensitive_machine_acknowledged(&self) -> bool {
        self.full_control_non_sensitive_machine_acknowledged
    }

    /// Returns the category rule for a Local Connect category.
    pub fn category_level(&self, category: Category) -> ApprovalLevel {
        self.category_rules
            .get(&category)
            .copied()
            .unwrap_or(ApprovalLevel::Ask)
    }

    /// Returns approved app display or executable names.
    pub fn approved_apps(&self) -> &[String] {
        &self.approved_apps
    }

    /// Returns category-bound approved app rules.
    pub fn approved_app_bindings(&self) -> &[ApprovedAppBinding] {
        &self.approved_app_bindings
    }

    /// Returns the approved category for an app, when the policy binds it explicitly.
    pub fn approved_app_category(&self, app: &str) -> Option<Category> {
        self.approved_app_bindings
            .iter()
            .find(|binding| binding.app().eq_ignore_ascii_case(app))
            .map(ApprovedAppBinding::category)
    }

    /// Renders the canonical browser policy JSON used for endpoint identity checks.
    pub fn canonical_json(&self) -> String {
        let mut text = serde_json::to_string_pretty(&self.canonical_snapshot())
            .expect("canonical policy serialization should not fail");
        text.push('\n');
        text
    }

    /// Returns the SHA-256 digest of the canonical browser policy JSON.
    pub fn policy_sha256(&self) -> String {
        sha256_text(&self.canonical_json())
    }

    /// Renders a stable key-value inspection report for shell scripts.
    pub fn render_inspection_report(&self) -> String {
        let mut lines = vec![
            "policy.status=validated".to_string(),
            format!("policy.kind={POLICY_KIND}"),
            format!("policy.version={POLICY_VERSION}"),
            format!("policy.sha256={}", self.policy_sha256()),
            format!("approval.mode={}", self.mode.as_str()),
            format!(
                "full_local_control={}",
                bool_value(self.full_local_control())
            ),
            format!(
                "full_control_non_sensitive_machine_acknowledged={}",
                bool_value(self.full_control_non_sensitive_machine_acknowledged())
            ),
            format!("approved_apps.count={}", self.approved_apps.len()),
        ];
        for spec in CATEGORY_SPECS {
            lines.push(format!(
                "category.{}={}",
                spec.id,
                self.category_level(spec.category).as_str()
            ));
        }
        for (index, app) in self.approved_apps.iter().enumerate() {
            lines.push(format!("approved_apps.{index}={app}"));
        }
        for (index, binding) in self.approved_app_bindings.iter().enumerate() {
            lines.push(format!(
                "approved_app_bindings.{index}.app={}",
                binding.app()
            ));
            lines.push(format!(
                "approved_app_bindings.{index}.category={}",
                binding.category().as_str()
            ));
        }
        lines.join("\n")
    }

    fn has_approved_app_for_category(&self, app: &str, category: Category) -> bool {
        self.approved_app_bindings.iter().any(|binding| {
            binding.app().eq_ignore_ascii_case(app) && binding.category() == category
        })
    }

    fn canonical_snapshot(&self) -> CanonicalPolicy<'_> {
        CanonicalPolicy {
            policy_kind: POLICY_KIND,
            policy_version: POLICY_VERSION,
            approval_mode: self.mode.as_str(),
            approval_mode_label: self.mode.label(),
            full_local_control: self.full_local_control(),
            full_control_non_sensitive_machine_acknowledged: self
                .full_control_non_sensitive_machine_acknowledged(),
            browser_local_storage_only: true,
            project_server_receives_policy: false,
            local_endpoint_must_enforce_policy: true,
            category_approval: CanonicalCategoryApproval {
                browser: self.category_level(Category::Browser).as_str(),
                email: self.category_level(Category::Email).as_str(),
                documents: self.category_level(Category::Documents).as_str(),
                files: self.category_level(Category::Files).as_str(),
                terminal: self.category_level(Category::Terminal).as_str(),
                secrets: self.category_level(Category::Secrets).as_str(),
            },
            approved_apps: &self.approved_apps,
            approved_app_bindings: self
                .approved_app_bindings
                .iter()
                .map(CanonicalApprovedAppBinding::from_binding)
                .collect(),
            risk_warnings: ALL_CATEGORIES
                .iter()
                .map(|category| CanonicalRiskWarning {
                    category: category.as_str(),
                    label: category.label(),
                    risk: category.risk(),
                    warning: category.warning(),
                    approval: self.category_level(*category).as_str(),
                })
                .collect(),
        }
    }
}

#[derive(Serialize)]
struct CanonicalPolicy<'a> {
    policy_kind: &'static str,
    policy_version: u64,
    approval_mode: &'static str,
    approval_mode_label: &'static str,
    full_local_control: bool,
    full_control_non_sensitive_machine_acknowledged: bool,
    browser_local_storage_only: bool,
    project_server_receives_policy: bool,
    local_endpoint_must_enforce_policy: bool,
    category_approval: CanonicalCategoryApproval,
    approved_apps: &'a [String],
    approved_app_bindings: Vec<CanonicalApprovedAppBinding<'a>>,
    risk_warnings: Vec<CanonicalRiskWarning>,
}

/// Category-bound approved app rule.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovedAppBinding {
    app: String,
    category: Category,
}

impl ApprovedAppBinding {
    /// Returns the approved app display or executable name.
    pub fn app(&self) -> &str {
        &self.app
    }

    /// Returns the only Local Connect category this app approval can authorize.
    pub fn category(&self) -> Category {
        self.category
    }
}

#[derive(Serialize)]
struct CanonicalApprovedAppBinding<'a> {
    app: &'a str,
    category: &'static str,
    category_label: &'static str,
    risk: &'static str,
    warning: &'static str,
    approval: &'static str,
}

impl<'a> CanonicalApprovedAppBinding<'a> {
    fn from_binding(binding: &'a ApprovedAppBinding) -> Self {
        let category = binding.category();
        Self {
            app: binding.app(),
            category: category.as_str(),
            category_label: category.label(),
            risk: category.risk(),
            warning: category.warning(),
            approval: "always",
        }
    }
}

#[derive(Serialize)]
struct CanonicalCategoryApproval {
    browser: &'static str,
    email: &'static str,
    documents: &'static str,
    files: &'static str,
    terminal: &'static str,
    secrets: &'static str,
}

#[derive(Serialize)]
struct CanonicalRiskWarning {
    category: &'static str,
    label: &'static str,
    risk: &'static str,
    warning: &'static str,
    approval: &'static str,
}

/// Local Connect decision for a requested app-control action.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision {
    /// Allow the request without another user prompt.
    Allow,
    /// Ask the user before permitting the request.
    Ask,
    /// Block the request.
    Deny,
}

impl Decision {
    /// Returns the stable decision string.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Allow => "allow",
            Self::Ask => "ask",
            Self::Deny => "deny",
        }
    }
}

/// Result of evaluating a Local Connect app-control request.
#[derive(Debug, Eq, PartialEq)]
pub struct DecisionReport {
    decision: Decision,
    reason: &'static str,
    category: Category,
    app: Option<String>,
    full_control_warning: bool,
}

impl DecisionReport {
    /// Returns the computed decision.
    pub fn decision(&self) -> Decision {
        self.decision
    }

    /// Returns the stable reason code for the decision.
    pub fn reason(&self) -> &'static str {
        self.reason
    }

    /// Returns the requested app-control category.
    pub fn category(&self) -> Category {
        self.category
    }

    /// Returns the requested app display or executable name when supplied.
    pub fn app(&self) -> Option<&str> {
        self.app.as_deref()
    }

    /// Reports whether the decision was allowed by full local-control mode.
    pub fn full_control_warning(&self) -> bool {
        self.full_control_warning
    }

    /// Renders a stable key-value decision report for shell scripts.
    pub fn render_key_values(&self) -> String {
        let mut lines = vec![
            "policy.status=validated".to_string(),
            format!("decision={}", self.decision.as_str()),
            format!("reason={}", self.reason),
            format!("category={}", self.category.as_str()),
            format!(
                "full_control_warning={}",
                bool_value(self.full_control_warning)
            ),
        ];
        if let Some(app) = &self.app {
            lines.push(format!("app={app}"));
        } else {
            lines.push("app=".to_string());
        }
        lines.join("\n")
    }
}

/// Error returned when a Local Connect policy cannot be trusted.
#[derive(Debug, Eq, PartialEq)]
pub struct PolicyError {
    message: String,
}

impl PolicyError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for PolicyError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for PolicyError {}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawApprovalPolicy {
    policy_kind: String,
    policy_version: u64,
    approval_mode: String,
    approval_mode_label: String,
    full_local_control: bool,
    #[serde(default)]
    full_control_non_sensitive_machine_acknowledged: bool,
    browser_local_storage_only: bool,
    project_server_receives_policy: bool,
    local_endpoint_must_enforce_policy: bool,
    category_approval: BTreeMap<String, String>,
    approved_apps: Vec<String>,
    approved_app_bindings: Vec<RawApprovedAppBinding>,
    risk_warnings: Vec<RawRiskWarning>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawApprovedAppBinding {
    app: String,
    category: String,
    category_label: String,
    risk: String,
    warning: String,
    approval: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawRiskWarning {
    category: String,
    label: String,
    risk: String,
    warning: String,
    approval: String,
}

/// Parses and validates a browser-exported Local Connect approval policy.
pub fn validate_policy_json(text: &str) -> Result<ApprovalPolicy, PolicyError> {
    let raw: RawApprovalPolicy =
        serde_json::from_str(text).map_err(|source| PolicyError::new(source.to_string()))?;
    validate_raw_policy(raw)
}

/// Computes the endpoint gate decision for a category and optional app name.
pub fn decide_approval(
    policy: &ApprovalPolicy,
    category: Category,
    app: Option<&str>,
) -> Result<DecisionReport, PolicyError> {
    let app = app
        .map(validate_app_name)
        .transpose()?
        .map(ToString::to_string);
    let level = policy.category_level(category);
    if level == ApprovalLevel::Deny {
        return Ok(DecisionReport {
            decision: Decision::Deny,
            reason: "category-denied",
            category,
            app,
            full_control_warning: false,
        });
    }

    if policy.full_local_control() {
        return Ok(DecisionReport {
            decision: Decision::Allow,
            reason: "full-local-control",
            category,
            app,
            full_control_warning: true,
        });
    }

    if level == ApprovalLevel::Always {
        return Ok(DecisionReport {
            decision: Decision::Allow,
            reason: "category-always-approved",
            category,
            app,
            full_control_warning: false,
        });
    }

    if let Some(app_name) = app.as_deref() {
        if policy.has_approved_app_for_category(app_name, category) {
            return Ok(DecisionReport {
                decision: Decision::Allow,
                reason: "app-approved",
                category,
                app,
                full_control_warning: false,
            });
        }
    }

    Ok(DecisionReport {
        decision: Decision::Ask,
        reason: match policy.mode() {
            ApprovalMode::Ask => "ask-mode",
            ApprovalMode::Selected => "not-selected",
            ApprovalMode::Full => "full-local-control",
        },
        category,
        app,
        full_control_warning: false,
    })
}

fn validate_raw_policy(raw: RawApprovalPolicy) -> Result<ApprovalPolicy, PolicyError> {
    if raw.policy_kind != POLICY_KIND {
        return Err(PolicyError::new(format!(
            "policy_kind must be '{POLICY_KIND}', got '{}'",
            raw.policy_kind
        )));
    }
    if raw.policy_version != POLICY_VERSION {
        return Err(PolicyError::new(format!(
            "policy_version must be {POLICY_VERSION}, got {}",
            raw.policy_version
        )));
    }

    let mode = ApprovalMode::parse(&raw.approval_mode)?;
    if raw.approval_mode_label != mode.label() {
        return Err(PolicyError::new(format!(
            "approval_mode_label must be '{}' for mode '{}'",
            mode.label(),
            mode.as_str()
        )));
    }
    if raw.full_local_control != (mode == ApprovalMode::Full) {
        return Err(PolicyError::new(
            "full_local_control must match approval_mode".to_string(),
        ));
    }
    if mode == ApprovalMode::Full && !raw.full_control_non_sensitive_machine_acknowledged {
        return Err(PolicyError::new(
            "full_control_non_sensitive_machine_acknowledged must be true for full mode"
                .to_string(),
        ));
    }
    if mode != ApprovalMode::Full && raw.full_control_non_sensitive_machine_acknowledged {
        return Err(PolicyError::new(
            "full_control_non_sensitive_machine_acknowledged must be false outside full mode"
                .to_string(),
        ));
    }
    if !raw.browser_local_storage_only {
        return Err(PolicyError::new(
            "browser_local_storage_only must be true".to_string(),
        ));
    }
    if raw.project_server_receives_policy {
        return Err(PolicyError::new(
            "project_server_receives_policy must be false".to_string(),
        ));
    }
    if !raw.local_endpoint_must_enforce_policy {
        return Err(PolicyError::new(
            "local_endpoint_must_enforce_policy must be true".to_string(),
        ));
    }

    let category_rules = validate_category_rules(&raw.category_approval)?;
    validate_risk_warnings(&raw.risk_warnings, &category_rules)?;
    let approved_apps = validate_approved_apps(raw.approved_apps)?;
    let approved_app_bindings =
        validate_approved_app_bindings(&approved_apps, raw.approved_app_bindings)?;

    if mode == ApprovalMode::Ask
        && (!approved_apps.is_empty()
            || !approved_app_bindings.is_empty()
            || category_rules
                .values()
                .any(|level| *level == ApprovalLevel::Always))
    {
        return Err(PolicyError::new(
            "ask mode cannot include always approvals or approved apps".to_string(),
        ));
    }

    Ok(ApprovalPolicy {
        mode,
        full_control_non_sensitive_machine_acknowledged: raw
            .full_control_non_sensitive_machine_acknowledged,
        category_rules,
        approved_apps,
        approved_app_bindings,
    })
}

fn validate_category_rules(
    raw_rules: &BTreeMap<String, String>,
) -> Result<BTreeMap<Category, ApprovalLevel>, PolicyError> {
    let expected: BTreeSet<&str> = CATEGORY_SPECS.iter().map(|spec| spec.id).collect();
    let actual: BTreeSet<&str> = raw_rules.keys().map(String::as_str).collect();
    if actual != expected {
        let missing = expected
            .difference(&actual)
            .copied()
            .collect::<Vec<_>>()
            .join(",");
        let extra = actual
            .difference(&expected)
            .copied()
            .collect::<Vec<_>>()
            .join(",");
        return Err(PolicyError::new(format!(
            "category_approval keys mismatch; missing=[{missing}] extra=[{extra}]"
        )));
    }

    let mut rules = BTreeMap::new();
    for spec in CATEGORY_SPECS {
        let raw_level = raw_rules
            .get(spec.id)
            .ok_or_else(|| PolicyError::new(format!("category_approval missing '{}'", spec.id)))?;
        rules.insert(spec.category, ApprovalLevel::parse(raw_level)?);
    }
    Ok(rules)
}

fn validate_risk_warnings(
    raw_warnings: &[RawRiskWarning],
    category_rules: &BTreeMap<Category, ApprovalLevel>,
) -> Result<(), PolicyError> {
    if raw_warnings.len() != CATEGORY_SPECS.len() {
        return Err(PolicyError::new(format!(
            "risk_warnings must contain {} entries",
            CATEGORY_SPECS.len()
        )));
    }
    let mut seen = BTreeSet::new();
    for warning in raw_warnings {
        let spec = category_spec_by_id(&warning.category).ok_or_else(|| {
            PolicyError::new(format!(
                "unknown risk warning category '{}'",
                warning.category
            ))
        })?;
        if !seen.insert(spec.category) {
            return Err(PolicyError::new(format!(
                "duplicate risk warning category '{}'",
                spec.id
            )));
        }
        require_field("risk_warnings.label", spec.label, &warning.label)?;
        require_field("risk_warnings.risk", spec.risk, &warning.risk)?;
        require_field("risk_warnings.warning", spec.warning, &warning.warning)?;
        let expected_approval = category_rules
            .get(&spec.category)
            .copied()
            .unwrap_or(ApprovalLevel::Ask)
            .as_str();
        require_field(
            "risk_warnings.approval",
            expected_approval,
            &warning.approval,
        )?;
    }
    Ok(())
}

fn validate_approved_apps(raw_apps: Vec<String>) -> Result<Vec<String>, PolicyError> {
    if raw_apps.len() > MAX_APPROVED_APPS {
        return Err(PolicyError::new(format!(
            "approved_apps cannot exceed {MAX_APPROVED_APPS} entries"
        )));
    }
    let mut seen = BTreeSet::new();
    let mut approved = Vec::with_capacity(raw_apps.len());
    for app in raw_apps {
        let validated = validate_app_name(&app)?;
        if validated != app {
            return Err(PolicyError::new(format!(
                "approved app '{app}' is not normalized"
            )));
        }
        let lowered = validated.to_ascii_lowercase();
        if !seen.insert(lowered) {
            return Err(PolicyError::new(format!(
                "duplicate approved app '{validated}'"
            )));
        }
        approved.push(validated.to_string());
    }
    Ok(approved)
}

fn validate_approved_app_bindings(
    approved_apps: &[String],
    raw_bindings: Vec<RawApprovedAppBinding>,
) -> Result<Vec<ApprovedAppBinding>, PolicyError> {
    if raw_bindings.len() != approved_apps.len() {
        return Err(PolicyError::new(format!(
            "approved_app_bindings must contain one entry for each approved app; expected {} got {}",
            approved_apps.len(),
            raw_bindings.len()
        )));
    }

    let mut seen = BTreeSet::new();
    let mut bindings = Vec::with_capacity(raw_bindings.len());
    for (index, raw) in raw_bindings.into_iter().enumerate() {
        let app = validate_app_name(&raw.app)?;
        if app != approved_apps[index] {
            return Err(PolicyError::new(format!(
                "approved_app_bindings[{index}].app must match approved_apps[{index}]"
            )));
        }
        let lowered = app.to_ascii_lowercase();
        if !seen.insert(lowered) {
            return Err(PolicyError::new(format!(
                "duplicate approved app binding '{app}'"
            )));
        }

        let category = Category::parse(&raw.category)?;
        if matches!(category, Category::Terminal | Category::Secrets) {
            return Err(PolicyError::new(format!(
                "approved app '{app}' cannot be always-approved for critical category '{}'",
                category.as_str()
            )));
        }
        if let Some(known_category) = known_app_category(app) {
            if known_category != category {
                return Err(PolicyError::new(format!(
                    "approved app '{app}' is known as category '{}' but binding uses '{}'",
                    known_category.as_str(),
                    category.as_str()
                )));
            }
        }
        require_field(
            "approved_app_bindings.category_label",
            category.label(),
            &raw.category_label,
        )?;
        require_field("approved_app_bindings.risk", category.risk(), &raw.risk)?;
        require_field(
            "approved_app_bindings.warning",
            category.warning(),
            &raw.warning,
        )?;
        require_field("approved_app_bindings.approval", "always", &raw.approval)?;
        bindings.push(ApprovedAppBinding {
            app: app.to_string(),
            category,
        });
    }
    Ok(bindings)
}

fn validate_app_name(value: &str) -> Result<&str, PolicyError> {
    if value.is_empty() {
        return Err(PolicyError::new("app name cannot be empty".to_string()));
    }
    if value.trim() != value || value.split_whitespace().collect::<Vec<_>>().join(" ") != value {
        return Err(PolicyError::new(format!(
            "app name '{value}' must be trimmed and single-spaced"
        )));
    }
    if value.chars().count() > MAX_APPROVED_APP_CHARS {
        return Err(PolicyError::new(format!(
            "app name '{value}' exceeds {MAX_APPROVED_APP_CHARS} characters"
        )));
    }
    if !value.chars().all(|ch| {
        !ch.is_control()
            && !matches!(
                ch,
                '\\' | '/'
                    | ':'
                    | '*'
                    | '?'
                    | '"'
                    | '\''
                    | '<'
                    | '>'
                    | '|'
                    | '&'
                    | ';'
                    | ','
                    | '`'
                    | '$'
            )
    }) {
        return Err(PolicyError::new(format!(
            "app name '{value}' must be a display or executable name, not a path or shell token"
        )));
    }
    Ok(value)
}

fn known_app_category(app: &str) -> Option<Category> {
    match app.trim().to_ascii_lowercase().as_str() {
        "chrome.exe" | "msedge.exe" | "firefox.exe" => Some(Category::Browser),
        "outlook.exe" | "thunderbird.exe" => Some(Category::Email),
        "winword.exe" | "excel.exe" => Some(Category::Documents),
        "explorer.exe" => Some(Category::Files),
        "powershell.exe" | "pwsh.exe" | "cmd.exe" => Some(Category::Terminal),
        "bitwarden.exe" | "1password.exe" => Some(Category::Secrets),
        _ => None,
    }
}

fn require_field(label: &str, expected: &str, actual: &str) -> Result<(), PolicyError> {
    if expected == actual {
        Ok(())
    } else {
        Err(PolicyError::new(format!(
            "{label} expected '{expected}' but got '{actual}'"
        )))
    }
}

fn category_spec(category: Category) -> &'static CategorySpec {
    CATEGORY_SPECS
        .iter()
        .find(|spec| spec.category == category)
        .expect("category spec")
}

fn category_spec_by_id(id: &str) -> Option<&'static CategorySpec> {
    CATEGORY_SPECS.iter().find(|spec| spec.id == id)
}

fn bool_value(value: bool) -> &'static str {
    if value {
        "true"
    } else {
        "false"
    }
}

fn sha256_text(text: &str) -> String {
    let digest = Sha256::digest(text.as_bytes());
    let mut value = String::with_capacity("sha256:".len() + digest.len() * 2);
    value.push_str("sha256:");
    for byte in digest {
        let _ = write!(&mut value, "{byte:02x}");
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_policy(mode: &str, browser_rule: &str, approved_apps: &[&str]) -> String {
        let label = match mode {
            "ask" => "Ask every time",
            "selected" => "Always approve selected",
            "full" => "Full local-control lab mode",
            _ => panic!("test mode"),
        };
        let full = mode == "full";
        let full_ack = mode == "full";
        let app_json = approved_apps
            .iter()
            .map(|app| format!(r#""{app}""#))
            .collect::<Vec<_>>()
            .join(",");
        let binding_json = approved_apps
            .iter()
            .map(|app| {
                let category = known_app_category(app).unwrap_or(Category::Files);
                format!(
                    r#"{{
      "app": {},
      "category": "{}",
      "category_label": "{}",
      "risk": "{}",
      "warning": {},
      "approval": "always"
    }}"#,
                    serde_json::to_string(app).expect("app JSON"),
                    category.as_str(),
                    category.label(),
                    category.risk(),
                    serde_json::to_string(category.warning()).expect("warning JSON")
                )
            })
            .collect::<Vec<_>>()
            .join(",\n    ");
        format!(
            r#"{{
  "policy_kind": "{POLICY_KIND}",
  "policy_version": {POLICY_VERSION},
  "approval_mode": "{mode}",
  "approval_mode_label": "{label}",
  "full_local_control": {full},
  "full_control_non_sensitive_machine_acknowledged": {full_ack},
  "browser_local_storage_only": true,
  "project_server_receives_policy": false,
  "local_endpoint_must_enforce_policy": true,
  "category_approval": {{
    "browser": "{browser_rule}",
    "email": "ask",
    "documents": "ask",
    "files": "ask",
    "terminal": "ask",
    "secrets": "ask"
  }},
  "approved_apps": [{app_json}],
  "approved_app_bindings": [{binding_json}],
  "risk_warnings": [
    {{
      "category": "browser",
      "label": "Browsers",
      "risk": "medium",
      "warning": "Can read pages, submit forms, download files, and act inside signed-in browser sessions.",
      "approval": "{browser_rule}"
    }},
    {{
      "category": "email",
      "label": "Email apps",
      "risk": "high",
      "warning": "Can read, send, delete, or forward messages and attachments.",
      "approval": "ask"
    }},
    {{
      "category": "documents",
      "label": "Docs and office",
      "risk": "medium",
      "warning": "Can edit documents, spreadsheets, and local business records.",
      "approval": "ask"
    }},
    {{
      "category": "files",
      "label": "Files and folders",
      "risk": "high",
      "warning": "Can move, overwrite, upload, or delete local files.",
      "approval": "ask"
    }},
    {{
      "category": "terminal",
      "label": "Terminal and scripts",
      "risk": "critical",
      "warning": "Can execute commands, install software, and change system state.",
      "approval": "ask"
    }},
    {{
      "category": "secrets",
      "label": "Passwords, payments, settings",
      "risk": "critical",
      "warning": "Can affect credentials, accounts, money movement, and security settings.",
      "approval": "ask"
    }}
  ]
}}"#
        )
    }

    #[test]
    fn validates_default_ask_policy() {
        let policy = validate_policy_json(&valid_policy("ask", "ask", &[])).expect("policy");

        assert_eq!(policy.mode(), ApprovalMode::Ask);
        assert_eq!(policy.category_level(Category::Browser), ApprovalLevel::Ask);
        assert!(!policy.full_local_control());
        assert!(!policy.full_control_non_sensitive_machine_acknowledged());
        assert!(policy.approved_apps().is_empty());
    }

    #[test]
    fn renders_canonical_policy_digest() {
        let policy = validate_policy_json(&valid_policy("selected", "always", &["Chrome.exe"]))
            .expect("policy");

        let canonical = policy.canonical_json();
        let digest = policy.policy_sha256();

        assert!(canonical.ends_with('\n'));
        assert!(canonical.contains(
            "\"category_approval\": {\n    \"browser\": \"always\",\n    \"email\": \"ask\","
        ));
        assert!(canonical.contains("\"approved_apps\": [\n    \"Chrome.exe\"\n  ]"));
        assert!(canonical.contains(
            "\"approved_app_bindings\": [\n    {\n      \"app\": \"Chrome.exe\",\n      \"category\": \"browser\","
        ));
        assert!(digest.starts_with("sha256:"));
        assert_eq!(digest.len(), "sha256:".len() + 64);
        assert_eq!(digest, sha256_text(&canonical));

        let changed = validate_policy_json(&valid_policy("selected", "always", &["outlook.exe"]))
            .expect("policy");
        assert_ne!(digest, changed.policy_sha256());
    }

    #[test]
    fn selected_browser_rule_allows_browser_without_prompt() {
        let policy =
            validate_policy_json(&valid_policy("selected", "always", &[])).expect("policy");

        let report =
            decide_approval(&policy, Category::Browser, Some("chrome.exe")).expect("decision");

        assert_eq!(report.decision(), Decision::Allow);
        assert!(report
            .render_key_values()
            .contains("reason=category-always-approved"));
    }

    #[test]
    fn approved_app_allows_matching_category_case_insensitively() {
        let policy = validate_policy_json(&valid_policy("selected", "ask", &["Chrome.exe"]))
            .expect("policy");

        let report =
            decide_approval(&policy, Category::Browser, Some("chrome.exe")).expect("decision");

        assert_eq!(report.decision(), Decision::Allow);
    }

    #[test]
    fn approved_app_does_not_cross_category_boundaries() {
        let policy = validate_policy_json(&valid_policy("selected", "ask", &["Chrome.exe"]))
            .expect("policy");

        let report =
            decide_approval(&policy, Category::Email, Some("chrome.exe")).expect("decision");

        assert_eq!(report.decision(), Decision::Ask);
        assert_eq!(report.reason(), "not-selected");
    }

    #[test]
    fn manual_unknown_approved_app_is_bound_to_files_by_default() {
        let policy = validate_policy_json(&valid_policy("selected", "ask", &["AcmeEditor.exe"]))
            .expect("policy");

        let file_report =
            decide_approval(&policy, Category::Files, Some("AcmeEditor.exe")).expect("decision");
        let document_report = decide_approval(&policy, Category::Documents, Some("AcmeEditor.exe"))
            .expect("decision");
        let email_report =
            decide_approval(&policy, Category::Email, Some("AcmeEditor.exe")).expect("decision");

        assert_eq!(file_report.decision(), Decision::Allow);
        assert_eq!(document_report.decision(), Decision::Ask);
        assert_eq!(email_report.decision(), Decision::Ask);
    }

    #[test]
    fn full_mode_allows_with_warning() {
        let policy = validate_policy_json(&valid_policy("full", "ask", &[])).expect("policy");

        let report =
            decide_approval(&policy, Category::Files, Some("Explorer.exe")).expect("decision");

        assert_eq!(report.decision(), Decision::Allow);
        assert!(report
            .render_key_values()
            .contains("full_control_warning=true"));
    }

    #[test]
    fn rejects_full_mode_without_non_sensitive_machine_acknowledgement() {
        let policy = valid_policy("full", "ask", &[]).replace(
            r#""full_control_non_sensitive_machine_acknowledged": true"#,
            r#""full_control_non_sensitive_machine_acknowledged": false"#,
        );

        let error = validate_policy_json(&policy).expect_err("full mode ack should be required");

        assert!(error
            .to_string()
            .contains("full_control_non_sensitive_machine_acknowledged"));
    }

    #[test]
    fn denied_category_overrides_full_mode() {
        let policy = valid_policy("full", "deny", &[]);
        let policy = validate_policy_json(&policy).expect("policy");

        let report =
            decide_approval(&policy, Category::Browser, Some("chrome.exe")).expect("decision");

        assert_eq!(report.decision(), Decision::Deny);
    }

    #[test]
    fn rejects_ask_mode_with_always_approval() {
        let error = validate_policy_json(&valid_policy("ask", "always", &[]))
            .expect_err("ask mode should reject always approval");

        assert!(error.to_string().contains("ask mode cannot include"));
    }

    #[test]
    fn rejects_unknown_category_rule() {
        let policy = valid_policy("ask", "ask", &[]).replace(
            r#""secrets": "ask""#,
            r#""secrets": "ask", "unknown": "ask""#,
        );

        let error = validate_policy_json(&policy).expect_err("unknown category");

        assert!(error
            .to_string()
            .contains("category_approval keys mismatch"));
    }

    #[test]
    fn rejects_path_like_approved_app() {
        let error = validate_policy_json(&valid_policy(
            "selected",
            "ask",
            &["Program Files/Browser/chrome.exe"],
        ))
        .expect_err("path should fail");

        assert!(error.to_string().contains("not a path"));
    }

    #[test]
    fn rejects_shell_like_approved_app() {
        let error =
            validate_policy_json(&valid_policy("selected", "ask", &["chrome.exe & mail.exe"]))
                .expect_err("shell token should fail");

        assert!(error.to_string().contains("shell token"));
    }

    #[test]
    fn rejects_duplicate_approved_app() {
        let error = validate_policy_json(&valid_policy(
            "selected",
            "ask",
            &["Chrome.exe", "chrome.exe"],
        ))
        .expect_err("duplicate app should fail");

        assert!(error.to_string().contains("duplicate approved app"));
    }

    #[test]
    fn rejects_approved_app_binding_category_drift() {
        let policy = valid_policy("selected", "ask", &["Chrome.exe"]).replacen(
            r#""category": "browser""#,
            r#""category": "email""#,
            1,
        );

        let error = validate_policy_json(&policy).expect_err("drifted binding should fail");

        assert!(error.to_string().contains("known as category 'browser'"));
    }

    #[test]
    fn rejects_critical_category_approved_app_binding() {
        let error = validate_policy_json(&valid_policy("selected", "ask", &["powershell.exe"]))
            .expect_err("critical app binding should fail");

        assert!(error.to_string().contains("critical category 'terminal'"));
    }
}
