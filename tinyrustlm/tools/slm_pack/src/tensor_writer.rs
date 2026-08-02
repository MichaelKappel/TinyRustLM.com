//! Tensor directory writer inputs.

/// Float32 tensor dtype.
pub const DTYPE_F32: u32 = 1;
/// Q8_0 tensor dtype.
pub const DTYPE_Q8_0: u32 = 2;
/// Q4_0 tensor dtype.
pub const DTYPE_Q4_0: u32 = 3;
/// Q5_0 tensor dtype using signed five-bit codes and f32 block scales.
pub const DTYPE_Q5_0: u32 = 4;

/// Model dimensions used to write deterministic `.slm` files.
pub struct ModelShape {
    /// Token vocabulary size.
    pub vocab_size: u32,
    /// Number of special tokens.
    pub special_token_count: u32,
    /// Transformer hidden size.
    pub hidden_size: u32,
    /// Transformer layer count.
    pub layer_count: u32,
    /// Attention head count.
    pub head_count: u32,
    /// Key/value head count.
    pub kv_head_count: u32,
    /// Dimension per attention head.
    pub head_dim: u32,
    /// Feed-forward intermediate size.
    pub ffn_size: u32,
    /// Maximum context length.
    pub max_context: u32,
    /// Rotary-position embedding base imported from the source model.
    pub rope_theta: f32,
    /// Root-mean-square normalization epsilon imported from the source model.
    pub rms_norm_epsilon: f32,
}

impl ModelShape {
    /// Returns the deterministic tiny fixture shape used by unit tests.
    pub fn tiny_fixture() -> Self {
        Self {
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 8,
            layer_count: 1,
            head_count: 2,
            kv_head_count: 2,
            head_dim: 4,
            ffn_size: 16,
            max_context: 16,
            rope_theta: 10_000.0,
            rms_norm_epsilon: 1e-5,
        }
    }

    /// Returns the first realistic TinyLM-16M target shape.
    pub fn tinylm16() -> Self {
        Self {
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 512,
            layer_count: 4,
            head_count: 8,
            kv_head_count: 8,
            head_dim: 64,
            ffn_size: 2048,
            max_context: 512,
            rope_theta: 10_000.0,
            rms_norm_epsilon: 1e-5,
        }
    }

    /// Returns the first real Stories-15M Llama target shape.
    ///
    /// This matches the candidate matrix route for
    /// `Xenova/llama2.c-stories15M`: tied embeddings, 32k vocabulary,
    /// 6 decoder layers, hidden size 288, 6 attention/KV heads, and a
    /// 768-wide SwiGLU feed-forward block.
    pub fn stories15m() -> Self {
        Self {
            vocab_size: 32000,
            special_token_count: 4,
            hidden_size: 288,
            layer_count: 6,
            head_count: 6,
            kv_head_count: 6,
            head_dim: 48,
            ffn_size: 768,
            max_context: 256,
            rope_theta: 10_000.0,
            rms_norm_epsilon: 1e-5,
        }
    }

    /// Returns the reviewed SmolLM2-135M-Instruct target shape.
    ///
    /// This matches `HuggingFaceTB/SmolLM2-135M-Instruct`: Llama decoder,
    /// GPT2/ByteLevel BPE vocabulary, tied embeddings, 30 layers, 9 query
    /// heads, 3 key/value heads, and 64 dimensions per head.
    pub fn smollm2_135m_instruct() -> Self {
        Self {
            vocab_size: 49152,
            special_token_count: 17,
            hidden_size: 576,
            layer_count: 30,
            head_count: 9,
            kv_head_count: 3,
            head_dim: 64,
            ffn_size: 1536,
            max_context: 8192,
            rope_theta: 100_000.0,
            rms_norm_epsilon: 1e-5,
        }
    }

