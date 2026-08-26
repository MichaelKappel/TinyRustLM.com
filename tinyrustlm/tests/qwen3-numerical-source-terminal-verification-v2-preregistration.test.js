"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const verifier = require("../tools/qwen3-numerical-source-terminal-verifier.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationRelativePath =
  "contracts/vnext/qwen3-numerical-source-terminal-verification-preregistration.v2.json";
const registrationPath = path.join(repositoryRoot,
  ...registrationRelativePath.split("/"));
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));
const parentCommit = "bcda8324837c3c2956271251337a3f5b80d4d0ef";
const parentTree = "4aca30b64831257a45a9b382459e0d3419321795";
const sourceOperationId = "qwen3-numerical-c1899de-4891e8a-20260826-v2";
const predecessorVerificationId = `${sourceOperationId}-terminal-verification-v1`;
const verificationOperationId = `${sourceOperationId}-terminal-verification-v2`;
const expectedByteLength = 12217;
const expectedSha256 =
  "fc4a7500c427e56f3b178eeb4c48ebd0bd6754f5e513b1aef403da4a21d46ca4";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalValue(value), null, 2)}\n`, "utf8");
}

function gitBytes(commit, relativePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

function gitText(argumentsList) {
  return childProcess.execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  }).trim();
}

function gitObjectExists(specification) {
  return childProcess.spawnSync("git", ["cat-file", "-e", specification], {
    cwd: repositoryRoot,
    encoding: "buffer",
    windowsHide: true
  }).status === 0;
}

function assertParentArtifact(artifact) {
  const bytes = gitBytes(parentCommit, artifact.relativePath);
  assert.equal(bytes.length, artifact.byteLength, artifact.relativePath);
  assert.equal(sha256(bytes), artifact.sha256, artifact.relativePath);
}

test("freezes one canonical output-free v2 verification registration", () => {
  assert.equal(registrationBytes.length, expectedByteLength);
  assert.equal(sha256(registrationBytes), expectedSha256);
  assert.deepEqual(registrationBytes, canonicalBytes(registration));
  assert.equal(registration.schema,
    "tinyrustlm.qwen3_numerical_source_terminal_verification_preregistration.v2");
  assert.equal(registration.profileId,
    "tinyrustlm.qwen3-numerical-source-terminal-verification/2");
  assert.equal(registration.status,
    "registered-after-owner-terminal-before-maintained-verifier-output");
});

test("binds the clean remote-exact memory parent and exact four-path closure", () => {
  assert.equal(registration.registrationParentCommit, parentCommit);
  assert.equal(registration.registrationParentTree, parentTree);
  assert.equal(gitText(["show", "-s", "--format=%T", parentCommit]), parentTree);
  assert.equal(registration.sourceAnchor.parentCommit, parentCommit);
  assert.equal(registration.sourceAnchor.parentTree, parentTree);
  assert.deepEqual(registration.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    registrationRelativePath,
    "docs/architecture/2026-08-26-qwen3-numerical-source-terminal-verification-v2-preregistration.md",
    "tinyrustlm/tests/qwen3-numerical-source-terminal-verification-v2-preregistration.test.js"
  ]);
  assert.equal(registration.sourceAnchor.cleanAtRegistration, true);
  assert.equal(registration.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration,
    true);
  assert.equal(gitObjectExists(`${parentCommit}:${registrationRelativePath}`), false);
});

test("binds the correction gate and immutable v1 ambiguity", () => {
  assert.deepEqual(registration.correctionCheckpoint, {
    contract: {
      formerAddedBasenameAccepted: false,
      processTerminalIdentityFields: ["byteLength", "sha256"]
    },
    durableMemory: {
      byteLength: 9313,
      relativePath:
        "wiki/runtime-mirust/reports/tinyrustlm-qwen3-source-terminal-process-identity-correction-memory-2026-08-26.md",
      sha256: "2f294466f779f23e3c1bc5c810ba693513c2b4a8be855163f3ee098a2fbaf18b"
    },
    implementationCommit: "efc29dd6007401497e76fad3ec3036c23b092213",
    implementationTree: "03f88978b62cc300ab71b4ab9af5b2782ca6b880",
    memoryCheckpointCommit: parentCommit,
    memoryCheckpointTree: parentTree
  });
  assertParentArtifact(registration.correctionCheckpoint.durableMemory);

  assert.deepEqual(registration.predecessorVerification, {
    adoptionAllowed: false,
    invocationCount: 1,
    operationId: predecessorVerificationId,
    privateClosure: {
      byteLength: 2684,
      fileCount: 3,
      processTerminal: {
        byteLength: 2615,
        fileName: "verifier.process-terminal.json",
        sha256: "889c0826eb1b36aabb80ac612a2dbc0c29220ae225a61d63858b2f61f901ad2f"
      }
    },
    publicResult: {
      byteLength: 6268,
      relativePath:
        "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v1.json",
      sha256: "e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa"
    },
    reasonCode: "verifier-rejected-and-process-terminal-writer-failed",
    repairAllowed: false,
    replayAllowed: false,
    status: "terminal-ambiguous"
  });
  assertParentArtifact(registration.predecessorVerification.publicResult);
});

test("recomputes corrected verifier authority from the registered parent", () => {
  assert.deepEqual(registration.verification.implementationArtifacts, [
    {
      byteLength: 30944,
      relativePath: "tinyrustlm/tools/qwen3-numerical-source-terminal-verifier.js",
      role: "source-terminal-verifier",
      sha256: "b074082a2385e2cde734b3e11832dfed56496afc2dd21645a18457b9cade8ee5"
    },
    {
      byteLength: 15891,
      relativePath: "tinyrustlm/tests/qwen3-numerical-source-terminal-verifier.test.js",
      role: "source-terminal-verifier-test",
      sha256: "cd8f6044e8f881f2a0fc8b6573131e8cfd2d6d494eef728bb748dd3a721c32ab"
    },
    {
      byteLength: 6635,
      relativePath:
        "docs/architecture/2026-08-26-qwen3-source-terminal-process-identity-correction.md",
      role: "source-terminal-process-identity-decision",
      sha256: "b1b14674cfa4a4468085179ba66228fe05d1f5ab2a69ee1493262644b4dd3db6"
    }
  ]);
  for (const artifact of registration.verification.implementationArtifacts) {
    assertParentArtifact(artifact);
  }
  assert.deepEqual(registration.verification.node, {
    basename: "node.exe",
    byteLength: 91380224,
    sha256: "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088"
  });
  assert.deepEqual(registration.verification.termination, {
    basename: "taskkill.exe",
    byteLength: 114688,
    sha256: "81e9649b317de9243bf7f34e436e86159ba267d86349fa47efdb71dde2fc7bc5"
  });
});

test("binds the consumed source owner and exact nine-file closure", () => {
  const source = registration.sourceOperation;
  assert.equal(source.operationId, sourceOperationId);
  assert.deepEqual(source.executionPreregistration, {
    byteLength: 24806,
    relativePath:
      "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json",
    sha256: "27b0f98a4b00b0561b4e50d7bf6d31d257a91f02c3f33f6c5a8197c652529c77"
  });
  assert.deepEqual(source.ownerRequest, {
    byteLength: 1458,
    fileName: `${sourceOperationId}-owner-request.json`,
    sha256: "f1c981a8514d1cdbe1752fdbcfb21bc9f5aa7c9ef3fb2ce9102800c336d238a4"
  });
  assert.equal(source.ownerStatus, "terminal-failure");
  assert.equal(source.ownerReasonCode, "source-process-not-pass");
  assert.equal(source.sourceSafeCode, "source-trace-environment-drift");
  assert.deepEqual(source.launchCounts,
    { reconstructed: 0, scalar: 0, source: 1, verifier: 0 });
  assert.equal(source.secondOwnerInvocationAllowed, false);
  assert.equal(source.outputAdoptionAllowed, false);
  assert.equal(source.ownerEvidenceFileCount, 9);
  assert.equal(source.ownerEvidenceByteLength, 13143);
  assert.deepEqual(source.ownerEvidenceInventory.map((item) => item.fileName), [
    "binding.json",
    "owner-terminal.json",
    "reconstructed.request.json",
    "scalar.request.json",
    "source.process-terminal.json",
    "source.request.json",
    "source.stderr.bin",
    "source.stdout.bin",
    "start.json"
  ]);
  assert.equal(source.sourceScratchEmpty, true);
  assert.equal(source.materialOutputRootsAbsent, true);
});

test("precommits the exact corrected path-free finding", () => {
  const finding = registration.acceptance.expectedFinding;
  assert.deepEqual(finding, {
    schema: verifier.VERIFICATION_SCHEMA,
    operationId: sourceOperationId,
    verificationStatus: "pass",
    ownerStatus: "terminal-failure",
    ownerReasonCode: "source-process-not-pass",
    sourceSafeCode: "source-trace-environment-drift",
    launchCounts: { reconstructed: 0, scalar: 0, source: 1, verifier: 0 },
    registration: {
      byteLength: 24806,
      sha256: "27b0f98a4b00b0561b4e50d7bf6d31d257a91f02c3f33f6c5a8197c652529c77"
    },
    ownerRequest: {
      byteLength: 1458,
      sha256: "f1c981a8514d1cdbe1752fdbcfb21bc9f5aa7c9ef3fb2ce9102800c336d238a4"
    },
    ownerTerminal: {
      byteLength: 2794,
      sha256: "38ba8b7e670098d16eb0faa1475d06944be49ec45d1e163588c300131d19bef2"
    },
    sourceTerminal: {
      byteLength: 1405,
      sha256: "69f1b05802c007b99509c7a622e96ecb1f1949702a4df16e33b258b0c1b2ce5f"
    },
    sourceStdout: {
      byteLength: 0,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    sourceStderr: {
      byteLength: 57,
      sha256: "641910ce6fcd22e490c8f323f88797c77a925e1f25dc33080707c2991d095da8"
    },
    evidenceFileCount: 9,
    evidenceByteLength: 13143,
    sourceScratchEmpty: true,
    materialOutputRootsAbsent: true,
    verifier: {
      byteLength: 30944,
      sha256: "b074082a2385e2cde734b3e11832dfed56496afc2dd21645a18457b9cade8ee5"
    },
    writesPerformed: false,
    allowedClaim: "none",
    prohibitedClaims: [
      "optimized-native-parity",
      "browser-wasm-parity",
      "behavioral-quality",
      "p2p-availability",
      "site-release",
      "campaign-progress"
    ]
  });
  assert.equal(registration.acceptance.expectedVerificationId,
    sha256(verifier.canonicalJsonBytes(finding)));
  assert.equal(registration.acceptance.failureIsTerminal, true);
  assert.equal(registration.acceptance.mismatchIsTerminal, true);
});

test("registers one all-new absent root and one bounded invocation", () => {
  assert.equal(registration.verification.operationId, verificationOperationId);
  assert.notEqual(registration.verification.operationId,
    registration.predecessorVerification.operationId);
  assert.deepEqual(registration.verification.command, {
    arguments: ["verify", "registered-owner-request-path"],
    executableRole: "node",
    verifierRole: "source-terminal-verifier",
    workingDirectory: "registered-repository-root"
  });
  assert.deepEqual(registration.verification.output, {
    evidenceRootBasename: verificationOperationId,
    evidenceRootObservedAbsent: true,
    files: {
      processTerminal: "verifier.process-terminal.json",
      stderr: "verifier.stderr.bin",
      stdout: "verifier.stdout.bin"
    },
    outputCreated: false,
    privatePathPublished: false,
    publicResultCreated: false,
    publicResultRelativePath:
      "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v2.json"
  });
  assert.deepEqual(registration.verification.processPolicy, {
    maximumDurationMilliseconds: 3600000,
    maximumStderrBytes: 1048576,
    maximumStdoutBytes: 1048576,
    networkAllowed: false,
    overwriteAllowed: false,
    repairAllowed: false,
    requiredInvocationCount: 1,
    retryAllowed: false,
    secondInvocationAllowed: false,
    timeoutRequiresProcessTreeTermination: true
  });
  assert.deepEqual(registration.verification.processTerminal, {
    canonicalJsonRequired: true,
    createOnly: true,
    schema:
      "tinyrustlm.qwen3_numerical_source_terminal_verifier_process_terminal.v1",
    writtenAfterProcessClose: true
  });
});

test("keeps read-only proof and every broader claim closed", () => {
  assert.deepEqual(registration.verification.readOnlyProof, {
    compareFileContentAndMetadataBeforeAfter: true,
    compareInventoryBeforeAfter: true,
    materialOutputRootsMustRemainAbsent: true,
    sourceScratchMustRemainEmpty: true,
    verifierWritesToSourceEvidenceAllowed: false
  });
  assert.deepEqual(registration.campaignCounters, {
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    deletionBackedBrowserRounds: "0/50",
    liveCatalogAnnouncements: "0/20",
    qualifiedModels: "0/20"
  });
  assert.equal(registration.claimBoundary
    .sourceTerminalFailureMayBeClaimedAfterExactPass, true);
  for (const [key, value] of Object.entries(registration.claimBoundary)) {
    if (key === "sourceTerminalFailureMayBeClaimedAfterExactPass") continue;
    assert.equal(value, false, key);
  }
  assert.equal(registration.authority.memoryEndpointsAuthorized, false);
  assert.equal(registration.authority.legacySupport, false);
  assert.equal(registration.authority.compatibilityReader, false);
  assert.equal(registration.authority.fallbackRuntime, false);
  assert.equal(registration.authority.sourceOwnerReplayAllowed, false);
  assert.doesNotMatch(registrationBytes.toString("utf8"), /[A-Z]:[\\/]/u);
});

test("preserves the frozen continuation authority", () => {
  const goal = fs.readFileSync(path.join(repositoryRoot,
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md"));
  assert.equal(sha256(goal),
    "92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0");
});
