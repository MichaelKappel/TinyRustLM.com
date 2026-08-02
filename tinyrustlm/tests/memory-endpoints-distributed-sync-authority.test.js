"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const sync = require("../app/memory-endpoints-sync.js");
const {
  createDistributedSyncFixtureServer
} = require("../tools/memory-endpoints-distributed-sync-fixture-server.js");

function mutation({
  logicalMemoryId,
  parentRevisionId = null,
  summary,
  deviceId = "device-a",
  deviceEpoch = 1,
  operation = "upsert",
  title = "TinyRustLM distributed memory"
}) {
  return {
    workspaceId: "workspace-fixture",
    actorAgentId: "tinyrustlm-agent",
    deviceId,
    deviceEpoch,
    logicalMemoryId,
    operation,
    ...(parentRevisionId ? { parentRevisionId } : {}),
    title,
    summary,
    sourceRef: "tinyrustlm://offline-sync/test",
    scope: "goal",
    scopeId: "goal-tinyrustlm-hosted-memory",
    memoryType: "handoff",
    bodyHash: ""
  };
}

function createClient(baseUrl, workspaceKey, fetchImpl = fetch) {
  return new sync.MemoryEndpointsDistributedSyncClient({
    fetch: fetchImpl,
    serviceBaseUrl: baseUrl,
    workspaceId: "workspace-fixture",
    agentId: "tinyrustlm-agent",
    headers: { Authorization: `Bearer ${workspaceKey}` }
  });
}

function device(deviceId, label = `TinyRustLM ${deviceId}`) {
  return {
    workspaceId: "workspace-fixture",
    agentId: "tinyrustlm-agent",
    deviceId,
    label
  };
}

test("production browser transport is capability-gated and cross-runtime deterministic", async (t) => {
  const fixture = createDistributedSyncFixtureServer();
  const baseUrl = await fixture.listen();
  t.after(() => fixture.close());
  const recorded = [];
  const recordingFetch = async (url, options) => {
    recorded.push({ url: String(url), headers: { ...(options.headers || {}) } });
    return fetch(url, options);
  };
  const client = createClient(baseUrl, fixture.workspaceKey, recordingFetch);

  const availability = await client.connect();
  assert.equal(availability.status, "live");
  assert.equal(availability.capabilities.routes.lookupReceipt, "/api/matm/sync/receipts");
  assert.equal(recorded[0].headers.Authorization, undefined);

  const golden = mutation({
    logicalMemoryId: "logical-memory-a",
    parentRevisionId: "syncrev-parent",
    summary: "Public-safe durable memory.",
    title: "Durable TinyRustLM memory"
  });
  const canonical = await sync.canonicalizeHostedRevisionMutation(golden);
  assert.equal(
    canonical.bodyHash,
    "10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f"
  );
  assert.equal(
    await sync.hostedRevisionMutationFingerprint(golden),
    "fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445"
  );
});

