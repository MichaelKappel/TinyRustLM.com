# vNext Campaign Release Surface

## Status

`tinyrustlm.vnext.campaign-release-surface.v1` is the sole vNext boundary for
turning a freshly executed campaign projection into immutable prepublication
attestation evidence, an operator status view, and a create-only
`release_manifest.v3` candidate, verifying its current release-authorizer
signature, admitting narrowly scoped static and generated deployment attempts,
performing exact static and complete static-plus-generated production HTTPS
readback, and admitting create-only publication descendants through one final
commit receipt. Its frozen profile is
`contracts/vnext/campaign-release-surface-profile.v1.json`, with SHA-256
`41c8c23b995c71fc16d2fc677cbdd28967de65f7c15e926b82f9e9cbb82c8913`.

This checkpoint implements fresh projection, final attestation, public-safe
redaction, truthful operator status, release-manifest preparation, current
Ed25519 release-authorizer verification, immutable deployment-attempt
admission, exact static and combined production HTTPS readback admission,
deterministic site-publication plan persistence, current Ed25519 site-publisher
authority, redacted pointer/history/published-claim materialization,
generated-deployment admission, create-only published-claim persistence, and
final publication admission. The incompatible repository cutover makes this
the sole maintained release and publication entry point. A real authorized
production run remains required before any production publication claim.
A prepared manifest is explicitly
`not-authorized`; an authorized manifest is only
`release-authorized-awaiting-deployment`. Neither state is a deployment,
public-readback result, publication, or live campaign count.

## One-Way Evidence Graph

The implemented graph is acyclic:

```text
campaign plan + current receipt/subject stores
  -> runner start record
  -> exact Rust-backed projection artifact
  -> runner completed record
  -> final-attestation receipt
  -> redaction-scan receipt
  -> operator status bytes (derived view, never currentness authority)
  -> exact current release inputs from the same runner snapshots
  -> current web-build receipt and exact static-asset inventory
  -> changelog and web-control-document redaction-scan receipts
  -> release_manifest.v3 candidate
  -> release-manifest redaction-scan receipt
```

The implemented authorization and publication edges continue
forward from the prepared manifest:

```text
release_manifest.v3
  -> authorization redaction-scan receipt
  -> current release-authorizer signature receipt [implemented]
  -> deployment-attempt redaction-scan receipt [implemented]
  -> deployment-attempt receipt [implemented; explicitly not success proof]
  -> exact production HTTPS readback redaction-scan receipt [implemented]
  -> exact production HTTPS readback receipt [implemented operation; no live receipt]
  -> publication-plan material/history redaction-scan receipts [implemented]
  -> site-synchronization plan receipt [implemented]
  -> current site-publisher signature redaction and signature receipts [implemented]
  -> generated pointer/history and published-claim candidate scans [implemented]
  -> generated-deployment attempt scan and receipt [implemented; not success proof]
  -> exact combined static-plus-generated HTTPS readback scan and receipt [implemented operation; no live receipt]
  -> final-publication receipt scan [implemented]
  -> create-only published claim.v2 prefix [implemented; inert before final receipt]
  -> final site-publication commit receipt [implemented; no live receipt]
```

The release manifest cannot list authorization, deployment, readback, or
published-claim descendants. An approved claim has a null release identity.
A published claim points forward to the finalized release. These directions
remove the release/claim and release/authorization cycles rejected during the
r5 contract checkpoint.

## Fresh Truth Boundary

`bootstrapVnextCampaignReleaseRuntime` consumes canonical public trust bytes,
loads one signed custody revision from fixed inherited non-file pipe descriptor
3, and returns a closure-bound `createCampaignReleaseSurface` function. The
module exports no direct surface factory and the public custody facade exports
no constructor. `attestCampaign` accepts only plan, campaign, environment,
authority, trusted-time, operation, and source-revision inputs. It rejects
unknown fields and accessors before any operation. In particular, it has no
input field for:

- projection bytes or a projection hash;
- dashboard counters;
- a complete or passed boolean;
- a caller-selected receipt subset;
- a stored current pointer;
- a repaired response or best-of-N result.

The operation ID must be absent from reconstructed runner history. Completed,
failed, and interrupted operations are rejected rather than promoted or
resumed by the release surface. The runner then snapshots every active receipt
and public subject twice, invokes the generated Rust/WASM evidence ABI, validates
the result through Rust, and persists immutable start, projection, and terminal
records. The surface independently validates the returned projection against
the exact stored plan and checks its campaign, environment, trusted time,
operation records, projection hash, and snapshot membership before attesting.

