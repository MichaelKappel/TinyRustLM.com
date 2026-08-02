# Production Mixed-Precision Quantization Pipeline for TinyRustLM SLM Models

## Constraints and design target

TinyRustLM’s current runtime is already opinionated in the right direction for a production local stack: it is browser-local Rust/WASM, advertises that prompts are not sent to a server, treats local `.slm` files as device-resident inputs, and exposes runtime provenance fields including checksums, plan fetches, and actual fetches. The current published `.slm` contract is intentionally narrow, with a 33,554,432-byte model budget, browser-local WASM execution, zero third-party runtime dependencies, explicit shape and offset validation, checksum binding, and currently documented support for `f32`, `q8_0`, and `q4_0`. citeturn26view0turn19view0turn20view0turn21view0

That starting point matters because TinyRustLM is not trying to be a general-purpose GGUF clone. It is trying to be a strict browser artifact with bounded validation and compact execution. The right design goal, therefore, is not “support every quant under the sun.” It is “add only the quantization families whose quality gain is material relative to their decoder complexity and WASM cost.” The practical implication is that a production TinyRustLM pipeline should extend the current artifact into a mixed-precision `.slm` successor while keeping the same safety posture: strict header validation, per-tensor checksums, finite-payload checks, deterministic proof paths, and local-only provenance. citeturn19view0turn21view0

The other non-negotiable constraint is that low-bit wins in browser environments are not purely about bytes. TinyRustLM’s own documentation notes that `q4_0` saves memory but requires nibble unpacking with masks and shifts, so it is a memory win rather than a free speed win. That observation generalizes: in Rust/WASM, the simplest formats are often easier to make fast than the most information-dense ones. The best pipeline is therefore mixed-precision in both senses: mixed *quality budget* across tensors, and mixed *decoder complexity* across deployment targets. citeturn20view0turn29search0

## Quantization families and practical tradeoffs

For TinyRustLM, the storage-level comparison that matters most is not just “how many bits,” but “how many bits plus how much decode logic.”

**`q8_0`** is the simplest high-quality low-precision baseline. TinyRustLM documents it at roughly `1.0625` bytes per parameter, and `llama.cpp`’s `block_q8_0` uses 32 int8 weights plus one scale parameter per block. In the `llama.cpp` published Llama 3.1 8B example, `Q8_0` is much smaller than F16, but it still uses materially more space than `Q6_K` or `Q5_K_M`, and its generation throughput is not automatically best just because it uses more bits. That makes it a good format for *fragile tensors*, not a good bulk format for browser-first `.slm` files. citeturn20view0turn9view4turn4view0

**`q6_K`** is the first format I would call “near-reference quality territory” for local assistants. In `ggml`, `block_q6_K` is a 256-value super-block with 8-bit per-subblock scales and effective storage of `6.5625` bits per weight. Historical `llama.cpp` guidance puts `Q6_K` at extremely low perplexity increase relative to unquantized baselines, while using substantially less space than `Q8_0`. For TinyRustLM, `q6_K` is exactly the kind of “protect this tensor” format you want for output heads, FFN down-projections, value paths, and any late-layer tensor that calibration marks as expensive to damage. citeturn9view3turn30view0

**`q5_K`** is the strongest “high-quality bulk” family. In `ggml`, `block_q5_K` uses a 256-value super-block with 6-bit quantized scales/mins and effective storage of `5.5` bits per weight. `llama.cpp`’s historical perplexity guidance places `Q5_K_M` and `Q5_K_S` among the recommended operating points because they preserve most quality while staying much smaller than `Q6_K` and `Q8_0`. If you have enough budget for a premium browser profile or a desktop-biased `.slm`, `q5_K` should be the default bulk format. citeturn9view2turn30view0

**`q4_K`** is the most important missing family for TinyRustLM. In `ggml`, `block_q4_K` is also a 256-value super-block with scales and mins for sub-blocks, at `4.5` effective bits per weight. This makes it qualitatively different from `q4_0`: both land in the same rough storage class, but `q4_K` carries richer local scaling information. `llama.cpp`’s long-standing guidance and its default mixed recipes have consistently treated `Q4_K_M` as the balanced recommendation. In practice, that makes `q4_K` the right bulk default for a new mixed-precision `SLM2` format. citeturn10view4turn30view0turn31view0

