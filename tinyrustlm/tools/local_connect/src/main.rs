#![forbid(unsafe_code)]
#![doc = "Command-line Local Connect policy gate for TinyRustLM."]

use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tinyrustlm_local_connect::{
    decide_approval, validate_policy_json, ApprovalPolicy, Category, PolicyError, ALL_CATEGORIES,
    POLICY_KIND, POLICY_VERSION,
};

const ENDPOINT_KIND: &str = "tinyrustlm.local_connect_endpoint.v0";
const ENDPOINT_VERSION: u64 = 1;
const DEFAULT_ENDPOINT_PORT: u16 = 8711;
const HEADER_READ_LIMIT: usize = 16 * 1024;
const BODY_READ_LIMIT: usize = 64 * 1024;
const ACTION_TARGET_LIMIT: usize = 2048;
const INVENTORY_EXTRA_SCAN_DEPTH: usize = 5;
const INVENTORY_EXTRA_SCAN_ENTRY_LIMIT: usize = 768;
const APP_INVENTORY_POLICY: &str = "bounded-name-discovery-no-paths-v1";
const APP_INVENTORY_PATH_EXPOSURE: &str = "never";
const APP_APPROVAL_BINDING_POLICY: &str = "app-and-category-v1";
const ACTION_EXECUTION_CONSENT_HEADER: &str = "x-tinyrustlm-execution-consent";
const ACTION_EXECUTION_CONSENT_VALUE: &str = "native-opener-v1";
const ACTION_EXECUTION_POLICY: &str = "typed-action-dry-run-default-execution-consent-v1";

fn main() -> ExitCode {
    match run(env::args().skip(1)) {
        Ok(report) => {
            println!("{report}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("tinyrustlm-local-connect: {error}");
            ExitCode::from(1)
        }
    }
}

fn run<I>(mut args: I) -> Result<String, CliError>
where
    I: Iterator<Item = String>,
{
    let Some(command) = args.next() else {
        return Err(CliError::Usage);
    };
    match command.as_str() {
        "inspect-approval-policy" => {
            let path = next_required(
                &mut args,
                "inspect-approval-policy requires a policy JSON path",
            )?;
            reject_extra(args)?;
            let policy = read_policy(Path::new(&path))?;
            Ok(policy.render_inspection_report())
        }
        "decide-approval" => {
            let path = next_required(&mut args, "decide-approval requires a policy JSON path")?;
            let category = next_required(&mut args, "decide-approval requires a category")?;
            let app = args.next();
            reject_extra(args)?;
            let policy = read_policy(Path::new(&path))?;
            let category = Category::parse(&category)?;
            let report = decide_approval(&policy, category, app.as_deref())?;
            Ok(report.render_key_values())
        }
        "serve-approval-endpoint" => {
            let path = next_required(
                &mut args,
                "serve-approval-endpoint requires a policy JSON path",
            )?;
            let port = parse_optional_port(args.next())?;
            reject_extra(args)?;
            serve_endpoint(PathBuf::from(path), port)?;
            Ok("endpoint stopped".to_string())
        }
        "execute-action" => {
            let policy_path =
                next_required(&mut args, "execute-action requires a policy JSON path")?;
            let action_path =
                next_required(&mut args, "execute-action requires an action JSON path")?;
            reject_extra(args)?;
            let policy = read_policy(Path::new(&policy_path))?;
            let text = fs::read_to_string(Path::new(&action_path)).map_err(|source| {
                CliError::InvalidInput(format!("failed to read {action_path}: {source}"))
            })?;
            let response = action_response(&policy, text.as_bytes(), ActionHttpGate::Cli)?;
            Ok(response.render_key_values())
        }
        "--help" | "-h" => Ok(usage()),
        value => Err(CliError::InvalidInput(format!("unknown command '{value}'"))),
    }
}

fn read_policy(path: &Path) -> Result<ApprovalPolicy, CliError> {
    let text = fs::read_to_string(path).map_err(|source| {
        CliError::InvalidInput(format!("failed to read {}: {source}", path.display()))
    })?;
    validate_policy_json(&text).map_err(CliError::Policy)
}

fn next_required<I>(args: &mut I, message: &str) -> Result<String, CliError>
where
    I: Iterator<Item = String>,
{
    args.next()
        .ok_or_else(|| CliError::InvalidInput(message.to_string()))
}

fn reject_extra<I>(mut args: I) -> Result<(), CliError>
where
    I: Iterator<Item = String>,
{
    if let Some(extra) = args.next() {
        return Err(CliError::InvalidInput(format!(
            "unexpected extra argument '{extra}'"
        )));
    }
    Ok(())
}

fn parse_optional_port(port: Option<String>) -> Result<u16, CliError> {
    match port {
        Some(value) => value
            .parse::<u16>()
            .map_err(|_| CliError::InvalidInput(format!("invalid endpoint port '{value}'"))),
        None => Ok(DEFAULT_ENDPOINT_PORT),
    }
}

struct PolicyStore {
    path: PathBuf,
    policy: ApprovalPolicy,
}

impl PolicyStore {
    fn load(path: PathBuf) -> Result<Self, CliError> {
        let policy = read_policy(&path)?;
        Ok(Self { path, policy })
    }

    fn policy(&self) -> &ApprovalPolicy {
        &self.policy
    }

    fn refresh(&mut self) -> Result<&ApprovalPolicy, CliError> {
        let previous_sha256 = self.policy.policy_sha256();
        let policy = read_policy(&self.path)?;
        let current_sha256 = policy.policy_sha256();
        if current_sha256 != previous_sha256 {
            println!(
                "Reloaded {POLICY_KIND} v{POLICY_VERSION} {current_sha256} from {}.",
                self.path.display()
            );
        }
        self.policy = policy;
        Ok(&self.policy)
    }
}

fn serve_endpoint(policy_path: PathBuf, port: u16) -> Result<(), CliError> {
    let mut policy_store = PolicyStore::load(policy_path)?;
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    println!("TinyRustLM Local Connect endpoint listening at http://127.0.0.1:{port}/");
    println!(
        "Loaded {POLICY_KIND} v{POLICY_VERSION} {} from {}; gated app action endpoint is exposed.",
        policy_store.policy().policy_sha256(),
        policy_store.path.display()
    );
    println!("Policy file is revalidated before each request; invalid updates fail closed.");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                if let Err(error) = handle_endpoint_stream(&mut policy_store, &mut stream) {
                    eprintln!("Local Connect request failed: {error}");
                }
            }
            Err(error) => eprintln!("Local Connect connection failed: {error}"),
        }
    }
    Ok(())
}

