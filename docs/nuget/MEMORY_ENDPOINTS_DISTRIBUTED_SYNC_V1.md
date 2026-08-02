# MemoryEndpoints Distributed Sync V1

TinyRustLM uses the deployed MemoryEndpoints distributed-sync v1 API for offline-first, conflict-safe browser and multi-device memory synchronization. Ordinary `/api/matm/memory-events/submit` and `/api/matm/search` remain useful public-safe memory lanes, but they are not revision authority. The `/api/matm/sync/*` routes own device epochs, immutable revisions, explicit conflicts, tombstoned heads, receipts, and monotonic pull checkpoints.

The service is capability-gated. TinyRustLM activates protected sync methods only after the public capability response passes exact field, route, semantic, redaction, and cache validation. Missing, preview, partial, malformed, or unknown contracts fail closed.

## Discovery

```text
GET /api/matm/sync/capabilities
```

Capability discovery is public and credential-free. The workspace key must not be attached to this request. The response envelope is:

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "memoryendpoints.distributed_sync_capabilities.v1",
    "status": "live",
    "protocol": "memoryendpoints-distributed-sync-v1",
    "capabilityRoute": "/api/matm/sync/capabilities"
  }
}
```

The complete exact example is `memoryendpoints-distributed-sync-capabilities-v1.example.json`. Unknown fields are rejected. The response must also advertise:

- the eight exact v1 routes below;
- operations `upsert`, `delete`, and `hard_forget`;
- `hardForgetSupported=false` and `hardForgetBehavior=safe_rejected_receipt`;
- revision fields `logicalMemoryId`, `parentRevisionId`, `syncRevisionId`, `serverSequence`, `bodyHash`, `conflict`, and `conflictCode`;
- query fields `workspace_id`, `after_sequence`, `limit`, and `logical_memory_id`;
- monotonic sequences and indexed-through watermarks;
- device authority epochs plus register, rotate, and revoke;
- no stored device secret material;
- positive tombstone retention;
- `publicSafeOnly=true`, `valuesRedacted=true`, `rawCredentialExposed=false`, and `rawPayloadExposed=false`.

All capability and protected responses require `Cache-Control: no-store`.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/matm/sync/capabilities` | Read the public live contract |
| `POST` | `/api/matm/sync/devices` | Register a stable device authority |
| `POST` | `/api/matm/sync/devices/rotate` | Advance a device authority epoch |
| `POST` | `/api/matm/sync/devices/revoke` | Revoke a device and all its epochs |
| `POST` | `/api/matm/sync/mutations` | Submit or exactly replay a public-safe revision mutation |
| `GET` | `/api/matm/sync/receipts` | Resolve an uncertain outcome by receipt ID or original idempotency header |
| `GET` | `/api/matm/sync/changes` | Pull monotonic revisions after a committed checkpoint |
| `GET` | `/api/matm/sync/heads` | Read authoritative logical-memory heads without search |
| `GET` | `/api/matm/sync/retention` | Read tombstone and hard-forget policy |

There is no separate search-watermark route. Each changes page and head exposes `indexedThroughSequence`. There is no v1 multi-parent merge request. A mutation names zero or one exact parent; the service assigns the immutable `syncRevisionId`.

## Authentication

Protected routes use a user-supplied workspace key in one supported header:

```text
Authorization: Bearer <WORKSPACE_KEY>
```

The key stays in page-session or process memory. It never enters IndexedDB, localStorage, URLs, JSON bodies, idempotency keys, BroadcastChannel messages, reports, receipts, or `.uai` files.

Direct browser use requires CORS preflight support for `Authorization`, `Content-Type`, and `Idempotency-Key`. TinyRustLM keeps the optional same-origin relay as a deployment alternative, not the primary synchronization path, because direct production CORS is verified.

## Device Authority

Register requests contain only public identifiers and a public-safe label:

```json
{
  "workspaceId": "workspace-id",
  "agentId": "tinyrustlm-agent",
  "deviceId": "stable-device-id",
  "label": "TinyRustLM browser on this device"
}
```

Register, rotate, and revoke requests require distinct stable `Idempotency-Key` headers. A successful response proves `persisted=true`, `deviceAuthorityPersisted=true`, an `active` or `revoked` device, and a positive `authorityEpoch`.

- Rotation increments the authority epoch. Queued rows keep their original event IDs, hashes, and idempotency keys, but an old epoch receives a durable `device_epoch_mismatch` rejected receipt.
- Revocation prevents every epoch of that device from writing. A queued write receives a durable `device_revoked` rejected receipt.
- Re-registering or relabeling cannot convert an old queued operation into a new device operation.

