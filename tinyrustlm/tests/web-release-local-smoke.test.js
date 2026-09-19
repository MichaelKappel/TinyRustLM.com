"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { temporaryDirectory } = require("./site-release-test-fixture.js");

const {
  runLocalWebReleaseSmoke
} = require("../tools/web-release-local-smoke.js");
const { invokeLocalWebReleaseSmokeCli } = require("../tools/run-web-release-local-smoke.js");

test("local web release smoke proves the exact closure in real Chromium", {
  timeout: 150_000
}, async (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-local-web-smoke-");
  const outputDirectory = path.join(root, "evidence");

  let result;
  try {
    result = await invokeLocalWebReleaseSmokeCli({
      outputDirectory,
      scratchDirectory: root,
      signal: context.signal,
      siteRoot: path.resolve(__dirname, "..")
    });
  } catch (error) {
    const reportPath = path.join(outputDirectory, "browser-smoke-report.json");
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      context.diagnostic(JSON.stringify({ failureCode: report.failureCode,
        failureDetailCode: report.failureDetailCode, failureDiagnostic: report.failureDiagnostic }));
    }
    throw error;
  }
  assert.equal(result.status, "pass");
  assert.equal(result.observationCount, 12);

  const persistedBytes = fs.readFileSync(
    path.join(outputDirectory, "browser-smoke-report.json")
  );
  assert.equal(
    crypto.createHash("sha256").update(persistedBytes).digest("hex"),
    result.reportSha256
  );
  const report = JSON.parse(persistedBytes.toString("utf8"));
  assert.equal(report.browserClosed, true);
  assert.equal(report.catalogMode, "intercepted-current-empty-fixture");
  assert.equal(report.schema, "tinyrustlm.web_release_browser_smoke.v7");
  assert.equal(report.routeCount, 4);
  assert.equal(
    report.networkPolicy,
    "exact-release-and-catalog-metadata-closure-deny-before-send"
  );
  assert.equal(report.failureCode, null);
  const runtimePath = path.resolve(__dirname, "../browser-runtime/tinyrustlm-browser-runtime.wasm");
  const runtimeBytes = fs.readFileSync(runtimePath);
  const runtimeManifestBytes = fs.readFileSync(runtimePath + ".manifest.json");
  for (const observation of report.observations) {
    assert.equal(observation.startupRuntimeRequestCount, 0);
    if (observation.surfaceKind === "application") {
      assert.equal(observation.wasmState, "waiting");
      assert.equal(observation.runtimeVariant, "");
      assert.equal(observation.generateDisabled, true);
      assert.deepEqual(observation.runtimeArtifactProbe, {
        status: "verified", byteCount: runtimeBytes.length,
        wasmSha256: crypto.createHash("sha256").update(runtimeBytes).digest("hex"),
        manifestSha256: crypto.createHash("sha256").update(runtimeManifestBytes).digest("hex")
      });
    } else assert.equal(observation.runtimeArtifactProbe, null);
    assert.equal(observation.blockedRequestCount, 0);
    assert.equal(observation.unexpectedOriginCount, 0);
    const expectedMetadataCount = observation.surfaceKind === "application" ? 2 : 0;
    assert.equal(observation.declaredMetadataRequestCount, expectedMetadataCount);
    assert.equal(observation.declaredMetadataResponseCount, expectedMetadataCount);
    assert.equal(observation.failedRequestCount, 0);
    assert.equal(observation.consoleErrorCount, 0);
    assert.equal(observation.pageErrorCount, 0);
    assert.equal(observation.releaseState, "verified");
    assert.equal(observation.releaseVersion, "0.5.0");
    assert.equal(observation.releaseDate, "2026-08-31");
    assert.match(observation.releasePublishedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Date.parse(observation.releasePublishedAt) >=
      Date.parse(`${observation.releaseDate}T00:00:00.000Z`));
    assert.equal(observation.releaseSurfaceContentOverflowPixels, 0);
    assert.equal(observation.releaseSurfaceViewportOverflowPixels, 0);
    assert.match(observation.screenshot.sha256, /^[0-9a-f]{64}$/);
  }
  const updates = report.observations.filter((observation) => observation.route === "updates");
  assert.equal(updates.length, 3);
  for (const observation of updates) {
    assert.equal(observation.surfaceKind, "release-history");
    assert.equal(observation.releaseEntryCount, 9);
  }
  const companion = report.observations.filter(
    (observation) => observation.route === "companion"
  );
  assert.equal(companion.length, 3);
  for (const observation of companion) {
    assert.equal(observation.surfaceKind, "companion-release");
    assert.equal(observation.companionPackagePending, true);
    assert.equal(observation.companionDeploymentBlocked, true);
    assert.equal(observation.companionPackageLinkPresent, false);
    assert.equal(observation.companionInstallCommandPresent, false);
  }
});

test("local smoke removes generated metadata when ledger loading fails", async (context) => {
  const generatedParent = path.resolve(__dirname, "../artifacts/local-release");
  fs.mkdirSync(generatedParent, { recursive: true });
  const before = fs.readdirSync(generatedParent);
  const original = fs.readFileSync;
  const ledgerPath = path.resolve(__dirname, "../release/site-release-ledger.v1.json");
  const mock = context.mock.method(fs, "readFileSync", (file, ...args) => {
    if (file === ledgerPath) throw new Error("synthetic ledger read failure");
    return original(file, ...args);
  });
  await assert.rejects(runLocalWebReleaseSmoke({}), /synthetic ledger read failure/);
  mock.mock.restore();
  assert.deepEqual(fs.readdirSync(generatedParent), before);
});

test("local smoke closes its server and removes metadata after output rejection", async (context) => {
  const http = require("node:http");
  const original = http.createServer;
  let server;
  let closed = false;
  context.mock.method(http, "createServer", (...args) => {
    server = original(...args);
    server.once("close", () => { closed = true; });
    return server;
  });
  const generatedParent = path.resolve(__dirname, "../artifacts/local-release");
  const before = fs.readdirSync(generatedParent);
  await assert.rejects(runLocalWebReleaseSmoke({ outputDirectory: path.resolve(__dirname, "..") }),
    /canonical project artifacts/);
  assert.equal(closed, true);
  assert.equal(server.listening, false);
  assert.deepEqual(fs.readdirSync(generatedParent), before);
});
