# 1. Executive Recommendation and Assumptions  
For a 0.3–1.5B‐parameter student model destined for CPU and browser runtimes, our strategy emphasizes **mixed low-bit weight quantization with FP16/BF16 activations** and careful fine-tuning or distillation at deployment precision.  Empirically, modern PTQ methods (e.g. GPTQ, AWQ) can quantize weights to 3–4 bits with minimal perplexity loss, but **small accuracy gaps can mask degraded conversational behavior**.  We therefore assume access to representative calibration and fine-tuning data (dialogue, code, JSON, etc.) distinct from evaluation prompts.  We recommend a **tiered approach**: begin with a baseline int8 weight (Q8) model (weights quantized symmetrically per‐tensor or per‐channel, activations in FP16) and optionally explore ultra-low bits (int4, int3) only if quality remains acceptable under stringent tests.  The target environment (native CPU + WebAssembly) suggests using hardware-friendly formats: int8 or mixed int4/8 weights with float activations, since pure int4 or int3 kernels may be slow or unsupported in WASM.  **We assume** the model was trained or distilled to match its intended use (e.g. instruction‐tuned dialog) and that any adapter weights or merges have been fused before quantization.  All artifacts (weights, tokenizers, converters, runtimes, etc.) must carry content hashes for end-to-end traceability.  Under these assumptions, we proceed with a comprehensive comparison of quantization methods, sensitivity analysis, calibration protocol, precision trade-offs, numerical and behavioral validation, performance measurement, and provenance tracking, as detailed below.

# 2. Quantization-Method Comparison  
Modern LLM quantization schemes fall into **post-training quantization (PTQ)** and **training-aware** (or fine-tuning) categories.  PTQ methods include *weight-only quantization* and *weight+activation quantization*, with choices of symmetric vs. asymmetric scaling and per-tensor vs. per-channel/group granularity.  **Symmetric quantization** (zero-point=0) is simpler and hardware‐friendly; it is used by GPTQ and AWQ for weights.  **Asymmetric quantization** (nonzero zero-point) can better fit skewed distributions but incurs extra offset storage.  *Per-channel* (per-row/column) quant scales each weight vector independently, capturing variance across channels; *group-wise* quant (as in GPTQ/AWQ) splits each matrix into blocks (e.g. 64–128 elements) to trade off accuracy vs. overhead.  

- **GPTQ (Greedy PTQ)**: A Hessian-driven PTQ that quantizes weights group-by-group using second-order (Gram/Hessian) information.  GPTQ supports 3–4 bit weights (activations kept FP16) with group sizes like 64–128.  It uses *symmetric, per-group* scaling and custom int4/int3 GPU kernels.  GPTQ requires computing blockwise weight covariances (Hessian approximation) from calibration data.  
- **AWQ (Activation-aware Weight-only Quantization)**: A PTQ scheme that identifies “salient” weight channels via their corresponding activation magnitudes.  AWQ scales down a small fraction (~1%) of high-importance weight channels (group quant) so the rest can quantize at 3–4 bits with low error.  It is *symmetric, per-group* for weights (activations remain FP16).  AWQ uses offline activation statistics (calibration data) but no iterative retraining or reconstruction.  It avoids Hessian but requires an extra *scaling* transformation derived from calibration (so that `A*W = (A*diag(scale))*(W*diag(1/scale))`).  AWQ’s code includes efficient int4 linear layers and CUDA kernels, so it works in typical GPU environments.  
- **SmoothQuant**: A *weight+activation* PTQ method. It observes that activations often have long-tail outliers while weights do not.  SmoothQuant pre-transforms the model by scaling down activation outlier channels and reciprocally scaling up corresponding weight channels, enabling full W8A8 INT8 quantization with minimal loss.  SmoothQuant is *training-free* and preserves accuracy while achieving up to ~1.5× speedup and ~2× memory reduction.  It uses *symmetric* quant (per-tensor for W8, per-channel for A8) in practice, with scale factors computed by calibration.  
- **Mixed Precision**: Techniques like *SliM-LLM* or *ResQ* allocate different bitwidths to different layers or blocks based on sensitivity (often measured by a small calibration Hessian).  For example, SliM-LLM uses Hessian approximations to assign more bits to “salient” weight groups.  Such schemes can mix e.g. 2-bit and 4-bit columns within a weight matrix.  This adds complexity but can maximize compression for a given error budget.  

