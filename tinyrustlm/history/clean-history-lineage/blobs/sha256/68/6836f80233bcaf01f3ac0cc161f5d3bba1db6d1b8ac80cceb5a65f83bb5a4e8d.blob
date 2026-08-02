"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { validateManifestFile: validateV1File } =
  require("./vector-browser-wasm-preregistration.js");

const manifestSchema = "tinyrustlm.exact_flat_browser_wasm_preregistration.v2";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultManifestPath = path.join(repositoryRoot,
  "tinyrustlm/experiments/vector-quantization/" +
  "exact-flat-browser-wasm-preregistration.v2.json");
const expectedV1 = Object.freeze({
  path: "tinyrustlm/experiments/vector-quantization/" +
    "exact-flat-browser-wasm-preregistration.v1.json",
  sha256: "e9ed2d13d975689184d53e4a55cd774fed449cca99372d1e9afc40284569b330",
  sourceRevision: "a012b9003dc4cc9040733609a2616440d188af9c",
  disposition: "unsafe-symbol-export-boundary-rejected-before-execution",
  browserResultsObserved: false
});
const expectedParent = Object.freeze({
  path: "tinyrustlm/experiments/vector-quantization/" +
    "exact-flat-retrieval-verification-v1.json",
  receiptId: "exact-flat-retrieval-75f95baa316315ea",
  sha256: "893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c"
});
const expectedModules = Object.freeze([
  Object.freeze({
    role: "unit",
    filePattern: "tinyrustlm_vector_oracle-*.wasm",
    expectedTestCount: 40
  }),
  Object.freeze({
    role: "exact-flat-black-box",
    filePattern: "flat_index_test-*.wasm",
    expectedTestCount: 8
  }),
  Object.freeze({
    role: "clean-room-conformance",
    filePattern: "lib_test-*.wasm",
    expectedTestCount: 1
  })
]);
const requiredExports = Object.freeze([
  Object.freeze({ name: "memory", kind: "memory" }),
  Object.freeze({ name: "main", kind: "function" }),
  Object.freeze({ name: "__data_end", kind: "global" }),
  Object.freeze({ name: "__heap_base", kind: "global" })
]);
const forbiddenTextPattern =
  /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|turn\d+(?:search|view)\d+)/iu;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;

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

/** Returns canonical checked-in manifest bytes. */
function canonicalManifestBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Revalidates the superseded preregistration and its immutable source revision. */
function validateSuperseded(value) {
  exactKeys(value, [
    "path", "sha256", "sourceRevision", "disposition", "browserResultsObserved"
  ], "supersedes");
  exactValue(value, expectedV1, "supersedes");
  const result = validateV1File(path.join(repositoryRoot, value.path));
  invariant(result.sha256 === value.sha256, "superseded preregistration bytes changed");
}

/** Revalidates the exact-flat parent receipt against current bytes. */
function validateParent(value) {
  exactKeys(value, ["path", "receiptId", "sha256"], "parentReceipt");
  exactValue(value, expectedParent, "parentReceipt");
  const bytes = fs.readFileSync(path.join(repositoryRoot, value.path));
  invariant(sha256(bytes) === value.sha256, "parent receipt current bytes changed");
  const receipt = JSON.parse(bytes.toString("utf8"));
  invariant(receipt.receiptId === value.receiptId &&
    receipt.status === "experiment-baseline-verified-with-open-promotion-gaps",
  "parent receipt identity or status is invalid");
}

