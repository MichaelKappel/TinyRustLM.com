"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-result.v6.json"
);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

test("freezes execution /6 as one canonical Rust build failure", () => {
  assert.equal(resultBytes.length, 6644);
  assert.equal(
    sha256(resultBytes),
    "58d6ce16304d804d3a09cfd2c6544e8fa10b39080359040383df3f2ac68bb72c"
  );
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema, "tinyrustlm.qwen3-real-composition-execution-result.v6");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/6");
  assert.equal(result.status, "terminal-rust-build-failure");
});

test("binds immutable predecessor and remote-exact registration", () => {
  const predecessorBytes = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessorBytes.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessorBytes), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-prelaunch-failure");
  assert.equal(result.predecessor.reused, false);
  assert.equal(result.predecessor.modified, false);

  const profileBytes = gitBytes(result.registration.commit,
    result.registration.profilePath);
  assert.equal(profileBytes.length, result.registration.profileByteLength);
  assert.equal(sha256(profileBytes), result.registration.profileSha256);
  assert.equal(
    childProcess.execFileSync("git", ["rev-parse", `${result.registration.commit}^{tree}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim(),
    result.registration.tree
  );
  assert.equal(result.registration.remoteExactBeforePrivateRequest, true);
  assert.equal(result.registration.remoteExactBeforeRustBuild, true);
});

test("records one preflight and one directly captured nonzero child", () => {
  const custody = result.rustBuildCustody;
  assert.equal(custody.operationId, "qwen3-composition-v6-rust-build");
  assert.deepEqual(custody.request, {
    byteLength: 5569,
    sha256: "57a41f877be767e55c34aeb05211761de658f53590d6cdcc6f4faa3237dec70c",
    createOnly: true,
    privatePathPublished: false
  });
  assert.equal(custody.preflight.invocationCount, 1);
  assert.equal(custody.preflight.status, "ready");
  assert.equal(custody.preflight.controlRootAbsent, true);
  assert.equal(custody.preflight.targetRootAbsent, true);
  assert.equal(custody.execution.invocationCount, 1);
  assert.equal(custody.execution.processStarted, true);
  assert.equal(custody.execution.exitCode, 101);
  assert.equal(custody.execution.signal, null);
  assert.equal(custody.execution.timedOut, false);
  assert.equal(custody.execution.stdoutOverflow, false);
  assert.equal(custody.execution.stderrOverflow, false);
  assert.equal(custody.execution.spawnErrorCode, null);
  assert.equal(custody.execution.streamErrorCode, null);
  assert.equal(custody.execution.captureCloseCode, null);
});

test("binds all six private evidence artifacts without publishing raw logs", () => {
  assert.deepEqual(result.rustBuildCustody.evidence, {
    binding: {
      byteLength: 6826,
      sha256: "1de2fbaf23cdec6f5568c440f332048ca122adefc40cd61f85e0fc940700a9de"
    },
    start: {
      byteLength: 451,
      sha256: "d84639b1d6e51ddaa1b40798b07b7c1331ea74ce49eafb47a9bbee466e6b3e2f"
    },
    stdout: {
      byteLength: 0,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      published: false
    },
    stderr: {
      byteLength: 1402,
      sha256: "1e088c4cd8c16d71ecec3d73b0db8b93d9afdd3df75a61eaea3fbc19615d38bc",
      published: false
    },
    processTerminal: {
      byteLength: 616,
      sha256: "6eceed61aebef41285271356b957f4185d4fa4e732580b69a27c15530a51750f"
    },
    terminal: {
      byteLength: 2209,
      sha256: "0f332516a5a0637021314247cb35dc1c0d4b5c19c3f49d0c5e2ce42baf667c8a",
      status: "terminal-build-failure",
      code: "build-custody-child-nonzero"
    }
  });
});

test("records the linker environment defect without blaming source", () => {
  assert.deepEqual(result.rustBuildCustody.rootCause, {
    code: "msvc-linker-not-found-in-registered-command-environment",
    registeredPathEntryCount: 35,
    registeredPathLinkerParentCount: 0,
    installedMsvcX64LinkerObservedOutsideRegisteredPath: true,
    sourceCodeDefectEstablished: false,
    converterDefectEstablished: false,
    custodyOwnerDefectEstablished: false,
    privateRequestEnvironmentDefectEstablished: true,
    rootCauseEstablished: true
  });
  assert.deepEqual(result.rustBuildCustody.targetInventory, {
    fileCount: 102,
    directoryCount: 85,
    aggregateFileBytes: 10527012,
    reparsePointCount: 0,
    requiredOutputCount: 0,
    preserved: true,
    adoptionAllowed: false
  });
  assert.equal(result.rustBuildCustody.relevantBuildProcessesObservedAfterTerminal, 0);
});

test("proves every later operation remained absent", () => {
  for (const [field, value] of Object.entries(result.laterOperationObservation)) {
    assert.equal(value, field === "privateExecutionBindingCreated" ||
      field === "compositionArtifactCreated" || field === "privateVerificationCreated"
      ? false : (typeof value === "number" ? 0 : false), field);
  }
  assert.equal(result.rootObservation.registeredLogicalNameCount, 9);
  assert.equal(result.rootObservation.rustCustodyRequestCreated, true);
  assert.equal(result.rootObservation.rustCustodyControlRootCreated, true);
  assert.equal(result.rootObservation.rustCustodyTargetRootCreated, true);
  for (const field of [
    "managedCustodyRequestCreated",
    "managedCustodyControlRootCreated",
    "managedCustodyTargetRootCreated",
    "compositionRequestCreated",
    "controllerEvidenceRootCreated",
    "compositionOutputRootCreated"
  ]) assert.equal(result.rootObservation[field], false, field);
  assert.equal(result.rootObservation.allCreatedPrivateMaterialPreserved, true);
});

test("closes /6 without retry cleanup repair or adoption", () => {
  assert.equal(result.decision.status, "terminal-rust-build-failure");
  assert.equal(result.decision.reasonCode,
    "msvc-linker-not-found-in-registered-command-environment");
  assert.equal(result.decision.rootCauseEstablished, true);
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.retryUnderRegistrationAllowed, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(result.decision.existingTargetMayBeAdopted, false);
  assert.equal(result.decision.laterOperationsAuthorized, false);
  assert.equal(result.decision.newAttemptRequiresNewRegistrationAndAllNewLogicalNames,
    true);
  assert.equal(result.decision.newAttemptRequiresExactMsvcLinkerEnvironmentBinding,
    true);
});

test("publishes no private material or inflated product claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.equal(result.claimBoundary.realConversionAttemptRegistered, true);
  assert.equal(result.claimBoundary.privateCustodyRequestCreated, true);
  assert.equal(result.claimBoundary.rustBuildCustodyCompleted, true);
  assert.equal(result.claimBoundary.rustBuildAttempted, true);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    if (["realConversionAttemptRegistered", "privateCustodyRequestCreated",
      "rustBuildCustodyCompleted", "rustBuildAttempted"].includes(field)) continue;
    assert.equal(value, false, field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
