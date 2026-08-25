//! Standalone Qwen tokenizer conversion transaction and hostile-input tests.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tinyrustlm_convert::{
    convert_locked_qwen_tokenizer2_source, ConverterExecutionIdentity,
    QWEN_TOKENIZER2_CONVERSION_PROFILE_ID, QWEN_TOKENIZER2_CONVERSION_PROFILE_SHA256,
    QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA,
};
use tinyrustlm_tokenizer2::{
    Tokenizer2, TokenizerPolicy, TOKENIZER2_FORMAT_PROFILE_ID, TOKENIZER2_FORMAT_PROFILE_SHA256,
};

static NEXT_TEMPORARY_ROOT: AtomicU64 = AtomicU64::new(0);

struct TemporaryRoot(PathBuf);

impl TemporaryRoot {
    fn new() -> Self {
        let sequence = NEXT_TEMPORARY_ROOT.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "tinyrustlm-qwen-tokenizer2-conversion-{}-{sequence}",
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

struct Fixture {
    _root: TemporaryRoot,
    source: PathBuf,
    lock: PathBuf,
    output: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = TemporaryRoot::new();
        let source = root.path().join("source");
        let output_directory = root.path().join("output");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&output_directory).unwrap();
        write_source(&source);
        let lock = root.path().join("source-lock.json");
        write_lock(&source, &lock);
        let output = output_directory.join("fixture.tok2");
        Self {
            _root: root,
            source,
            lock,
            output,
        }
    }

    fn execution() -> ConverterExecutionIdentity {
        ConverterExecutionIdentity::new("test-0.1.8", "b".repeat(64)).unwrap()
    }
}

