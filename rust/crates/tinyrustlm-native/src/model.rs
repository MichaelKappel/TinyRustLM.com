use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tinyrustlm_slm2::{
    validate_model, ModelSpec, ValidationPolicy, SLM2_FORMAT_PROFILE_ID,
    SLM2_FORMAT_PROFILE_SHA256, SLM2_Q8_WEIGHT_PROFILE_ID, SLM2_Q8_WEIGHT_PROFILE_SHA256,
};

use crate::files::open_regular_file;
use crate::response::{parse_json, NativeError, NativeResult};
use crate::runtime::MAXIMUM_MODEL_BYTES;

pub(crate) const MODEL_INSPECTION_SCHEMA: &str = "tinyrustlm.native.slm2_inspection/1";
pub(crate) const MAXIMUM_MODEL_REQUEST_JSON_BYTES: usize = 16_384;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct InspectRequest {
    schema: String,
    path: PathBuf,
    maximum_file_bytes: u64,
    maximum_tensors: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelReport {
    format_profile: &'static str,
    format_profile_sha256: &'static str,
    weight_profile: &'static str,
    weight_profile_sha256: &'static str,
    artifact_bytes: u64,
    artifact_sha256: String,
    manifest_sha256: String,
    tensor_layout_sha256: String,
    tensor_count: usize,
    model: ModelSpecReport,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelSpecReport {
    artifact_class: &'static str,
    vocabulary_size: u32,
    context_length: u32,
    embedding_size: u32,
    feed_forward_size: u32,
    layer_count: u32,
    head_count: u32,
    kv_head_count: u32,
    head_dimension: u32,
    rope_theta: f32,
    normalization_epsilon: f32,
    tied_embeddings: bool,
    qkv_bias: bool,
    qk_normalization: bool,
}

pub(crate) fn inspect(request_bytes: &[u8]) -> NativeResult<ModelReport> {
    let request: InspectRequest = parse_json(request_bytes)?;
    if request.schema != MODEL_INSPECTION_SCHEMA {
        return Err(NativeError::new("native-contract"));
    }
    if request.maximum_file_bytes > MAXIMUM_MODEL_BYTES {
        return Err(NativeError::new("native-model-policy"));
    }
    let policy = ValidationPolicy::new(request.maximum_file_bytes, request.maximum_tensors)
        .map_err(|error| NativeError::new(error.code()))?;
    let mut source = open_regular_file(&request.path)?;
    let validated =
        validate_model(&mut source, policy).map_err(|error| NativeError::new(error.code()))?;
    let identity = validated.identity();
    Ok(ModelReport {
        format_profile: SLM2_FORMAT_PROFILE_ID,
        format_profile_sha256: SLM2_FORMAT_PROFILE_SHA256,
        weight_profile: SLM2_Q8_WEIGHT_PROFILE_ID,
        weight_profile_sha256: SLM2_Q8_WEIGHT_PROFILE_SHA256,
        artifact_bytes: identity.byte_length(),
        artifact_sha256: identity.artifact_sha256_hex(),
        manifest_sha256: identity.manifest_sha256_hex(),
        tensor_layout_sha256: hex_lower(validated.tensor_layout_sha256()),
        tensor_count: validated.tensors().len(),
        model: ModelSpecReport::from(validated.spec()),
    })
}

impl From<&ModelSpec> for ModelSpecReport {
    fn from(spec: &ModelSpec) -> Self {
        Self {
            artifact_class: spec.artifact_class.label(),
            vocabulary_size: spec.vocabulary_size,
            context_length: spec.context_length,
            embedding_size: spec.embedding_size,
            feed_forward_size: spec.feed_forward_size,
            layer_count: spec.layer_count,
            head_count: spec.head_count,
            kv_head_count: spec.kv_head_count,
            head_dimension: spec.head_dimension,
            rope_theta: spec.rope_theta,
            normalization_epsilon: spec.normalization_epsilon,
            tied_embeddings: spec.tied_embeddings,
            qkv_bias: spec.qkv_bias,
            qk_normalization: spec.qk_normalization,
        }
    }
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
