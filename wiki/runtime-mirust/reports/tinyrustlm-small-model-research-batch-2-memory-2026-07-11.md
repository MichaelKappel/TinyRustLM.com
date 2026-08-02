# TinyRustLM Small-Model Research Batch 2 Memory

## Read This When

Read this memory before selecting a base model, scaling the behavioral corpus, changing distillation losses, adding quantization formats, changing native/WASM execution, defining quality gates, or publishing `.slm`/NuGet/P2P metadata.

## Authority

- Manifest: `docs/report-intake/2026-07-11/small-model-research-batch-2/MANIFEST.md`
- Synthesis: `docs/report-intake/2026-07-11/small-model-research-batch-2/tinyrustlm-small-model-research-synthesis-2026-07-11.md`
- TDD delta: `docs/report-intake/2026-07-11/small-model-research-batch-2/tinyrustlm-small-model-research-tdd-delta-2026-07-11.md`
- Earlier measured plan: `docs/report-intake/2026-07-11/tinyrustlm-response-quality-footprint-tdd-plan-2026-07-11.md`

The twelve preserved reports are research inputs. Current source, pinned checkpoints, raw decoder evidence, and native/browser tests supersede them.

## Current Truth

- No current `.slm` is promoted as the generally useful default.
- Qwen2.5-1.5B-Instruct is the strongest source behavior observed, but remains unqualified.
- Qwen2.5-0.5B-Instruct revision `7ae557604adf67be50417f59c2c2f167def9a775` was screened after intake and rejected before conversion under both concise-charter and minimal system prompts.
- SmolLM2-135M/360M, SmolLM2-1.7B, and tested Qwen3 candidates failed relevant local gates.
- Uniform q4 is too destructive for the observed candidates; mixed sensitivity-ranked q8/q4 is the near-term compression path.
- The 100-record adapter and preservation-KL variant did not improve the fixed failures.
- Public-v2 and targeted collection completed through the pinned local Qwen3.6 teacher: 572 plus 96 normal-stop drafts, complete checkpoints, and v2 review workbooks. All 668 decisions remain pending; the admission audit still reports zero findings against 51 unique held-out prompts.
- Hugging Face publication is optional, release-gated, and human approved only.

## Priority Order

1. Conversational coherence, common sense, practical judgment, clarification, and multi-turn state.
2. Direct lawful adult help under the UAIX Cognitive Liberty Charter with narrow concrete-harm boundaries.
3. Grounded summarization, rewriting, extraction, JSON, and code explanation.
4. Reasonable artifact, working-memory, latency, and browser footprint.
5. Calculator routing for deterministic arithmetic; math benchmark optimization is secondary.

## Accepted Plan

1. Preserve the Qwen2.5-0.5B source rejection and retain Qwen2.5-1.5B as the current quality anchor.
2. Preserve the passing exact, five-gram, apostrophe-normalized, and pinned semantic admission evidence for all 668 pilot prompts.
3. Scale a provenance-bound, decontaminated, linguistically audited behavioral corpus toward at least hundreds of thousands of records.
4. Compare assistant-only, preservation-aware, upper-layer/DoRA, and top-k distribution distillation under the same raw gates.
5. Convert only a source-qualified checkpoint.
6. Establish f32/q8 parity, then use tensor-family sensitivity to choose mixed precision.
7. Keep scalar Rust as oracle; differential-test SIMD; keep WebGPU and Memory64 experimental.
8. Prove active conversation mode, single response rendering, native/WASM/browser behavior, footprint, and visual lock.
9. Release through signed/content-addressed MiniModel/P2P metadata and verified NuGet packages; preserve approved package namespaces and proprietary boundaries.

## Rejected Shortcuts

- Model-card popularity as source-quality proof.
- Conversion before source behavior passes.
- Prompt suffixes, expected-answer maps, retries, repair, answer assembly, or evaluator exemptions.
- Treating 668 pilot prompts as production coverage.
- Random initialization, massive undifferentiated continued pretraining, or vocabulary pruning in the next slice.
- Uniform q4 promotion based only on artifact size.
- OPFS as mmap, forced paging, silent runtime fallback, or unmeasured Memory64/WebGPU claims.
- Package renaming away from the human-approved `UAIX.Browser.*` families.
- Automatic Hugging Face publication.

## Immediate Work

Prompt admission and draft generation now pass after removing two five-gram collisions, one short apostrophe-equivalent leak, and four distinct semantic neighbors. The next executable sequence is explicit review of all 668 drafts, combined-output linguistic audit, dataset freeze, and an expanded matched distillation comparison. The approved UI remains locked; active conversation uses the center column for history and renders each response once.

## Truth Boundary

This memory records reviewed routing decisions and routes to evidence. It does not claim that semantic similarity below one encoder threshold is impossible, that pending teacher drafts or linguistic policy pass, that the pilot is production scale, that a candidate model has passed, or that an artifact has been released.
