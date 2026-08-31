#![doc = "Local and loopback-only direct transport tests."]
#![doc = "Loopback behavior is not proof of outside-peer reachability or qualification."]

use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use tinyrustlm_composition2::{write_acg2, Acg2Member, MemberRole};
use tinyrustlm_p2p::{
    assemble_from_piece_directory, fetch_share_kit_from_http_peer, inspect_manifest,
    prepare_share_kit, ArtifactAdmission, CancellationToken, DirectHttpLimits, DirectHttpServer,
    FetchShareKitRequest, P2pError, PrepareShareKitRequest, ShareKitReport,
    DIRECT_HTTP_ROUTE_PREFIX, P2P_MANIFEST_SCHEMA,
};
use tinyrustlm_slm2::{
    required_model_tensors, write_model, ArtifactClass, ModelSpec, TensorInput, PIECE_BYTES,
};

static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct TestRoot(PathBuf);

struct RunningLoopbackServer {
    address: SocketAddr,
    cancellation: CancellationToken,
    worker: Option<JoinHandle<Result<(), P2pError>>>,
}

impl TestRoot {
    fn create(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-p2p-test-{}-{}-{name}",
            std::process::id(),
            TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).expect("owned test root must be new");
        Self(root)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        let name_is_owned = self
            .0
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("tinyrustlm-p2p-test-"));
        if name_is_owned && self.0.parent() == Some(std::env::temp_dir().as_path()) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

