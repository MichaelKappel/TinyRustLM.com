"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const resultPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-real-composition-execution-result.v5.json"
);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes execution /5 as one terminal source-anchor invalidation", () => {
  assert.equal(resultBytes.length, 4372);
  assert.equal(
    sha256(resultBytes),
    "06006e0533c1f1b02492aacb8aee675ac1c5dbd50d6c3f67441b58918bd0c798"
  );
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.schema,
    "tinyrustlm.qwen3-real-composition-execution-result.v5");
  assert.equal(result.executionProfileId,
    "tinyrustlm.qwen3-real-composition-execution/5");
  assert.equal(result.status, "terminal-prelaunch-failure");
  assert.equal(result.decision.code,
    "registration-commit-no-longer-remote-tip-before-private-materialization");
});

test("binds the immutable /4 predecessor and exact /5 registration", () => {
  assert.deepEqual(result.predecessor, {
    resultPath: "contracts/vnext/qwen3-real-composition-execution-result.v4.json",
    resultByteLength: 5293,
    resultSha256: "c928b55cf9eb871c09b7f1e1aacf1983bf3a7e2fe6ca4697aa58c50648187a35",
    status: "terminal-prelaunch-failure",
    reused: false,
    modified: false
  });
  assert.equal(result.registration.profileByteLength, 41928);
  assert.equal(result.registration.profileSha256,
    "221afa82a71da22516dda142f90270a08205cdced9df6093108b0bacfaf88b55");
  assert.equal(result.registration.commit,
    "307b94009342e76974ccdc19e56a9e1f7f9788d1");
  assert.equal(result.registration.tree,
    "76a73ebf4ea34adf72617f95033e56f611b5a8da");
  assert.equal(result.registration.remoteExactBeforeAnyPrivateMaterial, true);
});

test("records the one intervening documentation path without weakening exact identity", () => {
  assert.equal(result.sourceControlObservation.currentCommit,
    "81631d0b5bd2f23c5defc17e7027884bdce0be86");
  assert.equal(result.sourceControlObservation.currentTree,
    "e82a38ba1ff708eef30058da69619b7e5b5f43f4");
  assert.equal(result.sourceControlObservation.currentRemoteExact, true);
  assert.equal(result.sourceControlObservation.registrationCommitIsAncestorOfCurrent, true);
  assert.equal(result.sourceControlObservation.registrationCommitIsCurrentRemoteTip, false);
  assert.equal(result.sourceControlObservation.changedPathCountAfterRegistration, 1);
  assert.deepEqual(result.sourceControlObservation.changedPathsAfterRegistration, [
    "docs/research-prompts/2026-08-25-twelve-disconnected-post-composition-first-model-clean-cut-research-prompts.md"
  ]);
  assert.equal(result.sourceControlObservation.changedExecutableSentinelCount, 0);
  assert.equal(result.sourceControlObservation.exactRegistrationCommitStillRequired, true);
  assert.equal(result.sourceControlObservation.remoteRewindAllowed, false);
});

test("proves every registered private logical name remained absent", () => {
  const observation = result.privateMaterialObservation;
  assert.equal(observation.registeredLogicalNameCount, 9);
  assert.equal(observation.existingRegisteredLogicalNameCount, 0);
  for (const [field, value] of Object.entries(observation)) {
    if (!["registeredLogicalNameCount", "existingRegisteredLogicalNameCount"].includes(field)) {
      assert.equal(value, false, field);
    }
  }
});

test("records zero preflight build controller converter and inspection operations", () => {
  const observation = result.executionObservation;
  for (const [field, value] of Object.entries(observation)) {
    if (field.endsWith("Count")) assert.equal(value, 0, field);
    else assert.equal(value, false, field);
  }
});

test("closes /5 without rewrite reuse retry cleanup or claim inflation", () => {
  assert.equal(result.decision.rootCauseEstablished, true);
  assert.equal(result.decision.registrationClosed, true);
  assert.equal(result.decision.retryUnderRegistrationAllowed, false);
  assert.equal(result.decision.remoteHistoryRewriteAllowed, false);
  assert.equal(result.decision.registeredLogicalNamesMayBeReused, false);
  assert.equal(result.decision.privateCleanupRequired, false);
  assert.equal(result.decision.privateEvidenceMayBeInvented, false);
  assert.equal(result.decision.newAttemptRequiresNewRegistrationAndAllNewLogicalNames, true);
  assert.equal(result.claimBoundary.realConversionAttemptRegistered, true);
  for (const [field, value] of Object.entries(result.claimBoundary)) {
    if (field !== "realConversionAttemptRegistered") assert.equal(value, false, field);
  }
  assert.deepEqual(result.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("publishes no private path credential prompt or private model content", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.doesNotMatch(text,
    /model\.safetensors|tokenizer\.json|rust-build\.stderr|"prompt"\s*:/u);
});
