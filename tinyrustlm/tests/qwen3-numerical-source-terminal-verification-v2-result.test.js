"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultRelativePath =
  "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v2.json";
const registrationRelativePath =
  "contracts/vnext/qwen3-numerical-source-terminal-verification-preregistration.v2.json";
const resultBytes = fs.readFileSync(path.join(repositoryRoot, resultRelativePath));
const result = JSON.parse(resultBytes.toString("utf8"));
const expectedByteLength = 7739;
const expectedSha256 =
  "0261525e59aefe4c19e4a3d5ec2afc5e59b26c0ef718c9ddaf2761757c8cc4fe";
const operationId =
  "qwen3-numerical-c1899de-4891e8a-20260826-v2-terminal-verification-v2";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes one successful corrected source-terminal verification result", () => {
  assert.equal(resultBytes.length, expectedByteLength);
  assert.equal(sha256(resultBytes), expectedSha256);
  assert.equal(result.schema,
    "tinyrustlm.qwen3-numerical-source-terminal-verification-result.v2");
  assert.equal(result.profileId,
    "tinyrustlm.qwen3-numerical-source-terminal-verification/2");
  assert.equal(result.operationId, operationId);
  assert.equal(result.status, "pass");
  assert.equal(result.reasonCode, "registered-expected-finding-established");
});

test("binds the remote-exact v2 registration and immutable v1 predecessor", () => {
  assert.deepEqual(result.registration, {
    branch: "codex/model-acquisition-v2",
    commit: "747fc88662a379bdb7203269f13dcecdc99f5267",
    localTrackingFetchHeadAndRemoteExactBeforeExecution: true,
    outputRootObservedAbsentAtPreflight: true,
    outputRootObservedAbsentBeforeRegistration: true,
    profileByteLength: 12217,
    profilePath: registrationRelativePath,
    profileSha256:
      "fc4a7500c427e56f3b178eeb4c48ebd0bd6754f5e513b1aef403da4a21d46ca4",
    sourceCleanBeforeExecution: true,
    tree: "402990bb00f5a0adcc7424b3d0cd307ac4e236e7"
  });
  const registration = fs.readFileSync(
    path.join(repositoryRoot, registrationRelativePath));
  assert.equal(registration.length, result.registration.profileByteLength);
  assert.equal(sha256(registration), result.registration.profileSha256);
  assert.equal(result.predecessorVerification.status, "terminal-ambiguous");
  assert.equal(result.predecessorVerification.invocationCount, 1);
  assert.equal(result.predecessorVerification.replayAllowed, false);
  assert.equal(result.predecessorVerification.publicResult.sha256,
    "e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa");
});

