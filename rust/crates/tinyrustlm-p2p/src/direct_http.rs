use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::io::{self, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use crate::manifest::{inspect_manifest, MAXIMUM_MANIFEST_BYTES};
use crate::storage::{
    canonical_regular_directory, open_regular_file, piece_file_name, sync_directory,
    write_new_synced, OwnedStage, COMPLETE_FILE_NAME,
};
use crate::{
    P2pError, P2pManifest, P2pPiece, ShareKitReport, MANIFEST_FILE_NAME, PIECE_DIRECTORY_NAME,
};

/// Fixed path prefix for the direct HTTP transport protocol.
pub const DIRECT_HTTP_ROUTE_PREFIX: &str = "/tinyrustlm/direct/v1";
/// Hard artifact-size ceiling inherited from the registered P2P manifest contract.
pub const MAXIMUM_DIRECT_ARTIFACT_BYTES: u64 = 68_719_476_736;

const MANIFEST_MEDIA_TYPE: &str = "application/vnd.tinyrustlm.p2p-manifest+json";
const MAXIMUM_HTTP_HEADER_BYTES: usize = 16 * 1024;
const MAXIMUM_DIRECT_CONCURRENCY: usize = 16;
const MAXIMUM_COMPLETE_MARKER_BYTES: usize = 128;
const MAXIMUM_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const MAXIMUM_REQUEST_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const MAXIMUM_TRANSFER_TIMEOUT: Duration = Duration::from_secs(24 * 60 * 60);
const CANCELLATION_POLL: Duration = Duration::from_millis(100);
pub(crate) const ACCEPT_POLL: Duration = Duration::from_millis(10);
pub(crate) const STREAM_BUFFER_BYTES: usize = 64 * 1024;

/// Explicit resource and timing limits shared by the direct HTTP server and client.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DirectHttpLimits {
    /// Maximum complete artifact size admitted by this transport instance.
    pub maximum_artifact_bytes: u64,
    /// Maximum concurrent server requests or client piece requests.
    pub maximum_concurrency: usize,
    /// Maximum time allowed to establish one TCP connection.
    pub connect_timeout: Duration,
    /// Maximum total time allowed for one HTTP request and response.
    pub request_timeout: Duration,
    /// Maximum total time allowed for one complete client fetch.
    pub transfer_timeout: Duration,
}

impl Default for DirectHttpLimits {
    fn default() -> Self {
        Self {
            maximum_artifact_bytes: MAXIMUM_DIRECT_ARTIFACT_BYTES,
            maximum_concurrency: 4,
            connect_timeout: Duration::from_secs(5),
            request_timeout: Duration::from_secs(60),
            transfer_timeout: Duration::from_secs(60 * 60),
        }
    }
}

impl DirectHttpLimits {
    pub(crate) fn validate(&self) -> Result<(), P2pError> {
        if self.maximum_artifact_bytes == 0
            || self.maximum_artifact_bytes > MAXIMUM_DIRECT_ARTIFACT_BYTES
            || self.maximum_concurrency == 0
            || self.maximum_concurrency > MAXIMUM_DIRECT_CONCURRENCY
            || self.connect_timeout.is_zero()
            || self.connect_timeout > MAXIMUM_CONNECT_TIMEOUT
            || self.request_timeout.is_zero()
            || self.request_timeout > MAXIMUM_REQUEST_TIMEOUT
            || self.transfer_timeout.is_zero()
            || self.transfer_timeout > MAXIMUM_TRANSFER_TIMEOUT
            || self.connect_timeout > self.request_timeout
            || self.request_timeout > self.transfer_timeout
        {
            return Err(P2pError::new("p2p-http-limits"));
        }
        Ok(())
    }
}

/// Cloneable cooperative cancellation signal for server and client operations.
#[derive(Clone, Debug, Default)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    /// Creates a cancellation signal in the active state.
    pub fn new() -> Self {
        Self::default()
    }

    /// Requests cancellation for every clone of this signal.
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
    }

    /// Returns whether cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
}

/// Exact peer and identity bindings for one create-only share-kit fetch.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FetchShareKitRequest {
    /// Direct peer socket address. Host names and caller-supplied URLs are not accepted.
    pub peer: SocketAddr,
    /// New local share-kit directory. Existing paths are rejected.
    pub output_directory: PathBuf,
    /// Exact manifest content ID expected from the peer.
    pub expected_manifest_id: String,
    /// Exact artifact content ID expected in that manifest.
    pub expected_artifact_id: String,
    /// Exact sorted composition artifact IDs expected in that manifest.
    pub expected_composition_artifact_ids: Vec<String>,
}

/// Bound server for one already-completed share kit and the fixed direct HTTP routes.
pub struct DirectHttpServer {
    listener: TcpListener,
    local_address: SocketAddr,
    share: Arc<ServedShare>,
    limits: DirectHttpLimits,
}

