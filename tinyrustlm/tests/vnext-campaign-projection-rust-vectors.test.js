"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  campaignProjectionProfileSha256,
  projectVnextCampaign,
  validateCampaignProjectionResultBytes
} = require("../tools/vnext-campaign-projection.js");
const {
  renderVectorCorpus,
  seedPath,
  vectorPath
} = require("../tools/vnext-campaign-projection-rust-vectors.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const generatorPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vnext-campaign-projection-rust-vectors.js"
);
const vectorParserLimits = Object.freeze({
  maximumBytes: 8 * 1024 * 1024,
  maximumDepth: 32,
  maximumTotalEntries: 200_000,
  maximumObjectMembers: 64,
  maximumArrayItems: 8192,
  maximumStringCodeUnits: 8 * 1024 * 1024,
  maximumTotalStringCodeUnits: 8 * 1024 * 1024,
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

function indexBy(entries, key) {
  return new Map(entries.map((entry) => [entry[key], decode(entry.bytesBase64)]));
}

function inputFrom(entry, vectors) {
  const plans = indexBy(vectors.planWires, "name");
  const receipts = indexBy(vectors.receipts, "receiptId");
  const subjects = indexBy(vectors.subjects, "subjectId");
  return {
    campaignPlanBytes: plans.get(entry.planWireName),
    expectedCampaignPlanSha256: entry.expectedCampaignPlanSha256,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    receiptBytes: [
      ...entry.receiptIds.map((id) => receipts.get(id)),
      ...entry.receiptBytesBase64.map(decode)
    ],
    subjectBytes: [
      ...entry.subjectIds.map((id) => subjects.get(id)),
      ...entry.subjectBytesBase64.map(decode)
    ],
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationTimeUtc: entry.verificationTimeUtc
  };
}

test("freezes deterministic public-only Rust campaign-projection vectors", () => {
  const seedBytes = fs.readFileSync(seedPath);
  const vectorBytes = fs.readFileSync(vectorPath);
  const source = fs.readFileSync(generatorPath, "utf8");
  const vectors = parseVectors(vectorBytes);

  assert.equal(seedBytes.length, 1_024_171);
  assert.equal(sha256(seedBytes),
    "d4d6c823cae97b403a600e04b007a44ba2e849713616ef36c0eda1616f153788");
  assert.equal(vectorBytes.length, 1_494_464);
  assert.equal(sha256(vectorBytes),
    "8a72ac1b2e4abd944e41c1c53a7d475e350d961e7b627127404b0508cf654734");
  assert.deepEqual(vectorBytes, renderVectorCorpus());
  assert.equal(vectors.schema,
    "tinyrustlm.vnext.campaign_projection_rust_vectors.v1");
  assert.equal(vectors.profileSha256, campaignProjectionProfileSha256);
  assert.equal(vectors.publicSeedSha256, sha256(seedBytes));
  assert.equal(vectors.receipts.length, 277);
  assert.equal(vectors.subjects.length, 41);
  assert.equal(vectors.acceptedCases.length, 11);
  assert.equal(vectors.rejectionCases.length, 22);
  assert.equal(vectors.resultRejectionCases.length, 8);
  assert.equal(new Set(vectors.acceptedCases.map((entry) => entry.name)).size, 11);
  assert.equal(new Set(vectors.rejectionCases.map((entry) => entry.name)).size, 22);
  assert.equal(new Set(vectors.resultRejectionCases.map((entry) => entry.name)).size, 8);
  assert.doesNotMatch(Buffer.concat([seedBytes, vectorBytes]).toString("utf8"),
    /privateKey|private-key|pkcs8|secretKey|BEGIN [^-]*PRIVATE KEY/iu);
  assert.doesNotMatch(source,
    /generateKeyPair|createPrivateKey|crypto\.sign|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("replays every accepted and rejected campaign projection through Node", () => {
  const vectors = parseVectors(fs.readFileSync(vectorPath));
  for (const entry of vectors.acceptedCases) {
    const result = projectVnextCampaign(inputFrom(entry, vectors));
    assert.deepEqual(result.resultBytes, decode(entry.resultBytesBase64), entry.name);
    assert.equal(result.resultSha256, entry.resultSha256, entry.name);
  }
  for (const entry of vectors.rejectionCases) {
    assert.throws(() => projectVnextCampaign(inputFrom(entry, vectors)),
      (error) => error?.code === entry.expectedErrorCode, entry.name);
  }
});

test("replays projection result-wire rejection cases through Node", () => {
  const vectors = parseVectors(fs.readFileSync(vectorPath));
  const canonicalPlan = indexBy(vectors.planWires, "name").get("canonical");
  for (const entry of vectors.acceptedCases) {
    const result = validateCampaignProjectionResultBytes(
      decode(entry.resultBytesBase64),
      canonicalPlan
    );
    assert.deepEqual(result.resultBytes, decode(entry.resultBytesBase64), entry.name);
  }
  for (const entry of vectors.resultRejectionCases) {
    assert.throws(() => validateCampaignProjectionResultBytes(
      decode(entry.resultBytesBase64),
      canonicalPlan
    ), (error) => error?.code === entry.expectedErrorCode, entry.name);
  }
});

test("documents completed Rust projection parity without claiming live progress", () => {
  const documentName = "vnext-rust-campaign-projection-parity.md";
  const document = fs.readFileSync(path.join(
    repositoryRoot,
    "docs/architecture",
    documentName
  ), "utf8");
  const linkedDocuments = [
    "contracts/vnext/README.md",
    "docs/architecture/vnext-campaign-plan-projection.md",
    "docs/architecture/vnext-contract-inventory.md",
    "docs/architecture/vnext-rust-offline-bundle-parity.md"
  ].map((name) => fs.readFileSync(path.join(repositoryRoot, name), "utf8"));

  assert.match(document, /1,494,464 bytes/u);
  assert.match(document,
    /8a72ac1b2e4abd944e41c1c53a7d475e350d961e7b627127404b0508cf654734/u);
  assert.match(document, /11 accepted scenarios/u);
  assert.match(document, /22 projection-input rejection/u);
  assert.match(document, /8 projection-result rejection/u);
  assert.match(document, /0\/20 qualified model hashes/u);
  assert.match(document, /changes no production deployment-manifest member/u);
  for (const linkedDocument of linkedDocuments) {
    assert.match(linkedDocument, new RegExp(documentName.replace(".", "\\."), "u"));
  }
  assert.match(linkedDocuments[2],
    /Rust truthful projection and strict\s+projection-result validation now independently/u);
});
