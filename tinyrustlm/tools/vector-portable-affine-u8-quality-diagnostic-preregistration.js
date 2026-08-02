"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  validateReceiptFile: validateTerminalVerification
} = require("./vector-portable-affine-u8-verification.js");

const schema =
  "tinyrustlm.portable_affine_u8_quality_diagnostic_preregistration.v1";
const diagnosticId = "portable-affine-u8-quality-diagnostic-20260726";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-quality-diagnostic-preregistration.v1.json";
const defaultPath = path.join(repositoryRoot, defaultRelativePath);
const expectedManifestSha256 =
  "3932e21b3ea171d5798e5abf034931069e66f932ef11abdaa68c8d9326ae5fe1";
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
  "diagnosticId",
  "registeredAtUtc",
  "status",
  "purpose",
  "terminalLineage",
  "registrationBoundary",
  "frozenInputClosure",
  "externalDataset",
  "diagnosticExecution",
  "orderedDiagnosticStages",
  "resultContract",
  "authority",
  "requiredNextGate"
]);

const expectedStageNames = Object.freeze([
  "spawn",
  "timeout-or-output-bound",
  "exit-and-signal",
  "stderr-contract",
  "stdout-framing",
  "json-parse",
  "canonical-compact-json",
  "top-level-contract",
  "per-query-or-aggregate-semantics",
  "unexpectedly-valid"
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
  }),
  Object.freeze({
    path: "tinyrustlm/tools/vector-portable-affine-u8-observation.js",
    bytes: 157232,
    sha256: "3b3a65db1a500f143b9e27092329f0f7e56c56c0427d53ff4d01db7e0fbd177b"
  })
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

function canonicalManifestBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function publicSafe(value) {
  invariant(
    !forbiddenTextPattern.test(JSON.stringify(value)),
    "manifest contains private or secret text"
  );
}

function resolveRepositoryFile(relativePath, maximumBytes = maximumInputBytes) {
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
      stat.size <= maximumBytes,
    `repository file ${relativePath} is invalid`
  );
  return Object.freeze({ resolved, stat });
}

function validatePurpose(manifest) {
  exactKeys(manifest.purpose, [
    "question",
    "originalExperimentRemainsTerminal",
    "sameExperimentRetryAllowed",
    "diagnosticIsAnExperimentRetry",
    "diagnosticIsAQualityEvaluation",
    "diagnosticIsAProductBenchmark",
    "thresholdEvaluationAllowed",
    "resultDrivenRepairAllowed"
  ], "purpose");
  invariant(
    manifest.purpose.question.includes("first bounded validation stage") &&
      manifest.purpose.originalExperimentRemainsTerminal === true &&
      manifest.purpose.sameExperimentRetryAllowed === false &&
      manifest.purpose.diagnosticIsAnExperimentRetry === false &&
      manifest.purpose.diagnosticIsAQualityEvaluation === false &&
      manifest.purpose.diagnosticIsAProductBenchmark === false &&
      manifest.purpose.thresholdEvaluationAllowed === false &&
      manifest.purpose.resultDrivenRepairAllowed === false,
    "purpose boundary is invalid"
  );
}

