"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const contractCliPath = path.resolve(__dirname, "..", "tools", "site-release-contract.js");

const {
  assertHistoryExtension,
  finalizeReleaseLedger,
  materializeReleasePublication,
  materializeReleaseState,
  parseReleaseLedger,
  validatePublicReleaseFiles
} = require("../tools/site-release-contract.js");
const {
  publishedAt,
  sourceLedgerPath: ledgerPath,
  sourceRevision,
  temporaryDirectory,
  writeFinalizedLedger,
  writePendingLedger
} = require("./site-release-test-fixture.js");

function clone(value) {
  return structuredClone(value);
}

function withTemporaryDirectory(context) {
  return temporaryDirectory(context, "tinyrustlm-site-release-");
}

function pendingLedgerPath(context) {
  return writePendingLedger(context);
}

function finalizedLedgerPath(context) {
  return writeFinalizedLedger(context);
}

test("source release ledger preserves history and one latest pending release", () => {
  const result = parseReleaseLedger(fs.readFileSync(ledgerPath));
  assert.equal(result.ledger.site.siteId, "tinyrustlm.com");
  assert.equal(result.ledger.site.canonicalOrigin, "https://tinyrustlm.com");
  assert.equal(result.ledger.site.updatesPath, "/updates/");
  assert.equal(result.ledger.releases.length, 8);
  assert.equal(result.ledger.publications.length, 7);
  assert.equal(result.ledger.publications[0].releaseId, "tinyrustlm.com@0.1.0");
  assert.equal(result.ledger.publications[1].releaseId, "tinyrustlm.com@0.1.1");
  assert.equal(
    result.ledger.publications[1].publicationId,
    "aa5e5cc4a32e367c617dd4ee4d425c50c2ccf017829e7c0413784e5a09ec9d07"
  );
  assert.equal(
    result.ledger.publications[2].publicationId,
    "0e9da90d20943afb4dab388860792cff8a9e20fb2825e9a7e6a614d2299647be"
  );
  assert.equal(
    result.ledger.publications[3].publicationId,
    "75d5f72656635eed58644b705acdf7c8fb18512fd2225f402563cf1756a2ea10"
  );
  assert.equal(result.pendingRelease.releaseId, "tinyrustlm.com@0.4.1");
  assert.equal(result.pendingRelease.version, "0.4.1");
  assert.equal(result.pendingRelease.releaseDate, "2026-08-30");
  assert.deepEqual(result.ledger.publications[4], {
    publicationId: "aea1e08b74f6b7835473ffb482baeddd42c97346d0a08868a66574f1a5d089ce",
    releaseId: "tinyrustlm.com@0.2.1",
    publishedAt: "2026-08-08T23:47:22.420Z",
    sourceRevision: "e964a095ede1c077b36b6476af5ee85b087f52f8",
    sourceLedgerSha256: "b10ed6695c4b1f29f4b1272710c64aa37012b15576e019cfad556e2973adbcfc"
  });
  assert.deepEqual(result.ledger.publications[5], {
    publicationId: "cc53b43f55557aa9808264776c73168a750600c7b53c4d6a6bc61815afa0e3b2",
    releaseId: "tinyrustlm.com@0.3.0",
    publishedAt: "2026-08-25T04:57:20.279Z",
    sourceRevision: "dca8a3a2107d8f6992291a59ae3eb1f319b332f4",
    sourceLedgerSha256: "6abb747cd2e50f684fbcf3c935e610660e8f41132d1da1ab782b7a1072cbd831"
  });
  assert.deepEqual(result.ledger.publications[6], {
    publicationId: "c7e900472d59d97c0fec33b2ac73ec4f4c15b09e030e8646e5ca65efbcadc847",
    releaseId: "tinyrustlm.com@0.4.0",
    publishedAt: "2026-08-30T00:39:55.591Z",
    sourceRevision: "fe8e49eb73332787dfe75040b0c39068bcfc5252",
    sourceLedgerSha256: "96710b72b9d8a6afc6553dbaadcebf3c834c7dcbad6221a9fd9c00bb6b76a8ec"
  });
  assert.match(result.ledgerSha256, /^[a-f0-9]{64}$/);
});

test("materializes exact current records from a finalized ledger", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const finalizedPath = finalizedLedgerPath(context);
  const result = materializeReleaseState({ ledgerPath: finalizedPath, outputRoot });
  assert.equal(result.current.version, "0.4.1");
  assert.equal(result.current.publishedAt, publishedAt);
  assert.equal(result.current.sourceRevision, sourceRevision);
  assert.match(result.current.publicationId, /^[a-f0-9]{64}$/);
  assert.equal(result.history.generatedAt, result.current.publishedAt);
  assert.equal(result.history.releases.length, 8);
  const reopened = validatePublicReleaseFiles({ ledgerPath: finalizedPath, outputRoot });
  assert.deepEqual(reopened.current, result.current);
  assert.deepEqual(reopened.history, result.history);
  assert.throws(
    () => materializeReleaseState({
      ledgerPath: finalizedPath,
      outputRoot: path.join(withTemporaryDirectory(context), "invalid"),
      sourceRevision,
      publishedAt
    }),
    /does not accept candidate publication identity/
  );
});

