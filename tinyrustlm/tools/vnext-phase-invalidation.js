"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  canonicalizeVnextJcsBytes
} = require("./vnext-jcs.js");
const {
  receiptMaximumBytes,
  receiptSchema,
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot, "phase-invalidation-profile.v1.json");
const registryPath = path.join(contractRoot, "contract-family.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const registryBytes = fs.readFileSync(registryPath);
const parsedProfile = parseStrictJson(profileBytes);
const registry = parseStrictJson(registryBytes);
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "buffer").get;
const typedArrayByteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "byteLength").get;
const typedArrayByteOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "byteOffset").get;
const typedArrayLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "length").get;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, names, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const actual = Object.getOwnPropertyNames(value).sort();
  const expected = [...names].sort();
  if (actual.length !== expected.length ||
      actual.some((name, index) => name !== expected[index])) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    result[name] = descriptor.value;
  }
  return Object.freeze(result);
}

function dataArray(value, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    failEvidence(code, step);
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    result.push(descriptor.value);
  }
  return result;
}

function normalizeBytes(input) {
  if (!ArrayBuffer.isView(input)) {
    failEvidence("phase_receipt_bytes_required", "phase-input");
  }
  let backingBuffer;
  let byteLength;
  let byteOffset;
  let elementLength;
  try {
    backingBuffer = typedArrayBufferGetter.call(input);
    byteLength = typedArrayByteLengthGetter.call(input);
    byteOffset = typedArrayByteOffsetGetter.call(input);
    elementLength = typedArrayLengthGetter.call(input);
  } catch {
    failEvidence("phase_receipt_bytes_required", "phase-input");
  }
  if (byteLength !== elementLength ||
      (typeof SharedArrayBuffer === "function" &&
        backingBuffer instanceof SharedArrayBuffer)) {
    failEvidence("phase_receipt_bytes_required", "phase-input");
  }
  return Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength));
}

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "canonicalJsonProfile", "receiptSchema", "inputPolicy", "networkAccess",
  "sourceMutation", "historyPolicy", "winnerPolicy", "dependencyPolicy",
  "requiredPhaseParameters", "operationIdentityFields", "materialIdentityFields",
  "operationIdentityDomain", "materialIdentityDomain", "receiptSetIdentityDomain",
  "supportedPhaseReceiptTypes", "nonPassReceiptStatuses", "resultSchema",
  "resultStates", "reasonCodes", "limits"
]);
const limitFields = Object.freeze([
  "maximumReceipts", "maximumReceiptBytes", "maximumTotalReceiptBytes",
  "maximumGraphEdges", "maximumOperationHeads", "maximumResultBytes",
  "maximumDepth", "maximumTotalEntries", "maximumObjectMembers",
  "maximumArrayItems", "maximumStringCodeUnits", "maximumTotalStringCodeUnits"
]);
const excludedReceiptTypes = Object.freeze([
  "authority-registry", "key-revocation", "offline-verification-bundle",
  "signature-envelope"
]);

