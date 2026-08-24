# vNext Rust Offline-Bundle Parity

Status: implemented and cross-language test-bound on 2026-08-09.

This checkpoint independently verifies one complete vNext offline evidence
bundle in `tinyrustlm-evidence`. Rust consumes only caller-supplied canonical
manifest, verification-receipt, receipt-member, subject-member, trust-pin, and
verification-time inputs. It performs no filesystem, network, process,
environment, key generation, signing, clock lookup, retry, repair, or
authority discovery.

The Rust result bytes, result SHA-256, and public-safe rejection code match the
current Node verifier. This establishes exact closed membership and
current-target verification parity. The bundle verifier itself does not
produce a campaign projection, authorize release, publish a package or site,
or create live campaign evidence. Truthful projection is implemented as a
separate boundary documented in
`docs/architecture/vnext-rust-campaign-projection-parity.md`.

## Frozen Inputs

The implementation binds:

- profile `tinyrustlm.vnext.offline-bundle.v1`;
- profile bytes
  `contracts/vnext/offline-verification-bundle-profile.v1.json`;
- profile SHA-256
  `2b14f8e2d4d176e020d2c3e89d05dda07acc933bc76df6044ddd5b4e7d751756`;
- public authority seed
  `contracts/vnext/authority-graph-public-seed.v1.json`, 171,656 bytes,
  SHA-256
  `80eb5d068bee339b5562c5cbd16c6f546e430895d6c6fb4c1172a36b4786197e`;
- generated cross-language corpus
  `contracts/vnext/offline-bundle-rust-vectors.v1.json`, 668,506 bytes,
  SHA-256
  `3bfa7509169461a55e8d0b9fab6a624fe1049e3c956fd7d3308ef9bfa8cfff6c`;
- all eight exact profile bindings and all nine exact schema-descriptor
  hashes from contract family
  `tinyrustlm-vnext-2026-08-09-r5`; and
- the completed strict Rust receipt, identity-subject, Ed25519 primitive, and
  authority-graph implementations.

The vector generator reads only the frozen public seed and installed public
profiles. It generates no key, signs no payload, reads no host clock or
environment variable, and has no network client. The checked-in corpus
contains public keys and signatures but no private key material.

## Public Rust Boundary

`verify_offline_bundle(OfflineBundleVerificationInput)` accepts:

- exact manifest bytes and their caller-pinned SHA-256;
- exact canonical member receipt and non-receipt subject byte arrays;
- one separately finalized canonical
  `offline-verification-bundle` receipt;
- caller-pinned campaign and environment;
- caller-pinned trusted root and expected terminal registry receipt IDs; and
- caller-supplied verification time.

It returns `VerifiedOfflineBundle`, which exposes immutable canonical result
bytes, a lowercase result SHA-256, and an independent owned byte copy.
`OfflineBundleError::code()` exposes one bounded stable error code. The API
does not accept a directory, URL, current-pointer file, credential, private
key, or callback.

## Verification Order

Rust fails closed in the same material order as Node:

1. Validate caller values, UTC time, member counts, aggregate byte bounds, and
   verification-receipt size.
2. Parse one closed manifest shape, enforce the frozen profile and exact
   profile/schema binding arrays, validate sorted member metadata and totals,
   require canonical bytes, and compare the caller-pinned raw-byte SHA-256.
3. Compare manifest campaign, environment, root, and terminal values with the
   out-of-band pins, then reject creation after verification time.
4. Independently parse every canonical receipt and subject, recompute each
   content identity and raw-byte hash, reject duplicate or recursive members,
   and require exact manifest membership and metadata.
5. Verify the separate bundle receipt binds the exact manifest hash, schema
   hashes, category lists, complete parent list, and creation time.
6. Invoke the completed Rust authority graph over the same exact member
   bytes and caller pins. Authority errors remain authority errors rather than
   being converted into a bundle pass.
