"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  applySpecialistOverlay,
  materializedOverlayMatvec,
  parseSpecialistOverlay,
  sha256
} = require("../tools/immutable-low-rank-overlay.js");
const {
  expectedFixture,
  expectedPrimary,
  validateManifestFile
} = require("../tools/immutable-low-rank-overlay-preregistration.js");

/** Creates expected model metadata for the frozen preregistration fixture. */
function frozenExpected(packageSha256 = expectedFixture.packageSha256) {
  const tensors = Array.from({ length: 8 }, () => ({
    nameHashHex: "0000000000000001",
    dtype: 1,
    rank: 2,
    dim0: 1,
    dim1: 1,
    dim2: 1,
    dim3: 1,
    blockSize: 0
  }));
  tensors[7] = {
    nameHashHex: "0123456789abcdef",
    dtype: 1,
    rank: 2,
    dim0: 3,
    dim1: 8,
    dim2: 1,
    dim3: 1,
    blockSize: 0
  };
  return {
    packageSha256,
    base: {
      modelSha256: "11".repeat(32),
      standaloneContentDigest: "22".repeat(32),
      tokenizerSha256: "33".repeat(32),
      chatTemplateSha256: "44".repeat(32),
      tensorLayoutSha256: "55".repeat(32),
      quantizationProfileSha256: "66".repeat(32),
      executionProfileSha256: "77".repeat(32)
    },
    tensors
  };
}

/** Loads exact package bytes frozen by the preregistration. */
function frozenBytes() {
  const fixture = validateManifestFile().manifest.testVector.binaryFixture;
  return Buffer.from(fixture.packageHex, "hex");
}

/** Builds a canonical two-target package from the frozen one-target fixture. */
function twoTargetBytes() {
  const frozen = frozenBytes();
  const bytes = Buffer.alloc(768);
  frozen.copy(bytes, 0, 0, 320);
  bytes.writeUInt32LE(2, 16);
  bytes.writeBigUInt64LE(576n, 32);
  bytes.writeBigUInt64LE(768n, 40);

  const first = 320;
  bytes.writeUInt32LE(6, first);
  bytes.writeUInt32LE(1, first + 4);
  bytes.writeUInt32LE(1, first + 8);
  bytes.writeUInt32LE(1, first + 12);
  bytes.writeBigUInt64LE(1n, first + 16);
  bytes.writeUInt32LE(1, first + 24);
  bytes.writeUInt32LE(0, first + 28);
  bytes.writeUInt32LE(2, first + 32);
  bytes.writeUInt32LE(1, first + 36);
  bytes.writeUInt32LE(1, first + 40);
  bytes.writeFloatLE(1, first + 52);
  bytes.writeBigUInt64LE(576n, first + 56);
  bytes.writeBigUInt64LE(4n, first + 64);
  bytes.writeBigUInt64LE(580n, first + 72);
  bytes.writeBigUInt64LE(4n, first + 80);
  bytes.writeFloatLE(0.5, 576);
  bytes.writeFloatLE(0.25, 580);
  crypto.createHash("sha256").update(bytes.subarray(576, 584)).digest()
    .copy(bytes, first + 88);

  frozen.copy(bytes, 448, 320, 448);
  bytes.writeBigUInt64LE(640n, 448 + 56);
  bytes.writeBigUInt64LE(664n, 448 + 72);
  frozen.copy(bytes, 640, 448, 536);
  return bytes;
}

/** Rebinds the expected whole-package hash after one mutation. */
function parseMutated(bytes, expected = frozenExpected()) {
  expected.packageSha256 = sha256(bytes);
  return parseSpecialistOverlay(bytes, expected);
}

/** Refreshes the factor hash field after a semantic payload mutation. */
function refreshFactorHash(bytes) {
  const entry = 320;
  const outputOffset = Number(bytes.readBigUInt64LE(entry + 56));
  const inputOffset = Number(bytes.readBigUInt64LE(entry + 72));
  const inputBytes = Number(bytes.readBigUInt64LE(entry + 80));
  const digest = crypto.createHash("sha256")
    .update(bytes.subarray(outputOffset, inputOffset + inputBytes))
    .digest();
  digest.copy(bytes, entry + 88);
}

