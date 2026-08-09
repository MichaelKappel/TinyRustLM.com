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
  expectedSha256: expectedManifestSha256,
  experimentId,
  validateManifestFile
} = require("./vector-portable-affine-u8-json-domain-v2-preregistration.js");
const {
  readGitBlob,
  validateGitInput
} = require("./vector-historical-git-input.js");

const pendingSchema =
  "tinyrustlm.portable_affine_u8_flat_json_domain_v2_pending_attempt.v1";
const attemptSchema =
  "tinyrustlm.portable_affine_u8_flat_json_domain_v2_attempt.v1";
const observationSchema =
  "tinyrustlm.portable_affine_u8_flat_json_domain_v2_observation.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationRelativePath = path.relative(
  repositoryRoot,
  preregistrationPath
).replaceAll("\\", "/");
const runnerRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-observation.js";
const runnerTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-json-domain-v2-observation.test.js";
const pendingRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-pending-attempt-v1.json";
const pendingPath = path.join(repositoryRoot, pendingRelativePath);
const attemptDirectoryRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptDirectoryRelativePath);
const observationRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "portable-affine-u8-flat-json-domain-v2-observation-v1.json";
const observationPath = path.join(repositoryRoot, observationRelativePath);
const maximumEvidenceBytes = 64 * 1024 * 1024;
const maximumInputBytes = 64 * 1024 * 1024;
const maximumBenchmarkProcessCount = 77;
const maximumMonitorProcessCount = 60;
const maximumAttemptCount = 1;
const maximumRetryCount = 0;
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

const frozenHarnessRelativePath =
  "tinyrustlm/tools/vector-portable-affine-u8-observation.js";
const frozenHarnessRevision =
  "41801f7114b2c0df04f796946051e4f821472ce1";
const frozenHarnessExpectedBytes = 157232;
const frozenHarnessExpectedSha256 =
  "3b3a65db1a500f143b9e27092329f0f7e56c56c0427d53ff4d01db7e0fbd177b";

function replaceExact(source, before, after, expectedCount, label) {
  const actualCount = source.split(before).length - 1;
  invariant(actualCount === expectedCount, `${label} replacement count drifted`);
  return source.split(before).join(after);
}

function adaptFrozenHarness(source) {
  const replacements = Object.freeze([
    Object.freeze({
      label: "experiment identity",
      before:
        'const expectedExperimentId = "portable-affine-u8-flat-20260726";',
      after:
        'const expectedExperimentId = ' +
        '"portable-affine-u8-flat-json-domain-v2-20260726";',
      count: 1
    }),
    Object.freeze({
      label: "contract schema",
      before:
        'const contractSchema = ' +
        '"tinyrustlm.portable_affine_u8_benchmark_contract.v1";',
      after:
        'const contractSchema = ' +
        '"tinyrustlm.portable_affine_u8_benchmark_contract.v2";',
      count: 1
    }),
    Object.freeze({
      label: "quality schema",
      before:
        'const qualitySchema = ' +
        '"tinyrustlm.portable_affine_u8_quality_process.v1";',
      after:
        'const qualitySchema = ' +
        '"tinyrustlm.portable_affine_u8_quality_process.v2";',
      count: 1
    }),
    Object.freeze({
      label: "performance schema",
      before:
        'const performanceSchema = ' +
        '"tinyrustlm.portable_affine_u8_performance_process.v1";',
      after:
        'const performanceSchema = ' +
        '"tinyrustlm.portable_affine_u8_performance_process.v2";',
      count: 1
    }),
    Object.freeze({
      label: "recovery schema",
      before:
        'const recoverySchema =\n' +
        '  "tinyrustlm.portable_affine_u8_durable_deletion_recovery.v1";',
      after:
        'const recoverySchema =\n' +
        '  "tinyrustlm.portable_affine_u8_durable_deletion_recovery.v2";',
      count: 1
    }),
    Object.freeze({
      label: "benchmark source",
      before:
        'const benchmarkRelativePath =\n' +
        '  "tinyrustlm/experiments/vector-quantization/' +
        'portable-affine-u8-benchmark.rs";',
      after:
        'const benchmarkRelativePath =\n' +
        '  "tinyrustlm/experiments/vector-quantization/' +
        'portable-affine-u8-benchmark-v2.rs";',
      count: 1
    }),
    Object.freeze({
      label: "owned root prefix",
      before:
        'const outerRootPrefix = ' +
        '"tinyrustlm-portable-affine-u8-observation-";',
      after:
        'const outerRootPrefix = ' +
        '"tinyrustlm-portable-affine-u8-json-domain-v2-observation-";',
      count: 1
    }),
    Object.freeze({
      label: "owned root marker",
      before:
        'const outerRootMarker = ' +
        '".tinyrustlm-portable-affine-u8-observation-owned-v1";',
      after:
        'const outerRootMarker = ' +
        '".tinyrustlm-portable-affine-u8-json-domain-v2-observation-owned";',
      count: 1
    }),
    Object.freeze({
      label: "process root marker",
      before:
        'const processRootMarker =\n' +
        '  ".tinyrustlm-portable-affine-u8-deletion-owned";',
      after:
        'const processRootMarker =\n' +
        '  ".tinyrustlm-portable-affine-u8-v2-deletion-owned";',
      count: 1
    }),
    Object.freeze({
      label: "process root marker bytes",
      before: "tinyrustlm-portable-affine-u8-deletion-owned-v1\\n",
      after: "tinyrustlm-portable-affine-u8-v2-deletion-owned\\n",
      count: 1
    }),
    Object.freeze({
      label: "owned root marker bytes",
      before: "owned-v1\\n",
      after: "owned-json-domain-v2\\n",
      count: 4
    })
  ]);
  let adapted = source;
  for (const replacement of replacements) {
    adapted = replaceExact(
      adapted,
      replacement.before,
      replacement.after,
      replacement.count,
      replacement.label
    );
  }
  return Object.freeze({ source: adapted, replacements });
}

