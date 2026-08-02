"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  expectedSha256: expectedManifestSha256,
  experimentId,
  validateManifestFile
} = require("./vector-portable-affine-u8-json-domain-v2-preregistration.js");

const schema =
  "tinyrustlm.portable_affine_u8_flat_json_domain_v2_verification.v1";
const receiptType =
  "portable-affine-u8-flat-json-domain-v2-terminal-verification";
const attemptSchema =
  "tinyrustlm.portable_affine_u8_flat_json_domain_v2_attempt.v1";
const pendingSchema =
  "tinyrustlm.portable_affine_u8_flat_json_domain_v2_pending_attempt.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const verificationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-verification-v1.json";
const verificationPath = path.join(repositoryRoot, verificationRelativePath);
const verifierRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-verification.js";
const verifierTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-json-domain-v2-verification.test.js";
const isolationTestRelativePath =
  "tinyrustlm/tests/vector-experiment-isolation.test.js";
const preregistrationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-preregistration.v1.json";
const originalPreregistrationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-preregistration.v1.json";
const runnerRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-observation.js";
const runnerTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-json-domain-v2-observation.test.js";
const pendingRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-pending-attempt-v1.json";
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-observation-v1.json";
const attemptDirectoryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-attempts/sha256";
const attemptRelativePath =
  `${attemptDirectoryRelativePath}/57/` +
  "57b55282e8cee8bb6cc14e179d817755bc6d8bb4040e1c3f2219bf2b3581b6a7.json";

const expectedAttemptFileBytes = 26425240;
const expectedAttemptFileSha256 =
  "8e6b3bc807e471150c0fb0ee74ba93bdcb169da770fd14308ba57eebea33df4d";
const expectedAttemptContentHash =
  "57b55282e8cee8bb6cc14e179d817755bc6d8bb4040e1c3f2219bf2b3581b6a7";
const expectedAttemptId =
  "portable-affine-u8-flat-json-domain-v2-attempt-57b55282e8cee8bb";
const expectedRegistrationCommit =
  "ff89d2149807925265c8598fc55f108a3af02e61";
const expectedImplementationCommit =
  "955bb48e110d51cff3303bcaae328155f6111483";
const expectedAttemptEvidenceCommit =
  "d6ba9db0753fa82da6763a8d08446350987980ef";
const expectedOriginalPreregistrationBytes = 21703;
const expectedOriginalPreregistrationSha256 =
  "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d";
const expectedQualityCanonicalBytes = 14753027;
const expectedQualityCanonicalSha256 =
  "cd3fc37665b1d7ddca644393ac5b15e50c6267d22e9d5e0f3c8c7e15cc1e425e";
const expectedQualityStdoutBytes = 14753028;
const expectedQualityStdoutSha256 =
  "b9bc0c823586ea8ad8673a9ad63ae618fd60ab1b28436deaea0686ed0ce258f5";
const expectedLastBenchmarkStdoutBytes = 1383;
const expectedLastBenchmarkStdoutSha256 =
  "1d51d7781d62ac3c6a87c73543add4358dc24cd568d9a274085264bb7154fced";
const expectedLastMonitorStderrBytes = 480;
const expectedLastMonitorStderrSha256 =
  "284357072c50546708b2ed3e6dbda93ab85dee339f6e6011c53340ab59f50f1d";
const expectedFailureMessageSha256 =
  "4d0af604f5b910f67b1395e53a6e75ae6f71cb5fa47df342d70287b572ab6c7a";
const expectedFailureCauseSha256 =
  "8ca84d7b172018420f17a8aa061b25ae2d12230bd203bada0204c4ca60167a2f";
const maximumInputBytes = 64 * 1024 * 1024;
const maximumReceiptBytes = 4 * 1024 * 1024;
const maximumBenchmarkProcessCount = 77;
const maximumMonitorProcessCount = 60;
const maximumAttemptCount = 1;
const maximumRetryCount = 0;
const emptySha256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;

const attemptRequiredNextGate =
  "Independently verify the committed v2 terminal attempt and any observation " +
  "before making a bounded research claim. This experiment allows exactly one " +
  "attempt and no retry; preserve every terminal result immutably.";
const requiredNextGate =
  "Preserve this independently verified terminal v2 attempt without retry. " +
  "The corrected serializer emitted a complete parseable quality payload, " +
  "but the frozen full experiment stopped at memory monitor 51 and produced " +
  "no performance summaries or threshold decision. Diagnose that monitor " +
  "failure through non-outcome tests, then preregister a distinct experiment " +
  "before any new outcome execution.";

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

const expectedAttemptInputPaths = Object.freeze([
  preregistrationRelativePath,
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-preregistration.js",
  "tinyrustlm/tests/vector-portable-affine-u8-json-domain-v2-preregistration.test.js",
  runnerRelativePath,
  runnerTestRelativePath,
  "Cargo.toml",
  "Cargo.lock",
  "rust/experiments/tinyrustlm-vector-oracle/Cargo.toml",
  "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/accounting.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/affine_u8_index.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/bitpack.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/codebook.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/error.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/flat_index.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/metrics.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/prng.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/score.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/sha256.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/transform.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/affine_u8_index_test.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/flat_index_test.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/lib_test.rs",
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark-v2.rs",
  "tinyrustlm/tests/vector-portable-affine-u8-benchmark-v2.test.js",
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-quality-number-domain-defect.v1.json",
  "tinyrustlm/tests/vector-portable-affine-u8-quality-number-domain-defect.test.js",
  originalPreregistrationRelativePath,
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-preregistration.v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-observation-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-verification-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v2.json",
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-comparison-preregistration.v1.json",
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-attempts/sha256/b8/b8ffb20cebbeccf0f11b297c19f771dc700f7227a03375c21f3ee52f757e25de.json",
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-attempts/sha256/db/db1a760c3d25893ed9f5ec6025a19e0a121b96bb1fb81092670155eff24e5baa.json",
  "tinyrustlm/tools/vector-portable-affine-u8-observation.js",
  "tinyrustlm/tools/vector-portable-affine-u8-verification.js",
  "tinyrustlm/tests/vector-portable-affine-u8-observation.test.js",
  "tinyrustlm/tests/vector-portable-affine-u8-verification.test.js",
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  "tinyrustlm/tools/vector-portable-affine-u8-preregistration.js",
  "tinyrustlm/tests/vector-portable-affine-u8-preregistration.test.js"
]);

const verificationInputPaths = Object.freeze([
  preregistrationRelativePath,
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-preregistration.js",
  originalPreregistrationRelativePath,
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-quality-number-domain-defect.v1.json",
  runnerRelativePath,
  runnerTestRelativePath,
  attemptRelativePath,
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  verifierRelativePath,
  verifierTestRelativePath,
  isolationTestRelativePath
]);

const harnessCapabilities = Object.freeze([
  "boundedFailure",
  "buildComparator",
  "contractSchema",
  "corruptionCases",
  "crashScenarios",
  "createOwnedRoot",
  "evaluatePerformanceThresholds",
  "evaluateQualityThresholds",
  "executeContract",
  "executeCorruptionSuite",
  "executeCrashRecoverySuite",
  "executePerformanceSuite",
  "executeQuality",
  "expectedExperimentId",
  "expectedLanes",
  "expectedMethodId",
  "harnessContract",
  "inputPaths",
  "materializeDataset",
  "offlineEnvironment",
  "performanceSchema",
  "prepareObservationPrerequisites",
  "qualitySchema",
  "recoverySchema",
  "removeOwnedRoot",
  "summarizePerformance",
  "validateBuildEvidence",
  "validateBuildVerificationEvidence",
  "validateContractOutput",
  "validateCorruptionRecord",
  "validateCrashRecoveryRecord",
  "validateExternalDatasetEvidence",
  "validatePerformanceRecord",
  "validatePerformanceSummary",
  "validateQualityOutput",
  "verifyBuildAndWasm",
  "writeMemoryMonitorScript"
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

function finiteNumber(value, label) {
  invariant(Number.isFinite(value), `${label} is not finite`);
  return value;
}

function finiteInDomain(value, minimum, maximum, label) {
  finiteNumber(value, label);
  invariant(value >= minimum && value <= maximum, `${label} is out of domain`);
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
  const revision = git(
    ["rev-parse", "HEAD"],
    "verification source revision"
  ).stdout.trim();
  invariant(revisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function commitForPaths(paths, label) {
  const revision = git(
    ["log", "-1", "--format=%H", "--", ...paths],
    label
  ).stdout.trim();
  invariant(revisionPattern.test(revision), `${label} is invalid`);
  return revision;
}

function assertInputClosureCommitted() {
  for (const relativePath of verificationInputPaths) {
    resolveRepositoryFile(relativePath);
    const tracked = git(
      ["ls-files", "--error-unmatch", "--", relativePath],
      `tracked verification input ${relativePath}`,
      true
    );
    exactValue(tracked.status, 0, `tracked verification input ${relativePath}`);
  }
  const status = git(
    ["status", "--porcelain=v1", "--", ...verificationInputPaths],
    "verification input status"
  );
  exactValue(status.stdout, "", "verification input closure status");
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
  for (const [ancestor, descendant] of [
    [registrationCommit, implementationCommit],
    [implementationCommit, attemptCommit],
    [attemptCommit, verifierCommit],
    [verifierCommit, revision]
  ]) {
    const result = git(
      ["merge-base", "--is-ancestor", ancestor, descendant],
      "verification commit ancestry",
      true
    );
    exactValue(result.status, 0, "verification commit ancestry");
  }
}

function historicalFileCandidates(relativePath, revision) {
  invariant(relativePathPattern.test(relativePath), "historical path is unsafe");
  invariant(revisionPattern.test(revision), "historical revision is invalid");
  const result = git(
    ["cat-file", "blob", `${revision}:${relativePath}`],
    `historical verification input ${relativePath}`,
    false,
    null
  );
  invariant(
    Buffer.isBuffer(result.stdout) &&
      result.stdout.length > 0 &&
      result.stdout.length <= maximumInputBytes,
    `historical verification input is invalid: ${relativePath}`
  );
  const raw = Object.freeze({
    path: relativePath,
    bytes: result.stdout.length,
    sha256: sha256(result.stdout)
  });
  let crlf = null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(result.stdout);
    if (!text.includes("\r") && text.includes("\n")) {
      const bytes = Buffer.from(text.replaceAll("\n", "\r\n"), "utf8");
      crlf = Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes)
      });
    }
  } catch {
    // Binary inputs have only their raw Git blob identity.
  }
  return Object.freeze({ raw, crlf });
}

