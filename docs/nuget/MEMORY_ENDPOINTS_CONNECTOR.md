# TinyRustLM MemoryEndpoints Optional Connector

`TinyRustLM.MemoryEndpoints` is an opt-in connector package for LocalEndpoints.com connect hosts and TinyRustLM tools that want to store public-safe `.uai` memory records in MemoryEndpoints.com.

The package is not part of the default protected public SDK set. It is packed only when the optional MemoryEndpoints package switch is enabled, and it never embeds workspace URLs, bearer tokens, or user memory.

## Boundary

- Users supply MemoryEndpoints route URIs and a bearer token at runtime.
- Tokens stay in process memory and are applied only as one configured workspace-key auth header:
  `Authorization: Bearer <WORKSPACE_KEY>` by default, or `X-MemoryEndpoints-Key: <WORKSPACE_KEY>` when a host selects the public alternate header.
- Public-safe fields reject obvious bearer tokens, API keys, passwords, secret markers, unsafe control characters, and oversized content.
- Long-term memory records require durable `.uai`, `docs/`, or `wiki/` references so MemoryEndpoints stores a summary plus pointers rather than replacing local long-term memory files.
- The connector does not run model inference on MemoryEndpoints.com and does not upload `.slm` model bytes.
- Meeting-room APIs are public-safe coordination lanes only. They list rooms, create focused `goal` or `task` rooms, post `safeSummary` messages, read room transcripts, and mark rooms read without carrying raw credentials or private payloads.

## Memory Scopes

- `short_term`: active working memory for current task coordination.
- `long_term`: durable memory summaries that reference local `.uai`, docs, or wiki reports.

## LocalEndpoints Use

LocalEndpoints.com connect hosts should treat this connector as an optional plugin. A user must explicitly configure routes and credentials, and the local host should keep its existing Local Connect approval policy for app-control actions. Memory sync is separate from local app-control approval.

Use `MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memoryendpoints.com"))` for the standard public MATM route set. The .NET connector exposes:

- agent registration, current-message inbox, notification acknowledgement, and direct current-message send;
- short-term and long-term memory save/search with TinyRustLM `short_term -> status` and `long_term -> handoff` mapping;
- meeting-room list/create/post/read/mark-read calls for project, goal, and task coordination lanes;
- typed transcript normalization through `ReadMeetingTranscriptAsync`, which reads the live `items` response shape (`meetingMessageId`, `safeSummary`, `senderAgentId`, `createdAt`) and fails closed if MemoryEndpoints reports raw credential or payload exposure flags.

## TinyRustLM Browser Use

TinyRustLM.com exposes MemoryEndpoints as an opt-in hosted memory layer in Advanced Model Selection.

- The browser persists only `enabled`, base URL, workspace ID, agent ID, non-secret auth-header mode, and non-secret hosted search tier.
- The workspace key is never written to `localStorage`; it stays in the current page session and is sent only as the selected workspace-key auth header.
- Save Short-Term and Save Long-Term send public-safe summaries to `/api/matm/memory-events/submit` using one closed event shape: `workspaceId`, `actorAgentId`, `kind`, `version`, `scope`, `scopeId`, `memoryType`, `subject`, `title`, `summary`, `source`, `confidence`, `uaiReferences`, `tags`, `tinyrustlmMemoryTier`, and optional `sourceSha256`. The fixed scope is `project`, the fixed scope ID is `tinyrustlm.com`, and `memoryType` is `status` or `handoff`.
- The memory-event shape rejects unknown members. Retired aliases such as `agentId` and `safeSummary` are not emitted or accepted; those names remain valid only in separate agent-registration, meeting-message, or internal TinyRustLM record contracts where they have their own documented semantics.
- Search sends an authenticated bounded GET query to `/api/matm/search` with TinyRustLM project-scope filters and optional tier filters: `memory_type=status` for short-term memory or `memory_type=handoff` for long-term memory.
- Search renders visible hosted snippets before generation can use them.
- Generation only includes hosted memory that is already visible in the hosted search preview.
- Hosted memory injection is budget-aware. Context-capable `.slm` entries receive the normal hosted-memory summary budget; tiny fixture models with very small context windows keep hosted results visible but do not force oversized hosted summaries into the runtime prompt.
- The browser does not upload `.slm` model bytes, raw `.uai` deck files, hidden prompts, or private logs.

