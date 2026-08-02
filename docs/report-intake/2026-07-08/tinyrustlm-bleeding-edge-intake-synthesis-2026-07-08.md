# TinyRustLM Bleeding-Edge Intake Synthesis - 2026-07-08

## Purpose

This synthesis processes the full `agent-file-handoff/Improvement` batch that was preserved in `docs/report-intake/2026-07-08/`. The batch is not a single feature request. It is a system plan for making TinyRustLM a real browser-local `.slm` runtime, a MiniModel-compatible model-sharing ecosystem, and a protected open-core SDK surface.

The durable raw reports remain the authority for full text. This document distills the implementation plan, cross-report decisions, TDD gates, and boundaries that should drive future work.

## Core Decision

TinyRustLM should not chase "small model" quality by only shrinking bytes. The reports converge on a layered strategy for .slm trust, runtime quality, browser execution, P2P growth, and protected SDK distribution:

1. Keep the approved TinyRustLM.com UI locked.
2. Make the Rust/WASM `.slm` runtime produce coherent outputs on real quality-capable models.
3. Treat `.slm` as a strict executable weight artifact plus rich, policy-validated sidecar metadata.
4. Use honest eval gates before claiming assistant quality.
5. Prefer curated MiniModel-ready `.slm` models and metadata-first P2P distribution.
6. Compress through model choice, distillation, calibration, quantization, and runtime-aware packing, in that order.
7. Keep public NuGet/open-core APIs useful but too narrow to reconstruct the commercial authoring, ranking, optimization, and orchestration product.

## Report Groups Used

### Runtime Quality And Honest Eval

Reports:

- `TinyRustLM Runtime Quality And Tiny Model Candidate Research.md`
- `TinyRustLM Runtime Quality Optimization.md`
- `TinyRustLM Eval Gate Design.md`
- `Honest TinyRustLM Eval Gate Design for Real Response Quality.md`
- `Real Tiny Model Candidate Research.md`
- `Best Practices for Running Small LLMs in the Browser with Wasm.md`
- `WASM LLM Runtime Research.md`

Distilled plan:

- Continue separating fixture smoke models from quality-capable assistant models.
- Treat repeated characters, prompt echo, empty output, malformed JSON, tokenizer corruption, and max-token truncation as hard quality failures.
- Keep fixed and seeded holdout eval cases. Do not accept exact canned answers as quality evidence.
- Use prompt templates declared by model metadata, not filename guesses.
- Keep real generation inside the Rust/WASM runtime path used by the browser.
- Make generation diagnostics first-class: model id, `.slm` checksum, tokenizer, prompt format, sampling config, seed, prompt token count, generated token count, stop reason, selected token, top candidates, and quality failures.
- Implement streaming and worker isolation as production work, but keep it behind tests that prove UI responsiveness and no prompt exfiltration.

Implementation implications:

- `tinyrustlm/runtime/src/generate.rs`, `sampler.rs`, `tokenizer.rs`, `eval_runner.rs`, and browser smoke tests remain the first line of defense.
- Future quality work must start by adding or tightening tests, then improving the runtime/model path.
- The default demo fixture may remain useful for loader proof, but cannot be marketed as assistant quality.

### `.slm` Trust Metadata And Verification

Reports:

- `Trustworthy Metadata and Verification Framework for .slm Model Packages.md`
- `slm Model Metadata Format Research.md`
- `SLM File Compression Research.md`
- `Compression Research for a Browser-First SLM Container.md`

Distilled plan:

- Keep the `.slm` binary loader strict and compact.
- Add richer trust and capability data through signed sidecar metadata, not by turning the loader header into an unbounded manifest.
- Use policy tiers: `demo-fixture`, `experimental`, and `quality`.
- Never infer capability from filename, model family, or catalog position alone.
- Fail closed when tokenizer, prompt template, provenance, license, eval, or P2P integrity evidence is missing for a claimed tier.
- Bind P2P manifests, piece hashes, Merkle roots, and local reassembly receipts to the `.slm` artifact hash.

Implementation implications:

- Current `.slm` parser validation should stay fail-closed.
- The next metadata shape should be schema-validated, checksum-bound, and policy-evaluable before UI admission.
- The UI should show tier and evidence plainly without changing the approved visual design.

### P2P Distribution And MiniModel Strategy

Reports:

- `MiniModel and TinyRustLM Metadata-First P2P Quality Distribution Research.md`
- `P2P Model Distribution Research.md`

Distilled plan:

- Project servers and public catalogs should publish metadata, not user model bytes.
- P2P import should require known peer consent, exact piece hashes, artifact hash validation, and a local receipt before browser import.
- Peer availability metadata must never substitute for integrity proof.
- MiniModel should be the compatibility and catalog authority for `.slm` adoption.
- Hugging Face discovery should stay metadata-first until a local conversion or verified P2P `.slm` is available.

Implementation implications:

- Existing peer-source announcement, local share kit, import receipt, and unsafe-peer-url tests should remain mandatory.
- The next network step is a consent-based peer companion or endpoint service that serves pieces locally, never a hosted project-server byte mirror.

