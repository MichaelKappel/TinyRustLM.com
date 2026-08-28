"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const loader = require("../app/browser-runtime-loader.js");
const artifactTool = require("../tools/browser-runtime-web-artifact.js");

let built;

function artifact() {
  built ||= artifactTool.createArtifact();
  return built;
}

test("tracked browser runtime exactly reproduces the locked offline release build", () => {
  const value = artifact();
  artifactTool.verifyArtifact(value);
  assert.equal(value.manifest.sha256,
    "0c96d3bde187faafa2f0e10f5cf5fe776cb4858a0ee3e00b3e9efff26eec0801");
  assert.equal(value.manifest.byteCount, 676916);
  assert.deepEqual(value.manifest.imports, []);
  assert.deepEqual(value.manifest.exports, loader.requiredExports);
});

test("canonical deployed manifest binds the worker, memory ceiling, bytes, and hash", () => {
  const bytes = fs.readFileSync(artifactTool.publicManifestPath);
  const parsed = loader.parseManifestBytes(bytes);
  assert.equal(parsed.schema, "tinyrustlm.browser-runtime-wasm-manifest/1");
  assert.equal(parsed.profileId, "tinyrustlm.browser-runtime-wasm/1");
  assert.equal(parsed.workerProtocol, "tinyrustlm.model-runtime-worker/1");
  assert.equal(parsed.maximumMemoryBytes, 3 * 1024 * 1024 * 1024);
  assert.equal(loader.serializeManifest(parsed), bytes.toString("utf8"));
});

test("manifest parser rejects noncanonical, permissive, and wrong-ABI declarations", () => {
  const value = artifact().manifest;
  assert.throws(
    () => loader.parseManifestBytes(Buffer.from(JSON.stringify(value, null, 2), "utf8")),
    (error) => error.code === "browser-runtime-manifest-canonical"
  );
  assert.throws(
    () => loader.normalizeManifest({ ...value, legacyRuntime: true }),
    (error) => error.code === "browser-runtime-manifest-fields"
  );
  assert.throws(
    () => loader.normalizeManifest({
      ...value,
      workerProtocol: "tinyrustlm.legacy-worker/1"
    }),
    (error) => error.code === "browser-runtime-manifest-worker"
  );
  assert.throws(
    () => loader.normalizeManifest({
      ...value,
      exports: value.exports.slice(0, -1)
    }),
    (error) => error.code === "browser-runtime-manifest-exports"
  );
});

test("loader verifies bytes without instantiating WASM in the top-window boundary", async () => {
  const value = artifact();
  const manifestUrl = "https://tinyrustlm.test/runtime/runtime.manifest.json";
  const wasmUrl = "https://tinyrustlm.test/runtime/runtime.wasm";
  const responses = new Map([
    [manifestUrl, value.manifestBytes],
    [wasmUrl, value.wasmBytes]
  ]);
  const calls = [];
  const result = await loader.load({
    manifestUrl,
    wasmUrl,
    async fetchFunction(url, options) {
      calls.push({ url, options });
      const bytes = responses.get(url);
      return {
        ok: Boolean(bytes),
        headers: { get: () => String(bytes.length) },
        async arrayBuffer() {
          return Uint8Array.from(bytes).buffer;
        }
      };
    }
  });
  assert.equal(result.manifest.sha256, value.manifest.sha256);
  assert.equal(result.wasmBytes.byteLength, value.wasmBytes.length);
  assert.deepEqual(calls.map((call) => call.options), [
    { cache: "no-store", credentials: "omit" },
    { cache: "no-store", credentials: "omit" }
  ]);
  assert.doesNotMatch(
    fs.readFileSync(require.resolve("../app/browser-runtime-loader.js"), "utf8"),
    /WebAssembly\.instantiate/u
  );
});

test("loader wipes and rejects a WASM identity mismatch", async () => {
  const value = artifact();
  const bad = Buffer.from(value.wasmBytes);
  bad[bad.length - 1] ^= 1;
  await assert.rejects(loader.load({
    manifestUrl: "manifest",
    wasmUrl: "wasm",
    async fetchFunction(url) {
      const bytes = url === "manifest" ? value.manifestBytes : bad;
      return {
        ok: true,
        headers: { get: () => String(bytes.length) },
        async arrayBuffer() {
          return Uint8Array.from(bytes).buffer;
        }
      };
    }
  }), (error) => error.code === "browser-runtime-wasm-identity");
});
