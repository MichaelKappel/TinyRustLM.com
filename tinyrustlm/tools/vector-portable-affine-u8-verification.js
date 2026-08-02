"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  productionLineageReader
} = require("./clean-history-lineage.js");
const {
  validateGitInput
} = require("./vector-historical-git-input.js");
const {
  canonicalPrettyBytes,
  evaluatePerformanceThresholds,
  evaluateQualityThresholds,
  expectedExperimentId,
  inputPaths: observationInputPaths,
  observationAuthority,
  observationPath,
  openGaps,
  preregistrationRelativePath,
  sha256,
  summarizePerformance,
  validateAttempt,
  validateObservationFile
} = require("./vector-portable-affine-u8-observation.js");
const {
  validateManifestFile
} = require("./vector-portable-affine-u8-preregistration.js");

const receiptSchema =
  "tinyrustlm.portable_affine_u8_flat_verification.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-flat-observation-v1.json";
const receiptRelativePath =
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-flat-verification-v1.json";
const receiptPath = path.join(repositoryRoot, receiptRelativePath);
const attemptDirectoryRelativePath =
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-flat-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptDirectoryRelativePath);
const preregistrationSha256 =
  "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d";
const maximumEvidenceBytes = 64 * 1024 * 1024;
const maximumInputBytes = 64 * 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;

const remainingBoundaries = Object.freeze([
  Object.freeze({
    boundaryId: "real-browser-wasm-execution",
    status: "not-proven"
  }),
  Object.freeze({
    boundaryId: "representative-semantic-memory-corpus",
    status: "not-proven"
  }),
  Object.freeze({
    boundaryId: "browser-performance",
    status: "not-proven"
  }),
  Object.freeze({
    boundaryId: "power-loss-durability",
    status: "not-tested"
  }),
  Object.freeze({
    boundaryId: "filesystem-forensic-erasure",
    status: "not-tested"
  }),
  Object.freeze({
    boundaryId: "product-integration",
    status: "not-authorized"
  })
]);
const terminalNoObservationAuthority = Object.freeze(
  Object.fromEntries(
    Object.keys(observationAuthority).map((key) => [key, false])
  )
);
const terminalNoObservationGaps = Object.freeze([
  Object.freeze({
    gapId: "sealed-quality-observation",
    status: "terminal-failed",
    blockerCode: "PORTABLE_AFFINE_U8_QUALITY_OUTCOME_REJECTED"
  }),
  ...openGaps
]);
const terminalRequiredNextGate =
  "Preregister a new diagnostic or successor experiment. This terminal " +
  "experiment may not be rerun, promoted, or used for a quality claim.";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort()),
    `${label} fields are invalid`
  );
}

function exactValue(value, expected, label) {
  invariant(Object.is(value, expected), `${label} is invalid`);
}

function exactStructure(value, expected, label) {
  invariant(
    canonicalJson(value) === canonicalJson(expected),
    `${label} is invalid`
  );
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
    typeof relativePath === "string" &&
      relativePath.length > 0 &&
      !path.isAbsolute(relativePath) &&
      !relativePath.includes(".."),
    "verification repository path is invalid"
  );
  const absolute = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, absolute);
  invariant(
    relative !== "" &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative),
    "verification repository path escaped"
  );
  const stat = fs.lstatSync(absolute);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumBytes,
    `verification repository input ${relativePath} is invalid`
  );
  return absolute;
}

function fileEvidence(relativePath) {
  const absolute = resolveRepositoryFile(relativePath);
  const stat = fs.statSync(absolute);
  return Object.freeze({
    path: relativePath.replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: sha256File(absolute)
  });
}

function sourceRevision() {
  const revision = productionLineageReader().headRevision();
  invariant(
    sourceRevisionPattern.test(revision),
    "verification source revision is invalid"
  );
  return revision;
}

function assertRevisionAncestor(ancestor, descendant, label) {
  invariant(
    sourceRevisionPattern.test(ancestor) &&
      sourceRevisionPattern.test(descendant),
    `${label} revision is invalid`
  );
  invariant(
    productionLineageReader().isAncestor(ancestor, descendant),
    `${label} ancestry is invalid`
  );
}

