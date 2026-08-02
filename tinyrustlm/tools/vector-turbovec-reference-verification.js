"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  canonicalPrettyBytes,
  hashInput,
  inputPaths: observationInputPaths,
  offlineEnvironment,
  preregistrationRelativePath,
  sha256,
  validateAttempt,
  validateObservationFile
} = require("./vector-turbovec-reference-observation.js");
const {
  validateManifestFile
} = require("./vector-turbovec-reference-preregistration.js");

const receiptSchema =
  "tinyrustlm.turbovec_reference_comparison_verification_receipt.v1";
const expectedExperimentId =
  "turbovec-090-4bit-tqplus-reference-comparison-20260725";
const repositoryRoot = path.resolve(__dirname, "../..");
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "turbovec-reference-comparison-observation-v1.json";
const receiptRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "turbovec-reference-comparison-verification-v1.json";
const receiptPath = path.join(repositoryRoot, receiptRelativePath);
const attemptDirectoryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "turbovec-reference-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptDirectoryRelativePath);
const verifierRelativePath =
  "tinyrustlm/tools/vector-turbovec-reference-verification.js";
const verifierTestRelativePath =
  "tinyrustlm/tests/vector-turbovec-reference-verification.test.js";
const maximumEvidenceBytes = 32 * 1024 * 1024;
const maximumInputBytes = 32 * 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;
const registeredManifestResult = validateManifestFile();
const registeredManifest = registeredManifestResult.manifest;
const naturalThresholdsByLane = new Map(
  registeredManifest.qualityThresholds.naturalLanes.map((lane) => [
    lane.laneId,
    Object.freeze([
      lane.minimumMacroLabelPrecisionAt10,
      lane.minimumMacroLabelMrrAt10,
      lane.minimumMacroLabelNdcgAt10
    ])
  ])
);
const verificationLanes = Object.freeze(
  registeredManifest.corpusReuse.lanes.map((lane) => Object.freeze({
    laneId: lane.laneId,
    laneKind: lane.laneKind,
    metric: lane.metric,
    originalDimension: lane.originalDimension,
    encodedDimension: lane.encodedDimension,
    declaredRecordCount: lane.recordCount,
    sourceActiveRecordCount:
      lane.laneKind === "controlled-memory" ? 110 : lane.recordCount,
    queryCount: lane.queryCount,
    candidateDynamicIndexBytes: lane.candidateDynamicIndexBytes,
    exactFullIndexBytes:
      280 + lane.recordCount * (16 + 4 * lane.originalDimension),
    capacityMatchedExactRecordCount: lane.capacityMatchedExactRecordCount,
    capacityMatchedExactIndexBytes: lane.capacityMatchedExactIndexBytes,
    naturalThresholds: naturalThresholdsByLane.get(lane.laneId) || null
  }))
);
const verificationCorruptionCases = Object.freeze([
  ...registeredManifest.persistenceAndFailure.corruptionCases
]);
const verificationCrashScenarios = Object.freeze(
  registeredManifest.persistenceAndFailure.crashScenarios.map((scenario) =>
    Object.freeze({
      scenarioId: scenario.scenarioId,
      expectedActiveGenerationBeforeRetry: scenario.expectedActiveGeneration,
      deletionCommittedBeforeRetry: scenario.deletionCommitted,
      retryWroteGenerationTwo: scenario.expectedActiveGeneration === 1
    }))
);
const verificationAuthority = Object.freeze({
  turbovec090NativeReferenceBehaviorVerified: true,
  sameCorpusCompressedRankQualityVerified: true,
  equalDynamicIndexByteCapacityUtilityVerified: true,
  completeDynamicIndexByteReductionVerified: true,
  nativeReferencePerformanceVerified: true,
  wrapperProcessCrashRecoveryVerified: true,
  upstreamPersistenceSafetyVerified: false,
  turboQuantPaperConformanceVerified: false,
  wasmCompatibilityVerified: false,
  browserPerformanceVerified: false,
  representativeSemanticMemoryQualityVerified: false,
  powerLossDurabilityVerified: false,
  filesystemForensicErasureVerified: false,
  productIntegrationVerified: false,
  trainingAuthorized: false,
  releaseAuthorized: false
});
const verificationOpenGaps = Object.freeze([
  Object.freeze({
    gapId: "wasm-direct-build",
    status: "blocked",
    blockerCode: "UPSTREAM_GETRANDOM_JS_FEATURE_NOT_ENABLED"
  }),
  Object.freeze({
    gapId: "portable-local-compressed-implementation",
    status: "not-implemented",
    blockerCode: null
  }),
  Object.freeze({
    gapId: "semantic-memory-corpus",
    status: "not-proven",
    blockerCode: null
  }),
  Object.freeze({
    gapId: "power-loss-durability",
    status: "not-tested",
    blockerCode: null
  }),
  Object.freeze({
    gapId: "product-adoption",
    status: "not-authorized",
    blockerCode: null
  })
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort()),
    `${label} fields are invalid`
  );
}

