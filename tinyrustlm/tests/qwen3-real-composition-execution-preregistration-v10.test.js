"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v10.json");
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

test("freezes the output-free tenth real-composition registration", () => {
  assert.equal(profileBytes.length, 61465);
  assert.equal(sha256(profileBytes),
    "4256f69fb5df43564ce9c703c5b9b70351826b3d33fe9e54f91bfdc39ef64318");
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v10");
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/10");
  assert.equal(profile.status,
    "registered-before-custodied-build-requests-roots-and-real-output");
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-unversioned-product");
  assert.equal(profile.authority.productV1Exists, false);
  assert.equal(profile.authority.productV2Exists, false);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds terminal execution nine and all eight earlier terminal results", () => {
  assert.deepEqual(profile.predecessor, {
    profilePath: "contracts/vnext/qwen3-real-composition-execution-preregistration.v9.json",
    profileByteLength: 64780,
    profileSha256: "48982b6d0ed1a996bdd97cfcf14692c068c2ac26b1ade42d76acf1e7ba7ce8c2",
    resultPath: "contracts/vnext/qwen3-real-composition-execution-result.v9.json",
    resultByteLength: 16578,
    resultSha256: "e22ec93b089beb814ee88ba4221213e5eb73920f81fd74f5ce5eec547eab9414",
    terminalStatus: "terminal-ambiguous",
    reasonCode: "controller-raw-streams-absent-and-managed-inspection-intent-path",
    rootCauseEstablished: true,
    environmentAuthorityMaterializations: 1,
    rustBuildCustodyAttempts: 1,
    managedBuildCustodyAttempts: 1,
    converterLaunches: 1,
    managedInspectionLaunches: 1,
    outputInventoryCount: 10,
    structuralCompositionVerified: false,
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
  assert.equal(history.length, 9);
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

test("binds the exact remote parent implementation checkpoint and four registration paths", () => {
  assert.equal(profile.registrationParentCommit,
    "d8ab21cecccff7b1832f33e15226319e1cb54271");
  assert.equal(profile.registrationParentTree,
    "e60a6a97be889987b98429e1ec800ce9a82ee522");
  assert.equal(gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree);
  assert.deepEqual(profile.implementationCheckpoint, {
    commit: "a6a9a3354c1ef4fd34150829fe41e91fa3dbcf7f",
    tree: "baf3d56055fdbb0ee31b02cbe57ed8fa6d20728f",
    ownerGateStatus: "pass",
    focusedTestsPassed: 22,
    immutableV9UnionTestsPassed: 44,
    standardTestsPassed: 1446,
    standardTestsFailed: 0,
    standardDeclaredSkips: 2,
    releaseRunId: "c60ce2c5de0c77f9174ab8595cb33c0d209fb28051654a604046edb4a0ff38ac",
    releaseShardCount: 10,
    releaseTestCount: 23,
    releaseAggregateByteLength: 3995,
    releaseAggregateSha256: "e0b241870bf1ed760711a1aaeff5cf6a2c791f069eaa5e0feb0f0b40afc044b1",
    implementationIsAncestorOfRegistrationParent: true
  });
  assert.equal(gitText(["merge-base", "--is-ancestor",
    profile.implementationCheckpoint.commit, profile.registrationParentCommit]), "");
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v10.json",
    "docs/architecture/2026-08-26-qwen3-real-composition-execution-preregistration-v10.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v10.test.js"
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
    identity.ownerEvidenceRootBasename,
    identity.compositionOutputRootBasename
  ];
  assert.deepEqual(roots, [
    "qwen3-composition-rust-custody-d8ab21c-20260826-v10",
    "qwen3-composition-rust-build-d8ab21c-20260826-v10",
    "qwen3-composition-rust-environment-d8ab21c-20260826-v10",
    "qwen3-composition-managed-custody-d8ab21c-20260826-v10",
    "qwen3-composition-managed-build-d8ab21c-20260826-v10",
    "qwen3-composition-managed-environment-d8ab21c-20260826-v10",
    "qwen3-composition-verification-c1899de-d8ab21c-20260826-v10",
    "qwen3-composition-c1899de-d8ab21c-20260826-v10"
  ]);
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
  assert.equal(names.length, 15);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 15);
  assert.ok(names.every((name) => name.includes("-d8ab21c-")));
  assert.ok(names.every((name) => name.includes("-v10")));
  const absenceFields = Object.entries(identity)
    .filter(([field]) => field.endsWith("ObservedAbsentBeforeRegistration"));
  assert.equal(absenceFields.length, 15);
  assert.ok(absenceFields.every(([, value]) => value === true));
  assert.equal(identity.rootParentIsExistingDirectNonReparseDirectory, true);
  assert.equal(identity.rootsAreDirectSiblings, true);
  assert.equal(identity.requestAndEnvironmentAuthorityFilesAreDirectSiblingsOfRoots, true);
});

test("binds exact conversion inputs and current source sentinels", () => {
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
  assert.equal(profile.sourceSentinels.length, 26);
  for (const sentinel of profile.sourceSentinels) assertIdentityAtParent(sentinel);
  assert.ok(profile.sourceSentinels.some((entry) =>
    entry.path === "contracts/vnext/qwen3-composition-verification-owner-profile.v1.json" &&
    entry.byteLength === 4388 &&
    entry.sha256 === "5f7a9a25350041069f1ba6cf417f4ed0f75c6d1d96ddbbdabae3b11718247cf8"));
  assert.ok(profile.sourceSentinels.some((entry) =>
    entry.path === "tinyrustlm/tools/qwen3-composition-verification-owner.js" &&
    entry.byteLength === 81019 &&
    entry.sha256 === "3a3894bf7a9a59b08b72e71a6d87e6f817c6e51fa1b67b2f6a60a9d70fe01c85"));
  assert.ok(!profile.sourceSentinels.some((entry) =>
    entry.path.includes("qwen3-composition-execution-controller")));
});

test("binds the sole owner and incompatible closed evidence schemas", () => {
  assertIdentityAtParent(profile.soleOwner.profile);
  assertIdentityAtParent(profile.soleOwner);
  assert.deepEqual(Object.keys(profile.soleOwner),
    ["profile", "path", "byteLength", "sha256"]);
  assert.deepEqual(profile.soleOwner.profile, {
    path: "contracts/vnext/qwen3-composition-verification-owner-profile.v1.json",
    byteLength: 4388,
    sha256: "5f7a9a25350041069f1ba6cf417f4ed0f75c6d1d96ddbbdabae3b11718247cf8",
    profileId: "tinyrustlm.qwen3-composition-verification-owner/1"
  });
  assert.equal(profile.soleOwner.path,
    "tinyrustlm/tools/qwen3-composition-verification-owner.js");
  assert.equal(profile.soleOwner.byteLength, 81019);
  assert.equal(profile.soleOwner.sha256,
    "3a3894bf7a9a59b08b72e71a6d87e6f817c6e51fa1b67b2f6a60a9d70fe01c85");
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
});

test("binds sole custody V4 and exact owned application-data roots", () => {
  const custody = profile.buildCustody;
  assertIdentityAtParent(custody.profile);
  assertIdentityAtParent(custody.owner);
  assertIdentityAtParent(custody.environmentAuthority.profile);
  assertIdentityAtParent(custody.environmentAuthority.owner);
  assertIdentityAtParent(custody.scratchInspectionAuthority.profile);
  assert.equal(custody.profile.profileId, "tinyrustlm.source-controlled-build-custody/4");
  assert.equal(custody.schemas.summary, "tinyrustlm.build-custody-summary.v4");
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
  assert.deepEqual(managed.outputs.required.map((entry) => entry.relativePath), [
    "TinyRustLM.CompositionInspector.deps.json",
    "TinyRustLM.CompositionInspector.dll",
    "TinyRustLM.CompositionInspector.runtimeconfig.json",
    "TinyRustLM.Conversion.dll",
    "tinyrustlm-build-scratch-inspect.exe"
  ]);
  assert.equal(managed.restoreAllowed, false);
  assert.equal(managed.networkAllowed, false);
  assert.equal(managed.incrementalBuildAllowed, false);
});

test("registers the closed private request and one owner-controlled execution", () => {
  const request = profile.privateVerificationRequest;
  assert.equal(request.schema, "tinyrustlm.qwen3-composition-verification-request.v1");
  assert.deepEqual(request.canonicalFieldsInOrder,
    ["schema", "executionId", "registration", "custody", "inputs", "invocation"]);
  assert.equal(request.writeMode, "create-only");
  assert.equal(request.materializedOnlyAfterRegistrationRemoteExact, true);
  assert.equal(request.materializedOnlyAfterBothBuildCustodyTerminalsPass, true);
  assert.equal(request.containsAbsolutePrivatePaths, true);
  assert.equal(request.privatePathsPublished, false);
  assert.equal(request.maximumBytes, 262144);
  assert.equal(request.closedUnknownFieldsReject, true);
  assert.equal(request.reorderedFieldsReject, true);
  assert.equal(request.outputDerivedFieldsAllowed, false);
  const execution = profile.ownerExecution;
  assert.equal(execution.ownerInvocationCount, 1);
  assert.equal(execution.converterLaunchCount, 1);
  assert.equal(execution.managedInspectionLaunchCount, 1);
  assert.equal(execution.ownerConstructsManagedIntent, true);
  assert.equal(execution.nativeWindowsChildPathsRequired, true);
  assert.equal(execution.automaticRetry, false);
  assert.equal(execution.manualRetryUnderThisRegistration, false);
  assert.equal(execution.bestOfN, false);
  assert.equal(execution.responseRepair, false);
  assert.equal(execution.cleanupAllowed, false);
  assert.equal(execution.outputAdoptionAllowed, false);
});

test("requires exact ten-file evidence and application-state-complete V6 verification", () => {
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
  assert.equal(profile.privateEvidenceFiles.ownerConsoleStreamsAreEvidence, false);
  assert.equal(profile.privateEvidenceFiles.createOnly, true);
  assert.equal(profile.privateEvidenceFiles.finalVerificationWrittenLast, true);
  assert.equal(profile.verificationRecord.schema,
    "tinyrustlm.qwen3-composition-execution-verification.v6");
  assert.equal(profile.verificationRecord.predecessorSchemaExecutable, false);
  assert.equal(profile.verificationRecord.compatibilityReader, false);
  assert.equal(profile.verificationRecord.ownerVerifyIsReadOnly, true);
  assert.equal(profile.verificationRecord.ownerVerifyLaunchesConverter, false);
  assert.equal(profile.verificationRecord.ownerVerifyLaunchesManagedInspector, false);
  assert.equal(profile.verificationRecord.rehashesEveryEvidenceEdge, true);
  assert.equal(profile.verificationRecord.rehashesExactOutputInventory, true);
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
});

test("keeps private paths controller routes claims and campaign counters closed", () => {
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
  assert.equal(Object.hasOwn(profile, "controller"), false);
  assert.equal(Object.hasOwn(profile, "controllerRuntime"), false);
  assert.equal(Object.hasOwn(profile, "controllerExecution"), false);
  assert.equal(Object.hasOwn(profile, "managedInspection"), false);
  assert.equal(Object.hasOwn(profile.authority, "executionControllerOwner"), false);
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
