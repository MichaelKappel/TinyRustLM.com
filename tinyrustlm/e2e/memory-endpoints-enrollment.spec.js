"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const http = require("node:http");
const { chromium, test, expect } = require("@playwright/test");
const admissionAuthority = require("../app/browser-model-admission.js");
const catalogAuthority = require("../app/minimodel-catalog-v1.js");
const runtimeManifest = require(
  "../browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"
);
const acg2Reference = require("../tools/acg2-reference.js");
const {
  createOwnedTemporaryDirectory,
  removeOwnedTemporaryDirectory
} = require("../tools/canonical-operation-scratch.js");
const {
  createMemoryEndpointsEnrollmentFixture
} = require("./helpers/memory-endpoints-enrollment-fixture.js");

const TEST_ONLY_MODEL_ID =
  "test-only/never-live-memory-endpoints-enrollment-composition";
const TEST_ONLY_SCOPE =
  "test-only/never-live/e2e/memory-endpoints-enrollment";
const RESOLVED_MEMBER_LENGTHS = Object.freeze([8704, 7459, 1403, 65800, 512]);

test("pull storage isolates the service, route, workspace and reader", async ({ page, context }) => {
  const origin = test.info().project.use.baseURL;
  await context.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.fulfill({ status: 503, body: "External services unavailable in this test" }));
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto("/", { waitUntil: "load" });
  const observed = await page.evaluate(async () => {
    const sync = window.TinyRustLMMemorySync;
    const store = new sync.MemoryEndpointsOutboxStore({ databaseName: "test-pull-isolation" });
    const base = { serviceOrigin: "https://memory.example", pullUrl: "https://memory.example/api/matm/memory-events",
      workspaceId: "same-workspace", actorAgentId: "reader-a" };
    const authorities = [base,
      { ...base, serviceOrigin: "https://another.example", pullUrl: "https://another.example/api/matm/memory-events" },
      { ...base, pullUrl: "https://memory.example/relay/api/matm/memory-events" },
      { ...base, workspaceId: "another-workspace" }, { ...base, actorAgentId: "reader-b" }];
    try {
      for (let i = 0; i < authorities.length; i += 1) {
        const snapshot = sync.normalizeMemoryEventsPull({ valuesRedacted: true, items: [{ eventId: "shared-event-id",
          bodyHash: String(i + 1).repeat(64), createdAt: new Date(1700000000000 - i * 1000).toISOString(),
          revision: 1, status: "active", memoryType: "handoff", scope: "project", scopeId: "tinyrustlm.com", actorAgentId: "author" }]
        }, { ...authorities[i], pulledAtUnixMs: 1800000000000 + i });
        await store.commitPullSnapshot(snapshot);
      }
      return await Promise.all(authorities.map(async authority => (await store.readPullSnapshot(authority)).heads[0].bodyHash));
    } finally { await store.close(); }
  });
  expect(observed).toEqual([1, 2, 3, 4, 5].map(n => String(n).repeat(64)));
  await saveIsolationCoverage(page);
});

for (const [phase, action] of [["hash", "clear"], ["hash", "newer-search"], ["hash", "filter"], ["hash", "model"],
  ["packing", "clear"], ["packing", "newer-search"]]) {
test(`search ${phase} completion cannot override ${action}`, async ({ page, context }) => {
  const origin = test.info().project.use.baseURL;
  await context.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.fulfill({ status: 503, body: "External services unavailable in this test" }));
  await context.route(`${origin}/api/matm/**`, route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, valuesRedacted: true, items: route.request().url().includes("/search?") ? [{
      memoryId: route.request().url().includes("query=new") ? "new-memory" : "held-memory", revisionId: "held-revision",
      title: route.request().url().includes("query=new") ? "Current new result" : "Delayed old result",
      safeSummary: "Public fixture from the previous search.",
      scope: "project", scopeId: "tinyrustlm.com", memoryType: "handoff", tinyrustlmMemoryTier: "long_term",
      status: "active", reviewed: true, publicSafe: true, createdAtUnixMs: 1700000000000, score: 1
    }] : [] }) }));
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
  await openMemorySettings(page);
  await page.locator("#memoryEndpointsBaseUrl").fill(origin);
  await page.locator(".memory-endpoints-workspace-access > summary").click();
  await page.locator("#memoryEndpointsWorkspaceId").fill("search-workspace");
  await page.locator("#memoryEndpointsAgentId").fill("search-agent");
  await page.locator("#memoryEndpointsToken").fill("test-only-workspace-key");
  await page.locator("#memoryEndpointsConnectButton").click();
  await expect(page.locator("#memoryEndpointsStatus")).toHaveText("web memory connected");
  await page.evaluate(phase => {
    if (phase === "packing") {
      const api = window.TinyRustLMMemorySync;
      window.TinyRustLMMemorySync = { ...api, packMemoryContext: async (...args) => {
        if (args[0][0].memoryId === "held-memory") await new Promise(resolve => { window.releaseSearchHash = resolve; });
        return api.packMemoryContext(...args);
      } };
      return;
    }
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let held = false;
    crypto.subtle.digest = async (algorithm, bytes) => {
      if (!held && new TextDecoder().decode(bytes).includes("Public fixture from the previous search.")) {
        held = true;
        await new Promise(resolve => { window.releaseSearchHash = resolve; });
      }
      return original(algorithm, bytes);
    };
  }, phase);
  await page.locator("#memoryEndpointsSearchButton").click();
  await page.waitForFunction(() => typeof window.releaseSearchHash === "function");
  if (action === "clear") await page.locator("#memoryEndpointsClearButton").click();
  else if (action === "newer-search") {
    await page.locator("#memoryEndpointsSearchQuery").fill("new");
    await page.locator("#memoryEndpointsSearchButton").click();
    await expect(page.locator("#memoryEndpointsSearchResults")).toContainText("Current new result");
  } else if (action === "filter") await page.locator("#memoryEndpointsSearchTier").selectOption("short_term");
  else await page.locator("#modelSelect").dispatchEvent("change");
  const status = await page.locator("#memoryEndpointsStatus").textContent();
  await page.evaluate(() => window.releaseSearchHash());
  await page.waitForTimeout(250);
  await expect(page.locator("#memoryEndpointsStatus")).toHaveText(status);
  await expect(page.locator("#memoryEndpointsSearchResults")).not.toContainText("Delayed old result");
  if (action === "clear") await expect(page.locator("#memoryEndpointsSearchResults")).toBeEmpty();
  if (action === "newer-search") await expect(page.locator("#memoryEndpointsSearchResults")).toContainText("Current new result");
  await saveIsolationCoverage(page);
});
}

