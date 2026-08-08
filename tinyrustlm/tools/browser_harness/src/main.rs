#![forbid(unsafe_code)]
#![doc = "No-crate TinyRustLM mini browser contract harness."]

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::thread;
use std::time::Duration;

const DEFAULT_ROOT: &str = "tinyrustlm";
const PRIVACY_NOTICE: &str = "Local browser inference";

const REQUIRED_IDS: &[&str] = &[
    "runtimeStatus",
    "chatForm",
    "prompt",
    "maxTokens",
    "temperature",
    "topK",
    "topP",
    "seed",
    "generateButton",
    "stepTokenButton",
    "resetButton",
    "clearChatButton",
    "conversation",
    "response",
    "modelSelect",
    "localModelFile",
    "importLocalModelButton",
    "localModelState",
    "sidebarLocalSetupButton",
    "sidebarHfSetupButton",
    "sidebarP2pSetupButton",
    "sidebarAdvancedToolsButton",
    "simpleDiscoveryPanel",
    "simpleLocalSourceButton",
    "simpleHfSourceButton",
    "simpleP2pSourceButton",
    "simpleLocalSourcePanel",
    "simpleChooseLocalButton",
    "simpleImportLocalModelButton",
    "simpleHfSourcePanel",
    "simpleHfSearchInput",
    "simpleHfSearchButton",
    "simpleHfP2pToggle",
    "simpleHfP2pStatus",
    "simpleHfP2pWarning",
    "simpleHfFlowSummary",
    "simpleHfResults",
    "simpleP2pSourcePanel",
    "simplePeerBaseUrlInput",
    "simpleSavePeerUrlButton",
    "simplePeerUrlStatus",
    "simpleLocalCatalogFile",
    "simpleImportLocalCatalogButton",
    "simpleCatalogResults",
    "hfSearchInput",
    "hfSearchButton",
    "hfStatus",
    "hfResults",
    "simpleLocalConnectApprovalsButton",
    "simpleLocalConnectStatus",
    "localConnectApprovalMode",
    "localConnectModeWarning",
    "localConnectCategoryList",
    "localConnectApprovedApps",
    "trustBrowserEmailLocalConnectButton",
    "saveLocalConnectPolicyButton",
    "saveLocalConnectPolicyFileButton",
    "resetLocalConnectPolicyButton",
    "localConnectEndpointUrl",
    "checkLocalConnectEndpointButton",
    "dryRunLocalConnectDecisionButton",
    "localConnectEndpointStatus",
    "localConnectEndpointAppList",
    "localConnectPolicyStatus",
    "localConnectPolicyPreview",
    "simplePeerContactBookPeers",
    "peerContactBookPeers",
    "simpleImportReceiptLedgerEntries",
    "importReceiptLedgerEntries",
    "simplePeerStatusCheckFile",
    "simplePeerStatusCheckButton",
    "simpleCheckPeerStatusButton",
    "simplePeerStatusCheckStatus",
    "peerStatusCheckFile",
    "peerStatusCheckButton",
    "checkPeerStatusButton",
    "peerStatusCheckStatus",
    "loadPanel",
    "wasmState",
    "modelState",
    "errorState",
    "provenancePanel",
    "provenanceState",
    "provenanceSourceKind",
    "provenanceSourceSnapshot",
    "provenanceSourceId",
    "provenanceSourceShape",
    "provenanceSourceReview",
    "provenanceSourceReviewRoutes",
    "provenanceSourceReviewArtifacts",
    "provenanceSourceTokenizerImport",
    "provenanceSourceValidation",
    "provenanceAdmission",
    "provenanceQualityClaim",
    "provenanceTrainedClaim",
    "provenanceGenome",
    "provenanceSpecies",
    "provenanceNovelty",
    "provenancePopulation",
    "provenanceMateSelection",
    "provenanceOperator",
    "provenanceSchedule",
    "provenancePhenotype",
    "provenanceArtifact",
    "provenanceFitness",
    "provenanceEvalCases",
    "provenanceEvalChecksum",
    "provenanceChecksum",
    "provenanceNextGate",
    "benchLoadMs",
    "benchPromptTokens",
    "benchGeneratedTokens",
    "benchTokensPerSecond",
    "benchScratch",
    "diagnostics",
    "console",
    "developer",
    "appFooter",
];

