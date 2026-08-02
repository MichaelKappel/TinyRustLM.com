# TinyRustLM Distributed Memory Sync and Recovery Architecture

## Repository grounding and design target

Direct inspection of `E:\Source\Rust\TinyRustLM.com` was not available from this environment, so the repository grounding in this report is based on the public TinyRustLM, MemoryEndpoints, LocalEndpoint, and Multi-Agent-Memory materials that describe the current behavior, boundaries, and storage model.

TinyRustLM’s published surface already fixes the most important constraint: it is intentionally browser-local, states that prompts are not sent to a server, binds an extracted `.uai` folder as a UAIX memory deck, supports P2P through manifests, peer proof, and share metadata, and keeps local control behind explicit approval rather than silent remote command execution. In other words, TinyRustLM is already local-first by design, so distributed memory has to be an additive sync layer, not a replacement for local memory ownership. citeturn17view1turn17view0turn2view0

MemoryEndpoints and MultiAgentMemory establish the second hard constraint: local `.uai` startup memory stays active always; reviewed local long-term memory is separate from hosted workspace memory; current-message coordination is kept distinct from durable memory; the workspace key is returned once and the server stores only a hash; and receipts plus redacted audit evidence already exist as first-class concepts. That means the right architecture is layered, not monolithic, and it must preserve the local `.uai` and local durable-memory tiers even when hosted sync is available. citeturn2view2turn5view0turn5view1turn15view0

The current MemoryEndpoints runtime is also intentionally small and conservative. The public repository describes file-backed local storage, stdlib SQLite, and MySQL/MariaDB backends, and documents tests that already cover protected workflows, idempotency, audit-log readback, and storage parity. That strongly argues against a large new distributed subsystem unless the requirements truly demand it. They do not. The smallest correct design is the one that preserves the current local-first model, adds authoritative remote receipts, and leaves more complex collaboration machinery out until there is real evidence it is needed. citeturn2view2turn15view0

## Recommended architecture

The recommended architecture is a **hybrid local-first, server-receipted, revision-DAG model** with four durability levels: browser cache and queue, local durable `.uai` and Markdown projection, authoritative MemoryEndpoints receipts, and optional public-safe P2P announcement projection. The browser remains the fast execution surface. Local `.uai` and Markdown remain the immediate, outage-proof memory base. MemoryEndpoints becomes the authoritative cross-device convergence service only when it returns a receipt. That matches TinyRustLM’s local-first posture and MemoryEndpoints’ existing proof-oriented workflow. citeturn17view1turn2view2turn5view1turn20view0

A heavier design would be premature. Event sourcing is valuable because an append-only store can reconstruct history and improve auditability, but Microsoft’s guidance is explicit that it introduces significant trade-offs, costly migration, and long-lived design constraints. CRDTs are excellent when the data type can be expressed with merge rules that satisfy strong eventual consistency properties such as commutativity, associativity, and idempotence. Dotted version vectors exist because full causality tracking can either lose information or grow with the number of clients or updates. Cassandra-style last-write-wins is simple, but it depends on timestamps and clock correctness. Dynamo’s lesson is that if you want to avoid losing concurrent updates, you must acknowledge divergent versions explicitly and reconcile them deliberately. citeturn25view2turn26view0turn26view1turn25view3turn25view1

For TinyRustLM memory, that trade-off points to one clear answer. Durable memory here is mostly summary text, Markdown, references, tombstones, and handoff material. Those are not safe to merge silently the way a set-union CRDT is. They also cannot safely use last-write-wins without documented and accepted data loss. The smallest architecture that satisfies the requirements is therefore **append-only mutation receipts plus materialized latest state, with optimistic concurrency based on exact parent heads and explicit conflict objects**. It is simpler than full event sourcing, safer than last-write-wins, and more appropriate than CRDTs for prose-heavy memory. citeturn25view2turn26view0turn25view3turn25view1

The tier responsibilities should be treated as follows:

| Tier | Role | When a local save is considered complete | When sync is considered complete |
|---|---|---|---|
| Local short-term `.uai` | Active startup continuity and operational short-term memory | After durable local write or local projector commit | Never required for local success |
| Local durable Markdown and references | Reviewed, durable local long-term memory | After atomic local file write or durable local projector commit | Never required for local success |
| Browser-session hosted memory state | Fast edit buffer, cached head set, pending queue, recent search view | After IndexedDB transaction commit | Never authoritative by itself |
| MemoryEndpoints `status` | Short-term cross-device synchronization lane | Queued locally after local commit | Only after authoritative receipt |
| MemoryEndpoints `handoff` | Durable cross-device lane | Queued locally after local commit | Only after authoritative receipt |
| Optional LocalEndpoints | Desktop bridge for local files, approvals, and keystore-like integration | Improves local durability and recovery | Not required for core correctness |
| Optional P2P metadata | Public-safe share lane only | Optional projection | Never counts as private-memory synchronization |

Within one browser origin, the coordination primitives should be native browser ones instead of custom polling. IndexedDB is specifically intended for significant structured client-side storage and offline work. Web Locks is specifically intended to let only one same-origin tab or worker coordinate access to a shared resource such as network-to-IndexedDB sync. BroadcastChannel is the correct same-origin message bus for invalidation, queue depth, and head-change notifications. Those primitives help with same-origin tabs and workers only; they do not solve cross-browser or cross-device coordination, which is exactly why MemoryEndpoints still needs an authoritative receipt model. citeturn21view0turn21view1turn21view2

## Data model and synchronization protocol

The core protocol should use **stable memory identity, immutable revisions, and idempotent operation envelopes**. Every logical memory item gets one permanent `memory_id`. Every mutation emits one immutable `revision_id` and one transport envelope `event_id`. The durable state is the revision graph plus the current authoritative leaf set for each `memory_id`. This is directly aligned with Dynamo’s model of branching versions and explicit reconciliation, but smaller: because TinyRustLM has one authoritative hosted convergence service, it does not need a full version vector on every record. It only needs exact parent-head matching plus local logical clocks for deterministic ordering and observability. citeturn25view1turn26view1

The object model should be:

| Object | Definition |
|---|---|
| **Canonical memory identity** | `memory_id`, generated once on first creation and never reused |
| **Event identifier** | `event_id`, one immutable identifier for one logical mutation envelope |
| **Revision identifier** | `revision_id`, one immutable identifier for one concrete content revision |
| **Idempotency key** | Stable retry key derived from target tier, event ID, and payload fingerprint |
| **Parent relationship** | `parent_revision_ids[]`, the exact authoritative leaves the editor saw when it created the new revision |
| **Supersedes relationship** | `supersedes_revision_ids[]`, revisions explicitly made obsolete by a merge, promotion, or resolution |
| **Logical clock** | `device_lamport`, monotonic per device for deterministic local ordering |
| **Synchronization checkpoint** | `last_server_seq`, `last_receipt_id`, `last_indexed_seq`, `workspace_epoch`, `device_id` |
| **Conflict object** | Explicit object containing competing heads, the shared base, resolution status, and required reviewer |
| **Tombstone** | Durable deletion revision that blocks resurrection and carries purge metadata |
| **Reconciliation receipt** | Redacted authoritative proof returned by MemoryEndpoints that binds receipt ID, event IDs, sequence, and persistence state |
| **Public-safe P2P announcement** | Separate projection object containing only shareable metadata, hashes, proofs, and expiry |

The concurrency rule should be **exact-leaf optimistic concurrency**, not wall-clock ordering. A client saves the exact parent leaf set it observed. The server accepts the new revision only if the current authoritative leaf set for that `memory_id` still matches the submitted parent set, or if the incoming event is a retry of a previously accepted event with the same idempotency key and fingerprint. If the leaf set changed in the meantime, and the body meaningfully differs, that is a conflict. If the server state is now a tombstone, that is a delete conflict. This is the smallest correct rule because it avoids a full version vector on every record while still making concurrent edits explicit instead of inferred from timestamps. citeturn25view1turn25view3

The browser queue and browser cache should live in IndexedDB. That choice is grounded both in capability and in risk. IndexedDB is transactional and designed for large structured data, whereas Web Storage is string-only and much smaller. At the same time, browser data remains origin-scoped and may be evicted under storage pressure unless persistence is granted, and even persistent storage is still subject to browser policy and user action. TinyRustLM should therefore request persistent storage, but it must not treat browser storage as the only durable copy of important memory. citeturn21view0turn21view3turn22view0

