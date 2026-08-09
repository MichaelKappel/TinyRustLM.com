# vNext Campaign Release Surface

## Status

`tinyrustlm.vnext.campaign-release-surface.v1` is the sole vNext boundary for
turning a freshly executed campaign projection into immutable prepublication
attestation evidence and an operator status view. Its frozen profile is
`contracts/vnext/campaign-release-surface-profile.v1.json`, with SHA-256
`a798083041c9cfd824c27625719f6313a4f3ef48bb0d457a81b027194360486a`.

This checkpoint implements fresh projection, final attestation, public-safe
redaction, and truthful operator status. Release-manifest preparation,
release-authorizer verification, exact public HTTPS readback, published claim
descendants, and deletion of the superseded release stack remain required
before the surface is the operational publication entry point. Nothing in
this checkpoint is a release, deployment, public-readback result, or live
campaign count.

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
```

The forthcoming publication graph continues forward from the attestation:

```text
approved claim subjects + artifacts + packages + SBOM + provenance
  -> release_manifest.v2
  -> release-authorizer signature receipt
  -> deployment and exact HTTPS readback receipts
  -> published claim.v2 descendants
  -> site-publisher signatures
```

The release manifest cannot list authorization, deployment, readback, or
published-claim descendants. An approved claim has a null release identity.
A published claim points forward to the finalized release. These directions
remove the release/claim and release/authorization cycles rejected during the
r4 contract checkpoint.

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

## Redaction And Secret Custody

The caller supplies a bounded protected equality list in process memory. The
surface validates that list before running, scans the finalized canonical
attestation across the frozen redaction profile, and creates the one-way scan
receipt from the scan capability. Secret values and representations are never
written to a receipt, operation record, status view, error, or path.

On scan pass, the surface create-only publishes the attestation and then the
redaction receipt. On scan failure, it forbids attestation persistence, writes
only the public-safe scan receipt, returns no attestation bytes, and renders
`release-evidence-redaction-blocked`. The scan receipt contains finding classes
and hashes, not the protected values. The operator view receives an additional
protected-equality scan before it is returned.

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

The surface writes only through the existing receipt store. Publication uses
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
- public-safe redaction receipt and operator-state output.

The complete-capacity case is synthetic conformance evidence. It does not
increment any live campaign counter.
