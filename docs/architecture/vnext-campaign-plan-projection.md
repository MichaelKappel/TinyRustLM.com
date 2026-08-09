# vNext Exact Campaign Plan And Truthful Projection

## Status

This document describes the bounded control-plane checkpoint that fixes one
exact TinyRustLM campaign schedule and projects its current evidence. It
does not claim that any model qualified, browser round completed, live
MemoryEndpoints company restored and deleted, P2P lane was observed from an
outside network, model was announced, or campaign completed.

The implementation consists of:

- `contracts/vnext/campaign-projection-profile.v1.json`;
- `tinyrustlm/tools/vnext-campaign-projection.js`; and
- `tinyrustlm/tests/vnext-campaign-projection.test.js`;
- `rust/crates/tinyrustlm-evidence` for independent plan finalization and
  validation;
- `tinyrustlm/tools/vnext-campaign-plan-vector-generator.js`;
- the two frozen campaign-plan parity fixtures in `contracts/vnext`;
- `contracts/vnext/campaign-artifact-store-profile.v1.json`; and
- `tinyrustlm/tools/vnext-campaign-artifact-store.js` for immutable plan and
  projection-snapshot persistence.

The profile is frozen and binds the exact contract registry,
phase-invalidation profile, and Ed25519 authority profile. Every newly built
offline verification manifest binds the campaign-projection profile as its
seventh public profile or registry. Projection accepts caller-supplied bytes,
uses no filesystem discovery or network client, and never mutates source
evidence.

## Exact Plan

`finalizeVnextCampaignPlan` accepts one closed data-only draft and creates a
domain-separated `planId` plus canonical bytes and a raw-byte SHA-256. The
plan contains exactly:

- 20 model slots with 20 distinct artifact IDs and SHA-256 values;
- 50 browser rounds, with exactly 25 marked for memory continuity;
- 25 memory rounds in a one-to-one relationship with those marked rounds;
- 40 P2P lanes, exactly two per model;
- 40 globally distinct process-instance IDs, one per lane; and
- 20 catalog announcements, exactly one per model.

Every model appears under at least two distinct clean-restart IDs. Model,
round, memory, lane, process, announcement, company-hash, and operation
identities are unique in their required scopes. Arrays have one specified
lexicographic order. The model artifact ID must be the `sha256:` form of its
artifact SHA-256. Drift in a count, relationship, process identity, operation
identity, order, or artifact identity rejects the plan instead of producing a
different interpretation.

The application origin, campaign, environment, memory contract, and creation
time are part of the plan identity. A projection caller separately supplies
and must match the expected plan SHA-256, campaign, and environment.

## Independent Rust Plan Parity

`tinyrustlm-evidence` independently parses, validates, finalizes, and validates
the final wire for the exact closed campaign-plan schema. It does not call
Node, launch a process, read a discovered file, or use the Node serializer.
Both implementations must produce the byte-for-byte frozen final plan:

- draft size: 22,929 bytes;
- draft SHA-256:
  `95898b68686b2dcc9dc8700c58a5bff37114ef719e3c281c45303d011d11a23e`;
- plan ID:
  `sha256:0207e508652790aa158bdb0c13c10c2aefe401e9cfc48b98bc9dc05dcdb63a7e`;
- final size: 23,012 bytes; and
- final SHA-256:
  `89c487682ff69f7982d7cb24eda9fcff10702164c8ccb3608e748cf145339b19`.

The Rust boundary uses strict typed `serde` structures with unknown-field and
duplicate-field rejection. It checks the frozen profile constants, bounded
input, exact cardinalities, sort order, referential relationships, global
operation uniqueness, distinct artifacts and processes, HTTPS origin
canonicalization through the standards-based `url` crate, exact UTC grammar,
and domain-separated identity. Final-wire validation re-finalizes the parsed
draft and compares every byte, so whitespace, alternate member order, a
changed plan ID, or trailing transport bytes reject.

The serializer is intentionally specific to this closed plan schema. The
current values are booleans, arrays, objects, and ASCII-constrained strings,
and strings are escaped by `serde_json`. This is an exact parity claim for the
campaign-plan wire, not a claim that the crate is a general-purpose JCS
implementation. The crate forbids unsafe Rust, returns bounded stable error
codes, owns returned bytes, and builds for both native Rust and
`wasm32-unknown-unknown`. See
`docs/architecture/vnext-rust-campaign-plan-parity.md` for the boundary and
test matrix.

## Evidence Inputs

`projectVnextCampaign` accepts exactly:

- canonical campaign-plan bytes and their expected SHA-256;
- expected campaign and environment;
- a trusted verification time;
- either both out-of-band authority-registry pins or neither;
- canonical receipt bytes; and
- canonical non-receipt subject bytes.