function validateAttemptInputClosure(attempt) {
  exactValue(
    attempt.inputs.length,
    expectedAttemptInputPaths.length,
    "attempt input count"
  );
  let rawGitBlobMatchCount = 0;
  let crlfCheckoutMatchCount = 0;
  attempt.inputs.forEach((entry, index) => {
    exactKeys(entry, ["path", "bytes", "sha256"], `attempt input ${index}`);
    exactValue(
      entry.path,
      expectedAttemptInputPaths[index],
      `attempt input ${index} path`
    );
    safeInteger(entry.bytes, `attempt input ${index} bytes`, 1, maximumInputBytes);
    invariant(
      sha256Pattern.test(entry.sha256),
      `attempt input ${index} hash is invalid`
    );
    const candidates = historicalFileCandidates(
      expectedAttemptInputPaths[index],
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

function loadOriginalPreregistration() {
  const evidence = fileEvidence(originalPreregistrationRelativePath);
  exactValue(
    evidence.bytes,
    expectedOriginalPreregistrationBytes,
    "original preregistration bytes"
  );
  exactValue(
    evidence.sha256,
    expectedOriginalPreregistrationSha256,
    "original preregistration hash"
  );
  const manifest = JSON.parse(
    fs.readFileSync(
      resolveRepositoryFile(originalPreregistrationRelativePath).resolved,
      "utf8"
    )
  );
  exactValue(
    manifest.experimentId,
    "portable-affine-u8-flat-20260726",
    "original experiment identity"
  );
  exactValue(
    manifest.method.methodId,
    "portable-global-affine-u8-flat-v1",
    "original method identity"
  );
  return manifest;
}

function expectedSchedule(manifest = loadOriginalPreregistration()) {
  const schedule = [{
    phase: "contract",
    mode: "contract",
    publicArguments: [],
    exitCode: 0
  }];
  for (const caseId of manifest.persistenceAndFailure.corruptionCases) {
    schedule.push({
      phase: "corruption",
      mode: "corruption",
      publicArguments: [caseId],
      exitCode: 0
    });
  }
  for (const scenario of manifest.persistenceAndFailure.crashScenarios) {
    schedule.push({
      phase: "crash-and-recovery",
      mode: "crash",
      publicArguments: [scenario.scenarioId],
      exitCode: manifest.persistenceAndFailure.processCrashExitCode
    });
    schedule.push({
      phase: "crash-and-recovery",
      mode: "recover",
      publicArguments: [scenario.scenarioId],
      exitCode: 0
    });
  }
  schedule.push({
    phase: "quality",
    mode: "quality",
    publicArguments: [],
    exitCode: 0
  });
  for (const [laneOrdinal, lane] of manifest.corpusReuse.lanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const method of methods) {
        schedule.push({
          phase: "paired-performance",
          mode: "performance",
          publicArguments: [lane.laneId, method],
          exitCode: 0
        });
      }
    }
  }
  exactValue(schedule.length, maximumBenchmarkProcessCount, "full schedule length");
  return Object.freeze(schedule.map((entry) => Object.freeze(entry)));
}

function identity(value, prefix, idField, hashField) {
  const body = { ...value };
  delete body[idField];
  delete body[hashField];
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({ id: `${prefix}-${hash.slice(0, 16)}`, hash });
}

function validateBenchmarkRecord(record, scheduled, index) {
  const label = `benchmark record ${index + 1}`;
  exactKeys(record, [
    "ordinal",
    "phase",
    "mode",
    "publicArguments",
    "processStarted",
    "exitCode",
    "signal",
    "spawnErrorCode",
    "stdoutBytes",
    "stdoutSha256",
    "stderrBytes",
    "stderrSha256",
    "benchmarkErrorCode"
  ], label);
  exactValue(record.ordinal, index + 1, `${label} ordinal`);
  exactValue(record.phase, scheduled.phase, `${label} phase`);
  exactValue(record.mode, scheduled.mode, `${label} mode`);
  exactStructure(record.publicArguments, scheduled.publicArguments, `${label} args`);
  exactValue(record.processStarted, true, `${label} process start`);
  exactValue(record.exitCode, scheduled.exitCode, `${label} exit`);
  exactValue(record.signal, null, `${label} signal`);
  exactValue(record.spawnErrorCode, null, `${label} spawn error`);
  safeInteger(record.stdoutBytes, `${label} stdout bytes`, 0, maximumInputBytes);
  invariant(sha256Pattern.test(record.stdoutSha256), `${label} stdout hash`);
  exactValue(record.stderrBytes, 0, `${label} stderr bytes`);
  exactValue(record.stderrSha256, emptySha256, `${label} stderr hash`);
  exactValue(record.benchmarkErrorCode, null, `${label} benchmark error`);
  if (scheduled.mode === "crash") {
    exactValue(record.stdoutBytes, 0, `${label} crash stdout bytes`);
    exactValue(record.stdoutSha256, emptySha256, `${label} crash stdout hash`);
  } else {
    invariant(record.stdoutBytes > 0, `${label} stdout is empty`);
  }
}

function validateProcessLedgers(attempt, schedule) {
  exactValue(
    attempt.benchmarkProcessLedger.length,
    68,
    "terminal benchmark process count"
  );
  attempt.benchmarkProcessLedger.forEach((record, index) =>
    validateBenchmarkRecord(record, schedule[index], index));

  const quality = attempt.benchmarkProcessLedger[16];
  exactValue(quality.stdoutBytes, expectedQualityStdoutBytes, "quality stdout bytes");
  exactValue(
    quality.stdoutSha256,
    expectedQualityStdoutSha256,
    "quality stdout hash"
  );

  const lastBenchmark = attempt.benchmarkProcessLedger[67];
  exactStructure(lastBenchmark.publicArguments, [
    "controlled-memory-cosine-64",
    "exact-full"
  ], "last benchmark arguments");
  exactValue(
    lastBenchmark.stdoutBytes,
    expectedLastBenchmarkStdoutBytes,
    "last benchmark stdout bytes"
  );
  exactValue(
    lastBenchmark.stdoutSha256,
    expectedLastBenchmarkStdoutSha256,
    "last benchmark stdout hash"
  );

  exactValue(
    attempt.memoryMonitorProcessLedger.length,
    51,
    "terminal monitor process count"
  );
  attempt.memoryMonitorProcessLedger.forEach((record, index) => {
    const label = `monitor record ${index + 1}`;
    exactKeys(record, [
      "ordinal",
      "phase",
      "mode",
      "processStarted",
      "exitCode",
      "signal",
      "spawnErrorCode",
      "stdoutBytes",
      "stdoutSha256",
      "stderrBytes",
      "stderrSha256"
    ], label);
    exactValue(record.ordinal, index + 1, `${label} ordinal`);
    exactValue(record.phase, "paired-performance", `${label} phase`);
    exactValue(record.mode, "memory-monitor", `${label} mode`);
    exactValue(record.processStarted, true, `${label} process start`);
    exactValue(record.signal, null, `${label} signal`);
    exactValue(record.spawnErrorCode, null, `${label} spawn error`);
    exactValue(record.stdoutBytes, 0, `${label} stdout bytes`);
    exactValue(record.stdoutSha256, emptySha256, `${label} stdout hash`);
    if (index < 50) {
      exactValue(record.exitCode, 0, `${label} exit`);
      exactValue(record.stderrBytes, 0, `${label} stderr bytes`);
      exactValue(record.stderrSha256, emptySha256, `${label} stderr hash`);
    } else {
      exactValue(record.exitCode, 1, `${label} exit`);
      exactValue(
        record.stderrBytes,
        expectedLastMonitorStderrBytes,
        `${label} stderr bytes`
      );
      exactValue(
        record.stderrSha256,
        expectedLastMonitorStderrSha256,
        `${label} stderr hash`
      );
    }
  });
  exactValue(
    attempt.maximumParallelBenchmarkProcesses,
    1,
    "maximum benchmark parallelism"
  );
  return Object.freeze({
    benchmarkProcessCount: attempt.benchmarkProcessLedger.length,
    successfulBenchmarkProcessCount: attempt.benchmarkProcessLedger.length,
    performanceBenchmarkProcessCount:
      attempt.benchmarkProcessLedger.filter(
        (record) => record.mode === "performance"
      ).length,
    requiredPerformanceBenchmarkProcessCount: maximumMonitorProcessCount,
    memoryMonitorProcessCount: attempt.memoryMonitorProcessLedger.length,
    successfulMemoryMonitorProcessCount: 50,
    failedMemoryMonitorOrdinal: 51,
    failedMemoryMonitorExitCode: 1,
    failedMemoryMonitorStderrBytes: expectedLastMonitorStderrBytes,
    failedMemoryMonitorStderrSha256: expectedLastMonitorStderrSha256,
    rawProcessOutputPersisted: false,
    maximumParallelBenchmarkProcesses:
      attempt.maximumParallelBenchmarkProcesses
  });
}

function validateHashExecution(value, label, expectedExitCode = 0) {
  exactKeys(value, ["exitCode", "stdoutSha256", "stderrSha256"], label);
  exactValue(value.exitCode, expectedExitCode, `${label} exit`);
  invariant(sha256Pattern.test(value.stdoutSha256), `${label} stdout hash`);
  exactValue(value.stderrSha256, emptySha256, `${label} stderr hash`);
}

function validateHarnessAdapter(value) {
  exactKeys(value, [
    "schema",
    "frozenSourcePath",
    "frozenSourceBytes",
    "frozenSourceSha256",
    "transformedSourceSha256",
    "replacementRuleCount",
    "exportedCapabilities",
    "terminalWriterCapabilitiesExported",
    "harnessContract",
    "experimentId",
    "contractSchema",
    "qualitySchema",
    "performanceSchema",
    "recoverySchema"
  ], "harness adapter");
  exactValue(
    value.schema,
    "tinyrustlm.portable_affine_u8_harness_adapter.v1",
    "harness adapter schema"
  );
  exactValue(
    value.frozenSourcePath,
    "tinyrustlm/tools/vector-portable-affine-u8-observation.js",
    "frozen harness path"
  );
  exactValue(value.frozenSourceBytes, 157232, "frozen harness bytes");
  exactValue(
    value.frozenSourceSha256,
    "3b3a65db1a500f143b9e27092329f0f7e56c56c0427d53ff4d01db7e0fbd177b",
    "frozen harness hash"
  );
  exactValue(
    value.transformedSourceSha256,
    "13dd96fd1d62da92293b238bb39f00d0173da694579ac5a9ddf900f0e965d329",
    "transformed harness hash"
  );
  exactValue(value.replacementRuleCount, 11, "harness replacement count");
  exactStructure(
    value.exportedCapabilities,
    harnessCapabilities,
    "harness capability allowlist"
  );
  exactValue(
    value.terminalWriterCapabilitiesExported,
    false,
    "terminal writer capability boundary"
  );
  exactStructure(value.harnessContract, {
    benchmarkRelativePath:
      "tinyrustlm/experiments/vector-quantization/" +
      "portable-affine-u8-benchmark-v2.rs",
    outerRootPrefix:
      "tinyrustlm-portable-affine-u8-json-domain-v2-observation-",
    outerRootMarker:
      ".tinyrustlm-portable-affine-u8-json-domain-v2-observation-owned",
    outerRootMarkerBytesSha256:
      "3e66e178cc701e7ab79d8414cd154021bbd8057db65c275c6f9f3e6c84d03386",
    processRootMarker:
      ".tinyrustlm-portable-affine-u8-v2-deletion-owned",
    processRootMarkerBytesSha256:
      "116e65c0d7474a98d6d5469b3171da1456b4560b8025760f92adfb5355078bc2"
  }, "harness contract");
  exactValue(value.experimentId, experimentId, "adapter experiment");
  exactValue(
    value.contractSchema,
    "tinyrustlm.portable_affine_u8_benchmark_contract.v2",
    "adapter contract schema"
  );
  exactValue(
    value.qualitySchema,
    "tinyrustlm.portable_affine_u8_quality_process.v2",
    "adapter quality schema"
  );
  exactValue(
    value.performanceSchema,
    "tinyrustlm.portable_affine_u8_performance_process.v2",
    "adapter performance schema"
  );
  exactValue(
    value.recoverySchema,
    "tinyrustlm.portable_affine_u8_durable_deletion_recovery.v2",
    "adapter recovery schema"
  );
}

function validateRunnerBoundary() {
  const candidates = historicalFileCandidates(
    runnerRelativePath,
    expectedImplementationCommit
  );
  const source = git(
    ["cat-file", "blob", `${expectedImplementationCommit}:${runnerRelativePath}`],
    "historical runner source",
    false,
    null
  ).stdout.toString("utf8");
  invariant(
    candidates.raw.sha256 === sha256(Buffer.from(source, "utf8")),
    "runner source identity drifted"
  );
  invariant(
    !source.includes("subject.runAndWriteObservation") &&
      !source.includes("subject.generateObservation") &&
      !source.includes("subject.writePendingAttempt"),
    "frozen terminal writer is reachable through the v2 adapter"
  );
  invariant(
    source.includes("terminalWriterCapabilitiesExported: false") &&
      source.includes("portable-affine-u8-benchmark-v2.rs"),
    "runner adapter boundary is absent"
  );
  return Object.freeze({
    sourceRevision: expectedImplementationCommit,
    runnerPath: runnerRelativePath,
    runnerGitBlobBytes: candidates.raw.bytes,
    runnerGitBlobSha256: candidates.raw.sha256,
    terminalWriterCapabilitiesExported: false,
    outcomeCommandInvokedByVerifier: false
  });
}

function validateV2Regression(value) {
  exactKeys(value, [
    "schema",
    "testPath",
    "testBytes",
    "testSha256",
    "nodeArguments",
    "exitCode",
    "signal",
    "stdoutBytes",
    "stdoutSha256",
    "stderrBytes",
    "stderrSha256",
    "outcomeModesInvoked"
  ], "v2 regression");
  exactValue(
    value.schema,
    "tinyrustlm.portable_affine_u8_json_domain_v2_regression_execution.v1",
    "v2 regression schema"
  );
  exactValue(
    value.testPath,
    "tinyrustlm/tests/vector-portable-affine-u8-benchmark-v2.test.js",
    "v2 regression test path"
  );
  exactValue(value.testBytes, 4358, "v2 regression test bytes");
  exactValue(
    value.testSha256,
    "ded8d50a3b65d171d6fe50fd096833e05a358946aa2406d781756ca0cb3621b4",
    "v2 regression test hash"
  );
  exactStructure(value.nodeArguments, [
    "--test",
    "tinyrustlm/tests/vector-portable-affine-u8-benchmark-v2.test.js"
  ], "v2 regression arguments");
  exactValue(value.exitCode, 0, "v2 regression exit");
  exactValue(value.signal, null, "v2 regression signal");
  exactValue(value.stdoutBytes, 301, "v2 regression stdout bytes");
  exactValue(
    value.stdoutSha256,
    "0213636d4eb36aaef306b57a8a177250b0debec8f92a3ee6661cef7217b6ae14",
    "v2 regression stdout hash"
  );
  exactValue(value.stderrBytes, 0, "v2 regression stderr bytes");
  exactValue(value.stderrSha256, emptySha256, "v2 regression stderr hash");
  exactValue(value.outcomeModesInvoked, false, "v2 regression outcome boundary");
}

function validateTools(value) {
  exactKeys(value, ["node", "cargo", "rustc", "powershell"], "tool evidence");
  for (const [key, tool] of Object.entries(value)) {
    exactKeys(tool, [
      "name",
      "version",
      "binaryBytes",
      "binarySha256"
    ], `tool ${key}`);
    invariant(
      typeof tool.name === "string" &&
        tool.name.length > 0 &&
        typeof tool.version === "string" &&
        tool.version.length > 0,
      `tool ${key} identity is invalid`
    );
    safeInteger(tool.binaryBytes, `tool ${key} bytes`, 1);
    invariant(sha256Pattern.test(tool.binarySha256), `tool ${key} hash`);
  }
}

function validateExternalDataset(value, manifest) {
  exactKeys(value, [
    "sourceRepository",
    "revision",
    "tree",
    "licenseExpression",
    "licenseBytes",
    "licenseSha256",
    "readmeBytes",
    "readmeSha256",
    "files",
    "checkoutClean",
    "locatorPersisted",
    "bytesPersisted"
  ], "external dataset");
  exactValue(
    value.sourceRepository,
    manifest.subject.externalDataset.sourceRepository,
    "dataset repository"
  );
  exactValue(
    value.revision,
    manifest.subject.externalDataset.revision,
    "dataset revision"
  );
  exactValue(value.tree, manifest.subject.externalDataset.tree, "dataset tree");
  exactValue(value.licenseExpression, "MIT", "dataset license");
  safeInteger(value.licenseBytes, "dataset license bytes", 1);
  invariant(sha256Pattern.test(value.licenseSha256), "dataset license hash");
  safeInteger(value.readmeBytes, "dataset readme bytes", 1);
  invariant(sha256Pattern.test(value.readmeSha256), "dataset readme hash");
  invariant(Array.isArray(value.files) && value.files.length === 4,
    "dataset file inventory is invalid");
  for (const [index, file] of value.files.entries()) {
    exactKeys(file, [
      "upstreamPath",
      "compressedBytes",
      "compressedSha256",
      "decompressedBytes",
      "decompressedSha256",
      "idxMagic",
      "itemCount",
      "rows",
      "columns"
    ], `dataset file ${index}`);
    invariant(
      /^data\/fashion\/[A-Za-z0-9.-]+$/u.test(file.upstreamPath),
      `dataset file ${index} path is invalid`
    );
    safeInteger(file.compressedBytes, `dataset file ${index} compressed bytes`, 1);
    safeInteger(
      file.decompressedBytes,
      `dataset file ${index} decompressed bytes`,
      1
    );
    invariant(
      sha256Pattern.test(file.compressedSha256) &&
        sha256Pattern.test(file.decompressedSha256),
      `dataset file ${index} hash is invalid`
    );
    invariant(
      [2049, 2051].includes(file.idxMagic) &&
        Number.isSafeInteger(file.itemCount) &&
        (file.rows === null || Number.isSafeInteger(file.rows)) &&
        (file.columns === null || Number.isSafeInteger(file.columns)),
      `dataset file ${index} IDX metadata is invalid`
    );
  }
  exactValue(value.checkoutClean, true, "dataset checkout clean");
  exactValue(value.locatorPersisted, false, "dataset locator persistence");
  exactValue(value.bytesPersisted, false, "dataset byte persistence");
}

function validateBuildEvidence(retained) {
  exactStructure(retained.platform, {
    runtimeIdentifier: "win-x64",
    operatingSystem: "windows",
    architecture: "x64",
    rustTarget: "x86_64-pc-windows-msvc"
  }, "platform evidence");
  validateTools(retained.tools);
  exactKeys(retained.buildVerification, [
    "format",
    "nativeTests",
    "clippy",
    "documentation",
    "wasmBuild",
    "wasmExecution"
  ], "build verification");
  for (const key of [
    "format",
    "nativeTests",
    "clippy",
    "documentation",
    "wasmBuild"
  ]) {
    validateHashExecution(retained.buildVerification[key], `build ${key}`);
  }
  const wasm = retained.buildVerification.wasmExecution;
  exactKeys(wasm, [
    "artifactBytes",
    "artifactSha256",
    "importCount",
    "exports",
    "mainResult"
  ], "wasm execution");
  safeInteger(wasm.artifactBytes, "wasm artifact bytes", 1);
  invariant(sha256Pattern.test(wasm.artifactSha256), "wasm artifact hash");
  exactValue(wasm.importCount, 0, "wasm import count");
  exactStructure(wasm.exports, [
    { name: "memory", kind: "memory" },
    { name: "main", kind: "function" },
    { name: "__data_end", kind: "global" },
    { name: "__heap_base", kind: "global" }
  ], "wasm exports");
  exactValue(wasm.mainResult, 0, "wasm main result");

  exactKeys(retained.build, [
    "cargo",
    "rustc",
    "libraryArtifactBytes",
    "libraryArtifactSha256",
    "executableBytes",
    "executableSha256",
    "cargoLockSha256",
    "offline"
  ], "build evidence");
  for (const key of ["cargo", "rustc"]) {
    const command = retained.build[key];
    exactKeys(command, [
      "executable",
      "arguments",
      "exitCode",
      "stdoutSha256",
      "stderrSha256",
      ...(key === "cargo" ? ["compilerArtifactCount", "warningCount"] : [])
    ], `${key} build`);
    invariant(
      typeof command.executable === "string" &&
        Array.isArray(command.arguments) &&
        command.arguments.length > 0,
      `${key} build command is invalid`
    );
    exactValue(command.exitCode, 0, `${key} build exit`);
    invariant(sha256Pattern.test(command.stdoutSha256), `${key} build stdout`);
    exactValue(command.stderrSha256, emptySha256, `${key} build stderr`);
  }
  exactValue(retained.build.cargo.compilerArtifactCount, 1,
    "cargo artifact count");
  exactValue(retained.build.cargo.warningCount, 0, "cargo warning count");
  for (const field of ["libraryArtifactBytes", "executableBytes"]) {
    safeInteger(retained.build[field], `build ${field}`, 1);
  }
  for (const field of [
    "libraryArtifactSha256",
    "executableSha256",
    "cargoLockSha256"
  ]) {
    invariant(sha256Pattern.test(retained.build[field]), `build ${field}`);
  }
  exactValue(retained.build.offline, true, "offline build");
}

function validateContractAndFaultEvidence(retained, attempt, originalManifest) {
  validateHashExecution(retained.contractExecution, "contract execution");
  exactStructure(retained.contract, {
    schema: "tinyrustlm.portable_affine_u8_benchmark_contract.v2",
    experimentId,
    methodId: "portable-global-affine-u8-flat-v1",
    bitWidth: 8,
    qualityProcessCount: 1,
    performanceLaneCount: 6,
    performanceMethodCount: 2,
    performanceRepetitionCount: 5,
    corruptionCaseCount: 7,
    crashScenarioCount: 4,
    processCrashExitCode: 74,
    networkRequired: false,
    productImport: false
  }, "benchmark contract");
  exactValue(
    retained.contractExecution.stdoutSha256,
    attempt.benchmarkProcessLedger[0].stdoutSha256,
    "contract process binding"
  );

  exactValue(retained.corruptionRecords.length, 7, "corruption record count");
  retained.corruptionRecords.forEach((record, index) => {
    const caseId = originalManifest.persistenceAndFailure.corruptionCases[index];
    exactKeys(record, [
      "caseOrdinal",
      "caseId",
      "exitCode",
      "stdoutSha256",
      "stderrSha256",
      "managedFileCountBeforeDeletion",
      "processRootDeleted",
      "process"
    ], `corruption record ${index}`);
    exactValue(record.caseOrdinal, index, `corruption ${index} ordinal`);
    exactValue(record.caseId, caseId, `corruption ${index} id`);
    exactValue(record.exitCode, 0, `corruption ${index} exit`);
    exactValue(
      record.stdoutSha256,
      attempt.benchmarkProcessLedger[index + 1].stdoutSha256,
      `corruption ${index} stdout binding`
    );
    exactValue(record.stderrSha256, emptySha256,
      `corruption ${index} stderr`);
    exactValue(record.managedFileCountBeforeDeletion, 3,
      `corruption ${index} managed count`);
    exactValue(record.processRootDeleted, true,
      `corruption ${index} root deletion`);
    exactStructure(record.process, {
      schema: "tinyrustlm.portable_affine_u8_corruption_process.v1",
      experimentId,
      caseId,
      rejectedBeforeSearch: true,
      panicObserved: false,
      boundedErrorCode:
        caseId === "commit-hash-mismatch"
          ? "commit-hash-mismatch"
          : "digest-mismatch"
    }, `corruption ${index} process`);
  });

  exactValue(retained.crashRecoveries.length, 4, "crash recovery count");
  retained.crashRecoveries.forEach((record, index) => {
    const scenario = originalManifest.persistenceAndFailure.crashScenarios[index];
    const crash = attempt.benchmarkProcessLedger[8 + index * 2];
    const recovery = attempt.benchmarkProcessLedger[9 + index * 2];
    exactKeys(record, [
      "scenarioOrdinal",
      "scenarioId",
      "crashExitCode",
      "crashStdoutSha256",
      "crashStderrSha256",
      "recoveryExitCode",
      "recoveryStdoutSha256",
      "recoveryStderrSha256",
      "managedFileCountBeforeDeletion",
      "processRootDeleted",
      "recovery"
    ], `crash recovery ${index}`);
    exactValue(record.scenarioOrdinal, index, `recovery ${index} ordinal`);
    exactValue(record.scenarioId, scenario.scenarioId, `recovery ${index} id`);
    exactValue(record.crashExitCode, 74, `recovery ${index} crash exit`);
    exactValue(record.crashStdoutSha256, crash.stdoutSha256,
      `recovery ${index} crash stdout`);
    exactValue(record.crashStderrSha256, crash.stderrSha256,
      `recovery ${index} crash stderr`);
    exactValue(record.recoveryExitCode, 0, `recovery ${index} exit`);
    exactValue(record.recoveryStdoutSha256, recovery.stdoutSha256,
      `recovery ${index} stdout`);
    exactValue(record.recoveryStderrSha256, recovery.stderrSha256,
      `recovery ${index} stderr`);
    exactValue(record.managedFileCountBeforeDeletion, 3,
      `recovery ${index} managed count`);
    exactValue(record.processRootDeleted, true,
      `recovery ${index} root deletion`);
    const result = record.recovery;
    exactKeys(result, [
      "schema",
      "experimentId",
      "scenarioId",
      "processCrashExitCode",
      "expectedActiveGenerationBeforeRetry",
      "observedActiveGenerationBeforeRetry",
      "deletionCommittedBeforeRetry",
      "finalActiveGeneration",
      "retryWroteGenerationTwo",
      "retryIdempotent",
      "finalTargetIdentifierMatches",
      "finalTargetVectorFingerprintMatches",
      "activeIndexContainsAnyDeletedTarget",
      "activeIndexContainsActiveDeletedTarget",
      "allCrashScenariosMustRecover",
      "powerLossSimulated",
      "filesystemForensicErasureTested",
      "removedManagedFileCount",
      "directoryFlushAttempted",
      "directoryFlushSucceeded",
      "finalSnapshotSha256",
      "finalCommitSha256"
    ], `recovery process ${index}`);
    exactValue(
      result.schema,
      "tinyrustlm.portable_affine_u8_durable_deletion_recovery.v2",
      `recovery ${index} schema`
    );
    exactValue(result.experimentId, experimentId,
      `recovery ${index} experiment`);
    exactValue(result.scenarioId, scenario.scenarioId,
      `recovery ${index} scenario`);
    exactValue(result.processCrashExitCode, 74,
      `recovery ${index} registered exit`);
    exactValue(
      result.expectedActiveGenerationBeforeRetry,
      scenario.expectedActiveGeneration,
      `recovery ${index} expected generation`
    );
    exactValue(
      result.observedActiveGenerationBeforeRetry,
      scenario.expectedActiveGeneration,
      `recovery ${index} observed generation`
    );
    exactValue(
      result.deletionCommittedBeforeRetry,
      scenario.deletionCommitted,
      `recovery ${index} deletion state`
    );
    exactValue(result.finalActiveGeneration, 2,
      `recovery ${index} final generation`);
    exactValue(
      result.retryWroteGenerationTwo,
      !scenario.deletionCommitted,
      `recovery ${index} retry write`
    );
    exactValue(result.retryIdempotent, true,
      `recovery ${index} idempotency`);
    for (const field of [
      "finalTargetIdentifierMatches",
      "finalTargetVectorFingerprintMatches"
    ]) {
      exactValue(result[field], 0, `recovery ${index} ${field}`);
    }
    for (const field of [
      "activeIndexContainsAnyDeletedTarget",
      "activeIndexContainsActiveDeletedTarget",
      "powerLossSimulated",
      "filesystemForensicErasureTested",
      "directoryFlushSucceeded"
    ]) {
      exactValue(result[field], false, `recovery ${index} ${field}`);
    }
    exactValue(result.allCrashScenariosMustRecover, true,
      `recovery ${index} recovery requirement`);
    exactValue(result.removedManagedFileCount, 2,
      `recovery ${index} removed count`);
    exactValue(result.directoryFlushAttempted, true,
      `recovery ${index} flush attempt`);
    invariant(
      sha256Pattern.test(result.finalSnapshotSha256) &&
        sha256Pattern.test(result.finalCommitSha256),
      `recovery ${index} final hashes are invalid`
    );
  });
}

const laneMetricFields = Object.freeze([
  "minimumRecallAt1",
  "minimumRecallAt10",
  "minimumRecallAt100",
  "minimumMrrAt100",
  "minimumNdcgAt100",
  "maximumRankInversionRateAt100"
]);
const errorMetricFields = Object.freeze([
  "maximumAbsoluteNormalizedScoreError",
  "meanAbsoluteNormalizedScoreError",
  "p99AbsoluteNormalizedScoreError"
]);
const utilityFields = Object.freeze([
  "macroLabelPrecisionAt10",
  "macroLabelMrrAt10",
  "macroLabelNdcgAt10"
]);

function validateQualityPayload(value, originalManifest = loadOriginalPreregistration()) {
  exactKeys(value, [
    "schema",
    "experimentId",
    "qualityProcessOrdinal",
    "datasetName",
    "datasetRevision",
    "selectionAlgorithm",
    "selectionSha256",
    "topKValues",
    "laneResults",
    "perQueryMetrics"
  ], "quality payload");
  exactValue(
    value.schema,
    "tinyrustlm.portable_affine_u8_quality_process.v2",
    "quality schema"
  );
  exactValue(value.experimentId, experimentId, "quality experiment");
  exactValue(value.qualityProcessOrdinal, 1, "quality process ordinal");
  exactValue(value.datasetName, "Fashion-MNIST", "quality dataset");
  exactValue(
    value.datasetRevision,
    originalManifest.corpusReuse.datasetRevision,
    "quality dataset revision"
  );
  exactValue(
    value.selectionAlgorithm,
    originalManifest.corpusReuse.selectionAlgorithm,
    "quality selection algorithm"
  );
  exactValue(
    value.selectionSha256,
    originalManifest.corpusReuse.selectionSha256,
    "quality selection hash"
  );
  exactStructure(value.topKValues, [1, 10, 100], "quality top-k values");
  exactValue(
    value.laneResults.length,
    originalManifest.corpusReuse.lanes.length,
    "quality lane count"
  );

  let expectedQueryOffset = 0;
  for (const [laneIndex, lane] of originalManifest.corpusReuse.lanes.entries()) {
    const result = value.laneResults[laneIndex];
    const label = `quality lane ${lane.laneId}`;
    exactKeys(result, [
      "laneId",
      "laneKind",
      "metric",
      "normalization",
      "dimension",
      "declaredRecordCount",
      "activeRecordCount",
      "queryCount",
      "topKValues",
      "minimumRecallAt1",
      "minimumRecallAt10",
      "minimumRecallAt100",
      "minimumMrrAt100",
      "minimumNdcgAt100",
      "rankInversionsAt100",
      "maximumRankInversionRateAt100",
      "maximumAbsoluteNormalizedScoreError",
      "meanAbsoluteNormalizedScoreError",
      "p99AbsoluteNormalizedScoreError",
      "missingResultCount",
      "duplicateResultCount",
      "byteAccounting",
      "determinism",
      "capacityControl",
      "naturalUtility",
      "controlledUtility"
    ], label);
    exactValue(result.laneId, lane.laneId, `${label} id`);
    exactValue(result.laneKind, lane.laneKind, `${label} kind`);
    exactValue(result.metric, lane.metric, `${label} metric`);
    exactValue(result.normalization, lane.normalization, `${label} normalization`);
    exactValue(result.dimension, lane.dimension, `${label} dimension`);
    exactValue(
      result.declaredRecordCount,
      lane.recordCount,
      `${label} declared count`
    );
    exactValue(
      result.activeRecordCount,
      lane.laneKind === "controlled-memory"
        ? lane.recordCount - 10
        : lane.recordCount,
      `${label} active count`
    );
    exactValue(result.queryCount, lane.queryCount, `${label} query count`);
    exactStructure(result.topKValues, lane.topKValues, `${label} top-k`);
    for (const field of laneMetricFields) {
      finiteInDomain(result[field], 0, 1, `${label} ${field}`);
    }
    for (const field of errorMetricFields) {
      finiteInDomain(
        result[field],
        0,
        Number.MAX_VALUE,
        `${label} ${field}`
      );
    }
    safeInteger(result.rankInversionsAt100, `${label} rank inversions`);
    safeInteger(result.missingResultCount, `${label} missing count`);
    safeInteger(result.duplicateResultCount, `${label} duplicate count`);

    exactKeys(result.byteAccounting, [
      "candidateIndexBytes",
      "candidateIndexSha256",
      "expectedCandidateIndexBytes",
      "fullExactIndexBytes",
      "candidateToFullExactRatio",
      "effectiveBitsPerOriginalCoordinate"
    ], `${label} byte accounting`);
    for (const field of [
      "candidateIndexBytes",
      "expectedCandidateIndexBytes",
      "fullExactIndexBytes"
    ]) {
      safeInteger(result.byteAccounting[field], `${label} ${field}`, 1);
    }
    exactValue(
      result.byteAccounting.candidateIndexBytes,
      result.byteAccounting.expectedCandidateIndexBytes,
      `${label} candidate byte formula`
    );
    invariant(
      sha256Pattern.test(result.byteAccounting.candidateIndexSha256),
      `${label} candidate hash`
    );
    finiteInDomain(
      result.byteAccounting.candidateToFullExactRatio,
      0,
      Number.MAX_VALUE,
      `${label} persistent ratio`
    );
    finiteInDomain(
      result.byteAccounting.effectiveBitsPerOriginalCoordinate,
      0,
      Number.MAX_VALUE,
      `${label} effective bits`
    );

    exactStructure(result.determinism, {
      independentBuildBytesMatch: true,
      preAndPostReloadOutputsMatch: true
    }, `${label} determinism`);
    exactKeys(result.capacityControl, [
      "candidateBudgetBytes",
      "exactRecordCount",
      "exactBytes",
      "nextExactBytes",
      "minimumRecallAt1",
      "minimumRecallAt10",
      "minimumRecallAt100",
      "minimumMrrAt100",
      "minimumNdcgAt100"
    ], `${label} capacity control`);
    for (const field of [
      "candidateBudgetBytes",
      "exactRecordCount",
      "exactBytes",
      "nextExactBytes"
    ]) {
      safeInteger(result.capacityControl[field], `${label} capacity ${field}`, 1);
    }
    for (const field of laneMetricFields.slice(0, 5)) {
      finiteInDomain(
        result.capacityControl[field],
        0,
        1,
        `${label} capacity ${field}`
      );
    }

    if (lane.laneKind === "natural") {
      exactKeys(result.naturalUtility, [
        "candidate",
        "exact",
        "delta"
      ], `${label} natural utility`);
      for (const side of ["candidate", "exact"]) {
        exactKeys(result.naturalUtility[side], [
          ...utilityFields,
          "perClassQueryCoverage"
        ], `${label} ${side} utility`);
        for (const field of utilityFields) {
          finiteInDomain(
            result.naturalUtility[side][field],
            0,
            1,
            `${label} ${side} ${field}`
          );
        }
        exactStructure(
          result.naturalUtility[side].perClassQueryCoverage,
          Array(10).fill(20),
          `${label} ${side} class coverage`
        );
      }
      exactKeys(
        result.naturalUtility.delta,
        utilityFields,
        `${label} utility delta`
      );
      for (const field of utilityFields) {
        finiteInDomain(
          result.naturalUtility.delta[field],
          -1,
          1,
          `${label} delta ${field}`
        );
      }
    } else {
      exactValue(result.naturalUtility, null, `${label} natural utility`);
    }
    if (lane.laneKind === "controlled-memory") {
      exactKeys(result.controlledUtility, [
        "expectedFirstHitRate",
        "forbiddenHitRateAt10",
        "deletedHitCount",
        "filterViolationCount"
      ], `${label} controlled utility`);
      finiteInDomain(
        result.controlledUtility.expectedFirstHitRate,
        0,
        1,
        `${label} expected hit rate`
      );
      finiteInDomain(
        result.controlledUtility.forbiddenHitRateAt10,
        0,
        1,
        `${label} forbidden hit rate`
      );
      safeInteger(result.controlledUtility.deletedHitCount,
        `${label} deleted hit count`);
      safeInteger(result.controlledUtility.filterViolationCount,
        `${label} filter violation count`);
    } else {
      exactValue(result.controlledUtility, null, `${label} controlled utility`);
    }

    const laneQueries = value.perQueryMetrics.slice(
      expectedQueryOffset,
      expectedQueryOffset + lane.queryCount
    );
    exactValue(laneQueries.length, lane.queryCount, `${label} query slice`);
    laneQueries.forEach((query, queryIndex) =>
      validateQueryMetric(query, lane, queryIndex));
    expectedQueryOffset += lane.queryCount;
  }
  exactValue(
    value.perQueryMetrics.length,
    expectedQueryOffset,
    "quality per-query count"
  );

  const canonical = Buffer.from(canonicalJson(value), "utf8");
  exactValue(
    canonical.length,
    expectedQualityCanonicalBytes,
    "quality canonical bytes"
  );
  exactValue(
    sha256(canonical),
    expectedQualityCanonicalSha256,
    "quality canonical hash"
  );
  return Object.freeze({
    schema: value.schema,
    qualityProcessOrdinal: value.qualityProcessOrdinal,
    laneCount: value.laneResults.length,
    perQueryMetricCount: value.perQueryMetrics.length,
    scorePairCount: value.perQueryMetrics.reduce(
      (sum, query) => sum + query.scorePairs.length,
      0
    ),
    oracleResultCount: value.perQueryMetrics.reduce(
      (sum, query) => sum + query.oracleTopResults.length,
      0
    ),
    canonicalJsonBytes: canonical.length,
    canonicalJsonSha256: sha256(canonical),
    numericDomainsValid: true,
    thresholdDecisionComputed: false
  });
}

function validateQueryMetric(query, lane, queryIndex) {
  const label = `quality query ${lane.laneId}/${queryIndex}`;
  exactKeys(query, [
    "laneId",
    "queryOrdinal",
    "classOrTopic",
    "recallAt1",
    "recallAt10",
    "recallAt100",
    "mrrAt100",
    "ndcgAt100",
    "rankInversionsAt100",
    "rankInversionRateAt100",
    "maximumAbsoluteNormalizedScoreError",
    "meanAbsoluteNormalizedScoreError",
    "p99AbsoluteNormalizedScoreError",
    "missingResultCount",
    "duplicateResultCount",
    "scorePairs",
    "oracleTopResults",
    "labelPrecisionAt10",
    "labelMrrAt10",
    "labelNdcgAt10",
    "oracleLabelPrecisionAt10",
    "oracleLabelMrrAt10",
    "oracleLabelNdcgAt10",
    "expectedFirstHit",
    "forbiddenHitCountAt10",
    "deletedHitCount",
    "filterViolationCount"
  ], label);
  exactValue(query.laneId, lane.laneId, `${label} lane`);
  exactValue(query.queryOrdinal, queryIndex, `${label} ordinal`);
  safeInteger(query.classOrTopic, `${label} class or topic`, 0, 9);
  for (const field of [
    "recallAt1",
    "recallAt10",
    "recallAt100",
    "mrrAt100",
    "ndcgAt100",
    "rankInversionRateAt100"
  ]) {
    finiteInDomain(query[field], 0, 1, `${label} ${field}`);
  }
  for (const field of errorMetricFields) {
    finiteInDomain(query[field], 0, Number.MAX_VALUE, `${label} ${field}`);
  }
  for (const field of [
    "rankInversionsAt100",
    "missingResultCount",
    "duplicateResultCount"
  ]) {
    safeInteger(query[field], `${label} ${field}`);
  }
  const expectedResultCount =
    lane.laneKind === "controlled-memory" ? 8 : 100;
  exactValue(query.scorePairs.length, expectedResultCount,
    `${label} score pair count`);
  exactValue(query.oracleTopResults.length, expectedResultCount,
    `${label} oracle result count`);
  query.scorePairs.forEach((pair, index) => {
    exactKeys(pair, [
      "externalId",
      "candidateScore",
      "oracleScore",
      "absoluteNormalizedScoreError"
    ], `${label} score pair ${index}`);
    safeInteger(pair.externalId, `${label} pair ${index} id`, 1);
    finiteNumber(pair.candidateScore, `${label} pair ${index} candidate score`);
    finiteNumber(pair.oracleScore, `${label} pair ${index} oracle score`);
    finiteInDomain(
      pair.absoluteNormalizedScoreError,
      0,
      Number.MAX_VALUE,
      `${label} pair ${index} error`
    );
  });
  query.oracleTopResults.forEach((result, index) => {
    exactKeys(result, ["externalId", "score"], `${label} oracle ${index}`);
    safeInteger(result.externalId, `${label} oracle ${index} id`, 1);
    finiteNumber(result.score, `${label} oracle ${index} score`);
  });
  const labelFields = [
    "labelPrecisionAt10",
    "labelMrrAt10",
    "labelNdcgAt10",
    "oracleLabelPrecisionAt10",
    "oracleLabelMrrAt10",
    "oracleLabelNdcgAt10"
  ];
  if (lane.laneKind === "natural") {
    for (const field of labelFields) {
      finiteInDomain(query[field], 0, 1, `${label} ${field}`);
    }
  } else {
    for (const field of labelFields) {
      exactValue(query[field], null, `${label} ${field}`);
    }
  }
  const controlledFields = [
    "forbiddenHitCountAt10",
    "deletedHitCount",
    "filterViolationCount"
  ];
  if (lane.laneKind === "controlled-memory") {
    invariant(typeof query.expectedFirstHit === "boolean",
      `${label} expected hit is invalid`);
    for (const field of controlledFields) {
      safeInteger(query[field], `${label} ${field}`);
    }
  } else {
    exactValue(query.expectedFirstHit, null, `${label} expected hit`);
    for (const field of controlledFields) {
      exactValue(query[field], null, `${label} ${field}`);
    }
  }
}

function validateRetainedEvidence(attempt, preregistrationManifest) {
  const retained = attempt.retainedEvidence;
  exactKeys(retained, [
    "harnessAdapter",
    "v2Regression",
    "platform",
    "tools",
    "externalDataset",
    "buildVerification",
    "build",
    "contractExecution",
    "contract",
    "corruptionRecords",
    "crashRecoveries",
    "qualityExecution",
    "quality",
    "performanceRecords",
    "performanceSummaries"
  ], "retained evidence");
  validateHarnessAdapter(retained.harnessAdapter);
  const runnerBoundary = validateRunnerBoundary();
  validateV2Regression(retained.v2Regression);
  validateExternalDataset(retained.externalDataset, preregistrationManifest);
  validateBuildEvidence(retained);
  const originalManifest = loadOriginalPreregistration();
  validateContractAndFaultEvidence(retained, attempt, originalManifest);

  exactKeys(retained.qualityExecution, [
    "exitCode",
    "stdoutSha256",
    "stderrSha256",
    "managedFileCountBeforeDeletion",
    "processRootDeleted"
  ], "quality execution");
  exactValue(retained.qualityExecution.exitCode, 0, "quality execution exit");
  exactValue(
    retained.qualityExecution.stdoutSha256,
    expectedQualityStdoutSha256,
    "quality execution stdout hash"
  );
  exactValue(
    retained.qualityExecution.stdoutSha256,
    attempt.benchmarkProcessLedger[16].stdoutSha256,
    "quality process binding"
  );
  exactValue(retained.qualityExecution.stderrSha256, emptySha256,
    "quality execution stderr");
  exactValue(retained.qualityExecution.managedFileCountBeforeDeletion, 1,
    "quality managed file count");
  exactValue(retained.qualityExecution.processRootDeleted, true,
    "quality process root deletion");
  const qualitySummary = validateQualityPayload(retained.quality, originalManifest);
  exactValue(retained.performanceRecords.length, 0,
    "retained performance records");
  exactValue(retained.performanceSummaries.length, 0,
    "retained performance summaries");
  return Object.freeze({
    runnerBoundary,
    v2RegressionPassed: true,
    nativeBuildAndChecksPassed: true,
    wasmBuildAndExecutionPassed: true,
    contractPassed: true,
    corruptionCasesPassed: retained.corruptionRecords.length,
    crashRecoveryScenariosPassed: retained.crashRecoveries.length,
    qualityProcessPassed: true,
    quality: qualitySummary,
    performanceRecordsRetained: retained.performanceRecords.length,
    performanceSummariesRetained: retained.performanceSummaries.length
  });
}

function listAttemptFiles() {
  const root = path.join(repositoryRoot, attemptDirectoryRelativePath);
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      invariant(!entry.isSymbolicLink(), "attempt archive contains a symlink");
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        files.push(path.relative(repositoryRoot, full).replaceAll("\\", "/"));
      } else {
        throw new Error("attempt archive contains an unsupported entry");
      }
    }
  }
  visit(root);
  return files.sort();
}

