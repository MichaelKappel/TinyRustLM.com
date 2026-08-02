//! CLI smoke coverage for the TinyRustLM Local Connect policy gate.

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tinyrustlm_local_connect::validate_policy_json;

fn valid_policy() -> &'static str {
    r#"{
  "policy_kind": "tinyrustlm.local_connect_approval_policy.v0",
  "policy_version": 2,
  "approval_mode": "selected",
  "approval_mode_label": "Always approve selected",
  "full_local_control": false,
  "full_control_non_sensitive_machine_acknowledged": false,
  "browser_local_storage_only": true,
  "project_server_receives_policy": false,
  "local_endpoint_must_enforce_policy": true,
  "category_approval": {
    "browser": "always",
    "email": "ask",
    "documents": "ask",
    "files": "ask",
    "terminal": "ask",
    "secrets": "ask"
  },
  "approved_apps": ["Chrome.exe"],
  "approved_app_bindings": [
    {
      "app": "Chrome.exe",
      "category": "browser",
      "category_label": "Browsers",
      "risk": "medium",
      "warning": "Can read pages, submit forms, download files, and act inside signed-in browser sessions.",
      "approval": "always"
    }
  ],
  "risk_warnings": [
    {
      "category": "browser",
      "label": "Browsers",
      "risk": "medium",
      "warning": "Can read pages, submit forms, download files, and act inside signed-in browser sessions.",
      "approval": "always"
    },
    {
      "category": "email",
      "label": "Email apps",
      "risk": "high",
      "warning": "Can read, send, delete, or forward messages and attachments.",
      "approval": "ask"
    },
    {
      "category": "documents",
      "label": "Docs and office",
      "risk": "medium",
      "warning": "Can edit documents, spreadsheets, and local business records.",
      "approval": "ask"
    },
    {
      "category": "files",
      "label": "Files and folders",
      "risk": "high",
      "warning": "Can move, overwrite, upload, or delete local files.",
      "approval": "ask"
    },
    {
      "category": "terminal",
      "label": "Terminal and scripts",
      "risk": "critical",
      "warning": "Can execute commands, install software, and change system state.",
      "approval": "ask"
    },
    {
      "category": "secrets",
      "label": "Passwords, payments, settings",
      "risk": "critical",
      "warning": "Can affect credentials, accounts, money movement, and security settings.",
      "approval": "ask"
    }
  ]
}"#
}

fn unique_policy_path(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "tinyrustlm-local-connect-{name}-{}-{nanos}.json",
        std::process::id()
    ))
}

fn unique_temp_dir(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "tinyrustlm-local-connect-{name}-{}-{nanos}",
        std::process::id()
    ))
}

fn policy_sha256() -> String {
    validate_policy_json(valid_policy())
        .unwrap()
        .policy_sha256()
}