### Quantization And Compression

Reports:

- `Advanced Quantization Strategies for TinyRustLM SLM Models.md`
- `Production Mixed-Precision Quantization Pipeline for TinyRustLM SLM Models.md`
- `TinyRustLM Quantization Research.md`
- `TinyRustLM Quantization Research Plan.md`
- `Tiny Model Compression Research.md`
- `Structural Model Compression Research.md`
- `Structural Compression Strategy for TinyRustLM .slm Models.md`
- `Bleeding-Edge Nano Model Compression.md`
- `Bleeding-Edge Nano Model Compression Part 2.md`
- `SLM File Compression Research.md`
- `Compression Research for a Browser-First SLM Container.md`

Distilled plan:

- Use `q8_0` as the regression/reference tier.
- Keep `q4_0` useful as the current memory-first tier.
- Add future groupwise dtypes conservatively: `q6_g128`, `q5_g128`, then `q4_a128` with optional q8 outlier sidecar.
- Treat `q3` as conditional: it is justified only if it allows a larger, better base model within the same memory budget.
- Treat `q2` and codebook/rotation-heavy formats as experimental until there is a benchmark-backed runtime reason to accept the complexity.
- Prefer directly decodable weight-only formats for Rust/WASM. Avoid mainline formats that require irregular codebook lookups or full f32 materialization.
- Separate tensor payloads from scale/min/outlier streams using the existing tensor-directory concepts where possible.
- Benchmark both quality and browser memory behavior before making a quantized dtype public.

Implementation implications:

- New dtypes need parser validation, writer validation, native runtime kernels, WASM smoke, quality eval, artifact-size evidence, and P2P metadata support.
- Compression claims must include size, peak memory, latency, eval quality, and failure-mode evidence.

### Distillation And Model Candidate Strategy

Reports:

- `Bleeding-Edge Nano Model Distillation.md`
- `Nano Model Distillation Research.md`
- `Distilling and Using Nano Models.md`
- `Tiny Model Distillation Strategy.md`
- `Distillation Strategy for TinyRustLM-Compatible Tiny .slm Models.md`
- `Tiny Model Distillation and Pruning for High-Quality .slm Models.md`
- `Real Tiny Model Candidate Research.md`

Distilled plan:

- For general chat, sub-10MB broadly capable decoder-only models are not realistic today. Quality requires a real instruction-tuned model, then careful quantization.
- The near-term TinyRustLM quality tier should target roughly 125M to 500M parameter models in q4/q5/q6, with q8 retained for reference where practical.
- Distillation should be model-family aware: tokenizer, prompt format, architecture, and attention layout must remain compatible with TinyRustLM.
- The best student pipeline is multi-stage: teacher selection, synthetic/instruction data policy, response-style distillation, optional logit/hidden-state distillation, QAT/PTQ, then honest TinyRustLM runtime eval.
- Pruning and sparsity are useful only when the runtime kernel can exploit them. Unstructured sparsity is not a first mainline browser target.

Implementation implications:

- Keep Stories-15M classified as real conversion progress but not assistant quality.
- Keep SmolLM2-style instruction-tuned routes as quality-capable evidence only when the honest eval and browser path pass.
- Add a curated "works in our system" model list that starts from known-compatible architecture and tokenizer families, not generic popularity alone.

### Browser Runtime And UX Lock

Reports:

- `Best Practices for Running Small LLMs in the Browser with Wasm.md`
- `WASM LLM Runtime Research.md`
- `TinyRustLM Runtime Quality Optimization.md`

Distilled plan:

- Preserve the current UI/UX exactly.
- Move heavy inference into worker-backed execution under a test gate, not as a visual redesign.
- Use pre-sized memory budgets, bounded context, deterministic cleanup, and recoverable errors.
- Add Cache API or OPFS storage for verified model assets after user consent.
- Feature-detect cross-origin isolation, SIMD, threads, memory budgets, and fallback paths.
- Use append-style streaming updates with backpressure, not repeated full text rewrites.

Implementation implications:

- Browser tests should prove local-only requests, UI responsiveness, worker fallback, and no model-byte fetch from project servers unless explicitly permitted by a verified local/P2P flow.
- Visual-lock tests must remain mandatory after any UI-affecting change.

### Open-Core, NuGet, And Commercial Boundary

Reports:

- `Open-Core LLM Module Sharing Strategy.md`
- `TinyRustLM to NuGet Packaging Plan for Protected .NET Distribution.md`

Distilled plan:

- Public packages should expose `.slm` validation, safe loading, runtime harness calls, P2P import/share metadata workflows, memory/persona harness integration, and developer-friendly wrappers.
- Public packages should not expose authoring internals, quantization authoring, premium weights, adapter authoring, selector generation, breeding/evolution, eval/provenance authoring, premium routing, optimizer logic, telemetry backends, license-server internals, or enterprise orchestration.
- Protection comes primarily from boundary minimization and private implementation, not obfuscation.
- NuGet metadata should be searchable for UAIX, TinyRustLM, p2pRuntime, p2pLLM, MiniModel, `.slm`, `.uai`, local AI, model sharing, P2P, memory, and browser runtime.