const FORBIDDEN_MODEL_HANDOFF_MARKERS: &[&str] = &[
    "simpleShareMetadataFile",
    "simpleImportShareMetadataButton",
    "simpleSaveShareMetadataButton",
    "Share Metadata",
    "share-metadata",
];

const REQUIRED_HTML_TEXT: &[&str] = &[
    "TinyRustLM",
    "TinyRustLM.com",
    "Hugging Face",
    "P2P Exchange",
    "Your Local Files",
    "Enable P2P import and sharing",
    "Known peer URL",
    "Load Local Catalog",
    "Runtime Status",
    "Diagnostics",
    "Token Console",
    "Provenance",
    "Chat with your local model",
    "Choose a local or P2P model",
    "Local Connect Approvals",
    "Check Endpoint",
    "Dry Run Browser Decision",
    PRIVACY_NOTICE,
];

const REQUIRED_JS_EXPORTS: &[&str] = &[
    ".alloc(",
    ".dealloc(",
    ".alloc_model(",
    ".dealloc_model(",
    ".init_runtime(",
    ".load_model_owned(",
    ".generate(",
    ".generate_next_token(",
    ".validate_composition_graph(",
    ".activate_composition_graph(",
    ".last_result_ptr(",
    ".last_result_len(",
    ".get_diagnostics_ptr(",
    ".get_diagnostics_len(",
    ".reset_context(",
    ".set_sampling_config_v2(",
    ".free_model(",
];

const REQUIRED_WASM_EXPORTS: &[&str] = &[
    "alloc",
    "dealloc",
    "alloc_model",
    "dealloc_model",
    "init_runtime",
    "load_model",
    "load_model_owned",
    "generate",
    "set_sampling_config",
    "set_sampling_config_v2",
    "generate_next_token",
    "validate_composition_graph",
    "activate_composition_graph",
    "last_result_ptr",
    "last_result_len",
    "get_diagnostics_ptr",
    "get_diagnostics_len",
    "reset_context",
    "free_model",
];

const FORBIDDEN_REMOTE_MARKERS: &[&str] = &[
    "http://",
    "https://",
    "//cdn",
    "unpkg",
    "jsdelivr",
    "cdnjs",
    "googleapis",
    "telemetry",
    "analytics",
];

const ALLOWED_INDEX_REMOTE_MARKERS: &[&str] = &["placeholder=\"https://memoryendpoints.com\""];

const ALLOWED_APP_JS_REMOTE_MARKERS: &[&str] = &[
    "https://tinyrustlm.com/local-connect-dry-run",
    "const httpsscheme = \"https://\";",
    "https://${raw}",
];

fn main() -> ExitCode {
    match run() {
        Ok(report) => {
            println!("{report}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("TinyRustLM browser harness failed: {error}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<String, HarnessError> {
    let config = Config::from_args(env::args().skip(1))?;
    let root = config.root.canonicalize().map_err(|source| {
        HarnessError::InvalidInput(format!("root {}: {source}", config.root.display()))
    })?;
    let mut checks = Vec::new();
    audit_static_contract(&root, &mut checks)?;
    if let Some(url) = &config.http_app_url {
        audit_http_contract(url, &mut checks)?;
    }
    Ok(format!(
        "TinyRustLM browser harness passed: {} checks; root={}; http={}",
        checks.len(),
        root.display(),
        config.http_app_url.as_deref().unwrap_or("not-requested")
    ))
}

#[derive(Debug)]
struct Config {
    root: PathBuf,
    http_app_url: Option<String>,
}

impl Config {
    fn from_args<I>(args: I) -> Result<Self, HarnessError>
    where
        I: Iterator<Item = String>,
    {
        let mut root = PathBuf::from(DEFAULT_ROOT);
        let mut http_app_url = None;
        let mut positional_root_seen = false;
        let mut args = args.peekable();

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--http" => {
                    let Some(value) = args.next() else {
                        return Err(HarnessError::InvalidInput(
                            "--http requires an app URL".to_string(),
                        ));
                    };
                    http_app_url = Some(value);
                }
                "--help" | "-h" => {
                    return Err(HarnessError::InvalidInput(
                        "usage: tinyrustlm-browser-harness [root] [--http http://127.0.0.1:8080/app/]".to_string(),
                    ));
                }
                value if value.starts_with('-') => {
                    return Err(HarnessError::InvalidInput(format!(
                        "unexpected option '{value}'"
                    )));
                }
                value => {
                    if positional_root_seen {
                        return Err(HarnessError::InvalidInput(format!(
                            "unexpected extra root '{value}'"
                        )));
                    }
                    root = PathBuf::from(value);
                    positional_root_seen = true;
                }
            }
        }

        Ok(Self { root, http_app_url })
    }
}

#[derive(Debug)]
enum HarnessError {
    InvalidInput(String),
    Missing(String),
    Io(std::io::Error),
    Http(String),
}

impl std::fmt::Display for HarnessError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HarnessError::InvalidInput(message) => write!(formatter, "invalid input: {message}"),
            HarnessError::Missing(message) => write!(formatter, "missing contract: {message}"),
            HarnessError::Io(source) => write!(formatter, "{source}"),
            HarnessError::Http(message) => write!(formatter, "http check failed: {message}"),
        }
    }
}