fn full_control_policy() -> String {
    valid_policy()
        .replace(
            r#""approval_mode": "selected""#,
            r#""approval_mode": "full""#,
        )
        .replace(
            r#""approval_mode_label": "Always approve selected""#,
            r#""approval_mode_label": "Full local-control lab mode""#,
        )
        .replace(
            r#""full_local_control": false"#,
            r#""full_local_control": true"#,
        )
        .replace(
            r#""full_control_non_sensitive_machine_acknowledged": false"#,
            r#""full_control_non_sensitive_machine_acknowledged": true"#,
        )
        .replace(r#""browser": "always""#, r#""browser": "ask""#)
        .replace(
            r#""approved_apps": ["Chrome.exe"]"#,
            r#""approved_apps": []"#,
        )
        .replace(
            r#"  "approved_app_bindings": [
    {
      "app": "Chrome.exe",
      "category": "browser",
      "category_label": "Browsers",
      "risk": "medium",
      "warning": "Can read pages, submit forms, download files, and act inside signed-in browser sessions.",
      "approval": "always"
    }
  ],"#,
            r#"  "approved_app_bindings": [],"#,
        )
        .replacen(r#""approval": "always""#, r#""approval": "ask""#, 1)
}

fn ask_policy() -> String {
    valid_policy()
        .replace(
            r#""approval_mode": "selected""#,
            r#""approval_mode": "ask""#,
        )
        .replace(
            r#""approval_mode_label": "Always approve selected""#,
            r#""approval_mode_label": "Ask every time""#,
        )
        .replace(r#""browser": "always""#, r#""browser": "ask""#)
        .replace(
            r#""approved_apps": ["Chrome.exe"]"#,
            r#""approved_apps": []"#,
        )
        .replace(
            r#"  "approved_app_bindings": [
    {
      "app": "Chrome.exe",
      "category": "browser",
      "category_label": "Browsers",
      "risk": "medium",
      "warning": "Can read pages, submit forms, download files, and act inside signed-in browser sessions.",
      "approval": "always"
    }
  ],"#,
            r#"  "approved_app_bindings": [],"#,
        )
        .replacen(r#""approval": "always""#, r#""approval": "ask""#, 1)
}

fn full_control_policy_sha256() -> String {
    validate_policy_json(&full_control_policy())
        .unwrap()
        .policy_sha256()
}

fn ask_policy_sha256() -> String {
    validate_policy_json(&ask_policy()).unwrap().policy_sha256()
}

fn action_json_with_policy_sha256(policy_sha256: &str, dry_run: bool) -> String {
    action_json_for(
        policy_sha256,
        "browser",
        "chrome.exe",
        "open-url",
        "https://tinyrustlm.com/local-connect-smoke",
        dry_run,
    )
}

fn action_json_for(
    policy_sha256: &str,
    category: &str,
    app: &str,
    action: &str,
    target: &str,
    dry_run: bool,
) -> String {
    format!(
        r#"{{
  "policy_sha256": {},
  "category": {},
  "app": {},
  "action": {},
  "target": {},
  "dry_run": {dry_run}
}}"#,
        serde_json::to_string(policy_sha256).unwrap(),
        serde_json::to_string(category).unwrap(),
        serde_json::to_string(app).unwrap(),
        serde_json::to_string(action).unwrap(),
        serde_json::to_string(target).unwrap(),
    )
}

fn action_json(dry_run: bool) -> String {
    action_json_with_policy_sha256(&policy_sha256(), dry_run)
}

fn unused_loopback_port() -> u16 {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    listener.local_addr().unwrap().port()
}

struct ChildGuard {
    child: Child,
}

impl ChildGuard {
    fn new(child: Child) -> Self {
        Self { child }
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn wait_for_endpoint(port: u16) {
    for _attempt in 0..60 {
        if http_request(port, "GET", "/v0/health", "", None).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
    panic!("endpoint did not start on port {port}");
}

fn http_request(
    port: u16,
    method: &str,
    path: &str,
    body: &str,
    origin: Option<&str>,
) -> std::io::Result<String> {
    http_request_with_headers(port, method, path, body, origin, &[])
}

fn http_request_with_headers(
    port: u16,
    method: &str,
    path: &str,
    body: &str,
    origin: Option<&str>,
    extra_headers: &[(&str, &str)],
) -> std::io::Result<String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))?;
    let origin_header = origin
        .map(|value| format!("Origin: {value}\r\n"))
        .unwrap_or_default();
    let extra_header_text = extra_headers
        .iter()
        .map(|(name, value)| format!("{name}: {value}\r\n"))
        .collect::<String>();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{origin_header}{extra_header_text}content-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes())?;
    stream.flush()?;
    let mut response = String::new();
    stream.read_to_string(&mut response)?;
    Ok(response)
}

fn status_code(response: &str) -> u16 {
    response
        .lines()
        .next()
        .unwrap()
        .split_whitespace()
        .nth(1)
        .unwrap()
        .parse()
        .unwrap()
}

#[test]
fn cli_inspects_policy_file() {
    let path = unique_policy_path("inspect");
    fs::write(&path, valid_policy()).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("inspect-approval-policy")
        .arg(&path)
        .output()
        .unwrap();

    fs::remove_file(&path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("policy.status=validated"));
    assert!(stdout.contains("policy.sha256=sha256:"));
    assert!(stdout.contains("category.browser=always"));
}

