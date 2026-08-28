# TinyRustLM OMI Computational Architectures Intake TDD Delta

Date: 2026-08-27

## Purpose

This delta translates the accepted portions of the 23-report intake into
testable TinyRustLM engineering boundaries. It does not authorize a new OMI
runtime, a speculative research implementation, a production claim, or a
change to an immutable operation. Reports advise; preserved local failures and
new tests decide.

Every change follows these rules:

1. preserve a concrete failure or identify one exact missing invariant;
2. write positive, negative, boundary, malformed, race, and cancellation tests
   before broad implementation;
3. improve the sole current clean-slate path, never add a parallel path;
4. bind changed source and evidence identities;
5. rerun only invalidated phases, then run the complete affected release gate;
6. delete superseded executable code in the same coherent green major change.

## Gate 0: Intake Custody And Decision Separation

### Red tests

- reject a missing, renamed, truncated, or hash-changed raw report;
- reject an inventory whose canonical digest is not
  `b7b38621fb19353859b5a484ef4f15655990420797f1ec22a802b9f529c5b453`;
- reject a raw report that was normalized or repaired during intake;
- reject a manifest that labels advisory research as implementation or proof;
- reject a `.uai` entry that cites a raw report as current authority while
  omitting the reviewed wiki synthesis.

### Green condition

- 23 report files, 2,419,951 bytes, and every SHA-256 match the manifest;
- raw reports, manifest, synthesis, TDD delta, and wiki memory are distinct;
- the wiki identifies accepted, rejected, deferred, and locally unknown facts;
- hot `.uai` memory deep-links to the wiki and stays bounded.

### Claim boundary

This gate proves intake custody only.

## Gate 1: Release-Surface Exact Closure

### Preserved failures

The clean release-surface gate at source commit
`5828fbdec19726ae9ba583a8d6be57d775c57ac7` completed 1,676 tests with 1,664
passes, nine failures, and three skips. The two root defects are:

1. a scalar profile expects a 1,781-byte `Cargo.toml`, while current intended
   source is 1,832 bytes;
2. `tinyrustlm/app/model-runtime-worker.js` is absent from the exact web
   deployment manifest, causing eight downstream web failures.

### Red tests

- fail when any deployed source asset is not in the exact manifest;
- fail when the manifest names an absent, extra, or hash-different asset;
- fail when a source profile identity drifts from intended current source;
- fail when an identity is updated without its behavior and dependency tests;
- fail when the browser UI can load an old runtime path beside the worker;
- fail when documentation or a publication log describes a worker asset that
  the deployment inventory omits.

### Green implementation

- admit the dedicated worker under one exact deployable identity;
- update the scalar source identity only after reviewing and testing the
  intentional source delta;
- keep deployment blocked until the complete affected gate passes;
- do not introduce a broad wildcard manifest, compatibility asset, or ignored
  mismatch.

## Gate 2: Closed Operation And Declared Mutation Scope

### New invariant

An operation declares exactly which state members it may change. Execution
produces a candidate state and a bounded observed diff. Any mutation outside
the declaration is a typed terminal rejection.

### Red tests

- missing operation, parent, composition, conversation, turn, generation, or
  schema identity;
- duplicate or replayed terminal transition;
- state mutation after terminality;
- an undeclared field mutation, deletion, insertion, or identity change;
- declared mutation whose precondition no longer matches current state;
- stale worker event attempting to mutate replacement-worker state;
- cancellation that still commits a complete assistant turn;
- model switch that retains incompatible KV or generation state;
- evidence writer that modifies raw evidence while summarizing it.

### Positive and counterexample tests

- exact allowed field changes pass;
- repeated identical token text remains legal when event identities differ;
- an idempotent duplicate event is ignored without discarding a legitimate
  later event;
- a contradiction record adds a new attributed assertion without rewriting
  either source assertion;
- terminal error and cancellation states prevent subsequent success.

### Implementation limit

Use the existing worker, memory, and receipt state machines. Do not create a
generic world-model or OMI kernel solely to express this rule.

## Gate 3: Memory Provenance, Conflict, And Non-Adaptation

### Required invariants

- model weights, adapters, KV, transcript, local UAIX, retrieval index, and
  MemoryEndpoints records have separate identities and lifecycles;
- current user preference supersedes stale remembered preference for current
  behavior without deleting history;
- contradictory records remain visible with source, revision, trust class,
  supersession, and tombstone state;
- retrieved text is untrusted data and cannot grant capability;
- durable memory changes occur only through an explicit typed write;
- runtime conversation never changes model or adapter weights.

### Red tests

- malicious memory text attempts to issue a system or tool instruction;
- stale memory overrides the current turn;
- two contradictory records collapse silently to last-write-wins;
- raw transcript is promoted to long-term memory without an explicit event;
- test-time generation mutates model bytes, adapter bytes, or durable memory;
- KV survives composition or worker identity change;
- reconnect reports exact continuity while conflicts or stale indexes remain;
- deletion removes a current record but leaves an undisclosed retrievable copy.

