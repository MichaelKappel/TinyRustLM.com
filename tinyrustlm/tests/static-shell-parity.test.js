"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  verifyShells,
  writeShells,
  offlineWorkerRuntime
} = require("../tools/static-shell-parity.js");

const { temporaryDirectory } = require("./site-release-test-fixture.js");

const siteRoot = path.resolve(__dirname, "..");

/** Hash fixture bytes to check independent shell asset identities. */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("canonical app shell deterministically generates the public root shell", () => {
  const result = verifyShells(siteRoot);
  assert.match(result.appShell, /<main class="app-shell"/);
  const references = new Set(result.references.map((entry) => entry.reference));
  assert.equal(result.references.length, 21);
  assert.deepEqual(Array.from(references).sort(), [
    "./active-conversation.js",
    "./app.css",
    "./app.js",
    "./browser-model-admission.js",
    "./browser-runtime-loader.js",
    "./calculator-tool.js",
    "./catalog-admission-loader.js",
    "./companion-capability.js",
    "./companion-composition-install.js",
    "./incremental-sha256.js",
    "./memory-endpoints-distributed-sync-v1.js",
    "./memory-endpoints-enrollment.js",
    "./memory-endpoints-http.js",
    "./memory-endpoints-sync.js",
    "./minimodel-catalog-v1.js",
    "./model-composition-store.js",
    "./model-runtime-client.js",
    "./operation-lifetime.js",
    "./p2p-composition-install.js",
    "./prompt2-request.js",
    "./site-release.js"
  ].sort());
  assert.equal(references.has("./companion-bridge.js"), false);
  for (const reference of result.references) {
    assert.equal(reference.version, `sha256-${reference.sha256}`);
  }
});

