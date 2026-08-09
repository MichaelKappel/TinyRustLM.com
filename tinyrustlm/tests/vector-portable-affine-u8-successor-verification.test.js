"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  authority,
  expectedAttemptContentHash,
  expectedAttemptFileSha256,
  expectedAttemptId,
  expectedQualityExitCode,
  expectedQualityExitCodeHex,
  finalizeReceipt,
  inputPaths,
  receiptIdentity,
  requiredNextGate,
  schema,
  terminalSummary,
  validateSummary
} = require("../tools/vector-portable-affine-u8-successor-verification.js");
const successorRunner = require(
  "../tools/vector-portable-affine-u8-successor-observation.js"
);

const repositoryRoot = path.resolve(__dirname, "../..");
const verifierPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vector-portable-affine-u8-successor-verification.js"
);
const summary = terminalSummary();

test("binds retained build identity to the archived Cargo.lock input", () => {
  const attemptPath = path.join(
    repositoryRoot,
    "tinyrustlm/experiments/vector-quantization/" +
      "portable-affine-u8-flat-successor-attempts/sha256/" +
      expectedAttemptContentHash.slice(0, 2),
    `${expectedAttemptContentHash}.json`
  );
  const attempt = JSON.parse(fs.readFileSync(attemptPath, "utf8"));
  const cargoLockInput = attempt.inputs.find(
    (entry) => entry.path === "Cargo.lock"
  );
  assert.equal(
    attempt.retainedEvidence.build.cargoLockSha256,
    cargoLockInput.sha256
  );
  attempt.retainedEvidence.build.cargoLockSha256 = "0".repeat(64);
  assert.throws(
    () => successorRunner.validateAttempt(attempt),
    /observation build identity is invalid/u
  );
});

test("independently verifies the one terminal successor attempt", () => {
  assert.equal(summary.attempt.attemptId, expectedAttemptId);
  assert.equal(
    summary.attempt.attemptContentHash,
    expectedAttemptContentHash
  );
  assert.equal(summary.attempt.sha256, expectedAttemptFileSha256);
  assert.equal(summary.attempt.status, "fail-comparison-outcome-terminal");
  assert.equal(summary.inputClosure.inputCount, 43);
  assert.equal(summary.inputClosure.rawGitBlobMatchCount, 40);
  assert.equal(summary.inputClosure.crlfCheckoutMatchCount, 3);
  assert.equal(
    summary.inputClosure.checkoutTransformationLimitedToLfToCrlf,
    true
  );
  assert.equal(summary.inputClosure.everyInputRehashedAtSourceRevision, true);
  assert.equal(summary.processSummary.benchmarkProcessCount, 17);
  assert.equal(summary.processSummary.memoryMonitorProcessCount, 0);
  assert.equal(summary.processSummary.contractProcessPassed, true);
  assert.equal(summary.processSummary.corruptionProcessesPassed, 7);
  assert.equal(summary.processSummary.crashProcessesCompletedWithRegisteredExit, 4);
  assert.equal(summary.processSummary.recoveryProcessesPassed, 4);
});

test("records the quality fast-fail boundary without assigning a root cause", () => {
  assert.equal(summary.processSummary.qualityProcessStarted, true);
  assert.equal(
    summary.processSummary.qualityProcessExitCode,
    expectedQualityExitCode
  );
  assert.equal(
    summary.processSummary.qualityProcessExitCodeHex,
    expectedQualityExitCodeHex
  );
  assert.equal(summary.processSummary.qualityStdoutBytes, 0);
  assert.equal(summary.processSummary.qualityStderrBytes, 294);
  assert.match(
    summary.processSummary.qualityStderrSha256,
    /^[a-f0-9]{64}$/u
  );
  assert.equal(summary.processSummary.qualityRawOutputPersisted, false);
  assert.equal(summary.independentDecision.rootCauseDetermined, false);
  assert.equal(summary.independentDecision.windowsStatusNameClaimed, false);
});

test("denies retry, quality, performance, promotion, and campaign authority", () => {
  assert.equal(
    summary.independentDecision.sameSuccessorRetryAllowed,
    false
  );
  assert.equal(summary.independentDecision.qualityMetricsPresent, false);
  assert.equal(summary.independentDecision.performanceExecuted, false);
  assert.equal(
    summary.independentDecision.boundedResearchClaimSupported,
    false
  );
  assert.equal(summary.independentDecision.productPromotionAllowed, false);
  assert.equal(
    summary.independentDecision.campaignCounterMayBeIncremented,
    false
  );
  assert.equal(Object.values(authority).some(Boolean), false);
  assert.match(requiredNextGate, /distinct full successor/u);
});

test("summary validation rejects retry or result inflation", () => {
  assert.equal(validateSummary(summary), undefined);
  assert.throws(
    () => validateSummary({
      ...summary,
      independentDecision: {
        ...summary.independentDecision,
        sameSuccessorRetryAllowed: true
      }
    }),
    /independent terminal summary/u
  );
  assert.throws(
    () => validateSummary({
      ...summary,
      independentDecision: {
        ...summary.independentDecision,
        boundedResearchClaimSupported: true
      }
    }),
    /independent terminal summary/u
  );
});

test("verification receipt identity is deterministic and field-sensitive", () => {
  const body = {
    schema,
    receiptType: "portable-affine-u8-flat-successor-terminal-verification",
    experimentId: "portable-affine-u8-flat-successor-20260726",
    status: "verified-terminal-quality-process-failure",
    verifiedAtUtc: "2026-07-26T14:00:00.000Z"
  };
  const first = finalizeReceipt(body);
  const second = finalizeReceipt(body);
  assert.deepEqual(first, second);
  assert.match(
    first.receiptId,
    /^portable-affine-u8-flat-successor-verification-[a-f0-9]{16}$/u
  );
  assert.equal(
    receiptIdentity({
      ...first,
      status: "different"
    }).hash === first.receiptContentHash,
    false
  );
});

test("verification input closure is unique and includes code, attempt, and tests", () => {
  assert.equal(new Set(inputPaths).size, inputPaths.length);
  assert.equal(
    inputPaths.includes(
      "tinyrustlm/tools/vector-portable-affine-u8-successor-observation.js"
    ),
    true
  );
  assert.equal(
    inputPaths.some((entry) => entry.endsWith(expectedAttemptContentHash + ".json")),
    true
  );
  assert.equal(
    inputPaths.includes(
      "tinyrustlm/tests/vector-portable-affine-u8-successor-verification.test.js"
    ),
    true
  );
});

test("verifier cannot launch or reopen any benchmark outcome", () => {
  const source = fs.readFileSync(verifierPath, "utf8");
  assert.doesNotMatch(source, /runner\.runAndWriteObservation/u);
  assert.doesNotMatch(source, /runner\.reconcilePendingAttempt/u);
  assert.doesNotMatch(source, /runner\.installProcessRecorder/u);
  assert.doesNotMatch(source, /\["--(?:quality|performance|contract|corruption|crash|recover)"/u);
  assert.doesNotMatch(source, /atomicCreate\(runner\./u);
});
