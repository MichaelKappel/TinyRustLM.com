#![forbid(unsafe_code)]
#![doc = "Scalar correctness-reference inference for canonical SLM2 models."]

use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::Cursor;

use tinyrustlm_slm2::{validate_model, ElementType, ModelSpec, ValidatedModel, ValidationPolicy};

const F32_BYTES: u64 = 4;
const MAXIMUM_TENSORS: u32 = 262_144;

/// A stable, bounded scalar-runtime failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ScalarRuntimeError {
    code: &'static str,
}

impl ScalarRuntimeError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for ScalarRuntimeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for ScalarRuntimeError {}

impl From<tinyrustlm_slm2::Slm2Error> for ScalarRuntimeError {
    fn from(value: tinyrustlm_slm2::Slm2Error) -> Self {
        Self::new(value.code())
    }
}

/// Exact resource ceilings for one scalar session.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimePolicy {
    maximum_model_bytes: u64,
    maximum_sequence_tokens: u32,
    maximum_kv_bytes: u64,
    maximum_scratch_bytes: u64,
}

impl RuntimePolicy {
    /// Creates a bounded policy. Every limit is mandatory and nonzero.
    pub fn new(
        maximum_model_bytes: u64,
        maximum_sequence_tokens: u32,
        maximum_kv_bytes: u64,
        maximum_scratch_bytes: u64,
    ) -> Result<Self, ScalarRuntimeError> {
        if maximum_model_bytes < 224
            || maximum_sequence_tokens == 0
            || maximum_kv_bytes == 0
            || maximum_scratch_bytes == 0
        {
            return Err(ScalarRuntimeError::new("slm2-runtime-invalid-policy"));
        }
        Ok(Self {
            maximum_model_bytes,
            maximum_sequence_tokens,
            maximum_kv_bytes,
            maximum_scratch_bytes,
        })
    }

    /// Returns the maximum admitted complete model size.
    pub const fn maximum_model_bytes(self) -> u64 {
        self.maximum_model_bytes
    }

    /// Returns the maximum active sequence length.
    pub const fn maximum_sequence_tokens(self) -> u32 {
        self.maximum_sequence_tokens
    }

    /// Returns the maximum reserved KV-cache bytes.
    pub const fn maximum_kv_bytes(self) -> u64 {
        self.maximum_kv_bytes
    }

    /// Returns the maximum reserved scratch bytes.
    pub const fn maximum_scratch_bytes(self) -> u64 {
        self.maximum_scratch_bytes
    }
}

/// Checked memory requirements for one loaded scalar session.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MemoryPlan {
    /// Exact SLM2 artifact bytes retained by the session.
    pub model_bytes: u64,
    /// Reserved grow-only KV-cache bytes.
    pub kv_bytes: u64,
    /// Persistent scalar scratch bytes, excluding allocator metadata.
    pub scratch_bytes: u64,
}

/// One ordered scalar boundary exposed to an opt-in conformance trace sink.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ScalarTraceStage {
    /// Token-embedding row before the first decoder layer.
    TokenEmbedding,
    /// Attention RMS normalization output for the zero-based layer.
    AttentionNormalized(u32),
    /// Query projection after optional normalization and RoPE.
    QueryAfterRope(u32),
    /// Key projection after optional normalization and RoPE.
    KeyAfterRope(u32),
    /// Value projection before insertion into the KV cache.
    Value(u32),
    /// Grouped-query attention output before its output projection.
    Attention(u32),
    /// Hidden state after the attention residual addition.
    PostAttentionResidual(u32),
    /// Feed-forward RMS normalization output.
    FeedForwardNormalized(u32),
    /// Elementwise SiLU-gated feed-forward activation.
    FeedForwardActivated(u32),
    /// Hidden state after the feed-forward residual addition.
    PostFeedForwardResidual(u32),
    /// Final RMS normalization output.
    FinalNormalized,
    /// Vocabulary logits for the next-token decision.
    Logits,
}

/// Receives borrowed scalar intermediates during an explicitly traced token.
///
/// The runtime never retains the sink or allocates trace storage. Implementors
/// decide whether and where diagnostic values are copied.
pub trait ScalarTraceSink {
    /// Observes one complete finite stage in execution order.
    fn record(&mut self, stage: ScalarTraceStage, values: &[f32]);
}

#[derive(Clone, Debug)]
struct LayerTensors {
    attention_norm: usize,
    feed_forward_norm: usize,
    query_weight: usize,
    key_weight: usize,
    value_weight: usize,
    output_weight: usize,
    gate_weight: usize,
    down_weight: usize,
    up_weight: usize,
    query_bias: Option<usize>,
    key_bias: Option<usize>,
    value_bias: Option<usize>,
    query_norm: Option<usize>,
    key_norm: Option<usize>,
}

/// One fully validated, still-inactive SLM2 model held without an F32 shadow copy.
#[derive(Clone, Debug)]
pub struct ScalarModel {
    bytes: Vec<u8>,
    validated: ValidatedModel,
    token_embedding: usize,
    final_norm: usize,
    output_projection: Option<usize>,
    layers: Vec<LayerTensors>,
}

