# TinyRustLM TurboVec And TurboQuant TDD Delta

Date: 2026-07-18

## Purpose

This plan converts the useful report findings into falsifiable local work. It
does not select an algorithm in advance. Every implementation starts behind an
experimental format identity and can be deleted cleanly if it fails.

## Phase 0: Claim And Source Ledger

Write failing tests before fetching or implementing anything:

- reject an upstream source without exact repository revision, artifact hash,
  license identity, publication version, retrieval time, and direct URL;
- reject shorthand identities such as `TurboVec 0.8.0` when repository tag,
  Rust crate, and Python package identities differ;
- reject a benchmark claim that does not label author claim, external
  reproduction, engineering inference, or local observation;
- reject internal research-agent citation markers as primary-source URLs;
- reject a result that mixes static weights, KV cache, and persistent index
  storage in one bit-width or byte-count claim; and
- reject source or test vectors copied from an implementation whose license and
  provenance have not been approved.

Acceptance: one machine-readable ledger pins every experiment input and the
ledger can be rebuilt byte-for-byte without network access.

## Phase 1: Scalar Numerical Oracle

Create a private experimental module with no runtime integration. Begin with
failing reference tests for:

- deterministic PRNG and transform generation from explicit seed and dimension;
- orthogonality or norm-preservation tolerance for each rotation family;
- forward/inverse transform parity for power-of-two and non-power-of-two
  dimensions;
- exact Lloyd-Max/codebook construction from a canonical mathematical input;
- finite behavior for zero, subnormal, NaN, infinity, huge norm, sparse,
  anisotropic, Laplace, Gaussian, clustered, and adversarial vectors;
- bit-pack/unpack round trips at each declared width and tail length;
- signed/unsigned interpretation, endianness, alignment, and bounds checks;
- direct compressed-domain dot-product and distance scores against `f64`
  oracles;
- reconstruction MSE, normalized MSE, angular error, score bias, score
  variance, inner-product estimator bias, rank inversion, and near-tie order;
- independent acceptance thresholds for reconstruction, dot-product, retrieval,
  attention-logit, and downstream behavioral objectives so one favorable metric
  cannot conceal failure in another;
- QJL, no-QJL, EDEN-style scaling, RaBitQ-style correction, and structured
  transform ablations at exactly matched total bytes; and
- deterministic failure on unsupported dimensions or parameters rather than
  implicit padding or allocation.

Acceptance: scalar Rust output matches independently materialized vectors; all
storage overhead is counted; sanitizers and property tests find no invalid
memory or unbounded allocation; no product module imports the experiment.

## Phase 2: Persistent Retrieval Prototype

Use a deterministic exact flat scan as the first system integration. Required
tests:

- index identity binds embedding-model hash, tokenizer hash, normalization,
  metric, dimension, transform family and seed, codebook, bit width,
  calibration, format version, implementation hash, and record-set revision;
- build order does not affect bytes unless order is explicitly part of identity;
- frozen calibration is reproducible; first-batch adaptive calibration is
  rejected unless ingestion history is identity-bound;
- scalar encode, scalar search, native SIMD search, and WASM SIMD search produce
  the same encoded bytes and score/rank results within declared tolerances;
- filtered search, stable external IDs, duplicate IDs, empty index, deletion,
  tombstone, compaction, corruption, truncation, oversized counts, and restart
  all fail or recover deterministically;
- untrusted retrieved text never enters system or developer instruction lanes;
- raw conversation is not indexed without the explicit durable-memory consent
  state; and
- deletion proof confirms the record is neither searchable nor recoverable from
  the active index after required compaction.

Evaluation corpora must include normalized and unnormalized embeddings,
multiple dimensions, natural and synthetic data, outliers, duplicate vectors,
near ties, and distribution drift. Report Recall@1/10/100, MRR, NDCG, rank
inversions, score error, build time, index bytes, scratch bytes, query p50/p95/
p99, and deletion/compaction cost against exact `f32` and `f16` baselines.

Acceptance: no unexplained Recall@10 regression above a preregistered budget,
no format nondeterminism, no hidden payload retention, and no latency claim
without target-hardware receipts.

## Phase 3: KV-Cache Prototype

Keep the KV experiment separate from retrieval and static weights. Start with
reference attention tests that materialize exact K, V, Q, logits, softmax, and
outputs. Test matrix:

- keys and values independently at `f16`, `int8`, `int4`, and each experimental
  vector format;
- pre-RoPE versus post-RoPE key placement;
- per-token, per-head, per-channel, and per-page granularity;
- grouped-query and multi-query attention, head dimensions including non-powers
  of two, causal masks, sliding windows, and context eviction;
- recent-token high-precision windows of several preregistered sizes;
- QJL/no-QJL and correction/scaling ablations at equal bytes;
- append one token, append a full prompt, cancel, switch model, restart, and
  memory-pressure behavior;
- direct compressed attention versus decode-to-shadow-cache designs; and
- exact allocated, committed, peak, and steady-state bytes as context grows.

Quality tests must use sealed multi-turn and unseen-paraphrase cases with raw
outputs. Bind model bytes, tokenizer, chat template, sampling profile, seed,
runtime, cache format, page schedule, prompt hash, token IDs, logits or declared
logit summaries, and output. No repair, best-of-N choice, or expected-term
injection is permitted.

Promotion requires both numerical and behavioral budgets. A lower memory
number cannot compensate for critical instruction, source-authority,
latest-turn, practical-constraint, untrusted-memory, or ordinary-chat
regressions.

## Phase 4: Native And Browser Kernels

Only optimize a scalar design that already passes. Add one kernel family at a
time with differential tests for:

- scalar Rust, x86-64 baseline, AVX2 where available, ARM64 NEON, and WASM
  `simd128`;
- aligned and deliberately unaligned buffers, every tail length, and minimum/
  maximum dimensions;
- single-thread baseline before optional shared-memory threading;
- browsers with and without cross-origin isolation and `SharedArrayBuffer`;
- cold compilation, warm steady state, background throttling, tab visibility,
  cancellation, and memory growth; and
- output parity under release optimization, debug assertions, and deterministic
  seed replay.

Do not ship architecture detection that can select an untested kernel. Unsupported
paths must fall back to the validated scalar implementation or reject clearly.

## Phase 5: Preregistered Benchmark Campaign

The benchmark manifest must freeze before results are observed:

- exact methods and ablations;
- effective bit accounting including scales, seeds, codebooks, padding,
  indexes, alignment, and scratch buffers;
- model, tokenizer, dataset, query, browser, compiler, OS, CPU, and power-mode
  identities;
- warmup, iteration count, seed schedule, timeout, process isolation, cache
  state, and parallelism;
- primary metrics and regression budgets;
- exclusion and infrastructure-failure rules; and
- raw-output, trace, receipt, and retention locations.

Compare exact flat `f32`/`f16`, transparent scalar `int8`/`int4`, current
TinyRustLM behavior, and pinned reference systems where executable. Never
compare one method on GPU against another on CPU as a performance conclusion.
Report medians and tails, not only best runs. A result is invalid if a method
uses a decoded shadow representation omitted from its memory accounting.

Time is measured, not invented. For each lane use:

`total_time = setup + warmup + repetitions * measured_operation + validation`

and publish each measured component with uncertainty. Memory accounting is:

`total_bytes = persistent_codes + metadata + transforms + codebooks + pages + scratch + allocator_overhead`

with every term observed or explicitly bounded.

## Phase 6: Adoption Gate

Adopt only if all applicable conditions pass:

- primary-source and license ledger complete;
- scalar oracle and differential kernels pass;
- format bytes and identities are deterministic;
- corrupted and adversarial inputs fail boundedly;
- target native and browser measurements beat the current path on the declared
  metric without exceeding accuracy budgets;
- raw conversational quality and ordinary helpfulness stay within explicit
  regression budgets;
- privacy, consent, deletion, and untrusted-memory tests pass for retrieval;
- no static-weight, KV, or index claim is mislabeled as another lane; and
- a rollback test removes the experimental format and all catalog capability
  declarations without a compatibility shim.

The first implementation order should be scalar oracle, flat retrieval,
retrieval SIMD/WASM, KV numerical prototype, then KV integrated attention.
Static-weight format work remains outside this research lane.

## MemoryEndpoints Retry Gate

The returned batch contains no responsive MemoryEndpoints platform report.
Keep the new retry assignment active until a platform-authoritative response
provides a versioned advertised contract or an explicit typed blocker. Mocks,
generic research plans, HTTP 404s, guessed routes, and local fixtures cannot
satisfy the live gate.
