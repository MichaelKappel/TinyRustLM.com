# TinyRustLM Champion And Specialist Research TDD Delta

Date: 2026-07-21

## Purpose

This plan converts the reviewed twelve-report intake into falsifiable work. It
does not authorize training, adopt Colibri, or claim that current adapters are
useful specialists. TinyRustLM is pre-release, so tests define a clean
replacement contract. No compatibility reader, migration shim, cumulative
mutation fallback, or deprecated alias is required for unreleased behavior.

## Gate 0: Preserve Current Truth

Before implementation:

- verify all 13 manifest rows by SHA-256 and byte count;
- keep raw report bodies, raw model outputs, rejected attempts, and evaluator
  history immutable;
- keep the 42-record and 668-record corpora training-ineligible until every
  record receives the required independent decision;
- keep preference optimization disabled because no explicit pairwise review
  corpus exists; and
- freeze private holdout identities and exclusion hashes outside training and
  teacher-generation inputs.

Acceptance: research prose can propose experiments but cannot change a model,
format, threshold, training corpus, or product claim by itself.

## Phase 1: Canonical Artifact And Composition Schema

Write failing tests for:

- domain-separated canonical identities for standalone model, adapter,
  composition, route policy, shared chunk, KV format, and retrieval index;
- rejection of an adapter presented as a standalone `.slm`;
- exact base, tokenizer, chat template, tensor layout, quantization, adapter,
  and execution-semantics binding;
- canonical member ordering and explicit declaration of additive,
  replacement, sequential, or dependent composition semantics;
- exclusion of timestamp, hostname, process ID, and mutable alias from content
  identity;
- rejection of missing, duplicate, corrupt, cross-base, or cross-tokenizer
  members;
- deterministic reconstruction from shared chunks; and
- separate standalone, logical, incremental, physical, router/index, KV,
  scratch, and peak-resident byte fields.

Acceptance: two independent builders produce the same identities and no size
claim can omit required base or shared bytes.

## Phase 2: Immutable Direct Overlay Runtime

Replace destructive application with an immutable composition graph. Start
with a scalar reference path and tests for:

- direct low-rank output parity against `Q(W) + B*A*scale` materialized once
  in high precision for tiny fixtures;
- no permanent base mutation and no whole-layer dequantize/requantize on each
  decode token;
- fixed-platform `base -> A -> base` logit equality;
- `base -> A -> base -> B -> base` equality with fresh isolated loads;
- 100 switch cycles without cumulative drift;
- additive same-base A+B and B+A parity where the manifest declares exact
  additive semantics;
- order-sensitive rejection or distinct identity for replacement,
  sequentially quantized, or dependent overlays;
- f32, q8, q5, and q4 differential tolerances against scalar references;
- validation, allocation, decode, or activation failure leaving the current
  composition unchanged; and
- complete release of overlay-owned memory on cancellation and free.

Acceptance: the immutable base hash never changes, each generation reports the
actual composition handle it used, and no undeclared prior adapter affects a
later request.

## Phase 3: Atomic In-Process Activation

File-level atomic rename is insufficient. Test the ownership protocol:

- prospective graph is fully validated before publication;
- publication swaps one immutable reference-counted handle;
- an in-flight generation either finishes on the old handle or is cancelled
  according to a declared policy;
- new requests cannot acquire a half-built graph;
- old graphs are reclaimed only after the final reader exits;
- process crash before commit leaves the prior durable activation current;
- process crash after commit resumes only after revalidating all members; and
- resource-limit or quality-receipt failure is fail-closed.

Acceptance: fault injection at every allocation and commit boundary yields one
complete old or new composition, never mixed tensor or cache state.

## Phase 4: KV Identity And Invalidation

Version zero always flushes on composition change. Add tests for:

- cache key binding to composition, tokenizer, template, position policy,
  cache format, prompt tokens, and runtime semantics;
- invalidation when an adapter changes any earlier residual path, including
  MLP-only changes before later attention;
- no reuse from `attention_frozen=true` alone;
- native and WASM cache clearing after activation, cancellation, context
  truncation, and model free;
- independent key and value quantization experiments with recent-token
  precision windows, page tails, grouped-query attention, and RoPE; and
- allocated, committed, scratch, and peak memory accounting.

Acceptance: no cross-composition reuse occurs unless a later, separately
versioned transform proves numerical and sealed behavioral equivalence.

## Phase 5: Specialist Training Experiment

After human review authorizes a corpus, preregister one narrow task and train:

- champion baseline;
- low-rank adapter at several measured byte budgets;
- sparse adapter at several measured densities;
- independently distilled standalone student; and
- arbitrary dense slice as an expected-failing negative control.