On the **training-aware side**, methods integrate quantization into fine-tuning:  
- **Quantization-Aware Training (QAT)**: Inserts *fake quantize* ops during training so the model learns to adapt to quantization error.  QAT typically uses per-channel scales and straight-through estimators (STE); it can support weight+activation int8 or even int4 (plus batch norm fusion, etc.).  For example, recent PyTorch QAT APIs apply dynamic int8 activations and int4 grouped weights, recovering most of the FP model quality.  QAT requires full fine-tuning compute and careful setup (optimizers, learning rate scheduling).  
- **QLoRA (Quantized LoRA fine-tuning)**: A mixed training method: it **quantizes the base model to 4-bit** (using a novel “NF4” quant type) and *then* trains low-rank adapters (LoRA) on top.  This retains nearly full 16-bit performance even on a 65B model while fitting on one GPU.  QLoRA uses 4-bit symmetric weights (with special NF4 scaling) and 8-bit or 16-bit activations, **requiring double quantization of scales** to save memory.  It demonstrates that one can fine-tune a quantized large model without retraining all weights.  
- **Quantization-Aware Distillation (QAD)**: A student-teacher strategy (recently by NVIDIA) that distills a full-precision teacher into a *fixed* quantized student using a KL-divergence loss.  Rather than simulate quantization during training, QAD simply freezes the quantized student graph and backpropagates from the teacher’s outputs.  It works well across pipelines (after SFT, RL, etc.) and is robust to limited distillation data.  In practice, QAD treats the 4-bit (NVFP4) student as a student; it uses teacher logits and knowledge distillation but no additional architecture changes.

**Comparison:** PTQ (GPTQ, AWQ, SmoothQuant) is fast and simple (no retraining) but needs careful calibration and may miss subtle behavior shifts.  QAT/QLoRA/QAD are more expensive but can close accuracy gaps at deployment precision.  GPTQ/AWQ are *weight-only*, so they don’t quantize activations; SmoothQuant and QAT address both.  Symmetric quantization and per-channel (or per-group) scaling are standard for weights, while activations often use asymmetric per-tensor or dynamic schemes.  Some frameworks (e.g. PyTorch QAT) allow specifying group size and symmetric/asymmetric options.  Critically, **mixed-precision** (layer- or block-wise bit assignment) can outperform uniform quant if done carefully, but requires sensitivity analysis.

# 3. Tensor-Sensitivity and Hybrid-State Analysis  
Empirical studies show that **not all model components quantize equally**.  In transformer-based LLMs, *input embeddings, output (vocabulary) projection heads, attention mechanisms (including softmax/score computations), normalization layers, and gating modules* are especially sensitive and typically kept at higher precision.  For instance, embedding and output-head weights serve semantic distinctions and often degrade performance when coarsely quantized; similarly, the softmax and LayerNorm operations are fragile and usually executed in FP16/32.  Activation outlier channels also dominate error: methods like AWQ highlight that a small fraction of “salient” weights or channels (often <1%) contribute most error, so protecting or re-scaling them yields large gains.  

In summary, **fragile tensors** include: 
- **Embeddings and output head** (high precision needed to preserve fine-grained semantics).  
- **Attention projections and softmax** (the Q/K/V projections and attention scores; softmax is non-linear).  
- **LayerNorm and other normalization** (their scale/shift parameters and operations should remain high-precision).  
- **MoE/GLU gating weights** (if present, gating can saturate and thus requires precision).  

By contrast, many **feed-forward (FFN) linear weights** can be quantized aggressively, especially after smoothing or protecting outliers.  In small models, each FFN typically has two large matrices; one can apply group-wise quantization or even per-tensor 4-bit there with limited loss.  We do not have strong primary-data evidence for *recurrent state transitions* or *convolution kernels* (these depend on specific hybrid architectures like RWKV or convolution-augmented transformers).  However, we note that any **accumulated state** (as in RNN-like recurrence) or *long history memory* (as in Conv1D-based attention) would amplify quantization drift over time, so such components should be carefully examined and possibly kept at higher precision.  All assertions above are drawn from survey analyses and from dedicated quantization studies; any unknown hybrid-specific sensitivities would need local experimentation.

# 4. Training and Distillation Pipeline Comparison  
Key fine-tuning vs. quantization pipelines include: 