function loadV2Harness() {
  const filename = require.resolve("./vector-portable-affine-u8-observation.js");
  const bytes = readGitBlob(
    repositoryRoot,
    frozenHarnessRevision,
    frozenHarnessRelativePath,
    maximumInputBytes
  );
  invariant(bytes.length === frozenHarnessExpectedBytes, "frozen harness size drifted");
  invariant(sha256(bytes) === frozenHarnessExpectedSha256, "frozen harness hash drifted");
  const adapted = adaptFrozenHarness(bytes.toString("utf8"));
  const augmentation = `
module.exports = Object.freeze({
  boundedFailure,
  buildComparator,
  contractSchema,
  corruptionCases,
  crashScenarios,
  createOwnedRoot,
  evaluatePerformanceThresholds,
  evaluateQualityThresholds,
  expectedExperimentId,
  expectedLanes,
  expectedMethodId,
  executeContract,
  executeCorruptionSuite,
  executeCrashRecoverySuite,
  executePerformanceSuite,
  executeQuality,
  harnessContract: Object.freeze({
    benchmarkRelativePath,
    outerRootPrefix,
    outerRootMarker,
    outerRootMarkerBytesSha256: sha256(
      Buffer.from("owned-json-domain-v2\\n", "utf8")
    ),
    processRootMarker,
    processRootMarkerBytesSha256: sha256(processRootMarkerBytes)
  }),
  inputPaths,
  materializeDataset,
  offlineEnvironment,
  performanceSchema,
  prepareObservationPrerequisites,
  qualitySchema,
  recoverySchema,
  removeOwnedRoot,
  summarizePerformance,
  validateBuildEvidence,
  validateBuildVerificationEvidence,
  validateContractOutput,
  validateCorruptionRecord,
  validateCrashRecoveryRecord,
  validateExternalDatasetEvidence,
  validatePerformanceRecord,
  validatePerformanceSummary,
  validateQualityOutput,
  verifyBuildAndWasm,
  writeMemoryMonitorScript
});
`;
  const compiled = vm.compileFunction(
    `${adapted.source}\n${augmentation}`,
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
  const forbiddenCapabilities = [
    "generateObservation",
    "reconcilePendingAttempt",
    "runAndWriteObservation",
    "writePendingAttempt"
  ];
  for (const capability of forbiddenCapabilities) {
    invariant(
      !(capability in loaded.exports),
      `terminal harness capability is reachable: ${capability}`
    );
  }
  exactStructure(loaded.exports.harnessContract, {
    benchmarkRelativePath:
      "tinyrustlm/experiments/vector-quantization/" +
      "portable-affine-u8-benchmark-v2.rs",
    outerRootPrefix:
      "tinyrustlm-portable-affine-u8-json-domain-v2-observation-",
    outerRootMarker:
      ".tinyrustlm-portable-affine-u8-json-domain-v2-observation-owned",
    outerRootMarkerBytesSha256: sha256(
      Buffer.from("owned-json-domain-v2\n", "utf8")
    ),
    processRootMarker:
      ".tinyrustlm-portable-affine-u8-v2-deletion-owned",
    processRootMarkerBytesSha256: sha256(
      Buffer.from(
        "tinyrustlm-portable-affine-u8-v2-deletion-owned\n",
        "utf8"
      )
    )
  }, "adapted harness contract");
  const capabilities = Object.freeze(Object.keys(loaded.exports).sort());
  return Object.freeze({
    subject: loaded.exports,
    evidence: Object.freeze({
      schema: "tinyrustlm.portable_affine_u8_harness_adapter.v1",
      frozenSourcePath: frozenHarnessRelativePath,
      frozenSourceBytes: bytes.length,
      frozenSourceSha256: sha256(bytes),
      transformedSourceSha256: sha256(Buffer.from(adapted.source, "utf8")),
      replacementRuleCount: adapted.replacements.length,
      exportedCapabilities: capabilities,
      terminalWriterCapabilitiesExported: false,
      harnessContract: loaded.exports.harnessContract,
      experimentId,
      contractSchema:
        "tinyrustlm.portable_affine_u8_benchmark_contract.v2",
      qualitySchema: "tinyrustlm.portable_affine_u8_quality_process.v2",
      performanceSchema:
        "tinyrustlm.portable_affine_u8_performance_process.v2",
      recoverySchema:
        "tinyrustlm.portable_affine_u8_durable_deletion_recovery.v2"
    })
  });
}

// The terminal file remains byte-for-byte immutable. Only a strict whitelist
// from its already tested harness is exposed after exact v2 contract rewrites.
const loadedHarness = loadV2Harness();
const subject = loadedHarness.subject;
const harnessAdapterEvidence = loadedHarness.evidence;

const preregistrationAtLoad = validateManifestFile();
const v2SpecificInputs = Object.freeze([
  preregistrationRelativePath,
  "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-preregistration.js",
  "tinyrustlm/tests/vector-portable-affine-u8-json-domain-v2-preregistration.test.js",
  runnerRelativePath,
  runnerTestRelativePath,
  ...preregistrationAtLoad.manifest.subject.criticalInputs.map(
    (entry) => entry.path
  )
]);
const inputPaths = Object.freeze([
  ...new Set([...v2SpecificInputs, ...subject.inputPaths])
]);
const workspaceLockRelativePath = "Cargo.lock";

const authority = Object.freeze({
  ...preregistrationAtLoad.manifest.authority.beforeIndependentVerifiedPass
});
const requiredNextGate =
  "Independently verify the committed v2 terminal attempt and any observation " +
  "before making a bounded research claim. This experiment allows exactly one " +
  "attempt and no retry; preserve every terminal result immutably.";

function validateRunnerPreregistrationBinding(
  manifest = preregistrationAtLoad.manifest
) {
  exactValue(manifest.experimentId, experimentId, "runner experiment binding");
  exactStructure(manifest.plannedArtifacts, {
    runnerPath: runnerRelativePath,
    runnerExistsAtRegistration: false,
    runnerTestPath: runnerTestRelativePath,
    runnerTestExistsAtRegistration: false,
    pendingPath: pendingRelativePath,
    pendingExistsAtRegistration: false,
    attemptDirectory: attemptDirectoryRelativePath,
    attemptExistsAtRegistration: false,
    observationPath: observationRelativePath,
    observationExistsAtRegistration: false,
    verifierPath:
      "tinyrustlm/tools/vector-portable-affine-u8-json-domain-v2-verification.js",
    verifierExistsAtRegistration: false,
    verifierTestPath:
      "tinyrustlm/tests/vector-portable-affine-u8-json-domain-v2-verification.test.js",
    verifierTestExistsAtRegistration: false,
    verificationPath:
      "tinyrustlm/experiments/vector-quantization/" +
      "portable-affine-u8-flat-json-domain-v2-verification-v1.json",
    verificationExistsAtRegistration: false
  }, "planned artifact binding");
  exactValue(
    manifest.fullExecution.maximumBenchmarkProcessCount,
    maximumBenchmarkProcessCount,
    "benchmark process ceiling"
  );
  exactValue(
    manifest.fullExecution.maximumMemoryMonitorProcessCount,
    maximumMonitorProcessCount,
    "monitor process ceiling"
  );
  exactValue(
    manifest.fullExecution.parallelBenchmarkProcesses,
    1,
    "parallel process ceiling"
  );
  exactValue(
    manifest.fullExecution.overallTimeoutMilliseconds,
    overallTimeoutMilliseconds,
    "overall timeout binding"
  );
  exactValue(
    manifest.attemptPolicy.maximumAttemptCount,
    maximumAttemptCount,
    "attempt count binding"
  );
  exactValue(
    manifest.attemptPolicy.maximumRetryCount,
    maximumRetryCount,
    "retry count binding"
  );
  for (const retryField of [
    "qualityProcessFailureMayBeRetried",
    "qualityThresholdFailureMayBeRetried",
    "performanceOutcomeFailureMayBeRetried",
    "corruptionOrRecoverySemanticFailureMayBeRetried",
    "infrastructureFailureMayBeRetried"
  ]) {
    exactValue(
      manifest.attemptPolicy[retryField],
      false,
      `retry policy ${retryField}`
    );
  }
  exactStructure(
    manifest.fullExecution.phaseOrder.map((phase) => Object.freeze({
      phase: phase.phase,
      benchmarkProcessCount: phase.benchmarkProcessCount
    })),
    [
      { phase: "pending-intent", benchmarkProcessCount: 0 },
      { phase: "source-dataset-tool-validation", benchmarkProcessCount: 0 },
      {
        phase:
          "v2-regressions-native-tests-clippy-docs-wasm-build-and-execution",
        benchmarkProcessCount: 0
      },
      { phase: "contract", benchmarkProcessCount: 1 },
      { phase: "corruption", benchmarkProcessCount: 7 },
      { phase: "crash-and-recovery", benchmarkProcessCount: 8 },
      { phase: "quality", benchmarkProcessCount: 1 },
      { phase: "paired-performance", benchmarkProcessCount: 60 },
      {
        phase: "threshold-decision-and-observation-commit",
        benchmarkProcessCount: 0
      }
    ],
    "phase schedule binding"
  );
  exactValue(
    subject.expectedExperimentId,
    experimentId,
    "adapted benchmark experiment"
  );
  exactValue(
    subject.expectedMethodId,
    manifest.subject.methodId,
    "adapted benchmark method"
  );
  for (const [manifestField, subjectValue] of [
    ["benchmarkContractSchema", subject.contractSchema],
    ["qualitySchema", subject.qualitySchema],
    ["performanceSchema", subject.performanceSchema],
    ["recoverySchema", subject.recoverySchema]
  ]) {
    exactValue(
      manifest.outputContract[manifestField],
      subjectValue,
      `output contract ${manifestField}`
    );
  }
  for (const criticalInput of manifest.subject.criticalInputs) {
    invariant(
      inputPaths.includes(criticalInput.path),
      `critical input is absent: ${criticalInput.path}`
    );
  }
  invariant(
    !inputPaths.includes(
      "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-benchmark.rs"
    ),
    "terminal v1 benchmark entered the v2 input closure"
  );
  exactValue(
    manifest.registrationBoundary.outcomeModesInvokedBeforeRegistration,
    false,
    "registration outcome boundary"
  );
  return manifest;
}

validateRunnerPreregistrationBinding();

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
    "v2 input status"
  );
  exactValue(status.stdout, "", "v2 input closure status");
}

