"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { chromium } = require("@playwright/test");
const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("./owned-browser-profile.js");
const {
  expectedModules,
  requiredExports,
  validateManifestFile
} = require("./vector-browser-wasm-preregistration-v2.js");
const { validatePreviousReceiptFile: validateParentReceiptFile } =
  require("./vector-retrieval-receipt.js");
const { readGitBlob } = require("./vector-historical-git-input.js");

const observationSchema = "tinyrustlm.exact_flat_browser_wasm_observation.v1";
const attemptSchema = "tinyrustlm.exact_flat_browser_wasm_attempt.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-observation-v1.json";
const observationPath = path.join(repositoryRoot, observationRelativePath);
const attemptRelativeDirectory =
  "tinyrustlm/experiments/vector-quantization/browser-wasm-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptRelativeDirectory);
const expectedExperimentId = "exact-flat-browser-wasm-direct-tests-20260722";
const maximumInputBytes = 16 * 1024 * 1024;
const maximumObservationBytes = 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const observationIdPattern = /^exact-flat-browser-wasm-[a-f0-9]{16}$/u;
const attemptIdPattern = /^exact-flat-browser-wasm-attempt-[a-f0-9]{16}$/u;
const forbiddenTextPattern =
  /(?:[a-z]:[\\/]|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|password=|turn\d+(?:search|view)\d+)/iu;
const safeVersionPattern = /^[A-Za-z0-9][A-Za-z0-9 ._()+:/-]{0,255}$/u;
const historicalInputCache = new Map();

const inputPaths = Object.freeze([
  "Cargo.lock",
  "Cargo.toml",
  "rust/experiments/tinyrustlm-vector-oracle/Cargo.toml",
  "rust/experiments/tinyrustlm-vector-oracle/src/accounting.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/bitpack.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/codebook.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/error.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/flat_index.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/metrics.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/prng.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/score.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/sha256.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/transform.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/flat_index_test.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/lib_test.rs",
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-preregistration.v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-preregistration.v2.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json",
  "tinyrustlm/package-lock.json",
  "tinyrustlm/package.json",
  "tinyrustlm/tests/campaign-evidence-store.test.js",
  "tinyrustlm/tests/durable-files.test.js",
  "tinyrustlm/tests/owned-browser-profile.test.js",
  "tinyrustlm/tests/vector-browser-wasm-observation.test.js",
  "tinyrustlm/tests/vector-browser-wasm-preregistration-v2.test.js",
  "tinyrustlm/tests/vector-browser-wasm-preregistration.test.js",
  "tinyrustlm/tests/vector-retrieval-receipt.test.js",
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  "tinyrustlm/tools/owned-browser-profile.js",
  "tinyrustlm/tools/vector-browser-wasm-observation.js",
  "tinyrustlm/tools/vector-browser-wasm-preregistration-v2.js",
  "tinyrustlm/tools/vector-browser-wasm-preregistration.js",
  "tinyrustlm/tools/vector-retrieval-receipt.js"
]);

const requiredGates = Object.freeze([
  Object.freeze({
    gateId: "browser-observation-preregistration-parent-and-evidence-tests",
    executable: "node",
    arguments: Object.freeze([
      "--test",
      "tinyrustlm/tests/campaign-evidence-store.test.js",
      "tinyrustlm/tests/durable-files.test.js",
      "tinyrustlm/tests/owned-browser-profile.test.js",
      "tinyrustlm/tests/vector-browser-wasm-observation.test.js",
      "tinyrustlm/tests/vector-browser-wasm-preregistration.test.js",
      "tinyrustlm/tests/vector-browser-wasm-preregistration-v2.test.js",
      "tinyrustlm/tests/vector-retrieval-receipt.test.js"
    ])
  }),
  Object.freeze({
    gateId: "exact-flat-native-tests",
    executable: "cargo",
    arguments: Object.freeze(["test", "-p", "tinyrustlm-vector-oracle"])
  }),
  Object.freeze({
    gateId: "exact-flat-strict-clippy",
    executable: "cargo",
    arguments: Object.freeze([
      "clippy", "-p", "tinyrustlm-vector-oracle", "--all-targets", "--", "-D", "warnings"
    ])
  }),
  Object.freeze({
    gateId: "exact-flat-rustdoc",
    executable: "cargo",
    arguments: Object.freeze(["doc", "-p", "tinyrustlm-vector-oracle", "--no-deps"])
  }),
  Object.freeze({
    gateId: "exact-flat-wasm-test-build",
    executable: "cargo",
    arguments: Object.freeze([
      "test", "-p", "tinyrustlm-vector-oracle", "--target", "wasm32-unknown-unknown",
      "--no-run"
    ])
  })
]);

