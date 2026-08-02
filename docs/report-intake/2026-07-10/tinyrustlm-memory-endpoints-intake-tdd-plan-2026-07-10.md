# TinyRustLM MemoryEndpoints TDD Plan

## Goal

Deliver optional, public-safe MemoryEndpoints-backed short-term and long-term memory for TinyRustLM clients while preserving local `.uai` continuity, local durable backups, the locked TinyRustLM UI, and honest `.slm` inference behavior.

This plan covers production deployment and relay, retrieval and context packing, Rust and .NET connector behavior, distributed synchronization and recovery, memory distribution and lifecycle, and security and threat model obligations.

## Non-Negotiable Test Rules

1. No test weakening to make an implementation pass.
2. No hardcoded success response, search hit, receipt, assistant answer, or tier marker outside a named deterministic fixture.
3. No mocked request may be described as live MemoryEndpoints evidence.
4. No fixture/demo `.slm` may be described as assistant-quality proof.
5. No browser-side fake assistant output or hidden remote inference.
6. No ignored exception, silent fallback, or broad retry that converts a real failure into a pass.
7. No credential, raw private memory, hidden prompt, model weight, or proprietary payload in test output or committed artifacts.
8. Every live claim must bind to a route, scope, memory type, receipt or record ID, readback result, and redacted evidence artifact.

## Red-Green-Refactor Order

For each vertical slice:

1. Add a failing test for the externally observable contract.
2. Confirm it fails for the intended reason.
3. Add the smallest production implementation that satisfies the contract.
4. Run focused tests, then the broader impacted suites.
5. Refactor only while all tests remain green.
6. Run secret-boundary, package-boundary, and diff checks.
7. For hosted behavior, run live write and readback after deterministic tests pass.

## Suite A: Intake Integrity

### A1. Active bucket completion

Fixture: `Content` and `Improvement` contain only `.gitkeep`.

Assertions:

- `README.md`, status files, indexes, and bucket-local guidance fail the verifier.
- A processed report left active without `kept-active-with-reason` fails.
- `kept-active-with-reason` requires a nonempty named blocker and remains an unfinished result.
- The final scan reports zero non-placeholder files in both buckets.

### A2. Durable manifest independence

Assertions for every hashed manifest row:

- durable path exists;
- byte length matches when recorded;
- SHA-256 matches exact bytes;
- validation does not require the source to remain active;
- a missing, modified, or unlisted durable file fails.

### A3. One source, one outcome

For the 43-report earlier batch and the 12-report connector batch:

- each source has one report-level ledger block;
- source path, durable path, category, and SHA-256 match the manifest;
- `processed_outcome` is exactly one of `incorporated`, `rejected-with-reason`, `preserved-to-durable-memory`, or `kept-active-with-reason`;
- completed entries have `source_removed: true`;
- duplicate ambiguous blocks fail.

### A4. Pointer integrity

- Hot `.uai` files contain the current manifest, synthesis, TDD, durable memory, and hosted distribution evidence routes.
- `.uai/long-term-memory.uai` contains a stable pointer ID, one-sentence routing summary, authority, review evidence, truth boundary, and exact SHA-256 of the durable target.
- Full report bodies in hot `.uai` fail a size/pattern audit.

## Suite B: Rust Connector Contract

### B1. Schema and tier mapping

- `ShortTerm` serializes to `status`.
- `LongTerm` serializes to `handoff`.
- Unknown tier, scope, or policy kind fails closed.
- Required scope, scope ID, agent ID, title, source, confidence, tags, and references are bounded.
- Public-safe summary respects the live 4000-character MemoryEndpoints limit.

### B2. Validation and redaction

- Missing durable references fail for long-term records.
- Credential-shaped strings, private keys, hidden prompts, local credential paths, and model-weight payloads are rejected or redacted before serialization.
- Validation errors never echo the rejected secret value.
- Unknown response fields do not break safe forward compatibility; raw exposure flags still fail closed.

### B3. Determinism

- Equal logical events produce equal canonical payload fingerprints.
- A retry reuses the original idempotency key.
- Reusing a key with changed payload bytes fails before transport.

## Suite C: .NET Wrapper Contract

### C1. HTTP shape

- Save posts to `/api/matm/memory-events/submit` with the public camel-case contract.
- Search gets `/api/matm/search` with explicit scope and `memory_type`.
- `Authorization: Bearer` and `X-MemoryEndpoints-Key` are both supported.
- A token already prefixed with `Bearer` is normalized once, never doubled.
- Meeting room list/create, message post/read, and transcript normalization follow the live response shape.

### C2. Tier isolation

- `SearchMemoryAsync(... LongTerm)` always sends `memory_type=handoff`.
- `SearchMemoryAsync(... ShortTerm)` always sends `memory_type=status`.
- A long-term-only helper cannot omit the tier filter.
- Mixed-tier diagnostic search is a separate explicit API and returns the tier on every result.