test("pull storage retires unbound caches and preserves atomic cancellation", async ({ page, context }) => {
  const origin = test.info().project.use.baseURL;
  await context.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.fulfill({ status: 503, body: "External services unavailable in this test" }));
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto("/", { waitUntil: "load" });
  const result = await page.evaluate(async () => {
    const name = "test-pull-retirement";
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("metadata", { keyPath: "key" }).put({ key: "pull:workspace", checkpoint: "obsolete" });
        db.createObjectStore("remoteHeads", { keyPath: "cacheKey" }).put({ cacheKey: "workspace:event", old: true });
        db.createObjectStore("outbox", { keyPath: "eventId" }).put({ eventId: "retained-outbox" });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    const api = window.TinyRustLMMemorySync;
    const store = new api.MemoryEndpointsOutboxStore({ databaseName: name });
    try {
      const db = await store.open();
      const authority = { serviceOrigin: "https://memory.example", pullUrl: "https://memory.example/pull",
        workspaceId: "workspace", actorAgentId: "reader" };
      const snapshot = api.normalizeMemoryEventsPull({ valuesRedacted: true, items: [] }, { ...authority, pulledAtUnixMs: 1700000000000 });
      const pending = store.commitPullSnapshot(snapshot);
      snapshot.checkpoint.workspaceId = "mutated-after-call";
      await pending;
      const committed = await store.readPullSnapshot(authority);
      const controller = new AbortController();
      const transact = db.transaction.bind(db);
      db.transaction = (...args) => {
        const tx = transact(...args);
        queueMicrotask(() => controller.abort());
        return tx;
      };
      let aborted = false;
      try { await store.commitPullSnapshot({ ...committed, checkpoint: { ...committed.checkpoint, pulledAtUnixMs: 1700000001000 } }, { signal: controller.signal }); }
      catch (error) { aborted = error.name === "AbortError"; }
      finally { db.transaction = transact; }
      const retained = await store.readPullSnapshot(authority);
      const outbox = await new Promise((resolve, reject) => {
        const request = db.transaction("outbox").objectStore("outbox").get("retained-outbox");
        request.onsuccess = () => resolve(request.result.eventId); request.onerror = () => reject(request.error);
      });
      const absent = await store.readPullSnapshot({ ...authority, actorAgentId: "other-reader" });
      let backwards = false;
      try { await store.commitPullSnapshot({ ...committed, checkpoint: { ...committed.checkpoint, pulledAtUnixMs: 1699999999999 } }); }
      catch (error) { backwards = /backwards/.test(error.message); }
      const key = JSON.stringify([authority.serviceOrigin, authority.pullUrl, authority.workspaceId, authority.actorAgentId]);
      await new Promise((resolve, reject) => {
        const tx = db.transaction("pullSnapshots", "readwrite");
        tx.objectStore("pullSnapshots").put({ authorityKey: key, snapshot: { ...committed, checkpoint: { ...committed.checkpoint, readerAgentId: "other-reader" } } });
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
      });
      let corrupt = false;
      try { await store.readPullSnapshot(authority); } catch (error) { corrupt = /authority changed/.test(error.message); }
      return { stores: Array.from(db.objectStoreNames), version: db.version, aborted, backwards, corrupt, outbox,
        workspace: retained.checkpoint.workspaceId, pulledAt: retained.checkpoint.pulledAtUnixMs, absent };
    } finally { await store.close(); }
  });
  expect(result).toEqual({ stores: ["outbox", "pullSnapshots", "quarantine", "receipts"], version: 2,
    aborted: true, backwards: true, corrupt: true, outbox: "retained-outbox", workspace: "workspace",
    pulledAt: 1700000000000, absent: { checkpoint: null, heads: [] } });
  await saveIsolationCoverage(page);
});

/** Retain V8 ranges for changed code without duplicating any application source. */
async function saveIsolationCoverage(page) {
  const coverage = await page.coverage.stopJSCoverage();
  fs.writeFileSync(test.info().outputPath("isolation-coverage.json"), JSON.stringify(coverage
    .filter(entry => /\/(memory-endpoints-sync|app)\.js(?:\?|$)/.test(entry.url))
    .map(entry => ({ url: entry.url, functions: entry.functions }))));
}

test("clearing memory closes a pending response and permits a fresh connection", async ({ page, context }) => {
  const applicationOrigin = test.info().project.use.baseURL;
  let registrations = 0;
  let closed = false;
  const server = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", applicationOrigin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, X-MemoryEndpoints-Key, Content-Type, Idempotency-Key");
    response.setHeader("Content-Type", "application/json");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.url === "/api/matm/agents/register" && ++registrations === 1) {
      response.on("close", () => { closed = true; });
      response.write('{"pending":');
    } else {
      response.end(JSON.stringify({ ok: true, count: 0, items: [], valuesRedacted: true,
        rawCredentialExposed: false, rawPayloadExposed: false }));
    }
  });
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const serviceOrigin = `http://127.0.0.1:${server.address().port}`;
    await context.route("**/*", route => [applicationOrigin, serviceOrigin].includes(new URL(route.request().url()).origin)
      ? route.continue() : route.fulfill({ status: 503, body: "External services unavailable in this test" }));
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
    await openMemorySettings(page);
    await page.locator("#memoryEndpointsBaseUrl").fill(serviceOrigin);
    await page.locator(".memory-endpoints-workspace-access > summary").click();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.locator("#memoryEndpointsWorkspaceId").fill("workspace-http-test");
      await page.locator("#memoryEndpointsAgentId").fill("agent-http-test");
      await page.locator("#memoryEndpointsToken").fill("test-only-workspace-key");
      await page.locator("#memoryEndpointsConnectButton").click();
      if (attempt === 0) {
        await expect.poll(() => registrations).toBe(1);
        await page.locator("#memoryEndpointsClearButton").click();
        await expect.poll(() => closed).toBe(true);
        await expect(page.locator("#memoryEndpointsStatus")).toHaveText("web memory off");
      }
    }
    await expect(page.locator("#memoryEndpointsStatus")).toHaveText("web memory connected");
    expect(registrations).toBe(2);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

for (const failedStage of ["registration", "pull"]) {
test(`workspace connection rejects malformed ${failedStage} JSON instead of confirming success`, async ({ page, context }) => {
  const origin = test.info().project.use.baseURL;
  let pulls = 0;
  await context.route("**/*", route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.fulfill({ status: 503, body: "External services unavailable in this test" }));
  await context.route(`${origin}/api/matm/agents/register`, route => route.fulfill({
    status: 200, contentType: "application/json", body: failedStage === "registration" ? "not-json" : '{"ok":true}'
  }));
  await context.route(`${origin}/api/matm/memory-events?*`, route => {
    pulls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: failedStage === "pull" ? "not-json" : JSON.stringify({
      ok: true, count: 0, items: [], valuesRedacted: true, rawCredentialExposed: false, rawPayloadExposed: false
    }) });
  });
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
  await openMemorySettings(page);
  await page.locator("#memoryEndpointsBaseUrl").fill(origin);
  await page.locator(".memory-endpoints-workspace-access > summary").click();
  await page.locator("#memoryEndpointsWorkspaceId").fill("workspace-http-test");
  await page.locator("#memoryEndpointsAgentId").fill("agent-http-test");
  await page.locator("#memoryEndpointsToken").fill("test-only-workspace-key");
  await page.locator("#memoryEndpointsConnectButton").click();
  await expect(page.locator("#memoryEndpointsStatus")).toContainText("valid JSON");
  expect(pulls).toBe(failedStage === "pull" ? 1 : 0);
});
}

