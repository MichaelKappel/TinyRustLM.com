"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const successorPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-composition-conversion-profile.v2.json"
);
const predecessorPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-composition-conversion-profile.v1.json"
);
const successorBytes = fs.readFileSync(successorPath);
const predecessorBytes = fs.readFileSync(predecessorPath);
const successor = JSON.parse(successorBytes.toString("utf8"));
const predecessor = JSON.parse(predecessorBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("registers the relationship correction before implementation or output", () => {
  assert.equal(successorBytes.length, 8835);
  assert.equal(
    sha256(successorBytes),
    "d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718"
  );
  assert.equal(
    successorBytes.toString("utf8"),
    `${JSON.stringify(successor, null, 2)}\n`
  );
  assert.equal(
    successor.schema,
    "tinyrustlm.qwen3-composition-conversion-profile.v2"
  );
  assert.equal(
    successor.profileId,
    "tinyrustlm.qwen3-complete-composition-conversion/2"
  );
  assert.equal(
    successor.status,
    "registered-before-architecture-relationship-correction-and-real-output"
  );
  assert.equal(
    successor.registrationParentCommit,
    "13a90b4dc07db2fc4c27b53f00ad9b9e69be8fae"
  );
  assert.equal(
    successor.registrationParentTree,
    "5e86f52cae37506f4a6da8c5abef5744f14b2692"
  );
  assert.ok(Object.values(successor.registrationOutputBoundary)
    .every((value) => value === false));
});

test("invalidates the erroneous predecessor without a legacy path", () => {
  assert.equal(successor.predecessorDisposition.path,
    "contracts/vnext/qwen3-composition-conversion-profile.v1.json");
  assert.equal(successor.predecessorDisposition.profileId,
    predecessor.profileId);
  assert.equal(successor.predecessorDisposition.sha256,
    sha256(predecessorBytes));
  assert.equal(successor.predecessorDisposition.status,
    "terminally-invalidated-before-real-composition-output");
  assert.equal(successor.predecessorDisposition.realCompositionOutputCreated,
    false);
  for (const field of [
    "runtimeSupportRetained",
    "compatibilityReaderRetained",
    "migrationWritten",
    "aliasRetained",
    "fallbackRetained"
  ]) {
    assert.equal(successor.predecessorDisposition[field], false, field);
  }
});

test("requires compatible model and tokenizer profiles instead of false equality", () => {
  assert.deepEqual(successor.sourceRelationship.requiredEqualFields, [
    "modelId",
    "revision"
  ]);
  assert.deepEqual(successor.sourceRelationship.requiredArchitectureProfiles, {
    model: "tinyrustlm.qwen3-dense-gqa-qk-norm/1",
    tokenizer: "tinyrustlm.qwen3-tokenizer-source/1"
  });
  assert.deepEqual(successor.sourceRelationship.requiredEqualFileRecords, [
    "config.json",
    "merges.txt",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json"
  ]);
  assert.ok(predecessor.sourceRelationship.requiredEqualFields.includes(
    "architectureProfileId"
  ));
});

test("retains every unrelated complete-composition invariant", () => {
  for (const field of [
    "authority",
    "productBoundary",
    "command",
    "exactModel",
    "artifacts",
    "evidenceFiles",
    "transaction",
    "resourcePolicy",
    "receiptClaims",
    "requiredNextGate",
    "campaignCounters"
  ]) {
    assert.deepEqual(successor[field], predecessor[field], field);
  }
  assert.equal(successor.productBoundary.legacySupport, false);
  assert.equal(successor.productBoundary.compatibilityReaders, false);
  assert.equal(successor.productBoundary.migrationWriters, false);
  assert.equal(successor.productBoundary.aliases, false);
  assert.equal(successor.productBoundary.fallbacks, false);
});

test("contains no credential, forbidden drive, or inflated claim", () => {
  const text = successorBytes.toString("utf8");
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
  assert.deepEqual(successor.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
