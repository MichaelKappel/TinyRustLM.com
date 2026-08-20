# TinyRustLM vNext Contract Family

## Authority

`contract-family.v1.json` is the machine-readable Phase 2 contract registry.
It freezes the nine top-level schema names, exact root and nested record
fields, field kinds, enum values, limits, visibility, identity domains,
redaction policy, and named semantic invariants.

This registry is an incompatible clean-slate contract. It does not map, alias,
upgrade, or fall back to any dated TinyRustLM schema. Existing records remain
historical evidence outside the vNext DAG.

## SLM2 Model Format Checkpoint

The model-byte format is a separate exact binary contract referenced by the
artifact family rather than another JSON schema in the nine-member registry.
The current development-only profile is
`slm2-format-profile.v1.json`, 14,097 bytes with SHA-256
`f272caf64cacb7a4705fee0c958f15ee0cac3985d8728458a80f812913d66554`.
It admits only complete class-1 base models or class-2 specialist models with
dense finite little-endian F32 tensors. Tokenizers, templates, adapters,
composition graphs, provenance, licenses, qualification, signatures, and peer
locations remain separate exact artifacts or receipts.

`slm2-format-vectors.v1.json` is the language-neutral byte contract. Its one
seed artifact is exactly 1,800 bytes with SHA-256
`14ad14add8c8205e29040307eb42a4c749fb161fe7105e1de2bcbfc032ca81c4`.
The public Rust writer reproduces those bytes from deliberately reversed
tensor inputs; the streaming Rust reader, an independently written Node-core
reader, and the Rust piece/Merkle implementation reproduce every declared
identity. Both readers reject the five frozen artifact mutations, and the
independent Node SLM-DCBOR-1 parser also rejects nonshortest, duplicate,
indefinite, tagged, floating, trailing, non-ASCII, and non-text-key forms.

The bounded raw parser-fuzz profile is
`slm2-fuzz-profile.v1.json`, 3,061 bytes with SHA-256
`ee114d831d180afdb15c2f8ea00e76212083fd764c605f2cf193f0770708a641`.
Its 26-seed stable corpus contains one exact admission and 25 single-fault
rejections across envelope, metadata, string, tensor, layout, payload, and
trailing-byte classes. The harness deserializes the exact hashed profile into
closed typed records and proves every executable limit, ordered error code,
declared check, replay rule, and prohibited behavior agrees with its source
contract before parser entry. The stable Rust replay consumes those shared
limits and verifies the exact seed set, bytes, hashes, verdicts, error codes,
and admitted tensor count; hostile tests reject membership, identity, ordering,
path, byte, and verdict drift. The optional libFuzzer target compiles with
`libfuzzer-sys` 0.4.13. This is deterministic local parser evidence, not a
long-running sanitizer result, converter/runtime conformance result, model
qualification, deployment, publication, or live campaign evidence. See
`docs/architecture/vnext-slm2-format-implementation.md`.

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

The sole proof contract is `tinyrustlm.vnext.outside_proof.v2`. The proof has
no signature-envelope field because mutually embedding proof and signature
receipt identities would create an unresolvable content-addressed cycle. The
proof is finalized first. A signature-envelope receipt then names the proof ID,
schema, canonical-content hash input, authority registry, role, scope, nonce,
and times as a one-way descendant. Outside-proof v1 is rejected and has no
alias or compatibility reader.

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

The same profile admits release text only through the separate
`tinyrustlm.vnext.public_text.v1` scanner. Those bytes must be fatal UTF-8 with
no BOM, CR, disallowed controls, or missing terminal LF. The scanner derives a
domain-separated text identity, applies known-secret, contextual pattern, and
entropy rules, returns unchanged bytes only on pass, and requires an explicit
`public-text` target kind when its receipt is replayed.

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
- **Release** is the acyclic prepublication predicate. It binds the exact
  campaign plan/projection, passing campaign attestation, artifacts, packages,
  approved claims, SBOM, provenance, changelog, and explicit remaining risks.
  Authorization, deployment, HTTPS readback, and published claim descendants
  point forward to the already-finalized release.
- **Claim** is the only machine-readable public wording authority. Site,
  route, component, wording class, evidence tier, source revision, release,
  owner, review time, blockers, and exact wording are explicit. Draft, local,
  external, approved-for-publication, published, stale, blocked, and retracted
  states are distinct. Approved claims have no release ID; published
  descendants reference and supersede the approved claim after readback.