function assertInputsCommitted(paths) {
  invariant(
    Array.isArray(paths) &&
      paths.length > 0 &&
      new Set(paths).size === paths.length,
    "verification input path closure is invalid"
  );
  for (const relativePath of paths) {
    resolveRepositoryFile(relativePath);
    git(
      ["ls-files", "--error-unmatch", "--", relativePath],
      `tracked verification input ${relativePath}`
    );
  }
  exactValue(
    git(["status", "--porcelain=v1", "--", ...paths], "verification input status"),
    "",
    "verification input cleanliness"
  );
}

function discoverAttemptArchive() {
  if (!fs.existsSync(attemptDirectory)) return Object.freeze([]);
  const entries = [];
  for (const prefix of fs.readdirSync(attemptDirectory).sort()) {
    invariant(/^[a-f0-9]{2}$/u.test(prefix), "attempt prefix is invalid");
    const prefixPath = path.join(attemptDirectory, prefix);
    const prefixStat = fs.lstatSync(prefixPath);
    invariant(
      prefixStat.isDirectory() && !prefixStat.isSymbolicLink(),
      "attempt prefix is not a regular directory"
    );
    for (const name of fs.readdirSync(prefixPath).sort()) {
      invariant(
        /^[a-f0-9]{64}\.json$/u.test(name),
        "attempt file name is invalid"
      );
      const absolute = path.join(prefixPath, name);
      const stat = fs.lstatSync(absolute);
      invariant(
        stat.isFile() &&
          !stat.isSymbolicLink() &&
          stat.size > 0 &&
          stat.size <= maximumEvidenceBytes,
        "attempt file is invalid"
      );
      const bytes = fs.readFileSync(absolute);
      const attempt = validateAttempt(JSON.parse(bytes.toString("utf8")));
      invariant(
        bytes.equals(canonicalPrettyBytes(attempt)),
        "attempt bytes are not canonical"
      );
      exactValue(
        name,
        `${attempt.attemptContentHash}.json`,
        "attempt content-addressed name"
      );
      exactValue(prefix, attempt.attemptContentHash.slice(0, 2), "attempt prefix");
      const relativePath = path
        .relative(repositoryRoot, absolute)
        .replaceAll("\\", "/");
      entries.push(Object.freeze({
        attempt,
        path: relativePath,
        bytes: bytes.length,
        fileSha256: sha256(bytes)
      }));
    }
  }
  entries.sort(
    (left, right) =>
      left.attempt.attemptOrdinal - right.attempt.attemptOrdinal
  );
  entries.forEach((entry, index) => {
    exactValue(
      entry.attempt.attemptOrdinal,
      index + 1,
      "verification attempt ordinal"
    );
    exactValue(
      entry.attempt.previousAttemptId,
      index === 0 ? null : entries[index - 1].attempt.attemptId,
      "verification attempt predecessor"
    );
    if (index > 0) {
      const prior = entries[index - 1].attempt;
      invariant(
        prior.status === "fail" && prior.failure.retryAllowed === true,
        "verification attempt follows a terminal outcome"
      );
    }
  });
  return Object.freeze(entries);
}

function attemptReference(entry) {
  return Object.freeze({
    path: entry.path,
    bytes: entry.bytes,
    fileSha256: entry.fileSha256,
    attemptId: entry.attempt.attemptId,
    attemptContentHash: entry.attempt.attemptContentHash,
    attemptOrdinal: entry.attempt.attemptOrdinal,
    status: entry.attempt.status,
    sourceRevision: entry.attempt.sourceRevision,
    failureCode: entry.attempt.failure?.code ?? null,
    failureClassification:
      entry.attempt.failure?.classification ?? null,
    retryAllowed:
      entry.attempt.failure === null
        ? false
        : entry.attempt.failure.retryAllowed,
    failureMessageSha256:
      entry.attempt.failure?.messageSha256 ?? null,
    failureCauseMessageSha256:
      entry.attempt.failure?.causeMessageSha256 ?? null,
    observationId: entry.attempt.observationId,
    observationContentHash: entry.attempt.observationContentHash
  });
}

