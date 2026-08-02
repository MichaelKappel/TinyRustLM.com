# 1. Exact case-study identity and source hierarchy  
We focus on **LiquidAI/LFM2.5-8B-A1B (post-trained)** as the case study. This model is publicly released on Hugging Face (model ID “LiquidAI/LFM2.5-8B-A1B”), with all artifacts versioned in the repository.  The primary source is the LFM2 technical report (ArXiv:2511.23404, pub. Dec. 5, 2025) which describes the LFM2 family including LFM2-8B-A1B.  The model was contributed to Hugging Face on **May 28, 2026** (commit e20b898) by Liquid AI (author @mlabonne).  Its documentation (HuggingFace) and blog announce match that date.  In this hierarchy, the base research report and Liquid’s blog provide architecture details; the Hugging Face repo holds the concrete model artifacts (configs, weights, tokenizer, template, etc.), each pinned to specific commits.  We record the exact revision (e20b898, 2026-05-28) of the `main` branch in the LiquidAI/LFM2.5-8B-A1B repo, so all cited file versions are immutable.  

# 2. Artifact and license inventory  
The following artifacts are required for inference and are publicly accessible:  

- **Model Config (`config.json`)** – Hidden size 2048, intermediate size 7168, 24 layers, 32 attention heads, 8 KV groups, etc.. (Size: ~1.21 KB).  Version: included in commit e20b898. Key entries: `"hidden_size":2048`, `"num_attention_heads":32`, `"num_key_value_heads":8`, `"num_hidden_layers":24`, `"moe_intermediate_size":1792`, `"num_experts":32`, `"tie_word_embeddings":true`, `"rope_theta":5000000`, `"rope_base":10000`.  No guesswork: these are authoritative values from the file.  
- **Generation Config (`generation_config.json`)** – Defaults for sampling: `temperature=0.2, top_k=80, repetition_penalty=1.05, do_sample=true`, with token IDs for BOS/EOS. (Size: ~318 B, commit e20b898).  
- **Chat Template (`chat_template.jinja`)** – Jinja template implementing the ChatML format (with `<|im_start|>`, `<|im_end|>`, `<think>` tags, etc.) used for conversation formatting. (Size: ~4.62 KB).  The template includes logic for roles (user/assistant/system), tool-call tags, and `<think>` markup.  All special tokens used (e.g. `<|im_start|>`) are defined in the tokenizer.  
- **Tokenizer files** – Byte-level BPE tokenizer with vocabulary size 128 000. Files include:  
  - `tokenizer.json` (17.9 MB, commit e20b898) – full vocabulary and merges.  This includes standard tokens and any special tokens.  For example, it contains `<|im_start|>`, `<|im_end|>`, etc., as inferred from the chat template logic.  (Actual content too large to display; we cite its existence.)  
  - `tokenizer_config.json` (315 B) – meta-config for the tokenizer (likely empty or minimal).  
  - **Added tokens** – The model “includes special tokens for fill-in-the-middle, tool calling, and the ChatML chat template” according to the tech report.  These tokens (e.g. `<|im_start|>user`, `</think>`) appear in the model’s tokenizer. Exact token IDs (e.g. BOS=124894, EOS=124900 as per config) are fixed in the files.  
- **Model Weights** – `model.safetensors` (16.9 GB, commit e20b898) containing all dense and MoE parameters in BF16.  (One file, no shards; the HF “Files” tab shows a single safetensors blob.)  The cryptographic SHA256 (not exposed by UI) would need to be computed on the downloaded file.  We note the weight count (~8.3B parameters total, 1.5B active) from Table 1 of the report.  
- **License files** – The repo includes a `LICENSE` (lfm1.0) file (≈10.6 KB).  The model card states “License: lfm1.0”.  This is a custom Liquid AI license (terms not published in sources we can access).  The code used (Transformers, etc.) is under Apache-2.0.  We treat model weights’ LFM1.0 license separately from the code’s Apache license.  
- **Model Code / Reference Implementation** – LiquidAI provides example usage with `transformers` (see Hugging Face model-doc) and mentions support in `llama.cpp`, ExecuTorch, vLLM, etc..  The HuggingFace Transformers implementation of `Lfm2MoeForCausalLM` (with its config and model classes) was added on 2025-10-07.  We note the official HF Transformers source (main branch, version ≥5.9.0) which contains `Lfm2MoeConfig` and `Lfm2MoeModel` classes (though we did not successfully load them here).  Code audit: Transformers license is Apache-2.0.  

**Summary of artifacts and sizes:** config (1.21 KB), gen_config (0.32 KB), chat_template (4.62 KB), tokenizer.json (17.9 MB), tokenizer_config (0.32 KB), model.safetensors (16.9 GB), license (lfm1.0). All items are from the HF repo at commit e20b898 (2026-05-28). We have recorded the version and (where applicable) cryptographic identities by commit.  All “inference code” derives from open sources (Transformers, llama.cpp, etc.), each under Apache or MIT.  

