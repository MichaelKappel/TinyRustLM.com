//! Independent Node-oracle conformance tests for the scalar SLM2 runtime.

use serde::Deserialize;
use tinyrustlm_slm2_runtime::{
    select_greedy, RuntimePolicy, ScalarSession, ScalarTraceSink, ScalarTraceStage,
};

const CANONICAL_MODEL: &[u8] =
    include_bytes!("../../tinyrustlm-slm2/fuzz/corpus/raw_slm2/01-canonical-valid-vector.seed");
const RUNTIME_VECTORS: &str =
    include_str!("../../../../contracts/vnext/slm2-runtime-vectors.v1.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RuntimeVectors {
    arithmetic_profile: String,
    model_spec: ModelSpec,
    numerical_tolerance: NumericalTolerance,
    oracle: Oracle,
    schema: String,
    source_format_vector: SourceFormatVector,
    sequences: Vec<Sequence>,
    generation_cases: Vec<GenerationCase>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelSpec {
    context_length: u32,
    embedding_size: u32,
    feed_forward_size: u32,
    head_count: u32,
    head_dimension: u32,
    kv_head_count: u32,
    layer_count: u32,
    normalization_epsilon_bits: String,
    qk_normalization: bool,
    qkv_bias: bool,
    rope_theta_bits: String,
    tied_embeddings: bool,
    vocabulary_size: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NumericalTolerance {
    absolute: f32,
    relative: f32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Oracle {
    implementation: String,
    source_sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceFormatVector {
    artifact_byte_length: u64,
    artifact_sha256: String,
    format_profile_sha256: String,
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Sequence {
    id: String,
    input_tokens: Vec<u32>,
    steps: Vec<Step>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Step {
    committed_kv_bytes: u64,
    greedy_token: u32,
    logits: EncodedF32,
    position_after: u32,
    position_before: u32,
    token_id: u32,
    trace: StepTrace,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EncodedF32 {
    f32_le_sha256: String,
    values: Vec<f32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StepTrace {
    embedding: EncodedF32,
    final_normalized: EncodedF32,
    layers: Vec<LayerTrace>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayerTrace {
    attention: EncodedF32,
    attention_normalized: EncodedF32,
    feed_forward_activated: EncodedF32,
    feed_forward_normalized: EncodedF32,
    key_after_rope: EncodedF32,
    post_attention_residual: EncodedF32,
    post_feed_forward_residual: EncodedF32,
    query_after_rope: EncodedF32,
    value: EncodedF32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GenerationCase {
    final_position: u32,
    id: String,
    maximum_new_tokens: u32,
    output_tokens: Vec<u32>,
    prompt_tokens: Vec<u32>,
    required_maximum_position: u32,
    stop_tokens: Vec<u32>,
}

#[derive(Default)]
struct TraceCollector {
    events: Vec<(ScalarTraceStage, Vec<f32>)>,
}

impl ScalarTraceSink for TraceCollector {
    fn record(&mut self, stage: ScalarTraceStage, values: &[f32]) {
        self.events.push((stage, values.to_vec()));
    }
}

fn policy(maximum_sequence_tokens: u32) -> RuntimePolicy {
    RuntimePolicy::new(1 << 20, maximum_sequence_tokens, 1 << 20, 1 << 20).unwrap()
}

fn vectors() -> RuntimeVectors {
    serde_json::from_str(RUNTIME_VECTORS).unwrap()
}

fn close(actual: f32, expected: f32, tolerance: &NumericalTolerance) -> bool {
    let difference = (actual - expected).abs();
    let relative = tolerance.relative * actual.abs().max(expected.abs());
    difference <= tolerance.absolute.max(relative)
}

fn assert_vector_close(
    actual: &[f32],
    expected: &EncodedF32,
    tolerance: &NumericalTolerance,
    context: &str,
) {
    assert_eq!(actual.len(), expected.values.len(), "{context}");
    assert_eq!(expected.f32_le_sha256.len(), 64, "{context}");
    for (index, (actual, expected)) in actual.iter().zip(&expected.values).enumerate() {
        assert!(
            close(*actual, *expected, tolerance),
            "{context} value {index}: actual={actual} expected={expected}"
        );
    }
}

fn expected_trace(step: &Step) -> Vec<(ScalarTraceStage, &EncodedF32)> {
    let mut expected = vec![(ScalarTraceStage::TokenEmbedding, &step.trace.embedding)];
    for (layer, trace) in step.trace.layers.iter().enumerate() {
        let layer = u32::try_from(layer).unwrap();
        expected.extend([
            (
                ScalarTraceStage::AttentionNormalized(layer),
                &trace.attention_normalized,
            ),
            (
                ScalarTraceStage::QueryAfterRope(layer),
                &trace.query_after_rope,
            ),
            (ScalarTraceStage::KeyAfterRope(layer), &trace.key_after_rope),
            (ScalarTraceStage::Value(layer), &trace.value),
            (ScalarTraceStage::Attention(layer), &trace.attention),
            (
                ScalarTraceStage::PostAttentionResidual(layer),
                &trace.post_attention_residual,
            ),
            (
                ScalarTraceStage::FeedForwardNormalized(layer),
                &trace.feed_forward_normalized,
            ),
            (
                ScalarTraceStage::FeedForwardActivated(layer),
                &trace.feed_forward_activated,
            ),
            (
                ScalarTraceStage::PostFeedForwardResidual(layer),
                &trace.post_feed_forward_residual,
            ),
        ]);
    }
    expected.push((
        ScalarTraceStage::FinalNormalized,
        &step.trace.final_normalized,
    ));
    expected.push((ScalarTraceStage::Logits, &step.logits));
    expected
}

#[test]
fn canonical_model_metadata_is_bound_to_the_independent_contract() {
    let vectors = vectors();
    let session = ScalarSession::from_bytes(CANONICAL_MODEL.to_vec(), policy(8)).unwrap();
    let spec = session.spec();

    assert_eq!(vectors.schema, "tinyrustlm.vnext.slm2-runtime-vectors.v1");
    assert_eq!(
        vectors.arithmetic_profile,
        "explicit-ieee754-f32-rounding-after-each-scalar-operation"
    );
    assert_eq!(
        vectors.oracle.implementation,
        "tinyrustlm/tools/slm2-runtime-reference.js"
    );
    assert_eq!(vectors.oracle.source_sha256.len(), 64);
    assert_eq!(vectors.source_format_vector.artifact_byte_length, 8_448);
    assert_eq!(
        vectors.source_format_vector.artifact_sha256,
        "c010e2818c64713310699e9ad928d3b22cfeb004756ae8e03acaaee5897e613a"
    );
    assert_eq!(
        vectors.source_format_vector.format_profile_sha256,
        "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625"
    );
    assert_eq!(
        vectors.source_format_vector.id,
        "base-model-required-f32-tensor-registry"
    );
    assert_eq!(vectors.model_spec.context_length, spec.context_length);
    assert_eq!(vectors.model_spec.embedding_size, spec.embedding_size);
    assert_eq!(vectors.model_spec.feed_forward_size, spec.feed_forward_size);
    assert_eq!(vectors.model_spec.head_count, spec.head_count);
    assert_eq!(vectors.model_spec.head_dimension, spec.head_dimension);
    assert_eq!(vectors.model_spec.kv_head_count, spec.kv_head_count);
    assert_eq!(vectors.model_spec.layer_count, spec.layer_count);
    assert_eq!(
        vectors.model_spec.normalization_epsilon_bits,
        format!("{:08x}", spec.normalization_epsilon.to_bits())
    );
    assert_eq!(vectors.model_spec.qk_normalization, spec.qk_normalization);
    assert_eq!(vectors.model_spec.qkv_bias, spec.qkv_bias);
    assert_eq!(
        vectors.model_spec.rope_theta_bits,
        format!("{:08x}", spec.rope_theta.to_bits())
    );
    assert_eq!(vectors.model_spec.tied_embeddings, spec.tied_embeddings);
    assert_eq!(vectors.model_spec.vocabulary_size, spec.vocabulary_size);
}

#[test]
fn scalar_runtime_matches_independent_logits_tokens_positions_and_kv_growth() {
    let vectors = vectors();
    for sequence in &vectors.sequences {
        let maximum_tokens = u32::try_from(sequence.steps.len()).unwrap();
        let mut session =
            ScalarSession::from_bytes(CANONICAL_MODEL.to_vec(), policy(maximum_tokens)).unwrap();
        assert_eq!(sequence.input_tokens.len(), sequence.steps.len());
        for (index, step) in sequence.steps.iter().enumerate() {
            assert_eq!(
                step.token_id, sequence.input_tokens[index],
                "{}",
                sequence.id
            );
            assert_eq!(
                session.position().unwrap(),
                step.position_before,
                "{}",
                sequence.id
            );
            let mut trace = TraceCollector::default();
            let actual = session
                .forward_token_traced(step.token_id, &mut trace)
                .unwrap()
                .to_vec();
            assert_vector_close(
                &actual,
                &step.logits,
                &vectors.numerical_tolerance,
                &format!("{} step {index} logits", sequence.id),
            );
            let expected_trace = expected_trace(step);
            assert_eq!(trace.events.len(), expected_trace.len(), "{}", sequence.id);
            for (trace_index, ((actual_stage, actual), (expected_stage, expected))) in
                trace.events.iter().zip(&expected_trace).enumerate()
            {
                assert_eq!(
                    actual_stage, expected_stage,
                    "{} trace {trace_index}",
                    sequence.id
                );
                assert_vector_close(
                    actual,
                    expected,
                    &vectors.numerical_tolerance,
                    &format!("{} step {index} trace {trace_index}", sequence.id),
                );
            }
            assert_eq!(
                select_greedy(&actual).unwrap(),
                step.greedy_token,
                "{}",
                sequence.id
            );
            assert_eq!(
                session.position().unwrap(),
                step.position_after,
                "{}",
                sequence.id
            );
            assert_eq!(
                session.committed_kv_bytes().unwrap(),
                step.committed_kv_bytes,
                "{}",
                sequence.id
            );
        }
    }
}

#[test]
fn scalar_generation_matches_independent_bounded_and_stop_cases() {
    let vectors = vectors();
    for case in &vectors.generation_cases {
        let mut session = ScalarSession::from_bytes(
            CANONICAL_MODEL.to_vec(),
            policy(case.required_maximum_position),
        )
        .unwrap();
        let output = session
            .generate_greedy(
                &case.prompt_tokens,
                case.maximum_new_tokens,
                &case.stop_tokens,
            )
            .unwrap();
        assert_eq!(output, case.output_tokens, "{}", case.id);
        assert_eq!(
            session.position().unwrap(),
            case.final_position,
            "{}",
            case.id
        );
    }
}
