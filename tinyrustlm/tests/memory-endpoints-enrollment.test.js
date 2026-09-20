"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const enrollment = require("../app/memory-endpoints-enrollment.js");

const serviceBaseUrl = "https://memoryendpoints.example";

/** Exercise recovery independently of HTTP framing and the browser DOM. */
function recoveryFixture(overrides = {}) {
  const claims = [];
  const restores = [];
  let keys = 0;
  const credentials = { canonicalAgentName: "agent-one", agentToken: "test-only-agent-token-0123456789" };
  const client = { baseUrl: serviceBaseUrl,
    async claim(input) { claims.push(input); return credentials; },
    async reconnect(input) { restores.push(input); return { canonicalAgentName: input.canonicalAgentName, workspaceId: "workspace-one" }; },
    ...overrides };
  const flow = new enrollment.MemoryEndpointsEnrollmentFlow({ client,
    createIdempotencyKey: () => `test-claim-${++keys}` });
  return { flow, claims, restores, credentials };
}

const recoveryInput = Object.freeze({ invitationUrl: `${serviceBaseUrl}/enroll?token=test-only-invitation`, agreedAgentName: "agent-one" });

test("enrollment flow validates dependencies and claim input before requesting a key or network", async () => {
  for (const options of [{}, { client: {} }, { client: { claim() {}, reconnect() {} } }]) {
    assert.throws(() => new enrollment.MemoryEndpointsEnrollmentFlow(options), { code: "invalid_enrollment_flow" });
  }
  const { flow, claims } = recoveryFixture();
  await assert.rejects(flow.claim({ ...recoveryInput, agreedAgentName: "wrong name" }), { code: "invalid_identity" });
  await assert.rejects(flow.claim({ ...recoveryInput, invitationUrl: "https://elsewhere.example/invitation" }), { code: "invalid_invitation_url" });
  assert.equal(claims.length, 0);
  await flow.claim(recoveryInput);
  assert.equal(claims[0].idempotencyKey, "test-claim-1");
});

test("enrollment flow rejects changed pending claim bodies and does not create another key", async () => {
  const calls = [];
  const fixture = recoveryFixture({ async claim(input) { calls.push(input); throw new Error("lost"); } });
  await assert.rejects(fixture.flow.claim(recoveryInput), /lost/);
  for (const changes of [{ agreedAgentName: "other" }, { invitationUrl: `${serviceBaseUrl}/enroll?token=different-test-invitation` }]) {
    await assert.rejects(fixture.flow.claim({ ...recoveryInput, ...changes }), { code: "pending_claim_mismatch" });
  }
  await assert.rejects(fixture.flow.claim(recoveryInput), /lost/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
  fixture.flow.cancel();
  await assert.rejects(fixture.flow.claim(recoveryInput), /lost/);
  assert.notEqual(calls[2].idempotencyKey, calls[0].idempotencyKey);
});

test("enrollment flow retains only the same reconnect identity after a failed restore", async () => {
  let count = 0;
  const fixture = recoveryFixture({ async reconnect(input) {
    fixture.restores.push(input);
    if (++count === 1) throw new Error("lost restore");
    return { canonicalAgentName: input.canonicalAgentName, workspaceId: "workspace-one" };
  } });
  for (const agentToken of ["", "short", "a".repeat(4097), "a".repeat(24) + " space"]) {
    await assert.rejects(fixture.flow.reconnect({ canonicalAgentName: "agent-one", agentToken }), { code: "invalid_agent_token" });
  }
  await assert.rejects(fixture.flow.reconnect(fixture.credentials), /lost restore/);
  await assert.rejects(fixture.flow.claim(recoveryInput), { code: "pending_claim_mismatch" });
  await assert.rejects(fixture.flow.reconnect({ canonicalAgentName: "other" }), { code: "invalid_agent_token" });
  await fixture.flow.reconnect({ canonicalAgentName: "agent-one" });
  assert.equal(fixture.restores[1].agentToken, fixture.credentials.agentToken);
  assert.equal(fixture.claims.length, 0);
  await assert.rejects(fixture.flow.reconnect({ canonicalAgentName: "agent-one" }), { code: "invalid_agent_token" });
});

test("enrollment flow prevents concurrent actions and an old finally cannot release a newer action", async () => {
  const finishes = [];
  const fixture = recoveryFixture({ claim: () => new Promise(resolve => finishes.push(resolve)) });
  const first = fixture.flow.claim(recoveryInput);
  assert.equal(fixture.flow.busy, true);
  await assert.rejects(fixture.flow.claim(recoveryInput), { code: "enrollment_busy" });
  await assert.rejects(fixture.flow.reconnect(fixture.credentials), { code: "enrollment_busy" });
  fixture.flow.cancel();
  const second = fixture.flow.claim(recoveryInput);
  finishes[0](fixture.credentials);
  await assert.rejects(first, { code: "enrollment_cancelled" });
  assert.equal(fixture.flow.busy, true);
  finishes[1](fixture.credentials);
  await second;
  assert.equal(fixture.flow.busy, false);
});

test("enrollment flow never activates a cancelled restore or surfaces a stale failure", async () => {
  for (const fail of [false, true]) {
    let finish;
    let ready = false;
    const fixture = recoveryFixture({ reconnect: () => new Promise((resolve, reject) => {
      finish = () => fail ? reject(new Error("stale failure")) : resolve({ workspaceId: "old" });
    }) });
    const pending = fixture.flow.reconnect({ ...fixture.credentials, onReady: () => { ready = true; } });
    fixture.flow.cancel();
    finish();
    await assert.rejects(pending, { code: "enrollment_cancelled" });
    assert.equal(ready, false);
  }
});

test("enrollment flow holds busy through activation and propagates its cancellation signal", async () => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let finish;
  let signal;
  const fixture = recoveryFixture();
  const pending = fixture.flow.claim({ ...recoveryInput,
    onCredentials: value => assert.equal(value, fixture.credentials),
    onReady: (_session, value) => { signal = value; entered(); return new Promise(resolve => { finish = resolve; }); } });
  await started;
  assert.equal(fixture.flow.busy, true);
  fixture.flow.cancel();
  assert.equal(signal.aborted, true);
  finish();
  await assert.rejects(pending, { code: "enrollment_cancelled" });
  await assert.rejects(fixture.flow.claim({ agreedAgentName: "agent-one" }), { code: "invalid_invitation_url" });
});

