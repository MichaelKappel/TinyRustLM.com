# ADR-010: Evidence Signing

## Status

Accepted as the target architecture. Canonical receipt hashing, selected
Ed25519 verification, and bounded duplicate-aware parsing of the three raw
release-authorization inputs exist locally; the complete canonicalization,
role, rotation, revocation, and offline-verification profile is not yet
promoted.

## Decision Date

2026-08-08

## Scope

This ADR defines canonical receipt encoding, SHA-256 identity, local
attestation, outside-observer signatures, release authorization signatures,
key ownership, rotation, revocation, and offline verification.

## Decision

Identity-bearing receipt and signature payloads use a strict RFC 8785 JSON
Canonicalization Scheme (JCS) profile encoded as UTF-8. Input is parsed by a
bounded duplicate-detecting parser before construction. It rejects invalid
UTF-8, BOM, duplicate keys, lone surrogates, non-finite numbers, unsafe
integers, negative zero, unbounded strings/arrays/objects/depth, unknown
fields, and parser coercion. Identity-bearing counts and measurements use safe
integers or exact unit-labelled decimal strings; binary values use canonical
base64 and hashes use lowercase hexadecimal.

The current JavaScript sorted-key canonicalizer is retained only after it
passes the RFC 8785 conformance corpus and all signed raw-JSON entry points add
duplicate detection. JSON.parse alone is not an acceptable verifier boundary.

A finalized receipt has an unsigned content object with a closed schema. The
receipt identity is:

```text
digest = SHA-256(
  UTF8("tinyrustlm.receipt.content.v1") || 0x00 || JCS(content)
)
receipt_id = "sha256:" || lowercase_hex(digest)
canonical_content_hash = lowercase_hex(digest)
```

`receipt_id`, `canonical_content_hash`, and signatures are outside `content`
and cannot create a self-reference. Signature envelopes are separate immutable
receipts that bind the content receipt ID, schema, role, campaign/release
scope, signer and key IDs, issue/expiry times, nonce, authority-registry hash,
and exact signed-payload SHA-256. Adding or rotating a signature never mutates
the evidence receipt.

SHA-256 is the sole canonical receipt and release-graph identity. Ed25519 is
the sole initial signature algorithm. The signed bytes are a role-specific,
domain-separated JCS payload, not an arbitrary serialized file and not a bare
digest without context.

Three authority classes remain separate:

1. **local recorder**: writes content-addressed receipts. A local signature may
   provide tamper evidence or host attribution but never elevates fixture or
   local evidence to live, outside-network, physical-hardware, or release
   proof;
2. **outside-network observer**: signs expiring complete-transfer proof for an
   exact lane, endpoint, nonce, piece set, artifact, implementation, and
   observation time;
3. **release authorizer**: signs the exact final release predicate only after
   all required campaign gates pass and an authorized publication decision is
   made.

P2P publisher/catalog signing, when enabled, uses another explicit role and
key. Keys are never reused across roles, environments, companies, or observer
operators. Private keys remain in their owning OS keystore, HSM, external
signer, or other authorized boundary; project source, browser storage,
receipts, logs, prompts, and model artifacts never contain them. TinyRustLM
verifiers accept public keys and signed envelopes but do not silently create
production signing keys.

Authority registries are immutable, SHA-256-identified, bounded, and valid for
an explicit interval. A successor registry identifies active, retired, and
revoked keys and the prior registry hash. Rotation uses a bounded overlap only
where operationally required. New signatures use the successor key after its
effective time; old signatures remain independently verifiable against the
registry and revocation state applicable to their observation time.

Revocation is an append-only signed statement with authority, key, role,
effective time, reason code, scope, predecessor registry, and replacement when
known. A compromise time invalidates signatures at or after that time. If the
earliest compromise time cannot be established, all claims depending solely
on that key become stale and require fresh evidence. Revocation never deletes
the historical receipt; dashboards and catalogs stop treating it as current.

An offline verification bundle contains the exact receipt content, signature
envelope, schema identities, canonicalization profile, authority registry
chain, applicable revocations, public keys, and SHA-256 manifest. The verifier
reconstructs canonical bytes, identities, role and scope, validity intervals,
registry chain, revocation decision, and signature without network access. It
reports cryptographic validity separately from evidence class, freshness,
authorization, quality, license, and campaign completeness.

## Alternatives

- **Pretty-printed JSON bytes as the signed payload** were rejected because
  whitespace and key order are not semantic identity.
- **Custom sorted JSON without a conformance profile** was rejected as the
  final contract because parser and number differences can split identity.
- **CBOR receipts** were rejected for the initial evidence ecosystem because
  JSON is easier to inspect and integrate with release/catalog tooling; SLM2
  metadata remains a separate restricted-CBOR decision.
- **Sign every receipt with one project key** was rejected because it conflates
  recording, observation, publication, and authorization.
- **Embedded self-signed public keys** were rejected because a signature does
  not establish who owns or authorizes the key.
- **Overwrite evidence after key revocation** was rejected because history and
  deletion lineage must remain auditable.

## Authoritative Evidence

- **Observed local fact**: CampaignEvidenceStore canonicalizes closed receipt
  objects, derives SHA-256 receipt IDs, writes immutable files, rebuilds the
  DAG, and quarantines invalid records.
