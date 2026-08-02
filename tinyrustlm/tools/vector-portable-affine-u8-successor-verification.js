"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  productionLineageReader
} = require("./clean-history-lineage.js");
const runner = require("./vector-portable-affine-u8-successor-observation.js");
const {
  readGitBlob,
  validateGitInput
} = require("./vector-historical-git-input.js");
const {
  expectedManifestSha256,
  validateManifestFile
} = require("./vector-portable-affine-u8-successor-preregistration.js");

const schema =
  "tinyrustlm.portable_affine_u8_flat_successor_verification.v1";
const receiptType = "portable-affine-u8-flat-successor-terminal-verification";
const repositoryRoot = path.resolve(__dirname, "../..");
const verificationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-successor-verification-v1.json";
const verificationPath = path.join(repositoryRoot, verificationRelativePath);
const verifierRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-successor-verification.js";
const verifierTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-successor-verification.test.js";
const attemptRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-successor-attempts/sha256/df/" +
  "df0c29200bd7439d953e09e674abb982db28a1fcf1d0a33e091d85b0492de188.json";
const expectedAttemptFileBytes = 41153;
const expectedAttemptFileSha256 =
  "a86a9505dc35c1304e6b847153c2421be859ad11b11015359dbf64a8779bd210";
const expectedAttemptContentHash =
  "df0c29200bd7439d953e09e674abb982db28a1fcf1d0a33e091d85b0492de188";
const expectedAttemptId =
  "portable-affine-u8-flat-successor-attempt-df0c29200bd7439d";
const expectedImplementationCommit =
  "ee369732640b29fa810a21bd3c12559d5fc4332b";
const expectedAttemptEvidenceCommit =
  "4e0c12102a18ae5d9a856a7d25765ea129e82c57";
const expectedRegistrationCommit =
  "294d3187b927508759ad342d57a5021a6dff680e";
const expectedQualityExitCode = 3221226505;
const expectedQualityExitCodeHex = "0xC0000409";
const expectedQualityStderrBytes = 294;
const expectedQualityStderrSha256 =
  "3d4710a3102ab6329d6332616c7b8beb948c309f2416f596027a340c5c01af71";
const expectedFailureMessageSha256 =
  "c300f6cd36c603c3aa2d44db0551fb737dca22bbcef3d3e6fd7b811463f8ff22";
const expectedCauseMessageSha256 =
  "014f2e1a1c433776f7a87a5464cc7eb5878dd429c09c3e03f7b6b68c480e2d33";
const maximumInputBytes = 64 * 1024 * 1024;
const maximumReceiptBytes = 4 * 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;
const emptySha256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const inputPaths = Object.freeze([
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-flat-successor-preregistration.v1.json",
  "tinyrustlm/tools/vector-portable-affine-u8-successor-preregistration.js",
  "tinyrustlm/tests/vector-portable-affine-u8-successor-preregistration.test.js",
  "tinyrustlm/tools/vector-portable-affine-u8-successor-observation.js",
  "tinyrustlm/tests/vector-portable-affine-u8-successor-observation.test.js",
  attemptRelativePath,
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-flat-verification-v1.json",
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-quality-diagnostic-verification-v1.json",
  "tinyrustlm/tools/vector-portable-affine-u8-observation.js",
  "tinyrustlm/tools/vector-diagnostic-pending-journal.js",
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  verifierRelativePath,
  verifierTestRelativePath,
  "tinyrustlm/tests/vector-experiment-isolation.test.js"
]);

const authority = Object.freeze({
  portableAffineU8NumericalBehaviorMayBeClaimed: false,
  sameCorpusCompressedRankQualityMayBeClaimed: false,
  equalDynamicIndexByteCapacityUtilityMayBeClaimed: false,
  completeDynamicIndexByteReductionMayBeClaimed: false,
  nativeReferencePerformanceMayBeClaimed: false,
  nativeAndWasmDecisionParityMayBeClaimed: false,
  wrapperProcessCrashRecoveryMayBeClaimed: false,
  representativeSemanticMemoryQualityMayBeClaimed: false,
  browserPerformanceMayBeClaimed: false,
  productIntegrationMayBeClaimed: false,
  trainingMayBeAuthorized: false,
  releaseMayBeAuthorized: false,
  campaignCounterMayBeIncremented: false
});
const requiredNextGate =
  "Preserve this verified terminal successor without retry. Diagnose the " +
  "quality-process fast-fail through non-outcome unit reproductions, add a " +
  "generic regression, make a scoped fix, and preregister a distinct full " +
  "successor before any new quality execution.";

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
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    `${label} fields are invalid`
  );
}

