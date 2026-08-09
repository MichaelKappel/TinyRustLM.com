# vNext Rust Ed25519 Primitive Parity

## Status And Non-Claims

`rust/crates/tinyrustlm-evidence` independently derives and verifies the exact
frozen vNext Ed25519 signature primitive. It accepts immutable canonical
signature-envelope bytes plus one canonical raw public key and produces the
same signing material, canonical verification result, SHA-256 identities, or
stable rejection code as the Node reference implementation.

This checkpoint is primitive parity only. It is not authority-graph parity,
registry succession, revocation or compromise evaluation, nonce-replay state,
offline-bundle closure, trusted-time custody, production key custody, release
authorization, or campaign evidence. It changes no campaign counter. Status
remains 0/20 qualified model hashes, 0/50 deletion-backed browser rounds, 0/25
authorized live memory rounds, 0/40 outside-network lane proofs, and 0/20 live
catalog announcements.

## Frozen Inputs

The implementation is bound to:

- profile `tinyrustlm.vnext.ed25519-authority.v1`;
- profile SHA-256
  `9d1f0c65f91dc9b76bf5e430ee5f91ba787ab4622d72aae3c73c3a50c9f2a8b9`;
- envelope schema `tinyrustlm.vnext.receipt.v1` with
  `receiptType=signature-envelope`; and
- vector corpus `contracts/vnext/receipt-signature-rust-vectors.v1.json`.

The vector corpus is 27,988 bytes with SHA-256
`679147d928357a74a976e21b0c5f3f3b5f364b2310c39bc34b99263d670c8a1d`.
It contains one accepted public vector and 17 hostile rejections. Its
deterministic offline generator contains no private key, network access, key
generation, clock lookup, or filesystem mutation beyond an explicit
maintainer-requested vector write.

## Public Rust Boundary

`derive_signature_material(envelope_bytes)` accepts one complete canonical
signature-envelope wire and returns owned immutable payload bytes, payload
SHA-256, domain-separated signing bytes, and signing-byte SHA-256.

`verify_signature_primitive(envelope_bytes, public_key_base64)` additionally
accepts one canonical base64 encoding of an exact 32-byte raw Ed25519 public
key. It performs strict Ed25519 verification and returns owned immutable
canonical result bytes plus the SHA-256 of those exact bytes.

Failures return `SignatureError`. Callers may rely only on its bounded `code()`
value as the machine contract. Neither function discovers files, keys,
registries, subjects, time, or network state. Both compile for native targets
and `wasm32-unknown-unknown`; the crate forbids unsafe Rust.

## Canonical Payload And Signing Bytes

The incoming envelope must already be the exact canonical JSON wire accepted
by the frozen receipt shape. The parser rejects missing, unknown, duplicate,
reordered, reformatted, trailing, or otherwise noncanonical bytes before
signature semantics are evaluated.

The signed payload contains exactly these 14 fields:

- `algorithm`;
- `authorityRegistryReceiptId`;
- `campaignId`;
- `expiresAtUtc`;
- `issuedAtUtc`;
- `keyId`;
- `nonceHash`;
- `releaseId`;
- `role`;
- `scope`;
- `signatureDomain`;
- `signedSchema`;
- `signedSubjectId`; and
- `signerId`.

The signature and declared payload hash are excluded. The payload is serialized
through the same UTF-16-key-order canonical JSON profile used by the Node
authority. Signing bytes are exactly:

`UTF8(signatureDomain) || 0x00 || canonicalPayloadBytes`

`signedPayloadSha256` binds the SHA-256 of those complete signing bytes, not
the payload-only hash. Signature verification uses `ed25519-dalek` strict
verification against the complete signing bytes.

## Primitive Validation

Before cryptographic verification, Rust independently enforces the frozen
primitive invariants in Node order:

1. algorithm is exactly `ed25519`;
2. role and signature domain are the one registered pair;
3. scope is registered for that role;
4. signer, key, and campaign identifiers use the safe-ID grammar;
5. authority registry, subject, and optional release IDs are content IDs;
6. signed schema is one of the seven identity-bearing vNext schemas;
7. nonce and declared payload hashes are lowercase SHA-256 values;
8. issue and optional expiry instants are exact UTC values;
9. every non-local signature expires, lifetimes are positive and bounded, and
   outside proofs use the stricter one-day maximum; and
10. signature and public-key encodings are canonical and have exact lengths.

The verifier then checks the declared signing-byte hash, parses the raw public
key, verifies the signature strictly, and canonicalizes the successful result.
Validation order is part of parity because one hostile input can violate more
than one invariant and must still produce the same stable code in both
languages.

## Cross-Language Evidence

The accepted vector freezes exact envelope bytes, raw public key, payload
bytes, payload hash, signing bytes, signing-byte hash, verification-result
bytes, and result hash. Rust must match every byte and hash.

The 17 rejection vectors cover signed-subject drift, public-key and signature
bit flips, role/domain mismatch, invalid scope, missing expiry, excessive
lifetime, malformed signature base64, unknown and missing envelope fields,
invalid algorithm, unsupported schema, malformed identifiers and content IDs,
malformed hashes and dates, and malformed public-key base64. Rust must return
the exact Node rejection code for every case.

The checked-in corpus contains public material only. Runtime tests do not need
a private key and do not contact a signer or public service.

## Security Boundary

Cryptographic validity does not establish authority. This primitive does not
decide whether a public key belongs to a trusted registry, whether the registry
is the caller-pinned current terminal, whether a key was active at issue,
whether compromise or revocation invalidates current admission, whether a
nonce was reused, whether a subject was correctly linked, or whether supplied
bundle membership is closed.

Those decisions remain owned by the graph authority and offline-bundle
verifiers. Those layers now have independent Rust parity, but a production
caller must still compose their results with semantic currentness and truthful
projection before any evidence can be counted.

## Remaining Work

- Maintain the frozen public-only authority-graph corpus and independent Rust
  result-byte and rejection-code parity documented in
  `docs/architecture/vnext-rust-authority-graph-parity.md`.
- Maintain the frozen public-only offline-bundle corpus and independent Rust
  result-byte and rejection-code parity documented in
  `docs/architecture/vnext-rust-offline-bundle-parity.md`.
- Preserve Rust truthful campaign projection over exact plan, currentness, and
  authority inputs; offline-bundle closure remains a separate decision.
- Preserve the generated campaign-evidence browser byte-transport interface
  without handwritten JavaScript semantics.
- Integrate bounded evidence inputs and final attestations into the production
  runner and release gate.
