"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  scanPublicArtifacts,
  validateArchiveEntryName
} = require("../tools/public-evidence-secret-scan.js");

test("validates archive entry containment", () => {
  assert.equal(validateArchiveEntryName("runtimes/linux-x64/native/minimodel"),
    "runtimes/linux-x64/native/minimodel");
  assert.throws(() => validateArchiveEntryName("../escape.txt"), /parent traversal/);
  assert.throws(() => validateArchiveEntryName("C:/escape.txt"), /absolute path/);
  assert.throws(() => validateArchiveEntryName("/escape.txt"), /absolute path/);
});

test("records a path-free passing report for a bounded public artifact scope", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-secret-scan-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const artifactPath = path.join(root, "public.txt");
  fs.writeFileSync(artifactPath, "Public release metadata without credentials.\n");
  const result = await scanPublicArtifacts({
    artifacts: [{ label: "reports/public.txt", path: artifactPath }],
    campaignId: "secret-scan-test-20260715",
    completedAtUtc: "2026-07-15T08:01:00.000Z",
    evidenceRoot: path.join(root, "evidence"),
    reportOutputPath: path.join(root, "scan.json"),
    scopeComplete: true,
    scopeKind: "test-public-release",
    sourceRevision: "a".repeat(40),
    startedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(result.receipt.status, "pass");
  assert.equal(result.receipt.publicSafeParameters.secretFindingCount, 0);
  assert.equal(result.report.scannedArtifactCount, 1);
  assert.equal(result.report.scopeComplete, true);
  assert.equal(result.receipt.receiptType, "tinyrustlm.secret-scan-v2");
  assert.equal(result.receipt.publicSafeParameters.scopeKind, "test-public-release");
  const serialized = JSON.stringify(result.report);
  assert.equal(serialized.includes(root), false);
  assert.equal(serialized.includes(artifactPath), false);
});

test("accepts a retained evidence scope larger than the original 256 artifact limit", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-secret-scan-large-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const artifactPath = path.join(root, "public.txt");
  fs.writeFileSync(artifactPath, "Public release metadata without credentials.\n");
  const artifacts = Array.from({ length: 257 }, (_, index) => ({
    label: `reports/public-${index}.txt`,
    path: artifactPath
  }));
  const result = await scanPublicArtifacts({
    artifacts,
    campaignId: "secret-scan-large-test-20260715",
    completedAtUtc: "2026-07-15T08:01:00.000Z",
    evidenceRoot: path.join(root, "evidence"),
    reportOutputPath: path.join(root, "scan.json"),
    scopeComplete: true,
    scopeKind: "test-public-release",
    sourceRevision: "a".repeat(40),
    startedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(result.receipt.status, "pass");
  assert.equal(result.report.scannedArtifactCount, 257);
});

test("fails closed without persisting matched secret material", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-secret-finding-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const secret = "Bearer live_test_credential_1234567890";
  const artifactPath = path.join(root, "bad.txt");
  fs.writeFileSync(artifactPath, `${secret}\n`);
  const result = await scanPublicArtifacts({
    artifacts: [{ label: "release/bad.txt", path: artifactPath }],
    campaignId: "secret-scan-test-20260715",
    completedAtUtc: "2026-07-15T08:01:00.000Z",
    evidenceRoot: path.join(root, "evidence"),
    knownSecrets: ["live_test_credential_1234567890"],
    reportOutputPath: path.join(root, "scan.json"),
    scopeComplete: true,
    scopeKind: "test-public-release",
    sourceRevision: "a".repeat(40),
    startedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(result.receipt.status, "fail");
  assert.equal(result.receipt.blockerCode, "secret_scan_findings");
  assert.ok(result.report.secretFindingCount > 0);
  const serialized = `${JSON.stringify(result.report)}${JSON.stringify(result.receipt)}`;
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("live_test_credential_1234567890"), false);
});
