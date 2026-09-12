#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory,
  requireCanonicalSiteRoot
} = require("./canonical-operation-scratch.js");

const {
  materializeReleaseState,
  parseReleaseLedger
} = require("./site-release-contract.js");
const { startStaticServer } = require("./static-server.js");
const {
  runWebReleaseBrowserSmoke
} = require("./web-release-browser-smoke.js");

/** Reject invalid CLI and API inputs before creating operation output. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Check canonical public files in place and always remove generated metadata. */
async function runLocalWebReleaseSmoke(options) {
  invariant(options && typeof options === "object",
    "Local web release smoke options are required");
  const siteRoot = requireCanonicalSiteRoot(options.siteRoot);
  const owned = createOwnedTemporaryDirectory({ siteRoot });
  const generatedRoot = path.join(owned.rootPath, "generated");
  const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");
  let server;
  try {
    const ledgerResult = parseReleaseLedger(fs.readFileSync(ledgerPath));
    materializeReleaseState({
      ledgerPath,
      outputRoot: generatedRoot,
      ...(ledgerResult.pendingRelease
        ? {
            sourceRevision: "0".repeat(40),
            publishedAt: new Date().toISOString()
          }
        : {})
    });
    server = await startStaticServer({ siteRoot, generatedRoot, port: 0 });
    const result = await runWebReleaseBrowserSmoke({
      baseUrl: server.origin,
      outputDirectory: options.outputDirectory,
      sourceRevision: "uncommitted",
      siteRoot,
      generatedRoot
    });
    return Object.freeze({
      status: result.report.status,
      observationCount: result.report.observationCount,
      reportSha256: result.reportSha256
    });
  } finally {
    try {
      await server?.close();
    } finally {
      removeOwnedTemporaryDirectory(owned);
    }
  }
}

/** Retain explicitly requested evidence; disposable runs use the zero-argument runner. */
async function main() {
  const [outputDirectory, siteRoot, ...extra] = process.argv.slice(2);
  invariant(outputDirectory && extra.length === 0,
    "Usage: web-release-local-smoke.js <new-output-directory> [site-root]");
  const result = await runLocalWebReleaseSmoke({ outputDirectory, siteRoot });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write("TinyRustLM local web release smoke failed\n");
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({ runLocalWebReleaseSmoke });
