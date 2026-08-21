"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  formatVectorPath,
  renderRuntimeVectors,
  runtimeVectorPath
} = require("../tools/slm2-runtime-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const generatorPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/slm2-runtime-reference.js"
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function f32Sha256(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return sha256(bytes);
}

test("freezes independently generated SLM2 scalar runtime vectors", () => {
  const generatorBytes = fs.readFileSync(generatorPath);
  const vectorBytes = fs.readFileSync(runtimeVectorPath);
  const vectors = parseStrictJson(vectorBytes);
  assert.equal(generatorBytes.length, 16_511);
  assert.equal(sha256(generatorBytes),
    "df0b51548dce1a7174166479504a35fe6f5b256dd3168cae970ac8c1df7257b9");
  assert.equal(vectorBytes.length, 48_369);
  assert.equal(sha256(vectorBytes),
    "c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1");
  assert.deepEqual(vectorBytes, renderRuntimeVectors());
  assert.equal(vectors.oracle.sourceSha256, sha256(generatorBytes));
  assert.equal(vectors.schema, "tinyrustlm.vnext.slm2-runtime-vectors.v1");
});

test("binds vectors to the canonical format artifact and explicit f32 arithmetic", () => {
  const formatVectors = parseStrictJson(fs.readFileSync(formatVectorPath));
  const vectors = parseStrictJson(fs.readFileSync(runtimeVectorPath));
  const canonical = formatVectors.vectors.find((entry) =>
    entry.id === vectors.sourceFormatVector.id);
  assert.ok(canonical);
  assert.equal(vectors.sourceFormatVector.artifactSha256, canonical.artifactSha256);
  assert.equal(vectors.sourceFormatVector.artifactByteLength, canonical.artifactByteLength);
  assert.equal(vectors.sourceFormatVector.formatProfileSha256, formatVectors.profileSha256);
  assert.equal(vectors.arithmeticProfile,
    "explicit-ieee754-f32-rounding-after-each-scalar-operation");
  assert.deepEqual(vectors.numericalTolerance, { absolute: 0.002, relative: 0.00002 });
});

test("covers positions, exact KV growth, stages, logits, and generation state", () => {
  const vectors = parseStrictJson(fs.readFileSync(runtimeVectorPath));
  assert.deepEqual(vectors.sequences.map((entry) => entry.inputTokens), [
    [0],
    [1, 2],
    [31, 0, 31]
  ]);
  assert.equal(vectors.sequences.reduce((sum, entry) => sum + entry.steps.length, 0), 6);
  for (const sequence of vectors.sequences) {
    sequence.steps.forEach((step, index) => {
      assert.equal(step.tokenId, sequence.inputTokens[index]);
      assert.equal(step.positionBefore, index);
      assert.equal(step.positionAfter, index + 1);
      assert.equal(step.committedKvBytes, (index + 1) * 64);
      assert.ok(Number.isInteger(step.greedyToken)
        && step.greedyToken >= 0 && step.greedyToken < vectors.modelSpec.vocabularySize);
      assert.equal(step.logits.values.length, vectors.modelSpec.vocabularySize);
      assert.equal(step.logits.f32LeSha256, f32Sha256(step.logits.values));
      assert.equal(step.trace.layers.length, vectors.modelSpec.layerCount);
      for (const encoded of [
        step.trace.embedding,
        step.trace.finalNormalized,
        ...Object.values(step.trace.layers[0])
      ]) {
        assert.ok(encoded.values.every(Number.isFinite));
        assert.equal(encoded.f32LeSha256, f32Sha256(encoded.values));
      }
    });
  }
  assert.deepEqual(vectors.generationCases, [
    {
      finalPosition: 4,
      id: "bounded-three-token-generation",
      maximumNewTokens: 3,
      outputTokens: [31, 31, 31],
      promptTokens: [1],
      requiredMaximumPosition: 4,
      stopTokens: []
    },
    {
      finalPosition: 2,
      id: "first-generated-token-is-stop",
      maximumNewTokens: 3,
      outputTokens: [31],
      promptTokens: [1],
      requiredMaximumPosition: 4,
      stopTokens: [31]
    }
  ]);
});

test("keeps the reference oracle isolated from Rust, network, and process execution", () => {
  const source = fs.readFileSync(generatorPath, "utf8");
  assert.doesNotMatch(source,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|worker_threads)/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
  assert.doesNotMatch(source, /tinyrustlm-slm2-runtime|cargo\s|rustc\s|\.exe\b/iu);
});