## Change Rules

Before the first authorized production record exists, changing a required
field, field meaning, enum, limit, identity domain, visibility, parser profile,
redaction rule, or invariant replaces the current clean-slate registry. The
family ID, bound profiles, vectors, generated corpus, validators,
documentation, and complete test closure must change together. No reader for
the replaced registry remains in the product path.

After the first authorized production record exists, the same material change
requires a new registry and affected schema identifier. A new schema is
accepted only after both validators and the shared hostile corpus pass. There
is no permissive minor-version range, dual reader, or automatic upgrade.

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
generator-source hashes. It currently contains 70 cases: 14 accepted and 56
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

## Node Phase 3 Checkpoint

`tinyrustlm/tools/vnext-content-identity.js` finalizes and validates every
identity-bearing vNext document through both validators and exact canonical
bytes. `tinyrustlm/tools/vnext-signature-payload.js` implements the frozen
public-key Ed25519 primitive over role-specific domain-separated JCS bytes.
`tinyrustlm/tools/vnext-signature-authority.js` consumes bounded canonical
receipt and subject byte arrays, requires out-of-band root and terminal
registry pins, authenticates successor registries and revocations through the
predecessor release-authorizer key, rejects stale-registry signing and nonce
replay, and evaluates compromise and currentness without network access.
`tinyrustlm/tools/vnext-offline-bundle.js` adds one canonical closed manifest
and a separate acyclic verification receipt. It binds all member bytes, all
nine schema descriptors, the contract, campaign-projection,
phase-invalidation, protected equality-custody, redaction, signature, store,
and bundle profiles, target
signatures, campaign/environment, and registry pins; rejects
missing, extra, duplicate, unlinked, stale, interrupted, resource-exceeding,
or drifted input; and invokes the authority verifier only with supplied member
bytes.

`tinyrustlm/tools/vnext-public-safe-redaction.js` accepts finalized canonical
public-contract bytes only, rejects every private class, requires one
module-issued signed custody revision, scans seven bounded known-secret
encoding families plus schema-contextual forbidden value classes, returns
the unchanged bytes only on zero findings, and emits a separate deterministic
result containing identities, counts, and classes rather than values. Its
receipt builder and replay verifier bind target wire/content identity, exact
profile and scanner, result hash, status, custody identity/revision/generation,
public-key fingerprint, and protected equality-list count without publishing a
secret hash or list commitment. Callers cannot supply or change a raw list per
operation. The offline manifest binds both custody and redaction profiles among
eight installed profile or registry bindings. See
`docs/architecture/vnext-protected-equality-custody.md` and
`docs/architecture/vnext-public-safe-redaction.md`.

`tinyrustlm/tools/vnext-protected-equality-private-loader.js` is the single
current local private ingress for that custody. Its frozen 3,323-byte profile
has SHA-256
`c786ee4bf66810eb3c7cbe4db2be9ad15f24b26096988df7f819c400822e43a9`,
and its exact ten-member source closure has SHA-256
`96d170e0eee5d1dbfad57504268dc3eecb1eeb6c779f6dab076ad07a4474c2b8`.
It accepts canonical public trust bytes, reads the private signed bundle only
from inherited non-file pipe descriptor 3, closes that descriptor on every
attempt, and zeros owned delivery buffers. It accepts no private path,
environment, argument, standard-input, network, clock, retry, compatibility,
or unsigned mode. See
`docs/architecture/vnext-protected-equality-private-loader.md`. The release
bootstrap now opens exactly one custody revision through descriptor 3 and the
public custody facade exposes no constructor. The production issuer,
authorized launcher, revocation source, trusted-time provider, and OS isolation
remain incomplete.

