# vNext Public-Safe Redaction And Secret Scan

## Status

This document defines the bounded Node checkpoint for scanning an already
finalized vNext public contract, one allowlisted canonical generated-site JSON
control, or canonical public release text before it can become publishable
evidence. The implementation is:

- `contracts/vnext/public-safe-redaction-profile.v1.json`;
- `contracts/vnext/protected-equality-custody-profile.v1.json`;
- `tinyrustlm/tools/vnext-protected-equality-custody.js`;
- `tinyrustlm/tools/vnext-public-safe-redaction.js`; and
- `tinyrustlm/tests/vnext-public-safe-redaction.test.js`.

The checkpoint proves deterministic local validation, scanning, receipt
creation, protected equality-custody verification, and receipt replay for
supplied bytes. It is not Rust or browser scanner parity, an archive-export
gate, a publication, or a campaign result.

## Decision

Public evidence is not made safe by replacing suspicious values with a shared
marker. Replacement would change content identity, could merge distinct
failures into one misleading value, and could conceal which producer violated
the public contract.

The vNext rule is fail closed:

1. Accept bounded byte views only and require an explicit target kind on replay.
2. Copy the bytes before validation.
3. For a document, strict-parse and validate one exact current vNext schema.
4. Reject every private schema and every unknown public schema.
5. For a generated-site JSON control, strict-parse exact RFC 8785 JCS bytes,
   require one of the three frozen publication schemas, and derive a separate
   domain-separated control identity.
6. For public text, require fatal UTF-8 decoding, no BOM, LF-only line endings,
   no disallowed controls, and a terminal LF.
7. Recompute the document identity through both validators, or derive the
   control/text identity with its frozen domain and exact bytes.
8. Require one module-issued protected equality-custody handle and scan its
   seven encoding families plus contextual pattern and entropy rules.
9. Return the original canonical bytes unchanged only when no finding exists.
10. Return no output bytes when any finding exists.
11. Emit a separate canonical result containing identities, counts, and finding
   classes only.
12. Bind that result and target identity in a one-way `redaction-scan` receipt.

No API accepts an arbitrary JavaScript object as the target. This prevents
getters, coercion hooks, symbols, proxies, cycles, hidden properties, or object
mutation from participating in the public evidence decision.

## Frozen Profile

The exact profile is `tinyrustlm.vnext.public-safe-redaction.v1`. It binds the
current contract registry SHA-256 and recognizes one set of public and private
classes:

The checked-in redaction profile is 4,040 bytes with SHA-256
`4044b25f180949b0c9ef49cd60244ebbd0bb1a81479c0c9676fe30c8608e0e26`.
Its required protected equality-custody profile is 2,710 bytes with SHA-256
`db66fccab135294d950f8e1350ac2bab0947aad14b4ec87ac1565a6463b6730a`.

| Visibility | Contract classes |
| --- | --- |
| Public-safe candidates | artifact, claim, P2P, proof, receipt, release |
| Canonical public JSON controls | publication plan material, current release pointer, current release history |
| Canonical public text | public-text (`tinyrustlm.vnext.public_text.v1`) |
| Always private | companion, context, worker |

The input policy is
`bounded-final-canonical-document-canonical-public-json-control-or-lf-utf8-public-text-bytes-only`.
The control allowlist contains only
`tinyrustlm.vnext.site_publication_plan_material.v1`,
`tinyrustlm.vnext.site_release_pointer.v1`, and
`tinyrustlm.vnext.site_release_history.v1`. Controls must be exact canonical
JCS with no BOM, whitespace envelope, or trailing byte. Public text must
contain at least two bytes, end in LF, and contain no BOM, CR, NUL, DEL, or C0
control other than tab and LF. The output policy is
`unchanged-canonical-bytes-on-pass-no-output-on-fail`. Redaction markers are
forbidden.

The profile permits at most:

- 4 MiB of target bytes, matching the bounded publication-history ceiling;
- 64 distinct finding classes; and
- 64 KiB of canonical result bytes.

The signed private custody bundle permits at most 256 unique secrets, 8 through
4,096 UTF-8 bytes per secret, and 256 KiB of secret bytes in total. It must be
strict canonical JSON and carry an Ed25519 signature over the exact custody ID,
opaque revision ID, monotonic generation, predecessor, validity interval,
authority key ID, and secret array. Opening custody requires the exact
caller-pinned raw public key, key ID, custody ID, revision ID, generation, and
trusted verification time. The module returns an opaque `WeakSet`-registered
handle; structural copies are rejected.

Each public scan result binds the custody/profile identity, generation,
revision, public-key SHA-256 fingerprint, secret count, and a canonical binding
SHA-256. It never returns the private bundle, secret values, a secret hash, or
a public commitment to the secret list. The signature binds the private list
to the opaque revision, and the authority must issue a new unpredictable
revision ID whenever that list changes. This avoids turning public evidence
into an offline dictionary oracle while making authority or revision
substitution visible.

## Detection

For each privately supplied known secret, the scanner checks these exact byte
representations:

- UTF-8;
- UTF-16 little endian;
- UTF-16 big endian;
- standard Base64, with or without padding;
- Base64url, with or without padding;
- hexadecimal with case-insensitive digits; and
- percent-encoded UTF-8, including fully encoded bytes and case-insensitive
  percent triplets.

