# TinyRustLM Browser Memory and Notification Synthesis

## Purpose

This synthesis reconciles four disconnected-agent reports with the actual TinyRustLM browser connector and live MemoryEndpoints contracts. The reports add useful design pressure around browser volatility, identity recovery, durable delivery, and cross-device conflicts. They do not authorize invented APIs, automatic memory promotion, unsafe credential persistence, or claims that a background worker makes browser secrets safe.

The approved TinyRustLM visual design is locked. This work may improve the existing advanced memory settings and status states, but it must not redesign the public shell or active conversation mode.

## Authority Order

When recommendations disagree, use this order:

1. Live MemoryEndpoints contract readback and authoritative receipts.
2. Current TinyRustLM Rust, C#, browser, and test behavior.
3. Reviewed synthesis and TDD documents.
4. Preserved research reports.

The reports' generic `/v1` APIs, OAuth assumptions, database schemas, and transport choices are proposals only.

## Current Measured Baseline

TinyRustLM already has more of the foundation than the reports assume:

- The browser stores the MemoryEndpoints base URL, workspace ID, agent ID, header mode, and tier as non-secret preferences.
- The workspace bearer stays in page memory and is cleared on restore. It is not persisted in localStorage or the IndexedDB outbox.
- IndexedDB holds stable event IDs, hashes, idempotency keys, retry state, receipts, checkpoints, and remote-head state.
- Web Locks elect one same-origin sender and BroadcastChannel carries body-free completion notices.
- Reconnect synchronization pulls before it pushes, and a write is synchronized only after authoritative receipt verification.
- Hosted context is deterministically ranked, deduplicated, bounded, and fenced as untrusted memory data.
- The deployed distributed-sync contract already supports exact-parent revisions, explicit conflicts, tombstones, device epochs, revocation, monotonic changes, and indexed-through reporting.

Live intake review also proved a newer boundary:

- `memoryendpoints.virtual_uai_contract.v1` is implemented.
- It defines 12 required records, deterministic startup order, public-safe validation, optimistic updates through `expectedRevision`, and first-class package/record/startup routes.
- The provisioned TinyRustLM virtual package is real but incomplete: `setup_required`, `readyForStartup=false`, and 0 of 12 records active at review time.
- The live `current-message` response carries durable message/notification/delivery objects, cursor metadata, `responseRequired`, response disposition, and explicit read status.

The client therefore needs a virtual-UAIX adapter and notification discipline. It does not need a second private protocol.

## Accepted Convergence

### Browser continuity is recoverable, not guaranteed

IndexedDB is the correct structured cache and outbox, but browser storage can be cleared, evicted, or private-session scoped. For ordinary clients, local `.uai` remains the preferred active-memory authority and MemoryEndpoints remains optional durable synchronization. The database-backed active package is a narrow exception for accountless browser AIs without a durable local filesystem.

The client must expose honest states: local only, queued, synchronizing, synchronized, stale, conflict, revoked, and recovery required. The exact offline wording is `saved locally; synchronization pending`. It must never imply remote success before a matching receipt.

### Identity has three different lifetimes

Use a stable agent ID and agreed agent name across devices, a device ID for revocation and local outbox ownership, and a session/tab identity for leader coordination. Stable identity is non-secret and may be persisted. The browser must verify the server registration and package binding after authentication and must not silently regenerate or switch an identity when local metadata disappears.

TinyRustLM currently persists `agentId` but hard-codes the display name used during registration. Workspace-scoped `agentName` persistence, registration readback, and recovery selection are concrete client gaps.

### Credential handling is session-first

The default remains user-supplied, page-session, memory-only workspace authentication. Persistent remember-me is optional, explicit, and must use encrypted browser storage plus a user-held unlock secret that is never persisted. A LocalEndpoints host may separately supply an OS-vault-backed secret for the current session.

A service worker is not a security boundary. It may mediate requests or improve lifecycle behavior, but same-origin malicious code can still ask it to act with its authority. A non-extractable Web Crypto key also reduces casual export; it does not prevent hostile same-origin code from invoking cryptographic operations. The client must retain strict CSP, dependency integrity, XSS prevention, bounded message contracts, and no credential-bearing diagnostics.