Training receipts bind base revision, tokenizer, template, corpus record
hashes, review decisions, contamination exclusions, teacher identities, final
answers, seed, optimizer, schedule, precision, packing, checkpoints, and
produced bytes. Do not retain hidden teacher reasoning.

The curriculum must include varied positive in-scope examples, paraphrases,
counterfactual constraints, authority changes, multi-turn state changes, and
hard out-of-scope negatives. Helpful positive answers must substantially
outnumber refusals.

Measure full base weights, activations, gradients, optimizer state, temporary
buffers, peak RAM/VRAM, tokens/second, and total time. Do not estimate adapter
training from trainable parameters alone.

Acceptance: a specialist meets a preregistered in-scope gain, broad-helpfulness
noninferiority margin, unseen-paraphrase gate, calibration gate, and total
resource budget. Otherwise reject that arm without compatibility support.

## Phase 6: Local Router Tournament

Compare under one frozen request set:

- champion-only;
- explicit user selection only;
- deterministic rules;
- tiny local classifier;
- local embedding/index router; and
- an offline route oracle used only for analysis.

Required cases cover direct model choices, quoted model names, retrieved
instructions, stale memory preferences, current user overrides, ambiguous
requests, compound tasks, topic changes, adversarial scope wording, and
out-of-scope pinned specialists.

Assert that:

- routing occurs before generation;
- raw prompt text remains preserved;
- direct user instruction is distinguished from quote, retrieval, and memory;
- low confidence selects the champion;
- fallback retains the first raw attempt and is visibly receipted;
- specialist text is never relabeled as a system message;
- history selection follows a declared continuity policy;
- router/index bytes and latency count toward the product arm; and
- no central telemetry is required.

Acceptance: the selected router improves the preregistered end-to-end objective
after wrong-route, fallback, latency, memory, and byte costs are included.

## Phase 7: Colibri-Style Placement Prototype

Only begin after admitting a model with independently loadable trained experts
or modules. Use a fixture first, then one real model. Test:

- pinned expert/module graph and per-file hashes;
- exact routed top-k and shared-expert semantics;
- cold, warm, and memory-pressure runs;
- buffered, memory-mapped where safe, and direct-I/O variants;
- asynchronous read queue depth, cache hit rate, prefetch precision/recall,
  bytes read per token, and stall tails;
- prefetch miss parity with no-prefetch logical execution;
- bounded learned placement statistics that cannot change model identity;
- separately named and quality-gated lossy expert pruning;
- corruption, short read, disk full, process restart, and cancellation; and
- complete local-storage accounting for all expert bytes.

For browser research, separately test OPFS quota, worker sync access, WASM
addressing, allocation failure, service-worker lifecycle, interruption, and
mobile memory pressure. Native success is not browser proof.

Acceptance: exact mode improves a declared resource metric on real target
hardware without changing logical routing or exceeding raw-output tolerances.
Otherwise remove the prototype.

## Phase 8: Preregistered Portfolio Promotion

Freeze a campaign identity before observing results. Compare champion,
low-rank specialist, sparse specialist, standalone specialist, each routed
portfolio, and negative controls. Record:

- model, composition, route, runtime, evaluator, browser, and case identities;
- untouched raw outputs and declared seed policy;
- task and broad-assistant pass rates;
- paired noninferiority confidence interval against a predefined margin;
- critical semantic failures and blinded human disagreements;
- route precision, recall, calibration, fallback, and wrong-route costs;
- every byte category and peak memory phase;
- cold load, warm activation, switch, prefill, first-token, and decode tails;
- repeated-switch and KV-invalidation evidence; and
- native, WASM, and browser coverage without substituting one for another.

An evaluator revision reruns evaluation and downstream promotion only. It does
not invalidate a still-matching acquisition or deterministic conversion.
Private holdout bodies and raw hosted-memory payloads remain access-controlled;
public receipts contain hashes, counts, status, bounded errors, and redaction
evidence.

Acceptance: reject arms outside hard quality, privacy, integrity, and resource
gates. Select only among the remaining nondominated arms using preregistered
budgets or weights. One good answer, a small file, or a microbenchmark cannot
override a failed semantic gate.

## Stop And Rewrite Rule

Any phase that fails identity, reversibility, ownership, cache isolation,
quality, privacy, integrity, target memory, or target latency is rejected with
its evidence retained. Rewrite the unreleased design cleanly and delete the
superseded implementation after the replacement passes. Do not add a legacy
reader, compatibility branch, dual contract, migration shim, or hidden
fallback for rejected pre-release behavior.
