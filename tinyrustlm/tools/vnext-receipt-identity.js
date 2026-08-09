"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  validateVnextSchemaWithRegistry
} = require("./vnext-contract-validator-registry.js");
const {
  validateVnextSchemaIndependently
} = require("./vnext-contract-validator-independent.js");
const {
  canonicalizeVnextJcsBytes
} = require("./vnext-jcs.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");
const registryBytes = fs.readFileSync(registryPath);
const registry = parseStrictJson(registryBytes);
const receiptContract = registry.contracts.find((entry) => entry.class === "receipt");
const receiptSchema = receiptContract.schema;
const receiptIdentityDomain = receiptContract.identityDomain;
const receiptIdentityExcludedFields = Object.freeze([...receiptContract.identityExcludedFields]);
const receiptFieldNames = Object.freeze(receiptContract.fields.map((field) => field.name));
const receiptDraftFieldNames = Object.freeze(receiptFieldNames.filter((name) =>
  !receiptIdentityExcludedFields.includes(name)));
const receiptMaximumBytes = receiptContract.maximumBytes;
const parserLimits = Object.freeze({
  maximumBytes: receiptMaximumBytes,
  maximumDepth: registry.limits.maximumDepth,
  maximumTotalEntries: registry.limits.maximumTotalEntries,
  maximumObjectMembers: registry.limits.maximumObjectMembers,
  maximumArrayItems: registry.limits.maximumArrayItems,
  maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits,
  maximumNumberCharacters: registry.limits.maximumNumberCharacters
});
const receiptJcsLimits = Object.freeze({
  maximumDepth: registry.limits.maximumDepth,
  maximumTotalEntries: registry.limits.maximumTotalEntries,
  maximumObjectMembers: registry.limits.maximumObjectMembers,
  maximumArrayItems: registry.limits.maximumArrayItems,
  maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(value, expected, code) {
  if (!isPlainObject(value)) failEvidence(code, "receipt-fields");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((name, index) => name !== wanted[index])) {
    failEvidence(code, "receipt-fields");
  }
}

function cloneJsonValue(value) {
  const bytes = canonicalizeVnextJcsBytes(value, receiptJcsLimits);
  return parseStrictJson(bytes, parserLimits);
}

function contentWithoutIdentity(receipt) {
  const content = {};
  for (const key of Object.keys(receipt)) {
    if (!receiptIdentityExcludedFields.includes(key)) content[key] = receipt[key];
  }
  return content;
}

function domainSeparatedDigest(domain, value) {
  if (typeof domain !== "string" || !/^[\x21-\x7e]{3,128}$/u.test(domain)) {
    failEvidence("identity_domain_invalid", "receipt-identity");
  }
  const canonical = canonicalizeVnextJcsBytes(value, receiptJcsLimits);
  return crypto.createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonical)
    .digest("hex");
}

function receiptDigest(receipt) {
  return domainSeparatedDigest(receiptIdentityDomain, contentWithoutIdentity(receipt));
}

function validateWithBoth(bytes) {
  let registryResult;
  let independentResult;
  try {
    registryResult = validateVnextSchemaWithRegistry(bytes);
  } catch (error) {
    throw new VnextEvidenceError("receipt_registry_validation_failed", "receipt-schema", error?.code);
  }
  try {
    independentResult = validateVnextSchemaIndependently(bytes);
  } catch (error) {
    throw new VnextEvidenceError("receipt_independent_validation_failed", "receipt-schema", error?.code);
  }
  if (registryResult.schema !== receiptSchema || independentResult.schema !== receiptSchema) {
    failEvidence("receipt_schema_wrong_class", "receipt-schema");
  }
  return registryResult.value;
}

function finalizeVnextReceipt(draft) {
  exactFields(draft, receiptDraftFieldNames, "receipt_draft_fields_invalid");
  const clonedDraft = cloneJsonValue(draft);
  const provisional = {
    ...clonedDraft,
    receiptId: `sha256:${"0".repeat(64)}`,
    canonicalContentSha256: "0".repeat(64)
  };
  const provisionalBytes = canonicalizeVnextJcsBytes(provisional, receiptJcsLimits);
  validateWithBoth(provisionalBytes);
  const digest = receiptDigest(provisional);
  const receipt = {
    ...clonedDraft,
    receiptId: `sha256:${digest}`,
    canonicalContentSha256: digest
  };
  const bytes = canonicalizeVnextJcsBytes(receipt, receiptJcsLimits);
  if (bytes.length > receiptMaximumBytes) failEvidence("receipt_byte_limit", "receipt-finalize");
  const validated = validateWithBoth(bytes);
  if (receiptDigest(validated) !== digest) failEvidence("receipt_identity_mismatch", "receipt-finalize");
  return immutableReceiptResult(validated, bytes);
}

function validateVnextReceiptBytes(input) {
  const bytes = Buffer.isBuffer(input)
    ? Buffer.from(input)
    : input instanceof Uint8Array
      ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
      : null;
  if (bytes === null) failEvidence("receipt_bytes_required", "receipt-read");
  if (bytes.length === 0 || bytes.length > receiptMaximumBytes) {
    failEvidence("receipt_byte_limit", "receipt-read");
  }
  const receipt = validateWithBoth(bytes);
  const canonical = canonicalizeVnextJcsBytes(receipt, receiptJcsLimits);
  if (!bytes.equals(canonical)) failEvidence("receipt_wire_not_canonical", "receipt-read");
  const digest = receiptDigest(receipt);
  if (receipt.receiptId !== `sha256:${digest}` || receipt.canonicalContentSha256 !== digest) {
    failEvidence("receipt_identity_mismatch", "receipt-read");
  }
  return immutableReceiptResult(receipt, canonical);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function immutableReceiptResult(receipt, bytes) {
  const canonical = Buffer.from(bytes);
  const result = {};
  Object.defineProperties(result, {
    receipt: {
      enumerable: true,
      value: deepFreeze(receipt)
    },
    bytes: {
      enumerable: true,
      get() {
        return Buffer.from(canonical);
      }
    }
  });
  return Object.freeze(result);
}

module.exports = Object.freeze({
  domainSeparatedDigest,
  finalizeVnextReceipt,
  receiptDigest,
  receiptDraftFieldNames,
  receiptIdentityDomain,
  receiptIdentityExcludedFields,
  receiptJcsLimits,
  receiptMaximumBytes,
  receiptSchema,
  validateVnextReceiptBytes
});
