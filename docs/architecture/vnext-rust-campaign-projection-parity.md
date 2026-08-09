# vNext Rust Campaign-Projection Parity

Status: implemented and cross-language test-bound on 2026-08-09.

This checkpoint independently projects current vNext campaign evidence in
`tinyrustlm-evidence`. Rust consumes only caller-supplied canonical plan,
receipt, and subject bytes plus explicit campaign, environment, trust, and
verification-time pins. It performs no filesystem discovery, network access,
clock lookup, process launch, key generation, signing, retry, evidence repair,
or source mutation.

The Rust result bytes, SHA-256, and public-safe rejection codes match the
current Node projection contract. This is an implementation-parity statement,
not live campaign evidence or release authorization.

## Frozen Inputs

The implementation binds:

- profile `tinyrustlm.vnext.campaign-projection.v1`;
- profile SHA-256
  `a5dbe87a6971301c782120d3b30bb6059ab9cb26f2efac70b866a7bdb0b52067`;
- result schema `tinyrustlm.vnext.campaign_projection_result.v1`;
- immutable public seed
  `contracts/vnext/campaign-projection-public-seed.v1.json`, 1,024,171 bytes,
  SHA-256
  `1c908cd4238167c4b16bde0a65246c08f220b5a0d73937d31747344608c52234`;
- deterministic parity corpus
  `contracts/vnext/campaign-projection-rust-vectors.v1.json`, 1,494,464 bytes,
  SHA-256
  `974396d30525b6fc62e568de72361b99e87a99b6e33ead2e5cb43cfa002ec8a6`;
- 277 canonical public receipt wires and 41 canonical public subject wires;
  and
- the completed Rust campaign-plan, receipt, identity-subject,
  semantic-currentness, Ed25519, and authority-graph boundaries.

The seed was captured once from public-only fixtures with ephemeral signing
keys held only in generator memory. The checked-in generator reads the frozen
public seed and installed public profiles only. It cannot generate keys, sign
payloads, invoke a network client, or choose a new scenario after observing a
Rust result. Seed and vector tests reject private-key markers.

The offline-bundle verifier remains a separate closed-membership boundary. A
projection does not accept or trust an offline-bundle verdict. It independently
revalidates the exact plan, receipts, subjects, semantic currentness, and
authority graph supplied by its caller.

## Public Rust Boundary

`project_campaign(CampaignProjectionInput)` accepts:

- exact canonical campaign-plan bytes and their caller-pinned raw SHA-256;
- caller-pinned campaign and environment;
- either both trusted-root and expected-terminal authority receipt IDs or
  neither;
- bounded arrays of exact canonical receipt and non-receipt subject bytes; and
- one caller-supplied UTC verification time.

It returns `VerifiedCampaignProjection`, exposing immutable canonical result
bytes, a lowercase result SHA-256, and an independent owned byte copy.
`CampaignProjectionError::code()` exposes one bounded stable error code.

`validate_campaign_projection_result(result, plan)` independently validates a
stored or transported result against the exact plan. It does not accept a
caller-provided boolean or deserialize a result into a trusted dashboard state
without rechecking its internal relationships.

## Verification Order

Rust fails closed in the material Node order:

1. Validate input pins, optional trust-pin pairing, and UTC syntax.
2. Hash the exact plan bytes and compare the caller pin before parsing.
3. Validate the closed plan field set, plan identity, canonical bytes,
   campaign, and environment.
4. Enforce receipt and subject count and aggregate-byte limits before parsing
   members.
5. Validate every receipt and subject identity, reject duplicates across both
   collections, and reject mixed campaigns.
6. Classify only supported phase receipts through the Rust semantic-currentness
   graph; an empty phase set is an explicit healthy zero state.
7. If trust pins exist, verify the complete Rust authority graph over the same
   exact bytes and verification time. Authority failures remain failures.
8. Match each objective receipt to the exact planned operation, subject,
   parameters, hashes, runtime class, phase state, signature role, and scope.
9. Count objectives in dependency order and retain explicit blockers,
   conflicts, unsigned IDs, unplanned IDs, and the first incomplete operation.
