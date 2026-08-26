"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v11.json");
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

test("freezes the output-free eleventh real-composition registration", () => {
  assert.equal(profileBytes.length, 63830);
  assert.equal(sha256(profileBytes),
    "b409a66f8e7298b5c357a64c6264d810673bf118e59f09b5db831bef51d2bdd0");
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v11");
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/11");
  assert.equal(profile.status,
    "registered-before-custodied-build-requests-roots-and-real-output");
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-unversioned-product");
  assert.equal(profile.authority.productV1Exists, false);
  assert.equal(profile.authority.productV2Exists, false);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds immutable terminal execution ten and all earlier terminal results", () => {
  assert.deepEqual(profile.predecessor, {
    profilePath: "contracts/vnext/qwen3-real-composition-execution-preregistration.v10.json",
    profileByteLength: 61465,
    profileSha256: "4256f69fb5df43564ce9c703c5b9b70351826b3d33fe9e54f91bfdc39ef64318",
    resultPath: "contracts/vnext/qwen3-real-composition-execution-result.v10.json",
    resultByteLength: 18447,
    resultSha256: "6978a4f9f886c9a85e3d42aeab6b7a2b99ed5e3928e188de7536a122245b6d03",
    terminalStatus: "terminal-failure",
    reasonCode: "managed-inspection-process-not-pass",
    rootCauseEstablished: true,
    environmentAuthorityMaterializations: 1,
    rustBuildCustodyAttempts: 1,
    managedBuildCustodyAttempts: 1,
    converterLaunches: 1,
    managedInspectionLaunches: 1,
    outputInventoryCount: 10,
    structuralCompositionVerified: false,
    receiptContractDefect: {
      reasonCode: "managed-verifier-durability-contract-drift",
      producerDurabilityOperationIdRule: "parent-operation-id-plus-members-suffix",
      producerDurabilityStatus: "performed",
      managedVerifierFormerOperationIdRule: "parent-operation-id",
      managedVerifierFormerStatus: "flushed",
      correctedSourceCommit: "d766c6f1a5a3d0f5bfed5b38e48daf17397381dd",
      correctedSourceTree: "ee23a9c96205e68c15790b1c6d98e7adbefc9b12"
    },
    preservedCandidateObservation: {
      aggregateByteLength: 605429565,
      modelByteLength: 598308416,
      modelSha256: "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7",
      tokenizerByteLength: 7038773,
      tokenizerSha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b",
      acceptedAsStructurallyVerified: false,
      adoptionAllowed: false
    },
    resumeAllowed: false,
    retryAllowed: false,
    cleanupAllowed: false,
    repairAllowed: false,
    relabelAllowed: false
  });
  const history = [profile.predecessor, ...profile.priorTerminalHistory];
  assert.equal(history.length, 10);
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

test("binds the report-informed remote parent and corrected clean implementation", () => {
  assert.equal(profile.registrationParentCommit,
    "1e9b7b049012005a408e1faa1c728e7eb5d82158");
  assert.equal(profile.registrationParentTree,
    "a9c2420fef84db6cfae5b1abf350b7389c0539c7");
  assert.equal(gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree);
  assert.deepEqual(profile.implementationCheckpoint, {
    commit: "d766c6f1a5a3d0f5bfed5b38e48daf17397381dd",
    tree: "ee23a9c96205e68c15790b1c6d98e7adbefc9b12",
    receiptContractCorrectionStatus: "pass",
    managedVerifierRequiresParentPlusMembersSuffix: true,
    managedVerifierRequiresPerformedStatus: true,
    wrongParentOperationIdNegativeFixture: true,
    wrongFlushedStatusNegativeFixture: true,
    compatibilityAcceptanceAdded: false,
    standardTestsPassed: 1469,
    standardTestsFailed: 0,
    standardDeclaredSkips: 2,
    standardTestCount: 1471,
    releaseRunId: "e269baae59462488a86ff14fe6eb62cdc7c70a6ed0d6650cb553af5581584dc5",
    releaseShardCount: 10,
    releaseTestCount: 23,
    releaseAggregateByteLength: 3995,
    releaseAggregateSha256: "31616a94669f19a9153edb960ab0f14794e3b78e86af967d10a6163e34484e6e",
    cleanGateCommit: "61461718507ffddadb1aefc12b5677de2c517406",
    cleanGateTree: "e42a8289c124c191d8ce1c72fb6cf347b36ae2c1",
    implementationIsAncestorOfRegistrationParent: true,
    cleanGateIsAncestorOfRegistrationParent: true
  });
  assert.equal(gitText(["merge-base", "--is-ancestor",
    profile.implementationCheckpoint.commit, profile.registrationParentCommit]), "");
  assert.equal(gitText(["merge-base", "--is-ancestor",
    profile.implementationCheckpoint.cleanGateCommit, profile.registrationParentCommit]), "");
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v11.json",
    "docs/architecture/2026-08-26-qwen3-real-composition-execution-preregistration-v11.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v11.test.js"
  ]);
});

