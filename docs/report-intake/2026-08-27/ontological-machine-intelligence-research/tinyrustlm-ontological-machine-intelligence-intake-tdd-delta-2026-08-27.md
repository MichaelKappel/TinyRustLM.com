# TinyRustLM Ontological Machine Intelligence Intake TDD Delta

Date: 2026-08-27

## Purpose

This document turns the accepted parts of the 2026-08-27 ontological machine
intelligence intake into testable TinyRustLM engineering work. It does not
authorize production experiments, change frozen one-shot operations, or treat
research reports as evidence.

The delta follows four rules:

1. start from a preserved general failure or explicit missing invariant;
2. add positive, negative, boundary, malformed, and disagreement tests before
   broad implementation;
3. replace the sole prelaunch contract without a compatibility path; and
4. preserve every rejected artifact and rerun only phases invalidated by the
   changed identity.

## Gate 0: Intake Integrity And Decision Separation

### Required red tests

- fail if any manifest file is missing, renamed, truncated, or hash-changed;
- fail if the canonical inventory hash changes without a new intake identity;
- fail if a raw report is normalized or repaired during processing;
- fail if a report is labeled implementation, runtime, quality, release, or
  production evidence;
- fail if a synthesis decision is written into a raw report.

### Green condition

- all twelve source and destination sizes and SHA-256 values match;
- the canonical inventory digest is
  `622aeee51b3a687d573880b0474d395e2ee44db674e91eca65441c7a7c2c3ede`;
- `MANIFEST.md`, this TDD delta, and the reviewed synthesis are separate files;
- every recommendation names its evidence class and local unknowns.

### Evidence scope

This gate proves intake custody only. It proves no project implementation or
research conclusion.

## Gate 1: One Exact MemoryEndpoints Submit Payload

### Preserved defect

The outbound memory-event payload represented two concepts twice:

- `actorAgentId` and compatibility `agentId`;
- `summary` and compatibility `safeSummary`.

The project is prelaunch and has no old payload population that justifies those
aliases.

### Red tests

Add the same semantic assertions independently in Rust, .NET, and browser
JavaScript:

1. a prepared payload contains `actorAgentId` and `summary`;
2. it does not contain `agentId` or `safeSummary`;
3. adding either retired alias makes persisted-row validation fail;
4. unknown payload members fail;
5. the shared fixture has one identical payload fingerprint in all runtimes;
6. the old outbox/local-receipt kind or version fails;
7. the old idempotency prefix fails current validation or is never produced;
8. credentials, authorization headers, workspace keys, and tokens are absent
   from persisted rows.

### Green implementation

The sole current payload is:

1. `workspaceId`;
2. `actorAgentId`;
3. `kind`;
4. `version`;
5. `scope`;
6. `scopeId`;
7. `memoryType`;
8. `subject`;
9. `title`;
10. `summary`;
11. `source`;
12. `confidence`;
13. `uaiReferences`;
14. `tags`;
15. `tinyrustlmMemoryTier`;
16. optional `sourceSha256`.

The current technical identities are:

- memory record: `tinyrustlm.memory_endpoints.memory_record.v1`;
- outbox entry: `tinyrustlm.memory_endpoints.outbox_entry.v2`, version `2`;
- local receipt: `tinyrustlm.memory_endpoints.local_receipt.v2`, version `2`;
- authoritative hosted receipt: unchanged
  `tinyrustlm.memory_endpoints.authoritative_receipt.v1` because that separate
  response contract did not change;
- payload digest domain:
  `tinyrustlm.memory_endpoints.submit_payload.digest.v2`;
- idempotency prefix: `tinyrustlm-memory-v2-`;
- browser database: fresh `tinyrustlm-memory-endpoints`, database version `1`;
- shared fixture payload SHA-256:
  `ffa9fb1d3b729902d8a62621ce08d627b7042aaad89f5d8ca51a6257f3e305aa`.

### No-debt assertions

- no old database reader;
- no migration;
- no dual serializer;
- no alias acceptance;
- no relabeling of old rows as current evidence;
- no hidden retry using an obsolete shape;
- no test that accepts both contracts.

### Verification matrix

| Boundary | Positive | Negative | Cross-runtime | Live proof |
| --- | --- | --- | --- | --- |
| Rust | prepare, hash, serialize, validate | alias, unknown, mutation, credential | shared digest | not established |
| .NET | prepare, hash, serialize, client request | alias, unknown, mutation, credential | shared digest | not established |
| Browser | prepare, hash, store, retry | alias, unknown, mutation, duplicate | shared digest | not established |
| Scripts | exact outbound shape and syntax | old names absent | fixture agreement | not established |
| Relay fixture | strict key set and values | surplus/missing fields rejected | loopback only | explicitly no |

