# vNext Public Subject Store

## Status And Non-Claims

`tinyrustlm.vnext.subject-store.v1` is the sole current host-side persistence
boundary for public-safe, non-receipt identity documents consumed by the
vNext authority and campaign-projection code. The implementation is
`tinyrustlm/tools/vnext-subject-store.js`; its frozen profile is
`contracts/vnext/subject-store-profile.v1.json`.

The profile is 3,285 bytes with SHA-256
`f0752251373ed3cce93d8387e45f2b96e92402febf10ade8bb3d0c3b24f98b89`.
It is an incompatible clean-slate contract with no dated reader, alias,
fallback, migration, dual writer, or mutable current pointer.

This store does not classify phase currentness, verify an authority graph,
select an outside proof, project campaign counters, authorize a release, or
increment any campaign objective. It does not make a subject current merely
because its bytes remain valid. Campaign counters remain 0/20, 0/50, 0/25,
0/40, and 0/20.

## Accepted Boundary

The store admits exact canonical bytes for only these public-safe schemas:

- `tinyrustlm.vnext.artifact_manifest.v1`;
- `tinyrustlm.vnext.claim.v2`;
- `tinyrustlm.vnext.outside_proof.v2`;
- `tinyrustlm.vnext.p2p_manifest.v1`; and
- `tinyrustlm.vnext.release_manifest.v2`.

The release manifest contains only prepublication parents. Its claims are
`approved-for-publication` documents with a null `releaseId`; authorization is
a descendant signature over the manifest, and public readback plus published
claim descendants point forward to the manifest. This one-way graph prevents
content-addressed release/claim and release/authorization cycles.

Every input is independently accepted by both vNext schema validators,
recanonicalized, and checked against its domain-separated identity before the
store can publish it. The profile binds the exact contract-registry and
campaign-projection profile hashes and repeats each schema's registry byte
limit.

`tinyrustlm.vnext.context.v1` is rejected because it is private. It must never
enter a public campaign-evidence store. `tinyrustlm.vnext.receipt.v1` is
rejected because receipt parent-DAG ownership belongs exclusively to
`vnext-receipt-store.js`. Worker and companion messages have no content
identity and are rejected by the identity validator itself.

## Identity And Layout

The validated `subjectId` selects the final path:

```text
subjects/sha256/{first-two-subject-id-hex}/{subject-id-hex}.json
quarantine/{random-id}.{bounded-reason-code}.q
```

For most accepted schemas, the subject ID is the canonical content identity.
An artifact manifest deliberately uses the model artifact's byte identity as
its subject ID while retaining a separate canonical-document hash. The store
therefore binds both values and permits only one exact canonical manifest wire
for an artifact ID. A second, different manifest for the same artifact ID is
an immutable target conflict and fails closed.

No absolute path, raw invalid bytes, raw host diagnostic, current pointer, or
latest pointer crosses the result boundary.

## Create-Only Publication

The store reuses `vnext-create-only-files.js` and performs:

1. absolute root normalization and containment;
2. symbolic-link and reparse-point rejection;
3. bounded canonical validation before writing;
4. an exclusive mode-0600 same-directory temporary;
5. bounded writes, file `fsync`, and close;
6. hard-link create-if-absent publication;
7. acceptance of an existing target only when every byte is identical;
8. directory synchronization or the explicit Node/Win32 unavailability class;
9. bounded no-follow readback and exact byte comparison; and
10. in-process activation only after the complete publication sequence.

Independent processes publishing the same bytes converge on one immutable
target. Conflicting bytes never replace it. Disk-full, short-write, sync,
publication, target-conflict, and readback failures return bounded codes.

## Reconstruction And Interruption

Opening the store rebuilds all active state from disk. It scans only the owned
layout, caps directory and aggregate entry counts, caps active subjects at
2,048 and their aggregate canonical bytes at 64 MiB, and never follows a link.
It revalidates every subject and checks schema, subject ID, path prefix,
canonical hash, and byte limit.

Malformed subjects, private or receipt schemas, identity-path mismatches,
unknown entries, and old interrupted temporaries move to bounded quarantine.
A fresh temporary younger than five minutes remains pending because another
process may still own it. Rebuild never deletes or edits an unrelated valid
subject.

An active read reopens and revalidates the exact file and compares the current
schema, identity, canonical content hash, and byte length with the reconstructed
metadata. Post-startup mutation therefore fails the read, and restart removes
the invalid subject from active membership.

## Runner Contract

The forthcoming campaign runner must rebuild the receipt and subject stores,
capture every active ID in sorted order, read every named member, and verify
that a second bounded reconstruction has the same membership before invoking
the sole generated Rust campaign-evidence ABI. It may not choose a preferred
subset, trust directory names, accept a caller-supplied pass, or treat a stored
projection as current.

Each restart must repeat the store snapshot and Rust projection using explicit
caller-owned campaign/environment/authority pins and trusted verification time.
The exact freshly projected bytes may then be added to immutable projection
history. Cross-store interruption and operation exclusion remain runner work,
not properties claimed by this store checkpoint.

## Verification

`tinyrustlm/tests/vnext-subject-store.test.js` covers the frozen profile,
hostile options, coercive IDs, all five accepted classes, private and receipt
rejection, independent-process idempotence, conflicting artifact manifests,
invalid and misaddressed quarantine, interrupted temporaries, disk full,
post-startup mutation, restart withdrawal, and false readback.

The focused suite passes 11/11, the receipt/content/artifact/inventory/threat
neighborhood passes 59/59, and the complete Node gate passes 827/827 with zero
failures and zero skips. This is local persistence evidence only. A
source-control checkpoint is required before this implementation fact is
promoted in the workspace handoff.