10. Canonicalize one bounded result and compute its raw-byte SHA-256.

No response completion, retry selection, evidence mutation, best-of-N choice,
or dashboard-side count repair exists.

## Counting And Withdrawal

Qualification, browser, memory, and announcement receipts count only when the
receipt is an exact planned `current-pass` and has exactly one current
role-correct authority signature. Browser rounds additionally require their
counted qualification parent. Memory rounds require their designated counted
browser parent and exact memory-contract hash. Announcements require their
counted qualification parent and both current outside proofs for that model.

Outside proofs are identity-bearing subjects rather than phase receipts. A
proof counts only when artifact, complete-transfer hash, lane, process,
outside-network scope, normalized HTTPS root endpoint, fixed GET route set,
status, byte length, time window, and observer signature match exactly.
Multiple current candidates for one lane create a conflict and none counts.

Superseded, stale, conflicted, failed, rejected, blocked, expired, unsigned,
unplanned, dependency-incomplete, or multiply signed objective evidence does
not count. A later current failure withdraws a superseded pass; history remains
retained in receipts and phase-state totals.

## Result Validation

The independent result validator rejects:

- empty, oversized, malformed, noncanonical, or unknown-field wires;
- plan, profile, schema, campaign, environment, identity, or hash drift;
- invalid authority status or terminal identity;
- target, current-count, prerequisite, or evidence-cardinality drift;
- duplicate or unsorted counted IDs and signatures;
- inconsistent objective, signature, phase, or phase-state totals;
- malformed conflict, unsigned, unplanned, or blocker sets;
- blocker conditions that disagree with the result state;
- false completion or resumability; and
- an operation that is absent from the exact plan or inconsistent with
  completion and authority state.

Stored projection bytes are evidence snapshots, not mutable currentness
authority. Resume must reproject the current receipt and subject closure and
may compare or append a new immutable snapshot.

## Cross-Language Corpus

The parity corpus freezes:

- 11 accepted scenarios, including honest zero, authority-only, dependency
  order, reversed transport order, supersession withdrawal, unsigned and
  unplanned evidence, duplicate objective signatures, current and expired
  outside proof, and complete 20/50/25/40/20 capacity;
- 22 projection-input rejection scenarios covering pins, plan wires, counts,
  duplicates, mixed campaigns, malformed members, missing phase parents, and
  missing authority registries; and
- 8 projection-result rejection scenarios covering bytes, JSON, canonical
  form, fields, counts, blockers, operation, and plan binding.

Rust must emit the exact Node result bytes and SHA-256 for every accepted case
and the exact Node failure code for every rejection. The complete-capacity
fixture contains 115 objective receipts, 155 counted signatures, and 40 proof
subjects. It proves bounded algorithmic closure only.

## Authority And Release Limits

A Rust projection can truthfully report only what its supplied evidence proves.
It does not prove that fixture models are useful, browser profiles were really
deleted, MemoryEndpoints operations were authorized and live, P2P observers
were outside the host network, catalog announcements are public, packages
installed, physical RIDs executed, or sites deployed.

Live progress remains 0/20 qualified model hashes, 0/50 deletion-backed
clean-browser rounds, 0/25 authorized live MemoryEndpoints rounds, 0/40
outside-network lane proofs, and 0/20 catalog announcements.

## Deployment Boundary

This checkpoint changes contracts, Rust source, tests, and architecture
documentation only. It changes no production deployment-manifest member.
Publishing unchanged site bytes would create a false release, so this
checkpoint does not create a version increment, Updates entry, deployment
receipt, or public HTTPS readback claim.

## Remaining Work

- Cleanly replace the plan-only browser ABI with one generated campaign
  evidence boundary that transports plan, receipt, subject, pins, and result
  bytes while keeping projection semantics in Rust.
- Connect bounded create-only receipt and subject stores to one campaign
  runner, then persist and reproject the exact current result.
- Bind only that reprojected result into final attestation, release
  authorization, operator rendering, synchronized documentation, and public
  readback.
- Complete Rust/Win32 directory-flush evidence, archive-member scanning, and
  protected equality-list custody before production durability or release
  claims.
