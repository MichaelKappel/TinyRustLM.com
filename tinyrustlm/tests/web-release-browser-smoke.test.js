"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  boundedMethodIdentity,
  boundedStateIdentity,
  boundedUrlIdentity,
  buildAllowedReleaseRequests,
  canonicalPublicOrigin,
  classifyReleaseRequest,
  requireBaseUrl,
  requireSourceRevision,
  runWebReleaseBrowserSmoke
} = require("../tools/web-release-browser-smoke.js");
const {
  validateWebDeploymentManifest
} = require("../tools/web-deployment-manifest.js");
const { materializeReleaseState } = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");

function generatedRelease(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-smoke-release-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  materializeReleaseState({
    ledgerPath,
    outputRoot: root
  });
  return root;
}

test("browser smoke accepts only canonical public HTTPS or loopback HTTP", () => {
  assert.equal(requireBaseUrl(canonicalPublicOrigin).origin, canonicalPublicOrigin);
  assert.equal(requireBaseUrl("http://127.0.0.1:41873").hostname, "127.0.0.1");
  assert.throws(() => requireBaseUrl("https://example.com"), /allowed release boundary/);
  assert.throws(
    () => requireBaseUrl("https://user:secret@tinyrustlm.com"),
    /allowed release boundary/
  );
  assert.throws(
    () => requireBaseUrl("https://tinyrustlm.com/?token=synthetic"),
    /allowed release boundary/
  );
});

test("uncommitted browser smoke authority is limited to loopback", () => {
  assert.equal(requireSourceRevision("uncommitted", true), null);
  assert.equal(requireSourceRevision("a".repeat(40), false), "a".repeat(40));
  assert.throws(
    () => requireSourceRevision("uncommitted", false),
    /source revision is invalid/
  );
});

test("browser smoke blocks undeclared traffic before send and hashes untrusted URLs", (context) => {
  const validation = validateWebDeploymentManifest({
    siteRoot,
    generatedRoot: generatedRelease(context)
  });
  const allowedRequests = buildAllowedReleaseRequests(validation);
  const appScript = validation.files.find((file) => file.remote === "app/app.js");
  const expectedOrigin = "http://127.0.0.1:41873";

  assert.equal(
    classifyReleaseRequest(
      `${expectedOrigin}/app/app.js?v=sha256-${appScript.sha256}`,
      "GET",
      expectedOrigin,
      allowedRequests
    ).allowed,
    true
  );
  assert.equal(
    classifyReleaseRequest(
      `${expectedOrigin}/app/app.js?v=stale`,
      "GET",
      expectedOrigin,
      allowedRequests
    ).reason,
    "unexpected-query"
  );
  assert.equal(
    classifyReleaseRequest(
      `${expectedOrigin}/.well-known/site-release.json`,
      "GET",
      expectedOrigin,
      allowedRequests
    ).allowed,
    true
  );
  assert.equal(
    classifyReleaseRequest(
      `${expectedOrigin}/api/enroll/synthetic-secret`,
      "POST",
      expectedOrigin,
      allowedRequests
    ).reason,
    "unexpected-method"
  );
  const untrustedIdentity = boundedUrlIdentity(
    "https://synthetic-secret.example/api/token/synthetic-secret?key=synthetic-secret",
    expectedOrigin,
    allowedRequests
  );
  const serialized = JSON.stringify(untrustedIdentity);
  assert.doesNotMatch(serialized, /synthetic-secret/);
  assert.equal(untrustedIdentity.pathname, null);
  assert.equal(untrustedIdentity.urlClass, "unexpected-origin");
});

test("browser smoke preserves declared states and hashes unexpected state text", () => {
  const declared = boundedStateIdentity("loaded", ["loaded"]);
  assert.equal(declared.stateClass, "declared");
  assert.equal(declared.value, "loaded");

  const unexpected = boundedStateIdentity("synthetic-secret", ["loaded"]);
  assert.equal(unexpected.stateClass, "unexpected");
  assert.equal(unexpected.value, null);
  assert.equal(unexpected.valueByteCount, Buffer.byteLength("synthetic-secret"));
  assert.doesNotMatch(JSON.stringify(unexpected), /synthetic-secret/);
});

test("browser smoke preserves GET and hashes unexpected HTTP methods", () => {
  const declared = boundedMethodIdentity("GET");
  assert.equal(declared.methodClass, "declared");
  assert.equal(declared.value, "GET");

  const unexpected = boundedMethodIdentity("SYNTHETIC-SECRET");
  assert.equal(unexpected.methodClass, "unexpected");
  assert.equal(unexpected.value, null);
  assert.equal(unexpected.valueByteCount, Buffer.byteLength("SYNTHETIC-SECRET"));
  assert.doesNotMatch(JSON.stringify(unexpected), /SYNTHETIC-SECRET/);
});

test("browser smoke rejects a reused output directory before browser launch", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-browser-smoke-path-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outputDirectory = path.join(root, "existing");
  fs.mkdirSync(outputDirectory);
  const generatedRoot = generatedRelease(context);
  await assert.rejects(
    () => runWebReleaseBrowserSmoke({
      baseUrl: "http://127.0.0.1:9",
      outputDirectory,
      sourceRevision: "uncommitted",
      generatedRoot
    }),
    /already exists/
  );
});
