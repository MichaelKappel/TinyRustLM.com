"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationPath = path.join(repositoryRoot,
  "contracts/vnext/prompt2-q8-dependency-rebind-preregistration.v1.json");
const architecturePath = path.join(repositoryRoot,
  "docs/architecture/2026-08-24-prompt2-q8-dependency-rebind-preregistration.md");
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readRepositoryFile(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
}

function assertIdentity(identity) {
  const bytes = readRepositoryFile(identity.path);
  assert.equal(bytes.length, identity.byteLength, identity.path);
  assert.equal(sha256(bytes), identity.sha256, identity.path);
}

test("freezes the exact output-free Prompt2 Q8 rebind registration", () => {
  assert.equal(registrationBytes.length, 11_709);
  assert.equal(sha256(registrationBytes),
    "6f97685e1db5fcdf7e5ecb00b70434e74cceda82ca104bc9845688aeab7e3188");
  assert.equal(registration.schema,
    "tinyrustlm.prompt2-q8-dependency-rebind-preregistration.v1");
  assert.equal(registration.status,
    "registered-output-free-before-prompt2-replacement");
  assert.equal(registration.registrationParentCommit,
    "14ebe90cc74238783927420c49e893507b829d21");
  assert.equal(registration.registrationParentTree,
    "529fc818431ae176359c7d383b008b847017b78f");

  const architectureBytes = fs.readFileSync(architecturePath);
  assert.equal(architectureBytes.length, 10_135);
  assert.equal(sha256(architectureBytes),
    "d4fc508034623f2087f8c9fe705b6c7dd26957e733e0ba6601603210ab5c55f0");
});

test("records the stale Prompt2 input without retaining it as executable", () => {
  const defect = registration.observedDefect;
  assert.equal(defect.detectedBeforeAcg2Output, true);
  assert.equal(defect.defectClass, "stale-exact-dependency-identity");
  assert.equal(defect.hiddenRepairAllowed, false);
  assert.equal(defect.retainOldPrompt2AsExecutableFallback, false);
  assert.equal(defect.weakenAcg2CrossChecks, false);

  const snapshot = registration.registeredInputSnapshot;
  assert.equal(snapshot.prompt2Profile.sha256,
    "b317ae0207522399e63125c57daf91d97432f95b26bd8fb71db746934ff05c8c");
  assert.equal(snapshot.prompt2Profile.boundSlm2FormatProfileSha256,
    "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625");
  assert.equal(snapshot.prompt2Profile.boundSlm2ScalarRuntimeVectorSha256,
    "c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1");
  assert.equal(snapshot.prompt2Vectors.sha256,
    "9d3354785614ff60edc679b6fea6797164ffac368edaa9d3d50912b525048cc0");
  assert.equal(snapshot.prompt2Vectors.canonicalArtifactSha256,
    "d3a123f327e7c4c3eb53d642c4b8d98c39a0b30bac2cc1970922612ae502f142");
  assert.equal(snapshot.prompt2StandaloneLock.sha256,
    "48dca83e7e45403cc012835e593db612003ed49c5fd9024473f1f52a9af21b29");
});

test("binds the exact current mixed-Q8 SLM2 authorities", () => {
  const dependencies = registration.replacementDependencies;
  assertIdentity(dependencies.slm2FormatProfile);
  assertIdentity(dependencies.slm2Q8WeightProfile);
  assertIdentity(dependencies.slm2RuntimeQ8Vectors);
  assert.equal(dependencies.slm2FormatProfile.sha256,
    "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8");
  assert.equal(dependencies.slm2RuntimeQ8Vectors.sha256,
    "c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0");
  assert.equal(dependencies.slm2RuntimeQ8Vectors.canonicalArtifactSha256,
    "4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502");
});

