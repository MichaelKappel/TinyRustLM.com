"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  ARTIFACT_SHA256,
  PROFILE_ID,
  PROFILE_SHA256,
  applyMutation,
  binary32ToQ20,
  createGenerationController,
  generationStep,
  nextU64,
  parseSampling2,
  parseState,
  renderVectorDocument,
  sampleToken,
  serializeState,
  sha256Hex,
  strictHex,
  tablePath,
  uniformBelowWords,
  vectorPath,
  writeSampling2
} = require("../tools/sampling2-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/sampling2-format-profile.v1.json");
const tableRepositoryPath = "contracts/vnext/sampling2-exp-q48-table.v1.bin";

function vectors() {
  return JSON.parse(fs.readFileSync(vectorPath, "utf8"));
}

function bitsFromHex(value) {
  assert.match(value, /^[0-9a-f]{8}$/u);
  return Number.parseInt(value, 16);
}

test("checked-in Sampling2 table and vectors exactly match the independent generator", () => {
  const generated = renderVectorDocument();
  assert.deepEqual(fs.readFileSync(tablePath), generated.table);
  assert.deepEqual(fs.readFileSync(vectorPath), generated.document);
});

test("Git preserves the normative Sampling2 table as binary bytes", () => {
  const attributes = childProcess.execFileSync(
    "git",
    ["check-attr", "text", "diff", "merge", "--", tableRepositoryPath],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }
  );
  assert.match(attributes, /: text: unset\r?\n/u);
  assert.match(attributes, /: diff: unset\r?\n/u);
  assert.match(attributes, /: merge: unset\r?\n/u);

  const rawBlob = childProcess.execFileSync(
    "git",
    ["hash-object", "--no-filters", "--", tableRepositoryPath],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }
  ).trim();
  const filteredBlob = childProcess.execFileSync(
    "git",
    ["hash-object", `--path=${tableRepositoryPath}`, tableRepositoryPath],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }
  ).trim();
  assert.equal(filteredBlob, rawBlob);
});

test("Sampling2 identities and canonical artifact are exact", () => {
  const document = vectors();
  const profileBytes = fs.readFileSync(profilePath);
  const tableBytes = fs.readFileSync(tablePath);
  const artifact = writeSampling2();
  assert.equal(document.schema, "tinyrustlm.vnext.sampling2-format-vectors.v1");
  assert.equal(document.profileId, PROFILE_ID);
  assert.equal(document.profileSha256, PROFILE_SHA256);
  assert.equal(sha256Hex(profileBytes), PROFILE_SHA256);
  assert.equal(sha256Hex(tableBytes), document.normativeTable.sha256);
  assert.equal(tableBytes.length, 65_544);
  assert.equal(artifact.length, document.artifact.byteLength);
  assert.equal(sha256Hex(artifact), ARTIFACT_SHA256);
  assert.equal(document.artifact.sha256, ARTIFACT_SHA256);
  assert.deepEqual(artifact, strictHex(document.artifact.artifactHex));
  assert.equal(parseSampling2(artifact).identity.sha256, ARTIFACT_SHA256);
  assert.throws(
    () => parseSampling2(artifact, { maximumArtifactBytes: artifact.length - 1 }),
    (error) => error.code === "sampling2-artifact-limit"
  );
});

test("Sampling2 parser rejects every registered mutation", () => {
  const document = vectors();
  const artifact = strictHex(document.artifact.artifactHex);
  for (const mutation of document.artifact.mutations) {
    assert.throws(
      () => parseSampling2(applyMutation(artifact, mutation)),
      (error) => error.code === mutation.expectedError,
      mutation.id
    );
  }
});

test("binary32 fixed-score cases replay exactly", () => {
  for (const entry of vectors().fixedScoreCases) {
    assert.equal(binary32ToQ20(bitsFromHex(entry.bitsHex)).toString(), entry.expectedQ20, entry.id);
  }
});

test("SplitMix64 and xoshiro256** state vectors replay exactly", () => {
  const document = vectors();
  for (const entry of document.prngCases) {
    const state = parseState(strictHex(entry.initialStateHex));
    const outputs = [];
    for (let index = 0; index < 8; index += 1) outputs.push(nextU64(state).toString());
    assert.deepEqual(outputs, entry.firstEightU64, entry.seed);
    assert.equal(serializeState(state).toString("hex"), entry.finalStateHex, entry.seed);
  }
});

test("u128 rejection primitive consumes the registered word sequence", () => {
  const entry = vectors().u128RejectionCase;
  const result = uniformBelowWords(entry.scriptedWords.words.map(BigInt), BigInt(entry.bound));
  assert.equal(result.threshold.toString(), entry.expectedThreshold);
  assert.equal(result.value.toString(), entry.scriptedWords.expectedValue);
  assert.equal(result.consumedWords, entry.scriptedWords.expectedConsumedWords);
});

test("all weighted and greedy sample vectors reproduce token and state", () => {
  const document = vectors();
  const sampling = parseSampling2(strictHex(document.artifact.artifactHex));
  for (const entry of document.sampleCases) {
    const initialState = parseState(strictHex(entry.initialStateHex));
    const result = sampleToken(
      sampling,
      entry.logitBitsHex.map(bitsFromHex),
      entry.generatedHistory,
      entry.config,
      initialState
    );
    assert.equal(result.tokenId, entry.expectedTokenId, entry.id);
    assert.equal(serializeState(result.state).toString("hex"), entry.expectedStateHex, entry.id);
    assert.deepEqual(result.trace, entry.expectedTrace, entry.id);
  }
});

test("generation terminal-state vectors reproduce without stop-token append or repair", () => {
  const document = vectors();
  const sampling = parseSampling2(strictHex(document.artifact.artifactHex));
  for (const entry of document.generationCases) {
    const controller = createGenerationController(sampling, {
      config: entry.config,
      promptTokenCount: entry.promptTokenCount,
      state: parseState(strictHex(entry.initialStateHex)),
      stopTokenIds: entry.stopTokenIds,
      vocabularySize: entry.vocabularySize
    });
    const after = entry.logitBitsHex === null
      ? controller
      : generationStep(controller, entry.logitBitsHex.map(bitsFromHex), entry.cancelled);
    assert.equal(after.status, entry.expectedStatus, entry.id);
    assert.deepEqual(after.generated, entry.expectedGenerated, entry.id);
    assert.equal(after.terminalTokenId, entry.expectedTerminalTokenId, entry.id);
    assert.equal(serializeState(after.state).toString("hex"), entry.expectedStateHex, entry.id);
  }
});
