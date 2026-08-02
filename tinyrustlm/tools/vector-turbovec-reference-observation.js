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
  validateManifestFile
} = require("./vector-turbovec-reference-preregistration.js");

const expectedExperimentId =
  "turbovec-090-4bit-tqplus-reference-comparison-20260725";
const expectedMethodId = "turbovec-crate-090-4bit-tqplus-native-reference";
const contractSchema = "tinyrustlm.turbovec_reference_benchmark_contract.v1";
const qualitySchema = "tinyrustlm.turbovec_reference_quality_process.v1";
const performanceSchema = "tinyrustlm.turbovec_reference_performance_process.v1";
const corruptionSchema = "tinyrustlm.turbovec_reference_corruption_process.v1";
const recoverySchema = "tinyrustlm.turbovec_reference_deletion_recovery.v1";
const observationSchema = "tinyrustlm.turbovec_reference_comparison_observation.v1";
const attemptSchema = "tinyrustlm.turbovec_reference_comparison_attempt.v1";
const pendingAttemptSchema =
  "tinyrustlm.turbovec_reference_comparison_pending_attempt.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationRelativePath =
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-comparison-preregistration.v1.json";
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-comparison-observation-v1.json";
const observationPath = path.join(repositoryRoot, observationRelativePath);
const pendingAttemptRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "turbovec-reference-comparison-pending-attempt-v1.json";
const pendingAttemptPath = path.join(repositoryRoot, pendingAttemptRelativePath);
const attemptRelativeDirectory =
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptRelativeDirectory);
const comparisonPrefix =
  "tinyrustlm/experiments/vector-quantization/turbovec-reference-comparison/";
const comparisonManifestRelativePath = `${comparisonPrefix}Cargo.toml`;
const comparisonLockRelativePath = `${comparisonPrefix}Cargo.lock`;
const comparisonSourceRelativePath = `${comparisonPrefix}src/main.rs`;
const runnerRelativePath =
  "tinyrustlm/tools/vector-turbovec-reference-observation.js";
const verifierRelativePath =
  "tinyrustlm/tools/vector-turbovec-reference-verification.js";
const runnerTestRelativePath =
  "tinyrustlm/tests/vector-turbovec-reference-observation.test.js";
const verifierTestRelativePath =
  "tinyrustlm/tests/vector-turbovec-reference-verification.test.js";
const preregistrationSha256 =
  "96a3fad0078850e2fe9fb4d619979ca9e5b753f23a3fab6df53aebe9b9afe6ed";
const parentSelectionSha256 =
  "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd";
const crateArtifactSha256 =
  "0715a5a1365e86d0ae6396fa0c011f319b8e8024b3896cd16e6468e29ed3a325";
const crateArtifactBytes = 89523;
const crateVcsRevision = "1e7200cfd8f26c92ce2855652db64bc7f85bc039";
const datasetRevision = "b2617bb6d3ffa2e429640350f613e3291e10b141";
const datasetTree = "ec8d5e52c0b9b2b09ea3f9d36b7bfafaf8ec0e97";
const datasetLicenseSha256 =
  "860025a4fd4ca5e669981b245ad022a89818c5b6412177700d7836b909bcf281";
const datasetReadmeSha256 =
  "39c94926ec72ab72920ab57f1c22908b4607c38f803aa85284ae85fc492518db";
const processCrashExitCode = 74;
const comparatorMonitorFailureCodes = new Set([
  "performance-monitor-marker-check-failed",
  "performance-monitor-marker-invalid",
  "performance-monitor-marker-metadata-failed",
  "performance-monitor-ready-timeout",
  "performance-monitor-request-write-failed",
  "performance-post-prepare-ack-timeout",
  "performance-post-prepare-write-failed"
]);
const maximumInputBytes = 32 * 1024 * 1024;
const maximumEvidenceBytes = 32 * 1024 * 1024;
const maximumCommandOutputBytes = 48 * 1024 * 1024;
const maximumDatasetFileBytes = 128 * 1024 * 1024;
const perProcessTimeoutMilliseconds = 300000;
const overallTimeoutMilliseconds = 3600000;
const safeIntegerMaximum = Number.MAX_SAFE_INTEGER;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const safeVersionPattern = /^[A-Za-z0-9][A-Za-z0-9 ._()+:/-]{0,255}$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;
const outerRootPrefix = "tinyrustlm-turbovec-reference-observation-";
const outerRootMarker = ".tinyrustlm-turbovec-observation-owned-v1";
const processRootMarker = ".tinyrustlm-turbovec-reference-owned";
const childEnvironmentAllowlist = new Set([
  "ALLUSERSPROFILE",
  "APPDATA",
  "CARGO_HOME",
  "COMMONPROGRAMFILES",
  "COMMONPROGRAMFILES(X86)",
  "COMMONPROGRAMW6432",
  "COMSPEC",
  "HOMEDRIVE",
  "HOMEPATH",
  "INCLUDE",
  "LIB",
  "LIBPATH",
  "LOCALAPPDATA",
  "NUMBER_OF_PROCESSORS",
  "OS",
  "PATH",
  "PATHEXT",
  "PROCESSOR_ARCHITECTURE",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "PSMODULEPATH",
  "RUSTUP_HOME",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "UNIVERSALCRTSDKDIR",
  "UCRTVERSION",
  "USERPROFILE",
  "VCINSTALLDIR",
  "VCTOOLSINSTALLDIR",
  "VISUALSTUDIOVERSION",
  "VS140COMNTOOLS",
  "VSINSTALLDIR",
  "WINDIR",
  "WINDOWSSDKDIR",
  "WINDOWSSDKVERSION"
]);
const processRootMarkerBytes = Buffer.from(
  "tinyrustlm-turbovec-reference-owned-v1\n",
  "utf8"
);
const registeredBuildPaths = validateManifestFile().manifest.build;
const exactFlatSourceDirectory = path.posix.dirname(
  registeredBuildPaths.exactFlatLibrarySource
);
const emptySha256 = sha256(Buffer.alloc(0));
const memoryMonitorScript = `${[
  "param(",
  "  [Parameter(Mandatory=$true)][int]$TargetProcessId,",
  "  [Parameter(Mandatory=$true)][string]$ProcessRoot,",
  "  [Parameter(Mandatory=$true)][string]$OutputPath",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "$request = Join-Path $ProcessRoot 'memory-monitor-request'",
  "$ready = Join-Path $ProcessRoot 'memory-monitor-ready'",
  "$postPrepare = Join-Path $ProcessRoot 'memory-post-prepare'",
  "$postPrepareAck = Join-Path $ProcessRoot 'memory-post-prepare-ack'",
  "function Write-NewMarker([string]$Path) {",
  "  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)",
  "  try {",
  "    $bytes = [System.Text.Encoding]::UTF8.GetBytes(\"ready`n\")",
  "    $stream.Write($bytes, 0, $bytes.Length)",
  "    $stream.Flush($true)",
  "  } finally {",
  "    $stream.Dispose()",
  "  }",
  "}",
  "$deadline = [DateTime]::UtcNow.AddSeconds(10)",
  "while (-not (Test-Path -LiteralPath $request -PathType Leaf)) {",
  "  if ([DateTime]::UtcNow -ge $deadline) { throw 'memory-monitor-request-timeout' }",
  "  Start-Sleep -Milliseconds 5",
  "}",
  "$process = Get-Process -Id $TargetProcessId -ErrorAction Stop",
  "$process.Refresh()",
  "if ($process.HasExited) { throw 'memory-monitor-target-exited-before-ready' }",
  "$workingSet = [int64]$process.WorkingSet64",
  "$reportedPeak = [int64]$process.PeakWorkingSet64",
  "$peak = $workingSet",
  "$osPeak = $reportedPeak",
  "$postPrepareWorkingSet = [int64]0",
  "$sampleCount = 1",
  "$postPrepareObserved = $false",
  "Write-NewMarker $ready",
  "while ($true) {",
  "  try {",
  "    $process.Refresh()",
  "    if ($process.HasExited) { break }",
  "    $workingSet = [int64]$process.WorkingSet64",
  "    $reportedPeak = [int64]$process.PeakWorkingSet64",
  "  } catch {",
  "    if (-not (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)) { break }",
  "    throw",
  "  }",
  "  $sampleCount += 1",
  "  if ($workingSet -gt $peak) { $peak = $workingSet }",
  "  if ($reportedPeak -gt $osPeak) { $osPeak = $reportedPeak }",
  "  if (-not $postPrepareObserved -and (Test-Path -LiteralPath $postPrepare -PathType Leaf)) {",
  "    $postPrepareWorkingSet = $workingSet",
  "    $postPrepareObserved = $true",
  "    Write-NewMarker $postPrepareAck",
  "  }",
  "  Start-Sleep -Milliseconds 5",
  "}",
  "if (-not $postPrepareObserved) { throw 'memory-post-prepare-not-observed' }",
  "if ($sampleCount -lt 2) { throw 'memory-monitor-too-few-samples' }",
  "$result = [ordered]@{",
  "  samplingIntervalMilliseconds = 5",
  "  peakWorkingSetBytes = $peak",
  "  osReportedPeakWorkingSetBytes = $osPeak",
  "  postPrepareWorkingSetBytes = $postPrepareWorkingSet",
  "  sampleCount = $sampleCount",
  "  monitorExitCode = 0",
  "}",
  "$json = ($result | ConvertTo-Json -Compress) + \"`n\"",
  "$output = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)",
  "try {",
  "  $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json)",
  "  $output.Write($bytes, 0, $bytes.Length)",
  "  $output.Flush($true)",
  "} finally {",
  "  $output.Dispose()",
  "}"
].join("\r\n")}\r\n`;

const inputPaths = Object.freeze([
  preregistrationRelativePath,
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-preregistration.v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-observation-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-baseline-evidence-verification-v1.json",
  "tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json",
  "agent-file-handoff/Improvement/2026-07-25-turbovec-090-native-reference-arm-selection.md",
  comparisonManifestRelativePath,
  comparisonLockRelativePath,
  comparisonSourceRelativePath,
  runnerRelativePath,
  verifierRelativePath,
  runnerTestRelativePath,
  verifierTestRelativePath,
  "tinyrustlm/tools/campaign-evidence-store.js",
  "tinyrustlm/tools/durable-files.js",
  "tinyrustlm/tools/vector-turbovec-reference-preregistration.js",
  "tinyrustlm/tests/vector-turbovec-reference-preregistration.test.js",
  registeredBuildPaths.exactFlatLibraryManifest,
  registeredBuildPaths.exactFlatLibrarySource,
  `${exactFlatSourceDirectory}/flat_index.rs`,
  `${exactFlatSourceDirectory}/score.rs`,
  `${exactFlatSourceDirectory}/sha256.rs`
]);

const datasetFiles = Object.freeze([
  Object.freeze({
    upstreamPath: "data/fashion/train-images-idx3-ubyte.gz",
    rawName: "train-images.idx",
    compressedBytes: 26421880,
    compressedSha256:
      "3aede38d61863908ad78613f6a32ed271626dd12800ba2636569512369268a84",
    decompressedBytes: 47040016,
    decompressedSha256:
      "c59f468a2f672dc815687fe0f83887768d799fd8a3f3276145d20f83aa44d888",
    idxMagic: 2051,
    itemCount: 60000,
    rows: 28,
    columns: 28
  }),
  Object.freeze({
    upstreamPath: "data/fashion/train-labels-idx1-ubyte.gz",
    rawName: "train-labels.idx",
    compressedBytes: 29515,
    compressedSha256:
      "a04f17134ac03560a47e3764e11b92fc97de4d1bfaf8ba1a3aa29af54cc90845",
    decompressedBytes: 60008,
    decompressedSha256:
      "bad3541b69d912435c50bb6ba87bec294ff4f6a2e1246121d8633921760443d9",
    idxMagic: 2049,
    itemCount: 60000,
    rows: null,
    columns: null
  }),
  Object.freeze({
    upstreamPath: "data/fashion/t10k-images-idx3-ubyte.gz",
    rawName: "test-images.idx",
    compressedBytes: 4422102,
    compressedSha256:
      "346e55b948d973a97e58d2351dde16a484bd415d4595297633bb08f03db6a073",
    decompressedBytes: 7840016,
    decompressedSha256:
      "5b4141f0afbad91edebe8549f8fcffe087ea10ca49f1dbef5c9a5cd8815ce37b",
    idxMagic: 2051,
    itemCount: 10000,
    rows: 28,
    columns: 28
  }),
  Object.freeze({
    upstreamPath: "data/fashion/t10k-labels-idx1-ubyte.gz",
    rawName: "test-labels.idx",
    compressedBytes: 5148,
    compressedSha256:
      "67da17c76eaffca5446c3361aaab5c3cd6d1c2608764d35dfb1850b086bf8dd5",
    decompressedBytes: 10008,
    decompressedSha256:
      "0402a96d92fd2663957122ceb108a494c5af83dab82d92729df917d7dec38c34",
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
    originalDimension: 784,
    encodedDimension: 792,
    declaredRecordCount: 2000,
    sourceActiveRecordCount: 2000,
    candidateRecordCount: 2000,
    queryCount: 200,
    candidateDynamicIndexBytes: 822354,
    exactFullIndexBytes: 6304280,
    capacityMatchedExactRecordCount: 260,
    capacityMatchedExactIndexBytes: 819800,
    naturalThresholds: Object.freeze([0.6475, 0.809375, 0.6707703669488422])
  }),
  Object.freeze({
    laneId: "fashion-mnist-cosine-784",
    laneKind: "natural",
    metric: "cosine",
    normalization: "l2-unit",
    originalDimension: 784,
    encodedDimension: 784,
    declaredRecordCount: 2000,
    sourceActiveRecordCount: 2000,
    candidateRecordCount: 2000,
    queryCount: 200,
    candidateDynamicIndexBytes: 814290,
    exactFullIndexBytes: 6304280,
    capacityMatchedExactRecordCount: 258,
    capacityMatchedExactIndexBytes: 813496,
    naturalThresholds: Object.freeze([0.6275, 0.7958035714285715, 0.6501638538707916])
  }),
  Object.freeze({
    laneId: "synthetic-dot-128",
    laneKind: "synthetic",
    metric: "dot-product",
    normalization: "none",
    originalDimension: 128,
    encodedDimension: 128,
    declaredRecordCount: 1200,
    sourceActiveRecordCount: 1200,
    candidateRecordCount: 1200,
    queryCount: 120,
    candidateDynamicIndexBytes: 92242,
    exactFullIndexBytes: 633880,
    capacityMatchedExactRecordCount: 174,
    capacityMatchedExactIndexBytes: 92152,
    naturalThresholds: null
  }),
  Object.freeze({
    laneId: "synthetic-cosine-384",
    laneKind: "synthetic",
    metric: "cosine",
    normalization: "l2-unit",
    originalDimension: 384,
    encodedDimension: 384,
    declaredRecordCount: 1200,
    sourceActiveRecordCount: 1200,
    candidateRecordCount: 1200,
    queryCount: 120,
    candidateDynamicIndexBytes: 247890,
    exactFullIndexBytes: 1862680,
    capacityMatchedExactRecordCount: 159,
    capacityMatchedExactIndexBytes: 247048,
    naturalThresholds: null
  }),
  Object.freeze({
    laneId: "synthetic-euclidean-768",
    laneKind: "synthetic",
    metric: "squared-euclidean",
    normalization: "none",
    originalDimension: 768,
    encodedDimension: 776,
    declaredRecordCount: 1200,
    sourceActiveRecordCount: 1200,
    candidateRecordCount: 1200,
    queryCount: 120,
    candidateDynamicIndexBytes: 486226,
    exactFullIndexBytes: 3705880,
    capacityMatchedExactRecordCount: 157,
    capacityMatchedExactIndexBytes: 485096,
    naturalThresholds: null
  }),
  Object.freeze({
    laneId: "controlled-memory-cosine-64",
    laneKind: "controlled-memory",
    metric: "cosine",
    normalization: "l2-unit",
    originalDimension: 64,
    encodedDimension: 64,
    declaredRecordCount: 120,
    sourceActiveRecordCount: 110,
    candidateRecordCount: 120,
    queryCount: 30,
    candidateDynamicIndexBytes: 5810,
    exactFullIndexBytes: 32920,
    capacityMatchedExactRecordCount: 20,
    capacityMatchedExactIndexBytes: 5720,
    naturalThresholds: null
  })
]);

const corruptionCases = Object.freeze([
  "header-bit-flip",
  "packed-code-bit-flip",
  "scale-bit-flip",
  "id-bit-flip",
  "truncate-one-byte",
  "append-one-byte",
  "commit-hash-mismatch"
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
  turbovec090NativeReferenceBehaviorVerified: true,
  sameCorpusCompressedRankQualityVerified: true,
  equalDynamicIndexByteCapacityUtilityVerified: true,
  completeDynamicIndexByteReductionVerified: true,
  nativeReferencePerformanceVerified: true,
  wrapperProcessCrashRecoveryVerified: true,
  upstreamPersistenceSafetyVerified: false,
  turboQuantPaperConformanceVerified: false,
  wasmCompatibilityVerified: false,
  browserPerformanceVerified: false,
  representativeSemanticMemoryQualityVerified: false,
  powerLossDurabilityVerified: false,
  filesystemForensicErasureVerified: false,
  productIntegrationVerified: false,
  trainingAuthorized: false,
  releaseAuthorized: false
});

const openGaps = Object.freeze([
  Object.freeze({
    gapId: "wasm-direct-build",
    status: "blocked",
    blockerCode: "UPSTREAM_GETRANDOM_JS_FEATURE_NOT_ENABLED"
  }),
  Object.freeze({
    gapId: "portable-local-compressed-implementation",
    status: "not-implemented",
    blockerCode: null
  }),
  Object.freeze({
    gapId: "semantic-memory-corpus",
    status: "not-proven",
    blockerCode: null
  }),
  Object.freeze({
    gapId: "power-loss-durability",
    status: "not-tested",
    blockerCode: null
  }),
  Object.freeze({
    gapId: "product-adoption",
    status: "not-authorized",
    blockerCode: null
  })
]);

class ObservationFailure extends Error {
  constructor(code, classification, retryAllowed, cause) {
    super(code);
    this.name = "ObservationFailure";
    this.code = code;
    this.classification = classification;
    this.retryAllowed = retryAllowed;
    this.causeMessageSha256 = sha256(Buffer.from(
      String(cause?.message || cause || code),
      "utf8"
    ));
  }
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function outcomeOperation(code, operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ObservationFailure) throw error;
    throw new ObservationFailure(code, "comparison-outcome", false, error);
  }
}

async function outcomeOperationAsync(code, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ObservationFailure) throw error;
    throw new ObservationFailure(code, "comparison-outcome", false, error);
  }
}

function instrumentationFailure(code, cause) {
  return new ObservationFailure(code, "instrumentation", true, cause);
}

function cleanupWithFailurePolicy(primaryFailure, code, operations) {
  let cleanupFailure = null;
  for (const operation of operations) {
    try {
      operation();
    } catch (error) {
      if (cleanupFailure === null) cleanupFailure = error;
    }
  }
  if (cleanupFailure === null) return;
  const classification = primaryFailure instanceof ObservationFailure
    ? primaryFailure.classification
    : "infrastructure";
  const retryAllowed = primaryFailure instanceof ObservationFailure
    ? primaryFailure.retryAllowed
    : true;
  const primaryHash = sha256(Buffer.from(
    String(primaryFailure?.message || "no-primary-failure"),
    "utf8"
  ));
  const cleanupHash = sha256(Buffer.from(
    String(cleanupFailure?.message || cleanupFailure || "cleanup-failure"),
    "utf8"
  ));
  throw new ObservationFailure(
    code,
    classification,
    retryAllowed,
    new Error(`${primaryHash}:${cleanupHash}`)
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    `${label} keys are invalid`
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

function approximateValue(value, expected, label, tolerance = 1e-12) {
  finiteNumber(value, label);
  finiteNumber(expected, `${label} expected`);
  const scale = Math.max(1, Math.abs(value), Math.abs(expected));
  invariant(Math.abs(value - expected) <= tolerance * scale, `${label} is invalid`);
}

function finiteNumber(
  value,
  label,
  minimum = -Number.MAX_VALUE,
  maximum = Number.MAX_VALUE
) {
  invariant(
    typeof value === "number" && Number.isFinite(value) &&
      value >= minimum && value <= maximum,
    `${label} is invalid`
  );
  return value;
}

function safeInteger(value, label, minimum = 0, maximum = safeIntegerMaximum) {
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
  const text = JSON.stringify(value);
  invariant(!forbiddenTextPattern.test(text), `${label} contains private or secret text`);
  return value;
}

function boundedFile(filePath, maximumBytes, label) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file`);
  invariant(stat.size > 0 && stat.size <= maximumBytes, `${label} size is invalid`);
  return stat;
}

