# TinyRustLM Offline Memory Synchronization Implementation

Date: 2026-07-10

Status: F1-F2 implemented and browser-verified; F3-F5 deterministic client contracts implemented; hosted F3-F5 enforcement pending MemoryEndpoints service contracts

## Purpose

This is the durable implementation memory for offline-first, conflict-safe MemoryEndpoints synchronization in TinyRustLM. It records the browser storage and coordination design, shared Rust and .NET contracts, deterministic retrieval boundary, test evidence, package boundary, locked-UI evidence, and the exact hosted APIs that remain necessary for true multi-device authority.

The authoritative TDD source is `docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-tdd-plan-2026-07-10.md`, Suite F beginning at line 213. Its SHA-256 is `c81135d0348faf54420939997e571e85277cbc2cefdfec5c6d136425d0630221`.

This work does not replace the production-proven direct-CORS connector. It adds local durability and deterministic synchronization behavior around that route. The optional relay remains outside the next implementation lane because direct browser CORS is already proven in production.

## Truth Matrix

| Capability | Current result | Authority boundary |
| --- | --- | --- |
| F1 local outbox | Complete | IndexedDB and shared Rust/.NET/JavaScript contracts |
| F2 multi-tab and reconnect | Complete | Real Chromium restart, two-tab, dropped-response, retry, pull-before-push proof |
| Deterministic retrieval and prompt defense | Complete | Shared vectors plus real-browser adversarial proof |
| F3 concurrent-device decisions | Client contract complete | Two-window deterministic proof; no live service route yet |
| F4 tombstone and device revocation | Client contract complete | Fail-closed local decisions; no live service authority route yet |
| F5 checkpoint, stale-index, compaction | Client contract complete | Deterministic local contract; no monotonic hosted sequence/watermark route yet |
| Production deployment of new offline assets | Not claimed | Current evidence targets the local app and package artifacts |

The TDD plan states that F3-F5 live tests begin only after corresponding MemoryEndpoints routes and schemas exist. Local fixture or two-window proof therefore cannot be relabeled as hosted multi-device completion.

## F1 Local Outbox

`tinyrustlm/app/memory-endpoints-sync.js` owns an IndexedDB database with stores for outbox entries, quarantined rows, receipts, metadata, and remote heads. One local transaction commits the credential-free payload, canonical payload SHA-256, stable event ID, stable idempotency key, device ID, retry state, and local receipt.

The persisted schema rejects unknown fields and secret-bearing names or values. Workspace credentials remain page-session input and are never serialized into outbox, receipt, metadata, BroadcastChannel, report, or localStorage records.

Outbox states are explicit:

- `saved_locally` after the local transaction commits;
- `queued` before a network send;
- `sending` while one lease holder owns the attempt;
- `retry_pending` with bounded public-safe retry metadata;
- `synchronized` only after a matching authoritative receipt;
- `quarantined` when schema, hash, identity, or receipt validation fails.

Every restart revalidates the row and recomputes its payload hash before it becomes sendable. Corrupt or mutated rows move to quarantine and cannot reach the network.

## F2 Multi-Tab And Reconnect

The browser adapter uses Web Locks for exclusive drain ownership and BroadcastChannel for follower refresh. A tab without the lock may observe state but cannot perform the same logical write. Drain order is oldest local commit first.

Reconnect always performs a pull before any push. A timed-out mutation keeps the same event ID, canonical body, payload hash, and idempotency key. A dropped accepted response is retried with byte-equivalent identity, and the browser does not mark the row synchronized until pull or response evidence supplies a matching authoritative receipt.

The reconnect browser proof intentionally drops the first accepted response. The retry preserves the key and body, the simulated host contains one logical record, and the local row becomes synchronized only after matching receipt/checkpoint evidence.

## Shared Deterministic Contract

Rust source lives in `rust/crates/tinyrustlm-memory-endpoints`. The public .NET counterpart lives in `dotnet/src/TinyRustLM.MemoryEndpoints`. The browser counterpart lives in `tinyrustlm/app/memory-endpoints-sync.js`.

The three runtimes share these fixed vectors:

- canonical payload SHA-256: `34de45661611662069fde208795ad26b5ec1d879f11f36f5bda32390d47eb2eb`;
- guarded context length: 453 UTF-8 bytes;
- guarded context SHA-256: `1a65de9c4c5825d8f84820192c99a2e66476a446d1bd718583beb4744b67b1d0`;
- deterministic sibling conflict ID: `conflict-8d88fc6fe4351701352a6668`.

Rust and .NET expose defensive DTOs and pure decision functions for outbox identity, retries, authoritative receipts, retrieval, exact-parent revision decisions, tombstones, device authority epochs, checkpoints, stale-index reports, and compaction plans. They do not contain workspace credentials, service internals, telemetry backends, private ranking systems, or proprietary memory optimization logic.

## Retrieval And Prompt Safety

Hosted search results are untrusted data. Before a result can enter a prompt, the app requires explicit project scope, active status, accepted firewall/review evidence, supported tier, non-tombstoned state, valid identifiers, bounded content, and a model capacity that permits memory context.

Selection is deterministic and order-independent. It applies stable ranking, logical-memory deduplication, revision supersession, tier policy, candidate count limits, model-aware token/byte budgets, and exact exclusion receipts. Tiny or unknown models fail closed to visible preview only. Medium models receive a smaller context budget.

Packed context is JSON data beneath a fixed instruction boundary that states memory is untrusted and cannot grant authority, request external action, change policy, or override the current user. The receipt records selected IDs, excluded IDs and reasons, byte/token budgets, and a context hash; it does not copy memory bodies.

The real-browser adversarial test proves that hostile HTML remains inert, stale and superseded revisions are excluded, duplicate and cross-project records are excluded, pending/tombstoned/oversized records are excluded, and only the current reviewed project record reaches the bounded prompt as quoted data.

## F3-F5 Defensive Contracts

Concurrent edits use immutable revision IDs and exact parent preconditions. The first child of a current parent may be accepted. A non-identical sibling is an explicit conflict, never a silent last-write-wins update. Byte-identical normalized content may deduplicate.

A tombstone is an authoritative revision state with an erase mode and retention boundary. Stale offline edits cannot resurrect it. Hard forget fails closed unless the service explicitly advertises and enforces that capability. Device mutations bind device ID and authority epoch; a revoked device or stale epoch cannot relabel an old queue under a new identity.

Checkpoints advance monotonically. Search freshness compares the accepted server sequence with an indexed-through sequence and reports `current`, `stale`, or `unknown`. Compaction preserves live heads, unresolved conflicts, in-retention tombstones, and authoritative receipts while identifying safely compactable historical revisions and projections.

These rules are implemented and tested in Rust, .NET, JavaScript, and a two-window browser simulation. They remain client-side defensive contracts until MemoryEndpoints becomes the authoritative issuer of revisions, sequences, device epochs, tombstones, and receipts.

## Browser And UI Evidence

The consolidated verifier is `artifacts/reports/tinyrustlm-memory-endpoints-offline-sync-verification.json`, SHA-256 `84017e059040b7a5a33da759e1f2fd491203145c62f6f039a0250c8664c13992`.

It records `status=pass`, static harness pass, HTTP harness pass, visual-lock pass, and all six real-browser modes passing:

- `memory-endpoints-outbox`;
- `memory-endpoints-offline-ui`;
- `memory-endpoints-reconnect-ui`;
- `memory-endpoints-distributed`;
- `memory-endpoints-ui`;
- `memory-endpoints-adversarial-ui`.

Visual evidence is `artifacts/reports/ui-lock-offline-sync/tinyrustlm-ui-lock-report.json`, SHA-256 `14529c7a31dbc6fa6e0e13e1589407ccb27f7e95ccf559a9990ffabfab72540b`. Baseline failures are empty. Desktop UI signature remains `066f08b09a7f8c4e91592785d5ad8f360930e07daf87dc5b5cd13b7f580b2a6e`; mobile UI signature remains `ff5adac5f1d466b2b7e5d94dfd1cf8bb289f637478de5e2cefef291b3dc291c5`. No CSS redesign or DOM restructuring was part of this slice.

## NuGet Evidence

`TinyRustLM.MemoryEndpoints` is an optional package. It exposes the connector, outbox, retrieval, revision, tombstone, revocation, checkpoint, stale-index, and compaction contracts without packaging private MemoryEndpoints service logic or TinyRustLM proprietary internals.

