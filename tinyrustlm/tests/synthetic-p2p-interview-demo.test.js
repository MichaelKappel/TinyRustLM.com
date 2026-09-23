"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const demo = require("../tools/synthetic-p2p-interview-demo.js");
const operationScratch = require("../tools/canonical-operation-scratch.js");

test("default demo evidence stays under canonical project artifacts", () => {
  assert.equal(demo.DEFAULT_TEMP_ROOT,
    path.resolve(__dirname, "../../artifacts/synthetic-p2p-demo"));
  assert.equal(operationScratch.requireCanonicalArtifactPath(demo.DEFAULT_TEMP_ROOT),
    demo.DEFAULT_TEMP_ROOT);
});

test("both demo modes reject noncanonical scratch parents before creating output", async () => {
  for (const tempRoot of ["relative-demo-output", path.resolve(__dirname, ".."),
    path.resolve(__dirname, "../../..")]) {
    for (const run of [demo.runSyntheticP2pDemo, demo.runInteractiveSyntheticP2pDemo]) {
      await assert.rejects(run({ tempRoot, headless: true }),
        /absolute child of canonical project artifacts/u);
    }
  }
});

test("both demo modes reject unsupported browser channels before creating output", async () => {
  for (const browserChannel of ["chrome", "", null]) {
    for (const run of [demo.runSyntheticP2pDemo, demo.runInteractiveSyntheticP2pDemo]) {
      await assert.rejects(run({ browserChannel, headless: true }),
        /browser channel must be absent or msedge/u);
    }
  }
});

test("fixture rejection requires the exact observed cause and candidate identity", () => {
  const identity = { operationId: "a".repeat(64), compositionId: "b".repeat(64) };
  const observed = {
    pickerErrorVisible: true,
    friendlyErrorVisible: true,
    modelState: "P2P install stopped",
    runtimeStatus: "Composition rejected",
    errorState: "Failure (p2p-composition-install-store)",
    runtimeErrors: { overflowed: false, errors: ["model-catalog-delisted",
      "model-composition-store-lock", "Failure (p2p-composition-install-store)"],
      workerRejections: [{ code: "acg2-header", ...identity }] }
  };
  assert.equal(demo.isExpectedFixtureRejection(observed, "simple-model-picker", identity), true);
  for (const change of [
    { code: "model-composition-store-lock" },
    { code: "browser-runtime-wasm-identity" },
    { operationId: "c".repeat(64) },
    { compositionId: "c".repeat(64) }
  ]) {
    const changed = structuredClone(observed);
    Object.assign(changed.runtimeErrors.workerRejections[0], change);
    assert.equal(demo.isExpectedFixtureRejection(changed, "simple-model-picker", identity), false);
  }
  for (const runtimeErrors of [null, { overflowed: true, workerRejections: [] },
    { overflowed: false, workerRejections: [] }]) {
    assert.equal(demo.isExpectedFixtureRejection({ ...observed, runtimeErrors },
      "simple-model-picker", identity), false);
  }
  const extraWorkerError = structuredClone(observed);
  extraWorkerError.runtimeErrors.workerRejections.push({ code: "browser-runtime-wasm-identity", ...identity });
  assert.equal(demo.isExpectedFixtureRejection(extraWorkerError, "simple-model-picker", identity), false);
  const extraDiagnostic = structuredClone(observed);
  extraDiagnostic.runtimeErrors.errors.splice(1, 0, "browser-runtime-wasm-identity");
  assert.equal(demo.isExpectedFixtureRejection(extraDiagnostic, "simple-model-picker", identity), false);
  const cached = { ...observed, modelState: "browser cache unavailable",
    runtimeStatus: "Choose a qualified composition", errorState: "model-catalog-delisted",
    runtimeErrors: { overflowed: false, errors: ["model-catalog-delisted"], workerRejections: [] } };
  assert.equal(demo.isExpectedFixtureRejection(cached, "browser-cache"), true);
  for (const errorState of ["model-composition-store-storage", "model-composition-store-lock", "none"]) {
    assert.equal(demo.isExpectedFixtureRejection({ ...cached, errorState }, "browser-cache"), false);
  }
  assert.equal(demo.isExpectedFixtureRejection({ ...cached,
    runtimeErrors: observed.runtimeErrors }, "browser-cache"), false);
});

