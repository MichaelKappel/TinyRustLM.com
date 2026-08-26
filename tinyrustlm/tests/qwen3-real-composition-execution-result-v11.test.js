"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-result.v11.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v11.json");
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git", ["show", commit + ":" + relativePath], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

test("freezes execution /11 as one canonical managed-preflight rejection", () => {
  assert.equal(resultBytes.length, 12183);
  assert.equal(sha256(resultBytes),
    "a154c68880205fe957ab12585e119d9492fadd2c1574746786208b055e67eccb");
  assert.equal(resultBytes.toString("utf8"), JSON.stringify(result, null, 2) + "\n");
  assert.equal(result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v11");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/11");
  assert.equal(result.executionId, profile.executionIdentity.executionId);
  assert.equal(result.status, "terminal-managed-preflight-rejection");
});

test("binds immutable /10 and the exact remote /11 registration", () => {
  const predecessor = fs.readFileSync(path.join(repositoryRoot,
    result.predecessor.resultPath));
  assert.equal(predecessor.length, result.predecessor.resultByteLength);
  assert.equal(sha256(predecessor), result.predecessor.resultSha256);
  assert.equal(result.predecessor.status, "terminal-failure");
  assert.equal(result.predecessor.reused, false);
  assert.equal(result.predecessor.modified, false);

  assert.equal(profileBytes.length, result.registration.profileByteLength);
  assert.equal(sha256(profileBytes), result.registration.profileSha256);
  assert.deepEqual(gitBytes(result.registration.commit,
    result.registration.profilePath), profileBytes);
  assert.equal(childProcess.execFileSync("git",
    ["rev-parse", result.registration.commit + "^{tree}"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    }).trim(), result.registration.tree);
  assert.equal(result.registration.registrationFourWayRemoteExact, true);
  assert.equal(result.registration.allFifteenNamesAbsentAfterRemoteProof, true);
  assert.equal(result.registration.sourceChangedDuringExecution, false);
});

test("records one environment pass and one qualified Rust custody build", () => {
  const environment = result.windowsMsvcEnvironmentAuthority;
  assert.equal(environment.materialization.ownerInvocationCount, 1);
  assert.equal(environment.materialization.processExitCode, 0);
  assert.equal(environment.materialization.status, "pass");
  assert.equal(environment.evidence.publicLock.sha256,
    "5bb50e68d7fd8b05e12efae8159683a8a24040b9e1b6908184c1225260947c50");

  const custody = result.rustBuildCustody;
  assert.equal(custody.profileId, "tinyrustlm.source-controlled-build-custody/4");
  assert.equal(custody.preflight.invocationCount, 1);
  assert.equal(custody.preflight.status, "ready");
  assert.equal(custody.execution.invocationCount, 1);
  assert.equal(custody.execution.processStarted, true);
  assert.equal(custody.execution.exitCode, 0);
  assert.equal(custody.terminal.status, "pass");
  assert.equal(custody.summary.schema, "tinyrustlm.build-custody-summary.v4");
  assert.equal(custody.scratchInspection.invocationCount, 1);
  assert.equal(custody.scratchInspection.status, "pass");
  assert.equal(custody.targetInventory.requiredOutputs.length, 2);
  assert.equal(custody.custodyQualified, true);
  assert.equal(custody.retryAllowed, false);
  assert.equal(custody.outputAdoptionAllowed, false);
});

test("records the sole managed preflight as a strict source-field rejection", () => {
  const custody = result.managedBuildCustody;
  assert.equal(custody.request.schema, "tinyrustlm.build-custody-request.v4");
  assert.equal(custody.request.createOnly, true);
  assert.equal(custody.request.modifiedAfterFailure, false);
  assert.deepEqual(custody.preflight, {
    invocationCount: 1,
    status: "error",
    code: "build-custody-source-fields",
    readOnly: true,
    processStarted: false,
    controlRootCreated: false,
    targetRootCreated: false,
    environmentRootCreated: false,
    rawStreamPersistedAtInvocation: false,
    canonicalTypedErrorObserved: true
  });
  assert.deepEqual(custody.requestShapeDefect.unexpectedFields,
    ["byteLength", "sha256"]);
  assert.equal(custody.requestShapeDefect.rootCauseEstablished, true);
  assert.equal(custody.requestShapeDefect.expectedFieldClosureRejectedExtras, true);
  assert.equal(custody.execution.invocationCount, 0);
  assert.equal(custody.execution.buildAttempted, false);
  assert.equal(custody.custodyQualified, false);
  assert.equal(custody.requestRepairAllowed, false);
  assert.equal(custody.requestReplacementAllowed, false);
});

test("proves all later /11 operations and roots remained absent", () => {
  assert.deepEqual(result.laterOperationObservation, {
    compositionRequestCreated: false,
    compositionOwnerPreflightInvocationCount: 0,
    compositionOwnerExecutionInvocationCount: 0,
    converterLaunchCount: 0,
    managedInspectionInvocationCount: 0,
    privateExecutionBindingCreated: false,
    compositionArtifactCreated: false,
    privateVerificationCreated: false,
    readOnlyVerificationInvocationCount: 0
  });
  const roots = result.rootObservation;
  assert.equal(roots.registeredLogicalNameCount, 15);
  assert.equal(roots.createdLogicalNameCount, 9);
  assert.equal(roots.absentLaterLogicalNameCount, 6);
  assert.equal(roots.managedCustodyControlRootCreated, false);
  assert.equal(roots.managedCustodyTargetRootCreated, false);
  assert.equal(roots.managedCustodyEnvironmentRootCreated, false);
  assert.equal(roots.compositionRequestCreated, false);
  assert.equal(roots.ownerEvidenceRootCreated, false);
  assert.equal(roots.compositionOutputRootCreated, false);
  assert.equal(roots.allCreatedPrivateMaterialPreserved, true);
});

test("requires a source-controlled materializer before any new registration", () => {
  assert.deepEqual(result.failureDrivenCorrection, {
    requiredBeforeAnotherRegistration: true,
    sourceControlledRequestMaterializerRequired: true,
    exactFieldMappingTestRequired: true,
    unknownFieldNegativeTestRequired: true,
    canonicalRoundTripTestRequired: true,
    preflightFixtureRequired: true,
    adHocRequestTransformationAllowed: false,
    resultRepairsExecution: false,
    newRegistrationRequired: true,
    whollyNewPrivateNamesRequired: true
  });
});

test("closes /11 without retry repair replacement adoption or later work", () => {
  assert.deepEqual(result.decision, {
    status: "terminal-managed-preflight-rejection",
    reasonCode: "build-custody-source-fields",
    stage: "managed-build-custody-preflight-request-shape",
    rootCauseEstablished: true,
    registrationClosed: true,
    structuralCompositionVerified: false,
    candidateBytesMayAdvanceToNumericalParity: false,
    candidateBytesMayBeReleased: false,
    retryUnderRegistrationAllowed: false,
    existingPrivateEvidenceMayBeDeleted: false,
    existingPrivateEvidenceMayBeOverwritten: false,
    existingRequestMayBeRepaired: false,
    existingRequestMayBeReplaced: false,
    existingOutputMayBeAdopted: false,
    laterOperationsAuthorized: false,
    newAttemptRequiresNewRegistrationAndAllNewLogicalNames: true
  });
});

test("publishes no private path secret or inflated campaign claim", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text, /TinyRustLM-vnext-private/iu);
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
    "managedCustodyPreflightInvoked"
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
