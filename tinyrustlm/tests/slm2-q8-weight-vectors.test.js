"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  Slm2Q8Error,
  applyMutation,
  parseArtifact,
  q8Matvec,
  quantizeRow,
  renderVectors,
  vectorPath,
  writeCanonicalArtifact
} = require("../tools/slm2-q8-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const formatProfilePath = path.join(repositoryRoot, "contracts/vnext/slm2-format-profile.v1.json");
const weightProfilePath = path.join(repositoryRoot, "contracts/vnext/slm2-q8-weight-profile.v1.json");
const oraclePath = path.join(repositoryRoot, "tinyrustlm/tools/slm2-q8-reference.js");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function bitsToF32(bits) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(bits);
  return bytes.readFloatLE(0);
}

function f32Bits(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatLE(Math.fround(value));
  return bytes.readUInt32LE(0);
}

function errorCode(action) {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof Slm2Q8Error);
    return error.code;
  }
  assert.fail("hostile SLM2 input was accepted");
}

test("freezes the exact independent mixed Q8 profile, oracle, and vectors", () => {
  const identities = [
    [formatProfilePath, 21_924, "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8"],
    [weightProfilePath, 9_900, "7e931fd23fa8f6a90c53e4c14c5630eef8ce87e0f0902acd5a5e2df03c60733a"],
    [oraclePath, 55_909, "964dcd94d02e9b5927b01ba31ba38dbb42368b6414d8898a7c90e1f71c6bc49f"],
    [vectorPath, 42_623, "f81d30bd0646efa4a267ffed8c697c2b7a5c84a67ded9d498aa3ffb10007ca2d"]
  ];
  for (const [file, bytes, digest] of identities) {
    const content = fs.readFileSync(file);
    assert.equal(content.length, bytes, file);
    assert.equal(sha256(content), digest, file);
  }
  assert.deepEqual(fs.readFileSync(vectorPath), renderVectors());
  const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
  assert.deepEqual(vectors.formatProfile, {
    path: "contracts/vnext/slm2-format-profile.v1.json",
    byteLength: 21_924,
    sha256: identities[0][2]
  });
  assert.equal(vectors.weightProfile.sha256, identities[1][2]);
  assert.equal(vectors.oracle.sha256, identities[2][2]);
});

test("writes and parses one exact mixed-role artifact deterministically", () => {
  const first = writeCanonicalArtifact();
  const second = writeCanonicalArtifact();
  assert.deepEqual(first.artifact, second.artifact);
  const parsed = parseArtifact(first.artifact);
  assert.equal(parsed.header.quantCount, 1);
  assert.equal(parsed.header.quantRecordBytes, 128);
  assert.equal(parsed.quantization.storageProfile,
    "tinyrustlm.weight-q8-row-symmetric-f32-scale/1");
  assert.equal(parsed.spec.tiedEmbeddings, false);
  assert.equal(parsed.spec.qkvBias, true);
  assert.equal(parsed.spec.qkNormalization, true);
  assert.equal(parsed.tensors.length, 17);
  assert.equal(parsed.tensors.filter((tensor) => tensor.elementType === 2).length, 9);
  assert.equal(parsed.tensors.filter((tensor) => tensor.elementType === 1).length, 8);
  for (const tensor of parsed.tensors) {
    if (tensor.elementType === 2) {
      assert.equal(tensor.rank, 2);
      assert.equal(tensor.quantProfileIndex, 0);
      assert.equal(tensor.storedBytes, tensor.shape[0] * (tensor.shape[1] + 4));
      assert.equal(tensor.blockElements, tensor.shape[1]);
      assert.equal(tensor.blockBytes, tensor.shape[1] + 4);
    } else {
      assert.equal(tensor.quantProfileIndex, 0xffff);
      assert.equal(tensor.storedBytes, tensor.logicalElements * 4);
    }
  }
});

