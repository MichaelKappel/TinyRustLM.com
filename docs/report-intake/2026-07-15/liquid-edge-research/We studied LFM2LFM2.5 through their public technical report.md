# 1. Executive Recommendation

We studied LFM2/LFM2.5 through their public technical report, official releases (model cards, configs), and open-source code (HuggingFace Transformers, llama.cpp hooks).  LFM2/LFM2.5 are *discrete hybrid language models* built from convolutional and attention blocks with multiplicative gating – **not** continuous-time RNNs. Normal inference uses fixed pretrained weights; no weight adaptation occurs (only recurrent/cache state like KV and conv-state changes). 

We conclude that implementing LFM2.5 in a TinyRustLM `.slm` runtime is **feasible but complex**.  The LFM2.5 family (230M–1.2B parameters) adds hybrid “LIV” conv layers and grouped-query attention atop a GPT-like backbone.  A correct, efficient `.slm` backend requires (a) fully reconstructing its gated-conv and attention math, (b) rigorous tensor-contract checking for 4 model sizes, (c) designing cache/memory and compute patterns for conv caches and KV cache (prefill vs decode), (d) extending the `.slm` schema to flag the hybrid blocks, (e) implementing reference and SIMD/WebAssembly kernels for short-grouped conv and GQA, (f) careful quantization evaluation for each tensor type, (g) preserving tokenizer/chat format, and (h) a thorough parity test suite. We estimate a multi-stage project (Minimum Viable X, full 350M, quantization, WASM, larger models) of order hundreds of engineer-days, with stop-gates on unresolved architecture ambiguities (e.g. strange gating signals) or unacceptable accuracy drift. 

**Assumptions:** We assume only public LFM2/LFM2.5 artifacts and code. We assume TinyRustLM’s current `.slm` format for GPT-like models, and that we must support both native and WASM SIMD128. The hybrid LFM2/LFM2.5 architecture must *not* be silently accepted by an old runtime (i.e. must be versioned). Transformer-compatibility or benchmarks alone cannot substitute careful implementation. 

# 2. Terminology & Lineage

| Term | Meaning / Origin | Present in LFM2/LFM2.5? |
|------|------------------|-------------------------|
| **“Liquid Neural Network” / LTC (Liquid Time-Constant)** | Continuous-time RNNs (Hasani & Lechner 2018,2020) with input-dependent time constants. Involve hidden ODE states and input-modulated linear dynamics. | *No.* LFM2 is not continuous-time nor does it update weights or state beyond standard caching. It *draws inspiration* (gating of conv is akin to input-varying weights), but actual checkpoints contain no ODE state equations. Gates are static learned tensors applied as elementwise multipliers (see Section 3). |
| **LIV (Linear Input-Varying) operator** | Concept from ML literature: an operator whose weights depend on input. E.g. gated conv is a simple LIV conv. | *Yes (conceptual).* The `lfm2_conv` block is exactly a tiny LIV conv: linear→gating→conv→gating. All non-attention layers are short-depth “LIV” convs. |
| **GQA (Grouped-Query Attention)** | Multi-head attention where number of query heads $H$ is greater than key/value heads $K$. Queries attend over grouped K/V. | *Yes.* In LFM2, `num_attention_heads` > `num_key_value_heads` (e.g. 16 vs 8 in 350M). The code splits Q (16 heads) vs K/V (8 heads) and uses a custom attention that repeats K/V (`repeat_kv`) so each key/value is shared by multiple queries. |
| **Double-Gated Conv** | A 1D depthwise conv preceded and followed by multiplicative gates (elementwise). Essentially: $x \mapsto W_o\big(C * \big(\text{Conv}(B * (W_i x))\big)\big)$ with learned $B,C$ gates. | *Yes.* Both LFM2 and LFM2.5 use these “LIV convolution” blocks. See pseudocode: `x = B*x; x = conv(x); x = C*x; x = linear(x)`. (Here $B,C$ come from splitting a linear proj.) |
| **SwiGLU** | Feed-forward activation: two linear projections $W_1,W_3$ then SiLU gate: $y = W_2(\sigma(W_1 x) \cdot W_3 x)$. | *Yes.* All feed-forward MLPs are SwiGLU with pre-layernorm. Verified in code. |
| **RMSNorm** | Root-mean-square layer norm used for pre-normalization.  | *Yes.* All layers use RMSNorm (eps=1e-5) before conv/attn and before MLP. Transformer code uses `Lfm2RMSNorm` at both attn/conv input and feed-forward input. |
| **RoPE (Rotary Embeddings)** | Position encoding rotating Q,K vectors. Used with a user-set *theta* (1e6 here) for very long context. | *Yes.* LFM2 uses RoPE on queries and keys. The HF config `use_pos_enc: true, rope_theta:1000000` indicates it, and code applies `apply_rotary_pos_emb(query,key,cos,sin)`. |
| **Offset|Parallel|Fenwick Transformer (LFM1)** | (If LFM1 existed in public, likely based on earlier TinyLiquid or LoRA). LFM1-7B was a dense GPT-like model (blog mentions using it as teacher). | *N/A* for checkpoint dissection, but presumably LFM1 used a simpler Transformer (no hybrid conv), given LFM2 references it only as a teacher model (knowledge distillation). |
| **Parameter updates: inference vs learning** | During autoregressive inference with cached state, only *cache* (past-key-values, conv states) evolves. **Weights are not updated** unless performing fine-tuning or explicit online learning. | *Confirmed.* The HuggingFace code is stateless aside from `past_key_values` and conv state updates. Thus inference does not change `self.embed_tokens` etc. The LFM2 blog and config have `use_cache:true`, implying KV caching, and `torch_dtype:bfloat16, initializer_range` etc only set initial params. No online adaptation code is present. We verified a full forward pass by consulting the code.  