test("outbox sends only its original service, workspace and actor and quarantines unbound rows", async ({ page, context }) => {
  const service = createMemoryEndpointsEnrollmentFixture();
  let company;
  let releaseSubmit;
  try {
    await service.listen();
    company = await service.createCompany("test-only-outbox-destination");
    const invitation = await service.issueInvitation(company.companyId);
    const applicationOrigin = test.info().project.use.baseURL;
    await context.route("**/*", route => {
      const origin = new URL(route.request().url()).origin;
      return origin === applicationOrigin || origin === service.baseUrl ? route.continue()
        : route.fulfill({ status: 503, body: "External services are unavailable in this test" });
    });
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
    const before = await page.evaluate(async ({ serviceOrigin, workspaceId }) => {
      const sync = window.TinyRustLMMemorySync;
      const store = new sync.MemoryEndpointsOutboxStore();
      const database = await store.open();
      const now = Date.now() - 5000;
      const payload = {
        workspaceId, actorAgentId: "test-outbox-agent", kind: sync.MEMORY_RECORD_KIND, version: 1,
        scope: "project", scopeId: "tinyrustlm.com", memoryType: "handoff", subject: "Outbox destination",
        title: "Outbox destination", summary: "Public fixture memory for the original service.",
        source: "TinyRustLM MemoryEndpoints connector", confidence: 0.8,
        uaiReferences: [".uai/long-term-memory.uai"],
        tags: ["tinyrustlm", "memoryendpoints", "long-term", "scope:tinyrustlm.com"],
        tinyrustlmMemoryTier: "long_term", sourceSha256: null
      };
      for (const [eventId, origin, changes] of [
        ["event-matching", serviceOrigin, {}],
        ["event-other-service", "https://another-memory.example", {}],
        ["event-other-route", serviceOrigin, {}],
        ["event-other-workspace", serviceOrigin, { workspaceId: "other-workspace" }],
        ["event-other-actor", serviceOrigin, { actorAgentId: "other-actor" }],
        ["event-unbound", serviceOrigin, {}]
      ]) {
        let entry = await sync.prepareOutboxEntry({ ...payload, ...changes }, {
          serviceOrigin: origin, eventId, deviceId: "test-browser-device", committedAtUnixMs: now,
          submitUrl: `${origin}${eventId === "event-other-route" ? "/another-service" : ""}/api/matm/memory-events/submit`
        });
        if (eventId === "event-unbound") {
          entry.kind = "tinyrustlm.memory_endpoints.outbox_entry.v2"; entry.version = 2;
          entry.localReceipt.kind = "tinyrustlm.memory_endpoints.local_receipt.v2"; entry.localReceipt.version = 2;
          delete entry.serviceOrigin; delete entry.localReceipt.serviceOrigin;
          await new Promise((resolve, reject) => {
            const tx = database.transaction("outbox", "readwrite"); tx.objectStore("outbox").put(entry);
            tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
          });
        } else {
          if (eventId === "event-matching" || eventId === "event-other-service") {
            entry = await sync.beginSend(await sync.markQueued(entry, now + 1), now + 2);
          }
          await store.putPrepared(entry);
        }
      }
      // A read for status must never reset a different tab's in-flight operation.
      const pending = await store.readPending(Date.now());
      const unrelated = await store.get("event-other-service");
      return { pending: pending.pending.length, quarantined: pending.quarantined.length,
        unrelatedState: unrelated.state, attempts: unrelated.retry.attemptCount };
    }, { serviceOrigin: service.baseUrl, workspaceId: company.workspaceId });
    expect(before).toEqual({ pending: 5, quarantined: 1, unrelatedState: "sending", attempts: 1 });
    await openMemorySettings(page);
    await page.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
    await page.locator("#memoryEndpointsEnrollmentUrl").fill(invitation.invitationUrl);
    await page.locator("#memoryEndpointsRequestedAgentName").fill("test-outbox-agent");
    await page.locator("#memoryEndpointsClaimButton").click();
    await expect(page.locator("#memoryEndpointsStatus")).toContainText("agent created");
    expect(service.snapshot().eventCount).toBe(1);
    const after = await page.evaluate(async () => {
      const store = new window.TinyRustLMMemorySync.MemoryEndpointsOutboxStore();
      const current = await store.get("event-matching");
      const unrelated = await store.get("event-other-service");
      const pending = await store.readPending(Date.now());
      const quarantine = await store.listQuarantine();
      return { current: current.state, pending: pending.pending.map(row => row.eventId).sort(),
        unrelatedState: unrelated.state, attempts: unrelated.retry.attemptCount,
        quarantined: quarantine.length, quarantineHasPayload: quarantine.some(row => "payload" in row) };
    });
    expect(after).toEqual({ current: "synchronized", pending: ["event-other-actor", "event-other-route", "event-other-service", "event-other-workspace"],
      unrelatedState: "sending", attempts: 1, quarantined: 1, quarantineHasPayload: false });

    // The existing relative relay remains usable; a late submit response cannot revive its discarded session.
    const agentToken = await page.locator("#memoryEndpointsAgentToken").inputValue();
    let markSubmitted;
    const submitted = new Promise(resolve => { markSubmitted = resolve; });
    await context.route(`${applicationOrigin}/api/memoryendpoints/api/matm/**`, async route => {
      expect(route.request().headers().authorization).toBe(`Bearer ${agentToken}`);
      const url = new URL(route.request().url());
      const remotePath = url.pathname.slice("/api/memoryendpoints".length);
      if (remotePath === "/api/matm/agents/register") {
        await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
        return;
      }
      const response = await route.fetch({ url: `${service.baseUrl}${remotePath}${url.search}`, maxRedirects: 0 });
      if (remotePath === "/api/matm/memory-events/submit") {
        await new Promise(resolve => { releaseSubmit = resolve; markSubmitted(); });
      }
      await route.fulfill({ response });
    });
    await page.locator("#memoryEndpointsBaseUrl").fill("/api/memoryendpoints");
    await page.locator(".memory-endpoints-workspace-access > summary").click();
    await page.locator("#memoryEndpointsWorkspaceId").fill(company.workspaceId);
    await page.locator("#memoryEndpointsAgentId").fill("test-outbox-agent");
    await page.locator("#memoryEndpointsToken").fill(agentToken);
    await page.locator("#memoryEndpointsConnectButton").click();
    await expect(page.locator("#memoryEndpointsStatus")).toHaveText("web memory connected");
    await page.locator("#memoryEndpointsSaveShortTermButton").click();
    await submitted;
    await page.locator("#memoryEndpointsBaseUrl").fill("https://another-memory.example");
    const changedStatus = await page.locator("#memoryEndpointsStatus").textContent();
    releaseSubmit();
    await expect.poll(() => page.evaluate(async () => {
      const store = new window.TinyRustLMMemorySync.MemoryEndpointsOutboxStore();
      const rows = await store.readPending(Date.now());
      return rows.pending.some(row => row.submitUrl.includes("/api/memoryendpoints/") && row.state === "retry_pending");
    })).toBe(true);
    await expect(page.locator("#memoryEndpointsStatus")).toHaveText(changedStatus);
    await expect(page.locator("#memoryEndpointsAgentToken")).toHaveValue("");
    await expect(page.locator("#memoryEndpointsToken")).toHaveValue("");
    const coverage = await page.coverage.stopJSCoverage();
    fs.writeFileSync(test.info().outputPath("outbox-coverage.json"), JSON.stringify(coverage
      .filter(entry => /\/(memory-endpoints-sync|app)\.js(?:\?|$)/.test(entry.url))
      .map(entry => ({ url: entry.url, functions: entry.functions }))));
  } finally {
    if (releaseSubmit) releaseSubmit();
    if (company) { await service.closeCompany(company.companyId); await service.deleteCompany(company.companyId); }
    await service.close();
  }
});

