use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, TryLockError};
use std::thread::{self, JoinHandle};

use tinyrustlm_composition2::{
    Acg2Graph, Acg2Policy, MemberRole, ACG2_FORMAT_PROFILE_ID, ACG2_FORMAT_PROFILE_SHA256,
};
use url::{Host, Url};

use crate::direct_http::{
    check_active, deadline_after, hex_lower, parse_request_head, read_header_block,
    reap_finished_workers, valid_content_id, write_all_bounded, write_empty_response,
    write_response_head, ACCEPT_POLL, STREAM_BUFFER_BYTES,
};
use crate::storage::open_regular_file;
use crate::{
    CancellationToken, DirectCompositionSeedDescriptor, DirectCompositionSeedMember,
    DirectHttpLimits, P2pError, DIRECT_COMPOSITION_SEED_SCHEMA,
};

/// Fixed path prefix for the browser-facing six-member composition protocol.
pub const DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX: &str = "/tinyrustlm/direct-composition/v1";
/// Exact catalog protocol profile consumed by the standalone browser installer.
pub const DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE: &str = "tinyrustlm.direct-composition-http.v1";
/// Exact media type for every complete composition member response.
pub const DIRECT_COMPOSITION_HTTP_MEMBER_MEDIA_TYPE: &str = "application/octet-stream";
/// Sole production browser origin admitted by this server.
pub const TINYRUSTLM_BROWSER_ORIGIN: &str = "https://tinyrustlm.com";
/// Exact maximum sum of the six role-specific ACG2 profile limits.
pub const MAXIMUM_DIRECT_COMPOSITION_BYTES: u64 = 68_787_701_384;
/// Sole closed composition-member order and fixed route filenames.
pub const DIRECT_COMPOSITION_MEMBER_NAMES: [&str; 6] = [
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2",
];

/// One exact canonical browser origin admitted by a composition server.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DirectCompositionBrowserOrigin(String);

impl DirectCompositionBrowserOrigin {
    /// Parses canonical HTTPS or explicitly ported loopback HTTP with no URL suffix.
    pub fn parse(value: &str) -> Result<Self, P2pError> {
        let parsed = Url::parse(value).map_err(|_| P2pError::new("p2p-composition-http-origin"))?;
        let canonical_origin = parsed.origin().ascii_serialization();
        let loopback = match parsed.host() {
            Some(Host::Domain(host)) => host == "localhost",
            Some(Host::Ipv4(address)) => address == std::net::Ipv4Addr::LOCALHOST,
            Some(Host::Ipv6(address)) => address == std::net::Ipv6Addr::LOCALHOST,
            None => false,
        };
        let transport_allowed = parsed.scheme() == "https"
            || (parsed.scheme() == "http"
                && loopback
                && parsed.port().is_some_and(|port| port > 0));
        if !transport_allowed
            || parsed.cannot_be_a_base()
            || parsed.host_str().is_none()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
            || canonical_origin != value
        {
            return Err(P2pError::new("p2p-composition-http-origin"));
        }
        Ok(Self(canonical_origin))
    }

    /// Returns the sole production browser origin.
    pub fn production() -> Self {
        Self(TINYRUSTLM_BROWSER_ORIGIN.to_string())
    }

    /// Returns the exact value required in the browser `Origin` header.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

const GRAPH_MEMBER_ROLES: [MemberRole; 5] = [
    MemberRole::Model,
    MemberRole::Tokenizer,
    MemberRole::Template,
    MemberRole::Sampling,
    MemberRole::Prompt,
];

/// Operator-supplied identity and local path for one fixed composition member.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DirectCompositionMemberDescriptor {
    /// Exact fixed member filename in the closed six-member order.
    pub file_name: String,
    /// Local regular file opened and retained by the bound server.
    pub path: PathBuf,
    /// Exact complete file length.
    pub artifact_bytes: u64,
    /// Exact `sha256:<lowercase-hex>` content ID of the complete file.
    pub artifact_id: String,
}

