"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  expectedDigests,
  expectedManifestBytes,
  expectedManifestSha256,
  manifestPath,
  requiredByteFields,
  validateManifest,
  validateManifestFile
} = require("../tools/content-identity-preregistration.js");

/** Creates an isolated JSON-compatible copy for mutation tests. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("validates the frozen clean-slate content identity contract", () => {
  const result = validateManifestFile();
  assert.equal(
    result.manifest.experimentId,
    "immutable-specialist-content-identity-20260725"
  );
  assert.equal(result.manifest.artifactKinds.length, 7);
  assert.equal(result.manifest.compositionSemantics.length, 5);
  assert.deepEqual(
    result.manifest.byteAccounting.requiredFields,
    requiredByteFields
  );
  assert.deepEqual(
    result.manifest.testVector.expectedDigests,
    expectedDigests
  );
  assert.equal(result.bytes, expectedManifestBytes);
  assert.equal(result.sha256, expectedManifestSha256);
});

test("rejects artifact kind, domain, tag, and field-order drift", () => {
  const manifest = validateManifestFile().manifest;

  const domain = clone(manifest);
  domain.artifactKinds[1].domain += "-changed";
  assert.throws(() => validateManifest(domain), /artifact kind 1 identity/u);

  const tag = clone(manifest);
  tag.artifactKinds[2].tag = 2;
  assert.throws(() => validateManifest(tag), /artifact kind 2 identity/u);

  const order = clone(manifest);
  [
    order.artifactKinds[0].fieldOrder[1],
    order.artifactKinds[0].fieldOrder[2]
  ] = [
    order.artifactKinds[0].fieldOrder[2],
    order.artifactKinds[0].fieldOrder[1]
  ];
  assert.throws(() => validateManifest(order), /canonical identity/u);
});

test("rejects composition semantic and byte-accounting drift", () => {
  const manifest = validateManifestFile().manifest;

  const semantic = clone(manifest);
  semantic.compositionSemantics[1].orderingRule =
    "declared-order-is-material";
  assert.throws(() => validateManifest(semantic),
    /composition semantic 1/u);

  const bytes = clone(manifest);
  bytes.byteAccounting.requiredFields.splice(1, 1);
  assert.throws(() => validateManifest(bytes),
    /byte accounting fields/u);
});

test("rejects vector changes and authority inflation", () => {
  const manifest = validateManifestFile().manifest;

  const vector = clone(manifest);
  vector.testVector.expectedDigests.kvCacheKey =
    "0".repeat(64);
  assert.throws(() => validateManifest(vector),
    /test vector expected digests/u);

  const hash = clone(manifest);
  hash.testVector.hashOctets.model = "0".repeat(64);
  assert.throws(() => validateManifest(hash),
    /test vector model/u);

  const authority = clone(manifest);
  authority.authority.runtimeCompositionImplemented = true;
  assert.throws(() => validateManifest(authority),
    /authority runtimeCompositionImplemented is inflated/u);
});

test("rejects unknown fields and noncanonical bytes", () => {
  const manifest = validateManifestFile().manifest;
  const unknown = clone(manifest);
  unknown.compatibilityVersion = 1;
  assert.throws(() => validateManifest(unknown), /manifest keys/u);

  const root = fs.mkdtempSync(
    require("node:path").join(require("node:os").tmpdir(),
      "content-identity-prereg-")
  );
  const filePath = require("node:path").join(root, "manifest.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(manifest));
    assert.throws(() => validateManifestFile(filePath),
      /not canonical/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  assert.equal(fs.existsSync(manifestPath), true);
});