impl ScalarModel {
    /// Validates and indexes one exact canonical SLM2 artifact.
    pub fn from_bytes(bytes: Vec<u8>, policy: RuntimePolicy) -> Result<Self, ScalarRuntimeError> {
        let model_bytes = u64::try_from(bytes.len())
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-model-size"))?;
        if model_bytes > policy.maximum_model_bytes {
            return Err(ScalarRuntimeError::new("slm2-runtime-model-size"));
        }
        let validation_policy = ValidationPolicy::new(policy.maximum_model_bytes, MAXIMUM_TENSORS)?;
        let mut cursor = Cursor::new(bytes.as_slice());
        let validated = validate_model(&mut cursor, validation_policy)?;
        validate_runtime_spec(validated.spec(), policy)?;

        let token_embedding = find_tensor(&validated, "model.token-embedding.weight", -1)?;
        let final_norm = find_tensor(&validated, "model.final-normalization.weight", -1)?;
        let output_projection = if validated.spec().tied_embeddings {
            None
        } else {
            Some(find_tensor(
                &validated,
                "model.output-projection.weight",
                -1,
            )?)
        };
        let mut layers = Vec::new();
        let layer_count = checked_usize(validated.spec().layer_count)?;
        layers
            .try_reserve_exact(layer_count)
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-allocation"))?;
        for layer in 0..validated.spec().layer_count {
            let layer = i32::try_from(layer)
                .map_err(|_| ScalarRuntimeError::new("slm2-runtime-model-metadata"))?;
            layers.push(index_layer(&validated, layer)?);
        }
        Ok(Self {
            bytes,
            validated,
            token_embedding,
            final_norm,
            output_projection,
            layers,
        })
    }

    /// Returns the closed model metadata.
    pub const fn spec(&self) -> &ModelSpec {
        self.validated.spec()
    }

    /// Returns the exact artifact byte identity.
    pub fn artifact_sha256_hex(&self) -> String {
        self.validated.identity().artifact_sha256_hex()
    }

    fn tensor(&self, index: usize) -> Result<TensorView<'_>, ScalarRuntimeError> {
        let descriptor = self
            .validated
            .tensors()
            .get(index)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-index"))?;
        let offset = checked_usize_u64(descriptor.payload_offset())?;
        let length = checked_usize_u64(descriptor.payload_length())?;
        let end = offset
            .checked_add(length)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
        let bytes = self
            .bytes
            .get(offset..end)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
        Ok(TensorView {
            bytes,
            element_type: descriptor.element_type(),
            shape: descriptor.shape(),
        })
    }
}

fn validate_runtime_spec(
    spec: &ModelSpec,
    policy: RuntimePolicy,
) -> Result<(), ScalarRuntimeError> {
    if spec.context_length < policy.maximum_sequence_tokens
        || !spec.head_dimension.is_multiple_of(2)
    {
        return Err(ScalarRuntimeError::new(
            "slm2-runtime-unsupported-model-metadata",
        ));
    }
    Ok(())
}

fn find_tensor(
    model: &ValidatedModel,
    semantic_role: &str,
    layer: i32,
) -> Result<usize, ScalarRuntimeError> {
    let mut matches =
        model.tensors().iter().enumerate().filter(|(_, tensor)| {
            tensor.semantic_role() == semantic_role && tensor.layer() == layer
        });
    let (index, _) = matches
        .next()
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-missing-tensor"))?;
    if matches.next().is_some() {
        return Err(ScalarRuntimeError::new("slm2-runtime-duplicate-tensor"));
    }
    Ok(index)
}

fn optional_tensor(
    model: &ValidatedModel,
    semantic_role: &str,
    layer: i32,
    required: bool,
) -> Result<Option<usize>, ScalarRuntimeError> {
    if required {
        Ok(Some(find_tensor(model, semantic_role, layer)?))
    } else {
        Ok(None)
    }
}

fn index_layer(model: &ValidatedModel, layer: i32) -> Result<LayerTensors, ScalarRuntimeError> {
    let spec = model.spec();
    Ok(LayerTensors {
        attention_norm: find_tensor(model, "layer.attention-normalization.weight", layer)?,
        feed_forward_norm: find_tensor(model, "layer.feed-forward-normalization.weight", layer)?,
        query_weight: find_tensor(model, "layer.attention.query-projection.weight", layer)?,
        key_weight: find_tensor(model, "layer.attention.key-projection.weight", layer)?,
        value_weight: find_tensor(model, "layer.attention.value-projection.weight", layer)?,
        output_weight: find_tensor(model, "layer.attention.output-projection.weight", layer)?,
        gate_weight: find_tensor(model, "layer.feed-forward.gate-projection.weight", layer)?,
        down_weight: find_tensor(model, "layer.feed-forward.down-projection.weight", layer)?,
        up_weight: find_tensor(model, "layer.feed-forward.up-projection.weight", layer)?,
        query_bias: optional_tensor(
            model,
            "layer.attention.query-projection.bias",
            layer,
            spec.qkv_bias,
        )?,
        key_bias: optional_tensor(
            model,
            "layer.attention.key-projection.bias",
            layer,
            spec.qkv_bias,
        )?,
        value_bias: optional_tensor(
            model,
            "layer.attention.value-projection.bias",
            layer,
            spec.qkv_bias,
        )?,
        query_norm: optional_tensor(
            model,
            "layer.attention.query-normalization.weight",
            layer,
            spec.qk_normalization,
        )?,
        key_norm: optional_tensor(
            model,
            "layer.attention.key-normalization.weight",
            layer,
            spec.qk_normalization,
        )?,
    })
}

#[derive(Clone, Copy)]
struct TensorView<'a> {
    bytes: &'a [u8],
    element_type: ElementType,
    shape: &'a [u64],
}

