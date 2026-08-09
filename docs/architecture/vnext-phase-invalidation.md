# vNext Exact Phase Invalidation

## Status

This document describes the bounded Node and independent Rust
semantic-currentness checkpoint for vNext campaign receipts. It is not a
model qualification result, browser
round, live MemoryEndpoints result, outside-network P2P proof, publication
receipt, or campaign completion claim.

The implementation consists of:

- `contracts/vnext/phase-invalidation-profile.v1.json`;
- `contracts/vnext/phase-invalidation-rust-vectors.v1.json`;
- `tinyrustlm/tools/vnext-phase-invalidation.js`; and
- `tinyrustlm/tests/vnext-phase-invalidation.test.js`;
- `tinyrustlm/tools/vnext-phase-invalidation-rust-vectors.js`;
- `rust/crates/tinyrustlm-evidence/src/receipt.rs`;
- `rust/crates/tinyrustlm-evidence/src/phase_invalidation.rs`; and
- `rust/crates/tinyrustlm-evidence/tests/phase_invalidation_contract.rs`.

The profile is frozen, bound to the exact vNext contract registry, and also
bound by every newly materialized offline verification manifest. The
classifier accepts canonical receipt bytes supplied by the caller and performs
no filesystem discovery, network access, mutation, quarantine, retry, or
selection by completion time.

## Independent Rust Parity

`tinyrustlm-evidence` now independently parses exact canonical vNext receipt
bytes and applies the frozen semantic-currentness profile. It does not call
Node, launch another process, discover files, read the network, consult the
clock, or accept a compatibility schema. The public Rust operation accepts a
campaign ID and caller-owned receipt byte slices, then returns immutable
canonical result bytes and their raw-byte SHA-256 or one bounded stable error
code.

The cross-language corpus is 74,756 bytes with SHA-256
`79a7fa4b35295a90bcf875c4fb400e4ad972feb4b42ac029ef55853c0f45a5c0`.
It binds profile `tinyrustlm.vnext.phase-invalidation.v1`, whose exact profile
bytes have SHA-256
`8e0cccdc007e56ace6550163b0fe1acdd211e74b184053739785a1d925b113cb`.
Four accepted histories freeze byte-identical Node/Rust results for baseline
lineage, successful evaluator replacement and resumed qualification, failed
replacement, and unresolved operation heads. Nine rejection histories freeze
the exact shared error codes for empty input, duplicate receipts, missing
parents, cross-operation supersession, dependency/supersession overlap,
missing operation parameters, unsupported phase types, noncanonical receipt
wire, and campaign mismatch.

The Rust receipt boundary is deliberately stricter than a convenient serde
decode. It rejects missing nullable members, unknown or duplicate members,
noncanonical member order or whitespace, trailing bytes, identity drift,
malformed safe identifiers and timestamps, private or noncanonical public
URLs, invalid security-record payload shapes, and every receipt whose
domain-separated identity does not match its full canonical content. The
currentness implementation separately validates dependency, supersession, and
combined acyclic graphs before classifying any head.

This is semantic-currentness parity only. Rust signature authority,
revocation evaluation, truthful campaign projection, the generated browser
currentness ABI, production runner integration, release authorization, and
live evidence remain separate gates. The existing browser WASM boundary still
exposes only campaign-plan finalization and validation.

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

The offline verification manifest now binds seven exact public profiles or
registries, including `phase-invalidation-profile` and
`campaign-projection-profile`. This prevents a verifier
from substituting different currentness rules while claiming to verify the
same bundle. The offline authority verifier still proves signature and bundle
closure separately; campaign projection must consume both authority-valid
evidence and this semantic classification.

## Remaining Work

- Expose the completed Rust classifier through one generated browser WASM
  interface and replay the same frozen corpus in independently deleted browser
  profiles without duplicating semantics in JavaScript.
- Implement independent Rust signature-authority and truthful-projection
  parity before Rust can admit current campaign evidence.
- Bind projection output into final attestation, release authorization,
  rendered status, documentation, and public readback.
- Run authorized live operations only after their advertised contracts and
  credentials exist.

No campaign counter changes from this checkpoint.