function resolveRepositoryFile(relativePath, maximumBytes = maximumInputBytes) {
  invariant(
    typeof relativePath === "string" && relativePath.length > 0 &&
      !path.isAbsolute(relativePath) && !relativePath.includes(".."),
    "repository relative path is invalid"
  );
  const absolute = path.resolve(repositoryRoot, relativePath);
  invariant(
    absolute.startsWith(`${repositoryRoot}${path.sep}`),
    "repository input escapes repository root"
  );
  boundedFile(absolute, maximumBytes, `repository input ${relativePath}`);
  return absolute;
}

function hashInput(relativePath) {
  const absolute = resolveRepositoryFile(relativePath);
  const stat = fs.statSync(absolute);
  return Object.freeze({
    path: relativePath.replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: sha256File(absolute)
  });
}

function parseSingleJson(stdout, maximumBytes, label) {
  invariant(Buffer.byteLength(stdout, "utf8") <= maximumBytes, `${label} is too large`);
  invariant(stdout.endsWith("\n"), `${label} lacks trailing newline`);
  invariant(!stdout.slice(0, -1).includes("\n"), `${label} is not one JSON line`);
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  publicSafe(value, label);
  invariant(
    stdout === `${JSON.stringify(value)}\n`,
    `${label} is not canonical compact JSON`
  );
  return value;
}

function percentile(values, percentileValue) {
  invariant(Array.isArray(values) && values.length > 0, "percentile input is empty");
  const ordered = values.map((value, index) =>
    finiteNumber(value, `percentile value ${index}`)).sort((left, right) => left - right);
  const rank = Math.ceil(percentileValue * ordered.length);
  return ordered[Math.max(0, rank - 1)];
}

function statistics(values) {
  invariant(Array.isArray(values) && values.length > 0, "statistics input is empty");
  const ordered = values.map((value, index) =>
    finiteNumber(value, `statistics value ${index}`, 0)).sort((left, right) => left - right);
  return Object.freeze({
    minimum: ordered[0],
    median: percentile(ordered, 0.5),
    p95: percentile(ordered, 0.95),
    p99: percentile(ordered, 0.99),
    maximum: ordered.at(-1)
  });
}

function expectedClassOrTopic(lane, ordinal) {
  if (lane.laneKind === "natural") return Math.floor(ordinal / 20);
  if (lane.laneKind === "controlled-memory") return Math.floor(ordinal / 3);
  const familyCounts = [30, 24, 24, 18, 12, 12];
  let offset = 0;
  for (const [family, count] of familyCounts.entries()) {
    if (ordinal < offset + count) return family;
    offset += count;
  }
  throw new Error("synthetic query ordinal is invalid");
}

function validateRankingMetrics(value, label) {
  exactKeys(value, [
    "recallAt1", "recallAt10", "recallAt100", "mrrAt100", "ndcgAt100",
    "rankInversionsAt100", "rankInversionRateAt100",
    "maximumAbsoluteNormalizedScoreError", "meanAbsoluteNormalizedScoreError",
    "p99AbsoluteNormalizedScoreError", "nonFiniteScoreCount",
    "duplicateResultCount", "missingResultCount"
  ], label);
  for (const field of [
    "recallAt1", "recallAt10", "recallAt100", "mrrAt100", "ndcgAt100",
    "rankInversionRateAt100"
  ]) {
    finiteNumber(value[field], `${label}.${field}`, 0, 1);
  }
  for (const field of [
    "maximumAbsoluteNormalizedScoreError", "meanAbsoluteNormalizedScoreError",
    "p99AbsoluteNormalizedScoreError"
  ]) {
    finiteNumber(value[field], `${label}.${field}`, 0);
  }
  for (const field of [
    "rankInversionsAt100", "nonFiniteScoreCount", "duplicateResultCount",
    "missingResultCount"
  ]) {
    safeInteger(value[field], `${label}.${field}`);
  }
  invariant(
    value.recallAt1 <= value.recallAt10 &&
      value.recallAt10 <= value.recallAt100,
    `${label} recall monotonicity is invalid`
  );
  return value;
}

function validateErrorSummary(metrics, errors, label) {
  const expectedMaximum = errors.length === 0 ? 0 : Math.max(...errors);
  const expectedMean = errors.length === 0
    ? 0
    : errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const expectedP99 = errors.length === 0 ? 0 : percentile(errors, 0.99);
  approximateValue(
    metrics.maximumAbsoluteNormalizedScoreError,
    expectedMaximum,
    `${label}.maximumAbsoluteNormalizedScoreError`
  );
  approximateValue(
    metrics.meanAbsoluteNormalizedScoreError,
    expectedMean,
    `${label}.meanAbsoluteNormalizedScoreError`
  );
  approximateValue(
    metrics.p99AbsoluteNormalizedScoreError,
    expectedP99,
    `${label}.p99AbsoluteNormalizedScoreError`
  );
}

function validateQueryMetric(value, lane, ordinal) {
  const label = `perQueryMetrics ${lane.laneId}/${ordinal}`;
  exactKeys(value, [
    "laneId", "queryOrdinal", "classOrTopic", "candidate",
    "capacityMatchedExact", "candidateResultCount", "candidateResultDigest",
    "rawCandidateScores", "declaredScores",
    "candidateAbsoluteNormalizedScoreErrors",
    "capacityMatchedExactAbsoluteNormalizedScoreErrors",
    "labelPrecisionAt10", "labelMrrAt10", "labelNdcgAt10",
    "expectedFirstHit", "forbiddenHitCountAt10", "deletedHitCount",
    "filterViolationCount"
  ], label);
  exactValue(value.laneId, lane.laneId, `${label}.laneId`);
  exactValue(value.queryOrdinal, ordinal, `${label}.queryOrdinal`);
  exactValue(
    value.classOrTopic,
    expectedClassOrTopic(lane, ordinal),
    `${label}.classOrTopic`
  );
  validateRankingMetrics(value.candidate, `${label}.candidate`);
  validateRankingMetrics(
    value.capacityMatchedExact,
    `${label}.capacityMatchedExact`
  );
  const expectedHitCount = lane.laneKind === "controlled-memory" ? 8 : 100;
  safeInteger(value.candidateResultCount, `${label}.candidateResultCount`);
  exactValue(
    value.candidateResultCount,
    expectedHitCount,
    `${label}.candidateResultCount`
  );
  invariant(
    sha256Pattern.test(value.candidateResultDigest),
    `${label}.candidateResultDigest is invalid`
  );
  invariant(
    Array.isArray(value.rawCandidateScores) &&
      value.rawCandidateScores.length === value.candidateResultCount &&
      Array.isArray(value.declaredScores) &&
      value.declaredScores.length === value.candidateResultCount,
    `${label} score sequence lengths are invalid`
  );
  const rawScores = value.rawCandidateScores.map((score, index) =>
    finiteNumber(score, `${label}.rawCandidateScores[${index}]`));
  const declaredScores = value.declaredScores.map((score, index) =>
    finiteNumber(score, `${label}.declaredScores[${index}]`));
  for (let index = 0; index < value.candidateResultCount; index += 1) {
    if (lane.metric !== "squared-euclidean") {
      approximateValue(
        declaredScores[index],
        rawScores[index],
        `${label}.declaredScores[${index}]`
      );
    }
    if (index > 0) {
      invariant(
        rawScores[index - 1] >= rawScores[index],
        `${label}.rawCandidateScores order is invalid`
      );
      invariant(
        lane.metric === "squared-euclidean"
          ? declaredScores[index - 1] <= declaredScores[index]
          : declaredScores[index - 1] >= declaredScores[index],
        `${label}.declaredScores order is invalid`
      );
    }
  }
  exactValue(
    value.candidate.duplicateResultCount,
    0,
    `${label}.candidate.duplicateResultCount`
  );
  exactValue(
    value.candidate.missingResultCount,
    expectedHitCount - value.candidateResultCount,
    `${label}.candidate.missingResultCount`
  );
  for (const [field, metrics, expectedLength] of [
    [
      "candidateAbsoluteNormalizedScoreErrors",
      value.candidate,
      value.candidateResultCount
    ],
    [
      "capacityMatchedExactAbsoluteNormalizedScoreErrors",
      value.capacityMatchedExact,
      expectedHitCount - value.capacityMatchedExact.missingResultCount
    ]
  ]) {
    invariant(Array.isArray(value[field]), `${label}.${field} is invalid`);
    exactValue(value[field].length, expectedLength, `${label}.${field}.length`);
    const errors = value[field].map((error, index) =>
      finiteNumber(error, `${label}.${field}[${index}]`, 0));
    validateErrorSummary(metrics, errors, `${label}.${field}`);
    const intersected = metrics.recallAt100 * expectedHitCount;
    invariant(
      Math.abs(intersected - Math.round(intersected)) <= 1e-9,
      `${label}.${field}.recallAt100 intersection is invalid`
    );
    const intersectedCount = Math.round(intersected);
    const pairCount = intersectedCount * (intersectedCount - 1) / 2;
    approximateValue(
      metrics.rankInversionRateAt100,
      pairCount === 0 ? 0 : metrics.rankInversionsAt100 / pairCount,
      `${label}.${field}.rankInversionRateAt100`
    );
  }
  if (lane.laneKind === "natural") {
    for (const field of [
      "labelPrecisionAt10", "labelMrrAt10", "labelNdcgAt10"
    ]) {
      finiteNumber(value[field], `${label}.${field}`, 0, 1);
    }
    for (const field of [
      "expectedFirstHit", "forbiddenHitCountAt10", "deletedHitCount",
      "filterViolationCount"
    ]) {
      exactValue(value[field], null, `${label}.${field}`);
    }
  } else if (lane.laneKind === "controlled-memory") {
    for (const field of [
      "labelPrecisionAt10", "labelMrrAt10", "labelNdcgAt10"
    ]) {
      exactValue(value[field], null, `${label}.${field}`);
    }
    invariant(typeof value.expectedFirstHit === "boolean", `${label}.expectedFirstHit`);
    for (const field of [
      "forbiddenHitCountAt10", "deletedHitCount", "filterViolationCount"
    ]) {
      safeInteger(value[field], `${label}.${field}`);
    }
  } else {
    for (const field of [
      "labelPrecisionAt10", "labelMrrAt10", "labelNdcgAt10",
      "expectedFirstHit", "forbiddenHitCountAt10", "deletedHitCount",
      "filterViolationCount"
    ]) {
      exactValue(value[field], null, `${label}.${field}`);
    }
  }
  return value;
}

function aggregateRanking(queries, arm, errorField) {
  const metrics = queries.map((query) => query[arm]);
  const errors = queries.flatMap((query) => query[errorField]);
  return Object.freeze({
    minimumRecallAt1: Math.min(...metrics.map((value) => value.recallAt1)),
    minimumRecallAt10: Math.min(...metrics.map((value) => value.recallAt10)),
    minimumRecallAt100: Math.min(...metrics.map((value) => value.recallAt100)),
    minimumMrrAt100: Math.min(...metrics.map((value) => value.mrrAt100)),
    minimumNdcgAt100: Math.min(...metrics.map((value) => value.ndcgAt100)),
    maximumRankInversionRateAt100:
      Math.max(...metrics.map((value) => value.rankInversionRateAt100)),
    totalRankInversionsAt100:
      metrics.reduce((sum, value) => sum + value.rankInversionsAt100, 0),
    maximumAbsoluteNormalizedScoreError:
      errors.length === 0 ? 0 : Math.max(...errors),
    meanAbsoluteNormalizedScoreError:
      errors.length === 0
        ? 0
        : errors.reduce((sum, value) => sum + value, 0) / errors.length,
    p99AbsoluteNormalizedScoreError:
      errors.length === 0 ? 0 : percentile(errors, 0.99),
    nonFiniteScoreCount:
      metrics.reduce((sum, value) => sum + value.nonFiniteScoreCount, 0),
    duplicateResultCount:
      metrics.reduce((sum, value) => sum + value.duplicateResultCount, 0),
    missingResultCount:
      metrics.reduce((sum, value) => sum + value.missingResultCount, 0)
  });
}

function validateRankingAggregate(value, expected, label) {
  exactKeys(value, [
    "minimumRecallAt1", "minimumRecallAt10", "minimumRecallAt100",
    "minimumMrrAt100", "minimumNdcgAt100",
    "maximumRankInversionRateAt100", "totalRankInversionsAt100",
    "maximumAbsoluteNormalizedScoreError", "meanAbsoluteNormalizedScoreError",
    "p99AbsoluteNormalizedScoreError", "nonFiniteScoreCount",
    "duplicateResultCount", "missingResultCount"
  ], label);
  for (const field of Object.keys(expected)) {
    if (Number.isInteger(expected[field])) {
      exactValue(value[field], expected[field], `${label}.${field}`);
    } else {
      approximateValue(value[field], expected[field], `${label}.${field}`);
    }
  }
}