impl TensorView<'_> {
    fn element(&self, index: usize) -> Result<f32, ScalarRuntimeError> {
        match self.element_type {
            ElementType::F32 => self.f32_element(index),
            ElementType::Q8RowSymmetric => self.q8_element(index),
        }
    }

    fn f32_element(&self, index: usize) -> Result<f32, ScalarRuntimeError> {
        let start = index
            .checked_mul(4)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
        read_f32(self.bytes, start)
    }

    fn q8_element(&self, index: usize) -> Result<f32, ScalarRuntimeError> {
        if self.shape.len() != 2 {
            return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
        }
        let columns = checked_usize_u64(self.shape[1])?;
        if columns == 0 {
            return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
        }
        let row = index / columns;
        let column = index % columns;
        if row >= checked_usize_u64(self.shape[0])? {
            return Err(ScalarRuntimeError::new("slm2-runtime-tensor-bounds"));
        }
        let row_bytes = columns
            .checked_add(4)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
        let row_start = row
            .checked_mul(row_bytes)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
        let scale = read_f32(self.bytes, row_start)?;
        let code = *self
            .bytes
            .get(row_start + 4 + column)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?
            as i8;
        if !scale.is_finite() || scale <= 0.0 || code == i8::MIN {
            return Err(ScalarRuntimeError::new("slm2-runtime-q8-payload"));
        }
        let dequantized = scale * f32::from(code);
        if !dequantized.is_finite() {
            return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
        }
        Ok(dequantized)
    }
}

fn read_f32(bytes: &[u8], start: usize) -> Result<f32, ScalarRuntimeError> {
    let end = start
        .checked_add(4)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
    let raw: [u8; 4] = bytes
        .get(start..end)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?
        .try_into()
        .map_err(|_| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
    let value = f32::from_le_bytes(raw);
    if !value.is_finite() {
        return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
    }
    Ok(value)
}

#[derive(Clone, Debug)]
struct LayerCache {
    keys: Vec<f32>,
    values: Vec<f32>,
}

impl LayerCache {
    fn new(capacity: usize) -> Result<Self, ScalarRuntimeError> {
        let mut keys = Vec::new();
        keys.try_reserve_exact(capacity)
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-allocation"))?;
        let mut values = Vec::new();
        values
            .try_reserve_exact(capacity)
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-allocation"))?;
        Ok(Self { keys, values })
    }

    fn truncate(&mut self, elements: usize) {
        self.keys.truncate(elements);
        self.values.truncate(elements);
    }
}

#[derive(Clone, Debug)]
struct Scratch {
    hidden: Vec<f32>,
    normalized: Vec<f32>,
    query: Vec<f32>,
    key: Vec<f32>,
    value: Vec<f32>,
    attention: Vec<f32>,
    projected: Vec<f32>,
    gate: Vec<f32>,
    up: Vec<f32>,
    final_normalized: Vec<f32>,
    logits: Vec<f32>,
    scores: Vec<f32>,
}

impl Scratch {
    fn new(spec: &ModelSpec, maximum_tokens: u32) -> Result<Self, ScalarRuntimeError> {
        let embedding = checked_usize(spec.embedding_size)?;
        let query = checked_product_usize(spec.head_count, spec.head_dimension)?;
        let kv = checked_product_usize(spec.kv_head_count, spec.head_dimension)?;
        let feed_forward = checked_usize(spec.feed_forward_size)?;
        let vocabulary = checked_usize(spec.vocabulary_size)?;
        let scores = checked_usize(maximum_tokens)?;
        Ok(Self {
            hidden: zeroed_f32(embedding)?,
            normalized: zeroed_f32(embedding)?,
            query: zeroed_f32(query)?,
            key: zeroed_f32(kv)?,
            value: zeroed_f32(kv)?,
            attention: zeroed_f32(query)?,
            projected: zeroed_f32(embedding)?,
            gate: zeroed_f32(feed_forward)?,
            up: zeroed_f32(feed_forward)?,
            final_normalized: zeroed_f32(embedding)?,
            logits: zeroed_f32(vocabulary)?,
            scores: zeroed_f32(scores)?,
        })
    }
}

/// Stateful scalar execution over one exact SLM2 model.
#[derive(Clone, Debug)]
pub struct ScalarSession {
    model: ScalarModel,
    policy: RuntimePolicy,
    memory_plan: MemoryPlan,
    caches: Vec<LayerCache>,
    scratch: Scratch,
}

impl ScalarSession {
    /// Activates one validated model after exact memory preflight.
    pub fn new(model: ScalarModel, policy: RuntimePolicy) -> Result<Self, ScalarRuntimeError> {
        let memory_plan = memory_plan(&model, policy)?;
        let spec = model.spec();
        let kv_width = checked_product_usize(spec.kv_head_count, spec.head_dimension)?;
        let cache_capacity = checked_usize(policy.maximum_sequence_tokens)?
            .checked_mul(kv_width)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
        let mut caches = Vec::new();
        let layer_count = checked_usize(spec.layer_count)?;
        caches
            .try_reserve_exact(layer_count)
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-allocation"))?;
        for _ in 0..layer_count {
            caches.push(LayerCache::new(cache_capacity)?);
        }
        let scratch = Scratch::new(spec, policy.maximum_sequence_tokens)?;
        Ok(Self {
            model,
            policy,
            memory_plan,
            caches,
            scratch,
        })
    }

    /// Validates, preflights, and activates one owned SLM2 byte vector.
    pub fn from_bytes(bytes: Vec<u8>, policy: RuntimePolicy) -> Result<Self, ScalarRuntimeError> {
        let model = ScalarModel::from_bytes(bytes, policy)?;
        Self::new(model, policy)
    }

    /// Returns the checked memory plan used at activation.
    pub const fn memory_plan(&self) -> MemoryPlan {
        self.memory_plan
    }

    /// Returns the closed model metadata.
    pub const fn spec(&self) -> &ModelSpec {
        self.model.spec()
    }

    /// Returns the number of tokens currently committed to every layer cache.
    pub fn position(&self) -> Result<u32, ScalarRuntimeError> {
        let kv_width = checked_product_usize(
            self.model.spec().kv_head_count,
            self.model.spec().head_dimension,
        )?;
        let first = self
            .caches
            .first()
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-cache-state"))?;
        if first.keys.len() != first.values.len() || !first.keys.len().is_multiple_of(kv_width) {
            return Err(ScalarRuntimeError::new("slm2-runtime-cache-state"));
        }
        let position = first.keys.len() / kv_width;
        if self.caches.iter().any(|cache| {
            cache.keys.len() != first.keys.len() || cache.values.len() != first.values.len()
        }) {
            return Err(ScalarRuntimeError::new("slm2-runtime-cache-state"));
        }
        u32::try_from(position).map_err(|_| ScalarRuntimeError::new("slm2-runtime-cache-state"))
    }

    /// Returns the currently committed KV payload bytes.
    pub fn committed_kv_bytes(&self) -> Result<u64, ScalarRuntimeError> {
        let elements = self.caches.iter().try_fold(0_u64, |total, cache| {
            let keys = u64::try_from(cache.keys.len())
                .map_err(|_| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
            let values = u64::try_from(cache.values.len())
                .map_err(|_| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
            let layer = keys
                .checked_add(values)
                .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
            total
                .checked_add(layer)
                .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))
        })?;
        elements
            .checked_mul(F32_BYTES)
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))
    }

    /// Clears all committed sequence state without unloading the model.
    pub fn reset(&mut self) {
        for cache in &mut self.caches {
            cache.keys.clear();
            cache.values.clear();
        }
        self.scratch.logits.fill(0.0);
    }

    /// Executes one token and returns the resulting next-token logits.
    ///
    /// Cache growth is transactional. Any failure restores every layer to the
    /// exact position observed before the call.
    pub fn forward_token(&mut self, token_id: u32) -> Result<&[f32], ScalarRuntimeError> {
        let mut trace = None;
        self.forward_token_internal(token_id, &mut trace)
    }

    /// Executes one token while reporting ordered scalar intermediates.
    ///
    /// This path has the same cache transaction and logits as [`Self::forward_token`].
    pub fn forward_token_traced(
        &mut self,
        token_id: u32,
        sink: &mut dyn ScalarTraceSink,
    ) -> Result<&[f32], ScalarRuntimeError> {
        let mut trace = Some(sink);
        self.forward_token_internal(token_id, &mut trace)
    }

    fn forward_token_internal(
        &mut self,
        token_id: u32,
        trace: &mut Option<&mut dyn ScalarTraceSink>,
    ) -> Result<&[f32], ScalarRuntimeError> {
        let position = self.position()?;
        if position >= self.policy.maximum_sequence_tokens {
            return Err(ScalarRuntimeError::new("slm2-runtime-sequence-limit"));
        }
        if token_id >= self.model.spec().vocabulary_size {
            return Err(ScalarRuntimeError::new("slm2-runtime-token-range"));
        }
        let result = forward_token_inner(
            &self.model,
            &mut self.caches,
            &mut self.scratch,
            token_id,
            position,
            trace,
        );
        if let Err(error) = result {
            rollback_caches(&mut self.caches, self.model.spec(), position)?;
            return Err(error);
        }
        Ok(&self.scratch.logits)
    }

    /// Resets, prefills, and greedily generates one bounded token sequence.
    pub fn generate_greedy(
        &mut self,
        prompt_tokens: &[u32],
        maximum_new_tokens: u32,
        stop_tokens: &[u32],
    ) -> Result<Vec<u32>, ScalarRuntimeError> {
        if prompt_tokens.is_empty() || maximum_new_tokens == 0 {
            return Err(ScalarRuntimeError::new("slm2-runtime-invalid-generation"));
        }
        let required = u32::try_from(prompt_tokens.len())
            .ok()
            .and_then(|length| length.checked_add(maximum_new_tokens))
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-sequence-limit"))?;
        if required > self.policy.maximum_sequence_tokens {
            return Err(ScalarRuntimeError::new("slm2-runtime-sequence-limit"));
        }
        if prompt_tokens
            .iter()
            .chain(stop_tokens)
            .any(|token| *token >= self.model.spec().vocabulary_size)
        {
            return Err(ScalarRuntimeError::new("slm2-runtime-token-range"));
        }

        self.reset();
        for token in prompt_tokens {
            if let Err(error) = self.forward_token(*token) {
                self.reset();
                return Err(error);
            }
        }
        let mut output = Vec::new();
        output
            .try_reserve_exact(checked_usize(maximum_new_tokens)?)
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-allocation"))?;
        for index in 0..maximum_new_tokens {
            let token = select_greedy(&self.scratch.logits)?;
            output.push(token);
            let should_stop = stop_tokens.contains(&token) || index + 1 == maximum_new_tokens;
            if let Err(error) = self.forward_token(token) {
                self.reset();
                return Err(error);
            }
            if should_stop {
                break;
            }
        }
        Ok(output)
    }
}