function exactValue(actual, expected, label) {
  invariant(Object.is(actual, expected), `${label} is invalid`);
}

function exactStructure(actual, expected, label) {
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} is invalid`
  );
}

function safeInteger(
  value,
  label,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
) {
  invariant(
    Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${label} is invalid`
  );
  return value;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
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

function canonicalPrettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function publicSafe(value, label) {
  invariant(
    !forbiddenTextPattern.test(JSON.stringify(value)),
    `${label} contains private or secret text`
  );
  return value;
}

function resolveRepositoryFile(relativePath) {
  invariant(relativePathPattern.test(relativePath), "repository path is unsafe");
  const resolved = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    "repository path escaped repository root"
  );
  const stat = fs.lstatSync(resolved);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumInputBytes,
    `verification input is invalid: ${relativePath}`
  );
  return Object.freeze({ resolved, stat });
}

function fileEvidence(relativePath) {
  const file = resolveRepositoryFile(relativePath);
  return Object.freeze({
    path: relativePath,
    bytes: file.stat.size,
    sha256: sha256File(file.resolved)
  });
}

function git(argumentsList, label, allowFailure = false, encoding = "utf8") {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding,
    windowsHide: true,
    timeout: 30000,
    maxBuffer: maximumInputBytes
  });
  invariant(result.error === undefined, `${label} spawn failed`);
  if (!allowFailure) {
    invariant(
      result.status === 0 &&
        result.signal === null &&
        (encoding === null
          ? Buffer.isBuffer(result.stderr) && result.stderr.length === 0
          : result.stderr === ""),
      `${label} failed`
    );
  }
  return result;
}

function sourceRevision() {
  const revision = productionLineageReader().headRevision();
  invariant(revisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function assertInputClosureCommitted() {
  for (const relativePath of inputPaths) {
    resolveRepositoryFile(relativePath);
    const tracked = git(
      ["ls-files", "--error-unmatch", "--", relativePath],
      `tracked verification input ${relativePath}`,
      true
    );
    exactValue(tracked.status, 0, `tracked verification input ${relativePath}`);
  }
  const status = git(
    ["status", "--porcelain=v1", "--", ...inputPaths],
    "verification input status"
  );
  exactValue(status.stdout, "", "verification input closure status");
}

function commitForPaths(paths, label) {
  const revision = productionLineageReader().lastChangeCommit(paths);
  invariant(revisionPattern.test(revision), `${label} is invalid`);
  return revision;
}

function assertCommitOrdering(
  registrationCommit,
  implementationCommit,
  attemptCommit,
  verifierCommit,
  revision
) {
  exactValue(registrationCommit, expectedRegistrationCommit, "registration commit");
  exactValue(
    implementationCommit,
    expectedImplementationCommit,
    "implementation commit"
  );
  exactValue(attemptCommit, expectedAttemptEvidenceCommit, "attempt evidence commit");
  invariant(
    verifierCommit !== registrationCommit &&
      verifierCommit !== implementationCommit &&
      verifierCommit !== attemptCommit,
    "verifier was not committed separately"
  );
  const chain = [
    [registrationCommit, implementationCommit],
    [implementationCommit, attemptCommit],
    [attemptCommit, verifierCommit],
    [verifierCommit, revision]
  ];
  for (const [ancestor, descendant] of chain) {
    exactValue(
      productionLineageReader().isAncestor(ancestor, descendant),
      true,
      "verification commit ancestry"
    );
  }
}

function historicalFileCandidates(relativePath, revision) {
  invariant(relativePathPattern.test(relativePath), "historical path is unsafe");
  invariant(revisionPattern.test(revision), "historical revision is invalid");
  const historicalBytes = readGitBlob(
    repositoryRoot,
    revision,
    relativePath,
    maximumInputBytes
  );
  invariant(
    historicalBytes.length > 0 &&
      historicalBytes.length <= maximumInputBytes,
    `historical verification input is invalid: ${relativePath}`
  );
  const raw = Object.freeze({
    path: relativePath,
    bytes: historicalBytes.length,
    sha256: sha256(historicalBytes)
  });
  let crlf = null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(historicalBytes);
    if (!text.includes("\r") && text.includes("\n")) {
      const bytes = Buffer.from(text.replaceAll("\n", "\r\n"), "utf8");
      crlf = Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes)
      });
    }
  } catch {
    // Binary inputs have only their raw Git-blob candidate.
  }
  return Object.freeze({ raw, crlf });
}