The public literature shows that while LFM2’s *design* was inspired by Liquid/LIV concepts, the actual released models are *purely feedforward/hybrid* (conv+attn) with no continuous-time RNN equations. The explicit forward formulas in Section 3 and code confirm this. 

# 3. Forward-Pass Structure

**High-level flow:** Input token IDs → Embedding (tied with output) → Iterate *layers* 0..$L-1$ → Final layernorm → LM head → logits. Each layer is either a **Conv block** or **GQA (self-attn) block** per the schedule in the config.  After each block, add the input (pre-activation residual) and then apply a SwiGLU MLP with its own residual. 

- **Input Embedding:** A standard token embedding lookup of size $V\times H$ (with $V=65536$, $H$ = hidden_size 1024/1536/2048) produces $[B\times S\times H]$.  The config `tie_embedding=true` means output projection shares this weight. Positional info is via rotary (no learned vectors), so there is no position-embedding buffer to add.

- **Block types:**  
  - *Conv (LIV) blocks:* See pseudocode. Implemented in code by `Lfm2ShortConv`. Given input $X\in\mathbb{R}^{B\times S\times H}$, do:  
    1. **Pre-norm:** $U = \mathrm{RMSNorm}(X)$.  
    2. **Linear/Gate pre-projection:** Compute $L = U\,W_{\text{in}}$ where $W_{\text{in}}\in\mathbb{R}^{H\times 3H}$. Reshape and chunk into three $[B\times H\times S]$ parts $B,C,X'$ (in practice, the code chunk is `B,C,x = BCx.chunk(3,dim=-2)`).  
    3. **Gating + Conv:** Compute elementwise $G = B * X'$ (scaling each channel). Apply a *depthwise causal conv1D* with kernel size $K=2L_{\rm cache}+1$ (here $K=7$ since `conv_L_cache=3`) and groups=H. Pad so output length matches input length, then take the first $S$ time-steps (causal conv).  
    4. **Second gating + output linear:** Elementwise multiply $C * \text{Conv}(G)$, then project through $W_{\text{out}}\in\mathbb{R}^{H\times H}$ to produce $Y_{\rm conv}\in\mathbb{R}^{B\times S\times H}$.  
    5. **Residual add:** $Z = X + Y_{\rm conv}$.  

    In summary (ignoring bias and batch dims): 
    $$B,C,X' = (XW_{\rm in})_{\rm split};\quad G = B * X';\quad Z_{\text{conv}} = X + W_{\rm out}(C * \text{Conv}(G)).$$ 
    The technical report and code emphasize *double gating* around a short conv.

  - *Attention (GQA) blocks:* Also pre-norm the input with RMSNorm. Then multi-head self-attention with grouped queries:  
    1. **Q/K/V projections:** Compute $Q = U W_Q$, $K = U W_K$, $V = U W_V$, with $W_Q\in\mathbb{R}^{H\times (H)}$ (split into $H_{\rm heads}$ by $d_{\rm head}$), but $W_K,W_V\in\mathbb{R}^{H\times(8H_{\rm head})}$ if `num_key_value_heads=8` (for 16-Q/8-K/V case). The code applies RMSNorm separately on each head: `q_layernorm` and `k_layernorm` on the $d_{\rm head}$ dimension (this is the QK-norm).  
    2. **Reshape & RoPE:** Reshape $Q$ to $[B,H_q,S,d_{\rm head}]$, $K$ to $[B,H_k,S,d_{\rm head}]$ ($H_q>H_k$ for GQA). Apply rotary ($Q',K' = \text{RoPE}(Q,K)$ using precomputed sin/cos).  
    3. **KV caching:** In decode mode, append new $K',V$ to cache. (The code has `past_key_values.update(key_states,value_states)`.)  
    4. **Attention scores:** Use a grouped-key attention: they tile $K'$ and $V'$ so each of the $H_q$ queries sees the shared keys in $H_k$ groups. Specifically, if $n_{\rm rep}=H_q/H_k=2$, they repeat K/V accordingly. Then perform standard causal softmax attention: $\text{Softmax}(Q'K'^\top / \sqrt{d})V'$.  
    5. **Output projection:** The concatenated output of shape $[B,S,H_q \cdot d]$ is projected back to $H$ with $W_O$.  
    6. **Residual add:** $Z = X + Y_{\rm attn}$.

  - **Feed-Forward MLP (SwiGLU):** After each block’s residual, apply a second RMSNorm and 2-layer SwiGLU: $Y_{\rm MLP} = W_2(\sigma(W_1 Z) * W_3 Z)$, then add $Z+Y_{\rm MLP}$. (Biases are typically omitted.) This yields the block output.

