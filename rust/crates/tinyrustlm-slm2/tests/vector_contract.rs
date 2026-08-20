//! Cross-implementation contract tests for the checked-in SLM2 seed vector.

use std::collections::BTreeSet;
use std::io::Cursor;

use serde_json::{Map, Value};
use tinyrustlm_slm2::{
    build_piece_manifest, validate_model, write_model, ArtifactClass, ModelSpec, TensorInput,
    TensorSpec, ValidationPolicy, SLM2_FORMAT_PROFILE_ID, SLM2_FORMAT_PROFILE_SHA256,
};

const VECTOR_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/slm2-format-vectors.v1.json");

fn object<'a>(value: &'a Value, label: &str) -> &'a Map<String, Value> {
    value
        .as_object()
        .unwrap_or_else(|| panic!("{label} must be an object"))
}

fn array<'a>(value: &'a Value, label: &str) -> &'a [Value] {
    value
        .as_array()
        .unwrap_or_else(|| panic!("{label} must be an array"))
}

fn field<'a>(object: &'a Map<String, Value>, name: &str) -> &'a Value {
    object
        .get(name)
        .unwrap_or_else(|| panic!("missing field {name}"))
}

fn text<'a>(object: &'a Map<String, Value>, name: &str) -> &'a str {
    field(object, name)
        .as_str()
        .unwrap_or_else(|| panic!("{name} must be text"))
}

fn unsigned(object: &Map<String, Value>, name: &str) -> u64 {
    field(object, name)
        .as_u64()
        .unwrap_or_else(|| panic!("{name} must be an unsigned integer"))
}

fn signed(object: &Map<String, Value>, name: &str) -> i64 {
    field(object, name)
        .as_i64()
        .unwrap_or_else(|| panic!("{name} must be an integer"))
}

fn assert_exact_keys(object: &Map<String, Value>, expected: &[&str], label: &str) {
    let actual: BTreeSet<&str> = object.keys().map(String::as_str).collect();
    let expected: BTreeSet<&str> = expected.iter().copied().collect();
    assert_eq!(actual, expected, "unexpected keys in {label}");
}

fn decode_hex(value: &str) -> Vec<u8> {
    assert_eq!(value.len() % 2, 0, "hex must have complete bytes");
    assert!(
        value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)),
        "hex must be lowercase canonical text"
    );
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let high = char::from(pair[0]).to_digit(16).unwrap() as u8;
            let low = char::from(pair[1]).to_digit(16).unwrap() as u8;
            (high << 4) | low
        })
        .collect()
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
        head_dimension: 4,
        rope_theta: 10_000.0,
        normalization_epsilon: 0.000_01,
        tied_embeddings: true,
    }
}

fn f32_bytes(values: &[f32]) -> Vec<u8> {
    values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

fn write_reference() -> (Vec<u8>, tinyrustlm_slm2::ModelIdentity) {
    let embedding = TensorSpec::new("embedding", "model/embed", -1, -1, -1, &[2, 2], 64).unwrap();
    let normalization =
        TensorSpec::new("normalization", "model/norm", -1, -1, -1, &[2], 256).unwrap();
    let mut tensors = vec![
        TensorInput::new(normalization, Cursor::new(f32_bytes(&[5.0, 6.0]))),
        TensorInput::new(embedding, Cursor::new(f32_bytes(&[1.0, 2.0, 3.0, 4.0]))),
    ];
    let mut output = Cursor::new(Vec::new());
    let identity = write_model(&mut output, &reference_spec(), &mut tensors).unwrap();
    (output.into_inner(), identity)
}

fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap())
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

fn read_u64(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap())
}

fn apply_mutation(source: &[u8], mutation: &Map<String, Value>) -> Vec<u8> {
    let mut bytes = source.to_vec();
    match text(mutation, "operation") {
        "xor-byte" => {
            let offset = usize::try_from(unsigned(mutation, "offset")).unwrap();
            let value = u8::try_from(unsigned(mutation, "value")).unwrap();
            bytes[offset] ^= value;
        }
        "set-byte" => {
            let offset = usize::try_from(unsigned(mutation, "offset")).unwrap();
            bytes[offset] = u8::try_from(unsigned(mutation, "value")).unwrap();
        }
        "replace-hex" => {
            let offset = usize::try_from(unsigned(mutation, "offset")).unwrap();
            let replacement = decode_hex(text(mutation, "hex"));
            bytes[offset..offset + replacement.len()].copy_from_slice(&replacement);
        }
        "append-hex" => bytes.extend_from_slice(&decode_hex(text(mutation, "hex"))),
        operation => panic!("unsupported vector mutation {operation}"),
    }
    bytes
}

fn vector_document() -> Value {
    serde_json::from_slice(VECTOR_BYTES).expect("checked-in vector JSON must parse")
}