impl From<std::io::Error> for HarnessError {
    fn from(source: std::io::Error) -> Self {
        HarnessError::Io(source)
    }
}

fn audit_static_contract(root: &Path, checks: &mut Vec<String>) -> Result<(), HarnessError> {
    let index = read_utf8(root.join("app").join("index.html"))?;
    let conversation = read_utf8(root.join("app").join("active-conversation.js"))?;
    let calculator = read_utf8(root.join("app").join("calculator-tool.js"))?;
    let js = read_utf8(root.join("app").join("app.js"))?;
    let css = read_utf8(root.join("app").join("app.css"))?;
    let wasm_exports = read_utf8(root.join("runtime").join("src").join("wasm_exports.rs"))?;

    require_no_remote_markers("index.html", &index)?;
    require_no_remote_markers("active-conversation.js", &conversation)?;
    require_no_remote_markers("calculator-tool.js", &calculator)?;
    require_no_remote_markers("app.js", &js)?;
    require_no_remote_markers("app.css", &css)?;
    checks.push("static files contain no remote markers".to_string());

    for id in REQUIRED_IDS {
        require_contains("index.html id", &index, &format!("id=\"{id}\""))?;
    }
    checks.push(format!("{} required UI ids", REQUIRED_IDS.len()));

    for marker in FORBIDDEN_MODEL_HANDOFF_MARKERS {
        require_absent("index.html retired model handoff", &index, marker)?;
        require_absent("app.js retired model handoff", &js, marker)?;
    }
    checks.push(format!(
        "{} retired model handoff markers absent",
        FORBIDDEN_MODEL_HANDOFF_MARKERS.len()
    ));

    for text in REQUIRED_HTML_TEXT {
        require_contains("index.html text", &index, text)?;
    }
    checks.push(format!(
        "{} required visible text markers",
        REQUIRED_HTML_TEXT.len()
    ));

    require_contains("index.html stylesheet", &index, "href=\"./app.css")?;
    require_contains(
        "index.html conversation script",
        &index,
        "src=\"./active-conversation.js",
    )?;
    require_contains(
        "index.html calculator script",
        &index,
        "src=\"./calculator-tool.js",
    )?;
    require_contains("index.html script", &index, "src=\"./app.js")?;
    let conversation_script = index
        .find("src=\"./active-conversation.js")
        .ok_or_else(|| HarnessError::Missing("active conversation script order".to_string()))?;
    let app_script = index
        .find("src=\"./app.js")
        .ok_or_else(|| HarnessError::Missing("app script order".to_string()))?;
    let calculator_script = index
        .find("src=\"./calculator-tool.js")
        .ok_or_else(|| HarnessError::Missing("calculator script order".to_string()))?;
    if conversation_script >= calculator_script || calculator_script >= app_script {
        return Err(HarnessError::Missing(
            "conversation and calculator modules must load before app.js".to_string(),
        ));
    }
    require_contains(
        "calculator request parser",
        &calculator,
        "function parseRequest",
    )?;
    require_contains(
        "calculator model bypass label",
        &calculator,
        "Calculator: ${normalizedExpression} = ${normalizedResult}",
    )?;
    require_contains(
        "app.js calculator WASM route",
        &js,
        "state.exports.calculate",
    )?;
    require_contains(
        "runtime calculator export",
        &wasm_exports,
        "pub unsafe extern \"C\" fn calculate",
    )?;
    require_contains(
        "conversation credential boundary",
        &conversation,
        "conversation contains credential-like material",
    )?;
    require_contains(
        "conversation restart recovery",
        &conversation,
        "interrupted_after_restart",
    )?;
    require_contains("app active lifecycle", &js, "deliverGeneratedOutput")?;
    checks.push("html asset links".to_string());

    require_contains("app.js wasm path", &js, "../runtime/tinyrustlm.wasm")?;
    require_contains(
        "app.js wasm manifest path",
        &js,
        "../runtime/tinyrustlm.wasm.manifest",
    )?;
    require_contains("app.js wasm instantiate", &js, "WebAssembly.instantiate")?;
    require_contains("app.js local fetch", &js, "fetch(")?;
    require_contains("app.js manifest fetch", &js, "model.path")?;
    require_contains("app.js manifest fetch", &js, ".manifest")?;
    require_contains("app.js local file model key", &js, "__local_slm_file")?;
    require_contains("app.js local file route", &js, "local-file:")?;
    require_contains("app.js public local-only host", &js, "tinyrustlm.com")?;
    require_contains("app.js external model discovery", &js, "/api/models")?;
    require_contains(
        "app.js external search omits credentials",
        &js,
        "credentials: \"omit\"",
    )?;
    require_contains(
        "app.js selector registry fetch",
        &js,
        "../models/selector.registry",
    )?;
    require_contains(
        "app.js selector registry status",
        &js,
        "admitted-records-only",
    )?;
    require_contains(
        "app.js immutable selector graph reader",
        &js,
        "registryCompositionEntry",
    )?;
    require_contains(
        "app.js mutable assembly rejection",
        &js,
        "registryEntryDeclaresMutableAssembly",
    )?;
    require_contains(
        "app.js admitted composition graph fetch",
        &js,
        "fetchAdmittedCompositionGraph",
    )?;
    require_contains(
        "app.js composition graph SHA-256 gate",
        &js,
        "Admitted composition graph SHA-256 mismatch",
    )?;
    require_contains(
        "app.js admitted composition graph activation",
        &js,
        "activateAdmittedComposition",
    )?;
    require_contains(
        "app.js composition diagnostics gate",
        &js,
        "Activated composition diagnostics did not match the admission",
    )?;
    require_contains(
        "app.js local admission inspection",
        &js,
        "inspectBrowserModelAdmission",
    )?;
    require_contains(
        "app.js local admission byte gate",
        &js,
        "Local model bytes did not match the browser admission",
    )?;
    require_contains(
        "index browser admission module",
        &index,
        "browser-model-admission.js",
    )?;
    for export in REQUIRED_JS_EXPORTS {
        require_contains("app.js wasm export", &js, export)?;
    }
    checks.push(format!(
        "{} required WASM boundary calls",
        REQUIRED_JS_EXPORTS.len()
    ));

    for export in REQUIRED_WASM_EXPORTS {
        require_wasm_export(&wasm_exports, export)?;
    }
    checks.push(format!(
        "{} required Rust WASM exports",
        REQUIRED_WASM_EXPORTS.len()
    ));

    audit_runtime_wasm_manifest(root)?;
    checks.push("runtime WASM manifest".to_string());

    require_contains("app.css responsive behavior", &css, "@media")?;
    require_contains("app.css status error state", &css, ".error")?;
    require_contains("app.css shell layout", &css, ".app-shell")?;
    checks.push("css layout and error-state markers".to_string());

    Ok(())
}