test("enrollment flow retries a lost response with the original claim identity", async () => {
  const calls = [];
  const fixture = recoveryFixture({ async claim(input) {
    calls.push(input);
    if (calls.length === 1) throw new Error("lost response");
    return fixture.credentials;
  } });
  await assert.rejects(fixture.flow.claim(recoveryInput), /lost response/);
  await fixture.flow.claim({ agreedAgentName: recoveryInput.agreedAgentName });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
  assert.equal(calls[1].invitationUrl, recoveryInput.invitationUrl);
  assert.equal(fixture.restores.length, 1);
});

test("enrollment flow retains issued credentials after restore failure without claiming again", async () => {
  let restores = 0;
  const fixture = recoveryFixture({ async reconnect() {
    if (++restores === 1) throw new Error("restore failed");
    return { workspaceId: "workspace-one" };
  } });
  await assert.rejects(fixture.flow.claim(recoveryInput), /restore failed/);
  let ready;
  await fixture.flow.claim({ agreedAgentName: recoveryInput.agreedAgentName,
    onReady: session => { ready = session; } });
  assert.equal(fixture.claims.length, 1);
  assert.equal(restores, 2);
  assert.equal(ready.agentToken, fixture.credentials.agentToken);
});

test("enrollment flow cancels stale completion and releases its pending secret state", async () => {
  let finish;
  let ready = false;
  const fixture = recoveryFixture({ claim: () => new Promise(resolve => { finish = resolve; }) });
  const pending = fixture.flow.claim({ ...recoveryInput, onReady: () => { ready = true; } });
  fixture.flow.cancel();
  finish(fixture.credentials);
  await assert.rejects(pending, { code: "enrollment_cancelled" });
  assert.equal(ready, false);
  assert.equal(fixture.restores.length, 0);
  assert.equal(fixture.flow.busy, false);
  await assert.rejects(fixture.flow.claim({ agreedAgentName: recoveryInput.agreedAgentName }), { code: "invalid_invitation_url" });
});
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

test("bounded enrollment stops oversized streams before whole-body buffering", async () => {
  let reads = 0;
  let cancelled = false;
  let released = false;
  let wholeBodyRead = false;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl,
    fetch: async () => ({ status: 200, headers: new Headers(), body: { getReader: () => ({
      read: async () => { reads += 1; return { value: new Uint8Array(enrollment.maximumResponseBytes + 1), done: false }; },
      cancel: async () => { cancelled = true; }, releaseLock: () => { released = true; }
    }) }, arrayBuffer: async () => { wholeBodyRead = true; return new ArrayBuffer(enrollment.maximumResponseBytes + 1); } })
  });
  await assert.rejects(client.discover(), { code: "response_too_large" });
  assert.equal(reads, 1);
  assert.equal(cancelled, true);
  assert.equal(released, true);
  assert.equal(wholeBodyRead, false);
});