### Invalidation

The change invalidates old local outbox rows, local receipts, payload digests,
idempotency keys, and the old browser database. It does not invalidate
unrelated local UAIX memory, source acquisition, model conversion, model
quality, or an authoritative hosted-receipt schema that did not change.

## Gate 2: Exact External MemoryEndpoints Capability And Response Contract

### Missing authority

Client source currently contains multiple spellings in some search,
meeting-transcript, and response boundaries. The local repository cannot prove
which are current live service fields.

### Required red tests before implementation

- capability document missing, wrong origin, wrong schema identity, expired, or
  oversized;
- route not advertised;
- HTTP method or content type differs;
- unknown-field policy differs;
- response contains an unadvertised alias;
- two fields claim the same concept with conflicting values;
- cross-tenant, wrong-agent, stale-token, or revoked-token response;
- search result lacks provenance or stable revision identity;
- authoritative receipt cannot be bound to the submitted event and body hash.

### Green condition

- a public or authorized versioned contract advertises exact discovery,
  enrollment, submit, search, pull, revision, receipt, rotation, close, delete,
  and post-delete behavior;
- Rust, .NET, browser, scripts, fixture, and docs implement those exact shapes;
- guessed query aliases and permissive response alternatives are deleted;
- fixture conformance passes;
- authorized live tests prove tenant isolation, continuity, and cleanup;
- only then may a live receipt advance the `0/25` counter.

### Stop rule

Do not invent routes or remove fields by aesthetic preference while service
authority is unavailable. Mark the live gate externally blocked and continue
local contract, browser, privacy, and fixture work.

## Gate 3: Production SLM2 Clean Cut And Superseded Closure Deletion

### Preserved local failure

The current browser still loads old WASM and ACG1 while current SLM2 crates are
present. This is two architectural eras, not a completed clean cut.

### Existing authority

The implementation and deletion boundary is already preregistered in:

- `contracts/vnext/production-slm2-clean-cut-preregistration.v1.json`;
- `docs/architecture/2026-08-24-production-slm2-clean-cut-preregistration.md`.

This TDD delta does not replace or loosen that authority.

### Required red tests

- browser application references old `tinyrustlm.wasm` or `.slm.acg1`;
- browser admission accepts SLM1 or ACG1;
- browser harness serves old runtime assets;
- companion, qualification, or smoke tools invoke `tinyrustlm-slm-pack`;
- native/.NET/P2P package surface references the old runtime SDK or validator;
- old crates or copied old WASM are included in build, package, archive, or
  deployment inventories;
- current product documentation tells users to use SLM1/ACG1;
- a new parser accepts both old and new formats;
- a structural pass is labeled numerical, behavioral, browser, or release proof.

### Green sequence

1. prove complete deterministic Qwen3 SLM2 conversion;
2. prove independent composition inspection;
3. prove scalar-native numerical execution;
4. prove optimized-native non-regression;
5. prove production browser-WASM execution and genuine multi-turn chat;
6. rewrite native ABI, .NET, P2P, companion, browser acquisition, admission,
   harness, qualification, and docs to the sole new contract;
7. delete `rust/crates/tinyrustlm-slm`, `tinyrustlm/runtime`,
   `tinyrustlm/tools/slm_pack`, executable ACG1, and copied old assets;
8. run negative source, dependency, package, archive, browser precache,
   documentation, and deployment searches;
9. run the full affected test and release matrix;
10. commit, push, deploy eligible sites, and verify public bytes.

### Completion condition

All production entry points use SLM2 and no executable or packaged old path
remains. Until then, the project cannot claim zero legacy code or release the
mixed architecture.

## Gate 4: Typed Evidence And Honest Status

### Red tests

- a producer's `passed` field can promote itself;
- model output can change test, tool, memory, P2P, or release status;
- one boolean represents conversion, quality, browser, and publication;
- stale or expired outside proof still produces `active`;
- a local fixture increments a live counter;
- rejected evidence can be overwritten;
- an evaluator change leaves dependent promotion valid;
- a UI label lacks a derivation from current evidence.

### Green implementation

Use distinct records for observation, claim, decision, authorization,
execution result, independent verification, rejection, external blockage,
supersession, expiry, and publication. Derive user-visible status from current
typed evidence. Preserve every terminal failure and create a new identity for
retry.

### Property/model tests

