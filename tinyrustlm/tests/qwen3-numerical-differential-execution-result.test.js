"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultRelativePath =
  "contracts/vnext/qwen3-numerical-differential-execution-result.v1.json";
const registrationRelativePath =
  "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v1.json";
const memoryRelativePath =
  "wiki/runtime-mirust/reports/" +
  "tinyrustlm-qwen3-numerical-execution-terminal-memory-2026-08-26.md";
const resultBytes = fs.readFileSync(path.join(repositoryRoot, resultRelativePath));
const resultText = resultBytes.toString("utf8");
const result = JSON.parse(resultText);
const registrationBytes = fs.readFileSync(path.join(repositoryRoot,
  registrationRelativePath));
const memoryBytes = fs.readFileSync(path.join(repositoryRoot, memoryRelativePath));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitText(argumentsList) {
  return childProcess.execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
}

test("freezes one bounded numerical source-process terminal result", () => {
  assert.equal(resultBytes.length, 9163);
  assert.equal(sha256(resultBytes),
    "a751ef6f6b436f84a18a02483b718cf90efdb872d5546cb0ee70ae0ec8fbaa2d");
  assert.equal(result.schema,
    "tinyrustlm.qwen3-numerical-differential-execution-result.v1");
  assert.equal(result.profileId,
    "tinyrustlm.qwen3-numerical-differential-execution/1");
  assert.equal(result.operationId,
    "qwen3-numerical-c1899de-aece952-20260826-v1");
  assert.equal(result.status, "terminal-source-process-failure");
  assert.equal(result.recordedAtUtc, "2026-08-26T13:28:30.968Z");
  assert.equal(resultText.includes("\r"), false);
});

test("binds the exact remote registration and report-derived authority", () => {
  assert.equal(registrationBytes.length, 24467);
  assert.equal(sha256(registrationBytes),
    "469e003e6f50cb3e4bb0574e2bd72c5836edb938eea0345ca1a23b4bfc9906a1");
  assert.equal(result.registration.profilePath, registrationRelativePath);
  assert.equal(result.registration.profileByteLength, registrationBytes.length);
  assert.equal(result.registration.profileSha256, sha256(registrationBytes));
  assert.equal(result.registration.parentCommit,
    "aece952422313fce4f55e04bf5f6a4d628d9c8a1");
  assert.equal(result.registration.parentTree,
    "ecf22c16582e42336120809b95f4101a228bdddb");
  assert.equal(result.registration.commit,
    "1fbc78e2257089896aef79266d66c23ce8e7b4ee");
  assert.equal(result.registration.tree,
    "543abd5418d29d86a86a51d1dc2dcf2a0d033e0f");
  assert.equal(gitText(["rev-parse", `${result.registration.commit}^{tree}`]),
    result.registration.tree);
  assert.deepEqual(gitText(["diff", "--name-only", result.registration.parentCommit,
    result.registration.commit]).split(/\r?\n/u).sort(), [
    "contracts/vnext/README.md",
    registrationRelativePath,
    "docs/architecture/2026-08-26-qwen3-numerical-differential-execution-preregistration.md",
    "tinyrustlm/tests/qwen3-numerical-differential-execution-preregistration.test.js"
  ].sort());
  assert.deepEqual(gitBytes(result.registration.commit, registrationRelativePath),
    registrationBytes);
  assert.equal(result.registration.changedOnlyFourRegisteredPaths, true);
  assert.equal(result.registration.registrationFourWayRemoteExact, true);
  assert.equal(result.registration.sourceChangedDuringExecution, false);
  assert.equal(result.researchAuthority.durableMemoryPath,
    "wiki/runtime-mirust/reports/" +
    "tinyrustlm-qwen3-numerical-differential-memory-2026-08-26.md");
  assert.equal(result.researchAuthority.durableMemoryByteLength, 17399);
  assert.equal(result.researchAuthority.durableMemorySha256,
    "5cf598b71d6983996bcba3cb6112e0b4072930a8852637896be9a9b10952cf05");
  assert.equal(result.researchAuthority.advisoryOnly, true);
  assert.equal(result.researchAuthority.privateExecutionEvidence, false);
});

