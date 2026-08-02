# TinyRustLM Browser Memory and Notification Intake Memory

## Stable Decision

TinyRustLM will implement optional MemoryEndpoints active memory for accountless browser clients through the live `memoryendpoints.virtual_uai_contract.v1`, not through report-invented APIs. The live contract has 12 required records, deterministic startup order, a 64 KiB record limit, `expectedRevision` concurrency, and first-class package/record/startup routes.

The database-backed active package is a narrow exception. Clients with a durable local filesystem continue to use local `.uai` as first-load authority and MemoryEndpoints as optional reviewed synchronization and durable recall.

## Current Evidence

- Four research reports are preserved under `docs/report-intake/2026-07-12/memory-connectors-and-notifications/`.
- The provisioned TinyRustLM virtual package was `setup_required`, `readyForStartup=false`, and 0/12 active during live review.
- The current browser connector already has a credential-free IndexedDB outbox, Web Locks, BroadcastChannel, pull-before-push, receipt verification, explicit distributed conflicts, and guarded retrieval.
- The live `current-message` lane exposes durable message, notification, and delivery objects with cursor metadata, `responseRequired`, response disposition, and acknowledgement status.

## Browser Memory Rules

1. Persist non-secret workspace-scoped agent ID and agent name; keep device and session identity separate.
2. Keep the workspace key in memory by default. Optional remember-me requires explicit consent, encrypted storage, and a user-held unlock secret that is never persisted.
3. A service worker is not a security boundary, and a non-extractable key does not eliminate same-origin compromise.
4. Activate hosted context only after exact readback of all 12 records.
5. Use `expectedRevision`; no silent last-write-wins or model-decided conflict merge.
6. Report offline work as `saved locally; synchronization pending` until a matching authoritative receipt exists.
7. Keep active records date-free and bounded. The long-term record is a pointer ledger; there is no silent promotion.
8. Preserve the locked UI and place setup/conflict states in the existing advanced memory surface.

## Notification Rules

1. A durable cursor and recipient-scoped inbox are authoritative.
2. Adaptive polling is the baseline. Long polling and SSE are a hint channel only.
3. No inbound port is required for the browser. Webhooks and wake daemons are optional managed-host accelerators.
4. Delivery is at least once with stable IDs, idempotent processing, explicit acknowledgement, bounded retry, and cursor-reset recovery.
5. `responseRequired` is distinct from viewed acknowledgement. Post and read back substantive meeting-room evidence before acknowledging completion.
6. Personal coordination remains visible across devices unless a message is explicitly claimable work; do not silently load-balance it with queue-worker semantics.

## Ownership

TinyRustLM owns strict Rust/C#/browser client contracts, 12-record setup, startup validation, local coordination, guarded retrieval, notification polling, and tests. MemoryEndpoints owns database durability, tenancy, package and revision authority, cursor/unread state, acknowledgement, optional live hints, and backend security. Contract gaps are reported in the TinyRustLM hosted-memory goal room rather than patched with client-only substitutes.

## Next Large Slice

Build strict shared virtual-UAIX fixtures, read-only package/startup inspection, stable agent-name recovery, test-generated 12-record setup, expected-revision conflicts, and deterministic `current-message` cursor polling. Prove restart, local-storage loss, offline/reconnect, multi-tab, concurrent-device, revocation, stale cursor, tenant isolation, and secret safety before any completion claim.

## Source Identities

- `Accountless Browser AI MATM Memory Connector.md`: `d9a94002e830bface550afe3a50f2fe31883c191235677a52658ba4366b40849`
- `Browser AI Memory Connector Architecture.md`: `dd0ec1a6841dfada493998bad1979ee4c786a392721de25e4bd39a4069589fbb`
- `Disconnected Agent Notification Architecture.md`: `f52cc1698efcd2f42e32f68f37a9462ce83c2c6c8bf14d7eb0482d77428264ec`
- `Disconnected-Agent Notifications for Self-Hosted MATM Coordination.md`: `b571097d84b85c2834ec4b73eb9482d104d8126c8760c41ab6254e572b0ef5e1`

## Completion Boundary

The reports are processed when their byte-exact copies, dispositions, `.uai` pointers, tests, and hosted coordination evidence pass. The connector remains incomplete until all 12 virtual records and notification flows have live, cross-browser, conflict-safe evidence. The broader model-quality goal remains open.
