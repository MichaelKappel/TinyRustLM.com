#![doc = "Subprocess tests for the strict direct-composition seed CLI."]
#![doc = "Loopback and synthetic bytes are not outside-peer or model evidence."]

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use tinyrustlm_composition2::{
    write_acg2, Acg2Member, MemberRole, ACG2_FORMAT_PROFILE_ID, ACG2_FORMAT_PROFILE_SHA256,
};
use tinyrustlm_p2p::{
    direct_composition_member_route, DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE,
    DIRECT_COMPOSITION_MEMBER_NAMES, TINYRUSTLM_BROWSER_ORIGIN,
};

const BINARY: &str = env!("CARGO_BIN_EXE_tinyrustlm-p2p-seed");
const DESCRIPTOR_SCHEMA: &str = "tinyrustlm.direct-composition-seed/1";
const DEMO_ORIGIN: &str = "http://127.0.0.1:4173";
const MEMBER_FLAGS: [&str; 6] = [
    "--model",
    "--tokenizer",
    "--template",
    "--sampling",
    "--prompt",
    "--composition",
];
static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct TestRoot(PathBuf);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TestDescriptor {
    schema: String,
    protocol: String,
    composition_profile: String,
    composition_profile_sha256: String,
    composition_id: String,
    members: Vec<TestMember>,
}

#[derive(Clone, Serialize)]
struct TestMember {
    name: String,
    bytes: u64,
    sha256: String,
}

struct SeedFixture {
    descriptor_path: PathBuf,
    descriptor: TestDescriptor,
    member_paths: [PathBuf; 6],
    member_bytes: [Vec<u8>; 6],
}

struct RunningSeed {
    child: Child,
}

impl TestRoot {
    /// Creates one uniquely owned temporary CLI fixture root.
    fn create(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-p2p-seed-test-{}-{}-{name}",
            std::process::id(),
            TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).expect("owned test root must be new");
        Self(root)
    }

    /// Returns the owned temporary root path.
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestRoot {
    /// Removes only this test's uniquely prefixed temporary root.
    fn drop(&mut self) {
        let owned = self
            .0
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("tinyrustlm-p2p-seed-test-"));
        if owned && self.0.parent() == Some(std::env::temp_dir().as_path()) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

impl RunningSeed {
    /// Starts one long-running seed subprocess with captured public output.
    fn spawn(mut command: Command) -> Self {
        let child = command
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("seed subprocess start");
        Self { child }
    }

    /// Reads exactly the first readiness line under a bounded test deadline.
    fn readiness_line(&mut self) -> String {
        let stdout = self.child.stdout.take().expect("captured seed stdout");
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let mut line = String::new();
            let result = BufReader::new(stdout).read_line(&mut line).map(|_| line);
            let _ = sender.send(result);
        });
        receiver
            .recv_timeout(Duration::from_secs(5))
            .expect("bounded readiness wait")
            .expect("readiness read")
    }

    /// Terminates the intentionally long-running loopback server and waits for process closure.
    fn stop(mut self) {
        self.terminate();
    }

    /// Performs bounded best-effort process termination for normal and panic cleanup.
    fn terminate(&mut self) {
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
        }
        let _ = self.child.wait();
    }
}

impl Drop for RunningSeed {
    /// Prevents a failed assertion from leaving a seed process behind.
    fn drop(&mut self) {
        self.terminate();
    }
}

/// Returns lowercase hexadecimal for exact fixture digests.
fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

/// Returns the exact SHA-256 of one synthetic member.
fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

