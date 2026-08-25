"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-preregistration.v6.json"
);
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

test("freezes the output-free sixth real-composition registration", () => {
  assert.equal(profileBytes.length, 42975);
  assert.equal(
    sha256(profileBytes),
    "c1c89b1e1739d45c52c43e706b566418947a354f089a546dd99624bfff40a7fd"
  );
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(
    profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v6"
  );
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/6");
  assert.equal(
    profile.status,
    "registered-before-custodied-build-requests-roots-and-real-output"
  );
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-unversioned-product");
  assert.equal(profile.authority.productV1Exists, false);
  assert.equal(profile.authority.productV2Exists, false);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds all five terminal predecessors without reuse or adoption", () => {
  const history = [profile.predecessor, ...profile.priorTerminalHistory];
  const expected = [
    {
      status: "terminal-prelaunch-failure",
      reason: "registration-commit-no-longer-remote-tip-before-private-materialization",
      result: "06006e0533c1f1b02492aacb8aee675ac1c5dbd50d6c3f67441b58918bd0c798",
      launches: 0,
      output: false
    },
    {
      status: "terminal-prelaunch-failure",
      reason: "rust-build-exit-code-not-captured",
      result: "c928b55cf9eb871c09b7f1e1aacf1983bf3a7e2fe6ca4697aa58c50648187a35",
      launches: 0,
      output: false
    },
    {
      status: "terminal-native-rejection",
      reason: "qwen-tokenizer2-output-path-invalid",
      result: "2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4",
      launches: 1,
      output: true
    },
    {
      status: "terminal-native-rejection",
      reason: "qwen3-tensor-inventory-mismatch",
      result: "4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c",
      launches: 1,
      output: true
    },
    {
      status: "terminal-prelaunch-failure",
      reason: "private-binding-not-created-before-evidence-root-population",
      result: "dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce",
      launches: 0,
      output: false
    }
  ];
  assert.equal(history.length, expected.length);
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    const wanted = expected[index];
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
    assert.equal(entry.terminalStatus, wanted.status);
    assert.equal(entry.reasonCode, wanted.reason);
    assert.equal(entry.resultSha256, wanted.result);
    assert.equal(entry.converterLaunches, wanted.launches);
    assert.equal(entry.outputCreated, wanted.output);
    assert.equal(entry.managedInspectionInvoked, false);
    assert.equal(entry.resumeAllowed, false);
    assert.equal(entry.retryAllowed, false);
    assert.equal(entry.cleanupAllowed, false);
    assert.equal(entry.repairAllowed, false);
    assert.equal(entry.relabelAllowed, false);
  }
  assert.equal(profile.predecessor.rustReleaseBuildAttempts, 0);
  assert.equal(profile.predecessor.preservedCandidateObservation, null);
  assert.deepEqual(profile.priorTerminalHistory[1].partialModel, {
    byteLength: 598308416,
    sha256: "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7",
    tensorCount: 310,
    completeCompositionCreated: false
  });
});

test("binds the exact remote parent and four registration-only paths", () => {
  assert.equal(
    profile.registrationParentCommit,
    "331b0a1917f92861b33b92ff09460d4426e3dd4f"
  );
  assert.equal(
    profile.registrationParentTree,
    "38cdc49101d737bfd0a1cfe1ce5ce39d59018d1c"
  );
  assert.equal(
    gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree
  );
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v6.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration-v6.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v6.test.js"
  ]);
  assert.equal(profile.sourceAnchor.registrationCommitMustBeSingleParentDescendant, true);
  assert.equal(profile.sourceAnchor.registrationCommitMustChangeOnlyAllowedPaths, true);
  assert.equal(
    profile.sourceAnchor.registrationCommitMustBeFreshRemoteExactBeforeAnyPrivateRequestOrRoot,
    true
  );
  assert.equal(profile.sourceAnchor.rustAndManagedInputsMustEqualRegistrationCommit, true);
  assert.equal(profile.sourceAnchor.sourceMayNotChangeBetweenEitherBuildAndCompositionExecution,
    true);
});