const openPromotionGaps = Object.freeze([
  Object.freeze({
    gapId: "target-hardware-performance",
    status: "not-run",
    statement: "No preregistered named physical target has measured latency, throughput, peak memory, or energy."
  }),
  Object.freeze({
    gapId: "retrieval-corpus-quality-metrics",
    status: "not-run",
    statement: "No sealed representative corpus has measured recall, MRR, NDCG, or usefulness."
  }),
  Object.freeze({
    gapId: "durable-filesystem-deletion-proof",
    status: "not-run",
    statement: "No crash-recovered on-disk snapshot has proved deleted vector bytes absent after compaction."
  })
]);

const authority = Object.freeze({
  realBrowserWasmExecutionVerified: true,
  nativePerformanceMeasured: false,
  browserPerformanceMeasured: false,
  compressedRetrievalVerified: false,
  turboVecParityVerified: false,
  productIntegrationAuthorized: false,
  trainingAuthorized: false,
  releaseAuthorized: false
});

/** Throws a stable validation error when `condition` is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns whether `value` is a non-array JSON object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Requires exactly the declared object keys. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are invalid`);
}

/** Requires exact ordered JSON equality. */
function exactValue(value, expected, label) {
  invariant(JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`);
}

/** Computes lowercase SHA-256 for one byte buffer. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Streams one file into SHA-256 without loading large binaries at once. */
function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const hash = crypto.createHash("sha256");
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

/** Returns canonical checked-in JSON bytes for an observation or attempt. */
function canonicalPrettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Resolves a public command label to the local executable without persisting its path. */
function executablePath(label) {
  if (label === "cargo") {
    const configured = process.env.CARGO;
    if (configured) return configured;
    const local = process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
      : null;
    return local && fs.existsSync(local) ? local : "cargo";
  }
  if (label === "rustc") {
    const configured = process.env.RUSTC;
    if (configured) return configured;
    const local = process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cargo", "bin", "rustc.exe")
      : null;
    return local && fs.existsSync(local) ? local : "rustc";
  }
  if (label === "node") return process.execPath;
  return label;
}

/** Runs one bounded command and records only public-safe command evidence. */
function runGate(gate) {
  const result = childProcess.spawnSync(executablePath(gate.executable), gate.arguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  const output = Buffer.from(`${result.stdout || ""}\n${result.stderr || ""}`, "utf8");
  const evidence = Object.freeze({
    gateId: gate.gateId,
    executable: gate.executable,
    arguments: [...gate.arguments],
    exitCode: Number.isInteger(result.status) ? result.status : -1,
    outputSha256: sha256(output),
    spawnErrorCode: result.error && typeof result.error.code === "string"
      ? result.error.code.slice(0, 64)
      : null
  });
  invariant(evidence.exitCode === 0 && evidence.spawnErrorCode === null,
    `${gate.gateId} failed`);
  return evidence;
}

/** Returns one stable tool version line without local executable paths. */
function toolVersion(label, argumentsList = ["--version"]) {
  const result = childProcess.spawnSync(executablePath(label), argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  invariant(result.status === 0 && !result.error, `${label} version probe failed`);
  const line = String(result.stdout || result.stderr || "").trim().split(/\r?\n/u)[0];
  invariant(safeVersionPattern.test(line), `${label} version is not public-safe`);
  return line;
}

/** Resolves the actual toolchain binary used behind the rustup shim. */
function rustToolchainBinaryPath(label) {
  invariant(label === "cargo" || label === "rustc", "unsupported Rust tool label");
  const result = childProcess.spawnSync(executablePath("rustc"), ["--print", "sysroot"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  invariant(result.status === 0 && !result.error, "Rust sysroot probe failed");
  const sysroot = String(result.stdout || "").trim();
  invariant(path.isAbsolute(sysroot), "Rust sysroot is not absolute");
  const binaryName = process.platform === "win32" ? `${label}.exe` : label;
  return fs.realpathSync.native(path.join(sysroot, "bin", binaryName));
}

/** Returns a public-safe version and SHA-256 for the executable tool bytes. */
function toolIdentity(label) {
  const filePath = label === "node"
    ? fs.realpathSync.native(process.execPath)
    : rustToolchainBinaryPath(label);
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= 1024 * 1024 * 1024, `${label} executable is not a bounded regular file`);
  return Object.freeze({
    version: label === "node" ? process.version : toolVersion(label),
    sha256: sha256File(filePath)
  });
}

/** Hashes one bounded, regular, repository-relative receipt input. */
function hashInput(relativePath) {
  invariant(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(relativePath),
    `unsafe input path: ${relativePath}`);
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const relativeCheck = path.relative(repositoryRoot, absolutePath);
  invariant(relativeCheck !== "" && !relativeCheck.startsWith("..") &&
    !path.isAbsolute(relativeCheck), `input escaped repository root: ${relativePath}`);
  const stat = fs.lstatSync(absolutePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumInputBytes, `input is not a bounded regular file: ${relativePath}`);
  return Object.freeze({ path: relativePath, bytes: stat.size, sha256: sha256File(absolutePath) });
}

/** Hashes one receipt input exactly as committed at an immutable source revision. */
function hashInputAtRevision(relativePath, revision) {
  invariant(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(relativePath),
    `unsafe historical input path: ${relativePath}`);
  invariant(sourceRevisionPattern.test(revision), "historical input revision is invalid");
  const cacheKey = `${revision}:${relativePath}`;
  const cached = historicalInputCache.get(cacheKey);
  if (cached) return cached;
  const bytes = readGitBlob(
    repositoryRoot,
    revision,
    relativePath,
    maximumInputBytes
  );
  const input = Object.freeze({
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
  historicalInputCache.set(cacheKey, input);
  return input;
}

/** Requires every receipt input to be tracked and unchanged at the current commit. */
function assertInputsCommitted() {
  const tracked = childProcess.spawnSync("git", ["ls-files", "--error-unmatch", "--", ...inputPaths], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(tracked.status === 0 && !tracked.error, "browser observation inputs are not all tracked");
  const unchanged = childProcess.spawnSync("git", ["diff", "--quiet", "--", ...inputPaths], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(unchanged.status === 0 && !unchanged.error,
    "browser observation inputs differ from the current commit");
  const staged = childProcess.spawnSync(
    "git", ["diff", "--cached", "--quiet", "--", ...inputPaths], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      shell: false
    }
  );
  invariant(staged.status === 0 && !staged.error,
    "browser observation inputs are staged but not committed");
  const cratePrefix = "rust/experiments/tinyrustlm-vector-oracle/";
  const closure = childProcess.spawnSync("git", ["ls-files", "--", cratePrefix], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(closure.status === 0 && !closure.error,
    "vector-oracle source closure could not be enumerated");
  const trackedCrateInputs = String(closure.stdout || "").trim().split(/\r?\n/u)
    .filter(Boolean).sort();
  const boundCrateInputs = inputPaths.filter((entry) => entry.startsWith(cratePrefix)).sort();
  exactValue(trackedCrateInputs, boundCrateInputs, "vector-oracle source closure");
}

/** Returns the exact committed source revision used for this observation. */
function sourceRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "source revision probe failed");
  const revision = String(result.stdout || "").trim();
  invariant(sourceRevisionPattern.test(revision), "source revision is invalid");
  return revision;
}

/** Loads and validates one exact, import-free WASM test module. */
function moduleEvidence(roleSpec, wasmAbi) {
  const directory = path.join(repositoryRoot, "target", "wasm32-unknown-unknown", "debug", "deps");
  const pattern = roleSpec.filePattern;
  const separator = pattern.indexOf("*");
  invariant(separator > 0 && separator === pattern.lastIndexOf("*"),
    `invalid module file pattern for ${roleSpec.role}`);
  const prefix = pattern.slice(0, separator);
  const suffix = pattern.slice(separator + 1);
  const candidates = fs.readdirSync(directory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort();
  invariant(candidates.length === 1, `expected exactly one WASM module for ${roleSpec.role}`);
  const filePath = path.join(directory, candidates[0]);
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() &&
    stat.size >= wasmAbi.moduleMinimumBytes && stat.size <= wasmAbi.moduleMaximumBytes,
  `WASM module bytes are invalid for ${roleSpec.role}`);
  const bytes = fs.readFileSync(filePath);
  const module = new WebAssembly.Module(bytes);
  const exportsList = WebAssembly.Module.exports(module);
  const importsList = WebAssembly.Module.imports(module);
  exactValue(exportsList, wasmAbi.requiredExports, `${roleSpec.role} exports`);
  invariant(importsList.length === 0 && wasmAbi.importsAllowed === false,
    `${roleSpec.role} imports are not empty`);
  return Object.freeze({
    role: roleSpec.role,
    expectedTestCount: roleSpec.expectedTestCount,
    bytes: stat.size,
    sha256: sha256(bytes),
    exports: exportsList,
    imports: importsList,
    base64: bytes.toString("base64")
  });
}

/** Returns browser launch options that disable background and ambient network behavior. */
function browserLaunchOptions(executablePathValue, timeoutMs) {
  invariant(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10 * 60 * 1000,
    "browser timeout is invalid");
  return {
    executablePath: executablePathValue,
    timeout: timeoutMs,
    headless: true,
    viewport: { width: 960, height: 720 },
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
  };
}

/** Rejects a browser operation that exceeds the preregistered timeout. */
async function withTimeout(operation, timeoutMs) {
  let timer = null;
  try {
    return await Promise.race([
      operation,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("browser WASM operation timed out")), timeoutMs);
      })
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Executes one module inside the page's real WebAssembly runtime. */
async function executeModuleInPage(page, module, wasmAbi, timeoutMs) {
  return withTimeout(page.evaluate(async ({ base64, requiredExportsValue, requiredReturnCode }) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const compiled = await WebAssembly.compile(bytes);
    const exportsValue = WebAssembly.Module.exports(compiled);
    const importsValue = WebAssembly.Module.imports(compiled);
    if (JSON.stringify(exportsValue) !== JSON.stringify(requiredExportsValue)) {
      throw new Error("browser WASM export set changed");
    }
    if (importsValue.length !== 0) {
      throw new Error("browser WASM module unexpectedly imports functions or state");
    }
    const instance = await WebAssembly.instantiate(compiled, {});
    const returnCode = instance.exports.main();
    if (returnCode !== requiredReturnCode) {
      throw new Error("browser WASM test entry point failed");
    }
    return { exports: exportsValue, imports: importsValue, returnCode };
  }, {
    base64: module.base64,
    requiredExportsValue: wasmAbi.requiredExports,
    requiredReturnCode: wasmAbi.requiredReturnCode
  }), timeoutMs);
}

/** Closes one persistent context without hiding a later profile-deletion failure. */
async function closeContext(context) {
  if (!context) return;
  try {
    await context.close();
  } catch (_error) {
    // A crashed process is already closed; owned-profile deletion remains authoritative.
  }
}

/** Executes all three exact test modules in one fresh, owned Chromium profile. */
async function executeBrowserRun(options, runNumber, modules, wasmAbi) {
  const root = createOwnedProfileRoot({
    parentDirectory: options.profileParent,
    campaignId: expectedExperimentId
  });
  const profile = createOwnedBrowserProfile(root, {
    round: runNumber,
    role: "direct-wasm-tests"
  });
  assertOwnedProfileFresh(root, profile);
  let context = null;
  let browser = null;
  let deletion = null;
  let rootDeleted = false;
  let runResult = null;
  let executionError = null;
  try {
    context = await chromium.launchPersistentContext(
      profile.profilePath,
      browserLaunchOptions(options.chromiumPath, options.browserTimeoutMs)
    );
    browser = context.browser();
    invariant(browser !== null && browser.isConnected(),
      "persistent Chromium process is not connected");
    context.setDefaultTimeout(options.browserTimeoutMs);
    context.setDefaultNavigationTimeout(options.browserTimeoutMs);
    let networkRequestCount = 0;
    let consoleErrorCount = 0;
    let pageErrorCount = 0;
    await context.route("**/*", async (route) => {
      networkRequestCount += 1;
      await route.abort("blockedbyclient");
    });
    context.on("request", () => {
      // The route counter is authoritative; this listener proves requests are observable.
    });
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrorCount += 1;
    });
    page.on("pageerror", () => {
      pageErrorCount += 1;
    });
    await page.setContent("<!doctype html><meta charset=\"utf-8\"><title>WASM evidence</title>");
    const pageOrigin = page.url();
    invariant(pageOrigin === "about:blank", "browser page origin changed");
    const browserVersion = context.browser()?.version() ||
      await page.evaluate(() => navigator.userAgent);
    invariant(typeof browserVersion === "string" && browserVersion.length > 0 &&
      browserVersion.length <= 255, "browser version is invalid");
    const moduleResults = [];
    for (const module of modules) {
      const result = await executeModuleInPage(
        page, module, wasmAbi, options.browserTimeoutMs
      );
      moduleResults.push(Object.freeze({
        role: module.role,
        sha256: module.sha256,
        bytes: module.bytes,
        expectedTestCount: module.expectedTestCount,
        exports: result.exports,
        imports: result.imports,
        returnCode: result.returnCode
      }));
    }
    invariant(networkRequestCount === 0, "browser network request budget exceeded");
    invariant(consoleErrorCount === 0, "browser console error budget exceeded");
    invariant(pageErrorCount === 0, "browser page error budget exceeded");
    runResult = {
      runNumber,
      browserVersion,
      pageOrigin,
      moduleResults,
      networkRequestCount,
      consoleErrorCount,
      pageErrorCount
    };
  } catch (error) {
    executionError = error;
  } finally {
    await closeContext(context);
    const browserProcessClosed = browser !== null && !browser.isConnected();
    if (!browserProcessClosed && !executionError) {
      executionError = new Error("persistent Chromium process closure was not proven");
    }
    if (runResult) runResult.browserProcessClosed = browserProcessClosed;
    try {
      deletion = deleteOwnedBrowserProfile(root, profile);
      rootDeleted = removeOwnedProfileRoot(root);
    } catch (cleanupError) {
      if (!executionError) executionError = cleanupError;
    }
  }
  if (executionError) throw executionError;
  invariant(deletion?.deleted === true && rootDeleted === true,
    "browser profile or profile-root deletion was not proven");
  return Object.freeze({
    ...runResult,
    profileDeletion: deletion,
    profileRootDeleted: rootDeleted
  });
}

/** Removes non-evidence build payloads before observation persistence. */
function publicModule(module) {
  const { base64: _base64, ...publicFields } = module;
  return Object.freeze(publicFields);
}

/** Finalizes one observation with a canonical content hash and stable identifier. */
function finalizeObservation(body) {
  invariant(!Object.hasOwn(body, "observationId") &&
    !Object.hasOwn(body, "observationContentHash"),
  "observation body already contains identity fields");
  const observationContentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    observationId: `exact-flat-browser-wasm-${observationContentHash.slice(0, 16)}`,
    observationContentHash
  });
}

/** Recomputes the canonical content identity of one finalized observation. */
function observationIdentity(value) {
  const body = { ...value };
  delete body.observationId;
  delete body.observationContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    hash,
    id: `exact-flat-browser-wasm-${hash.slice(0, 16)}`
  });
}

/** Validates one public-safe exact-flat browser observation. */
function validateObservation(value, options = {}) {
  exactKeys(value, [
    "schema", "observationId", "observationContentHash", "experimentId", "status",
    "createdAtUtc", "sourceRevision", "preregistration", "parentReceipt", "inputs",
    "environment", "tools", "commands", "modules", "runs", "authority",
    "openPromotionGaps", "requiredNextGate"
  ], "observation");
  invariant(value.schema === observationSchema, "observation schema is unsupported");
  invariant(value.experimentId === expectedExperimentId, "experimentId is invalid");
  invariant(value.status === "real-browser-wasm-verified-with-open-promotion-gaps",
    "observation status is invalid");
  invariant(utcPattern.test(value.createdAtUtc), "createdAtUtc must be UTC");
  invariant(sourceRevisionPattern.test(value.sourceRevision), "sourceRevision is invalid");
  const identity = observationIdentity(value);
  invariant(value.observationId === identity.id && value.observationContentHash === identity.hash,
    "observation content identity is invalid");

  const preregistration = validateManifestFile();
  exactKeys(value.preregistration, ["path", "sha256"], "preregistration");
  invariant(value.preregistration.path ===
    "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-preregistration.v2.json" &&
    value.preregistration.sha256 === preregistration.sha256,
  "preregistration binding is invalid");
  const parent = validateParentReceiptFile();
  exactKeys(value.parentReceipt, ["receiptId", "sha256"], "parentReceipt");
  invariant(value.parentReceipt.receiptId === parent.receipt.receiptId &&
    value.parentReceipt.sha256 === parent.sha256,
  "parent receipt binding is invalid");

  const inputRevision = options.inputRevision || null;
  invariant(inputRevision === null || inputRevision === value.sourceRevision,
    "historical input revision does not match the observation");
  invariant(Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "observation inputs are incomplete");
  for (let index = 0; index < inputPaths.length; index += 1) {
    exactKeys(value.inputs[index], ["path", "bytes", "sha256"], `inputs[${index}]`);
    const expectedInput = inputRevision === null
      ? hashInput(inputPaths[index])
      : hashInputAtRevision(inputPaths[index], inputRevision);
    exactValue(value.inputs[index], expectedInput, `inputs[${index}]`);
  }

  exactKeys(value.environment, ["operatingSystem", "architecture"], "environment");
  invariant(/^(?:win32|linux|darwin)$/u.test(value.environment.operatingSystem) &&
    /^[A-Za-z0-9._-]{1,32}$/u.test(value.environment.architecture),
  "execution environment is invalid");
  exactKeys(value.tools, ["node", "cargo", "rustc", "playwright", "chromium"], "tools");
  invariant(safeVersionPattern.test(value.tools.node.version) &&
    safeVersionPattern.test(value.tools.cargo.version) &&
    safeVersionPattern.test(value.tools.rustc.version), "tool versions are invalid");
  for (const label of ["node", "cargo", "rustc"]) {
    exactKeys(value.tools[label], ["version", "sha256"], `tools.${label}`);
    invariant(sha256Pattern.test(value.tools[label].sha256),
      `${label} executable identity is invalid`);
  }
  for (const label of ["playwright", "chromium"]) {
    exactKeys(value.tools[label], ["version", "sha256"], `tools.${label}`);
    invariant(safeVersionPattern.test(value.tools[label].version) &&
      sha256Pattern.test(value.tools[label].sha256), `${label} identity is invalid`);
  }

  invariant(Array.isArray(value.commands) && value.commands.length === requiredGates.length,
    "command evidence is incomplete");
  for (let index = 0; index < requiredGates.length; index += 1) {
    const command = value.commands[index];
    const gate = requiredGates[index];
    exactKeys(command, [
      "gateId", "executable", "arguments", "exitCode", "outputSha256", "spawnErrorCode"
    ], `commands[${index}]`);
    invariant(command.gateId === gate.gateId && command.executable === gate.executable &&
      JSON.stringify(command.arguments) === JSON.stringify(gate.arguments) &&
      command.exitCode === 0 && command.spawnErrorCode === null &&
      sha256Pattern.test(command.outputSha256), `command gate is invalid: ${gate.gateId}`);
  }

  invariant(Array.isArray(value.modules) && value.modules.length === expectedModules.length,
    "WASM module evidence is incomplete");
  for (let index = 0; index < expectedModules.length; index += 1) {
    const module = value.modules[index];
    const expected = expectedModules[index];
    exactKeys(module, [
      "role", "expectedTestCount", "bytes", "sha256", "exports", "imports"
    ], `modules[${index}]`);
    invariant(module.role === expected.role &&
      module.expectedTestCount === expected.expectedTestCount &&
      Number.isSafeInteger(module.bytes) &&
      module.bytes >= preregistration.manifest.wasmAbi.moduleMinimumBytes &&
      module.bytes <= preregistration.manifest.wasmAbi.moduleMaximumBytes &&
      sha256Pattern.test(module.sha256), `module identity is invalid: ${expected.role}`);
    exactValue(module.exports, requiredExports, `${expected.role} exports`);
    exactValue(module.imports, [], `${expected.role} imports`);
  }

  invariant(Array.isArray(value.runs) &&
    value.runs.length === preregistration.manifest.execution.requiredIndependentRuns,
  "browser run evidence is incomplete");
  for (let runIndex = 0; runIndex < value.runs.length; runIndex += 1) {
    const run = value.runs[runIndex];
    exactKeys(run, [
      "runNumber", "browserVersion", "pageOrigin", "moduleResults",
      "networkRequestCount", "consoleErrorCount", "pageErrorCount",
      "browserProcessClosed", "profileDeletion", "profileRootDeleted"
    ], `runs[${runIndex}]`);
    invariant(run.runNumber === runIndex + 1 &&
      safeVersionPattern.test(run.browserVersion) &&
      run.pageOrigin === preregistration.manifest.execution.pageOrigin &&
      run.networkRequestCount === 0 && run.consoleErrorCount === 0 &&
      run.pageErrorCount === 0 && run.browserProcessClosed === true &&
      run.profileRootDeleted === true,
    `browser run is invalid: ${runIndex + 1}`);
    exactKeys(run.profileDeletion, [
      "schema", "campaignId", "round", "role", "rootMarkerHash", "profileMarkerHash",
      "deleted", "verifiedAtUtc"
    ], `runs[${runIndex}].profileDeletion`);
    invariant(run.profileDeletion.schema === "tinyrustlm.browser_profile_deletion.v1" &&
      run.profileDeletion.campaignId === expectedExperimentId &&
      run.profileDeletion.round === runIndex + 1 &&
      run.profileDeletion.role === "direct-wasm-tests" &&
      sha256Pattern.test(run.profileDeletion.rootMarkerHash) &&
      sha256Pattern.test(run.profileDeletion.profileMarkerHash) &&
      run.profileDeletion.deleted === true && utcPattern.test(run.profileDeletion.verifiedAtUtc),
    `profile deletion evidence is invalid: ${runIndex + 1}`);
    invariant(Array.isArray(run.moduleResults) && run.moduleResults.length === value.modules.length,
      `browser module results are incomplete: ${runIndex + 1}`);
    for (let moduleIndex = 0; moduleIndex < value.modules.length; moduleIndex += 1) {
      const result = run.moduleResults[moduleIndex];
      const module = value.modules[moduleIndex];
      exactKeys(result, [
        "role", "sha256", "bytes", "expectedTestCount", "exports", "imports", "returnCode"
      ], `runs[${runIndex}].moduleResults[${moduleIndex}]`);
      invariant(result.role === module.role && result.sha256 === module.sha256 &&
        result.bytes === module.bytes && result.expectedTestCount === module.expectedTestCount &&
        result.returnCode === preregistration.manifest.wasmAbi.requiredReturnCode,
      `browser module result is invalid: ${runIndex + 1}/${module.role}`);
      exactValue(result.exports, module.exports,
        `browser exports ${runIndex + 1}/${module.role}`);
      exactValue(result.imports, module.imports,
        `browser imports ${runIndex + 1}/${module.role}`);
    }
  }
  invariant(value.runs.every((run) => run.browserVersion === value.tools.chromium.version),
    "browser version changed across independent runs");
  invariant(new Set(value.runs.map((run) => run.profileDeletion.rootMarkerHash)).size ===
    value.runs.length, "browser profile roots are not independent");
  invariant(new Set(value.runs.map((run) => run.profileDeletion.profileMarkerHash)).size ===
    value.runs.length, "browser profiles are not independent");

  exactValue(value.authority, authority, "authority");
  exactValue(value.openPromotionGaps, openPromotionGaps, "openPromotionGaps");
  invariant(value.requiredNextGate === preregistration.manifest.requiredNextGate,
    "requiredNextGate changed from preregistration");
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    "observation contains private, credential-like, or internal citation text");
  return value;
}

/** Reads and validates one canonical checked-in observation file. */
function validateObservationFile(filePath = observationPath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumObservationBytes, "observation must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const parsed = JSON.parse(bytes.toString("utf8"));
  const observation = validateObservation(parsed, { inputRevision: parsed.sourceRevision });
  invariant(bytes.equals(canonicalPrettyBytes(observation)), "observation bytes are not canonical");
  return Object.freeze({ observation, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Builds the successful observation after all local and browser gates pass. */
async function generateObservation(options = {}) {
  const preregistration = validateManifestFile();
  const parent = validateParentReceiptFile();
  assertInputsCommitted();
  const revision = sourceRevision();
  const commands = requiredGates.map(runGate);
  const modules = preregistration.manifest.execution.wasmModules.map((roleSpec) =>
    moduleEvidence(roleSpec, preregistration.manifest.wasmAbi));
  const playwrightManifestPath = require.resolve("@playwright/test/package.json");
  const playwrightManifest = JSON.parse(fs.readFileSync(playwrightManifestPath, "utf8"));
  const chromiumPath = options.chromiumPath || chromium.executablePath();
  const chromiumStat = fs.lstatSync(chromiumPath);
  invariant(chromiumStat.isFile() && !chromiumStat.isSymbolicLink() &&
    chromiumStat.size > 1024 * 1024 && chromiumStat.size <= 1024 * 1024 * 1024,
  "Chromium executable is not a bounded regular file");
  const profileParent = options.profileParent ||
    fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-vector-browser-wasm-parent-"));
  const createdProfileParent = !options.profileParent;
  const runs = [];
  try {
    for (let runNumber = 1;
      runNumber <= preregistration.manifest.execution.requiredIndependentRuns;
      runNumber += 1) {
      runs.push(await executeBrowserRun({
        chromiumPath,
        profileParent,
        browserTimeoutMs: preregistration.manifest.execution.browserTimeoutMs
      },
        runNumber, modules, preregistration.manifest.wasmAbi));
    }
  } finally {
    if (createdProfileParent) {
      const entries = fs.readdirSync(profileParent);
      invariant(entries.length === 0, "browser profile parent is not empty after cleanup");
      fs.rmdirSync(profileParent);
    }
  }
  const body = {
    schema: observationSchema,
    experimentId: expectedExperimentId,
    status: "real-browser-wasm-verified-with-open-promotion-gaps",
    createdAtUtc: new Date().toISOString(),
    sourceRevision: revision,
    preregistration: {
      path: "tinyrustlm/experiments/vector-quantization/" +
        "exact-flat-browser-wasm-preregistration.v2.json",
      sha256: preregistration.sha256
    },
    parentReceipt: {
      receiptId: parent.receipt.receiptId,
      sha256: parent.sha256
    },
    inputs: inputPaths.map(hashInput),
    environment: {
      operatingSystem: process.platform,
      architecture: process.arch
    },
    tools: {
      node: toolIdentity("node"),
      cargo: toolIdentity("cargo"),
      rustc: toolIdentity("rustc"),
      playwright: {
        version: playwrightManifest.version,
        sha256: sha256File(playwrightManifestPath)
      },
      chromium: {
        version: runs[0].browserVersion,
        sha256: sha256File(chromiumPath)
      }
    },
    commands,
    modules: modules.map(publicModule),
    runs,
    authority,
    openPromotionGaps,
    requiredNextGate: preregistration.manifest.requiredNextGate
  };
  const observation = finalizeObservation(body);
  validateObservation(observation);
  return observation;
}

/** Finalizes an immutable pass or failure attempt without raw diagnostics. */
function finalizeAttempt(body) {
  invariant(!Object.hasOwn(body, "attemptId") &&
    !Object.hasOwn(body, "attemptContentHash"),
  "attempt body already contains identity fields");
  const attemptContentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    attemptId: `exact-flat-browser-wasm-attempt-${attemptContentHash.slice(0, 16)}`,
    attemptContentHash
  });
}

/** Recomputes the canonical content identity of one finalized attempt. */
function attemptIdentity(value) {
  const body = { ...value };
  delete body.attemptId;
  delete body.attemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    hash,
    id: `exact-flat-browser-wasm-attempt-${hash.slice(0, 16)}`
  });
}

/** Validates one immutable pass or failure attempt without raw diagnostics. */
function validateAttempt(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "startedAtUtc", "completedAtUtc",
    "sourceRevision", "preregistrationSha256", "parentReceiptSha256",
    "observationId", "observationContentHash", "failure", "attemptId",
    "attemptContentHash"
  ], "attempt");
  invariant(value.schema === attemptSchema && value.experimentId === expectedExperimentId,
    "attempt schema or experiment is invalid");
  invariant(value.status === "pass" || value.status === "fail", "attempt status is invalid");
  invariant(utcPattern.test(value.startedAtUtc) && utcPattern.test(value.completedAtUtc) &&
    Date.parse(value.completedAtUtc) >= Date.parse(value.startedAtUtc),
  "attempt timestamps are invalid");
  invariant(value.sourceRevision === null || sourceRevisionPattern.test(value.sourceRevision),
    "attempt source revision is invalid");
  invariant(value.preregistrationSha256 === null ||
    sha256Pattern.test(value.preregistrationSha256),
  "attempt preregistration identity is invalid");
  invariant(value.parentReceiptSha256 === null || sha256Pattern.test(value.parentReceiptSha256),
    "attempt parent receipt identity is invalid");
  const identity = attemptIdentity(value);
  invariant(attemptIdPattern.test(value.attemptId) &&
    value.attemptId === identity.id && value.attemptContentHash === identity.hash,
  "attempt content identity is invalid");
  if (value.status === "pass") {
    invariant(sourceRevisionPattern.test(value.sourceRevision) &&
      sha256Pattern.test(value.preregistrationSha256) &&
      sha256Pattern.test(value.parentReceiptSha256) &&
      observationIdPattern.test(value.observationId) &&
      sha256Pattern.test(value.observationContentHash) && value.failure === null,
    "passing attempt evidence is incomplete");
  } else {
    invariant(value.observationId === null && value.observationContentHash === null,
      "failed attempt must not claim an observation");
    exactKeys(value.failure, ["code", "errorName", "messageSha256"], "attempt.failure");
    invariant(value.failure.code === "browser-wasm-observation-failed" &&
      /^[A-Za-z0-9._-]{1,64}$/u.test(value.failure.errorName) &&
      sha256Pattern.test(value.failure.messageSha256), "failed attempt evidence is invalid");
  }
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    "attempt contains private, credential-like, or internal citation text");
  return value;
}

/** Reads and validates one canonical content-addressed attempt file. */
function validateAttemptFile(filePath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumObservationBytes, "attempt must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const attempt = validateAttempt(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalPrettyBytes(attempt)), "attempt bytes are not canonical");
  invariant(path.basename(filePath) === `${attempt.attemptContentHash}.json` &&
    path.basename(path.dirname(filePath)) === attempt.attemptContentHash.slice(0, 2),
  "attempt path is not content-addressed");
  return Object.freeze({ attempt, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Writes one content-addressed attempt and returns its public-safe path identity. */
function writeAttempt(attempt) {
  validateAttempt(attempt);
  const filePath = path.join(attemptDirectory, attempt.attemptContentHash.slice(0, 2),
    `${attempt.attemptContentHash}.json`);
  atomicCreate(filePath, canonicalPrettyBytes(attempt));
  const reopened = validateAttemptFile(filePath);
  return Object.freeze({
    relativePath: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
    sha256: reopened.sha256
  });
}

/** Returns a bounded failure description containing no raw error text. */
function publicFailure(error) {
  const name = String(error?.name || "Error").replace(/[^A-Za-z0-9._-]+/gu, "-").slice(0, 64);
  const message = String(error?.message || "browser WASM observation failed");
  return Object.freeze({
    code: "browser-wasm-observation-failed",
    errorName: name || "Error",
    messageSha256: sha256(Buffer.from(message, "utf8"))
  });
}

/** Executes the gate once and persists immutable attempt plus successful observation evidence. */
async function runAndWriteObservation() {
  const startedAtUtc = new Date().toISOString();
  let revision = null;
  let preregistrationSha256 = null;
  let parentReceiptSha256 = null;
  try {
    revision = sourceRevision();
    preregistrationSha256 = validateManifestFile().sha256;
    parentReceiptSha256 = validateParentReceiptFile().sha256;
    const observation = await generateObservation();
    atomicCreate(observationPath, canonicalPrettyBytes(observation));
    const validated = validateObservationFile();
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      status: "pass",
      startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistrationSha256,
      parentReceiptSha256,
      observationId: observation.observationId,
      observationContentHash: observation.observationContentHash,
      failure: null
    });
    const attemptEvidence = writeAttempt(attempt);
    return Object.freeze({ attempt, attemptEvidence, observation: validated });
  } catch (error) {
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      status: "fail",
      startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistrationSha256,
      parentReceiptSha256,
      observationId: null,
      observationContentHash: null,
      failure: publicFailure(error)
    });
    try {
      writeAttempt(attempt);
    } catch (_attemptError) {
      // Preserve the original failure; inability to persist is visible through the missing attempt.
    }
    throw error;
  }
}

/** Runs the one-shot observation CLI and prints only bounded identities and counters. */
async function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vector-browser-wasm-observation.js --write");
  const result = await runAndWriteObservation();
  process.stdout.write(`${JSON.stringify({
    schema: result.observation.observation.schema,
    observationId: result.observation.observation.observationId,
    status: result.observation.observation.status,
    sourceRevision: result.observation.observation.sourceRevision,
    moduleCount: result.observation.observation.modules.length,
    expectedBrowserTestCount: result.observation.observation.modules.reduce(
      (sum, module) => sum + module.expectedTestCount, 0),
    independentBrowserRuns: result.observation.observation.runs.length,
    attemptId: result.attempt.attemptId,
    attemptPath: result.attemptEvidence.relativePath,
    bytes: result.observation.bytes,
    sha256: result.observation.sha256,
    productAuthority: result.observation.observation.authority.productIntegrationAuthorized
  }, null, 2)}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Vector browser-WASM observation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  attemptIdentity,
  attemptSchema,
  authority,
  canonicalPrettyBytes,
  expectedExperimentId,
  finalizeAttempt,
  finalizeObservation,
  generateObservation,
  hashInput,
  hashInputAtRevision,
  inputPaths,
  moduleEvidence,
  observationIdentity,
  observationPath,
  observationSchema,
  openPromotionGaps,
  publicFailure,
  requiredGates,
  runAndWriteObservation,
  sha256,
  toolIdentity,
  validateAttempt,
  validateAttemptFile,
  validateObservation,
  validateObservationFile
});
