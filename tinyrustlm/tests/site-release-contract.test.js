"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertHistoryExtension,
  finalizeReleaseLedger,
  materializeReleasePublication,
  parseReleaseLedger,
  validatePublicReleaseFiles
} = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");
const sourceRevision = "a".repeat(40);
const publishedAt = "2026-08-02T20:15:30.000Z";

function clone(value) {
  return structuredClone(value);
}

function withTemporaryDirectory(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-site-release-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("source release ledger has one strict pending TinyRustLM release", () => {
  const result = parseReleaseLedger(fs.readFileSync(ledgerPath));
  assert.equal(result.ledger.site.siteId, "tinyrustlm.com");
  assert.equal(result.ledger.site.canonicalOrigin, "https://tinyrustlm.com");
  assert.equal(result.ledger.site.updatesPath, "/updates/");
  assert.equal(result.ledger.releases.length, 1);
  assert.equal(result.ledger.publications.length, 0);
  assert.equal(result.pendingRelease.releaseId, "tinyrustlm.com@0.1.0");
  assert.equal(result.pendingRelease.version, "0.1.0");
  assert.match(result.ledgerSha256, /^[a-f0-9]{64}$/);
});

test("materializes canonical current and history records bound to one clean source revision", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const result = materializeReleasePublication({
    ledgerPath,
    outputRoot,
    sourceRevision,
    publishedAt
  });

  assert.equal(result.current.schema, "uaix.site_release.v1");
  assert.equal(result.current.version, "0.1.0");
  assert.equal(result.current.releaseDate, "2026-08-02");
  assert.equal(result.current.publishedAt, publishedAt);
  assert.equal(result.current.sourceRevision, sourceRevision);
  assert.equal(result.current.updatesUrl, "https://tinyrustlm.com/updates/");
  assert.match(result.current.publicationId, /^[a-f0-9]{64}$/);
  assert.equal(result.history.releases.length, 1);
  assert.deepEqual(result.history.releases[0], result.current);
  assert.equal(result.files.length, 2);
  assert.deepEqual(
    result.files.map((entry) => entry.relativePath),
    [".well-known/site-release-history.json", ".well-known/site-release.json"]
  );
  assert.ok(result.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));

  const reopened = validatePublicReleaseFiles({ ledgerPath, outputRoot });
  assert.deepEqual(reopened.current, result.current);
  assert.deepEqual(reopened.history, result.history);
});

test("materialization is deterministic for an exact ledger, revision, and publication instant", (context) => {
  const firstRoot = path.join(withTemporaryDirectory(context), "first");
  const secondRoot = path.join(withTemporaryDirectory(context), "second");
  const first = materializeReleasePublication({
    ledgerPath,
    outputRoot: firstRoot,
    sourceRevision,
    publishedAt
  });
  const second = materializeReleasePublication({
    ledgerPath,
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
  secondPending.releases.push({
    releaseId: "tinyrustlm.com@0.2.0",
    version: "0.2.0",
    releaseDate: "2026-08-03",
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
  assert.throws(
    () => materializeReleasePublication({
      ledgerPath,
      outputRoot: path.join(outputRoot, "bad-revision"),
      sourceRevision: "abc",
      publishedAt
    }),
    /source revision/
  );
  assert.throws(
    () => materializeReleasePublication({
      ledgerPath,
      outputRoot: path.join(outputRoot, "bad-time"),
      sourceRevision,
      publishedAt: "2026-08-02T13:15:30-07:00"
    }),
    /UTC millisecond instant/
  );

  const validRoot = path.join(outputRoot, "valid");
  materializeReleasePublication({ ledgerPath, outputRoot: validRoot, sourceRevision, publishedAt });
  const currentPath = path.join(validRoot, ".well-known", "site-release.json");
  const changed = JSON.parse(fs.readFileSync(currentPath, "utf8"));
  changed.summary = "Silently rewritten after materialization.";
  fs.writeFileSync(currentPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  assert.throws(
    () => validatePublicReleaseFiles({ ledgerPath, outputRoot: validRoot }),
    /does not match release history/
  );
});

test("public history may only append exact prior records", (context) => {
  const outputRoot = withTemporaryDirectory(context);
  const result = materializeReleasePublication({
    ledgerPath,
    outputRoot,
    sourceRevision,
    publishedAt
  });
  const previous = clone(result.history);
  const extended = clone(previous);
  extended.generatedAt = "2026-08-03T20:15:30.000Z";
  extended.releases.push({
    ...clone(result.current),
    releaseId: "tinyrustlm.com@0.2.0",
    version: "0.2.0",
    releaseDate: "2026-08-03",
    publishedAt: "2026-08-03T20:15:30.000Z",
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
  const materialized = materializeReleasePublication({
    ledgerPath,
    outputRoot: publicOutputRoot,
    sourceRevision,
    publishedAt
  });
  const finalized = finalizeReleaseLedger({
    ledgerPath,
    publicOutputRoot,
    outputPath: candidatePath
  });

  assert.equal(finalized.ledger.publications.length, 1);
  assert.equal(finalized.publication.publicationId, materialized.current.publicationId);
  assert.equal(finalized.ledger.publications[0].releaseId, "tinyrustlm.com@0.1.0");
  assert.equal(finalized.ledger.publications[0].publishedAt, publishedAt);
  assert.equal(finalized.ledger.publications[0].sourceRevision, sourceRevision);
  assert.equal(parseReleaseLedger(fs.readFileSync(candidatePath)).pendingRelease, null);
  assert.throws(
    () => finalizeReleaseLedger({ ledgerPath, publicOutputRoot, outputPath: candidatePath }),
    /EEXIST/
  );
});

test("finalization refuses drifted public records and source-ledger overwrite", (context) => {
  const root = withTemporaryDirectory(context);
  const publicOutputRoot = path.join(root, "public");
  materializeReleasePublication({
    ledgerPath,
    outputRoot: publicOutputRoot,
    sourceRevision,
    publishedAt
  });

  assert.throws(
    () => finalizeReleaseLedger({
      ledgerPath,
      publicOutputRoot,
      outputPath: ledgerPath
    }),
    /must not overwrite source evidence/
  );

  const currentPath = path.join(publicOutputRoot, ".well-known", "site-release.json");
  const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));
  current.sourceRevision = "b".repeat(40);
  fs.writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  assert.throws(
    () => finalizeReleaseLedger({
      ledgerPath,
      publicOutputRoot,
      outputPath: path.join(root, "drifted.json")
    }),
    /does not match release history/
  );
});
