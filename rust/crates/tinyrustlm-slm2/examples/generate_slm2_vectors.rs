//! Deterministic owner for the checked-in language-neutral SLM2 vector document.

use std::collections::BTreeSet;
use std::env;
use std::error::Error;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use tinyrustlm_slm2::{
    build_piece_manifest, required_model_tensors, validate_model, write_model, ArtifactClass,
    ModelSpec, TensorInput, ValidationPolicy, SLM2_FORMAT_PROFILE_ID, SLM2_FORMAT_PROFILE_SHA256,
};

type DynError = Box<dyn Error>;

fn main() {
    if let Err(error) = run() {
        eprintln!("SLM2 vector generation failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), DynError> {
    let path = vector_path();
    let generated = generate_document()?;
    match env::args().skip(1).collect::<Vec<_>>().as_slice() {
        [argument] if argument == "--check" => {
            if fs::read(&path)? != generated {
                return Err(
                    "checked-in SLM2 vector document does not match the Rust generator".into(),
                );
            }
            println!("{{\"status\":\"pass\",\"vectors\":1}}");
        }
        [argument] if argument == "--write" => {
            fs::write(&path, &generated)?;
            println!("{{\"status\":\"written\",\"vectors\":1}}");
        }
        _ => return Err("usage: generate_slm2_vectors (--check|--write)".into()),
    }
    Ok(())
}

fn vector_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("contracts")
        .join("vnext")
        .join("slm2-format-vectors.v1.json")
}

fn reference_spec() -> ModelSpec {
    ModelSpec {
        artifact_class: ArtifactClass::BaseModel,
        vocabulary_size: 32,
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

fn generate_document() -> Result<Vec<u8>, DynError> {
    let spec = reference_spec();
    let mut inputs = required_model_tensors(&spec, 64)?
        .into_iter()
        .enumerate()
        .map(|(tensor_index, tensor)| {
            let count = tensor.shape().iter().copied().product::<u64>().max(1) as usize;
            let values = (0..count)
                .map(|value_index| (tensor_index * 10_000 + value_index + 1) as f32 / 1024.0)
                .flat_map(f32::to_le_bytes)
                .collect::<Vec<_>>();
            TensorInput::new(tensor, Cursor::new(values))
        })
        .collect::<Vec<_>>();
    inputs.reverse();

    let mut destination = Cursor::new(Vec::new());
    let writer_identity = write_model(&mut destination, &spec, &mut inputs)?;
    let artifact = destination.into_inner();
    let validated = validate_model(&mut Cursor::new(&artifact), ValidationPolicy::default())?;
    if validated.identity() != &writer_identity || validated.spec() != &spec {
        return Err("Rust writer and validator disagreed while generating SLM2 vector".into());
    }
    let pieces = build_piece_manifest(&mut Cursor::new(&artifact))?;
    let first_payload_offset = validated
        .tensors()
        .first()
        .ok_or("generated SLM2 vector has no tensors")?
        .payload_offset();
    let strings = validated
        .tensors()
        .iter()
        .flat_map(|tensor| [tensor.semantic_role(), tensor.canonical_name()])
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let tensors = validated
        .tensors()
        .iter()
        .map(|tensor| {
            json!({
                "semanticRole": tensor.semantic_role(),
                "canonicalName": tensor.canonical_name(),
                "layer": tensor.layer(),
                "subindex0": tensor.subindex_0(),
                "subindex1": tensor.subindex_1(),
                "shape": tensor.shape(),
                "logicalElements": tensor.logical_elements(),
                "payloadRelativeOffset": tensor.payload_offset() - read_u64(&artifact, 144),
                "payloadLength": tensor.payload_length(),
                "payloadAlignment": tensor.payload_alignment(),
                "payloadSha256": hex_lower(tensor.payload_sha256())
            })
        })
        .collect::<Vec<_>>();
    let document = json!({
        "schema": "tinyrustlm.vnext.slm2-format-vectors.v1",
        "profileId": SLM2_FORMAT_PROFILE_ID,
        "profileSha256": SLM2_FORMAT_PROFILE_SHA256,
        "vectors": [{
            "id": "base-model-required-f32-tensor-registry",
            "artifactHex": hex_lower(&artifact),
            "artifactByteLength": artifact.len(),
            "artifactSha256": writer_identity.artifact_sha256_hex(),
            "manifestSha256": writer_identity.manifest_sha256_hex(),
            "tensorLayoutSha256": hex_lower(validated.tensor_layout_sha256()),
            "header": {
                "headerBytes": read_u32(&artifact, 24),
                "artifactClass": read_u16(&artifact, 36),
                "fileSize": read_u64(&artifact, 40),
                "manifestOffset": read_u64(&artifact, 48),
                "manifestLength": read_u64(&artifact, 56),
                "stringTableOffset": read_u64(&artifact, 64),
                "stringTableLength": read_u64(&artifact, 72),
                "tensorTableOffset": read_u64(&artifact, 96),
                "tensorCount": read_u32(&artifact, 104),
                "tensorRecordBytes": read_u32(&artifact, 108),
                "payloadOffset": read_u64(&artifact, 144),
                "payloadLength": read_u64(&artifact, 152)
            },
            "strings": strings,
            "tensors": tensors,
            "pieceManifest": {
                "pieceSize": tinyrustlm_slm2::PIECE_BYTES,
                "pieceCount": pieces.pieces().len(),
                "pieceLengths": pieces.pieces().iter().map(|piece| piece.byte_length()).collect::<Vec<_>>(),
                "pieceSha256": pieces.pieces().iter().map(|piece| piece.sha256_hex()).collect::<Vec<_>>(),
                "merkleRoot": pieces.merkle_root_hex()
            },
            "mutations": [
                mutation("wrong-magic", "xor-byte", Some(0), Some(1), None, "slm2-invalid-magic"),
                mutation("nonzero-header-padding", "set-byte", Some(224), Some(1), None, "slm2-nonzero-padding"),
                mutation("payload-hash-drift", "xor-byte", Some(first_payload_offset), Some(1), None, "slm2-payload-hash-drift"),
                mutation("nonfinite-f32", "replace-hex", Some(first_payload_offset), None, Some("0000c07f"), "slm2-nonfinite-f32"),
                mutation("trailing-byte", "append-hex", None, None, Some("00"), "slm2-file-size-mismatch")
            ]
        }]
    });
    let mut bytes = serde_json::to_vec_pretty(&document)?;
    bytes.push(b'\n');
    Ok(bytes)
}

fn mutation(
    id: &str,
    operation: &str,
    offset: Option<u64>,
    value: Option<u64>,
    hex: Option<&str>,
    expected_error: &str,
) -> Value {
    let mut object = serde_json::Map::new();
    object.insert("id".to_owned(), Value::String(id.to_owned()));
    object.insert("operation".to_owned(), Value::String(operation.to_owned()));
    if let Some(offset) = offset {
        object.insert("offset".to_owned(), Value::from(offset));
    }
    if let Some(value) = value {
        object.insert("value".to_owned(), Value::from(value));
    }
    if let Some(hex) = hex {
        object.insert("hex".to_owned(), Value::String(hex.to_owned()));
    }
    object.insert(
        "expectedError".to_owned(),
        Value::String(expected_error.to_owned()),
    );
    Value::Object(object)
}

fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes(
        bytes[offset..offset + 2]
            .try_into()
            .expect("fixed header field"),
    )
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(
        bytes[offset..offset + 4]
            .try_into()
            .expect("fixed header field"),
    )
}

fn read_u64(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(
        bytes[offset..offset + 8]
            .try_into()
            .expect("fixed header field"),
    )
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
    }
    output
}
