# vNext Campaign Runner

## Status

`tinyrustlm.vnext.campaign-runner.v1` is the sole clean-slate local campaign
projection runner. Its frozen 6,855-byte profile has SHA-256
`6fe8698fe46f2ba9e427319f1f5e94ec3c3e24e214a2a58d828827040ac2f571`.
The implementation is `tinyrustlm/tools/vnext-campaign-runner.js`; focused
conformance is `tinyrustlm/tests/vnext-campaign-runner.test.js`.

This checkpoint implements deterministic local orchestration over already
validated campaign stores. It is not a release authorization, public status
endpoint, live campaign receipt, independent observer, MemoryEndpoints
connection, catalog announcement, or operational release-surface cutover. Campaign
counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.

## Authority Boundary

The runner is orchestration, not a second evidence engine. It:

1. opens one campaign-owned receipt store, one public-subject store, and one
   campaign-artifact store under pairwise-disjoint absolute roots;
2. reads one exact persisted plan by caller-supplied SHA-256;
3. observes every active receipt and every active public subject twice;
4. rejects any difference in membership, exact wire hash, byte length,
   aggregate bytes, profile identity, or plan bytes;
5. persists an immutable start record for that exact snapshot;
6. sends the second observation's owned byte copies, exact plan, caller pins,
   and caller-trusted verification time to the sole generated
   `tinyrustlm.vnext.campaign-evidence-wasm.v1` adapter;
7. asks the same Rust boundary to validate the returned projection bytes;
8. persists the exact projection through the campaign-artifact store; and
9. persists an immutable completed or failed terminal operation record.

The runner has no API for receipt selection, subject selection, caller verdicts,
best-of-N, output repair, network lookup, clock discovery, environment
discovery, retries chosen by result quality, or stored-projection promotion.
The generated adapter remains byte transport only. Rust owns plan,
currentness, identity, Ed25519, authority, objective counting, and result
validation semantics.

## Store Ownership

The four roots are pairwise disjoint and reject parent/child overlap:

- `campaignArtifactStoreRoot` owns exact plan and projection-result history;
- `receiptStoreRoot` owns the complete receipt DAG for one campaign;
- `subjectStoreRoot` owns only accepted public-safe identity documents for
  that same campaign; and
- the runner root owns operation records, the exclusive operation lock, and
  quarantined runner metadata.

Receipt and subject roots are campaign-owned closed inputs. The runner does not
filter a shared global store by campaign because selecting a convenient subset
would make projection non-reproducible and could hide conflicting evidence.
Callers must provision the correct campaign roots before invoking the runner.

## Exact Snapshot Protocol

Each observation performs a bounded store rebuild, takes the store's sorted
active identity list, reads every named member through that store's validating
read boundary, copies every exact wire, hashes every copied wire, and computes
a domain-separated snapshot identity over sorted records containing:

- member identity;
- exact wire SHA-256; and
- exact byte length.

The snapshot also binds store profile ID, store profile SHA-256, member count,
and aggregate bytes. A second complete observation must be byte-for-byte and
member-for-member identical to the first. Projection uses only the second
observation's private copies. A write after that observation is later state and
must appear in a later operation; it does not mutate the completed immutable
snapshot.

The runner caps projection input at 2,048 receipts, 2,048 subjects, 64 MiB of
receipt bytes, and 64 MiB of subject bytes, matching the generated Rust/WASM
boundary. It rejects over-limit stores rather than choosing a subset.

## Operation History

Runner records use
`tinyrustlm.vnext.campaign_runner_operation.v1`. They are internal public-safe
verifier metadata. They are explicitly not signed receipts, claims, objective
evidence, release authority, or currentness pointers.

Every record is exact canonical JSON with a domain-separated content identity
and a create-only SHA-256 path. A start record binds:

- caller operation ID;
- exact plan ID and plan SHA-256;
- plan campaign and environment;
- caller-expected campaign and environment;
- caller-trusted root and terminal authority receipt IDs;
- caller-trusted verification time;
- exact WASM module SHA-256;
- all relevant profile identities; and
- complete receipt and subject snapshots.