test("freezes binary32 row quantization including ties and zero rows", () => {
  const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
  assert.deepEqual(vectors.canonical.rowCases.map((entry) => entry.id), [
    "positive-and-negative-zero",
    "positive-and-negative-extrema",
    "positive-half-tie",
    "negative-half-tie",
    "just-below-and-above-half",
    "rounded-scale-clamp",
    "non-power-of-two-scale"
  ]);
  for (const entry of vectors.canonical.rowCases) {
    const source = entry.sourceF32Bits.map(bitsToF32);
    const actual = quantizeRow(source);
    assert.equal(actual.scaleBits, entry.scaleF32Bits, entry.id);
    assert.deepEqual(actual.codes, entry.codes, entry.id);
    assert.ok(actual.codes.every((code) => code >= -127 && code <= 127), entry.id);
  }
  assert.equal(vectors.canonical.rowCases[0].scaleF32Bits, 0x3f80_0000);
  assert.deepEqual(vectors.canonical.rowCases[0].codes, [0, 0, 0, 0]);
  assert.equal(vectors.canonical.rowCases[2].codes[1], 1);
  assert.equal(vectors.canonical.rowCases[3].codes[1], -1);
});

test("freezes ordered no-FMA scalar matvec outcomes", () => {
  const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
  assert.deepEqual(vectors.canonical.matvecCases.map((entry) => entry.id), [
    "zero-row",
    "mixed-sign-row",
    "multiple-rows",
    "finite-extreme-without-overflow"
  ]);
  for (const entry of vectors.canonical.matvecCases) {
    const payload = Buffer.from(entry.payloadHex, "hex");
    const input = entry.inputF32Bits.map(bitsToF32);
    const actual = q8Matvec(payload, entry.rows, entry.columns, input).map(f32Bits);
    assert.deepEqual(actual, entry.outputF32Bits, entry.id);
  }
});

test("rejects every proper artifact prefix", () => {
  const { artifact } = writeCanonicalArtifact();
  for (let length = 0; length < artifact.length; length += 1) {
    assert.throws(() => parseArtifact(artifact.subarray(0, length)), undefined,
      `prefix ${length}`);
  }
});

test("rejects every registered hostile mutation with the exact verdict", () => {
  const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
  const artifact = Buffer.from(vectors.canonical.artifactHex, "hex");
  assert.equal(sha256(artifact), vectors.canonical.artifactSha256);
  for (const entry of vectors.canonical.mutations) {
    assert.equal(errorCode(() => parseArtifact(applyMutation(artifact, entry))),
      entry.expectedError, entry.id);
  }
});

test("keeps the oracle isolated from Rust, subprocesses, network, and generated output", () => {
  const source = fs.readFileSync(oraclePath, "utf8");
  assert.doesNotMatch(source,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|worker_threads)/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
  assert.doesNotMatch(source, /\b(?:cargo|rustc)\b|\.exe\b|tinyrustlm-slm2\/target/iu);
  assert.doesNotMatch(source, /readFileSync\([^\n]*(?:q8_vectors|generate_q8_vectors)/u);
});

test("keeps one prelaunch product and one exact production encoding", () => {
  const format = JSON.parse(fs.readFileSync(formatProfilePath, "utf8"));
  const weight = JSON.parse(fs.readFileSync(weightProfilePath, "utf8"));
  assert.equal(format.profileId, "org.minimodel.slm2/2.0");
  assert.equal(format.weightProfile.productionArtifact,
    "one-exact-mixed-q8-row-and-f32-role-profile");
  assert.equal(format.weightProfile.f32ArtifactAccepted, false);
  assert.equal(weight.cleanCut.productGenerationCount, 1);
  for (const field of ["slm1Reader", "slm1Writer", "genericQ8Alias",
    "legacyQuantizationAlias", "profileNegotiation", "runtimeRepacking",
    "inferredEncoding", "unknownProfileFallback", "permissiveTail",
    "dualProductionModelFormat"]) {
    assert.equal(weight.cleanCut[field], false, field);
  }
});