function implementationCommit(registrationCommit, revision) {
  invariant(
    revisionPattern.test(registrationCommit) &&
      revisionPattern.test(revision),
    "v2 commit identity is invalid"
  );
  const history = productionLineageReader();
  const implementation = history.lastChangeCommit([
    runnerRelativePath,
    runnerTestRelativePath
  ]);
  invariant(
    revisionPattern.test(implementation) &&
      implementation !== registrationCommit,
    "v2 implementation commit is invalid"
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
    "portable-affine-u8-flat-json-domain-v2-pending",
    "pendingAttemptId",
    "pendingAttemptContentHash"
  );
}

function finalizePendingAttempt(value) {
  return finalizeIdentity(
    value,
    "portable-affine-u8-flat-json-domain-v2-pending",
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
  ], "v2 pending attempt");
  exactValue(value.schema, pendingSchema, "pending schema");
  exactValue(value.experimentId, experimentId, "pending experimentId");
  exactValue(value.attemptOrdinal, 1, "pending attempt ordinal");
  exactValue(value.previousAttemptId, null, "pending predecessor");
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
  publicSafe(value, "v2 pending attempt");
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
  boundedEvidenceFile(filePath, "v2 pending attempt");
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
  invariant(!fs.existsSync(filePath), "v2 pending attempt already exists");
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

