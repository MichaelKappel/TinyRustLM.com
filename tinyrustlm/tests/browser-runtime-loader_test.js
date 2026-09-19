"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const loader = require("../app/browser-runtime-loader.js");

const wasm = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]);
const manifest = {
  ...JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"), "utf8")),
  byteCount: wasm.length,
  sha256: crypto.createHash("sha256").update(wasm).digest("hex")
};
const manifestBytes = new TextEncoder().encode(loader.serializeManifest(manifest));

/** Keep fixture data streamed and fail if the loader requests an unbounded body. */
function response(bytes, headers = {}) {
  const value = new Response(bytes, { headers });
  value.arrayBuffer = () => assert.fail("unbounded arrayBuffer read");
  return value;
}

/** Drive one malformed response through the actual manifest or WASM stage. */
function loadAt(stage, value) {
  return loader.load({
    manifestUrl: "manifest", wasmUrl: "wasm",
    fetchFunction: async url => url === stage ? value : response(
      url === "manifest" ? manifestBytes : wasm)
  });
}

/** Observe early stream termination, including a cancellation promise that never settles. */
function observedResponse(chunks, { header = null, error = null, hangingCancel = false } = {}) {
  const observation = { reads: 0, cancels: 0, releases: 0 };
  return {
    observation,
    ok: true,
    headers: { get: name => name === "content-length" ? header : null },
    arrayBuffer: () => assert.fail("unbounded arrayBuffer read"),
    body: {
      getReader() {
        return {
          async read() {
            const index = observation.reads++;
            if (error) throw error;
            return index < chunks.length ? { done: false, value: chunks[index] } : { done: true };
          },
          cancel() {
            observation.cancels += 1;
            return hangingCancel ? new Promise(() => {}) : Promise.resolve();
          },
          releaseLock() { observation.releases += 1; }
        };
      },
      cancel() { observation.cancels += 1; return Promise.resolve(); }
    }
  };
}

test("runtime loader streams both bodies without using arrayBuffer", async () => {
  const result = await loadAt("wasm", response(wasm));
  assert.deepEqual(new Uint8Array(result.wasmBytes), wasm);
  assert.equal(result.manifest.sha256, manifest.sha256);
});

test("runtime loader stops on the first decoded overflow at each stage", async t => {
  for (const stage of ["manifest", "wasm"]) {
    await t.test(stage, { timeout: 1500 }, async () => {
      const limit = stage === "manifest" ? loader.maximumManifestBytes : wasm.length;
      const value = observedResponse([new Uint8Array(limit), Uint8Array.of(1), Uint8Array.of(2)],
        { header: "1", hangingCancel: true });
      await assert.rejects(loadAt(stage, value), error => error.code ===
        "browser-runtime-" + stage + "-fetch");
      assert.deepEqual(value.observation, { reads: 2, cancels: 1, releases: 1 });
    });
  }
});

test("runtime loader bounds and releases invalid streams and read failures", async t => {
  for (const [label, chunks, error] of [
    ["empty", [], null],
    ["empty chunk", [new Uint8Array(0)], null],
    ["wrong chunk type", [new ArrayBuffer(8)], null],
    ["read failure", [], new Error("network reset")]
  ]) {
    await t.test(label, async () => {
      const value = observedResponse(chunks, { error });
      await assert.rejects(loadAt("wasm", value),
        error => error.code === "browser-runtime-wasm-fetch");
      assert.equal(value.observation.cancels, 1);
      assert.equal(value.observation.releases, 1);
    });
  }
});

test("runtime loader cancels rejected headers before consuming the body", async t => {
  for (const header of ["9007199254740992", "-1", "1.5", "09", "not a length",
    String(loader.maximumManifestBytes + 1)]) {
    await t.test(header, async () => {
      const value = observedResponse([manifestBytes], { header });
      await assert.rejects(loadAt("manifest", value),
        error => error.code === "browser-runtime-manifest-fetch");
      assert.deepEqual(value.observation, { reads: 0, cancels: 1, releases: 0 });
    });
  }
});

test("runtime loader accepts fragmented views and releases successful readers", async () => {
  const value = observedResponse(Array.from(wasm, byte => Uint8Array.of(99, byte, 99).subarray(1, 2)));
  const result = await loadAt("wasm", value);
  assert.deepEqual(new Uint8Array(result.wasmBytes), wasm);
  assert.deepEqual(value.observation, { reads: wasm.length + 1, cancels: 0, releases: 1 });
});

test("runtime loader rejects unavailable streams and preserves errors during cleanup", async t => {
  for (const value of [null, { ok: false }, { ok: true, arrayBuffer: () => new ArrayBuffer(8) }]) {
    await t.test("unavailable body", async () => {
      await assert.rejects(loadAt("wasm", value), error => error.code === "browser-runtime-wasm-fetch");
    });
  }
  await t.test("reader cleanup throws", async () => {
    const value = observedResponse([]);
    value.body.getReader = () => ({
      read: async () => ({ done: "false", value: wasm }),
      cancel: () => { throw new Error("cancel failure"); },
      releaseLock: () => { throw new Error("release failure"); }
    });
    await assert.rejects(loadAt("wasm", value), error => error.code === "browser-runtime-wasm-fetch");
  });
  await t.test("fetch failure", async () => {
    await assert.rejects(loader.load({ manifestUrl: "manifest", wasmUrl: "wasm",
      fetchFunction: async () => { throw new Error("offline"); }
    }), error => error.code === "browser-runtime-manifest-fetch");
  });
});

