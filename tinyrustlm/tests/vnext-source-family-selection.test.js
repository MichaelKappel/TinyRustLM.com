"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildSelection,
  selectionBytes,
  verifySelection
} = require("../tools/generate-vnext-source-family-selection.js");

test("source-family selection binds all rejected assessments without admitting an artifact", () => {
  const selection = buildSelection();
  assert.equal(selection.schema, "tinyrustlm.vnext.source_family_selection.v1");
  assert.equal(selection.candidateAssessmentCount, 37);
  assert.equal(selection.candidatePreflightCount, 9);
  assert.equal(selection.candidateSourceScreenCount, 28);
  assert.equal(selection.candidates.length, 37);
  assert.ok(selection.candidates.every((candidate) => candidate.decision === "rejected"));
  assert.ok(selection.candidates.every((candidate) =>
    Object.hasOwn(candidate, "licenseId") &&
    Object.hasOwn(candidate, "modelArtifactSha256") &&
    Object.hasOwn(candidate, "provenanceStatus") &&
    Object.hasOwn(candidate, "screenStatus") &&
    Object.hasOwn(candidate, "tokenizerSha256")));
  assert.equal(
    selection.candidates.filter((candidate) => candidate.evidenceClass === "preflight").length,
    9
  );
  assert.ok(selection.candidates
    .filter((candidate) => candidate.evidenceClass === "preflight")
    .every((candidate) => candidate.caseCount === null &&
      candidate.passCount === null && candidate.modelArtifactSha256 === null));
  assert.ok(selection.candidates
    .filter((candidate) => candidate.evidenceClass === "source-screen")
    .every((candidate) => Number.isInteger(candidate.caseCount) &&
      Number.isInteger(candidate.passCount) && /^[0-9a-f]{64}$/u.test(candidate.modelArtifactSha256)));
  assert.equal(selection.artifactAdmissionStatus, "none");
  assert.equal(
    selection.decision,
    "qwen2-family-selected-for-structural-converter-reference-only"
  );
  assert.equal(selection.existingArtifactDecision, "rejected");
  assert.equal(selection.selectedBaseModelId, "Qwen/Qwen2.5-0.5B-Instruct");
  assert.equal(selection.selectedArchitectureProfile, "tinyrustlm.qwen2-dense-gqa/1");
  assert.equal(
    selection.selectedBaseTokenizerSha256,
    "c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539"
  );
  assert.equal(selection.workingModelPlan, "new-fully-pinned-qwen3-0.6b-derivative");
  assert.equal(selection.workingModelStatus, "not-trained-not-screened-not-admitted");
  assert.match(selection.candidateAssessmentSetSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(verifySelection(), selectionBytes());
});
