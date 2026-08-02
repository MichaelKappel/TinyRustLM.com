# TinyRustLM Response Quality and Footprint Synthesis

## Purpose

This document distills twelve external research reports into an implementation authority for making TinyRustLM produce genuinely useful local responses while keeping download, memory, and latency reasonable. It does not treat report confidence, benchmark prose, or public-site assumptions as proof. Every recommendation below is reconciled against the current repository and reproducible local measurements from July 11, 2026.

The approved TinyRustLM visual design remains locked. This plan changes model fidelity, quality evidence, runtime behavior, loading, and active-conversation reliability. It does not redesign the product shell.

## Authority Order

When evidence conflicts, use this order:

1. Current TinyRustLM source and deterministic tests.
2. Exact source-checkpoint files and reference-framework vectors at a pinned revision.
3. Raw native and browser/WASM measurements bound to artifact hashes.
4. This reviewed synthesis and its TDD plan.
5. The twelve preserved research reports.

No report output table is accepted as an executed measurement unless it is backed by a reproducible artifact in this repository.

## Measured Ground Truth

### Artifact and response baseline

| Candidate | Artifact bytes | Artifact MiB | Measured peak working set | Six-case wall time | Decision |
|---|---:|---:|---:|---:|---|
| MiniModel synthetic q8 fixture | 8,832 | 0.008 | not a quality run | not a quality run | Runtime smoke only; never a chat-quality claim |
| SmolLM2-135M-Instruct q8 | 136,863,168 | 130.52 | 298,172,416 bytes | 153,014 ms | Reject as default; raw outputs are semantically unreliable |
| SmolLM2-360M-Instruct q4 | 227,667,520 | 217.12 | 485,191,680 bytes | 329,644 ms | Reject current build; size is plausible but quality and latency fail |
| SmolLM2-360M-Instruct q8 | 364,654,528 | 347.76 | first-step probe only | 115,000 ms for three one-token cases | Diagnostic candidate only; too large for default unless quality proves necessary |

The raw six-case evidence is stored under `artifacts/reports/raw-quality-baseline/`. It uses one generation call, no retries, no task decomposition, no schema repair, and no UI transformation.

The 135M q8 candidate changed `2 + 2` into a different problem, hallucinated explanations for ice, Rust, and storage questions, and emitted fluent but incorrect text. The 360M q4 candidate answered `2 + 2` as two, gave an invalid explanation of modulo-based evenness, and produced irrelevant storage advice. Passing the older shallow gate did not make either model useful.

### Reference and first-step isolation

The pinned SmolLM2-360M-Instruct source checkpoint is:

- revision directory: `artifacts/external/HuggingFaceTB/SmolLM2-360M-Instruct/a10cc1512eabd3dde888204e902eca88bddb4951`
- source weight SHA-256: `e6bffe7435d7ddc10fd3b9a9efd429dafbacb1cb17015fb5562664e7532bf86e`
- architecture: hidden 960, 32 layers, 15 query heads, 5 KV heads, head dimension 64, FFN 2560, vocabulary 49,152, tied output

Reference-framework prompt token IDs match TinyRustLM exactly for the three first-step probes. This rules out tokenizer and ChatML serialization as the cause of the current first-token divergence.

| Probe | Reference top token | q4 top token | q8 top token | Finding |
|---|---|---|---|---|
| `test` | `I` (57) | `I` (57) | `I` (57) | Top-1 preserved, lower ranks drift |
| `What is 2 + 2?` | `2` (34) | `The` (504) | `The` (504), only 0.116 logit above `2` | q8 narrows but does not eliminate execution/quantization drift |
| Rust `is_even` explanation | `This` (1348) | `The` (504) | `This` (1348) | q8 restores the reference top token |

The next diagnostic boundary is therefore full f32 and q8 logit parity, tensor by tensor and target by target. Sampling changes cannot repair incorrect pre-sampling logits.

### Quality-gate false positive

The existing accepted sidecars are not sufficient quality evidence. The current eval runner can retry with helper prompts, split a requested response into separately generated fields, generate per-item text, normalize content, and assemble the result. Those features may be useful product orchestration, but they cannot count as raw model promotion evidence.

The new raw fixture exposed this problem immediately. A quality gate that passes wrong arithmetic, wrong code semantics, and unsupported advice is a gate defect even when the output is grammatical.

