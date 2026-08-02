# Dogfood Campaign Final Attestation

Status: implemented pre-release final-decision contract

Schema authorities:

- Remaining-risk register: `tinyrustlm.campaign_remaining_risks.v1`
- Final document: `tinyrustlm.campaign_final_attestation.v1`
- Final receipt: `tinyrustlm.final-release-attestation-v1`
- Release authorization verification: `tinyrustlm.release-attestation-verification-v1`
- Authority registry: `tinyrustlm.release_authority_registry.v1`
- Signed authorization envelope: `tinyrustlm.release_authorization_envelope.v1`
- Verification result: `tinyrustlm.release_attestation_verification.v1`
- Required dashboard: `tinyrustlm.dogfood_campaign_dashboard.v9`

## Purpose

The final attestation is the campaign's machine-readable release decision. It
does not summarize unit tests into a mutable `passed` flag. It rebuilds the
content-addressed receipt DAG, derives the current dashboard, validates the
remaining-risk register, and binds the resulting decision to canonical JSON
and SHA-256.

The current campaign is pre-release. Its truthful final state is
`pre-release-incomplete`. Missing live MemoryEndpoints runs, public P2P proof,
catalog announcements, physical Linux ARM64 execution, qualified models, and
other external gates cannot be replaced by fixtures or operator prose.

## Inputs And Authority

`campaign-final-attestation.js` accepts only:

- one campaign ID;
- the authoritative evidence root;
- one output path;
- a strict remaining-risk register;
- one source revision;
- an optional workspace root used by dashboard scope validation.

It rejects unknown options, malformed or oversized risk data, unknown risk
fields, duplicate risk IDs, unsupported statuses, invalid blocker codes, and a
campaign ID mismatch. It also refuses an evidence store with quarantined
files.

The tool rebuilds the dashboard itself. A caller cannot pass in a favorable
dashboard, completion Boolean, counter, or release-gate result.

## Bound Predicate

The canonical predicate contains:

- campaign and source identities;
- the normalized 20/50/25/40/20 progress counters plus native-RID and
  fault-injection counts;
- every non-final release-gate decision;
- evidence health, DAG validation, and resumability;
- all active blockers except the self-referential final-attestation blocker;
- qualified model IDs and completed browser-round numbers;
- every retained `blocked`, `fail`, `rejected`, or `stale` receipt;
- every retained supersession edge;
- the complete strict remaining-risk register;
- current and retained subject-receipt counts and receipt-set hashes.

Final-attestation receipts, release-authorization verification receipts, and
secret-scan receipts are excluded from the subject receipt set. This prevents
the document from hashing itself or creating an endless scan/attestation
cycle. Their release authority is represented separately by the release gates
and authentication object. The public artifact scope excludes the generated
attestation alias, immutable attestation snapshots, final-attestation receipts,
and release-authorization verification receipts because they are causally
downstream of that scan. Their strict schemas, canonical hashes, immutable
history, signature checks, and exact readback are validated separately.

`predicateSha256` hashes canonical JSON for the predicate. The final
`attestationContentSha256` hashes the complete body, including the
authentication decision and incomplete/complete claim. A formatted file hash
is recorded separately because pretty-printed bytes are not canonical JSON.

## Completion Rules

`campaignPrerequisitesPassed` is true only when all of the following hold at
once:

- exact required counters are complete;
- all non-final release gates pass;
- receipt evidence is healthy and graph-validated;
- the campaign is resumable;
- no non-final blocker remains;
- no open release-blocking risk remains.

Even then, the document remains `incomplete` until a current
`tinyrustlm.release-attestation-verification-v1` receipt:

- has `deployment` evidence authority;
- records a passing release-authorization verification phase;
- binds the exact predicate SHA-256 and source revision;
- records a successful Ed25519 verification and authorized release decision;
- names a bounded signing authority identity;
- supplies a nonempty immutable attestation reference;
- binds the active authority registry, signing key, signed payload, envelope,
  source revision, predicate, issue time, and expiry time.

`campaign-release-authorization-evidence.js` produces that receipt. The clean
two-step workflow is:

1. Generate the unsigned incomplete document after every campaign prerequisite
   passes. Its predicate hash is stable because authorization receipts are not
   part of the subject set.
2. An authorized release owner signs the canonical
   `tinyrustlm.release_authorization_envelope.v1` payload with an Ed25519 key
   listed as an active `release-authorizer` in the strict campaign registry.
3. Run the authorization verifier against the exact unsigned attestation,
   registry, signed envelope, campaign ID, and source revision.
4. Regenerate the final attestation. It discovers the current verification
   receipt and may emit `release-complete` only while the authorization remains
   unexpired and every prerequisite is still current.

The verifier loads bounded regular non-symlink files, checks canonical base64,
validates SPKI DER and Ed25519 key type, verifies the detached signature over
canonical JSON, rejects revoked or absent keys, and limits an authorization to
24 hours. The final dashboard requires that exact verification receipt as a
parent. The final-attestation tool has no private key and cannot manufacture
authorization. Missing registry, key, signature, or receipt is a normal
pre-release blocker, not an error to bypass.

## Durable Output

The tool first creates an immutable hash-addressed snapshot and then atomically
replaces the operator alias. Both writes use the shared same-directory,
`fsync`, atomic-publication implementation. It reopens and validates the alias
before recording the receipt.

The generation receipt has `status: pass` when generation and validation
succeed, even when the campaign decision is incomplete. Campaign completion is
the separate `finalAcceptancePassed` field plus deployment evidence. Treating
an honest incomplete report as a failed tool execution would hide useful
evidence and create a self-blocking control plane.

Repeated generation with unchanged authoritative inputs returns the same
attestation bytes, snapshot, and current receipt. A changed predicate, risk
register, source revision, or authorization supersedes the old final receipt
without deleting history.

## Dashboard Enforcement

Dashboard v9 accepts a final gate only when the current receipt is
deployment-class and all predicate/content hashes agree exactly. Local-only,
unsigned, incomplete, missing-reference, malformed-hash, and superseded
receipts leave `final_attestation_incomplete` active. It also requires exactly
one current authorization-verification parent and rechecks the parent schema,
source revision, predicate, registry, authority/key IDs, Ed25519 result,
envelope hash, attestation reference, and expiry. The dashboard cannot become
`complete` while that blocker exists.

## Current Truth

No live MemoryEndpoints account or individual-user continuity setup has been
validated from this workspace. No release authorization has been observed.
The generated final attestation must therefore remain incomplete until those
and every other declared gate have objective current evidence.
