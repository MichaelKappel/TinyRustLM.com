"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  attemptReference,
  discoverAttemptArchive,
  finalizeReceipt,
  independentEvidenceSummary,
  receiptIdentity,
  receiptSchema,
  remainingBoundaries,
  terminalNoObservationAuthority,
  terminalNoObservationGaps,
  terminalNoObservationSummary,
  terminalRequiredNextGate,
  validateReceipt,
  verificationInputPaths
} = require("../tools/vector-portable-affine-u8-verification.js");
const {
  expectedExperimentId
} = require("../tools/vector-portable-affine-u8-observation.js");
const {
  validateManifestFile
} = require("../tools/vector-portable-affine-u8-preregistration.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationSha256 =
  "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d";

test("verification schema is dedicated to the preregistered experiment", () => {
  const manifest = validateManifestFile();

  assert.equal(
    receiptSchema,
    "tinyrustlm.portable_affine_u8_flat_verification.v1"
  );
  assert.equal(
    expectedExperimentId,
    "portable-affine-u8-flat-20260726"
  );
  assert.equal(manifest.sha256, preregistrationSha256);
});

test("verification receipt identity is deterministic and field sensitive", () => {
  const body = {
    schema: receiptSchema,
    experimentId: expectedExperimentId,
    status: "test-only",
    boundedCount: 1
  };
  const receipt = finalizeReceipt(body);

  assert.deepEqual(receiptIdentity(receipt), {
    id: receipt.receiptId,
    hash: receipt.receiptContentHash
  });
  assert.deepEqual(
    finalizeReceipt(body),
    receipt
  );
  assert.notEqual(
    finalizeReceipt({ ...body, boundedCount: 2 }).receiptContentHash,
    receipt.receiptContentHash
  );
});

test("attempt references expose bounded failure identities without raw details", () => {
  const reference = attemptReference({
    path: "attempts/ab.json",
    bytes: 1234,
    fileSha256: "a".repeat(64),
    attempt: {
      attemptId: "portable-affine-u8-flat-attempt-" + "b".repeat(16),
      attemptContentHash: "b".repeat(64),
      attemptOrdinal: 2,
      status: "fail",
      sourceRevision: "c".repeat(40),
      observationId: null,
      observationContentHash: null,
      failure: {
        code: "PORTABLE_AFFINE_U8_SYNTHETIC_FAILURE",
        retryAllowed: true,
        classification: "instrumentation",
        messageSha256: "d".repeat(64),
        causeMessageSha256: "e".repeat(64),
        rawMessage: "must-not-escape"
      }
    }
  });

  assert.deepEqual(Object.keys(reference), [
    "path",
    "bytes",
    "fileSha256",
    "attemptId",
    "attemptContentHash",
    "attemptOrdinal",
    "status",
    "sourceRevision",
    "failureCode",
    "failureClassification",
    "retryAllowed",
    "failureMessageSha256",
    "failureCauseMessageSha256",
    "observationId",
    "observationContentHash"
  ]);
  assert.equal(reference.retryAllowed, true);
  assert.equal(reference.failureClassification, "instrumentation");
  assert.equal(
    reference.failureCode,
    "PORTABLE_AFFINE_U8_SYNTHETIC_FAILURE"
  );
  assert.equal(JSON.stringify(reference).includes("must-not-escape"), false);
});

test("verification inputs close over observation, tooling, and attempts once", () => {
  const attemptPath =
    "tinyrustlm/experiments/vector-quantization/" +
    "portable-affine-u8-flat-attempts/sha256/aa/" +
    "a".repeat(64) + ".json";
  const paths = verificationInputPaths([
    { path: attemptPath },
    { path: attemptPath }
  ]);

  assert.equal(paths.length, new Set(paths).size);
  assert.equal(paths.filter((entry) => entry === attemptPath).length, 1);
  for (const required of [
    "tinyrustlm/experiments/vector-quantization/" +
      "portable-affine-u8-flat-observation-v1.json",
    "tinyrustlm/tools/vector-portable-affine-u8-verification.js",
    "tinyrustlm/tests/vector-portable-affine-u8-verification.test.js"
  ]) {
    assert.equal(paths.includes(required), true);
  }

  const terminalPaths = verificationInputPaths([
    { path: attemptPath }
  ], false);
  assert.equal(terminalPaths.includes(attemptPath), true);
  assert.equal(
    terminalPaths.includes(
      "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-flat-observation-v1.json"
    ),
    false
  );
});

test("independent summary delegates to strict retained-output validation", () => {
  assert.throws(
    () => independentEvidenceSummary({ quality: {} }, 0),
    /quality output keys are invalid/u
  );
});

test("receipt validation rejects malformed shape before external evidence", () => {
  assert.throws(
    () => validateReceipt({}),
    /verification receipt fields are invalid/u
  );
});

test("terminal summary verifies the immutable no-observation attempt chain", () => {
  const archive = discoverAttemptArchive();
  const summary = terminalNoObservationSummary(archive);

  assert.equal(archive.length, 2);
  assert.equal(summary.status, "terminal-no-observation");
  assert.equal(summary.outcomeTerminal, true);
  assert.equal(summary.retryableAttemptCount, 1);
  assert.equal(summary.instrumentationFailureCount, 2);
  assert.equal(
    summary.terminalFailureCode,
    "PORTABLE_AFFINE_U8_QUALITY_OUTCOME_REJECTED"
  );
  assert.equal(summary.observationPresent, false);
  assert.equal(summary.qualityMetricsPresent, false);
  assert.equal(summary.sameExperimentRetryAllowed, false);
  assert.equal(summary.modelQualityClaimAllowed, false);
  assert.equal(summary.productPromotionAllowed, false);
});

test("terminal authority denies every experiment and product claim", () => {
  assert.equal(
    Object.values(terminalNoObservationAuthority).every(
      (value) => value === false
    ),
    true
  );
  assert.deepEqual(terminalNoObservationGaps[0], {
    gapId: "sealed-quality-observation",
    status: "terminal-failed",
    blockerCode: "PORTABLE_AFFINE_U8_QUALITY_OUTCOME_REJECTED"
  });
  assert.match(terminalRequiredNextGate, /may not be rerun, promoted/u);
});

test("verification preserves all explicitly unproven boundaries", () => {
  assert.deepEqual(remainingBoundaries, [
    { boundaryId: "real-browser-wasm-execution", status: "not-proven" },
    {
      boundaryId: "representative-semantic-memory-corpus",
      status: "not-proven"
    },
    { boundaryId: "browser-performance", status: "not-proven" },
    { boundaryId: "power-loss-durability", status: "not-tested" },
    { boundaryId: "filesystem-forensic-erasure", status: "not-tested" },
    { boundaryId: "product-integration", status: "not-authorized" }
  ]);
});

test("verifier cannot invoke sealed benchmark process modes", () => {
  const source = fs.readFileSync(
    path.join(
      repositoryRoot,
      "tinyrustlm/tools/vector-portable-affine-u8-verification.js"
    ),
    "utf8"
  );
  for (const forbidden of [
    "\"--quality\"",
    "\"--performance\"",
    "\"--corruption\"",
    "\"--crash\"",
    "\"--recover\"",
    "portable-affine-u8-comparison"
  ]) {
    assert.equal(source.includes(forbidden), false);
  }
});