test("both demo modes clean scratch and restore environment after a notice-write failure", async context => {
  const originalWrite = fs.writeFileSync;
  context.mock.method(fs, "writeFileSync", function (...args) {
    if (path.basename(String(args[0])) === demo.NOTICE_FILE) throw new Error("injected-notice-write");
    return originalWrite.apply(fs, args);
  });
  const previousEnvironment = Object.fromEntries(["TEMP", "TMP", "TMPDIR"].map(
    name => [name, process.env[name]]
  ));
  for (const [run, reportName] of [
    [demo.runSyntheticP2pDemo, "failure.json"],
    [demo.runInteractiveSyntheticP2pDemo, "interactive-failure.json"]
  ]) {
    const owned = operationScratch.createOwnedTemporaryDirectory({ temporaryParent: demo.DEFAULT_TEMP_ROOT });
    try {
      await assert.rejects(run({ tempRoot: owned.rootPath, headless: true }), /injected-notice-write/u);
      for (const name of ["TEMP", "TMP", "TMPDIR"]) {
        assert.equal(process.env[name], previousEnvironment[name]);
      }
      const directories = fs.readdirSync(owned.rootPath, { withFileTypes: true }).filter(
        entry => entry.isDirectory()
      );
      assert.equal(directories.length, 1);
      const runRoot = path.join(owned.rootPath, directories[0].name);
      assertOwnedScratchRetired({ ownedRunRoot: runRoot, outputDirectory: path.join(runRoot, "artifacts") });
      const failure = JSON.parse(fs.readFileSync(path.join(runRoot, "artifacts", reportName), "utf8"));
      assert.equal(failure.status, "failed");
      assert.equal(failure.error, "injected-notice-write");
      assert.equal(failure.resources.ownedRunResidueCleaned, true);
      assert.equal(failure.resources.temporaryEnvironmentRestored, true);
      assert.equal(failure.resources.browserContextsClosed, 0);
      assert.deepEqual(failure.browserTarget, { channel: "playwright-chromium", headless: true });
    } finally {
      operationScratch.removeOwnedTemporaryDirectory(owned);
    }
  }
});

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const instance = http.request(target, {
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: options.timeout || 2_000
    }, (response) => {
      const chunks = [];
      let byteLength = 0;
      response.on("data", (chunk) => {
        byteLength += chunk.byteLength;
        if (byteLength > 2 * 1024 * 1024) {
          response.destroy(new Error("Test response exceeded its bound"));
          return;
        }
        chunks.push(chunk);
      });
      response.once("end", () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    instance.once("timeout", () => instance.destroy(new Error("Request timed out")));
    instance.once("error", reject);
    instance.end();
  });
}

async function assertClosed(origin) {
  await assert.rejects(
    request(origin, { timeout: 500 }),
    (error) => ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(error.code)
  );
}

// Retained report bytes are the only entries left after the demo removes its marked scratch.
function assertOwnedScratchRetired(result) {
  assert.deepEqual(fs.readdirSync(result.ownedRunRoot), ["artifacts"]);
  assert.equal(fs.lstatSync(result.ownedRunRoot + ".owner.v2").isFile(), true);
  assert.equal(result.outputDirectory, path.join(result.ownedRunRoot, "artifacts"));
}

function pngDimensions(bytes) {
  assert.equal(bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ), true);
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR");
  return Object.freeze({
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  });
}

// Build the smallest host audit that proves one direct-P2P context stayed idle.
function createUnitCompanionSeedAudit(state = "idle", code = "none") {
  const audit = demo.createCompanionSeedAudit();
  demo.recordCompanionSeedObservation(audit, {
    contextLabel: "unit-direct-p2p",
    documentId: "unit-document",
    sequence: 1,
    source: "unit",
    state,
    code
  });
  return audit;
}

// Assert the public-safe seed audit says direct P2P never invoked companion seeding.
function assertIdleDirectP2pCompanionSeed(status, expectedContextLabels) {
  assert.equal(status.elementId, "companionSeedStatus");
  assert.equal(status.requiredState, "idle");
  assert.equal(status.requiredCode, "none");
  assert.equal(status.observationCount > 0, true);
  assert.equal(status.nonIdleObservationCount, 0);
  assert.deepEqual(status.observedStates, ["idle"]);
  assert.deepEqual(status.observedCodes, ["none"]);
  assert.deepEqual(status.observedContextLabels, expectedContextLabels);
  assert.equal(status.remainedIdleThroughoutDirectP2P, true);
}

