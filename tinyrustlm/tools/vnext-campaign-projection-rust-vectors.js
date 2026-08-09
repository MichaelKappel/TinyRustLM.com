"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  campaignProjectionProfile,
  campaignProjectionProfileSha256,
  projectVnextCampaign,
  validateCampaignProjectionResultBytes
} = require("./vnext-campaign-projection.js");
const {
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const {
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const seedPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-projection-public-seed.v1.json"
);
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-projection-rust-vectors.v1.json"
);
const seedSha256 = "a42e43c2a2d5dc00de75f6146c94b7bd91f90e8531a3212f421150a9f011a817";
const vectorParserLimits = Object.freeze({
  maximumBytes: 8 * 1024 * 1024,
  maximumDepth: 32,
  maximumTotalEntries: 200_000,
  maximumObjectMembers: 64,
  maximumArrayItems: 8192,
  maximumStringCodeUnits: 8 * 1024 * 1024,
  maximumTotalStringCodeUnits: 8 * 1024 * 1024,
  maximumNumberCharacters: 32
});

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "campaign_projection_rust_vector_generation_failed";
    throw error;
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decodeCanonical(value) {
  invariant(typeof value === "string", "wire bytes must be base64 strings");
  const bytes = Buffer.from(value, "base64");
  invariant(bytes.toString("base64") === value, "wire bytes must use canonical base64");
  return bytes;
}

function exactObject(value, fields, label) {
  invariant(value !== null && typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype, `${label} must be an object`);
  invariant(Object.keys(value).sort().join("\0") === [...fields].sort().join("\0"),
    `${label} fields changed`);
  return value;
}

function loadSeed() {
  const bytes = fs.readFileSync(seedPath);
  invariant(bytes.length === 1_024_171, "projection public seed byte length changed");
  invariant(sha256(bytes) === seedSha256, "projection public seed hash changed");
  const seed = parseStrictJson(bytes, vectorParserLimits);
  exactObject(seed, [
    "acceptedInputs", "campaignId", "campaignPlanBytesBase64", "campaignPlanSha256",
    "environment", "profileId", "profileSha256", "receipts", "rejectionMaterial",
    "schema", "subjects"
  ], "projection public seed");
  invariant(seed.schema === "tinyrustlm.vnext.campaign_projection_public_seed.v1",
    "projection public seed schema changed");
  invariant(seed.profileId === campaignProjectionProfile.profileId,
    "projection public seed profile changed");
  invariant(seed.profileSha256 === campaignProjectionProfileSha256,
    "projection public seed profile hash changed");
  invariant(seed.acceptedInputs.length === 11,
    "projection accepted seed count changed");
  invariant(seed.receipts.length === 277, "projection receipt pool count changed");
  invariant(seed.subjects.length === 41, "projection subject pool count changed");

  const receiptWires = new Map();
  for (const entry of seed.receipts) {
    exactObject(entry, ["bytesBase64", "receiptId"], "projection receipt seed");
    const bytesValue = decodeCanonical(entry.bytesBase64);
    const verified = validateVnextReceiptBytes(bytesValue);
    invariant(verified.receipt.receiptId === entry.receiptId,
      "projection receipt pool identity changed");
    invariant(!receiptWires.has(entry.receiptId), "projection receipt pool is duplicated");
    receiptWires.set(entry.receiptId, bytesValue);
  }
  const subjectWires = new Map();
  for (const entry of seed.subjects) {
    exactObject(entry, ["bytesBase64", "subjectId"], "projection subject seed");
    const bytesValue = decodeCanonical(entry.bytesBase64);
    const verified = validateVnextIdentityDocumentBytes(bytesValue);
    invariant(verified.subjectId === entry.subjectId,
      "projection subject pool identity changed");
    invariant(!subjectWires.has(entry.subjectId), "projection subject pool is duplicated");
    subjectWires.set(entry.subjectId, bytesValue);
  }
  const canonicalPlan = decodeCanonical(seed.campaignPlanBytesBase64);
  invariant(sha256(canonicalPlan) === seed.campaignPlanSha256,
    "projection campaign plan hash changed");
  const parsedPlan = parseStrictJson(canonicalPlan, vectorParserLimits);
  const planWires = new Map([
    ["canonical", canonicalPlan],
    ["fields-invalid", Buffer.from("{}", "utf8")],
    ["json-invalid", Buffer.from("{", "utf8")],
    ["noncanonical", Buffer.from(`${JSON.stringify(parsedPlan, null, 2)}\n`, "utf8")]
  ]);
  return { bytes, planWires, receiptWires, seed, subjectWires };
}

