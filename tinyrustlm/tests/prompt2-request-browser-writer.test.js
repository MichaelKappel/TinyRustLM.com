"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const requestApi = require("../app/prompt2-request.js");
const vectors = JSON.parse(fs.readFileSync(path.join(
  __dirname,
  "..",
  "..",
  "contracts",
  "vnext",
  "prompt2-format-vectors.v1.json"
), "utf8"));

function requestFromVector(entry) {
  return {
    messages: entry.parsed.messages,
    sampling: entry.parsed.config,
    seed: BigInt(entry.parsed.seed)
  };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("browser Prompt2 writer reproduces every canonical request vector byte for byte", () => {
  assert.ok(Array.isArray(vectors.requestCases) && vectors.requestCases.length >= 3);
  for (const entry of vectors.requestCases) {
    const bytes = requestApi.encodeRequest(requestFromVector(entry));
    assert.equal(bytes.byteLength, entry.byteLength, entry.id);
    assert.equal(Buffer.from(bytes).toString("hex"), entry.requestHex, entry.id);
    assert.equal(sha256(bytes), entry.sha256, entry.id);
  }
});

test("browser Prompt2 writer accepts the complete u64 seed domain without number loss", () => {
  const source = vectors.requestCases.find((entry) =>
    entry.parsed.seed === "18446744073709551615");
  assert.ok(source);
  const fromString = requestApi.encodeRequest({
    ...requestFromVector(source),
    seed: source.parsed.seed
  });
  const fromBigInt = requestApi.encodeRequest(requestFromVector(source));
  assert.deepEqual(fromString, fromBigInt);
});

test("browser Prompt2 writer rejects ambiguous, lossy, and out-of-policy requests", () => {
  const valid = requestFromVector(vectors.requestCases[0]);
  const cases = [
    [{ ...valid, extra: true }, "prompt2-request-fields"],
    [{ ...valid, messages: [] }, "prompt2-request-messages"],
    [{ ...valid, messages: [{ role: "tool", content: "x" }] }, "prompt2-request-role"],
    [{ ...valid, messages: [{ role: "user", content: "\ud800" }] }, "prompt2-request-content"],
    [{ ...valid, seed: Number.MAX_SAFE_INTEGER + 1 }, "prompt2-request-seed"],
    [{ ...valid, seed: 1n << 64n }, "prompt2-request-seed"],
    [{
      ...valid,
      sampling: { ...valid.sampling, temperatureMillionths: 0, topK: 2 }
    }, "prompt2-request-greedy-config"],
    [{
      ...valid,
      sampling: { ...valid.sampling, repetitionPenaltyMillionths: 999999 }
    }, "prompt2-request-repetition-penalty"],
    [{
      ...valid,
      messages: [{ role: "user", content: "x".repeat(262145) }]
    }, "prompt2-request-content"]
  ];
  for (const [candidate, code] of cases) {
    assert.throws(
      () => requestApi.encodeRequest(candidate),
      (error) => error instanceof requestApi.Prompt2RequestError && error.code === code,
      code
    );
  }
});

test("browser Prompt2 writer exposes the sole current request limits", () => {
  assert.equal(requestApi.REQUEST_SCHEMA, "tinyrustlm.prompt2-request/1");
  assert.equal(requestApi.HEADER_BYTES, 128);
  assert.equal(requestApi.MESSAGE_RECORD_BYTES, 24);
  assert.equal(requestApi.SECTION_ALIGNMENT, 64);
  assert.equal(requestApi.MAXIMUM_MESSAGES, 256);
  assert.equal(requestApi.MAXIMUM_REQUEST_BYTES, 1054848);
  assert.deepEqual(requestApi.ROLE_IDS, { system: 1, user: 2, assistant: 3 });
});