function verificationInputPaths(attempts = [], observationPresent = true) {
  invariant(
    typeof observationPresent === "boolean",
    "observation presence flag is invalid"
  );
  return Object.freeze([
    ...new Set([
      ...observationInputPaths,
      ...(observationPresent ? [observationRelativePath] : []),
      ...attempts.map((entry) => entry.path)
    ])
  ]);
}

function laneSummary(lane, performance) {
  return Object.freeze({
    laneId: lane.laneId,
    minimumRecallAt1: lane.minimumRecallAt1,
    minimumRecallAt10: lane.minimumRecallAt10,
    minimumRecallAt100: lane.minimumRecallAt100,
    minimumMrrAt100: lane.minimumMrrAt100,
    minimumNdcgAt100: lane.minimumNdcgAt100,
    maximumRankInversionRateAt100: lane.maximumRankInversionRateAt100,
    meanAbsoluteNormalizedScoreError:
      lane.meanAbsoluteNormalizedScoreError,
    p99AbsoluteNormalizedScoreError:
      lane.p99AbsoluteNormalizedScoreError,
    missingResultCount: lane.missingResultCount,
    duplicateResultCount: lane.duplicateResultCount,
    candidateIndexBytes: lane.byteAccounting.candidateIndexBytes,
    fullExactIndexBytes: lane.byteAccounting.fullExactIndexBytes,
    candidateToFullExactRatio:
      lane.byteAccounting.candidateToFullExactRatio,
    capacityExactRecordCount: lane.capacityControl.exactRecordCount,
    qualityThresholdsPassed: null,
    performanceThresholdsPassed: performance.thresholdsPassed
  });
}

function independentEvidenceSummary(observation, attemptCount) {
  const qualityDecision = evaluateQualityThresholds(observation.quality);
  const recomputedPerformance =
    summarizePerformance(observation.performanceRecords);
  exactStructure(
    observation.performanceSummaries,
    recomputedPerformance,
    "verification performance summary recomputation"
  );
  const performanceDecision =
    evaluatePerformanceThresholds(recomputedPerformance);
  const failuresByLane = new Set([
    ...qualityDecision.failures.map((failure) => failure.laneId),
    ...performanceDecision.failures.map((failure) => failure.laneId)
  ]);
  const lanes = observation.quality.laneResults.map((lane, index) => {
    const summary = laneSummary(lane, recomputedPerformance[index]);
    return Object.freeze({
      ...summary,
      qualityThresholdsPassed:
        !qualityDecision.failures.some((failure) =>
          failure.laneId === lane.laneId),
      performanceThresholdsPassed:
        !performanceDecision.failures.some((failure) =>
          failure.laneId === lane.laneId)
    });
  });
  const outcomePassed =
    qualityDecision.passed && performanceDecision.passed;
  exactValue(
    observation.status,
    outcomePassed ? "pass" : "fail-comparison-outcome-terminal",
    "verification observation outcome status"
  );
  return Object.freeze({
    status: outcomePassed ? "pass" : "fail",
    outcomeTerminal: !outcomePassed,
    attemptCount,
    laneCount: lanes.length,
    queryCount: observation.quality.perQueryMetrics.length,
    performanceProcessCount: observation.performanceRecords.length,
    corruptionProcessCount: observation.corruptionRecords.length,
    crashRecoveryProcessCount: observation.crashRecoveries.length,
    wasmImportCount:
      observation.buildVerification.wasmExecution.importCount,
    wasmMainResult:
      observation.buildVerification.wasmExecution.mainResult,
    qualityDecision,
    performanceDecision,
    failedLaneCount: failuresByLane.size,
    lanes: Object.freeze(lanes)
  });
}

