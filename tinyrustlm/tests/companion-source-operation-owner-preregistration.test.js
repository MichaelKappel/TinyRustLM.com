"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot,
  "contracts/vnext/companion-source-operation-owner-preregistration.v1.json");
const decisionPath = path.join(repositoryRoot,
  "docs/architecture/2026-08-28-companion-source-operation-owner-preregistration.md");
const profileBytes = fs.readFileSync(profilePath);
const decisionBytes = fs.readFileSync(decisionPath);
const profile = parseStrictJson(profileBytes, { maximumBytes: 128 * 1024 });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytesAt(commit, filePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
}

function parentPathExists(commit, filePath) {
  return childProcess.spawnSync("git", ["cat-file", "-e", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  }).status === 0;
}

test("pins the output-free source operation owner registration", () => {
  assert.equal(profileBytes.length, 24015);
  assert.equal(sha256(profileBytes),
    "33cce98e21b8b72317928f6d5b5906f328d5effce10f1323f34cd6193fd5e54c");
  assert.equal(decisionBytes.length, 16782);
  assert.equal(sha256(decisionBytes),
    "1762e7b55d69bdff19fe369ae6c1ceaecceb1a57f7a7d0782ad043160d6a2447");
  assert.equal(profile.schema,
    "tinyrustlm.companion-source-operation-owner-preregistration.v1");
  assert.equal(profile.profileId, "tinyrustlm.companion.source-operation-owner/1");
  assert.equal(profile.registrationParentCommit,
    "884d6c3d90976ba867490a4c562262cd79d81bca");
  assert.equal(profile.registrationParentTree,
    "7058042cc11f1943f63cf3a18d775c9a62a3808c");
});