/// Selects the lowest token ID among equal maximum finite logits.
pub fn select_greedy(logits: &[f32]) -> Result<u32, ScalarRuntimeError> {
    let (&first, rest) = logits
        .split_first()
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-empty-logits"))?;
    if !first.is_finite() {
        return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
    }
    let mut best_index = 0_usize;
    let mut best = first;
    for (offset, value) in rest.iter().enumerate() {
        if !value.is_finite() {
            return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
        }
        if *value > best {
            best = *value;
            best_index = offset + 1;
        }
    }
    u32::try_from(best_index).map_err(|_| ScalarRuntimeError::new("slm2-runtime-token-range"))
}

fn memory_plan(
    model: &ScalarModel,
    policy: RuntimePolicy,
) -> Result<MemoryPlan, ScalarRuntimeError> {
    let spec = model.spec();
    let query_width = checked_product_u64(spec.head_count, spec.head_dimension)?;
    let kv_width = checked_product_u64(spec.kv_head_count, spec.head_dimension)?;
    let kv_elements = u64::from(spec.layer_count)
        .checked_mul(u64::from(policy.maximum_sequence_tokens))
        .and_then(|value| value.checked_mul(kv_width))
        .and_then(|value| value.checked_mul(2))
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
    let kv_bytes = kv_elements
        .checked_mul(F32_BYTES)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;

    let scratch_elements = u64::from(spec.embedding_size)
        .checked_mul(4)
        .and_then(|value| value.checked_add(query_width.checked_mul(2)?))
        .and_then(|value| value.checked_add(kv_width.checked_mul(2)?))
        .and_then(|value| value.checked_add(u64::from(spec.feed_forward_size).checked_mul(2)?))
        .and_then(|value| value.checked_add(u64::from(spec.vocabulary_size)))
        .and_then(|value| value.checked_add(u64::from(policy.maximum_sequence_tokens)))
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
    let scratch_bytes = scratch_elements
        .checked_mul(F32_BYTES)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
    if kv_bytes > policy.maximum_kv_bytes {
        return Err(ScalarRuntimeError::new("slm2-runtime-kv-budget"));
    }
    if scratch_bytes > policy.maximum_scratch_bytes {
        return Err(ScalarRuntimeError::new("slm2-runtime-scratch-budget"));
    }
    Ok(MemoryPlan {
        model_bytes: model.validated.identity().byte_length(),
        kv_bytes,
        scratch_bytes,
    })
}

