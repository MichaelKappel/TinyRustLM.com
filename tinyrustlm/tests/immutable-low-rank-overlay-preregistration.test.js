"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  addF32,
  calculateBaseOutput,
  calculateOverlay,
  expectedFixture,
  expectedManifestBytes,
  expectedManifestSha256,
  expectedPrimary,
  expectedSecondary,
  expectedSourceOutputs,
  manifestPath,
  validateBinaryFixture,
  validateManifest,
  validateManifestFile
} = require("../tools/immutable-low-rank-overlay-preregistration.js");

/** Creates an isolated JSON-compatible copy for mutation tests. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("validates the frozen immutable low-rank overlay contract", () => {
  const result = validateManifestFile();
  assert.equal(
    result.manifest.experimentId,
    "immutable-low-rank-specialist-overlay-20260725"
  );
  assert.equal(result.manifest.binaryFormat.magic, "SLO1");
  assert.equal(result.manifest.headerFields.length, 21);
  assert.equal(result.manifest.directoryFields.length, 19);
  assert.equal(result.manifest.sourceDtypes.length, 4);
  assert.equal(result.bytes, expectedManifestBytes);
  assert.equal(result.sha256, expectedManifestSha256);
});

test("decodes the canonical 576-byte package and factor payload", () => {
  const manifest = validateManifestFile().manifest;
  const fixture = validateBinaryFixture(manifest.testVector);
  assert.equal(fixture.bytes.length, expectedFixture.bytes);
  assert.deepEqual(
    fixture.outputFactors,
    manifest.testVector.primaryOverlay.outputFactors
  );
  assert.deepEqual(
    fixture.inputFactors,
    manifest.testVector.primaryOverlay.inputFactors
  );
});

test("recomputes both overlay vectors in frozen f32 operation order", () => {
  const vector = validateManifestFile().manifest.testVector;
  assert.deepEqual(
    calculateOverlay(vector.primaryOverlay, vector.inputVector),
    expectedPrimary
  );
  assert.deepEqual(
    calculateOverlay(vector.secondaryOverlay, vector.inputVector),
    expectedSecondary
  );
});

test("recomputes f32 q8 q5 and q4 direct outputs", () => {
  const vector = validateManifestFile().manifest.testVector;
  for (const source of vector.sourceCases) {
    const base = calculateBaseOutput(source, vector.inputVector, 3, 8);
    const primary = addF32(base, expectedPrimary.delta);
    const combined = addF32(primary, expectedSecondary.delta);
    assert.deepEqual(base, expectedSourceOutputs[source.name].base);
    assert.deepEqual(primary, expectedSourceOutputs[source.name].primary);
    assert.deepEqual(combined, expectedSourceOutputs[source.name].combined);
  }
});

test("rejects binary layout and source dtype contract drift", () => {
  const manifest = validateManifestFile().manifest;

  const header = clone(manifest);
  header.headerFields[8].offset = 44;
  assert.throws(() => validateManifest(header), /header field 8/u);

  const directory = clone(manifest);
  directory.directoryFields[15].rule = "arbitrary";
  assert.throws(() => validateManifest(directory), /directory field 15/u);

  const dtype = clone(manifest);
  dtype.sourceDtypes[3].blockSizeRule = "positive-divisor-of-cols";
  assert.throws(() => validateManifest(dtype), /source dtype 3/u);
});

test("rejects package byte hash padding and factor drift", () => {
  const manifest = validateManifestFile().manifest;

  const packageByte = clone(manifest);
  const bytes = Buffer.from(packageByte.testVector.binaryFixture.packageHex,
    "hex");
  bytes[575] = 1;
  packageByte.testVector.binaryFixture.packageHex = bytes.toString("hex");
  assert.throws(() => validateManifest(packageByte),
    /binary fixture package hash/u);

  const factor = clone(manifest);
  factor.testVector.primaryOverlay.inputFactors[0] = 0.5;
  assert.throws(() => validateManifest(factor),
    /primaryOverlay calculated component dots/u);
});

test("rejects arithmetic tolerance switching and rejection-set drift", () => {
  const manifest = validateManifestFile().manifest;

  const tolerance = clone(manifest);
  tolerance.testVector.differentialCriteria
    .directVersusMaterializedAbsoluteToleranceByDtype.q4_0 = 0.01;
  assert.throws(() => validateManifest(tolerance),
    /differential tolerances/u);

  const switching = clone(manifest);
  switching.testVector.switchingSequence.repeatCount = 99;
  assert.throws(() => validateManifest(switching),
    /switching sequence authority/u);

  const rejection = clone(manifest);
  rejection.testVector.rejectionMutations.pop();
  assert.throws(() => validateManifest(rejection),
    /rejection mutation set/u);
});

test("rejects legacy compatibility and authority inflation", () => {
  const manifest = validateManifestFile().manifest;

  const legacy = clone(manifest);
  legacy.scope.acceptedLegacyMagics.push("ALR1");
  assert.throws(() => validateManifest(legacy),
    /scope clean-slate contract/u);

  const mutation = clone(manifest);
  mutation.scope.mutableBaseTensorUpdatesPermitted = true;
  assert.throws(() => validateManifest(mutation),
    /scope clean-slate contract/u);

  const authority = clone(manifest);
  authority.authority.runtimeParserImplemented = true;
  assert.throws(() => validateManifest(authority),
    /authority runtimeParserImplemented is inflated/u);
});

test("rejects unknown fields and noncanonical manifest bytes", () => {
  const manifest = validateManifestFile().manifest;
  const unknown = clone(manifest);
  unknown.compatibilityVersion = 1;
  assert.throws(() => validateManifest(unknown), /manifest keys/u);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "slo-prereg-"));
  const filePath = path.join(root, "manifest.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(manifest));
    assert.throws(() => validateManifestFile(filePath),
      /not canonical/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  assert.equal(fs.existsSync(manifestPath), true);
});
