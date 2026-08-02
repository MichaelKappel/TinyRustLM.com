"use strict";

const crypto = require("node:crypto");
const http = require("node:http");

const WORKSPACE_ID = "workspace-fixture";
const WORKSPACE_KEY = "fixture-session-only-workspace-key";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function capabilities() {
  return {
    schemaVersion: "memoryendpoints.distributed_sync_capabilities.v1",
    status: "live",
    protocol: "memoryendpoints-distributed-sync-v1",
    capabilityRoute: "/api/matm/sync/capabilities",
    routes: {
      registerDevice: "/api/matm/sync/devices",
      rotateDevice: "/api/matm/sync/devices/rotate",
      revokeDevice: "/api/matm/sync/devices/revoke",
      submitMutation: "/api/matm/sync/mutations",
      lookupReceipt: "/api/matm/sync/receipts",
      changes: "/api/matm/sync/changes",
      heads: "/api/matm/sync/heads",
      retention: "/api/matm/sync/retention"
    },
    mutationContract: {
      operations: ["upsert", "delete", "hard_forget"],
      hardForgetSupported: false,
      hardForgetBehavior: "safe_rejected_receipt",
      idempotency: "Idempotency-Key is required for reliable offline retry; receipt lookup accepts the same key and never echoes it.",
      revisionFields: [
        "logicalMemoryId", "parentRevisionId", "syncRevisionId", "serverSequence",
        "bodyHash", "conflict", "conflictCode"
      ],
      conflictSemantics: "When an existing head is updated without the current parent revision, the mutation is durably recorded as conflict and the head remains unchanged.",
      tombstoneSemantics: "Delete creates a tombstoned head; later upsert is blocked unless a future explicit resurrection contract is advertised."
    },
    checkpointContract: {
      changesQuery: ["workspace_id", "after_sequence", "limit", "logical_memory_id"],
      monotonicServerSequence: true,
      indexedThroughWatermark: true,
      paginationFields: [
        "items", "hasMore", "nextAfterSequence", "indexedThroughSequence", "checkpoint"
      ]
    },
    deviceContract: {
      authorityEpoch: true,
      registerRotateRevoke: true,
      revokedDeviceMutationBehavior: "safe_rejected_receipt",
      secretMaterialStored: false
    },
    retention: {
      tombstoneRetentionDays: 30,
      hardForgetSupported: false,
      rawPrivatePayloadStored: false,
      valuesRedacted: true
    },
    publicSafeOnly: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false,
    valuesRedacted: true
  };
}

function createState() {
  return {
    devices: new Map(),
    heads: new Map(),
    revisions: [],
    receiptsById: new Map(),
    receiptsByKey: new Map(),
    idempotency: new Map(),
    nextRevision: 1,
    nextReceipt: 1,
    nextSequence: 1,
    dropNextMutationResponse: false
  };
}