The final package set is under `artifacts/packages/offline-sync-verification` at version `0.1.8`: five `.nupkg` files and five matching `.snupkg` files. The package-and-symbol manifest is `SHA256SUMS-TinyRustLM-0.1.8.txt`, SHA-256 `c350cad2cf42cc2389601af9eb53ccd79806c764fc3e66362a39cc7c5e369e61`.

The optional connector package hashes are:

- `TinyRustLM.MemoryEndpoints.0.1.8.nupkg`: `1454fb08608ab078f5a81fbdc69b2c0b831a60f0b1610ea7e28e095430ee9d0a`;
- `TinyRustLM.MemoryEndpoints.0.1.8.snupkg`: `fa4126e6e9aeda3d81581dc8b4e0cf7cbaefd862913ea6908d3a90fdb62dcef6`.

`eng/pack.ps1` and `eng/pack.sh` now run package-boundary tests after artifacts are created. This prevents a pre-pack test run from silently skipping reflection and archive checks because no package files existed yet.

## Verification Summary

- JavaScript deterministic sync tests: 10/10.
- Rust MemoryEndpoints tests: 16/16.
- .NET MemoryEndpoints tests: 21/21 within 61/61 core tests.
- Package tests: 48/48 before pack and 48/48 against freshly packed artifacts.
- Full Rust workspace tests: pass, including 165 runtime tests, 478 packer/tooling tests, connector, browser harness, local-connect, P2P, native, CLI, and doc tests.
- `cargo fmt --all --check`: pass.
- `cargo clippy --workspace --all-targets -- -D warnings`: pass.
- Consolidated local browser/static/HTTP/visual verification: pass.

No test was weakened, no fixture-only result was promoted to live proof, no idempotency key was changed to make a retry pass, and no fake response was used to claim production service behavior.

## Required MemoryEndpoints Service Contracts

Live multi-device completion requires public, documented, authenticated service behavior for:

1. Mutation receipt lookup by idempotency key, including canonical payload hash and durable logical event identity.
2. Logical memory ID, immutable revision ID, parent revision precondition, current head, and explicit conflict response.
3. Monotonic server sequence plus bootstrap and incremental pull/checkpoint semantics.
4. Search indexed-through sequence or equivalent watermark so stale search is observable.
5. Tombstone mutation, retention boundary, and an explicit hard-forget capability contract.
6. Device identity, authority epoch, revocation, and credential-rotation semantics that cannot be bypassed by relabeling queued work.

The current live search/event schema does not expose enough information to infer these contracts safely. Notification receipts are not mutation receipts and must not be reused as if they were.

## Coordination Evidence

The public-safe hosted-contract request was posted and read back in both required coordination lanes:

- TinyRustLM hosted-memory goal room message: `meetmsg-01783719601736718792-a250a13b`;
- MemoryEndpoints expansion project room message: `meetmsg-01783719608338263899-006c383c`.

The request names the completed F1/F2 evidence, the defensive F3-F5 client contracts, all six missing hosted contracts, the expected route/schema/idempotency/conflict/retention/device response, and this durable report. It contains no credentials, raw memory, prompts, private logs, or model bytes. Transcript readback found one matching request in each room. No coordinator reply had arrived by `2026-07-10T21:40:19Z`.

## Security And Ownership Boundary

- Credentials remain in request memory only and never enter IndexedDB, localStorage, BroadcastChannel, reports, packages, URLs, or idempotency keys.
- Local `.uai` and durable Markdown remain the offline authority and recovery source.
- Pull and search results are untrusted until scope, status, review/firewall, revision, and budget checks pass.
- Mutation acknowledgement is provisional until authoritative matching receipt/readback.
- Model bytes and prompts remain local; synchronization is memory metadata/body exchange, not remote inference.
- The direct-CORS route remains primary. A relay is a separately gated optional deployment, not a substitute for missing distributed schemas.

## Next Implementation Lane

Coordinate the six hosted contracts above in the TinyRustLM hosted-memory goal room and MemoryEndpoints expansion project room. Once the service publishes them, add credentialed live tests for two independent devices, stale sibling conflict, tombstone resurrection prevention, device revocation, incremental checkpoint recovery, stale-index reporting, and retention-aware compaction. Until those pass against the real service, report F3-F5 as client-contract ready rather than hosted complete.