- **“Train then PTQ”**: Train (or SFT) the model in float precision, then apply PTQ (e.g. GPTQ/AWQ).  This is straightforward if you have target-task data; it means the quantizer works on a model already fine-tuned for the task.  It requires a calibration set.  
- **“SFT then PTQ”**: Same as above if supervised fine-tuning (SFT) is separate.  For instance, you might instruction-tune (Vicuna-style) then quantize.  The evaluation should use held-out prompts.  
- **“Distill then PTQ”**: First distill a smaller or same-size full-precision model (or perform knowledge distillation to a new student), then quantize that student.  This can incorporate knowledge distillation before PTQ; it requires teacher logits during training (distinct from calibration).  
- **“PTQ then Adapter Tuning”**: Quantize the backbone, then fine-tune low-rank adapters (LoRA) on the quantized model.  This is similar to QLoRA except that QLoRA quantizes beforehand; adapter training effectively adds FP values on top of fixed quantized weights.  It requires training iterations with the quantized graph (akin to QAT) but only on adapters.  It does use the original training data and can incorporate teacher signals if desired.  
- **“Quantization-Aware SFT” (QAT)**: During SFT, embed fake quantization ops so the model **learns under quantization**.  This needs the full SFT data (and maybe even the full original pre-training data for true QAT).  It usually yields the best quantized accuracy but is engineering-heavy.  
- **“Quantization-Aware Distillation” (QAD)**: As in NVIDIA’s approach, first run SFT (and RL, merging, etc.) in full precision, then *distill* into the quantized model using teacher logits.  QAD specifically distills a fully quantized student (e.g. NVFP4) via KL divergence.  It does not require fine-tuning the full model, only the fixed quantized copy.  It needs a teacher and some distillation data (not necessarily the full SFT data).  
- **“Direct Teacher-Student at Deployment Precision”**: Train a student model from scratch or from a checkpoint *at the desired low precision*, using knowledge distillation from a high-precision teacher on-the-fly.  This is analogous to QAT with a teacher; it requires specialized training kernels for low-precision and large data.  

**Comparison:** PTQ-first approaches are easy but may underperform if the model was not originally robust to low-bit quantization.  Adapter-tuning or QAT incorporate quantization noise during adaptation.  QAD leverages teacher signals without retraining all weights.  Experiments show that QAD can recover accuracy across multi-stage pipelines where vanilla QAT fails; QLoRA demonstrates that training a quantized model with 4-bit weights and LoRA adapters can match 16-bit performance.  In practice, we recommend starting with SFT (to get a task-competent model) followed by either PTQ or distillation: e.g. SFT->PTQ or SFT->QAD->verify.  If possible, quantization-aware training or adapter finetuning can be applied to further close any remaining gaps, especially if accuracy loss is observed.  

# 5. Calibration-Data Contract  
**Calibration data** for PTQ must **not include any evaluation/test prompts or their paraphrases**.  We echo Frantar et al.: “to maintain integrity of zero-shot evaluations, we avoid using evaluation data as a source of calibration data”.  Instead, use a separate unlabeled corpus (e.g. a random subset of web text or pretraining data) that is representative of the model’s domain (dialogue, code, JSON, etc.) but does not overlap test cases.  For multilingual or multi-format models, include all relevant modalities: e.g. English dialogue, code snippets, JSON objects, etc.  

Sequence lengths should match the target context length (e.g. 1024–2048 tokens); the cited practice is to use 128 examples of 2048 tokens (≈262K tokens total).  This scale of calibration (tens of thousands of tokens) typically suffices, with diminishing returns beyond that.  If code or structured data (JSON) is in scope, include samples of each to capture different token distributions (e.g. string vs. symbol frequency).  Ensure all data is *unlabeled* and anonymized to avoid leakage of sensitive prompts.  Private in-house prompts or test sets must **never** be used for calibration, lest we inadvertently “train on the test set.”  Each calibration example should be unique (sampling without replacement) and cover diverse topics.  Cross-language or domain coverage is advisable only if the model is intended for that breadth.  

In summary, calibrate on a *publicly-verifiable* set distinct from any held-out evaluation.  Use enough diversity to cover outliers (including rare tokens or formats) without peeking at the evaluation suite.  As a rule, **evaluation data or paraphrases thereof must be strictly excluded**.

# 6. Precision and Kernel Matrix  
We define a matrix of supported precisions, grouping, and quant details:

| Precision | Weight Quant | Activation Quant | Group Size | Scale dtype   | Zero-point policy | Accumulator | Exempted Tensors        |
|:---------:|:------------:|:---------------:|:----------:|:-------------:|:-----------------:|:-----------:|:-------------------------|
| FP16/BF16 (reference) | FP16 (or BF16) | FP16/BF16 | – | – | N/A | FP32 (or FP16) | – (no quant) |
| Q8 (int8)  | int8 (symmetric) | int8 (symmetric/asymmetric) |  1 (per-tensor) or up to 256 (per-channel) | FP32 (or FP16) | symmetric usually (zero at 0), except activations sometimes affine | 32-bit | *LayerNorm, biases, embeddings, softmax* |
| Q6 (int6)  | int6 (symmetric) | int8 or FP16 | e.g. 1 or group 2 | FP32 | symmetric (no zero) | 32-bit | often same as Q8 case; int6 rarely used in practice |
| Q5 (int5)  | int5 (symmetric) | int8 or FP16 | group 32–64 (due to small range) | FP32 | symmetric | 32-bit | same as above |
| Q4 (int4)  | int4 (symmetric, e.g. NF4 or linear) | int8 or FP16 | 32–128 (example: 32 for embeddings, 128 for large mats) | FP16 (often packed exponents) | For NF4: no zero-point (float-like); otherwise symmetric | 32-bit | Typically *embedding and output layers* are kept FP16 if possible, as are LayerNorm and softmax. |
| Mixed (e.g. W4A8) | weight as above; act int8 | see above | — | — | — | 32-bit | — |