/// One operator-supplied graph identity and its exact six-member closure.
///
/// Binding independently verifies the byte identities and graph closure. It does not
/// establish qualification, publication, catalog presence, or outside reachability.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DirectCompositionDescriptor {
    /// Exact `sha256:<lowercase-hex>` ACG2 graph identity used in every route.
    pub composition_id: String,
    /// Exact six members in [`DIRECT_COMPOSITION_MEMBER_NAMES`] order.
    pub members: [DirectCompositionMemberDescriptor; 6],
}

/// Bound server for one verified six-member composition and its deterministic routes.
pub struct DirectCompositionHttpServer {
    listener: TcpListener,
    local_address: SocketAddr,
    composition: Arc<ServedComposition>,
    limits: DirectHttpLimits,
}

impl DirectCompositionHttpServer {
    /// Verifies one descriptor under bounded time and opens its fixed HTTP listener.
    pub fn bind(
        bind_address: SocketAddr,
        descriptor: DirectCompositionDescriptor,
        limits: DirectHttpLimits,
        cancellation: &CancellationToken,
    ) -> Result<Self, P2pError> {
        Self::bind_with_origin(
            bind_address,
            descriptor,
            DirectCompositionBrowserOrigin::production(),
            limits,
            cancellation,
        )
    }

    /// Verifies and binds one descriptor for exactly one preregistered browser origin.
    pub fn bind_with_origin(
        bind_address: SocketAddr,
        descriptor: DirectCompositionDescriptor,
        allowed_origin: DirectCompositionBrowserOrigin,
        limits: DirectHttpLimits,
        cancellation: &CancellationToken,
    ) -> Result<Self, P2pError> {
        limits.validate()?;
        let verification_deadline = deadline_after(limits.transfer_timeout)?;
        let composition = Arc::new(ServedComposition::open(
            descriptor,
            allowed_origin,
            &limits,
            cancellation,
            verification_deadline,
        )?);
        let listener =
            TcpListener::bind(bind_address).map_err(|_| P2pError::new("p2p-http-bind"))?;
        listener
            .set_nonblocking(true)
            .map_err(|_| P2pError::new("p2p-http-bind"))?;
        let local_address = listener
            .local_addr()
            .map_err(|_| P2pError::new("p2p-http-bind"))?;
        Ok(Self {
            listener,
            local_address,
            composition,
            limits,
        })
    }

    /// Returns the socket address selected by the operating system.
    pub const fn local_addr(&self) -> SocketAddr {
        self.local_address
    }

    /// Returns the sole exact graph composition ID served by this instance.
    pub fn composition_id(&self) -> &str {
        &self.composition.composition_id
    }

    /// Returns the sole exact browser origin admitted by this instance.
    pub fn allowed_browser_origin(&self) -> &str {
        self.composition.allowed_origin.as_str()
    }

    /// Serves bounded requests until cancellation, then joins every active worker.
    pub fn serve(self, cancellation: &CancellationToken) -> Result<(), P2pError> {
        let mut workers = Vec::<JoinHandle<()>>::new();
        let mut failure = None;

        while !cancellation.is_cancelled() {
            if reap_finished_workers(&mut workers) {
                failure = Some(P2pError::new("p2p-http-worker"));
                break;
            }
            match self.listener.accept() {
                Ok((stream, _)) if workers.len() >= self.limits.maximum_concurrency => {
                    reject_composition_busy(stream);
                }
                Ok((stream, _)) => {
                    let composition = Arc::clone(&self.composition);
                    let limits = self.limits.clone();
                    let worker_cancellation = cancellation.clone();
                    match thread::Builder::new()
                        .name("tinyrustlm-direct-composition-http".to_string())
                        .spawn(move || {
                            let _ = handle_connection(
                                stream,
                                &composition,
                                &limits,
                                &worker_cancellation,
                            );
                        }) {
                        Ok(worker) => workers.push(worker),
                        Err(_) => {
                            failure = Some(P2pError::new("p2p-http-worker"));
                            break;
                        }
                    }
                }
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                    thread::sleep(ACCEPT_POLL);
                }
                Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
                Err(_) => {
                    failure = Some(P2pError::new("p2p-http-transport"));
                    break;
                }
            }
        }

