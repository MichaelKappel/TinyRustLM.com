"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-result.v4.json"
);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes execution /4 as one terminal prelaunch custody failure", () => {
  assert.equal(resultBytes.length, 5293);
  assert.equal(
    sha256(resultBytes),
    "c928b55cf9eb871c09b7f1e1aacf1983bf3a7e2fe6ca4697aa58c50648187a35"
  );
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v4");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/4");
  assert.equal(result.status, "terminal-prelaunch-failure");
  assert.equal(result.decision.code, "rust-build-exit-code-not-captured");
});

test("binds the remote-exact registration and immutable predecessor", () => {
  assert.deepEqual(result.predecessor, {
    resultPath: "contracts/vnext/qwen3-real-composition-execution-result.v3.json",
    resultByteLength: 8773,
    resultSha256: "2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4",
    status: "terminal-native-rejection",
    reused: false,
    modified: false
  });
  assert.equal(result.registration.profileByteLength, 31580);
  assert.equal(result.registration.profileSha256,
    "f3f549a108c4a3acb767b241f2d1ef6d2db737c67442f059e8e943dabb992275");
  assert.equal(result.registration.commit,
    "8948baf1d21a73cde5781cf74a7c5020fd0b8cca");
  assert.equal(result.registration.tree,
    "6a25e28f45b9bf69d82782efb965a9c0da5dee76");
  assert.equal(result.registration.remoteExactBeforeBuild, true);
});

test("preserves the sole build observation without inventing an exit code", () => {
  const build = result.rustBuildObservation;
  assert.equal(build.attemptCount, 1);
  assert.equal(build.sourceCommit, result.registration.commit);
  assert.equal(build.sourceTree, result.registration.tree);
  assert.deepEqual(build.command, [
    "cargo", "build", "--locked", "--release", "-p", "tinyrustlm-convert",
    "--target", "x86_64-pc-windows-msvc"
  ]);
  assert.equal(build.childExitCodeCaptured, false);
  assert.equal(build.childExitCode, null);
  assert.deepEqual(build.stdout, {
    byteLength: 0,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  });
  assert.deepEqual(build.stderr, {
    byteLength: 1874,
    sha256: "edf2073ffe971fea9394d06c99c7fc201f34515aad85b3d2c41ae9a097a9fdae"
  });
  assert.equal(build.cargoFinishedTextObserved, true);
  assert.equal(build.cargoFinishedTextAcceptedAsExitCodeEvidence, false);
  assert.deepEqual(build.candidateExecutable, {
    fileName: "tinyrustlm-convert.exe",
    byteLength: 852992,
    sha256: "cd24a738b327b89d03501205301e89321bbd3955be91dfb245d2219a8b9201d5",
    peMachine: "0x8664",
    acceptedAsSuccessfulBuild: false
  });
  assert.equal(build.observationFailure.code,
    "rust-build-exit-code-not-captured");
  assert.equal(build.observationFailure.rootCauseEstablished, true);
  assert.equal(build.observationFailure.buildMayBeRerun, false);
});

test("records exactly which roots exist and forbids later execution", () => {
  assert.equal(result.rootObservation.controlRootCreated, true);
  assert.equal(result.rootObservation.rustBuildRootCreated, true);
  assert.equal(result.rootObservation.managedBuildRootCreated, false);
  assert.equal(result.rootObservation.privateEvidenceRootCreated, false);
  assert.equal(result.rootObservation.outputRootCreated, false);
  assert.equal(result.rootObservation.relevantBuildOrConverterProcessesObservedAfterFailure,
    0);
  assert.deepEqual(result.executionObservation, {
    privateRequestCreated: false,
    privateExecutionBindingCreated: false,
    controllerInvocationCount: 0,
    converterLaunchCount: 0,
    managedInspectorBuildAttempts: 0,
    managedInspectionInvoked: false,
    compositionArtifactCreated: false,
    terminalPassCreated: false,
    terminalRejectionCreated: false
  });
});

test("closes /4 without reuse cleanup repair or claim inflation", () => {
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.retryUnderRegistrationAllowed, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeDeleted, false);
  assert.equal(result.decision.existingPrivateEvidenceMayBeOverwritten, false);
  assert.equal(result.decision.buildRootMayBeReused, false);
  assert.equal(result.decision.candidateExecutableMayBeAdopted, false);
  assert.equal(result.decision.cargoTextMayBePromotedToExitCodeEvidence, false);
  assert.equal(result.decision.newAttemptRequiresSourceControlledBuildCustody, true);
  assert.equal(result.decision.newAttemptRequiresNewRegistrationAndAllNewLogicalRoots,
    true);
  assert.equal(result.claimBoundary.rustBuildAttempted, true);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    if (field !== "rustBuildAttempted") {
      assert.equal(value, false, field);
    }
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("publishes no private path credential or private model content", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.doesNotMatch(text, /model\.safetensors|tokenizer\.json|rust-build\.stderr/u);
});