test("enrollment UI recovers a lost claim and a failed restore without a new identity", async ({ page, context }) => {
  const service = createMemoryEndpointsEnrollmentFixture();
  let company;
  const claims = [];
  let restoreCalls = 0;
  try {
    await service.listen();
    company = await service.createCompany("test-only-enrollment-recovery");
    const invitation = await service.issueInvitation(company.companyId);
    const applicationOrigin = test.info().project.use.baseURL;
    await context.route("**/*", route => {
      const origin = new URL(route.request().url()).origin;
      return origin === applicationOrigin || origin === service.baseUrl ? route.continue()
        : route.fulfill({ status: 503, body: "External services are unavailable in this test" });
    });
    await context.route(`${service.baseUrl}/api/matm/test/enrollment/claim`, async route => {
      claims.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData() });
      const response = await route.fetch(); // The fixture has committed before the response is lost.
      if (claims.length === 1) await route.abort("failed");
      else await route.fulfill({ response });
    });
    await context.route(`${service.baseUrl}/api/matm/test/enrollment/reconnect`, async route => {
      restoreCalls += 1;
      if (restoreCalls === 1 || restoreCalls === 3) await route.abort("failed");
      else await route.continue();
    });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
    await openMemorySettings(page);
    await page.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
    await page.locator("#memoryEndpointsEnrollmentUrl").fill(invitation.invitationUrl);
    await page.locator("#memoryEndpointsRequestedAgentName").fill("test-recovery-agent");
    const claim = page.locator("#memoryEndpointsClaimButton");
    await claim.click();
    await expect(page.locator("#memoryEndpointsStatus")).toContainText("request failed");
    await expect(claim).toBeEnabled();
    await expect(page.locator("#memoryEndpointsEnrollmentUrl")).toHaveValue("");
    expect(await browserStorageContains(page, [invitation.invitationUrl, claims[0].key])).toEqual([]);
    await page.locator("#memoryEndpointsRequestedAgentName").fill("another-agent");
    await claim.click();
    await expect(page.locator("#memoryEndpointsStatus")).toContainText("original agent claim");
    expect(claims.length).toBe(1);
    await page.locator("#memoryEndpointsRequestedAgentName").fill("test-recovery-agent");
    await claim.click();
    await expect.poll(() => claims.length).toBe(2);
    await expect.poll(() => restoreCalls).toBe(1);
    await expect(claim).toBeEnabled();
    expect(claims[1]).toEqual(claims[0]);
    const agentToken = await page.locator("#memoryEndpointsAgentToken").inputValue();
    expect(agentToken.length).toBeGreaterThan(24);
    await claim.click();
    await expect(page.locator("#memoryEndpointsStatus")).toContainText("agent created");
    expect(claims.length).toBe(2);
    expect(restoreCalls).toBe(2);
    expect(await browserStorageContains(page, [invitation.invitationUrl, agentToken])).toEqual([]);
    await page.locator("#memoryEndpointsReconnectToken").fill(agentToken);
    await page.locator("#memoryEndpointsReconnectButton").click();
    await expect(page.locator("#memoryEndpointsStatus")).toContainText("request failed");
    await expect(page.locator("#memoryEndpointsReconnectButton")).toBeEnabled();
    await expect(page.locator("#memoryEndpointsReconnectToken")).toHaveValue("");
    await page.locator("#memoryEndpointsReconnectButton").click();
    await expect(page.locator("#memoryEndpointsStatus")).toContainText("agent memory restored");
    expect(restoreCalls).toBe(4);
    expect(claims.length).toBe(2);
  } finally {
    if (company) { await service.closeCompany(company.companyId); await service.deleteCompany(company.companyId); }
    await service.close();
  }
});

for (const cancellation of ["clear", "service", "disabled", "workspace-key"]) {
  test(`enrollment UI ignores late credentials after ${cancellation}`, async ({ page, context }) => {
    const service = createMemoryEndpointsEnrollmentFixture();
    let company;
    let release;
    let intercepted;
    let delivered;
    const claimed = new Promise(resolve => { intercepted = resolve; });
    const delivery = new Promise(resolve => { delivered = resolve; });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await service.listen();
      company = await service.createCompany("test-only-enrollment-cancellation");
      const invitation = await service.issueInvitation(company.companyId);
      const applicationOrigin = test.info().project.use.baseURL;
      await context.route("**/*", route => {
        const origin = new URL(route.request().url()).origin;
        return origin === applicationOrigin || origin === service.baseUrl ? route.continue()
          : route.fulfill({ status: 503, body: "External services are unavailable in this test" });
      });
      await context.route(`${service.baseUrl}/api/matm/test/enrollment/claim`, async route => {
        const response = await route.fetch();
        await new Promise(resolve => { release = resolve; intercepted(); });
        await route.fulfill({ response });
        delivered();
      });
      await page.goto("/", { waitUntil: "load" });
      await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
      await openMemorySettings(page);
      await page.locator("#memoryEndpointsEnabled").check();
      await page.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
      await page.locator("#memoryEndpointsEnrollmentUrl").fill(invitation.invitationUrl);
      await page.locator("#memoryEndpointsRequestedAgentName").fill("test-cancel-agent");
      await page.locator("#memoryEndpointsClaimButton").click();
      await claimed;
      await expect(page.locator("#memoryEndpointsClaimButton")).toBeDisabled();
      await expect(page.locator("#memoryEndpointsReconnectButton")).toBeDisabled();
      if (cancellation === "clear") await page.locator("#memoryEndpointsClearButton").click();
      if (cancellation === "disabled") await page.locator("#memoryEndpointsEnabled").uncheck();
      if (cancellation === "service") {
        await page.locator("#memoryEndpointsBaseUrl").fill("https://memoryendpoints.example");
        await page.locator("#memoryEndpointsBaseUrl").blur();
      }
      if (cancellation === "workspace-key") {
        await page.locator(".memory-endpoints-workspace-access > summary").click();
        await page.locator("#memoryEndpointsToken").fill("test-only-workspace-key");
      }
      const status = await page.locator("#memoryEndpointsStatus").textContent();
      release();
      await delivery;
      await expect(page.locator("#memoryEndpointsClaimButton")).toBeEnabled();
      await expect(page.locator("#memoryEndpointsReconnectButton")).toBeEnabled();
      await expect(page.locator("#memoryEndpointsAgentToken")).toHaveValue("");
      await expect(page.locator("#memoryEndpointsIssuedCredentials")).toBeHidden();
      await expect(page.locator("#memoryEndpointsStatus")).toHaveText(status);
      expect(await browserStorageContains(page, [invitation.invitationUrl])).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      if (release) release();
      if (company) { await service.closeCompany(company.companyId); await service.deleteCompany(company.companyId); }
      await service.close();
    }
  });
}

