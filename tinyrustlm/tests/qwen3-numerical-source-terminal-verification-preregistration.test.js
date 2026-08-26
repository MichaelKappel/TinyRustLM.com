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
  "contracts/vnext/qwen3-numerical-source-terminal-verification-preregistration.v1.json";
const registrationPath = path.join(repositoryRoot,
  ...registrationRelativePath.split("/"));
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));
const parentCommit = "0ca8375c332e26603091359868272054f18a29b7";
const parentTree = "a6f50b3f8c12428489b2f4913f6e58094eb0acfd";
const sourceOperationId = "qwen3-numerical-c1899de-4891e8a-20260826-v2";
const verificationOperationId = `${sourceOperationId}-terminal-verification-v1`;
const expectedByteLength = 10440;
const expectedSha256 =
  "afccb28dc8e4b67e3dff81beb44c74290e01f1c673c9e4a7f3c3989224468860";

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

test("freezes one canonical output-free source-terminal verification registration", () => {
  assert.equal(registrationBytes.length, expectedByteLength);
  assert.equal(sha256(registrationBytes), expectedSha256);
  assert.deepEqual(registrationBytes, canonicalBytes(registration));
  assert.equal(registration.schema,
    "tinyrustlm.qwen3_numerical_source_terminal_verification_preregistration.v1");
  assert.equal(registration.profileId,
    "tinyrustlm.qwen3-numerical-source-terminal-verification/1");
  assert.equal(registration.status,
    "registered-after-owner-terminal-before-maintained-verifier-output");
});

test("binds the exact clean remote parent and four-path registration closure", () => {
  assert.equal(registration.registrationParentCommit, parentCommit);
  assert.equal(registration.registrationParentTree, parentTree);
  assert.equal(gitText(["rev-parse", `${parentCommit}^{tree}`]), parentTree);
  assert.equal(registration.sourceAnchor.parentCommit, parentCommit);
  assert.equal(registration.sourceAnchor.parentTree, parentTree);
  assert.deepEqual(registration.sourceAnchor.allowedRegistrationCommitPaths, [
    "contracts/vnext/README.md",
    registrationRelativePath,
    "docs/architecture/2026-08-26-qwen3-numerical-source-terminal-verification-preregistration.md",
    "tinyrustlm/tests/qwen3-numerical-source-terminal-verification-preregistration.test.js"
  ]);
  assert.equal(registration.sourceAnchor.cleanAtRegistration, true);
  assert.equal(registration.sourceAnchor.trackingFetchHeadAndRemoteExactAtRegistration,
    true);
  assert.equal(gitObjectExists(`${parentCommit}:${registrationRelativePath}`), false);
});

test("recomputes the maintained verifier authority from the parent", () => {
  assert.deepEqual(registration.verification.implementationArtifacts.map(
    (artifact) => artifact.role), [
    "source-terminal-verifier",
    "source-terminal-verifier-test",
    "source-terminal-verifier-decision"
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

test("binds the consumed source operation without authorizing replay", () => {
  const source = registration.sourceOperation;
  assert.equal(source.operationId, sourceOperationId);
  assert.deepEqual(source.executionPreregistration, {
    relativePath:
      "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v2.json",
    byteLength: 24806,
    sha256: "27b0f98a4b00b0561b4e50d7bf6d31d257a91f02c3f33f6c5a8197c652529c77"
  });
  assert.deepEqual(source.registrationSource, {
    branch: "codex/model-acquisition-v2",
    commit: "e6999eb44edfd3d76a71e0dc5c90f94912108e2a",
    fetchHeadExpected: true,
    remoteRef: "refs/remotes/origin/codex/model-acquisition-v2",
    trackingRef: "origin/codex/model-acquisition-v2",
    tree: "0ce6a8f3c0baeea2db78aa683d4f7e95d51d8f74"
  });
  assert.deepEqual(source.ownerRequest, {
    fileName: `${sourceOperationId}-owner-request.json`,
    byteLength: 1458,
    sha256: "f1c981a8514d1cdbe1752fdbcfb21bc9f5aa7c9ef3fb2ce9102800c336d238a4"
  });
  assert.equal(source.ownerStatus, "terminal-failure");
  assert.equal(source.ownerReasonCode, "source-process-not-pass");
  assert.equal(source.sourceSafeCode, "source-trace-environment-drift");
  assert.deepEqual(source.launchCounts,
    { reconstructed: 0, scalar: 0, source: 1, verifier: 0 });
  assert.equal(source.secondOwnerInvocationAllowed, false);
  assert.equal(source.outputAdoptionAllowed, false);
});

test("closes the exact immutable nine-file source-terminal evidence inventory", () => {
  assert.deepEqual(registration.sourceOperation.ownerEvidenceInventory, [
    ["binding.json", 2324,
      "7c75d48fb65163b9a0f9536aaf3f59da2b1592da6c5b97bc5eae3d0141e3ed0c"],
    ["owner-terminal.json", 2794,
      "38ba8b7e670098d16eb0faa1475d06944be49ec45d1e163588c300131d19bef2"],
    ["reconstructed.request.json", 2491,
      "a18bdb0e63e0b7cd9c2a3df51b0937de4d19d643f860203da0e5cfcbfe6a0447"],
    ["scalar.request.json", 1286,
      "7afa78a6c7722759f154f44b9de7642b9b47a472951886349e27218a36e5fc56"],
    ["source.process-terminal.json", 1405,
      "69f1b05802c007b99509c7a622e96ecb1f1949702a4df16e33b258b0c1b2ce5f"],
    ["source.request.json", 2432,
      "3b13a4f550799cab96b009562c7f07cce3774768a8dc7d6fadd97a3231901321"],
    ["source.stderr.bin", 57,
      "641910ce6fcd22e490c8f323f88797c77a925e1f25dc33080707c2991d095da8"],
    ["source.stdout.bin", 0,
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["start.json", 354,
      "43aafa1ea656b0919c2fa75b38e6b2ae95bca0ad1c20d3a97c573d0a7b8b1188"]
  ].map(([fileName, byteLength, digest]) =>
    ({ fileName, byteLength, sha256: digest })));
  assert.equal(registration.sourceOperation.ownerEvidenceFileCount, 9);
  assert.equal(registration.sourceOperation.ownerEvidenceByteLength, 13143);
  assert.equal(registration.sourceOperation.sourceScratchEmpty, true);
  assert.equal(registration.sourceOperation.materialOutputRootsAbsent, true);
});

test("precommits the complete expected path-free verifier finding", () => {
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
      byteLength: 30633,
      sha256: "82c885cc6bf23caf7c767aa26b0c0d248770f0ca449e5787cbbd77458175fd13"
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

test("registers one absent verification output root and bounded sole invocation", () => {
  assert.equal(registration.verification.operationId, verificationOperationId);
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
    privatePathPublished: false
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

test("keeps source evidence immutable and every broader claim closed", () => {
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
  const text = registrationBytes.toString("utf8");
  assert.doesNotMatch(text, /[A-Z]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
});
