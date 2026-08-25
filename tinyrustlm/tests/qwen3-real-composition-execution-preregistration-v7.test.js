"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v7.json");
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

function assertCanonicalEnvironmentNames(names) {
  assert.deepEqual(names, [...names].sort((left, right) => {
    const leftName = left.toUpperCase();
    const rightName = right.toUpperCase();
    return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
  }));
  assert.equal(new Set(names.map((name) => name.toUpperCase())).size, names.length);
}

test("freezes the output-free seventh real-composition registration", () => {
  assert.equal(profileBytes.length, 53432);
  assert.equal(
    sha256(profileBytes),
    "788f894c3e6116d3bd360386a4a1bbbe892d80f843cdf513e2ca7c781db293a1"
  );
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(
    profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v7"
  );
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/7");
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

test("binds all six terminal predecessors without reuse repair or selection", () => {
  const history = [profile.predecessor, ...profile.priorTerminalHistory];
  const expected = [
    ["terminal-rust-build-failure",
      "msvc-linker-not-found-in-registered-command-environment",
      "58d6ce16304d804d3a09cfd2c6544e8fa10b39080359040383df3f2ac68bb72c", 0,
      false],
    ["terminal-prelaunch-failure",
      "registration-commit-no-longer-remote-tip-before-private-materialization",
      "06006e0533c1f1b02492aacb8aee675ac1c5dbd50d6c3f67441b58918bd0c798", 0,
      false],
    ["terminal-prelaunch-failure", "rust-build-exit-code-not-captured",
      "c928b55cf9eb871c09b7f1e1aacf1983bf3a7e2fe6ca4697aa58c50648187a35", 0,
      false],
    ["terminal-native-rejection", "qwen-tokenizer2-output-path-invalid",
      "2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4", 1,
      true],
    ["terminal-native-rejection", "qwen3-tensor-inventory-mismatch",
      "4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c", 1,
      true],
    ["terminal-prelaunch-failure",
      "private-binding-not-created-before-evidence-root-population",
      "dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce", 0,
      false]
  ];
  assert.equal(history.length, expected.length);
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    const [status, reason, result, launches, output] = expected[index];
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
    assert.equal(entry.terminalStatus, status);
    assert.equal(entry.reasonCode, reason);
    assert.equal(entry.resultSha256, result);
    assert.equal(entry.converterLaunches, launches);
    assert.equal(entry.outputCreated, output);
    assert.equal(entry.managedInspectionInvoked, false);
    assert.equal(entry.resumeAllowed, false);
    assert.equal(entry.retryAllowed, false);
    assert.equal(entry.cleanupAllowed, false);
    assert.equal(entry.repairAllowed, false);
    assert.equal(entry.relabelAllowed, false);
  }
  assert.equal(profile.predecessor.rustCustodyProfileId,
    "tinyrustlm.source-controlled-build-custody/1");
  assert.equal(profile.predecessor.rustCustodyRequestCreated, true);
  assert.equal(profile.predecessor.rustCustodyTerminalCreated, true);
  assert.equal(profile.predecessor.rustBuildProcessExitCode, 101);
  assert.equal(profile.predecessor.rustReleaseBuildExitCodeVerified, true);
  assert.equal(profile.predecessor.existingRootCount, 2);
  assert.equal(profile.predecessor.neverCreatedLaterRootCount, 4);
});

test("binds the exact remote parent and four registration-only paths", () => {
  assert.equal(
    profile.registrationParentCommit,
    "042891879d8883d3637d1ff550f181734da6e462"
  );
  assert.equal(
    profile.registrationParentTree,
    "ca56d47dcb0e480bd3405e64590706659419142c"
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
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v7.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration-v7.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v7.test.js"
  ]);
  assert.equal(profile.sourceAnchor.registrationCommitMustBeSingleParentDescendant, true);
  assert.equal(profile.sourceAnchor.registrationCommitMustChangeOnlyAllowedPaths, true);
  assert.equal(
    profile.sourceAnchor.registrationCommitMustBeFreshRemoteExactBeforeAnyPrivateRequestOrRoot,
    true
  );
  assert.equal(profile.sourceAnchor.environmentAndBuildSourceCommitMustEqualRegistrationCommit,
    true);
  assert.equal(profile.sourceAnchor.rustAndManagedInputsMustEqualRegistrationCommit, true);
  assert.equal(profile.sourceAnchor
    .sourceMayNotChangeBetweenEnvironmentMaterializationEitherBuildAndCompositionExecution,
  true);
});

