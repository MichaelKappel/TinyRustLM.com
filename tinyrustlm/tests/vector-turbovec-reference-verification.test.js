"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  finalizeReceipt,
  independentEvidenceSummary,
  receiptIdentity,
  receiptSchema,
  validateReceipt,
  verificationInputPaths
} = require("../tools/vector-turbovec-reference-verification.js");
const {
  corruptionCases,
  crashScenarios,
  expectedExperimentId,
  expectedLanes,
  finalizePendingAttempt,
  observationAuthority,
  openGaps,
  pendingAttemptSchema
} = require("../tools/vector-turbovec-reference-observation.js");
const {
  validateManifestFile
} = require("../tools/vector-turbovec-reference-preregistration.js");

const repositoryRoot = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0);
  return result.stdout.trim();
}

function laneResult(lane) {
  return {
    laneId: lane.laneId,
    candidateDynamicIndexBytes: lane.candidateDynamicIndexBytes,
    exactFullIndexBytes: lane.exactFullIndexBytes,
    capacityMatchedExactRecordCount: lane.capacityMatchedExactRecordCount,
    capacityMatchedExactIndexBytes: lane.capacityMatchedExactIndexBytes,
    deterministicBuildBytesMatch: true,
    deterministicSearchOutputsMatch: true,
    reloadSearchOutputsMatch: true,
    persistentRatioToFullExact:
      lane.candidateDynamicIndexBytes / lane.exactFullIndexBytes,
    sameCorpus: {
      minimumRecallAt1: 1,
      minimumRecallAt10: 1,
      minimumRecallAt100: 1,
      minimumMrrAt100: 1,
      minimumNdcgAt100: 1,
      maximumRankInversionRateAt100: 0,
      meanAbsoluteNormalizedScoreError: 0,
      p99AbsoluteNormalizedScoreError: 0,
      nonFiniteScoreCount: 0,
      duplicateResultCount: 0,
      missingResultCount: 0
    },
    naturalUtility: lane.laneKind === "natural"
      ? {
          macroLabelPrecisionAt10: 1,
          macroLabelMrrAt10: 1,
          macroLabelNdcgAt10: 1
        }
      : null,
    controlledUtility: lane.laneKind === "controlled-memory"
      ? {
          expectedFirstHitRate: 1,
          forbiddenHitRateAt10: 0,
          deletedHitCount: 0,
          filterViolationCount: 0
        }
      : null
  };
}

function queryRows(lane) {
  const hitCount = lane.laneKind === "controlled-memory" ? 8 : 100;
  return Array.from({ length: lane.queryCount }, (_unused, ordinal) => ({
    laneId: lane.laneId,
    queryOrdinal: ordinal,
    candidate: {
      nonFiniteScoreCount: 0,
      duplicateResultCount: 0,
      missingResultCount: 0
    },
    candidateResultCount: hitCount,
    candidateResultDigest: "a".repeat(64),
    rawCandidateScores: Array(hitCount).fill(1),
    declaredScores: Array(hitCount).fill(1)
  }));
}

function performanceFixture() {
  const records = [];
  const summaries = [];
  let processOrdinal = 0;
  for (const [laneOrdinal, lane] of expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const [scheduledMethodOrdinal, method] of methods.entries()) {
        const candidate = method === "candidate";
        processOrdinal += 1;
        records.push({
          processOrdinal,
          laneOrdinal,
          repetition,
          scheduledMethodOrdinal,
          processRootDeleted: true,
          process: {
            laneId: lane.laneId,
            method,
            measuredQueryNanoseconds:
              Array(lane.queryCount * 5).fill(candidate ? 120 : 100),
            memoryMonitorHandshake: true
          },
          memory: {
            monitorExitCode: 0
          }
        });
      }
    }
    summaries.push({
      laneId: lane.laneId,
      medianLatencyRatio: 1.2,
      p95LatencyRatio: 1.2,
      maximumCandidateColdFirstQueryNanoseconds: 2_000_000,
      maximumCandidateBuildNanoseconds: 3_000_000,
      maximumCandidatePeakWorkingSetBytes: 120_000_000,
      maximumPeakWorkingSetRatioToExact: 1.2,
      maximumPostPrepareWorkingSetRatioToExact: 1.2,
      persistentRatioToExact:
        lane.candidateDynamicIndexBytes /
        (280 + lane.sourceActiveRecordCount *
          (16 + 4 * lane.originalDimension)),
      thresholdsPassed: true
    });
  }
  return { records, summaries };
}

