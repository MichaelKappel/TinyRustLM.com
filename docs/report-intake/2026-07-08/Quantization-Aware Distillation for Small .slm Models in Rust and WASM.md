# Quantization-Aware Distillation for Small .slm Models in Rust and WASM

## Why small models break under naive quantization

The central problem is not that quantization is inherently bad. It is that **small language models have less slack**. Recent scaling evidence for quantization-aware training shows that quantization error decreases as model size increases, while coarser group sizes make the error worse; the same study identifies activation outliers in the FC2 layer as a principal bottleneck for W4A4. NVIDIA’s 2026 report on quantization-aware distillation also states directly that for **small LLMs** the accuracy drop from post-training quantization can be non-negligible. On mobile-oriented SLM work, Squat likewise reports that post-training quantization often suffers significant accuracy drops once you push below 8 bits. citeturn16view0turn16view1turn13view0turn15view3

For instruction-tuned models, this is especially dangerous because a tiny perplexity change can hide a larger behavioral change. NVIDIA’s QAD report shows a concrete example where QAT matches the cross-entropy of the BF16 baseline, yet its KL divergence to the teacher remains large; QAD, by contrast, nearly matches the teacher distribution. Separate 2026 work on compressed instruction-tuned models finds that 4-bit and 3-bit quantization can cause item-level behavioral regressions and emerging bias even when the perplexity change stays small, which means “it still benchmarks fine on PPL” is not strong evidence that the model still behaves like the original. Alignment-aware quantization work makes the same motivation explicit: quantization can preserve perplexity while regressing alignment behaviors. citeturn13view0turn25search5turn25search0

A useful technical way to see the fragility is via **logit margins**. If the correct or desired continuation has logit \(z_{y^\*}\), and the best competing token has \(\max_{j \neq y^\*} z_j\), then the argmax is stable only while the margin
\[
m = z_{y^\*} - \max_{j \neq y^\*} z_j
\]
remains larger than the quantization-induced perturbation. Small models tend to operate closer to that boundary on rare continuations, instruction-format tokens, and safety-preferring alternatives. This matches the empirical observation above: distributional drift and item-level regressions appear earlier than coarse aggregate metrics suggest. Cross-tokenizer distillation papers add another failure mode: when the tokenizer or vocabulary changes, low-frequency and domain-specific tokens can become harder to preserve because token-level distillation assumes comparable token events, which may no longer exist after retokenization. citeturn13view0turn25search5turn27view2turn27view4

## Quantization design space for .slm

For a deployment-oriented `.slm`, the most useful starting point is the standard affine quantizer:
\[
q = \operatorname{clip}\!\left(\left\lfloor \frac{x}{s} \right\rceil + z,\; q_{\min}, q_{\max}\right), \qquad \hat{x} = s(q-z),
\]
where \(s\) is the scale and \(z\) is the zero-point. In the symmetric case, \(z=0\); in affine or asymmetric quantization, \(z\neq 0\). EfficientQAT explicitly describes quantization with scale and zero-point, while the ggml data structures make the distinction concrete: formats such as `q4_0` and `q8_0` store only a scale (`d`), whereas `q4_1` and `q5_1` store a scale plus a minimum/offset (`m`), corresponding to an affine reconstruction. citeturn15view2turn12view0

The granularity choice matters as much as the bit-width. SmoothQuant’s definitions are a clean summary: **per-tensor** uses one scale for the full tensor; **per-token** or **per-channel** uses vector-wise scaling on outer dimensions; **group-wise** shares parameters inside fixed channel groups. SmoothQuant also explains why hardware-friendly GEMM kernels usually tolerate scaling on outer dimensions but not arbitrary inner-dimension scaling. For `.slm` meant to run in Rust/WASM, this hardware fact is crucial: you want a format whose dequantization is regular enough that your kernel can stay vectorized instead of fetching a different scale every few lanes. citeturn22view0turn21view0

