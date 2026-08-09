"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  parseStrictJson
} = require("./strict-json.js");
const {
  canonicalizeVnextJcsBytes
} = require("./vnext-jcs.js");
const {
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const {
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const {
  collectParentReceiptIds
} = require("./vnext-receipt-store.js");
const {
  signatureProfile,
  utcNanoseconds
} = require("./vnext-signature-payload.js");
const {
  verifyVnextAuthorityGraph
} = require("./vnext-signature-authority.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot,
  "offline-verification-bundle-profile.v1.json");
const registryPath = path.join(contractRoot, "contract-family.v1.json");
const signatureProfilePath = path.join(contractRoot,
  "receipt-signature-profile.v1.json");
const storeProfilePath = path.join(contractRoot, "receipt-store-profile.v1.json");

const profileBytes = fs.readFileSync(profilePath);
const registryBytes = fs.readFileSync(registryPath);
const signatureProfileBytes = fs.readFileSync(signatureProfilePath);
const storeProfileBytes = fs.readFileSync(storeProfilePath);
const parsedProfile = parseStrictJson(profileBytes);
const registry = parseStrictJson(registryBytes);
const parsedSignatureProfile = parseStrictJson(signatureProfileBytes);
const storeProfile = parseStrictJson(storeProfileBytes);

const digestPattern = /^[a-f0-9]{64}$/u;
const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const environments = new Set(["development", "production", "staging"]);
const builderInputFields = Object.freeze([
  "campaignId",
  "createdAtUtc",
  "environment",
  "expectedTerminalRegistryReceiptId",
  "receiptBytes",
  "subjectBytes",
  "targetSignatureReceiptIds",
  "trustedRootRegistryReceiptId"
].sort());
const verifierInputFields = Object.freeze([
  "bundleManifestBytes",
  "expectedBundleManifestSha256",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "receiptBytes",
  "subjectBytes",
  "trustedRootRegistryReceiptId",
  "verificationReceiptBytes",
  "verificationTimeUtc"
].sort());

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, expected, code, step = "offline-bundle-input") {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  const actual = [...names].sort();
  if (actual.length !== expected.length ||
      actual.some((name, index) => name !== expected[index])) {
    failEvidence(code, step);
  }
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
  }
}

function exactDataArray(value, maximum, code, step = "offline-bundle-input") {
  if (!Array.isArray(value) || value.length > maximum ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || names[names.length - 1] !== "length") {
    failEvidence(code, step);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
  }
}

function normalizedBytes(value, code, step = "offline-bundle-input") {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  failEvidence(code, step);
}

function boundedByteArray(value, maximumCount, maximumBytes, code) {
  exactDataArray(value, maximumCount, code);
  const result = [];
  let totalBytes = 0;
  for (const item of value) {
    const bytes = normalizedBytes(item, code);
    totalBytes += bytes.length;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumBytes) {
      failEvidence(code, "offline-bundle-input");
    }
    result.push(bytes);
  }
  return { bytes: result, totalBytes };
}

function boundedFailure(code, step, error) {
  throw new VnextEvidenceError(code, step, error?.code ?? null);
}

function requiredTime(value, code, step = "offline-bundle-time") {
  const parsed = utcNanoseconds(value);
  if (parsed === null) failEvidence(code, step);
  return parsed;
}

function requireDigest(value, code, step = "offline-bundle-manifest") {
  if (typeof value !== "string" || !digestPattern.test(value)) {
    failEvidence(code, step);
  }
}

function requireContentId(value, code, step = "offline-bundle-manifest") {
  if (typeof value !== "string" || !contentIdPattern.test(value)) {
    failEvidence(code, step);
  }
}

function requireSafeId(value, code, step = "offline-bundle-manifest") {
  if (typeof value !== "string" || !safeIdPattern.test(value)) {
    failEvidence(code, step);
  }
}

function sameStrings(left, right) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sameBindings(left, right) {
  return left.length === right.length && left.every((entry, index) => {
    const expected = right[index];
    const names = Object.keys(expected);
    return names.length === Object.keys(entry).length &&
      names.every((name) => entry[name] === expected[name]);
  });
}

function requireSortedUniqueStrings(values, maximum, pattern, code,
  minimum = 0, step = "offline-bundle-manifest") {
  exactDataArray(values, maximum, code, step);
  if (values.length < minimum) failEvidence(code, step);
  let previous = null;
  for (const value of values) {
    if (typeof value !== "string" || !pattern.test(value) ||
        previous !== null && value <= previous) {
      failEvidence(code, step);
    }
    previous = value;
  }
}

