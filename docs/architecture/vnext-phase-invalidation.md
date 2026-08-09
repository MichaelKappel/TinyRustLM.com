# vNext Exact Phase Invalidation

## Status

This document describes the bounded Node semantic-currentness checkpoint for
vNext campaign receipts. It is not a model qualification result, browser
round, live MemoryEndpoints result, outside-network P2P proof, publication
receipt, or campaign completion claim.

The implementation consists of:

- `contracts/vnext/phase-invalidation-profile.v1.json`;
- `tinyrustlm/tools/vnext-phase-invalidation.js`; and
- `tinyrustlm/tests/vnext-phase-invalidation.test.js`.

The profile is frozen, bound to the exact vNext contract registry, and also
bound by every newly materialized offline verification manifest. The
classifier accepts canonical receipt bytes supplied by the caller and performs
no filesystem discovery, network access, mutation, quarantine, retry, or
selection by completion time.

## Two Identities

Every supported phase receipt has two separate domain-separated identities.

The operation identity binds:

- campaign ID;
- receipt type and phase;
- required public `operation_id`; and
- required public `subject_id`.

The material identity additionally binds the exact operation identity, source
revision, input receipt IDs, named input hashes, tools and binary hashes,
configuration hash, and runtime record. Changing an evaluator binary,
configuration, tokenizer input, or another bound material input therefore
produces a different material identity without changing which logical
operation the attempt addresses.

Output hashes are evidence produced by an attempt and are deliberately not an
input to its material identity. The immutable receipt ID still binds the full
receipt, including output hashes and status.

## Explicit Supersession

There is no implicit newest receipt. Completion time, attempt name, insertion
order, and receipt hash never choose a winner.

A receipt can replace prior attempts only by listing their receipt IDs in
`supersedesReceiptIds`. Every target must have the same operation identity as
the replacing receipt. A receipt cannot name the same prior receipt as both an
input dependency and a supersession target. One convergence receipt may
explicitly supersede multiple unresolved heads for the same operation.

When two or more unsuperseded heads remain for one operation, each head is
classified as `conflict`, the result health is `invalid`, and none is eligible
as current evidence. An operator must create one explicit convergence receipt
or preserve the unresolved conflict.

## Dependency Invalidation

Supersession changes only the target attempt and receipts that depend on it:

1. Explicit targets become `superseded` and remain immutable history.
2. An unsuperseded unique head whose dependencies are all current passes is
   `current-pass` when its own source status is `pass`.
3. An unsuperseded unique head with a nonpass source status is
   `current-nonpass` and is not pass-eligible.
4. A descendant of a superseded, stale, or conflicting input becomes `stale`.
5. A descendant of a current nonpass input also becomes `stale`.

This allows an evaluator replacement to invalidate the old evaluation and its
qualification descendants while leaving unchanged acquisition and conversion
receipts current. A later qualification can depend on the replacement
evaluation and explicitly supersede the old qualification without repeating a
valid large acquisition or conversion.

Semantic staleness never moves or deletes files. Structural corruption remains
the receipt store's responsibility; valid superseded, stale, conflicting, and
nonpass receipts remain available for audit.

## Bounded Determinism

The profile caps receipt count, per-receipt bytes, aggregate bytes, graph
edges, operation heads, result bytes, parser depth, entries, object members,
arrays, and strings. Inputs must be ordinary data-only objects and dense arrays
of owned one-byte views. Shared buffers, accessor-bearing arrays, duplicate
receipts, missing parents, graph cycles, mixed campaigns, unsupported receipt
types, and malformed operation parameters fail with bounded typed errors.

Classification and result serialization are independent of transport order.
The canonical result records:

- every receipt and its operation/material identity;
- source status, currentness state, and bounded reason code;
- current phase receipt IDs;
- current pass-eligible receipt IDs;
- retained historical receipt IDs;
- conflicting operation identities; and
- a domain-separated identity for the exact receipt set.

Returned result data is deeply frozen. Returned canonical bytes are defensive
copies and have a separate raw-byte SHA-256.

## Offline Binding

The offline verification manifest now binds six exact public profiles or
registries, including `phase-invalidation-profile`. This prevents a verifier
from substituting different currentness rules while claiming to verify the
same bundle. The offline authority verifier still proves signature and bundle
closure separately; campaign projection must consume both authority-valid
evidence and this semantic classification.

## Remaining Work

- Add the truthful campaign-plan projection that enforces the exact
  20/50/25/40/20 schedule, uniqueness, freshness, and no-double-count rules.
- Increase and prove offline target-signature and signature-envelope bounds
  before a complete campaign bundle is materialized.
- Reproduce the currentness profile and hostile corpus in independent Rust and
  browser implementations.
- Bind projection output into final attestation, release authorization,
  rendered status, documentation, and public readback.
- Run authorized live operations only after their advertised contracts and
  credentials exist.

No campaign counter changes from this checkpoint.
