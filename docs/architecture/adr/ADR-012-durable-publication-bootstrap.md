# ADR-012: Durable Publication Bootstrap

## Status

Accepted for the incompatible vNext durability cutover.

## Context

The vNext receipt, subject, campaign-artifact, and campaign-operation stores
must not activate bytes after only a file write, hard-link publication, or
Node directory-open attempt. Activation requires an exact target-file fsync,
create-only publication, the verified Rust directory-flush boundary, and exact
readback. The complete observation must also survive restart as immutable,
content-addressed evidence.

Persisting that observation introduces a bootstrap problem. If the durability
receipt can become active only after another durability receipt proves its own
publication, the system requires an infinite chain. Embedding the receipt's
own final publication result in its canonical bytes also creates an impossible
self-hash cycle.

## Decision

Use one forward-only content-addressed durability receipt as the terminal
persistence trust anchor.

For a target publication, the sole sequence is:

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

Owned layout creation and quarantine mutations use a separate auxiliary
directory-flush operation through the same verified helper. They do not create
activation receipts and cannot be represented by caller-supplied success.

The persisted receipt deliberately excludes evidence of its own publication.
That exclusion is the explicit non-recursive bootstrap rule, not an omitted
check. Creation accepts the receipt only after its file fsync, helper-backed
directory flush, exact receipt readback, and exact target readback. Restart
accepts it only after fresh helper-backed flushes of both the target and
receipt directories plus exact readbacks. The transient operation result binds
the receipt publication observation without trying to insert that observation
into the bytes whose hash selected the receipt path.

The receipt is not a `tinyrustlm.vnext.receipt.v1` campaign record. It is the
store-level activation commitment beneath that DAG. General campaign receipts
may bind its SHA-256, but the durability receipt is never recursively inserted
into the receipt store.

## Consequences

- A target without a matching current durability receipt is inactive.
- A receipt without its exact target is inactive.
- Invalid, conflicting, orphaned, and superseded records remain preserved for
  quarantine handling and never become active by best-effort repair.
- Repeated publication of identical bytes is idempotent. The canonical receipt
  excludes created-versus-existing disposition so the same environment derives
  the same receipt bytes.
- A changed store profile derives a different receipt and cannot silently
  inherit old activation truth.
- Store scanners may preserve an orphan target or orphan receipt as evidence,
  but neither is active and neither is repaired into a pass.
- Moving or copying a store does not grant local durability; restart must
  execute fresh local helper-backed flushes and readbacks.
- No caller may inject filesystem success, directory-flush success, process
  output, or readback success into the production boundary.
- The preexisting root requirement leaves root provisioning outside the store;
  the store never claims to have durably created its own ownership boundary.

## Explicit Non-Claims

This protocol does not prove physical power-loss survival, controller cache
behavior, release-package provenance for a local test helper, OS-level network
isolation of the helper, Linux or ARM64 execution, production publication, or
campaign progress.
