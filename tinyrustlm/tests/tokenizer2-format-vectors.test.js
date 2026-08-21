"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { TextDecoder } = require("node:util");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  Tokenizer2ReferenceError,
  applyMutation,
  decodeTokens,
  encodeText,
  parseTokenizer2,
  pretokenizeText,
  sha256Hex,
  strictHex
} = require("../tools/tokenizer2-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/tokenizer2-format-vectors.v1.json"
);
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/tokenizer2-format-profile.v1.json"
);
const oraclePath = path.join(repositoryRoot, "tinyrustlm/tools/tokenizer2-reference.js");
const vectorBytes = fs.readFileSync(vectorPath);
const profileBytes = fs.readFileSync(profilePath);
const vectors = parseStrictJson(vectorBytes);
const profile = parseStrictJson(profileBytes);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function sourceSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function canonical() {
  assert.equal(vectors.vectors.length, 1);
  const vector = vectors.vectors[0];
  return { vector, artifact: strictHex(vector.artifactHex) };
}

test("binds independently generated vectors to the exact profile and oracle", () => {
  assert.deepEqual(Object.keys(vectors).sort(), [
    "independentOracle",
    "oracleScope",
    "profileId",
    "profileSha256",
    "schema",
    "vectors"
  ]);
  assert.equal(vectors.schema, "tinyrustlm.vnext.tokenizer2-format-vectors.v1");
  assert.equal(vectors.profileId, "org.minimodel.tokenizer2/2.0");
  assert.equal(vectors.profileId, profile.profileId);
  assert.equal(vectors.profileSha256, sha256Hex(profileBytes));
  assert.equal(vectors.independentOracle.implementation,
    "tinyrustlm/tools/tokenizer2-reference.js");
  assert.equal(vectors.independentOracle.sourceSha256, sourceSha256(oraclePath));
  assert.deepEqual(vectors.independentOracle.roles,
    ["vector-generator", "writer", "parser", "encoder", "decoder"]);
  assert.deepEqual(vectors.oracleScope, {
    normalization: "frozen-vector-code-points-stable-across-unicode-9-through-17",
    pretokenization: "frozen-vector-code-points-only",
    claimBeyondVectors: false
  });
});

test("independently parses the canonical artifact and exact section closure", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTokenizer2(artifact);
  assert.equal(vector.id, "qwen-bytelevel-bpe-canonical-miniature");
  assert.equal(artifact.length, vector.artifactByteLength);
  assert.equal(parsed.identity.byteLength, vector.artifactByteLength);
  assert.equal(parsed.identity.sha256, vector.artifactSha256);
  assert.equal(sha256Hex(artifact), vector.artifactSha256);
  assert.deepEqual({
    headerBytes: 192,
    versionMajor: 2,
    versionMinor: 0,
    algorithmProfile: 1,
    fileSize: parsed.header.fileSize,
    tokenTableOffset: parsed.header.tokenTableOffset,
    tokenCount: parsed.header.tokenCount,
    tokenRecordBytes: 24,
    mergeTableOffset: parsed.header.mergeTableOffset,
    mergeCount: parsed.header.mergeCount,
    mergeRecordBytes: 16,
    byteTableOffset: parsed.header.byteTableOffset,
    byteTableLength: parsed.header.byteTableLength,
    baseTokenCount: parsed.header.baseTokenCount,
    addedTokenCount: parsed.header.addedTokenCount,
    bosTokenId: parsed.header.bosTokenId,
    eosTokenId: parsed.header.eosTokenId,
    padTokenId: parsed.header.padTokenId,
    unkTokenId: null,
    maximumTokenBytes: parsed.header.maximumTokenBytes
  }, vector.header);
  assert.equal(parsed.records.length, 277);
  assert.equal(parsed.merges.size, 15);
  assert.equal(parsed.addedTokens.length, 6);
  assert.deepEqual(parsed.addedTokens.map((entry) => ({
    id: entry.id,
    utf8Hex: entry.tokenBytes.toString("hex"),
    special: (entry.flags & 2) !== 0
  })).sort((left, right) => left.id - right.id), vector.addedTokens);
});

test("independent frozen-expression scanner matches every source-oracle boundary", () => {
  const { vector } = canonical();
  assert.equal(vector.pretokenCases.length, 11);
  for (const entry of vector.pretokenCases) {
    const input = utf8Decoder.decode(strictHex(entry.normalizedInputUtf8Hex));
    const actual = pretokenizeText(input).map((piece) =>
      Buffer.from(piece, "utf8").toString("hex"));
    assert.deepEqual(actual, entry.expectedPieceUtf8Hex, entry.id);
    assert.equal(actual.join(""), entry.normalizedInputUtf8Hex, entry.id);
  }
});

test("independent normalization, added matching, and ranked BPE match all encodings", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTokenizer2(artifact);
  assert.equal(vector.encodingCases.length, 12);
  for (const entry of vector.encodingCases) {
    const input = utf8Decoder.decode(strictHex(entry.inputUtf8Hex));
    assert.deepEqual(encodeText(parsed, input), entry.expectedTokenIds, entry.id);
  }
});

test("independent decode modes preserve exact bytes and reject invalid output", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTokenizer2(artifact);
  assert.equal(vector.decodingCases.length, 4);
  for (const entry of vector.decodingCases) {
    if (entry.expectedError === null) {
      const output = decodeTokens(parsed, entry.tokenIds, entry.mode);
      assert.equal(output.toString("hex"), entry.expectedUtf8Hex, entry.id);
    } else {
      assert.throws(
        () => decodeTokens(parsed, entry.tokenIds, entry.mode),
        (error) => error instanceof Tokenizer2ReferenceError &&
          error.code === entry.expectedError,
        entry.id
      );
    }
  }
});

test("independent parser rejects each targeted mutation with the frozen code", () => {
  const { vector, artifact } = canonical();
  assert.equal(vector.mutations.length, 13);
  for (const mutation of vector.mutations) {
    assert.throws(
      () => parseTokenizer2(applyMutation(artifact, mutation)),
      (error) => error instanceof Tokenizer2ReferenceError &&
        error.code === mutation.expectedError,
      mutation.id
    );
  }
});

test("independent parser rejects every truncated canonical prefix", () => {
  const { vector, artifact } = canonical();
  assert.deepEqual(vector.truncation, {
    operation: "every-prefix-length",
    startInclusive: 0,
    endExclusive: artifact.length,
    expected: "reject"
  });
  for (let length = vector.truncation.startInclusive;
    length < vector.truncation.endExclusive; length += 1) {
    assert.throws(
      () => parseTokenizer2(artifact.subarray(0, length)),
      (error) => error instanceof Tokenizer2ReferenceError,
      `prefix ${length}`
    );
  }
});

test("independent oracle has no Rust, subprocess, or network execution path", () => {
  const source = fs.readFileSync(oraclePath, "utf8");
  assert.doesNotMatch(source,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|worker_threads)/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
  assert.doesNotMatch(source, /\b(?:cargo|rustc)\b|\.exe\b/iu);
  assert.doesNotMatch(source, /tinyrustlm-tokenizer2/u);
});
