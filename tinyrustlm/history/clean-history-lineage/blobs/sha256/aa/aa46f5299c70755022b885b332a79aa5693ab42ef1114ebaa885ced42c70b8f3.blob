"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { pipeline } = require("node:stream/promises");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate, syncDirectory } = require("./durable-files.js");
const {
  defaultPath: preregistrationPath,
  expectedManifestSha256,
  expectedStageNames,
  validateManifestFile
} = require("./vector-portable-affine-u8-quality-diagnostic-preregistration.js");
const {
  buildComparator,
  datasetFiles,
  executablePath,
  offlineEnvironment,
  validateQualityOutput
} = require("./vector-portable-affine-u8-observation.js");

const attemptSchema =
  "tinyrustlm.portable_affine_u8_quality_diagnostic_attempt.v1";
const diagnosticId = "portable-affine-u8-quality-diagnostic-20260726";
const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationRelativePath = path.relative(
  repositoryRoot,
  preregistrationPath
).replaceAll("\\", "/");
const runnerRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-quality-diagnostic.js";
const runnerTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-quality-diagnostic.test.js";
const verifierRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-quality-diagnostic-verification.js";
const verifierTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-quality-diagnostic-verification.test.js";
const terminalVerificationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-verification-v1.json";
const attemptDirectoryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-quality-diagnostic-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptDirectoryRelativePath);
const maximumEvidenceBytes = 16 * 1024 * 1024;
const maximumInputBytes = 64 * 1024 * 1024;
const maximumCommandOutputBytes = 64 * 1024 * 1024;
const maximumDatasetFileBytes = 128 * 1024 * 1024;
const processTimeoutMilliseconds = 300000;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const safeVersionPattern = /^[A-Za-z0-9][A-Za-z0-9 ._()+:/-]{0,255}$/u;
const benchmarkErrorCodePattern = /^[a-z0-9-]{1,96}$/u;
const failureCodePattern = /^[A-Z][A-Z0-9_]{2,95}$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;
const ownedRootPrefix = "tinyrustlm-portable-affine-u8-observation-";
const ownedRootMarker = ".tinyrustlm-portable-affine-u8-observation-owned-v1";
const ownedRootMarkerBytes = Buffer.from("owned-v1\n", "utf8");
const emptySha256 = sha256(Buffer.alloc(0));
const qualityTopLevelKeys = Object.freeze([
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
]);
const allowedStatuses = Object.freeze([
  "diagnosed-process-rejection",
  "diagnosed-validator-rejection",
  "unexpectedly-valid",
  "diagnostic-infrastructure-failure"
]);
const authority = Object.freeze({
  originalExperimentMayBeReopened: false,
  sameExperimentRetryMayBeAuthorized: false,
  qualityMayBeClaimed: false,
  performanceMayBeClaimed: false,
  portableAffineU8NumericalBehaviorMayBeClaimed: false,
  representativeSemanticMemoryQualityMayBeClaimed: false,
  turboVecParityMayBeClaimed: false,
  turboQuantPaperConformanceMayBeClaimed: false,
  productIntegrationMayBeClaimed: false,
  trainingMayBeAuthorized: false,
  releaseMayBeAuthorized: false,
  campaignCounterMayBeIncremented: false
});
const requiredNextGate =
  "Convert the diagnosed predicate into a generic regression with positive " +
  "and counterexample coverage, make a scoped fix, and preregister a distinct " +
  "successor full experiment before any new quality execution.";
const failedInvocationSourceRevision =
  "f7fb3d220559bfa9a6746e00db451ccb91f3ef14";
const failedInvocationMessage =
  "cargo executable is not a bounded regular file";
const failedInvocationMessageSha256 =
  "577f26a3721ea49b61e77661d6310ea7c9cdae9766edbc338efdb6809892f3fe";
const failedWrapperStderrSha256 =
  "a3d4787eb189df76c1e8acc2b38f93fdc0a41d0c31b043628c87ef2fe1b0369c";
