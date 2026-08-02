---
title: Tiny Model Runtime and Memory Reference Ideas 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/research/tiny-model-runtime-memory-reference-ideas-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T21:53:59Z
---

# Tiny Model Runtime and Memory Reference Ideas

This record routes the 2026-06-29 Improvement research into practical Runtime.MiRust.com guidance without requiring future agents to bulk-load the original reports.

## Tiny Model Candidate Lanes

- Primary conversion lane: prioritize `Xenova/llama2.c-stories15M` style Llama topology for first real tiny-model conversion because the research aligns it with RMSNorm, RoPE, SwiGLU, tied embeddings, q8/q4 budget fit, and adapter experiments.
- Extreme frugal lane: evaluate low-vocabulary Llama candidates such as `MultivexAI/Aurelius-Llama-v2.5-10M-Large` after the runtime can represent grouped-query attention and compact tokenizer tables.
- Deterministic validation lane: use Pythia-family tiny checkpoints as future GPT-NeoX/parallel-residual fixtures once converter support exists for fused QKV splitting, LayerNorm, large BPE vocabularies, and reference-output checks.
- Stress lane: treat 40M-class Llama tiny models as q4-only pressure tests for module-plan byte budgets, q4 dequantization, and WASM heap behavior.

## Runtime Design Lanes

- Memory lane: keep model bytes, KV cache bytes, runtime scratch, output cap, adapter stack bytes, and total assembly budgets as explicit module-plan fields with observed browser counts.
- Hot-loop lane: preserve allocation-free generation, pre-resolved tensor indices, fixed candidate arrays, and row/block dequantization into reusable scratch buffers.
- Tokenizer lane: keep tokenizer data embedded or checksum-routed inside `.slm` artifacts; low-vocabulary candidates should be preferred until larger BPE and GPT-style pre-tokenization behavior is proven.
- SIMD lane: future WASM SIMD should arrive behind explicit feature probes, scalar parity fixtures, and benchmark rows rather than changing support claims by implication.
- KV-cache lane: paged, ring, quantized, checkpointed, or forkable KV-cache ideas are future features until represented as receipt fields, runtime diagnostics, and browser smokes.
- Determinism lane: stochastic sampling, merge math, and converter output should use explicit order, seed, tie-breaking, and checksum fields before promotion.

## Model-Breeding Metadata Lanes

- Receipt lane: parameter averaging, task-delta, sparse-delta, DARE, sign-aware merge, soup, crossover, mutation, pruning, adapter fusion, and population selection each need lineage, compatibility, fitness, schedule, checksum, and reproducibility fields.
- Schedule lane: browser selector intake should bind copied schedule family fields to the exact operator family, not only to slug-shaped values.
- Mask lane: sparse, DARE, crossover, mutation, and prune receipts should preserve mask, selected-count, tie-breaking, and output-value checksums.
- Population lane: parent pools should keep seed weights, relatedness, generation id, objective-vector checksums, and operator-family schedule identity.
- Adapter lane: LoRA-style low-rank source work maps to trained adapter source manifests, source-backed ALR1 conversion, adapter-family receipts, and Rust semantic preflight.

## Memory-System Lanes

- UAIX lane: active Content and Improvement buckets are transient intake; durable bodies belong in raw evidence and wiki routes, while `.uai` files carry current routing and synthesis.
- LLM Wiki lane: future agents should use index-first retrieval, open the narrow research or report page needed for the work, and avoid bulk-loading raw reports unless exact wording is required.
- Pointer-ledger lane: `.uai/long-term-memory.uai` stays pointer-only with checksum-bearing records for report, research, raw manifest, and hot-memory routes.
- Current-work lane: the 2026-06-29 browser selector fallback bug maps directly to the memory research's structural no-op idea: when generated entries fail a route gate, the page should land on a valid fallback model instead of an empty selection.

## Research-To-Implementation Map

- Tiny-model candidate research should next become a model-candidate matrix with exact architecture, tokenizer, license, parameter, quantization, byte-budget, converter-gap, and test-fixture fields.
- Runtime design research should next become focused browser fallback and module-plan invariants, especially static fallback selection after generated registry rejection.
- Model-breeding metadata research should continue strengthening browser intake gates for schedule, operator, receipt, and population fields.
- Memory-system research is already applied through this intake: raw preservation, wiki synthesis, short-term routing, long-term pointer records, and source-copy clearing after verification.

## Raw Evidence

Exact originals are preserved under `raw/runtime-mirust/report-intake-2026-06-29/`. The intake index is `wiki/runtime-mirust/reports/report-intake-index-2026-06-29.md`.

## Routing Rule

Open this page before changing tiny-model candidate selection, GGUF-to-SLM conversion planning, tokenizer/runtime architecture, WASM SIMD or KV-cache plans, model-breeding metadata fields, generated selector fallback behavior, or UAIX/LLM Wiki memory strategy.
