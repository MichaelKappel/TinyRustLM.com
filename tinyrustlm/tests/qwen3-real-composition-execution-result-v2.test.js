"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-result.v2.json"
);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes execution /2 as one canonical native rejection", () => {
  assert.equal(resultBytes.length, 8275);
  assert.equal(
    sha256(resultBytes),
    "4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c"
  );
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(
    result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v2"
  );
  assert.equal(result.executionProfileId, "tinyrustlm.qwen3-real-composition-execution/2");
  assert.equal(result.status, "terminal-native-rejection");
  assert.equal(result.predecessor.modified, false);
  assert.equal(result.predecessor.reused, false);
});

test("preserves both successful builds and the one converter launch", () => {
  assert.equal(result.builds.rust.attemptCount, 1);
  assert.equal(result.builds.rust.exitCode, 0);
  assert.equal(result.builds.rust.executable.byteLength, 836096);
  assert.equal(
    result.builds.rust.executable.sha256,
    "c14b03a67bc1c8775b8c60816b3faf52b0842ebf7c76c690b368fb59c2064ba4"
  );
  assert.equal(result.builds.rust.executable.unchangedAfterExecution, true);
  assert.equal(result.builds.managedInspector.attemptCount, 1);
  assert.equal(result.builds.managedInspector.exitCode, 0);
  assert.equal(result.executionObservation.controllerInvocationCount, 1);
  assert.equal(result.executionObservation.controllerExitCode, 0);
  assert.equal(result.executionObservation.converterLaunchCount, 1);
  assert.equal(result.executionObservation.converterProcess.started, true);
  assert.equal(result.executionObservation.converterProcess.exitCode, 1);
  assert.equal(result.executionObservation.converterProcess.timedOut, false);
  assert.equal(result.executionObservation.converterProcess.killedForOverflow, false);
});

test("binds the immutable rejection lineage and no managed laundering", () => {
  assert.equal(result.nativeRejection.errorCode, "qwen3-tensor-inventory-mismatch");
  assert.equal(result.nativeRejection.retryable, false);
  assert.equal(result.nativeRejection.partialOutputPreserved, true);
  assert.equal(result.nativeRejection.attempt.byteLength, 711);
  assert.equal(result.nativeRejection.rejection.byteLength, 436);
  assert.equal(result.executionObservation.terminal.status, "terminal-process-failure");
  assert.equal(result.executionObservation.managedInspectionInvoked, false);
  assert.equal(result.executionObservation.managedIntentCreated, false);
  assert.equal(result.decision.managedInspectionMayBeUsedToLaunderControllerFailure,
    false);
});

test("records the general tied-output profile defect without blaming source bytes", () => {
  const cause = result.rootCauseObservation;
  assert.equal(cause.sourceModelSha256,
    "f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b");
  assert.equal(cause.safetensorsHeaderByteLength, 35552);
  assert.equal(cause.observedSourceTensorCount, 311);
  assert.equal(cause.registeredExpectedTensorCount, 310);
  assert.deepEqual(cause.missingExpectedTensorNames, []);
  assert.deepEqual(cause.additionalTensorNames, ["lm_head.weight"]);
  assert.deepEqual(cause.embeddingTensor.shape, [151936, 1024]);
  assert.deepEqual(cause.tiedOutputTensor.shape, [151936, 1024]);
  assert.equal(cause.embeddingTensor.byteLength, 311164928);
  assert.equal(cause.embeddingTensor.sha256, cause.tiedOutputTensor.sha256);
  assert.equal(cause.tiedPayloadsByteIdentical, true);
  assert.equal(cause.registeredRule,
    "forbidden-when-tie_word_embeddings-is-true");
  assert.equal(cause.sourceDefectEstablished, false);
  assert.equal(cause.profileDefectEstablished, true);
});

test("closes /2 without cleanup retry or inflated claims", () => {
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.retryUnderRegistrationAllowed, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(result.decision.partialOutputMayBeCleaned, false);
  assert.equal(result.decision.outputMayBeRepaired, false);
  assert.equal(result.decision.newAttemptRequiresCorrectedSourceTensorProfile, true);
  assert.equal(result.decision.newAttemptRequiresGeneralRegressionTests, true);
  assert.equal(result.claimBoundary.realConverterInvoked, true);
  assert.equal(result.claimBoundary.strictNativeRejectionObserved, true);
  for (const field of [
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
    assert.equal(result.claimBoundary[field], false, field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("publishes no private path or credential", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
});
