"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const files = {
  tokenizerProfile: "contracts/vnext/qwen-tokenizer2-conversion-profile.v2.json",
  compositionProfile: "contracts/vnext/qwen3-composition-conversion-profile.v4.json",
  rustTokenizer: "rust/crates/tinyrustlm-convert/src/qwen_tokenizer2.rs",
  rustComposition: "rust/crates/tinyrustlm-convert/src/qwen3_composition.rs",
  managedConversion: "dotnet/src/TinyRustLM.Conversion/TinyRustLmConversionTool.cs",
  managedFixture: "dotnet/tools/TinyRustLM.ConversionFixtureTool/Program.cs",
  managedSample: "dotnet/samples/TinyRustLM.ConsoleSample/Program.cs"
};

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath));
}

function text(relativePath) {
  return read(relativePath).toString("utf8");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const tokenizerProfileBytes = read(files.tokenizerProfile);
const tokenizerProfile = JSON.parse(tokenizerProfileBytes.toString("utf8"));
const compositionProfileBytes = read(files.compositionProfile);
const compositionProfile = JSON.parse(compositionProfileBytes.toString("utf8"));

test("Rust writer owns one exact dot-tokenizer2 path and receipt contract", () => {
  const source = text(files.rustTokenizer);
  assert.match(source,
    /QWEN_TOKENIZER2_CONVERSION_PROFILE_ID[^;]+qwen-bytelevel-to-tokenizer2\/2/su);
  assert.match(source,
    /97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4/u);
  assert.match(source, /qwen-tokenizer2-conversion-profile\.v2\.json/u);
  assert.match(source,
    /QWEN_TOKENIZER2_FILE_EXTENSION:\s*&str\s*=\s*"tokenizer2"/u);
  assert.match(source,
    /QWEN_TOKENIZER2_COMPOSITION_FILE:\s*&str\s*=\s*"tokenizer\.tokenizer2"/u);
  assert.match(source, /qwen_tokenizer2_conversion_receipt\.v2/u);
  assert.doesNotMatch(source,
    /qwen-bytelevel-to-tokenizer2\/1|qwen_tokenizer2_conversion_receipt\.v1|qwen-tokenizer2-conversion-profile\.v1\.json|Some\("tok2"\)/u);
});

test("composition and managed owners bind only profile four", () => {
  const owners = [
    files.rustComposition,
    files.managedConversion,
    files.managedFixture
  ];
  for (const owner of owners) {
    const source = text(owner);
    assert.match(source, /qwen3-complete-composition-conversion\/4/u, owner);
    assert.match(source,
      /19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8/u,
      owner);
    assert.doesNotMatch(source,
      /qwen3-complete-composition-conversion\/[123]|c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0/u,
      owner);
  }
  const rust = text(files.rustComposition);
  assert.match(rust, /qwen3-composition-conversion-profile\.v4\.json/u);
  assert.match(rust, /QWEN_TOKENIZER2_COMPOSITION_FILE/u);
  assert.match(rust, /QWEN_TOKENIZER2_CONVERSION_RECEIPT_SCHEMA/u);
  assert.doesNotMatch(rust, /qwen_tokenizer2_conversion_receipt\.v1/u);
});

test("machine profiles and executable owners agree exactly", () => {
  assert.equal(tokenizerProfile.profileId,
    "tinyrustlm.qwen-bytelevel-to-tokenizer2/2");
  assert.equal(sha256(tokenizerProfileBytes),
    "97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4");
  assert.equal(compositionProfile.profileId,
    "tinyrustlm.qwen3-complete-composition-conversion/4");
  assert.equal(sha256(compositionProfileBytes),
    "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8");
  assert.equal(compositionProfile.tokenizerReceiptContract.schema,
    tokenizerProfile.receipt.schema);
  assert.equal(compositionProfile.tokenizerReceiptContract.producerProfileId,
    tokenizerProfile.profileId);
  assert.equal(compositionProfile.tokenizerReceiptContract.producerProfileSha256,
    sha256(tokenizerProfileBytes));
  assert.equal(compositionProfile.tokenizerReceiptContract.requiredFile,
    "tokenizer.tokenizer2");
  assert.equal(compositionProfile.tokenizerReceiptContract.obsoleteFileSuffixAccepted,
    false);
});

test("user-facing sample names the sole current artifact suffix", () => {
  const source = text(files.managedSample);
  assert.match(source, /<tokenizer\.tokenizer2>/u);
  assert.doesNotMatch(source, /\.tok2/u);
});

test("the clean cut contains no compatibility selector or fallback", () => {
  const production = [
    files.rustTokenizer,
    files.rustComposition,
    files.managedConversion,
    files.managedFixture
  ].map(text).join("\n");
  assert.doesNotMatch(
    production,
    /legacyTokenizer|legacyComposition|acceptTok2|acceptProfileV[123]|profileAlias|suffixAlias|fallbackProfile|migrateProfile/iu
  );
});