function validateNaturalUtility(value, lane, queries, label) {
  if (lane.laneKind !== "natural") {
    exactValue(value, null, label);
    return;
  }
  exactKeys(value, [
    "macroLabelPrecisionAt10", "macroLabelMrrAt10", "macroLabelNdcgAt10",
    "perClassQueryCoverage"
  ], label);
  invariant(
    Array.isArray(value.perClassQueryCoverage) &&
      value.perClassQueryCoverage.length === 10 &&
      value.perClassQueryCoverage.every((count) => count === 20),
    `${label}.perClassQueryCoverage is invalid`
  );
  for (const [field, queryField] of [
    ["macroLabelPrecisionAt10", "labelPrecisionAt10"],
    ["macroLabelMrrAt10", "labelMrrAt10"],
    ["macroLabelNdcgAt10", "labelNdcgAt10"]
  ]) {
    const perClass = Array.from({ length: 10 }, (_, classId) => {
      const values = queries
        .filter((query) => query.classOrTopic === classId)
        .map((query) => query[queryField]);
      exactValue(values.length, 20, `${label}.${field} class coverage`);
      return values.reduce((sum, current) => sum + current, 0) / values.length;
    });
    const expected = perClass.reduce((sum, current) => sum + current, 0) / 10;
    approximateValue(value[field], expected, `${label}.${field}`);
  }
  const [minimumPrecision, minimumMrr, minimumNdcg] = lane.naturalThresholds;
  invariant(
    value.macroLabelPrecisionAt10 >= minimumPrecision &&
      value.macroLabelMrrAt10 >= minimumMrr &&
      value.macroLabelNdcgAt10 >= minimumNdcg,
    `${label} fails frozen natural utility thresholds`
  );
}

function validateControlledUtility(value, lane, queries, label) {
  if (lane.laneKind !== "controlled-memory") {
    exactValue(value, null, label);
    return;
  }
  exactKeys(value, [
    "expectedFirstHitRate", "forbiddenHitRateAt10", "deletedHitCount",
    "filterViolationCount"
  ], label);
  const expectedHits = queries.filter((query) => query.expectedFirstHit).length;
  const forbidden = queries.reduce(
    (sum, query) => sum + query.forbiddenHitCountAt10,
    0
  );
  const deleted = queries.reduce((sum, query) => sum + query.deletedHitCount, 0);
  const filter = queries.reduce((sum, query) => sum + query.filterViolationCount, 0);
  approximateValue(
    value.expectedFirstHitRate,
    expectedHits / queries.length,
    `${label}.expectedFirstHitRate`
  );
  approximateValue(
    value.forbiddenHitRateAt10,
    forbidden / (queries.length * 10),
    `${label}.forbiddenHitRateAt10`
  );
  exactValue(value.deletedHitCount, deleted, `${label}.deletedHitCount`);
  exactValue(value.filterViolationCount, filter, `${label}.filterViolationCount`);
  invariant(
    value.expectedFirstHitRate === 1 &&
      value.forbiddenHitRateAt10 === 0 &&
      value.deletedHitCount === 0 &&
      value.filterViolationCount === 0,
    `${label} fails frozen controlled utility thresholds`
  );
}

function validateLaneResult(value, lane, queries) {
  const label = `laneResults ${lane.laneId}`;
  exactKeys(value, [
    "laneId", "laneKind", "metric", "normalization", "originalDimension",
    "encodedDimension", "declaredRecordCount", "sourceActiveRecordCount",
    "candidateRecordCount", "queryCount", "topKValues",
    "candidateDynamicIndexBytes", "candidateFormulaBytes", "exactFullIndexBytes",
    "capacityMatchedExactRecordCount", "capacityMatchedExactIndexBytes",
    "effectiveBitsPerOriginalCoordinate", "persistentRatioToFullExact",
    "firstBuildSha256", "secondBuildSha256", "deterministicBuildBytesMatch",
    "deterministicSearchOutputsMatch", "reloadSearchOutputsMatch",
    "sameCorpus", "capacityMatchedExact", "naturalUtility", "controlledUtility"
  ], label);
  for (const field of [
    "laneId", "laneKind", "metric", "normalization", "originalDimension",
    "encodedDimension", "declaredRecordCount", "sourceActiveRecordCount",
    "candidateRecordCount", "queryCount", "candidateDynamicIndexBytes",
    "exactFullIndexBytes", "capacityMatchedExactRecordCount",
    "capacityMatchedExactIndexBytes"
  ]) {
    exactValue(value[field], lane[field], `${label}.${field}`);
  }
  invariant(
    Array.isArray(value.topKValues) &&
      value.topKValues.length === 3 &&
      value.topKValues.every((item, index) => item === [1, 10, 100][index]),
    `${label}.topKValues is invalid`
  );
  const candidateFormula =
    18 +
    lane.candidateRecordCount * lane.encodedDimension * 4 / 8 +
    12 * lane.candidateRecordCount +
    8 * lane.encodedDimension;
  exactValue(
    value.candidateFormulaBytes,
    candidateFormula,
    `${label}.candidateFormulaBytes`
  );
  exactValue(
    value.candidateDynamicIndexBytes,
    candidateFormula,
    `${label}.candidateDynamicIndexBytes formula`
  );
  const exactFormula =
    280 + lane.declaredRecordCount * (16 + 4 * lane.originalDimension);
  exactValue(value.exactFullIndexBytes, exactFormula, `${label}.exactFullIndexBytes formula`);
  const capacityFormula =
    280 + lane.capacityMatchedExactRecordCount * (16 + 4 * lane.originalDimension);
  exactValue(
    value.capacityMatchedExactIndexBytes,
    capacityFormula,
    `${label}.capacityMatchedExactIndexBytes formula`
  );
  invariant(
    capacityFormula <= value.candidateDynamicIndexBytes &&
      capacityFormula + 16 + 4 * lane.originalDimension >
        value.candidateDynamicIndexBytes,
    `${label} equal-byte exact subset is not maximal`
  );
  approximateValue(
    value.effectiveBitsPerOriginalCoordinate,
    8 * value.candidateDynamicIndexBytes /
      (lane.candidateRecordCount * lane.originalDimension),
    `${label}.effectiveBitsPerOriginalCoordinate`
  );
  approximateValue(
    value.persistentRatioToFullExact,
    value.candidateDynamicIndexBytes / value.exactFullIndexBytes,
    `${label}.persistentRatioToFullExact`
  );
  invariant(
    value.persistentRatioToFullExact <= 0.2,
    `${label} fails frozen persistent ratio threshold`
  );
  invariant(
    sha256Pattern.test(value.firstBuildSha256) &&
      value.firstBuildSha256 === value.secondBuildSha256,
    `${label} deterministic build hashes are invalid`
  );
  for (const field of [
    "deterministicBuildBytesMatch", "deterministicSearchOutputsMatch",
    "reloadSearchOutputsMatch"
  ]) {
    exactValue(value[field], true, `${label}.${field}`);
  }
  const candidateAggregate = aggregateRanking(
    queries,
    "candidate",
    "candidateAbsoluteNormalizedScoreErrors"
  );
  const capacityAggregate = aggregateRanking(
    queries,
    "capacityMatchedExact",
    "capacityMatchedExactAbsoluteNormalizedScoreErrors"
  );
  validateRankingAggregate(value.sameCorpus, candidateAggregate, `${label}.sameCorpus`);
  validateRankingAggregate(
    value.capacityMatchedExact,
    capacityAggregate,
    `${label}.capacityMatchedExact`
  );
  invariant(
    value.sameCorpus.minimumRecallAt1 >= 0.7 &&
      value.sameCorpus.minimumRecallAt10 >= 0.85 &&
      value.sameCorpus.minimumRecallAt100 >= 0.95 &&
      value.sameCorpus.minimumMrrAt100 >= 0.75 &&
      value.sameCorpus.minimumNdcgAt100 >= 0.85 &&
      value.sameCorpus.maximumRankInversionRateAt100 <= 0.1 &&
      value.sameCorpus.meanAbsoluteNormalizedScoreError <= 0.2 &&
      value.sameCorpus.p99AbsoluteNormalizedScoreError <= 0.75 &&
      value.sameCorpus.nonFiniteScoreCount === 0 &&
      value.sameCorpus.duplicateResultCount === 0 &&
      value.sameCorpus.missingResultCount === 0,
    `${label} fails frozen same-corpus thresholds`
  );
  for (const field of [
    "minimumRecallAt1", "minimumRecallAt10", "minimumRecallAt100",
    "minimumMrrAt100", "minimumNdcgAt100"
  ]) {
    invariant(
      value.sameCorpus[field] >= value.capacityMatchedExact[field],
      `${label} candidate loses equal-byte capacity control for ${field}`
    );
  }
  validateNaturalUtility(value.naturalUtility, lane, queries, `${label}.naturalUtility`);
  validateControlledUtility(
    value.controlledUtility,
    lane,
    queries,
    `${label}.controlledUtility`
  );
  return value;
}

function validateQualityOutput(stdout) {
  const value = typeof stdout === "string"
    ? parseSingleJson(stdout, maximumCommandOutputBytes, "quality stdout")
    : publicSafe(stdout, "quality output");
  exactKeys(value, [
    "schema", "experimentId", "methodId", "bitWidth", "qualityProcessOrdinal",
    "datasetName", "datasetRevision", "selectionAlgorithm", "selectionSha256",
    "topKValues", "laneResults", "perQueryMetrics"
  ], "quality output");
  exactValue(value.schema, qualitySchema, "quality schema");
  exactValue(value.experimentId, expectedExperimentId, "quality experimentId");
  exactValue(value.methodId, expectedMethodId, "quality methodId");
  exactValue(value.bitWidth, 4, "quality bitWidth");
  exactValue(value.qualityProcessOrdinal, 1, "quality process ordinal");
  exactValue(value.datasetName, "Fashion-MNIST", "quality datasetName");
  exactValue(value.datasetRevision, datasetRevision, "quality datasetRevision");
  exactValue(
    value.selectionAlgorithm,
    "sha256-seed-split-label-index-smallest-v1",
    "quality selectionAlgorithm"
  );
  exactValue(value.selectionSha256, parentSelectionSha256, "quality selectionSha256");
  invariant(
    Array.isArray(value.topKValues) &&
      value.topKValues.length === 3 &&
      value.topKValues.every((item, index) => item === [1, 10, 100][index]),
    "quality topKValues are invalid"
  );
  invariant(
    Array.isArray(value.laneResults) &&
      value.laneResults.length === expectedLanes.length,
    "quality laneResults are invalid"
  );
  invariant(
    Array.isArray(value.perQueryMetrics) &&
      value.perQueryMetrics.length ===
        expectedLanes.reduce((sum, lane) => sum + lane.queryCount, 0),
    "quality perQueryMetrics count is invalid"
  );
  let offset = 0;
  for (const [laneIndex, lane] of expectedLanes.entries()) {
    const queries = value.perQueryMetrics.slice(offset, offset + lane.queryCount);
    queries.forEach((query, ordinal) => validateQueryMetric(query, lane, ordinal));
    validateLaneResult(value.laneResults[laneIndex], lane, queries);
    offset += lane.queryCount;
  }
  return value;
}

function validateContractOutput(stdout) {
  const value = typeof stdout === "string"
    ? parseSingleJson(stdout, 16384, "contract stdout")
    : stdout;
  exactKeys(value, [
    "schema", "experimentId", "methodId", "bitWidth", "qualityProcessCount",
    "performanceLaneCount", "performanceMethodCount",
    "performanceRepetitionCount", "corruptionCaseCount", "crashScenarioCount",
    "processCrashExitCode", "preregistrationSha256", "turbovecCrateSha256",
    "networkRequired", "wasmClaim", "productImport"
  ], "contract output");
  const expected = {
    schema: contractSchema,
    experimentId: expectedExperimentId,
    methodId: expectedMethodId,
    bitWidth: 4,
    qualityProcessCount: 1,
    performanceLaneCount: 6,
    performanceMethodCount: 2,
    performanceRepetitionCount: 5,
    corruptionCaseCount: 7,
    crashScenarioCount: 4,
    processCrashExitCode,
    preregistrationSha256,
    turbovecCrateSha256: crateArtifactSha256,
    networkRequired: false,
    wasmClaim: false,
    productImport: false
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    exactValue(value[field], expectedValue, `contract output.${field}`);
  }
  return value;
}

function validatePerformanceOutput(stdout, lane, method) {
  const label = `performance ${lane.laneId}/${method}`;
  const value = typeof stdout === "string"
    ? parseSingleJson(stdout, maximumCommandOutputBytes, `${label} stdout`)
    : publicSafe(stdout, label);
  exactKeys(value, [
    "schema", "experimentId", "methodId", "laneId", "method",
    "originalDimension", "encodedDimension", "recordCount", "queryCount",
    "warmupFullQueryPasses", "measuredFullQueryPasses", "buildNanoseconds",
    "serializationNanoseconds", "loadNanoseconds", "explicitPrepareNanoseconds",
    "prepareCalledBeforeColdFirstQuery", "candidatePrepareIncludedInColdFirstQuery",
    "coldFirstQueryNanoseconds", "measuredQueryNanoseconds", "persistentBytes",
    "queryResultDigest", "memoryMonitorHandshake"
  ], label);
  exactValue(value.schema, performanceSchema, `${label}.schema`);
  exactValue(value.experimentId, expectedExperimentId, `${label}.experimentId`);
  exactValue(value.methodId, expectedMethodId, `${label}.methodId`);
  exactValue(value.laneId, lane.laneId, `${label}.laneId`);
  exactValue(value.method, method, `${label}.method`);
  exactValue(value.originalDimension, lane.originalDimension, `${label}.originalDimension`);
  exactValue(
    value.encodedDimension,
    method === "candidate" ? lane.encodedDimension : lane.originalDimension,
    `${label}.encodedDimension`
  );
  exactValue(
    value.recordCount,
    method === "candidate" ? lane.candidateRecordCount : lane.sourceActiveRecordCount,
    `${label}.recordCount`
  );
  exactValue(value.queryCount, lane.queryCount, `${label}.queryCount`);
  exactValue(value.warmupFullQueryPasses, 5, `${label}.warmupFullQueryPasses`);
  exactValue(value.measuredFullQueryPasses, 5, `${label}.measuredFullQueryPasses`);
  for (const field of [
    "buildNanoseconds", "serializationNanoseconds", "loadNanoseconds",
    "coldFirstQueryNanoseconds"
  ]) {
    safeInteger(value[field], `${label}.${field}`, 1);
  }
  exactValue(
    value.explicitPrepareNanoseconds,
    0,
    `${label}.explicitPrepareNanoseconds`
  );
  exactValue(
    value.prepareCalledBeforeColdFirstQuery,
    false,
    `${label}.prepareCalledBeforeColdFirstQuery`
  );
  exactValue(
    value.candidatePrepareIncludedInColdFirstQuery,
    method === "candidate",
    `${label}.candidatePrepareIncludedInColdFirstQuery`
  );
  invariant(
    Array.isArray(value.measuredQueryNanoseconds) &&
      value.measuredQueryNanoseconds.length === lane.queryCount * 5,
    `${label}.measuredQueryNanoseconds length is invalid`
  );
  value.measuredQueryNanoseconds.forEach((duration, index) =>
    safeInteger(duration, `${label}.measuredQueryNanoseconds[${index}]`, 1));
  const expectedPersistentBytes = method === "candidate"
    ? lane.candidateDynamicIndexBytes
    : 280 + lane.sourceActiveRecordCount * (16 + 4 * lane.originalDimension);
  exactValue(value.persistentBytes, expectedPersistentBytes, `${label}.persistentBytes`);
  invariant(sha256Pattern.test(value.queryResultDigest), `${label}.queryResultDigest`);
  exactValue(value.memoryMonitorHandshake, true, `${label}.memoryMonitorHandshake`);
  return value;
}

function validateMemoryMeasurement(value, label) {
  exactKeys(value, [
    "samplingIntervalMilliseconds", "peakWorkingSetBytes",
    "osReportedPeakWorkingSetBytes", "postPrepareWorkingSetBytes",
    "sampleCount", "monitorExitCode"
  ], label);
  exactValue(value.samplingIntervalMilliseconds, 5, `${label}.samplingIntervalMilliseconds`);
  for (const field of [
    "peakWorkingSetBytes", "osReportedPeakWorkingSetBytes",
    "postPrepareWorkingSetBytes"
  ]) {
    safeInteger(value[field], `${label}.${field}`, 1);
  }
  safeInteger(value.sampleCount, `${label}.sampleCount`, 2);
  exactValue(value.monitorExitCode, 0, `${label}.monitorExitCode`);
  invariant(
    value.osReportedPeakWorkingSetBytes >= value.peakWorkingSetBytes &&
      value.peakWorkingSetBytes >= value.postPrepareWorkingSetBytes,
    `${label} working-set ordering is invalid`
  );
  return value;
}

