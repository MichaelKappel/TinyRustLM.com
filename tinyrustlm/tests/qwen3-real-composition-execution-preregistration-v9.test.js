"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v9.json");
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

test("freezes the output-free ninth real-composition registration", () => {
  assert.equal(profileBytes.length, 64780);
  assert.equal(sha256(profileBytes),
    "48982b6d0ed1a996bdd97cfcf14692c068c2ac26b1ade42d76acf1e7ba7ce8c2");
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v9");
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/9");
  assert.equal(profile.status,
    "registered-before-custodied-build-requests-roots-and-real-output");
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-unversioned-product");
  assert.equal(profile.authority.productV1Exists, false);
  assert.equal(profile.authority.productV2Exists, false);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds terminal execution eight and all seven earlier terminal results", () => {
  assert.deepEqual(profile.predecessor, {
    profilePath: "contracts/vnext/qwen3-real-composition-execution-preregistration.v8.json",
    profileByteLength: 61969,
    profileSha256: "4a7e255c500ef87e3ddac4d7befb7331232167e7bcf47aae6cdabfbd752fec21",
    resultPath: "contracts/vnext/qwen3-real-composition-execution-result.v8.json",
    resultByteLength: 16999,
    resultSha256: "9caa23225dfa2b0e01f4bfd550c0a4cf178d4d7db2f301159f0e2b040dd94f40",
    terminalStatus: "terminal-managed-build-failure",
    reasonCode: "managed-dotnet-child-nonzero-assets-lock-read-failure",
    rootCauseEstablished: false,
    rustCustodyProfileId: "tinyrustlm.source-controlled-build-custody/3",
    rustCustodyRequestCreated: true,
    rustCustodyTerminalCreated: true,
    rustBuildProcessExitCode: 0,
    rustReleaseBuildAttempts: 1,
    rustReleaseBuildExitCodeVerified: true,
    managedInspectorBuildAttempts: 1,
    converterLaunches: 0,
    bindingCreated: false,
    outputCreated: false,
    managedInspectionInvoked: false,
    preservedCandidateObservation: {
      byteLength: 852992,
      sha256: "c90d963752f92c7de10866d071a9086334d5b80160de8815a508df2ff0a8d48c",
      peMachine: "0x8664",
      acceptedAsSuccessfulBuild: false,
      adoptionAllowed: false
    },
    existingRootCount: 12,
    neverCreatedLaterRootCount: 3,
    resumeAllowed: false,
    retryAllowed: false,
    cleanupAllowed: false,
    repairAllowed: false,
    relabelAllowed: false
  });
  const history = [profile.predecessor, ...profile.priorTerminalHistory];
  assert.equal(history.length, 8);
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
    assert.equal(entry.managedInspectionInvoked, false);
    assert.equal(entry.resumeAllowed, false);
    assert.equal(entry.retryAllowed, false);
    assert.equal(entry.cleanupAllowed, false);
    assert.equal(entry.repairAllowed, false);
    assert.equal(entry.relabelAllowed, false);
  }
});

test("binds the exact remote parent and four registration-only paths", () => {
  assert.equal(profile.registrationParentCommit,
    "157b96bd949b0d62ca3478eb29e57da3d11a7430");
  assert.equal(profile.registrationParentTree,
    "1145eed94206b7775f16ef2282954d510674fb43");
  assert.equal(gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v9.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration-v9.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v9.test.js"
  ]);
  assert.equal(profile.sourceAnchor.registrationCommitMustBeSingleParentDescendant, true);
  assert.equal(profile.sourceAnchor.registrationCommitMustChangeOnlyAllowedPaths, true);
  assert.equal(profile.sourceAnchor
    .registrationCommitMustBeFreshRemoteExactBeforeAnyPrivateRequestOrRoot, true);
  assert.equal(profile.sourceAnchor.environmentAndBuildSourceCommitMustEqualRegistrationCommit,
    true);
  assert.equal(profile.sourceAnchor.rustAndManagedInputsMustEqualRegistrationCommit, true);
  assert.equal(profile.sourceAnchor
    .sourceMayNotChangeBetweenEnvironmentMaterializationEitherBuildAndCompositionExecution,
  true);
});

