"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
const { parseStrictJson } = require("../tools/strict-json.js");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("../tools/owned-browser-profile.js");
const tokenizer2Api = require("../tools/tokenizer2-wasm-adapter.js");
const {
  executeInPage
} = require("../tools/qwen-tokenizer2-browser-wasm-runner.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot, "contracts/vnext/tokenizer2-wasm-interface.v1.json"
);
const vectorPath = path.join(
  repositoryRoot, "contracts/vnext/tokenizer2-format-vectors.v1.json"
);
const adapterPath = path.join(
  repositoryRoot, "tinyrustlm/tools/tokenizer2-wasm-adapter.js"
);
const wasmManifestPath = path.join(
  repositoryRoot, "rust/crates/tinyrustlm-tokenizer2-wasm/Cargo.toml"
);
const cargoTargetRoot = resolveCargoTargetRoot(
  repositoryRoot, process.env.CARGO_TARGET_DIR
);
const wasmPath = path.join(
  cargoTargetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_tokenizer2_wasm.wasm"
);

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
    "--manifest-path",
    wasmManifestPath,
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--locked",
    "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, CARGO_TARGET_DIR: cargoTargetRoot },
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  compiledWasm = fs.readFileSync(wasmPath);
  assert.ok(compiledWasm.length > 0 &&
    compiledWasm.length <= tokenizer2Api.limits.maximumModuleBytes);
  return compiledWasm;
}

function fixture() {
  const vectors = parseStrictJson(fs.readFileSync(vectorPath));
  assert.equal(vectors.vectors.length, 1);
  const vector = vectors.vectors[0];
  return {
    artifact: Buffer.from(vector.artifactHex, "hex"),
    vector
  };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function moduleSurface(bytes) {
  const module = new WebAssembly.Module(bytes);
  return {
    imports: WebAssembly.Module.imports(module),
    functions: WebAssembly.Module.exports(module)
      .filter((entry) => entry.kind === "function")
      .map((entry) => entry.name)
      .sort(),
    nonFunctions: WebAssembly.Module.exports(module)
      .filter((entry) => entry.kind !== "function")
      .map((entry) => `${entry.kind}:${entry.name}`)
      .sort()
  };
}

test("freezes one current import-free bounded Tokenizer2 WASM profile", () => {
  const profile = parseStrictJson(fs.readFileSync(profilePath));
  assert.equal(profile.schema, "tinyrustlm.vnext.tokenizer2_wasm_interface.v1");
  assert.equal(profile.profileId, tokenizer2Api.profileId);
  assert.equal(profile.status, "frozen");
  assert.equal(profile.versionPolicy, "single-current-profile-clean-replacement");
  assert.equal(profile.abiVersion, tokenizer2Api.abiVersion);
  assert.deepEqual(profile.limits, tokenizer2Api.limits);
  assert.deepEqual(profile.decodeModes, tokenizer2Api.decodeModes);
  assert.deepEqual(profile.requiredImports, []);
  assert.deepEqual(profile.requiredFunctionExports, tokenizer2Api.requiredFunctionExports);
  assert.equal(profile.execution.bestOfN, false);
  assert.equal(profile.execution.repair, false);
  assert.equal(profile.execution.retrySelection, false);
  assert.equal(profile.security.legacyProfileFallback, "forbidden");

  const adapter = fs.readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(adapter, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/gu);
  assert.doesNotMatch(adapter, /legacy|fallbackProfile|compat(?:ibility)?/giu);
});

test("builds the exact no-import WASM surface without executable unsafe Rust", () => {
  const crateRoot = path.join(
    repositoryRoot, "rust/crates/tinyrustlm-tokenizer2-wasm/src"
  );
  for (const name of ["lib.rs", "boundary.rs", "exports.rs"]) {
    const source = fs.readFileSync(path.join(crateRoot, name), "utf8");
    assert.doesNotMatch(source, /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b)/u);
  }
  const bytes = buildWasm();
  const surface = moduleSurface(bytes);
  assert.deepEqual(surface.imports, []);
  assert.deepEqual(surface.functions, tokenizer2Api.requiredFunctionExports);
  assert.deepEqual(surface.nonFunctions,
    ["global:__data_end", "global:__heap_base", "memory:memory"]);
  assert.match(sha256(bytes), /^[a-f0-9]{64}$/u);
});

test("replays every miniature encoding through the Node WASM engine", async () => {
  const { artifact, vector } = fixture();
  const tokenizer = await tokenizer2Api.instantiateTokenizer2(buildWasm());
  const identity = tokenizer.load(artifact);
  assert.deepEqual(identity, {
    byteLength: vector.artifactByteLength,
    sha256: vector.artifactSha256,
    tokenCount: vector.header.tokenCount,
    baseTokenCount: vector.header.baseTokenCount
  });
  for (const entry of vector.encodingCases) {
    const input = Buffer.from(entry.inputUtf8Hex, "hex").toString("utf8");
    assert.deepEqual(Array.from(tokenizer.encode(input)), entry.expectedTokenIds, entry.id);
    const includeAll = tokenizer.decodeCurrent("include-all");
    const skipSpecial = tokenizer.decodeCurrent("skip-special");
    assert.equal(typeof includeAll, "string");
    assert.equal(typeof skipSpecial, "string");
  }
  tokenizer.reset();
  assert.throws(
    () => tokenizer.decodeCurrent("include-all"),
    (error) => error.code === "tokenizer2_wasm_tokens_required"
  );
  tokenizer.clear();
  assert.throws(
    () => tokenizer.encode("hello"),
    (error) => error.code === "tokenizer2_wasm_tokenizer_required"
  );
});