function baseCase(seed, overrides = {}) {
  return {
    name: "unnamed",
    planWireName: "canonical",
    expectedCampaignPlanSha256: seed.campaignPlanSha256,
    expectedCampaignId: seed.campaignId,
    expectedEnvironment: seed.environment,
    expectedTerminalRegistryReceiptId: null,
    receiptIds: [],
    receiptBytesBase64: [],
    subjectIds: [],
    subjectBytesBase64: [],
    trustedRootRegistryReceiptId: null,
    verificationTimeUtc: "2026-08-09T00:30:00Z",
    ...overrides
  };
}

function assertCaseShape(value) {
  return exactObject(value, [
    "expectedCampaignId", "expectedCampaignPlanSha256", "expectedEnvironment",
    "expectedTerminalRegistryReceiptId", "name", "planWireName", "receiptBytesBase64",
    "receiptIds", "subjectBytesBase64", "subjectIds", "trustedRootRegistryReceiptId",
    "verificationTimeUtc"
  ], `projection case ${value.name}`);
}

function materializeCase(value, data) {
  const entry = assertCaseShape(value);
  const planBytes = data.planWires.get(entry.planWireName);
  invariant(planBytes !== undefined, `${entry.name} references an unknown plan wire`);
  const receiptBytes = entry.receiptIds.map((id) => {
    const bytes = data.receiptWires.get(id);
    invariant(bytes !== undefined, `${entry.name} references an unknown receipt`);
    return Buffer.from(bytes);
  });
  receiptBytes.push(...entry.receiptBytesBase64.map(decodeCanonical));
  const subjectBytes = entry.subjectIds.map((id) => {
    const bytes = data.subjectWires.get(id);
    invariant(bytes !== undefined, `${entry.name} references an unknown subject`);
    return Buffer.from(bytes);
  });
  subjectBytes.push(...entry.subjectBytesBase64.map(decodeCanonical));
  return {
    campaignPlanBytes: Buffer.from(planBytes),
    expectedCampaignPlanSha256: entry.expectedCampaignPlanSha256,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    receiptBytes,
    subjectBytes,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationTimeUtc: entry.verificationTimeUtc
  };
}

function acceptedCase(specification, data) {
  const result = projectVnextCampaign(materializeCase(specification, data));
  return {
    ...specification,
    resultBytesBase64: result.resultBytes.toString("base64"),
    resultSha256: result.resultSha256
  };
}

function rejectionCase(specification, expectedErrorCode, data) {
  let actual = null;
  try {
    projectVnextCampaign(materializeCase(specification, data));
  } catch (error) {
    actual = error?.code ?? null;
  }
  invariant(actual === expectedErrorCode,
    `${specification.name} rejection changed from ${expectedErrorCode} to ${actual}`);
  return { ...specification, expectedErrorCode };
}

function resultRejectionCase(name, bytes, expectedErrorCode, planBytes) {
  let actual = null;
  try {
    validateCampaignProjectionResultBytes(bytes, planBytes);
  } catch (error) {
    actual = error?.code ?? null;
  }
  invariant(actual === expectedErrorCode,
    `${name} result rejection changed from ${expectedErrorCode} to ${actual}`);
  return {
    name,
    resultBytesBase64: Buffer.from(bytes).toString("base64"),
    expectedErrorCode
  };
}

function acceptedSpecifications(data) {
  return data.seed.acceptedInputs.map((entry) => {
    exactObject(entry, [
      "expectedTerminalRegistryReceiptId", "name", "receiptIds", "subjectIds",
      "trustedRootRegistryReceiptId", "verificationTimeUtc"
    ], `projection accepted seed ${entry.name}`);
    return baseCase(data.seed, entry);
  });
}