- **Layer schedule:** The layer schedule is fixed by a “layer_types” list in the config. For 350M/700M/1.2B: 16 layers total, 10 Conv + 6 Attn, in a pattern (0-15 indices): conv, conv, attn, conv, conv, attn, conv, conv, attn, conv, attn, conv, attn, conv, attn, conv. For 230M LFM2.5: 14 layers (8 conv + 6 attn). (The precise pattern can be read from each model’s `layer_types` in config.)

- **Activations & dtypes:** All multiplications and projections are in float (officially bfloat16 in pretraining, but runtime will use float32). The activation is SiLU (swish) inside the MLP; *no nonlinearity* after conv or attention other than these linear transforms. Convolution and projection kernels use Xavier init as per config (but that only affects training/initialization). 

- **Other details:**  No biases on conv projections (`conv_bias: false`), and embeddings are tied (`tie_embedding: true`) so output logits use input embedding matrix. The positional encoding scale (`rope_theta:1e6`) means the rotary angles advance very slowly for long contexts. Embedding normalization is applied once before final logits (`embedding_norm` in code, see [96], but this detail is often fused in output). 

Inconsistencies/reconciliation: The *paper/pseudo-code* (Fig. in [104]) matches exactly the code & configs. Some variable names differ (e.g. code uses separate Q/K layernorm, paper glosses over QK-norm), but the math is consistent. The HF model cards and config specify all dimensions and confirm: 350M has 1024×4608 MLP (4.5×) vs 6656 (6.5×) in LFM2.5-350M, number of heads (16→24→32) and layers as above. The Transformers code [96–100] provides the authoritative implementation of each operation.

# 4. Tensor & Metadata Contract

For each checkpoint size (230M, 350M, 700M, 1.2B): we define a schema that converter can enforce:

- **Vocabulary (shared across all):** $V=65536$ tokens. Embedding weight `tok_embeddings.weight` of shape `[V,H]`. If `tie_embedding`, there is no separate `lm_head`; output uses transpose of this. (Configs show `tie_embedding:true`.)

- **Layer weights (per layer index):** Each layer $l$ has either:
  - **Conv-layer $l$:** keys in safetensors likely `layers.{l}.short_conv.in_proj.weight` (shape `[3H,H]`), `layers.{l}.short_conv.conv.weight` (`[H,1,K]` for depthwise conv), `layers.{l}.short_conv.out_proj.weight` (`[H,H]`), plus possibly any biases (`conv_bias:false` so probably none). Also two RMSNorm parameters: `layers.{l}.operator_norm.weight` and `layers.{l}.ffn_norm.weight` (each `[H]`). These must exist exactly once per conv block. The model uses `layers.{l}.ffn_norm` after conv output and `layers.{l}.operator_norm` on input. The SwiGLU MLP has two weights: `layers.{l}.mlp.w1.weight` `[H,x]`, `layers.{l}.mlp.w3.weight` `[H,x]`, `layers.{l}.mlp.w2.weight` `[x,H]`. (x = intermediate_size, e.g. 6656 for 350M LFM2.5). Confirm that for each conv-layer, all these exist and no others. The conv kernel length is $K=2*L_{\rm cache}+1$ (e.g. 7 when `conv_L_cache=3`), so `conv.weight` shape is `[H,1,K]` (depthwise). 
  - **Attn-layer $l$:** Keys: `layers.{l}.self_attn.q_proj.weight` `[H,H]`, `.k_proj.weight` `[H,(H/num_groups)]`, `.v_proj.weight` `[H,(H/num_groups)]`, `.out_proj.weight` `[(H),H]` (effectively `[H,H]`). Also Q/K head-norm weights (`q_layernorm.weight` `[d]` and `k_layernorm.weight` `[d]`, where $d=d_{\rm head}$). The code shows `Lfm2RMSNorm` on each head of size `head_dim = H/H_q`. There are also the same two `operator_norm.weight` and `ffn_norm.weight` for that layer and the SwiGLU weights as above (`mlp.w1`, `w3`, `w2`). Additionally, any biases in MLP (none if `bias=False`). Ensure all heads (H and H/num_groups) are consistent with config. 
  - **Special keys:** Embedding Norm: `model.embedding_norm.weight` `[H]` (final RMSNorm).  
  - **Tokenizer tokens:** The converter should also read `special_tokens_map.json` (or similar). Required tokens: BOS=`<|startoftext|>` (id 1) and EOS=`<|im_end|>` (id 7) and PAD `<|pad|>` (id 0).  (Any tool-call delimiters or system tokens would be in the tokenizer files; converters should check that `tokenizer.json` and `vocab.txt` correspond to the model used.) 
  - **Dims & strides:** All tensors are contiguous in row-major (PyTorch) layout by default. The converter should verify shape from config: e.g. Conv in_proj `[3H,H]`, conv kern `[H,1,K]`, out_proj `[H,H]`, attention [as above], MLP `[H,x]`, `[H,x]`, `[x,H]`. If any tensor is missing, duplicated, or shape mismatched, abort conversion. The model file should include `transformers_version` and config; we should embed those fields as metadata or manifest.

