"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const vm = require("node:vm");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate, syncDirectory } = require("./durable-files.js");
const {
  productionLineageReader
} = require("./clean-history-lineage.js");
const {
  defaultPath: preregistrationPath,
  expectedManifestSha256,
  experimentId,
  validateManifestFile
} = require("./vector-portable-affine-u8-successor-preregistration.js");
const {
  readGitBlob,
  validateGitInput
} = require("./vector-historical-git-input.js");

const pendingSchema =
  "tinyrustlm.portable_affine_u8_flat_successor_pending_attempt.v1";
const attemptSchema =
  "tinyrustlm.portable_affine_u8_flat_successor_attempt.v1";
const observationSchema =
  "tinyrustlm.portable_affine_u8_flat_successor_observation.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationRelativePath = path.relative(
  repositoryRoot,
  preregistrationPath
).replaceAll("\\", "/");
const runnerRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-successor-observation.js";
const runnerTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-successor-observation.test.js";
const pendingRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-successor-pending-attempt-v1.json";
const pendingPath = path.join(repositoryRoot, pendingRelativePath);
const attemptDirectoryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-successor-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptDirectoryRelativePath);
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-successor-observation-v1.json";
const observationPath = path.join(repositoryRoot, observationRelativePath);
const workspaceLockRelativePath = "Cargo.lock";
const maximumEvidenceBytes = 64 * 1024 * 1024;
const maximumInputBytes = 64 * 1024 * 1024;
const maximumBenchmarkProcessCount = 77;
const maximumMonitorProcessCount = 60;
const overallTimeoutMilliseconds = 3600000;
const emptySha256 = sha256(Buffer.alloc(0));
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const safeFailureCodePattern = /^[A-Z][A-Z0-9_]{2,95}$/u;
const safeSpawnCodePattern = /^[A-Z0-9_]{1,32}$/u;
const safeSignalPattern = /^[A-Z][A-Z0-9]{1,31}$/u;
const safeBenchmarkErrorPattern = /^[a-z0-9-]{1,96}$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;

function loadFrozenSubject() {
  const filename = require.resolve("./vector-portable-affine-u8-observation.js");
  const source = fs.readFileSync(filename, "utf8");
  const augmentation = `
module.exports = Object.freeze({
  ...module.exports,
  createOwnedRoot,
  executeContract,
  executeCorruptionSuite,
  executeCrashRecoverySuite,
  executePerformanceSuite,
  executeQuality,
  materializeDataset,
  prepareObservationPrerequisites,
  removeOwnedRoot,
  validateBuildEvidence,
  validateBuildVerificationEvidence,
  validateCorruptionRecord,
  validateCrashRecoveryRecord,
  validateExternalDatasetEvidence,
  verifyBuildAndWasm,
  writeMemoryMonitorScript
});
`;
  const compiled = vm.compileFunction(
    `${source}\n${augmentation}`,
    ["exports", "require", "module", "__filename", "__dirname"],
    { filename }
  );
  const loaded = { exports: {} };
  compiled(
    loaded.exports,
    createRequire(filename),
    loaded,
    filename,
    path.dirname(filename)
  );
  return loaded.exports;
}

// The terminal runner is immutable evidence. Augmenting its lexical exports in
// memory lets this successor reuse the exact verified phase implementation.
const subject = loadFrozenSubject();