fn forward_token_inner(
    model: &ScalarModel,
    caches: &mut [LayerCache],
    scratch: &mut Scratch,
    token_id: u32,
    position: u32,
    trace: &mut Option<&mut dyn ScalarTraceSink>,
) -> Result<(), ScalarRuntimeError> {
    embedding_row(
        model.tensor(model.token_embedding)?,
        token_id,
        &mut scratch.hidden,
    )?;
    record_trace(trace, ScalarTraceStage::TokenEmbedding, &scratch.hidden);
    for (layer_index, layer) in model.layers.iter().enumerate() {
        let layer_number = u32::try_from(layer_index)
            .map_err(|_| ScalarRuntimeError::new("slm2-runtime-model-metadata"))?;
        forward_layer(
            model,
            layer,
            caches
                .get_mut(layer_index)
                .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-cache-state"))?,
            scratch,
            position,
            layer_number,
            trace,
        )?;
    }
    rms_norm(
        &scratch.hidden,
        model.tensor(model.final_norm)?,
        model.spec().normalization_epsilon,
        &mut scratch.final_normalized,
    )?;
    record_trace(
        trace,
        ScalarTraceStage::FinalNormalized,
        &scratch.final_normalized,
    );
    let output_tensor = model.output_projection.unwrap_or(model.token_embedding);
    matrix_vector(
        model.tensor(output_tensor)?,
        &scratch.final_normalized,
        &mut scratch.logits,
    )?;
    finite_slice(&scratch.logits)?;
    record_trace(trace, ScalarTraceStage::Logits, &scratch.logits);
    Ok(())
}

fn forward_layer(
    model: &ScalarModel,
    layer: &LayerTensors,
    cache: &mut LayerCache,
    scratch: &mut Scratch,
    position: u32,
    layer_number: u32,
    trace: &mut Option<&mut dyn ScalarTraceSink>,
) -> Result<(), ScalarRuntimeError> {
    let spec = model.spec();
    rms_norm(
        &scratch.hidden,
        model.tensor(layer.attention_norm)?,
        spec.normalization_epsilon,
        &mut scratch.normalized,
    )?;
    record_trace(
        trace,
        ScalarTraceStage::AttentionNormalized(layer_number),
        &scratch.normalized,
    );
    matrix_vector(
        model.tensor(layer.query_weight)?,
        &scratch.normalized,
        &mut scratch.query,
    )?;
    matrix_vector(
        model.tensor(layer.key_weight)?,
        &scratch.normalized,
        &mut scratch.key,
    )?;
    matrix_vector(
        model.tensor(layer.value_weight)?,
        &scratch.normalized,
        &mut scratch.value,
    )?;
    if let Some(index) = layer.query_bias {
        add_vector(&mut scratch.query, model.tensor(index)?)?;
    }
    if let Some(index) = layer.key_bias {
        add_vector(&mut scratch.key, model.tensor(index)?)?;
    }
    if let Some(index) = layer.value_bias {
        add_vector(&mut scratch.value, model.tensor(index)?)?;
    }
    if let Some(index) = layer.query_norm {
        normalize_heads(
            &mut scratch.query,
            model.tensor(index)?,
            spec.head_count,
            spec.head_dimension,
            spec.normalization_epsilon,
        )?;
    }
    if let Some(index) = layer.key_norm {
        normalize_heads(
            &mut scratch.key,
            model.tensor(index)?,
            spec.kv_head_count,
            spec.head_dimension,
            spec.normalization_epsilon,
        )?;
    }
    apply_rope(
        &mut scratch.query,
        spec.head_count,
        spec.head_dimension,
        position,
        spec.rope_theta,
    )?;
    apply_rope(
        &mut scratch.key,
        spec.kv_head_count,
        spec.head_dimension,
        position,
        spec.rope_theta,
    )?;
    record_trace(
        trace,
        ScalarTraceStage::QueryAfterRope(layer_number),
        &scratch.query,
    );
    record_trace(
        trace,
        ScalarTraceStage::KeyAfterRope(layer_number),
        &scratch.key,
    );
    record_trace(trace, ScalarTraceStage::Value(layer_number), &scratch.value);

    cache.keys.extend_from_slice(&scratch.key);
    cache.values.extend_from_slice(&scratch.value);
    grouped_query_attention(
        &scratch.query,
        cache,
        spec.head_count,
        spec.kv_head_count,
        spec.head_dimension,
        position,
        &mut scratch.scores,
        &mut scratch.attention,
    )?;
    record_trace(
        trace,
        ScalarTraceStage::Attention(layer_number),
        &scratch.attention,
    );
    matrix_vector(
        model.tensor(layer.output_weight)?,
        &scratch.attention,
        &mut scratch.projected,
    )?;
    residual_add(&mut scratch.hidden, &scratch.projected)?;
    record_trace(
        trace,
        ScalarTraceStage::PostAttentionResidual(layer_number),
        &scratch.hidden,
    );

    rms_norm(
        &scratch.hidden,
        model.tensor(layer.feed_forward_norm)?,
        spec.normalization_epsilon,
        &mut scratch.normalized,
    )?;
    record_trace(
        trace,
        ScalarTraceStage::FeedForwardNormalized(layer_number),
        &scratch.normalized,
    );
    matrix_vector(
        model.tensor(layer.gate_weight)?,
        &scratch.normalized,
        &mut scratch.gate,
    )?;
    matrix_vector(
        model.tensor(layer.up_weight)?,
        &scratch.normalized,
        &mut scratch.up,
    )?;
    for (gate, up) in scratch.gate.iter_mut().zip(&scratch.up) {
        *gate = silu(*gate) * *up;
    }
    finite_slice(&scratch.gate)?;
    record_trace(
        trace,
        ScalarTraceStage::FeedForwardActivated(layer_number),
        &scratch.gate,
    );
    matrix_vector(
        model.tensor(layer.down_weight)?,
        &scratch.gate,
        &mut scratch.projected,
    )?;
    residual_add(&mut scratch.hidden, &scratch.projected)?;
    record_trace(
        trace,
        ScalarTraceStage::PostFeedForwardResidual(layer_number),
        &scratch.hidden,
    );
    Ok(())
}

