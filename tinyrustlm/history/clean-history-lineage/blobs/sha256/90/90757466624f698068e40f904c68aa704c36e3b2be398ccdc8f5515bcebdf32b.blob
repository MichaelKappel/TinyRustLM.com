"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  defaultPath,
  expectedManifestSha256,
  experimentId,
  schema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-portable-affine-u8-preregistration.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalManifest() {
  return clone(validateManifestFile(defaultPath).manifest);
}

test("validates the frozen portable affine-u8 preregistration and lineage", () => {
  const result = validateManifestFile(defaultPath);
  assert.equal(result.manifest.schema, schema);
  assert.equal(result.manifest.experimentId, experimentId);
  assert.equal(result.manifest.status, "preregistered-before-implementation-or-results");
  assert.equal(result.manifest.corpusReuse.lanes.length, 6);
  assert.equal(result.manifest.method.bitWidth, 8);
  assert.equal(result.manifest.nativeAndWasm.wasmBuildRequired, true);
  assert.equal(result.sha256, expectedManifestSha256);
});

test("rejects terminal-reference retry, lineage, and identity drift", () => {
  const retry = canonicalManifest();
  retry.lineage.terminalReferenceExperiment.sameExperimentRetryAllowed = true;
  assert.throws(() => validateManifest(retry), /terminal reference lineage is invalid/u);

  const lineage = canonicalManifest();
  lineage.lineage.sealedBaseline[1].sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(lineage), /manifest frozen contract is invalid/u);

  const identity = canonicalManifest();
  identity.method.methodId = "portable-global-affine-u8-flat-easy-v2";
  assert.throws(() => validateManifest(identity), /method contract is invalid/u);
});

test("rejects hidden bytes, reranking, a second arm, and byte-accounting theater", () => {
  const shadow = canonicalManifest();
  shadow.method.decodedF32ShadowAllowed = true;
  assert.throws(() => validateManifest(shadow), /method contract is invalid/u);

  const rerank = canonicalManifest();
  rerank.method.sourceVectorRerankingAllowed = true;
  assert.throws(() => validateManifest(rerank), /method contract is invalid/u);

  const secondArm = canonicalManifest();
  secondArm.method.secondBitWidthAllowed = true;
  assert.throws(() => validateManifest(secondArm), /manifest frozen contract is invalid/u);

  const bytes = canonicalManifest();
  bytes.byteAccounting.nominalBitWidthMaySubstituteForEffectiveBytes = true;
  assert.throws(() => validateManifest(bytes), /byte accounting contract is invalid/u);
});

test("rejects threshold weakening, retries, output repair, and best-of-N", () => {
  const threshold = canonicalManifest();
  threshold.qualityThresholds.sameCorpusAllLanes.minimumRecallAt1 = 0.84;
  assert.throws(() => validateManifest(threshold), /quality threshold contract is invalid/u);

  const retry = canonicalManifest();
  retry.execution.qualityThresholdFailureMayBeRetried = true;
  assert.throws(() => validateManifest(retry), /execution contract is invalid/u);

  const repair = canonicalManifest();
  repair.execution.resultRepairAllowed = true;
  assert.throws(() => validateManifest(repair), /execution contract is invalid/u);

  const bestOf = canonicalManifest();
  bestOf.execution.bestOfNAllowed = true;
  assert.throws(() => validateManifest(bestOf), /execution contract is invalid/u);
});

test("rejects wasm weakening and compile-only browser claim inflation", () => {
  const wasm = canonicalManifest();
  wasm.nativeAndWasm.wasmBuildRequired = false;
  assert.throws(() => validateManifest(wasm), /native and wasm contract is invalid/u);

  const imports = canonicalManifest();
  imports.nativeAndWasm.wasmImportsAllowed = 1;
  assert.throws(() => validateManifest(imports), /native and wasm contract is invalid/u);

  const browser = canonicalManifest();
  browser.nativeAndWasm.browserPerformanceClaimAllowedFromCompileOnly = true;
  assert.throws(() => validateManifest(browser), /manifest frozen contract is invalid/u);
});

test("rejects failure-metric loss, private evidence, product authority, and unknown fields", () => {
  const metrics = canonicalManifest();
  metrics.execution.terminalOutcomeMetricsMustBeRetained = false;
  assert.throws(() => validateManifest(metrics), /execution contract is invalid/u);

  const pathDisclosure = canonicalManifest();
  pathDisclosure.evidencePolicy.privateAbsolutePathsAllowed = true;
  assert.throws(() => validateManifest(pathDisclosure), /evidence policy is invalid/u);

  const authority = canonicalManifest();
  authority.authority.productIntegrationMayBeClaimed = true;
  assert.throws(() => validateManifest(authority), /authority contract is invalid/u);

  const unknown = canonicalManifest();
  unknown.legacyCompatibility = true;
  assert.throws(() => validateManifest(unknown), /manifest fields are invalid/u);
});

test("rejects private text and noncanonical manifest bytes", () => {
  const privateText = canonicalManifest();
  privateText.requiredNextGate = "Read C:\\Users\\Private\\secret.txt";
  assert.throws(() => validateManifest(privateText), /private or secret text/u);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-u8-prereg-"));
  const filePath = path.join(directory, "manifest.json");
  try {
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(canonicalManifest(), null, 2)}\n\n`,
      "utf8"
    );
    assert.throws(
      () => validateManifestFile(filePath),
      /manifest bytes are not canonical pretty JSON/u
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