const jcsLimits = Object.freeze({
  maximumDepth: parsedProfile.limits.maximumDepth,
  maximumTotalEntries: parsedProfile.limits.maximumTotalEntries,
  maximumObjectMembers: parsedProfile.limits.maximumObjectMembers,
  maximumArrayItems: parsedProfile.limits.maximumArrayItems,
  maximumStringCodeUnits: parsedProfile.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: parsedProfile.limits.maximumTotalStringCodeUnits
});
const parserLimits = Object.freeze({
  maximumBytes: parsedProfile.limits.maximumManifestBytes,
  ...jcsLimits,
  maximumNumberCharacters: parsedProfile.limits.maximumNumberCharacters
});
const offlineBundleProfileSha256 = sha256(profileBytes);
const registrySha256 = sha256(registryBytes);
const signatureProfileSha256 = sha256(signatureProfileBytes);
const storeProfileSha256 = sha256(storeProfileBytes);
const offlineBundleRecord = registry.records.find((record) =>
  record.name === "offlineBundle");
const offlineBundleFields = new Map((offlineBundleRecord?.fields ?? []).map((field) =>
  [field.name, field]));

function validateInstalledProfiles() {
  if (parsedProfile.schema !== "tinyrustlm.vnext.offline_bundle_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.offline-bundle.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.manifestSchema !== "tinyrustlm.vnext.offline_bundle_manifest.v1" ||
      parsedProfile.receiptSchema !== "tinyrustlm.vnext.receipt.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.authorityPolicy.networkAccess !== "forbidden" ||
      parsedProfile.limits.maximumReceipts !==
        offlineBundleFields.get("receiptIds")?.maximumItems ||
      parsedProfile.limits.maximumReceipts > signatureProfile.limits.maximumReceipts ||
      parsedProfile.limits.maximumSubjectDocuments !==
        signatureProfile.limits.maximumSubjectDocuments ||
      parsedProfile.limits.maximumTargetSignatures >
        offlineBundleFields.get("signatureEnvelopeReceiptIds")?.maximumItems ||
      parsedProfile.limits.maximumTotalReceiptBytes !==
        signatureProfile.limits.maximumTotalReceiptBytes ||
      parsedProfile.limits.maximumTotalSubjectBytes !==
        signatureProfile.limits.maximumTotalSubjectBytes ||
      registry.schema !== "tinyrustlm.vnext.contract_registry.v1" ||
      registry.contracts.length !== parsedProfile.limits.maximumSchemaBindings ||
      parsedSignatureProfile.profileId !== signatureProfile.profileId ||
      storeProfile.profileId !== "tinyrustlm.vnext.receipt-store.v1" ||
      storeProfile.contractRegistrySha256 !== registrySha256) {
    failEvidence("offline_bundle_profile_invalid", "offline-bundle-profile");
  }
}

validateInstalledProfiles();

const offlineBundleProfile = deepFreeze({
  ...parsedProfile,
  jcsLimits
});
const registryJcsLimits = Object.freeze({
  maximumDepth: registry.limits.maximumDepth,
  maximumTotalEntries: registry.limits.maximumTotalEntries,
  maximumObjectMembers: registry.limits.maximumObjectMembers,
  maximumArrayItems: registry.limits.maximumArrayItems,
  maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits
});
const installedProfileBindings = deepFreeze([
  {
    name: "contract-registry",
    documentKind: "contract-registry",
    documentId: registry.familyId,
    byteLength: registryBytes.length,
    sha256: registrySha256
  },
  {
    name: "offline-bundle-profile",
    documentKind: "profile",
    documentId: parsedProfile.profileId,
    byteLength: profileBytes.length,
    sha256: offlineBundleProfileSha256
  },
  {
    name: "receipt-signature-profile",
    documentKind: "profile",
    documentId: parsedSignatureProfile.profileId,
    byteLength: signatureProfileBytes.length,
    sha256: signatureProfileSha256
  },
  {
    name: "receipt-store-profile",
    documentKind: "profile",
    documentId: storeProfile.profileId,
    byteLength: storeProfileBytes.length,
    sha256: storeProfileSha256
  }
]);
const installedSchemaHashes = deepFreeze(registry.contracts
  .map((contract) => ({
    name: contract.schema,
    sha256: sha256(canonicalizeVnextJcsBytes(contract, registryJcsLimits))
  }))
  .sort((left, right) => left.name.localeCompare(right.name)));

function parseReceiptMember(bytes) {
  let entry;
  try {
    entry = validateVnextReceiptBytes(bytes);
  } catch (error) {
    boundedFailure("offline_bundle_receipt_invalid", "offline-bundle-member", error);
  }
  return {
    parsed: entry,
    id: entry.receipt.receiptId,
    metadata: {
      receiptId: entry.receipt.receiptId,
      receiptType: entry.receipt.receiptType,
      schema: entry.receipt.schema,
      byteLength: bytes.length,
      sha256: sha256(bytes)
    },
    bytes
  };
}

