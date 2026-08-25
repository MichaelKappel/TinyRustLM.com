"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const paths = {
  source: "contracts/vnext/qwen3-safetensors-conversion-profile.v2.json",
  sourcePredecessor: "contracts/vnext/qwen3-safetensors-conversion-profile.v1.json",
  composition: "contracts/vnext/qwen3-composition-conversion-profile.v3.json",
  compositionPredecessor: "contracts/vnext/qwen3-composition-conversion-profile.v2.json",
  result: "contracts/vnext/qwen3-real-composition-execution-result.v2.json"
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

const sourceBytes = read(paths.source);
const source = parse(paths.source);
const sourcePredecessorBytes = read(paths.sourcePredecessor);
const compositionBytes = read(paths.composition);
const composition = parse(paths.composition);
const compositionPredecessorBytes = read(paths.compositionPredecessor);
const resultBytes = read(paths.result);

test("registers both corrected profiles before implementation or new output", () => {
  assert.equal(sourceBytes.length, 18177);
  assert.equal(
    sha256(sourceBytes),
    "fa2ce18f38129a6b106000d7802d1ea3995921e2b945ae5e52457908f548e7cf"
  );
  assert.equal(compositionBytes.length, 9764);
  assert.equal(
    sha256(compositionBytes),
    "c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0"
  );
  assert.equal(sourceBytes.toString("utf8"), `${JSON.stringify(source, null, 2)}\n`);
  assert.equal(
    compositionBytes.toString("utf8"),
    `${JSON.stringify(composition, null, 2)}\n`
  );
  for (const profile of [source, composition]) {
    assert.equal(
      profile.registrationParentCommit,
      "b4545da32dd19a435aacab6f1792cd890a6e6f5e"
    );
    assert.equal(
      profile.registrationParentTree,
      "e94eced3b125b83b33e6e58cc61478dfbe2d6b40"
    );
    assert.match(profile.status, /^registered-before-/u);
    assert.ok(Object.values(profile.registrationOutputBoundary)
      .every((value) => value === false));
  }
});

test("invalidates only the defective executable identities and preserves history", () => {
  assert.equal(source.schema, "tinyrustlm.qwen3-safetensors-conversion-profile.v2");
  assert.equal(source.profileId, "tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/2");
  assert.equal(source.predecessorDisposition.sha256, sha256(sourcePredecessorBytes));
  assert.equal(source.predecessorDisposition.modelOutputCreated, false);
  assert.equal(
    composition.schema,
    "tinyrustlm.qwen3-composition-conversion-profile.v3"
  );
  assert.equal(
    composition.profileId,
    "tinyrustlm.qwen3-complete-composition-conversion/3"
  );
  assert.equal(
    composition.predecessorDisposition.sha256,
    sha256(compositionPredecessorBytes)
  );
  assert.equal(
    source.predecessorDisposition.observedFailureResultSha256,
    sha256(resultBytes)
  );
  assert.equal(
    composition.predecessorDisposition.observedFailureResultSha256,
    sha256(resultBytes)
  );
  for (const disposition of [
    source.predecessorDisposition,
    composition.predecessorDisposition
  ]) {
    for (const field of [
      "runtimeSupportRetained",
      "compatibilityReaderRetained",
      "migrationWritten",
      "aliasRetained",
      "fallbackRetained"
    ]) {
      assert.equal(disposition[field], false, field);
    }
  }
});

test("separates physical source identity from logical SLM2 identity", () => {
  const shape = source.configContract.selectedBaseShape;
  assert.equal(shape.physicalSourceTensorCount, 311);
  assert.equal(shape.logicalOutputTensorCount, 310);
  assert.equal(shape.physicalSourceParameterCount, 751632384);
  assert.equal(shape.logicalOutputParameterCount, 596049920);
  assert.equal(shape.redundantTiedOutputParameterCount, 155582464);
  assert.equal(
    shape.logicalOutputParameterCount + shape.redundantTiedOutputParameterCount,
    shape.physicalSourceParameterCount
  );
  assert.equal(composition.exactModel.physicalSourceTensorCount, 311);
  assert.equal(composition.exactModel.logicalSlm2TensorCount, 310);
  assert.equal(composition.exactModel.redundantTiedOutputVerifiedAndNotEmitted, true);
});

test("requires exact streamed tied-output equality before output creation", () => {
  const tied = source.tiedOutputContract;
  assert.equal(tied.requiredConfigValue, true);
  assert.equal(tied.canonicalEmbeddingSourceTensor, "model.embed_tokens.weight");
  assert.equal(tied.redundantOutputSourceTensor, "lm_head.weight");
  assert.equal(tied.requiredOccurrenceCountEach, 1);
  assert.equal(tied.comparisonBufferBytes, 1048576);
  assert.equal(
    tied.requiredSourcePayloadRelationship,
    "byte-for-byte-identical-before-any-output-path-is-created"
  );
  assert.deepEqual(tied.selectedBaseProof.shape, [151936, 1024]);
  assert.equal(tied.selectedBaseProof.byteLengthEach, 311164928);
  assert.equal(
    tied.selectedBaseProof.canonicalEmbeddingSha256,
    tied.selectedBaseProof.redundantOutputSha256
  );
  assert.match(source.tensorMapping["lm_head.weight"], /never-emitted/u);
  for (const errorClass of [
    "tied-output-required",
    "tied-output-dtype-mismatch",
    "tied-output-shape-mismatch",
    "tied-output-length-mismatch",
    "tied-output-payload-mismatch"
  ]) {
    assert.ok(source.stableErrorClasses.includes(errorClass), errorClass);
  }
});

test("binds the sole composition to the corrected producer and receipt", () => {
  assert.equal(
    composition.sourceRelationship.modelDirectoryInventoryOwner,
    source.profileId
  );
  assert.equal(
    composition.sourceRelationship.modelDirectoryInventoryOwnerSha256,
    sha256(sourceBytes)
  );
  const model = composition.artifacts.find((artifact) => artifact.kind === "slm2");
  assert.equal(model.producer, source.profileId);
  assert.equal(model.producerProfileSha256, sha256(sourceBytes));
  assert.equal(source.receiptContract.schema, "tinyrustlm.qwen3_conversion_receipt.v2");
  assert.equal(
    composition.modelReceiptContract.schema,
    source.receiptContract.schema
  );
  assert.equal(composition.modelReceiptContract.requiresTiedOutputEqualityProof, true);
});

test("retains the prelaunch no-legacy and no-claim boundary", () => {
  for (const profile of [source, composition]) {
    const text = JSON.stringify(profile);
    assert.doesNotMatch(
      text,
      /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
    );
    assert.doesNotMatch(text, /[CD]:[\\/]/u);
    assert.deepEqual(profile.campaignCounters, {
      qualifiedModels: "0/20",
      deletionBackedBrowserRounds: "0/50",
      authorizedLiveMemoryRounds: "0/25",
      currentOutsideNetworkLaneProofs: "0/40",
      liveCatalogAnnouncements: "0/20"
    });
  }
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
    assert.equal(composition.productBoundary[field], false, field);
  }
});