const successorSpecificInputs = Object.freeze([
  preregistrationRelativePath,
  "tinyrustlm/tools/vector-portable-affine-u8-successor-preregistration.js",
  "tinyrustlm/tests/vector-portable-affine-u8-successor-preregistration.test.js",
  runnerRelativePath,
  runnerTestRelativePath,
  "tinyrustlm/tools/vector-diagnostic-pending-journal.js",
  "tinyrustlm/tests/vector-diagnostic-pending-journal.test.js",
  "tinyrustlm/tests/vector-experiment-isolation.test.js"
]);
const inputPaths = Object.freeze([
  ...new Set([...successorSpecificInputs, ...subject.inputPaths])
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
  "Independently verify any committed successor observation before making " +
  "a bounded research claim. Preserve a terminal attempt without retry and " +
  "preregister a distinct successor before any later outcome execution.";

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

function identity(value, prefix, idField, hashField) {
  const body = { ...value };
  delete body[idField];
  delete body[hashField];
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `${prefix}-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizeIdentity(value, prefix, idField, hashField) {
  const result = identity(value, prefix, idField, hashField);
  return Object.freeze({
    ...value,
    [idField]: result.id,
    [hashField]: result.hash
  });
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
    `repository input is invalid: ${relativePath}`
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

function fileEvidenceAtRevision(relativePath, revision) {
  invariant(relativePathPattern.test(relativePath), "historical path is unsafe");
  invariant(revisionPattern.test(revision), "historical revision is invalid");
  const bytes = readGitBlob(
    repositoryRoot,
    revision,
    relativePath,
    maximumInputBytes
  );
  invariant(
    bytes.length > 0 && bytes.length <= maximumInputBytes,
    `historical input failed: ${relativePath}`
  );
  return Object.freeze({
    path: relativePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

function git(argumentsList, label, allowFailure = false) {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    env: subject.offlineEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024
  });
  invariant(result.error === undefined, `${label} spawn failed`);
  if (!allowFailure) {
    invariant(
      result.status === 0 &&
        result.signal === null &&
        result.stderr === "",
      `${label} failed`
    );
  }
  return result;
}

function currentSourceRevision() {
  const revision = productionLineageReader().headRevision();
  invariant(revisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function assertInputClosureCommitted(paths = inputPaths) {
  invariant(new Set(paths).size === paths.length, "input closure has duplicates");
  for (const relativePath of paths) {
    resolveRepositoryFile(relativePath);
    const tracked = git(
      ["ls-files", "--error-unmatch", "--", relativePath],
      `tracked input ${relativePath}`,
      true
    );
    invariant(tracked.status === 0, `input is not tracked: ${relativePath}`);
  }
  const status = git(
    ["status", "--porcelain=v1", "--", ...paths],
    "successor input status"
  );
  exactValue(status.stdout, "", "successor input closure status");
}

function implementationCommit(registrationCommit, revision) {
  invariant(
    revisionPattern.test(registrationCommit) &&
      revisionPattern.test(revision),
    "successor commit identity is invalid"
  );
  const history = productionLineageReader();
  const implementation = history.lastChangeCommit([
    runnerRelativePath,
    runnerTestRelativePath
  ]);
  invariant(
    revisionPattern.test(implementation) &&
      implementation !== registrationCommit,
    "successor implementation commit is invalid"
  );
  for (const [ancestor, descendant, label] of [
    [registrationCommit, implementation, "registration-to-implementation"],
    [implementation, revision, "implementation-to-source"]
  ]) {
    exactValue(history.isAncestor(ancestor, descendant), true, `${label} ancestry`);
  }
  return implementation;
}

function implementationCommitAtRevision(registrationCommit, revision) {
  const history = productionLineageReader();
  const implementation = history.lastChangeCommit(
    [runnerRelativePath, runnerTestRelativePath],
    revision
  );
  invariant(
    revisionPattern.test(implementation) &&
      implementation !== registrationCommit,
    "historical implementation commit is invalid"
  );
  exactValue(
    history.isAncestor(registrationCommit, implementation),
    true,
    "historical registration ancestry"
  );
  return implementation;
}

function pendingIdentity(value) {
  return identity(
    value,
    "portable-affine-u8-flat-successor-pending",
    "pendingAttemptId",
    "pendingAttemptContentHash"
  );
}

function finalizePendingAttempt(value) {
  return finalizeIdentity(
    value,
    "portable-affine-u8-flat-successor-pending",
    "pendingAttemptId",
    "pendingAttemptContentHash"
  );
}

function validatePendingAttempt(value) {
  exactKeys(value, [
    "schema",
    "experimentId",
    "attemptOrdinal",
    "previousAttemptId",
    "startedAtUtc",
    "sourceRevision",
    "preregistrationSha256",
    "maximumBenchmarkProcessCount",
    "maximumMonitorProcessCount",
    "benchmarkProcessCountAtJournalWrite",
    "monitorProcessCountAtJournalWrite",
    "setupStartedAtJournalWrite",
    "pendingAttemptId",
    "pendingAttemptContentHash"
  ], "successor pending attempt");
  exactValue(value.schema, pendingSchema, "pending schema");
  exactValue(value.experimentId, experimentId, "pending experimentId");
  safeInteger(value.attemptOrdinal, "pending attempt ordinal", 1, 2);
  invariant(
    value.previousAttemptId === null ||
      /^portable-affine-u8-flat-successor-attempt-[a-f0-9]{16}$/u.test(
        value.previousAttemptId
      ),
    "pending predecessor is invalid"
  );
  invariant(
    utcPattern.test(value.startedAtUtc) &&
      Number.isFinite(Date.parse(value.startedAtUtc)) &&
      revisionPattern.test(value.sourceRevision) &&
      value.preregistrationSha256 === expectedManifestSha256,
    "pending temporal or source identity is invalid"
  );
  invariant(
    value.maximumBenchmarkProcessCount === maximumBenchmarkProcessCount &&
      value.maximumMonitorProcessCount === maximumMonitorProcessCount &&
      value.benchmarkProcessCountAtJournalWrite === 0 &&
      value.monitorProcessCountAtJournalWrite === 0 &&
      value.setupStartedAtJournalWrite === false,
    "pending pre-setup boundary is invalid"
  );
  const expected = pendingIdentity(value);
  exactValue(value.pendingAttemptId, expected.id, "pending attempt id");
  exactValue(
    value.pendingAttemptContentHash,
    expected.hash,
    "pending attempt content hash"
  );
  publicSafe(value, "successor pending attempt");
  return value;
}

function boundedEvidenceFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumEvidenceBytes,
    `${label} is not a bounded regular file`
  );
  return stat;
}

function loadPendingAttempt(filePath = pendingPath) {
  boundedEvidenceFile(filePath, "successor pending attempt");
  const bytes = fs.readFileSync(filePath);
  const pending = validatePendingAttempt(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(pending)),
    "pending attempt bytes are not canonical"
  );
  return Object.freeze({
    pending,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

function createPendingAttempt(body, filePath = pendingPath) {
  invariant(path.isAbsolute(filePath), "pending path must be absolute");
  invariant(!fs.existsSync(filePath), "successor pending attempt already exists");
  const pending = finalizePendingAttempt(body);
  validatePendingAttempt(pending);
  atomicCreate(filePath, canonicalPrettyBytes(pending));
  const reopened = loadPendingAttempt(filePath);
  exactValue(
    reopened.pending.pendingAttemptContentHash,
    pending.pendingAttemptContentHash,
    "written pending identity"
  );
  return reopened.pending;
}

function removePendingAttempt(expected, filePath = pendingPath) {
  const reopened = loadPendingAttempt(filePath);
  exactValue(
    reopened.pending.pendingAttemptContentHash,
    expected.pendingAttemptContentHash,
    "pending removal identity"
  );
  fs.rmSync(filePath, { force: false });
  syncDirectory(path.dirname(filePath));
  invariant(!fs.existsSync(filePath), "pending attempt removal failed");
}

async function runAfterPendingAttempt(body, operation, filePath = pendingPath) {
  invariant(typeof operation === "function", "pending operation is invalid");
  const pending = createPendingAttempt(body, filePath);
  return operation(pending);
}

function toBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.alloc(0);
}

function safeSpawnErrorCode(error) {
  return error !== null &&
    error !== undefined &&
    typeof error.code === "string" &&
    safeSpawnCodePattern.test(error.code)
    ? error.code
    : null;
}

function benchmarkErrorCode(stderr) {
  const text = stderr.toString("utf8");
  return /^[a-z0-9-]+\r?\n$/u.test(text) ? text.trim() : null;
}

function benchmarkDescriptor(argumentsList) {
  if (!Array.isArray(argumentsList) || argumentsList.length === 0) return null;
  const mode = argumentsList[0];
  if (mode === "--contract" && argumentsList.length === 1) {
    return Object.freeze({
      phase: "contract",
      mode: "contract",
      publicArguments: Object.freeze([])
    });
  }
  if (
    mode === "--corruption" &&
    argumentsList.length === 2 &&
    subject.corruptionCases.includes(argumentsList[1])
  ) {
    return Object.freeze({
      phase: "corruption",
      mode: "corruption",
      publicArguments: Object.freeze([argumentsList[1]])
    });
  }
  if (
    ["--crash", "--recover"].includes(mode) &&
    argumentsList.length === 2 &&
    subject.crashScenarios.some(
      (scenario) => scenario.scenarioId === argumentsList[1]
    )
  ) {
    return Object.freeze({
      phase: "crash-and-recovery",
      mode: mode.slice(2),
      publicArguments: Object.freeze([argumentsList[1]])
    });
  }
  if (mode === "--quality" && argumentsList.length === 1) {
    return Object.freeze({
      phase: "quality",
      mode: "quality",
      publicArguments: Object.freeze([])
    });
  }
  if (
    mode === "--performance" &&
    argumentsList.length === 3 &&
    subject.expectedLanes.some((lane) => lane.laneId === argumentsList[1]) &&
    ["candidate", "exact-full"].includes(argumentsList[2])
  ) {
    return Object.freeze({
      phase: "paired-performance",
      mode: "performance",
      publicArguments: Object.freeze([
        argumentsList[1],
        argumentsList[2]
      ])
    });
  }
  return null;
}

function isMonitorInvocation(argumentsList) {
  return Array.isArray(argumentsList) &&
    argumentsList.includes("-TargetProcessId") &&
    argumentsList.includes("-ProcessRoot") &&
    argumentsList.includes("-OutputPath") &&
    argumentsList.includes("-File");
}

function processRecord(
  ordinal,
  descriptor,
  processStarted,
  result,
  spawnError
) {
  const stdout = toBytes(result?.stdout);
  const stderr = toBytes(result?.stderr);
  return Object.freeze({
    ordinal,
    phase: descriptor.phase,
    mode: descriptor.mode,
    publicArguments: descriptor.publicArguments,
    processStarted,
    exitCode: Number.isInteger(result?.status)
      ? result.status
      : Number.isInteger(result?.exitCode)
        ? result.exitCode
        : null,
    signal: typeof result?.signal === "string" ? result.signal : null,
    spawnErrorCode: safeSpawnErrorCode(spawnError ?? result?.error),
    stdoutBytes: stdout.length,
    stdoutSha256: sha256(stdout),
    stderrBytes: stderr.length,
    stderrSha256: sha256(stderr),
    benchmarkErrorCode: benchmarkErrorCode(stderr)
  });
}

function monitorRecord(ordinal, processStarted, result, spawnError) {
  const stdout = toBytes(result?.stdout);
  const stderr = toBytes(result?.stderr);
  return Object.freeze({
    ordinal,
    phase: "paired-performance",
    mode: "memory-monitor",
    processStarted,
    exitCode: Number.isInteger(result?.status)
      ? result.status
      : Number.isInteger(result?.exitCode)
        ? result.exitCode
        : null,
    signal: typeof result?.signal === "string" ? result.signal : null,
    spawnErrorCode: safeSpawnErrorCode(spawnError ?? result?.error),
    stdoutBytes: stdout.length,
    stdoutSha256: sha256(stdout),
    stderrBytes: stderr.length,
    stderrSha256: sha256(stderr)
  });
}

function installProcessRecorder(processApi = childProcess) {
  const originalSpawnSync = processApi.spawnSync;
  const originalSpawn = processApi.spawn;
  const benchmarkRecords = [];
  const monitorRecords = [];
  let activeBenchmarkProcesses = 0;
  let maximumParallelBenchmarkProcesses = 0;
  let restored = false;

  processApi.spawnSync = function recordedSpawnSync(
    executable,
    argumentsList,
    options
  ) {
    const descriptor = benchmarkDescriptor(argumentsList);
    if (descriptor === null) {
      return originalSpawnSync.call(this, executable, argumentsList, options);
    }
    invariant(
      benchmarkRecords.length < maximumBenchmarkProcessCount,
      "benchmark process count exceeded preregistration"
    );
    const ordinal = benchmarkRecords.length + 1;
    activeBenchmarkProcesses += 1;
    maximumParallelBenchmarkProcesses = Math.max(
      maximumParallelBenchmarkProcesses,
      activeBenchmarkProcesses
    );
    try {
      const result = originalSpawnSync.call(
        this,
        executable,
        argumentsList,
        options
      );
      benchmarkRecords.push(processRecord(
        ordinal,
        descriptor,
        result?.pid !== undefined,
        result,
        result?.error
      ));
      return result;
    } catch (error) {
      benchmarkRecords.push(processRecord(
        ordinal,
        descriptor,
        false,
        null,
        error
      ));
      throw error;
    } finally {
      activeBenchmarkProcesses -= 1;
    }
  };

  processApi.spawn = function recordedSpawn(
    executable,
    argumentsList,
    options
  ) {
    const descriptor = benchmarkDescriptor(argumentsList);
    const monitorInvocation = isMonitorInvocation(argumentsList);
    if (descriptor === null && !monitorInvocation) {
      return originalSpawn.call(this, executable, argumentsList, options);
    }
    const collection = descriptor === null ? monitorRecords : benchmarkRecords;
    const maximum = descriptor === null
      ? maximumMonitorProcessCount
      : maximumBenchmarkProcessCount;
    invariant(
      collection.length < maximum,
      "recorded process count exceeded preregistration"
    );
    const ordinal = collection.length + 1;
    const slot = collection.push(null) - 1;
    if (descriptor !== null) {
      activeBenchmarkProcesses += 1;
      maximumParallelBenchmarkProcesses = Math.max(
        maximumParallelBenchmarkProcesses,
        activeBenchmarkProcesses
      );
    }
    let child;
    try {
      child = originalSpawn.call(this, executable, argumentsList, options);
    } catch (error) {
      collection[slot] = descriptor === null
        ? monitorRecord(ordinal, false, null, error)
        : processRecord(ordinal, descriptor, false, null, error);
      if (descriptor !== null) activeBenchmarkProcesses -= 1;
      throw error;
    }
    const stdout = [];
    const stderr = [];
    let spawnError = null;
    child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (exitCode, signal) => {
      const result = {
        exitCode,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr)
      };
      collection[slot] = descriptor === null
        ? monitorRecord(
            ordinal,
            Number.isSafeInteger(child.pid),
            result,
            spawnError
          )
        : processRecord(
            ordinal,
            descriptor,
            Number.isSafeInteger(child.pid),
            result,
            spawnError
          );
      if (descriptor !== null) activeBenchmarkProcesses -= 1;
    });
    return child;
  };

  const snapshot = () => {
    invariant(
      benchmarkRecords.every((record) => record !== null) &&
        monitorRecords.every((record) => record !== null) &&
        activeBenchmarkProcesses === 0,
      "recorded processes have not all terminated"
    );
    return Object.freeze({
      benchmarkRecords: Object.freeze([...benchmarkRecords]),
      monitorRecords: Object.freeze([...monitorRecords]),
      maximumParallelBenchmarkProcesses
    });
  };

  const restore = () => {
    if (restored) return;
    processApi.spawnSync = originalSpawnSync;
    processApi.spawn = originalSpawn;
    restored = true;
  };

  return Object.freeze({ restore, snapshot });
}

function expectedBenchmarkSchedule() {
  const schedule = [
    Object.freeze({
      phase: "contract",
      mode: "contract",
      publicArguments: Object.freeze([]),
      exitCode: 0
    })
  ];
  for (const caseId of subject.corruptionCases) {
    schedule.push(Object.freeze({
      phase: "corruption",
      mode: "corruption",
      publicArguments: Object.freeze([caseId]),
      exitCode: 0
    }));
  }
  for (const scenario of subject.crashScenarios) {
    schedule.push(Object.freeze({
      phase: "crash-and-recovery",
      mode: "crash",
      publicArguments: Object.freeze([scenario.scenarioId]),
      exitCode: 74
    }));
    schedule.push(Object.freeze({
      phase: "crash-and-recovery",
      mode: "recover",
      publicArguments: Object.freeze([scenario.scenarioId]),
      exitCode: 0
    }));
  }
  schedule.push(Object.freeze({
    phase: "quality",
    mode: "quality",
    publicArguments: Object.freeze([]),
    exitCode: 0
  }));
  for (const [laneOrdinal, lane] of subject.expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const method of methods) {
        schedule.push(Object.freeze({
          phase: "paired-performance",
          mode: "performance",
          publicArguments: Object.freeze([lane.laneId, method]),
          exitCode: 0
        }));
      }
    }
  }
  invariant(
    schedule.length === maximumBenchmarkProcessCount,
    "benchmark schedule count drifted"
  );
  return Object.freeze(schedule);
}

const benchmarkSchedule = expectedBenchmarkSchedule();

function validateProcessRecord(value, label, allowFailure) {
  exactKeys(value, [
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
  safeInteger(value.ordinal, `${label}.ordinal`, 1, maximumBenchmarkProcessCount);
  invariant(
    [
      "contract",
      "corruption",
      "crash-and-recovery",
      "quality",
      "paired-performance"
    ].includes(value.phase) &&
      ["contract", "corruption", "crash", "recover", "quality", "performance"]
        .includes(value.mode) &&
      Array.isArray(value.publicArguments) &&
      value.publicArguments.every(
        (argument) => typeof argument === "string" && argument.length <= 128
      ) &&
      typeof value.processStarted === "boolean",
    `${label} descriptor is invalid`
  );
  invariant(
    value.exitCode === null || Number.isInteger(value.exitCode),
    `${label}.exitCode is invalid`
  );
  invariant(
    value.signal === null || safeSignalPattern.test(value.signal),
    `${label}.signal is invalid`
  );
  invariant(
    value.spawnErrorCode === null ||
      safeSpawnCodePattern.test(value.spawnErrorCode),
    `${label}.spawnErrorCode is invalid`
  );
  safeInteger(value.stdoutBytes, `${label}.stdoutBytes`);
  safeInteger(value.stderrBytes, `${label}.stderrBytes`);
  invariant(
    sha256Pattern.test(value.stdoutSha256) &&
      sha256Pattern.test(value.stderrSha256) &&
      (value.benchmarkErrorCode === null ||
        safeBenchmarkErrorPattern.test(value.benchmarkErrorCode)),
    `${label} output identity is invalid`
  );
  if (!allowFailure) {
    invariant(
      value.processStarted === true &&
        value.signal === null &&
        value.spawnErrorCode === null &&
        value.benchmarkErrorCode === null,
      `${label} complete process state is invalid`
    );
  }
}

function validateMonitorRecord(value, label, allowFailure) {
  exactKeys(value, [
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
  safeInteger(value.ordinal, `${label}.ordinal`, 1, maximumMonitorProcessCount);
  exactValue(value.phase, "paired-performance", `${label}.phase`);
  exactValue(value.mode, "memory-monitor", `${label}.mode`);
  invariant(typeof value.processStarted === "boolean", `${label}.processStarted`);
  invariant(
    value.exitCode === null || Number.isInteger(value.exitCode),
    `${label}.exitCode`
  );
  invariant(
    value.signal === null || safeSignalPattern.test(value.signal),
    `${label}.signal`
  );
  invariant(
    value.spawnErrorCode === null ||
      safeSpawnCodePattern.test(value.spawnErrorCode),
    `${label}.spawnErrorCode`
  );
  safeInteger(value.stdoutBytes, `${label}.stdoutBytes`);
  safeInteger(value.stderrBytes, `${label}.stderrBytes`);
  invariant(
    sha256Pattern.test(value.stdoutSha256) &&
      sha256Pattern.test(value.stderrSha256),
    `${label} output identity`
  );
  if (!allowFailure) {
    invariant(
      value.processStarted === true &&
        value.exitCode === 0 &&
        value.signal === null &&
        value.spawnErrorCode === null &&
        value.stdoutBytes === 0 &&
        value.stdoutSha256 === emptySha256 &&
        value.stderrBytes === 0 &&
        value.stderrSha256 === emptySha256,
      `${label} complete monitor state is invalid`
    );
  }
}

function validateCompleteProcessLedgers(
  benchmarkRecords,
  monitorRecords,
  phaseEvidence
) {
  invariant(
    Array.isArray(benchmarkRecords) &&
      benchmarkRecords.length === maximumBenchmarkProcessCount,
    "complete benchmark ledger count is invalid"
  );
  benchmarkRecords.forEach((record, index) => {
    const label = `benchmark process ${index + 1}`;
    validateProcessRecord(record, label, false);
    const expected = benchmarkSchedule[index];
    exactValue(record.ordinal, index + 1, `${label}.ordinal`);
    exactValue(record.phase, expected.phase, `${label}.phase`);
    exactValue(record.mode, expected.mode, `${label}.mode`);
    exactStructure(
      record.publicArguments,
      expected.publicArguments,
      `${label}.publicArguments`
    );
    exactValue(record.exitCode, expected.exitCode, `${label}.exitCode`);
    exactValue(record.stderrBytes, 0, `${label}.stderrBytes`);
    exactValue(record.stderrSha256, emptySha256, `${label}.stderrSha256`);
    if (record.mode === "crash") {
      exactValue(record.stdoutBytes, 0, `${label}.stdoutBytes`);
      exactValue(record.stdoutSha256, emptySha256, `${label}.stdoutSha256`);
    } else {
      safeInteger(record.stdoutBytes, `${label}.stdoutBytes`, 1);
    }
  });
  invariant(
    Array.isArray(monitorRecords) &&
      monitorRecords.length === maximumMonitorProcessCount,
    "complete monitor ledger count is invalid"
  );
  monitorRecords.forEach((record, index) => {
    validateMonitorRecord(record, `monitor process ${index + 1}`, false);
    exactValue(record.ordinal, index + 1, `monitor process ${index + 1} ordinal`);
  });

  exactValue(
    benchmarkRecords[0].stdoutSha256,
    phaseEvidence.contractExecution.stdoutSha256,
    "contract ledger binding"
  );
  phaseEvidence.corruptionRecords.forEach((record, index) => {
    const ledger = benchmarkRecords[1 + index];
    exactValue(ledger.stdoutSha256, record.stdoutSha256, "corruption stdout binding");
    exactValue(ledger.stderrSha256, record.stderrSha256, "corruption stderr binding");
  });
  phaseEvidence.crashRecoveries.forEach((record, index) => {
    const crash = benchmarkRecords[8 + index * 2];
    const recovery = benchmarkRecords[9 + index * 2];
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
  exactValue(
    benchmarkRecords[16].stdoutSha256,
    phaseEvidence.qualityExecution.stdoutSha256,
    "quality stdout binding"
  );
  exactValue(
    benchmarkRecords[16].stderrSha256,
    phaseEvidence.qualityExecution.stderrSha256,
    "quality stderr binding"
  );
  phaseEvidence.performanceRecords.forEach((record, index) => {
    const benchmark = benchmarkRecords[17 + index];
    const monitor = monitorRecords[index];
    exactValue(benchmark.stdoutSha256, record.stdoutSha256, "performance stdout binding");
    exactValue(benchmark.stderrSha256, record.stderrSha256, "performance stderr binding");
    exactValue(
      monitor.stdoutSha256,
      record.monitorStdoutSha256,
      "monitor stdout binding"
    );
    exactValue(
      monitor.stderrSha256,
      record.monitorStderrSha256,
      "monitor stderr binding"
    );
  });
}

function validateFileEvidence(value, expectedPath, label) {
  exactKeys(value, ["path", "bytes", "sha256"], label);
  exactValue(value.path, expectedPath, `${label}.path`);
  safeInteger(value.bytes, `${label}.bytes`, 1, maximumInputBytes);
  invariant(sha256Pattern.test(value.sha256), `${label}.sha256 is invalid`);
}

function inputSha256(inputs, expectedPath) {
  const matches = inputs.filter((entry) => entry.path === expectedPath);
  invariant(matches.length === 1, `input ${expectedPath} is not unique`);
  invariant(
    sha256Pattern.test(matches[0].sha256),
    `input ${expectedPath} identity is invalid`
  );
  return matches[0].sha256;
}

function validateTool(value, label) {
  exactKeys(value, ["name", "version", "binaryBytes", "binarySha256"], label);
  invariant(
    typeof value.name === "string" &&
      typeof value.version === "string" &&
      value.version.length > 0 &&
      value.version.length <= 256,
    `${label} descriptor is invalid`
  );
  safeInteger(value.binaryBytes, `${label}.binaryBytes`, 1);
  invariant(sha256Pattern.test(value.binarySha256), `${label}.binarySha256`);
}

function observationIdentity(value) {
  return identity(
    value,
    "portable-affine-u8-flat-successor-observation",
    "observationId",
    "observationContentHash"
  );
}

function finalizeObservation(value) {
  return finalizeIdentity(
    value,
    "portable-affine-u8-flat-successor-observation",
    "observationId",
    "observationContentHash"
  );
}

function validatePhaseEvidence(value, expectedCargoLockSha256) {
  exactKeys(value, [
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
  ], "successor phase evidence");
  subject.validateBuildVerificationEvidence(value.buildVerification);
  subject.validateBuildEvidence(value.build, expectedCargoLockSha256);
  subject.validateContractOutput(value.contract);
  exactKeys(
    value.contractExecution,
    ["exitCode", "stdoutSha256", "stderrSha256"],
    "contract execution"
  );
  exactValue(value.contractExecution.exitCode, 0, "contract execution exit");
  invariant(
    sha256Pattern.test(value.contractExecution.stdoutSha256) &&
      value.contractExecution.stderrSha256 === emptySha256,
    "contract execution output identity is invalid"
  );
  invariant(
    Array.isArray(value.corruptionRecords) &&
      value.corruptionRecords.length === subject.corruptionCases.length,
    "corruption evidence is incomplete"
  );
  value.corruptionRecords.forEach((record, index) =>
    subject.validateCorruptionRecord(
      record,
      subject.corruptionCases[index],
      index
    ));
  invariant(
    Array.isArray(value.crashRecoveries) &&
      value.crashRecoveries.length === subject.crashScenarios.length,
    "recovery evidence is incomplete"
  );
  value.crashRecoveries.forEach((record, index) =>
    subject.validateCrashRecoveryRecord(
      record,
      subject.crashScenarios[index],
      index
    ));
  subject.validateQualityOutput(value.quality);
  exactKeys(value.qualityExecution, [
    "exitCode",
    "stdoutSha256",
    "stderrSha256",
    "managedFileCountBeforeDeletion",
    "processRootDeleted"
  ], "quality execution");
  invariant(
    value.qualityExecution.exitCode === 0 &&
      sha256Pattern.test(value.qualityExecution.stdoutSha256) &&
      value.qualityExecution.stderrSha256 === emptySha256 &&
      value.qualityExecution.managedFileCountBeforeDeletion === 1 &&
      value.qualityExecution.processRootDeleted === true,
    "quality execution evidence is invalid"
  );
  invariant(
    Array.isArray(value.performanceRecords) &&
      value.performanceRecords.length === maximumMonitorProcessCount,
    "performance records are incomplete"
  );
  let processIndex = 0;
  for (const [laneOrdinal, lane] of subject.expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const method of methods) {
        subject.validatePerformanceRecord(
          value.performanceRecords[processIndex],
          lane,
          repetition,
          method,
          processIndex + 1
        );
        processIndex += 1;
      }
    }
  }
  const summaries = subject.summarizePerformance(value.performanceRecords);
  invariant(
    Array.isArray(value.performanceSummaries) &&
      value.performanceSummaries.length === subject.expectedLanes.length,
    "performance summaries are incomplete"
  );
  value.performanceSummaries.forEach((summary, index) =>
    subject.validatePerformanceSummary(
      summary,
      summaries[index],
      subject.expectedLanes[index]
    ));
  return summaries;
}

function validateObservation(value) {
  exactKeys(value, [
    "schema",
    "experimentId",
    "benchmarkSubjectExperimentId",
    "benchmarkSubjectMethodId",
    "status",
    "verificationState",
    "attemptOrdinal",
    "previousAttemptId",
    "attemptStartedAtUtc",
    "pendingAttemptId",
    "pendingAttemptContentHash",
    "observedAtUtc",
    "sourceRevision",
    "successorPreregistration",
    "implementationCommit",
    "subjectPreregistration",
    "lineage",
    "inputs",
    "externalDataset",
    "tools",
    "platform",
    "phaseEvidence",
    "benchmarkProcessLedger",
    "memoryMonitorProcessLedger",
    "executionSummary",
    "thresholdDecision",
    "cleanup",
    "authority",
    "potentialAuthorityAfterIndependentVerification",
    "requiredNextGate",
    "observationId",
    "observationContentHash"
  ], "successor observation");
  exactValue(value.schema, observationSchema, "observation schema");
  exactValue(value.experimentId, experimentId, "observation experimentId");
  exactValue(
    value.benchmarkSubjectExperimentId,
    subject.expectedExperimentId,
    "benchmark subject experiment"
  );
  exactValue(
    value.benchmarkSubjectMethodId,
    subject.expectedMethodId,
    "benchmark subject method"
  );
  invariant(
    ["pass-awaiting-independent-verification", "fail-comparison-outcome-terminal"]
      .includes(value.status),
    "observation status is invalid"
  );
  exactValue(
    value.verificationState,
    "awaiting-independent-verification",
    "observation verification state"
  );
  safeInteger(value.attemptOrdinal, "observation attempt ordinal", 1, 2);
  invariant(
    value.previousAttemptId === null ||
      /^portable-affine-u8-flat-successor-attempt-[a-f0-9]{16}$/u.test(
        value.previousAttemptId
      ),
    "observation predecessor is invalid"
  );
  invariant(
    utcPattern.test(value.attemptStartedAtUtc) &&
      utcPattern.test(value.observedAtUtc) &&
      Date.parse(value.observedAtUtc) >= Date.parse(value.attemptStartedAtUtc) &&
      revisionPattern.test(value.sourceRevision),
    "observation temporal or source identity is invalid"
  );
  const pending = finalizePendingAttempt({
    schema: pendingSchema,
    experimentId,
    attemptOrdinal: value.attemptOrdinal,
    previousAttemptId: value.previousAttemptId,
    startedAtUtc: value.attemptStartedAtUtc,
    sourceRevision: value.sourceRevision,
    preregistrationSha256: expectedManifestSha256,
    maximumBenchmarkProcessCount,
    maximumMonitorProcessCount,
    benchmarkProcessCountAtJournalWrite: 0,
    monitorProcessCountAtJournalWrite: 0,
    setupStartedAtJournalWrite: false
  });
  exactValue(
    value.pendingAttemptId,
    pending.pendingAttemptId,
    "observation pending id"
  );
  exactValue(
    value.pendingAttemptContentHash,
    pending.pendingAttemptContentHash,
    "observation pending hash"
  );
  const identityResult = observationIdentity(value);
  exactValue(value.observationId, identityResult.id, "observation id");
  exactValue(
    value.observationContentHash,
    identityResult.hash,
    "observation content hash"
  );
  const manifestResult = validateManifestFile();
  const manifest = manifestResult.manifest;
  exactStructure(value.successorPreregistration, {
    path: preregistrationRelativePath,
    sha256: expectedManifestSha256,
    registrationCommit: manifestResult.registrationCommit
  }, "successor preregistration evidence");
  invariant(
    revisionPattern.test(value.implementationCommit),
    "implementation commit is invalid"
  );
  exactStructure(
    value.subjectPreregistration,
    {
      path: subject.preregistrationRelativePath,
      sha256:
        "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d",
      benchmarkSubjectExperimentId: subject.expectedExperimentId,
      benchmarkSubjectMethodId: subject.expectedMethodId
    },
    "subject preregistration evidence"
  );
  exactStructure(value.lineage, manifest.lineage, "observation lineage");
  invariant(
    Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "observation input closure is incomplete"
  );
  value.inputs.forEach((entry, index) => {
    validateFileEvidence(entry, inputPaths[index], `observation input ${index}`);
    validateGitInput(
      entry,
      repositoryRoot,
      value.sourceRevision,
      inputPaths[index],
      `observation input ${index}`,
      maximumInputBytes
    );
  });
  exactKeys(value.tools, ["node", "cargo", "rustc", "powershell"], "tools");
  Object.entries(value.tools).forEach(([name, tool]) =>
    validateTool(tool, `tool ${name}`));
  exactStructure(value.platform, {
    runtimeIdentifier: "win-x64",
    operatingSystem: "windows",
    architecture: "x64",
    rustTarget: "x86_64-pc-windows-msvc"
  }, "observation platform");
  subject.validateExternalDatasetEvidence(value.externalDataset);
  invariant(
    value.externalDataset.revision ===
      manifest.frozenSubject.externalDataset.revision &&
      value.externalDataset.tree === manifest.frozenSubject.externalDataset.tree,
    "external dataset preregistration binding is invalid"
  );
  const performanceSummaries = validatePhaseEvidence(
    value.phaseEvidence,
    inputSha256(value.inputs, workspaceLockRelativePath)
  );
  validateCompleteProcessLedgers(
    value.benchmarkProcessLedger,
    value.memoryMonitorProcessLedger,
    value.phaseEvidence
  );
  exactStructure(value.executionSummary, {
    platform: "win32-x64-local-reference-only",
    networkPolicy: "deny-all",
    benchmarkProcessCount: maximumBenchmarkProcessCount,
    memoryMonitorProcessCount: maximumMonitorProcessCount,
    maximumParallelBenchmarkProcesses: 1,
    completeFrozenSuiteExecuted: true,
    failFast: true,
    bestOfNUsed: false,
    outputRepairUsed: false,
    rawProcessOutputPersisted: false
  }, "execution summary");
  const qualityDecision =
    subject.evaluateQualityThresholds(value.phaseEvidence.quality);
  const performanceDecision =
    subject.evaluatePerformanceThresholds(performanceSummaries);
  const overallPassed = qualityDecision.passed && performanceDecision.passed;
  exactStructure(value.thresholdDecision, {
    status: overallPassed ? "pass" : "fail",
    outcomeTerminal: !overallPassed,
    quality: qualityDecision,
    performance: performanceDecision,
    resultDrivenThresholdChanges: false
  }, "threshold decision");
  exactValue(
    value.status,
    overallPassed
      ? "pass-awaiting-independent-verification"
      : "fail-comparison-outcome-terminal",
    "observation status binding"
  );
  exactStructure(value.cleanup, {
    processRootCount: 72,
    processRootsDeleted: 72,
    outerRootDeleted: true,
    rawProcessOutputPersisted: false,
    datasetLocatorPersisted: false
  }, "observation cleanup");
  exactStructure(value.authority, authority, "observation authority");
  exactStructure(
    value.potentialAuthorityAfterIndependentVerification,
    overallPassed
      ? manifest.authority.potentialAfterCompleteIndependentVerifiedPass
      : authority,
    "potential authority"
  );
  exactValue(value.requiredNextGate, requiredNextGate, "required next gate");
  publicSafe(value, "successor observation");
  return value;
}

function validateObservationFile(filePath = observationPath) {
  const stat = boundedEvidenceFile(filePath, "successor observation");
  const bytes = fs.readFileSync(filePath);
  const observation = validateObservation(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(observation)),
    "successor observation bytes are not canonical"
  );
  return Object.freeze({
    observation,
    bytes: stat.size,
    sha256: sha256(bytes)
  });
}

function attemptIdentity(value) {
  return identity(
    value,
    "portable-affine-u8-flat-successor-attempt",
    "attemptId",
    "attemptContentHash"
  );
}

function finalizeAttempt(value) {
  return finalizeIdentity(
    value,
    "portable-affine-u8-flat-successor-attempt",
    "attemptId",
    "attemptContentHash"
  );
}

function validateFailure(value, label) {
  exactKeys(value, [
    "code",
    "classification",
    "retryAllowed",
    "messageSha256",
    "causeMessageSha256",
    "benchmarkErrorCode"
  ], label);
  invariant(
    safeFailureCodePattern.test(value.code) &&
      [
        "instrumentation",
        "comparison-outcome",
        "unknown-outcome"
      ].includes(value.classification) &&
      typeof value.retryAllowed === "boolean" &&
      sha256Pattern.test(value.messageSha256) &&
      sha256Pattern.test(value.causeMessageSha256) &&
      (value.benchmarkErrorCode === null ||
        safeBenchmarkErrorPattern.test(value.benchmarkErrorCode)),
    `${label} is invalid`
  );
}

function validateAttempt(value) {
  exactKeys(value, [
    "schema",
    "experimentId",
    "attemptOrdinal",
    "previousAttemptId",
    "status",
    "startedAtUtc",
    "completedAtUtc",
    "sourceRevision",
    "successorPreregistration",
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
  ], "successor attempt");
  exactValue(value.schema, attemptSchema, "attempt schema");
  exactValue(value.experimentId, experimentId, "attempt experimentId");
  safeInteger(value.attemptOrdinal, "attempt ordinal", 1, 2);
  invariant(
    value.previousAttemptId === null ||
      /^portable-affine-u8-flat-successor-attempt-[a-f0-9]{16}$/u.test(
        value.previousAttemptId
      ),
    "attempt predecessor is invalid"
  );
  invariant(
    [
      "complete-awaiting-independent-verification",
      "fail-comparison-outcome-terminal",
      "fail-instrumentation-retryable",
      "fail-instrumentation-terminal",
      "fail-unknown-outcome-terminal"
    ].includes(value.status) &&
      utcPattern.test(value.startedAtUtc) &&
      utcPattern.test(value.completedAtUtc) &&
      Date.parse(value.completedAtUtc) >= Date.parse(value.startedAtUtc) &&
      revisionPattern.test(value.sourceRevision) &&
      revisionPattern.test(value.implementationCommit),
    "attempt core identity is invalid"
  );
  const manifestResult = validateManifestFile();
  exactStructure(value.successorPreregistration, {
    path: preregistrationRelativePath,
    sha256: expectedManifestSha256,
    registrationCommit: manifestResult.registrationCommit
  }, "attempt preregistration");
  const pending = finalizePendingAttempt({
    schema: pendingSchema,
    experimentId,
    attemptOrdinal: value.attemptOrdinal,
    previousAttemptId: value.previousAttemptId,
    startedAtUtc: value.startedAtUtc,
    sourceRevision: value.sourceRevision,
    preregistrationSha256: expectedManifestSha256,
    maximumBenchmarkProcessCount,
    maximumMonitorProcessCount,
    benchmarkProcessCountAtJournalWrite: 0,
    monitorProcessCountAtJournalWrite: 0,
    setupStartedAtJournalWrite: false
  });
  exactValue(value.pendingAttemptId, pending.pendingAttemptId, "attempt pending id");
  exactValue(
    value.pendingAttemptContentHash,
    pending.pendingAttemptContentHash,
    "attempt pending hash"
  );
  invariant(
    typeof value.lastPhase === "string" && value.lastPhase.length > 0,
    "attempt last phase is invalid"
  );
  invariant(
    Array.isArray(value.benchmarkProcessLedger) &&
      value.benchmarkProcessLedger.length <= maximumBenchmarkProcessCount,
    "attempt benchmark ledger is invalid"
  );
  value.benchmarkProcessLedger.forEach((record, index) => {
    validateProcessRecord(record, `attempt benchmark ${index + 1}`, true);
    exactValue(record.ordinal, index + 1, `attempt benchmark ${index + 1} ordinal`);
    const scheduled = benchmarkSchedule[index];
    exactValue(
      record.phase,
      scheduled.phase,
      `attempt benchmark ${index + 1} scheduled phase`
    );
    exactValue(
      record.mode,
      scheduled.mode,
      `attempt benchmark ${index + 1} scheduled mode`
    );
    exactStructure(
      record.publicArguments,
      scheduled.publicArguments,
      `attempt benchmark ${index + 1} scheduled arguments`
    );
  });
  invariant(
    Array.isArray(value.memoryMonitorProcessLedger) &&
      value.memoryMonitorProcessLedger.length <= maximumMonitorProcessCount,
    "attempt monitor ledger is invalid"
  );
  value.memoryMonitorProcessLedger.forEach((record, index) => {
    validateMonitorRecord(record, `attempt monitor ${index + 1}`, true);
    exactValue(record.ordinal, index + 1, `attempt monitor ${index + 1} ordinal`);
  });
  safeInteger(
    value.maximumParallelBenchmarkProcesses,
    "attempt maximum parallel benchmark processes",
    0,
    1
  );
  invariant(
    Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "attempt inputs are incomplete"
  );
  value.inputs.forEach((entry, index) =>
    validateFileEvidence(entry, inputPaths[index], `attempt input ${index}`));
  invariant(
    value.retainedEvidence === null || isPlainObject(value.retainedEvidence),
    "attempt retained evidence is invalid"
  );
  if (value.retainedEvidence !== null) {
    validateRetainedEvidence(
      value.retainedEvidence,
      inputSha256(value.inputs, workspaceLockRelativePath)
    );
  }
  exactKeys(value.cleanup, [
    "outerRootCreated",
    "outerRootDeleted",
    "cleanupFailureMessageSha256"
  ], "attempt cleanup");
  invariant(
    typeof value.cleanup.outerRootCreated === "boolean" &&
      typeof value.cleanup.outerRootDeleted === "boolean" &&
      (value.cleanup.cleanupFailureMessageSha256 === null ||
        sha256Pattern.test(value.cleanup.cleanupFailureMessageSha256)),
    "attempt cleanup is invalid"
  );
  invariant(
    typeof value.processEvidenceComplete === "boolean",
    "attempt process evidence completeness is invalid"
  );
  const complete = value.status ===
    "complete-awaiting-independent-verification";
  const terminalOutcome = value.status ===
    "fail-comparison-outcome-terminal";
  if (complete || (terminalOutcome && value.observationId !== null)) {
    invariant(
      /^portable-affine-u8-flat-successor-observation-[a-f0-9]{16}$/u.test(
        value.observationId
      ) &&
        sha256Pattern.test(value.observationContentHash) &&
        value.failure === null &&
        value.processEvidenceComplete === true,
      "attempt observation binding is invalid"
    );
  } else {
    invariant(
      value.observationId === null &&
        value.observationContentHash === null &&
        value.failure !== null,
      "failed attempt observation binding is invalid"
    );
    validateFailure(value.failure, "attempt failure");
    exactValue(
      value.failure.retryAllowed,
      value.status === "fail-instrumentation-retryable",
      "attempt retry status binding"
    );
  }
  exactStructure(value.authority, authority, "attempt authority");
  exactValue(value.requiredNextGate, requiredNextGate, "attempt required next gate");
  const expected = attemptIdentity(value);
  exactValue(value.attemptId, expected.id, "attempt id");
  exactValue(value.attemptContentHash, expected.hash, "attempt content hash");
  publicSafe(value, "successor attempt");
  return value;
}

function attemptFilePath(attempt) {
  return path.join(
    attemptDirectory,
    attempt.attemptContentHash.slice(0, 2),
    `${attempt.attemptContentHash}.json`
  );
}

function loadAttemptArchive() {
  if (!fs.existsSync(attemptDirectory)) return Object.freeze([]);
  const attempts = [];
  for (const prefix of fs.readdirSync(attemptDirectory).sort()) {
    invariant(/^[a-f0-9]{2}$/u.test(prefix), "attempt prefix is invalid");
    const prefixPath = path.join(attemptDirectory, prefix);
    const prefixStat = fs.lstatSync(prefixPath);
    invariant(
      prefixStat.isDirectory() && !prefixStat.isSymbolicLink(),
      "attempt prefix is invalid"
    );
    for (const name of fs.readdirSync(prefixPath).sort()) {
      invariant(/^[a-f0-9]{64}\.json$/u.test(name), "attempt filename is invalid");
      const filePath = path.join(prefixPath, name);
      boundedEvidenceFile(filePath, "successor attempt");
      const bytes = fs.readFileSync(filePath);
      const attempt = validateAttempt(JSON.parse(bytes.toString("utf8")));
      invariant(
        bytes.equals(canonicalPrettyBytes(attempt)),
        "attempt bytes are not canonical"
      );
      exactValue(
        name,
        `${attempt.attemptContentHash}.json`,
        "attempt filename identity"
      );
      exactValue(
        prefix,
        attempt.attemptContentHash.slice(0, 2),
        "attempt prefix identity"
      );
      attempts.push(Object.freeze({
        attempt,
        path: filePath,
        bytes: bytes.length,
        sha256: sha256(bytes)
      }));
    }
  }
  attempts.sort(
    (left, right) => left.attempt.attemptOrdinal - right.attempt.attemptOrdinal
  );
  invariant(attempts.length <= 2, "successor attempt limit exceeded");
  attempts.forEach((entry, index) => {
    exactValue(
      entry.attempt.attemptOrdinal,
      index + 1,
      "attempt archive ordinal"
    );
    exactValue(
      entry.attempt.previousAttemptId,
      index === 0 ? null : attempts[index - 1].attempt.attemptId,
      "attempt archive predecessor"
    );
    if (index > 0) {
      exactValue(
        attempts[index - 1].attempt.status,
        "fail-instrumentation-retryable",
        "attempt archive retry predecessor"
      );
    }
  });
  return Object.freeze(attempts);
}

function writeAttempt(attempt) {
  validateAttempt(attempt);
  const archive = loadAttemptArchive();
  exactValue(
    archive.length + 1,
    attempt.attemptOrdinal,
    "new attempt ordinal"
  );
  const filePath = attemptFilePath(attempt);
  atomicCreate(filePath, canonicalPrettyBytes(attempt));
  const reopened = loadAttemptArchive();
  exactValue(
    reopened.length,
    archive.length + 1,
    "written attempt archive count"
  );
  const result = reopened.at(-1);
  exactValue(
    result.attempt.attemptContentHash,
    attempt.attemptContentHash,
    "written attempt identity"
  );
  return result;
}

function failureEvidence(error, archive, processLedger) {
  const subjectFailure = subject.boundedFailure(error);
  const classification = [
    "instrumentation",
    "comparison-outcome"
  ].includes(subjectFailure.classification)
    ? subjectFailure.classification
    : "instrumentation";
  const priorInstrumentation = archive.filter(
    (entry) =>
      entry.attempt.status === "fail-instrumentation-retryable" ||
      entry.attempt.status === "fail-instrumentation-terminal"
  ).length;
  const retryAllowed =
    classification === "instrumentation" &&
    priorInstrumentation === 0 &&
    archive.length === 0;
  const latestBenchmarkError = [...processLedger]
    .reverse()
    .find((record) => record.benchmarkErrorCode !== null)
    ?.benchmarkErrorCode ?? null;
  return Object.freeze({
    code: safeFailureCodePattern.test(subjectFailure.code)
      ? subjectFailure.code
      : "PORTABLE_AFFINE_U8_SUCCESSOR_INFRASTRUCTURE_REJECTED",
    classification,
    retryAllowed,
    messageSha256: subjectFailure.messageSha256,
    causeMessageSha256: subjectFailure.causeMessageSha256,
    benchmarkErrorCode: latestBenchmarkError
  });
}

function retainedEvidence(state) {
  return Object.freeze({
    platform: state.platform,
    tools: state.tools,
    externalDataset: state.externalDataset,
    buildVerification: state.buildVerification,
    build: state.build,
    contractExecution: state.contractExecution,
    contract: state.contract,
    corruptionRecords: state.corruptionRecords,
    crashRecoveries: state.crashRecoveries,
    qualityExecution: state.qualityExecution,
    quality: state.quality,
    performanceRecords: state.performanceRecords,
    performanceSummaries: state.performanceSummaries
  });
}

function validateRetainedEvidence(value, expectedCargoLockSha256) {
  exactKeys(value, [
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
  if (value.platform !== null) {
    exactStructure(value.platform, {
      runtimeIdentifier: "win-x64",
      operatingSystem: "windows",
      architecture: "x64",
      rustTarget: "x86_64-pc-windows-msvc"
    }, "retained platform");
  }
  if (value.tools !== null) {
    exactKeys(value.tools, ["node", "cargo", "rustc", "powershell"], "retained tools");
    Object.entries(value.tools).forEach(([name, tool]) =>
      validateTool(tool, `retained tool ${name}`));
  }
  if (value.externalDataset !== null) {
    subject.validateExternalDatasetEvidence(value.externalDataset);
  }
  if (value.buildVerification !== null) {
    subject.validateBuildVerificationEvidence(value.buildVerification);
  }
  if (value.build !== null) {
    subject.validateBuildEvidence(value.build, expectedCargoLockSha256);
  }
  invariant(
    (value.contractExecution === null) === (value.contract === null),
    "retained contract pair is incomplete"
  );
  if (value.contract !== null) {
    subject.validateContractOutput(value.contract);
    exactKeys(
      value.contractExecution,
      ["exitCode", "stdoutSha256", "stderrSha256"],
      "retained contract execution"
    );
    invariant(
      value.contractExecution.exitCode === 0 &&
        sha256Pattern.test(value.contractExecution.stdoutSha256) &&
        value.contractExecution.stderrSha256 === emptySha256,
      "retained contract execution is invalid"
    );
  }
  invariant(
    Array.isArray(value.corruptionRecords) &&
      value.corruptionRecords.length <= subject.corruptionCases.length,
    "retained corruptions are invalid"
  );
  value.corruptionRecords.forEach((record, index) =>
    subject.validateCorruptionRecord(
      record,
      subject.corruptionCases[index],
      index
    ));
  invariant(
    Array.isArray(value.crashRecoveries) &&
      value.crashRecoveries.length <= subject.crashScenarios.length,
    "retained recoveries are invalid"
  );
  value.crashRecoveries.forEach((record, index) =>
    subject.validateCrashRecoveryRecord(
      record,
      subject.crashScenarios[index],
      index
    ));
  invariant(
    (value.qualityExecution === null) === (value.quality === null),
    "retained quality pair is incomplete"
  );
  if (value.quality !== null) {
    subject.validateQualityOutput(value.quality);
    exactKeys(value.qualityExecution, [
      "exitCode",
      "stdoutSha256",
      "stderrSha256",
      "managedFileCountBeforeDeletion",
      "processRootDeleted"
    ], "retained quality execution");
    invariant(
      value.qualityExecution.exitCode === 0 &&
        sha256Pattern.test(value.qualityExecution.stdoutSha256) &&
        value.qualityExecution.stderrSha256 === emptySha256 &&
        value.qualityExecution.managedFileCountBeforeDeletion === 1 &&
        value.qualityExecution.processRootDeleted === true,
      "retained quality execution is invalid"
    );
  }
  invariant(
    Array.isArray(value.performanceRecords) &&
      value.performanceRecords.length <= maximumMonitorProcessCount &&
      Array.isArray(value.performanceSummaries),
    "retained performance evidence is invalid"
  );
  let performanceIndex = 0;
  for (const [laneOrdinal, lane] of subject.expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const method of methods) {
        if (performanceIndex >= value.performanceRecords.length) break;
        subject.validatePerformanceRecord(
          value.performanceRecords[performanceIndex],
          lane,
          repetition,
          method,
          performanceIndex + 1
        );
        performanceIndex += 1;
      }
    }
  }
  if (value.performanceRecords.length === maximumMonitorProcessCount) {
    const summaries = subject.summarizePerformance(value.performanceRecords);
    invariant(
      value.performanceSummaries.length === subject.expectedLanes.length,
      "retained performance summaries are incomplete"
    );
    value.performanceSummaries.forEach((summary, index) =>
      subject.validatePerformanceSummary(
        summary,
        summaries[index],
        subject.expectedLanes[index]
      ));
  } else {
    exactValue(
      value.performanceSummaries.length,
      0,
      "partial performance summaries"
    );
  }
}

function buildObservation(
  pending,
  manifestResult,
  implementation,
  state,
  processSnapshot
) {
  const qualityDecision = subject.evaluateQualityThresholds(state.quality);
  const performanceDecision =
    subject.evaluatePerformanceThresholds(state.performanceSummaries);
  const overallPassed = qualityDecision.passed && performanceDecision.passed;
  const body = {
    schema: observationSchema,
    experimentId,
    benchmarkSubjectExperimentId: subject.expectedExperimentId,
    benchmarkSubjectMethodId: subject.expectedMethodId,
    status: overallPassed
      ? "pass-awaiting-independent-verification"
      : "fail-comparison-outcome-terminal",
    verificationState: "awaiting-independent-verification",
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    attemptStartedAtUtc: pending.startedAtUtc,
    pendingAttemptId: pending.pendingAttemptId,
    pendingAttemptContentHash: pending.pendingAttemptContentHash,
    observedAtUtc: new Date().toISOString(),
    sourceRevision: pending.sourceRevision,
    successorPreregistration: {
      path: preregistrationRelativePath,
      sha256: expectedManifestSha256,
      registrationCommit: manifestResult.registrationCommit
    },
    implementationCommit: implementation,
    subjectPreregistration: {
      path: subject.preregistrationRelativePath,
      sha256:
        "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d",
      benchmarkSubjectExperimentId: subject.expectedExperimentId,
      benchmarkSubjectMethodId: subject.expectedMethodId
    },
    lineage: manifestResult.manifest.lineage,
    inputs: state.inputs,
    externalDataset: state.externalDataset,
    tools: state.tools,
    platform: state.platform,
    phaseEvidence: {
      buildVerification: state.buildVerification,
      build: state.build,
      contractExecution: state.contractExecution,
      contract: state.contract,
      corruptionRecords: state.corruptionRecords,
      crashRecoveries: state.crashRecoveries,
      qualityExecution: state.qualityExecution,
      quality: state.quality,
      performanceRecords: state.performanceRecords,
      performanceSummaries: state.performanceSummaries
    },
    benchmarkProcessLedger: processSnapshot.benchmarkRecords,
    memoryMonitorProcessLedger: processSnapshot.monitorRecords,
    executionSummary: {
      platform: "win32-x64-local-reference-only",
      networkPolicy: "deny-all",
      benchmarkProcessCount: processSnapshot.benchmarkRecords.length,
      memoryMonitorProcessCount: processSnapshot.monitorRecords.length,
      maximumParallelBenchmarkProcesses:
        processSnapshot.maximumParallelBenchmarkProcesses,
      completeFrozenSuiteExecuted: true,
      failFast: true,
      bestOfNUsed: false,
      outputRepairUsed: false,
      rawProcessOutputPersisted: false
    },
    thresholdDecision: {
      status: overallPassed ? "pass" : "fail",
      outcomeTerminal: !overallPassed,
      quality: qualityDecision,
      performance: performanceDecision,
      resultDrivenThresholdChanges: false
    },
    cleanup: {
      processRootCount: 72,
      processRootsDeleted: 72,
      outerRootDeleted: true,
      rawProcessOutputPersisted: false,
      datasetLocatorPersisted: false
    },
    authority,
    potentialAuthorityAfterIndependentVerification:
      overallPassed
        ? manifestResult.manifest.authority
          .potentialAfterCompleteIndependentVerifiedPass
        : authority,
    requiredNextGate
  };
  const observation = finalizeObservation(body);
  validateObservation(observation);
  return observation;
}

function attemptForObservation(
  pending,
  manifestResult,
  implementation,
  inputs,
  observationResult
) {
  const observation = observationResult.observation;
  const complete = observation.status ===
    "pass-awaiting-independent-verification";
  return finalizeAttempt({
    schema: attemptSchema,
    experimentId,
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    status: complete
      ? "complete-awaiting-independent-verification"
      : "fail-comparison-outcome-terminal",
    startedAtUtc: pending.startedAtUtc,
    completedAtUtc: observation.observedAtUtc,
    sourceRevision: pending.sourceRevision,
    successorPreregistration: {
      path: preregistrationRelativePath,
      sha256: expectedManifestSha256,
      registrationCommit: manifestResult.registrationCommit
    },
    implementationCommit: implementation,
    pendingAttemptId: pending.pendingAttemptId,
    pendingAttemptContentHash: pending.pendingAttemptContentHash,
    lastPhase: "threshold-decision-and-observation-commit",
    benchmarkProcessLedger: observation.benchmarkProcessLedger,
    memoryMonitorProcessLedger: observation.memoryMonitorProcessLedger,
    maximumParallelBenchmarkProcesses:
      observation.executionSummary.maximumParallelBenchmarkProcesses,
    inputs,
    retainedEvidence: null,
    cleanup: {
      outerRootCreated: true,
      outerRootDeleted: true,
      cleanupFailureMessageSha256: null
    },
    observationId: observation.observationId,
    observationContentHash: observation.observationContentHash,
    failure: null,
    processEvidenceComplete: true,
    authority,
    requiredNextGate
  });
}

async function executeAttempt(pending, archive) {
  const recorder = installProcessRecorder();
  const startedMilliseconds = Date.now();
  let manifestResult = null;
  let implementation = pending.sourceRevision;
  let phase = "source-dataset-tool-validation";
  let outerRoot = null;
  let outerRootDeleted = false;
  let cleanupFailureMessageSha256 = null;
  const state = {
    inputs: [],
    platform: null,
    tools: null,
    externalDataset: null,
    buildVerification: null,
    build: null,
    contractExecution: null,
    contract: null,
    corruptionRecords: [],
    crashRecoveries: [],
    qualityExecution: null,
    quality: null,
    performanceRecords: [],
    performanceSummaries: []
  };
  try {
    manifestResult = validateManifestFile();
    invariant(
      manifestResult.registrationCommit !== null,
      "successor preregistration is not committed"
    );
    assertInputClosureCommitted();
    exactValue(
      currentSourceRevision(),
      pending.sourceRevision,
      "pending source revision"
    );
    implementation = implementationCommit(
      manifestResult.registrationCommit,
      pending.sourceRevision
    );
    state.inputs = inputPaths.map(fileEvidence);
    const prerequisites =
      subject.prepareObservationPrerequisites(pending.sourceRevision);
    state.platform = prerequisites.platform;
    state.tools = prerequisites.tools;
    state.externalDataset = prerequisites.dataset.publicIdentity;

    phase = "native-tests-clippy-docs-wasm-build-and-execution";
    outerRoot = subject.createOwnedRoot();
    const datasetRoot = await subject.materializeDataset(
      prerequisites.dataset,
      outerRoot
    );
    const monitorScript = subject.writeMemoryMonitorScript(outerRoot);
    const buildVerification = subject.verifyBuildAndWasm(
      prerequisites.cargoPath,
      outerRoot
    );
    state.buildVerification = buildVerification.evidence;
    const build = subject.buildComparator(
      prerequisites.cargoPath,
      prerequisites.rustcPath,
      outerRoot,
      buildVerification.targetRoot
    );
    state.build = build.evidence;

    phase = "contract";
    const contract = subject.executeContract(build.binaryPath);
    state.contractExecution = contract.execution;
    state.contract = contract.contract;

    phase = "corruption";
    state.corruptionRecords =
      subject.executeCorruptionSuite(build.binaryPath, outerRoot);

    phase = "crash-and-recovery";
    state.crashRecoveries =
      subject.executeCrashRecoverySuite(build.binaryPath, outerRoot);

    phase = "quality";
    const quality = subject.executeQuality(
      build.binaryPath,
      datasetRoot,
      outerRoot
    );
    state.qualityExecution = quality.execution;
    state.quality = quality.quality;

    phase = "paired-performance";
    const performance = await subject.executePerformanceSuite(
      build.binaryPath,
      prerequisites.powershellPath,
      monitorScript.scriptPath,
      datasetRoot,
      outerRoot,
      startedMilliseconds
    );
    state.performanceRecords = performance.records;
    state.performanceSummaries = performance.summaries;
    invariant(
      Date.now() - startedMilliseconds < overallTimeoutMilliseconds,
      "overall successor observation timeout exceeded"
    );

    phase = "threshold-decision-and-observation-commit";
    subject.removeOwnedRoot(outerRoot);
    outerRootDeleted = true;
    const processSnapshot = recorder.snapshot();
    const observation = buildObservation(
      pending,
      manifestResult,
      implementation,
      state,
      processSnapshot
    );
    atomicCreate(observationPath, canonicalPrettyBytes(observation));
    const reopenedObservation = validateObservationFile();
    const attempt = attemptForObservation(
      pending,
      manifestResult,
      implementation,
      state.inputs,
      reopenedObservation
    );
    const reopenedAttempt = writeAttempt(attempt);
    removePendingAttempt(pending);
    return Object.freeze({
      observation: reopenedObservation,
      attempt: reopenedAttempt,
      recovered: false
    });
  } catch (error) {
    if (outerRoot !== null && fs.existsSync(outerRoot)) {
      try {
        subject.removeOwnedRoot(outerRoot);
        outerRootDeleted = true;
      } catch (cleanupError) {
        cleanupFailureMessageSha256 = sha256(
          Buffer.from(
            cleanupError instanceof Error
              ? cleanupError.message
              : "successor cleanup failed",
            "utf8"
          )
        );
      }
    }
    const processSnapshot = recorder.snapshot();
    if (manifestResult === null) {
      manifestResult = validateManifestFile();
    }
    if (state.inputs.length === 0) {
      state.inputs = inputPaths.map(fileEvidence);
    }
    let failure = failureEvidence(
      error,
      archive,
      processSnapshot.benchmarkRecords
    );
    if (cleanupFailureMessageSha256 !== null) {
      failure = Object.freeze({
        code: "PORTABLE_AFFINE_U8_SUCCESSOR_CLEANUP_REJECTED",
        classification: "instrumentation",
        retryAllowed: archive.length === 0,
        messageSha256: cleanupFailureMessageSha256,
        causeMessageSha256: failure.messageSha256,
        benchmarkErrorCode: failure.benchmarkErrorCode
      });
    }
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId,
      attemptOrdinal: pending.attemptOrdinal,
      previousAttemptId: pending.previousAttemptId,
      status: failure.classification === "comparison-outcome"
        ? "fail-comparison-outcome-terminal"
        : failure.retryAllowed
          ? "fail-instrumentation-retryable"
          : "fail-instrumentation-terminal",
      startedAtUtc: pending.startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: pending.sourceRevision,
      successorPreregistration: {
        path: preregistrationRelativePath,
        sha256: expectedManifestSha256,
        registrationCommit: manifestResult.registrationCommit
      },
      implementationCommit: implementation,
      pendingAttemptId: pending.pendingAttemptId,
      pendingAttemptContentHash: pending.pendingAttemptContentHash,
      lastPhase: phase,
      benchmarkProcessLedger: processSnapshot.benchmarkRecords,
      memoryMonitorProcessLedger: processSnapshot.monitorRecords,
      maximumParallelBenchmarkProcesses:
        processSnapshot.maximumParallelBenchmarkProcesses,
      inputs: state.inputs,
      retainedEvidence: retainedEvidence(state),
      cleanup: {
        outerRootCreated: outerRoot !== null,
        outerRootDeleted,
        cleanupFailureMessageSha256
      },
      observationId: null,
      observationContentHash: null,
      failure,
      processEvidenceComplete: true,
      authority,
      requiredNextGate
    });
    const reopenedAttempt = writeAttempt(attempt);
    removePendingAttempt(pending);
    return Object.freeze({
      observation: null,
      attempt: reopenedAttempt,
      recovered: false
    });
  } finally {
    recorder.restore();
  }
}

async function runAndWriteObservation() {
  invariant(
    !fs.existsSync(pendingPath),
    "successor pending attempt exists; reconcile it explicitly"
  );
  invariant(
    !fs.existsSync(observationPath),
    "successor observation already exists"
  );
  const archive = loadAttemptArchive();
  invariant(archive.length < 2, "successor attempt limit is exhausted");
  if (archive.length > 0) {
    exactValue(
      archive.at(-1).attempt.status,
      "fail-instrumentation-retryable",
      "successor prior attempt is terminal"
    );
  }
  const revision = currentSourceRevision();
  const body = {
    schema: pendingSchema,
    experimentId,
    attemptOrdinal: archive.length + 1,
    previousAttemptId:
      archive.length === 0 ? null : archive.at(-1).attempt.attemptId,
    startedAtUtc: new Date().toISOString(),
    sourceRevision: revision,
    preregistrationSha256: expectedManifestSha256,
    maximumBenchmarkProcessCount,
    maximumMonitorProcessCount,
    benchmarkProcessCountAtJournalWrite: 0,
    monitorProcessCountAtJournalWrite: 0,
    setupStartedAtJournalWrite: false
  };
  return runAfterPendingAttempt(body, (pending) =>
    executeAttempt(pending, archive));
}

function reconcilePendingAttempt() {
  const pendingResult = loadPendingAttempt();
  const pending = pendingResult.pending;
  const archive = loadAttemptArchive();
  const matchingAttempt = archive.find(
    (entry) =>
      entry.attempt.pendingAttemptContentHash ===
        pending.pendingAttemptContentHash
  );
  if (matchingAttempt !== undefined) {
    removePendingAttempt(pending);
    return Object.freeze({
      observation: fs.existsSync(observationPath)
        ? validateObservationFile()
        : null,
      attempt: matchingAttempt,
      recovered: true
    });
  }
  if (fs.existsSync(observationPath)) {
    const observation = validateObservationFile();
    exactValue(
      observation.observation.pendingAttemptContentHash,
      pending.pendingAttemptContentHash,
      "recovered observation pending identity"
    );
    const manifestResult = validateManifestFile();
    const attempt = attemptForObservation(
      pending,
      manifestResult,
      observation.observation.implementationCommit,
      observation.observation.inputs,
      observation
    );
    const reopened = writeAttempt(attempt);
    removePendingAttempt(pending);
    return Object.freeze({
      observation,
      attempt: reopened,
      recovered: true
    });
  }
  const manifestResult = validateManifestFile();
  const inputs = inputPaths.map((relativePath) =>
    fileEvidenceAtRevision(relativePath, pending.sourceRevision));
  const message = "pending successor outcome cannot be reconstructed";
  const failure = Object.freeze({
    code: "PORTABLE_AFFINE_U8_SUCCESSOR_OUTCOME_UNKNOWN",
    classification: "unknown-outcome",
    retryAllowed: false,
    messageSha256: sha256(Buffer.from(message, "utf8")),
    causeMessageSha256: sha256(Buffer.from(message, "utf8")),
    benchmarkErrorCode: null
  });
  const attempt = finalizeAttempt({
    schema: attemptSchema,
    experimentId,
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    status: "fail-unknown-outcome-terminal",
    startedAtUtc: pending.startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    sourceRevision: pending.sourceRevision,
    successorPreregistration: {
      path: preregistrationRelativePath,
      sha256: expectedManifestSha256,
      registrationCommit: manifestResult.registrationCommit
    },
    implementationCommit: implementationCommitAtRevision(
      manifestResult.registrationCommit,
      pending.sourceRevision
    ),
    pendingAttemptId: pending.pendingAttemptId,
    pendingAttemptContentHash: pending.pendingAttemptContentHash,
    lastPhase: "unknown-after-interruption",
    benchmarkProcessLedger: [],
    memoryMonitorProcessLedger: [],
    maximumParallelBenchmarkProcesses: 0,
    inputs,
    retainedEvidence: null,
    cleanup: {
      outerRootCreated: false,
      outerRootDeleted: false,
      cleanupFailureMessageSha256: null
    },
    observationId: null,
    observationContentHash: null,
    failure,
    processEvidenceComplete: false,
    authority,
    requiredNextGate
  });
  const reopened = writeAttempt(attempt);
  removePendingAttempt(pending);
  return Object.freeze({
    observation: null,
    attempt: reopened,
    recovered: true
  });
}

function validateCurrentEvidence() {
  const archive = loadAttemptArchive();
  const observation = fs.existsSync(observationPath)
    ? validateObservationFile()
    : null;
  if (observation !== null) {
    invariant(archive.length > 0, "observation lacks attempt");
    const attempt = archive.at(-1).attempt;
    exactValue(
      attempt.observationContentHash,
      observation.observation.observationContentHash,
      "observation attempt binding"
    );
  }
  return Object.freeze({ archive, observation });
}

async function main(argumentsList) {
  invariant(
    argumentsList.length === 1 &&
      ["--write", "--validate", "--reconcile-pending"].includes(
        argumentsList[0]
      ),
    "usage: node vector-portable-affine-u8-successor-observation.js " +
      "--write|--validate|--reconcile-pending"
  );
  const result = argumentsList[0] === "--write"
    ? await runAndWriteObservation()
    : argumentsList[0] === "--reconcile-pending"
      ? reconcilePendingAttempt()
      : (() => {
          const validated = validateCurrentEvidence();
          invariant(validated.archive.length > 0, "successor attempt is absent");
          return Object.freeze({
            observation: validated.observation,
            attempt: validated.archive.at(-1),
            recovered: false
          });
        })();
  process.stdout.write(`${JSON.stringify({
    schema: result.attempt.attempt.schema,
    attemptId: result.attempt.attempt.attemptId,
    attemptSha256: result.attempt.sha256,
    observationId:
      result.observation?.observation.observationId ?? null,
    observationSha256: result.observation?.sha256 ?? null,
    status: result.attempt.attempt.status,
    recovered: result.recovered
  })}\n`);
  if (
    result.attempt.attempt.status !==
      "complete-awaiting-independent-verification"
  ) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error
        ? error.message
        : "portable affine-u8 successor observation failed"}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  attemptDirectory,
  attemptDirectoryRelativePath,
  attemptIdentity,
  attemptSchema,
  authority,
  benchmarkDescriptor,
  benchmarkSchedule,
  canonicalPrettyBytes,
  createPendingAttempt,
  emptySha256,
  expectedManifestSha256,
  experimentId,
  fileEvidence,
  finalizeAttempt,
  finalizeObservation,
  finalizePendingAttempt,
  inputPaths,
  installProcessRecorder,
  loadAttemptArchive,
  loadPendingAttempt,
  maximumBenchmarkProcessCount,
  maximumMonitorProcessCount,
  observationIdentity,
  observationPath,
  observationRelativePath,
  observationSchema,
  pendingIdentity,
  pendingPath,
  pendingRelativePath,
  pendingSchema,
  reconcilePendingAttempt,
  removePendingAttempt,
  requiredNextGate,
  runAfterPendingAttempt,
  runAndWriteObservation,
  validateAttempt,
  validateCurrentEvidence,
  validateObservation,
  validateObservationFile,
  validatePendingAttempt
});