function rejectionSpecifications(data) {
  const { seed } = data;
  const material = exactObject(seed.rejectionMaterial, [
    "browserWithoutParentReceiptIds", "firstReceiptId", "firstSubjectId",
    "otherCampaignReceiptId", "otherCampaignSubjectId", "rootReceiptId"
  ], "projection rejection material");
  const root = material.rootReceiptId;
  const invalidContentId = `sha256:${"f".repeat(64)}`;
  const malformedWire = Buffer.from("{}", "utf8").toString("base64");
  const emptyWire = "";
  return [
    [baseCase(seed, { name: "input-plan-hash-invalid",
      expectedCampaignPlanSha256: "invalid" }), "campaign_projection_input_invalid"],
    [baseCase(seed, { name: "plan-hash-mismatch",
      expectedCampaignPlanSha256: "0".repeat(64) }), "campaign_plan_hash_mismatch"],
    [baseCase(seed, { name: "campaign-mismatch",
      expectedCampaignId: "campaign-vnext-002" }), "campaign_plan_projection_mismatch"],
    [baseCase(seed, { name: "environment-mismatch",
      expectedEnvironment: "staging" }), "campaign_plan_projection_mismatch"],
    [baseCase(seed, { name: "root-terminal-pair-mismatch",
      trustedRootRegistryReceiptId: root }), "campaign_projection_input_invalid"],
    [baseCase(seed, { name: "verification-time-invalid",
      verificationTimeUtc: "not-a-time" }), "campaign_projection_input_invalid"],
    [baseCase(seed, { name: "plan-fields-invalid", planWireName: "fields-invalid",
      expectedCampaignPlanSha256: sha256(data.planWires.get("fields-invalid")) }),
      "campaign_plan_fields_invalid"],
    [baseCase(seed, { name: "plan-json-invalid", planWireName: "json-invalid",
      expectedCampaignPlanSha256: sha256(data.planWires.get("json-invalid")) }),
      "campaign_plan_invalid"],
    [baseCase(seed, { name: "plan-noncanonical", planWireName: "noncanonical",
      expectedCampaignPlanSha256: sha256(data.planWires.get("noncanonical")) }),
      "campaign_plan_identity_mismatch"],
    [baseCase(seed, { name: "receipt-duplicate",
      receiptIds: [material.firstReceiptId, material.firstReceiptId] }),
      "campaign_projection_receipt_duplicate"],
    [baseCase(seed, { name: "receipt-campaign-mismatch",
      receiptIds: [material.otherCampaignReceiptId] }),
      "campaign_projection_campaign_mismatch"],
    [baseCase(seed, { name: "receipt-invalid",
      receiptBytesBase64: [malformedWire] }), "receipt_registry_validation_failed"],
    [baseCase(seed, { name: "receipt-empty",
      receiptBytesBase64: [emptyWire] }), "receipt_byte_limit"],
    [baseCase(seed, { name: "subject-duplicate",
      subjectIds: [material.firstSubjectId, material.firstSubjectId] }),
      "campaign_projection_subject_duplicate"],
    [baseCase(seed, { name: "subject-campaign-mismatch",
      subjectIds: [material.otherCampaignSubjectId] }),
      "campaign_projection_campaign_mismatch"],
    [baseCase(seed, { name: "subject-invalid",
      subjectBytesBase64: [malformedWire] }), "identity_registry_validation_failed"],
    [baseCase(seed, { name: "subject-empty",
      subjectBytesBase64: [emptyWire] }), "identity_byte_limit"],
    [baseCase(seed, { name: "receipt-count-excess",
      receiptIds: Array(2049).fill(material.firstReceiptId) }),
      "campaign_projection_receipt_input_invalid"],
    [baseCase(seed, { name: "subject-count-excess",
      subjectIds: Array(2049).fill(material.firstSubjectId) }),
      "campaign_projection_subject_input_invalid"],
    [baseCase(seed, { name: "phase-parent-missing",
      expectedTerminalRegistryReceiptId: root,
      receiptIds: material.browserWithoutParentReceiptIds,
      trustedRootRegistryReceiptId: root }), "phase_receipt_graph_invalid"],
    [baseCase(seed, { name: "authority-root-missing",
      expectedTerminalRegistryReceiptId: root,
      trustedRootRegistryReceiptId: root }), "authority_registry_count_invalid"],
    [baseCase(seed, { name: "authority-terminal-missing",
      expectedTerminalRegistryReceiptId: invalidContentId,
      receiptIds: [root],
      trustedRootRegistryReceiptId: root }), "terminal_registry_missing"]
  ];
}