function exactStructure(value, expected, label) {
  invariant(canonicalJson(value) === canonicalJson(expected), `${label} is invalid`);
}

function publicSafe(value, label) {
  invariant(
    !forbiddenTextPattern.test(JSON.stringify(value)),
    `${label} contains private or secret text`
  );
}

function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function resolveRepositoryFile(relativePath, maximumBytes = maximumInputBytes) {
  invariant(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(relativePath),
    "verification repository path is invalid"
  );
  const absolute = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, absolute);
  invariant(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    "verification repository path escaped"
  );
  const stat = fs.lstatSync(absolute);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 0 && stat.size <= maximumBytes,
    "verification repository input is invalid"
  );
  return absolute;
}

function sourceRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    env: offlineEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  invariant(result.error === undefined && result.status === 0,
    "verification source revision failed");
  const revision = result.stdout.trim();
  invariant(sourceRevisionPattern.test(revision),
    "verification source revision is invalid");
  return revision;
}

function nodeIdentity() {
  const executable = fs.realpathSync.native(process.execPath);
  const stat = fs.lstatSync(executable);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 0 && stat.size <= 512 * 1024 * 1024,
    "verification Node executable is invalid"
  );
  return Object.freeze({
    version: process.version,
    binaryBytes: stat.size,
    binarySha256: sha256File(executable)
  });
}

function percentile(values, percentileValue) {
  invariant(Array.isArray(values) && values.length > 0,
    "verification percentile input is empty");
  const ordered = values.map((value) => {
    invariant(typeof value === "number" && Number.isFinite(value) && value >= 0,
      "verification duration is invalid");
    return value;
  }).sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(percentileValue * ordered.length) - 1)];
}

function approximate(left, right, label) {
  invariant(
    typeof left === "number" && Number.isFinite(left) &&
      typeof right === "number" && Number.isFinite(right),
    `${label} is not finite`
  );
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  invariant(Math.abs(left - right) <= 1e-12 * scale, `${label} differs`);
}

function verifyPendingAttemptBinding(observation) {
  invariant(
    Number.isSafeInteger(observation.attemptOrdinal) &&
      observation.attemptOrdinal >= 1 &&
      (observation.previousAttemptId === null ||
        /^turbovec-reference-attempt-[a-f0-9]{16}$/u.test(
          observation.previousAttemptId
        )) &&
      utcPattern.test(observation.attemptStartedAtUtc) &&
      Number.isFinite(Date.parse(observation.attemptStartedAtUtc)) &&
      sourceRevisionPattern.test(observation.sourceRevision),
    "verification pending attempt fields are invalid"
  );
  const body = {
    schema: "tinyrustlm.turbovec_reference_comparison_pending_attempt.v1",
    experimentId: expectedExperimentId,
    attemptOrdinal: observation.attemptOrdinal,
    previousAttemptId: observation.previousAttemptId,
    startedAtUtc: observation.attemptStartedAtUtc,
    sourceRevision: observation.sourceRevision,
    preregistrationSha256: registeredManifestResult.sha256
  };
  const hash = crypto.createHash("sha256")
    .update(Buffer.from(canonicalJson(body), "utf8"))
    .digest("hex");
  invariant(
    observation.pendingAttemptId ===
      `turbovec-reference-pending-${hash.slice(0, 16)}` &&
      observation.pendingAttemptContentHash === hash,
    "verification pending attempt binding differs"
  );
  return true;
}