function terminalNoObservationSummary(archive) {
  invariant(
    Array.isArray(archive) && archive.length === 2,
    "terminal no-observation archive must contain two attempts"
  );
  const attempts = archive.map((entry) => entry.attempt);
  invariant(
    attempts.every(
      (attempt) =>
        attempt.status === "fail" &&
        attempt.observationId === null &&
        attempt.observationContentHash === null
    ),
    "terminal no-observation attempt coverage is invalid"
  );
  exactValue(
    attempts[0].failure.code,
    "PORTABLE_AFFINE_U8_ATTEMPT_COMMIT_REJECTED",
    "first terminal attempt failure code"
  );
  exactValue(
    attempts[0].failure.classification,
    "instrumentation",
    "first terminal attempt classification"
  );
  exactValue(
    attempts[0].failure.retryAllowed,
    true,
    "first terminal attempt retry policy"
  );
  const terminal = attempts[1];
  exactValue(
    terminal.failure.code,
    "PORTABLE_AFFINE_U8_QUALITY_OUTCOME_REJECTED",
    "terminal quality failure code"
  );
  exactValue(
    terminal.failure.classification,
    "instrumentation",
    "terminal quality failure classification"
  );
  exactValue(
    terminal.failure.retryAllowed,
    false,
    "terminal quality failure retry policy"
  );
  return Object.freeze({
    status: "terminal-no-observation",
    outcomeTerminal: true,
    attemptCount: attempts.length,
    retryableAttemptCount: attempts.filter(
      (attempt) => attempt.failure.retryAllowed
    ).length,
    instrumentationFailureCount: attempts.filter(
      (attempt) =>
        attempt.failure.classification === "instrumentation"
    ).length,
    terminalAttemptId: terminal.attemptId,
    terminalAttemptContentHash: terminal.attemptContentHash,
    terminalFailureCode: terminal.failure.code,
    terminalFailureClassification: terminal.failure.classification,
    terminalFailureMessageSha256: terminal.failure.messageSha256,
    terminalFailureCauseMessageSha256:
      terminal.failure.causeMessageSha256,
    observationPresent: false,
    qualityMetricsPresent: false,
    performanceMetricsPresent: false,
    corruptionMetricsPresent: false,
    crashRecoveryMetricsPresent: false,
    sameExperimentRetryAllowed: false,
    modelQualityClaimAllowed: false,
    productPromotionAllowed: false
  });
}