function validateTerminalLineage(manifest) {
  const lineage = manifest.terminalLineage;
  exactKeys(lineage, [
    "experimentId", "preregistration", "attempts", "terminalVerification"
  ], "terminalLineage");
  invariant(
    lineage.experimentId === "portable-affine-u8-flat-20260726",
    "terminal experiment identity is invalid"
  );
  exactKeys(lineage.preregistration, ["path", "fileSha256"], "terminal preregistration");
  invariant(
    lineage.preregistration.fileSha256 ===
      "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d",
    "terminal preregistration identity is invalid"
  );
  invariant(Array.isArray(lineage.attempts) && lineage.attempts.length === 2,
    "terminal attempt lineage is invalid");
  lineage.attempts.forEach((attempt, index) => {
    exactKeys(attempt, [
      "path", "attemptId", "attemptContentHash", "fileSha256",
      "failureCode", "retryAllowed"
    ], `terminal attempt ${index}`);
    invariant(
      sha256Pattern.test(attempt.attemptContentHash) &&
        sha256Pattern.test(attempt.fileSha256),
      `terminal attempt ${index} identity is invalid`
    );
  });
  invariant(
    lineage.attempts[0].failureCode ===
      "PORTABLE_AFFINE_U8_ATTEMPT_COMMIT_REJECTED" &&
      lineage.attempts[0].retryAllowed === true &&
      lineage.attempts[1].failureCode ===
        "PORTABLE_AFFINE_U8_QUALITY_OUTCOME_REJECTED" &&
      lineage.attempts[1].retryAllowed === false,
    "terminal attempt retry chain is invalid"
  );
  exactKeys(lineage.terminalVerification, [
    "path", "receiptId", "receiptContentHash", "fileSha256", "status",
    "observationPresent", "qualityMetricsPresent", "sameExperimentRetryAllowed",
    "productPromotionAllowed"
  ], "terminal verification");
  invariant(
    lineage.terminalVerification.receiptId ===
      "portable-affine-u8-flat-verification-b72cb93ab3e2aa85" &&
      lineage.terminalVerification.receiptContentHash ===
        "b72cb93ab3e2aa85d8b1ae0d4e84744b4f8a0c92d987b9dceeba8cf1d6cff765" &&
      lineage.terminalVerification.fileSha256 ===
        "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b" &&
      lineage.terminalVerification.status === "verified-terminal-no-observation" &&
      lineage.terminalVerification.observationPresent === false &&
      lineage.terminalVerification.qualityMetricsPresent === false &&
      lineage.terminalVerification.sameExperimentRetryAllowed === false &&
      lineage.terminalVerification.productPromotionAllowed === false,
    "terminal verification boundary is invalid"
  );
}

function validateRegistrationBoundary(manifest) {
  const boundary = manifest.registrationBoundary;
  exactKeys(boundary, [
    "parentSourceRevision", "diagnosticRunnerPath",
    "diagnosticRunnerExistsAtRegistration", "diagnosticAttemptDirectory",
    "diagnosticAttemptExistsAtRegistration", "diagnosticVerifierPath",
    "diagnosticVerifierExistsAtRegistration", "diagnosticVerificationPath",
    "diagnosticVerificationExistsAtRegistration",
    "originalPreregistrationMutationAllowed", "originalAttemptMutationAllowed",
    "originalVerificationMutationAllowed", "benchmarkMutationBeforeDiagnosticAllowed",
    "retrievalImplementationMutationBeforeDiagnosticAllowed"
  ], "registrationBoundary");
  invariant(
    boundary.parentSourceRevision ===
      "9e16e8dc84d4abdbc1d45760fa512e3acb3a678b" &&
      revisionPattern.test(boundary.parentSourceRevision),
    "registration parent is invalid"
  );
  for (const key of [
    "diagnosticRunnerPath", "diagnosticAttemptDirectory",
    "diagnosticVerifierPath", "diagnosticVerificationPath"
  ]) {
    invariant(relativePathPattern.test(boundary[key]), `${key} is unsafe`);
  }
  for (const key of [
    "diagnosticRunnerExistsAtRegistration",
    "diagnosticAttemptExistsAtRegistration",
    "diagnosticVerifierExistsAtRegistration",
    "diagnosticVerificationExistsAtRegistration",
    "originalPreregistrationMutationAllowed",
    "originalAttemptMutationAllowed",
    "originalVerificationMutationAllowed",
    "benchmarkMutationBeforeDiagnosticAllowed",
    "retrievalImplementationMutationBeforeDiagnosticAllowed"
  ]) {
    invariant(boundary[key] === false, `${key} must be false`);
  }
}

function validateFrozenInputs(manifest) {
  exactKeys(manifest.frozenInputClosure, [
    "terminalVerificationInputCount",
    "terminalVerificationMustValidate",
    "allTerminalVerificationInputsMustRemainByteIdentical",
    "criticalInputs"
  ], "frozenInputClosure");
  invariant(
    manifest.frozenInputClosure.terminalVerificationInputCount === 37 &&
      manifest.frozenInputClosure.terminalVerificationMustValidate === true &&
      manifest.frozenInputClosure.allTerminalVerificationInputsMustRemainByteIdentical === true,
    "frozen input closure is invalid"
  );
  exactStructure(
    manifest.frozenInputClosure.criticalInputs,
    expectedCriticalInputs,
    "critical input closure"
  );
}

