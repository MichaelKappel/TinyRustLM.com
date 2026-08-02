"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  attemptIdentity,
  attemptSchema,
  authority,
  diagnosticExecutionClosed,
  diagnoseExecution,
  emptySha256,
  executableIdentityPath,
  expectedStageNames,
  finalizeAttempt,
  processEvidence,
  requiredNextGate,
  validateAttempt
} = require("../tools/vector-portable-affine-u8-quality-diagnostic.js");
const {
  validateManifestFile
} = require(
  "../tools/vector-portable-affine-u8-quality-diagnostic-preregistration.js"
);

const manifest = validateManifestFile().manifest;

function execution(overrides = {}) {
  return {
    invocationCount: 1,
    processStarted: true,
    exitCode: 0,
    signal: null,
    timedOut: false,
    outputBoundExceeded: false,
    spawnErrorCode: null,
    stdout: Buffer.from("{}\n", "utf8"),
    stderr: Buffer.alloc(0),
    ...overrides
  };
}

function topLevelFixture() {
  return {
    schema: "tinyrustlm.portable_affine_u8_quality_process.v1",
    experimentId: "portable-affine-u8-flat-20260726",
    qualityProcessOrdinal: 1,
    datasetName: "Fashion-MNIST",
    datasetRevision: "b2617bb6d3ffa2e429640350f613e3291e10b141",
    selectionAlgorithm: "sha256-seed-split-label-index-smallest-v1",
    selectionSha256:
      "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd",
    topKValues: [1, 10, 100],
    laneResults: Array.from({ length: 6 }, () => ({})),
    perQueryMetrics: Array.from({ length: 790 }, () => ({}))
  };
}

function validAttemptBody() {
  const process = processEvidence(execution({
    exitCode: 1,
    stdout: Buffer.alloc(0),
    stderr: Buffer.from("candidate-byte-accounting-invalid\n", "utf8")
  }));
  const diagnosis = diagnoseExecution(execution({
    exitCode: 1,
    stdout: Buffer.alloc(0),
    stderr: Buffer.from("candidate-byte-accounting-invalid\n", "utf8")
  }), manifest);
  return {
    schema: attemptSchema,
    diagnosticId: "portable-affine-u8-quality-diagnostic-20260726",
    attemptOrdinal: 1,
    status: diagnosis.status,
    startedAtUtc: "2026-07-26T12:00:00.000Z",
    completedAtUtc: "2026-07-26T12:00:01.000Z",
    reconciledAtUtc: null,
    originalInvocationTimeAvailable: true,
    sourceRevision: "1".repeat(40),
    preregistration: {
      path:
        "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-quality-diagnostic-preregistration.v1.json",
      sha256:
        "3932e21b3ea171d5798e5abf034931069e66f932ef11abdaa68c8d9326ae5fe1",
      registrationCommit: "2".repeat(40)
    },
    terminalVerification: {
      path:
        "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-flat-verification-v1.json",
      sha256:
        "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b",
      receiptId: "portable-affine-u8-flat-verification-b72cb93ab3e2aa85",
      status: "verified-terminal-no-observation"
    },
    inputs: require(
      "../tools/vector-portable-affine-u8-quality-diagnostic.js"
    ).inputPaths.map((inputPath) => ({
      path: inputPath,
      bytes: 1,
      sha256: "3".repeat(64)
    })),
    platform: {
      os: "windows",
      architecture: "x86_64",
      runtimeIdentifier: "win-x64"
    },
    tools: {
      node: {
        name: "node",
        version: "v24.0.0",
        binaryBytes: 1,
        binarySha256: "4".repeat(64)
      },
      cargo: {
        name: "cargo",
        version: "cargo 1.90.0",
        binaryBytes: 1,
        binarySha256: "5".repeat(64)
      },
      rustc: {
        name: "rustc",
        version: "rustc 1.90.0",
        binaryBytes: 1,
        binarySha256: "6".repeat(64)
      }
    },
    externalDataset: {
      sourceRepository: "https://github.com/zalandoresearch/fashion-mnist.git",
      revision: "b2617bb6d3ffa2e429640350f613e3291e10b141",
      tree: "ec8d5e52c0b9b2b09ea3f9d36b7bfafaf8ec0e97",
      selectionSha256:
        "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd",
      checkoutClean: true,
      locatorPersisted: false,
      payloadBytesPersisted: false,
      files: Array.from({ length: 4 }, (_, index) => ({ ordinal: index + 1 }))
    },
    build: null,
    processExecution: process,
    diagnosis,
    cleanup: {
      outerRootCreated: true,
      outerRootDeleted: true,
      cleanupFailureMessageSha256: null
    },
    operationalFailure: null,
    reconciliation: null,
    authority,
    requiredNextGate
  };
}

