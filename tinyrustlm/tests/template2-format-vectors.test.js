"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  DEFAULT_POLICY,
  Template2ReferenceError,
  applyMutation,
  parseTemplate2,
  renderPrompt,
  sha256Hex,
  strictHex,
  validatePromptTokenCount,
  writeTemplate2
} = require("../tools/template2-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/template2-format-profile.v1.json");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/template2-format-vectors.v1.json");
const oraclePath = path.join(repositoryRoot, "tinyrustlm/tools/template2-reference.js");
const profileBytes = fs.readFileSync(profilePath);
const vectorBytes = fs.readFileSync(vectorPath);
const profile = parseStrictJson(profileBytes);
const vectors = parseStrictJson(vectorBytes);

function sourceSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function canonical() {
  assert.equal(vectors.vectors.length, 1);
  const vector = vectors.vectors[0];
  return { vector, artifact: strictHex(vector.artifactHex) };
}

function generatedMessageSequence(count, includeSystem) {
  const messages = [];
  if (includeSystem) messages.push({ role: "system", content: "" });
  while (messages.length < count) {
    const index = messages.length - (includeSystem ? 1 : 0);
    messages.push({ role: index % 2 === 0 ? "user" : "assistant", content: "" });
  }
  return messages;
}

test("binds the exact profile, independent oracle, and pinned source authorities", () => {
  assert.deepEqual(Object.keys(vectors).sort(), [
    "independentOracle",
    "profileId",
    "profileSha256",
    "schema",
    "sourceAuthority",
    "vectors"
  ]);
  assert.equal(vectors.schema, "tinyrustlm.vnext.template2-format-vectors.v1");
  assert.equal(vectors.profileId, "org.minimodel.template2/2.0");
  assert.equal(vectors.profileId, profile.profileId);
  assert.equal(vectors.profileSha256, sha256Hex(profileBytes));
  assert.equal(vectors.independentOracle.implementation,
    "tinyrustlm/tools/template2-reference.js");
  assert.equal(vectors.independentOracle.sourceSha256, sourceSha256(oraclePath));
  assert.deepEqual(vectors.independentOracle.roles,
    ["vector-generator", "writer", "parser", "renderer"]);
  assert.deepEqual(vectors.sourceAuthority, {
    modelId: "Qwen/Qwen3-0.6B",
    revision: "c1899de289a04d12100db370d81485cdf75e47ca",
    sourceTemplateByteLength: 4168,
    sourceTemplateSha256: "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8",
    sourceModelConfigSha256: "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd",
    tokenizerArtifactByteLength: 7038773,
    tokenizerArtifactSha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
  });
});

test("independent writer reproduces and parser closes the sole canonical artifact", () => {
  const { vector, artifact } = canonical();
  assert.deepEqual(writeTemplate2(), artifact);
  assert.equal(artifact.length, 1403);
  assert.equal(artifact.length, vector.artifactByteLength);
  assert.equal(sha256Hex(artifact), vector.artifactSha256);
  assert.equal(vector.artifactSha256,
    "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8");
  const parsed = parseTemplate2(artifact);
  assert.deepEqual(parsed.identity, {
    byteLength: vector.artifactByteLength,
    sha256: vector.artifactSha256
  });
  assert.deepEqual(parsed.header, vector.header);
});

test("canonical literal table binds roles, control IDs, and every added-token guard", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTemplate2(artifact);
  assert.equal(parsed.literals.length, 31);
  assert.equal(vector.literals.length, 31);
  assert.deepEqual(parsed.literals.map((entry) => ({
    index: entry.index,
    kind: entry.kind,
    flags: entry.flags,
    tokenId: entry.tokenId,
    utf8Hex: entry.bytes.toString("hex")
  })), vector.literals);
  assert.equal(vector.forbiddenContentCases.length, 26);
  assert.deepEqual(parsed.header.stopTokenIds, [151645, 151643]);
});

test("renderer reproduces all exact byte and insertion vectors", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTemplate2(artifact);
  assert.equal(vector.renderCases.length, 8);
  for (const entry of vector.renderCases) {
    const rendered = renderPrompt(parsed, entry.messages);
    assert.equal(rendered.bytes.toString("hex"), entry.expectedUtf8Hex, entry.id);
    assert.deepEqual(rendered.insertions, entry.expectedInsertions, entry.id);
    assert.equal(rendered.thinkingMode, "disabled", entry.id);
    assert.deepEqual(rendered.stopTokenIds, [151645, 151643], entry.id);
    assert.equal(rendered.bosInserted, false, entry.id);
    assert.equal(rendered.eosInserted, false, entry.id);
  }
});

