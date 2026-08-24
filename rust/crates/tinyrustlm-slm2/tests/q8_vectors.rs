//! Rust reproduction of the source-isolated Node mixed-Q8 contract.

use std::io::Cursor;

use serde_json::{Map, Value};
use tinyrustlm_slm2::{
    q8_row_symmetric_f32_matvec, quantize_q8_row_symmetric_f32, required_model_tensors,
    validate_model, write_model, ArtifactClass, ElementType, ModelSpec, TensorInput,
    ValidationPolicy, SLM2_FORMAT_PROFILE_SHA256, SLM2_Q8_WEIGHT_PROFILE_ID,
    SLM2_Q8_WEIGHT_PROFILE_SHA256,
};

const VECTORS: &[u8] = include_bytes!("../../../../contracts/vnext/slm2-q8-weight-vectors.v1.json");

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
        .unwrap_or_else(|| panic!("{name} must be unsigned"))
}

fn decode_hex(value: &str) -> Vec<u8> {
    assert!(value.len().is_multiple_of(2));
    assert!(value
        .bytes()
        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)));
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
        tied_embeddings: false,
        qkv_bias: true,
        qk_normalization: true,
    }
}

fn source_values(
    semantic_role: &str,
    logical_elements: usize,
    shape: &[u64],
    tensor_index: usize,
) -> Vec<f32> {
    let f32_role = semantic_role.contains("normalization") || semantic_role.ends_with(".bias");
    if f32_role {
        return (0..logical_elements)
            .map(|index| {
                let value = if semantic_role.contains("normalization") {
                    1.0_f64 + (tensor_index + 1) as f64 / 1024.0 + index as f64 / 8192.0
                } else {
                    (tensor_index + 1) as f64 * 0.01 + ((index % 7) as f64 - 3.0) * 0.0025
                };
                value as f32
            })
            .collect();
    }
    let rows = shape[0] as usize;
    let columns = shape[1] as usize;
    let mut values = Vec::with_capacity(logical_elements);
    for row in 0..rows {
        for column in 0..columns {
            let value = if semantic_role == "model.token-embedding.weight" && row == 0 {
                if column.is_multiple_of(2) {
                    0.0
                } else {
                    -0.0
                }
            } else if semantic_role == "model.token-embedding.weight" && row == 1 {
                [127.0, 0.5, -0.5, -127.0, 63.5, -63.5, 31.75, -31.75][column % 8]
            } else {
                let magnitude = (tensor_index + 1) as f64 * 0.125
                    + (row + 1) as f64 * 0.03125
                    + (column + 1) as f64 * 0.0078125;
                let signed = if (tensor_index + row + column).is_multiple_of(2) {
                    magnitude
                } else {
                    -magnitude
                };
                signed as f32
            };
            values.push(value);
        }
    }
    values
}

