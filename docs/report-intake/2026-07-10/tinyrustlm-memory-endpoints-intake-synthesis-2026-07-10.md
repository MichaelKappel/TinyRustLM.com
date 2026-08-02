# TinyRustLM MemoryEndpoints Intake Synthesis

## Purpose

This document distills twelve research reports into an implementation authority for the optional use of MemoryEndpoints.com by TinyRustLM clients. It preserves useful ideas without allowing speculative report text to override observed repository behavior, the live MemoryEndpoints connector contract, or verified browser and package tests.

The work belongs to the MemoryEndpoints expansion project and the focused `TinyRustLM Hosted Memory Connector` goal. The user-facing product remains TinyRustLM: local `.slm` inference and local `.uai` startup continuity continue to work without hosted memory. MemoryEndpoints is an explicit opt-in way to make public-safe agent memory available from any browser with internet access.

## Source Authority

Use this order when sources disagree:

1. Current TinyRustLM source and tests.
2. Live MemoryEndpoints connector contract, capability matrix, receipts, and tier-filtered readback.
3. Redacted browser and package verification artifacts.
4. This reviewed synthesis and its TDD plan.
5. The twelve preserved research reports.

The reports are valuable design inputs, but several were produced without direct repository access, contain malformed citation markers, assume routes that do not exist, or describe infrastructure that has not been selected. Those claims are not implementation facts.

## Current Ground Truth

- TinyRustLM has an optional Rust contract crate at `rust/crates/tinyrustlm-memory-endpoints`.
- The .NET wrapper at `dotnet/src/TinyRustLM.MemoryEndpoints` uses managed HTTP and maps `short_term` to `memoryType=status` and `long_term` to `memoryType=handoff`.
- Browser hosted memory is opt-in, keeps the user-supplied workspace credential out of `localStorage`, and exposes tier-filtered save/search in the existing locked TinyRustLM UI.
- Generation may use only hosted snippets already shown in the hosted-memory preview, and context packing is reduced or disabled for very small fixture models.
- Direct browser CORS is live for TinyRustLM production origins and loopback origins. The direct local browser smoke has proved status/handoff save, tier-isolated readback, hosted generation context, and no workspace-key `localStorage` leak.
- The checked-in same-origin relay is an optional fallback. Its production route is not deployed at `https://tinyrustlm.com/api/memoryendpoints`; the latest route probe returns preflight `404`.
- The public TinyRustLM.com static assets still need the connector-enabled package deployed and verified before the public site can be called complete.
- Local `.uai`, durable Markdown, and `.slm` inference remain usable when MemoryEndpoints is unavailable.

## Domain 1: Production Deployment And Relay

### Accepted now

- Prefer direct browser CORS while the live MemoryEndpoints contract supports the required TinyRustLM origins and headers.
- Keep a same-origin relay as an optional fallback, not as a hidden requirement.
- Relay only a fixed `/api/matm/*` allowlist to one fixed upstream origin.
- Forward only the user-supplied workspace-key auth header, JSON content type, accept header, and idempotency key required by the contract.
- Apply `Cache-Control: no-store`, bounded request and response sizes, upstream timeouts, manual redirect policy, and model-byte path rejection.
- Deploy relay changes under a path-isolated canary with a credential-free preflight gate, credentialed status/handoff save-search proof, and a reversible route switch.
- Treat direct browser and relay verification as separate claims. Passing a local fixture proves verifier behavior, not production deployment.

### Superseded or rejected

- The claim that direct CORS is unavailable is superseded by live preflight and browser evidence.
- A relay must never inject a shared project-wide MemoryEndpoints key. Authentication remains user supplied and explicitly opted in.
- Cloudflare Workers are an optional deployment choice, not a proven current hosting authority.
- A 10 MiB generic payload ceiling is unnecessary for public-safe memory summaries. Keep the existing much smaller bounded relay policy.
- Do not call the production relay complete while its public route returns `404`.

### Implementation consequence

Direct CORS is the current primary route. The relay source and verifier remain production-ready fallback infrastructure, but relay deployment is a separate operational task with its own live acceptance gate.