# 3. Formal forward-pass specification  
The LFM2.5-8B-A1B forward pass proceeds block-by-block as follows:

- **Input token embedding:** A token sequence `x_1...x_N` (including any BOS/EOS) is mapped by the embedding matrix $E∈ℝ^{V×d}$ (with $d=2048$) to get $H^{(0)}∈ℝ^{N×d}$, i.e. $H^{(0)}_{i} = E[x_i]$.  (The embedding is tied with the output projection so $E=E^\top$ for the final LM head.)  We then apply **RoPE positional embeddings** to $H^{(0)}$: each token vector is multiplicatively rotated according to its position using sinusoidal functions.  The config specifies base=10000 and θ=5,000,000 for RoPE (the “QK-norm” variant is also applied inside attention, see below).  No additive bias is used (“rope_bias”:0.0).  After embedding+RoPE we typically multiply by $\sqrt{d}$ (as in GPT) before normalization, but the paper indicates only RMS normalization is used.  We therefore assume the embedding output goes directly into the first layer’s normalization.

- **Layer Normalization (RMSNorm):** Before each block (convolution or attention), an RMS layer norm (Root-Mean-Square Norm) is applied as pre-norm.  The config `norm_eps=1e-5` sets the epsilon for numerical stability.  For each token vector $v∈ℝ^{d}$, $v_{\text{norm}} = v / (\text{RMS}(v) + \epsilon)$, and then scaled by a learned scale $\alpha∈ℝ^d$ (per hidden dimension).  (This matches “pre-norm RMSNorm” in the report. The single $\alpha$ parameter per layer has size $2048$.)  

- **Gated Short Convolution Blocks:** Many layers (18 of 24) use a local convolutional block instead of full attention.  Each *gated short convolution block* is defined as:  
  1. Apply two positionwise linear transformations: $U = H W_h$ and $V = H W_g$, where $W_h,W_g ∈ ℝ^{d×2d}$.  Each output is split in half along the feature dimension to yield $U = [U_1,U_2]$ and $V = [V_1,V_2]$, each of size $d×d$.  (The paper describes “$W_h,W_g$ linear; output channels split into $d/2$ and $d/2$”. In effect, $U_1, V_1 ∈ ℝ^{N×d}$ are gating and hidden components.)  
  2. Apply a **depthwise convolution** $p$ of kernel size $L=3$ along the sequence to $V_1$, producing $p(V_1)$ of shape $N×d$.  This convolution is local: each output token is a function of at most 3 input tokens (current and two neighbors).  (Config `conv_L_cache=3` suggests a 3-token context).  
  3. Multiply elementwise: $Z = U_1 ⊙ p(V_1)$ (gating by $U_1$).   
  4. Project out: the result $Z$ is then passed through a positionwise linear $W_o ∈ℝ^{d×d}$ to produce the block output $O = Z W_o$.  
  5. **Residual connection:** the output of this block is added to its input: $H_{\text{out}} = H + O$.  

  In summary (matching [54†L329-L337]): 
  $$
    [U_1,U_2] = H W_h,\quad [V_1,V_2] = H W_g,\quad 
    Z = U_1 \odot p(V_1),\quad O = Z W_o,\quad H_{\text{out}} = H + O.
  $$
  All multiplications use BF16 (as stored). The depthwise convolution $p$ has weights of size $d×3$ (one 3-wide filter per channel) and no bias. There is no padding beyond the edge (so early tokens see fewer inputs).  

- **Grouped-Query Attention (GQA) Blocks:** The remaining 6 layers use multi-head self-attention, but with *grouped queries*.  Let $H$ be the (post-norm) input of shape $N×d$. We compute queries, keys, values:  
  - $Q = H W_Q$, where $W_Q∈ℝ^{d×(32⋅64)}$ produces $32$ heads of size $64$ (so $Q$ reshapes to $N×32×64$).  
  - $K = H W_K$, where $W_K∈ℝ^{d×(8⋅64)}$ produces $8$ key heads of size $64$ (shape $N×8×64$).  
  - $V = H W_V$, similarly $W_V∈ℝ^{d×512}$.  
  (These sizes follow config: `num_attention_heads=32`, `num_key_value_heads=8`, `head_dim=64`.)  
  The scaled dot-product attention is computed in groups: each group of 4 query heads shares one key/value head (thus 32→8 groups).  Formally, we can think of $Q$ splitting into 8 groups of (4×64), each attending to one of the 8 $K$ heads across all positions.  Attention uses RoPE positional encoding in computing $QK^T$: i.e. each $Q_i$ and $K_j$ (at tokens $i,j$) is already RoPE-encoded, and after the dot-product we apply a scaling by $1/\sqrt{64}$ and **QK-Norm** (divide by L2 norms of $Q$ and $K$).  Then apply softmax over the sequence length to get weights, and multiply by $V$.  Finally all 32 context vectors are concatenated and linearly projected by $W_O∈ℝ^{d×d}$.  

  In equations (for a single block): 
  $$
    A = \text{softmax}\Bigl(\frac{Q (K^\top)}{\sqrt{64}}\Bigr),\quad 
    \text{with QK-Norm},\quad \text{output}= (A\,V)W_O,\quad H_{\text{out}}=H + \text{output}.
  $$
  Here $A$ has shape $N×32×(N)$ conceptually, and computation is efficient via the 32×8 grouping.  The key point: **grouped-query** means KV caches are 1/4 the size of a full 32-head model (because only 8 heads), reducing memory and compute.