function validateHarnessAdapterEvidence(value) {
  exactStructure(value, harnessAdapterEvidence, "harness adapter evidence");
  publicSafe(value, "harness adapter evidence");
  return value;
}

function finiteDomain(value, minimum, maximum, label) {
  invariant(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= minimum &&
      value <= maximum,
    `${label} numeric domain is invalid`
  );
}

function validateFieldsInDomain(value, fields, minimum, maximum, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  for (const field of fields) {
    finiteDomain(value[field], minimum, maximum, `${label}.${field}`);
  }
}

function validateQualityNumberDomains(value) {
  invariant(
    isPlainObject(value) &&
      Array.isArray(value.laneResults) &&
      Array.isArray(value.perQueryMetrics),
    "quality numeric domain structure is invalid"
  );
  const unitQueryFields = [
    "recallAt1",
    "recallAt10",
    "recallAt100",
    "mrrAt100",
    "ndcgAt100",
    "rankInversionRateAt100"
  ];
  const optionalUnitQueryFields = [
    "labelPrecisionAt10",
    "labelMrrAt10",
    "labelNdcgAt10",
    "oracleLabelPrecisionAt10",
    "oracleLabelMrrAt10",
    "oracleLabelNdcgAt10"
  ];
  const nonnegativeQueryFields = [
    "maximumAbsoluteNormalizedScoreError",
    "meanAbsoluteNormalizedScoreError",
    "p99AbsoluteNormalizedScoreError"
  ];
  value.perQueryMetrics.forEach((query, queryIndex) => {
    const label = `quality.perQueryMetrics[${queryIndex}]`;
    validateFieldsInDomain(query, unitQueryFields, 0, 1, label);
    for (const field of optionalUnitQueryFields) {
      if (query[field] !== null) {
        finiteDomain(query[field], 0, 1, `${label}.${field}`);
      }
    }
    validateFieldsInDomain(
      query,
      nonnegativeQueryFields,
      0,
      Number.MAX_VALUE,
      label
    );
    invariant(Array.isArray(query.scorePairs), `${label}.scorePairs is invalid`);
    query.scorePairs.forEach((pair, pairIndex) => {
      const pairLabel = `${label}.scorePairs[${pairIndex}]`;
      finiteDomain(
        pair.candidateScore,
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
        `${pairLabel}.candidateScore`
      );
      finiteDomain(
        pair.oracleScore,
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
        `${pairLabel}.oracleScore`
      );
      finiteDomain(
        pair.absoluteNormalizedScoreError,
        0,
        Number.MAX_VALUE,
        `${pairLabel}.absoluteNormalizedScoreError`
      );
    });
    invariant(
      Array.isArray(query.oracleTopResults),
      `${label}.oracleTopResults is invalid`
    );
    query.oracleTopResults.forEach((hit, hitIndex) =>
      finiteDomain(
        hit.score,
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
        `${label}.oracleTopResults[${hitIndex}].score`
      ));
  });

  const unitLaneFields = [
    "minimumRecallAt1",
    "minimumRecallAt10",
    "minimumRecallAt100",
    "minimumMrrAt100",
    "minimumNdcgAt100",
    "maximumRankInversionRateAt100"
  ];
  const nonnegativeLaneFields = [
    "maximumAbsoluteNormalizedScoreError",
    "meanAbsoluteNormalizedScoreError",
    "p99AbsoluteNormalizedScoreError"
  ];
  const utilityFields = [
    "macroLabelPrecisionAt10",
    "macroLabelMrrAt10",
    "macroLabelNdcgAt10"
  ];
  value.laneResults.forEach((lane, laneIndex) => {
    const label = `quality.laneResults[${laneIndex}]`;
    validateFieldsInDomain(lane, unitLaneFields, 0, 1, label);
    validateFieldsInDomain(
      lane,
      nonnegativeLaneFields,
      0,
      Number.MAX_VALUE,
      label
    );
    validateFieldsInDomain(
      lane.byteAccounting,
      [
        "candidateToFullExactRatio",
        "effectiveBitsPerOriginalCoordinate"
      ],
      0,
      Number.MAX_VALUE,
      `${label}.byteAccounting`
    );
    validateFieldsInDomain(
      lane.capacityControl,
      [
        "minimumRecallAt1",
        "minimumRecallAt10",
        "minimumRecallAt100",
        "minimumMrrAt100",
        "minimumNdcgAt100"
      ],
      0,
      1,
      `${label}.capacityControl`
    );
    if (lane.naturalUtility !== null) {
      validateFieldsInDomain(
        lane.naturalUtility.candidate,
        utilityFields,
        0,
        1,
        `${label}.naturalUtility.candidate`
      );
      validateFieldsInDomain(
        lane.naturalUtility.exact,
        utilityFields,
        0,
        1,
        `${label}.naturalUtility.exact`
      );
      validateFieldsInDomain(
        lane.naturalUtility.delta,
        utilityFields,
        -1,
        1,
        `${label}.naturalUtility.delta`
      );
    }
    if (lane.controlledUtility !== null) {
      validateFieldsInDomain(
        lane.controlledUtility,
        ["expectedFirstHitRate", "forbiddenHitRateAt10"],
        0,
        1,
        `${label}.controlledUtility`
      );
    }
  });
  return value;
}