/** Decodes one preregistered source case into logical f32 weights. */
function decodeSourceWeights(source, rows, cols) {
  if (source.name === "f32") return [...source.storage.values];
  if (source.name === "q8_0") {
    return source.storage.codes.map((code, index) =>
      code * source.storage.scales[Math.floor(index / cols)]);
  }
  const packed = Buffer.from(source.storage.packedHex, "hex");
  const signExtend = (value, bits) => {
    const sign = 1 << (bits - 1);
    return value >= sign ? value - (1 << bits) : value;
  };
  const codes = [];
  if (source.name === "q4_0") {
    for (const byte of packed) {
      codes.push(signExtend(byte & 15, 4));
      codes.push(signExtend(byte >>> 4, 4));
    }
  } else {
    for (let group = 0; group < packed.length / 5; group += 1) {
      let word = 0n;
      for (let byte = 0; byte < 5; byte += 1) {
        word |= BigInt(packed[group * 5 + byte]) << BigInt(byte * 8);
      }
      for (let lane = 0; lane < 8; lane += 1) {
        codes.push(signExtend(
          Number((word >> BigInt(lane * 5)) & 31n), 5));
      }
    }
  }
  const blocksPerRow = cols / source.blockSize;
  return codes.map((code, index) => {
    const row = Math.floor(index / cols);
    const block = Math.floor((index % cols) / source.blockSize);
    return code * source.storage.scales[row * blocksPerRow + block];
  });
}

/** Computes an ordinary high-precision matrix-vector product. */
function matvec(weights, vector, rows, cols) {
  return Array.from({ length: rows }, (_, row) => {
    let sum = 0;
    for (let col = 0; col < cols; col += 1) {
      sum += weights[row * cols + col] * vector[col];
    }
    return sum;
  });
}

test("independently parses the exact preregistered SLO1 package", () => {
  const overlay = parseSpecialistOverlay(frozenBytes(), frozenExpected());
  assert.equal(overlay.packageSha256, expectedFixture.packageSha256);
  assert.equal(overlay.baseModelSha256, "11".repeat(32));
  assert.equal(overlay.maximumFactorRank, 2);
  assert.equal(overlay.targets.length, 1);
  assert.equal(overlay.targets[0].tensorIndex, 7);
  assert.deepEqual(
    overlay.targets[0].outputFactors,
    validateManifestFile().manifest.testVector.primaryOverlay.outputFactors
  );
  assert.deepEqual(
    overlay.targets[0].inputFactors,
    validateManifestFile().manifest.testVector.primaryOverlay.inputFactors
  );
});

test("matches the frozen direct component and output vectors", () => {
  const vector = validateManifestFile().manifest.testVector;
  const overlay = parseSpecialistOverlay(frozenBytes(), frozenExpected());
  const result = applySpecialistOverlay(
    overlay,
    7,
    vector.inputVector,
    vector.sourceCases[0].expectedBaseOutput
  );
  assert.deepEqual(result.scratch, expectedPrimary.componentDots);
  assert.deepEqual(
    result.output,
    vector.sourceCases[0].expectedPrimaryOutput
  );
});

test("matches materialized references for f32 q8 q5 and q4 sources", () => {
  const vector = validateManifestFile().manifest.testVector;
  const overlay = parseSpecialistOverlay(frozenBytes(), frozenExpected());
  const tolerance = vector.differentialCriteria
    .directVersusMaterializedAbsoluteToleranceByDtype;
  for (const source of vector.sourceCases) {
    const weights = decodeSourceWeights(source, 3, 8);
    const base = matvec(weights, vector.inputVector, 3, 8);
    const direct = applySpecialistOverlay(
      overlay, 7, vector.inputVector, base).output;
    const materialized = materializedOverlayMatvec(
      overlay, 7, weights, vector.inputVector);
    assert.deepEqual(direct, source.expectedPrimaryOutput);
    for (let row = 0; row < 3; row += 1) {
      assert.ok(Math.abs(direct[row] - materialized[row]) <=
        tolerance[source.name]);
    }
  }
});

test("returns an untargeted base output without aliasing it", () => {
  const overlay = parseSpecialistOverlay(frozenBytes(), frozenExpected());
  const base = [1, 2, 3];
  const result = applySpecialistOverlay(overlay, 6, [1], base);
  assert.deepEqual(result.output, base);
  assert.notEqual(result.output, base);
  assert.deepEqual(result.scratch, []);
});

