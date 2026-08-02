"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const manifestSchema = "tinyrustlm.exact_flat_browser_wasm_preregistration.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultManifestPath = path.join(repositoryRoot,
  "tinyrustlm/experiments/vector-quantization/" +
  "exact-flat-browser-wasm-preregistration.v1.json");
const expectedParent = Object.freeze({
  path: "tinyrustlm/experiments/vector-quantization/" +
    "exact-flat-retrieval-verification-v1.json",
  receiptId: "exact-flat-retrieval-75f95baa316315ea",
  sha256: "893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c"
});
const fixtureCases = Object.freeze([
  "sha256-normative-vectors",
  "canonical-build-order-and-restart",
  "dot-filter-and-id-tie-break",
  "euclidean-and-cosine-ranking",
  "tombstone-compaction-and-byte-removal",
  "corruption-truncation-and-extension-rejection",
  "duplicate-nonfinite-and-zero-norm-rejection",
  "empty-index-and-bounded-result-behavior"
]);
const requiredFunctionExports = Object.freeze([
  "tinyrustlm_vector_fixture_abi_version",
  "tinyrustlm_vector_fixture_status",
  "tinyrustlm_vector_fixture_outcome_word_count",
  "tinyrustlm_vector_fixture_outcome_word"
]);
const allowedRuntimeExports = Object.freeze(["memory", "__data_end", "__heap_base"]);
const forbiddenTextPattern =
  /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|turn\d+(?:search|view)\d+)/iu;
