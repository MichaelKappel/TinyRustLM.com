# TinyRustLM vNext Contract Family

## Authority

`contract-family.v1.json` is the machine-readable Phase 2 contract registry.
It freezes the nine top-level schema names, exact root and nested record
fields, field kinds, enum values, limits, visibility, identity domains,
redaction policy, and named semantic invariants.

This registry is an incompatible clean-slate contract. It does not map, alias,
upgrade, or fall back to any dated TinyRustLM schema. Existing records remain
historical evidence outside the vNext DAG.

## Parsing

Every JSON input is first consumed as bounded bytes. Before schema validation,
the parser rejects:

- empty or oversized input;
- UTF-8, UTF-16, or UTF-32 BOMs;
- invalid UTF-8;
- literal or escaped-equivalent duplicate member names;
- lone surrogates and invalid escapes;
- non-JSON whitespace or grammar;
- negative zero, unsafe integers, overflow, and underflow;
- excessive depth, entries, members, arrays, strings, or number characters;
- trailing non-whitespace data.

The schema validator then rejects every unknown or missing field at every
record depth. It never drops unknown fields, applies defaults, coerces values,
normalizes identifiers, repairs JSON, or chooses a nearby schema version.

The canonical output profile is RFC 8785 JCS over the accepted in-memory JSON
value. Promotion still requires the shared RFC 8785 corpus across Rust, Node,
and browser implementations; naming the profile is not conformance evidence.

## Primitive Semantics

- `safe-id`: 3 to 160 printable ASCII characters matching
  `[a-z0-9][a-z0-9._:-]*` unless a literal or enum narrows it.
- `sha256`: exactly 64 lowercase hexadecimal characters.
- `content-id`: `sha256:` plus a `sha256` value.
- `utc`: an actual UTC instant ending in `Z`, with seconds and optional one to
  nine fractional digits; leap-second acceptance is not implied.
- `date`: a real `YYYY-MM-DD` UTC calendar date.
- `semver`: SemVer 2.0.0 without surrounding whitespace.
- `source-revision`: `git-sha1:` plus 40 lowercase hexadecimal characters or
  `sha256:` plus 64 lowercase hexadecimal characters.
- `https-url`: absolute HTTPS, ASCII host, no user information, query, or
  fragment, and no localhost, loopback, private, link-local, unspecified, or
  multicast address in public-safe contracts.
- `public-path`: an absolute URL path beginning with one `/`, without a
  scheme, authority, backslash, dot segment, encoded path separator, query,
  fragment, C0/C1 control, or non-ASCII byte.
- `ed25519-public-key`: canonical padded base64 for exactly 32 decoded bytes.
- `ed25519-signature`: canonical padded base64 for exactly 64 decoded bytes.
- `integer`: a JavaScript/RFC 8785 safe integer within the field bounds.
- `bounded-string`: valid Unicode scalar values within the declared code-unit
  bounds and without C0/C1 controls.
- `bounded-text`: the same scalar and code-unit bounds, but permits tab, LF,
  and CR. Only private content fields may use this primitive.
- `nullable`: exactly null or the declared value type.
- `record`: exactly the named closed record.
- `array`: exact item type and declared cardinality; `unique`, `uniqueBy`,
  `sorted`, and `sortedBy` are mandatory semantics when present.

No generic map, arbitrary extension object, untyped JSON value, float, or
open payload appears in the family. Decimal measurements that cannot be safe
integers are represented as bounded strings with an explicit unit.

## Identity

SHA-256 is the only mandatory hash. A domain-separated identity is:

```text
SHA-256(UTF8(identityDomain) || 0x00 || JCS(identityContent))
```

Each contract declares its derivation, identity field, canonical-hash field,
and exact excluded fields. Domain-separated contracts exclude their identity
and canonical-hash fields, then store the result as lowercase hex in
`canonicalContentSha256` and as `sha256:<digest>` in the identity field.
Artifact identity is instead the SHA-256 of complete artifact bytes. Its
manifest canonical hash excludes only `canonicalContentSha256`, so the
manifest hash still binds `artifactId` and every other manifest field.

Worker and companion messages intentionally have no public content identity.
Their IDs are correlation/replay identifiers scoped to a private session.

Signature envelopes are `tinyrustlm.vnext.receipt.v1` records with
`receiptType=signature-envelope`. A signature never changes the signed content
receipt and never elevates local, fixture, or emulated evidence into another
evidence class.

## Public Safety

