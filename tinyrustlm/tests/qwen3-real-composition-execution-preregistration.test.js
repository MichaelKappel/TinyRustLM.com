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
  "contracts/vnext/qwen3-real-composition-execution-preregistration.v1.json"
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

test("freezes the output-free real-composition execution registration", () => {
  assert.equal(profileBytes.length, 16006);
  assert.equal(
    sha256(profileBytes),
    "46a9da74eb6b811257d2cc3a433055d4859fb7bbdfeef22e1c6ee8c2bd978a6a"
  );
  assert.equal(
    profileBytes.toString("utf8"),
    `${JSON.stringify(profile, null, 2)}\n`
  );
  assert.equal(
    profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v1"
  );
  assert.equal(
    profile.profileId,
    "tinyrustlm.qwen3-real-composition-execution/1"
  );
  assert.equal(
    profile.status,
    "registered-before-release-build-private-binding-and-real-output"
  );
  assert.equal(
    gitText(["rev-parse", `${profile.registrationParentCommit}^{tree}`]),
    profile.registrationParentTree
  );
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds the sole remote source anchor and registration-only path set", () => {
  assert.equal(profile.sourceAnchor.commit, profile.registrationParentCommit);
  assert.equal(profile.sourceAnchor.tree, profile.registrationParentTree);
  assert.equal(profile.sourceAnchor.branch, "codex/model-acquisition-v2");
  assert.equal(profile.sourceAnchor.cleanAtRegistration, true);
  assert.equal(profile.sourceAnchor.trackingAndFetchHeadExactAtRegistration, true);
  assert.deepEqual(profile.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v1.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration.test.js"
  ]);
  assert.equal(profile.sourceAnchor.registrationCommitMustBeSingleParentDescendant,
    true);
  assert.equal(profile.sourceAnchor.registrationCommitMustChangeOnlyAllowedPaths,
    true);
  assert.equal(profile.sourceAnchor.registrationCommitMustBeFreshRemoteExactBeforeBuild,
    true);
});

test("binds the exact public model, tokenizer, and corrected composition inputs", () => {
  const inputs = profile.exactInputs;
  const expected = [
    [inputs.modelSourceLock, 1901,
      "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d"],
    [inputs.tokenizerSourceLock, 1108,
      "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70"],
    [inputs.compositionProfile, 8835,
      "d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718"]
  ];
  for (const [entry, byteLength, digest] of expected) {
    const bytes = gitBytes(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, byteLength, entry.path);
    assert.equal(sha256(bytes), digest, entry.path);
    assert.equal(entry.byteLength, byteLength, entry.path);
    assert.equal(entry.sha256, digest, entry.path);
  }
  assert.equal(profile.executionIdentity.modelId, "Qwen/Qwen3-0.6B");
  assert.equal(
    profile.executionIdentity.revision,
    "c1899de289a04d12100db370d81485cdf75e47ca"
  );
  assert.equal(
    profile.executionIdentity.baseProductDisposition,
    "terminally-rejected-as-product-model"
  );
  assert.equal(inputs.compositionProfile.predecessorProfileExecutable, false);
  assert.deepEqual(inputs.sourceRelationship.requiredArchitectureProfiles, {
    model: "tinyrustlm.qwen3-dense-gqa-qk-norm/1",
    tokenizer: "tinyrustlm.qwen3-tokenizer-source/1"
  });
  assert.equal(inputs.sourceRelationship.sourceRootsMustBeDistinct, true);
  assert.equal(inputs.immutableDependencyReuse.tokenizer2RerunAllowed, false);
  assert.equal(inputs.immutableDependencyReuse.template2RerunAllowed, false);
});

test("pins one offline release build and every material source sentinel", () => {
  assert.deepEqual(profile.build.command, [
    "cargo",
    "build",
    "--locked",
    "--release",
    "-p",
    "tinyrustlm-convert",
    "--target",
    "x86_64-pc-windows-msvc"
  ]);
  assert.deepEqual(profile.build.environment, {
    CARGO_INCREMENTAL: "0",
    CARGO_NET_OFFLINE: "true",
    CARGO_TARGET_DIR: "private-absolute-build-root"
  });
  assert.equal(profile.build.buildAttemptLimit, 1);
  assert.equal(profile.build.automaticBuildRetry, false);
  assert.equal(profile.build.manualBuildRetryUnderThisRegistration, false);
  assert.equal(
    profile.build.expectedExecutableRelativePath,
    "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe"
  );
  assert.equal(profile.toolchain.rustcRelease, "1.96.0");
  assert.equal(
    profile.toolchain.rustcCommitHash,
    "ac68faa20c58cbccd01ee7208bf3b6e93a7d7f96"
  );
  assert.equal(profile.toolchain.cargoRelease, "1.96.0");
  assert.equal(profile.toolchain.cargoCommit, "30a34c682");
  assert.equal(profile.toolchain.requiredInstalledTarget,
    "x86_64-pc-windows-msvc");

  for (const sentinel of profile.buildSourceSentinels) {
    const bytes = gitBytes(profile.registrationParentCommit, sentinel.path);
    assert.equal(bytes.length, sentinel.byteLength, sentinel.path);
    assert.equal(sha256(bytes), sentinel.sha256, sentinel.path);
  }
});

