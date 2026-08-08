"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  startStaticServer
} = require("../tools/static-server.js");
const {
  validateWebDeploymentManifest
} = require("../tools/web-deployment-manifest.js");
const { materializeReleasePublication } = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");

function request(origin, pathname, method = "GET") {
  return new Promise((resolve, reject) => {
    const operation = http.request(
      new URL(pathname, origin),
      { method },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks)
        }));
      }
    );
    operation.once("error", reject);
    operation.end();
  });
}

test("loopback release server exposes only exact manifest public artifacts", async (context) => {
  const generatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-static-release-"));
  context.after(() => fs.rmSync(generatedRoot, { recursive: true, force: true }));
  materializeReleasePublication({
    ledgerPath,
    outputRoot: generatedRoot,
    sourceRevision: "2".repeat(40),
    publishedAt: "2026-08-02T23:00:00.000Z"
  });
  const validation = validateWebDeploymentManifest({ siteRoot, generatedRoot });
  const appScript = validation.files.find((file) => file.remote === "app/app.js");
  const server = await startStaticServer({ siteRoot, generatedRoot, port: 0 });
  try {
    const root = await request(server.origin, "/");
    assert.equal(root.statusCode, 200);
    assert.match(String(root.headers["content-type"]), /^text\/html/);
    assert.equal(root.headers["x-content-type-options"], "nosniff");
    assert.equal(root.headers["x-frame-options"], "DENY");
    assert.equal(root.headers["referrer-policy"], "no-referrer");

    const app = await request(server.origin, "/app/");
    assert.equal(app.statusCode, 200);

    const companion = await request(server.origin, "/companion/");
    assert.equal(companion.statusCode, 200);

    const updates = await request(server.origin, "/updates/");
    assert.equal(updates.statusCode, 200);

    const release = await request(server.origin, "/.well-known/site-release.json");
    assert.equal(release.statusCode, 200);
    assert.match(String(release.headers["content-type"]), /^application\/json/);

    const versioned = await request(
      server.origin,
      `/app/app.js?v=sha256-${appScript.sha256}`
    );
    assert.equal(versioned.statusCode, 200);
    assert.equal(versioned.body.length, appScript.byteCount);

    assert.equal((await request(server.origin, "/app/app.js?v=stale")).statusCode, 404);
    assert.equal((await request(server.origin, "/.htaccess")).statusCode, 404);
    assert.equal((await request(server.origin, "/tools/static-server.js")).statusCode, 404);
    assert.equal((await request(server.origin, "/models/test.slm")).statusCode, 404);
    assert.equal((await request(server.origin, "/app/models/metadata.json")).statusCode, 404);
    const rejectedMethod = await request(server.origin, "/app/app.js", "POST");
    assert.equal(rejectedMethod.statusCode, 405);
    assert.equal(rejectedMethod.headers.allow, "GET, HEAD");
    const head = await request(server.origin, "/app/app.js", "HEAD");
    assert.equal(head.statusCode, 200);
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers["content-length"]), appScript.byteCount);
  } finally {
    await server.close();
  }
});
