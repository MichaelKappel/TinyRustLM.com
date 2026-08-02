"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const relativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-preregistration.v1.json";
const defaultPath = path.join(repositoryRoot, relativePath);
const expectedSha256 =
  "cd82f433d3588eb0527c2cc2c1fa945d5bf01dcd6909c50b20fb723b2f7f6782";
const expectedBytes = 18_686;
const schema = "tinyrustlm.portable_affine_u8_json_domain_v2_preregistration.v1";
const experimentId = "portable-affine-u8-flat-json-domain-v2-20260726";
const parentSourceRevision = "ab3ecd1698ba9a70c5975060e692efedee3d6669";
const redTestCommit = "cbc4a832f94f0fe683aeb9a19b34cba2c4b6a0bf";
const fixCommit = "e6a97380c5b571e069e866421a29f76b56344cd9";
const maximumManifestBytes = 64 * 1024;
const maximumHistoricalFileBytes = 2 * 1024 * 1024;
const revisionPattern = /^[0-9a-f]{40}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,7}Z$/u;
const relativePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const topLevelKeys = Object.freeze([
  "schema",
  "experimentId",
  "registeredAtUtc",
  "status",
  "registrationBoundary",
  "lineage",
  "subject",
  "outputContract",
  "fullExecution",
  "attemptPolicy",
  "plannedArtifacts",
  "evidencePolicy",
  "authority",
  "requiredNextGate"
]);
const authorityKeys = Object.freeze([
  "portableAffineU8NumericalBehaviorMayBeClaimed",
  "sameCorpusCompressedRankQualityMayBeClaimed",
  "equalDynamicIndexByteCapacityUtilityMayBeClaimed",
  "completeDynamicIndexByteReductionMayBeClaimed",
  "nativeReferencePerformanceMayBeClaimed",
  "nativeAndWasmDecisionParityMayBeClaimed",
  "wrapperProcessCrashRecoveryMayBeClaimed",
  "representativeSemanticMemoryQualityMayBeClaimed",
  "browserPerformanceMayBeClaimed",
  "productIntegrationMayBeClaimed",
  "trainingMayBeAuthorized",
  "releaseMayBeAuthorized",
  "campaignCounterMayBeIncremented"
]);
const potentiallySupported = new Set([
  "portableAffineU8NumericalBehaviorMayBeClaimed",
  "sameCorpusCompressedRankQualityMayBeClaimed",
  "equalDynamicIndexByteCapacityUtilityMayBeClaimed",
  "completeDynamicIndexByteReductionMayBeClaimed",
  "nativeReferencePerformanceMayBeClaimed",
  "nativeAndWasmDecisionParityMayBeClaimed",
  "wrapperProcessCrashRecoveryMayBeClaimed"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  invariant(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value)) === JSON.stringify(keys),
    `${label} structure is invalid`
  );
}