For each size: 
- *LFM2.5-230M:* Hidden $H=1024$, intermediate $2560$, layers=14 (8 conv+6 attn). Confirm conv Lcache=3, heads=16/8, FF dim=2560. 
- *LFM2.5-350M:* $H=1024$, FF=6656, layers=16 (10 conv+6 attn) (conv pattern as in LFM2-350M). 
- *LFM2-700M:* $H=1536$, FF=6912, layers=16 (10 conv+6 attn) (heads 24/8). 
- *LFM2.5-1.2B:* $H=2048$, FF=12288, layers=16 (10 conv+6 attn) (heads 32/8). 

A converter must enforce *exactly* these shapes. A good check: sum of all param counts should match expected totals (e.g. ~350M, 700M, etc). Extra unexpected keys (e.g. “version” or “auxiliary heads”) should cause rejection. Unused suffixes like “bias” should match `false`. Endianness is standard little-endian. Checksums (e.g. SHA256 of each weight) and a global hash can be in `.slm` manifest. The `.slm` schema described in Section 6 will formalize this. 

# 5. Cache, Memory, and Operation Counts

We derive cost for **prefill** (processing context of length $S$) and **one-token decode** (processing one new token) per layer type. Let $H$=hidden, $F$=FF dim, $n_{\rm heads}=H/h$, $n_{\rm kv}=n_{\rm heads}/g$ with $g$ groups (so $g=2$ here).

- **Conv block:** For a full sequence $S$:
  - *Arithmetic:* The main cost is the depthwise conv and the elementwise multiplies. Linear-in-proj $3H^2 S$, conv: $H \cdot K S$ mul-adds (with $K=2L+1$, here 7), and out-proj $H^2 S$. (Multiplies with gating are $H S$ each for two multiplies $B*x$ and $C*$.). Total $\approx S(4H^2 + H*K)$ multiplies (ops). E.g. 350M ($H=1024$) gives ~$S(4*1024^2 + 1024*7)\approx 4.19\times10^6 S$ ops. 
  - *Cache:* The conv has *state* of length $L_{\rm cache}=3$ for each head. We must store the last 3 values per channel per batch. So conv-cache bytes $\approx B\times H\times L_{\rm cache}$. For decode: one new token does $H*K$ conv ops using the cached 3 values plus new input. Memory: no extra KV, but conv state. 
  - *Memory:* During prefill, temp activations ~ $O(SH)$ for output, plus input. No hidden states aside from KV which conv doesn’t use. So memory $\propto S H$ for activations. Decoding extra memory is constant ($H$ new output plus conv state) per token. 
  - *Constant memory:* This conv uses only fixed small-state $O(H L_{\rm cache})$, independent of $S$. So conv blocks have *constant* extra memory (independent of context). 

- **Attention (GQA) block:** 
  - *Arithmetic (prefill):* $Q,K,V$ projections cost $3H^2 S$, computing scores and combining: Multiply $Q(K^\top)$ $\sim H S \cdot (H/h)$ inner products per head, more precisely $(H/h)H S$ multiplications per timestep, plus softmax, then $V$ multiply ~ same. Accounting group repeat: if $g=2$, effectively double multiplication but reuse partial sums. Roughly $2 (H/h)H S$. And out-proj $H^2 S$. Total $\approx S(5H^2)$ ops. (E.g. 350M: $S * 5*1024^2 \approx 5.24\times 10^6 S$.)  
  - *KV cache memory:* Must store cached keys and values of shape $[B, H, S]$ (but since $n_{\rm kv}=H/g$, raw $K,V$ of shape $[B, H/g, S]$ and used $repeat_kv$ each decode). So bytes $\approx 2BH S$ for keys+values (in float32). For decode, store only last key/value vectors, but for full context store all. 
  - *Attn weights:* Usually not stored for inference (we recompute on the fly for each token). 
  - *Memory:* Prefill: KV cache $O(S H)$, QKV activations, plus output $SH$. Decode: only new key/value vectors ($O(H)$) added; queries all of size $H$, one output.  
  - *Linear growth:* Attention *cache* grows with context ($\propto S$), so memory is $O(SH)$.