function validateInstalledProfile() {
  exactDataObject(parsedProfile, profileFields,
    "phase_profile_invalid", "phase-profile");
  exactDataObject(parsedProfile.limits, limitFields,
    "phase_profile_invalid", "phase-profile");
  const receiptContract = registry.contracts.find((entry) => entry.class === "receipt");
  const typeField = receiptContract?.fields.find((entry) => entry.name === "receiptType");
  const expectedTypes = typeField?.values.filter((entry) =>
    !excludedReceiptTypes.includes(entry)).sort();
  const expectedStates = [
    "conflict", "current-nonpass", "current-pass", "stale", "superseded"
  ];
  const expectedReasons = [
    "explicit-supersession", "noncurrent-ancestor", "nonpass-ancestor",
    "unresolved-operation-heads"
  ];
  const expectedNonPass = ["blocked", "fail", "rejected", "stale", "superseded"];
  const expectedOperationIdentityFields = [
    "campaignId", "operation_id", "phase", "receiptType", "subject_id"
  ];
  const expectedMaterialIdentityFields = [
    "configurationSha256", "inputHashes", "inputReceiptIds",
    "operationIdentity", "runtime", "sourceRevision", "tools"
  ];
  const limits = Object.values(parsedProfile.limits);
  if (parsedProfile.schema !== "tinyrustlm.vnext.phase_invalidation_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.phase-invalidation.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.contractRegistrySha256 !== sha256(registryBytes) ||
      parsedProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.receiptSchema !== receiptSchema ||
      parsedProfile.inputPolicy !== "bounded-final-canonical-receipt-bytes-only" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.sourceMutation !== "forbidden" ||
      parsedProfile.historyPolicy !==
        "immutable-retained-never-quarantined-for-semantic-staleness" ||
      parsedProfile.winnerPolicy !== "explicit-same-operation-supersession-only" ||
      parsedProfile.dependencyPolicy !==
        "only-descendants-of-nonpass-or-noncurrent-inputs-become-stale" ||
      !sameStrings(parsedProfile.requiredPhaseParameters,
        ["operation_id", "subject_id"]) ||
      !sameStrings(parsedProfile.operationIdentityFields,
        expectedOperationIdentityFields) ||
      !sameStrings(parsedProfile.materialIdentityFields,
        expectedMaterialIdentityFields) ||
      parsedProfile.operationIdentityDomain !==
        "tinyrustlm.phase-operation.identity.v1" ||
      parsedProfile.materialIdentityDomain !==
        "tinyrustlm.phase-material.identity.v1" ||
      parsedProfile.receiptSetIdentityDomain !==
        "tinyrustlm.phase-receipt-set.identity.v1" ||
      !sameStrings(parsedProfile.supportedPhaseReceiptTypes, expectedTypes) ||
      !sameStrings(parsedProfile.nonPassReceiptStatuses, expectedNonPass) ||
      !sameStrings(parsedProfile.resultStates, expectedStates) ||
      !sameStrings(parsedProfile.reasonCodes, expectedReasons) ||
      parsedProfile.resultSchema !== "tinyrustlm.vnext.phase_invalidation_result.v1" ||
      parsedProfile.limits.maximumReceiptBytes !== receiptMaximumBytes ||
      parsedProfile.limits.maximumOperationHeads > 64 ||
      parsedProfile.limits.maximumArrayItems < parsedProfile.limits.maximumReceipts ||
      !limits.every((value) => Number.isSafeInteger(value) && value > 0)) {
    failEvidence("phase_profile_invalid", "phase-profile");
  }
}

validateInstalledProfile();

const phaseInvalidationProfile = deepFreeze({ ...parsedProfile });
const phaseInvalidationProfileSha256 = sha256(profileBytes);
const supportedTypes = new Set(parsedProfile.supportedPhaseReceiptTypes);
const nonPassStatuses = new Set(parsedProfile.nonPassReceiptStatuses);
const resultJcsLimits = Object.freeze({
  maximumDepth: parsedProfile.limits.maximumDepth,
  maximumTotalEntries: parsedProfile.limits.maximumTotalEntries,
  maximumObjectMembers: parsedProfile.limits.maximumObjectMembers,
  maximumArrayItems: parsedProfile.limits.maximumArrayItems,
  maximumStringCodeUnits: parsedProfile.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: parsedProfile.limits.maximumTotalStringCodeUnits
});

function identity(domain, value) {
  const bytes = canonicalizeVnextJcsBytes(value, resultJcsLimits);
  return `sha256:${identityDigest(domain, bytes)}`;
}

function identityDigest(domain, bytes) {
  return crypto.createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from([0]))
    .update(bytes)
    .digest("hex");
}

function requiredPhaseIdentity(receipt) {
  const values = new Map(receipt.publicParameters.map((entry) =>
    [entry.name, entry.value]));
  if (values.size !== receipt.publicParameters.length ||
      !parsedProfile.requiredPhaseParameters.every((name) => values.has(name)) ||
      !parsedProfile.requiredPhaseParameters.every((name) =>
        safeIdPattern.test(values.get(name)))) {
    failEvidence("phase_receipt_parameters_invalid", "phase-identity");
  }
  const operationId = values.get("operation_id");
  const subjectId = values.get("subject_id");
  const operationIdentity = identity(parsedProfile.operationIdentityDomain, {
    campaignId: receipt.campaignId,
    operation_id: operationId,
    phase: receipt.phase,
    receiptType: receipt.receiptType,
    subject_id: subjectId
  });
  const materialIdentity = identity(parsedProfile.materialIdentityDomain, {
    configurationSha256: receipt.configurationSha256,
    inputHashes: receipt.inputHashes,
    inputReceiptIds: receipt.inputReceiptIds,
    operationIdentity,
    runtime: receipt.runtime,
    sourceRevision: receipt.sourceRevision,
    tools: receipt.tools
  });
  return Object.freeze({ operationId, subjectId, operationIdentity, materialIdentity });
}

