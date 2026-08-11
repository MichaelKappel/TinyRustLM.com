"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "..", "..");
const joinDash = (...parts) => parts.join("-");
const joinDot = (...parts) => parts.join(".");

const removedProductionNames = Object.freeze([
  joinDash("campaign", "evidence", "dashboard.js"),
  joinDash("campaign", "final", "attestation.js"),
  joinDash("campaign", "release", "authorization", "evidence.js"),
  joinDash("campaign", "public", "readback", "evidence.js"),
  joinDash("campaign", "public", "artifact", "scope.js"),
  joinDash("campaign", "release", "evidence.js"),
  joinDash("campaign", "public", "evidence.js")
]);

const removedDedicatedTestNames = Object.freeze(
  removedProductionNames.slice(0, 6).map((name) =>
    name.replace(/\.js$/u, ".test.js"))
);

const removedAttestationDocument = joinDash(
  "dogfood", "campaign", "final", "attestation.md");
const removedRiskRegister = joinDash(
  "campaign", "remaining", "risks.v1.json");
const mutableStatusAlias = joinDash("campaign", "status.json");
const mutableAttestationAlias = joinDash("final", "attestation.json");
const mutableDashboardSnapshots = joinDash("dashboard", "snapshots");
const mutableAttestationSnapshots = joinDash(
  "final", "attestation", "snapshots");

const oldSchemaAndReceiptTokens = Object.freeze([
  joinDot("tinyrustlm", "dogfood_campaign_dashboard", "v9"),
  joinDot("tinyrustlm", "campaign_final_attestation", "v1"),
  joinDot("tinyrustlm", "campaign_remaining_risks", "v1"),
  joinDot("tinyrustlm", "release_authority_registry", "v1"),
  joinDot("tinyrustlm", "release_authorization_envelope", "v1"),
  joinDot("tinyrustlm", "release_attestation_verification", "v1"),
  joinDash("tinyrustlm.final", "release", "attestation", "v1"),
  joinDash("tinyrustlm.release", "attestation", "verification", "v1"),
  joinDash("tinyrustlm.public", "release", "readback", "v2")
]);

const forbiddenMaintainedTokens = Object.freeze([
  ...removedProductionNames,
  ...removedDedicatedTestNames,
  removedAttestationDocument,
  removedRiskRegister,
  mutableStatusAlias,
  mutableAttestationAlias,
  mutableDashboardSnapshots,
  mutableAttestationSnapshots,
  ...oldSchemaAndReceiptTokens
]);

const skippedArchitectureDocument = joinDash(
  "2026", "08", "10", "authoritative", "enterprise", "vnext",
  "continuation", "goal.md");
const maintainedExtensions = new Set([
  ".cjs", ".js", ".json", ".md", ".mjs", ".ps1", ".toml", ".uai",
  ".yaml", ".yml"
]);

function absolute(...parts) {
  return path.join(workspaceRoot, ...parts);
}

function walkMaintainedFiles(entryPath, files = []) {
  if (!fs.existsSync(entryPath)) return files;
  const stat = fs.lstatSync(entryPath);
  assert.equal(stat.isSymbolicLink(), false,
    `maintained cutover scan rejects symbolic links: ${entryPath}`);
  if (stat.isFile()) {
    if (maintainedExtensions.has(path.extname(entryPath)) ||
        path.basename(entryPath) === ".gitattributes") {
      files.push(entryPath);
    }
    return files;
  }
  assert.equal(stat.isDirectory(), true,
    `maintained cutover scan rejects unsupported entries: ${entryPath}`);
  for (const name of fs.readdirSync(entryPath).sort()) {
    if (name === "node_modules" || name === "target") continue;
    const child = path.join(entryPath, name);
    if (child === absolute("docs", "architecture", skippedArchitectureDocument)) {
      continue;
    }
    walkMaintainedFiles(child, files);
  }
  return files;
}