function parseSubjectMember(bytes) {
  let entry;
  try {
    entry = validateVnextIdentityDocumentBytes(bytes);
  } catch (error) {
    boundedFailure("offline_bundle_subject_invalid", "offline-bundle-member", error);
  }
  if (entry.contractClass === "receipt") {
    failEvidence("offline_bundle_subject_invalid", "offline-bundle-member");
  }
  return {
    parsed: entry,
    id: entry.subjectId,
    metadata: {
      subjectId: entry.subjectId,
      contractClass: entry.contractClass,
      schema: entry.schema,
      byteLength: bytes.length,
      sha256: sha256(bytes)
    },
    bytes
  };
}

function parseMembers(receiptInput, subjectInput, campaignId) {
  const receipts = [];
  const receiptMap = new Map();
  for (const bytes of receiptInput.bytes) {
    const member = parseReceiptMember(bytes);
    if (receiptMap.has(member.id)) {
      failEvidence("offline_bundle_receipt_duplicate", "offline-bundle-member");
    }
    if (member.parsed.receipt.receiptType === "offline-verification-bundle") {
      failEvidence("offline_bundle_recursive_receipt", "offline-bundle-member");
    }
    if (member.parsed.receipt.campaignId !== campaignId) {
      failEvidence("offline_bundle_campaign_mismatch", "offline-bundle-member");
    }
    receiptMap.set(member.id, member);
    receipts.push(member);
  }

  const subjects = [];
  const subjectMap = new Map();
  for (const bytes of subjectInput.bytes) {
    const member = parseSubjectMember(bytes);
    if (subjectMap.has(member.id) || receiptMap.has(member.id)) {
      failEvidence("offline_bundle_subject_duplicate", "offline-bundle-member");
    }
    if (Object.hasOwn(member.parsed.value, "campaignId") &&
        member.parsed.value.campaignId !== campaignId) {
      failEvidence("offline_bundle_campaign_mismatch", "offline-bundle-member");
    }
    subjectMap.set(member.id, member);
    subjects.push(member);
  }
  receipts.sort((left, right) => left.id.localeCompare(right.id));
  subjects.sort((left, right) => left.id.localeCompare(right.id));
  return {
    receipts,
    receiptMap,
    subjects,
    subjectMap,
    totalReceiptBytes: receiptInput.totalBytes,
    totalSubjectBytes: subjectInput.totalBytes
  };
}

function categoryIds(members) {
  const result = {
    receiptIds: [],
    signatureEnvelopeReceiptIds: [],
    authorityRegistryReceiptIds: [],
    revocationReceiptIds: []
  };
  for (const member of members.receipts) {
    const type = member.parsed.receipt.receiptType;
    result.receiptIds.push(member.id);
    if (type === "signature-envelope") {
      result.signatureEnvelopeReceiptIds.push(member.id);
    } else if (type === "authority-registry") {
      result.authorityRegistryReceiptIds.push(member.id);
    } else if (type === "key-revocation") {
      result.revocationReceiptIds.push(member.id);
    }
  }
  return deepFreeze(result);
}

function immutableManifestResult(manifest, bytes, categories) {
  const canonical = Buffer.from(bytes);
  const allReceiptIds = Object.freeze([...categories.receiptIds]);
  const result = {
    manifest: deepFreeze(manifest),
    manifestSha256: sha256(canonical),
    profileSha256: offlineBundleProfileSha256,
    schemaHashes: installedSchemaHashes,
    receiptIds: categories.receiptIds,
    signatureEnvelopeReceiptIds: categories.signatureEnvelopeReceiptIds,
    authorityRegistryReceiptIds: categories.authorityRegistryReceiptIds,
    revocationReceiptIds: categories.revocationReceiptIds,
    allReceiptIds
  };
  Object.defineProperty(result, "bytes", {
    enumerable: true,
    get() {
      return Buffer.from(canonical);
    }
  });
  return Object.freeze(result);
}