fn write_source(source: &Path) {
    write_json(
        source.join("config.json"),
        &json!({
            "architectures": ["Qwen3ForCausalLM"],
            "attention_bias": false,
            "attention_dropout": 0.0,
            "bos_token_id": 257,
            "eos_token_id": 258,
            "head_dim": 4,
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
            "torch_dtype": "bfloat16",
            "transformers_version": "fixture-1",
            "use_cache": true,
            "use_sliding_window": false,
            "vocab_size": 259
        }),
    );
    let vocab = byte_level_vocab();
    write_json(source.join("vocab.json"), &json!(vocab));
    fs::write(source.join("merges.txt"), b"#version: 0.2\na b\n").unwrap();
    write_json(
        source.join("tokenizer.json"),
        &json!({
            "version": "1.0",
            "truncation": null,
            "padding": null,
            "added_tokens": [
                {
                    "id": 257,
                    "content": "<|endoftext|>",
                    "single_word": false,
                    "lstrip": false,
                    "rstrip": false,
                    "normalized": false,
                    "special": true
                },
                {
                    "id": 258,
                    "content": "<|im_end|>",
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
                    "content": "<|endoftext|>",
                    "lstrip": false,
                    "normalized": false,
                    "rstrip": false,
                    "single_word": false,
                    "special": true
                },
                "258": {
                    "content": "<|im_end|>",
                    "lstrip": false,
                    "normalized": false,
                    "rstrip": false,
                    "single_word": false,
                    "special": true
                }
            },
            "additional_special_tokens": ["<|im_end|>"],
            "bos_token": null,
            "chat_template": "{% for message in messages %}{{ message['role'] }}: {{ message['content'] }}\\n{% endfor %}assistant:",
            "clean_up_tokenization_spaces": false,
            "eos_token": "<|im_end|>",
            "errors": "replace",
            "model_max_length": 128,
            "pad_token": "<|endoftext|>",
            "split_special_tokens": false,
            "tokenizer_class": "Qwen2Tokenizer",
            "unk_token": null
        }),
    );
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

fn write_lock(source: &Path, lock: &Path) {
    write_json(
        lock.to_path_buf(),
        &json!({
            "schema": QWEN_TOKENIZER2_SOURCE_LOCK_SCHEMA,
            "modelId": "fixture/qwen3-tiny",
            "revision": "2222222222222222222222222222222222222222",
            "sourceKind": "upstream-checkpoint",
            "architectureProfileId": "tinyrustlm.qwen3-tokenizer-source/1",
            "files": {
                "config": locked_file(source, "config.json"),
                "merges": locked_file(source, "merges.txt"),
                "tokenizer": locked_file(source, "tokenizer.json"),
                "tokenizerConfig": locked_file(source, "tokenizer_config.json"),
                "vocab": locked_file(source, "vocab.json")
            }
        }),
    );
}

fn locked_file(source: &Path, name: &str) -> Value {
    let path = source.join(name);
    json!({
        "path": name,
        "byteLength": fs::metadata(&path).unwrap().len(),
        "sha256": sha256(&path)
    })
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

#[test]
fn deterministic_conversion_receipt_and_reparse_are_exact() {
    assert_eq!(
        QWEN_TOKENIZER2_CONVERSION_PROFILE_ID,
        "tinyrustlm.qwen-bytelevel-to-tokenizer2/1"
    );
    assert_eq!(
        QWEN_TOKENIZER2_CONVERSION_PROFILE_SHA256,
        "f70465a08b41599fe59f41b850912d0d408f0ec67e84ebeb7591524d1b14e12b"
    );
    let fixture = Fixture::new();
    let first = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap();
    let second_output = fixture.output.with_file_name("fixture-second.tok2");
    let second = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &second_output,
        &Fixture::execution(),
    )
    .unwrap();
    assert_eq!(first.tokenizer_identity(), second.tokenizer_identity());
    assert_eq!(
        fs::read(first.tokenizer_path()).unwrap(),
        fs::read(second.tokenizer_path()).unwrap()
    );
    let receipt_bytes = fs::read(first.receipt_path()).unwrap();
    let receipt_identity = first.receipt_identity();
    assert_eq!(receipt_identity.byte_length(), receipt_bytes.len() as u64);
    assert_eq!(receipt_identity.sha256_hex(), sha256_bytes(&receipt_bytes));
    let receipt: Value = serde_json::from_slice(&receipt_bytes).unwrap();
    assert_eq!(receipt["status"], "pass");
    assert_eq!(
        receipt["tokenizerFormatProfileId"],
        TOKENIZER2_FORMAT_PROFILE_ID
    );
    assert_eq!(
        receipt["tokenizerFormatProfileSha256"],
        TOKENIZER2_FORMAT_PROFILE_SHA256
    );
    assert_eq!(receipt["artifact"]["tokenCount"], 259);
    assert_eq!(receipt["artifact"]["baseTokenCount"], 257);
    assert_eq!(receipt["artifact"]["mergeCount"], 1);
    assert_eq!(receipt["artifact"]["bosTokenId"], Value::Null);
    assert_eq!(receipt["artifact"]["eosTokenId"], 258);
    assert_eq!(receipt["artifact"]["padTokenId"], 257);
    assert_eq!(
        receipt["conversionClaim"],
        "deterministic-tokenizer-format-conversion-only"
    );
    assert_eq!(receipt["browserWasmStatus"], "not-assessed-by-converter");

    let tokenizer = Tokenizer2::from_bytes(
        fs::read(first.tokenizer_path()).unwrap(),
        TokenizerPolicy::new(1_048_576, 65_536, 65_536, 262_144).unwrap(),
    )
    .unwrap();
    let mut encoded = Vec::new();
    tokenizer.encode("ab<|im_end|>", &mut encoded).unwrap();
    assert_eq!(encoded, vec![256, 258]);
}

#[test]
fn changed_source_hash_fails_before_output_creation() {
    let fixture = Fixture::new();
    fs::write(fixture.source.join("merges.txt"), b"changed\n").unwrap();
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer2-source-file-invalid");
    assert!(!fixture.output.exists());
}

#[test]
fn extra_source_inventory_member_is_fatal() {
    let fixture = Fixture::new();
    fs::write(fixture.source.join("README.md"), b"unexpected\n").unwrap();
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer2-source-inventory-invalid");
}

#[test]
fn duplicate_source_lock_member_is_fatal() {
    let fixture = Fixture::new();
    let lock = fs::read_to_string(&fixture.lock).unwrap();
    let duplicate = lock.replacen(
        '{',
        "{\n  \"schema\": \"tinyrustlm.qwen_tokenizer2_source_lock.v1\",",
        1,
    );
    fs::write(&fixture.lock, duplicate).unwrap();
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer2-source-lock-invalid");
}

#[test]
fn duplicate_tokenizer_member_remains_fatal_after_relocking() {
    let fixture = Fixture::new();
    let path = fixture.source.join("tokenizer.json");
    let tokenizer = fs::read_to_string(&path).unwrap();
    let duplicate = tokenizer.replacen('{', "{\n  \"version\": \"1.0\",", 1);
    fs::write(path, duplicate).unwrap();
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-json-invalid");
}

#[test]
fn unknown_qwen3_config_member_remains_fatal_after_relocking() {
    let fixture = Fixture::new();
    let path = fixture.source.join("config.json");
    let mut config: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    config["unsupported"] = json!(true);
    write_json(path, &config);
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer2-config-invalid");
}

#[test]
fn model_and_tokenizer_special_ids_must_agree() {
    let fixture = Fixture::new();
    let path = fixture.source.join("config.json");
    let mut config: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    config["eos_token_id"] = json!(257);
    write_json(path, &config);
    write_lock(&fixture.source, &fixture.lock);
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer-model-contract-mismatch");
}

#[test]
fn completed_outputs_are_create_only() {
    let fixture = Fixture::new();
    convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap();
    let error = convert_locked_qwen_tokenizer2_source(
        &fixture.lock,
        &fixture.source,
        &fixture.output,
        &Fixture::execution(),
    )
    .unwrap_err();
    assert_eq!(error.code(), "qwen-tokenizer2-output-already-exists");
}
