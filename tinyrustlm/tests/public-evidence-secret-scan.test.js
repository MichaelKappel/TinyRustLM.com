"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { scanPublicArtifacts } = require("../tools/public-evidence-secret-scan.js");
const { ensureArchiveScanTestExecutable } = require(
  "./helpers/archive-scan-test-executable.js"
);
const { createStoredZip } = require("./helpers/archive-test-fixtures.js");

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
  assert.equal(result.receipt.receiptType, "tinyrustlm.secret-scan-v3");
  assert.equal(result.receipt.publicSafeParameters.scopeKind, "test-public-release");
  assert.deepEqual(result.receipt.toolNames,
    ["tinyrustlm-public-artifact-secret-scan"]);
  assert.equal(result.report.archiveArtifactCount, 0);
  assert.equal(result.report.archiveMemberCount, 0);
  assert.equal(result.report.archiveAdmissionProfileId, null);
  assert.equal(result.report.archiveScannerExecutableSha256, null);
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

test("requires an explicit canonical archive scanner for every archive artifact", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-secret-archive-required-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const archivePath = path.join(root, "release.zip");
  const reportPath = path.join(root, "scan.json");
  fs.writeFileSync(archivePath, createStoredZip([
    { content: Buffer.from("public"), name: "docs/release.txt" }
  ]));
  await assert.rejects(scanPublicArtifacts({
    artifacts: [{ label: "release/release.zip", path: archivePath }],
    campaignId: "secret-scan-archive-required-20260813",
    completedAtUtc: "2026-08-13T08:01:00.000Z",
    evidenceRoot: path.join(root, "evidence"),
    reportOutputPath: reportPath,
    scopeComplete: true,
    scopeKind: "test-public-release",
    sourceRevision: "a".repeat(40),
    startedAtUtc: "2026-08-13T08:00:00.000Z"
  }), (error) => error.code === "archive_scan_executable_invalid");
  assert.equal(fs.existsSync(reportPath), false);
});

test("scans decoded archive members and binds canonical admission evidence", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-secret-archive-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const secret = "archive_secret_value_1234567890";
  const archivePath = path.join(root, "release.nupkg");
  fs.writeFileSync(archivePath, createStoredZip([
    { content: Buffer.from("public metadata"), name: "docs/release.txt" },
    { content: Buffer.from(`workspace_key=${secret}`), name: "content/settings.txt" }
  ]));
  const result = await scanPublicArtifacts({
    archiveScannerExecutablePath: ensureArchiveScanTestExecutable(),
    artifacts: [{ label: "release/release.nupkg", path: archivePath }],
    campaignId: "secret-scan-archive-20260813",
    completedAtUtc: "2026-08-13T08:01:00.000Z",
    evidenceRoot: path.join(root, "evidence"),
    knownSecrets: [secret],
    reportOutputPath: path.join(root, "scan.json"),
    scopeComplete: true,
    scopeKind: "test-public-release",
    sourceRevision: "a".repeat(40),
    startedAtUtc: "2026-08-13T08:00:00.000Z"
  });
  assert.equal(result.report.status, "fail");
  assert.equal(result.report.archiveArtifactCount, 1);
  assert.equal(result.report.archiveMemberCount, 2);
  assert.equal(result.report.artifacts[0].archiveFormat, "zip");
  assert.match(result.report.artifacts[0].archiveContentManifestSha256,
    /^[a-f0-9]{64}$/u);
  assert.match(result.report.archiveScannerExecutableSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.receipt.toolNames, [
    "tinyrustlm-public-artifact-secret-scan",
    "tinyrustlm-archive-scan"
  ]);
  assert.equal(result.receipt.toolBinaryHashes[1],
    result.report.archiveScannerExecutableSha256);
  assert.equal(result.receipt.hardwareEvidence.archiveAdmissionPerformed, true);
  const serialized = `${JSON.stringify(result.report)}${JSON.stringify(result.receipt)}`;
  assert.equal(serialized.includes(root), false);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("libarchive-tar"), false);
});

test("rejects hostile archive paths before creating report evidence", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-secret-hostile-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const archivePath = path.join(root, "hostile.zip");
  const reportPath = path.join(root, "scan.json");
  fs.writeFileSync(archivePath, createStoredZip([
    { content: Buffer.from("accepted"), name: "docs/accepted.txt" },
    { content: Buffer.from("blocked"), name: "docs\\blocked.txt" }
  ]));
  await assert.rejects(scanPublicArtifacts({
    archiveScannerExecutablePath: ensureArchiveScanTestExecutable(),
    artifacts: [{ label: "release/hostile.zip", path: archivePath }],
    campaignId: "secret-scan-hostile-20260813",
    completedAtUtc: "2026-08-13T08:01:00.000Z",
    evidenceRoot: path.join(root, "evidence"),
    reportOutputPath: reportPath,
    scopeComplete: true,
    scopeKind: "test-public-release",
    sourceRevision: "a".repeat(40),
    startedAtUtc: "2026-08-13T08:00:00.000Z"
  }), (error) => error.code === "archive_scan_helper_failed" &&
    error.causeCode === "archive_member_path_nonportable");
  assert.equal(fs.existsSync(reportPath), false);
});
