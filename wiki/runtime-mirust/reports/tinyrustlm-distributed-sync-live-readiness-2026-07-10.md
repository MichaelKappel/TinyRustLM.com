# TinyRustLM Distributed Memory Sync Live Readiness

Date: 2026-07-10

Evidence finalized: 2026-07-11T00:29:03Z

Status: Implemented and verified against the deployed MemoryEndpoints distributed-sync v1 authority

## Purpose

This is the durable implementation and release record for offline-first, conflict-safe, multi-device MemoryEndpoints synchronization in TinyRustLM. It supersedes the hosted-authority-pending statements in `tinyrustlm-offline-memory-sync-implementation-2026-07-10.md` while preserving that report as historical F1/F2 evidence.

The authoritative design source remains Suite F in `docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-tdd-plan-2026-07-10.md`, beginning at line 213. The implementation keeps direct browser CORS as the primary production route. The optional relay is not required for this goal.

## Result

TinyRustLM now has all three required layers:

1. A credential-free local browser outbox with stable event identity, hashes, idempotency keys, retry state, quarantine, Web Locks, BroadcastChannel, and pull-before-push reconnect.
2. A shared deterministic Rust, C#, and JavaScript protocol for the live hosted authority, including device epochs, immutable server revisions, durable receipts, explicit conflicts, tombstones, checkpoints, heads, and retention.
3. Real production verification against MemoryEndpoints.com, plus a strict loopback authority fixture, locked-UI browser tests, optional NuGet packaging, symbol packages, package audits, and clean consumer installation.

No mock, bypass switch, fixture-only result, changed retry identity, fabricated response, or weakened assertion was used to claim production readiness.

## Truth Matrix

| Capability | Result | Evidence boundary |
| --- | --- | --- |
| F1 local outbox | Complete | IndexedDB, Rust, C#, JavaScript, restart and corruption tests |
| F2 multi-tab and reconnect | Complete | Web Locks, BroadcastChannel, dropped-response recovery, pull-before-push browser tests |
| F3 concurrent devices | Complete | Live stale-parent conflict returns a durable 409 receipt and preserves the current head |
| F4 deletion and device authority | Complete | Live tombstone, blocked resurrection, epoch rotation, stale-epoch rejection, revocation |
| F5 checkpoints and retention | Complete for deployed v1 | Live monotonic changes/checkpoint, indexed-through evidence, heads, 30-day tombstone policy, safe hard-forget rejection |
| Deterministic retrieval | Complete | Order-independent rank/deduplicate/supersede, model-aware bounds, injection guard |
| Rust and C# SDK | Complete | Strict public DTOs, parsers, validation, hashing, package API and binary allowlists |
| Locked TinyRustLM UI | Preserved | Sixteen browser modes pass; desktop/mobile visual baseline failures are empty |
| Optional NuGet release set | Complete | Five 0.1.8 packages, five symbol packages, package audit, consumer smoke |

The deployed v1 authority does not provide a separate search-watermark route. Search is not revision authority. Hosted freshness is represented by `indexedThroughSequence` in changes, heads, confirmations, and checkpoints; the local deterministic engine retains explicit stale-index reporting for local projections.

## Deployed Contract

The public capability route is:

- `GET /api/matm/sync/capabilities`

