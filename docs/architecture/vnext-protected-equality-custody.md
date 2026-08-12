# vNext Protected Equality Custody

## Status

This document defines the single current custody boundary used by the vNext
public-safety scanner and campaign release surface. The implementation is:

- `contracts/vnext/protected-equality-custody-profile.v1.json`;
- `tinyrustlm/tools/vnext-protected-equality-custody.js`;
- `tinyrustlm/tests/helpers/vnext-protected-equality-fixtures.js`; and
- `tinyrustlm/tests/vnext-protected-equality-custody.test.js`.

The checked-in profile is 2,710 bytes with SHA-256
`db66fccab135294d950f8e1350ac2bab0947aad14b4ec87ac1565a6463b6730a`.
It is a clean-slate, single-current contract. There is no compatibility reader,
unsigned mode, default secret list, or per-operation list override.

## Threat Model

Public redaction evidence is unsound when a caller can omit a secret, replace
the comparison list after a failure, or replay a receipt against a different
list. Publishing a hash of the private list would make low-entropy credentials
and invitation material vulnerable to offline dictionary testing. Passing the
raw list through each operation also creates accidental logging, persistence,
and serialization paths.

The custody boundary therefore must prove all of these properties together:

1. one identified authority signed the exact private list and revision;
2. the caller pinned the expected authority, custody, revision, and generation
   before opening the bundle;
3. trusted time is inside the signed validity interval;
4. only a module-issued opaque handle can invoke equality scanning;
5. every scan and receipt binds the same public custody identity; and
6. no public result contains secret values, secret hashes, bundle bytes, or a
   commitment from which the private list can be guessed.

The implementation does not protect against a compromised signing authority,
a process-memory disclosure, or an authority that reuses a revision ID for a
different list. Revision-ID uniqueness is an explicit authority requirement
and must be enforced by the production issuer.

## Private Bundle

The private bundle schema is
`tinyrustlm.vnext.protected_equality_custody_bundle.v1`. It is strict canonical
RFC 8785 JCS and contains exactly:

- `algorithm`;
- `authorityKeyId`;
- `custodyId`;
- `expiresAtUtc`;
- `generation`;
- `issuedAtUtc`;
- `knownSecrets`;
- `previousRevisionId`;
- `revisionId`;
- `schema`; and
- `signature`.

The signature covers every field except `signature`, using Ed25519 over the
UTF-8 domain `tinyrustlm.protected_equality_custody.v1`, one zero separator
byte, and the canonical signed payload. The implementation rejects unknown or
accessor-bearing fields, noncanonical Base64, noncanonical JSON wire bytes,
wrong algorithms, invalid Unicode, duplicate secrets, unsafe identifiers, and
invalid revision chains before producing a handle.

Generation 1 requires a null predecessor. Every later generation requires a
different safe predecessor revision ID. A bundle may live for at most 30 days.
The parser has no clock or network access; its caller must supply the trusted
verification timestamp.

## Trust Pins

Custody opening requires an exact data object with six fields:

- the raw 32-byte Ed25519 public key in canonical Base64;
- expected authority key ID;
- expected custody ID;
- expected generation;
- expected revision ID; and
- trusted verification time in UTC.

The signed values must equal every corresponding caller pin. Trust is not
derived from names embedded in the bundle. The current contract intentionally
does not perform online discovery, key rotation, revocation lookup, or clock
acquisition. Those inputs must be resolved and authorized before custody is
opened.

## Bounds

The frozen limits are:

| Item | Limit |
| --- | ---: |
| Canonical bundle | 524,288 bytes |
| Secrets | 256 |
| One secret | 8 through 4,096 UTF-8 bytes |
| Aggregate secret bytes | 262,144 bytes |
| One scan | 4,194,304 bytes |
| Bundle lifetime | 2,592,000 seconds |
| Generation | 4,294,967,295 |
| Distinct finding classes | 16 |

An empty signed list is valid. It still creates and binds an identified custody
revision; it is not represented by a missing option or implicit default.

## Opaque Handle

After signature and pin verification, the module compiles all secret
representations once and stores them in a private `WeakMap`. The returned
frozen object exposes only schema, custody ID, revision ID, and generation. A
private `WeakSet` proves module issuance. Spreading, cloning, parsing, or
constructing a lookalike object cannot recreate this identity and fails with
`equality_custody_handle_invalid`.

The inspection API returns only the public binding. There is no API that
exports private bundle bytes, a secret, a secret hash, a compiled
representation, or signing material.

## Equality Scanning

For each secret, the module compiles and scans these frozen representation
families:

- UTF-8;
- UTF-16 little endian;
- UTF-16 big endian;
- standard Base64, padded and unpadded;
- Base64url, padded and unpadded;
- hexadecimal with case-insensitive digits; and
- fully percent-encoded UTF-8 with case-insensitive hex digits.

The byte scanner defensively copies bounded non-shared bytes. Hex and percent
case normalization are performed on scan-local copies. The text scanner first
requires valid Unicode and then scans its UTF-8 representation. Results contain
only sorted finding classes and the public binding; they never contain matched
offsets or values.

## Public Binding

The canonical public binding contains exactly:

- schema and custody profile identity;
- custody ID, revision ID, and generation;
- authority key ID;
- SHA-256 fingerprint of the raw authority public key; and
- known-secret count.

Its canonical bytes receive a domain-independent SHA-256 binding used by the
redaction result and receipt. The fingerprint identifies the public key; it is
not a hash of private material. The binding deliberately omits predecessor,
validity dates, bundle signature, and any secret-list commitment.

The public-safe redaction profile, release-surface profile, and offline bundle
profile all bind the exact custody profile. Every campaign release-surface
operation captures one handle at construction and cannot replace it per call.

## Failure Semantics

All errors are bounded `VnextEvidenceError` codes. The module fails closed for
missing bytes, malformed JSON, noncanonical wire bytes, malformed trust input,
pin mismatch, invalid revision lineage, invalid validity windows, wrong public
keys, failed signatures, invalid secrets, scan limits, or forged handles. It
does not repair a bundle, discard a bad secret, reduce the list, retry with a
different key, or return partial scan output.

## Verification Coverage

Focused tests cover canonical opening, all seven representation families,
empty custody, signature and trust-pin substitution, canonical-wire drift,
validity boundaries, revision-chain rules, secret bounds and duplication,
invalid Unicode, hostile accessors, shared or oversized scan buffers,
defensive copies, deterministic public bindings, absence of secret material,
and structural-handle forgery. Release-surface tests additionally prove that
all nine public operations retain the construction-time custody and reject raw
`knownSecrets` fields before invoking getters.

## Operational Requirements

Production use still requires an authorized issuer and private loader that:

- generates a cryptographically unpredictable new revision ID whenever the
  list changes;
- persists generation and predecessor state transactionally;
- protects the signing key outside public browser and report surfaces;
- delivers canonical bundle bytes without logging or durable public storage;
- resolves current authority, revocation, and trusted-time inputs; and
- destroys private delivery buffers after opening to the extent supported by
  the host runtime.

Until those controls exist and are authorized, tests prove only the local
contract and integration behavior. They are not evidence of production key
custody, production secret delivery, publication, or campaign completion.