An interruption before attestation leaves only runner history. A later process
must use a new operation ID and obtain a new projection. Serialized or copied
projection bytes have no release-surface admission path.

`prepareRelease` uses the same internal execution and accepts an exact closed
extension containing product/version, sorted artifact, package, claim, and
remaining-risk identities, one SBOM identity, one provenance receipt identity,
canonical changelog bytes, one public origin, one current web-build receipt,
the exact deployment-manifest, security-header-profile, and
publication-generator bytes, a closed static-asset graph, the two generated
publication-file descriptors, a retired-path set, and an offline capability.
It accepts no release ID, release date, authorization verdict, publication
status, deployment result, readback result, or caller-computed artifact-set
digest. Release date and creation time derive only from the runner-bound
trusted verification time.

`authorizeRelease` is a separate closed operation over an already prepared
manifest. It accepts only the canonical authorization receipt bytes, canonical
changelog bytes, exact deployment-manifest, security-header-profile, and
publication-generator bytes, exact release-manifest ID, expected campaign and
environment, source revision, caller-pinned root and terminal authority
registries, and trusted verification time. The surface retains the one
module-issued protected equality-custody handle captured at construction. It has no caller
field for an authorization decision, status, deployment, publication, or live
counter. It reconstructs the preparation operation and all required evidence
from create-only storage instead of trusting a prepared-result object retained
in process memory.

`admitDeploymentAttempt` is a third closed operation over that stored,
currently authorized graph. It accepts canonical deployment-receipt bytes and
the same immutable control inputs needed to reconstruct preparation and
authorization. It has no deployed, succeeded, published, done, readback, or
counter input. A deployment executor may report only that it attempted to
submit the exact authorized static inventory; production response truth remains
the responsibility of the subsequent network operation.

`prepareSitePublication` is a closed operation over the exact stored static
readback closure. It accepts the stored identities and immutable control bytes
needed to reconstruct release preparation, authorization, deployment, and
readback, plus one fresh operation ID and either `null` or exact current-vNext
history bytes. It reconstructs all approved claims from the subject store,
creates deterministic plan material through the bound publication profile,
scans prior history, plan material, and final plan receipt, then create-only
persists those scans before one `site-synchronization` receipt. It accepts no
publication status, currentness verdict, counter, generated bytes, or caller
plan material.

`authorizeSitePublication` reconstructs that same closure and exact stored plan
receipt. It accepts one canonical site-publisher signature receipt and no
authorization or publication decision. The surface requires role
`site-publisher`, domain `tinyrustlm.signature.site-publisher.v1`, scope
`site-publication`, exact plan subject and release binding, finite unexpired
lifetime, and exactly one current-evidence-eligible signature under the
caller-pinned authority graph. It invokes the pure materializer only after
authority succeeds, scans the signature and every pointer, history, and
published-claim candidate, persists only the signature and scan descendants,
and returns defensive unpersisted candidate bytes with state
`site-publication-authorized-awaiting-generated-deployment` and publication
status `not-published-awaiting-generated-file-readback`.

`admitGeneratedDeploymentAttempt` accepts one externally produced canonical
attempt receipt only after reconstructing the exact plan, static readback,
publisher signature, authority graph, and deterministic generated inventory.
The receipt binds both generated assets, the release, plan, publisher
signature, generator and header profiles, origin, site, byte count, and a
bounded transcript digest. Its evidence scope is attempt-only and cannot claim
that production serves the bytes.

`verifyGeneratedPublicationReadback` rereads that attempt and invokes the same
non-injectable production HTTPS verifier over one sorted closure containing all
static assets and both generated controls. It independently validates every
canonical observation against the combined inventory and persists only a
redaction receipt followed by a generated-publication readback receipt. Its
result remains explicitly `not-published`.

`finalizeSitePublication` reruns current publisher authority, reconstructs every
stored parent, rematerializes pointer, history, and claims byte-for-byte, and
validates the complete readback receipt. It scans the final commit receipt,
create-only persists each already-scanned published claim, and writes the
`site-publication` receipt last. Published claims are admitted only when that
last receipt exists and binds their complete set, pointer, history, generated
inventory, and observation closure. No caller publication verdict is accepted.