Implementation implications:

- Keep package boundary tests strict.
- Keep public SDK docs aligned with actual package contents and symbol packages.
- Keep private conversion wrappers controlled and explicit.

## Implementation Roadmap

### Phase 0 - Intake And Memory Routing

Status: this batch.

- Preserve all raw reports under `docs/report-intake/2026-07-08/`.
- Create a manifest with hashes and durable paths.
- Create this synthesis and the TDD plan.
- Add tests that fail if reports are not preserved or hot memory loses the route.
- Update `.uai` hot memory so future agents start from this plan.

### Phase 1 - Quality Gate As Product Contract

Goal: make every quality claim falsifiable.

- Expand `assistant-quality` cases beyond the current fixed plus seeded holdout suite.
- Add adversarial no-cheat cases: paraphrased prompts, random entity insertion, prompt-card variants, JSON shape variants, and "same intent different wording" checks.
- Ensure eval sidecars always include model hash, prompt format, tokenizer, sampler config, seed, raw output, transformed output, diagnostics, and quality failures.
- Add a release gate that refuses quality tier unless native eval, WASM smoke, browser smoke, and visual lock all pass.

### Phase 2 - Runtime Coherence And Streaming

Goal: improve the actual Rust/WASM runtime path.

- Continue hardening tokenizer encode/decode, prompt template routing, EOS handling, repetition suppression, deterministic seed behavior, context reset, and diagnostics.
- Add min-p or similar collapse-resistant sampling only after unit tests prove deterministic behavior and no top-k/top-p regressions.
- Add UTF-8 boundary buffering tests before streaming partial tokens to the UI.
- Add worker isolation tests before moving inference off the main thread.

### Phase 3 - Trust Envelope And Model Catalog

Goal: make model import understandable and safe.

- Define `slm.manifest.v1.json` or equivalent sidecar schema.
- Bind artifact hash, tokenizer identity, prompt format, context length, quantization, quality tier, eval sidecars, license, source, and P2P piece data.
- Add policy tests for demo, experimental, and quality tiers.
- Build a curated MiniModel-ready list from compatible, verified models, ordered by fit and evidence rather than random Hugging Face query text.

### Phase 4 - Quantization Formats

Goal: shrink models while preserving quality.

- Keep q8 and q4 as current baselines.
- Add `q6_g128` and `q5_g128` writer/parser/runtime tests before kernels.
- Add `q4_a128` with scale/min streams and optional outlier sidecar only after q6/q5 infrastructure is proven.
- Gate every dtype on parser validation, kernel correctness, native/WASM parity, browser load memory, latency, and assistant-quality eval.

### Phase 5 - Distillation Pipeline

Goal: create TinyRustLM-native quality-capable `.slm` models.

- Select teacher/student pairs by tokenizer and architecture compatibility first.
- Use instruction/chat students for assistant quality; keep raw completion models out of assistant-quality tier.
- Track dataset policy, license, teacher identity, training recipe, quantization recipe, eval cases, and conversion receipt in private authoring records.
- Publish only admitted `.slm` artifacts and safe metadata.

### Phase 6 - P2P Growth

Goal: increase `.slm` adoption without hosting user model bytes.

- Make local share kits simple and verifiable.
- Add peer companion or local endpoint workflows for consent, status, piece serving, import preflight, and receipts.
- Keep project servers metadata-only.
- Add tests for unsafe peer URL rejection, piece corruption, missing pieces, license restrictions, and model-tier downgrade.

### Phase 7 - SDK And Docs

Goal: grow ecosystem adoption without exposing the private product.

- Keep NuGet APIs thin, stable, and documented.
- Keep package metadata searchable.
- Keep `.snupkg` symbols and SHA256SUMS manifests.
- Keep private authoring and commercial internals out of public package contents.

## Non-Negotiable Boundaries

- No browser fake assistant messages.
- No prompt-specific canned responses.
- No hidden remote inference.
- No claiming fixture outputs as assistant quality.
- No project-server hosted user model bytes.
- No P2P admission without local verification.
- No `.slm` capability inference from filename alone.
- No public NuGet exposure of private authoring, optimizer, routing, telemetry, licensing, or orchestration internals.
- No UI redesign while pursuing these runtime improvements.

## Immediate Next Implementation Slice

The best next slice is not "add another model button." It is:

1. Extend the honest eval and prompt-card holdout suite.
2. Add sidecar schema/policy tests for demo, experimental, and quality tiers.
3. Add parser tests that reserve and fail-closed unsupported future dtype ids.
4. Add q6/q5/q4_a128 writer/parser test scaffolds behind explicit unsupported-dtype expectations.
5. Add browser-local worker/cache design tests as non-visual smokes.
6. Add a curated MiniModel-ready catalog audit test that rejects empty, impossible, or generic Hugging Face search defaults.

That sequence gives the runtime a stronger floor before more aggressive compression work begins.
