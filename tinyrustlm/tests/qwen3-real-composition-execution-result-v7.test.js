"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-result.v7.json");
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

test("freezes execution /7 as one canonical Rust custody failure", () => {
  assert.equal(resultBytes.length, 11166);
  assert.equal(sha256(resultBytes),
    "e37790ffb827fe7082e31cc6adecc8148839dd6ef757231165587c45dd35b444");
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema, "tinyrustlm.qwen3-real-composition-execution-result.v7");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/7");
  assert.equal(result.executionId, "qwen3-composition-c1899de-20260825-v7");
  assert.equal(result.status, "terminal-rust-custody-failure");
});

test("binds the immutable /6 predecessor and remote-exact /7 registration", () => {
  const predecessorBytes = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessorBytes.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessorBytes), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-rust-build-failure");
  assert.equal(result.predecessor.reused, false);
  assert.equal(result.predecessor.modified, false);

  const profileBytes = gitBytes(result.registration.commit,
    result.registration.profilePath);
  assert.equal(profileBytes.length, result.registration.profileByteLength);
  assert.equal(sha256(profileBytes), result.registration.profileSha256);
  assert.equal(childProcess.execFileSync("git",
    ["rev-parse", `${result.registration.commit}^{tree}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim(), result.registration.tree);
  assert.deepEqual(Object.values(result.registration).slice(-4),
    [true, true, true, true]);
});

test("records one immutable linker-complete MSVC authority materialization", () => {
  const environment = result.windowsMsvcEnvironmentAuthority;
  assert.equal(environment.operationId, "qwen3-composition-v7-msvc-environment");
  assert.deepEqual(environment.request, {
    byteLength: 1546,
    sha256: "21b5012ec086922dd48020299325644a5c5671e3c8123442ffde46f414001b08",
    createOnly: true,
    privatePathPublished: false
  });
  assert.equal(environment.materialization.invocationCount, 1);
  assert.equal(environment.materialization.exitCode, 0);
  assert.equal(environment.materialization.stdout.canonicalPublicSummary, true);
  assert.equal(environment.materialization.stderr.byteLength, 0);
  assert.equal(environment.materialization.status, "pass");
  assert.equal(environment.materialization.code, "msvc-environment-materialized");
  assert.deepEqual(environment.selected, {
    visualStudioProductLineVersion: "2022",
    visualStudioInstallationVersion: "17.14.37531.7",
    msvcToolsetVersion: "14.44.35207",
    windowsSdkVersion: "10.0.26100.0",
    targetTriple: "x86_64-pc-windows-msvc"
  });
  assert.equal(environment.evidence.privateBinding.published, false);
  assert.equal(environment.evidence.publicLock.sha256,
    "8e16a82b73828fa2152feb75ba4d42a9045efd97f7421fba7c445c1af859552a");
  assert.equal(environment.evidence.terminal.status, "pass");
  assert.equal(environment.postMaterializationValidation.status, "pass");
  assert.equal(environment.rustPreflightFreshProcessValidation, true);
  assert.equal(environment.rustPreLaunchFreshProcessValidation, true);
  assert.equal(environment.rustPostChildFreshProcessValidation, true);
  assert.equal(environment.materializationRetryAllowed, false);
  assert.equal(environment.cleanupAllowed, false);
  assert.equal(environment.repairAllowed, false);
});

test("records one ready preflight and one zero-exit Rust child", () => {
  const custody = result.rustBuildCustody;
  assert.equal(custody.operationId, "qwen3-composition-v7-rust-build");
  assert.deepEqual(custody.request, {
    byteLength: 6367,
    sha256: "90cecbc1c9673f95cd1a8e0e6c722a399c9c004456bce3f4a0a83c7ccd765d8f",
    createOnly: true,
    privatePathPublished: false
  });
  assert.equal(custody.preflight.invocationCount, 1);
  assert.equal(custody.preflight.status, "ready");
  assert.equal(custody.preflight.code, "build-custody-preflight-pass");
  assert.equal(custody.preflight.controlRootAbsent, true);
  assert.equal(custody.preflight.targetRootAbsent, true);
  assert.equal(custody.preflight.environmentRootAbsent, true);
  assert.equal(custody.execution.invocationCount, 1);
  assert.equal(custody.execution.processStarted, true);
  assert.equal(custody.execution.processIdObserved, true);
  assert.equal(custody.execution.exitCode, 0);
  assert.equal(custody.execution.signal, null);
  assert.equal(custody.execution.timedOut, false);
  assert.equal(custody.execution.stdoutOverflow, false);
  assert.equal(custody.execution.stderrOverflow, false);
  assert.equal(custody.execution.spawnErrorCode, null);
  assert.equal(custody.execution.streamErrorCode, null);
  assert.equal(custody.execution.captureCloseCode, null);
});

test("binds all six private Rust evidence artifacts without publishing logs", () => {
  assert.deepEqual(result.rustBuildCustody.evidence, {
    binding: {
      byteLength: 9800,
      sha256: "ff09d79f7388515bf8e9c70302f7ead4f31c958e1fdf26332e51ac5ca6536203"
    },
    start: {
      byteLength: 651,
      sha256: "5a6c6b854ccf029cfc5b67b42fc138bd0e462b2e999ebef229a1c6bf906f6946"
    },
    stdout: {
      byteLength: 0,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      published: false
    },
    stderr: {
      byteLength: 1874,
      sha256: "cfac0d70b33edfbf13f6a1be3204a1cc2cdb7b20d455b779f54dd55ab5f2d5cb",
      published: false
    },
    processTerminal: {
      byteLength: 2256,
      sha256: "e2833f7ea870f2b828c040f4781ba5e4d5d7cd8269d3e20a92b83a37f11d9458"
    },
    terminal: {
      byteLength: 10889,
      sha256: "f0a818869f3037d9fe51f5bf86bb22d0f9149ee5925bda72a1a0f946a0105e2c",
      status: "terminal-custody-failure",
      code: "build-custody-environment-scratch-reparse"
    }
  });
});

test("preserves the successful x64 build output without qualifying or adopting it", () => {
  assert.deepEqual(result.rustBuildCustody.targetInventory, {
    entryCount: 450,
    fileCount: 365,
    directoryCount: 85,
    aggregateFileBytes: 105686862,
    requiredOutput: {
      relativePath: "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe",
      byteLength: 852992,
      sha256: "f5712d2d4cc9f7fe61cbb3102c126cdd3bb7da3f7142edd5a95f9fa0c6b6bdf4",
      peMachine: "0x8664"
    },
    preserved: true,
    adoptionAllowed: false
  });
  assert.equal(result.rustBuildCustody.environmentAuthorityConsistency.driftObserved,
    false);
  assert.equal(new Set([
    result.rustBuildCustody.environmentAuthorityConsistency.initialPublicLockSha256,
    result.rustBuildCustody.environmentAuthorityConsistency.preLaunchPublicLockSha256,
    result.rustBuildCustody.environmentAuthorityConsistency.postChildPublicLockSha256
  ]).size, 1);
});

test("records one contained known-folder junction as the general contract defect", () => {
  const scratch = result.rustBuildCustody.environmentScratchObservation;
  assert.equal(scratch.terminalInventoryCreated, false);
  assert.equal(scratch.readOnlyPostTerminalObservation, true);
  assert.equal(scratch.entryCount, 25);
  assert.equal(scratch.fileCount, 1);
  assert.equal(scratch.directoryCount, 23);
  assert.equal(scratch.aggregateFileBytes, 0);
  assert.equal(scratch.reparsePointCount, 1);
  assert.deepEqual(scratch.reparse, {
    relativePath: "home/AppData/Local/Microsoft/Windows/INetCache/Content.IE5",
    targetKind: "absolute-directory-junction",
    targetInsideOwnedScratch: true,
    targetRelativePath: "home/AppData/Local/Microsoft/Windows/INetCache/IE",
    followedDuringObservation: false
  });
  assert.deepEqual(result.rustBuildCustody.rootCause, {
    code: "windows-inetcache-contained-junction-not-representable-by-current-scratch-contract",
    childBuildExitCodeZero: true,
    requiredX64ConverterObserved: true,
    environmentAuthorityDriftObserved: false,
    singleContainedWindowsKnownFolderJunctionObserved: true,
    externalReparseTargetObserved: false,
    sourceCodeDefectEstablished: false,
    converterBuildDefectEstablished: false,
    environmentAuthorityDefectEstablished: false,
    buildCustodyOwnerImplementationDefectEstablished: false,
    buildCustodyScratchContractDefectEstablished: true,
    rootCauseEstablished: true
  });
  assert.equal(result.rustBuildCustody.relevantBuildProcessesObservedAfterTerminal, 0);
});

test("proves all seven later private names and every later operation stayed absent", () => {
  for (const [field, value] of Object.entries(result.laterOperationObservation)) {
    assert.equal(value, typeof value === "number" ? 0 : false, field);
  }
  assert.equal(result.rootObservation.registeredLogicalNameCount, 15);
  for (const field of [
    "environmentRequestCreated",
    "environmentPrivateBindingCreated",
    "environmentPublicLockCreated",
    "environmentTerminalCreated",
    "rustCustodyRequestCreated",
    "rustCustodyControlRootCreated",
    "rustCustodyTargetRootCreated",
    "rustCustodyEnvironmentRootCreated"
  ]) assert.equal(result.rootObservation[field], true, field);
  for (const field of [
    "managedCustodyRequestCreated",
    "managedCustodyControlRootCreated",
    "managedCustodyTargetRootCreated",
    "managedCustodyEnvironmentRootCreated",
    "compositionRequestCreated",
    "controllerEvidenceRootCreated",
    "compositionOutputRootCreated"
  ]) assert.equal(result.rootObservation[field], false, field);
  assert.equal(result.rootObservation.allCreatedPrivateMaterialPreserved, true);
});

test("closes /7 without retry cleanup repair adoption or broad reparse allowance", () => {
  const decision = result.decision;
  assert.equal(decision.status, "terminal-rust-custody-failure");
  assert.equal(decision.reasonCode,
    "windows-inetcache-contained-junction-not-representable-by-current-scratch-contract");
  assert.equal(decision.stage, "rust-build-custody-post-exit-verification");
  assert.equal(decision.rootCauseEstablished, true);
  assert.equal(decision.registrationClosed, true);
  assert.equal(decision.retryUnderRegistrationAllowed, false);
  assert.equal(decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(decision.existingTargetMayBeAdopted, false);
  assert.equal(decision.laterOperationsAuthorized, false);
  assert.equal(decision.newAttemptRequiresNewRegistrationAndAllNewLogicalNames, true);
  assert.equal(decision.newAttemptRequiresExplicitBoundedInternalJunctionContract, true);
  assert.equal(decision.blanketReparseAllowanceAccepted, false);
});

test("publishes no private material or inflated product and campaign claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text, /TinyRustLM-vnext-private|build\.stderr\.bin contents/iu);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  const permittedTrueClaims = new Set([
    "realConversionAttemptRegistered",
    "msvcEnvironmentAuthorityMaterialized",
    "privateCustodyRequestCreated",
    "rustBuildCustodyCompleted",
    "rustBuildAttempted",
    "rustChildExitedZero",
    "requiredConverterBuildOutputObserved"
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