test("uses six unique roots and three create-only request files", () => {
  const roots = [
    profile.executionIdentity.rustCustodyControlRootBasename,
    profile.executionIdentity.rustCustodyTargetRootBasename,
    profile.executionIdentity.managedCustodyControlRootBasename,
    profile.executionIdentity.managedCustodyTargetRootBasename,
    profile.executionIdentity.controllerEvidenceRootBasename,
    profile.executionIdentity.compositionOutputRootBasename
  ];
  assert.deepEqual(roots, [
    "qwen3-composition-rust-custody-331b0a1-20260825-v6",
    "qwen3-composition-rust-build-331b0a1-20260825-v6",
    "qwen3-composition-managed-custody-331b0a1-20260825-v6",
    "qwen3-composition-managed-build-331b0a1-20260825-v6",
    "qwen3-composition-execution-c1899de-20260825-v6",
    "qwen3-composition-c1899de-20260825-v6"
  ]);
  assert.equal(new Set(roots).size, 6);
  assert.ok(roots.every((value) => value.endsWith("-v6")));
  const requestFiles = [
    profile.executionIdentity.rustCustodyRequestFileBasename,
    profile.executionIdentity.managedCustodyRequestFileBasename,
    profile.executionIdentity.compositionRequestFileBasename
  ];
  assert.deepEqual(requestFiles, [
    "rust-build-custody-request-331b0a1-20260825-v6.json",
    "managed-build-custody-request-331b0a1-20260825-v6.json",
    "qwen3-composition-execution-request-c1899de-20260825-v6.json"
  ]);
  assert.equal(new Set(requestFiles).size, 3);
  for (const field of [
    "rustCustodyControlRootObservedAbsentBeforeRegistration",
    "rustCustodyTargetRootObservedAbsentBeforeRegistration",
    "managedCustodyControlRootObservedAbsentBeforeRegistration",
    "managedCustodyTargetRootObservedAbsentBeforeRegistration",
    "controllerEvidenceRootObservedAbsentBeforeRegistration",
    "compositionOutputRootObservedAbsentBeforeRegistration",
    "rustCustodyRequestFileObservedAbsentBeforeRegistration",
    "managedCustodyRequestFileObservedAbsentBeforeRegistration",
    "compositionRequestFileObservedAbsentBeforeRegistration"
  ]) {
    assert.equal(profile.executionIdentity[field], true, field);
  }
  assert.equal(profile.executionIdentity.rootsAreDirectSiblings, true);
  assert.equal(profile.executionIdentity.requestFilesAreDirectSiblingsOfRoots, true);
});

test("binds every exact conversion input and sole clean-cut profile", () => {
  const expected = [
    [profile.exactInputs.modelSourceLock, 1901,
      "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d"],
    [profile.exactInputs.tokenizerSourceLock, 1108,
      "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"],
    [profile.exactInputs.tokenizerConversionProfile, 8394,
      "97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4"],
    [profile.exactInputs.modelConversionProfile, 18177,
      "fa2ce18f38129a6b106000d7802d1ea3995921e2b945ae5e52457908f548e7cf"],
    [profile.exactInputs.compositionProfile, 11421,
      "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8"]
  ];
  for (const [identity, byteLength, digest] of expected) {
    assertIdentityAtParent(identity);
    assert.equal(identity.byteLength, byteLength);
    assert.equal(identity.sha256, digest);
  }
  const tokenizer = profile.exactInputs.tokenizerConversionProfile;
  assert.equal(tokenizer.requiredFileSuffix, ".tokenizer2");
  assert.equal(tokenizer.requiredCompositionFile, "tokenizer.tokenizer2");
  assert.equal(tokenizer.internalBinaryFormatIdIsFileSuffix, false);
  assert.equal(tokenizer.predecessorProfileExecutable, false);
  const model = profile.exactInputs.modelConversionProfile;
  assert.equal(model.physicalSourceTensorCount, 311);
  assert.equal(model.logicalOutputTensorCount, 310);
  assert.equal(model.redundantTiedOutputRequiresExactStreamedEquality, true);
  assert.equal(model.predecessorProfileExecutable, false);
  const composition = profile.exactInputs.compositionProfile;
  assert.equal(composition.requiredModelConversionProfileId, model.profileId);
  assert.equal(composition.requiredModelReceiptSchema, model.receiptSchema);
  assert.equal(composition.requiredTokenizerConversionProfileId, tokenizer.profileId);
  assert.equal(composition.requiredTokenizerReceiptSchema, tokenizer.receiptSchema);
  assert.equal(composition.obsoleteTokenizerFileSuffixAccepted, false);
  assert.equal(composition.predecessorProfileExecutable, false);
});