A terminal record references exactly one start record. `completed` terminals
bind one persisted projection-result SHA-256 and carry no error. `failed`
terminals carry one bounded error code and step and no projection identity.
Conflicting starts, conflicting terminals, missing starts, identity/path drift,
unknown entries, noncanonical records, and old incomplete temporaries are
quarantined or rejected. No mutable `current`, `latest`, or `passed` file
exists.

## Interruption And Concurrency

One append-only lock generation protects a runner root. Every claim has a
monotonic generation number, random nonce, process ID, predecessor-claim hash,
reason, and schema. Normal completion adds a create-only release bound to the
exact claim. No claim or release is replaced, renamed, quarantined, or deleted.
A live or indeterminate latest owner causes `campaign_runner_busy`; a released
or provably absent latest owner permits contenders to race on exactly one next
generation path, where hard-link create-if-absent elects one winner. This
avoids check-delete-create stale-lock races. PID reuse can produce a safe false
busy result; it cannot authorize unsafe reclamation. Lock history supplies no
projection time or evidence currentness.

The start record is created before Rust projection. The terminal record is
created only after exact projection persistence. A process death can therefore
leave a start without a terminal; rebuild classifies that operation as
`interrupted`. The same operation ID may resume only when a fresh two-pass
snapshot produces the exact same start wire. It then reruns Rust and
idempotently reuses an exact projection if one survived the interruption. A
changed snapshot or caller pin requires a new operation ID. Any terminal state
also requires a new operation ID.

Create-only operation files use same-directory exclusive temporaries, bounded
writes, file fsync, no-replacement hard-link publication, exact byte-identical
reuse, directory sync or explicit Node/Win32 unavailability, and exact
readback. This does not close the separate production Win32 directory-handle
flush obligation.

## Failure Semantics

Rust verification failures are never repaired, retried, or converted to a
pass. After a start exists, a bounded failure terminal preserves the exact
public-safe Rust or store error code and step. If failure-record persistence
itself fails, the start remains interrupted and the caller receives
`campaign_runner_failure_record_persist_failed`. Disk-full before start
publication leaves no false terminal. Lock loss and lock-release failure fail
closed.

Raw host paths, evidence bytes, credentials, prompts, private context, known
secret values, and hosted-memory payloads do not enter operation records or
errors. Public subjects are admitted only through the separate five-schema
public subject store.

## Verification

The focused suite covers:

- the byte-pinned frozen profile;
- hostile option accessors, overlapping roots, and WASM substitution;
- honest-zero exact projection and immutable history;
- restart reprojection at a later trusted time with expired-proof withdrawal;
- duplicate-signature no-double-counting and superseded-pass withdrawal;
- exact synthetic 20/50/25/40/20 capacity over 271 receipts and 40 subjects;
- a cross-store write between observations;
- exact bounded Rust failure preservation;
- real child-process death immediately after start hard-link publication;
- stale-lock recovery and fresh reprojection;
- two real processes racing to succeed the same dead lock generation with
  exactly one elected successor;
- a genuinely concurrent child process holding the operation lock;
- disk-full start persistence; and
- canonical operation-record identity validation.

The focused suite passes 13/13. Synthetic completion proves bounded local
capacity only. It does not increment or predict any live campaign counter.

## Remaining Work

- The superseded mutable runner and its isolated test are deleted without an
  alias, fallback, compatibility reader, or second truth path. Cut remaining
  final-attestation, release, dashboard/operator, and public-readback entry
  points over to fresh results from this runner.
- Bind only a freshly returned projection operation into final attestation,
  release authorization, operator status, synchronized documentation, and
  public readback.
- Measure maximum authorized closure latency and peak native/WASM memory on
  target release hosts.
- Complete Rust/Win32 directory metadata flushing, bounded compressed archive
  scanning, and protected equality-list custody before corresponding
  production claims.
- Run authorized real model, browser, MemoryEndpoints, outside-observer,
  catalog, package, and HTTPS release gates. Mocks and synthetic capacity do
  not satisfy those gates.