The local pending-operation queue should persist the payload, routing metadata, and retry state, but never the workspace credential itself:

```json
{
  "queue_id": "ulid",
  "workspace_id": "workspace-123",
  "device_id": "device-456",
  "agent_id": "tinyrustlm-agent",
  "memory_id": "mem-...",
  "event_id": "evt-...",
  "revision_id": "rev-...",
  "target_tier": "memoryendpoints.status|memoryendpoints.handoff",
  "operation_type": "create|update|delete|resolve|promote",
  "idempotency_key": "sha256:...",
  "payload_fingerprint": "sha256:...",
  "parent_revision_ids": ["rev-old-head"],
  "supersedes_revision_ids": [],
  "scope_binding": {
    "visibility": "private|workspace|public_p2p",
    "user_id": "optional",
    "device_id": "optional",
    "agent_id": "optional",
    "project_id": "optional",
    "goal_id": "optional",
    "task_id": "optional"
  },
  "device_lamport": 418,
  "phase": "queued|sending|acked|conflict|blocked_revoked|quarantined",
  "attempt_count": 0,
  "next_attempt_at_utc": "2026-07-10T20:15:00Z",
  "requires_authentication": true,
  "requires_workspace_epoch": 8,
  "last_error_code": null,
  "payload_ref": "local-blob-or-ciphertext-ref"
}
```

The retry contract should reuse the same idempotency key for every retry of the same logical operation and should reject reuse of that key with a different fingerprint. That is exactly the operating model described in the Web idempotency guidance: the same key is used when a POST or PATCH is resent, the key identifies the logical request, and the server may store a fingerprint to detect mismatched replays. citeturn25view4

The tombstone schema must be first-class:

```json
{
  "revision_id": "rev-delete-...",
  "memory_id": "mem-...",
  "kind": "tombstone",
  "parent_revision_ids": ["rev-live-head-..."],
  "deletion_mode": "soft_delete|forget_request|scope_purge",
  "deleted_by_device_id": "device-456",
  "deleted_by_agent_id": "tinyrustlm-agent",
  "reason_code": "user_forget|manual_delete|policy_expiry",
  "retain_until_utc": "2026-10-08T00:00:00Z",
  "purge_body_after_utc": "2026-07-10T21:00:00Z",
  "minimal_proof_hash": "sha256:...",
  "public_projection_removed": true
}
```

A practical default retention policy is: `status` revisions compact quickly and expire aggressively; `handoff` revisions remain durable until policy or explicit delete; tombstones live long enough to prevent resurrection by long-offline devices; and “forget this” purges body content first while retaining only the smallest defensible proof object needed to show that deletion ran. That retention posture matches MemoryEndpoints’ existing emphasis on redacted receipts and redacted audit evidence rather than raw payload exposure. citeturn2view2turn20view0

The scope model should be immutable per revision and enforced at projection time. A revision belongs to exactly one workspace and one visibility domain. Allowed internal scopes are `user`, `device`, `agent`, `project`, `goal`, and `task`. Public P2P memory must live in a separate `public_p2p` domain with its own projector. Promotion from a narrower private scope to a wider one must always be explicit and must create a new revision or projection record; it must never happen as an incidental side effect of indexing or synchronization. This cleanly prevents the cross-scope leakage scenarios the requirements call out. citeturn5view1turn2view2turn2view4

The field split between private and shareable data should be hard-coded and schema-validated:

| Private-only fields | Shareable fields |
|---|---|
| Full body text, raw Markdown, `.uai` fragments, hidden prompts, local file paths, local reference URIs, embeddings, raw logs, workspace-internal identifiers when sensitive, credential-derived tokens, proprietary routing hints | Public-safe title, public-safe summary, approved tags, content hash, revision hash, lane kind, coarse scope label, public attachment hashes, redacted proof flags, receipt IDs, compatibility metadata, announcement expiry |