test("retains the exact pre-execution gates and audited request", () => {
  assert.deepEqual(result.preExecutionGate.standard, {
    testCount: 1543,
    passCount: 1541,
    failCount: 0,
    skipCount: 2,
    skipClass: "explicit-infrastructure-only"
  });
  assert.equal(result.preExecutionGate.releaseSurface.runId,
    "acf2755ba5363a1f2cb2085266d4d6fa32fae05625c70d97525f508fb732bcca");
  assert.equal(result.preExecutionGate.releaseSurface.testCount, 23);
  assert.equal(result.preExecutionGate.releaseSurface.passCount, 23);
  assert.equal(result.preExecutionGate.releaseSurface.aggregateByteLength, 3995);
  assert.equal(result.preExecutionGate.releaseSurface.aggregateSha256,
    "b11124b26e2a046b86e9f5a8f665da2af89011d9c4141fdad6af6f1cff3e5dbc");
  assert.equal(result.preExecutionGate.releaseSurface.maintainedVerifierPassed, true);
  assert.equal(result.preExecutionGate.releaseSurface.independentFileHashMatched, true);

  assert.equal(result.ownerRequest.schema,
    "tinyrustlm.qwen3_numerical_execution_request.v1");
  assert.equal(result.ownerRequest.byteLength, 1458);
  assert.equal(result.ownerRequest.sha256,
    "a7a55e245fbec19f01aebabc91239109290123c45132dfbd88723989e5672eeb");
  assert.equal(result.ownerRequest.createOnly, true);
  assert.equal(result.ownerRequest.readbackExact, true);
  assert.equal(result.ownerRequest.privatePathPublished, false);
  assert.deepEqual(result.ownerRequest.independentAudit, {
    registrationArtifactCount: 11,
    executableCount: 5,
    sourceFileCount: 9,
    sourceAggregateByteLength: 1519207688,
    sourceAggregateSha256:
      "d74acac24de01424d9676a022293503d031df91c5bb80bad5ab354056143a947",
    futureRootCount: 5,
    allFutureRootsAbsent: true,
    directRemoteExact: true,
    closedModelByteLength: 598308416,
    closedModelSha256:
      "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
  });
  assert.deepEqual(result.operatorPreparationObservation, {
    preWriteArgumentQuotingFailureObserved: true,
    code: "powershell-native-argument-quoting",
    requestPathOpened: false,
    requestFileCreated: false,
    ownerInvoked: false,
    registeredInvocationConsumed: false,
    operationOutcomeAuthority: false,
    hidden: false
  });
});

test("preserves one source launch and no later material process", () => {
  assert.deepEqual(result.ownerExecution, {
    invocationCount: 1,
    sourceLaunchCount: 1,
    reconstructedLaunchCount: 0,
    scalarLaunchCount: 0,
    verifierLaunchCount: 0,
    automaticRetry: false,
    manualRetryUnderRegistration: false,
    bestOfN: false,
    responseRepair: false,
    evidenceOverwriteAllowed: false,
    partialOutputCleanupAllowed: false,
    failedOutputAdoptionAllowed: false,
    thresholdChangeAllowed: false
  });
  assert.equal(result.sourceProcess.processStarted, true);
  assert.equal(result.sourceProcess.launchOrdinal, 1);
  assert.equal(result.sourceProcess.launchCountLimit, 1);
  assert.equal(result.sourceProcess.durationMilliseconds, 54038);
  assert.equal(result.sourceProcess.exitCode, 1);
  assert.equal(result.sourceProcess.signal, null);
  assert.equal(result.sourceProcess.timedOut, false);
  assert.equal(result.sourceProcess.killedForOverflow, false);
  assert.equal(result.sourceProcess.spawnCode, null);
  assert.equal(result.sourceProcess.streamCode, null);
  assert.equal(result.sourceProcess.terminationRequested, false);
  assert.equal(result.sourceProcess.executableUnchanged, true);
  assert.deepEqual(result.sourceProcess.stdout, {
    byteLength: 0,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    overflow: false,
    published: false
  });
  assert.equal(result.sourceProcess.stderr.byteLength, 50);
  assert.equal(result.sourceProcess.stderr.sha256,
    "d5a573885f9ffa22be8f9ef11429a4e1feadeeec3618adfff69542e4a51d2b2b");
  assert.equal(result.sourceProcess.stderr.safeCode, "source-trace-model-load");
  assert.equal(result.sourceProcess.stderr.rawPublished, false);
  assert.equal(result.sourceProcess.rootCauseEstablished, false);
});

