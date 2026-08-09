# vNext Campaign Artifact Persistence

## Status And Non-Claims

This checkpoint implements create-only local persistence for the exact vNext
campaign plan and canonical campaign-projection snapshots. It does not turn a
stored projection into current evidence, sign a result, authorize a release,
invoke a browser, contact a service, or increment any campaign counter.

The frozen store profile is
`contracts/vnext/campaign-artifact-store-profile.v1.json`. Its SHA-256 is
`9bf4acfa35c26e8e790cd12f8aead4f38f30ac7c8ada716c19a3b012e5675e09`.
The implementation is `tinyrustlm/tools/vnext-campaign-artifact-store.js`;
its hostile and interruption tests are in
`tinyrustlm/tests/vnext-campaign-artifact-store.test.js`.

## Ownership Boundary

Campaign plans and projection results are verifier-support artifacts, not
`tinyrustlm.vnext.receipt.v1` records. The receipt store therefore continues
to admit only canonical receipt bytes and reconstruct their parent DAG. The
campaign artifact store admits only:

- `tinyrustlm.vnext.campaign_plan.v1`, at most 1,048,576 bytes; and
- `tinyrustlm.vnext.campaign_projection_result.v1`, at most 4,194,304 bytes.

Both stores use `vnext-create-only-files.js` for absolute-root validation,
path-link rejection, bounded descriptor reads, same-directory temporary
writes, file `fsync`, hard-link create-if-absent publication, directory
synchronization, byte-exact readback, temporary inspection, and quarantine.
Receipt graph semantics and campaign plan/result semantics remain separate.
There is no generic arbitrary-byte admission path.

## Immutable Layout

The raw SHA-256 of exact canonical wire bytes selects every final path:

```text
plans/sha256/{first-two-hex}/{plan-wire-sha256}.json
projections/sha256/{first-two-hex}/{projection-wire-sha256}.json
quarantine/{random-id}.{reason-code}.q
```

The store never writes `current`, `latest`, or another mutable pointer. A
second writer may reuse an existing target only when every byte is identical.
A conflicting target is an error and is never replaced. Returned paths are
relative and public-safe; raw host errors, invalid bytes, and absolute private
paths are not returned.

## Result Validation

`validateCampaignProjectionResultBytes` now validates a stored result against
the exact parent plan. It requires strict JSON, canonical wire equality, the
closed result fields, profile and plan identities, bounded UTC time, exact
target values, count/evidence cardinality agreement, sorted unique IDs,
phase-state totals, blocker consistency, authority shape, completion state,
and a planned current operation. The complete 20/50/25/40/20 synthetic result
and the honest-zero result both pass this validator. Changed count semantics,
pretty-printed transport bytes, or a different plan reject.

This is structural validation of one immutable snapshot. It cannot prove that
the receipt and subject evidence used to create the snapshot remains current.
Current truth still comes only from rerunning `projectVnextCampaign` with the
caller-supplied trusted time, authority pins, receipt bytes, and subject bytes.

## Atomic Create Algorithm

For each accepted artifact, the store:

1. validates and copies the hostile input bytes;
2. derives the exact wire SHA-256 and final relative path;
3. requires a valid active parent plan before a projection write;
4. creates a same-directory temporary with exclusive mode `0600`;
5. writes through a bounded 65,536-byte buffer and rejects short writes;
6. `fsync`s and closes the temporary;
7. publishes with a hard link that cannot replace an existing target;
8. removes the temporary link;
9. synchronizes directory metadata, or records the explicit Node/Windows
   unavailability class accepted by the frozen profile;
10. rereads through a bounded no-follow descriptor and compares every byte;
11. revalidates the parent plan after projection publication; and
12. exposes the artifact in the in-process active map only after all checks
    succeed.

If the parent changes after preflight, a newly created projection is removed
and the parent failure remains authoritative. If directory synchronization
fails after publication, complete target bytes remain recoverable on restart.
Disk-full, file-sync, link, conflict, and false-readback paths return bounded
codes and do not publish partial bytes.

## Rebuild And Resume

Opening the store performs a bounded reconstruction. It scans only owned
containers, never follows symbolic links or reparse points, validates path
identity against wire identity, validates all plans before dependent
projections, and quarantines invalid plans plus projections whose parent plan
is absent. Unknown entries and old incomplete temporaries are quarantined;
fresh temporaries remain pending for another live writer until the frozen
five-minute threshold passes. Unrelated valid artifacts remain active.

`resumeProjection(input)` does not select a stored snapshot by timestamp. It:

1. reruns the projector with the complete caller-supplied input;
2. requires the exact projected parent plan to be active;
3. validates the result against that plan; and
4. creates or byte-identically reuses the resulting immutable snapshot.

Changing only the trusted verification time creates a distinct retained
snapshot. Repeating identical inputs reuses identical bytes. The opening
`startup` record is intentionally immutable; callers request `rebuild()` for
a new on-disk observation after writes by this or another process.

## Verification

The focused result, campaign-store, and receipt-store suites pass 48 tests.
They cover strict profile shape, accessor rejection, exact create/read/reuse,
missing parents, restart reprojection, immutable history, plan tamper,
dependent withdrawal, fresh and stale temporaries, disk full, directory-sync
failure, parent mutation after preflight, false readback, complete-campaign
result validation, and all retained receipt DAG/concurrency cases.

The complete Node gate passes 795 tests with zero failures and zero skips. The
locked offline Rust plan-parity crate remains 7/7. These are local test facts,
not live campaign evidence.

## Remaining Integration

- Feed receipt-store and non-receipt subject bytes into the resume API from
  one bounded campaign runner instead of test fixtures.
- Bind selected projection artifacts into final attestation, release
  authorization, operator rendering, documentation synchronization, and
  public readback.
- Preserve completed independent Rust currentness, signature-authority, and
  truthful-projection parity.
- Preserve the generated campaign-evidence Rust/WASM boundary and its exact
  Node/Rust/real-Chromium plan, currentness, projection, and result parity.
- Replace fixture evidence only with authorized production receipts.

Campaign status remains 0/20 qualified models, 0/50 clean-browser rounds,
0/25 live memory rounds, 0/40 outside-proven lanes, and 0/20 announcements.