    /// Returns the reviewed SmolLM2-360M-Instruct target shape.
    ///
    /// This matches `HuggingFaceTB/SmolLM2-360M-Instruct`: Llama decoder,
    /// GPT2/ByteLevel BPE vocabulary, tied embeddings, 32 layers, 15 query
    /// heads, 5 key/value heads, and 64 dimensions per head. The q4_0 output
    /// is the intended browser-footprint tier for this shape.
    pub fn smollm2_360m_instruct() -> Self {
        Self {
            vocab_size: 49152,
            special_token_count: 17,
            hidden_size: 960,
            layer_count: 32,
            head_count: 15,
            kv_head_count: 5,
            head_dim: 64,
            ffn_size: 2560,
            max_context: 8192,
            rope_theta: 100_000.0,
            rms_norm_epsilon: 1e-5,
        }
    }

    /// Returns the reviewed Qwen3-0.6B target shape.
    ///
    /// Qwen3 projects 1,024 hidden values into sixteen 128-wide query heads,
    /// so its query and attention width is 2,048 rather than hidden size.
    /// The source contract also adds paired per-head query/key RMSNorm tensors.
    pub fn qwen3_0_6b() -> Self {
        Self {
            vocab_size: 151936,
            special_token_count: 26,
            hidden_size: 1024,
            layer_count: 28,
            head_count: 16,
            kv_head_count: 8,
            head_dim: 128,
            ffn_size: 3072,
            // The source checkpoint supports 40,960 positions, but a float32 browser KV cache
            // at that length would exceed 8 GiB. This is the explicit local-footprint tier.
            max_context: 1024,
            rope_theta: 1_000_000.0,
            rms_norm_epsilon: 1e-6,
        }
    }

    /// Returns the reviewed Qwen2.5-1.5B-Instruct target shape.
    ///
    /// Qwen2.5 uses grouped-query attention with twelve query heads and two
    /// key/value heads. Unlike the Llama and Qwen3 contracts above, each
    /// attention layer has learned query, key, and value projection biases.
    pub fn qwen2_5_1_5b() -> Self {
        Self {
            vocab_size: 151936,
            special_token_count: 22,
            hidden_size: 1536,
            layer_count: 28,
            head_count: 12,
            kv_head_count: 2,
            head_dim: 128,
            ffn_size: 8960,
            // The source checkpoint supports 32,768 positions. The first browser tier is
            // bounded to keep its float32 KV cache below the practical local-memory ceiling.
            max_context: 1024,
            rope_theta: 1_000_000.0,
            rms_norm_epsilon: 1e-6,
        }
    }
}

/// Static tensor specification for fixture packing.
pub struct TensorSpec {
    /// Stable tensor name hash.
    pub name_hash: u64,
    /// Tensor dtype.
    pub dtype: u32,
    /// Tensor rank.
    pub rank: u32,
    /// Tensor dimensions.
    pub dims: [u32; 4],
    /// Deterministic fill seed.
    pub seed: u32,
    /// Quantization block size, or zero for f32.
    pub block_size: u32,
}

impl TensorSpec {
    /// Creates a f32 tensor specification.
    pub fn f32(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut padded = [1u32; 4];
        for (index, dim) in dims.iter().enumerate() {
            padded[index] = *dim;
        }
        Self {
            name_hash: name_hash(name),
            dtype: DTYPE_F32,
            rank: dims.len() as u32,
            dims: padded,
            seed,
            block_size: 0,
        }
    }

    /// Creates a q8_0 tensor specification.
    pub fn q8(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut spec = Self::f32(name, dims, seed);
        spec.dtype = DTYPE_Q8_0;
        spec.block_size = spec.cols_per_row() as u32;
        spec
    }

    /// Creates a q4_0 tensor specification.
    pub fn q4(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut spec = Self::f32(name, dims, seed);
        spec.dtype = DTYPE_Q4_0;
        let cols = spec.cols_per_row();
        spec.block_size = if cols >= 32 && cols.is_multiple_of(32) {
            32
        } else {
            cols as u32
        };
        spec
    }

    /// Creates a q5_0 tensor specification.
    pub fn q5(name: &str, dims: &[u32], seed: u32) -> Self {
        let mut spec = Self::f32(name, dims, seed);
        spec.dtype = DTYPE_Q5_0;
        let cols = spec.cols_per_row();
        spec.block_size = [64usize, 32, 16, 8]
            .into_iter()
            .find(|block| cols >= *block && cols.is_multiple_of(*block))
            .unwrap_or(0) as u32;
        spec
    }