function validateV2QualityOutput(value) {
  const quality = subject.validateQualityOutput(value);
  return validateQualityNumberDomains(quality);
}

const v2RegressionTestRelativePath =
  "tinyrustlm/tests/vector-portable-affine-u8-benchmark-v2.test.js";
const v2RegressionSchema =
  "tinyrustlm.portable_affine_u8_json_domain_v2_regression_execution.v1";

function validateV2RegressionEvidence(value) {
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
  ], "v2 regression evidence");
  exactValue(value.schema, v2RegressionSchema, "v2 regression schema");
  const testEvidence = fileEvidence(v2RegressionTestRelativePath);
  exactValue(value.testPath, testEvidence.path, "v2 regression test path");
  exactValue(value.testBytes, testEvidence.bytes, "v2 regression test bytes");
  exactValue(value.testSha256, testEvidence.sha256, "v2 regression test hash");
  exactStructure(
    value.nodeArguments,
    ["--test", v2RegressionTestRelativePath],
    "v2 regression arguments"
  );
  exactValue(value.exitCode, 0, "v2 regression exit code");
  exactValue(value.signal, null, "v2 regression signal");
  safeInteger(value.stdoutBytes, "v2 regression stdout bytes", 1);
  exactValue(value.stderrBytes, 0, "v2 regression stderr bytes");
  invariant(
    sha256Pattern.test(value.stdoutSha256) &&
      value.stderrSha256 === emptySha256,
    "v2 regression output identity is invalid"
  );
  exactValue(
    value.outcomeModesInvoked,
    false,
    "v2 regression outcome boundary"
  );
  publicSafe(value, "v2 regression evidence");
  return value;
}