fn handle_endpoint_stream(
    policy_store: &mut PolicyStore,
    stream: &mut TcpStream,
) -> Result<(), CliError> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;
    let request = match read_http_request(stream) {
        Ok(request) => request,
        Err(error) => {
            write_error(stream, 400, None, "bad-request", error.to_string())?;
            return Ok(());
        }
    };
    let origin = allowed_cors_origin(&request.headers);

    if request.method == "OPTIONS" {
        write_empty_response(stream, 204, origin.as_deref())?;
        return Ok(());
    }

    let policy = match policy_store.refresh() {
        Ok(policy) => policy,
        Err(error) => {
            eprintln!("Local Connect policy reload failed: {error}");
            write_error(
                stream,
                500,
                origin.as_deref(),
                "policy-reload-failed",
                error.to_string(),
            )?;
            return Ok(());
        }
    };

    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/v0/health") => {
            write_json(stream, 200, origin.as_deref(), &health_response(policy))?
        }
        ("GET", "/v0/categories") => {
            write_json(stream, 200, origin.as_deref(), &categories_response(policy))?
        }
        ("GET", "/v0/apps") => write_json(stream, 200, origin.as_deref(), &apps_response(policy)?)?,
        ("POST", "/v0/decision") => match decision_response(policy, &request.body) {
            Ok(response) => write_json(stream, 200, origin.as_deref(), &response)?,
            Err(error) => write_error(
                stream,
                400,
                origin.as_deref(),
                "decision-rejected",
                error.to_string(),
            )?,
        },
        ("POST", "/v0/action") => {
            let gate = ActionHttpGate::Http {
                headers: &request.headers,
                origin: origin.as_deref(),
            };
            match action_response(policy, &request.body, gate) {
                Ok(response) => write_json(stream, 200, origin.as_deref(), &response)?,
                Err(error) => write_error(
                    stream,
                    400,
                    origin.as_deref(),
                    "action-rejected",
                    error.to_string(),
                )?,
            }
        }
        _ => write_error(
            stream,
            404,
            origin.as_deref(),
            "not-found",
            format!("{} {}", request.method, request.path),
        )?,
    }

    Ok(())
}