test("bounded enrollment ends a stalled fetch and disposes its late response", async () => {
  let signal;
  let cancelled = false;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl, timeoutMilliseconds: 10,
    fetch: (_url, options) => { signal = options.signal; return new Promise(resolve => setTimeout(() => {
      const response = jsonResponse(200, liveContract());
      const cancel = response.body.cancel.bind(response.body);
      response.body.cancel = reason => { cancelled = true; return cancel(reason); };
      resolve(response);
    }, 60)); }
  });
  await assert.rejects(client.discover(), { code: "enrollment_timeout" });
  assert.equal(signal.aborted, true);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(cancelled, true);
});

test("bounded enrollment uses one deadline across discovery and claim", async () => {
  let calls = 0;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({
    baseUrl: serviceBaseUrl, timeoutMilliseconds: 35,
    fetch: async () => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 25));
      return calls === 1 ? jsonResponse(200, liveContract()) : jsonResponse(201, {
        persisted: true, urlConsumed: true, canonicalAgentName: "fixture-agent", agentToken: "fixture_" + "a".repeat(32)
      });
    }
  });
  await assert.rejects(client.claim({ invitationUrl: serviceBaseUrl + "/enroll/" + "a".repeat(48),
    agreedAgentName: "fixture-agent", idempotencyKey: "test-one-deadline" }), { code: "enrollment_timeout" });
  assert.equal(calls, 2);
});

test("bounded enrollment honours a pre-aborted caller without starting a request", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
    fetch: async () => { calls += 1; return jsonResponse(200, liveContract()); } });
  for (const run of [
    () => client.discover({ signal: controller.signal }),
    () => client.request("GET", "/api/matm/test", { signal: controller.signal }),
    () => client.claim({ signal: controller.signal }),
    () => client.reconnect({ signal: controller.signal })
  ]) await assert.rejects(run(), { code: "enrollment_cancelled" });
  assert.equal(calls, 0);
});

/** Feed controlled reader outcomes without permitting a whole-response fallback. */
function streamedClient(read, options = {}) {
  const observed = { cancelled: 0, released: 0 };
  const client = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
    timeoutMilliseconds: options.timeoutMilliseconds,
    fetch: async () => ({ status: options.status || 200, headers: new Headers(options.headers),
      body: { getReader: () => ({ read,
        cancel: () => { observed.cancelled += 1; return options.cancel ? options.cancel() : Promise.resolve(); },
        releaseLock: () => { observed.released += 1; }
      }) } }) });
  return { client, observed };
}

for (const [name, bytes] of [["empty", new Uint8Array()], ["invalid UTF-8", new Uint8Array([255])],
  ["invalid JSON", new TextEncoder().encode("{")], ["nonobject JSON", new TextEncoder().encode("[]")]]) {
  test(`bounded enrollment rejects ${name} without disclosing response text`, async () => {
    let done = false;
    const { client, observed } = streamedClient(async () => {
      if (done) return { done: true }; done = true; return { value: bytes, done: false };
    });
    await assert.rejects(client.request("GET", "/api/matm/test"), { code: "invalid_response" });
    assert.equal(observed.released, 1);
  });
}

test("bounded enrollment handles fragmented Unicode and accepts exactly the byte limit", async () => {
  const json = JSON.stringify({ text: "é😀" });
  const exact = new TextEncoder().encode(json + " ".repeat(enrollment.maximumResponseBytes - Buffer.byteLength(json)));
  let offset = 0;
  const { client } = streamedClient(async () => offset === exact.length ? { done: true }
    : { done: false, value: exact.subarray(offset, offset = Math.min(offset + 1024, exact.length)) });
  assert.deepEqual((await client.request("GET", "/api/matm/test")).payload, { text: "é😀" });
});

for (const declared of ["-1", "bad", "9007199254740992", String(enrollment.maximumResponseBytes + 1)]) {
  test(`bounded enrollment rejects invalid or oversized declared length ${declared}`, async () => {
    let cancelled = false;
    const client = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
      fetch: async () => ({ status: 200, headers: new Headers({ "Content-Length": declared }),
        body: { cancel: () => { cancelled = true; return Promise.resolve(); }, getReader: () => assert.fail("body must not be read") } }) });
    await assert.rejects(client.request("GET", "/api/matm/test"),
      { code: declared === String(enrollment.maximumResponseBytes + 1) ? "response_too_large" : "invalid_response" });
    assert.equal(cancelled, true);
  });
}

