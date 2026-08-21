"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
const { parseStrictJson } = require("../tools/strict-json.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const crateSourcePath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-slm2-runtime-wasm-conformance/src/lib.rs"
);
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/slm2-runtime-vectors.v1.json"
);
const wasmPath = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_slm2_runtime_wasm_conformance.wasm"
);
const requiredFunctionExports = [
  "trlm_slm2_conformance_abi_version",
  "trlm_slm2_conformance_clear",
  "trlm_slm2_conformance_error_len",
  "trlm_slm2_conformance_error_ptr",
  "trlm_slm2_conformance_forward",
  "trlm_slm2_conformance_greedy_token",
  "trlm_slm2_conformance_kv_bytes",
  "trlm_slm2_conformance_logits_len",
  "trlm_slm2_conformance_logits_ptr",
  "trlm_slm2_conformance_position",
  "trlm_slm2_conformance_reset"
];

let compiledWasm;

function cargoExecutable() {
  if (process.env.CARGO) return process.env.CARGO;
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo/bin/cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

function buildWasm() {
  if (compiledWasm) return compiledWasm;
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build",
    "-p",
    "tinyrustlm-slm2-runtime-wasm-conformance",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
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
  assert.ok(compiledWasm.length > 0 && compiledWasm.length <= 1_048_576);
  return compiledWasm;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function exportedBytes(instance, pointerName, lengthName) {
  const length = instance.exports[lengthName]() >>> 0;
  if (length === 0) return Buffer.alloc(0);
  const pointer = instance.exports[pointerName]() >>> 0;
  assert.notEqual(pointer, 0);
  return Buffer.from(new Uint8Array(instance.exports.memory.buffer, pointer, length));
}

function logits(instance) {
  const bytes = exportedBytes(
    instance,
    "trlm_slm2_conformance_logits_ptr",
    "trlm_slm2_conformance_logits_len"
  );
  assert.equal(bytes.length % 4, 0);
  return Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readFloatLE(index * 4));
}

function errorCode(instance) {
  return exportedBytes(
    instance,
    "trlm_slm2_conformance_error_ptr",
    "trlm_slm2_conformance_error_len"
  ).toString("ascii");
}

function close(actual, expected, tolerance) {
  const difference = Math.abs(actual - expected);
  const relative = tolerance.relative * Math.max(Math.abs(actual), Math.abs(expected));
  return difference <= Math.max(tolerance.absolute, relative);
}

function assertLogits(actual, expected, tolerance, context) {
  assert.equal(actual.length, expected.length, context);
  actual.forEach((value, index) => {
    assert.ok(close(value, expected[index], tolerance),
      `${context} logit ${index}: actual=${value} expected=${expected[index]}`);
  });
}

function replayNode(instance, vectors) {
  let observedSteps = 0;
  for (const sequence of vectors.sequences) {
    assert.equal(instance.exports.trlm_slm2_conformance_reset(sequence.steps.length), 0);
    sequence.steps.forEach((step, index) => {
      assert.equal(instance.exports.trlm_slm2_conformance_forward(step.tokenId), 0);
      assertLogits(logits(instance), step.logits.values, vectors.numericalTolerance,
        `${sequence.id} step ${index}`);
      assert.equal(instance.exports.trlm_slm2_conformance_position(), step.positionAfter);
      assert.equal(Number(instance.exports.trlm_slm2_conformance_kv_bytes()),
        step.committedKvBytes);
      assert.equal(instance.exports.trlm_slm2_conformance_greedy_token(), step.greedyToken);
      observedSteps += 1;
    });
    assert.equal(instance.exports.trlm_slm2_conformance_clear(), 0);
  }
  return observedSteps;
}

test("builds one import-free bounded WASM module without executable unsafe Rust", async () => {
  const source = fs.readFileSync(crateSourcePath, "utf8");
  assert.equal((source.match(/#\[no_mangle\]/gu) ?? []).length, 11);
  assert.equal((source.match(/#\[allow\(unsafe_code\)\]/gu) ?? []).length, 11);
  assert.doesNotMatch(source, /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b)/u);

  const bytes = buildWasm();
  const module = new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const exports = WebAssembly.Module.exports(module);
  assert.deepEqual(
    exports.filter((entry) => entry.kind === "function").map((entry) => entry.name).sort(),
    [...requiredFunctionExports].sort()
  );
  assert.ok(exports.some((entry) => entry.name === "memory" && entry.kind === "memory"));
  assert.match(sha256(bytes), /^[0-9a-f]{64}$/u);

  const { instance } = await WebAssembly.instantiate(bytes);
  assert.equal(instance.exports.trlm_slm2_conformance_abi_version(), 1);
});

test("replays independent scalar vectors in the Node WASM engine", async () => {
  const vectors = parseStrictJson(fs.readFileSync(vectorPath));
  const { instance } = await WebAssembly.instantiate(buildWasm());
  assert.equal(replayNode(instance, vectors), 6);

  assert.equal(instance.exports.trlm_slm2_conformance_forward(0), 1);
  assert.equal(errorCode(instance), "slm2-conformance-session-required");
  assert.equal(instance.exports.trlm_slm2_conformance_reset(0), 1);
  assert.equal(errorCode(instance), "slm2-conformance-sequence-limit");
  assert.equal(instance.exports.trlm_slm2_conformance_reset(1), 0);
  assert.equal(instance.exports.trlm_slm2_conformance_forward(32), 2);
  assert.equal(errorCode(instance), "slm2-runtime-token-range");
  assert.equal(instance.exports.trlm_slm2_conformance_position(), 0);
  assert.equal(instance.exports.trlm_slm2_conformance_forward(0), 0);
  assert.equal(instance.exports.trlm_slm2_conformance_forward(0), 2);
  assert.equal(errorCode(instance), "slm2-runtime-sequence-limit");
  assert.equal(instance.exports.trlm_slm2_conformance_position(), 1);
});

test("replays identical vectors inside real headless Chromium", async () => {
  const vectors = parseStrictJson(fs.readFileSync(vectorPath));
  const browser = await chromium.launch({ headless: true });
  const requests = [];
  try {
    const page = await browser.newPage();
    page.on("request", (request) => requests.push(request.url()));
    const result = await page.evaluate(async ({ base64, vectors: contract }) => {
      const binary = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const { instance } = await WebAssembly.instantiate(binary);
      const readLogits = () => {
        const length = instance.exports.trlm_slm2_conformance_logits_len() >>> 0;
        const pointer = instance.exports.trlm_slm2_conformance_logits_ptr() >>> 0;
        const view = new DataView(instance.exports.memory.buffer, pointer, length);
        return Array.from({ length: length / 4 }, (_, index) => view.getFloat32(index * 4, true));
      };
      const closeEnough = (actual, expected) => {
        const difference = Math.abs(actual - expected);
        const relative = contract.numericalTolerance.relative
          * Math.max(Math.abs(actual), Math.abs(expected));
        return difference <= Math.max(contract.numericalTolerance.absolute, relative);
      };
      let steps = 0;
      for (const sequence of contract.sequences) {
        if (instance.exports.trlm_slm2_conformance_reset(sequence.steps.length) !== 0) {
          throw new Error(`reset failed for ${sequence.id}`);
        }
        for (const expected of sequence.steps) {
          if (instance.exports.trlm_slm2_conformance_forward(expected.tokenId) !== 0) {
            throw new Error(`forward failed for ${sequence.id}`);
          }
          const actual = readLogits();
          if (actual.length !== expected.logits.values.length
              || actual.some((value, index) => !closeEnough(value, expected.logits.values[index]))) {
            throw new Error(`logit mismatch for ${sequence.id}`);
          }
          if (instance.exports.trlm_slm2_conformance_position() !== expected.positionAfter
              || Number(instance.exports.trlm_slm2_conformance_kv_bytes())
                !== expected.committedKvBytes
              || instance.exports.trlm_slm2_conformance_greedy_token() !== expected.greedyToken) {
            throw new Error(`state mismatch for ${sequence.id}`);
          }
          steps += 1;
        }
        instance.exports.trlm_slm2_conformance_clear();
      }
      return {
        abiVersion: instance.exports.trlm_slm2_conformance_abi_version(),
        moduleBytes: binary.length,
        steps
      };
    }, { base64: buildWasm().toString("base64"), vectors });
    assert.deepEqual(result, { abiVersion: 1, moduleBytes: buildWasm().length, steps: 6 });
    assert.deepEqual(requests, []);
  } finally {
    await browser.close();
  }
});