`tinyrustlm/tools/vnext-phase-invalidation.js` classifies immutable phase
history through explicit same-operation supersession and dependency-only
staleness. `tinyrustlm/tools/vnext-campaign-projection.js` finalizes the exact
20/50/25/40/20 schedule and counts only planned, current-pass,
authority-eligible evidence whose required earlier objectives are current.
`rust/crates/tinyrustlm-evidence` independently finalizes and validates that
exact closed campaign-plan wire for native and `wasm32-unknown-unknown`
targets. The Node generator and two checked-in parity vectors bind both
implementations to identical draft bytes, plan ID, final bytes, and SHA-256.
`campaign-evidence-wasm-interface.v1.json` freezes the sole typed raw browser
evidence ABI. One generator emits both the Rust export facade and
byte-transport-only browser adapter; Node and two independent real Chromium
profiles reproduce exact plan, currentness, projection, result-validation, and
stable rejection bytes through the zero-import WASM module.
See `docs/architecture/vnext-campaign-evidence-wasm-boundary.md` for the exact
ABI, ownership, destructive-state, browser, and non-claim boundary.
The same Rust evidence crate now independently implements exact receipt
validation and semantic currentness. A deterministic 74,756-byte corpus with
SHA-256
`c583f55f0c81da4db08543b0a8e28ad4ee178a1a1a1169b6aeb3329bf67f7ee4`
freezes four accepted histories and nine hostile rejections. Node and Rust
must emit byte-identical canonical currentness results and the same stable
rejection codes. This API has no filesystem, network, clock, process, or
compatibility behavior and is exposed through the generated campaign-evidence
browser ABI without handwritten JavaScript semantics.
The complete synthetic capacity fixture verifies a 271-receipt offline bundle
with 155 target signatures and 40 proof subjects; it changes no live campaign
counter. See `docs/architecture/vnext-phase-invalidation.md` and
`docs/architecture/vnext-campaign-plan-projection.md`. The Rust boundary and
its non-claims are documented in
`docs/architecture/vnext-rust-campaign-plan-parity.md`.
The Rust currentness boundary is documented in
`docs/architecture/vnext-rust-phase-invalidation-parity.md`.
The Rust Ed25519 primitive independently reproduces canonical payload,
domain-separated signing bytes, strict public-key verification, canonical
result bytes, and 17 exact hostile rejection codes. Its 27,988-byte public-only
vector corpus has SHA-256
`22c0c0976209afdfc934939903d455a44d63312260881d0fe983cccadd20e413`.
This is cryptographic primitive parity, not authority-graph, revocation,
nonce-replay, offline-bundle, release, or campaign parity. See
`docs/architecture/vnext-rust-signature-primitive-parity.md`.
The same crate independently verifies the complete bounded authority graph,
including every signable non-receipt subject family. Its public-only
434,761-byte corpus has SHA-256
`7340f17c34b2f86dcd4c2431d1de7ed8d36429badd51866c8abbff3b0f0fa89a`
and freezes nine accepted results plus 26 exact hostile rejection codes. See
`docs/architecture/vnext-rust-authority-graph-parity.md`.
The same crate now independently verifies exact offline manifest and member
binding, the separate verification receipt, authority composition, closed
receipt and subject membership, terminal currentness, and target current
eligibility. Its public-only 668,506-byte corpus has SHA-256
`82b8239eb97089f2b9101a04da7f985deb80f044a620376393517438baf3f178`
and freezes three accepted bundles plus 31 exact hostile rejection codes. See
`docs/architecture/vnext-rust-offline-bundle-parity.md`.
The same crate now independently produces and validates the exact truthful
campaign projection. Its public-only 1,494,464-byte corpus has SHA-256
`8a72ac1b2e4abd944e41c1c53a7d475e350d961e7b627127404b0508cf654734`
and freezes 11 accepted projections, 22 exact input rejections, and 8 exact
result-wire rejections. See
`docs/architecture/vnext-rust-campaign-projection-parity.md`.

`tinyrustlm/tools/vnext-campaign-artifact-store.js` persists only exact
campaign-plan and projection-result wires under raw-byte SHA-256 paths. Its
4,555-byte frozen profile has SHA-256
`5736c06bedc41ebda83f51bc80405050ec1a466bc14248b12381e9d6fb95a784`.
It shares bounded no-follow validation and marker-backed durable publication
with the receipt store but retains separate result-to-plan semantics. Stored
results are immutable history; a missing or mismatched durability marker is
inactive, and `resumeProjection` reruns the projector from supplied current
evidence rather than selecting a mutable current pointer. See
`docs/architecture/vnext-campaign-artifact-persistence.md`.