test("enrollment and memory bound real Fetch streams and close cancelled requests", async ({ page, context }) => {
  const applicationOrigin = test.info().project.use.baseURL;
  const closed = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const server = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", applicationOrigin);
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    const mode = request.url.split("/").pop();
    response.on("close", () => closed.push(mode));
    if (mode === "oversized") response.end(Buffer.alloc(1024 * 1024 + 1, 32));
    else if (mode === "success") response.end('{"ok":true}');
    else response.write('{"waiting":');
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
    });
    const serviceOrigin = `http://127.0.0.1:${server.address().port}`;
    await context.route("**/*", route => {
      const origin = new URL(route.request().url()).origin;
      return origin === applicationOrigin || origin === serviceOrigin ? route.continue()
        : route.fulfill({ status: 503, body: "External services are unavailable in this test" });
    });
    await page.goto("/", { waitUntil: "load" });
    const results = await page.evaluate(async baseUrl => {
      const Client = window.TinyRustLMMemoryEndpointsEnrollment.MemoryEndpointsEnrollmentClient;
      const output = {};
      for (const kind of ["enrollment", "memory"]) {
        output[kind] = {};
      for (const mode of ["deadline", "cancelled", "oversized", "success"]) {
        const controller = new AbortController();
        const timer = mode === "cancelled" ? setTimeout(() => controller.abort(), 75) : null;
        try {
          if (kind === "enrollment") {
            const result = await new Client({ baseUrl, timeoutMilliseconds: 300 })
              .request("GET", `/api/matm/${kind}/${mode}`, { signal: controller.signal });
            output[kind][mode] = result.payload.ok;
          } else {
            const result = await new window.TinyRustLMMemoryEndpointsHttp.MemoryEndpointsHttpClient({
              timeoutMilliseconds: 300, maximumResponseBytes: 1024 * 1024
            }).request(`${baseUrl}/api/matm/${kind}/${mode}`, { signal: controller.signal });
            output[kind][mode] = result.ok;
          }
        } catch (error) { output[kind][mode] = error.code; }
        finally { if (timer !== null) clearTimeout(timer); }
      }
      }
      return output;
    }, serviceOrigin);
    expect(results).toEqual({
      enrollment: { deadline: "enrollment_timeout", cancelled: "enrollment_cancelled", oversized: "response_too_large", success: true },
      memory: { deadline: "memory_timeout", cancelled: "memory_cancelled", oversized: "response_too_large", success: true }
    });
    await expect.poll(() => closed.filter(mode => mode === "deadline").length >= 2 &&
      closed.filter(mode => mode === "cancelled").length >= 2).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

/** Scan a closed owned profile for the supplied test credentials without reporting their values. */
function secretOccurrences(root, secrets) {
  const needles = secrets.flatMap((secret) => [
    { secret, encoding: "utf8", bytes: Buffer.from(secret, "utf8") },
    { secret, encoding: "utf16le", bytes: Buffer.from(secret, "utf16le") }
  ]);
  const matches = [];
  // Visit ordinary files under this profile; report only relative paths and encodings.
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = fs.readFileSync(fullPath);
      for (const needle of needles) {
        if (bytes.indexOf(needle.bytes) !== -1) {
          matches.push({
            relativePath: path.relative(root, fullPath).replaceAll(path.sep, "/"),
            encoding: needle.encoding
          });
        }
      }
    }
  };
  visit(root);
  return matches;
}

/** Hash fixture bytes or canonical text using the same UTF-8 interpretation as the browser. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Domain-separate deterministic identities for the named synthetic fixture input. */
function identity(label) {
  return sha256(Buffer.from(`test-only:${label}`, "utf8"));
}

/** Fill exactly byteLength bytes with a deterministic pattern for this test-only member label. */
function syntheticBytes(label, byteLength) {
  const bytes = Buffer.allocUnsafe(byteLength);
  const seed = Buffer.from(`SYNTHETIC TEST ONLY NEVER LIVE:${label}`, "utf8");
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (seed[index % seed.length] + index * 31 + (index >>> 5)) & 0xff;
  }
  return bytes;
}

/** Build explicitly synthetic member identities for memory UI tests with an injected worker. */
function createConversationCompositionFixture() {
  const memberBuffers = Object.fromEntries(
    admissionAuthority.artifactSpecs.slice(0, 5).map((spec, index) => [
      spec.fileName,
      syntheticBytes(
        `memory-endpoints:${spec.fileName}`,
        RESOLVED_MEMBER_LENGTHS[index]
      )
    ])
  );
  const graphMembers = acg2Reference.MEMBER_PROFILES.map((profile, index) => {
    const bytes = memberBuffers[admissionAuthority.artifactSpecs[index].fileName];
    return {
      ordinal: profile.ordinal,
      role: profile.role,
      format: profile.format,
      artifactBytes: bytes.byteLength,
      artifactSha256: sha256(bytes),
      formatProfileSha256: profile.profileSha256
    };
  });
  const compositionBytes = acg2Reference.writeGraph(graphMembers);
  const graph = acg2Reference.parseGraph(compositionBytes);
  memberBuffers[admissionAuthority.artifactSpecs[5].fileName] = compositionBytes;
  const artifacts = admissionAuthority.artifactSpecs.map((spec) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: memberBuffers[spec.fileName].byteLength,
    sha256: sha256(memberBuffers[spec.fileName]),
    formatProfileSha256: spec.profileSha256
  }));
  const composition = Object.freeze({
    graphIdentitySha256: graph.graphIdentitySha256,
    memberTableSha256: graph.memberTableSha256,
    resolvedMemberBytes: graph.resolvedMemberBytes
  });
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const admissionText = admissionAuthority.serializeAdmission({
    schema: admissionAuthority.schema,
    modelId: TEST_ONLY_MODEL_ID,
    operationId: identity("memory-endpoints-operation"),
    artifacts,
    composition,
    qualification: {
      receiptId: `sha256:${identity("memory-endpoints-receipt")}`,
      sourceEvidenceSha256: identity("memory-endpoints-source"),
      structuralEvidenceSha256: identity("memory-endpoints-structure"),
      numericalEvidenceSha256: identity("memory-endpoints-numerical"),
      qualityEvidenceSha256: identity("memory-endpoints-quality"),
      evalCasesSha256: identity("memory-endpoints-evals"),
      qualityClaim: "task-specific-qualified",
      qualityScope: TEST_ONLY_SCOPE
    },
    runtime: {
      workerProtocol: runtimeManifest.workerProtocol,
      wasmByteCount: runtimeManifest.byteCount,
      wasmSha256: runtimeManifest.sha256,
      policy: {
        maximumModelBytes: artifacts[0].byteCount,
        maximumSequenceTokens: 128,
        maximumKvBytes: 1024 * 1024,
        maximumScratchBytes: 1024 * 1024,
        maximumResolvedMemberBytes: composition.resolvedMemberBytes,
        maximumResidentDependencyBytes: residentDependencyBytes,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: runtimeManifest.maximumMemoryBytes
      },
      defaultSampling: {
        temperatureMillionths: 0,
        topK: 1,
        topPMillionths: 1_000_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 0,
        maximumNewTokens: 8
      }
    }
  });
  const files = artifacts.map((artifact) => ({
    name: artifact.fileName,
    mimeType: "application/octet-stream",
    buffer: memberBuffers[artifact.fileName]
  }));
  files.push({
    name: "test-only.browser-composition-admission.json",
    mimeType: "application/json",
    buffer: Buffer.from(admissionText, "utf8")
  });
  const compositionArtifact = artifacts[5];
  return Object.freeze({
    admissionText,
    files: Object.freeze(files),
    activeComposition: Object.freeze({
      artifactBytes: compositionArtifact.byteCount,
      artifactSha256: compositionArtifact.sha256,
      graphIdentitySha256: composition.graphIdentitySha256,
      memberTableSha256: composition.memberTableSha256
    }),
    modelBytes: artifacts[0].byteCount
  });
}