function verifyScoreSequences(query, lane, ordinal) {
  const label = `verification score sequence ${lane.laneId}/${ordinal}`;
  invariant(
    query.rawCandidateScores.every(Number.isFinite) &&
      query.declaredScores.every(Number.isFinite),
    `${label} contains a nonfinite score`
  );
  for (let index = 0; index < query.candidateResultCount; index += 1) {
    const raw = query.rawCandidateScores[index];
    const declared = query.declaredScores[index];
    if (lane.metric !== "squared-euclidean") {
      approximate(declared, raw, `${label} declared score ${index}`);
    }
    if (index > 0) {
      invariant(
        query.rawCandidateScores[index - 1] >= raw,
        `${label} raw ordering differs`
      );
      invariant(
        lane.metric === "squared-euclidean"
          ? query.declaredScores[index - 1] <= declared
          : query.declaredScores[index - 1] >= declared,
        `${label} declared ordering differs`
      );
    }
  }
  return true;
}

function independentEvidenceSummary(observation, attemptCount = 0) {
  verifyPendingAttemptBinding(observation);
  const quality = observation.quality;
  invariant(
    Array.isArray(quality.laneResults) &&
      quality.laneResults.length === verificationLanes.length &&
      Array.isArray(quality.perQueryMetrics) &&
      quality.perQueryMetrics.length === 790,
    "verification quality coverage is incomplete"
  );
  let queryOffset = 0;
  const laneRows = verificationLanes.map((lane, laneOrdinal) => {
    const result = quality.laneResults[laneOrdinal];
    invariant(
      result.laneId === lane.laneId &&
        result.candidateDynamicIndexBytes === lane.candidateDynamicIndexBytes &&
        result.exactFullIndexBytes === lane.exactFullIndexBytes &&
        result.capacityMatchedExactRecordCount ===
          lane.capacityMatchedExactRecordCount &&
        result.capacityMatchedExactIndexBytes ===
          lane.capacityMatchedExactIndexBytes &&
        result.deterministicBuildBytesMatch === true &&
        result.deterministicSearchOutputsMatch === true &&
        result.reloadSearchOutputsMatch === true &&
        result.sameCorpus.minimumRecallAt1 >= 0.7 &&
        result.sameCorpus.minimumRecallAt10 >= 0.85 &&
        result.sameCorpus.minimumRecallAt100 >= 0.95 &&
        result.sameCorpus.minimumMrrAt100 >= 0.75 &&
        result.sameCorpus.minimumNdcgAt100 >= 0.85 &&
        result.sameCorpus.maximumRankInversionRateAt100 <= 0.1 &&
        result.sameCorpus.meanAbsoluteNormalizedScoreError <= 0.2 &&
        result.sameCorpus.p99AbsoluteNormalizedScoreError <= 0.75 &&
        result.sameCorpus.nonFiniteScoreCount === 0 &&
        result.sameCorpus.duplicateResultCount === 0 &&
        result.sameCorpus.missingResultCount === 0,
      `verification quality lane failed: ${lane.laneId}`
    );
    const queries = quality.perQueryMetrics.slice(
      queryOffset,
      queryOffset + lane.queryCount
    );
    queryOffset += lane.queryCount;
    invariant(
      queries.length === lane.queryCount &&
        queries.every((query, ordinal) =>
          query.laneId === lane.laneId &&
          query.queryOrdinal === ordinal &&
          query.candidate.nonFiniteScoreCount === 0 &&
          query.candidate.duplicateResultCount === 0 &&
          query.candidate.missingResultCount === 0 &&
          query.candidateResultCount ===
            (lane.laneKind === "controlled-memory" ? 8 : 100) &&
          sha256Pattern.test(query.candidateResultDigest) &&
          query.rawCandidateScores.length === query.candidateResultCount &&
          query.declaredScores.length === query.candidateResultCount),
      `verification retained query evidence failed: ${lane.laneId}`
    );
    queries.forEach((query, ordinal) =>
      verifyScoreSequences(query, lane, ordinal));
    if (lane.laneKind === "natural") {
      invariant(
        result.naturalUtility.macroLabelPrecisionAt10 >= lane.naturalThresholds[0] &&
          result.naturalUtility.macroLabelMrrAt10 >= lane.naturalThresholds[1] &&
          result.naturalUtility.macroLabelNdcgAt10 >= lane.naturalThresholds[2],
        `verification natural utility failed: ${lane.laneId}`
      );
    }
    if (lane.laneKind === "controlled-memory") {
      invariant(
        result.controlledUtility.expectedFirstHitRate === 1 &&
          result.controlledUtility.forbiddenHitRateAt10 === 0 &&
          result.controlledUtility.deletedHitCount === 0 &&
          result.controlledUtility.filterViolationCount === 0,
        "verification controlled utility failed"
      );
    }
    return Object.freeze({
      laneId: lane.laneId,
      candidateDynamicIndexBytes: result.candidateDynamicIndexBytes,
      exactFullIndexBytes: result.exactFullIndexBytes,
      persistentRatioToFullExact: result.persistentRatioToFullExact,
      minimumRecallAt100: result.sameCorpus.minimumRecallAt100
    });
  });
  invariant(queryOffset === 790, "verification query accounting differs");

  invariant(
    Array.isArray(observation.performanceRecords) &&
      observation.performanceRecords.length === 60 &&
      Array.isArray(observation.performanceSummaries) &&
      observation.performanceSummaries.length === 6,
    "verification performance coverage is incomplete"
  );
  const performanceRows = verificationLanes.map((lane, laneOrdinal) => {
    const records = observation.performanceRecords.slice(
      laneOrdinal * 10,
      laneOrdinal * 10 + 10
    );
    let laneProcessOffset = 0;
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const [scheduledMethodOrdinal, method] of methods.entries()) {
        const record = records[laneProcessOffset];
        invariant(
          record.processOrdinal === laneOrdinal * 10 + laneProcessOffset + 1 &&
            record.laneOrdinal === laneOrdinal &&
            record.repetition === repetition &&
            record.scheduledMethodOrdinal === scheduledMethodOrdinal &&
            record.process.laneId === lane.laneId &&
            record.process.method === method,
          `verification performance schedule failed: ${lane.laneId}`
        );
        laneProcessOffset += 1;
      }
    }
    const candidate = records.filter(
      (record) => record.process.method === "candidate"
    );
    const exact = records.filter(
      (record) => record.process.method === "exact-full"
    );
    invariant(
      records.length === 10 && candidate.length === 5 && exact.length === 5 &&
        records.every((record) =>
          record.processRootDeleted === true &&
          record.memory.monitorExitCode === 0 &&
          record.process.memoryMonitorHandshake === true),
      `verification performance processes failed: ${lane.laneId}`
    );
    const candidateDurations = candidate.flatMap(
      (record) => record.process.measuredQueryNanoseconds
    );
    const exactDurations = exact.flatMap(
      (record) => record.process.measuredQueryNanoseconds
    );
    const medianRatio =
      percentile(candidateDurations, 0.5) / percentile(exactDurations, 0.5);
    const p95Ratio =
      percentile(candidateDurations, 0.95) / percentile(exactDurations, 0.95);
    const summary = observation.performanceSummaries[laneOrdinal];
    approximate(summary.medianLatencyRatio, medianRatio,
      `verification median ratio ${lane.laneId}`);
    approximate(summary.p95LatencyRatio, p95Ratio,
      `verification p95 ratio ${lane.laneId}`);
    invariant(
      summary.laneId === lane.laneId &&
        summary.thresholdsPassed === true &&
        medianRatio <= 1.25 &&
        p95Ratio <= 1.5 &&
        summary.maximumCandidateColdFirstQueryNanoseconds <= 5_000_000_000 &&
        summary.maximumCandidateBuildNanoseconds <= 120_000_000_000 &&
        summary.maximumCandidatePeakWorkingSetBytes <= 536_870_912 &&
        summary.maximumPeakWorkingSetRatioToExact <= 8 &&
        summary.maximumPostPrepareWorkingSetRatioToExact <= 2 &&
        summary.persistentRatioToExact <= 0.2,
      `verification performance threshold failed: ${lane.laneId}`
    );
    return Object.freeze({
      laneId: lane.laneId,
      pairedProcessCount: records.length,
      medianLatencyRatio: summary.medianLatencyRatio,
      p95LatencyRatio: summary.p95LatencyRatio,
      maximumCandidatePeakWorkingSetBytes:
        summary.maximumCandidatePeakWorkingSetBytes
    });
  });

  invariant(
    Array.isArray(observation.corruptionRecords) &&
      observation.corruptionRecords.length === verificationCorruptionCases.length &&
      observation.corruptionRecords.every((record, index) =>
        record.caseId === verificationCorruptionCases[index] &&
        record.process.rejected === true &&
        record.process.rejectedBeforeUpstreamLoad === true &&
        record.process.upstreamLoadAttemptCount === 0 &&
        record.process.panicObserved === false &&
        record.processRootDeleted === true),
    "verification corruption coverage failed"
  );
  invariant(
    Array.isArray(observation.crashRecoveries) &&
      observation.crashRecoveries.length === verificationCrashScenarios.length &&
      observation.crashRecoveries.every((record, index) => {
        const expected = verificationCrashScenarios[index];
        return record.scenarioId === expected.scenarioId &&
          record.recovery.observedActiveGenerationBeforeRetry ===
            expected.expectedActiveGenerationBeforeRetry &&
          record.recovery.deletionCommittedBeforeRetry ===
            expected.deletionCommittedBeforeRetry &&
          record.recovery.retryWroteGenerationTwo ===
            expected.retryWroteGenerationTwo &&
          record.recovery.retryIdempotent === true &&
          record.recovery.finalTargetIdentifierMatches === 0 &&
          record.recovery.finalTargetVectorFingerprintMatches === 0 &&
          record.recovery.activeIndexContainsDeletedTarget === false &&
          record.recovery.deletedTargetSearchMatches === 0 &&
          record.processRootDeleted === true;
      }),
    "verification crash recovery coverage failed"
  );
  invariant(
    observation.cleanup.processRootCount === 72 &&
      observation.cleanup.processRootsDeleted === 72 &&
      observation.cleanup.outerRootDeleted === true,
    "verification cleanup proof failed"
  );
  return Object.freeze({
    qualityLaneCount: laneRows.length,
    perQueryMetricCount: queryOffset,
    laneRows,
    performanceProcessCount: observation.performanceRecords.length,
    performanceRows,
    corruptionCaseCount: observation.corruptionRecords.length,
    crashScenarioCount: observation.crashRecoveries.length,
    allOwnedProcessRootsDeleted: true,
    outerRootDeleted: true,
    resultDrivenThresholdChanges: false,
    preservedAttemptCount: attemptCount,
    pendingAttemptBindingVerified: true,
    productAdoptionAuthorized: false,
    wasmCompatibilityClaimed: false,
    semanticMemoryQualityClaimed: false
  });
}

