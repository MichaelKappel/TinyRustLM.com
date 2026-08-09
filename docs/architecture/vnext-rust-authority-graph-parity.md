# vNext Rust Authority-Graph Parity

## Status And Non-Claims

`rust/crates/tinyrustlm-evidence` independently verifies the complete frozen
vNext Ed25519 authority graph from bounded canonical receipt and subject
bytes. The Rust result bytes, result SHA-256, and stable rejection codes match
the Node reference implementation for every frozen cross-language case.

This checkpoint establishes graph-verifier parity only. It is not an offline
bundle membership or closure proof, trusted production time, production key
custody, outside-observer independence, release authorization, truthful
campaign projection, or live campaign evidence. It changes no campaign
counter. Status remains 0/20 qualified model hashes, 0/50 deletion-backed
browser rounds, 0/25 authorized live MemoryEndpoints rounds, 0/40
outside-network lane proofs, and 0/20 live catalog announcements.

## Frozen Inputs

The implementation is bound to:

- profile `tinyrustlm.vnext.ed25519-authority.v1`;
- profile SHA-256
  `c9f3c6813e3880ebff6c79d9975ba085405208260715b0c68eafdfb9cfcb5721`;
- contract registry SHA-256
  `dd1534f577f5468f94d4b3b4d7d8985751fd1ddc4a28a2ccee9f47462449bbf0`;
- public seed `contracts/vnext/authority-graph-public-seed.v1.json`; and
- generated corpus
  `contracts/vnext/authority-graph-rust-vectors.v1.json`.

The public seed is 171,656 bytes with SHA-256
`80eb5d068bee339b5562c5cbd16c6f546e430895d6c6fb4c1172a36b4786197e`.
It contains seven accepted graphs and six cryptographically valid hostile
graphs. The generated corpus is 434,761 bytes with SHA-256
`7340f17c34b2f86dcd4c2431d1de7ed8d36429badd51866c8abbff3b0f0fa89a`.
It expands those public inputs to nine accepted graphs and 26 rejection
graphs. Neither file contains private-key material.

The deterministic generator reads the public seed and frozen profile only.
It performs no signing, key generation, network access, clock lookup, or
secret retrieval. Regeneration must reproduce the exact checked-in corpus
bytes.

## Public Rust Boundary

`verify_authority_graph` accepts:

- exact campaign and environment scope;
- an explicit verification instant;
- one out-of-band trusted-root registry receipt ID;
- one out-of-band expected-terminal registry receipt ID;
- bounded canonical receipt wires; and
- bounded canonical non-receipt subject wires.

It returns `VerifiedAuthorityGraph`, which owns immutable canonical result
bytes and their lowercase SHA-256. Failures return `AuthorityError`; callers
may depend only on its bounded `code()` value. The function performs no file,
network, key, clock, migration, fallback, or alias discovery.

## Strict Subject Boundary

Rust independently validates every non-receipt identity family that the
frozen signature profile permits:

- artifact manifest;
- claim;
- context;
- outside proof;
- P2P manifest; and
- release manifest.

The verifier binds the exact frozen registry bytes, interprets only its closed
descriptor vocabulary, rejects unknown or missing fields, enforces collection
limits and sorted uniqueness, applies each local semantic invariant, requires
canonical JSON bytes, and recomputes the domain-separated content identity.
The artifact manifest deliberately keeps artifact byte identity distinct from
manifest canonical identity.

The six families are replayed from the frozen contract corpus. Additional
tests reject noncanonical wires, unknown and missing fields, and identity
tampering. Receipt subjects remain owned by the stricter typed receipt parser
and cannot enter through the non-receipt collection.

## Authority Reconstruction

Rust evaluates the graph in the same fail-closed order as Node:

1. validate bounded inputs, canonical receipts, canonical subjects, campaign
   scope, and unique identities;
2. resolve the caller-pinned root and terminal registries;
3. reject forks, cycles, missing predecessors, unlinked registries, rollback,
   validity gaps, environment drift, and excessive clock skew;
4. require exactly one predecessor-authorized signature for each registry
   successor;
5. enforce immutable key material, monotonic validity, allowed status
   transitions, and active introduction of new keys;
6. require one exact predecessor/successor revocation receipt and one
   predecessor-authorized revocation signature for every newly revoked key;
7. bind every signature receipt to its registry and subject inputs and contain
   its issue time within the receipt interval;
8. enforce schema, scope, signer, role, key, registry, outside-proof, and
   governance-time semantics;
9. invoke strict Ed25519 primitive verification on the canonical envelope;
10. reject replay of the campaign/key/nonce/role/scope/signer tuple across
    distinct signature receipts; and
11. separate historical cryptographic validity, authority at issue, temporal
    currentness, and current-evidence eligibility.

Registry transport order does not affect a successful result. Signature
results are sorted by immutable signature-receipt ID, and stale reasons are
unique and sorted before canonical serialization.

## Cross-Language Evidence

The nine accepted cases cover a current root, current successor, expired
signature, retired key, revocation after issue, compromise at issue, unknown
compromise time, reversed transport order, and stale terminal registry. Rust
must reproduce every complete Node result byte and hash.

The 26 rejection cases cover empty and duplicate input, campaign and
environment drift, missing root and terminal pins, a non-root trust pin,
forks, rollback, gaps, unlinked registries, missing or duplicate governance,
invalid governance signatures, key substitution, missing revocation evidence,
missing revocation signatures, stale-registry signing, absent subjects,
missing registry bindings, issue-time violations, signer and role mismatch,
outside-proof binding drift, and nonce replay. Rust must return the exact Node
code for each case.

## Result Meaning

`authorityGraphVerified=true` means only that the supplied bounded graph was
successfully reconstructed and verified under the frozen profile. Each
signature separately reports:

- `signatureVerified` for strict cryptographic verification;
- `authorityAtIssue` for compromise and revocation history at issue;
- `temporalCurrent` for envelope and terminal-registry time;
- `currentEvidenceEligible` only when every authority and freshness condition
  is satisfied; and
- deterministic `staleReasons` when current admission is false.

A caller must select the relevant signature and still require exact bundle
closure, semantic phase currentness, redaction, quality, release, and live
external gates. A true graph result is never a campaign-level `passed` field.

## Remaining Work

- Preserve the completed independent Rust offline-bundle manifest, membership,
  parent-closure, linked-subject, authority, and target-current parity
  documented in
  `docs/architecture/vnext-rust-offline-bundle-parity.md`.
- Preserve the completed Rust truthful projection over exact plan,
  currentness, receipt, subject, and authority inputs; offline-bundle closure
  remains separate.
- Preserve the generated campaign-evidence browser byte-transport interface
  without handwritten JavaScript semantics.
- Integrate bounded evidence inputs, final attestations, publication
  authorization, and production readback into the campaign runner.
- Execute authorized external tests before changing any live campaign count.