test("registers fifteen unique absent private names and eight independent roots", () => {
  const identity = profile.executionIdentity;
  const roots = [
    identity.rustCustodyControlRootBasename,
    identity.rustCustodyTargetRootBasename,
    identity.rustCustodyEnvironmentRootBasename,
    identity.managedCustodyControlRootBasename,
    identity.managedCustodyTargetRootBasename,
    identity.managedCustodyEnvironmentRootBasename,
    identity.controllerEvidenceRootBasename,
    identity.compositionOutputRootBasename
  ];
  assert.deepEqual(roots, [
    "qwen3-composition-rust-custody-157b96b-20260825-v9",
    "qwen3-composition-rust-build-157b96b-20260825-v9",
    "qwen3-composition-rust-environment-157b96b-20260825-v9",
    "qwen3-composition-managed-custody-157b96b-20260825-v9",
    "qwen3-composition-managed-build-157b96b-20260825-v9",
    "qwen3-composition-managed-environment-157b96b-20260825-v9",
    "qwen3-composition-execution-c1899de-157b96b-20260825-v9",
    "qwen3-composition-c1899de-157b96b-20260825-v9"
  ]);
  const files = [
    identity.environmentAuthorityRequestFileBasename,
    identity.environmentAuthorityPrivateBindingFileBasename,
    identity.environmentAuthorityPublicLockFileBasename,
    identity.environmentAuthorityTerminalFileBasename,
    identity.rustCustodyRequestFileBasename,
    identity.managedCustodyRequestFileBasename,
    identity.compositionRequestFileBasename
  ];
  const names = [...roots, ...files];
  assert.equal(names.length, 15);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 15);
  assert.ok(names.every((name) => name.includes("-157b96b-")));
  assert.ok(names.every((name) => name.includes("-v9")));
  const absenceFields = Object.entries(identity)
    .filter(([field]) => field.endsWith("ObservedAbsentBeforeRegistration"));
  assert.equal(absenceFields.length, 15);
  assert.ok(absenceFields.every(([, value]) => value === true));
  assert.equal(identity.rootParentIsExistingDirectNonReparseDirectory, true);
  assert.equal(identity.rootsAreDirectSiblings, true);
  assert.equal(identity.requestAndEnvironmentAuthorityFilesAreDirectSiblingsOfRoots, true);
});

