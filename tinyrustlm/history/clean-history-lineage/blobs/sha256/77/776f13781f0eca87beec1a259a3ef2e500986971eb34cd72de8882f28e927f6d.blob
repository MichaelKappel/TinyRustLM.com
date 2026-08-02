"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  finalizeReceipt,
  receiptIdentity,
  receiptSchema,
  staticInputPaths,
  validateReceipt
} = require(
  "../tools/vector-portable-affine-u8-quality-diagnostic-verification.js"
);
const {
  authority,
  requiredNextGate
} = require("../tools/vector-portable-affine-u8-quality-diagnostic.js");

function body() {
  return {
    schema: receiptSchema,
    diagnosticId: "portable-affine-u8-quality-diagnostic-20260726",
    status: "verified-terminal-diagnostic",
    verifiedAtUtc: "2026-07-26T12:30:00.000Z",
    verificationSourceRevision: "1".repeat(40),
    preregistration: {
      path:
        "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-quality-diagnostic-preregistration.v1.json",
      sha256:
        "3932e21b3ea171d5798e5abf034931069e66f932ef11abdaa68c8d9326ae5fe1",
      registrationCommit: "2".repeat(40)
    },
    terminalVerification: {
      path:
        "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-flat-verification-v1.json",
      sha256:
        "91aa60ccea38222004cd425a5f7a8e5332598978ef4b455a16550d5e931cbf9b",
      receiptId: "portable-affine-u8-flat-verification-b72cb93ab3e2aa85",
      status: "verified-terminal-no-observation"
    },
    attempt: {
      path:
        "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-quality-diagnostic-attempts/sha256/aa/" +
        `${"a".repeat(64)}.json`,
      bytes: 1000,
      fileSha256: "b".repeat(64),
      attemptId: "portable-affine-u8-quality-diagnostic-attempt-aaaaaaaaaaaaaaaa",
      attemptContentHash: "a".repeat(64),
      status: "diagnosed-process-rejection",
      sourceRevision: "3".repeat(40)
    },
    inputs: [...staticInputPaths,
      "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-quality-diagnostic-attempts/sha256/aa/" +
        `${"a".repeat(64)}.json`
    ].map((inputPath) => ({
      path: inputPath,
      bytes: 1,
      sha256: "c".repeat(64)
    })),
    independentSummary: {
      attemptCount: 1,
      diagnosticProcessInvocationCount: 1,
      diagnosticStatus: "diagnosed-process-rejection",
      firstFailingStage: "exit-and-signal",
      failureCode: "AFFINE_U8_QUALITY_DIAGNOSTIC_EXIT_OR_SIGNAL_REJECTED",
      benchmarkErrorCode: "candidate-byte-accounting-invalid",
      stdoutBytes: 0,
      stdoutSha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      stderrBytes: 34,
      stderrSha256: "d".repeat(64),
      processExitCode: 1,
      processSignal: null,
      ownedRootDeleted: true,
      rawOutputPresent: false,
      parsedQualityMetricsPresent: false,
      thresholdDecisionPresent: false,
      qualityClaimSupported: false,
      sameExperimentRetryAllowed: false,
      productPromotionAllowed: false,
      campaignCounterIncrementAllowed: false
    },
    authority,
    requiredNextGate
  };
}

test("verification identity is deterministic and field sensitive", () => {
  const first = finalizeReceipt(body());
  const second = finalizeReceipt(body());
  assert.deepEqual(first, second);
  assert.deepEqual(receiptIdentity(first), {
    id: first.receiptId,
    hash: first.receiptContentHash
  });
  const changed = body();
  changed.independentSummary.stderrBytes += 1;
  assert.notEqual(
    finalizeReceipt(changed).receiptContentHash,
    first.receiptContentHash
  );
});

test("verification validates one non-promotional terminal diagnostic", () => {
  const receipt = finalizeReceipt(body());
  validateReceipt(receipt);
  assert.equal(receipt.independentSummary.attemptCount, 1);
  assert.equal(receipt.independentSummary.diagnosticProcessInvocationCount, 1);
  assert.equal(receipt.independentSummary.qualityClaimSupported, false);
  assert.equal(Object.values(receipt.authority).every((value) => value === false), true);
});

test("verification rejects raw output, metrics, retries, and product authority", () => {
  const raw = structuredClone(finalizeReceipt(body()));
  raw.independentSummary.stdout = "raw";
  assert.throws(() => validateReceipt(raw), /independentSummary fields are invalid/u);

  const metrics = structuredClone(finalizeReceipt(body()));
  metrics.qualityMetrics = [];
  assert.throws(() => validateReceipt(metrics), /diagnostic verification fields are invalid/u);

  const retry = structuredClone(finalizeReceipt(body()));
  retry.independentSummary.sameExperimentRetryAllowed = true;
  assert.throws(() => validateReceipt(retry), /independent summary boundary is invalid/u);

  const product = structuredClone(finalizeReceipt(body()));
  product.authority.productIntegrationMayBeClaimed = true;
  assert.throws(() => validateReceipt(product), /verification authority is invalid/u);
});

test("verifier cannot execute the benchmark or evaluate quality thresholds", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../tools/vector-portable-affine-u8-quality-diagnostic-verification.js"
    ),
    "utf8"
  );
  assert.equal(source.includes('["--quality"]'), false);
  assert.equal(source.includes("evaluateQualityThresholds"), false);
  assert.equal(source.includes("evaluatePerformanceThresholds"), false);
  assert.equal(source.includes("runAndWriteDiagnostic"), false);
});