        for worker in workers {
            if worker.join().is_err() && failure.is_none() {
                failure = Some(P2pError::new("p2p-http-worker"));
            }
        }
        failure.map_or(Ok(()), Err)
    }
}

struct ServedComposition {
    composition_id: String,
    piece_set_id: String,
    allowed_origin: DirectCompositionBrowserOrigin,
    members: [ServedCompositionMember; 6],
}

struct ServedCompositionMember {
    file_name: String,
    artifact_bytes: u64,
    artifact_id: String,
    route: String,
    file: Mutex<File>,
}

impl ServedComposition {
    /// Opens, hashes, and graph-binds all six regular files before listener creation.
    fn open(
        descriptor: DirectCompositionDescriptor,
        allowed_origin: DirectCompositionBrowserOrigin,
        limits: &DirectHttpLimits,
        cancellation: &CancellationToken,
        deadline: std::time::Instant,
    ) -> Result<Self, P2pError> {
        if !valid_content_id(&descriptor.composition_id) {
            return Err(P2pError::new("p2p-composition-http-identity"));
        }

        let mut canonical_paths = HashSet::with_capacity(DIRECT_COMPOSITION_MEMBER_NAMES.len());
        let mut total_bytes = 0_u64;
        let mut members = Vec::with_capacity(DIRECT_COMPOSITION_MEMBER_NAMES.len());
        for (index, descriptor_member) in descriptor.members.into_iter().enumerate() {
            check_active(cancellation, None, deadline)?;
            if descriptor_member.file_name != DIRECT_COMPOSITION_MEMBER_NAMES[index]
                || descriptor_member.artifact_bytes == 0
                || descriptor_member.artifact_bytes > limits.maximum_artifact_bytes
                || (index == 5
                    && descriptor_member.artifact_bytes
                        != Acg2Policy::exact_profile_limits().maximum_artifact_bytes())
                || !valid_content_id(&descriptor_member.artifact_id)
            {
                return Err(P2pError::new("p2p-composition-http-descriptor"));
            }
            total_bytes = total_bytes
                .checked_add(descriptor_member.artifact_bytes)
                .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
            if total_bytes > MAXIMUM_DIRECT_COMPOSITION_BYTES {
                return Err(P2pError::new("p2p-composition-http-descriptor"));
            }
            let canonical_path =
                fs::canonicalize(&descriptor_member.path).map_err(|_| P2pError::new("p2p-io"))?;
            if !canonical_paths.insert(canonical_path) {
                return Err(P2pError::new("p2p-composition-http-descriptor"));
            }

            let mut file = open_regular_file(&descriptor_member.path)?;
            verify_file(
                &mut file,
                descriptor_member.artifact_bytes,
                &descriptor_member.artifact_id,
                cancellation,
                deadline,
            )?;
            members.push(ServedCompositionMember {
                route: direct_composition_member_route(
                    &descriptor.composition_id,
                    &descriptor_member.file_name,
                )?,
                file_name: descriptor_member.file_name,
                artifact_bytes: descriptor_member.artifact_bytes,
                artifact_id: descriptor_member.artifact_id,
                file: Mutex::new(file),
            });
        }
        let mut members: [ServedCompositionMember; 6] = members
            .try_into()
            .map_err(|_| P2pError::new("p2p-composition-http-descriptor"))?;
        verify_graph_closure(&descriptor.composition_id, &mut members)?;
        let metadata = DirectCompositionSeedDescriptor {
            schema: DIRECT_COMPOSITION_SEED_SCHEMA.to_string(),
            protocol: DIRECT_COMPOSITION_HTTP_PROTOCOL_PROFILE.to_string(),
            composition_profile: ACG2_FORMAT_PROFILE_ID.to_string(),
            composition_profile_sha256: ACG2_FORMAT_PROFILE_SHA256.to_string(),
            composition_id: descriptor.composition_id.clone(),
            members: members
                .iter()
                .map(|member| DirectCompositionSeedMember {
                    name: member.file_name.clone(),
                    bytes: member.artifact_bytes,
                    sha256: member.artifact_id[7..].to_string(),
                })
                .collect(),
        };
        let mut canonical = serde_json::to_vec(&metadata)
            .map_err(|_| P2pError::new("p2p-composition-http-descriptor"))?;
        canonical.push(b'\n');
        let piece_set_id = format!("sha256:{}", hex_lower(&Sha256::digest(&canonical)));
        Ok(Self {
            composition_id: descriptor.composition_id,
            piece_set_id,
            allowed_origin,
            members,
        })
    }
}

