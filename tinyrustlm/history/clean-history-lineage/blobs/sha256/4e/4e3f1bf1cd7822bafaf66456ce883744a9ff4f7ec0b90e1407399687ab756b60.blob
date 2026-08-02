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
  expectedAttemptInputPaths,
  expectedSchedule,
  finiteInDomain,
  loadTerminalAttempt,
  maximumAttemptCount,
  maximumBenchmarkProcessCount,
  maximumMonitorProcessCount,
  maximumRetryCount,
  validateQualityPayload,
  validateReceiptFile,
  validateTerminalAttempt,
  verificationPath
} = require(
  "../tools/vector-portable-affine-u8-json-domain-v2-verification.js"
);

const repositoryRoot = path.resolve(__dirname, "../..");
const verifierPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-verification.js"
);

test("derives the frozen 77-process schedule independently", () => {
  const schedule = expectedSchedule();
  assert.equal(schedule.length, maximumBenchmarkProcessCount);
  assert.equal(maximumBenchmarkProcessCount, 77);
  assert.equal(maximumMonitorProcessCount, 60);
  assert.equal(maximumAttemptCount, 1);
  assert.equal(maximumRetryCount, 0);
  assert.deepEqual(
    schedule.slice(0, 17).map((entry) => entry.mode),
    [
      "contract",
      ...Array(7).fill("corruption"),
      "crash",
      "recover",
      "crash",
      "recover",
      "crash",
      "recover",
      "crash",
      "recover",
      "quality"
    ]
  );
  assert.equal(
    schedule.filter((entry) => entry.mode === "performance").length,
    60
  );
  assert.deepEqual(schedule[67].publicArguments, [
    "controlled-memory-cosine-64",
    "exact-full"
  ]);
});

test("rehashes the exact terminal attempt without importing its runner", () => {
  const loaded = loadTerminalAttempt();
  assert.equal(loaded.evidence.sha256, expectedAttemptFileSha256);
  assert.equal(loaded.attempt.attemptId, expectedAttemptId);
  assert.equal(
    loaded.attempt.attemptContentHash,
    expectedAttemptContentHash
  );
  assert.equal(loaded.attempt.inputs.length, expectedAttemptInputPaths.length);
});

test("independently verifies the bounded terminal finding", () => {
  const summary = validateTerminalAttempt();
  assert.equal(summary.attempt.status, "fail-instrumentation-terminal");
  assert.equal(summary.processSummary.benchmarkProcessCount, 68);
  assert.equal(summary.processSummary.performanceBenchmarkProcessCount, 51);
  assert.equal(summary.processSummary.memoryMonitorProcessCount, 51);
  assert.equal(summary.processSummary.successfulMemoryMonitorProcessCount, 50);
  assert.equal(summary.processSummary.failedMemoryMonitorOrdinal, 51);
  assert.equal(summary.retainedSummary.qualityProcessPassed, true);
  assert.equal(summary.retainedSummary.quality.laneCount, 6);
  assert.equal(summary.retainedSummary.quality.perQueryMetricCount, 790);
  assert.equal(summary.retainedSummary.performanceRecordsRetained, 0);
  assert.equal(summary.retainedSummary.performanceSummariesRetained, 0);
  assert.equal(summary.independentDecision.serializerDefectCrossed, true);
  assert.equal(summary.independentDecision.fullFrozenSuiteCompleted, false);
  assert.equal(
    summary.independentDecision.qualityThresholdVerdictAvailable,
    false
  );
  assert.equal(
    summary.independentDecision.performanceThresholdVerdictAvailable,
    false
  );
  assert.equal(
    summary.independentDecision.campaignCounterMayBeIncremented,
    false
  );
  assert.equal(
    Object.values(authority).every((value) => value === false),
    true
  );
});

test("accepts wide nonnegative errors and signed utility deltas", () => {
  assert.equal(finiteInDomain(355.649, 0, Number.MAX_VALUE, "error"), 355.649);
  assert.equal(finiteInDomain(-0.2, -1, 1, "delta"), -0.2);
  assert.throws(
    () => finiteInDomain(-0.001, 0, Number.MAX_VALUE, "error"),
    /out of domain/u
  );
  assert.throws(
    () => finiteInDomain(Number.NaN, -1, 1, "delta"),
    /not finite/u
  );
});

test("rejects a negative error in the retained quality payload", () => {
  const loaded = loadTerminalAttempt();
  const quality = loaded.attempt.retainedEvidence.quality;
  const original = quality.perQueryMetrics[0]
    .maximumAbsoluteNormalizedScoreError;
  quality.perQueryMetrics[0].maximumAbsoluteNormalizedScoreError = -1;
  assert.throws(
    () => validateQualityPayload(quality),
    /out of domain/u
  );
  quality.perQueryMetrics[0].maximumAbsoluteNormalizedScoreError = original;
});

test("contains no runner import or outcome command invocation", () => {
  const source = fs.readFileSync(verifierPath, "utf8");
  assert.doesNotMatch(
    source,
    /require\([^)]*vector-portable-affine-u8-json-domain-v2-observation/u
  );
  assert.doesNotMatch(source, /runAndWriteObservation\s*\(/u);
  assert.doesNotMatch(source, /generateObservation\s*\(/u);
  assert.doesNotMatch(source, /["']--quality["']/u);
  assert.doesNotMatch(source, /["']--performance["']/u);
  assert.match(source, /git\(\s*\[/u);
});

test("validates an immutable receipt when one has been committed", () => {
  if (!fs.existsSync(verificationPath)) return;
  const result = validateReceiptFile();
  assert.equal(
    result.receipt.status,
    "verified-terminal-instrumentation-failure"
  );
  assert.equal(
    result.receipt.authority.campaignCounterMayBeIncremented,
    false
  );
});
