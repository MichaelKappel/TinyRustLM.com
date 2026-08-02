"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const schema = "tinyrustlm.exact_flat_physical_target_preregistration.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-preregistration.v1.json";
const defaultPath = path.join(repositoryRoot, defaultRelativePath);
const maximumManifestBytes = 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const relativePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:[a-z]:[\\/]|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|password=|serial(?:number)?=|turn\d+(?:search|view)\d+)/iu;

const expectedParents = Object.freeze([
  Object.freeze({
    path: "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json",
    receiptId: "exact-flat-retrieval-75f95baa316315ea",
    sha256: "893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c"
  }),
  Object.freeze({
    path: "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json",
    receiptId: "exact-flat-browser-wasm-verification-8fcdeb0b93534ca4",
    sha256: "5c52a2287390f79e6a4971da6a6455a69c4ebd52ac6473bcce5408fd62560157"
  })
]);

const expectedWorkloads = Object.freeze([
  Object.freeze({
    workloadId: "dot-128x1000",
    metric: "dot-product",
    normalization: "none",
    dimension: 128,
    recordCount: 1000,
    topK: 10,
    warmupQueries: 8,
    measuredQueries: 64,
    seed: "243f6a8885a308d3"
  }),
  Object.freeze({
    workloadId: "cosine-384x10000",
    metric: "cosine",
    normalization: "l2-unit",
    dimension: 384,
    recordCount: 10000,
    topK: 10,
    warmupQueries: 5,
    measuredQueries: 32,
    seed: "13198a2e03707344"
  }),
  Object.freeze({
    workloadId: "squared-euclidean-768x25000",
    metric: "squared-euclidean",
    normalization: "none",
    dimension: 768,
    recordCount: 25000,
    topK: 10,
    warmupQueries: 3,
    measuredQueries: 12,
    seed: "a4093822299f31d0"
  })
]);

const expectedAuthority = Object.freeze({
  namedTargetLatencyMayBeMeasured: true,
  namedTargetThroughputMayBeMeasured: true,
  namedTargetProcessMemoryMayBeMeasured: true,
  namedTargetEnergyMayBeMeasuredOnlyWithValidJoules: true,
  completePhysicalTargetGateMayBeClaimed: false,
  browserPerformanceMayBeClaimed: false,
  compressionMayBeClaimed: false,
  turboVecParityMayBeClaimed: false,
  representativeRetrievalQualityMayBeClaimed: false,
  productIntegrationMayBeClaimed: false,
  trainingMayBeAuthorized: false,
  releaseMayBeAuthorized: false
});

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

function validateParent(parent, index) {
  exactKeys(parent, ["path", "receiptId", "sha256"], `parents[${index}]`);
  exactValue(parent, expectedParents[index], `parents[${index}]`);
  invariant(relativePathPattern.test(parent.path), `parents[${index}].path is unsafe`);
  invariant(sha256Pattern.test(parent.sha256), `parents[${index}].sha256 is invalid`);
}

function validateTarget(target) {
  exactKeys(target, [
    "targetId", "runtimeIdentifier", "architecture", "operatingSystem", "processor",
    "board", "powerPlan", "identityEvidence", "physicalChassisAttestation",
    "finalReleaseHardwareGateEligible"
  ], "target");
  invariant(target.targetId ===
    "win-x64-amd-ryzen-7-8700g-asus-prime-x670e-pro-wifi-20260722",
  "target.targetId is invalid");
  invariant(target.runtimeIdentifier === "win-x64", "target.runtimeIdentifier is invalid");
  invariant(target.architecture === "x86_64", "target.architecture is invalid");
  exactValue(target.operatingSystem, {
    productName: "Windows Server 2022 Standard Evaluation",
    displayVersion: "21H2",
    build: "20348.5256",
    installationType: "Server"
  }, "target.operatingSystem");
  exactValue(target.processor, {
    name: "AMD Ryzen 7 8700G w/ Radeon 780M Graphics",
    vendor: "AuthenticAMD",
    registryMegahertz: 4192,
    logicalProcessors: 16
  }, "target.processor");
  exactValue(target.board, {
    manufacturer: "ASUSTeK COMPUTER INC.",
    product: "PRIME X670E-PRO WIFI",
    biosVendor: "American Megatrends Inc.",
    biosVersion: "1809"
  }, "target.board");
  exactValue(target.powerPlan, {
    guid: "381b4222-f694-41f0-9685-ff5bb260df2e",
    name: "Balanced"
  }, "target.powerPlan");
  exactValue(target.identityEvidence, [
    "windows-cpu-registry",
    "windows-bios-registry",
    "windows-version-registry",
    "environment-logical-processor-count",
    "powercfg-active-scheme"
  ], "target.identityEvidence");
  invariant(target.physicalChassisAttestation === "not-independently-verified",
    "target.physicalChassisAttestation is invalid");
  invariant(target.finalReleaseHardwareGateEligible === false,
    "target final release authority must remain false");
}