Notes on each field:

- **Group Size:**  For int4, NLP libraries often use *group quantization* to improve accuracy.  For example, PyTorch QAT quantized embeddings in groups of 32; GPTQ’s default “3g128” uses group=128.  Smaller groups (e.g. 32 or 64) allow per-group scaling, larger groups (128 or 256) approach per-tensor.  Int8 is often per-channel (group=1 per row/column) or per-tensor.  
- **Scale dtype:**  Quantization scales are usually stored in FP32 for int8, and often FP16 or even int8-coded (NF4’s exponent) for int4.  For example, NF4 uses a 4-bit exponent (with implicit bias) rather than a full float scale.  INT8 scales are typically FP32 to avoid precision loss during computation.  
- **Zero-point policy:**  Weights are typically *symmetric* (zero point = 0) to simplify kernels.  Activation quantization may be symmetric or *affine (asymmetric)* per-tensor/per-token to handle nonzero means.  For instance, “per-token dynamic quantization” (like in XNNPACK) often uses per-token min/max with offset.  Some methods (SmoothQuant) shift activations to remove asymmetry.  
- **Accumulator precision:**  Even if weights are int4 or int8, accumulation (sums) is done in 32-bit (or sometimes 16-bit if extremely optimized).  In practice, hardware GEMMs accumulate in at least int32 to avoid overflow.  
- **Tensors Exempted:**  Common practice (and supported by frameworks) is to keep *fragile parts* in higher precision.  This typically includes **embeddings and output head matrices**, all **LayerNorm parameters**, **softmax/bias** vectors, and sometimes the final *value projections* of attention if not safety.  In hybrid models, recurrent states or gating might also be kept FP16 to prevent drift.  The calibration pipeline should explicitly mark these not to quantize.  

The above matrix is guided by public evidence: e.g. PyTorch’s QAT tutorial shows int8 activations and int4 weights (with grouping); GPTQ documentation shows int3/4 weight kernels; AWQ’s paper confirms W3/4A16 with weight grouping.  When implementing kernels (native or WASM), one must ensure these policies (scale type, zero-point) are consistently applied across conversions.

# 7. Artifact-Size and Runtime-Memory Formulas  
We derive formulae for a model with *P* parameters (in float32) and context length *L* (tokens), quantized to *b*-bit weights and *b<sub>a</sub>*-bit activations.  Assume weights were originally 16-bit (FP16) for parameter count; for simplicity we use bytes:

- **Quantized model size:**  
  $S_{\text{weights}} = P \times (b/8)$ bytes for weights.  Add scale and zero-point metadata: per-group scale (float32 or FP16) costs 4 (or 2) bytes per group.  If group size = *G* (elements), number of groups = $P/G$.  So  
  $$S_{\text{scales}} = (P/G) \times 4 \text{ bytes}$$ (if FP32 scales; use 2 bytes if FP16).  
  Zero-point (if used) is typically per-tensor or per-channel: symmetric quant has no zero-points; affine per-channel has an int8 or int32 per-channel (tiny).  
  Total: $S_{\text{total}} = P\times(b/8) + (P/G)\times(\text{scale bytes}) + O(1)$.  

  E.g. for 1B params, 4-bit weights, group=128, FP32 scales: $1e9*0.5 + (1e9/128)*4 \approx 500e6 + 31.25e6 = 531.25e6$ bytes (~531 MB) plus overhead.  Compare FP16: $1e9*2 = 2e9$ bytes (2 GB).  

- **Runtime memory (CPU/GPU):**  
  Besides storing the quantized model, inference needs:  
  - **Dequantization scratch:** For each matrix multiply, activations or weights may need to be dequantized into higher precision buffers.  If done blockwise, temporary FP16/FP32 buffers of size up to group*L (for activations) or *G* (for weights) are used.  Worst-case scratch = *max(matrix dimension)* × (scale per group). For a dense layer with weight matrix H×D and input D×1, one can dequantize one row (D elements) at a time. Rough bound: additional D×2 bytes (FP16) scratch per multiply.  
  - **Duplicated load buffers:** Some runtimes (esp. WASM) may load compressed weights in blocks; they may hold both quantized and dequantized tiles concurrently.  So memory ~ (b/8)*tile + (original dtype)*tile.  
  - **KV cache / recurrent state:** If caching up to length L, each key/value vector (size H or so) is stored in FP16 per token.  So KV memory ≈ L×H×2 bytes per tensor (Q, K, V all store values per head).  E.g. 2048×2048×2 ≈ 8 MB (for 65k-dim latent, a high estimate).  A recurrent RNN cache (if any) similarly is FP16.  
  - **WASM overhead:** WebAssembly pages are 64 KB each; however, typical data arrays (like quantized weights) will be stored in continuous ArrayBuffers.  Additional JS “views” or typed arrays may duplicate some memory temporarily.  The WASM memory can be pre-allocated (we must account for its limit); any host copies (e.g. copying tokenizer outputs) add extra.  Concretely, a ~100 MB model may take ~110 MB in WASM plus GC overhead.  
  - **Runtime accumulator:** If inference uses 16-bit matrix multiply, accumulator might be 32-bit in hardware registers (no extra RAM).  

