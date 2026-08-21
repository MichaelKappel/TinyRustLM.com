//! End-to-end and fail-closed tests for the sole Qwen2 conversion profile.

use std::collections::BTreeMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tinyrustlm_convert::{
    convert_locked_qwen2_source, ConverterExecutionIdentity, QWEN2_CONVERSION_PROFILE_ID,
    QWEN2_CONVERSION_PROFILE_SHA256,
};
use tinyrustlm_slm2::{
    required_model_tensors, validate_model, ArtifactClass, ModelSpec, ValidationPolicy,
};
use tinyrustlm_tokenizer2::{Tokenizer2, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID};

static NEXT_TEMPORARY_ROOT: AtomicU64 = AtomicU64::new(0);

struct TemporaryRoot(PathBuf);

impl TemporaryRoot {
    fn new() -> Self {
        let sequence = NEXT_TEMPORARY_ROOT.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "tinyrustlm-qwen2-conversion-{}-{sequence}",
            std::process::id()
        ));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TemporaryRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[derive(Clone, Copy)]
enum FixtureMutation {
    None,
    ExtraTensor,
    Nonfinite,
}

struct Fixture {
    _root: TemporaryRoot,
    source: PathBuf,
    lock: PathBuf,
    output: PathBuf,
}

impl Fixture {
    fn new(mutation: FixtureMutation) -> Self {
        let root = TemporaryRoot::new();
        let source = root.path().join("source");
        let output_dir = root.path().join("output");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&output_dir).unwrap();
        write_source_files(&source, mutation);
        let lock = root.path().join("source-lock.json");
        write_lock(&source, &lock);
        let output = output_dir.join("fixture.slm2");
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
}