test("registers fifteen unique absent private names and eight independent roots", () => {
  const roots = [
    profile.executionIdentity.rustCustodyControlRootBasename,
    profile.executionIdentity.rustCustodyTargetRootBasename,
    profile.executionIdentity.rustCustodyEnvironmentRootBasename,
    profile.executionIdentity.managedCustodyControlRootBasename,
    profile.executionIdentity.managedCustodyTargetRootBasename,
    profile.executionIdentity.managedCustodyEnvironmentRootBasename,
    profile.executionIdentity.controllerEvidenceRootBasename,
    profile.executionIdentity.compositionOutputRootBasename
  ];
  assert.deepEqual(roots, [
    "qwen3-composition-rust-custody-0428918-20260825-v7",
    "qwen3-composition-rust-build-0428918-20260825-v7",
    "qwen3-composition-rust-environment-0428918-20260825-v7",
    "qwen3-composition-managed-custody-0428918-20260825-v7",
    "qwen3-composition-managed-build-0428918-20260825-v7",
    "qwen3-composition-managed-environment-0428918-20260825-v7",
    "qwen3-composition-execution-c1899de-20260825-v7",
    "qwen3-composition-c1899de-20260825-v7"
  ]);
  const files = [
    profile.executionIdentity.environmentAuthorityRequestFileBasename,
    profile.executionIdentity.environmentAuthorityPrivateBindingFileBasename,
    profile.executionIdentity.environmentAuthorityPublicLockFileBasename,
    profile.executionIdentity.environmentAuthorityTerminalFileBasename,
    profile.executionIdentity.rustCustodyRequestFileBasename,
    profile.executionIdentity.managedCustodyRequestFileBasename,
    profile.executionIdentity.compositionRequestFileBasename
  ];
  const logicalNames = [...roots, ...files];
  assert.equal(logicalNames.length, 15);
  assert.equal(new Set(logicalNames.map((name) => name.toLowerCase())).size, 15);
  assert.ok(logicalNames.every((name) => name.includes("-v7")));
  const absenceFields = Object.entries(profile.executionIdentity)
    .filter(([field]) => field.endsWith("ObservedAbsentBeforeRegistration"));
  assert.equal(absenceFields.length, 15);
  assert.ok(absenceFields.every(([, value]) => value === true));
  assert.equal(profile.executionIdentity.rootParentIsExistingDirectNonReparseDirectory,
    true);
  assert.equal(profile.executionIdentity.rootsAreDirectSiblings, true);
  assert.equal(profile.executionIdentity
    .requestAndEnvironmentAuthorityFilesAreDirectSiblingsOfRoots, true);
  assert.equal(profile.executionIdentity.environmentAuthorityOutputFilesAreDistinct, true);
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
  assert.equal(tokenizer.predecessorProfileExecutable, false);
  const model = profile.exactInputs.modelConversionProfile;
  assert.equal(model.physicalSourceTensorCount, 311);
  assert.equal(model.logicalOutputTensorCount, 310);
  assert.equal(model.redundantTiedOutputRequiresExactStreamedEquality, true);
  assert.equal(model.predecessorProfileExecutable, false);
  const composition = profile.exactInputs.compositionProfile;
  assert.equal(composition.requiredModelConversionProfileId, model.profileId);
  assert.equal(composition.requiredTokenizerConversionProfileId, tokenizer.profileId);
  assert.equal(composition.obsoleteTokenizerFileSuffixAccepted, false);
  assert.equal(composition.predecessorProfileExecutable, false);
});

test("binds custody V2 the environment authority and twenty source sentinels", () => {
  assertIdentityAtParent(profile.buildCustody.profile);
  assertIdentityAtParent(profile.buildCustody.owner);
  assertIdentityAtParent(profile.buildCustody.environmentAuthority.profile);
  assertIdentityAtParent(profile.buildCustody.environmentAuthority.owner);
  assert.equal(profile.sourceSentinels.length, 20);
  for (const sentinel of profile.sourceSentinels) assertIdentityAtParent(sentinel);
  assert.deepEqual(profile.buildCustody.schemas, {
    request: "tinyrustlm.build-custody-request.v2",
    binding: "tinyrustlm.build-custody-binding.v2",
    start: "tinyrustlm.build-custody-start.v2",
    processTerminal: "tinyrustlm.build-custody-process-terminal.v2",
    terminal: "tinyrustlm.build-custody-terminal.v2",
    summary: "tinyrustlm.build-custody-summary.v2"
  });
  assert.equal(profile.buildCustody.profile.profileId,
    "tinyrustlm.source-controlled-build-custody/2");
  assert.equal(profile.buildCustody.processTerminalFsyncedBeforeOutputAndScratchInventory,
    true);
  assert.equal(profile.buildCustody.environmentAuthorityPlusRequestBoundSupplementOnly,
    true);
  assert.equal(profile.buildCustody.authorityOwnsPathLibLibpathAndCargoTargetLinker, true);
  assert.equal(profile.buildCustody.callerFullEnvironmentAccepted, false);
  assert.equal(profile.buildCustody.ambientDeveloperShellAccepted, false);
  assert.equal(profile.buildCustody.globalProcessEnvironmentMutation, false);
  assert.equal(profile.buildCustody.controlTargetAndEnvironmentRootsMustBeAbsent, true);
  assert.equal(profile.buildCustody.compatibilityAllowed, false);
  assert.equal(profile.buildCustody.fallbackAllowed, false);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /contracts\/vnext\/build-custody-profile\.v1\.json/u);
});