A simplified **memory formula**:  
$$ M_{\text{peak}} \approx S_{\text{weights}} + S_{\text{scales}} + S_{\text{activations}} + S_{\text{KV}} + O(\text{buffers}). $$  
- $S_{\text{activations}} \approx L \times H \times (b_a/8)$ bytes (if statically quantizing activations to b_a bits) or FP16 if dynamically scaling.  
- $S_{\text{KV}} \approx L \times H \times 2 \times N_{\text{heads}}$ (if storing two vectors per head per token, at 2 bytes each).  

For browsers, also include the loaded `.slm` code and tokenizer memory.  All these contributions must stay under device limits (e.g. 4 GB on WASM, typically).  

# 8. Numerical Conformance Suite  
To ensure the quantized model faithfully implements the original computations, we define a hierarchy of numeric checks across stages (source framework → merged model → converted artifact → native runtime → WASM):

- **Token-level consistency:** Verify that for a fixed seed or deterministic sampling, the same token IDs are produced by the quantized model (native/WASM) as by the reference (to the extent allowed).  Track at least the top-1 generated token and top-**k** list up to some length.  
- **Logit comparison:** For a set of benchmark prompts (preferably calibration or held-out dev set), record raw output logits (before softmax) from the FP baseline and the quantized model. Compute KL divergence or Jensen-Shannon divergence between the two distributions.  Acceptable drift might be on the order of <1% KL for W4A16; larger drifts indicate fidelity loss.  
- **Top-k rank stability:** For each output distribution, check whether the rank ordering of the top-*k* logits (e.g. top-10 tokens) remains unchanged or mostly unchanged.  Quantization should not reorder critical candidates.  
- **Selected-logit checks:** Pick a few “probe” logits (e.g. frequent tokens or some debug indices) and ensure their quantized values are within a small relative tolerance of the FP values.  
- **NaN/Inf detection:** Run a suite of random and edge-case inputs; ensure no NaNs or Infs appear in outputs or intermediate states.  Quantization sometimes introduces overflows in Softmax or accumulation, so validate that Softmax denominators are nonzero and logs are finite.  
- **State reset:** For autoregressive generation, test that if you reset the context (clear all KV states) the model’s outputs on a repeated prefix match the first-generation outputs. This ensures no hidden accumulation error.  
- **Merge consistency:** If combining weights (e.g. fusing adapter into base), check that the merged model’s outputs (in FP16) exactly match applying base+adapter sequentially.  
- **Software convert checks:** After converting to target formats (e.g. .slm, gguf), re-run a small inference and compare a few logits or tokens to the framework’s result to ensure conversion logic (ordering, endian, zero points) is correct.  

We require a **token agreement metric**: run N random prompts, generate T tokens from FP and quant, and compute the fraction of identical tokens at each position. A high agreement (e.g. >99% for first 10 tokens) indicates conformance.  Also track **perplexity** on a held-out data (WikiText or similar) to ensure the quantized model’s perplexity is near baseline (though we emphasize it is only a coarse check).  Document any systematic drifts: e.g. if quant model tends to avoid certain tokens, that’s flagged.  

These conformance checks should be automated as a test suite.  Only when all numerical checks (exact invariants and small divergences) pass should one consider the quantized artifact correct.

# 9. Behavioral Fidelity and Statistical Design  
Beyond numeric fidelity, we must test that **model behavior remains useful and safe**.  We propose a suite of prompt categories (inspired by LLM benchmarks) to probe model outputs on:  
- **Ordinary Helpfulness:** Solving straightforward tasks (QA, summarization) that the FP model handled well.  For example, factual questions, problem-solving, or routine instructions. Compare accuracy or quality of responses.  
- **Ambiguity/Disambiguation:** Prompts with ambiguous instructions (e.g. “Draw a bank”, with image/text context). Check that quant model’s answers remain as helpful and disambiguating as baseline.  
- **User Preference:** Questions like “I prefer X over Y, why?” or style/ethics questions. Ensure the quant model’s phrasing and reasoning stays aligned.  
- **Source Authority:** Tasks involving citing sources or expertise. Test that the quant model does not hallucinate facts it can’t back.  
- **Unavailable or Refusal:** Queries the model should refuse or say “I don’t know.” Ensure quant model’s refusal behavior and safe-completion policies are intact.  
- **Hostile Memory:** Check that injecting a user’s sensitive or leaked data (like persona or secret) doesn’t cause the model to produce them. The quant model should not amplify or suddenly leak hidden content.  
- **Summaries:** Multi-sentence summarization tasks (news or code). Compare coherency and factuality of summaries.  
- **Rewrites/Paraphrases:** Prompts asking to rewrite or rephrase content. The quant model should produce similar transformations and preserve meaning.  
- **Structured Outputs (JSON):** For tasks that demand valid JSON or code outputs, test that the quant model’s outputs remain well-formed.  For example: “Translate this list into JSON format.” Check JSON validity and content.  
- **Code and Data:** Coding tasks (bug-fixing, short scripts) and data processing prompts (e.g. SQL queries, data extraction). Evaluate correctness (passing tests or metrics) of code produced.  