function createDistributedSyncFixtureServer() {
  const state = createState();
  let server;

  return {
    workspaceId: WORKSPACE_ID,
    workspaceKey: WORKSPACE_KEY,
    async listen() {
      server = http.createServer((request, response) => {
        routeRequest(state, request, response).catch((error) => {
          writeJson(response, 500, safeFailure("fixture_internal_error", error.name));
        });
      });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    async close() {
      if (server) {
        await new Promise((resolve, reject) =>
          server.close((error) => error ? reject(error) : resolve()));
      }
    }
  };
}

async function routeRequest(state, request, response) {
  const url = new URL(request.url, "http://fixture.invalid");
  if (request.method === "OPTIONS") {
    response.writeHead(204, responseHeaders());
    response.end();
    return;
  }
  if (url.pathname === "/api/matm/sync/capabilities" && request.method === "GET") {
    writeJson(response, 200, { ok: true, data: capabilities() });
    return;
  }
  if (url.pathname === "/__test__/drop-next-mutation-response" && request.method === "POST") {
    state.dropNextMutationResponse = true;
    writeJson(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__test__/state" && request.method === "GET") {
    writeJson(response, 200, {
      ok: true,
      deviceCount: state.devices.size,
      headCount: state.heads.size,
      revisionCount: state.revisions.length,
      receiptCount: state.receiptsById.size,
      idempotencyCount: state.idempotency.size,
      rawCredentialStored: false
    });
    return;
  }
  if (request.headers.authorization !== `Bearer ${WORKSPACE_KEY}`) {
    writeJson(response, 401, safeFailure("auth_required", "Workspace key required"));
    return;
  }

  const body = ["POST", "PUT", "PATCH"].includes(request.method)
    ? await readJson(request)
    : null;
  const workspaceId = body && body.workspaceId || url.searchParams.get("workspace_id");
  if (workspaceId !== WORKSPACE_ID) {
    writeJson(response, 401, safeFailure("workspace_mismatch", "Workspace does not match authority"));
    return;
  }

  if (url.pathname === "/api/matm/sync/devices" && request.method === "POST") {
    handleDeviceMutation(state, request, response, body, "register");
    return;
  }
  if (url.pathname === "/api/matm/sync/devices/rotate" && request.method === "POST") {
    handleDeviceMutation(state, request, response, body, "rotate");
    return;
  }
  if (url.pathname === "/api/matm/sync/devices/revoke" && request.method === "POST") {
    handleDeviceMutation(state, request, response, body, "revoke");
    return;
  }
  if (url.pathname === "/api/matm/sync/mutations" && request.method === "POST") {
    handleMutation(state, request, response, body);
    return;
  }
  if (url.pathname === "/api/matm/sync/receipts" && request.method === "GET") {
    handleReceiptLookup(state, request, response, url);
    return;
  }
  if (url.pathname === "/api/matm/sync/changes" && request.method === "GET") {
    handleChanges(state, response, url);
    return;
  }
  if (url.pathname === "/api/matm/sync/heads" && request.method === "GET") {
    handleHeads(state, response, url);
    return;
  }
  if (url.pathname === "/api/matm/sync/retention" && request.method === "GET") {
    writeJson(response, 200, {
      ok: true,
      policy: {
        schemaVersion: "memoryendpoints.sync_retention.v1",
        tombstoneRetentionDays: 30,
        hardForgetSupported: false,
        hardForgetBehavior: "safe_rejected_receipt",
        rawPrivatePayloadStored: false,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      },
      capabilities: capabilities(),
      valuesRedacted: true,
      rawCredentialExposed: false,
      rawPayloadExposed: false
    });
    return;
  }
  writeJson(response, 404, safeFailure("route_not_found", "Fixture route not found"));
}

function handleDeviceMutation(state, request, response, body, action) {
  const idempotencyKey = String(request.headers["idempotency-key"] || "");
  if (!idempotencyKey) {
    writeJson(response, 422, safeFailure("idempotency_key_required", "Idempotency key required"));
    return;
  }
  if (!body.agentId || !body.deviceId) {
    writeJson(response, 422, safeFailure("device_request_invalid", "Agent and device are required"));
    return;
  }
  const replay = replayOrConflict(state, `device:${action}:${idempotencyKey}`, body);
  if (replay) {
    writeJson(response, replay.status, replay.body);
    return;
  }
  const existing = state.devices.get(body.deviceId);
  if (action !== "register" && !existing) {
    writeJson(response, 404, safeFailure("sync_device_not_found", "Device not found"));
    return;
  }
  if (action === "rotate" && existing.status === "revoked") {
    writeJson(response, 409, safeFailure("sync_device_revoked", "Revoked device cannot rotate"));
    return;
  }
  const now = new Date().toISOString();
  const device = existing || {
    deviceId: body.deviceId,
    workspaceId: WORKSPACE_ID,
    agentId: body.agentId,
    label: body.label || body.deviceId,
    status: "active",
    authorityEpoch: 1,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    valuesRedacted: true,
    rawPayloadExposed: false
  };
  device.agentId = body.agentId;
  device.label = body.label || device.label;
  device.updatedAt = now;
  if (action === "register") {
    device.status = "active";
  } else if (action === "rotate") {
    device.authorityEpoch += 1;
  } else {
    device.status = "revoked";
    device.revokedAt = now;
  }
  state.devices.set(device.deviceId, device);
  const payload = deviceResponse(action, device);
  const status = action === "register" ? 201 : 200;
  state.idempotency.set(`device:${action}:${idempotencyKey}`, {
    bodyHash: sha256(JSON.stringify(body)),
    body: clone(payload),
    status
  });
  writeJson(response, status, payload);
}

function deviceResponse(action, device) {
  return {
    ok: true,
    persisted: true,
    visibleToAgent: true,
    deviceAuthorityPersisted: true,
    canonicalWorkspaceId: WORKSPACE_ID,
    canonicalDeviceId: device.deviceId,
    device: clone(device),
    capabilityRoute: "/api/matm/sync/capabilities",
    operatorSummary: {
      schemaVersion: "memoryendpoints.sync_device_operator_summary.v1",
      action,
      deviceId: device.deviceId,
      status: device.status,
      authorityEpoch: device.authorityEpoch,
      persisted: true,
      valuesRedacted: true,
      rawCredentialExposed: false,
      rawPayloadExposed: false
    },
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  };
}

function handleMutation(state, request, response, body) {
  const idempotencyKey = String(request.headers["idempotency-key"] || "");
  if (!idempotencyKey) {
    writeJson(response, 422, safeFailure("idempotency_key_required", "Idempotency key required"));
    return;
  }
  const replay = replayOrConflict(state, `mutation:${idempotencyKey}`, body);
  if (replay) {
    writeJson(response, replay.status, replay.body);
    return;
  }
  const device = state.devices.get(body.deviceId);
  let rejectionCode = "";
  if (!device) {
    rejectionCode = "device_not_registered";
  } else if (device.status === "revoked") {
    rejectionCode = "device_revoked";
  } else if (body.deviceEpoch && body.deviceEpoch !== device.authorityEpoch) {
    rejectionCode = "device_epoch_mismatch";
  } else if (body.operation === "hard_forget") {
    rejectionCode = "hard_forget_not_supported";
  } else if (!body.logicalMemoryId) {
    rejectionCode = "logical_memory_id_required";
  }

  const currentHead = state.heads.get(body.logicalMemoryId) || null;
  let conflictCode = "";
  if (!rejectionCode) {
    if (currentHead && String(body.parentRevisionId || "") !== currentHead.headRevisionId) {
      conflictCode = "parent_revision_mismatch";
    }
    if (body.operation === "upsert" && currentHead && currentHead.status === "tombstoned") {
      conflictCode = "tombstone_resurrection_blocked";
    }
    if (body.operation === "delete" && !currentHead) {
      conflictCode = "head_not_found";
    }
  }
  const statusName = rejectionCode ? "rejected" : conflictCode ? "conflict" : "applied";
  const httpStatus = statusName === "applied" ? 202 : 409;
  let revision = null;
  let serverSequence = 0;
  if (statusName !== "rejected") {
    serverSequence = state.nextSequence++;
    revision = {
      syncRevisionId: `syncrev-${String(state.nextRevision++).padStart(8, "0")}`,
      workspaceId: WORKSPACE_ID,
      logicalMemoryId: body.logicalMemoryId,
      parentRevisionId: body.parentRevisionId || "",
      memoryEventId: "",
      actorAgentId: body.actorAgentId,
      deviceId: body.deviceId,
      deviceEpoch: body.deviceEpoch || device.authorityEpoch,
      operation: body.operation || "upsert",
      status: statusName,
      conflict: Boolean(conflictCode),
      conflictCode,
      serverSequence,
      bodyHash: body.bodyHash,
      source: body.sourceRef || "api",
      title: body.title || body.logicalMemoryId,
      summary: body.summary || "",
      scope: body.scope || "workspace",
      scopeId: body.scopeId || WORKSPACE_ID,
      memoryType: body.memoryType || "note",
      tombstone: body.operation === "delete",
      createdAt: new Date().toISOString(),
      valuesRedacted: true,
      rawPayloadExposed: false
    };
    state.revisions.push(revision);
    if (statusName === "applied") {
      state.heads.set(body.logicalMemoryId, {
        logicalMemoryId: body.logicalMemoryId,
        workspaceId: WORKSPACE_ID,
        headRevisionId: revision.syncRevisionId,
        serverSequence,
        indexedThroughSequence: serverSequence,
        status: body.operation === "delete" ? "tombstoned" : "active",
        updatedAt: revision.createdAt,
        valuesRedacted: true,
        rawPayloadExposed: false
      });
    }
  }
  const receipt = {
    receiptId: `syncreceipt-${String(state.nextReceipt++).padStart(8, "0")}`,
    workspaceId: WORKSPACE_ID,
    idempotencyKeyHash: `sha256:${sha256(idempotencyKey)}`,
    bodyHash: body.bodyHash,
    logicalMemoryId: body.logicalMemoryId || "missing-logical-memory",
    syncRevisionId: revision ? revision.syncRevisionId : "",
    serverSequence,
    status: statusName,
    conflict: Boolean(conflictCode),
    conflictCode: conflictCode || rejectionCode,
    currentHeadRevisionId: currentHead ? currentHead.headRevisionId : "",
    httpStatus: statusName === "applied" ? "202 Accepted" : "409 Conflict",
    createdAt: new Date().toISOString(),
    idempotencyKeyExposed: false,
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  };
  state.receiptsById.set(receipt.receiptId, receipt);
  state.receiptsByKey.set(idempotencyKey, receipt);
  const head = state.heads.get(body.logicalMemoryId) || currentHead;
  const payload = mutationResponse(statusName, receipt, revision, head);
  state.idempotency.set(`mutation:${idempotencyKey}`, {
    bodyHash: sha256(JSON.stringify(body)),
    body: clone(payload),
    status: httpStatus
  });
  if (state.dropNextMutationResponse) {
    state.dropNextMutationResponse = false;
    request.socket.destroy();
    return;
  }
  writeJson(response, httpStatus, payload);
}

function mutationResponse(status, receipt, revision, head) {
  const applied = status === "applied";
  const conflict = status === "conflict";
  return {
    ok: applied,
    persisted: true,
    receipt: clone(receipt),
    revision: revision ? clone(revision) : null,
    head: head ? clone(head) : null,
    serverSequence: receipt.serverSequence,
    indexedThroughSequence: head ? head.indexedThroughSequence : receipt.serverSequence,
    conflict,
    status,
    operatorSummary: operatorSummary("mutation", status, receipt),
    receiptQueryUrl: `/api/matm/sync/receipts?workspace_id=${WORKSPACE_ID}&receipt_id=${receipt.receiptId}`,
    changesQueryUrl: `/api/matm/sync/changes?workspace_id=${WORKSPACE_ID}&after_sequence=${Math.max(0, receipt.serverSequence - 1)}`,
    headsQueryUrl: `/api/matm/sync/heads?workspace_id=${WORKSPACE_ID}&logical_memory_id=${receipt.logicalMemoryId}`,
    capabilityRoute: "/api/matm/sync/capabilities",
    confirmation: {
      schemaVersion: "memoryendpoints.sync_mutation_confirmation.v1",
      persisted: true,
      receiptVisible: true,
      revisionVisibleInChanges: true,
      headVisible: true,
      changesCount: revision ? 1 : 0,
      headsCount: applied && head ? 1 : 0,
      receiptId: receipt.receiptId,
      revisionId: receipt.syncRevisionId,
      logicalMemoryId: receipt.logicalMemoryId,
      indexedThroughSequence: head ? head.indexedThroughSequence : receipt.serverSequence,
      valuesRedacted: true,
      rawCredentialExposed: false,
      rawPayloadExposed: false
    },
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  };
}

function operatorSummary(action, status, receipt) {
  return {
    schemaVersion: "memoryendpoints.sync_operator_summary.v1",
    action,
    status,
    serverSequence: receipt.serverSequence,
    conflict: receipt.conflict,
    conflictCode: receipt.conflictCode,
    persisted: true,
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  };
}

function handleReceiptLookup(state, request, response, url) {
  const idempotencyKey = String(request.headers["idempotency-key"] ||
    url.searchParams.get("idempotency_key") || "");
  const receiptId = url.searchParams.get("receipt_id") || "";
  const receipt = receiptId
    ? state.receiptsById.get(receiptId)
    : state.receiptsByKey.get(idempotencyKey);
  if (!receipt) {
    writeJson(response, 404, safeFailure("sync_receipt_not_found", "Receipt not found"));
    return;
  }
  writeJson(response, 200, {
    ok: true,
    receipt: clone(receipt),
    operatorSummary: operatorSummary("receipt", receipt.status, receipt),
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  });
}

function handleChanges(state, response, url) {
  const afterSequence = Math.max(0, Number(url.searchParams.get("after_sequence") || 0));
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const logicalMemoryId = url.searchParams.get("logical_memory_id") || "";
  const matching = state.revisions.filter((item) =>
    item.serverSequence > afterSequence &&
    (!logicalMemoryId || item.logicalMemoryId === logicalMemoryId));
  const items = matching.slice(0, limit).map(clone);
  const nextAfterSequence = items.length
    ? items[items.length - 1].serverSequence
    : afterSequence;
  const indexedThroughSequence = state.revisions.length
    ? state.revisions[state.revisions.length - 1].serverSequence
    : 0;
  writeJson(response, 200, {
    ok: true,
    changes: {
      items,
      count: items.length,
      hasMore: matching.length > items.length,
      nextAfterSequence,
      indexedThroughSequence,
      checkpoint: {
        workspaceIdHash: `sha256:${sha256(WORKSPACE_ID)}`,
        afterSequence,
        nextAfterSequence,
        valuesRedacted: true
      },
      valuesRedacted: true,
      rawCredentialExposed: false,
      rawPayloadExposed: false
    },
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  });
}

function handleHeads(state, response, url) {
  const logicalMemoryId = url.searchParams.get("logical_memory_id") || "";
  const items = Array.from(state.heads.values())
    .filter((item) => !logicalMemoryId || item.logicalMemoryId === logicalMemoryId)
    .sort((left, right) => Buffer.compare(
      Buffer.from(left.logicalMemoryId),
      Buffer.from(right.logicalMemoryId)))
    .map(clone);
  writeJson(response, 200, {
    ok: true,
    items,
    count: items.length,
    filters: logicalMemoryId ? { logicalMemoryId } : {},
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  });
}

function replayOrConflict(state, key, body) {
  const record = state.idempotency.get(key);
  if (!record) {
    return null;
  }
  if (record.bodyHash !== sha256(JSON.stringify(body))) {
    return {
      status: 409,
      body: safeFailure("idempotency_conflict", "Idempotency key reused with another body")
    };
  }
  return {
    status: record.status,
    body: { ...clone(record.body), idempotentReplay: true, idempotencyKeyExposed: false }
  };
}

function safeFailure(code, detail) {
  return {
    ok: false,
    safeNoOp: true,
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false,
    error: {
      code,
      title: "Fixture request rejected",
      detail,
      safeNoOp: true,
      valuesRedacted: true
    }
  };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) {
      throw new Error("request_too_large");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function responseHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function writeJson(response, status, body) {
  if (response.destroyed) {
    return;
  }
  response.writeHead(status, responseHeaders());
  response.end(JSON.stringify(body));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createDistributedSyncFixtureServer };

if (require.main === module) {
  const fixture = createDistributedSyncFixtureServer();
  fixture.listen().then((baseUrl) => {
    process.stdout.write(`${JSON.stringify({ baseUrl })}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.name}: fixture startup failed\n`);
    process.exitCode = 1;
  });
  const close = async () => {
    await fixture.close();
    process.exit(0);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
