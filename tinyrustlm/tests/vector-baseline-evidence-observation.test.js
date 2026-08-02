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
  crashScenarios,
  datasetFiles,
  expectedExperimentId,
  expectedLanes,
  finalizeAttempt,
  finalizeObservation,
  inputPaths,
  observationAuthority,
  observationIdentity,
  observationSchema,
  openGaps,
  preregistrationRelativePath,
  qualitySchema,
  recoverySchema,
  sha256,
  validateAttempt,
  validateObservation,
  validateQualityOutput,
  validateRecoveryOutput
} = require("../tools/vector-baseline-evidence-observation.js");
const {
  validateManifestFile
} = require("../tools/vector-baseline-evidence-preregistration.js");
const {
  gitInputCandidates
} = require("../tools/vector-historical-git-input.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const emptySha256 = sha256(Buffer.alloc(0));
const immutableObservation = JSON.parse(fs.readFileSync(
  path.join(
    repositoryRoot,
    "tinyrustlm/experiments/vector-quantization/" +
      "exact-flat-baseline-evidence-observation-v1.json"
  ),
  "utf8"
));
const fixtureSourceRevision = immutableObservation.sourceRevision;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function syntheticFamily(ordinal) {
  const familyCounts = [30, 24, 24, 18, 12, 12];
  let offset = 0;
  for (const [family, count] of familyCounts.entries()) {
    if (ordinal < offset + count) return family;
    offset += count;
  }
  throw new Error("synthetic fixture ordinal is invalid");
}

function classOrTopic(lane, ordinal) {
  if (lane.laneKind === "natural") return Math.floor(ordinal / 20);
  if (lane.laneKind === "controlled-memory") return Math.floor(ordinal / 3);
  return syntheticFamily(ordinal);
}

function queryMetric(lane, ordinal) {
  const natural = lane.laneKind === "natural";
  const controlled = lane.laneKind === "controlled-memory";
  return {
    laneId: lane.laneId,
    queryOrdinal: ordinal,
    classOrTopic: classOrTopic(lane, ordinal),
    recallAt1: 1,
    recallAt10: 1,
    recallAt100: 1,
    mrrAt100: 1,
    ndcgAt100: 1,
    rankInversionsAt100: 0,
    maximumAbsoluteScoreError: 0,
    meanAbsoluteScoreError: 0,
    labelPrecisionAt10: natural ? 1 : null,
    labelMrrAt10: natural ? 1 : null,
    labelNdcgAt10: natural ? 1 : null,
    expectedFirstHit: controlled ? true : null,
    forbiddenHitCountAt10: controlled ? 0 : null,
    deletedHitCount: controlled ? 0 : null,
    filterViolationCount: controlled ? 0 : null
  };
}

function laneResult(lane) {
  const natural = lane.laneKind === "natural";
  const controlled = lane.laneKind === "controlled-memory";
  return {
    laneId: lane.laneId,
    laneKind: lane.laneKind,
    metric: lane.metric,
    normalization: lane.normalization,
    dimension: lane.dimension,
    declaredRecordCount: lane.declaredRecordCount,
    activeRecordCount: lane.activeRecordCount,
    queryCount: lane.queryCount,
    topKValues: [1, 10, 100],
    minimumRecallAt1: 1,
    minimumRecallAt10: 1,
    minimumRecallAt100: 1,
    minimumMrrAt100: 1,
    minimumNdcgAt100: 1,
    rankInversionsAt100: 0,
    maximumAbsoluteScoreError: 0,
    meanAbsoluteScoreError: 0,
    naturalUtility: natural
      ? {
          macroLabelPrecisionAt10: 1,
          macroLabelMrrAt10: 1,
          macroLabelNdcgAt10: 1,
          perClassQueryCoverage: Array(10).fill(lane.classCoverage)
        }
      : null,
    controlledUtility: controlled
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
    qualityProcessOrdinal: 1,
    datasetName: "Fashion-MNIST",
    datasetRevision: "b2617bb6d3ffa2e429640350f613e3291e10b141",
    selectionAlgorithm: "sha256-seed-split-label-index-smallest-v1",
    selectionSha256: "a".repeat(64),
    topKValues: [1, 10, 100],
    laneResults: expectedLanes.map(laneResult),
    perQueryMetrics: expectedLanes.flatMap((lane) =>
      Array.from({ length: lane.queryCount }, (_unused, ordinal) =>
        queryMetric(lane, ordinal)))
  };
}

function compactOutput(value) {
  return `${JSON.stringify(value)}\n`;
}

function recoveryFixture(scenario) {
  return {
    schema: recoverySchema,
    experimentId: expectedExperimentId,
    scenarioId: scenario.scenarioId,
    processCrashExitCode: 73,
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
    activeIndexContainsAnyDeletedTarget: false,
    activeIndexContainsActiveDeletedTarget: false,
    allCrashScenariosMustRecover: true,
    powerLossSimulated: false,
    filesystemForensicErasureTested: false,
    removedManagedFileCount: 2,
    directoryFlushAttempted: true,
    directoryFlushSucceeded: false,
    finalSnapshotSha256: "b".repeat(64),
    finalCommitSha256: "c".repeat(64)
  };
}

function externalDatasetFixture(manifest) {
  return {
    sourceRepository: manifest.externalDataset.sourceRepository,
    revision: manifest.externalDataset.revision,
    tree: manifest.externalDataset.tree,
    licenseExpression: manifest.externalDataset.licenseExpression,
    licenseBytes: manifest.externalDataset.licenseBytes,
    licenseSha256: manifest.externalDataset.licenseSha256,
    readmeBytes: manifest.externalDataset.readmeBytes,
    readmeSha256: manifest.externalDataset.readmeSha256,
    files: datasetFiles.map((entry) => ({
      upstreamPath: entry.upstreamPath,
      compressedBytes: entry.compressedBytes,
      compressedSha256: entry.compressedSha256,
      decompressedBytes: entry.decompressedBytes,
      decompressedSha256: entry.decompressedSha256,
      idxMagic: entry.idxMagic,
      itemCount: entry.itemCount,
      rows: entry.rows,
      columns: entry.columns
    })),
    checkoutClean: true,
    locatorPersisted: false,
    bytesPersisted: false
  };
}

function observationFixture() {
  const preregistration = validateManifestFile();
  const manifest = preregistration.manifest;
  const quality = qualityFixture();
  const crashRecoveries = crashScenarios.map((scenario) => {
    const recovery = recoveryFixture(scenario);
    return {
      scenarioId: scenario.scenarioId,
      crashExitCode: 73,
      crashStdoutSha256: emptySha256,
      crashStderrSha256: emptySha256,
      recoveryExitCode: 0,
      recoveryStdoutSha256: sha256(Buffer.from(compactOutput(recovery), "utf8")),
      recoveryStderrSha256: emptySha256,
      managedFileCountBeforeRootDeletion: 3,
      recovery,
      ownedDeletionRootDeleted: true
    };
  });
  return finalizeObservation({
    schema: observationSchema,
    experimentId: expectedExperimentId,
    status: "pass",
    observedAtUtc: "2026-07-25T20:00:00.000Z",
    sourceRevision: fixtureSourceRevision,
    preregistration: {
      path: preregistrationRelativePath,
      sha256: preregistration.sha256
    },
    parents: manifest.parents.map((parent) => ({
      path: parent.path,
      sha256: parent.sha256
    })),
    externalDataset: externalDatasetFixture(manifest),
    inputs: inputPaths.map((relativePath) =>
      gitInputCandidates(
        repositoryRoot,
        fixtureSourceRevision,
        relativePath
      ).raw),
    tools: {
      node: {
        version: "node 24.4.1",
        sha256: "e".repeat(64)
      },
      rustc: {
        version: "rustc 1.88.0",
        sha256: "f".repeat(64)
      }
    },
    build: {
      library: {
        role: "library",
        executable: "rustc",
        arguments: manifest.build.libraryCommand.slice(1),
        exitCode: 0,
        outputSha256: "1".repeat(64),
        spawnErrorCode: null
      },
      benchmark: {
        role: "benchmark",
        executable: "rustc",
        arguments: manifest.build.benchmarkCommand.slice(1),
        exitCode: 0,
        outputSha256: "2".repeat(64),
        spawnErrorCode: null
      },
      libraryBinary: {
        bytes: 1024,
        sha256: "3".repeat(64)
      },
      benchmarkBinary: {
        bytes: 2048,
        sha256: "4".repeat(64)
      }
    },
    qualityExecution: {
      exitCode: 0,
      stdoutSha256: sha256(Buffer.from(compactOutput(quality), "utf8")),
      stderrSha256: emptySha256
    },
    quality,
    crashRecoveries,
    thresholdDecision: {
      status: "pass",
      allSixQualityLanesComplete: true,
      allPerQueryMetricsRetained: true,
      allFrozenThresholdsPassed: true,
      allFourCrashScenariosRecovered: true,
      committedDeletionRemainedDeletedAfterRestart: true,
      finalManagedFileScansPassed: true,
      resultDrivenThresholdChanges: false
    },
    cleanup: {
      markerSha256: "5".repeat(64),
      ownedRootDeleted: true
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

function assertInvalidQuality(mutator, pattern) {
  const value = qualityFixture();
  mutator(value);
  assert.throws(() => validateQualityOutput(compactOutput(value)), pattern);
}

function run(executable, argumentsList, label) {
  const result = childProcess.spawnSync(executable, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `${label} failed to spawn`);
  assert.equal(result.status, 0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

test("validates all six exact quality lanes and 790 retained query rows", () => {
  const quality = qualityFixture();
  const validated = validateQualityOutput(compactOutput(quality));

  assert.deepEqual(validated, quality);
  assert.equal(validated.laneResults.length, 6);
  assert.equal(validated.perQueryMetrics.length, 790);
  assert.deepEqual(validated.topKValues, [1, 10, 100]);
});

test("rejects rank, score, query identity, and unknown-field quality drift", () => {
  assertInvalidQuality((value) => {
    value.perQueryMetrics[0].recallAt10 = 0.9;
  }, /query recallAt10 failed/u);
  assertInvalidQuality((value) => {
    value.perQueryMetrics[201].queryOrdinal = 0;
  }, /query identity is invalid/u);
  assertInvalidQuality((value) => {
    value.perQueryMetrics[400].rankInversionsAt100 = 1;
  }, /query exact baseline failed/u);
  assertInvalidQuality((value) => {
    value.laneResults[0].unexpected = true;
  }, /lane .* fields are invalid/u);
  assert.throws(() => validateQualityOutput(JSON.stringify(qualityFixture())),
    /not canonical compact JSON/u);
});

test("requires ECMAScript canonical spelling for sub-micro score errors", () => {
  const value = qualityFixture();
  value.perQueryMetrics[0].maximumAbsoluteScoreError = 1e-13;
  value.laneResults[0].maximumAbsoluteScoreError = 1e-13;
  const canonical = compactOutput(value);

  assert.deepEqual(validateQualityOutput(canonical), value);
  assert.throws(() => validateQualityOutput(
    canonical.replaceAll("1e-13", "0.0000000000001")
  ), /not canonical compact JSON/u);
});

test("rejects natural-utility and controlled-memory policy drift", () => {
  assertInvalidQuality((value) => {
    value.perQueryMetrics[0].labelPrecisionAt10 = 0;
  }, /natural utility threshold failed/u);
  assertInvalidQuality((value) => {
    value.laneResults[1].naturalUtility.macroLabelMrrAt10 = 0.74;
  }, /natural utility threshold failed/u);
  const controlledOffset = expectedLanes
    .slice(0, -1)
    .reduce((total, lane) => total + lane.queryCount, 0);
  assertInvalidQuality((value) => {
    value.perQueryMetrics[controlledOffset].expectedFirstHit = false;
  }, /controlled query policy failed/u);
  assertInvalidQuality((value) => {
    value.laneResults.at(-1).controlledUtility.deletedHitCount = 1;
  }, /controlled memory utility threshold failed/u);
});

test("validates every registered recovery shape and rejects inflated authority", () => {
  for (const scenario of crashScenarios) {
    const recovery = recoveryFixture(scenario);
    assert.deepEqual(validateRecoveryOutput(compactOutput(recovery), scenario), recovery);

    const committed = clone(recovery);
    committed.deletionCommittedBeforeRetry =
      !scenario.deletionCommittedBeforeRetry;
    assert.throws(() => validateRecoveryOutput(compactOutput(committed), scenario),
      /recovery semantics are invalid/u);

    const powerLoss = clone(recovery);
    powerLoss.powerLossSimulated = true;
    assert.throws(() => validateRecoveryOutput(compactOutput(powerLoss), scenario),
      /recovery semantics are invalid/u);

    const residue = clone(recovery);
    residue.finalTargetIdentifierMatches = 1;
    assert.throws(() => validateRecoveryOutput(compactOutput(residue), scenario),
      /recovery semantics are invalid/u);
  }
});

test("validates a content-addressed observation with exact nested bindings", () => {
  const observation = observationFixture();
  const identity = observationIdentity(observation);

  assert.equal(validateObservation(observation), observation);
  assert.deepEqual(identity, {
    id: observation.observationId,
    hash: observation.observationContentHash
  });
  assert.equal(observation.quality.perQueryMetrics.length, 790);
  assert.equal(observation.crashRecoveries.length, 4);
  assert.equal(observation.authority.compressedRetrievalVerified, false);
  assert.ok(canonicalPrettyBytes(observation).length < 8 * 1024 * 1024);
});

test("rejects recomputed provenance, input, build, and output-hash drift", () => {
  const preregistration = clone(observationFixture());
  preregistration.preregistration.sha256 = "0".repeat(64);
  assert.throws(() => validateObservation(refinalize(preregistration)),
    /preregistration is invalid/u);

  const parent = clone(observationFixture());
  parent.parents[0].sha256 = "0".repeat(64);
  assert.throws(() => validateObservation(refinalize(parent)),
    /observation parent 0 is invalid/u);

  const dataset = clone(observationFixture());
  dataset.externalDataset.files[0].compressedBytes += 1;
  assert.throws(() => validateObservation(refinalize(dataset)),
    /external dataset file 0 is invalid/u);

  const input = clone(observationFixture());
  input.inputs[0].sha256 = "0".repeat(64);
  assert.throws(() => validateObservation(refinalize(input)),
    /observation input 0 does not match its historical source revision/u);

  const unavailableRevision = clone(observationFixture());
  unavailableRevision.sourceRevision = "0".repeat(40);
  assert.throws(() => validateObservation(refinalize(unavailableRevision)),
    /historical Git blob is unavailable/u);

  const build = clone(observationFixture());
  build.build.benchmark.arguments[0] = "--version";
  assert.throws(() => validateObservation(refinalize(build)),
    /benchmark build failed/u);

  const qualityHash = clone(observationFixture());
  qualityHash.qualityExecution.stdoutSha256 = "0".repeat(64);
  assert.throws(() => validateObservation(refinalize(qualityHash)),
    /quality execution is invalid/u);

  const recoveryHash = clone(observationFixture());
  recoveryHash.crashRecoveries[0].recoveryStdoutSha256 = "0".repeat(64);
  assert.throws(() => validateObservation(refinalize(recoveryHash)),
    /crash execution is invalid/u);
});

test("rejects semantic failure, cleanup failure, unknown fields, and authority inflation", () => {
  const quality = clone(observationFixture());
  quality.quality.perQueryMetrics[0].recallAt1 = 0;
  quality.qualityExecution.stdoutSha256 =
    sha256(Buffer.from(compactOutput(quality.quality), "utf8"));
  assert.throws(() => validateObservation(refinalize(quality)),
    /query recallAt1 failed/u);

  const recovery = clone(observationFixture());
  recovery.crashRecoveries[0].recovery.retryIdempotent = false;
  recovery.crashRecoveries[0].recoveryStdoutSha256 = sha256(Buffer.from(
    compactOutput(recovery.crashRecoveries[0].recovery), "utf8"));
  assert.throws(() => validateObservation(refinalize(recovery)),
    /recovery semantics are invalid/u);

  const cleanup = clone(observationFixture());
  cleanup.cleanup.ownedRootDeleted = false;
  assert.throws(() => validateObservation(refinalize(cleanup)),
    /cleanup is invalid/u);

  const unknown = clone(observationFixture());
  unknown.crashRecoveries[0].extra = "not allowed";
  assert.throws(() => validateObservation(refinalize(unknown)),
    /crash execution .* fields are invalid/u);

  const authority = clone(observationFixture());
  authority.authority.compressedRetrievalVerified = true;
  assert.throws(() => validateObservation(refinalize(authority)),
    /authority is invalid/u);

  const privatePath = clone(observationFixture());
  privatePath.tools.node.version = "node /home/private/build";
  assert.throws(() => validateObservation(refinalize(privatePath)),
    /private path/u);
});

test("attempts bind the exact preregistration and retain only bounded failures", () => {
  const manifest = validateManifestFile();
  const observation = observationFixture();
  const pass = finalizeAttempt({
    schema: attemptSchema,
    experimentId: expectedExperimentId,
    status: "pass",
    startedAtUtc: "2026-07-25T20:00:00Z",
    completedAtUtc: "2026-07-25T20:01:00Z",
    sourceRevision: fixtureSourceRevision,
    preregistrationSha256: manifest.sha256,
    observationId: observation.observationId,
    observationContentHash: observation.observationContentHash,
    failure: null
  });
  const privateMessage =
    "failed at C:\\private\\profile with bearer synthetic-secret";
  const failure = boundedFailure(new Error(privateMessage));
  const failed = finalizeAttempt({
    schema: attemptSchema,
    experimentId: expectedExperimentId,
    status: "fail",
    startedAtUtc: "2026-07-25T20:00:00Z",
    completedAtUtc: "2026-07-25T20:01:00Z",
    sourceRevision: null,
    preregistrationSha256: manifest.sha256,
    observationId: null,
    observationContentHash: null,
    failure
  });

  assert.equal(validateAttempt(pass), pass);
  assert.equal(validateAttempt(failed), failed);
  assert.deepEqual(attemptIdentity(pass), {
    id: pass.attemptId,
    hash: pass.attemptContentHash
  });
  assert.deepEqual(Object.keys(failure).sort(),
    ["code", "errorName", "messageSha256"]);
  assert.equal(JSON.stringify(failure).includes("private"), false);
  assert.equal(JSON.stringify(failure).includes("synthetic-secret"), false);

  const drift = clone(failed);
  delete drift.attemptId;
  delete drift.attemptContentHash;
  drift.preregistrationSha256 = "0".repeat(64);
  assert.throws(() => validateAttempt(finalizeAttempt(drift)),
    /attempt identity is invalid/u);
});

test("compiles warning-free and runs only unit tests plus the harmless contract mode", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-baseline-test-"));
  const library = path.join(root, "libtinyrustlm_vector_oracle.rlib");
  const benchmark = path.join(root, "exact_flat_baseline_benchmark.exe");
  const benchmarkTests = path.join(root, "exact_flat_baseline_benchmark_tests.exe");
  try {
    run("rustc", [
      "--crate-name", "tinyrustlm_vector_oracle",
      "--crate-type", "rlib",
      "--edition=2021",
      "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs",
      "-D", "warnings",
      "-C", "overflow-checks=yes",
      "-o", library
    ], "exact-flat library compilation");
    run("rustc", [
      "--crate-name", "exact_flat_baseline_evidence_benchmark",
      "--edition=2021",
      "tinyrustlm/experiments/vector-quantization/" +
        "exact-flat-baseline-evidence-benchmark.rs",
      "--extern", `tinyrustlm_vector_oracle=${library}`,
      "-D", "warnings",
      "-C", "overflow-checks=yes",
      "-o", benchmark
    ], "baseline benchmark compilation");
    run("rustc", [
      "--crate-name", "exact_flat_baseline_evidence_benchmark_tests",
      "--test",
      "--edition=2021",
      "tinyrustlm/experiments/vector-quantization/" +
        "exact-flat-baseline-evidence-benchmark.rs",
      "--extern", `tinyrustlm_vector_oracle=${library}`,
      "-D", "warnings",
      "-C", "overflow-checks=yes",
      "-o", benchmarkTests
    ], "baseline benchmark test compilation");
    const unitResult = run(benchmarkTests, [], "baseline benchmark unit tests");
    assert.match(unitResult.stdout, /4 passed; 0 failed/u);
    const contract = run(benchmark, ["--contract"], "baseline benchmark contract");
    assert.deepEqual(JSON.parse(contract.stdout), {
      schema: "tinyrustlm.exact_flat_baseline_benchmark_contract.v1",
      experimentId: expectedExperimentId,
      qualityProcessCount: 1,
      crashScenarioCount: 4,
      processCrashExitCode: 73,
      networkRequired: false,
      productImport: false
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: false });
  }
});
