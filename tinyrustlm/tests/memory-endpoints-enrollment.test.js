"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const enrollment = require("../app/memory-endpoints-enrollment.js");

const serviceBaseUrl = "https://memoryendpoints.example";
const routes = Object.freeze({
  createCompany: "/api/matm/test/companies/create",
  issueInvitation: "/api/matm/test/enrollment/issue",
  claimInvitation: "/api/matm/test/enrollment/claim",
  reconnect: "/api/matm/test/enrollment/reconnect",
  closeCompany: "/api/matm/test/companies/close",
  deleteCompany: "/api/matm/test/companies/delete"
});

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function liveContract() {
  return {
    data: {
      singleAgentEnrollment: {
        schemaVersion: enrollment.contractSchema,
        status: "live",
        singleUseUrl: true,
        postClaimOnly: true,
        atomicOneWinner: true,
        lostResponseIdempotentRecovery: true,
        agentScopedToken: true,
        workspaceHiddenOnReconnect: true,
        virtualUaiStartupRestore: true,
        shortTermRestore: true,
        longTermRestore: true,
        routes
      }
    }
  };
}

test("discovers only a complete live single-agent enrollment contract", async () => {
  const client = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl,
    fetch: async (url, options) => {
      assert.equal(url, `${serviceBaseUrl}/api/matm/connector-contract`);
      assert.equal(options.method, "GET");
      return jsonResponse(200, liveContract());
    }
  });

  const contract = await client.discover();
  assert.equal(contract.schemaVersion, enrollment.contractSchema);
  assert.equal(contract.routes.claimInvitation, routes.claimInvitation);
  assert.equal(Object.isFrozen(contract.routes), true);
});

test("rejects a missing contract as a typed external prerequisite", async () => {
  const client = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl,
    fetch: async () => jsonResponse(200, { data: {} })
  });

  await assert.rejects(
    () => client.discover(),
    (error) => error instanceof enrollment.MemoryEndpointsEnrollmentError &&
      error.code === "enrollment_contract_missing" &&
      error.externalPrerequisite === true
  );
});

test("claims once, keeps the invitation out of errors, and reconnects by name and token", async () => {
  const invitationUrl = `${serviceBaseUrl}/enroll/${"a".repeat(48)}`;
  const agentToken = `agent_${"b".repeat(48)}`;
  const calls = [];
  let claimCount = 0;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/connector-contract")) {
        return jsonResponse(200, liveContract());
      }
      if (url.endsWith(routes.claimInvitation)) {
        claimCount += 1;
        if (claimCount === 1) {
          return jsonResponse(201, {
            persisted: true,
            urlConsumed: true,
            canonicalAgentName: "TinyRustLM-Ada",
            agentToken,
            claimReceiptId: "claim-1",
            rawCredentialExposed: false,
            rawPayloadExposed: false
          });
        }
        return jsonResponse(410, {
          ok: false,
          safeNoOp: true,
          error: { code: "enrollment_url_consumed" },
          rawCredentialExposed: false,
          rawPayloadExposed: false
        });
      }
      if (url.endsWith(routes.reconnect)) {
        assert.equal(options.headers.Authorization, `Bearer ${agentToken}`);
        return jsonResponse(200, {
          canonicalAgentName: "TinyRustLM-Ada",
          workspaceId: "workspace-a",
          readyForStartup: true,
          shortTermRestored: true,
          longTermRestored: true,
          rawCredentialExposed: false,
          rawPayloadExposed: false
        });
      }
      throw new Error("unexpected request");
    }
  });

  const claim = await client.claim({
    invitationUrl,
    agreedAgentName: "TinyRustLM-Ada",
    idempotencyKey: "claim-first-1"
  });
  assert.equal(claim.canonicalAgentName, "TinyRustLM-Ada");
  assert.equal(claim.agentToken, agentToken);

  await assert.rejects(
    () => client.claim({
      invitationUrl,
      agreedAgentName: "TinyRustLM-Ada",
      idempotencyKey: "claim-replay-2"
    }),
    (error) => error.code === "enrollment_url_consumed" &&
      !error.message.includes(invitationUrl)
  );

  const reconnect = await client.reconnect({
    canonicalAgentName: claim.canonicalAgentName,
    agentToken: claim.agentToken
  });
  assert.deepEqual(reconnect, {
    canonicalAgentName: "TinyRustLM-Ada",
    workspaceId: "workspace-a",
    readyForStartup: true,
    shortTermRestored: true,
    longTermRestored: true
  });
  assert.equal(calls.filter((call) => call.url.endsWith(routes.claimInvitation)).length, 2);
});

test("rejects unsafe advertised routes and redaction failures", async () => {
  const unsafe = liveContract();
  unsafe.data.singleAgentEnrollment.routes = {
    ...routes,
    reconnect: "https://attacker.example/api/matm/reconnect"
  };
  const unsafeClient = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl,
    fetch: async () => jsonResponse(200, unsafe)
  });
  await assert.rejects(() => unsafeClient.discover(), /safe MATM route/i);

  const exposedClient = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl,
    fetch: async (url) => url.endsWith("/connector-contract")
      ? jsonResponse(200, liveContract())
      : jsonResponse(201, {
        persisted: true,
        urlConsumed: true,
        canonicalAgentName: "TinyRustLM-Ada",
        agentToken: `agent_${"c".repeat(48)}`,
        rawCredentialExposed: true,
        rawPayloadExposed: false
      })
  });
  await assert.rejects(
    () => exposedClient.claim({
      invitationUrl: `${serviceBaseUrl}/enroll/${"d".repeat(48)}`,
      agreedAgentName: "TinyRustLM-Ada",
      idempotencyKey: "claim-redaction-1"
    }),
    (error) => error.code === "enrollment_redaction_failed"
  );
});

test("browser UI exposes one-time enrollment and name-token reconnect without persistent secret keys", () => {
  const appRoot = path.join(__dirname, "..", "app");
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");

  for (const id of [
    "memoryEndpointsEnrollmentUrl",
    "memoryEndpointsRequestedAgentName",
    "memoryEndpointsClaimButton",
    "memoryEndpointsCanonicalAgentName",
    "memoryEndpointsAgentToken",
    "memoryEndpointsReconnectButton"
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /memory-endpoints-enrollment\.js/);
  assert.match(app, /claimMemoryEndpointsEnrollment/);
  assert.match(app, /reconnectMemoryEndpointsAgent/);
  assert.match(app, /memoryEndpointsEnrollmentUrl\.value\s*=\s*["']["']/);
  assert.doesNotMatch(app, /uiStorageKeys\.(?:memoryEndpointsAgentToken|memoryEndpointsEnrollmentUrl)/);
  assert.doesNotMatch(app, /storageSet\([^\n]*(?:agentToken|enrollmentUrl)/i);
});

test("keeps local memory optional while naming the TinyRustLM.com Connect plugin lane", () => {
  const appRoot = path.join(__dirname, "..", "app");
  const appHtml = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const publicHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  for (const html of [appHtml, publicHtml]) {
    assert.match(html, /Local copied memory and the local sync queue remain optional/u);
    assert.match(
      html,
      /TinyRustLM\.com Connect memory via MemoryEndpoints\.com \(recommended\)/u
    );
    assert.match(html, /Optional local copied memory that remains available offline/u);
    assert.match(html, /explicit sign-in and provider selection/u);
  }
  assert.match(app, /local copied UAIX Memory Deck remains available as offline memory/u);
  assert.match(app, /local sync queue uploads after you reconnect/u);
  assert.match(app, /TinyRustLM\.com Connect plugin recommends MemoryEndpoints\.com/u);
});