test("reconstructs every registration input from the parent tree", () => {
  assert.equal(profile.registeredSourceClosure.length, 12);
  for (const entry of profile.registeredSourceClosure) {
    const bytes = gitBytesAt(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});

test("proves every registered implementation output was absent at the parent", () => {
  for (const filePath of profile.implementationClosure.newPathsAbsentAtRegistrationParent) {
    assert.equal(parentPathExists(profile.registrationParentCommit, filePath), false,
      filePath);
  }
});

test("replaces the acquisition wire without compatibility semantics", () => {
  const replacement = profile.cleanReplacement;
  assert.equal(replacement.loopbackProfileId,
    "tinyrustlm.companion.loopback-capability/4");
  assert.equal(replacement.acquisitionRequestSchema,
    "tinyrustlm.companion.acquire.v2");
  assert.equal(replacement.operationRecordSchema,
    "tinyrustlm.companion.operation.v3");
  assert.equal(replacement.operationProjectionSchema,
    "tinyrustlm.companion.loopback.operation-projection.v2");
  assert.equal(replacement.oldRequestReaderRetained, false);
  assert.equal(replacement.oldOperationReaderRetained, false);
  assert.equal(replacement.oldProjectionReaderRetained, false);
  assert.equal(replacement.migrationWritten, false);
  assert.equal(replacement.dualWriteAllowed, false);
  assert.equal(replacement.compatibilityAdapterAllowed, false);
});

test("binds explicit attempts while preserving exact lost-response replay", () => {
  const request = profile.acquisitionRequest;
  assert.deepEqual(request.canonicalFieldsInOrder, [
    "schema", "attemptId", "route", "modelId", "sourceRepository",
    "sourceRevision", "modelSourceLockSha256", "tokenizerSourceLockSha256",
    "compositionProfileSha256", "sourceAcquisitionApproved", "maximumSourceBytes"
  ]);
  assert.equal(request.attemptId.encoding, "32-lowercase-hex-characters");
  assert.equal(request.attemptId.sameAttemptLostResponse,
    "exact-request-replay-recovers-same-operation");
  assert.equal(request.attemptId.explicitNewUserAttempt,
    "new-random-attempt-id-produces-new-operation");
  assert.equal(request.attemptId.automaticRetry, false);
  assert.equal(request.route, "source");
  assert.equal(request.peerCandidatesPresent, false);
  assert.equal(request.arbitraryUrlAccepted, false);
  assert.equal(request.arbitraryPathAccepted, false);
});

test("registers one truthful source-only state machine", () => {
  assert.deepEqual(profile.operationStateMachine.states, [
    "queued", "acquiring-source", "converting", "verifying-composition",
    "available", "cancelled", "rejected"
  ]);
  assert.deepEqual(profile.operationStateMachine.terminalStates,
    ["available", "cancelled", "rejected"]);
  assert.deepEqual(profile.operationStateMachine.removedStates,
    ["checking-peers", "fetching-peer", "verifying-peer"]);
  assert.equal(profile.operationStateMachine.terminalMutationAllowed, false);
  assert.equal(profile.operationStateMachine.stateRepairAllowed, false);
  assert.equal(profile.peerBoundary.peerRoutePresentInRequest, false);
  assert.equal(profile.peerBoundary.oneFileP2pApiAdapted, false);
  assert.equal(profile.peerBoundary.marketingMayClaimP2pAcquisition, false);
});

test("requires one exclusive worker and contained converter tree", () => {
  const owner = profile.executionOwner;
  assert.equal(owner.process, "TinyRustLM.CompanionWorker");
  assert.equal(owner.networkListener, false);
  assert.equal(owner.arbitraryStateRootArgumentAllowed, false);
  assert.equal(owner.arbitraryCommandAllowed, false);
  assert.equal(owner.operationLease.mode,
    "exclusive-open-held-for-worker-lifetime");
  assert.equal(owner.operationLease.evidence, false);
  assert.equal(owner.maximumConcurrentWorkers, 1);
  assert.equal(profile.conversionProcessContainment.breakawayAllowed, false);
  assert.equal(profile.conversionProcessContainment.workerExitMayLeaveConverterRunning,
    false);
  assert.equal(profile.conversionProcessContainment.unsupportedPlatform,
    "reject-before-converter-launch");
});

test("pins the exact first source closure and bounded network behavior", () => {
  const source = profile.builtInSourceDescriptor;
  assert.equal(source.repository, "Qwen/Qwen3-0.6B");
  assert.equal(source.revision, "c1899de289a04d12100db370d81485cdf75e47ca");
  assert.equal(source.modelSourceLockSha256,
    "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d");
  assert.equal(source.tokenizerSourceLockSha256,
    "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70");
  assert.equal(source.compositionProfileSha256,
    "c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0");
  assert.equal(source.fileCount, 9);
  assert.equal(source.aggregatePayloadBytes, 1519207688);
  assert.equal(source.ambientLatestRevisionAllowed, false);
  assert.equal(source.credentialsAllowed, false);

  const acquisition = profile.sourceAcquisition;
  assert.equal(acquisition.bufferBytes, 1048576);
  assert.equal(acquisition.automaticRedirect, false);
  assert.equal(acquisition.maximumRedirects, 8);
  assert.equal(acquisition.networkRetryWithinWorker, false);
  assert.equal(acquisition.alternateOriginRetry, false);
  assert.equal(acquisition.partialEvidenceDeletedOnFailure, false);
  assert.equal(acquisition.initialResponse, "200-only");
  assert.match(acquisition.resumeResponse, /^206-/u);
});

test("classifies restart and cancellation without relaunch ambiguity", () => {
  const lost = profile.restartRecovery.find(entry =>
    entry.state === "converting-or-verifying-composition" &&
    entry.ownerLease === "unheld" && entry.terminalEvidence === "pending");
  assert.equal(lost.action, "reject-operation-owner-lost-without-relaunch");
  assert.equal(profile.cancellation.terminalNativePassWinsRace, true);
  assert.equal(profile.cancellation.terminalNativeRejectionWinsRace, true);
  assert.equal(profile.cancellation.secondGenerationStarted, false);
  assert.equal(profile.cancellation.hostWaitExpiry,
    "companion-unavailable-with-intent-still-authoritative");
});

test("keeps every output and campaign claim at zero", () => {
  assert.equal(profile.authority.legacySupportAllowed, false);
  assert.equal(profile.authority.compatibilityReaderAllowed, false);
  assert.equal(profile.authority.fallbackAllowed, false);
  assert.equal(profile.authority.hiddenRetryAllowed, false);
  assert.equal(profile.authority.fakeSuccessAllowed, false);
  assert.equal(profile.authority.memoryEndpointsAuthorizedAndRecommended, true);
  assert.equal(profile.authority.memoryEndpointsLiveEvidencePresent, false);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every(value => value === false));
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("contains no credential or forbidden private drive reference", () => {
  const text = Buffer.concat([profileBytes, decisionBytes]).toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
