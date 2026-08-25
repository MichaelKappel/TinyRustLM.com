"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-result.v1.json"
);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("records the registration /1 boundary as a canonical pre-launch failure", () => {
  assert.equal(resultBytes.length, 4076);
  assert.equal(
    sha256(resultBytes),
    "dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce"
  );
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema, "tinyrustlm.qwen3-real-composition-execution-result.v1");
  assert.equal(result.executionProfileId, "tinyrustlm.qwen3-real-composition-execution/1");
  assert.equal(result.status, "terminal-prelaunch-failure");
});

test("preserves the successful build identity without calling it conversion", () => {
  assert.equal(result.build.attemptCount, 1);
  assert.equal(result.build.exitCode, 0);
  assert.equal(result.build.executable.byteLength, 836096);
  assert.equal(
    result.build.executable.sha256,
    "5bb266e1b2a722b34845e09cb86fbcb353c8c9f6325f6738df7745b3c31a96e5"
  );
  assert.equal(result.build.executable.peMachine, "0x8664");
  assert.equal(result.executionObservation.converterLaunchCount, 0);
  assert.equal(result.executionObservation.converterProcessStarted, false);
  assert.equal(result.executionObservation.outputRootExists, false);
});

test("binds the exact observed private inventory without publishing private paths", () => {
  assert.deepEqual(result.privateEvidenceObservation.inventory, [
    {
      file: "build.stderr.bin",
      byteLength: 1874,
      sha256: "1213b18ef1c3159943ddbb64ecebf00d009697cce8ce1b81db3fa59d0adcfdcb"
    },
    {
      file: "build.stdout.bin",
      byteLength: 0,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ]);
  assert.equal(result.privateEvidenceObservation.bindingExists, false);
  assert.equal(result.privateEvidenceObservation.startRecordExists, false);
  assert.doesNotMatch(resultBytes.toString("utf8"), /[CDE]:[\\/]/u);
});

test("closes registration /1 without retry, cleanup, or inflated claims", () => {
  assert.equal(result.decision.rootCauseEstablished, false);
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.retryUnderRegistrationAllowed, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeRelabeledAsPass, false);
  assert.equal(result.claimBoundary.realConverterInvoked, false);
  assert.equal(result.claimBoundary.structuralCompositionVerified, false);
  assert.equal(result.claimBoundary.browserChatVerified, false);
  assert.equal(result.claimBoundary.campaignCreditAuthorized, false);
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