## Final Attestation

The final-attestation receipt is a normal content-addressed
`tinyrustlm.vnext.receipt.v1` record. It binds:

- every active receipt ID in the fresh runner snapshot;
- the exact campaign plan and projection hashes;
- the release-surface, runner, and redaction profile hashes;
- the exact runner start and terminal record hashes;
- receipt and subject snapshot identities;
- the exact generated WASM module hash;
- the trusted verification time, source revision, campaign, and environment;
- all five current/target campaign counts derived from the projection.

A complete projection produces a `pass` attestation. Any incomplete projection
produces a `blocked` attestation with
`campaign-objectives-incomplete`; it never changes thresholds or turns missing
external evidence into a skip. A new attestation deterministically supersedes
all still-current attestation receipts for the same campaign while retaining
their immutable bytes and ancestry.

The attestation does not claim package verification, physical RID execution,
release authorization, deployment, public readback, or publication. Those are
separate descendants and remain required.

## Release Manifest Preparation

Preparation first creates the same fresh attestation described above and then
requires its projection to be complete. It rereads every release parent from
the exact receipt and subject snapshots captured by that runner operation. A
caller cannot inject a newer object, a stored object outside the snapshot, or a
replacement with the same label.

The preparation gate enforces all of these cross-document conditions before a
manifest is finalized:

- all 20 artifact hashes counted by the campaign's current qualification
  receipts have selected artifact manifests with the exact qualification IDs;
- every selected artifact dependency is also selected, every artifact binds
  the one selected current provenance receipt, and no artifact is dated after
  the trusted verification time;
- exactly one selected artifact is an unqualified `sbom` in
  `cyclonedx-json-1.6` format;
- the current `review` receipt in phase `release-provenance` and every current
  `package` receipt bind the domain-separated identity of the exact sorted
  artifact set and the exact source revision;
- phase invalidation classifies every selected package, provenance,
  qualification, and claim-evidence receipt as `current-pass`;
- claim supersession history is closed and acyclic, and each current
  site/route/component/wording-class key has one head;
- the selected claim list equals every current
  `approved-for-publication` claim for the source revision, with no omitted or
  extra claim;
- each selected claim's subject exists in the same snapshot, all evidence is
  current-pass, effective and verification times are not in the future, and
  expiry and review deadlines remain strictly future;
- the canonical LF UTF-8 changelog, every selected public document, the
  deployment manifest, security-header profile, publication generator, and
  finalized manifest all pass the protected public-safe scan;
- one current-pass `build` receipt in phase `web-build` binds the source
  revision, product, public origin, changelog, all three control documents,
  and the domain-separated identity of the exact static-asset inventory;
- public origin is canonical public HTTPS with no credentials, query,
  fragment, loopback, private IPv4, private IPv6, or local hostname;
- static and generated paths are sorted, unique, mutually disjoint, and
  disjoint from the retired-path set; exactly one `/` HTML bootstrap is
  `no-store`, and the two generated descriptors are exactly the `no-store`
  current pointer and release history paths;
- every static asset binds path, role, positive byte length, SHA-256, content
  type, cache policy, and the exact global security-header profile; every
  `immutable` asset path contains its full content SHA-256, while stable paths
  use revalidation or no-store;
- active routes cannot expose `.slm`, GGUF, SafeTensors, ACG, or `/models/`
  bytes; and
- `network-only` has no worker, while `service-worker-staged` names exactly
  one JavaScript `no-cache` worker asset.

The manifest binds the exact plan and freshly returned projection hashes, the
new pass attestation, selected artifacts/packages/claims, SBOM, provenance,
changelog hash, sorted risks, source revision, and trusted time. It contains no
authorization, deployment, readback, published-claim, or site-publisher
descendant. The result state is
`release-prepared-awaiting-authorization` and its authorization status is
`not-authorized`.

The manifest binds every pre-existing static response byte-for-byte and binds
the generation rules and response metadata for the current pointer and release
history. It deliberately does not contain its own final wire hash or the final
bytes of documents that must name that hash. Those self-references are
mathematically impossible. After authorization, the site publisher generates
those responses and its deployment/readback descendants bind the manifest,
authorization, generated bytes, response headers, and public HTTPS
observations in the forward direction.

## Release Authorization