function receiptIdentity(value) {
  const body = { ...value };
  delete body.receiptId;
  delete body.receiptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `portable-affine-u8-flat-verification-${hash.slice(0, 16)}`,
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

function validateReceipt(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "verifiedAtUtc",
    "verificationSourceRevision", "preregistration", "observation",
    "attempts", "inputs", "independentSummary", "authority", "openGaps",
    "remainingBoundaries", "requiredNextGate", "receiptId",
    "receiptContentHash"
  ], "verification receipt");
  exactValue(value.schema, receiptSchema, "verification receipt schema");
  exactValue(
    value.experimentId,
    expectedExperimentId,
    "verification experimentId"
  );
  invariant(
    [
      "verified-pass",
      "verified-terminal-failure",
      "verified-terminal-no-observation"
    ].includes(value.status),
    "verification status is invalid"
  );
  invariant(
    utcPattern.test(value.verifiedAtUtc) &&
      Number.isFinite(Date.parse(value.verifiedAtUtc)) &&
      sourceRevisionPattern.test(value.verificationSourceRevision),
    "verification timestamp or revision is invalid"
  );
  const manifestResult = validateManifestFile();
  exactValue(
    manifestResult.sha256,
    preregistrationSha256,
    "verification preregistration identity"
  );
  exactStructure(value.preregistration, {
    path: preregistrationRelativePath,
    sha256: manifestResult.sha256
  }, "verification preregistration");
  const archive = discoverAttemptArchive();
  invariant(archive.length > 0, "verification attempt archive is empty");
  exactStructure(
    value.attempts,
    archive.map(attemptReference),
    "verification attempt references"
  );
  const observationPresent = fs.existsSync(observationPath);
  const terminalWithoutObservation =
    value.status === "verified-terminal-no-observation";
  exactValue(
    observationPresent,
    !terminalWithoutObservation,
    "verification observation presence"
  );
  let reopened = null;
  let summary;
  let expectedAuthority;
  let expectedGaps;
  let expectedNextGate;
  if (terminalWithoutObservation) {
    exactValue(value.observation, null, "terminal verification observation");
    summary = terminalNoObservationSummary(archive);
    expectedAuthority = terminalNoObservationAuthority;
    expectedGaps = terminalNoObservationGaps;
    expectedNextGate = terminalRequiredNextGate;
  } else {
    reopened = validateObservationFile(observationPath);
    exactStructure(value.observation, {
      path: observationRelativePath,
      bytes: reopened.bytes,
      fileSha256: reopened.sha256,
      observationId: reopened.observation.observationId,
      observationContentHash: reopened.observation.observationContentHash,
      status: reopened.observation.status,
      sourceRevision: reopened.observation.sourceRevision
    }, "verification observation");
    const terminalAttempt = archive.at(-1).attempt;
    exactValue(
      terminalAttempt.observationId,
      reopened.observation.observationId,
      "verification terminal attempt observation id"
    );
    exactValue(
      terminalAttempt.observationContentHash,
      reopened.observation.observationContentHash,
      "verification terminal attempt observation hash"
    );
    summary =
      independentEvidenceSummary(reopened.observation, archive.length);
    expectedAuthority = observationAuthority;
    expectedGaps = openGaps;
    expectedNextGate = manifestResult.manifest.requiredNextGate;
  }
  const paths = verificationInputPaths(archive, observationPresent);
  invariant(
    Array.isArray(value.inputs) && value.inputs.length === paths.length,
    "verification input closure is incomplete"
  );
  value.inputs.forEach((input, index) => {
    exactKeys(input, ["path", "bytes", "sha256"], `verification input ${index}`);
    validateGitInput(
      input,
      repositoryRoot,
      value.verificationSourceRevision,
      paths[index],
      `verification input ${index}`,
      maximumInputBytes
    );
  });
  exactStructure(
    value.independentSummary,
    summary,
    "verification independent summary"
  );
  exactValue(
    value.status,
    summary.status === "pass"
      ? "verified-pass"
      : summary.status === "terminal-no-observation"
        ? "verified-terminal-no-observation"
        : "verified-terminal-failure",
    "verification status binding"
  );
  exactStructure(value.authority, expectedAuthority, "verification authority");
  exactStructure(value.openGaps, expectedGaps, "verification open gaps");
  exactStructure(
    value.remainingBoundaries,
    remainingBoundaries,
    "verification remaining boundaries"
  );
  exactValue(
    value.requiredNextGate,
    expectedNextGate,
    "verification required next gate"
  );
  archive.forEach((entry, index) => {
    assertRevisionAncestor(
      entry.attempt.sourceRevision,
      value.verificationSourceRevision,
      `attempt-${index + 1}-to-verification`
    );
  });
  if (reopened !== null) {
    assertRevisionAncestor(
      reopened.observation.sourceRevision,
      value.verificationSourceRevision,
      "observation-to-verification"
    );
    assertRevisionAncestor(
      reopened.observation.implementationCommit,
      value.verificationSourceRevision,
      "implementation-to-verification"
    );
  }
  const identity = receiptIdentity(value);
  exactValue(value.receiptId, identity.id, "verification receipt id");
  exactValue(
    value.receiptContentHash,
    identity.hash,
    "verification receipt content hash"
  );
  publicSafe(value, "verification receipt");
  return value;
}