**`q4_0`** remains valuable, but mainly as the compatibility and throughput path. TinyRustLM already supports it, documents it at roughly `0.5625` bytes per parameter, and explains the extra unpack work in WASM. On-device evaluation work in 2025 found that among 4-bit methods, `q4_0` could outperform `q4_k` in throughput because it requires fewer CPU operations. So even though `q4_K` is the better fidelity-per-byte choice, `q4_0` should stay in TinyRustLM as the “fast/simple 4-bit decoder” for compatibility builds and aggressive mobile targets. citeturn20view0turn29search0

**`q3_K`** is usable, but should be treated as selective compression rather than a default whole-model target. In `ggml`, `block_q3_K` stores `3.4375` effective bits per weight. Historical `llama.cpp` quantization guidance shows `Q3_K_*` variants saving substantial space but with visibly larger perplexity penalties than `Q4_K_M` or `Q5_K_M`. That makes `q3_K` appropriate for embeddings, early or mid-layer Q/K projections, and some FFN up/gate tensors after calibration—not for output heads or anything that directly projects back into the residual stream late in the network. citeturn10view4turn30view0

**Experimental `q2` formats** should be treated as emergency-only. `ggml`’s `block_q2_K` lands at `2.625` effective bits per weight, and recent PTQ benchmarking found that AWQ-like salience methods can completely collapse at 2-bit, while a 2024 code-generation study on 7B models found that 4-bit delivered the best tradeoff and 2-bit dropped sharply in quality. In other words, 2-bit is not “just a smaller 3-bit.” It is a qualitatively riskier regime and should not be part of the default TinyRustLM assistant path. citeturn10view4turn24view0turn13search6

The algorithmic backend comparison points toward the same conclusion. AWQ is attractive because it is weight-only, activation-aware, hardware-friendly, and avoids backprop/reconstruction while protecting a very small fraction of salient weights through equivalent scaling; PTQ-Bench reports that it has a slight edge at 4-bit and performs best at 3-bit among several baselines, but becomes unreliable at 2-bit. GPTQ uses approximate second-order information and remains one of the strongest choices for highly accurate 3/4-bit PTQ, with better robustness than AWQ in the extreme 2-bit regime. SmoothQuant is excellent when you want W8A8 and have real INT8 kernels, but it shifts the problem toward activation quantization and runtime scaling, which is a poor first fit for a strict browser-local TinyRustLM runtime. HQQ is valuable for fast calibration-free exploratory sweeps and supports 8/4/3/2/1-bit quantization, while SpQR and OWQ are the best conceptual inspirations for “protect sensitive outliers in higher precision” side structures. citeturn0search4turn24view0turn0search1turn24view4turn0search2turn15search3turn15search5turn17search0turn14search0

My recommendation from that comparison is straightforward: use **AWQ-style activation-aware weighting as the primary offline selector for 4-bit and 3-bit bulk tensors**, use **GPTQ-style fallback for tensors that still fail calibration at those levels**, and reserve **OWQ/SpQR-style outlier rescue** for especially fragile tensors such as untied output heads or late FFN down-projections. SmoothQuant is a future optimization for a separate INT8 runtime, not the first production path for TinyRustLM. citeturn0search4turn0search1turn17search0turn32academia18

## Sensitivity by tensor class

The best practical clue for tensor sensitivity is that `llama.cpp` already uses mixed recipes by default. In its published “naive quantization” patterns, the `Q4_K_M` and `Q5_K_M` recipes keep `output.weight` at `q6_k`, and they also elevate `attn_v` and `ffn_down` above the base precision in several presets. That is not a proof of universal truth, but it is a good empirical prior: **output projection, value projection, and FFN down-projection are usually the first places to spend extra bits**. citeturn31view0

Embeddings are the opposite case. In the tensor-type experiments shared in 2025, the summarized conclusion was that aggressive quantization of token embeddings caused the least deviation from BF16, while more aggressive treatment of other tensor groups caused noticeably larger quality effects. That aligns with current field practice: embeddings are often the first large tensor you can push downward without disproportionate assistant-quality damage, especially in SLMs where memory budgets are tight. citeturn31view0

