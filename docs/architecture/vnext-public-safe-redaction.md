# vNext Public-Safe Redaction And Secret Scan

## Status

This document defines the bounded Node checkpoint for scanning either an
already finalized vNext public contract or canonical public release text before
it can become publishable evidence. The implementation is:

- `contracts/vnext/public-safe-redaction-profile.v1.json`;
- `tinyrustlm/tools/vnext-public-safe-redaction.js`; and
- `tinyrustlm/tests/vnext-public-safe-redaction.test.js`.

The checkpoint proves deterministic local validation, scanning, receipt
creation, and receipt replay for supplied bytes. It is not Rust or browser
parity, an archive-export gate, production secret custody, a publication, or a
campaign result.

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
5. For public text, require fatal UTF-8 decoding, no BOM, LF-only line endings,
   no disallowed controls, and a terminal LF.
6. Recompute the document identity through both validators, or derive the
   public-text identity with its frozen domain and exact bytes.
7. Scan known-secret encodings plus contextual pattern and entropy rules.
8. Return the original canonical bytes unchanged only when no finding exists.
9. Return no output bytes when any finding exists.
10. Emit a separate canonical result containing identities, counts, and finding
   classes only.
11. Bind that result and target identity in a one-way `redaction-scan` receipt.

No API accepts an arbitrary JavaScript object as the target. This prevents
getters, coercion hooks, symbols, proxies, cycles, hidden properties, or object
mutation from participating in the public evidence decision.

## Frozen Profile

The exact profile is `tinyrustlm.vnext.public-safe-redaction.v1`. It binds the
current contract registry SHA-256 and recognizes one set of public and private
classes:

The checked-in profile is 3,473 bytes with SHA-256
`83fcdd3590692304807e1ca62f82ad5873111cf0cce6b239bd51249d5c29d2b0`.

| Visibility | Contract classes |
| --- | --- |
| Public-safe candidates | artifact, claim, P2P, proof, receipt, release |
| Canonical public text | public-text (`tinyrustlm.vnext.public_text.v1`) |
| Always private | companion, context, worker |

The input policy is
`bounded-final-canonical-document-or-lf-utf8-public-text-bytes-only`. Public
text must contain at least two bytes, end in LF, and contain no BOM, CR, NUL,
DEL, or C0 control other than tab and LF. The output policy is
`unchanged-canonical-bytes-on-pass-no-output-on-fail`. Redaction markers are
forbidden.

The profile permits at most:

- 2 MiB of target bytes, matching the largest public vNext contract;
- 256 privately supplied known secrets;
- 8 through 4,096 UTF-8 bytes per known secret;
- 256 KiB of known-secret bytes in total;
- 64 distinct finding classes; and
- 64 KiB of canonical result bytes.

Known-secret strings must contain valid Unicode scalar values and arrive as a
plain data array. They are held only for the scan call. Neither secret values
nor public hashes of those values enter the result, receipt, profile, logs, or
configuration hash. This avoids turning a public receipt into an offline
dictionary oracle.

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
descriptors. Canonical public text is scanned as one bounded text value. Pattern
classes cover authorization and bearer values,
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
- source schema and contract class, including the frozen public-text pair;
- source subject ID and canonical-content SHA-256;
- SHA-256 and byte length of the exact source wire bytes;
- private known-secret input count, but no value or value commitment;
- `pass` or `fail`;
- finding-class count; and
- sorted distinct finding classes.

The result is serialized with the vNext safe-integer JCS profile. Running the
scanner twice over the same target and private equality list produces identical
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
`targetKind=document` or `targetKind=public-text`, reruns that exact scanner over
the supplied target bytes and private equality list, rebuilds the expected
receipt, and requires byte equality. Supplying an incomplete
known-secret list to replay a prior failure changes the deterministic result
and fails the receipt binding. A current signature descendant and trusted
authority graph remain separate requirements for using the receipt as release
evidence.

## Offline Binding

The offline verification manifest binds seven installed profiles:

1. campaign-projection profile;
2. contract registry;
3. offline-bundle profile;
4. phase-invalidation profile;
5. public-safe redaction profile;
6. receipt-signature profile; and
7. receipt-store profile.

This prevents scanner-policy substitution inside an otherwise valid offline
bundle. The general offline verifier does not receive private known-secret
values and therefore does not silently claim equality-list replay. An
authorized release orchestrator must invoke the dedicated redaction receipt
verifier with the protected list before admitting that scan as current release
evidence.

## Failure Semantics

All failures use bounded `VnextEvidenceError` codes and registered steps.
Malformed JSON, unknown fields, private schemas, noncanonical wire, identity
drift, accessor-bearing configuration, invalid secret strings, byte or count
limits, finding overflow, receipt drift, wrong target bytes, and wrong private
equality lists fail without returning source text.

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
- all seven known-secret encoding families, including padding and case variants;
- every frozen detector rule;
- contextual entropy positives and cryptographic-field negatives;
- deterministic result bytes;
- pass and fail receipt creation;
- exact receipt replay with the protected equality list;
- replay failure with a changed target or incomplete list; and
- inclusion of the profile in offline manifest bindings.

## Remaining Work

- Invoke the dedicated replay verifier from the release orchestrator with an
  authorized protected equality list.
- Enumerate and scan both compressed bytes and every decoded archive member
  under an archive-specific bounded profile. This JSON-document boundary does
  not decompress archives.
- Reproduce profile parsing, exact encodings, document and public-text detector
  semantics, canonical results, and receipt replay in Rust and browser/WASM
  implementations.
- Replace every shipping producer and publication gate with this vNext
  boundary, verify all dogfood callers, and delete superseded scanners.
- Add exact phase invalidation and truthful dashboard projection.
- Obtain signed, authorized, deployment, and public-readback evidence before
  any public-safe or release claim.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