test("pins custody schemas and every executable source sentinel", () => {
  assertIdentityAtParent(profile.buildCustody.profile);
  assertIdentityAtParent(profile.buildCustody.owner);
  assert.equal(profile.sourceSentinels.length, 18);
  for (const sentinel of profile.sourceSentinels) assertIdentityAtParent(sentinel);
  assert.deepEqual(profile.buildCustody.schemas, {
    request: "tinyrustlm.build-custody-request.v1",
    binding: "tinyrustlm.build-custody-binding.v1",
    start: "tinyrustlm.build-custody-start.v1",
    processTerminal: "tinyrustlm.build-custody-process-terminal.v1",
    terminal: "tinyrustlm.build-custody-terminal.v1",
    summary: "tinyrustlm.build-custody-summary.v1"
  });
  assert.equal(profile.buildCustody.processTerminalWrittenFromChildExitBeforeOptionalDiagnostics,
    true);
  assert.equal(profile.buildCustody.processTerminalFsyncedBeforeOutputInventory, true);
  assert.equal(profile.buildCustody.ambientEnvironmentClearedDuringProcessCreation, true);
  assert.equal(profile.buildCustody.observerDeathDoesNotCancelOwner, true);
  assert.equal(profile.buildCustody.retryCount, 0);
  assert.equal(profile.buildCustody.resumeAllowed, false);
  assert.equal(profile.buildCustody.cleanupAllowed, false);
  assert.equal(profile.buildCustody.adoptionAllowed, false);
});

test("binds exact Git Node taskkill Cargo rustc and dotnet identities", () => {
  assert.deepEqual(profile.buildCustody.sourceControlTool, {
    executableBasename: "git.exe",
    byteLength: 46920,
    sha256: "c470d205517c7a53ceca321df16a6e4549fcd52b576ab4d09536d36f26fda5a9",
    version: "2.55.0.windows.4",
    absolutePathCapturedOnlyInPrivateRequests: true
  });
  assert.equal(profile.buildCustody.runtime.byteLength, 91380224);
  assert.equal(profile.buildCustody.runtime.sha256,
    "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088");
  assert.equal(profile.buildCustody.runtime.version, "v24.14.0");
  assert.equal(profile.buildCustody.terminationTool.byteLength, 114688);
  assert.equal(profile.buildCustody.terminationTool.sha256,
    "81e9649b317de9243bf7f34e436e86159ba267d86349fa47efdb71dde2fc7bc5");
  assert.equal(profile.rustBuildCustody.command.byteLength, 31347200);
  assert.equal(profile.rustBuildCustody.command.sha256,
    "122f18d28a63fa358f3db266abee1ff1d8aabf0ab7f2dd9ac38a38da99977ae5");
  assert.equal(profile.rustBuildCustody.command.pathRustupProxyAccepted, false);
  assert.equal(profile.rustToolchain.rustc.byteLength, 111104);
  assert.equal(profile.rustToolchain.rustc.sha256,
    "acb138286bbe20c6cf3ec39a7e0a68c3fab0cd949baa2912cf466514d0d531ab");
  assert.equal(profile.managedBuildCustody.command.byteLength, 167208);
  assert.equal(profile.managedBuildCustody.command.sha256,
    "ab1b71fd3dd71062e074c9fab8312081a81b7f2b3e0327c48c4d249c8d1a3135");
  assert.equal(profile.managedRuntime.sdkVersion, "10.0.400");
  assert.equal(profile.managedRuntime.hostVersion, "10.0.11");
  assert.equal(profile.managedRuntime.runtimeIdentifier, "win-x64");
});