test("closes the complete bounded evidence inventory without output adoption", () => {
  assert.deepEqual(result.privateEvidence.ownerTerminal, {
    byteLength: 2794,
    sha256: "4e15242ba7c7fe98ca5dc278769029fdf41722c8e90398e2b894d6bef6e193ad",
    status: "terminal-failure",
    reasonCode: "source-process-not-pass"
  });
  assert.equal(result.privateEvidence.evidenceFileCount, 9);
  assert.equal(result.privateEvidence.inventory.length, 9);
  assert.equal(new Set(result.privateEvidence.inventory.map((entry) => entry.fileName)).size,
    9);
  assert.equal(result.privateEvidence.inventory.reduce((sum, entry) =>
    sum + entry.byteLength, 0), result.privateEvidence.aggregateByteLength);
  assert.equal(result.privateEvidence.aggregateByteLength, 13071);
  for (const entry of result.privateEvidence.inventory) {
    assert.match(entry.fileName, /^[a-z][a-z0-9.-]+$/u);
    assert.ok(Number.isSafeInteger(entry.byteLength) && entry.byteLength >= 0);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  }
  assert.equal(result.privateEvidence.sourceScratchRootExistsAndIsEmpty, true);
  assert.equal(result.privateEvidence.sourceOutputRootCreated, false);
  assert.equal(result.privateEvidence.reconstructedOutputRootCreated, false);
  assert.equal(result.privateEvidence.scalarOutputRootCreated, false);
  assert.equal(result.privateEvidence.privatePathPublished, false);
  assert.equal(result.privateEvidence.rawStreamPublished, false);
});

test("records independent verification and immutable terminal decision", () => {
  assert.deepEqual(result.independentVerification, {
    invocationCount: 1,
    status: "terminal-failure-independently-verified",
    ownerTerminalCanonical: true,
    completeInventoryRehashed: true,
    requestRehashed: true,
    registrationRehashed: true,
    sourceProcessTerminalRecomputed: true,
    streamIdentitiesRecomputed: true,
    launchCountsRecomputed: true,
    outputRootStateRecomputed: true,
    wroteEvidence: false,
    launchedMaterialProcess: false
  });
  assert.equal(result.decision.status, "terminal-failure");
  assert.equal(result.decision.reasonCode, "source-process-not-pass");
  assert.equal(result.decision.operationClosed, true);
  assert.equal(result.decision.nextRequiredGate,
    "preserve-failure-and-diagnose-source-model-load-before-new-registration");
  for (const [field, value] of Object.entries(result.decision)) {
    if (field.endsWith("Allowed") || field.startsWith("candidateBytesMay")) {
      assert.equal(value, false, field);
    }
  }
  assert.equal(result.decision.numericalParityVerified, false);
});

test("keeps exact claim and privacy boundaries with zero campaign counters", () => {
  const trueClaims = new Set([
    "structuralCompositionPreviouslyVerified",
    "numericalRegistrationRemoteExact",
    "preExecutionGatesPassed",
    "privateOwnerRequestCreated",
    "privateOwnerRequestIndependentlyAudited",
    "ownerInvoked",
    "sourceFrameworkArmInvoked",
    "terminalFailureIndependentlyVerified"
  ]);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    assert.equal(value, trueClaims.has(field), field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
  assert.doesNotMatch(resultText, /[A-Z]:[\\/]/u);
  assert.doesNotMatch(resultText,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|PRIVATE KEY/iu);
  for (const prohibited of ["sourceDirectory", "compositionRoot", "repositoryRoot",
    "evidenceParent", "pythonPath", "nodePath", "scalarPath", "gitPath"]) {
    assert.equal(Object.hasOwn(result, prohibited), false, prohibited);
  }
});

test("deep-links checksum-bound terminal memory from every hot UAI surface", () => {
  assert.equal(memoryBytes.length, 7589);
  assert.equal(sha256(memoryBytes),
    "2058578314ae6fe5b7eea3d39977d0d86e4cbc60df74909a702d980ccc8e8224");
  const memoryText = memoryBytes.toString("utf8");
  for (const required of [resultRelativePath, registrationRelativePath,
    "source-trace-model-load", "terminal-failure", "1fbc78e2257089896aef79266d66c23ce8e7b4ee",
    "docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md"]) {
    assert.ok(memoryText.includes(required), required);
  }
  for (const relativePath of [
    "workspace.uai",
    ".uai/index.uai",
    ".uai/long-term-memory.uai",
    ".uai/short-term-memory.uai",
    ".uai/operations.uai",
    ".uai/architecture.uai",
    ".uai/test-plan.uai",
    ".uai/receiver-brief.uai",
    ".uai/startup-packet.uai",
    ".uai/totem.uai",
    ".uai/taboo.uai",
    ".uai/next-recursive-prompt.uai",
    ".uai/file-handoff.uai"
  ]) {
    const uaiText = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    assert.ok(uaiText.includes(memoryRelativePath), relativePath);
    assert.ok(uaiText.includes(
      "2058578314ae6fe5b7eea3d39977d0d86e4cbc60df74909a702d980ccc8e8224"),
    relativePath);
  }
});
