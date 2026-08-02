---
stable_id: tinyrustlm_memory_endpoints_intake_current
title: TinyRustLM MemoryEndpoints Connector Implementation Memory
authority: reviewed TinyRustLM repository evidence plus live MemoryEndpoints contract
review_status: reviewed for implementation routing
source_manifest: docs/report-intake/2026-07-10/MANIFEST.md
source_manifest_sha256: b8c87e2ea7c26c9b472e14a3329610a69a8236b677824b103595c432cdb5447d
synthesis_sha256: f5e36d9f462aa365a809f555511eee882e1bb5bbad8b91b41c44fc4a4c1b140a
tdd_plan_sha256: c81135d0348faf54420939997e571e85277cbc2cefdfec5c6d136425d0630221
hosted_scope: goal-tinyrustlm-hosted-memory
hosted_room: room-d3a35d3e963f696fd24d
hosted_status_event: mem-63b3af4bc10e45aaad19
superseded_status_event: mem-3210f9bb335442d29b07
truth_boundary: Current source, tests, live connector contract, and redacted live proof supersede research assumptions.
---

# TinyRustLM MemoryEndpoints Connector Implementation Memory

## Routing Summary

Use this record for the optional use of MemoryEndpoints.com by TinyRustLM clients. It preserves the reviewed long-term plan for short-term `status` memory, durable `handoff` memory, browser retrieval, Rust and .NET connector contracts, production connectivity, offline recovery, lifecycle integrity, and security.

The twelve source reports remain byte-exact local backups under `docs/report-intake/2026-07-10/`. The detailed review is `docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-synthesis-2026-07-10.md`. The executable test plan is `docs/report-intake/2026-07-10/tinyrustlm-memory-endpoints-intake-tdd-plan-2026-07-10.md`. Hosted write and readback evidence belongs in `docs/report-intake/2026-07-10/MEMORYENDPOINTS-DISTRIBUTION.md`.

## Product Boundary

TinyRustLM remains local-first:

- `.slm` inference runs locally in the browser or local runtime.
- `.uai` remains the active startup continuity layer.
- Durable local Markdown remains the offline review and recovery copy.
- MemoryEndpoints is optional, explicitly enabled by the user, and stores public-safe memory summaries and references rather than model bytes, credentials, hidden prompts, or proprietary internals.
- Hosted failure must not disable local inference or local memory.
- The approved TinyRustLM UI look and feel remains locked.

## Current Implementation Truth

- Rust policy, schema, validation, serialization, and tier mapping exist in `rust/crates/tinyrustlm-memory-endpoints`.
- Managed .NET transport exists in `dotnet/src/TinyRustLM.MemoryEndpoints`.
- Short-term maps to `memoryType=status`; long-term maps to `memoryType=handoff`.
- Browser hosted memory is opt-in and does not persist the workspace key in `localStorage`.
- Direct browser CORS currently works for approved TinyRustLM and loopback origins.
- A direct local-browser live smoke has proved status/handoff write, tier-isolated readback, visible hosted memory, generation context, and no workspace-key localStorage leak.
- The same-origin relay is checked in as an optional fallback but is not deployed on the public TinyRustLM route; its production preflight currently returns `404`.
- The connector-enabled public static package still requires deployment and public-site verification.

## Reviewed Domain Decisions

### Production deployment and relay

Use direct browser CORS as the primary current path. Keep the narrow no-store relay as an optional fallback. Never inject a shared upstream credential, expose arbitrary proxying, forward model bytes, or claim the relay deployed before its public route passes preflight and credentialed tier-isolation proof.

### Retrieval and context packing

Search `status` and `handoff` explicitly, filter scope before ranking, collapse duplicates and superseded records, treat retrieved text as untrusted data, reserve model output and guard tokens first, and inject only a visible bounded subset appropriate to the selected `.slm` context capacity. Tiny fixture models receive no forced hosted context.

### Rust and .NET connector

Keep the connector optional. Rust owns stable public data contracts and validation; .NET uses managed HTTP. Credentials remain user supplied at runtime. Mutation retries require an unchanged payload and stable idempotency key. Native async FFI and additional dependencies remain out of scope until a measured requirement exists.

