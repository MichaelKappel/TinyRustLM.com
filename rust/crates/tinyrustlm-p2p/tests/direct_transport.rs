#![doc = "End-to-end tests for canonical direct transport and composition admission."]

use std::fs::{self, File};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use tinyrustlm_composition2::{write_acg2, Acg2Member, MemberRole};
use tinyrustlm_p2p::{
    assemble_from_piece_directory, inspect_manifest, prepare_share_kit, ArtifactAdmission,
    PrepareShareKitRequest, P2P_MANIFEST_SCHEMA,
};
use tinyrustlm_slm2::{
    required_model_tensors, write_model, ArtifactClass, ModelSpec, TensorInput, PIECE_BYTES,
};

static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct TestRoot(PathBuf);

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

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