## Mutation Request

`POST /api/matm/sync/mutations` requires a stable `Idempotency-Key` and this public-safe body:

```json
{
  "workspaceId": "workspace-id",
  "actorAgentId": "tinyrustlm-agent",
  "deviceId": "stable-device-id",
  "deviceEpoch": 1,
  "logicalMemoryId": "stable-logical-memory-id",
  "operation": "upsert",
  "parentRevisionId": "syncrev-observed-head",
  "title": "Public-safe title",
  "summary": "Public-safe bounded memory summary.",
  "sourceRef": "tinyrustlm://offline-sync/local-memory",
  "scope": "goal",
  "scopeId": "goal-tinyrustlm-hosted-memory",
  "memoryType": "handoff",
  "bodyHash": "64-lowercase-hex"
}
```

Root creation omits `parentRevisionId`. An update or delete names the exact current `headRevisionId` observed before editing. The current protocol accepts at most 4,000 summary characters and TinyRustLM applies a 128 KiB client request bound plus a 256 KiB response bound.

`bodyHash` is SHA-256 over the UTF-8 bytes of this fixed-order JSON projection:

```json
{
  "logicalMemoryId": "...",
  "operation": "upsert",
  "parentRevisionId": "",
  "source": "...",
  "summary": "...",
  "title": "..."
}
```

The canonical full request orders fields as shown in the request example. Rust, C#, and JavaScript share this golden vector:

```text
bodyHash   10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f
fingerprint fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445
```

The vector uses workspace `workspace-fixture`, agent `tinyrustlm-agent`, device `device-a`, epoch `1`, logical memory `logical-memory-a`, parent `syncrev-parent`, title `Durable TinyRustLM memory`, summary `Public-safe durable memory.`, source `tinyrustlm://offline-sync/test`, goal scope, and `handoff` memory type.

## Decisions And Receipts

Applied mutations return HTTP `202`. Explicit conflicts and policy rejections return HTTP `409`. Both are durable decisions, not transport failures.

Every decision includes:

- `persisted=true`;
- a body-free `receipt` with `receiptId`, one-way `idempotencyKeyHash`, `bodyHash`, logical memory, server revision, status, conflict code, and server sequence;
- `revision` for `applied` and `conflict`, or `null` for `rejected`;
- the current `head` when one exists;
- `confirmation.persisted=true` plus receipt, changes, and head visibility flags;
- protected receipt, changes, and head readback URLs containing public identifiers only;
- redaction flags.

Statuses are:

- `applied`: the exact parent matched and the new revision became the head;
- `conflict`: the revision was durably recorded but did not replace the head;
- `rejected`: no revision was created, but the decision receipt was durably recorded.

Documented conflict codes are `parent_revision_mismatch`, `tombstone_resurrection_blocked`, and `head_not_found`. Documented rejection codes include `device_not_registered`, `device_revoked`, `device_epoch_mismatch`, `logical_memory_id_required`, and `hard_forget_not_supported`. Unknown statuses, codes, fields, identity drift, sequence drift, exposed idempotency keys, or failed confirmation invalidate the response.

An applied response has `ok=true`. Conflict and rejected responses have `ok=false`. The receipt never echoes the original idempotency key; `idempotencyKeyExposed` must remain false.

## Idempotency Recovery

The server binds one request body to `(workspace, operation, Idempotency-Key)`.

- Same key and same body returns the original status and receipt with `idempotentReplay=true`.
- Same key and different body returns a nested public-safe `idempotency_conflict` error and performs no mutation.
- A dropped response leaves the local row uncertain.
- The client resolves uncertainty with `GET /api/matm/sync/receipts?workspace_id=...` and sends the original key only in `Idempotency-Key`.
- A matching receipt must have the expected logical memory and `bodyHash` before the local row becomes synchronized.

Receipt lookup deliberately avoids putting the idempotency key in the URL, browser history, referrer, or ordinary query logs.

Non-decision failures use:

```json
{
  "ok": false,
  "safeNoOp": true,
  "valuesRedacted": true,
  "rawCredentialExposed": false,
  "rawPayloadExposed": false,
  "error": {
    "code": "public_machine_code",
    "title": "Public-safe title",
    "detail": "Public-safe detail",
    "safeNoOp": true,
    "valuesRedacted": true
  }
}
```

## Pull Before Push

```text
GET /api/matm/sync/changes?workspace_id=...&after_sequence=...&limit=...
```