function validateBuild(build) {
  exactKeys(build, [
    "librarySource", "benchmarkSource", "libraryOutput", "benchmarkOutput",
    "libraryCommand", "benchmarkCommand", "workspaceManifestMutationAllowed",
    "exactFlatSourceMutationAllowed", "unsafeCodeAllowed", "thirdPartyDependenciesAllowed"
  ], "build");
  exactValue(build.libraryCommand, [
    "rustc", "--crate-name", "tinyrustlm_vector_oracle", "--crate-type", "rlib",
    "--edition=2021", "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs",
    "-C", "opt-level=3", "-C", "codegen-units=1", "-C", "target-cpu=native",
    "-C", "overflow-checks=yes", "-o",
    "<owned-output-directory>/libtinyrustlm_vector_oracle.rlib"
  ], "build.libraryCommand");
  exactValue(build.benchmarkCommand, [
    "rustc", "--crate-name", "exact_flat_physical_target_benchmark", "--edition=2021",
    "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-benchmark.rs",
    "--extern",
    "tinyrustlm_vector_oracle=<owned-output-directory>/libtinyrustlm_vector_oracle.rlib",
    "-C", "opt-level=3", "-C", "codegen-units=1", "-C", "target-cpu=native",
    "-C", "overflow-checks=yes", "-o",
    "<owned-output-directory>/exact_flat_physical_target_benchmark.exe"
  ], "build.benchmarkCommand");
  invariant(build.librarySource ===
    "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs", "build.librarySource is invalid");
  invariant(build.benchmarkSource ===
    "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-benchmark.rs",
  "build.benchmarkSource is invalid");
  invariant(build.libraryOutput ===
    "<owned-output-directory>/libtinyrustlm_vector_oracle.rlib",
  "build.libraryOutput is invalid");
  invariant(build.benchmarkOutput ===
    "<owned-output-directory>/exact_flat_physical_target_benchmark.exe",
  "build.benchmarkOutput is invalid");
  for (const field of [
    "workspaceManifestMutationAllowed", "exactFlatSourceMutationAllowed", "unsafeCodeAllowed",
    "thirdPartyDependenciesAllowed"
  ]) {
    invariant(build[field] === false, `build.${field} must remain false`);
  }
}

function validateExecution(execution) {
  exactKeys(execution, [
    "processRunsPerWorkload", "processOrder", "parallelProcesses", "threadsPerProcess",
    "processAffinity", "processPriority", "timeoutMsPerProcess", "cachePolicy", "timer",
    "percentileMethod", "outlierPolicy", "resultOrder", "stdoutContract", "stderrContract",
    "benchmarkArguments"
  ], "execution");
  exactValue(execution, {
    processRunsPerWorkload: 3,
    processOrder: "workload-order-then-run-order",
    parallelProcesses: 1,
    threadsPerProcess: 1,
    processAffinity: "not-set-recorded-as-uncontrolled",
    processPriority: "normal",
    timeoutMsPerProcess: 120000,
    cachePolicy: "fresh-process-and-rebuilt-index-without-os-cache-flush",
    timer: "rust-std-time-instant-monotonic",
    percentileMethod: "nearest-rank-ceiling-one-indexed",
    outlierPolicy: "retain-all-valid-process-and-query-samples",
    resultOrder: "exact-duration-array-in-execution-order",
    stdoutContract: "one-canonical-json-object-and-trailing-newline",
    stderrContract: "empty-on-success",
    benchmarkArguments: ["--workload", "<workload-id>", "--run", "<one-based-run-index>"]
  }, "execution");
}