The canonical parsed document is traversed iteratively under the frozen schema
descriptors. Canonical generated-site controls are traversed completely,
reject forbidden field names, and recognize only exact SHA-256, content-ID,
and source-revision field forms as cryptographic types. Canonical public text
is scanned as one bounded text value. Pattern classes cover authorization and bearer values,
private key material, common public-provider credentials, JWTs, credential
assignments, cookie credentials, credential-bearing URLs, secret invitation
paths, private absolute paths, exception details, raw conversation or hosted
memory markers, and stable hardware identifiers.

High-entropy detection applies only to non-cryptographic fields. Values whose
schema type is SHA-256, content ID, source revision, Ed25519 public key, or
Ed25519 signature are exempt from generic entropy scoring, but never from an
exact known-secret match. This distinction allows legitimate evidence hashes
without granting arbitrary opaque strings a public-safe exemption.

Pattern and entropy rules are defense in depth. Closed schemas remain the
primary privacy control. Raw prompt, output, memory, model-byte, credential,
and private-key field names cannot be added to a public contract, and an
unknown field is rejected before scanning.

## Canonical Result

The result schema is
`tinyrustlm.vnext.public_safe_scan_result.v1`. Its exact fields are:

- result schema, profile ID, and exact profile SHA-256;
- source schema and class, including the frozen control and public-text pairs;
- source subject ID and canonical-content SHA-256;
- SHA-256 and byte length of the exact source wire bytes;
- protected custody ID, revision, generation, authority key ID, public-key
  fingerprint, binding SHA-256, and known-secret count, but no secret value,
  secret hash, or public secret-list commitment;
- `pass` or `fail`;
- finding-class count; and
- sorted distinct finding classes.

The result is serialized with the vNext safe-integer JCS profile. Running the
scanner twice over the same target and protected custody revision produces identical
result bytes. The result SHA-256 is returned separately, so the result does not
contain a self-referential hash.

## Receipt Graph

`createVnextRedactionScanReceipt` creates one ordinary
`tinyrustlm.vnext.receipt.v1` with `receiptType=redaction-scan`. It binds:

- `public-safe-redaction-profile` to the exact profile bytes;
- `target-canonical-content` to the finalized target content hash;
- `target-wire` to the exact canonical target bytes;
- `redaction-scan-result` to the canonical result bytes; and
- `public-output-wire` to the unchanged target bytes on pass only.

The target never points to the scan receipt. The receipt is created after the
target and therefore cannot form an identity cycle. A failing scan receives a
bounded registered error and blocker code, no public output hash, and no secret
text.

`verifyVnextRedactionScanReceipt` independently validates the receipt, requires
`targetKind=document`, `targetKind=public-json-control`, or
`targetKind=public-text`, reruns that exact scanner over the supplied target
bytes and the same module-issued custody handle, rebuilds the expected receipt,
and requires byte equality. A caller cannot substitute an incomplete list:
raw list fields, missing handles, and structural handle copies fail before
scanning, while a different valid revision changes the bound identity. A
current signature descendant and trusted
authority graph remain separate requirements for using the receipt as release
evidence.

## Offline Binding

The offline verification manifest binds eight installed profiles:

1. campaign-projection profile;
2. contract registry;
3. offline-bundle profile;
4. phase-invalidation profile;
5. protected equality-custody profile;
6. public-safe redaction profile;
7. receipt-signature profile; and
8. receipt-store profile.

This prevents scanner-policy substitution inside an otherwise valid offline
bundle. The general offline verifier does not receive private known-secret
values and therefore does not silently claim equality-list replay. An
authorized release orchestrator must invoke the dedicated redaction receipt
verifier with the protected custody handle before admitting that scan as current release
evidence.

## Failure Semantics

All failures use bounded `VnextEvidenceError` codes and registered steps.
Malformed JSON, unknown fields, private schemas, noncanonical wire, identity
drift, accessor-bearing configuration, invalid secret strings, byte or count
limits, finding overflow, receipt drift, wrong target bytes, and missing,
forged, or mismatched custody handles fail without returning source text.

The scanner does not retry, repair, choose a different representation, remove
fields, truncate a secret, or emit a best-effort pass. A changed profile,
scanner source, target, known-secret count, or result creates changed evidence.

## Verification Coverage

The focused tests cover:

- every public and private vNext class;
- unchanged canonical output and defensive byte copies;
- noncanonical, unknown-field, oversized, object, proxy, accessor, and lone
  surrogate inputs;
- canonical public text plus missing terminal LF, BOM, CRLF, invalid UTF-8,
  NUL, and other control rejection;
- allowlisted canonical publication controls plus unknown-schema and
  noncanonical-wire rejection;
- all seven known-secret encoding families, including padding and case variants;
- every frozen detector rule;
- contextual entropy positives and cryptographic-field negatives;
- deterministic result bytes;
- pass and fail receipt creation;
- exact receipt replay with the protected custody revision;
- replay failure with a changed target, changed revision, forged handle, or raw
  caller-supplied list;
- inclusion of the profile in offline manifest bindings.

## Remaining Work

- Connect the sole release surface to an authorized private custody loader and
  signer without exposing bundle bytes or accepting per-operation secret lists.
- Enumerate and scan both compressed bytes and every decoded archive member
  under an archive-specific bounded profile. This JSON-document boundary does
  not decompress archives.
- Reproduce profile parsing, exact encodings, document and public-text detector
  semantics, canonical results, and receipt replay in Rust and browser/WASM
  implementations.
- Continue later incompatible product-phase cutovers until every shipping
  producer uses this boundary; the maintained release and publication path is
  already cut over and rejects restoration of its removed scanner path.
- Preserve exact phase invalidation and truthful campaign projection through
  the sole Rust-backed runner.
- Obtain signed, authorized, deployment, and public-readback evidence before
  any public-safe or release claim.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