test("CLI materializes only finalized release state without a synthetic publication", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const finalizedPath = finalizedLedgerPath(context);
  const result = childProcess.spawnSync(process.execPath, [
    contractCliPath,
    "materialize-finalized",
    finalizedPath,
    outputRoot
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, "pass");
  assert.equal(summary.version, "0.4.1");
  assert.match(summary.publicationId, /^[a-f0-9]{64}$/u);
  validatePublicReleaseFiles({ ledgerPath: finalizedPath, outputRoot });

  const pendingOutputRoot = path.join(withTemporaryDirectory(context), "pending");
  const rejected = childProcess.spawnSync(process.execPath, [
    contractCliPath,
    "materialize-finalized",
    ledgerPath,
    pendingOutputRoot
  ], { encoding: "utf8" });
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, "");
  assert.equal(rejected.stderr, "Site release contract validation failed\n");
});

test("materializes canonical current and history records bound to one clean source revision", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const candidateLedgerPath = pendingLedgerPath(context);
  const result = materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot,
    sourceRevision,
    publishedAt
  });

  assert.equal(result.current.schema, "uaix.site_release.v1");
  assert.equal(result.current.version, "0.4.1");
  assert.equal(result.current.releaseDate, "2026-08-30");
  assert.equal(result.current.publishedAt, publishedAt);
  assert.equal(result.current.sourceRevision, sourceRevision);
  assert.equal(result.current.updatesUrl, "https://tinyrustlm.com/updates/");
  assert.match(result.current.publicationId, /^[a-f0-9]{64}$/);
  assert.equal(result.history.releases.length, 8);
  assert.deepEqual(result.history.releases.at(-1), result.current);
  assert.equal(result.files.length, 2);
  assert.deepEqual(
    result.files.map((entry) => entry.relativePath),
    [".well-known/site-release-history.json", ".well-known/site-release.json"]
  );
  assert.ok(result.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));

  const reopened = validatePublicReleaseFiles({
    ledgerPath: candidateLedgerPath,
    outputRoot
  });
  assert.deepEqual(reopened.current, result.current);
  assert.deepEqual(reopened.history, result.history);
});

test("materialization is deterministic for an exact ledger, revision, and publication instant", (context) => {
  const firstRoot = path.join(withTemporaryDirectory(context), "first");
  const secondRoot = path.join(withTemporaryDirectory(context), "second");
  const candidateLedgerPath = pendingLedgerPath(context);
  const first = materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot: firstRoot,
    sourceRevision,
    publishedAt
  });
  const second = materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot: secondRoot,
    sourceRevision,
    publishedAt
  });
  assert.deepEqual(first.current, second.current);
  assert.deepEqual(first.history, second.history);
  assert.deepEqual(
    first.files.map(({ relativePath, byteCount, sha256 }) => ({
      relativePath,
      byteCount,
      sha256
    })),
    second.files.map(({ relativePath, byteCount, sha256 }) => ({
      relativePath,
      byteCount,
      sha256
    }))
  );
});

test("rejects unknown fields, duplicate identities, invalid versions, and ambiguous pending releases", () => {
  const baseline = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));

  const unknown = clone(baseline);
  unknown.untrusted = true;
  assert.throws(() => parseReleaseLedger(JSON.stringify(unknown)), /ledger fields/);

  const duplicate = clone(baseline);
  duplicate.releases.push(clone(duplicate.releases[0]));
  assert.throws(
    () => parseReleaseLedger(JSON.stringify(duplicate)),
    /strictly increase|identities must be unique/
  );

  const invalidVersion = clone(baseline);
  invalidVersion.releases[0].version = "v0.1";
  assert.throws(() => parseReleaseLedger(JSON.stringify(invalidVersion)), /SemVer/);

  const secondPending = clone(baseline);
  if (secondPending.publications.length === secondPending.releases.length) {
    secondPending.publications.pop();
  }
  secondPending.releases.push({
    releaseId: "tinyrustlm.com@0.5.0",
    version: "0.5.0",
    releaseDate: "2026-08-30",
    summary: "A second unbound release.",
    changes: [{ type: "changed", summary: "Changed twice without publication evidence." }]
  });
  assert.throws(
    () => parseReleaseLedger(JSON.stringify(secondPending)),
    /exactly one latest release without publication evidence/
  );
});