## Domain 2: Retrieval And Context Packing

### Accepted now

- Run retrieval only after the selected `.slm` model's real context capacity is known.
- Keep short-term `status` and long-term `handoff` searches physically explicit in every Rust, .NET, browser, and verifier API.
- Treat every hosted result as untrusted data. Retrieved text cannot become system instructions, alter policy, authorize tools, or silently trigger side effects.
- Filter by workspace, goal or task scope, memory type, review state, and source metadata before ranking.
- Deduplicate exact source hashes and collapse explicit supersession chains before context packing.
- Reserve system instructions, user input, output tokens, and runtime guard space first. Hosted memory receives only the remaining bounded budget.
- Apply progressive compression: selected raw summary, structured facts, compact summary, key-value fragment, or no injection when the model cannot safely use it.
- Keep hosted results visibly inspectable before generation uses them.
- Evaluate with unseen holdouts, tier-confusion cases, stale records, contradictory records, malicious prompt text, and context-overflow cases.

### Deferred

- Deterministic reranking can combine lexical relevance, recency, scope match, review state, source quality, and supersession state, but weights must be calibrated from recorded eval data rather than copied from a report.
- A future retrieval receipt may record selected IDs, excluded IDs, budget, compression stage, and context hash. It should not include private prompt bodies.

### Superseded or rejected

- Do not invent `/status` or `/handoff` endpoints. Use `/api/matm/search` with `memory_type=status|handoff`.
- Do not use fabricated hidden datasets, hardcoded expected answers, LLM-judge-only scoring, or arbitrary ranking weights as release proof.
- XML, Markdown, or delimiter wrappers are not cryptographic prompt-injection defenses.
- Tiny fixture/demo models cannot prove assistant-quality hosted retrieval.

## Domain 3: Rust And .NET Connector

### Accepted now

- Keep the connector optional and outside the protected runtime core.
- Use the Rust crate for schema, tier mapping, validation, serialization, public-safe bounds, and stable policy contracts.
- Use managed `HttpClient` in .NET for transport. This is easier to audit, trim, test, and consume than an unnecessary native async FFI bridge.
- Accept credentials through an explicit runtime option or host-owned provider. Never serialize them, include them in defaults, put them in package assets, or echo them in diagnostics.
- Support both public auth forms: `Authorization: Bearer` and `X-MemoryEndpoints-Key`.
- Retry mutation POSTs only with a stable idempotency key and unchanged payload fingerprint.
- Parse forward-compatible response envelopes defensively while failing closed on raw-credential or raw-payload exposure flags.
- Ship XML documentation, symbols, Source Link, deterministic package metadata, clean-consumer tests, and package-boundary scans.

### Deferred

- Add native Rust transport or callback FFI only when a measured deployment requirement cannot be met with managed HTTP.
- Add conflict, tombstone, revision-head, acknowledgement, or promotion APIs only after the live MemoryEndpoints contract advertises stable routes and semantics.

### Superseded or rejected

- Do not add a second hidden connector core, Tokio callback bridge, speculative RID matrix, or new retry dependency merely to mirror a report architecture.
- Do not advertise AOT, trimming, native fallback, or mobile/browser support until clean-consumer and platform-specific tests prove each claim.

## Domain 4: Distributed Synchronization And Recovery

### Accepted architecture

- Preserve local-first behavior. A local save can succeed while hosted synchronization is pending.
- Never label a write synchronized until MemoryEndpoints returns an authoritative receipt and readback evidence.
- Give each logical mutation a stable event identifier, stable idempotency key, payload hash, intended scope, memory type, and retry state.
- Use IndexedDB for a future browser queue/cache, Web Locks for one-tab sync leadership, and BroadcastChannel for same-origin follower refresh.
- Pull before pushing after reconnect so revocations, newer records, and deletions are observed first.
- Reuse the same idempotency key after a timeout. Never mint a new key to make an uncertain write appear successful.
- Treat search as an eventually consistent projection. A future authoritative revision-head route must outrank a stale search result.
- Use exact-parent optimistic concurrency and explicit conflicts for body-bearing durable memory. No silent overwrite and no last-write-wins for `.uai`, Markdown, or `handoff` prose.
- Model deletion as a tombstone that prevents stale offline resurrection. Hard-forget behavior requires an explicit server contract and retention policy.
- Keep credentials out of persistent browser queues. Queued public-safe payloads may wait for the user to authenticate again.