#[derive(Debug)]
struct HttpRequest {
    method: String,
    path: String,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

fn read_http_request(stream: &mut TcpStream) -> Result<HttpRequest, CliError> {
    let mut bytes = Vec::new();
    let header_end = loop {
        if let Some(index) = find_header_end(&bytes) {
            break index;
        }
        if bytes.len() > HEADER_READ_LIMIT {
            return Err(CliError::InvalidInput(
                "request headers too large".to_string(),
            ));
        }
        let mut buffer = [0u8; 1024];
        let len = stream.read(&mut buffer)?;
        if len == 0 {
            return Err(CliError::InvalidInput(
                "connection closed before headers".to_string(),
            ));
        }
        bytes.extend_from_slice(&buffer[..len]);
    };

    let header_bytes = &bytes[..header_end];
    let header_text = std::str::from_utf8(header_bytes)
        .map_err(|_| CliError::InvalidInput("request headers are not utf-8".to_string()))?;
    let mut lines = header_text.lines();
    let request_line = lines
        .next()
        .ok_or_else(|| CliError::InvalidInput("missing request line".to_string()))?;
    let (method, path) = parse_request_line(request_line)?;

    let mut headers = BTreeMap::new();
    for line in lines {
        let Some((key, value)) = line.split_once(':') else {
            return Err(CliError::InvalidInput(format!(
                "invalid header line '{line}'"
            )));
        };
        headers.insert(key.trim().to_ascii_lowercase(), value.trim().to_string());
    }

    let content_length = match headers.get("content-length") {
        Some(value) => value
            .parse::<usize>()
            .map_err(|_| CliError::InvalidInput(format!("invalid content-length '{value}'")))?,
        None => 0,
    };
    if content_length > BODY_READ_LIMIT {
        return Err(CliError::InvalidInput(format!(
            "request body exceeds {BODY_READ_LIMIT} bytes"
        )));
    }

    let body_start = header_end + 4;
    let mut body = bytes[body_start..].to_vec();
    while body.len() < content_length {
        let mut buffer = [0u8; 4096];
        let len = stream.read(&mut buffer)?;
        if len == 0 {
            return Err(CliError::InvalidInput(
                "connection closed before request body".to_string(),
            ));
        }
        body.extend_from_slice(&buffer[..len]);
        if body.len() > BODY_READ_LIMIT {
            return Err(CliError::InvalidInput(format!(
                "request body exceeds {BODY_READ_LIMIT} bytes"
            )));
        }
    }
    body.truncate(content_length);

    Ok(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

fn parse_request_line(line: &str) -> Result<(String, String), CliError> {
    let mut parts = line.split_whitespace();
    let method = parts
        .next()
        .ok_or_else(|| CliError::InvalidInput("missing method".to_string()))?;
    let target = parts
        .next()
        .ok_or_else(|| CliError::InvalidInput("missing target".to_string()))?;
    let version = parts
        .next()
        .ok_or_else(|| CliError::InvalidInput("missing version".to_string()))?;
    if parts.next().is_some() || !version.starts_with("HTTP/") {
        return Err(CliError::InvalidInput("invalid request line".to_string()));
    }
    let path = target.split('?').next().unwrap_or(target).to_string();
    Ok((method.to_ascii_uppercase(), path))
}

fn find_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

#[derive(Serialize)]
struct HealthResponse {
    endpoint_kind: &'static str,
    endpoint_version: u64,
    status: &'static str,
    bind_host: &'static str,
    policy_kind: &'static str,
    policy_version: u64,
    policy_sha256: String,
    approval_mode: &'static str,
    full_local_control: bool,
    full_control_non_sensitive_machine_acknowledged: bool,
    approved_apps_count: usize,
    app_inventory_policy: &'static str,
    app_inventory_path_exposure: &'static str,
    app_approval_binding_policy: &'static str,
    action_execution_policy: &'static str,
    app_execution_endpoints: bool,
    action_endpoint_path: &'static str,
    supported_actions: Vec<&'static str>,
}

fn health_response(policy: &ApprovalPolicy) -> HealthResponse {
    HealthResponse {
        endpoint_kind: ENDPOINT_KIND,
        endpoint_version: ENDPOINT_VERSION,
        status: "ready",
        bind_host: "127.0.0.1",
        policy_kind: POLICY_KIND,
        policy_version: POLICY_VERSION,
        policy_sha256: policy.policy_sha256(),
        approval_mode: policy.mode().as_str(),
        full_local_control: policy.full_local_control(),
        full_control_non_sensitive_machine_acknowledged: policy
            .full_control_non_sensitive_machine_acknowledged(),
        approved_apps_count: policy.approved_apps().len(),
        app_inventory_policy: APP_INVENTORY_POLICY,
        app_inventory_path_exposure: APP_INVENTORY_PATH_EXPOSURE,
        app_approval_binding_policy: APP_APPROVAL_BINDING_POLICY,
        action_execution_policy: ACTION_EXECUTION_POLICY,
        app_execution_endpoints: true,
        action_endpoint_path: "/v0/action",
        supported_actions: vec!["open-url", "compose-email", "open-path"],
    }
}

#[derive(Serialize)]
struct CategoriesResponse {
    endpoint_kind: &'static str,
    policy_sha256: String,
    categories: Vec<CategoryResponse>,
}

#[derive(Serialize)]
struct CategoryResponse {
    category: &'static str,
    label: &'static str,
    risk: &'static str,
    warning: &'static str,
    approval: &'static str,
}

fn categories_response(policy: &ApprovalPolicy) -> CategoriesResponse {
    CategoriesResponse {
        endpoint_kind: ENDPOINT_KIND,
        policy_sha256: policy.policy_sha256(),
        categories: ALL_CATEGORIES
            .iter()
            .map(|category| CategoryResponse {
                category: category.as_str(),
                label: category.label(),
                risk: category.risk(),
                warning: category.warning(),
                approval: policy.category_level(*category).as_str(),
            })
            .collect(),
    }
}

#[derive(Clone, Copy)]
struct AppCandidate {
    name: &'static str,
    category: Category,
    source: &'static str,
}

const COMMON_APP_CANDIDATES: &[AppCandidate] = &[
    AppCandidate {
        name: "chrome.exe",
        category: Category::Browser,
        source: "common-browser",
    },
    AppCandidate {
        name: "msedge.exe",
        category: Category::Browser,
        source: "common-browser",
    },
    AppCandidate {
        name: "firefox.exe",
        category: Category::Browser,
        source: "common-browser",
    },
    AppCandidate {
        name: "outlook.exe",
        category: Category::Email,
        source: "common-email",
    },
    AppCandidate {
        name: "thunderbird.exe",
        category: Category::Email,
        source: "common-email",
    },
    AppCandidate {
        name: "winword.exe",
        category: Category::Documents,
        source: "common-documents",
    },
    AppCandidate {
        name: "excel.exe",
        category: Category::Documents,
        source: "common-documents",
    },
    AppCandidate {
        name: "explorer.exe",
        category: Category::Files,
        source: "common-files",
    },
    AppCandidate {
        name: "powershell.exe",
        category: Category::Terminal,
        source: "common-terminal",
    },
    AppCandidate {
        name: "pwsh.exe",
        category: Category::Terminal,
        source: "common-terminal",
    },
    AppCandidate {
        name: "cmd.exe",
        category: Category::Terminal,
        source: "common-terminal",
    },
    AppCandidate {
        name: "bitwarden.exe",
        category: Category::Secrets,
        source: "common-secrets",
    },
    AppCandidate {
        name: "1password.exe",
        category: Category::Secrets,
        source: "common-secrets",
    },
];

#[derive(Serialize)]
struct AppsResponse {
    endpoint_kind: &'static str,
    policy_sha256: String,
    app_inventory_policy: &'static str,
    app_inventory_path_exposure: &'static str,
    app_approval_binding_policy: &'static str,
    action_execution_policy: &'static str,
    inventory_source: &'static str,
    inventory_paths_exposed: bool,
    local_inventory_observed_count: usize,
    inventory_entry_limit: usize,
    apps: Vec<AppResponse>,
    app_execution_endpoints: bool,
    action_endpoint_path: &'static str,
}

#[derive(Serialize)]
struct AppResponse {
    app: String,
    category: &'static str,
    category_label: &'static str,
    risk: &'static str,
    warning: &'static str,
    approval: &'static str,
    decision: &'static str,
    reason: &'static str,
    source: &'static str,
    source_label: &'static str,
    inventory_observed: bool,
    inventory_paths_exposed: bool,
    app_approval_binding_policy: &'static str,
    action_execution_policy: &'static str,
    supported_actions: Vec<&'static str>,
    full_control_warning: bool,
    app_execution_performed: bool,
}

fn apps_response(policy: &ApprovalPolicy) -> Result<AppsResponse, CliError> {
    let local_inventory = discover_local_app_names(policy);
    let mut seen = BTreeSet::new();
    let mut rows = Vec::new();
    for app in policy.approved_apps() {
        let category = policy.approved_app_category(app).unwrap_or(Category::Files);
        let source = if category_for_app_name(app).is_some() {
            "approved-app"
        } else {
            "approved-app-manual"
        };
        let observed = local_inventory.contains(&normalized_app_key(app));
        push_app_response(
            policy, &mut seen, &mut rows, app, category, source, observed,
        )?;
    }
    for app in &local_inventory {
        if let Some(category) = category_for_app_name(app) {
            push_app_response(
                policy,
                &mut seen,
                &mut rows,
                app,
                category,
                "local-app-inventory",
                true,
            )?;
        }
    }
    for candidate in COMMON_APP_CANDIDATES {
        push_app_response(
            policy,
            &mut seen,
            &mut rows,
            candidate.name,
            candidate.category,
            candidate.source,
            local_inventory.contains(candidate.name),
        )?;
    }
    Ok(AppsResponse {
        endpoint_kind: ENDPOINT_KIND,
        policy_sha256: policy.policy_sha256(),
        app_inventory_policy: APP_INVENTORY_POLICY,
        app_inventory_path_exposure: APP_INVENTORY_PATH_EXPOSURE,
        app_approval_binding_policy: APP_APPROVAL_BINDING_POLICY,
        action_execution_policy: ACTION_EXECUTION_POLICY,
        inventory_source: "bounded-local-name-discovery-with-common-fallback",
        inventory_paths_exposed: false,
        local_inventory_observed_count: local_inventory.len(),
        inventory_entry_limit: INVENTORY_EXTRA_SCAN_ENTRY_LIMIT,
        apps: rows,
        app_execution_endpoints: true,
        action_endpoint_path: "/v0/action",
    })
}

fn push_app_response(
    policy: &ApprovalPolicy,
    seen: &mut BTreeSet<String>,
    rows: &mut Vec<AppResponse>,
    app: &str,
    category: Category,
    source: &'static str,
    inventory_observed: bool,
) -> Result<(), CliError> {
    let key = app.to_ascii_lowercase();
    if !seen.insert(key) {
        return Ok(());
    }
    let report = decide_approval(policy, category, Some(app))?;
    rows.push(AppResponse {
        app: app.to_string(),
        category: category.as_str(),
        category_label: category.label(),
        risk: category.risk(),
        warning: category.warning(),
        approval: policy.category_level(category).as_str(),
        decision: report.decision().as_str(),
        reason: report.reason(),
        source,
        source_label: source_label(source),
        inventory_observed,
        inventory_paths_exposed: false,
        app_approval_binding_policy: APP_APPROVAL_BINDING_POLICY,
        action_execution_policy: ACTION_EXECUTION_POLICY,
        supported_actions: supported_actions_for_category(category).to_vec(),
        full_control_warning: report.full_control_warning(),
        app_execution_performed: false,
    });
    Ok(())
}

fn supported_actions_for_category(category: Category) -> &'static [&'static str] {
    match category {
        Category::Browser => &["open-url"],
        Category::Email => &["compose-email"],
        Category::Documents | Category::Files => &["open-path"],
        Category::Terminal | Category::Secrets => &[],
    }
}

fn category_for_app_name(app: &str) -> Option<Category> {
    COMMON_APP_CANDIDATES
        .iter()
        .find(|candidate| candidate.name.eq_ignore_ascii_case(app))
        .map(|candidate| candidate.category)
}

fn source_label(source: &str) -> &'static str {
    match source {
        "approved-app" => "Approved app",
        "approved-app-manual" => "Approved app",
        "local-app-inventory" => "Found locally",
        "common-browser" => "Common browser",
        "common-email" => "Common email app",
        "common-documents" => "Common document app",
        "common-files" => "Common file app",
        "common-terminal" => "Common terminal app",
        "common-secrets" => "Common password app",
        _ => "App candidate",
    }
}

fn discover_local_app_names(policy: &ApprovalPolicy) -> BTreeSet<String> {
    let wanted = wanted_inventory_app_names(policy);
    let mut found = BTreeSet::new();
    for directory in path_search_dirs() {
        discover_direct_children(&directory, &wanted, &mut found);
    }
    for app in &wanted {
        if known_candidate_paths(app).iter().any(|path| path.is_file()) {
            found.insert(app.clone());
        }
    }
    let mut visited = 0usize;
    for root in configured_inventory_scan_roots() {
        scan_inventory_root(
            &root,
            &wanted,
            &mut found,
            &mut visited,
            0,
            INVENTORY_EXTRA_SCAN_DEPTH,
        );
        if visited >= INVENTORY_EXTRA_SCAN_ENTRY_LIMIT {
            break;
        }
    }
    found
}

fn wanted_inventory_app_names(policy: &ApprovalPolicy) -> BTreeSet<String> {
    let mut wanted = BTreeSet::new();
    for candidate in COMMON_APP_CANDIDATES {
        wanted.insert(normalized_app_key(candidate.name));
    }
    for app in policy.approved_apps() {
        wanted.insert(normalized_app_key(app));
    }
    wanted
}

fn normalized_app_key(app: &str) -> String {
    app.trim().to_ascii_lowercase()
}

fn path_search_dirs() -> Vec<PathBuf> {
    env::var_os("PATH")
        .map(|value| env::split_paths(&value).collect())
        .unwrap_or_default()
}

fn configured_inventory_scan_roots() -> Vec<PathBuf> {
    env::var_os("TINYRUSTLM_LOCAL_CONNECT_APP_SCAN_DIRS")
        .map(|value| env::split_paths(&value).collect())
        .unwrap_or_default()
}

fn discover_direct_children(
    directory: &Path,
    wanted: &BTreeSet<String>,
    found: &mut BTreeSet<String>,
) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten().take(INVENTORY_EXTRA_SCAN_ENTRY_LIMIT) {
        if let Some(name) = normalized_file_name(&entry.path()) {
            if wanted.contains(&name) {
                found.insert(name);
            }
        }
    }
}