const sha256Pattern = /^[a-f0-9]{64}$/u;
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
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields are invalid`);
}

/** Requires exact ordered array equality. */
function exactArray(value, expected, label) {
  invariant(Array.isArray(value) && JSON.stringify(value) === JSON.stringify(expected),
    `${label} is invalid`);
}

/** Computes lowercase SHA-256 for one byte buffer. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Returns canonical checked-in manifest bytes. */
function canonicalManifestBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Validates the immutable exact-flat parent receipt against current bytes. */
function validateParentReceipt(parent) {
  exactKeys(parent, ["path", "receiptId", "sha256"], "parentReceipt");
  invariant(JSON.stringify(parent) === JSON.stringify(expectedParent),
    "parent receipt binding is invalid");
  const parentPath = path.join(repositoryRoot, parent.path);
  const stat = fs.lstatSync(parentPath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0,
    "parent receipt must be a nonempty regular file");
  const bytes = fs.readFileSync(parentPath);
  invariant(sha256(bytes) === parent.sha256, "parent receipt current bytes changed");
  const receipt = JSON.parse(bytes.toString("utf8"));
  invariant(receipt.receiptId === parent.receiptId &&
    receipt.status === "experiment-baseline-verified-with-open-promotion-gaps",
    "parent receipt identity or status is invalid");
}

/** Validates one frozen browser-WASM preregistration object. */
function validateManifest(value) {
  exactKeys(value, [
    "schema", "experimentId", "registeredAtUtc", "status", "parentReceipt",
    "execution", "fixtureCases", "wasmAbi", "acceptance", "evidencePolicy",
    "authority", "requiredNextGate"
  ], "manifest");
  invariant(value.schema === manifestSchema, "manifest schema is unsupported");
  invariant(value.experimentId === "exact-flat-browser-wasm-20260722",
    "experimentId is invalid");
  invariant(utcPattern.test(value.registeredAtUtc), "registeredAtUtc must be UTC");
  invariant(value.status === "preregistered-before-browser-results", "status is invalid");
  validateParentReceipt(value.parentReceipt);

  exactKeys(value.execution, [
    "browserEngine", "playwrightPackage", "browserMode", "profileLifecycle",
    "requiredIndependentRuns", "networkPolicy", "pageOrigin", "wasmTarget",
    "nativeReferenceTarget", "sourceFixturePolicy", "panicPolicy", "browserTimeoutMs"
  ], "execution");
  const expectedExecution = {
    browserEngine: "chromium",
    playwrightPackage: "@playwright/test",
    browserMode: "headless-real-process",
    profileLifecycle: "owned-persistent-fresh-delete-verify-v1",
    requiredIndependentRuns: 2,
    networkPolicy: "deny-all",
    pageOrigin: "about:blank",
    wasmTarget: "wasm32-unknown-unknown",
    nativeReferenceTarget: "host-target-recorded-at-execution",
    sourceFixturePolicy: "single-rust-definition-shared-by-native-and-wasm",
    panicPolicy: "trap-is-failure",
    browserTimeoutMs: 120000
  };
  invariant(JSON.stringify(value.execution) === JSON.stringify(expectedExecution),
    "execution policy is invalid");
  exactArray(value.fixtureCases, fixtureCases, "fixtureCases");

  exactKeys(value.wasmAbi, [
    "version", "requiredStatusMask", "requiredFunctionExports", "allowedRuntimeExports",
    "unknownFunctionExportPolicy", "outcomeEncoding", "invalidOutcomeWordSentinel"
  ], "wasmAbi");
  invariant(value.wasmAbi.version === 1 && value.wasmAbi.requiredStatusMask === 255,
    "WASM ABI version or status mask is invalid");
  exactArray(value.wasmAbi.requiredFunctionExports, requiredFunctionExports,
    "wasmAbi.requiredFunctionExports");
  exactArray(value.wasmAbi.allowedRuntimeExports, allowedRuntimeExports,
    "wasmAbi.allowedRuntimeExports");
  invariant(value.wasmAbi.unknownFunctionExportPolicy === "reject" &&
    value.wasmAbi.outcomeEncoding === "ordered-u32-little-endian-v1" &&
    value.wasmAbi.invalidOutcomeWordSentinel === 0xffffffff,
  "WASM ABI policy is invalid");

  exactKeys(value.acceptance, [
    "actualBrowserProcessRequired", "browserExecutableSha256Required",
    "browserVersionRequired", "playwrightVersionRequired", "wasmModuleSha256Required",
    "wasmModuleMinimumBytes", "wasmModuleMaximumBytes", "nativeBinarySha256Required",
    "nativeAndBrowserOutcomeByteEqualityRequired", "crossRunOutcomeByteEqualityRequired",
    "crossRunModuleIdentityEqualityRequired", "networkRequestMaximum",
    "consoleErrorMaximum", "pageErrorMaximum", "profileDeletionRequiredForEveryRun",
    "nativeFixtureTestsRequired", "strictClippyRequired", "rustdocRequired",
    "receiptInputRevalidationRequired"
  ], "acceptance");
  for (const [key, accepted] of Object.entries(value.acceptance)) {
    if (key.endsWith("Required")) invariant(accepted === true, `${key} must remain required`);
  }
  invariant(value.acceptance.wasmModuleMinimumBytes === 1024 &&
    value.acceptance.wasmModuleMaximumBytes === 2 * 1024 * 1024,
  "WASM module byte limits are invalid");
  invariant(value.acceptance.networkRequestMaximum === 0 &&
    value.acceptance.consoleErrorMaximum === 0 && value.acceptance.pageErrorMaximum === 0,
  "browser error or network budgets are invalid");

  exactKeys(value.evidencePolicy, [
    "attemptsAreImmutable", "failedAttemptsArePreserved", "successfulObservationPath",
    "verificationReceiptPath", "rawBrowserProfilePersisted", "screenshotsRequired",
    "privateAbsolutePathsAllowed", "credentialsAllowed", "modelBytesAllowed",
    "promptTextAllowed"
  ], "evidencePolicy");
  invariant(value.evidencePolicy.attemptsAreImmutable === true &&
    value.evidencePolicy.failedAttemptsArePreserved === true &&
    value.evidencePolicy.rawBrowserProfilePersisted === false &&
    value.evidencePolicy.screenshotsRequired === false &&
    value.evidencePolicy.privateAbsolutePathsAllowed === false &&
    value.evidencePolicy.credentialsAllowed === false &&
    value.evidencePolicy.modelBytesAllowed === false &&
    value.evidencePolicy.promptTextAllowed === false,
  "evidence privacy or immutability policy is invalid");
  invariant(value.evidencePolicy.successfulObservationPath ===
    "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-observation-v1.json" &&
    value.evidencePolicy.verificationReceiptPath ===
    "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json",
  "evidence paths are invalid");

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

/** Reads, validates, and byte-checks one canonical preregistration file. */
function validateManifestFile(filePath = defaultManifestPath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 256 * 1024,
    "manifest must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalManifestBytes(manifest)), "manifest bytes are not canonical");
  return Object.freeze({ manifest, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Validates the CLI argument and prints a public-safe identity summary. */
function main(argumentsList) {
  invariant(argumentsList.length <= 1,
    "usage: node vector-browser-wasm-preregistration.js [manifest.json]");
  const result = validateManifestFile(argumentsList[0]
    ? path.resolve(argumentsList[0])
    : defaultManifestPath);
  process.stdout.write(`${JSON.stringify({
    schema: result.manifest.schema,
    experimentId: result.manifest.experimentId,
    status: result.manifest.status,
    requiredIndependentRuns: result.manifest.execution.requiredIndependentRuns,
    fixtureCaseCount: result.manifest.fixtureCases.length,
    requiredStatusMask: result.manifest.wasmAbi.requiredStatusMask,
    productAuthority: result.manifest.authority.productIntegrationMayBeClaimed,
    bytes: result.bytes,
    sha256: result.sha256
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector browser-WASM preregistration failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  allowedRuntimeExports,
  canonicalManifestBytes,
  defaultManifestPath,
  fixtureCases,
  manifestSchema,
  requiredFunctionExports,
  validateManifest,
  validateManifestFile
});