Authorization begins by rereading the exact `release_manifest.v3` subject. The
surface then reconstructs and validates the complete preparation lineage:

- the pass final-attestation receipt and its exact profile, plan, projection,
  operation-record, and snapshot bindings;
- the completed runner history and stored Rust-backed projection;
- every release artifact, dependency, package, provenance receipt, approved
  claim, and claim-evidence receipt from the original runner snapshots;
- the attestation, changelog, three web-control-document, and release-manifest
  redaction receipts; and
- exact current receipt and subject store membership, allowing only the
  bounded authorization crash-recovery descendants described below.

The supplied signature receipt must be canonical
`tinyrustlm.vnext.receipt.v1` evidence with type and phase
`signature-envelope`, role `release-authorizer`, domain
`tinyrustlm.signature.release-authorizer.v1`, scope
`release-authorization`, and signed schema `release_manifest.v3`. Both its
signed subject and release ID must equal the prepared manifest ID. It must bind
the manifest's canonical-content hash, have a finite lifetime, be issued no
earlier than preparation and no later than the trusted verification time, and
remain unexpired at verification.

The surface reconstructs the full authority graph under the caller-pinned root
and expected terminal registry. Exactly one release-authorization signature
may target the manifest. That signature must verify cryptographically, have
authority at issue, be temporally current, remain current-evidence eligible,
and terminate in a current registry. Retired, revoked, compromised, expired,
wrong-role, wrong-scope, wrong-release, duplicate, or stale evidence fails
closed. A cryptographically valid historical signature is insufficient when
the current authority graph no longer admits it.

On success, the immutable derived result is
`tinyrustlm.vnext.release_authorization_result.v1` with state
`release-authorized-awaiting-deployment`. It binds the manifest, signature,
redaction receipt, authority root and terminal, signer, key, nonce hash, issue,
expiry, verification time, and source revision. It does not mutate the
prepared manifest and does not claim deployment, HTTPS readback, publication,
site-publisher approval, or campaign completion.

## Deployment Attempt Admission

Deployment admission reconstructs the complete prepared lineage again, reads
the already stored release-authorizer signature by identity, verifies its
original redaction receipt, and reruns the current authority graph at the new
trusted verification time. Expired, retired, revoked, replaced, or otherwise
noncurrent authorization cannot launch deployment merely because it passed at
an earlier instant.

The externally produced canonical `deployment` receipt must have phase and
type `deployment`, status `pass`, and execution class `deployment`. In this
receipt, `pass` means only that the bounded attempt record itself is valid. Its
mandatory `evidence-scope` is `deployment-attempt-only`; it cannot claim that a
remote server accepted bytes or serves them. The receipt must bind exactly:

- the current web-build receipt as its sole phase dependency;
- the campaign attestation through `attestationReference`;
- the release authorization through one exact receipt reference and public
  parameter;
- the release manifest canonical-content hash;
- the exact domain-separated web-asset inventory identity;
- the deployment-manifest, publication-generator, and security-header hashes;
- the same inventory as the attempted output;
- one bounded public-safe deployment-transcript digest;
- the authorized public HTTPS origin, asset count, and total bytes; and
- an attempt interval after authorization and no later than verification.

The operation rejects caller booleans, extra fields, fixture execution,
inventory drift, origin drift, missing or extra parents, and unrelated store
members. It scans the final canonical receipt before persistence. On pass, it
persists the scan first and the deployment receipt second, both create-only.
The result state is
`deployment-attempt-admitted-awaiting-public-readback`; its deployment status
is only `attempt-admitted` and its readback status is
`required-not-performed`. No deployed or published claim is valid yet.

## Public HTTPS Readback Admission

`verifyPublicReadback` accepts only identities and immutable control documents;
there is no caller field for DNS, transport, response metadata, response body,
verdict, retry selection, or readback result. Before network access it
reconstructs the prepared manifest, original runner snapshots, all preparation
scans, current release-authorizer signature and authority graph, deployment
scan, and the exact stored `deployment-attempt-only` receipt. The active stores
must be the exact deployment closure or one of the operation's two recoverable
dependency prefixes.

The surface invokes `performVnextPublicHttpsReadback` itself with the manifest's
public origin, closed static asset inventory, and exact security-header profile.
It then independently parses the returned canonical bytes and verifies the
frozen verifier profile and source hashes, origin, counts, total bytes, every
sorted observation, status, media type, cache value, security-profile hash,
TLS version, body hash, and domain-separated observation inventory. DNS,
pinned-address, and certificate values remain undisclosed and are represented
only by bounded counts and domain-separated identities.