Normalization weights should remain effectively unquantized in TinyRustLM. This is partly a sensitivity issue and partly an economics issue: `llama.cpp` maintainers explicitly note that one-dimensional tensors are tiny and usually not worth quantizing at all. In a browser-local artifact with a 33.5 MB model envelope, the savings from quantizing RMSNorm or LayerNorm scales are negligible, while the risk and implementation complexity are unnecessary. Keep them in `f32` if you want maximal proof stability, or `f16` if you later standardize half-precision support in `.slm`. citeturn32search0turn19view0

That leads to a practical sensitivity ranking for TinyRustLM assistants:

**Normalization weights**: keep `f32` or `f16`. Do not spend engineering time quantizing them. citeturn32search0

**Output head**: treat as high sensitivity. Use `q6_K` by default, or `q8_0` for a high-quality desktop profile. If embeddings are tied to the output head, treat the shared matrix as output-sensitive, not embedding-sensitive. `llama.cpp`’s own mixed recipes promote the output tensor above the bulk format for a reason. citeturn31view0turn4view0

**Attention projections**: separate them. Q and K can usually sit near the bulk format, especially in earlier layers. V and O deserve more caution because they feed information back into the residual path and are often promoted in mixed recipes. Also, the softmax and normalization parts of attention should stay higher precision at compute time even if the projections themselves are weight-quantized. citeturn31view0turn12search6

**FFN projections**: separate up/gate from down. In practice, `ffn_down` is usually the one to protect. `llama.cpp`’s default patterns repeatedly elevate `ffn_down`, while tensor-wise custom recipes often push `ffn_gate` and `ffn_up` lower first. That is the right default policy for TinyRustLM too. citeturn31view0

**Embeddings**: start lower than the rest. `q4_K` is a safe first choice, `q3_K` is reasonable in aggressive profiles, and experimental `q2` should be limited to emergency-only situations after held-out calibration. citeturn31view0turn24view0

The last piece is *layer-wise* sensitivity. Recent work on layer-sensitive mixed-precision allocation emphasizes activation sensitivity, weight-distribution features, and gradient-based tolerance scoring rather than naïve uniform bitwidth assignment. For TinyRustLM, that means you should start with the tensor-class priors above, but the actual final bit assignment should be driven by measured calibration loss and isolated perplexity deltas per tensor and per layer. Do not hard-code “later layers are always more sensitive”; measure them. In many assistant-style SLMs they often *will* be promoted, but the pipeline should discover that, not assume it. citeturn25search1turn25search13

## Recommended mixed-precision pipeline and deployment profiles

The production pipeline should be an **offline budgeted search** over quantization assignments, not a one-shot global quantize pass.

Start from a canonical BF16 or F16 source model. Assemble a calibration set of roughly 512 to 2,048 sequences, with lengths representative of TinyRustLM usage. For assistant models, that set should include a mix of instruction-following, summarization, rewrite/edit tasks, structured JSON tasks, and code explanation prompts. AWQ’s core insight is exactly that activation statistics identify which channels are expensive to damage, and `llama.cpp` now exposes tensor-specific quantization controls and importance-matrix support for this kind of targeted optimization. citeturn0search4turn4view0

Then compute three tensor-local signals for every candidate tensor or tensor slice:

\[
\text{score}(t,q) = \frac{w_1 \Delta \text{NLL} + w_2 \Delta \text{PPL} + w_3 \text{activation MSE} + w_4 \text{logit KL}}{\text{bytes saved}}
\]

where each delta is measured by quantizing tensor `t` to candidate level `q` while keeping the rest of the model at the current assignment. The numerator captures “damage”; the denominator captures “budget benefit.” This is the right place to incorporate activation-aware scaling, GPTQ-style second-order fallback, and optional outlier rescue. The resulting search problem is a constrained knapsack: maximize size reduction subject to total damage staying below a calibrated threshold. citeturn0search1turn0search4turn25search13

The most robust search procedure for TinyRustLM is this:

1. Seed each tensor with a prior assignment from the sensitivity policy.
2. Run AWQ-style quantization trials at the target bitwidth.
3. If isolated tensor damage exceeds threshold, promote that tensor one level.
4. If a tensor still fails at the promoted level, try GPTQ.
5. If it still fails and is large enough to matter, add an OWQ/SpQR-style rescue list for outlier columns or blocks.
6. Re-run full-model evaluation after each budget step, not just isolated measurements.
7. Lock the result only after it clears held-out perplexity and generation checks. citeturn0search4turn0search1turn17search0turn14search0

