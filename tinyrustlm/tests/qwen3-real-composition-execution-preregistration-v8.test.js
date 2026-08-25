"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-real-composition-execution-preregistration.v8.json");
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

test("freezes the output-free eighth real-composition registration", () => {
  assert.equal(profileBytes.length, 61969);
  assert.equal(
    sha256(profileBytes),
    "4a7e255c500ef87e3ddac4d7befb7331232167e7bcf47aae6cdabfbd752fec21"
  );
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(
    profile.schema,
    "tinyrustlm.qwen3-real-composition-execution-preregistration.v8"
  );
  assert.equal(profile.profileId, "tinyrustlm.qwen3-real-composition-execution/8");
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

test("binds all seven terminal predecessors without reuse repair or selection", () => {
  const history = [profile.predecessor, ...profile.priorTerminalHistory];
  const expected = [
    ["terminal-rust-custody-failure",
      "windows-inetcache-contained-junction-not-representable-by-current-scratch-contract",
      "e37790ffb827fe7082e31cc6adecc8148839dd6ef757231165587c45dd35b444", 0,
      false],
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
  assert.equal(new Set(history.map((entry) => entry.profilePath)).size, history.length);
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
    "tinyrustlm.source-controlled-build-custody/2");
  assert.equal(profile.predecessor.rustBuildProcessExitCode, 0);
  assert.equal(profile.predecessor.rustReleaseBuildExitCodeVerified, true);
  assert.equal(profile.predecessor.existingRootCount, 8);
  assert.equal(profile.predecessor.neverCreatedLaterRootCount, 7);
  assert.deepEqual(profile.predecessor.preservedCandidateObservation, {
    byteLength: 852992,
    sha256: "f5712d2d4cc9f7fe61cbb3102c126cdd3bb7da3f7142edd5a95f9fa0c6b6bdf4",
    peMachine: "0x8664",
    acceptedAsSuccessfulBuild: false,
    adoptionAllowed: false
  });
});

test("binds the exact remote parent and four registration-only paths", () => {
  assert.equal(
    profile.registrationParentCommit,
    "4d972b89b583c2b54847a8354d936bf432a1d438"
  );
  assert.equal(
    profile.registrationParentTree,
    "11bde04b17f31b9289c22df3268c45f742f1253d"
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
    "contracts/vnext/qwen3-real-composition-execution-preregistration.v8.json",
    "docs/architecture/2026-08-25-qwen3-real-composition-execution-preregistration-v8.md",
    "tinyrustlm/tests/qwen3-real-composition-execution-preregistration-v8.test.js"
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
    "qwen3-composition-rust-custody-4d972b8-20260825-v8",
    "qwen3-composition-rust-build-4d972b8-20260825-v8",
    "qwen3-composition-rust-environment-4d972b8-20260825-v8",
    "qwen3-composition-managed-custody-4d972b8-20260825-v8",
    "qwen3-composition-managed-build-4d972b8-20260825-v8",
    "qwen3-composition-managed-environment-4d972b8-20260825-v8",
    "qwen3-composition-execution-c1899de-4d972b8-20260825-v8",
    "qwen3-composition-c1899de-4d972b8-20260825-v8"
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
  assert.ok(logicalNames.every((name) => name.includes("-v8")));
  assert.ok(logicalNames.every((name) => name.includes("4d972b8")));
  const absenceFields = Object.entries(profile.executionIdentity)
    .filter(([field]) => field.endsWith("ObservedAbsentBeforeRegistration"));
  assert.equal(absenceFields.length, 15);
  assert.ok(absenceFields.every(([, value]) => value === true));
  assert.equal(profile.executionIdentity.rootParentIsExistingDirectNonReparseDirectory,
    true);
  assert.equal(profile.executionIdentity.rootsAreDirectSiblings, true);
  assert.equal(profile.executionIdentity
    .requestAndEnvironmentAuthorityFilesAreDirectSiblingsOfRoots, true);
});

test("binds every exact conversion input and sole clean-cut profiles", () => {
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
  assert.equal(profile.exactInputs.tokenizerConversionProfile.requiredFileSuffix,
    ".tokenizer2");
  assert.equal(profile.exactInputs.tokenizerConversionProfile.predecessorProfileExecutable,
    false);
  assert.equal(profile.exactInputs.modelConversionProfile.physicalSourceTensorCount, 311);
  assert.equal(profile.exactInputs.modelConversionProfile.logicalOutputTensorCount, 310);
  assert.equal(profile.exactInputs.compositionProfile.obsoleteTokenizerFileSuffixAccepted,
    false);
  assert.equal(profile.exactInputs.compositionProfile.predecessorProfileExecutable, false);
});

test("binds custody V3 scratch authority and twenty-five source sentinels", () => {
  assertIdentityAtParent(profile.buildCustody.profile);
  assertIdentityAtParent(profile.buildCustody.owner);
  assertIdentityAtParent(profile.buildCustody.environmentAuthority.profile);
  assertIdentityAtParent(profile.buildCustody.environmentAuthority.owner);
  assertIdentityAtParent(profile.buildCustody.scratchInspectionAuthority.profile);
  assert.equal(profile.sourceSentinels.length, 25);
  for (const sentinel of profile.sourceSentinels) assertIdentityAtParent(sentinel);
  assert.deepEqual(profile.buildCustody.schemas, {
    request: "tinyrustlm.build-custody-request.v3",
    binding: "tinyrustlm.build-custody-binding.v3",
    start: "tinyrustlm.build-custody-start.v3",
    processTerminal: "tinyrustlm.build-custody-process-terminal.v3",
    scratchInspectionProcessTerminal:
      "tinyrustlm.build-custody-scratch-inspection-process-terminal.v3",
    terminal: "tinyrustlm.build-custody-terminal.v3",
    summary: "tinyrustlm.build-custody-summary.v3"
  });
  assert.equal(profile.buildCustody.profile.profileId,
    "tinyrustlm.source-controlled-build-custody/3");
  assert.deepEqual(profile.buildCustody.requestCanonicalFieldsInOrder, [
    "schema", "operationId", "profile", "source", "runtime",
    "environmentAuthority", "scratchInspection", "command", "roots", "capture",
    "termination", "outputs"
  ]);
  assert.equal(profile.buildCustody.evidenceFiles.length, 10);
  assert.equal(profile.buildCustody
    .processTerminalFsyncedBeforeOutputAndScratchInspection, true);
  assert.equal(profile.buildCustody
    .scratchInspectionProcessTerminalFsyncedBeforeObservationValidation, true);
  assert.equal(profile.buildCustody.compatibilityAllowed, false);
  assert.equal(profile.buildCustody.fallbackAllowed, false);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /contracts\/vnext\/build-custody-profile\.v2\.json/u);
});

test("freezes the no-follow contained-junction scratch inspection", () => {
  const scratch = profile.buildCustody.scratchInspectionAuthority;
  assert.equal(scratch.profile.profileId,
    "tinyrustlm.build-scratch-inspection/1");
  assert.equal(scratch.requestSchema,
    "tinyrustlm.build-scratch-inspection-request.v1");
  assert.equal(scratch.observationSchema,
    "tinyrustlm.build-scratch-inspection-observation.v1");
  assert.equal(scratch.junctionSchema,
    "tinyrustlm.build-scratch-inspection-junction.v1");
  assert.equal(scratch.executableKind, "pe-x64");
  assert.equal(scratch.invocationCount, 1);
  assert.equal(scratch.stderrMustBeEmpty, true);
  assert.equal(scratch.executableIdentityCheckedBeforeAndAfter, true);
  assert.equal(scratch.doubleNoFollowInventoryRequired, true);
  assert.equal(scratch.sameRootDirectDirectoryJunctionsOnly, true);
  assert.equal(scratch.traversalAllowed, false);
  assert.equal(scratch.networkAllowed, false);
  assert.equal(scratch.mutationAllowed, false);
  assert.equal(scratch.retryAllowed, false);
  assert.equal(scratch.fallbackAllowed, false);
  assert.equal(profile.buildCustody.environmentAuthority
    .freshExactNodeValidationAfterScratchInspection, true);
  assert.equal(profile.buildCustody.environmentAuthority
    .postScratchInspectionDriftHasCustodyFailurePrecedence, true);
});

test("registers one immutable linker-complete MSVC authority materialization", () => {
  const environment = profile.windowsMsvcEnvironmentAuthority;
  assert.equal(environment.operationId, "qwen3-composition-v8-msvc-environment");
  assert.equal(environment.requestFileBasename,
    profile.executionIdentity.environmentAuthorityRequestFileBasename);
  assert.equal(environment.privateBindingFileBasename,
    profile.executionIdentity.environmentAuthorityPrivateBindingFileBasename);
  assert.equal(environment.publicLockFileBasename,
    profile.executionIdentity.environmentAuthorityPublicLockFileBasename);
  assert.equal(environment.terminalFileBasename,
    profile.executionIdentity.environmentAuthorityTerminalFileBasename);
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
});

test("pins exact Git Node taskkill Cargo rustc and dotnet identities", () => {
  assert.equal(profile.buildCustody.sourceControlTool.sha256,
    "c470d205517c7a53ceca321df16a6e4549fcd52b576ab4d09536d36f26fda5a9");
  assert.equal(profile.buildCustody.runtime.sha256,
    "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088");
  assert.equal(profile.buildCustody.runtime.version, "v24.14.0");
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

test("registers the sole two-output Rust custody launch", () => {
  const build = profile.rustBuildCustody;
  assertCanonicalEnvironmentNames(
    build.command.supplementalEnvironmentNamesInCanonicalOrder);
  assert.equal(build.operationId, "qwen3-composition-v8-rust-build");
  assert.equal(build.requestSchema, "tinyrustlm.build-custody-request.v3");
  assert.deepEqual(build.command.arguments, [
    "build", "--locked", "--release", "-p", "tinyrustlm-build-custody",
    "-p", "tinyrustlm-convert", "--target", "x86_64-pc-windows-msvc"
  ]);
  assert.deepEqual(build.outputs.required.map((entry) => entry.relativePath), [
    "x86_64-pc-windows-msvc/release/tinyrustlm-build-scratch-inspect.exe",
    "x86_64-pc-windows-msvc/release/tinyrustlm-convert.exe"
  ]);
  assert.ok(build.outputs.required.every((entry) => entry.kind === "pe-x64"));
  assert.equal(build.scratchInspection.executableRelativePath,
    build.outputs.required[0].relativePath);
  assert.equal(build.scratchInspection.operationId,
    "qwen3-composition-v8-rust-scratch-inspection");
  assert.equal(build.outputs.maximumEnvironmentJunctionCount, 64);
  assert.equal(build.executeInvocationCount, 1);
  assert.equal(build.observeMayReconnectWithoutRerun, true);
  assert.equal(build.successRequiresCustodyTerminalPass, true);
});

test("registers the sole five-output managed custody launch", () => {
  const build = profile.managedBuildCustody;
  assertCanonicalEnvironmentNames(
    build.command.supplementalEnvironmentNamesInCanonicalOrder);
  assert.equal(build.operationId,
    "qwen3-composition-v8-managed-inspector-build");
  assert.equal(build.requestSchema, "tinyrustlm.build-custody-request.v3");
  assert.deepEqual(build.command.arguments, [
    "build",
    "dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj",
    "--configuration", "Release", "--no-restore", "--no-incremental", "--output",
    "private-absolute-managed-custody-target-root",
    "--property:TinyRustLmCustodyScratchInspectorSource=private-absolute-qualified-rust-scratch-inspector-path"
  ]);
  assert.equal(build.command.scratchInspectorSourceProperty,
    "TinyRustLmCustodyScratchInspectorSource");
  assert.equal(build.command.scratchInspectorSourceMustEqualQualifiedRustOutput, true);
  assert.deepEqual(build.outputs.required.map((entry) => entry.relativePath), [
    "TinyRustLM.CompositionInspector.deps.json",
    "TinyRustLM.CompositionInspector.dll",
    "TinyRustLM.CompositionInspector.runtimeconfig.json",
    "TinyRustLM.Conversion.dll",
    "tinyrustlm-build-scratch-inspect.exe"
  ]);
  assert.equal(build.outputs.required.at(-1).kind, "pe-x64");
  assert.equal(build.scratchInspection.executableRelativePath,
    "tinyrustlm-build-scratch-inspect.exe");
  assert.equal(build.stagedScratchInspectorMustEqualRustQualifiedOutput, true);
  assert.equal(build.restoreAllowed, false);
  assert.equal(build.networkAllowed, false);
  assert.equal(build.incrementalBuildAllowed, false);
});

test("permits one controller launch and one read-only managed inspection", () => {
  assert.equal(profile.controller.byteLength, 33811);
  assert.equal(profile.controller.sha256,
    "c26633570f00155454842f56d23c27944b57091cd7f492c4f0bdde6386b3fdf6");
  assert.equal(profile.privateCompositionRequest.fileName,
    "qwen3-composition-execution-request-c1899de-4d972b8-20260825-v8.json");
  assert.equal(profile.privateCompositionRequest.writeMode, "create-only");
  assert.equal(profile.privateCompositionRequest
    .materializedOnlyAfterBothBuildCustodyTerminalsPass, true);
  assert.equal(Object.hasOwn(profile.privateCompositionRequest,
    "buildEnvironmentMustBindCustodyV2PublicSummaries"), false);
  assert.equal(profile.privateCompositionRequest
    .buildEnvironmentMustBindCustodyV3PublicSummaries, true);
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
});

test("requires one incompatible scratch-complete V4 verification record", () => {
  const verification = profile.verificationRecord;
  assert.equal(verification.schema,
    "tinyrustlm.qwen3-composition-execution-verification.v4");
  assert.equal(verification.predecessorSchemaExecutable, false);
  assert.equal(verification.compatibilityReader, false);
  assert.deepEqual(verification.canonicalFieldsInOrder, [
    "schema", "executionId", "registration", "environmentAuthority",
    "buildCustody", "scratchInspection", "controller", "managedInspection",
    "decision", "claims"
  ]);
  for (const prefix of ["rust", "managed"]) {
    for (const suffix of ["Request", "Stdout", "Stderr", "ProcessTerminal",
      "Observation", "HelperPreIdentity", "HelperPostIdentity",
      "EnvironmentAuthorityPostInspection"]) {
      assert.ok(verification.scratchInspectionFields.includes(`${prefix}${suffix}`));
    }
  }
  assert.ok(verification.scratchInspectionFields
    .includes("managedHelperEqualsRustQualifiedOutput"));
  assert.ok(verification.buildCustodyFields.includes("rustStdout"));
  assert.ok(verification.buildCustodyFields.includes("managedStderr"));
  assert.ok(profile.terminalDecision.passRequires
    .includes("rust-environment-scratch-junction-qualified-double-inventory-pass"));
  assert.ok(profile.terminalDecision.passRequires
    .includes("managed-staged-scratch-helper-equals-qualified-rust-output"));
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /tinyrustlm\.qwen3-composition-execution-verification\.v3/u);
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