test("closed message schema and legal ordering reject every representable malformed case", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTemplate2(artifact);
  assert.equal(vector.malformedInputs.length, 11);
  for (const entry of vector.malformedInputs) {
    assert.throws(
      () => renderPrompt(parsed, entry.messages),
      (error) => error instanceof Template2ReferenceError && error.code === entry.expectedError,
      entry.id
    );
  }
});

test("all tokenizer-added control strings are rejected inside message data", () => {
  const { vector, artifact } = canonical();
  const parsed = parseTemplate2(artifact);
  for (const entry of vector.forbiddenContentCases) {
    const content = Buffer.from(entry.utf8Hex, "hex").toString("utf8");
    assert.throws(
      () => renderPrompt(parsed, [{ role: "user", content: `before${content}after` }]),
      (error) => error instanceof Template2ReferenceError &&
        error.code === "template2-content-control-token",
      String(entry.tokenId)
    );
  }
});

test("message, content, total, rendered, and token ceilings are fail-closed", () => {
  const { artifact } = canonical();
  const parsed = parseTemplate2(artifact);
  assert.doesNotThrow(() => renderPrompt(parsed, generatedMessageSequence(256, true)));
  assert.throws(
    () => renderPrompt(parsed, generatedMessageSequence(257, false)),
    (error) => error.code === "template2-message-count"
  );
  assert.doesNotThrow(() => renderPrompt(parsed, [{ role: "user", content: "x".repeat(262144) }]));
  assert.throws(
    () => renderPrompt(parsed, [{ role: "user", content: "x".repeat(262145) }]),
    (error) => error.code === "template2-content-limit"
  );
  const total = [
    { role: "user", content: "x".repeat(262144) },
    { role: "assistant", content: "x".repeat(262144) },
    { role: "user", content: "x".repeat(262144) },
    { role: "assistant", content: "x".repeat(262144) },
    { role: "user", content: "" }
  ];
  assert.doesNotThrow(() => renderPrompt(parsed, total));
  total[4] = { role: "user", content: "x" };
  assert.throws(() => renderPrompt(parsed, total),
    (error) => error.code === "template2-total-content-limit");
  assert.doesNotThrow(() => validatePromptTokenCount(parsed, 40960));
  assert.throws(() => validatePromptTokenCount(parsed, 40961),
    (error) => error.code === "template2-token-limit");

  const one = renderPrompt(parsed, [{ role: "user", content: "x" }]);
  const limitedPolicy = {
    ...DEFAULT_POLICY,
    maximumRenderedBytes: one.bytes.length - 1
  };
  assert.throws(
    () => renderPrompt(parsed, [{ role: "user", content: "x" }], limitedPolicy),
    (error) => error.code === "template2-rendered-limit"
  );
});

test("parser rejects every targeted mutation with its frozen public-safe code", () => {
  const { vector, artifact } = canonical();
  assert.equal(vector.mutations.length, 15);
  for (const mutation of vector.mutations) {
    assert.throws(
      () => parseTemplate2(applyMutation(artifact, mutation)),
      (error) => error instanceof Template2ReferenceError &&
        error.code === mutation.expectedError,
      mutation.id
    );
  }
});

test("parser rejects every proper canonical artifact prefix", () => {
  const { vector, artifact } = canonical();
  assert.deepEqual(vector.truncation, {
    operation: "every-prefix-length",
    startInclusive: 0,
    endExclusive: artifact.length,
    expected: "reject"
  });
  for (let length = 0; length < artifact.length; length += 1) {
    assert.throws(
      () => parseTemplate2(artifact.subarray(0, length)),
      (error) => error instanceof Template2ReferenceError,
      `prefix ${length}`
    );
  }
});

test("oracle cannot execute source templates, Rust, subprocesses, or network operations", () => {
  const source = fs.readFileSync(oraclePath, "utf8");
  assert.doesNotMatch(source,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|vm|worker_threads)/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
  assert.doesNotMatch(source, /\b(?:cargo|rustc)\b|\.exe\b/iu);
  assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/u);
  assert.doesNotMatch(source, /jinja|nunjucks|handlebars|mustache/iu);
});