### Distributed synchronization and recovery

A local save may complete while hosted sync is pending, but it is synchronized only after an authoritative receipt. Future offline support uses a credential-free IndexedDB outbox, Web Lock leadership, BroadcastChannel refresh, pull-before-push reconnect, exact-parent optimistic concurrency, explicit conflicts, and tombstones. There is no silent overwrite and no last-write-wins for durable prose.

### Memory distribution and lifecycle

Scan active buckets, hash source bytes, classify and distill, preserve byte-exact evidence, write reviewed durable memory, write concise hot pointers, write hosted status/handoff projections, read them back by tier, ledger one outcome per source, then remove processed source copies. Generic human review is not a valid keep-active reason.

### Security and threat model

The connector is off by default. Credentials never enter URLs, localStorage, durable browser stores, reports, logs, prompts, or packages. CORS is not authentication. Hosted memory is untrusted prompt data. Every request is scope constrained, every relay route is fixed and bounded, and durable app approval requires exact identity and capability binding. Browsers and email clients default to session approval; a durable override must carry a high-risk warning and revocation path.

## Implementation Slices

1. **Intake repair:** preserve 55 reports, correct outcomes, make active buckets placeholder-only, route concise hot memory, and dogfood hosted status/handoff memory.
2. **Connector baseline:** retain Rust and managed .NET contracts, deploy connector-enabled static assets, and verify the public site without changing visual design.
3. **Retrieval quality:** deterministic filtering, dedupe, supersession, capacity-aware packing, untrusted-memory framing, and redacted retrieval receipts.
4. **Offline sync:** credential-free queue, idempotency, multi-tab leadership, browser restart, outage recovery, and honest local/pending/synchronized states.
5. **Conflict and deletion:** coordinate stable MemoryEndpoints revision, conflict, receipt lookup, tombstone, and revocation routes before adding client support.
6. **Relay and approvals:** deploy the optional relay only when useful; coordinate LocalEndpoints signed-app approval, category risk warnings, downgrade, and revoke behavior.

## TDD Gates

- Intake tests require placeholder-only buckets and durable manifest hashes independent of active source files.
- Rust and .NET tests require explicit `status`/`handoff` mapping, bounds, idempotency, cancellation, and no credential reflection.
- Browser tests require opt-in state, UI lock, no localStorage credential, inert rendering, visible-before-use hosted context, and model-capacity-aware packing.
- Retrieval tests include unseen, stale, contradictory, cross-scope, duplicate, oversized, and prompt-injection fixtures.
- Sync tests include two tabs, two devices, timeout after acceptance, service outage, stale search, tombstone resurrection, revocation, corruption, and 10,000-record pagination.
- Security tests include XSS, CSRF where applicable, CORS drift, open proxy, SSRF, body limits, logging canaries, approval downgrade, and supply-chain checks.
- No test weakening, fake hosted result, canned assistant answer, fixture-only quality claim, or hidden remote inference is allowed.

## Source Evidence