Blockwise and super-block formats are usually the best compromise. In ggml, legacy formats such as `q4_0`, `q5_0`, and `q8_0` quantize blocks of 32 weights; the newer K-quants use larger super-blocks and then pack sub-block scales and mins. For example, `q4_K` is modeled as \(x = a q + b\) over 8 sub-blocks of 32 elements, with quantized scales and mins; `q5_K` adds an extra high-bit plane; `q6_K` uses 16 sub-blocks of 16 elements with 8-bit scales; and the effective bits per weight are about 4.5, 5.5, and 6.56, respectively. The llama.cpp quantize tool also shows why these formats are attractive in practice: they produce large reductions in model size while preserving usable throughput, and they support tensor-specific overrides for output and embedding weights. citeturn12view0turn10view0

For scale and zero-point design, the implementation rule is straightforward. Use **symmetric signed quantization** when the runtime kernel wants the cleanest integer inner loop and the tensor is mean-centered enough; use **affine/asymmetric** quantization when preserving an off-center distribution matters more than a simpler inner loop. KIVI’s title and method are a reminder that asymmetry can matter a lot for highly skewed cache distributions, while BitDistiller reports gains from asymmetric quantization plus clipping in the sub-4-bit regime. In other words, symmetric is the better default for WASM kernels; asymmetric is the fix when the tensor statistics demand it. citeturn30search0turn14search0

Outlier handling is non-optional below 8 bits. SmoothQuant shows that LLM activations can contain outlier channels that dominate the quantization range, leaving few effective levels for ordinary values. AWQ shows that not all weights are equally important and that protecting only a tiny fraction of salient channels can materially reduce error, with salience identified through activation statistics rather than weight magnitude. OmniQuant then generalizes this idea into learnable weight clipping and learnable equivalent transformations, optimized with block-wise reconstruction. Older outlier-channel splitting work shows the broader principle: duplicate or separate outlier-heavy channels so the bulk distribution becomes quantization-friendly without retraining. More recent OSC work argues that in low-bit LLM quantization, many outliers are token-persistent and cluster in fixed channels, which is exactly the structure that per-channel scaling, splitting, or rotation-based approaches exploit. citeturn22view0turn20view0turn17view3turn23academia16turn24search1

Activation-aware transformations are the cleanest way to make low-bit quantization survive. SmoothQuant uses the equivalence
\[
Y = XW = \bigl(X \operatorname{diag}(s)^{-1}\bigr)\bigl(\operatorname{diag}(s)W\bigr) = \hat{X}\hat{W},
\]
and picks
\[
s_j = \frac{\max(|X_j|)^\alpha}{\max(|W_j|)^{1-\alpha}}
\]
to move difficulty from activations to weights while preserving exact linear semantics. AWQ uses a closely related “equivalent transform” idea, but focuses on scaling up salient weight channels identified from activation statistics, so that quantization preserves the weights that matter most during actual inference. OmniQuant’s LET/LWC can be seen as a learnable continuation of the same family. citeturn22view0turn20view0turn17view3

GPTQ-style reconstruction is the strongest classical PTQ baseline for weight-only low bits. GPTQ formulates layer reconstruction as
\[
\min_{\hat{W}} \; \|WX - \hat{W}X\|_2^2,
\]
uses approximate second-order information, and derives the OBQ-style Hessian
\[
H_F = 2 X_F X_F^\top
\]
over the remaining unquantized weights. The practical breakthrough is that GPTQ quantizes columns in a shared order, performs lazy batch updates, and reduces the runtime from the original cubic-per-row formulation to something that scales to very large transformers. For `.slm`, the important point is not only that GPTQ works, but **why** it works: it explicitly compensates for the error introduced by each rounded block instead of relying on plain round-to-nearest. citeturn18view3turn19view0

## PTQ, QAT, and quantization-aware distillation

**PTQ** is what you do when you cannot afford additional training. It calibrates the quantizer on a small representative dataset and then freezes the low-bit model. It is simple, cheap, and often sufficient at 8 bits or for large models with high redundancy. OmniQuant is useful here because it shows that “PTQ” no longer needs to mean “no gradients at all”: by learning only a restrained set of quantization parameters with block-wise optimization, it retains much of PTQ’s time and data efficiency while performing better in low-bit settings than purely hand-crafted PTQ. That is a strong baseline for `.slm` export pipelines. citeturn17view3turn13view0