    /// Returns the tensor element count.
    pub fn element_count(&self) -> usize {
        let mut total = 1usize;
        for dim in self.dims.iter().take(self.rank as usize) {
            total *= *dim as usize;
        }
        total
    }

    /// Returns the serialized tensor data byte length.
    pub fn byte_len(&self) -> usize {
        match self.dtype {
            DTYPE_F32 => self.element_count() * 4,
            DTYPE_Q8_0 => self.element_count(),
            DTYPE_Q4_0 => self.element_count() / 2,
            DTYPE_Q5_0 if self.element_count().is_multiple_of(8) => self
                .element_count()
                .checked_div(8)
                .and_then(|groups| groups.checked_mul(5))
                .unwrap_or(0),
            DTYPE_Q5_0 => 0,
            _ => 0,
        }
    }

    /// Returns the serialized quantization scale byte length.
    pub fn scale_byte_len(&self) -> usize {
        match self.dtype {
            DTYPE_Q8_0 => self.rows() * 4,
            DTYPE_Q4_0 | DTYPE_Q5_0 => self.rows() * self.blocks_per_row() * 4,
            _ => 0,
        }
    }

    /// Returns row count for row-wise quantization.
    pub fn rows(&self) -> usize {
        if self.rank <= 1 {
            1
        } else {
            self.dims[0] as usize
        }
    }

    /// Returns columns per row for row-wise quantization.
    pub fn cols_per_row(&self) -> usize {
        if self.rank <= 1 {
            self.element_count()
        } else {
            self.dims
                .iter()
                .skip(1)
                .take(self.rank as usize - 1)
                .fold(1usize, |acc, dim| acc * *dim as usize)
        }
    }

    /// Returns q4 blocks per row.
    pub fn blocks_per_row(&self) -> usize {
        let block = self.block_size as usize;
        self.cols_per_row().checked_div(block).unwrap_or(0)
    }
}

/// Returns tensor specs for the tiny test model.
pub fn tiny_fixture_tensors() -> Vec<TensorSpec> {
    tiny_fixture_tensors_with_dtype(DTYPE_F32)
}

/// Returns tensor specs for a quantization-specific tiny test model.
pub fn tiny_fixture_tensors_with_dtype(dtype: u32) -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tiny_fixture(), dtype)
}

/// Returns f32 tensor specs for a tiny tied-output test model.
pub fn tiny_fixture_tied_tensors() -> Vec<TensorSpec> {
    tensors_for_shape_with_tied_output(&ModelShape::tiny_fixture(), DTYPE_F32)
}

/// Returns tensor specs for the TinyLM-16M f32 target model.
pub fn tinylm16_f32_tensors() -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tinylm16(), DTYPE_F32)
}

/// Returns tensor specs for the TinyLM-16M q8_0 target model.
pub fn tinylm16_q8_tensors() -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tinylm16(), DTYPE_Q8_0)
}

/// Returns tensor specs for the TinyLM-16M q4_0 target model.
pub fn tinylm16_q4_tensors() -> Vec<TensorSpec> {
    tensors_for_shape(&ModelShape::tinylm16(), DTYPE_Q4_0)
}

/// Returns tensor specs for a model shape and dtype.
pub fn tensors_for_shape(shape: &ModelShape, dtype: u32) -> Vec<TensorSpec> {
    tensors_for_shape_contract(shape, dtype, false, false, false)
}

/// Returns tensor specs for a tied-output model with paired per-head q/k RMSNorm.
pub fn tensors_for_shape_with_qk_norm_and_tied_output(
    shape: &ModelShape,
    dtype: u32,
) -> Vec<TensorSpec> {
    tensors_for_shape_contract(shape, dtype, true, true, false)
}

/// Returns tensor specs for a tied-output model with f32 q/k/v projection biases.
pub fn tensors_for_shape_with_qkv_bias_and_tied_output(
    shape: &ModelShape,
    dtype: u32,
) -> Vec<TensorSpec> {
    tensors_for_shape_contract(shape, dtype, true, false, true)
}