**Protocol:** For each category, prepare a set of *unseen* prompts (not used in calibration or tuning). Use *paraphrased variations* to avoid mimicry. Generate outputs from both FP and quant models under identical seeds (or greedy decoding for determinism). Use automatic measures where possible (BLEU for paraphrase, code execution checks, JSON parser) and human raters or reference-based metrics for others (e.g. factuality). Compute category-specific metrics (e.g. correctness rate, BLEU, parse success).  

Compare means and confidence intervals: e.g. average helpfulness score or accuracy. We explicitly **do not** allow any post-hoc filtering or retry. We expect some degradation as bits lower, but the quant model should stay within an acceptable margin (e.g. <1–2% absolute drop in key metrics).  We also track **safety outputs**: record any change in toxicity, bias, or refusal patterns. Any category where the quant model performs significantly worse triggers review.  

By covering a wide behavior taxonomy (helpfulness, safety, structured correctness, etc.), we guard against subtle failures that perplexity would miss.  Crucially, the quant model’s responses should be compared *elementwise* to the FP model’s: e.g. in JSON tasks, we expect the same structure and data.  Divergences here indicate “catalog theater” – counting on format variation rather than true behavior.

# 10. Statistical Evaluation Design (Seeds and Regression Budgets)  
Because LLM output has inherent randomness (sampling, or even hardware non-determinism), we adopt *repeated-seed testing*. For each behavioral and numeric test, run multiple random seeds (e.g. 10–20) and report mean ± std of performance metrics.  This separates true model drift from statistical noise.  For example, measure token agreement or accuracy across seeds, and compute a 95% confidence interval.  

We set **regression budgets** based on this variance.  For instance, allow at most 2σ difference (or a fixed small percentage, say 1–2%) in any critical metric before flagging.  It is important to differentiate *deterministic drift* (same seed gives different result due to quant error) from *sampling variance* (different seed).  If a quant model deterministically produces a different token than FP under the same seed, that’s serious.  If only random choice causes differences, that may be tolerable if within variance.  

We also measure hardware variance: test on multiple identical devices to see if inference nondeterminism (especially in WASM SIMD) affects results.  If results jump wildly between runs, that indicates instability.  We log all seed & hardware, and use statistical tests (e.g. t-tests) to confirm any observed differences.  

In summary, for each test we gather N samples, compute confidence intervals for FP and quant models, and ensure they overlap significantly.  Any consistent drop beyond the noise budget is treated as a failure and must be analyzed.  This disciplined statistical design prevents overinterpreting small fluctuations as success or failure.

# 11. Native/Browser Performance Methodology  
We measure performance on **real devices** to avoid simulators’ inaccuracies: e.g. actual x86 CPU (for native) and a representative ARM or x86 (with appropriate CPU flags) for WASM.  Key metrics: 
- **Model Load Time:** Measure wall-clock time to load the model from disk (or fetch it) into memory.  Include dequantization overhead if done eagerly.  
- **First-Token Latency:** Time from prompt input to first token output (to capture any startup overhead).  
- **Prefill (Context Encoding):** Time per token to process the initial prompt into KV cache.  Evaluate with long contexts (up to L tokens) to see scaling.  
- **Decode (Streaming):** Time per output token during generation (auto-regressive).  Report tokens/sec at steady-state (e.g. after 128 warm-up tokens).  
- **Peak Memory:** Measured peak RSS during inference (including thread stacks, buffers).  Important for ensuring fit.  
- **Steady-State Memory:** Memory consumed after warm-up (should equal model + cache + misc).  
- **Context Growth:** How memory grows with L (e.g. L→L+K).  Confirm linear scaling due to KV.  
- **UI Long Tasks (Browser):** In a browser, measure if inference causes main-thread jank.  Profile JS event loop: ensure generation runs in WebWorker or doesn’t block UI.  
- **Energy and Thermal:** On devices that report energy (phones, embedded), measure power draw over time.  Check if prolonged inference triggers thermal throttling (significant slow-down over time).  These require power sensors or onboard readings.  

