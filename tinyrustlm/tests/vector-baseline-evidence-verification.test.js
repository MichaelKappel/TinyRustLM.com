"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  attemptRelativePaths,
  finalizeReceipt,
  receiptIdentity,
  receiptPath,
  receiptSchema,
  validateReceipt,
  verificationInputPaths
} = require("../tools/vector-baseline-evidence-verification.js");
const {
  canonicalPrettyBytes,
  observationAuthority,
  openGaps
} = require("../tools/vector-baseline-evidence-observation.js");

const repositoryRoot = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixtureReceipt() {
  return JSON.parse(fs.readFileSync(receiptPath, "utf8"));
}

function refinalize(receipt) {
  const body = clone(receipt);
  delete body.receiptId;
  delete body.receiptContentHash;
  return finalizeReceipt(body);
}

test("validates the historical observation, retained failure, and passing retry", () => {
  const receipt = fixtureReceipt();
  const identity = receiptIdentity(receipt);

  assert.equal(validateReceipt(receipt), receipt);
  assert.equal(receipt.schema, receiptSchema);
  assert.deepEqual(identity, {
    id: receipt.receiptId,
    hash: receipt.receiptContentHash
  });
  assert.deepEqual(receipt.attempts.map((attempt) => attempt.status),
    ["fail", "pass"]);
  assert.equal(receipt.evidenceSummary.qualityLaneCount, 6);
  assert.equal(receipt.evidenceSummary.perQueryMetricCount, 790);
  assert.equal(receipt.evidenceSummary.crashScenarioCount, 4);
  assert.equal(receipt.evidenceSummary.preservedFailedAttemptCount, 1);
  assert.equal(receipt.evidenceSummary.successfulAttemptCount, 1);
  assert.equal(receipt.evidenceSummary.directoryFlushSuccessCount, 0);
  assert.equal(receipt.evidenceSummary.powerLossClaimed, false);
  assert.deepEqual(receipt.authority, observationAuthority);
  assert.deepEqual(receipt.openGaps, openGaps);
  assert.ok(canonicalPrettyBytes(receipt).length < 2 * 1024 * 1024);
});

test("independently retains exact natural and controlled quality bounds", () => {
  const summary = fixtureReceipt().evidenceSummary;

  assert.deepEqual(summary.naturalUtilities, [
    {
      laneId: "fashion-mnist-euclidean-784",
      macroLabelPrecisionAt10: 0.6975,
      macroLabelMrrAt10: 0.859375,
      macroLabelNdcgAt10: 0.7207703669488422
    },
    {
      laneId: "fashion-mnist-cosine-784",
      macroLabelPrecisionAt10: 0.6775,
      macroLabelMrrAt10: 0.8458035714285715,
      macroLabelNdcgAt10: 0.7001638538707916
    }
  ]);
  assert.equal(summary.allExactNumericalRowsPassed, true);
  assert.equal(summary.controlledMemoryPolicyPassed, true);
  assert.equal(summary.activeDeletionAndRestartPassed, true);
  assert.equal(summary.resultDrivenThresholdChanges, false);
  assert.deepEqual(summary.crashRows.map((row) => ({
    generation: row.observedActiveGenerationBeforeRetry,
    committed: row.deletionCommittedBeforeRetry,
    idempotent: row.retryIdempotent
  })), [
    { generation: 1, committed: false, idempotent: true },
    { generation: 1, committed: false, idempotent: true },
    { generation: 1, committed: false, idempotent: true },
    { generation: 2, committed: true, idempotent: true }
  ]);
});

test("rejects recomputed input, observation, attempt, and summary drift", () => {
  const input = clone(fixtureReceipt());
  input.verificationInputs[0].sha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(refinalize(input)),
    /verification input 0 does not match its historical source revision/u);

  const unavailableRevision = clone(fixtureReceipt());
  unavailableRevision.verificationSourceRevision = "0".repeat(40);
  assert.throws(() => validateReceipt(refinalize(unavailableRevision)),
    /verification source commit is unavailable/u);

  const observation = clone(fixtureReceipt());
  observation.observation.fileSha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(refinalize(observation)),
    /verification observation is invalid/u);

  const attempt = clone(fixtureReceipt());
  attempt.attempts[0].status = "pass";
  assert.throws(() => validateReceipt(refinalize(attempt)),
    /verification attempts is invalid/u);

  const summary = clone(fixtureReceipt());
  summary.evidenceSummary.perQueryMetricCount = 789;
  assert.throws(() => validateReceipt(refinalize(summary)),
    /verification evidence summary is invalid/u);
});

test("rejects authority, gap, private-path, unknown-field, and identity inflation", () => {
  const authority = clone(fixtureReceipt());
  authority.authority.compressedRetrievalVerified = true;
  assert.throws(() => validateReceipt(refinalize(authority)),
    /verification authority is invalid/u);

  const gaps = clone(fixtureReceipt());
  gaps.openGaps.pop();
  assert.throws(() => validateReceipt(refinalize(gaps)),
    /verification open gaps is invalid/u);

  const privatePath = clone(fixtureReceipt());
  privatePath.verificationTool.version = "node /home/private/build";
  assert.throws(() => validateReceipt(refinalize(privatePath)),
    /private path/u);

  const unknown = clone(fixtureReceipt());
  unknown.verificationTool.command = "node";
  assert.throws(() => validateReceipt(refinalize(unknown)),
    /verification tool fields are invalid/u);

  const staleIdentity = clone(fixtureReceipt());
  staleIdentity.evidenceSummary.qualityLaneCount = 5;
  assert.throws(() => validateReceipt(staleIdentity), /content identity is invalid/u);
});

test("binds the exact two content-addressed attempts and never reruns evidence", () => {
  assert.equal(attemptRelativePaths.length, 2);
  assert.equal(new Set(attemptRelativePaths).size, 2);
  for (const relativePath of attemptRelativePaths) {
    assert.match(relativePath,
      /\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/u);
    assert.equal(verificationInputPaths.includes(relativePath), true);
  }
  assert.equal(verificationInputPaths.includes(
    "tinyrustlm/experiments/vector-quantization/" +
      "exact-flat-baseline-evidence-observation-v1.json"
  ), true);
  const source = fs.readFileSync(
    path.join(repositoryRoot,
      "tinyrustlm/tools/vector-baseline-evidence-verification.js"),
    "utf8"
  );
  assert.equal(source.includes("\"--quality\""), false);
  assert.equal(source.includes("\"--crash\""), false);
  assert.equal(source.includes("\"--recover\""), false);
  const before = fs.existsSync(receiptPath) ? fs.readFileSync(receiptPath) : null;
  fixtureReceipt();
  const after = fs.existsSync(receiptPath) ? fs.readFileSync(receiptPath) : null;
  assert.deepEqual(after, before);
});