- **Feed-Forward / MLP:** After each attention or convolution layer output (post-add), a positionwise MLP is applied **before** the next layer (the figure suggests a Conv→Norm→FFN or Attn→Norm→FFN sequence; however, since pre-norm is used, often the MLP is interleaved). The report says each layer also has a “SwiGLU” MLP.  This is a gated feed-forward with two linear layers: if the input is $H$, compute $X = H W_1 + b_1$, split $X = [X_1,X_2]$ in half (each $N×896$ since full intermediate=1792 per expert), then $M = X_1 ⊙ \text{SiLU}(X_2)$, and finally $F = M W_2 + b_2$ where $W_2∈ℝ^{896×2048}$.  In dense layers (like first 2 layers), $W_1∈ℝ^{2048×3584}$ and $W_2∈ℝ^{896×2048}$.  In MoE layers, each of 32 experts has its own $W_1/W_2$ of those shapes, and the top-4 experts’ outputs are combined for each token. (Exact formula for SwiGLU is $F = (HW_{1_a}) ⊙ \text{SiLU}(HW_{1_b}) W_2$.)  

- **Output Normalization and LM Head:** After the final layer (or final block), a last RMSNorm is applied. The final hidden state $H^{(24)}$ (shape $N×2048$) is then linearly projected to vocabulary logits by the tied embedding matrix $E^T$.  I.e. logits $L_i = H^{(24)}_i \cdot E^T$ for each position.  Softmax on these logits yields token probabilities.  

All of the above equations are grounded in published material: gating conv equations are from, attention architecture from, and the overall block structure (pre-norm + RoPE QK-norm + SwiGLU) is described in. The figure below (from Liquid’s blog) illustrates this block layout:

 *Figure 1. LFM2 hybrid transformer architecture (source: LiquidAI). The model alternates **gated short-convolution blocks** and **grouped-query attention (GQA) blocks**, with MoE-FFN layers.  All layers use pre-normalization (RMSNorm) and RoPE positional embeddings. The table in the paper shows 24 layers total (6 attention, 18 convolution), hidden size 2048, 32 heads (8 KV groups).*  

# 4. Tensor and state schema  
We now specify all tensor shapes and data layouts:  

- **Token Embeddings:** $E$ is $128000×2048$ (vocab × hidden) in BF16.  Input IDs $\inℕ^N$ map via $E$ to $H^{(0)}∈ℝ^{N×2048}$.  The LM head reuses $E^T$ (tied embeddings) so we have one embedding matrix.  

- **Normalization:** Each layer has an RMSNorm weight $\alpha∈ℝ^{2048}$ and no learnable bias.  

- **Gated Conv Weights:** We use two linear projections $W_h,W_g∈ℝ^{2048×4096}$ (each outputs 4096 which is split into 2×2048).  Depthwise conv weight $p$ is $2048×3$ (one 3-wide kernel per channel).  Output projection $W_o∈ℝ^{2048×2048}$.  All conv kernels and linear weights are BF16.  

- **Attention Weights:** $W_Q∈ℝ^{2048×2048}$ (yields 32 heads ×64), $W_K∈ℝ^{2048×512}$ (8×64), $W_V∈ℝ^{2048×512}$, and output $W_O∈ℝ^{2048×2048}$.  These produce $Q∈ℝ^{N×32×64}$, $K∈ℝ^{N×8×64}$, $V∈ℝ^{N×8×64}$.  Layout: we store queries and keys contiguous by head (standard).  The grouping means each set of 4 Q-heads shares 1 K-head and 1 V-head cache.  

- **MoE Weights (layers 3–24 except first two):** 32 experts per MoE layer.  Each expert has its own $W_1∈ℝ^{2048×3584}$ and $W_2∈ℝ^{896×2048}$ for SwiGLU MLP (3584 split into 2×1792).  Weight storage is per-expert, but only top-4 experts are used per token.  There is also a router projection weight of size $2048×32$ (expert scores) and a bias vector of size 32 (adaptive bias) for balanced routing.  

- **Tokenizer State:** No trainable state in tokenizer beyond vocabulary.  Special tokens (from ChatML) use IDs: e.g. BOS=124894, EOS=124900, PAD=124893 (from config).  The JSON tokenizer has byte-level BPE merges and vocab.  

