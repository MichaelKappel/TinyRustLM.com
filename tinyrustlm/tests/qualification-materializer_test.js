"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const owner = require("../tools/qualification-materializer.js");

/** Metadata-only request fixture; none of these nonexistent inputs can qualify a model. */
function request() {
  return { schema: owner.SCHEMA, sourceCommit: "1".repeat(40), issuedAtUtc: "2026-09-29T23:00:00Z",
    compositionRoot: "D:\\LLMs\\TinyRustLM\\never-executed-qualification-fixture",
    outputDirectory: "E:\\Source\\Rust\\TinyRustLM.com\\artifacts\\verification\\never-executed-qualification-fixture",
    defaultSampling: {}, evidence: Object.fromEntries(owner.EVIDENCE.map((name) => [name,
      { path: `artifacts/verification/never-executed-${name}.json`, bytes: 1, sha256: "2".repeat(64) }])) };
}

test("qualification request requires the exact evidence closure and immutable identities", () => {
  assert.equal(owner.validateRequest(request()).schema, owner.SCHEMA);
  for (const mutate of [
    (r) => { r.force = true; }, (r) => { r.schema = "old"; }, (r) => { r.sourceCommit = "HEAD"; },
    (r) => { r.issuedAtUtc = "today"; }, (r) => { delete r.evidence.sourceRaw; },
    (r) => { r.evidence.review.path = "artifacts/../private.json"; },
    (r) => { r.evidence.review.path = "C:/private.json"; },
    (r) => { r.evidence.review.bytes = 0; }, (r) => { r.evidence.review.bytes = 33554433; },
    (r) => { r.evidence.review.sha256 = "invalid"; }
  ]) { const input = request(); mutate(input); assert.throws(() => owner.validateRequest(input), /qualification-/); }
});

test("an explicit verdict alone cannot create a qualification receipt", () => {
  assert.throws(() => owner.validateEvidence(request(), { review: { schema: owner.REVIEW_SCHEMA,
    reviewer: { id: "fixture", role: "test", reviewedAtUtc: "2026-09-29T22:00:00Z" },
    qualityClaim: "task-specific-qualified", qualityScope: "public-release-cases", releaseStatus: "not-released",
    bindings: {} } }, {}), /qualification-review-bindings/);
});