test("public and loopback release hosts require the sole six-member worker admission path", () => {
  const source = fs.readFileSync(path.join(siteRoot, "app", "app.js"), "utf8");
  for (const host of [
    "127.0.0.1",
    "::1",
    "localhost",
    "tinyrustlm.com",
    "www.tinyrustlm.com"
  ]) {
    assert.match(source, new RegExp(`"${host.replaceAll(".", "\\.")}"`));
  }
  assert.match(source, /models:\s*Object\.create\(null\)/);
  assert.doesNotMatch(source, /modelsWithoutLocalModel|Object\.assign\(result, models/);
  assert.match(source, /activateBrowserComposition\(model, loadId\)/);
  assert.doesNotMatch(source, /WebAssembly\.instantiate/);
  assert.doesNotMatch(source, /tinyrustlm(?:-simd)?\.wasm/);
});

test("narrow desktop reserves a fixed empty-state composer", () => {
  const source = fs.readFileSync(path.join(siteRoot, "app", "app.css"), "utf8");
  assert.match(
    source,
    /@media \(min-width: 900px\) and \(max-width: 1199px\)[\s\S]*?data-conversation-state="empty"[\s\S]*?left: calc\(var\(--left-width\) \+ 18px\);[\s\S]*?bottom: 12px;[\s\S]*?justify-self: stretch;/
  );
});

test("shell writer repairs stale paths and content identities", (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-shell-");
  const appRoot = path.join(root, "app");
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(path.join(appRoot, "app.css"), "body { color: black; }\n");
  fs.writeFileSync(path.join(appRoot, "app.js"), "\"use strict\";\n");
  fs.writeFileSync(path.join(appRoot, "model-runtime-worker.js"), "\"use strict\";\n");
  fs.mkdirSync(path.join(root, "browser-runtime"));
  fs.writeFileSync(path.join(root, "browser-runtime/tinyrustlm-browser-runtime.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  fs.writeFileSync(path.join(root, "browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"), "{}\n");
  fs.writeFileSync(
    path.join(appRoot, "index.html"),
    [
      "<!doctype html>",
      "<link rel=\"stylesheet\" href=\"./app.css?v=stale\">",
      "<script src=\"./app.js?v=stale\"></script>",
      ""
    ].join("\n")
  );
  fs.writeFileSync(path.join(root, "index.html"), "stale root\n");

  const result = writeShells(root);
  const cssHash = sha256(fs.readFileSync(path.join(appRoot, "app.css")));
  const jsHash = sha256(fs.readFileSync(path.join(appRoot, "app.js")));
  assert.match(result.appShell, new RegExp(`app\\.css\\?v=sha256-${cssHash}`));
  assert.match(result.appShell, new RegExp(`app\\.js\\?v=sha256-${jsHash}`));
  assert.match(result.rootShell, new RegExp(`\\.\\/app\\/app\\.css\\?v=sha256-${cssHash}`));
  assert.match(result.rootShell, new RegExp(`\\.\\/app\\/app\\.js\\?v=sha256-${jsHash}`));
  assert.match(result.offlineWorker, /tinyrustlm-static-v1-[a-f0-9]{64}/);
  assert.match(result.offlineWorker, /\/browser-runtime\/tinyrustlm-browser-runtime\.wasm/);

  fs.appendFileSync(path.join(root, "browser-runtime/tinyrustlm-browser-runtime.wasm"), Buffer.from([0]));
  assert.throws(() => verifyShells(root), /offline static worker has stale asset identity/);
  const updated = writeShells(root);
  assert.notEqual(updated.offlineWorker, result.offlineWorker);

  fs.appendFileSync(path.join(appRoot, "app.js"), "window.changed = true;\n");
  assert.throws(() => verifyShells(root), /stale asset identity/);
});

test("shell verification rejects an asset reached through a directory junction", (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-shell-link-");
  const appRoot = path.join(root, "app");
  const externalRoot = path.join(root, "external");
  const junctionPath = path.join(appRoot, "linked");
  context.after(() => {
    fs.rmSync(junctionPath, { force: true });
  });
  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(externalRoot);
  fs.writeFileSync(path.join(externalRoot, "app.js"), "\"use strict\";\n");
  fs.symlinkSync(externalRoot, junctionPath, "junction");
  fs.writeFileSync(
    path.join(appRoot, "index.html"),
    "<script src=\"./linked/app.js?v=stale\"></script>\n"
  );
  fs.writeFileSync(path.join(root, "index.html"), "stale\n");
  assert.throws(() => verifyShells(root), /missing or unsafe|ancestry/);
});

/** Execute the generated worker boundary with real Fetch bodies and an isolated in-memory cache. */
function workerHarness(testContext) {
  const origin = "https://tinyrustlm.com";
  const payloads = new Map([
    ["/index.html", Buffer.from("<h1>unchanged shell</h1>")],
    ["/app/index.html", Buffer.from("<h1>unchanged app shell</h1>")],
    ["/app/app.js", Buffer.from("globalThis.appLoaded = true;")],
    ["/browser-runtime/runtime.wasm", Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])]
  ]);
  const assets = Array.from(payloads, ([assetPath, bytes]) => ({
    path: assetPath, bytes: bytes.length, sha256: sha256(bytes)
  }));
  const cacheName = `tinyrustlm-static-v1-${"a".repeat(64)}`;
  const stores = new Map();
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(key, response) { entries.set(String(key), response.clone()); },
        async match(key) { return entries.get(String(key))?.clone(); }
      };
    },
    async keys() { return Array.from(stores.keys()); },
    async delete(name) { return stores.delete(name); }
  };
  const handlers = new Map();
  const requests = [];
  const observation = { claims: 0, offline: false, override: null };
  const context = {
    self: { location: { origin }, addEventListener(name, fn) { handlers.set(name, fn); },
      clients: { async claim() { observation.claims += 1; } } },
    caches: cacheApi, crypto: crypto.webcrypto,
    URL, Headers, Response, Uint8Array, AbortController, setTimeout, clearTimeout,
    async fetch(url, options) {
      requests.push({ url: String(url), options });
      if (observation.offline) throw new Error("test-offline");
      return observation.override ? observation.override(url)
        : new Response(payloads.get(new URL(url).pathname));
    }
  };
  const names = ["self", "caches", "fetch"];
  const prior = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  testContext.after(() => {
    for (const name of names) {
      if (prior.get(name)) Object.defineProperty(globalThis, name, prior.get(name));
      else delete globalThis[name];
    }
  });
  for (const name of names) Object.defineProperty(globalThis, name,
    { value: context[name], configurable: true, writable: true });
  offlineWorkerRuntime(assets, cacheName);
  return {
    assets, cacheName, stores, requests, observation,
    async lifetime(name) {
      let promise;
      handlers.get(name)({ waitUntil(value) { promise = value; } });
      await promise;
    },
    request(target, options) {
      let result = null;
      handlers.get("fetch")({ request: new Request(new URL(target, origin), options),
        respondWith(value) { result = value; } });
      return result;
    }
  };
}