function runV2RegressionSuite() {
  const nodeArguments = ["--test", v2RegressionTestRelativePath];
  const result = childProcess.spawnSync(process.execPath, nodeArguments, {
    cwd: repositoryRoot,
    env: subject.offlineEnvironment(),
    encoding: null,
    windowsHide: true,
    timeout: 300000,
    maxBuffer: maximumEvidenceBytes
  });
  invariant(result.error === undefined, "v2 regression spawn failed");
  const stdout = toBytes(result.stdout);
  const stderr = toBytes(result.stderr);
  const testEvidence = fileEvidence(v2RegressionTestRelativePath);
  return validateV2RegressionEvidence(Object.freeze({
    schema: v2RegressionSchema,
    testPath: testEvidence.path,
    testBytes: testEvidence.bytes,
    testSha256: testEvidence.sha256,
    nodeArguments: Object.freeze(nodeArguments),
    exitCode: result.status,
    signal: result.signal,
    stdoutBytes: stdout.length,
    stdoutSha256: sha256(stdout),
    stderrBytes: stderr.length,
    stderrSha256: sha256(stderr),
    outcomeModesInvoked: false
  }));
}

function observationIdentity(value) {
  return identity(
    value,
    "portable-affine-u8-flat-json-domain-v2-observation",
    "observationId",
    "observationContentHash"
  );
}

function finalizeObservation(value) {
  return finalizeIdentity(
    value,
    "portable-affine-u8-flat-json-domain-v2-observation",
    "observationId",
    "observationContentHash"
  );
}