### C3. Transport resilience

- Cancellation propagates.
- Timeouts return bounded typed failures without token or response-body leakage.
- Mutation retry requires a caller-supplied idempotency key.
- GET retries may use bounded exponential backoff with jitter; POST retries preserve key and body.
- `429` and `Retry-After` are honored within hard limits.

### C4. Package quality

- Clean consumer restore/build/test succeeds from the produced package.
- XML docs and `.snupkg` are present.
- Package contents exclude source reports, credentials, private implementation, build output, and unrelated runtime internals.
- Trimming/AOT support is not claimed unless dedicated tests pass.

## Suite D: Browser Hosted Memory

### D1. Opt-in and UI lock

- Connector controls remain under existing advanced disclosure.
- Default state is disconnected and local-only.
- Enabling hosted memory does not alter approved desktop or mobile geometry outside the disclosed panel.
- Visual-lock screenshots wait for a stable loaded runtime and contain no transient error banner.

### D2. Credential boundary

- Workspace key never enters `localStorage`, IndexedDB, Cache API, service-worker cache, URL, referrer, DOM after connect, analytics, logs, or report JSON.
- Network evidence records header names and redacted booleans only.
- Disconnect clears page-memory credential state and rejects stale requests.
- Multi-tab logout/revoke invalidates stale tabs when that feature is implemented.

### D3. Save/search behavior

- Short-term save emits `memoryType=status`.
- Long-term save emits `memoryType=handoff` plus durable references.
- Search preview renders hosted text inertly.
- A result must be visible in preview before generation can use it.
- Status search excludes long-term marker; handoff search excludes short-term marker.

### D4. Model-aware context packing

Fixtures include tiny, medium, and context-capable `.slm` manifests.

- Tiny fixture gets no forced hosted-memory injection.
- Medium model gets a reduced bounded memory budget.
- Context-capable model reserves system, user, output, and guard tokens before hosted memory.
- Packed context records selected memory IDs, tier, scope, source, and compression stage without raw credential or private-body logging.
- Context overflow, malformed token counts, and unknown capacity fail closed to visible-memory-only mode.

### D5. Adversarial retrieval

Fixtures:

- prompt injection in summary;
- HTML/script payload;
- stale status superseded by handoff;
- contradictory reviewed records;
- exact duplicate hash;
- cross-project result;
- unreviewed low-confidence result;
- 100 oversized results;
- malicious instruction to call a tool or reveal secrets.

Assertions:

- rendered content is inert;
- scope and tier filters exclude foreign results;
- duplicate/superseded records are collapsed;
- hostile text remains data and cannot change system policy;
- risky tool or approval action requires an independent permission and user confirmation.

## Suite E: Production Deployment And Relay

### E1. Direct browser CORS

- Unauthenticated `OPTIONS` succeeds for TinyRustLM production and loopback origins.
- Required methods and headers include GET, POST, Authorization, X-MemoryEndpoints-Key, Content-Type, and Idempotency-Key.
- Foreign origins do not receive an allowed-origin response.
- Protected search without auth returns `401 auth_required`, not a browser CORS exception.

### E2. Relay policy

- Only `/api/matm/*` is forwarded.
- Arbitrary `url`, `target`, host, scheme, port, redirect, `Range`, and model-byte paths are rejected.
- Only bounded JSON/text traffic is accepted.
- Protected responses use `Cache-Control: no-store`.
- Oversized request fails before upstream fetch.
- Missing credential fails without revealing expected values.
- Upstream timeout is bounded and redacted.

### E3. Deployment proof

Separate gates:

- local relay fixture test;
- local browser through relay test;
- public preflight route test;
- credentialed public status/handoff save-search test;
- rollback route test.

A fixture pass cannot satisfy the public deployment gate. A public `404` remains a failure, never a skip.

## Suite F: Distributed Synchronization And Recovery

These tests begin only after the corresponding MemoryEndpoints routes and schemas exist.

### F1. Local outbox

- IndexedDB transaction atomically stores payload hash, event ID, idempotency key, scope, tier, retry state, and local receipt.
- Credential is absent from every persisted row.
- Browser restart reconstructs pending state.
- Corrupt rows are quarantined, not sent.

### F2. Multi-tab and reconnect

- Two tabs compete for one Web Lock; one sends and the follower refreshes through BroadcastChannel.
- Pull occurs before push after reconnect.
- Same-key retry after timeout creates one logical hosted record.
- A write is `saved locally` after local commit, `queued` before send, and `synchronized` only after authoritative receipt.

### F3. Concurrent devices

- Two devices edit the same parent revision.
- First accepted child becomes current; second becomes explicit conflict.
- No silent overwrite and no last-write-wins for prose.
- Byte-identical normalized bodies may deduplicate without conflict.

