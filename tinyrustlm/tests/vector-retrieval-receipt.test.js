"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const test = require("node:test");

const {
  canonicalInputBytes,
  canonicalReceiptBytes,
  expectedGenerationBaseCommit,
  expectedPreviousReceiptSha256,
  expectedReceiptSha256,
  inputCanonicalization,
  previousReceiptPath,
  receiptEvidenceCommit,
  receiptPath,
  receiptSchema,
  validateReceipt,
  validateReceiptFile
} = require("../tools/vector-retrieval-receipt.js");

/** Clones a receipt through its canonical JSON representation. */
function cloneReceipt(receipt) {
  return JSON.parse(canonicalReceiptBytes(receipt).toString("utf8"));
}

test("validates historical v2 evidence and both immutable predecessors", () => {
  const result = validateReceiptFile();

  assert.equal(result.receipt.schema, receiptSchema);
  assert.equal(result.receipt.previousReceipt.receiptId,
    "exact-flat-retrieval-75f95baa316315ea");
  assert.equal(result.receipt.parentReceipt.receiptId,
    "scalar-oracle-foundation-51ab608f417c0b82");
  assert.equal(result.receipt.productAuthority, false);
  assert.equal(result.receipt.trainingAuthority, false);
  assert.equal(result.receipt.scope.exactFlatF32BaselineVerified, true);
  assert.equal(result.receipt.scope.realWasmExecutionVerified, false);
  assert.equal(result.receipt.gates.length, 8);
  assert.equal(result.receipt.unexecutedGaps.length, 4);
  assert.equal(result.receipt.gitHead, expectedGenerationBaseCommit);
  assert.equal(result.receipt.dirtyWorktree, true);
  assert.equal(result.sha256, expectedReceiptSha256);
  assert.match(receiptEvidenceCommit, /^[a-f0-9]{40}$/u);
});

test("CLI is verification-only and cannot rewrite sealed evidence", () => {
  const toolPath = require.resolve("../tools/vector-retrieval-receipt.js");
  const before = fs.readFileSync(receiptPath);
  const validated = childProcess.spawnSync(process.execPath, [toolPath, "--validate"], {
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).sha256, expectedReceiptSha256);

  const rejected = childProcess.spawnSync(process.execPath, [toolPath, "--write"], {
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /usage:.*--validate/u);
  assert.deepEqual(fs.readFileSync(receiptPath), before);
});

test("preserves v1 bytes and canonicalizes text inputs independently of line endings", () => {
  const previousBytes = fs.readFileSync(previousReceiptPath);
  assert.equal(crypto.createHash("sha256").update(previousBytes).digest("hex"),
    expectedPreviousReceiptSha256);
  assert.equal(JSON.parse(previousBytes.toString("utf8")).schema,
    "tinyrustlm.exact_flat_retrieval_verification_receipt.v1");

  const lf = Buffer.from("alpha\nbeta\n", "utf8");
  const crlf = Buffer.from("alpha\r\nbeta\r\n", "utf8");
  const cr = Buffer.from("alpha\rbeta\r", "utf8");
  assert.deepEqual(canonicalInputBytes(crlf), lf);
  assert.deepEqual(canonicalInputBytes(cr), lf);
  assert.equal(inputCanonicalization, "utf8-lf-v1");
  assert.throws(() => canonicalInputBytes(Buffer.from([0xff])), /strict UTF-8/u);
  assert.throws(() => canonicalInputBytes(Buffer.from("a\u0000b", "utf8")), /NUL/u);
});

test("rejects authority inflation and named-method promotion", () => {
  const original = validateReceiptFile().receipt;
  const product = cloneReceipt(original);
  product.productAuthority = true;
  assert.throws(() => validateReceipt(product), /product authority/u);

  const turboVec = cloneReceipt(original);
  turboVec.scope.turboVecParityVerified = true;
  assert.throws(() => validateReceipt(turboVec), /scope authority.*turboVecParityVerified/u);

  const quality = cloneReceipt(original);
  quality.scope.productRetrievalQualityVerified = true;
  assert.throws(() => validateReceipt(quality), /scope authority.*productRetrievalQualityVerified/u);
});

test("rejects changed inputs, parent drift, synthetic passes, and hidden gaps", () => {
  const original = validateReceiptFile().receipt;
  const changedInput = cloneReceipt(original);
  changedInput.inputs[0].sha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(changedInput), /historical evidence commit/u);

  const unavailableRevision = cloneReceipt(original);
  unavailableRevision.gitHead = "0".repeat(40);
  assert.throws(() => validateReceipt(unavailableRevision),
    /gitHead is not the sealed generation base/u);

  const parentDrift = cloneReceipt(original);
  parentDrift.parentReceipt.sha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(parentDrift), /parent receipt binding/u);

  const previousDrift = cloneReceipt(original);
  previousDrift.previousReceipt.sha256 = "0".repeat(64);
  assert.throws(() => validateReceipt(previousDrift), /previous receipt binding/u);

  const failedGate = cloneReceipt(original);
  failedGate.gates[0].status = "failed";
  assert.throws(() => validateReceipt(failedGate), /gate is not passing/u);

  const hiddenGap = cloneReceipt(original);
  hiddenGap.unexecutedGaps.pop();
  assert.throws(() => validateReceipt(hiddenGap), /promotion gaps are incomplete/u);

  const fakeExecution = cloneReceipt(original);
  fakeExecution.unexecutedGaps[1].status = "passed";
  assert.throws(() => validateReceipt(fakeExecution), /incorrectly promoted/u);
});