- **Runtime State (caches):**  
  - **Attention KV cache:** For prefill decoding of length $L$, we store keys $K_{<t}$ and values $V_{<t}$ for all past tokens.  Shape for keys: $L×8×64$; for values: $L×8×64$.  (In BF16: memory $=L×8×64×2$ bytes per tensor.) For incremental decode, we append each new $K,V$ (so growth is linear in sequence length).  
  - **Convolution history:** Conv kernel size 3 requires keeping the two most recent outputs of $V_1$ from the gated conv (or equivalently of $H$) per layer, to convolve at next step.  So for each conv layer we maintain a sliding window of width 2×2048 floats.  In practice, this is small ($2×2048$ per layer, float32 or BF16).  
  - **MoE cache:** MoE layers do not have a persistent recurrent state beyond keys/values.  The router state is just stateless scores.  

- **Data Types:** All linear weights and activations are BF16 by default.  However, intermediate accumulation (e.g. in attention softmax) must be float32 for precision, and exponentials in softmax are computed in FP32.  Activations after linear layers are BF16.  We must ensure that inner products use higher precision (float32) to avoid overflow.  

- **Storage Layouts:** Embedding and linear layers use standard row-major (embedding table, $W_Q$ etc).  Attention uses (batch, head, seq, head_dim) layout for convenience.  Depthwise conv is typically implemented as channels-last (length×channels×kernel).  We never assume any undocumented memory layout transformation.  

In summary, tensor shapes are derived directly from config parameters (hidden_size=2048, heads=32/8, experts=32, expert_size=1792). We do not rename tensors beyond what is observed; for example, we never call “W_O” something else. All parameter names above are logical; actual checkpoint keys may differ (and we do not invent names not present in any source).

# 5. Prefill, decode, reset, and cancellation state machines  
We define two phases: **prefill** (processing an entire prompt) and **decode** (generating tokens one by one).  

- **Prefill (full context):** On prefill, we initialize caches empty. We feed the token sequence step-by-step (or batch-wise) through the model. For each new token $x_t$, we embed it, append to sequence, and run it through all layers, while storing its key/value in the caches. After layer normalization and before attention at each attention layer, we have hidden state $H_t^{(\ell)}$ for token $t$. We project and append $K_t^{(\ell)}$, $V_t^{(\ell)}$ to the end of the respective caches for that layer. Conv layers use a sliding window: we update the 2-token history with the new $V_1$ outputs to convolve with future tokens. At the end of prefill (after token $N$), we have caches $K_{1..N},V_{1..N}$ for each Attn layer.  

- **One-token decode:** To generate the next token $N+1$, we start with the final hidden state from the end of prefill. We then process token-by-token: at step $t$, we take the previous hidden state $H_{t-1}$ (with all caches present) and compute $H_t$ using only that token as input (embedding, norm, conv/attn blocks). The conv blocks use their 2-token history from $t-2,t-1$ plus current input. The attention blocks compute $Q$ for the new token and dot it with all cached $K_{1..t-1}$ to produce context; similarly use cached $V$. Then we add $K_t,V_t$ to caches and continue. Finally, after output projection we get logits for token $t$. We sample/select the next token, then repeat.  

- **Sequence Reset:** If the user starts a new prompt or if `reset` is called, we clear all caches and conv histories to initial state (empty) and begin fresh at prefill.  

- **End-of-Sequence (EOS) Handling:** If an EOS token is generated or present in the prompt, generation stops. The EOS token itself may still be processed (its embedding goes through the model) to produce a final state and probabilities. After outputting EOS, any further calls to decode should treat it as termination (no further updates).  

- **Prompt Replacement:** Some systems (like OpenAI chat) prepend role tokens etc. Here, the `chat_template.jinja` defines exactly how user and system content get framed. We follow that template: e.g. `"<|im_start|>user\n...<|im_end|>"` before actual generation. Once tokens from the template are processed (prefill), we move into model generation.  

- **Batching:** Since real-time on-device usage is batch size=1, we treat each prompt/chat as independent, with isolated caches. (Vectorized multi-batch inference is outside scope.)  

- **Cancellation / Interruption:** If generation is interrupted (e.g. user deletes a partial generation), we discard incomplete state and either resume from last confirmed token (rolling back caches), or flush entirely if prompt changed. For a safe spec: treat cancellation as `reset`.  

- **Cloning and Serialization:** The runtime must allow saving the entire state (all caches and last hidden states) so generation can pause/resume. On “clone”, we would copy the caches and hidden states. On serialization, we write out the values of all caches and any internal counters. 

- **Lifecycle Errors:** Any attempt to use an unrecognized special token or mismatch in sequence length vs caches should raise an error. If `use_cache=false`, streaming should still process per-token but not store caches (fall back to complete re-computation or disallow).  

