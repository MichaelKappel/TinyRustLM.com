"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const paths = {
  profile: "contracts/vnext/qwen3-composition-conversion-profile.v3.json",
  modelLock: "contracts/vnext/qwen3-0.6b-base-source-lock.v1.json",
  tokenizerLock: "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json",
  rustModel: "rust/crates/tinyrustlm-convert/src/qwen3.rs",
  rustTokenizer: "rust/crates/tinyrustlm-convert/src/qwen_tokenizer2.rs",
  rustComposition: "rust/crates/tinyrustlm-convert/src/qwen3_composition.rs",
  managedConversion: "dotnet/src/TinyRustLM.Conversion/TinyRustLmConversionTool.cs",
  managedFixture: "dotnet/tools/TinyRustLM.ConversionFixtureTool/Program.cs"
};

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("all executable composition owners use only the corrected profile", () => {
  const executableOwners = [
    paths.rustComposition,
    paths.managedConversion,
    paths.managedFixture
  ];
  for (const owner of executableOwners) {
    const source = read(owner).toString("utf8");
    assert.match(
      source,
      /tinyrustlm\.qwen3-complete-composition-conversion\/3/u,
      owner
    );
    assert.match(
      source,
      /c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0/u,
      owner
    );
    assert.doesNotMatch(
      source,
      /tinyrustlm\.qwen3-complete-composition-conversion\/[12]|2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158|d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718/u,
      owner
    );
  }
  assert.match(
    read(paths.rustComposition).toString("utf8"),
    /qwen3-composition-conversion-profile\.v3\.json/u
  );
});

test("the current profile and accepted locks declare one compatible pair", () => {
  const profileBytes = read(paths.profile);
  const profile = JSON.parse(profileBytes.toString("utf8"));
  const modelLock = JSON.parse(read(paths.modelLock).toString("utf8"));
  const tokenizerLock = JSON.parse(read(paths.tokenizerLock).toString("utf8"));

  assert.equal(
    sha256(profileBytes),
    "c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0"
  );
  assert.deepEqual(profile.sourceRelationship.requiredEqualFields, [
    "modelId",
    "revision"
  ]);
  assert.equal(modelLock.modelId, tokenizerLock.modelId);
  assert.equal(modelLock.revision, tokenizerLock.revision);
  assert.equal(
    modelLock.architectureProfileId,
    profile.sourceRelationship.requiredArchitectureProfiles.model
  );
  assert.equal(
    tokenizerLock.architectureProfileId,
    profile.sourceRelationship.requiredArchitectureProfiles.tokenizer
  );
});

test("Rust sources share the exact model and tokenizer profile constants", () => {
  const modelSource = read(paths.rustModel).toString("utf8");
  const tokenizerSource = read(paths.rustTokenizer).toString("utf8");
  const compositionSource = read(paths.rustComposition).toString("utf8");

  assert.match(
    modelSource,
    /pub\(crate\) const QWEN3_ARCHITECTURE_PROFILE_ID[^;]+tinyrustlm\.qwen3-dense-gqa-qk-norm\/1/su
  );
  assert.match(
    tokenizerSource,
    /pub\(crate\) const QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID[^;]+tinyrustlm\.qwen3-tokenizer-source\/1/su
  );
  assert.match(
    compositionSource,
    /for field in \["modelId", "revision"\]/u
  );
  assert.match(
    compositionSource,
    /!= QWEN3_ARCHITECTURE_PROFILE_ID/u
  );
  assert.match(
    compositionSource,
    /!= QWEN3_TOKENIZER_ARCHITECTURE_PROFILE_ID/u
  );
  assert.doesNotMatch(
    compositionSource,
    /\["modelId", "revision", "architectureProfileId"\]/u
  );
});

test("the clean cut contains no compatibility selector", () => {
  const productionSources = [
    paths.rustComposition,
    paths.managedConversion,
    paths.managedFixture
  ].map((entry) => read(entry).toString("utf8")).join("\n");
  assert.doesNotMatch(
    productionSources,
    /legacyComposition|compositionProfileV1|acceptProfileV1|profileAlias|fallbackProfile|migrateProfile/iu
  );
});