| Domain | Preserved reports | SHA-256 identities |
|---|---|---|
| Production deployment and relay | `Edge Proxy Deployment Architecture.md`; `TinyRustLM Production Browser Connectivity and Relay Deployment Report.md` | `45045d027f1fe45c17ae513713ea489d4ac01a8305117b1f4521314e1081603f`; `0888370b9315d0f0da28e71d4909ec0fb8c52e71913be6c7cc8e05debb4dbdc9` |
| Retrieval and context packing | `Hosted-Memory Retrieval and Prompt Context Quality for TinyRustLM .slm Models.md`; `TinyRustLM Memory Retrieval Strategy.md` | `c4e5958642af145e2d7f96b735778e6136291e11db1e4207efe4fcbaaa079d88`; `60b770438219c410dc10f5339fbbc836e6adb65e0c070c4b8abb993b694bddd1` |
| Rust and .NET connector | `Rust .NET Connector Architecture Review.md`; `Rust and .NET Memory Connector Production Architecture Review.md` | `94734e3c55b175152178269b8ff6d7cdd1a7df552666a55f6f58f0e182c2c6c0`; `931a08291d935265db10de8e446531d5d97e1becc247d8b6b6bbd1b47804dc25` |
| Distributed synchronization and recovery | `TinyRustLM Distributed Memory Sync and Recovery Architecture.md`; `TinyRustLM Distributed Memory Sync and Recovery Architecture 2.md` | `0c2a339448fd370a506a2fd928f7734cbfd7d83cd5b92e17bff7c47b30fc87f9`; `f95f0462203a2c8805c368cebac44f0e3a8e973408802aa16635a44b4d17fe86` |
| Memory distribution and lifecycle | `TinyRustLM Memory Distribution and Lifecycle Report.md`; `TinyRustLM Memory Lifecycle Strategy.md` | `9388e39f168c4bc72ccc827760768905e3b9a82b25e3085079345ef762d50ff4`; `8d453e1aba27501c3dc1411ebe14ff99d3cbc1428b146be430e4cc6c984360cf` |
| Security and threat model | `TinyRustLM MemoryEndpoints Security Threat Model Report.md`; `TinyRustLM Threat Model Report.md` | `b91f0f5340d2aca4a888e73d01201c36c5d24359f5e913b4e2d1cd36029a5323`; `2e1f0cdb733639fe487da597e3efde0da875e93e183626e6415f2f5b3b758148` |

## Hosted Memory Contract

The hosted long-term copy is six public-safe `handoff` records, one per domain. The hosted short-term copy is one concise `status` record that names current state, next action, and the six durable subjects. Every record is goal scoped, tagged with the batch identity, submitted with an idempotency key, and searched back with an explicit memory-type filter.

Record only redacted IDs, persistence flags, visibility flags, counts, and tier-isolation results in the local evidence file. Never record the workspace credential or raw authorization value.

## Hosted Reachability

- Base service: `https://memoryendpoints.com`
- Connector discovery: `/api/matm/connector-contract`
- Goal scope: `goal-tinyrustlm-hosted-memory`
- Goal room: `room-d3a35d3e963f696fd24d`
- Batch tag: `tinyrustlm-memory-intake-20260710`
- Search short-term: `/api/matm/search` with `scope=goal`, this scope ID, and `memory_type=status`
- Search long-term: `/api/matm/search` with `scope=goal`, this scope ID, and `memory_type=handoff`
- Review state: `/api/matm/review-queue` filtered by the batch tag and `tinyrustlm-agent`
- Current status event: `mem-63b3af4bc10e45aaad19`
- Superseded in-progress status event retained as audit history: `mem-3210f9bb335442d29b07`
- Long-term event IDs: `mem-5be7083c306e4398829d`, `mem-e1d95c5a58a5480eab2a`, `mem-be63083a98194916aea7`, `mem-9a0ad9f9470344b2a861`, `mem-be75f327dfd241d0bd25`, and `mem-444c95a4d89a47f585b9`
- Redacted write, promotion, defect, and readback evidence: `docs/report-intake/2026-07-10/MEMORYENDPOINTS-DISTRIBUTION.md`

Authentication instructions remain in the protected external coordination handoff. They are credential inventory, not memory, and no credential value belongs in this file or any `.uai` record.

## Open Decisions

- Whether the optional same-origin relay should be deployed now that direct CORS works.
- The exact MemoryEndpoints schema and routes for revision heads, conflict objects, tombstones, receipt lookup, device revocation, and hard forget.
- Retrieval ranking calibration and promotion thresholds derived from real holdout measurements.
- Whether a browser BFF session is worth the operational complexity compared with direct ephemeral user credentials.
- The exact LocalEndpoints approval identity tuple and high-risk browser/email override workflow.

## Promotion Evidence

Do not promote this work as complete until the package tests, connector tests, report verifier, secret scan, hosted status/handoff write-readback, meeting-room evidence, active bucket scan, and checksum pointer audit all pass. Public-site availability additionally requires the connector-enabled static package to be deployed and tested on TinyRustLM.com.