test("parses sorted multiple targets and rejects order or padding drift", () => {
  const bytes = twoTargetBytes();
  const overlay = parseSpecialistOverlay(
    bytes, frozenExpected(sha256(bytes)));
  assert.equal(overlay.targets.length, 2);
  assert.deepEqual(overlay.targets.map((target) => target.tensorIndex), [6, 7]);
  assert.equal(overlay.maximumFactorRank, 2);
  assert.deepEqual(
    applySpecialistOverlay(overlay, 6, [2], [1]).output,
    [1.25]
  );

  const duplicate = twoTargetBytes();
  duplicate.writeUInt32LE(6, 448);
  assert.throws(() => parseMutated(duplicate));

  const offset = twoTargetBytes();
  offset.writeBigUInt64LE(641n, 448 + 56);
  assert.throws(() => parseMutated(offset));

  const padding = twoTargetBytes();
  padding[600] = 1;
  assert.throws(() => parseMutated(padding));
});

test("rejects package identity base binding and unknown expected fields", () => {
  assert.throws(
    () => parseSpecialistOverlay(frozenBytes(), frozenExpected("aa".repeat(32))),
    /package SHA-256/u
  );
  const base = frozenExpected();
  base.base.executionProfileSha256 = "aa".repeat(32);
  assert.throws(
    () => parseSpecialistOverlay(frozenBytes(), base),
    /base digest 6/u
  );
  const unknown = frozenExpected();
  unknown.compatibility = true;
  assert.throws(
    () => parseSpecialistOverlay(frozenBytes(), unknown),
    /expected keys/u
  );
});

test("rejects malformed envelope layout tags and canonical padding", () => {
  for (const [offset, value] of [
    [0, 88],
    [4, 2],
    [8, 0],
    [12, 1],
    [16, 0],
    [20, 0],
    [24, 0],
    [32, 0],
    [40, 0],
    [48, 2],
    [52, 2],
    [56, 2],
    [60, 2],
    [288, 1],
    [575, 1]
  ]) {
    const bytes = frozenBytes();
    if ([0, 288, 575].includes(offset)) bytes[offset] = value;
    else bytes.writeUInt32LE(value, offset);
    assert.throws(() => parseMutated(bytes));
  }
  const trailing = Buffer.concat([frozenBytes(), Buffer.alloc(64)]);
  assert.throws(() => parseMutated(trailing));

  const overTargets = frozenBytes();
  overTargets.writeUInt32LE(257, 16);
  assert.throws(() => parseMutated(overTargets), /target count/u);
});

test("rejects malformed target identity shape and ranges", () => {
  for (const [offset, value] of [
    [0, 6],
    [4, 0],
    [8, 0],
    [12, 0],
    [24, 2],
    [28, 8],
    [32, 1],
    [36, 4],
    [40, 4],
    [44, 1],
    [48, 1],
    [52, 0],
    [56, 0],
    [64, 0],
    [72, 0],
    [80, 0],
    [120, 1]
  ]) {
    const bytes = frozenBytes();
    bytes.writeUInt32LE(value, 320 + offset);
    assert.throws(() => parseMutated(bytes));
  }
  const name = frozenBytes();
  name.writeBigUInt64LE(0n, 336);
  assert.throws(() => parseMutated(name));

  const overRank = frozenBytes();
  overRank.writeUInt32LE(65, 324);
  assert.throws(() => parseMutated(overRank), /factor shape/u);

  const unsupported = frozenBytes();
  unsupported.writeUInt32LE(99, 344);
  const expected = frozenExpected(sha256(unsupported));
  expected.tensors[7].dtype = 99;
  assert.throws(
    () => parseSpecialistOverlay(unsupported, expected),
    /source dtype/u
  );
});

test("rejects factor hash nonfinite empty-component and call-shape failures", () => {
  const mismatch = frozenBytes();
  mismatch[448] ^= 1;
  assert.throws(() => parseMutated(mismatch), /factor SHA-256/u);

  const nonfinite = frozenBytes();
  nonfinite.writeFloatLE(Number.NaN, 448);
  refreshFactorHash(nonfinite);
  assert.throws(() => parseMutated(nonfinite), /nonfinite/u);

  const empty = frozenBytes();
  for (let index = 0; index < 3; index += 1) {
    empty.writeFloatLE(0, 448 + index * 4);
  }
  refreshFactorHash(empty);
  assert.throws(() => parseMutated(empty), /empty rank component/u);

  const overlay = parseSpecialistOverlay(frozenBytes(), frozenExpected());
  assert.throws(
    () => applySpecialistOverlay(overlay, 7, [1], [1, 2, 3]),
    /call shape/u
  );
});
