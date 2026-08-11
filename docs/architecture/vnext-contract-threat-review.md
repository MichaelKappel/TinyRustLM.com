# TinyRustLM vNext Contract Boundary Threat Review

## Decision

**Review result: PASS for the Phase 2 schema-and-local-invariant boundary only.**

This decision means the frozen registry, two validator implementations, and
the deterministic hostile corpus form a coherent clean-slate validation
checkpoint. It does not authorize a production cutover, a signed evidence
claim, a release, a model qualification, a browser campaign round, a live
MemoryEndpoints continuity result, an outside-network P2P proof, or a catalog
announcement.

### Current Phase 3 Addendum

The Phase 2 boundary decision above is refreshed whenever one of its bound
inputs changes; prior review text remains available in Git history, not as a
second accepted runtime contract. Later Phase 3 checkpoints now independently
implement RFC 8785/JCS identity, receipt DAG
parent loading and semantic currentness, Ed25519 verification, the trusted
authority graph, offline-bundle closure, bounded secret/redaction scanning,
truthful campaign projection, and projection-result validation in Node and
Rust as documented by the current architecture inventory.

One generated `tinyrustlm.vnext.campaign-evidence-wasm.v1` boundary now exposes
exact plan finalization, currentness, projection, and result validation from
Rust to Node and browser/WASM callers. Its JavaScript is byte transport and
stage sequencing only. The zero-import module has exact frozen exports, bounded
allocation ownership, destructive stage behavior, frozen-corpus parity, and
two independently created and physically deleted Chromium-profile checks with
zero network requests. The superseded plan-only ABI is deleted.

One frozen `tinyrustlm.vnext.subject-store.v1` boundary now provides bounded,
create-only host persistence for the five public-safe non-receipt identity
schemas. It rejects private context and receipt records, validates canonical
identity before publication and on every read, uses the shared no-follow and
same-directory atomic-create mechanics, and quarantines invalid, unaccepted,
misaddressed, or interrupted entries. Stored subjects are immutable input
history, not currentness decisions.

One frozen `tinyrustlm.vnext.directory-flush.v1` Rust boundary now closes the
raw Win32 API-access gap without changing Node store truth. It accepts only one
bounded stdin request, validates an absolute owned root plus strict relative
directory, rejects symbolic-link and reparse components, opens the directory
with write access plus backup and open-reparse-point flags, and emits no raw
path or host error. Caller-held stable path-topology ownership is an explicit
precondition because stable Rust 1.96 cannot expose a Windows file-index
identity through this boundary. The current Windows host completed the exact
flush call and rejected a real junction. The sole Node client additionally
binds its profile and source closure, the helper package/source/executable,
platform, request, and canonical observation; invokes with no shell, arguments,
or inherited environment; and rejects package links, malformed or ambiguous
manifests, process-output abuse, substitution, and before/after package drift.
Node does not provide an OS network sandbox, and a self-described package trust
class is not signed provenance. This remains local API evidence only:
create-only publication receipt integration, crash recovery, power
interruption, and filesystem/device durability remain unproven.

One frozen `tinyrustlm.vnext.campaign-runner.v1` boundary now performs two
complete exact observations of every active campaign receipt and public
subject, rejects cross-observation drift, binds caller pins and trusted time,
and invokes only the generated Rust campaign-evidence ABI. Runner-owned
content-addressed start and terminal records are explicitly not receipts,
claims, or currentness pointers. Append-only generation claims and
identity-bound releases avoid stale-lock check-delete-create races while
retaining dead-process recovery. Child-process interruption tests, restart
reprojection, disk-full tests, and exact 271-receipt/40-subject synthetic capacity are bound in
`docs/architecture/vnext-campaign-runner.md`.

The clean-slate r5 registry also replaces the cyclic release/claim pair before
production use. `release_manifest.v3` is a prepublication predicate over one
exact campaign plan, one exact projection, final attestation, artifacts,
packages, approved claims, SBOM, provenance, changelog, explicit remaining
risks, one current web-build receipt, exact web control-document hashes, and a
closed static publication graph. Immutable cache entries require their full
content SHA-256 in the public path. The manifest contains no authorization or
postpublication receipt pointer and does not attempt to hash its own wire or
generated pointer bytes that must name its identity.
`claim.v2` adds an evidence-backed `approved-for-publication` state whose
`releaseManifestId` is null. A release-authorizer signature, deployment
readbacks, and published-claim descendants point forward to the finalized
release. No finalized content-addressed object points back to one of those
descendants.