test("offline static worker serves only the complete exact public closure without network", async context => {
  const h = workerHarness(context);
  await h.lifetime("install");
  assert.equal(h.requests.length, h.assets.length);
  for (const { options } of h.requests) {
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
  }
  h.observation.offline = true;
  assert.equal(await (await h.request("/")).text(), "<h1>unchanged shell</h1>");
  assert.equal(await (await h.request("/app/")).text(), "<h1>unchanged app shell</h1>");
  const script = h.assets.find(asset => asset.path === "/app/app.js");
  assert.match(await (await h.request(`${script.path}?v=sha256-${script.sha256}`)).text(), /appLoaded/);
  assert.equal((await (await h.request("/browser-runtime/runtime.wasm")).arrayBuffer()).byteLength, 8);
  assert.equal(h.requests.length, h.assets.length);
  for (const target of ["https://minimodel.org/catalog/compositions.v1.json", "/catalog.json",
    "/model.slm2", "/.uai/operations.uai", "/api/private", "/.well-known/site-release.json",
    "/app/app.js?v=old", "/app/app.js?token=private", "/?private=1"]) {
    assert.equal(h.request(target), null, target);
  }
  for (const options of [{ method: "POST" }, { headers: { Authorization: "test" } },
    { headers: { Range: "bytes=0-1" } }]) assert.equal(h.request("/app/app.js", options), null);
});

test("failed or incomplete offline installation cannot retain a partial cache or remove its predecessor", async context => {
  const h = workerHarness(context);
  for (const override of [
    () => new Response("unavailable", { status: 503 }),
    () => new Response("x".repeat(4096)),
    () => new Response("short"),
    url => new Response("x".repeat(new URL(url).pathname === "/index.html" ? 24 : 1)),
    url => new URL(url).pathname === "/index.html" ? new Response("<h1>unchanged shell</h1>")
      : new Response("unavailable", { status: 503 })
  ]) {
    const prior = `tinyrustlm-static-v1-${"b".repeat(64)}`;
    h.stores.set(prior, new Map());
    h.observation.override = override;
    await assert.rejects(h.lifetime("install"), /offline-static-/);
    assert.equal(h.stores.has(h.cacheName), false);
    assert.equal(h.stores.has(prior), true);
    assert.equal(h.observation.claims, 0);
  }
});

test("offline reads recheck cached bytes and missing entries admit only pinned network bytes", async context => {
  const h = workerHarness(context);
  await h.lifetime("install");
  const cache = h.stores.get(h.cacheName);
  const key = "https://tinyrustlm.com/app/app.js";
  cache.set(key, new Response("unexpected"));
  await assert.rejects(h.request("/app/app.js"), /offline-static-identity/);
  assert.equal(h.requests.length, h.assets.length);
  cache.delete(key);
  assert.match(await (await h.request("/app/app.js")).text(), /appLoaded/);
  assert.equal(h.requests.length, h.assets.length + 1);
  cache.delete(key);
  h.observation.override = () => new Response("wrong bytes");
  await assert.rejects(h.request("/app/app.js"), /offline-static-identity/);
  assert.equal(cache.has(key), false);
});

test("normal worker activation retires only its own previous static asset cache", async context => {
  const h = workerHarness(context);
  await h.lifetime("install");
  const prior = `tinyrustlm-static-v1-${"b".repeat(64)}`;
  for (const name of [prior, "tinyrustlm-models", "unrelated-static", "tinyrustlm-static-v1-other"]) {
    h.stores.set(name, new Map());
  }
  await h.lifetime("activate");
  assert.equal(h.stores.has(prior), false);
  assert.equal(h.stores.has(h.cacheName), true);
  assert.equal(h.stores.has("tinyrustlm-models"), true);
  assert.equal(h.stores.has("unrelated-static"), true);
  assert.equal(h.stores.has("tinyrustlm-static-v1-other"), true);
  assert.equal(h.observation.claims, 1);
});