An optional `logical_memory_id` narrows readback. `items` are immutable public-safe revisions ordered by strictly increasing workspace `serverSequence`. The page includes:

- `count` and `hasMore`;
- `nextAfterSequence`;
- `indexedThroughSequence`;
- a checkpoint with one-way `workspaceIdHash`, requested `afterSequence`, and `nextAfterSequence`;
- redaction flags.

A client applies the complete page and derived heads in one local transaction, then commits `nextAfterSequence`. Callback failure leaves the prior checkpoint intact. Search is never used as an authoritative pull source. Received summaries are untrusted retrieval data and remain inside the prompt-injection guard and deterministic context budget.

Reconnect synchronization runs in this order:

1. Acquire the workspace Web Lock.
2. Pull and transactionally apply every changes page.
3. Load pending outbox rows only after pull commits.
4. Resolve uncertain rows by receipt lookup.
5. Submit rows still lacking a receipt.
6. Transactionally apply each decision.
7. Broadcast only stable event IDs to follower tabs.

## Heads, Tombstones, And Retention

```text
GET /api/matm/sync/heads?workspace_id=...&logical_memory_id=...
```

Heads are authoritative and do not depend on search. A stale-parent conflict must leave `headRevisionId` unchanged. `delete` with the current parent creates a `tombstoned` head. A later upsert does not resurrect it implicitly and receives `tombstone_resurrection_blocked`.

`GET /api/matm/sync/retention?workspace_id=...` currently advertises positive tombstone retention, no raw private payload storage, and no hard forget. A `hard_forget` mutation therefore produces a durable `hard_forget_not_supported` rejected receipt. Local compaction must retain live heads, unresolved conflict evidence, tombstones inside retention, uncertain operations, authoritative receipts, and the last committed checkpoint.

## Public SDKs

Rust exposes strict capability parsing, canonical body hashing/fingerprinting, request validation, typed decision/receipt/revision/head/page/device/retention parsing, and the deterministic local conflict, retrieval, checkpoint, and compaction engine in `tinyrustlm-memory-endpoints`.

C# exposes the same wire contract through `MemoryEndpointsDistributedSyncProtocol`, `MemoryEndpointsDistributedSyncTransport`, and `TinyRustLmMemoryEndpointsClient`:

- `ProbeDistributedSyncAsync`;
- `RegisterSyncDeviceAsync`, `RotateSyncDeviceAsync`, and `RevokeSyncDeviceAsync` with explicit idempotency keys;
- `SubmitRevisionMutationAsync`;
- `LookupRevisionReceiptAsync`;
- `PullRevisionChangesAsync`;
- `ReadRevisionHeadsAsync`;
- `GetSyncRetentionPolicyAsync`.

The browser exposes the same operations through `MemoryEndpointsDistributedSyncClient` and `synchronizePending`. The production module is `tinyrustlm/app/memory-endpoints-distributed-sync-v1.js`; `memory-endpoints-sync.js` composes it with IndexedDB, Web Locks, BroadcastChannel, deterministic retrieval, and local conflict logic.

These are interoperability APIs. They do not expose MemoryEndpoints server storage internals, device secrets, retention jobs, database credentials, proprietary model logic, or TinyRustLM model bytes.

## Verification

Run the credential-free contract gate against production:

```powershell
eng\verify-memory-endpoints-distributed-sync-contract.ps1
```

Run the same exact gate against the local authority fixture:

```powershell
eng\verify-memory-endpoints-distributed-sync-fixture.ps1
```

Run the authenticated live lifecycle only with workspace credentials supplied through the current process environment:

```powershell
$env:MEMORYENDPOINTS_WORKSPACE_ID = "<workspace-id>"
$env:MEMORYENDPOINTS_WORKSPACE_KEY = "<session-only-key>"
eng\verify-memory-endpoints-distributed-sync-live.ps1
```

The live verifier creates public-safe test revisions, tombstones its test memory, revokes both temporary devices, scans responses for credential exposure, and writes only redacted evidence to `artifacts/reports/tinyrustlm-memory-endpoints-distributed-sync-live.json`. The current deployed source and backend truth come from `/api/version`; do not hard-code a production SHA in client logic.

Run local runtime tests with:

```powershell
cargo test -p tinyrustlm-memory-endpoints
dotnet test dotnet\tests\TinyRustLM.Core.Tests\TinyRustLM.Core.Tests.csproj
node --test tinyrustlm\tests\memory-endpoints-sync.test.js tinyrustlm\tests\memory-endpoints-distributed-sync-authority.test.js
```
