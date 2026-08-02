"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  validateReceiptFile: validateTerminalDiagnostic
} = require("./vector-portable-affine-u8-quality-diagnostic-verification.js");
const {
  validateReceiptFile: validateTerminalSubject
} = require("./vector-portable-affine-u8-verification.js");

const schema =
  "tinyrustlm.portable_affine_u8_flat_successor_preregistration.v1";
const experimentId = "portable-affine-u8-flat-successor-20260726";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-successor-preregistration.v1.json";
const defaultPath = path.join(repositoryRoot, defaultRelativePath);
const expectedManifestSha256 =
  "5b18411b3d222fd8c259de155165fcdf778cf4d7dd8fb04c4712c9cabec5a90d";
const maximumManifestBytes = 1024 * 1024;
const maximumInputBytes = 64 * 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;

const topLevelKeys = Object.freeze([
  "schema",
  "experimentId",
  "registeredAtUtc",
  "status",
  "lineage",
  "successorBoundary",
  "frozenSubject",
  "fullExecution",
  "attemptPolicy",
  "plannedArtifacts",
  "evidencePolicy",
  "authority",
  "requiredNextGate"
]);

const expectedSectionHashes = Object.freeze([
  Object.freeze({
    section: "method",
    canonicalJsonBytes: 1529,
    sha256: "0da889f1c588d89651ea7c8ef29f545ccd4d05c2afbeb7f45de4d6feb518660a"
  }),
  Object.freeze({
    section: "corpusReuse",
    canonicalJsonBytes: 1783,
    sha256: "aaf722c129dd574840cdf124edb8288083a7a15526312d0c50386746480b33d3"
  }),
  Object.freeze({
    section: "groundTruth",
    canonicalJsonBytes: 1053,
    sha256: "6f775c78b4ecfbee353cf3748110e5dcd99e2b6420e82c1cd1a9c7e54e62c20d"
  }),
  Object.freeze({
    section: "byteAccounting",
    canonicalJsonBytes: 1338,
    sha256: "86f0d7d245b3879586f6056f4359e00a5c6ce52cb16c55fb487afa31112f3e37"
  }),
  Object.freeze({
    section: "qualityThresholds",
    canonicalJsonBytes: 1299,
    sha256: "3a4857e12dace0ea33a511f808cc4e3d67a50afb38f03e16d35af97b7c741f90"
  }),
  Object.freeze({
    section: "nativeAndWasm",
    canonicalJsonBytes: 549,
    sha256: "c54f2026674708f23961901577a79888717d45ec47da4b0a40d33007abd5e7e5"
  }),
  Object.freeze({
    section: "performanceThresholds",
    canonicalJsonBytes: 1067,
    sha256: "6c28fee7d372d5d297b2b76b4c1ad1275e11bc6824636222d801fe8be62390ce"
  }),
  Object.freeze({
    section: "persistenceAndFailure",
    canonicalJsonBytes: 2037,
    sha256: "08412ab53f4f504217019685d29226ee5791baf6ef9efacc5a18406657ae7beb"
  })
]);

const expectedCriticalInputs = Object.freeze([
  Object.freeze({
    path: "Cargo.toml",
    bytes: 1134,
    sha256: "406a59037703fe26d0979fda67a818387b3cd6533b915ad47f045156392ceb45"
  }),
  Object.freeze({
    path: "Cargo.lock",
    bytes: 14748,
    sha256: "9b0a3bf305675e1e3ce9ae781e67786bde5635e9659be08a8b8773e3b29b4374"
  }),
  Object.freeze({
    path: "rust/experiments/tinyrustlm-vector-oracle/Cargo.toml",
    bytes: 312,
    sha256: "e962ea7c04a47dd8f72122f1de129e5175d3a40eac2dca511d399fee1f5e52c9"
  }),
  Object.freeze({
    path: "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs",
    bytes: 1542,
    sha256: "b878effc8bcee87916504778355d914d24bcd6beaceef7c93b5896a7cd4aa546"
  }),
  Object.freeze({
    path: "rust/experiments/tinyrustlm-vector-oracle/src/affine_u8_index.rs",
    bytes: 34830,
    sha256: "fc964d1dffa9c3ff95b72646feede6b5bc5903ec84d145b2f28c7f1f78d6876d"
  }),
  Object.freeze({
    path: "rust/experiments/tinyrustlm-vector-oracle/src/flat_index.rs",
    bytes: 40496,
    sha256: "4627ee3c0fae6605a415e3a2b917e5346f01b3ac992e938ce724edf3df1aa17b"
  }),
  Object.freeze({
    path: "tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark.rs",
    bytes: 122925,
    sha256: "96b9d257b2d9a29dcc6c2981cd92ed9a97460a08247796079c66902ba972b8af"
  })
]);

