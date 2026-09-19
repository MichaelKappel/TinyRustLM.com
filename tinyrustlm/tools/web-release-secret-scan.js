#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  atomicCreateExclusive,
  createOwnedDirectory,
  ensureSafeDirectory
} = require("./immutable-publication-files.js");
const { scanPublicArtifacts } = require("./public-evidence-secret-scan.js");
const { validateWebDeploymentManifest } = require("./web-deployment-manifest.js");
const {
  createOwnedTemporaryDirectory,
  removeOwnedTemporaryDirectory,
  requireCanonicalArtifactPath
} = require("./canonical-operation-scratch.js");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function alreadyExistsError() {
  const error = new Error("Immutable web release report already exists");
  error.code = "EEXIST";
  return error;
}

function blockedMaterialError() {
  const error = new Error("Web release secret scan found blocked material");
  error.code = "WEB_RELEASE_SECRET_FINDING";
  return error;
}

async function scanWebRelease(options) {
  invariant(options && typeof options === "object", "Web release scan options are required");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(/^[0-9a-f]{40}$/.test(sourceRevision), "Web release source revision is invalid");
  const reportOutput = String(options.reportOutputPath || "");
  const evidenceOutput = String(options.evidenceRoot || "");
  invariant(path.isAbsolute(reportOutput), "Web release report output must be absolute");
  invariant(path.isAbsolute(evidenceOutput), "Web release evidence root must be absolute");
  const reportOutputPath = path.resolve(reportOutput);
  const evidenceRoot = path.resolve(evidenceOutput);
  if (fs.existsSync(reportOutputPath)) throw alreadyExistsError();
  invariant(!fs.existsSync(evidenceRoot), "Web release evidence root must be new");
  requireCanonicalArtifactPath(reportOutputPath);
  requireCanonicalArtifactPath(evidenceRoot);
  const validation = validateWebDeploymentManifest({
    siteRoot: options.siteRoot,
    manifestPath: options.manifestPath,
    generatedRoot: options.generatedRoot
  });
  const reportDirectory = ensureSafeDirectory(path.dirname(reportOutputPath));
  createOwnedDirectory(evidenceRoot);
  const staging = createOwnedTemporaryDirectory({ temporaryParent: reportDirectory });
  const stagingReportPath = path.join(staging.rootPath, "scan-report.json");
  const artifacts = [
    Object.freeze({
      label: "control/web-deployment-manifest.v2.json",
      path: validation.manifestPath
    }),
    ...validation.files.map((file) => Object.freeze({
      label: `web/${file.remote}`,
      path: file.filePath
    }))
  ];
  try {
    const result = await scanPublicArtifacts({
      artifacts,
      campaignId: `tinyrustlm-web-release-${sourceRevision}`,
      evidenceRoot,
      knownSecrets: [],
      reportOutputPath: stagingReportPath,
      scopeComplete: true,
      scopeKind: "tinyrustlm-web-release",
      sourceRevision
    });
    const reportBytes = fs.readFileSync(result.reportPath);
    atomicCreateExclusive(reportOutputPath, reportBytes);
    const reportSha256 = sha256(fs.readFileSync(reportOutputPath));
    const summary = Object.freeze({
      status: result.report.status,
      reportSha256,
      scopeManifestSha256: result.report.scopeManifestSha256,
      scannedArtifactCount: result.report.scannedArtifactCount,
      scannedContentByteCount: result.report.scannedContentByteCount,
      secretFindingCount: result.report.secretFindingCount,
      receiptId: result.receipt.receiptId
    });
    if (result.report.status !== "pass") throw blockedMaterialError();
    return summary;
  } catch (error) {
    if (
      error?.code === "EEXIST" ||
      error?.code === "WEB_RELEASE_SECRET_FINDING"
    ) {
      throw error;
    }
    const safeError = new Error("Web release secret scan execution failed");
    safeError.code = "WEB_RELEASE_SECRET_SCAN_FAILED";
    throw safeError;
  } finally {
    try {
      removeOwnedTemporaryDirectory(staging);
    } catch {
      const cleanupError = new Error("Web release secret scan staging cleanup failed");
      cleanupError.code = "WEB_RELEASE_SECRET_SCAN_CLEANUP_FAILED";
      throw cleanupError;
    }
  }
}

async function main() {
  const [
    siteRoot,
    manifestPath,
    reportOutputPath,
    evidenceRoot,
    sourceRevision,
    generatedRoot,
    ...extra
  ] = process.argv.slice(2);
  invariant(
    siteRoot && manifestPath && reportOutputPath && evidenceRoot && sourceRevision &&
      generatedRoot && !extra.length,
    "Usage: web-release-secret-scan.js <site-root> <manifest> <report> <evidence-root> " +
      "<source-revision> <generated-release-root>"
  );
  const result = await scanWebRelease({
    siteRoot,
    manifestPath,
    reportOutputPath,
    evidenceRoot,
    sourceRevision,
    generatedRoot
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write("TinyRustLM web release secret scan failed\n");
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({ scanWebRelease });
