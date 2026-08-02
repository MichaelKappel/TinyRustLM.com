"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  canonicalManifestBytes,
  fixtureCases,
  manifestSchema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-browser-wasm-preregistration.js");

/** Clones a manifest through its canonical JSON form. */
function cloneManifest(value) {
  return JSON.parse(canonicalManifestBytes(value).toString("utf8"));
}

test("validates the frozen real-browser exact-flat preregistration", () => {
  const result = validateManifestFile();

  assert.equal(result.manifest.schema, manifestSchema);
  assert.equal(result.manifest.parentReceipt.receiptId,
    "exact-flat-retrieval-75f95baa316315ea");
  assert.equal(result.manifest.execution.requiredIndependentRuns, 2);
  assert.deepEqual(result.manifest.fixtureCases, fixtureCases);
  assert.equal(result.manifest.wasmAbi.requiredStatusMask, 255);
  assert.equal(result.manifest.acceptance.networkRequestMaximum, 0);
  assert.equal(result.manifest.authority.realBrowserWasmExecutionMayBeVerified, true);
  assert.equal(result.manifest.authority.productIntegrationMayBeClaimed, false);
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
});

test("rejects easier execution, network, and profile policies", () => {
  const original = validateManifestFile().manifest;

  const oneRun = cloneManifest(original);
  oneRun.execution.requiredIndependentRuns = 1;
  assert.throws(() => validateManifest(oneRun), /execution policy/u);

  const network = cloneManifest(original);
  network.acceptance.networkRequestMaximum = 1;
  assert.throws(() => validateManifest(network), /network budgets/u);

  const reusableProfile = cloneManifest(original);
  reusableProfile.execution.profileLifecycle = "reused-context";
  assert.throws(() => validateManifest(reusableProfile), /execution policy/u);

  const retainedProfile = cloneManifest(original);
  retainedProfile.evidencePolicy.rawBrowserProfilePersisted = true;
  assert.throws(() => validateManifest(retainedProfile), /privacy or immutability/u);
});

test("rejects fixture, ABI, parent, and authority drift", () => {
  const original = validateManifestFile().manifest;

  const fixture = cloneManifest(original);
  fixture.fixtureCases.pop();
  assert.throws(() => validateManifest(fixture), /fixtureCases/u);

  const exportDrift = cloneManifest(original);
  exportDrift.wasmAbi.requiredFunctionExports.push("unexpected_export");
  assert.throws(() => validateManifest(exportDrift), /requiredFunctionExports/u);

  const parent = cloneManifest(original);
  parent.parentReceipt.sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(parent), /parent receipt binding/u);

  const performance = cloneManifest(original);
  performance.authority.browserPerformanceMayBeClaimed = true;
  assert.throws(() => validateManifest(performance), /authority is invalid/u);

  const product = cloneManifest(original);
  product.authority.productIntegrationMayBeClaimed = true;
  assert.throws(() => validateManifest(product), /authority is invalid/u);
});

test("rejects unknown fields and private local paths", () => {
  const original = validateManifestFile().manifest;

  const unknown = cloneManifest(original);
  unknown.acceptance.bestOfTwoAllowed = true;
  assert.throws(() => validateManifest(unknown), /acceptance fields/u);

  const privatePath = cloneManifest(original);
  privatePath.requiredNextGate =
    "Continue from C:\\private\\browser-output after the local run has completed successfully.";
  assert.throws(() => validateManifest(privatePath), /private.*text/u);
});