function validateWorkloads(workloads) {
  invariant(Array.isArray(workloads), "workloads must be an array");
  exactValue(workloads, expectedWorkloads, "workloads");
  for (const [index, workload] of workloads.entries()) {
    exactKeys(workload, [
      "workloadId", "metric", "normalization", "dimension", "recordCount", "topK",
      "warmupQueries", "measuredQueries", "seed"
    ], `workloads[${index}]`);
    invariant(Number.isSafeInteger(workload.dimension) && workload.dimension > 0,
      `workloads[${index}].dimension is invalid`);
    invariant(Number.isSafeInteger(workload.recordCount) && workload.recordCount > 0,
      `workloads[${index}].recordCount is invalid`);
    invariant(Number.isSafeInteger(workload.measuredQueries) && workload.measuredQueries >= 12,
      `workloads[${index}].measuredQueries is invalid`);
    invariant(/^[a-f0-9]{16}$/u.test(workload.seed), `workloads[${index}].seed is invalid`);
  }
}

function validateMeasurement(measurement) {
  exactKeys(measurement, [
    "requiredRawFields", "derivedFields", "memoryProbe", "energyCounterSet",
    "energyCounterPath", "energyCapabilityObservedBeforeRegistration", "energyUnit",
    "energyJoulesRequiredForCompleteTargetGate", "rawEnergyCounterDeltaMaySubstituteForJoules"
  ], "measurement");
  exactValue(measurement.requiredRawFields, [
    "buildDurationNs", "warmupDurationNs", "queryDurationNs", "validationChecksum",
    "serializedIndexBytes", "workingSetAfterBuildBytes", "peakWorkingSetAfterBuildBytes",
    "workingSetAfterSearchBytes", "peakWorkingSetAfterSearchBytes",
    "peakWorkingSetAfterSerializationBytes"
  ], "measurement.requiredRawFields");
  exactValue(measurement.derivedFields, [
    "queryP50Ns", "queryP95Ns", "queryP99Ns", "medianRecordsPerSecond",
    "medianCoordinatesPerSecond"
  ], "measurement.derivedFields");
  invariant(measurement.memoryProbe ===
    "windows-get-process-self-working-set64-and-peak-working-set64",
  "measurement.memoryProbe is invalid");
  invariant(measurement.energyCounterSet === "Energy Meter",
    "measurement.energyCounterSet is invalid");
  invariant(measurement.energyCounterPath === "\\Energy Meter(*)\\Energy",
    "measurement.energyCounterPath is invalid");
  invariant(measurement.energyCapabilityObservedBeforeRegistration ===
    "counter-set-advertised-no-instance-present",
  "measurement.energy capability is invalid");
  invariant(measurement.energyUnit ===
    "unavailable-until-counter-instance-and-authoritative-unit-exist",
  "measurement.energyUnit is invalid");
  invariant(measurement.energyJoulesRequiredForCompleteTargetGate === true,
    "measurement must require joules for the complete target gate");
  invariant(measurement.rawEnergyCounterDeltaMaySubstituteForJoules === false,
    "raw energy deltas cannot substitute for joules");
}

function validateValidity(validity) {
  const expected = {
    allBuildCommandsMustExitZero: true,
    allNineProcessesMustExitZero: true,
    allNineOutputsMustMatchSchema: true,
    exactWorkloadAndRunCoverageRequired: true,
    validationChecksumMustMatchAcrossRunsPerWorkload: true,
    queryDurationMustBePositive: true,
    memoryMeasurementsMustBePositiveAndMonotonic: true,
    serializedByteCountMustMatchAcrossRunsPerWorkload: true,
    toolAndBinaryHashesRequired: true,
    sourceClosureHashesRequired: true,
    powerPlanMustMatchRegisteredTarget: true,
    targetIdentityMustMatchRegisteredTarget: true,
    energyUnavailabilityInvalidatesLatencyAndMemory: false,
    energyUnavailabilityKeepsCompleteTargetGateOpen: true,
    infrastructureFailuresMayBeRetried: true,
    semanticOrIdentityFailuresMayBeRetried: false,
    resultDrivenThresholdChangesAllowed: false
  };
  exactKeys(validity, Object.keys(expected), "validity");
  exactValue(validity, expected, "validity");
}