These later local facts close the named cross-runtime implementation gaps and
the maintained release-entry-point cutover only. They do not close
archive-member scanning, protected production secret-list custody, authorized
live MemoryEndpoints continuity, independent outside-network lane proofs,
catalog publication, or a real production HTTPS readback. The
production verifier rejects nonpublic DNS results, pins one public address,
verifies normal TLS identity, and streams the exact closed inventory. The sole
release surface now reconstructs deployment and authorization, invokes that
verifier, independently validates its canonical result, and persists an exact
scan/readback pair. It then reconstructs that static-readback closure,
persists one redacted publication plan, verifies one exact current
site-publisher Ed25519 authority graph, and scans every deterministic generated
control and published-claim candidate without prematurely persisting them. The
same surface admits a closed attempt-only generated-deployment receipt, invokes
the verifier over the exact static-plus-generated graph, independently validates
the complete readback, and persists claims only as an inert restartable prefix
before one final commit receipt. Its integration test uses only fixture-labeled
output and has not been used to claim a live pass. No local test changes a
campaign counter.

Reviewed at `2026-08-11T19:10:29Z`. The review is invalidated when any bound
file changes, when the parser changes, or when a deferred proof obligation is
reclassified without a new threat review.

## Bound Inputs

| Role | Path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Frozen registry | `contracts/vnext/contract-family.v1.json` | 40,674 | `dd1534f577f5468f94d4b3b4d7d8985751fd1ddc4a28a2ccee9f47462449bbf0` |
| Language-neutral corpus | `contracts/vnext/contract-corpus.v1.json` | 195,068 | `2c86c7da67d419b140f5de8b9d297707a6e47245a338db6dd9bcca55de912044` |
| Registry interpreter | `tinyrustlm/tools/vnext-contract-validator-registry.js` | 33,567 | `120927546862720fe2faafb7d0e0bc5520d110f20115b50f8f9cf2eba715e413` |
| Independent validator | `tinyrustlm/tools/vnext-contract-validator-independent.js` | 46,820 | `758b42e3b5e25bfb5e58d6a06056b1760cc8527cdcc82ea90838f0330094412f` |
| Corpus generator | `tinyrustlm/tools/vnext-contract-corpus-generator.js` | 24,303 | `835d3a65bd0cae9adc1618d2f40802390643d04d60a0d3287e01d3665860a986` |
| Differential tests | `tinyrustlm/tests/vnext-contract-validator-conformance.test.js` | 10,585 | `78795d573153d56fd1fd4438e8e317d600d61bda477998ef592bf7b2fe28d9e5` |

Validator identities are
`tinyrustlm.vnext.registry-schema-validator.v1` and
`tinyrustlm.vnext.independent-schema-validator.v1`. The corpus binds the
registry and normalized generator source hashes. It contains 82 exact raw-byte
cases: 14 accept cases and 68 reject cases. Both validators execute every case,
for 164 differential verdicts. The web-specific rejects cover active/retired
path collision, total drift, missing bootstrap, generated-pointer role drift,
model-byte routes, security-header drift, service-worker policy mismatch, and
stable paths mislabeled as immutable.

The current clean-slate registry family is
`tinyrustlm-vnext-2026-08-09-r5`. Before any authorized production record, it
admits only the acyclic `release_manifest.v3` and `claim.v2` pair. It
retains the receipt cardinalities required for complete offline campaign
closure: 2,048 `inputReceiptIds` and 1,024
`offlineBundle.signatureEnvelopeReceiptIds`. The independent validator carries
the same schemas and limits, the generated hostile corpus is rebound to the
new registry bytes, and the complete synthetic campaign test verifies 271
receipt parents and 155 target signatures. The product retains no reader for
the replaced registry or v1 release/claim schemas.

The first proof schema was replaced before production because it embedded a
signature-envelope ID while that envelope signed the proof ID. Those two
content-addressed objects formed an unresolvable cycle. The sole accepted proof
schema is now `tinyrustlm.vnext.outside_proof.v2`; it contains no signature
pointer, and a separately verified signature receipt becomes its descendant.
The old schema is rejected rather than aliased or migrated.

