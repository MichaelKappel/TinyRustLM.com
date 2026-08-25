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
  "contracts/vnext/qwen3-real-composition-execution-preregistration.v3.json"
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
    maxBuffer: 1024 * 1024,
    windowsHide: true
  }).trim();
}

test("freezes the output-free third real-composition execution registration", () => {
  assert.equal(profileBytes.length, 29275);
  assert.equal(
    sha256(profileBytes),
    "b07ccd2688d6352fd7614fc2302d7aac59c63e3e4fe2a5943da7c8aa6bd1ec19"
  );
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(
    profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v3"
  );
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/3");
  assert.equal(
    profile.status,
    "registered-before-rust-and-managed-build-private-binding-and-real-output"
  );
  assert.equal(
    gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree
  );
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds both closed predecessors without authorizing reuse", () => {
  const expected = [
    [
      profile.predecessor,
      "terminal-native-rejection",
      "4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c",
      1,
      true
    ],
    [
      profile.priorTerminalHistory,
      "terminal-prelaunch-failure",
      "dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce",
      0,
      false
    ]
  ];
  for (const [entry, status, digest, launches, rootCause] of expected) {
    const resultBytes = gitBytes(profile.registrationParentCommit, entry.resultPath);
    const registrationBytes = gitBytes(profile.registrationParentCommit, entry.profilePath);
    assert.equal(resultBytes.length, entry.resultByteLength);
    assert.equal(sha256(resultBytes), digest);
    assert.equal(entry.resultSha256, digest);
    assert.equal(registrationBytes.length, entry.profileByteLength);
    assert.equal(sha256(registrationBytes), entry.profileSha256);
    assert.equal(entry.terminalStatus, status);
    assert.equal(entry.converterLaunches, launches);
    assert.equal(entry.rootCauseEstablished, rootCause);
    assert.equal(entry.resumeAllowed, false);
    assert.equal(entry.retryAllowed, false);
    assert.equal(entry.cleanupAllowed, false);
    assert.equal(entry.repairAllowed, false);
    assert.equal(entry.relabelAllowed, false);
  }
  assert.equal(profile.predecessor.managedInspectionInvoked, false);
  assert.equal(profile.priorTerminalHistory.managedInspectionInvoked, false);
});

test("binds one remote-exact source anchor and four registration-only paths", () => {
  assert.equal(
    profile.registrationParentCommit,
    "27db2cc713b0c650d30545b02bad5b1216e2e44f"
  );
  assert.equal(
    profile.registrationParentTree,
    "b4eb87a9c8038280de00a09f1b8a035d4f580dd2"
  );
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v3.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration-v3.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v3.test.js"
  ]);
  assert.equal(
    profile.sourceAnchor.registrationCommitMustBeFreshRemoteExactBeforeEitherBuild,
    true
  );
  assert.equal(profile.sourceAnchor.rustAndManagedInputsMustEqualRegistrationCommit, true);
});

test("uses five unique absent logical roots owned only by execution /3", () => {
  const roots = {
    control: profile.executionIdentity.controlRootBasename,
    rustBuild: profile.executionIdentity.rustBuildRootBasename,
    evidence: profile.executionIdentity.privateEvidenceRootBasename,
    managedBuild: profile.executionIdentity.managedBuildRootBasename,
    output: profile.executionIdentity.outputRootBasename
  };
  assert.deepEqual(roots, {
    control: "qwen3-composition-control-c1899de-20260825-v3",
    rustBuild: "qwen3-composition-build-27db2cc-20260825-v3",
    evidence: "qwen3-composition-execution-c1899de-20260825-v3",
    managedBuild: "qwen3-composition-managed-inspector-27db2cc-20260825-v3",
    output: "qwen3-composition-c1899de-20260825-v3"
  });
  assert.equal(new Set(Object.values(roots)).size, 5);
  assert.ok(Object.values(roots).every((value) => value.endsWith("-v3")));
  for (const field of [
    "controlRootObservedAbsentBeforeRegistration",
    "rustBuildRootObservedAbsentBeforeRegistration",
    "privateEvidenceRootObservedAbsentBeforeRegistration",
    "managedBuildRootObservedAbsentBeforeRegistration",
    "outputRootObservedAbsentBeforeRegistration"
  ]) {
    assert.equal(profile.executionIdentity[field], true, field);
  }
});

test("binds corrected model and composition profiles plus immutable source locks", () => {
  const expectedInputs = [
    [profile.exactInputs.modelSourceLock, 1901,
      "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d"],
    [profile.exactInputs.tokenizerSourceLock, 1108,
      "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"],
    [profile.exactInputs.modelConversionProfile, 18177,
      "fa2ce18f38129a6b106000d7802d1ea3995921e2b945ae5e52457908f548e7cf"],
    [profile.exactInputs.compositionProfile, 9764,
      "c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0"]
  ];
  for (const [entry, byteLength, digest] of expectedInputs) {
    const bytes = gitBytes(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, byteLength, entry.path);
    assert.equal(sha256(bytes), digest, entry.path);
    assert.equal(entry.byteLength, byteLength, entry.path);
    assert.equal(entry.sha256, digest, entry.path);
  }
  const model = profile.exactInputs.modelConversionProfile;
  assert.equal(model.profileId, "tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/2");
  assert.equal(model.receiptSchema, "tinyrustlm.qwen3_conversion_receipt.v2");
  assert.equal(model.physicalSourceTensorCount, 311);
  assert.equal(model.logicalOutputTensorCount, 310);
  assert.equal(model.redundantTiedOutputRequiresExactStreamedEquality, true);
  assert.equal(model.predecessorProfileExecutable, false);
  const composition = profile.exactInputs.compositionProfile;
  assert.equal(composition.profileId,
    "tinyrustlm.qwen3-complete-composition-conversion/3");
  assert.equal(composition.requiredModelConversionProfileId, model.profileId);
  assert.equal(composition.requiredModelReceiptSchema, model.receiptSchema);
  assert.equal(composition.predecessorProfileExecutable, false);
});

