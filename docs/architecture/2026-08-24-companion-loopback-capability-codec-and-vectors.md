# Companion Loopback Capability Codec And Cross-Language Vectors

Date: 2026-08-24

Status: implemented primitive layer; no listener or browser request exists

## Decision

TinyRustLM's Companion transport is implemented only from corrected profile
`tinyrustlm.companion.loopback-capability/2`. The corrected output-free
registration remains the protocol authority. This implementation milestone
adds the canonical transcript, cryptographic, identifier, path, and
installation-record primitives required by that profile. It does not create a
network server, pairing state, session state, browser client, artifact
transfer, or production integration.

Profile `/1` remains immutable non-executable history. No implementation reads
either preregistration JSON at runtime. There is no profile negotiation,
compatibility reader, migration, alias, alternate protocol, or fallback.

## Source Boundary

The primitive layer consists of:

- `CompanionLoopbackProtocol.cs`: strict transcript framing, SHA-256,
  base64url, HMAC-SHA-256 proofs, RFC 5869 single-block HKDF, exact pairing,
  request, response, rotation, and artifact-metadata transcripts, and bounded
  field validation.
- `CompanionLoopbackWire.cs`: the exact two-member installation record and its
  sole canonical UTF-8 file representation with one final LF.
- `tinyrustlm/tools/companion-capability-webcrypto.js`: a side-effect-free
  browser WebCrypto
  implementation of the same primitives. It performs no discovery, fetch,
  storage, service-worker, Worker, or cross-tab operation.
- `companion-loopback-capability-vectors.v1.json`: deterministic nonsecret
  cross-language inputs and expected bytes for transcript, pairing, session,
  request, response, artifact metadata, chunk response, rotation, and
  installation record cases.

The WebCrypto module remains outside the deployable `app/` closure until the
complete memory-only client is ready. It must move to the registered
`tinyrustlm/app/companion-capability.js` owner during that cutover, and the
tool-side path must be deleted rather than retained as a second implementation.

The old fixed-port browser bridge remains present only until the complete
listener/client cutover can delete it and its tests atomically. The new module
is not referenced by the current application shell, so there is no dual active
transport and no partially deployed protocol.

## Exact Cryptographic Semantics

Every transcript is the concatenation of its fields in registered order. Each
field is strict UTF-8 preceded by an unsigned 32-bit big-endian byte length.
There are no delimiter bytes and no normalization. The implementation rejects
unpaired UTF-16 surrogates, more than 32 fields, fields above 65,536 bytes, and
transcripts above 131,072 bytes.

Proofs are HMAC-SHA-256 over the exact domain-separated transcript and are
encoded as canonical unpadded 43-character base64url. Verifiers are
operation-specific. There is no public generic verifier through which a caller
could accidentally omit a domain or required field. Comparison processes all
32 proof bytes and malformed proof encoding is rejected.

Session and rotation keys use the exact registered RFC 5869 construction:

1. Hash the registered salt transcript with SHA-256.
2. Extract with HMAC-SHA-256 keyed by that 32-byte salt.
3. Expand exactly one block over the registered info transcript followed by
   byte `0x01`.
4. Return exactly 32 bytes.

No framework-default salt, info, field order, normalization, or key length is
accepted. Temporary native and browser byte arrays are cleared where the
runtime permits explicit clearing. Pairing secrets and session keys are test
inputs only in this milestone and are never written by product code.

## Validation Boundary

Identifiers are lowercase hexadecimal at their exact registered lengths.
Nonces and proofs are canonical unpadded base64url encodings of exactly 32
bytes. Timestamps are whole-second UTC RFC 3339 values and must also represent
a real calendar instant. Host is exactly `127.0.0.1` plus a shortest-decimal
port from 1024 through 65535. Origin is exactly
`https://tinyrustlm.com`. Proof paths contain only bounded printable route
segments and reject query, percent-encoding, fragment, backslash, control, and
non-ASCII variants.

Request proof validation admits only exact GET-with-empty-body or
POST-with-`application/json` shapes inside the registered 65,536-byte control
limit. Response proof validation admits only exact JSON or binary media types
inside the 4 MiB chunk boundary. Artifact metadata requires one of six exact
roles and validates chunk count, index, offset, length, full-artifact length,
and final-chunk arithmetic before hashing.