function observationFixture() {
  const pending = finalizePendingAttempt({
    schema: pendingAttemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
    startedAtUtc: "2020-01-01T00:00:00.000Z",
    sourceRevision: currentRevision(),
    preregistrationSha256: validateManifestFile().sha256
  });
  const performance = performanceFixture();
  return {
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    attemptStartedAtUtc: pending.startedAtUtc,
    pendingAttemptId: pending.pendingAttemptId,
    pendingAttemptContentHash: pending.pendingAttemptContentHash,
    sourceRevision: pending.sourceRevision,
    quality: {
      laneResults: expectedLanes.map(laneResult),
      perQueryMetrics: expectedLanes.flatMap(queryRows)
    },
    performanceRecords: performance.records,
    performanceSummaries: performance.summaries,
    corruptionRecords: corruptionCases.map((caseId) => ({
      caseId,
      processRootDeleted: true,
      process: {
        rejected: true,
        rejectedBeforeUpstreamLoad: true,
        upstreamLoadAttemptCount: 0,
        panicObserved: false
      }
    })),
    crashRecoveries: crashScenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      processRootDeleted: true,
      recovery: {
        observedActiveGenerationBeforeRetry:
          scenario.expectedActiveGenerationBeforeRetry,
        deletionCommittedBeforeRetry: scenario.deletionCommittedBeforeRetry,
        retryWroteGenerationTwo: scenario.retryWroteGenerationTwo,
        retryIdempotent: true,
        finalTargetIdentifierMatches: 0,
        finalTargetVectorFingerprintMatches: 0,
        activeIndexContainsDeletedTarget: false,
        deletedTargetSearchMatches: 0
      }
    })),
    cleanup: {
      processRootCount: 72,
      processRootsDeleted: 72,
      outerRootDeleted: true
    }
  };
}

function receiptFixture() {
  const manifest = validateManifestFile();
  const revision = currentRevision();
  const attemptPath =
    "tinyrustlm/experiments/vector-quantization/" +
    "turbovec-reference-attempts/sha256/ee/" + "e".repeat(64) + ".json";
  const paths = verificationInputPaths([{ relativePath: attemptPath }]);
  const summary = independentEvidenceSummary(observationFixture(), 1);
  return finalizeReceipt({
    schema: receiptSchema,
    experimentId: expectedExperimentId,
    status: "verified-with-bounded-authority",
    generatedAtUtc: "2026-07-25T23:00:00.000Z",
    observedSourceRevision: revision,
    verificationSourceRevision: revision,
    verificationMode:
      "independent-content-summary-revalidation-without-benchmark-rerun",
    verificationTool: {
      version: "v24.4.1",
      binaryBytes: 1024,
      binarySha256: "a".repeat(64)
    },
    verificationInputs: paths.map((inputPath, index) => ({
      path: inputPath,
      bytes: index + 1,
      sha256: "b".repeat(64)
    })),
    preregistration: {
      path: "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison-preregistration.v1.json",
      sha256: manifest.sha256
    },
    observation: {
      path: "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison-observation-v1.json",
      observationId: "turbovec-reference-comparison-" + "c".repeat(16),
      observationContentHash: "c".repeat(64),
      fileBytes: 4096,
      fileSha256: "d".repeat(64)
    },
    attempts: [{
      path: attemptPath,
      attemptId: "turbovec-reference-attempt-" + "e".repeat(16),
      attemptOrdinal: 1,
      status: "pass",
      retryAllowed: false,
      attemptContentHash: "e".repeat(64),
      fileBytes: 1024,
      fileSha256: "f".repeat(64),
      sourceRevision: revision
    }],
    evidenceSummary: summary,
    authority: clone(observationAuthority),
    openGaps: clone(openGaps),
    requiredNextGate: manifest.manifest.requiredNextGate
  });
}

function refinalize(receipt) {
  const body = clone(receipt);
  delete body.receiptId;
  delete body.receiptContentHash;
  return finalizeReceipt(body);
}

test("independently summarizes all bounded evidence without a benchmark rerun", () => {
  const summary = independentEvidenceSummary(observationFixture(), 1);

  assert.equal(summary.qualityLaneCount, 6);
  assert.equal(summary.perQueryMetricCount, 790);
  assert.equal(summary.performanceProcessCount, 60);
  assert.equal(summary.corruptionCaseCount, 7);
  assert.equal(summary.crashScenarioCount, 4);
  assert.equal(summary.allOwnedProcessRootsDeleted, true);
  assert.equal(summary.pendingAttemptBindingVerified, true);
  assert.equal(summary.productAdoptionAuthorized, false);
  assert.deepEqual(summary.performanceRows.map((row) =>
    row.pairedProcessCount), Array(6).fill(10));
});