Measurements should be averaged over multiple runs (e.g. 10) to smooth out jitter.  Document CPU/GPU models and clocks.  For WASM, note if WebGPU vs WebAssembly SIMD is used, as these change performance.  All performance claims (e.g. “2.7× faster than FP16”) must be on actual hardware; e.g. AWQ’s TinyChat benchmarks were on an RTX 4090 and Jetson Orin.  We should compare against a FP16 (or BF16) baseline where possible (same architecture or webassembly version without quant).  

Finally, collect any **CPU profiling data** (cache misses, instructions) to understand bottlenecks.  This informs whether quantization helps (e.g. if memory-bound ops become compute-bound).  For WASM, measure memory footprint vs performance tradeoff (smaller int4 model may reduce memory and increase speed if dequant is efficient).  

All claims about performance (speedup, memory reduction) must cite these empirical measurements.

# 12. Receipt and Provenance Graph  
We design a content-addressed **provenance graph** linking all artifacts.  Each node is an object with a cryptographic hash (e.g. SHA-256).  Key nodes:  
- **Original Weights:** (hash of FP16 checkpoint) labeled with model name/version.  
- **Fine-tuning Adapter:** (hash of LoRA or similar weights).  
- **Merged Weights:** (hash of full model after merging adapter if used).  
- **Quantization Config:** (hash of JSON specifying bitwidth, scheme, group sizes, excluded tensors).  
- **Calibration Manifest:** (hash of list of calibration data files used; optionally include a random seed).  
- **Converter Script:** (hash of code that does quantization, including commit/branch).  
- **Quantized Weights:** (hash of resulting quant model file, e.g. GGUF or .slm) with metadata.  
- **Runtime/Library Binaries:** (hash of native or WASM binary used to run model).  
- **Test Cases:** (hash of all input prompts and expected references for conformance tests).  
- **Raw Outputs:** (hash of outputs from each stage on test cases).  
- **Decisions/Logs:** (hash of evaluator’s results and any decisions: e.g. “stop quantization at this point due to X metric”).

These nodes form a **directed acyclic graph**: e.g. Original → Fine-tuned → Merged → Quantized.  Each runtime execution node points to its model and input hashes, producing output hashes.  All data is immutable and signed.  By hashing all pieces, any change (code, data, model) is detectable.  For reproducibility, we also record commit hashes (or immutable DOIs) for papers/methods referenced.   

In practice, this means each release artifact (e.g. `model_quant.slm`) comes with a manifest listing the hashes of all dependencies: training code, HF model, tokenizer, calibration set, quant config, runtime library.  This content address ledger ensures we can trace an output token back to the exact model and data that generated it.  

# 13. Promotion Thresholds and Stop Rules  
We establish clear criteria to halt at a quantization “tier” if behavior degrades below acceptable levels.  For example, a 4-bit quantized variant must meet all of: (a) **numerical stability** (no NaNs, <1% KL divergence on held-out data), (b) **semantic accuracy** (task accuracy within, say, 2% absolute of FP model, or human eval score not significantly worse), (c) **valid structured output** (100% JSON or code compilations for structured tasks), and (d) **helpfulness safety** (no new toxic or unsafe completions).  If any check fails, we **stop** and reject that quant tier.  Even if file size is very small, failing these criteria means it’s not “practical behavior”.  

For example, if W4A8 and W4A16 both load and run but W4A8 causes answer hallucinations or syntax errors, we would **not** promote it.  We do not rely on any automated “validation pass” (like ensuring JSON syntax) alone; the model must actually answer correctly.  

We further define an overall **behavioral regression budget** (e.g. “no more than 1% drop in Elo score on a benchmark tournament”).  If quantization drifts beyond that, it fails.  In short: loading + generating tokens is not enough; the model must be demonstrably as useful as FP.  We explicitly do not use perplexity or file load success as stop criteria, because small perplexity changes can hide errors and loading says nothing about output quality.  

Finally, to prevent “catalog theater”, we do not count multiple quant formats of the *same bytes* as separate tiers.  Only when the behavior or precision meaningfully changes (and passes all tests) can a new tier be listed.  For example, a bitwise-identical model labeled as “W4” vs “W6” is not two distinct entries.  