function discoverAttemptArchive() {
  invariant(fs.existsSync(attemptDirectory), "verification attempt archive is missing");
  const entries = [];
  for (const prefix of fs.readdirSync(attemptDirectory).sort()) {
    invariant(/^[a-f0-9]{2}$/u.test(prefix), "verification attempt prefix is invalid");
    const prefixPath = path.join(attemptDirectory, prefix);
    const prefixStat = fs.lstatSync(prefixPath);
    invariant(prefixStat.isDirectory() && !prefixStat.isSymbolicLink(),
      "verification attempt prefix is invalid");
    for (const name of fs.readdirSync(prefixPath).sort()) {
      invariant(/^[a-f0-9]{64}\.json$/u.test(name),
        "verification attempt name is invalid");
      const absolute = path.join(prefixPath, name);
      const relativePath = path.relative(repositoryRoot, absolute)
        .replaceAll("\\", "/");
      const stat = fs.lstatSync(absolute);
      invariant(stat.isFile() && !stat.isSymbolicLink() &&
        stat.size > 0 && stat.size <= maximumEvidenceBytes,
      "verification attempt file is invalid");
      const bytes = fs.readFileSync(absolute);
      const attempt = validateAttempt(JSON.parse(bytes.toString("utf8")));
      invariant(bytes.equals(canonicalPrettyBytes(attempt)),
        "verification attempt bytes are not canonical");
      invariant(name === `${attempt.attemptContentHash}.json` &&
        prefix === attempt.attemptContentHash.slice(0, 2),
      "verification attempt content address is invalid");
      entries.push(Object.freeze({
        relativePath,
        bytes: bytes.length,
        fileSha256: sha256(bytes),
        attempt
      }));
    }
  }
  entries.sort((left, right) =>
    left.attempt.attemptOrdinal - right.attempt.attemptOrdinal);
  invariant(entries.length >= 1, "verification attempt archive is empty");
  entries.forEach((entry, index) => {
    invariant(entry.attempt.attemptOrdinal === index + 1,
      "verification attempt ordinals differ");
    invariant(entry.attempt.previousAttemptId ===
      (index === 0 ? null : entries[index - 1].attempt.attemptId),
    "verification attempt chain differs");
    if (index > 0) {
      invariant(entries[index - 1].attempt.status === "fail" &&
        entries[index - 1].attempt.failure.retryAllowed === true,
      "verification attempt followed a terminal result");
    }
  });
  invariant(entries.at(-1).attempt.status === "pass",
    "verification archive lacks a terminal passing attempt");
  return Object.freeze(entries);
}