test("registers one immutable linker-complete MSVC authority materialization", () => {
  const environment = profile.windowsMsvcEnvironmentAuthority;
  assert.equal(environment.operationId, "qwen3-composition-v7-msvc-environment");
  assert.equal(environment.requestFileBasename,
    profile.executionIdentity.environmentAuthorityRequestFileBasename);
  assert.equal(environment.privateBindingFileBasename,
    profile.executionIdentity.environmentAuthorityPrivateBindingFileBasename);
  assert.equal(environment.publicLockFileBasename,
    profile.executionIdentity.environmentAuthorityPublicLockFileBasename);
  assert.equal(environment.terminalFileBasename,
    profile.executionIdentity.environmentAuthorityTerminalFileBasename);
  assert.deepEqual(environment.discoveryTool, {
    executableBasename: "vswhere.exe",
    byteLength: 469456,
    sha256: "c54f3b7c9164ea9a0db8641e81ecdda80c2664ef5a47c4191406f848cc07c662",
    absolutePathCapturedOnlyInPrivateRequest: true
  });
  assert.deepEqual(environment.selection, {
    visualStudioProductLineVersion: "2022",
    minimumInstallationVersion: "17.0.0.0",
    maximumInstallationVersionExclusive: "18.0.0.0",
    minimumWindowsSdkVersion: "10.0.20000.0",
    maximumWindowsSdkVersionExclusive: "11.0.0.0"
  });
  assert.equal(environment.targetTriple, "x86_64-pc-windows-msvc");
  assert.equal(environment.materializedOnlyAfterRegistrationRemoteExact, true);
  assert.equal(environment.sourceCommitMustEqualRegistrationCommit, true);
  assert.equal(environment.materializationInvocationCount, 1);
  assert.equal(environment.buildProbeAllowed, false);
  assert.equal(environment.networkAllowed, false);
  assert.equal(environment.automaticRetry, false);
  assert.equal(environment.manualRetryUnderThisRegistration, false);
  assert.equal(environment.cleanupAllowed, false);
  assert.equal(environment.partialMaterializationReusable, false);
  assert.equal(profile.buildCustody.environmentAuthority
    .sharedImmutableMaterializationForBothCustodyOperations, true);
  assert.equal(profile.buildCustody.environmentAuthority
    .freshExactNodeValidationImmediatelyBeforeChildLaunch, true);
  assert.equal(profile.buildCustody.environmentAuthority
    .freshExactNodeValidationAfterEveryChildOutcome, true);
  assert.equal(profile.buildCustody.environmentAuthority
    .postChildDriftHasCustodyFailurePrecedence, true);
});