function validatePerformanceRecord(value, lane, repetition, method, processOrdinal) {
  const label = `performanceRecords ${lane.laneId}/${repetition}/${method}`;
  exactKeys(value, [
    "processOrdinal", "laneOrdinal", "repetition", "scheduledMethodOrdinal",
    "exitCode", "stdoutSha256", "stderrSha256", "monitorStdoutSha256",
    "monitorStderrSha256", "monitorResultSha256", "processRootDeleted",
    "process", "memory"
  ], label);
  exactValue(value.processOrdinal, processOrdinal, `${label}.processOrdinal`);
  exactValue(
    value.laneOrdinal,
    expectedLanes.indexOf(lane),
    `${label}.laneOrdinal`
  );
  exactValue(value.repetition, repetition, `${label}.repetition`);
  const candidateFirst =
    (expectedLanes.indexOf(lane) + repetition) % 2 === 0;
  const expectedMethodOrdinal = candidateFirst
    ? (method === "candidate" ? 0 : 1)
    : (method === "exact-full" ? 0 : 1);
  exactValue(
    value.scheduledMethodOrdinal,
    expectedMethodOrdinal,
    `${label}.scheduledMethodOrdinal`
  );
  validatePerformanceOutput(value.process, lane, method);
  validateMemoryMeasurement(value.memory, `${label}.memory`);
  const processBytes = Buffer.from(`${JSON.stringify(value.process)}\n`, "utf8");
  const memoryBytes = Buffer.from(`${JSON.stringify(value.memory)}\n`, "utf8");
  exactValue(value.exitCode, 0, `${label}.exitCode`);
  exactValue(value.stdoutSha256, sha256(processBytes), `${label}.stdoutSha256`);
  exactValue(value.stderrSha256, emptySha256, `${label}.stderrSha256`);
  exactValue(
    value.monitorStdoutSha256,
    emptySha256,
    `${label}.monitorStdoutSha256`
  );
  exactValue(
    value.monitorStderrSha256,
    emptySha256,
    `${label}.monitorStderrSha256`
  );
  exactValue(
    value.monitorResultSha256,
    sha256(memoryBytes),
    `${label}.monitorResultSha256`
  );
  exactValue(value.processRootDeleted, true, `${label}.processRootDeleted`);
  return value;
}

function summarizePerformance(records) {
  const summaries = [];
  for (const lane of expectedLanes) {
    const laneRecords = records.filter((record) => record.process.laneId === lane.laneId);
    invariant(laneRecords.length === 10, `performance record count for ${lane.laneId}`);
    const candidate = laneRecords.filter((record) => record.process.method === "candidate");
    const exact = laneRecords.filter((record) => record.process.method === "exact-full");
    invariant(candidate.length === 5 && exact.length === 5, `performance pair count ${lane.laneId}`);
    const candidateDurations = candidate.flatMap(
      (record) => record.process.measuredQueryNanoseconds
    );
    const exactDurations = exact.flatMap(
      (record) => record.process.measuredQueryNanoseconds
    );
    const candidateLatency = statistics(candidateDurations);
    const exactLatency = statistics(exactDurations);
    const medianLatencyRatio = candidateLatency.median / exactLatency.median;
    const p95LatencyRatio = candidateLatency.p95 / exactLatency.p95;
    const pairedPeakWorkingSetRatios = [];
    const pairedPostPrepareWorkingSetRatios = [];
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const candidateRecord = candidate.find((record) => record.repetition === repetition);
      const exactRecord = exact.find((record) => record.repetition === repetition);
      invariant(candidateRecord && exactRecord, `performance pair missing ${lane.laneId}`);
      const candidatePeak = Math.max(
        candidateRecord.memory.peakWorkingSetBytes,
        candidateRecord.memory.osReportedPeakWorkingSetBytes
      );
      const exactPeak = Math.max(
        exactRecord.memory.peakWorkingSetBytes,
        exactRecord.memory.osReportedPeakWorkingSetBytes
      );
      pairedPeakWorkingSetRatios.push(candidatePeak / exactPeak);
      pairedPostPrepareWorkingSetRatios.push(
        candidateRecord.memory.postPrepareWorkingSetBytes /
          exactRecord.memory.postPrepareWorkingSetBytes
      );
    }
    const maximumCandidateColdFirstQueryNanoseconds = Math.max(
      ...candidate.map((record) => record.process.coldFirstQueryNanoseconds)
    );
    const maximumCandidateBuildNanoseconds = Math.max(
      ...candidate.map((record) => record.process.buildNanoseconds)
    );
    const maximumCandidatePeakWorkingSetBytes = Math.max(
      ...candidate.map((record) => Math.max(
        record.memory.peakWorkingSetBytes,
        record.memory.osReportedPeakWorkingSetBytes
      ))
    );
    const maximumPeakWorkingSetRatioToExact = Math.max(...pairedPeakWorkingSetRatios);
    const maximumPostPrepareWorkingSetRatioToExact =
      Math.max(...pairedPostPrepareWorkingSetRatios);
    const persistentRatioToExact =
      candidate[0].process.persistentBytes / exact[0].process.persistentBytes;
    const candidateDigests = [...new Set(
      candidate.map((record) => record.process.queryResultDigest)
    )];
    const exactDigests = [...new Set(
      exact.map((record) => record.process.queryResultDigest)
    )];
    const thresholdsPassed =
      medianLatencyRatio <= 1.25 &&
      p95LatencyRatio <= 1.5 &&
      maximumCandidateColdFirstQueryNanoseconds <= 5_000_000_000 &&
      maximumCandidateBuildNanoseconds <= 120_000_000_000 &&
      maximumCandidatePeakWorkingSetBytes <= 536_870_912 &&
      maximumPeakWorkingSetRatioToExact <= 8 &&
      maximumPostPrepareWorkingSetRatioToExact <= 2 &&
      persistentRatioToExact <= 0.2 &&
      candidateDigests.length === 1 &&
      exactDigests.length === 1;
    summaries.push(Object.freeze({
      laneId: lane.laneId,
      candidateLatency,
      exactLatency,
      medianLatencyRatio,
      p95LatencyRatio,
      maximumCandidateColdFirstQueryNanoseconds,
      maximumCandidateBuildNanoseconds,
      maximumCandidatePeakWorkingSetBytes,
      maximumPeakWorkingSetRatioToExact,
      maximumPostPrepareWorkingSetRatioToExact,
      persistentRatioToExact,
      candidateQueryResultDigest: candidateDigests[0] ?? null,
      exactQueryResultDigest: exactDigests[0] ?? null,
      thresholdsPassed
    }));
  }
  return summaries;
}

function validatePerformanceSummary(value, expected, lane) {
  const label = `performanceSummaries ${lane.laneId}`;
  exactKeys(value, [
    "laneId", "candidateLatency", "exactLatency", "medianLatencyRatio",
    "p95LatencyRatio", "maximumCandidateColdFirstQueryNanoseconds",
    "maximumCandidateBuildNanoseconds", "maximumCandidatePeakWorkingSetBytes",
    "maximumPeakWorkingSetRatioToExact",
    "maximumPostPrepareWorkingSetRatioToExact", "persistentRatioToExact",
    "candidateQueryResultDigest", "exactQueryResultDigest", "thresholdsPassed"
  ], label);
  exactValue(value.laneId, lane.laneId, `${label}.laneId`);
  for (const latencyField of ["candidateLatency", "exactLatency"]) {
    exactKeys(value[latencyField], [
      "minimum", "median", "p95", "p99", "maximum"
    ], `${label}.${latencyField}`);
    for (const field of ["minimum", "median", "p95", "p99", "maximum"]) {
      approximateValue(
        value[latencyField][field],
        expected[latencyField][field],
        `${label}.${latencyField}.${field}`
      );
    }
  }
  for (const field of [
    "medianLatencyRatio", "p95LatencyRatio",
    "maximumCandidateColdFirstQueryNanoseconds",
    "maximumCandidateBuildNanoseconds", "maximumCandidatePeakWorkingSetBytes",
    "maximumPeakWorkingSetRatioToExact",
    "maximumPostPrepareWorkingSetRatioToExact", "persistentRatioToExact"
  ]) {
    approximateValue(value[field], expected[field], `${label}.${field}`);
  }
  for (const field of [
    "candidateQueryResultDigest", "exactQueryResultDigest", "thresholdsPassed"
  ]) {
    exactValue(value[field], expected[field], `${label}.${field}`);
  }
  exactValue(value.thresholdsPassed, true, `${label}.thresholdsPassed`);
}

function validateCorruptionOutput(stdout, caseId) {
  const label = `corruption ${caseId}`;
  const value = typeof stdout === "string"
    ? parseSingleJson(stdout, 16384, `${label} stdout`)
    : stdout;
  exactKeys(value, [
    "schema", "experimentId", "caseId", "rejected",
    "rejectedBeforeUpstreamLoad", "upstreamLoadAttemptCount",
    "boundedErrorCode", "panicObserved"
  ], label);
  exactValue(value.schema, corruptionSchema, `${label}.schema`);
  exactValue(value.experimentId, expectedExperimentId, `${label}.experimentId`);
  exactValue(value.caseId, caseId, `${label}.caseId`);
  exactValue(value.rejected, true, `${label}.rejected`);
  exactValue(
    value.rejectedBeforeUpstreamLoad,
    true,
    `${label}.rejectedBeforeUpstreamLoad`
  );
  exactValue(value.upstreamLoadAttemptCount, 0, `${label}.upstreamLoadAttemptCount`);
  invariant(
    typeof value.boundedErrorCode === "string" &&
      /^[a-z0-9-]{1,96}$/u.test(value.boundedErrorCode),
    `${label}.boundedErrorCode`
  );
  exactValue(value.panicObserved, false, `${label}.panicObserved`);
  return value;
}

function validateRecoveryOutput(stdout, scenario) {
  const label = `recovery ${scenario.scenarioId}`;
  const value = typeof stdout === "string"
    ? parseSingleJson(stdout, 32768, `${label} stdout`)
    : stdout;
  exactKeys(value, [
    "schema", "experimentId", "scenarioId", "processCrashExitCode",
    "expectedActiveGenerationBeforeRetry", "observedActiveGenerationBeforeRetry",
    "deletionCommittedBeforeRetry", "finalActiveGeneration",
    "retryWroteGenerationTwo", "retryIdempotent",
    "finalTargetIdentifierMatches", "finalTargetVectorFingerprintMatches",
    "activeIndexContainsDeletedTarget", "deletedTargetSearchMatches",
    "allCrashScenariosMustRecover", "powerLossSimulated",
    "filesystemForensicErasureTested", "removedManagedFileCount",
    "directoryFlushAttempted", "directoryFlushSucceeded",
    "finalSnapshotSha256", "finalCommitSha256"
  ], label);
  const expected = {
    schema: recoverySchema,
    experimentId: expectedExperimentId,
    scenarioId: scenario.scenarioId,
    processCrashExitCode,
    expectedActiveGenerationBeforeRetry:
      scenario.expectedActiveGenerationBeforeRetry,
    observedActiveGenerationBeforeRetry:
      scenario.expectedActiveGenerationBeforeRetry,
    deletionCommittedBeforeRetry: scenario.deletionCommittedBeforeRetry,
    finalActiveGeneration: 2,
    retryWroteGenerationTwo: scenario.retryWroteGenerationTwo,
    retryIdempotent: true,
    finalTargetIdentifierMatches: 0,
    finalTargetVectorFingerprintMatches: 0,
    activeIndexContainsDeletedTarget: false,
    deletedTargetSearchMatches: 0,
    allCrashScenariosMustRecover: true,
    powerLossSimulated: false,
    filesystemForensicErasureTested: false,
    directoryFlushAttempted: true
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    exactValue(value[field], expectedValue, `${label}.${field}`);
  }
  safeInteger(
    value.removedManagedFileCount,
    `${label}.removedManagedFileCount`,
    2,
    32
  );
  invariant(
    typeof value.directoryFlushSucceeded === "boolean",
    `${label}.directoryFlushSucceeded`
  );
  invariant(
    sha256Pattern.test(value.finalSnapshotSha256) &&
      sha256Pattern.test(value.finalCommitSha256),
    `${label} final hashes are invalid`
  );
  return value;
}

function git(argumentsList, label) {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: repositoryRoot,
    env: offlineEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024
  });
  invariant(result.error === undefined, `${label} spawn failed`);
  invariant(result.status === 0, `${label} failed`);
  invariant(result.stderr === "", `${label} wrote stderr`);
  return result.stdout.trim();
}

function assertInputsCommitted() {
  for (const relativePath of inputPaths) {
    resolveRepositoryFile(relativePath);
    git(["ls-files", "--error-unmatch", "--", relativePath], `tracked input ${relativePath}`);
  }
  const status = git(["status", "--porcelain=v1", "--", ...inputPaths], "input status");
  invariant(status === "", "observation inputs are not clean and committed");
  const preregistrationCommit = git(
    ["log", "-1", "--format=%H", "--", preregistrationRelativePath],
    "preregistration commit"
  );
  const implementationCommit = git(
    [
      "log",
      "-1",
      "--format=%H",
      "--",
      comparisonManifestRelativePath,
      comparisonLockRelativePath,
      comparisonSourceRelativePath,
      runnerRelativePath,
      verifierRelativePath,
      runnerTestRelativePath,
      verifierTestRelativePath
    ],
    "implementation commit"
  );
  invariant(
    sourceRevisionPattern.test(preregistrationCommit) &&
      sourceRevisionPattern.test(implementationCommit) &&
      preregistrationCommit !== implementationCommit,
    "preregistration and implementation were not committed separately"
  );
  const ancestry = childProcess.spawnSync(
    "git",
    ["merge-base", "--is-ancestor", preregistrationCommit, implementationCommit],
    {
      cwd: repositoryRoot,
      env: offlineEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000
    }
  );
  invariant(
    ancestry.error === undefined && ancestry.status === 0,
    "implementation does not descend from preregistration"
  );
  return Object.freeze({ preregistrationCommit, implementationCommit });
}

function sourceRevision() {
  const revision = git(["rev-parse", "HEAD"], "source revision");
  invariant(sourceRevisionPattern.test(revision), "source revision is invalid");
  return revision;
}

function executablePath(name) {
  invariant(
    /^[A-Za-z0-9_.-]+$/u.test(name),
    "executable name is invalid"
  );
  const where = childProcess.spawnSync("where.exe", [name], {
    env: offlineEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
  invariant(where.error === undefined && where.status === 0, `${name} executable missing`);
  invariant(where.stderr === "", `${name} executable lookup wrote stderr`);
  const first = where.stdout.split(/\r?\n/u).find((line) => line.trim().length > 0);
  invariant(first, `${name} executable resolution failed`);
  const launcher = path.resolve(first.trim());
  exactValue(
    path.basename(launcher).toLowerCase(),
    name.toLowerCase(),
    `${name} launcher basename`
  );
  const launcherStat = fs.lstatSync(launcher);
  if (launcherStat.isSymbolicLink()) {
    const target = fs.realpathSync.native(launcher);
    boundedFile(target, 512 * 1024 * 1024, `${name} executable target`);
  } else {
    invariant(launcherStat.isFile(), `${name} executable is not a regular file`);
    invariant(
      launcherStat.size > 0 && launcherStat.size <= 512 * 1024 * 1024,
      `${name} executable size is invalid`
    );
  }
  return launcher;
}

function commandVersion(executable, argumentsList, label) {
  const result = childProcess.spawnSync(executable, argumentsList, {
    cwd: repositoryRoot,
    env: offlineEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  invariant(result.error === undefined && result.status === 0, `${label} version failed`);
  invariant(result.stderr === "", `${label} version wrote stderr`);
  const version = result.stdout.trim().replaceAll("\r", " ").replaceAll("\n", " | ");
  invariant(safeVersionPattern.test(version), `${label} version is unsafe`);
  return version;
}

function toolIdentity(name, versionArguments) {
  const resolved = executablePath(name);
  const stat = fs.statSync(resolved);
  return Object.freeze({
    name,
    version: commandVersion(resolved, versionArguments, name),
    binaryBytes: stat.size,
    binarySha256: sha256File(resolved)
  });
}

function validateExternalDatasetRoot() {
  const configured = process.env.TINYRUSTLM_FASHION_MNIST_ROOT;
  invariant(configured, "TINYRUSTLM_FASHION_MNIST_ROOT is required");
  const root = fs.realpathSync.native(configured);
  const gitDirectory = path.join(root, ".git");
  invariant(fs.existsSync(gitDirectory), "external dataset root is not a Git checkout");
  const run = (argumentsList, label) => {
    const result = childProcess.spawnSync("git", argumentsList, {
      cwd: root,
      env: offlineEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024
    });
    invariant(result.error === undefined && result.status === 0, `${label} failed`);
    invariant(result.stderr === "", `${label} wrote stderr`);
    return result.stdout.trim();
  };
  exactValue(run(["rev-parse", "HEAD"], "dataset revision"), datasetRevision, "dataset revision");
  exactValue(run(["status", "--porcelain=v1"], "dataset status"), "", "dataset checkout status");
  const tree = run(["rev-parse", "HEAD^{tree}"], "dataset tree");
  exactValue(tree, datasetTree, "dataset tree identity");
  const licensePath = path.join(root, "LICENSE");
  const readmePath = path.join(root, "README.md");
  const licenseStat = boundedFile(licensePath, maximumInputBytes, "dataset license");
  const readmeStat = boundedFile(readmePath, maximumInputBytes, "dataset readme");
  exactValue(licenseStat.size, 1116, "dataset license bytes");
  exactValue(readmeStat.size, 22994, "dataset readme bytes");
  exactValue(sha256File(licensePath), datasetLicenseSha256, "dataset license sha256");
  exactValue(sha256File(readmePath), datasetReadmeSha256, "dataset readme sha256");
  const files = datasetFiles.map((file) => {
    const absolute = path.resolve(root, file.upstreamPath);
    invariant(
      absolute.startsWith(`${root}${path.sep}`),
      "dataset file escapes external checkout"
    );
    const stat = boundedFile(absolute, maximumDatasetFileBytes, file.upstreamPath);
    exactValue(stat.size, file.compressedBytes, `${file.upstreamPath} bytes`);
    exactValue(sha256File(absolute), file.compressedSha256, `${file.upstreamPath} sha256`);
    return Object.freeze({ ...file, absolute });
  });
  return Object.freeze({
    root,
    publicIdentity: Object.freeze({
      sourceRepository: "https://github.com/zalandoresearch/fashion-mnist.git",
      revision: datasetRevision,
      tree,
      licenseExpression: "MIT",
      licenseBytes: licenseStat.size,
      licenseSha256: datasetLicenseSha256,
      readmeBytes: readmeStat.size,
      readmeSha256: datasetReadmeSha256,
      files: files.map(({ absolute: _absolute, rawName: _rawName, ...file }) => file),
      checkoutClean: true,
      locatorPersisted: false,
      bytesPersisted: false
    }),
    files
  });
}

function validateCrateArchive() {
  const configured = process.env.TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE;
  invariant(configured, "TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE is required");
  const archive = fs.realpathSync.native(configured);
  const stat = boundedFile(archive, 4 * 1024 * 1024, "TurboVec crate archive");
  exactValue(stat.size, crateArtifactBytes, "TurboVec crate archive bytes");
  exactValue(sha256File(archive), crateArtifactSha256, "TurboVec crate archive sha256");
  return Object.freeze({
    archive,
    publicIdentity: Object.freeze({
      name: "turbovec",
      version: "0.9.0",
      artifactBytes: stat.size,
      artifactSha256: crateArtifactSha256,
      vcsRevision: crateVcsRevision,
      locatorPersisted: false,
      bytesPersisted: false
    })
  });
}

function createOwnedRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), outerRootPrefix));
  fs.writeFileSync(path.join(root, outerRootMarker), "owned-v1\n", {
    encoding: "utf8",
    flag: "wx"
  });
  syncDirectory(root);
  return fs.realpathSync.native(root);
}

