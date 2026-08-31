#![doc = "Local and loopback-only six-member composition HTTP tests."]
#![doc = "These tests are not proof of LAN, outside-peer, public, or browser reachability."]

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use tinyrustlm_composition2::{write_acg2, Acg2Member, MemberRole};
use tinyrustlm_p2p::{
    direct_composition_member_route, CancellationToken, DirectCompositionBrowserOrigin,
    DirectCompositionDescriptor, DirectCompositionHttpServer, DirectCompositionMemberDescriptor,
    DirectHttpLimits, P2pError, DIRECT_COMPOSITION_HTTP_MEMBER_MEDIA_TYPE,
    DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE, DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX,
    DIRECT_COMPOSITION_MEMBER_NAMES, TINYRUSTLM_BROWSER_ORIGIN,
};

static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct TestRoot(PathBuf);

struct CompositionFixture {
    descriptor: DirectCompositionDescriptor,
    bytes: [Vec<u8>; 6],
}

struct RunningLoopbackServer {
    address: SocketAddr,
    composition_id: String,
    allowed_origin: String,
    cancellation: CancellationToken,
    worker: Option<JoinHandle<Result<(), P2pError>>>,
}

struct RawHttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

impl TestRoot {
    /// Creates one uniquely owned temporary fixture root.
    fn create(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-p2p-composition-http-test-{}-{}-{name}",
            std::process::id(),
            TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).expect("owned test root must be new");
        Self(root)
    }

    /// Returns the owned fixture root path.
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestRoot {
    /// Removes only this test's uniquely prefixed temporary root.
    fn drop(&mut self) {
        let name_is_owned = self
            .0
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("tinyrustlm-p2p-composition-http-test-"));
        if name_is_owned && self.0.parent() == Some(std::env::temp_dir().as_path()) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

impl RunningLoopbackServer {
    /// Binds and starts one server on the operating system's loopback-only port.
    fn start(descriptor: DirectCompositionDescriptor) -> Self {
        Self::start_with_origin(descriptor, DirectCompositionBrowserOrigin::production())
    }

    /// Binds one loopback server to exactly one preregistered browser origin.
    fn start_with_origin(
        descriptor: DirectCompositionDescriptor,
        allowed_origin: DirectCompositionBrowserOrigin,
    ) -> Self {
        let cancellation = CancellationToken::new();
        let server = DirectCompositionHttpServer::bind_with_origin(
            SocketAddr::from(([127, 0, 0, 1], 0)),
            descriptor,
            allowed_origin,
            DirectHttpLimits::default(),
            &cancellation,
        )
        .expect("verified loopback server bind");
        let address = server.local_addr();
        assert!(address.ip().is_loopback());
        let composition_id = server.composition_id().to_string();
        let allowed_origin = server.allowed_browser_origin().to_string();
        let serving = cancellation.clone();
        let worker = thread::spawn(move || server.serve(&serving));
        Self {
            address,
            composition_id,
            allowed_origin,
            cancellation,
            worker: Some(worker),
        }
    }

    /// Cancels serving and requires every request worker to join cleanly.
    fn stop(mut self) {
        self.cancellation.cancel();
        let result = self
            .worker
            .take()
            .expect("server worker")
            .join()
            .expect("server worker must not panic");
        assert_eq!(result, Ok(()));
    }
}

impl Drop for RunningLoopbackServer {
    /// Ensures a failed assertion cannot leave the loopback listener running.
    fn drop(&mut self) {
        self.cancellation.cancel();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

/// Produces a lowercase prefixed content ID for exact fixture bytes.
fn content_id(bytes: &[u8]) -> String {
    format!("sha256:{}", hex_lower(&Sha256::digest(bytes)))
}

/// Produces lowercase hexadecimal without adding an alternate identity library.
fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

/// Writes six synthetic files and returns their exact graph-closed descriptor.
fn fixture(root: &Path, graph_model_digest_override: Option<[u8; 32]>) -> CompositionFixture {
    let first_five = [
        b"synthetic model fixture bytes".to_vec(),
        b"synthetic tokenizer fixture bytes".to_vec(),
        b"synthetic template fixture bytes".to_vec(),
        b"synthetic sampling fixture bytes".to_vec(),
        b"synthetic prompt fixture bytes".to_vec(),
    ];
    let roles = [
        MemberRole::Model,
        MemberRole::Tokenizer,
        MemberRole::Template,
        MemberRole::Sampling,
        MemberRole::Prompt,
    ];
    let graph_members = std::array::from_fn(|index| {
        let digest: [u8; 32] = if index == 0 {
            graph_model_digest_override.unwrap_or_else(|| Sha256::digest(&first_five[0]).into())
        } else {
            Sha256::digest(&first_five[index]).into()
        };
        Acg2Member::new(roles[index], first_five[index].len() as u64, digest)
            .expect("synthetic ACG2 member")
    });
    let mut composition_bytes = Vec::new();
    let identity =
        write_acg2(&mut composition_bytes, &graph_members).expect("synthetic ACG2 fixture");
    let bytes = [
        first_five[0].clone(),
        first_five[1].clone(),
        first_five[2].clone(),
        first_five[3].clone(),
        first_five[4].clone(),
        composition_bytes,
    ];
    let paths: [PathBuf; 6] =
        std::array::from_fn(|index| root.join(DIRECT_COMPOSITION_MEMBER_NAMES[index]));
    for (path, member_bytes) in paths.iter().zip(&bytes) {
        fs::write(path, member_bytes).expect("synthetic member write");
    }
    let members = std::array::from_fn(|index| DirectCompositionMemberDescriptor {
        file_name: DIRECT_COMPOSITION_MEMBER_NAMES[index].to_string(),
        path: paths[index].clone(),
        artifact_bytes: bytes[index].len() as u64,
        artifact_id: content_id(&bytes[index]),
    });
    CompositionFixture {
        descriptor: DirectCompositionDescriptor {
            composition_id: format!("sha256:{}", hex_lower(&identity.graph_identity_sha256)),
            members,
        },
        bytes,
    }
}

/// Sends one complete raw HTTP/1.1 request over loopback and parses its response.
fn raw_request(peer: SocketAddr, request: &str) -> RawHttpResponse {
    let mut stream = TcpStream::connect(peer).expect("raw loopback connect");
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("raw read timeout");
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .expect("raw write timeout");
    stream.write_all(request.as_bytes()).expect("raw request");
    let mut response = Vec::new();
    stream.read_to_end(&mut response).expect("raw response");
    parse_raw_response(&response)
}

/// Parses the strict response shape emitted by the loopback fixture server.
fn parse_raw_response(response: &[u8]) -> RawHttpResponse {
    let header_end = response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .expect("response header terminator");
    let head = std::str::from_utf8(&response[..header_end]).expect("ASCII response head");
    let mut lines = head.split("\r\n");
    let status = lines
        .next()
        .and_then(|line| line.split(' ').nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .expect("numeric response status");
    let headers = lines
        .map(|line| line.split_once(':').expect("response header"))
        .map(|(name, value)| (name.to_ascii_lowercase(), value.trim().to_string()))
        .collect();
    RawHttpResponse {
        status,
        headers,
        body: response[(header_end + 4)..].to_vec(),
    }
}

/// Builds one exact browser GET request for a fixed member route.
fn get_request(route: &str) -> String {
    format!(
        "GET {route} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: {TINYRUSTLM_BROWSER_ORIGIN}\r\nConnection: close\r\n\r\n"
    )
}

/// Requires descriptor binding to fail without imposing `Debug` on a live server.
fn bind_error(
    descriptor: DirectCompositionDescriptor,
    cancellation: &CancellationToken,
) -> P2pError {
    match DirectCompositionHttpServer::bind(
        SocketAddr::from(([127, 0, 0, 1], 0)),
        descriptor,
        DirectHttpLimits::default(),
        cancellation,
    ) {
        Err(error) => error,
        Ok(_) => panic!("composition descriptor unexpectedly bound"),
    }
}

#[test]
fn serves_all_six_fixed_routes_with_exact_credential_free_cors() {
    let root = TestRoot::create("six-routes");
    let fixture = fixture(root.path(), None);
    let expected_ids: [String; 6] =
        std::array::from_fn(|index| fixture.descriptor.members[index].artifact_id.clone());
    let server = RunningLoopbackServer::start(fixture.descriptor);

    assert_eq!(
        DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE,
        "tinyrustlm.direct-composition-http.v1"
    );
    assert_eq!(
        DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX,
        "/tinyrustlm/direct-composition/v1"
    );
    for (index, file_name) in DIRECT_COMPOSITION_MEMBER_NAMES.iter().enumerate() {
        let route = direct_composition_member_route(&server.composition_id, file_name)
            .expect("fixed member route");
        let response = raw_request(server.address, &get_request(&route));
        assert_eq!(response.status, 200, "{file_name}");
        assert_eq!(response.body, fixture.bytes[index], "{file_name}");
        assert_eq!(
            response.headers.get("content-length"),
            Some(&fixture.bytes[index].len().to_string())
        );
        assert_eq!(
            response.headers.get("content-type").map(String::as_str),
            Some(DIRECT_COMPOSITION_HTTP_MEMBER_MEDIA_TYPE)
        );
        assert_eq!(
            response
                .headers
                .get("x-tinyrustlm-composition-id")
                .map(String::as_str),
            Some(server.composition_id.as_str())
        );
        assert_eq!(
            response
                .headers
                .get("x-tinyrustlm-member-name")
                .map(String::as_str),
            Some(*file_name)
        );
        assert_eq!(
            response.headers.get("x-tinyrustlm-member-id"),
            Some(&expected_ids[index])
        );
        assert_eq!(
            response
                .headers
                .get("access-control-allow-origin")
                .map(String::as_str),
            Some(TINYRUSTLM_BROWSER_ORIGIN)
        );
        assert!(!response
            .headers
            .contains_key("access-control-allow-credentials"));
        assert!(!response.headers.contains_key("location"));
    }

    let route =
        direct_composition_member_route(&server.composition_id, DIRECT_COMPOSITION_MEMBER_NAMES[0])
            .expect("fixed member route");
    let options = raw_request(
        server.address,
        &format!(
            "OPTIONS {route} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: {TINYRUSTLM_BROWSER_ORIGIN}\r\nAccess-Control-Request-Method: GET\r\nConnection: close\r\n\r\n"
        ),
    );
    assert_eq!(options.status, 204);
    assert!(options.body.is_empty());
    assert_eq!(
        options
            .headers
            .get("access-control-allow-methods")
            .map(String::as_str),
        Some("GET, OPTIONS")
    );
    assert!(!options
        .headers
        .contains_key("access-control-allow-credentials"));
    server.stop();
}

#[test]
fn rejects_alternate_origins_methods_credentials_and_route_forms() {
    let root = TestRoot::create("strict-http");
    let fixture = fixture(root.path(), None);
    let server = RunningLoopbackServer::start(fixture.descriptor);
    let route =
        direct_composition_member_route(&server.composition_id, DIRECT_COMPOSITION_MEMBER_NAMES[0])
            .expect("fixed member route");

    let wrong_origin = raw_request(
        server.address,
        &format!(
            "GET {route} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: https://www.tinyrustlm.com\r\nConnection: close\r\n\r\n"
        ),
    );
    assert_eq!(wrong_origin.status, 403);
    assert!(!wrong_origin
        .headers
        .contains_key("access-control-allow-origin"));

    let post = raw_request(
        server.address,
        &format!(
            "POST {route} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: {TINYRUSTLM_BROWSER_ORIGIN}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        ),
    );
    assert_eq!(post.status, 405);
    assert_eq!(
        post.headers.get("allow").map(String::as_str),
        Some("GET, OPTIONS")
    );

    let credentialed = raw_request(
        server.address,
        &format!(
            "GET {route} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: {TINYRUSTLM_BROWSER_ORIGIN}\r\nCookie: session=forbidden\r\nConnection: close\r\n\r\n"
        ),
    );
    assert_eq!(credentialed.status, 400);

    for target in [
        format!("{route}?member=model.slm2"),
        format!("{route}/extra"),
        format!(
            "{DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX}/compositions/sha256:{}/members/model.slm2",
            "0".repeat(64)
        ),
        format!(
            "{DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX}/compositions/{}/members/../model.slm2",
            server.composition_id
        ),
    ] {
        let response = raw_request(server.address, &get_request(&target));
        assert_eq!(response.status, 404, "{target}");
        assert!(!response.headers.contains_key("location"));
    }
    server.stop();
}

#[test]
fn admits_one_explicit_local_demo_origin_without_reflection() {
    const DEMO_ORIGIN: &str = "http://127.0.0.1:4173";
    let root = TestRoot::create("demo-origin");
    let fixture = fixture(root.path(), None);
    let origin = DirectCompositionBrowserOrigin::parse(DEMO_ORIGIN).expect("demo origin");
    let server = RunningLoopbackServer::start_with_origin(fixture.descriptor, origin);
    assert_eq!(server.allowed_origin, DEMO_ORIGIN);
    let route =
        direct_composition_member_route(&server.composition_id, DIRECT_COMPOSITION_MEMBER_NAMES[0])
            .expect("fixed member route");

    let admitted = raw_request(
        server.address,
        &format!(
            "GET {route} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: {DEMO_ORIGIN}\r\nConnection: close\r\n\r\n"
        ),
    );
    assert_eq!(admitted.status, 200);
    assert_eq!(
        admitted
            .headers
            .get("access-control-allow-origin")
            .map(String::as_str),
        Some(DEMO_ORIGIN)
    );
    assert!(!admitted
        .headers
        .contains_key("access-control-allow-credentials"));

    let production_origin = raw_request(server.address, &get_request(&route));
    assert_eq!(production_origin.status, 403);
    assert!(!production_origin
        .headers
        .contains_key("access-control-allow-origin"));
    server.stop();
}

#[test]
fn origin_parser_accepts_one_canonical_origin_and_rejects_permissive_forms() {
    assert_eq!(
        DirectCompositionBrowserOrigin::production().as_str(),
        TINYRUSTLM_BROWSER_ORIGIN
    );
    for valid in [
        "http://127.0.0.1:4173",
        "http://[::1]:4173",
        "https://peer.example.net",
        "https://peer.example.net:444",
    ] {
        assert_eq!(
            DirectCompositionBrowserOrigin::parse(valid)
                .expect("canonical origin")
                .as_str(),
            valid
        );
    }
    for invalid in [
        "*",
        "https://tinyrustlm.com/",
        "https://tinyrustlm.com:443",
        "https://TINYRUSTLM.com",
        "https://user@tinyrustlm.com",
        "https://tinyrustlm.com/path",
        "https://tinyrustlm.com?query=yes",
        "https://tinyrustlm.com#fragment",
        "https://one.example,https://two.example",
        "file://tinyrustlm.com",
    ] {
        let error = DirectCompositionBrowserOrigin::parse(invalid)
            .expect_err("permissive origin form must fail");
        assert_eq!(error.code(), "p2p-composition-http-origin", "{invalid}");
    }
}

#[test]
fn bind_rejects_identity_length_graph_and_cancellation_drift() {
    let root = TestRoot::create("bind-negatives");
    let base = fixture(root.path(), None);
    let mut wrong_hash = base.descriptor.clone();
    wrong_hash.members[0].artifact_id = format!("sha256:{}", "0".repeat(64));
    let error = bind_error(wrong_hash, &CancellationToken::new());
    assert_eq!(error.code(), "p2p-composition-http-hash");

    let mut wrong_length = base.descriptor.clone();
    wrong_length.members[1].artifact_bytes += 1;
    let error = bind_error(wrong_length, &CancellationToken::new());
    assert_eq!(error.code(), "p2p-composition-http-length");

    let mut wrong_graph_id = base.descriptor.clone();
    wrong_graph_id.composition_id = format!("sha256:{}", "1".repeat(64));
    let error = bind_error(wrong_graph_id, &CancellationToken::new());
    assert_eq!(error.code(), "p2p-composition-http-closure");

    let graph_drift_root = TestRoot::create("graph-drift");
    let graph_drift = fixture(graph_drift_root.path(), Some([9_u8; 32]));
    let error = bind_error(graph_drift.descriptor, &CancellationToken::new());
    assert_eq!(error.code(), "p2p-composition-http-closure");

    let cancelled = CancellationToken::new();
    cancelled.cancel();
    let error = bind_error(base.descriptor, &cancelled);
    assert_eq!(error.code(), "p2p-cancelled");
}

#[test]
fn route_builder_accepts_only_exact_ids_and_fixed_member_names() {
    let identity = format!("sha256:{}", "a".repeat(64));
    assert!(direct_composition_member_route(&identity, "model.slm2").is_ok());
    assert!(direct_composition_member_route(&identity, "model.slm2/extra").is_err());
    assert!(direct_composition_member_route(&identity, "../model.slm2").is_err());
    assert!(direct_composition_member_route(&identity[7..], "model.slm2").is_err());
}