From that pipeline, the deployment profiles I recommend are these.

### Recommended default browser profile

For a **new mixed-precision `SLM2` format**, the default browser profile should be:

- Norms: `f32`
- Embeddings: `q4_K`
- Output head: `q6_K`
- Attention Q/K: `q4_K`
- Attention V/O: `q5_K`
- FFN gate/up: `q4_K`
- FFN down: `q5_K`
- Promotion rule: final quarter of layers bump one level if isolated score is above threshold
- Emergency downgrade rule: lower embeddings and earlier FFN gate/up before touching output head, V/O, or FFN down

This is, in effect, a TinyRustLM-tailored version of the empirical logic already embedded in `Q4_K_M` style recipes, with a slightly more conservative treatment of V/O and FFN down. It should be the best default for usable assistant quality per byte. citeturn31view0turn30view0

For an **immediate `SLM1`-compatible profile** that stays inside today’s published `q8_0/q4_0` world, use:

- Norms: `f32`
- Bulk tensors: `q4_0`
- Output head: `q8_0`
- Attention V/O: `q8_0` in the last third of layers
- FFN down: `q8_0` in the last third of layers
- Everything else: `q4_0`

That is not as good as `q4_K/q5_K/q6_K`, but it is production-shippable in the current TinyRustLM envelope and directly consistent with the existing decoder set. citeturn20view0turn19view0

### Aggressive mobile profile

The aggressive mobile profile should prefer *simpler decoders* when CPU is the bottleneck:

- Norms: `f32`
- Embeddings: `q3_K` or `q4_0` if decoder simplicity matters more than fidelity
- Output head: `q5_K`
- Attention Q/K: `q3_K`
- Attention V/O: `q4_K`
- FFN gate/up: `q3_K`
- FFN down: `q4_K`, promoted to `q5_K` in sensitive late layers
- Hard rule: never put norms, output head, or FFN down at `q2`
- Soft rule: permit `q2` only for embeddings or earliest FFN gate/up tensors after explicit held-out clearance

This profile will usually outperform a naïve all-`q3_K` or all-`q4_0` artifact because it spends bits where the assistant actually needs them. On devices where CPU throughput matters more than absolute fidelity, preserve a `q4_0` fallback because simpler 4-bit decoders can outperform richer K-quants on CPU. citeturn29search0turn30view0turn24view0

### High-quality desktop profile

The desktop-biased profile should lean into `q5_K/q6_K/q8_0`:

- Norms: `f32`
- Embeddings: `q5_K`, or `q6_K` if tied to the output head
- Output head: `q8_0`
- Attention Q/K: `q5_K`
- Attention V/O: `q6_K`
- FFN gate/up: `q5_K`
- FFN down: `q6_K`
- Promotion rule: allow the last third to rise to `q8_0` selectively if isolated tensor score justifies it

This gives up some compression, but it should stay close to the “very low quality loss” operating region that `llama.cpp` historically associates with `Q5_K_M` and `Q6_K`, without wasting `q8_0` on the easy parts of the network. citeturn30view0turn4view0

## SLM metadata and Rust WASM decoding strategy

The right file-format move is to preserve TinyRustLM’s current strict admission model and add a **quantization catalog** rather than embedding ad hoc per-format assumptions in the loader. The current `.slm` contract already emphasizes explicit dimensions, tensor entries, checksums, and bounded validation. Extend that, do not replace it. citeturn19view0

A production-ready `SLM2` quantization metadata schema should add four things the current public docs do not yet surface: per-tensor quant identity, per-format layout description, calibration provenance, and compatibility gates.

A compact JSON representation of the same information could look like this:

```json
{
  "slm_version": 2,
  "model": {
    "arch": "decoder_transformer",
    "hidden_size": 1024,
    "n_layers": 24,
    "vocab_size": 50257,
    "tied_embeddings": false
  },
  "compatibility": {
    "endianness": "little",
    "requires_wasm_simd128": false,
    "has_scalar_fallback": true,
    "proof_mode_deterministic": true,
    "supports_local_only_attestation": true
  },
  "quant_catalog": [
    {
      "id": 1,
      "quant_type": "q4_k",
      "block_size": 256,
      "subblock_size": 32,
      "scale_layout": "superblock_scales_and_mins",
      "scale_dtype": "fp16",
      "has_zero_point": true,
      "payload_alignment": 16
    },
    {
      "id": 2,
      "quant_type": "q6_k",
      "block_size": 256,
      "subblock_size": 16,
      "scale_layout": "int8_scales_plus_fp16_super_scale",
      "scale_dtype": "mixed",
      "has_zero_point": false,
      "payload_alignment": 16
    }
  ],
  "calibration_profile": {
    "profile_id": "assistant-general-v1",
    "sample_count": 1024,
    "token_count": 196608,
    "max_seq_len": 256,
    "seed": 1729,
    "baseline_ppl": 8.41,
    "baseline_nll": 2.13,
    "domains": ["instruction", "rewrite", "json", "code-explain"],
    "dataset_checksum": "sha256:..."
  },
  "tensors": [
    {
      "name": "layers.23.ffn_down.weight",
      "shape": [4096, 11008],
      "quant_id": 2,
      "isolated_delta_ppl": 0.012,
      "activation_sensitivity": 0.84,
      "logit_kl": 0.006,
      "payload_checksum": "blake3:..."
    }
  ]
}
```

In the binary artifact, I would keep the existing header and tensor directory philosophy, then add three fixed chunks: `QCAT` for quant catalog, `CPRF` for calibration profile, and `TSEN` for per-tensor sensitivity and isolated deltas. That gives the runtime enough information to validate compatibility without requiring external manifests, and it gives the evaluator enough provenance to prove how the artifact was produced. The minimum required fields are exactly the ones you requested: tensor quant type, scale layout, block size, checksum, calibration profile, and compatibility flags. citeturn19view0turn21view0

On the runtime side, the safest Rust/WASM strategy is **dual-artifact shipping**: one scalar module and one `simd128` module. The WebAssembly feature-status page explicitly points developers to feature detection at runtime, and the Rust `wasm32-unknown-unknown` platform documentation recommends gating functionality with `cfg(target_feature = "simd128")` rather than assuming SIMD everywhere. That combination is ideal for TinyRustLM because it keeps the “strict runtime contract” intact: the page can detect SIMD support before loading the module, choose the matching Wasm binary, and still preserve deterministic proof paths in scalar mode. citeturn27search2turn16search15turn16search21

I would implement decoding in three tiers.

The **scalar tier** should support `q4_0`, `q8_0`, `q4_K`, `q5_K`, `q6_K`, and `q3_K`, with `q2` behind an explicit experimental flag. Scalar decode should operate on *microtiles*, not full tensors. For K-quants, decode a 256-weight super-block into a small stack or scratch tile, immediately consume it in GEMV/GEMM, then discard it. Do not ever materialize a full dequantized matrix in browser memory. That matches the spirit of `llama.cpp`, where packed low-bit representations are used directly at runtime, and it matches TinyRustLM’s current memory-conscious, on-demand dequantization posture. citeturn28search0turn20view0

The **SIMD tier** should use `core::arch::wasm32` intrinsics with 16-byte-aligned payloads. For `q8_0`, the kernel is straightforward: load packed int8 lanes, widen, broadcast the block scale, and accumulate. For `q4_0`, unpack low and high nibbles into signed lanes, subtract the format bias, widen, multiply by the scale, and accumulate. For K-quants, the engineering pattern should be “decode scales once per super-block, then vectorize the sub-block loop.” The extra metadata in `q4_K/q5_K/q6_K` is exactly why they preserve quality better, but it also means the implementation should predecode scale/min tables into lane-friendly temporary arrays before the inner multiply loop. citeturn10view0turn9view1turn9view2turn9view3turn16search7

The **proof tier** should disable relaxed behavior. TinyRustLM’s own verification docs already emphasize deterministic validation, seeded sampling, fixed candidate caps, and no relaxed SIMD in proof paths. Preserve that distinction. In other words, your “fast path” and your “proof path” can share the same format, but they should not have to share the exact same kernel strategy. citeturn21view0

## Evaluation and anti-cheating verification