function validatePhaseEvidence(value, expectedCargoLockSha256) {
  exactKeys(value, [
    "harnessAdapter",
    "v2Regression",
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
  ], "v2 phase evidence");
  validateHarnessAdapterEvidence(value.harnessAdapter);
  validateV2RegressionEvidence(value.v2Regression);
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
  validateV2QualityOutput(value.quality);
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
    "preregistration",
    "implementationCommit",
    "frozenOriginalPreregistration",
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
  ], "v2 observation");
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
  exactValue(value.attemptOrdinal, 1, "observation attempt ordinal");
  exactValue(value.previousAttemptId, null, "observation predecessor");
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
  exactStructure(value.preregistration, {
    path: preregistrationRelativePath,
    sha256: expectedManifestSha256,
    registrationCommit: manifestResult.registrationCommit
  }, "v2 preregistration evidence");
  invariant(
    revisionPattern.test(value.implementationCommit),
    "implementation commit is invalid"
  );
  exactStructure(
    value.frozenOriginalPreregistration,
    {
      path: manifest.subject.frozenOriginalPreregistration.path,
      sha256: manifest.subject.frozenOriginalPreregistration.sha256,
      benchmarkSubjectExperimentId: subject.expectedExperimentId,
      benchmarkSubjectMethodId: subject.expectedMethodId
    },
    "frozen original preregistration evidence"
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
      manifest.subject.externalDataset.revision &&
      value.externalDataset.tree === manifest.subject.externalDataset.tree,
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
    maximumAttemptCount,
    maximumRetryCount,
    completePreregisteredSuiteExecuted: true,
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
  publicSafe(value, "v2 observation");
  return value;
}

function validateObservationFile(filePath = observationPath) {
  const stat = boundedEvidenceFile(filePath, "v2 observation");
  const bytes = fs.readFileSync(filePath);
  const observation = validateObservation(JSON.parse(bytes.toString("utf8")));
  invariant(
    bytes.equals(canonicalPrettyBytes(observation)),
    "v2 observation bytes are not canonical"
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
    "portable-affine-u8-flat-json-domain-v2-attempt",
    "attemptId",
    "attemptContentHash"
  );
}