function attemptReference(entry) {
  return Object.freeze({
    path: entry.relativePath,
    attemptId: entry.attempt.attemptId,
    attemptOrdinal: entry.attempt.attemptOrdinal,
    status: entry.attempt.status,
    retryAllowed:
      entry.attempt.status === "fail"
        ? entry.attempt.failure.retryAllowed
        : false,
    attemptContentHash: entry.attempt.attemptContentHash,
    fileBytes: entry.bytes,
    fileSha256: entry.fileSha256,
    sourceRevision: entry.attempt.sourceRevision
  });
}

function verificationInputPaths(attempts = []) {
  return Object.freeze([...new Set([
    ...observationInputPaths,
    observationRelativePath,
    verifierRelativePath,
    verifierTestRelativePath,
    ...attempts.map((entry) => entry.relativePath)
  ])].sort());
}

function assertInputsCommitted(paths) {
  const tracked = childProcess.spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", ...paths],
    {
      cwd: repositoryRoot,
      env: offlineEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    }
  );
  invariant(tracked.error === undefined && tracked.status === 0,
    "verification inputs are not all tracked");
  const status = childProcess.spawnSync(
    "git",
    ["status", "--porcelain=v1", "--", ...paths],
    {
      cwd: repositoryRoot,
      env: offlineEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    }
  );
  invariant(status.error === undefined && status.status === 0 &&
    status.stdout.trim() === "", "verification inputs are not clean");
}