function loadTerminalAttempt() {
  const evidence = fileEvidence(attemptRelativePath);
  exactValue(evidence.bytes, expectedAttemptFileBytes, "attempt file bytes");
  exactValue(evidence.sha256, expectedAttemptFileSha256, "attempt file hash");
  exactStructure(listAttemptFiles(), [attemptRelativePath], "attempt archive");
  const bytes = fs.readFileSync(resolveRepositoryFile(attemptRelativePath).resolved);
  const attempt = JSON.parse(bytes.toString("utf8"));
  invariant(
    bytes.equals(canonicalPrettyBytes(attempt)),
    "attempt file bytes are not canonical pretty JSON"
  );
  return Object.freeze({ attempt, evidence });
}

function validateTerminalAttempt() {
  const manifestResult = validateManifestFile();
  exactValue(
    manifestResult.registrationCommit,
    expectedRegistrationCommit,
    "v2 registration commit"
  );
  const { attempt, evidence } = loadTerminalAttempt();
  exactKeys(attempt, [
    "schema",
    "experimentId",
    "attemptOrdinal",
    "previousAttemptId",
    "status",
    "startedAtUtc",
    "completedAtUtc",
    "sourceRevision",
    "preregistration",
    "implementationCommit",
    "pendingAttemptId",
    "pendingAttemptContentHash",
    "lastPhase",
    "benchmarkProcessLedger",
    "memoryMonitorProcessLedger",
    "maximumParallelBenchmarkProcesses",
    "inputs",
    "retainedEvidence",
    "cleanup",
    "observationId",
    "observationContentHash",
    "failure",
    "processEvidenceComplete",
    "authority",
    "requiredNextGate",
    "attemptId",
    "attemptContentHash"
  ], "terminal attempt");
  exactValue(attempt.schema, attemptSchema, "attempt schema");
  exactValue(attempt.experimentId, experimentId, "attempt experiment");
  exactValue(attempt.attemptOrdinal, 1, "attempt ordinal");
  exactValue(attempt.previousAttemptId, null, "attempt predecessor");
  exactValue(
    attempt.status,
    "fail-instrumentation-terminal",
    "attempt status"
  );
  invariant(
    utcPattern.test(attempt.startedAtUtc) &&
      utcPattern.test(attempt.completedAtUtc) &&
      Date.parse(attempt.completedAtUtc) >= Date.parse(attempt.startedAtUtc),
    "attempt timestamps are invalid"
  );
  exactValue(
    attempt.startedAtUtc,
    "2026-07-26T13:49:55.043Z",
    "attempt start"
  );
  exactValue(
    attempt.completedAtUtc,
    "2026-07-26T13:57:37.655Z",
    "attempt completion"
  );
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
  exactStructure(attempt.preregistration, {
    path: preregistrationRelativePath,
    sha256: expectedManifestSha256,
    registrationCommit: expectedRegistrationCommit
  }, "attempt preregistration");

  const pendingBody = {
    schema: pendingSchema,
    experimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
    startedAtUtc: attempt.startedAtUtc,
    sourceRevision: attempt.sourceRevision,
    preregistrationSha256: expectedManifestSha256,
    maximumBenchmarkProcessCount,
    maximumMonitorProcessCount,
    benchmarkProcessCountAtJournalWrite: 0,
    monitorProcessCountAtJournalWrite: 0,
    setupStartedAtJournalWrite: false
  };
  const pendingIdentity = identity(
    pendingBody,
    "portable-affine-u8-flat-json-domain-v2-pending",
    "pendingAttemptId",
    "pendingAttemptContentHash"
  );
  exactValue(
    attempt.pendingAttemptId,
    pendingIdentity.id,
    "pending attempt id"
  );
  exactValue(
    attempt.pendingAttemptContentHash,
    pendingIdentity.hash,
    "pending attempt hash"
  );
  exactValue(attempt.lastPhase, "paired-performance", "attempt last phase");

  const schedule = expectedSchedule();
  const processSummary = validateProcessLedgers(attempt, schedule);
  const inputClosure = validateAttemptInputClosure(attempt);
  const retainedSummary = validateRetainedEvidence(
    attempt,
    manifestResult.manifest
  );

  exactStructure(attempt.cleanup, {
    outerRootCreated: true,
    outerRootDeleted: true,
    cleanupFailureMessageSha256: null
  }, "attempt cleanup");
  exactValue(attempt.observationId, null, "attempt observation id");
  exactValue(
    attempt.observationContentHash,
    null,
    "attempt observation hash"
  );
  exactStructure(attempt.failure, {
    code: "PORTABLE_AFFINE_U8_MEMORY_MONITOR_REJECTED",
    classification: "instrumentation",
    retryAllowed: false,
    messageSha256: expectedFailureMessageSha256,
    causeMessageSha256: expectedFailureCauseSha256,
    benchmarkErrorCode: null
  }, "attempt failure");
  exactValue(
    sha256(Buffer.from("PORTABLE_AFFINE_U8_MEMORY_MONITOR_REJECTED", "utf8")),
    attempt.failure.messageSha256,
    "failure code hash mapping"
  );
  exactValue(
    sha256(Buffer.from("memory monitor 51 exit code is invalid", "utf8")),
    attempt.failure.causeMessageSha256,
    "failure cause hash mapping"
  );
  exactValue(
    attempt.processEvidenceComplete,
    true,
    "process evidence completeness"
  );
  exactStructure(attempt.authority, authority, "attempt authority");
  exactValue(
    attempt.requiredNextGate,
    attemptRequiredNextGate,
    "attempt next gate"
  );
  const attemptIdentity = identity(
    attempt,
    "portable-affine-u8-flat-json-domain-v2-attempt",
    "attemptId",
    "attemptContentHash"
  );
  exactValue(attempt.attemptId, expectedAttemptId, "attempt id");
  exactValue(
    attempt.attemptContentHash,
    expectedAttemptContentHash,
    "attempt content hash"
  );
  exactValue(attempt.attemptId, attemptIdentity.id, "recomputed attempt id");
  exactValue(
    attempt.attemptContentHash,
    attemptIdentity.hash,
    "recomputed attempt content hash"
  );
  invariant(
    !fs.existsSync(path.join(repositoryRoot, pendingRelativePath)),
    "v2 pending journal remains"
  );
  invariant(
    !fs.existsSync(path.join(repositoryRoot, observationRelativePath)),
    "v2 observation unexpectedly exists"
  );
  publicSafe(attempt, "terminal attempt");
  return Object.freeze({
    attempt: Object.freeze({
      ...evidence,
      attemptId: attempt.attemptId,
      attemptContentHash: attempt.attemptContentHash,
      sourceRevision: attempt.sourceRevision,
      evidenceCommit: expectedAttemptEvidenceCommit,
      status: attempt.status,
      startedAtUtc: attempt.startedAtUtc,
      completedAtUtc: attempt.completedAtUtc
    }),
    inputClosure,
    processSummary,
    retainedSummary,
    independentDecision: Object.freeze({
      terminalAttemptValid: true,
      maximumAttemptCount,
      maximumRetryCount,
      sameExperimentRetryAllowed: false,
      pendingJournalAbsent: true,
      observationAbsent: true,
      cleanupVerified: true,
      processEvidenceComplete: true,
      serializerDefectCrossed: true,
      qualityPayloadPresent: true,
      qualityPayloadParseable: true,
      qualityNumericDomainsValid: true,
      fullFrozenSuiteCompleted: false,
      performanceProcessCount: processSummary.performanceBenchmarkProcessCount,
      requiredPerformanceProcessCount: maximumMonitorProcessCount,
      performanceSummariesPresent: false,
      qualityThresholdVerdictAvailable: false,
      performanceThresholdVerdictAvailable: false,
      boundedQualityClaimSupported: false,
      boundedPerformanceClaimSupported: false,
      productPromotionAllowed: false,
      trainingAuthorized: false,
      releaseAuthorized: false,
      campaignCounterMayBeIncremented: false
    })
  });
}