const diagnosticExecutionClosed = true;
const inputPaths = Object.freeze([
  preregistrationRelativePath,
  "tinyrustlm/tools/vector-portable-affine-u8-quality-diagnostic-preregistration.js",
  "tinyrustlm/tests/vector-portable-affine-u8-quality-diagnostic-preregistration.test.js",
  runnerRelativePath,
  runnerTestRelativePath,
  verifierRelativePath,
  verifierTestRelativePath,
  terminalVerificationRelativePath,
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
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark.rs",
  "tinyrustlm/tools/vector-portable-affine-u8-observation.js",
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js"
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

function exactValue(value, expected, label) {
  invariant(Object.is(value, expected), `${label} is invalid`);
}

function exactStructure(value, expected, label) {
  invariant(JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`);
}

function safeInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
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

function boundedFile(filePath, maximumBytes, label) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximumBytes,
    `${label} is not a bounded regular file`
  );
  return stat;
}

function resolveRepositoryFile(relativePath) {
  invariant(relativePathPattern.test(relativePath), "repository path is unsafe");
  const resolved = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    "repository path escaped repository root"
  );
  const stat = boundedFile(resolved, maximumInputBytes, relativePath);
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
  invariant(relativePathPattern.test(relativePath), "historical input path is unsafe");
  invariant(revisionPattern.test(revision), "historical input revision is invalid");
  const result = childProcess.spawnSync(
    "git",
    ["cat-file", "blob", `${revision}:${relativePath}`],
    {
      cwd: repositoryRoot,
      encoding: null,
      windowsHide: true,
      timeout: 30000,
      maxBuffer: maximumInputBytes
    }
  );
  invariant(
    result.error === undefined &&
      result.status === 0 &&
      result.signal === null &&
      Buffer.isBuffer(result.stdout) &&
      Buffer.isBuffer(result.stderr) &&
      result.stderr.length === 0,
    `historical input ${relativePath} failed`
  );
  const bytes = result.stdout;
  invariant(
    bytes.length > 0 && bytes.length <= maximumInputBytes,
    `historical input ${relativePath} is not bounded`
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
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024
  });
  invariant(result.error === undefined, `${label} spawn failed`);
  if (!allowFailure) {
    invariant(
      result.status === 0 && result.signal === null && result.stderr === "",
      `${label} failed`
    );
  }
  return result;
}

function sourceRevision() {
  const revision = git(["rev-parse", "HEAD"], "source revision").stdout.trim();
  invariant(revisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function assertInputClosureCommitted(paths = inputPaths) {
  invariant(new Set(paths).size === paths.length, "input closure contains duplicates");
  for (const relativePath of paths) {
    resolveRepositoryFile(relativePath);
    const tracked = git(
      ["ls-files", "--error-unmatch", "--", relativePath],
      `tracked input ${relativePath}`,
      true
    );
    invariant(tracked.status === 0, `input is not committed: ${relativePath}`);
  }
  const status = git(
    ["status", "--porcelain=v1", "--", ...paths],
    "input status"
  ).stdout;
  invariant(status === "", "diagnostic input closure has uncommitted changes");
}

function assertRegistrationAncestor(registrationCommit, revision) {
  invariant(revisionPattern.test(registrationCommit), "registration commit is invalid");
  const ancestor = git(
    ["merge-base", "--is-ancestor", registrationCommit, revision],
    "registration ancestry",
    true
  );
  invariant(ancestor.status === 0, "diagnostic source does not descend registration");
  invariant(
    registrationCommit !== revision,
    "diagnostic implementation must follow registration"
  );
}

function executableIdentityPath(executable, operations = {}) {
  const lstat = operations.lstat ?? fs.lstatSync;
  const realpath = operations.realpath ?? fs.realpathSync.native;
  const stat = lstat(executable);
  invariant(
    stat.isFile() || stat.isSymbolicLink(),
    "executable launcher is neither a file nor symbolic link"
  );
  return stat.isSymbolicLink() ? realpath(executable) : executable;
}

function commandIdentity(name, executable, versionArguments) {
  const identityPath = executableIdentityPath(executable);
  const stat = boundedFile(
    identityPath,
    512 * 1024 * 1024,
    `${name} executable target`
  );
  const result = childProcess.spawnSync(executable, versionArguments, {
    cwd: repositoryRoot,
    env: offlineEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  invariant(
    result.error === undefined &&
      result.status === 0 &&
      result.signal === null &&
      result.stderr === "",
    `${name} version failed`
  );
  const version = result.stdout.trim();
  invariant(safeVersionPattern.test(version), `${name} version is unsafe`);
  return Object.freeze({
    name,
    version,
    binaryBytes: stat.size,
    binarySha256: sha256File(identityPath)
  });
}

function toolIdentities(cargoPath, rustcPath) {
  const nodePath = fs.realpathSync.native(process.execPath);
  const nodeStat = boundedFile(nodePath, 512 * 1024 * 1024, "node executable");
  invariant(safeVersionPattern.test(process.version), "node version is unsafe");
  return Object.freeze({
    node: Object.freeze({
      name: "node",
      version: process.version,
      binaryBytes: nodeStat.size,
      binarySha256: sha256File(nodePath)
    }),
    cargo: commandIdentity("cargo", cargoPath, ["--version"]),
    rustc: commandIdentity("rustc", rustcPath, ["--version"])
  });
}

function validateExternalDataset(manifest) {
  const configured = process.env[manifest.externalDataset.locatorEnvironmentVariable];
  invariant(configured, "external Fashion-MNIST checkout is required");
  const root = fs.realpathSync.native(configured);
  invariant(
    fs.existsSync(path.join(root, ".git")),
    "external dataset root is not a Git checkout"
  );
  const run = (argumentsList, label) => {
    const result = childProcess.spawnSync("git", argumentsList, {
      cwd: root,
      env: offlineEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024
    });
    invariant(
      result.error === undefined &&
        result.status === 0 &&
        result.signal === null &&
        result.stderr === "",
      `${label} failed`
    );
    return result.stdout.trim();
  };
  exactValue(
    run(["rev-parse", "HEAD"], "dataset revision"),
    manifest.externalDataset.revision,
    "dataset revision"
  );
  exactValue(run(["status", "--porcelain=v1"], "dataset status"), "", "dataset status");
  exactValue(
    run(["rev-parse", "HEAD^{tree}"], "dataset tree"),
    manifest.externalDataset.tree,
    "dataset tree"
  );
  const files = datasetFiles.map((file) => {
    const absolute = path.resolve(root, file.upstreamPath);
    invariant(
      absolute.startsWith(`${root}${path.sep}`),
      "dataset file escapes external checkout"
    );
    const stat = boundedFile(
      absolute,
      maximumDatasetFileBytes,
      `dataset ${file.upstreamPath}`
    );
    exactValue(stat.size, file.compressedBytes, `${file.upstreamPath} bytes`);
    exactValue(
      sha256File(absolute),
      file.compressedSha256,
      `${file.upstreamPath} sha256`
    );
    return Object.freeze({ ...file, absolute });
  });
  return Object.freeze({
    files,
    publicIdentity: Object.freeze({
      sourceRepository: manifest.externalDataset.sourceRepository,
      revision: manifest.externalDataset.revision,
      tree: manifest.externalDataset.tree,
      selectionSha256: manifest.externalDataset.selectionSha256,
      checkoutClean: true,
      locatorPersisted: false,
      payloadBytesPersisted: false,
      files: files.map(({ absolute: _absolute, rawName: _rawName, ...file }) =>
        Object.freeze({ ...file }))
    })
  });
}

function createOwnedRoot() {
  invariant(process.platform === "win32" && process.arch === "x64",
    "diagnostic platform is not win32-x64");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedRootPrefix));
  fs.writeFileSync(path.join(root, ownedRootMarker), ownedRootMarkerBytes, {
    flag: "wx"
  });
  syncDirectory(root);
  return fs.realpathSync.native(root);
}

function validateOwnedRoot(root) {
  const resolved = fs.realpathSync.native(root);
  invariant(
    path.dirname(resolved) === fs.realpathSync.native(os.tmpdir()) &&
      path.basename(resolved).startsWith(ownedRootPrefix),
    "owned root identity is invalid"
  );
  invariant(
    fs.readFileSync(path.join(resolved, ownedRootMarker)).equals(
      ownedRootMarkerBytes
    ),
    "owned root marker is invalid"
  );
  return resolved;
}

function removeOwnedRoot(root) {
  const resolved = validateOwnedRoot(root);
  fs.rmSync(resolved, {
    recursive: true,
    force: false,
    maxRetries: 8,
    retryDelay: 50
  });
  invariant(!fs.existsSync(resolved), "owned root deletion failed");
}

async function materializeDataset(dataset, outerRoot) {
  validateOwnedRoot(outerRoot);
  const destination = path.join(outerRoot, "dataset");
  fs.mkdirSync(destination);
  for (const file of dataset.files) {
    const temporary = path.join(destination, `${file.rawName}.tmp`);
    const finalPath = path.join(destination, file.rawName);
    await pipeline(
      fs.createReadStream(file.absolute),
      zlib.createGunzip(),
      fs.createWriteStream(temporary, { flags: "wx" })
    );
    const descriptor = fs.openSync(temporary, "r+");
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    const stat = boundedFile(
      temporary,
      maximumDatasetFileBytes,
      `${file.rawName} decompressed`
    );
    exactValue(stat.size, file.decompressedBytes, `${file.rawName} output bytes`);
    exactValue(
      sha256File(temporary),
      file.decompressedSha256,
      `${file.rawName} output sha256`
    );
    fs.renameSync(temporary, finalPath);
  }
  syncDirectory(destination);
  return destination;
}

function executeQualityProcess(binaryPath, datasetRoot, outerRoot) {
  const processRoot = path.join(outerRoot, "diagnostic-process-root");
  fs.mkdirSync(processRoot);
  const result = childProcess.spawnSync(binaryPath, ["--quality"], {
    cwd: datasetRoot,
    env: offlineEnvironment({
      TINYRUSTLM_AFFINE_U8_PROCESS_ROOT: processRoot
    }),
    encoding: null,
    windowsHide: true,
    timeout: processTimeoutMilliseconds,
    maxBuffer: maximumCommandOutputBytes
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  invariant(
    stdout.length <= maximumCommandOutputBytes &&
      stderr.length <= maximumCommandOutputBytes,
    "diagnostic process output exceeded retained bound"
  );
  const errorCode =
    result.error !== undefined &&
      typeof result.error.code === "string" &&
      /^[A-Z0-9_]{1,32}$/u.test(result.error.code)
      ? result.error.code
      : null;
  return Object.freeze({
    invocationCount: 1,
    processStarted: result.pid !== undefined,
    exitCode: result.status,
    signal: result.signal,
    timedOut: errorCode === "ETIMEDOUT",
    outputBoundExceeded: errorCode === "ENOBUFS",
    spawnErrorCode: errorCode,
    stdout,
    stderr
  });
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not UTF-8`);
  }
}

function topLevelSummary(value, manifest) {
  exactKeys(value, qualityTopLevelKeys, "quality top-level output");
  exactValue(
    value.schema,
    "tinyrustlm.portable_affine_u8_quality_process.v1",
    "quality schema"
  );
  exactValue(
    value.experimentId,
    manifest.terminalLineage.experimentId,
    "quality experimentId"
  );
  exactValue(value.qualityProcessOrdinal, 1, "quality process ordinal");
  exactValue(value.datasetName, "Fashion-MNIST", "quality dataset name");
  exactValue(
    value.datasetRevision,
    manifest.externalDataset.revision,
    "quality dataset revision"
  );
  exactValue(
    value.selectionAlgorithm,
    "sha256-seed-split-label-index-smallest-v1",
    "quality selection algorithm"
  );
  exactValue(
    value.selectionSha256,
    manifest.externalDataset.selectionSha256,
    "quality selection identity"
  );
  exactStructure(value.topKValues, [1, 10, 100], "quality topK values");
  invariant(Array.isArray(value.laneResults), "quality laneResults is not an array");
  invariant(
    Array.isArray(value.perQueryMetrics),
    "quality perQueryMetrics is not an array"
  );
  exactValue(value.laneResults.length, 6, "quality lane count");
  exactValue(value.perQueryMetrics.length, 790, "quality query count");
  return Object.freeze({
    schema: value.schema,
    experimentId: value.experimentId,
    qualityProcessOrdinal: value.qualityProcessOrdinal,
    datasetName: value.datasetName,
    datasetRevision: value.datasetRevision,
    selectionAlgorithm: value.selectionAlgorithm,
    selectionSha256: value.selectionSha256,
    topKValues: Object.freeze([...value.topKValues]),
    laneCount: value.laneResults.length,
    queryCount: value.perQueryMetrics.length
  });
}

function failureMessageHash(error) {
  const message = error instanceof Error ? error.message : "diagnostic failure";
  return sha256(Buffer.from(message, "utf8"));
}

function benchmarkErrorCode(stderr) {
  try {
    const text = decodeUtf8(stderr, "benchmark stderr");
    const candidate = text.endsWith("\r\n")
      ? text.slice(0, -2)
      : text.endsWith("\n")
        ? text.slice(0, -1)
        : "";
    return benchmarkErrorCodePattern.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function diagnosisResult(
  status,
  firstFailingStage,
  failureCode,
  error,
  execution,
  structuralSummary = null
) {
  const stageIndex = expectedStageNames.indexOf(firstFailingStage);
  invariant(stageIndex >= 0, "diagnostic failure stage is unknown");
  return Object.freeze({
    status,
    passedStages: Object.freeze(expectedStageNames.slice(0, stageIndex)),
    firstFailingStage,
    failureCode,
    failureMessageSha256: error === null ? null : failureMessageHash(error),
    benchmarkErrorCode: benchmarkErrorCode(execution.stderr),
    structuralSummary
  });
}

function diagnoseExecution(execution, manifest) {
  invariant(isPlainObject(execution), "diagnostic execution is invalid");
  invariant(Buffer.isBuffer(execution.stdout), "diagnostic stdout is invalid");
  invariant(Buffer.isBuffer(execution.stderr), "diagnostic stderr is invalid");
  if (!execution.processStarted && execution.spawnErrorCode !== null) {
    return diagnosisResult(
      "diagnostic-infrastructure-failure",
      "spawn",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_SPAWN_REJECTED",
      new Error("diagnostic benchmark did not start"),
      execution
    );
  }
  if (execution.timedOut || execution.outputBoundExceeded) {
    return diagnosisResult(
      "diagnostic-infrastructure-failure",
      "timeout-or-output-bound",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_RESOURCE_BOUND_REJECTED",
      new Error("diagnostic benchmark exceeded a resource bound"),
      execution
    );
  }
  if (execution.exitCode !== 0 || execution.signal !== null) {
    return diagnosisResult(
      "diagnosed-process-rejection",
      "exit-and-signal",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_EXIT_OR_SIGNAL_REJECTED",
      new Error("diagnostic benchmark exit or signal rejected"),
      execution
    );
  }
  if (execution.stderr.length !== 0) {
    return diagnosisResult(
      "diagnosed-process-rejection",
      "stderr-contract",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_STDERR_REJECTED",
      new Error("diagnostic benchmark wrote stderr"),
      execution
    );
  }
  let stdout;
  try {
    stdout = decodeUtf8(execution.stdout, "benchmark stdout");
    invariant(stdout.endsWith("\n"), "benchmark stdout lacks trailing newline");
    invariant(
      !stdout.slice(0, -1).includes("\n") &&
        !stdout.slice(0, -1).includes("\r"),
      "benchmark stdout is not one line"
    );
  } catch (error) {
    return diagnosisResult(
      "diagnosed-validator-rejection",
      "stdout-framing",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_STDOUT_FRAMING_REJECTED",
      error,
      execution
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    return diagnosisResult(
      "diagnosed-validator-rejection",
      "json-parse",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_JSON_PARSE_REJECTED",
      error,
      execution
    );
  }
  if (stdout !== `${JSON.stringify(parsed)}\n`) {
    return diagnosisResult(
      "diagnosed-validator-rejection",
      "canonical-compact-json",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_CANONICAL_JSON_REJECTED",
      new Error("diagnostic stdout is not canonical compact JSON"),
      execution
    );
  }
  let structuralSummary;
  try {
    structuralSummary = topLevelSummary(parsed, manifest);
  } catch (error) {
    return diagnosisResult(
      "diagnosed-validator-rejection",
      "top-level-contract",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_TOP_LEVEL_REJECTED",
      error,
      execution
    );
  }
  try {
    validateQualityOutput(parsed);
  } catch (error) {
    return diagnosisResult(
      "diagnosed-validator-rejection",
      "per-query-or-aggregate-semantics",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_SEMANTIC_SHAPE_REJECTED",
      error,
      execution,
      structuralSummary
    );
  }
  return diagnosisResult(
    "unexpectedly-valid",
    "unexpectedly-valid",
    null,
    null,
    execution,
    structuralSummary
  );
}

function processEvidence(execution) {
  return Object.freeze({
    benchmarkMode: "--quality",
    invocationCount: execution.invocationCount,
    processStarted: execution.processStarted,
    exitCode: execution.exitCode,
    signal: execution.signal,
    timedOut: execution.timedOut,
    outputBoundExceeded: execution.outputBoundExceeded,
    spawnErrorCode: execution.spawnErrorCode,
    stdoutBytes: execution.stdout.length,
    stdoutSha256: sha256(execution.stdout),
    stderrBytes: execution.stderr.length,
    stderrSha256: sha256(execution.stderr)
  });
}

function attemptIdentity(value) {
  const body = { ...value };
  delete body.attemptId;
  delete body.attemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `portable-affine-u8-quality-diagnostic-attempt-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizeAttempt(body) {
  const identity = attemptIdentity(body);
  return Object.freeze({
    ...body,
    attemptId: identity.id,
    attemptContentHash: identity.hash
  });
}

function validateFileEvidence(value, label) {
  exactKeys(value, ["path", "bytes", "sha256"], label);
  invariant(relativePathPattern.test(value.path), `${label} path is unsafe`);
  safeInteger(value.bytes, `${label} bytes`, 1, maximumInputBytes);
  invariant(sha256Pattern.test(value.sha256), `${label} sha256 is invalid`);
}

function validateToolIdentity(value, label) {
  exactKeys(value, ["name", "version", "binaryBytes", "binarySha256"], label);
  invariant(
    safeVersionPattern.test(value.name) &&
      safeVersionPattern.test(value.version) &&
      sha256Pattern.test(value.binarySha256),
    `${label} identity is invalid`
  );
  safeInteger(value.binaryBytes, `${label} bytes`, 1, 512 * 1024 * 1024);
}

function validateProcessEvidence(value) {
  exactKeys(value, [
    "benchmarkMode", "invocationCount", "processStarted", "exitCode", "signal",
    "timedOut", "outputBoundExceeded", "spawnErrorCode", "stdoutBytes",
    "stdoutSha256", "stderrBytes", "stderrSha256"
  ], "processExecution");
  exactValue(value.benchmarkMode, "--quality", "process benchmark mode");
  safeInteger(value.invocationCount, "process invocation count", 0, 1);
  invariant(typeof value.processStarted === "boolean", "process started is invalid");
  invariant(
    value.exitCode === null ||
      Number.isSafeInteger(value.exitCode),
    "process exit code is invalid"
  );
  if (value.invocationCount === 0) {
    invariant(
      value.processStarted === false &&
        value.exitCode === null &&
        value.signal === null &&
        value.timedOut === false &&
        value.outputBoundExceeded === false &&
        value.stdoutBytes === 0 &&
        value.stdoutSha256 === emptySha256 &&
        value.stderrBytes === 0 &&
        value.stderrSha256 === emptySha256,
      "zero-invocation process evidence is invalid"
    );
  }
  invariant(
    value.signal === null ||
      /^[A-Z0-9]{1,32}$/u.test(value.signal),
    "process signal is invalid"
  );
  invariant(
    typeof value.timedOut === "boolean" &&
      typeof value.outputBoundExceeded === "boolean" &&
      (value.spawnErrorCode === null ||
        /^[A-Z0-9_]{1,32}$/u.test(value.spawnErrorCode)),
    "process bounded status is invalid"
  );
  safeInteger(value.stdoutBytes, "process stdout bytes", 0, maximumCommandOutputBytes);
  safeInteger(value.stderrBytes, "process stderr bytes", 0, maximumCommandOutputBytes);
  invariant(
    sha256Pattern.test(value.stdoutSha256) &&
      sha256Pattern.test(value.stderrSha256),
    "process output hashes are invalid"
  );
}

function validateDiagnosis(value, processExecution) {
  exactKeys(value, [
    "status", "passedStages", "firstFailingStage", "failureCode",
    "failureMessageSha256", "benchmarkErrorCode", "structuralSummary"
  ], "diagnosis");
  invariant(allowedStatuses.includes(value.status), "diagnosis status is invalid");
  const stageIndex = expectedStageNames.indexOf(value.firstFailingStage);
  invariant(stageIndex >= 0, "diagnosis stage is invalid");
  exactStructure(
    value.passedStages,
    expectedStageNames.slice(0, stageIndex),
    "diagnosis passed stages"
  );
  if (value.status === "unexpectedly-valid") {
    invariant(
      value.firstFailingStage === "unexpectedly-valid" &&
        value.failureCode === null &&
        value.failureMessageSha256 === null &&
        value.benchmarkErrorCode === null &&
        value.structuralSummary !== null,
      "unexpectedly valid diagnosis is invalid"
    );
  } else {
    invariant(
      failureCodePattern.test(value.failureCode) &&
        sha256Pattern.test(value.failureMessageSha256),
      "diagnosis failure identity is invalid"
    );
  }
  invariant(
    value.benchmarkErrorCode === null ||
      benchmarkErrorCodePattern.test(value.benchmarkErrorCode),
    "diagnosis benchmark error code is invalid"
  );
  if (value.structuralSummary !== null) {
    exactKeys(value.structuralSummary, [
      "schema", "experimentId", "qualityProcessOrdinal", "datasetName",
      "datasetRevision", "selectionAlgorithm", "selectionSha256", "topKValues",
      "laneCount", "queryCount"
    ], "structuralSummary");
    exactValue(value.structuralSummary.laneCount, 6, "structural lane count");
    exactValue(value.structuralSummary.queryCount, 790, "structural query count");
  }
  if (value.firstFailingStage === "exit-and-signal") {
    invariant(
      processExecution.exitCode !== 0 || processExecution.signal !== null,
      "exit diagnosis lacks rejected process status"
    );
  }
}

function validateAttempt(value) {
  exactKeys(value, [
    "schema", "diagnosticId", "attemptOrdinal", "status", "startedAtUtc",
    "completedAtUtc", "reconciledAtUtc", "originalInvocationTimeAvailable",
    "sourceRevision", "preregistration",
    "terminalVerification", "inputs", "platform", "tools", "externalDataset",
    "build", "processExecution", "diagnosis", "cleanup", "authority",
    "operationalFailure", "reconciliation", "requiredNextGate",
    "attemptId", "attemptContentHash"
  ], "diagnostic attempt");
  exactValue(value.schema, attemptSchema, "attempt schema");
  exactValue(value.diagnosticId, diagnosticId, "attempt diagnosticId");
  exactValue(value.attemptOrdinal, 1, "attempt ordinal");
  invariant(allowedStatuses.includes(value.status), "attempt status is invalid");
  invariant(revisionPattern.test(value.sourceRevision), "attempt source revision is invalid");
  invariant(
    typeof value.originalInvocationTimeAvailable === "boolean",
    "attempt timing availability is invalid"
  );
  if (value.originalInvocationTimeAvailable) {
    invariant(
      utcPattern.test(value.startedAtUtc) &&
        utcPattern.test(value.completedAtUtc) &&
        Number.isFinite(Date.parse(value.startedAtUtc)) &&
        Number.isFinite(Date.parse(value.completedAtUtc)) &&
        Date.parse(value.completedAtUtc) >= Date.parse(value.startedAtUtc) &&
        value.reconciledAtUtc === null,
      "direct attempt temporal identity is invalid"
    );
  } else {
    invariant(
      value.startedAtUtc === null &&
        value.completedAtUtc === null &&
        utcPattern.test(value.reconciledAtUtc) &&
        Number.isFinite(Date.parse(value.reconciledAtUtc)),
      "reconciled attempt temporal identity is invalid"
    );
  }
  exactKeys(
    value.preregistration,
    ["path", "sha256", "registrationCommit"],
    "attempt preregistration"
  );
  invariant(
    value.preregistration.path === preregistrationRelativePath &&
      value.preregistration.sha256 === expectedManifestSha256 &&
      revisionPattern.test(value.preregistration.registrationCommit),
    "attempt preregistration identity is invalid"
  );
  exactKeys(
    value.terminalVerification,
    ["path", "sha256", "receiptId", "status"],
    "attempt terminal verification"
  );
  invariant(
    value.terminalVerification.path === terminalVerificationRelativePath &&
      value.terminalVerification.sha256 ===
        "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b" &&
      value.terminalVerification.receiptId ===
        "portable-affine-u8-flat-verification-b72cb93ab3e2aa85" &&
      value.terminalVerification.status === "verified-terminal-no-observation",
    "attempt terminal verification identity is invalid"
  );
  invariant(
    Array.isArray(value.inputs) &&
      value.inputs.length === inputPaths.length &&
      new Set(value.inputs.map((entry) => entry.path)).size === inputPaths.length,
    "attempt input closure is invalid"
  );
  value.inputs.forEach((entry, index) => {
    validateFileEvidence(entry, `attempt input ${index}`);
    exactValue(entry.path, inputPaths[index], `attempt input ${index} path`);
  });
  exactKeys(value.platform, ["os", "architecture", "runtimeIdentifier"], "platform");
  exactStructure(value.platform, {
    os: "windows",
    architecture: "x86_64",
    runtimeIdentifier: "win-x64"
  }, "platform");
  exactKeys(value.tools, ["node", "cargo", "rustc"], "tools");
  validateToolIdentity(value.tools.node, "node tool");
  validateToolIdentity(value.tools.cargo, "cargo tool");
  validateToolIdentity(value.tools.rustc, "rustc tool");
  exactKeys(value.externalDataset, [
    "sourceRepository", "revision", "tree", "selectionSha256", "checkoutClean",
    "locatorPersisted", "payloadBytesPersisted", "files"
  ], "externalDataset");
  invariant(
    value.externalDataset.locatorPersisted === false &&
      value.externalDataset.payloadBytesPersisted === false &&
      value.externalDataset.checkoutClean === true &&
      Array.isArray(value.externalDataset.files) &&
      value.externalDataset.files.length === 4,
    "external dataset evidence is invalid"
  );
  invariant(value.build === null || isPlainObject(value.build), "build evidence is invalid");
  validateProcessEvidence(value.processExecution);
  validateDiagnosis(value.diagnosis, value.processExecution);
  exactKeys(value.cleanup, [
    "outerRootCreated", "outerRootDeleted", "cleanupFailureMessageSha256"
  ], "cleanup");
  invariant(
    typeof value.cleanup.outerRootCreated === "boolean" &&
      typeof value.cleanup.outerRootDeleted === "boolean" &&
      (value.cleanup.cleanupFailureMessageSha256 === null ||
        sha256Pattern.test(value.cleanup.cleanupFailureMessageSha256)),
    "cleanup evidence is invalid"
  );
  if (value.cleanup.outerRootCreated && !value.cleanup.outerRootDeleted) {
    exactValue(
      value.status,
      "diagnostic-infrastructure-failure",
      "unclean attempt status"
    );
  }
  invariant(
    value.operationalFailure === null ||
      isPlainObject(value.operationalFailure),
    "operational failure is invalid"
  );
  if (value.operationalFailure === null) {
    exactValue(value.status, value.diagnosis.status, "attempt diagnosis status");
  } else {
    exactKeys(
      value.operationalFailure,
      ["code", "messageSha256"],
      "operational failure"
    );
    invariant(
      failureCodePattern.test(value.operationalFailure.code) &&
        sha256Pattern.test(value.operationalFailure.messageSha256),
      "operational failure identity is invalid"
    );
    exactValue(
      value.status,
      "diagnostic-infrastructure-failure",
      "operational failure status"
    );
  }
  invariant(
    value.reconciliation === null || isPlainObject(value.reconciliation),
    "attempt reconciliation is invalid"
  );
  if (value.reconciliation === null) {
    invariant(
      value.originalInvocationTimeAvailable === true,
      "direct attempt lacks original timing"
    );
  } else {
    exactKeys(value.reconciliation, [
      "originalInvocationSourceRevision",
      "originalInvocationTimeAvailable",
      "wrapperExitCode",
      "wrapperStdoutBytes",
      "wrapperStdoutSha256",
      "wrapperStderrBytes",
      "wrapperStderrSha256",
      "benchmarkProcessInvocationCount",
      "toolAndDatasetEvidenceCollectedDuringReconciliation"
    ], "attempt reconciliation");
    invariant(
      value.reconciliation.originalInvocationSourceRevision === value.sourceRevision &&
        value.reconciliation.originalInvocationTimeAvailable === false &&
        value.reconciliation.wrapperExitCode === 1 &&
        value.reconciliation.wrapperStdoutBytes === 0 &&
        value.reconciliation.wrapperStdoutSha256 === emptySha256 &&
        value.reconciliation.wrapperStderrBytes === 47 &&
        value.reconciliation.wrapperStderrSha256 === failedWrapperStderrSha256 &&
        value.reconciliation.benchmarkProcessInvocationCount === 0 &&
        value.reconciliation.toolAndDatasetEvidenceCollectedDuringReconciliation === true &&
        value.originalInvocationTimeAvailable === false &&
        value.processExecution.invocationCount === 0,
      "attempt reconciliation evidence is invalid"
    );
  }
  exactStructure(value.authority, authority, "attempt authority");
  exactValue(value.requiredNextGate, requiredNextGate, "attempt required next gate");
  const identity = attemptIdentity(value);
  exactValue(value.attemptId, identity.id, "attempt id");
  exactValue(value.attemptContentHash, identity.hash, "attempt content hash");
  publicSafe(value, "diagnostic attempt");
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
  const files = [];
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
      const stat = boundedFile(filePath, maximumEvidenceBytes, "diagnostic attempt");
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
      exactValue(prefix, attempt.attemptContentHash.slice(0, 2), "attempt prefix");
      files.push(Object.freeze({
        attempt,
        path: filePath,
        bytes: stat.size,
        sha256: sha256(bytes)
      }));
    }
  }
  invariant(files.length <= 1, "diagnostic has more than one attempt");
  return Object.freeze(files);
}

function writeAttempt(attempt) {
  validateAttempt(attempt);
  invariant(loadAttemptArchive().length === 0, "diagnostic attempt already exists");
  const filePath = attemptFilePath(attempt);
  atomicCreate(filePath, canonicalPrettyBytes(attempt));
  const archive = loadAttemptArchive();
  exactValue(archive.length, 1, "written attempt count");
  exactValue(
    archive[0].attempt.attemptContentHash,
    attempt.attemptContentHash,
    "written attempt identity"
  );
  return archive[0];
}

function infrastructureExecution(error) {
  return Object.freeze({
    invocationCount: 0,
    processStarted: false,
    exitCode: null,
    signal: null,
    timedOut: false,
    outputBoundExceeded: false,
    spawnErrorCode: null,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    setupError: error
  });
}

async function runAndWriteDiagnostic(options = {}) {
  invariant(!diagnosticExecutionClosed, "diagnostic execution is terminal");
  invariant(loadAttemptArchive().length === 0, "diagnostic attempt already exists");
  const startedAtUtc = options.startedAtUtc ?? new Date().toISOString();
  const manifestResult = validateManifestFile();
  invariant(
    manifestResult.registrationCommit !== null,
    "diagnostic preregistration is not committed"
  );
  assertInputClosureCommitted();
  const revision = sourceRevision();
  assertRegistrationAncestor(manifestResult.registrationCommit, revision);
  const cargoPath = executablePath("cargo.exe");
  const rustcPath = executablePath("rustc.exe");
  const tools = toolIdentities(cargoPath, rustcPath);
  const inputs = inputPaths.map(fileEvidence);
  const dataset = validateExternalDataset(manifestResult.manifest);
  const platform = Object.freeze({
    os: "windows",
    architecture: "x86_64",
    runtimeIdentifier: "win-x64"
  });
  let outerRoot = null;
  let outerRootDeleted = false;
  let cleanupFailureMessageSha256 = null;
  let build = null;
  let execution = null;
  let diagnosis = null;
  let primaryFailure = null;
  let operationalFailure = null;
  try {
    outerRoot = createOwnedRoot();
    const datasetRoot = await materializeDataset(dataset, outerRoot);
    build = buildComparator(
      cargoPath,
      rustcPath,
      outerRoot,
      path.join(outerRoot, "cargo-target")
    ).evidence;
    execution = executeQualityProcess(
      path.join(outerRoot, "portable-affine-u8-benchmark.exe"),
      datasetRoot,
      outerRoot
    );
    diagnosis = diagnoseExecution(execution, manifestResult.manifest);
  } catch (error) {
    primaryFailure = error;
    execution = infrastructureExecution(error);
    diagnosis = diagnosisResult(
      "diagnostic-infrastructure-failure",
      "spawn",
      "AFFINE_U8_QUALITY_DIAGNOSTIC_SETUP_REJECTED",
      error,
      execution
    );
  } finally {
    if (outerRoot !== null && fs.existsSync(outerRoot)) {
      try {
        removeOwnedRoot(outerRoot);
        outerRootDeleted = true;
      } catch (error) {
        cleanupFailureMessageSha256 = failureMessageHash(error);
        if (primaryFailure === null) primaryFailure = error;
        operationalFailure = Object.freeze({
          code: "AFFINE_U8_QUALITY_DIAGNOSTIC_CLEANUP_REJECTED",
          messageSha256: cleanupFailureMessageSha256
        });
      }
    }
  }
  const attempt = finalizeAttempt({
    schema: attemptSchema,
    diagnosticId,
    attemptOrdinal: 1,
    status: operationalFailure === null
      ? diagnosis.status
      : "diagnostic-infrastructure-failure",
    startedAtUtc,
    completedAtUtc: options.completedAtUtc ?? new Date().toISOString(),
    reconciledAtUtc: null,
    originalInvocationTimeAvailable: true,
    sourceRevision: revision,
    preregistration: {
      path: preregistrationRelativePath,
      sha256: expectedManifestSha256,
      registrationCommit: manifestResult.registrationCommit
    },
    terminalVerification: {
      path: terminalVerificationRelativePath,
      sha256: "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b",
      receiptId: "portable-affine-u8-flat-verification-b72cb93ab3e2aa85",
      status: "verified-terminal-no-observation"
    },
    inputs,
    platform,
    tools,
    externalDataset: dataset.publicIdentity,
    build,
    processExecution: processEvidence(execution),
    diagnosis,
    cleanup: {
      outerRootCreated: outerRoot !== null,
      outerRootDeleted,
      cleanupFailureMessageSha256
    },
    operationalFailure,
    reconciliation: null,
    authority,
    requiredNextGate
  });
  return writeAttempt(attempt);
}

function reconcileSetupFailure(options = {}) {
  invariant(loadAttemptArchive().length === 0, "diagnostic attempt already exists");
  const manifestResult = validateManifestFile();
  invariant(
    manifestResult.registrationCommit !== null,
    "diagnostic preregistration is not committed"
  );
  const currentRevision = sourceRevision();
  assertRegistrationAncestor(
    manifestResult.registrationCommit,
    failedInvocationSourceRevision
  );
  const failureAncestor = git(
    ["merge-base", "--is-ancestor", failedInvocationSourceRevision, currentRevision],
    "failed invocation ancestry",
    true
  );
  invariant(
    failureAncestor.status === 0,
    "reconciliation does not descend from failed invocation"
  );
  invariant(
    sha256(Buffer.from(failedInvocationMessage, "utf8")) ===
      failedInvocationMessageSha256,
    "failed invocation message identity drifted"
  );
  const cargoPath = executablePath("cargo.exe");
  const rustcPath = executablePath("rustc.exe");
  const tools = toolIdentities(cargoPath, rustcPath);
  const dataset = validateExternalDataset(manifestResult.manifest);
  const execution = infrastructureExecution(
    new Error(failedInvocationMessage)
  );
  const diagnosis = diagnosisResult(
    "diagnostic-infrastructure-failure",
    "spawn",
    "AFFINE_U8_QUALITY_DIAGNOSTIC_SETUP_REJECTED",
    new Error(failedInvocationMessage),
    execution
  );
  const reconciledAtUtc = options.reconciledAtUtc ?? new Date().toISOString();
  const attempt = finalizeAttempt({
    schema: attemptSchema,
    diagnosticId,
    attemptOrdinal: 1,
    status: "diagnostic-infrastructure-failure",
    startedAtUtc: null,
    completedAtUtc: null,
    reconciledAtUtc,
    originalInvocationTimeAvailable: false,
    sourceRevision: failedInvocationSourceRevision,
    preregistration: {
      path: preregistrationRelativePath,
      sha256: expectedManifestSha256,
      registrationCommit: manifestResult.registrationCommit
    },
    terminalVerification: {
      path: terminalVerificationRelativePath,
      sha256: "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b",
      receiptId: "portable-affine-u8-flat-verification-b72cb93ab3e2aa85",
      status: "verified-terminal-no-observation"
    },
    inputs: inputPaths.map((inputPath) =>
      fileEvidenceAtRevision(inputPath, failedInvocationSourceRevision)),
    platform: {
      os: "windows",
      architecture: "x86_64",
      runtimeIdentifier: "win-x64"
    },
    tools,
    externalDataset: dataset.publicIdentity,
    build: null,
    processExecution: processEvidence(execution),
    diagnosis,
    cleanup: {
      outerRootCreated: false,
      outerRootDeleted: false,
      cleanupFailureMessageSha256: null
    },
    operationalFailure: {
      code: "AFFINE_U8_QUALITY_DIAGNOSTIC_PREJOURNAL_SETUP_REJECTED",
      messageSha256: failedInvocationMessageSha256
    },
    reconciliation: {
      originalInvocationSourceRevision: failedInvocationSourceRevision,
      originalInvocationTimeAvailable: false,
      wrapperExitCode: 1,
      wrapperStdoutBytes: 0,
      wrapperStdoutSha256: emptySha256,
      wrapperStderrBytes: 47,
      wrapperStderrSha256: failedWrapperStderrSha256,
      benchmarkProcessInvocationCount: 0,
      toolAndDatasetEvidenceCollectedDuringReconciliation: true
    },
    authority,
    requiredNextGate
  });
  return writeAttempt(attempt);
}

async function main(argumentsList) {
  invariant(
    argumentsList.length === 1 &&
      ["--reconcile-setup-failure", "--validate"].includes(argumentsList[0]),
    "usage: node vector-portable-affine-u8-quality-diagnostic.js " +
      "--reconcile-setup-failure|--validate"
  );
  const result = argumentsList[0] === "--reconcile-setup-failure"
    ? reconcileSetupFailure()
    : (() => {
        const archive = loadAttemptArchive();
        exactValue(archive.length, 1, "diagnostic attempt count");
        return archive[0];
      })();
  process.stdout.write(`${JSON.stringify({
    schema: result.attempt.schema,
    attemptId: result.attempt.attemptId,
    attemptSha256: result.sha256,
    status: result.attempt.status,
    firstFailingStage: result.attempt.diagnosis.firstFailingStage
  })}\n`);
  process.exitCode = 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "affine-u8 diagnostic failed"}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  allowedStatuses,
  attemptDirectory,
  attemptDirectoryRelativePath,
  attemptIdentity,
  attemptSchema,
  authority,
  diagnoseExecution,
  diagnosticExecutionClosed,
  emptySha256,
  executableIdentityPath,
  expectedStageNames,
  fileEvidence,
  finalizeAttempt,
  inputPaths,
  loadAttemptArchive,
  processEvidence,
  requiredNextGate,
  reconcileSetupFailure,
  topLevelSummary,
  validateAttempt,
  writeAttempt
});
