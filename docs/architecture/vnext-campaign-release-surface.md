# vNext Campaign Release Surface

## Status

`tinyrustlm.vnext.campaign-release-surface.v1` is the sole vNext boundary for
turning a freshly executed campaign projection into immutable prepublication
attestation evidence, an operator status view, and a create-only
`release_manifest.v3` candidate, then verifying its current release-authorizer
signature as a forward-only child. Its frozen profile is
`contracts/vnext/campaign-release-surface-profile.v1.json`, with SHA-256
`97cc27e2d54f8e1612702f2b55cdf7ab9d6e19d4a4ad280c6f73df81c77ec9d0`.

This checkpoint implements fresh projection, final attestation, public-safe
redaction, truthful operator status, release-manifest preparation, and current
Ed25519 release-authorizer verification. Exact deployment and public HTTPS
readback descendants, published claims, site-publisher authorization, and
deletion of the superseded release stack remain required before the surface is
the operational publication entry point. A prepared manifest is explicitly
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

The implemented authorization edge and forthcoming publication edges continue
forward from the prepared manifest:

```text
release_manifest.v3
  -> authorization redaction-scan receipt
  -> current release-authorizer signature receipt [implemented]
  -> deployment and exact HTTPS readback receipts
  -> published claim.v2 descendants
  -> site-publisher signatures
```

The release manifest cannot list authorization, deployment, readback, or
published-claim descendants. An approved claim has a null release identity.
A published claim points forward to the finalized release. These directions
remove the release/claim and release/authorization cycles rejected during the
r5 contract checkpoint.

## Fresh Truth Boundary

`createVnextCampaignReleaseSurface` constructs the sole campaign runner
internally. `attestCampaign` accepts only plan, campaign, environment,
authority, trusted-time, operation, source-revision, and protected
known-secret inputs. It rejects unknown fields and accessors before any
operation. In particular, it has no input field for:

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
registries, trusted verification time, and the bounded protected equality list. It has no caller
field for an authorization decision, status, deployment, publication, or live
counter. It reconstructs the preparation operation and all required evidence
from create-only storage instead of trusting a prepared-result object retained
in process memory.

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

## Redaction And Secret Custody

The caller supplies a bounded protected equality list in process memory. The
surface validates that list before running, scans the finalized canonical
attestation across the frozen redaction profile, and creates the one-way scan
receipt from the scan capability. Preparation applies the same protected list
to every selected public input, the strict LF UTF-8 changelog, and the final
release manifest. Secret values and representations are never written to a
receipt, operation record, status view, error, or path.

On scan pass, the surface create-only publishes the attestation and then the
redaction receipt. On scan failure, it forbids attestation persistence, writes
only the public-safe scan receipt, returns no attestation bytes, and renders
`release-evidence-redaction-blocked`. The scan receipt contains finding classes
and hashes, not the protected values. The operator view receives an additional
protected-equality scan before it is returned.

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
- create-only manifest/readback behavior and defensive returned byte copies;
- successful fresh reprojection after retained attestation, redaction, and
  release-manifest history;
- explicit `not-authorized` output with no publication or `done` claim;
- successful authorization after process restart with an ephemeral-test-key
  Ed25519 signature and a current pinned authority graph;
- byte-identical authorization replay and crash-recovery persistence order;
- rejection of caller decisions, wrong scope, wrong release binding, expired
  authorization, retired keys, and post-preparation subject drift; and
- unsafe authorization bytes retaining only bounded redaction evidence.

The complete-capacity case is synthetic conformance evidence. It does not
increment any live campaign counter.