fn record_trace(
    trace: &mut Option<&mut dyn ScalarTraceSink>,
    stage: ScalarTraceStage,
    values: &[f32],
) {
    if let Some(sink) = trace.as_deref_mut() {
        sink.record(stage, values);
    }
}

fn rollback_caches(
    caches: &mut [LayerCache],
    spec: &ModelSpec,
    position: u32,
) -> Result<(), ScalarRuntimeError> {
    let kv_width = checked_product_usize(spec.kv_head_count, spec.head_dimension)?;
    let elements = checked_usize(position)?
        .checked_mul(kv_width)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
    for cache in caches {
        cache.truncate(elements);
    }
    Ok(())
}

fn embedding_row(
    tensor: TensorView<'_>,
    token_id: u32,
    output: &mut [f32],
) -> Result<(), ScalarRuntimeError> {
    if tensor.element_type != ElementType::Q8RowSymmetric
        || tensor.shape.len() != 2
        || tensor.shape[1] != output.len() as u64
    {
        return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
    }
    let token = checked_usize(token_id)?;
    if token >= checked_usize_u64(tensor.shape[0])? {
        return Err(ScalarRuntimeError::new("slm2-runtime-token-range"));
    }
    let start = token
        .checked_mul(output.len())
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
    for (offset, value) in output.iter_mut().enumerate() {
        *value = tensor.element(start + offset)?;
    }
    finite_slice(output)
}

fn matrix_vector(
    tensor: TensorView<'_>,
    input: &[f32],
    output: &mut [f32],
) -> Result<(), ScalarRuntimeError> {
    if tensor.element_type != ElementType::Q8RowSymmetric
        || tensor.shape.len() != 2
        || tensor.shape[0] != output.len() as u64
        || tensor.shape[1] != input.len() as u64
    {
        return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
    }
    for (row, result) in output.iter_mut().enumerate() {
        let row_start = row
            .checked_mul(input.len())
            .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-bounds"))?;
        let mut sum = 0.0_f32;
        for (column, input_value) in input.iter().enumerate() {
            let weight = tensor.element(row_start + column)?;
            let term = *input_value * weight;
            sum += term;
        }
        if !sum.is_finite() {
            return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
        }
        *result = sum;
    }
    Ok(())
}

fn rms_norm(
    input: &[f32],
    weight: TensorView<'_>,
    epsilon: f32,
    output: &mut [f32],
) -> Result<(), ScalarRuntimeError> {
    if weight.element_type != ElementType::F32
        || input.len() != output.len()
        || weight.shape != [input.len() as u64]
        || input.is_empty()
    {
        return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
    }
    let mut sum = 0.0_f32;
    for value in input {
        sum += *value * *value;
    }
    let scale = (sum / input.len() as f32 + epsilon).sqrt().recip();
    if !scale.is_finite() {
        return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
    }
    for (index, (source, target)) in input.iter().zip(output.iter_mut()).enumerate() {
        *target = *source * scale * weight.element(index)?;
    }
    finite_slice(output)
}

fn normalize_heads(
    values: &mut [f32],
    weight: TensorView<'_>,
    head_count: u32,
    head_dimension: u32,
    epsilon: f32,
) -> Result<(), ScalarRuntimeError> {
    let head_count = checked_usize(head_count)?;
    let head_dimension = checked_usize(head_dimension)?;
    if weight.element_type != ElementType::F32
        || values.len()
            != head_count
                .checked_mul(head_dimension)
                .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-shape"))?
        || weight.shape != [head_dimension as u64]
    {
        return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
    }
    for head in values.chunks_exact_mut(head_dimension) {
        let mut sum = 0.0_f32;
        for value in head.iter() {
            sum += *value * *value;
        }
        let scale = (sum / head_dimension as f32 + epsilon).sqrt().recip();
        if !scale.is_finite() {
            return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
        }
        for (index, value) in head.iter_mut().enumerate() {
            *value = *value * scale * weight.element(index)?;
        }
    }
    finite_slice(values)
}