`tinyrustlm/tools/vnext-subject-store.js` completes the other host-side input
store needed by the campaign runner. Its 3,845-byte frozen profile has SHA-256
`0985099802be93bbf4b88f834470d7aa605d1e60e672e38ceb2ec7ffa6f3f916`.
It admits only the five public-safe, non-receipt identity schemas, publishes
exact canonical bytes under the validated subject ID, and explicitly rejects
private context and receipt records. Its sole `putMany` implementation fully
preflights one to 1,024 unique subjects, orders them by subject ID, publishes
the complete set through one durable batch, and activates no in-memory member
until every target and durability receipt verifies. The size-one `put` method
is only a wrapper over that path. Bounded reconstruction, no-follow reads,
same-directory receipt-backed durable publication, exact target/receipt
readback, total-byte limits, interruption handling, and quarantine are shared
with the receipt and campaign artifact stores. It exposes no mutable current
pointer and grants no evidence currentness by itself. See
`docs/architecture/vnext-subject-store.md`.

`rust/crates/tinyrustlm-archive` owns the sole bounded ZIP and tar-gzip
admission authority. Non-Rust consumers invoke only its framed
`tinyrustlm-archive-scan` process through a create-only per-RID package. The
client/package profile has SHA-256
`08bb532cd88273f5633a8693040c2108fd7fef0935f9705f34b98cb1ab405441`
and binds the two Rust archive profiles, exact helper and package-builder
source closures, source revision and clean-worktree observation, Cargo and
rustc versions, RID/platform, build profile, trust class, executable, canonical
manifest, and canonical provenance. There is no direct-executable, `PATH`,
system-archive-tool, JavaScript-parser, compatibility, or best-effort path.
The native-package replay profile
`tinyrustlm.vnext.archive-scan-helper-verification.v1` has SHA-256
`825c2b76c7a1a2bc53cd79db778018b1efcb963d3e95bd16f21a7f029f4edd42`.
It admits exactly one ZIP and one tar-gzip vector through a packaged native
helper, removes its unique scratch child, and writes one create-only canonical
receipt only after exact member and package identity readback. One local clean
`win-x64` release package from source revision
`5db9e943ecdbcef83e27be1782d9bcb5ec4109fe` passed its 20/20 consumer
suite and produced replay receipt
`dde3309fa52fcc87925757f85335970d4f7807855debcae0dd405ad0ce5cddd8`.
This does not prove hosted CI, another RID, signing, publication, production
readback, or observation time. See
`docs/architecture/vnext-archive-admission.md`.

The separate hosted-fuzz execution profile
`tinyrustlm.vnext.archive-fuzz-hosted-verification.v1` has SHA-256
`0943bba8ceba94c6f925cd5cb33d163c33d654e4e59266c00ca3ef6346bfc415`.
Its sole runner requires a clean matching GitHub-hosted Linux checkout, exact
run and job identities, `nightly-2026-08-01`, `cargo-fuzz 0.13.2`,
`libfuzzer-sys 0.4.13`, explicit AddressSanitizer, the frozen 29-seed corpus,
and an offline child-process environment that excludes workflow credentials.
It records exact bounded stdout/stderr identities and retained crash inputs,
removes only its owned scratch child, then creates one canonical path-free
pass or fail record. The strict verifier rejects drift, tampering, unexpected
files, noncanonical JSON, incomplete pass records, and local attempts to
manufacture a hosted run. CI source uploads this record on both success and
failure. No hosted artifact has yet been independently retrieved and verified,
so this source milestone is not a sanitizer-execution result.

`rust/crates/tinyrustlm-durability` now owns the sole Rust directory-flush
boundary. Its 7,021-byte frozen profile has SHA-256
`bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb`.
The helper accepts one canonical 1-to-1,024-member stdin batch, requires strict
operation-ID ordering and unique IDs, and flushes each exact relative
directory under caller-held stable path-topology ownership. It rejects link
and Windows reparse paths, opens each Win32 directory handle with exact
access/share/flag semantics, and emits only one canonical path-redacted batch
observation or one bounded failure with no partial success document. The sole
Node package/process client has a 5,845-byte
frozen profile with SHA-256
`0d5fe88e8abb371a99db58f1ce3fabce180dc00f77287b6f44ea40d268d709a1`
and source-closure SHA-256
`b265141e0749422bcdadefab7777c97d154f442ac18397f69664dd1af24447f3`.
Its `flushMany` method verifies package, executable, source, profile, platform,
batch request, process, and observation identities before returning one
independently bound result per operation from exactly one child process; its
size-one `flush` method is a wrapper. There is no inherited child environment
or shell. The current Windows host executes this boundary successfully, and
every current vNext store now requires it. A successful batch is not an atomic
filesystem transaction. OS network isolation, release-package provenance,
and real physical power-loss evidence remain incomplete. See
`docs/architecture/vnext-directory-durability.md`.