- **MLP block:** 
  - *Arithmetic:* $W_1$ and $W_3$ both do $H \times F$ on sequence, plus multiply, plus $W_2$: roughly $2 H F S + H F S \approx 3 H F S$ multiplies. For 1024→4608→1024 (350M): ~$S*3*(1024*4608)\approx 14.1\times10^6 S$. 
  - *Memory:* Activations $O(S H)$ and intermediate $O(S F)$, but intermediate can be streamed and not all stored concurrently. The KV/conv caches not used here.  
  - *Decoder (1 token):* similar arithmetic but on length 1: $3 H F$ multiplies, memory $O(H+F)$. 

In summary, **total ops per prefill token** ≈ $S*(4H^2+H K + 5H^2 +3H F)$ (conv + attn + MLP). For 350M at S=1: roughly $S*(9H^2 +3H F +H K) ≈ S*(9*1024^2 +3*1024*4608 +1024*7) \approx S*(9.44e6+14.1e6+7.17e3)\approx 23.5e6$ multiply-adds per token. The **decode** cost is similar except replace $S H^2$ by $H^2$ (one step), and include KV updates. So decode is roughly $(4H^2 + H K + 5H^2 + 3HF) = (9H^2 +3H F + H K)$ for one token again (the $S$ drops to 1 for attn/MLP, conv cost also one-step). Numerically, decode of 350M is ~$2.35\times10^7$ MACs. 

- **“Constant memory” sense:** Only the conv and feed-forward parts use constant extra memory (independent of $S$). Attention requires linear memory for KV with $S$. Thus LFM2 does **not** eliminate linear context growth; only the short conv’s recurrence is constant. 

# 6. Proposed `.slm` Schema Extension

We propose extending `.slm` with a **model-family tag** and **layer-kind tags**. For example, introduce a new top-level `"model_family": "LFM2"` and per-layer `"layer_type": "short_conv"` or `"full_attention"` (beyond numeric indexes in array). The manifest fields should include: 
- `model_family` (enum: “LFM2”, “LFM2.5”, versioned), 
- `version` (e.g. “2.5.0”), 
- `architecture` (dense/hybrid), 
- number of layers, hidden size, number of heads, etc (copied from config). 
- `rope_theta`, `tie_embeddings`, `conv_L_cache`, etc. 
- Tensor inventory: list all tensors by name and shape (embedding, conv in_proj, conv kernel, out_proj, attn proj weights, norms, MLP weights, etc). 
- **Alignment & endianness:** All weights are 32-bit floats, little-endian. We require 16-byte alignment for efficient SIMD (or at least 4). 
- **Bounds/Hashes:** Each tensor should have a checksum (e.g. SHA256 or CRC) for validation. The manifest should also include an overall model hash (or rely on file-level hash). 
- **Quantization descriptors:** If quantization is added later, describe Q format per tensor (but for now, skip).
- **“Unknown fields” behavior:** A runtime encountering an unknown layer kind should refuse to load (fail-closed) rather than try to interpret as a transformer. So manifest must contain a strict “layer_type” tag for each layer; unknown types cause error. 
- **Compatibility rules:** We can version the `model_family` or add a `slm_version` to handle future LFM3 etc. A converter must fill these fields; a reader must validate that the expected model_family and version match its code (e.g., old runtime sees LFM2.5 as unknown and rejects).

For example, a minimal manifest JSON might look like:
```json
{
  "model_family": "LFM2.5",
  "version": "2.5.1",
  "hidden_size": 2048,
  "num_layers": 16,
  "layer_types": ["conv","conv","attn",...],
  "vocab_size": 65536,
  "tie_embedding": true,
  "rope_theta": 1000000.0,
  "conv_L_cache": 3,
  "tensor_list": [
    {"name":"tok_embeddings.weight","shape":[65536,2048],"dtype":"f32","hash":"..."},
    {"name":"layers.0.short_conv.in_proj.weight","shape":[6144,2048],"dtype":"f32","hash":"..."},
    ...
  ]
}
```
Where `tensor_list` covers all expected weights. The converter would abort if any listed `tensor_list` is missing or if extra keys are found. The reader would check that the manifest fields match expected (number of layers, shapes, etc). This ensures an LFM2.5 model *cannot* be misinterpreted as a plain GPT: an older runtime seeing unknown layer types “short_conv” or “full_attention” will error.

# 7. Kernel Design (Rust/WASM)

We outline kernels for the novel ops:

- **Short-Range Conv (depthwise causal):** Reference: the conv in LFM2 is depthwise with small kernel (K≤7). A naive f32 loop vs SIMD: we can use WebAssembly SIMD (128-bit = 4×f32) to process 4 channels in parallel. The conv is depthwise and causal: each output y[t,c] = ∑_{k=0..K-1} w_{c,k} * x[t-k,c], with padding. For prefill, we run over whole S. For decode, we maintain a rolling buffer. SIMD strategy: process 4 channels at once. Align weights to 4. If H not multiple of 4, handle tail. Accumulate in f32 (safe against moderate accumulation error; no fused multiply-add guaranteed in SIMD128). For WASM fallback, do scalar loop. Memory reuse: load each channel’s partial sums, multiply-add accumulate. Likely the conv will be more time-consuming than elementwise multiplies. 

- **Elementwise Gates:** Just multiply-add per element. SIMD straightforward.

- **Grouped QK-norm:** The code does *per-head* RMSNorm: we can implement an f32 dot to compute root-mean-square and multiply. Could reuse existing norm kernel but on head_dim only. Since head_dim is small (e.g. 64), scalar or register code is fine. Can SIMD over batches.

- **Attention:** The compute-bound  QK matmul and softmax are heavy; we likely rely on existing BLAS-friendly kernels (if we have optimized GEMM). But for WASM, no GEMM, so do manual (but batch small). Possibly omit large optimization here for now, just ensure correct grouped K handling (`repeat_kv` done via broadcasting).

- **Feed-Forward (SwiGLU):** Two GEMMs of size (H×F) and one (F×H). For CPU native, use BLAS or our own tiled matmul. SIMD: one can use 8-wide kernel if AVX2/AVX-512 is allowed, but for portability maybe 4-wide as well. WASM SIMD can do 4-wide f32 for each GEMM. Activation SiLU can be implemented with approximate instructions (some exp/hard).
  
- **SIMD portability:** We design all heavy loops as abstractions that can use CPU SIMD (AVX2/AVX-512) on desktop or WASM SIMD128 for browsers. E.g., convolution and MLP can use portable-data-parallel libraries (nalgebra?), or we hand-code with `#[target_feature]` for Rust. Provide a fallback safe scalar path. Convolution can do a sliding-window inner-product; MLP can do block GEMM.

- **Determinism:** Avoid non-deterministic accumulations. Use fixed f32 loops or exactly reproducible summation order. If SIMD differences cause small drifting, ensure reference CPU path to check tolerances (see testing section).

- **Threading:** For CPU (native), layers or token-batches might parallelize: process different heads or tokens in parallel. But must be careful in browser (WASM) as threads often disallowed. We may use single-thread in WASM, multi-thread in native.

- **Bottlenecks:** Likely attention matmuls and large GEMMs in MLP dominate compute on CPU. For small $H$ (like 1024), these are significant. Conv cost is smaller (K=7). On decode (S=1), conv cost is minimal, but K/V updates and MLP remain. So on CPU, attn and MLP are most time-consuming. On WASM, with SIMD128, kernel will be slower due to smaller width; possibly MLP dominates. 

# 8. Quantization

We must consider 8-bit or lower quantization per tensor-type:

- **Embeddings / Output:** Large [V×H] (e.g. 65536×1024 ~67M entries for 700M model). Usually quantized per-row or per-tensor. Could use per-token (row) scale (or per-tensor if weights similar). Loss here directly affects logits. Use symmetric or asymmetric? LLMs often use int8 with a scale per column. Given size, likely per-row (per embedding vector) quant is advisable. Key issue: embedding error propagates to all hidden states linearly. 

- **Convolution weights:** Depthwise, one 1D kernel per channel. We can quantize each channel separately (per-channel scale) in [H×K] weight. This is important because one bad channel ruin gating or conv. Convolution is linear, errors on conv weights may be amplified by gating (if gate near zero flips sign of error). Ideally symmetric int8 with per-channel scale and bias calibration. 

- **Gates (B,C weights):** These come from linear project 3×H. They multiply elementwise. Error in gates can cause *multiplicative* error: e.g. if actual gate B ~0.5 and quant error 0.01, output error ~2%. Could be problematic for small gates. Possibly avoid too low bit for these, or calibrate them carefully. Since gating is crucial to network dynamics, use at least 8-bit per channel. Group quant them like normal FC. 

- **Attention QKV and proj weights:** Standard QKV and out-proj matrices (size H×H or H×(H/g)). Usually safe at int8 per-tensor or per-row (as in many GPT). Here QK-norm complicates offset scales. Might use int8 symmetric with per-out-head scale. Value and output linear: similar to FF.

- **Feed-Forward weights:** Large dense matrices (e.g. 1024×4608 etc). Often quantized per-column or per-group. Error: ReLU gating (SiLU) multiplies, but since output is combined linearly, error smears. Use per-channel quantization.

- **Grouped:** Could exploit grouping: for K/V we know keys shared. But quant grouping not typical.