/// Builds the sole route for one validated composition ID and fixed member name.
pub fn direct_composition_member_route(
    composition_id: &str,
    file_name: &str,
) -> Result<String, P2pError> {
    if !valid_content_id(composition_id) || !DIRECT_COMPOSITION_MEMBER_NAMES.contains(&file_name) {
        return Err(P2pError::new("p2p-composition-http-route"));
    }
    Ok(format!(
        "{DIRECT_COMPOSITION_HTTP_ROUTE_PREFIX}/compositions/{composition_id}/members/{file_name}"
    ))
}

/// Verifies one retained regular-file handle without buffering the complete artifact.
fn verify_file(
    file: &mut File,
    expected_bytes: u64,
    expected_id: &str,
    cancellation: &CancellationToken,
    deadline: std::time::Instant,
) -> Result<(), P2pError> {
    if file.metadata().map_err(|_| P2pError::new("p2p-io"))?.len() != expected_bytes {
        return Err(P2pError::new("p2p-composition-http-length"));
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|_| P2pError::new("p2p-io"))?;
    let mut remaining = expected_bytes;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; STREAM_BUFFER_BYTES];
    while remaining != 0 {
        check_active(cancellation, None, deadline)?;
        let requested = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| P2pError::new("p2p-arithmetic"))?;
        let count = file
            .read(&mut buffer[..requested])
            .map_err(|_| P2pError::new("p2p-io"))?;
        if count == 0 {
            return Err(P2pError::new("p2p-composition-http-length"));
        }
        hasher.update(&buffer[..count]);
        remaining -= count as u64;
    }
    let mut trailing = [0_u8; 1];
    if file
        .read(&mut trailing)
        .map_err(|_| P2pError::new("p2p-io"))?
        != 0
    {
        return Err(P2pError::new("p2p-composition-http-length"));
    }
    let observed_id = format!("sha256:{}", hex_lower(&hasher.finalize()));
    if observed_id != expected_id {
        return Err(P2pError::new("p2p-composition-http-hash"));
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|_| P2pError::new("p2p-io"))?;
    Ok(())
}

/// Parses the retained ACG2 member and closes it over all five described artifacts.
fn verify_graph_closure(
    composition_id: &str,
    members: &mut [ServedCompositionMember; 6],
) -> Result<(), P2pError> {
    let composition_member = &mut members[5];
    let file = composition_member
        .file
        .get_mut()
        .map_err(|_| P2pError::new("p2p-http-worker"))?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| P2pError::new("p2p-io"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|_| P2pError::new("p2p-io"))?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| P2pError::new("p2p-io"))?;
    let graph = Acg2Graph::from_bytes(&bytes, Acg2Policy::exact_profile_limits())
        .map_err(|_| P2pError::new("p2p-composition-http-closure"))?;
    let identity = graph.identity();
    if composition_id != content_id(&identity.graph_identity_sha256)
        || composition_member.artifact_bytes != identity.artifact_bytes
        || composition_member.artifact_id != content_id(&identity.artifact_sha256)
    {
        return Err(P2pError::new("p2p-composition-http-closure"));
    }
    for (index, role) in GRAPH_MEMBER_ROLES.into_iter().enumerate() {
        let graph_member = graph.member(role);
        if members[index].artifact_bytes != graph_member.artifact_bytes()
            || members[index].artifact_id != content_id(&graph_member.artifact_sha256())
        {
            return Err(P2pError::new("p2p-composition-http-closure"));
        }
    }
    Ok(())
}

