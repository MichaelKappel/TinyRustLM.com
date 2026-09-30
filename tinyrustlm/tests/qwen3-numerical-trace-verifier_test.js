"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { stageMetrics } = require("../tools/qwen3-numerical-trace-verifier.js");

const contract = "tinyrustlm.lossy-fidelity-and-f32-arithmetic/1";
const comparison = Object.freeze({ relativeFloor: 1e-6, signFloor: 1e-5, chunkElements: 64 });
const limits = Object.freeze({ maximumAbsoluteError: 0.02, maximumRelativeError: 0.05,
  maximumNormalizedRmse: 0.001, minimumCosineSimilarity: 0.99999,
  maximumSignDisagreementRate: 0.001, maximumUlp: 1048576 });

/** Encode synthetic F32 values without any model or trace-file fixture. */
function bytes(values) {
  const output = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => output.writeFloatLE(value, index * 4));
  return output;
}

/** Exercise the actual metric kernel with an explicit prospective arrow. */
function measure(reference, candidate, options = {}) {
  const stage = { stage: options.stage || "value", layer: 0,
    offsetBytes: 0, elementCount: reference.length };
  return stageMetrics(bytes(reference), bytes(candidate), stage, stage, comparison,
    options.limits || limits, options.legacy ? null : contract,
    options.arrow || "reconstructed-to-scalar");
}

test("prospective arithmetic admits independently constructed finite F32 reassociation", () => {
  const tiny = Math.fround(2 ** -25);
  const ordered = Math.fround(Math.fround(1 + tiny) - 1);
  const regrouped = Math.fround(Math.fround(1 - 1) + tiny);
  assert.equal(ordered, 0);
  assert.equal(regrouped, tiny);
  const values = measure([1, regrouped, -1, 0.5], [1, ordered, -1, 0.5]);
  assert.equal(values.maximumAbsoluteError, 2 ** -25);
  assert.equal(values.maximumUlp, 855638016);
  assert.equal(values.firstCoordinateFailure, null);
  assert.ok(values.maximumCombinedErrorRatio < 1);
});

test("historical strict arithmetic still rejects that same ULP difference", () => {
  const values = measure([1, 2 ** -25, -1, 0.5], [1, 0, -1, 0.5], { legacy: true });
  assert.deepEqual(values.firstCoordinateFailure, { element: 1, reasons: ["maximum-ulp"] });
  assert.equal(Object.hasOwn(values, "maximumCombinedErrorRatio"), false);
});

test("prospective lossy fidelity reports a small sign flip without a relative-only refusal", () => {
  const values = measure([1, 2 ** -18, -1, 0.5], [1, -(2 ** -18), -1, 0.5], {
    arrow: "source-to-reconstructed", limits: { ...limits, maximumAbsoluteError: 0.1,
      maximumRelativeError: 1, maximumUlp: 2147483647 }
  });
  assert.equal(values.maximumRelativeError, 2);
  assert.equal(values.firstCoordinateFailure, null);
  assert.equal(values.maximumCombinedErrorRatio, null);
  assert.ok(values.maximumNormalizedRmse < 0.00001);
});

test("combined arithmetic uses reference magnitude and locates its first failure", () => {
  const values = measure([1, 0.001, -1], [1, 0.0011, -1]);
  assert.ok(values.maximumAbsoluteError < limits.maximumAbsoluteError);
  assert.ok(values.maximumCombinedErrorRatio > 1);
  assert.deepEqual(values.firstCoordinateFailure, {
    element: 1, reasons: ["combined-coordinate-error"]
  });
});

test("hard coordinate errors remain fatal in both prospective arrows", () => {
  for (const arrow of ["source-to-reconstructed", "reconstructed-to-scalar"]) {
    const values = measure([1, 2, -3], [1, 2.5, -3], { arrow });
    assert.equal(values.firstCoordinateFailure.element, 1);
    assert.ok(values.firstCoordinateFailure.reasons.includes("maximum-absolute-error"));
  }
});

test("exact converted embedding rejects one bit and signed-zero differences", () => {
  for (const pair of [[[1, 2], [1 + 2 ** -23, 2]], [[0, 1], [-0, 1]]]) {
    const values = measure(...pair, { stage: "token-embedding" });
    assert.equal(values.exactElementMismatchCount, 1);
    assert.ok(values.firstCoordinateFailure.reasons.includes("exact-embedding-identity"));
  }
});

test("tiny-only vectors keep their aggregate error instead of receiving a blanket exemption", () => {
  const values = measure([1e-8, -1e-8], [0, 0]);
  assert.equal(values.firstCoordinateFailure, null);
  assert.ok(values.maximumNormalizedRmse > limits.maximumNormalizedRmse);
  assert.equal(values.minimumCosineSimilarity, 0);
  // A downstream finite gain can make an apparently tiny difference material.
  assert.ok(Math.abs(Math.fround(1e-8) * 1e8) > 0.99);
});

test("unknown metric identities and arrows fail closed", () => {
  const stage = { stage: "value", layer: 0, offsetBytes: 0, elementCount: 1 };
  for (const [identity, arrow] of [["unknown", "reconstructed-to-scalar"], [contract, "unknown"]]) {
    assert.throws(() => stageMetrics(bytes([1]), bytes([1]), stage, stage, comparison,
      limits, identity, arrow), /numerical-verifier-metric-contract/u);
  }
});

test("nonfinite inputs and overflowed combined allowances cannot be accepted", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => measure([1, value], [1, value]), /numerical-verifier-nonfinite/u);
  }
  assert.throws(() => measure([3e38], [3e38], {
    limits: { ...limits, maximumRelativeError: Number.MAX_VALUE }
  }), /numerical-verifier-metric-nonfinite/u);
});
