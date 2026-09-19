"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { scanWebRelease } = require("../tools/web-release-secret-scan.js");
const { materializeSourceReleaseAt, temporaryDirectory } = require("./site-release-test-fixture.js");

const siteRoot = path.resolve(__dirname, "..");
const deploymentManifestPath = path.join(
  siteRoot,
  "deploy",
  "web-deployment-manifest.v2.json"
);
function generatedRelease(root) {
  const generatedRoot = path.join(root, "generated-release");
  materializeSourceReleaseAt({
    outputRoot: generatedRoot,
    sourceRevision: "0".repeat(40),
    publishedAt: "2026-08-02T22:30:00.000Z"
  });
  return generatedRoot;
}

test("complete web release input passes the bounded secret scan", async (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-web-secret-scan-");
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
  assert.equal(result.scannedArtifactCount, 31);
  assert.equal(result.secretFindingCount, 0);
  assert.match(result.reportSha256, /^[0-9a-f]{64}$/);
  assert.match(result.scopeManifestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.receiptId, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(
    fs.readdirSync(root).sort(),
    [".fixture-owner", "evidence", "generated-release", "scan-report.json"]
  );
});

test("web release scan CLI emits exact evidence and rejects invalid input without leaking paths", (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-web-secret-cli-");
  const generatedRoot = generatedRelease(root);
  const invoke = (revision, leaf) => spawnSync(process.execPath, [
    path.join(siteRoot, "tools/web-release-secret-scan.js"), siteRoot, deploymentManifestPath,
    path.join(root, `${leaf}.json`), path.join(root, `${leaf}-evidence`), revision, generatedRoot
  ], { cwd: siteRoot, windowsHide: true, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  const passed = invoke("0".repeat(40), "scan");
  assert.equal(passed.error, undefined);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.stderr, "");
  const summary = JSON.parse(passed.stdout);
  assert.equal(summary.status, "pass");
  assert.equal(summary.scannedArtifactCount, 31);
  assert.equal(summary.secretFindingCount, 0);
  assert.equal(fs.existsSync(path.join(root, "scan.json")), true);
  assert.equal(fs.existsSync(path.join(root, "scan-evidence")), true);
  const before = fs.readdirSync(root).sort();
  const rejected = invoke("invalid", "rejected");
  assert.equal(rejected.error, undefined);
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, "");
  assert.doesNotMatch(rejected.stderr, /[A-Z]:\\/u);
  assert.deepEqual(fs.readdirSync(root).sort(), before);
});

test("web release scan refuses report replacement and output outside canonical artifacts", async (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-web-secret-reject-");
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
    /canonical project artifacts/
  );
});

test("web release scan rejects scattered output, artifact roots and junctions before writing", async (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-web-secret-boundary-");
  const generatedRoot = generatedRelease(root);
  const safe = { siteRoot, manifestPath: deploymentManifestPath, generatedRoot,
    sourceRevision: "0".repeat(40), reportOutputPath: path.join(root, "report.json"),
    evidenceRoot: path.join(root, "evidence") };
  const target = path.join(root, "target");
  const alias = path.join(root, "alias");
  fs.mkdirSync(target);
  fs.symlinkSync(target, alias, "junction");
  try {
    for (const changes of [
      { reportOutputPath: path.resolve(siteRoot, "../outside-artifacts/report.json") },
      { evidenceRoot: path.resolve(siteRoot, "../outside-artifacts/evidence") },
      { reportOutputPath: path.join(siteRoot, "artifacts") },
      { evidenceRoot: path.join(siteRoot, "artifacts") },
      { reportOutputPath: path.join(alias, "report.json") },
      { evidenceRoot: path.join(alias, "evidence") }
    ]) {
      await assert.rejects(() => scanWebRelease({ ...safe, ...changes }),
        /canonical project artifacts|ordinary|already exists|must be new/);
      assert.equal(fs.existsSync(safe.reportOutputPath), false);
      assert.equal(fs.existsSync(safe.evidenceRoot), false);
      assert.deepEqual(fs.readdirSync(target), []);
    }
  } finally {
    fs.unlinkSync(alias);
  }
});