test("pins every executable source sentinel to the exact parent", () => {
  assert.equal(profile.sourceSentinels.length, 16);
  for (const sentinel of profile.sourceSentinels) {
    const bytes = gitBytes(profile.registrationParentCommit, sentinel.path);
    assert.equal(bytes.length, sentinel.byteLength, sentinel.path);
    assert.equal(sha256(bytes), sentinel.sha256, sentinel.path);
  }
  const executableOwnerText = profile.sourceSentinels
    .filter((entry) => /qwen3|ConversionTool|FixtureTool/u.test(entry.path))
    .map((entry) => gitBytes(profile.registrationParentCommit, entry.path).toString("utf8"))
    .join("\n");
  assert.doesNotMatch(executableOwnerText,
    /tinyrustlm\.qwen3-safetensors-to-slm2-mixed-q8\/1/u);
  assert.doesNotMatch(executableOwnerText,
    /tinyrustlm\.qwen3-complete-composition-conversion\/2/u);
  assert.doesNotMatch(executableOwnerText, /tinyrustlm\.qwen3_conversion_receipt\.v1/u);
});

test("binds the exact controller runtimes and one offline build per owner", () => {
  const controllerBytes = gitBytes(profile.registrationParentCommit, profile.controller.path);
  assert.equal(controllerBytes.length, 33731);
  assert.equal(
    sha256(controllerBytes),
    "c78b6f8d59f61299aab511365fe8a699f6cd0a7989f222b954229d1d7e0e3508"
  );
  assert.equal(profile.controllerRuntime.byteLength, 91380224);
  assert.equal(profile.controllerRuntime.sha256,
    "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088");
  assert.equal(profile.controllerRuntime.version, "v24.14.0");
  assert.equal(profile.controllerRuntime.platform, "win32");
  assert.equal(profile.controllerRuntime.architecture, "x64");
  assert.deepEqual(profile.rustBuild.command, [
    "cargo", "build", "--locked", "--release", "-p", "tinyrustlm-convert",
    "--target", "x86_64-pc-windows-msvc"
  ]);
  assert.equal(profile.rustBuild.buildAttemptLimit, 1);
  assert.equal(profile.rustBuild.automaticBuildRetry, false);
  assert.equal(profile.rustBuild.manualBuildRetryUnderThisRegistration, false);
  assert.deepEqual(profile.managedBuild.command, [
    "dotnet", "build",
    "dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj",
    "--configuration", "Release", "--no-restore", "--no-incremental", "--output",
    "private-absolute-managed-build-root"
  ]);
  assert.equal(profile.managedBuild.buildAttemptLimit, 1);
  assert.equal(profile.managedBuild.restoreAllowed, false);
  assert.equal(profile.managedBuild.networkAllowed, false);
  assert.equal(profile.managedRuntime.sdkVersion, "10.0.400");
  assert.equal(profile.managedRuntime.runtimeIdentifier, "win-x64");
  assert.equal(profile.managedRuntime.targetFramework, "net8.0");
});

test("permits one controller launch and inspect-only managed verification", () => {
  assert.equal(profile.privateRequest.writeMode, "create-only");
  assert.equal(profile.privateRequest.overwriteAllowed, false);
  assert.equal(profile.privateRequest.deleteAllowed, false);
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
  assert.equal(profile.managedInspection.automaticRetry, false);
  assert.equal(profile.managedInspection.manualRetryUnderThisRegistration, false);
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
});

test("keeps every output and broader claim false at registration", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.productBoundary.legacySupport, false);
  assert.equal(profile.productBoundary.compatibilityReaders, false);
  assert.equal(profile.productBoundary.migrationWriters, false);
  assert.equal(profile.productBoundary.aliases, false);
  assert.equal(profile.productBoundary.fallbacks, false);
  for (const [field, value] of Object.entries(profile.registrationOutputBoundary)) {
    assert.equal(value, false, field);
  }
  for (const field of [
    "rustReleaseBuildCompleted",
    "managedInspectorBuildCompleted",
    "privateRequestCreated",
    "privateExecutionBindingCreated",
    "realConverterInvoked",
    "managedInspectionInvoked",
    "structuralCompositionVerified",
    "sourceFrameworkParityVerified",
    "nativeRuntimeVerified",
    "browserWasmVerified",
    "browserChatVerified",
    "modelQualityVerified",
    "p2pAvailabilityVerified",
    "catalogAnnouncementVerified",
    "packagePublicationVerified",
    "siteDeploymentVerified",
    "memoryEndpointsVerified",
    "campaignCreditAuthorized"
  ]) {
    assert.equal(profile.claimBoundary[field], false, field);
  }
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