#[test]
fn checked_in_vector_matches_public_writer_reader_and_piece_api() {
    let document = vector_document();
    let root = object(&document, "vector document");
    assert_exact_keys(
        root,
        &["schema", "profileId", "profileSha256", "vectors"],
        "vector document",
    );
    assert_eq!(
        text(root, "schema"),
        "tinyrustlm.vnext.slm2-format-vectors.v1"
    );
    assert_eq!(text(root, "profileId"), SLM2_FORMAT_PROFILE_ID);
    assert_eq!(text(root, "profileSha256"), SLM2_FORMAT_PROFILE_SHA256);

    let vectors = array(field(root, "vectors"), "vectors");
    assert_eq!(
        vectors.len(),
        1,
        "the 2.0 profile freezes exactly one seed vector"
    );
    let vector = object(&vectors[0], "vector");
    assert_exact_keys(
        vector,
        &[
            "artifactByteLength",
            "artifactHex",
            "artifactSha256",
            "header",
            "id",
            "manifestSha256",
            "mutations",
            "pieceManifest",
            "strings",
            "tensorLayoutSha256",
            "tensors",
        ],
        "vector",
    );
    assert_eq!(text(vector, "id"), "base-model-two-f32-tensors");

    let expected_bytes = decode_hex(text(vector, "artifactHex"));
    assert_eq!(
        expected_bytes.len() as u64,
        unsigned(vector, "artifactByteLength")
    );
    let (written, identity) = write_reference();
    assert_eq!(
        written, expected_bytes,
        "writer bytes drifted from the vector"
    );
    assert_eq!(
        identity.byte_length(),
        unsigned(vector, "artifactByteLength")
    );
    assert_eq!(
        identity.artifact_sha256_hex(),
        text(vector, "artifactSha256")
    );
    assert_eq!(
        identity.manifest_sha256_hex(),
        text(vector, "manifestSha256")
    );

    let header = object(field(vector, "header"), "header");
    assert_exact_keys(
        header,
        &[
            "artifactClass",
            "fileSize",
            "headerBytes",
            "manifestLength",
            "manifestOffset",
            "payloadLength",
            "payloadOffset",
            "stringTableLength",
            "stringTableOffset",
            "tensorCount",
            "tensorRecordBytes",
            "tensorTableOffset",
        ],
        "header",
    );
    assert_eq!(
        read_u32(&written, 24) as u64,
        unsigned(header, "headerBytes")
    );
    assert_eq!(
        read_u16(&written, 36) as u64,
        unsigned(header, "artifactClass")
    );
    assert_eq!(read_u64(&written, 40), unsigned(header, "fileSize"));
    assert_eq!(read_u64(&written, 48), unsigned(header, "manifestOffset"));
    assert_eq!(read_u64(&written, 56), unsigned(header, "manifestLength"));
    assert_eq!(
        read_u64(&written, 64),
        unsigned(header, "stringTableOffset")
    );
    assert_eq!(
        read_u64(&written, 72),
        unsigned(header, "stringTableLength")
    );
    assert_eq!(
        read_u64(&written, 96),
        unsigned(header, "tensorTableOffset")
    );
    assert_eq!(
        read_u32(&written, 104) as u64,
        unsigned(header, "tensorCount")
    );
    assert_eq!(
        read_u32(&written, 108) as u64,
        unsigned(header, "tensorRecordBytes")
    );
    assert_eq!(read_u64(&written, 144), unsigned(header, "payloadOffset"));
    assert_eq!(read_u64(&written, 152), unsigned(header, "payloadLength"));

    let validated =
        validate_model(&mut Cursor::new(&written), ValidationPolicy::default()).unwrap();
    assert_eq!(validated.identity(), &identity);
    assert_eq!(validated.spec(), &reference_spec());
    assert_eq!(
        hex_lower(validated.tensor_layout_sha256()),
        text(vector, "tensorLayoutSha256")
    );
    let expected_strings: Vec<&str> = array(field(vector, "strings"), "strings")
        .iter()
        .map(|value| value.as_str().expect("string-table item must be text"))
        .collect();
    assert_eq!(
        expected_strings,
        vec!["embedding", "model/embed", "model/norm", "normalization"]
    );

    let expected_tensors = array(field(vector, "tensors"), "tensors");
    assert_eq!(validated.tensors().len(), expected_tensors.len());
    for (actual, expected_value) in validated.tensors().iter().zip(expected_tensors) {
        let expected = object(expected_value, "tensor");
        assert_exact_keys(
            expected,
            &[
                "canonicalName",
                "layer",
                "logicalElements",
                "payloadAlignment",
                "payloadLength",
                "payloadRelativeOffset",
                "payloadSha256",
                "semanticRole",
                "shape",
                "subindex0",
                "subindex1",
            ],
            "tensor",
        );
        assert_eq!(actual.semantic_role(), text(expected, "semanticRole"));
        assert_eq!(actual.canonical_name(), text(expected, "canonicalName"));
        assert_eq!(i64::from(actual.layer()), signed(expected, "layer"));
        assert_eq!(
            i64::from(actual.subindex_0()),
            signed(expected, "subindex0")
        );
        assert_eq!(
            i64::from(actual.subindex_1()),
            signed(expected, "subindex1")
        );
        let shape: Vec<u64> = array(field(expected, "shape"), "shape")
            .iter()
            .map(|value| value.as_u64().expect("shape item must be unsigned"))
            .collect();
        assert_eq!(actual.shape(), shape);
        assert_eq!(
            actual.logical_elements(),
            unsigned(expected, "logicalElements")
        );
        assert_eq!(actual.payload_length(), unsigned(expected, "payloadLength"));
        assert_eq!(
            u64::from(actual.payload_alignment()),
            unsigned(expected, "payloadAlignment")
        );
        assert_eq!(
            actual.payload_offset() - unsigned(header, "payloadOffset"),
            unsigned(expected, "payloadRelativeOffset")
        );
        assert_eq!(
            hex_lower(actual.payload_sha256()),
            text(expected, "payloadSha256")
        );
    }

    let expected_pieces = object(field(vector, "pieceManifest"), "piece manifest");
    assert_exact_keys(
        expected_pieces,
        &[
            "merkleRoot",
            "pieceCount",
            "pieceLengths",
            "pieceSha256",
            "pieceSize",
        ],
        "piece manifest",
    );
    let pieces = build_piece_manifest(&mut Cursor::new(&written)).unwrap();
    assert_eq!(unsigned(expected_pieces, "pieceSize"), 4_194_304);
    assert_eq!(pieces.artifact_byte_length(), written.len() as u64);
    assert_eq!(pieces.artifact_sha256_hex(), text(vector, "artifactSha256"));
    assert_eq!(
        pieces.pieces().len() as u64,
        unsigned(expected_pieces, "pieceCount")
    );
    let lengths: Vec<u64> = array(field(expected_pieces, "pieceLengths"), "piece lengths")
        .iter()
        .map(|value| value.as_u64().expect("piece length must be unsigned"))
        .collect();
    let hashes: Vec<&str> = array(field(expected_pieces, "pieceSha256"), "piece hashes")
        .iter()
        .map(|value| value.as_str().expect("piece hash must be text"))
        .collect();
    assert_eq!(
        pieces
            .pieces()
            .iter()
            .map(|piece| piece.byte_length())
            .collect::<Vec<_>>(),
        lengths
    );
    assert_eq!(
        pieces
            .pieces()
            .iter()
            .map(|piece| piece.sha256_hex())
            .collect::<Vec<_>>(),
        hashes
    );
    assert_eq!(
        pieces.merkle_root_hex(),
        text(expected_pieces, "merkleRoot")
    );
}