For encryption boundaries, the correct split is also simple. Keep the **workspace credential session-only and memory-only**. Persist only a **device-local, non-extractable key** for local encryption or signing of the queue and browser cache, if local at-rest encryption is desired. Web Crypto’s `CryptoKey.extractable = false` property is the correct browser primitive for that boundary, because it allows the browser to use the key without exposing export through the normal Web Crypto APIs. The important part is that the persisted device-local key is not itself enough to authorize hosted synchronization; the user still has to reauthenticate for upload. That satisfies the requirement not to persist workspace credentials just to make offline sync easier. citeturn21view4turn2view2turn15view0

## Failure handling and recovery algorithms

The single most important write-path rule is this: **a save may be locally committed without being remotely synchronized, but it may not be called synchronized until a receipt exists**. MemoryEndpoints already presents read-after-write proof and `persisted=true` as required evidence. TinyRustLM should surface that distinction explicitly in state and UI as `saved locally`, `queued for sync`, `synchronized`, `conflict requires review`, and `blocked by revocation`. citeturn5view1

**Initial sync** should work as follows. After interactive authentication, the client acquires a global sync lock with Web Locks, opens IndexedDB, loads the latest checkpoint, fetches workspace epoch and device status, and then paginates hosted changes strictly after `last_server_seq`. If no checkpoint exists, it performs a full bootstrap of `status`, `handoff`, unresolved conflicts, and tombstones. Each page is applied transactionally to the browser store, then projected into session cache and local search index. Only after the page transaction commits does the checkpoint advance. That keeps bootstrap replay deterministic and crash-safe. citeturn21view1turn21view0turn2view2

**Incremental pull** should be cursor-based on a server-assigned monotonic `server_seq`. That makes 10,000-record histories tractable, makes pagination deterministic, and makes compaction practical. If old hosted events have been compacted, the pull API should return a compacted snapshot record for the affected `memory_id` plus the current leaf set and latest tombstone state. Search should never be the source of truth; it is a projection. Every search result should therefore report an `indexed_through_seq`, and if the caller needs fresher data than that watermark guarantees, the client should fall back to authoritative head lookup for those memory IDs. citeturn25view2turn21view0

**Offline save** should be a single local transaction for browser state. The sequence is: acquire the per-memory lock, read the current local head set, increment `device_lamport`, mint `revision_id`, mint `event_id`, compute fingerprint and idempotency key, then write the revision, head set, and queue record in one IndexedDB transaction. Only after that transaction commits should TinyRustLM report `saved locally`. Local `.uai` or Markdown projection then runs as a second phase, using temp-file-plus-rename semantics if a local filesystem bridge is available. If the browser transaction succeeds and the projector fails, the state is `saved locally, local durable projection degraded, sync pending`; it is not lost, and it is not yet synchronized. citeturn21view0turn5view3turn5view4

**Reconnect push** should always start with fresh authentication, because credentials are session-only. Once authenticated, the client reacquires the global sync lock, pulls first so it sees revocations, tombstones, and newer heads, and then pushes local queue items oldest-first by `(requires_workspace_epoch, device_lamport, event_id)`. Each POST uses the same idempotency key across retries. If a request times out after send, the client stays in `sending` and either looks up the receipt by idempotency key or retries the same request with the same key. It must never infer success from elapsed time or from a locally incremented counter. citeturn25view4turn5view1

**Conflict detection** should be intentionally strict for body-bearing memory. The server decision table is:
- same `idempotency_key` and same fingerprint: return the prior receipt;
- new mutation whose `parent_revision_ids[]` exactly matches the current authoritative leaf set: accept;
- current authoritative leaf is a tombstone: reject with `deleted_conflict`;
- authoritative leaf set differs and normalized body hashes differ: create a conflict object;
- authoritative leaf set differs but normalized body hashes are equal: deduplicate and return a receipt without creating a second logical body revision.

That rule prevents both lost updates and fake conflicts from harmless retries. It also means two devices changing the same durable memory while offline will produce two branches, never a silent overwrite. That behavior is much closer to Dynamo’s explicit multi-version model than to timestamp arbitration, and that is exactly why it is the right choice here. citeturn25view1turn25view3

**Conflict resolution** should only auto-merge fields that are explicitly merge-safe: set-like tags, references keyed by canonical ID, monotonic acknowledgement flags, and derived projector metadata such as index watermarks. It should never auto-merge summary prose, Markdown paragraphs, handoff bodies, or factual text unless the bodies are byte-identical after normalization. Resolution therefore creates a new merge revision whose parent list contains every competing leaf, and whose `supersedes_revision_ids[]` records the branches it closes. Unresolved conflict objects remain visible until this explicit merge exists. That satisfies the requirement not to discard conflicts silently. citeturn26view0turn25view1