test("binds the exact three-file private closure without publishing it", () => {
  assert.deepEqual(result.privateVerificationEvidence, {
    aggregateByteLength: 5321,
    fileCount: 3,
    privatePathPublished: false,
    processTerminal: {
      byteLength: 3555,
      createOnly: true,
      reasonCode: "registered-expected-finding-established",
      sha256: "eed9f38b0787ab67bb1b266d176af4cb56b0e3a4c365a66f88e3e3a08cedb3f9",
      status: "pass"
    },
    stderr: {
      byteLength: 0,
      rawPublished: false,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    stdout: {
      byteLength: 1766,
      rawPublished: false,
      sha256: "6cb27c8ab284acf053e3d0872c66a39b1902549f36a9b587d4e846000b62a90d"
    }
  });
});

test("records exactly one bounded verifier process and expected finding", () => {
  assert.deepEqual(result.verifierExecution, {
    argumentsSha256:
      "05823a5fae24465ff47a0ad242ef7a0a28116e3a11522ceddfb08b9aa4a99d15",
    durationMilliseconds: 90,
    executableUnchanged: true,
    exitCode: 0,
    expectedVerificationId:
      "ac4a8b4495c0df1416dd7d7e367644e472d193521c68de63f422cda530d69a29",
    killedForOverflow: false,
    observedInvocationCount: 1,
    processClosedObserved: true,
    processStarted: true,
    requiredInvocationCount: 1,
    retryAllowed: false,
    secondInvocationAllowed: false,
    terminationRequested: false,
    timedOut: false,
    verificationId:
      "ac4a8b4495c0df1416dd7d7e367644e472d193521c68de63f422cda530d69a29",
    verificationPass: true,
    verifier: {
      byteLength: 30944,
      sha256:
        "b074082a2385e2cde734b3e11832dfed56496afc2dd21645a18457b9cade8ee5"
    }
  });
});

test("records complete read-only proof and independent closure audit", () => {
  assert.deepEqual(result.readOnlyProof, {
    fullPreregisteredReadOnlyProofEstablished: true,
    implementationArtifactsUnchanged: true,
    materialOutputRootsAbsentAfterInvocation: true,
    ownerRequestMetadataAfterSha256:
      "3046553209988745f987561caa78268960d5555d74b83613bd710b867f61b412",
    ownerRequestMetadataBeforeSha256:
      "3046553209988745f987561caa78268960d5555d74b83613bd710b867f61b412",
    ownerRequestMetadataUnchanged: true,
    sourceEvidenceAggregateByteLength: 13143,
    sourceEvidenceContentInventoryAndMetadataUnchanged: true,
    sourceEvidenceFileCount: 9,
    sourceEvidenceMetadataAfterSha256:
      "4936c9faa5f3f6bd22a8dab26f02bcea96ecf3a52f193876f30db1b17a77fdee",
    sourceEvidenceMetadataBeforeSha256:
      "4936c9faa5f3f6bd22a8dab26f02bcea96ecf3a52f193876f30db1b17a77fdee",
    sourceScratchEmptyAfterInvocation: true,
    verifierWritesToSourceEvidenceObserved: false,
    worktreeCleanAfterInvocation: true
  });
  assert.deepEqual(result.independentClosureAudit, {
    canonicalProcessTerminalVerified: true,
    canonicalVerifierStdoutVerified: true,
    currentOwnerRequestMetadataMatchesTerminalAfter: true,
    currentSourceEvidenceMetadataMatchesTerminalAfter: true,
    performedAfterTerminal: true,
    privateAggregateByteLength: 5321,
    privateFileCount: 3,
    registeredFindingEqualityVerified: true,
    writesPerformed: false
  });
});

test("permits only the bounded source-terminal failure claim", () => {
  assert.deepEqual(result.decision, {
    allowedClaim: "source-terminal-failure-independently-verified",
    nextRequiredGate:
      "new-output-free-source-to-reconstructed-numerical-parity-registration",
    operationClosed: true,
    reasonCode: "registered-expected-finding-established",
    registeredExpectedFindingEstablished: true,
    sourceTerminalFailureIndependentlyVerified: true,
    status: "pass"
  });
  assert.equal(result.claimBoundary.sourceTerminalFailureIndependentlyVerified,
    true);
  for (const [key, value] of Object.entries(result.claimBoundary)) {
    if (key === "sourceTerminalFailureIndependentlyVerified") continue;
    assert.equal(value, false, key);
  }
});

test("closes the operation without retry and keeps campaign counters zero", () => {
  assert.deepEqual(result.terminality, {
    adoptionAllowed: false,
    existingPrivateBytesImmutable: true,
    operationClosed: true,
    overwriteAllowed: false,
    repairAllowed: false,
    retryAllowed: false,
    secondInvocationAllowed: false,
    sourceOwnerReplayAllowed: false,
    v1ModificationAllowed: false
  });
  assert.deepEqual(result.campaignCounters, {
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    deletionBackedBrowserRounds: "0/50",
    liveCatalogAnnouncements: "0/20",
    qualifiedModels: "0/20"
  });
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[A-Z]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
});

test("preserves the frozen continuation authority", () => {
  const goal = fs.readFileSync(path.join(repositoryRoot,
    "docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md"));
  assert.equal(sha256(goal),
    "92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0");
});