test("runtime loader retains canonical manifest and exact WASM identity gates", async t => {
  await t.test("noncanonical manifest", async () => {
    await assert.rejects(loadAt("manifest", response(new TextEncoder().encode(
      JSON.stringify(manifest, null, 2)))), error => error.code === "browser-runtime-manifest-canonical");
  });
  for (const [label, bytes] of [
    ["truncated", wasm.slice(0, -1)],
    ["same-length corruption", Uint8Array.from(wasm, (value, index) => index ? value : 1)]
  ]) {
    await t.test(label, async () => {
      await assert.rejects(loadAt("wasm", response(bytes)),
        error => error.code === "browser-runtime-wasm-identity");
    });
  }
});

/** Start a local fixture origin with compressed and chunked runtime responses. */
async function fixtureServer(t) {
  const overManifest = Buffer.alloc(loader.maximumManifestBytes + 1, 32);
  const routes = {
    "/manifest": [Buffer.from(manifestBytes), "gzip"],
    "/wasm": [Buffer.from(wasm), "gzip"],
    "/manifest-overflow": [overManifest, "gzip"],
    "/wasm-overflow": [Buffer.from([...wasm, 1]), null],
    "/wasm-truncated": [Buffer.from(wasm.slice(0, -1)), null]
  };
  const server = http.createServer((request, reply) => {
    if (request.url === "/") {
      reply.writeHead(200, { "Content-Type": "text/html" });
      reply.end("<!doctype html><title>Runtime loader fixture</title>");
      return;
    }
    if (request.url === "/loader.js") {
      reply.writeHead(200, { "Content-Type": "text/javascript" });
      reply.end(fs.readFileSync(path.resolve(__dirname, "../app/browser-runtime-loader.js")));
      return;
    }
    const route = routes[request.url];
    if (!route) { reply.writeHead(404); reply.end(); return; }
    const [bytes, encoding] = route;
    if (encoding) {
      const compressed = zlib.gzipSync(bytes);
      reply.writeHead(200, {
        "Content-Encoding": encoding,
        "Content-Length": compressed.length,
        "Content-Type": "application/octet-stream"
      });
      reply.end(compressed);
    } else {
      reply.writeHead(200, { "Content-Type": "application/octet-stream" });
      reply.write(bytes.subarray(0, 4));
      reply.end(bytes.subarray(4));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  });
  return "http://127.0.0.1:" + server.address().port;
}

test("native fetch enforces decoded bounds for gzip and chunked HTTP", { timeout: 10000 }, async t => {
  const base = await fixtureServer(t);
  const load = (manifestRoute, wasmRoute) => loader.load({
    manifestUrl: base + manifestRoute, wasmUrl: base + wasmRoute, fetchFunction: fetch
  });
  assert.deepEqual(new Uint8Array((await load("/manifest", "/wasm")).wasmBytes), wasm);
  await assert.rejects(load("/manifest-overflow", "/wasm"),
    error => error.code === "browser-runtime-manifest-fetch");
  await assert.rejects(load("/manifest", "/wasm-overflow"),
    error => error.code === "browser-runtime-wasm-fetch");
  await assert.rejects(load("/manifest", "/wasm-truncated"),
    error => error.code === "browser-runtime-wasm-identity");
});

test("installed browser enforces streamed runtime byte bounds", { timeout: 30000 }, async t => {
  const { chromium } = require("@playwright/test");
  const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
    require("../tools/canonical-operation-scratch.js");
  const base = await fixtureServer(t);
  const owned = createOwnedTemporaryDirectory({
    temporaryParent: path.resolve(__dirname, "../../artifacts/tests/runtime-loader-browser")
  });
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(owned.rootPath, "profile"), {
      channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
      headless: true
    });
    const page = await context.newPage();
    await page.goto(base);
    await page.addScriptTag({ url: base + "/loader.js" });
    const result = await page.evaluate(async () => {
      const load = async (manifestUrl, wasmUrl) => {
        try {
          const result = await globalThis.TinyRustLMBrowserRuntimeLoader.load({
            manifestUrl, wasmUrl, fetchFunction: fetch.bind(globalThis)
          });
          return { bytes: Array.from(new Uint8Array(result.wasmBytes)) };
        } catch (error) { return { error: error.code }; }
      };
      return [
        await load("/manifest", "/wasm"),
        await load("/manifest-overflow", "/wasm"),
        await load("/manifest", "/wasm-overflow"),
        await load("/manifest", "/wasm-truncated")
      ];
    });
    assert.deepEqual(result, [
      { bytes: Array.from(wasm) },
      { error: "browser-runtime-manifest-fetch" },
      { error: "browser-runtime-wasm-fetch" },
      { error: "browser-runtime-wasm-identity" }
    ]);
  } finally {
    if (context) await context.close();
    removeOwnedTemporaryDirectory(owned);
  }
});