fn apply_rope(
    values: &mut [f32],
    head_count: u32,
    head_dimension: u32,
    position: u32,
    theta: f32,
) -> Result<(), ScalarRuntimeError> {
    let head_count = checked_usize(head_count)?;
    let head_dimension = checked_usize(head_dimension)?;
    if head_dimension == 0
        || !head_dimension.is_multiple_of(2)
        || values.len()
            != head_count
                .checked_mul(head_dimension)
                .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-tensor-shape"))?
        || !theta.is_finite()
        || theta <= 0.0
    {
        return Err(ScalarRuntimeError::new(
            "slm2-runtime-unsupported-model-metadata",
        ));
    }
    let half = head_dimension / 2;
    for head in values.chunks_exact_mut(head_dimension) {
        for index in 0..half {
            let exponent = (2 * index) as f32 / head_dimension as f32;
            let angle = position as f32 / theta.powf(exponent);
            let (sin, cos) = angle.sin_cos();
            let first = head[index];
            let second = head[index + half];
            head[index] = first * cos - second * sin;
            head[index + half] = second * cos + first * sin;
        }
    }
    finite_slice(values)
}

#[allow(clippy::too_many_arguments)]
fn grouped_query_attention(
    query: &[f32],
    cache: &LayerCache,
    head_count: u32,
    kv_head_count: u32,
    head_dimension: u32,
    position: u32,
    scores: &mut [f32],
    output: &mut [f32],
) -> Result<(), ScalarRuntimeError> {
    let head_count = checked_usize(head_count)?;
    let kv_head_count = checked_usize(kv_head_count)?;
    let head_dimension = checked_usize(head_dimension)?;
    let token_count = checked_usize(position)?
        .checked_add(1)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
    let kv_width = kv_head_count
        .checked_mul(head_dimension)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))?;
    if head_count == 0
        || kv_head_count == 0
        || !head_count.is_multiple_of(kv_head_count)
        || query.len() != head_count * head_dimension
        || output.len() != query.len()
        || cache.keys.len() != token_count * kv_width
        || cache.values.len() != cache.keys.len()
        || scores.len() < token_count
    {
        return Err(ScalarRuntimeError::new("slm2-runtime-cache-state"));
    }
    output.fill(0.0);
    let queries_per_kv = head_count / kv_head_count;
    let attention_scale = (head_dimension as f32).sqrt().recip();
    for query_head in 0..head_count {
        let kv_head = query_head / queries_per_kv;
        let query_start = query_head * head_dimension;
        let active_scores = &mut scores[..token_count];
        for (token, score_slot) in active_scores.iter_mut().enumerate() {
            let key_start = token * kv_width + kv_head * head_dimension;
            let mut score = 0.0_f32;
            for offset in 0..head_dimension {
                score += query[query_start + offset] * cache.keys[key_start + offset];
            }
            *score_slot = score * attention_scale;
        }
        softmax(active_scores)?;
        for (token, score) in active_scores.iter().enumerate() {
            let value_start = token * kv_width + kv_head * head_dimension;
            for offset in 0..head_dimension {
                output[query_start + offset] += *score * cache.values[value_start + offset];
            }
        }
    }
    finite_slice(output)
}

fn softmax(values: &mut [f32]) -> Result<(), ScalarRuntimeError> {
    let maximum = values
        .iter()
        .copied()
        .reduce(f32::max)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-empty-attention"))?;
    if !maximum.is_finite() {
        return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
    }
    let mut sum = 0.0_f32;
    for value in values.iter_mut() {
        *value = (*value - maximum).exp();
        sum += *value;
    }
    if !sum.is_finite() || sum <= 0.0 {
        return Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"));
    }
    for value in values {
        *value /= sum;
    }
    Ok(())
}

fn add_vector(values: &mut [f32], tensor: TensorView<'_>) -> Result<(), ScalarRuntimeError> {
    if tensor.element_type != ElementType::F32 || tensor.shape != [values.len() as u64] {
        return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
    }
    for (index, value) in values.iter_mut().enumerate() {
        *value += tensor.element(index)?;
    }
    finite_slice(values)
}

fn residual_add(values: &mut [f32], residual: &[f32]) -> Result<(), ScalarRuntimeError> {
    if values.len() != residual.len() {
        return Err(ScalarRuntimeError::new("slm2-runtime-tensor-shape"));
    }
    for (value, addend) in values.iter_mut().zip(residual) {
        *value += *addend;
    }
    finite_slice(values)
}

fn silu(value: f32) -> f32 {
    value / (1.0 + (-value).exp())
}

fn finite_slice(values: &[f32]) -> Result<(), ScalarRuntimeError> {
    if values.iter().all(|value| value.is_finite()) {
        Ok(())
    } else {
        Err(ScalarRuntimeError::new("slm2-runtime-nonfinite"))
    }
}

fn zeroed_f32(length: usize) -> Result<Vec<f32>, ScalarRuntimeError> {
    let mut values = Vec::new();
    values
        .try_reserve_exact(length)
        .map_err(|_| ScalarRuntimeError::new("slm2-runtime-allocation"))?;
    values.resize(length, 0.0);
    Ok(values)
}

fn checked_usize(value: u32) -> Result<usize, ScalarRuntimeError> {
    usize::try_from(value).map_err(|_| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))
}

fn checked_usize_u64(value: u64) -> Result<usize, ScalarRuntimeError> {
    usize::try_from(value).map_err(|_| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))
}

fn checked_product_usize(left: u32, right: u32) -> Result<usize, ScalarRuntimeError> {
    left.checked_mul(right)
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))
        .and_then(checked_usize)
}

