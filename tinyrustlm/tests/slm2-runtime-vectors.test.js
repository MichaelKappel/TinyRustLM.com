"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  q8WeightVectorPath,
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

test("freezes independently generated mixed-Q8 SLM2 scalar runtime vectors", () => {
  const generatorBytes = fs.readFileSync(generatorPath);
  const vectorBytes = fs.readFileSync(runtimeVectorPath);
  const vectors = parseStrictJson(vectorBytes);
  assert.equal(generatorBytes.length, 19_745);
  assert.equal(sha256(generatorBytes),
    "8d76a559790d0d9996c9d17990d982c32e227ce767dbfef17a045181444d4f0e");
  assert.equal(vectorBytes.length, 50_801);
  assert.equal(sha256(vectorBytes),
    "c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0");
  assert.deepEqual(vectorBytes, renderRuntimeVectors());
  assert.equal(vectors.oracle.sourceSha256, sha256(generatorBytes));
  assert.equal(vectors.schema, "tinyrustlm.slm2-runtime-q8-vectors.v1");
});

test("binds vectors to the sole mixed-Q8 artifact and ordered f32 arithmetic", () => {
  const weightVectors = parseStrictJson(fs.readFileSync(q8WeightVectorPath));
  const vectors = parseStrictJson(fs.readFileSync(runtimeVectorPath));
  const canonical = weightVectors.canonical;
  assert.equal(canonical.id, vectors.sourceQ8WeightVector.id);
  assert.equal(vectors.sourceQ8WeightVector.artifactSha256, canonical.artifactSha256);
  assert.equal(vectors.sourceQ8WeightVector.artifactByteLength, canonical.artifactByteLength);
  assert.equal(vectors.sourceQ8WeightVector.formatProfileSha256,
    weightVectors.formatProfile.sha256);
  assert.equal(vectors.sourceQ8WeightVector.weightProfileSha256,
    weightVectors.weightProfile.sha256);
  assert.equal(vectors.arithmeticProfile,
    "tinyrustlm.runtime-q8-scalar-f32-ordered/1");
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
      outputTokens: [30, 30, 30],
      promptTokens: [1],
      requiredMaximumPosition: 4,
      stopTokens: []
    },
    {
      finalPosition: 2,
      id: "first-generated-token-is-stop",
      maximumNewTokens: 3,
      outputTokens: [30],
      promptTokens: [1],
      requiredMaximumPosition: 4,
      stopTokens: [30]
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