- every reachable state has an allowed predecessor;
- terminal rejection has no mutation edge;
- retry creates a distinct operation identity;
- invalidating an input invalidates all and only dependent receipts;
- publication cannot precede every required phase;
- no evidence cycle can establish its own authority;
- expired proof cannot satisfy a current proof requirement.

## Gate 5: Memory As Untrusted User-Owned Data

### Red tests

- retrieved memory containing an imperative can authorize an action;
- stale memory overrides the latest user instruction;
- raw conversation silently becomes long-term memory;
- a record lacks provenance, revision, tier, or user-visible source;
- a tombstoned record appears in generated context;
- one user's record appears for another tenant or agent;
- deletion claims success without authoritative proof.

### Green implementation

- local UAIX and portable MemoryEndpoints records remain distinguishable;
- retrieved content is rendered and passed as quoted untrusted data;
- latest explicit user preference has precedence;
- promotion to durable memory is explicit and attributable;
- context packing is bounded and receipt-backed;
- tenant, user, agent, tier, revision, supersession, and tombstone rules are
  exact;
- deletion and cleanup are independently verified.

## Gate 6: Measured Resource Truth

### Red tests

- model narration supplies memory or performance status;
- benchmark lacks exact model, artifact, runtime, browser, hardware, workload,
  or tool identity;
- optimized output differs beyond preregistered tolerance;
- context or KV growth exceeds the declared bound;
- cancellation reports complete after work continues;
- unsupported SIMD or WebGPU silently selects an unqualified path;
- a microbenchmark result is generalized to end-to-end chat.

### Green implementation

Record exact storage, acquisition bytes, conversion disk/RAM, browser quota,
resident and peak memory, context/KV bytes, prefill/decode latency, throughput,
cancellation latency, and network bytes. Keep scalar correctness and optimized
performance as separate evidence. Reject unsupported profiles truthfully.

## Gate 7: Immutable Shadow Improvement Experiments

### Applies to

- quantization and KV compression;
- champion/specialist routing;
- adapters or distillation;
- HDC/VSA probes;
- Koopman or neural-field representations;
- morphogenetic or adaptive systems;
- test-time training or self-modification research.

### Red tests

- active runtime weights or policy mutate in place;
- user memory enters training without governed consent and lineage;
- candidate selects its evaluator, holdout, seed, or threshold;
- failed holdout enters training;
- model-authored proof is sole authority;
- promotion overwrites the active artifact;
- research code or dependency enters release packages before qualification.

### Green state machine

`hypothesis -> preregistered -> isolated-running -> evidence-complete ->`
`independent-review -> promoted | rejected | externally-blocked`

Promotion creates a new immutable artifact and only after retained-capability,
quality, privacy, security, numerical, resource, package, and browser gates.
Rejected candidates remain immutable and non-selectable.

## Gate 8: Documentation, Source Control, And Release Truth

### Red tests

- behavior changes without architecture/user/API/security documentation;
- docs retain deleted legacy commands;
- marketing claims quality, memory, P2P, publication, or completion without
  current receipts;
- deployed source is uncommitted or remote-divergent;
- release log lacks source identity, date, version, change, limitation, or
  readback;
- package creation is called publication;
- cross-compilation is called real hardware execution;
- local P2P health is called public reachability.

### Green condition

Every coherent major change builds, is committed, pushed, freshly fetched, and
verified against the remote ref. Every affected site passes its full gate,
updates robust documentation and publication history, deploys atomically when
eligible, and receives public HTTPS readback. Blocked sites remain explicitly
not deployed rather than receiving a partial low-quality patch.

## Test Execution Order

For each implementation change:

1. preserve the raw defect or missing invariant;
2. write the narrow general red test;
3. add positive and counterexample tests;
4. implement one current contract;
5. delete superseded behavior;
6. run focused tests;
7. run affected format/lint/static checks;
8. run cross-language differential vectors;
9. run package/browser/privacy/docs tests;
10. run live or outside proof only when authorized;
11. archive bounded evidence and remaining risks;
12. commit and push the green coherent change.

## Current Evidence Snapshot

As of this delta:

- intake custody: locally verified;
- strict submit-payload focused Rust tests: passing;
- strict submit-payload focused browser tests: passing;
- relevant .NET MemoryEndpoints tests: 33 passing across two test projects;
- solution-level .NET command: passing after a locked restore repaired missing
  local NuGet analyzer/test files discovered by the first invocation;
- loopback relay fixture: passing for the strict shape;
- live MemoryEndpoints acceptance: unproven;
- complete SLM2 cutover and SLM1 deletion: not achieved;
- model/browser/P2P/publication campaign counters: unchanged at zero.

No broader claim may be inferred from these focused results.