test("keeps accepted dependency evidence immutable", () => {
  const dependencies = registration.immutableDependencies;
  assert.equal(dependencies.tokenizer2.profileSha256,
    "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de");
  assert.equal(dependencies.tokenizer2.artifactSha256,
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b");
  assert.equal(dependencies.tokenizer2.rerunSourceNativeOrBrowserEvidence, false);
  assert.equal(dependencies.template2.profileSha256,
    "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa");
  assert.equal(dependencies.template2.artifactSha256,
    "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8");
  assert.equal(dependencies.template2.rerunSourceNativeOrBrowserEvidence, false);
  assert.equal(dependencies.sampling2.profileSha256,
    "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d");
  assert.equal(dependencies.sampling2.artifactSha256,
    "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89");
  assert.equal(dependencies.sampling2.rerunAcceptedEvidence, false);
});

test("changes only the Prompt2 SLM2 dependency boundary", () => {
  const contract = registration.replacementContract;
  assert.equal(contract.soleProfileId, "org.minimodel.prompt2/2.0");
  assert.equal(contract.binaryLayoutChanges, false);
  assert.equal(contract.artifactByteLength, 512);
  assert.equal(contract.slm2FormatDigestOffset, 432);
  assert.equal(contract.slm2RuntimeQ8VectorDigestOffset, 464);
  assert.deepEqual(contract.dependencyFieldRename, {
    from: "scalarRuntimeVectorSha256",
    to: "runtimeQ8VectorSha256",
    binaryOffsetChanges: false,
    purpose: "remove-stale-dense-f32-semantics-and-name-the-exact-mixed-q8-runtime-authority"
  });
  assert.equal(contract.tokenizerTemplateSamplingAndPromptAlgorithmsChange, false);
  assert.equal(contract.requestResultAndLoadWireLayoutChanges, false);
  assert.equal(contract.resourceCeilingChanges, false);
  assert.equal(contract.stopTokenSeedAndSamplingSemanticsChange, false);
  for (const identity of [
    contract.replacementProfileSha256,
    contract.replacementArtifactSha256,
    contract.replacementVectorSha256,
    contract.replacementNodeSourceSha256
  ]) {
    assert.match(identity, /^unknown-until-post-registration-/u);
  }
});

test("terminally supersedes the premature ACG2 registration before output", () => {
  const invalidated = registration.invalidatedDescendants.acg2ChampionRegistration;
  assertIdentity(invalidated);
  assert.equal(invalidated.registrationCommit,
    "39feda199eea782ff32f9ffb2b93f7c1a1b21d33");
  assert.equal(invalidated.effectiveStatus,
    "terminally-superseded-before-output");
  assert.equal(invalidated.mayBeReused, false);
  assert.equal(invalidated.historicalFilesRemainImmutable, true);
  for (const field of [
    "artifactOutputCreated",
    "vectorOutputCreated",
    "implementationOutputCreated",
    "browserOutputCreated"
  ]) {
    assert.equal(invalidated[field], false, field);
  }
  const corrected = registration.invalidatedDescendants.correctedAcg2Registration;
  assert.equal(corrected.allowedOnlyAfterPrompt2ReplacementCommitIsRemoteExact, true);
  assert.equal(corrected.mustBindReplacementPrompt2ProfileSha256, true);
  assert.equal(corrected.mustUseNewTechnicalRegistrationIdentity, true);
  assert.equal(corrected.createsSecondProductGeneration, false);
});

test("forbids debt, fallback, evidence reruns, and premature claims", () => {
  assert.equal(registration.authority.productLifecycle, "prelaunch-single-product");
  assert.equal(registration.authority.productGenerationCount, 1);
  assert.equal(registration.authority.secondProductGenerationExists, false);
  assert.equal(registration.authority.technicalIdentifiersAreProductGenerations, false);
  assert.equal(registration.authority.memoryEndpointsAuthorized, false);
  assert.equal(registration.authority.writeDriveDAllowed, false);

  for (const [name, value] of
    Object.entries(registration.forbiddenImplementationChanges)) {
    assert.equal(value, false, name);
  }
  for (const [name, value] of
    Object.entries(registration.registrationOutputBoundary)) {
    assert.equal(value, false, name);
  }
  for (const [name, value] of Object.entries(registration.claimBoundary)) {
    assert.equal(value, false, name);
  }
  assert.deepEqual(Object.values(registration.campaignCounters), [
    "0/20", "0/50", "0/25", "0/40", "0/20"
  ]);
});
