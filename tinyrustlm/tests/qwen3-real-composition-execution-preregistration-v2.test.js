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
  "contracts/vnext/qwen3-real-composition-execution-preregistration.v2.json"
);
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync(
    "git",
    ["show", `${commit}:${relativePath}`],
    {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true
    }
  );
}

function gitText(args) {
  return childProcess.execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true
  }).trim();
}

test("freezes the output-free second real-composition execution registration", () => {
  assert.equal(profileBytes.length, 27596);
  assert.equal(
    sha256(profileBytes),
    "cfc924334083d5623852511950d48486b2bbb80d3aa9d7e403c7d957b2f89a5f"
  );
  assert.equal(
    profileBytes.toString("utf8"),
    `${JSON.stringify(profile, null, 2)}\n`
  );
  assert.equal(
    profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v2"
  );
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/2");
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

test("binds the closed predecessor without authorizing resume or repair", () => {
  assert.equal(
    profile.predecessor.resultSha256,
    "dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce"
  );
  const bytes = gitBytes(
    profile.registrationParentCommit,
    profile.predecessor.resultPath
  );
  assert.equal(bytes.length, profile.predecessor.resultByteLength);
  assert.equal(sha256(bytes), profile.predecessor.resultSha256);
  assert.equal(profile.predecessor.terminalStatus, "terminal-prelaunch-failure");
  assert.equal(profile.predecessor.rootCauseEstablished, false);
  assert.equal(profile.predecessor.converterLaunches, 0);
  for (const field of [
    "resumeAllowed",
    "retryAllowed",
    "cleanupAllowed",
    "repairAllowed",
    "relabelAllowed"
  ]) {
    assert.equal(profile.predecessor[field], false, field);
  }
});

test("binds one remote source anchor and a registration-only path set", () => {
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(
    profile.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration,
    true
  );
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v2.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration-v2.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v2.test.js"
  ]);
  assert.equal(
    profile.sourceAnchor.registrationCommitMustBeFreshRemoteExactBeforeEitherBuild,
    true
  );
  assert.equal(profile.sourceAnchor.rustAndManagedInputsMustEqualRegistrationCommit,
    true);
});

test("uses five fresh logical roots and no predecessor root", () => {
  assert.deepEqual(
    {
      control: profile.executionIdentity.controlRootBasename,
      rustBuild: profile.executionIdentity.rustBuildRootBasename,
      evidence: profile.executionIdentity.privateEvidenceRootBasename,
      managedBuild: profile.executionIdentity.managedBuildRootBasename,
      output: profile.executionIdentity.outputRootBasename
    },
    {
      control: "qwen3-composition-control-c1899de-20260825-v2",
      rustBuild: "qwen3-composition-build-3e3b06e-20260825-v2",
      evidence: "qwen3-composition-execution-c1899de-20260825-v2",
      managedBuild: "qwen3-composition-managed-inspector-3e3b06e-20260825-v2",
      output: "qwen3-composition-c1899de-20260825-v2"
    }
  );
  for (const field of [
    "controlRootObservedAbsentBeforeRegistration",
    "rustBuildRootObservedAbsentBeforeRegistration",
    "privateEvidenceRootObservedAbsentBeforeRegistration",
    "managedBuildRootObservedAbsentBeforeRegistration",
    "outputRootObservedAbsentBeforeRegistration"
  ]) {
    assert.equal(profile.executionIdentity[field], true, field);
  }
  const names = Object.values(profile.executionIdentity)
    .filter((value) => typeof value === "string" && value.includes("Root"));
  assert.ok(names.every((value) => !value.endsWith("-v1")));
});

test("binds exact model tokenizer composition controller and runtime identities", () => {
  const expectedInputs = [
    [profile.exactInputs.modelSourceLock, 1901,
      "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d"],
    [profile.exactInputs.tokenizerSourceLock, 1108,
      "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"],
    [profile.exactInputs.compositionProfile, 8835,
      "d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718"]
  ];
  for (const [entry, byteLength, digest] of expectedInputs) {
    const bytes = gitBytes(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, byteLength, entry.path);
    assert.equal(sha256(bytes), digest, entry.path);
    assert.equal(entry.byteLength, byteLength, entry.path);
    assert.equal(entry.sha256, digest, entry.path);
  }

  const controllerBytes = gitBytes(
    profile.registrationParentCommit,
    profile.controller.path
  );
  assert.equal(controllerBytes.length, 33731);
  assert.equal(
    sha256(controllerBytes),
    "c78b6f8d59f61299aab511365fe8a699f6cd0a7989f222b954229d1d7e0e3508"
  );
  assert.equal(profile.controllerRuntime.byteLength, 91380224);
  assert.equal(
    profile.controllerRuntime.sha256,
    "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088"
  );
  assert.equal(profile.controllerRuntime.version, "v24.14.0");
  assert.equal(profile.controllerRuntime.platform, "win32");
  assert.equal(profile.controllerRuntime.architecture, "x64");
});