function parseBuilderInput(rawInput) {
  exactDataObject(rawInput, builderInputFields,
    "offline_bundle_builder_input_fields_invalid");
  requireSafeId(rawInput.campaignId, "offline_bundle_builder_input_invalid",
    "offline-bundle-input");
  if (!environments.has(rawInput.environment)) {
    failEvidence("offline_bundle_builder_input_invalid", "offline-bundle-input");
  }
  requireContentId(rawInput.trustedRootRegistryReceiptId,
    "offline_bundle_builder_input_invalid", "offline-bundle-input");
  requireContentId(rawInput.expectedTerminalRegistryReceiptId,
    "offline_bundle_builder_input_invalid", "offline-bundle-input");
  requiredTime(rawInput.createdAtUtc, "offline_bundle_creation_time_invalid");
  requireSortedUniqueStrings(rawInput.targetSignatureReceiptIds,
    parsedProfile.limits.maximumTargetSignatures, contentIdPattern,
    "offline_bundle_target_list_invalid", 1, "offline-bundle-input");
  const receiptInput = boundedByteArray(rawInput.receiptBytes,
    parsedProfile.limits.maximumReceipts,
    parsedProfile.limits.maximumTotalReceiptBytes,
    "offline_bundle_receipt_input_invalid");
  const subjectInput = boundedByteArray(rawInput.subjectBytes,
    parsedProfile.limits.maximumSubjectDocuments,
    parsedProfile.limits.maximumTotalSubjectBytes,
    "offline_bundle_subject_input_invalid");
  return { ...rawInput, receiptInput, subjectInput };
}

function finalizeVnextOfflineBundleManifest(rawInput) {
  const input = parseBuilderInput(rawInput);
  const members = parseMembers(input.receiptInput, input.subjectInput, input.campaignId);
  const categories = categoryIds(members);
  const signatures = new Set(categories.signatureEnvelopeReceiptIds);
  if (input.targetSignatureReceiptIds.some((id) => !signatures.has(id))) {
    failEvidence("offline_bundle_target_signature_missing", "offline-bundle-build");
  }
  if (!members.receiptMap.has(input.trustedRootRegistryReceiptId) ||
      !members.receiptMap.has(input.expectedTerminalRegistryReceiptId) ||
      members.receiptMap.get(input.trustedRootRegistryReceiptId)
        .parsed.receipt.receiptType !== "authority-registry" ||
      members.receiptMap.get(input.expectedTerminalRegistryReceiptId)
        .parsed.receipt.receiptType !== "authority-registry") {
    failEvidence("offline_bundle_registry_pin_missing", "offline-bundle-build");
  }

  const manifest = {
    schema: parsedProfile.manifestSchema,
    profileId: parsedProfile.profileId,
    bundleState: parsedProfile.manifestState,
    canonicalJsonProfile: parsedProfile.canonicalJsonProfile,
    campaignId: input.campaignId,
    environment: input.environment,
    createdAtUtc: input.createdAtUtc,
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    profileBindings: installedProfileBindings,
    schemaHashes: installedSchemaHashes,
    targetSignatureReceiptIds: Object.freeze([...input.targetSignatureReceiptIds]),
    receipts: members.receipts.map((member) => member.metadata),
    subjects: members.subjects.map((member) => member.metadata),
    totals: {
      receiptCount: members.receipts.length,
      subjectCount: members.subjects.length,
      totalReceiptBytes: members.totalReceiptBytes,
      totalSubjectBytes: members.totalSubjectBytes
    }
  };
  const bytes = canonicalizeVnextJcsBytes(manifest, jcsLimits);
  if (bytes.length > parsedProfile.limits.maximumManifestBytes) {
    failEvidence("offline_bundle_manifest_size_invalid", "offline-bundle-build");
  }
  return immutableManifestResult(manifest, bytes, categories);
}

function validateBindingArray(values, expected, fields, code) {
  exactDataArray(values, expected.length, code, "offline-bundle-manifest");
  if (values.length !== expected.length) failEvidence(code, "offline-bundle-manifest");
  for (const value of values) {
    exactDataObject(value, [...fields].sort(), code, "offline-bundle-manifest");
  }
  if (!sameBindings(values, expected)) failEvidence(code, "offline-bundle-manifest");
}