The protected routes advertised and strictly accepted are:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/matm/sync/devices` | Register a stable device |
| `POST` | `/api/matm/sync/devices/rotate` | Increment its authority epoch |
| `POST` | `/api/matm/sync/devices/revoke` | Revoke every epoch of the device |
| `POST` | `/api/matm/sync/mutations` | Submit or exactly replay one mutation |
| `GET` | `/api/matm/sync/receipts` | Resolve an uncertain outcome |
| `GET` | `/api/matm/sync/changes` | Pull monotonic immutable revisions |
| `GET` | `/api/matm/sync/heads` | Read authoritative logical-memory heads |
| `GET` | `/api/matm/sync/retention` | Read tombstone and hard-forget policy |

A mutation carries one optional `parentRevisionId`. The authority assigns `syncRevisionId` and `serverSequence`. It returns HTTP 202 for an applied mutation and HTTP 409 for a durable conflict or rejection receipt. Replaying the same key and body returns the same receipt with `idempotentReplay=true`; reusing the key with a different body fails without mutation.

Receipt recovery sends the original idempotency key only in the `Idempotency-Key` header. The key is never placed in a URL or JSON body and is never echoed by the authority. A local row becomes synchronized only after the receipt's workspace, logical memory, and body hash match the uncertain operation.

## Shared Determinism

The deployed mutation vector matches across Rust, C#, and JavaScript:

- canonical body hash: `10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f`;
- request fingerprint: `fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445`.

The earlier local outbox and retrieval vectors remain in the historical F1/F2 report. Hosted transport and local conflict/retrieval logic are intentionally distinct layers: the hosted v1 adapter mirrors the deployed single-parent contract, while the local deterministic engine retains richer offline planning, stale-index evidence, and safe compaction rules.

## Implementation

### Rust

`rust/crates/tinyrustlm-memory-endpoints` provides:

- strict exact-shape capability parsing and route validation;
- canonical mutation serialization, body hashing, and request fingerprinting;
- typed mutation, receipt, revision, head, change-page, checkpoint, device, and retention DTOs;
- fail-closed conflict and rejection code validation;
- local outbox identity, retries, quarantine, conflict decisions, tombstones, device authority, retrieval, stale-index reporting, checkpoints, and compaction.

Key source hashes:

- `protocol.rs`: `258f1d6a242976969b9672f7a2ef1886be96b878147a21babd99cd76d66a006f`;
- `transport.rs`: `46d4687c821149b14c2330b996b73eb83a65e8c2c28e90d2ca3bcc3153a4e638`;
- `lib.rs`: `1a8da02fe48b815644c505f7b88cb08d69db33217becb2a0bcfc8681f999046e`.

### C# and NuGet

`dotnet/src/TinyRustLM.MemoryEndpoints` exposes the same production protocol and transport as a defensive optional SDK. Capability probing is credential-free. Protected operations require a live negotiated capability document, bounded no-store responses, caller-provided idempotency keys, and exact client identity.

Key source hashes:

- `MemoryEndpointsProtocol.cs`: `f469202c4b5a1bfbb355ff53ca185a9c0b2d04319982b3e16b4cab3bf4d790b2`;
- `MemoryEndpointsTransport.cs`: `9409d7bf35a9f8603512254d298f79f53cc31a7af03d4e74337c1859e08536ed`;
- `TinyRustLmMemoryEndpointsClient.cs`: `a29a37047bbaeab2b1bc4d8a1fd13fb10bab312c90fdc74fd5f102399e14d3be`.

The approved XML documentation baseline contains 304 members. The independent reflected binary-surface gate rejects unreviewed public types, constructors, properties, and methods.

### Browser

`tinyrustlm/app/memory-endpoints-distributed-sync-v1.js` owns the exact production wire contract. `memory-endpoints-sync.js` composes it with IndexedDB, Web Locks, BroadcastChannel, local receipts, deterministic retrieval, prompt-injection defense, and local conflict/compaction logic.

The outbox stores no credentials. It validates persisted rows on every restart, quarantines corruption, preserves retry identity, permits only one sender, broadcasts follower refresh, pulls before pushing, resolves uncertain receipts first, and advances checkpoints only after the complete page is applied.

Key source hashes:

- production hosted adapter: `b115f61694d9eb937b027d9c7da6d52722dbc0c936b313cf8a08f978f0b8545c`;
- local browser sync engine: `72244a8a35a5488189f962ca7dfec35a7223c462445dda6813ef44af29462502`;
- production-shape fixture: `db25f5c716c6980ad598f1e285d6fd4a9734ff031c126dea3d09cccd989c7133`.

## Production Lifecycle Evidence

`artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-live.json` passed against deployed source `f89d11d9d826996273aa4a9062d892a3605a5c96`, with `store_backend=mysql` and `store_backend_verified=true`.

The run proved:

- two devices registered;
- root mutation applied and visible through receipt, changes, and head readback;
- exact replay returned the same receipt;
- receipt lookup recovered the original decision;
- changes and checkpoint advanced monotonically;
- a stale parent produced an explicit conflict without changing the accepted head;
- deletion produced a tombstoned head;
- attempted resurrection was blocked;
- authority epoch rotation invalidated the prior epoch;
- a revoked device could not write;
- unsupported hard forget produced a durable rejected receipt;
- retention was 30 days with no raw private payload storage;
- both temporary devices were revoked after the test;
- response secret scan passed and every exposure flag remained false.

Live lifecycle report SHA-256: `a4c2c672a20328c987f4e5eb26743a122810101a041b133e5b2eb3d60a742d8c`.

## Contract Verification

The production capability, route existence, no-store, direct CORS, OpenAPI, and deployed-authority gates pass independently from both shells:

- PowerShell report SHA-256: `72f8aceb470a924cfcd8b04fa538edd283e19f5e57d1b194b4e3beddf06cede0`;
- Bash report SHA-256: `cf94562f93095a1196ebe3a4e4846f97c77e13bbe03382c44dd9316696a949cc`;
- loopback fixture report SHA-256: `2c52ef4cd5794f00105d685c2e27a2bcbbbe026cedd50fb309cd9e6ca231f977`.

The old allow-missing switches were removed. A missing or incompatible contract now fails in every environment. The Bash verifier normalizes response header names before checking no-store and CORS, avoiding platform-specific header casing errors.

## Test Evidence

Release verification completed with:

- 27 Rust `tinyrustlm-memory-endpoints` tests;
- `cargo fmt --all --check` pass;
- `cargo clippy --workspace --all-targets -- -D warnings` pass;
- 72 .NET core tests;
- 49 .NET package-boundary tests before and against packed artifacts;
- 14 Node browser sync and production-authority tests;
- 16 real browser UI modes, including outbox, offline, reconnect, distributed, hosted-memory, and adversarial-memory modes;
- real SmolLM2 q4 WASM assistant and prompt-card generation;
- static and HTTP browser harness passes;
- desktop and mobile visual-lock pass with `baseline_failures=[]`;
- 92 hashed report-intake durable rows with zero missing or mismatched rows.

The consolidated browser report is `artifacts/reports/tinyrustlm-ui-verification.json`, SHA-256 `a301ce9356833e3fbda7959098bde0a1bc0ed406d7c84c1076fef4f352e4c74b`.

The visual-lock report is `artifacts/reports/ui-lock-distributed-sync/tinyrustlm-ui-lock-report.json`, SHA-256 `cbe2305b670437cd40f7772da345e07c18db817f52f906dde73496280188be6a`. Desktop signature remains `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`; mobile remains `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`.

## NuGet Evidence

The fresh version 0.1.8 output in `artifacts/packages` contains five `.nupkg` files and five matching `.snupkg` files:

- `TinyRustLM.Abstractions`;
- `TinyRustLM.Core`;
- `TinyRustLM.P2P`;
- `TinyRustLM.Memory`;
- optional `TinyRustLM.MemoryEndpoints`.

The package audit passes metadata, exact package set, symbols, allowlisted archive entries, documentation byte parity, public API, reflected binary surface, dependencies, native assets, private-surface exclusions, and a clean consumer install. Package audit SHA-256: `28ae39761e1bfb8527093173a78c82d76b333c4fa37fe57dd47d370dbb555026`.

The package hash manifest SHA-256 is `a9443555836315e1c2d87711d1a9ef56672a6fcffd3b302ed71dcf007787725c`. The optional package hashes are:

- `TinyRustLM.MemoryEndpoints.0.1.8.nupkg`: `aae2e48d0671002e8db28dbe7150f1c05320272930dfc69552df873c16488802`;
- `TinyRustLM.MemoryEndpoints.0.1.8.snupkg`: `7000c4f9888803c17ce4e894abd5eee88e2be10a972fc5d17c36f846aea8bb89`.

## Security Boundary

- Workspace credentials exist only in process or page-session memory.
- Credentials never enter IndexedDB, localStorage, BroadcastChannel, URLs, request bodies, idempotency keys, reports, packages, screenshots, or `.uai` memory.
- Capability discovery is public and credential-free.
- Every protected response is bounded and requires no-store.
- Hosted summaries are untrusted data and remain inside deterministic scope, review, supersession, model-capacity, and prompt-injection gates.
- The package contains no MemoryEndpoints service internals, telemetry backend, model weights, conversion authoring, training, private ranking, licensing, or encryption-key handling.
- Local `.uai` and Markdown remain the offline recovery authority if hosted memory is unavailable.

## Coordination

The MemoryEndpoints backend agent supplied and closed the deployed contract in:

- contract message `meetmsg-01783724189498484302-4941ee8d`;
- backend closeout `meetmsg-01783724762477683835-cfb4a9da`.

Final TinyRustLM completion evidence is posted to the TinyRustLM hosted-memory goal room and the MemoryEndpoints expansion project room. The resulting message IDs are indexed in `.uai/memory-endpoints-coordination.uai`, avoiding a circular report-hash dependency.

## Residual Risks

1. One earlier failed live-verifier attempt ended before its cleanup stage. It may have left public-safe temporary devices or memory records from that attempt. The final run used fresh identifiers and revoked both devices it created, but the deployed v1 contract has no device-list endpoint with which this client can prove cleanup of unknown prior identifiers.
2. Production schema evolution remains a compatibility risk. Clients fail closed on unknown capability or wire fields and require coordinated versioning rather than silently accepting drift.
3. Browser credentials remain bearer authority for the page session. Rotation and device revocation are supported, but application-level session handling must continue to prevent persistence.
4. Hard forget is intentionally unsupported in v1. The authority records a durable safe rejection; callers must not present it as deletion beyond the tombstone/retention contract.

## Maintenance Gate

Before changing this integration, rerun the credential-free PowerShell and Bash contract verifiers, the authenticated lifecycle verifier, 27 Rust tests, 72 .NET core tests, 49 package tests against fresh packages, 14 Node tests, all affected browser modes, visual lock, package audit, consumer smoke, report-intake verification, and literal credential leak scan.

Any future route, field, conflict code, retention rule, or authentication change requires a new capability version, shared vectors, fixture update, live proof, documentation update, NuGet API review, and public-safe coordination readback.
