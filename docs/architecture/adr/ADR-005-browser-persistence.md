# ADR-005: Browser Persistence

## Status

Accepted. Ephemeral user-selected files and companion streaming exist. The
explicit OPFS persistence tier is pending and not promoted.

## Decision Date

2026-08-08

## Scope

This ADR defines where browser-local model bytes and their bounded metadata may
live, how persistence is committed, and how deletion is proven. It does not
define conversation memory, MemoryEndpoints, service-worker release caching,
or the companion's native artifact store.

## Decision

Browser model ownership has three explicit tiers:

1. **Ephemeral File tier**: a user-selected File remains the source owner.
   Validation and activation read bounded slices into worker/WASM-owned
   staging. The browser does not persist the model implicitly.
2. **Opt-in OPFS tier**: after a separate user action and quota preflight, a
   dedicated worker streams bytes into an immutable content-addressed OPFS
   staging object, hashes and validates it, flushes and closes it, then commits
   one bounded metadata pointer transaction. A crash before pointer commit
   leaves an unreferenced object for bounded orphan cleanup, never an active
   model.
3. **Companion/P2P tier**: large converted or imported artifacts remain in the
   companion's validated shared store and stream into browser memory when
   selected. The browser does not duplicate them into OPFS automatically.

IndexedDB stores bounded manifests, identities, receipts, activation pointers,
and user-visible persistence state. It does not store model, adapter,
composition, tokenizer, or KV-cache byte blobs. Cache Storage, localStorage,
sessionStorage, and service-worker caches never store model bytes.

OPFS writes run in a dedicated worker. Where a synchronous access handle is
used, it is single-owner, explicitly flushed, and closed. The commit protocol
is:

1. reserve a generation ID and preflight declared size against policy and
   storage estimate;
2. create a unique staging object below the owned OPFS root;
3. stream, hash, and structurally validate with fixed buffers;
4. flush and close;
5. reopen and verify length plus SHA-256;
6. publish a bounded IndexedDB pointer to the immutable content identity in one
   transaction;
7. mark the prior pointer obsolete;
8. remove unreferenced objects through bounded cleanup.

The active runtime model changes only after candidate validation and
activation succeed. Stale worker messages carry a generation ID and are
ignored. Quota exhaustion, worker crash, cancellation, tab close, or browser
restart cannot replace the active pointer.

Persistence and deletion are user-visible. Delete first marks the content
identity unavailable in a pointer transaction, closes all owners, removes the
OPFS object, verifies absence, removes obsolete metadata, and writes a
public-safe deletion receipt. Profile deletion remains the campaign-level
proof for a fresh-browser round.

## Alternatives

- **IndexedDB model blobs** were rejected because implementations may clone or
  duplicate large values and because metadata and multi-gigabyte byte
  ownership should remain separate.
- **Cache Storage** was rejected because model bytes are not web release
  responses and must not enter service-worker lifecycle behavior.
- **Implicit OPFS caching** was rejected because persistence consumes quota and
  changes deletion expectations without informed user action.
- **One giant ArrayBuffer transfer** was rejected because it duplicates large
  models and can exceed browser memory.
- **File System Access handles as the only persistence** were rejected because
  permission and browser support vary; the File tier remains explicit and
  ephemeral.

## Authoritative Evidence

- **Observed local fact**: current browser ingestion reads user-selected files
  in bounded slices and transfers them into owned WASM allocations.
- **Observed local fact**: current companion acquisition streams verified
  model and composition bytes and does not implement implicit browser OPFS
  persistence.
- **Observed local fact**: no current service worker is an implementation
  owner for model bytes.
- **Sourced public fact**: OPFS, storage quota, worker, and File System APIs
  have browser-specific behavior and require target testing.
- **Engineering decision**: immutable content plus an atomic metadata pointer
  is the browser commit boundary; an assumed universal filesystem rename is
  not.
- **Local verification required**: every promoted browser needs physical
  quota, crash, restart, multi-tab, and deletion tests.

## Threat Analysis

Threats include quota denial, accidental duplicate bytes, partial-file
activation, stale worker completion, multi-tab races, orphan growth, malicious
declared lengths, path-like names, storage eviction, locked handles, profile
residue, and service-worker access to model bytes.

All paths are generated internal identifiers below one owned root. User names
never become paths. Checked size plans precede writes. A Web Lock or equivalent
qualified single-writer lease coordinates tabs. Every queue, orphan scan,
receipt, and retry is bounded. Eviction or missing bytes invalidates the
pointer and leaves the previous active in-memory model unchanged.

## Performance Evidence

The OPFS tier has no current promotion evidence. Required measurements include:

- sustained write, flush, reopen, and hash throughput;
- peak browser and worker memory;
- duplicate disk amplification during staging;
- startup pointer validation and orphan scan duration;
- activation latency from File, OPFS, and companion tiers;
- quota behavior for one, five, and twenty candidate artifacts.

No implementation may clone a complete multi-gigabyte buffer through
postMessage. Buffer size and queue depth are fixed by the resource plan.

## Compatibility Impact

Persistence support is capability and browser-profile specific. A browser
without qualified OPFS semantics supports the explicit ephemeral File tier and
may support the companion tier; it is not described as supporting persisted
browser models.

There is no migration reader for unpublished prior cache shapes. A schema
change invalidates and deletes old owned metadata and requires user
re-admission from original bytes.

## Clean Deletion Impact

At OPFS cutover, remove experimental stores, duplicate model blobs, old pointer
schemas, implicit caches, and compatibility migrations. Startup performs one
bounded cleanup of the retired owned root, records the result, and never
continues to read it.

Model bytes remain forbidden from Cache Storage and service-worker caches in
all releases.

## Unknowns

- Exact per-browser durability after flush and process termination.
- Multi-tab locking behavior across the declared matrix.
- Storage eviction reporting and pressure behavior.
- Practical maximum artifact size and portfolio size by browser/device class.
- Whether OPFS persistence provides enough user value beyond the companion
  store to justify implementation.

## Acceptance Tests

1. Real large-file ingestion proves fixed memory and no complete buffer clone.
2. Crash or cancellation at every commit step cannot activate partial bytes.
3. Wrong length, hash, metadata, generation ID, or pointer fails closed.
4. Quota exhaustion preserves the prior active model and leaves bounded
   cleanup evidence.
5. Two tabs cannot publish conflicting writers; stale messages are ignored.
6. Restart validates the pointer and content identity before use.
7. Delete closes handles, removes pointer and bytes, proves absence, and
   produces a redacted receipt.
8. Fresh-profile campaign tests physically delete the owned browser profile.
9. Scans prove model bytes never enter IndexedDB blobs, Cache Storage,
   localStorage, sessionStorage, logs, URLs, screenshots, or traces.

## Rollback

Before promotion, disable and remove the incomplete OPFS tier without changing
the explicit File or companion paths. After promotion, roll back the whole web
release and mark incompatible persisted pointers unavailable. Never add a
silent migration shim or retain two active persistence schemas.
