"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const GENERATOR_ID = "tinyrustlm.tools.generate-slm2-fuzz-corpus.v1";
const FUZZ_PROFILE_ID = "tinyrustlm.vnext.slm2-fuzz.v1";
const FUZZ_PROFILE_SHA256 = "995a88e52692df204455ea94725de603af38b785a6f9f708a37bf7baa3ae2ce8";
const FORMAT_PROFILE_ID = "org.minimodel.slm2/2.0";
const repositoryRoot = path.resolve(__dirname, "../..");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/slm2-format-vectors.v1.json");
const fuzzProfilePath = path.join(repositoryRoot, "contracts/vnext/slm2-fuzz-profile.v1.json");
const corpusDirectory = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-slm2/fuzz/corpus/raw_slm2"
);
const manifestPath = path.join(corpusDirectory, "manifest.v1.json");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function strictHex(value) {
  assert.match(value, /^(?:[0-9a-f]{2})+$/u);
  const bytes = Buffer.from(value, "hex");
  assert.equal(bytes.toString("hex"), value);
  return bytes;
}

function changed(source, mutate) {
  const bytes = Buffer.from(source);
  mutate(bytes);
  assert.notDeepEqual(bytes, source);
  return bytes;
}

function seed(id, className, bytes, errorCode = null, tensorCount = null) {
  assert.match(id, /^[a-z0-9-]+$/u);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal((errorCode === null), (tensorCount !== null));
  return {
    id,
    file: `${id}.seed`,
    bytes,
    className,
    verdict: errorCode === null ? "admit" : "reject",
    errorCode,
    tensorCount
  };
}

