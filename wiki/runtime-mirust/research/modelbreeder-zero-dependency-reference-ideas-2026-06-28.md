---
title: ModelBreeder and Zero-Dependency Reference Ideas 2026-06-28
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/research/modelbreeder-zero-dependency-reference-ideas-2026-06-28/
status: planned_pending_publication
reviewed_utc: 2026-06-28T21:20:00Z
---

# ModelBreeder and Zero-Dependency Reference Ideas

This record routes the 2026-06-28 Improvement research into practical Runtime.MiRust.com guidance without requiring future agents to bulk-load the original reports.

## ModelBreeder Guidance Lanes

- Product voice lane: use fitness, scope notes, breeding invariants, evaluation checkpoints, governance principles, local agency, and proof-of-use language for public copy.
- Genome lane: represent a candidate with base model id, adapter stack, random seed, source provenance, model artifact path, and mutation or recombination log.
- Fitness vector lane: route accuracy, loss, latency, memory, energy, novelty, cost, and composite score into typed eval sidecars before any promotion claim.
- Novelty lane: record a hash sketch, behavior descriptor, or eval-output distance so candidate selection can preserve useful variety instead of only the top scalar score.
- Population lane: keep parent selection, seed weights, objective vectors, generation id, champion status, and archive status as manifest or receipt data.
- Speciation-fit lane: preserve f32/q8_0/q4_0 families, tokenizer families, tensor-layout fingerprints, adapter families, and browser resource envelopes as local fit boundaries.
- Evolution-loop lane: implement breeding loops as bounded offline tooling first; browser runtime should consume generated, validated artifacts rather than mutate active model bytes.

## Zero-Dependency Browser Runtime Lanes

- SIMD lane: future matvec work should route through explicit Wasm SIMD feature probes, scalar fallbacks, deterministic fixtures, and byte-counted benchmark records.
- Hierarchical quantization lane: K-quant support, if added, needs typed super-block/sub-block metadata, direct fused dequant-matvec loops, and tests for irregular bit packing.
- Adapter lane: keep ADP1, ASP1, and ALR1 as compact update formats with base-model checksum binding, factor/sparse/raw payload checksums, and f32/q8/q4 apply proofs.
- Tokenizer lane: keep byte-tokenizer and future BPE tables embedded or checksum-routed so browser bundles remain self-contained and reproducible.
- Sampler lane: keep stochastic decoding deterministic through seeded RNG state, bounded candidate arrays, and fixture outputs for top-k/top-p/temperature parameters.
- KV-cache lane: treat paged cache, prefix sharing, and radix routing as future memory-budget features that need route receipts and page-count diagnostics before UI claims.
- Speculative decoding lane: route draft/target or model-free speculative decoding as planner research until artifact format, rollback proof, and eval fixtures exist.
- Multimodal lane: QOI image and Cooley-Tukey FFT ideas are future no-third-party intake routes; each needs a typed payload format, fixture corpus, and checksum-backed diagnostics.
- Allocator lane: any custom Wasm allocator needs a bounded design note, page-growth counters, scratch-arena reset proof, and browser smoke evidence.
- Telemetry lane: diagnostics should stay native and compact: counters, checksums, token timing, scratch usage, adapter apply counts, and assembly state hashes.

## Research-To-Implementation Map

- ModelBreeder schemas become `Genome` and `FitnessVector` style manifest/eval fields.
- Multi-parent guidance maps to the current parent-pool recipe, sign-merge, multi-parent candidate manifest, promotion template, admission record, and selector registry lanes.
- Novelty, population, mate-selection, phenotype-evidence, heritable-artifact, and speciation guidance maps to selector registry fields, Model Provenance rows, objective-vector metadata, runtime/eval/artifact evidence checksums, and browser-smoke assertions.
- Browser runtime guidance maps to future source work only when it can be proven through deterministic fixtures, browser smokes, or receipt validation.
- Public wording guidance routes through `.uai/taboo.uai` before website copy changes.

## Raw Evidence

Exact originals are preserved under `raw/runtime-mirust/report-intake-2026-06-28/`. The intake index is `wiki/runtime-mirust/reports/report-intake-index-2026-06-28.md`.

## Routing Rule

Open this page before changing ModelBreeder-derived schema names, fitness/novelty/population metadata, zero-dependency browser runtime plans, Wasm SIMD/quantization/tokenizer/sampler/KV-cache guidance, or public copy related to model breeding.