/// Handles one bounded browser request against the sole fixed route table.
fn handle_connection(
    mut stream: TcpStream,
    composition: &ServedComposition,
    limits: &DirectHttpLimits,
    cancellation: &CancellationToken,
) -> Result<(), P2pError> {
    stream
        .set_nonblocking(false)
        .map_err(|_| P2pError::new("p2p-http-transport"))?;
    stream
        .set_nodelay(true)
        .map_err(|_| P2pError::new("p2p-http-transport"))?;
    let request_deadline = deadline_after(limits.request_timeout)?;
    let (head, trailing) = read_header_block(&mut stream, request_deadline, cancellation, None)?;
    let request = match parse_request_head(&head) {
        Ok(request) if trailing.is_empty() => request,
        _ => {
            return write_empty_response(
                &mut stream,
                "400 Bad Request",
                &[],
                request_deadline,
                cancellation,
                None,
            );
        }
    };

    if request
        .headers
        .get("host")
        .map(String::is_empty)
        .unwrap_or(true)
        || request.headers.contains_key("transfer-encoding")
        || request.headers.contains_key("content-encoding")
        || request
            .headers
            .get("content-length")
            .is_some_and(|value| value != "0")
        || request.headers.contains_key("authorization")
        || request.headers.contains_key("proxy-authorization")
        || request.headers.contains_key("cookie")
    {
        return write_empty_response(
            &mut stream,
            "400 Bad Request",
            &[],
            request_deadline,
            cancellation,
            None,
        );
    }

    let allowed_origin = request.headers.get("origin").map(String::as_str)
        == Some(composition.allowed_origin.as_str());
    if !allowed_origin {
        return write_empty_response(
            &mut stream,
            "403 Forbidden",
            &[],
            request_deadline,
            cancellation,
            None,
        );
    }
    let cors_headers = cors_response_headers(&composition.allowed_origin);
    if request.method != "GET" && request.method != "OPTIONS" {
        let mut headers = cors_headers;
        headers.push(("Allow", "GET, OPTIONS".to_string()));
        return write_empty_response(
            &mut stream,
            "405 Method Not Allowed",
            &headers,
            request_deadline,
            cancellation,
            None,
        );
    }

    let Some(member) = composition
        .members
        .iter()
        .find(|member| request.target == member.route)
    else {
        return write_empty_response(
            &mut stream,
            "404 Not Found",
            &cors_headers,
            request_deadline,
            cancellation,
            None,
        );
    };

    if request.method == "OPTIONS" {
        if request
            .headers
            .get("access-control-request-method")
            .map(String::as_str)
            != Some("GET")
            || request
                .headers
                .contains_key("access-control-request-headers")
        {
            return write_empty_response(
                &mut stream,
                "400 Bad Request",
                &cors_headers,
                request_deadline,
                cancellation,
                None,
            );
        }
        let mut headers = cors_headers;
        headers.push(("Access-Control-Allow-Methods", "GET, OPTIONS".to_string()));
        headers.push(("Cache-Control", "no-store".to_string()));
        return write_empty_response(
            &mut stream,
            "204 No Content",
            &headers,
            request_deadline,
            cancellation,
            None,
        );
    }

    if request.headers.contains_key("range")
        || request
            .headers
            .contains_key("access-control-request-method")
        || request
            .headers
            .contains_key("access-control-request-headers")
    {
        return write_empty_response(
            &mut stream,
            "400 Bad Request",
            &cors_headers,
            request_deadline,
            cancellation,
            None,
        );
    }

    let transfer_deadline = deadline_after(limits.transfer_timeout)?;
    stream_member(
        &mut stream,
        composition,
        member,
        transfer_deadline,
        cancellation,
    )
}

