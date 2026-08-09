"use strict";

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
  domainSeparatedDigest
} = require("./vnext-receipt-identity.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");
const registry = parseStrictJson(fs.readFileSync(registryPath));
const subjectIdFields = Object.freeze({
  artifact: "artifactId",
  claim: "claimId",
  context: "contextId",
  p2p: "manifestId",
  proof: "proofId",
  receipt: "receiptId",
  release: "releaseId"
});
const identityContractsBySchema = new Map();

for (const contract of registry.contracts) {
  if (contract.identityDomain === null) continue;
  const subjectIdField = subjectIdFields[contract.class];
  if (typeof subjectIdField !== "string") {
    failEvidence("identity_profile_invalid", "identity-profile");
  }
  const fieldNames = contract.fields.map((field) => field.name);
  const identityExcludedFields = Object.freeze([...contract.identityExcludedFields]);
  if (!fieldNames.includes(subjectIdField) ||
      !fieldNames.includes("canonicalContentSha256") ||
      !identityExcludedFields.includes("canonicalContentSha256")) {
    failEvidence("identity_profile_invalid", "identity-profile");
  }
  const subjectIdEqualsCanonicalHash =
    identityExcludedFields.includes(subjectIdField);
  identityContractsBySchema.set(contract.schema, Object.freeze({
    schema: contract.schema,
    contractClass: contract.class,
    identityDomain: contract.identityDomain,
    identityExcludedFields,
    fieldNames: Object.freeze(fieldNames),
    draftFieldNames: Object.freeze(fieldNames.filter((name) =>
      !identityExcludedFields.includes(name))),
    subjectIdField,
    canonicalHashField: "canonicalContentSha256",
    subjectIdEqualsCanonicalHash,
    maximumBytes: contract.maximumBytes
  }));
}

const identityContractSchemas = Object.freeze([...identityContractsBySchema.keys()].sort());
const jcsLimits = Object.freeze({
  maximumDepth: registry.limits.maximumDepth,
  maximumTotalEntries: registry.limits.maximumTotalEntries,
  maximumObjectMembers: registry.limits.maximumObjectMembers,
  maximumArrayItems: registry.limits.maximumArrayItems,
  maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits
});
const parserLimits = Object.freeze({
  maximumBytes: Math.max(...registry.contracts.map((contract) => contract.maximumBytes)),
  maximumDepth: registry.limits.maximumDepth,
  maximumTotalEntries: registry.limits.maximumTotalEntries,
  maximumObjectMembers: registry.limits.maximumObjectMembers,
  maximumArrayItems: registry.limits.maximumArrayItems,
  maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits,
  maximumNumberCharacters: registry.limits.maximumNumberCharacters
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(value, expected) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence("identity_draft_fields_invalid", "identity-finalize");
  }
  const names = Object.getOwnPropertyNames(value);
  const wanted = [...expected].sort();
  const actual = [...names].sort();
  if (actual.length !== wanted.length ||
      actual.some((name, index) => name !== wanted[index])) {
    failEvidence("identity_draft_fields_invalid", "identity-finalize");
  }
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence("identity_draft_fields_invalid", "identity-finalize");
    }
  }
}

function identityContractForSchema(schema) {
  if (typeof schema !== "string") {
    failEvidence("identity_schema_not_supported", "identity-profile");
  }
  const descriptor = identityContractsBySchema.get(schema);
  if (!descriptor) failEvidence("identity_schema_not_supported", "identity-profile");
  return descriptor;
}

function cloneJsonValue(value) {
  const bytes = canonicalizeVnextJcsBytes(value, jcsLimits);
  return parseStrictJson(bytes, parserLimits);
}

function identityContent(value, descriptor) {
  return Object.fromEntries(Object.entries(value).filter(([name]) =>
    !descriptor.identityExcludedFields.includes(name)));
}

function validateWithBoth(bytes) {
  let registryResult;
  let independentResult;
  try {
    registryResult = validateVnextSchemaWithRegistry(bytes);
  } catch (error) {
    throw new VnextEvidenceError("identity_registry_validation_failed",
      "identity-schema", error?.code);
  }
  try {
    independentResult = validateVnextSchemaIndependently(bytes);
  } catch (error) {
    throw new VnextEvidenceError("identity_independent_validation_failed",
      "identity-schema", error?.code);
  }
  if (registryResult.schema !== independentResult.schema ||
      registryResult.contractClass !== independentResult.contractClass) {
    failEvidence("identity_validator_disagreement", "identity-schema");
  }
  return Object.freeze({
    contractClass: registryResult.contractClass,
    schema: registryResult.schema,
    value: registryResult.value
  });
}

