"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  finalizeVnextIdentityDocument,
  identityContractForSchema,
  identityContractSchemas,
  validateVnextIdentityDocumentBytes
} = require("../tools/vnext-content-identity.js");

const corpusPath = path.resolve(__dirname, "../../contracts/vnext/contract-corpus.v1.json");
const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");

function corpusDocument(name) {
  const corpus = parseStrictJson(fs.readFileSync(corpusPath));
  const item = corpus.cases.find((entry) => entry.id === `valid-${name}`);
  return parseStrictJson(Buffer.from(item.payloadBase64, "base64"));
}

function draftFor(name) {
  const value = corpusDocument(name);
  const descriptor = identityContractForSchema(value.schema);
  for (const field of descriptor.identityExcludedFields) delete value[field];
  return value;
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("finalizes and validates every identity-bearing vNext contract", () => {
  const expected = ["artifact", "claim", "context", "p2p", "proof", "receipt", "release"];
  const observed = [];
  for (const name of expected) {
    const draft = draftFor(name);
    const before = JSON.stringify(draft);
    const finalized = finalizeVnextIdentityDocument(draft);
    const validated = validateVnextIdentityDocumentBytes(finalized.bytes);

    observed.push(finalized.contractClass);
    assert.equal(JSON.stringify(draft), before, `${name} draft mutated`);
    assert.equal(validated.schema, finalized.schema);
    assert.equal(validated.subjectId, finalized.subjectId);
    assert.equal(validated.canonicalContentSha256, finalized.canonicalContentSha256);
    assert.deepEqual(validated.bytes, finalized.bytes);
    assert.equal(Object.isFrozen(finalized), true);
    assert.equal(Object.isFrozen(finalized.value), true);
  }
  assert.deepEqual(observed.sort(), expected.sort());
});

test("keeps artifact byte identity distinct from manifest canonical identity", () => {
  const draft = draftFor("artifact");
  const finalized = finalizeVnextIdentityDocument(draft);

  assert.equal(finalized.subjectId, draft.artifactId);
  assert.equal(finalized.value.artifactId, `sha256:${draft.artifactSha256}`);
  assert.notEqual(finalized.subjectId,
    `sha256:${finalized.canonicalContentSha256}`);
});

test("produces the same receipt bytes as the dedicated receipt identity boundary", () => {
  const { finalizeVnextReceipt } = require("../tools/vnext-receipt-identity.js");
  const draft = draftFor("receipt");
  const generic = finalizeVnextIdentityDocument(draft);
  const dedicated = finalizeVnextReceipt(draft);

  assert.deepEqual(generic.bytes, dedicated.bytes);
  assert.equal(generic.subjectId, dedicated.receipt.receiptId);
});

test("rejects non-identity worker and companion messages", () => {
  for (const name of ["worker", "companion"]) {
    throwsCode(() => finalizeVnextIdentityDocument(corpusDocument(name)),
      "identity_schema_not_supported");
  }
});

test("rejects missing, unknown, noncanonical, and identity-tampered inputs", () => {
  const missing = draftFor("proof");
  delete missing.laneId;
  throwsCode(() => finalizeVnextIdentityDocument(missing),
    "identity_draft_fields_invalid");

  const unknown = draftFor("proof");
  unknown.legacyId = "unsupported";
  throwsCode(() => finalizeVnextIdentityDocument(unknown),
    "identity_draft_fields_invalid");

  const finalized = finalizeVnextIdentityDocument(draftFor("proof"));
  throwsCode(() => validateVnextIdentityDocumentBytes(
    Buffer.from(JSON.stringify(finalized.value, null, 2), "utf8")
  ), "identity_wire_not_canonical");

  const tampered = { ...finalized.value, proofId: `sha256:${"f".repeat(64)}` };
  throwsCode(() => validateVnextIdentityDocumentBytes(
    Buffer.from(JSON.stringify(tampered), "utf8")
  ), "identity_material_mismatch");
});

test("identity profile exactly matches the frozen contract registry", () => {
  const registry = parseStrictJson(fs.readFileSync(registryPath));
  const expected = registry.contracts.filter((entry) => entry.identityDomain !== null)
    .map((entry) => entry.schema).sort();
  assert.deepEqual([...identityContractSchemas].sort(), expected);
});