#[test]
fn every_declared_hostile_mutation_is_rejected_with_the_frozen_error() {
    let document = vector_document();
    let root = object(&document, "vector document");
    let vectors = array(field(root, "vectors"), "vectors");
    let vector = object(&vectors[0], "vector");
    let source = decode_hex(text(vector, "artifactHex"));
    let mutations = array(field(vector, "mutations"), "mutations");
    assert_eq!(mutations.len(), 5);
    for mutation_value in mutations {
        let mutation = object(mutation_value, "mutation");
        let expected_keys: &[&str] = match text(mutation, "operation") {
            "xor-byte" | "set-byte" => &["expectedError", "id", "offset", "operation", "value"],
            "replace-hex" => &["expectedError", "hex", "id", "offset", "operation"],
            "append-hex" => &["expectedError", "hex", "id", "operation"],
            operation => panic!("unsupported vector mutation {operation}"),
        };
        assert_exact_keys(mutation, expected_keys, "mutation");
        let hostile = apply_mutation(&source, mutation);
        let error =
            validate_model(&mut Cursor::new(hostile), ValidationPolicy::default()).unwrap_err();
        assert_eq!(
            error.code(),
            text(mutation, "expectedError"),
            "unexpected verdict for mutation {}",
            text(mutation, "id")
        );
    }
}

#[test]
fn every_proper_prefix_and_tighter_resource_policy_fails_closed() {
    let document = vector_document();
    let root = object(&document, "vector document");
    let vectors = array(field(root, "vectors"), "vectors");
    let vector = object(&vectors[0], "vector");
    let source = decode_hex(text(vector, "artifactHex"));

    for length in 0..source.len() {
        let error = validate_model(
            &mut Cursor::new(&source[..length]),
            ValidationPolicy::default(),
        )
        .expect_err("every proper artifact prefix must reject");
        assert_ne!(
            error.code(),
            "",
            "prefix {length} returned an empty error code"
        );
    }
    validate_model(&mut Cursor::new(&source), ValidationPolicy::default())
        .expect("the complete vector must still admit");

    let file_limited = ValidationPolicy::new(source.len() as u64 - 1, 2).unwrap();
    assert_eq!(
        validate_model(&mut Cursor::new(&source), file_limited)
            .unwrap_err()
            .code(),
        "slm2-file-size-limit"
    );
    let tensor_limited = ValidationPolicy::new(source.len() as u64, 1).unwrap();
    assert_eq!(
        validate_model(&mut Cursor::new(&source), tensor_limited)
            .unwrap_err()
            .code(),
        "slm2-invalid-section"
    );
    assert!(ValidationPolicy::new(223, 1).is_err());
    assert!(ValidationPolicy::new(source.len() as u64, 0).is_err());
}