The result receives a protected-equality scan before receipt construction. The
`public-readback` receipt binds the deployment receipt as its only phase parent,
plus the current authorization, release manifest, deployment receipt, static
inventory, control documents, verifier profile, complete result, observation
inventory, DNS set, pinned address, certificate set, and exact verified
inventory. The finalized receipt is scanned through the public-safe document
profile. Its redaction receipt is create-only persisted first and the readback
receipt second. Recovery accepts only the deployment closure, that closure plus
the exact deterministic scan receipt, or both exact descendants; all replayed
bytes must be identical.

A passing operation returns
`public-readback-verified-awaiting-publication`, `public-bytes-verified`, and
`not-published`. It does not create generated publication files, mutate the
release manifest, publish a claim, authorize a site publisher, increment a
campaign count, or prove observer independence. The conformance suite replaces
the verifier module only before loading the surface and labels those observations
as fixtures; they are orchestration evidence, never a production readback.

## Integrated Publication Plan And Authority Boundary

`tinyrustlm/tools/vnext-site-publication.js` now freezes the deterministic next
step without adding a second release truth path. It consumes the exact release,
approved claims, static-readback receipt, generator, optional current-vNext
history, plan receipt, and publisher signature as bounded canonical bytes. It
derives byte-identical pointer/history candidates and direct published-claim
descendants while performing no network, clock, filesystem, signing, or store
operation. It rejects the old ledger schema outright.

The sole release surface now reconstructs the exact static-readback lineage,
creates and scans the plan receipt, verifies one current site-publisher
authority graph, invokes this pure module, and scans every generated candidate.
`authorizeSitePublication` deliberately does not persist the pointer, history,
or published claims and does not claim publication; its pure result remains
`not-published-awaiting-generated-file-readback`. Separate release-surface
operations then admit one attempt-only generated deployment receipt, invoke the
sole HTTPS verifier over the complete static-plus-generated closure, and
create-only persist the scanned claim prefix before writing one final
publication commit receipt. See
`docs/architecture/vnext-site-publication.md`.

## Redaction And Secret Custody

The runtime bootstrap requires one signed, publicly pinned, module-issued
protected equality-custody handle loaded from descriptor 3. It validates that
opaque handle before opening any surface and retains it for all nine
operations; surface options and operation inputs cannot replace it with a raw
list, private bundle, or structural copy. The surface scans the finalized canonical
attestation across the frozen redaction profile and creates the one-way scan
receipt from the scan capability. Preparation applies the same custody revision
to every selected public input, the strict LF UTF-8 changelog, and the final
release manifest. Secret values and representations are never written to a
receipt, operation record, status view, error, or path.

On scan pass, the surface create-only publishes the attestation and then the
redaction receipt. On scan failure, it forbids attestation persistence, writes
only the public-safe scan receipt, returns no attestation bytes, and renders
`release-evidence-redaction-blocked`. The scan receipt contains finding classes
and hashes, not the protected values. The operator view receives an additional
protected-equality scan before it is returned.

The public result and receipt bind custody ID, revision, generation, authority
key identity and fingerprint, known-secret count, and canonical custody-binding
SHA-256 without exposing a secret hash or list commitment. See
`docs/architecture/vnext-protected-equality-custody.md` and
`docs/architecture/vnext-protected-equality-private-loader.md`.

The bounded inherited-pipe loader is now the sole release bootstrap ingress.
The former public surface factory and public custody constructor are absent.
This closes local caller-substitution wiring, but it does not prove an
authorized production issuer or launcher, current revocation, trusted-time
acquisition, crash-dump and swap controls, or OS process and network isolation.
The real-pipe tests remain local evidence rather than production custody proof.

For preparation, a changelog scan receipt is create-only persisted before the
manifest is admitted. A selected-document or changelog finding persists only a
public-safe failure scan receipt. A final-manifest finding persists only its
failure scan receipt. Unsafe changelog or manifest bytes are never stored or
returned. On pass, the manifest scan receipt is persisted first, the release
subject is create-only published second, and both stores and final bytes are
reconstructed and compared before a successful result is returned.