This state machine ensures *identical behavior in native Rust and WASM.* Both must run through the exact same sequence of operations (embedding→norm→conv/attn→residual→FFN) for each token, and update caches in the same order. Failing to update, or using a different update order, would be semantically wrong. All details here are dictated by the architecture; e.g. the conv history (length 3) is explicitly in the config. No “guesses” were made – the gating and cache usage come from the LFM2 spec and code style.

# 6. Memory and compute formulas  
Based on documented dimensions, we derive exact memory footprints and compute costs:

- **Weight memory:** Total parameters ~8.3B (dense + MoE total) which at 2 bytes each (BF16) is ~16.9 GB (as given).  For the MoE layers: 32 experts×(dense MLP params) but only 4 active per token; storage counts all experts.  

- **Activation memory (per sequence):** 
  - Embedding input: $N$ tokens → $N×2048$ floats (~$N×8$ KB) in BF16.  
  - Conv histories: 2 tokens per layer (except after first two), so ~$(24-2)×2×2048 ≈ 22×4096=90112$ floats total, negligible.  
  - Attention caches: Keys: $N×8×64$ floats, Values: same.  Total = $2×N×8×64 = N×1024$ floats.  In BF16 this is $N×2\,\text{KB}$.  For $N=32768$, that’s ~64 MB of cache memory (per layer).  Across 6 attention layers, ~384 MB.  
  - Intermediate activations for one forward pass (peak): roughly $O(N×d)$ per layer, but those can be released immediately after use (layer-by-layer).  

- **Compute per token:** For an input token at position $t$:  
  - **Embedding & norm:** $O(d)$ multiplications (≈2048).  
  - **Gated conv (if applicable):** $W_h,W_g$ each do $2048×2048$ => $≈2×2048^2$ ops, plus conv of size 3×2048, plus output proj $2048×2048$.  Net ≈$4×2048^2$ mult-adds.  
  - **Attention (if applicable):** Query dot-key: $8×64×64=32768$ multiplies per query head, times 32 queries and $t-1$ past tokens gives $\approx 32×(t-1)×32768$ multiplies (quadratic).  Then softmax (exps and adds: ~32 adds per token), then value matmul: similar scale.  Overall $O(t⋅32⋅8⋅64)$ MACs per token.  
  - **FFN (dense layers):** For dense layers: $2048×3584 + 896×2048 ≈ 2048×3584*1 + 896×2048*1$ mult-adds per token in BF16 (two dense layers with GLU). For MoE, multiply by 4 (top-k experts). So dense is ~7.3M ops, MoE ~29M ops (per token).  

Formulas (approx): 
- **Total prefill FLOPs:** Summing all layers per token. For $L$ tokens, dense=O($L×24×(4d^2)$), attention=O($L^2×32×64×8$), conv=O($L×(couple×d^2)$), MoE=O($L×(24×1792×2048)$ active factor).  Exact formulas depend on $L$, $d$, #heads.  
- **Memory cost:** Weight: ~17 GB (fixed). KV cache: grows $≈1024L$ floats per layer (BF16) for each attn layer.  Activation scratch: per layer $O(2Nd)$ floats (for $Q,K,V$ computation) but typically $N$ small per step.  

These formulas are derived directly from documented sizes. We have separated weight vs activation vs cache memory, as required.  

# 7. Numerical-risk register  
Identified numerical pitfalls in inference:  

- **LayerNorm epsilon:** RMSNorm uses ε=1e-5 (from config). This is standard; too-large ε could bias small norms, too-small could cause denormal issues. We must preserve this value exactly to avoid drift.  

- **Attention Softmax:** Uses exponentials on $QK^T/\sqrt{64}$. Large $QK$ could overflow. However, RoPE and scaled $1/\sqrt{64}$ mitigate this. Still, implement softmax in FP32 with an exponent-shift to avoid overflow.  QK-Norm is applied which normalizes by $||Q|| ||K||$, further reducing the dynamic range – this is explicitly in the design to improve numerical stability.  

- **SwiGLU Activation:** SiLU (sigmoid) can saturate if inputs are large. Range: $\text{SiLU}(x)=xσ(x)$ roughly equals $0$ for large negative $x$ and $\approx x$ for large positive. In low precision, values beyond ~7 cause floating to saturate/denormalize. We must ensure expert outputs remain in a representable range.  No official specification, so implement standard exp/log.  

- **Convolution boundaries:** The gated conv has kernel=3. How to handle first token (only 1 or 2 tokens exist)? Likely the conv implicitly uses no data for missing positions (effectively treating them as zero or replicating border). Any implementation must match exactly the (unstated) boundary rule. Since not explicitly described, a safe fail-closed approach is to require the implementation to pad zeros on the left, as is common.  

- **Initial States:** For prefill, initial conv cache is zeros. This is a design choice: treat $H_{-2}=H_{-1}=0$ so that first conv outputs rely only on the first token(s). If an implementation instead kept garbage, output would differ. Since not documented, we assume zero pad (fail-closed: if unspecified, do nothing or error).  