function validateAttemptInputClosure(attempt) {
  exactValue(
    attempt.inputs.length,
    runner.inputPaths.length,
    "attempt input count"
  );
  let rawGitBlobMatchCount = 0;
  let crlfCheckoutMatchCount = 0;
  attempt.inputs.forEach((entry, index) => {
    const candidates = historicalFileCandidates(
      runner.inputPaths[index],
      attempt.sourceRevision
    );
    if (JSON.stringify(entry) === JSON.stringify(candidates.raw)) {
      rawGitBlobMatchCount += 1;
      return;
    }
    invariant(
      candidates.crlf !== null &&
        JSON.stringify(entry) === JSON.stringify(candidates.crlf),
      `attempt historical input ${index} is invalid`
    );
    crlfCheckoutMatchCount += 1;
  });
  return Object.freeze({
    sourceRevision: attempt.sourceRevision,
    inputCount: attempt.inputs.length,
    rawGitBlobMatchCount,
    crlfCheckoutMatchCount,
    checkoutTransformationLimitedToLfToCrlf: true,
    everyInputRehashedAtSourceRevision: true
  });
}

function attemptFileEvidence() {
  const file = resolveRepositoryFile(attemptRelativePath);
  exactValue(file.stat.size, expectedAttemptFileBytes, "attempt file bytes");
  exactValue(
    sha256File(file.resolved),
    expectedAttemptFileSha256,
    "attempt file sha256"
  );
  return Object.freeze({
    path: attemptRelativePath,
    bytes: file.stat.size,
    sha256: expectedAttemptFileSha256
  });
}

function validateSuccessfulPrefix(attempt) {
  const records = attempt.benchmarkProcessLedger;
  exactValue(records.length, 17, "terminal benchmark process count");
  for (let index = 0; index < 16; index += 1) {
    const record = records[index];
    const scheduled = runner.benchmarkSchedule[index];
    exactValue(record.ordinal, index + 1, `process ${index + 1} ordinal`);
    exactValue(record.phase, scheduled.phase, `process ${index + 1} phase`);
    exactValue(record.mode, scheduled.mode, `process ${index + 1} mode`);
    exactStructure(
      record.publicArguments,
      scheduled.publicArguments,
      `process ${index + 1} arguments`
    );
    exactValue(record.processStarted, true, `process ${index + 1} started`);
    exactValue(record.exitCode, scheduled.exitCode, `process ${index + 1} exit`);
    exactValue(record.signal, null, `process ${index + 1} signal`);
    exactValue(record.spawnErrorCode, null, `process ${index + 1} spawn error`);
    exactValue(record.stderrBytes, 0, `process ${index + 1} stderr bytes`);
    exactValue(
      record.stderrSha256,
      emptySha256,
      `process ${index + 1} stderr hash`
    );
    exactValue(
      record.benchmarkErrorCode,
      null,
      `process ${index + 1} benchmark error`
    );
  }
  const quality = records[16];
  exactStructure(
    {
      ordinal: quality.ordinal,
      phase: quality.phase,
      mode: quality.mode,
      publicArguments: quality.publicArguments,
      processStarted: quality.processStarted,
      exitCode: quality.exitCode,
      signal: quality.signal,
      spawnErrorCode: quality.spawnErrorCode,
      stdoutBytes: quality.stdoutBytes,
      stdoutSha256: quality.stdoutSha256,
      stderrBytes: quality.stderrBytes,
      stderrSha256: quality.stderrSha256,
      benchmarkErrorCode: quality.benchmarkErrorCode
    },
    {
      ordinal: 17,
      phase: "quality",
      mode: "quality",
      publicArguments: [],
      processStarted: true,
      exitCode: expectedQualityExitCode,
      signal: null,
      spawnErrorCode: null,
      stdoutBytes: 0,
      stdoutSha256: emptySha256,
      stderrBytes: expectedQualityStderrBytes,
      stderrSha256: expectedQualityStderrSha256,
      benchmarkErrorCode: null
    },
    "quality process boundary"
  );
  return quality;
}

