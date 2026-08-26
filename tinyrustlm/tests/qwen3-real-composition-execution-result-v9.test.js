"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-result.v9.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v9.json");
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

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

test("freezes execution /9 as one canonical terminal-ambiguous result", () => {
  assert.equal(resultBytes.length, 16578);
  assert.equal(sha256(resultBytes),
    "e22ec93b089beb814ee88ba4221213e5eb73920f81fd74f5ce5eec547eab9414");
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v9");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/9");
  assert.equal(result.executionId, profile.executionIdentity.executionId);
  assert.equal(result.status, "terminal-ambiguous");
});

test("binds immutable /8 history and the exact remote registration", () => {
  const predecessorBytes = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessorBytes.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessorBytes), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-managed-build-failure");
  assert.equal(result.predecessor.reused, false);
  assert.equal(result.predecessor.modified, false);

  assert.equal(profileBytes.length, result.registration.profileByteLength);
  assert.equal(sha256(profileBytes), result.registration.profileSha256);
  assert.deepEqual(gitBytes(result.registration.commit,
    result.registration.profilePath), profileBytes);
  assert.equal(childProcess.execFileSync("git",
    ["rev-parse", `${result.registration.commit}^{tree}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim(), result.registration.tree);
  for (const [field, value] of Object.entries(result.registration)) {
    if (field.startsWith("remoteExact")) assert.equal(value, true, field);
  }
  assert.equal(result.registration.sourceChangedDuringExecution, false);
});

test("records one passing environment authority and two passing custody operations",
  () => {
    const environment = result.windowsMsvcEnvironmentAuthority;
    assert.equal(environment.materialization.ownerInvocationCount, 1);
    assert.equal(environment.materialization.processExitCode, 0);
    assert.equal(environment.materialization.status, "pass");
    assert.equal(environment.evidence.publicLock.sha256,
      "8b46897329ece9005385e76448b691f8c2b8b3b0482ae2fad847f0ec71b0fe6b");
    assert.equal(environment.ownedApplicationDataRequired, true);

    for (const custody of [result.rustBuildCustody,
      result.managedBuildCustody]) {
      assert.equal(custody.profileId,
        "tinyrustlm.source-controlled-build-custody/4");
      assert.equal(custody.request.schema, "tinyrustlm.build-custody-request.v4");
      assert.equal(custody.execution.invocationCount, 1);
      assert.equal(custody.execution.processStarted, true);
      assert.equal(custody.execution.exitCode, 0);
      assert.equal(custody.terminal.status, "pass");
      assert.equal(custody.terminal.code, "build-custody-pass");
      assert.equal(custody.ownedApplicationData.appDataBoundToOwnedRoamingDirectory,
        true);
      assert.equal(custody.ownedApplicationData.localAppDataBoundToOwnedLocalDirectory,
        true);
      assert.equal(custody.ownedApplicationData.preLaunchDirectoryInventoryExact,
        true);
      assert.equal(custody.scratchInspection.invocationCount, 1);
      assert.equal(custody.scratchInspection.status, "pass");
      assert.equal(custody.scratchInspection.stderrEmpty, true);
      assert.equal(custody.custodyQualified, true);
      assert.equal(custody.retryAllowed, false);
      assert.equal(custody.outputAdoptionAllowed, false);
    }
  });

test("binds the current Rust and managed required output sets", () => {
  assert.deepEqual(result.rustBuildCustody.targetInventory.requiredOutputs, [
    {
      relativePath:
        "x86_64-pc-windows-msvc/release/tinyrustlm-build-scratch-inspect.exe",
      byteLength: 240128,
      sha256: "e76193683432227cb567831cd596e148a91b51d28bc3609dd02b297b95d73bae",
      peMachine: "0x8664"
    },
    {
      relativePath: "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe",
      byteLength: 852992,
      sha256: "e49630acf4afe90b9727494927b2ab7500fb03ce4e55aa9384bc5a980b7c8ad5",
      peMachine: "0x8664"
    }
  ]);
  assert.equal(result.managedBuildCustody.targetInventory.requiredOutputs.length,
    5);
  assert.equal(result.managedBuildCustody.targetInventory.requiredOutputs[1].sha256,
    "95858ff63f07a7164529818dfdda59022c2853b8fedc2131c74612f7037eb2c4");
  assert.equal(result.managedBuildCustody.targetInventory.requiredOutputs[3].sha256,
    "5614bb71cd0d58f9a14996af3d512cb7273b9e23f01099da5e1399c4f135e6e7");
  assert.equal(result.managedBuildCustody.scratchInspection
    .stagedHelperEqualsQualifiedRustOutput, true);
});

test("records one real converter launch and preserves the unqualified candidate",
  () => {
    const execution = result.controllerExecution;
    assert.equal(execution.invocationCount, 1);
    assert.equal(execution.controllerProcessExitCode, 0);
    assert.equal(execution.converterLaunchCount, 1);
    assert.equal(execution.converterProcessStarted, true);
    assert.equal(execution.converterExitCode, 0);
    assert.equal(execution.evidence.converterStderr.byteLength, 0);
    assert.equal(execution.evidence.terminal.status,
      "candidate-pass-awaiting-managed-durable-inspection");
    assert.equal(execution.outputCandidate.created, true);
    assert.equal(execution.outputCandidate.successInventoryCount, 10);
    assert.equal(execution.outputCandidate.inventory.length, 10);
    assert.equal(execution.outputCandidate.aggregateArtifactBytes,
      execution.outputCandidate.inventory.reduce(
        (sum, artifact) => sum + artifact.byteLength, 0));
    const model = execution.outputCandidate.inventory.find(
      artifact => artifact.file === "model.slm2");
    assert.deepEqual(model, {
      file: "model.slm2",
      byteLength: 598308416,
      sha256: "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
    });
    assert.equal(execution.outputCandidate.structurallyQualified, false);
    assert.equal(execution.outputCandidate.releasable, false);
    assert.equal(execution.outputCandidate.adoptionAllowed, false);
  });

test("preserves missing controller streams instead of reconstructing them", () => {
  assert.deepEqual(result.controllerExecution.outerCaptureDefect, {
    registered: true,
    controllerStdoutPresent: false,
    controllerStderrPresent: false,
    reconstructedAfterInvocation: false,
    rawBytesInvented: false,
    rootCauseEstablished: true,
    rootCauseCode:
      "controller-invocation-did-not-own-registered-outer-stream-capture"
  });
});

test("records the sole managed inspection as a typed path-contract error", () => {
  const inspection = result.managedInspection;
  assert.equal(inspection.invocationCount, 1);
  assert.equal(inspection.processStarted, true);
  assert.equal(inspection.exitCode, 1);
  assert.equal(inspection.stdout.byteLength, 0);
  assert.equal(inspection.stderr.byteLength, 140);
  assert.deepEqual(inspection.typedError, {
    schema: "tinyrustlm.qwen3-composition-managed-inspection-error.v1",
    status: "error",
    code: "managed-inspection-intent-path"
  });
  assert.equal(inspection.pathContractDefect.rootCauseEstablished, true);
  assert.equal(inspection.pathContractDefect
    .suppliedArgumentUsedNoncanonicalWindowsSeparators, true);
  assert.equal(inspection.pathContractDefect.durableCompositionWasInspected,
    false);
  assert.equal(inspection.runtime.unchanged, true);
  assert.equal(inspection.assembly.unchanged, true);
  assert.equal(inspection.automaticRetry, false);
  assert.equal(inspection.manualRetryUnderRegistration, false);
});

test("binds the private terminal verification without publishing private paths",
  () => {
    assert.deepEqual(result.privateVerification, {
      schema: "tinyrustlm.qwen3-composition-execution-verification.v5",
      byteLength: 42323,
      sha256: "55bc8d97dc4f7e11cc6ec83723f2724e6bfe8654bf0b0ab61af7b92593ce3471",
      status: "terminal-ambiguous",
      reasonCode:
        "controller-raw-streams-absent-and-managed-inspection-intent-path",
      structuralCompositionVerified: false,
      allReferencedPresentEvidenceRehashed: true,
      missingEvidenceReconstructed: false,
      privatePathPublished: false
    });
  });

test("requires one source-owned end-to-end correction and wholly new names", () => {
  const correction = result.failureDrivenCorrection;
  assert.equal(correction.requiredGeneralRegression,
    "canonical-windows-child-path-and-complete-outer-stream-capture");
  assert.equal(correction.requiredOwner,
    "one-source-controlled-managed-inspection-and-verification-orchestrator");
  assert.equal(correction.ownerMustCanonicalizeEveryChildPathBeforeLaunch, true);
  assert.equal(correction.ownerMustOpenEveryRegisteredRawStreamCreateOnlyBeforeLaunch,
    true);
  assert.equal(correction.ownerMustPersistOneDurableProcessTerminal, true);
  assert.equal(correction.ownerMustWriteFinalVerificationCreateOnly, true);
  assert.equal(correction.newRegistrationRequired, true);
  assert.equal(correction.whollyNewPrivateNamesRequired, true);
  assert.equal(correction.compatibilityPathAllowed, false);
  assert.equal(correction.fallbackAllowed, false);
});

test("closes /9 without retry cleanup repair adoption or release", () => {
  assert.deepEqual(result.decision, {
    status: "terminal-ambiguous",
    reasonCode:
      "controller-raw-streams-absent-and-managed-inspection-intent-path",
    registrationClosed: true,
    structuralCompositionVerified: false,
    candidateBytesMayBeReleased: false,
    retryUnderRegistrationAllowed: false,
    existingPrivateEvidenceMayBeDeleted: false,
    existingPrivateEvidenceMayBeOverwritten: false,
    existingOutputMayBeRepaired: false,
    existingOutputMayBeAdopted: false,
    newAttemptRequiresNewRegistrationAndAllNewLogicalNames: true
  });
});

test("publishes no private material or inflated campaign claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text, /TinyRustLM-vnext-private/iu);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  const permittedTrueClaims = new Set([
    "realConversionAttemptRegistered",
    "msvcEnvironmentAuthorityMaterialized",
    "rustBuildCustodyCompleted",
    "rustScratchInspectionPassed",
    "managedBuildCustodyCompleted",
    "managedScratchInspectionPassed",
    "realConverterInvoked",
    "converterExitedZero",
    "compositionCandidateCreated",
    "managedInspectionInvoked"
  ]);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    assert.equal(value, permittedTrueClaims.has(field), field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