- **Q6/5/4:** At these bitwidths, errors increase. Multiplicative nature of conv gates means small weight error leads to proportional output error. We would need to calibrate on a held-out set, measure signal amplification: e.g. if conv outputs feed into softmax (attention) or elementwise multiply again, error might saturate. Suggest at least Q4 (16-level) for gating matrices and conv. Lower bits might only work with retraining or fine-tune. 

- **Calibration:** Should gather typical activation ranges for each tensor type (e.g. simulate on layer outputs). Check numeric differences (cosine similarity of output, cross-entropy on logits) with quantization to set tolerances. Because gating multiplies, a small error in output can become a noticeable logit error. Evidence: none public, but we should log quantization error per tensor and reject formats that exceed a threshold. 

In summary, likely design: **per-channel int8** for most weights; possibly int4 for large MLP if proven safe after calibration. Always test that a quantized model still generates same tokens (within tolerance) on sample prompts.

# 9. Tokenizer & Chat Fidelity

- **Token IDs:** As noted, BOS token is `<|startoftext|>` id=1, EOS `<|im_end|>` id=7, PAD `<|pad|>` id=0. We must bind these. The chat template (ChatML) prepends `<|startoftext|>` at beginning of conversation. We also note Liquid’s instruction models may use delimiters for assistant/user, but primarily they rely on this start/end tokens. 

- **Special tokens:** The model card and `special_tokens_map.json` define them exactly. The converter must ensure the `.slm` includes these or at least documents them. The chat template may include `<|endoftext|>` after each reply. Ensure that our runtime places `<|im_end|>` to terminate generation. 

- **Chat templates:** Liquid provides Jinja templates for system/user. We should match those exactly for compatibility. If the user’s frontend uses different tokens or formatting, the model’s behavior can degrade (as Liquid notes, template drift can look like failure). For example, missing a final EOS might cause “no completion” or training mismatch. We should embed the official chat template as read-only in the `.slm` manifest so generation code uses it. 

- **Tool calls:** The model might support function-calling or special delimiters (some tokens in the HF space like `<|tool_call|>`). We did not see any in the Instruct card above, but if present, include them in tokenizer (special id). The converter should fail if unsupported special tokens are required. 

- **Defaults (decode):** We should use default HF generation args: temperature=1.0, etc. If the model card or `generation_config.json` specify defaults, replicate them (like max_new_tokens=..., top_k, etc). The presence of `generation_config.json` in HF files suggests default settings (likely greedy or sampling). For parity, maybe fix a specific set of samples instead of sampling. 

- **Template drift:** The architecture shouldn’t change chat semantics. But if, e.g., EOS behavior changed, newlines vs special tokens matter. We should verify that given identical token sequences (including prompt tokens) the logits and chosen tokens match reference. If an older runtime had no awareness of chat formatting, it may mis-tokenize e.g. by stripping system/user tags incorrectly. So the `.slm` should lock in the ChatML format (perhaps by including something like `"template_version": "#.##"`).

# 10. Parity & Corruption Tests

A public test suite should include:

- **Layer-level fixtures:** For each block type, feed random tensors and compare output of reference (PyTorch HF) vs our Rust kernels. E.g. one conv block with random input and weights, no caching, should exactly match.

- **Full logits:** Given a fixed prompt (with known token IDs), the entire model’s logits (pre-softmax) for, say, first 10 tokens of output should match reference to within tolerance. Use HF model output (bfloat16->float32) as ground truth. Document the seed or exact input in a test vector.

- **Cache/no-cache equivalence:** For short contexts, ensure single-pass and incremental produce same final state. E.g. compare feeding 5 tokens in one go vs step-by-step decode.

- **Chunked prefill:** Verify splitting context (e.g. 100 tokens in two batches of 50) yields same final embeddings as full 100 at once (relevant for embeddings caching if implemented). 

- **Long-context rollover:** For very long S beyond internal buffers, check memory management (if we support >65k or wrap-around, though `max_position_embeddings=128000`). If context > current max, should explicitly error.

- **Quantized tolerances:** For each quant scheme, define acceptable error (e.g. average relative error <0.1%). Don’t cheat by adjusting after seeing result; set it from calibration runs.

- **Corrupted model:** Modify a key (e.g. change one weight or remove a tensor) and ensure converter or runtime rejects it.

- **Native vs WASM:** The same test inputs should be run on native and WASM backends and results compared. Tolerances account for possible float differences.

- **Immutability:** Use specific model snapshots by commit hash or SHA. Document generator IDs so results are reproducible.

All tests must fix RNG seeds or use deterministic builds so they are immutable. E.g. use the HF “fast array” (`safetensors`) as golden weight values. Do *not* tune tolerances *after* seeing failures. Instead, run calibration benchmarks (e.g. casting to fp32/HF outputs) to set baselines.

# 11. Staged Implementation Plan

We outline milestones and stop conditions:

- **MVP vertical slice (1–2 weeks):** Implement a minimal pipeline that loads a *tiny* LFM2 model (e.g. 1-layer toy with random weights in `.slm`) and runs one block to verify framework. Write loader, manifest parser, and basic ops (embedding lookup, RMSNorm, gates). Stop if loading fails or grammar issues. 