test("classifies process exit before stderr and retains only a safe error code", () => {
  const result = diagnoseExecution(execution({
    exitCode: 1,
    stdout: Buffer.alloc(0),
    stderr: Buffer.from("candidate-byte-accounting-invalid\n", "utf8")
  }), manifest);
  assert.equal(result.status, "diagnosed-process-rejection");
  assert.equal(result.firstFailingStage, "exit-and-signal");
  assert.deepEqual(result.passedStages, expectedStageNames.slice(0, 2));
  assert.equal(result.benchmarkErrorCode, "candidate-byte-accounting-invalid");
  assert.equal("stdout" in result, false);
  assert.equal("stderr" in result, false);
});

test("classifies resource, stderr, framing, parse, and canonical failures in order", () => {
  assert.equal(
    diagnoseExecution(execution({ timedOut: true }), manifest).firstFailingStage,
    "timeout-or-output-bound"
  );
  assert.equal(
    diagnoseExecution(execution({ stderr: Buffer.from("notice\n") }), manifest)
      .firstFailingStage,
    "stderr-contract"
  );
  assert.equal(
    diagnoseExecution(execution({ stdout: Buffer.from("{}") }), manifest)
      .firstFailingStage,
    "stdout-framing"
  );
  assert.equal(
    diagnoseExecution(execution({ stdout: Buffer.from("{]\n") }), manifest)
      .firstFailingStage,
    "json-parse"
  );
  assert.equal(
    diagnoseExecution(execution({ stdout: Buffer.from("{ \"x\": 1 }\n") }), manifest)
      .firstFailingStage,
    "canonical-compact-json"
  );
});

test("separates top-level contract failure from per-query semantic shape failure", () => {
  const topLevel = diagnoseExecution(execution(), manifest);
  assert.equal(topLevel.firstFailingStage, "top-level-contract");

  const fixture = topLevelFixture();
  const semantic = diagnoseExecution(execution({
    stdout: Buffer.from(`${JSON.stringify(fixture)}\n`, "utf8")
  }), manifest);
  assert.equal(semantic.firstFailingStage, "per-query-or-aggregate-semantics");
  assert.equal(semantic.structuralSummary.laneCount, 6);
  assert.equal(semantic.structuralSummary.queryCount, 790);
  assert.equal("laneResults" in semantic.structuralSummary, false);
  assert.equal("perQueryMetrics" in semantic.structuralSummary, false);
});

test("process evidence stores hashes and sizes but not raw output", () => {
  const evidence = processEvidence(execution({
    stdout: Buffer.from("public output\n"),
    stderr: Buffer.from("public error\n")
  }));
  assert.equal(evidence.stdoutBytes, 14);
  assert.equal(evidence.stderrBytes, 13);
  assert.match(evidence.stdoutSha256, /^[a-f0-9]{64}$/u);
  assert.match(evidence.stderrSha256, /^[a-f0-9]{64}$/u);
  assert.equal("stdout" in evidence, false);
  assert.equal("stderr" in evidence, false);
  assert.notEqual(evidence.stdoutSha256, emptySha256);
});

test("attempt identity is deterministic and excludes its identity fields", () => {
  const body = validAttemptBody();
  const first = finalizeAttempt(body);
  const second = finalizeAttempt(body);
  assert.deepEqual(first, second);
  assert.deepEqual(attemptIdentity(first), {
    id: first.attemptId,
    hash: first.attemptContentHash
  });
  validateAttempt(first);
});