fn tensors_for_shape_contract(
    shape: &ModelShape,
    dtype: u32,
    tied_output: bool,
    qk_norm: bool,
    qkv_bias: bool,
) -> Vec<TensorSpec> {
    let hidden = shape.hidden_size;
    let q_projection_rows = shape.head_count * shape.head_dim;
    let kv_projection_rows = shape.kv_head_count * shape.head_dim;
    let ffn = shape.ffn_size;
    let vocab = shape.vocab_size;
    let mut tensors = vec![
        tensor_spec(dtype, "tok_embeddings.weight", &[vocab, hidden], 1),
        tensor_spec(dtype, "norm.weight", &[hidden], 2),
    ];
    if !tied_output {
        tensors.push(tensor_spec(dtype, "output.weight", &[vocab, hidden], 3));
    } else {
        tensors[0].seed = 13;
    }
    for layer in 0..shape.layer_count {
        let prefix = format!("layers.{layer}");
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.attention_norm.weight"),
            &[hidden],
            4,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.ffn_norm.weight"),
            &[hidden],
            5,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wq.weight"),
            &[q_projection_rows, hidden],
            6,
        ));
        if qkv_bias {
            tensors.push(TensorSpec::f32(
                &format!("{prefix}.wq.bias"),
                &[q_projection_rows],
                15,
            ));
        }
        if qk_norm {
            tensors.push(tensor_spec(
                dtype,
                &format!("{prefix}.q_norm.weight"),
                &[shape.head_dim],
                13,
            ));
        }
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wk.weight"),
            &[kv_projection_rows, hidden],
            7,
        ));
        if qkv_bias {
            tensors.push(TensorSpec::f32(
                &format!("{prefix}.wk.bias"),
                &[kv_projection_rows],
                16,
            ));
        }
        if qk_norm {
            tensors.push(tensor_spec(
                dtype,
                &format!("{prefix}.k_norm.weight"),
                &[shape.head_dim],
                14,
            ));
        }
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wv.weight"),
            &[kv_projection_rows, hidden],
            8,
        ));
        if qkv_bias {
            tensors.push(TensorSpec::f32(
                &format!("{prefix}.wv.bias"),
                &[kv_projection_rows],
                17,
            ));
        }
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.wo.weight"),
            &[hidden, q_projection_rows],
            9,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.w1.weight"),
            &[ffn, hidden],
            10,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.w2.weight"),
            &[hidden, ffn],
            11,
        ));
        tensors.push(tensor_spec(
            dtype,
            &format!("{prefix}.w3.weight"),
            &[ffn, hidden],
            12,
        ));
    }
    tensors
}

/// Returns tensor specs for a model shape using tied output projection.
pub fn tensors_for_shape_with_tied_output(shape: &ModelShape, dtype: u32) -> Vec<TensorSpec> {
    tensors_for_shape_contract(shape, dtype, true, false, false)
}

fn tensor_spec(dtype: u32, name: &str, dims: &[u32], seed: u32) -> TensorSpec {
    match dtype {
        DTYPE_Q8_0 => TensorSpec::q8(name, dims, seed),
        DTYPE_Q4_0 => TensorSpec::q4(name, dims, seed),
        DTYPE_Q5_0 => TensorSpec::q5(name, dims, seed),
        _ => TensorSpec::f32(name, dims, seed),
    }
}

