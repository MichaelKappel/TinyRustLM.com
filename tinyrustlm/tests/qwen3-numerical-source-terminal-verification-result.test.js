"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const relativePath =
  "contracts/vnext/qwen3-numerical-source-terminal-verification-result.v1.json";
const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
const result = JSON.parse(bytes.toString("utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("freezes the consumed verification as one terminal-ambiguous result", () => {
  assert.equal(result.schema,
    "tinyrustlm.qwen3-numerical-source-terminal-verification-result.v1");
  assert.equal(result.profileId,
    "tinyrustlm.qwen3-numerical-source-terminal-verification/1");
  assert.equal(result.operationId,
    "qwen3-numerical-c1899de-4891e8a-20260826-v2-terminal-verification-v1");
  assert.equal(result.sourceOperationId,
    "qwen3-numerical-c1899de-4891e8a-20260826-v2");
  assert.equal(result.status, "terminal-ambiguous");
  assert.equal(result.reasonCode,
    "verifier-rejected-and-process-terminal-writer-failed");
  assert.equal(bytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
});

test("binds the exact remote registration and consumed private output", () => {
  assert.deepEqual(result.registration, {
    profilePath:
      "contracts/vnext/qwen3-numerical-source-terminal-verification-preregistration.v1.json",
    profileByteLength: 10440,
    profileSha256:
      "afccb28dc8e4b67e3dff81beb44c74290e01f1c673c9e4a7f3c3989224468860",
    commit: "7685b91ea9ecbe884bee6603031e52a39f81a6ea",
    tree: "1e9d60967396325f4d6be7bcf17f50c4c68c4dab",
    branch: "codex/model-acquisition-v2",
    localTrackingFetchHeadAndRemoteExactBeforeExecution: true,
    sourceCleanBeforeExecution: true,
    outputRootObservedAbsentBeforeRegistration: true,
    outputRootObservedAbsentAtPreflight: true
  });
  assert.deepEqual(result.privateVerificationEvidence, {
    fileCount: 3,
    aggregateByteLength: 2684,
    stdout: {
      byteLength: 0,
      sha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    stderr: {
      byteLength: 69,
      sha256:
        "064f6476e36abbb3e9aeaaf18509b361cbaf4e522145965bbc755667f3390d6f",
      safeCode: "source-terminal-process-binding",
      rawPublished: false
    },
    processTerminal: {
      byteLength: 2615,
      sha256:
        "889c0826eb1b36aabb80ac612a2dbc0c29220ae225a61d63858b2f61f901ad2f",
      status: "terminal-ambiguous",
      reasonCode: "verifier-rejected-and-process-terminal-writer-failed",
      createOnly: true,
      lateClosureAfterInitialWriterFailure: true
    },
    privatePathPublished: false
  });
});

test("records one verifier invocation without manufacturing a process pass", () => {
  assert.deepEqual(result.verifierExecution, {
    requiredInvocationCount: 1,
    observedInvocationCount: 1,
    processStarted: true,
    processClosedObserved: true,
    processExitCode: null,
    processExitCodeDurablyCaptured: false,
    verificationPass: false,
    typedRejectionObservedFromRegisteredStderr: true,
    initialTerminalWriteAttempted: true,
    initialTerminalWriteCompleted: false,
    initialTerminalWriterSafeCode: "process-terminal-write-failed",
    verifierRerunPerformed: false,
    retryAllowed: false,
    secondInvocationAllowed: false
  });
  assert.equal(result.readOnlyProof.fullPreregisteredReadOnlyProofEstablished,
    false);
  assert.equal(
    result.readOnlyProof.sourceEvidenceMetadataBeforeAfterSnapshotRetained, false);
});

test("preserves the exact verifier-contract defect without accepting two shapes", () => {
  assert.deepEqual(result.rootCause, {
    established: true,
    classification: "verifier-contract-defect",
    failingTypedCode: "source-terminal-process-binding",
    registeredExecutableFields: ["basename", "byteLength", "sha256"],
    processTerminalExecutableFields: ["byteLength", "sha256"],
    byteLengthAndSha256Matched: true,
    fullObjectEqualityIncorrectlyRequired: true,
    correctionMustValidateTheNormativeProcessTerminalShape: true,
    historicalEvidenceModificationAllowed: false,
    compatibilityReaderAllowed: false
  });
});

test("closes every broader claim and requires a wholly new operation", () => {
  assert.deepEqual(result.claimBoundary, {
    sourceTerminalFailureIndependentlyVerified: false,
    numericalParityVerified: false,
    optimizedNativeParityVerified: false,
    browserWasmParityVerified: false,
    browserChatVerified: false,
    behavioralQualityVerified: false,
    p2pAvailabilityVerified: false,
    catalogAnnouncementVerified: false,
    packagePublicationVerified: false,
    siteDeploymentVerified: false,
    memoryEndpointsVerified: false,
    campaignCreditAuthorized: false
  });
  assert.deepEqual(result.terminality, {
    operationClosed: true,
    existingPrivateBytesImmutable: true,
    overwriteAllowed: false,
    repairAllowed: false,
    adoptionAllowed: false,
    retryAllowed: false,
    secondInvocationAllowed: false,
    correctedSourceRequired: true,
    newRegistrationRequired: true,
    whollyNewOutputRootRequired: true
  });
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("freezes the final public result bytes", () => {
  assert.equal(bytes.length, 6268);
  assert.equal(sha256(bytes),
    "e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa");
});