test("binds exact conversion inputs and sole current source sentinels", () => {
  const expectedInputs = [
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
  for (const [identity, length, digest] of expectedInputs) {
    assertIdentityAtParent(identity);
    assert.equal(identity.byteLength, length);
    assert.equal(identity.sha256, digest);
  }
  assert.equal(profile.sourceSentinels.length, 25);
  for (const sentinel of profile.sourceSentinels) assertIdentityAtParent(sentinel);
  assert.ok(profile.sourceSentinels.some((entry) =>
    entry.path === "contracts/vnext/build-custody-profile.v4.json" &&
    entry.byteLength === 10274 &&
    entry.sha256 === "26b75c36911c14d744a764c19d8a40ec0c28762add5e6616501080120aad9b45"));
  assert.ok(profile.sourceSentinels.some((entry) =>
    entry.path === "tinyrustlm/tools/build-custody-owner.js" &&
    entry.byteLength === 103310 &&
    entry.sha256 === "4d0a86fccc7c798866a0c36538adb78bf73cb383f9d74e03d8794edf264040df"));
});

test("binds sole custody V4 and exact owned application data roots", () => {
  const custody = profile.buildCustody;
  assertIdentityAtParent(custody.profile);
  assertIdentityAtParent(custody.owner);
  assertIdentityAtParent(custody.environmentAuthority.profile);
  assertIdentityAtParent(custody.environmentAuthority.owner);
  assertIdentityAtParent(custody.scratchInspectionAuthority.profile);
  assert.deepEqual(custody.profile, {
    path: "contracts/vnext/build-custody-profile.v4.json",
    byteLength: 10274,
    sha256: "26b75c36911c14d744a764c19d8a40ec0c28762add5e6616501080120aad9b45",
    profileId: "tinyrustlm.source-controlled-build-custody/4"
  });
  assert.deepEqual(custody.schemas, {
    request: "tinyrustlm.build-custody-request.v4",
    binding: "tinyrustlm.build-custody-binding.v4",
    start: "tinyrustlm.build-custody-start.v4",
    processTerminal: "tinyrustlm.build-custody-process-terminal.v4",
    scratchInspectionProcessTerminal:
      "tinyrustlm.build-custody-scratch-inspection-process-terminal.v4",
    terminal: "tinyrustlm.build-custody-terminal.v4",
    summary: "tinyrustlm.build-custody-summary.v4"
  });
  assert.deepEqual(custody.environmentRootDirectoriesBeforeChildLaunch, [
    "home", "home/AppData", "home/AppData/Local", "home/AppData/Roaming", "temp"
  ]);
  assert.deepEqual(custody.ownedApplicationDataBindings, {
    APPDATA: "environment-root/home/AppData/Roaming",
    LOCALAPPDATA: "environment-root/home/AppData/Local",
    TEMP: "environment-root/temp",
    TMP: "environment-root/temp"
  });
  assert.equal(custody.applicationDataBindingsCrossValidatedBeforeRootCreation, true);
  assert.equal(custody.applicationDataBindingsRevalidatedBeforeLaunch, true);
  assert.equal(custody.applicationDataBindingsRevalidatedAfterChild, true);
  assert.equal(custody.applicationDataBindingsRevalidatedAfterScratchInspection, true);
  assert.equal(custody.compatibilityAllowed, false);
  assert.equal(custody.fallbackAllowed, false);
  assert.equal(Object.hasOwn(custody, "environmentRootContainsOwnedHomeAndTempOnlyBeforeChildLaunch"),
    false);
});

test("pins exact Git Node taskkill Cargo rustc and dotnet identities", () => {
  assert.equal(profile.buildCustody.sourceControlTool.sha256,
    "c470d205517c7a53ceca321df16a6e4549fcd52b576ab4d09536d36f26fda5a9");
  assert.equal(profile.buildCustody.runtime.sha256,
    "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088");
  assert.equal(profile.buildCustody.terminationTool.sha256,
    "81e9649b317de9243bf7f34e436e86159ba267d86349fa47efdb71dde2fc7bc5");
  assert.equal(profile.rustBuildCustody.command.sha256,
    "122f18d28a63fa358f3db266abee1ff1d8aabf0ab7f2dd9ac38a38da99977ae5");
  assert.equal(profile.rustToolchain.rustc.sha256,
    "acb138286bbe20c6cf3ec39a7e0a68c3fab0cd949baa2912cf466514d0d531ab");
  assert.equal(profile.managedBuildCustody.command.sha256,
    "ab1b71fd3dd71062e074c9fab8312081a81b7f2b3e0327c48c4d249c8d1a3135");
  assert.equal(profile.managedRuntime.sdkVersion, "10.0.400");
  assert.equal(profile.managedRuntime.hostVersion, "10.0.11");
  assert.equal(profile.managedRuntime.runtimeIdentifier, "win-x64");
});

test("registers one Rust and one managed custody launch with owned state", () => {
  const rust = profile.rustBuildCustody;
  const managed = profile.managedBuildCustody;
  for (const build of [rust, managed]) {
    assertCanonicalEnvironmentNames(build.command.supplementalEnvironmentNamesInCanonicalOrder);
    assert.ok(build.command.supplementalEnvironmentNamesInCanonicalOrder.includes("APPDATA"));
    assert.ok(build.command.supplementalEnvironmentNamesInCanonicalOrder.includes("LOCALAPPDATA"));
    assert.equal(build.command.appDataMustEqualEnvironmentRootRoamingAppData, true);
    assert.equal(build.command.localAppDataMustEqualEnvironmentRootLocalAppData, true);
    assert.equal(build.command.tempAndTmpMustEqualEnvironmentRootTemp, true);
    assert.equal(build.requestSchema, "tinyrustlm.build-custody-request.v4");
    assert.equal(build.executeInvocationCount, 1);
    assert.equal(build.observeMayReconnectWithoutRerun, true);
    assert.equal(build.successRequiresCustodyTerminalPass, true);
  }
  assert.deepEqual(rust.command.arguments, [
    "build", "--locked", "--release", "-p", "tinyrustlm-build-custody",
    "-p", "tinyrustlm-convert", "--target", "x86_64-pc-windows-msvc"
  ]);
  assert.deepEqual(rust.outputs.required.map((entry) => entry.relativePath), [
    "x86_64-pc-windows-msvc/release/tinyrustlm-build-scratch-inspect.exe",
    "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe"
  ]);
  assert.equal(managed.command.scratchInspectorSourceMustEqualQualifiedRustOutput, true);
  assert.deepEqual(managed.outputs.required.map((entry) => entry.relativePath), [
    "TinyRustLM.CompositionInspector.deps.json",
    "TinyRustLM.CompositionInspector.dll",
    "TinyRustLM.CompositionInspector.runtimeconfig.json",
    "TinyRustLM.Conversion.dll",
    "tinyrustlm-build-scratch-inspect.exe"
  ]);
  assert.equal(managed.stagedScratchInspectorMustEqualRustQualifiedOutput, true);
  assert.equal(managed.restoreAllowed, false);
  assert.equal(managed.networkAllowed, false);
  assert.equal(managed.incrementalBuildAllowed, false);
});

test("permits one controller launch and one read-only managed inspection", () => {
  assert.equal(profile.controller.byteLength, 33811);
  assert.equal(profile.controller.sha256,
    "c26633570f00155454842f56d23c27944b57091cd7f492c4f0bdde6386b3fdf6");
  assert.equal(profile.privateCompositionRequest.writeMode, "create-only");
  assert.equal(profile.privateCompositionRequest
    .materializedOnlyAfterBothBuildCustodyTerminalsPass, true);
  assert.equal(profile.privateCompositionRequest
    .buildEnvironmentMustBindCustodyV4PublicSummaries, true);
  assert.equal(Object.hasOwn(profile.privateCompositionRequest,
    "buildEnvironmentMustBindCustodyV3PublicSummaries"), false);
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
});

test("requires one incompatible application-state-complete V5 verification", () => {
  const verification = profile.verificationRecord;
  assert.equal(verification.schema,
    "tinyrustlm.qwen3-composition-execution-verification.v5");
  assert.equal(verification.predecessorSchemaExecutable, false);
  assert.equal(verification.compatibilityReader, false);
  assert.ok(verification.buildCustodyFields.includes("rustOwnedApplicationDataBindings"));
  assert.ok(verification.buildCustodyFields.includes("managedOwnedApplicationDataBindings"));
  assert.ok(verification.buildCustodyFields.includes("rustEnvironmentRootPreLaunchInventory"));
  assert.ok(verification.buildCustodyFields.includes("managedEnvironmentRootPreLaunchInventory"));
  assert.ok(profile.terminalDecision.passRequires
    .includes("rust-owned-appdata-localappdata-temp-tmp-bindings-pass"));
  assert.ok(profile.terminalDecision.passRequires
    .includes("managed-owned-appdata-localappdata-temp-tmp-bindings-pass"));
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
});

test("keeps private paths claims and campaign counters closed", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.authority.writeDriveDAllowed, false);
  assert.equal(profile.productBoundary.legacySupport, false);
  assert.equal(profile.productBoundary.compatibilityReaders, false);
  assert.equal(profile.productBoundary.migrationWriters, false);
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