## Security Objective

Before semantic or cryptographic promotion, an untrusted vNext JSON input must
be accepted only when all of these conditions hold:

1. The raw input is valid bounded UTF-8 JSON under `tinyrustlm.strict-json.v1`.
2. Its top-level schema is one of the nine exact frozen vNext identifiers.
3. Every object has exactly its required fields and no unknown fields.
4. Every primitive, enum, cardinality, ordering rule, URL, path, and byte limit
   is valid.
5. Every local semantic invariant applicable to that record is satisfied.
6. The registry interpreter reports every declared invariant as checked, not
   applicable, or deferred, with no overlap and no omitted invariant.
7. Validation never repairs, coerces, defaults, upgrades, downgrades, aliases,
   retries, or rewrites the candidate input.

This checkpoint treats parsed values as untrusted even after schema acceptance.
An accepted value is not trustworthy evidence until its deferred identity,
signature, authority, DAG, redaction, and external-observation obligations are
verified by later phases.

## Trust Boundaries

| Boundary | Untrusted input | Phase 2 authority | Remaining authority |
| --- | --- | --- | --- |
| Raw bytes to JSON | Files, browser messages, loopback bodies, peer metadata, service replies | Bounded fatal UTF-8 and duplicate-aware strict parser | Rust and browser parity plus entry-point cutover |
| JSON to exact contract | Parsed object and claimed schema | Closed registry interpreter and separately written validator | Cross-language validator parity |
| Contract to local semantics | Structurally valid record | Per-class local invariant checks | Cross-record and external-state verification |
| Content to identity | Claimed hash and content ID | Field shape and declared derivation profile | RFC 8785 JCS and domain-separated hash recomputation |
| Signature to authority | Envelope, key, role, time, registry, revocation | Local shape, role/domain, and time-window checks | Ed25519 verification and trusted registry chain |
| Receipt to evidence DAG | Parent IDs and evidence references | Local sorting, uniqueness, state, and typed payload checks | Parent loading, closure, cycle, role, and freshness checks |
| Private to public evidence | Public-safe record, canonical public text, and redaction profile | Closed public schema, canonical LF UTF-8 text, and forbidden value classes | The later Node checkpoint performs exact document/text scans and receipt replay; Rust/browser parity, protected-list release integration, and bounded archive-member scanning remain |
| Local P2P to public claim | Manifest, lane proof, claim wording | Local identity, route, transfer, state, and expiry checks | Outside observer signature, full transfer, and publication authority |

## Threat Analysis

