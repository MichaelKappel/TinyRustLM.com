"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  canonicalManifestBytes,
  manifestPath,
  manifestSchema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-retrieval-preregistration.js");

/** Clones the checked manifest through its canonical JSON bytes. */
function cloneManifest(manifest) {
  return JSON.parse(canonicalManifestBytes(manifest).toString("utf8"));
}

test("validates the preregistered exact-flat contract before results", () => {
  const result = validateManifestFile(manifestPath);
  assert.equal(result.manifest.schema, manifestSchema);
  assert.equal(result.manifest.status, "preregistered-before-results");
  assert.equal(result.manifest.productAuthority, false);
  assert.equal(result.manifest.trainingAuthority, false);
  assert.equal(result.manifest.format.storesPayloadText, false);
  assert.equal(result.manifest.acceptance.exactRecallMinimum, 1);
  assert.equal(result.manifest.acceptance.latencyClaimAllowed, false);
  assert.equal(result.manifest.acceptance.compressionClaimAllowed, false);
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
});

test("rejects authority inflation and weakened exact-baseline gates", () => {
  const original = validateManifestFile(manifestPath).manifest;

  const product = cloneManifest(original);
  product.productAuthority = true;
  assert.throws(() => validateManifest(product), /product authority/u);

  const recall = cloneManifest(original);
  recall.acceptance.exactRecallMinimum = 0.9;
  assert.throws(() => validateManifest(recall), /exact recall/u);

  const latency = cloneManifest(original);
  latency.acceptance.latencyClaimAllowed = true;
  assert.throws(() => validateManifest(latency), /latency claim/u);

  const payload = cloneManifest(original);
  payload.format.storesPayloadText = true;
  assert.throws(() => validateManifest(payload), /payload text/u);
});

test("rejects schema expansion, reordered identity, and easy test matrices", () => {
  const original = validateManifestFile(manifestPath).manifest;

  const expanded = cloneManifest(original);
  expanded.acceptance.bestOfNAllowed = true;
  assert.throws(() => validateManifest(expanded), /fields are invalid/u);

  const reordered = cloneManifest(original);
  reordered.identityFields.reverse();
  assert.throws(() => validateManifest(reordered), /identity fields/u);

  const easyDimensions = cloneManifest(original);
  easyDimensions.testMatrix.dimensions = [8];
  assert.throws(() => validateManifest(easyDimensions), /dimension matrix/u);

  const missingCorruption = cloneManifest(original);
  missingCorruption.testMatrix.lifecycleCases = missingCorruption.testMatrix.lifecycleCases
    .filter((value) => value !== "corruption");
  assert.throws(() => validateManifest(missingCorruption), /lifecycle matrix/u);
});