test("registers fifteen unique successor names without creating private material", () => {
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
    identity.rustCustodyRequestFileBasename,
    identity.managedCustodyRequestFileBasename,
    identity.verificationRequestFileBasename
  ];
  const names = [...roots, ...files];
  assert.equal(identity.executionId,
    "qwen3-composition-c1899de-1e9b7b0-20260826-v11");
  assert.equal(names.length, 15);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 15);
  assert.ok(names.every((name) => name.includes("-1e9b7b0-")));
  assert.ok(names.every((name) => name.includes("-v11")));
  const absenceFields = Object.entries(identity)
    .filter(([field]) => field.endsWith("ObservedAbsentBeforeRegistration"));
  assert.equal(absenceFields.length, 15);
  assert.ok(absenceFields.every(([, value]) => value === true));
  assert.equal(identity.rootParentIsExistingDirectNonReparseDirectory, true);
  assert.equal(identity.rootsAreDirectSiblings, true);
  assert.equal(identity.requestAndEnvironmentAuthorityFilesAreDirectSiblingsOfRoots, true);
});

test("recomputes every current source sentinel from the exact parent", () => {
  const identities = [
    ...Object.values(profile.exactInputs).filter((identity) => identity.path),
    ...profile.sourceSentinels,
    profile.buildCustody.profile,
    profile.buildCustody.owner,
    profile.buildCustody.environmentAuthority.profile,
    profile.buildCustody.environmentAuthority.owner,
    profile.buildCustody.scratchInspectionAuthority.profile,
    profile.soleOwner.profile,
    profile.soleOwner
  ];
  assert.equal(Object.values(profile.exactInputs)
    .filter((identity) => identity.path).length, 5);
  for (const identity of identities) assertIdentityAtParent(identity);
  assert.equal(profile.sourceSentinels.length, 26);
  assert.ok(profile.sourceSentinels.some((entry) =>
    entry.path === "dotnet/src/TinyRustLM.Conversion/TinyRustLmConversionTool.cs"));
  assert.ok(!profile.sourceSentinels.some((entry) =>
    entry.path.includes("qwen3-composition-execution-controller")));
});

test("keeps one closed owner contract and exact output evidence boundary", () => {
  assert.deepEqual(Object.keys(profile.soleOwner),
    ["profile", "path", "byteLength", "sha256"]);
  assert.deepEqual(profile.ownerContract.schemas, {
    request: "tinyrustlm.qwen3-composition-verification-request.v1",
    binding: "tinyrustlm.qwen3-composition-verification-binding.v1",
    start: "tinyrustlm.qwen3-composition-verification-start.v1",
    processTerminal: "tinyrustlm.qwen3-composition-verification-process-terminal.v1",
    finalVerification: "tinyrustlm.qwen3-composition-execution-verification.v6"
  });
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
  assert.deepEqual(profile.privateEvidenceFiles.names, [
    "operation.binding.json",
    "operation.start.json",
    "converter.stdout.bin",
    "converter.stderr.bin",
    "converter.process-terminal.json",
    "managed-inspection.intent.json",
    "managed-inspection.stdout.bin",
    "managed-inspection.stderr.bin",
    "managed-inspection.process-terminal.json",
    "execution.verification.json"
  ]);
  assert.equal(profile.privateEvidenceFiles.exactFileCount, 10);
  assert.equal(profile.verificationRecord.ownerVerifyIsReadOnly, true);
  assert.equal(profile.verificationRecord.rehashesEveryEvidenceEdge, true);
  assert.equal(profile.verificationRecord.rehashesExactOutputInventory, true);
});

test("keeps claims counters private paths and compatibility routes closed", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
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
});