| Threat | Control in this checkpoint | Result | Residual risk or later gate |
| --- | --- | --- | --- |
| Duplicate-key ambiguity | Strict parser rejects literal, escaped-equivalent, and supplementary-equivalent duplicates before object creation | Mitigated locally | Every production entry point must use the same parser profile |
| Malformed or disguised text | Fatal UTF-8, BOM rejection, scalar checks, bounded text and string rules | Mitigated locally | Rust/browser parity was outside this Phase 2 checkpoint; the current addendum records later bounded parity |
| Parser exhaustion | Byte, depth, entry, member, array, string, aggregate-string, and number-character limits | Mitigated locally | Wall-clock and allocation ceilings require measured native/browser tests |
| Numeric identity drift | Unsafe integers, negative zero, overflow, underflow, and floats are rejected where unsupported | Mitigated locally | Cross-language RFC 8785 serialization remains deferred |
| Schema confusion or downgrade | Only the nine exact registry-listed schemas are accepted, including proof v2, release v3, and claim v2, with no reader for their replaced forms | Mitigated locally and at the maintained release cutover | Later product-phase entry points must pass their own incompatible cutover gates |
| Proof/signature identity cycle | Proof v2 has no envelope-ID field; the signature receipt points one way to the finalized proof | Mitigated by incompatible replacement | Signature-descendant existence and authority remain deferred |
| Unknown-field smuggling | Root and every nested object are closed; property tests inject unknown fields at every reachable object depth | Mitigated locally | New fields require a new frozen registry and review |
| Missing-field defaulting | Every declared field is required; property tests delete every root field | Mitigated locally | Nested required-field deletion is covered by exact descriptors and corpus examples, not exhaustive combinatorics |
| Validator common-mode error | One implementation interprets the registry; the other hard-codes separately written schema logic and cannot read the registry | Reduced | Both use the same strict parser and JavaScript runtime, so parser/runtime common-mode risk remains |
| Easy-corpus selection | Corpus is deterministic, checked in, and content-bound to registry and generator hashes | Mitigated for the checkpoint | Independent sealed audit cases remain required for promotion claims |
| Conditional-invariant inflation | Results partition invariants into checked, not applicable, and deferred sets | Mitigated locally | Callers must reject any use that requires a deferred invariant |
| Artifact/profile substitution | Artifact class must match the frozen SLM, specialist, template, or tokenizer profile | Mitigated locally | Complete artifact hashing and dependency existence remain later concerns |
| Receipt subtype confusion | Exactly one typed security payload may appear and it must match `receiptType`; security receipts require pass status | Mitigated locally | Signature, registry, revocation, and offline closure remain deferred |
| Context authority injection | Exactly one current authoritative user segment and one authoritative product-policy segment are required; memory, quotes, retrieval, summaries, and tool output cannot be authoritative | Mitigated locally | Model behavior under compiled context requires runtime evaluation |
| Worker or companion state confusion | Direction, operation, payload binding, pairing, session, sequence, and capability constraints are explicit | Mitigated locally | Replay store, process isolation, browser origin, and loopback authentication remain later gates |
| P2P piece or Merkle drift | Piece indices, offsets, sizes, hashes, Merkle root, total bytes, and artifact identity are recomputed locally | Mitigated locally | File streaming, peer transfer, and final Rust artifact verification remain later gates |
| Local reachability promoted as public | Proof requires outside-network scope, complete transfer, lane and endpoint binding, and bounded freshness | Mitigated structurally | Observer signature, independence, and matching P2P parent remain deferred |
| Release or claim inflation | Acyclic release v3 binds the campaign plan/projection, attestation, packages, artifacts, approved claims, SBOM, provenance, changelog, remaining risks, current web build, exact control documents, and the closed static publication graph; the sole release surface requires complete fresh projection truth, same-snapshot parent identity, current-pass receipt closure, all 20 qualified artifact hashes, dependency closure, one CycloneDX SBOM, all current approved claims, exact static bytes, current release and site-publisher authority, admitted static and generated deployment attempts, exact static and combined readbacks, and one redacted plan before it can persist an exact claim prefix and final commit receipt | Mitigated for the local admission path and maintained source cutover | A real authorized production run remains required |
| Local or injected response promoted as production readback | The standalone production verifier owns DNS and HTTPS, accepts no caller transport or response, rejects any nonpublic DNS member, pins one globally routable address, requires normal TLS hostname authorization, forbids redirects and transformed bodies, and streams every exact manifest asset; the release surface invokes it internally, independently validates canonical result closure, and persists only scan/readback descendants in exact dependency order | Mitigated locally | Fixture-labeled orchestration tests are not production execution, host resolver and process integrity remain trusted, and a real production run remains required |
| DNS rebinding or split-address substitution | One bounded all-address lookup must contain only canonical public addresses; one successful bootstrap address is pinned through verifier-owned lookup callbacks and checked against every connected socket | Mitigated locally | Host resolver and process integrity remain trusted; this is not an outside-network observer proof |
| Secret disclosure through public evidence | Private-by-default classes, public-safe field types, canonical LF UTF-8 public text, allowlisted canonical publication controls, redaction profile, forbidden keys/value classes, acyclic scan binding, and release-surface scans over selected documents, changelog, manifests, plan material, signatures, controls, deployment/readback receipts, claim candidates, and the final publication receipt | Reduced | Compressed members, cross-runtime detector parity, and protected-list production custody remain deferred |
| Compatibility code becoming permanent | Validators recognize one incompatible family; the maintained release cutover deletes the replaced readers, writers, mutable aliases, snapshots, schemas, dedicated tests, and stale documentation, and negative conformance forbids their return | Mitigated for the release path | Every later product-phase cutover must apply the same deletion rule |

## Validator Independence

The registry validator loads the frozen registry and applies a generic closed
descriptor interpreter followed by class-specific local invariants. The
independent validator does not import the registry validator, read the registry
file, or use filesystem access. It carries separately written exact schemas and
local rules. They share only `strict-json.js`, Node primitives, and test input.

