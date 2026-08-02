"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  HEADER_BYTES,
  MEMBER_BYTES,
  activeGraphDigest,
  expectedManifestBytes,
  expectedManifestSha256,
  manifestPath,
  parseCompositionBundle,
  promptTokenSequence,
  sha256,
  validateManifest,
  validateManifestFile
} = require("../tools/atomic-composition-activation-preregistration.js");

/** Creates an isolated JSON-compatible copy for mutation tests. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Parses a structurally mutated bundle with its new caller-supplied hash. */
function parseMutation(bytes, context) {
  return parseCompositionBundle(bytes, sha256(bytes), context);
}

test("validates the frozen atomic composition activation contract", () => {
  const result = validateManifestFile();
  assert.equal(
    result.manifest.experimentId,
    "atomic-specialist-composition-activation-20260725"
  );
  assert.equal(result.manifest.wireFormat.magic, "ACG1");
  assert.equal(result.manifest.headerFields.length, 27);
  assert.equal(result.manifest.memberFields.length, 7);
  assert.equal(result.materialized.bundles.size, 4);
  assert.equal(result.bytes, expectedManifestBytes);
  assert.equal(result.sha256, expectedManifestSha256);
});

test("rebuilds and independently parses all four canonical bundles", () => {
  const result = validateManifestFile();
  for (const entry of result.manifest.testVector.compositions) {
    const bundle = result.materialized.bundles.get(entry.name);
    assert.equal(bundle.built.bytes.length, entry.bundleBytes);
    assert.equal(bundle.built.sha256, entry.bundleSha256);
    assert.equal(bundle.built.activeGraphDigest, entry.activeGraphDigest);
    assert.equal(
      bundle.parsed.composition.id.display,
      entry.compositionTypedId
    );
    assert.equal(bundle.parsed.memberCount, entry.memberNames.length);
  }
});

test("canonicalizes additive members by full typed content identity", () => {
  const result = validateManifestFile();
  const combined = result.materialized.compositions.get("A+B");
  assert.deepEqual(
    combined.identity.members.map((member) => member.adapter.id.display),
    combined.manifest.canonicalMemberTypedIds
  );
  assert.deepEqual(combined.manifest.memberNames, ["B", "A"]);
});

test("parses both embedded SLO1 packages before graph publication", () => {
  const result = validateManifestFile();
  const overlayA = result.materialized.overlaysByName.get("A");
  const overlayB = result.materialized.overlaysByName.get("B");
  assert.equal(overlayA.parsed.targets.length, 1);
  assert.equal(overlayA.parsed.maximumFactorRank, 2);
  assert.equal(overlayB.parsed.targets.length, 1);
  assert.equal(overlayB.parsed.maximumFactorRank, 1);
});

test("recomputes prompt material active graph and composition KV key", () => {
  const result = validateManifestFile();
  const prompt = result.manifest.testVector.promptSequence;
  const calculated = promptTokenSequence(prompt.tokens);
  assert.equal(calculated.material.toString("hex"), prompt.materialHex);
  assert.equal(calculated.sha256, prompt.sha256);
  assert.equal(
    result.materialized.compositionAKvCacheKey,
    prompt.compositionAKvCacheKey
  );

  const compositionA = result.materialized.compositions.get("A").identity;
  assert.equal(
    activeGraphDigest({
      compositionId: compositionA.id,
      routePolicyId: result.materialized.route.id,
      kvFormatId: result.materialized.kv.id,
      positionPolicySha256:
        result.materialized.positionPolicySha256
    }),
    result.manifest.testVector.compositions[1].activeGraphDigest
  );
});

test("rejects caller hash envelope and active graph mutations", () => {
  const result = validateManifestFile();
  const original = result.materialized.bundles.get("A").built.bytes;

  assert.throws(
    () => parseCompositionBundle(
      original,
      "f".repeat(64),
      result.materialized
    ),
    /bundle SHA-256 does not match/u
  );

  const magic = Buffer.from(original);
  magic[0] = 0;
  assert.throws(
    () => parseMutation(magic, result.materialized),
    /bundle magic is invalid/u
  );

  const graph = Buffer.from(original);
  graph[464] ^= 1;
  assert.throws(
    () => parseMutation(graph, result.materialized),
    /active graph digest does not match/u
  );
});

test("rejects nonzero padding package corruption and byte-count drift", () => {
  const result = validateManifestFile();
  const original = result.materialized.bundles.get("A").built.bytes;

  const reserved = Buffer.from(original);
  reserved[496] = 1;
  assert.throws(
    () => parseMutation(reserved, result.materialized),
    /bundle reserved1 is nonzero/u
  );

  const packageCorruption = Buffer.from(original);
  const packageOffset = Number(packageCorruption.readBigUInt64LE(
    HEADER_BYTES + 72
  ));
  packageCorruption[packageOffset] = 0;
  assert.throws(
    () => parseMutation(packageCorruption, result.materialized),
    /package SHA-256 does not match/u
  );

  const accounting = Buffer.from(original);
  accounting.writeBigUInt64LE(575n, 448);
  assert.throws(
    () => parseMutation(accounting, result.materialized),
    /byte accounting does not match/u
  );
});

test("rejects duplicate identities aliases and parsed metadata drift", () => {
  const result = validateManifestFile();
  const original =
    result.materialized.bundles.get("A+B").built.bytes;

  const duplicate = Buffer.from(original);
  duplicate.copy(
    duplicate,
    HEADER_BYTES + MEMBER_BYTES,
    HEADER_BYTES,
    HEADER_BYTES + 40
  );
  assert.throws(
    () => parseMutation(duplicate, result.materialized),
    /not strictly increasing/u
  );

  const alias = Buffer.from(original);
  alias.writeBigUInt64LE(
    alias.readBigUInt64LE(HEADER_BYTES + 72),
    HEADER_BYTES + MEMBER_BYTES + 72
  );
  assert.throws(
    () => parseMutation(alias, result.materialized),
    /member 1 range is invalid/u
  );

  const metadata = Buffer.from(original);
  metadata.writeUInt32LE(63, HEADER_BYTES + 92);
  assert.throws(
    () => parseMutation(metadata, result.materialized),
    /parsed metadata does not match/u
  );
});

test("rejects clean-slate contract drift and authority inflation", () => {
  const manifest = validateManifestFile().manifest;

  const compatibility = clone(manifest);
  compatibility.scope.acceptedLegacyMagics.push("ALR1");
  assert.throws(
    () => validateManifest(compatibility),
    /manifest scope contract is invalid/u
  );

  const mutation = clone(manifest);
  mutation.scope.mutableBaseTensorUpdatesPermitted = true;
  assert.throws(
    () => validateManifest(mutation),
    /manifest scope contract is invalid/u
  );

  const authority = clone(manifest);
  authority.authority.runtimeActivationClaimed = true;
  assert.throws(
    () => validateManifest(authority),
    /manifest authority contract is invalid/u
  );
});

test("rejects unknown fields and noncanonical manifest bytes", () => {
  const manifest = validateManifestFile().manifest;
  const unknown = clone(manifest);
  unknown.compatibilityVersion = 1;
  assert.throws(() => validateManifest(unknown), /manifest keys/u);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-prereg-"));
  const filePath = path.join(root, "manifest.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(manifest));
    assert.throws(
      () => validateManifestFile(filePath),
      /not canonical/u
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  assert.equal(fs.existsSync(manifestPath), true);
});