test("authoritative fixture preserves replay, conflict, tombstone, and device semantics", async (t) => {
  const fixture = createDistributedSyncFixtureServer();
  const baseUrl = await fixture.listen();
  t.after(() => fixture.close());
  const client = createClient(baseUrl, fixture.workspaceKey);
  await client.connect();

  await client.registerDevice(device("device-a"), "device-register-a");
  await client.registerDevice(device("device-b"), "device-register-b");

  const rootMutation = mutation({
    logicalMemoryId: "logical-shared",
    summary: "Original authoritative memory."
  });
  const root = await client.submitMutation(rootMutation, "mutation-root");
  assert.equal(root.status, "applied");
  assert.equal(root.persisted, true);
  assert.equal(root.confirmation.persisted, true);
  const rootRevisionId = root.revision.syncRevisionId;

  const replay = await client.submitMutation(rootMutation, "mutation-root");
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.receipt.receiptId, root.receipt.receiptId);

  const lookupMutation = await sync.canonicalizeHostedRevisionMutation(rootMutation);
  const lookup = await client.lookupReceipt({
    idempotencyKey: "mutation-root",
    logicalMemoryId: "logical-shared",
    bodyHash: lookupMutation.bodyHash
  });
  assert.equal(lookup.receiptId, root.receipt.receiptId);
  assert.equal(JSON.stringify(lookup).includes("mutation-root"), false);

  const deviceAEdit = mutation({
    logicalMemoryId: "logical-shared",
    parentRevisionId: rootRevisionId,
    summary: "Device A authoritative edit.",
    deviceId: "device-a"
  });
  const acceptedA = await client.submitMutation(deviceAEdit, "mutation-device-a");
  assert.equal(acceptedA.status, "applied");

  const deviceBEdit = mutation({
    logicalMemoryId: "logical-shared",
    parentRevisionId: rootRevisionId,
    summary: "Device B concurrent edit.",
    deviceId: "device-b"
  });
  const conflictB = await client.submitMutation(deviceBEdit, "mutation-device-b");
  assert.equal(conflictB.status, "conflict");
  assert.equal(conflictB.receipt.conflictCode, "parent_revision_mismatch");
  assert.equal(conflictB.head.headRevisionId, acceptedA.revision.syncRevisionId);

  const changedReplay = {
    ...deviceBEdit,
    summary: "Different body under the same idempotency key."
  };
  await assert.rejects(
    () => client.submitMutation(changedReplay, "mutation-device-b"),
    (error) => error instanceof sync.MemoryEndpointsDistributedSyncError &&
      error.errorCode === "idempotency_conflict" && error.safeNoOp === true
  );

  const tombstone = await client.submitMutation(mutation({
    logicalMemoryId: "logical-shared",
    parentRevisionId: acceptedA.revision.syncRevisionId,
    summary: "Public-safe deletion tombstone.",
    operation: "delete",
    deviceId: "device-a"
  }), "mutation-delete");
  assert.equal(tombstone.status, "applied");
  assert.equal(tombstone.head.status, "tombstoned");

  const resurrection = await client.submitMutation(mutation({
    logicalMemoryId: "logical-shared",
    parentRevisionId: tombstone.revision.syncRevisionId,
    summary: "Stale resurrection attempt.",
    deviceId: "device-b"
  }), "mutation-resurrection");
  assert.equal(resurrection.status, "conflict");
  assert.equal(resurrection.receipt.conflictCode, "tombstone_resurrection_blocked");

  const revoked = await client.revokeDevice({
    workspaceId: "workspace-fixture",
    agentId: "tinyrustlm-agent",
    deviceId: "device-b"
  }, "device-revoke-b");
  assert.equal(revoked.device.status, "revoked");

  const rejected = await client.submitMutation(mutation({
    logicalMemoryId: "logical-revoked",
    summary: "Queued write from a revoked device.",
    deviceId: "device-b"
  }), "mutation-revoked");
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.receipt.conflictCode, "device_revoked");
  assert.equal(rejected.persisted, true);

  const changes = await client.pullChanges(0, 50);
  assert.ok(changes.items.length >= 5);
  assert.deepEqual(
    changes.items.map((item) => item.serverSequence),
    changes.items.map((item) => item.serverSequence).sort((a, b) => a - b)
  );
  const heads = await client.readHeads("logical-shared");
  assert.equal(heads.items[0].headRevisionId, tombstone.revision.syncRevisionId);
  const retention = await client.getRetentionPolicy();
  assert.equal(retention.policy.tombstoneRetentionDays, 30);
  assert.equal(retention.policy.hardForgetSupported, false);
});

test("pull-before-push recovers a dropped response without a duplicate revision", async (t) => {
  const fixture = createDistributedSyncFixtureServer();
  const baseUrl = await fixture.listen();
  t.after(() => fixture.close());
  const client = createClient(baseUrl, fixture.workspaceKey);
  await client.connect();
  await client.registerDevice(device("device-a"), "device-register-a");

  const root = await client.submitMutation(mutation({
    logicalMemoryId: "logical-reconnect",
    summary: "Root reconnect memory."
  }), "mutation-root");
  const uncertainMutation = mutation({
    logicalMemoryId: "logical-reconnect",
    parentRevisionId: root.revision.syncRevisionId,
    summary: "Accepted before the network response dropped."
  });
  await fetch(`${baseUrl}/__test__/drop-next-mutation-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  await assert.rejects(() => client.submitMutation(uncertainMutation, "mutation-timeout"));

  const callbackOrder = [];
  const pages = [];
  const decisions = [];
  const coordinator = {
    async runAsLeader(workspaceId, task) {
      assert.equal(workspaceId, "workspace-fixture");
      callbackOrder.push("leader");
      return { acquired: true, value: await task() };
    }
  };
  const synchronized = await client.synchronizePending({
    coordinator,
    workspaceId: "workspace-fixture",
    afterServerSequence: 0,
    pageLimit: 1,
    async loadPending() {
      callbackOrder.push("load-pending");
      return [{
        eventId: "event-timeout",
        mutation: uncertainMutation,
        idempotencyKey: "mutation-timeout",
        uncertain: true
      }];
    },
    async applyChangePage(page) {
      callbackOrder.push(`pull-${page.checkpoint.afterSequence}-${page.nextAfterSequence}`);
      pages.push(page);
    },
    async applyDecision(item, outcome) {
      callbackOrder.push("apply-decision");
      decisions.push({ item, outcome });
    }
  });

  assert.equal(synchronized.acquired, true);
  assert.equal(synchronized.value.outcomes[0].recovered, true);
  assert.deepEqual(synchronized.value.eventIds, ["event-timeout"]);
  assert.ok(callbackOrder.indexOf("load-pending") >
    callbackOrder.findIndex((item) => item.startsWith("pull-")));
  assert.equal(callbackOrder.at(-1), "apply-decision");
  assert.ok(pages.flatMap((page) => page.items).some((item) =>
    item.logicalMemoryId === "logical-reconnect"));
  assert.equal(decisions[0].outcome.recovered, true);

  const fixtureState = await (await fetch(`${baseUrl}/__test__/state`)).json();
  assert.equal(fixtureState.revisionCount, 2);
  assert.equal(fixtureState.idempotencyCount, 3);
  assert.equal(fixtureState.rawCredentialStored, false);
});
