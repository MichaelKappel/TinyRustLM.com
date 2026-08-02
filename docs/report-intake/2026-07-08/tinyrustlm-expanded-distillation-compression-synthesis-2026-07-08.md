# TinyRustLM Expanded Distillation And Compression Intake Synthesis - 2026-07-08

## Scope

This synthesis routes the 12 reports that were present in `agent-file-handoff/Improvement` but were missing from the first 2026-07-08 durable intake batch. The full report bodies are preserved byte-for-byte in `docs/report-intake/2026-07-08/` and are indexed by `MANIFEST.md`.

Newly routed reports:

- `Browser Rust WASM SLM Optimization.md`
- `Distilling Memory, Persona, and Task Behavior into a TinyRustLM SLM Ecosystem.md`
- `Distilling Reliable Reasoning and Instruction Following into Small Local Assistant Models.md`
- `End-to-End Distillation Pipeline for TinyRustLM .slm Models.md`
- `Optimizing Distilled SLM Models for Browser-Local Rust and WASM Inference in TinyRustLM.md`
- `Quantization-Aware Distillation for Small .slm Models in Rust and WASM.md`
- `SLM Distillation Technical Report.md`
- `SLM Quantization and Distillation.md`
- `Small Model Tokenizer Compression Report.md`
- `TinyRustLM Distillation Technical Report.md`
- `TinyRustLM Model Distillation Pipeline.md`
- `Tokenizer And Vocabulary Compression For Small Local .slm Models.md`

## Root Finding

The earlier memory pass routed 31 Improvement reports, but the active intake folder later grew to 43 Markdown reports. Hot `.uai` memory still spoke as if the 31-report batch was complete. The failure was not a model-runtime bug; it was a UAIX memory-distribution bug: active handoff state, durable report preservation, manifest counts, synthesis routes, and hot `.uai` pointers drifted apart.

The corrected state must be:

- `agent-file-handoff/Improvement` is the active handoff source.
- `docs/report-intake/2026-07-08/` preserves every active Markdown report body.
- `MANIFEST.md` records all 43 source reports with byte counts and SHA-256 hashes.
- `.uai/short-term-memory.uai` carries the current actionable summary and deep links.
- `.uai/report-synthesis.uai`, `.uai/test-plan.uai`, `.uai/index.uai`, `.uai/long-term-memory.uai`, and `.uai/intake-outcome-ledger.uai` route the durable artifacts.

## Technical Synthesis

### 1. Distillation Is The Main Quality Lever

The distillation reports converge on a hard truth: TinyRustLM cannot become a strong local assistant by quantizing arbitrary tiny base models after the fact. The useful path is a deliberately trained student model with a browser-local task curriculum:

- greeting and light chat;
- source-grounded summarization;
- rewrite and style cleanup;
- short code explanation;
- strict JSON object generation;
- short reasoning without exposed chain-of-thought;
- `.slm`, MiniModel, provenance, local privacy, and P2P trust vocabulary.

The reports recommend teacher-student training with sequence-level response distillation first, then logit distillation and hidden-state matching where the student architecture is close enough to make those losses meaningful. For TinyRustLM, the first production target should be an instruction/chat student whose tokenizer, prompt template, stop tokens, and JSON behavior are designed for the runtime before `.slm` export.

Implementation implication: the public product can expose validation/loading/runtime/P2P/memory harnesses, but private distillation authoring records, training recipes, teacher prompts, optimizer details, ranking logic, and dataset-generation internals must stay outside public NuGet packages and browser bundles.

### 2. Quantization-Aware Distillation Beats Naive PTQ

The quantization-aware reports explain why small models are fragile: low parameter redundancy, narrow logit margins, rare-token collapse, tokenizer fragmentation, and instruction-following brittleness make naive post-training quantization risky. The recommended ladder is:

- q8 reference for regression and teacher/student comparison;
- q6_g128 and q5_g128 as near-transparent browser/desktop candidates;
- q4 groupwise or q4 activation-aware default for browser/mobile deployment;
- q3 only when it enables a materially larger student under the same memory budget;
- q2 experimental only, not a default product lane.

The reports emphasize direct-decoded weight-only formats with simple groupwise scales before complex codebook or sparse schemes. Runtime kernels should avoid decoded f32 shadow tensors, keep block metadata cache-friendly, and preserve deterministic diagnostics.

Implementation implication: `.slm` manifest and runtime metadata should eventually name quantization family, group size, scale type, outlier handling, calibration dataset id, q8 reference checksum, and eval delta versus q8. Any future q5/q6/q4_a/outlier format must start with failing parser/runtime/manifest tests.

### 3. Tokenizer Compression Is A First-Class Model-Size Lever

Tokenizer reports identify the embedding/output-head bottleneck as one of the largest costs in sub-billion models. Vocabulary pruning can save substantial memory, but it can also break JSON, code syntax, `.slm` extension preservation, URLs, hashes, model ids, prompt templates, and P2P manifests.

