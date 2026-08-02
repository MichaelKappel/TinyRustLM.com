"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { scanWebRelease } = require("../tools/web-release-secret-scan.js");

const siteRoot = path.resolve(__dirname, "..");
const deploymentManifestPath = path.join(
  siteRoot,
  "deploy",
  "web-deployment-manifest.v1.json"
);

test("complete web release input passes the bounded secret scan", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-web-secret-scan-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = await scanWebRelease({
    siteRoot,
    manifestPath: deploymentManifestPath,
    reportOutputPath: path.join(root, "scan-report.json"),
    evidenceRoot: path.join(root, "evidence"),
    sourceRevision: "0".repeat(40)
  });
  assert.equal(result.status, "pass");
  assert.equal(result.scannedArtifactCount, 18);
  assert.equal(result.secretFindingCount, 0);
  assert.match(result.reportSha256, /^[0-9a-f]{64}$/);
  assert.match(result.scopeManifestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.receiptId, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(
    fs.readdirSync(root).sort(),
    ["evidence", "scan-report.json"]
  );
});

test("web release scan refuses report replacement and source-contained evidence", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-web-secret-reject-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reportOutputPath = path.join(root, "scan-report.json");
  fs.writeFileSync(reportOutputPath, "{}\n");
  await assert.rejects(
    () => scanWebRelease({
      siteRoot,
      manifestPath: deploymentManifestPath,
      reportOutputPath,
      evidenceRoot: path.join(root, "evidence"),
      sourceRevision: "0".repeat(40)
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
      sourceRevision: "0".repeat(40)
    }),
    /outside the source worktree/
  );
});