function buildSeeds(vector) {
  const artifact = strictHex(vector.artifactHex);
  assert.equal(artifact.length, vector.artifactByteLength);
  assert.equal(sha256(artifact), vector.artifactSha256);
  const header = vector.header;
  const firstTensor = header.tensorTableOffset;
  const secondTensor = firstTensor + header.tensorRecordBytes;
  const firstTensorNameStringId = artifact.readUInt32LE(firstTensor + 12);
  const firstPayloadEnd = header.payloadOffset
    + Number(artifact.readBigUInt64LE(firstTensor + 112))
    + Number(artifact.readBigUInt64LE(firstTensor + 120));
  const secondPayloadStart = header.payloadOffset
    + Number(artifact.readBigUInt64LE(secondTensor + 112));
  assert.ok(firstPayloadEnd < secondPayloadStart);
  const layoutDigest = strictHex(vector.tensorLayoutSha256);
  const layoutOffset = artifact.indexOf(layoutDigest);
  assert.notEqual(layoutOffset, -1);
  assert.equal(artifact.indexOf(layoutDigest, layoutOffset + 1), -1);
  const classMarker = Buffer.concat([
    Buffer.from([0x6e]),
    Buffer.from("artifact_class", "ascii"),
    Buffer.from([0x01])
  ]);
  const classOffset = artifact.indexOf(classMarker);
  assert.notEqual(classOffset, -1);
  assert.equal(artifact.indexOf(classMarker, classOffset + 1), -1);
  const qkvBiasMarker = Buffer.concat([
    Buffer.from([0x68]),
    Buffer.from("qkv_bias", "ascii"),
    Buffer.from([0xf4])
  ]);
  const qkvBiasOffset = artifact.indexOf(qkvBiasMarker, header.manifestOffset);
  assert.ok(qkvBiasOffset >= header.manifestOffset);
  assert.ok(qkvBiasOffset + qkvBiasMarker.length <= header.manifestOffset + header.manifestLength);
  assert.equal(artifact.indexOf(qkvBiasMarker, qkvBiasOffset + 1), -1);

  return [
    seed("01-canonical-valid-vector", "canonical-valid-vector", Buffer.from(artifact), null, 11),
    seed("02-legacy-slm1-short", "legacy-or-truncated-envelope", Buffer.from("SLM1", "ascii"),
      "slm2-truncated-header"),
    seed("03-truncated-header", "legacy-or-truncated-envelope", artifact.subarray(0, 223),
      "slm2-truncated-header"),
    seed("04-wrong-magic", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => { bytes[0] ^= 1; }), "slm2-invalid-magic"),
    seed("05-invalid-format-id", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => { bytes[8] ^= 1; }), "slm2-invalid-format-id"),
    seed("06-unsupported-version", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => bytes.writeUInt16LE(3, 28)), "slm2-unsupported-version"),
    seed("07-invalid-byte-order", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => { bytes[32] ^= 1; }), "slm2-invalid-byte-order"),
    seed("08-unsupported-artifact-class", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => bytes.writeUInt16LE(3, 36)), "slm2-unsupported-artifact-class"),
    seed("09-nonzero-header-flags", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => bytes.writeUInt16LE(1, 38)), "slm2-invalid-header-flags"),
    seed("10-unsupported-table", "header-identity-and-version-mutation", changed(artifact,
      (bytes) => { bytes[80] = 1; }), "slm2-unsupported-table"),
    seed("11-nonzero-section-padding", "section-layout-and-padding-mutation", changed(artifact,
      (bytes) => { bytes[224] = 1; }), "slm2-nonzero-padding"),
    seed("12-invalid-section-layout", "section-layout-and-padding-mutation", changed(artifact,
      (bytes) => bytes.writeBigUInt64LE(BigInt(header.payloadOffset + 64), 144)),
    "slm2-invalid-section-layout"),
    seed("13-indefinite-manifest", "noncanonical-metadata", changed(artifact,
      (bytes) => { bytes[header.manifestOffset] = 0xbf; }), "slm2-invalid-metadata"),
    seed("14-manifest-class-conflict", "noncanonical-metadata", changed(artifact,
      (bytes) => { bytes[classOffset + classMarker.length - 1] = 2; }),
    "slm2-invalid-model-metadata"),
    seed("15-invalid-string-offset", "string-table-mutation", changed(artifact,
      (bytes) => { bytes[header.stringTableOffset + 8] = 1; }), "slm2-invalid-string-table"),
    seed("16-nonascii-string", "string-table-mutation", changed(artifact, (bytes) => {
      const count = bytes.readUInt32LE(header.stringTableOffset);
      const poolStart = header.stringTableOffset + 8 + (count + 1) * 4;
      bytes[poolStart] = 0x80;
    }), "slm2-invalid-string-table"),
    seed("17-invalid-tensor-reserved", "tensor-table-mutation", changed(artifact,
      (bytes) => { bytes[firstTensor + 3] = 1; }), "slm2-invalid-tensor"),
    seed("18-tensor-size-mismatch", "tensor-table-mutation", changed(artifact,
      (bytes) => bytes.writeBigUInt64LE(3n, firstTensor + 96)), "slm2-tensor-size-mismatch"),
    seed("19-duplicate-tensor-name", "tensor-table-mutation", changed(artifact,
      (bytes) => bytes.writeUInt32LE(firstTensorNameStringId, secondTensor + 12)),
    "slm2-invalid-tensor-order"),
    seed("20-invalid-tensor-alignment", "tensor-table-mutation", changed(artifact,
      (bytes) => bytes.writeUInt32LE(96, firstTensor + 128)), "slm2-invalid-tensor"),
    seed("21-tensor-registry-flag-mismatch", "tensor-registry-mutation", changed(artifact,
      (bytes) => { bytes[qkvBiasOffset + qkvBiasMarker.length - 1] = 0xf5; }),
    "slm2-invalid-tensor-registry"),
    seed("22-layout-hash-drift", "layout-identity-mutation", changed(artifact,
      (bytes) => { bytes[layoutOffset] ^= 1; }), "slm2-layout-hash-drift"),
    seed("23-payload-relative-offset", "payload-layout-mutation", changed(artifact,
      (bytes) => bytes.writeBigUInt64LE(1n, firstTensor + 112)), "slm2-invalid-payload-layout"),
    seed("24-nonzero-payload-gap", "payload-layout-mutation", changed(artifact,
      (bytes) => { bytes[firstPayloadEnd] = 1; }), "slm2-nonzero-padding"),
    seed("25-payload-hash-drift", "payload-finiteness-and-identity-mutation", changed(artifact,
      (bytes) => { bytes[header.payloadOffset] ^= 1; }), "slm2-payload-hash-drift"),
    seed("26-nonfinite-f32", "payload-finiteness-and-identity-mutation", changed(artifact,
      (bytes) => bytes.writeUInt32LE(0x7fc0_0000, header.payloadOffset)), "slm2-nonfinite-f32"),
    seed("27-trailing-byte", "trailing-byte-mutation", Buffer.concat([artifact, Buffer.from([0])]),
      "slm2-file-size-mismatch")
  ];
}