function finalizeAttempt(value) {
  return finalizeIdentity(
    value,
    "portable-affine-u8-flat-json-domain-v2-attempt",
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
      value.retryAllowed === false &&
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
  ], "v2 attempt");
  exactValue(value.schema, attemptSchema, "attempt schema");
  exactValue(value.experimentId, experimentId, "attempt experimentId");
  exactValue(value.attemptOrdinal, 1, "attempt ordinal");
  exactValue(value.previousAttemptId, null, "attempt predecessor");
  invariant(
    [
      "complete-awaiting-independent-verification",
      "fail-comparison-outcome-terminal",
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
  exactStructure(value.preregistration, {
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
      /^portable-affine-u8-flat-json-domain-v2-observation-[a-f0-9]{16}$/u.test(
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
    exactValue(value.failure.retryAllowed, false, "attempt retry policy");
  }
  exactStructure(value.authority, authority, "attempt authority");
  exactValue(value.requiredNextGate, requiredNextGate, "attempt required next gate");
  const expected = attemptIdentity(value);
  exactValue(value.attemptId, expected.id, "attempt id");
  exactValue(value.attemptContentHash, expected.hash, "attempt content hash");
  publicSafe(value, "v2 attempt");
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
      boundedEvidenceFile(filePath, "v2 attempt");
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
  invariant(
    attempts.length <= maximumAttemptCount,
    "v2 attempt limit exceeded"
  );
  attempts.forEach((entry, index) => {
    exactValue(index, 0, "attempt archive count");
    exactValue(entry.attempt.attemptOrdinal, 1, "attempt archive ordinal");
    exactValue(entry.attempt.previousAttemptId, null, "attempt archive predecessor");
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

function failureEvidence(error, _archive, processLedger) {
  const subjectFailure = subject.boundedFailure(error);
  const classification = [
    "instrumentation",
    "comparison-outcome"
  ].includes(subjectFailure.classification)
    ? subjectFailure.classification
    : "instrumentation";
  const latestBenchmarkError = [...processLedger]
    .reverse()
    .find((record) => record.benchmarkErrorCode !== null)
    ?.benchmarkErrorCode ?? null;
  return Object.freeze({
    code: safeFailureCodePattern.test(subjectFailure.code)
      ? subjectFailure.code
      : "PORTABLE_AFFINE_U8_JSON_DOMAIN_V2_INFRASTRUCTURE_REJECTED",
    classification,
    retryAllowed: false,
    messageSha256: subjectFailure.messageSha256,
    causeMessageSha256: subjectFailure.causeMessageSha256,
    benchmarkErrorCode: latestBenchmarkError
  });
}

function retainedEvidence(state) {
  return Object.freeze({
    harnessAdapter: state.harnessAdapter,
    v2Regression: state.v2Regression,
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
  validateHarnessAdapterEvidence(value.harnessAdapter);
  if (value.v2Regression !== null) {
    validateV2RegressionEvidence(value.v2Regression);
  }
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
    validateV2QualityOutput(value.quality);
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
  validateV2QualityOutput(state.quality);
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
    preregistration: {
      path: preregistrationRelativePath,
      sha256: expectedManifestSha256,
      registrationCommit: manifestResult.registrationCommit
    },
    implementationCommit: implementation,
    frozenOriginalPreregistration: {
      path:
        manifestResult.manifest.subject.frozenOriginalPreregistration.path,
      sha256:
        manifestResult.manifest.subject.frozenOriginalPreregistration.sha256,
      benchmarkSubjectExperimentId: subject.expectedExperimentId,
      benchmarkSubjectMethodId: subject.expectedMethodId
    },
    lineage: manifestResult.manifest.lineage,
    inputs: state.inputs,
    externalDataset: state.externalDataset,
    tools: state.tools,
    platform: state.platform,
    phaseEvidence: {
      harnessAdapter: state.harnessAdapter,
      v2Regression: state.v2Regression,
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
      maximumAttemptCount,
      maximumRetryCount,
      completePreregisteredSuiteExecuted: true,
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
    preregistration: {
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
    harnessAdapter: harnessAdapterEvidence,
    v2Regression: null,
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
      "v2 preregistration is not committed"
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

    phase =
      "v2-regressions-native-tests-clippy-docs-wasm-build-and-execution";
    state.v2Regression = runV2RegressionSuite();
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
    state.quality = validateV2QualityOutput(quality.quality);

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
      "overall v2 observation timeout exceeded"
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
              : "v2 cleanup failed",
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
        code: "PORTABLE_AFFINE_U8_JSON_DOMAIN_V2_CLEANUP_REJECTED",
        classification: "instrumentation",
        retryAllowed: false,
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
        : "fail-instrumentation-terminal",
      startedAtUtc: pending.startedAtUtc,
      completedAtUtc: new Date().toISOString(),
      sourceRevision: pending.sourceRevision,
      preregistration: {
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
    "v2 pending attempt exists; reconcile it explicitly"
  );
  invariant(
    !fs.existsSync(observationPath),
    "v2 observation already exists"
  );
  const archive = loadAttemptArchive();
  exactValue(archive.length, 0, "v2 attempt limit");
  const revision = currentSourceRevision();
  const body = {
    schema: pendingSchema,
    experimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
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
  const message = "pending v2 outcome cannot be reconstructed";
  const failure = Object.freeze({
    code: "PORTABLE_AFFINE_U8_JSON_DOMAIN_V2_OUTCOME_UNKNOWN",
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
    preregistration: {
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
    "usage: node vector-portable-affine-u8-json-domain-v2-observation.js " +
      "--write|--validate|--reconcile-pending"
  );
  const result = argumentsList[0] === "--write"
    ? await runAndWriteObservation()
    : argumentsList[0] === "--reconcile-pending"
      ? reconcilePendingAttempt()
      : (() => {
          const validated = validateCurrentEvidence();
          invariant(validated.archive.length > 0, "v2 attempt is absent");
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
        : "portable affine-u8 json-domain v2 observation failed"}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  adaptFrozenHarness,
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
  frozenHarnessExpectedBytes,
  frozenHarnessExpectedSha256,
  frozenHarnessRevision,
  frozenHarnessRelativePath,
  finalizeAttempt,
  finalizeObservation,
  finalizePendingAttempt,
  inputPaths,
  installProcessRecorder,
  harnessAdapterEvidence,
  loadAttemptArchive,
  loadPendingAttempt,
  maximumAttemptCount,
  maximumBenchmarkProcessCount,
  maximumMonitorProcessCount,
  maximumRetryCount,
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
  runV2RegressionSuite,
  validateAttempt,
  validateCurrentEvidence,
  validateHarnessAdapterEvidence,
  validateObservation,
  validateObservationFile,
  validatePendingAttempt,
  validateQualityNumberDomains,
  validateRunnerPreregistrationBinding,
  validateV2QualityOutput,
  validateV2RegressionEvidence,
  v2RegressionSchema,
  v2RegressionTestRelativePath
});