function validateManifestMembers(manifest) {
  exactDataArray(manifest.receipts, parsedProfile.limits.maximumReceipts,
    "offline_bundle_manifest_receipts_invalid", "offline-bundle-manifest");
  let previous = null;
  for (const member of manifest.receipts) {
    exactDataObject(member, [...parsedProfile.receiptMemberFields].sort(),
      "offline_bundle_manifest_receipts_invalid", "offline-bundle-manifest");
    requireContentId(member.receiptId, "offline_bundle_manifest_receipts_invalid");
    if (typeof member.receiptType !== "string" ||
        member.schema !== parsedProfile.receiptSchema ||
        !Number.isSafeInteger(member.byteLength) || member.byteLength < 1 ||
        member.byteLength > 262144 || previous !== null && member.receiptId <= previous) {
      failEvidence("offline_bundle_manifest_receipts_invalid",
        "offline-bundle-manifest");
    }
    requireDigest(member.sha256, "offline_bundle_manifest_receipts_invalid");
    previous = member.receiptId;
  }

  exactDataArray(manifest.subjects, parsedProfile.limits.maximumSubjectDocuments,
    "offline_bundle_manifest_subjects_invalid", "offline-bundle-manifest");
  previous = null;
  for (const member of manifest.subjects) {
    exactDataObject(member, [...parsedProfile.subjectMemberFields].sort(),
      "offline_bundle_manifest_subjects_invalid", "offline-bundle-manifest");
    requireContentId(member.subjectId, "offline_bundle_manifest_subjects_invalid");
    requireSafeId(member.contractClass, "offline_bundle_manifest_subjects_invalid");
    requireSafeId(member.schema, "offline_bundle_manifest_subjects_invalid");
    if (!Number.isSafeInteger(member.byteLength) || member.byteLength < 1 ||
        member.byteLength > parsedProfile.limits.maximumTotalSubjectBytes ||
        previous !== null && member.subjectId <= previous) {
      failEvidence("offline_bundle_manifest_subjects_invalid",
        "offline-bundle-manifest");
    }
    requireDigest(member.sha256, "offline_bundle_manifest_subjects_invalid");
    previous = member.subjectId;
  }
}

function validateManifestShape(manifest) {
  exactDataObject(manifest, [...parsedProfile.manifestFields].sort(),
    "offline_bundle_manifest_fields_invalid", "offline-bundle-manifest");
  if (manifest.schema !== parsedProfile.manifestSchema ||
      manifest.profileId !== parsedProfile.profileId ||
      manifest.bundleState !== parsedProfile.manifestState ||
      manifest.canonicalJsonProfile !== parsedProfile.canonicalJsonProfile) {
    failEvidence("offline_bundle_manifest_profile_invalid", "offline-bundle-manifest");
  }
  requireSafeId(manifest.campaignId, "offline_bundle_manifest_value_invalid");
  if (!environments.has(manifest.environment)) {
    failEvidence("offline_bundle_manifest_value_invalid", "offline-bundle-manifest");
  }
  requireContentId(manifest.trustedRootRegistryReceiptId,
    "offline_bundle_manifest_value_invalid");
  requireContentId(manifest.expectedTerminalRegistryReceiptId,
    "offline_bundle_manifest_value_invalid");
  requiredTime(manifest.createdAtUtc, "offline_bundle_creation_time_invalid");
  validateBindingArray(manifest.profileBindings, installedProfileBindings,
    parsedProfile.profileBindingFields, "offline_bundle_profile_binding_mismatch");
  validateBindingArray(manifest.schemaHashes, installedSchemaHashes,
    parsedProfile.schemaBindingFields, "offline_bundle_schema_binding_mismatch");
  requireSortedUniqueStrings(manifest.targetSignatureReceiptIds,
    parsedProfile.limits.maximumTargetSignatures, contentIdPattern,
    "offline_bundle_target_list_invalid", 1);
  validateManifestMembers(manifest);
  exactDataObject(manifest.totals, [...parsedProfile.totalsFields].sort(),
    "offline_bundle_totals_invalid", "offline-bundle-manifest");
  const expectedTotals = {
    receiptCount: manifest.receipts.length,
    subjectCount: manifest.subjects.length,
    totalReceiptBytes: manifest.receipts.reduce((sum, entry) =>
      sum + entry.byteLength, 0),
    totalSubjectBytes: manifest.subjects.reduce((sum, entry) =>
      sum + entry.byteLength, 0)
  };
  if (Object.keys(expectedTotals).some((name) =>
    !Number.isSafeInteger(manifest.totals[name]) ||
    manifest.totals[name] !== expectedTotals[name]) ||
      expectedTotals.totalReceiptBytes > parsedProfile.limits.maximumTotalReceiptBytes ||
      expectedTotals.totalSubjectBytes > parsedProfile.limits.maximumTotalSubjectBytes) {
    failEvidence("offline_bundle_totals_invalid", "offline-bundle-manifest");
  }
}

function parseManifest(bytes, expectedSha256) {
  if (bytes.length === 0 || bytes.length > parsedProfile.limits.maximumManifestBytes) {
    failEvidence("offline_bundle_manifest_invalid", "offline-bundle-read");
  }
  let manifest;
  try {
    manifest = parseStrictJson(bytes, parserLimits);
  } catch (error) {
    boundedFailure("offline_bundle_manifest_invalid", "offline-bundle-read", error);
  }
  validateManifestShape(manifest);
  let canonical;
  try {
    canonical = canonicalizeVnextJcsBytes(manifest, jcsLimits);
  } catch (error) {
    boundedFailure("offline_bundle_manifest_invalid", "offline-bundle-read", error);
  }
  if (!bytes.equals(canonical)) {
    failEvidence("offline_bundle_manifest_noncanonical", "offline-bundle-read");
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) {
    failEvidence("offline_bundle_manifest_hash_mismatch", "offline-bundle-read");
  }
  return { manifest, sha256: actualSha256 };
}