## Offline And Multi-Tab Synchronization

TinyRustLM uses a credential-free IndexedDB outbox for opt-in hosted-memory writes.

- A local transaction stores the stable event ID, canonical payload SHA-256, stable idempotency key, retry state, scope, and local receipt before the UI reports `saved locally`.
- Workspace keys remain session-only and are never serialized into outbox, receipt, quarantine, checkpoint, remote-head, localStorage, Web Lock, or BroadcastChannel records.
- Browser restart recovers queued work. Interrupted sends become bounded retries with the original event ID, body, hash, and idempotency key.
- A workspace-scoped Web Lock elects one sending tab. Other tabs remain followers and refresh from a body-free BroadcastChannel completion notice.
- Reconnect always pulls authoritative revisions before pushing queued work. A write becomes `synchronized` only after a matching durable receipt proves the expected logical memory and public-safe body hash.
- Corrupt local rows are hash-quarantined and are not sent.
- The current technical identities are `memory_record.v1`, `outbox_entry.v2`, `local_receipt.v2`, submit-payload digest domain `v2`, and idempotency prefix `tinyrustlm-memory-v2`. Browser persistence uses a fresh `tinyrustlm-memory-endpoints` database. Earlier prelaunch rows have no reader, alias, migration, or fallback path and must not be relabeled as current evidence.

The shared Rust, .NET, and browser local engine also defines exact-parent revisions, explicit sibling conflicts, normalized-body deduplication, tombstones, device epochs and revocation, stale-index reporting, monotonic checkpoints, and conservative compaction. The deployed hosted v1 adapter uses one exact parent and a server-assigned revision ID; it records stale-parent, tombstone, and device decisions explicitly instead of silently applying last-write-wins. Hard forget returns a durable rejected receipt because the advertised retention policy does not support it.

### Distributed Sync Capability Negotiation

TinyRustLM probes public `GET /api/matm/sync/capabilities` without attaching a workspace key. The response must satisfy `memoryendpoints.distributed_sync_capabilities.v1`; Rust, C#, and browser validators reject partial or preview status, route drift, missing checkpoint or device authority, inconsistent retention or hard-forget claims, raw-exposure flags, and unknown fields.

The public C# API exposes `ProbeDistributedSyncAsync`. Its result is explicitly `Live`, `NotAdvertised`, or `Incompatible`; a `404` is not inferred as support and a malformed `200` is not treated as a transient online success. Advertised routes resolve only against the configured service origin and must remain below `/api/matm/sync/`.

After a successful live probe, `TinyRustLmMemoryEndpointsClient` exposes typed `SubmitRevisionMutationAsync`, `LookupRevisionReceiptAsync`, `PullRevisionChangesAsync`, `ReadRevisionHeadsAsync`, device register/rotate/revoke with explicit idempotency keys, and retention-policy operations. Calls before a live probe fail locally. Every distributed response is bounded to 256 KiB, must carry `Cache-Control: no-store`, must satisfy exact JSON member and redaction rules, and must match the submitted workspace, logical memory, and `bodyHash` before it is trusted. Search freshness comes from each changes page and head `indexedThroughSequence`; there is no separate search-watermark route in deployed v1.

The browser adapter exposes `MemoryEndpointsDistributedSyncClient` with the same operations. Its `synchronizePending` workflow runs under the existing workspace Web Lock, pulls and transactionally applies every authoritative page before loading pending writes, recovers uncertain writes through receipt lookup, and submits only mutations that still lack a receipt. Callers provide `loadPending`, `applyChangePage`, and `applyDecision` callbacks so IndexedDB commits remain atomic and credentials never enter persisted rows or BroadcastChannel notices.

Rust owns the deterministic wire validators and parsers in `tinyrustlm-memory-endpoints`; .NET and JavaScript pin the same canonical mutation body projection and full request fingerprint. The shared body hash is `10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f`, and the full golden fingerprint is `fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445`.

The exact deployed route and response contract is documented in `MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md`. The canonical capability example is `memoryendpoints-distributed-sync-capabilities-v1.example.json`.

MemoryEndpoints now exposes authoritative parent revisions, header-based receipt lookup, device authority epochs, tombstoned heads, monotonic changes, and indexed-through watermarks under `/api/matm/sync/*`. TinyRustLM verifies the exact public contract without credentials and separately verifies the complete authenticated lifecycle against the production MySQL authority. Direct CORS is the primary browser path; the optional relay is not required for distributed synchronization.