test("pins every public source sentinel to the remote-exact parent", () => {
  assert.equal(profile.sourceSentinels.length, 16);
  for (const sentinel of profile.sourceSentinels) {
    const bytes = gitBytes(profile.registrationParentCommit, sentinel.path);
    assert.equal(bytes.length, sentinel.byteLength, sentinel.path);
    assert.equal(sha256(bytes), sentinel.sha256, sentinel.path);
  }
});

test("allows one offline Rust build and one offline inspect-only managed build", () => {
  assert.deepEqual(profile.rustBuild.command, [
    "cargo", "build", "--locked", "--release", "-p", "tinyrustlm-convert",
    "--target", "x86_64-pc-windows-msvc"
  ]);
  assert.deepEqual(profile.rustBuild.environment, {
    CARGO_INCREMENTAL: "0",
    CARGO_NET_OFFLINE: "true",
    CARGO_TARGET_DIR: "private-absolute-rust-build-root"
  });
  assert.equal(profile.rustBuild.buildAttemptLimit, 1);
  assert.equal(profile.rustBuild.automaticBuildRetry, false);
  assert.deepEqual(profile.managedBuild.command, [
    "dotnet",
    "build",
    "dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj",
    "--configuration",
    "Release",
    "--no-restore",
    "--no-incremental",
    "--output",
    "private-absolute-managed-build-root"
  ]);
  assert.equal(profile.managedBuild.buildAttemptLimit, 1);
  assert.equal(profile.managedBuild.restoreAllowed, false);
  assert.equal(profile.managedBuild.networkAllowed, false);
  assert.equal(profile.managedRuntime.sdkVersion, "10.0.400");
  assert.equal(profile.managedRuntime.runtimeIdentifier, "win-x64");
  assert.equal(profile.managedRuntime.targetFramework, "net8.0");
});

test("freezes the controller request including exact Node runtime fields", () => {
  assert.equal(
    profile.privateRequest.schema,
    "tinyrustlm.qwen3-composition-execution-request.v1"
  );
  assert.deepEqual(profile.privateRequest.canonicalFieldsInOrder, [
    "schema", "executionId", "registration", "build", "inputs", "invocation"
  ]);
  assert.deepEqual(profile.privateRequest.registrationFields.slice(-6), [
    "controllerRuntimePath",
    "controllerRuntimeByteLength",
    "controllerRuntimeSha256",
    "controllerRuntimeVersion",
    "controllerRuntimePlatform",
    "controllerRuntimeArchitecture"
  ]);
  assert.equal(profile.privateRequest.writeMode, "create-only");
  assert.equal(profile.privateRequest.overwriteAllowed, false);
  assert.equal(profile.privateRequest.deleteAllowed, false);
});

test("permits one converter launch and one nonconverting managed inspection", () => {
  assert.equal(profile.controllerExecution.controllerInvocationCount, 1);
  assert.equal(profile.controllerExecution.converterLaunchCount, 1);
  assert.equal(profile.controllerExecution.automaticRetry, false);
  assert.equal(profile.controllerExecution.responseRepair, false);
  assert.equal(profile.managedInspection.invocationCount, 1);
  assert.equal(profile.managedInspection.converterProcessApiAvailable, false);
  assert.equal(profile.managedInspection.converterLaunchAllowed, false);
  assert.equal(profile.managedInspection.operation,
    "read-only-no-converter-launch");
  assert.equal(profile.managedInspection.acceptedPassExitCode, 0);
  assert.equal(profile.managedInspection.acceptedRejectedExitCode, 2);
  assert.equal(profile.managedInspection.acceptedPendingExitCode, 3);
  assert.equal(profile.managedInspection.typedErrorExitCode, 1);
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
});

test("freezes one create-only verification record and closed decision vocabulary", () => {
  assert.equal(
    profile.verificationRecord.schema,
    "tinyrustlm.qwen3-composition-execution-verification.v1"
  );
  assert.deepEqual(profile.verificationRecord.canonicalFieldsInOrder, [
    "schema",
    "executionId",
    "registration",
    "builds",
    "controller",
    "managedInspection",
    "decision",
    "claims"
  ]);
  assert.deepEqual(profile.verificationRecord.allowedDecisionStatuses, [
    "structural-pass",
    "terminal-rust-build-failure",
    "terminal-managed-build-failure",
    "terminal-controller-failure",
    "terminal-managed-rejection",
    "terminal-ambiguous"
  ]);
  assert.equal(profile.verificationRecord.allReferencedEvidenceRehashedBeforeRecord,
    true);
  assert.equal(profile.verificationRecord.structuralPassRequiresExactRegisteredPassSet,
    true);
  assert.equal(profile.verificationRecord.allNonStructuralClaimsRemainFalse, true);
  assert.equal(profile.verificationRecord.retryAllowed, false);
  assert.equal(profile.verificationRecord.overwriteAllowed, false);
  assert.equal(profile.verificationRecord.deleteAllowed, false);
});

test("contains no private path credential output or inflated claim", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.productBoundary.legacySupport, false);
  assert.equal(profile.productBoundary.managedConversionLaunchAfterRustExecution, false);
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
