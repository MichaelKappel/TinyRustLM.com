"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-composition-conversion-profile.v1.json"
);
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("registers complete Qwen3 composition conversion before output", () => {
  assert.equal(profileBytes.length, 7978);
  assert.equal(sha256(profileBytes),
    "2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158");
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-composition-conversion-profile.v1");
  assert.equal(profile.profileId,
    "tinyrustlm.qwen3-complete-composition-conversion/1");
  assert.equal(profile.status,
    "registered-before-complete-composition-output");
  assert.equal(profile.registrationParentCommit,
    "f0df2170245673005bb04944a4549da165c3e824");
  assert.equal(profile.registrationParentTree,
    "fb86ea62eab1f4c5110d6db75cdafefa7fe9771f");
  assert.ok(profileBytes.length <= 32768);
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
});

test("binds one clean-slate product and the authorized owners", () => {
  assert.deepEqual(profile.productBoundary, {
    productCount: 1,
    prelaunch: true,
    legacySupport: false,
    compatibilityReaders: false,
    migrationWriters: false,
    aliases: false,
    fallbacks: false,
    responseRepair: false,
    automaticRetry: false,
    bestOfN: false
  });
  assert.equal(profile.authority.productLifecycle,
    "prelaunch-single-product");
  assert.equal(profile.authority.technicalVersionIsProductGeneration, false);
  assert.equal(profile.authority.transactionOwner,
    "rust/crates/tinyrustlm-convert");
  assert.equal(profile.authority.graphOwner,
    "rust/crates/tinyrustlm-composition2");
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.authority.writeDriveDAllowed, false);
});

test("requires related exact model and tokenizer source closures", () => {
  assert.equal(profile.command.name, "qwen3-composition");
  assert.deepEqual(profile.command.arguments, [
    "model-source-lock",
    "model-source-directory",
    "tokenizer-source-lock",
    "tokenizer-source-directory",
    "output-root"
  ]);
  assert.equal(profile.command.outputRootMustBeAbsent, true);
  assert.equal(profile.command.sourceAndOutputTreesMustNotOverlap, true);
  assert.equal(profile.sourceRelationship.modelLockSchema,
    "tinyrustlm.qwen3_source_lock.v1");
  assert.equal(profile.sourceRelationship.tokenizerLockSchema,
    "tinyrustlm.qwen_tokenizer2_source_lock.v1");
  assert.deepEqual(profile.sourceRelationship.requiredEqualFields, [
    "modelId", "revision", "architectureProfileId"
  ]);
  assert.deepEqual(profile.sourceRelationship.requiredEqualFileRecords, [
    "config.json",
    "merges.txt",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json"
  ]);
});

test("freezes the exact Qwen3-0.6B architecture relationship", () => {
  assert.deepEqual(profile.exactModel, {
    architecture: "Qwen3ForCausalLM",
    artifactClass: "base-model-or-specialist-model",
    vocabularySize: 151936,
    contextLength: 40960,
    embeddingSize: 1024,
    feedForwardSize: 3072,
    layerCount: 28,
    headCount: 16,
    kvHeadCount: 8,
    headDimension: 128,
    ropeThetaBits: "0x49742400",
    normalizationEpsilonBits: "0x358637bd",
    tiedEmbeddings: true,
    qkvBias: false,
    qkNormalization: true,
    maximumSlm2Bytes: 2147483648,
    maximumTensorCount: 2048
  });
});

test("binds exactly six ordered artifacts and their format authorities", () => {
  assert.deepEqual(profile.artifacts.map((artifact) => artifact.ordinal),
    [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(profile.artifacts.map((artifact) => artifact.kind), [
    "slm2", "tokenizer2", "template2", "sampling2", "prompt2", "acg2"
  ]);
  assert.deepEqual(profile.artifacts.map((artifact) => artifact.file), [
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  assert.equal(new Set(profile.artifacts.map((artifact) => artifact.file)).size,
    6);
  assert.equal(profile.artifacts[0].formatProfileSha256,
    "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8");
  assert.equal(profile.artifacts[1].requiredBytes, 7038773);
  assert.equal(profile.artifacts[1].requiredSha256,
    "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b");
  assert.equal(profile.artifacts[2].requiredSha256,
    "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8");
  assert.equal(profile.artifacts[3].requiredSha256,
    "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89");
  assert.equal(profile.artifacts[4].requiredSha256,
    "27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3");
  assert.equal(profile.artifacts[5].requiredBytes, 896);
});

test("defines one create-only terminal transaction with bounded resources", () => {
  assert.deepEqual(profile.evidenceFiles, {
    attempt: "composition.attempt.json",
    modelReceipt: "model.slm2.conversion-receipt.json",
    tokenizerReceipt: "tokenizer.tokenizer2.conversion-receipt.json",
    terminalRejection: "composition.rejection.json",
    terminalPass: "composition.conversion-receipt.json",
    terminalFilesAreMutuallyExclusive: true,
    terminalFileIsWrittenLast: true
  });
  assert.equal(profile.transaction.writeMode, "create-only");
  assert.equal(profile.transaction.cleanupOnFailure, false);
  assert.equal(profile.transaction.resumeRule,
    "existing-output-root-is-terminal-and-never-resumed");
  assert.equal(profile.transaction.successRule,
    "command-exits-zero-and-terminal-pass-receipt-exists-and-terminal-rejection-is-absent");
  assert.ok(profile.transaction.independentVerification.includes(
    "validate-prompt-model-vocabulary-and-context"));
  assert.ok(profile.transaction.independentVerification.includes(
    "resolve-acg2-members-one-at-a-time"));
  assert.equal(profile.resourcePolicy.memberHashBufferBytes, 1048576);
  assert.equal(profile.resourcePolicy.maximumResidentDependencyBytes, 83886080);
  assert.equal(profile.resourcePolicy.maximumOutputFiles, 12);
});

test("separates structural conversion from every later product claim", () => {
  assert.deepEqual(profile.receiptClaims, {
    structuralComposition: "verified",
    modelQuality: "not-assessed-by-converter",
    sourceFrameworkParity: "not-assessed-by-converter",
    nativeRuntime: "not-assessed-by-converter",
    browserWasm: "not-assessed-by-converter",
    browserChat: "not-assessed-by-converter",
    p2pAvailability: "not-assessed-by-converter",
    publication: "not-assessed-by-converter"
  });
  assert.equal(profile.requiredNextGate,
    "source-native-browser-numerical-parity-untouched-quality-and-product-chat");
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("contains no credential or forbidden drive reference", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