`tinyrustlm.vnext.controlled-power-loss-verification.v1` is the sole current
source verifier for a controlled physical attempt. Its frozen 7,665-byte
profile has SHA-256
`00f4f787d62ca6f388ae06acb4c23134144ad25668d749aac9cd91dca9decfd1`;
its exact six-member source closure has SHA-256
`de8a707cd97f20806f84f76afd07ea974c3cbef1f701ed33dcae5935ec1434ac`.
It verifies three canonical Ed25519 witness records against one exact helper
package and helper receipt, protected caller trust and time, exact state,
machine/volume/boot identities, filesystem/cache/interruption classes, and
bounded chronology. Its public replay operation regenerates verification from
all source evidence and requires byte-identical receipt output; there is no
public standalone receipt parser that can promote a self-described receipt.
Local helper tests can emit only `fixture-only`, and every receipt keeps broad
durability, release, and campaign authorization false. No real physical
attempt or production witness evidence exists. See
`docs/architecture/vnext-controlled-power-loss-verification.md`.

`tinyrustlm/tools/vnext-durable-publication.js` now composes file fsync,
hard-link create-if-absent publication, verified helper batches, exact target
readback, and one forward-only content-addressed activation receipt per target.
Its sole `publishMany` path fully preflights one to 1,024 targets, flushes all
target directories in one helper batch and all receipt directories in another,
and returns no partial API result. The size-one `publishBytes` method is only a
wrapper. Its 7,469-byte frozen profile has SHA-256
`4c1006a986ced8359346cb856ea698c03cc187ae7a0b77b8108719a043becc35`;
its six-member source closure has SHA-256
`845acd1da5aa060ad7eb15dee0fdb866d9ac13ea20a699fe13f4ea6b0592b2d9`.
The receipt is the explicit non-recursive persistence trust anchor: it excludes
its own publication observation to avoid a self-hash cycle, while creation and
restart both require helper-backed directory flushes and exact readbacks before
activation. A failed batch may leave preserved inactive files, so no atomic
all-or-nothing filesystem claim is made. No caller can inject filesystem or
helper success into this boundary. Receipt and subject ingestion use their
sole batch paths; campaign-artifact, campaign-operation, and append-only
runner-lock paths use the same durable primitive. Missing or mismatched
receipts are inactive. This closes the batch integration slice, not the
remaining archive, fuzz, physical durability, or campaign
gates. See
`docs/architecture/adr/ADR-012-durable-publication-bootstrap.md`.

`tinyrustlm/tools/vnext-campaign-runner.js` now composes those stores through
one exact runner boundary. Its frozen 7,302-byte profile has SHA-256
`b0ba96ea2aa25112adea781138a4351511c56372bd1fdc04575e529a2b4720a9`.
The runner observes every active receipt and subject twice, rejects any
membership, marker, or wire change, binds caller pins, marker identities, and
trusted verification time in a create-only start record, invokes only the generated Rust campaign-evidence
ABI, validates the returned result again through Rust, and persists immutable
projection and terminal history. It exposes no evidence-subset, caller-verdict,
best-of-N, mutable-currentness, or stored-result promotion path. See
`docs/architecture/vnext-campaign-runner.md`.

