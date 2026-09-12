"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { assertSafeDirectoryAncestry, assertSafeRegularFile, ensureSafeDirectory } =
  require("../tools/immutable-publication-files.js");

const {
  finalizeReleaseLedger,
  materializeReleasePublication,
  materializeReleaseState,
  parseReleaseLedger
} = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const sourceLedgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");
const sourceRevision = "a".repeat(40);
const publishedAt = "2026-08-31T23:15:30.000Z";

/** Confine synthetic fixture output and cleanup to this test's owned artifacts. */
function temporaryDirectory(context, prefix) {
  if (typeof prefix !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(prefix)) {
    throw new Error("Fixture prefix must be a bounded lowercase name");
  }
  const parent = ensureSafeDirectory(path.join(siteRoot, "artifacts", "tests"));
  const root = fs.mkdtempSync(path.join(parent, prefix));
  const owner = crypto.randomUUID();
  const marker = path.join(root, ".fixture-owner");
  fs.writeFileSync(marker, owner, { flag: "wx" });
  context.after(() => {
    if (path.dirname(root) !== parent) throw new Error("Fixture cleanup escapes artifacts");
    assertSafeDirectoryAncestry(root);
    if (fs.readFileSync(assertSafeRegularFile(marker).filePath, "utf8") !== owner) {
      throw new Error("Fixture ownership marker changed");
    }
    fs.rmSync(root, { recursive: true, force: true });
    if (fs.existsSync(root)) throw new Error("Fixture remains after cleanup");
  });
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

function materializeSourceReleaseAt(options) {
  const outputRoot = path.resolve(String(options?.outputRoot || ""));
  const ledgerResult = parseReleaseLedger(fs.readFileSync(sourceLedgerPath));
  return ledgerResult.pendingRelease
    ? materializeReleasePublication({
        ledgerPath: sourceLedgerPath,
        outputRoot,
        sourceRevision: String(options?.sourceRevision || ""),
        publishedAt: String(options?.publishedAt || "")
      })
    : materializeReleaseState({ ledgerPath: sourceLedgerPath, outputRoot });
}

function materializeSourceReleaseState(context, prefix = "tinyrustlm-source-release-") {
  const outputRoot = temporaryDirectory(context, prefix);
  const result = materializeSourceReleaseAt({ outputRoot, sourceRevision, publishedAt });
  return Object.freeze({ ledgerPath: sourceLedgerPath, outputRoot, result });
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
  materializeSourceReleaseAt,
  materializeSourceReleaseState,
  publishedAt,
  sourceLedgerPath,
  sourceRevision,
  temporaryDirectory,
  writeFinalizedLedger,
  writePendingLedger
});