/** Supply current, hash-bound test authority; never contact the public catalog or seed. */
async function routeConversationCatalog(context, fixture) {
  const admission = admissionAuthority.parseAdmissionText(fixture.admissionText);
  const now = Math.floor(Date.now() / 1000) * 1000;
  const utc = (offset) => new Date(now + offset).toISOString().replace(".000Z", "Z");
  const prefix = "/test-only/memory-enrollment";
  const compositionId = `sha256:${admission.composition.graphIdentitySha256}`;
  const receipt = {
    schema: catalogAuthority.QUALIFICATION_RECEIPT_SCHEMA,
    receiptId: admission.qualification.receiptId,
    modelId: admission.modelId,
    operationId: admission.operationId,
    compositionId,
    sourceEvidenceSha256: admission.qualification.sourceEvidenceSha256,
    structuralEvidenceSha256: admission.qualification.structuralEvidenceSha256,
    numericalEvidenceSha256: admission.qualification.numericalEvidenceSha256,
    qualityEvidenceSha256: admission.qualification.qualityEvidenceSha256,
    evalCasesSha256: admission.qualification.evalCasesSha256,
    qualityClaim: admission.qualification.qualityClaim,
    qualityScope: admission.qualification.qualityScope,
    numericalStatus: "passed",
    browserStatus: "passed",
    qualityStatus: "qualified",
    issuedAtUtc: utc(-120_000)
  };
  const receiptText = `${JSON.stringify(receipt)}\n`;
  const catalog = {
    schema: catalogAuthority.CATALOG_SCHEMA,
    catalog_id: "test-only/memory-enrollment",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(3_600_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogAuthority.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: admissionAuthority.schema,
    peer_verification_keys: [],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [{
      entry_id: "test-only/memory-enrollment",
      display_name: "TEST ONLY memory conversation fixture",
      description: "Synthetic memory UI test; never a qualified model or live evidence.",
      source: {
        repository: admission.modelId,
        revision: identity("memory-source-revision").slice(0, 40),
        source_lock_sha256: `sha256:${identity("memory-source-lock")}`
      },
      license: { route: `${prefix}/license.txt`, review_status: "reviewed" },
      composition: {
        composition_id: compositionId,
        member_count: admission.artifacts.length,
        members: admission.artifacts.map((artifact) => ({
          name: artifact.fileName,
          bytes: artifact.byteCount,
          sha256: `sha256:${artifact.sha256}`,
          schema: `test-only/${artifact.format}`
        }))
      },
      browser_admission: {
        route: `${prefix}/admission.json`,
        bytes: Buffer.byteLength(fixture.admissionText),
        sha256: `sha256:${sha256(fixture.admissionText)}`
      },
      profiles: {
        conversion: "test-only/memory-ui",
        quantization: "test-only/memory-ui",
        runtime: "test-only/memory-ui"
      },
      qualification: {
        status: "qualified",
        receipt_id: receipt.receiptId,
        receipt_route: `${prefix}/receipt.json`,
        receipt_bytes: Buffer.byteLength(receiptText),
        receipt_sha256: `sha256:${sha256(receiptText)}`,
        numerical_status: "passed",
        browser_status: "passed",
        quality_status: "qualified"
      },
      peer_announcement_ids: []
    }]
  };
  catalogAuthority.validateCatalog(catalog);
  const documents = new Map([
    [catalogAuthority.CATALOG_URL, `${JSON.stringify(catalog)}\n`],
    [catalogAuthority.PEER_FEED_URL, `${JSON.stringify({
      schema: catalogAuthority.PEER_SCHEMA,
      feed_id: "test-only/memory-enrollment",
      revision: 1,
      generated_at_utc: catalog.generated_at_utc,
      valid_until_utc: catalog.valid_until_utc,
      project_server_serves_model_bytes: false,
      project_server_proxies_model_bytes: false,
      announcements: []
    })}\n`],
    [`https://minimodel.org${prefix}/admission.json`, fixture.admissionText],
    [`https://minimodel.org${prefix}/receipt.json`, receiptText]
  ]);
  await context.route("https://minimodel.org/**", async (route) => {
    const body = documents.get(route.request().url());
    expect(route.request().method()).toBe("GET");
    expect(body, "Only known local fixture metadata may be requested").toBeDefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body
    });
  });
}

/** Replace only inference for the supplied composition; other browser workers remain native. */
async function installSyntheticRuntimeWorker(context, fixture) {
  await context.addInitScript(({ activeComposition, modelBytes }) => {
    const NativeWorker = window.Worker;
    const protocolSchema = "tinyrustlm.model-runtime-worker/1";
    const eventIdDomain = "tinyrustlm.model-runtime-worker.event/1";

    /** Bind each fixture event to its command, monotonic sequence and event kind. */
    async function eventMessageId(command, sequence, kind) {
      const canonical = [
        eventIdDomain,
        command.workerId,
        command.messageId,
        String(sequence),
        kind
      ].join("\n");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical)
      );
      return Array.from(new Uint8Array(digest))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    }

    class SyntheticRuntimeWorker {
      /** Intercept only the inference worker URL and forward other URLs/options unchanged. */
      constructor(url, options) {
        if (!new URL(url, window.location.href).pathname.endsWith("/model-runtime-worker.js")) {
          return new NativeWorker(url, options);
        }
        this.commands = [];
        this.eventSequence = 0;
        this.generationStep = 0;
        this.maximumLinearMemoryBytes = 64 * 1024 * 1024;
        this.terminated = false;
        this.onmessage = null;
        this.onerror = null;
        this.onmessageerror = null;
      }

      /** Preserve transfer detachment before interpreting the supplied current worker command. */
      postMessage(command, transfer = []) {
        if (this.terminated) throw new Error("worker terminated");
        const cloned = structuredClone(command, { transfer });
        this.commands.push(cloned);
        queueMicrotask(() => {
          this.respond(cloned).catch(() => {
            if (this.onerror) this.onerror({});
          });
        });
      }

      /** Refuse subsequent commands after this fixture worker is terminated. */
      terminate() {
        this.terminated = true;
      }

      /** Return fixture state bound to the command operation and supplied transcript revision. */
      runtimeState(command, state, revisionLow = 0, revisionHigh = 0) {
        const active = state !== "empty";
        return {
          schema: "tinyrustlm.browser_runtime_wasm.state/1",
          state,
          operationId: command.operationId,
          transcriptRevisionLow: revisionLow,
          transcriptRevisionHigh: revisionHigh,
          activeComposition: active ? { ...activeComposition } : null,
          committedKvBytes: active ? 4096 : 0,
          memoryPlan: active
            ? { modelBytes, kvBytes: 4096, scratchBytes: 4096 }
            : null,
          observedLinearMemoryBytes: this.maximumLinearMemoryBytes,
          maximumLinearMemoryBytes: this.maximumLinearMemoryBytes
        };
      }

      /** Map current commands to protocol events; generation completes after one fixture step. */
      eventKind(command) {
        switch (command.kind) {
          case "initialize": return "runtime-ready";
          case "artifact-begin": return "artifact-transfer-begun";
          case "artifact-chunk": return "artifact-chunk-accepted";
          case "artifact-commit": return "artifact-transfer-committed";
          case "activate": return "composition-active";
          case "set-transcript": return "transcript-updated";
          case "begin-generation":
            this.generationStep = 0;
            return "generation-begun";
          case "cancel-generation": return "generation-complete";
          case "release": return "runtime-released";
          case "step-generation": {
            const kind = this.generationStep === 0
              ? "generation-step"
              : "generation-complete";
            this.generationStep += 1;
            return kind;
          }
          default: throw new Error(`unexpected command ${command.kind}`);
        }
      }

      /** Build the exact current event payload for the command and selected event kind. */
      payload(command, kind) {
        const commandMessageId = command.messageId;
        switch (kind) {
          case "runtime-ready":
            return {
              commandMessageId,
              state: this.runtimeState(
                command,
                "empty",
                command.payload.transcriptRevisionLow,
                command.payload.transcriptRevisionHigh
              )
            };
          case "artifact-transfer-begun":
            return {
              commandMessageId,
              artifactKind: command.payload.artifactKind,
              byteLength: command.payload.byteLength
            };
          case "artifact-chunk-accepted":
            return {
              commandMessageId,
              artifactKind: command.payload.artifactKind,
              offset: command.payload.offset,
              byteLength: command.payload.bytes.byteLength,
              nextOffset: command.payload.offset + command.payload.bytes.byteLength
            };
          case "artifact-transfer-committed": {
            const begun = [...this.commands].reverse().find((candidate) =>
              candidate.kind === "artifact-begin" &&
              candidate.payload.artifactKind === command.payload.artifactKind
            );
            return {
              commandMessageId,
              artifactKind: command.payload.artifactKind,
              byteLength: begun.payload.byteLength
            };
          }
          case "composition-active":
            return { commandMessageId, state: this.runtimeState(command, "active-idle") };
          case "transcript-updated":
            return {
              commandMessageId,
              state: this.runtimeState(
                command,
                "active-idle",
                command.payload.revisionLow,
                command.payload.revisionHigh
              )
            };
          case "generation-begun":
            return { commandMessageId, state: this.runtimeState(command, "generating") };
          case "generation-step":
            return {
              commandMessageId,
              step: {
                schema: "tinyrustlm.browser_runtime_wasm.step/1",
                selectedTokenId: 17,
                emittedTokenId: 17,
                status: { kind: "active", stopTokenId: null },
                committedKvBytes: 8192
              }
            };
          case "generation-complete": {
            const cancelled = command.kind === "cancel-generation";
            return {
              commandMessageId,
              output: {
                schema: "tinyrustlm.browser_runtime_wasm.output/1",
                text: cancelled ? "test-only partial response" : "test-only local response",
                tokenIds: cancelled ? [17] : [17, 17],
                status: {
                  kind: cancelled ? "cancelled" : "stop-token",
                  stopTokenId: cancelled ? null : 2
                },
                composition: { ...activeComposition },
                operationId: command.operationId,
                committedKvBytes: 12288
              }
            };
          }
          case "runtime-released": return { commandMessageId };
          default: throw new Error(`unexpected event ${kind}`);
        }
      }

      /** Acknowledge transferred bytes and emit an identity-bound response to this command. */
      async respond(command) {
        if (command.kind === "initialize") {
          this.maximumLinearMemoryBytes = command.payload.maximumLinearMemoryBytes;
        }
        if (command.kind === "artifact-chunk") {
          new Uint8Array(command.payload.bytes).fill(0);
        }
        const kind = this.eventKind(command);
        const sequence = this.eventSequence;
        this.eventSequence += 1;
        const event = {
          schema: protocolSchema,
          workerId: command.workerId,
          operationId: command.operationId,
          compositionId: command.compositionId,
          conversationId: command.conversationId,
          turnId: command.turnId,
          generationId: command.generationId,
          messageId: await eventMessageId(command, sequence, kind),
          sequence,
          kind,
          payload: this.payload(command, kind)
        };
        if (this.onmessage) this.onmessage({ data: event });
      }
    }

    window.Worker = SyntheticRuntimeWorker;
  }, {
    activeComposition: fixture.activeComposition,
    modelBytes: fixture.modelBytes
  });
}