**QAT** is what you do when PTQ breaks but you still want the deployment graph to match inference-time quantization. The forward pass inserts real or fake quantization, gradients flow through approximations such as straight-through estimators, and you optimize either the full model or a reduced set of trainable parameters. LLM-QAT uses data-free distillation from model-generated text and quantizes weights, activations, and even the KV cache; EfficientQAT makes QAT more practical with block-wise training of all parameters followed by end-to-end tuning of step sizes and zero-points; LR-QAT reduces the memory cost by introducing low-rank auxiliary weights that are quantization-aware; and Squat shows that for small models on edge devices, QAT can be practical precisely because full-parameter training is no longer absurdly expensive. citeturn15view0turn15view2turn15view1turn15view3

**Quantization-aware distillation** is the most important method for the specific problem you asked about. The student is quantized or fake-quantized during training, but instead of optimizing only task loss, it is trained to match a full-precision teacher. NVIDIA’s QAD report formalizes the core loss as
\[
\mathcal{L}_{\text{QAD}} = D_{\mathrm{KL}}\!\left(p_{\text{teacher}} \,\|\, p_{\text{student}}\right),
\]
and shows that QAD aligns the student output distribution to the BF16 teacher much better than QAT on modern post-trained models, especially those that went through SFT, RL, or model merging. BitDistiller reaches a similar conclusion in the harsher sub-4-bit regime, combining quantization-aware training with self-distillation and a confidence-aware KL objective. citeturn13view0turn14search0

For `.slm`, the most useful operational distinction is this:

\[
\text{PTQ} \to \text{match tensor statistics}, \qquad
\text{QAT} \to \text{match training objective under quantization}, \qquad
\text{QAD} \to \text{match teacher behavior under quantization}.
\]

That last one is what preserves brittle instruction-following behavior best, because it directly preserves the **soft output distribution**, not just label loss. In practice, that means QAD should be the default rescue path whenever your q4 or q5 PTQ model still looks acceptable on perplexity but starts drifting in help\-fulness, formatting, refusal style, or rare-token choice. citeturn13view0turn25search0

A practical training objective for fake-quantized student distillation is:

\[
\mathcal{L}
=
\lambda_{\mathrm{KL}} T^2 D_{\mathrm{KL}}\!\left(
\operatorname{softmax}(z_t/T)\,\|\,\operatorname{softmax}(z_s/T)
\right)
+
\lambda_{\mathrm{CE}} \operatorname{CE}(y_{\text{gold}}, z_s)
+
\lambda_{\mathrm{feat}} \sum_\ell \|h^\ell_t - h^\ell_s\|_2^2 .
\]

The first term is the essential one. The second helps when you still have clean labels. The third is optional and most useful for stubborn layers such as embeddings, layernorm-adjacent projections, and the output head. The cited literature does not require all three terms, but it strongly supports KL-to-teacher as the main anchor. citeturn13view0turn14search0turn15view0

## Calibration, error metrics, and proving quality honestly

A calibration dataset for PTQ should be **representative, diverse, and cheap**. SmoothQuant calibrates with 512 random sentences from the pretraining distribution and reuses the same smoothed, quantized model across downstream tasks. OmniQuant reports that 128 samples can be enough for its optimized PTQ pipeline. LLM-QAT shows that generated data from the base model can outperform narrow subsets of original data for preserving zero-shot behavior. NVIDIA’s QAD report goes further: partial-domain data, synthetic data from RL prompts, and even BOS-only generated data can still recover near-BF16 behavior, while random tokens preserve stability better than one might expect. For a small `.slm`, that implies a staged design: start with a few hundred representative sequences for PTQ calibration, and if q4/q5 still drifts, switch to QAD with a broader held-out synthetic mix rather than overfitting to a tiny benchmark slice. citeturn22view0turn17view3turn15view0turn28view2turn28view3

The most useful quantization error metrics are the ones that track **output distributions**, not just weight reconstruction. A good stack is:

\[
\text{teacher–student KL}, \quad
\text{held-out NLL / perplexity}, \quad
\text{top-1 and top-k agreement}, \quad
\text{logit margin flip rate}, \quad
\text{behavioral benchmark deltas}.
\]

The reason is empirical. QAD shows that cross-entropy versus labels can stay almost unchanged while KL divergence versus the BF16 teacher reveals large distributional drift. The llama.cpp quantize tool explicitly treats perplexity and KL divergence as relevant quantization quality measures. Newer logit-aware quantization work also argues that minimizing block MSE alone does not guarantee the same token predictions, while logit-level KL or cross-entropy directly matches the predictive distribution. Finally, the 2026 bias-emergence study shows that perplexity alone misses fairness-critical drift. citeturn13view0turn10view0turn25search1turn25search5