function validateOwnedRoot(root) {
  const resolved = fs.realpathSync.native(root);
  invariant(
    path.dirname(resolved) === fs.realpathSync.native(os.tmpdir()) &&
      path.basename(resolved).startsWith(outerRootPrefix),
    "owned root identity is invalid"
  );
  exactValue(
    fs.readFileSync(path.join(resolved, outerRootMarker), "utf8"),
    "owned-v1\n",
    "owned root marker"
  );
  return resolved;
}

function createProcessRoot(outerRoot, label) {
  invariant(/^[a-z0-9-]{1,96}$/u.test(label), "process root label is invalid");
  const root = path.join(outerRoot, `process-${label}`);
  fs.mkdirSync(root, { recursive: false });
  fs.writeFileSync(path.join(root, processRootMarker), processRootMarkerBytes, {
    flag: "wx"
  });
  syncDirectory(root);
  return root;
}

function removeProcessRoot(outerRoot, processRoot) {
  const outer = validateOwnedRoot(outerRoot);
  const resolved = fs.realpathSync.native(processRoot);
  invariant(
    path.dirname(resolved) === outer &&
      path.basename(resolved).startsWith("process-"),
    "process root escapes owned root"
  );
  invariant(
    fs.readFileSync(path.join(resolved, processRootMarker)).equals(processRootMarkerBytes),
    "process root marker is invalid"
  );
  fs.rmSync(resolved, { recursive: true, force: false, maxRetries: 8, retryDelay: 50 });
  invariant(!fs.existsSync(resolved), "process root deletion failed");
}

function removeOwnedRoot(root) {
  const resolved = validateOwnedRoot(root);
  fs.rmSync(resolved, { recursive: true, force: false, maxRetries: 8, retryDelay: 50 });
  invariant(!fs.existsSync(resolved), "owned root deletion failed");
}

async function materializeDataset(dataset, outerRoot) {
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
    const stat = boundedFile(temporary, maximumDatasetFileBytes, `${file.rawName} output`);
    exactValue(stat.size, file.decompressedBytes, `${file.rawName} decompressed bytes`);
    exactValue(
      sha256File(temporary),
      file.decompressedSha256,
      `${file.rawName} decompressed sha256`
    );
    fs.renameSync(temporary, finalPath);
    exactValue(
      sha256File(finalPath),
      file.decompressedSha256,
      `${file.rawName} finalized sha256`
    );
    validateIdxHeader(finalPath, file);
  }
  syncDirectory(destination);
  return destination;
}

function validateIdxHeader(filePath, expected) {
  const descriptor = fs.openSync(filePath, "r");
  const header = Buffer.alloc(16);
  try {
    const read = fs.readSync(descriptor, header, 0, header.length, 0);
    invariant(read >= 8, "IDX header is truncated");
  } finally {
    fs.closeSync(descriptor);
  }
  exactValue(header.readUInt32BE(0), expected.idxMagic, "IDX magic");
  exactValue(header.readUInt32BE(4), expected.itemCount, "IDX item count");
  if (expected.rows !== null) {
    exactValue(header.readUInt32BE(8), expected.rows, "IDX rows");
    exactValue(header.readUInt32BE(12), expected.columns, "IDX columns");
  }
}

function offlineEnvironment(extra = {}) {
  const inherited = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (childEnvironmentAllowlist.has(name.toUpperCase())) {
      inherited[name] = value;
    }
  }
  invariant(
    Object.keys(inherited).some((name) => name.toUpperCase() === "SYSTEMROOT") &&
      Object.keys(inherited).some((name) => name.toUpperCase() === "PATH") &&
      Object.keys(inherited).some((name) => name.toUpperCase() === "TEMP"),
    "sanitized child environment lacks required Windows tool variables"
  );
  for (const [name, value] of Object.entries(extra)) {
    invariant(
      /^[A-Z][A-Z0-9_]{0,95}$/u.test(name) &&
        typeof value === "string",
      "child environment override is invalid"
    );
  }
  return {
    ...inherited,
    CARGO_NET_OFFLINE: "true",
    HTTP_PROXY: "http://127.0.0.1:9",
    HTTPS_PROXY: "http://127.0.0.1:9",
    ALL_PROXY: "http://127.0.0.1:9",
    NO_PROXY: "",
    ...extra
  };
}

function assertCurrentPlatform() {
  invariant(
    process.platform === "win32" && process.arch === "x64",
    "registered observation requires native win-x64"
  );
  return Object.freeze({
    runtimeIdentifier: "win-x64",
    operatingSystem: "windows",
    architecture: "x64",
    rustTarget: "x86_64-pc-windows-msvc"
  });
}

function writeMemoryMonitorScript(outerRoot) {
  validateOwnedRoot(outerRoot);
  const scriptPath = path.join(outerRoot, "memory-monitor.ps1");
  const bytes = Buffer.from(memoryMonitorScript, "utf8");
  fs.writeFileSync(scriptPath, bytes, { flag: "wx" });
  const descriptor = fs.openSync(scriptPath, "r+");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  syncDirectory(outerRoot);
  return Object.freeze({
    scriptPath,
    publicIdentity: Object.freeze({
      bytes: bytes.length,
      sha256: sha256(bytes),
      samplingIntervalMilliseconds: 5
    })
  });
}

function buildComparator(cargoPath, outerRoot) {
  validateOwnedRoot(outerRoot);
  const targetRoot = path.join(outerRoot, "cargo-target");
  const publicArguments = Object.freeze([
    "build",
    "--manifest-path",
    comparisonManifestRelativePath,
    "--release",
    "--locked",
    "--offline",
    "--quiet",
    "--message-format=json"
  ]);
  const result = childProcess.spawnSync(cargoPath, publicArguments, {
    cwd: repositoryRoot,
    env: offlineEnvironment({ CARGO_TARGET_DIR: targetRoot }),
    encoding: "utf8",
    windowsHide: true,
    timeout: perProcessTimeoutMilliseconds,
    maxBuffer: maximumCommandOutputBytes
  });
  invariant(result.error === undefined, "offline Cargo build spawn failed");
  exactValue(result.status, 0, "offline Cargo build exit code");
  exactValue(result.signal, null, "offline Cargo build signal");
  exactValue(result.stderr, "", "offline Cargo build stderr");
  const messages = result.stdout
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`offline Cargo build message ${index} is not JSON`);
      }
    });
  const warnings = messages.filter(
    (message) =>
      message.reason === "compiler-message" &&
      message.message?.level === "warning"
  );
  const wrapperWarnings = warnings.filter((message) =>
    String(message.package_id || "").includes(
      "tinyrustlm-turbovec-reference-comparison"
    ));
  exactValue(wrapperWarnings.length, 0, "comparison wrapper warning count");
  const artifacts = messages.filter(
    (message) =>
      message.reason === "compiler-artifact" &&
      message.target?.name === "tinyrustlm-turbovec-reference-comparison" &&
      typeof message.executable === "string"
  );
  exactValue(artifacts.length, 1, "comparison executable artifact count");
  const binaryPath = fs.realpathSync.native(artifacts[0].executable);
  const resolvedTargetRoot = fs.realpathSync.native(targetRoot);
  invariant(
    binaryPath.startsWith(`${resolvedTargetRoot}${path.sep}`),
    "comparison executable escaped owned Cargo target"
  );
  const stat = boundedFile(binaryPath, 1024 * 1024 * 1024, "comparison executable");
  return Object.freeze({
    binaryPath,
    evidence: Object.freeze({
      executable: "cargo",
      arguments: publicArguments,
      exitCode: 0,
      stdoutSha256: sha256(Buffer.from(result.stdout, "utf8")),
      stderrSha256: emptySha256,
      compilerArtifactCount: artifacts.length,
      wrapperWarningCount: wrapperWarnings.length,
      upstreamWarningCount: warnings.length - wrapperWarnings.length,
      executableBytes: stat.size,
      executableSha256: sha256File(binaryPath),
      cargoLockSha256: sha256File(resolveRepositoryFile(comparisonLockRelativePath)),
      offline: true
    })
  });
}

function executeSync(
  executable,
  argumentsList,
  options,
  label,
  expectedExitCode = 0
) {
  const result = childProcess.spawnSync(executable, argumentsList, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    windowsHide: true,
    timeout: perProcessTimeoutMilliseconds,
    maxBuffer: maximumCommandOutputBytes
  });
  invariant(result.error === undefined, `${label} spawn failed`);
  exactValue(result.status, expectedExitCode, `${label} exit code`);
  exactValue(result.signal, null, `${label} signal`);
  return Object.freeze({
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    stdoutSha256: sha256(Buffer.from(result.stdout, "utf8")),
    stderrSha256: sha256(Buffer.from(result.stderr, "utf8"))
  });
}

function executeContract(binaryPath) {
  const execution = executeSync(
    binaryPath,
    ["--contract"],
    { cwd: repositoryRoot, env: offlineEnvironment() },
    "contract process"
  );
  exactValue(execution.stderr, "", "contract process stderr");
  return Object.freeze({
    execution: Object.freeze({
      exitCode: execution.exitCode,
      stdoutSha256: execution.stdoutSha256,
      stderrSha256: execution.stderrSha256
    }),
    contract: validateContractOutput(execution.stdout)
  });
}

function executeQuality(binaryPath, datasetRoot, outerRoot) {
  const processRoot = createProcessRoot(outerRoot, "quality-001");
  let deleted = false;
  let primaryFailure = null;
  try {
    const evaluated = outcomeOperation(
      "TURBOVEC_REFERENCE_QUALITY_OUTCOME_REJECTED",
      () => {
        const execution = executeSync(
          binaryPath,
          ["--quality"],
          {
            cwd: datasetRoot,
            env: offlineEnvironment({
              TINYRUSTLM_TURBOVEC_PROCESS_ROOT: processRoot
            })
          },
          "quality process"
        );
        exactValue(execution.stderr, "", "quality process stderr");
        return Object.freeze({
          execution,
          quality: validateQualityOutput(execution.stdout)
        });
      }
    );
    const managedFileCountBeforeDeletion = fs.readdirSync(processRoot).length;
    removeProcessRoot(outerRoot, processRoot);
    deleted = true;
    return Object.freeze({
      execution: Object.freeze({
        exitCode: evaluated.execution.exitCode,
        stdoutSha256: evaluated.execution.stdoutSha256,
        stderrSha256: evaluated.execution.stderrSha256,
        managedFileCountBeforeDeletion,
        processRootDeleted: true
      }),
      quality: evaluated.quality
    });
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    cleanupWithFailurePolicy(
      primaryFailure,
      "TURBOVEC_REFERENCE_QUALITY_CLEANUP_FAILED",
      [() => {
        if (!deleted && fs.existsSync(processRoot)) {
          removeProcessRoot(outerRoot, processRoot);
        }
      }]
    );
  }
}

function spawnCapture(executable, argumentsList, options, label) {
  const timeoutMilliseconds = safeInteger(
    options.timeoutMilliseconds ?? perProcessTimeoutMilliseconds,
    `${label} timeout`,
    1,
    perProcessTimeoutMilliseconds
  );
  const child = childProcess.spawn(executable, argumentsList, {
    cwd: options.cwd,
    env: options.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const promise = new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let pendingFailure = null;
    const terminate = (error) => {
      if (settled || pendingFailure !== null) return;
      pendingFailure = error;
      try {
        child.kill();
      } catch {
        // The close event remains authoritative for process termination.
      }
    };
    const timer = setTimeout(() => {
      terminate(new Error(`${label} timed out`));
    }, timeoutMilliseconds);
    child.once("error", () => {
      clearTimeout(timer);
      terminate(new Error(`${label} spawn failed`));
    });
    child.stdout.on("data", (chunk) => {
      if (pendingFailure !== null) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > maximumCommandOutputBytes) {
        terminate(new Error(`${label} stdout exceeded bound`));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (pendingFailure !== null) return;
      stderrBytes += chunk.length;
      if (stderrBytes > maximumCommandOutputBytes) {
        terminate(new Error(`${label} stderr exceeded bound`));
        return;
      }
      stderr.push(chunk);
    });
    child.once("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (pendingFailure !== null) {
        reject(pendingFailure);
        return;
      }
      resolve(Object.freeze({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      }));
    });
  });
  return Object.freeze({ child, promise });
}

function validatePerformanceExecutions(
  processExecution,
  monitorExecution,
  processOrdinal,
  monitorRequestObserved = false
) {
  const comparatorErrorCode =
    processExecution.exitCode === 1 &&
    processExecution.signal === null &&
    typeof processExecution.stderr === "string" &&
    /^[a-z0-9-]+\r?\n$/u.test(processExecution.stderr)
      ? processExecution.stderr.trim()
      : null;
  try {
    exactValue(monitorExecution.exitCode, 0, `memory monitor ${processOrdinal} exit code`);
    exactValue(monitorExecution.signal, null, `memory monitor ${processOrdinal} signal`);
    exactValue(monitorExecution.stdout, "", `memory monitor ${processOrdinal} stdout`);
    exactValue(monitorExecution.stderr, "", `memory monitor ${processOrdinal} stderr`);
  } catch (error) {
    if (
      monitorRequestObserved === true &&
      processExecution.exitCode !== null &&
      processExecution.exitCode !== 0 &&
      processExecution.signal === null &&
      !comparatorMonitorFailureCodes.has(comparatorErrorCode)
    ) {
      throw new ObservationFailure(
        "TURBOVEC_REFERENCE_PERFORMANCE_PROCESS_REJECTED",
        "comparison-outcome",
        false,
        error
      );
    }
    throw instrumentationFailure(
      "TURBOVEC_REFERENCE_MEMORY_MONITOR_REJECTED",
      error
    );
  }
  outcomeOperation("TURBOVEC_REFERENCE_PERFORMANCE_PROCESS_REJECTED", () => {
    exactValue(processExecution.exitCode, 0, `performance ${processOrdinal} exit code`);
    exactValue(processExecution.signal, null, `performance ${processOrdinal} signal`);
    exactValue(processExecution.stderr, "", `performance ${processOrdinal} stderr`);
  });
}

