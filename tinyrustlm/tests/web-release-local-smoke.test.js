"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  runLocalWebReleaseSmoke
} = require("../tools/web-release-local-smoke.js");

test("local web release smoke proves the exact closure in real Chromium", {
  timeout: 30_000
}, async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-local-web-smoke-"));
  const outputDirectory = path.join(root, "evidence");
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = await runLocalWebReleaseSmoke({
    outputDirectory,
    siteRoot: path.resolve(__dirname, "..")
  });
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
  assert.equal(report.schema, "tinyrustlm.web_release_browser_smoke.v5");
  assert.equal(report.routeCount, 4);
  assert.equal(report.networkPolicy, "exact-release-closure-deny-before-send");
  assert.equal(report.failureCode, null);
  for (const observation of report.observations) {
    assert.equal(observation.blockedRequestCount, 0);
    assert.equal(observation.unexpectedOriginCount, 0);
    assert.equal(observation.failedRequestCount, 0);
    assert.equal(observation.consoleErrorCount, 0);
    assert.equal(observation.pageErrorCount, 0);
    assert.equal(observation.releaseState, "verified");
    assert.equal(observation.releaseVersion, "0.2.1");
    assert.equal(observation.releaseDate, "2026-08-08");
    assert.match(observation.releasePublishedAt, /^2026-08-08T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(observation.releaseSurfaceContentOverflowPixels, 0);
    assert.equal(observation.releaseSurfaceViewportOverflowPixels, 0);
    assert.match(observation.screenshot.sha256, /^[0-9a-f]{64}$/);
  }
  const updates = report.observations.filter((observation) => observation.route === "updates");
  assert.equal(updates.length, 3);
  for (const observation of updates) {
    assert.equal(observation.surfaceKind, "release-history");
    assert.equal(observation.releaseEntryCount, 5);
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