function topologicalOrder(records, parentSelector) {
  const indegree = new Map(records.map((entry) => [entry.receiptId, 0]));
  const dependents = new Map(records.map((entry) => [entry.receiptId, []]));
  let edgeCount = 0;
  for (const entry of records) {
    for (const parentId of parentSelector(entry)) {
      edgeCount += 1;
      if (edgeCount > parsedProfile.limits.maximumGraphEdges) {
        failEvidence("phase_receipt_graph_edge_limit", "phase-graph");
      }
      indegree.set(entry.receiptId, indegree.get(entry.receiptId) + 1);
      dependents.get(parentId).push(entry.receiptId);
    }
  }
  for (const values of dependents.values()) values.sort();
  const ready = [...indegree].filter(([, value]) => value === 0)
    .map(([receiptId]) => receiptId).sort();
  const ordered = [];
  while (ready.length > 0) {
    const receiptId = ready.shift();
    ordered.push(receiptId);
    for (const dependent of dependents.get(receiptId)) {
      const next = indegree.get(dependent) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  if (ordered.length !== records.length) {
    failEvidence("phase_receipt_graph_invalid", "phase-graph");
  }
  return ordered;
}

function immutableResult(result, bytes, digest) {
  const canonical = Buffer.from(bytes);
  const output = {};
  Object.defineProperties(output, {
    result: { enumerable: true, value: deepFreeze(result) },
    resultBytes: {
      enumerable: true,
      get() {
        return Buffer.from(canonical);
      }
    },
    resultSha256: { enumerable: true, value: digest }
  });
  return Object.freeze(output);
}

function classifyVnextPhaseReceipts(rawInput) {
  const input = exactDataObject(rawInput, ["campaignId", "receiptBytes"],
    "phase_input_invalid", "phase-input");
  if (typeof input.campaignId !== "string" || !safeIdPattern.test(input.campaignId)) {
    failEvidence("phase_campaign_invalid", "phase-input");
  }
  const byteInputs = dataArray(input.receiptBytes,
    "phase_receipt_array_invalid", "phase-input");
  if (byteInputs.length === 0 ||
      byteInputs.length > parsedProfile.limits.maximumReceipts) {
    failEvidence("phase_receipt_count_invalid", "phase-input");
  }

  let totalReceiptBytes = 0;
  const records = [];
  const byId = new Map();
  for (const byteInput of byteInputs) {
    const bytes = normalizeBytes(byteInput);
    if (bytes.length === 0 || bytes.length > parsedProfile.limits.maximumReceiptBytes) {
      failEvidence("phase_receipt_byte_limit", "phase-input");
    }
    totalReceiptBytes += bytes.length;
    if (!Number.isSafeInteger(totalReceiptBytes) ||
        totalReceiptBytes > parsedProfile.limits.maximumTotalReceiptBytes) {
      failEvidence("phase_receipt_total_byte_limit", "phase-input");
    }
    let validated;
    try {
      validated = validateVnextReceiptBytes(bytes);
    } catch (error) {
      throw new VnextEvidenceError("phase_receipt_invalid", "phase-input", error?.code);
    }
    const receipt = validated.receipt;
    if (receipt.campaignId !== input.campaignId) {
      failEvidence("phase_receipt_campaign_mismatch", "phase-input");
    }
    if (!supportedTypes.has(receipt.receiptType)) {
      failEvidence("phase_receipt_type_invalid", "phase-input");
    }
    if (byId.has(receipt.receiptId)) {
      failEvidence("phase_receipt_duplicate", "phase-input");
    }
    const phaseIdentity = requiredPhaseIdentity(receipt);
    const record = Object.freeze({
      receipt,
      receiptId: receipt.receiptId,
      ...phaseIdentity
    });
    records.push(record);
    byId.set(record.receiptId, record);
  }
  records.sort((left, right) => left.receiptId.localeCompare(right.receiptId, "en"));

  let graphEdges = 0;
  for (const entry of records) {
    const inputs = new Set(entry.receipt.inputReceiptIds);
    for (const parentId of [...entry.receipt.inputReceiptIds,
      ...entry.receipt.supersedesReceiptIds]) {
      graphEdges += 1;
      if (graphEdges > parsedProfile.limits.maximumGraphEdges || !byId.has(parentId)) {
        failEvidence("phase_receipt_graph_invalid", "phase-graph");
      }
    }
    for (const targetId of entry.receipt.supersedesReceiptIds) {
      if (inputs.has(targetId)) {
        failEvidence("phase_supersession_dependency_overlap", "phase-supersession");
      }
      if (byId.get(targetId).operationIdentity !== entry.operationIdentity) {
        failEvidence("phase_supersession_operation_mismatch", "phase-supersession");
      }
    }
  }

  topologicalOrder(records, (entry) => entry.receipt.inputReceiptIds);
  topologicalOrder(records, (entry) => entry.receipt.supersedesReceiptIds);
  topologicalOrder(records, (entry) => [
    ...entry.receipt.inputReceiptIds,
    ...entry.receipt.supersedesReceiptIds
  ]);

  const superseded = new Set();
  for (const entry of records) {
    for (const targetId of entry.receipt.supersedesReceiptIds) superseded.add(targetId);
  }
  const headsByOperation = new Map();
  for (const entry of records) {
    if (superseded.has(entry.receiptId)) continue;
    if (!headsByOperation.has(entry.operationIdentity)) {
      headsByOperation.set(entry.operationIdentity, []);
    }
    headsByOperation.get(entry.operationIdentity).push(entry.receiptId);
  }

  const conflictingOperationIdentities = [];
  const states = new Map();
  for (const entry of records) {
    if (superseded.has(entry.receiptId)) {
      states.set(entry.receiptId, Object.freeze({
        state: "superseded",
        reasonCode: "explicit-supersession"
      }));
    }
  }
  for (const [operationIdentity, heads] of [...headsByOperation].sort(
    ([left], [right]) => left.localeCompare(right, "en"))) {
    heads.sort();
    if (heads.length > parsedProfile.limits.maximumOperationHeads) {
      failEvidence("phase_operation_head_limit", "phase-conflict");
    }
    if (heads.length > 1) {
      conflictingOperationIdentities.push(operationIdentity);
      for (const receiptId of heads) {
        states.set(receiptId, Object.freeze({
          state: "conflict",
          reasonCode: "unresolved-operation-heads"
        }));
      }
    }
  }

  const dependencyOrder = topologicalOrder(records,
    (entry) => entry.receipt.inputReceiptIds);
  for (const receiptId of dependencyOrder) {
    if (states.has(receiptId)) continue;
    const entry = byId.get(receiptId);
    const parentStates = entry.receipt.inputReceiptIds.map((parentId) =>
      states.get(parentId));
    const noncurrentParent = parentStates.find((parent) =>
      parent.state !== "current-pass" && parent.state !== "current-nonpass");
    if (noncurrentParent !== undefined) {
      states.set(receiptId, Object.freeze({
        state: "stale",
        reasonCode: "noncurrent-ancestor"
      }));
      continue;
    }
    if (parentStates.some((parent) => parent.state === "current-nonpass")) {
      states.set(receiptId, Object.freeze({
        state: "stale",
        reasonCode: "nonpass-ancestor"
      }));
      continue;
    }
    states.set(receiptId, Object.freeze({
      state: nonPassStatuses.has(entry.receipt.status)
        ? "current-nonpass"
        : "current-pass",
      reasonCode: null
    }));
  }

  const outputRecords = records.map((entry) => {
    const classification = states.get(entry.receiptId);
    return {
      inputReceiptIds: [...entry.receipt.inputReceiptIds],
      materialIdentity: entry.materialIdentity,
      operationId: entry.operationId,
      operationIdentity: entry.operationIdentity,
      phase: entry.receipt.phase,
      reasonCode: classification.reasonCode,
      receiptId: entry.receiptId,
      receiptType: entry.receipt.receiptType,
      sourceStatus: entry.receipt.status,
      state: classification.state,
      subjectId: entry.subjectId,
      supersedesReceiptIds: [...entry.receipt.supersedesReceiptIds]
    };
  });
  const currentPhaseReceiptIds = outputRecords.filter((entry) =>
    entry.state === "current-pass" || entry.state === "current-nonpass")
    .map((entry) => entry.receiptId).sort();
  const eligiblePassPhaseReceiptIds = outputRecords.filter((entry) =>
    entry.state === "current-pass").map((entry) => entry.receiptId).sort();
  const retainedHistoricalReceiptIds = outputRecords.filter((entry) =>
    entry.state !== "current-pass" && entry.state !== "current-nonpass")
    .map((entry) => entry.receiptId).sort();
  const receiptIds = records.map((entry) => entry.receiptId).sort();
  const result = {
    campaignId: input.campaignId,
    conflictingOperationIdentities,
    currentPhaseReceiptIds,
    eligiblePassPhaseReceiptIds,
    health: conflictingOperationIdentities.length === 0 ? "healthy" : "invalid",
    profileId: parsedProfile.profileId,
    profileSha256: phaseInvalidationProfileSha256,
    receiptCount: records.length,
    receiptSetSha256: identityDigest(parsedProfile.receiptSetIdentityDomain,
      canonicalizeVnextJcsBytes(receiptIds, resultJcsLimits)),
    records: outputRecords,
    retainedHistoricalReceiptIds,
    schema: parsedProfile.resultSchema,
    totalReceiptBytes
  };
  const resultBytes = canonicalizeVnextJcsBytes(result, resultJcsLimits);
  if (resultBytes.length > parsedProfile.limits.maximumResultBytes) {
    failEvidence("phase_result_byte_limit", "phase-result");
  }
  return immutableResult(result, resultBytes, sha256(resultBytes));
}

module.exports = Object.freeze({
  classifyVnextPhaseReceipts,
  phaseInvalidationProfile,
  phaseInvalidationProfileSha256
});