/** Reveal existing Advanced memory controls on the selected browser page. */
async function openMemorySettings(page) {
  if (await page.locator("#simpleOpenAdvancedDiscoveryButton").isVisible()) {
    await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
  } else if (await page.locator("#mobileAdvancedButton").isVisible()) {
    await page.locator("#mobileAdvancedButton").click();
  } else {
    await page.locator("#sidebarAdvancedToolsButton").click();
  }
  const drawer = page.locator('details[data-panel-key="dashboard-model-source"]');
  if (!(await drawer.evaluate((element) => element.open))) {
    await drawer.locator("summary").click();
  }
  await page.locator("#memoryEndpointsEnrollmentUrl").scrollIntoViewIfNeeded();
  await expect(page.locator("#memoryEndpointsEnrollmentUrl")).toBeVisible();
}

/** Import the supplied test-only composition through the current Advanced controls. */
async function loadConversationFixture(page, fixture) {
  const chooser = page.locator("#modelEditButton");
  if (await chooser.getAttribute("aria-expanded") !== "true") await chooser.click();
  await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
  const input = page.locator("#localModelFile");
  await input.setInputFiles(fixture.files);
  await expect.poll(() => input.evaluate((element) => Array.from(element.files, (file) =>
    file.name
  ))).toEqual([
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2",
    "test-only.browser-composition-admission.json"
  ]);
  await page.locator("#importLocalModelButton").click();
  try {
    await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 30000 });
  } catch (error) {
    error.message += `\nImport diagnostic: ${await page.locator("#errorState").textContent()}`;
    throw error;
  }
  await expect(page.locator("#wasmState")).toHaveText("verified");
  await expect(page.locator("#generateButton")).toBeEnabled();
}

/** Submit a local fixture turn and require the expected completed conversation message count. */
async function sendTurn(page, prompt, expectedMessageCount) {
  await page.locator("#prompt").fill(prompt);
  await page.locator("#prompt").press("Enter");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-generation-state", "idle", {
    timeout: 90000
  });
  await expect(page.locator("#conversation .message")).toHaveCount(expectedMessageCount, {
    timeout: 90000
  });
}

/** Inspect browser key/value stores for the supplied test credentials without returning stored data. */
async function browserStorageContains(page, values) {
  return page.evaluate(async (protectedValues) => {
    const serialized = [
      JSON.stringify(Object.fromEntries(Object.entries(localStorage))),
      JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))
    ];
    if (indexedDB.databases) {
      for (const database of await indexedDB.databases()) {
        if (!database.name) continue;
        const contents = await new Promise((resolve) => {
          const request = indexedDB.open(database.name, database.version);
          request.onerror = () => resolve([]);
          request.onsuccess = () => {
            const db = request.result;
            const names = Array.from(db.objectStoreNames);
            if (!names.length) {
              db.close();
              resolve([]);
              return;
            }
            const transaction = db.transaction(names, "readonly");
            const rows = [];
            let remaining = names.length;
            for (const name of names) {
              const getAll = transaction.objectStore(name).getAll();
              getAll.onsuccess = () => {
                rows.push(getAll.result);
                remaining -= 1;
                if (remaining === 0) {
                  db.close();
                  resolve(rows);
                }
              };
              getAll.onerror = () => {
                remaining -= 1;
                if (remaining === 0) {
                  db.close();
                  resolve(rows);
                }
              };
            }
          };
        });
        serialized.push(JSON.stringify(contents));
      }
    }
    const haystack = serialized.join("\n");
    return protectedValues.filter((value) => haystack.includes(value));
  }, values);
}