test("rejects malformed artifacts and preserves transactional activation", async () => {
  const { artifact, vector } = fixture();
  const tokenizer = await tokenizer2Api.instantiateTokenizer2(buildWasm());
  tokenizer.load(artifact);
  const wrongMagic = Buffer.from(artifact);
  wrongMagic[0] ^= 1;
  assert.throws(
    () => tokenizer.load(wrongMagic),
    (error) => error instanceof tokenizer2Api.Tokenizer2RuntimeError &&
      error.code === "tokenizer2-header"
  );
  assert.deepEqual(Array.from(tokenizer.encode("hello")),
    vector.encodingCases.find((entry) => entry.id === "ranked-bpe")
      .expectedTokenIds.slice(0, 1));
  assert.throws(
    () => tokenizer.load(artifact.subarray(0, 191)),
    (error) => error.code === "tokenizer2-file-size"
  );
  assert.throws(
    () => tokenizer.decodeCurrent("unknown"),
    (error) => error.code === "tokenizer2_wasm_decode_mode_invalid"
  );
});

test("runs the same miniature boundary in an owned fresh Chromium profile", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-tok2-wasm-parent-"));
  const root = createOwnedProfileRoot({
    parentDirectory: parent,
    campaignId: "tokenizer2-wasm-miniature-conformance"
  });
  const profile = createOwnedBrowserProfile(root, {
    round: 1,
    role: "miniature-tokenizer2-wasm"
  });
  assertOwnedProfileFresh(root, profile);
  let context;
  let deletion;
  try {
    context = await chromium.launchPersistentContext(profile.profilePath, {
      headless: true,
      locale: "en-US",
      acceptDownloads: false,
      permissions: [],
      serviceWorkers: "block",
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
    let requestCount = 0;
    await context.route("**/*", async (route) => {
      requestCount += 1;
      await route.abort("blockedbyclient");
    });
    const page = context.pages()[0] || await context.newPage();
    await page.setContent("<!doctype html><meta charset=\"utf-8\"><title>Tokenizer2</title>");
    await page.addScriptTag({ content: fs.readFileSync(adapterPath, "utf8") });
    const { artifact, vector } = fixture();
    const observed = await page.evaluate(async ({ moduleBase64, artifactBase64, cases }) => {
      const decode = (value) => Uint8Array.from(
        atob(value), (character) => character.charCodeAt(0)
      );
      const tokenizer = await globalThis.TinyRustLMTokenizer2.instantiateTokenizer2(
        decode(moduleBase64)
      );
      const beforeLoadBytes = tokenizer.memoryBytes();
      const identity = tokenizer.load(decode(artifactBase64));
      const afterLoadBytes = tokenizer.memoryBytes();
      const outputs = [];
      for (const entry of cases) {
        outputs.push({
          id: entry.id,
          tokenIds: Array.from(tokenizer.encode(entry.text)),
          includeAll: tokenizer.decodeCurrent("include-all"),
          skipSpecial: tokenizer.decodeCurrent("skip-special")
        });
      }
      tokenizer.clear();
      return { beforeLoadBytes, afterLoadBytes, identity, outputs };
    }, {
      moduleBase64: buildWasm().toString("base64"),
      artifactBase64: artifact.toString("base64"),
      cases: vector.encodingCases.map((entry) => ({
        id: entry.id,
        text: Buffer.from(entry.inputUtf8Hex, "hex").toString("utf8")
      }))
    });
    assert.deepEqual(observed.identity, {
      byteLength: vector.artifactByteLength,
      sha256: vector.artifactSha256,
      tokenCount: vector.header.tokenCount,
      baseTokenCount: vector.header.baseTokenCount
    });
    assert.equal(observed.outputs.length, vector.encodingCases.length);
    for (const [index, entry] of observed.outputs.entries()) {
      assert.equal(entry.id, vector.encodingCases[index].id);
      assert.deepEqual(entry.tokenIds, vector.encodingCases[index].expectedTokenIds);
    }
    assert.ok(observed.beforeLoadBytes > 0 &&
      observed.afterLoadBytes >= observed.beforeLoadBytes);
    const cases = vector.encodingCases.map((entry) => ({
      caseId: entry.id,
      text: Buffer.from(entry.inputUtf8Hex, "hex").toString("utf8")
    }));
    const recoveryCase = cases[0];
    const cancellationCase = cases.reduce((longest, entry) =>
      Buffer.byteLength(entry.text, "utf8") > Buffer.byteLength(longest.text, "utf8")
        ? entry : longest
    );
    const cancellationResult = await executeInPage(page, {
      wasm: { bytes: buildWasm() },
      artifact: { bytes: artifact },
      adapter: { bytes: fs.readFileSync(adapterPath) },
      corpus: { value: { cases } },
      cancellationCase,
      recoveryCase
    }, {
      execution: {
        browserOperationTimeoutMs: 120_000,
        workerLoadTimeoutMs: 60_000,
        workerCancellationIterations: 100_000,
        workerPostTerminationQuietMs: 100
      }
    }, true);
    assert.equal(cancellationResult.cancellation.startedRealWork, true);
    assert.equal(cancellationResult.cancellation.workerTerminated, true);
    assert.equal(cancellationResult.cancellation.completionObserved, false);
    assert.equal(cancellationResult.cancellation.recoveryCaseId, recoveryCase.caseId);
    assert.deepEqual(
      cancellationResult.cancellation.recoveryTokenIds,
      vector.encodingCases[0].expectedTokenIds
    );
    assert.equal(requestCount, 0);
  } finally {
    if (context) await context.close();
    deletion = deleteOwnedBrowserProfile(root, profile);
    assert.equal(removeOwnedProfileRoot(root), true);
    fs.rmdirSync(parent);
  }
  assert.equal(deletion.deleted, true);
});