Recommended tokenizer work:

- measure token fertility, sequence inflation, single-token retention, and domain-token coverage;
- preserve byte fallback or byte-level coverage for hashes, paths, JSON punctuation, URLs, and file extensions;
- keep chat special tokens atomic;
- test `.slm`, MiniModel, UAIX, JSON keys, code symbols, license ids, SHA strings, and manifest routes;
- record tokenizer family, vocab checksum, merge checksum, special-token map, byte fallback policy, and compatibility claims in `.slm` metadata.

Implementation implication: TinyRustLM should not treat tokenizer compression as a sidecar afterthought. Tokenizer identity must be part of quality admission, eval evidence, P2P metadata, and browser source review.

### 4. Browser/WASM Runtime Optimization Must Respect Memory Reality

The browser runtime reports agree that the current whole-file fetch, JS ArrayBuffer, WASM copy, and runtime-owned tensors create peak-memory pressure that can exceed the packed artifact size. Browser-local quality is therefore constrained by:

- model artifact bytes;
- transient load duplication;
- WASM linear-memory growth behavior;
- single-threaded main-loop stalls;
- KV-cache size;
- tokenizer memory;
- decode-time weight bandwidth;
- output buffer and diagnostics overhead.

Recommended runtime direction:

- worker-isolated execution before heavy generation becomes default;
- manifest-bound memory budgets before model bytes are fetched;
- chunked or range-friendly `.slm` layout after current monolithic proof;
- persistent user-consented Cache API or OPFS storage;
- direct quantized kernels with no f32 tensor shadow;
- KV-cache page budgets, context-length guardrails, and deterministic reset diagnostics;
- browser smoke tests that prove no remote inference and no project-server model bytes.

Implementation implication: every runtime optimization must preserve the locked UI, local-only network proof, deterministic diagnostics, and `.slm` fail-closed validation.

### 5. Memory, Persona, And UAIX Packs Belong In A Public Harness, Not Private Training Logic

The memory/persona reports separate three lanes:

- prompt-time memory injection through UAIX packages;
- adapter or base-model behavior trained privately;
- public runtime validation and manifest inspection.

Public TinyRustLM should include a UAIX memory harness capable of validating package manifests, personality-pack metadata, source boundaries, safety policy, and prompt assembly constraints. It should not expose private adapter authoring, auto-assembly, optimizer, ranking, lineage promotion, or premium routing logic.

Implementation implication: memory packs should have explicit trust metadata, checksum-bound files, prompt-injection boundaries, package kind, allowed scope, persona style claims, and eval cases. Browser UI can import/apply verified memory packs, but authoring and commercial assembly internals stay private.

### 6. Honest Eval Must Expand Beyond Current Prompt Cards

The eval reports reinforce that green tests must not mean prompt memorization. The current fixed plus seeded holdout gate is a good base, but distillation/compression work needs broader gates:

- fixed regression prompts;
- seeded holdout prompts;
- paraphrased source texts;
- unseen JSON schema variants;
- tokenizer stress strings;
- code-symbol tests;
- `.slm` and MiniModel provenance terminology;
- local-vs-remote contradiction checks;
- prompt-instruction leakage checks;
- q8 vs q4/q5/q6 quality deltas;
- browser/WASM proof using the same runtime path.

Implementation implication: quality claims require native eval, WASM/browser smoke, visual lock, trust metadata, tokenizer evidence, and no-cheat output review. Fixture or demo models remain runtime plumbing only.

## Implementation Priorities

1. Add an intake-route verifier that compares active `agent-file-handoff/Improvement/*.md` with durable `docs/report-intake/2026-07-08/MANIFEST.md`.
2. Expand `.slm` manifest metadata for tokenizer compression, q8 reference, quant family, calibration/eval ids, and runtime memory budgets.
3. Add tokenizer stress fixtures for JSON, `.slm`, MiniModel, UAIX, URLs, hashes, code symbols, and chat specials.
4. Add focused eval files for distillation target behavior: greeting, summary, rewrite, code, JSON, provenance, local privacy, P2P review, and memory/persona injection boundaries.
5. Add q8 reference versus q4/q5/q6 delta tests before admitting new quant formats.
6. Prototype a public UAIX memory package validation/import surface while keeping authoring and optimizer internals private.
7. Plan worker-isolated browser execution and persistent verified local caching behind visual lock and local-only request tests.

## Boundaries

- Do not expose private distillation recipes, training prompts, model-ranking, adapter authoring, selector generation, premium routing, license internals, telemetry, or enterprise orchestration in public packages.
- Do not treat extractive repair, field normalization, or browser post-processing as model-quality proof by itself.
- Do not claim q4/q5/q6 model quality without q8 reference evidence and unseen prompt tests.
- Do not shrink tokenizer vocabulary unless syntax, manifest, code, URL, hash, and `.slm` extension preservation tests pass.
- Do not let active reports be called processed until manifest, durable copies, checksums, synthesis, `.uai` routes, and verification agree.
