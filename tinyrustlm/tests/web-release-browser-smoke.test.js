"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  boundedMethodIdentity,
  boundedStateIdentity,
  boundedUrlIdentity,
  buildAllowedReleaseRequests,
  canonicalPublicOrigin,
  classifyReleaseRequest,
  declaredCatalogMetadata,
  requireBaseUrl,
  requireSourceRevision,
  runWebReleaseBrowserSmoke,
  verifyRuntimeArtifactProbe
} = require("../tools/web-release-browser-smoke.js");
const {
  validateWebDeploymentManifest
} = require("../tools/web-deployment-manifest.js");
const { materializeSourceReleaseState, temporaryDirectory } = require("./site-release-test-fixture.js");

const siteRoot = path.resolve(__dirname, "..");

test("runtime probe binds both artifacts to independently hashed release inputs", () => {
  const manifestText = "canonical fixture manifest\n";
  const digest = crypto.createHash("sha256").update(manifestText).digest("hex");
  const expected = { wasm: { byteCount: 8, sha256: "a".repeat(64) },
    manifest: { sha256: digest } };
  const probe = { manifestText, byteCount: 8, wasmSha256: "a".repeat(64) };
  assert.deepEqual(verifyRuntimeArtifactProbe(probe, expected), {
    status: "verified", byteCount: 8, wasmSha256: "a".repeat(64), manifestSha256: digest
  });
  for (const invalid of [null, {}, { ...probe, byteCount: 9 },
    { ...probe, wasmSha256: "b".repeat(64) }, { ...probe, manifestText: manifestText + " " },
    { ...probe, manifestText: "x".repeat(16385) }]) {
    assert.throws(() => verifyRuntimeArtifactProbe(invalid, expected), /publication inputs/);
  }
  assert.throws(() => verifyRuntimeArtifactProbe(probe,
    { ...expected, wasm: { ...expected.wasm, sha256: "b".repeat(64) } }), /publication inputs/);
  assert.throws(() => verifyRuntimeArtifactProbe(probe,
    { ...expected, manifest: { sha256: "b".repeat(64) } }), /publication inputs/);
});

function generatedRelease(context) {
  return materializeSourceReleaseState(
    context,
    "tinyrustlm-smoke-release-"
  ).outputRoot;
}

test("browser smoke accepts only canonical public HTTPS or loopback HTTP", () => {
  assert.equal(requireBaseUrl(canonicalPublicOrigin).origin, canonicalPublicOrigin);
  assert.equal(requireBaseUrl("http://127.0.0.1:41873").hostname, "127.0.0.1");
  assert.equal(requireBaseUrl("http://[::1]:41873").hostname, "[::1]");
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

test("intercepted empty metadata satisfies current catalog and peer contracts", () => {
  const api = require("../app/minimodel-catalog-v1.js");
  const now = Date.parse("2026-09-12T12:00:00Z");
  const fixtures = declaredCatalogMetadata(now);
  const catalog = api.validateCatalog(JSON.parse(fixtures[0].body), { now: new Date(now) });
  const peers = api.validatePeerFeedDocument(JSON.parse(fixtures[1].body), { now: new Date(now) });
  assert.deepEqual(catalog.entries, []);
  assert.deepEqual(peers.announcements, []);
  assert.equal(Date.parse(catalog.generated_at_utc), now - 60_000);
  assert.equal(Date.parse(peers.valid_until_utc), now + 3_600_000);
  for (const invalid of [NaN, -1, "today", 8e15]) {
    assert.throws(() => declaredCatalogMetadata(invalid), /metadata time/);
  }
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
  const catalogRequest = classifyReleaseRequest(
    "https://minimodel.org/catalog/compositions.v1.json",
    "GET",
    expectedOrigin,
    allowedRequests
  );
  assert.equal(catalogRequest.allowed, true);
  assert.equal(catalogRequest.request.kind, "catalog-metadata");
  assert.deepEqual(JSON.parse(catalogRequest.request.body).entries, []);
  const catalogIdentity = boundedUrlIdentity(
    "https://minimodel.org/catalog/compositions.v1.json",
    expectedOrigin,
    allowedRequests
  );
  assert.equal(catalogIdentity.urlClass, "declared-metadata-origin");
  assert.equal(catalogIdentity.pathnameClass, "declared-metadata-path");
  assert.equal(
    classifyReleaseRequest(
      "https://minimodel.org/catalog/compositions.v1.json",
      "POST",
      expectedOrigin,
      allowedRequests
    ).reason,
    "unexpected-method"
  );
  assert.equal(
    classifyReleaseRequest(
      "https://minimodel.org/catalog/compositions.v1.json?unexpected=1",
      "GET",
      expectedOrigin,
      allowedRequests
    ).allowed,
    false
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
  const root = temporaryDirectory(context, "tinyrustlm-browser-smoke-path-");
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