fn fixture_spec() -> ModelSpec {
    ModelSpec {
        artifact_class: ArtifactClass::BaseModel,
        vocabulary_size: 259,
        context_length: 128,
        embedding_size: 8,
        feed_forward_size: 16,
        layer_count: 2,
        head_count: 2,
        kv_head_count: 1,
        head_dimension: 4,
        rope_theta: 10_000.0,
        normalization_epsilon: 0.000_01,
        tied_embeddings: true,
        qkv_bias: true,
        qk_normalization: false,
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
        "layer.attention.key-projection.weight" => {
            format!("model.layers.{layer}.self_attn.k_proj.weight")
        }
        "layer.attention.value-projection.weight" => {
            format!("model.layers.{layer}.self_attn.v_proj.weight")
        }
        "layer.attention.output-projection.weight" => {
            format!("model.layers.{layer}.self_attn.o_proj.weight")
        }
        "layer.attention.query-projection.bias" => {
            format!("model.layers.{layer}.self_attn.q_proj.bias")
        }
        "layer.attention.key-projection.bias" => {
            format!("model.layers.{layer}.self_attn.k_proj.bias")
        }
        "layer.attention.value-projection.bias" => {
            format!("model.layers.{layer}.self_attn.v_proj.bias")
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

fn write_source_files(source: &Path, mutation: FixtureMutation) {
    let config = json!({
        "architectures": ["Qwen2ForCausalLM"],
        "attention_dropout": 0.0,
        "bos_token_id": 257,
        "eos_token_id": 258,
        "hidden_act": "silu",
        "hidden_size": 8,
        "initializer_range": 0.02,
        "intermediate_size": 16,
        "max_position_embeddings": 128,
        "max_window_layers": 1,
        "model_type": "qwen2",
        "num_attention_heads": 2,
        "num_hidden_layers": 2,
        "num_key_value_heads": 1,
        "rms_norm_eps": 0.00001,
        "rope_theta": 10000.0,
        "sliding_window": 128,
        "tie_word_embeddings": true,
        "torch_dtype": "bfloat16",
        "transformers_version": "fixture-1",
        "use_cache": true,
        "use_sliding_window": false,
        "vocab_size": 259
    });
    write_json(source.join("config.json"), &config);
    write_json(
        source.join("generation_config.json"),
        &json!({"bos_token_id": 257, "eos_token_id": 258}),
    );
    fs::write(source.join("LICENSE"), b"Apache License 2.0 fixture\n").unwrap();
    fs::write(source.join("README.md"), b"# Qwen2 fixture\n").unwrap();
    let vocab = byte_level_vocab();
    fs::write(source.join("merges.txt"), b"#version: 0.2\na b\n").unwrap();
    write_json(source.join("vocab.json"), &json!(vocab));
    write_json(
        source.join("tokenizer.json"),
        &json!({
            "version": "1.0",
            "truncation": null,
            "padding": null,
            "added_tokens": [
                {
                    "id": 257,
                    "content": "<bos>",
                    "single_word": false,
                    "lstrip": false,
                    "rstrip": false,
                    "normalized": false,
                    "special": true
                },
                {
                    "id": 258,
                    "content": "<eos>",
                    "single_word": false,
                    "lstrip": false,
                    "rstrip": false,
                    "normalized": false,
                    "special": true
                }
            ],
            "normalizer": {"type": "NFC"},
            "pre_tokenizer": {
                "type": "Sequence",
                "pretokenizers": [
                    {
                        "type": "Split",
                        "pattern": {
                            "Regex": "(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+"
                        },
                        "behavior": "Isolated",
                        "invert": false
                    },
                    {
                        "type": "ByteLevel",
                        "add_prefix_space": false,
                        "trim_offsets": false,
                        "use_regex": false
                    }
                ]
            },
            "post_processor": {
                "type": "ByteLevel",
                "add_prefix_space": false,
                "trim_offsets": false,
                "use_regex": false
            },
            "decoder": {
                "type": "ByteLevel",
                "add_prefix_space": false,
                "trim_offsets": false,
                "use_regex": false
            },
            "model": {
                "type": "BPE",
                "dropout": null,
                "unk_token": null,
                "continuing_subword_prefix": "",
                "end_of_word_suffix": "",
                "fuse_unk": false,
                "byte_fallback": false,
                "ignore_merges": false,
                "vocab": vocab,
                "merges": [["a", "b"]]
            }
        }),
    );
    write_json(
        source.join("tokenizer_config.json"),
        &json!({
            "add_bos_token": false,
            "add_prefix_space": false,
            "added_tokens_decoder": {
                "257": {
                    "content": "<bos>",
                    "lstrip": false,
                    "normalized": false,
                    "rstrip": false,
                    "single_word": false,
                    "special": true
                },
                "258": {
                    "content": "<eos>",
                    "lstrip": false,
                    "normalized": false,
                    "rstrip": false,
                    "single_word": false,
                    "special": true
                }
            },
            "additional_special_tokens": ["<bos>", "<eos>"],
            "bos_token": "<bos>",
            "eos_token": "<eos>",
            "chat_template": "{% for message in messages %}{{ message['role'] }}: {{ message['content'] }}\\n{% endfor %}assistant:",
            "clean_up_tokenization_spaces": false,
            "errors": "replace",
            "model_max_length": 128,
            "pad_token": "<bos>",
            "split_special_tokens": false,
            "tokenizer_class": "Qwen2Tokenizer",
            "unk_token": null
        }),
    );
    write_safetensors(source.join("model.safetensors"), mutation);
}

fn byte_level_vocab() -> BTreeMap<String, u32> {
    let mut bytes = (b'!'..=b'~')
        .chain(0xa1_u8..=0xac)
        .chain(0xae_u8..=0xff)
        .collect::<Vec<_>>();
    let mut code_points = bytes
        .iter()
        .map(|byte| u32::from(*byte))
        .collect::<Vec<_>>();
    let mut extension = 0_u32;
    for byte in 0_u8..=u8::MAX {
        if !bytes.contains(&byte) {
            bytes.push(byte);
            code_points.push(256 + extension);
            extension += 1;
        }
    }
    let mut vocab = bytes
        .into_iter()
        .zip(code_points)
        .enumerate()
        .map(|(id, (_, code_point))| (char::from_u32(code_point).unwrap().to_string(), id as u32))
        .collect::<BTreeMap<_, _>>();
    vocab.insert("ab".to_owned(), 256);
    vocab
}

fn write_safetensors(path: PathBuf, mutation: FixtureMutation) {
    let mut tensors = BTreeMap::new();
    for (index, spec) in required_model_tensors(&fixture_spec(), 64)
        .unwrap()
        .into_iter()
        .enumerate()
    {
        let count = spec.shape().iter().product::<u64>() as usize;
        let mut bytes = Vec::with_capacity(count * 2);
        for value_index in 0..count {
            let value = (index * 1000 + value_index + 1) as f32 / 1024.0;
            let bf16 = (value.to_bits() >> 16) as u16;
            bytes.extend_from_slice(&bf16.to_le_bytes());
        }
        tensors.insert(
            source_name(spec.semantic_role(), spec.layer()),
            (spec.shape().to_vec(), bytes),
        );
    }
    if matches!(mutation, FixtureMutation::ExtraTensor) {
        tensors.insert("model.surplus.weight".to_owned(), (vec![1], vec![0, 0]));
    }
    if matches!(mutation, FixtureMutation::Nonfinite) {
        tensors.values_mut().next().unwrap().1[..2].copy_from_slice(&0x7f80_u16.to_le_bytes());
    }

    let mut header = serde_json::Map::new();
    let mut payload = Vec::new();
    for (name, (shape, bytes)) in tensors {
        let start = payload.len() as u64;
        payload.extend_from_slice(&bytes);
        let end = payload.len() as u64;
        header.insert(
            name,
            json!({"dtype": "BF16", "shape": shape, "data_offsets": [start, end]}),
        );
    }
    let header = serde_json::to_vec(&Value::Object(header)).unwrap();
    let mut complete = Vec::with_capacity(8 + header.len() + payload.len());
    complete.extend_from_slice(&(header.len() as u64).to_le_bytes());
    complete.extend_from_slice(&header);
    complete.extend_from_slice(&payload);
    fs::write(path, complete).unwrap();
}

fn write_json(path: PathBuf, value: &Value) {
    let mut bytes = serde_json::to_vec_pretty(value).unwrap();
    bytes.push(b'\n');
    fs::write(path, bytes).unwrap();
}

fn sha256(path: &Path) -> String {
    hex_lower(&Sha256::digest(fs::read(path).unwrap()))
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
            "schema": "tinyrustlm.qwen2_source_lock.v1",
            "modelId": "fixture/qwen2-tiny",
            "revision": "1111111111111111111111111111111111111111",
            "sourceKind": "upstream-checkpoint",
            "artifactClass": "base-model",
            "architectureProfileId": "tinyrustlm.qwen2-dense-gqa/1",
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

#[test]
fn profile_identity_and_deterministic_conversion_are_exact() {
    assert_eq!(
        QWEN2_CONVERSION_PROFILE_ID,
        "tinyrustlm.qwen2-safetensors-to-slm2-f32/1"
    );
    assert_eq!(
        QWEN2_CONVERSION_PROFILE_SHA256,
        "db4d16ce83460856588bda98829a16bbc23805f82ecad0f40b9380c77ea092fc"
    );
    let fixture = Fixture::new(FixtureMutation::None);
    let first = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap();
    let second_output = fixture.output.with_file_name("fixture-second.slm2");
    let second = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &second_output,
        &Fixture::execution(),
    )
    .unwrap();
    assert_eq!(first.model_identity(), second.model_identity());
    assert_eq!(
        fs::read(first.model_path()).unwrap(),
        fs::read(second.model_path()).unwrap()
    );

    let mut model = Cursor::new(fs::read(first.model_path()).unwrap());
    let validated = validate_model(&mut model, ValidationPolicy::default()).unwrap();
    assert_eq!(validated.spec(), &fixture_spec());
    assert_eq!(validated.tensors().len(), 26);
    let receipt: Value = serde_json::from_slice(&fs::read(first.receipt_path()).unwrap()).unwrap();
    assert_eq!(receipt["status"], "pass");
    assert_eq!(
        receipt["conversionClaim"],
        "structural-and-byte-conversion-only"
    );
    assert_eq!(receipt["qualityStatus"], "not-assessed-by-converter");
    assert_eq!(receipt["runtimeStatus"], "not-assessed-by-converter");
    assert_eq!(
        receipt["tokenizer"]["formatProfileId"],
        TOKENIZER2_FORMAT_PROFILE_ID
    );
    assert_eq!(receipt["tokenizer"]["tokenCount"], 259);
    assert_eq!(receipt["tokenizer"]["baseTokenCount"], 257);
    assert_eq!(receipt["tokenizer"]["mergeCount"], 1);
    assert_eq!(
        receipt["chatTemplate"]["sourceFormat"],
        "publisher-jinja-text"
    );
    assert_eq!(
        receipt["chatTemplate"]["promotionStatus"],
        "unpromoted-source-evidence-only"
    );
    let tokenizer_bytes = fs::read(first.tokenizer_path()).unwrap();
    let tokenizer = Tokenizer2::from_bytes(
        tokenizer_bytes,
        TokenizerPolicy::new(1_048_576, 65_536, 65_536, 262_144).unwrap(),
    )
    .unwrap();
    assert_eq!(tokenizer.token_count(), 259);
    let mut encoded = Vec::new();
    tokenizer.encode("ab<eos>", &mut encoded).unwrap();
    assert_eq!(encoded, vec![256, 258]);
}

#[test]
fn source_hash_drift_fails_before_output_creation() {
    let fixture = Fixture::new(FixtureMutation::None);
    fs::write(fixture.source.join("README.md"), b"changed\n").unwrap();
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen2-source-file-invalid");
    assert!(!fixture.output.exists());
}

#[test]
fn unsupported_architecture_is_rejected_after_relocking() {
    let fixture = Fixture::new(FixtureMutation::None);
    let config_path = fixture.source.join("config.json");
    let mut config: Value = serde_json::from_slice(&fs::read(&config_path).unwrap()).unwrap();
    config["architectures"] = json!(["Qwen3ForCausalLM"]);
    write_json(config_path, &config);
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen2-config-semantics-unsupported");
}

#[test]
fn surplus_tensor_is_rejected_without_guessing() {
    let fixture = Fixture::new(FixtureMutation::ExtraTensor);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen2-tensor-inventory-mismatch");
}

#[test]
fn nonfinite_source_is_preserved_as_a_failed_stage() {
    let fixture = Fixture::new(FixtureMutation::Nonfinite);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen2-source-nonfinite");
    assert!(!fixture.output.exists());
    assert!(fixture
        .output
        .with_file_name(".fixture.slm2.staging")
        .exists());
}

#[test]
fn successful_output_is_create_only() {
    let fixture = Fixture::new(FixtureMutation::None);
    convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap();
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen2-output-already-exists");
}

#[test]
fn duplicate_tokenizer_json_member_is_rejected_after_relocking() {
    let fixture = Fixture::new(FixtureMutation::None);
    let path = fixture.source.join("tokenizer.json");
    let source = fs::read_to_string(&path).unwrap();
    let duplicate = source.replacen('{', "{\n  \"version\": \"1.0\",", 1);
    fs::write(path, duplicate).unwrap();
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-json-invalid");
    assert!(!fixture.output.exists());
}

#[test]
fn unknown_tokenizer_pipeline_member_is_rejected_after_relocking() {
    let fixture = Fixture::new(FixtureMutation::None);
    let path = fixture.source.join("tokenizer.json");
    let mut tokenizer: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    tokenizer["unexpected"] = json!(true);
    write_json(path, &tokenizer);
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-json-invalid");
}

#[test]
fn redundant_vocab_disagreement_is_rejected_after_relocking() {
    let fixture = Fixture::new(FixtureMutation::None);
    let path = fixture.source.join("vocab.json");
    let mut vocab: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    vocab["a"] = json!(999);
    write_json(path, &vocab);
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-vocab-mismatch");
}

#[test]
fn redundant_merges_disagreement_is_rejected_after_relocking() {
    let fixture = Fixture::new(FixtureMutation::None);
    fs::write(fixture.source.join("merges.txt"), b"#version: 0.2\na c\n").unwrap();
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-merges-mismatch");
}

#[test]
fn unsupported_bytelevel_option_is_rejected_after_relocking() {
    let fixture = Fixture::new(FixtureMutation::None);
    let path = fixture.source.join("tokenizer.json");
    let mut tokenizer: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    tokenizer["decoder"]["use_regex"] = json!(true);
    write_json(path, &tokenizer);
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-pipeline-unsupported");
}