async function executePerformanceProcess(
  binaryPath,
  powershellPath,
  monitorScriptPath,
  datasetRoot,
  outerRoot,
  lane,
  laneOrdinal,
  repetition,
  method,
  scheduledMethodOrdinal,
  processOrdinal
) {
  const ordinalText = String(processOrdinal).padStart(3, "0");
  const rootLabel =
    `perf-${ordinalText}-${laneOrdinal}-${repetition}-${scheduledMethodOrdinal}`;
  const processRoot = createProcessRoot(outerRoot, rootLabel);
  const monitorOutputPath = path.join(outerRoot, `memory-${ordinalText}.json`);
  let rootDeleted = false;
  let primaryFailure = null;
  try {
    const comparison = spawnCapture(
      binaryPath,
      ["--performance", lane.laneId, method],
      {
        cwd: datasetRoot,
        env: offlineEnvironment({
          TINYRUSTLM_TURBOVEC_PROCESS_ROOT: processRoot,
          TINYRUSTLM_PERFORMANCE_MONITOR_REQUIRED: "1"
        })
      },
      `performance process ${processOrdinal}`
    );
    safeInteger(
      comparison.child.pid,
      `performance process ${processOrdinal} pid`,
      1
    );
    const monitor = spawnCapture(
      powershellPath,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        monitorScriptPath,
        "-TargetProcessId",
        String(comparison.child.pid),
        "-ProcessRoot",
        processRoot,
        "-OutputPath",
        monitorOutputPath
      ],
      { cwd: outerRoot, env: offlineEnvironment() },
      `memory monitor ${processOrdinal}`
    );
    const comparisonPromise = comparison.promise.catch((error) => {
      try {
        monitor.child.kill();
      } catch {
        // The monitor promise still waits for its close event.
      }
      throw error;
    });
    const monitorPromise = monitor.promise.then(
      (execution) => {
        if (execution.exitCode !== 0 || execution.signal !== null) {
          try {
            comparison.child.kill();
          } catch {
            // The comparison promise still waits for its close event.
          }
        }
        return execution;
      },
      (error) => {
        try {
          comparison.child.kill();
        } catch {
          // The comparison promise still waits for its close event.
        }
        throw error;
      }
    );
    const settled = await Promise.allSettled([comparisonPromise, monitorPromise]);
    if (settled[0].status === "rejected" || settled[1].status === "rejected") {
      if (settled[1].status === "rejected") {
        throw instrumentationFailure(
          "TURBOVEC_REFERENCE_MEMORY_MONITOR_FAILED",
          settled[1].reason
        );
      }
      throw new ObservationFailure(
        "TURBOVEC_REFERENCE_PERFORMANCE_PROCESS_FAILED",
        "comparison-outcome",
        false,
        settled[0].reason
      );
    }
    const processExecution = settled[0].value;
    const monitorExecution = settled[1].value;
    validatePerformanceExecutions(
      processExecution,
      monitorExecution,
      processOrdinal,
      fs.existsSync(path.join(processRoot, "memory-monitor-request"))
    );
    const monitorStat = boundedFile(
      monitorOutputPath,
      16384,
      `memory monitor ${processOrdinal} result`
    );
    const monitorBytes = fs.readFileSync(monitorOutputPath, {
      encoding: "utf8",
      flag: "r"
    });
    exactValue(
      Buffer.byteLength(monitorBytes, "utf8"),
      monitorStat.size,
      `memory monitor ${processOrdinal} byte count`
    );
    const processValue = outcomeOperation(
      "TURBOVEC_REFERENCE_PERFORMANCE_OUTPUT_REJECTED",
      () => validatePerformanceOutput(processExecution.stdout, lane, method)
    );
    let memory;
    try {
      memory = validateMemoryMeasurement(
        parseSingleJson(
          monitorBytes,
          16384,
          `memory monitor ${processOrdinal} result`
        ),
        `memory monitor ${processOrdinal}`
      );
    } catch (error) {
      throw instrumentationFailure(
        "TURBOVEC_REFERENCE_MEMORY_RESULT_REJECTED",
        error
      );
    }
    fs.rmSync(monitorOutputPath);
    syncDirectory(outerRoot);
    removeProcessRoot(outerRoot, processRoot);
    rootDeleted = true;
    const record = Object.freeze({
      processOrdinal,
      laneOrdinal,
      repetition,
      scheduledMethodOrdinal,
      exitCode: processExecution.exitCode,
      stdoutSha256: sha256(Buffer.from(processExecution.stdout, "utf8")),
      stderrSha256: sha256(Buffer.from(processExecution.stderr, "utf8")),
      monitorStdoutSha256: sha256(Buffer.from(monitorExecution.stdout, "utf8")),
      monitorStderrSha256: sha256(Buffer.from(monitorExecution.stderr, "utf8")),
      monitorResultSha256: sha256(Buffer.from(monitorBytes, "utf8")),
      processRootDeleted: true,
      process: processValue,
      memory
    });
    return outcomeOperation(
      "TURBOVEC_REFERENCE_PERFORMANCE_RECORD_REJECTED",
      () => validatePerformanceRecord(
        record,
        lane,
        repetition,
        method,
        processOrdinal
      )
    );
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    cleanupWithFailurePolicy(
      primaryFailure,
      "TURBOVEC_REFERENCE_PERFORMANCE_CLEANUP_FAILED",
      [
        () => {
          if (fs.existsSync(monitorOutputPath)) fs.rmSync(monitorOutputPath);
        },
        () => {
          if (!rootDeleted && fs.existsSync(processRoot)) {
            removeProcessRoot(outerRoot, processRoot);
          }
        }
      ]
    );
  }
}

async function executePerformanceSuite(
  binaryPath,
  powershellPath,
  monitorScriptPath,
  datasetRoot,
  outerRoot,
  startedMilliseconds
) {
  const records = [];
  let processOrdinal = 0;
  for (const [laneOrdinal, lane] of expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const [scheduledMethodOrdinal, method] of methods.entries()) {
        invariant(
          Date.now() - startedMilliseconds < overallTimeoutMilliseconds,
          "overall observation timeout exceeded"
        );
        processOrdinal += 1;
        records.push(await executePerformanceProcess(
          binaryPath,
          powershellPath,
          monitorScriptPath,
          datasetRoot,
          outerRoot,
          lane,
          laneOrdinal,
          repetition,
          method,
          scheduledMethodOrdinal,
          processOrdinal
        ));
      }
    }
  }
  exactValue(records.length, 60, "performance process count");
  const summaries = outcomeOperation(
    "TURBOVEC_REFERENCE_PERFORMANCE_THRESHOLDS_REJECTED",
    () => {
      const computed = summarizePerformance(records);
      computed.forEach((summary, index) =>
        validatePerformanceSummary(summary, summary, expectedLanes[index]));
      return computed;
    }
  );
  return Object.freeze({ records: Object.freeze(records), summaries });
}

function executeCorruptionSuite(binaryPath, outerRoot) {
  const records = [];
  for (const [caseOrdinal, caseId] of corruptionCases.entries()) {
    const processRoot = createProcessRoot(
      outerRoot,
      `corruption-${String(caseOrdinal + 1).padStart(2, "0")}`
    );
    let deleted = false;
    let primaryFailure = null;
    try {
      const evaluated = outcomeOperation(
        "TURBOVEC_REFERENCE_CORRUPTION_OUTCOME_REJECTED",
        () => {
          const execution = executeSync(
            binaryPath,
            ["--corruption", caseId],
            { cwd: processRoot, env: offlineEnvironment() },
            `corruption process ${caseId}`
          );
          exactValue(execution.stderr, "", `corruption process ${caseId} stderr`);
          return Object.freeze({
            execution,
            process: validateCorruptionOutput(execution.stdout, caseId)
          });
        }
      );
      const managedFileCountBeforeDeletion = fs.readdirSync(processRoot).length;
      removeProcessRoot(outerRoot, processRoot);
      deleted = true;
      records.push(Object.freeze({
        caseOrdinal,
        caseId,
        exitCode: evaluated.execution.exitCode,
        stdoutSha256: evaluated.execution.stdoutSha256,
        stderrSha256: evaluated.execution.stderrSha256,
        managedFileCountBeforeDeletion,
        processRootDeleted: true,
        process: evaluated.process
      }));
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      cleanupWithFailurePolicy(
        primaryFailure,
        "TURBOVEC_REFERENCE_CORRUPTION_CLEANUP_FAILED",
        [() => {
          if (!deleted && fs.existsSync(processRoot)) {
            removeProcessRoot(outerRoot, processRoot);
          }
        }]
      );
    }
  }
  return Object.freeze(records);
}

function executeCrashRecoverySuite(binaryPath, outerRoot) {
  const records = [];
  for (const [scenarioOrdinal, scenario] of crashScenarios.entries()) {
    const processRoot = createProcessRoot(
      outerRoot,
      `crash-${String(scenarioOrdinal + 1).padStart(2, "0")}`
    );
    let deleted = false;
    let primaryFailure = null;
    try {
      const evaluated = outcomeOperation(
        "TURBOVEC_REFERENCE_DELETION_RECOVERY_OUTCOME_REJECTED",
        () => {
          const crash = executeSync(
            binaryPath,
            ["--crash", scenario.scenarioId],
            { cwd: processRoot, env: offlineEnvironment() },
            `crash process ${scenario.scenarioId}`,
            processCrashExitCode
          );
          exactValue(crash.stdout, "", `crash process ${scenario.scenarioId} stdout`);
          exactValue(crash.stderr, "", `crash process ${scenario.scenarioId} stderr`);
          const recovery = executeSync(
            binaryPath,
            ["--recover", scenario.scenarioId],
            { cwd: processRoot, env: offlineEnvironment() },
            `recovery process ${scenario.scenarioId}`
          );
          exactValue(
            recovery.stderr,
            "",
            `recovery process ${scenario.scenarioId} stderr`
          );
          return Object.freeze({
            crash,
            recovery,
            recoveryValue: validateRecoveryOutput(recovery.stdout, scenario)
          });
        }
      );
      const managedFileCountBeforeDeletion = fs.readdirSync(processRoot).length;
      removeProcessRoot(outerRoot, processRoot);
      deleted = true;
      records.push(Object.freeze({
        scenarioOrdinal,
        scenarioId: scenario.scenarioId,
        crashExitCode: evaluated.crash.exitCode,
        crashStdoutSha256: evaluated.crash.stdoutSha256,
        crashStderrSha256: evaluated.crash.stderrSha256,
        recoveryExitCode: evaluated.recovery.exitCode,
        recoveryStdoutSha256: evaluated.recovery.stdoutSha256,
        recoveryStderrSha256: evaluated.recovery.stderrSha256,
        managedFileCountBeforeDeletion,
        processRootDeleted: true,
        recovery: evaluated.recoveryValue
      }));
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      cleanupWithFailurePolicy(
        primaryFailure,
        "TURBOVEC_REFERENCE_RECOVERY_CLEANUP_FAILED",
        [() => {
          if (!deleted && fs.existsSync(processRoot)) {
            removeProcessRoot(outerRoot, processRoot);
          }
        }]
      );
    }
  }
  return Object.freeze(records);
}

function finalizeIdentity(body, prefix, idField, hashField) {
  const contentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    [idField]: `${prefix}-${contentHash.slice(0, 16)}`,
    [hashField]: contentHash
  });
}

