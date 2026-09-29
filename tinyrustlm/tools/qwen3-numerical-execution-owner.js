"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { requireCanonicalArtifactPath, requireCanonicalSiteRoot } =
  require("./canonical-operation-scratch.js");
const { verifySingleSourceAuthority } = require("./verify-single-source-authority.js");

const CANONICAL_REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const MODEL_ROOT = "D:\\LLMs\\TinyRustLM";
const ISOLATED_PYTHON_ARGUMENTS = Object.freeze(["-I", "-B", "-X", "utf8"]);

const REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_execution_request.v6";
const REGISTRATION_SCHEMA =
  "tinyrustlm.qwen3_numerical_differential_execution_preregistration.v6";
const OWNER_CONTRACT_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_owner_contract.v6";
const SOURCE_REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_source_request.v2";
const RECONSTRUCTED_REQUEST_SCHEMA = "tinyrustlm.qwen3_slm2_reconstructed_request.v1";
const SCALAR_REQUEST_SCHEMA = "tinyrustlm.scalar-numerical-probe-request.v1";
const VERIFICATION_REQUEST_SCHEMA =
  "tinyrustlm.qwen3_numerical_trace_verification_request.v1";
const PROCESS_TERMINAL_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_process_terminal.v1";
const OWNER_TERMINAL_SCHEMA =
  "tinyrustlm.qwen3_numerical_execution_terminal.v1";
const VERIFIER_RECEIPT_SCHEMA =
  "tinyrustlm.qwen3_numerical_trace_verification_receipt.v1";
const REGISTRATION_RELATIVE_PATH =
  "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v6.json";
const MAXIMUM_REQUEST_BYTES = 1024 * 1024;
const MAXIMUM_REGISTRATION_BYTES = 4 * 1024 * 1024;
const MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_EXECUTABLE_BYTES = 512 * 1024 * 1024;
const MAXIMUM_EVIDENCE_JSON_BYTES = 4 * 1024 * 1024;
const MAXIMUM_STREAM_BYTES = 16 * 1024 * 1024;
const HASH_BUFFER_BYTES = 1024 * 1024;
const MAXIMUM_TERMINATION_OUTPUT_BYTES = 64 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const PROFILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const ERROR_PATTERN = /^[a-z0-9][a-z0-9-]{2,127}$/u;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const CANONICAL_UTC_SECONDS_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/u;
const OPERATION_ID_PATTERN =
  /^qwen3-numerical-c1899de-[a-f0-9]{7}-[0-9]{8}-v6$/u;
const STAGES = Object.freeze(["source", "reconstructed", "scalar", "verifier"]);
const REGISTERED_TRACE_PROFILE_ID = "tinyrustlm.scalar-full-stage-f32le/1";
const MODEL_BYTE_LENGTH = 598308416;
const MODEL_SHA256 =
  "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7";
const SOURCE_LOCK_BYTE_LENGTH = 1901;
const SOURCE_LOCK_SHA256 =
  "50a8c29e36398a9a088e4d9a224dad186809d34b1e050299d3ce3de7a01b7d0e";
const COMPOSITION_RESULT_BYTE_LENGTH = 18441;
const COMPOSITION_RESULT_SHA256 =
  "0c3e84ad9ce6e22d9a164357c9a900d31825d0639f4f11077dab305f9cf3ef0e";
// Prepare implementation, tests and notes first; the final registration commit owns one file.
const REGISTRATION_COMMIT_PATHS = Object.freeze([REGISTRATION_RELATIVE_PATH]);
const REPORT_LINEAGE_PATHS = Object.freeze({
  architecture: "docs/architecture/2026-08-26-qwen3-numerical-successor-owner-clean-cut.md",
  correctedSynthesis:
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md",
  durableModelLoadMemory:
    "wiki/runtime-mirust/reports/tinyrustlm-qwen3-model-load-correction-memory-2026-08-26.md",
  durableNumericalMemory:
    "wiki/runtime-mirust/reports/tinyrustlm-qwen3-numerical-differential-memory-2026-08-26.md",
  manifest: "docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md",
  tddDelta:
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md"
});
const REGISTRATION_AUTHORITY = Object.freeze({
  automaticRetry: false,
  bestOfN: false,
  closedStructuralV12BytesMayBeModified: false,
  closedStructuralV12BytesMayBeReadForThisDiagnostic: true,
  compatibilityReader: false,
  fallbackRuntime: false,
  legacySupport: false,
  memoryEndpointsAuthorized: false,
  migrationWriter: false,
  productLifecycle: "prelaunch-single-unversioned-product",
  publicRegistrationContainsPrivatePaths: false,
  responseRepair: false,
  sourceFrameworkSemanticAuthority: true,
  technicalVersionIsProductGeneration: false,
  thresholdSearchAfterOutput: false
});
const REGISTRATION_OUTPUT_BOUNDARY = Object.freeze({
  allSixRegisteredFutureNamesObservedAbsent: true,
  evidenceParentObservedExistingDirectNonReparse: true,
  ownerEvidenceRootCreated: false,
  ownerRequestCreated: false,
  privatePathPublished: false,
  realProcessLaunched: false,
  realTraceBytesCreated: false,
  reconstructedOutputRootCreated: false,
  scalarOutputRootCreated: false,
  sourceOutputRootCreated: false,
  sourceScratchRootCreated: false
});
const REGISTRATION_CLAIM_BOUNDARY = Object.freeze({
  browserChatVerified: false,
  browserWasmVerified: false,
  campaignCreditAuthorized: false,
  compositionStructuralPassBound: true,
  modelQualityVerified: false,
  optimizedNativeVerified: false,
  p2pAvailabilityVerified: false,
  reconstructedToScalarVerified: false,
  registrationCommitMustBeRemoteExactBeforeMaterialization: true,
  siteDeploymentVerified: false,
  sourceToReconstructedVerified: false
});
const REGISTRATION_CAMPAIGN_COUNTERS = Object.freeze({
  authorizedLiveMemoryRounds: "0/25",
  currentOutsideNetworkLaneProofs: "0/40",
  deletionBackedBrowserRounds: "0/50",
  liveCatalogAnnouncements: "0/20",
  qualifiedModels: "0/20"
});
const REGISTERED_CASES = Object.freeze([
  Object.freeze({ id: "low-vocabulary-boundary", tokenIds: Object.freeze([0]),
    tokenIdsLeU32Sha256:
      "df3f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81119" }),
  Object.freeze({ id: "repeated-kv-position", tokenIds: Object.freeze([17, 17]),
    tokenIdsLeU32Sha256:
      "4b14e0b40b16df41e99ddd15fadc5ec747b124ca81f1275f592b4b0035a72cbb" }),
  Object.freeze({ id: "high-vocabulary-mixed-cache",
    tokenIds: Object.freeze([151935, 151645, 220, 151935]),
    tokenIdsLeU32Sha256:
      "7faadaa663810490a9a4c083ef289a4e8d5b58473f766b85dea75c4285bfaaba" })
]);
const SOURCE_POLICY = Object.freeze({
  maximumCases: 3,
  maximumResultBytes: 1048576,
  maximumSourceFileBytes: 1600000000,
  maximumTokensPerCase: 4,
  maximumTraceBytes: 14748160
});
const RECONSTRUCTED_MODEL_SPEC = Object.freeze({
  contextLength: 40960,
  embeddingSize: 1024,
  feedForwardSize: 3072,
  headCount: 16,
  headDimension: 128,
  kvHeadCount: 8,
  layerCount: 28,
  normalizationEpsilon: 0.000001,
  qkNormalization: true,
  qkvBias: false,
  ropeTheta: 1000000,
  tiedEmbeddings: true,
  vocabularySize: 151936
});
const RECONSTRUCTED_POLICY = Object.freeze({
  maximumCases: 3,
  maximumModelBytes: MODEL_BYTE_LENGTH,
  maximumResultBytes: 1048576,
  maximumTokensPerCase: 4,
  maximumTraceBytes: 14748160
});
const SCALAR_POLICY = Object.freeze({
  maximumCases: 3,
  maximumKvBytes: 917504,
  maximumModelBytes: MODEL_BYTE_LENGTH,
  maximumScratchBytes: 673296,
  maximumSequenceTokens: 4,
  maximumTokensPerCase: 4,
  maximumTraceBytes: 14748160
});
const VERIFICATION_POLICY = Object.freeze({
  maximumCases: 3,
  maximumManifestBytes: 4194304,
  maximumReceiptBytes: 4194304,
  maximumTokensPerCase: 4,
  maximumTraceBytes: 14748160
});
const REGISTERED_COMPARISON = Object.freeze({
  arrows: Object.freeze([
    Object.freeze({
      candidate: "reconstructed",
      id: "source-to-reconstructed",
      minimumTopKOverlap: 0.8,
      reference: "source",
      requireGreedyTokenIdentity: false,
      thresholds: Object.freeze({
        default: metricThreshold(1, 2, 0.08, 0.99, 0.05, 2147483647),
        stages: Object.freeze({
          "attention-normalized": metricThreshold(0.1, 1, 0.05, 0.998, 0.03,
            2147483647),
          "feed-forward-activated": metricThreshold(2, 3, 0.1, 0.98, 0.08,
            2147483647),
          "feed-forward-normalized": metricThreshold(0.1, 1, 0.05, 0.998, 0.03,
            2147483647),
          "final-normalized": metricThreshold(0.1, 1, 0.05, 0.998, 0.03, 2147483647),
          logits: metricThreshold(1.5, 3, 0.08, 0.98, 0.1, 2147483647),
          "token-embedding": metricThreshold(0.02, 1, 0.03, 0.999, 0.03, 2147483647)
        })
      })
    }),
    Object.freeze({
      candidate: "scalar",
      id: "reconstructed-to-scalar",
      minimumTopKOverlap: 1,
      reference: "reconstructed",
      requireGreedyTokenIdentity: true,
      thresholds: Object.freeze({
        default: metricThreshold(0.02, 0.05, 0.002, 0.99999, 0.001, 1048576),
        stages: Object.freeze({
          "feed-forward-activated": metricThreshold(0.1, 0.1, 0.005, 0.999, 0.005,
            4194304),
          logits: metricThreshold(0.2, 0.1, 0.005, 0.999, 0.005, 4194304),
          "post-attention-residual": metricThreshold(0.05, 0.08, 0.003, 0.9999,
            0.002, 2097152),
          "post-feed-forward-residual": metricThreshold(0.05, 0.08, 0.003, 0.9999,
            0.002, 2097152),
          "token-embedding": metricThreshold(0, 0, 0, 1, 0, 0)
        })
      })
    })
  ]),
  chunkElements: 65536,
  relativeFloor: 0.000001,
  signFloor: 0.00001,
  topK: 20
});
const PROCESS_POLICY = Object.freeze({
  continueAfterFailedStage: false,
  launchLimitPerStage: 1,
  maximumDurationMilliseconds: Object.freeze({
    reconstructed: 14400000,
    scalar: 14400000,
    source: 14400000,
    verifier: 3600000
  }),
  maximumStderrBytes: 1048576,
  maximumStdoutBytes: 1048576,
  overwriteAllowed: false,
  repairAllowed: false,
  retryAllowed: false
});
const EVIDENCE_FILES = Object.freeze({
  binding: "binding.json",
  start: "start.json",
  sourceRequest: "source.request.json",
  sourceStdout: "source.stdout.bin",
  sourceStderr: "source.stderr.bin",
  sourceTerminal: "source.process-terminal.json",
  reconstructedRequest: "reconstructed.request.json",
  reconstructedStdout: "reconstructed.stdout.bin",
  reconstructedStderr: "reconstructed.stderr.bin",
  reconstructedTerminal: "reconstructed.process-terminal.json",
  scalarRequest: "scalar.request.json",
  scalarStdout: "scalar.stdout.bin",
  scalarStderr: "scalar.stderr.bin",
  scalarTerminal: "scalar.process-terminal.json",
  verificationRequest: "verification.request.json",
  verifierStdout: "verifier.stdout.bin",
  verifierStderr: "verifier.stderr.bin",
  verifierTerminal: "verifier.process-terminal.json",
  ownerTerminal: "owner-terminal.json"
});
const IMPLEMENTATION_ARTIFACT_PATHS = Object.freeze({
  "execution-owner": "tinyrustlm/tools/qwen3-numerical-execution-owner.js",
  "canonical-scratch": "tinyrustlm/tools/canonical-operation-scratch.js",
  "source-authority": "tinyrustlm/tools/verify-single-source-authority.js",
  "retired-storage-policy": "contracts/storage/retired-storage-roots-2026-09-12.json",
  "differential-profile": "contracts/vnext/qwen3-numerical-differential-profile.v2.json",
  "environment-authority": "tinyrustlm/tools/qwen3_numerical_environment_lock.py",
  "environment-lock": "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json",
  "source-owner": "tinyrustlm/tools/qwen3-numerical-source-owner.py",
  "reconstructed-owner": "tinyrustlm/tools/qwen3-slm2-reconstructed-owner.py",
  "scalar-source": "rust/crates/tinyrustlm-numerical-probe/src/main.rs",
  "scalar-profile": "contracts/vnext/scalar-numerical-probe-profile.v1.json",
  verifier: "tinyrustlm/tools/qwen3-numerical-trace-verifier.js",
  "source-lock": "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json",
  "composition-result": "contracts/vnext/qwen3-real-composition-execution-result.v12.json"
});
const EXECUTABLE_BASENAMES = Object.freeze({
  git: "git.exe",
  node: "node.exe",
  python: "python.exe",
  scalar: "tinyrustlm-numerical-probe.exe",
  termination: "taskkill.exe"
});

class NumericalExecutionOwnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "NumericalExecutionOwnerError";
    this.code = code;
  }
}

function metricThreshold(maximumAbsoluteError, maximumRelativeError,
  maximumNormalizedRmse, minimumCosineSimilarity, maximumSignDisagreementRate,
  maximumUlp) {
  return Object.freeze({ maximumAbsoluteError, maximumRelativeError, maximumNormalizedRmse,
    minimumCosineSimilarity, maximumSignDisagreementRate, maximumUlp });
}

function fail(code) {
  throw new NumericalExecutionOwnerError(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, code) {
  invariant(isPlainObject(value), code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(wanted), code);
  return value;
}

function exactLiteralObject(value, expected, code) {
  exactKeys(value, Object.keys(expected), code);
  for (const [key, expectedValue] of Object.entries(expected)) {
    invariant(value[key] === expectedValue, code);
  }
  return value;
}

function exactCanonicalValue(value, expected, code) {
  invariant(JSON.stringify(recursivelySorted(value))
    === JSON.stringify(recursivelySorted(expected)), code);
  return value;
}

function recursivelySorted(value) {
  if (Array.isArray(value)) return value.map(recursivelySorted);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, recursivelySorted(value[key])]));
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(recursivelySorted(value), null, 2)}\n`, "utf8");
}

function validSha256(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function validIdentifier(value) {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function validProfileId(value) {
  return typeof value === "string" && PROFILE_ID_PATTERN.test(value)
    && !value.includes("//") && !value.endsWith("/");
}

function validCanonicalUtcSeconds(value) {
  if (typeof value !== "string" || !CANONICAL_UTC_SECONDS_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    && parsed.toISOString() === value.replace(/Z$/u, ".000Z");
}

function safeErrorCode(error, fallback = "numerical-execution-owner-internal") {
  const candidate = error instanceof NumericalExecutionOwnerError ? error.code : fallback;
  return ERROR_PATTERN.test(candidate) ? candidate : fallback;
}

function requireSafeInteger(value, minimum, maximum, code) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum, code);
  return value;
}

function requireFileName(value, code) {
  invariant(typeof value === "string" && FILE_NAME_PATTERN.test(value)
    && path.basename(value) === value, code);
  return value;
}

function requireRelativePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 512
    && !path.isAbsolute(value) && !value.includes("\\") && !value.startsWith("/")
    && value.split("/").every((component) => component !== "" && component !== "."
      && component !== ".."), code);
  return value;
}

function requireAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 4096
    && /^[\x20-\x7e]+$/u.test(value) && path.isAbsolute(value)
    && path.resolve(value) === value, code);
  if (process.platform === "win32") {
    invariant(/^[A-Z]:\\/u.test(value) && !value.startsWith("\\\\"), code);
  }
  return value;
}

function inspectPathComponents(targetPath, code) {
  const normalized = requireAbsolutePath(targetPath, code);
  const parsed = path.parse(normalized);
  let current = parsed.root;
  for (const component of normalized.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      fail(code);
    }
    invariant(!stat.isSymbolicLink(), code);
  }
  return normalized;
}

function directDirectory(directoryPath, code) {
  const normalized = inspectPathComponents(directoryPath, code);
  const stat = fs.lstatSync(normalized);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), code);
  return normalized;
}

function directRegularFile(filePath, maximumBytes, allowEmpty, code) {
  const normalized = inspectPathComponents(filePath, code);
  const stat = fs.lstatSync(normalized);
  invariant(stat.isFile() && !stat.isSymbolicLink() && Number.isSafeInteger(stat.size)
    && stat.size <= maximumBytes && (allowEmpty || stat.size > 0), code);
  return Object.freeze({ path: normalized, byteLength: stat.size });
}

function sha256File(filePath, maximumBytes = MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES,
  allowEmpty = false) {
  const file = directRegularFile(filePath, maximumBytes, allowEmpty,
    "numerical-execution-file-invalid");
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(file.path, "r");
  const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
  try {
    let offset = 0;
    while (offset < file.byteLength) {
      const read = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, file.byteLength - offset), offset);
      invariant(read > 0, "numerical-execution-file-short-read");
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
    invariant(fs.fstatSync(descriptor).size === file.byteLength,
      "numerical-execution-file-drift");
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({ byteLength: file.byteLength, sha256: digest.digest("hex") });
}

function contentIdentity(filePath, maximumBytes, allowEmpty, code) {
  const observed = sha256File(filePath, maximumBytes, allowEmpty);
  invariant(Number.isSafeInteger(observed.byteLength) && validSha256(observed.sha256), code);
  return observed;
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const artifact = contentIdentity(filePath, maximumBytes, false, code);
  const bytes = fs.readFileSync(filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code);
  }
  invariant(isPlainObject(value) && bytes.equals(canonicalJsonBytes(value)), code);
  return Object.freeze({ artifact, value });
}

function safeChild(root, fileName, code) {
  requireFileName(fileName, code);
  const child = path.resolve(root, fileName);
  invariant(path.dirname(child).toLowerCase() === root.toLowerCase(), code);
  return child;
}

function pathAbsent(targetPath, code) {
  try {
    fs.lstatSync(targetPath);
    fail(code);
  } catch (error) {
    if (error instanceof NumericalExecutionOwnerError) throw error;
    invariant(error && error.code === "ENOENT", code);
  }
}

function writeNewDurable(filePath, bytes, maximumBytes) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes,
    "numerical-execution-evidence-size");
  const descriptor = fs.openSync(filePath, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(written > 0, "numerical-execution-evidence-short-write");
      offset += written;
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeCanonicalNew(filePath, value, maximumBytes = MAXIMUM_EVIDENCE_JSON_BYTES) {
  const bytes = canonicalJsonBytes(value);
  writeNewDurable(filePath, bytes, maximumBytes);
  return Object.freeze({ byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
}

function artifactReference(value, code) {
  exactKeys(value, ["relativePath", "byteLength", "sha256"], code);
  requireRelativePath(value.relativePath, code);
  requireSafeInteger(value.byteLength, 1, MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES, code);
  invariant(validSha256(value.sha256), code);
  return value;
}

function publicArtifactReference(value, expectedPath, code) {
  exactKeys(value, ["path", "byteLength", "sha256"], code);
  requireRelativePath(value.path, code);
  requireSafeInteger(value.byteLength, 1, MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES, code);
  invariant(validSha256(value.sha256) && value.path === expectedPath, code);
  return value;
}

function sameArtifactIdentity(left, right) {
  return left.byteLength === right.byteLength && left.sha256 === right.sha256;
}

function publicArtifactMatchesImplementation(publicArtifact, implementationArtifact) {
  return publicArtifact.path === implementationArtifact.relativePath
    && sameArtifactIdentity(publicArtifact, implementationArtifact);
}

function validateModelReference(value, code) {
  exactKeys(value, ["fileName", "byteLength", "sha256"], code);
  invariant(value.fileName === "model.slm2" && value.byteLength === MODEL_BYTE_LENGTH
    && value.sha256 === MODEL_SHA256, code);
  return value;
}

function executableReference(value, code) {
  exactKeys(value, ["basename", "byteLength", "sha256"], code);
  requireFileName(value.basename, code);
  requireSafeInteger(value.byteLength, 1, MAXIMUM_EXECUTABLE_BYTES, code);
  invariant(validSha256(value.sha256), code);
  return value;
}

function git(executablePath, repositoryRoot, argumentsList, maximumBytes = 4 * 1024 * 1024) {
  try {
    return childProcess.execFileSync(executablePath, argumentsList, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: maximumBytes,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    fail("numerical-execution-git-command");
  }
}

function gitBytes(executablePath, repositoryRoot, commit, relativePath) {
  try {
    return childProcess.execFileSync(executablePath, ["show", `${commit}:${relativePath}`], {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    fail("numerical-execution-git-artifact");
  }
}

function validateProcessPolicy(policy) {
  exactKeys(policy, ["maximumDurationMilliseconds", "maximumStdoutBytes",
    "maximumStderrBytes", "launchLimitPerStage", "retryAllowed", "overwriteAllowed",
    "repairAllowed", "continueAfterFailedStage"], "numerical-execution-process-policy");
  exactKeys(policy.maximumDurationMilliseconds, STAGES,
    "numerical-execution-process-duration");
  for (const stage of STAGES) {
    requireSafeInteger(policy.maximumDurationMilliseconds[stage], 1, 24 * 60 * 60 * 1000,
      "numerical-execution-process-duration");
  }
  requireSafeInteger(policy.maximumStdoutBytes, 1, MAXIMUM_STREAM_BYTES,
    "numerical-execution-process-policy");
  requireSafeInteger(policy.maximumStderrBytes, 1, MAXIMUM_STREAM_BYTES,
    "numerical-execution-process-policy");
  invariant(policy.launchLimitPerStage === 1 && policy.retryAllowed === false
    && policy.overwriteAllowed === false && policy.repairAllowed === false
    && policy.continueAfterFailedStage === false, "numerical-execution-process-policy");
  exactCanonicalValue(policy, PROCESS_POLICY, "numerical-execution-process-policy");
}

function validateSourceTemplate(template) {
  exactKeys(template, ["schema", "sourceLock", "framework", "policy"],
    "numerical-execution-source-template");
  invariant(template.schema === SOURCE_REQUEST_SCHEMA,
    "numerical-execution-source-template");
  artifactReference(template.sourceLock, "numerical-execution-source-lock");
  const framework = exactKeys(template.framework, ["accelerateVersion",
    "attentionImplementation", "deterministicAlgorithms", "device", "dtype",
    "environmentAuthority", "environmentLock", "interopThreads", "intraopThreads",
    "localFilesOnly", "networkAllowed", "numpyVersion", "psutilVersion",
    "pythonVersion", "safetensorsVersion", "tokenizersVersion", "torchVersion",
    "transformersVersion"], "numerical-execution-source-framework");
  artifactReference(framework.environmentAuthority,
    "numerical-execution-source-framework");
  artifactReference(framework.environmentLock,
    "numerical-execution-source-framework");
  invariant(framework.accelerateVersion === "1.14.0"
    && framework.attentionImplementation === "eager"
    && framework.deterministicAlgorithms === true
    && framework.device === "cpu"
    && framework.dtype === "float32"
    && framework.interopThreads === 1
    && framework.intraopThreads === 1
    && framework.localFilesOnly === true
    && framework.networkAllowed === false
    && framework.numpyVersion === "2.2.5"
    && framework.psutilVersion === "7.2.2"
    && framework.pythonVersion === "3.12.10"
    && framework.safetensorsVersion === "0.5.3"
    && framework.tokenizersVersion === "0.21.1"
    && framework.torchVersion === "2.7.0"
    && framework.transformersVersion === "4.51.0",
  "numerical-execution-source-framework");
  exactCanonicalValue(template.policy, SOURCE_POLICY,
    "numerical-execution-source-policy");
}

/** Validate only the current diagnostic contract; closed generations cannot launch. */
function validateOwnerContract(contract) {
  exactKeys(contract, ["schema", "operationId", "traceProfileId",
    "implementationArtifacts", "executables", "cases", "requests", "processPolicy",
    "privateNames", "evidenceFiles", "terminalPolicy"],
  "numerical-execution-owner-contract");
  invariant(contract.schema === OWNER_CONTRACT_SCHEMA
    && validIdentifier(contract.operationId) && OPERATION_ID_PATTERN.test(contract.operationId)
    && validProfileId(contract.traceProfileId)
    && contract.traceProfileId === REGISTERED_TRACE_PROFILE_ID,
  "numerical-execution-owner-contract");
  invariant(Array.isArray(contract.implementationArtifacts)
    && contract.implementationArtifacts.length === Object.keys(IMPLEMENTATION_ARTIFACT_PATHS).length,
  "numerical-execution-implementation-artifacts");
  const roles = new Set();
  for (const artifact of contract.implementationArtifacts) {
    exactKeys(artifact, ["role", "relativePath", "byteLength", "sha256"],
      "numerical-execution-implementation-artifact");
    invariant(validIdentifier(artifact.role) && !roles.has(artifact.role),
      "numerical-execution-implementation-artifact");
    roles.add(artifact.role);
    artifactReference({ relativePath: artifact.relativePath,
      byteLength: artifact.byteLength, sha256: artifact.sha256 },
    "numerical-execution-implementation-artifact");
    invariant(artifact.relativePath === IMPLEMENTATION_ARTIFACT_PATHS[artifact.role],
      "numerical-execution-implementation-artifact-path");
  }
  const requiredRoles = Object.keys(IMPLEMENTATION_ARTIFACT_PATHS);
  invariant(requiredRoles.every((role) => roles.has(role)),
    "numerical-execution-implementation-roles");
  const artifactsByRole = new Map(contract.implementationArtifacts
    .map((artifact) => [artifact.role, artifact]));
  exactKeys(contract.executables, ["git", "python", "node", "scalar", "termination"],
    "numerical-execution-executables");
  for (const role of Object.keys(contract.executables)) {
    executableReference(contract.executables[role], "numerical-execution-executable");
    invariant(contract.executables[role].basename === EXECUTABLE_BASENAMES[role],
      "numerical-execution-executable-basename");
  }
  invariant(Array.isArray(contract.cases) && contract.cases.length >= 1
    && contract.cases.length <= 32, "numerical-execution-cases");
  const caseIds = new Set();
  for (const item of contract.cases) {
    exactKeys(item, ["id", "tokenIds", "tokenIdsLeU32Sha256"],
      "numerical-execution-case");
    invariant(validIdentifier(item.id) && !caseIds.has(item.id)
      && Array.isArray(item.tokenIds) && item.tokenIds.length >= 1
      && item.tokenIds.length <= 256
      && item.tokenIds.every((token) => Number.isSafeInteger(token)
        && token >= 0 && token < 151936) && validSha256(item.tokenIdsLeU32Sha256),
    "numerical-execution-case");
    const bytes = Buffer.alloc(item.tokenIds.length * 4);
    item.tokenIds.forEach((token, index) => bytes.writeUInt32LE(token, index * 4));
    invariant(crypto.createHash("sha256").update(bytes).digest("hex")
      === item.tokenIdsLeU32Sha256, "numerical-execution-case-digest");
    caseIds.add(item.id);
  }
  exactCanonicalValue(contract.cases, REGISTERED_CASES,
    "numerical-execution-registered-cases");
  exactKeys(contract.requests, ["source", "reconstructed", "scalar", "verification"],
    "numerical-execution-request-templates");
  validateSourceTemplate(contract.requests.source);
  exactKeys(contract.requests.reconstructed,
    ["schema", "compositionResultSha256", "model", "implementation", "modelSpec", "policy"],
    "numerical-execution-reconstructed-template");
  exactKeys(contract.requests.scalar,
    ["schema", "compositionResultSha256", "model", "policy"],
    "numerical-execution-scalar-template");
  exactKeys(contract.requests.verification,
    ["schema", "differentialProfile", "comparison", "policy"],
    "numerical-execution-verification-template");
  invariant(contract.requests.reconstructed.schema === RECONSTRUCTED_REQUEST_SCHEMA,
    "numerical-execution-reconstructed-template");
  invariant(contract.requests.scalar.schema === SCALAR_REQUEST_SCHEMA,
    "numerical-execution-scalar-template");
  invariant(contract.requests.verification.schema === VERIFICATION_REQUEST_SCHEMA,
    "numerical-execution-verification-template");
  validateModelReference(contract.requests.reconstructed.model,
    "numerical-execution-reconstructed-model");
  validateModelReference(contract.requests.scalar.model,
    "numerical-execution-scalar-model");
  const reconstructedImplementation = exactKeys(contract.requests.reconstructed.implementation,
    ["blasThreads", "environmentAuthority", "environmentLock", "matrixChunkRows",
      "networkAllowed", "numpyVersion", "pythonVersion"],
  "numerical-execution-reconstructed-implementation");
  artifactReference(reconstructedImplementation.environmentAuthority,
    "numerical-execution-reconstructed-implementation");
  artifactReference(reconstructedImplementation.environmentLock,
    "numerical-execution-reconstructed-implementation");
  invariant(reconstructedImplementation.blasThreads === 1
    && reconstructedImplementation.matrixChunkRows === 256
    && reconstructedImplementation.networkAllowed === false
    && reconstructedImplementation.numpyVersion === "2.2.5"
    && reconstructedImplementation.pythonVersion === "3.12.10",
  "numerical-execution-reconstructed-implementation");
  exactCanonicalValue(contract.requests.reconstructed.modelSpec, RECONSTRUCTED_MODEL_SPEC,
    "numerical-execution-reconstructed-model-spec");
  exactCanonicalValue(contract.requests.reconstructed.policy, RECONSTRUCTED_POLICY,
    "numerical-execution-reconstructed-policy");
  exactCanonicalValue(contract.requests.scalar.policy, SCALAR_POLICY,
    "numerical-execution-scalar-policy");
  exactCanonicalValue(contract.requests.verification.comparison, REGISTERED_COMPARISON,
    "numerical-execution-verification-comparison");
  exactCanonicalValue(contract.requests.verification.policy, VERIFICATION_POLICY,
    "numerical-execution-verification-policy");
  invariant(contract.requests.reconstructed.compositionResultSha256
      === contract.requests.scalar.compositionResultSha256
    && validSha256(contract.requests.reconstructed.compositionResultSha256),
  "numerical-execution-composition-result-binding");
  artifactReference(contract.requests.verification.differentialProfile,
    "numerical-execution-differential-profile-binding");
  const sameImplementationReference = (reference, role) => {
    const artifact = artifactsByRole.get(role);
    return reference.relativePath === artifact.relativePath
      && sameArtifactIdentity(reference, artifact);
  };
  invariant(sameImplementationReference(contract.requests.source.sourceLock, "source-lock")
    && sameImplementationReference(contract.requests.source.framework.environmentAuthority,
      "environment-authority")
    && sameImplementationReference(contract.requests.source.framework.environmentLock,
      "environment-lock")
    && sameImplementationReference(reconstructedImplementation.environmentAuthority,
      "environment-authority")
    && sameImplementationReference(reconstructedImplementation.environmentLock,
      "environment-lock")
    && sameImplementationReference(contract.requests.verification.differentialProfile,
      "differential-profile")
    && artifactsByRole.get("composition-result").sha256
      === contract.requests.reconstructed.compositionResultSha256,
  "numerical-execution-owner-contract-artifact-binding");
  validateProcessPolicy(contract.processPolicy);
  exactKeys(contract.privateNames, ["ownerRequestFileBasename", "ownerEvidenceRootBasename",
    "sourceScratchRootBasename", "sourceOutputRootBasename",
    "reconstructedOutputRootBasename", "scalarOutputRootBasename"],
  "numerical-execution-private-names");
  const privateNames = Object.values(contract.privateNames);
  privateNames.forEach((name) => requireFileName(name, "numerical-execution-private-name"));
  invariant(new Set(privateNames.map((name) => name.toLowerCase())).size === privateNames.length,
    "numerical-execution-private-name-duplicate");
  invariant(contract.privateNames.ownerRequestFileBasename
      === `${contract.operationId}-owner-request.json`
    && contract.privateNames.ownerEvidenceRootBasename
      === `${contract.operationId}-owner-evidence`
    && contract.privateNames.sourceScratchRootBasename
      === `${contract.operationId}-source-scratch`
    && contract.privateNames.sourceOutputRootBasename === `${contract.operationId}-source`
    && contract.privateNames.reconstructedOutputRootBasename
      === `${contract.operationId}-reconstructed`
    && contract.privateNames.scalarOutputRootBasename === `${contract.operationId}-scalar`,
  "numerical-execution-private-name-derivation");
  exactKeys(contract.evidenceFiles, ["binding", "start", "sourceRequest", "sourceStdout",
    "sourceStderr", "sourceTerminal", "reconstructedRequest", "reconstructedStdout",
    "reconstructedStderr", "reconstructedTerminal", "scalarRequest", "scalarStdout",
    "scalarStderr", "scalarTerminal", "verificationRequest", "verifierStdout",
    "verifierStderr", "verifierTerminal", "ownerTerminal"],
  "numerical-execution-evidence-files");
  const evidenceNames = Object.values(contract.evidenceFiles);
  evidenceNames.forEach((name) => requireFileName(name, "numerical-execution-evidence-file"));
  invariant(new Set(evidenceNames.map((name) => name.toLowerCase())).size
    === evidenceNames.length, "numerical-execution-evidence-file-duplicate");
  exactCanonicalValue(contract.evidenceFiles, EVIDENCE_FILES,
    "numerical-execution-evidence-files");
  exactKeys(contract.terminalPolicy, ["successStatus", "rejectionStatus", "failureStatus",
    "ambiguousStatus", "secondInvocationAllowed", "partialOutputCleanupAllowed",
    "evidenceOverwriteAllowed", "thresholdChangeAfterLaunchAllowed"],
  "numerical-execution-terminal-policy");
  invariant(contract.terminalPolicy.successStatus === "terminal-pass"
    && contract.terminalPolicy.rejectionStatus === "terminal-rejected"
    && contract.terminalPolicy.failureStatus === "terminal-failure"
    && contract.terminalPolicy.ambiguousStatus === "terminal-ambiguous"
    && contract.terminalPolicy.secondInvocationAllowed === false
    && contract.terminalPolicy.partialOutputCleanupAllowed === false
    && contract.terminalPolicy.evidenceOverwriteAllowed === false
    && contract.terminalPolicy.thresholdChangeAfterLaunchAllowed === false,
  "numerical-execution-terminal-policy");
  return contract;
}

function validateReportLineage(lineage) {
  exactKeys(lineage, Object.keys(REPORT_LINEAGE_PATHS),
    "numerical-execution-registration-report-lineage");
  for (const [role, expectedPath] of Object.entries(REPORT_LINEAGE_PATHS)) {
    publicArtifactReference(lineage[role], expectedPath,
      "numerical-execution-registration-report-lineage");
  }
  invariant(new Set(Object.values(lineage).map((artifact) => artifact.path)).size
    === Object.keys(REPORT_LINEAGE_PATHS).length,
  "numerical-execution-registration-report-lineage");
}

function validateZeroFailureGate(value, code) {
  exactKeys(value, ["failed", "passed", "skipped", "total"], code);
  for (const key of ["failed", "passed", "skipped", "total"]) {
    requireSafeInteger(value[key], 0, 1000000, code);
  }
  invariant(value.failed === 0 && value.skipped === 0 && value.passed >= 1
    && value.total === value.passed, code);
}

/** Require passing gates and exact source/build anchors without inheriting old skip allowances. */
function validateImplementationCheckpoint(checkpoint, registration, contract) {
  exactKeys(checkpoint, ["cleanRelease", "focusedGate", "implementationCommit",
    "implementationTree", "memoryCheckpointCommit", "memoryCheckpointTree", "scalarBuild",
    "standardGate", "thresholdBasis"],
  "numerical-execution-registration-implementation-checkpoint");
  invariant(COMMIT_PATTERN.test(checkpoint.implementationCommit)
    && COMMIT_PATTERN.test(checkpoint.implementationTree)
    && checkpoint.memoryCheckpointCommit === registration.registrationParentCommit
    && checkpoint.memoryCheckpointTree === registration.registrationParentTree,
  "numerical-execution-registration-implementation-checkpoint");

  exactKeys(checkpoint.cleanRelease, ["aggregateByteLength", "aggregateSha256", "failed",
    "passed", "runId", "skipped", "total", "verifierReproduced"],
  "numerical-execution-registration-clean-release");
  requireSafeInteger(checkpoint.cleanRelease.aggregateByteLength, 1,
    MAXIMUM_EVIDENCE_JSON_BYTES, "numerical-execution-registration-clean-release");
  for (const key of ["failed", "passed", "skipped", "total"]) {
    requireSafeInteger(checkpoint.cleanRelease[key], 0, 1000000,
      "numerical-execution-registration-clean-release");
  }
  invariant(validSha256(checkpoint.cleanRelease.aggregateSha256)
    && validSha256(checkpoint.cleanRelease.runId)
    && checkpoint.cleanRelease.failed === 0
    && checkpoint.cleanRelease.skipped === 0
    && checkpoint.cleanRelease.passed >= 1
    && checkpoint.cleanRelease.total === checkpoint.cleanRelease.passed
    && checkpoint.cleanRelease.verifierReproduced === true,
  "numerical-execution-registration-clean-release");
  validateZeroFailureGate(checkpoint.focusedGate,
    "numerical-execution-registration-focused-gate");

  validateZeroFailureGate(checkpoint.standardGate,
    "numerical-execution-registration-standard-gate");

  const scalarBuild = exactKeys(checkpoint.scalarBuild, ["cargoVersion", "crate",
    "executable", "host", "locked", "offline", "profile", "rustcVersion", "sourceCommit",
    "sourceTree"], "numerical-execution-registration-scalar-build");
  executableReference(scalarBuild.executable,
    "numerical-execution-registration-scalar-build");
  invariant(scalarBuild.cargoVersion === "cargo 1.96.0 (30a34c682 2026-05-25)"
    && scalarBuild.crate === "tinyrustlm-numerical-probe"
    && scalarBuild.host === "x86_64-pc-windows-msvc"
    && scalarBuild.locked === true && scalarBuild.offline === true
    && scalarBuild.profile === "release"
    && scalarBuild.rustcVersion === "rustc 1.96.0 (ac68faa20 2026-05-25)"
    && COMMIT_PATTERN.test(scalarBuild.sourceCommit)
    && COMMIT_PATTERN.test(scalarBuild.sourceTree)
    && scalarBuild.executable.basename === contract.executables.scalar.basename
    && sameArtifactIdentity(scalarBuild.executable, contract.executables.scalar),
  "numerical-execution-registration-scalar-build");

  exactLiteralObject(checkpoint.thresholdBasis, {
    chosenBeforeRealTraceOutput: true,
    futureOutputUsedToChooseOrLoosen: false,
    reconstructedToScalar:
      "same-converted-byte-runtime-contract-with-exact-embedding-and-tighter-aggregate-margins",
    sourceToReconstructed:
      "quantization-noninferiority-diagnostic-with-bounded-coordinate-and-tighter-directional-margins",
    thresholdFailureIsTerminal: true,
    thresholdsAreEngineeringAcceptanceMarginsNotObservedResults: true
  }, "numerical-execution-registration-threshold-basis");
}

/** Bind the diagnostic ancestry while preserving its terminal product-quality rejection. */
function validateCandidate(candidate, contract) {
  exactKeys(candidate, ["compositionClaim", "compositionResult", "licenseSpdx", "modelId",
    "modelSlm2", "numericalClaim", "qualityClaim", "revision",
    "sourceClosureRehashedBeforeRegistration", "sourceLock", "purpose"],
  "numerical-execution-registration-candidate");
  exactKeys(candidate.modelSlm2, ["byteLength", "sha256"],
    "numerical-execution-registration-candidate-model");
  invariant(candidate.compositionClaim === "structural-pass-only"
    && candidate.licenseSpdx === "Apache-2.0"
    && candidate.modelId === "Qwen/Qwen3-0.6B"
    && candidate.modelSlm2.byteLength === MODEL_BYTE_LENGTH
    && candidate.modelSlm2.sha256 === MODEL_SHA256
    && candidate.numericalClaim === "unproven"
    && candidate.qualityClaim === "terminally-rejected-for-product-use"
    && candidate.purpose === "runtime-diagnostic-only"
    && candidate.revision === "c1899de289a04d12100db370d81485cdf75e47ca"
    && candidate.sourceClosureRehashedBeforeRegistration === true,
  "numerical-execution-registration-candidate");
  publicArtifactReference(candidate.compositionResult,
    "contracts/vnext/qwen3-real-composition-execution-result.v12.json",
  "numerical-execution-registration-candidate-composition");
  publicArtifactReference(candidate.sourceLock,
    "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json",
  "numerical-execution-registration-candidate-source-lock");
  const artifacts = new Map(contract.implementationArtifacts
    .map((artifact) => [artifact.role, artifact]));
  invariant(publicArtifactMatchesImplementation(candidate.compositionResult,
    artifacts.get("composition-result"))
    && publicArtifactMatchesImplementation(candidate.sourceLock, artifacts.get("source-lock"))
    && candidate.compositionResult.byteLength === COMPOSITION_RESULT_BYTE_LENGTH
    && candidate.compositionResult.sha256 === COMPOSITION_RESULT_SHA256
    && candidate.sourceLock.byteLength === SOURCE_LOCK_BYTE_LENGTH
    && candidate.sourceLock.sha256 === SOURCE_LOCK_SHA256
    && candidate.modelSlm2.byteLength === contract.requests.reconstructed.model.byteLength
    && candidate.modelSlm2.sha256 === contract.requests.reconstructed.model.sha256
    && candidate.modelSlm2.byteLength === contract.requests.scalar.model.byteLength
    && candidate.modelSlm2.sha256 === contract.requests.scalar.model.sha256,
  "numerical-execution-registration-candidate-binding");
}

/** Bind a fresh current registration to its parent and UTC date, never a replayed operation ID. */
function validateRegistration(value) {
  exactKeys(value, ["schema", "profileId", "status", "registeredAtUtc",
    "registrationParentCommit", "registrationParentTree", "authority", "sourceAnchor",
    "reportLineage", "implementationCheckpoint", "candidate", "ownerContract",
    "outputBoundary", "claimBoundary", "campaignCounters"],
  "numerical-execution-registration-shape");
  invariant(value.schema === REGISTRATION_SCHEMA
    && value.profileId === "tinyrustlm.qwen3-numerical-differential-execution/6"
    && value.status === "registered-before-private-request-roots-and-real-traces"
    && validCanonicalUtcSeconds(value.registeredAtUtc)
    && COMMIT_PATTERN.test(value.registrationParentCommit)
    && COMMIT_PATTERN.test(value.registrationParentTree),
  "numerical-execution-registration-identity");
  exactLiteralObject(value.authority, REGISTRATION_AUTHORITY,
    "numerical-execution-registration-authority");
  exactKeys(value.sourceAnchor, ["branch", "parentCommit", "parentTree",
    "allowedRegistrationCommitPaths", "cleanAtRegistration",
    "trackingFetchHeadAndRemoteExactAtRegistration"],
  "numerical-execution-registration-source-anchor");
  invariant(value.sourceAnchor.branch === "codex/model-acquisition-v2"
    && value.sourceAnchor.parentCommit === value.registrationParentCommit
    && value.sourceAnchor.parentTree === value.registrationParentTree
    && Array.isArray(value.sourceAnchor.allowedRegistrationCommitPaths)
    && JSON.stringify(value.sourceAnchor.allowedRegistrationCommitPaths)
      === JSON.stringify(REGISTRATION_COMMIT_PATHS)
    && value.sourceAnchor.allowedRegistrationCommitPaths.every((relativePath) => {
      try {
        requireRelativePath(relativePath, "numerical-execution-registration-source-anchor");
        return true;
      } catch {
        return false;
      }
    })
    && new Set(value.sourceAnchor.allowedRegistrationCommitPaths).size
      === value.sourceAnchor.allowedRegistrationCommitPaths.length
    && value.sourceAnchor.cleanAtRegistration === true
    && value.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration === true,
  "numerical-execution-registration-source-anchor");
  const contract = validateOwnerContract(value.ownerContract);
  const operationDate = value.registeredAtUtc.slice(0, 10).replaceAll("-", "");
  invariant(contract.operationId ===
    `qwen3-numerical-c1899de-${value.registrationParentCommit.slice(0, 7)}-${operationDate}-v6`,
  "numerical-execution-registration-operation-binding");
  validateReportLineage(value.reportLineage);
  validateImplementationCheckpoint(value.implementationCheckpoint, value, contract);
  validateCandidate(value.candidate, contract);
  exactLiteralObject(value.outputBoundary, REGISTRATION_OUTPUT_BOUNDARY,
    "numerical-execution-registration-output-boundary");
  exactLiteralObject(value.claimBoundary, REGISTRATION_CLAIM_BOUNDARY,
    "numerical-execution-registration-claim-boundary");
  exactLiteralObject(value.campaignCounters, REGISTRATION_CAMPAIGN_COUNTERS,
    "numerical-execution-registration-campaign-counters");
  return value;
}

/** Reject misplaced source, evidence, and model roots before creating any output. */
function validateOperationLocations(request) {
  invariant(request.repositoryRoot === CANONICAL_REPOSITORY_ROOT,
    "numerical-execution-repository-root");
  requireCanonicalSiteRoot(path.join(request.repositoryRoot, "tinyrustlm"));
  requireCanonicalArtifactPath(request.evidenceParent);
  for (const name of ["sourceDirectory", "compositionRoot"]) {
    const value = request[name];
    invariant(typeof value === "string" && path.win32.isAbsolute(value)
      && path.win32.resolve(value) === value,
    "numerical-execution-model-location");
    const relative = path.win32.relative(MODEL_ROOT, value);
    invariant(relative !== "" && relative !== ".." && !relative.startsWith("..\\")
      && !path.win32.isAbsolute(relative), "numerical-execution-model-location");
  }
  const relative = path.win32.relative(request.sourceDirectory, request.compositionRoot);
  const reverse = path.win32.relative(request.compositionRoot, request.sourceDirectory);
  invariant([relative, reverse].every((value) => value === ".." || value.startsWith("..\\")),
    "numerical-execution-model-root-overlap");
}

function validateRequest(requestPath) {
  const requestDocument = readCanonicalJson(requestPath, MAXIMUM_REQUEST_BYTES,
    "numerical-execution-request-json");
  const request = requestDocument.value;
  exactKeys(request, ["schema", "operationId", "registration", "registrationSource",
    "repositoryRoot", "gitPath", "evidenceParent", "sourceDirectory", "compositionRoot",
    "executables"], "numerical-execution-request-shape");
  invariant(request.schema === REQUEST_SCHEMA && validIdentifier(request.operationId),
    "numerical-execution-request-identity");
  validateOperationLocations(request);
  exactKeys(request.registration, ["relativePath", "byteLength", "sha256"],
    "numerical-execution-registration-reference");
  invariant(request.registration.relativePath === REGISTRATION_RELATIVE_PATH,
    "numerical-execution-registration-reference");
  artifactReference(request.registration, "numerical-execution-registration-reference");
  exactKeys(request.registrationSource, ["commit", "tree", "branch", "trackingRef",
    "remoteRef", "fetchHeadExpected"], "numerical-execution-registration-source");
  invariant(COMMIT_PATTERN.test(request.registrationSource.commit)
    && COMMIT_PATTERN.test(request.registrationSource.tree)
    && request.registrationSource.branch === "codex/model-acquisition-v2"
    && request.registrationSource.trackingRef === "origin/codex/model-acquisition-v2"
    && request.registrationSource.remoteRef === "refs/remotes/origin/codex/model-acquisition-v2"
    && request.registrationSource.fetchHeadExpected === true,
  "numerical-execution-registration-source");
  const repositoryRoot = directDirectory(requireAbsolutePath(request.repositoryRoot,
    "numerical-execution-repository-root"), "numerical-execution-repository-root");
  const gitFile = directRegularFile(requireAbsolutePath(request.gitPath,
    "numerical-execution-git-path"), MAXIMUM_EXECUTABLE_BYTES, false,
  "numerical-execution-git-path");
  const evidenceParent = directDirectory(requireAbsolutePath(request.evidenceParent,
    "numerical-execution-evidence-parent"), "numerical-execution-evidence-parent");
  const sourceDirectory = directDirectory(requireAbsolutePath(request.sourceDirectory,
    "numerical-execution-source-directory"), "numerical-execution-source-directory");
  const compositionRoot = directDirectory(requireAbsolutePath(request.compositionRoot,
    "numerical-execution-composition-root"), "numerical-execution-composition-root");
  invariant(new Set([repositoryRoot, evidenceParent, sourceDirectory, compositionRoot]
    .map((value) => value.toLowerCase())).size === 4, "numerical-execution-root-overlap");
  exactKeys(request.executables, ["pythonPath", "nodePath", "scalarPath", "terminationPath"],
    "numerical-execution-executable-paths");
  const executablePaths = Object.fromEntries(Object.entries(request.executables)
    .map(([role, filePath]) => [role, directRegularFile(requireAbsolutePath(filePath,
      "numerical-execution-executable-path"), MAXIMUM_EXECUTABLE_BYTES, false,
    "numerical-execution-executable-path").path]));
  invariant(executablePaths.nodePath.toLowerCase() === process.execPath.toLowerCase(),
    "numerical-execution-node-runtime");
  const registrationPath = path.resolve(repositoryRoot,
    ...request.registration.relativePath.split("/"));
  invariant(registrationPath.startsWith(`${repositoryRoot}${path.sep}`),
    "numerical-execution-registration-path");
  const registrationDocument = readCanonicalJson(registrationPath, MAXIMUM_REGISTRATION_BYTES,
    "numerical-execution-registration-json");
  invariant(registrationDocument.artifact.byteLength === request.registration.byteLength
    && registrationDocument.artifact.sha256 === request.registration.sha256,
  "numerical-execution-registration-drift");
  const registration = validateRegistration(registrationDocument.value);
  invariant(registration.ownerContract.operationId === request.operationId,
    "numerical-execution-operation-binding");
  return Object.freeze({ requestPath, requestIdentity: requestDocument.artifact, request,
    registrationPath, registrationIdentity: registrationDocument.artifact, registration,
    repositoryRoot, gitPath: gitFile.path, evidenceParent, sourceDirectory, compositionRoot,
    executablePaths });
}

function verifySourceState(state) {
  const { request, registration, repositoryRoot, gitPath } = state;
  const source = request.registrationSource;
  invariant(git(gitPath, repositoryRoot, ["rev-parse", "HEAD"]) === source.commit
    && git(gitPath, repositoryRoot, ["rev-parse", "HEAD^{tree}"]) === source.tree
    && git(gitPath, repositoryRoot, ["branch", "--show-current"]) === source.branch
    && git(gitPath, repositoryRoot, ["rev-parse", source.trackingRef]) === source.commit
    && git(gitPath, repositoryRoot, ["rev-parse", source.remoteRef]) === source.commit
    && git(gitPath, repositoryRoot, ["rev-parse", "FETCH_HEAD"]) === source.commit,
  "numerical-execution-source-not-remote-exact");
  invariant(git(gitPath, repositoryRoot,
    ["status", "--porcelain=v1", "--untracked-files=all"]) === "",
  "numerical-execution-source-dirty");
  invariant(git(gitPath, repositoryRoot,
    ["rev-parse", `${registration.registrationParentCommit}^{tree}`])
    === registration.registrationParentTree, "numerical-execution-parent-tree");
  git(gitPath, repositoryRoot,
    ["merge-base", "--is-ancestor", registration.registrationParentCommit, source.commit]);
  const changed = git(gitPath, repositoryRoot, ["diff", "--name-only",
    registration.registrationParentCommit, source.commit]).split(/\r?\n/u).filter(Boolean).sort();
  invariant(JSON.stringify(changed) === JSON.stringify(
    [...registration.sourceAnchor.allowedRegistrationCommitPaths].sort()),
  "numerical-execution-registration-diff");
  const registrationAtCommit = gitBytes(gitPath, repositoryRoot, source.commit,
    request.registration.relativePath);
  invariant(registrationAtCommit.length === state.registrationIdentity.byteLength
    && crypto.createHash("sha256").update(registrationAtCommit).digest("hex")
      === state.registrationIdentity.sha256, "numerical-execution-registration-commit-drift");

  const verifyParentArtifact = (relativePath, expected, code) => {
    const bytes = gitBytes(gitPath, repositoryRoot, registration.registrationParentCommit,
      relativePath);
    invariant(bytes.length === expected.byteLength
      && crypto.createHash("sha256").update(bytes).digest("hex") === expected.sha256, code);
    const currentPath = path.resolve(repositoryRoot, ...relativePath.split("/"));
    const observed = sha256File(currentPath, MAXIMUM_SOURCE_CONTROLLED_FILE_BYTES, false);
    invariant(observed.byteLength === expected.byteLength
      && observed.sha256 === expected.sha256, code);
    return currentPath;
  };
  const artifacts = new Map();
  for (const artifact of registration.ownerContract.implementationArtifacts) {
    const currentPath = verifyParentArtifact(artifact.relativePath, artifact,
      "numerical-execution-implementation-artifact-drift");
    artifacts.set(artifact.role, Object.freeze({ ...artifact, path: currentPath }));
  }
  for (const lineageArtifact of Object.values(registration.reportLineage)) {
    verifyParentArtifact(lineageArtifact.path, lineageArtifact,
      "numerical-execution-report-lineage-drift");
  }
  const checkpoint = registration.implementationCheckpoint;
  invariant(git(gitPath, repositoryRoot,
    ["rev-parse", `${checkpoint.implementationCommit}^{tree}`])
      === checkpoint.implementationTree,
  "numerical-execution-implementation-checkpoint-tree");
  git(gitPath, repositoryRoot, ["merge-base", "--is-ancestor",
    checkpoint.implementationCommit, registration.registrationParentCommit]);
  invariant(git(gitPath, repositoryRoot,
    ["rev-parse", `${checkpoint.scalarBuild.sourceCommit}^{tree}`])
      === checkpoint.scalarBuild.sourceTree,
  "numerical-execution-scalar-build-tree");
  git(gitPath, repositoryRoot, ["merge-base", "--is-ancestor",
    checkpoint.scalarBuild.sourceCommit, registration.registrationParentCommit]);
  return artifacts;
}

function verifyExecutables(state) {
  const expected = state.registration.ownerContract.executables;
  const mapping = { git: null, python: "pythonPath", node: "nodePath", scalar: "scalarPath",
    termination: "terminationPath" };
  const observed = {};
  for (const [role, pathField] of Object.entries(mapping)) {
    const executablePath = role === "git" ? state.gitPath : state.executablePaths[pathField];
    invariant(path.basename(executablePath).toLowerCase() === expected[role].basename.toLowerCase(),
      "numerical-execution-executable-basename");
    const identity = sha256File(executablePath, MAXIMUM_EXECUTABLE_BYTES, false);
    invariant(identity.byteLength === expected[role].byteLength
      && identity.sha256 === expected[role].sha256, "numerical-execution-executable-drift");
    observed[role] = Object.freeze({ path: executablePath, ...identity });
  }
  return Object.freeze(observed);
}

function derivePaths(state) {
  const names = state.registration.ownerContract.privateNames;
  invariant(path.basename(state.requestPath).toLowerCase()
    === names.ownerRequestFileBasename.toLowerCase()
    && path.dirname(state.requestPath).toLowerCase() === state.evidenceParent.toLowerCase(),
  "numerical-execution-owner-request-path");
  const paths = {
    ownerEvidenceRoot: safeChild(state.evidenceParent, names.ownerEvidenceRootBasename,
      "numerical-execution-private-root"),
    sourceScratchRoot: safeChild(state.evidenceParent, names.sourceScratchRootBasename,
      "numerical-execution-private-root"),
    sourceOutputRoot: safeChild(state.evidenceParent, names.sourceOutputRootBasename,
      "numerical-execution-private-root"),
    reconstructedOutputRoot: safeChild(state.evidenceParent,
      names.reconstructedOutputRootBasename, "numerical-execution-private-root"),
    scalarOutputRoot: safeChild(state.evidenceParent, names.scalarOutputRootBasename,
      "numerical-execution-private-root")
  };
  const values = Object.values(paths);
  invariant(new Set(values.map((value) => value.toLowerCase())).size === values.length,
    "numerical-execution-private-root-duplicate");
  values.forEach((value) => pathAbsent(value, "numerical-execution-private-root-not-absent"));
  return Object.freeze(paths);
}

function childRequests(state, paths) {
  const contract = state.registration.ownerContract;
  const registrationSha256 = state.registrationIdentity.sha256;
  const cases = contract.cases.map(({ id, tokenIds }) => ({ id, tokenIds }));
  const source = {
    schema: contract.requests.source.schema,
    operationId: contract.operationId,
    differentialProfileSha256: contract.requests.verification.differentialProfile.sha256,
    registrationSha256,
    sourceLock: contract.requests.source.sourceLock,
    sourceDirectory: state.sourceDirectory,
    scratchRoot: paths.sourceScratchRoot,
    evidenceParent: state.evidenceParent,
    outputRoot: paths.sourceOutputRoot,
    traceProfileId: contract.traceProfileId,
    framework: contract.requests.source.framework,
    policy: contract.requests.source.policy,
    cases
  };
  const reconstructed = {
    schema: contract.requests.reconstructed.schema,
    operationId: contract.operationId,
    differentialProfileSha256: contract.requests.verification.differentialProfile.sha256,
    registrationSha256,
    compositionResultSha256: contract.requests.reconstructed.compositionResultSha256,
    compositionRoot: state.compositionRoot,
    model: contract.requests.reconstructed.model,
    evidenceParent: state.evidenceParent,
    outputRoot: paths.reconstructedOutputRoot,
    traceProfileId: contract.traceProfileId,
    implementation: contract.requests.reconstructed.implementation,
    modelSpec: contract.requests.reconstructed.modelSpec,
    policy: contract.requests.reconstructed.policy,
    cases
  };
  const scalar = {
    schema: contract.requests.scalar.schema,
    operationId: contract.operationId,
    compositionResultSha256: contract.requests.scalar.compositionResultSha256,
    compositionRoot: state.compositionRoot,
    model: contract.requests.scalar.model,
    evidenceParent: state.evidenceParent,
    outputRoot: paths.scalarOutputRoot,
    traceProfileId: contract.traceProfileId,
    policy: contract.requests.scalar.policy,
    cases
  };
  const names = contract.evidenceFiles;
  const binding = (root) => ({ rootBasename: path.basename(root), manifest: {
    fileName: "probe.json", byteLength: 1, sha256: "0".repeat(64) } });
  const verification = {
    schema: contract.requests.verification.schema,
    operationId: contract.operationId,
    differentialProfile: contract.requests.verification.differentialProfile,
    registrationSha256,
    traceProfileId: contract.traceProfileId,
    bundles: {
      source: binding(paths.sourceOutputRoot),
      reconstructed: binding(paths.reconstructedOutputRoot),
      scalar: binding(paths.scalarOutputRoot)
    },
    comparison: contract.requests.verification.comparison,
    policy: contract.requests.verification.policy
  };
  return Object.freeze({ source, reconstructed, scalar, verification,
    evidenceFileNames: names });
}

function finalizeVerificationRequest(requests, paths) {
  const verification = structuredClone(requests.verification);
  for (const [role, root] of [["source", paths.sourceOutputRoot],
    ["reconstructed", paths.reconstructedOutputRoot], ["scalar", paths.scalarOutputRoot]]) {
    const manifestPath = safeChild(root, "probe.json", "numerical-execution-manifest-path");
    const identity = sha256File(manifestPath, MAXIMUM_EVIDENCE_JSON_BYTES, false);
    verification.bundles[role].manifest = { fileName: "probe.json", ...identity };
  }
  return verification;
}

function createBoundedCapture(filePath, maximumBytes) {
  const descriptor = fs.openSync(filePath, "wx");
  let byteLength = 0;
  let overflow = false;
  let closed = false;
  return {
    append(chunk) {
      invariant(!closed && Buffer.isBuffer(chunk), "numerical-execution-capture-state");
      if (overflow) return;
      const remaining = maximumBytes + 1 - byteLength;
      const accepted = chunk.subarray(0, Math.max(0, remaining));
      if (accepted.length > 0) {
        let offset = 0;
        while (offset < accepted.length) {
          const written = fs.writeSync(descriptor, accepted, offset,
            accepted.length - offset, null);
          invariant(written > 0, "numerical-execution-capture-short-write");
          offset += written;
        }
        byteLength += accepted.length;
      }
      if (byteLength > maximumBytes || accepted.length < chunk.length) overflow = true;
    },
    close() {
      invariant(!closed, "numerical-execution-capture-state");
      closed = true;
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      return Object.freeze({ byteLength, overflow });
    }
  };
}

function summarizeBuffer(bytes) {
  return Object.freeze({ byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
}

/** Keep runtime startup, credentials, and caches out of the inherited environment. */
function createChildEnvironment(scratchRoot, parentEnvironment = process.env) {
  const root = directDirectory(requireCanonicalArtifactPath(scratchRoot),
    "numerical-execution-child-scratch");
  const environment = Object.create(null);
  // Only the OS directory is inherited; executable lookup uses the bound absolute paths.
  const systemRootKeys = Object.keys(parentEnvironment)
    .filter((key) => key.toUpperCase() === "SYSTEMROOT");
  invariant(systemRootKeys.length <= 1, "numerical-execution-system-root-ambiguous");
  if (process.platform === "win32") {
    const systemRoot = directDirectory(parentEnvironment[systemRootKeys[0]],
      "numerical-execution-system-root");
    environment.SystemRoot = systemRoot;
    environment.WINDIR = systemRoot;
    environment.PATH = path.join(systemRoot, "System32");
  } else {
    environment.PATH = "/usr/bin:/bin";
  }
  for (const name of ["TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA",
    "LOCALAPPDATA", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "HF_HOME", "HF_HUB_CACHE",
    "HF_DATASETS_CACHE", "TORCH_HOME", "TORCHINDUCTOR_CACHE_DIR", "NUMBA_CACHE_DIR",
    "TRITON_CACHE_DIR"]) {
    environment[name] = root;
  }
  for (const name of ["HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_DATASETS_OFFLINE",
    "HF_HUB_DISABLE_TELEMETRY", "HF_HUB_DISABLE_IMPLICIT_TOKEN", "OMP_NUM_THREADS",
    "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS"]) environment[name] = "1";
  environment.TOKENIZERS_PARALLELISM = "false";
  // Node otherwise copies ambient coverage into an explicit env (and mutates it).
  environment.NODE_V8_COVERAGE = "";
  return Object.freeze(environment);
}

/** Validate every child output parent before opening either create-only capture. */
function validateProcessLocations(options) {
  if (options.workingDirectory === CANONICAL_REPOSITORY_ROOT) {
    requireCanonicalSiteRoot(path.join(options.workingDirectory, "tinyrustlm"));
  } else {
    directDirectory(requireCanonicalArtifactPath(options.workingDirectory),
      "numerical-execution-child-working-directory");
  }
  for (const stream of [options.stdoutPath, options.stderrPath]) {
    requireAbsolutePath(stream, "numerical-execution-child-stream");
    directDirectory(requireCanonicalArtifactPath(path.dirname(stream)),
      "numerical-execution-child-stream-parent");
  }
}

function terminateOwnedProcess(child, options) {
  if (!child || child.pid === undefined) return Object.freeze({ requested: false, method: null });
  if (process.platform === "win32") {
    const result = childProcess.spawnSync(options.terminationPath,
      ["/PID", String(child.pid), "/T", "/F"], {
        cwd: options.workingDirectory,
        env: options.childEnvironment,
        encoding: "buffer",
        maxBuffer: MAXIMUM_TERMINATION_OUTPUT_BYTES,
        timeout: 30000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
    let directKillAccepted = false;
    try {
      directKillAccepted = child.kill("SIGKILL");
    } catch {
      directKillAccepted = false;
    }
    return Object.freeze({ requested: true, method: "exact-taskkill-process-tree",
      toolExitCode: result.status, spawnError: result.error ? "termination-tool-error" : null,
      stdout: summarizeBuffer(stdout), stderr: summarizeBuffer(stderr),
      directKillAttempted: true, directKillAccepted });
  }
  return Object.freeze({ requested: true, method: "direct-child-termination",
    signalAccepted: child.kill("SIGKILL"), toolExitCode: null, spawnError: null });
}

function runCapturedProcess(executablePath, argumentsList, options) {
  return new Promise((resolve) => {
    validateProcessLocations(options);
    const childEnvironment = createChildEnvironment(options.scratchRoot);
    const stdoutCapture = createBoundedCapture(options.stdoutPath, options.maximumStdoutBytes);
    let stderrCapture;
    try {
      stderrCapture = createBoundedCapture(options.stderrPath, options.maximumStderrBytes);
    } catch (error) {
      stdoutCapture.close();
      throw error;
    }
    let child;
    let timedOut = false;
    let killedForOverflow = false;
    let spawnCode = null;
    let streamCode = null;
    let termination = Object.freeze({ requested: false, method: null });
    const startedAt = Date.now();
    const completeWithoutChild = () => {
      const stdout = stdoutCapture.close();
      const stderr = stderrCapture.close();
      resolve(Object.freeze({ stage: options.stage, startedAtUtc: new Date(startedAt).toISOString(),
        finishedAtUtc: new Date().toISOString(), durationMilliseconds: Date.now() - startedAt,
        processStarted: false, exitCode: null, signal: null, timedOut, killedForOverflow,
        spawnCode, streamCode, termination,
        stdout: { ...stdout, ...sha256File(options.stdoutPath,
          options.maximumStdoutBytes + 1, true) },
        stderr: { ...stderr, ...sha256File(options.stderrPath,
          options.maximumStderrBytes + 1, true) } }));
    };
    try {
      child = childProcess.spawn(executablePath, argumentsList, {
        cwd: options.workingDirectory,
        env: childEnvironment,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      spawnCode = "numerical-execution-process-spawn";
      completeWithoutChild();
      return;
    }
    let settled = false;
    const requestTermination = (reason) => {
      if (termination.requested) return;
      if (reason === "timeout") timedOut = true;
      if (reason === "overflow") killedForOverflow = true;
      termination = terminateOwnedProcess(child, { ...options, childEnvironment });
    };
    child.stdout.on("data", (chunk) => {
      try {
        stdoutCapture.append(chunk);
        if (fs.lstatSync(options.stdoutPath).size > options.maximumStdoutBytes) {
          requestTermination("overflow");
        }
      } catch {
        streamCode = "numerical-execution-stdout-capture";
        requestTermination("stream");
      }
    });
    child.stderr.on("data", (chunk) => {
      try {
        stderrCapture.append(chunk);
        if (fs.lstatSync(options.stderrPath).size > options.maximumStderrBytes) {
          requestTermination("overflow");
        }
      } catch {
        streamCode = "numerical-execution-stderr-capture";
        requestTermination("stream");
      }
    });
    child.stdout.once("error", () => {
      streamCode = "numerical-execution-stdout-stream";
      requestTermination("stream");
    });
    child.stderr.once("error", () => {
      streamCode = "numerical-execution-stderr-stream";
      requestTermination("stream");
    });
    child.once("error", () => { spawnCode = "numerical-execution-process-error"; });
    const timer = setTimeout(() => requestTermination("timeout"),
      options.maximumDurationMilliseconds);
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = stdoutCapture.close();
      const stderr = stderrCapture.close();
      resolve(Object.freeze({ stage: options.stage,
        startedAtUtc: new Date(startedAt).toISOString(),
        finishedAtUtc: new Date().toISOString(), durationMilliseconds: Date.now() - startedAt,
        processStarted: child.pid !== undefined, exitCode, signal, timedOut, killedForOverflow,
        spawnCode, streamCode, termination,
        stdout: { ...stdout, ...sha256File(options.stdoutPath,
          options.maximumStdoutBytes + 1, true) },
        stderr: { ...stderr, ...sha256File(options.stderrPath,
          options.maximumStderrBytes + 1, true) } }));
    });
  });
}

function processPassed(outcome) {
  return outcome.processStarted === true && outcome.exitCode === 0 && outcome.signal === null
    && outcome.timedOut === false && outcome.killedForOverflow === false
    && outcome.spawnCode === null && outcome.streamCode === null && outcome.stdout.overflow === false
    && outcome.stderr.overflow === false && outcome.stderr.byteLength === 0;
}

function argumentsSha256(argumentsList) {
  return crypto.createHash("sha256").update(canonicalJsonBytes(argumentsList)).digest("hex");
}

function createProcessTerminal(operationId, stage, executableBefore, executableAfter,
  argumentsList, outcome) {
  return {
    schema: PROCESS_TERMINAL_SCHEMA,
    operationId,
    stage,
    launchOrdinal: 1,
    launchCountLimit: 1,
    argumentsSha256: argumentsSha256(argumentsList),
    executableBefore,
    executableAfter,
    executableUnchanged: executableBefore.byteLength === executableAfter.byteLength
      && executableBefore.sha256 === executableAfter.sha256,
    outcome,
    retryAllowed: false,
    overwriteAllowed: false,
    repairAllowed: false
  };
}

function inventoryEvidence(root) {
  return fs.readdirSync(root).sort().map((fileName) => {
    const filePath = safeChild(root, fileName, "numerical-execution-evidence-inventory");
    const identity = sha256File(filePath, MAXIMUM_STREAM_BYTES + 1, true);
    return { fileName, ...identity };
  });
}

function createOwnerTerminal(state, status, reasonCode, launchedStages, verifierReceipt,
  evidenceRoot) {
  return {
    schema: OWNER_TERMINAL_SCHEMA,
    operationId: state.registration.ownerContract.operationId,
    status,
    reasonCode,
    claim: status === "terminal-pass"
      ? "registered-source-reconstructed-scalar-numerical-gate-only"
      : "no-numerical-pass-claim",
    registration: state.registrationIdentity,
    registrationSource: state.request.registrationSource,
    ownerRequest: state.requestIdentity,
    launchedStages,
    launchCounts: Object.fromEntries(STAGES.map((stage) =>
      [stage, launchedStages.filter((item) => item === stage).length])),
    verifierReceipt,
    evidenceInventoryBeforeTerminal: inventoryEvidence(evidenceRoot),
    immutableClosure: {
      retryAllowed: false,
      overwriteAllowed: false,
      repairAllowed: false,
      partialOutputCleanupAllowed: false,
      thresholdChangeAllowed: false,
      failedOutputAdoptionAllowed: false
    },
    allowedClaim: status === "terminal-pass"
      ? "source-to-reconstructed-and-reconstructed-to-scalar-numerical-gate"
      : "none",
    prohibitedClaims: ["optimized-native-parity", "browser-wasm-parity",
      "behavioral-quality", "p2p-availability", "site-release", "campaign-progress"]
  };
}

async function execute(requestPath) {
  const state = validateRequest(requestPath);
  const authority = verifySingleSourceAuthority();
  invariant(authority.verdict === "pass" && authority.localScanPerformed === true,
    "numerical-execution-source-authority-not-pass");
  const artifacts = verifySourceState(state);
  invariant(artifacts.get("execution-owner").path.toLowerCase() === __filename.toLowerCase(),
    "numerical-execution-owner-path");
  const executables = verifyExecutables(state);
  const paths = derivePaths(state);
  const contract = state.registration.ownerContract;
  const names = contract.evidenceFiles;
  const requests = childRequests(state, paths);
  const evidence = (name) => safeChild(paths.ownerEvidenceRoot, name,
    "numerical-execution-evidence-path");
  const launchedStages = [];
  let verifierReceipt = null;
  let terminalStatus = "terminal-ambiguous";
  let reasonCode = "numerical-execution-unclosed";
  let evidenceRootCreated = false;
  try {
    fs.mkdirSync(paths.ownerEvidenceRoot);
    evidenceRootCreated = true;
    fs.mkdirSync(paths.sourceScratchRoot);
    writeCanonicalNew(evidence(names.binding), {
      schema: "tinyrustlm.qwen3_numerical_execution_binding.v1",
      operationId: contract.operationId,
      registration: state.registrationIdentity,
      registrationSource: state.request.registrationSource,
      ownerRequest: state.requestIdentity,
      executables,
      roots: Object.fromEntries(Object.entries(paths).map(([key, value]) =>
        [key, path.basename(value)])),
      sourceDirectoryObserved: true,
      compositionRootObserved: true
    });
    writeCanonicalNew(evidence(names.start), {
      schema: "tinyrustlm.qwen3_numerical_execution_start.v1",
      operationId: contract.operationId,
      startedAtUtc: new Date().toISOString(),
      stageOrder: STAGES,
      launchLimitPerStage: 1,
      retryAllowed: false,
      outputRootsAbsentBeforeStart: true
    });
    const requestFiles = {
      source: evidence(names.sourceRequest),
      reconstructed: evidence(names.reconstructedRequest),
      scalar: evidence(names.scalarRequest),
      verifier: evidence(names.verificationRequest)
    };
    writeCanonicalNew(requestFiles.source, requests.source);
    writeCanonicalNew(requestFiles.reconstructed, requests.reconstructed);
    writeCanonicalNew(requestFiles.scalar, requests.scalar);

    const stageConfiguration = {
      source: { executable: executables.python,
        executablePath: state.executablePaths.pythonPath,
        arguments: [...ISOLATED_PYTHON_ARGUMENTS,
          artifacts.get("source-owner").path, requestFiles.source],
        stdout: names.sourceStdout, stderr: names.sourceStderr, terminal: names.sourceTerminal },
      reconstructed: { executable: executables.python,
        executablePath: state.executablePaths.pythonPath,
        arguments: [...ISOLATED_PYTHON_ARGUMENTS,
          artifacts.get("reconstructed-owner").path, requestFiles.reconstructed],
        stdout: names.reconstructedStdout, stderr: names.reconstructedStderr,
        terminal: names.reconstructedTerminal },
      scalar: { executable: executables.scalar,
        executablePath: state.executablePaths.scalarPath,
        arguments: [requestFiles.scalar], stdout: names.scalarStdout,
        stderr: names.scalarStderr, terminal: names.scalarTerminal }
    };
    for (const stage of ["source", "reconstructed", "scalar"]) {
      const configuration = stageConfiguration[stage];
      const executableBefore = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      invariant(executableBefore.byteLength === configuration.executable.byteLength
        && executableBefore.sha256 === configuration.executable.sha256,
      "numerical-execution-executable-before-launch");
      launchedStages.push(stage);
      const outcome = await runCapturedProcess(configuration.executablePath,
        configuration.arguments, {
          stage,
          workingDirectory: state.repositoryRoot,
          scratchRoot: paths.sourceScratchRoot,
          stdoutPath: evidence(configuration.stdout),
          stderrPath: evidence(configuration.stderr),
          maximumStdoutBytes: contract.processPolicy.maximumStdoutBytes,
          maximumStderrBytes: contract.processPolicy.maximumStderrBytes,
          maximumDurationMilliseconds: contract.processPolicy.maximumDurationMilliseconds[stage],
          terminationPath: state.executablePaths.terminationPath
        });
      const executableAfter = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      writeCanonicalNew(evidence(configuration.terminal), createProcessTerminal(
        contract.operationId, stage, executableBefore, executableAfter,
        configuration.arguments, outcome));
      if (!processPassed(outcome) || executableBefore.sha256 !== executableAfter.sha256
          || executableBefore.byteLength !== executableAfter.byteLength) {
        terminalStatus = "terminal-failure";
        reasonCode = `${stage}-process-not-pass`;
        break;
      }
    }

    if (launchedStages.length === 3 && terminalStatus === "terminal-ambiguous") {
      const verificationRequest = finalizeVerificationRequest(requests, paths);
      writeCanonicalNew(requestFiles.verifier, verificationRequest);
      const configuration = { executable: executables.node,
        executablePath: state.executablePaths.nodePath,
        arguments: [artifacts.get("verifier").path, requestFiles.verifier],
        stdout: names.verifierStdout, stderr: names.verifierStderr,
        terminal: names.verifierTerminal };
      const executableBefore = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      launchedStages.push("verifier");
      const outcome = await runCapturedProcess(configuration.executablePath,
        configuration.arguments, {
          stage: "verifier",
          workingDirectory: state.repositoryRoot,
          scratchRoot: paths.sourceScratchRoot,
          stdoutPath: evidence(configuration.stdout), stderrPath: evidence(configuration.stderr),
          maximumStdoutBytes: contract.processPolicy.maximumStdoutBytes,
          maximumStderrBytes: contract.processPolicy.maximumStderrBytes,
          maximumDurationMilliseconds:
            contract.processPolicy.maximumDurationMilliseconds.verifier,
          terminationPath: state.executablePaths.terminationPath
        });
      const executableAfter = sha256File(configuration.executablePath,
        MAXIMUM_EXECUTABLE_BYTES, false);
      writeCanonicalNew(evidence(configuration.terminal), createProcessTerminal(
        contract.operationId, "verifier", executableBefore, executableAfter,
        configuration.arguments, outcome));
      if (!processPassed(outcome) || executableBefore.sha256 !== executableAfter.sha256
          || executableBefore.byteLength !== executableAfter.byteLength) {
        terminalStatus = "terminal-failure";
        reasonCode = "verifier-process-not-pass";
      } else {
        const receiptDocument = readCanonicalJson(evidence(names.verifierStdout),
          contract.processPolicy.maximumStdoutBytes, "numerical-execution-verifier-receipt");
        verifierReceipt = receiptDocument.value;
        invariant(verifierReceipt.schema === VERIFIER_RECEIPT_SCHEMA
          && verifierReceipt.operationId === contract.operationId
          && verifierReceipt.registrationSha256 === state.registrationIdentity.sha256
          && ["pass", "fail"].includes(verifierReceipt.status)
          && verifierReceipt.writesPerformed === false,
        "numerical-execution-verifier-receipt");
        terminalStatus = verifierReceipt.status === "pass" ? "terminal-pass"
          : "terminal-rejected";
        reasonCode = verifierReceipt.status === "pass" ? "registered-differentials-pass"
          : "registered-differential-rejected";
      }
    }
  } catch (error) {
    terminalStatus = launchedStages.length === 0 ? "terminal-failure" : "terminal-ambiguous";
    reasonCode = safeErrorCode(error);
  }
  invariant(evidenceRootCreated, "numerical-execution-evidence-root-create");
  const terminal = createOwnerTerminal(state, terminalStatus, reasonCode, launchedStages,
    verifierReceipt, paths.ownerEvidenceRoot);
  writeCanonicalNew(evidence(names.ownerTerminal), terminal);
  return Object.freeze({ terminal, ownerEvidenceRoot: paths.ownerEvidenceRoot });
}

async function main(argumentsList) {
  invariant(argumentsList.length === 2 && argumentsList[0] === "execute",
    "numerical-execution-arguments");
  const observation = await execute(requireAbsolutePath(argumentsList[1],
    "numerical-execution-request-path"));
  process.stdout.write(canonicalJsonBytes({
    schema: "tinyrustlm.qwen3_numerical_execution_owner_observation.v1",
    operationId: observation.terminal.operationId,
    status: observation.terminal.status,
    reasonCode: observation.terminal.reasonCode,
    claim: observation.terminal.claim
  }));
  if (observation.terminal.status !== "terminal-pass") process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`qwen3-numerical-execution-owner-error:${safeErrorCode(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  ISOLATED_PYTHON_ARGUMENTS,
  createChildEnvironment,
  validateOperationLocations,
  validateProcessLocations,
  NumericalExecutionOwnerError,
  REGISTRATION_RELATIVE_PATH,
  REQUEST_SCHEMA,
  REGISTRATION_SCHEMA,
  OWNER_CONTRACT_SCHEMA,
  SOURCE_REQUEST_SCHEMA,
  canonicalJsonBytes,
  childRequests,
  createProcessTerminal,
  execute,
  processPassed,
  runCapturedProcess,
  safeErrorCode,
  validateOwnerContract,
  validateRegistration
});