## Retrieval Safety

- Hosted search must prove `valuesRedacted=true` and no raw credential or payload exposure before results are accepted.
- Results remain visible in the existing preview, but only active, TinyRustLM project-scoped, firewall-accepted, promoted records may enter model context.
- Ranking, exact-body deduplication, explicit supersession, and tie breaking are deterministic across Rust, .NET, and JavaScript.
- Tiny and unknown-capacity models fail closed to visible results without forced hosted context. Medium models receive a reduced checked budget.
- Packed context is bounded UTF-8 JSON under an `UNTRUSTED MEMORY DATA` guard. Retrieved text cannot authorize tools, browser/email control, approvals, credential access, or policy changes; those require independent user confirmation and the normal authorization path.
- Retrieval receipts contain IDs, hashes, source/tier metadata, budgets, and exclusion reasons, never hosted summary bodies or credentials.

## Browser CORS Requirement

Direct browser sync requires MemoryEndpoints.com to answer unauthenticated `OPTIONS` preflight requests for the public MATM routes used by TinyRustLM:

- `/api/matm/agents/register`
- `/api/matm/memory-events/submit`
- `/api/matm/search`
- `/api/matm/meeting-rooms`
- `/api/matm/meeting-messages`
- `/api/matm/meeting-rooms/read`
- `/api/matm/sync/capabilities`
- `/api/matm/sync/devices`
- `/api/matm/sync/devices/rotate`
- `/api/matm/sync/devices/revoke`
- `/api/matm/sync/mutations`
- `/api/matm/sync/receipts`
- `/api/matm/sync/changes`
- `/api/matm/sync/heads`
- `/api/matm/sync/retention`

The browser client sends `GET`, `POST`, `Authorization`, `X-MemoryEndpoints-Key`, `Content-Type`, and `Idempotency-Key`. MemoryEndpoints should echo or allow the requesting origin for `https://tinyrustlm.com`, `https://www.tinyrustlm.com`, and loopback development origins such as `http://127.0.0.1:<port>` and `http://localhost:<port>`, with `Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers`. Without that CORS contract, direct API verification can pass while real browser fetches fail before TinyRustLM receives a response.

## Same-Origin Relay

TinyRustLM also supports a same-origin relay base URL, `/api/memoryendpoints`, for deployments where MemoryEndpoints.com CORS is not ready yet. The checked-in worker source is `tinyrustlm/deploy/memory-endpoints-relay-worker.js`.

The relay is intentionally narrow:

- it forwards only `/api/matm/*` requests to MemoryEndpoints.com;
- it allows only `GET`, `POST`, and preflight `OPTIONS`;
- it forwards only the selected workspace-key auth header, JSON content type, and idempotency key;
- it returns `Cache-Control: no-store`;
- it rejects oversized public-safe memory payloads;
- it does not accept `.slm`, `/models/`, Hugging Face `/resolve/`, or project-server model-byte routes.

The browser still keeps the workspace key session-only. The relay must not log, persist, or inspect bearer tokens or user memory bodies beyond normal request forwarding.

## Production Relay Deployment

The production route should be deployed as a narrow edge route in front of the existing static TinyRustLM.com site:

- route only `https://tinyrustlm.com/api/memoryendpoints/*` and `https://www.tinyrustlm.com/api/memoryendpoints/*`;
- use `tinyrustlm/deploy/memory-endpoints-relay-worker.js` as the worker source;
- use `tinyrustlm/deploy/memory-endpoints-relay-wrangler.toml.example` as the Cloudflare Wrangler starting point when Cloudflare Workers is the chosen edge layer;
- keep `MEMORYENDPOINTS_BASE_URL=https://memoryendpoints.com` as non-secret config unless testing a loopback upstream;
- do not put workspace IDs, workspace keys, bearer tokens, user memory, `.slm` bytes, or `.uai` deck bodies into worker config, environment variables, or logs.

After deployment, run the redacted production verifier:

- PowerShell: `eng/verify-memory-endpoints-relay-production.ps1`
- Bash: `eng/verify-memory-endpoints-relay-production.sh`