Authorization replays the preparation scans against the current protected
list before considering the signature. It then scans the canonical signature
receipt and derives a public-safe authorization redaction receipt. Unsafe
authorization bytes are never persisted or returned; only the bounded failure
scan receipt is retained. On pass, the redaction receipt is create-only
persisted before the signature receipt. The derived authorization-result bytes
receive an additional protected-representation scan before return.

Site planning uses the dedicated canonical public-JSON-control scanner for
prior history and plan material, then the ordinary document scanner for the
final plan receipt. Site authorization scans the publisher signature receipt,
current pointer, complete history, and every direct published-claim candidate
before any publisher descendant is retained. If any candidate fails, only its
bounded failure scan may persist; no signature, pointer, history, or claim byte
is admitted.

## Operator Status

The canonical `tinyrustlm.vnext.campaign_release_status.v1` view contains only
the exact campaign/environment, operation and record identities, projection
hash, trusted time, five current/target counts, resumable state, blocker codes,
attestation/redaction receipt IDs, and a release-eligibility bit.

Its states are deliberately narrow:

- `campaign-incomplete`;
- `campaign-complete-awaiting-release-inputs`;
- `release-evidence-redaction-blocked`.

There is no `done` state. Even a complete 20/50/25/40/20 projection is only
eligible for release preparation. Authorization and exact production readback
must occur later before public completion wording is valid.

The status bytes are a derived process return, not a mutable dashboard file,
receipt, claim, projection input, or currentness pointer. Resume always runs
the sole runner again.

## Persistence And Failure Semantics

The surface writes only through the existing receipt and public subject stores.
Persistence uses
same-directory exclusive temporaries, file flush, create-if-absent hard links,
byte-identical collision acceptance, directory metadata synchronization where
available, exact readback, bounded reconstruction, and quarantine. No file is
replaced, renamed over, or deleted. Raw host errors are bounded by the existing
vNext evidence error vocabulary.

If projection fails, the runner records its immutable failed terminal record
and no attestation is created. If attestation persistence is interrupted, a
new release-surface operation must reproject with a new operation ID. Identical
content can be safely reused by the create-only receipt store, but no previous
projection becomes current merely because its bytes still exist.

Preparation failures never overwrite prior material. An incomplete projection
retains its blocked attestation but creates no release. A semantic input
failure retains the new immutable runner/attestation history but creates no
release. A scan failure adds only its bounded public-safe receipt. Snapshot
drift before either final write aborts the operation; a drift detected after a
create-only write prevents a successful result and leaves the bytes as
non-authorized immutable history for audit.

Authorization admits exactly three store states: the exact prepared set, that
set plus the deterministic authorization-redaction receipt, or that set plus
the same redaction and signature receipts. These states support recovery from
interruption after either create-only write and byte-identical idempotent
replay. Any unrelated post-preparation receipt or subject, missing member,
identity substitution, or changed byte sequence blocks authorization and
requires a new preparation. An unsafe signature leaves only its failure scan;
the release is not authorized and must be prepared again before another
attempt. The trusted verification time is part of the authorization identity,
so replay with a different verification instant is not treated as the same
operation.

Deployment admission uses the same bounded crash-recovery pattern over the
exact authorized set: authorized only, authorized plus the deterministic
deployment-redaction receipt, or that set plus the exact deployment receipt.
Any other active member blocks the operation. Byte-identical replay reuses the
two descendants. An unsafe deployment receipt persists only its bounded failed
redaction receipt; the deployment receipt itself is never stored.

Site-plan persistence accepts only an exact static-readback dependency prefix,
each deterministic plan scan in fixed order, and the exact plan receipt.
Site authorization accepts only that complete prefix followed by signature
redaction, the exact signature, and candidate redaction receipts in fixed
order. Restart recovery verifies every existing byte before appending a missing
descendant. Generated deployment admission adds only its deterministic
redaction and exact attempt-only receipt. Combined readback admission adds only
its deterministic redaction and exact readback receipt after internally
verifying every static and generated byte.

Finalization accepts only that exact base, the final-receipt redaction, a
lexicographically ordered prefix of byte-identical published claims, and then
the final publication receipt. A partial claim prefix is inert because the
commit receipt is absent. Restart reconstructs and reverifies every parent and
candidate, resumes at the first missing claim, and writes the final receipt
last. Any gap, changed byte, extra member, premature final receipt, or caller
publication verdict fails closed.

