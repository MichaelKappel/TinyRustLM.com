# Release-Surface Restart Activation Batching

Date: 2026-08-25

Status: implemented and focused-regression verified; full clean-source release
surface rerun remains required before this checkpoint can be called green.

## Preserved Failure

Clean commit `fbf9ea8efbd479e98cb646d49e2400657a484b2f` passed the
1,259-test standard Node partition with zero failures and one explicit absent
package-input skip. Its separate clean-source release-surface run had content
addressed run ID
`b8851fe74916282f3fb9d74530788e5153b87b0c1f05375f93a109908082ef28`.
That run stopped on shard 8 after the complete-capacity site-publication case
took `183945.9794` milliseconds against the fixed `180000` millisecond limit.
The threshold was not changed and the failed gate was not converted into a
pass.

## Root Cause

Restart reconstruction called the helper-backed restart activation operation
once per receipt or subject. Every call independently reread the target and
durability receipt, launched the Rust directory-flush helper for the target and
receipt directories, and repeated exact readback. The safety properties were
correct, but a store containing many valid members paid process-launch and
package-verification cost once per member. The interruption test performs four
intentional store restarts, so the repeated launch cost dominated wall time.

Exact idempotent `put` and `putMany` replay also sent already-active bytes back
through temporary creation, fsync, hard-link publication, directory flush,
durability-receipt publication, and readback. That was unnecessary after the
active bytes and durability receipt had been freshly revalidated.

## Implementation

`vnext-durable-publication.js` now separates restart activation into two
strict phases:

1. Each candidate independently validates its target path, matching durability
   receipt, byte limits, target bytes, receipt bytes, and hashes without
   activation.
2. Opaque in-process preparation tickets are accepted only by the creating
   durability boundary. All prepared target and receipt directories are sent
   through the existing bounded helper batch API. Every target and receipt is
   then reread and rehashed before any result is returned.

Receipt and subject stores preflight and parse each candidate separately so a
stable malformed member can still be quarantined without hiding unrelated
valid members. Prepared valid members are activated in batches of at most
1,024. A helper, readback, or concurrent-mutation failure after preflight fails
the entire rebuild; no partial in-memory store becomes active.

For idempotent replay, both stores now require exact caller-byte equality and
fresh double readback of the active target and durability receipt. They reuse
the existing durability identity and publish only genuinely new batch members.
An all-existing replay creates no temporary, invokes no directory helper, and
does not advance the store generation or snapshot revision.

## Verification

Permanent regressions require:

- two prepared targets and their two durability receipts to use one helper
  request containing all four restart flush operations;
- exact receipt replay to invoke no helper and leave `publishedEntries` and
  snapshot revision unchanged;
- exact subject replay to invoke no helper and leave `publishedEntries` and
  snapshot revision unchanged; and
- every target and durability receipt to retain its original exact identity.

The durability, receipt-store, and subject-store suites pass 61 of 61 tests.
The formerly failing complete-capacity publication scenario passed through the
same inherited-pipe custody launcher in `103682.2579` milliseconds after all
temporary diagnostics were removed. This is focused regression evidence, not
the terminal clean-source release-surface gate.

## Invalidation And Claim Boundary

This change invalidates current durability implementation source-closure
identities and release-surface verification derived from the prior
implementation. It does not invalidate the locked Qwen source acquisition,
Qwen conversion profile registration, converter implementation tests, or the
immutable execution `/1` and `/2` history. It creates no model, quality,
browser, P2P, MemoryEndpoints, publication, deployment, or campaign credit.
Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