Input objects and arrays must be ordinary data properties. Byte inputs are
copied through intrinsic typed-array metadata access. Shared buffers,
non-byte views, accessors, sparse arrays, duplicate identities, mixed
campaigns, noncanonical JSON, excess counts, and excess bytes fail with typed
bounded errors.

When no authority pins and evidence exist, projection returns honest zeros,
`authorityStatus=unavailable`, and explicit blockers. It does not manufacture
an authority graph to make a dashboard look active.

## Counting Rules

A phase receipt can count only when all of these are true:

1. Its receipt type, phase, operation ID, subject ID, public parameters,
   outputs, runtime class, and planned artifact relationship match exactly.
2. The semantic-currentness classifier reports `current-pass`.
3. Exactly one current evidence-eligible signature has the required role and
   scope.
4. Its required earlier objective is already counted and the receipt names
   the applicable phase receipt as an input parent.

The role and scope requirements are:

| Objective | Role | Scope |
| --- | --- | --- |
| Qualification | `local-recorder` | `receipt-recording` |
| Clean browser round | `local-recorder` | `receipt-recording` |
| Live memory continuity | `local-recorder` | `receipt-recording` |
| Outside P2P proof | `outside-network-observer` | `outside-proof` |
| Catalog announcement | `p2p-publisher` | `p2p-publication` |

A browser round additionally requires its counted model qualification. A
memory round requires its counted designated browser round and the exact
memory-contract hash. A catalog announcement requires its counted model
qualification and both counted outside proofs for that model.

An outside proof counts only when it matches the planned model, artifact,
lane, and process; reports the required outside-network scope; uses HTTPS;
proves the complete artifact hash; has the fixed allowed route set; is
unexpired at the trusted verification time; and has exactly one current
observer signature. Multiple current candidates for a lane create a conflict
and none counts.

Unsigned, expired, stale, superseded, conflicted, failed, rejected, blocked,
or unplanned evidence never increments a counter. The result retains bounded
IDs and blocker codes so an operator can distinguish absent evidence from
authority, currentness, signature, plan, and prerequisite defects.

## Projection Result

The canonical result includes:

- current and target values for 20/50/25/40/20;
- plan ID, plan SHA-256, profile ID, and profile SHA-256;
- authority availability and terminal registry identity;
- phase-state counts and conflicting operation identities;
- unsigned and unplanned current objective receipt IDs;
- conflicting signature subjects and P2P lanes;
- exact counted receipt, proof, and signature IDs;
- sorted blocker codes;
- the first incomplete operation in fixed phase order; and
- `blocked`, `resumable`, or `complete` state.

`complete=true` is possible only when every exact target is reached and no
blocker remains. Transport ordering of receipt and subject arrays cannot
change result bytes. Returned data is deeply frozen and returned bytes are
defensive copies.

Before persistence, a projection result is independently reread through
`validateCampaignProjectionResultBytes`. The validator binds its exact plan,
profile, targets, counts, evidence-ID cardinalities, phase totals, blocker
conditions, and operation state. See
`docs/architecture/vnext-campaign-artifact-persistence.md` for the create-only
layout, interruption behavior, and restart algorithm.

## Capacity Closure

The same checkpoint aligns all capacities needed by a complete campaign:

- signature authority accepts at most 1,024 signature envelopes;
- an offline manifest may designate at most 512 target signatures;
- its typed signature-envelope category accepts at most 1,024 IDs; and
- a receipt may name at most 2,048 input receipt parents, matching the offline
  manifest receipt limit.

The test suite materializes a complete synthetic schedule with 115 objective
phase receipts, 155 role-correct signatures, one authority registry, and 40
outside-proof subjects. The resulting 271-receipt bundle is packaged and
verified offline with all 155 targets current. This proves capacity and
algorithmic closure only. Fixture keys, fixture companies, fixture browser
facts, and fixture endpoints do not satisfy any live campaign objective.

## Remaining Work

- Reproduce semantic currentness, authority, truthful projection, and their
  hostile corpus in independent Rust implementations.
- Preserve the completed generated browser WASM plan boundary and its exact
  browser/Node/Rust byte parity; do not duplicate plan semantics in handwritten
  browser JavaScript. See
  `docs/architecture/vnext-campaign-plan-wasm-boundary.md`.
- Bind the projection result into final attestation, release authorization,
  rendered operator status, maintained documentation, and public readback.
- Replace fixture objective evidence only with authorized raw production
  receipts as each real phase becomes available.

All campaign counters remain 0/20, 0/50, 0/25, 0/40, and 0/20 after this
checkpoint.
