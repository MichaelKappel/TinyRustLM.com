"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  ARTIFACT_SHA256,
  PROFILE_ID,
  PROFILE_SHA256,
  Prompt2ReferenceError,
  applyMutation,
  loadDependencies,
  parseLoadBundle,
  parsePrompt2,
  parseRequest,
  parseResult,
  renderVectorDocument,
  sha256Hex,
  strictHex,
  vectorPath,
  writeLoadBundle,
  writePrompt2,
  writeRequest,
  writeResult
} = require("../tools/prompt2-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/prompt2-format-profile.v1.json");
const sourcePath = path.join(repositoryRoot, "tinyrustlm/tools/prompt2-reference.js");
const profileBytes = fs.readFileSync(profilePath);
const profile = parseStrictJson(profileBytes);
const vectorBytes = fs.readFileSync(vectorPath);
const vectors = parseStrictJson(vectorBytes);

function sourceSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function tokenIdsU32LeSha256(tokenIds) {
  const bytes = Buffer.alloc(tokenIds.length * 4);
  tokenIds.forEach((tokenId, index) => bytes.writeUInt32LE(tokenId, index * 4));
  return sha256Hex(bytes);
}

function resultBytes(entry) {
  assert.ok(Array.isArray(entry.resultHexChunks));
  assert.ok(entry.resultHexChunks.length >= 1);
  for (const chunk of entry.resultHexChunks) assert.ok(chunk.length <= 65_536);
  return strictHex(entry.resultHexChunks.join(""));
}

test("checked-in Prompt2 vectors exactly match the independent generator", () => {
  const generated = renderVectorDocument();
  assert.deepEqual(vectorBytes, generated.bytes);
  assert.equal(vectors.generator.sourceSha256, sourceSha256(sourcePath));
  assert.equal(vectors.generator.implementation, "tinyrustlm/tools/prompt2-reference.js");
  assert.equal(vectors.generator.ownership,
    "independent-node-core-artifact-wire-and-composition-authority");
});

test("Prompt2 profile and sole canonical artifact identities are exact", () => {
  const artifact = writePrompt2();
  assert.equal(profile.profileId, PROFILE_ID);
  assert.equal(vectors.profileId, PROFILE_ID);
  assert.equal(sha256Hex(profileBytes), PROFILE_SHA256);
  assert.equal(vectors.profileSha256, PROFILE_SHA256);
  assert.equal(artifact.length, 512);
  assert.equal(sha256Hex(artifact), ARTIFACT_SHA256);
  assert.equal(vectors.artifact.sha256, ARTIFACT_SHA256);
  assert.deepEqual(artifact, strictHex(vectors.artifact.artifactHex));
  assert.deepEqual(parsePrompt2(artifact).identity, {
    byteLength: 512,
    sha256: ARTIFACT_SHA256
  });
});

test("Prompt2 parser rejects every proper canonical artifact prefix", () => {
  const artifact = strictHex(vectors.artifact.artifactHex);
  assert.equal(vectors.artifact.properPrefixCount, artifact.length);
  for (let length = 0; length < artifact.length; length += 1) {
    assert.throws(
      () => parsePrompt2(artifact.subarray(0, length)),
      (error) => error instanceof Prompt2ReferenceError,
      `prefix ${length}`
    );
  }
});

test("Prompt2 parser rejects every registered artifact mutation with its exact code", () => {
  const artifact = strictHex(vectors.artifact.artifactHex);
  for (const mutation of vectors.artifact.mutations) {
    assert.throws(
      () => parsePrompt2(applyMutation(artifact, mutation)),
      (error) => error instanceof Prompt2ReferenceError &&
        error.code === mutation.expectedError,
      mutation.id
    );
  }
});

test("Prompt2 request wire preserves exact messages, complete Sampling2 config, and u64 seed", () => {
  assert.equal(vectors.requestCases.length, 3);
  for (const entry of vectors.requestCases) {
    const bytes = strictHex(entry.requestHex);
    const parsed = parseRequest(bytes);
    assert.equal(bytes.length, entry.byteLength, entry.id);
    assert.equal(sha256Hex(bytes), entry.sha256, entry.id);
    assert.deepEqual(parsed.messages, entry.parsed.messages, entry.id);
    assert.deepEqual(parsed.config, entry.parsed.config, entry.id);
    assert.equal(parsed.seed.toString(10), entry.parsed.seed, entry.id);
    assert.deepEqual(writeRequest(parsed), bytes, entry.id);
  }
});

test("Prompt2 request parser rejects malformed headers, geometry, config, and trailing data", () => {
  const base = strictHex(vectors.requestCases[0].requestHex);
  for (const mutation of vectors.requestMutations) {
    assert.throws(
      () => parseRequest(applyMutation(base, mutation)),
      (error) => error instanceof Prompt2ReferenceError &&
        error.code === mutation.expectedError,
      mutation.id
    );
  }
  for (let length = 0; length < base.length; length += 1) {
    assert.throws(() => parseRequest(base.subarray(0, length)), Prompt2ReferenceError);
  }
});