function receiptIdentity(value) {
  return identity(
    value,
    "portable-affine-u8-flat-json-domain-v2-verification",
    "receiptId",
    "receiptContentHash"
  );
}

function finalizeReceipt(value) {
  const receipt = receiptIdentity(value);
  return Object.freeze({
    ...value,
    receiptId: receipt.id,
    receiptContentHash: receipt.hash
  });
}

function validateFileEvidence(value, expectedPath, label) {
  exactKeys(value, ["path", "bytes", "sha256"], label);
  exactValue(value.path, expectedPath, `${label} path`);
  safeInteger(value.bytes, `${label} bytes`, 1, maximumInputBytes);
  invariant(sha256Pattern.test(value.sha256), `${label} hash is invalid`);
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
  ], "v2 verification receipt");
  exactValue(value.schema, schema, "verification schema");
  exactValue(value.receiptType, receiptType, "verification receipt type");
  exactValue(value.experimentId, experimentId, "verification experiment");
  exactValue(
    value.status,
    "verified-terminal-instrumentation-failure",
    "verification status"
  );
  invariant(
    utcPattern.test(value.verifiedAtUtc) &&
      Number.isFinite(Date.parse(value.verifiedAtUtc)) &&
      revisionPattern.test(value.verificationSourceRevision),
    "verification timestamp or revision is invalid"
  );
  exactValue(
    value.registrationCommit,
    expectedRegistrationCommit,
    "receipt registration commit"
  );
  exactValue(
    value.implementationCommit,
    expectedImplementationCommit,
    "receipt implementation commit"
  );
  exactValue(
    value.attemptEvidenceCommit,
    expectedAttemptEvidenceCommit,
    "receipt attempt commit"
  );
  invariant(revisionPattern.test(value.verifierCommit), "verifier commit is invalid");
  exactValue(
    value.preregistrationSha256,
    expectedManifestSha256,
    "receipt preregistration hash"
  );
  exactValue(
    value.inputs.length,
    verificationInputPaths.length,
    "verification input count"
  );
  value.inputs.forEach((entry, index) => {
    validateFileEvidence(
      entry,
      verificationInputPaths[index],
      `verification input ${index}`
    );
    exactStructure(
      entry,
      fileEvidence(verificationInputPaths[index]),
      `verification input ${index} current identity`
    );
  });
  exactStructure(
    value.independentSummary,
    validateTerminalAttempt(),
    "independent terminal summary"
  );
  exactStructure(value.authority, authority, "verification authority");
  exactValue(value.requiredNextGate, requiredNextGate, "verification next gate");
  const identityValue = receiptIdentity(value);
  exactValue(value.receiptId, identityValue.id, "verification receipt id");
  exactValue(
    value.receiptContentHash,
    identityValue.hash,
    "verification receipt content hash"
  );
  publicSafe(value, "v2 verification receipt");
  return value;
}