test("attempt validation rejects authority, a second invocation, and raw fields", () => {
  const authorityDrift = structuredClone(finalizeAttempt(validAttemptBody()));
  authorityDrift.authority.qualityMayBeClaimed = true;
  assert.throws(
    () => validateAttempt(authorityDrift),
    /attempt authority is invalid/u
  );

  const second = structuredClone(finalizeAttempt(validAttemptBody()));
  second.processExecution.invocationCount = 2;
  assert.throws(
    () => validateAttempt(second),
    /process invocation count is invalid/u
  );

  const raw = structuredClone(finalizeAttempt(validAttemptBody()));
  raw.processExecution.stdout = "raw";
  assert.throws(
    () => validateAttempt(raw),
    /processExecution fields are invalid/u
  );
});

test("resolves a symbolic-link launcher to its bounded executable target", () => {
  const regular = {
    isFile: () => true,
    isSymbolicLink: () => false
  };
  const symbolic = {
    isFile: () => false,
    isSymbolicLink: () => true
  };
  assert.equal(
    executableIdentityPath("regular.exe", {
      lstat: () => regular,
      realpath: () => {
        throw new Error("regular executable must not resolve a target");
      }
    }),
    "regular.exe"
  );
  assert.equal(
    executableIdentityPath("launcher.exe", {
      lstat: () => symbolic,
      realpath: () => "target.exe"
    }),
    "target.exe"
  );
});

test("validates a reconciled pre-journal failure with zero benchmark processes", () => {
  const body = validAttemptBody();
  body.status = "diagnostic-infrastructure-failure";
  body.startedAtUtc = null;
  body.completedAtUtc = null;
  body.reconciledAtUtc = "2026-07-26T12:10:00.000Z";
  body.originalInvocationTimeAvailable = false;
  body.sourceRevision = "f7fb3d220559bfa9a6746e00db451ccb91f3ef14";
  body.processExecution = {
    benchmarkMode: "--quality",
    invocationCount: 0,
    processStarted: false,
    exitCode: null,
    signal: null,
    timedOut: false,
    outputBoundExceeded: false,
    spawnErrorCode: null,
    stdoutBytes: 0,
    stdoutSha256: emptySha256,
    stderrBytes: 0,
    stderrSha256: emptySha256
  };
  body.diagnosis = {
    status: "diagnostic-infrastructure-failure",
    passedStages: [],
    firstFailingStage: "spawn",
    failureCode: "AFFINE_U8_QUALITY_DIAGNOSTIC_SETUP_REJECTED",
    failureMessageSha256:
      "577f26a3721ea49b61e77661d6310ea7c9cdae9766edbc338efdb6809892f3fe",
    benchmarkErrorCode: null,
    structuralSummary: null
  };
  body.cleanup = {
    outerRootCreated: false,
    outerRootDeleted: false,
    cleanupFailureMessageSha256: null
  };
  body.operationalFailure = {
    code: "AFFINE_U8_QUALITY_DIAGNOSTIC_PREJOURNAL_SETUP_REJECTED",
    messageSha256:
      "577f26a3721ea49b61e77661d6310ea7c9cdae9766edbc338efdb6809892f3fe"
  };
  body.reconciliation = {
    originalInvocationSourceRevision:
      "f7fb3d220559bfa9a6746e00db451ccb91f3ef14",
    originalInvocationTimeAvailable: false,
    wrapperExitCode: 1,
    wrapperStdoutBytes: 0,
    wrapperStdoutSha256: emptySha256,
    wrapperStderrBytes: 47,
    wrapperStderrSha256:
      "a3d4787eb189df76c1e8acc2b38f93fdc0a41d0c31b043628c87ef2fe1b0369c",
    benchmarkProcessInvocationCount: 0,
    toolAndDatasetEvidenceCollectedDuringReconciliation: true
  };
  validateAttempt(finalizeAttempt(body));
});

test("runner is terminal and cannot evaluate thresholds or write observation", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../tools/vector-portable-affine-u8-quality-diagnostic.js"
    ),
    "utf8"
  );
  assert.equal(source.includes("evaluateQualityThresholds"), false);
  assert.equal(source.includes("evaluatePerformanceThresholds"), false);
  assert.equal(source.includes("runAndWriteObservation"), false);
  assert.equal(source.includes("portable-affine-u8-flat-observation-v1.json"), false);
  assert.match(source, /spawnSync\(binaryPath, \["--quality"\]/u);
  assert.equal(source.includes('"--write"'), false);
  assert.equal(diagnosticExecutionClosed, true);
});