Set `MEMORYENDPOINTS_WORKSPACE_ID` and `MEMORYENDPOINTS_WORKSPACE_KEY` only in the shell/session running the verifier. The verifier writes `artifacts/reports/tinyrustlm-memory-endpoints-production-relay.json`, checks unauthenticated relay preflight, verifies model-byte style routes are rejected, registers `tinyrustlm-agent`, saves public-safe short-term `status` and long-term `handoff` records through the production relay, searches both tiers back through `memory_type`, checks cross-tier marker separation, requires `Cache-Control: no-store` on protected relay responses, and records no raw secrets.

Route checks run before credential checks. A missing or malformed route is recorded as `fail_route_contract` even when missing credentials are otherwise allowed, so a credential-free deployment probe cannot report a misleading skip. For deterministic local verifier development, `tinyrustlm/tools/memory-endpoints-relay-fixture-server.js` provides a loopback-only in-memory MATM fixture. Passing fixture reports prove the verifier contract, not production deployment.

As of 2026-07-10, the credential-free probe of `https://tinyrustlm.com/api/memoryendpoints` returns preflight `404` and therefore `fail_route_contract`. The worker and route configuration are ready to deploy, but production hosted-memory completion remains unproven until this probe and the credentialed browser/relay gates pass against the deployed TinyRustLM.com route.

## Verification

- Rust contract: `cargo test -p tinyrustlm-memory-endpoints`
- .NET wrapper: `dotnet test dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj --no-restore --filter MemoryEndpoints`
- Browser wire, local outbox, pull-before-push, revision, conflict, retrieval,
  and distributed-authority contracts:
  `npm --prefix tinyrustlm run test:unit -- <absolute-evidence-root>`.
- Real Chromium release surface at desktop, narrow-desktop, and mobile widths:
  `eng/verify-tinyrustlm-ui.ps1 -RunBrowserSmoke` or
  `RUN_BROWSER_SMOKE=1 eng/verify-tinyrustlm-ui.sh`. This is a browser and
  privacy regression gate; it does not fabricate a hosted-memory lifecycle.
- Production same-origin relay, optional until deployed: set `MEMORYENDPOINTS_WORKSPACE_ID` and `MEMORYENDPOINTS_WORKSPACE_KEY`, then run `eng/verify-memory-endpoints-relay-production.ps1` or `eng/verify-memory-endpoints-relay-production.sh`. Set `TINYRUSTLM_MEMORY_ENDPOINTS_RELAY_URL` only when validating a non-default deployed relay URL. This is the production proof gate for `https://tinyrustlm.com/api/memoryendpoints`.
- Live hosted storage, optional: set `MEMORYENDPOINTS_WORKSPACE_ID` and `MEMORYENDPOINTS_WORKSPACE_KEY`, then run `eng/verify-memory-endpoints-live.ps1` or `eng/verify-memory-endpoints-live.sh`. The live verifier writes `artifacts/reports/tinyrustlm-memory-endpoints-live.json`, redacts credentials, registers the TinyRustLM agent, saves short-term `status` and long-term `handoff` records, searches them back through `memory_type=status|handoff`, posts a public-safe probe to the TinyRustLM hosted-memory goal room, and verifies the live `meeting-messages` transcript returns `items` without raw credential or payload exposure flags.
- Distributed sync public contract: run `eng/verify-memory-endpoints-distributed-sync-contract.ps1` or `eng/verify-memory-endpoints-distributed-sync-contract.sh` without credentials. The gate requires the exact capability envelope, all eight protected routes, safe unauthenticated route rejection, `Cache-Control: no-store`, direct CORS, and matching OpenAPI routes when OpenAPI is available.
- Distributed sync fixture: run `eng/verify-memory-endpoints-distributed-sync-fixture.ps1`. CI uses the same exact contract gate against the loopback authority fixture.
- Distributed sync live lifecycle: set `MEMORYENDPOINTS_WORKSPACE_ID` and `MEMORYENDPOINTS_WORKSPACE_KEY` only in the current shell, then run `eng/verify-memory-endpoints-distributed-sync-live.ps1`. It proves device registration, applied mutation, exact replay, receipt lookup, incremental pull, unchanged head on stale-parent conflict, tombstone and blocked resurrection, authority-epoch rotation, stale-epoch rejection, device revocation, durable hard-forget rejection, temporary-device cleanup, and response secret scanning. The redacted report is `artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-live.json`.