#[test]
fn cli_decides_browser_approval() {
    let path = unique_policy_path("decision");
    fs::write(&path, valid_policy()).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("decide-approval")
        .arg(&path)
        .arg("browser")
        .arg("chrome.exe")
        .output()
        .unwrap();

    fs::remove_file(&path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=allow"));
    assert!(stdout.contains("reason=category-always-approved"));
}

#[test]
fn cli_decision_does_not_apply_browser_app_approval_to_email_category() {
    let path = unique_policy_path("decision-cross-category");
    fs::write(&path, valid_policy()).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("decide-approval")
        .arg(&path)
        .arg("email")
        .arg("chrome.exe")
        .output()
        .unwrap();

    fs::remove_file(&path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=ask"));
    assert!(stdout.contains("reason=not-selected"));
}

#[test]
fn cli_dry_runs_gated_browser_action() {
    let policy_path = unique_policy_path("action-policy");
    let action_path = unique_policy_path("action");
    fs::write(&policy_path, valid_policy()).unwrap();
    fs::write(&action_path, action_json(true)).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=allow"));
    assert!(stdout.contains("action=open-url"));
    assert!(stdout.contains("action.request_sha256=sha256:"));
    assert!(stdout.contains("app_approval_binding_policy=app-and-category-v1"));
    assert!(stdout
        .contains("action_execution_policy=typed-action-dry-run-default-execution-consent-v1"));
    assert!(stdout.contains("target_kind=https-url"));
    assert!(stdout.contains("dry_run=true"));
    assert!(stdout.contains("app_execution_performed=false"));
    assert!(stdout.contains("execution_status=dry-run"));
}

#[test]
fn cli_dry_runs_full_control_browser_action_with_warning() {
    let policy_path = unique_policy_path("full-action-policy");
    let action_path = unique_policy_path("full-action");
    let policy_sha256 = full_control_policy_sha256();
    fs::write(&policy_path, full_control_policy()).unwrap();
    fs::write(
        &action_path,
        action_json_with_policy_sha256(&policy_sha256, true),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=allow"));
    assert!(stdout.contains("reason=full-local-control"));
    assert!(stdout.contains("action.request_sha256=sha256:"));
    assert!(stdout.contains("full_control_warning=true"));
    assert!(stdout.contains("dry_run=true"));
    assert!(stdout.contains("app_execution_performed=false"));
}

#[test]
fn cli_dry_runs_full_control_email_action() {
    let policy_path = unique_policy_path("email-action-policy");
    let action_path = unique_policy_path("email-action");
    let policy_sha256 = full_control_policy_sha256();
    fs::write(&policy_path, full_control_policy()).unwrap();
    fs::write(
        &action_path,
        action_json_for(
            &policy_sha256,
            "email",
            "outlook.exe",
            "compose-email",
            "mailto:peer@example.test?subject=TinyRustLM",
            true,
        ),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=allow"));
    assert!(stdout.contains("reason=full-local-control"));
    assert!(stdout.contains("action=compose-email"));
    assert!(stdout.contains("action.request_sha256=sha256:"));
    assert!(stdout.contains("target_kind=mailto-url"));
    assert!(stdout.contains("dry_run=true"));
    assert!(stdout.contains("app_execution_performed=false"));
}

#[test]
fn cli_dry_runs_full_control_open_path_action() {
    let policy_path = unique_policy_path("path-action-policy");
    let action_path = unique_policy_path("path-action");
    let target_path = unique_temp_dir("open-path-target").join("reviewed-share-metadata.json");
    let policy_sha256 = full_control_policy_sha256();
    fs::write(&policy_path, full_control_policy()).unwrap();
    fs::write(
        &action_path,
        action_json_for(
            &policy_sha256,
            "files",
            "explorer.exe",
            "open-path",
            &target_path.to_string_lossy(),
            true,
        ),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=allow"));
    assert!(stdout.contains("action=open-path"));
    assert!(stdout.contains("action.request_sha256=sha256:"));
    assert!(stdout.contains("target_kind=absolute-local-path"));
    assert!(stdout.contains("dry_run=true"));
    assert!(stdout.contains("app_execution_performed=false"));
}

#[test]
fn cli_does_not_apply_browser_app_approval_to_email_action() {
    let policy_path = unique_policy_path("cross-category-policy");
    let action_path = unique_policy_path("cross-category-action");
    fs::write(&policy_path, valid_policy()).unwrap();
    fs::write(
        &action_path,
        action_json_for(
            &policy_sha256(),
            "email",
            "Chrome.exe",
            "compose-email",
            "mailto:peer@example.test",
            true,
        ),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("decision=ask"));
    assert!(stdout.contains("reason=not-selected"));
    assert!(stdout.contains("action=compose-email"));
    assert!(stdout.contains("action.request_sha256=sha256:"));
    assert!(stdout.contains("execution_status=not-approved"));
    assert!(stdout.contains("app_execution_performed=false"));
}

#[test]
fn cli_rejects_mismatched_action_category() {
    let policy_path = unique_policy_path("mismatched-action-policy");
    let action_path = unique_policy_path("mismatched-action");
    fs::write(&policy_path, full_control_policy()).unwrap();
    fs::write(
        &action_path,
        action_json_for(
            &full_control_policy_sha256(),
            "browser",
            "chrome.exe",
            "compose-email",
            "mailto:peer@example.test",
            true,
        ),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(!output.status.success());
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stderr.contains("not supported for category 'browser'"));
}

#[test]
fn cli_rejects_unsafe_open_url_action_target() {
    let policy_path = unique_policy_path("unsafe-url-policy");
    let action_path = unique_policy_path("unsafe-url-action");
    fs::write(&policy_path, full_control_policy()).unwrap();
    fs::write(
        &action_path,
        action_json_for(
            &full_control_policy_sha256(),
            "browser",
            "chrome.exe",
            "open-url",
            "http://example.com/not-loopback",
            true,
        ),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("execute-action")
        .arg(&policy_path)
        .arg(&action_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    fs::remove_file(&action_path).unwrap();
    assert!(!output.status.success());
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stderr.contains("open-url action requires https://"));
}

#[test]
fn cli_rejects_full_control_policy_without_machine_acknowledgement() {
    let policy_path = unique_policy_path("full-without-ack");
    let policy = full_control_policy().replace(
        r#""full_control_non_sensitive_machine_acknowledged": true"#,
        r#""full_control_non_sensitive_machine_acknowledged": false"#,
    );
    fs::write(&policy_path, policy).unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("inspect-approval-policy")
        .arg(&policy_path)
        .output()
        .unwrap();

    fs::remove_file(&policy_path).unwrap();
    assert!(!output.status.success());
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stderr.contains("full_control_non_sensitive_machine_acknowledged"));
}

#[test]
fn endpoint_serves_health_categories_and_decisions() {
    let path = unique_policy_path("endpoint");
    fs::write(&path, valid_policy()).unwrap();
    let inventory_root = unique_temp_dir("inventory-root");
    let inventory_nested = inventory_root.join("Office");
    fs::create_dir_all(&inventory_nested).unwrap();
    fs::write(inventory_nested.join("outlook.exe"), b"").unwrap();
    let port = unused_loopback_port();
    let child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("serve-approval-endpoint")
        .arg(&path)
        .arg(port.to_string())
        .env("TINYRUSTLM_LOCAL_CONNECT_APP_SCAN_DIRS", &inventory_root)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let _guard = ChildGuard::new(child);
    wait_for_endpoint(port);

    let health =
        http_request(port, "GET", "/v0/health", "", Some("http://127.0.0.1:8080")).unwrap();
    assert_eq!(status_code(&health), 200);
    assert!(health.contains("\"endpoint_kind\": \"tinyrustlm.local_connect_endpoint.v0\""));
    assert!(health.contains("\"policy_sha256\": \"sha256:"));
    assert!(health.contains("\"app_execution_endpoints\": true"));
    assert!(health.contains("\"action_endpoint_path\": \"/v0/action\""));
    assert!(health.contains("\"app_inventory_policy\": \"bounded-name-discovery-no-paths-v1\""));
    assert!(health.contains("\"app_inventory_path_exposure\": \"never\""));
    assert!(health.contains("\"app_approval_binding_policy\": \"app-and-category-v1\""));
    assert!(health.contains(
        "\"action_execution_policy\": \"typed-action-dry-run-default-execution-consent-v1\""
    ));
    assert!(health.contains("\"full_control_non_sensitive_machine_acknowledged\": false"));
    assert!(health.contains("access-control-allow-origin: http://127.0.0.1:8080"));

    let preflight = http_request(
        port,
        "OPTIONS",
        "/v0/action",
        "",
        Some("https://tinyrustlm.com"),
    )
    .unwrap();
    assert_eq!(status_code(&preflight), 204);
    assert!(preflight.contains("x-tinyrustlm-execution-consent"));

    let categories = http_request(port, "GET", "/v0/categories", "", None).unwrap();
    assert_eq!(status_code(&categories), 200);
    assert!(categories.contains("\"policy_sha256\": \"sha256:"));
    assert!(categories.contains("\"category\": \"browser\""));
    assert!(categories.contains("\"risk\": \"critical\""));

    let apps = http_request(port, "GET", "/v0/apps", "", None).unwrap();
    assert_eq!(status_code(&apps), 200);
    assert!(apps.contains("\"policy_sha256\": \"sha256:"));
    assert!(apps
        .contains("\"inventory_source\": \"bounded-local-name-discovery-with-common-fallback\""));
    assert!(apps.contains("\"app_inventory_policy\": \"bounded-name-discovery-no-paths-v1\""));
    assert!(apps.contains("\"app_inventory_path_exposure\": \"never\""));
    assert!(apps.contains("\"app_approval_binding_policy\": \"app-and-category-v1\""));
    assert!(apps.contains(
        "\"action_execution_policy\": \"typed-action-dry-run-default-execution-consent-v1\""
    ));
    assert!(apps.contains("\"inventory_paths_exposed\": false"));
    assert!(apps.contains("\"local_inventory_observed_count\":"));
    assert!(apps.contains("\"app\": \"Chrome.exe\""));
    assert!(apps.contains("\"source\": \"approved-app\""));
    assert!(apps.contains("\"app\": \"outlook.exe\""));
    assert!(apps.contains("\"category_label\": \"Email apps\""));
    assert!(apps.contains("\"source\": \"local-app-inventory\""));
    assert!(apps.contains("\"source_label\": \"Found locally\""));
    assert!(apps.contains("\"inventory_observed\": true"));
    assert!(apps.contains("\"decision\": \"allow\""));
    assert!(apps.contains("\"app_execution_endpoints\": true"));
    assert!(apps.contains("\"app_execution_performed\": false"));
    assert!(apps.contains("\"supported_actions\": ["));

    let decision = http_request(
        port,
        "POST",
        "/v0/decision",
        r#"{"category":"browser","app":"chrome.exe"}"#,
        Some("https://tinyrustlm.com"),
    )
    .unwrap();
    assert_eq!(status_code(&decision), 200);
    assert!(decision.contains("\"policy_sha256\": \"sha256:"));
    assert!(decision.contains("\"decision\": \"allow\""));
    assert!(decision.contains("\"reason\": \"category-always-approved\""));
    assert!(decision.contains("\"app_approval_binding_policy\": \"app-and-category-v1\""));
    assert!(decision.contains("\"app_execution_performed\": false"));

    let cross_category_decision = http_request(
        port,
        "POST",
        "/v0/decision",
        r#"{"category":"email","app":"chrome.exe"}"#,
        Some("https://tinyrustlm.com"),
    )
    .unwrap();
    assert_eq!(status_code(&cross_category_decision), 200);
    assert!(cross_category_decision.contains("\"decision\": \"ask\""));
    assert!(cross_category_decision.contains("\"reason\": \"not-selected\""));
    assert!(cross_category_decision.contains("\"app_execution_performed\": false"));

    let action = http_request_with_headers(
        port,
        "POST",
        "/v0/action",
        &action_json(true),
        Some("https://tinyrustlm.com"),
        &[("x-tinyrustlm-policy-sha256", &policy_sha256())],
    )
    .unwrap();
    assert_eq!(status_code(&action), 200);
    assert!(action.contains("\"policy_sha256\": \"sha256:"));
    assert!(action.contains("\"action_request_sha256\": \"sha256:"));
    assert!(action.contains("\"app_approval_binding_policy\": \"app-and-category-v1\""));
    assert!(action.contains(
        "\"action_execution_policy\": \"typed-action-dry-run-default-execution-consent-v1\""
    ));
    assert!(action.contains("\"decision\": \"allow\""));
    assert!(action.contains("\"action\": \"open-url\""));
    assert!(action.contains("\"target_kind\": \"https-url\""));
    assert!(action.contains("\"dry_run\": true"));
    assert!(action.contains("\"app_execution_performed\": false"));
    assert!(action.contains("\"execution_status\": \"dry-run\""));

    fs::remove_file(&path).unwrap();
    fs::remove_dir_all(&inventory_root).unwrap();
}

#[test]
fn endpoint_hot_reloads_policy_file_and_fails_closed_on_invalid_update() {
    let path = unique_policy_path("endpoint-hot-reload");
    fs::write(&path, valid_policy()).unwrap();
    let port = unused_loopback_port();
    let child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("serve-approval-endpoint")
        .arg(&path)
        .arg(port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let _guard = ChildGuard::new(child);
    wait_for_endpoint(port);

    let allow_decision = http_request(
        port,
        "POST",
        "/v0/decision",
        r#"{"category":"browser","app":"chrome.exe"}"#,
        Some("https://tinyrustlm.com"),
    )
    .unwrap();
    assert_eq!(status_code(&allow_decision), 200);
    assert!(allow_decision.contains("\"decision\": \"allow\""));
    assert!(allow_decision.contains("\"reason\": \"category-always-approved\""));

    fs::write(&path, ask_policy()).unwrap();
    let mut reloaded_decision = String::new();
    for _attempt in 0..60 {
        reloaded_decision = http_request(
            port,
            "POST",
            "/v0/decision",
            r#"{"category":"browser","app":"chrome.exe"}"#,
            Some("https://tinyrustlm.com"),
        )
        .unwrap();
        if reloaded_decision.contains(&ask_policy_sha256())
            && reloaded_decision.contains("\"decision\": \"ask\"")
        {
            break;
        }
        thread::sleep(Duration::from_millis(50));
    }
    assert_eq!(status_code(&reloaded_decision), 200);
    assert!(reloaded_decision.contains(&ask_policy_sha256()));
    assert!(reloaded_decision.contains("\"decision\": \"ask\""));
    assert!(reloaded_decision.contains("\"reason\": \"ask-mode\""));

    fs::write(&path, "{}").unwrap();
    let rejected = http_request(
        port,
        "GET",
        "/v0/health",
        "",
        Some("https://tinyrustlm.com"),
    )
    .unwrap();
    assert_eq!(status_code(&rejected), 500);
    assert!(rejected.contains("\"error\": \"policy-reload-failed\""));
    assert!(rejected.contains("policy validation failed"));

    fs::remove_file(&path).unwrap();
}

#[test]
fn endpoint_rejects_invalid_decision_request() {
    let path = unique_policy_path("endpoint-reject");
    fs::write(&path, valid_policy()).unwrap();
    let port = unused_loopback_port();
    let child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("serve-approval-endpoint")
        .arg(&path)
        .arg(port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let _guard = ChildGuard::new(child);
    wait_for_endpoint(port);

    let response = http_request(
        port,
        "POST",
        "/v0/decision",
        r#"{"category":"browser","app":"chrome.exe","extra":true}"#,
        None,
    )
    .unwrap();

    assert_eq!(status_code(&response), 400);
    assert!(response.contains("\"error\": \"decision-rejected\""));
    fs::remove_file(&path).unwrap();
}

#[test]
fn endpoint_rejects_action_without_digest_header() {
    let path = unique_policy_path("endpoint-action-reject");
    fs::write(&path, valid_policy()).unwrap();
    let port = unused_loopback_port();
    let child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("serve-approval-endpoint")
        .arg(&path)
        .arg(port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let _guard = ChildGuard::new(child);
    wait_for_endpoint(port);

    let response = http_request(
        port,
        "POST",
        "/v0/action",
        &action_json(true),
        Some("https://tinyrustlm.com"),
    )
    .unwrap();

    assert_eq!(status_code(&response), 400);
    assert!(response.contains("\"error\": \"action-rejected\""));
    assert!(response.contains("policy digest"));
    fs::remove_file(&path).unwrap();
}

#[test]
fn endpoint_rejects_non_dry_run_action_without_execution_consent_header() {
    let path = unique_policy_path("endpoint-action-execution-consent");
    fs::write(&path, valid_policy()).unwrap();
    let port = unused_loopback_port();
    let child = Command::new(env!("CARGO_BIN_EXE_tinyrustlm-local-connect"))
        .arg("serve-approval-endpoint")
        .arg(&path)
        .arg(port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let _guard = ChildGuard::new(child);
    wait_for_endpoint(port);

    let response = http_request_with_headers(
        port,
        "POST",
        "/v0/action",
        &action_json(false),
        Some("https://tinyrustlm.com"),
        &[("x-tinyrustlm-policy-sha256", &policy_sha256())],
    )
    .unwrap();

    assert_eq!(status_code(&response), 400);
    assert!(response.contains("\"error\": \"action-rejected\""));
    assert!(response.contains("x-tinyrustlm-execution-consent"));
    assert!(response.contains("native-opener-v1"));

    let invalid_response = http_request_with_headers(
        port,
        "POST",
        "/v0/action",
        &action_json(false),
        Some("https://tinyrustlm.com"),
        &[
            ("x-tinyrustlm-policy-sha256", &policy_sha256()),
            ("x-tinyrustlm-execution-consent", "wrong-token"),
        ],
    )
    .unwrap();

    assert_eq!(status_code(&invalid_response), 400);
    assert!(invalid_response.contains("\"error\": \"action-rejected\""));
    assert!(invalid_response.contains("x-tinyrustlm-execution-consent"));
    fs::remove_file(&path).unwrap();
}