### Green condition

Memory returns bounded attributed candidates and explicit conflict status. The
authority assembler applies deterministic precedence and preserves the decision
as a new event. No fast weights, test-time learning, or silent consolidation
exist in the shipping path.

## Gate 4: Replayable Private-By-Default Observability

### Required operation envelope

For each bounded operation record only fields needed for its domain, such as:

- schema and operation identity;
- parent, input, artifact, runtime, and profile identities;
- start/end monotonic sequence or bounded timestamps;
- declared resource limits and observed bounded summaries;
- cancellation or terminal status and typed safe error;
- references to private raw evidence, never the raw secret payload in public
  receipts;
- invalidation and supersession edges.

### Red tests

- prompt, token, enrollment URL, authorization header, workspace key, raw
  hosted-memory payload, or unsafe local path appears in public output;
- low-entropy secret is represented by an unsalted or unhardened guessable
  digest;
- replay omits a software, artifact, seed, ordering, or profile identity;
- log volume, cardinality, or error payload exceeds its bound;
- producer self-attestation is accepted without recomputation;
- centralized telemetry is required for local correctness;
- cancelled or failed operations are overwritten by a later pass.

### Green condition

Private evidence is sufficient for debugging and independent verification;
public summaries are bounded and secret-free. Replay either reproduces the
typed result or ends in an immutable disagreement. No raw telemetry service or
graph database is a shipping dependency.

## Gate 5: Ambiguity, Planning, And Explicit Tool Authority

### Semantic test families

- underspecified decisions vary missing options and criteria;
- requested evidence varies availability, privacy, cost, and consent;
- practical plans vary resources, deadlines, units, and state changes;
- retrieved and quoted instructions vary source and malicious content;
- declared tools vary capability, precondition, expiration, cancellation, and
  compensation;
- deterministic algorithm tasks vary structure and size beyond development
  examples.

### Required behavior

- ask at most a bounded useful clarification when it changes the decision;
- stop asking when information value is lower than burden or unavailable;
- never activate a data source or tool without capability and user authority;
- validate the whole practical plan and offer a feasible alternative when one
  exists;
- call a deterministic calculator or parser only as declared product behavior,
  never as a hidden fallback;
- preserve a raw model failure instead of repairing it.

### Metamorphic tests

Vary entities, order, synonyms, units, explicit and implicit negation, resource
availability, irrelevant distractors, graph labels, structure size, and
current-turn updates. Define expected invariance per family rather than assume
all paraphrases or synonyms are equivalent.

## Gate 6: Research-Arm Admission

No equality-saturation, energy-based, topological, sheaf, adaptive-memory,
probabilistic-programming, world-model, or hierarchical-skill experiment may
enter product source until its own registration includes:

1. one narrow product bottleneck;
2. a simpler current baseline;
3. immutable input and implementation identities;
4. equal quality, compute, memory, latency, and storage accounting;
5. negative controls and hostile cases;
6. sealed evaluation and contamination exclusions where model behavior is
   involved;
7. deterministic seeds or a precommitted stochastic analysis;
8. explicit stop, reject, and rollback rules;
9. no effect on shipping behavior before independent promotion.

### Immediate rejection conditions

- the proposal adds a new service or framework without removing measured
  complexity;
- it depends on a compatibility path, fallback, retry, or repair;
- it cannot separate model quality from runtime speed;
- it mutates weights or durable memory during product use;
- it claims privacy, determinism, or production readiness without tests;
- it delays the first real browser model without solving a release blocker.

## Gate 7: Documentation And UAI Drift

### Red tests

- current `.uai` memory names raw intake as authority but lacks the reviewed
  wiki route;
- architecture or test memory omits accepted and rejected boundaries;
- a site or document claims an advanced runtime that does not ship;
- MemoryEndpoints is called unauthorized, simulated success is counted, or
  campaign counters differ from exact receipts;
- current docs retain SLM1/ACG1 behavior after its clean replacement;
- publication log, version identity, release date, source commit, and HTTPS
  readback disagree.

### Green condition

- compact `.uai` entries deep-link to the durable wiki memory;
- the wiki links the exact manifest, synthesis, and TDD delta;
- architecture, operations, tests, totem, taboo, and resume memory hold only
  their domain-specific conclusions;
- documentation and marketing remain synchronized with proven behavior.

## Gate 8: First-Model Release Recheck

After Gates 1 through 7 and the existing SLM2 browser clean cut are green, run
the complete affected source, Rust, Node, .NET, package, real Chromium,
responsive UI, accessibility, privacy/network, documentation, secret/path,
deployment, and HTTPS readback matrices. A deploy is allowed only when every
affected gate passes from committed, pushed, remote-exact source.

This intake alone invalidates no model acquisition, composition, numerical, or
live external evidence. It creates no campaign credit.