### The live 12-record contract overrides proposed seven-record abstractions

The required startup order is:

1. `.uai/startup-packet.uai`
2. `.uai/memory-maintenance.uai`
3. `.uai/identity.uai`
4. `.uai/world-context.uai`
5. `.uai/totem.uai`
6. `.uai/taboo.uai`
7. `.uai/talisman.uai`
8. `.uai/progress.uai`
9. `.uai/short-term-memory.uai`
10. `.uai/system-profile.uai`
11. `.uai/receiver-brief.uai`
12. `.uai/long-term-memory.uai`

The short-term record is the explicitly configured hot-memory exception. The long-term record is a pointer ledger into reviewed durable MemoryEndpoints memory and knowledge routes. Active records are never silently promoted into durable memory.

### Conflicts are explicit

Every replacement sends `expectedRevision`. A mismatch blocks the write and presents the current hosted revision plus the local candidate for user-reviewed resolution. There is no timestamp-wins, credibility-score, model-decided, or silent last-write-wins path. Identity, memory-maintenance, totem, taboo, talisman, and persona-affecting records never auto-merge.

### Durable notifications use pull authority

Both notification reports converge on the correct invariant: a durable cursor and recipient-scoped inbox are the correctness layer. Adaptive polling is the universal baseline. Long polling or SSE can reduce latency, but each is a hint channel only. A hint says that the inbox head advanced; it does not carry the only durable work payload.

No inbound port is required for browser, CLI, or desktop clients. Webhooks and local wake daemons are optional managed-install accelerators and are not TinyRustLM browser requirements. Browser tabs cannot be reliably awakened after closure without an external push service or installed helper.

At-least-once delivery, stable event IDs, idempotent processing, monotonic cursors, explicit acknowledgement, bounded retry, quarantine, and cursor-reset recovery are the honest contract. Exactly-once delivery must not be claimed.

## Corrections and Rejections

The following report suggestions are not adopted:

- A Service Worker cannot make a bearer token physically inaccessible to XSS or extensions.
- A non-extractable key does not entirely neutralize same-origin compromise.
- Offline writes cannot proceed "as if" the server accepted them.
- The reports' invented `/v1/memory/*`, OAuth, DPoP, refresh-token, webhook, and mesh APIs do not replace MemoryEndpoints' first-class package/record/startup routes.
- No server-side dreaming, automatic promotion, or anonymous mesh publication is permitted.
- Raw memory trace commands are not added to the public chat surface.
- "Wipe everything" cannot claim hard deletion while the advertised retention contract says hard forget is unsupported.
- Timestamp priority, source credibility, or an LLM cannot silently arbitrate a revision conflict.
- Multiple devices sharing one personal agent identity must not silently divide notifications with queue-worker load balancing unless the delivery explicitly represents claimable work. Coordination messages normally remain visible to the target agent across devices.
- SSE, WebSockets, callbacks, or background sync cannot become the durable record.
- TinyRustLM public Rust or NuGet packages do not expose MemoryEndpoints database schema, tenancy internals, token infrastructure, or proprietary orchestration.

## Ownership Boundary

### TinyRustLM owns

- strict Rust models for the virtual-UAIX contract, package metadata, record writes, startup bundles, revisions, and conflict states;
- C# wrapper APIs in the optional MemoryEndpoints package;
- browser adapters for stable identity, memory-only credentials, 12-record setup, startup validation, local outbox coordination, and guarded context packing;
- deterministic polling/check-in behavior for `current-message` and idempotent acknowledgement;
- public browser tests preserving the locked UI.

### MemoryEndpoints owns

- database durability, tenant and agent binding, package and record persistence, immutable revision history, and retention;
- atomic creation of domain changes and recipient notifications;
- cursor authority, unread state, response disposition, acknowledgement, and any future claim leases;
- optional long-poll/SSE hint delivery and managed webhook security;
- service-side CORS, CSP-compatible endpoints, authorization, redaction, quotas, quarantine, and audit evidence.

