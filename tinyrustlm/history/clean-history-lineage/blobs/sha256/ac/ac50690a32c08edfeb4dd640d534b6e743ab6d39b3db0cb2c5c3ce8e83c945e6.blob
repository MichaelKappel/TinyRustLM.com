"use strict";

const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");

const {
  attemptSchema,
  authority,
  benchmarkDescriptor,
  benchmarkSchedule,
  createPendingAttempt,
  expectedManifestSha256,
  experimentId,
  fileEvidence,
  finalizeAttempt,
  finalizePendingAttempt,
  inputPaths,
  installProcessRecorder,
  loadPendingAttempt,
  maximumBenchmarkProcessCount,
  maximumMonitorProcessCount,
  pendingSchema,
  removePendingAttempt,
  requiredNextGate,
  runAfterPendingAttempt,
  validateAttempt,
  validatePendingAttempt
} = require("../tools/vector-portable-affine-u8-successor-observation.js");
const {
  validateManifestFile
} = require("../tools/vector-portable-affine-u8-successor-preregistration.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const runnerPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vector-portable-affine-u8-successor-observation.js"
);

function pendingBody(overrides = {}) {
  return {
    schema: pendingSchema,
    experimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
    startedAtUtc: "2026-07-26T13:00:00.000Z",
    sourceRevision: "a".repeat(40),
    preregistrationSha256: expectedManifestSha256,
    maximumBenchmarkProcessCount,
    maximumMonitorProcessCount,
    benchmarkProcessCountAtJournalWrite: 0,
    monitorProcessCountAtJournalWrite: 0,
    setupStartedAtJournalWrite: false,
    ...overrides
  };
}

function temporaryPendingPath() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-successor-pending-test-")
  );
  return {
    root,
    filePath: path.join(root, "pending.json")
  };
}

function fakeAsyncChild(pid, stdout, stderr, exitCode = 0, signal = null) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  queueMicrotask(() => {
    child.stdout.end(stdout);
    child.stderr.end(stderr);
    child.emit("close", exitCode, signal);
  });
  return child;
}

test("keeps the successor process schedule frozen at 77 plus 60 monitors", () => {
  assert.equal(benchmarkSchedule.length, 77);
  assert.equal(maximumBenchmarkProcessCount, 77);
  assert.equal(maximumMonitorProcessCount, 60);
  assert.deepEqual(
    benchmarkSchedule.slice(0, 17).map((entry) => entry.mode),
    [
      "contract",
      ...Array(7).fill("corruption"),
      "crash",
      "recover",
      "crash",
      "recover",
      "crash",
      "recover",
      "crash",
      "recover",
      "quality"
    ]
  );
  assert.equal(
    benchmarkSchedule.filter((entry) => entry.mode === "performance").length,
    60
  );
  assert.equal(
    benchmarkSchedule.filter((entry) => entry.mode === "quality").length,
    1
  );
});

test("recognizes only registered benchmark modes and public arguments", () => {
  assert.deepEqual(benchmarkDescriptor(["--contract"]), {
    phase: "contract",
    mode: "contract",
    publicArguments: []
  });
  assert.deepEqual(
    benchmarkDescriptor(["--corruption", "header-bit-flip"]),
    {
      phase: "corruption",
      mode: "corruption",
      publicArguments: ["header-bit-flip"]
    }
  );
  assert.equal(benchmarkDescriptor(["--quality", "extra"]), null);
  assert.equal(benchmarkDescriptor(["--unknown"]), null);
  assert.equal(
    benchmarkDescriptor(["--performance", "not-a-lane", "candidate"]),
    null
  );
});

test("writes and reopens pending intent before the setup callback", async () => {
  const temporary = temporaryPendingPath();
  try {
    let callbackObserved = false;
    const result = await runAfterPendingAttempt(
      pendingBody(),
      async (pending) => {
        callbackObserved = true;
        assert.equal(fs.existsSync(temporary.filePath), true);
        const reopened = loadPendingAttempt(temporary.filePath);
        assert.equal(
          reopened.pending.pendingAttemptContentHash,
          pending.pendingAttemptContentHash
        );
        assert.equal(reopened.pending.setupStartedAtJournalWrite, false);
        assert.equal(reopened.pending.benchmarkProcessCountAtJournalWrite, 0);
        return "setup-ran";
      },
      temporary.filePath
    );
    assert.equal(result, "setup-ran");
    assert.equal(callbackObserved, true);
    const pending = loadPendingAttempt(temporary.filePath).pending;
    removePendingAttempt(pending, temporary.filePath);
    assert.equal(fs.existsSync(temporary.filePath), false);
  } finally {
    fs.rmSync(temporary.root, { recursive: true, force: true });
  }
});

