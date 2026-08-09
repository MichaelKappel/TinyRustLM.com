# ADR-002: Hash and Merkle Profile

## Status

Accepted. SHA-256 artifact identity is implemented in existing paths; the
SLM2 Merkle profile remains pending and unpromoted.

## Decision Date

2026-08-08

## Scope

This ADR defines authoritative byte identity, fixed-size piece identity,
Merkle construction, and signature payload binding for SLM2 artifacts and
direct P2P transfer. It does not claim provenance, license, quality, or public
reachability from a hash.

## Decision

SHA-256 is the sole mandatory ecosystem identity hash for SLM2 model bytes,
pieces, canonical metadata, compositions, receipts, and release graph nodes.
The plain artifact identity is SHA-256 over the complete artifact bytes so it
remains independently reproducible by standard tools.

Large artifacts are read through bounded streaming buffers. The canonical P2P
piece size is 4 MiB. Every non-final piece is exactly 4 MiB; the final piece is
1 through 4 MiB. Empty model artifacts are invalid.

Each piece exposes the interoperable plain SHA-256 of its exact bytes. The
Merkle tree adds domain and position binding:

1. A leaf hashes the ASCII domain TinyRustLM-Merkle-Leaf-v1 followed by a zero
   byte, the little-endian u64 piece index, little-endian u64 piece length, and
   the 32-byte plain piece digest.
2. A binary parent hashes TinyRustLM-Merkle-Node-v1, a zero byte,
   little-endian u32 level, little-endian u64 parent index, left digest, and
   right digest.
3. An unpaired node is carried with the distinct
   TinyRustLM-Merkle-Carry-v1 domain, level, parent index, and child digest. It
   is never duplicated silently.
4. The published root hashes TinyRustLM-Merkle-Root-v1, a zero byte,
   little-endian u64 artifact length, little-endian u64 piece count, and the
   final tree digest.

The artifact record binds artifact length, piece size, piece count, ordered
piece digests, and Merkle root. Importers verify piece identity before durable
promotion and verify the complete plain artifact SHA-256 before activation.
Pieces from different complete identities are never mixed.

Concatenated structured identities use explicit ASCII domains, fixed-width
lengths, and fixed field order. Human-readable delimiter concatenation is not
identity-bearing.

BLAKE3, xxHash, CRC, and browser-specific digests are not authoritative.
BLAKE3 may be reconsidered as a non-authoritative local acceleration check
only through a later ADR with pinned native/WASM conformance evidence.

Ed25519 signatures sign a canonical envelope that contains the relevant
SHA-256 identities, role, schema, issue time, expiry where applicable, and
nonce. A signature is never treated as the artifact hash.

## Alternatives

- **BLAKE3 as primary identity** was rejected for vNext because current
  ecosystem receipts, WebCrypto, MiniModel metadata, release readback, and
  common enterprise tooling already converge on SHA-256.
- **Dual primary hashes** were rejected because they create disagreement and
  downgrade semantics.
- **Variable or content-defined pieces** were rejected for the first protocol
  because they complicate resumability, memory bounds, and independent
  verification.
- **Duplicate-last Merkle trees** were rejected because an odd-node rule must
  be explicit and domain separated.
- **Connection or manifest proof alone** was rejected because public P2P proof
  requires correct complete transfer.

## Authoritative Evidence

- **Observed local fact**: current acquisition, release, receipt, and campaign
  code use SHA-256 identities.
- **Observed local fact**: current model acquisition binds browser activation
  to exact artifact and composition SHA-256 values.
- **Sourced public fact**: FIPS 180-4 specifies SHA-256.
- **Sourced public fact**: FIPS 180-4 is
  https://csrc.nist.gov/pubs/fips/180-4/upd1/final.
- **Engineering decision**: one ecosystem identity is more valuable than a
  faster second authoritative digest.
- **Local verification required**: native, WASM, .NET, browser, and independent
  command-line implementations must produce identical piece and root vectors.

## Threat Analysis

Threats include length-extension misuse in ad hoc constructions, piece
reordering, odd-node ambiguity, mixed-artifact resumption, integer overflow,
TOCTOU mutation, hash-confusion fields, partial-file promotion, and treating a
digest as a quality or license claim.

Domain separation, fixed-width framing, explicit length/count binding, ordered
piece records, same-handle streaming where possible, staging ownership, and a
final whole-file digest address these threats. All size and count arithmetic
is checked before I/O or allocation. A changed file is quarantined rather than
resumed under an old journal.

## Performance Evidence

Existing SHA-256 paths demonstrate feasibility but do not establish SLM2
throughput. Promotion requires native, browser/WASM, .NET, and disk-bound
measurements for 1, 5, and 20 model inventories.

Report:

- bytes per second and CPU time for piece and full hashing;
- peak buffer and journal memory;
- startup revalidation cost;
- incremental resume cost;
- cold and warm filesystem behavior.

Hashing must stream with a fixed bounded buffer and must not create a second
full artifact copy.

## Compatibility Impact

All vNext identities use this exact profile. Existing raw SHA-256 artifact
identities may be reused only when they identify the exact same bytes, but old
piece journals, roots, or ambiguous concatenated IDs are not accepted.

There is no algorithm negotiation or downgrade in version 2.0.

## Clean Deletion Impact

At cutover, delete:

- alternate authoritative hash fields;
- implicit or unversioned Merkle builders;
- journals that do not bind full artifact identity and profile;
- resume paths that mix pieces before complete identity agreement;
- public language that equates hash validity with quality or provenance.

Historical receipts remain immutable but are not silently upgraded.

## Unknowns

- The 4 MiB piece size requires end-to-end measurement against browser,
  filesystem, P2P, and external-observer workloads.
- The exact signature envelope is finalized by ADR-010.
- Startup full-revalidation cadence requires capacity evidence for the final
  20-model store.

## Acceptance Tests

1. Publish golden vectors for empty-disallowed, one-piece, exact-boundary,
   boundary-plus-one, odd-count, and large streamed artifacts.
2. Native Rust, WASM, .NET, browser WebCrypto where used, and one independent
   implementation agree exactly.
3. Piece reorder, duplication, truncation, mutation, mixed identity, wrong
   length, wrong count, and wrong root fail closed.
4. Resume after interruption verifies existing pieces before reuse.
5. Final promotion requires the plain whole-file SHA-256.
6. Streaming tests prove bounded memory for multi-gigabyte files.
7. Public proof fixtures demonstrate complete reconstruction, not merely a
   route or first-piece response.

## Rollback

Before promotion, discard incompatible test artifacts and regenerate from
reviewed source after a revised ADR. After promotion, roll back the complete
release and its catalog announcements. Do not negotiate to an alternate hash
or accept old journals inside the same release.