/// Writes one graph-closed six-member synthetic seed fixture.
fn fixture(root: &Path) -> SeedFixture {
    let first_five = [
        b"synthetic CLI model bytes".to_vec(),
        b"synthetic CLI tokenizer bytes".to_vec(),
        b"synthetic CLI template bytes".to_vec(),
        b"synthetic CLI sampling bytes".to_vec(),
        b"synthetic CLI prompt bytes".to_vec(),
    ];
    let roles = [
        MemberRole::Model,
        MemberRole::Tokenizer,
        MemberRole::Template,
        MemberRole::Sampling,
        MemberRole::Prompt,
    ];
    let graph_members = std::array::from_fn(|index| {
        Acg2Member::new(
            roles[index],
            first_five[index].len() as u64,
            sha256(&first_five[index]),
        )
        .expect("synthetic graph member")
    });
    let mut composition_bytes = Vec::new();
    let identity =
        write_acg2(&mut composition_bytes, &graph_members).expect("synthetic ACG2 fixture");
    let member_bytes = [
        first_five[0].clone(),
        first_five[1].clone(),
        first_five[2].clone(),
        first_five[3].clone(),
        first_five[4].clone(),
        composition_bytes,
    ];
    let member_paths: [PathBuf; 6] =
        std::array::from_fn(|index| root.join(DIRECT_COMPOSITION_MEMBER_NAMES[index]));
    for (path, bytes) in member_paths.iter().zip(&member_bytes) {
        fs::write(path, bytes).expect("synthetic member write");
    }
    let descriptor = TestDescriptor {
        schema: DESCRIPTOR_SCHEMA.to_string(),
        protocol: DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE.to_string(),
        composition_profile: ACG2_FORMAT_PROFILE_ID.to_string(),
        composition_profile_sha256: ACG2_FORMAT_PROFILE_SHA256.to_string(),
        composition_id: format!("sha256:{}", hex_lower(&identity.graph_identity_sha256)),
        members: member_bytes
            .iter()
            .enumerate()
            .map(|(index, bytes)| TestMember {
                name: DIRECT_COMPOSITION_MEMBER_NAMES[index].to_string(),
                bytes: bytes.len() as u64,
                sha256: hex_lower(&sha256(bytes)),
            })
            .collect(),
    };
    let descriptor_path = root.join("seed.json");
    write_descriptor(&descriptor_path, &descriptor);
    SeedFixture {
        descriptor_path,
        descriptor,
        member_paths,
        member_bytes,
    }
}

/// Writes the sole compact canonical descriptor representation with one final newline.
fn write_descriptor(path: &Path, descriptor: &TestDescriptor) {
    let mut bytes = serde_json::to_vec(descriptor).expect("canonical descriptor JSON");
    bytes.push(b'\n');
    fs::write(path, bytes).expect("canonical descriptor write");
}

/// Builds one exact seed command without environment defaults or alternate paths.
fn seed_command(
    fixture: &SeedFixture,
    bind_address: SocketAddr,
    allowed_origin: Option<&str>,
) -> Command {
    let mut command = Command::new(BINARY);
    command
        .arg("--descriptor")
        .arg(&fixture.descriptor_path)
        .arg("--bind")
        .arg(bind_address.to_string());
    if let Some(origin) = allowed_origin {
        command.arg("--allow-origin").arg(origin);
    }
    for (flag, path) in MEMBER_FLAGS.iter().zip(&fixture.member_paths) {
        command.arg(flag).arg(path);
    }
    command
}

/// Runs one expected-terminal CLI command with a bounded subprocess deadline.
fn bounded_output(mut command: Command) -> Output {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("terminal seed subprocess start");
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if child.try_wait().expect("terminal seed poll").is_some() {
            return child.wait_with_output().expect("terminal seed output");
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            panic!("seed subprocess did not reach a terminal failure");
        }
        thread::sleep(Duration::from_millis(10));
    }
}

/// Requires one exact public-safe typed failure and no readiness output.
fn assert_failure(output: &Output, exit_code: i32, code: &str, private_root: &Path) {
    assert_eq!(output.status.code(), Some(exit_code));
    assert!(output.stdout.is_empty());
    let stderr = std::str::from_utf8(&output.stderr).expect("failure UTF-8");
    let value: Value = serde_json::from_str(stderr).expect("failure JSON");
    let object = value.as_object().expect("failure object");
    assert_eq!(object.len(), 1);
    assert_eq!(object.get("error").and_then(Value::as_str), Some(code));
    assert!(!stderr.contains(&private_root.display().to_string()));
}