## Verification

`tinyrustlm/tests/vnext-campaign-release-surface.test.js` covers:

- the exact frozen profile and no-compatibility policy;
- honest zero counters and a blocked attestation;
- exact synthetic 20/50/25/40/20 capacity without a publication claim;
- rejection of stored projection bytes, caller verdicts, counter drift,
  dashboard input, and accessors;
- campaign, environment, and authority pin mismatches;
- rejection of failed and interrupted operation histories;
- one-time operation identity;
- full receipt-snapshot binding;
- protected-secret detection with no unsafe attestation persistence;
- public-safe redaction receipt and operator-state output;
- exact 20-model artifact coverage plus one CycloneDX 1.6 SBOM;
- package and provenance binding to the exact artifact-set identity;
- all-current-approved claim selection and omission rejection;
- stale package, expired claim, incomplete campaign, artifact omission, and
  unrelated-artifact injection rejection;
- canonical changelog and final-manifest scans;
- canonical public-origin validation, exact web-build evidence, closed static
  graph validation, content-addressed immutable paths, generated-file
  descriptors, retired-path disjointness, model-byte exclusion, and offline
  worker consistency;
- rejection of omitted or extra web inputs, private origins, path collisions,
  missing bootstrap, stable immutable paths, generated back-references,
  header drift, model routes, and worker-policy mismatch;
- rejection of valid-looking hash, size, type, and cache drift when the
  recomputed inventory no longer matches the immutable build receipt;
- create-only manifest-store readback behavior and defensive returned byte copies;
- successful fresh reprojection after retained attestation, redaction, and
  release-manifest history;
- explicit `not-authorized` output with no publication or `done` claim;
- successful authorization after process restart with an ephemeral-test-key
  Ed25519 signature and a current pinned authority graph;
- byte-identical authorization replay and crash-recovery persistence order;
- rejection of caller decisions, wrong scope, wrong release binding, expired
  authorization, retired keys, and post-preparation subject drift; and
- unsafe authorization bytes retaining only bounded redaction evidence;
- exact deployment-attempt lineage, inventory and control-document binding;
- rejection of caller deployment truth, fixture execution, scope drift, and
  attempted-inventory drift;
- byte-identical deployment admission replay;
- unsafe deployment bytes retaining only bounded redaction evidence;
- internally invoked readback with no caller transport, response, result, or
  success field;
- independent rejection of a malformed verifier result;
- exact manifest/observation/result/receipt binding;
- interruption after the readback scan commit and byte-identical recovery; and
- an immutable current-pass `public-readback` phase receipt that remains
  explicitly `not-published`;
- deterministic plan material and create-only `site-synchronization` receipt
  persistence with byte-identical replay;
- current site-publisher Ed25519 authority, exact plan/release/scope binding,
  finite lifetime, and expiry rejection;
- canonical pointer/history controls and direct published-claim candidate
  redaction without candidate persistence during authorization;
- exact generated-deployment lineage and attempt-only semantics;
- one internally invoked combined readback over the sorted static-plus-generated
  graph, with independent result and receipt revalidation;
- final receipt redaction before a lexicographic create-only published-claim
  prefix and the final commit receipt last;
- byte-identical restart recovery after final redaction, after every individual
  claim commit, and after the final receipt commit; and
- rejection of caller deployment, readback, and publication truth.

The sole maintained execution command is
`npm run test:vnext-campaign-release-surface -- <absolute-evidence-root>`.
The caller supplies only an existing absolute evidence root; it cannot supply
a verdict, result, test count, source identity, or receipt. The standalone
verification command is
`node tools/run-vnext-campaign-release-surface-gate.js verify <absolute-evidence-root>`.
Partition-only inspection uses the explicit `validate` operation. There is no
implicit repository output directory or compatibility argument reader.

`contracts/vnext/campaign-release-surface-gate-profile.v1.json` is 6,334 bytes
with SHA-256
`c2b680d770dc68a9f505eae46b7d97bffe08b546712fcb5768ea479ac0d66445`.
It freezes all 23 top-level cases exactly once across nine disjoint anchored
shards. Before any
execution or reuse, the gate requires a clean exact Git head and tree and binds
the profile, runner, complete implementation closure, unchanged test file,
ordered partition, Node executable bytes and version, operating system,
architecture, bounded tool identities, and a hashed allowlisted child
environment into one content-addressed run identity. The child receives no
ambient credentials: only the frozen allowlist and fixed offline/no-color
values cross the process boundary.