test.describe("one-time MemoryEndpoints agent continuity", () => {
  test("deletes one browser profile, restores both memory tiers, rejects URL replay, and deletes its company", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Persistent-profile continuity runs once on desktop");
    test.slow();

    const applicationOrigin = String(testInfo.project.use.baseURL);
    const service = createMemoryEndpointsEnrollmentFixture();
    // Keep Windows browser storage paths short, independently of reporter/test title length.
    const profileParent = path.resolve(__dirname, "../../artifacts/tests/browser-memory-profiles");
    const browserOptions = {
      channel: testInfo.project.use.channel,
      headless: true,
      colorScheme: "dark",
      locale: "en-US",
      viewport: { width: 1365, height: 768 }
    };
    const compositionFixture = createConversationCompositionFixture();
    let firstOwned = null;
    let secondOwned = null;
    let company = null;
    let firstContext = null;
    let secondContext = null;
    let cleanupReceipts = null;

    try {
      await service.listen();
      company = await service.createCompany(`TinyRustLM dogfood ${crypto.randomUUID()}`);
      const invitation = await service.issueInvitation(company.companyId);
      const oneTimeUrl = invitation.invitationUrl;
      const shortMarker = `short-memory-${crypto.randomUUID()}`;
      const longMarker = `long-memory-${crypto.randomUUID()}`;

      firstOwned = createOwnedTemporaryDirectory({ temporaryParent: profileParent });
      const firstProfile = firstOwned.rootPath;
      firstContext = await chromium.launchPersistentContext(firstProfile, browserOptions);
      await routeConversationCatalog(firstContext, compositionFixture);
      await installSyntheticRuntimeWorker(firstContext, compositionFixture);
      const firstPage = await firstContext.newPage();
      await firstPage.goto(applicationOrigin, { waitUntil: "domcontentloaded" });
      await expect(firstPage.locator("#runtimeStatus")).toHaveText("Choose a qualified composition");
      await expect(firstPage.locator("#wasmState")).toHaveText("waiting");
      await loadConversationFixture(firstPage, compositionFixture);
      await openMemorySettings(firstPage);
      await firstPage.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
      await firstPage.locator("#memoryEndpointsEnrollmentUrl").fill(oneTimeUrl);
      await firstPage.locator("#memoryEndpointsRequestedAgentName").fill("tinyrustlm-dogfood-agent");
      await firstPage.locator("#memoryEndpointsClaimButton").click();
      await expect(firstPage.locator("#memoryEndpointsEnrollmentUrl")).toHaveValue("");
      await expect(firstPage.locator("#memoryEndpointsStatus")).toContainText("agent created", {
        timeout: 30000
      });
      const canonicalAgentName = await firstPage.locator("#memoryEndpointsCanonicalAgentName").inputValue();
      const agentToken = await firstPage.locator("#memoryEndpointsAgentToken").inputValue();
      expect(canonicalAgentName).toBe("tinyrustlm-dogfood-agent");
      expect(agentToken.length).toBeGreaterThan(24);
      expect(service.snapshot().eventCount).toBe(0);

      await sendTurn(firstPage, `Remember this short-term marker exactly: ${shortMarker}`, 2);
      expect(service.snapshot().eventCount, "A conversation turn does not authorize a memory upload").toBe(0);
      await openMemorySettings(firstPage);
      await firstPage.locator("#memoryEndpointsSaveShortTermButton").click();
      await expect(firstPage.locator("#memoryEndpointsStatus")).toContainText("short-term web memory synchronized", {
        timeout: 30000
      });
      expect(service.snapshot().eventCount).toBe(1);

      await sendTurn(firstPage, `Remember this durable long-term marker exactly: ${longMarker}`, 4);
      expect(service.snapshot().eventCount, "Saving one turn does not authorize automatic later uploads").toBe(1);
      await openMemorySettings(firstPage);
      await firstPage.locator("#memoryEndpointsSaveLongTermButton").click();
      await expect(firstPage.locator("#memoryEndpointsStatus")).toContainText("long-term web memory synchronized", {
        timeout: 30000
      });
      expect(await browserStorageContains(firstPage, [oneTimeUrl, agentToken])).toEqual([]);

      await firstContext.close();
      firstContext = null;
      expect(secretOccurrences(firstProfile, [oneTimeUrl, agentToken])).toEqual([]);
      removeOwnedTemporaryDirectory(firstOwned);
      firstOwned = null;
      expect(fs.existsSync(firstProfile)).toBe(false);

      secondOwned = createOwnedTemporaryDirectory({ temporaryParent: profileParent });
      const secondProfile = secondOwned.rootPath;
      secondContext = await chromium.launchPersistentContext(secondProfile, browserOptions);
      await routeConversationCatalog(secondContext, compositionFixture);
      const secondPage = await secondContext.newPage();
      await secondPage.goto(applicationOrigin, { waitUntil: "domcontentloaded" });
      await expect(secondPage.locator("#runtimeStatus")).toHaveText("Choose a qualified composition");
      await expect(secondPage.locator("#wasmState")).toHaveText("waiting");
      await openMemorySettings(secondPage);
      await secondPage.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
      await secondPage.locator("#memoryEndpointsReconnectName").fill(canonicalAgentName);
      await secondPage.locator("#memoryEndpointsReconnectToken").fill(agentToken);
      await secondPage.locator("#memoryEndpointsReconnectButton").click();
      await expect(secondPage.locator("#memoryEndpointsReconnectToken")).toHaveValue("");
      await expect(secondPage.locator("#memoryEndpointsStatus")).toContainText("agent memory restored", {
        timeout: 30000
      });

      await secondPage.locator("#memoryEndpointsSearchQuery").fill("memory");
      await secondPage.locator("#memoryEndpointsSearchButton").click();
      await expect(secondPage.locator("#memoryEndpointsStatus")).toContainText("2 hosted memory results loaded", {
        timeout: 30000
      });
      await expect(secondPage.locator("#memoryEndpointsSearchResults")).toContainText(shortMarker);
      await expect(secondPage.locator("#memoryEndpointsSearchResults")).toContainText(longMarker);

      await secondPage.locator("#memoryEndpointsEnrollmentUrl").fill(oneTimeUrl);
      await secondPage.locator("#memoryEndpointsRequestedAgentName").fill(canonicalAgentName);
      await secondPage.locator("#memoryEndpointsClaimButton").click();
      await expect(secondPage.locator("#memoryEndpointsEnrollmentUrl")).toHaveValue("");
      await expect(secondPage.locator("#memoryEndpointsStatus")).toContainText("already been used or expired", {
        timeout: 30000
      });
      await expect(secondPage.locator("#memoryEndpointsStatus")).not.toContainText(oneTimeUrl);
      expect(await browserStorageContains(secondPage, [oneTimeUrl, agentToken])).toEqual([]);

      const beforeCleanup = service.snapshot();
      expect(beforeCleanup.companyCount).toBe(1);
      expect(beforeCleanup.agentCount).toBe(1);
      expect(beforeCleanup.eventCount).toBe(2);
      expect(beforeCleanup.rawCredentialStoredInAudit).toBe(false);

      await secondContext.close();
      secondContext = null;
      expect(secretOccurrences(secondProfile, [oneTimeUrl, agentToken])).toEqual([]);
      removeOwnedTemporaryDirectory(secondOwned);
      secondOwned = null;
      expect(fs.existsSync(secondProfile)).toBe(false);
    } finally {
      if (firstContext) await firstContext.close().catch(() => {});
      if (secondContext) await secondContext.close().catch(() => {});
      if (company) {
        const closed = await service.closeCompany(company.companyId).catch(() => null);
        const deleted = closed
          ? await service.deleteCompany(company.companyId).catch(() => null)
          : null;
        cleanupReceipts = { closed, deleted };
      }
      const finalSnapshot = service.snapshot();
      await service.close().catch(() => {});
      if (firstOwned) removeOwnedTemporaryDirectory(firstOwned);
      if (secondOwned) removeOwnedTemporaryDirectory(secondOwned);
      if (company) {
        expect(cleanupReceipts && cleanupReceipts.closed && cleanupReceipts.closed.status).toBe("closed");
        expect(cleanupReceipts && cleanupReceipts.deleted && cleanupReceipts.deleted.deleted).toBe(true);
        expect(finalSnapshot.companyCount).toBe(0);
        expect(finalSnapshot.agentCount).toBe(0);
        expect(finalSnapshot.eventCount).toBe(0);
      }
    }
  });
});
