"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  canonicalLedgerBytes,
  ledgerSchema,
  validateLedger,
  validateLedgerFile
} = require("../tools/vector-experiment-ledger.js");

const ledgerPath = path.resolve(__dirname,
  "../experiments/vector-quantization/source-claim-ledger.v1.json");

function cloneLedger() {
  return JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
}

test("validates the pinned ledger and rebuilds its bytes offline", () => {
  const raw = fs.readFileSync(ledgerPath);
  const result = validateLedgerFile(ledgerPath);

  assert.equal(result.ledger.schema, ledgerSchema);
  assert.equal(result.ledger.sources.length, 5);
  assert.equal(result.ledger.claims.length, 7);
  assert.equal(result.ledger.productAuthority, false);
  assert.equal(result.ledger.trainingAuthority, false);
  assert.deepEqual(canonicalLedgerBytes(result.ledger), raw);
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
});

test("keeps repository, Rust package, and Python package identities distinct", () => {
  const ledger = validateLedger(cloneLedger());
  const versions = new Map(ledger.sources.map((source) => [source.sourceId, source.publicationVersion]));

  assert.equal(versions.get("turbovec-repository-v090"), "git-tag:v0.9.0");
  assert.equal(versions.get("turbovec-crate-090"), "crates.io:turbovec:0.9.0");
  assert.equal(versions.get("turbovec-pypi-080"), "pypi:turbovec:0.8.0");
  assert.equal(versions.get("nist-fips-180-4-2015"),
    "nist-fips:NIST.FIPS.180-4:2015-08");
  assert.equal(new Set(versions.values()).size, 5);
});

test("pins standards independently from packages, repositories, and papers", () => {
  const ledger = validateLedger(cloneLedger());
  const source = ledger.sources.find((entry) => entry.sourceId === "nist-fips-180-4-2015");

  assert.equal(source.sourceKind, "standard");
  assert.equal(source.repositoryRevision, "NIST.FIPS.180-4:2015-08");
  assert.equal(source.implementationInputApproved, true);
  assert.equal(source.testVectorCopyApproved, true);
});

test("rejects incomplete, shorthand, or abbreviated upstream identities", () => {
  const missing = cloneLedger();
  delete missing.sources[0].artifactSha256;
  assert.throws(() => validateLedger(missing), /fields are invalid/u);

  const shorthand = cloneLedger();
  shorthand.sources[1].publicationVersion = "TurboVec 0.9.0";
  assert.throws(() => validateLedger(shorthand), /registry-qualified identity|shorthand/u);

  const abbreviated = cloneLedger();
  abbreviated.sources.find((source) => source.sourceKind === "repository-archive")
    .repositoryRevision = "1e7200c";
  assert.throws(() => validateLedger(abbreviated), /complete Git commit/u);

  const looseStandard = cloneLedger();
  looseStandard.sources.find((source) => source.sourceKind === "standard")
    .repositoryRevision = "FIPS 180-4";
  assert.throws(() => validateLedger(looseStandard), /exact approved standard edition/u);
});

test("rejects internal citations, machine-local paths, and credential URLs", () => {
  const citation = cloneLedger();
  citation.claims[0].citationUrl = "turn247search1";
  assert.throws(() => validateLedger(citation), /internal research citation marker|absolute URL/u);

  const localPath = cloneLedger();
  localPath.sources[0].reviewPurpose = "Reviewed from E:\\Source\\external\\TurboQuant.";
  assert.throws(() => validateLedger(localPath), /machine-local path/u);

  const credential = cloneLedger();
  credential.sources[0].artifactUrl = "https://example.test/paper?token=secret";
  assert.throws(() => validateLedger(credential), /credential-like query parameter/u);
});

test("requires one explicit storage lane and one evidence class per claim", () => {
  const mixed = cloneLedger();
  mixed.claims[0].storageLane = "static-weights+kv-cache";
  assert.throws(() => validateLedger(mixed), /storageLane is unsupported/u);

  const unlabeled = cloneLedger();
  unlabeled.claims[0].claimClass = "fact";
  assert.throws(() => validateLedger(unlabeled), /claimClass is unsupported/u);

  const duplicatedBoundary = cloneLedger();
  duplicatedBoundary.experimentBoundaries[1].storageLane = "embedding-index";
  assert.throws(() => validateLedger(duplicatedBoundary), /identifiers must be unique/u);
});

test("rejects copied test-vector approval without implementation-input approval", () => {
  const ledger = cloneLedger();
  ledger.sources.find((source) => source.sourceId === "turboquant-arxiv-v1")
    .testVectorCopyApproved = true;
  assert.throws(() => validateLedger(ledger), /cannot approve copied test vectors/u);
});

test("requires local observations to bind local evidence status", () => {
  const ledger = cloneLedger();
  const observation = ledger.claims.find((claim) => claim.claimClass === "local-observation");
  observation.reproductionStatus = "not-reproduced";
  assert.throws(() => validateLedger(ledger), /local observations require local evidence/u);
});
