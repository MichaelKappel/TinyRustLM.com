"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-result.v8.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v8.json");
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

test("freezes execution /8 as one canonical managed build failure", () => {
  assert.equal(resultBytes.length, 16999);
  assert.equal(sha256(resultBytes),
    "9caa23225dfa2b0e01f4bfd550c0a4cf178d4d7db2f301159f0e2b040dd94f40");
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema, "tinyrustlm.qwen3-real-composition-execution-result.v8");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/8");
  assert.equal(result.executionId, profile.executionIdentity.executionId);
  assert.equal(result.status, "terminal-managed-build-failure");
});

test("binds immutable /7 history and the exact remote registration", () => {
  const predecessorBytes = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessorBytes.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessorBytes), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-rust-custody-failure");
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
  assert.equal(childProcess.execFileSync("git",
    ["rev-parse", `${result.registration.commit}^`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim(), profile.registrationParentCommit);
  for (const field of [
    "remoteExactBeforeEnvironmentRequest",
    "remoteExactBeforeEnvironmentMaterialization",
    "remoteExactBeforeRustRequest",
    "remoteExactBeforeRustBuild",
    "remoteExactBeforeManagedRequest",
    "remoteExactBeforeManagedBuild"
  ]) assert.equal(result.registration[field], true, field);
  assert.equal(result.registration.sourceChangedDuringExecution, false);
});

test("keeps the rejected stale-memory guard outside the materializer count", () => {
  assert.deepEqual(result.registration.preOwnerGuardObservation, {
    observationCount: 1,
    code: "stale-remembered-node-hash-rejected-before-owner",
    environmentOwnerInvocationCount: 0,
    environmentOutputCount: 0,
    registeredNodeBytesDrifted: false,
    requestModified: false,
    usedForDecision: false
  });
  assert.equal(result.windowsMsvcEnvironmentAuthority.materialization.ownerInvocationCount,
    1);
});

test("records one immutable linker-complete MSVC authority", () => {
  const environment = result.windowsMsvcEnvironmentAuthority;
  assert.equal(environment.operationId,
    profile.windowsMsvcEnvironmentAuthority.operationId);
  assert.deepEqual(environment.request, {
    byteLength: 1546,
    sha256: "492990407ef21fc7a78f6a9969de5fa5d4480208dd35b8d048b41d06158b9b72",
    createOnly: true,
    privatePathPublished: false
  });
  assert.equal(environment.materialization.processExitCode, 0);
  assert.equal(environment.materialization.status, "pass");
  assert.equal(environment.materialization.code, "msvc-environment-materialized");
  assert.equal(environment.materialization.canonicalPublicSummaryObserved, true);
  assert.equal(environment.materialization.rawProcessOutputPublished, false);
  assert.deepEqual(environment.selected, {
    visualStudioProductLineVersion: "2022",
    visualStudioInstallationVersion: "17.14.37531.7",
    msvcToolsetVersion: "14.44.35207",
    windowsSdkVersion: "10.0.26100.0",
    targetTriple: "x86_64-pc-windows-msvc"
  });
  assert.equal(environment.evidence.privateBinding.published, false);
  assert.equal(environment.evidence.publicLock.sha256,
    "142a1cece889583a7395dad451659046ad23dd9edd23e3bb9635eef463ca8059");
  assert.equal(environment.evidence.terminal.status, "pass");
  assert.equal(environment.custodyValidation.evidenceUnchanged, true);
  assert.equal(environment.custodyValidation.managedPostScratchInspection, false);
  assert.equal(environment.materializationRetryAllowed, false);
  assert.equal(environment.cleanupAllowed, false);
  assert.equal(environment.repairAllowed, false);
});

test("records one passing V3 Rust custody operation", () => {
  const custody = result.rustBuildCustody;
  assert.equal(custody.operationId, profile.rustBuildCustody.operationId);
  assert.equal(custody.request.schema, profile.rustBuildCustody.requestSchema);
  assert.equal(custody.request.byteLength, 7241);
  assert.equal(custody.request.sha256,
    "77c761cec48297393b2b3f366afa21af0c3b3db48ef0912f5d06c2fc6a69ee64");
  assert.equal(custody.preflight.invocationCount, 1);
  assert.equal(custody.preflight.status, "ready");
  assert.equal(custody.preflight.code, "build-custody-preflight-pass");
  assert.equal(custody.preflight.controlRootAbsent, true);
  assert.equal(custody.preflight.targetRootAbsent, true);
  assert.equal(custody.preflight.environmentRootAbsent, true);
  assert.equal(custody.execution.invocationCount, 1);
  assert.equal(custody.execution.processStarted, true);
  assert.equal(custody.execution.exitCode, 0);
  for (const field of ["signal", "spawnErrorCode", "streamErrorCode",
    "captureCloseCode"]) assert.equal(custody.execution[field], null, field);
  for (const field of ["timedOut", "stdoutOverflow", "stderrOverflow"])
    assert.equal(custody.execution[field], false, field);
  assert.equal(custody.evidence.terminal.status, "pass");
  assert.equal(custody.evidence.terminal.code, "build-custody-pass");
  assert.equal(custody.custodyQualified, true);
});

test("binds the two qualified Rust outputs and scratch proof", () => {
  const custody = result.rustBuildCustody;
  assert.equal(custody.targetInventory.requiredOutputs.length, 2);
  assert.deepEqual(custody.targetInventory.requiredOutputs, [
    {
      relativePath:
        "x86_64-pc-windows-msvc/release/tinyrustlm-build-scratch-inspect.exe",
      byteLength: 240128,
      sha256: "b038227799d03f322eb1b7ce55abe662b5ed1d481e37e282b186ecd545315c5c",
      peMachine: "0x8664"
    },
    {
      relativePath: "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe",
      byteLength: 852992,
      sha256: "c90d963752f92c7de10866d071a9086334d5b80160de8815a508df2ff0a8d48c",
      peMachine: "0x8664"
    }
  ]);
  assert.equal(custody.targetInventory.preserved, true);
  assert.equal(custody.targetInventory.adoptionAllowed, false);
  assert.equal(custody.scratchInspection.invocationCount, 1);
  assert.equal(custody.scratchInspection.status, "pass");
  assert.equal(custody.scratchInspection.junctionCount, 1);
  assert.equal(custody.scratchInspection.helperIdentityStable, true);
  assert.equal(custody.scratchInspection.containedKnownFolderJunctionAccepted, true);
  assert.equal(custody.scratchInspection.externalJunctionAccepted, false);
  assert.equal(custody.scratchInspection.stderrEmpty, true);
  assert.equal(new Set([
    custody.environmentAuthorityConsistency.initialPublicLockSha256,
    custody.environmentAuthorityConsistency.preLaunchPublicLockSha256,
    custody.environmentAuthorityConsistency.postChildPublicLockSha256,
    custody.environmentAuthorityConsistency.postScratchInspectionPublicLockSha256
  ]).size, 1);
  assert.equal(custody.environmentAuthorityConsistency.driftObserved, false);
});

test("records one terminal managed child without qualifying its outputs", () => {
  const custody = result.managedBuildCustody;
  assert.equal(custody.operationId, profile.managedBuildCustody.operationId);
  assert.equal(custody.request.schema, profile.managedBuildCustody.requestSchema);
  assert.equal(custody.request.byteLength, 8264);
  assert.equal(custody.request.sha256,
    "b8df72cdcc98fb6a39ae64867d7e6006755067adac062198c45c228e5def0b89");
  assert.equal(custody.request.qualifiedRustHelperSha256,
    result.rustBuildCustody.targetInventory.requiredOutputs[0].sha256);
  assert.equal(custody.preflight.invocationCount, 1);
  assert.equal(custody.preflight.status, "ready");
  assert.equal(custody.preflight.controlRootAbsent, true);
  assert.equal(custody.preflight.targetRootAbsent, true);
  assert.equal(custody.preflight.environmentRootAbsent, true);
  assert.equal(custody.execution.invocationCount, 1);
  assert.equal(custody.execution.processStarted, true);
  assert.equal(custody.execution.exitCode, 1);
  assert.equal(custody.execution.timedOut, false);
  assert.equal(custody.execution.stdoutOverflow, false);
  assert.equal(custody.execution.stderrOverflow, false);
  assert.equal(custody.evidence.terminal.status, "terminal-build-failure");
  assert.equal(custody.evidence.terminal.code, "build-custody-child-nonzero");
  assert.equal(custody.targetObservation.targetRootCreated, true);
  assert.equal(custody.targetObservation.targetInventoryCreated, false);
  assert.equal(custody.targetObservation.qualifiedRequiredOutputCount, 0);
  assert.equal(custody.targetObservation.stagedScratchInspectorQualified, false);
  assert.equal(custody.scratchInspection.invocationCount, 0);
  assert.equal(custody.scratchInspection.processStarted, false);
  assert.equal(custody.scratchInspection.observationCreated, false);
});

test("preserves bounded diagnostics without inventing a root cause", () => {
  const custody = result.managedBuildCustody;
  assert.deepEqual(custody.worktreeSideEffect, {
    observed: true,
    relativeRoot: "NuGet",
    relativeFile: "NuGet/Migrations/1",
    createdAtUtc: "2026-08-25T21:14:45.4534601Z",
    createdWithinManagedChildInterval: true,
    directoryCount: 2,
    fileCount: 1,
    fileByteLength: 0,
    fileSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    gitTracked: false,
    rawContentPublished: false,
    preservedOutsideGit: true,
    sourceControlAdmissionAllowed: false,
    rootCauseEstablished: false
  });
  assert.deepEqual(custody.boundedDiagnostic, {
    stdoutDiagnosticClass: "dotnet-assets-lock-read-failure",
    dotnetDiagnosticCode: "NETSDK1060",
    exceptionParameter: "path1",
    stderrDiagnosticClass: "dotnet-workload-verification-warning",
    assetsJsonParsedAfterTerminal: true,
    assetsJsonVersion: 4,
    assetsJsonExplicitNullCount: 0,
    assetsJsonPackageFolderCount: 2,
    requestPackageRootMatchedAssetsPackageFolder: true,
    rawTextPublished: false
  });
  assert.equal(custody.rootCause.code,
    "managed-dotnet-child-nonzero-assets-lock-read-failure");
  assert.equal(custody.rootCause.dotnetAssetsReadFailureObserved, true);
  assert.equal(custody.rootCause.environmentAuthorityDriftObserved, false);
  assert.equal(custody.rootCause.rootCauseEstablished, false);
  for (const field of [
    "sourceCodeDefectEstablished",
    "managedProjectDefectEstablished",
    "managedCustodyOwnerDefectEstablished",
    "registeredMinimalEnvironmentDefectEstablished",
    "staleRestoreStateDefectEstablished",
    "dotnetSdkDefectEstablished",
    "qualifiedRustHelperDefectEstablished"
  ]) assert.equal(custody.rootCause[field], false, field);
  assert.equal(custody.retryAllowed, false);
  assert.equal(custody.resumeAllowed, false);
  assert.equal(custody.cleanupAllowed, false);
  assert.equal(custody.outputAdoptionAllowed, false);
});

test("proves all three composition-stage names and operations stayed absent", () => {
  for (const [field, value] of Object.entries(result.laterOperationObservation)) {
    assert.equal(value, typeof value === "number" ? 0 : false, field);
  }
  assert.equal(result.rootObservation.registeredLogicalNameCount, 15);
  assert.equal(result.rootObservation.createdLogicalNameCount, 12);
  assert.equal(result.rootObservation.absentLaterLogicalNameCount, 3);
  for (const field of [
    "environmentRequestCreated",
    "environmentPrivateBindingCreated",
    "environmentPublicLockCreated",
    "environmentTerminalCreated",
    "rustCustodyRequestCreated",
    "rustCustodyControlRootCreated",
    "rustCustodyTargetRootCreated",
    "rustCustodyEnvironmentRootCreated",
    "managedCustodyRequestCreated",
    "managedCustodyControlRootCreated",
    "managedCustodyTargetRootCreated",
    "managedCustodyEnvironmentRootCreated"
  ]) assert.equal(result.rootObservation[field], true, field);
  for (const field of [
    "compositionRequestCreated",
    "controllerEvidenceRootCreated",
    "compositionOutputRootCreated"
  ]) assert.equal(result.rootObservation[field], false, field);
  assert.equal(result.rootObservation.allCreatedPrivateMaterialPreserved, true);
});

test("closes /8 without retry cleanup repair adoption fallback or compatibility", () => {
  const decision = result.decision;
  assert.equal(decision.status, "terminal-managed-build-failure");
  assert.equal(decision.reasonCode,
    "managed-dotnet-child-nonzero-assets-lock-read-failure");
  assert.equal(decision.stage, "managed-build-custody-child");
  assert.equal(decision.rootCauseEstablished, false);
  assert.equal(decision.registrationClosed, true);
  assert.equal(decision.retryUnderRegistrationAllowed, false);
  assert.equal(decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(decision.existingTargetMayBeAdopted, false);
  assert.equal(decision.laterOperationsAuthorized, false);
  assert.equal(decision.newAttemptRequiresNewRegistrationAndAllNewLogicalNames, true);
  assert.equal(decision.newAttemptRequiresGeneralFailureReproduction, true);
  assert.equal(decision.newAttemptRequiresRootCauseCorrection, true);
  assert.equal(decision.compatibilityPathAllowed, false);
  assert.equal(decision.fallbackAllowed, false);
});

test("publishes no private material or inflated product and campaign claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text,
    /TinyRustLM-vnext-private|build\.(stdout|stderr)\.bin contents/iu);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  const permittedTrueClaims = new Set([
    "realConversionAttemptRegistered",
    "msvcEnvironmentAuthorityMaterialized",
    "rustCustodyRequestCreated",
    "rustBuildCustodyCompleted",
    "rustBuildAttempted",
    "rustChildExitedZero",
    "rustScratchInspectionPassed",
    "rustReleaseBuildQualified",
    "managedCustodyRequestCreated",
    "managedBuildCustodyCompleted",
    "managedBuildAttempted"
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