test("pins exact Git Node taskkill Cargo rustc and dotnet identities", () => {
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

test("registers one bounded V2 custody launch per build owner", () => {
  const baseline = ["HOMEDRIVE", "HOMEPATH", "LOGONSERVER", "SYSTEMDRIVE",
    "SYSTEMROOT", "TEMP", "USERDOMAIN", "USERNAME", "USERPROFILE", "WINDIR"];
  const authorityNames = ["CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER", "LIB",
    "LIBPATH", "PATH"];
  for (const build of [profile.rustBuildCustody, profile.managedBuildCustody]) {
    const names = build.command.supplementalEnvironmentNamesInCanonicalOrder;
    const upper = names.map((name) => name.toUpperCase());
    assertCanonicalEnvironmentNames(names);
    assert.ok(baseline.every((name) => upper.includes(name)));
    assert.ok(authorityNames.every((name) => !upper.includes(name)));
    assert.equal(build.requestSchema, "tinyrustlm.build-custody-request.v2");
    assert.equal(build.environmentAuthorityOperationId,
      profile.windowsMsvcEnvironmentAuthority.operationId);
    assert.equal(build.requestWriteMode, "create-only");
    assert.equal(build.preflightBeforeAllThreeRootCreations, true);
    assert.equal(build.preflightIsReadOnly, true);
    assert.equal(build.executeInvocationCount, 1);
    assert.equal(build.observeMayReconnectWithoutRerun, true);
    assert.equal(build.successRequiresCustodyTerminalPass, true);
    assert.equal(build.terminalRootCannotBeReusedAsControllerEvidence, true);
    const outputPaths = build.outputs.required.map((entry) => entry.relativePath);
    assert.deepEqual(outputPaths, [...outputPaths].sort());
  }
  assert.equal(profile.rustBuildCustody.operationId,
    "qwen3-composition-v7-rust-build");
  assert.equal(profile.rustBuildCustody.environmentRootBasename,
    profile.executionIdentity.rustCustodyEnvironmentRootBasename);
  assert.equal(profile.rustBuildCustody.command.targetDirectoryEnvironmentMustEqualRegisteredTargetRoot,
    true);
  assert.equal(profile.rustBuildCustody.command.userProfileMustEqualEnvironmentRootHome, true);
  assert.equal(profile.rustBuildCustody.command.tempAndTmpMustEqualEnvironmentRootTemp, true);
  assert.equal(profile.managedBuildCustody.operationId,
    "qwen3-composition-v7-managed-inspector-build");
  assert.equal(profile.managedBuildCustody.environmentRootBasename,
    profile.executionIdentity.managedCustodyEnvironmentRootBasename);
  assert.equal(profile.managedBuildCustody.materializedOnlyAfterRustCustodyPass, true);
  assert.equal(profile.managedBuildCustody.command.cliHomeMustEqualEnvironmentRootHome, true);
  assert.equal(profile.managedBuildCustody.command.userProfileMustEqualEnvironmentRootHome,
    true);
  assert.equal(profile.managedBuildCustody.command.tempAndTmpMustEqualEnvironmentRootTemp,
    true);
  assert.equal(profile.managedBuildCustody.restoreAllowed, false);
  assert.equal(profile.managedBuildCustody.networkAllowed, false);
  assert.equal(profile.managedBuildCustody.incrementalBuildAllowed, false);
});

test("permits one controller launch one read-only inspection and V3 verification", () => {
  assert.equal(profile.privateCompositionRequest.fileName,
    "qwen3-composition-execution-request-c1899de-20260825-v7.json");
  assert.equal(profile.privateCompositionRequest.writeMode, "create-only");
  assert.equal(profile.privateCompositionRequest
    .materializedOnlyAfterBothBuildCustodyTerminalsPass, true);
  assert.equal(profile.privateCompositionRequest
    .buildEnvironmentMustBindCustodyV2PublicSummaries, true);
  assert.equal(profile.privateCompositionRequest
    .buildEnvironmentMustBindSharedMsvcPublicLock, true);
  assert.equal(profile.controllerExecution.controllerInvocationCount, 1);
  assert.equal(profile.controllerExecution.converterLaunchCount, 1);
  assert.equal(profile.controllerExecution.automaticRetry, false);
  assert.equal(profile.controllerExecution.manualRetryUnderThisRegistration, false);
  assert.equal(profile.controllerExecution.bestOfN, false);
  assert.equal(profile.controllerExecution.responseRepair, false);
  assert.equal(profile.managedInspection.invocationCount, 1);
  assert.equal(profile.managedInspection.converterProcessApiAvailable, false);
  assert.equal(profile.managedInspection.converterLaunchAllowed, false);
  assert.equal(profile.managedInspection.operation, "read-only-no-converter-launch");
  assert.equal(profile.verificationRecord.schema,
    "tinyrustlm.qwen3-composition-execution-verification.v3");
  assert.ok(profile.verificationRecord.canonicalFieldsInOrder
    .includes("environmentAuthority"));
  assert.ok(profile.verificationRecord.environmentAuthorityFields
    .includes("selectedClosureIdentity"));
  assert.ok(profile.verificationRecord.buildCustodyFields
    .includes("rustEnvironmentAuthorityPostChild"));
  assert.ok(profile.verificationRecord.buildCustodyFields
    .includes("managedEnvironmentScratchInventory"));
  assert.ok(profile.terminalDecision.passRequires
    .includes("one-environment-authority-materialization-pass"));
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
});

test("keeps private paths claims and campaign counters closed", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.authority.writeDriveDAllowed, false);
  assert.equal(profile.productBoundary.legacySupport, false);
  assert.equal(profile.productBoundary.compatibilityReaders, false);
  assert.equal(profile.productBoundary.migrationWriters, false);
  assert.equal(profile.productBoundary.productVersionSelectors, false);
  assert.equal(profile.productBoundary.aliases, false);
  assert.equal(profile.productBoundary.fallbacks, false);
  assert.equal(profile.productBoundary.automaticRetry, false);
  assert.equal(profile.productBoundary.manualRetryOfThisExecution, false);
  assert.equal(profile.productBoundary.bestOfN, false);
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