test("registers one bounded custodied build per owner", () => {
  assert.equal(profile.rustBuildCustody.operationId,
    "qwen3-composition-v6-rust-build");
  assert.deepEqual(profile.rustBuildCustody.command.arguments, [
    "build", "--locked", "--release", "-p", "tinyrustlm-convert",
    "--target", "x86_64-pc-windows-msvc"
  ]);
  assert.equal(profile.managedBuildCustody.operationId,
    "qwen3-composition-v6-managed-inspector-build");
  assert.deepEqual(profile.managedBuildCustody.command.arguments, [
    "build",
    "dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj",
    "--configuration", "Release", "--no-restore", "--no-incremental", "--output",
    "private-absolute-managed-custody-target-root"
  ]);
  for (const build of [profile.rustBuildCustody, profile.managedBuildCustody]) {
    const names = build.command.environmentNamesInCanonicalOrder;
    assert.deepEqual(names, [...names].sort((left, right) =>
      left.toUpperCase().localeCompare(right.toUpperCase(), "en")));
    const outputPaths = build.outputs.required.map((entry) => entry.relativePath);
    assert.deepEqual(outputPaths, [...outputPaths].sort());
    assert.equal(build.requestWriteMode, "create-only");
    assert.equal(build.preflightIsReadOnly, true);
    assert.equal(build.executeInvocationCount, 1);
    assert.equal(build.observeMayReconnectWithoutRerun, true);
    assert.equal(build.successRequiresCustodyTerminalPass, true);
    assert.equal(build.terminalRootCannotBeReusedAsControllerEvidence, true);
  }
  assert.equal(profile.rustBuildCustody.capture.maximumDurationMilliseconds, 7200000);
  assert.equal(profile.rustBuildCustody.outputs.maximumAggregateBytes, 1073741824);
  assert.equal(profile.managedBuildCustody.materializedOnlyAfterRustCustodyPass, true);
  assert.equal(profile.managedBuildCustody.outputs.maximumAggregateBytes, 536870912);
  assert.equal(profile.managedBuildCustody.restoreAllowed, false);
  assert.equal(profile.managedBuildCustody.networkAllowed, false);
  assert.equal(profile.managedBuildCustody.incrementalBuildAllowed, false);
});

test("permits one controller launch and conditional read-only inspection", () => {
  assert.equal(profile.privateCompositionRequest.fileName,
    "qwen3-composition-execution-request-c1899de-20260825-v6.json");
  assert.equal(profile.privateCompositionRequest.writeMode, "create-only");
  assert.equal(profile.privateCompositionRequest
    .materializedOnlyAfterBothBuildCustodyTerminalsPass, true);
  assert.equal(profile.privateCompositionRequest.overwriteAllowed, false);
  assert.equal(profile.privateCompositionRequest.deleteAllowed, false);
  assert.equal(profile.controllerExecution.controllerInvocationCount, 1);
  assert.equal(profile.controllerExecution.converterLaunchCount, 1);
  assert.equal(profile.controllerExecution.automaticRetry, false);
  assert.equal(profile.controllerExecution.manualRetryUnderThisRegistration, false);
  assert.equal(profile.controllerExecution.bestOfN, false);
  assert.equal(profile.controllerExecution.responseRepair, false);
  assert.equal(profile.managedInspection.invocationCount, 1);
  assert.equal(profile.managedInspection.intentCreatedOnlyAfterControllerTerminal, true);
  assert.equal(profile.managedInspection.converterProcessApiAvailable, false);
  assert.equal(profile.managedInspection.converterLaunchAllowed, false);
  assert.equal(profile.managedInspection.operation, "read-only-no-converter-launch");
  assert.equal(profile.managedInspection.automaticRetry, false);
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
});

test("keeps private paths claims and campaign counters closed", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text, /6890b9d|307b940|81631d0/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.productBoundary.legacySupport, false);
  assert.equal(profile.productBoundary.compatibilityReaders, false);
  assert.equal(profile.productBoundary.migrationWriters, false);
  assert.equal(profile.productBoundary.productVersionSelectors, false);
  assert.equal(profile.productBoundary.aliases, false);
  assert.equal(profile.productBoundary.fallbacks, false);
  for (const [field, value] of Object.entries(profile.registrationOutputBoundary)) {
    assert.equal(value, false, field);
  }
  for (const [field, value] of Object.entries(profile.claimBoundary)) {
    if (field === "realConversionAttemptRegistered" ||
        field === "requiredNextGateAfterStructuralPass") continue;
    assert.equal(value, false, field);
  }
  assert.equal(profile.claimBoundary.realConversionAttemptRegistered, true);
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