fn f32_bytes(values: &[f32]) -> Vec<u8> {
    values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

fn write_reference() -> Vec<u8> {
    let spec = reference_spec();
    let mut inputs = required_model_tensors(&spec, 64)
        .unwrap()
        .into_iter()
        .enumerate()
        .map(|(index, tensor)| {
            let count = tensor.shape().iter().copied().product::<u64>() as usize;
            let values = source_values(tensor.semantic_role(), count, tensor.shape(), index);
            TensorInput::new(tensor, Cursor::new(f32_bytes(&values)))
        })
        .collect::<Vec<_>>();
    inputs.reverse();
    let mut destination = Cursor::new(Vec::new());
    write_model(&mut destination, &spec, &mut inputs).unwrap();
    destination.into_inner()
}

fn document() -> Value {
    serde_json::from_slice(VECTORS).unwrap()
}

fn canonical(document: &Value) -> &Map<String, Value> {
    object(
        field(object(document, "document"), "canonical"),
        "canonical",
    )
}

fn apply_mutation(source: &[u8], entry: &Map<String, Value>) -> Vec<u8> {
    let mut bytes = source.to_vec();
    let offset = usize::try_from(unsigned(entry, "offset")).unwrap_or(bytes.len());
    let value = field(entry, "value").as_i64().unwrap();
    match text(entry, "operation") {
        "xor-byte" => bytes[offset] ^= value as u8,
        "set-u8" => bytes[offset] = value as u8,
        "set-i8" => bytes[offset] = (value as i8) as u8,
        "set-u16" => bytes[offset..offset + 2].copy_from_slice(&(value as u16).to_le_bytes()),
        "set-u32" => bytes[offset..offset + 4].copy_from_slice(&(value as u32).to_le_bytes()),
        "append-byte" => bytes.push(value as u8),
        operation => panic!("unsupported mutation {operation}"),
    }
    bytes
}

#[test]
fn rust_writer_reproduces_the_independent_artifact_exactly() {
    let document = document();
    let root = object(&document, "document");
    assert_eq!(text(root, "schema"), "tinyrustlm.slm2-q8-weight-vectors.v1");
    let format = object(field(root, "formatProfile"), "formatProfile");
    let weight = object(field(root, "weightProfile"), "weightProfile");
    assert_eq!(text(format, "sha256"), SLM2_FORMAT_PROFILE_SHA256);
    assert_eq!(text(weight, "profileId"), SLM2_Q8_WEIGHT_PROFILE_ID);
    assert_eq!(text(weight, "sha256"), SLM2_Q8_WEIGHT_PROFILE_SHA256);
    let expected = decode_hex(text(canonical(&document), "artifactHex"));
    let first = write_reference();
    let second = write_reference();
    assert_eq!(first, second);
    if first != expected {
        let offset = first
            .iter()
            .zip(&expected)
            .position(|(actual, expected)| actual != expected)
            .unwrap_or_else(|| first.len().min(expected.len()));
        let actual = first.get(offset).copied();
        let expected_byte = expected.get(offset).copied();
        panic!(
            "SLM2 bytes differ at offset {offset}: Rust={actual:?}, reference={expected_byte:?}, Rust length={}, reference length={}",
            first.len(),
            expected.len()
        );
    }
}

#[test]
fn rust_parser_reproduces_every_independent_descriptor() {
    let document = document();
    let vector = canonical(&document);
    let artifact = decode_hex(text(vector, "artifactHex"));
    let validated =
        validate_model(&mut Cursor::new(&artifact), ValidationPolicy::default()).unwrap();
    assert_eq!(validated.spec(), &reference_spec());
    assert_eq!(
        validated.identity().byte_length(),
        unsigned(vector, "artifactByteLength")
    );
    assert_eq!(
        validated.identity().artifact_sha256_hex(),
        text(vector, "artifactSha256")
    );
    assert_eq!(
        validated.identity().manifest_sha256_hex(),
        text(vector, "manifestSha256")
    );
    assert_eq!(validated.tensors().len(), 17);
    assert_eq!(
        validated
            .tensors()
            .iter()
            .filter(|tensor| tensor.element_type() == ElementType::Q8RowSymmetric)
            .count(),
        9
    );
    assert_eq!(
        validated
            .tensors()
            .iter()
            .filter(|tensor| tensor.element_type() == ElementType::F32)
            .count(),
        8
    );
    let expected = array(field(vector, "tensors"), "tensors");
    for (actual, expected) in validated.tensors().iter().zip(expected) {
        let expected = object(expected, "tensor");
        assert_eq!(actual.semantic_role(), text(expected, "semanticRole"));
        assert_eq!(actual.canonical_name(), text(expected, "canonicalName"));
        assert_eq!(actual.stored_bytes(), unsigned(expected, "storedBytes"));
        assert_eq!(actual.payload_length(), unsigned(expected, "payloadLength"));
        assert_eq!(
            actual.element_type() as u16,
            unsigned(expected, "elementType") as u16
        );
        assert_eq!(
            actual.quant_profile_index(),
            unsigned(expected, "quantProfileIndex") as u16
        );
        assert_eq!(
            actual.block_elements(),
            unsigned(expected, "blockElements") as u32
        );
        assert_eq!(
            actual.block_bytes(),
            unsigned(expected, "blockBytes") as u32
        );
    }
}

#[test]
fn rust_quantizer_and_scalar_kernel_reproduce_independent_cases() {
    let document = document();
    let vector = canonical(&document);
    for entry in array(field(vector, "rowCases"), "rowCases") {
        let entry = object(entry, "row case");
        let source = array(field(entry, "sourceF32Bits"), "source bits")
            .iter()
            .map(|value| f32::from_bits(value.as_u64().unwrap() as u32))
            .collect::<Vec<_>>();
        let (scale, codes) = quantize_q8_row_symmetric_f32(&source).unwrap();
        assert_eq!(
            scale.to_bits(),
            unsigned(entry, "scaleF32Bits") as u32,
            "{}",
            text(entry, "id")
        );
        let expected = array(field(entry, "codes"), "codes")
            .iter()
            .map(|value| value.as_i64().unwrap() as i8)
            .collect::<Vec<_>>();
        assert_eq!(codes, expected, "{}", text(entry, "id"));
    }
    for entry in array(field(vector, "matvecCases"), "matvecCases") {
        let entry = object(entry, "matvec case");
        let payload = decode_hex(text(entry, "payloadHex"));
        let input = array(field(entry, "inputF32Bits"), "input bits")
            .iter()
            .map(|value| f32::from_bits(value.as_u64().unwrap() as u32))
            .collect::<Vec<_>>();
        let actual = q8_row_symmetric_f32_matvec(
            &payload,
            unsigned(entry, "rows") as usize,
            unsigned(entry, "columns") as usize,
            &input,
        )
        .unwrap()
        .into_iter()
        .map(f32::to_bits)
        .collect::<Vec<_>>();
        let expected = array(field(entry, "outputF32Bits"), "output bits")
            .iter()
            .map(|value| value.as_u64().unwrap() as u32)
            .collect::<Vec<_>>();
        assert_eq!(actual, expected, "{}", text(entry, "id"));
    }
}

#[test]
fn rust_parser_rejects_every_prefix_and_hostile_vector() {
    let document = document();
    let vector = canonical(&document);
    let artifact = decode_hex(text(vector, "artifactHex"));
    for length in 0..artifact.len() {
        assert!(
            validate_model(
                &mut Cursor::new(&artifact[..length]),
                ValidationPolicy::default()
            )
            .is_err(),
            "prefix {length}"
        );
    }
    for entry in array(field(vector, "mutations"), "mutations") {
        let entry = object(entry, "mutation");
        let mutated = apply_mutation(&artifact, entry);
        let error =
            validate_model(&mut Cursor::new(mutated), ValidationPolicy::default()).unwrap_err();
        assert_eq!(
            error.code(),
            text(entry, "expectedError"),
            "{}",
            text(entry, "id")
        );
    }
}
