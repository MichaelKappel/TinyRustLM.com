# ADR-012: Durable Publication Bootstrap

## Status

Accepted and implemented at the current source checkpoint for the incompatible
vNext durability boundary. The local Rust, Node, restart, fault-injection, and
batch conformance gates pass. This status does not claim physical power-loss
survival, release-helper provenance, Linux or ARM64 execution, deployment, or
live campaign progress.

## Decision Date

2026-08-11

## Scope

This ADR defines the sole bootstrap rule by which the vNext receipt, subject,
campaign-artifact, and campaign-operation stores may activate immutable bytes.
It covers owned-directory creation, target publication, target durability,
store-level durability receipts, restart validation, and bounded batch
publication. It does not define campaign receipt semantics, model quality,
browser persistence, release authorization, public deployment, or hosted
memory.

The durability receipt is below the campaign receipt DAG. A campaign receipt
may bind its SHA-256 identity, but a durability receipt is never recursively
inserted into the campaign receipt store.

## Decision

Use one forward-only content-addressed durability receipt as the terminal
persistence trust anchor.

For each target publication, the sole sequence is:

1. require a preexisting, absolute, privately owned store root;
2. reject symbolic-link or reparse exposure and require stable path-topology
   ownership while the operation runs;
3. create missing owned child directories one component at a time, flushing
   each new entry's parent and the new directory through the verified Rust
   helper;
4. write an exclusive same-directory target temporary, fsync it, and publish
   it with a create-if-absent hard link;
5. accept an existing target only when its bytes are exactly identical;
6. remove the temporary link, helper-flush the target directory, and perform
   exact bounded target readback;
7. canonicalize a receipt binding the target hash, size, relative path, store
   profile, durable-publication profile, file-fsync status, publication
   primitive, exact readback, and complete verified directory-flush result;
8. publish that receipt under the SHA-256 of its exact canonical wire bytes by
   the same temporary-fsync, create-only, helper-flush, and readback sequence;
9. reread the target exactly; and
10. expose the target to the store only after every preceding step succeeds.

Owned layout creation and quarantine mutations use an auxiliary
directory-flush operation through the same verified helper. They do not create
activation receipts and cannot be represented by caller-supplied success.

The persisted receipt deliberately excludes evidence of its own publication.
That exclusion is the explicit non-recursive bootstrap rule. Creation accepts
the receipt only after its file fsync, helper-backed directory flush, exact
receipt readback, and exact target readback. Restart accepts it only after
fresh helper-backed flushes of both target and receipt directories plus exact
readbacks. A transient operation result binds the receipt-publication
observation without inserting that observation into the bytes whose hash
selects the receipt path.

Batch publication preflights every member before the first mutation. Members
have sorted unique operation identities, bounded aggregate request bytes, and
closed schemas. Target flushes and receipt flushes each use one bounded Rust
helper batch. The public operation returns a complete ordered set or one
failure and activates no member until every target, receipt, flush, and exact
readback succeeds. This is not a transactional filesystem claim: inactive
files may remain after interruption and are preserved for restart validation
or quarantine.

## Alternatives

- A recursive durability-receipt chain was rejected because it has no terminal
  trust anchor.
- Embedding a receipt's final publication observation in its own canonical
  bytes was rejected because it creates an impossible self-hash cycle.
- Caller-supplied fsync, directory-flush, process-output, or readback success
  was rejected because untrusted inputs cannot establish persistence.
- Node directory-open and close was rejected as the authoritative flush
  boundary because support and error behavior differ by operating system.
- Rename-overwrite publication was rejected because an existing immutable
  identity must never be silently replaced.
- Mutable latest receipts and best-effort repair were rejected because they
  erase failure history and can turn incomplete evidence into activation.
- Per-member helper process startup in a batch was rejected because one strict
  bounded batch protocol provides the same decision with less process churn.
- A compatibility reader or legacy publication fallback was rejected because
  this unpublished vNext cutover has one clean durability contract.

## Authoritative Evidence

- **Observed local fact**: the Rust helper implements the closed bounded batch
  request and observation protocol and returns one observation only after all
  requested directories have been processed.
- **Observed local fact**: Node publication, receipt-store, subject-store, and
  campaign-store tests exercise create-only writes, exact readback, restart,
  orphan handling, dependency ordering, batch failure, and activation delay.
- **Observed local fact**: Rust durability tests exercise protocol shape,
  duplicate identities, size bounds, path ownership, directory flushes, and
  stable public-safe errors on the current Windows test host.
- **Engineering decision**: the forward-only content-addressed durability
  receipt is the one non-recursive bootstrap anchor beneath the campaign DAG.
- **Engineering decision**: inactive artifacts are preserved rather than
  repaired, overwritten, or converted into success.
- **Local verification required**: a release-built helper must be bound to
  reproducible package provenance and rerun on every promoted physical RID.
- **Local verification required**: controlled power interruption and storage
  fault tests must establish any physical persistence claim.
