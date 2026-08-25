"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const paths = {
  tokenizer: "contracts/vnext/qwen-tokenizer2-conversion-profile.v2.json",
  tokenizerPredecessor: "contracts/vnext/qwen-tokenizer2-conversion-profile.v1.json",
  composition: "contracts/vnext/qwen3-composition-conversion-profile.v4.json",
  compositionPredecessor: "contracts/vnext/qwen3-composition-conversion-profile.v3.json",
  result: "contracts/vnext/qwen3-real-composition-execution-result.v3.json"
};

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath));
}

function parse(relativePath) {
  return JSON.parse(read(relativePath).toString("utf8"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const tokenizerBytes = read(paths.tokenizer);
const tokenizer = parse(paths.tokenizer);
const compositionBytes = read(paths.composition);
const composition = parse(paths.composition);
const tokenizerPredecessorBytes = read(paths.tokenizerPredecessor);
const compositionPredecessorBytes = read(paths.compositionPredecessor);
const resultBytes = read(paths.result);

test("registers canonical corrected profiles before implementation and new output", () => {
  assert.equal(tokenizerBytes.length, 8394);
  assert.equal(
    sha256(tokenizerBytes),
    "97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4"
  );
  assert.equal(compositionBytes.length, 11421);
  assert.equal(
    sha256(compositionBytes),
    "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8"
  );
  assert.equal(tokenizerBytes.toString("utf8"), `${JSON.stringify(tokenizer, null, 2)}\n`);
  assert.equal(
    compositionBytes.toString("utf8"),
    `${JSON.stringify(composition, null, 2)}\n`
  );
  for (const profile of [tokenizer, composition]) {
    assert.equal(profile.registrationParentCommit,
      "43a29e8e1ba7a3296be18425a5fc077fb13617fe");
    assert.equal(profile.registrationParentTree,
      "5a4370411f340782323cec2a3ac8afd61035982c");
    assert.match(profile.status, /^registered-before-/u);
    assert.ok(Object.values(profile.registrationOutputBoundary)
      .every((value) => value === false));
  }
});

test("binds the immutable /3 failure and invalidates executable predecessor identities", () => {
  assert.equal(tokenizer.predecessorDisposition.sha256,
    sha256(tokenizerPredecessorBytes));
  assert.equal(composition.predecessorDisposition.sha256,
    sha256(compositionPredecessorBytes));
  assert.equal(tokenizer.predecessorDisposition.observedFailureResultSha256,
    sha256(resultBytes));
  assert.equal(composition.predecessorDisposition.observedFailureResultSha256,
    sha256(resultBytes));
  assert.equal(tokenizer.predecessorDisposition.observedErrorCode,
    "qwen-tokenizer2-output-path-invalid");
  for (const disposition of [
    tokenizer.predecessorDisposition,
    composition.predecessorDisposition
  ]) {
    assert.equal(disposition.runtimeSupportRetained, false);
    assert.equal(disposition.compatibilityReaderRetained, false);
    assert.equal(disposition.migrationWritten, false);
    assert.equal(disposition.aliasRetained, false);
    assert.equal(disposition.fallbackRetained, false);
  }
});

test("freezes one dot-tokenizer2 output suffix with no dot-tok2 alias", () => {
  assert.equal(tokenizer.output.fileSuffix, ".tokenizer2");
  assert.equal(tokenizer.output.obsoleteFileSuffix, ".tok2");
  assert.equal(
    tokenizer.output.obsoleteFileSuffixDisposition,
    "rejected-with-output-path-invalid-no-alias"
  );
  assert.equal(tokenizer.output.binaryFormatId, "minimodel.tok2");
  assert.equal(tokenizer.output.binaryFormatIdIsFileSuffix, false);
  assert.equal(tokenizer.transaction.output, "absolute-new-tokenizer2-file");
  assert.equal(tokenizer.receipt.schema,
    "tinyrustlm.qwen_tokenizer2_conversion_receipt.v2");
  assert.ok(tokenizer.requiredRegressionMatrix.includes(
    "obsolete-dot-tok2-suffix-rejected-before-output"));
});

test("binds composition to the exact corrected tokenizer producer and receipt", () => {
  assert.equal(composition.profileId,
    "tinyrustlm.qwen3-complete-composition-conversion/4");
  assert.equal(composition.sourceRelationship.tokenizerDirectoryInventoryOwner,
    tokenizer.profileId);
  assert.equal(composition.sourceRelationship.tokenizerDirectoryInventoryOwnerSha256,
    sha256(tokenizerBytes));
  const member = composition.artifacts.find((artifact) => artifact.kind === "tokenizer2");
  assert.equal(member.file, "tokenizer.tokenizer2");
  assert.equal(member.fileSuffix, ".tokenizer2");
  assert.equal(member.obsoleteFileSuffixAccepted, false);
  assert.equal(member.producer, tokenizer.profileId);
  assert.equal(member.producerProfileSha256, sha256(tokenizerBytes));
  assert.equal(composition.tokenizerReceiptContract.schema,
    tokenizer.receipt.schema);
  assert.equal(composition.tokenizerReceiptContract.obsoleteFileSuffixAccepted, false);
});

test("retains the clean-slate and zero-claim boundary", () => {
  for (const profile of [tokenizer, composition]) {
    for (const field of [
      "legacySupport",
      "compatibilityReaders",
      "migrationWriters",
      "aliases",
      "fallbacks",
      "responseRepair",
      "automaticRetry",
      "bestOfN"
    ]) {
      assert.equal(profile.productBoundary[field], false, field);
    }
    assert.deepEqual(profile.campaignCounters, {
      qualifiedModels: "0/20",
      deletionBackedBrowserRounds: "0/50",
      authorizedLiveMemoryRounds: "0/25",
      currentOutsideNetworkLaneProofs: "0/40",
      liveCatalogAnnouncements: "0/20"
    });
    const text = JSON.stringify(profile);
    assert.doesNotMatch(text, /[CDE]:[\\/]/u);
    assert.doesNotMatch(
      text,
      /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
    );
  }
});