function buildReceipt() {
  invariant(!fs.existsSync(verificationPath), "verification receipt already exists");
  assertInputClosureCommitted();
  const manifestResult = validateManifestFile();
  const revision = sourceRevision();
  const implementation = commitForPaths(
    [runnerRelativePath, runnerTestRelativePath],
    "v2 implementation commit"
  );
  const attemptCommit = commitForPaths(
    [attemptRelativePath],
    "v2 attempt evidence commit"
  );
  const verifierCommit = commitForPaths(
    [verifierRelativePath, verifierTestRelativePath, isolationTestRelativePath],
    "v2 verifier commit"
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
    experimentId,
    status: "verified-terminal-instrumentation-failure",
    verifiedAtUtc: new Date().toISOString(),
    verificationSourceRevision: revision,
    registrationCommit: manifestResult.registrationCommit,
    implementationCommit: implementation,
    attemptEvidenceCommit: attemptCommit,
    verifierCommit,
    preregistrationSha256: expectedManifestSha256,
    inputs: verificationInputPaths.map(fileEvidence),
    independentSummary: validateTerminalAttempt(),
    authority,
    requiredNextGate
  });
  return validateReceipt(receipt);
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
    "usage: node vector-portable-affine-u8-json-domain-v2-verification.js " +
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
    terminalAttemptId:
      result.receipt.independentSummary.attempt.attemptId,
    serializerDefectCrossed:
      result.receipt.independentSummary.independentDecision
        .serializerDefectCrossed,
    fullFrozenSuiteCompleted:
      result.receipt.independentSummary.independentDecision
        .fullFrozenSuiteCompleted,
    campaignCounterMayBeIncremented:
      result.receipt.authority.campaignCounterMayBeIncremented
  })}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error
        ? error.message
        : "v2 independent verification failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  attemptRelativePath,
  authority,
  buildReceipt,
  canonicalPrettyBytes,
  expectedAttemptContentHash,
  expectedAttemptFileSha256,
  expectedAttemptId,
  expectedAttemptInputPaths,
  expectedSchedule,
  fileEvidence,
  finalizeReceipt,
  finiteInDomain,
  loadTerminalAttempt,
  maximumAttemptCount,
  maximumBenchmarkProcessCount,
  maximumMonitorProcessCount,
  maximumRetryCount,
  receiptIdentity,
  requiredNextGate,
  schema,
  validateQualityPayload,
  validateReceipt,
  validateReceiptFile,
  validateTerminalAttempt,
  verificationInputPaths,
  verificationPath,
  verificationRelativePath,
  writeReceipt
});