/// Parses and validates the exact public readiness object.
fn parse_readiness(
    line: &str,
    fixture: &SeedFixture,
    private_root: &Path,
    expected_origin: &str,
) -> SocketAddr {
    let value: Value = serde_json::from_str(line).expect("readiness JSON");
    let object = value.as_object().expect("readiness object");
    let keys = object.keys().map(String::as_str).collect::<BTreeSet<_>>();
    assert_eq!(
        keys,
        BTreeSet::from([
            "allowedBrowserOrigin",
            "boundOrigin",
            "compositionId",
            "protocol",
        ])
    );
    assert_eq!(
        object.get("protocol").and_then(Value::as_str),
        Some(DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE)
    );
    assert_eq!(
        object.get("compositionId").and_then(Value::as_str),
        Some(fixture.descriptor.composition_id.as_str())
    );
    assert_eq!(
        object.get("allowedBrowserOrigin").and_then(Value::as_str),
        Some(expected_origin)
    );
    assert!(!line.contains(&private_root.display().to_string()));
    assert!(!line.contains("announcement"));
    assert!(!line.contains("outside"));
    object
        .get("boundOrigin")
        .and_then(Value::as_str)
        .and_then(|origin| origin.strip_prefix("http://"))
        .expect("bound HTTP origin")
        .parse()
        .expect("bound socket address")
}

/// Fetches one fixed member route over loopback and returns head and body bytes.
fn raw_get(peer: SocketAddr, route: &str, origin: &str) -> (String, Vec<u8>) {
    let mut stream = TcpStream::connect(peer).expect("seed loopback connect");
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("seed read timeout");
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .expect("seed write timeout");
    write!(
        stream,
        "GET {route} HTTP/1.1\r\nHost: {peer}\r\nOrigin: {origin}\r\nConnection: close\r\n\r\n"
    )
    .expect("seed HTTP request");
    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .expect("seed HTTP response");
    let header_end = response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .expect("seed response header");
    (
        String::from_utf8(response[..header_end].to_vec()).expect("ASCII response head"),
        response[(header_end + 4)..].to_vec(),
    )
}

#[test]
fn serves_all_six_members_with_exact_demo_origin_and_public_readiness() {
    let root = TestRoot::create("demo-readiness");
    let fixture = fixture(root.path());
    let mut process = RunningSeed::spawn(seed_command(
        &fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        Some(DEMO_ORIGIN),
    ));
    let readiness = process.readiness_line();
    let peer = parse_readiness(&readiness, &fixture, root.path(), DEMO_ORIGIN);
    assert!(peer.ip().is_loopback());

    for (index, file_name) in DIRECT_COMPOSITION_MEMBER_NAMES.iter().enumerate() {
        let route = direct_composition_member_route(&fixture.descriptor.composition_id, file_name)
            .expect("fixed member route");
        let (head, body) = raw_get(peer, &route, DEMO_ORIGIN);
        assert!(head.starts_with("HTTP/1.1 200 OK\r\n"), "{file_name}");
        assert!(
            head.contains(&format!("Access-Control-Allow-Origin: {DEMO_ORIGIN}")),
            "{file_name}"
        );
        assert!(!head.contains("Access-Control-Allow-Credentials"));
        assert!(!head.contains("Location:"));
        assert_eq!(body, fixture.member_bytes[index], "{file_name}");
    }
    process.stop();
}