test("independent summary rejects quality, timing, corruption, and recovery drift", () => {
  const pending = observationFixture();
  pending.attemptOrdinal = 2;
  assert.throws(() => independentEvidenceSummary(pending),
    /pending attempt binding/u);

  const quality = observationFixture();
  quality.quality.laneResults[0].sameCorpus.minimumRecallAt1 = 0.69;
  assert.throws(() => independentEvidenceSummary(quality),
    /quality lane failed/u);

  const scores = observationFixture();
  scores.quality.perQueryMetrics[0].rawCandidateScores[1] = 2;
  assert.throws(() => independentEvidenceSummary(scores),
    /raw ordering differs/u);

  const timing = observationFixture();
  timing.performanceSummaries[1].medianLatencyRatio = 1.3;
  assert.throws(() => independentEvidenceSummary(timing),
    /median ratio/u);

  const schedule = observationFixture();
  schedule.performanceRecords[0].processOrdinal = 2;
  assert.throws(() => independentEvidenceSummary(schedule),
    /performance schedule/u);

  const methodOrder = observationFixture();
  methodOrder.performanceRecords[0].scheduledMethodOrdinal = 1;
  assert.throws(() => independentEvidenceSummary(methodOrder),
    /performance schedule/u);

  const corruption = observationFixture();
  corruption.corruptionRecords[2].process.rejectedBeforeUpstreamLoad = false;
  assert.throws(() => independentEvidenceSummary(corruption),
    /corruption coverage/u);

  const recovery = observationFixture();
  recovery.crashRecoveries[3].recovery.deletedTargetSearchMatches = 1;
  assert.throws(() => independentEvidenceSummary(recovery),
    /crash recovery/u);
});

test("verification receipt identity retains bounded authority and attempt count", () => {
  const receipt = receiptFixture();

  assert.equal(validateReceipt(receipt, { recomputeInputs: false }), receipt);
  assert.deepEqual(receiptIdentity(receipt), {
    id: receipt.receiptId,
    hash: receipt.receiptContentHash
  });
  assert.equal(receipt.evidenceSummary.preservedAttemptCount, 1);
  assert.equal(receipt.authority.productIntegrationVerified, false);
  assert.equal(receipt.authority.trainingAuthorized, false);
  assert.equal(receipt.authority.releaseAuthorized, false);
});

test("verification receipt rejects summary, authority, input, and identity drift", () => {
  const summary = clone(receiptFixture());
  summary.evidenceSummary.performanceProcessCount = 59;
  assert.throws(() => validateReceipt(
    refinalize(summary),
    { recomputeInputs: false }
  ),
    /evidence summary/u);

  const authority = clone(receiptFixture());
  authority.authority.productIntegrationVerified = true;
  assert.throws(() => validateReceipt(
    refinalize(authority),
    { recomputeInputs: false }
  ),
    /verification authority/u);

  const input = clone(receiptFixture());
  input.verificationInputs[0].unexpected = true;
  assert.throws(() => validateReceipt(
    refinalize(input),
    { recomputeInputs: false }
  ),
    /verification input 0 fields/u);

  const stale = clone(receiptFixture());
  stale.openGaps.pop();
  assert.throws(() => validateReceipt(stale, { recomputeInputs: false }),
    /content identity/u);
});

test("verification inputs include the observation and verifier exactly once", () => {
  const paths = verificationInputPaths([]);

  assert.equal(paths.length, new Set(paths).size);
  assert.equal(paths.includes(
    "tinyrustlm/experiments/vector-quantization/" +
      "turbovec-reference-comparison-observation-v1.json"
  ), true);
  assert.equal(paths.includes(
    "tinyrustlm/tools/vector-turbovec-reference-verification.js"
  ), true);
  assert.equal(paths.includes(
    "tinyrustlm/tests/vector-turbovec-reference-verification.test.js"
  ), true);
});

test("the verifier source cannot invoke comparison process modes", () => {
  const source = fs.readFileSync(
    path.join(
      repositoryRoot,
      "tinyrustlm/tools/vector-turbovec-reference-verification.js"
    ),
    "utf8"
  );
  for (const forbidden of [
    "\"--quality\"",
    "\"--performance\"",
    "\"--corruption\"",
    "\"--crash\"",
    "\"--recover\""
  ]) {
    assert.equal(source.includes(forbidden), false);
  }
});