test("requires executable capture and a private immutable binding before launch", () => {
  const capture = profile.futureExecutableCapture;
  assert.equal(capture.captureAfterSuccessfulBuild, true);
  assert.equal(capture.captureBeforePrivateBinding, true);
  assert.equal(capture.captureBeforeLaunch, true);
  assert.equal(capture.mustBeDirectRegularNonReparseFile, true);
  assert.equal(capture.peMachineValue, "0x8664");
  assert.equal(capture.rehashImmediatelyBeforeLaunch, true);
  assert.equal(capture.rehashAfterProcessExit, true);
  assert.equal(capture.anyDriftIsTerminal, true);

  const binding = profile.privateExecutionBinding;
  assert.equal(binding.location, "private-evidence-root-outside-git");
  assert.equal(binding.writeMode, "create-only");
  assert.equal(binding.containsAbsoluteLocalPaths, true);
  assert.equal(binding.publicEvidence, false);
  assert.equal(binding.creationAfterExecutableCapture, true);
  assert.equal(binding.creationBeforeLaunch, true);
  assert.deepEqual(binding.canonicalFieldsInOrder, [
    "schema",
    "executionId",
    "registration",
    "sourceAnchor",
    "build",
    "inputs",
    "invocation",
    "preflight"
  ]);
  assert.equal(binding.overwriteAllowed, false);
  assert.equal(binding.deleteAllowed, false);
});

test("permits exactly one bounded invocation and preserves every stream and outcome", () => {
  assert.equal(profile.execution.launchCount, 1);
  assert.equal(profile.execution.automaticRetry, false);
  assert.equal(profile.execution.manualRetryUnderThisRegistration, false);
  assert.equal(profile.execution.bestOfN, false);
  assert.equal(profile.execution.responseRepair, false);
  assert.equal(profile.execution.stdoutAndStderrCapturedSeparately, true);
  assert.equal(profile.execution.rawStreamsArePrivateCreateOnlyEvidence, true);
  assert.equal(profile.execution.startRecordWrittenCreateOnlyBeforeLaunch, true);
  assert.equal(profile.execution.cleanupAfterFailure, false);
  assert.equal(profile.terminalDecision.ambiguousIsPass, false);
  assert.equal(profile.terminalDecision.ambiguousIsRetryAuthorization, false);
  assert.equal(profile.terminalDecision.buildFailureClosesRegistration, true);
  assert.equal(profile.terminalDecision.newAttemptRequiresNewRegistrationAndNewLogicalRoots,
    true);
  assert.equal(profile.terminalDecision.outputMayBeRepaired, false);
  assert.equal(profile.terminalDecision.outputMayBeDeleted, false);
  assert.ok(profile.terminalDecision.passRequires.includes(
    "managed-durable-inspector-pass"));
  assert.ok(profile.terminalDecision.passRequires.includes(
    "all-six-artifacts-reparsed-by-canonical-owners"));
});

test("contains no private path, credential, output, or inflated claim", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.equal(profile.authority.publicProfileContainsPrivatePaths, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.claimBoundary.releaseBuildCompleted, false);
  assert.equal(profile.claimBoundary.realConverterInvoked, false);
  assert.equal(profile.claimBoundary.structuralCompositionVerified, false);
  assert.equal(profile.claimBoundary.sourceFrameworkParityVerified, false);
  assert.equal(profile.claimBoundary.nativeRuntimeVerified, false);
  assert.equal(profile.claimBoundary.browserWasmVerified, false);
  assert.equal(profile.claimBoundary.browserChatVerified, false);
  assert.equal(profile.claimBoundary.modelQualityVerified, false);
  assert.equal(profile.claimBoundary.campaignCreditAuthorized, false);
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
