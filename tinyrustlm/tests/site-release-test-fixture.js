"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  finalizeReleaseLedger,
  materializeReleasePublication,
  parseReleaseLedger
} = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const sourceLedgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");
const sourceRevision = "a".repeat(40);
const publishedAt = "2026-08-08T23:15:30.000Z";

function temporaryDirectory(context, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writePendingLedger(context) {
  const root = temporaryDirectory(context, "tinyrustlm-pending-release-");
  const outputPath = path.join(root, "site-release-ledger.pending.json");
  const ledger = JSON.parse(fs.readFileSync(sourceLedgerPath, "utf8"));
  if (ledger.publications.length === ledger.releases.length) {
    const publication = ledger.publications.pop();
    const release = ledger.releases.at(-1);
    if (!release || publication.releaseId !== release.releaseId) {
      throw new Error("The latest source publication does not bind the latest release");
    }
  } else if (ledger.publications.length !== ledger.releases.length - 1) {
    throw new Error("The source ledger is neither pending nor finalized");
  }
  const parsed = parseReleaseLedger(`${JSON.stringify(ledger, null, 2)}\n`);
  if (!parsed.pendingRelease || parsed.pendingRelease.releaseId !== ledger.releases.at(-1).releaseId) {
    throw new Error("The test ledger does not contain exactly one latest pending release");
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  return outputPath;
}

function materializePendingRelease(context, prefix = "tinyrustlm-generated-release-") {
  const ledgerPath = writePendingLedger(context);
  const outputRoot = temporaryDirectory(context, prefix);
  const result = materializeReleasePublication({
    ledgerPath,
    outputRoot,
    sourceRevision,
    publishedAt
  });
  return Object.freeze({ ledgerPath, outputRoot, result });
}

function writeFinalizedLedger(context) {
  const materialized = materializePendingRelease(
    context,
    "tinyrustlm-finalized-release-public-"
  );
  const root = temporaryDirectory(context, "tinyrustlm-finalized-release-ledger-");
  const outputPath = path.join(root, "site-release-ledger.finalized.json");
  finalizeReleaseLedger({
    ledgerPath: materialized.ledgerPath,
    publicOutputRoot: materialized.outputRoot,
    outputPath
  });
  return outputPath;
}

module.exports = Object.freeze({
  materializePendingRelease,
  publishedAt,
  sourceLedgerPath,
  sourceRevision,
  temporaryDirectory,
  writeFinalizedLedger,
  writePendingLedger
});
