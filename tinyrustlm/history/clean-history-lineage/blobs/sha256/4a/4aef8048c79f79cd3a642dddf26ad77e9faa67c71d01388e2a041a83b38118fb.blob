"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildReceipt,
  finalizeReceipt,
  receiptIdentity,
  validateReceipt
} = require("../tools/vector-browser-wasm-verification.js");

/** Clones a JSON value without retaining shared mutable references. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Removes identity fields and recomputes a receipt after one intentional mutation. */
function refinalize(value) {
  const body = clone(value);
  delete body.receiptId;
  delete body.receiptContentHash;
  return finalizeReceipt(body);
}

/** Builds a deterministic receipt over the checked-in immutable observation. */
function sampleReceipt() {
  return buildReceipt({
    generatedAtUtc: "2026-07-22T04:00:00Z",
    verificationSourceRevision: "a".repeat(40)
  });
}

test("validates the immutable browser observation and its sole passing attempt", () => {
  const receipt = sampleReceipt();
  const identity = receiptIdentity(receipt);

  assert.equal(validateReceipt(receipt), receipt);
  assert.deepEqual(identity, {
    id: receipt.receiptId,
    hash: receipt.receiptContentHash
  });
  assert.equal(receipt.evidenceSummary.moduleCount, 3);
  assert.equal(receipt.evidenceSummary.expectedRustTestCountPerRun, 49);
  assert.equal(receipt.evidenceSummary.independentBrowserRuns, 2);
  assert.equal(receipt.evidenceSummary.wasmModuleExecutions, 6);
  assert.equal(receipt.evidenceSummary.allEntryPointsReturnedZero, true);
  assert.equal(receipt.evidenceSummary.allBrowserProcessesClosed, true);
  assert.equal(receipt.evidenceSummary.allProfilesDeleted, true);
  assert.equal(receipt.authority.realBrowserWasmExecutionVerified, true);
  assert.equal(receipt.authority.productIntegrationAuthorized, false);
  assert.equal(receipt.authority.trainingAuthorized, false);
  assert.equal(receipt.openPromotionGaps.length, 3);
  assert.ok(Buffer.byteLength(`${JSON.stringify(receipt, null, 2)}\n`, "utf8") < 1024 * 1024);
});

test("rejects recomputed authority, summary, and retained-gap inflation", () => {
  const authority = clone(sampleReceipt());
  authority.authority.productIntegrationAuthorized = true;
  assert.throws(() => validateReceipt(refinalize(authority)), /authority is invalid/u);

  const count = clone(sampleReceipt());
  count.evidenceSummary.expectedRustTestCountPerRun = 50;
  assert.throws(() => validateReceipt(refinalize(count)), /evidenceSummary is invalid/u);

  const gaps = clone(sampleReceipt());
  gaps.openPromotionGaps.pop();
  assert.throws(() => validateReceipt(refinalize(gaps)), /openPromotionGaps is invalid/u);
});

test("rejects observation, attempt, source-revision, and path drift", () => {
  const observation = clone(sampleReceipt());
  observation.observation.fileSha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(refinalize(observation)), /observation is invalid/u);

  const attempt = clone(sampleReceipt());
  attempt.attempt.attemptContentHash = "0".repeat(64);
  assert.throws(() => validateReceipt(refinalize(attempt)), /attempt binding is invalid/u);

  const revision = clone(sampleReceipt());
  revision.observedSourceRevision = "b".repeat(40);
  assert.throws(() => validateReceipt(refinalize(revision)),
    /observed source revision binding is invalid/u);

  const escaped = clone(sampleReceipt());
  escaped.attempt.path = "../outside.json";
  assert.throws(() => validateReceipt(refinalize(escaped)), /attempt path is invalid/u);
});

test("rejects unknown fields and unrefinalized mutation", () => {
  const unknown = clone(sampleReceipt());
  unknown.passed = true;
  assert.throws(() => validateReceipt(unknown), /receipt fields are invalid/u);

  const mutated = clone(sampleReceipt());
  mutated.evidenceSummary.observedPageErrors = 1;
  assert.throws(() => validateReceipt(mutated), /content identity is invalid/u);
});