### F4. Tombstone and revocation

- Offline stale edit cannot resurrect a tombstoned memory.
- Hard forget is unavailable until an explicit supported route and retention contract exist.
- Revoked device cannot upload old queued mutations under a new identity.
- Workspace-key rotation does not destroy local queued public-safe work.

### F5. Scale and stale search

- Bootstrap and incremental pull cover 10,000 records with monotonic checkpoints.
- Search watermark behind accepted receipt is reported as stale.
- Compaction preserves live heads, unresolved conflicts, tombstones in retention, and authoritative receipts.

## Suite G: Memory Lifecycle

### G1. Duplicate and edition handling

- Exact bytes produce one durable body and a duplicate ledger outcome.
- Same canonical text with different line endings is recorded as an edition duplicate when canonical hashing is implemented.
- Changed content with same filename creates a new evidence identity and never overwrites old evidence.

### G2. Distillation quality

Every reviewed domain record contains:

- decisions;
- constraints;
- implementation tasks;
- test obligations;
- unresolved questions;
- rejected or superseded approaches;
- source report names and hashes;
- authority and truth boundary.

### G3. Hosted projection

- One concise batch `status` record is saved.
- Six domain `handoff` records are saved.
- Deterministic idempotency keys make rerun safe.
- Every handoff names the local durable route and manifest identity without exposing private paths or credentials.
- Status and handoff searches prove tier isolation.

### G4. Failure behavior

- Hosted outage does not roll back local durable memory.
- Partial hosted write records exactly which projection succeeded.
- Retry sends only missing logical records with original idempotency keys.
- Source removal happens after local preservation and intended hosted evidence, or a real blocker remains visible.

## Suite H: Security And Threat Model

### H1. Authentication and authorization

- Connector off by default.
- Every protected request is scoped by workspace plus project/goal/task and capability.
- Object identifiers alone never grant access.
- Retrieval permission is separate from context-injection permission.

### H2. XSS, CSRF, CORS, SSRF, and proxy abuse

- Hosted text cannot execute HTML or script.
- State-changing relay/BFF routes reject foreign Origin and cross-site Fetch Metadata when server sessions are introduced.
- No wildcard credentialed CORS.
- No arbitrary upstream destination or redirect escape.
- GET cannot mutate memory.

### H3. Logging and evidence

- Allowed fields: redacted request ID, route name, scope, memory type, result count, HTTP status, receipt ID, and hash prefix.
- Forbidden fields: credentials, cookies, auth values, raw prompt, raw memory body, hidden instructions, local private paths, and model bytes.
- Secret canaries inserted into each forbidden surface produce zero matches in logs and committed reports.

### H4. Approval policy

- Browser/email categories default to session approval with a high-risk warning.
- Durable approval binds exact signed app identity, origin, device, capability set, workspace scope, and policy version.
- Signer, origin, extension ID, device identity, capability expansion, or risk increase revokes or downgrades approval.
- Device-wide trusted mode excludes admin policy, unrestricted deletion, and cross-workspace sharing.

### H5. Supply chain

- Cargo lock and dependency audit.
- NuGet lock/package-boundary and symbol/source checks.
- JavaScript syntax, dependency, and deployment-source review.
- CI permissions and secret scan.
- Build provenance binds source SHA to deployed static/worker package.

## Suite I: MemoryEndpoints Dogfood Proof

Run against the TinyRustLM Hosted Memory Connector goal scope.

1. Register `tinyrustlm-agent`.
2. Save one public-safe `status` record summarizing current intake state.
3. Save six public-safe `handoff` records, one for each reviewed domain.
4. Search status with `memory_type=status`, goal scope, and a unique batch tag.
5. Search handoff with `memory_type=handoff`, same scope and tag.
6. Assert the status result contains the status marker and no handoff-only marker.
7. Assert all six handoff subjects are found and no status-only marker is returned.
8. Record redacted IDs, `persisted`, `visibleInSearch`, counts, and isolation result locally.
9. Post a public-safe evidence summary to the goal room.
10. If any route, index, field, or receipt behavior fails, post the exact redacted reproduction and expected contract to the MemoryEndpoints expansion project and goal rooms.

## Release Gates

The connector intake and memory distribution slice is green only when:

- active buckets are placeholder-only;
- all 55 current report rows have matching durable hashes and valid ledger outcomes;
- all six reviewed domains exist in synthesis, TDD, durable memory, and hosted handoff records;
- hot `.uai` points to the durable backup and hosted evidence with a matching checksum;
- Rust and .NET connector tests pass;
- browser direct-memory smoke passes with a context-capable local `.slm`;
- tier-isolated live status/handoff readback passes;
- no credential appears in localStorage, reports, logs, package contents, or git diff;
- public deployment is claimed only for routes and assets actually deployed and tested;
- `git diff --check` passes.