function resultRejections(data, honestZero) {
  const planBytes = data.planWires.get("canonical");
  const result = parseStrictJson(Buffer.from(honestZero.resultBytesBase64, "base64"),
    vectorParserLimits);
  const pretty = Buffer.from(`${JSON.stringify(result, null, 2)}\n`, "utf8");
  const unknown = canonicalizeVnextJcsBytes({ ...result, unknown: true });
  const countDrift = structuredClone(result);
  countDrift.counts.qualifiedModels.current = 1;
  const blockerDrift = structuredClone(result);
  blockerDrift.blockerCodes = blockerDrift.blockerCodes.filter((entry) =>
    entry !== "qualified_models_incomplete");
  const operationDrift = structuredClone(result);
  operationDrift.currentOperation = { operationId: null, phase: "qualification", state: "pending" };
  const planDrift = structuredClone(result);
  planDrift.campaignPlanSha256 = "f".repeat(64);
  return [
    resultRejectionCase("result-empty", Buffer.alloc(0),
      "campaign_projection_result_byte_limit", planBytes),
    resultRejectionCase("result-json-invalid", Buffer.from("{", "utf8"),
      "campaign_projection_result_json_invalid", planBytes),
    resultRejectionCase("result-noncanonical", pretty,
      "campaign_projection_result_wire_not_canonical", planBytes),
    resultRejectionCase("result-unknown-field", unknown,
      "campaign_projection_result_fields_invalid", planBytes),
    resultRejectionCase("result-count-drift", canonicalizeVnextJcsBytes(countDrift),
      "campaign_projection_result_counts_invalid", planBytes),
    resultRejectionCase("result-blocker-drift", canonicalizeVnextJcsBytes(blockerDrift),
      "campaign_projection_result_blockers_invalid", planBytes),
    resultRejectionCase("result-operation-drift", canonicalizeVnextJcsBytes(operationDrift),
      "campaign_projection_result_operation_invalid", planBytes),
    resultRejectionCase("result-plan-drift", canonicalizeVnextJcsBytes(planDrift),
      "campaign_projection_result_plan_mismatch", planBytes)
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function buildCorpus() {
  const data = loadSeed();
  const acceptedCases = acceptedSpecifications(data)
    .map((entry) => acceptedCase(entry, data))
    .sort((left, right) => left.name.localeCompare(right.name));
  const rejectionCases = rejectionSpecifications(data)
    .map(([entry, code]) => rejectionCase(entry, code, data))
    .sort((left, right) => left.name.localeCompare(right.name));
  const honestZero = acceptedCases.find((entry) => entry.name === "honest-zero");
  invariant(honestZero !== undefined, "honest-zero vector is missing");
  const resultRejectionCases = resultRejections(data, honestZero);
  invariant(acceptedCases.length === 11, "accepted vector count changed");
  invariant(rejectionCases.length === 22, "rejection vector count changed");
  invariant(resultRejectionCases.length === 8, "result rejection count changed");
  return {
    schema: "tinyrustlm.vnext.campaign_projection_rust_vectors.v1",
    profileId: campaignProjectionProfile.profileId,
    profileSha256: campaignProjectionProfileSha256,
    publicSeedSha256: sha256(data.bytes),
    planWires: [...data.planWires.entries()].map(([name, bytes]) => ({
      name,
      bytesBase64: bytes.toString("base64")
    })),
    receipts: data.seed.receipts,
    subjects: data.seed.subjects,
    acceptedCases,
    rejectionCases,
    resultRejectionCases
  };
}

function renderVectorCorpus() {
  return Buffer.from(`${JSON.stringify(buildCorpus(), null, 2)}\n`, "utf8");
}

function writeVectorCorpus() {
  const bytes = renderVectorCorpus();
  fs.writeFileSync(vectorPath, bytes);
  return Object.freeze({ bytes: Buffer.from(bytes), vectorPath });
}

function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vnext-campaign-projection-rust-vectors.js --write");
  writeVectorCorpus();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Campaign-projection Rust vector generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  renderVectorCorpus,
  seedPath,
  vectorPath,
  writeVectorCorpus
});