function manifestBytes(vector, seeds) {
  const manifest = {
    schema: "tinyrustlm.vnext.slm2_fuzz_corpus.v1",
    corpusId: "tinyrustlm.vnext.slm2-fuzz-corpus.v1",
    status: "frozen",
    generatorId: GENERATOR_ID,
    fuzzProfileId: FUZZ_PROFILE_ID,
    fuzzProfileSha256: FUZZ_PROFILE_SHA256,
    formatProfileId: FORMAT_PROFILE_ID,
    formatProfileSha256: vectorDocument.profileSha256,
    sourceVectorId: vector.id,
    sourceVectorArtifactSha256: vector.artifactSha256,
    entries: seeds.map((value) => ({
      id: value.id,
      file: value.file,
      bytes: value.bytes.length,
      sha256: sha256(value.bytes),
      class: value.className,
      verdict: value.verdict,
      errorCode: value.errorCode,
      tensorCount: value.tensorCount
    }))
  };
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function exactSeedNames(seeds) {
  return seeds.map((value) => value.file).sort();
}

function verifyCorpus(vector, seeds, expectedManifest) {
  assert.ok(fs.statSync(corpusDirectory).isDirectory());
  const actualNames = fs.readdirSync(corpusDirectory)
    .filter((name) => name.endsWith(".seed"))
    .sort();
  assert.deepEqual(actualNames, exactSeedNames(seeds));
  for (const value of seeds) {
    assert.deepEqual(fs.readFileSync(path.join(corpusDirectory, value.file)), value.bytes, value.id);
  }
  assert.deepEqual(fs.readFileSync(manifestPath), expectedManifest);
  assert.equal(vector.artifactSha256, sha256(seeds[0].bytes));
}

function writeCorpus(seeds, expectedManifest) {
  assert.equal(path.resolve(corpusDirectory), corpusDirectory);
  fs.mkdirSync(corpusDirectory, { recursive: true });
  const expectedNames = new Set(exactSeedNames(seeds));
  for (const name of fs.readdirSync(corpusDirectory)) {
    if (name.endsWith(".seed") && !expectedNames.has(name)) {
      fs.unlinkSync(path.join(corpusDirectory, name));
    }
  }
  for (const value of seeds) {
    fs.writeFileSync(path.join(corpusDirectory, value.file), value.bytes);
  }
  fs.writeFileSync(manifestPath, expectedManifest);
}

const argument = process.argv[2];
if (!['--check', '--write'].includes(argument) || process.argv.length !== 3) {
  throw new Error("usage: node tools/generate-slm2-fuzz-corpus.js <--check|--write>");
}
const vectorDocument = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
assert.equal(vectorDocument.profileId, FORMAT_PROFILE_ID);
assert.equal(sha256(fs.readFileSync(fuzzProfilePath)), FUZZ_PROFILE_SHA256);
assert.equal(vectorDocument.vectors.length, 1);
const vector = vectorDocument.vectors[0];
const seeds = buildSeeds(vector);
assert.deepEqual(seeds.map((value) => value.id), [...seeds].map((value) => value.id).sort());
assert.equal(new Set(seeds.map((value) => sha256(value.bytes))).size, seeds.length);
const expectedManifest = manifestBytes(vector, seeds);
if (argument === "--write") {
  writeCorpus(seeds, expectedManifest);
}
verifyCorpus(vector, seeds, expectedManifest);
process.stdout.write(`${JSON.stringify({ status: "pass", entries: seeds.length })}\n`);