### Sampler mismatch

The runtime default repetition penalty is currently `4.25`. The pinned SmolLM2 generation configuration does not request a repetition penalty, so the reference behavior is effectively `1.0`. Repetition penalty does not explain the first generated token because no generated history exists yet, but `4.25` can strongly damage later tokens. Model-bound sampler defaults and post-penalty diagnostics are required before evaluating longer output.

## Consolidated Decisions

### Decision 1: no current artifact is the production default

The synthetic fixture remains useful only for parser, ABI, checksum, and load smoke. SmolLM2-135M q8 is small enough to transport but not capable enough in the measured raw path. SmolLM2-360M q4 has a plausible 217 MiB artifact and 463 MiB measured peak, but its current logits and responses are not acceptable. SmolLM2-360M q8 improves fidelity but is a 348 MiB diagnostic artifact and still misses the reference arithmetic top token.

The site must not label any of these current artifacts as a generally useful verified assistant until the new raw gate passes.

### Decision 2: fix fidelity before training a new model

The reports propose large distillation and QAT programs. Those may become valuable, but a custom student cannot be evaluated or exported safely while the current converter/runtime boundary changes the source model's logits. The first slice is a differential correctness program:

1. Capture complete reference f32 vectors for a broad prompt pack.
2. Export and run a source-equivalent f32 `.slm` diagnostic artifact.
3. Compare reference, native Rust, and WASM at prefill and decode steps.
4. Verify source tensor mapping, transpose rules, RoPE, RMSNorm, GQA grouping, tied embeddings, and quantized row reconstruction.
5. Introduce mixed q8/q4 only after sensitivity is measured.
6. Re-run raw semantic quality after mathematical parity improves.

### Decision 3: 360M is the minimum current general-assistant candidate

The two candidate reports disagree about whether 135M is useful. The raw measurements settle that question for TinyRustLM: 135M q8 is not a credible general default. It may remain a narrowly-scoped specialist experiment, but not the main assistant.

Candidate order is:

1. SmolLM2-360M-Instruct as the converter/runtime fidelity anchor.
2. A roughly 0.5B candidate such as Qwen2.5-0.5B-Instruct only after its architecture and tokenizer path have independent parity tests.
3. A custom 250M-350M distilled/QAT student only if existing open checkpoints cannot meet the combined quality and footprint gates.

No candidate wins by parameter count, benchmark reputation, or projected size alone.

### Decision 4: mixed precision is the near-term compression path

Uniform q4 materially changes first-step rankings. The next packing experiment should use only formats the runtime can prove:

- q8 for tied token embeddings / LM head;
- q8 for the first and last transformer blocks;
- q8 for sensitivity-ranked output projections or down projections;
- q4 for middle matrices that pass measured reconstruction and logit-ablation gates;
- f32 for norms and scale metadata where already required.

q5, q6, int4 KV, sparse outlier residuals, grouped K-quants, and activation quantization are deferred format/runtime features. They are not current capabilities and cannot appear in package metadata as supported until implemented and tested.

### Decision 5: raw quality is a separate promotion authority

The promotion path must capture untouched decoder output and enforce:

- one declared system prompt and one model call per case;
- frozen model, tokenizer, runtime, sampler, seed, and adapter identity;
- no retry, decomposition, generated-field assembly, regex repair, JSON fixer, retrieval, tool call, or UI rewrite;
- deterministic validators before model-assisted judges;
- public development, generated shadow, sealed release, and blinded human-review splits;
- exact semantic checks for arithmetic, extraction, JSON, code behavior, requested counts, and source-grounded summaries;
- a network witness proving no prompt-body egress.

Product orchestration may be evaluated separately, but it cannot promote a weak base model.

### Decision 6: use conservative product tiers

Provisional promotion envelopes are:

| Tier | Artifact target | Peak-memory target | Role |
|---|---:|---:|---|
| Smoke | <= 20 MiB | <= 256 MiB | Runtime verification only; never open chat |
| Feather | <= 160 MiB | <= 384 MiB | Narrow useful assistant only if raw quality passes |
| Balanced | <= 280 MiB | <= 640 MiB | Intended mainstream browser assistant |
| Quality opt-in | <= 420 MiB | <= 1 GiB | Explicit desktop-class quality option |