`tinyrustlm/tools/vnext-campaign-release-surface.js` now consumes that runner
only by creating a never-before-used operation and receiving its exact result
inside the same call. Its frozen profile has SHA-256
`41c8c23b995c71fc16d2fc677cbdd28967de65f7c15e926b82f9e9cbb82c8913`.
The surface independently validates the returned projection against the exact
stored plan and runner operation records, finalizes a content-addressed
complete-or-blocked attestation, scans the final canonical bytes against the
one signed custody revision pinned when the surface opens, and derives a canonical operator
status with no `done` state. Its `prepareRelease` operation additionally
requires complete 20/50/25/40/20 campaign truth; all 20 qualified artifact
hashes; dependency closure; one CycloneDX 1.6 SBOM; current artifact,
qualification, package, provenance, and claim evidence from the same runner
snapshots; every current approved claim for the source revision; sorted risks;
and a canonical scanned changelog. It derives release time from trusted
verification time, scans every selected document and the final manifest,
persists redaction evidence before the create-only manifest, and returns
`not-authorized`. Its `authorizeRelease` operation then reconstructs the exact
runner start/terminal records, complete stored projection, original receipt and
subject snapshots, selected release evidence, and all three preparation scan
receipts before it admits an authorization. It accepts only one canonical
`signature-envelope` child whose role is `release-authorizer`, scope is
`release-authorization`, signed subject and `releaseId` are the exact prepared
manifest, source revision and campaign match, lifetime is finite, and current
vNext authority-graph result is fully eligible under caller-pinned root and
terminal registries. The authorization receipt is scanned before create-only
persistence; a restarted surface can repeat the exact operation idempotently.
Its `admitDeploymentAttempt` operation then replays the complete authorized
lineage and current authority graph before accepting one canonical
`deployment` receipt. That receipt is closed to the exact manifest, static
inventory, control documents, authorization receipt reference, current
web-build phase parent, campaign attestation reference, origin, byte count,
and deployment-class executor. Its frozen scope is
`deployment-attempt-only`; it cannot assert deployment success. The receipt is
secret-scanned and persisted only after its deterministic redaction receipt,
with byte-identical crash recovery and replay.
Its `verifyPublicReadback` operation then reconstructs the exact prepared,
authorized, and deployment-admitted closure, reruns current Ed25519 authority,
and invokes the sole production HTTPS verifier itself. The caller cannot
supply DNS, transport, response, body, result, retry, or success state. The
surface independently validates the canonical verifier result against the
manifest and frozen verifier/source identities, scans the result and finalized
receipt, and create-only persists the deterministic redaction receipt before
the `public-readback` receipt. Only exact dependency prefixes and byte-identical
replay are accepted. Its result is explicitly
`public-readback-verified-awaiting-publication` and `not-published`.
`prepareSitePublication` then reconstructs that exact closure, creates and
scans deterministic plan material, and create-only persists the scans before
one `site-synchronization` plan receipt. `authorizeSitePublication` requires
one exact, finite, current-evidence-eligible `site-publisher` signature over
that plan under the caller-pinned authority graph, invokes the pure
materializer, and scans the signature plus every pointer, history, and direct
published-claim candidate. It persists only signature and scan evidence and
returns no published claim. `admitGeneratedDeploymentAttempt` then reconstructs
that entire lineage and accepts only one externally produced canonical
attempt-only receipt bound to the exact two-file generated inventory.
`verifyGeneratedPublicationReadback` invokes the sole production verifier over
the sorted static-plus-generated closure, independently revalidates its result,
and persists only the readback scan and receipt. `finalizeSitePublication`
reruns current publisher authority, reconstructs all candidates byte-for-byte,
reverifies every parent and scan, persists a lexicographic create-only claim
prefix, and writes the scanned final commit receipt last. Partial prefixes are
inert and exact-restart resumable. No local operation grants campaign credit.
Stored projection bytes, caller counters, caller verdicts or authorization
decisions, reused/interrupted/failed preparation operations, omitted or stale
release parents, authority drift, unsafe bytes, mutable pointers, and
compatibility inputs are rejected. See
`docs/architecture/vnext-campaign-release-surface.md`.

`tinyrustlm/tools/vnext-public-https-readback.js` defines the sole
production-network verifier invoked by the release-surface readback operation.
Its frozen profile has SHA-256
`a5d5fd2bcc08e1444f82c474e1c829ba8e108c53a0e52b0651cab1843d8edb73`.
It accepts no caller resolver, transport, response, body, verdict, retry
policy, or alternate profile. It requires one canonical public HTTPS root,
rejects any nonpublic DNS result, pins one address for the complete inventory,
uses normal system trust and hostname verification, forbids redirects and
encoded or transferred variants, verifies exact status, length, media type,
cache and security headers, and streams every body to the manifest byte count
and SHA-256. It also rejects model-byte routes, stable immutable paths, and
invalid bootstrap or worker policy before DNS. Its canonical result discloses
only bounded observation metadata
and domain-separated DNS, pinned-address, and certificate identities. The
module writes no receipt and does not establish deployment success,
outside-network independence, publication, or campaign credit. See
`docs/architecture/vnext-public-https-readback.md`.

