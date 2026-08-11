# vNext Rust Semantic-Currentness Parity

## Status And Non-Claims

`rust/crates/tinyrustlm-evidence` independently implements the exact frozen
vNext semantic-currentness classifier. It consumes immutable canonical receipt
bytes supplied by its caller and produces the same canonical result bytes,
raw-byte SHA-256, or stable rejection code as the Node authority.

This classifier is now consumed by the independent Rust authority/projection
stack, generated browser WASM boundary, sole exact campaign runner, and
release-manifest preparation surface. Those integrations are not model
qualification, MemoryEndpoints continuity, outside-network P2P proof, catalog
publication, deployment, or release authorization. They change no campaign
counter. Status remains 0/20 qualified model hashes, 0/50 deletion-backed
browser rounds, 0/25 authorized live memory rounds, 0/40 outside-network lane
proofs, and 0/20 live catalog announcements.

## Frozen Inputs

The implementation is bound to:

- profile `tinyrustlm.vnext.phase-invalidation.v1`;
- profile SHA-256
  `924c515b2cddc081c9cbeac7e4c51fde213264ef2dff5bffcbc335430aafcbff`;
- result schema `tinyrustlm.vnext.phase_invalidation_result.v1`;
- receipt schema `tinyrustlm.vnext.receipt.v1`; and
- vector corpus `contracts/vnext/phase-invalidation-rust-vectors.v1.json`.

The vector corpus is 74,756 bytes with SHA-256
`c583f55f0c81da4db08543b0a8e28ad4ee178a1a1a1169b6aeb3329bf67f7ee4`.
Its Node generator is deterministic, offline, and checked for compatibility
terms and network APIs. Regeneration must reproduce every byte before a
checkpoint can be accepted.

## Public Rust Boundary

`classify_phase_receipts(campaign_id, receipt_bytes)` accepts one safe campaign
ID and a borrowed slice of owned receipt byte buffers. It returns
`FinalizedPhaseInvalidation`, which owns immutable canonical result bytes and
the lowercase SHA-256 of those exact bytes. A failure returns
`PhaseInvalidationError`; callers may use only its bounded `code()` value as a
machine contract.

The operation performs no filesystem discovery or mutation, environment
lookup, network request, process launch, retry, clock lookup, random choice, or
best-result selection. It compiles for native targets and
`wasm32-unknown-unknown`. The crate forbids unsafe Rust.

## Receipt Admission

Before graph construction, each input must be the complete canonical wire of
one current vNext receipt. The Rust parser uses closed typed structures and
rejects:

- missing required members, including required members whose value may be
  null;
- unknown or duplicate members at every represented structure;
- unsupported schema, receipt type, phase, status, or security-record shape;
- malformed or unsorted identities, hashes, tools, parents, and public
  parameters;
- malformed UTC instants or impossible calendar dates;
- non-HTTPS, private, local, credential-bearing, query-bearing, fragment-bearing,
  traversal-bearing, or noncanonical public URLs;
- invalid canonical base64, bounds, and cross-field status/error invariants;
- noncanonical JSON whitespace, member order, escaping, or trailing bytes;
- incorrect `receiptId` or `canonicalContentSha256`; and
- any receipt over 262,144 bytes.

Canonical receipt identity excludes only the two self-referential identity
members and binds every other member through domain
`tinyrustlm.receipt.content.v1`. Parsing successfully is therefore not enough;
the incoming wire and both identities must be exact.

## Currentness Algorithm

The classifier enforces the frozen limits of 2,048 receipts, 67,108,864 total
receipt bytes, 32,768 graph edges, 64 operation heads, and 4,194,304 result
bytes. It then:

1. validates one campaign and globally unique receipt identities;
2. derives the domain-separated operation identity from campaign, receipt
   type, phase, `operation_id`, and `subject_id`;
3. derives the material identity from operation identity plus exact material
   inputs, tools, configuration, source revision, and runtime;
4. validates dependency and supersession parents;
5. rejects cross-operation supersession and dependency/supersession overlap;
6. proves the dependency, supersession, and combined graphs are acyclic;
7. marks explicit supersession targets as immutable historical receipts;
8. identifies unique or conflicting unsuperseded operation heads;
9. propagates stale state only through material dependencies; and
10. serializes the exact sorted result and domain-separated receipt-set
    identity.

No timestamp, insertion order, attempt label, output value, or receipt hash
implicitly wins. Multiple unresolved heads remain a visible invalid conflict
until a later receipt explicitly supersedes them under the same operation
identity.

## Cross-Language Evidence

Four accepted vector histories cover baseline acquisition-to-qualification,
successful evaluator replacement with resumed qualification, a failed
replacement whose descendants cannot remain pass-eligible, and unresolved
heads. Rust must match the exact Node result bytes and result SHA-256 for every
case.

Nine rejection vectors cover empty input, duplicate receipt identity, missing
dependency parent, cross-operation supersession, dependency/supersession
overlap, missing phase parameters, unsupported receipt type, noncanonical
receipt wire, and campaign mismatch. Rust must reject each with the exact Node
error code.

Additional Rust unit tests attack receipt-field completeness, unknown and
duplicate members, safe-ID grammar, timestamp grammar and calendar validity,
public URL restrictions, security payload/type agreement, canonical wire and
identity drift, combined graph cycles, campaign mismatch, and resource limits.

## Integration Boundary

The classifier establishes semantic currentness, not signature eligibility.
The sole exact campaign runner requires both this result and the independent
Rust authority result before projecting objective counts. Stored projection
snapshots remain immutable historical views; every new runner operation
recomputes them from the complete bounded current receipt and subject stores.
The release surface consumes only a fresh runner return created inside the
same call.

The generated campaign-evidence WASM interface now exposes this Rust API as
bounded byte transport and replays the same vector corpus in independent
deleted browser profiles without reimplementing currentness in JavaScript. See
`docs/architecture/vnext-campaign-evidence-wasm-boundary.md`.

## Remaining Work

- Preserve independent Rust Ed25519, authority-graph, offline-bundle, and
  truthful-projection parity.
- Preserve the generated campaign-evidence browser ABI and its exact
  currentness corpus replay without handwritten semantic logic.
- Preserve the implemented acyclic release-authorizer and site-publisher
  verification over the prepared immutable manifest, exact deployment/readback
  graph, published-claim descendants, and final publication receipt.
- Preserve the completed incompatible release cutover and its negative
  conformance gate; no second reader, writer, alias, or mutable status path may
  return.
- Replace fixtures only with authorized objective evidence; never reinterpret
  a fixture as a live result.