fn audit_runtime_wasm_manifest(root: &Path) -> Result<(), HarnessError> {
    let wasm_path = root.join("runtime").join("tinyrustlm.wasm");
    let manifest_path = root.join("runtime").join("tinyrustlm.wasm.manifest");
    if !wasm_path.is_file() {
        return Err(HarnessError::Missing(format!(
            "runtime WASM file {}",
            wasm_path.display()
        )));
    }
    if !manifest_path.is_file() {
        return Err(HarnessError::Missing(format!(
            "runtime WASM manifest {}",
            manifest_path.display()
        )));
    }
    let manifest_text = read_utf8(&manifest_path)?;
    require_no_remote_markers("runtime WASM manifest", &manifest_text)?;
    let fields = parse_manifest(&manifest_text);
    require_manifest_value(&fields, "tinyrustlm_wasm_manifest_version", "1")?;
    require_manifest_value(&fields, "runtime_kind", "tinyrustlm-rust-wasm")?;
    require_manifest_value(&fields, "runtime_status", "validated-local-runtime")?;
    require_manifest_value(&fields, "runtime_wasm_path", "../runtime/tinyrustlm.wasm")?;
    require_manifest_value(
        &fields,
        "runtime_wasm_bytes",
        &fs::metadata(&wasm_path)?.len().to_string(),
    )?;
    let checksum = fields
        .get("runtime_wasm_checksum")
        .ok_or_else(|| HarnessError::Missing("runtime_wasm_checksum".to_string()))?;
    if checksum.len() != 18
        || !checksum.starts_with("0x")
        || !checksum[2..].bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(HarnessError::InvalidInput(format!(
            "invalid runtime_wasm_checksum {checksum}"
        )));
    }
    require_manifest_value(&fields, "required_next_gate", "instantiate-wasm-runtime")?;
    Ok(())
}