fn scan_inventory_root(
    root: &Path,
    wanted: &BTreeSet<String>,
    found: &mut BTreeSet<String>,
    visited: &mut usize,
    depth: usize,
    max_depth: usize,
) {
    if *visited >= INVENTORY_EXTRA_SCAN_ENTRY_LIMIT || depth > max_depth {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        if *visited >= INVENTORY_EXTRA_SCAN_ENTRY_LIMIT {
            break;
        }
        *visited += 1;
        let path = entry.path();
        if let Some(name) = normalized_file_name(&path) {
            if wanted.contains(&name) {
                found.insert(name);
            }
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() && !file_type.is_symlink() {
            scan_inventory_root(&path, wanted, found, visited, depth + 1, max_depth);
        }
    }
}

fn normalized_file_name(path: &Path) -> Option<String> {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(normalized_app_key)
}

#[cfg(target_os = "windows")]
fn known_candidate_paths(app: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let program_roots = ["ProgramFiles", "ProgramFiles(x86)"]
        .iter()
        .filter_map(env::var_os)
        .map(PathBuf::from)
        .collect::<Vec<_>>();
    let local_app_data = env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let system_root = env::var_os("SystemRoot").map(PathBuf::from);
    match app {
        "chrome.exe" => {
            for root in &program_roots {
                paths.push(root.join("Google\\Chrome\\Application\\chrome.exe"));
            }
            if let Some(root) = &local_app_data {
                paths.push(root.join("Google\\Chrome\\Application\\chrome.exe"));
            }
        }
        "msedge.exe" => {
            for root in &program_roots {
                paths.push(root.join("Microsoft\\Edge\\Application\\msedge.exe"));
            }
            if let Some(root) = &local_app_data {
                paths.push(root.join("Microsoft\\Edge\\Application\\msedge.exe"));
            }
        }
        "firefox.exe" => {
            for root in &program_roots {
                paths.push(root.join("Mozilla Firefox\\firefox.exe"));
            }
        }
        "outlook.exe" | "winword.exe" | "excel.exe" => {
            for root in &program_roots {
                let office_root = root.join("Microsoft Office\\root\\Office16");
                paths.push(office_root.join(app));
                paths.push(office_root.join(app.to_ascii_uppercase()));
            }
        }
        "thunderbird.exe" => {
            for root in &program_roots {
                paths.push(root.join("Mozilla Thunderbird\\thunderbird.exe"));
            }
        }
        "explorer.exe" => {
            if let Some(root) = &system_root {
                paths.push(root.join("explorer.exe"));
            }
        }
        "powershell.exe" => {
            if let Some(root) = &system_root {
                paths.push(root.join("System32\\WindowsPowerShell\\v1.0\\powershell.exe"));
            }
        }
        "pwsh.exe" => {
            for root in &program_roots {
                paths.push(root.join("PowerShell\\7\\pwsh.exe"));
            }
        }
        "cmd.exe" => {
            if let Some(root) = &system_root {
                paths.push(root.join("System32\\cmd.exe"));
            }
        }
        "bitwarden.exe" => {
            for root in &program_roots {
                paths.push(root.join("Bitwarden\\Bitwarden.exe"));
            }
            if let Some(root) = &local_app_data {
                paths.push(root.join("Programs\\Bitwarden\\Bitwarden.exe"));
            }
        }
        "1password.exe" => {
            if let Some(root) = &local_app_data {
                paths.push(root.join("1Password\\app\\8\\1Password.exe"));
            }
        }
        _ => {}
    }
    paths
}

#[cfg(not(target_os = "windows"))]
fn known_candidate_paths(_app: &str) -> Vec<PathBuf> {
    Vec::new()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DecisionRequest {
    category: String,
    app: Option<String>,
}

#[derive(Serialize)]
struct DecisionResponse {
    endpoint_kind: &'static str,
    policy_status: &'static str,
    policy_sha256: String,
    app_approval_binding_policy: &'static str,
    decision: &'static str,
    reason: &'static str,
    category: &'static str,
    app: String,
    full_control_warning: bool,
    app_execution_performed: bool,
}

fn decision_response(policy: &ApprovalPolicy, body: &[u8]) -> Result<DecisionResponse, CliError> {
    let request: DecisionRequest = serde_json::from_slice(body)
        .map_err(|source| CliError::InvalidInput(format!("invalid decision JSON: {source}")))?;
    let category = Category::parse(&request.category)?;
    let report = decide_approval(policy, category, request.app.as_deref())?;
    Ok(DecisionResponse {
        endpoint_kind: ENDPOINT_KIND,
        policy_status: "validated",
        policy_sha256: policy.policy_sha256(),
        app_approval_binding_policy: APP_APPROVAL_BINDING_POLICY,
        decision: report.decision().as_str(),
        reason: report.reason(),
        category: report.category().as_str(),
        app: report.app().unwrap_or("").to_string(),
        full_control_warning: report.full_control_warning(),
        app_execution_performed: false,
    })
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ActionRequest {
    policy_sha256: String,
    category: String,
    app: Option<String>,
    action: String,
    target: String,
    #[serde(default = "default_action_dry_run")]
    dry_run: bool,
}

#[derive(Serialize)]
struct ActionResponse {
    endpoint_kind: &'static str,
    policy_status: &'static str,
    policy_sha256: String,
    action_request_sha256: String,
    app_approval_binding_policy: &'static str,
    action_execution_policy: &'static str,
    decision: &'static str,
    reason: &'static str,
    category: &'static str,
    app: String,
    action: &'static str,
    target_kind: &'static str,
    target_preview: String,
    dry_run: bool,
    full_control_warning: bool,
    app_execution_endpoints: bool,
    app_execution_performed: bool,
    execution_status: &'static str,
    execution_engine: &'static str,
    safety_note: &'static str,
}

impl ActionResponse {
    fn render_key_values(&self) -> String {
        [
            "policy.status=validated".to_string(),
            format!("policy.sha256={}", self.policy_sha256),
            format!("action.request_sha256={}", self.action_request_sha256),
            format!(
                "app_approval_binding_policy={}",
                self.app_approval_binding_policy
            ),
            format!("action_execution_policy={}", self.action_execution_policy),
            format!("decision={}", self.decision),
            format!("reason={}", self.reason),
            format!("category={}", self.category),
            format!("app={}", self.app),
            format!("action={}", self.action),
            format!("target_kind={}", self.target_kind),
            format!("dry_run={}", bool_value(self.dry_run)),
            format!(
                "full_control_warning={}",
                bool_value(self.full_control_warning)
            ),
            format!(
                "app_execution_performed={}",
                bool_value(self.app_execution_performed)
            ),
            format!("execution_status={}", self.execution_status),
            format!("execution_engine={}", self.execution_engine),
        ]
        .join("\n")
    }
}

enum ActionHttpGate<'a> {
    Cli,
    Http {
        headers: &'a BTreeMap<String, String>,
        origin: Option<&'a str>,
    },
}

#[derive(Clone)]
struct ActionPlan {
    category: Category,
    action: &'static str,
    target_kind: &'static str,
    target: String,
}

#[derive(Serialize)]
struct CanonicalActionEvidence<'a> {
    endpoint_kind: &'static str,
    endpoint_version: u64,
    policy_sha256: &'a str,
    app_approval_binding_policy: &'static str,
    action_execution_policy: &'static str,
    category: &'static str,
    app: &'a str,
    action: &'static str,
    target_kind: &'static str,
    target: &'a str,
    dry_run: bool,
}

fn default_action_dry_run() -> bool {
    true
}

fn action_response(
    policy: &ApprovalPolicy,
    body: &[u8],
    gate: ActionHttpGate<'_>,
) -> Result<ActionResponse, CliError> {
    let request: ActionRequest = serde_json::from_slice(body)
        .map_err(|source| CliError::InvalidInput(format!("invalid action JSON: {source}")))?;
    require_policy_sha256(&request.policy_sha256, policy)?;
    require_action_http_gate(&gate, policy, request.dry_run)?;
    let category = Category::parse(&request.category)?;
    let plan = action_plan(category, &request.action, &request.target)?;
    let report = decide_approval(policy, plan.category, request.app.as_deref())?;
    let can_execute = report.decision().as_str() == "allow";
    let mut performed = false;
    let mut execution_status = if can_execute {
        "dry-run"
    } else {
        "not-approved"
    };
    if can_execute && !request.dry_run {
        execute_action_plan(&plan)?;
        performed = true;
        execution_status = "started";
    }

    Ok(ActionResponse {
        endpoint_kind: ENDPOINT_KIND,
        policy_status: "validated",
        policy_sha256: policy.policy_sha256(),
        action_request_sha256: action_request_sha256(
            policy,
            &plan,
            request.app.as_deref().unwrap_or_default(),
            request.dry_run,
        ),
        app_approval_binding_policy: APP_APPROVAL_BINDING_POLICY,
        action_execution_policy: ACTION_EXECUTION_POLICY,
        decision: report.decision().as_str(),
        reason: report.reason(),
        category: report.category().as_str(),
        app: report.app().unwrap_or("").to_string(),
        action: plan.action,
        target_kind: plan.target_kind,
        target_preview: plan.target,
        dry_run: request.dry_run,
        full_control_warning: report.full_control_warning(),
        app_execution_endpoints: true,
        app_execution_performed: performed,
        execution_status,
        execution_engine: native_opener_engine(),
        safety_note: "typed-action-policy-gated",
    })
}

fn action_request_sha256(
    policy: &ApprovalPolicy,
    plan: &ActionPlan,
    app: &str,
    dry_run: bool,
) -> String {
    let policy_sha256 = policy.policy_sha256();
    let evidence = CanonicalActionEvidence {
        endpoint_kind: ENDPOINT_KIND,
        endpoint_version: ENDPOINT_VERSION,
        policy_sha256: &policy_sha256,
        app_approval_binding_policy: APP_APPROVAL_BINDING_POLICY,
        action_execution_policy: ACTION_EXECUTION_POLICY,
        category: plan.category.as_str(),
        app,
        action: plan.action,
        target_kind: plan.target_kind,
        target: &plan.target,
        dry_run,
    };
    let text =
        serde_json::to_string(&evidence).expect("action evidence serialization should not fail");
    sha256_text(&text)
}

fn require_policy_sha256(value: &str, policy: &ApprovalPolicy) -> Result<(), CliError> {
    if value == policy.policy_sha256() {
        Ok(())
    } else {
        Err(CliError::InvalidInput(
            "action policy_sha256 does not match loaded policy".to_string(),
        ))
    }
}

fn require_action_http_gate(
    gate: &ActionHttpGate<'_>,
    policy: &ApprovalPolicy,
    dry_run: bool,
) -> Result<(), CliError> {
    let ActionHttpGate::Http { headers, origin } = gate else {
        return Ok(());
    };
    if origin.is_none() {
        return Err(CliError::InvalidInput(
            "action requests require an allowed Origin".to_string(),
        ));
    }
    let content_type = headers
        .get("content-type")
        .map(String::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !content_type.starts_with("application/json") {
        return Err(CliError::InvalidInput(
            "action requests require application/json".to_string(),
        ));
    }
    let header_sha = headers
        .get("x-tinyrustlm-policy-sha256")
        .map(String::as_str)
        .unwrap_or_default();
    if header_sha != policy.policy_sha256() {
        return Err(CliError::InvalidInput(
            "action header policy digest does not match loaded policy".to_string(),
        ));
    }
    if !dry_run {
        let execution_consent = headers
            .get(ACTION_EXECUTION_CONSENT_HEADER)
            .map(String::as_str)
            .unwrap_or_default();
        if execution_consent != ACTION_EXECUTION_CONSENT_VALUE {
            return Err(CliError::InvalidInput(format!(
                "non-dry-run action requests require {ACTION_EXECUTION_CONSENT_HEADER}: {ACTION_EXECUTION_CONSENT_VALUE}"
            )));
        }
    }
    Ok(())
}

fn action_plan(category: Category, action: &str, target: &str) -> Result<ActionPlan, CliError> {
    match (category, action) {
        (Category::Browser, "open-url") => Ok(ActionPlan {
            category,
            action: "open-url",
            target_kind: "https-url",
            target: validate_https_url_target(target)?,
        }),
        (Category::Email, "compose-email") => Ok(ActionPlan {
            category,
            action: "compose-email",
            target_kind: "mailto-url",
            target: validate_mailto_target(target)?,
        }),
        (Category::Documents | Category::Files, "open-path") => Ok(ActionPlan {
            category,
            action: "open-path",
            target_kind: "absolute-local-path",
            target: validate_local_path_target(target)?,
        }),
        _ => Err(CliError::InvalidInput(format!(
            "action '{action}' is not supported for category '{}'",
            category.as_str()
        ))),
    }
}

fn validate_https_url_target(target: &str) -> Result<String, CliError> {
    validate_action_target_text(target)?;
    let lowered = target.to_ascii_lowercase();
    if !(lowered.starts_with("https://") || lowered.starts_with("http://127.0.0.1:")) {
        return Err(CliError::InvalidInput(
            "open-url action requires https:// or loopback http://127.0.0.1 targets".to_string(),
        ));
    }
    if target.contains('@')
        || target.contains('\\')
        || target.contains('"')
        || target.contains('\'')
    {
        return Err(CliError::InvalidInput(
            "open-url target must not contain credentials, paths with backslashes, or quotes"
                .to_string(),
        ));
    }
    Ok(target.to_string())
}

fn validate_mailto_target(target: &str) -> Result<String, CliError> {
    validate_action_target_text(target)?;
    let lowered = target.to_ascii_lowercase();
    if !lowered.starts_with("mailto:") || target.contains('\\') || target.contains('"') {
        return Err(CliError::InvalidInput(
            "compose-email action requires a mailto: target".to_string(),
        ));
    }
    Ok(target.to_string())
}

fn validate_local_path_target(target: &str) -> Result<String, CliError> {
    validate_action_target_text(target)?;
    let path = Path::new(target);
    if !path.is_absolute() || target.contains('*') || target.contains('?') || target.contains('"') {
        return Err(CliError::InvalidInput(
            "open-path action requires an absolute local path without wildcards or quotes"
                .to_string(),
        ));
    }
    Ok(target.to_string())
}

fn validate_action_target_text(target: &str) -> Result<(), CliError> {
    if target.trim() != target || target.is_empty() || target.len() > ACTION_TARGET_LIMIT {
        return Err(CliError::InvalidInput(format!(
            "action target must be non-empty, trimmed, and at most {ACTION_TARGET_LIMIT} bytes"
        )));
    }
    if target.chars().any(|ch| ch.is_control()) {
        return Err(CliError::InvalidInput(
            "action target must not contain control characters".to_string(),
        ));
    }
    Ok(())
}

fn execute_action_plan(plan: &ActionPlan) -> Result<(), CliError> {
    let mut command = native_opener_command(&plan.target);
    command.spawn().map(|_| ()).map_err(|source| {
        CliError::InvalidInput(format!(
            "failed to start native opener for {}: {source}",
            plan.action
        ))
    })
}

#[cfg(target_os = "windows")]
fn native_opener_command(target: &str) -> Command {
    let mut command = Command::new("rundll32.exe");
    command.arg("url.dll,FileProtocolHandler").arg(target);
    command
}

#[cfg(target_os = "macos")]
fn native_opener_command(target: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(target);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn native_opener_command(target: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(target);
    command
}

#[cfg(target_os = "windows")]
fn native_opener_engine() -> &'static str {
    "windows-file-protocol-handler"
}

#[cfg(target_os = "macos")]
fn native_opener_engine() -> &'static str {
    "macos-open"
}

#[cfg(all(unix, not(target_os = "macos")))]
fn native_opener_engine() -> &'static str {
    "xdg-open"
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
        use std::fmt::Write as _;
        let _ = write!(&mut value, "{byte:02x}");
    }
    value
}