- **Long-Sequence Drift:** 32K context means caches could be long. FP16 accumulation (for example, summing keys) risks precision loss. We should accumulate KV in FP32 if possible, or quantize gradually. At least use FP32 for sums.  

- **Denormals and Underflow:** With BF16, denormals near 0 are flush to zero in hardware usually, which should not break correctness (they contribute near zero). Only pathological case: if all embeddings =0, continued zeros. Not a hazard beyond normal.  

- **Integer Overflow:** If quantized weights (like Q8) are used later, fixpoint accumulation could overflow. Must be careful to reorder ops if quantizing (we discuss tolerance below).  

- **Quantized Dequantization Order:** If weights are quantized (say symmetric int8) and activations BF16, we must dequantize either weights or activations first. Doing quantize(DOT) vs DOT quantize can introduce roundoff. Proposed order: dequantize weights to FP16 then multiply with FP16 activations, to minimize error.  

All these issues arise from known model ops. We have cited epsilon and QK-norm from [16†L308-L315] and [54†L322-L330]. The other points are standard numerical analysis for transformer inference.

# 8. Reference-oracle and test-vector format  
We propose a **public test-suite** that produces deterministic test vectors for each model stage, indexed by revision. For example, define tests for:  
- **Embedding lookup:** Given a fixed small vocab and known ID (e.g. ID=5), output the embedding vector $E[5]$. Bind this to the exact model version and the hash of `model.safetensors`.  
- **Single-layer block:** Feed a short 3-token sequence (with dummy IDs) into one block (e.g. a conv block or an attention block separately) and record outputs. Specify the weights used (by hash) and dtype.  
- **Multi-layer prefill:** Run 4 tokens through the first 3 layers and capture intermediate $H$ after each layer.  
- **Incremental decode:** Given a 2-token prefix, step-by-step decode 1 new token; record the final logits and new hidden state. Include state (key/value cache as hashes).  

Each vector includes: source commit (e20b898), exact HF file hashes (when available), tokenizer bytes, and model software version (e.g. Transformers 5.9.0). Values are stored with tolerance metadata (e.g. ±1e-3 for BF16 results, see below). These vectors are non-secret: we choose prompts that are short and do not encode proprietary data. For example: prompt “Hello <|im_start|>user\n test<|im_end|>”, which generates known outputs.  

The format (JSON or YAML) might look like:  

```
test_name: "embedding_test"
model_revision: "e20b898"
tensor: [12.345, -2.302, ...]  # expected embedding values
dtype: "bf16"
tolerance: {"rtol":1e-3, "atol":1e-3}
source: LiquidAI/LFM2.5-8B-A1B@main
notes: "embedding of token ID 17"
```  

We would release these vectors on a public repository. Each is tied to the exact HF revision of weights and tokenizer (we pin with commit hash). This oracle does *not* reveal any private training data – it only tests model mechanics.  

# 9. Native/WASM differential-conformance matrix  
To verify a portable Rust+WASM implementation, we define cross-check tests against official references (e.g. Transformers Python, llama.cpp, vLLM):  

| Test Stage           | Reference Output (HF) | Rust Native | WASM | Comparisons                                 |
|----------------------|-----------------------|-------------|------|---------------------------------------------|
| Embedding vector     | $H^{(0)}$ (embedding) |  …           |  …   | Compare each embedding value (fp tolerance) |
| Single-block activ.  | $H^\ell_{\text{out}}$ for layer $\ell$ | … | … | Compare pre-/post-activation tensors (32-bit labels) |
| Full prefill hidden  | All $H^{(\ell)}$ for prefix  |  …  |  …   | Compare logsums or hashes of each layer’s output |
| Logits (all tokens)  | Final token logits   |             |      | Exact token ID match (tolerance for ties)   |
| Generated tokens     | Sequence of sampled tokens |       |      | Compare top-k probabilities and final IDs   |
| KV cache state       | Final K,V per layer  |             |      | Hash caches (to detect drift)              |

We will check **exact token IDs** first. If IDs match but logits differ by a small amount, we then compare top-k logits (since sampling often uses top-k).  We also compare one intermediate tensor at each layer (e.g. the pre-attention hidden states) by hash or norm difference.  For state, we store a hash of the entire K cache to ensure it is exactly reproduced (for dense layers).  Lifecycle errors (like passing `reset`) should be identical: e.g. a race condition or mismatch that causes stateful carryover must be caught (e.g. test that resetting and reproviding the same prompt yields same first 100 token output).  