function validateDataset(manifest) {
  exactKeys(manifest.externalDataset, [
    "sourceRepository", "revision", "tree", "selectionSha256",
    "checkoutMustBeClean", "networkAcquisitionAllowed",
    "locatorEnvironmentVariable", "locatorMayEnterEvidence",
    "compressedOrDecompressedBytesMayEnterEvidence",
    "selectedIndicesMayEnterEvidence", "rawVectorsMayEnterEvidence"
  ], "externalDataset");
  invariant(
    manifest.externalDataset.sourceRepository ===
      "https://github.com/zalandoresearch/fashion-mnist.git" &&
      manifest.externalDataset.revision ===
        "b2617bb6d3ffa2e429640350f613e3291e10b141" &&
      manifest.externalDataset.tree ===
        "ec8d5e52c0b9b2b09ea3f9d36b7bfafaf8ec0e97" &&
      manifest.externalDataset.selectionSha256 ===
        "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd" &&
      manifest.externalDataset.checkoutMustBeClean === true &&
      manifest.externalDataset.networkAcquisitionAllowed === false &&
      manifest.externalDataset.locatorEnvironmentVariable ===
        "TINYRUSTLM_FASHION_MNIST_ROOT" &&
      manifest.externalDataset.locatorMayEnterEvidence === false &&
      manifest.externalDataset.compressedOrDecompressedBytesMayEnterEvidence === false &&
      manifest.externalDataset.selectedIndicesMayEnterEvidence === false &&
      manifest.externalDataset.rawVectorsMayEnterEvidence === false,
    "external dataset boundary is invalid"
  );
}

function validateExecution(manifest) {
  const execution = manifest.diagnosticExecution;
  exactKeys(execution, [
    "benchmarkMode", "maximumDiagnosticProcessCount",
    "maximumDiagnosticAttemptCount", "retryAllowed", "bestOfNAllowed",
    "networkPolicy", "perProcessTimeoutMilliseconds", "maximumStdoutBytes",
    "maximumStderrBytes", "expectedPlatform", "compileProfile",
    "thresholdEvaluationAllowed", "performanceProcessAllowed",
    "corruptionProcessAllowed", "crashRecoveryProcessAllowed",
    "observationWriteAllowed", "originalAttemptWriteAllowed"
  ], "diagnosticExecution");
  exactKeys(execution.compileProfile, [
    "cargoLocked", "cargoOffline", "cargoRelease", "rustcEdition",
    "warningsDenied", "optLevel", "codegenUnits", "panicStrategy", "lto",
    "embedBitcode"
  ], "compileProfile");
  invariant(
    execution.benchmarkMode === "--quality" &&
      execution.maximumDiagnosticProcessCount === 1 &&
      execution.maximumDiagnosticAttemptCount === 1 &&
      execution.retryAllowed === false &&
      execution.bestOfNAllowed === false &&
      execution.networkPolicy === "deny-all" &&
      execution.perProcessTimeoutMilliseconds === 300000 &&
      execution.maximumStdoutBytes === 67108864 &&
      execution.maximumStderrBytes === 67108864 &&
      execution.expectedPlatform === "win32-x64" &&
      execution.thresholdEvaluationAllowed === false &&
      execution.performanceProcessAllowed === false &&
      execution.corruptionProcessAllowed === false &&
      execution.crashRecoveryProcessAllowed === false &&
      execution.observationWriteAllowed === false &&
      execution.originalAttemptWriteAllowed === false,
    "diagnostic execution boundary is invalid"
  );
  exactStructure(execution.compileProfile, {
    cargoLocked: true,
    cargoOffline: true,
    cargoRelease: true,
    rustcEdition: "2021",
    warningsDenied: true,
    optLevel: 3,
    codegenUnits: 1,
    panicStrategy: "abort",
    lto: "fat",
    embedBitcode: true
  }, "compile profile");
}

function validateStages(manifest) {
  invariant(
    Array.isArray(manifest.orderedDiagnosticStages) &&
      manifest.orderedDiagnosticStages.length === expectedStageNames.length,
    "diagnostic stage count is invalid"
  );
  manifest.orderedDiagnosticStages.forEach((stage, index) => {
    exactKeys(stage, ["ordinal", "stage", "predicate"], `diagnostic stage ${index}`);
    invariant(
      stage.ordinal === index + 1 &&
        stage.stage === expectedStageNames[index] &&
        typeof stage.predicate === "string" &&
        stage.predicate.length >= 32 &&
        stage.predicate.length <= 256,
      `diagnostic stage ${index} is invalid`
    );
  });
}