This is sufficient to detect many registry-interpreter and hand-coded-schema
mistakes. It is not implementation diversity across languages or runtimes. A
defect in the shared parser, JavaScript semantics, corpus generator, or expected
verdict selection could affect both. Phase 3 must add canonical identity and
receipt verification; later runtime phases must add Rust and browser/WASM
conformance against the same raw corpus.

## Corpus Coverage

The checked-in corpus covers all nine accepted contract classes and parser-only
rejections. It includes valid artifact, receipt security subtypes, context,
worker, companion, P2P, proof, release, and claim records. Hostile cases cover
unknown and missing fields, the rejected cyclic proof signature field, dated
or unknown schemas, duplicate keys, malformed
UTF-8, BOMs, unsafe numbers, trailing content, excessive nesting, semantic
state drift, invalid routes and URLs, authority mistakes, worker/companion
state mistakes, P2P piece and Merkle drift, proof expiry, release backreferences,
claim approval without evidence, and publication without a release identity.

Property checks reverse arbitrary object-key order, delete every root required
field, and inject an unknown field at every reachable object depth. Corpus
acceptance is not evidence that cryptographic material is genuine, a referenced
parent exists, a network observer is independent, a model is useful, or a site
was published.

## Deferred Proof Obligations

The following are explicitly outside the Phase 2 pass:

- Full RFC 8785/JCS cross-language vectors and canonical-byte agreement.
- Domain-separated identity and canonical-content hash recomputation at every
  signed or content-addressed entry point.
- Ed25519 verification, trusted key registry selection, role/campaign scope,
  authority-registry chain validation, revocation chain validation, and
  historical-time evaluation.
- Receipt DAG parent loading, cycle rejection, complete closure, parent-role
  constraints, phase invalidation, freshness, and offline-bundle closure.
- Execution of bounded compressed archive-member scanning and verification of
  archive-specific acyclic scan evidence. Bounded document/text scanning and
  seven encoded known-secret representations are implemented in Node.
- Streaming validation of actual large artifacts, P2P transfers, and final
  artifact reconstruction.
- Rust, browser/WASM, worker, service worker, and companion implementations of
  the frozen contracts.
- Continued negative conformance proving that removed release paths and dated
  schemas do not return to maintained source, commands, configuration, or
  documentation.
- Real model qualification, live browser deletion receipts, authorized live
  MemoryEndpoints continuity, independent outside-network lane proofs, catalog
  announcements, package publication, and public HTTPS release readback.

Any caller needing one of these properties must fail closed until the specific
later-phase verifier returns objective evidence. A deferred invariant is never
a warning-level pass.

Later Phase 3 work now includes canonical identity finalization, public-key
Ed25519 payload verification, a bounded trusted authority graph, exact
offline-bundle membership and receipt-parent closure, bounded public-safe
redaction, independent Rust parity, the generated browser/WASM campaign
evidence boundary, and the bounded public subject store summarized above. The
redaction boundary validates finalized
bytes, rejects private schemas, scans seven bounded known-secret encoding
families and contextual forbidden values, emits no secret values, and replays
a one-way scan receipt against the protected equality list. The offline profile
binds current schema/profile hashes, including the redaction profile, a
separate acyclic verification receipt, external
root/terminal/campaign/environment/hash pins, current target signatures, and
all supplied receipt and subject bytes without network access. That work is
outside this Phase 2 PASS. It does not close compressed archive-member
scanning, independent observer operation, or any campaign gate.

The redaction checkpoint also admits canonical public text only as fatal UTF-8,
without BOM, CR, disallowed controls, or a missing terminal LF. It derives a
domain-separated text identity, applies the same known-secret, contextual
pattern, and entropy rules, emits unchanged bytes only on pass, and requires an
explicit `document` or `public-text` kind during receipt replay.