function parseVerifierInput(rawInput) {
  exactDataObject(rawInput, verifierInputFields, "offline_bundle_input_fields_invalid");
  requireDigest(rawInput.expectedBundleManifestSha256,
    "offline_bundle_input_value_invalid", "offline-bundle-input");
  requireSafeId(rawInput.expectedCampaignId, "offline_bundle_input_value_invalid",
    "offline-bundle-input");
  if (!environments.has(rawInput.expectedEnvironment)) {
    failEvidence("offline_bundle_input_value_invalid", "offline-bundle-input");
  }
  requireContentId(rawInput.trustedRootRegistryReceiptId,
    "offline_bundle_input_value_invalid", "offline-bundle-input");
  requireContentId(rawInput.expectedTerminalRegistryReceiptId,
    "offline_bundle_input_value_invalid", "offline-bundle-input");
  const verificationTime = requiredTime(rawInput.verificationTimeUtc,
    "offline_bundle_verification_time_invalid", "offline-bundle-input");
  const bundleManifestBytes = normalizedBytes(rawInput.bundleManifestBytes,
    "offline_bundle_manifest_input_invalid");
  const verificationReceiptBytes = normalizedBytes(rawInput.verificationReceiptBytes,
    "offline_bundle_verification_receipt_input_invalid");
  if (verificationReceiptBytes.length === 0 || verificationReceiptBytes.length > 262144) {
    failEvidence("offline_bundle_verification_receipt_input_invalid",
      "offline-bundle-input");
  }
  const receiptInput = boundedByteArray(rawInput.receiptBytes,
    parsedProfile.limits.maximumReceipts,
    parsedProfile.limits.maximumTotalReceiptBytes,
    "offline_bundle_receipt_input_invalid");
  const subjectInput = boundedByteArray(rawInput.subjectBytes,
    parsedProfile.limits.maximumSubjectDocuments,
    parsedProfile.limits.maximumTotalSubjectBytes,
    "offline_bundle_subject_input_invalid");
  return {
    ...rawInput,
    bundleManifestBytes,
    verificationReceiptBytes,
    receiptInput,
    subjectInput,
    verificationTime
  };
}

function metadataMatches(actual, expected) {
  return Object.keys(expected).every((name) => actual[name] === expected[name]);
}

function requireExactMembers(members, manifest) {
  const expectedReceipts = new Map(manifest.receipts.map((entry) =>
    [entry.receiptId, entry]));
  for (const expected of manifest.receipts) {
    const actual = members.receiptMap.get(expected.receiptId);
    if (!actual) failEvidence("offline_bundle_receipt_missing", "offline-bundle-member");
    if (actual.metadata.sha256 !== expected.sha256) {
      failEvidence("offline_bundle_member_hash_mismatch", "offline-bundle-member");
    }
    if (!metadataMatches(actual.metadata, expected)) {
      failEvidence("offline_bundle_member_metadata_mismatch", "offline-bundle-member");
    }
  }
  for (const id of members.receiptMap.keys()) {
    if (!expectedReceipts.has(id)) {
      failEvidence("offline_bundle_receipt_extra", "offline-bundle-member");
    }
  }

  const expectedSubjects = new Map(manifest.subjects.map((entry) =>
    [entry.subjectId, entry]));
  for (const expected of manifest.subjects) {
    const actual = members.subjectMap.get(expected.subjectId);
    if (!actual) failEvidence("offline_bundle_subject_missing", "offline-bundle-member");
    if (actual.metadata.sha256 !== expected.sha256) {
      failEvidence("offline_bundle_member_hash_mismatch", "offline-bundle-member");
    }
    if (!metadataMatches(actual.metadata, expected)) {
      failEvidence("offline_bundle_member_metadata_mismatch", "offline-bundle-member");
    }
  }
  for (const id of members.subjectMap.keys()) {
    if (!expectedSubjects.has(id)) {
      failEvidence("offline_bundle_subject_extra", "offline-bundle-member");
    }
  }
}

function parseVerificationReceipt(bytes) {
  try {
    return validateVnextReceiptBytes(bytes);
  } catch (error) {
    boundedFailure("offline_bundle_verification_receipt_invalid",
      "offline-bundle-receipt", error);
  }
}