impl DirectHttpServer {
    /// Validates a completed share kit and binds its fixed manifest and artifact routes.
    pub fn bind(
        bind_address: SocketAddr,
        share_kit_directory: &Path,
        limits: DirectHttpLimits,
    ) -> Result<Self, P2pError> {
        limits.validate()?;
        let share = Arc::new(ServedShare::open(share_kit_directory, &limits)?);
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
            share,
            limits,
        })
    }

    /// Returns the socket address selected by the operating system.
    pub const fn local_addr(&self) -> SocketAddr {
        self.local_address
    }

    /// Returns the sole manifest ID served by this instance.
    pub fn manifest_id(&self) -> &str {
        &self.share.manifest.manifest_id
    }

    /// Serves bounded requests until cancellation, then joins all active request workers.
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
                    reject_busy(stream);
                }
                Ok((stream, _)) => {
                    let share = Arc::clone(&self.share);
                    let limits = self.limits.clone();
                    let worker_cancellation = cancellation.clone();
                    match thread::Builder::new()
                        .name("tinyrustlm-direct-http".to_string())
                        .spawn(move || {
                            let _ = handle_server_connection(
                                stream,
                                &share,
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

struct ServedShare {
    piece_directory: PathBuf,
    manifest: P2pManifest,
    manifest_bytes: Vec<u8>,
    manifest_route: String,
    artifact_route: String,
}

impl ServedShare {
    fn open(directory: &Path, limits: &DirectHttpLimits) -> Result<Self, P2pError> {
        let root = canonical_regular_directory(directory)?;
        let manifest_bytes = read_regular_bounded(
            &root.join(MANIFEST_FILE_NAME),
            MAXIMUM_MANIFEST_BYTES,
            "p2p-manifest-size",
        )?;
        let manifest = inspect_manifest(&manifest_bytes)?;
        if manifest.artifact_bytes > limits.maximum_artifact_bytes {
            return Err(P2pError::new("p2p-http-size"));
        }

        let marker = read_regular_bounded(
            &root.join(COMPLETE_FILE_NAME),
            MAXIMUM_COMPLETE_MARKER_BYTES,
            "p2p-share-closure",
        )?;
        if marker != format!("{}\n", manifest.manifest_id).as_bytes() {
            return Err(P2pError::new("p2p-share-closure"));
        }

        let piece_directory = canonical_regular_directory(&root.join(PIECE_DIRECTORY_NAME))?;
        if piece_directory.parent() != Some(root.as_path()) {
            return Err(P2pError::new("p2p-path-type"));
        }
        for piece in &manifest.pieces {
            let source = open_regular_file(&piece_directory.join(piece_file_name(piece.index)?))?;
            if source
                .metadata()
                .map_err(|_| P2pError::new("p2p-io"))?
                .len()
                != piece.length
            {
                return Err(P2pError::new("p2p-piece-length"));
            }
        }

        let manifest_route = manifest_route(&manifest.manifest_id);
        let artifact_route = artifact_route(&manifest.manifest_id, &manifest.artifact_id);
        Ok(Self {
            piece_directory,
            manifest,
            manifest_bytes,
            manifest_route,
            artifact_route,
        })
    }
}

pub(crate) fn reap_finished_workers(workers: &mut Vec<JoinHandle<()>>) -> bool {
    let mut panicked = false;
    let mut position = 0;
    while position < workers.len() {
        if workers[position].is_finished() {
            let worker = workers.swap_remove(position);
            panicked |= worker.join().is_err();
        } else {
            position += 1;
        }
    }
    panicked
}

fn reject_busy(mut stream: TcpStream) {
    let _ = stream.set_write_timeout(Some(CANCELLATION_POLL));
    let _ = stream.write_all(
        b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\nRetry-After: 1\r\n\r\n",
    );
}

fn handle_server_connection(
    mut stream: TcpStream,
    share: &ServedShare,
    limits: &DirectHttpLimits,
    cancellation: &CancellationToken,
) -> Result<(), P2pError> {
    stream
        .set_nonblocking(false)
        .map_err(|_| P2pError::new("p2p-http-transport"))?;
    stream
        .set_nodelay(true)
        .map_err(|_| P2pError::new("p2p-http-transport"))?;
    let deadline = deadline_after(limits.request_timeout)?;
    let (head, trailing) = read_header_block(&mut stream, deadline, cancellation, None)?;
    let request = match parse_request_head(&head) {
        Ok(request) if trailing.is_empty() => request,
        _ => {
            return write_empty_response(
                &mut stream,
                "400 Bad Request",
                &[],
                deadline,
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
        || request
            .headers
            .get("content-length")
            .is_some_and(|value| value != "0")
    {
        return write_empty_response(
            &mut stream,
            "400 Bad Request",
            &[],
            deadline,
            cancellation,
            None,
        );
    }
    if request.method != "GET" {
        return write_empty_response(
            &mut stream,
            "405 Method Not Allowed",
            &[("Allow", "GET".to_string())],
            deadline,
            cancellation,
            None,
        );
    }

    if request.target == share.manifest_route {
        if request.headers.contains_key("range") {
            return write_empty_response(
                &mut stream,
                "400 Bad Request",
                &[],
                deadline,
                cancellation,
                None,
            );
        }
        let headers = vec![
            ("Content-Type", MANIFEST_MEDIA_TYPE.to_string()),
            ("Cache-Control", "private, no-transform".to_string()),
            ("ETag", format!("\"{}\"", share.manifest.manifest_id)),
            (
                "X-TinyRustLM-Manifest-Id",
                share.manifest.manifest_id.clone(),
            ),
        ];
        return write_response(
            &mut stream,
            "200 OK",
            &headers,
            &share.manifest_bytes,
            deadline,
            cancellation,
            None,
        );
    }

    if request.target != share.artifact_route {
        return write_empty_response(
            &mut stream,
            "404 Not Found",
            &[],
            deadline,
            cancellation,
            None,
        );
    }

    let requested_range = request
        .headers
        .get("range")
        .and_then(|value| parse_closed_range(value).ok());
    let piece = requested_range.and_then(|(start, end)| {
        share.manifest.pieces.iter().find(|piece| {
            piece.offset == start
                && piece
                    .offset
                    .checked_add(piece.length)
                    .and_then(|exclusive| exclusive.checked_sub(1))
                    == Some(end)
        })
    });
    let Some(piece) = piece else {
        return write_empty_response(
            &mut stream,
            "416 Range Not Satisfiable",
            &[
                ("Accept-Ranges", "bytes".to_string()),
                (
                    "Content-Range",
                    format!("bytes */{}", share.manifest.artifact_bytes),
                ),
            ],
            deadline,
            cancellation,
            None,
        );
    };

    let bytes = match load_verified_piece(share, piece) {
        Ok(bytes) => bytes,
        Err(_) => {
            return write_empty_response(
                &mut stream,
                "500 Internal Server Error",
                &[],
                deadline,
                cancellation,
                None,
            );
        }
    };
    let range_end = piece
        .offset
        .checked_add(piece.length)
        .and_then(|exclusive| exclusive.checked_sub(1))
        .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
    let headers = vec![
        ("Content-Type", "application/octet-stream".to_string()),
        ("Cache-Control", "private, no-transform".to_string()),
        ("Accept-Ranges", "bytes".to_string()),
        (
            "Content-Range",
            format!(
                "bytes {}-{}/{}",
                piece.offset, range_end, share.manifest.artifact_bytes
            ),
        ),
        ("ETag", format!("\"{}\"", share.manifest.artifact_id)),
        (
            "X-TinyRustLM-Manifest-Id",
            share.manifest.manifest_id.clone(),
        ),
        (
            "X-TinyRustLM-Artifact-Id",
            share.manifest.artifact_id.clone(),
        ),
        ("X-TinyRustLM-Piece-Index", piece.index.to_string()),
        ("X-TinyRustLM-Piece-Sha256", piece.sha256.clone()),
    ];
    write_response(
        &mut stream,
        "206 Partial Content",
        &headers,
        &bytes,
        deadline,
        cancellation,
        None,
    )
}

fn load_verified_piece(share: &ServedShare, piece: &P2pPiece) -> Result<Vec<u8>, P2pError> {
    let maximum = usize::try_from(piece.length).map_err(|_| P2pError::new("p2p-arithmetic"))?;
    let bytes = read_regular_bounded(
        &share.piece_directory.join(piece_file_name(piece.index)?),
        maximum,
        "p2p-piece-length",
    )?;
    if bytes.len() as u64 != piece.length || hex_lower(&Sha256::digest(&bytes)) != piece.sha256 {
        return Err(P2pError::new("p2p-piece-hash"));
    }
    Ok(bytes)
}

/// Fetches one identity-pinned share kit from a direct HTTP peer and promotes it atomically.
pub fn fetch_share_kit_from_http_peer(
    request: FetchShareKitRequest,
    limits: DirectHttpLimits,
    cancellation: &CancellationToken,
) -> Result<ShareKitReport, P2pError> {
    limits.validate()?;
    validate_fetch_request(&request)?;
    let transfer_deadline = deadline_after(limits.transfer_timeout)?;
    check_active(cancellation, None, transfer_deadline)?;
    let mut stage = OwnedStage::create(&request.output_directory)?;
    let (manifest, initial_manifest_bytes) = fetch_manifest(
        request.peer,
        &request.expected_manifest_id,
        &limits,
        cancellation,
        None,
        transfer_deadline,
    )?;
    require_manifest_bindings(&manifest, &request, &limits)?;

    let piece_directory = stage.path().join(PIECE_DIRECTORY_NAME);
    fs::create_dir(&piece_directory).map_err(|_| P2pError::new("p2p-io"))?;
    download_pieces(
        request.peer,
        &manifest,
        &piece_directory,
        &limits,
        cancellation,
        transfer_deadline,
    )?;
    sync_directory(&piece_directory)?;
    verify_downloaded_piece_set(&piece_directory, &manifest, cancellation, transfer_deadline)?;

    let (final_manifest, final_manifest_bytes) = fetch_manifest(
        request.peer,
        &request.expected_manifest_id,
        &limits,
        cancellation,
        None,
        transfer_deadline,
    )?;
    require_manifest_bindings(&final_manifest, &request, &limits)?;
    if final_manifest_bytes != initial_manifest_bytes || final_manifest != manifest {
        return Err(P2pError::new("p2p-http-manifest-closure"));
    }
    check_active(cancellation, None, transfer_deadline)?;

    write_new_synced(
        &stage.path().join(MANIFEST_FILE_NAME),
        &final_manifest_bytes,
    )?;
    write_new_synced(
        &stage.path().join(COMPLETE_FILE_NAME),
        format!("{}\n", final_manifest.manifest_id).as_bytes(),
    )?;
    sync_directory(stage.path())?;
    let output_directory = stage.promote(&request.output_directory)?;
    Ok(ShareKitReport {
        manifest_path: output_directory.join(MANIFEST_FILE_NAME),
        piece_directory: output_directory.join(PIECE_DIRECTORY_NAME),
        output_directory,
        manifest: final_manifest,
    })
}

fn validate_fetch_request(request: &FetchShareKitRequest) -> Result<(), P2pError> {
    if request.peer.port() == 0
        || request.peer.ip().is_unspecified()
        || request.peer.ip().is_multicast()
        || !valid_content_id(&request.expected_manifest_id)
        || !valid_content_id(&request.expected_artifact_id)
        || request.expected_composition_artifact_ids.len() > 64
        || request
            .expected_composition_artifact_ids
            .iter()
            .any(|identity| !valid_content_id(identity))
        || request
            .expected_composition_artifact_ids
            .windows(2)
            .any(|pair| pair[0] >= pair[1])
    {
        return Err(P2pError::new("p2p-http-identity"));
    }
    Ok(())
}

fn require_manifest_bindings(
    manifest: &P2pManifest,
    request: &FetchShareKitRequest,
    limits: &DirectHttpLimits,
) -> Result<(), P2pError> {
    if manifest.manifest_id != request.expected_manifest_id
        || manifest.artifact_id != request.expected_artifact_id
    {
        return Err(P2pError::new("p2p-http-manifest-binding"));
    }
    if manifest.composition_artifact_ids != request.expected_composition_artifact_ids {
        return Err(P2pError::new("p2p-http-composition-binding"));
    }
    if manifest.artifact_bytes > limits.maximum_artifact_bytes {
        return Err(P2pError::new("p2p-http-size"));
    }
    Ok(())
}

fn download_pieces(
    peer: SocketAddr,
    manifest: &P2pManifest,
    piece_directory: &Path,
    limits: &DirectHttpLimits,
    cancellation: &CancellationToken,
    transfer_deadline: Instant,
) -> Result<(), P2pError> {
    let jobs = Mutex::new((0..manifest.pieces.len()).collect::<VecDeque<_>>());
    let first_error = Mutex::new(None::<P2pError>);
    let abort = AtomicBool::new(false);
    let worker_count = limits.maximum_concurrency.min(manifest.pieces.len());

    thread::scope(|scope| {
        let mut workers = Vec::with_capacity(worker_count);
        for _ in 0..worker_count {
            workers.push(scope.spawn(|| loop {
                if abort.load(Ordering::Acquire) {
                    break;
                }
                if let Err(error) = check_active(cancellation, None, transfer_deadline) {
                    record_worker_error(&first_error, &abort, error);
                    break;
                }
                let position = match jobs.lock() {
                    Ok(mut jobs) => jobs.pop_front(),
                    Err(_) => {
                        record_worker_error(&first_error, &abort, P2pError::new("p2p-http-worker"));
                        break;
                    }
                };
                let Some(position) = position else {
                    break;
                };
                let piece = &manifest.pieces[position];
                let result = fetch_piece(
                    peer,
                    manifest,
                    piece,
                    limits,
                    cancellation,
                    Some(&abort),
                    transfer_deadline,
                )
                .and_then(|bytes| {
                    check_active(cancellation, Some(&abort), transfer_deadline)?;
                    write_new_synced(&piece_directory.join(piece_file_name(piece.index)?), &bytes)
                });
                if let Err(error) = result {
                    record_worker_error(&first_error, &abort, error);
                    break;
                }
            }));
        }
        for worker in workers {
            if worker.join().is_err() {
                record_worker_error(&first_error, &abort, P2pError::new("p2p-http-worker"));
            }
        }
    });

    match first_error
        .into_inner()
        .map_err(|_| P2pError::new("p2p-http-worker"))?
    {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

fn record_worker_error(first_error: &Mutex<Option<P2pError>>, abort: &AtomicBool, error: P2pError) {
    if let Ok(mut first_error) = first_error.lock() {
        if first_error.is_none() {
            *first_error = Some(error);
        }
    }
    abort.store(true, Ordering::Release);
}

fn fetch_manifest(
    peer: SocketAddr,
    expected_manifest_id: &str,
    limits: &DirectHttpLimits,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
    transfer_deadline: Instant,
) -> Result<(P2pManifest, Vec<u8>), P2pError> {
    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nAccept: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        manifest_route(expected_manifest_id),
        peer,
        MANIFEST_MEDIA_TYPE,
    );
    let response = exchange(
        peer,
        request.as_bytes(),
        MAXIMUM_MANIFEST_BYTES,
        limits,
        cancellation,
        abort,
        transfer_deadline,
    )?;
    if response.status != 200 {
        return Err(P2pError::new("p2p-http-status"));
    }
    require_response_header(&response, "content-type", MANIFEST_MEDIA_TYPE)?;
    require_response_header(&response, "x-tinyrustlm-manifest-id", expected_manifest_id)?;
    require_response_header(&response, "etag", &format!("\"{expected_manifest_id}\""))?;
    let manifest = inspect_manifest(&response.body)?;
    if manifest.manifest_id != expected_manifest_id {
        return Err(P2pError::new("p2p-http-manifest-binding"));
    }
    Ok((manifest, response.body))
}

fn fetch_piece(
    peer: SocketAddr,
    manifest: &P2pManifest,
    piece: &P2pPiece,
    limits: &DirectHttpLimits,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
    transfer_deadline: Instant,
) -> Result<Vec<u8>, P2pError> {
    let range_end = piece
        .offset
        .checked_add(piece.length)
        .and_then(|exclusive| exclusive.checked_sub(1))
        .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nAccept: application/octet-stream\r\nRange: bytes={}-{}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        artifact_route(&manifest.manifest_id, &manifest.artifact_id),
        peer,
        piece.offset,
        range_end,
    );
    let maximum = usize::try_from(piece.length).map_err(|_| P2pError::new("p2p-arithmetic"))?;
    let response = exchange(
        peer,
        request.as_bytes(),
        maximum,
        limits,
        cancellation,
        abort,
        transfer_deadline,
    )?;
    if response.status != 206 {
        return Err(P2pError::new("p2p-http-status"));
    }
    require_response_header(&response, "content-type", "application/octet-stream")?;
    require_response_header(&response, "accept-ranges", "bytes")?;
    require_response_header(
        &response,
        "content-range",
        &format!(
            "bytes {}-{}/{}",
            piece.offset, range_end, manifest.artifact_bytes
        ),
    )?;
    require_response_header(&response, "etag", &format!("\"{}\"", manifest.artifact_id))?;
    require_response_header(&response, "x-tinyrustlm-manifest-id", &manifest.manifest_id)?;
    require_response_header(&response, "x-tinyrustlm-artifact-id", &manifest.artifact_id)?;
    require_response_header(
        &response,
        "x-tinyrustlm-piece-index",
        &piece.index.to_string(),
    )?;
    require_response_header(&response, "x-tinyrustlm-piece-sha256", &piece.sha256)?;
    if response.body.len() as u64 != piece.length
        || hex_lower(&Sha256::digest(&response.body)) != piece.sha256
    {
        return Err(P2pError::new("p2p-piece-hash"));
    }
    Ok(response.body)
}

fn require_response_header(
    response: &HttpResponse,
    name: &str,
    expected: &str,
) -> Result<(), P2pError> {
    if response.headers.get(name).map(String::as_str) != Some(expected) {
        return Err(P2pError::new("p2p-http-response-binding"));
    }
    Ok(())
}

fn verify_downloaded_piece_set(
    piece_directory: &Path,
    manifest: &P2pManifest,
    cancellation: &CancellationToken,
    transfer_deadline: Instant,
) -> Result<(), P2pError> {
    let mut complete_hasher = Sha256::new();
    let mut complete_bytes = 0_u64;
    let mut buffer = vec![0_u8; STREAM_BUFFER_BYTES];

    for piece in &manifest.pieces {
        check_active(cancellation, None, transfer_deadline)?;
        let mut source = open_regular_file(&piece_directory.join(piece_file_name(piece.index)?))?;
        if source
            .metadata()
            .map_err(|_| P2pError::new("p2p-io"))?
            .len()
            != piece.length
        {
            return Err(P2pError::new("p2p-piece-length"));
        }
        let mut remaining = piece.length;
        let mut piece_hasher = Sha256::new();
        while remaining > 0 {
            check_active(cancellation, None, transfer_deadline)?;
            let requested = usize::try_from(remaining.min(buffer.len() as u64))
                .map_err(|_| P2pError::new("p2p-arithmetic"))?;
            let count = source
                .read(&mut buffer[..requested])
                .map_err(|_| P2pError::new("p2p-io"))?;
            if count == 0 {
                return Err(P2pError::new("p2p-piece-length"));
            }
            piece_hasher.update(&buffer[..count]);
            complete_hasher.update(&buffer[..count]);
            remaining -= count as u64;
            complete_bytes = complete_bytes
                .checked_add(count as u64)
                .ok_or_else(|| P2pError::new("p2p-arithmetic"))?;
        }
        let mut trailing = [0_u8; 1];
        if source
            .read(&mut trailing)
            .map_err(|_| P2pError::new("p2p-io"))?
            != 0
            || hex_lower(&piece_hasher.finalize()) != piece.sha256
        {
            return Err(P2pError::new("p2p-piece-hash"));
        }
    }

    if complete_bytes != manifest.artifact_bytes
        || hex_lower(&complete_hasher.finalize()) != manifest.artifact_sha256
    {
        return Err(P2pError::new("p2p-artifact-hash"));
    }
    Ok(())
}

pub(crate) struct HttpRequest {
    pub(crate) method: String,
    pub(crate) target: String,
    pub(crate) headers: HashMap<String, String>,
}

struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

fn exchange(
    peer: SocketAddr,
    request: &[u8],
    maximum_body_bytes: usize,
    limits: &DirectHttpLimits,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
    transfer_deadline: Instant,
) -> Result<HttpResponse, P2pError> {
    let request_deadline = deadline_after(limits.request_timeout)?.min(transfer_deadline);
    check_active(cancellation, abort, request_deadline)?;
    let connect_timeout = limits
        .connect_timeout
        .min(remaining_duration(request_deadline)?);
    let mut stream =
        TcpStream::connect_timeout(&peer, connect_timeout).map_err(map_connect_error)?;
    stream
        .set_nonblocking(false)
        .map_err(|_| P2pError::new("p2p-http-transport"))?;
    stream
        .set_nodelay(true)
        .map_err(|_| P2pError::new("p2p-http-transport"))?;
    check_active(cancellation, abort, request_deadline)?;
    write_all_bounded(&mut stream, request, request_deadline, cancellation, abort)?;
    let (head, initial_body) =
        read_header_block(&mut stream, request_deadline, cancellation, abort)?;
    let (status, headers) = parse_response_head(&head)?;
    if headers.contains_key("transfer-encoding")
        || headers.contains_key("content-encoding")
        || headers.get("connection").map(String::as_str) != Some("close")
    {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    let content_length = headers
        .get("content-length")
        .ok_or_else(|| P2pError::new("p2p-http-protocol"))
        .and_then(|value| parse_decimal(value))?;
    let content_length =
        usize::try_from(content_length).map_err(|_| P2pError::new("p2p-http-size"))?;
    if content_length > maximum_body_bytes {
        return Err(P2pError::new("p2p-http-size"));
    }
    let body = read_body(
        &mut stream,
        initial_body,
        content_length,
        request_deadline,
        cancellation,
        abort,
    )?;
    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

fn read_body(
    stream: &mut TcpStream,
    initial: Vec<u8>,
    expected: usize,
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<Vec<u8>, P2pError> {
    if initial.len() > expected {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    let mut body = Vec::with_capacity(expected);
    body.extend_from_slice(&initial);
    let mut buffer = [0_u8; STREAM_BUFFER_BYTES];
    while body.len() < expected {
        let requested = (expected - body.len()).min(buffer.len());
        let count = read_some(
            stream,
            &mut buffer[..requested],
            deadline,
            cancellation,
            abort,
        )?;
        if count == 0 {
            return Err(P2pError::new("p2p-http-protocol"));
        }
        body.extend_from_slice(&buffer[..count]);
    }
    Ok(body)
}

pub(crate) fn parse_request_head(bytes: &[u8]) -> Result<HttpRequest, P2pError> {
    let (start_line, headers) = parse_head(bytes)?;
    let mut parts = start_line.split(' ');
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default();
    let version = parts.next().unwrap_or_default();
    if method.is_empty()
        || target.is_empty()
        || version != "HTTP/1.1"
        || parts.next().is_some()
        || !target.starts_with('/')
    {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    Ok(HttpRequest {
        method: method.to_string(),
        target: target.to_string(),
        headers,
    })
}

fn parse_response_head(bytes: &[u8]) -> Result<(u16, HashMap<String, String>), P2pError> {
    let (start_line, headers) = parse_head(bytes)?;
    let mut parts = start_line.splitn(3, ' ');
    if parts.next() != Some("HTTP/1.1") {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    let status = parts
        .next()
        .filter(|value| value.len() == 3 && value.bytes().all(|byte| byte.is_ascii_digit()))
        .ok_or_else(|| P2pError::new("p2p-http-protocol"))?
        .parse::<u16>()
        .map_err(|_| P2pError::new("p2p-http-protocol"))?;
    if parts.next().is_none() {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    Ok((status, headers))
}

fn parse_head(bytes: &[u8]) -> Result<(&str, HashMap<String, String>), P2pError> {
    let text = std::str::from_utf8(bytes).map_err(|_| P2pError::new("p2p-http-protocol"))?;
    if !text.is_ascii() {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    let mut lines = text.split("\r\n");
    let start_line = lines
        .next()
        .filter(|line| !line.is_empty() && valid_header_value(line))
        .ok_or_else(|| P2pError::new("p2p-http-protocol"))?;
    let mut headers = HashMap::new();
    for line in lines {
        if line.is_empty() || line.starts_with([' ', '\t']) {
            return Err(P2pError::new("p2p-http-protocol"));
        }
        let (name, value) = line
            .split_once(':')
            .ok_or_else(|| P2pError::new("p2p-http-protocol"))?;
        if name.is_empty() || !name.bytes().all(valid_header_name_byte) {
            return Err(P2pError::new("p2p-http-protocol"));
        }
        let value = value.trim_matches([' ', '\t']);
        if !valid_header_value(value) {
            return Err(P2pError::new("p2p-http-protocol"));
        }
        let name = name.to_ascii_lowercase();
        if headers.insert(name, value.to_string()).is_some() {
            return Err(P2pError::new("p2p-http-protocol"));
        }
    }
    Ok((start_line, headers))
}

fn valid_header_name_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
        || matches!(
            byte,
            b'!' | b'#'
                | b'$'
                | b'%'
                | b'&'
                | b'\''
                | b'*'
                | b'+'
                | b'-'
                | b'.'
                | b'^'
                | b'_'
                | b'`'
                | b'|'
                | b'~'
        )
}

fn valid_header_value(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte == b'\t' || (byte >= 0x20 && byte != 0x7f))
}

pub(crate) fn read_header_block(
    stream: &mut TcpStream,
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<(Vec<u8>, Vec<u8>), P2pError> {
    let mut bytes = Vec::with_capacity(1024);
    let mut buffer = [0_u8; 1024];
    loop {
        let count = read_some(stream, &mut buffer, deadline, cancellation, abort)?;
        if count == 0 {
            return Err(P2pError::new("p2p-http-protocol"));
        }
        bytes.extend_from_slice(&buffer[..count]);
        if let Some(position) = find_header_end(&bytes) {
            let body_start = position + 4;
            if body_start > MAXIMUM_HTTP_HEADER_BYTES {
                return Err(P2pError::new("p2p-http-header-size"));
            }
            let trailing = bytes.split_off(body_start);
            bytes.truncate(position);
            return Ok((bytes, trailing));
        }
        if bytes.len() >= MAXIMUM_HTTP_HEADER_BYTES {
            return Err(P2pError::new("p2p-http-header-size"));
        }
    }
}

fn find_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

pub(crate) fn write_empty_response(
    stream: &mut TcpStream,
    status: &str,
    headers: &[(&str, String)],
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<(), P2pError> {
    write_response(stream, status, headers, &[], deadline, cancellation, abort)
}

fn write_response(
    stream: &mut TcpStream,
    status: &str,
    headers: &[(&str, String)],
    body: &[u8],
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<(), P2pError> {
    write_response_head(
        stream,
        status,
        headers,
        body.len() as u64,
        deadline,
        cancellation,
        abort,
    )?;
    write_all_bounded(stream, body, deadline, cancellation, abort)
}

/// Writes one bounded close-delimited response head for a caller-streamed body.
pub(crate) fn write_response_head(
    stream: &mut TcpStream,
    status: &str,
    headers: &[(&str, String)],
    content_length: u64,
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<(), P2pError> {
    let mut head = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {content_length}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n"
    );
    for (name, value) in headers {
        if !name.bytes().all(valid_header_name_byte) || !valid_header_value(value) {
            return Err(P2pError::new("p2p-http-protocol"));
        }
        head.push_str(name);
        head.push_str(": ");
        head.push_str(value);
        head.push_str("\r\n");
    }
    head.push_str("\r\n");
    write_all_bounded(stream, head.as_bytes(), deadline, cancellation, abort)
}

fn read_some(
    stream: &mut TcpStream,
    buffer: &mut [u8],
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<usize, P2pError> {
    loop {
        check_active(cancellation, abort, deadline)?;
        stream
            .set_read_timeout(Some(poll_duration(deadline)?))
            .map_err(|_| P2pError::new("p2p-http-transport"))?;
        match stream.read(buffer) {
            Ok(count) => return Ok(count),
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::Interrupted
                        | io::ErrorKind::TimedOut
                        | io::ErrorKind::WouldBlock
                ) => {}
            Err(_) => return Err(P2pError::new("p2p-http-transport")),
        }
    }
}

pub(crate) fn write_all_bounded(
    stream: &mut TcpStream,
    bytes: &[u8],
    deadline: Instant,
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
) -> Result<(), P2pError> {
    let mut written = 0;
    while written < bytes.len() {
        check_active(cancellation, abort, deadline)?;
        stream
            .set_write_timeout(Some(poll_duration(deadline)?))
            .map_err(|_| P2pError::new("p2p-http-transport"))?;
        let end = (written + STREAM_BUFFER_BYTES).min(bytes.len());
        match stream.write(&bytes[written..end]) {
            Ok(0) => return Err(P2pError::new("p2p-http-transport")),
            Ok(count) => written += count,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::Interrupted
                        | io::ErrorKind::TimedOut
                        | io::ErrorKind::WouldBlock
                ) => {}
            Err(_) => return Err(P2pError::new("p2p-http-transport")),
        }
    }
    Ok(())
}

pub(crate) fn check_active(
    cancellation: &CancellationToken,
    abort: Option<&AtomicBool>,
    deadline: Instant,
) -> Result<(), P2pError> {
    if cancellation.is_cancelled() || abort.is_some_and(|abort| abort.load(Ordering::Acquire)) {
        return Err(P2pError::new("p2p-cancelled"));
    }
    if Instant::now() >= deadline {
        return Err(P2pError::new("p2p-http-timeout"));
    }
    Ok(())
}

fn poll_duration(deadline: Instant) -> Result<Duration, P2pError> {
    Ok(remaining_duration(deadline)?.min(CANCELLATION_POLL))
}

fn remaining_duration(deadline: Instant) -> Result<Duration, P2pError> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|remaining| !remaining.is_zero())
        .ok_or_else(|| P2pError::new("p2p-http-timeout"))
}

pub(crate) fn deadline_after(duration: Duration) -> Result<Instant, P2pError> {
    Instant::now()
        .checked_add(duration)
        .ok_or_else(|| P2pError::new("p2p-http-limits"))
}

fn map_connect_error(error: io::Error) -> P2pError {
    if matches!(
        error.kind(),
        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock
    ) {
        P2pError::new("p2p-http-timeout")
    } else {
        P2pError::new("p2p-http-transport")
    }
}

fn parse_closed_range(value: &str) -> Result<(u64, u64), P2pError> {
    let range = value
        .strip_prefix("bytes=")
        .ok_or_else(|| P2pError::new("p2p-http-range"))?;
    let (start, end) = range
        .split_once('-')
        .ok_or_else(|| P2pError::new("p2p-http-range"))?;
    let start_value = parse_decimal(start)?;
    let end_value = parse_decimal(end)?;
    if start_value > end_value || value != format!("bytes={start_value}-{end_value}") {
        return Err(P2pError::new("p2p-http-range"));
    }
    Ok((start_value, end_value))
}

fn parse_decimal(value: &str) -> Result<u64, P2pError> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    let parsed = value
        .parse::<u64>()
        .map_err(|_| P2pError::new("p2p-http-protocol"))?;
    if value != parsed.to_string() {
        return Err(P2pError::new("p2p-http-protocol"));
    }
    Ok(parsed)
}

fn manifest_route(manifest_id: &str) -> String {
    format!("{DIRECT_HTTP_ROUTE_PREFIX}/manifests/{manifest_id}")
}

fn artifact_route(manifest_id: &str, artifact_id: &str) -> String {
    format!("{}/artifacts/{artifact_id}", manifest_route(manifest_id))
}

pub(crate) fn valid_content_id(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..]
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn read_regular_bounded(
    path: &Path,
    maximum_bytes: usize,
    size_error: &'static str,
) -> Result<Vec<u8>, P2pError> {
    let mut source = open_regular_file(path)?;
    let length = source
        .metadata()
        .map_err(|_| P2pError::new("p2p-io"))?
        .len();
    if length > maximum_bytes as u64 {
        return Err(P2pError::new(size_error));
    }
    let capacity = usize::try_from(length).map_err(|_| P2pError::new(size_error))?;
    let read_limit = (maximum_bytes as u64)
        .checked_add(1)
        .ok_or_else(|| P2pError::new(size_error))?;
    let mut bytes = Vec::with_capacity(capacity);
    Read::take(&mut source, read_limit)
        .read_to_end(&mut bytes)
        .map_err(|_| P2pError::new("p2p-io"))?;
    if bytes.len() != capacity {
        return Err(P2pError::new(size_error));
    }
    Ok(bytes)
}

pub(crate) fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_canonical_closed_ranges() {
        assert_eq!(parse_closed_range("bytes=0-4194303"), Ok((0, 4_194_303)));
        for invalid in [
            "bytes=0-",
            "bytes=-1",
            "bytes=00-1",
            "bytes=2-1",
            "bytes=0-1,4-5",
            "items=0-1",
        ] {
            assert!(parse_closed_range(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn rejects_unbounded_transport_limits() {
        let limits = DirectHttpLimits {
            maximum_concurrency: 0,
            ..DirectHttpLimits::default()
        };
        assert_eq!(
            limits
                .validate()
                .expect_err("zero concurrency must fail")
                .code(),
            "p2p-http-limits"
        );

        let limits = DirectHttpLimits {
            request_timeout: Duration::from_secs(6 * 60),
            ..DirectHttpLimits::default()
        };
        assert_eq!(
            limits
                .validate()
                .expect_err("long request must fail")
                .code(),
            "p2p-http-limits"
        );
    }

    #[test]
    fn rejects_duplicate_or_folded_http_headers() {
        for head in [
            b"GET / HTTP/1.1\r\nHost: one\r\nHost: two".as_slice(),
            b"GET / HTTP/1.1\r\nHost: one\r\n folded".as_slice(),
        ] {
            assert!(parse_request_head(head).is_err());
        }
    }
}