function validateEvidencePolicy(policy) {
  const expected = {
    attemptsAreImmutable: true,
    failedAttemptsArePreserved: true,
    attemptDirectory:
      "tinyrustlm/experiments/vector-quantization/physical-target-attempts/sha256",
    successfulObservationPath:
      "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-observation-v1.json",
    verificationReceiptPath:
      "tinyrustlm/experiments/vector-quantization/exact-flat-physical-target-verification-v1.json",
    privateAbsolutePathsAllowed: false,
    hardwareSerialNumbersAllowed: false,
    credentialsAllowed: false,
    modelBytesAllowed: false,
    promptTextAllowed: false
  };
  exactKeys(policy, Object.keys(expected), "evidencePolicy");
  exactValue(policy, expected, "evidencePolicy");
  invariant(relativePathPattern.test(policy.attemptDirectory),
    "evidencePolicy.attemptDirectory is unsafe");
}

function validateManifest(manifest) {
  exactKeys(manifest, [
    "schema", "experimentId", "registeredAtUtc", "status", "parents", "target", "build",
    "execution", "workloads", "measurement", "validity", "evidencePolicy", "authority",
    "requiredNextGate"
  ], "manifest");
  invariant(manifest.schema === schema, "manifest schema is invalid");
  invariant(manifest.experimentId === "exact-flat-physical-target-win-x64-20260722",
    "manifest experimentId is invalid");
  invariant(utcPattern.test(manifest.registeredAtUtc), "manifest registeredAtUtc is invalid");
  invariant(manifest.status === "preregistered-before-performance-results",
    "manifest status is invalid");
  invariant(Array.isArray(manifest.parents) && manifest.parents.length === 2,
    "manifest parents are invalid");
  manifest.parents.forEach(validateParent);
  validateTarget(manifest.target);
  validateBuild(manifest.build);
  validateExecution(manifest.execution);
  validateWorkloads(manifest.workloads);
  validateMeasurement(manifest.measurement);
  validateValidity(manifest.validity);
  validateEvidencePolicy(manifest.evidencePolicy);
  exactKeys(manifest.authority, Object.keys(expectedAuthority), "authority");
  exactValue(manifest.authority, expectedAuthority, "authority");
  invariant(manifest.requiredNextGate ===
    "After valid target latency, throughput, and process-memory evidence, retain the energy and physical-attestation gaps, then preregister a sealed representative corpus and crash-recovered durable deletion proof before any compressed comparison arm.",
  "manifest requiredNextGate is invalid");
  invariant(!forbiddenTextPattern.test(JSON.stringify(manifest)),
    "manifest contains forbidden private or secret-like text");
  return manifest;
}

function validateManifestFile(filePath = defaultPath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumManifestBytes, "manifest must be a bounded regular file");
  const bytes = fs.readFileSync(resolved);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  const canonical = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  invariant(bytes.equals(canonical), "manifest bytes are not canonical pretty JSON");
  for (const parent of manifest.parents) {
    const parentPath = path.resolve(repositoryRoot, parent.path);
    const relative = path.relative(repositoryRoot, parentPath);
    invariant(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
      `parent escaped repository root: ${parent.path}`);
    invariant(sha256File(parentPath) === parent.sha256,
      `parent hash drifted: ${parent.path}`);
  }
  return Object.freeze({
    manifest,
    path: path.relative(repositoryRoot, resolved).replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: sha256(bytes)
  });
}

if (require.main === module) {
  try {
    const result = validateManifestFile(process.argv[2] || defaultPath);
    process.stdout.write(`${JSON.stringify({
      schema: result.manifest.schema,
      experimentId: result.manifest.experimentId,
      targetId: result.manifest.target.targetId,
      workloadCount: result.manifest.workloads.length,
      processCount: result.manifest.workloads.length *
        result.manifest.execution.processRunsPerWorkload,
      sha256: result.sha256,
      status: "valid"
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "manifest validation failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  defaultPath,
  expectedAuthority,
  expectedParents,
  expectedWorkloads,
  schema,
  validateManifest,
  validateManifestFile
});