function validateResultContract(manifest) {
  const result = manifest.resultContract;
  exactKeys(result, [
    "allowedStatuses", "firstFailingStageRequired",
    "lowercaseBenchmarkErrorCodeMayBeRetained", "benchmarkErrorCodePattern",
    "stdoutBytesRequired", "stdoutSha256Required", "stderrBytesRequired",
    "stderrSha256Required", "exitCodeRequiredWhenProcessStarts",
    "signalRequiredWhenProcessStarts", "rawStdoutAllowed", "rawStderrAllowed",
    "parsedQualityMetricsAllowed", "perQueryRecordsAllowed",
    "selectedIndicesAllowed", "privatePathsAllowed", "credentialsAllowed",
    "toolVersionsAndBinaryHashesRequired", "sourceRevisionRequired",
    "ownedTemporaryRootDeletionRequired", "attemptMustBeContentAddressed",
    "attemptMayBeOverwritten", "independentVerificationRequired"
  ], "resultContract");
  exactStructure(result.allowedStatuses, [
    "diagnosed-process-rejection",
    "diagnosed-validator-rejection",
    "unexpectedly-valid",
    "diagnostic-infrastructure-failure"
  ], "diagnostic result statuses");
  invariant(
    result.firstFailingStageRequired === true &&
      result.lowercaseBenchmarkErrorCodeMayBeRetained === true &&
      result.benchmarkErrorCodePattern === "^[a-z0-9-]{1,96}$" &&
      result.stdoutBytesRequired === true &&
      result.stdoutSha256Required === true &&
      result.stderrBytesRequired === true &&
      result.stderrSha256Required === true &&
      result.exitCodeRequiredWhenProcessStarts === true &&
      result.signalRequiredWhenProcessStarts === true &&
      result.rawStdoutAllowed === false &&
      result.rawStderrAllowed === false &&
      result.parsedQualityMetricsAllowed === false &&
      result.perQueryRecordsAllowed === false &&
      result.selectedIndicesAllowed === false &&
      result.privatePathsAllowed === false &&
      result.credentialsAllowed === false &&
      result.toolVersionsAndBinaryHashesRequired === true &&
      result.sourceRevisionRequired === true &&
      result.ownedTemporaryRootDeletionRequired === true &&
      result.attemptMustBeContentAddressed === true &&
      result.attemptMayBeOverwritten === false &&
      result.independentVerificationRequired === true,
    "diagnostic result contract is invalid"
  );
}

function validateAuthority(manifest) {
  exactKeys(manifest.authority, [
    "originalExperimentMayBeReopened", "sameExperimentRetryMayBeAuthorized",
    "qualityMayBeClaimed", "performanceMayBeClaimed",
    "portableAffineU8NumericalBehaviorMayBeClaimed",
    "representativeSemanticMemoryQualityMayBeClaimed", "turboVecParityMayBeClaimed",
    "turboQuantPaperConformanceMayBeClaimed", "productIntegrationMayBeClaimed",
    "trainingMayBeAuthorized", "releaseMayBeAuthorized",
    "campaignCounterMayBeIncremented"
  ], "authority");
  invariant(
    Object.values(manifest.authority).every((value) => value === false),
    "diagnostic authority must be entirely false"
  );
}

function validateManifest(manifest) {
  exactKeys(manifest, topLevelKeys, "manifest");
  invariant(manifest.schema === schema, "manifest schema is invalid");
  invariant(manifest.diagnosticId === diagnosticId, "diagnosticId is invalid");
  invariant(
    utcPattern.test(manifest.registeredAtUtc) &&
      Number.isFinite(Date.parse(manifest.registeredAtUtc)),
    "registeredAtUtc is invalid"
  );
  invariant(
    manifest.status === "preregistered-before-diagnostic-implementation-or-result",
    "manifest status is invalid"
  );
  publicSafe(manifest);
  validatePurpose(manifest);
  validateTerminalLineage(manifest);
  validateRegistrationBoundary(manifest);
  validateFrozenInputs(manifest);
  validateDataset(manifest);
  validateExecution(manifest);
  validateStages(manifest);
  validateResultContract(manifest);
  validateAuthority(manifest);
  invariant(
    typeof manifest.requiredNextGate === "string" &&
      manifest.requiredNextGate.includes("generic regression") &&
      manifest.requiredNextGate.includes("distinct successor full experiment"),
    "required next gate is invalid"
  );
  invariant(
    sha256(canonicalManifestBytes(manifest)) === expectedManifestSha256,
    "manifest frozen contract is invalid"
  );
  return manifest;
}