test("Prompt2 result wires close insertion, state, and active/context-limit semantics", () => {
  assert.deepEqual(vectors.resultCases.map((entry) => entry.parsed.initialStatus),
    ["active", "context-limit"]);
  for (const entry of vectors.resultCases) {
    const bytes = resultBytes(entry);
    const parsed = parseResult(bytes);
    assert.equal(bytes.length, entry.byteLength, entry.id);
    assert.equal(sha256Hex(bytes), entry.sha256, entry.id);
    assert.equal(parsed.renderedUtf8, entry.parsed.renderedUtf8, entry.id);
    assert.equal(parsed.tokenIds.length, entry.parsed.tokenCount, entry.id);
    assert.equal(tokenIdsU32LeSha256(parsed.tokenIds), entry.parsed.tokenIdsU32LeSha256,
      entry.id);
    assert.deepEqual(parsed.tokenIds.slice(0, 16), entry.parsed.tokenIdsHead, entry.id);
    assert.deepEqual(parsed.tokenIds.slice(-16), entry.parsed.tokenIdsTail, entry.id);
    assert.deepEqual(parsed.insertions, entry.parsed.insertions, entry.id);
    assert.deepEqual(parsed.stopTokenIds, entry.parsed.stopTokenIds, entry.id);
    assert.equal(parsed.initialSamplingState.toString("hex"),
      entry.parsed.initialSamplingStateHex, entry.id);
    assert.equal(parsed.initialStatus, entry.parsed.initialStatus, entry.id);
    assert.deepEqual(writeResult(parsed), bytes, entry.id);
  }
  assert.equal(vectors.resultCases[0].parsed.tokenCount < 40_960, true);
  assert.equal(vectors.resultCases[1].parsed.tokenCount, 40_960);
});

test("Prompt2 result parser rejects every registered structural and semantic mutation", () => {
  const base = resultBytes(vectors.resultCases[0]);
  for (const mutation of vectors.resultMutations) {
    assert.throws(
      () => parseResult(applyMutation(base, mutation)),
      (error) => error instanceof Prompt2ReferenceError &&
        error.code === mutation.expectedError,
      mutation.id
    );
  }
  for (let length = 0; length < base.length; length += 1) {
    assert.throws(() => parseResult(base.subarray(0, length)), Prompt2ReferenceError);
  }
});

test("Prompt2 load bundle is exact, contiguous, bounded, and dependency validation fails closed", () => {
  const artifact = strictHex(vectors.artifact.artifactHex);
  const parts = {
    prompt2: artifact,
    tokenizer2: Buffer.alloc(profile.dependencyBinding.tokenizer2.artifactByteLength, 0x11),
    template2: Buffer.alloc(profile.dependencyBinding.template2.artifactByteLength, 0x22),
    sampling2: Buffer.alloc(profile.dependencyBinding.sampling2.artifactByteLength, 0x33)
  };
  const bundle = writeLoadBundle(parts);
  const parsed = parseLoadBundle(bundle);
  assert.equal(bundle.length, vectors.loadBundle.byteLength);
  assert.equal(bundle.subarray(0, 128).toString("hex"), vectors.loadBundle.headerHex);
  assert.equal(sha256Hex(bundle.subarray(0, 128)), vectors.loadBundle.headerSha256);
  assert.deepEqual(Object.keys(parsed), ["prompt2", "tokenizer2", "template2", "sampling2"]);
  for (const name of Object.keys(parts)) assert.deepEqual(parsed[name], parts[name], name);
  assert.throws(
    () => loadDependencies(bundle),
    (error) => error instanceof Prompt2ReferenceError &&
      error.code === "prompt2-dependency-identity"
  );
  assert.throws(
    () => parseLoadBundle(bundle, bundle.length - 1),
    (error) => error instanceof Prompt2ReferenceError && error.code === "prompt2-load-bundle"
  );
});

test("Prompt2 profile preserves the unpromoted no-legacy and zero-campaign claim boundary", () => {
  assert.equal(profile.status, "development-unpromoted");
  assert.equal(profile.selectedContract.modelArtifactBoundHere, false);
  assert.match(profile.selectedContract.compatibilityPolicy,
    /no-version-range-alias-migration-repair-or-fallback/u);
  assert.equal(profile.fixedSemantics.retrySelectionRepairOrBestOfN, false);
  assert.deepEqual(profile.claimBoundary.campaignCounters, {
    qualifiedModels: "0/20",
    cleanBrowserRounds: "0/50",
    liveMemoryRounds: "0/25",
    externallyProvenLanes: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("Prompt2 reference is import-free from network, subprocess, template engines, and repair", () => {
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|vm|worker_threads)/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
  assert.doesNotMatch(source, /jinja|nunjucks|handlebars|mustache/iu);
  assert.doesNotMatch(source, /best[- ]of[- ]n|response[- ]repair|legacy[- ]fallback/iu);
});