fn checked_product_u64(left: u32, right: u32) -> Result<u64, ScalarRuntimeError> {
    u64::from(left)
        .checked_mul(u64::from(right))
        .ok_or_else(|| ScalarRuntimeError::new("slm2-runtime-memory-overflow"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const Q8_WEIGHT_VECTORS: &str =
        include_str!("../../../../contracts/vnext/slm2-q8-weight-vectors.v1.json");

    fn canonical_model() -> Vec<u8> {
        let document: serde_json::Value = serde_json::from_str(Q8_WEIGHT_VECTORS).unwrap();
        let hex = document["canonical"]["artifactHex"].as_str().unwrap();
        hex.as_bytes()
            .chunks_exact(2)
            .map(|pair| {
                let high = char::from(pair[0]).to_digit(16).unwrap() as u8;
                let low = char::from(pair[1]).to_digit(16).unwrap() as u8;
                (high << 4) | low
            })
            .collect()
    }

    fn policy(maximum_tokens: u32) -> RuntimePolicy {
        RuntimePolicy::new(1 << 20, maximum_tokens, 1 << 20, 1 << 20).unwrap()
    }

    fn session(maximum_tokens: u32) -> ScalarSession {
        ScalarSession::from_bytes(canonical_model(), policy(maximum_tokens)).unwrap()
    }

    #[test]
    fn activates_canonical_wider_query_model_without_shadow_weights() {
        let session = session(4);
        assert_eq!(session.spec().embedding_size, 8);
        assert_eq!(session.spec().head_count, 2);
        assert_eq!(session.spec().head_dimension, 8);
        assert_eq!(session.spec().kv_head_count, 1);
        assert_eq!(session.memory_plan().model_bytes, 8_704);
        assert_eq!(session.memory_plan().kv_bytes, 256);
        assert_eq!(session.position().unwrap(), 0);
    }

    #[test]
    fn deterministic_forward_grows_and_resets_exact_kv_state() {
        let mut session = session(4);
        let first = session.forward_token(1).unwrap().to_vec();
        assert_eq!(first.len(), 32);
        assert!(first.iter().all(|value| value.is_finite()));
        assert_eq!(session.position().unwrap(), 1);
        assert_eq!(session.committed_kv_bytes().unwrap(), 64);

        session.reset();
        let replay = session.forward_token(1).unwrap().to_vec();
        assert_eq!(first, replay);
        assert_eq!(session.position().unwrap(), 1);
    }

    #[test]
    fn token_and_sequence_rejection_leave_cache_unchanged() {
        let mut session = session(1);
        let error = session.forward_token(32).unwrap_err();
        assert_eq!(error.code(), "slm2-runtime-token-range");
        assert_eq!(session.position().unwrap(), 0);

        session.forward_token(0).unwrap();
        let error = session.forward_token(0).unwrap_err();
        assert_eq!(error.code(), "slm2-runtime-sequence-limit");
        assert_eq!(session.position().unwrap(), 1);
    }

    #[test]
    fn rejects_insufficient_preflight_budgets() {
        let policy = RuntimePolicy::new(1 << 20, 4, 255, 1 << 20).unwrap();
        let model = ScalarModel::from_bytes(canonical_model(), policy).unwrap();
        let error = ScalarSession::new(model, policy).unwrap_err();
        assert_eq!(error.code(), "slm2-runtime-kv-budget");

        let policy = RuntimePolicy::new(1 << 20, 4, 1 << 20, 511).unwrap();
        let model = ScalarModel::from_bytes(canonical_model(), policy).unwrap();
        let error = ScalarSession::new(model, policy).unwrap_err();
        assert_eq!(error.code(), "slm2-runtime-scratch-budget");
    }

    #[test]
    fn greedy_ties_choose_lowest_token_and_nonfinite_is_rejected() {
        assert_eq!(select_greedy(&[1.0, 3.0, 3.0]).unwrap(), 1);
        assert_eq!(
            select_greedy(&[1.0, f32::NAN]).unwrap_err().code(),
            "slm2-runtime-nonfinite"
        );
    }

    #[test]
    fn greedy_generation_is_replayable_and_obeys_stop_tokens() {
        let mut replay_session = session(4);
        let first = replay_session.generate_greedy(&[1], 2, &[]).unwrap();
        let second = replay_session.generate_greedy(&[1], 2, &[]).unwrap();
        assert_eq!(first, second);
        assert_eq!(first.len(), 2);
        assert_eq!(replay_session.position().unwrap(), 3);

        let mut stop_session = session(4);
        let next = stop_session.generate_greedy(&[1], 1, &[]).unwrap()[0];
        let stopped = stop_session.generate_greedy(&[1], 2, &[next]).unwrap();
        assert_eq!(stopped, vec![next]);
        assert_eq!(stop_session.position().unwrap(), 2);
    }

    #[test]
    fn split_half_rope_matches_known_angles() {
        let mut values = vec![1.0, 2.0, 3.0, 4.0];
        apply_rope(&mut values, 1, 4, 1, 4.0).unwrap();
        let expected = [-1.984_110_6, -0.162_537_1, 2.462_377_8, 4.469_181_5];
        for (actual, expected) in values.iter().zip(expected) {
            assert!((*actual - expected).abs() < 1e-5, "{actual} != {expected}");
        }
    }

    #[test]
    fn grouped_query_attention_maps_query_heads_to_shared_kv_head() {
        let query = vec![1.0, 0.0, 0.0, 1.0];
        let cache = LayerCache {
            keys: vec![1.0, 0.0],
            values: vec![5.0, 7.0],
        };
        let mut scores = vec![0.0];
        let mut output = vec![0.0; 4];
        grouped_query_attention(&query, &cache, 2, 1, 2, 0, &mut scores, &mut output).unwrap();
        assert_eq!(output, vec![5.0, 7.0, 5.0, 7.0]);
    }
}