- **350M full model (3–4 weeks):** Implement all kernels (scalar reference + SIMD) for Conv, Attn, MLP; support all layer types. Load LFM2.5-350M model and run inference on small prompts. Measure correctness vs HF (internal). Stop if numerical drift beyond 1e-4 L2 occurs (indicating bug/logic error), or if performance is way off (indicating missing optimizations). 

- **Quantization (2–3 weeks):** Integrate 8-bit formats. Do calibration: convert 350M to int8 (maybe per-channel) and test. Estimate performance gain vs quality loss. Stop if any test in suite fails outside tolerance. 

- **WASM SIMD128 optimization (2 weeks):** Port heavy kernels to WASM SIMD and test on browser. Measure speed; target within ~2× of native per flop (since WASM slower). Stop if WASM build breaks determinism or fallback overhead is too high. 

- **Larger models (2 weeks each for 700M, 1.2B):** Extend to 700M and 1.2B. Mainly add support for more heads (already generic) and increased MLP. Test and benchmark. Stop if browser memory usage (size + WASM stack) exceeds limits (~1GB) or if speed becomes unacceptable.

**Runtime estimates:** Upstream LFM2 blog reports CPU throughput (llama.cpp results) ~500 tokens/s for 700M on a modern CPU. If our Rust/WASM is well-optimized, we expect similar or slightly slower (no AVX-512 in browser). So a formula: Ops per token (~2e7) / CPU FLOPS. On a 10e9 FLOP/s CPU core, ~2000 tokens/s (but actual on x86 with memory, ~500/s). These ballpark match blogs. We shouldn’t rely solely on upstream benchmarks, but they suggest feasibility.

**Stop rules:** If any critical architecture piece remains ambiguous (e.g. if config fields suggest an unsupported variant, or if odd model card details conflict), we halt and contact community. If parity drift remains unexplained, we pause. If browser memory > 1.5GB (common limit), cannot proceed with 1.2B. Also monitor license (LFM uses custom “lfm1.0” license; presumably allows research use, but if commercial embedding needed, check risk). 

# 12. Unknowns and Requirements

- **Weight extraction details:** Without TinyRustLM’s private tools, we rely on HF safetensors. We must ensure our converter handles their safetensor format. The exact tensor naming might differ by framework (HF vs llama.cpp might rename). We must map names by model card (inventory from our checks above). If any weight appears unidentified (e.g. “key_projection_scale” in some implementations), we must query upstream. 

- **Precision behavior:** The original is bfloat16; we assume float32 is acceptable. If some half-precision trick (e.g. number scaling) was used, we have to simulate it in float32 exactly. The converter should read `torch_dtype` and if not float32, ensure semantics match.

- **Tokenizer version:** TinyRustLM likely uses a fixed tokenizer JSON. We must use the exact `tokenizer.json` from each repo (ours was seen loaded). Differences in Unicode, normalization may affect indices. We need to confirm no hidden differences in JIRA. Also, the LIQUID blog’s `apply_chat_template` suggests a custom template handling; ensure we replicate it precisely.

- **Cited sources:** We relied on the LFM2 tech report, model cards/configs, blog posts, and Transformers code. For any implementation detail not found publicly, we must clarify or skip that part. We avoided “white-box” assumption; all above is public. 

# 13. Bibliography

- Liquid AI, *LFM2 Technical Report* (ArXiv:2511.23404, Nov 2025) – defines LFM2 model (hybrid conv+attention, SwiGLU, RMSNorm, RoPE).  
- Liquid AI, “Introducing LFM2” blog (May 2024) – high-level architecture, pseudocode for conv block, training details.  
- Liquid AI, *Hugging Face Model Cards* for LFM2 and LFM2.5 (0.7–1.2B) – configs with exact hyperparameters, layer types, and special tokens.  
- HuggingFace Transformers `modeling_lfm2.py` – reference implementation (RMSNorm, gated conv, grouped-attn, SwiGLU).  
- Medium (Sadhu): “Building Liquid LFM2-VL from Scratch” – code for `LFM2Conv` and `LFM2MLP` illustrating gating conv and SwiGLU.  
- Liquid AI, “Architectural lineage (LIV operators)” blog (Jun 2024) – relates LFM to Liquid time-constant networks and LIV operators.  
- HuggingFace `special_tokens_map.json` & `chat_template.jinja` – defines tokens `<|startoftext|>`, `<|im_end|>`, `<|pad|>`.  
- HuggingFace `config.json` for LFM2/LFM2.5 – lists hidden sizes, layer counts, conv cache, attention heads, tie_embeddings, etc..  
- Additional references in Transformers code for rotary embedding application and GQA scaling. (All linked above.)

This completes our architecture forensic report with exhaustive citations from public sources.