The campaign release-surface checkpoint removes stored dashboard and caller
truth from the vNext attestation boundary. A release-surface operation ID must
be absent from rebuilt runner history; interrupted, failed, completed, copied,
and caller-materialized operations cannot be promoted. The surface creates and
consumes the runner result inside one call, validates the exact plan,
projection, campaign, environment, trusted time, start/terminal records, and
receipt snapshot, then scans finalized attestation bytes before create-only
persistence. A failed protected-equality scan persists only the public-safe
scan receipt and returns no unsafe attestation bytes. Its operator projection
is derived from the same result and deliberately has no `done` state. The same
surface now prepares a scanned, create-only `release_manifest.v3` only from a
complete fresh projection and exact current snapshot parents, while returning
an explicit `not-authorized` state. Preparation additionally requires one
current-pass build receipt that binds the source revision, public origin,
changelog, deployment manifest, security-header profile, publication
generator, and exact static-asset inventory. Paths are closed and disjoint,
active model-byte routes are forbidden, and immutable caching requires the
full asset digest in the route. Generated pointer and history bytes are bound
only by forward site-publisher descendants, avoiding a content-addressed
self-reference. Its authorization operation reconstructs
the original runner records, projection, snapshot membership, selected release
evidence, and preparation scans; rejects any post-preparation drift; and
admits only one canonical finite-lived `release-authorizer` signature child
that is current-evidence eligible under the caller-pinned vNext authority
graph. It scans and persists the authorization redaction receipt before the
create-only signature receipt, supports only byte-identical idempotent replay,
and never adds an authorization back-reference to the manifest. Deployment
admission and exact HTTPS readback are now forward-only operations on that
closure. A separate pure module now validates the publication plan and
deterministically materializes pointer/history and published-claim candidates
  from one release-bound site-publisher signature. It has no network, clock,
  persistence, or source mutation and rejects the old ledger schema. The sole
  release surface now owns current authority-graph verification,
  generated-deployment admission, complete readback, restart-safe claim-prefix
  persistence, and final descendant admission. No real production readback has
  been asserted.

## No-Compatibility Decision

The new validator boundary has no old schema aliases, migration adapters,
best-effort field mapping, permissive version range, dual readers, dual
writers, repair path, or fallback parser. Unknown and dated schemas fail.
Superseded production paths are not retained for user compatibility because
the product is pre-public dogfood. The maintained release paths, aliases,
snapshots, schemas, dedicated tests, and stale documentation are deleted after
replacement verification. Hash-addressed historical receipts remain inert
evidence and have no admission edge into the current contracts.

## Verification Evidence

At review time:

- The cutover, pure publication, and standalone HTTPS closure passed 20/20 in
  271.460 milliseconds.
- The complete release-surface suite passed 23/23 in 679.865 seconds,
  including honest zero, synthetic capacity, authority and byte drift,
  generated readback, every claim-prefix interruption, and final commit
  ordering.
- The complete post-deletion `npm run test:unit` run passed 848/848 with zero
  failures, skips, cancellations, or todos in 712.681 seconds. The physically
  removed dedicated tests are absent from the glob; four new negative cutover
  tests prove path absence, maintained-reference absence, sole vNext routing,
  and exact preservation of inert historical receipts.
- All six deterministic vNext generators reproduced checked-in bytes without
  changing the worktree status.
- `cargo fmt --all --check`, denied-warning all-target workspace Clippy, and
  the complete locked Rust workspace tests passed. The Rust test run completed
  in 49.2 seconds.
- Both validators produced the expected verdict for all 82 corpus records in
  the complete unit suite, including source independence, corpus regeneration
  identity, invariant partitioning, object-key order independence, required
  root fields, and nested unknown-field rejection.

The full run includes the final invariant-report classification, threat review,
and all focused contract tests. The later cross-language and browser boundaries
are documented in the current addendum, but no test result substitutes for an
independent production operation or campaign evidence.

## Exit Decision

Phase 2 closed after the bound hashes, this review, focused tests, complete unit
suite, source hygiene, secret scan, and remote push were current in one
checkpoint. The incompatible maintained release cutover is complete without an
alias or compatibility entry point. Final attestation, operator projection,
release v3 preparation, current release and site-publisher authorization,
deployment admission, exact readback, and publication descendants bind only a
fresh sole-runner result. The current next boundary is a real production run
over an exact authorized release graph. Local authority and fixture readback
coverage do not by themselves establish publication.
The Rust/Win32 directory-flush primitive is implemented, but publication
receipt integration and physical durability evidence remain prerequisites.
Archive-member scanning and protected-list release custody also remain open.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
