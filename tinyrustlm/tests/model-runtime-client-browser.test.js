"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
const { createOwnedBrowserProfile, removeOwnedBrowserProfile } = require("../e2e/owned-browser-profile.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const clientPath = path.join(
  repositoryRoot,
  "tinyrustlm",
  "app",
  "model-runtime-client.js"
);
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
  "model-runtime-client-browser"
);
const wasmPath = path.join(
  targetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_browser_runtime_wasm.wasm"
);
let compiledWasm;

/** Resolve the installed Rust toolchain without changing process-wide PATH. */
function cargoExecutable() {
  if (process.env.CARGO) return process.env.CARGO;
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

/** Compile the canonical Rust crate once into the owning repository target directory. */
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

/** Derive distinct synthetic operation identities for isolated browser rounds. */
function id(label) {
  return crypto.createHash("sha256").update(label, "utf8").digest("hex");
}

/** Serve in-memory canonical source and compiled WASM over an owned loopback listener. */
async function startServer(clientSource, workerSource, wasm) {
  const html = Buffer.from(
    "<!doctype html><meta charset=\"utf-8\"><link rel=\"icon\" href=\"data:,\"><title>Client</title><script src=\"/app/model-runtime-client.js\"></script>",
    "utf8"
  );
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const routes = {
      "/": { bytes: html, type: "text/html; charset=utf-8" },
      "/app/model-runtime-client.js": {
        bytes: Buffer.from(clientSource, "utf8"),
        type: "text/javascript; charset=utf-8"
      },
      "/app/model-runtime-worker.js": {
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

test("browser client initializes and releases through the real worker in two deleted Chromium profiles", {
  timeout: 180_000
}, async () => {
  const clientSource = fs.readFileSync(clientPath, "utf8");
  const workerSource = fs.readFileSync(workerPath, "utf8");
  const wasm = buildWasm();
  const wasmSha256 = crypto.createHash("sha256").update(wasm).digest("hex");
  let server;
  const deletions = [];

  try {
    const started = await startServer(clientSource, workerSource, wasm);
    server = started.server;
    const origin = started.origin;
    for (let round = 1; round <= 2; round += 1) {
      const profilePath = createOwnedBrowserProfile("runtime-client");
      let context;
      try {
        context = await chromium.launchPersistentContext(profilePath, {
          channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
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
          const wasmBytes = await response.arrayBuffer();
          const api = globalThis.TinyRustLMModelRuntimeClient;
          if (!api || typeof api.createBrowserClient !== "function") {
            throw new Error("runtime-client-unavailable");
          }
          const client = api.createBrowserClient("./model-runtime-worker.js", 30000);
          try {
            const state = await client.initialize({
              operationId: input.operationId,
              compositionId: input.compositionId,
              wasmBytes,
              wasmSha256: input.wasmSha256,
              policy: {
                maximumModelBytes: 1048576,
                maximumSequenceTokens: 128,
                maximumKvBytes: 1048576,
                maximumScratchBytes: 1048576,
                maximumResolvedMemberBytes: 2097152,
                maximumResidentDependencyBytes: 1048576,
                maximumRequestBytes: 1048576,
                maximumLinearMemoryBytes: 8388608
              },
              transcriptRevision: 0
            });
            const released = await client.release();
            return {
              state: state.state,
              operationId: state.operationId,
              released,
              status: client.status
            };
          } finally {
            client.terminate("model-runtime-client-browser-test-complete");
          }
        }, {
          wasmSha256,
          operationId: id(`browser-client-operation-${round}`),
          compositionId: id(`browser-client-composition-${round}`)
        });
        assert.deepEqual(observed, {
          state: "empty",
          operationId: id(`browser-client-operation-${round}`),
          released: true,
          status: "terminated"
        });
        for (let attempt = 0; attempt < 100 && page.workers().length !== 0; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(page.workers().length, 0);
        assert.deepEqual(requests.map((value) => new URL(value).pathname).sort(), [
          "/",
          "/app/model-runtime-client.js",
          "/app/model-runtime-worker.js",
          "/runtime.wasm"
        ]);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(pageErrors, []);
      } finally {
        if (context) await context.close();
        removeOwnedBrowserProfile(profilePath);
        deletions.push({ round, profilePath, deleted: !fs.existsSync(profilePath) });
      }
    }
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }

  assert.deepEqual(deletions.map(({ round, deleted }) => ({ round, deleted })),
    [{ round: 1, deleted: true }, { round: 2, deleted: true }]);
  assert.equal(new Set(deletions.map((entry) => entry.profilePath)).size, 2);
});