function provisionalField(fieldName) {
  return fieldName === "canonicalContentSha256"
    ? "0".repeat(64)
    : `sha256:${"0".repeat(64)}`;
}

function finalizeVnextIdentityDocument(draft) {
  if (!isPlainObject(draft)) {
    failEvidence("identity_draft_fields_invalid", "identity-finalize");
  }
  const schemaDescriptor = Object.getOwnPropertyDescriptor(draft, "schema");
  if (!schemaDescriptor || !("value" in schemaDescriptor)) {
    failEvidence("identity_draft_fields_invalid", "identity-finalize");
  }
  const descriptor = identityContractForSchema(schemaDescriptor.value);
  exactFields(draft, descriptor.draftFieldNames);
  const cloned = cloneJsonValue(draft);
  const provisional = {};
  for (const name of descriptor.fieldNames) {
    provisional[name] = descriptor.identityExcludedFields.includes(name)
      ? provisionalField(name)
      : cloned[name];
  }
  const provisionalBytes = canonicalizeVnextJcsBytes(provisional, jcsLimits);
  validateWithBoth(provisionalBytes);
  const digest = domainSeparatedDigest(descriptor.identityDomain,
    identityContent(provisional, descriptor));
  const finalized = { ...provisional, [descriptor.canonicalHashField]: digest };
  if (descriptor.subjectIdEqualsCanonicalHash) {
    finalized[descriptor.subjectIdField] = `sha256:${digest}`;
  }
  const bytes = canonicalizeVnextJcsBytes(finalized, jcsLimits);
  if (bytes.length > descriptor.maximumBytes) {
    failEvidence("identity_byte_limit", "identity-finalize");
  }
  return validateVnextIdentityDocumentBytes(bytes);
}

function normalizeBytes(input) {
  if (Buffer.isBuffer(input)) return Buffer.from(input);
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  failEvidence("identity_bytes_required", "identity-read");
}

function validateVnextIdentityDocumentBytes(input) {
  const bytes = normalizeBytes(input);
  if (bytes.length === 0 || bytes.length > parserLimits.maximumBytes) {
    failEvidence("identity_byte_limit", "identity-read");
  }
  const validated = validateWithBoth(bytes);
  const descriptor = identityContractForSchema(validated.schema);
  if (bytes.length > descriptor.maximumBytes) {
    failEvidence("identity_byte_limit", "identity-read");
  }
  const canonical = canonicalizeVnextJcsBytes(validated.value, jcsLimits);
  if (!bytes.equals(canonical)) {
    failEvidence("identity_wire_not_canonical", "identity-read");
  }
  const digest = domainSeparatedDigest(descriptor.identityDomain,
    identityContent(validated.value, descriptor));
  const subjectId = validated.value[descriptor.subjectIdField];
  if (validated.value[descriptor.canonicalHashField] !== digest ||
      descriptor.subjectIdEqualsCanonicalHash && subjectId !== `sha256:${digest}`) {
    failEvidence("identity_material_mismatch", "identity-read");
  }
  return immutableIdentityResult({
    contractClass: descriptor.contractClass,
    schema: descriptor.schema,
    subjectId,
    canonicalContentSha256: digest,
    value: validated.value
  }, canonical);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function immutableIdentityResult(value, bytes) {
  const canonical = Buffer.from(bytes);
  const result = {
    contractClass: value.contractClass,
    schema: value.schema,
    subjectId: value.subjectId,
    canonicalContentSha256: value.canonicalContentSha256,
    value: deepFreeze(value.value)
  };
  Object.defineProperty(result, "bytes", {
    enumerable: true,
    get() {
      return Buffer.from(canonical);
    }
  });
  return Object.freeze(result);
}

module.exports = Object.freeze({
  finalizeVnextIdentityDocument,
  identityContractForSchema,
  identityContractSchemas,
  validateVnextIdentityDocumentBytes
});