### Contract boundary

The current public connector does not yet expose the complete revision DAG, monotonic server sequence, conflict object, tombstone, receipt lookup, device registry, or purge API described by the reports. Those are proposed MemoryEndpoints expansion capabilities, not TinyRustLM implementation facts. They require coordinated schema and route work with the MemoryEndpoints agents before client code is added.

### Rejected shortcuts

- No last-write-wins for durable prose.
- No global full-text CRDT before a real multi-writer requirement and merge algebra exist.
- No inference of remote success from elapsed time, local counters, or an HTTP timeout.
- No private memory bodies in P2P announcements.

## Domain 5: Memory Distribution And Lifecycle

### Correct lifecycle

1. Scan only active `Content` and `Improvement` buckets and misplaced root intake files.
2. Hash exact source bytes and detect exact duplicates.
3. Classify domain, urgency, confidence, privacy, expected lifetime, and authority.
4. Extract decisions, constraints, tasks, test obligations, unresolved questions, conflicts, and rejected approaches.
5. Preserve byte-exact source evidence under `docs/report-intake/<batch>/` with a checksum manifest.
6. Write reviewed durable synthesis and implementation memory.
7. Write concise hot `.uai` current-state references with stable IDs, routing summaries, authority, review evidence, source identity, checksum, and truth boundary.
8. Write a public-safe MemoryEndpoints `status` summary and durable `handoff` records with deterministic idempotency keys.
9. Search each hosted tier back with explicit `memory_type` and scope filters.
10. Record receipts, proof of use, failures, and processed outcomes in the ledger.
11. Remove processed active source copies after local and intended hosted evidence exists, or retain only with a real named blocker.
12. Verify active buckets are placeholder-only.

### Accepted controls

- Exact byte SHA-256 is the provenance identity. A normalized-text hash may be added later for edition comparison, but never replaces byte identity.
- Hot `.uai` contains routing and current conclusions, not full research bodies.
- Local durable Markdown is the offline backup and human-review authority.
- Hosted `status` is concise current cross-device context; hosted `handoff` is durable reviewed context.
- Tier-specific searches must fail closed rather than omit the memory type accidentally.
- Supersession and tombstones remain explicit and auditable.
- Hosted failure leaves local memory intact and a retryable redacted failure record.

### Superseded or rejected

- The repository does not use an invented `durable/reports/<hash>.md` hierarchy or `queue/offline_sync_queue.db` contract.
- Do not introduce an unattended daemon, cron job, or automatic report shredder as part of this repair.
- Do not roll back a successful hosted write by issuing speculative DELETE requests after a second projection fails.
- Do not automatically purge, shred, or widen memory scope from a report's proposed retention label.
- Do not retain processed reports in active intake merely for generic human review.

## Domain 6: Security And Threat Model

### Accepted controls

- Connector off by default with explicit user opt-in.
- User-supplied workspace credentials only; no shared embedded key.
- No credentials in URLs, localStorage, IndexedDB, Cache API, service-worker caches, reports, logs, screenshots, model prompts, source maps, or package defaults.
- The browser credential stays in current page memory. A future same-origin BFF may exchange it for an `HttpOnly`, `SameSite=Strict`, short-lived server session, but that is not the current direct-browser design.
- Exact-origin CORS, `Vary: Origin`, strict route/method/content-type allowlists, `Cache-Control: no-store`, body limits, timeouts, no arbitrary proxy destination, and no model-byte forwarding.
- Every object access is constrained by workspace plus project/goal/task scope and memory type.
- Render hosted memory inertly and treat it as untrusted prompt data.
- Separate permission to retrieve memory from permission to put memory into model context.
- Redacted structured diagnostics must never contain raw headers, cookies, credentials, prompts, or memory bodies.
- Rust, JavaScript, .NET, CI, and deployment supply-chain checks are release gates.
- Revocation, key rotation, stale-tab handling, and approval downgrade on app identity changes are required for durable approvals.