TinyRustLM reports backend contract gaps through the existing hosted-memory goal room. It does not implement connector-side substitutes for missing server authority.

## Functional Flows

### Setup

The user enables MemoryEndpoints, confirms the stable agent identity, supplies the workspace key for the current session, and connects. The client reads the contract, verifies registration and package binding, and shows whether the virtual package is ready, incomplete, stale, or conflicted.

### Startup

The client retrieves `/startup`, rejects unknown or missing paths, checks exact order, revisions, hashes, sizes, redaction flags, and record-specific required fields, and activates hosted context only when all 12 records are valid. Partial startup remains visible as setup required and cannot masquerade as complete memory.

### Save and reconnect

A local mutation enters IndexedDB atomically without credentials. One Web Lock leader pulls authoritative state, rebases only when permitted, pushes with the same idempotency identity across retries, and verifies the receipt and readback. Other tabs receive body-free notices. Reconnect always pulls before pushing.

### Conflict

The UI uses the existing advanced memory surface to show the logical path and revision mismatch. The user may keep hosted, prepare a reviewed replacement on the current revision, or preserve a separate record where the contract allows it. No generated model output can authorize the choice.

### Notification check-in

While the page is active, the client polls `current-message` from its last committed cursor with bounded adaptive backoff. A future SSE signal may shorten latency, but the client always fetches authoritative items after the cursor. It handles `responseRequired` separately from viewed acknowledgement, posts substantive responses in the routed meeting room, and acknowledges only after the required action is durably evidenced.

## Report Dispositions

| Report | Disposition | Concrete use |
|---|---|---|
| `Accountless Browser AI MATM Memory Connector.md` | accepted with live-contract corrections | Retains browser volatility, session-first credentials, stable agent/device/session identity, IndexedDB continuity, explicit conflicts, and cross-browser tests; replaces seven generic records and invented APIs with the live 12-record contract. |
| `Browser AI Memory Connector Architecture.md` | preserved with major security corrections | Retains IndexedDB, CSP, tenant isolation, context fencing, recovery, and test ideas; rejects Service Worker secrecy claims, automatic promotion, fake offline success, raw trace UX, and automatic conflict arbitration. |
| `Disconnected Agent Notification Architecture.md` | accepted as backend research with delivery corrections | Retains durable inbox, cursor recovery, SSE hints, adaptive polling, leases for claimable work, idempotent ack, quarantine, and chaos tests; rejects exactly-once language and default load balancing of personal coordination across devices. |
| `Disconnected-Agent Notifications for Self-Hosted MATM Coordination.md` | substantially accepted | Establishes durable pull plus thin hints, no universal inbound port, cursor reset, transport ordering, SSRF boundaries, and phased rollout; generic APIs remain proposals for MemoryEndpoints review. |

## Implementation Sequence

1. Close this intake with byte-exact preservation, memory routing, tests, and source cleanup.
2. Add strict Rust and C# virtual-UAIX contract models and fixtures without changing the public UI.
3. Implement browser contract discovery, workspace-scoped agent name recovery, and read-only package/startup inspection.
4. Implement test-generated 12-record setup and authoritative startup readback.
5. Add expected-revision updates and explicit conflict UX in the existing advanced memory surface.
6. Add deterministic `current-message` cursor polling, response-required handling, and idempotent acknowledgement.
7. Prove restart, lost IndexedDB, offline/reconnect, multi-tab, concurrent-device, revocation, rotation, stale cursor, and tenant-isolation behavior.
8. Ask MemoryEndpoints to add an SSE hint channel only if polling latency and load measurements justify it.

## Completion Boundary

This intake improves the implementation plan; it does not complete the connector. Completion requires all 12 virtual records, exact startup readback, deterministic Rust/C#/browser parity, explicit conflicts, durable notification check-ins, public cross-browser evidence, secret scans, and unchanged locked UI. The broader model-quality goal remains open.