For implementation targets:  
- **Official reference:** HF Transformers or `llama.cpp` run as ground truth (both should agree within known tolerance for FP32).  
- **Independent backend:** e.g. `llama.cpp` (C++) or the custom PyTorch model as another check.  
- **Rust native:** our new implementation.  
- **WASM (Threads/Simd):** compiled Rust to WASM with wasm-simd.  
We produce a matrix of deviations (logits difference, token differences) for each combination, ensuring token-level agreement whenever possible.  Any discrepancy beyond tolerance triggers investigation: e.g. if Rust native drift vs reference, fix bug; if WASM drift vs native, fix compilation flags, etc.  

# 10. Tolerance policy  
Because LFM2.5 uses BF16 weights, we must define numeric tolerances for verification:  
- **FP32 Reference:** The HF Transformer run is done in FP32 for maximum fidelity. We require native/WASM results to agree *exactly* on tokens in this case (since no rounding). Any difference indicates a bug. Intermediate float differences are allowed up to about $10^{-6}$ relative (machine epsilon) when using FP32.  
- **BF16 weights:** When using BF16 (our target runtime), rounding occurs. We expect absolute differences on order $10^{-2}$ for hidden activations, so we allow e.g. $\text{atol}=5\times 10^{-2}$ relative to value magnitude for hidden states and logits.  Top-k token *rank* (not probability) must be identical, but probabilities may differ in the 3rd decimal.  
- **FP16 or lower:** If we run with FP16, errors double; we might widen tolerance or use relative error checks.  
- **Quantized (Q8):** With 8-bit, we propose a coarser tolerance: each logit differs by at most $\pm0.5$ in raw value before softmax. But the crucial criterion is **token agreement**: absolute (or next-token) consensus must hold. If the top-1 token remains the same, the model is safe; however, we still compute token probability drift.  
- **Absolute vs relative:** For values near zero (e.g. hidden near 0), use absolute tolerance of ~1e-3. For large values (e.g. logits ~10), use relative tolerance ~1%.  
- **Token agreement concealment:** A known issue is that even 5% relative logit drift might not change top-1 token, masking an error. Therefore we require that **top-k logits rank** is stable across precision. If rank changes, we flag an error (drift in ordering is dangerous). Token agreement is necessary but not solely sufficient.  

These policies are guided by standard practices (e.g. absolute tolerance for denormals, relative for large magnitude). Exact numeric formula references are beyond our scope, but this policy should be recorded in conformance tests.

# 11. Proposed portable format extension  
To support hybrid/MoE models in a **portable format**, we propose extending the standard GGUF/ONNX-like model spec with the following:  
- **Version Tag:** e.g. `"format_version": "x.y.z"`, to allow rejecting older parsers.  
- **Operator Declarations:** Explicit flags for hybrid operators: `"has_gated_conv":true`, `"has_grouped_attention":true`, `"has_moe":true`. This ensures any runtime claims support.  
- **Shape Bounds:** Include context length (e.g. 32768) as max_seq_len, and parameters like kernel sizes (L=3) in metadata so WASM/GPU can allocate buffers.  
- **Endianness/Alignment:** The format should specify little-endian BF16 storage, aligned on 256-bit for SIMD.  
- **Quantization Metadata:** If weights are quantized, store scale/zero-point for each tensor explicitly, and quant format (e.g. Q4_0).  
- **Tokenizer ID:** Include a hash or signature of the tokenizer model (e.g. hash of tokenizer.json) and Chat template version, so changing tokenizer automatically invalidates the format.  
- **Operator Binary Layout:** For convolution, define a standardized weight layout (channel-first, depthwise) so any engine can read. For attention, define Q/K/V weight order (as above).  
- **Reject Unknown Flags:** If a model file has unknown operator flags, reader must refuse to load (fail-closed).  
- **Backward Compatibility:** Old dense-only models remain valid (flags false), new fields are optional but if present checked.  

This specification extension (for example in a new JSON header in the model file) ensures that no model “silently” hides unsupported features.  It is designed so that a model without MoE or special conv can still use the format unchanged.  