`tinyrustlm/tools/vnext-site-publication.js` is the pure forward-only
materializer after static readback. Its frozen profile SHA-256 is
`d959ce557e8b18a71514e2388a8eda7162182e38f5febf2e1a39b063fa5ba4bc`.
It requires the exact release, all approved claims, exact static-readback
receipt, bound generator, and either no history or canonical history from this
one current profile. One structurally exact `site-synchronization` plan receipt
and one release-bound `site-publisher` signature deterministically produce
canonical pointer/history candidates and direct `published` claim descendants.
It rejects the superseded ledger schema rather than reading or upgrading it.
The module has no network, clock, persistence, signing, or mutation capability;
all outputs remain explicitly unpersisted and `not-published` until the sole
release surface admits an exact generated-deployment attempt, performs complete
production readback, and admits final descendants. The surface owns plan
persistence, current site-publisher authority, candidate redaction, generated
deployment/readback admission, restart-safe claim persistence, and the final
publication commit. See
`docs/architecture/vnext-site-publication.md`.

The authority result deliberately separates `signatureVerified`,
`authorityAtIssue`, `temporalCurrent`, and `currentEvidenceEligible`. A valid
historical Ed25519 signature is not current evidence when its envelope is
expired, its terminal key is retired or revoked, its registry is not current,
or compromise history makes it stale. `authorityGraphVerified` means the
provided bounded graph was reconstructed and its signatures were processed;
callers must use `currentEvidenceEligible` for current evidence admission.
The offline verifier additionally requires a current terminal registry and
current eligibility for every declared target signature. Expired governance
envelopes may authenticate immutable history but cannot become target-current
evidence.

The frozen offline profile is 3,625 bytes with SHA-256
`2b14f8e2d4d176e020d2c3e89d05dda07acc933bc76df6044ddd5b4e7d751756`.
The manifest excludes its verification receipt to avoid a manifest/receipt
hash cycle; the receipt is finalized afterward and binds the manifest hash and
complete member set. `docs/architecture/vnext-offline-verification-bundle.md`
defines the exact boundary.

This remains an incomplete campaign implementation checkpoint. Exact
campaign-plan finalization, semantic currentness, the Ed25519 primitive, the
complete signature authority graph, offline-bundle closure, truthful
projection, and projection-result validation have independent Rust parity.
Exact plan/projection-result persistence is implemented, and one generated
real-browser WASM boundary exposes plan, currentness, projection, and result
validation with exact frozen-corpus parity. One bounded local runner now
performs exact cross-store snapshots, Rust-backed projection, immutable
operation history, interruption recovery, and concurrent-operation exclusion.
The superseded mutable runner and its test are deleted without an alias or
compatibility entry point. One fresh-runner-bound immutable final-attestation
and operator-status surface now also prepares a create-only, public-safe,
explicitly unauthorized `release_manifest.v3` from complete fresh campaign
truth and exact current snapshot inputs. It requires one current-pass web-build
receipt over the public origin, changelog, deployment manifest,
security-header profile, publication generator, and exact static inventory.
The manifest binds closed path/hash/size/type/cache/header metadata, excludes
model-byte routes, and permits `immutable` caching only when the path contains
the full content SHA-256. Generated pointer and history bytes are forward-only
site-publisher descendants because embedding bytes that name the manifest
inside that same manifest would be self-referential. The same surface now
verifies and
create-only persists a current Ed25519 release-authorizer signature as the
manifest's forward-only child without mutating the manifest. It now also
admits a create-only, explicitly non-success deployment-attempt descendant.
The standalone production-only exact HTTPS verifier is now integrated through
one immutable release-surface receipt operation. Its tests include only
fixture-labeled orchestration evidence; no production invocation is claimed.
Deterministic pointer/history and published-claim candidate materialization is
implemented as a pure module and integrated behind create-only plan evidence
and current site-publisher authority. Generated-file deployment admission,
complete readback, restart-safe descendant persistence, and final publication
admission are integrated into that same surface. The incompatible source
cutover deletes the superseded mutable publication implementation, dedicated
tests, aliases, snapshots, schemas, and maintained documentation without a
compatibility path. This remains local conformance evidence, not a production
readback, outside-network observation, or live campaign result.
Runtime tests generate ephemeral private keys only in process memory.
Checked-in profiles and vectors contain public material only.

## Completion Boundary

The registry freezes design and is not itself implementation evidence. The
separately identified local SLM2 parser/writer/vector/fuzz checkpoint above
proves only its bounded format-conformance scope; it does not prove conversion,
runtime correctness, browser support, model quality, or production admission.
The browser worker, companion, P2P fleet, observer, release system, and claim
renderer still require their corresponding phase tests and objective receipts.
No campaign counter is earned by this registry or the local SLM2 checkpoint.