The installation record has exactly these members in this order:

```json
{"schema":"tinyrustlm.companion.installation.v1","installationId":"<32-lower-hex>"}
```

The durable file adds exactly one final LF. Parsing then canonical re-encoding
rejects BOMs, missing or extra final bytes, whitespace, reordered, duplicate,
unknown, escaped-equivalent, malformed UTF-8, wrong-schema, and wrong-identity
representations. No creation, ACL, ownership, or atomic-write behavior is
claimed by this codec; that belongs to the next state implementation.

## Independent Vector Method

The fixed expected values were calculated with an independent Node
`node:crypto` oracle using `createHash`, `createHmac`, manual u32 framing, and
manual RFC 5869 extract/expand. That oracle does not import the browser
implementation. The browser test first recomputes every expected value with
the independent oracle and only then compares the WebCrypto implementation to
the same corpus. The .NET tests consume the copied corpus independently.

The corpus covers:

- UTF-8 and non-normalized transcript bytes, including an empty named field;
- server pairing proof, session salt/key, browser proof, and completion proof;
- authenticated GET request and canonical JSON response proofs;
- six-role artifact metadata arithmetic and proof binding for a final chunk;
- rotation salt/key, new-key proof, and commit completion proof;
- canonical installation file bytes and SHA-256;
- wrong proof, wrong sequence, wrong metadata, query path, wrong host, invalid
  date, malformed base64url, invalid body shape, unknown/duplicate/reordered
  JSON, and invalid surrogate rejection.

After removing an unobserved timestamp field, the vector corpus is 4,731 bytes
with SHA-256
`6fb87e2ccebaf3c15c7af3452e05ee35c44ece40b8abf3ed1e45b9985cfc0e15`.

## Verification

The verified milestone gate is:

- browser/independent-oracle vector tests: 8 passed, zero failed, zero skipped;
- Companion tests: 51 passed, zero failed, zero skipped;
- Core tests: 80 passed, zero failed, zero skipped;
- package tests: 38 passed, zero failed, zero skipped;
- complete managed solution: 169 passed, zero failed, zero skipped;
- Release build: zero warnings and zero errors;
- `dotnet format --verify-no-changes`: zero files changed;
- `git diff --check`: passed.

The earlier complete Node gate remains an explicit blocker at 1,150 passed, 15
failed, and one skipped across 1,166. This milestone does not change or excuse
those failures and authorizes no deployment.

## Claim Boundary

This proves deterministic cross-language primitive conformance for registered
profile `/2`. It does not prove a bound loopback port, pairing race safety,
session sequencing, expiration, rotation state, revocation, Kestrel request
parsing, browser Local Network Access, artifact serving, full-artifact hashing,
browser storage, atomic ACG2 activation, model conversion, model quality,
product chat, package publication, site deployment, public P2P reachability,
MemoryEndpoints operation, or campaign progress.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain exactly 0/20 qualified models, 0/50 deletion-backed browser rounds,
0/25 authorized live memory rounds, 0/40 current outside-network lane proofs,
and 0/20 live catalog announcements.

## Next Implementation Order

1. Implement create-only installation identity persistence with exact owner,
   ACL/mode, fsync, nonempty-root, and startup rejection rules.
2. Implement pairing and session state against a fake wall/monotonic clock,
   atomic sequence reservation, exact idempotence, capacity, expiry, and race
   behavior.
3. Implement rotation, exact old-key commit replay, and revocation with key
   erasure only after response materialization.
4. Implement the closed Kestrel listener and raw-socket rejection tests before
   connecting browser fetch.
5. Implement the memory-only explicit-action browser client and real-browser
   Local Network Access observations.
6. Implement canonical operation projection and bounded six-artifact transfer,
   then delete the old bridge and its tests in the same complete cutover.
7. Fix every known full Node gate root cause before any deployment.

No later step may introduce compatibility, migration, aliases, fixed-port
probing, automatic retries, response repair, generic file serving, path
disclosure, persistent session keys, fake success, weakened tests, stale
documentation, or campaign-count inflation.
