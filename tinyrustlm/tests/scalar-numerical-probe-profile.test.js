"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "scalar-numerical-probe-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertIdentity(identity) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, identity.path));
  assert.equal(bytes.length, identity.byteLength, identity.path);
  assert.equal(sha256(bytes), identity.sha256, identity.path);
}

test("freezes the sole scalar numerical probe profile", () => {
  assert.equal(profileBytes.length, 9660);
  assert.equal(sha256(profileBytes),
    "34b1bd8f45dcd764b4b78850fa0a54b740ca143bde14a201a7c7f2ef0b46f000");
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema, "tinyrustlm.scalar-numerical-probe-profile.v1");
  assert.equal(profile.profileId, "tinyrustlm.scalar-numerical-probe/1");
  assert.equal(profile.status,
    "implemented-unpromoted-fixture-verified-real-model-unexecuted");
  for (const identity of Object.values(profile.implementation)
    .filter((value) => value && typeof value === "object" && value.path)) {
    assertIdentity(identity);
  }
});

test("requires a strict create-only bounded request and output", () => {
  assert.equal(profile.input.schema,
    "tinyrustlm.scalar-numerical-probe-request.v1");
  assert.equal(profile.input.unknownFields, "fatal");
  assert.match(profile.input.duplicateFields, /^fatal/u);
  assert.equal(profile.input.explicitNull, "fatal");
  assert.equal(profile.input.model.fileName, "model.slm2");
  assert.equal(profile.input.traceProfileId,
    "tinyrustlm.scalar-full-stage-f32le/1");
  assert.equal(profile.implementation.outputWriteMode, "create-only");
  assert.equal(profile.execution.overwrite, false);
  assert.equal(profile.execution.cleanupOnFailure, false);
  assert.equal(profile.execution.resultFile, "probe.json-created-last");
  assert.equal(profile.output.directoryDurabilityClaimed, false);
});

test("binds every scalar stage without a weight shadow or fallback", () => {
  assert.equal(profile.trace.elementEncoding, "IEEE754-binary32-little-endian");
  assert.equal(profile.trace.nonfinite, "fatal");
  assert.equal(profile.trace.stageCountFormula, "3-plus-9-times-layerCount");
  assert.equal(profile.trace.stageOrder.length, 12);
  assert.equal(profile.cleanCut.runtimeRepacking, false);
  assert.equal(profile.cleanCut.F32WeightShadow, false);
  assert.equal(profile.cleanCut.fallbackRuntime, false);
  assert.equal(profile.cleanCut.retry, false);
  assert.equal(profile.cleanCut.bestOfN, false);
});

test("keeps fixture evidence and every downstream claim in bounds", () => {
  assert.equal(profile.fixtureVerification.testsPassed, 5);
  assert.equal(profile.fixtureVerification.testsFailed, 0);
  assert.equal(profile.fixtureVerification.realQwen3Executed, false);
  assert.equal(profile.fixtureVerification.fixtureCountsAsRealModel, false);
  assert.equal(profile.claimBoundary.probeImplementationExists, true);
  assert.equal(profile.claimBoundary.canonicalFixtureVerified, true);
  for (const [claim, value] of Object.entries(profile.claimBoundary)) {
    if (!["probeImplementationExists", "canonicalFixtureVerified"].includes(claim)) {
      assert.equal(value, false, claim);
    }
  }
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("source contains the create-only synchronized traced execution path", () => {
  const source = fs.readFileSync(path.join(repositoryRoot,
    profile.implementation.owner.path), "utf8");
  assert.match(source, /#!\[forbid\(unsafe_code\)\]/u);
  assert.match(source, /\.create_new\(true\)/u);
  assert.match(source, /forward_token_traced/u);
  assert.match(source, /sync_all\(\)/u);
  assert.match(source, /scalar-probe-output-exists/u);
  assert.match(source, /private-scalar-traces-created-not-numerical-parity/u);
  assert.doesNotMatch(source, /best[_-]of[_-]n/iu);
  assert.doesNotMatch(source, /response[_-]repair/iu);
});