/// Emits the exact credential-free CORS headers for an admitted browser origin.
fn cors_response_headers(
    allowed_origin: &DirectCompositionBrowserOrigin,
) -> Vec<(&'static str, String)> {
    vec![
        (
            "Access-Control-Allow-Origin",
            allowed_origin.as_str().to_string(),
        ),
        ("Vary", "Origin".to_string()),
    ]
}

/// Streams one retained member handle under the transfer deadline and cancellation token.
fn stream_member(
    stream: &mut TcpStream,
    composition: &ServedComposition,
    member: &ServedCompositionMember,
    deadline: std::time::Instant,
    cancellation: &CancellationToken,
) -> Result<(), P2pError> {
    let mut headers = cors_response_headers(&composition.allowed_origin);
    headers.extend([
        (
            "Access-Control-Expose-Headers",
            "Content-Length, Content-Type, X-TinyRustLM-Composition-Id, X-TinyRustLM-Piece-Set-Id, X-TinyRustLM-Member-Name, X-TinyRustLM-Member-Id"
                .to_string(),
        ),
        (
            "Content-Type",
            DIRECT_COMPOSITION_HTTP_MEMBER_MEDIA_TYPE.to_string(),
        ),
        ("Cache-Control", "no-store, no-transform".to_string()),
        (
            "X-TinyRustLM-Composition-Id",
            composition.composition_id.clone(),
        ),
        ("X-TinyRustLM-Piece-Set-Id", composition.piece_set_id.clone()),
        ("X-TinyRustLM-Member-Name", member.file_name.clone()),
        ("X-TinyRustLM-Member-Id", member.artifact_id.clone()),
    ]);
    write_response_head(
        stream,
        "200 OK",
        &headers,
        member.artifact_bytes,
        deadline,
        cancellation,
        None,
    )?;

    let mut source = lock_file(&member.file, deadline, cancellation)?;
    source
        .seek(SeekFrom::Start(0))
        .map_err(|_| P2pError::new("p2p-io"))?;
    let mut remaining = member.artifact_bytes;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; STREAM_BUFFER_BYTES];
    while remaining != 0 {
        check_active(cancellation, None, deadline)?;
        let requested = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| P2pError::new("p2p-arithmetic"))?;
        let count = source
            .read(&mut buffer[..requested])
            .map_err(|_| P2pError::new("p2p-io"))?;
        if count == 0 {
            return Err(P2pError::new("p2p-composition-http-length"));
        }
        hasher.update(&buffer[..count]);
        write_all_bounded(stream, &buffer[..count], deadline, cancellation, None)?;
        remaining -= count as u64;
    }
    let observed_id = format!("sha256:{}", hex_lower(&hasher.finalize()));
    if observed_id != member.artifact_id {
        return Err(P2pError::new("p2p-composition-http-hash"));
    }
    Ok(())
}

/// Acquires one retained file handle without escaping the transfer deadline.
fn lock_file<'a>(
    file: &'a Mutex<File>,
    deadline: std::time::Instant,
    cancellation: &CancellationToken,
) -> Result<MutexGuard<'a, File>, P2pError> {
    loop {
        check_active(cancellation, None, deadline)?;
        match file.try_lock() {
            Ok(guard) => return Ok(guard),
            Err(TryLockError::WouldBlock) => thread::sleep(ACCEPT_POLL),
            Err(TryLockError::Poisoned(_)) => {
                return Err(P2pError::new("p2p-http-worker"));
            }
        }
    }
}

/// Returns one canonical prefixed SHA-256 content ID.
fn content_id(digest: &[u8; 32]) -> String {
    format!("sha256:{}", hex_lower(digest))
}

/// Rejects excess concurrency without advertising a retry contract.
fn reject_composition_busy(mut stream: TcpStream) {
    let _ = stream.set_write_timeout(Some(ACCEPT_POLL));
    let _ = stream.write_all(
        b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n",
    );
}
