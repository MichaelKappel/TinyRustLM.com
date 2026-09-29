"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("@playwright/test");
const { startSourceServer } = require("../tools/static-server.js");
const { declaredCatalogMetadata } = require("../tools/web-release-browser-smoke.js");
const scratch = require("../tools/canonical-operation-scratch.js");

/** A fresh browser process must reopen the real shell/runtime offline without caching live authorities. */
test("installed public app and verified WASM reopen offline while catalogs remain live-only", { timeout: 90000 }, async () => {
  const owned = scratch.createOwnedTemporaryDirectory({
    temporaryParent: path.resolve(__dirname, "../../artifacts/tests/offline-browser")
  });
  const metadata = declaredCatalogMetadata();
  const catalog = JSON.parse(metadata[0].body);
  let server;
  let browser;
  let closed = true;
  try {
    server = await startSourceServer({ siteRoot: path.resolve(__dirname, ".."), port: 0 });
    const options = { headless: true,
      channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
      args: ["--disable-background-networking"],
      viewport: { width: 1280, height: 800 } };
    browser = await chromium.launchPersistentContext(path.join(owned.rootPath, "control"), {
      ...options, serviceWorkers: "block"
    });
    closed = false;
    await browser.route("**/*", route => {
      const fixture = metadata.find(entry => entry.url === route.request().url());
      if (fixture) return route.fulfill({ contentType: "application/json", body: fixture.body });
      return new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort();
    });
    const control = await browser.newPage();
    await control.goto(server.origin, { waitUntil: "domcontentloaded" });
    assert.equal((await control.evaluate(probeRuntime, catalog)).workerState, "empty");
    await browser.close();
    closed = true;
    browser = await chromium.launchPersistentContext(path.join(owned.rootPath, "profile"), options);
    closed = false;
    await browser.route("**/*", route => {
      const fixture = metadata.find(entry => entry.url === route.request().url());
      if (fixture) return route.fulfill({ contentType: "application/json", body: fixture.body });
      return new URL(route.request().url()).origin === server.origin
        ? route.continue() : route.abort("blockedbyclient");
    });
    const initial = await browser.newPage();
    const onlineEvents = [];
    initial.on("console", message => onlineEvents.push({ type: message.type(), text: message.text().slice(0, 250) }));
    initial.on("pageerror", error => onlineEvents.push({ error: error.message }));
    initial.on("requestfailed", request => onlineEvents.push({ path: new URL(request.url()).pathname, failure: request.failure() }));
    initial.on("response", response => {
      if (new URL(response.url()).pathname.endsWith("model-runtime-worker.js")) {
        onlineEvents.push({ response: response.url(), status: response.status(), cached: response.fromServiceWorker(), headers: response.headers() });
      }
    });
    initial.on("worker", worker => {
      worker.evaluate(() => ({ onmessage: typeof self.onmessage, postMessage: typeof self.postMessage,
        document: typeof self.document, importScripts: "importScripts" in self,
        secure: self.isSecureContext })).then(value => onlineEvents.push({ workerScope: value }))
        .catch(error => onlineEvents.push({ workerScopeError: error.message.slice(0, 250) }));
    });
    await initial.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.workerAudit = [];
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          window.workerAudit.push({ kind: "created", url: String(args[0]) });
          const send = this.postMessage.bind(this);
          this.postMessage = (...values) => {
            window.workerAudit.push({ kind: "command", command: values[0]?.kind });
            return send(...values);
          };
          this.addEventListener("message", event => window.workerAudit.push({ kind: "message", data: event.data }));
          this.addEventListener("error", event => window.workerAudit.push({ kind: "error", message: event.message }));
        }
      };
    });
    await initial.goto(server.origin, { waitUntil: "domcontentloaded" });
    await initial.waitForFunction(() => navigator.serviceWorker.controller !== null,
      undefined, { timeout: 30000 });
    const before = await initial.evaluate(async () => {
      const cacheNames = (await caches.keys()).filter(name => name.startsWith("tinyrustlm-static-v1-"));
      const keys = await (await caches.open(cacheNames[0])).keys();
      return { cacheNames, paths: keys.map(key => new URL(key.url).pathname).sort() };
    });
    assert.equal(before.cacheNames.length, 1);
    assert.ok(before.paths.includes("/index.html"));
    assert.ok(before.paths.includes("/app/model-runtime-worker.js"));
    assert.ok(before.paths.includes("/browser-runtime/tinyrustlm-browser-runtime.wasm"));
    assert.equal(before.paths.some(value => /^\/catalog\/|\.slm2$|\/admission\.json$|\/qualification\.json$|\.uai(?:\/|$)/.test(value)), false);
    const onlineProbe = await initial.evaluate(probeRuntime, catalog).catch(async error => {
      throw new Error(`${error.message}\nOnline observations: ${JSON.stringify({ onlineEvents,
        worker: await initial.evaluate(() => window.workerAudit) })}`);
    });
    assert.equal(onlineProbe.workerState, "empty");
    await browser.close();
    closed = true;

    browser = await chromium.launchPersistentContext(path.join(owned.rootPath, "profile"), options);
    closed = false;
    await browser.setOffline(true);
    const page = await browser.newPage();
    const pageErrors = [];
    const runtimeEvents = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => runtimeEvents.push({ type: message.type(), text: message.text().slice(0, 250) }));
    page.on("requestfailed", request => runtimeEvents.push({ path: new URL(request.url()).pathname, failure: request.failure() }));
    await page.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("main.app-shell").count(), 1);
    async function probeRuntime(storedCatalog) {
      const loaded = await window.TinyRustLMBrowserRuntimeLoader.load({
        manifestUrl: "/browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json",
        wasmUrl: "/browser-runtime/tinyrustlm-browser-runtime.wasm",
        fetchFunction: window.fetch.bind(window)
      });
      const wasmValid = WebAssembly.validate(loaded.wasmBytes);
      const bytes = loaded.wasmBytes.byteLength;
      const client = window.TinyRustLMModelRuntimeClient.createBrowserClient("./model-runtime-worker.js", 10000);
      let workerState;
      try {
        const result = await client.initialize({ operationId: "a".repeat(64), compositionId: "b".repeat(64),
          wasmBytes: loaded.wasmBytes, wasmSha256: loaded.manifest.sha256, transcriptRevision: 1n,
          policy: { maximumModelBytes: 2 * 1024 * 1024, maximumSequenceTokens: 128,
            maximumKvBytes: 1024 * 1024, maximumScratchBytes: 16 * 1024 * 1024,
            // The resolved ceiling includes the model plus all resident dependencies.
            maximumResolvedMemberBytes: 18 * 1024 * 1024, maximumResidentDependencyBytes: 16 * 1024 * 1024,
            maximumRequestBytes: 1054848, maximumLinearMemoryBytes: loaded.manifest.maximumMemoryBytes } });
        workerState = result.state;
        await client.release();
      } finally { client.terminate("offline-test-complete"); }
      let staleRejected = false;
      try {
        window.TinyRustLMMiniModelCatalogV1.validateCatalog(storedCatalog, {
          now: new Date(Date.parse(storedCatalog.generated_at_utc) + 25 * 60 * 60 * 1000)
        });
      } catch (error) { staleRejected = error.code === "freshness"; }
      let metadataUnavailable = false;
      try { await fetch("https://minimodel.org/catalog/compositions.v1.json"); }
      catch (_) { metadataUnavailable = true; }
      return { wasmValid, workerState,
        bytes, expectedBytes: loaded.manifest.byteCount,
        staleRejected, metadataUnavailable,
        controlled: navigator.serviceWorker.controller !== null,
        cacheNames: (await caches.keys()).filter(name => name.startsWith("tinyrustlm-static-v1-")) };
    }
    const actual = await page.evaluate(probeRuntime, catalog).catch(error => {
      throw new Error(`${error.message}\nObserved browser errors: ${JSON.stringify({ pageErrors, runtimeEvents })}`);
    });
    assert.equal(actual.wasmValid, true);
    assert.equal(actual.workerState, "empty");
    assert.equal(actual.bytes, actual.expectedBytes);
    assert.ok(actual.bytes > 8);
    assert.equal(actual.staleRejected, true);
    assert.equal(actual.metadataUnavailable, true);
    assert.equal(actual.controlled, true);
    assert.deepEqual(actual.cacheNames, before.cacheNames);
    assert.deepEqual(pageErrors, []);
    // The alternate application shell uses the same fixed public closure.
    await page.goto(`${server.origin}/app/`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("main.app-shell").count(), 1);
  } finally {
    if (browser && !closed) { await browser.close(); closed = true; }
    if (server) await server.close();
    if (closed) scratch.removeOwnedTemporaryDirectory(owned);
  }
});
