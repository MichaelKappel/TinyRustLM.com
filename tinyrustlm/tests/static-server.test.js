"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const {
  startStaticServer,
  startSourceServer,
  canonicalRequestPath
} = require("../tools/static-server.js");
const {
  validateWebDeploymentManifest
} = require("../tools/web-deployment-manifest.js");
const { materializeSourceReleaseAt, temporaryDirectory } = require("./site-release-test-fixture.js");

const siteRoot = path.resolve(__dirname, "..");

/** Preserve raw HTTP targets so URL normalization cannot hide rejected aliases. */
function request(origin, pathname, method = "GET", headers = {}) {
  return new Promise((resolve, reject) => {
    const operation = http.request(
      origin,
      { method, path: pathname, headers },
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
  const generatedRoot = temporaryDirectory(context, "tinyrustlm-static-release-");
  materializeSourceReleaseAt({
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


test("source preview serves exact working bytes and refuses private files, aliases and foreign authorities", async () => {
  const server = await startSourceServer({ siteRoot, port: 0 });
  try {
    const script = fs.readFileSync(path.join(siteRoot, "app/app.js"));
    const hash = crypto.createHash("sha256").update(script).digest("hex");
    const target = "/app/app.js?v=sha256-" + hash;
    const get = await request(server.origin, target);
    assert.equal(get.statusCode, 200);
    assert.deepEqual(get.body, script);
    assert.equal(get.headers["cache-control"], "no-store");
    assert.equal(get.headers["x-content-type-options"], "nosniff");
    const head = await request(server.origin, target, "HEAD");
    assert.equal(head.statusCode, 200);
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers["content-length"]), script.length);
    for (const route of ["/", "/app/", "/companion/", "/updates/"]) {
      assert.equal((await request(server.origin, route)).statusCode, 200, route);
    }
    for (const route of [
      "/.git/config", "/.uai/taboo.uai", "/tools/static-server.js", "/.htaccess",
      "/deploy/web-deployment-manifest.v2.json", "/.well-known/site-release.json",
      "/app/minimodel-announcement.js", "/app/companion-bridge.js", "/models/model.slm2",
      "/app/app.js?v=sha256-" + "0".repeat(64), "/app/app.js?v=stale",
      target + "&v=sha256-" + hash, target + "&other=1", "/index.html?v=sha256-" + hash,
    ]) assert.equal((await request(server.origin, route)).statusCode, 404, route);
    for (const route of ["//foreign.invalid/app/app.js", "/app/../app/app.js", "/app/./app.js",
      "/%61pp/app.js", "/app%2fapp.js", "/app/%2e%2e/app/app.js", "/app/app.js#fragment"]) {
      assert.equal((await request(server.origin, route)).statusCode, 400, route);
    }
    const port = new URL(server.origin).port;
    for (const host of ["foreign.invalid:" + port, "127.0.0.1:1", "localhost", "127.0.0.1.evil:" + port]) {
      const response = await request(server.origin, target, "GET", { Host: host });
      assert.equal(response.statusCode, 421, host);
      assert.equal(response.body.toString(), "misdirected request");
    }
    assert.equal((await request(server.origin, "/", "GET", { Host: "localhost:" + port })).statusCode, 200);
    const post = await request(server.origin, target, "POST");
    assert.equal(post.statusCode, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
  } finally { await server.close(); await server.close(); }
});

test("source preview validates ports and bounded current manifest declarations before listening", async (context) => {
  for (const port of [-1, 65536, 1.5, NaN, "invalid"]) {
    await assert.rejects(startSourceServer({ siteRoot, port }), /port is invalid/);
    await assert.rejects(startStaticServer({ siteRoot, port }), /port is invalid/);
  }
  const manifestPath = path.join(siteRoot, "deploy/web-deployment-manifest.v2.json");
  const read = fs.readFileSync;
  const baseline = JSON.parse(read(manifestPath, "utf8"));
  let current;
  context.mock.method(fs, "readFileSync", function (file, ...args) {
    return path.resolve(String(file)) === manifestPath ? current : read.call(this, file, ...args);
  });
  const sourceEntry = { source: "source", local: "index.html", remote: "index.html" };
  const badManifests = ["{", "null", "[]", {}, { ...baseline, schema: "old" },
    { ...baseline, publicOrigin: "https://foreign.invalid" },
    { ...baseline, deploymentScope: "model-bytes" },
    { ...baseline, publish: [] }, { ...baseline, publish: Array(97).fill(sourceEntry) },
    ...[null, {}, { ...sourceEntry, extra: true }, { ...sourceEntry, source: "foreign" },
      { ...sourceEntry, local: "app/index.html" },
      ...["../index.html", "models/metadata.json", "model.slm2", "prompt.prompt2", "composition.acg2",
        "app/index.html:stream", "app/%69ndex.html", "app/index.html?query"].map((file) => ({ source: "source", local: file, remote: file }))
    ].map((entry) => ({ ...baseline, publish: [...baseline.publish, entry] })),
    { ...baseline, publish: [sourceEntry, sourceEntry] },
    { ...baseline, publish: [sourceEntry] },
  ];
  for (const value of badManifests) {
    current = typeof value === "string" ? value : JSON.stringify(value);
    await assert.rejects(startSourceServer({ siteRoot }), /manifest|artifact|Release file/);
  }
});

test("source preview hashes the response bytes and refuses files that become unavailable", async (context) => {
  const server = await startSourceServer({ siteRoot });
  const filePath = path.join(siteRoot, "app/app.js");
  const read = fs.readFileSync;
  const original = read(filePath);
  const originalHash = crypto.createHash("sha256").update(original).digest("hex");
  const changed = Buffer.from("bounded synthetic response bytes");
  const changedHash = crypto.createHash("sha256").update(changed).digest("hex");
  let missing = false;
  context.mock.method(fs, "readFileSync", function (file, ...args) {
    if (path.resolve(String(file)) !== filePath) return read.call(this, file, ...args);
    if (missing) throw new Error("private path must not escape");
    return changed;
  });
  try {
    assert.equal((await request(server.origin, "/app/app.js?v=sha256-" + originalHash)).statusCode, 404);
    const response = await request(server.origin, "/app/app.js?v=sha256-" + changedHash);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, changed);
    missing = true;
    const absent = await request(server.origin, "/app/app.js");
    assert.equal(absent.statusCode, 400);
    assert.equal(absent.body.toString(), "bad request");
  } finally { await server.close(); }
});

test("canonical static paths refuse normalization and non-origin request forms", () => {
  for (const target of [null, "", "https://foreign.invalid/", "//foreign.invalid/", "/a/../index.html",
    "/a/./index.html", "/%69ndex.html", "/index.html#fragment", "/index.html\\alias", "/" + "a".repeat(2048)]) {
    assert.throws(() => canonicalRequestPath(target), /invalid/);
  }
  assert.equal(canonicalRequestPath("/app/").pathname, "/app/index.html");
});