**Deletion propagation** should always be revision-based. Delete emits a tombstone revision, hides the item from normal reads, removes it from shareable projections, and queues remote propagation. Search indexes remove the projected document at the next projector pass, but the tombstone remains discoverable by ID so that an offline device cannot later resurrect the deleted body. If an offline device eventually uploads a stale child of a deleted head, the server responds with `deleted_conflict`, returns the tombstone head metadata, and requires explicit creation of a *new* `memory_id` if the user truly intends to recreate the memory. Deletion must never be treated as a weak hint. citeturn25view1turn2view2

**Device revocation and workspace-key rotation** should be separate controls. Workspace-key rotation invalidates authenticated sessions and forces reauthentication, but it does not by itself destroy locally queued data. Device revocation is stronger. Once the client pulls a revocation record for its `device_id`, every non-acked queue item from that device moves to `blocked_revoked`, sync is disabled, and the user may only export those items locally for review. They must not later upload under a different device identity, because that would defeat revocation entirely. This keeps revocation meaningful without requiring the workspace credential to be persisted locally. citeturn2view2turn15view0

**Recovery after interrupted write** should be journal-driven. Every queue item has a phase marker, and every local durable projection uses a write-ahead temp artifact. On restart, TinyRustLM scans for incomplete prepare records and drops them, reconstructs missing queue rows from committed revisions, checks `sending` items by idempotency key before retrying, and resumes or discards temp file projections deterministically. That converts crashes and browser kills into replay and reconciliation instead of guesswork. It also gives you a clean proof surface for the “server timeout after accepting a write” scenario, because the recovery path is deterministic. citeturn25view4turn21view0

Service degradation should be explicit and honest. If MemoryEndpoints is down, local saves still succeed, queue depth still grows, and local search still works against the local projection, but the system says `saved locally; sync pending`. If browser storage is lost, restoration begins from local Markdown and `.uai` if those exist, then from hosted `status` and `handoff` after reauthentication. Browser-only unsynced state that never projected anywhere else cannot be honestly claimed as recoverable, because browser data is origin-scoped and may be evicted or cleared. That is precisely why the architecture keeps local durable projection as a separate tier and requests persistent browser storage without trusting it blindly. citeturn21view3turn22view0turn2view2

Auditable proof of successful sync should be a **redacted reconciliation receipt**, not a secret-bearing report. For every acknowledged batch, persist `receipt_id`, `event_id[]`, `revision_id[]`, `server_seq_high_watermark`, `idempotency_key_hash[]`, `payload_fingerprint[]`, `persisted=true`, visibility flags, and a final `batch_proof_hash`. This is directly aligned with MemoryEndpoints’ redacted receipt example and with its documented requirement to prove persisted read-after-write behavior without exposing workspace keys or private payloads. citeturn20view0turn5view1

## Verification, TDD, SLOs, and observability

The verification style should match the project’s existing philosophy: bounded claims, deterministic tests, redacted proof artifacts, and no extrapolation from one happy-path smoke test. The public repository materials already emphasize idempotency tests, protected-flow verification, `.uai` audits, and redacted receipts. Distributed memory should extend that same discipline with explicit multi-actor, multi-failure replay. citeturn2view2turn15view0

The required deterministic TDD scenarios should be:

| Scenario | Deterministic setup | Expected result |
|---|---|---|
| Two tabs saving simultaneously | Same origin, same `memory_id`, same parent head, tab A acquires Web Lock first | Tab A commits revision A; tab B receives the updated head over BroadcastChannel and either deduplicates identical content or creates a local conflict object; no duplicate remote write |
| Two devices changing the same durable memory | Device A and B both edit from head H while offline | First authoritative upload becomes current leaf; second becomes explicit sibling conflict; no silent overwrite |
| Offline short-term and long-term writes | Save one `status` and one `handoff` while the endpoint is unreachable | Both commits succeed locally and remain queued until a receipt exists |
| Duplicate retries | Same queued operation is retried multiple times with the same idempotency key | One authoritative receipt and one accepted revision |
| Server timeout after accepting a write | Hosted service persists the write but drops the response | Client stays `sending`, uses receipt lookup or same-key retry, and lands on the original receipt exactly once |
| Stale search indexes | Index watermark is behind the latest accepted head | Search response is marked stale and direct authoritative lookup returns the fresh head or conflict metadata |
| Tier misclassification | A long-lived durable memory is submitted as `status`, or a transient heartbeat is submitted as `handoff` | Validation rejects or requires explicit promotion; no silent lane swap |
| Cross-scope leakage | Task-private memory is accidentally projected to project scope or `public_p2p` | Projection is blocked and audited; private body never widens implicitly |
| Deletion while another device is offline | Device A deletes; Device B edits the stale live head offline | Tombstone wins; Device B receives `deleted_conflict`; reuse requires a new `memory_id` |
| Revocation before queued operations are uploaded | Device is revoked after local commit but before later upload | Queue moves to `blocked_revoked`; nothing uploads later under that revoked identity |
| Malicious peer metadata | Peer announcement includes private-body fields, spoofed hashes, or oversized content | Schema validation and hash/signature checks fail closed; no private ingestion |
| Corrupted local queue | Startup finds queue checksum mismatch | Corrupted rows are quarantined; safe subset is rebuilt from revision journal; alert emitted |
| Service outage and recovery | Hosted service is down for one hour and 500 operations accumulate | Local saves continue; queue grows; backlog drains in order after service recovery |
| 10,000-record pagination and compaction | Full bootstrap spans 10k records across a compaction boundary | Checkpoint remains monotonic; compacted snapshots preserve heads and tombstones; no record loss |

The production SLOs should separate local success from hosted convergence:

| Objective | Proposed SLO |
|---|---|
| Local browser save latency | p95 under 75 ms for IndexedDB commit; p99 under 150 ms |
| Local durable projection latency | p95 under 300 ms for `.uai`/Markdown atomic projection when a desktop or local bridge exists |
| Authoritative remote save latency | p95 under 2 s and p99 under 10 s from authenticated send to receipt under healthy network and healthy endpoint |
| Local search latency | p95 under 150 ms for 10,000 locally indexed records |
| Remote search latency | p95 under 800 ms for normal scoped hosted search |
| Synchronization lag after reconnect | p95 under 5 s for light backlog; p99 under 60 s for 10,000 queued records |
| Local-only save availability | 99.99% monthly |
| Hosted sync-path availability | 99.9% monthly |
| Post-receipt hosted durability | 99.999% durability objective, validated by restore drills and zero accepted-event loss budget |
| Recovery after browser storage loss | Usable state restored within 5 minutes after reauthentication for 10,000 hosted records |

Observability has to be redacted by default. Store `workspace_id_hash`, not the workspace key; `memory_id_hash`, not the body; `scope_type`, not the full private scope path; `idempotency_key_hash`, not the payload; and then `receipt_id`, `server_seq`, `device_id`, `agent_id`, `queue_depth`, `attempt_count`, `conflict_count`, `revoked_flag`, `index_watermark_lag`, `projection_status`, and browser storage estimate numbers. Never log raw prompts, `.uai` bodies, Markdown bodies, hidden references, or any credential material. That is consistent with the project’s existing insistence that no raw secrets belong in reports, logs, or public pages. citeturn21view3turn22view0turn15view0

The alert set should be small but sharp: queue depth above threshold for more than 15 minutes; repeated `sending` timeouts with no matching receipt; conflict spike above baseline; resurrection attempts against tombstoned memory; blocked uploads due to revocation; index lag above checkpoint tolerance; storage persistence not granted while queue size is high; projector failure rate above threshold; and any detection that a P2P announcement carried a field classified private. Those are the conditions that actually indicate correctness risk, not just transient noise. citeturn21view3turn22view0turn2view4

## Implementation roadmap

The safest delivery plan is a sequence of vertical slices that always preserve the current TinyRustLM local-first behavior and that can be rolled back by disabling the new sync feature flags without invalidating `.uai` or local durable memory. That matches the existing project boundary model, which already separates active local memory, hosted workspace memory, and public-safe documentation rather than collapsing them into one undifferentiated store. citeturn2view2turn15view0

