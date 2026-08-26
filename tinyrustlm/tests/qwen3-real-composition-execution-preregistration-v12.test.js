"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v12.json");
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

function gitText(args) {
  return childProcess.execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function assertIdentityAtParent(identity) {
  const bytes = gitBytes(profile.registrationParentCommit, identity.path);
  assert.equal(bytes.length, identity.byteLength, identity.path);
  assert.equal(sha256(bytes), identity.sha256, identity.path);
}

function walkStrings(value, visit, currentPath = "") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      walkStrings(entry, visit, `${currentPath}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      walkStrings(entry, visit, currentPath ? `${currentPath}.${key}` : key);
    }
    return;
  }
  if (typeof value === "string") visit(currentPath, value);
}

test("freezes the output-free twelfth real-composition registration", () => {
  assert.equal(profileBytes.length, 73049);
  assert.equal(sha256(profileBytes),
    "de6211ec7077068bbe8dee751c2c65e158f9f4e21a632d5fcf7c4cd3f90966ee");
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v12");
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/12");
  assert.equal(profile.status,
    "registered-before-custodied-build-requests-roots-and-real-output");
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-unversioned-product");
  assert.equal(profile.authority.productV1Exists, false);
  assert.equal(profile.authority.productV2Exists, false);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds terminal execution eleven and all earlier terminal results", () => {
  assert.deepEqual(profile.predecessor, {
    profilePath: "contracts/vnext/qwen3-real-composition-execution-preregistration.v11.json",
    profileByteLength: 63830,
    profileSha256: "b409a66f8e7298b5c357a64c6264d810673bf118e59f09b5db831bef51d2bdd0",
    resultPath: "contracts/vnext/qwen3-real-composition-execution-result.v11.json",
    resultByteLength: 12183,
    resultSha256: "a154c68880205fe957ab12585e119d9492fadd2c1574746786208b055e67eccb",
    terminalStatus: "terminal-managed-preflight-rejection",
    reasonCode: "build-custody-source-fields",
    rootCauseEstablished: true,
    registrationCommit: "644878a51c84e8fa9673a24d2440f7701e3aa076",
    registrationTree: "c2118b4742d6e43501c429bd432fb77f32ac6830",
    environmentAuthorityMaterializations: 1,
    rustBuildCustodyAttempts: 1,
    managedRequestMaterializations: 1,
    managedBuildCustodyPreflightInvocations: 1,
    managedBuildCustodyAttempts: 0,
    converterLaunches: 0,
    managedInspectionLaunches: 0,
    outputInventoryCount: 0,
    structuralCompositionVerified: false,
    requestShapeDefect: {
      reasonCode: "managed-request-materializer-added-unexpected-source-artifact-fields",
      unexpectedFields: ["byteLength", "sha256"],
      exactFieldClosureRejectedExtras: true,
      sourceControlledOwnerDefectEstablished: false,
      requestMayBeRepaired: false,
      correctedBySeparateMaterializerCommit:
        "6471a526d1957bcdcf297ee5fbe02888f51b8062"
    },
    createdLogicalNameCount: 9,
    absentLaterLogicalNameCount: 6,
    resumeAllowed: false,
    retryAllowed: false,
    cleanupAllowed: false,
    repairAllowed: false,
    relabelAllowed: false
  });
  const history = [profile.predecessor, ...profile.priorTerminalHistory];
  assert.equal(history.length, 11);
  assert.equal(new Set(history.map((entry) => entry.profilePath)).size, history.length);
  for (const entry of history) {
    assertIdentityAtParent({
      path: entry.profilePath,
      byteLength: entry.profileByteLength,
      sha256: entry.profileSha256
    });
    assertIdentityAtParent({
      path: entry.resultPath,
      byteLength: entry.resultByteLength,
      sha256: entry.resultSha256
    });
    assert.equal(entry.resumeAllowed, false);
    assert.equal(entry.retryAllowed, false);
    assert.equal(entry.cleanupAllowed, false);
    assert.equal(entry.repairAllowed, false);
    assert.equal(entry.relabelAllowed, false);
  }
});

test("binds the remote-exact materializer memory parent and implementation", () => {
  assert.equal(profile.registrationParentCommit,
    "908e73fa6ddeab65e2d556a3e49ba106fa4d1227");
  assert.equal(profile.registrationParentTree,
    "8637cf7c67d3a69baa8ae13648cbd1801fcf6bff");
  assert.equal(gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v12.json",
    "docs/architecture/2026-08-26-qwen3-real-composition-execution-preregistration-v12.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v12.test.js"
  ]);

  const checkpoint = profile.implementationCheckpoint;
  assert.equal(checkpoint.commit,
    "6471a526d1957bcdcf297ee5fbe02888f51b8062");
  assert.equal(checkpoint.tree,
    "233bede47f1feb4e40c6c2514695d26007e74e8d");
  assert.equal(checkpoint.memoryCheckpointCommit, profile.registrationParentCommit);
  assert.equal(checkpoint.memoryCheckpointTree, profile.registrationParentTree);
  assert.equal(checkpoint.requestMaterializerStatus, "pass");
  assert.equal(checkpoint.exactNamedMapping, true);
  assert.equal(checkpoint.producerRequestValidatorBeforeWrite, true);
  assert.equal(checkpoint.execution11MalformedShapeNegativeFixture, true);
  assert.equal(checkpoint.compatibilityAcceptanceAdded, false);
  assert.equal(checkpoint.focusedMaterializerTestsPassed, 8);
  assert.equal(checkpoint.focusedCustodyOwnerTestsPassed, 22);
  assert.equal(checkpoint.standardTestsPassed, 1493);
  assert.equal(checkpoint.standardTestsFailed, 0);
  assert.equal(checkpoint.standardDeclaredSkips, 2);
  assert.equal(checkpoint.standardTestCount, 1495);
  assert.equal(checkpoint.dirtyReleaseCorrectlyRejected, true);
  assert.equal(checkpoint.releaseRunId,
    "df84111d709bbcc4159a651e1995e06f9f37cc3af41ac866b5b3d8127004b6d0");
  assert.equal(checkpoint.releaseTestCount, 23);
  assert.equal(checkpoint.releaseAggregateSha256,
    "a1fdfdde067c3292327277b4976e8f04098e869edfe25c2c469388fdf09399c1");

  for (const identity of [checkpoint.profile, checkpoint.tool,
    checkpoint.materializerTest, checkpoint.custodyOwnerIntegrationTest,
    checkpoint.architecture, checkpoint.durableMemory]) {
    assertIdentityAtParent(identity);
  }
  assert.equal(gitText(["merge-base", "--is-ancestor",
    checkpoint.commit, profile.registrationParentCommit]), "");
  assert.equal(gitText(["merge-base", "--is-ancestor",
    profile.receiptContractCheckpoint.commit, profile.registrationParentCommit]), "");
});

test("registers seventeen wholly new absent logical names", () => {
  const identity = profile.executionIdentity;
  const roots = [
    identity.rustCustodyControlRootBasename,
    identity.rustCustodyTargetRootBasename,
    identity.rustCustodyEnvironmentRootBasename,
    identity.managedCustodyControlRootBasename,
    identity.managedCustodyTargetRootBasename,
    identity.managedCustodyEnvironmentRootBasename,
    identity.ownerEvidenceRootBasename,
    identity.compositionOutputRootBasename
  ];
  const files = [
    identity.environmentAuthorityRequestFileBasename,
    identity.environmentAuthorityPrivateBindingFileBasename,
    identity.environmentAuthorityPublicLockFileBasename,
    identity.environmentAuthorityTerminalFileBasename,
    identity.rustCustodyIntentFileBasename,
    identity.rustCustodyRequestFileBasename,
    identity.managedCustodyIntentFileBasename,
    identity.managedCustodyRequestFileBasename,
    identity.verificationRequestFileBasename
  ];
  const names = [...roots, ...files];
  assert.equal(identity.executionId,
    "qwen3-composition-c1899de-908e73f-20260826-v12");
  assert.equal(names.length, 17);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 17);
  assert.ok(names.every((name) => name.includes("-908e73f-")));
  assert.ok(names.every((name) => name.includes("-v12")));
  const absenceFields = Object.entries(identity)
    .filter(([field]) => field.endsWith("ObservedAbsentBeforeRegistration"));
  assert.equal(absenceFields.length, 17);
  assert.ok(absenceFields.every(([, value]) => value === true));
  assert.equal(identity.rootParentIsExistingDirectNonReparseDirectory, true);
  assert.equal(identity.rootsAreDirectSiblings, true);
  assert.equal(identity.requestAndEnvironmentAuthorityFilesAreDirectSiblingsOfRoots, true);
});

test("binds one exact materializer with two ordered one-shot requests", () => {
  const materializer = profile.requestMaterializer;
  assertIdentityAtParent(materializer.profile);
  assertIdentityAtParent(materializer.owner);
  assert.deepEqual(materializer.schemas, {
    intent: "tinyrustlm.build-custody-request-materialization-intent.v1",
    request: "tinyrustlm.build-custody-request.v4",
    summary: "tinyrustlm.build-custody-request-materialization-summary.v1",
    error: "tinyrustlm.build-custody-request-materialization-error.v1"
  });
  assert.deepEqual(materializer.commands, ["materialize"]);
  assert.equal(materializer.exactOrderedClosedIntent, true);
  assert.equal(materializer.explicitRoleSpecificMapping, true);
  assert.equal(materializer.producerRequestValidatorBeforeWrite, true);
  assert.equal(materializer.outputWriteMode, "create-only");
  assert.equal(materializer.outputFileFlushRequired, true);
  assert.equal(materializer.outputDirectoryDurabilityClaimed, false);
  assert.equal(materializer.genericFlattening, false);
  assert.equal(materializer.recursiveKeyReplacement, false);
  assert.equal(materializer.compatibilityReader, false);
  assert.equal(materializer.fallbackAllowed, false);
  assert.equal(materializer.retryAllowed, false);
  assert.equal(materializer.repairAllowed, false);
  assert.equal(materializer.overwriteAllowed, false);
  assert.equal(materializer.materializations.length, 2);
  assert.deepEqual(materializer.materializations.map((entry) => entry.role),
    ["rust-build-custody", "managed-build-custody"]);
  assert.deepEqual(materializer.materializations.map((entry) =>
    entry.materializedOnlyAfter), [
    "windows-msvc-environment-authority-pass",
    "rust-build-custody-terminal-pass"
  ]);
  assert.ok(materializer.materializations.every((entry) =>
    entry.maximumInvocationCount === 1 &&
    entry.materializedOnlyAfterRegistrationRemoteExact === true));
  assert.equal(materializer.anyFailureClosesRegistration, true);
  assert.equal(materializer.failedIntentOrRequestMayBeRepaired, false);
  assert.equal(materializer.failedIntentOrRequestMayBeDeleted, false);
  assert.equal(materializer.failedIntentOrRequestMayBeReplaced, false);
  assert.equal(materializer.campaignCreditAuthorized, false);

  assert.equal(profile.rustBuildCustody.intentFileBasename,
    profile.executionIdentity.rustCustodyIntentFileBasename);
  assert.equal(profile.rustBuildCustody.requestFileBasename,
    profile.executionIdentity.rustCustodyRequestFileBasename);
  assert.equal(profile.rustBuildCustody.materializerInvocationCount, 1);
  assert.equal(profile.rustBuildCustody.materializedOnlyAfterEnvironmentAuthorityPass, true);
  assert.equal(profile.managedBuildCustody.intentFileBasename,
    profile.executionIdentity.managedCustodyIntentFileBasename);
  assert.equal(profile.managedBuildCustody.requestFileBasename,
    profile.executionIdentity.managedCustodyRequestFileBasename);
  assert.equal(profile.managedBuildCustody.materializerInvocationCount, 1);
  assert.equal(profile.managedBuildCustody.materializedOnlyAfterRustCustodyPass, true);
});

test("recomputes all current source and owner identities from the parent", () => {
  const exactInputs = Object.values(profile.exactInputs)
    .filter((identity) => identity.path);
  assert.equal(exactInputs.length, 7);
  const identities = [
    ...exactInputs,
    ...profile.sourceSentinels,
    profile.buildCustody.profile,
    profile.buildCustody.owner,
    profile.buildCustody.environmentAuthority.profile,
    profile.buildCustody.environmentAuthority.owner,
    profile.buildCustody.scratchInspectionAuthority.profile,
    profile.soleOwner.profile,
    profile.soleOwner
  ];
  for (const identity of identities) assertIdentityAtParent(identity);
  assert.equal(profile.sourceSentinels.length, 26);
  assert.ok(profile.sourceSentinels.some((entry) =>
    entry.path === "dotnet/src/TinyRustLM.Conversion/TinyRustLmConversionTool.cs"));
  assert.ok(!profile.sourceSentinels.some((entry) =>
    entry.path.includes("qwen3-composition-execution-controller")));
});

test("keeps the composition owner and terminal evidence boundary closed", () => {
  assert.deepEqual(Object.keys(profile.soleOwner),
    ["profile", "path", "byteLength", "sha256"]);
  assert.deepEqual(profile.ownerContract.commands, ["preflight", "execute", "verify"]);
  assert.equal(profile.ownerContract.compatibilityReader, false);
  assert.equal(profile.ownerContract.migrationWriter, false);
  assert.equal(profile.ownerContract.fallbackAllowed, false);
  assert.equal(profile.privateVerificationRequest.writeMode, "create-only");
  assert.equal(profile.privateVerificationRequest.materializedOnlyAfterRegistrationRemoteExact,
    true);
  assert.equal(profile.privateVerificationRequest.materializedOnlyAfterBothBuildCustodyTerminalsPass,
    true);
  assert.equal(profile.ownerExecution.ownerInvocationCount, 1);
  assert.equal(profile.ownerExecution.converterLaunchCount, 1);
  assert.equal(profile.ownerExecution.managedInspectionLaunchCount, 1);
  assert.equal(profile.ownerExecution.automaticRetry, false);
  assert.equal(profile.ownerExecution.manualRetryUnderThisRegistration, false);
  assert.equal(profile.ownerExecution.bestOfN, false);
  assert.equal(profile.ownerExecution.responseRepair, false);
  assert.equal(profile.ownerExecution.cleanupAllowed, false);
  assert.equal(profile.ownerExecution.outputAdoptionAllowed, false);
  assert.equal(profile.verificationRecord.ownerVerifyIsReadOnly, true);
  assert.equal(profile.verificationRecord.rehashesEveryEvidenceEdge, true);
  assert.equal(profile.verificationRecord.rehashesExactOutputInventory, true);
});

test("keeps active identities claims paths and compatibility routes closed", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.claimBoundary.requestMaterializerCleanGated, true);
  assert.equal(profile.claimBoundary.rustCustodyIntentCreated, false);
  assert.equal(profile.claimBoundary.managedCustodyIntentCreated, false);
  assert.equal(profile.claimBoundary.structuralCompositionVerified, false);
  assert.equal(profile.claimBoundary.sourceFrameworkParityVerified, false);
  assert.equal(profile.claimBoundary.nativeRuntimeVerified, false);
  assert.equal(profile.claimBoundary.browserWasmVerified, false);
  assert.equal(profile.claimBoundary.browserChatVerified, false);
  assert.equal(profile.claimBoundary.modelQualityVerified, false);
  assert.equal(profile.claimBoundary.p2pAvailabilityVerified, false);
  assert.equal(profile.claimBoundary.siteDeploymentVerified, false);
  assert.equal(profile.claimBoundary.campaignCreditAuthorized, false);
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
  assert.equal(profile.terminalDecision.anyTerminalDecisionClosesRegistration, true);
  assert.equal(profile.terminalDecision.newAttemptRequiresNewRegistrationAndAllNewLogicalRoots,
    true);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
  assert.equal(profile.terminalDecision.outputMayBeAdopted, false);
  assert.equal(profile.productBoundary.legacySupport, false);
  assert.equal(profile.productBoundary.compatibilityReaders, false);
  assert.equal(profile.productBoundary.migrationWriters, false);
  assert.equal(profile.productBoundary.aliases, false);
  assert.equal(profile.productBoundary.temporaryAdapters, false);
  assert.equal(profile.productBoundary.fallbacks, false);

  const activeStrings = [];
  for (const [key, value] of Object.entries(profile)) {
    if (key === "predecessor" || key === "priorTerminalHistory") continue;
    walkStrings(value, (valuePath, entry) => activeStrings.push([`${key}.${valuePath}`, entry]));
  }
  assert.deepEqual(activeStrings.filter(([, value]) =>
    value.includes("1e9b7b0") || value.includes("-v11")), []);
});
