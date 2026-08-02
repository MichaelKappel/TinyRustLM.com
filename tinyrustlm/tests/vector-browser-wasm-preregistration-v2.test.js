"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  canonicalManifestBytes,
  expectedModules,
  manifestSchema,
  requiredExports,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-browser-wasm-preregistration-v2.js");

/** Clones a manifest through its canonical JSON representation. */
function cloneManifest(value) {
  return JSON.parse(canonicalManifestBytes(value).toString("utf8"));
}

test("validates the safe direct-test browser preregistration", () => {
  const result = validateManifestFile();

  assert.equal(result.manifest.schema, manifestSchema);
  assert.equal(result.manifest.supersedes.browserResultsObserved, false);
  assert.equal(result.manifest.supersedes.disposition,
    "unsafe-symbol-export-boundary-rejected-before-execution");
  assert.deepEqual(result.manifest.execution.wasmModules, expectedModules);
  assert.deepEqual(result.manifest.wasmAbi.requiredExports, requiredExports);
  assert.equal(result.manifest.execution.requiredIndependentRuns, 2);
  assert.equal(result.manifest.acceptance.networkRequestMaximum, 0);
  assert.equal(result.manifest.authority.realBrowserWasmExecutionMayBeVerified, true);
  assert.equal(result.manifest.authority.productIntegrationMayBeClaimed, false);
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
});

test("rejects supersession, module, and test-count drift", () => {
  const original = validateManifestFile().manifest;

  const resultObserved = cloneManifest(original);
  resultObserved.supersedes.browserResultsObserved = true;
  assert.throws(() => validateManifest(resultObserved), /supersedes is invalid/u);

  const missingModule = cloneManifest(original);
  missingModule.execution.wasmModules.pop();
  assert.throws(() => validateManifest(missingModule), /wasmModules/u);

  const fewerTests = cloneManifest(original);
  fewerTests.execution.wasmModules[1].expectedTestCount = 7;
  assert.throws(() => validateManifest(fewerTests), /wasmModules/u);
});

test("rejects imported modules, easier browser policy, and authority inflation", () => {
  const original = validateManifestFile().manifest;

  const imports = cloneManifest(original);
  imports.wasmAbi.importsAllowed = true;
  assert.throws(() => validateManifest(imports), /WASM ABI policy/u);

  const oneRun = cloneManifest(original);
  oneRun.execution.requiredIndependentRuns = 1;
  assert.throws(() => validateManifest(oneRun), /browser execution policy/u);

  const network = cloneManifest(original);
  network.acceptance.networkRequestMaximum = 1;
  assert.throws(() => validateManifest(network), /network budgets/u);

  const product = cloneManifest(original);
  product.authority.productIntegrationMayBeClaimed = true;
  assert.throws(() => validateManifest(product), /authority is invalid/u);
});

test("rejects unknown fields and private paths", () => {
  const original = validateManifestFile().manifest;

  const unknown = cloneManifest(original);
  unknown.wasmAbi.resultRepairAllowed = true;
  assert.throws(() => validateManifest(unknown), /wasmAbi fields/u);

  const privatePath = cloneManifest(original);
  privatePath.requiredNextGate =
    "Read browser results from C:\\private\\result.json and promote the exact-flat implementation.";
  assert.throws(() => validateManifest(privatePath), /private.*text/u);
});
