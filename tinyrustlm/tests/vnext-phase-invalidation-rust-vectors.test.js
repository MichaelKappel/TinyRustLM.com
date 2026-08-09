"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  classifyVnextPhaseReceipts,
  phaseInvalidationProfileSha256
} = require("../tools/vnext-phase-invalidation.js");
const {
  renderVectorCorpus,
  vectorPath
} = require("../tools/vnext-phase-invalidation-rust-vectors.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const generatorPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vnext-phase-invalidation-rust-vectors.js"
);
const architecturePath = path.join(
  repositoryRoot,
  "docs/architecture/vnext-rust-phase-invalidation-parity.md"
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decode(value) {
  const bytes = Buffer.from(value, "base64");
  assert.equal(bytes.toString("base64"), value);
  return bytes;
}

test("freezes deterministic language-neutral Rust currentness vectors", () => {
  const bytes = fs.readFileSync(vectorPath);
  const source = fs.readFileSync(generatorPath, "utf8");
  const corpus = parseStrictJson(bytes);

  assert.equal(bytes.length, 74_756);
  assert.equal(sha256(bytes),
    "904a51a9770b8497bf0f966b2f1e50edae9a3dc3680677878544b4ab6803aac3");
  assert.deepEqual(bytes, renderVectorCorpus());
  assert.equal(corpus.schema,
    "tinyrustlm.vnext.phase_invalidation_rust_vectors.v1");
  assert.equal(corpus.profileId, "tinyrustlm.vnext.phase-invalidation.v1");
  assert.equal(corpus.profileSha256, phaseInvalidationProfileSha256);
  assert.equal(corpus.cases.length, 4);
  assert.equal(corpus.rejectionCases.length, 9);
  assert.equal(new Set(corpus.cases.map((entry) => entry.name)).size, 4);
  assert.equal(new Set(corpus.rejectionCases.map((entry) => entry.name)).size, 9);
  assert.doesNotMatch(source,
    /JSON\.parse|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("replays every accepted and rejected currentness vector through Node", () => {
  const corpus = parseStrictJson(fs.readFileSync(vectorPath));
  for (const entry of corpus.cases) {
    const result = classifyVnextPhaseReceipts({
      campaignId: corpus.campaignId,
      receiptBytes: entry.receiptBytesBase64.map(decode)
    });
    assert.deepEqual(result.resultBytes, decode(entry.resultBytesBase64), entry.name);
    assert.equal(result.resultSha256, entry.resultSha256, entry.name);
  }
  for (const entry of corpus.rejectionCases) {
    assert.throws(() => classifyVnextPhaseReceipts({
      campaignId: entry.campaignId,
      receiptBytes: entry.receiptBytesBase64.map(decode)
    }), (error) => error?.code === entry.expectedErrorCode, entry.name);
  }
});

test("keeps the Rust currentness architecture record bound to exact evidence", () => {
  const text = fs.readFileSync(architecturePath, "utf8");
  assert.match(text,
    /d13eaf173a76229bbca401482459c07b6f591703a55523d3b216f984ba5370a3/u);
  assert.match(text,
    /904a51a9770b8497bf0f966b2f1e50edae9a3dc3680677878544b4ab6803aac3/u);
  assert.match(text, /Four accepted vector histories/u);
  assert.match(text, /Nine rejection vectors/u);
  assert.match(text,
    /0\/20 qualified model hashes,\s+0\/50 deletion-backed\s+browser rounds,\s+0\/25/u);
  assert.match(text,
    /This classifier is now consumed by the independent Rust authority\/projection/u);
});