If your goal is to show that a q4 or q5 `.slm` is “good enough” **without cheating**, the evaluation protocol matters as much as the quantizer. Use the **same source checkpoint**, the **same tokenizer** unless tokenizer compression is itself part of the experiment, the **same prompt template**, the **same sampler settings**, and the **same held-out tasks**. Do not requantize from an already quantized model; llama.cpp warns that this can severely reduce quality relative to quantizing from 16-bit or 32-bit weights. Do not tune on evaluation prompts. Report both offline metrics and user-facing tasks, because item-level regressions can appear before aggregate metrics move very much. citeturn10view0turn25search5turn13view0

The most defensible proof bundle for q4/q5 looks like this:

1. **Distributional fidelity** on a held-out corpus: teacher–student KL, NLL, top-k agreement, and logit margin flip rate.  
2. **Capability fidelity** on fixed public tasks: instruction following, coding, math, summarization, extraction, and safety-style prompts.  
3. **Latency and memory** with the actual Rust/WASM runtime: prefill tokens/s, decode tokens/s, model bytes, peak live memory, and KV-cache bytes per token.  
4. **Blind pairwise human A/B** on a prompt set not used for calibration or distillation.  

That is much harder to game than citing a single perplexity number on WikiText or cherry-picking one generation. The literature above strongly justifies KL, task accuracy, and item-level evaluation as the core pillars. citeturn13view0turn25search5turn10view0

## Rust and WASM systems constraints

Rust/WASM imposes unusually sharp systems constraints on low-bit design. In the browser, a `wasm32` module is still bounded by 32-bit addressing unless you move to `memory64`; MDN documents the classic 4 GiB upper bound for i32-addressed Wasm memories. Shared WebAssembly memory requires a `maximum` to be declared, and multi-threading on the web is built from Web Workers plus shared `WebAssembly.Memory` backed by `SharedArrayBuffer`. Both MDN and web.dev note that `SharedArrayBuffer` on the web requires cross-origin isolation. In the Rust toolchain, `wasm-bindgen` targets `wasm32-unknown-unknown`, which is intentionally bare-bones: `std::fs` and `std::net` are effectively inert, so a `.slm` runtime should assume explicit host-provided I/O and memory management. citeturn7view2turn7view1turn26search0turn26search1turn8search12

At the SIMD level, WebAssembly gives you a portable 128-bit `v128` abstraction, not a guaranteed native int4/int5 dot-product instruction. Rust exposes these intrinsics through `core::arch::wasm32`. That immediately favors **regular blockwise formats** whose unpack path is simple. `q8` is easy because it is already byte-aligned; `q4` is manageable because it is nibble-packed; `q5` and `q6` are viable but more complicated because they require extra bit planes or split high/low fields (`qh`, `qs`, `ql`). The ggml structures make this explicit. On some ARM64 hardware, relaxed SIMD dot products can be much faster; Chrome’s rollout discussion cites roughly 2–4× speedups on dot-sensitive workloads on Armv8.2+ hardware, while also noting that x86 lowering was not yet the most optimal path. For a portable Rust/WASM `.slm`, the correct assumption is therefore: **optimize for generic v128 plus regular memory access; treat dot-product lowering as a bonus, not a guarantee**. citeturn7view0turn8search9turn12view0turn7view4

This is why blockwise q4/q5/q6/q8 formats are a better fit than exotic deployment-hostile granularity. If every tiny channel group carries its own scale, the dequantization overhead can dominate the integer math, especially in a browser where you are already bounded by memory bandwidth and JIT/codegen variability. Squat makes a closely related point from the mobile side: fine-grained quantization may help accuracy on paper, but standard SIMD libraries on edge devices struggle to exploit it efficiently, and a deployable quantizer must match the kernel structure of the target device. citeturn15view3turn22view0