test("leaves pending intent recoverable when setup throws", async () => {
  const temporary = temporaryPendingPath();
  try {
    await assert.rejects(
      runAfterPendingAttempt(
        pendingBody(),
        () => {
          assert.equal(fs.existsSync(temporary.filePath), true);
          throw new Error("synthetic setup rejection");
        },
        temporary.filePath
      ),
      /synthetic setup rejection/u
    );
    const pending = loadPendingAttempt(temporary.filePath).pending;
    assert.equal(pending.pendingAttemptId.startsWith(
      "portable-affine-u8-flat-successor-pending-"
    ), true);
    removePendingAttempt(pending, temporary.filePath);
  } finally {
    fs.rmSync(temporary.root, { recursive: true, force: true });
  }
});

test("rejects pending journal mutations and mismatched removal", () => {
  const temporary = temporaryPendingPath();
  try {
    const pending = createPendingAttempt(pendingBody(), temporary.filePath);
    assert.throws(
      () => validatePendingAttempt({
        ...pending,
        setupStartedAtJournalWrite: true
      }),
      /pre-setup boundary/u
    );
    const replacement = finalizePendingAttempt(pendingBody({
      startedAtUtc: "2026-07-26T13:00:01.000Z"
    }));
    assert.throws(
      () => removePendingAttempt(replacement, temporary.filePath),
      /pending removal identity/u
    );
    assert.equal(fs.existsSync(temporary.filePath), true);
    removePendingAttempt(pending, temporary.filePath);
  } finally {
    fs.rmSync(temporary.root, { recursive: true, force: true });
  }
});

test("records benchmark and monitor output identities without retaining output", async () => {
  const originalSpawnSync = function fakeSpawnSync() {
    return {
      pid: 101,
      status: 0,
      signal: null,
      stdout: "{\"schema\":\"contract\"}\n",
      stderr: ""
    };
  };
  let nextPid = 200;
  const originalSpawn = function fakeSpawn(_executable, argumentsList) {
    nextPid += 1;
    return fakeAsyncChild(
      nextPid,
      argumentsList[0] === "--performance"
        ? "{\"schema\":\"performance\"}\n"
        : "",
      ""
    );
  };
  const fakeProcessApi = {
    spawnSync: originalSpawnSync,
    spawn: originalSpawn
  };
  const recorder = installProcessRecorder(fakeProcessApi);
  const contract = fakeProcessApi.spawnSync("benchmark", ["--contract"], {});
  assert.equal(contract.status, 0);
  const performance = fakeProcessApi.spawn(
    "benchmark",
    [
      "--performance",
      "fashion-mnist-euclidean-784",
      "candidate"
    ],
    {}
  );
  const monitor = fakeProcessApi.spawn(
    "powershell",
    [
      "-File",
      "memory-monitor.ps1",
      "-TargetProcessId",
      "201",
      "-ProcessRoot",
      "owned",
      "-OutputPath",
      "result"
    ],
    {}
  );
  await Promise.all([once(performance, "close"), once(monitor, "close")]);
  const snapshot = recorder.snapshot();
  recorder.restore();
  assert.equal(fakeProcessApi.spawnSync, originalSpawnSync);
  assert.equal(fakeProcessApi.spawn, originalSpawn);
  assert.equal(snapshot.benchmarkRecords.length, 2);
  assert.equal(snapshot.monitorRecords.length, 1);
  assert.equal(snapshot.maximumParallelBenchmarkProcesses, 1);
  assert.deepEqual(
    snapshot.benchmarkRecords.map((record) => record.mode),
    ["contract", "performance"]
  );
  assert.equal(snapshot.benchmarkRecords[0].stdoutBytes > 0, true);
  assert.match(snapshot.benchmarkRecords[0].stdoutSha256, /^[a-f0-9]{64}$/u);
  assert.equal("stdout" in snapshot.benchmarkRecords[0], false);
  assert.equal("stderr" in snapshot.benchmarkRecords[0], false);
  assert.equal(snapshot.monitorRecords[0].stdoutBytes, 0);
});