fn audit_http_contract(app_url: &str, checks: &mut Vec<String>) -> Result<(), HarnessError> {
    let parsed = HttpUrl::parse(app_url)?;
    if !parsed.path.ends_with("/app/") {
        return Err(HarnessError::Http(format!(
            "app URL must end in /app/, got {}",
            parsed.path
        )));
    }

    let routes = [
        ("GET", "/app/", "text/html"),
        ("HEAD", "/app/app.css", "text/css"),
        ("HEAD", "/app/active-conversation.js", "text/javascript"),
        ("HEAD", "/app/calculator-tool.js", "text/javascript"),
        ("HEAD", "/app/app.js", "text/javascript"),
        ("HEAD", "/runtime/tinyrustlm.wasm", "application/wasm"),
        ("HEAD", "/runtime/tinyrustlm.wasm.manifest", "text/plain"),
    ];

    for (method, path, content_type) in routes {
        let response = http_request(&parsed.host, parsed.port, method, path)?;
        if response.status != 200 {
            return Err(HarnessError::Http(format!(
                "{method} {path} returned {}",
                response.status
            )));
        }
        let actual_type = response
            .headers
            .get("content-type")
            .map(String::as_str)
            .unwrap_or("");
        if !actual_type.starts_with(content_type) {
            return Err(HarnessError::Http(format!(
                "{method} {path} content-type '{actual_type}' did not start with '{content_type}'"
            )));
        }
        if method == "GET" {
            let body = String::from_utf8_lossy(&response.body);
            require_contains("http app body", &body, "<title>TinyRustLM</title>")?;
            require_contains("http app body", &body, PRIVACY_NOTICE)?;
        }
    }
    checks.push("loopback HTTP app, asset, and WASM routes".to_string());
    Ok(())
}

#[derive(Debug, Eq, PartialEq)]
struct HttpUrl {
    host: String,
    port: u16,
    path: String,
}

impl HttpUrl {
    fn parse(input: &str) -> Result<Self, HarnessError> {
        let Some(rest) = input.strip_prefix("http://") else {
            return Err(HarnessError::Http(
                "only http:// loopback URLs are supported".to_string(),
            ));
        };
        let slash = rest
            .find('/')
            .ok_or_else(|| HarnessError::Http("missing URL path".to_string()))?;
        let authority = &rest[..slash];
        let path = &rest[slash..];
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port_text)) => {
                let port = port_text
                    .parse::<u16>()
                    .map_err(|_| HarnessError::Http(format!("invalid port '{port_text}'")))?;
                (host.to_string(), port)
            }
            None => (authority.to_string(), 80),
        };
        if host != "127.0.0.1" && host != "localhost" {
            return Err(HarnessError::Http(format!(
                "non-loopback host '{host}' is forbidden"
            )));
        }
        Ok(Self {
            host,
            port,
            path: path.to_string(),
        })
    }
}