KV-cache precision deserves separate treatment because it is both a memory bottleneck and a behavior bottleneck. LLM-QAT explicitly quantizes the KV cache and treats it as critical for throughput and long context. QuaRot shows that with the right outlier-removing rotations, end-to-end 4-bit quantization of weights, activations, and KV cache is possible. KIVI shows that for very aggressive KV compression, keys and values want different granularity: per-channel for keys and per-token for values. SAW-INT4 then adds the serving-systems perspective: among serving-compatible INT4 methods, token-wise INT4 with block-diagonal Hadamard rotation gave the best practical accuracy–efficiency trade-off and integrated cleanly into paged attention pipelines. NVIDIA’s QAD report also uses selective higher precision in fragile components, including FP8 KV cache in one hybrid setup. For `.slm`, the resulting rule is simple: **ship q4/q5 weights before you ship q4 KV**. Default the KV cache to q8 or FP8-equivalent if you can; drop to int4 only if you have rotation-aware validation showing it stays near-lossless on your real prompts. citeturn15view0turn29search1turn30search0turn31view0turn28view2

A practical Rust-side inner loop for blockwise q4 dequantized matvec in WASM looks like this conceptually:

```text
for each output row:
    acc = 0
    for each block of 32 or 64 weights:
        load packed q4 bytes
        load block scale and optional min/zero-point
        unpack nibbles -> i8 lanes
        widen input activations to i16/i32 lanes
        apply (q - z) * scale  or  q * scale + min
        accumulate into i32 / f32
    write output
```

The important design choice is not the syntax; it is that the metadata and packed codes are laid out so that the loop streams memory linearly, avoids per-element branches, and keeps scale lookups coarse. That is exactly the pattern favored by ggml’s block formats and by WebAssembly’s `v128` model. citeturn12view0turn7view0turn8search9

## Tokenizer and vocabulary compression for .slm

Tokenizer compression is one of the few levers that reduces **both model size and runtime cost**. SentencePiece and BPE remain the most relevant foundations here: fixed-size subword vocabularies solve open-vocabulary handling while letting you choose a smaller embedding matrix than word-level tokenization. Fast Vocabulary Transfer makes the deployment consequence explicit: a smaller domain-adapted tokenizer can reduce sequence length, which lowers the quadratic attention cost, and can also shrink the embedding matrix, which directly reduces model size. That is especially attractive for `.slm` packages that must fit tightly inside Wasm memory budgets. citeturn4search5turn4search15turn27view0

The catch is that vocabulary reduction is not monotonically good. Efficient Vocabulary Reduction for Small Language Models reports that reducing vocabulary size improves inference speed and memory footprint, but reducing it too much can **slow inference and lower accuracy**, reinforcing that there is an optimum rather than a “smallest wins” rule. The paper’s mechanism is also practical: build a new tokenizer, remap overlapping embeddings directly, and initialize unseen reduced-vocabulary tokens by composing existing subword embeddings. That makes tokenizer compression a realistic part of an `.slm` export pipeline rather than a research-only idea. citeturn27view1

Cross-tokenizer distillation is what makes this relevant to quantization-aware distillation, rather than a separate concern. Approximate Likelihood Matching shows that pure distillation across different tokenizers is possible by aligning comparable chunks and matching likelihoods; it even demonstrates subword-to-byte transfer. Byte-Level Distillation proposes a simpler shared interface at the byte level and performs competitively with more complex methods. TokAlign offers a middle ground: learn a token mapping, rearrange embeddings and related parameters, progressively fine-tune, and then recover the model quickly; after vocabulary unification, token-level distillation performs materially better than sentence-level distillation. citeturn27view2turn27view3turn27view4

For a Rust/WASM `.slm`, the practical tokenizer recommendation is therefore conservative. Use a **small but not tiny** subword tokenizer—often a SentencePiece unigram or BPE model—when your domain is stable and latency matters. Prefer a domain-adapted vocabulary only if it actually reduces average sequence length on the traffic you expect. If robustness to arbitrary bytes, corrupted text, or multi-domain content matters more than shortest sequences, then byte-level or byte-fallback tokenization becomes more attractive, but only if you budget for the longer sequences and explicitly distill into that tokenizer. The cross-tokenizer literature makes clear that this is viable, but still not a free lunch. citeturn4search5turn27view0turn27view2turn27view3

## Recommended formats, pseudo-code, and ablation plan

For `.slm` weights, the recommendation is not “always the lowest bit-width that still runs.” It is “the lowest bit-width that still preserves teacher behavior under your actual runtime.” With that standard, the best default ladder is:

- **q8** for reference deployments, regression testing, and fragile heads or embeddings. It is near-lossless and byte-aligned, which makes kernels simple. ggml’s `q8_0` is the cleanest baseline. citeturn12view0turn10view0  
- **q6** as the high-quality default when memory is still tight. It keeps much of q8’s quality while being substantially smaller, though unpacking is more complex because of split high/low fields. citeturn12view0turn10view0  
- **q5** as the usual **shipping sweet spot** for small `.slm` models in Rust/WASM. It balances footprint and fidelity better than q4 for brittle instruction-tuned students, and the extra high-bit plane is usually worth the memory. citeturn12view0turn10view0turn13view0  
- **q4** only after activation-aware PTQ and then QAD, with selective exceptions for embeddings, the output head, and sometimes attention-adjacent tensors. The literature says q4 can absolutely work, but it is the first point where small-model behavior often becomes fragile if you stop at naive PTQ. citeturn15view3turn13view0turn20view0turn22view0  
- **q3/q2** as experimental or mixed-precision-only modes. BitDistiller shows that sub-4-bit students can be rescued, and ggml supports low-bit formats, but the behavior risk is high enough that they should not be your default `.slm` export unless your evaluation protocol is unusually strong. citeturn14search0turn12view0turn25search5

A robust export pipeline for a small `.slm` should look like this:

```text
train / obtain FP16 or BF16 teacher
    ↓
choose deployment tokenizer
    ↓
initialize student weights from teacher
    ↓
run activation-aware PTQ seed
    - SmoothQuant or AWQ-style scaling
    - GPTQ/OmniQuant-style block reconstruction
    ↓
switch student to fake-quant training graph
    - weight fake quant: q8/q6/q5/q4 candidates
    - optional activation fake quant on fragile layers
    - optional mixed precision for embeddings / lm_head / first+last layers
    ↓
train with QAD
    - KL to teacher logits as primary loss
    - optional CE to gold labels
    - optional hidden-state matching on selected layers
    ↓
evaluate on held-out prompts and frozen public benchmarks
    ↓
export .slm
    - tensor metadata: quant type, block size, scale type
    - tokenizer + vocab metadata
    - runtime hints for Rust/WASM kernel selection
```

This combines the strongest parts of SmoothQuant/AWQ/OmniQuant/GPTQ on the front end with QAD on the back end. The PTQ stage gets you close; the distillation stage recovers the logit geometry that small models otherwise lose. citeturn22view0turn20view0turn17view3turn19view0turn13view0

The minimum ablation plan that will actually answer the important questions is the following. Compare per-tensor, per-channel, per-group, and blockwise weight quantization at q8/q6/q5/q4, but only among kernel-compatible variants for the final Rust/WASM target. Toggle SmoothQuant, AWQ-style scaling, and one reconstruction method such as GPTQ or OmniQuant. Then compare PTQ-only against fake-quant QAD, using the same tokenizer and prompts. Finally, sweep KV-cache precision independently from weight precision, because weight-q4 plus KV-q8 is often a better product than weight-q5 plus KV-q4. Every run should report teacher–student KL, held-out perplexity, top-k agreement, prompt A/B results, prefill throughput, decode throughput, model bytes, and peak memory. That combination is directly motivated by the literature’s recurring finding that no single metric tells the full story. citeturn13view0turn25search5turn31view0turn10view0

My concrete recommendations for a first production-quality `.slm` family are these. Use a compact subword tokenizer first, not a byte-level tokenizer, unless your deployment domain is unusually noisy. Export three weight variants: **q8 reference**, **q5 default**, and **q4 experimental-but-supported**. Keep embeddings and LM head at q8 or q6 if memory allows. Keep KV cache at q8 or FP8-equivalent first; only move KV to int4 when a rotation-aware validation pass shows negligible loss. Use AWQ- or SmoothQuant-style scaling before reconstruction, then run QAD with KL-to-teacher as the main loss. Treat q3/q2 as research branches, not user-facing defaults. This combination is the best match to the evidence from activation-aware PTQ, GPTQ-style reconstruction, QAD on post-trained models, and real serving constraints. citeturn20view0turn22view0turn19view0turn13view0turn31view0turn15view3