/// Computes the stable FNV-1a hash used for tensor names.
pub fn name_hash(name: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in name.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tensor_by_name<'a>(tensors: &'a [TensorSpec], name: &str) -> &'a TensorSpec {
        let hash = name_hash(name);
        tensors
            .iter()
            .find(|tensor| tensor.name_hash == hash)
            .unwrap_or_else(|| panic!("missing tensor {name}"))
    }

    #[test]
    fn model_shapes_bind_source_numerical_configuration() {
        assert_eq!(ModelShape::tiny_fixture().rope_theta, 10_000.0);
        assert_eq!(ModelShape::stories15m().rope_theta, 10_000.0);
        assert_eq!(ModelShape::smollm2_135m_instruct().rope_theta, 100_000.0);
        assert_eq!(ModelShape::smollm2_360m_instruct().rope_theta, 100_000.0);
        assert_eq!(ModelShape::smollm2_360m_instruct().rms_norm_epsilon, 1e-5);
        assert_eq!(ModelShape::qwen3_0_6b().rope_theta, 1_000_000.0);
        assert_eq!(ModelShape::qwen3_0_6b().rms_norm_epsilon, 1e-6);
        assert_eq!(ModelShape::qwen2_5_1_5b().special_token_count, 22);
        assert_eq!(ModelShape::qwen2_5_1_5b().rope_theta, 1_000_000.0);
        assert_eq!(ModelShape::qwen2_5_1_5b().rms_norm_epsilon, 1e-6);
    }

    #[test]
    fn tensors_for_shape_use_kv_projection_rows_for_grouped_query_attention() {
        let shape = ModelShape {
            vocab_size: 260,
            special_token_count: 4,
            hidden_size: 8,
            layer_count: 1,
            head_count: 4,
            kv_head_count: 2,
            head_dim: 2,
            ffn_size: 16,
            max_context: 16,
            rope_theta: 10_000.0,
            rms_norm_epsilon: 1e-5,
        };
        let tensors = tensors_for_shape(&shape, DTYPE_F32);

        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wq.weight").dims[..2],
            &[8, 8]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wk.weight").dims[..2],
            &[4, 8]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wv.weight").dims[..2],
            &[4, 8]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wo.weight").dims[..2],
            &[8, 8]
        );
    }

    #[test]
    fn qwen3_tensor_contract_uses_wide_queries_and_paired_qk_norms() {
        let shape = ModelShape::qwen3_0_6b();
        let tensors = tensors_for_shape_with_qk_norm_and_tied_output(&shape, DTYPE_F32);

        assert_eq!(tensors.len(), 310);
        assert!(tensors
            .iter()
            .all(|tensor| tensor.name_hash != name_hash("output.weight")));
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wq.weight").dims[..2],
            &[2048, 1024]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wk.weight").dims[..2],
            &[1024, 1024]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wo.weight").dims[..2],
            &[1024, 2048]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.q_norm.weight").dims[..1],
            &[128]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.k_norm.weight").dims[..1],
            &[128]
        );
    }

    #[test]
    fn qwen2_5_tensor_contract_preserves_f32_projection_biases() {
        let shape = ModelShape::qwen2_5_1_5b();
        let tensors = tensors_for_shape_with_qkv_bias_and_tied_output(&shape, DTYPE_Q4_0);

        assert_eq!(shape.hidden_size, 1536);
        assert_eq!(shape.head_count, 12);
        assert_eq!(shape.kv_head_count, 2);
        assert_eq!(shape.head_dim, 128);
        assert_eq!(tensors.len(), 338);
        assert!(tensors
            .iter()
            .all(|tensor| tensor.name_hash != name_hash("output.weight")));
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wq.bias").dims[..1],
            &[1536]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wk.bias").dims[..1],
            &[256]
        );
        assert_eq!(
            &tensor_by_name(&tensors, "layers.0.wv.bias").dims[..1],
            &[256]
        );
        for name in ["layers.0.wq.bias", "layers.0.wk.bias", "layers.0.wv.bias"] {
            let bias = tensor_by_name(&tensors, name);
            assert_eq!(bias.dtype, DTYPE_F32);
            assert_eq!(bias.block_size, 0);
        }
        assert_eq!(
            tensor_by_name(&tensors, "layers.0.wq.weight").dtype,
            DTYPE_Q4_0
        );
    }

    #[test]
    fn q5_tensor_contract_uses_five_bit_payloads_and_divisible_blocks() {
        let wide = TensorSpec::q5("wide.weight", &[2, 64], 1);
        assert_eq!(wide.dtype, DTYPE_Q5_0);
        assert_eq!(wide.block_size, 64);
        assert_eq!(wide.byte_len(), 80);
        assert_eq!(wide.scale_byte_len(), 8);

        let narrow = TensorSpec::q5("narrow.weight", &[2, 8], 1);
        assert_eq!(narrow.block_size, 8);
        assert_eq!(narrow.byte_len(), 10);
        assert_eq!(narrow.scale_byte_len(), 8);

        let malformed = TensorSpec::q5("malformed.weight", &[1, 7], 1);
        assert_eq!(malformed.block_size, 0);
        assert_eq!(malformed.byte_len(), 0);
        assert_eq!(malformed.scale_byte_len(), 0);
    }
}