test("superseded release files and mutable aliases are absent", () => {
  const removedPaths = [
    ...removedProductionNames.map((name) =>
      absolute("tinyrustlm", "tools", name)),
    ...removedDedicatedTestNames.map((name) =>
      absolute("tinyrustlm", "tests", name)),
    absolute("docs", "architecture", removedAttestationDocument),
    absolute("tinyrustlm", removedRiskRegister),
    absolute("artifacts", "reports", "dogfood-campaign-evidence-2026-07-15",
      mutableStatusAlias),
    absolute("artifacts", "reports", "dogfood-campaign-evidence-2026-07-15",
      mutableAttestationAlias),
    absolute("artifacts", "reports", "dogfood-campaign-evidence-2026-07-15",
      mutableDashboardSnapshots),
    absolute("artifacts", "reports", "dogfood-campaign-evidence-2026-07-15",
      mutableAttestationSnapshots)
  ];
  for (const removedPath of removedPaths) {
    assert.equal(fs.existsSync(removedPath), false,
      `superseded release path still exists: ${removedPath}`);
  }
});

test("maintained code documentation commands and configuration reject old paths", () => {
  const maintainedRoots = [
    absolute(".gitattributes"),
    absolute(".github"),
    absolute(".uai", "file-handoff.uai"),
    absolute(".uai", "taboo.uai"),
    absolute(".uai", "totem.uai"),
    absolute("contracts", "vnext"),
    absolute("deploy"),
    absolute("docs", "architecture"),
    absolute("tinyrustlm", "app"),
    absolute("tinyrustlm", "package-lock.json"),
    absolute("tinyrustlm", "package.json"),
    absolute("tinyrustlm", "tests"),
    absolute("tinyrustlm", "tools")
  ];
  const maintainedFiles = maintainedRoots.flatMap((entry) =>
    walkMaintainedFiles(entry));
  assert.ok(maintainedFiles.length > 100,
    "maintained cutover scan unexpectedly covered too few files");

  const findings = [];
  for (const filePath of maintainedFiles) {
    const value = fs.readFileSync(filePath, "utf8");
    for (const token of forbiddenMaintainedTokens) {
      if (value.includes(token)) {
        findings.push(`${path.relative(workspaceRoot, filePath)}: ${token}`);
      }
    }
  }
  assert.deepEqual(findings, []);
});

test("the maintained operator route names only the sole vNext publication graph", () => {
  const controlPlane = fs.readFileSync(absolute(
    "docs", "architecture", "dogfood-campaign-control-plane.md"), "utf8");
  const requiredRoutes = [
    "tinyrustlm/tools/vnext-campaign-runner.js",
    "tinyrustlm/tools/vnext-campaign-release-surface.js",
    "tinyrustlm/tools/vnext-site-publication.js",
    "tinyrustlm/tools/vnext-public-https-readback.js"
  ];
  for (const route of requiredRoutes) assert.ok(controlPlane.includes(route));

  const packageDocument = JSON.parse(fs.readFileSync(
    absolute("tinyrustlm", "package.json"), "utf8"));
  assert.equal(packageDocument.scripts["test:vnext-release-cutover"],
    "node --test tests/vnext-release-cutover.test.js");

  const releaseSurface = require("../tools/vnext-campaign-release-surface.js");
  assert.deepEqual(Object.keys(releaseSurface).sort(), [
    "campaignReleaseSurfaceProfile",
    "campaignReleaseSurfaceProfileSha256",
    "createVnextCampaignReleaseSurface"
  ]);
});

test("immutable pre-vNext receipts remain inert historical evidence", () => {
  const receiptRoot = absolute(
    "artifacts", "reports", "dogfood-campaign-evidence-2026-07-15",
    "receipts", "sha256");
  const receiptFiles = walkMaintainedFiles(receiptRoot, []);
  assert.equal(receiptFiles.length, 95,
    "the preserved historical receipt set changed during cutover");
  assert.equal(receiptFiles.reduce((sum, filePath) =>
    sum + fs.statSync(filePath).size, 0), 342169,
  "the preserved historical receipt bytes changed during cutover");

  const historicalBlob = absolute(
    "tinyrustlm", "history", "clean-history-lineage", "blobs", "sha256",
    "4f", "4fd514b54e7564c6b23e732028198304aeb3c1880898d64fa81c2004a587b7ba.blob");
  assert.equal(fs.statSync(historicalBlob).isFile(), true);
});