function validateRetainedPhaseEvidence(attempt) {
  const retained = attempt.retainedEvidence;
  invariant(retained !== null, "terminal attempt lacks retained evidence");
  invariant(
    retained.platform !== null &&
      retained.tools !== null &&
      retained.externalDataset !== null &&
      retained.buildVerification !== null &&
      retained.build !== null &&
      retained.contractExecution !== null &&
      retained.contract !== null,
    "setup, build, or contract evidence is incomplete"
  );
  exactValue(
    retained.corruptionRecords.length,
    7,
    "retained corruption record count"
  );
  exactValue(
    retained.crashRecoveries.length,
    4,
    "retained crash recovery record count"
  );
  exactValue(retained.qualityExecution, null, "retained quality execution");
  exactValue(retained.quality, null, "retained quality metrics");
  exactValue(
    retained.performanceRecords.length,
    0,
    "retained performance records"
  );
  exactValue(
    retained.performanceSummaries.length,
    0,
    "retained performance summaries"
  );
  exactValue(
    attempt.benchmarkProcessLedger[0].stdoutSha256,
    retained.contractExecution.stdoutSha256,
    "contract process binding"
  );
  retained.corruptionRecords.forEach((record, index) => {
    const process = attempt.benchmarkProcessLedger[1 + index];
    exactValue(process.stdoutSha256, record.stdoutSha256, "corruption stdout binding");
    exactValue(process.stderrSha256, record.stderrSha256, "corruption stderr binding");
  });
  retained.crashRecoveries.forEach((record, index) => {
    const crash = attempt.benchmarkProcessLedger[8 + index * 2];
    const recovery = attempt.benchmarkProcessLedger[9 + index * 2];
    exactValue(crash.stdoutSha256, record.crashStdoutSha256, "crash stdout binding");
    exactValue(crash.stderrSha256, record.crashStderrSha256, "crash stderr binding");
    exactValue(
      recovery.stdoutSha256,
      record.recoveryStdoutSha256,
      "recovery stdout binding"
    );
    exactValue(
      recovery.stderrSha256,
      record.recoveryStderrSha256,
      "recovery stderr binding"
    );
  });
}

function terminalSummary() {
  const manifestResult = validateManifestFile();
  exactValue(
    manifestResult.registrationCommit,
    expectedRegistrationCommit,
    "successor registration commit"
  );
  const archive = runner.loadAttemptArchive();
  exactValue(archive.length, 1, "successor attempt count");
  const entry = archive[0];
  const attempt = entry.attempt;
  exactValue(entry.bytes, expectedAttemptFileBytes, "attempt archive bytes");
  exactValue(entry.sha256, expectedAttemptFileSha256, "attempt archive sha256");
  exactValue(attempt.attemptId, expectedAttemptId, "attempt id");
  exactValue(
    attempt.attemptContentHash,
    expectedAttemptContentHash,
    "attempt content hash"
  );
  exactValue(attempt.attemptOrdinal, 1, "attempt ordinal");
  exactValue(attempt.previousAttemptId, null, "attempt predecessor");
  exactValue(
    attempt.status,
    "fail-comparison-outcome-terminal",
    "attempt status"
  );
  exactValue(attempt.lastPhase, "quality", "attempt last phase");
  exactValue(
    attempt.sourceRevision,
    expectedImplementationCommit,
    "attempt source revision"
  );
  exactValue(
    attempt.implementationCommit,
    expectedImplementationCommit,
    "attempt implementation commit"
  );
  exactValue(
    attempt.successorPreregistration.sha256,
    expectedManifestSha256,
    "attempt preregistration hash"
  );
  exactValue(
    attempt.memoryMonitorProcessLedger.length,
    0,
    "attempt monitor process count"
  );
  exactValue(
    attempt.maximumParallelBenchmarkProcesses,
    1,
    "attempt maximum benchmark parallelism"
  );
  const quality = validateSuccessfulPrefix(attempt);
  validateRetainedPhaseEvidence(attempt);
  const inputClosure = validateAttemptInputClosure(attempt);
  exactStructure(attempt.failure, {
    code: "PORTABLE_AFFINE_U8_QUALITY_OUTCOME_REJECTED",
    classification: "comparison-outcome",
    retryAllowed: false,
    messageSha256: expectedFailureMessageSha256,
    causeMessageSha256: expectedCauseMessageSha256,
    benchmarkErrorCode: null
  }, "terminal failure");
  exactStructure(attempt.cleanup, {
    outerRootCreated: true,
    outerRootDeleted: true,
    cleanupFailureMessageSha256: null
  }, "terminal cleanup");
  exactValue(attempt.observationId, null, "terminal observation id");
  exactValue(
    attempt.observationContentHash,
    null,
    "terminal observation content hash"
  );
  exactValue(attempt.processEvidenceComplete, true, "process evidence completeness");
  exactStructure(attempt.authority, authority, "terminal attempt authority");
  invariant(!fs.existsSync(runner.pendingPath), "successor pending journal remains");
  invariant(!fs.existsSync(runner.observationPath), "successor observation exists");
  return Object.freeze({
    attempt: Object.freeze({
      ...attemptFileEvidence(),
      attemptId: attempt.attemptId,
      attemptContentHash: attempt.attemptContentHash,
      sourceRevision: attempt.sourceRevision,
      evidenceCommit: expectedAttemptEvidenceCommit,
      status: attempt.status
    }),
    inputClosure,
    processSummary: Object.freeze({
      benchmarkProcessCount: attempt.benchmarkProcessLedger.length,
      memoryMonitorProcessCount: attempt.memoryMonitorProcessLedger.length,
      contractProcessPassed: true,
      corruptionProcessesPassed: 7,
      crashProcessesCompletedWithRegisteredExit: 4,
      recoveryProcessesPassed: 4,
      qualityProcessStarted: quality.processStarted,
      qualityProcessExitCode: quality.exitCode,
      qualityProcessExitCodeHex: expectedQualityExitCodeHex,
      qualityStdoutBytes: quality.stdoutBytes,
      qualityStdoutSha256: quality.stdoutSha256,
      qualityStderrBytes: quality.stderrBytes,
      qualityStderrSha256: quality.stderrSha256,
      qualityRawOutputPersisted: false,
      performanceProcessCount: 0
    }),
    independentDecision: Object.freeze({
      terminalAttemptValid: true,
      pendingJournalAbsent: true,
      observationAbsent: true,
      completeFrozenSuiteExecuted: false,
      qualityProcessSucceeded: false,
      qualityMetricsPresent: false,
      performanceExecuted: false,
      rootCauseDetermined: false,
      windowsStatusNameClaimed: false,
      sameSuccessorRetryAllowed: false,
      distinctPreregistrationRequiredBeforeNewOutcome: true,
      boundedResearchClaimSupported: false,
      productPromotionAllowed: false,
      trainingAuthorized: false,
      releaseAuthorized: false,
      campaignCounterMayBeIncremented: false
    })
  });
}