impl RunningLoopbackServer {
    fn start(share: &ShareKitReport, limits: DirectHttpLimits) -> Self {
        let server = DirectHttpServer::bind(
            SocketAddr::from(([127, 0, 0, 1], 0)),
            share.output_directory(),
            limits,
        )
        .expect("loopback server bind");
        let address = server.local_addr();
        assert!(address.ip().is_loopback());
        assert_eq!(server.manifest_id(), share.manifest().manifest_id);
        let cancellation = CancellationToken::new();
        let serving = cancellation.clone();
        let worker = thread::spawn(move || server.serve(&serving));
        Self {
            address,
            cancellation,
            worker: Some(worker),
        }
    }

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
    fn drop(&mut self) {
        self.cancellation.cancel();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

fn content_id(seed: u8) -> String {
    format!("sha256:{}", hex_lower(&[seed; 32]))
}

fn model_spec(vocabulary_size: u32) -> ModelSpec {
    ModelSpec {
        artifact_class: ArtifactClass::BaseModel,
        vocabulary_size,
        context_length: 128,
        embedding_size: 8,
        feed_forward_size: 16,
        layer_count: 1,
        head_count: 2,
        kv_head_count: 1,
        head_dimension: 8,
        rope_theta: 10_000.0,
        normalization_epsilon: 0.000_01,
        tied_embeddings: true,
        qkv_bias: false,
        qk_normalization: false,
    }
}

fn f32_bytes(count: usize, seed: usize) -> Vec<u8> {
    (0..count)
        .flat_map(|index| ((seed + index + 1) as f32 / 1024.0).to_le_bytes())
        .collect()
}

fn write_model_fixture(path: &Path, vocabulary_size: u32) -> (u64, [u8; 32]) {
    let spec = model_spec(vocabulary_size);
    let mut tensors = required_model_tensors(&spec, 64)
        .expect("fixture tensor plan")
        .into_iter()
        .enumerate()
        .map(|(index, tensor)| {
            let count = tensor
                .shape()
                .iter()
                .try_fold(1_u64, |product, dimension| product.checked_mul(*dimension))
                .and_then(|value| usize::try_from(value).ok())
                .expect("fixture logical element count");
            TensorInput::new(tensor, Cursor::new(f32_bytes(count, index * 10_000)))
        })
        .collect::<Vec<_>>();
    let mut output = File::create(path).expect("fixture destination");
    let identity = write_model(&mut output, &spec, &mut tensors).expect("fixture model");
    output.sync_all().expect("fixture sync");
    (identity.byte_length(), *identity.artifact_sha256())
}

fn write_composition_fixture(path: &Path, model_bytes: u64, model_hash: [u8; 32]) {
    let members = [
        Acg2Member::new(MemberRole::Model, model_bytes, model_hash).expect("model member"),
        Acg2Member::new(MemberRole::Tokenizer, 10, [2; 32]).expect("tokenizer member"),
        Acg2Member::new(MemberRole::Template, 11, [3; 32]).expect("template member"),
        Acg2Member::new(MemberRole::Sampling, 12, [4; 32]).expect("sampling member"),
        Acg2Member::new(MemberRole::Prompt, 13, [5; 32]).expect("prompt member"),
    ];
    let mut output = File::create(path).expect("composition destination");
    write_acg2(&mut output, &members).expect("composition fixture");
    output.sync_all().expect("composition sync");
}

fn request(root: &Path, model: &Path, composition: &Path) -> PrepareShareKitRequest {
    PrepareShareKitRequest {
        artifact_path: model.to_path_buf(),
        output_directory: root.join("share"),
        artifact_manifest_id: content_id(10),
        qualification_receipt_id: content_id(11),
        provenance_receipt_id: content_id(12),
        license_expression: "Apache-2.0".to_string(),
        created_at_utc: "2026-08-24T00:00:00Z".to_string(),
        admission: ArtifactAdmission::Slm2Model {
            composition_path: composition.to_path_buf(),
        },
    }
}

fn fetch_request(
    share: &ShareKitReport,
    peer: SocketAddr,
    output_directory: PathBuf,
) -> FetchShareKitRequest {
    FetchShareKitRequest {
        peer,
        output_directory,
        expected_manifest_id: share.manifest().manifest_id.clone(),
        expected_artifact_id: share.manifest().artifact_id.clone(),
        expected_composition_artifact_ids: share.manifest().composition_artifact_ids.clone(),
    }
}

fn raw_http_status(peer: SocketAddr, request: &str) -> String {
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
    String::from_utf8(response)
        .expect("ASCII response")
        .lines()
        .next()
        .expect("status line")
        .to_string()
}

#[test]
fn creates_and_reassembles_one_composition_bound_slm2_share() {
    let root = TestRoot::create("round-trip");
    let model = root.path().join("model.slm");
    let composition = root.path().join("model.acg2");
    let (model_bytes, model_hash) = write_model_fixture(&model, 32);
    write_composition_fixture(&composition, model_bytes, model_hash);

    let report = prepare_share_kit(request(root.path(), &model, &composition)).expect("share");
    assert_eq!(report.manifest().schema, P2P_MANIFEST_SCHEMA);
    assert_eq!(report.manifest().piece_bytes, PIECE_BYTES);
    assert_eq!(report.manifest().composition_artifact_ids.len(), 1);
    let wire = fs::read(report.manifest_path()).expect("manifest wire");
    assert_eq!(
        inspect_manifest(&wire).expect("manifest inspection"),
        *report.manifest()
    );

    let imported = assemble_from_piece_directory(
        &wire,
        report.piece_directory(),
        &root.path().join("imported.slm"),
        &ArtifactAdmission::Slm2Model {
            composition_path: composition,
        },
    )
    .expect("verified import");
    assert_eq!(
        fs::read(imported.output_path()).expect("imported bytes"),
        fs::read(&model).expect("source bytes")
    );
    assert_eq!(imported.artifact_sha256(), hex_lower(&model_hash));
}

#[test]
fn rejects_wrong_composition_without_creating_a_share() {
    let root = TestRoot::create("wrong-composition");
    let model = root.path().join("model.slm");
    let composition = root.path().join("wrong.acg2");
    let (model_bytes, _) = write_model_fixture(&model, 32);
    write_composition_fixture(&composition, model_bytes, [9; 32]);

    let error = prepare_share_kit(request(root.path(), &model, &composition))
        .expect_err("wrong graph must fail");
    assert_eq!(error.code(), "p2p-composition-model-binding");
    assert!(!root.path().join("share").exists());
}

#[test]
fn rejects_piece_corruption_and_removes_only_the_owned_partial_file() {
    let root = TestRoot::create("corrupt-piece");
    let model = root.path().join("model.slm");
    let composition = root.path().join("model.acg2");
    let (model_bytes, model_hash) = write_model_fixture(&model, 32);
    write_composition_fixture(&composition, model_bytes, model_hash);
    let report = prepare_share_kit(request(root.path(), &model, &composition)).expect("share");
    let first = report.piece_directory().join("piece-00000.bin");
    let mut bytes = fs::read(&first).expect("piece bytes");
    bytes[0] ^= 0x80;
    fs::write(&first, bytes).expect("hostile mutation");
    let output = root.path().join("must-not-exist.slm");

    let error = assemble_from_piece_directory(
        &fs::read(report.manifest_path()).expect("manifest"),
        report.piece_directory(),
        &output,
        &ArtifactAdmission::Slm2Model {
            composition_path: composition,
        },
    )
    .expect_err("corrupt piece must fail");
    assert_eq!(error.code(), "p2p-piece-hash");
    assert!(!output.exists());
    assert_eq!(
        fs::read_dir(root.path())
            .expect("test root")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains("partial"))
            .count(),
        0
    );
}

#[test]
fn multi_piece_slm2_uses_the_frozen_level_one_parent_rule() {
    let root = TestRoot::create("multi-piece");
    let model = root.path().join("large.slm");
    let composition = root.path().join("large.acg2");
    let (model_bytes, model_hash) = write_model_fixture(&model, 600_000);
    assert!(model_bytes > PIECE_BYTES);
    write_composition_fixture(&composition, model_bytes, model_hash);

    let report = prepare_share_kit(request(root.path(), &model, &composition)).expect("share");
    assert!(report.manifest().piece_count > 1);
    assert_eq!(
        inspect_manifest(&fs::read(report.manifest_path()).expect("manifest"))
            .expect("registered multi-piece manifest")
            .merkle_root_sha256,
        report.manifest().merkle_root_sha256
    );
}

#[test]
fn loopback_http_round_trip_is_not_outside_peer_proof() {
    let root = TestRoot::create("loopback-round-trip");
    let model = root.path().join("model.slm");
    let composition = root.path().join("model.acg2");
    let (model_bytes, model_hash) = write_model_fixture(&model, 600_000);
    write_composition_fixture(&composition, model_bytes, model_hash);
    let share = prepare_share_kit(request(root.path(), &model, &composition)).expect("share");
    assert!(share.manifest().piece_count > 1);

    let limits = DirectHttpLimits {
        maximum_concurrency: 2,
        ..DirectHttpLimits::default()
    };
    let server = RunningLoopbackServer::start(&share, limits.clone());
    assert!(server.address.ip().is_loopback());
    let received_directory = root.path().join("received-share");
    let received = fetch_share_kit_from_http_peer(
        fetch_request(&share, server.address, received_directory),
        limits,
        &CancellationToken::new(),
    )
    .expect("loopback fetch");

    assert_eq!(received.manifest(), share.manifest());
    assert_eq!(
        fs::read(received.manifest_path()).expect("received manifest"),
        fs::read(share.manifest_path()).expect("served manifest")
    );
    let imported = assemble_from_piece_directory(
        &fs::read(received.manifest_path()).expect("manifest wire"),
        received.piece_directory(),
        &root.path().join("received.slm"),
        &ArtifactAdmission::Slm2Model {
            composition_path: composition,
        },
    )
    .expect("received artifact admission");
    assert_eq!(imported.artifact_sha256(), hex_lower(&model_hash));
    assert_eq!(
        fs::read(imported.output_path()).expect("received model"),
        fs::read(model).expect("synthetic source model")
    );
    server.stop();
}

#[test]
fn loopback_server_rejects_arbitrary_paths_methods_and_non_piece_ranges() {
    let root = TestRoot::create("loopback-routes");
    let model = root.path().join("model.slm");
    let composition = root.path().join("model.acg2");
    let (model_bytes, model_hash) = write_model_fixture(&model, 32);
    write_composition_fixture(&composition, model_bytes, model_hash);
    let share = prepare_share_kit(request(root.path(), &model, &composition)).expect("share");
    let server = RunningLoopbackServer::start(&share, DirectHttpLimits::default());

    assert_eq!(
        raw_http_status(
            server.address,
            "GET /manifest.json HTTP/1.1\r\nHost: loopback\r\nConnection: close\r\n\r\n",
        ),
        "HTTP/1.1 404 Not Found"
    );
    let artifact_route = format!(
        "{DIRECT_HTTP_ROUTE_PREFIX}/manifests/{}/artifacts/{}",
        share.manifest().manifest_id,
        share.manifest().artifact_id,
    );
    assert_eq!(
        raw_http_status(
            server.address,
            &format!(
                "GET {artifact_route} HTTP/1.1\r\nHost: loopback\r\nRange: bytes=1-2\r\nConnection: close\r\n\r\n"
            ),
        ),
        "HTTP/1.1 416 Range Not Satisfiable"
    );
    assert_eq!(
        raw_http_status(
            server.address,
            &format!(
                "POST {artifact_route} HTTP/1.1\r\nHost: loopback\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            ),
        ),
        "HTTP/1.1 405 Method Not Allowed"
    );
    server.stop();
}

#[test]
fn loopback_fetch_rejects_size_and_corrupt_served_piece_without_promotion() {
    let root = TestRoot::create("loopback-bounds");
    let model = root.path().join("model.slm");
    let composition = root.path().join("model.acg2");
    let (model_bytes, model_hash) = write_model_fixture(&model, 32);
    write_composition_fixture(&composition, model_bytes, model_hash);
    let share = prepare_share_kit(request(root.path(), &model, &composition)).expect("share");
    let server = RunningLoopbackServer::start(&share, DirectHttpLimits::default());

    let small_limits = DirectHttpLimits {
        maximum_artifact_bytes: share.manifest().artifact_bytes - 1,
        ..DirectHttpLimits::default()
    };
    let size_output = root.path().join("must-not-promote-size");
    let error = fetch_share_kit_from_http_peer(
        fetch_request(&share, server.address, size_output.clone()),
        small_limits,
        &CancellationToken::new(),
    )
    .expect_err("artifact limit must be enforced");
    assert_eq!(error.code(), "p2p-http-size");
    assert!(!size_output.exists());

    let first_piece = share.piece_directory().join("piece-00000.bin");
    let mut bytes = fs::read(&first_piece).expect("piece bytes");
    bytes[0] ^= 0x80;
    fs::write(first_piece, bytes).expect("same-length hostile mutation");
    let corrupt_output = root.path().join("must-not-promote-corrupt");
    let error = fetch_share_kit_from_http_peer(
        fetch_request(&share, server.address, corrupt_output.clone()),
        DirectHttpLimits::default(),
        &CancellationToken::new(),
    )
    .expect_err("corrupt peer piece must fail");
    assert_eq!(error.code(), "p2p-http-status");
    assert!(!corrupt_output.exists());
    assert_eq!(
        fs::read_dir(root.path())
            .expect("test root")
            .filter_map(Result::ok)
            .filter(|entry| entry
                .file_name()
                .to_string_lossy()
                .contains("tinyrustlm-stage"))
            .count(),
        0
    );
    server.stop();
}

#[test]
fn loopback_stalled_peer_fetch_is_cooperatively_cancelled() {
    let root = TestRoot::create("loopback-cancellation");
    let listener =
        TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).expect("stalling loopback bind");
    let peer = listener.local_addr().expect("stalling loopback address");
    assert!(peer.ip().is_loopback());
    let (accepted_tx, accepted_rx) = mpsc::channel();
    let stalling_peer = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("stalling peer accept");
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .expect("stalling read timeout");
        let mut request = Vec::new();
        let mut buffer = [0_u8; 1024];
        while !request.windows(4).any(|window| window == b"\r\n\r\n") {
            let count = stream.read(&mut buffer).expect("client request");
            if count == 0 {
                break;
            }
            request.extend_from_slice(&buffer[..count]);
        }
        accepted_tx.send(()).expect("accepted signal");
        while stream.read(&mut buffer).unwrap_or(0) != 0 {}
    });

    let cancellation = CancellationToken::new();
    let cancelling = cancellation.clone();
    let canceller = thread::spawn(move || {
        accepted_rx.recv().expect("peer accepted request");
        cancelling.cancel();
    });
    let limits = DirectHttpLimits {
        connect_timeout: Duration::from_millis(500),
        request_timeout: Duration::from_secs(2),
        transfer_timeout: Duration::from_secs(2),
        ..DirectHttpLimits::default()
    };
    let output = root.path().join("must-not-promote-cancelled");
    let error = fetch_share_kit_from_http_peer(
        FetchShareKitRequest {
            peer,
            output_directory: output.clone(),
            expected_manifest_id: content_id(21),
            expected_artifact_id: content_id(22),
            expected_composition_artifact_ids: Vec::new(),
        },
        limits,
        &cancellation,
    )
    .expect_err("cancelled stalled peer must fail");
    assert_eq!(error.code(), "p2p-cancelled");
    assert!(!output.exists());
    canceller.join().expect("canceller");
    stalling_peer.join().expect("stalling peer");
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
