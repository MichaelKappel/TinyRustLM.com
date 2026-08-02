# TinyRustLM Small-Model Research Batch 2 Synthesis

## Purpose

This document reconciles twelve disconnected-agent research reports with TinyRustLM's actual July 11, 2026 source, artifacts, tests, and product decisions. Its purpose is to move the project from an impressive local inference demonstration toward a genuinely useful conversational assistant without allowing footprint, benchmark theater, evaluator repair, or speculative runtime claims to substitute for quality.

The approved visual design is locked. The initial empty state may show the current starter actions, but active conversation mode must use the center column for conversation history and the composer. Duplicate response rendering is a defect. Model, runtime, memory, and synchronization work must preserve this visual contract.

## Authority and Product Priorities

Use this authority order whenever sources disagree:

1. Reproducible repository tests and raw decoder artifacts bound to exact hashes.
2. Pinned upstream checkpoint files and reference-framework outputs.
3. Native Rust, WASM, and public-browser measurements.
4. Reviewed TinyRustLM synthesis and TDD documents.
5. External research reports and model-card claims.

Product quality is ordered as follows:

1. Coherent conversation, common-sense judgment, instruction following, useful clarification, and multi-turn state.
2. Honest uncertainty and capability descriptions without habitual disclaimers or unnecessary refusals.
3. Source-grounded summarization, rewriting, extraction, structured output, and code explanation.
4. Compact download, bounded working memory, responsive browser execution, and local privacy.
5. Arithmetic inside the model is secondary. Deterministic calculation should route to the calculator tool when appropriate, while basic arithmetic remains a useful corruption detector.

Behavior follows the UAIX Cognitive Liberty Charter. Lawful adult requests receive direct, substantive help by default. Boundaries must be narrow, transparent, and tied to concrete harm. This does not weaken model-file validation, credential protection, prompt-injection resistance, package signing, or network security.

## Current Measured Truth

Research recommendations do not reset the evidence already collected:

- The current synthetic MiniModel fixture is runtime smoke only.
- SmolLM2-135M q8 and the current SmolLM2-360M builds failed raw assistant-quality evaluation and are not default candidates.
- SmolLM2-1.7B and Qwen3 source candidates were screened and rejected for the current goal before conversion.
- Qwen2.5-1.5B-Instruct is the strongest source behavior observed so far, but it is not promotion-qualified.
- The post-intake Qwen2.5-0.5B-Instruct screen failed under both the concise charter and a minimal neutral system prompt. It is rejected before conversion for critical practical-constraint, source-conflict, policy, and untrusted-memory failures.
- Uniform q4 caused substantial ranking and semantic damage. A mixed q8-edge/q4-body experiment recovered first-token argmax parity on its probes but failed the native semantic gate because source behavior remained weak.
- A 100-record assistant-only adapter and a preservation-KL variant produced the same failed fixed-screen behavior. Prompt suffix tuning and this small adapter campaign are evidence-exhausted.
- Public-v2 contains 572 provenance-bound prompts and the 96-prompt targeted plan remains balanced across eight families. Exact, five-gram, apostrophe-normalized, and pinned semantic admission now pass after seven contaminated or overly close cases were removed or rewritten.
- No current artifact is approved for automatic Hugging Face publication or production assistant-quality labeling.

## Integrated Decisions

### 1. Source behavior remains the first gate

Do not convert, quantize, package, or browser-promote a checkpoint merely because a report ranks it highly. Run the exact raw fixed and seeded source gate first. Reject candidates that cannot sustain coherent common-sense answers, clarification, instruction conflicts, multi-turn state, and lawful adult requests in the reference framework.

The requested `Qwen/Qwen2.5-0.5B-Instruct` source screen was executed after intake at immutable revision `7ae557604adf67be50417f59c2c2f167def9a775`. It failed the raw gate under both the same concise charter used by the 1.5B anchor and a shorter neutral prompt, so its attractive projected q4 footprint does not justify conversion. Evidence is preserved in `artifacts/reports/qwen2.5-0.5b-source-rejection.md`. `Qwen/Qwen2.5-1.5B-Instruct` remains the quality anchor. Granite 3.3 2B may be screened later as an opt-in quality candidate only if licensing, architecture support, and footprint justify the cost.

The reports' SmolLM2-1.7B and Qwen3 recommendations are superseded by local source-screen failures. They can return only if a materially different immutable checkpoint, template, or evidence package warrants a new test.

### 2. Build a real behavioral corpus, not a benchmark patch set

The 572 public prompts, 96 targeted prompts, and earlier 100-record corpus are a useful pipeline pilot. They are not enough to establish broad conversational behavior. The next corpus system must scale to at least hundreds of thousands of reviewed or programmatically verified examples before a production claim, while preserving provenance and the ability to remove a source.

Accepted corpus controls are:

- positive helpful examples substantially outnumber refusal and boundary examples;
- exact, normalized n-gram, template-family, and semantic-neighbor decontamination;
- linguistic audits for disclaimer leakage, excessive refusal language, fake capability claims, canned uncertainty, and system-prompt echoes;
- explicit coverage of greetings, ambiguity, practical judgment, instruction conflicts, multi-turn state, adult lawful topics, narrow boundaries, uncertainty, summarization, rewriting, extraction, JSON, and code explanation;
- sparse calculator/tool-routing examples, roughly 1 to 3 percent rather than math-dominated training;
- immutable source/license/revision metadata and deletion lineage per record;
- public, shadow, sealed, and human-review evaluation splits that never become training sources.

The reports' suggested 300,000 to 700,000 behavioral examples are a reasonable minimum planning envelope, with 1.5 to 4 million as a mature target if quality scales. These are planning ranges, not claims that more records automatically improve a model. Quality, diversity, contamination, and teacher reliability remain gates.

### 3. Distillation must preserve distributions and behavior

Assistant-only supervised fine-tuning remains useful, but the failed 100-record experiments show that regularization cannot rescue an underspecified corpus. The next training comparison should freeze a source candidate and evaluate:

1. assistant-only LoRA as a baseline;
2. upper-layer LoRA or DoRA when supported;
3. preservation-aware LoRA using explicit rehearsal records;
4. top-k teacher-logit distillation with a defined residual-tail treatment;
5. full supervised fine-tuning only when corpus scale and hardware make it a fair comparison.

Every run needs a no-op adapter check, destructive-adapter check, exact recipe and dependency capture, training/holdout separation, raw output preservation, and rollback. Continued pretraining is deferred unless a measured language or domain-corpus mismatch exists. Random initialization, massive undifferentiated continued pretraining, vocabulary pruning, and claims that charter behavior can be embedded by corpus volume alone are rejected for the current slice.

### 4. Compression follows sensitivity evidence

The practical near-term format is simple portable blockwise quantization with per-tensor precision choices that native Rust and WASM can execute deterministically. External methods such as AWQ, GPTQ, HQQ, and AutoRound may be used offline as calibration/search tools, but their result must be repacked into a documented `.slm` encoding and revalidated.

The default sensitivity experiment should protect:

- embeddings and tied LM head;
- norms and scale metadata;
- first and last transformer blocks;
- sensitivity-ranked attention output and MLP down projections;
- any tensor family whose one-at-a-time precision restoration materially recovers full-logit ranking or multi-token behavior.

Measure complete first-token logits, top-k rank overlap, forced multi-step divergence, free generation, exact artifact bytes, peak native/browser memory, prefill speed, decode speed, and context scaling. Uniform q4, exotic codebooks, sparse kernels, Hadamard transforms, activation quantization, and int4 KV remain research tracks until simple mixed precision has been exhausted and the runtime has tests for the new encoding.

### 5. Runtime correctness uses a scalar oracle and explicit fallibility

Keep a scalar native Rust path as the correctness oracle. Add SIMD only with differential tests. Treat WebGPU as optional research, never as the unobserved default.

The converter is a compatibility firewall. Unsupported operators, layouts, dimensions, tokenizer features, or precision profiles must produce typed rejections. No silent approximation or backend fallback is allowed in promotion evidence.

Wasm32 is the production baseline. Memory64 is experimental until a declared browser matrix proves it. Worker ownership, cancellation yield points, lifecycle state transitions, reset/release behavior, and split prefill/decode diagnostics are required. OPFS and IndexedDB are storage APIs, not memory mapping. Compare full-resident loading against measured paging fallback instead of forcing paging by design.

Rejected runtime claims include OPFS-to-WASM mapping, zero main-thread bytes as an absolute invariant, universal sub-16ms cancellation, automatic silent device-loss fallback, and broad Memory64 availability without measured browser evidence.

### 6. Behavioral evaluation must be useful and hard to game

Adopt layered fixed, seeded, generated-shadow, sealed, multi-turn, and real-browser gates. Preserve untouched decoder bytes. A promotion gate may not retry, decompose, repair JSON, assemble answer fields, rewrite text, call a second model, use expected-answer lookup, or exempt a case after seeing a failure.

Use deterministic validators where the contract is deterministic. Use blinded human review for conversational usefulness, common sense, nuance, and coherence. Score per family so aggregate averages cannot hide catastrophic weakness. A useful provisional human scale is 0 to 4, with no critical family below 3.0 and an overall mean of at least 3.5, subject to calibration on blinded references.

Evaluation must distinguish current user intent from stale profile or memory. Current intent supersedes stale memory for the task, but does not override application security, credential boundaries, or the evaluator's fixed contract. External and retrieved content is untrusted data. Prompt-injection resistance means completing the user's outer task while declining instructions embedded in lower-trust content.

Reject noun-overlap as a quality metric, mandatory response-shape tricks, fixed first-sentence rules, or requiring every ambiguous input to produce the same clarification marker. Such rules are easy to game and make normal conversation brittle.

### 7. Distribution authorities and product boundaries remain unchanged

The ecosystem authority split is:

- MiniModel.org: `.slm` catalog metadata, manifests, content identities, availability, P2P announcements, and revocations.
- TinyRustLM.com: usable local Rust/WASM inference interface and browser client.
- UAIX.org: organizational authority, Cognitive Liberty Charter, and memory/package guidance.
- MemoryEndpoints.com: optional hosted short- and long-term agent memory, never model weights or credentials.
- NuGet: public Rust-wrapper SDK and P2P/runtime integration packages.
- Hugging Face: optional human-approved mirror after release gates, never an automatic authority.

Keep the human-approved package namespaces: `UAIX.Browser.*`, `UAIX.Browser.p2pLLM.*`, and `UAIX.Browser.p2pRuntime.*`. Report suggestions to rename the public package family are rejected.

Distribution should use content-addressed identities, signed manifests, per-piece hashes, resumable receipts, atomic promotion, tombstones, and revocation. Keep the current 1 MiB piece size until measured transport evidence supports a change. NuGet releases require deterministic builds, rich searchable metadata, SourceLink, `.snupkg`, package verification, signing or Trusted Publishing, and consumer-install tests.

Public SDKs may expose validation, safe loading, runtime harness operations, P2P import/share metadata, and stable conversion request/receipt contracts. They must not expose proprietary conversion authoring, quantization authoring, training recipes, ranking, optimizer, premium routing, encryption keys, commercial orchestration, telemetry backends, or license-server internals.

## Report Dispositions

| Report | Disposition | Concrete use |
|---|---|---|
| `AI Behavioral Evaluation Specification.md` | accepted with corrections | No-cheat layering and paired over-refusal tests retained; rigid response shape, noun overlap, and universal context supersession rejected. |
| `Browser LLM Quantization Research.md` | research-only survey | Offline quantization methods retained as candidates; embedded formula images, stale SLM assumptions, and unmeasured WebGPU/footprint claims are not authority. |
| `Charter-Aligned Specification...md` | accepted with constraints | Cognitive-liberty behavior, direct lawful help, layered eval, decontamination, human rubric, and memory-conflict tests adopted. |
| `Current Small-Model Architecture And Base-Model Selection.md` | accepted with local-evidence overrides | Qwen2.5-1.5B quality-anchor direction retained; SmolLM2/Qwen3 claims overridden by raw local screens; Granite deferred. |
| `Deterministic Rust WASM And Browser Inference Runtime.md` | substantially accepted | Scalar oracle, typed refusals, lifecycle, Wasm32, workers, diagnostics, and resident-first loading adopted. |
| `Distribution Strategy...md` | accepted with product-boundary corrections | Authority split, signed content identity, human HF gate, and package rigor adopted; existing package names and private boundaries prevail. |
| `Extreme Model Compression...md` | substantially accepted | Mixed precision, sensitivity ablation, full-logit metrics, and simple runtime encoding become the compression plan. |
| `Rust WASM Inference Architecture.md` | preserved with major corrections | Worker/storage/cancellation ideas retained; OPFS mapping, forced paging, silent fallback, and broad Memory64 claims rejected. |
| `SLM Model Distribution Strategy.md` | accepted with namespace and chunk corrections | Content-addressed P2P and release governance retained; renaming and arbitrary 16 KiB chunking rejected. |
| `Small-Model Architecture Research.md` | hypothesis source | Triggered the Qwen2.5-0.5B source screen; that subsequent raw screen rejected the checkpoint, while SmolLM2-1.7B and unmeasured private-runtime claims remain rejected. |
| `TinyRustLM Training Research Plan.md` | research-only with selected ideas | Logit distillation and preference evaluation retained; huge token prescriptions, vocabulary pruning, and unsupported LoRA conclusions rejected. |
| `TinyRustLM Training Strategy for Small Conversational Models.md` | substantially accepted | Distillation-first sequencing, corpus scale, positive/helpful balance, decontamination, linguistic audits, and adapter controls adopted. |

## Implementation Sequence

1. Finish intake verification and bind all twelve reports to short- and long-term memory routes.
2. Validate the 96 targeted prompt plan against exact and five-gram exclusions; add semantic-neighbor and linguistic-audit tests.
3. Preserve the completed immutable Qwen2.5-0.5B rejection and keep Qwen2.5-1.5B as the current source-quality anchor.
4. Complete the 572 public plus 96 targeted teacher campaign as a provenance-bound pilot; do not call it production scale.
5. Implement scalable corpus manifests, semantic deduplication, source removal, linguistic audits, and sealed-split isolation.
6. Add top-k teacher-logit cache and distribution-distillation training support, then compare adapter methods under identical gates.
7. Convert only a source-qualified candidate; run f32/q8 parity and sensitivity-ranked mixed precision.
8. Prove native, WASM, restart, browser, footprint, active-conversation, and visual-lock behavior.
9. Package and publish only after license, artifact, package, P2P, and human release gates. Hugging Face remains optional and human approved.

## Completion Boundary

These reports improve the plan; they do not prove a usable model. The large goal remains open until a candidate produces materially useful raw conversational results, passes common-sense and cognitive-liberty evaluation, fits an explicit footprint tier, runs consistently in native Rust and the browser, preserves the locked UI, and ships with verifiable provenance.