- **Observed local fact**: `tinyrustlm/tools/strict-json.js` consumes bounded
  bytes with fatal UTF-8 decoding and rejects BOMs, decoded duplicate member
  names, lone surrogates, excessive depth/count/string sizes, unsafe integers,
  negative zero, numeric overflow/underflow, malformed grammar, and trailing
  data.
- **Observed local fact**: release authorization parses the unsigned final
  attestation, authority registry, and signed authorization envelope through
  that strict parser before schema or Ed25519 verification; its verifier tool
  hash binds both source modules and its receipt identifies strict-JSON profile
  `tinyrustlm.strict-json.v1`.
- **Observed local fact**: `tinyrustlm/tests/strict-json.test.js` and the release
  authorization integration suite include literal, escaped-equivalent, and
  supplementary-plane duplicate names plus malformed byte and resource-bound
  vectors.
- **Sourced public fact**: RFC 8785 specifies JCS canonical JSON at
  https://www.rfc-editor.org/rfc/rfc8785.
- **Sourced public fact**: Ed25519 is specified by RFC 8032 at
  https://www.rfc-editor.org/rfc/rfc8032.
- **Engineering decision**: role-separated envelopes prevent a valid local
  signature from being mistaken for independent or publication authority.
- **Local verification required**: every implementation language and browser
  must pass shared canonicalization, signature, registry, and revocation
  vectors before signed claims are promoted.

## Threat Analysis

Threats include duplicate-key ambiguity, Unicode or number divergence,
signature wrapping, algorithm confusion, role confusion, key substitution,
replay, nonce reuse, clock manipulation, expired proof, compromised keys,
registry rollback, partial offline bundles, secret leakage, and a valid
signature being misrepresented as model quality or external observation.

Closed schemas, duplicate-detecting parsing, domain separation, exact role and
scope, canonical base64, key/registry hashes, bounded lifetimes, unique nonces,
trusted-time policy, append-only revocation, secret scans, and typed evidence
classes address these threats. Verification fails closed on unknown critical
fields, algorithms, roles, registries, or revocation state.

## Performance Evidence

Receipts are bounded to 256 KiB by default; larger evidence is referenced by
hash rather than embedded. Benchmarks measure parse, canonicalization, SHA-256,
signature verification, registry/revocation reconstruction, DAG rebuild, and
offline-bundle verification at maximum allowed sizes. Large artifacts are
stream-hashed and never loaded merely to sign a receipt.

No throughput claim exists until native Rust, Node, browser WASM/JavaScript,
and package consumers reproduce canonical bytes and verification results.
The current strict-parser tests establish bounded functional behavior, not a
maximum-size latency or memory claim.

## Compatibility Impact

The vNext evidence profile is incompatible with ambiguous current receipt
encodings. There is no dual verifier or legacy canonicalization fallback in
the production campaign. Existing receipts remain historical artifacts but do
not satisfy vNext gates; required phases are rerun to issue vNext descendants.

Only Ed25519 is accepted initially. A future algorithm requires a new ADR,
explicit algorithm/profile identity, independent vectors, and no implicit
downgrade.

## Clean Deletion Impact

After vNext receipt validation passes, delete parsers that accept duplicate
keys, permissive unknown fields, unconstrained numbers, embedded signature
objects, shared-role keys, or unsigned claim elevation. Remove superseded
schemas and test fixtures from shipping paths while preserving immutable
historical evidence outside the active DAG.

## Unknowns

- Production key custody and authorized signing service for each role.
- Trusted-time source and maximum skew for offline observers.
- Registry publication and revocation distribution authority.
- Whether enterprise deployments require an additional FIPS-approved
  signature profile rather than Ed25519.
- Final public retention policy for expired and revoked signature bundles.
- Independent Rust/browser JCS implementation choice and audit results.

## Acceptance Tests

1. Official RFC 8785 vectors and shared Rust/Node/browser vectors produce
   identical UTF-8 bytes and SHA-256 identities.
2. Duplicate keys, invalid UTF-8, lone surrogates, unsafe numbers, negative
   zero, noncanonical base64, unknown fields, excessive depth/count/bytes, and
   trailing data fail before signature verification.
3. Ed25519 positive and negative vectors pass across every implementation;
   bit flips in payload, role, scope, key, registry, time, nonce, or signature
   fail.
4. Replays, duplicate nonces, expired envelopes, registry rollback, wrong
   role, revoked keys, unknown compromise time, and cross-campaign signatures
   cannot produce current evidence.
5. Local recorder signatures never satisfy outside-network, physical-target,
   live-memory, catalog-publication, or release-authorization gates.
6. Offline bundles verify without network access and fail on any missing,
   extra, stale, or hash-mismatched member.
7. Synthetic secrets, private keys, credentials, private paths, prompts,
   hosted memory, and model bytes are rejected or redacted before finalization.
8. Independent validators reconstruct the receipt DAG and final release
   predicate from immutable descendants without overwriting history.

## Rollback

Keep signed public claims disabled until the complete profile passes. If a
promoted verifier or key is defective, mark dependent claims stale, publish an
authorized revocation and corrected registry, preserve all affected evidence,
and collect fresh signatures. Do not reinterpret old bytes with a new
canonicalizer or silently map an unsupported algorithm or role.