#[derive(Serialize)]
struct ErrorResponse {
    endpoint_kind: &'static str,
    error: &'static str,
    message: String,
}

fn write_json<T: Serialize>(
    stream: &mut TcpStream,
    status: u16,
    origin: Option<&str>,
    value: &T,
) -> Result<(), CliError> {
    let body = serde_json::to_vec_pretty(value)
        .map_err(|source| CliError::InvalidInput(source.to_string()))?;
    write_response(
        stream,
        status,
        origin,
        "application/json; charset=utf-8",
        &body,
    )
}

fn write_error(
    stream: &mut TcpStream,
    status: u16,
    origin: Option<&str>,
    error: &'static str,
    message: String,
) -> Result<(), CliError> {
    write_json(
        stream,
        status,
        origin,
        &ErrorResponse {
            endpoint_kind: ENDPOINT_KIND,
            error,
            message,
        },
    )
}

fn write_empty_response(
    stream: &mut TcpStream,
    status: u16,
    origin: Option<&str>,
) -> Result<(), CliError> {
    write_response(stream, status, origin, "text/plain; charset=utf-8", &[])
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    origin: Option<&str>,
    content_type: &str,
    body: &[u8],
) -> Result<(), CliError> {
    write!(
        stream,
        "HTTP/1.1 {status} {}\r\ncontent-type: {content_type}\r\ncontent-length: {}\r\ncache-control: no-store\r\nconnection: close\r\n",
        status_reason(status),
        body.len()
    )?;
    if let Some(origin) = origin {
        write!(
            stream,
            "access-control-allow-origin: {origin}\r\naccess-control-allow-methods: GET, POST, OPTIONS\r\naccess-control-allow-headers: content-type, x-tinyrustlm-policy-sha256, x-tinyrustlm-execution-consent\r\nvary: origin\r\n"
        )?;
    }
    stream.write_all(b"\r\n")?;
    stream.write_all(body)?;
    stream.flush()?;
    Ok(())
}