| Slice | Code boundaries | Migration concerns | Tests required | Rollout controls | Rollback behavior | Promotion evidence |
|---|---|---|---|---|---|---|
| Canonical envelope and local queue | Add browser-side revision envelope model, deterministic IDs, queue store, and checkpoint store inside the TinyRustLM browser memory boundary | Import existing in-browser memory as legacy snapshots without rewriting current `.uai` files | Unit tests for ID generation, queue persistence, crash replay, and queue corruption recovery | Feature flag `memory.sync.localQueue` | Disable flag and continue current local-only memory path | Deterministic local-only suite passing with no behavior regression |
| Receipted push for `status` | Add dedicated MemoryEndpoints adapter for the short-term `status` lane only | No durable memory migration yet | Idempotency, duplicate retry, timeout-after-accept, auth-loss, and outage-drain tests | Feature flag `memory.sync.remoteStatus`, workspace allowlist | Turn off push; queue remains local and unsent | Redacted receipt examples and read-after-write proof with no secret exposure |
| Durable `handoff` projection | Add durable classifier, Markdown-to-handoff projector, and durable hosted lane adapter | Backfill reviewed local durable memory with imported `memory_id`s and `source=legacy-import` metadata | Promotion tests, tier misclassification tests, projector atomicity, and retention-policy tests | Feature flag `memory.sync.remoteHandoff` | Disable projector and keep local Markdown authoritative | Two-device durable handoff round-trip with receipts and restore proof |
| Incremental pull, pagination, and restore | Add hosted cursor handling, checkpoint advancement, index watermarks, and bootstrap/restore pipeline | Introduce compacted snapshot handling without invalidating existing checkpoints | 10,000-record pagination, compaction, browser-storage-loss restore, and stale-index tests | Feature flag `memory.sync.pull`, page-size override | Freeze checkpoint advancement; local saves continue | Full bootstrap from empty browser on second device with matching heads |
| Conflict objects, tombstones, and review flow | Add conflict state machine, delete/tombstone projector, and explicit review/resolution UX or agent flow | Existing latest-state assumptions must tolerate multiple leaf heads | Same-memory conflict, delete-while-offline, and no-silent-overwrite tests | Feature flag `memory.sync.conflicts` | Conflict records persist but resolution UX can be disabled | Recorded conflict drill showing both branches preserved and later resolved by superseding merge |
| Device registry, revocation, and key rotation | Add device identity wrapper, revocation handling, blocked queue state, and workspace epoch enforcement | Existing sessions must reauthenticate cleanly on epoch mismatch | Revocation-before-upload, workspace-key rotation, and blocked-queue export tests | Feature flag `memory.sync.deviceSecurity` | Disable device-security layer for rollback while keeping session-only hosted auth | Verified revocation drill and proof that no workspace credential was persisted locally |
| Optional LocalEndpoints and public-safe P2P | Add desktop bridge adapter and separate P2P share projector | Must not alter correctness when absent | Malicious peer metadata, no-private-body projection, and local-approval-boundary tests | Independent flags `memory.sync.localEndpoints` and `memory.sync.p2p` | Disable adapters independently; core local and hosted sync still work | Signed announcement examples, schema validation results, and proof that no private bodies left the private scope |

Before any slice is promoted, the evidence bar should stay high: deterministic tests, redacted proof artifacts, live-but-bounded verification of the deployed feature or route, and explicit readiness language when a dependency is still gated. That is already the project’s public operating style through route verification, `.uai` auditing, package exclusion, secret scanning, and enterprise-readiness reporting, and it is the right standard for distributed-memory work too. citeturn2view2turn15view0

The resulting architecture is intentionally conservative. It gives TinyRustLM useful memory that can be available anywhere the user can authenticate in a browser, but it keeps local `.uai` and local durable memory primary for immediacy, privacy, and outage survival. It avoids pretending that a browser cache is permanent, avoids pretending that a queued write is synchronized, avoids last-write-wins data loss, avoids premature CRDT complexity, and avoids leaking private memory into P2P. For this problem shape, that is the smallest architecture that is both correct and practical. citeturn17view1turn2view2turn25view2turn25view3turn26view0