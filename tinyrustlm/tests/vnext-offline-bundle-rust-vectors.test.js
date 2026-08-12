"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  offlineBundleProfileSha256,
  verifyVnextOfflineBundle
} = require("../tools/vnext-offline-bundle.js");
const {
  renderVectorCorpus,
  seedPath,
  vectorPath
} = require("../tools/vnext-offline-bundle-rust-vectors.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const generatorPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vnext-offline-bundle-rust-vectors.js"
);
const vectorParserLimits = Object.freeze({
  maximumBytes: 4 * 1024 * 1024,
  maximumDepth: 16,
  maximumTotalEntries: 131_072,
  maximumObjectMembers: 32,
  maximumArrayItems: 4096,
  maximumStringCodeUnits: 4 * 1024 * 1024,
  maximumTotalStringCodeUnits: 4 * 1024 * 1024,
  maximumNumberCharacters: 32
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decode(value) {
  const bytes = Buffer.from(value, "base64");
  assert.equal(bytes.toString("base64"), value);
  return bytes;
}

function parseVectors(bytes) {
  return parseStrictJson(bytes, vectorParserLimits);
}

function inputFrom(entry) {
  return {
    bundleManifestBytes: decode(entry.bundleManifestBytesBase64),
    expectedBundleManifestSha256: entry.expectedBundleManifestSha256,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    receiptBytes: entry.receiptBytesBase64.map(decode),
    subjectBytes: entry.subjectBytesBase64.map(decode),
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationReceiptBytes: decode(entry.verificationReceiptBytesBase64),
    verificationTimeUtc: entry.verificationTimeUtc
  };
}

test("freezes deterministic public-only Rust offline-bundle vectors", () => {
  const seedBytes = fs.readFileSync(seedPath);
  const vectorBytes = fs.readFileSync(vectorPath);
  const source = fs.readFileSync(generatorPath, "utf8");
  const vectors = parseVectors(vectorBytes);

  assert.equal(seedBytes.length, 171_656);
  assert.equal(sha256(seedBytes),
    "80eb5d068bee339b5562c5cbd16c6f546e430895d6c6fb4c1172a36b4786197e");
  assert.equal(vectorBytes.length, 658_110);
  assert.equal(sha256(vectorBytes),
    "6ff1b5745080fb4dc3135f4cb6a311f72669eb7179276160ed9976934a8c4bd4");
  assert.deepEqual(vectorBytes, renderVectorCorpus());
  assert.equal(vectors.schema,
    "tinyrustlm.vnext.offline_bundle_rust_vectors.v1");
  assert.equal(vectors.profileSha256, offlineBundleProfileSha256);
  assert.equal(vectors.authorityPublicSeedSha256, sha256(seedBytes));
  assert.equal(vectors.acceptedCases.length, 3);
  assert.equal(vectors.rejectionCases.length, 31);
  assert.equal(new Set(vectors.acceptedCases.map((entry) => entry.name)).size, 3);
  assert.equal(new Set(vectors.rejectionCases.map((entry) => entry.name)).size, 31);
  assert.doesNotMatch(Buffer.concat([seedBytes, vectorBytes]).toString("utf8"),
    /privateKey|private-key|pkcs8|secretKey|BEGIN [^-]*PRIVATE KEY/iu);
  assert.doesNotMatch(source,
    /generateKeyPair|createPrivateKey|crypto\.sign|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("replays every accepted and rejected offline bundle through Node", () => {
  const vectors = parseVectors(fs.readFileSync(vectorPath));
  for (const entry of vectors.acceptedCases) {
    const result = verifyVnextOfflineBundle(inputFrom(entry));
    const resultBytes = canonicalizeVnextJcsBytes(result);
    assert.deepEqual(resultBytes, decode(entry.resultBytesBase64), entry.name);
    assert.equal(sha256(resultBytes), entry.resultSha256, entry.name);
  }
  for (const entry of vectors.rejectionCases) {
    assert.throws(() => verifyVnextOfflineBundle(inputFrom(entry)),
      (error) => error?.code === entry.expectedErrorCode, entry.name);
  }
});

test("documents Rust offline closure without claiming release or live evidence", () => {
  const documentName = "vnext-rust-offline-bundle-parity.md";
  const document = fs.readFileSync(path.join(
    repositoryRoot,
    "docs/architecture",
    documentName
  ), "utf8");
  const linkedDocuments = [
    "contracts/vnext/README.md",
    "docs/architecture/vnext-contract-inventory.md",
    "docs/architecture/vnext-offline-verification-bundle.md",
    "docs/architecture/vnext-rust-authority-graph-parity.md"
  ].map((name) => fs.readFileSync(path.join(repositoryRoot, name), "utf8"));

  assert.match(document, /658,110 bytes/u);
  assert.match(document,
    /6ff1b5745080fb4dc3135f4cb6a311f72669eb7179276160ed9976934a8c4bd4/u);
  assert.match(document, /three accepted bundles and 31 rejection/u);
  assert.match(document, /does not\s+produce a campaign projection/u);
  assert.match(document, /0\/20 qualified model hashes/u);
  assert.match(document, /exact closed membership/u);
  for (const linkedDocument of linkedDocuments) {
    assert.match(linkedDocument, new RegExp(documentName.replace(".", "\\."), "u"));
  }
});