test("synthetic fixture and peer retain the hostile-safe direct-P2P boundary", async () => {
  assert.equal(demo.DEMO_LABEL, "SYNTHETIC FIXTURE DEMO - NOT LIVE MODEL EVIDENCE");
  assert.equal(
    demo.SYNTHETIC_MECHANICS_VERDICT,
    "synthetic-fixture-mechanics-pass"
  );
  assert.notEqual(demo.SYNTHETIC_MECHANICS_VERDICT, "pass");
  assert.deepEqual(demo.parseArguments([]), { headed: false });
  assert.deepEqual(demo.parseArguments(["--headed"]), { headed: true });
  assert.deepEqual(demo.parseArguments(["--interactive"]), {
    headed: true,
    interactive: true
  });
  assert.throws(() => demo.parseArguments(["--port", "8080"]),
    /npm --prefix \.\\tinyrustlm run demo:p2p:synthetic/u);
  assert.throws(() => demo.parseArguments(["--headed", "extra"]));
  assert.throws(() => demo.parseArguments(["--interactive", "--headed"]));

  const fixture = demo.createSyntheticFixture("boundary", [257, 193, 161, 65800, 512, 896], 0);
  const runtimeManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"), "utf8"));
  const fixtureAdmission = JSON.parse(fixture.admissionText);
  assert.equal(fixtureAdmission.runtime.wasmByteCount, runtimeManifest.byteCount);
  assert.equal(fixtureAdmission.runtime.wasmSha256, runtimeManifest.sha256);
  assert.equal(fixtureAdmission.runtime.workerProtocol, runtimeManifest.workerProtocol);
  assert.equal(fixtureAdmission.runtime.policy.maximumLinearMemoryBytes,
    runtimeManifest.maximumMemoryBytes);
  assert.notEqual(fixture.memberBuffers["composition.acg2"].subarray(0, 4).toString("ascii"),
    "ACG2");
  assert.equal(fixture.classification, demo.TEST_ONLY_CLASSIFICATION);
  assert.equal(fixture.testOnly, true);
  assert.equal(fixture.eligibleAsLiveModel, false);
  assert.equal(fixture.manifest.schema,
    "tinyrustlm.model-composition-store.manifest/2");
  assert.deepEqual(Object.keys(fixture.manifest.admissionAuthority), [
    "admission",
    "qualificationReceipt",
    "catalog",
    "p2pPieceSetSha256"
  ]);
  assert.equal(fixture.manifest.members.length, 6);
  assert.deepEqual(fixture.manifest.members.map((member) => member.fileName), demo.MEMBER_NAMES);
  assert.equal(fixture.memberBuffers["model.slm2"].equals(
    demo.syntheticBytes("boundary:model.slm2", 257)
  ), true);
  const documents = demo.createDocuments(fixture, 48123);
  for (const announcement of documents.announcements) {
    const peerBaseUrl = new URL(announcement.peer_base_url);
    assert.equal(peerBaseUrl.href, `${peerBaseUrl.origin}/`);
    assert.equal(peerBaseUrl.pathname, "/");
    assert.equal(peerBaseUrl.search, "");
    assert.equal(peerBaseUrl.hash, "");
  }

  const applicationOrigin = "http://127.0.0.1:49151";
  const peer = await demo.startSyntheticPeerServer([fixture], applicationOrigin);
  try {
    assert.equal(new URL(peer.origin).hostname, "127.0.0.1");
    const routePath = demo.memberRoute(fixture, "model.slm2");
    const accepted = await request(new URL(routePath, peer.origin), {
      headers: { Origin: applicationOrigin }
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.body.equals(fixture.memberBuffers["model.slm2"]), true);
    assert.equal(accepted.headers["access-control-allow-origin"], applicationOrigin);
    assert.equal(accepted.headers["x-tinyrustlm-composition-id"], fixture.compositionId);
    assert.equal(accepted.headers["x-tinyrustlm-member-name"], "model.slm2");

    const wrongOrigin = await request(new URL(routePath, peer.origin), {
      headers: { Origin: "http://127.0.0.1:49152" }
    });
    assert.equal(wrongOrigin.statusCode, 403);
    assert.equal(wrongOrigin.body.byteLength, 0);

    const arbitraryPath = await request(new URL("/model.slm2", peer.origin), {
      headers: { Origin: applicationOrigin }
    });
    assert.equal(arbitraryPath.statusCode, 403);
    assert.equal(arbitraryPath.body.byteLength, 0);

    const arbitraryQuery = await request(new URL(`${routePath}?source=elsewhere`, peer.origin), {
      headers: { Origin: applicationOrigin }
    });
    assert.equal(arbitraryQuery.statusCode, 403);
    assert.equal(arbitraryQuery.body.byteLength, 0);

    const wrongHost = await request(new URL(routePath, peer.origin), {
      headers: {
        Host: `localhost:${peer.port}`,
        Origin: applicationOrigin
      }
    });
    assert.equal(wrongHost.statusCode, 403);
    assert.equal(wrongHost.body.byteLength, 0);

    const wrongMethod = await request(new URL(routePath, peer.origin), {
      method: "POST",
      headers: { Origin: applicationOrigin }
    });
    assert.equal(wrongMethod.statusCode, 403);
    assert.equal(wrongMethod.body.byteLength, 0);
  } finally {
    await peer.close();
  }
  await assertClosed(peer.origin);
});

test("synthetic safety verdict rejects blocked requests, browser errors, and seed use", () => {
  const observations = { pageErrors: [], consoleErrors: [] };
  const expectedContexts = ["unit-direct-p2p"];
  const clean = demo.verifySyntheticSafety(
    [],
    observations,
    createUnitCompanionSeedAudit(),
    expectedContexts,
    "Unit synthetic session"
  );
  assert.deepEqual(clean.traffic, {
    blockedRequestCount: 0,
    blockedExternalRequestCount: 0,
    blockedUnownedLoopbackRequestCount: 0,
    blockedExternalOrigins: [],
    blockedUnownedLoopbackOrigins: []
  });
  assert.deepEqual(clean.browser, {
    pageErrorCount: 0,
    consoleErrorCount: 0,
    errorFree: true
  });
  assertIdleDirectP2pCompanionSeed(clean.companionSeedStatus, expectedContexts);

  assert.throws(() => demo.verifySyntheticSafety(
    [{
      action: "blocked-unowned-loopback",
      method: "GET",
      url: "http://127.0.0.1:65534/not-owned"
    }],
    observations,
    createUnitCompanionSeedAudit(),
    expectedContexts,
    "Unit synthetic session"
  ), /unowned loopback origin/u);
  assert.throws(() => demo.verifySyntheticSafety(
    [{
      action: "blocked-external",
      method: "GET",
      url: "https://example.invalid/not-owned"
    }],
    observations,
    createUnitCompanionSeedAudit(),
    expectedContexts,
    "Unit synthetic session"
  ), /external origin/u);
  assert.throws(() => demo.verifySyntheticSafety(
    [],
    { pageErrors: ["synthetic page failure"], consoleErrors: [] },
    createUnitCompanionSeedAudit(),
    expectedContexts,
    "Unit synthetic session"
  ), /browser page error/u);
  assert.throws(() => demo.verifySyntheticSafety(
    [],
    { pageErrors: [], consoleErrors: ["synthetic console failure"] },
    createUnitCompanionSeedAudit(),
    expectedContexts,
    "Unit synthetic session"
  ), /browser console error/u);
  assert.throws(() => demo.verifySyntheticSafety(
    [],
    observations,
    createUnitCompanionSeedAudit("seeding", "peer-probe"),
    expectedContexts,
    "Unit synthetic session"
  ), /away from idle\/none/u);
});

test("interactive chooser stays synthetic and cleans up after explicit shutdown", {
  timeout: 60_000
}, async () => {
  const ownedTestRoot = operationScratch.createOwnedTemporaryDirectory({
    temporaryParent: demo.DEFAULT_TEMP_ROOT
  });
  const testRoot = ownedTestRoot.rootPath;
  const controller = new AbortController();
  let readyState = null;
  const emergencyShutdown = setTimeout(() => controller.abort(), 30_000);
  try {
    const result = await demo.runInteractiveSyntheticP2pDemo({
      headless: true,
      browserChannel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
      tempRoot: testRoot,
      signal: controller.signal,
      // Delay shutdown briefly to prove the ready callback precedes session completion.
      onReady(value) {
        readyState = value;
        setTimeout(() => controller.abort(), 100);
      }
    });
    assert.equal(readyState.label, demo.DEMO_LABEL);
    assert.equal(readyState.bannerVisible, true);
    assert.match(readyState.bannerText, new RegExp(demo.DEMO_LABEL, "u"));
    assert.equal(readyState.chooserVisible, true);
    assert.equal(readyState.cardCount, 2);
    assert.equal(readyState.cardsSynthetic, true);
    assert.equal(readyState.fixtureTrafficOnly, true);
    assert.equal(readyState.automatedEvidence, false);
    assert.equal(new URL(readyState.applicationOrigin).hostname, "127.0.0.1");
    const peerBaseUrl = new URL(readyState.peerBaseUrl);
    assert.equal(peerBaseUrl.href, `${peerBaseUrl.origin}/`);
    assert.equal(peerBaseUrl.pathname, "/");
    assert.equal(peerBaseUrl.search, "");
    assert.equal(peerBaseUrl.hash, "");

    assert.equal(result.report.schema, demo.INTERACTIVE_DEMO_SCHEMA);
    assert.deepEqual(result.report.browserTarget, {
      channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || "playwright-chromium",
      headless: true
    });
    assert.equal(result.report.verdict, demo.SYNTHETIC_MECHANICS_VERDICT);
    assert.notEqual(result.report.verdict, "pass");
    assert.equal(result.report.mode, "interactive-operator-held");
    assert.equal(result.report.classification, demo.TEST_ONLY_CLASSIFICATION);
    assert.equal(result.report.testOnly, true);
    assert.equal(result.report.automatedEvidence, false);
    assert.equal(result.report.eligibleAsLiveModel, false);
    assert.equal(Object.values(result.report.claims).every((claim) => claim === false), true);
    assert.deepEqual(result.report.browser, {
      pageErrorCount: 0,
      consoleErrorCount: 0,
      errorFree: true
    });
    assertIdleDirectP2pCompanionSeed(
      result.report.companionSeedStatus,
      ["interactive-direct-p2p"]
    );
    assert.equal(result.report.operatorShutdown, "operator-signal");
    assert.equal(result.report.traffic.policy,
      "owned-loopback-or-intercepted-fixture-only");
    assert.equal(result.report.traffic.loopbackOnly, true);
    assert.equal(result.report.traffic.projectSiteMemberBytesRelayed, 0);
    assert.equal(result.report.traffic.blockedRequestCount, 0);
    assert.equal(result.report.traffic.blockedExternalRequestCount, 0);
    assert.equal(result.report.traffic.blockedUnownedLoopbackRequestCount, 0);
    assert.deepEqual(result.report.traffic.blockedExternalOrigins, []);
    assert.deepEqual(result.report.traffic.blockedUnownedLoopbackOrigins, []);
    assert.equal(result.report.traffic.invalidPeerRequestCount, 0);
    assert.deepEqual(result.report.traffic.peerMemberRequests, []);
    assert.equal(result.report.resources.browserContextsClosed, 1);
    assert.equal(result.report.resources.applicationServerClosed, true);
    assert.equal(result.report.resources.peerServerClosed, true);
    assert.equal(result.report.resources.ownedProfileDeleted, true);
    assert.equal(result.report.resources.ownedRunResidueCleaned, true);
    assert.equal(result.report.resources.temporaryEnvironmentRestored, true);
    assert.equal(fs.existsSync(result.profileRootPath), false);
    assertOwnedScratchRetired(result);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(result.reportPath, "utf8")),
      result.report
    );
    await assertClosed(result.report.ready.applicationOrigin);
    await assertClosed(new URL(result.report.ready.peerBaseUrl).origin);
  } finally {
    clearTimeout(emergencyShutdown);
    operationScratch.removeOwnedTemporaryDirectory(ownedTestRoot);
  }
});