function buildReceipt(options = {}) {
  const manifestResult = validateManifestFile();
  exactValue(
    manifestResult.sha256,
    preregistrationSha256,
    "verification preregistration identity"
  );
  const archive = discoverAttemptArchive();
  invariant(archive.length > 0, "verification attempt archive is empty");
  const observationPresent = fs.existsSync(observationPath);
  const reopened = observationPresent
    ? validateObservationFile(observationPath)
    : null;
  if (reopened !== null) {
    const terminalAttempt = archive.at(-1).attempt;
    exactValue(
      terminalAttempt.observationId,
      reopened.observation.observationId,
      "verification terminal attempt observation id"
    );
    exactValue(
      terminalAttempt.observationContentHash,
      reopened.observation.observationContentHash,
      "verification terminal attempt observation hash"
    );
  }
  const paths = verificationInputPaths(archive, observationPresent);
  assertInputsCommitted(paths);
  const revision = sourceRevision();
  archive.forEach((entry, index) => {
    assertRevisionAncestor(
      entry.attempt.sourceRevision,
      revision,
      `attempt-${index + 1}-to-verification`
    );
  });
  if (reopened !== null) {
    assertRevisionAncestor(
      reopened.observation.sourceRevision,
      revision,
      "observation-to-verification"
    );
  }
  const summary = reopened === null
    ? terminalNoObservationSummary(archive)
    : independentEvidenceSummary(reopened.observation, archive.length);
  const status = summary.status === "pass"
    ? "verified-pass"
    : summary.status === "terminal-no-observation"
      ? "verified-terminal-no-observation"
      : "verified-terminal-failure";
  const observationReference = reopened === null
    ? null
    : {
        path: observationRelativePath,
        bytes: reopened.bytes,
        fileSha256: reopened.sha256,
        observationId: reopened.observation.observationId,
        observationContentHash: reopened.observation.observationContentHash,
        status: reopened.observation.status,
        sourceRevision: reopened.observation.sourceRevision
      };
  const receipt = finalizeReceipt({
    schema: receiptSchema,
    experimentId: expectedExperimentId,
    status,
    verifiedAtUtc: options.verifiedAtUtc ?? new Date().toISOString(),
    verificationSourceRevision: revision,
    preregistration: {
      path: preregistrationRelativePath,
      sha256: manifestResult.sha256
    },
    observation: observationReference,
    attempts: archive.map(attemptReference),
    inputs: paths.map(fileEvidence),
    independentSummary: summary,
    authority: reopened === null
      ? terminalNoObservationAuthority
      : observationAuthority,
    openGaps: reopened === null ? terminalNoObservationGaps : openGaps,
    remainingBoundaries,
    requiredNextGate: reopened === null
      ? terminalRequiredNextGate
      : manifestResult.manifest.requiredNextGate
  });
  return validateReceipt(receipt);
}

function validateReceiptFile(filePath = receiptPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumEvidenceBytes,
    "verification receipt file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const receipt = validateReceipt(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(receipt)),
    "verification receipt bytes are not canonical"
  );
  return Object.freeze({
    receipt,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

function writeReceipt() {
  invariant(!fs.existsSync(receiptPath), "verification receipt already exists");
  const receipt = buildReceipt();
  atomicCreate(receiptPath, canonicalPrettyBytes(receipt));
  return validateReceiptFile(receiptPath);
}

function main(argumentsList) {
  invariant(
    argumentsList.length === 1 &&
      ["--write", "--validate"].includes(argumentsList[0]),
    "usage: node vector-portable-affine-u8-verification.js --write|--validate"
  );
  const result =
    argumentsList[0] === "--write" ? writeReceipt() : validateReceiptFile();
  process.stdout.write(`${JSON.stringify({
    schema: result.receipt.schema,
    receiptId: result.receipt.receiptId,
    sha256: result.sha256,
    status: result.receipt.status
  })}\n`);
  if ([
    "verified-terminal-failure",
    "verified-terminal-no-observation"
  ].includes(result.receipt.status)) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "affine-u8 verification failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  attemptReference,
  buildReceipt,
  discoverAttemptArchive,
  fileEvidence,
  finalizeReceipt,
  independentEvidenceSummary,
  receiptIdentity,
  receiptPath,
  receiptRelativePath,
  receiptSchema,
  remainingBoundaries,
  terminalNoObservationAuthority,
  terminalNoObservationGaps,
  terminalNoObservationSummary,
  terminalRequiredNextGate,
  validateReceipt,
  validateReceiptFile,
  verificationInputPaths,
  writeReceipt
});
