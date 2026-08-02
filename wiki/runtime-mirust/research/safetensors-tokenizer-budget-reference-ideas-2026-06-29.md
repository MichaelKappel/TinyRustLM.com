---
title: Safetensors Tokenizer Budget Reference Ideas 2026-06-29
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/research/safetensors-tokenizer-budget-reference-ideas-2026-06-29/
status: planned_pending_publication
reviewed_utc: 2026-06-29T23:33:20Z
---

# Safetensors, Tokenizer, Budget, and Fixture Reference Ideas

This record routes the 2026-06-29 follow-up Improvement research into practical Runtime.MiRust.com guidance without requiring future agents to bulk-load the original reports.

## Conversion Lanes

- Safetensors alias lane: real Llama-style sources commonly use Hugging Face names such as `model.embed_tokens.weight`, `model.norm.weight`, `lm_head.weight`, `model.layers.N.self_attn.q_proj.weight`, and `model.layers.N.mlp.gate_proj.weight`; the local raw source layout should keep stable `.slm` names while accepting those aliases during intake.
- Ordered tensor lane: extraction should continue to build a checked plan first, then copy F32 or decode F16/BF16 into raw little-endian f32 files in the exact local order consumed by `convert-trained`.
- Tied-output lane: tied models omit the output head from raw source and carry the tied-output flag in the converted `.slm`; untied models should map `lm_head.weight` to `output.weight`.
- Source proof lane: direct safetensors-to-`.slm` work should still write the reviewed raw source directory, run source validation, then emit the `.slm` and converted-trained manifest.

## Tokenizer Lanes

- Flat artifact lane: larger tokenizers should move through deterministic binary or manifest-backed tables rather than runtime JSON parsing.
- BPE lane: byte-level BPE can be represented as a bounded string pool plus integer merge pairs, with local tests covering merge order and special-token behavior before broad model claims.
- Future tokenizer lane: Unigram and WordPiece support should remain separate conversion routes with trie or failure-link tables once a real target requires them.
- Browser fit lane: low-vocabulary models are preferable for the first real conversion because vocabulary rows dominate tiny model bytes and tokenizer state.

## Browser Byte-Budget Lanes

- Candidate fit lane: 15M-class Llama-style models fit browser goals most naturally as q8_0 or q4_0 artifacts; 42M-class models are pressure tests for q4, route budgets, KV-cache bytes, and scratch bytes.
- KV-cache lane: model shape, context length, KV heads, head dimension, and layer count should remain visible in module-plan and runtime diagnostics.
- Scratch lane: fused dequantize-and-dot and reusable activation buffers match the current no-crate Rust runtime direction.
- Selector lane: generated model routes should keep exact model byte budgets and static fallbacks available when a candidate route is not admitted.

## WASM Runtime Lanes

- Scalar-first lane: prefer safe assertion hoisting, pre-sliced loops, reusable buffers, and fused kernels before adding target-feature-specific code.
- SIMD lane: add SIMD only behind explicit feature probes, scalar parity tests, and browser smoke evidence.
- Profiling lane: measure coarse runtime phases and stable browser-visible counters rather than adding high-frequency instrumentation inside hot loops.

## Model-Breeding Metadata Lanes

- Schedule lane: parent-pool schedules need stable schedule ids, generation ids, operator-family identity, seed weights, relatedness summaries, and promotion history.
- Fitness lane: population review and admission records should keep objective-vector checksums, behavioral novelty routes, and eval evidence routes.
- Provenance lane: receipts should bind source checksums, candidate checksums, operator receipt checksums, manifest checksums, and route ids in one verifiable chain.
- Lineage lane: near-term implementation should keep schedule and parent-pool fields in typed receipts rather than adding broad prose fields.

## Reference Fixture Lanes

- Top-k fixture lane: future real checkpoint admission should add compact top-k raw-logit fixtures with prompt ids, tokenizer config, expected token ids, raw logits, and checksums.
- Deterministic prompt lane: use fixed prompt text, fixed sampler parameters, and direct logits before sampling for source-to-converted comparisons.
- Rank lane: top-1 agreement and top-k rank stability are useful proof fields for q8/q4 conversion quality once trained weights exist.
- Storage lane: keep fixture bodies separate from `.uai` memory; route them through wiki reports, raw evidence, and checksum pointers.

## Research-To-Implementation Map

- The current safetensors bridge should accept local TinyRustLM source tensor names and Hugging Face Llama aliases while preserving local manifest names.
- The direct conversion command should remain a wrapper over extraction, source validation, and `convert-trained`, so every generated `.slm` has a raw source proof path.
- Future tokenizer conversion should start with BPE because the browser target and Llama-style candidates make it the highest-fit next route.
- Future real-conversion admission should add a reference-output fixture report before claiming trained-model quality.

## Raw Evidence

Exact originals are preserved under `raw/runtime-mirust/report-intake-2026-06-29-followup/`. The intake index is `wiki/runtime-mirust/reports/report-intake-index-2026-06-29-followup.md`.

## Routing Rule

Open this page before changing safetensors source-name mapping, raw source extraction, direct safetensors-to-`.slm` conversion, tokenizer conversion, browser byte budgets, WASM hot loops, model-breeding schedule metadata, or reference-output fixtures.