#[derive(Debug)]
struct HttpResponse {
    status: u16,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

fn http_request(
    host: &str,
    port: u16,
    method: &str,
    path: &str,
) -> Result<HttpResponse, HarnessError> {
    let mut last_socket_error = None;
    for _attempt in 0..3 {
        match http_request_once(host, port, method, path) {
            Ok(response) => return Ok(response),
            Err(HarnessError::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::ConnectionAborted
                ) =>
            {
                last_socket_error = Some(error.to_string());
                thread::sleep(Duration::from_millis(75));
            }
            Err(error) => return Err(error),
        }
    }
    Err(HarnessError::Http(format!(
        "{method} {path} loopback socket closed repeatedly: {}",
        last_socket_error.unwrap_or_else(|| "unknown socket error".to_string())
    )))
}

fn http_request_once(
    host: &str,
    port: u16,
    method: &str,
    path: &str,
) -> Result<HttpResponse, HarnessError> {
    let mut stream = TcpStream::connect((host, port)).map_err(|source| {
        HarnessError::Http(format!(
            "connect {host}:{port} for {method} {path}: {source}"
        ))
    })?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;
    let request =
        format!("{method} {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes())?;
    stream.flush()?;

    let mut bytes = Vec::new();
    let mut buffer = [0u8; 8192];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(len) => bytes.extend_from_slice(&buffer[..len]),
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::ConnectionAborted
                ) && !bytes.is_empty() =>
            {
                break;
            }
            Err(error) => return Err(HarnessError::Io(error)),
        }
    }
    parse_http_response(&bytes)
}