test("does not count ordinary setup and build process invocations", () => {
  let calls = 0;
  const fakeProcessApi = {
    spawnSync() {
      calls += 1;
      return {
        pid: 1,
        status: 0,
        signal: null,
        stdout: "cargo 1.0\n",
        stderr: ""
      };
    },
    spawn() {
      throw new Error("unexpected async invocation");
    }
  };
  const recorder = installProcessRecorder(fakeProcessApi);
  fakeProcessApi.spawnSync("cargo", ["--version"], {});
  const snapshot = recorder.snapshot();
  recorder.restore();
  assert.equal(calls, 1);
  assert.deepEqual(snapshot.benchmarkRecords, []);
  assert.deepEqual(snapshot.monitorRecords, []);
});

test("validates an interrupted pending attempt without inventing process evidence", () => {
  const pending = finalizePendingAttempt(pendingBody());
  const attempt = finalizeAttempt({
    schema: attemptSchema,
    experimentId,
    attemptOrdinal: 1,
    previousAttemptId: null,
    status: "fail-unknown-outcome-terminal",
    startedAtUtc: pending.startedAtUtc,
    completedAtUtc: "2026-07-26T13:00:02.000Z",
    sourceRevision: pending.sourceRevision,
    successorPreregistration: {
      path:
        "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-flat-successor-preregistration.v1.json",
      sha256: expectedManifestSha256,
      registrationCommit: "294d3187b927508759ad342d57a5021a6dff680e"
    },
    implementationCommit: "b".repeat(40),
    pendingAttemptId: pending.pendingAttemptId,
    pendingAttemptContentHash: pending.pendingAttemptContentHash,
    lastPhase: "unknown-after-interruption",
    benchmarkProcessLedger: [],
    memoryMonitorProcessLedger: [],
    maximumParallelBenchmarkProcesses: 0,
    inputs: inputPaths.map(fileEvidence),
    retainedEvidence: null,
    cleanup: {
      outerRootCreated: false,
      outerRootDeleted: false,
      cleanupFailureMessageSha256: null
    },
    observationId: null,
    observationContentHash: null,
    failure: {
      code: "PORTABLE_AFFINE_U8_SUCCESSOR_OUTCOME_UNKNOWN",
      classification: "unknown-outcome",
      retryAllowed: false,
      messageSha256: "c".repeat(64),
      causeMessageSha256: "c".repeat(64),
      benchmarkErrorCode: null
    },
    processEvidenceComplete: false,
    authority,
    requiredNextGate
  });
  assert.equal(validateAttempt(attempt), attempt);
  assert.throws(
    () => validateAttempt({
      ...attempt,
      rawStdout: "not permitted"
    }),
    /fields are invalid/u
  );
  assert.throws(
    () => validateAttempt(finalizeAttempt({
      ...attempt,
      authority: {
        ...authority,
        campaignCounterMayBeIncremented: true
      },
      attemptId: undefined,
      attemptContentHash: undefined
    })),
    /attempt authority/u
  );
});

test("keeps terminal experiment writers outside the successor execution path", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.doesNotMatch(source, /subject\.runAndWriteObservation/u);
  assert.doesNotMatch(source, /subject\.generateObservation/u);
  assert.doesNotMatch(
    source,
    /portable-affine-u8-flat-pending-attempt-v1\.json/u
  );
  assert.doesNotMatch(
    source,
    /portable-affine-u8-flat-attempts\/sha256/u
  );
  assert.match(
    source,
    /portable-affine-u8-flat-successor-pending-attempt-v1\.json/u
  );
  const runOffset = source.indexOf("return runAfterPendingAttempt(body");
  const executionOffset = source.indexOf("async function executeAttempt");
  assert.notEqual(runOffset, -1);
  assert.notEqual(executionOffset, -1);
});

test("retains the committed successor preregistration as authority", () => {
  const result = validateManifestFile();
  assert.equal(result.sha256, expectedManifestSha256);
  assert.match(result.registrationCommit, /^[a-f0-9]{40}$/u);
  assert.equal(
    result.manifest.fullExecution.maximumBenchmarkProcessCountOnCompleteRun,
    77
  );
  assert.equal(
    result.manifest.fullExecution.maximumMemoryMonitorProcessCountOnCompleteRun,
    60
  );
});
