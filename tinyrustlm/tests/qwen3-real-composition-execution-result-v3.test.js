"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-result.v3.json"
);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes execution /3 as one canonical nonretryable rejection", () => {
  assert.equal(resultBytes.length, 8773);
  assert.equal(
    sha256(resultBytes),
    "2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4"
  );
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema, "tinyrustlm.qwen3-real-composition-execution-result.v3");
  assert.equal(result.executionProfileId, "tinyrustlm.qwen3-real-composition-execution/3");
  assert.equal(result.status, "terminal-native-rejection");
  assert.equal(result.predecessor.reused, false);
  assert.equal(result.predecessor.modified, false);
});

test("binds both builds and exactly one controller and converter invocation", () => {
  assert.equal(result.builds.rust.attemptCount, 1);
  assert.equal(result.builds.rust.exitCode, 0);
  assert.equal(result.builds.rust.executable.byteLength, 846336);
  assert.equal(
    result.builds.rust.executable.sha256,
    "0420e38d0a2832b7fdcc39064343a6d4529a7d2d49679c1e96e15b4ba7ee401c"
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

test("preserves the partial model conversion without promoting composition", () => {
  assert.equal(result.nativeRejection.errorCode, "qwen-tokenizer2-output-path-invalid");
  assert.equal(result.nativeRejection.retryable, false);
  assert.equal(result.nativeRejection.partialOutputPreserved, true);
  assert.equal(result.partialModelConversion.modelFile.byteLength, 598308416);
  assert.equal(
    result.partialModelConversion.modelFile.sha256,
    "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7"
  );
  assert.equal(result.partialModelConversion.modelFile.tensorCount, 310);
  assert.equal(
    result.partialModelConversion.modelReceipt.schema,
    "tinyrustlm.qwen3_conversion_receipt.v2"
  );
  assert.equal(result.partialModelConversion.completeCompositionCreated, false);
  assert.equal(result.partialModelConversion.runtimeActivated, false);
  assert.equal(result.partialModelConversion.productQualified, false);
  assert.equal(result.executionObservation.managedInspectionInvoked, false);
});

test("records the general Tokenizer2 suffix-contract defect", () => {
  const cause = result.rootCauseObservation;
  assert.equal(cause.compositionTokenizerFile, "tokenizer.tokenizer2");
  assert.equal(cause.standaloneTokenizerWriterRequiredSuffix, ".tok2");
  assert.equal(cause.requiredSoleSuffix, ".tokenizer2");
  assert.equal(
    cause.diagnosis,
    "suffix-contract-divergence-between-composition-and-standalone-tokenizer-writer"
  );
  assert.equal(cause.sourceDefectEstablished, false);
  assert.equal(cause.modelConverterDefectEstablished, false);
  assert.equal(cause.tokenizerOutputContractDefectEstablished, true);
  assert.equal(cause.obsoleteSuffixMayRemainExecutable, false);
});

test("closes /3 without retry cleanup repair or inflated claims", () => {
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.retryUnderRegistrationAllowed, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(result.decision.partialOutputMayBeCleaned, false);
  assert.equal(result.decision.outputMayBeRepaired, false);
  assert.equal(result.decision.managedInspectionMayBeUsedToLaunderControllerFailure, false);
  assert.equal(result.decision.newAttemptRequiresCorrectedTokenizerOutputProfile, true);
  assert.equal(result.decision.newAttemptRequiresCorrectedCompositionProfile, true);
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
