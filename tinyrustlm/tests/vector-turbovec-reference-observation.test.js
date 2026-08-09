"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  attemptIdentity,
  attemptSchema,
  boundedFailure,
  canonicalPrettyBytes,
  cleanupWithFailurePolicy,
  contractSchema,
  corruptionCases,
  corruptionSchema,
  crashScenarios,
  expectedExperimentId,
  expectedLanes,
  expectedMethodId,
  executablePath,
  finalizeAttempt,
  finalizeObservation,
  finalizePendingAttempt,
  hashInput,
  inputPaths,
  loadPendingAttempt,
  memoryMonitorScript,
  offlineEnvironment,
  observationAuthority,
  observationIdentity,
  observationSchema,
  openGaps,
  pendingAttemptIdentity,
  pendingAttemptSchema,
  performanceSchema,
  preregistrationRelativePath,
  qualitySchema,
  reconcilePendingAttempt,
  recoverySchema,
  removePendingAttempt,
  sha256,
  spawnCapture,
  summarizePerformance,
  validateAttempt,
  validateContractOutput,
  validateCorruptionOutput,
  validateMemoryMeasurement,
  validateObservation,
  validatePendingAttempt,
  validatePerformanceExecutions,
  validatePerformanceOutput,
  validatePerformanceRecord,
  validateQualityOutput,
  validateRecoveryOutput,
  writePendingAttempt
} = require("../tools/vector-turbovec-reference-observation.js");
const {
  validateManifestFile
} = require("../tools/vector-turbovec-reference-preregistration.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const emptySha256 = sha256(Buffer.alloc(0));
const preregistrationSha256 =
  "96a3fad0078850e2fe9fb4d619979ca9e5b753f23a3fab6df53aebe9b9afe6ed";

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

function compact(value) {
  return `${JSON.stringify(value)}\n`;
}

function expectedClassOrTopic(lane, ordinal) {
  if (lane.laneKind === "natural") return Math.floor(ordinal / 20);
  if (lane.laneKind === "controlled-memory") return Math.floor(ordinal / 3);
  const counts = [30, 24, 24, 18, 12, 12];
  let offset = 0;
  for (const [family, count] of counts.entries()) {
    if (ordinal < offset + count) return family;
    offset += count;
  }
  throw new Error("fixture synthetic ordinal is invalid");
}

function rankingMetrics() {
  return {
    recallAt1: 1,
    recallAt10: 1,
    recallAt100: 1,
    mrrAt100: 1,
    ndcgAt100: 1,
    rankInversionsAt100: 0,
    rankInversionRateAt100: 0,
    maximumAbsoluteNormalizedScoreError: 0,
    meanAbsoluteNormalizedScoreError: 0,
    p99AbsoluteNormalizedScoreError: 0,
    nonFiniteScoreCount: 0,
    duplicateResultCount: 0,
    missingResultCount: 0
  };
}

function queryMetric(lane, laneOrdinal, ordinal) {
  const hitCount = lane.laneKind === "controlled-memory" ? 8 : 100;
  return {
    laneId: lane.laneId,
    queryOrdinal: ordinal,
    classOrTopic: expectedClassOrTopic(lane, ordinal),
    candidate: rankingMetrics(),
    capacityMatchedExact: rankingMetrics(),
    candidateResultCount: hitCount,
    candidateResultDigest: sha256(Buffer.from(
      `candidate-result/${laneOrdinal}/${ordinal}`,
      "utf8"
    )),
    rawCandidateScores:
      Array.from({ length: hitCount }, (_unused, index) => hitCount - index),
    declaredScores: Array.from(
      { length: hitCount },
      (_unused, index) =>
        lane.metric === "squared-euclidean" ? index : hitCount - index
    ),
    candidateAbsoluteNormalizedScoreErrors: Array(hitCount).fill(0),
    capacityMatchedExactAbsoluteNormalizedScoreErrors: Array(hitCount).fill(0),
    labelPrecisionAt10: lane.laneKind === "natural" ? 1 : null,
    labelMrrAt10: lane.laneKind === "natural" ? 1 : null,
    labelNdcgAt10: lane.laneKind === "natural" ? 1 : null,
    expectedFirstHit: lane.laneKind === "controlled-memory" ? true : null,
    forbiddenHitCountAt10: lane.laneKind === "controlled-memory" ? 0 : null,
    deletedHitCount: lane.laneKind === "controlled-memory" ? 0 : null,
    filterViolationCount: lane.laneKind === "controlled-memory" ? 0 : null
  };
}

function aggregateMetrics() {
  return {
    minimumRecallAt1: 1,
    minimumRecallAt10: 1,
    minimumRecallAt100: 1,
    minimumMrrAt100: 1,
    minimumNdcgAt100: 1,
    maximumRankInversionRateAt100: 0,
    totalRankInversionsAt100: 0,
    maximumAbsoluteNormalizedScoreError: 0,
    meanAbsoluteNormalizedScoreError: 0,
    p99AbsoluteNormalizedScoreError: 0,
    nonFiniteScoreCount: 0,
    duplicateResultCount: 0,
    missingResultCount: 0
  };
}

function laneResult(lane) {
  return {
    laneId: lane.laneId,
    laneKind: lane.laneKind,
    metric: lane.metric,
    normalization: lane.normalization,
    originalDimension: lane.originalDimension,
    encodedDimension: lane.encodedDimension,
    declaredRecordCount: lane.declaredRecordCount,
    sourceActiveRecordCount: lane.sourceActiveRecordCount,
    candidateRecordCount: lane.candidateRecordCount,
    queryCount: lane.queryCount,
    topKValues: [1, 10, 100],
    candidateDynamicIndexBytes: lane.candidateDynamicIndexBytes,
    candidateFormulaBytes: lane.candidateDynamicIndexBytes,
    exactFullIndexBytes: lane.exactFullIndexBytes,
    capacityMatchedExactRecordCount: lane.capacityMatchedExactRecordCount,
    capacityMatchedExactIndexBytes: lane.capacityMatchedExactIndexBytes,
    effectiveBitsPerOriginalCoordinate:
      8 * lane.candidateDynamicIndexBytes /
      (lane.candidateRecordCount * lane.originalDimension),
    persistentRatioToFullExact:
      lane.candidateDynamicIndexBytes / lane.exactFullIndexBytes,
    firstBuildSha256: sha256(Buffer.from(`build-${lane.laneId}`, "utf8")),
    secondBuildSha256: sha256(Buffer.from(`build-${lane.laneId}`, "utf8")),
    deterministicBuildBytesMatch: true,
    deterministicSearchOutputsMatch: true,
    reloadSearchOutputsMatch: true,
    sameCorpus: aggregateMetrics(),
    capacityMatchedExact: aggregateMetrics(),
    naturalUtility: lane.laneKind === "natural"
      ? {
          macroLabelPrecisionAt10: 1,
          macroLabelMrrAt10: 1,
          macroLabelNdcgAt10: 1,
          perClassQueryCoverage: Array(10).fill(20)
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

function qualityFixture() {
  return {
    schema: qualitySchema,
    experimentId: expectedExperimentId,
    methodId: expectedMethodId,
    bitWidth: 4,
    qualityProcessOrdinal: 1,
    datasetName: "Fashion-MNIST",
    datasetRevision: "b2617bb6d3ffa2e429640350f613e3291e10b141",
    selectionAlgorithm: "sha256-seed-split-label-index-smallest-v1",
    selectionSha256:
      "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd",
    topKValues: [1, 10, 100],
    laneResults: expectedLanes.map(laneResult),
    perQueryMetrics: expectedLanes.flatMap((lane, laneOrdinal) =>
      Array.from({ length: lane.queryCount }, (_unused, ordinal) =>
        queryMetric(lane, laneOrdinal, ordinal)))
  };
}

function contractFixture() {
  return {
    schema: contractSchema,
    experimentId: expectedExperimentId,
    methodId: expectedMethodId,
    bitWidth: 4,
    qualityProcessCount: 1,
    performanceLaneCount: 6,
    performanceMethodCount: 2,
    performanceRepetitionCount: 5,
    corruptionCaseCount: 7,
    crashScenarioCount: 4,
    processCrashExitCode: 74,
    preregistrationSha256,
    turbovecCrateSha256:
      "0715a5a1365e86d0ae6396fa0c011f319b8e8024b3896cd16e6468e29ed3a325",
    networkRequired: false,
    wasmClaim: false,
    productImport: false
  };
}

function performanceProcess(lane, method) {
  const candidate = method === "candidate";
  const duration = candidate ? 120 : 100;
  return {
    schema: performanceSchema,
    experimentId: expectedExperimentId,
    methodId: expectedMethodId,
    laneId: lane.laneId,
    method,
    originalDimension: lane.originalDimension,
    encodedDimension: candidate ? lane.encodedDimension : lane.originalDimension,
    recordCount: candidate
      ? lane.candidateRecordCount
      : lane.sourceActiveRecordCount,
    queryCount: lane.queryCount,
    warmupFullQueryPasses: 5,
    measuredFullQueryPasses: 5,
    buildNanoseconds: candidate ? 2_000_000 : 1_000_000,
    serializationNanoseconds: 1_000_000,
    loadNanoseconds: 1_000_000,
    explicitPrepareNanoseconds: 0,
    prepareCalledBeforeColdFirstQuery: false,
    candidatePrepareIncludedInColdFirstQuery: candidate,
    coldFirstQueryNanoseconds: candidate ? 2_000_000 : 1_000_000,
    measuredQueryNanoseconds: Array(lane.queryCount * 5).fill(duration),
    persistentBytes: candidate
      ? lane.candidateDynamicIndexBytes
      : 280 + lane.sourceActiveRecordCount *
        (16 + 4 * lane.originalDimension),
    queryResultDigest: sha256(Buffer.from(`${lane.laneId}/${method}`, "utf8")),
    memoryMonitorHandshake: true
  };
}

function memoryFixture(method) {
  const candidate = method === "candidate";
  return {
    samplingIntervalMilliseconds: 5,
    peakWorkingSetBytes: candidate ? 120_000_000 : 100_000_000,
    osReportedPeakWorkingSetBytes: candidate ? 121_000_000 : 101_000_000,
    postPrepareWorkingSetBytes: candidate ? 60_000_000 : 50_000_000,
    sampleCount: 20,
    monitorExitCode: 0
  };
}

function performanceRecordsFixture() {
  const records = [];
  let processOrdinal = 0;
  for (const [laneOrdinal, lane] of expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const [scheduledMethodOrdinal, method] of methods.entries()) {
        processOrdinal += 1;
        const processValue = performanceProcess(lane, method);
        const memory = memoryFixture(method);
        records.push({
          processOrdinal,
          laneOrdinal,
          repetition,
          scheduledMethodOrdinal,
          exitCode: 0,
          stdoutSha256: sha256(Buffer.from(compact(processValue), "utf8")),
          stderrSha256: emptySha256,
          monitorStdoutSha256: emptySha256,
          monitorStderrSha256: emptySha256,
          monitorResultSha256: sha256(Buffer.from(compact(memory), "utf8")),
          processRootDeleted: true,
          process: processValue,
          memory
        });
      }
    }
  }
  return records;
}

function corruptionProcess(caseId) {
  return {
    schema: corruptionSchema,
    experimentId: expectedExperimentId,
    caseId,
    rejected: true,
    rejectedBeforeUpstreamLoad: true,
    upstreamLoadAttemptCount: 0,
    boundedErrorCode: "verified-load-digest-mismatch",
    panicObserved: false
  };
}

function recoveryProcess(scenario) {
  return {
    schema: recoverySchema,
    experimentId: expectedExperimentId,
    scenarioId: scenario.scenarioId,
    processCrashExitCode: 74,
    expectedActiveGenerationBeforeRetry:
      scenario.expectedActiveGenerationBeforeRetry,
    observedActiveGenerationBeforeRetry:
      scenario.expectedActiveGenerationBeforeRetry,
    deletionCommittedBeforeRetry: scenario.deletionCommittedBeforeRetry,
    finalActiveGeneration: 2,
    retryWroteGenerationTwo: scenario.retryWroteGenerationTwo,
    retryIdempotent: true,
    finalTargetIdentifierMatches: 0,
    finalTargetVectorFingerprintMatches: 0,
    activeIndexContainsDeletedTarget: false,
    deletedTargetSearchMatches: 0,
    allCrashScenariosMustRecover: true,
    powerLossSimulated: false,
    filesystemForensicErasureTested: false,
    removedManagedFileCount: 3,
    directoryFlushAttempted: true,
    directoryFlushSucceeded: false,
    finalSnapshotSha256: sha256(Buffer.from(`snapshot-${scenario.scenarioId}`)),
    finalCommitSha256: sha256(Buffer.from(`commit-${scenario.scenarioId}`))
  };
}

function pendingAttemptFixture(revision = currentRevision()) {
  return finalizePendingAttempt({
    schema: pendingAttemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
    startedAtUtc: "2020-01-01T00:00:00.000Z",
    sourceRevision: revision,
    preregistrationSha256
  });
}

function observationFixture() {
  const manifest = validateManifestFile().manifest;
  const baseline = require(
    "../experiments/vector-quantization/" +
    "exact-flat-baseline-evidence-observation-v1.json"
  );
  const quality = qualityFixture();
  const contract = contractFixture();
  const performanceRecords = performanceRecordsFixture();
  const corruptionRecords = corruptionCases.map((caseId, caseOrdinal) => {
    const processValue = corruptionProcess(caseId);
    return {
      caseOrdinal,
      caseId,
      exitCode: 0,
      stdoutSha256: sha256(Buffer.from(compact(processValue), "utf8")),
      stderrSha256: emptySha256,
      managedFileCountBeforeDeletion: 3,
      processRootDeleted: true,
      process: processValue
    };
  });
  const crashRecoveries = crashScenarios.map((scenario, scenarioOrdinal) => {
    const recovery = recoveryProcess(scenario);
    return {
      scenarioOrdinal,
      scenarioId: scenario.scenarioId,
      crashExitCode: 74,
      crashStdoutSha256: emptySha256,
      crashStderrSha256: emptySha256,
      recoveryExitCode: 0,
      recoveryStdoutSha256: sha256(Buffer.from(compact(recovery), "utf8")),
      recoveryStderrSha256: emptySha256,
      managedFileCountBeforeDeletion: 3,
      processRootDeleted: true,
      recovery
    };
  });
  const revision = currentRevision();
  const pending = pendingAttemptFixture(revision);
  return finalizeObservation({
    schema: observationSchema,
    experimentId: expectedExperimentId,
    status: "pass",
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    attemptStartedAtUtc: pending.startedAtUtc,
    pendingAttemptId: pending.pendingAttemptId,
    pendingAttemptContentHash: pending.pendingAttemptContentHash,
    observedAtUtc: "2026-07-25T22:00:00.000Z",
    sourceRevision: revision,
    preregistration: {
      path: preregistrationRelativePath,
      sha256: preregistrationSha256,
      commit: revision
    },
    implementationCommit: revision,
    parents: clone(manifest.parents),
    externalDataset: clone(baseline.externalDataset),
    externalCrate: {
      name: "turbovec",
      version: "0.9.0",
      artifactBytes: 89523,
      artifactSha256:
        "0715a5a1365e86d0ae6396fa0c011f319b8e8024b3896cd16e6468e29ed3a325",
      vcsRevision: "1e7200cfd8f26c92ce2855652db64bc7f85bc039",
      locatorPersisted: false,
      bytesPersisted: false
    },
    inputs: inputPaths.map(hashInput),
    tools: {
      node: {
        name: "node",
        version: "v24.4.1",
        binaryBytes: 1024,
        binarySha256: "a".repeat(64)
      },
      cargo: {
        name: "cargo.exe",
        version: "cargo 1.88.0",
        binaryBytes: 2048,
        binarySha256: "b".repeat(64)
      },
      rustc: {
        name: "rustc.exe",
        version: "rustc 1.88.0",
        binaryBytes: 4096,
        binarySha256: "c".repeat(64)
      },
      powershell: {
        name: "powershell.exe",
        version: "5.1.26100.1",
        binaryBytes: 8192,
        binarySha256: "d".repeat(64)
      }
    },
    platform: {
      runtimeIdentifier: "win-x64",
      operatingSystem: "windows",
      architecture: "x64",
      rustTarget: "x86_64-pc-windows-msvc"
    },
    build: {
      executable: "cargo",
      arguments: [
        "build",
        "--manifest-path",
        "tinyrustlm/experiments/vector-quantization/" +
          "turbovec-reference-comparison/Cargo.toml",
        "--release",
        "--locked",
        "--offline",
        "--quiet",
        "--message-format=json"
      ],
      exitCode: 0,
      stdoutSha256: "e".repeat(64),
      stderrSha256: emptySha256,
      compilerArtifactCount: 1,
      wrapperWarningCount: 0,
      upstreamWarningCount: 0,
      executableBytes: 16384,
      executableSha256: "f".repeat(64),
      cargoLockSha256: hashInput(
        "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison/Cargo.lock"
      ).sha256,
      offline: true
    },
    contractExecution: {
      exitCode: 0,
      stdoutSha256: sha256(Buffer.from(compact(contract), "utf8")),
      stderrSha256: emptySha256
    },
    contract,
    qualityExecution: {
      exitCode: 0,
      stdoutSha256: sha256(Buffer.from(compact(quality), "utf8")),
      stderrSha256: emptySha256,
      managedFileCountBeforeDeletion: 13,
      processRootDeleted: true
    },
    quality,
    performanceRecords,
    performanceSummaries: summarizePerformance(performanceRecords),
    corruptionRecords,
    crashRecoveries,
    thresholdDecision: {
      status: "pass",
      contractMatched: true,
      allSixQualityLanesComplete: true,
      allPerQueryMetricsRetained: true,
      allFrozenQualityThresholdsPassed: true,
      allSixtyPerformanceProcessesComplete: true,
      allFrozenPerformanceThresholdsPassed: true,
      allSevenCorruptionsRejectedBeforeUpstreamLoad: true,
      allFourCrashScenariosRecovered: true,
      committedDeletionRemainedDeletedAfterRestart: true,
      allSeventyTwoProcessRootsDeleted: true,
      resultDrivenThresholdChanges: false
    },
    cleanup: {
      outerMarkerSha256: sha256(Buffer.from("owned-v1\n", "utf8")),
      memoryMonitorScriptSha256:
        sha256(Buffer.from(memoryMonitorScript, "utf8")),
      processRootCount: 72,
      processRootsDeleted: 72,
      outerRootDeleted: true
    },
    authority: clone(observationAuthority),
    openGaps: clone(openGaps),
    requiredNextGate: manifest.requiredNextGate
  });
}

function refinalize(observation) {
  const body = clone(observation);
  delete body.observationId;
  delete body.observationContentHash;
  return finalizeObservation(body);
}

test("resolves the retired arm-selection input through its exact durable copy", () => {
  const logicalPath =
    "agent-file-handoff/Improvement/" +
    "2026-07-25-turbovec-090-native-reference-arm-selection.md";
  const durablePath = path.join(
    repositoryRoot,
    "docs/report-intake/2026-08-08/active-handoff-closure/" +
      "2026-07-25-turbovec-090-native-reference-arm-selection.md"
  );

  assert.equal(fs.existsSync(path.join(repositoryRoot, logicalPath)), false);
  assert.equal(inputPaths.includes(logicalPath), true);
  assert.deepEqual(hashInput(logicalPath), {
    path: logicalPath,
    bytes: 9549,
    sha256: "950e2d59391471abd7fea5d7d9febc8103f47d1ea8942c4208d53705a95939e8"
  });
  assert.equal(
    sha256(fs.readFileSync(durablePath)),
    "950e2d59391471abd7fea5d7d9febc8103f47d1ea8942c4208d53705a95939e8"
  );
});

test("validates the complete synthetic observation contract without running it", () => {
  const observation = observationFixture();
  const validated = validateObservation(observation);

  assert.equal(validated, observation);
  assert.equal(validated.quality.laneResults.length, 6);
  assert.equal(validated.quality.perQueryMetrics.length, 790);
  assert.equal(validated.performanceRecords.length, 60);
  assert.equal(validated.corruptionRecords.length, 7);
  assert.equal(validated.crashRecoveries.length, 4);
  assert.ok(canonicalPrettyBytes(validated).length < 32 * 1024 * 1024);
  assert.deepEqual(observationIdentity(validated), {
    id: validated.observationId,
    hash: validated.observationContentHash
  });
});

test("rejects quality ordering, byte-accounting, aggregate, and threshold drift", () => {
  const order = clone(qualityFixture());
  order.perQueryMetrics[0].rawCandidateScores[1] =
    order.perQueryMetrics[0].rawCandidateScores[0] + 1;
  assert.throws(() => validateQualityOutput(compact(order)), /order is invalid/u);

  const declaredDistanceOrder = clone(qualityFixture());
  declaredDistanceOrder.perQueryMetrics[0].declaredScores[1] = -1;
  assert.throws(() => validateQualityOutput(compact(declaredDistanceOrder)),
    /declaredScores order is invalid/u);

  const declaredSimilarity = clone(qualityFixture());
  declaredSimilarity.perQueryMetrics[200].declaredScores[0] += 1;
  assert.throws(() => validateQualityOutput(compact(declaredSimilarity)),
    /declaredScores\[0\] is invalid/u);

  const digest = clone(qualityFixture());
  digest.perQueryMetrics[0].candidateResultDigest = "0".repeat(63);
  assert.throws(() => validateQualityOutput(compact(digest)),
    /candidateResultDigest/u);

  const scoreLength = clone(qualityFixture());
  scoreLength.perQueryMetrics[0].rawCandidateScores.pop();
  assert.throws(() => validateQualityOutput(compact(scoreLength)),
    /score sequence lengths/u);

  const topK = clone(qualityFixture());
  topK.laneResults[0].topKValues.pop();
  assert.throws(() => validateQualityOutput(compact(topK)), /topKValues/u);

  const recallOrder = clone(qualityFixture());
  recallOrder.perQueryMetrics[0].candidate.recallAt10 = 0.5;
  assert.throws(() => validateQualityOutput(compact(recallOrder)),
    /recall monotonicity/u);

  const inversionRate = clone(qualityFixture());
  inversionRate.perQueryMetrics[0].candidate.rankInversionsAt100 = 1;
  assert.throws(() => validateQualityOutput(compact(inversionRate)),
    /rankInversionRateAt100/u);

  const bytes = clone(qualityFixture());
  bytes.laneResults[0].candidateFormulaBytes += 1;
  assert.throws(() => validateQualityOutput(compact(bytes)),
    /candidateFormulaBytes/u);

  const aggregate = clone(qualityFixture());
  aggregate.laneResults[1].sameCorpus.minimumRecallAt100 = 0.99;
  assert.throws(() => validateQualityOutput(compact(aggregate)),
    /minimumRecallAt100/u);

  const threshold = clone(qualityFixture());
  threshold.perQueryMetrics[300].candidate.recallAt1 = 0.69;
  threshold.laneResults[1].sameCorpus.minimumRecallAt1 = 0.69;
  assert.throws(() => validateQualityOutput(compact(threshold)),
    /frozen same-corpus thresholds/u);
});

test("quality evidence omits selected corpus identifiers", () => {
  const fixtureBytes = compact(qualityFixture());
  assert.equal(fixtureBytes.includes("\"externalId\""), false);
  assert.equal(fixtureBytes.includes("\"rawCandidateHits\""), false);

  const source = fs.readFileSync(
    path.join(
      repositoryRoot,
      "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison/src/main.rs"
    ),
    "utf8"
  );
  assert.equal(source.includes("\\\"externalId\\\""), false);
  assert.equal(source.includes("\\\"rawCandidateHits\\\""), false);
});

test("rejects process schedule, raw hash, memory, and performance threshold drift", () => {
  const records = performanceRecordsFixture();
  validatePerformanceRecord(
    records[0],
    expectedLanes[0],
    0,
    "candidate",
    1
  );
  validatePerformanceOutput(
    compact(records[0].process),
    expectedLanes[0],
    "candidate"
  );
  validateMemoryMeasurement(records[0].memory, "fixture memory");

  const schedule = clone(records[0]);
  schedule.scheduledMethodOrdinal = 1;
  assert.throws(() => validatePerformanceRecord(
    schedule,
    expectedLanes[0],
    0,
    "candidate",
    1
  ), /scheduledMethodOrdinal/u);

  const rawHash = clone(records[0]);
  rawHash.stdoutSha256 = "0".repeat(64);
  assert.throws(() => validatePerformanceRecord(
    rawHash,
    expectedLanes[0],
    0,
    "candidate",
    1
  ), /stdoutSha256/u);

  const workingSet = clone(records[0].memory);
  workingSet.peakWorkingSetBytes =
    workingSet.postPrepareWorkingSetBytes - 1;
  assert.throws(() => validateMemoryMeasurement(workingSet, "fixture memory"),
    /working-set ordering/u);

  const observation = clone(observationFixture());
  observation.performanceSummaries[0].medianLatencyRatio = 1.26;
  assert.throws(() => validateObservation(refinalize(observation)),
    /medianLatencyRatio/u);
});

test("rejects corruption and crash-recovery semantic inflation", () => {
  const corruption = corruptionProcess(corruptionCases[0]);
  assert.deepEqual(
    validateCorruptionOutput(compact(corruption), corruptionCases[0]),
    corruption
  );
  corruption.rejectedBeforeUpstreamLoad = false;
  assert.throws(
    () => validateCorruptionOutput(compact(corruption), corruptionCases[0]),
    /rejectedBeforeUpstreamLoad/u
  );

  const recovery = recoveryProcess(crashScenarios[3]);
  assert.deepEqual(
    validateRecoveryOutput(compact(recovery), crashScenarios[3]),
    recovery
  );
  recovery.activeIndexContainsDeletedTarget = true;
  assert.throws(
    () => validateRecoveryOutput(compact(recovery), crashScenarios[3]),
    /activeIndexContainsDeletedTarget/u
  );
});

test("rejects input, authority, cleanup, private-path, and stale identity drift", () => {
  const input = clone(observationFixture());
  input.inputs[0].sha256 = "0".repeat(64);
  assert.throws(() => validateObservation(refinalize(input)),
    /observation input 0/u);

  const authority = clone(observationFixture());
  authority.authority.productIntegrationVerified = true;
  assert.throws(() => validateObservation(refinalize(authority)),
    /observation authority/u);

  const cleanup = clone(observationFixture());
  cleanup.cleanup.processRootsDeleted = 71;
  assert.throws(() => validateObservation(refinalize(cleanup)),
    /observation cleanup/u);

  const pendingBinding = clone(observationFixture());
  pendingBinding.attemptOrdinal = 2;
  assert.throws(() => validateObservation(refinalize(pendingBinding)),
    /observation pending attempt id/u);

  const privatePath = clone(observationFixture());
  privatePath.tools.node.version = "node /home/private/build";
  assert.throws(() => validateObservation(refinalize(privatePath)),
    /private or secret text/u);

  const stale = clone(observationFixture());
  stale.thresholdDecision.resultDrivenThresholdChanges = true;
  assert.throws(
    () => validateObservation(stale),
    /observation (?:id|content hash)/u
  );
});

test("attempt identities preserve terminal outcomes and retry classification", () => {
  const revision = currentRevision();
  const failure = boundedFailure(new Error("synthetic infrastructure failure"));
  const failed = finalizeAttempt({
    schema: attemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
    status: "fail",
    startedAtUtc: "2026-07-25T21:00:00.000Z",
    completedAtUtc: "2026-07-25T21:00:01.000Z",
    sourceRevision: revision,
    preregistrationSha256,
    observationId: null,
    observationContentHash: null,
    failure
  });
  assert.equal(validateAttempt(failed), failed);
  assert.equal(failed.failure.classification, "infrastructure");
  assert.equal(failed.failure.retryAllowed, true);
  assert.deepEqual(attemptIdentity(failed), {
    id: failed.attemptId,
    hash: failed.attemptContentHash
  });

  const illegal = clone(failed);
  illegal.failure.classification = "comparison-outcome";
  illegal.failure.retryAllowed = true;
  delete illegal.attemptId;
  delete illegal.attemptContentHash;
  assert.throws(() => validateAttempt(finalizeAttempt(illegal)),
    /comparison outcome retry policy/u);
});

test("pending attempt journal is canonical, idempotent, and removable", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "turbovec-pending-test-"));
  const filePath = path.join(root, "pending.json");
  const pending = pendingAttemptFixture();
  try {
    assert.equal(validatePendingAttempt(pending), pending);
    assert.deepEqual(pendingAttemptIdentity(pending), {
      id: pending.pendingAttemptId,
      hash: pending.pendingAttemptContentHash
    });

    writePendingAttempt(pending, filePath);
    writePendingAttempt(pending, filePath);
    assert.deepEqual(loadPendingAttempt(filePath), pending);

    const stale = clone(pending);
    stale.attemptOrdinal = 2;
    assert.throws(() => validatePendingAttempt(stale), /pending attempt id/u);

    removePendingAttempt(pending, filePath);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("resume preserves interruption or recovers a committed observation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "turbovec-resume-test-"));
  const pendingFilePath = path.join(root, "pending.json");
  const observationFilePath = path.join(root, "observation.json");
  const pending = pendingAttemptFixture();
  const recorded = [];
  const options = {
    pendingFilePath,
    observationFilePath,
    recordAttempt: (attempt) => {
      validateAttempt(attempt);
      recorded.push(attempt);
      return path.join(root, `${attempt.attemptContentHash}.json`);
    },
    resolveAttemptPath: (attempt) =>
      path.join(root, `${attempt.attemptContentHash}.json`)
  };
  try {
    writePendingAttempt(pending, pendingFilePath);
    const interrupted = reconcilePendingAttempt([], options);
    assert.equal(interrupted.recovered, null);
    assert.equal(interrupted.archive.length, 1);
    assert.equal(interrupted.archive[0].status, "fail");
    assert.equal(
      interrupted.archive[0].failure.code,
      "TURBOVEC_REFERENCE_PROCESS_INTERRUPTED"
    );
    assert.equal(interrupted.archive[0].failure.retryAllowed, true);
    assert.equal(fs.existsSync(pendingFilePath), false);

    recorded.length = 0;
    writePendingAttempt(pending, pendingFilePath);
    fs.writeFileSync(
      observationFilePath,
      canonicalPrettyBytes(observationFixture()),
      { flag: "wx" }
    );
    const recovered = reconcilePendingAttempt([], options);
    assert.equal(recovered.archive.length, 1);
    assert.equal(recovered.archive[0].status, "pass");
    assert.equal(recovered.recovered.recovered, true);
    assert.equal(recorded.length, 1);
    assert.equal(fs.existsSync(pendingFilePath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("contract and compact JSON framing reject drift and extra lines", () => {
  const contract = contractFixture();
  assert.deepEqual(validateContractOutput(compact(contract)), contract);

  const bitWidth = clone(contract);
  bitWidth.bitWidth = 3;
  assert.throws(() => validateContractOutput(compact(bitWidth)), /bitWidth/u);

  assert.throws(
    () => validateContractOutput(`${JSON.stringify(contract)}\n{}\n`),
    /not one JSON line/u
  );
  assert.throws(
    () => validateContractOutput(`${JSON.stringify(contract, null, 2)}\n`),
    /not one JSON line/u
  );
});

test("child environment excludes ambient secrets unless explicitly scoped", () => {
  const name = "TINYRUSTLM_SYNTHETIC_AMBIENT_CREDENTIAL";
  const previous = process.env[name];
  process.env[name] = "must-not-cross-process-boundary";
  try {
    const environment = offlineEnvironment({
      TINYRUSTLM_EXPLICIT_TEST_VALUE: "registered-test-value"
    });
    assert.equal(Object.hasOwn(environment, name), false);
    assert.equal(
      environment.TINYRUSTLM_EXPLICIT_TEST_VALUE,
      "registered-test-value"
    );
    assert.equal(environment.CARGO_NET_OFFLINE, "true");
    assert.equal(environment.HTTPS_PROXY, "http://127.0.0.1:9");
    assert.equal(environment.NO_PROXY, "");
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
});

test("Windows tool launchers retain multicall basenames", () => {
  for (const [name, prefix] of [
    ["cargo.exe", "cargo "],
    ["rustc.exe", "rustc "]
  ]) {
    const launcher = executablePath(name);
    assert.equal(path.basename(launcher).toLowerCase(), name);
    const result = childProcess.spawnSync(launcher, ["--version"], {
      cwd: repositoryRoot,
      env: offlineEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, new RegExp(`^${prefix}\\d`, "u"));
  }
});

test("timed-out process capture waits for the child close event", async () => {
  const capture = spawnCapture(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    {
      cwd: repositoryRoot,
      env: process.env,
      timeoutMilliseconds: 75
    },
    "synthetic timeout process"
  );

  await assert.rejects(capture.promise, /synthetic timeout process timed out/u);
  assert.equal(
    capture.child.exitCode !== null || capture.child.signalCode !== null,
    true
  );
});

test("monitor failure stays retryable and comparator failure stays terminal", () => {
  const clean = {
    exitCode: 0,
    signal: null,
    stdout: "",
    stderr: ""
  };
  const monitorFailure = {
    ...clean,
    exitCode: 1
  };
  let captured;
  try {
    validatePerformanceExecutions(
      { ...clean, exitCode: null, signal: "SIGTERM" },
      monitorFailure,
      1
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(captured.classification, "instrumentation");
  assert.equal(captured.retryAllowed, true);

  try {
    validatePerformanceExecutions(
      { ...clean, exitCode: 1 },
      clean,
      1
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(captured.classification, "comparison-outcome");
  assert.equal(captured.retryAllowed, false);

  try {
    validatePerformanceExecutions(
      { ...clean, exitCode: 1, stderr: "candidate-build-failed\n" },
      monitorFailure,
      1,
      true
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(captured.classification, "comparison-outcome");
  assert.equal(captured.retryAllowed, false);

  try {
    validatePerformanceExecutions(
      {
        ...clean,
        exitCode: 1,
        stderr: "performance-monitor-ready-timeout\n"
      },
      monitorFailure,
      1,
      true
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(captured.classification, "instrumentation");
  assert.equal(captured.retryAllowed, true);

  try {
    validatePerformanceExecutions(
      { ...clean, exitCode: 1, stderr: "process-root-invalid\n" },
      monitorFailure,
      1,
      false
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(captured.classification, "instrumentation");
  assert.equal(captured.retryAllowed, true);
});

test("cleanup failures preserve a terminal comparison outcome", async () => {
  const clean = {
    exitCode: 0,
    signal: null,
    stdout: "",
    stderr: ""
  };
  let primaryFailure;
  try {
    validatePerformanceExecutions(
      { ...clean, exitCode: 1 },
      clean,
      1
    );
  } catch (error) {
    primaryFailure = error;
  }
  assert.ok(primaryFailure);

  let secondCleanupAttempted = false;
  let captured;
  try {
    await cleanupWithFailurePolicy(
      primaryFailure,
      "TURBOVEC_REFERENCE_SYNTHETIC_CLEANUP_FAILED",
      [
        () => {
          throw new Error("synthetic cleanup failure");
        },
        () => {
          secondCleanupAttempted = true;
        }
      ]
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(secondCleanupAttempted, true);
  assert.equal(
    captured.code,
    "TURBOVEC_REFERENCE_SYNTHETIC_CLEANUP_FAILED"
  );
  assert.equal(captured.classification, "comparison-outcome");
  assert.equal(captured.retryAllowed, false);

  try {
    await cleanupWithFailurePolicy(
      null,
      "TURBOVEC_REFERENCE_SYNTHETIC_CLEANUP_FAILED",
      [() => {
        throw new Error("cleanup-only failure");
      }]
    );
  } catch (error) {
    captured = boundedFailure(error);
  }
  assert.equal(captured.classification, "infrastructure");
  assert.equal(captured.retryAllowed, true);
});

test("the memory monitor takes a baseline sample before releasing the target", () => {
  const processLookup = memoryMonitorScript.indexOf(
    "$process = Get-Process -Id $TargetProcessId -ErrorAction Stop"
  );
  const baselineSample = memoryMonitorScript.indexOf("$sampleCount = 1");
  const ready = memoryMonitorScript.indexOf("Write-NewMarker $ready");
  const loopSample = memoryMonitorScript.indexOf("$sampleCount += 1");
  const postPrepareAck = memoryMonitorScript.indexOf(
    "Write-NewMarker $postPrepareAck"
  );

  assert.ok([
    processLookup,
    baselineSample,
    ready,
    loopSample,
    postPrepareAck
  ].every((offset) => offset >= 0));
  assert.ok(processLookup < baselineSample);
  assert.ok(baselineSample < ready);
  assert.ok(ready < loopSample);
  assert.ok(loopSample < postPrepareAck);
});

test("the external PowerShell monitor completes the real marker handshake", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "turbovec-monitor-test-"));
  const scriptPath = path.join(root, "monitor.ps1");
  const outputPath = path.join(root, "memory.json");
  let target;
  let monitor;
  const collect = (child) => new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({
      exitCode,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
  try {
    fs.writeFileSync(scriptPath, memoryMonitorScript, { flag: "wx" });
    const targetSource = [
      "\"use strict\";",
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const root = process.argv[1];",
      "const sleeper = new Int32Array(new SharedArrayBuffer(4));",
      "const marker = (name) => path.join(root, name);",
      "const write = (name) => fs.writeFileSync(marker(name), 'ready\\n', { flag: 'wx' });",
      "const wait = (name) => {",
      "  const deadline = Date.now() + 10000;",
      "  while (!fs.existsSync(marker(name))) {",
      "    if (Date.now() >= deadline) throw new Error('target-marker-timeout');",
      "    Atomics.wait(sleeper, 0, 0, 5);",
      "  }",
      "};",
      "write('memory-monitor-request');",
      "wait('memory-monitor-ready');",
      "const retained = Buffer.alloc(16 * 1024 * 1024, 0x5a);",
      "write('memory-post-prepare');",
      "wait('memory-post-prepare-ack');",
      "process.stdout.write(String(retained[0]));"
    ].join("\n");
    target = childProcess.spawn(process.execPath, ["-e", targetSource, root], {
      env: offlineEnvironment(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const where = childProcess.spawnSync("where.exe", ["powershell.exe"], {
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(where.status, 0);
    const powershell = where.stdout.split(/\r?\n/u)
      .find((line) => line.trim().length > 0).trim();
    monitor = childProcess.spawn(powershell, [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-TargetProcessId",
      String(target.pid),
      "-ProcessRoot",
      root,
      "-OutputPath",
      outputPath
    ], {
      env: offlineEnvironment(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const [targetResult, monitorResult] = await Promise.all([
      collect(target),
      collect(monitor)
    ]);
    assert.deepEqual(targetResult, {
      exitCode: 0,
      signal: null,
      stdout: "90",
      stderr: ""
    });
    assert.deepEqual(monitorResult, {
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: ""
    });
    const bytes = fs.readFileSync(outputPath, "utf8");
    assert.equal(bytes, `${JSON.stringify(JSON.parse(bytes))}\n`);
    const memory = validateMemoryMeasurement(
      JSON.parse(bytes),
      "monitor integration fixture"
    );
    assert.ok(memory.sampleCount >= 2);
    assert.ok(memory.peakWorkingSetBytes >= memory.postPrepareWorkingSetBytes);
    assert.ok(memory.osReportedPeakWorkingSetBytes > 0);
  } finally {
    if (target && target.exitCode === null) target.kill();
    if (monitor && monitor.exitCode === null) monitor.kill();
    const resolved = fs.realpathSync.native(root);
    assert.equal(path.dirname(resolved), fs.realpathSync.native(os.tmpdir()));
    assert.match(path.basename(resolved), /^turbovec-monitor-test-/u);
    fs.rmSync(resolved, { recursive: true, force: false });
  }
});

test("the test suite never invokes the registered write mode", () => {
  const source = fs.readFileSync(__filename, "utf8");
  for (const fragments of [
    ["runAndWrite", "Observation("],
    ["generate", "Observation("],
    ["[", "\"--write\"", "]"],
    ["\"--", "quality\""],
    ["\"--", "performance\""],
    ["\"--", "corruption\""],
    ["\"--", "crash\""],
    ["\"--", "recover\""]
  ]) {
    assert.equal(source.includes(fragments.join("")), false);
  }
});