function receiptIdentity(value) {
  const body = { ...value };
  delete body.receiptId;
  delete body.receiptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `turbovec-reference-verification-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizeReceipt(body) {
  const identity = receiptIdentity(body);
  return Object.freeze({
    ...body,
    receiptId: identity.id,
    receiptContentHash: identity.hash
  });
}

function validateReceipt(value, options = {}) {
  exactKeys(value, [
    "schema", "experimentId", "status", "generatedAtUtc",
    "observedSourceRevision", "verificationSourceRevision",
    "verificationMode", "verificationTool", "verificationInputs",
    "preregistration", "observation", "attempts", "evidenceSummary",
    "authority", "openGaps", "requiredNextGate", "receiptId",
    "receiptContentHash"
  ], "verification receipt");
  invariant(
    value.schema === receiptSchema &&
      value.experimentId === expectedExperimentId &&
      value.status === "verified-with-bounded-authority" &&
      utcPattern.test(value.generatedAtUtc) &&
      Number.isFinite(Date.parse(value.generatedAtUtc)) &&
      sourceRevisionPattern.test(value.observedSourceRevision) &&
      sourceRevisionPattern.test(value.verificationSourceRevision) &&
      value.verificationMode ===
        "independent-content-summary-revalidation-without-benchmark-rerun",
    "verification receipt identity is invalid"
  );
  const identity = receiptIdentity(value);
  invariant(
    value.receiptId === identity.id &&
      value.receiptContentHash === identity.hash,
    "verification receipt content identity is invalid"
  );
  exactKeys(value.verificationTool, [
    "version", "binaryBytes", "binarySha256"
  ], "verification tool");
  invariant(
    typeof value.verificationTool.version === "string" &&
      Number.isSafeInteger(value.verificationTool.binaryBytes) &&
      value.verificationTool.binaryBytes > 0 &&
      sha256Pattern.test(value.verificationTool.binarySha256),
    "verification tool identity is invalid"
  );
  invariant(
    Array.isArray(value.verificationInputs) &&
      value.verificationInputs.length > observationInputPaths.length,
    "verification input coverage is invalid"
  );
  value.verificationInputs.forEach((input, index) => {
    exactKeys(input, ["path", "bytes", "sha256"],
      `verification input ${index}`);
    invariant(
      typeof input.path === "string" &&
        Number.isSafeInteger(input.bytes) && input.bytes > 0 &&
        sha256Pattern.test(input.sha256),
      `verification input ${index} identity is invalid`
    );
  });
  exactKeys(value.preregistration, ["path", "sha256"],
    "verification preregistration");
  invariant(
    value.preregistration.path === preregistrationRelativePath &&
      value.preregistration.sha256 === validateManifestFile().sha256,
    "verification preregistration is invalid"
  );
  exactKeys(value.observation, [
    "path", "observationId", "observationContentHash", "fileBytes",
    "fileSha256"
  ], "verification observation");
  invariant(
    value.observation.path === observationRelativePath &&
      /^turbovec-reference-comparison-[a-f0-9]{16}$/u.test(
        value.observation.observationId
      ) &&
      sha256Pattern.test(value.observation.observationContentHash) &&
      Number.isSafeInteger(value.observation.fileBytes) &&
      value.observation.fileBytes > 0 &&
      sha256Pattern.test(value.observation.fileSha256),
    "verification observation is invalid"
  );
  invariant(Array.isArray(value.attempts) && value.attempts.length >= 1,
    "verification attempts are invalid");
  value.attempts.forEach((attempt, index) => {
    exactKeys(attempt, [
      "path", "attemptId", "attemptOrdinal", "status", "retryAllowed",
      "attemptContentHash", "fileBytes", "fileSha256", "sourceRevision"
    ], `verification attempt ${index}`);
    invariant(
      attempt.attemptOrdinal === index + 1 &&
        ["pass", "fail"].includes(attempt.status) &&
        typeof attempt.retryAllowed === "boolean" &&
        sha256Pattern.test(attempt.attemptContentHash) &&
        sha256Pattern.test(attempt.fileSha256) &&
        sourceRevisionPattern.test(attempt.sourceRevision),
      `verification attempt ${index} is invalid`
    );
  });
  const expectedInputPaths = verificationInputPaths(
    value.attempts.map((attempt) => ({ relativePath: attempt.path }))
  );
  exactStructure(
    value.verificationInputs.map((input) => input.path),
    expectedInputPaths,
    "verification input path set"
  );
  if (options.recomputeInputs !== false) {
    value.verificationInputs.forEach((input, index) =>
      exactStructure(
        input,
        hashInput(expectedInputPaths[index]),
        `verification input ${index}`
      ));
    const inputByPath = new Map(
      value.verificationInputs.map((input) => [input.path, input])
    );
    const observationInput = inputByPath.get(value.observation.path);
    invariant(observationInput !== undefined,
      "verification observation input is missing");
    invariant(
      observationInput.bytes === value.observation.fileBytes &&
        observationInput.sha256 === value.observation.fileSha256,
      "verification observation file binding is invalid"
    );
    value.attempts.forEach((attempt, index) => {
      const input = inputByPath.get(attempt.path);
      invariant(
        input !== undefined &&
          input.bytes === attempt.fileBytes &&
          input.sha256 === attempt.fileSha256,
        `verification attempt ${index} file binding is invalid`
      );
    });
  }
  exactKeys(value.evidenceSummary, [
    "qualityLaneCount", "perQueryMetricCount", "laneRows",
    "performanceProcessCount", "performanceRows", "corruptionCaseCount",
    "crashScenarioCount", "allOwnedProcessRootsDeleted", "outerRootDeleted",
    "resultDrivenThresholdChanges", "preservedAttemptCount",
    "pendingAttemptBindingVerified",
    "productAdoptionAuthorized", "wasmCompatibilityClaimed",
    "semanticMemoryQualityClaimed"
  ], "verification evidence summary");
  invariant(
    value.evidenceSummary.qualityLaneCount === 6 &&
      value.evidenceSummary.perQueryMetricCount === 790 &&
      value.evidenceSummary.performanceProcessCount === 60 &&
      value.evidenceSummary.corruptionCaseCount === 7 &&
      value.evidenceSummary.crashScenarioCount === 4 &&
      value.evidenceSummary.allOwnedProcessRootsDeleted === true &&
      value.evidenceSummary.outerRootDeleted === true &&
      value.evidenceSummary.resultDrivenThresholdChanges === false &&
      value.evidenceSummary.preservedAttemptCount === value.attempts.length &&
      value.evidenceSummary.pendingAttemptBindingVerified === true &&
      value.evidenceSummary.productAdoptionAuthorized === false &&
      value.evidenceSummary.wasmCompatibilityClaimed === false &&
      value.evidenceSummary.semanticMemoryQualityClaimed === false,
    "verification evidence summary is invalid"
  );
  invariant(
    Array.isArray(value.evidenceSummary.laneRows) &&
      value.evidenceSummary.laneRows.length === 6 &&
      Array.isArray(value.evidenceSummary.performanceRows) &&
      value.evidenceSummary.performanceRows.length === 6,
    "verification evidence rows are invalid"
  );
  exactStructure(value.authority, verificationAuthority,
    "verification authority");
  exactStructure(value.openGaps, verificationOpenGaps, "verification open gaps");
  exactStructure(
    value.requiredNextGate,
    validateManifestFile().manifest.requiredNextGate,
    "verification next gate"
  );
  publicSafe(value, "verification receipt");
  return value;
}

function buildReceipt(options = {}) {
  const observed = validateObservationFile();
  const observation = observed.observation;
  const attempts = discoverAttemptArchive();
  const last = attempts.at(-1).attempt;
  invariant(
    last.observationId === observation.observationId &&
      last.observationContentHash === observation.observationContentHash &&
      last.sourceRevision === observation.sourceRevision &&
      last.attemptOrdinal === observation.attemptOrdinal &&
      last.previousAttemptId === observation.previousAttemptId &&
      last.startedAtUtc === observation.attemptStartedAtUtc,
    "verification passing attempt does not bind observation"
  );
  const paths = verificationInputPaths(attempts);
  assertInputsCommitted(paths);
  const manifest = validateManifestFile();
  const body = {
    schema: receiptSchema,
    experimentId: expectedExperimentId,
    status: "verified-with-bounded-authority",
    generatedAtUtc: options.generatedAtUtc || new Date().toISOString(),
    observedSourceRevision: observation.sourceRevision,
    verificationSourceRevision:
      options.verificationSourceRevision || sourceRevision(),
    verificationMode:
      "independent-content-summary-revalidation-without-benchmark-rerun",
    verificationTool: options.verificationTool || nodeIdentity(),
    verificationInputs: paths.map(hashInput),
    preregistration: {
      path: preregistrationRelativePath,
      sha256: manifest.sha256
    },
    observation: {
      path: observationRelativePath,
      observationId: observation.observationId,
      observationContentHash: observation.observationContentHash,
      fileBytes: observed.bytes,
      fileSha256: observed.sha256
    },
    attempts: attempts.map(attemptReference),
    evidenceSummary: independentEvidenceSummary(observation, attempts.length),
    authority: observation.authority,
    openGaps: observation.openGaps,
    requiredNextGate: observation.requiredNextGate
  };
  const receipt = finalizeReceipt(body);
  validateReceipt(receipt);
  return receipt;
}

function validateReceiptFile(filePath = receiptPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 0 && stat.size <= maximumEvidenceBytes,
    "verification receipt file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const receipt = validateReceipt(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalPrettyBytes(receipt)),
    "verification receipt bytes are not canonical");
  return Object.freeze({ receipt, bytes: bytes.length, sha256: sha256(bytes) });
}

function writeReceipt() {
  invariant(!fs.existsSync(receiptPath),
    "verification receipt already exists");
  const receipt = buildReceipt();
  atomicCreate(receiptPath, canonicalPrettyBytes(receipt));
  return validateReceiptFile();
}

function main(argumentsList) {
  invariant(
    argumentsList.length === 1 &&
      ["--write", "--validate"].includes(argumentsList[0]),
    "usage: node vector-turbovec-reference-verification.js --write|--validate"
  );
  const result = argumentsList[0] === "--write"
    ? writeReceipt()
    : validateReceiptFile();
  process.stdout.write(`${JSON.stringify({
    schema: result.receipt.schema,
    receiptId: result.receipt.receiptId,
    sha256: result.sha256,
    status: argumentsList[0] === "--write" ? "written" : "valid"
  })}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "verification failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  attemptDirectoryRelativePath,
  buildReceipt,
  discoverAttemptArchive,
  finalizeReceipt,
  independentEvidenceSummary,
  receiptIdentity,
  receiptPath,
  receiptSchema,
  validateReceipt,
  validateReceiptFile,
  verificationInputPaths,
  writeReceipt
});