Every fresh shard runs the unchanged test file in an independent process with
Node test isolation disabled so that the test module remains in the process
that owns inherited descriptor 3. A strict test launcher creates one signed
private bundle, writes it only to the inherited pipe, passes only canonical
public trust bytes through a test-scoped environment binding, and zeroes its
owned bytes. The three secret-sensitive tests are isolated into separate
one-test shards with distinct custody revisions; all other shards receive an
empty protected list. Those three shards run first so custody/profile drift
fails before the longer ordinary release exercises. Each shard retains bounded
raw stdout and stderr in an internally named create-only
attempt directory. A canonical shard receipt is committed only after terminal
process state, file fsync, source revalidation, exact log readback, and an
independent parser agree. Pass requires the exact expected test names and
counts, exit zero, empty stderr, and zero failures, skips, cancellations, and
todos. Timeouts, signals, output limits, incomplete attempts, malformed logs,
and failed receipts remain immutable evidence but cannot satisfy resume.

After all nine shard receipts independently verify against the current run
identity, the gate commits one atomic create-only aggregate receipt and then
verifies the complete graph again. A restart reuses only exact valid pass
receipts for the same content-addressed source, partition, tools, and
environment. Source, runner, test, partition, output, or environment drift
creates a different run identity or fails verification; no stale pass is
silently carried forward. File fsync is recorded without claiming universal
directory-entry survival, which remains a separate native durability gate.

On 2026-08-11, an earlier clean source revision's exhaustive partition passed
23/23 with zero failures, skips, cancellations, or todos. The six shard
aggregates were 4/4, 4/4, 4/4, 3/3, 4/4, and 4/4. That historical result is not
a pass for a later source revision. Subsequent outer-wrapper timeouts are also
retained as infrastructure evidence, not product failures or complete-suite
passes. Sharding and verified resume change orchestration only: they do not
reuse fixture verdicts, lower a threshold, remove a case, or advance campaign
counters.

On 2026-08-15, the content-addressed gate ran from clean source revision
`734852491e31b772b9b6925f7ac5afe2093becbe`, tree
`7c8efc2999affee7b4ead873fe8e2d39b5d4b87f`, under run identity
`85bc09c517b27741f62a083813b0616eb53c13b291b8bb285fe77498ca2b30dd`.
All six immutable shard receipts passed 4/4, 4/4, 4/4, 3/3, 4/4, and 4/4 with
zero failures, skips, cancellations, or todos. Their exact aggregate is 2,859
bytes with SHA-256
`79f042bba91eae7c262452a81a5bc3117b75be6fa399e367b85b95636bff6c8b`;
the standalone read-only verifier returned the same aggregate identity and
23-test verdict. The complementary serial run excluded only this already
covered test file and passed 945/945 tests across 132 tracked files with zero
failures, skips, cancellations, or todos. Its stdout has SHA-256
`9a5d6dcc08398011d0f327e6aee8dc87a95d5a0f7ef10039cef821a8a2586f1e`;
stderr is empty. This is current local Windows source evidence, not production
authorization, deployment, public readback, publication, or live campaign
progress.

The complete-capacity case is synthetic conformance evidence. It does not
increment any live campaign counter.

## Integrated Production Readback Boundary

`tinyrustlm/tools/vnext-public-https-readback.js` is the sole production-network
verifier invoked by the forward-only release operation. It owns public DNS and
HTTPS, pins one globally routable address,
uses normal TLS hostname verification, and verifies either the exact static
inventory or the complete static-plus-generated inventory by exact status,
length, media type, cache/security headers, stream count, and SHA-256. It has no
caller transport or success input and returns no receipt. The release surface
reconstructs each admitted deployment and current authority graph, invokes this
exact module, independently revalidates its canonical result, and persists each
scan/readback dependency pair. See
`docs/architecture/vnext-public-https-readback.md`.

No production invocation is asserted by this checkpoint. The complete local
release graph through generated deployment admission, combined production
readback invocation, restart-safe claim-prefix persistence, and final
publication commit is implemented and covered only by fixture-labeled local
orchestration evidence. The maintained-entry-point cutover and source deletion
are complete; a real authorized production execution and exact public readback
remain independent release gates.