# 14. Unknowns Requiring Local Models/Hardware  
Several questions remain answerable only by empirical testing on actual models and devices:  
- **Quantizing Under-Explored Architectures:** The behavior of recurrent or convolution-augmented LLMs (e.g. RWKV) under quantization is not covered by current papers.  How do hidden-state accumulations drift? How to quantize gating integrals in conv layers? These require experiments on local hybrid-model checkpoints.  
- **WASM-Specific Numerical Behavior:** Differences in floating-point rounding or lack of specialized int4 SIMD on WASM may introduce discrepancies.  Only testing on a target browser (and comparing to native) can reveal any subtle divergence.  
- **Large-Scale Behavioral Edge Cases:** Our fidelity tests cover many scenarios, but novel prompt types or domains not in public benchmarks could reveal issues.  Only extensive local prompting (or crowdworker testing) can uncover those.  
- **Hardware Variance:** Some inference chips (e.g. smartphone NPU, or Intel AMX) might have quirks (e.g. lower precision accumulators). Local profiling on each deployment target is needed.  
- **Security Considerations:** Potential vulnerabilities to quantization-based attacks (e.g. inducing silent failures via crafted inputs) are unexplored.  

We flag these as **unknown until tested**.  Our recommendations (above) are based on published methods and typical hardware, but we note that final validation must occur on the actual target LLM checkpoints and CPUs/devices intended for deployment.

# 15. Annotated Primary-Source Bibliography (Selected)  

- Frantar *et al.*, *“GPTQ: Accurate Post-training Compression for Generative Pretrained Transformers”* (ICLR 2023). Presents GPTQ, a Hessian-based PTQ algorithm enabling 3–4 bit weight quantization for large transformers with minimal accuracy loss. Includes implementation details (group sizes, GPU kernels) and results on OPT/BLOOM models. *Submitted 2022 (arXiv:2210.17323)*.  
- Duan *et al.*, *“AWQ: Activation-aware Weight Quantization for LLM Compression”* (MLSys 2024). Introduces AWQ, a PTQ method that identifies and scales down “salient” weight channels based on activation statistics, enabling efficient 3/4-bit weight-only quantization. Reports gains on instruction-tuned and vision-language LLMs. *Submitted 2023, revised 2026 (arXiv:2306.00978)*.  
- Xiao *et al.*, *“SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models”* (ICML 2023). Proposes a weight+activation PTQ technique to achieve full INT8 (W8A8) for LLMs by “smoothing” activation outliers into weights. Demonstrates near-FP16 accuracy for 530B-scale models. *Submitted Nov 2022 (arXiv:2211.10438)*.  
- Dettmers *et al.*, *“QLoRA: Efficient Finetuning of Quantized LLMs”* (ArXiv 2023). Describes 4-bit quantized training via NormalFloat (NF4) and double quantization of LoRA adapters. Shows state-of-the-art instruction-tuning of a 65B model using just 5 GB of GPU memory. *Submitted May 2023 (arXiv:2305.14314)*.  
- Or *et al.*, *“Quantization-Aware Training for Large Language Models with PyTorch”* (PyTorch blog, 2024). Details a QAT pipeline achieving int4 weight + int8 activation quantization using fake-quant modules. Reports that QAT recovers 68–96% of accuracy lost by PTQ on Llama3-8B, with int4/grouped weights and int8 dynamic activations. *Jul 30, 2024 (blog)*.  
- Xin *et al.*, *“Quantization-Aware Distillation for NVFP4 Inference Accuracy Recovery”* (ArXiv 2026). Presents QAD, which distills a full-precision teacher into a 4-bit quantized student via KL loss. Shows robust recovery of accuracy in multi-stage pipelines (SFT, RLHF, etc.) where traditional QAT struggles. *Submitted Jan 2026, revised Mar 2026 (arXiv:2601.20088)*.  
- Williams & Aletras, *“On the Impact of Calibration Data in Post-training Quantization and Pruning”* (ArXiv 2023). An empirical study on how calibration data choice affects LLM quantization. Key findings include the need for diverse calibration sets and that evaluation data must be excluded from calibration. *Submitted Nov 2023 (arXiv:2311.09755)*.  
- Nallapati *et al.*, *“Mixed-Precision Quantization for Language Models: Techniques and Prospects”* (ArXiv 2025). A recent survey summarizing mixed-precision frameworks. It notes that embeddings, output heads, attention/softmax, and normalization layers consistently require higher precision, and that many pipelines default to FP32 for these components. *Submitted Oct 2025 (arXiv:2510.16805)*.  
- Hugging Face *“Transformers Quantization”* Documentation (2024). Provides implementation notes for AWQ and GPTQ in Transformers, and supported quant formats. Notes that Transformers supports 8-bit and 4-bit quantization via bitsandbytes (with symmetric int types). *Retrieved May 2026 (docs/quantization)*.  
- Frantar & Alistarh, *“GPTQ for LLaMA”* (GitHub, 2023). Open-source code for GPTQ quantization. The README reports GPTQ’s ability to quantize LLaMA models to 3–4 bits (e.g. “3g128” for group=128) and includes custom CUDA kernels for 3-bit inference. *Published July 2023 (commit history)*.  

*Retrieval Dates:* All arXiv and documentation sources were retrieved in July 2026. ArXiv links are to their latest versions. Technical reports and code are cited by content and commit date to ensure traceability.

