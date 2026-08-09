"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  canonicalizeVnextJcsBytes
} = require("../tools/vnext-jcs.js");
const {
  domainSeparatedDigest,
  finalizeVnextReceipt,
  receiptDigest,
  receiptDraftFieldNames,
  receiptIdentityDomain,
  receiptIdentityExcludedFields,
  receiptMaximumBytes,
  receiptSchema,
  validateVnextReceiptBytes
} = require("../tools/vnext-receipt-identity.js");

const corpusPath = path.resolve(__dirname, "../../contracts/vnext/contract-corpus.v1.json");
const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");

function loadValidReceipt() {
  const corpus = parseStrictJson(fs.readFileSync(corpusPath));
  const item = corpus.cases.find((entry) => entry.id === "valid-receipt");
  return parseStrictJson(Buffer.from(item.payloadBase64, "base64"));
}

function receiptDraft() {
  const receipt = loadValidReceipt();
  for (const name of receiptIdentityExcludedFields) delete receipt[name];
  return receipt;
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).reverse().map((key) =>
    [key, reverseObjectKeys(value[key])]));
}

function contentWithoutIdentity(receipt) {
  return Object.fromEntries(Object.entries(receipt).filter(([name]) =>
    !receiptIdentityExcludedFields.includes(name)));
}

function jcsLimits() {
  const registry = parseStrictJson(fs.readFileSync(registryPath));
  return {
    maximumDepth: registry.limits.maximumDepth,
    maximumTotalEntries: registry.limits.maximumTotalEntries,
    maximumObjectMembers: registry.limits.maximumObjectMembers,
    maximumArrayItems: registry.limits.maximumArrayItems,
    maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
    maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits
  };
}

function manualDigest(domain, value) {
  return crypto.createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonicalizeVnextJcsBytes(value, jcsLimits()))
    .digest("hex");
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("finalizes a schema-valid receipt with domain-separated canonical identity", () => {
  const draft = receiptDraft();
  const before = JSON.stringify(draft);
  const finalized = finalizeVnextReceipt(draft);
  const expected = manualDigest(receiptIdentityDomain,
    contentWithoutIdentity(finalized.receipt));

  assert.equal(receiptSchema, "tinyrustlm.vnext.receipt.v1");
  assert.equal(receiptIdentityDomain, "tinyrustlm.receipt.content.v1");
  assert.equal(receiptMaximumBytes, 262144);
  assert.deepEqual(receiptIdentityExcludedFields,
    ["canonicalContentSha256", "receiptId"]);
  assert.equal(finalized.receipt.receiptId, `sha256:${expected}`);
  assert.equal(finalized.receipt.canonicalContentSha256, expected);
  assert.equal(receiptDigest(finalized.receipt), expected);
  assert.equal(domainSeparatedDigest(receiptIdentityDomain,
    contentWithoutIdentity(finalized.receipt)), expected);
  assert.equal(JSON.stringify(draft), before, "finalization mutated its caller's draft");
  assert.equal(finalized.bytes.length <= receiptMaximumBytes, true);
  assert.equal(finalized.bytes.at(-1) === 0x0a, false);
  assert.equal(finalized.bytes.toString("utf8").includes("\n"), false);
});

test("makes material identity independent of object insertion order", () => {
  const original = finalizeVnextReceipt(receiptDraft());
  const permuted = finalizeVnextReceipt(reverseObjectKeys(receiptDraft()));

  assert.equal(permuted.receipt.receiptId, original.receipt.receiptId);
  assert.deepEqual(permuted.bytes, original.bytes);
});

test("changes identity when any material receipt field changes", () => {
  const original = finalizeVnextReceipt(receiptDraft());
  const changedDraft = receiptDraft();
  changedDraft.attemptId = "attempt-vnext-002";
  const changed = finalizeVnextReceipt(changedDraft);

  assert.notEqual(changed.receipt.receiptId, original.receipt.receiptId);
  assert.notEqual(changed.receipt.canonicalContentSha256,
    original.receipt.canonicalContentSha256);
  assert.notDeepEqual(changed.bytes, original.bytes);
});

test("requires the exact draft field set before canonicalization", () => {
  const missing = receiptDraft();
  delete missing.phase;
  throwsCode(() => finalizeVnextReceipt(missing), "receipt_draft_fields_invalid");

  const unknown = receiptDraft();
  unknown.legacyId = "unsupported";
  throwsCode(() => finalizeVnextReceipt(unknown), "receipt_draft_fields_invalid");

  const names = Object.keys(receiptDraft()).sort();
  assert.deepEqual([...receiptDraftFieldNames].sort(), names);
});

test("accepts only exact canonical wire with recomputed identity", () => {
  const finalized = finalizeVnextReceipt(receiptDraft());
  const validated = validateVnextReceiptBytes(finalized.bytes);

  assert.equal(validated.receipt.receiptId, finalized.receipt.receiptId);
  assert.deepEqual(validated.bytes, finalized.bytes);

  const pretty = Buffer.from(JSON.stringify(finalized.receipt, null, 2), "utf8");
  throwsCode(() => validateVnextReceiptBytes(pretty), "receipt_wire_not_canonical");

  const reordered = Buffer.from(JSON.stringify(reverseObjectKeys(finalized.receipt)), "utf8");
  throwsCode(() => validateVnextReceiptBytes(reordered), "receipt_wire_not_canonical");

  const tamperedId = { ...finalized.receipt, receiptId: `sha256:${"f".repeat(64)}` };
  const tamperedBytes = canonicalizeVnextJcsBytes(tamperedId, jcsLimits());
  throwsCode(() => validateVnextReceiptBytes(tamperedBytes), "receipt_identity_mismatch");
});

test("rejects malformed, duplicate, empty, and oversized receipt bytes", () => {
  throwsCode(() => validateVnextReceiptBytes("not-bytes"), "receipt_bytes_required");
  throwsCode(() => validateVnextReceiptBytes(Buffer.alloc(0)), "receipt_byte_limit");
  throwsCode(() => validateVnextReceiptBytes(Buffer.alloc(receiptMaximumBytes + 1)),
    "receipt_byte_limit");
  throwsCode(() => validateVnextReceiptBytes(Buffer.from("{", "utf8")),
    "receipt_registry_validation_failed");
  throwsCode(() => validateVnextReceiptBytes(Buffer.from(
    '{"schema":"tinyrustlm.vnext.receipt.v1","schema":"tinyrustlm.vnext.receipt.v1"}',
    "utf8"
  )), "receipt_registry_validation_failed");
});

test("deep-freezes validated data and never exposes mutable canonical storage", () => {
  const finalized = finalizeVnextReceipt(receiptDraft());
  assert.equal(Object.isFrozen(finalized), true);
  assert.equal(Object.isFrozen(finalized.receipt), true);
  assert.equal(Object.isFrozen(finalized.receipt.runtime), true);
  assert.equal(Object.isFrozen(finalized.receipt.tools), true);
  assert.equal(Object.isFrozen(finalized.receipt.tools[0]), true);
  assert.throws(() => {
    finalized.receipt.phase = "changed";
  }, TypeError);

  const pristine = Buffer.from(finalized.bytes);
  const exposed = finalized.bytes;
  exposed[0] ^= 0xff;
  assert.deepEqual(finalized.bytes, pristine,
    "mutating returned bytes changed the finalized receipt's canonical storage");
});