Artifact and memory limits are hard gates, not targets to hide with marketing. A model that misses the quality floor is rejected even if tiny. A model that passes quality but misses the default footprint becomes an opt-in tier, not an automatic download.

### Decision 7: delivery architecture follows quality proof

After a candidate passes native raw quality, implement browser delivery in this order:

1. Dedicated Worker ownership for load and generation.
2. Exact artifact identity and 1 MiB piece receipts.
3. OPFS for model bytes and IndexedDB for journals/metadata.
4. Crash-safe temporary install and atomic active-pointer promotion.
5. SIMD kernels and measured browser parity.
6. Full-resident default; paging only as a low-memory fallback.

SLM2 remains a design track, not the immediate fix. Any future binary layout must prove its actual encoded size with compile-time/roundtrip tests. The report proposals that place more than 128 bytes of fields into a 128-byte header are invalid as written.

## Accepted Research Contributions

The following report guidance is adopted:

- Treat smoke artifacts and assistant-quality artifacts as different trust tiers.
- Use full tokenizer graph, exact chat-template bytes, special-token tables, and model-bound generation settings.
- Stage differential tests as prompt bytes, token IDs, f32 logits, quantized logits, native/WASM parity, then multi-token output.
- Preserve raw decoder output and prohibit quality-gate repair or multiple calls.
- Use hidden and sealed holdouts separated by template family and semantic cluster.
- Protect tied embeddings / LM head and sensitivity-ranked layers at higher precision.
- Prefer structured pruning plus retraining over unstructured browser sparsity if custom training is later required.
- Use QAT only after an aligned full-precision checkpoint is frozen and PTQ damage is measured.
- Keep exact provenance for source revision, tensors, tokenizer, calibration, export tool, eval suite, and artifact.
- Use worker-owned, verified, resumable local delivery with atomic promotion.
- Keep the current UI visual lock and expose truthful download, memory, and quality status.

## Rejected or Superseded Claims

The following claims must not be repeated as current truth:

- The runtime cannot execute GQA. Current source and converted SmolLM2 runs prove GQA execution exists.
- Quantization damage is ruled out. q4/q8 first-step probes prove precision-dependent ranking changes.
- The public 30-run tables are measured evidence. At least one report admits it could not execute those runs; another presents unsupported synthetic telemetry.
- SmolLM2-135M is a reliable general assistant. The raw q8 evidence contradicts that claim.
- Scalar WASM will produce 35-160 tokens per second for these models. Those projections conflict with measured local runtimes and require real browser benchmarks.
- A smoke model can act as an intent router. Untrained deterministic weights cannot support that product claim.
- TinyRustLM should abandon `.slm` for GGUF. GGUF can be an import source, but the product strategy requires a protected, verifiable `.slm` runtime format.
- A fixed `[CLARIFICATION_REQUIRED]` string or min-p tuning until a test passes proves uncertainty handling. That is benchmark-specific behavior shaping.
- Greedy quantized output must always be byte-identical to f32 reference output. Quantized promotion requires bounded vector/ranking drift plus semantic gates, not an impossible universal identity rule.
- q5/q6, int4 KV, sparse residuals, SLM2, WebGPU, OPFS paging, or custom QAT are implemented now. They remain future work.
- The proposed SLM2 header tables are implementation-ready. Their stated field sizes and offsets are internally inconsistent.

## First Large Implementation Slice

The next large slice is **Reference-Locked Conversion and Runtime Fidelity**.

It is complete only when:

1. A checked-in golden pack binds source revision, config/tokenizer hashes, rendered prompt bytes, token IDs, full f32 logits, top-N rankings, and multi-step decode vectors.
2. Native f32 `.slm` matches the pinned reference within declared numerical tolerances on all conformance cases.
3. WASM matches native Rust within a separately declared target tolerance.
4. q8 clears the broad top-token and full-vector gates.
5. A mixed q8/q4 artifact is generated from measured tensor sensitivity, stays within the Balanced envelope, and beats uniform q4 on raw quality.
6. Model-specific sampler defaults replace the hardcoded `4.25` penalty path and pass sampler parity tests.
7. Raw semantic eval catches the known wrong arithmetic, Rust, ice, and storage answers.
8. No older transformed sidecar can claim assistant-quality admission by itself.

Only after this slice passes should the browser default, progressive model delivery, or custom distillation program be promoted.