function requireVerificationReceipt(entry, manifest, manifestSha256, categories) {
  const receipt = entry.receipt;
  if (receipt.receiptType !== parsedProfile.verificationReceiptType ||
      receipt.status !== "pass" || receipt.offlineBundle === null ||
      receipt.campaignId !== manifest.campaignId) {
    failEvidence("offline_bundle_verification_receipt_invalid",
      "offline-bundle-receipt");
  }
  const payload = receipt.offlineBundle;
  if (payload.bundleManifestSha256 !== manifestSha256 ||
      payload.createdAtUtc !== manifest.createdAtUtc ||
      !sameBindings(payload.schemaHashes, installedSchemaHashes)) {
    failEvidence("offline_bundle_receipt_manifest_binding_mismatch",
      "offline-bundle-receipt");
  }
  if (!sameStrings(payload.receiptIds, categories.receiptIds) ||
      !sameStrings(payload.signatureEnvelopeReceiptIds,
        categories.signatureEnvelopeReceiptIds) ||
      !sameStrings(payload.authorityRegistryReceiptIds,
        categories.authorityRegistryReceiptIds) ||
      !sameStrings(payload.revocationReceiptIds, categories.revocationReceiptIds)) {
    failEvidence("offline_bundle_receipt_categories_mismatch",
      "offline-bundle-receipt");
  }
  const allReceiptIds = [...categories.receiptIds];
  if (!sameStrings(receipt.inputReceiptIds, allReceiptIds)) {
    failEvidence("offline_bundle_receipt_parents_mismatch", "offline-bundle-receipt");
  }
  if (receipt.inputHashes.length !== 1 ||
      receipt.inputHashes[0].name !== parsedProfile.verificationReceiptInputHashName ||
      receipt.inputHashes[0].sha256 !== manifestSha256) {
    failEvidence("offline_bundle_receipt_manifest_binding_mismatch",
      "offline-bundle-receipt");
  }
  if (receipt.startedAtUtc !== manifest.createdAtUtc ||
      receipt.completedAtUtc !== manifest.createdAtUtc ||
      allReceiptIds.includes(receipt.receiptId)) {
    failEvidence("offline_bundle_verification_receipt_invalid",
      "offline-bundle-receipt");
  }
  return allReceiptIds;
}

function signatureIndex(members) {
  const index = new Map();
  for (const member of members.receipts) {
    if (member.parsed.receipt.receiptType !== "signature-envelope") continue;
    const envelope = member.parsed.receipt.signatureEnvelope;
    const key = `${envelope.signedSubjectId}\0${envelope.scope}`;
    const values = index.get(key) ?? [];
    values.push(member);
    index.set(key, values);
  }
  return index;
}

function oneIndexedSignature(index, subjectId, scope) {
  const entries = index.get(`${subjectId}\0${scope}`) ?? [];
  if (entries.length !== 1) {
    failEvidence("offline_bundle_governance_signature_invalid",
      "offline-bundle-closure");
  }
  return entries[0];
}

function requireClosedMembership(members, manifest, authority) {
  const signatures = signatureIndex(members);
  const requiredReceiptIds = new Set();
  const requiredSubjectIds = new Set();
  const governanceScopes = new Set(["authority-registry", "key-revocation"]);

  for (const member of members.receipts) {
    const receipt = member.parsed.receipt;
    if (receipt.receiptType === "authority-registry" ||
        receipt.receiptType === "key-revocation") {
      requiredReceiptIds.add(member.id);
    }
    if (receipt.receiptType === "authority-registry" &&
        receipt.authorityRegistry.previousRegistryReceiptId !== null) {
      requiredReceiptIds.add(oneIndexedSignature(signatures, member.id,
        "authority-registry").id);
    }
    if (receipt.receiptType === "key-revocation") {
      requiredReceiptIds.add(oneIndexedSignature(signatures, member.id,
        "key-revocation").id);
    }
  }

  const authorityBySignatureId = new Map(authority.signatures.map((entry) =>
    [entry.signatureReceiptId, entry]));
  for (const id of manifest.targetSignatureReceiptIds) {
    const member = members.receiptMap.get(id);
    if (!member || member.parsed.receipt.receiptType !== "signature-envelope") {
      failEvidence("offline_bundle_target_signature_missing", "offline-bundle-closure");
    }
    const envelope = member.parsed.receipt.signatureEnvelope;
    if (governanceScopes.has(envelope.scope)) {
      failEvidence("offline_bundle_target_signature_invalid", "offline-bundle-closure");
    }
    requiredReceiptIds.add(id);
    if (envelope.signedSchema === parsedProfile.receiptSchema) {
      requiredReceiptIds.add(envelope.signedSubjectId);
    } else {
      requiredSubjectIds.add(envelope.signedSubjectId);
    }
    const result = authorityBySignatureId.get(id);
    if (!result || result.currentEvidenceEligible !== true) {
      failEvidence("offline_bundle_target_stale", "offline-bundle-currentness");
    }
  }

  const pending = [...requiredReceiptIds];
  for (let index = 0; index < pending.length; index += 1) {
    const id = pending[index];
    const member = members.receiptMap.get(id);
    if (!member) {
      failEvidence("offline_bundle_receipt_closure_incomplete",
        "offline-bundle-closure");
    }
    for (const parentId of collectParentReceiptIds(member.parsed.receipt)) {
      if (!members.receiptMap.has(parentId)) {
        failEvidence("offline_bundle_receipt_closure_incomplete",
          "offline-bundle-closure");
      }
      if (!requiredReceiptIds.has(parentId)) {
        requiredReceiptIds.add(parentId);
        pending.push(parentId);
      }
    }
  }

  if (requiredReceiptIds.size !== members.receiptMap.size ||
      [...members.receiptMap.keys()].some((id) => !requiredReceiptIds.has(id))) {
    failEvidence("offline_bundle_receipt_unlinked", "offline-bundle-closure");
  }
  for (const id of requiredSubjectIds) {
    if (!members.subjectMap.has(id)) {
      failEvidence("offline_bundle_subject_missing", "offline-bundle-closure");
    }
  }
  if (requiredSubjectIds.size !== members.subjectMap.size ||
      [...members.subjectMap.keys()].some((id) => !requiredSubjectIds.has(id))) {
    failEvidence("offline_bundle_subject_unlinked", "offline-bundle-closure");
  }
}