test("deterministic walkthrough labels artifacts and closes every owned resource", {
  timeout: 180_000
}, async () => {
  const ownedTestRoot = operationScratch.createOwnedTemporaryDirectory({
    temporaryParent: demo.DEFAULT_TEMP_ROOT
  });
  const testRoot = ownedTestRoot.rootPath;
  try {
    const result = await demo.runSyntheticP2pDemo({
      headless: true,
      browserChannel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
      tempRoot: testRoot,
      stepDelayMilliseconds: 0
    });
    assert.equal(fs.existsSync(result.profileRootPath), false);
    assertOwnedScratchRetired(result);
    assert.equal(result.report.schema, demo.DEMO_SCHEMA);
    assert.deepEqual(result.report.browserTarget, {
      channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || "playwright-chromium",
      headless: true
    });
    assert.equal(result.report.verdict, demo.SYNTHETIC_MECHANICS_VERDICT);
    assert.notEqual(result.report.verdict, "pass");
    assert.equal(result.report.label, demo.DEMO_LABEL);
    assert.equal(result.report.classification, demo.TEST_ONLY_CLASSIFICATION);
    assert.equal(result.report.testOnly, true);
    assert.equal(result.report.eligibleAsLiveModel, false);
    assert.deepEqual(result.report.claims, {
      liveModel: false,
      liveModelInstallation: false,
      liveModelActivation: false,
      qualificationEvidence: false,
      inference: false,
      deployment: false,
      externalPeerReachability: false,
      catalogPublication: false,
      campaignProgress: false
    });
    assert.equal(Object.values(result.report.claims).every((claim) => claim === false), true);
    assert.deepEqual(result.report.browser, {
      pageErrorCount: 0,
      consoleErrorCount: 0,
      errorFree: true
    });
    assertIdleDirectP2pCompanionSeed(
      result.report.companionSeedStatus,
      ["cancelled-candidate-direct-p2p", "rejected-candidate-direct-p2p"]
    );
    assert.equal(result.report.transport.loopbackOnly, true);
    assert.equal(result.report.transport.projectSiteMemberBytesRelayed, 0);
    assert.equal(result.report.transport.blockedRequestCount, 0);
    assert.equal(result.report.transport.blockedExternalRequestCount, 0);
    assert.equal(result.report.transport.blockedUnownedLoopbackRequestCount, 0);
    assert.equal(result.report.transport.huggingFaceRequestCount, 0);
    assert.deepEqual(result.report.transport.blockedExternalOrigins, []);
    assert.deepEqual(result.report.transport.blockedUnownedLoopbackOrigins, []);
    assert.equal(new URL(result.report.transport.applicationOrigin).hostname, "127.0.0.1");
    assert.equal(new URL(result.report.transport.peerOrigin).hostname, "127.0.0.1");
    const peerBaseUrl = new URL(result.report.transport.peerBaseUrl);
    assert.equal(peerBaseUrl.href, `${peerBaseUrl.origin}/`);
    assert.equal(peerBaseUrl.pathname, "/");
    assert.equal(peerBaseUrl.search, "");
    assert.equal(peerBaseUrl.hash, "");
    assert.equal(result.report.transport.rejectedCandidateMemberRequests, 6);
    assert.equal(result.report.transport.cancelledCandidateMemberRequests, 1);
    assert.equal(result.report.ownership.tempRoot, testRoot);
    assert.equal(result.report.ownership.runRoot, result.ownedRunRoot);
    assert.equal(result.report.ownership.outputDirectory, result.outputDirectory);
    assert.equal(result.report.ownership.artifactsContained, true);
    assert.equal(result.report.walkthrough.runtimeBoundary.fixtureExecutable, false);
    assert.equal(result.report.walkthrough.runtimeBoundary.inferenceAttempted, false);
    const initialPriorRejection = result.report.walkthrough.runtimeBoundary.initialPriorCacheRevalidation;
    assert.equal(initialPriorRejection.phase, "initial prior cache revalidation");
    assert.equal(initialPriorRejection.rejectionCode, "model-catalog-delisted");
    assert.equal(initialPriorRejection.runtimeActivationAttempted, false);
    const rejectedCandidateRuntime =
      result.report.walkthrough.runtimeBoundary.rejectedCandidateActivation;
    assert.equal(rejectedCandidateRuntime.phase, "rejected candidate activation");
    assert.equal(rejectedCandidateRuntime.attempted, true);
    assert.equal(rejectedCandidateRuntime.runtimeActivationAttempted, true);
    assert.equal(rejectedCandidateRuntime.outcome, "rejected");
    assert.equal(rejectedCandidateRuntime.fixtureExecutable, false);
    assert.equal(rejectedCandidateRuntime.rejectionCode, "acg2-header");
    assert.equal(rejectedCandidateRuntime.rejectionEvidence, "identity-bound-worker-command-rejected");
    assert.equal(rejectedCandidateRuntime.failureSurface, "simple-model-picker");
    assert.equal(
      rejectedCandidateRuntime.failureStatus,
      "P2P install stopped: The local runtime could not finish that action. " +
        "Advanced Mode has the raw technical detail."
    );
    assert.equal(
      rejectedCandidateRuntime.runtimeStatus,
      "Composition rejected"
    );
    assert.equal(rejectedCandidateRuntime.modelState, "P2P install stopped");
    assert.equal(rejectedCandidateRuntime.pickerErrorVisible, true);
    assert.equal(rejectedCandidateRuntime.friendlyErrorVisible, true);
    assert.equal(rejectedCandidateRuntime.inferenceAttempted, false);
    assert.match(rejectedCandidateRuntime.errorSha256, /^[0-9a-f]{64}$/u);
    assert.equal(rejectedCandidateRuntime.errorByteLength > 0, true);
    assert.equal(Object.hasOwn(rejectedCandidateRuntime, "errorState"), false);
    const preservedPriorRevalidation =
      result.report.walkthrough.runtimeBoundary.preservedPriorCacheRevalidation;
    assert.equal(preservedPriorRevalidation.phase,
      "preserved prior cache revalidation");
    assert.equal(preservedPriorRevalidation.attempted, true);
    assert.equal(preservedPriorRevalidation.runtimeActivationAttempted, false);
    assert.equal(preservedPriorRevalidation.outcome, "rejected");
    assert.equal(preservedPriorRevalidation.fixtureExecutable, false);
    assert.equal(preservedPriorRevalidation.rejectionCode, "model-catalog-delisted");
    assert.equal(preservedPriorRevalidation.failureSurface, "browser-cache");
    assert.equal(preservedPriorRevalidation.failureStatus,
      "browser cache unavailable");
    assert.equal(preservedPriorRevalidation.runtimeStatus,
      "Choose a qualified composition");
    assert.equal(preservedPriorRevalidation.modelState,
      "browser cache unavailable");
    assert.equal(preservedPriorRevalidation.pickerErrorVisible, true);
    assert.equal(preservedPriorRevalidation.friendlyErrorVisible, true);
    assert.equal(preservedPriorRevalidation.inferenceAttempted, false);
    assert.match(preservedPriorRevalidation.errorSha256, /^[0-9a-f]{64}$/u);
    assert.equal(preservedPriorRevalidation.errorByteLength > 0, true);
    assert.equal(Object.hasOwn(preservedPriorRevalidation, "errorState"), false);
    assert.deepEqual(result.report.walkthrough.compactChooser, {
      syntheticCards: 2,
      directPeerAction: "Get from P2P",
      pointerActivation: "playwright-click",
      keyboardActivation: "enter",
      defaultSelectionPreselected: true,
      defaultSelectionQualifiedP2p: true,
      defaultSelectionFocused: true,
      advancedCollapsed: true,
      advancedInert: true,
      huggingFaceSearchEmpty: true,
      huggingFaceResultsEmpty: true,
      huggingFaceRequestCount: 0,
      syntheticBannerExact: true
    });
    assert.deepEqual(
      result.report.walkthrough.rejectedCandidateTransfer.memberNames,
      demo.MEMBER_NAMES
    );
    assert.match(
      result.report.walkthrough.rejectedCandidateTransfer.progressText,
      /^Peer transport rejected-candidate: [1-9][0-9]* \/ [1-9][0-9]* bytes \([1-9][0-9]?%\)$/u
    );
    assert.equal(result.report.walkthrough.preservedPriorCache.stagingEntries.length, 0);
    assert.equal(result.report.walkthrough.preservedPriorCache.installedEntries.length, 1);
    const expectedRejectedCandidateSource = demo.createSyntheticFixture(
      "rejected-candidate",
      demo.REJECTED_CANDIDATE_LENGTHS,
      0
    );
    const expectedPreservedPriorFixture = demo.createSyntheticFixture(
      "preserved-prior",
      demo.PRESERVED_PRIOR_LENGTHS,
      0
    );
    const expectedCancelledCandidateSource = demo.createSyntheticFixture(
      "cancelled-candidate",
      demo.CANCELLED_CANDIDATE_LENGTHS,
      0
    );
    const expectedCandidateDocuments = demo.createDemoDocuments([
      expectedRejectedCandidateSource,
      expectedCancelledCandidateSource
    ], 48123);
    const [
      expectedRejectedCandidateFixture,
      expectedCancelledCandidateFixture
    ] = expectedCandidateDocuments.fixtures;
    assert.equal(
      new Set([
        expectedRejectedCandidateFixture.manifestSha256,
        expectedPreservedPriorFixture.manifestSha256,
        expectedCancelledCandidateFixture.manifestSha256
      ]).size,
      3
    );
    assert.equal(
      result.report.walkthrough.rejectedCandidateTransfer.manifestSha256,
      expectedRejectedCandidateFixture.manifestSha256
    );
    assert.equal(
      result.report.walkthrough.preservedPriorCache.pointer.manifestSha256,
      expectedPreservedPriorFixture.manifestSha256
    );
    assert.equal(
      result.report.walkthrough.cancellation.preservedPriorManifestSha256,
      expectedPreservedPriorFixture.manifestSha256
    );
    assert.equal(
      result.report.walkthrough.cancellation.cancelledCandidateManifestSha256,
      expectedCancelledCandidateFixture.manifestSha256
    );
    assert.deepEqual(result.report.fixtures, {
      preservedPrior: {
        role: "preserved-prior",
        manifestSha256: expectedPreservedPriorFixture.manifestSha256,
        presentBeforeWalkthrough: true,
        remainsActivePointer: true,
        executable: false,
        liveEvidence: false
      },
      rejectedCandidate: {
        role: "rejected-candidate",
        manifestSha256: expectedRejectedCandidateFixture.manifestSha256,
        transferCompleted: true,
        activationOutcome: "rejected",
        becameActive: false,
        retainedAfterRejection: false,
        executable: false,
        liveEvidence: false
      },
      cancelledCandidate: {
        role: "cancelled-candidate",
        manifestSha256: expectedCancelledCandidateFixture.manifestSha256,
        transferCompleted: false,
        cancellationOutcome: "cancelled",
        becameActive: false,
        retainedAfterCancellation: false,
        executable: false,
        liveEvidence: false
      }
    });
    assert.equal(result.report.walkthrough.rejectedCandidateTransfer.becameActive, false);
    assert.equal(result.report.walkthrough.cancellation.candidateBecameActive, false);
    assert.equal(
      result.report.walkthrough.preservedPriorCache.installedEntries.some(
        (entry) => entry.name === expectedRejectedCandidateFixture.manifestSha256
      ),
      false
    );
    for (const member of expectedPreservedPriorFixture.manifest.members) {
      const reopened = result.report.walkthrough.preservedPriorReopen.members[member.fileName];
      assert.equal(reopened.byteLength, member.byteLength);
      assert.equal(reopened.sha256, member.sha256);
      assert.equal(reopened.chunks > 1, true);
    }
    assert.equal(result.report.walkthrough.cancellation.pointerUnchanged, true);
    assert.match(
      result.report.walkthrough.cancellation.progressText,
      /^Peer transport cancelled-candidate: [1-9][0-9]* \/ [1-9][0-9]* bytes \([1-9][0-9]?%\)$/u
    );
    assert.equal(result.report.walkthrough.cancellation.stagingEntries.length, 0);
    assert.equal(result.report.walkthrough.cancellation.request.completed, false);
    assert.equal(result.report.walkthrough.cancellation.request.closedEarly, true);
    assert.equal(Object.hasOwn(result.report.walkthrough, "directTransfer"), false);
    assert.equal(Object.hasOwn(result.report.walkthrough, "opfsCache"), false);
    assert.equal(Object.hasOwn(result.report.walkthrough, "reopen"), false);
    assert.equal(Object.hasOwn(result.report.walkthrough.cancellation,
      "activeManifestSha256"), false);
    assert.equal(result.report.resources.browserContextsClosed, 2);
    assert.equal(result.report.resources.applicationServerClosed, true);
    assert.equal(result.report.resources.peerServerClosed, true);
    assert.equal(result.report.resources.ownedProfileDeleted, true);
    assert.equal(result.report.resources.ownedRunResidueCleaned, true);
    assert.equal(result.report.resources.temporaryEnvironmentRestored, true);

    const notice = fs.readFileSync(path.join(result.outputDirectory, demo.NOTICE_FILE), "utf8");
    assert.match(notice, new RegExp(demo.DEMO_LABEL, "u"));
    assert.match(notice, /not live model, qualification, inference/iu);
    assert.match(notice, /real rejection.*recorded, not hidden/isu);
    assert.match(notice, /No inference is attempted/u);
    assert.equal(demo.SCREENSHOTS.length, 8);
    assert.deepEqual(result.report.artifacts.screenshotEvidence, demo.SCREENSHOT_EVIDENCE);
    for (const evidence of demo.SCREENSHOT_EVIDENCE) {
      const bytes = fs.readFileSync(path.join(result.outputDirectory, evidence.fileName));
      assert.equal(bytes.byteLength > 1024, true);
      assert.deepEqual(pngDimensions(bytes), {
        width: evidence.width,
        height: evidence.height
      });
    }
    assert.deepEqual(
      demo.SCREENSHOT_EVIDENCE.filter((entry) => entry.surface === "application")
        .map((entry) => entry.scope),
      ["chooser", "direct-transfer"]
    );
    assert.deepEqual(
      demo.SCREENSHOT_EVIDENCE.filter((entry) =>
        entry.width === demo.NARROW_VIEWPORT.width).map((entry) => entry.scope),
      ["activation-rejection", "cancellation-atomic"]
    );
    for (const fileName of demo.TRACES) {
      const bytes = fs.readFileSync(path.join(result.outputDirectory, fileName));
      assert.equal(bytes.byteLength > 1024, true);
      assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK");
    }
    const persistedReport = JSON.parse(fs.readFileSync(result.reportPath, "utf8"));
    assert.deepEqual(persistedReport, result.report);
    await assertClosed(result.report.transport.applicationOrigin);
    await assertClosed(result.report.transport.peerOrigin);
  } finally {
    operationScratch.removeOwnedTemporaryDirectory(ownedTestRoot);
  }
});