fn status_reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    }
}

fn allowed_cors_origin(headers: &BTreeMap<String, String>) -> Option<String> {
    let origin = headers.get("origin")?;
    if is_allowed_origin(origin) {
        Some(origin.clone())
    } else {
        None
    }
}

fn is_allowed_origin(origin: &str) -> bool {
    let origin = origin.to_ascii_lowercase();
    matches!(
        origin.as_str(),
        "https://tinyrustlm.com"
            | "https://www.tinyrustlm.com"
            | "https://tinyrustlm.mirust.com"
            | "https://www.tinyrustlm.mirust.com"
    ) || origin.starts_with("http://127.0.0.1:")
        || origin.starts_with("http://localhost:")
        || origin.starts_with("http://tinyrustlm.com:")
}

fn usage() -> String {
    [
        "usage:",
        "  tinyrustlm-local-connect inspect-approval-policy <policy.json>",
        "  tinyrustlm-local-connect decide-approval <policy.json> <browser|email|documents|files|terminal|secrets> [app-name]",
        "  tinyrustlm-local-connect execute-action <policy.json> <action.json>",
        "  tinyrustlm-local-connect serve-approval-endpoint <policy.json> [port]",
    ]
    .join("\n")
}

#[derive(Debug)]
enum CliError {
    InvalidInput(String),
    Io(std::io::Error),
    Policy(PolicyError),
    Usage,
}

impl std::fmt::Display for CliError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(message) => formatter.write_str(message),
            Self::Io(source) => write!(formatter, "{source}"),
            Self::Policy(source) => write!(formatter, "policy validation failed: {source}"),
            Self::Usage => formatter.write_str(&usage()),
        }
    }
}

impl From<std::io::Error> for CliError {
    fn from(source: std::io::Error) -> Self {
        Self::Io(source)
    }
}

impl From<PolicyError> for CliError {
    fn from(source: PolicyError) -> Self {
        Self::Policy(source)
    }
}
