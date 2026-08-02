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
  expectedAuthority: preregisteredAuthority,
  validateManifestFile
} = require("./vector-baseline-evidence-preregistration.js");
const {
  validateGitInput
} = require("./vector-historical-git-input.js");

const qualitySchema = "tinyrustlm.exact_flat_baseline_quality_process.v1";
const recoverySchema = "tinyrustlm.exact_flat_durable_deletion_recovery.v1";
const observationSchema = "tinyrustlm.exact_flat_baseline_evidence_observation.v1";
const attemptSchema = "tinyrustlm.exact_flat_baseline_evidence_attempt.v1";
const expectedExperimentId = "exact-flat-sealed-corpus-and-durable-deletion-20260725";
const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-preregistration.v1.json";
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-observation-v1.json";
const observationPath = path.join(repositoryRoot, observationRelativePath);
const attemptRelativeDirectory =
  "tinyrustlm/experiments/vector-quantization/baseline-evidence-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptRelativeDirectory);
const benchmarkRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-benchmark.rs";
const maximumInputBytes = 16 * 1024 * 1024;
const maximumEvidenceBytes = 8 * 1024 * 1024;
const maximumCommandOutputBytes = 32 * 1024 * 1024;
const maximumDatasetFileBytes = 128 * 1024 * 1024;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const safeVersionPattern = /^[A-Za-z0-9][A-Za-z0-9 ._()+:/-]{0,255}$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;
const ownedRootPrefix = "tinyrustlm-baseline-evidence-";
const ownedRootMarker = ".tinyrustlm-baseline-evidence-owned-v1";
const deletionRootMarker = ".tinyrustlm-exact-flat-deletion-owned";
const deletionRootMarkerBytes =
  Buffer.from("tinyrustlm-exact-flat-deletion-owned-v1\n", "utf8");

const cratePrefix = "rust/experiments/tinyrustlm-vector-oracle/";
const crateInputs = Object.freeze([
  `${cratePrefix}Cargo.toml`,
  `${cratePrefix}src/accounting.rs`,
  `${cratePrefix}src/bitpack.rs`,
  `${cratePrefix}src/codebook.rs`,
  `${cratePrefix}src/error.rs`,
  `${cratePrefix}src/flat_index.rs`,
  `${cratePrefix}src/lib.rs`,
  `${cratePrefix}src/metrics.rs`,
  `${cratePrefix}src/prng.rs`,
  `${cratePrefix}src/score.rs`,
  `${cratePrefix}src/sha256.rs`,
  `${cratePrefix}src/transform.rs`,
  `${cratePrefix}tests/flat_index_test.rs`,
  `${cratePrefix}tests/lib_test.rs`
]);

const parentPaths = Object.freeze([
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-verification-v1.json"
]);

const inputPaths = Object.freeze([
  ...crateInputs,
  ...parentPaths,
  benchmarkRelativePath,
  preregistrationRelativePath,
  "tinyrustlm/tests/campaign-evidence-store.test.js",
  "tinyrustlm/tests/durable-files.test.js",
  "tinyrustlm/tests/vector-baseline-evidence-observation.test.js",
  "tinyrustlm/tests/vector-baseline-evidence-preregistration.test.js",
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  "tinyrustlm/tools/vector-baseline-evidence-observation.js",
  "tinyrustlm/tools/vector-baseline-evidence-preregistration.js"
]);

const datasetFiles = Object.freeze([
  Object.freeze({
    upstreamPath: "data/fashion/train-images-idx3-ubyte.gz",
    rawName: "train-images.idx",
    compressedBytes: 26421880,
    compressedSha256: "3aede38d61863908ad78613f6a32ed271626dd12800ba2636569512369268a84",
    decompressedBytes: 47040016,
    decompressedSha256: "c59f468a2f672dc815687fe0f83887768d799fd8a3f3276145d20f83aa44d888",
    idxMagic: 2051,
    itemCount: 60000,
    rows: 28,
    columns: 28
  }),
  Object.freeze({
    upstreamPath: "data/fashion/train-labels-idx1-ubyte.gz",
    rawName: "train-labels.idx",
    compressedBytes: 29515,
    compressedSha256: "a04f17134ac03560a47e3764e11b92fc97de4d1bfaf8ba1a3aa29af54cc90845",
    decompressedBytes: 60008,
    decompressedSha256: "bad3541b69d912435c50bb6ba87bec294ff4f6a2e1246121d8633921760443d9",
    idxMagic: 2049,
    itemCount: 60000,
    rows: null,
    columns: null
  }),
  Object.freeze({
    upstreamPath: "data/fashion/t10k-images-idx3-ubyte.gz",
    rawName: "test-images.idx",
    compressedBytes: 4422102,
    compressedSha256: "346e55b948d973a97e58d2351dde16a484bd415d4595297633bb08f03db6a073",
    decompressedBytes: 7840016,
    decompressedSha256: "5b4141f0afbad91edebe8549f8fcffe087ea10ca49f1dbef5c9a5cd8815ce37b",
    idxMagic: 2051,
    itemCount: 10000,
    rows: 28,
    columns: 28
  }),
  Object.freeze({
    upstreamPath: "data/fashion/t10k-labels-idx1-ubyte.gz",
    rawName: "test-labels.idx",
    compressedBytes: 5148,
    compressedSha256: "67da17c76eaffca5446c3361aaab5c3cd6d1c2608764d35dfb1850b086bf8dd5",
    decompressedBytes: 10008,
    decompressedSha256: "0402a96d92fd2663957122ceb108a494c5af83dab82d92729df917d7dec38c34",
    idxMagic: 2049,
    itemCount: 10000,
    rows: null,
    columns: null
  })
]);

const expectedLanes = Object.freeze([
  Object.freeze({
    laneId: "fashion-mnist-euclidean-784",
    laneKind: "natural",
    metric: "squared-euclidean",
    normalization: "none",
    dimension: 784,
    declaredRecordCount: 2000,
    activeRecordCount: 2000,
    queryCount: 200,
    classCoverage: 20
  }),
  Object.freeze({
    laneId: "fashion-mnist-cosine-784",
    laneKind: "natural",
    metric: "cosine",
    normalization: "l2-unit",
    dimension: 784,
    declaredRecordCount: 2000,
    activeRecordCount: 2000,
    queryCount: 200,
    classCoverage: 20
  }),
  Object.freeze({
    laneId: "synthetic-dot-128",
    laneKind: "synthetic",
    metric: "dot-product",
    normalization: "none",
    dimension: 128,
    declaredRecordCount: 1200,
    activeRecordCount: 1200,
    queryCount: 120,
    classCoverage: null
  }),
  Object.freeze({
    laneId: "synthetic-cosine-384",
    laneKind: "synthetic",
    metric: "cosine",
    normalization: "l2-unit",
    dimension: 384,
    declaredRecordCount: 1200,
    activeRecordCount: 1200,
    queryCount: 120,
    classCoverage: null
  }),
  Object.freeze({
    laneId: "synthetic-euclidean-768",
    laneKind: "synthetic",
    metric: "squared-euclidean",
    normalization: "none",
    dimension: 768,
    declaredRecordCount: 1200,
    activeRecordCount: 1200,
    queryCount: 120,
    classCoverage: null
  }),
  Object.freeze({
    laneId: "controlled-memory-cosine-64",
    laneKind: "controlled-memory",
    metric: "cosine",
    normalization: "l2-unit",
    dimension: 64,
    declaredRecordCount: 120,
    activeRecordCount: 110,
    queryCount: 30,
    classCoverage: 3
  })
]);

