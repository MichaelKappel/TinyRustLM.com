"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { applyMutation } = require("./slm2-q8-reference.js");

const GENERATOR_ID = "tinyrustlm.tools.generate-slm2-q8-fuzz-corpus/1";
const FUZZ_PROFILE_ID = "tinyrustlm.slm2-q8-fuzz/1";
const FUZZ_PROFILE_SHA256 = "27c4ca3a2c5b4642010f7ca854aa83c76dd10bbe7e114a78489958f3e1c2f0ce";
const FORMAT_PROFILE_ID = "org.minimodel.slm2/2.0";
const WEIGHT_PROFILE_ID = "tinyrustlm.weight-q8-row-symmetric-f32-scale/1";
const repositoryRoot = path.resolve(__dirname, "../..");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/slm2-q8-weight-vectors.v1.json");
const fuzzProfilePath = path.join(repositoryRoot, "contracts/vnext/slm2-q8-fuzz-profile.v1.json");
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

function seed(id, className, bytes, errorCode = null, tensorCount = null) {
  assert.match(id, /^[a-z0-9-]+$/u);
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(errorCode === null, tensorCount !== null);
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
  const hostile = [...vector.mutations]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((mutation) => seed(
      `10-${mutation.id}`,
      "registered-q8-hostile-mutation",
      applyMutation(artifact, mutation),
      mutation.expectedError
    ));
  return [
    seed("01-canonical-valid-vector", "canonical-valid-mixed-q8-vector",
      Buffer.from(artifact), null, 17),
    seed("02-truncated-header", "truncated-envelope", artifact.subarray(0, 223),
      "slm2-truncated-header"),
    seed("03-slm1-envelope", "slm1-envelope", Buffer.from("SLM1", "ascii"),
      "slm2-truncated-header"),
    ...hostile
  ];
}

function manifestBytes(vectorDocument, vector, seeds) {
  const manifest = {
    schema: "tinyrustlm.slm2-q8-fuzz-corpus.v1",
    corpusId: "tinyrustlm.slm2-q8-fuzz-corpus/1",
    status: "frozen",
    generatorId: GENERATOR_ID,
    fuzzProfileId: FUZZ_PROFILE_ID,
    fuzzProfileSha256: FUZZ_PROFILE_SHA256,
    formatProfileId: FORMAT_PROFILE_ID,
    formatProfileSha256: vectorDocument.formatProfile.sha256,
    weightProfileId: WEIGHT_PROFILE_ID,
    weightProfileSha256: vectorDocument.weightProfile.sha256,
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
if (!["--check", "--write"].includes(argument) || process.argv.length !== 3) {
  throw new Error("usage: node tools/generate-slm2-fuzz-corpus.js <--check|--write>");
}
const vectorDocument = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
const fuzzProfileBytes = fs.readFileSync(fuzzProfilePath);
const fuzzProfile = JSON.parse(fuzzProfileBytes);
assert.equal(vectorDocument.schema, "tinyrustlm.slm2-q8-weight-vectors.v1");
assert.equal(vectorDocument.weightProfile.profileId, WEIGHT_PROFILE_ID);
assert.equal(sha256(fuzzProfileBytes), FUZZ_PROFILE_SHA256);
assert.equal(fuzzProfile.profileId, FUZZ_PROFILE_ID);
assert.equal(fuzzProfile.formatProfileSha256, vectorDocument.formatProfile.sha256);
assert.equal(fuzzProfile.weightProfileSha256, vectorDocument.weightProfile.sha256);
const vector = vectorDocument.canonical;
const seeds = buildSeeds(vector);
assert.deepEqual(seeds.map((value) => value.id), [...seeds].map((value) => value.id).sort());
assert.equal(new Set(seeds.map((value) => sha256(value.bytes))).size, seeds.length);
const expectedManifest = manifestBytes(vectorDocument, vector, seeds);
if (argument === "--write") writeCorpus(seeds, expectedManifest);
verifyCorpus(vector, seeds, expectedManifest);
process.stdout.write(`${JSON.stringify({ status: "pass", entries: seeds.length })}\n`);