function validateReferencedFile(entry, label) {
  const file = resolveRepositoryFile(entry.path);
  invariant(sha256Pattern.test(entry.fileSha256), `${label} hash is invalid`);
  invariant(sha256File(file.resolved) === entry.fileSha256, `${label} bytes drifted`);
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
    invariant(result.status === 0 && result.signal === null, "git command failed");
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
    manifest.registrationBoundary.parentSourceRevision,
    current
  ], true);
  invariant(ancestor.status === 0, "registration parent is not an ancestor");
  const commit = registrationCommit();
  if (commit === null) return null;
  const parent = git(["rev-parse", `${commit}^`]).stdout.trim();
  invariant(
    parent === manifest.registrationBoundary.parentSourceRevision,
    "registration commit parent is invalid"
  );
  for (const relativePath of [
    manifest.registrationBoundary.diagnosticRunnerPath,
    manifest.registrationBoundary.diagnosticAttemptDirectory,
    manifest.registrationBoundary.diagnosticVerifierPath,
    manifest.registrationBoundary.diagnosticVerificationPath
  ]) {
    invariant(
      !pathExistsAtRevision(commit, relativePath),
      `diagnostic result material existed at registration: ${relativePath}`
    );
  }
  return commit;
}

function validateFrozenFiles(manifest, terminal) {
  invariant(
    terminal.receipt.inputs.length ===
      manifest.frozenInputClosure.terminalVerificationInputCount,
    "terminal verification input count drifted"
  );
  for (const input of manifest.frozenInputClosure.criticalInputs) {
    const file = resolveRepositoryFile(input.path);
    invariant(file.stat.size === input.bytes, `critical input ${input.path} size drifted`);
    invariant(
      sha256File(file.resolved) === input.sha256,
      `critical input ${input.path} bytes drifted`
    );
    const terminalInput = terminal.receipt.inputs.find(
      (entry) => entry.path === input.path
    );
    invariant(terminalInput !== undefined, `critical input ${input.path} lacks lineage`);
    invariant(
      terminalInput.bytes === input.bytes && terminalInput.sha256 === input.sha256,
      `critical input ${input.path} lineage drifted`
    );
  }
}

function validateManifestFile(filePath = defaultPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumManifestBytes,
    "manifest file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const manifest = validateManifest(JSON.parse(text));
  invariant(
    bytes.equals(canonicalManifestBytes(manifest)),
    "manifest bytes are not canonical pretty JSON"
  );
  invariant(sha256(bytes) === expectedManifestSha256, "manifest file hash is invalid");
  validateReferencedFile(
    manifest.terminalLineage.preregistration,
    "terminal preregistration"
  );
  manifest.terminalLineage.attempts.forEach((attempt, index) =>
    validateReferencedFile(attempt, `terminal attempt ${index}`));
  validateReferencedFile(
    manifest.terminalLineage.terminalVerification,
    "terminal verification"
  );
  const terminal = validateTerminalVerification();
  invariant(
    terminal.sha256 === manifest.terminalLineage.terminalVerification.fileSha256 &&
      terminal.receipt.receiptId ===
        manifest.terminalLineage.terminalVerification.receiptId &&
      terminal.receipt.receiptContentHash ===
        manifest.terminalLineage.terminalVerification.receiptContentHash &&
      terminal.receipt.status === "verified-terminal-no-observation" &&
      terminal.receipt.independentSummary.observationPresent === false &&
      terminal.receipt.independentSummary.qualityMetricsPresent === false &&
      terminal.receipt.independentSummary.sameExperimentRetryAllowed === false &&
      terminal.receipt.independentSummary.productPromotionAllowed === false,
    "terminal verification did not preserve the terminal boundary"
  );
  validateFrozenFiles(manifest, terminal);
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
    diagnosticId: result.manifest.diagnosticId,
    status: result.manifest.status,
    bytes: result.bytes,
    sha256: result.sha256,
    registrationCommit: result.registrationCommit
  })}\n`);
}

module.exports = Object.freeze({
  defaultPath,
  diagnosticId,
  expectedManifestSha256,
  expectedStageNames,
  registrationCommit,
  schema,
  validateManifest,
  validateManifestFile,
  validateRegistrationOrdering
});