The evaluation plan should explicitly separate **compression quality**, **assistant usefulness**, and **proof of locality**.

Perplexity still matters, and `llama.cpp` itself frames quantization quality primarily in terms of perplexity or KL-divergence. But it should not be the only metric. A 2024 large-scale evaluation of quantized LLMs measured effects across basic NLP, emergent ability, trustworthiness, dialogue, and long-context tasks precisely because single-metric evaluation misses real regressions. For TinyRustLM assistants, the right policy is: perplexity is the gatekeeper, but generation diagnostics decide whether the model is shippable. citeturn4view0turn13search0

The production evaluation suite should have four layers.

The **perplexity layer** should measure at least three held-out corpora: a general-language set, an instruction/dialogue set, and a TinyRustLM-targeted assistant set containing rewrite/edit, summarization, JSON extraction, and code explanation tasks. The calibration corpus and evaluation corpus must be hash-disjoint, and the artifact should store both hashes in the `CPRF` block. That is the easiest way to prevent accidental calibration leakage. citeturn19view0turn21view0

The **fixed-prompt layer** should contain a stable benchmark pack with fixed seeds and exact expected diagnostics, not exact canned completions. Measure first-token latency, tokens per second, completion length, repetition rate, stop-reason distribution, invalid JSON rate, refusal rate on benign prompts, markdown formatting stability, and edit faithfulness for rewrite tasks. Fixed prompts are necessary for longitudinal regression tracking; they are not sufficient to prove real quality. citeturn21view0turn26view0

The **randomized-holdout layer** is what proves the model is not living off prompt-specific hacks. Generate prompts with session-specific nonces and randomized source material, then ask the model to transform or reason over that exact randomized input. Good examples are: rewrite a paragraph that contains a random nonce; summarize a randomly chosen local text block; produce JSON keyed by a random field order; explain code where variable names are freshly randomized; answer questions about a synthetic table generated in-browser at runtime. If the evaluation source is generated after the model loads, canned-response tricks stop working. citeturn26view0turn33view0

The **generation-diagnostics layer** should compare the quantized model against its BF16 or F16 reference on the same prompts, with the same seed and same sampler settings. Track logit KL on teacher-forced runs, exact-token agreement at temperature `0`, semantic agreement under paraphrases, length bias, EOS timing, repetition bursts, and “instruction drop” rates. Quantization regressions in small assistants often show up first as premature EOS, mode collapse, list truncation, and malformed JSON before they show up as dramatic perplexity changes. citeturn13search0turn25search1

To prove that evaluation quality did **not** come from hidden remote inference, add a separate locality harness. TinyRustLM already exposes “browser-local runtime,” “no prompts sent to a server,” and provenance fields for planned versus actual fetches. Use that. During every evaluation run, intercept `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, WebRTC data channels, and loopback exceptions in the browser harness, then assert that the runtime’s “Actual Fetches” counter stays at zero throughout generation. Re-run the same suite with the browser in full offline mode and require token-identical outputs in proof mode. If the model only “works” when the network is available, it fails admission. citeturn26view0turn33view0turn21view0

The right final admission rule is therefore simple:

A candidate quantized `.slm` passes only if it clears held-out perplexity thresholds, keeps fixed-prompt diagnostics inside tolerance, reproduces acceptable behavior on randomized nonce-conditioned prompts, and generates under a network-denied browser harness with zero actual fetches and deterministic replay in proof mode. That combination is strong enough to rule out prompt-specific hacks, canned outputs, and hidden remote inference while still being fully aligned with TinyRustLM’s published local-first runtime model. citeturn21view0turn26view0turn33view0

The bottom-line recommendation is to make **`q4_K` the new bulk browser format, `q5_K/q6_K` the protection band for fragile tensors, `q4_0` the compatibility/throughput fallback, and `q2` an explicitly experimental escape hatch**. Implement the search with AWQ-first, GPTQ-fallback, outlier rescue only where calibration proves it is worth the added decoder complexity, and ship the result in a versioned `.slm` format with explicit quant catalog, calibration provenance, and compatibility flags. That is the most production-realistic path to smaller TinyRustLM artifacts without sacrificing assistant usefulness. citeturn0search4turn0search1turn17search0turn31view0turn20view0