The default visibility is private. Only artifact metadata, receipts, P2P
manifests, outside proofs, release manifests, and claims can become
public-safe. Context, worker, and companion records are private even when they
contain only hashes.

Every public-safe record names the exact redaction profile and requires a
separate current redaction/secret-scan receipt in its evidence graph. The scan
receipt binds the target's already-final canonical hash; the target never
points back to the scan, so content addressing remains acyclic. A
`redaction-scan` receipt is structurally public-safe and does not recursively
require another scan of itself. Public records reject the forbidden key names
and value classes in the registry. Public URLs are HTTPS without user
information, query, or fragment. Errors contain a registered code, failure
step, retry status, and rollback status only. Raw exceptions, prompts,
outputs, hosted memory, model bytes, credentials, invitation material,
private paths, and stable unnecessary user/hardware identifiers are never
public evidence.

Hashing a secret does not automatically make it public-safe. A hashed value is
allowed only where the schema explicitly names that hash, its disclosure has a
defined purpose, and the redaction scan accepts it.

## Contract Roles

- **Artifact** binds complete bytes, metadata, dependencies, source evidence,
  qualification, pieces, and license. It does not contain model bytes or byte
  locations.
- **Receipt** is the sole phase-evidence envelope. Phase meaning is selected by
  a closed `receiptType`, not a new top-level schema. Signature envelopes,
  authority registries, key revocations, and offline verification bundles use
  closed typed payload records; generic public parameters cannot substitute
  for those security bindings.
- **Context** is the sole private compiled inference context. Segment order,
  role, source kind, trust, current authority, content hashes, provenance,
  supersession, conflicts, token budget, and cache identities are explicit.
- **Worker** is a small private control envelope. Private and large payloads
  move as separately transferred bytes bound by length and SHA-256.
- **Companion** is a small private loopback envelope. Pairing/capability
  secrets remain in protected headers and never enter JSON bodies.
- **P2P** is the complete fixed-piece manifest for one exact artifact and its
  qualification/provenance parents. It contains no endpoint.
- **Proof** is one expiring outside observer's complete-transfer observation
  for one lane and endpoint. Its signature is a separate receipt.
- **Release** closes over passing campaign, artifact, package, site, claim,
  SBOM, provenance, and authorization parents.
- **Claim** is the only machine-readable public wording authority. Site,
  route, component, wording class, evidence tier, source revision, release,
  owner, review time, blockers, and exact wording are explicit. Draft, local,
  external, published, stale, blocked, and retracted states are distinct.

## Change Rules

Changing a required field, field meaning, enum, limit, identity domain,
visibility, parser profile, redaction rule, or invariant requires a new
registry and affected schema identifier. A new schema is accepted only after
both validators and the shared hostile corpus pass. There is no permissive
minor-version range.

Limits may be lowered before production only through a new frozen registry;
they are never changed after seeing which value allows a preferred artifact or
model to pass. Raising a limit requires measured memory/time evidence and a
threat review.

## Validation Checkpoint

Phase 2 has two intentionally different Node validators:

- `tinyrustlm.vnext.registry-schema-validator.v1` interprets this frozen
  registry and then applies class-specific local invariants.
- `tinyrustlm.vnext.independent-schema-validator.v1` carries a separately
  written exact schema and local-invariant implementation. It does not import
  the registry validator, read this registry, or access the filesystem.

Both consume the same checked-in language-neutral corpus of exact base64 raw
JSON bytes. The corpus is deterministic and binds its registry and normalized
generator-source hashes. It currently contains 69 cases: 14 accepted and 55
rejected. Tests require both validators to match every expected verdict, accept
object-key permutations, reject every missing root field, and reject an unknown
field at every reachable object depth. The registry interpreter additionally
partitions every declared invariant into checked, not applicable, or deferred;
the independent validator remains a separately sourced verdict oracle rather
than consuming that registry-owned invariant list.

`docs/architecture/vnext-contract-threat-review.md` is the authoritative
security review for this checkpoint. Its PASS is limited to schema and local
invariants. It does not prove canonical identity, signatures, authority or
revocation chains, receipt-DAG closure, redaction execution, Rust/browser
parity, production cutover, or any campaign result.

## Completion Boundary

The registry freezes design. It does not prove that the SLM2 parser, runtime,
browser worker, companion, P2P fleet, observer, release system, or claim
renderer implements these contracts. Implementation claims begin only after
the corresponding phase tests and objective receipts exist. No campaign
counter is earned by this registry.