const crashScenarios = Object.freeze([
  Object.freeze({
    scenarioId: "after-snapshot-temp-sync-before-finalize",
    expectedActiveGenerationBeforeRetry: 1,
    deletionCommittedBeforeRetry: false,
    retryWroteGenerationTwo: true
  }),
  Object.freeze({
    scenarioId: "after-snapshot-finalize-before-commit-temp",
    expectedActiveGenerationBeforeRetry: 1,
    deletionCommittedBeforeRetry: false,
    retryWroteGenerationTwo: true
  }),
  Object.freeze({
    scenarioId: "after-commit-temp-sync-before-finalize",
    expectedActiveGenerationBeforeRetry: 1,
    deletionCommittedBeforeRetry: false,
    retryWroteGenerationTwo: true
  }),
  Object.freeze({
    scenarioId: "after-commit-finalize-before-obsolete-cleanup",
    expectedActiveGenerationBeforeRetry: 2,
    deletionCommittedBeforeRetry: true,
    retryWroteGenerationTwo: false
  })
]);

const observationAuthority = Object.freeze({
  sealedNumericalRankPreservationVerified: true,
  naturalImageNeighborUtilityVerified: true,
  controlledMemoryScenarioUtilityVerified: true,
  representativeSemanticMemoryQualityVerified: false,
  durableActiveIndexDeletionVerified: true,
  processCrashRecoveryVerified: true,
  powerLossDurabilityVerified: false,
  filesystemForensicErasureVerified: false,
  compressedRetrievalVerified: false,
  turboVecParityVerified: false,
  productIntegrationVerified: false,
  trainingAuthorized: false,
  releaseAuthorized: false
});

const openGaps = Object.freeze([
  Object.freeze({
    gapId: "representative-semantic-memory-quality",
    status: "not-proven",
    statement: "Natural image neighbors and controlled numeric memory scenarios do not prove representative natural-language memory usefulness."
  }),
  Object.freeze({
    gapId: "power-loss-durability",
    status: "not-tested",
    statement: "Process exits at registered write boundaries do not prove behavior under physical power loss or storage-controller cache loss."
  }),
  Object.freeze({
    gapId: "filesystem-forensic-erasure",
    status: "not-tested",
    statement: "Managed active files are scanned after cleanup, but free-space, journal, snapshot, and forensic media erasure are outside this experiment."
  }),
  Object.freeze({
    gapId: "compressed-retrieval-comparison",
    status: "not-run",
    statement: "No compressed retrieval method or TurboVec implementation is compared in this baseline observation."
  })
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are invalid`
  );
}

function exactValue(value, expected, label) {
  invariant(JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`);
}

function finiteNumber(value, label, minimum = -Number.MAX_VALUE, maximum = Number.MAX_VALUE) {
  invariant(typeof value === "number" && Number.isFinite(value) &&
    value >= minimum && value <= maximum, `${label} is invalid`);
  return value;
}

function safeInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${label} is invalid`);
  return value;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const hash = crypto.createHash("sha256");
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
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    `${label} contains a private path, credential, or internal citation`);
}

function resolveRepositoryFile(relativePath, maximumBytes = maximumInputBytes) {
  invariant(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u.test(relativePath),
    `unsafe repository path: ${relativePath}`);
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, absolutePath);
  invariant(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `repository path escaped root: ${relativePath}`);
  const stat = fs.lstatSync(absolutePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumBytes, `repository input is invalid: ${relativePath}`);
  return absolutePath;
}

function hashInput(relativePath) {
  const absolutePath = resolveRepositoryFile(relativePath);
  const stat = fs.lstatSync(absolutePath);
  return Object.freeze({
    path: relativePath,
    bytes: stat.size,
    sha256: sha256File(absolutePath)
  });
}

function assertInputsCommitted() {
  const tracked = childProcess.spawnSync("git",
    ["ls-files", "--error-unmatch", "--", ...inputPaths], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      shell: false
    });
  invariant(tracked.status === 0 && !tracked.error,
    "baseline evidence inputs are not all tracked");
  for (const argumentsList of [
    ["diff", "--quiet", "--", ...inputPaths],
    ["diff", "--cached", "--quiet", "--", ...inputPaths]
  ]) {
    const result = childProcess.spawnSync("git", argumentsList, {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      shell: false
    });
    invariant(result.status === 0 && !result.error,
      "baseline evidence inputs differ from the current commit");
  }
  const closure = childProcess.spawnSync("git", ["ls-files", "--", cratePrefix], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(closure.status === 0 && !closure.error,
    "vector oracle source closure could not be enumerated");
  const observed = String(closure.stdout || "").trim().split(/\r?\n/u)
    .filter(Boolean).sort();
  exactValue(observed, [...crateInputs].sort(), "vector oracle source closure");
}

function sourceRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "source revision probe failed");
  const revision = String(result.stdout || "").trim();
  invariant(sourceRevisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function executablePath(label) {
  if (label === "node") return fs.realpathSync.native(process.execPath);
  if (label === "rustc") {
    if (process.env.RUSTC) return process.env.RUSTC;
    const local = process.platform === "win32" && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cargo", "bin", "rustc.exe")
      : null;
    return local && fs.existsSync(local) ? local : "rustc";
  }
  return label;
}

function rustToolchainBinaryPath() {
  const result = childProcess.spawnSync(executablePath("rustc"), ["--print", "sysroot"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "Rust sysroot probe failed");
  const binaryName = process.platform === "win32" ? "rustc.exe" : "rustc";
  return fs.realpathSync.native(path.join(String(result.stdout).trim(), "bin", binaryName));
}

function toolIdentity(label) {
  const executable = label === "node" ? executablePath(label) : rustToolchainBinaryPath();
  const argumentsList = ["--version"];
  const result = childProcess.spawnSync(executable, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, `${label} version probe failed`);
  const version = String(result.stdout || result.stderr || "").trim().split(/\r?\n/u)[0];
  invariant(safeVersionPattern.test(version), `${label} version is not public-safe`);
  const stat = fs.lstatSync(executable);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= 1024 * 1024 * 1024, `${label} executable is invalid`);
  return Object.freeze({ version, sha256: sha256File(executable) });
}

function runGitAtExternalRoot(root, argumentsList, label) {
  const result = childProcess.spawnSync("git", ["-C", root, ...argumentsList], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error && String(result.stderr || "") === "",
    `${label} failed`);
  return String(result.stdout || "").trim();
}

function validateExternalDatasetRoot(manifest) {
  const configured = process.env[manifest.externalDataset.locatorEnvironmentVariable];
  invariant(typeof configured === "string" && configured.length > 0,
    "Fashion-MNIST external root is not configured");
  const root = fs.realpathSync.native(configured);
  const relativeToRepository = path.relative(repositoryRoot, root);
  invariant(relativeToRepository.startsWith("..") || path.isAbsolute(relativeToRepository),
    "external dataset root must remain outside the repository");
  invariant(runGitAtExternalRoot(root, ["rev-parse", "HEAD^{commit}"],
    "external dataset revision probe") === manifest.externalDataset.revision,
  "external dataset revision drifted");
  invariant(runGitAtExternalRoot(root, ["rev-parse", "HEAD^{tree}"],
    "external dataset tree probe") === manifest.externalDataset.tree,
  "external dataset tree drifted");
  invariant(runGitAtExternalRoot(root, ["config", "--get", "remote.origin.url"],
    "external dataset origin probe") === manifest.externalDataset.sourceRepository,
  "external dataset origin drifted");
  invariant(runGitAtExternalRoot(root, ["status", "--porcelain=v1", "--untracked-files=no"],
    "external dataset clean probe") === "", "external dataset checkout is dirty");

  const licensePath = path.join(root, manifest.externalDataset.licensePath);
  const readmePath = path.join(root, manifest.externalDataset.readmePath);
  for (const [filePath, expectedBytes, expectedSha256, label] of [
    [licensePath, manifest.externalDataset.licenseBytes,
      manifest.externalDataset.licenseSha256, "license"],
    [readmePath, manifest.externalDataset.readmeBytes,
      manifest.externalDataset.readmeSha256, "readme"]
  ]) {
    const stat = fs.lstatSync(filePath);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size === expectedBytes &&
      sha256File(filePath) === expectedSha256, `external dataset ${label} drifted`);
  }
  const files = datasetFiles.map((entry) => {
    const filePath = path.join(root, ...entry.upstreamPath.split("/"));
    const stat = fs.lstatSync(filePath);
    invariant(stat.isFile() && !stat.isSymbolicLink() &&
      stat.size === entry.compressedBytes && stat.size <= maximumDatasetFileBytes &&
      sha256File(filePath) === entry.compressedSha256,
    `external dataset file drifted: ${entry.upstreamPath}`);
    return Object.freeze({ entry, filePath });
  });
  return Object.freeze({ root, files });
}

function createOwnedRoot() {
  const parent = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, ownedRootPrefix));
  const resolved = fs.realpathSync.native(root);
  invariant(path.dirname(resolved).toLowerCase() === parent.toLowerCase() &&
    path.basename(resolved).startsWith(ownedRootPrefix),
  "owned baseline root escaped the temporary directory");
  const marker = crypto.randomBytes(32);
  fs.writeFileSync(path.join(resolved, ownedRootMarker), marker, { flag: "wx" });
  return Object.freeze({ root: resolved, markerSha256: sha256(marker) });
}

function validateOwnedRoot(owned) {
  const parent = fs.realpathSync.native(os.tmpdir());
  const resolved = fs.realpathSync.native(owned.root);
  const markerPath = path.join(resolved, ownedRootMarker);
  invariant(path.dirname(resolved).toLowerCase() === parent.toLowerCase() &&
    path.basename(resolved).startsWith(ownedRootPrefix) &&
    fs.lstatSync(markerPath).isFile() && !fs.lstatSync(markerPath).isSymbolicLink() &&
    sha256File(markerPath) === owned.markerSha256,
  "owned baseline root marker is invalid");
  return resolved;
}

function removeOwnedRoot(owned) {
  const resolved = validateOwnedRoot(owned);
  fs.rmSync(resolved, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 });
  invariant(!fs.existsSync(resolved), "owned baseline root deletion was not proven");
  return Object.freeze({
    markerSha256: owned.markerSha256,
    ownedRootDeleted: true
  });
}

async function materializeDataset(dataset, owned) {
  const root = validateOwnedRoot(owned);
  const outputRoot = path.join(root, "dataset");
  fs.mkdirSync(outputRoot, { recursive: false });
  const evidence = [];
  for (const { entry, filePath } of dataset.files) {
    const outputPath = path.join(outputRoot, entry.rawName);
    const temporaryPath = `${outputPath}.tmp`;
    await pipeline(
      fs.createReadStream(filePath),
      zlib.createGunzip(),
      fs.createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 })
    );
    const descriptor = fs.openSync(temporaryPath, "r+");
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    const stat = fs.lstatSync(temporaryPath);
    invariant(stat.isFile() && !stat.isSymbolicLink() &&
      stat.size === entry.decompressedBytes &&
      sha256File(temporaryPath) === entry.decompressedSha256,
    `decompressed dataset drifted: ${entry.upstreamPath}`);
    validateIdxHeader(temporaryPath, entry);
    fs.renameSync(temporaryPath, outputPath);
    syncDirectory(outputRoot);
    invariant(sha256File(outputPath) === entry.decompressedSha256,
      `decompressed dataset readback drifted: ${entry.upstreamPath}`);
    evidence.push(Object.freeze({
      upstreamPath: entry.upstreamPath,
      compressedBytes: entry.compressedBytes,
      compressedSha256: entry.compressedSha256,
      decompressedBytes: entry.decompressedBytes,
      decompressedSha256: entry.decompressedSha256,
      idxMagic: entry.idxMagic,
      itemCount: entry.itemCount,
      rows: entry.rows,
      columns: entry.columns
    }));
  }
  return Object.freeze({ outputRoot, evidence });
}

function validateIdxHeader(filePath, expected) {
  const headerBytes = expected.idxMagic === 2051 ? 16 : 8;
  const descriptor = fs.openSync(filePath, "r");
  const header = Buffer.alloc(headerBytes);
  try {
    invariant(fs.readSync(descriptor, header, 0, header.length, 0) === header.length,
      "IDX header is truncated");
  } finally {
    fs.closeSync(descriptor);
  }
  invariant(header.readUInt32BE(0) === expected.idxMagic &&
    header.readUInt32BE(4) === expected.itemCount, "IDX identity drifted");
  if (expected.idxMagic === 2051) {
    invariant(header.readUInt32BE(8) === expected.rows &&
      header.readUInt32BE(12) === expected.columns, "IDX image shape drifted");
  }
}

function materializeBuildArguments(template, outputRoot) {
  invariant(Array.isArray(template) && template[0] === "rustc",
    "registered build command is invalid");
  const replacement = outputRoot.replaceAll("\\", "/");
  return template.slice(1).map((argument) =>
    argument.replaceAll("<owned-output-directory>", replacement));
}

function runCompile(role, template, outputRoot) {
  const argumentsList = materializeBuildArguments(template, outputRoot);
  const result = childProcess.spawnSync(executablePath("rustc"), argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: maximumCommandOutputBytes,
    timeout: 120000,
    shell: false,
    windowsHide: true
  });
  const output = Buffer.from(`${result.stdout || ""}\n${result.stderr || ""}`, "utf8");
  const evidence = Object.freeze({
    role,
    executable: "rustc",
    arguments: [...template.slice(1)],
    exitCode: Number.isInteger(result.status) ? result.status : -1,
    outputSha256: sha256(output),
    spawnErrorCode: result.error && typeof result.error.code === "string"
      ? result.error.code.slice(0, 64)
      : null
  });
  invariant(evidence.exitCode === 0 && evidence.spawnErrorCode === null,
    `${role} compilation failed`);
  return evidence;
}

function boundedBinary(filePath, label) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= 1024 * 1024 * 1024, `${label} binary is invalid`);
  return Object.freeze({ bytes: stat.size, sha256: sha256File(filePath) });
}

function executeQuality(binaryPath, datasetRoot, timeoutMs) {
  const result = childProcess.spawnSync(binaryPath, ["--quality"], {
    cwd: datasetRoot,
    encoding: "utf8",
    env: Object.freeze({ RUST_BACKTRACE: "0" }),
    maxBuffer: maximumEvidenceBytes,
    timeout: timeoutMs,
    shell: false,
    windowsHide: true
  });
  invariant(Number.isInteger(result.status) && result.status === 0 && !result.error &&
    result.signal === null && String(result.stderr || "") === "",
  "quality process failed");
  const stdout = String(result.stdout || "");
  const quality = validateQualityOutput(stdout);
  return Object.freeze({
    result: quality,
    exitCode: result.status,
    stdoutSha256: sha256(Buffer.from(stdout, "utf8")),
    stderrSha256: sha256(Buffer.from("", "utf8"))
  });
}

function validateQualityOutput(stdout) {
  const bytes = Buffer.from(stdout, "utf8");
  invariant(bytes.length > 0 && bytes.length <= maximumEvidenceBytes,
    "quality stdout is not bounded");
  const value = JSON.parse(stdout);
  exactKeys(value, [
    "schema", "experimentId", "qualityProcessOrdinal", "datasetName", "datasetRevision",
    "selectionAlgorithm", "selectionSha256", "topKValues", "laneResults",
    "perQueryMetrics"
  ], "quality output");
  invariant(value.schema === qualitySchema && value.experimentId === expectedExperimentId &&
    value.qualityProcessOrdinal === 1 && value.datasetName === "Fashion-MNIST" &&
    value.datasetRevision === "b2617bb6d3ffa2e429640350f613e3291e10b141" &&
    value.selectionAlgorithm === "sha256-seed-split-label-index-smallest-v1" &&
    sha256Pattern.test(value.selectionSha256),
  "quality identity is invalid");
  exactValue(value.topKValues, [1, 10, 100], "quality topKValues");
  invariant(Array.isArray(value.laneResults) &&
    value.laneResults.length === expectedLanes.length, "quality lanes are incomplete");
  invariant(Array.isArray(value.perQueryMetrics) &&
    value.perQueryMetrics.length === expectedLanes
      .reduce((total, lane) => total + lane.queryCount, 0),
  "quality per-query coverage is incomplete");

  let queryOffset = 0;
  for (const [laneIndex, expectedLane] of expectedLanes.entries()) {
    const queries = value.perQueryMetrics.slice(queryOffset,
      queryOffset + expectedLane.queryCount);
    queries.forEach((query, ordinal) =>
      validateQueryMetric(query, expectedLane, ordinal));
    validateLaneResult(value.laneResults[laneIndex], expectedLane, queries);
    queryOffset += expectedLane.queryCount;
  }
  invariant(queryOffset === value.perQueryMetrics.length,
    "quality query ordering is incomplete");
  invariant(bytes.equals(Buffer.from(`${JSON.stringify(value)}\n`, "utf8")),
    "quality stdout is not canonical compact JSON");
  publicSafe(value, "quality output");
  return value;
}

function expectedClassOrTopic(lane, ordinal) {
  if (lane.laneKind === "natural") return Math.floor(ordinal / 20);
  if (lane.laneKind === "controlled-memory") return Math.floor(ordinal / 3);
  const boundaries = [30, 24, 24, 18, 12, 12];
  let offset = 0;
  for (const [family, count] of boundaries.entries()) {
    if (ordinal < offset + count) return family;
    offset += count;
  }
  throw new Error("synthetic query family is invalid");
}

function validateQueryMetric(value, lane, ordinal) {
  exactKeys(value, [
    "laneId", "queryOrdinal", "classOrTopic", "recallAt1", "recallAt10",
    "recallAt100", "mrrAt100", "ndcgAt100", "rankInversionsAt100",
    "maximumAbsoluteScoreError", "meanAbsoluteScoreError", "labelPrecisionAt10",
    "labelMrrAt10", "labelNdcgAt10", "expectedFirstHit", "forbiddenHitCountAt10",
    "deletedHitCount", "filterViolationCount"
  ], `query ${lane.laneId}/${ordinal}`);
  invariant(value.laneId === lane.laneId && value.queryOrdinal === ordinal &&
    value.classOrTopic === expectedClassOrTopic(lane, ordinal),
  `query identity is invalid: ${lane.laneId}/${ordinal}`);
  for (const field of ["recallAt1", "recallAt10", "recallAt100", "mrrAt100",
    "ndcgAt100"]) {
    invariant(value[field] === 1, `query ${field} failed: ${lane.laneId}/${ordinal}`);
  }
  invariant(value.rankInversionsAt100 === 0 &&
    finiteNumber(value.maximumAbsoluteScoreError,
      `query score error ${lane.laneId}/${ordinal}`, 0, 1e-12) <= 1e-12 &&
    finiteNumber(value.meanAbsoluteScoreError,
      `query mean score error ${lane.laneId}/${ordinal}`, 0, 1e-12) <= 1e-12,
  `query exact baseline failed: ${lane.laneId}/${ordinal}`);
  if (lane.laneKind === "natural") {
    for (const field of ["labelPrecisionAt10", "labelMrrAt10", "labelNdcgAt10"]) {
      finiteNumber(value[field], `query ${field} ${lane.laneId}/${ordinal}`, 0, 1);
    }
    invariant(value.expectedFirstHit === null && value.forbiddenHitCountAt10 === null &&
      value.deletedHitCount === null && value.filterViolationCount === null,
    `natural query contains controlled metrics: ${lane.laneId}/${ordinal}`);
  } else if (lane.laneKind === "controlled-memory") {
    invariant(value.labelPrecisionAt10 === null && value.labelMrrAt10 === null &&
      value.labelNdcgAt10 === null && value.expectedFirstHit === true &&
      value.forbiddenHitCountAt10 === 0 && value.deletedHitCount === 0 &&
      value.filterViolationCount === 0,
    `controlled query policy failed: ${lane.laneId}/${ordinal}`);
  } else {
    invariant(value.labelPrecisionAt10 === null && value.labelMrrAt10 === null &&
      value.labelNdcgAt10 === null && value.expectedFirstHit === null &&
      value.forbiddenHitCountAt10 === null && value.deletedHitCount === null &&
      value.filterViolationCount === null,
    `synthetic query contains task metrics: ${lane.laneId}/${ordinal}`);
  }
}

function validateLaneResult(value, expected, queries) {
  exactKeys(value, [
    "laneId", "laneKind", "metric", "normalization", "dimension",
    "declaredRecordCount", "activeRecordCount", "queryCount", "topKValues",
    "minimumRecallAt1", "minimumRecallAt10", "minimumRecallAt100",
    "minimumMrrAt100", "minimumNdcgAt100", "rankInversionsAt100",
    "maximumAbsoluteScoreError", "meanAbsoluteScoreError", "naturalUtility",
    "controlledUtility"
  ], `lane ${expected.laneId}`);
  for (const field of [
    "laneId", "laneKind", "metric", "normalization", "dimension",
    "declaredRecordCount", "activeRecordCount", "queryCount"
  ]) {
    invariant(value[field] === expected[field],
      `lane ${expected.laneId} ${field} is invalid`);
  }
  exactValue(value.topKValues, [1, 10, 100], `lane ${expected.laneId} topKValues`);
  invariant(value.minimumRecallAt1 === 1 && value.minimumRecallAt10 === 1 &&
    value.minimumRecallAt100 === 1 && value.minimumMrrAt100 === 1 &&
    value.minimumNdcgAt100 === 1 && value.rankInversionsAt100 === 0,
  `lane exact rank threshold failed: ${expected.laneId}`);
  finiteNumber(value.maximumAbsoluteScoreError,
    `lane maximum score error ${expected.laneId}`, 0, 1e-12);
  finiteNumber(value.meanAbsoluteScoreError,
    `lane mean score error ${expected.laneId}`, 0, 1e-12);
  const maxScore = Math.max(...queries.map((query) => query.maximumAbsoluteScoreError));
  const meanScore = queries
    .reduce((total, query) => total + query.meanAbsoluteScoreError, 0) / queries.length;
  invariant(value.maximumAbsoluteScoreError === maxScore &&
    Math.abs(value.meanAbsoluteScoreError - meanScore) <= Number.EPSILON,
  `lane score aggregate is invalid: ${expected.laneId}`);
  if (expected.laneKind === "natural") {
    validateNaturalUtility(value.naturalUtility, expected, queries);
    invariant(value.controlledUtility === null,
      `natural lane contains controlled utility: ${expected.laneId}`);
  } else if (expected.laneKind === "controlled-memory") {
    validateControlledUtility(value.controlledUtility, expected, queries);
    invariant(value.naturalUtility === null,
      `controlled lane contains natural utility: ${expected.laneId}`);
  } else {
    invariant(value.naturalUtility === null && value.controlledUtility === null,
      `synthetic lane contains task utility: ${expected.laneId}`);
  }
}

function validateNaturalUtility(value, lane, queries) {
  exactKeys(value, [
    "macroLabelPrecisionAt10", "macroLabelMrrAt10", "macroLabelNdcgAt10",
    "perClassQueryCoverage"
  ], `natural utility ${lane.laneId}`);
  exactValue(value.perClassQueryCoverage, Array(10).fill(lane.classCoverage),
    `natural utility coverage ${lane.laneId}`);
  const metrics = [
    ["labelPrecisionAt10", "macroLabelPrecisionAt10", 0.5],
    ["labelMrrAt10", "macroLabelMrrAt10", 0.75],
    ["labelNdcgAt10", "macroLabelNdcgAt10", 0.7]
  ];
  for (const [queryField, aggregateField, threshold] of metrics) {
    const classMeans = [];
    for (let classIndex = 0; classIndex < 10; classIndex += 1) {
      const matching = queries.filter((query) => query.classOrTopic === classIndex);
      invariant(matching.length === lane.classCoverage,
        `natural class coverage is invalid: ${lane.laneId}/${classIndex}`);
      classMeans.push(matching.reduce((total, query) => total + query[queryField], 0) /
        matching.length);
    }
    const expected = classMeans.reduce((total, item) => total + item, 0) /
      classMeans.length;
    finiteNumber(value[aggregateField], `natural ${aggregateField} ${lane.laneId}`, 0, 1);
    invariant(Math.abs(value[aggregateField] - expected) <= Number.EPSILON * 4 &&
      value[aggregateField] >= threshold,
    `natural utility threshold failed: ${lane.laneId}/${aggregateField}`);
  }
}

function validateControlledUtility(value, lane, queries) {
  exactKeys(value, [
    "expectedFirstHitRate", "forbiddenHitRateAt10", "deletedHitCount",
    "filterViolationCount"
  ], `controlled utility ${lane.laneId}`);
  invariant(queries.length === lane.queryCount &&
    value.expectedFirstHitRate === 1 && value.forbiddenHitRateAt10 === 0 &&
    value.deletedHitCount === 0 && value.filterViolationCount === 0,
  "controlled memory utility threshold failed");
}

function createDeletionRoot(owned, scenario) {
  const parent = validateOwnedRoot(owned);
  const root = path.join(parent, `deletion-${scenario.scenarioId}`);
  fs.mkdirSync(root, { recursive: false });
  fs.writeFileSync(path.join(root, deletionRootMarker), deletionRootMarkerBytes,
    { flag: "wx", mode: 0o600 });
  return root;
}

function validateDeletionRoot(owned, root, scenario) {
  const parent = validateOwnedRoot(owned);
  const resolved = fs.realpathSync.native(root);
  const expected = path.join(parent, `deletion-${scenario.scenarioId}`);
  invariant(resolved.toLowerCase() === expected.toLowerCase() &&
    path.dirname(resolved).toLowerCase() === parent.toLowerCase(),
  "deletion root escaped the owned root");
  const marker = path.join(resolved, deletionRootMarker);
  invariant(fs.lstatSync(marker).isFile() && !fs.lstatSync(marker).isSymbolicLink() &&
    fs.readFileSync(marker).equals(deletionRootMarkerBytes),
  "deletion root marker is invalid");
  return resolved;
}

function removeDeletionRoot(owned, root, scenario) {
  const resolved = validateDeletionRoot(owned, root, scenario);
  fs.rmSync(resolved, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 });
  invariant(!fs.existsSync(resolved), "deletion root deletion was not proven");
  return true;
}

function executeCrashScenario(binaryPath, owned, scenario, timeoutMs) {
  const root = createDeletionRoot(owned, scenario);
  try {
    const crashed = childProcess.spawnSync(binaryPath,
      ["--crash", scenario.scenarioId], {
        cwd: root,
        encoding: "utf8",
        env: Object.freeze({ RUST_BACKTRACE: "0" }),
        maxBuffer: 1024 * 1024,
        timeout: timeoutMs,
        shell: false,
        windowsHide: true
      });
    invariant(crashed.status === 73 && !crashed.error && crashed.signal === null &&
      String(crashed.stdout || "") === "" && String(crashed.stderr || "") === "",
    `intentional crash process failed: ${scenario.scenarioId}`);
    const recovered = childProcess.spawnSync(binaryPath,
      ["--recover", scenario.scenarioId], {
        cwd: root,
        encoding: "utf8",
        env: Object.freeze({ RUST_BACKTRACE: "0" }),
        maxBuffer: 1024 * 1024,
        timeout: timeoutMs,
        shell: false,
        windowsHide: true
      });
    invariant(recovered.status === 0 && !recovered.error && recovered.signal === null &&
      String(recovered.stderr || "") === "",
    `recovery process failed: ${scenario.scenarioId}`);
    const recovery = validateRecoveryOutput(String(recovered.stdout || ""), scenario);
    const managedFileCountBeforeRootDeletion = fs.readdirSync(root).length;
    invariant(managedFileCountBeforeRootDeletion === 3,
      `recovery left an invalid managed file set: ${scenario.scenarioId}`);
    return Object.freeze({
      scenarioId: scenario.scenarioId,
      crashExitCode: crashed.status,
      crashStdoutSha256: sha256(Buffer.from(crashed.stdout || "", "utf8")),
      crashStderrSha256: sha256(Buffer.from(crashed.stderr || "", "utf8")),
      recoveryExitCode: recovered.status,
      recoveryStdoutSha256: sha256(Buffer.from(recovered.stdout || "", "utf8")),
      recoveryStderrSha256: sha256(Buffer.from(recovered.stderr || "", "utf8")),
      managedFileCountBeforeRootDeletion,
      recovery,
      ownedDeletionRootDeleted: false
    });
  } finally {
    if (fs.existsSync(root)) removeDeletionRoot(owned, root, scenario);
  }
}

function validateRecoveryOutput(stdout, expected) {
  const bytes = Buffer.from(stdout, "utf8");
  invariant(bytes.length > 0 && bytes.length <= 1024 * 1024,
    "recovery stdout is not bounded");
  const value = JSON.parse(stdout);
  exactKeys(value, [
    "schema", "experimentId", "scenarioId", "processCrashExitCode",
    "expectedActiveGenerationBeforeRetry", "observedActiveGenerationBeforeRetry",
    "deletionCommittedBeforeRetry", "finalActiveGeneration",
    "retryWroteGenerationTwo", "retryIdempotent", "finalTargetIdentifierMatches",
    "finalTargetVectorFingerprintMatches", "activeIndexContainsAnyDeletedTarget",
    "activeIndexContainsActiveDeletedTarget", "allCrashScenariosMustRecover",
    "powerLossSimulated", "filesystemForensicErasureTested", "removedManagedFileCount",
    "directoryFlushAttempted", "directoryFlushSucceeded", "finalSnapshotSha256",
    "finalCommitSha256"
  ], `recovery ${expected.scenarioId}`);
  invariant(value.schema === recoverySchema && value.experimentId === expectedExperimentId &&
    value.scenarioId === expected.scenarioId && value.processCrashExitCode === 73 &&
    value.expectedActiveGenerationBeforeRetry ===
      expected.expectedActiveGenerationBeforeRetry &&
    value.observedActiveGenerationBeforeRetry ===
      expected.expectedActiveGenerationBeforeRetry &&
    value.deletionCommittedBeforeRetry === expected.deletionCommittedBeforeRetry &&
    value.finalActiveGeneration === 2 &&
    value.retryWroteGenerationTwo === expected.retryWroteGenerationTwo &&
    value.retryIdempotent === true && value.finalTargetIdentifierMatches === 0 &&
    value.finalTargetVectorFingerprintMatches === 0 &&
    value.activeIndexContainsAnyDeletedTarget === false &&
    value.activeIndexContainsActiveDeletedTarget === false &&
    value.allCrashScenariosMustRecover === true && value.powerLossSimulated === false &&
    value.filesystemForensicErasureTested === false &&
    safeInteger(value.removedManagedFileCount,
      `removed managed file count ${expected.scenarioId}`, 2, 32) >= 2 &&
    value.directoryFlushAttempted === true &&
    typeof value.directoryFlushSucceeded === "boolean" &&
    sha256Pattern.test(value.finalSnapshotSha256) &&
    sha256Pattern.test(value.finalCommitSha256),
  `recovery semantics are invalid: ${expected.scenarioId}`);
  invariant(bytes.equals(Buffer.from(`${JSON.stringify(value)}\n`, "utf8")),
    `recovery stdout is not canonical: ${expected.scenarioId}`);
  publicSafe(value, `recovery ${expected.scenarioId}`);
  return value;
}

function finalizeIdentity(body, prefix) {
  const contentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    observationId: `${prefix}-${contentHash.slice(0, 16)}`,
    observationContentHash: contentHash
  });
}

function finalizeObservation(body) {
  return finalizeIdentity(body, "exact-flat-baseline-evidence");
}

function observationIdentity(value) {
  const body = { ...value };
  delete body.observationId;
  delete body.observationContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `exact-flat-baseline-evidence-${hash.slice(0, 16)}`,
    hash
  });
}

function validateObservation(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "observedAtUtc", "sourceRevision",
    "preregistration", "parents", "externalDataset", "inputs", "tools", "build",
    "qualityExecution", "quality", "crashRecoveries", "thresholdDecision", "cleanup",
    "authority", "openGaps", "requiredNextGate", "observationId",
    "observationContentHash"
  ], "observation");
  invariant(value.schema === observationSchema && value.experimentId === expectedExperimentId &&
    value.status === "pass" && utcPattern.test(value.observedAtUtc) &&
    Number.isFinite(Date.parse(value.observedAtUtc)) &&
    sourceRevisionPattern.test(value.sourceRevision), "observation identity is invalid");
  const identity = observationIdentity(value);
  invariant(value.observationId === identity.id &&
    value.observationContentHash === identity.hash,
  "observation content identity is invalid");
  const manifestResult = validateManifestFile();
  const manifest = manifestResult.manifest;
  exactKeys(value.preregistration, ["path", "sha256"], "observation preregistration");
  invariant(value.preregistration.path === preregistrationRelativePath &&
    value.preregistration.sha256 === manifestResult.sha256,
  "observation preregistration is invalid");
  invariant(Array.isArray(value.parents) &&
    value.parents.length === manifest.parents.length,
  "observation parents are incomplete");
  value.parents.forEach((parent, index) => {
    exactKeys(parent, ["path", "sha256"], `observation parent ${index}`);
    exactValue(parent, {
      path: manifest.parents[index].path,
      sha256: manifest.parents[index].sha256
    }, `observation parent ${index}`);
  });

  exactKeys(value.externalDataset, [
    "sourceRepository", "revision", "tree", "licenseExpression", "licenseBytes",
    "licenseSha256", "readmeBytes", "readmeSha256", "files", "checkoutClean",
    "locatorPersisted", "bytesPersisted"
  ], "observation external dataset");
  invariant(value.externalDataset.sourceRepository ===
      manifest.externalDataset.sourceRepository &&
    value.externalDataset.revision === manifest.externalDataset.revision &&
    value.externalDataset.tree === manifest.externalDataset.tree &&
    value.externalDataset.licenseExpression ===
      manifest.externalDataset.licenseExpression &&
    value.externalDataset.licenseBytes === manifest.externalDataset.licenseBytes &&
    value.externalDataset.licenseSha256 === manifest.externalDataset.licenseSha256 &&
    value.externalDataset.readmeBytes === manifest.externalDataset.readmeBytes &&
    value.externalDataset.readmeSha256 === manifest.externalDataset.readmeSha256 &&
    value.externalDataset.checkoutClean === true &&
    value.externalDataset.locatorPersisted === false &&
    value.externalDataset.bytesPersisted === false &&
    Array.isArray(value.externalDataset.files) &&
    value.externalDataset.files.length === datasetFiles.length,
  "observation external dataset evidence is invalid");
  value.externalDataset.files.forEach((entry, index) => {
    exactKeys(entry, [
      "upstreamPath", "compressedBytes", "compressedSha256", "decompressedBytes",
      "decompressedSha256", "idxMagic", "itemCount", "rows", "columns"
    ], `observation external dataset file ${index}`);
    const expected = datasetFiles[index];
    exactValue(entry, {
      upstreamPath: expected.upstreamPath,
      compressedBytes: expected.compressedBytes,
      compressedSha256: expected.compressedSha256,
      decompressedBytes: expected.decompressedBytes,
      decompressedSha256: expected.decompressedSha256,
      idxMagic: expected.idxMagic,
      itemCount: expected.itemCount,
      rows: expected.rows,
      columns: expected.columns
    }, `observation external dataset file ${index}`);
  });

  invariant(Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "observation inputs are incomplete");
  value.inputs.forEach((input, index) => {
    exactKeys(input, ["path", "bytes", "sha256"], `observation input ${index}`);
    validateGitInput(
      input,
      repositoryRoot,
      value.sourceRevision,
      inputPaths[index],
      `observation input ${index}`,
      maximumInputBytes
    );
  });
  exactKeys(value.tools, ["node", "rustc"], "observation tools");
  for (const [label, tool] of Object.entries(value.tools)) {
    exactKeys(tool, ["version", "sha256"], `observation tool ${label}`);
    invariant(safeVersionPattern.test(tool.version) && sha256Pattern.test(tool.sha256),
      "observation tool identity is invalid");
  }
  exactKeys(value.build, [
    "library", "benchmark", "libraryBinary", "benchmarkBinary"
  ], "observation build");
  const buildTemplates = {
    library: manifest.build.libraryCommand,
    benchmark: manifest.build.benchmarkCommand
  };
  for (const role of ["library", "benchmark"]) {
    const build = value.build[role];
    exactKeys(build, [
      "role", "executable", "arguments", "exitCode", "outputSha256", "spawnErrorCode"
    ], `observation ${role} build`);
    invariant(build.role === role && build.executable === "rustc" &&
      build.exitCode === 0 &&
      Array.isArray(build.arguments) &&
      JSON.stringify(build.arguments) === JSON.stringify(buildTemplates[role].slice(1)) &&
      build.spawnErrorCode === null && sha256Pattern.test(build.outputSha256),
    `observation ${role} build failed`);
  }
  for (const role of ["libraryBinary", "benchmarkBinary"]) {
    exactKeys(value.build[role], ["bytes", "sha256"],
      `observation ${role} identity`);
    invariant(safeInteger(value.build[role].bytes,
      `observation ${role} bytes`, 1, 1024 * 1024 * 1024) > 0 &&
      sha256Pattern.test(value.build[role].sha256),
    `observation ${role} identity is invalid`);
  }
  exactKeys(value.qualityExecution, [
    "exitCode", "stdoutSha256", "stderrSha256"
  ], "observation quality execution");
  const qualityBytes = Buffer.from(`${JSON.stringify(value.quality)}\n`, "utf8");
  validateQualityOutput(qualityBytes.toString("utf8"));
  const emptyOutputSha256 = sha256(Buffer.alloc(0));
  invariant(value.qualityExecution.exitCode === 0 &&
    value.qualityExecution.stdoutSha256 === sha256(qualityBytes) &&
    value.qualityExecution.stderrSha256 === emptyOutputSha256,
  "observation quality execution is invalid");
  invariant(Array.isArray(value.crashRecoveries) &&
    value.crashRecoveries.length === crashScenarios.length,
  "observation crash recovery coverage is invalid");
  value.crashRecoveries.forEach((entry, index) => {
    const expected = crashScenarios[index];
    exactKeys(entry, [
      "scenarioId", "crashExitCode", "crashStdoutSha256", "crashStderrSha256",
      "recoveryExitCode", "recoveryStdoutSha256", "recoveryStderrSha256",
      "managedFileCountBeforeRootDeletion", "recovery", "ownedDeletionRootDeleted"
    ], `observation crash execution ${expected.scenarioId}`);
    const recoveryBytes = Buffer.from(`${JSON.stringify(entry.recovery)}\n`, "utf8");
    validateRecoveryOutput(recoveryBytes.toString("utf8"), expected);
    invariant(entry.scenarioId === expected.scenarioId && entry.crashExitCode === 73 &&
      entry.recoveryExitCode === 0 && entry.managedFileCountBeforeRootDeletion === 3 &&
      entry.ownedDeletionRootDeleted === true &&
      entry.crashStdoutSha256 === emptyOutputSha256 &&
      entry.crashStderrSha256 === emptyOutputSha256 &&
      entry.recoveryStdoutSha256 === sha256(recoveryBytes) &&
      entry.recoveryStderrSha256 === emptyOutputSha256,
    `observation crash execution is invalid: ${expected.scenarioId}`);
  });
  exactValue(value.thresholdDecision, {
    status: "pass",
    allSixQualityLanesComplete: true,
    allPerQueryMetricsRetained: true,
    allFrozenThresholdsPassed: true,
    allFourCrashScenariosRecovered: true,
    committedDeletionRemainedDeletedAfterRestart: true,
    finalManagedFileScansPassed: true,
    resultDrivenThresholdChanges: false
  }, "observation threshold decision");
  exactKeys(value.cleanup, ["markerSha256", "ownedRootDeleted"],
    "observation cleanup");
  invariant(value.cleanup.ownedRootDeleted === true &&
    sha256Pattern.test(value.cleanup.markerSha256),
  "observation cleanup is invalid");
  exactValue(value.authority, observationAuthority, "observation authority");
  exactValue(value.openGaps, openGaps, "observation open gaps");
  exactValue(value.requiredNextGate, manifest.requiredNextGate,
    "observation next gate");
  publicSafe(value, "observation");
  return value;
}

function validateObservationFile(filePath = observationPath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumEvidenceBytes, "observation must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const observation = validateObservation(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalPrettyBytes(observation)),
    "observation bytes are not canonical pretty JSON");
  return Object.freeze({ observation, bytes: bytes.length, sha256: sha256(bytes) });
}

function attemptIdentity(value) {
  const body = { ...value };
  delete body.attemptId;
  delete body.attemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `exact-flat-baseline-evidence-attempt-${hash.slice(0, 16)}`,
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

function validateAttempt(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "startedAtUtc", "completedAtUtc",
    "sourceRevision", "preregistrationSha256", "observationId",
    "observationContentHash", "failure", "attemptId", "attemptContentHash"
  ], "attempt");
  const manifestResult = validateManifestFile();
  invariant(value.schema === attemptSchema && value.experimentId === expectedExperimentId &&
    ["pass", "fail"].includes(value.status) && utcPattern.test(value.startedAtUtc) &&
    Number.isFinite(Date.parse(value.startedAtUtc)) &&
    utcPattern.test(value.completedAtUtc) &&
    Number.isFinite(Date.parse(value.completedAtUtc)) &&
    Date.parse(value.completedAtUtc) >=
      Date.parse(value.startedAtUtc) &&
    (value.sourceRevision === null || sourceRevisionPattern.test(value.sourceRevision)) &&
    value.preregistrationSha256 === manifestResult.sha256,
  "attempt identity is invalid");
  const identity = attemptIdentity(value);
  invariant(value.attemptId === identity.id && value.attemptContentHash === identity.hash,
    "attempt content identity is invalid");
  if (value.status === "pass") {
    invariant(/^exact-flat-baseline-evidence-[a-f0-9]{16}$/u.test(value.observationId) &&
      sha256Pattern.test(value.observationContentHash) && value.failure === null,
    "passing attempt is incomplete");
  } else {
    invariant(value.observationId === null && value.observationContentHash === null,
      "failed attempt cannot claim an observation");
    exactKeys(value.failure, ["code", "errorName", "messageSha256"], "attempt failure");
    invariant(value.failure.code === "baseline-evidence-observation-failed" &&
      /^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(value.failure.errorName) &&
      sha256Pattern.test(value.failure.messageSha256),
    "failed attempt diagnostics are invalid");
  }
  publicSafe(value, "attempt");
  return value;
}

function writeAttempt(attempt) {
  validateAttempt(attempt);
  const filePath = path.join(attemptDirectory, attempt.attemptContentHash.slice(0, 2),
    `${attempt.attemptContentHash}.json`);
  atomicCreate(filePath, canonicalPrettyBytes(attempt));
  return filePath;
}

function boundedFailure(error) {
  const message = String(error?.message || "baseline evidence observation failed");
  return Object.freeze({
    code: "baseline-evidence-observation-failed",
    errorName: error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(error.name)
      ? error.name
      : "Error",
    messageSha256: sha256(Buffer.from(message, "utf8"))
  });
}

async function generateObservation() {
  assertInputsCommitted();
  const manifestResult = validateManifestFile();
  const manifest = manifestResult.manifest;
  const revision = sourceRevision();
  const dataset = validateExternalDatasetRoot(manifest);
  const owned = createOwnedRoot();
  let cleanup = null;
  try {
    const materialized = await materializeDataset(dataset, owned);
    const outputRoot = validateOwnedRoot(owned);
    const library = runCompile("library", manifest.build.libraryCommand, outputRoot);
    const benchmark = runCompile("benchmark", manifest.build.benchmarkCommand, outputRoot);
    const libraryBinaryPath = path.join(outputRoot,
      process.platform === "win32"
        ? "libtinyrustlm_vector_oracle.rlib"
        : "libtinyrustlm_vector_oracle.rlib");
    const benchmarkBinaryPath = path.join(outputRoot,
      process.platform === "win32"
        ? "exact_flat_baseline_evidence_benchmark.exe"
        : "exact_flat_baseline_evidence_benchmark.exe");
    const libraryBinary = boundedBinary(libraryBinaryPath, "library");
    const benchmarkBinary = boundedBinary(benchmarkBinaryPath, "benchmark");
    const qualityExecution = executeQuality(
      benchmarkBinaryPath,
      materialized.outputRoot,
      manifest.execution.timeoutMsPerProcess
    );
    const crashRecoveries = crashScenarios.map((scenario) => {
      const result = executeCrashScenario(
        benchmarkBinaryPath,
        owned,
        scenario,
        manifest.execution.timeoutMsPerProcess
      );
      return Object.freeze({ ...result, ownedDeletionRootDeleted: true });
    });
    cleanup = removeOwnedRoot(owned);
    const body = {
      schema: observationSchema,
      experimentId: expectedExperimentId,
      status: "pass",
      observedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistration: {
        path: preregistrationRelativePath,
        sha256: manifestResult.sha256
      },
      parents: manifest.parents.map((parent) => ({
        path: parent.path,
        sha256: parent.sha256
      })),
      externalDataset: {
        sourceRepository: manifest.externalDataset.sourceRepository,
        revision: manifest.externalDataset.revision,
        tree: manifest.externalDataset.tree,
        licenseExpression: manifest.externalDataset.licenseExpression,
        licenseBytes: manifest.externalDataset.licenseBytes,
        licenseSha256: manifest.externalDataset.licenseSha256,
        readmeBytes: manifest.externalDataset.readmeBytes,
        readmeSha256: manifest.externalDataset.readmeSha256,
        files: materialized.evidence,
        checkoutClean: true,
        locatorPersisted: false,
        bytesPersisted: false
      },
      inputs: inputPaths.map(hashInput),
      tools: {
        node: toolIdentity("node"),
        rustc: toolIdentity("rustc")
      },
      build: { library, benchmark, libraryBinary, benchmarkBinary },
      qualityExecution: {
        exitCode: qualityExecution.exitCode,
        stdoutSha256: qualityExecution.stdoutSha256,
        stderrSha256: qualityExecution.stderrSha256
      },
      quality: qualityExecution.result,
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
      cleanup,
      authority: observationAuthority,
      openGaps,
      requiredNextGate: manifest.requiredNextGate
    };
    const observation = finalizeObservation(body);
    validateObservation(observation);
    return observation;
  } finally {
    if (cleanup === null && fs.existsSync(owned.root)) {
      removeOwnedRoot(owned);
    }
  }
}

async function runAndWriteObservation() {
  const startedAtUtc = new Date().toISOString();
  let revision = null;
  let preregistrationSha256 = null;
  try {
    preregistrationSha256 = validateManifestFile().sha256;
    revision = sourceRevision();
    const observation = await generateObservation();
    atomicCreate(observationPath, canonicalPrettyBytes(observation));
    const reopened = validateObservationFile(observationPath);
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      status: "pass",
      startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistrationSha256,
      observationId: reopened.observation.observationId,
      observationContentHash: reopened.observation.observationContentHash,
      failure: null
    });
    const attemptPath = writeAttempt(attempt);
    return Object.freeze({ observation: reopened, attempt, attemptPath });
  } catch (error) {
    if (preregistrationSha256 === null) {
      try {
        preregistrationSha256 = validateManifestFile().sha256;
      } catch {
        preregistrationSha256 = "0".repeat(64);
      }
    }
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      status: "fail",
      startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistrationSha256,
      observationId: null,
      observationContentHash: null,
      failure: boundedFailure(error)
    });
    if (preregistrationSha256 !== "0".repeat(64)) writeAttempt(attempt);
    throw error;
  }
}

async function main(argumentsList) {
  invariant(argumentsList.length === 1 &&
    ["--write", "--validate"].includes(argumentsList[0]),
  "usage: node vector-baseline-evidence-observation.js --write|--validate");
  if (argumentsList[0] === "--validate") {
    const result = validateObservationFile();
    process.stdout.write(`${JSON.stringify({
      schema: result.observation.schema,
      observationId: result.observation.observationId,
      sha256: result.sha256,
      status: "valid"
    })}\n`);
    return;
  }
  const result = await runAndWriteObservation();
  process.stdout.write(`${JSON.stringify({
    schema: result.observation.observation.schema,
    observationId: result.observation.observation.observationId,
    observationSha256: result.observation.sha256,
    attemptId: result.attempt.attemptId,
    status: "written"
  })}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "baseline evidence observation failed"}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  attemptIdentity,
  attemptSchema,
  benchmarkRelativePath,
  boundedFailure,
  canonicalPrettyBytes,
  crashScenarios,
  datasetFiles,
  expectedExperimentId,
  expectedLanes,
  finalizeAttempt,
  finalizeObservation,
  generateObservation,
  hashInput,
  inputPaths,
  observationAuthority,
  observationIdentity,
  observationPath,
  observationSchema,
  openGaps,
  preregistrationRelativePath,
  qualitySchema,
  recoverySchema,
  runAndWriteObservation,
  sha256,
  validateAttempt,
  validateObservation,
  validateObservationFile,
  validateQualityOutput,
  validateRecoveryOutput
});