test("rejects malformed source revisions, non-UTC instants, and source-publication drift", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const candidateLedgerPath = pendingLedgerPath(context);
  assert.throws(
    () => materializeReleasePublication({
      ledgerPath: candidateLedgerPath,
      outputRoot: path.join(outputRoot, "bad-revision"),
      sourceRevision: "abc",
      publishedAt
    }),
    /source revision/
  );
  assert.throws(
    () => materializeReleasePublication({
      ledgerPath: candidateLedgerPath,
      outputRoot: path.join(outputRoot, "bad-time"),
      sourceRevision,
      publishedAt: "2026-08-02T13:15:30-07:00"
    }),
    /UTC millisecond instant/
  );

  const validRoot = path.join(outputRoot, "valid");
  materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot: validRoot,
    sourceRevision,
    publishedAt
  });
  const currentPath = path.join(validRoot, ".well-known", "site-release.json");
  const changed = JSON.parse(fs.readFileSync(currentPath, "utf8"));
  changed.summary = "Silently rewritten after materialization.";
  fs.writeFileSync(currentPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  assert.throws(
    () => validatePublicReleaseFiles({
      ledgerPath: candidateLedgerPath,
      outputRoot: validRoot
    }),
    /does not match release history/
  );
});

test("public history may only append exact prior records", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const candidateLedgerPath = pendingLedgerPath(context);
  const result = materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot,
    sourceRevision,
    publishedAt
  });
  const previous = clone(result.history);
  const extended = clone(previous);
  extended.generatedAt = "2026-08-31T20:15:30.000Z";
  extended.releases.push({
    ...clone(result.current),
    releaseId: "tinyrustlm.com@0.5.0",
    version: "0.5.0",
    releaseDate: "2026-08-30",
    publishedAt: "2026-08-31T20:15:30.000Z",
    sourceRevision: "b".repeat(40),
    publicationId: "c".repeat(64)
  });
  assert.equal(assertHistoryExtension(previous, extended), true);

  const rewritten = clone(extended);
  rewritten.releases[0].summary = "Rewritten history";
  assert.throws(
    () => assertHistoryExtension(previous, rewritten),
    /rewrites an existing release/
  );

  const truncated = clone(previous);
  truncated.releases = [];
  assert.throws(
    () => assertHistoryExtension(previous, truncated),
    /cannot remove releases/
  );
});

test("produces an exclusive candidate ledger after successful public evidence", (context) => {
  const root = withTemporaryDirectory(context);
  const publicOutputRoot = path.join(root, "public");
  const candidatePath = path.join(root, "site-release-ledger.finalized.json");
  const candidateLedgerPath = pendingLedgerPath(context);
  const materialized = materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot: publicOutputRoot,
    sourceRevision,
    publishedAt
  });
  const finalized = finalizeReleaseLedger({
    ledgerPath: candidateLedgerPath,
    publicOutputRoot,
    outputPath: candidatePath
  });

  assert.equal(finalized.ledger.publications.length, 8);
  assert.equal(finalized.publication.publicationId, materialized.current.publicationId);
  assert.equal(finalized.ledger.publications[0].releaseId, "tinyrustlm.com@0.1.0");
  assert.equal(finalized.ledger.publications.at(-1).releaseId, "tinyrustlm.com@0.4.1");
  assert.equal(finalized.ledger.publications.at(-1).publishedAt, publishedAt);
  assert.equal(finalized.ledger.publications.at(-1).sourceRevision, sourceRevision);
  assert.equal(parseReleaseLedger(fs.readFileSync(candidatePath)).pendingRelease, null);
  assert.throws(
    () => finalizeReleaseLedger({
      ledgerPath: candidateLedgerPath,
      publicOutputRoot,
      outputPath: candidatePath
    }),
    /EEXIST/
  );
});

test("finalization refuses drifted public records and source-ledger overwrite", (context) => {
  const root = withTemporaryDirectory(context);
  const publicOutputRoot = path.join(root, "public");
  const candidateLedgerPath = pendingLedgerPath(context);
  materializeReleasePublication({
    ledgerPath: candidateLedgerPath,
    outputRoot: publicOutputRoot,
    sourceRevision,
    publishedAt
  });

  assert.throws(
    () => finalizeReleaseLedger({
      ledgerPath: candidateLedgerPath,
      publicOutputRoot,
      outputPath: candidateLedgerPath
    }),
    /must not overwrite source evidence/
  );

  const currentPath = path.join(publicOutputRoot, ".well-known", "site-release.json");
  const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));
  current.sourceRevision = "b".repeat(40);
  fs.writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  assert.throws(
    () => finalizeReleaseLedger({
      ledgerPath: candidateLedgerPath,
      publicOutputRoot,
      outputPath: path.join(root, "drifted.json")
    }),
    /does not match release history/
  );
});