test("bounded enrollment limits empty chunks and ignores a never-ending cancel promise", async () => {
  let reads = 0;
  const { client, observed } = streamedClient(async () => {
    reads += 1; return { done: false, value: new Uint8Array() };
  }, { cancel: () => new Promise(() => {}) });
  await assert.rejects(client.request("GET", "/api/matm/test"), { code: "response_too_large" });
  assert.equal(reads, enrollment.maximumResponseChunks + 1);
  assert.deepEqual(observed, { cancelled: 1, released: 1 });
});

test("bounded enrollment cancels a stalled body and sanitizes reader failures", async () => {
  const stalled = streamedClient(() => new Promise(() => {}), { timeoutMilliseconds: 10 });
  await assert.rejects(stalled.client.request("GET", "/api/matm/test"), { code: "enrollment_timeout" });
  // The rejected read continuation releases ownership after the outer deadline settles.
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(stalled.observed, { cancelled: 1, released: 1 });
  const failed = streamedClient(async () => { throw new Error("private response detail"); });
  await assert.rejects(failed.client.request("GET", "/api/matm/test"), error =>
    error.code === "enrollment_network_error" && !error.message.includes("private response detail"));
  assert.deepEqual(failed.observed, { cancelled: 1, released: 1 });
});

test("bounded enrollment rejects missing streams and nonbyte chunks", async () => {
  const missing = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
    fetch: async () => ({ status: 200, headers: new Headers(), arrayBuffer: () => assert.fail("unbounded fallback") }) });
  await assert.rejects(missing.request("GET", "/api/matm/test"), { code: "invalid_response" });
  const invalid = streamedClient(async () => ({ done: false, value: "not bytes" }));
  await assert.rejects(invalid.client.request("GET", "/api/matm/test"), { code: "invalid_response" });
  assert.deepEqual(invalid.observed, { cancelled: 1, released: 1 });
});

test("bounded enrollment validates budgets and signals before any fetch", async () => {
  for (const timeoutMilliseconds of [null, 0, -1, 1.5, "30", NaN, Infinity, 120001]) {
    assert.throws(() => new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl, timeoutMilliseconds }),
      { code: "invalid_timeout" });
  }
  let requests = 0;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
    fetch: async () => { requests += 1; return jsonResponse(200, liveContract()); } });
  assert.equal(client.timeoutMilliseconds, 30000);
  for (const signal of [null, true, {}, { aborted: false }]) {
    await assert.rejects(client.discover({ signal }), { code: "invalid_signal" });
  }
  assert.equal(requests, 0);
});

test("bounded enrollment isolates concurrent discovery cancellation and retains only success", async () => {
  const controller = new AbortController();
  let completeFirst;
  let requests = 0;
  const client = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
    fetch: () => ++requests === 1 ? new Promise(resolve => { completeFirst = resolve; })
      : Promise.resolve(jsonResponse(200, liveContract())) });
  const first = client.discover({ signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  const second = client.discover();
  controller.abort();
  await assert.rejects(first, { code: "enrollment_cancelled" });
  assert.equal((await second).schemaVersion, enrollment.contractSchema);
  completeFirst(jsonResponse(200, liveContract()));
  assert.equal((await client.discover()).schemaVersion, enrollment.contractSchema);
  assert.equal(requests, 2);
});

test("bounded enrollment never retries a cancelled claim and allows explicit recovery with the same key", async () => {
  const controller = new AbortController();
  const bodies = [];
  let claimStarted;
  const started = new Promise(resolve => { claimStarted = resolve; });
  const client = new enrollment.MemoryEndpointsEnrollmentClient({ baseUrl: serviceBaseUrl,
    fetch: async (url, options) => {
      if (url.endsWith("/connector-contract")) return jsonResponse(200, liveContract());
      bodies.push({ body: options.body, key: options.headers["Idempotency-Key"] });
      claimStarted();
      if (bodies.length === 1) return new Promise(() => {});
      return jsonResponse(200, { persisted: true, urlConsumed: true, canonicalAgentName: "fixture-agent",
        agentToken: "fixture_" + "a".repeat(32), claimReceiptId: "fixture-recovered" });
    } });
  const input = { invitationUrl: serviceBaseUrl + "/enroll/" + "b".repeat(48),
    agreedAgentName: "fixture-agent", idempotencyKey: "test-explicit-recovery" };
  const first = client.claim({ ...input, signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(first, { code: "enrollment_cancelled" });
  assert.equal(bodies.length, 1);
  const recovered = await client.claim(input);
  assert.equal(recovered.claimReceiptId, "fixture-recovered");
  assert.deepEqual(bodies[0], bodies[1]);
});

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