### Approval policy consequence

Browsers and email clients process hostile remote content, so blanket category-wide always-approve is high risk. TinyRustLM and LocalEndpoints may offer a clearly warned user override, but the secure default is session approval. Durable approval should bind to an exact signed app identity, origin, device, capability set, workspace scope, and policy version, and should downgrade when identity or capabilities change.

### Superseded or rejected

- A same-origin relay is not the only valid production posture now that direct CORS works.
- The current relay must not silently replace the user's key with a shared upstream credential.
- CORS is transport policy, not authentication.
- Delimiters and sanitization alone do not make hostile memory trustworthy.
- No security report may claim implemented passkeys, BFF sessions, device attestation, delete restore windows, or dual control until those features exist and are tested.

## Consolidated Implementation Plan

### Slice 0: Intake integrity

- Generalize the verifier so durable manifests are independent of active source presence.
- Require active buckets to be placeholder-only after completion.
- Preserve the twelve reports and repair the earlier forty-three report outcomes.
- Produce local durable synthesis, TDD plan, and current implementation memory.
- Dogfood MemoryEndpoints with one concise `status` record and six domain `handoff` records, then prove tier isolation.

### Slice 1: Existing connector baseline

- Keep Rust schema/validation and managed .NET transport aligned with the live connector contract.
- Keep browser save/search scoped, bounded, visible, and opt-in.
- Preserve locked TinyRustLM look and feel.
- Deploy connector-enabled static assets and run public-site proof separately.

### Slice 2: Retrieval quality

- Add deterministic dedupe, supersession filtering, scope weighting, and model-capacity-aware packing.
- Emit a redacted retrieval receipt with selected IDs and budget decisions.
- Gate with unseen, adversarial, stale, contradictory, and tiny-context fixtures.

### Slice 3: Offline queue and receipts

- Add a credential-free IndexedDB outbox, stable idempotency keys, Web Lock leadership, BroadcastChannel refresh, and explicit local/pending/synchronized UI states.
- Run timeout-after-accept, browser restart, multi-tab, and service outage recovery tests.

### Slice 4: Conflict and deletion contract

- Coordinate exact-parent revisions, conflict objects, tombstones, receipt lookup, server sequence, and device revocation with MemoryEndpoints agents.
- Implement client support only after live route schemas are stable.

### Slice 5: Optional relay deployment

- Deploy the narrow relay only when operationally useful.
- Require preflight, no-store, route rejection, status/handoff tier isolation, redaction, and rollback proof.

### Slice 6: Approval hardening

- Coordinate LocalEndpoints app identity, capability-specific approvals, risk categories, session defaults, durable signed-app approvals, revocation, and high-risk warnings.

## Memory Distribution Map

| Layer | Content | Authority | Failure behavior |
|---|---|---|---|
| Hot `.uai` | Concise current state, next actions, stable links, source/durable hashes | Startup continuity | Remains usable offline |
| Local durable backup | Twelve source reports, manifest, synthesis, TDD plan, implementation memory | Reviewed local evidence | Remains available if hosted service fails |
| Hosted `status` | Current batch state and next action | Cross-device short-term projection | Retryable; never blocks local continuity |
| Hosted `handoff` | Six reviewed domain summaries with source references | Cross-device long-term projection | Retryable; receipt and search readback required |
| Meeting room | Public-safe coordination, blockers, test evidence | Human/agent coordination | Not a substitute for durable memory |

## Completion Evidence

The batch is complete only when all of these agree:

- local source and durable report hashes;
- manifest rows and byte counts;
- ledger dispositions, processed outcomes, proof of use, and source removal;
- hot `.uai` routes and long-term checksum;
- MemoryEndpoints write receipts and tier-filtered readback;
- package, Rust, .NET, browser, verifier, secret-scan, and diff checks;
- placeholder-only active intake buckets.

No test weakening, canned response, fake hosted result, fixture-only success, hidden remote inference, or hardcoded marker is acceptable as proof.
