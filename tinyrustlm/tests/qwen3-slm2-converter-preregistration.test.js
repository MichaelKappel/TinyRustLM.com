"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-safetensors-conversion-profile.v1.json"
);
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("registers Qwen3 mixed-Q8 conversion before any output", () => {
  assert.equal(profileBytes.length, 14419);
  assert.equal(sha256(profileBytes),
    "313069152daa70a2c2b5070f9d1350379a5800f647d5c3ac8d23a75ff9ead968");
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-safetensors-conversion-profile.v1");
  assert.equal(profile.profileId,
    "tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/1");
  assert.equal(profile.status,
    "registered-before-qwen3-converter-output");
  assert.equal(profile.registrationParentCommit,
    "7334aab34107ce7d9ea3d0491856feb4166222d5");
  assert.equal(profile.registrationParentTree,
    "9e81843bcfae256acbc0ffdffc1e2946319e2d66");
  assert.ok(profileBytes.length <= 32768);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds one strict nine-file source closure", () => {
  assert.equal(profile.sourceLock.schema,
    "tinyrustlm.qwen3_source_lock.v1");
  assert.deepEqual(profile.sourceClosure.requiredFilesInExactDirectoryInventory,
    [
      "LICENSE",
      "README.md",
      "config.json",
      "generation_config.json",
      "merges.txt",
      "model.safetensors",
      "tokenizer.json",
      "tokenizer_config.json",
      "vocab.json"
    ]);
  assert.equal(profile.sourceClosure.additionalFiles, "fatal");
  assert.equal(profile.sourceClosure.symlinkOrReparseInput, "fatal");
  assert.equal(profile.sourceClosure.verifyBeforeConversion, true);
  assert.equal(profile.sourceClosure.verifyAfterConversionBeforePromotion,
    true);
});

test("freezes Qwen3 operator semantics and the reviewed base shape", () => {
  const config = profile.configContract;
  assert.deepEqual(config.architectures, ["Qwen3ForCausalLM"]);
  assert.equal(config.modelType, "qwen3");
  assert.equal(config.attentionBias, false);
  assert.equal(config.queryKeyNormalization, true);
  assert.equal(config.tiedEmbeddings, true);
  assert.equal(config.selectedBaseShape.queryWidth, 2048);
  assert.equal(config.selectedBaseShape.embeddingSize, 1024);
  assert.equal(config.selectedBaseShape.tensorCount, 310);
  assert.equal(config.selectedBaseShape.parameterCount, 596049920);
  assert.equal(profile.tensorMapping["lm_head.weight"],
    "forbidden-when-tie_word_embeddings-is-true");
  assert.equal(profile.tensorMapping.projectionBiases, "forbidden");
});

test("selects only exact SLM2 mixed-Q8 output", () => {
  const output = profile.outputContract;
  assert.equal(output.formatProfileId, "org.minimodel.slm2/2.0");
  assert.equal(output.formatProfileSha256,
    "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8");
  assert.equal(output.weightProfileId,
    "tinyrustlm.weight-q8-row-symmetric-f32-scale/1");
  assert.equal(output.weightProfileSha256,
    "7e931fd23fa8f6a90c53e4c14c5630eef8ce87e0f0902acd5a5e2df03c60733a");
  assert.equal(output.runtimeRepacking, false);
  assert.equal(output.f32WeightShadow, false);
  assert.equal(output.additionalTokenizerOrTemplateOutput, false);
});

test("keeps conversion, runtime, and model-quality claims separate", () => {
  const receipt = profile.receiptContract;
  assert.equal(receipt.conversionClaim,
    "structural-and-byte-conversion-only");
  assert.equal(receipt.modelQualityStatus, "not-assessed-by-converter");
  assert.equal(receipt.sourceFrameworkParityStatus,
    "not-assessed-by-converter");
  assert.equal(receipt.nativeRuntimeStatus, "not-assessed-by-converter");
  assert.equal(receipt.browserWasmStatus, "not-assessed-by-converter");
  assert.equal(profile.authority.selectedBaseProductStatus,
    "terminally-rejected-as-product-model");
});

test("forbids parallel, fallback, and fake-success converter paths", () => {
  for (const [name, value] of Object.entries(profile.cleanCut)) {
    if (name === "obsoleteQwen2ImplementationDeletedInSameConverterChange") {
      assert.equal(value, true, name);
    } else {
      assert.equal(value, false, name);
    }
  }
  assert.equal(profile.durability.automaticRetry, false);
  assert.equal(profile.durability.cleanupOnFailure, false);
  assert.equal(profile.outputContract.additionalTokenizerOrTemplateOutput,
    false);
});

test("contains no credential, private output path, or campaign inflation", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});