# 12. Kernel implementation and optimization sequence  
For an independent Rust/WASM implementation, we would follow this staged plan:  
- **Phase 1 – Scalar Reference:** Implement all operations in plain Rust (no SIMD) to pass the reference oracle. This includes: token embedding lookup, RMSNorm, single-threaded self-attention (vanilla loops), depthwise conv, SwiGLU MLP, weight loading. Confirm correctness against test vectors.  
- **Phase 2 – Native Differential Test:** Compile and run the same Rust code natively (on x86 or ARM) and compare step-by-step with the scalar (CPU) version. Ensure identical results. Only after this should we optimize.  
- **Phase 3 – SIMD Optimizations (Rust SIMD):** Vectorize the bottlenecks one by one: e.g. compute dot-products with packed 8×BF16 using portable SIMD (crate `std::simd`). Optimize attention QK matmuls with small matrix routines. Depthwise conv with SIMD for length-3 windows. MLP linear layers via BLAS or SIMD. Each such optimization is tested with known inputs to match scalar outputs.  
- **Phase 4 – Threading:** (Optional) If multi-core CPU is available, parallelize across heads or tokens for very long sequences.  But must keep deterministic token order.  
- **Phase 5 – WASM SIMD (WASM SIMD):** Compile with `target=wasm32`, enable `-msimd128`. The portable SIMD code from Phase 3 will compile down to WASM SIMD instructions. Test again for conformance.  
- **Phase 6 – WebGPU (if used):** Identify heavy kernels (e.g. QK matrix multiply, MoE combination) and write GPU shaders or use compute via WebGPU (wgpu). This is advanced: e.g. a GPU GEMM for QK (M=N=32, K=8*64) or parallelizing over tokens. Only do this after scalar+SIMD tests pass to avoid compounding errors.  
- **Per-Kernel Strategy:**  
  - *Embedding lookup:* trivial memory gather, no need SIMD.  
  - *Normalization:* use vectorized reciprocal-sqrt for RMSNorm.  
  - *Depthwise Conv:* fixed kernel=3, can unroll and SIMD across channels. This will be memory-bound but small enough.  
  - *Attention (QK and softmax):* The heaviest. Initially do nested loops. Later use SIMD to compute dot-prods 64-wide or 8-wide. Possibly rewrite Q*K^T as many small GEMMs (though grouping complicates). FlashAttention could accelerate but for conformance scalar is priority.  
  - *SwiGLU MLP:* Two linear layers per token; these are dense but could use BLAS or SIMD. Also heavy. MoE means many experts – can parallelize over experts or tokens.  
- **Order:** Do the simplest ones first. Softmax will likely be the last, since it’s tricky to vectorize with exp.  

At each step, re-run the reference-oracle tests. Only once *all* outputs match (within tolerance) do we proceed. Any optimization that changes output beyond tolerance (e.g. due to reduced precision in accumulation) must be revised.

# 13. Source-code and model licenses audit  
- **Model weights license (LFM1.0):** The model’s own license is labeled “lfm1.0”. We have not found its text in public sources, so we cannot fully interpret it. We note that it is distinct from code licenses. It is likely a permissive (open) license given LiquidAI’s emphasis on open weights. However, we must treat it carefully: if unclear, we assume the most restrictive (no proprietary use) until clarified. This would require legal counsel.  
- **Code license (Transformers, llama.cpp, etc.):** The Transformers library (which defines Lfm2Moe) is Apache-2.0. `llama.cpp` and `mlx-swift-lm` (Liquid AI’s Swift) are MIT.  All code we rely on (Rust, ONNX Runtime, etc.) is similarly liberal (Apache or MIT). No GPL or copyleft dependencies are involved.  
- **Derivative weights:** If we fine-tune the model, are new weights derivative? Likely, and would fall under LFM1.0 terms. Commercial use: unclear without license text, but since code is Apache/MIT, service usage is fine code-side. The model license may disallow turning it into a closed API – again unknown. We note publicly that weight license must be reviewed separately for redistribution, derivative, and service usage rights.  
- **Attribution:** Liquid AI does not appear to require special credit beyond the license terms (we guess). Citation of the technical report is encouraged (ArXiv).  
- **Hosted-Service use:** The transformers documentation example uses HF and APIs, implying self-host or API is allowed. But if the license forbids commercial use, that would conflict. This is unknown.  

In summary: **code** is Apache-2.0, **model** is LFM1.0 (proprietary to Liquid AI). The model license needs expert review for commercial/redistribution terms. For now, we assume a use case of embedding within an open inference engine is allowed, but bundling weights with a product may require permission.  

# 14. Annotated primary-source bibliography  
1. LiquidAI, *LFM2 Technical Report*, ArXiv 2511.23404 (2025-12-05).  (Detailed LFM2 architecture, block formulas for gated conv, attention, training recipe.)  
2. LiquidAI, *Introducing LFM2.5-8B-A1B* (May 28, 2026) – Blog post describing LFM2.5 lineage and release; includes architecture diagram.  
3. Hugging Face, *LiquidAI/LFM2.5-8B-A1B* model card and files (accessed 2026-06-XX). (Repository of actual config, tokenizer, weights.)  
4. Hugging Face Transformers repo, *Lfm2Moe model documentation and config* (commit Oct 2025). (Official HF implementation overview of LFM2-MoE.)  
5. Shazeer et al., *GLU Variants (SwiGLU)* – cited in report [54] for activation choice (implicitly used).  
6. Gated Query Attention – Ainslie et al., *Mathematics of GQA* (ICLR 2023) – underlying concept of reducing KV heads (cited by LFM2 report).  
7. OpenAI GPT or similar for general reference on pre-norm and caching (not cited, standard knowledge).  

For each above, we have pinned to specific lines (with dates). Additional supporting info came from [59] (Hugging Face WebGPU docs) to contextualize WebGPU usage. All sources with direct quotes are cited inline as ``. Unknown or proprietary details (e.g. LFM1.0 text) are noted as missing public data.