const phaseContract = Object.freeze([
  Object.freeze({ ordinal: 1, phase: "pending-intent", benchmarkProcessCount: 0, required: true }),
  Object.freeze({ ordinal: 2, phase: "source-dataset-tool-validation", benchmarkProcessCount: 0, required: true }),
  Object.freeze({ ordinal: 3, phase: "native-tests-clippy-docs-wasm-build-and-execution", benchmarkProcessCount: 0, required: true }),
  Object.freeze({ ordinal: 4, phase: "contract", benchmarkProcessCount: 1, required: true }),
  Object.freeze({ ordinal: 5, phase: "corruption", benchmarkProcessCount: 7, required: true }),
  Object.freeze({ ordinal: 6, phase: "crash-and-recovery", benchmarkProcessCount: 8, required: true }),
  Object.freeze({ ordinal: 7, phase: "quality", benchmarkProcessCount: 1, required: true }),
  Object.freeze({ ordinal: 8, phase: "paired-performance", benchmarkProcessCount: 60, required: true }),
  Object.freeze({ ordinal: 9, phase: "threshold-decision-and-observation-commit", benchmarkProcessCount: 0, required: true })
]);

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

function exactStructure(actual, expected, label) {
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} is invalid`
  );
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

function publicSafe(value) {
  invariant(
    !forbiddenTextPattern.test(JSON.stringify(value)),
    "successor manifest contains private or secret text"
  );
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
    `repository file ${relativePath} is invalid`
  );
  return Object.freeze({ resolved, stat });
}

function validateLineage(manifest) {
  exactKeys(manifest.lineage, [
    "terminalSubjectExperiment", "terminalDiagnostic", "failureDrivenFixes"
  ], "lineage");
  const subject = manifest.lineage.terminalSubjectExperiment;
  exactKeys(subject, [
    "experimentId", "verificationPath", "verificationFileSha256",
    "verificationReceiptId", "status", "sameExperimentRetryAllowed",
    "observationPresent", "qualityMetricsPresent", "productPromotionAllowed"
  ], "terminalSubjectExperiment");
  invariant(
    subject.experimentId === "portable-affine-u8-flat-20260726" &&
      subject.verificationFileSha256 ===
        "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b" &&
      subject.verificationReceiptId ===
        "portable-affine-u8-flat-verification-b72cb93ab3e2aa85" &&
      subject.status === "verified-terminal-no-observation" &&
      subject.sameExperimentRetryAllowed === false &&
      subject.observationPresent === false &&
      subject.qualityMetricsPresent === false &&
      subject.productPromotionAllowed === false,
    "terminal subject boundary is invalid"
  );
  const diagnostic = manifest.lineage.terminalDiagnostic;
  exactKeys(diagnostic, [
    "diagnosticId", "preregistrationPath", "preregistrationFileSha256",
    "attemptPath", "attemptFileSha256", "attemptId", "attemptContentHash",
    "verificationPath", "verificationFileSha256", "verificationReceiptId",
    "verificationReceiptContentHash", "status",
    "benchmarkProcessInvocationCount", "firstFailingStage",
    "sameDiagnosticRetryAllowed", "qualityClaimSupported",
    "productPromotionAllowed"
  ], "terminalDiagnostic");
  invariant(
    diagnostic.diagnosticId === "portable-affine-u8-quality-diagnostic-20260726" &&
      diagnostic.preregistrationFileSha256 === expectedDiagnosticPreregistrationSha256() &&
      diagnostic.attemptFileSha256 ===
        "bbce35178a052b58776bcabb6c26a42500d826ab38dee12f7bc73af9761dd51d" &&
      diagnostic.attemptContentHash ===
        "a8b32928e1c32829231b67a890a2858086723dae0e81733190170f4de40bdda7" &&
      diagnostic.verificationFileSha256 ===
        "b7e5d98309b8269640ea27567d0836df556ba613bcf850bac836653332a1a4c0" &&
      diagnostic.verificationReceiptId ===
        "portable-affine-u8-quality-diagnostic-verification-ffa5612e53f27c95" &&
      diagnostic.verificationReceiptContentHash ===
        "ffa5612e53f27c9562e29a3d560d94c5f6c9ebf3cc6d2db43f71262c1fe7f7f3" &&
      diagnostic.status === "verified-terminal-diagnostic" &&
      diagnostic.benchmarkProcessInvocationCount === 0 &&
      diagnostic.firstFailingStage === "spawn" &&
      diagnostic.sameDiagnosticRetryAllowed === false &&
      diagnostic.qualityClaimSupported === false &&
      diagnostic.productPromotionAllowed === false,
    "terminal diagnostic boundary is invalid"
  );
  const fixes = manifest.lineage.failureDrivenFixes;
  exactKeys(fixes, [
    "sourceRevision", "symbolicLinkTargetIdentityRegression",
    "durablePendingJournalPath", "durablePendingJournalBytes",
    "durablePendingJournalSha256", "durablePendingJournalTestPath",
    "durablePendingJournalTestBytes", "durablePendingJournalTestSha256",
    "pendingIntentMustExistBeforeToolIdentity",
    "pendingIntentMustExistBeforeDatasetValidation",
    "pendingIntentMustExistBeforeBuild",
    "pendingIntentMustExistBeforeAnyBenchmarkProcess"
  ], "failureDrivenFixes");
  invariant(
    fixes.sourceRevision === "f8bf214839757c105a648437f9f9bdcc6b0a23f5" &&
      fixes.durablePendingJournalBytes === 5968 &&
      fixes.durablePendingJournalSha256 ===
        "5d1afa5f7fdd8f64b65b5195ca822c5618afc24f6b37e1d8bc90375c875df7a3" &&
      fixes.durablePendingJournalTestBytes === 4782 &&
      fixes.durablePendingJournalTestSha256 ===
        "d9187819d21fe34caee0706160cea0d4e6a872d6d4c2a58425bf7b07ba737ed0" &&
      fixes.pendingIntentMustExistBeforeToolIdentity === true &&
      fixes.pendingIntentMustExistBeforeDatasetValidation === true &&
      fixes.pendingIntentMustExistBeforeBuild === true &&
      fixes.pendingIntentMustExistBeforeAnyBenchmarkProcess === true,
    "failure-driven fix boundary is invalid"
  );
}

function expectedDiagnosticPreregistrationSha256() {
  return "3932e21b3ea171d5798e5abf034931069e66f932ef11abdaa68c8d9326ae5fe1";
}

function validateSuccessorBoundary(manifest) {
  exactKeys(manifest.successorBoundary, [
    "parentSourceRevision", "benchmarkSubjectExperimentId",
    "benchmarkSubjectMethodId", "successorEvidenceExperimentId",
    "sameBenchmarkSubjectBytesRequired", "sameRetrievalImplementationBytesRequired",
    "sameCorpusAndSelectionRequired", "sameThresholdsRequired",
    "sameProcessContractRequired", "newAttemptAppendedToTerminalExperiment",
    "terminalEvidenceMutationAllowed", "resultDrivenAlgorithmMutationAllowed",
    "resultDrivenCorpusMutationAllowed", "resultDrivenThresholdMutationAllowed",
    "successorHasIndependentPreregistrationAndEvidencePaths"
  ], "successorBoundary");
  const boundary = manifest.successorBoundary;
  invariant(
    boundary.parentSourceRevision === "f8bf214839757c105a648437f9f9bdcc6b0a23f5" &&
      boundary.benchmarkSubjectExperimentId === "portable-affine-u8-flat-20260726" &&
      boundary.benchmarkSubjectMethodId === "portable-global-affine-u8-flat-v1" &&
      boundary.successorEvidenceExperimentId === experimentId &&
      boundary.sameBenchmarkSubjectBytesRequired === true &&
      boundary.sameRetrievalImplementationBytesRequired === true &&
      boundary.sameCorpusAndSelectionRequired === true &&
      boundary.sameThresholdsRequired === true &&
      boundary.sameProcessContractRequired === true &&
      boundary.newAttemptAppendedToTerminalExperiment === false &&
      boundary.terminalEvidenceMutationAllowed === false &&
      boundary.resultDrivenAlgorithmMutationAllowed === false &&
      boundary.resultDrivenCorpusMutationAllowed === false &&
      boundary.resultDrivenThresholdMutationAllowed === false &&
      boundary.successorHasIndependentPreregistrationAndEvidencePaths === true,
    "successor boundary is invalid"
  );
}

function validateFrozenSubject(manifest) {
  const subject = manifest.frozenSubject;
  exactKeys(subject, [
    "subjectPreregistrationPath", "subjectPreregistrationFileSha256",
    "sectionHashes", "criticalInputs", "externalDataset"
  ], "frozenSubject");
  invariant(
    subject.subjectPreregistrationFileSha256 ===
      "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d",
    "subject preregistration identity is invalid"
  );
  exactStructure(subject.sectionHashes, expectedSectionHashes, "subject section hashes");
  exactStructure(subject.criticalInputs, expectedCriticalInputs, "subject critical inputs");
  exactKeys(subject.externalDataset, [
    "sourceRepository", "revision", "tree", "selectionSha256",
    "networkAcquisitionAllowed", "checkoutMustBeClean", "locatorMayEnterEvidence",
    "payloadBytesMayEnterEvidence", "selectedIndicesMayEnterEvidence",
    "rawVectorsMayEnterEvidence"
  ], "externalDataset");
  invariant(
    subject.externalDataset.sourceRepository ===
      "https://github.com/zalandoresearch/fashion-mnist.git" &&
      subject.externalDataset.revision ===
        "b2617bb6d3ffa2e429640350f613e3291e10b141" &&
      subject.externalDataset.tree ===
        "ec8d5e52c0b9b2b09ea3f9d36b7bfafaf8ec0e97" &&
      subject.externalDataset.selectionSha256 ===
        "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd" &&
      subject.externalDataset.networkAcquisitionAllowed === false &&
      subject.externalDataset.checkoutMustBeClean === true &&
      subject.externalDataset.locatorMayEnterEvidence === false &&
      subject.externalDataset.payloadBytesMayEnterEvidence === false &&
      subject.externalDataset.selectedIndicesMayEnterEvidence === false &&
      subject.externalDataset.rawVectorsMayEnterEvidence === false,
    "external dataset boundary is invalid"
  );
}

function validateExecution(manifest) {
  const execution = manifest.fullExecution;
  exactKeys(execution, [
    "platform", "networkPolicy", "parallelBenchmarkProcesses",
    "overallTimeoutMilliseconds", "perProcessTimeoutMilliseconds",
    "pendingIntentWrittenBeforeSetup", "failFast", "phaseOrder",
    "maximumBenchmarkProcessCountOnCompleteRun",
    "maximumMemoryMonitorProcessCountOnCompleteRun", "qualityProcessCount",
    "qualityFailureIsTerminal", "performanceOutcomeFailureIsTerminal",
    "corruptionOrRecoverySemanticFailureIsTerminal",
    "laterPhasesSkippedAfterTerminalFailure",
    "rawProcessOutputMustBeRetainedInMemoryUntilValidated",
    "rawProcessOutputMayEnterReceipt",
    "validQualityMetricsMustBeRetainedEvenOnThresholdFailure",
    "bestOfNAllowed", "outputRepairAllowed"
  ], "fullExecution");
  exactStructure(execution.phaseOrder, phaseContract, "successor phase order");
  invariant(
    execution.platform === "win32-x64-local-reference-only" &&
      execution.networkPolicy === "deny-all" &&
      execution.parallelBenchmarkProcesses === 1 &&
      execution.overallTimeoutMilliseconds === 3600000 &&
      execution.perProcessTimeoutMilliseconds === 300000 &&
      execution.pendingIntentWrittenBeforeSetup === true &&
      execution.failFast === true &&
      execution.maximumBenchmarkProcessCountOnCompleteRun === 77 &&
      execution.maximumMemoryMonitorProcessCountOnCompleteRun === 60 &&
      execution.qualityProcessCount === 1 &&
      execution.qualityFailureIsTerminal === true &&
      execution.performanceOutcomeFailureIsTerminal === true &&
      execution.corruptionOrRecoverySemanticFailureIsTerminal === true &&
      execution.laterPhasesSkippedAfterTerminalFailure === true &&
      execution.rawProcessOutputMustBeRetainedInMemoryUntilValidated === true &&
      execution.rawProcessOutputMayEnterReceipt === false &&
      execution.validQualityMetricsMustBeRetainedEvenOnThresholdFailure === true &&
      execution.bestOfNAllowed === false &&
      execution.outputRepairAllowed === false,
    "full execution boundary is invalid"
  );
}

function validateAttemptPolicy(manifest) {
  const policy = manifest.attemptPolicy;
  exactKeys(policy, [
    "maximumAttemptCount", "maximumInstrumentationRetryCount",
    "instrumentationRetryRequiresNoCommittedOutcomeObservation",
    "samePendingIdempotencyIdentityRequiredForLostResponseRecovery",
    "qualityProcessFailureMayBeRetried", "qualityThresholdFailureMayBeRetried",
    "performanceOutcomeFailureMayBeRetried",
    "corruptionOrRecoverySemanticFailureMayBeRetried",
    "failedAttemptsPreserved", "attemptsContentAddressed",
    "attemptsMayBeOverwritten",
    "pendingJournalMayBeRemovedOnlyAfterAttemptCommitAndReopen"
  ], "attemptPolicy");
  invariant(
    policy.maximumAttemptCount === 2 &&
      policy.maximumInstrumentationRetryCount === 1 &&
      policy.instrumentationRetryRequiresNoCommittedOutcomeObservation === true &&
      policy.samePendingIdempotencyIdentityRequiredForLostResponseRecovery === true &&
      policy.qualityProcessFailureMayBeRetried === false &&
      policy.qualityThresholdFailureMayBeRetried === false &&
      policy.performanceOutcomeFailureMayBeRetried === false &&
      policy.corruptionOrRecoverySemanticFailureMayBeRetried === false &&
      policy.failedAttemptsPreserved === true &&
      policy.attemptsContentAddressed === true &&
      policy.attemptsMayBeOverwritten === false &&
      policy.pendingJournalMayBeRemovedOnlyAfterAttemptCommitAndReopen === true,
    "attempt policy is invalid"
  );
}

function validatePlannedArtifacts(manifest) {
  const planned = manifest.plannedArtifacts;
  exactKeys(planned, [
    "runnerPath", "runnerExistsAtRegistration", "runnerTestPath",
    "runnerTestExistsAtRegistration", "pendingPath",
    "pendingExistsAtRegistration", "attemptDirectory",
    "attemptExistsAtRegistration", "observationPath",
    "observationExistsAtRegistration", "verifierPath",
    "verifierExistsAtRegistration", "verificationPath",
    "verificationExistsAtRegistration"
  ], "plannedArtifacts");
  for (const [key, value] of Object.entries(planned)) {
    if (key.endsWith("Path") || key === "attemptDirectory") {
      invariant(relativePathPattern.test(value), `${key} is unsafe`);
    } else {
      invariant(value === false, `${key} must be false`);
    }
  }
}

function validateEvidenceAndAuthority(manifest) {
  exactKeys(manifest.evidencePolicy, [
    "sourceRevisionRequired", "toolVersionsAndBinaryHashesRequired",
    "datasetRevisionAndTreeRequired", "allInputFileHashesRequired",
    "benchmarkExecutableHashRequired", "wasmArtifactHashRequired",
    "processExitSignalByteCountsAndHashesRequired",
    "safeLowercaseBenchmarkErrorCodeMayBeRetained", "rawStdoutAllowed",
    "rawStderrAllowed", "privateAbsolutePathsAllowed", "credentialsAllowed",
    "datasetLocatorAllowed", "rawDatasetPayloadAllowed", "selectedIndicesAllowed",
    "independentVerificationRequired", "resultDrivenReclassificationAllowed"
  ], "evidencePolicy");
  const policy = manifest.evidencePolicy;
  invariant(
    policy.sourceRevisionRequired === true &&
      policy.toolVersionsAndBinaryHashesRequired === true &&
      policy.datasetRevisionAndTreeRequired === true &&
      policy.allInputFileHashesRequired === true &&
      policy.benchmarkExecutableHashRequired === true &&
      policy.wasmArtifactHashRequired === true &&
      policy.processExitSignalByteCountsAndHashesRequired === true &&
      policy.safeLowercaseBenchmarkErrorCodeMayBeRetained === true &&
      policy.rawStdoutAllowed === false &&
      policy.rawStderrAllowed === false &&
      policy.privateAbsolutePathsAllowed === false &&
      policy.credentialsAllowed === false &&
      policy.datasetLocatorAllowed === false &&
      policy.rawDatasetPayloadAllowed === false &&
      policy.selectedIndicesAllowed === false &&
      policy.independentVerificationRequired === true &&
      policy.resultDrivenReclassificationAllowed === false,
    "evidence policy is invalid"
  );
  exactKeys(manifest.authority, [
    "beforeVerifiedPass", "potentialAfterCompleteIndependentVerifiedPass"
  ], "authority");
  const before = manifest.authority.beforeVerifiedPass;
  const potential = manifest.authority.potentialAfterCompleteIndependentVerifiedPass;
  invariant(
    Object.values(before).every((value) => value === false),
    "pre-verification authority must be entirely false"
  );
  exactStructure(Object.keys(before), Object.keys(potential), "authority claim keys");
  const allowedAfterPass = new Set([
    "portableAffineU8NumericalBehaviorMayBeClaimed",
    "sameCorpusCompressedRankQualityMayBeClaimed",
    "equalDynamicIndexByteCapacityUtilityMayBeClaimed",
    "completeDynamicIndexByteReductionMayBeClaimed",
    "nativeReferencePerformanceMayBeClaimed",
    "nativeAndWasmDecisionParityMayBeClaimed",
    "wrapperProcessCrashRecoveryMayBeClaimed"
  ]);
  for (const [key, value] of Object.entries(potential)) {
    invariant(value === allowedAfterPass.has(key), `potential authority ${key} is invalid`);
  }
}

function validateManifest(manifest) {
  exactKeys(manifest, topLevelKeys, "manifest");
  invariant(manifest.schema === schema, "manifest schema is invalid");
  invariant(manifest.experimentId === experimentId, "experimentId is invalid");
  invariant(
    utcPattern.test(manifest.registeredAtUtc) &&
      Number.isFinite(Date.parse(manifest.registeredAtUtc)),
    "registeredAtUtc is invalid"
  );
  invariant(
    manifest.status === "preregistered-before-successor-implementation-or-results",
    "manifest status is invalid"
  );
  publicSafe(manifest);
  validateLineage(manifest);
  validateSuccessorBoundary(manifest);
  validateFrozenSubject(manifest);
  validateExecution(manifest);
  validateAttemptPolicy(manifest);
  validatePlannedArtifacts(manifest);
  validateEvidenceAndAuthority(manifest);
  invariant(
    typeof manifest.requiredNextGate === "string" &&
      manifest.requiredNextGate.includes("pending intent before setup") &&
      manifest.requiredNextGate.includes("complete frozen suite") &&
      manifest.requiredNextGate.includes("independent verification"),
    "required next gate is invalid"
  );
  invariant(
    sha256(canonicalPrettyBytes(manifest)) === expectedManifestSha256,
    "manifest frozen contract is invalid"
  );
  return manifest;
}

function validateFileIdentity(relativePath, bytes, expectedSha256, label) {
  const file = resolveRepositoryFile(relativePath);
  invariant(file.stat.size === bytes, `${label} size drifted`);
  invariant(sha256File(file.resolved) === expectedSha256, `${label} bytes drifted`);
}

function validateLineageFiles(manifest) {
  validateFileIdentity(
    manifest.lineage.terminalSubjectExperiment.verificationPath,
    13522,
    manifest.lineage.terminalSubjectExperiment.verificationFileSha256,
    "terminal subject verification"
  );
  const diagnostic = manifest.lineage.terminalDiagnostic;
  validateFileIdentity(
    diagnostic.preregistrationPath,
    10935,
    diagnostic.preregistrationFileSha256,
    "diagnostic preregistration"
  );
  validateFileIdentity(
    diagnostic.attemptPath,
    11986,
    diagnostic.attemptFileSha256,
    "diagnostic attempt"
  );
  validateFileIdentity(
    diagnostic.verificationPath,
    6009,
    diagnostic.verificationFileSha256,
    "diagnostic verification"
  );
  const fixes = manifest.lineage.failureDrivenFixes;
  validateFileIdentity(
    fixes.durablePendingJournalPath,
    fixes.durablePendingJournalBytes,
    fixes.durablePendingJournalSha256,
    "pending journal"
  );
  validateFileIdentity(
    fixes.durablePendingJournalTestPath,
    fixes.durablePendingJournalTestBytes,
    fixes.durablePendingJournalTestSha256,
    "pending journal test"
  );
}

function validateSubjectSections(manifest) {
  const file = resolveRepositoryFile(
    manifest.frozenSubject.subjectPreregistrationPath
  );
  invariant(
    sha256File(file.resolved) ===
      manifest.frozenSubject.subjectPreregistrationFileSha256,
    "subject preregistration drifted"
  );
  const subject = JSON.parse(fs.readFileSync(file.resolved, "utf8"));
  for (const expected of manifest.frozenSubject.sectionHashes) {
    const bytes = Buffer.from(JSON.stringify(subject[expected.section]), "utf8");
    invariant(bytes.length === expected.canonicalJsonBytes,
      `subject ${expected.section} bytes drifted`);
    invariant(sha256(bytes) === expected.sha256,
      `subject ${expected.section} hash drifted`);
  }
  for (const input of manifest.frozenSubject.criticalInputs) {
    validateFileIdentity(input.path, input.bytes, input.sha256, input.path);
  }
}

function git(argumentsList, allowFailure = false) {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024
  });
  invariant(result.error === undefined, "git invocation failed");
  if (!allowFailure) {
    invariant(
      result.status === 0 && result.signal === null && result.stderr === "",
      "git command failed"
    );
  }
  return result;
}

function registrationCommit() {
  const result = git([
    "log", "--diff-filter=A", "--format=%H", "--", defaultRelativePath
  ]);
  const revisions = result.stdout.trim().split(/\r?\n/u).filter(Boolean);
  if (revisions.length === 0) return null;
  invariant(revisions.length === 1, "manifest has multiple addition commits");
  invariant(revisionPattern.test(revisions[0]), "registration commit is invalid");
  return revisions[0];
}

function pathExistsAtRevision(revision, relativePath) {
  const result = git(["cat-file", "-e", `${revision}:${relativePath}`], true);
  invariant([0, 128].includes(result.status), "git path existence check failed");
  return result.status === 0;
}

function validateRegistrationOrdering(manifest) {
  const current = git(["rev-parse", "HEAD"]).stdout.trim();
  invariant(revisionPattern.test(current), "current revision is invalid");
  const ancestor = git([
    "merge-base", "--is-ancestor",
    manifest.successorBoundary.parentSourceRevision,
    current
  ], true);
  invariant(ancestor.status === 0, "successor parent is not an ancestor");
  const commit = registrationCommit();
  if (commit === null) return null;
  const parent = git(["rev-parse", `${commit}^`]).stdout.trim();
  invariant(
    parent === manifest.successorBoundary.parentSourceRevision,
    "successor registration parent is invalid"
  );
  for (const [key, relativePath] of Object.entries(manifest.plannedArtifacts)) {
    if (!(key.endsWith("Path") || key === "attemptDirectory")) continue;
    invariant(
      !pathExistsAtRevision(commit, relativePath),
      `successor material existed at registration: ${relativePath}`
    );
  }
  return commit;
}

function validateManifestFile(filePath = defaultPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumManifestBytes,
    "successor manifest file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(manifest)),
    "successor manifest bytes are not canonical"
  );
  invariant(sha256(bytes) === expectedManifestSha256, "manifest file hash is invalid");
  validateLineageFiles(manifest);
  validateSubjectSections(manifest);
  const terminalSubject = validateTerminalSubject();
  invariant(
    terminalSubject.sha256 ===
      manifest.lineage.terminalSubjectExperiment.verificationFileSha256 &&
      terminalSubject.receipt.status === "verified-terminal-no-observation" &&
      terminalSubject.receipt.observation === null &&
      terminalSubject.receipt.independentSummary.sameExperimentRetryAllowed === false &&
      terminalSubject.receipt.independentSummary.productPromotionAllowed === false,
    "terminal subject verification changed"
  );
  const terminalDiagnostic = validateTerminalDiagnostic();
  invariant(
    terminalDiagnostic.sha256 ===
      manifest.lineage.terminalDiagnostic.verificationFileSha256 &&
      terminalDiagnostic.receipt.receiptId ===
        manifest.lineage.terminalDiagnostic.verificationReceiptId &&
      terminalDiagnostic.receipt.receiptContentHash ===
        manifest.lineage.terminalDiagnostic.verificationReceiptContentHash &&
      terminalDiagnostic.receipt.independentSummary.diagnosticProcessInvocationCount === 0 &&
      terminalDiagnostic.receipt.independentSummary.firstFailingStage === "spawn" &&
      terminalDiagnostic.receipt.independentSummary.qualityClaimSupported === false &&
      terminalDiagnostic.receipt.independentSummary.sameExperimentRetryAllowed === false &&
      terminalDiagnostic.receipt.independentSummary.productPromotionAllowed === false,
    "terminal diagnostic verification changed"
  );
  const commit = validateRegistrationOrdering(manifest);
  return Object.freeze({
    manifest,
    bytes: bytes.length,
    sha256: expectedManifestSha256,
    registrationCommit: commit
  });
}

if (require.main === module) {
  const result = validateManifestFile(process.argv[2] ?? defaultPath);
  process.stdout.write(`${JSON.stringify({
    schema: result.manifest.schema,
    experimentId: result.manifest.experimentId,
    status: result.manifest.status,
    bytes: result.bytes,
    sha256: result.sha256,
    registrationCommit: result.registrationCommit
  })}\n`);
}

module.exports = Object.freeze({
  defaultPath,
  expectedManifestSha256,
  expectedSectionHashes,
  experimentId,
  phaseContract,
  registrationCommit,
  schema,
  validateManifest,
  validateManifestFile
});
