//! End-to-end and fail-closed tests for the sole Qwen3 conversion profile.

use std::collections::BTreeMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tinyrustlm_convert::{
    convert_locked_qwen3_source, ConverterExecutionIdentity, Qwen3ConversionResult,
    QWEN3_CONVERSION_PROFILE_ID, QWEN3_CONVERSION_PROFILE_SHA256,
};
use tinyrustlm_slm2::{
    required_model_tensors, validate_model, ArtifactClass, ElementType, ModelSpec,
    ValidationPolicy, SLM2_FORMAT_PROFILE_ID, SLM2_FORMAT_PROFILE_SHA256,
    SLM2_Q8_WEIGHT_PROFILE_ID, SLM2_Q8_WEIGHT_PROFILE_SHA256,
};

static NEXT_TEMPORARY_ROOT: AtomicU64 = AtomicU64::new(0);

const SOURCE_FILES: [&str; 9] = [
    "LICENSE",
    "README.md",
    "config.json",
    "generation_config.json",
    "merges.txt",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
];

struct TemporaryRoot(PathBuf);

impl TemporaryRoot {
    fn new() -> Self {
        let parent = std::env::temp_dir();
        loop {
            let sequence = NEXT_TEMPORARY_ROOT.fetch_add(1, Ordering::Relaxed);
            let path = parent.join(format!(
                "tinyrustlm-qwen3-conversion-{}-{sequence}",
                std::process::id()
            ));
            match fs::create_dir(&path) {
                Ok(()) => return Self(path),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => panic!("temporary root creation failed: {error}"),
            }
        }
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TemporaryRoot {
    fn drop(&mut self) {
        let Ok(path) = fs::canonicalize(&self.0) else {
            return;
        };
        let Ok(parent) = fs::canonicalize(std::env::temp_dir()) else {
            return;
        };
        let owned_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("tinyrustlm-qwen3-conversion-"));
        if path.parent() == Some(parent.as_path()) && owned_name {
            let _ = fs::remove_dir_all(path);
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SourceDtype {
    Bf16,
    F32,
}

impl SourceDtype {
    const fn config_label(self) -> &'static str {
        match self {
            Self::Bf16 => "bfloat16",
            Self::F32 => "float32",
        }
    }

    const fn safetensors_label(self) -> &'static str {
        match self {
            Self::Bf16 => "BF16",
            Self::F32 => "F32",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum FixtureMutation {
    None,
    ExtraTensor,
    MissingTensor,
    DuplicateTensor,
    WrongShape,
    MixedDtype,
    UnsupportedDtype,
    Nonfinite,
    Gap,
    Overlap,
    TrailingPayload,
}

struct Fixture {
    _root: TemporaryRoot,
    source: PathBuf,
    lock: PathBuf,
    output: PathBuf,
}

impl Fixture {
    fn new(dtype: SourceDtype, mutation: FixtureMutation) -> Self {
        let root = TemporaryRoot::new();
        let source = root.path().join("source");
        let output_directory = root.path().join("output");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&output_directory).unwrap();
        write_source_files(&source, dtype, mutation);
        let lock = root.path().join("source-lock.json");
        write_lock(&source, &lock);
        let output = output_directory.join("fixture.slm2");
        Self {
            _root: root,
            source,
            lock,
            output,
        }
    }

    fn execution() -> ConverterExecutionIdentity {
        ConverterExecutionIdentity::new("test-0.1.8", "a".repeat(64)).unwrap()
    }

    fn convert(&self) -> Result<Qwen3ConversionResult, tinyrustlm_convert::Qwen3ConversionError> {
        convert_locked_qwen3_source(&self.lock, &self.source, &self.output, &Self::execution())
    }
}

fn fixture_spec() -> ModelSpec {
    ModelSpec {
        artifact_class: ArtifactClass::BaseModel,
        vocabulary_size: 32,
        context_length: 128,
        embedding_size: 8,
        feed_forward_size: 16,
        layer_count: 2,
        head_count: 2,
        kv_head_count: 1,
        head_dimension: 8,
        rope_theta: 10_000.0,
        normalization_epsilon: 0.000_01,
        tied_embeddings: true,
        qkv_bias: false,
        qk_normalization: true,
    }
}

fn source_name(role: &str, layer: i32) -> String {
    match role {
        "model.token-embedding.weight" => "model.embed_tokens.weight".to_owned(),
        "model.final-normalization.weight" => "model.norm.weight".to_owned(),
        "layer.attention-normalization.weight" => {
            format!("model.layers.{layer}.input_layernorm.weight")
        }
        "layer.feed-forward-normalization.weight" => {
            format!("model.layers.{layer}.post_attention_layernorm.weight")
        }
        "layer.attention.query-projection.weight" => {
            format!("model.layers.{layer}.self_attn.q_proj.weight")
        }
        "layer.attention.query-normalization.weight" => {
            format!("model.layers.{layer}.self_attn.q_norm.weight")
        }
        "layer.attention.key-projection.weight" => {
            format!("model.layers.{layer}.self_attn.k_proj.weight")
        }
        "layer.attention.key-normalization.weight" => {
            format!("model.layers.{layer}.self_attn.k_norm.weight")
        }
        "layer.attention.value-projection.weight" => {
            format!("model.layers.{layer}.self_attn.v_proj.weight")
        }
        "layer.attention.output-projection.weight" => {
            format!("model.layers.{layer}.self_attn.o_proj.weight")
        }
        "layer.feed-forward.gate-projection.weight" => {
            format!("model.layers.{layer}.mlp.gate_proj.weight")
        }
        "layer.feed-forward.down-projection.weight" => {
            format!("model.layers.{layer}.mlp.down_proj.weight")
        }
        "layer.feed-forward.up-projection.weight" => {
            format!("model.layers.{layer}.mlp.up_proj.weight")
        }
        _ => panic!("unexpected target role {role}"),
    }
}

fn write_source_files(source: &Path, dtype: SourceDtype, mutation: FixtureMutation) {
    write_json(
        source.join("config.json"),
        &json!({
            "architectures": ["Qwen3ForCausalLM"],
            "attention_bias": false,
            "attention_dropout": 0.0,
            "bos_token_id": 1,
            "eos_token_id": 2,
            "head_dim": 8,
            "hidden_act": "silu",
            "hidden_size": 8,
            "initializer_range": 0.02,
            "intermediate_size": 16,
            "max_position_embeddings": 128,
            "max_window_layers": 2,
            "model_type": "qwen3",
            "num_attention_heads": 2,
            "num_hidden_layers": 2,
            "num_key_value_heads": 1,
            "rms_norm_eps": 0.00001,
            "rope_scaling": null,
            "rope_theta": 10000.0,
            "sliding_window": null,
            "tie_word_embeddings": true,
            "torch_dtype": dtype.config_label(),
            "transformers_version": "fixture-1",
            "use_cache": true,
            "use_sliding_window": false,
            "vocab_size": 32
        }),
    );
    write_json(
        source.join("generation_config.json"),
        &json!({"bos_token_id": 1, "eos_token_id": 2}),
    );
    fs::write(source.join("LICENSE"), b"Apache License 2.0 fixture\n").unwrap();
    fs::write(source.join("README.md"), b"# Qwen3 fixture\n").unwrap();
    fs::write(source.join("merges.txt"), b"#version: 0.2\n").unwrap();
    fs::write(source.join("tokenizer.json"), b"{}\n").unwrap();
    fs::write(source.join("tokenizer_config.json"), b"{}\n").unwrap();
    fs::write(source.join("vocab.json"), b"{}\n").unwrap();
    write_safetensors(source.join("model.safetensors"), dtype, mutation);
}

struct TensorFixture {
    shape: Vec<u64>,
    dtype_label: String,
    bytes: Vec<u8>,
}

fn write_safetensors(path: PathBuf, dtype: SourceDtype, mutation: FixtureMutation) {
    let mut tensors = BTreeMap::new();
    for (index, spec) in required_model_tensors(&fixture_spec(), 64)
        .unwrap()
        .into_iter()
        .enumerate()
    {
        let name = source_name(spec.semantic_role(), spec.layer());
        tensors.insert(name, tensor_fixture(spec.shape(), dtype, index, false));
    }

    match mutation {
        FixtureMutation::ExtraTensor => {
            tensors.insert(
                "model.surplus.weight".to_owned(),
                tensor_fixture(&[1], dtype, 999, false),
            );
        }
        FixtureMutation::MissingTensor => {
            let first = tensors.keys().next().cloned().unwrap();
            tensors.remove(&first);
        }
        FixtureMutation::WrongShape => {
            let first = tensors.keys().next().cloned().unwrap();
            let mut shape = tensors[&first].shape.clone();
            shape[0] += 1;
            tensors.insert(first, tensor_fixture(&shape, dtype, 0, false));
        }
        FixtureMutation::MixedDtype => {
            let first = tensors.keys().next().cloned().unwrap();
            let shape = tensors[&first].shape.clone();
            tensors.insert(first, tensor_fixture(&shape, SourceDtype::F32, 0, false));
        }
        FixtureMutation::UnsupportedDtype => {
            for tensor in tensors.values_mut() {
                tensor.dtype_label = "F16".to_owned();
            }
        }
        FixtureMutation::Nonfinite => {
            let first = tensors.keys().next().cloned().unwrap();
            let shape = tensors[&first].shape.clone();
            tensors.insert(first, tensor_fixture(&shape, dtype, 0, true));
        }
        FixtureMutation::None
        | FixtureMutation::DuplicateTensor
        | FixtureMutation::Gap
        | FixtureMutation::Overlap
        | FixtureMutation::TrailingPayload => {}
    }

    let mut payload = Vec::new();
    if mutation == FixtureMutation::Gap {
        payload.push(0);
    }
    let mut entries = Vec::new();
    for (name, tensor) in tensors {
        let start = u64::try_from(payload.len()).unwrap();
        payload.extend_from_slice(&tensor.bytes);
        let end = u64::try_from(payload.len()).unwrap();
        entries.push((
            name,
            json!({
                "dtype": tensor.dtype_label,
                "shape": tensor.shape,
                "data_offsets": [start, end]
            }),
        ));
    }
    if mutation == FixtureMutation::Overlap {
        let start = entries[1].1["data_offsets"][0].as_u64().unwrap();
        let end = entries[1].1["data_offsets"][1].as_u64().unwrap();
        entries[1].1["data_offsets"] = json!([start - 1, end - 1]);
    }
    if mutation == FixtureMutation::DuplicateTensor {
        entries.push(entries[0].clone());
    }
    if mutation == FixtureMutation::TrailingPayload {
        payload.push(0);
    }

    let header = serialize_header(&entries);
    let mut complete = Vec::with_capacity(8 + header.len() + payload.len());
    complete.extend_from_slice(&u64::try_from(header.len()).unwrap().to_le_bytes());
    complete.extend_from_slice(&header);
    complete.extend_from_slice(&payload);
    fs::write(path, complete).unwrap();
}

fn tensor_fixture(
    shape: &[u64],
    dtype: SourceDtype,
    tensor_index: usize,
    nonfinite: bool,
) -> TensorFixture {
    let count = usize::try_from(shape.iter().product::<u64>()).unwrap();
    let mut bytes = Vec::new();
    for value_index in 0..count {
        let value = if nonfinite && value_index == 0 {
            f32::INFINITY
        } else {
            let magnitude = ((tensor_index + value_index) % 31 + 1) as f32 / 16.0;
            if value_index % 3 == 0 {
                -magnitude
            } else {
                magnitude
            }
        };
        match dtype {
            SourceDtype::Bf16 => {
                let value = u16::try_from(value.to_bits() >> 16).unwrap();
                bytes.extend_from_slice(&value.to_le_bytes());
            }
            SourceDtype::F32 => bytes.extend_from_slice(&value.to_le_bytes()),
        }
    }
    TensorFixture {
        shape: shape.to_vec(),
        dtype_label: dtype.safetensors_label().to_owned(),
        bytes,
    }
}

fn serialize_header(entries: &[(String, Value)]) -> Vec<u8> {
    let mut result = String::from("{");
    for (index, (name, value)) in entries.iter().enumerate() {
        if index != 0 {
            result.push(',');
        }
        result.push_str(&serde_json::to_string(name).unwrap());
        result.push(':');
        result.push_str(&serde_json::to_string(value).unwrap());
    }
    result.push('}');
    result.into_bytes()
}

fn write_json(path: PathBuf, value: &Value) {
    let mut bytes = serde_json::to_vec_pretty(value).unwrap();
    bytes.push(b'\n');
    fs::write(path, bytes).unwrap();
}

fn sha256(path: &Path) -> String {
    hex_lower(&Sha256::digest(fs::read(path).unwrap()))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
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

fn locked_file(source: &Path, name: &str) -> Value {
    let path = source.join(name);
    json!({
        "path": name,
        "byteLength": fs::metadata(&path).unwrap().len(),
        "sha256": sha256(&path)
    })
}

fn write_lock(source: &Path, lock: &Path) {
    write_json(
        lock.to_path_buf(),
        &json!({
            "schema": "tinyrustlm.qwen3_source_lock.v1",
            "modelId": "fixture/qwen3-tiny",
            "revision": "1111111111111111111111111111111111111111",
            "sourceKind": "upstream-checkpoint",
            "artifactClass": "base-model",
            "architectureProfileId": "tinyrustlm.qwen3-dense-gqa-qk-norm/1",
            "licenseSpdx": "Apache-2.0",
            "licenseDisposition": "redistribution-and-conversion-approved",
            "files": {
                "config": locked_file(source, "config.json"),
                "generationConfig": locked_file(source, "generation_config.json"),
                "license": locked_file(source, "LICENSE"),
                "merges": locked_file(source, "merges.txt"),
                "model": locked_file(source, "model.safetensors"),
                "readme": locked_file(source, "README.md"),
                "tokenizer": locked_file(source, "tokenizer.json"),
                "tokenizerConfig": locked_file(source, "tokenizer_config.json"),
                "vocab": locked_file(source, "vocab.json")
            }
        }),
    );
}

fn mutate_config(fixture: &Fixture, field: &str, value: Value) {
    let path = fixture.source.join("config.json");
    let mut config: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    config[field] = value;
    write_json(path, &config);
    write_lock(&fixture.source, &fixture.lock);
}

fn assert_no_complete_output(fixture: &Fixture) {
    assert!(!fixture.output.exists());
    assert!(!fixture
        .output
        .with_file_name("fixture.slm2.conversion-receipt.json")
        .exists());
}

#[test]
fn bf16_conversion_is_deterministic_mixed_q8_and_receipt_bound() {
    assert_eq!(
        QWEN3_CONVERSION_PROFILE_ID,
        "tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/1"
    );
    assert_eq!(
        QWEN3_CONVERSION_PROFILE_SHA256,
        "313069152daa70a2c2b5070f9d1350379a5800f647d5c3ac8d23a75ff9ead968"
    );
    let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    let first = fixture.convert().unwrap();
    let second_output = fixture.output.with_file_name("fixture-second.slm2");
    let second = convert_locked_qwen3_source(
        &fixture.lock,
        &fixture.source,
        &second_output,
        &Fixture::execution(),
    )
    .unwrap();
    assert_eq!(first.model_identity(), second.model_identity());
    let model_bytes = fs::read(first.model_path()).unwrap();
    assert_eq!(model_bytes, fs::read(second.model_path()).unwrap());

    let mut model = Cursor::new(&model_bytes);
    let validated = validate_model(&mut model, ValidationPolicy::default()).unwrap();
    assert_eq!(validated.spec(), &fixture_spec());
    assert_eq!(validated.tensors().len(), 24);
    assert_eq!(
        validated.spec().head_count * validated.spec().head_dimension,
        16
    );
    assert_ne!(validated.spec().embedding_size, 16);
    for tensor in validated.tensors() {
        let expected = if tensor.shape().len() == 2 {
            ElementType::Q8RowSymmetric
        } else {
            ElementType::F32
        };
        assert_eq!(
            tensor.element_type(),
            expected,
            "{}",
            tensor.semantic_role()
        );
    }
    for role in [
        "layer.attention.query-normalization.weight",
        "layer.attention.key-normalization.weight",
    ] {
        let matches = validated
            .tensors()
            .iter()
            .filter(|tensor| tensor.semantic_role() == role)
            .collect::<Vec<_>>();
        assert_eq!(matches.len(), 2);
        assert!(matches
            .iter()
            .all(|tensor| tensor.element_type() == ElementType::F32 && tensor.shape() == [8]));
    }

    let receipt_bytes = fs::read(first.receipt_path()).unwrap();
    assert_eq!(receipt_bytes.last(), Some(&b'\n'));
    let receipt: Value = serde_json::from_slice(&receipt_bytes).unwrap();
    assert_eq!(receipt["schema"], "tinyrustlm.qwen3_conversion_receipt.v1");
    assert_eq!(receipt["status"], "pass");
    assert_eq!(receipt["converterProfileId"], QWEN3_CONVERSION_PROFILE_ID);
    assert_eq!(
        receipt["converterProfileSha256"],
        QWEN3_CONVERSION_PROFILE_SHA256
    );
    assert_eq!(receipt["source"]["lockSha256"], sha256(&fixture.lock));
    assert_eq!(receipt["source"]["files"].as_object().unwrap().len(), 9);
    assert_eq!(receipt["source"]["sourceDtype"], "BF16");
    assert_eq!(receipt["source"]["tensorCount"], 24);
    assert_eq!(
        receipt["source"]["tensorInventorySha256"]
            .as_str()
            .unwrap()
            .len(),
        64
    );
    assert_eq!(receipt["model"]["formatProfileId"], SLM2_FORMAT_PROFILE_ID);
    assert_eq!(
        receipt["model"]["formatProfileSha256"],
        SLM2_FORMAT_PROFILE_SHA256
    );
    assert_eq!(
        receipt["model"]["weightProfileId"],
        SLM2_Q8_WEIGHT_PROFILE_ID
    );
    assert_eq!(
        receipt["model"]["weightProfileSha256"],
        SLM2_Q8_WEIGHT_PROFILE_SHA256
    );
    assert_eq!(
        receipt["model"]["artifactSha256"],
        first.model_identity().artifact_sha256_hex()
    );
    assert_eq!(receipt["model"]["specification"]["headDimension"], 8);
    assert_eq!(receipt["model"]["specification"]["qkvBias"], false);
    assert_eq!(receipt["model"]["specification"]["qkNormalization"], true);
    assert_eq!(
        receipt["conversionClaim"],
        "structural-and-byte-conversion-only"
    );
    assert_eq!(receipt["modelQualityStatus"], "not-assessed-by-converter");
    assert_eq!(
        receipt["sourceFrameworkParityStatus"],
        "not-assessed-by-converter"
    );
    assert_eq!(receipt["nativeRuntimeStatus"], "not-assessed-by-converter");
    assert_eq!(receipt["browserWasmStatus"], "not-assessed-by-converter");
    assert!(receipt.get("tokenizer").is_none());
    assert!(receipt.get("chatTemplate").is_none());

    let mut names = fs::read_dir(fixture.output.parent().unwrap())
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .collect::<Vec<_>>();
    names.sort();
    assert_eq!(
        names,
        [
            "fixture-second.slm2",
            "fixture-second.slm2.conversion-receipt.json",
            "fixture.slm2",
            "fixture.slm2.conversion-receipt.json",
        ]
    );
}

#[test]
fn f32_source_converts_without_an_alternate_output_profile() {
    let fixture = Fixture::new(SourceDtype::F32, FixtureMutation::None);
    let result = fixture.convert().unwrap();
    let receipt: Value = serde_json::from_slice(&fs::read(result.receipt_path()).unwrap()).unwrap();
    assert_eq!(receipt["source"]["sourceDtype"], "F32");
    assert_eq!(
        receipt["model"]["weightProfileId"],
        SLM2_Q8_WEIGHT_PROFILE_ID
    );
    let mut model = Cursor::new(fs::read(result.model_path()).unwrap());
    let validated = validate_model(&mut model, ValidationPolicy::default()).unwrap();
    assert!(validated
        .tensors()
        .iter()
        .filter(|tensor| tensor.shape().len() == 2)
        .all(|tensor| tensor.element_type() == ElementType::Q8RowSymmetric));
}

#[test]
fn every_locked_source_file_hash_is_checked_before_output() {
    for name in SOURCE_FILES {
        let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
        let path = fixture.source.join(name);
        let mut bytes = fs::read(&path).unwrap();
        bytes[0] ^= 1;
        fs::write(path, bytes).unwrap();
        let error = fixture.convert().unwrap_err();
        assert_eq!(error.code(), "qwen3-source-hash-mismatch", "{name}");
        assert_no_complete_output(&fixture);
    }
}

#[test]
fn source_directory_inventory_is_closed() {
    let missing = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    fs::remove_file(missing.source.join("README.md")).unwrap();
    assert_eq!(
        missing.convert().unwrap_err().code(),
        "qwen3-source-inventory-invalid"
    );
    assert_no_complete_output(&missing);

    let extra = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    fs::write(extra.source.join("unexpected.txt"), b"unexpected\n").unwrap();
    assert_eq!(
        extra.convert().unwrap_err().code(),
        "qwen3-source-inventory-invalid"
    );
    assert_no_complete_output(&extra);
}

#[test]
fn duplicate_config_members_and_changed_operator_semantics_fail_closed() {
    let duplicate = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    let path = duplicate.source.join("config.json");
    let source = fs::read_to_string(&path).unwrap();
    fs::write(
        &path,
        source.replacen('{', "{\n  \"attention_bias\": false,", 1),
    )
    .unwrap();
    write_lock(&duplicate.source, &duplicate.lock);
    assert_eq!(
        duplicate.convert().unwrap_err().code(),
        "qwen3-config-invalid"
    );

    for (field, value) in [
        ("attention_bias", json!(true)),
        ("hidden_act", json!("gelu")),
        ("tie_word_embeddings", json!(false)),
        ("use_sliding_window", json!(true)),
        ("num_key_value_heads", json!(3)),
    ] {
        let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
        mutate_config(&fixture, field, value);
        assert_eq!(
            fixture.convert().unwrap_err().code(),
            "qwen3-config-semantics-unsupported",
            "{field}"
        );
        assert_no_complete_output(&fixture);
    }
}

#[test]
fn nonnull_rope_or_sliding_window_contract_is_rejected() {
    for (field, value) in [("rope_scaling", json!({})), ("sliding_window", json!(128))] {
        let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
        mutate_config(&fixture, field, value);
        assert_eq!(
            fixture.convert().unwrap_err().code(),
            "qwen3-config-invalid"
        );
        assert_no_complete_output(&fixture);
    }
}

#[test]
fn tensor_inventory_and_shapes_are_exact() {
    for (mutation, expected) in [
        (
            FixtureMutation::ExtraTensor,
            "qwen3-tensor-inventory-mismatch",
        ),
        (
            FixtureMutation::MissingTensor,
            "qwen3-tensor-inventory-mismatch",
        ),
        (
            FixtureMutation::DuplicateTensor,
            "qwen3-safetensors-invalid",
        ),
        (FixtureMutation::WrongShape, "qwen3-tensor-shape-mismatch"),
    ] {
        let fixture = Fixture::new(SourceDtype::Bf16, mutation);
        assert_eq!(
            fixture.convert().unwrap_err().code(),
            expected,
            "{mutation:?}"
        );
        assert_no_complete_output(&fixture);
    }
}

#[test]
fn mixed_and_unsupported_source_dtypes_are_rejected() {
    for mutation in [
        FixtureMutation::MixedDtype,
        FixtureMutation::UnsupportedDtype,
    ] {
        let fixture = Fixture::new(SourceDtype::Bf16, mutation);
        assert_eq!(
            fixture.convert().unwrap_err().code(),
            "qwen3-source-dtype-unsupported",
            "{mutation:?}"
        );
        assert_no_complete_output(&fixture);
    }
}

#[test]
fn noncontiguous_overlapping_and_trailing_ranges_are_rejected() {
    for mutation in [
        FixtureMutation::Gap,
        FixtureMutation::Overlap,
        FixtureMutation::TrailingPayload,
    ] {
        let fixture = Fixture::new(SourceDtype::Bf16, mutation);
        assert_eq!(
            fixture.convert().unwrap_err().code(),
            "qwen3-safetensors-range-invalid",
            "{mutation:?}"
        );
        assert_no_complete_output(&fixture);
    }
}

#[test]
fn nonfinite_source_is_preserved_as_a_failed_stage() {
    let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::Nonfinite);
    let error = fixture.convert().unwrap_err();
    assert_eq!(error.code(), "qwen3-source-nonfinite");
    assert_no_complete_output(&fixture);
    assert!(fixture
        .output
        .with_file_name(".fixture.slm2.staging")
        .exists());
}

#[test]
fn output_is_create_only_and_source_output_overlap_is_forbidden() {
    let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    fixture.convert().unwrap();
    assert_eq!(
        fixture.convert().unwrap_err().code(),
        "qwen3-output-already-exists"
    );

    let staged = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    fs::write(
        staged.output.with_file_name(".fixture.slm2.staging"),
        b"preserved incident\n",
    )
    .unwrap();
    assert_eq!(
        staged.convert().unwrap_err().code(),
        "qwen3-output-already-exists"
    );
    assert_no_complete_output(&staged);

    let overlap = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    let output = overlap.source.join("candidate.slm2");
    let error = convert_locked_qwen3_source(
        &overlap.lock,
        &overlap.source,
        &output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen3-output-overlaps-source");
    assert!(!output.exists());
}

#[test]
fn complete_output_reparses_and_proper_prefix_does_not() {
    let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    let result = fixture.convert().unwrap();
    let bytes = fs::read(result.model_path()).unwrap();
    let mut complete = Cursor::new(&bytes);
    assert!(validate_model(&mut complete, ValidationPolicy::default()).is_ok());
    let mut prefix = Cursor::new(&bytes[..bytes.len() - 1]);
    assert!(validate_model(&mut prefix, ValidationPolicy::default()).is_err());

    let mut hostile = bytes;
    let last = hostile.len() - 1;
    hostile[last] ^= 1;
    let mut hostile = Cursor::new(hostile);
    assert!(validate_model(&mut hostile, ValidationPolicy::default()).is_err());
}

#[test]
fn receipt_source_model_identity_matches_locked_bytes() {
    let fixture = Fixture::new(SourceDtype::Bf16, FixtureMutation::None);
    let result = fixture.convert().unwrap();
    let receipt: Value = serde_json::from_slice(&fs::read(result.receipt_path()).unwrap()).unwrap();
    let source_model = fs::read(fixture.source.join("model.safetensors")).unwrap();
    assert_eq!(
        receipt["source"]["sourceModelSha256"],
        sha256_bytes(&source_model)
    );
    assert_eq!(
        receipt["source"]["sourceModelBytes"],
        u64::try_from(source_model.len()).unwrap()
    );
}
