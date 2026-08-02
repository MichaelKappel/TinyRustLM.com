"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  attemptSpecs,
  authority,
  buildReceipt,
  finalizeReceipt,
  loadAttemptEvidence,
  receiptIdentity,
  receiptSchema,
  validateReceipt,
  verificationInputPaths
} = require("../tools/vector-physical-target-verification.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function refinalize(value) {
  const body = clone(value);
  delete body.receiptId;
  delete body.receiptContentHash;
  return finalizeReceipt(body);
}

test("builds a child receipt from the immutable target observation and both attempts", () => {
  const receipt = buildReceipt();
  assert.equal(receipt.schema, receiptSchema);
  assert.equal(receipt.evidenceSummary.workloadCount, 3);
  assert.equal(receipt.evidenceSummary.processRuns, 9);
  assert.equal(receipt.evidenceSummary.rawQuerySamples, 324);
  assert.equal(receipt.evidenceSummary.passingAttempts, 1);
  assert.equal(receipt.evidenceSummary.preservedFailureAttempts, 1);
  assert.equal(receipt.evidenceSummary.energyMeasured, false);
  assert.equal(receipt.authority.namedTargetLatencyVerified, true);
  assert.equal(receipt.authority.namedTargetEnergyVerified, false);
  assert.equal(receipt.authority.productIntegrationAuthorized, false);
  assert.equal(receipt.verificationInputs.length, verificationInputPaths.length);
  assert.deepEqual(validateReceipt(clone(receipt)), receipt);
  assert.deepEqual(receiptIdentity(receipt), {
    id: receipt.receiptId,
    hash: receipt.receiptContentHash
  });
});

test("reopens the preserved failure and pass attempt without rewriting history", () => {
  const attempts = loadAttemptEvidence();
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts.map((attempt) => attempt.status), ["fail", "pass"]);
  assert.deepEqual(attempts.map((attempt) => attempt.attemptId),
    attemptSpecs.map((attempt) => attempt.attemptId));
  assert.match(attempts[0].fileSha256, /^[a-f0-9]{64}$/u);
  assert.match(attempts[1].fileSha256, /^[a-f0-9]{64}$/u);
});

test("rejects authority, metric, attempt, and gap inflation after identity refresh", () => {
  const authorityDrift = clone(buildReceipt());
  authorityDrift.authority.namedTargetEnergyVerified = true;
  assert.throws(() => validateReceipt(refinalize(authorityDrift)), /authority is invalid/u);

  const metricDrift = clone(buildReceipt());
  metricDrift.evidenceSummary.aggregates[0].queryP50Ns += 1;
  assert.throws(() => validateReceipt(refinalize(metricDrift)), /evidenceSummary is invalid/u);

  const attemptDrift = clone(buildReceipt());
  attemptDrift.attempts[0].status = "pass";
  assert.throws(() => validateReceipt(refinalize(attemptDrift)), /receipt attempts is invalid/u);

  const gapDrift = clone(buildReceipt());
  gapDrift.openGaps.shift();
  assert.throws(() => validateReceipt(refinalize(gapDrift)), /openGaps is invalid/u);
});

test("rejects verification input drift, unknown fields, and stale identity", () => {
  const inputDrift = clone(buildReceipt());
  inputDrift.verificationInputs[0].sha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(refinalize(inputDrift)),
    /verificationInputs\[0\] is invalid/u);

  const unknown = clone(buildReceipt());
  unknown.passed = true;
  assert.throws(() => validateReceipt(refinalize(unknown)), /receipt fields are invalid/u);

  const stale = clone(buildReceipt());
  stale.receiptId = "exact-flat-physical-target-verification-" + "0".repeat(16);
  assert.throws(() => validateReceipt(stale), /receipt content identity is invalid/u);

  assert.equal(authority.completePhysicalTargetGateVerified, false);
  assert.equal(authority.releaseAuthorized, false);
});
