# TinyRustLM Colibri And Specialist Portfolio TDD Delta

Date: 2026-07-21

## Purpose

This plan turns the useful Colibri and specialist-portfolio ideas into
falsifiable work. It does not adopt Colibri, authorize training, or claim that
existing adapters are useful specialists. TinyRustLM is pre-release, so a
clean replacement is required when the current mutation model conflicts with
the desired invariant; no legacy adapter-switching shim is needed.

## Phase 0: Artifact And Composition Identity

Write failing schema tests first:

- classify every artifact as standalone model, base-dependent adapter,
  composition manifest, shared storage chunk, KV format, or retrieval index;
- reject a dependent adapter presented as a standalone `.slm`;
- bind a composition to the exact base hash, tokenizer hash, tensor layout,
  ordered adapter hashes, runtime identity, route policy, and quality receipts;
- reject adapter order drift, duplicate members, missing members, base mismatch,
  tokenizer mismatch, and quantization/layout mismatch;
- record logical composition bytes, incremental specialist bytes, standalone
  bytes, and physical deduplicated bytes as distinct fields;
- reject a size claim that omits the required base or required shared chunks;
- bind task scope, fallback target, and out-of-scope behavior; and
- bind KV-cache identity to the exact composition rather than only a model
  alias.

Acceptance: a manifest rebuild is deterministic, every executable composition
has one content identity, and no catalog entry can turn a dependent sidecar or
physical deduplication result into a misleading standalone-model claim.

## Phase 1: Reversible Specialist Activation

Start with tests that fail against destructive cumulative application:

- `base -> A -> base` restores byte-identical logical tensors and baseline
  logits for fixed vectors;
- `base -> A -> base -> B -> base` produces the same A and B logits as fresh
  isolated loads;
- `base -> A -> B` follows only the declared composition order and never
  inherits an undeclared prior adapter;
- one hundred activation/reset cycles produce no cumulative drift;
- failed validation, allocation, requantization, or activation leaves the
  prior active composition unchanged;
- activation is atomic from the generator's perspective;
- model or adapter switching clears generated tokens, exact-prefix authority,
  and KV state before the next prompt;
- validation without activation changes no model, KV, diagnostics, or
  composition identity;
- f32, q8_0, and q4_0 lanes meet declared differential tolerances without
  silently materializing permanent full-precision duplicate tensors; and
- cancellation and model free release all overlay-owned allocations.

Preferred implementation: immutable base storage plus explicit overlay or
composition state. A verified clean-base reload is an acceptable measured
baseline, not a reason to retain cumulative mutation as the switching design.

Acceptance: exact restoration and atomic failure behavior pass under native
and WASM memory instrumentation. The active composition checksum always names
the values used for generation.

## Phase 2: Real Specialist Training Gate

Do not use unresolved review data. After an independently approved corpus is
available, preregister one narrow task and compare:

- immutable champion base;
- one low-rank adapter at several ranks within a declared byte budget;
- one sparse delta at several densities;
- one independently distilled standalone specialist; and
- one arbitrary slice as a negative control expected to fail.

Training identity must bind source revision, base model, tokenizer, chat
template, corpus record hashes, exclusion sets, contamination scans, optimizer,
seed, schedule, precision, checkpoint, and produced artifact. The sealed
promotion suite may not enter training or teacher generation.

Acceptance: the specialist exceeds a preregistered task gain, remains inside
ordinary-helpfulness regression budgets, handles unseen paraphrases, and has a
better measured size/quality tradeoff than its alternatives. Otherwise delete
the experimental format or checkpoint with no compatibility obligation.

## Phase 3: Routing And Fallback

Implement explicit selection before learned routing. Required tests:

- user-selected champion and specialists activate the exact displayed
  composition;
- deterministic rules are versioned and produce the same route from the same
  normalized request metadata;
- ambiguous and out-of-scope requests fall back to the champion;
- specialist refusal or malformed output does not trigger hidden best-of-N
  generation;
- untrusted retrieved or quoted text cannot change the router policy;
- latest explicit user selection overrides stale remembered preferences;
- route failure leaves the champion available and discloses an honest status;
  and
- route latency, switch latency, and memory peak count toward end-to-end
  comparison.

A learned router is a later lane. It requires a sealed confusion matrix,
per-class precision/recall, calibration, uncertainty threshold, adversarial
quoted-instruction tests, wrong-route cost, and comparison with always using
the champion.

Acceptance: the routed portfolio beats the champion on the declared weighted
quality objective after route errors and overhead are included, with no
critical out-of-scope regression.

## Phase 4: Shared Content-Addressed Storage

Write storage tests independent of model quality:

- exact duplicate tensor/piece bytes map to one content object;
- different bytes never deduplicate from names, shape metadata, or approximate
  similarity;
- composition manifests enumerate all required chunks and their logical
  offsets, roles, sizes, and hashes;
- interrupted import resumes only from matching artifact and piece-set
  identities;
- missing, truncated, corrupt, path-traversing, symlinked, or reparse-point
  chunks fail before runtime load;
- garbage collection retains every chunk reachable from an active or retained
  receipt and removes only verified unreachable objects;
- two process lanes may share a read-only store without sharing mutable
  activation or KV state; and
- reports distinguish source bytes, transferred incremental bytes, physical
  store bytes, and logical executable bytes.

Acceptance: independently reconstructed compositions have exact artifact
hashes, corruption cannot mix families, and the measured portfolio saving is
reported without calling it a smaller logical model.

## Phase 5: KV-Cache Experiment

Keep this lane separate from specialist weight size. Compare the current f32
cache with transparent f16/int8/int4 and experimental vector quantization:

- materialize reference Q, K, V, RoPE, logits, softmax, and attention outputs;
- bind every cache page to exact composition and positional identity;
- reject reuse after any base, adapter, tokenizer, template, positional, or
  cache-format change;
- test keys and values independently, grouped-query attention, recent-token
  precision windows, page tails, cancellation, context truncation, and memory
  pressure;
- measure allocated, committed, peak, and steady bytes at multiple contexts;
- compare direct compressed attention with decode-to-shadow-cache designs,
  counting all scratch and shadow bytes; and
- run sealed multi-turn raw-output cases for current preference, source
  conflict, practical constraints, untrusted memory, ordinary chat, and long
  references.

Acceptance: target browser and native lanes reduce measured memory or latency
without exceeding numerical or behavioral budgets. No KV result changes a
`.slm` weight-size or weight-bit claim.

## Phase 6: Native Placement Prototype

Only pursue Colibri-style placement for an admitted architecture whose modules
can be loaded independently without changing numerical behavior. Begin with a
synthetic or fixture module graph, then one real admitted model.

Required tests:

- placement manifest binds every module hash, byte range, tier, and resource
  envelope;
- prefetch hit and miss produce identical numerical output;
- cold, warm, and memory-pressure runs record disk reads, bytes, queue depth,
  resident set, first-token latency, and decode latency;
- cache learning is bounded, versioned, removable, and never silently changes
  artifact or quality identity;
- lossy module or expert pruning is a separately named mode with independent
  quality receipts;
- process restart, partial reads, disk-full, corrupt modules, and cancellation
  leave no mixed active model;
- browser claims remain absent unless a separate browser-owned storage and
  streaming implementation passes; and
- every expert/module byte remains included in total local storage accounting.

Acceptance: placement improves a declared target metric on real hardware and
preserves raw output for exact mode. Otherwise remove the experiment.

## Phase 7: Portfolio Promotion Matrix

Freeze the experiment manifest before observing results. For champion,
low-rank specialist, sparse specialist, standalone specialist, and routed
portfolio, record:

- exact model/composition/runtime/evaluator identities;
- fixed and stochastic seed policy with untouched raw outputs;
- task-specific and broad-assistant pass rates on sealed paraphrases;
- critical-failure counts and human-review disagreements;
- route precision, recall, fallback, and wrong-route behavior;
- standalone, incremental, logical, physical, scratch, and peak resident bytes;
- cold load, warm activation, switch, prefill, first-token, and decode timings;
- repeated activation stability and KV invalidation evidence; and
- native/WASM/browser coverage labels that do not substitute one platform for
  another.

Promotion requires all applicable gates. One attractive answer, lower bytes,
or a favorable microbenchmark cannot compensate for semantic failure.

## Explicit Non-Goals

- no arbitrary dense-model byte, layer, head, or tensor slicing as a product
  specialist;
- no claim that model-level routing is token-level MoE;
- no cross-composition KV reuse without an independently proved transform;
- no hidden best-of-N answer selection;
- no Colibri import into the current browser runtime;
- no speculative decoding until draft/target tokenizer compatibility and
  batched target verification exist and are measured;
- no claim that TurboQuant or TurboVec reduces static `.slm` weights; and
- no training before the current human-review gates authorize a corpus.

## Stop And Rewrite Rule

Any phase that fails identity, reversibility, corruption, quality, privacy,
memory, or target-platform gates is rejected with retained evidence. Because
the product is not live, remove the failed implementation and replace the
contract cleanly; do not add a legacy reader, compatibility branch, migration
shim, or catalog alias for unreleased behavior.
