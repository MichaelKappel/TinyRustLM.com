"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const owner = require("../tools/qwen3-numerical-execution-owner.js");

const ZERO_SHA = "0".repeat(64);
const TRACE_PROFILE_ID = "tinyrustlm.scalar-full-stage-f32le/1";

function tokenDigest(tokenIds) {
  const bytes = Buffer.alloc(tokenIds.length * 4);
  tokenIds.forEach((token, index) => bytes.writeUInt32LE(token, index * 4));
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function artifact(role, relativePath) {
  return { role, relativePath, byteLength: 1, sha256: ZERO_SHA };
}

function threshold() {
  return {
    maximumAbsoluteError: 0,
    maximumRelativeError: 0,
    maximumNormalizedRmse: 0,
    minimumCosineSimilarity: 1,
    maximumSignDisagreementRate: 0,
    maximumUlp: 0
  };
}

function ownerContract() {
  const operationId = "qwen3-numerical-c1899de-test-20260826-v2";
  return {
    schema: owner.OWNER_CONTRACT_SCHEMA,
    operationId,
    traceProfileId: TRACE_PROFILE_ID,
    implementationArtifacts: [
      artifact("execution-owner", "tinyrustlm/tools/qwen3-numerical-execution-owner.js"),
      artifact("differential-profile", "contracts/vnext/differential.json"),
      artifact("environment-authority", "tinyrustlm/tools/environment.py"),
      artifact("environment-lock", "contracts/vnext/environment.json"),
      artifact("source-owner", "tinyrustlm/tools/source.py"),
      artifact("reconstructed-owner", "tinyrustlm/tools/reconstructed.py"),
      artifact("scalar-source", "rust/crates/probe/src/main.rs"),
      artifact("scalar-profile", "contracts/vnext/scalar.json"),
      artifact("verifier", "tinyrustlm/tools/verifier.js"),
      artifact("source-lock", "contracts/vnext/source-lock.json"),
      artifact("composition-result", "contracts/vnext/composition-result.json")
    ],
    executables: {
      git: { basename: "git.exe", byteLength: 1, sha256: ZERO_SHA },
      python: { basename: "python.exe", byteLength: 1, sha256: ZERO_SHA },
      node: { basename: "node.exe", byteLength: 1, sha256: ZERO_SHA },
      scalar: { basename: "scalar.exe", byteLength: 1, sha256: ZERO_SHA },
      termination: { basename: "taskkill.exe", byteLength: 1, sha256: ZERO_SHA }
    },
    cases: [
      { id: "single-low-token", tokenIds: [3], tokenIdsLeU32Sha256: tokenDigest([3]) },
      { id: "repeated-cache-token", tokenIds: [17, 17],
        tokenIdsLeU32Sha256: tokenDigest([17, 17]) }
    ],
    requests: {
      source: {
        schema: "tinyrustlm.qwen3_numerical_source_request.v2",
        sourceLock: { relativePath: "contracts/vnext/source-lock.json", byteLength: 1,
          sha256: ZERO_SHA },
        framework: {
          accelerateVersion: "1.14.0",
          attentionImplementation: "eager",
          deterministicAlgorithms: true,
          device: "cpu",
          dtype: "float32",
          environmentAuthority: {
            relativePath: "tinyrustlm/tools/environment.py",
            byteLength: 1,
            sha256: ZERO_SHA
          },
          environmentLock: {
            relativePath: "contracts/vnext/environment.json",
            byteLength: 1,
            sha256: ZERO_SHA
          },
          interopThreads: 1,
          intraopThreads: 1,
          localFilesOnly: true,
          networkAllowed: false,
          numpyVersion: "2.2.5",
          psutilVersion: "7.2.2",
          pythonVersion: "3.12.10",
          safetensorsVersion: "0.5.3",
          tokenizersVersion: "0.21.1",
          torchVersion: "2.7.0",
          transformersVersion: "4.51.0"
        },
        policy: { maximumCases: 2 }
      },
      reconstructed: {
        schema: "tinyrustlm.qwen3_slm2_reconstructed_request.v1",
        compositionResultSha256: ZERO_SHA,
        model: { fileName: "model.slm2", byteLength: 1, sha256: ZERO_SHA },
        implementation: { pythonVersion: "3.12.10" },
        modelSpec: { layerCount: 28 },
        policy: { maximumCases: 2 }
      },
      scalar: {
        schema: "tinyrustlm.scalar-numerical-probe-request.v1",
        compositionResultSha256: ZERO_SHA,
        model: { fileName: "model.slm2", byteLength: 1, sha256: ZERO_SHA },
        policy: { maximumCases: 2 }
      },
      verification: {
        schema: "tinyrustlm.qwen3_numerical_trace_verification_request.v1",
        differentialProfile: { relativePath: "contracts/vnext/differential.json",
          byteLength: 1, sha256: ZERO_SHA },
        comparison: {
          chunkElements: 1024,
          relativeFloor: 1e-6,
          signFloor: 1e-6,
          topK: 10,
          arrows: [
            { id: "source-to-reconstructed", reference: "source",
              candidate: "reconstructed", requireGreedyTokenIdentity: false,
              minimumTopKOverlap: 0.5,
              thresholds: { default: threshold(), stages: {} } },
            { id: "reconstructed-to-scalar", reference: "reconstructed",
              candidate: "scalar", requireGreedyTokenIdentity: true,
              minimumTopKOverlap: 1,
              thresholds: { default: threshold(), stages: {} } }
          ]
        },
        policy: { maximumCases: 2 }
      }
    },
    processPolicy: {
      maximumDurationMilliseconds: {
        source: 1000,
        reconstructed: 1000,
        scalar: 1000,
        verifier: 1000
      },
      maximumStdoutBytes: 4096,
      maximumStderrBytes: 4096,
      launchLimitPerStage: 1,
      retryAllowed: false,
      overwriteAllowed: false,
      repairAllowed: false,
      continueAfterFailedStage: false
    },
    privateNames: {
      ownerRequestFileBasename: `${operationId}-owner-request.json`,
      ownerEvidenceRootBasename: `${operationId}-owner-evidence`,
      sourceScratchRootBasename: `${operationId}-source-scratch`,
      sourceOutputRootBasename: `${operationId}-source`,
      reconstructedOutputRootBasename: `${operationId}-reconstructed`,
      scalarOutputRootBasename: `${operationId}-scalar`
    },
    evidenceFiles: {
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
    },
    terminalPolicy: {
      successStatus: "terminal-pass",
      rejectionStatus: "terminal-rejected",
      failureStatus: "terminal-failure",
      ambiguousStatus: "terminal-ambiguous",
      secondInvocationAllowed: false,
      partialOutputCleanupAllowed: false,
      evidenceOverwriteAllowed: false,
      thresholdChangeAfterLaunchAllowed: false
    }
  };
}

function registration() {
  return {
    schema: owner.REGISTRATION_SCHEMA,
    profileId: "tinyrustlm.qwen3-numerical-differential-execution/2",
    status: "registered-before-private-request-roots-and-real-traces",
    registeredAtUtc: "2026-08-26T12:00:00Z",
    registrationParentCommit: "1".repeat(40),
    registrationParentTree: "2".repeat(40),
    authority: {},
    sourceAnchor: {
      branch: "codex/model-acquisition-v2",
      parentCommit: "1".repeat(40),
      parentTree: "2".repeat(40),
      allowedRegistrationCommitPaths: [
        "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json"
      ],
      cleanAtRegistration: true,
      trackingFetchHeadAndRemoteExactAtRegistration: true
    },
    reportLineage: {},
    implementationCheckpoint: {},
    candidate: {},
    ownerContract: ownerContract(),
    outputBoundary: {},
    claimBoundary: {},
    campaignCounters: {}
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-numerical-owner-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("canonical JSON is recursively sorted, UTF-8, and LF terminated", () => {
  const bytes = owner.canonicalJsonBytes({ z: 1, a: { y: 2, b: 3 } });
  assert.equal(bytes.toString("utf8"), [
    "{",
    '  "a": {',
    '    "b": 3,',
    '    "y": 2',
    "  },",
    '  "z": 1',
    "}",
    ""
  ].join("\n"));
});

test("accepts the one clean owner contract and registration shape", () => {
  assert.equal(owner.validateOwnerContract(ownerContract()).schema,
    owner.OWNER_CONTRACT_SCHEMA);
  assert.equal(owner.validateRegistration(registration()).schema,
    owner.REGISTRATION_SCHEMA);
});

test("rejects the closed v1 owner, registration, request, and source-template semantics", () => {
  assert.equal(owner.REGISTRATION_RELATIVE_PATH,
    "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json");
  assert.equal(owner.REQUEST_SCHEMA, "tinyrustlm.qwen3_numerical_execution_request.v2");

  const formerOwner = ownerContract();
  formerOwner.schema = "tinyrustlm.qwen3_numerical_execution_owner_contract.v1";
  assert.throws(() => owner.validateOwnerContract(formerOwner),
    /numerical-execution-owner-contract/u);

  const formerRegistration = registration();
  formerRegistration.schema =
    "tinyrustlm.qwen3_numerical_differential_execution_preregistration.v1";
  assert.throws(() => owner.validateRegistration(formerRegistration),
    /numerical-execution-registration-identity/u);

  const formerProfile = registration();
  formerProfile.profileId = "tinyrustlm.qwen3-numerical-differential-execution/1";
  assert.throws(() => owner.validateRegistration(formerProfile),
    /numerical-execution-registration-identity/u);

  const formerSource = ownerContract();
  formerSource.requests.source.schema = "tinyrustlm.qwen3_numerical_source_request.v1";
  assert.throws(() => owner.validateOwnerContract(formerSource),
    /numerical-execution-source-template/u);
});

test("requires the exact corrected source-framework closure", () => {
  const missingAccelerate = ownerContract();
  delete missingAccelerate.requests.source.framework.accelerateVersion;
  assert.throws(() => owner.validateOwnerContract(missingAccelerate),
    /numerical-execution-source-framework/u);

  const wrongPsutil = ownerContract();
  wrongPsutil.requests.source.framework.psutilVersion = "7.2.1";
  assert.throws(() => owner.validateOwnerContract(wrongPsutil),
    /numerical-execution-source-framework/u);

  const networkEnabled = ownerContract();
  networkEnabled.requests.source.framework.networkAllowed = true;
  assert.throws(() => owner.validateOwnerContract(networkEnabled),
    /numerical-execution-source-framework/u);
});

test("rejects token digest drift, retries, duplicate private names, and unknown fields", () => {
  const digestDrift = ownerContract();
  digestDrift.cases[0].tokenIdsLeU32Sha256 = "f".repeat(64);
  assert.throws(() => owner.validateOwnerContract(digestDrift),
    /numerical-execution-case-digest/u);

  const retry = ownerContract();
  retry.processPolicy.retryAllowed = true;
  assert.throws(() => owner.validateOwnerContract(retry),
    /numerical-execution-process-policy/u);

  const duplicate = ownerContract();
  duplicate.privateNames.scalarOutputRootBasename =
    duplicate.privateNames.sourceOutputRootBasename;
  assert.throws(() => owner.validateOwnerContract(duplicate),
    /numerical-execution-private-name-duplicate/u);

  const unknown = ownerContract();
  unknown.compatibility = true;
  assert.throws(() => owner.validateOwnerContract(unknown),
    /numerical-execution-owner-contract/u);
});

test("rejects missing implementation roles and permissive terminal policy", () => {
  const missingRole = ownerContract();
  missingRole.implementationArtifacts.pop();
  assert.throws(() => owner.validateOwnerContract(missingRole),
    /numerical-execution-implementation-artifacts/u);

  const cleanup = ownerContract();
  cleanup.terminalPolicy.partialOutputCleanupAllowed = true;
  assert.throws(() => owner.validateOwnerContract(cleanup),
    /numerical-execution-terminal-policy/u);
});

test("derives all child requests from one registration without prompt or answer fields", () => {
  const contract = ownerContract();
  const state = {
    registration: { ownerContract: contract },
    registrationIdentity: { byteLength: 123, sha256: "a".repeat(64) },
    sourceDirectory: "E:\\source",
    compositionRoot: "E:\\composition",
    evidenceParent: "E:\\evidence"
  };
  const paths = {
    sourceScratchRoot: "E:\\evidence\\source-scratch",
    sourceOutputRoot: "E:\\evidence\\source",
    reconstructedOutputRoot: "E:\\evidence\\reconstructed",
    scalarOutputRoot: "E:\\evidence\\scalar"
  };
  const requests = owner.childRequests(state, paths);
  assert.deepEqual(requests.source.cases, [
    { id: "single-low-token", tokenIds: [3] },
    { id: "repeated-cache-token", tokenIds: [17, 17] }
  ]);
  assert.equal(requests.source.registrationSha256, "a".repeat(64));
  assert.equal(requests.reconstructed.compositionRoot, "E:\\composition");
  assert.equal(requests.scalar.outputRoot, "E:\\evidence\\scalar");
  assert.equal(requests.verification.bundles.source.rootBasename, "source");
  const serialized = JSON.stringify(requests);
  assert.equal(/prompt|expected.?answer/iu.test(serialized), false);
});

test("captured process records a clean pass and does not overwrite streams", async (t) => {
  const root = temporaryRoot(t);
  const script = path.join(root, "pass.js");
  fs.writeFileSync(script, 'process.stdout.write("pass\\n");\n', { flag: "wx" });
  const stdoutPath = path.join(root, "stdout.bin");
  const stderrPath = path.join(root, "stderr.bin");
  const outcome = await owner.runCapturedProcess(process.execPath, [script], {
    stage: "source",
    workingDirectory: root,
    stdoutPath,
    stderrPath,
    maximumStdoutBytes: 64,
    maximumStderrBytes: 64,
    maximumDurationMilliseconds: 5000,
    terminationPath: process.platform === "win32"
      ? path.join(process.env.SystemRoot, "System32", "taskkill.exe") : process.execPath
  });
  assert.equal(owner.processPassed(outcome), true);
  assert.equal(fs.readFileSync(stdoutPath, "utf8"), "pass\n");
  assert.equal(outcome.stdout.byteLength, 5);
  assert.equal(outcome.stderr.byteLength, 0);
  await assert.rejects(owner.runCapturedProcess(process.execPath, [script], {
    stage: "source",
    workingDirectory: root,
    stdoutPath,
    stderrPath: path.join(root, "stderr-2.bin"),
    maximumStdoutBytes: 64,
    maximumStderrBytes: 64,
    maximumDurationMilliseconds: 5000,
    terminationPath: process.execPath
  }), /EEXIST/u);
});

test("stderr, overflow, and timeout cannot be classified as process pass", async (t) => {
  const root = temporaryRoot(t);
  const taskkill = process.platform === "win32"
    ? path.join(process.env.SystemRoot, "System32", "taskkill.exe") : process.execPath;
  const cases = [
    { name: "stderr", source: 'process.stderr.write("warning\\n");\n', stdout: 64,
      timeout: 5000, field: "stderr" },
    { name: "overflow", source: 'process.stdout.write("x".repeat(1024));\n', stdout: 8,
      timeout: 5000, field: "killedForOverflow" },
    { name: "timeout", source: "setInterval(() => {}, 1000);\n", stdout: 64,
      timeout: 50, field: "timedOut" }
  ];
  for (const item of cases) {
    const script = path.join(root, `${item.name}.js`);
    fs.writeFileSync(script, item.source, { flag: "wx" });
    const outcome = await owner.runCapturedProcess(process.execPath, [script], {
      stage: "source",
      workingDirectory: root,
      stdoutPath: path.join(root, `${item.name}.stdout.bin`),
      stderrPath: path.join(root, `${item.name}.stderr.bin`),
      maximumStdoutBytes: item.stdout,
      maximumStderrBytes: 64,
      maximumDurationMilliseconds: item.timeout,
      terminationPath: taskkill
    });
    assert.equal(owner.processPassed(outcome), false, item.name);
    if (item.field === "stderr") assert.ok(outcome.stderr.byteLength > 0);
    else assert.equal(outcome[item.field], true, item.name);
  }
});

test("process terminal binds one launch and immutable failure rules", () => {
  const executable = { byteLength: 10, sha256: "b".repeat(64) };
  const outcome = {
    processStarted: true,
    exitCode: 0,
    signal: null,
    timedOut: false,
    killedForOverflow: false,
    spawnCode: null,
    stdout: { byteLength: 1, sha256: ZERO_SHA, overflow: false },
    stderr: { byteLength: 0, sha256: ZERO_SHA, overflow: false }
  };
  const terminal = owner.createProcessTerminal("operation", "source", executable,
    executable, ["request.json"], outcome);
  assert.equal(terminal.launchOrdinal, 1);
  assert.equal(terminal.launchCountLimit, 1);
  assert.equal(terminal.executableUnchanged, true);
  assert.equal(terminal.retryAllowed, false);
  assert.equal(terminal.overwriteAllowed, false);
  assert.equal(terminal.repairAllowed, false);
});