fn parse_http_response(bytes: &[u8]) -> Result<HttpResponse, HarnessError> {
    let split = find_header_split(bytes)
        .ok_or_else(|| HarnessError::Http("response missing header terminator".to_string()))?;
    let headers_text = String::from_utf8_lossy(&bytes[..split]);
    let body = bytes[split + 4..].to_vec();
    let mut lines = headers_text.lines();
    let status_line = lines
        .next()
        .ok_or_else(|| HarnessError::Http("missing response status".to_string()))?;
    let mut status_parts = status_line.split_whitespace();
    let version = status_parts.next().unwrap_or("");
    if !version.starts_with("HTTP/") {
        return Err(HarnessError::Http(format!(
            "invalid status line '{status_line}'"
        )));
    }
    let status = status_parts
        .next()
        .ok_or_else(|| HarnessError::Http("missing status code".to_string()))?
        .parse::<u16>()
        .map_err(|_| HarnessError::Http(format!("invalid status line '{status_line}'")))?;

    let mut headers = BTreeMap::new();
    for line in lines {
        if let Some((key, value)) = line.split_once(':') {
            headers.insert(
                key.trim().to_ascii_lowercase(),
                value.trim().to_ascii_lowercase(),
            );
        }
    }
    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

fn find_header_split(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

fn parse_manifest(text: &str) -> BTreeMap<String, String> {
    let mut fields = BTreeMap::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=') {
            fields.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    fields
}

fn read_utf8(path: impl AsRef<Path>) -> Result<String, HarnessError> {
    let path = path.as_ref();
    fs::read_to_string(path).map_err(|source| {
        if source.kind() == std::io::ErrorKind::NotFound {
            HarnessError::Missing(format!("file {}", path.display()))
        } else {
            HarnessError::Io(source)
        }
    })
}

fn require_contains(label: &str, haystack: &str, needle: &str) -> Result<(), HarnessError> {
    if haystack.contains(needle) {
        Ok(())
    } else {
        Err(HarnessError::Missing(format!("{label} '{needle}'")))
    }
}

fn require_absent(label: &str, haystack: &str, needle: &str) -> Result<(), HarnessError> {
    if haystack.contains(needle) {
        Err(HarnessError::Missing(format!(
            "{label} contains forbidden marker '{needle}'"
        )))
    } else {
        Ok(())
    }
}

fn require_wasm_export(source: &str, name: &str) -> Result<(), HarnessError> {
    let safe_export = format!("pub extern \"C\" fn {name}");
    let unsafe_export = format!("pub unsafe extern \"C\" fn {name}");
    if source.contains(&safe_export) || source.contains(&unsafe_export) {
        Ok(())
    } else {
        Err(HarnessError::Missing(format!(
            "wasm_exports.rs export '{name}'"
        )))
    }
}

fn require_no_remote_markers(label: &str, text: &str) -> Result<(), HarnessError> {
    let mut lowered = text.to_ascii_lowercase();
    if label == "index.html" {
        for marker in ALLOWED_INDEX_REMOTE_MARKERS {
            lowered = lowered.replace(marker, "");
        }
    }
    if label == "app.js" {
        for marker in ALLOWED_APP_JS_REMOTE_MARKERS {
            lowered = lowered.replace(marker, "");
        }
    }
    for marker in FORBIDDEN_REMOTE_MARKERS {
        if lowered.contains(marker) {
            return Err(HarnessError::Missing(format!(
                "{label} contains forbidden remote marker '{marker}'"
            )));
        }
    }
    Ok(())
}

fn require_manifest_value(
    fields: &BTreeMap<String, String>,
    key: &str,
    expected: &str,
) -> Result<(), HarnessError> {
    match fields.get(key) {
        Some(actual) if actual == expected => Ok(()),
        Some(actual) => Err(HarnessError::Missing(format!(
            "manifest {key} expected '{expected}' but got '{actual}'"
        ))),
        None => Err(HarnessError::Missing(format!("manifest key {key}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_loopback_http_url() {
        let parsed = HttpUrl::parse("http://127.0.0.1:8080/app/").expect("url");
        assert_eq!(
            parsed,
            HttpUrl {
                host: "127.0.0.1".to_string(),
                port: 8080,
                path: "/app/".to_string(),
            }
        );
    }

    #[test]
    fn rejects_remote_http_url() {
        assert!(matches!(
            HttpUrl::parse("http://example.com:8080/app/"),
            Err(HarnessError::Http(_))
        ));
    }

    #[test]
    fn parses_manifest_fields() {
        let fields = parse_manifest("a=1\n# skip\nb = two\n");
        assert_eq!(fields.get("a").map(String::as_str), Some("1"));
        assert_eq!(fields.get("b").map(String::as_str), Some("two"));
    }

    #[test]
    fn parses_http_response() {
        let response =
            parse_http_response(b"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<body>")
                .expect("response");
        assert_eq!(response.status, 200);
        assert_eq!(
            response.headers.get("content-type").map(String::as_str),
            Some("text/html")
        );
        assert_eq!(response.body, b"<body>");
    }

    #[test]
    fn rejects_remote_markers() {
        assert!(require_no_remote_markers("x", "fetch('https://example.test')").is_err());
    }

    #[test]
    fn allows_local_connect_dry_run_url_only_in_app_js() {
        assert!(require_no_remote_markers(
            "app.js",
            r#"target: "https://tinyrustlm.com/local-connect-dry-run""#
        )
        .is_ok());
        assert!(require_no_remote_markers(
            "index.html",
            r#"target: "https://tinyrustlm.com/local-connect-dry-run""#
        )
        .is_err());
    }

    #[test]
    fn allows_only_opt_in_memory_endpoints_remote_literals() {
        assert!(require_no_remote_markers(
            "index.html",
            r#"<input placeholder="https://memoryendpoints.com">"#
        )
        .is_ok());
        assert!(require_no_remote_markers(
            "index.html",
            r#"<a href="https://memoryendpoints.com">remote</a>"#
        )
        .is_err());
        assert!(require_no_remote_markers(
            "app.js",
            r#"const httpsScheme = "https://"; const withScheme = `https://${raw}`;"#
        )
        .is_ok());
        assert!(require_no_remote_markers("app.js", r#"fetch("https://example.test")"#).is_err());
    }

    #[test]
    fn detects_safe_and_unsafe_wasm_exports() {
        let source = r#"
#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 { core::ptr::null_mut() }
#[no_mangle]
pub unsafe extern "C" fn load_model(ptr: *const u8, len: usize) -> u32 { 0 }
"#;
        assert!(require_wasm_export(source, "alloc").is_ok());
        assert!(require_wasm_export(source, "load_model").is_ok());
        assert!(require_wasm_export(source, "missing").is_err());
    }
}