function exactValue(actual, expected, label) {
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} is invalid`
  );
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalPrettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function publicSafe(value) {
  const text = JSON.stringify(value);
  invariant(!/[A-Za-z]:\\/u.test(text), "manifest contains an absolute Windows path");
  invariant(!/(?:^|[^A-Za-z])(Bearer|Authorization)(?:[^A-Za-z]|$)/u.test(text),
    "manifest contains credential syntax");
  invariant(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(text),
    "manifest contains private key material");
}

function git(argumentsList, options = {}) {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: options.binary === true ? null : "utf8",
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: maximumHistoricalFileBytes + 1024 * 1024
  });
  invariant(result.error === undefined, `${options.label ?? "git"} did not spawn`);
  invariant(result.signal === null, `${options.label ?? "git"} received a signal`);
  if (options.allowFailure !== true) {
    invariant(result.status === 0, `${options.label ?? "git"} failed`);
    invariant(result.stderr.length === 0, `${options.label ?? "git"} wrote stderr`);
  }
  return result;
}

function resolveRepositoryFile(filePath) {
  invariant(relativePathPattern.test(filePath), `unsafe relative path: ${filePath}`);
  const resolved = path.resolve(repositoryRoot, filePath);
  invariant(
    resolved.startsWith(`${repositoryRoot}${path.sep}`),
    `path escaped repository: ${filePath}`
  );
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `file is invalid: ${filePath}`);
  return Object.freeze({ resolved, stat });
}

function checkoutCandidates(bytes) {
  const candidates = [bytes];
  const text = bytes.toString("utf8");
  if (
    Buffer.from(text, "utf8").equals(bytes) &&
    text.includes("\n") &&
    !text.includes("\r\n")
  ) {
    candidates.push(Buffer.from(text.replace(/\n/gu, "\r\n"), "utf8"));
  }
  return candidates;
}

function fileCandidates(filePath, revision = null) {
  if (revision === null) {
    const file = resolveRepositoryFile(filePath);
    invariant(
      file.stat.size <= maximumHistoricalFileBytes,
      `file is too large: ${filePath}`
    );
    return [fs.readFileSync(file.resolved)];
  }
  invariant(revisionPattern.test(revision), "historical revision is invalid");
  invariant(relativePathPattern.test(filePath), `unsafe historical path: ${filePath}`);
  const result = git(["cat-file", "blob", `${revision}:${filePath}`], {
    binary: true,
    label: `historical file ${filePath}`
  });
  invariant(
    result.stdout.length > 0 && result.stdout.length <= maximumHistoricalFileBytes,
    `historical file is invalid: ${filePath}`
  );
  return checkoutCandidates(result.stdout);
}

function validateFileReference(reference, label, revision = null) {
  exactKeys(reference, ["path", "bytes", "sha256"], label);
  invariant(relativePathPattern.test(reference.path), `${label} path is invalid`);
  invariant(
    Number.isSafeInteger(reference.bytes) &&
      reference.bytes > 0 &&
      reference.bytes <= maximumHistoricalFileBytes,
    `${label} byte count is invalid`
  );
  invariant(sha256Pattern.test(reference.sha256), `${label} hash is invalid`);
  const matches = fileCandidates(reference.path, revision).some(
    (candidate) =>
      candidate.length === reference.bytes && sha256(candidate) === reference.sha256
  );
  invariant(matches, `${label} identity drifted`);
}

function validateOriginalSections(manifest, revision) {
  const frozen = manifest.subject.frozenOriginalPreregistration;
  exactKeys(
    frozen,
    ["path", "bytes", "sha256", "sectionHashes"],
    "frozen original preregistration"
  );
  const reference = {
    path: frozen.path,
    bytes: frozen.bytes,
    sha256: frozen.sha256
  };
  validateFileReference(reference, "frozen original preregistration", revision);
  const source = fileCandidates(frozen.path, revision).find(
    (candidate) =>
      candidate.length === frozen.bytes && sha256(candidate) === frozen.sha256
  );
  invariant(source !== undefined, "frozen original preregistration is unavailable");
  const original = JSON.parse(source.toString("utf8"));
  const expectedSections = [
    "method",
    "corpusReuse",
    "groundTruth",
    "byteAccounting",
    "qualityThresholds",
    "nativeAndWasm",
    "performanceThresholds",
    "persistenceAndFailure"
  ];
  exactValue(
    frozen.sectionHashes.map((entry) => entry.section),
    expectedSections,
    "frozen section order"
  );
  frozen.sectionHashes.forEach((entry, index) => {
    exactKeys(entry, ["section", "canonicalJsonBytes", "sha256"],
      `frozen section ${index}`);
    const bytes = Buffer.from(JSON.stringify(original[entry.section]), "utf8");
    exactValue(bytes.length, entry.canonicalJsonBytes, `frozen section ${index} bytes`);
    exactValue(sha256(bytes), entry.sha256, `frozen section ${index} hash`);
  });
}

function validateLineage(manifest, revision) {
  exactKeys(manifest.lineage, ["terminalExperiment", "failureToRegression"], "lineage");
  const terminal = manifest.lineage.terminalExperiment;
  exactKeys(
    terminal,
    [
      "experimentId",
      "attemptPath",
      "attemptBytes",
      "attemptFileSha256",
      "attemptId",
      "attemptContentHash",
      "verificationPath",
      "verificationBytes",
      "verificationFileSha256",
      "verificationReceiptId",
      "status",
      "retryAllowed",
      "qualityMetricsPresent",
      "performanceMetricsPresent",
      "productPromotionAllowed",
      "campaignCounterMayBeIncremented"
    ],
    "terminal lineage"
  );
  validateFileReference(
    {
      path: terminal.attemptPath,
      bytes: terminal.attemptBytes,
      sha256: terminal.attemptFileSha256
    },
    "terminal attempt",
    revision
  );
  validateFileReference(
    {
      path: terminal.verificationPath,
      bytes: terminal.verificationBytes,
      sha256: terminal.verificationFileSha256
    },
    "terminal verification",
    revision
  );
  invariant(
    terminal.status === "verified-terminal-quality-process-failure" &&
      terminal.retryAllowed === false &&
      terminal.qualityMetricsPresent === false &&
      terminal.performanceMetricsPresent === false &&
      terminal.productPromotionAllowed === false &&
      terminal.campaignCounterMayBeIncremented === false,
    "terminal authority is invalid"
  );
  const defect = manifest.lineage.failureToRegression;
  exactKeys(
    defect,
    [
      "path",
      "bytes",
      "sha256",
      "defectId",
      "status",
      "exactFirstHistoricalPanicSiteProven",
      "sameExperimentRetryAllowed"
    ],
    "failure-to-regression lineage"
  );
  validateFileReference(
    { path: defect.path, bytes: defect.bytes, sha256: defect.sha256 },
    "failure-to-regression summary",
    revision
  );
  invariant(
    defect.status === "proven-code-defect-fixed-in-distinct-unexecuted-successor" &&
      defect.exactFirstHistoricalPanicSiteProven === false &&
      defect.sameExperimentRetryAllowed === false,
    "failure-to-regression boundary is invalid"
  );
}

function validateSubject(manifest, revision) {
  const subject = manifest.subject;
  invariant(subject.methodId === "portable-global-affine-u8-flat-v1",
    "subject method is invalid");
  for (const key of [
    "algorithmChanged",
    "retrievalImplementationChanged",
    "corpusChanged",
    "selectionChanged",
    "groundTruthChanged",
    "byteAccountingChanged",
    "qualityThresholdsChanged",
    "performanceThresholdsChanged",
    "persistenceSemanticsChanged"
  ]) {
    invariant(subject[key] === false, `subject ${key} is invalid`);
  }
  invariant(
    Array.isArray(subject.allowedImplementationChanges) &&
      subject.allowedImplementationChanges.length === 4 &&
      Array.isArray(subject.forbiddenImplementationChanges) &&
      subject.forbiddenImplementationChanges.length === 7,
    "subject change boundaries are invalid"
  );
  validateOriginalSections(manifest, revision);
  invariant(
    Array.isArray(subject.criticalInputs) &&
      subject.criticalInputs.length === 22 &&
      new Set(subject.criticalInputs.map((entry) => entry.path)).size === 22,
    "critical input closure is invalid"
  );
  subject.criticalInputs.forEach((entry, index) =>
    validateFileReference(entry, `critical input ${index}`, revision));
  const sourceReference = subject.criticalInputs.find(
    (entry) =>
      entry.path.endsWith("portable-affine-u8-benchmark-v2.rs")
  );
  invariant(sourceReference !== undefined, "v2 source is not frozen");
  const source = fileCandidates(sourceReference.path, revision).find(
    (candidate) =>
      candidate.length === sourceReference.bytes &&
      sha256(candidate) === sourceReference.sha256
  ).toString("utf8");
  for (const required of [
    "portable-affine-u8-flat-json-domain-v2-20260726",
    "tinyrustlm.portable_affine_u8_quality_process.v2",
    "fn json_finite_f64(value: f64) -> BenchResult<String>",
    "fn json_nonnegative_f64(value: f64) -> BenchResult<String>",
    "fn json_unit_f64(value: f64) -> BenchResult<String>",
    "fn json_signed_unit_f64(value: f64) -> BenchResult<String>"
  ]) {
    invariant(source.includes(required), `v2 source contract is missing ${required}`);
  }
  invariant(
    !source.includes("JSON metrics must be finite unit-interval values"),
    "v2 source retains the terminal serializer assertion"
  );
  const dataset = subject.externalDataset;
  invariant(
    dataset.revision === "b2617bb6d3ffa2e429640350f613e3291e10b141" &&
      dataset.tree === "ec8d5e52c0b9b2b09ea3f9d36b7bfafaf8ec0e97" &&
      dataset.selectionSha256 ===
        "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd" &&
      dataset.networkAcquisitionAllowed === false &&
      dataset.checkoutMustBeClean === true &&
      dataset.locatorMayEnterEvidence === false &&
      dataset.payloadBytesMayEnterEvidence === false &&
      dataset.selectedIndicesMayEnterEvidence === false &&
      dataset.rawVectorsMayEnterEvidence === false,
    "dataset contract is invalid"
  );
}

function validateOutputContract(manifest) {
  const contract = manifest.outputContract;
  invariant(
    contract.benchmarkContractSchema ===
      "tinyrustlm.portable_affine_u8_benchmark_contract.v2" &&
      contract.qualitySchema ===
        "tinyrustlm.portable_affine_u8_quality_process.v2" &&
      contract.performanceSchema ===
        "tinyrustlm.portable_affine_u8_performance_process.v2" &&
      contract.recoverySchema ===
        "tinyrustlm.portable_affine_u8_durable_deletion_recovery.v2" &&
      contract.commitSchema ===
        "tinyrustlm.portable_affine_u8_deletion_commit.v2",
    "output schema contract is invalid"
  );
  exactValue(
    Object.keys(contract.qualityNumberDomains),
    ["unitInterval", "signedUnitInterval", "nonnegativeFinite", "finite"],
    "quality number domains"
  );
  exactValue(contract.qualityNumberDomains.unitInterval.length, 6,
    "unit number domain count");
  exactValue(contract.qualityNumberDomains.signedUnitInterval,
    ["naturalUtilityDelta"], "signed number domains");
  exactValue(contract.qualityNumberDomains.nonnegativeFinite.length, 3,
    "nonnegative number domain count");
  exactValue(contract.qualityNumberDomains.finite,
    ["candidateRawScore", "oracleRawScore"], "finite number domains");
  invariant(
    contract.invalidNumberBehavior.includes("bounded lowercase benchmark error") &&
      contract.invalidNumberBehavior.includes("no assertion") &&
      contract.invalidNumberBehavior.includes("no") &&
      contract.invalidNumberBehavior.includes("retry"),
    "invalid number behavior is incomplete"
  );
}

function validateExecution(manifest) {
  const execution = manifest.fullExecution;
  invariant(
    execution.platform === "win32-x64-local-reference-only" &&
      execution.networkPolicy === "deny-all" &&
      execution.parallelBenchmarkProcesses === 1 &&
      execution.overallTimeoutMilliseconds === 3_600_000 &&
      execution.perProcessTimeoutMilliseconds === 300_000 &&
      execution.pendingIntentWrittenAndReopenedBeforeSetup === true &&
      execution.failFast === true,
    "execution envelope is invalid"
  );
  invariant(
    Array.isArray(execution.phaseOrder) &&
      execution.phaseOrder.length === 9 &&
      execution.phaseOrder.every(
        (phase, index) =>
          phase.ordinal === index + 1 &&
          phase.required === true &&
          Number.isSafeInteger(phase.benchmarkProcessCount) &&
          phase.benchmarkProcessCount >= 0
      ),
    "phase order is invalid"
  );
  exactValue(
    execution.phaseOrder.map((phase) => phase.phase),
    [
      "pending-intent",
      "source-dataset-tool-validation",
      "v2-regressions-native-tests-clippy-docs-wasm-build-and-execution",
      "contract",
      "corruption",
      "crash-and-recovery",
      "quality",
      "paired-performance",
      "threshold-decision-and-observation-commit"
    ],
    "phase names"
  );
  const processCount = execution.phaseOrder.reduce(
    (sum, phase) => sum + phase.benchmarkProcessCount,
    0
  );
  invariant(
    processCount === 77 &&
      execution.maximumBenchmarkProcessCount === 77 &&
      execution.maximumMemoryMonitorProcessCount === 60 &&
      execution.qualityProcessCount === 1,
    "process ceilings are invalid"
  );
  for (const key of [
    "qualityFailureIsTerminal",
    "qualityThresholdFailureIsTerminal",
    "performanceOutcomeFailureIsTerminal",
    "corruptionOrRecoverySemanticFailureIsTerminal",
    "laterPhasesSkippedAfterTerminalFailure",
    "rawProcessOutputRetainedOnlyInMemoryUntilValidation",
    "validMetricsRetainedOnThresholdFailure"
  ]) {
    invariant(execution[key] === true, `execution ${key} is invalid`);
  }
  invariant(
    execution.rawProcessOutputMayEnterEvidence === false &&
      execution.bestOfNAllowed === false &&
      execution.outputRepairAllowed === false,
    "execution anti-cheat boundary is invalid"
  );
  const policy = manifest.attemptPolicy;
  invariant(
    policy.maximumAttemptCount === 1 &&
      policy.maximumRetryCount === 0 &&
      policy.lostResponseRecoveryMayOnlyReopenTheSameCommittedAttempt === true &&
      policy.failedAttemptMustBePreserved === true &&
      policy.attemptMustBeContentAddressed === true &&
      policy.attemptMayBeOverwritten === false &&
      policy.pendingJournalMayBeRemovedOnlyAfterAttemptCommitAndReopen === true,
    "attempt policy is invalid"
  );
  for (const key of [
    "qualityProcessFailureMayBeRetried",
    "qualityThresholdFailureMayBeRetried",
    "performanceOutcomeFailureMayBeRetried",
    "corruptionOrRecoverySemanticFailureMayBeRetried",
    "infrastructureFailureMayBeRetried"
  ]) {
    invariant(policy[key] === false, `attempt retry ${key} is invalid`);
  }
}

function validatePlannedArtifacts(manifest) {
  const planned = manifest.plannedArtifacts;
  const keys = Object.keys(planned);
  invariant(keys.length === 16, "planned artifact structure is invalid");
  for (const [key, value] of Object.entries(planned)) {
    if (key.endsWith("Path") || key === "attemptDirectory") {
      invariant(
        typeof value === "string" && relativePathPattern.test(value),
        `planned artifact ${key} path is invalid`
      );
    } else {
      invariant(value === false, `planned artifact ${key} existed at registration`);
    }
  }
}

function validateAuthority(manifest) {
  exactKeys(
    manifest.authority,
    ["beforeIndependentVerifiedPass", "potentialAfterCompleteIndependentVerifiedPass"],
    "authority"
  );
  const before = manifest.authority.beforeIndependentVerifiedPass;
  const potential = manifest.authority.potentialAfterCompleteIndependentVerifiedPass;
  exactValue(Object.keys(before), authorityKeys, "before authority keys");
  exactValue(Object.keys(potential), authorityKeys, "potential authority keys");
  for (const key of authorityKeys) {
    invariant(before[key] === false, `before authority ${key} is invalid`);
    invariant(
      potential[key] === potentiallySupported.has(key),
      `potential authority ${key} is invalid`
    );
  }
}

function validateManifest(manifest) {
  exactKeys(manifest, topLevelKeys, "manifest");
  invariant(manifest.schema === schema, "manifest schema is invalid");
  invariant(manifest.experimentId === experimentId, "experiment ID is invalid");
  invariant(
    utcPattern.test(manifest.registeredAtUtc) &&
      Number.isFinite(Date.parse(manifest.registeredAtUtc)),
    "registration timestamp is invalid"
  );
  invariant(
    manifest.status === "preregistered-after-fix-before-runner-or-outcome",
    "manifest status is invalid"
  );
  exactKeys(
    manifest.registrationBoundary,
    [
      "parentSourceRevision",
      "redTestCommit",
      "fixCommit",
      "defectSummaryCommit",
      "implementationExistsBeforeRegistration",
      "outcomeRunnerExistsBeforeRegistration",
      "outcomeModesInvokedBeforeRegistration",
      "qualityMetricsObservedBeforeRegistration",
      "performanceMetricsObservedBeforeRegistration",
      "thresholdDecisionObservedBeforeRegistration"
    ],
    "registration boundary"
  );
  const boundary = manifest.registrationBoundary;
  invariant(
    boundary.parentSourceRevision === parentSourceRevision &&
      boundary.redTestCommit === redTestCommit &&
      boundary.fixCommit === fixCommit &&
      boundary.defectSummaryCommit === parentSourceRevision &&
      boundary.implementationExistsBeforeRegistration === true,
    "registration lineage is invalid"
  );
  for (const key of [
    "outcomeRunnerExistsBeforeRegistration",
    "outcomeModesInvokedBeforeRegistration",
    "qualityMetricsObservedBeforeRegistration",
    "performanceMetricsObservedBeforeRegistration",
    "thresholdDecisionObservedBeforeRegistration"
  ]) {
    invariant(boundary[key] === false, `registration ${key} is invalid`);
  }
  validateOutputContract(manifest);
  validateExecution(manifest);
  validatePlannedArtifacts(manifest);
  validateAuthority(manifest);
  for (const [key, value] of Object.entries(manifest.evidencePolicy)) {
    const mustBeFalse = new Set([
      "rawStdoutAllowed",
      "rawStderrAllowed",
      "privateAbsolutePathsAllowed",
      "credentialsAllowed",
      "datasetLocatorAllowed",
      "rawDatasetPayloadAllowed",
      "selectedIndicesAllowed",
      "resultDrivenReclassificationAllowed"
    ]);
    invariant(
      value === !mustBeFalse.has(key),
      `evidence policy ${key} is invalid`
    );
  }
  invariant(
    manifest.requiredNextGate.includes("Commit this preregistration") &&
      manifest.requiredNextGate.includes("exactly once") &&
      manifest.requiredNextGate.includes("independent verifier"),
    "required next gate is invalid"
  );
  publicSafe(manifest);
  invariant(
    sha256(canonicalPrettyBytes(manifest)) === expectedSha256,
    "manifest frozen contract is invalid"
  );
  return manifest;
}

function registrationCommit() {
  const result = git(
    ["log", "--diff-filter=A", "--format=%H", "--", relativePath],
    { label: "registration history" }
  );
  const revisions = result.stdout.trim().split(/\r?\n/gu).filter(Boolean);
  invariant(revisions.length <= 1, "manifest has multiple addition commits");
  if (revisions.length === 0) return null;
  invariant(revisionPattern.test(revisions[0]), "registration commit is invalid");
  return revisions[0];
}

function pathExistsAtRevision(revision, filePath) {
  const result = git(["cat-file", "-e", `${revision}:${filePath}`], {
    allowFailure: true,
    label: `planned artifact check ${filePath}`
  });
  invariant([0, 128].includes(result.status), "planned artifact check failed");
  return result.status === 0;
}

function assertAncestor(ancestor, descendant, label) {
  invariant(revisionPattern.test(ancestor) && revisionPattern.test(descendant),
    `${label} revision is invalid`);
  const result = git(["merge-base", "--is-ancestor", ancestor, descendant], {
    allowFailure: true,
    label
  });
  invariant(result.status === 0, `${label} ancestry is invalid`);
}

function validateRegistrationOrdering(manifest, commit) {
  if (commit === null) {
    for (const [key, value] of Object.entries(manifest.plannedArtifacts)) {
      if (!(key.endsWith("Path") || key === "attemptDirectory")) continue;
      invariant(
        !fs.existsSync(path.resolve(repositoryRoot, value)),
        `planned artifact exists before registration: ${value}`
      );
    }
    return null;
  }
  const parent = git(["rev-parse", `${commit}^`], {
    label: "registration parent"
  }).stdout.trim();
  invariant(parent === parentSourceRevision, "registration parent is invalid");
  assertAncestor(redTestCommit, fixCommit, "red-to-fix");
  assertAncestor(fixCommit, parentSourceRevision, "fix-to-registration-parent");
  for (const [key, value] of Object.entries(manifest.plannedArtifacts)) {
    if (!(key.endsWith("Path") || key === "attemptDirectory")) continue;
    invariant(
      !pathExistsAtRevision(commit, value),
      `planned artifact existed at registration: ${value}`
    );
  }
  return commit;
}

function validateManifestFile(filePath = defaultPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size === expectedBytes &&
      stat.size <= maximumManifestBytes,
    "manifest file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(manifest)),
    "manifest bytes are not canonical"
  );
  invariant(sha256(bytes) === expectedSha256, "manifest hash is invalid");
  const commit = registrationCommit();
  const revision = commit ?? null;
  validateLineage(manifest, revision);
  validateSubject(manifest, revision);
  validateRegistrationOrdering(manifest, commit);
  return Object.freeze({
    manifest,
    bytes: stat.size,
    sha256: expectedSha256,
    registrationCommit: commit
  });
}

function main() {
  invariant(process.argv.length <= 3, "usage: preregistration validator [path]");
  const result = validateManifestFile(process.argv[2] ?? defaultPath);
  process.stdout.write(`${JSON.stringify({
    schema: result.manifest.schema,
    experimentId: result.manifest.experimentId,
    status: result.manifest.status,
    bytes: result.bytes,
    sha256: result.sha256,
    registrationCommit: result.registrationCommit,
    maximumAttemptCount: result.manifest.attemptPolicy.maximumAttemptCount,
    campaignCounterMayBeIncremented:
      result.manifest.authority.beforeIndependentVerifiedPass
        .campaignCounterMayBeIncremented
  })}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "preregistration validation failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  canonicalPrettyBytes,
  defaultPath,
  expectedBytes,
  expectedSha256,
  experimentId,
  parentSourceRevision,
  relativePath,
  schema,
  validateManifest,
  validateManifestFile
});
