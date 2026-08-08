"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { scanWebRelease } = require("../tools/web-release-secret-scan.js");
const { materializeReleasePublication } = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const deploymentManifestPath = path.join(
  siteRoot,
  "deploy",
  "web-deployment-manifest.v2.json"
);
const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");

function generatedRelease(root) {
  const generatedRoot = path.join(root, "generated-release");
  materializeReleasePublication({
    ledgerPath,
    outputRoot: generatedRoot,
    sourceRevision: "0".repeat(40),
    publishedAt: "2026-08-02T22:30:00.000Z"
  });
  return generatedRoot;
}

test("complete web release input passes the bounded secret scan", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-web-secret-scan-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const generatedRoot = generatedRelease(root);
  const result = await scanWebRelease({
    siteRoot,
    manifestPath: deploymentManifestPath,
    reportOutputPath: path.join(root, "scan-report.json"),
    evidenceRoot: path.join(root, "evidence"),
    sourceRevision: "0".repeat(40),
    generatedRoot
  });
  assert.equal(result.status, "pass");
  assert.equal(result.scannedArtifactCount, 24);
  assert.equal(result.secretFindingCount, 0);
  assert.match(result.reportSha256, /^[0-9a-f]{64}$/);
  assert.match(result.scopeManifestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.receiptId, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(
    fs.readdirSync(root).sort(),
    ["evidence", "generated-release", "scan-report.json"]
  );
});

test("web release scan refuses report replacement and source-contained evidence", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-web-secret-reject-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reportOutputPath = path.join(root, "scan-report.json");
  const generatedRoot = generatedRelease(root);
  fs.writeFileSync(reportOutputPath, "{}\n");
  await assert.rejects(
    () => scanWebRelease({
      siteRoot,
      manifestPath: deploymentManifestPath,
      reportOutputPath,
      evidenceRoot: path.join(root, "evidence"),
      sourceRevision: "0".repeat(40),
      generatedRoot
    }),
    (error) =>
      error?.code === "EEXIST" &&
      !String(error.message).includes(root)
  );
  await assert.rejects(
    () => scanWebRelease({
      siteRoot,
      manifestPath: deploymentManifestPath,
      reportOutputPath: path.join(siteRoot, "unsafe-scan-report.json"),
      evidenceRoot: path.join(siteRoot, "unsafe-scan-evidence"),
      sourceRevision: "0".repeat(40),
      generatedRoot
    }),
    /outside the source worktree/
  );
});