#[test]
fn cli_preserves_the_exact_production_origin_default() {
    let root = TestRoot::create("production-origin");
    let fixture = fixture(root.path());
    let mut process = RunningSeed::spawn(seed_command(
        &fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    let readiness = process.readiness_line();
    let _ = parse_readiness(&readiness, &fixture, root.path(), TINYRUSTLM_BROWSER_ORIGIN);
    process.stop();
}

#[test]
fn rejects_noncanonical_descriptor_and_member_order_before_bind() {
    let root = TestRoot::create("descriptor-negatives");
    let mut fixture = fixture(root.path());
    let pretty = serde_json::to_string_pretty(&fixture.descriptor).expect("pretty descriptor");
    fs::write(&fixture.descriptor_path, pretty).expect("noncanonical descriptor write");
    let output = bounded_output(seed_command(
        &fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(&output, 3, "p2p-seed-descriptor-canonical", root.path());

    fixture.descriptor.members.swap(0, 1);
    write_descriptor(&fixture.descriptor_path, &fixture.descriptor);
    let output = bounded_output(seed_command(
        &fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(&output, 3, "p2p-seed-descriptor-member", root.path());

    fixture.descriptor.members.swap(0, 1);
    fixture.descriptor.composition_profile_sha256 = "0".repeat(64);
    write_descriptor(&fixture.descriptor_path, &fixture.descriptor);
    let output = bounded_output(seed_command(
        &fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(&output, 3, "p2p-seed-descriptor-contract", root.path());
}

#[test]
fn independently_rejects_member_hash_and_graph_identity_drift() {
    let name_root = TestRoot::create("name-drift");
    let mut name_fixture = fixture(name_root.path());
    let renamed = name_root.path().join("renamed-model.slm2");
    fs::copy(&name_fixture.member_paths[0], &renamed).expect("renamed member copy");
    name_fixture.member_paths[0] = renamed;
    let output = bounded_output(seed_command(
        &name_fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(&output, 3, "p2p-seed-member-name", name_root.path());

    let length_root = TestRoot::create("length-drift");
    let length_fixture = fixture(length_root.path());
    fs::write(&length_fixture.member_paths[1], b"short").expect("truncated member write");
    let output = bounded_output(seed_command(
        &length_fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(&output, 3, "p2p-seed-member-length", length_root.path());

    let hash_root = TestRoot::create("hash-drift");
    let mut hash_fixture = fixture(hash_root.path());
    hash_fixture.descriptor.members[0].sha256 = "0".repeat(64);
    write_descriptor(&hash_fixture.descriptor_path, &hash_fixture.descriptor);
    let output = bounded_output(seed_command(
        &hash_fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(&output, 3, "p2p-seed-member-hash", hash_root.path());

    let graph_root = TestRoot::create("graph-drift");
    let mut graph_fixture = fixture(graph_root.path());
    graph_fixture.descriptor.composition_id = format!("sha256:{}", "1".repeat(64));
    write_descriptor(&graph_fixture.descriptor_path, &graph_fixture.descriptor);
    let output = bounded_output(seed_command(
        &graph_fixture,
        SocketAddr::from(([127, 0, 0, 1], 0)),
        None,
    ));
    assert_failure(
        &output,
        3,
        "p2p-seed-composition-closure",
        graph_root.path(),
    );
}

#[test]
fn rejects_permissive_origin_forms_and_exits_after_one_bind_failure() {
    let root = TestRoot::create("origin-and-bind");
    let fixture = fixture(root.path());
    for invalid in [
        "*",
        "http://127.0.0.1:4173/path",
        "http://127.0.0.1:4173?query=yes",
        "http://one.example,http://two.example",
    ] {
        let output = bounded_output(seed_command(
            &fixture,
            SocketAddr::from(([127, 0, 0, 1], 0)),
            Some(invalid),
        ));
        assert_failure(&output, 2, "p2p-composition-http-origin", root.path());
    }

    let occupied =
        TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).expect("occupied loopback bind");
    let output = bounded_output(seed_command(
        &fixture,
        occupied.local_addr().expect("occupied address"),
        Some(DEMO_ORIGIN),
    ));
    assert_failure(&output, 4, "p2p-http-bind", root.path());
}
