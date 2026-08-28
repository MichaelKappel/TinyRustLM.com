"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("../tools/owned-browser-profile.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const workerPath = path.join(
  repositoryRoot,
  "tinyrustlm",
  "app",
  "model-runtime-worker.js"
);
const manifestPath = path.join(
  repositoryRoot,
  "rust",
  "crates",
  "tinyrustlm-browser-runtime-wasm",
  "Cargo.toml"
);
const targetRoot = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
  "model-runtime-worker-browser"
);
const wasmPath = path.join(
  targetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_browser_runtime_wasm.wasm"
);
let compiledWasm;

function cargoExecutable() {
  if (process.env.CARGO) return process.env.CARGO;
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

function buildWasm() {
  if (compiledWasm) return compiledWasm;
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build",
    "--manifest-path",
    manifestPath,
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--target-dir",
    targetRoot,
    "--locked",
    "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  compiledWasm = fs.readFileSync(wasmPath);
  assert.ok(compiledWasm.length > 0 && compiledWasm.length <= 16 * 1024 * 1024);
  return compiledWasm;
}

function id(label) {
  return crypto.createHash("sha256").update(label, "utf8").digest("hex");
}

async function startServer(workerSource, wasm) {
  const html = Buffer.from(
    "<!doctype html><meta charset=\"utf-8\"><link rel=\"icon\" href=\"data:,\"><title>Worker</title>",
    "utf8"
  );
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const routes = {
      "/": { bytes: html, type: "text/html; charset=utf-8" },
      "/model-runtime-worker.js": {
        bytes: Buffer.from(workerSource, "utf8"),
        type: "text/javascript; charset=utf-8"
      },
      "/runtime.wasm": { bytes: wasm, type: "application/wasm" }
    };
    const route = routes[pathname];
    if (!route || request.method !== "GET") {
      response.writeHead(404, { "Content-Length": "0" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": String(route.bytes.length),
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src data:",
      "Content-Type": route.type,
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(route.bytes);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

test("delivers success and terminal rejection in two deleted Chromium profiles", {
  timeout: 180_000
}, async () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-model-runtime-worker-parent-")
  );
  const root = createOwnedProfileRoot({
    parentDirectory: parent,
    campaignId: "model-runtime-worker-browser-boundary"
  });
  const workerSource = fs.readFileSync(workerPath, "utf8");
  const wasm = buildWasm();
  const wasmSha256 = crypto.createHash("sha256").update(wasm).digest("hex");
  const { server, origin } = await startServer(workerSource, wasm);
  const deletions = [];

  try {
    for (let round = 1; round <= 2; round += 1) {
      const ownedProfile = createOwnedBrowserProfile(root, {
        round,
        role: "model-runtime-worker-boundary"
      });
      assert.equal(assertOwnedProfileFresh(root, ownedProfile), true);
      let context;
      try {
        context = await chromium.launchPersistentContext(ownedProfile.profilePath, {
          headless: true,
          locale: "en-US",
          acceptDownloads: false,
          permissions: [],
          serviceWorkers: "block",
          viewport: { width: 960, height: 720 },
          args: [
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--no-default-browser-check",
            "--no-first-run"
          ]
        });
        const page = context.pages()[0] || await context.newPage();
        const requests = [];
        const consoleErrors = [];
        const pageErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.name));
        page.on("request", (request) => requests.push(request.url()));
        await page.goto(origin, { waitUntil: "domcontentloaded" });

        const observed = await page.evaluate(async (input) => {
          const response = await fetch("/runtime.wasm", { cache: "no-store" });
          if (!response.ok) throw new Error("runtime-wasm-read");
          const moduleBytes = new Uint8Array(await response.arrayBuffer());
          const worker = new Worker("/model-runtime-worker.js");
          const common = {
            schema: "tinyrustlm.model-runtime-worker/1",
            workerId: input.workerId,
            operationId: input.operationId,
            compositionId: input.compositionId,
            conversationId: input.conversationId,
            turnId: input.turnId,
            generationId: input.generationId
          };
          const initialize = {
            ...common,
            messageId: input.initializeMessageId,
            sequence: 0,
            kind: "initialize",
            payload: {
              wasmBytes: moduleBytes.buffer,
              wasmSha256: input.wasmSha256,
              maximumModelBytes: 1048576,
              maximumSequenceTokens: 128,
              maximumKvBytes: 1048576,
              maximumScratchBytes: 1048576,
              maximumResolvedMemberBytes: 2097152,
              maximumResidentDependencyBytes: 1048576,
              maximumRequestBytes: 1048576,
              maximumLinearMemoryBytes: 8388608,
              transcriptRevisionLow: 2309737967,
              transcriptRevisionHigh: 4275878552
            }
          };
          const events = [];
          let detached = false;
          let completedNormally = false;
          try {
            const completed = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error("worker-timeout")), 30000);
              worker.onerror = (event) => {
                clearTimeout(timeout);
                reject(new Error(`worker-error:${event.message}`));
              };
              worker.onmessage = (event) => {
                events.push(event.data);
                if (event.data.kind === "command-rejected") {
                  clearTimeout(timeout);
                  reject(new Error(`worker-rejected:${JSON.stringify(event.data.payload)}`));
                  return;
                }
                if (event.data.kind === "runtime-ready") {
                  worker.postMessage({
                    ...common,
                    messageId: input.releaseMessageId,
                    sequence: 1,
                    kind: "release",
                    payload: {}
                  });
                  return;
                }
                if (event.data.kind === "runtime-released") {
                  clearTimeout(timeout);
                  resolve();
                }
              };
              worker.postMessage(initialize, [moduleBytes.buffer]);
              detached = moduleBytes.byteLength === 0 && moduleBytes.buffer.byteLength === 0;
            });
            await completed;
            completedNormally = true;
            return { detached, events };
          } finally {
            if (!completedNormally) worker.terminate();
          }
        }, {
          wasmSha256,
          workerId: id(`browser-worker-${round}`),
          operationId: id(`browser-operation-${round}`),
          compositionId: id(`browser-composition-${round}`),
          conversationId: id(`browser-conversation-${round}`),
          turnId: id(`browser-turn-${round}`),
          generationId: id(`browser-generation-${round}`),
          initializeMessageId: id(`browser-initialize-message-${round}`),
          releaseMessageId: id(`browser-release-message-${round}`)
        });

        assert.equal(observed.detached, true);
        assert.deepEqual(observed.events.map((entry) => entry.kind),
          ["runtime-ready", "runtime-released"]);
        assert.deepEqual(observed.events.map((entry) => entry.sequence), [0, 1]);
        assert.equal(observed.events[0].payload.state.transcriptRevisionLow, 0x89abcdef);
        assert.equal(observed.events[0].payload.state.transcriptRevisionHigh, 0xfedcba98);
        assert.equal(Object.hasOwn(observed.events[0].payload.state,
          "transcriptRevision"), false);
        assert.notEqual(observed.events[0].messageId, observed.events[1].messageId);
        for (let attempt = 0; attempt < 100 && page.workers().length !== 0; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(page.workers().length, 0);

        const rejected = await page.evaluate(async (input) => {
          const response = await fetch("/runtime.wasm", { cache: "no-store" });
          if (!response.ok) throw new Error("runtime-wasm-read");
          const moduleBytes = new Uint8Array(await response.arrayBuffer());
          const worker = new Worker("/model-runtime-worker.js");
          const initialize = {
            schema: "tinyrustlm.model-runtime-worker/1",
            workerId: input.workerId,
            operationId: input.operationId,
            compositionId: input.compositionId,
            conversationId: input.conversationId,
            turnId: input.turnId,
            generationId: input.generationId,
            messageId: input.messageId,
            sequence: 0,
            kind: "initialize",
            payload: {
              wasmBytes: moduleBytes.buffer,
              wasmSha256: input.invalidWasmSha256,
              maximumModelBytes: 1048576,
              maximumSequenceTokens: 128,
              maximumKvBytes: 1048576,
              maximumScratchBytes: 1048576,
              maximumResolvedMemberBytes: 2097152,
              maximumResidentDependencyBytes: 1048576,
              maximumRequestBytes: 1048576,
              maximumLinearMemoryBytes: 8388608,
              transcriptRevisionLow: 0,
              transcriptRevisionHigh: 0
            }
          };
          let terminalEventObserved = false;
          try {
            const event = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error("worker-timeout")), 30000);
              worker.onerror = (value) => {
                clearTimeout(timeout);
                reject(new Error(`worker-error:${value.message}`));
              };
              worker.onmessage = (value) => {
                clearTimeout(timeout);
                if (!value.data || value.data.kind !== "command-rejected") {
                  reject(new Error("worker-unexpected-event"));
                  return;
                }
                resolve(value.data);
              };
              worker.postMessage(initialize, [moduleBytes.buffer]);
            });
            terminalEventObserved = true;
            return {
              detached: moduleBytes.byteLength === 0 && moduleBytes.buffer.byteLength === 0,
              event
            };
          } finally {
            if (!terminalEventObserved) worker.terminate();
          }
        }, {
          invalidWasmSha256: id(`browser-invalid-wasm-${round}`),
          workerId: id(`browser-rejected-worker-${round}`),
          operationId: id(`browser-rejected-operation-${round}`),
          compositionId: id(`browser-rejected-composition-${round}`),
          conversationId: id(`browser-rejected-conversation-${round}`),
          turnId: id(`browser-rejected-turn-${round}`),
          generationId: id(`browser-rejected-generation-${round}`),
          messageId: id(`browser-rejected-message-${round}`)
        });
        assert.equal(rejected.detached, true);
        assert.equal(rejected.event.sequence, 0);
        assert.equal(rejected.event.payload.status, 1);
        assert.equal(rejected.event.payload.code, "model-runtime-worker-wasm-sha256");
        assert.equal(rejected.event.payload.workerTerminated, true);
        for (let attempt = 0; attempt < 100 && page.workers().length !== 0; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(page.workers().length, 0);
        assert.deepEqual(requests.map((value) => new URL(value).pathname).sort(),
          [
            "/",
            "/model-runtime-worker.js",
            "/model-runtime-worker.js",
            "/runtime.wasm",
            "/runtime.wasm"
          ]);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(pageErrors, []);
      } finally {
        if (context) await context.close();
        const deletion = deleteOwnedBrowserProfile(root, ownedProfile);
        deletions.push(deletion);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(removeOwnedProfileRoot(root), true);
    fs.rmdirSync(parent);
  }

  assert.equal(deletions.length, 2);
  for (let index = 0; index < deletions.length; index += 1) {
    const deletion = deletions[index];
    assert.deepEqual(Object.keys(deletion).sort(), [
      "campaignId",
      "deleted",
      "profileMarkerHash",
      "role",
      "rootMarkerHash",
      "round",
      "schema",
      "verifiedAtUtc"
    ]);
    assert.equal(deletion.schema, "tinyrustlm.browser_profile_deletion.v1");
    assert.equal(deletion.campaignId, "model-runtime-worker-browser-boundary");
    assert.equal(deletion.round, index + 1);
    assert.equal(deletion.role, "model-runtime-worker-boundary");
    assert.match(deletion.rootMarkerHash, /^[0-9a-f]{64}$/u);
    assert.match(deletion.profileMarkerHash, /^[0-9a-f]{64}$/u);
    assert.equal(deletion.deleted, true);
    assert.equal(Number.isNaN(Date.parse(deletion.verifiedAtUtc)), false);
  }
  assert.equal(new Set(deletions.map((entry) => entry.profileMarkerHash)).size, 2);
});
