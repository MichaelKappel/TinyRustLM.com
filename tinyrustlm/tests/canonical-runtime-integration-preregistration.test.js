"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/canonical-runtime-integration-preregistration.v1.json"
);
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("binds one prelaunch product and the exact clean-cut parent", () => {
  assert.equal(profileBytes.length, 10764);
  assert.equal(sha256(profileBytes),
    "dbc2c686c2e276062e3d96c37002a6aa310d96231c3bdcf66655c611d9cb10ea");
  assert.equal(profile.schema,
    "tinyrustlm.canonical-runtime-integration-preregistration.v1");
  assert.equal(profile.status,
    "registered-output-free-before-runtime-integration");
  assert.equal(profile.registrationParentCommit,
    "564884c5986ea507405e9bb0d6989b1d1ad6c04d");
  assert.equal(profile.registrationParentTree,
    "891eb2ba080c140bbc148f53e7835bfb69912672");
  assert.equal(profile.authority.productLifecycle, "prelaunch-single-product");
  assert.equal(profile.authority.productGenerationCount, 1);
  assert.equal(profile.authority.secondProductGenerationExists, false);
  assert.equal(profile.authority.technicalRevisionIsProductGeneration, false);
});

test("registers only narrow owner-preserving API additions", () => {
  const additions = profile.authorizedOwnerPreservingApiAdditions;
  assert.deepEqual(additions.composition2.map((entry) => entry.signature), [
    "ActivationState::active() -> Option<&PreparedComposition>",
    "ActivationState::begin_generation(expected_operation) -> Result<(), Acg2Error>"
  ]);
  assert.deepEqual(additions.prompt2.map((entry) => entry.signature), [
    "Prompt2Runtime::decode_generated(token_ids, output) -> Result<(), Prompt2Error>"
  ]);
  assert.equal(additions.formatWireAndAlgorithmChangesAuthorized, false);
  assert.equal(additions.artifactRegenerationAuthorized, false);
  assert.equal(additions.acceptedEvidenceRerunAuthorized, false);
});

test("moves scalar authority instead of copying or wrapping it", () => {
  assert.equal(profile.canonicalRuntimeOwnership.packageName,
    "tinyrustlm-runtime");
  assert.equal(profile.scalarAuthorityMove.copyAllowed, false);
  assert.equal(profile.scalarAuthorityMove.moveExactArithmeticAndTests, true);
  assert.equal(profile.scalarAuthorityMove.deleteSourceCrateAfterRetarget, true);
  assert.equal(profile.observedIntegrationGap.compatibilityWrapperAllowed,
    false);
  assert.equal(profile.observedIntegrationGap.duplicateTokenizerRuntimeAllowed,
    false);
  assert.equal(profile.observedIntegrationGap.duplicateScalarAuthorityAllowed,
    false);
});

test("freezes transactional activation and exact generation semantics", () => {
  assert.deepEqual(profile.activationAlgorithm.slice(-4), [
    "compare-model-byte-identity-and-closed-model-spec-to-the-prepared-composition",
    "reject-stale-operation-without-changing-active-runtime",
    "perform-ActivationState-ownership-swap",
    "infallibly-install-the-already-prepared-scalar-session"
  ]);
  assert.match(profile.conversationStateMachine.begin.join(" "),
    /exact-committed-token-prefix/u);
  assert.match(profile.conversationStateMachine.step.join(" "),
    /template-owned-stop-token/u);
  assert.match(profile.conversationStateMachine.finish.join(" "),
    /decode-all-generated-non-stop-token-ids-once/u);
  assert.equal(profile.resourceContract.modelWeightShadowBytes, 0);
  assert.equal(profile.failureContract.automaticRetry, false);
  assert.equal(profile.failureContract.bestOfN, false);
  assert.equal(profile.failureContract.responseRepair, false);
  assert.equal(profile.failureContract.fallbackRuntime, false);
});

test("creates no implementation output, claim, or campaign credit", () => {
  for (const value of Object.values(profile.registrationOutputBoundary)) {
    assert.equal(value, false);
  }
  for (const value of Object.values(profile.claimBoundary)) {
    assert.equal(value, false);
  }
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("is bounded, strict JSON, ASCII, and free of private output", () => {
  assert.ok(profileBytes.length <= 24576);
  assert.doesNotMatch(profileBytes.toString("utf8"), /[^\x09\x0a\x0d\x20-\x7e]/u);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(profileBytes.toString("utf8"), /[CD]:[\\/]/u);
});
