"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const lockPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json"
);
const tokenizerLockPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json"
);
const converterProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen3-safetensors-conversion-profile.v2.json"
);

const lockBytes = fs.readFileSync(lockPath);
const lock = JSON.parse(lockBytes.toString("utf8"));
const tokenizerLock = JSON.parse(fs.readFileSync(tokenizerLockPath, "utf8"));
const converterProfile = JSON.parse(
  fs.readFileSync(converterProfilePath, "utf8")
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes the canonical public Qwen3 base source lock bytes", () => {
  assert.equal(lockBytes.length, 1901);
  assert.equal(
    sha256(lockBytes),
    "50a8c29e36398a9a088e4d9a224dad186809d34b1e050299d3ce3de7a01b7d0e"
  );
  assert.equal(lockBytes.toString("utf8"), `${JSON.stringify(lock, null, 2)}\n`);
  assert.deepEqual(Object.keys(lock), converterProfile.sourceLock.fields);
});

test("binds one exact reviewed upstream base identity and disposition", () => {
  assert.equal(lock.schema, "tinyrustlm.qwen3_source_lock.v1");
  assert.equal(lock.modelId, "Qwen/Qwen3-0.6B");
  assert.equal(lock.revision, "c1899de289a04d12100db370d81485cdf75e47ca");
  assert.equal(lock.sourceKind, "upstream-checkpoint");
  assert.equal(lock.artifactClass, "base-model");
  assert.equal(
    lock.architectureProfileId,
    "tinyrustlm.qwen3-dense-gqa-qk-norm/1"
  );
  assert.equal(lock.licenseSpdx, "Apache-2.0");
  assert.equal(
    lock.licenseDisposition,
    "redistribution-and-conversion-approved"
  );
  assert.equal(lock.modelId, converterProfile.authority.selectedBaseModel);
  assert.equal(lock.revision, converterProfile.authority.selectedBaseRevision);
  assert.equal(
    converterProfile.authority.selectedBaseProductStatus,
    "terminally-rejected-as-product-model"
  );
});

test("closes the source to the converter's exact nine regular files", () => {
  const fileKeys = [
    "config",
    "generationConfig",
    "license",
    "merges",
    "model",
    "readme",
    "tokenizer",
    "tokenizerConfig",
    "vocab"
  ];
  assert.deepEqual(Object.keys(lock.files), fileKeys);

  const sourcePaths = Object.values(lock.files).map((entry) => entry.path);
  assert.deepEqual(
    [...sourcePaths].sort(),
    [...converterProfile.sourceClosure.requiredFilesInExactDirectoryInventory]
      .sort()
  );
  assert.equal(new Set(sourcePaths).size, sourcePaths.length);
  assert.equal(
    Object.values(lock.files).reduce(
      (total, entry) => total + entry.byteLength,
      0
    ),
    1519207673
  );

  for (const entry of Object.values(lock.files)) {
    assert.deepEqual(
      Object.keys(entry),
      converterProfile.sourceLock.lockedFileRecord.fields
    );
    assert.equal(path.basename(entry.path), entry.path);
    assert.doesNotMatch(entry.path, /[\\/]/u);
    assert.ok(Number.isSafeInteger(entry.byteLength));
    assert.ok(entry.byteLength > 0);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  }
});

test("shares every tokenizer source byte identity with the accepted lock", () => {
  assert.equal(lock.modelId, tokenizerLock.modelId);
  assert.equal(lock.revision, tokenizerLock.revision);
  assert.equal(lock.sourceKind, tokenizerLock.sourceKind);

  for (const key of [
    "config",
    "merges",
    "tokenizer",
    "tokenizerConfig",
    "vocab"
  ]) {
    assert.deepEqual(lock.files[key], tokenizerLock.files[key], key);
  }
});

test("matches every base identity pinned by the converter profile", () => {
  for (const key of ["config", "model", "tokenizer"]) {
    assert.deepEqual(
      {
        byteLength: lock.files[key].byteLength,
        sha256: lock.files[key].sha256
      },
      converterProfile.sourceClosure.selectedBaseFileIdentities[key],
      key
    );
  }
});

test("current source lock agrees with training and browser acquisition on all nine files", () => {
  const profile = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
    "tinyrustlm/training/qwen3-0.6b-working-model-v1/profile.v1.json"), "utf8"));
  const capability = require("../app/companion-capability.js");
  for (const file of profile.source.files) {
    const current = Object.values(lock.files).find((entry) => entry.path === file.name);
    assert.deepEqual(current, {
      path: file.name, byteLength: file.bytes, sha256: file.sha256.slice(7)
    });
  }
  assert.equal(capability.SOURCE_DESCRIPTOR.modelSourceLockSha256, sha256(lockBytes));
  assert.equal(capability.SOURCE_DESCRIPTOR.maximumSourceBytes,
    profile.source.files.reduce((total, file) => total + file.bytes, 0));
});

test("license correction preserves the historical lock without admitting its source identity", () => {
  const historicalBytes = fs.readFileSync(path.join(repositoryRoot,
    "contracts/vnext/qwen3-0.6b-base-source-lock.v1.json"));
  assert.equal(sha256(historicalBytes),
    "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d");
  const historical = JSON.parse(historicalBytes);
  const different = Object.keys(lock.files).filter((name) =>
    JSON.stringify(lock.files[name]) !== JSON.stringify(historical.files[name]));
  assert.deepEqual(different, ["license"]);
  assert.equal(lock.files.license.byteLength, 11343);
  assert.equal(lock.files.license.sha256,
    "832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e");
});

test("contains no credential, private path, output, or success assertion", () => {
  const text = lockBytes.toString("utf8");
  assert.doesNotMatch(
    text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu
  );
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(
    text,
    /qualified|conversation-proven|browser-proven|published|campaignCounters/iu
  );
});