function receiptIdentity(value) {
  const body = { ...value };
  delete body.receiptId;
  delete body.receiptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `portable-affine-u8-flat-successor-verification-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizeReceipt(value) {
  const identity = receiptIdentity(value);
  return Object.freeze({
    ...value,
    receiptId: identity.id,
    receiptContentHash: identity.hash
  });
}

function validateFileEvidence(value, expectedPath, label) {
  exactKeys(value, ["path", "bytes", "sha256"], label);
  exactValue(value.path, expectedPath, `${label}.path`);
  safeInteger(value.bytes, `${label}.bytes`, 1, maximumInputBytes);
  invariant(sha256Pattern.test(value.sha256), `${label}.sha256 is invalid`);
}

function validateSummary(value) {
  exactKeys(value, [
    "attempt",
    "inputClosure",
    "processSummary",
    "independentDecision"
  ], "independent summary");
  exactStructure(value, terminalSummary(), "independent terminal summary");
}

function validateReceipt(value) {
  exactKeys(value, [
    "schema",
    "receiptType",
    "experimentId",
    "status",
    "verifiedAtUtc",
    "verificationSourceRevision",
    "registrationCommit",
    "implementationCommit",
    "attemptEvidenceCommit",
    "verifierCommit",
    "preregistrationSha256",
    "inputs",
    "independentSummary",
    "authority",
    "requiredNextGate",
    "receiptId",
    "receiptContentHash"
  ], "successor verification receipt");
  exactValue(value.schema, schema, "verification schema");
  exactValue(value.receiptType, receiptType, "verification receipt type");
  exactValue(value.experimentId, runner.experimentId, "verification experimentId");
  exactValue(
    value.status,
    "verified-terminal-quality-process-failure",
    "verification status"
  );
  invariant(
    utcPattern.test(value.verifiedAtUtc) &&
      Number.isFinite(Date.parse(value.verifiedAtUtc)) &&
      revisionPattern.test(value.verificationSourceRevision),
    "verification time or source revision is invalid"
  );
  exactValue(
    value.registrationCommit,
    expectedRegistrationCommit,
    "verification registration commit"
  );
  exactValue(
    value.implementationCommit,
    expectedImplementationCommit,
    "verification implementation commit"
  );
  exactValue(
    value.attemptEvidenceCommit,
    expectedAttemptEvidenceCommit,
    "verification attempt commit"
  );
  invariant(revisionPattern.test(value.verifierCommit), "verifier commit is invalid");
  exactValue(
    value.preregistrationSha256,
    expectedManifestSha256,
    "verification preregistration hash"
  );
  invariant(
    Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "verification input closure is incomplete"
  );
  value.inputs.forEach((entry, index) => {
    validateFileEvidence(entry, inputPaths[index], `verification input ${index}`);
    validateGitInput(
      entry,
      repositoryRoot,
      value.verificationSourceRevision,
      inputPaths[index],
      `verification input ${index}`,
      maximumInputBytes
    );
  });
  validateSummary(value.independentSummary);
  exactStructure(value.authority, authority, "verification authority");
  exactValue(value.requiredNextGate, requiredNextGate, "verification next gate");
  const identity = receiptIdentity(value);
  exactValue(value.receiptId, identity.id, "verification receipt id");
  exactValue(
    value.receiptContentHash,
    identity.hash,
    "verification receipt content hash"
  );
  publicSafe(value, "successor verification receipt");
  return value;
}

function buildReceipt() {
  invariant(!fs.existsSync(verificationPath), "verification receipt already exists");
  assertInputClosureCommitted();
  const manifestResult = validateManifestFile();
  const revision = sourceRevision();
  const implementation = commitForPaths(
    [
      "tinyrustlm/tools/vector-portable-affine-u8-successor-observation.js",
      "tinyrustlm/tests/vector-portable-affine-u8-successor-observation.test.js"
    ],
    "successor implementation commit"
  );
  const attemptCommit = commitForPaths(
    [attemptRelativePath],
    "successor attempt evidence commit"
  );
  const verifierCommit = commitForPaths(
    [verifierRelativePath, verifierTestRelativePath],
    "successor verifier commit"
  );
  assertCommitOrdering(
    manifestResult.registrationCommit,
    implementation,
    attemptCommit,
    verifierCommit,
    revision
  );
  const receipt = finalizeReceipt({
    schema,
    receiptType,
    experimentId: runner.experimentId,
    status: "verified-terminal-quality-process-failure",
    verifiedAtUtc: new Date().toISOString(),
    verificationSourceRevision: revision,
    registrationCommit: manifestResult.registrationCommit,
    implementationCommit: implementation,
    attemptEvidenceCommit: attemptCommit,
    verifierCommit,
    preregistrationSha256: expectedManifestSha256,
    inputs: inputPaths.map(fileEvidence),
    independentSummary: terminalSummary(),
    authority,
    requiredNextGate
  });
  validateReceipt(receipt);
  return receipt;
}

function writeReceipt() {
  const receipt = buildReceipt();
  atomicCreate(verificationPath, canonicalPrettyBytes(receipt));
  return validateReceiptFile();
}

function validateReceiptFile(filePath = verificationPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumReceiptBytes,
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
    bytes: stat.size,
    sha256: sha256(bytes)
  });
}

function main(argumentsList) {
  invariant(
    argumentsList.length === 1 &&
      ["--write", "--validate"].includes(argumentsList[0]),
    "usage: node vector-portable-affine-u8-successor-verification.js " +
      "--write|--validate"
  );
  const result = argumentsList[0] === "--write"
    ? writeReceipt()
    : validateReceiptFile();
  process.stdout.write(`${JSON.stringify({
    schema: result.receipt.schema,
    receiptId: result.receipt.receiptId,
    status: result.receipt.status,
    bytes: result.bytes,
    sha256: result.sha256,
    sameSuccessorRetryAllowed:
      result.receipt.independentSummary.independentDecision
        .sameSuccessorRetryAllowed,
    campaignCounterMayBeIncremented:
      result.receipt.independentSummary.independentDecision
        .campaignCounterMayBeIncremented
  })}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error
        ? error.message
        : "successor verification failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  authority,
  buildReceipt,
  canonicalPrettyBytes,
  expectedAttemptContentHash,
  expectedAttemptFileSha256,
  expectedAttemptId,
  expectedQualityExitCode,
  expectedQualityExitCodeHex,
  finalizeReceipt,
  inputPaths,
  receiptIdentity,
  receiptType,
  requiredNextGate,
  schema,
  terminalSummary,
  validateReceipt,
  validateReceiptFile,
  validateSummary,
  verificationPath,
  verificationRelativePath,
  writeReceipt
});
