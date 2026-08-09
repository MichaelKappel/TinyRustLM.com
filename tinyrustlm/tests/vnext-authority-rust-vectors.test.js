"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  verifyVnextAuthorityGraph
} = require("../tools/vnext-signature-authority.js");
const {
  renderVectorCorpus,
  seedPath,
  vectorPath
} = require("../tools/vnext-authority-rust-vectors.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const generatorPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vnext-authority-rust-vectors.js"
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decode(value) {
  const bytes = Buffer.from(value, "base64");
  assert.equal(bytes.toString("base64"), value);
  return bytes;
}

function inputFrom(entry) {
  return {
    campaignId: entry.campaignId,
    environment: entry.environment,
    verificationTimeUtc: entry.verificationTimeUtc,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    receiptBytes: entry.receiptBytesBase64.map(decode),
    subjectBytes: entry.subjectBytesBase64.map(decode)
  };
}

test("freezes deterministic public-only Rust authority graph vectors", () => {
  const seedBytes = fs.readFileSync(seedPath);
  const vectorBytes = fs.readFileSync(vectorPath);
  const source = fs.readFileSync(generatorPath, "utf8");
  const seed = parseStrictJson(seedBytes);
  const vectors = parseStrictJson(vectorBytes);
  assert.equal(seedBytes.length, 171_656);
  assert.equal(sha256(seedBytes),
    "80eb5d068bee339b5562c5cbd16c6f546e430895d6c6fb4c1172a36b4786197e");
  assert.equal(vectorBytes.length, 434_761);
  assert.equal(sha256(vectorBytes),
    "bf649b31e75c6ca6d4ec6587e760bbdd43b2e87bdcc7db7ed75fcc4ce787c757");
  assert.deepEqual(vectorBytes, renderVectorCorpus());
  assert.equal(seed.acceptedCases.length, 7);
  assert.equal(seed.rejectionCases.length, 6);
  assert.equal(vectors.acceptedCases.length, 9);
  assert.equal(vectors.rejectionCases.length, 26);
  assert.equal(new Set(vectors.acceptedCases.map((entry) => entry.name)).size, 9);
  assert.equal(new Set(vectors.rejectionCases.map((entry) => entry.name)).size, 26);
  assert.equal(vectors.publicSeedSha256, sha256(seedBytes));
  assert.doesNotMatch(Buffer.concat([seedBytes, vectorBytes]).toString("utf8"),
    /privateKey|private-key|pkcs8|secretKey|BEGIN [^-]*PRIVATE KEY/iu);
  assert.doesNotMatch(source,
    /generateKeyPair|createPrivateKey|crypto\.sign|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("replays every accepted and rejected authority graph through Node", () => {
  const vectors = parseStrictJson(fs.readFileSync(vectorPath));
  for (const entry of vectors.acceptedCases) {
    const result = verifyVnextAuthorityGraph(inputFrom(entry));
    const resultBytes = canonicalizeVnextJcsBytes(result);
    assert.deepEqual(resultBytes, decode(entry.resultBytesBase64), entry.name);
    assert.equal(sha256(resultBytes), entry.resultSha256, entry.name);
  }
  for (const entry of vectors.rejectionCases) {
    assert.throws(() => verifyVnextAuthorityGraph(inputFrom(entry)),
      (error) => error?.code === entry.expectedErrorCode, entry.name);
  }
});

test("documents Rust graph parity without claiming offline or live authority", () => {
  const graphDocumentName = "vnext-rust-authority-graph-parity.md";
  const graphDocument = fs.readFileSync(path.join(
    repositoryRoot,
    "docs/architecture",
    graphDocumentName
  ), "utf8");
  const linkedDocuments = [
    "contracts/vnext/README.md",
    "docs/architecture/vnext-contract-inventory.md",
    "docs/architecture/vnext-signature-authority.md"
  ].map((name) => fs.readFileSync(path.join(repositoryRoot, name), "utf8"));

  assert.match(graphDocument, /434,761 bytes/u);
  assert.match(graphDocument,
    /7340f17c34b2f86dcd4c2431d1de7ed8d36429badd51866c8abbff3b0f0fa89a/u);
  assert.match(graphDocument, /nine accepted graphs and 26 rejection/u);
  assert.match(graphDocument, /not an offline\s+bundle membership or closure proof/u);
  assert.match(graphDocument, /0\/20 qualified model hashes/u);
  assert.match(graphDocument, /every non-receipt identity family/u);
  for (const document of linkedDocuments) {
    assert.match(document, new RegExp(graphDocumentName.replace(".", "\\."), "u"));
  }
});