function pendingAttemptIdentity(value) {
  const body = { ...value };
  delete body.pendingAttemptId;
  delete body.pendingAttemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `turbovec-reference-pending-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizePendingAttempt(body) {
  return finalizeIdentity(
    body,
    "turbovec-reference-pending",
    "pendingAttemptId",
    "pendingAttemptContentHash"
  );
}

function validatePendingAttempt(value) {
  exactKeys(value, [
    "schema", "experimentId", "attemptOrdinal", "previousAttemptId",
    "startedAtUtc", "sourceRevision", "preregistrationSha256",
    "pendingAttemptId", "pendingAttemptContentHash"
  ], "pending attempt");
  exactValue(value.schema, pendingAttemptSchema, "pending attempt schema");
  exactValue(
    value.experimentId,
    expectedExperimentId,
    "pending attempt experimentId"
  );
  safeInteger(value.attemptOrdinal, "pending attempt ordinal", 1);
  invariant(
    value.previousAttemptId === null ||
      /^turbovec-reference-attempt-[a-f0-9]{16}$/u.test(
        value.previousAttemptId
      ),
    "pending attempt predecessor is invalid"
  );
  invariant(
    utcPattern.test(value.startedAtUtc) &&
      Number.isFinite(Date.parse(value.startedAtUtc)) &&
      sourceRevisionPattern.test(value.sourceRevision) &&
      value.preregistrationSha256 === preregistrationSha256,
    "pending attempt core identity is invalid"
  );
  const identity = pendingAttemptIdentity(value);
  exactValue(value.pendingAttemptId, identity.id, "pending attempt id");
  exactValue(
    value.pendingAttemptContentHash,
    identity.hash,
    "pending attempt content hash"
  );
  publicSafe(value, "pending attempt");
  return value;
}

function finalizeObservation(body) {
  return finalizeIdentity(
    body,
    "turbovec-reference-comparison",
    "observationId",
    "observationContentHash"
  );
}

function observationIdentity(value) {
  const body = { ...value };
  delete body.observationId;
  delete body.observationContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `turbovec-reference-comparison-${hash.slice(0, 16)}`,
    hash
  });
}

function validateExternalDatasetEvidence(value) {
  exactKeys(value, [
    "sourceRepository", "revision", "tree", "licenseExpression",
    "licenseBytes", "licenseSha256", "readmeBytes", "readmeSha256",
    "files", "checkoutClean", "locatorPersisted", "bytesPersisted"
  ], "observation external dataset");
  exactValue(
    value.sourceRepository,
    "https://github.com/zalandoresearch/fashion-mnist.git",
    "observation external dataset repository"
  );
  exactValue(value.revision, datasetRevision, "observation external dataset revision");
  exactValue(value.tree, datasetTree, "observation dataset tree");
  exactValue(value.licenseExpression, "MIT", "observation dataset license");
  exactValue(value.licenseBytes, 1116, "observation dataset license bytes");
  exactValue(value.readmeBytes, 22994, "observation dataset readme bytes");
  exactValue(
    value.licenseSha256,
    datasetLicenseSha256,
    "observation dataset license sha256"
  );
  exactValue(
    value.readmeSha256,
    datasetReadmeSha256,
    "observation dataset readme sha256"
  );
  exactValue(value.checkoutClean, true, "observation dataset checkoutClean");
  exactValue(value.locatorPersisted, false, "observation dataset locatorPersisted");
  exactValue(value.bytesPersisted, false, "observation dataset bytesPersisted");
  invariant(
    Array.isArray(value.files) && value.files.length === datasetFiles.length,
    "observation dataset file coverage is invalid"
  );
  value.files.forEach((file, index) => {
    const expected = datasetFiles[index];
    exactKeys(file, [
      "upstreamPath", "compressedBytes", "compressedSha256",
      "decompressedBytes", "decompressedSha256", "idxMagic",
      "itemCount", "rows", "columns"
    ], `observation dataset file ${index}`);
    exactStructure(file, {
      upstreamPath: expected.upstreamPath,
      compressedBytes: expected.compressedBytes,
      compressedSha256: expected.compressedSha256,
      decompressedBytes: expected.decompressedBytes,
      decompressedSha256: expected.decompressedSha256,
      idxMagic: expected.idxMagic,
      itemCount: expected.itemCount,
      rows: expected.rows,
      columns: expected.columns
    }, `observation dataset file ${index}`);
  });
}

function validateExternalCrateEvidence(value) {
  exactKeys(value, [
    "name", "version", "artifactBytes", "artifactSha256", "vcsRevision",
    "locatorPersisted", "bytesPersisted"
  ], "observation external crate");
  exactStructure(value, {
    name: "turbovec",
    version: "0.9.0",
    artifactBytes: crateArtifactBytes,
    artifactSha256: crateArtifactSha256,
    vcsRevision: crateVcsRevision,
    locatorPersisted: false,
    bytesPersisted: false
  }, "observation external crate");
}

function validateToolEvidence(value, label) {
  exactKeys(value, [
    "name", "version", "binaryBytes", "binarySha256"
  ], `observation tool ${label}`);
  invariant(
    /^[A-Za-z0-9_.-]{1,64}$/u.test(value.name) &&
      safeVersionPattern.test(value.version) &&
      safeInteger(value.binaryBytes, `observation tool ${label} bytes`, 1) > 0 &&
      sha256Pattern.test(value.binarySha256),
    `observation tool ${label} identity is invalid`
  );
}

function validateBuildEvidence(value) {
  exactKeys(value, [
    "executable", "arguments", "exitCode", "stdoutSha256", "stderrSha256",
    "compilerArtifactCount", "wrapperWarningCount", "upstreamWarningCount",
    "executableBytes", "executableSha256", "cargoLockSha256", "offline"
  ], "observation build");
  exactValue(value.executable, "cargo", "observation build executable");
  exactStructure(value.arguments, [
    "build",
    "--manifest-path",
    comparisonManifestRelativePath,
    "--release",
    "--locked",
    "--offline",
    "--quiet",
    "--message-format=json"
  ], "observation build arguments");
  exactValue(value.exitCode, 0, "observation build exitCode");
  invariant(
    sha256Pattern.test(value.stdoutSha256) &&
      value.stderrSha256 === emptySha256 &&
      value.compilerArtifactCount === 1 &&
      value.wrapperWarningCount === 0 &&
      Number.isSafeInteger(value.upstreamWarningCount) &&
      value.upstreamWarningCount >= 0 &&
      safeInteger(value.executableBytes, "observation executable bytes", 1) > 0 &&
      sha256Pattern.test(value.executableSha256) &&
      value.cargoLockSha256 === sha256File(
        resolveRepositoryFile(comparisonLockRelativePath)
      ) &&
      value.offline === true,
    "observation build identity is invalid"
  );
}

function validateSimpleExecution(value, payload, label, extraKeys = []) {
  exactKeys(value, [
    "exitCode", "stdoutSha256", "stderrSha256", ...extraKeys
  ], label);
  const payloadBytes = Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
  exactValue(value.exitCode, 0, `${label}.exitCode`);
  exactValue(value.stdoutSha256, sha256(payloadBytes), `${label}.stdoutSha256`);
  exactValue(value.stderrSha256, emptySha256, `${label}.stderrSha256`);
}

function validateCorruptionRecord(value, caseId, caseOrdinal) {
  const label = `observation corruption ${caseId}`;
  exactKeys(value, [
    "caseOrdinal", "caseId", "exitCode", "stdoutSha256", "stderrSha256",
    "managedFileCountBeforeDeletion", "processRootDeleted", "process"
  ], label);
  exactValue(value.caseOrdinal, caseOrdinal, `${label}.caseOrdinal`);
  exactValue(value.caseId, caseId, `${label}.caseId`);
  validateCorruptionOutput(value.process, caseId);
  const processBytes = Buffer.from(`${JSON.stringify(value.process)}\n`, "utf8");
  exactValue(value.exitCode, 0, `${label}.exitCode`);
  exactValue(value.stdoutSha256, sha256(processBytes), `${label}.stdoutSha256`);
  exactValue(value.stderrSha256, emptySha256, `${label}.stderrSha256`);
  exactValue(
    value.managedFileCountBeforeDeletion,
    3,
    `${label}.managedFileCountBeforeDeletion`
  );
  exactValue(value.processRootDeleted, true, `${label}.processRootDeleted`);
}

function validateCrashRecoveryRecord(value, scenario, scenarioOrdinal) {
  const label = `observation crash recovery ${scenario.scenarioId}`;
  exactKeys(value, [
    "scenarioOrdinal", "scenarioId", "crashExitCode", "crashStdoutSha256",
    "crashStderrSha256", "recoveryExitCode", "recoveryStdoutSha256",
    "recoveryStderrSha256", "managedFileCountBeforeDeletion",
    "processRootDeleted", "recovery"
  ], label);
  exactValue(value.scenarioOrdinal, scenarioOrdinal, `${label}.scenarioOrdinal`);
  exactValue(value.scenarioId, scenario.scenarioId, `${label}.scenarioId`);
  validateRecoveryOutput(value.recovery, scenario);
  const recoveryBytes = Buffer.from(`${JSON.stringify(value.recovery)}\n`, "utf8");
  exactValue(value.crashExitCode, processCrashExitCode, `${label}.crashExitCode`);
  exactValue(value.crashStdoutSha256, emptySha256, `${label}.crashStdoutSha256`);
  exactValue(value.crashStderrSha256, emptySha256, `${label}.crashStderrSha256`);
  exactValue(value.recoveryExitCode, 0, `${label}.recoveryExitCode`);
  exactValue(
    value.recoveryStdoutSha256,
    sha256(recoveryBytes),
    `${label}.recoveryStdoutSha256`
  );
  exactValue(
    value.recoveryStderrSha256,
    emptySha256,
    `${label}.recoveryStderrSha256`
  );
  exactValue(
    value.managedFileCountBeforeDeletion,
    3,
    `${label}.managedFileCountBeforeDeletion`
  );
  exactValue(value.processRootDeleted, true, `${label}.processRootDeleted`);
}

function validateObservation(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "attemptOrdinal",
    "previousAttemptId", "attemptStartedAtUtc", "pendingAttemptId",
    "pendingAttemptContentHash",
    "observedAtUtc", "sourceRevision",
    "preregistration", "implementationCommit", "parents", "externalDataset",
    "externalCrate", "inputs", "tools", "platform", "build",
    "contractExecution", "contract", "qualityExecution", "quality",
    "performanceRecords", "performanceSummaries", "corruptionRecords",
    "crashRecoveries", "thresholdDecision", "cleanup", "authority",
    "openGaps", "requiredNextGate", "observationId",
    "observationContentHash"
  ], "observation");
  exactValue(value.schema, observationSchema, "observation schema");
  exactValue(value.experimentId, expectedExperimentId, "observation experimentId");
  exactValue(value.status, "pass", "observation status");
  safeInteger(value.attemptOrdinal, "observation attempt ordinal", 1);
  invariant(
    (value.previousAttemptId === null ||
      /^turbovec-reference-attempt-[a-f0-9]{16}$/u.test(
        value.previousAttemptId
      )) &&
      utcPattern.test(value.attemptStartedAtUtc) &&
      Number.isFinite(Date.parse(value.attemptStartedAtUtc)) &&
      /^turbovec-reference-pending-[a-f0-9]{16}$/u.test(
        value.pendingAttemptId
      ) &&
      sha256Pattern.test(value.pendingAttemptContentHash) &&
      utcPattern.test(value.observedAtUtc) &&
      Number.isFinite(Date.parse(value.observedAtUtc)) &&
      Date.parse(value.observedAtUtc) >=
        Date.parse(value.attemptStartedAtUtc) &&
      sourceRevisionPattern.test(value.sourceRevision),
    "observation attempt, time, or source revision is invalid"
  );
  const pendingIdentity = pendingAttemptIdentity({
    schema: pendingAttemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: value.attemptOrdinal,
    previousAttemptId: value.previousAttemptId,
    startedAtUtc: value.attemptStartedAtUtc,
    sourceRevision: value.sourceRevision,
    preregistrationSha256
  });
  exactValue(
    value.pendingAttemptId,
    pendingIdentity.id,
    "observation pending attempt id"
  );
  exactValue(
    value.pendingAttemptContentHash,
    pendingIdentity.hash,
    "observation pending attempt content hash"
  );
  const identity = observationIdentity(value);
  exactValue(value.observationId, identity.id, "observation id");
  exactValue(
    value.observationContentHash,
    identity.hash,
    "observation content hash"
  );
  const manifestResult = validateManifestFile();
  const manifest = manifestResult.manifest;
  exactKeys(value.preregistration, [
    "path", "sha256", "commit"
  ], "observation preregistration");
  exactValue(
    value.preregistration.path,
    preregistrationRelativePath,
    "observation preregistration path"
  );
  exactValue(
    value.preregistration.sha256,
    preregistrationSha256,
    "observation preregistration sha256"
  );
  invariant(
    sourceRevisionPattern.test(value.preregistration.commit) &&
      sourceRevisionPattern.test(value.implementationCommit),
    "observation implementation commits are invalid"
  );
  invariant(
    Array.isArray(value.parents) &&
      value.parents.length === manifest.parents.length,
    "observation parents are incomplete"
  );
  value.parents.forEach((parent, index) =>
    exactStructure(parent, manifest.parents[index], `observation parent ${index}`));
  validateExternalDatasetEvidence(value.externalDataset);
  validateExternalCrateEvidence(value.externalCrate);
  invariant(
    Array.isArray(value.inputs) && value.inputs.length === inputPaths.length,
    "observation inputs are incomplete"
  );
  value.inputs.forEach((input, index) => {
    exactKeys(input, ["path", "bytes", "sha256"], `observation input ${index}`);
    exactStructure(input, hashInput(inputPaths[index]), `observation input ${index}`);
  });
  exactKeys(value.tools, [
    "node", "cargo", "rustc", "powershell"
  ], "observation tools");
  for (const [label, tool] of Object.entries(value.tools)) {
    validateToolEvidence(tool, label);
  }
  exactStructure(value.platform, {
    runtimeIdentifier: "win-x64",
    operatingSystem: "windows",
    architecture: "x64",
    rustTarget: "x86_64-pc-windows-msvc"
  }, "observation platform");
  validateBuildEvidence(value.build);
  validateContractOutput(value.contract);
  validateSimpleExecution(
    value.contractExecution,
    value.contract,
    "observation contract execution"
  );
  validateQualityOutput(value.quality);
  validateSimpleExecution(
    value.qualityExecution,
    value.quality,
    "observation quality execution",
    ["managedFileCountBeforeDeletion", "processRootDeleted"]
  );
  exactValue(
    value.qualityExecution.managedFileCountBeforeDeletion,
    13,
    "observation quality managed file count"
  );
  exactValue(
    value.qualityExecution.processRootDeleted,
    true,
    "observation quality process root deletion"
  );
  invariant(
    Array.isArray(value.performanceRecords) &&
      value.performanceRecords.length === 60,
    "observation performance record coverage is invalid"
  );
  let performanceIndex = 0;
  for (const [laneOrdinal, lane] of expectedLanes.entries()) {
    for (let repetition = 0; repetition < 5; repetition += 1) {
      const methods = (laneOrdinal + repetition) % 2 === 0
        ? ["candidate", "exact-full"]
        : ["exact-full", "candidate"];
      for (const method of methods) {
        validatePerformanceRecord(
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
  const recomputedSummaries = summarizePerformance(value.performanceRecords);
  invariant(
    Array.isArray(value.performanceSummaries) &&
      value.performanceSummaries.length === expectedLanes.length,
    "observation performance summaries are incomplete"
  );
  value.performanceSummaries.forEach((summary, index) =>
    validatePerformanceSummary(
      summary,
      recomputedSummaries[index],
      expectedLanes[index]
    ));
  invariant(
    Array.isArray(value.corruptionRecords) &&
      value.corruptionRecords.length === corruptionCases.length,
    "observation corruption coverage is invalid"
  );
  value.corruptionRecords.forEach((record, index) =>
    validateCorruptionRecord(record, corruptionCases[index], index));
  invariant(
    Array.isArray(value.crashRecoveries) &&
      value.crashRecoveries.length === crashScenarios.length,
    "observation crash recovery coverage is invalid"
  );
  value.crashRecoveries.forEach((record, index) =>
    validateCrashRecoveryRecord(record, crashScenarios[index], index));
  exactStructure(value.thresholdDecision, {
    status: "pass",
    contractMatched: true,
    allSixQualityLanesComplete: true,
    allPerQueryMetricsRetained: true,
    allFrozenQualityThresholdsPassed: true,
    allSixtyPerformanceProcessesComplete: true,
    allFrozenPerformanceThresholdsPassed: true,
    allSevenCorruptionsRejectedBeforeUpstreamLoad: true,
    allFourCrashScenariosRecovered: true,
    committedDeletionRemainedDeletedAfterRestart: true,
    allSeventyTwoProcessRootsDeleted: true,
    resultDrivenThresholdChanges: false
  }, "observation threshold decision");
  exactKeys(value.cleanup, [
    "outerMarkerSha256", "memoryMonitorScriptSha256", "processRootCount",
    "processRootsDeleted", "outerRootDeleted"
  ], "observation cleanup");
  exactValue(
    value.cleanup.outerMarkerSha256,
    sha256(Buffer.from("owned-v1\n", "utf8")),
    "observation cleanup marker"
  );
  invariant(
    value.cleanup.memoryMonitorScriptSha256 ===
      sha256(Buffer.from(memoryMonitorScript, "utf8")) &&
      value.cleanup.processRootCount === 72 &&
      value.cleanup.processRootsDeleted === 72 &&
      value.cleanup.outerRootDeleted === true,
    "observation cleanup is invalid"
  );
  exactStructure(value.authority, observationAuthority, "observation authority");
  exactStructure(value.openGaps, openGaps, "observation open gaps");
  exactValue(
    value.requiredNextGate,
    manifest.requiredNextGate,
    "observation required next gate"
  );
  publicSafe(value, "observation");
  return value;
}

function validateObservationFile(filePath = observationPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 0 && stat.size <= maximumEvidenceBytes,
    "observation file is not a bounded regular file"
  );
  const bytes = fs.readFileSync(filePath);
  const observation = validateObservation(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(observation)),
    "observation bytes are not canonical pretty JSON"
  );
  return Object.freeze({
    observation,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

function attemptIdentity(value) {
  const body = { ...value };
  delete body.attemptId;
  delete body.attemptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `turbovec-reference-attempt-${hash.slice(0, 16)}`,
    hash
  });
}

function finalizeAttempt(body) {
  return finalizeIdentity(
    body,
    "turbovec-reference-attempt",
    "attemptId",
    "attemptContentHash"
  );
}

function validateAttempt(value) {
  exactKeys(value, [
    "schema", "experimentId", "attemptOrdinal", "previousAttemptId",
    "status", "startedAtUtc", "completedAtUtc", "sourceRevision",
    "preregistrationSha256", "observationId", "observationContentHash",
    "failure", "attemptId", "attemptContentHash"
  ], "attempt");
  exactValue(value.schema, attemptSchema, "attempt schema");
  exactValue(value.experimentId, expectedExperimentId, "attempt experimentId");
  safeInteger(value.attemptOrdinal, "attempt ordinal", 1);
  invariant(
    value.previousAttemptId === null ||
      /^turbovec-reference-attempt-[a-f0-9]{16}$/u.test(value.previousAttemptId),
    "attempt previous identity is invalid"
  );
  invariant(
    ["pass", "fail"].includes(value.status) &&
      utcPattern.test(value.startedAtUtc) &&
      utcPattern.test(value.completedAtUtc) &&
      Number.isFinite(Date.parse(value.startedAtUtc)) &&
      Number.isFinite(Date.parse(value.completedAtUtc)) &&
      Date.parse(value.completedAtUtc) >= Date.parse(value.startedAtUtc) &&
      sourceRevisionPattern.test(value.sourceRevision) &&
      value.preregistrationSha256 === preregistrationSha256,
    "attempt core identity is invalid"
  );
  const identity = attemptIdentity(value);
  exactValue(value.attemptId, identity.id, "attempt id");
  exactValue(value.attemptContentHash, identity.hash, "attempt content hash");
  if (value.status === "pass") {
    invariant(
      /^turbovec-reference-comparison-[a-f0-9]{16}$/u.test(
        value.observationId
      ) &&
        sha256Pattern.test(value.observationContentHash) &&
        value.failure === null,
      "passing attempt is incomplete"
    );
  } else {
    exactValue(value.observationId, null, "failed attempt observation id");
    exactValue(
      value.observationContentHash,
      null,
      "failed attempt observation hash"
    );
    exactKeys(value.failure, [
      "code", "classification", "retryAllowed", "errorName",
      "messageSha256", "causeMessageSha256"
    ], "attempt failure");
    invariant(
      /^[A-Z][A-Z0-9_]{2,95}$/u.test(value.failure.code) &&
        ["comparison-outcome", "instrumentation", "infrastructure"].includes(
          value.failure.classification
        ) &&
        typeof value.failure.retryAllowed === "boolean" &&
        /^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(value.failure.errorName) &&
        sha256Pattern.test(value.failure.messageSha256) &&
        sha256Pattern.test(value.failure.causeMessageSha256),
      "attempt failure is invalid"
    );
    if (value.failure.classification === "comparison-outcome") {
      exactValue(
        value.failure.retryAllowed,
        false,
        "comparison outcome retry policy"
      );
    }
  }
  publicSafe(value, "attempt");
  return value;
}

function loadPendingAttempt(filePath = pendingAttemptPath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 0 && stat.size <= 65536,
    "pending attempt file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const pending = validatePendingAttempt(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(pending)),
    "pending attempt bytes are not canonical"
  );
  return pending;
}

function writePendingAttempt(pending, filePath = pendingAttemptPath) {
  validatePendingAttempt(pending);
  atomicCreate(filePath, canonicalPrettyBytes(pending));
  return filePath;
}

function removePendingAttempt(pending, filePath = pendingAttemptPath) {
  const reopened = loadPendingAttempt(filePath);
  exactStructure(reopened, pending, "pending attempt removal identity");
  fs.rmSync(filePath, { force: false });
  syncDirectory(path.dirname(filePath));
  invariant(!fs.existsSync(filePath), "pending attempt removal failed");
}

function attemptFilePath(attempt) {
  return path.join(
    attemptDirectory,
    attempt.attemptContentHash.slice(0, 2),
    `${attempt.attemptContentHash}.json`
  );
}

function writeAttempt(attempt) {
  validateAttempt(attempt);
  const filePath = attemptFilePath(attempt);
  atomicCreate(filePath, canonicalPrettyBytes(attempt));
  return filePath;
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
      "attempt prefix is not a directory"
    );
    for (const name of fs.readdirSync(prefixPath).sort()) {
      invariant(
        /^[a-f0-9]{64}\.json$/u.test(name),
        "attempt file name is invalid"
      );
      const filePath = path.join(prefixPath, name);
      const stat = fs.lstatSync(filePath);
      invariant(
        stat.isFile() && !stat.isSymbolicLink() &&
          stat.size > 0 && stat.size <= maximumEvidenceBytes,
        "attempt file is invalid"
      );
      const bytes = fs.readFileSync(filePath);
      const attempt = validateAttempt(JSON.parse(bytes.toString("utf8")));
      invariant(
        bytes.equals(canonicalPrettyBytes(attempt)),
        "attempt bytes are not canonical"
      );
      exactValue(
        name,
        `${attempt.attemptContentHash}.json`,
        "attempt file content address"
      );
      exactValue(
        prefix,
        attempt.attemptContentHash.slice(0, 2),
        "attempt prefix content address"
      );
      attempts.push(attempt);
    }
  }
  attempts.sort((left, right) => left.attemptOrdinal - right.attemptOrdinal);
  attempts.forEach((attempt, index) => {
    exactValue(attempt.attemptOrdinal, index + 1, "attempt archive ordinal");
    exactValue(
      attempt.previousAttemptId,
      index === 0 ? null : attempts[index - 1].attemptId,
      "attempt archive predecessor"
    );
    if (index > 0) {
      invariant(
        Date.parse(attempt.startedAtUtc) >=
          Date.parse(attempts[index - 1].completedAtUtc),
        "attempt archive chronology is invalid"
      );
      invariant(
        attempts[index - 1].status === "fail" &&
          attempts[index - 1].failure.retryAllowed === true,
        "attempt follows a terminal attempt"
      );
    }
  });
  return Object.freeze(attempts);
}

function boundedFailure(error) {
  const typed = error instanceof ObservationFailure;
  const message = String(error?.message || "TurboVec reference observation failed");
  return Object.freeze({
    code: typed
      ? error.code
      : "TURBOVEC_REFERENCE_INFRASTRUCTURE_FAILURE",
    classification: typed ? error.classification : "infrastructure",
    retryAllowed: typed ? error.retryAllowed : true,
    errorName:
      error instanceof Error &&
      /^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(error.name)
        ? error.name
        : "Error",
    messageSha256: sha256(Buffer.from(message, "utf8")),
    causeMessageSha256: typed
      ? error.causeMessageSha256
      : sha256(Buffer.from(message, "utf8"))
  });
}

function nodeToolIdentity() {
  const executable = fs.realpathSync.native(process.execPath);
  const stat = boundedFile(executable, 512 * 1024 * 1024, "node executable");
  invariant(safeVersionPattern.test(process.version), "node version is unsafe");
  return Object.freeze({
    name: "node",
    version: process.version,
    binaryBytes: stat.size,
    binarySha256: sha256File(executable)
  });
}

async function generateObservation(pendingAttempt) {
  validatePendingAttempt(pendingAttempt);
  const startedMilliseconds = Date.now();
  const platform = assertCurrentPlatform();
  const manifestResult = validateManifestFile();
  exactValue(
    manifestResult.sha256,
    preregistrationSha256,
    "preregistration identity"
  );
  const commits = assertInputsCommitted();
  const revision = sourceRevision();
  exactValue(
    revision,
    pendingAttempt.sourceRevision,
    "pending attempt source revision"
  );
  const dataset = validateExternalDatasetRoot();
  const crate = validateCrateArchive();
  const cargoPath = executablePath("cargo.exe");
  const rustcPath = executablePath("rustc.exe");
  const powershellPath = executablePath("powershell.exe");
  const tools = Object.freeze({
    node: nodeToolIdentity(),
    cargo: toolIdentity("cargo.exe", ["--version"]),
    rustc: toolIdentity("rustc.exe", ["--version"]),
    powershell: toolIdentity("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$PSVersionTable.PSVersion.ToString()"
    ])
  });
  invariant(
    sha256File(cargoPath) === tools.cargo.binarySha256 &&
      sha256File(rustcPath) === tools.rustc.binarySha256 &&
      sha256File(powershellPath) === tools.powershell.binarySha256,
    "tool path identity changed during setup"
  );
  const outerRoot = createOwnedRoot();
  let outerDeleted = false;
  let primaryFailure = null;
  try {
    const datasetRoot = await materializeDataset(dataset, outerRoot);
    const monitorScript = writeMemoryMonitorScript(outerRoot);
    const build = buildComparator(cargoPath, outerRoot);
    const contract = executeContract(build.binaryPath);
    const quality = executeQuality(build.binaryPath, datasetRoot, outerRoot);
    const performance = await executePerformanceSuite(
      build.binaryPath,
      powershellPath,
      monitorScript.scriptPath,
      datasetRoot,
      outerRoot,
      startedMilliseconds
    );
    const corruptions = executeCorruptionSuite(build.binaryPath, outerRoot);
    const recoveries = executeCrashRecoverySuite(build.binaryPath, outerRoot);
    invariant(
      Date.now() - startedMilliseconds < overallTimeoutMilliseconds,
      "overall observation timeout exceeded"
    );
    removeOwnedRoot(outerRoot);
    outerDeleted = true;
    const body = {
      schema: observationSchema,
      experimentId: expectedExperimentId,
      status: "pass",
      attemptOrdinal: pendingAttempt.attemptOrdinal,
      previousAttemptId: pendingAttempt.previousAttemptId,
      attemptStartedAtUtc: pendingAttempt.startedAtUtc,
      pendingAttemptId: pendingAttempt.pendingAttemptId,
      pendingAttemptContentHash: pendingAttempt.pendingAttemptContentHash,
      observedAtUtc: new Date().toISOString(),
      sourceRevision: revision,
      preregistration: {
        path: preregistrationRelativePath,
        sha256: manifestResult.sha256,
        commit: commits.preregistrationCommit
      },
      implementationCommit: commits.implementationCommit,
      parents: manifestResult.manifest.parents.map((parent) => ({ ...parent })),
      externalDataset: dataset.publicIdentity,
      externalCrate: crate.publicIdentity,
      inputs: inputPaths.map(hashInput),
      tools,
      platform,
      build: build.evidence,
      contractExecution: contract.execution,
      contract: contract.contract,
      qualityExecution: quality.execution,
      quality: quality.quality,
      performanceRecords: performance.records,
      performanceSummaries: performance.summaries,
      corruptionRecords: corruptions,
      crashRecoveries: recoveries,
      thresholdDecision: {
        status: "pass",
        contractMatched: true,
        allSixQualityLanesComplete: true,
        allPerQueryMetricsRetained: true,
        allFrozenQualityThresholdsPassed: true,
        allSixtyPerformanceProcessesComplete: true,
        allFrozenPerformanceThresholdsPassed: true,
        allSevenCorruptionsRejectedBeforeUpstreamLoad: true,
        allFourCrashScenariosRecovered: true,
        committedDeletionRemainedDeletedAfterRestart: true,
        allSeventyTwoProcessRootsDeleted: true,
        resultDrivenThresholdChanges: false
      },
      cleanup: {
        outerMarkerSha256: sha256(Buffer.from("owned-v1\n", "utf8")),
        memoryMonitorScriptSha256: monitorScript.publicIdentity.sha256,
        processRootCount: 72,
        processRootsDeleted: 72,
        outerRootDeleted: true
      },
      authority: observationAuthority,
      openGaps,
      requiredNextGate: manifestResult.manifest.requiredNextGate
    };
    const observation = finalizeObservation(body);
    validateObservation(observation);
    return observation;
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    cleanupWithFailurePolicy(
      primaryFailure,
      "TURBOVEC_REFERENCE_OUTER_CLEANUP_FAILED",
      [() => {
        if (!outerDeleted && fs.existsSync(outerRoot)) {
          removeOwnedRoot(outerRoot);
        }
      }]
    );
  }
}

function validateObservationPendingBinding(observation, pending) {
  exactValue(
    observation.attemptOrdinal,
    pending.attemptOrdinal,
    "observation pending attempt ordinal"
  );
  exactValue(
    observation.previousAttemptId,
    pending.previousAttemptId,
    "observation pending predecessor"
  );
  exactValue(
    observation.attemptStartedAtUtc,
    pending.startedAtUtc,
    "observation pending start time"
  );
  exactValue(
    observation.pendingAttemptId,
    pending.pendingAttemptId,
    "observation pending id"
  );
  exactValue(
    observation.pendingAttemptContentHash,
    pending.pendingAttemptContentHash,
    "observation pending content hash"
  );
  exactValue(
    observation.sourceRevision,
    pending.sourceRevision,
    "observation pending source revision"
  );
  exactValue(
    observation.preregistration.sha256,
    pending.preregistrationSha256,
    "observation pending preregistration"
  );
}

function validateAttemptPendingBinding(attempt, pending) {
  exactValue(
    attempt.attemptOrdinal,
    pending.attemptOrdinal,
    "attempt pending ordinal"
  );
  exactValue(
    attempt.previousAttemptId,
    pending.previousAttemptId,
    "attempt pending predecessor"
  );
  exactValue(
    attempt.startedAtUtc,
    pending.startedAtUtc,
    "attempt pending start time"
  );
  exactValue(
    attempt.sourceRevision,
    pending.sourceRevision,
    "attempt pending source revision"
  );
  exactValue(
    attempt.preregistrationSha256,
    pending.preregistrationSha256,
    "attempt pending preregistration"
  );
}

function passingAttempt(pending, reopened) {
  validateObservationPendingBinding(reopened.observation, pending);
  return finalizeAttempt({
    schema: attemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    status: "pass",
    startedAtUtc: pending.startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    sourceRevision: pending.sourceRevision,
    preregistrationSha256: pending.preregistrationSha256,
    observationId: reopened.observation.observationId,
    observationContentHash: reopened.observation.observationContentHash,
    failure: null
  });
}

function interruptedAttempt(pending) {
  const interruption = new ObservationFailure(
    "TURBOVEC_REFERENCE_PROCESS_INTERRUPTED",
    "infrastructure",
    true,
    new Error("pending observation process ended without a committed outcome")
  );
  return finalizeAttempt({
    schema: attemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: pending.attemptOrdinal,
    previousAttemptId: pending.previousAttemptId,
    status: "fail",
    startedAtUtc: pending.startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    sourceRevision: pending.sourceRevision,
    preregistrationSha256: pending.preregistrationSha256,
    observationId: null,
    observationContentHash: null,
    failure: boundedFailure(interruption)
  });
}

function reconcilePendingAttempt(archive, options = {}) {
  const pendingFilePath =
    options.pendingFilePath ?? pendingAttemptPath;
  const observationFilePath =
    options.observationFilePath ?? observationPath;
  const recordAttempt =
    options.recordAttempt ?? writeAttempt;
  const resolveAttemptPath =
    options.resolveAttemptPath ?? attemptFilePath;
  const pending = loadPendingAttempt(pendingFilePath);
  if (pending === null) {
    const observationExists = fs.existsSync(observationFilePath);
    const lastAttempt = archive.at(-1);
    if (observationExists || lastAttempt?.status === "pass") {
      invariant(
        observationExists && lastAttempt?.status === "pass",
        "observation and passing attempt coverage disagree"
      );
      const reopened = validateObservationFile(observationFilePath);
      exactValue(
        lastAttempt.observationId,
        reopened.observation.observationId,
        "settled passing observation id"
      );
      exactValue(
        lastAttempt.observationContentHash,
        reopened.observation.observationContentHash,
        "settled passing observation hash"
      );
    }
    return Object.freeze({ archive, recovered: null });
  }

  if (pending.attemptOrdinal === archive.length) {
    const recorded = archive.at(-1);
    invariant(recorded, "pending attempt has no archived outcome");
    validateAttemptPendingBinding(recorded, pending);
    let recovered = null;
    if (recorded.status === "pass") {
      const reopened = validateObservationFile(observationFilePath);
      validateObservationPendingBinding(reopened.observation, pending);
      exactValue(
        recorded.observationId,
        reopened.observation.observationId,
        "recorded passing observation id"
      );
      exactValue(
        recorded.observationContentHash,
        reopened.observation.observationContentHash,
        "recorded passing observation hash"
      );
      recovered = Object.freeze({
        observation: reopened,
        attempt: recorded,
        attemptPath: resolveAttemptPath(recorded),
        recovered: true
      });
    } else {
      invariant(
        !fs.existsSync(observationFilePath),
        "failed archived attempt has a successful observation"
      );
    }
    removePendingAttempt(pending, pendingFilePath);
    return Object.freeze({ archive, recovered });
  }

  exactValue(
    pending.attemptOrdinal,
    archive.length + 1,
    "pending attempt next ordinal"
  );
  exactValue(
    pending.previousAttemptId,
    archive.length === 0 ? null : archive.at(-1).attemptId,
    "pending attempt archive predecessor"
  );

  let attempt;
  let recovered = null;
  if (fs.existsSync(observationFilePath)) {
    const reopened = validateObservationFile(observationFilePath);
    attempt = passingAttempt(pending, reopened);
    const attemptPath = recordAttempt(attempt);
    recovered = Object.freeze({
      observation: reopened,
      attempt,
      attemptPath,
      recovered: true
    });
  } else {
    attempt = interruptedAttempt(pending);
    recordAttempt(attempt);
  }
  removePendingAttempt(pending, pendingFilePath);
  return Object.freeze({
    archive: Object.freeze([...archive, attempt]),
    recovered
  });
}

async function runAndWriteObservation() {
  let archive = loadAttemptArchive();
  const reconciled = reconcilePendingAttempt(archive);
  archive = reconciled.archive;
  if (reconciled.recovered !== null) return reconciled.recovered;
  invariant(!fs.existsSync(observationPath), "successful observation already exists");
  if (archive.length > 0) {
    const previous = archive.at(-1);
    invariant(
      previous.status === "fail" && previous.failure.retryAllowed === true,
      "prior attempt is terminal"
    );
  }
  const revision = sourceRevision();
  const pending = finalizePendingAttempt({
    schema: pendingAttemptSchema,
    experimentId: expectedExperimentId,
    attemptOrdinal: archive.length + 1,
    previousAttemptId: archive.length === 0 ? null : archive.at(-1).attemptId,
    startedAtUtc: new Date().toISOString(),
    sourceRevision: revision,
    preregistrationSha256
  });
  writePendingAttempt(pending);
  try {
    const observation = await generateObservation(pending);
    atomicCreate(observationPath, canonicalPrettyBytes(observation));
    const reopened = validateObservationFile(observationPath);
    const attempt = passingAttempt(pending, reopened);
    const attemptPath = writeAttempt(attempt);
    removePendingAttempt(pending);
    return Object.freeze({
      observation: reopened,
      attempt,
      attemptPath,
      recovered: false
    });
  } catch (error) {
    if (fs.existsSync(observationPath)) throw error;
    const attempt = finalizeAttempt({
      schema: attemptSchema,
      experimentId: expectedExperimentId,
      attemptOrdinal: pending.attemptOrdinal,
      previousAttemptId: pending.previousAttemptId,
      status: "fail",
      startedAtUtc: pending.startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: pending.sourceRevision,
      preregistrationSha256: pending.preregistrationSha256,
      observationId: null,
      observationContentHash: null,
      failure: boundedFailure(error)
    });
    writeAttempt(attempt);
    removePendingAttempt(pending);
    throw error;
  }
}

async function main(argumentsList) {
  invariant(
    argumentsList.length === 1 &&
      ["--write", "--validate"].includes(argumentsList[0]),
    "usage: node vector-turbovec-reference-observation.js --write|--validate"
  );
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
    status: result.recovered ? "recovered" : "written"
  })}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "TurboVec reference observation failed"}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  attemptIdentity,
  attemptSchema,
  boundedFailure,
  canonicalPrettyBytes,
  cleanupWithFailurePolicy,
  contractSchema,
  corruptionCases,
  corruptionSchema,
  crashScenarios,
  datasetFiles,
  expectedExperimentId,
  expectedLanes,
  expectedMethodId,
  executablePath,
  finalizeAttempt,
  finalizeObservation,
  finalizePendingAttempt,
  generateObservation,
  hashInput,
  inputPaths,
  loadAttemptArchive,
  loadPendingAttempt,
  memoryMonitorScript,
  offlineEnvironment,
  observationAuthority,
  observationIdentity,
  observationPath,
  observationSchema,
  openGaps,
  pendingAttemptIdentity,
  pendingAttemptSchema,
  performanceSchema,
  preregistrationRelativePath,
  qualitySchema,
  reconcilePendingAttempt,
  recoverySchema,
  removePendingAttempt,
  runAndWriteObservation,
  sha256,
  spawnCapture,
  statistics,
  summarizePerformance,
  validateAttempt,
  validateContractOutput,
  validateCorruptionOutput,
  validateMemoryMeasurement,
  validateObservation,
  validateObservationFile,
  validatePendingAttempt,
  validatePerformanceExecutions,
  validatePerformanceOutput,
  validatePerformanceRecord,
  validatePerformanceSummary,
  validateQualityOutput,
  validateRecoveryOutput,
  writePendingAttempt
});