/** Validates one direct-test browser-WASM preregistration. */
function validateManifest(value) {
  exactKeys(value, [
    "schema", "experimentId", "registeredAtUtc", "status", "supersedes",
    "parentReceipt", "execution", "wasmAbi", "acceptance", "evidencePolicy",
    "authority", "requiredNextGate"
  ], "manifest");
  invariant(value.schema === manifestSchema, "manifest schema is unsupported");
  invariant(value.experimentId === "exact-flat-browser-wasm-direct-tests-20260722",
    "experimentId is invalid");
  invariant(utcPattern.test(value.registeredAtUtc), "registeredAtUtc must be UTC");
  invariant(value.status === "supersedes-v1-before-browser-results", "status is invalid");
  validateSuperseded(value.supersedes);
  validateParent(value.parentReceipt);

  exactKeys(value.execution, [
    "nativeCommand", "wasmBuildCommand", "wasmModules", "browserEngine",
    "playwrightPackage", "browserMode", "profileLifecycle", "requiredIndependentRuns",
    "networkPolicy", "pageOrigin", "browserTimeoutMs"
  ], "execution");
  exactValue(value.execution.nativeCommand,
    ["cargo", "test", "-p", "tinyrustlm-vector-oracle"], "nativeCommand");
  exactValue(value.execution.wasmBuildCommand, [
    "cargo", "test", "-p", "tinyrustlm-vector-oracle", "--target",
    "wasm32-unknown-unknown", "--no-run"
  ], "wasmBuildCommand");
  exactValue(value.execution.wasmModules, expectedModules, "wasmModules");
  invariant(value.execution.browserEngine === "chromium" &&
    value.execution.playwrightPackage === "@playwright/test" &&
    value.execution.browserMode === "headless-real-process" &&
    value.execution.profileLifecycle === "owned-persistent-fresh-delete-verify-v1" &&
    value.execution.requiredIndependentRuns === 2 &&
    value.execution.networkPolicy === "deny-all" &&
    value.execution.pageOrigin === "about:blank" &&
    value.execution.browserTimeoutMs === 120000,
  "browser execution policy is invalid");

  exactKeys(value.wasmAbi, [
    "requiredExports", "importsAllowed", "entryPoint", "requiredReturnCode",
    "moduleMinimumBytes", "moduleMaximumBytes"
  ], "wasmAbi");
  exactValue(value.wasmAbi.requiredExports, requiredExports, "requiredExports");
  invariant(value.wasmAbi.importsAllowed === false && value.wasmAbi.entryPoint === "main" &&
    value.wasmAbi.requiredReturnCode === 0 &&
    value.wasmAbi.moduleMinimumBytes === 1024 * 1024 &&
    value.wasmAbi.moduleMaximumBytes === 8 * 1024 * 1024,
  "WASM ABI policy is invalid");

  exactKeys(value.acceptance, [
    "actualBrowserProcessRequired", "browserExecutableSha256Required",
    "browserVersionRequired", "playwrightVersionRequired", "rustcVersionRequired",
    "cargoVersionRequired", "wasmModuleSha256Required", "exactThreeModuleSetRequired",
    "unchangedReceiptBoundTestSourcesRequired", "nativeSuitePassRequired",
    "browserEntryReturnCodeRequired", "crossRunModuleIdentityEqualityRequired",
    "networkRequestMaximum", "consoleErrorMaximum", "pageErrorMaximum",
    "profileDeletionRequiredForEveryRun", "strictClippyRequired", "rustdocRequired",
    "receiptInputRevalidationRequired"
  ], "acceptance");
  for (const [key, accepted] of Object.entries(value.acceptance)) {
    if (key.endsWith("Required")) invariant(accepted === true, `${key} must remain required`);
  }
  invariant(value.acceptance.networkRequestMaximum === 0 &&
    value.acceptance.consoleErrorMaximum === 0 && value.acceptance.pageErrorMaximum === 0,
  "browser error or network budgets are invalid");

  exactKeys(value.evidencePolicy, [
    "attemptsAreImmutable", "failedAttemptsArePreserved", "attemptDirectory",
    "successfulObservationPath", "verificationReceiptPath", "rawBrowserProfilePersisted",
    "screenshotsRequired", "privateAbsolutePathsAllowed", "credentialsAllowed",
    "modelBytesAllowed", "promptTextAllowed"
  ], "evidencePolicy");
  invariant(value.evidencePolicy.attemptsAreImmutable === true &&
    value.evidencePolicy.failedAttemptsArePreserved === true &&
    value.evidencePolicy.attemptDirectory ===
      "tinyrustlm/experiments/vector-quantization/browser-wasm-attempts/sha256" &&
    value.evidencePolicy.successfulObservationPath ===
      "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-observation-v1.json" &&
    value.evidencePolicy.verificationReceiptPath ===
      "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json" &&
    value.evidencePolicy.rawBrowserProfilePersisted === false &&
    value.evidencePolicy.screenshotsRequired === false &&
    value.evidencePolicy.privateAbsolutePathsAllowed === false &&
    value.evidencePolicy.credentialsAllowed === false &&
    value.evidencePolicy.modelBytesAllowed === false &&
    value.evidencePolicy.promptTextAllowed === false,
  "evidence privacy or immutability policy is invalid");

  exactKeys(value.authority, [
    "realBrowserWasmExecutionMayBeVerified", "nativePerformanceMayBeClaimed",
    "browserPerformanceMayBeClaimed", "compressionMayBeClaimed",
    "turboVecParityMayBeClaimed", "productIntegrationMayBeClaimed",
    "trainingMayBeAuthorized", "releaseMayBeAuthorized"
  ], "authority");
  for (const [key, authority] of Object.entries(value.authority)) {
    invariant(authority === (key === "realBrowserWasmExecutionMayBeVerified"),
      `${key} authority is invalid`);
  }
  invariant(typeof value.requiredNextGate === "string" &&
    value.requiredNextGate.length >= 80 && value.requiredNextGate.length <= 1024,
  "requiredNextGate is invalid");
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    "manifest contains private, credential-like, or internal citation text");
  return value;
}

/** Reads, validates, and byte-checks one canonical v2 preregistration file. */
function validateManifestFile(filePath = defaultManifestPath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 256 * 1024,
    "manifest must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalManifestBytes(manifest)), "manifest bytes are not canonical");
  return Object.freeze({ manifest, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Prints the public-safe identity of the active preregistration. */
function main(argumentsList) {
  invariant(argumentsList.length <= 1,
    "usage: node vector-browser-wasm-preregistration-v2.js [manifest.json]");
  const result = validateManifestFile(argumentsList[0]
    ? path.resolve(argumentsList[0])
    : defaultManifestPath);
  process.stdout.write(`${JSON.stringify({
    schema: result.manifest.schema,
    experimentId: result.manifest.experimentId,
    status: result.manifest.status,
    supersededDisposition: result.manifest.supersedes.disposition,
    requiredIndependentRuns: result.manifest.execution.requiredIndependentRuns,
    wasmModuleCount: result.manifest.execution.wasmModules.length,
    expectedBrowserTestCount: result.manifest.execution.wasmModules.reduce(
      (sum, module) => sum + module.expectedTestCount, 0),
    productAuthority: result.manifest.authority.productIntegrationMayBeClaimed,
    bytes: result.bytes,
    sha256: result.sha256
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector browser-WASM v2 preregistration failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  canonicalManifestBytes,
  defaultManifestPath,
  expectedModules,
  manifestSchema,
  requiredExports,
  validateManifest,
  validateManifestFile
});