- **Externally blocked**: local conformance cannot prove public deployment,
  outside observers, catalog announcement, or live campaign counters.

## Threat Analysis

Threats include path escape, reparse substitution, ancestor replacement,
temporary-file collision, overwrite of an existing identity, partial write,
short read, post-flush mutation, helper substitution, malformed helper output,
duplicate operation identity, oversized batch input, dependency cycles,
activation before complete publication, stale receipt reuse, orphan repair,
and diagnostic disclosure of private paths or bytes.

The boundary canonicalizes and bounds every wire, rejects accessors and unknown
fields before mutation, binds paths relative to one owned root, checks topology
at each sensitive transition, uses exclusive same-directory temporaries,
requires exact existing bytes, invokes only the verified helper protocol, and
performs exact readback after each durability boundary. Store activation is a
separate final state transition. Failure leaves no active member and exposes
only stable bounded error codes.

Batch ordering is deterministic but does not imply atomic disk mutation. A
crash may leave targets, receipts, or both. Restart independently reconstructs
the active set from exact current bytes and fresh local flush observations;
presence alone is never authority.

## Performance Evidence

Batching removes repeated helper startup for related directory flushes and
bounds one request to 1 through 1024 unique operations and 4 MiB of canonical
input. This is an architectural bound, not a throughput claim. The current
tests establish finite behavior and semantic equivalence, not production
latency, storage-controller persistence, or cross-platform performance.

Promotion requires measured helper startup, canonicalization cost, hashing
throughput, fsync and directory-flush latency, exact-readback cost, peak memory,
and restart scanning for honest zero, partial, and full campaign capacities.
Those measurements must name the helper bytes, runtime, filesystem, storage
device, operating system, power policy, and test corpus. No unmeasured platform
inherits a result.

## Compatibility Impact

This is the only accepted vNext store activation contract. Stores that lack a
current matching durability receipt treat the target as inactive. A changed
store profile, publication profile, helper identity, target wire, or receipt
wire derives new evidence and cannot inherit old activation truth.

There is no SLM1 fallback, old mutable store reader, migration repair, dual
writer, caller-injected success path, alias, or hidden best-effort mode.
Immutable Git history remains historical evidence and is not runtime support.

## Clean Deletion Impact

Delete the superseded in-memory and file-write-only activation paths, direct
test injection of flush success, mutable latest receipt files, and any fixture
that activates one batch member before the complete set succeeds. Remove stale
single-operation helper schemas after every caller is cut over to the sole
batch protocol. Do not retain adapters or legacy test commands.

Quarantine and inactive history are evidence, not compatibility code. They
remain immutable under their own identities until an explicit retention
policy authorizes deletion; they never reenter the active set through repair.

## Unknowns

- Physical power-loss behavior of each promoted filesystem, device, and
  controller cache configuration.
- Release provenance and malware-scanning evidence for the exact Rust helper
  bytes used outside local development.
- Real Linux x64 and Linux ARM64 directory-flush behavior and error mapping.
- Maximum-capacity restart scan time and filesystem metadata pressure on the
  final campaign host.
- Final archive-retention and equality-list custody policy for inactive and
  quarantined evidence.
- Whether later measured throughput requires bounded parallel helper batches;
  any such change requires a new profile and decision rather than silent drift.

## Acceptance Tests

1. The request and observation schemas reject empty, oversized, duplicate,
   unsorted, unknown-field, accessor-bearing, and noncanonical inputs.
2. The Rust helper processes a complete bounded batch and emits exact ordered
   observations with stable public-safe failures.
3. Root, ancestor, target, temporary, and receipt paths reject escape and
   reparse exposure before activation.
4. New directories, target bytes, and receipt bytes each pass their required
   file and directory durability operations plus exact readback.
5. Existing identical targets are idempotent; conflicting targets and receipts
   fail without overwrite.
6. The persisted receipt has one canonical identity and excludes recursive
   evidence of its own publication.
7. Restart activates only an exact target and exact receipt after fresh local
   helper flushes and readbacks.
8. Batch stores preflight capacity, identity, dependency closure, and topology
   before the first publication mutation.
9. Batch failure returns no partial API success and activates no member, while
   preserving any inactive filesystem evidence.
10. Receipt dependencies are topologically ordered and reject missing,
    inactive, duplicate, or cyclic parents.
11. Deterministic vector regeneration, JavaScript tests, Rust tests, formatting,
    linting, and source hygiene all pass with the frozen profile identities.
12. No local test increments live campaign counters or claims physical
    persistence, release provenance, deployment, or outside observation.

## Rollback

Before publication, rollback is a source-level revert of this incompatible
vNext checkpoint together with all derived profile and vector identities. A
rollback must preserve failed and obsolete evidence and must not rewrite it as
current.

After any public release binds this profile, rollback means publishing a new
forward contract and explicitly revoking or superseding the affected release.
The runtime must never fall back to file-write-only activation, caller-supplied
durability, mutable receipts, a legacy reader, or silent repair.