7. Require a current terminal registry and current-evidence eligibility for
   every declared non-governance target signature.
8. Reconstruct the required receipt closure through input, supersession,
   attestation, signing-registry, signed-receipt, registry-predecessor,
   revocation, and nested offline-bundle parent fields.
9. Reject a missing parent, missing signed subject, valid but unlinked receipt,
   or valid but unlinked subject.
10. Emit one canonical result that retains the complete authority result and
    exact counts and aggregate byte totals.

The verification receipt is intentionally outside the manifest. It is created
after manifest finalization and cannot recursively satisfy its own member
closure.

## Cross-Language Corpus

The generated corpus freezes three accepted bundles and 31 rejection cases.
Accepted coverage includes the ordinary root graph, manifest creation exactly
at verification time, and reversed transport ordering with identical
canonical meaning.

Rejected coverage includes:

- manifest hash, syntax, canonical-wire, profile, schema, metadata, total, and
  future-time drift;
- campaign, environment, root, and terminal pin substitution;
- missing, extra, duplicate, interrupted, recursive, and unlinked receipts;
- missing, extra, duplicate, interrupted, and unlinked subjects;
- verification-receipt manifest, category, parent, and wire drift;
- missing, governance-only, expired, or otherwise stale targets; and
- stale terminal authority state.

The Rust integration contract replays all 34 cases from the checked-in bytes.
Accepted results must be byte-identical to Node and rejected cases must return
the exact Node code. Separate Rust unit tests reject member-count excess,
oversized manifests, and oversized verification receipts before parsing those
payloads.

## Authority Limits

`offlineBundleVerified=true` means only that the supplied bundle was:

- canonical and hash-bound;
- exactly equal to its manifest;
- closed and free of surplus members;
- authority-valid under the caller's root, terminal, campaign, environment,
  and time pins; and
- current-evidence eligible for every declared target signature.

It does not establish semantic phase currentness across competing operation
histories, execute public-safe redaction with protected equality inputs,
select campaign objective evidence, produce a truthful campaign projection,
authorize release, prove browser execution, prove outside-network
independence, or prove publication.

Live progress remains 0/20 qualified model hashes, 0/50 deletion-backed
clean-browser rounds, 0/25 authorized live MemoryEndpoints rounds, 0/40
outside-network lane proofs, and 0/20 catalog announcements.

## Deployment Boundary

This checkpoint changes Rust source, public vectors, tests, and architecture
documentation only. It changes no production deployment-manifest member.
Publishing unchanged site bytes would create a false release, so this
checkpoint does not create a version increment, Updates entry, deployment
receipt, or public HTTPS readback claim.

## Remaining Work

- Preserve the completed byte-identical Rust truthful-projection boundary.
  Projection independently consumes exact plan, receipt, and subject bytes; it
  does not accept an offline-bundle verdict as trusted input.
- Preserve the sole generated browser currentness and projection execution
  boundary from Rust; do not add handwritten JavaScript semantics or a second
  ABI. See `docs/architecture/vnext-campaign-evidence-wasm-boundary.md`.
- The bounded stores, sole runner, final attestation, release authorization,
  operator projection, deployment/readback admission, and publication
  descendants are integrated. Preserve that clean cut and do not accept an
  offline-bundle verdict as mutable campaign truth.
- Preserve the integrated Rust/Win32 directory-flush client, bounded archive
  authority, and protected equality-custody handle. Production durability and
  package-release claims still require controlled physical power-loss
  evidence, current helper provenance/execution for every supported RID,
  authorized production custody, and OS isolation. One maintained structured
  archive target and frozen 29-seed hostile corpus replay locally; hosted
  sanitizer execution, longer campaigns, and retention/minimization of future
  crash findings remain open. Deterministic cross-format, path, every-prefix,
  and single-bit mutation properties pass locally.
- Execute the authorized real campaign and publication gates; no local bundle,
  parity corpus, or synthetic capacity fixture advances a live counter.