function verifyVnextOfflineBundle(rawInput) {
  const input = parseVerifierInput(rawInput);
  const parsedManifest = parseManifest(input.bundleManifestBytes,
    input.expectedBundleManifestSha256);
  const manifest = parsedManifest.manifest;
  if (manifest.campaignId !== input.expectedCampaignId) {
    failEvidence("offline_bundle_campaign_mismatch", "offline-bundle-pins");
  }
  if (manifest.environment !== input.expectedEnvironment) {
    failEvidence("offline_bundle_environment_mismatch", "offline-bundle-pins");
  }
  if (manifest.trustedRootRegistryReceiptId !== input.trustedRootRegistryReceiptId) {
    failEvidence("offline_bundle_trust_pin_mismatch", "offline-bundle-pins");
  }
  if (manifest.expectedTerminalRegistryReceiptId !==
      input.expectedTerminalRegistryReceiptId) {
    failEvidence("offline_bundle_terminal_pin_mismatch", "offline-bundle-pins");
  }
  if (requiredTime(manifest.createdAtUtc, "offline_bundle_creation_time_invalid") >
      input.verificationTime) {
    failEvidence("offline_bundle_created_in_future", "offline-bundle-currentness");
  }

  const members = parseMembers(input.receiptInput, input.subjectInput,
    input.expectedCampaignId);
  requireExactMembers(members, manifest);
  const categories = categoryIds(members);
  const verificationReceipt = parseVerificationReceipt(input.verificationReceiptBytes);
  requireVerificationReceipt(verificationReceipt, manifest,
    parsedManifest.sha256, categories);

  const authority = verifyVnextAuthorityGraph({
    campaignId: input.expectedCampaignId,
    environment: input.expectedEnvironment,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytes: input.receiptInput.bytes,
    subjectBytes: input.subjectInput.bytes,
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    verificationTimeUtc: input.verificationTimeUtc
  });
  if (!authority.terminalRegistryCurrent) {
    failEvidence("offline_bundle_terminal_registry_stale",
      "offline-bundle-currentness");
  }
  requireClosedMembership(members, manifest, authority);

  return deepFreeze({
    offlineBundleVerified: true,
    profileId: parsedProfile.profileId,
    profileSha256: offlineBundleProfileSha256,
    bundleManifestSha256: parsedManifest.sha256,
    verificationReceiptId: verificationReceipt.receipt.receiptId,
    campaignId: input.expectedCampaignId,
    environment: input.expectedEnvironment,
    verificationTimeUtc: input.verificationTimeUtc,
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    terminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    targetSignatureReceiptIds: [...manifest.targetSignatureReceiptIds],
    targetCurrentEvidenceEligibleCount: manifest.targetSignatureReceiptIds.length,
    receiptCount: members.receipts.length,
    subjectCount: members.subjects.length,
    totalReceiptBytes: members.totalReceiptBytes,
    totalSubjectBytes: members.totalSubjectBytes,
    authority
  });
}

module.exports = Object.freeze({
  finalizeVnextOfflineBundleManifest,
  offlineBundleProfile,
  offlineBundleProfileSha256,
  verifyVnextOfflineBundle
});
