"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const {
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const {
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const {
  classifyVnextPhaseReceipts,
  phaseInvalidationProfile,
  phaseInvalidationProfileSha256
} = require("./vnext-phase-invalidation.js");
const {
  verifyVnextAuthorityGraph
} = require("./vnext-signature-authority.js");
const {
  signatureProfile,
  signatureProfileSha256,
  utcNanoseconds
} = require("./vnext-signature-payload.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot, "campaign-projection-profile.v1.json");
const registryPath = path.join(contractRoot, "contract-family.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const registryBytes = fs.readFileSync(registryPath);
const parsedProfile = parseStrictJson(profileBytes);
const digestPattern = /^[a-f0-9]{64}$/u;
const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const environments = new Set(["development", "production", "staging"]);
const objectiveTypes = new Set(parsedProfile.objectiveReceiptBindings.map((entry) =>
  entry.receiptType));
const supportedPhaseTypes = new Set(phaseInvalidationProfile.supportedPhaseReceiptTypes);
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "buffer").get;
const typedArrayByteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "byteLength").get;
const typedArrayByteOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "byteOffset").get;
const typedArrayLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "length").get;

const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "phaseInvalidationProfileId", "phaseInvalidationProfileSha256",
  "receiptSignatureProfileId", "receiptSignatureProfileSha256",
  "canonicalJsonProfile", "hashAlgorithm", "networkAccess", "sourceMutation",
  "historyPolicy", "planSchema", "resultSchema", "planIdentityDomain",
  "planDraftFields", "planFields", "modelFields", "browserRoundFields",
  "memoryRoundFields", "p2pLaneFields", "announcementFields",
  "objectiveTargets", "objectiveReceiptBindings", "outsideProofBinding",
  "phaseOrder", "countingPolicy", "planPolicy", "limits"
]);
const targetFields = Object.freeze([
  "announcedModels", "cleanBrowserRounds", "liveMemoryRounds",
  "outsideProvenLanes", "qualifiedModels"
]);
const bindingFields = Object.freeze([
  "counterName", "phase", "receiptType", "role", "scope"
]);
const outsideBindingFields = Object.freeze([
  "counterName", "networkScope", "role", "schema", "scope"
]);
const countingPolicyFields = Object.freeze([
  "requireExactPlanMatch", "requireCurrentPassPhaseState",
  "requireCurrentRoleCorrectSignature", "requireCurrentPrerequisites",
  "rejectBestOfN", "countUnplannedEvidence", "countExpiredEvidence",
  "countConflictedEvidence", "countSupersededEvidence", "countStaleEvidence"
]);
const planPolicyFields = Object.freeze([
  "announcementBijection", "arrayOrder", "artifactIdentity",
  "browserRestartMinimumPerModel", "globalProcessIdentityUniqueness",
  "lanesPerModel", "memoryRoundBijection"
]);
const limitFields = Object.freeze([
  "maximumPlanBytes", "maximumProjectionResultBytes", "maximumReceiptInputs",
  "maximumSubjectInputs", "maximumTotalReceiptBytes", "maximumTotalSubjectBytes",
  "maximumDepth", "maximumTotalEntries", "maximumObjectMembers",
  "maximumArrayItems", "maximumStringCodeUnits", "maximumTotalStringCodeUnits",
  "maximumNumberCharacters"
]);
const projectionInputFields = Object.freeze([
  "campaignPlanBytes", "expectedCampaignId", "expectedCampaignPlanSha256",
  "expectedEnvironment", "expectedTerminalRegistryReceiptId", "receiptBytes",
  "subjectBytes", "trustedRootRegistryReceiptId", "verificationTimeUtc"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, fields, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const actual = Object.getOwnPropertyNames(value).sort();
  const expected = [...fields].sort();
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
  return result;
}

function exactDataArray(value, maximum, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum || Object.getOwnPropertySymbols(value).length !== 0 ||
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

function normalizeBytes(value, code, step) {
  if (!ArrayBuffer.isView(value)) failEvidence(code, step);
  let backingBuffer;
  let byteLength;
  let byteOffset;
  let elementLength;
  try {
    backingBuffer = typedArrayBufferGetter.call(value);
    byteLength = typedArrayByteLengthGetter.call(value);
    byteOffset = typedArrayByteOffsetGetter.call(value);
    elementLength = typedArrayLengthGetter.call(value);
  } catch {
    failEvidence(code, step);
  }
  if (byteLength !== elementLength ||
      (typeof SharedArrayBuffer === "function" &&
        backingBuffer instanceof SharedArrayBuffer)) {
    failEvidence(code, step);
  }
  return Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength));
}

function boundedByteArray(value, maximumCount, maximumBytes, code) {
  const values = exactDataArray(value, maximumCount, code, "campaign-projection-input");
  const result = [];
  let totalBytes = 0;
  for (const item of values) {
    const bytes = normalizeBytes(item, code, "campaign-projection-input");
    totalBytes += bytes.length;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumBytes) {
      failEvidence(code, "campaign-projection-input");
    }
    result.push(bytes);
  }
  return { bytes: result, totalBytes };
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sameObject(left, right) {
  const leftNames = Object.keys(left).sort();
  const rightNames = Object.keys(right).sort();
  return sameStrings(leftNames, rightNames) &&
    leftNames.every((name) => left[name] === right[name]);
}

function validateInstalledProfile() {
  exactDataObject(parsedProfile, profileFields,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  exactDataObject(parsedProfile.objectiveTargets, targetFields,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  exactDataObject(parsedProfile.outsideProofBinding, outsideBindingFields,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  exactDataObject(parsedProfile.countingPolicy, countingPolicyFields,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  exactDataObject(parsedProfile.planPolicy, planPolicyFields,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  exactDataObject(parsedProfile.limits, limitFields,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  const bindings = exactDataArray(parsedProfile.objectiveReceiptBindings, 8,
    "campaign_projection_profile_invalid", "campaign-projection-profile");
  for (const binding of bindings) {
    exactDataObject(binding, bindingFields,
      "campaign_projection_profile_invalid", "campaign-projection-profile");
  }
  const expectedTargets = {
    announcedModels: 20,
    cleanBrowserRounds: 50,
    liveMemoryRounds: 25,
    outsideProvenLanes: 40,
    qualifiedModels: 20
  };
  const expectedBindings = [
    ["qualifiedModels", "qualification", "qualification", "local-recorder",
      "receipt-recording"],
    ["cleanBrowserRounds", "browser-round", "browser-round", "local-recorder",
      "receipt-recording"],
    ["liveMemoryRounds", "memory-continuity", "memory-continuity",
      "local-recorder", "receipt-recording"],
    ["announcedModels", "catalog-announcement", "catalog-announcement",
      "p2p-publisher", "p2p-publication"]
  ];
  const expectedCountingPolicy = {
    requireExactPlanMatch: true,
    requireCurrentPassPhaseState: true,
    requireCurrentRoleCorrectSignature: true,
    requireCurrentPrerequisites: true,
    rejectBestOfN: true,
    countUnplannedEvidence: false,
    countExpiredEvidence: false,
    countConflictedEvidence: false,
    countSupersededEvidence: false,
    countStaleEvidence: false
  };
  const expectedPlanPolicy = {
    announcementBijection: "exactly-one-announcement-per-model",
    arrayOrder: "strict-lexicographic-by-primary-id",
    artifactIdentity:
      "artifact-id-must-equal-sha256-prefix-plus-artifact-sha256",
    browserRestartMinimumPerModel: 2,
    globalProcessIdentityUniqueness: true,
    lanesPerModel: 2,
    memoryRoundBijection:
      "exactly-one-memory-round-per-designated-browser-round"
  };
  const expectedLimits = {
    maximumPlanBytes: 1048576,
    maximumProjectionResultBytes: 4194304,
    maximumReceiptInputs: 2048,
    maximumSubjectInputs: 2048,
    maximumTotalReceiptBytes: 67108864,
    maximumTotalSubjectBytes: 67108864,
    maximumDepth: 32,
    maximumTotalEntries: 131072,
    maximumObjectMembers: 64,
    maximumArrayItems: 4096,
    maximumStringCodeUnits: 65536,
    maximumTotalStringCodeUnits: 16777216,
    maximumNumberCharacters: 32
  };
  const bindingsValid = bindings.length === expectedBindings.length &&
    bindings.every((binding, index) => [binding.counterName, binding.phase,
      binding.receiptType, binding.role, binding.scope]
      .every((value, fieldIndex) => value === expectedBindings[index][fieldIndex]));
  if (parsedProfile.schema !== "tinyrustlm.vnext.campaign_projection_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.campaign-projection.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.contractRegistrySha256 !== sha256(registryBytes) ||
      parsedProfile.phaseInvalidationProfileId !== phaseInvalidationProfile.profileId ||
      parsedProfile.phaseInvalidationProfileSha256 !== phaseInvalidationProfileSha256 ||
      parsedProfile.receiptSignatureProfileId !== signatureProfile.profileId ||
      parsedProfile.receiptSignatureProfileSha256 !== signatureProfileSha256 ||
      parsedProfile.canonicalJsonProfile !== "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.sourceMutation !== "forbidden" ||
      parsedProfile.historyPolicy !==
        "retain-all-valid-evidence-and-count-current-authorized-evidence-only" ||
      parsedProfile.planSchema !== "tinyrustlm.vnext.campaign_plan.v1" ||
      parsedProfile.resultSchema !== "tinyrustlm.vnext.campaign_projection_result.v1" ||
      parsedProfile.planIdentityDomain !== "tinyrustlm.campaign-plan.identity.v1" ||
      !sameStrings(parsedProfile.planDraftFields, [
        "announcements", "applicationOrigin", "browserRounds", "campaignId",
        "createdAtUtc", "environment", "memoryContractId", "memoryRounds",
        "models", "p2pLanes", "profileId", "schema"
      ]) ||
      !sameStrings(parsedProfile.planFields, [
        "announcements", "applicationOrigin", "browserRounds", "campaignId",
        "createdAtUtc", "environment", "memoryContractId", "memoryRounds",
        "models", "p2pLanes", "planId", "profileId", "schema"
      ]) ||
      !sameStrings(parsedProfile.modelFields, [
        "artifactId", "artifactSha256", "modelSlotId",
        "qualificationOperationId"
      ]) ||
      !sameStrings(parsedProfile.browserRoundFields, [
        "memoryContinuityRequired", "modelSlotId", "operationId", "restartId",
        "roundId"
      ]) ||
      !sameStrings(parsedProfile.memoryRoundFields, [
        "browserRoundId", "companyIdHash", "memoryRoundId", "modelSlotId",
        "operationId"
      ]) ||
      !sameStrings(parsedProfile.p2pLaneFields, [
        "laneId", "modelSlotId", "processInstanceId"
      ]) ||
      !sameStrings(parsedProfile.announcementFields, [
        "announcementId", "modelSlotId", "operationId"
      ]) ||
      !sameObject(parsedProfile.objectiveTargets, expectedTargets) ||
      !bindingsValid ||
      !sameObject(parsedProfile.outsideProofBinding, {
        counterName: "outsideProvenLanes",
        networkScope: "outside-host-and-local-network",
        role: "outside-network-observer",
        schema: "tinyrustlm.vnext.outside_proof.v2",
        scope: "outside-proof"
      }) ||
      !sameStrings(parsedProfile.phaseOrder, [
        "qualification", "browser-round", "memory-continuity", "outside-proof",
        "catalog-announcement"
      ]) ||
      !sameObject(parsedProfile.countingPolicy, expectedCountingPolicy) ||
      !sameObject(parsedProfile.planPolicy, expectedPlanPolicy) ||
      !sameObject(parsedProfile.limits, expectedLimits) ||
      parsedProfile.limits.maximumReceiptInputs >
        phaseInvalidationProfile.limits.maximumReceipts ||
      parsedProfile.limits.maximumReceiptInputs > signatureProfile.limits.maximumReceipts ||
      parsedProfile.limits.maximumSubjectInputs >
        signatureProfile.limits.maximumSubjectDocuments) {
    failEvidence("campaign_projection_profile_invalid", "campaign-projection-profile");
  }
}

validateInstalledProfile();

const campaignProjectionProfile = deepFreeze({ ...parsedProfile });
const campaignProjectionProfileSha256 = sha256(profileBytes);
const jcsLimits = Object.freeze({
  maximumDepth: parsedProfile.limits.maximumDepth,
  maximumTotalEntries: parsedProfile.limits.maximumTotalEntries,
  maximumObjectMembers: parsedProfile.limits.maximumObjectMembers,
  maximumArrayItems: parsedProfile.limits.maximumArrayItems,
  maximumStringCodeUnits: parsedProfile.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: parsedProfile.limits.maximumTotalStringCodeUnits
});
const parserLimits = Object.freeze({
  maximumBytes: parsedProfile.limits.maximumPlanBytes,
  ...jcsLimits,
  maximumNumberCharacters: parsedProfile.limits.maximumNumberCharacters
});

function requireSafeId(value, code, step) {
  if (typeof value !== "string" || !safeIdPattern.test(value)) {
    failEvidence(code, step);
  }
  return value;
}

function requireDigest(value, code, step) {
  if (typeof value !== "string" || !digestPattern.test(value)) {
    failEvidence(code, step);
  }
  return value;
}

function requireContentId(value, code, step) {
  if (typeof value !== "string" || !contentIdPattern.test(value)) {
    failEvidence(code, step);
  }
  return value;
}

function requireUtc(value, code, step) {
  if (utcNanoseconds(value) === null) failEvidence(code, step);
  return value;
}

function requireOrigin(value, code) {
  if (typeof value !== "string") failEvidence(code, "campaign-plan");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    failEvidence(code, "campaign-plan");
  }
  if (parsed.protocol !== "https:" || parsed.origin !== value ||
      parsed.username !== "" || parsed.password !== "") {
    failEvidence(code, "campaign-plan");
  }
  return value;
}

function requireSortedUnique(records, key, code) {
  let previous = null;
  for (const record of records) {
    const value = record[key];
    if (previous !== null && value <= previous) failEvidence(code, "campaign-plan");
    previous = value;
  }
}

function requireUnique(values, code) {
  if (new Set(values).size !== values.length) failEvidence(code, "campaign-plan");
}

function planIdentity(draft) {
  const bytes = canonicalizeVnextJcsBytes(draft, jcsLimits);
  return crypto.createHash("sha256")
    .update(Buffer.from(parsedProfile.planIdentityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(bytes)
    .digest("hex");
}

function normalizeModels(raw) {
  const source = exactDataArray(raw, parsedProfile.objectiveTargets.qualifiedModels,
    "campaign_plan_model_identity_invalid", "campaign-plan");
  if (source.length !== parsedProfile.objectiveTargets.qualifiedModels) {
    failEvidence("campaign_plan_model_identity_invalid", "campaign-plan");
  }
  const result = source.map((value) => {
    const model = exactDataObject(value, parsedProfile.modelFields,
      "campaign_plan_model_identity_invalid", "campaign-plan");
    requireSafeId(model.modelSlotId, "campaign_plan_model_identity_invalid",
      "campaign-plan");
    requireSafeId(model.qualificationOperationId,
      "campaign_plan_model_identity_invalid", "campaign-plan");
    requireDigest(model.artifactSha256, "campaign_plan_model_identity_invalid",
      "campaign-plan");
    requireContentId(model.artifactId, "campaign_plan_model_identity_invalid",
      "campaign-plan");
    if (model.artifactId !== `sha256:${model.artifactSha256}`) {
      failEvidence("campaign_plan_model_identity_invalid", "campaign-plan");
    }
    return model;
  });
  requireSortedUnique(result, "modelSlotId", "campaign_plan_model_identity_invalid");
  requireUnique(result.map((entry) => entry.artifactId),
    "campaign_plan_model_identity_invalid");
  requireUnique(result.map((entry) => entry.artifactSha256),
    "campaign_plan_model_identity_invalid");
  requireUnique(result.map((entry) => entry.qualificationOperationId),
    "campaign_plan_model_identity_invalid");
  return result;
}

function normalizeBrowserRounds(raw, modelIds) {
  const target = parsedProfile.objectiveTargets.cleanBrowserRounds;
  const source = exactDataArray(raw, target,
    "campaign_plan_browser_schedule_invalid", "campaign-plan");
  if (source.length !== target) {
    failEvidence("campaign_plan_browser_schedule_invalid", "campaign-plan");
  }
  const result = source.map((value) => {
    const round = exactDataObject(value, parsedProfile.browserRoundFields,
      "campaign_plan_browser_schedule_invalid", "campaign-plan");
    for (const name of ["modelSlotId", "operationId", "restartId", "roundId"]) {
      requireSafeId(round[name], "campaign_plan_browser_schedule_invalid",
        "campaign-plan");
    }
    if (!modelIds.has(round.modelSlotId) ||
        typeof round.memoryContinuityRequired !== "boolean") {
      failEvidence("campaign_plan_browser_schedule_invalid", "campaign-plan");
    }
    return round;
  });
  requireSortedUnique(result, "roundId", "campaign_plan_browser_schedule_invalid");
  for (const name of ["roundId", "operationId", "restartId"]) {
    requireUnique(result.map((entry) => entry[name]),
      "campaign_plan_browser_schedule_invalid");
  }
  if (result.filter((entry) => entry.memoryContinuityRequired).length !==
      parsedProfile.objectiveTargets.liveMemoryRounds) {
    failEvidence("campaign_plan_browser_schedule_invalid", "campaign-plan");
  }
  for (const modelId of modelIds) {
    const restarts = result.filter((entry) => entry.modelSlotId === modelId)
      .map((entry) => entry.restartId);
    if (new Set(restarts).size < parsedProfile.planPolicy.browserRestartMinimumPerModel) {
      failEvidence("campaign_plan_browser_schedule_invalid", "campaign-plan");
    }
  }
  return result;
}

function normalizeMemoryRounds(raw, browserRounds, modelIds) {
  const target = parsedProfile.objectiveTargets.liveMemoryRounds;
  const source = exactDataArray(raw, target,
    "campaign_plan_memory_schedule_invalid", "campaign-plan");
  if (source.length !== target) {
    failEvidence("campaign_plan_memory_schedule_invalid", "campaign-plan");
  }
  const browserById = new Map(browserRounds.map((entry) => [entry.roundId, entry]));
  const result = source.map((value) => {
    const memory = exactDataObject(value, parsedProfile.memoryRoundFields,
      "campaign_plan_memory_schedule_invalid", "campaign-plan");
    for (const name of ["browserRoundId", "memoryRoundId", "modelSlotId", "operationId"]) {
      requireSafeId(memory[name], "campaign_plan_memory_schedule_invalid",
        "campaign-plan");
    }
    requireDigest(memory.companyIdHash, "campaign_plan_memory_schedule_invalid",
      "campaign-plan");
    const browser = browserById.get(memory.browserRoundId);
    if (!modelIds.has(memory.modelSlotId) || !browser ||
        !browser.memoryContinuityRequired || browser.modelSlotId !== memory.modelSlotId) {
      failEvidence("campaign_plan_memory_schedule_invalid", "campaign-plan");
    }
    return memory;
  });
  requireSortedUnique(result, "memoryRoundId", "campaign_plan_memory_schedule_invalid");
  for (const name of ["browserRoundId", "companyIdHash", "memoryRoundId", "operationId"]) {
    requireUnique(result.map((entry) => entry[name]),
      "campaign_plan_memory_schedule_invalid");
  }
  const designated = browserRounds.filter((entry) => entry.memoryContinuityRequired)
    .map((entry) => entry.roundId).sort();
  const bound = result.map((entry) => entry.browserRoundId).sort();
  if (!sameStrings(designated, bound)) {
    failEvidence("campaign_plan_memory_schedule_invalid", "campaign-plan");
  }
  return result;
}

function normalizeLanes(raw, modelIds) {
  const target = parsedProfile.objectiveTargets.outsideProvenLanes;
  const source = exactDataArray(raw, target,
    "campaign_plan_lane_identity_invalid", "campaign-plan");
  if (source.length !== target) {
    failEvidence("campaign_plan_lane_identity_invalid", "campaign-plan");
  }
  const result = source.map((value) => {
    const lane = exactDataObject(value, parsedProfile.p2pLaneFields,
      "campaign_plan_lane_identity_invalid", "campaign-plan");
    for (const name of ["laneId", "modelSlotId", "processInstanceId"]) {
      requireSafeId(lane[name], "campaign_plan_lane_identity_invalid", "campaign-plan");
    }
    if (!modelIds.has(lane.modelSlotId)) {
      failEvidence("campaign_plan_lane_identity_invalid", "campaign-plan");
    }
    return lane;
  });
  requireSortedUnique(result, "laneId", "campaign_plan_lane_identity_invalid");
  requireUnique(result.map((entry) => entry.processInstanceId),
    "campaign_plan_lane_identity_invalid");
  for (const modelId of modelIds) {
    if (result.filter((entry) => entry.modelSlotId === modelId).length !==
        parsedProfile.planPolicy.lanesPerModel) {
      failEvidence("campaign_plan_lane_identity_invalid", "campaign-plan");
    }
  }
  return result;
}

function normalizeAnnouncements(raw, modelIds) {
  const target = parsedProfile.objectiveTargets.announcedModels;
  const source = exactDataArray(raw, target,
    "campaign_plan_announcement_schedule_invalid", "campaign-plan");
  if (source.length !== target) {
    failEvidence("campaign_plan_announcement_schedule_invalid", "campaign-plan");
  }
  const result = source.map((value) => {
    const announcement = exactDataObject(value, parsedProfile.announcementFields,
      "campaign_plan_announcement_schedule_invalid", "campaign-plan");
    for (const name of ["announcementId", "modelSlotId", "operationId"]) {
      requireSafeId(announcement[name],
        "campaign_plan_announcement_schedule_invalid", "campaign-plan");
    }
    if (!modelIds.has(announcement.modelSlotId)) {
      failEvidence("campaign_plan_announcement_schedule_invalid", "campaign-plan");
    }
    return announcement;
  });
  requireSortedUnique(result, "announcementId",
    "campaign_plan_announcement_schedule_invalid");
  for (const name of ["announcementId", "modelSlotId", "operationId"]) {
    requireUnique(result.map((entry) => entry[name]),
      "campaign_plan_announcement_schedule_invalid");
  }
  return result;
}

function normalizePlanDraft(rawInput) {
  const input = exactDataObject(rawInput, parsedProfile.planDraftFields,
    "campaign_plan_fields_invalid", "campaign-plan");
  if (input.schema !== parsedProfile.planSchema ||
      input.profileId !== parsedProfile.profileId ||
      !environments.has(input.environment)) {
    failEvidence("campaign_plan_profile_invalid", "campaign-plan");
  }
  requireSafeId(input.campaignId, "campaign_plan_value_invalid", "campaign-plan");
  requireOrigin(input.applicationOrigin, "campaign_plan_value_invalid");
  requireContentId(input.memoryContractId, "campaign_plan_value_invalid",
    "campaign-plan");
  requireUtc(input.createdAtUtc, "campaign_plan_value_invalid", "campaign-plan");
  const models = normalizeModels(input.models);
  const modelIds = new Set(models.map((entry) => entry.modelSlotId));
  const browserRounds = normalizeBrowserRounds(input.browserRounds, modelIds);
  const memoryRounds = normalizeMemoryRounds(input.memoryRounds, browserRounds, modelIds);
  const p2pLanes = normalizeLanes(input.p2pLanes, modelIds);
  const announcements = normalizeAnnouncements(input.announcements, modelIds);
  const operationIds = [
    ...models.map((entry) => entry.qualificationOperationId),
    ...browserRounds.map((entry) => entry.operationId),
    ...memoryRounds.map((entry) => entry.operationId),
    ...announcements.map((entry) => entry.operationId)
  ];
  requireUnique(operationIds, "campaign_plan_operation_identity_invalid");
  return {
    schema: input.schema,
    profileId: input.profileId,
    campaignId: input.campaignId,
    environment: input.environment,
    applicationOrigin: input.applicationOrigin,
    memoryContractId: input.memoryContractId,
    createdAtUtc: input.createdAtUtc,
    models,
    browserRounds,
    memoryRounds,
    p2pLanes,
    announcements
  };
}

function immutablePlanResult(plan, bytes) {
  const canonical = Buffer.from(bytes);
  const result = {
    plan: deepFreeze(plan),
    planSha256: sha256(canonical)
  };
  Object.defineProperty(result, "bytes", {
    enumerable: true,
    get() {
      return Buffer.from(canonical);
    }
  });
  return Object.freeze(result);
}

function finalizeVnextCampaignPlan(rawInput) {
  const draft = normalizePlanDraft(rawInput);
  const plan = { ...draft, planId: `sha256:${planIdentity(draft)}` };
  const bytes = canonicalizeVnextJcsBytes(plan, jcsLimits);
  if (bytes.length > parsedProfile.limits.maximumPlanBytes) {
    failEvidence("campaign_plan_byte_limit", "campaign-plan");
  }
  return immutablePlanResult(plan, bytes);
}

function validateCampaignPlanBytes(rawBytes) {
  const bytes = normalizeBytes(rawBytes, "campaign_plan_bytes_required",
    "campaign-projection-input");
  if (bytes.length === 0 || bytes.length > parsedProfile.limits.maximumPlanBytes) {
    failEvidence("campaign_plan_byte_limit", "campaign-projection-input");
  }
  let value;
  try {
    value = parseStrictJson(bytes, parserLimits);
  } catch (error) {
    throw new VnextEvidenceError("campaign_plan_invalid", "campaign-projection-input",
      error?.code);
  }
  exactDataObject(value, parsedProfile.planFields,
    "campaign_plan_fields_invalid", "campaign-projection-input");
  const draft = {};
  for (const name of parsedProfile.planDraftFields) draft[name] = value[name];
  const finalized = finalizeVnextCampaignPlan(draft);
  if (!bytes.equals(finalized.bytes) || value.planId !== finalized.plan.planId) {
    failEvidence("campaign_plan_identity_mismatch", "campaign-projection-input");
  }
  return finalized;
}

function parseProjectionInput(rawInput) {
  const input = exactDataObject(rawInput, projectionInputFields,
    "campaign_projection_input_invalid", "campaign-projection-input");
  requireDigest(input.expectedCampaignPlanSha256,
    "campaign_projection_input_invalid", "campaign-projection-input");
  requireSafeId(input.expectedCampaignId, "campaign_projection_input_invalid",
    "campaign-projection-input");
  if (!environments.has(input.expectedEnvironment)) {
    failEvidence("campaign_projection_input_invalid", "campaign-projection-input");
  }
  requireUtc(input.verificationTimeUtc, "campaign_projection_input_invalid",
    "campaign-projection-input");
  const rootNull = input.trustedRootRegistryReceiptId === null;
  const terminalNull = input.expectedTerminalRegistryReceiptId === null;
  if (rootNull !== terminalNull || !rootNull &&
      (!contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
       !contentIdPattern.test(input.expectedTerminalRegistryReceiptId))) {
    failEvidence("campaign_projection_input_invalid", "campaign-projection-input");
  }
  const campaignPlanBytes = normalizeBytes(input.campaignPlanBytes,
    "campaign_projection_input_invalid", "campaign-projection-input");
  if (sha256(campaignPlanBytes) !== input.expectedCampaignPlanSha256) {
    failEvidence("campaign_plan_hash_mismatch", "campaign-projection-input");
  }
  const campaignPlan = validateCampaignPlanBytes(campaignPlanBytes);
  if (campaignPlan.plan.campaignId !== input.expectedCampaignId ||
      campaignPlan.plan.environment !== input.expectedEnvironment) {
    failEvidence("campaign_plan_projection_mismatch", "campaign-projection-input");
  }
  const receipts = boundedByteArray(input.receiptBytes,
    parsedProfile.limits.maximumReceiptInputs,
    parsedProfile.limits.maximumTotalReceiptBytes,
    "campaign_projection_receipt_input_invalid");
  const subjects = boundedByteArray(input.subjectBytes,
    parsedProfile.limits.maximumSubjectInputs,
    parsedProfile.limits.maximumTotalSubjectBytes,
    "campaign_projection_subject_input_invalid");
  return {
    ...input,
    campaignPlan,
    receiptBytes: receipts.bytes,
    subjectBytes: subjects.bytes
  };
}

function parseEvidence(input) {
  const receipts = [];
  const receiptsById = new Map();
  for (const bytes of input.receiptBytes) {
    const entry = validateVnextReceiptBytes(bytes);
    const id = entry.receipt.receiptId;
    if (receiptsById.has(id)) {
      failEvidence("campaign_projection_receipt_duplicate", "campaign-projection-evidence");
    }
    if (entry.receipt.campaignId !== input.expectedCampaignId) {
      failEvidence("campaign_projection_campaign_mismatch", "campaign-projection-evidence");
    }
    receipts.push(entry);
    receiptsById.set(id, entry);
  }
  receipts.sort((left, right) =>
    left.receipt.receiptId.localeCompare(right.receipt.receiptId));

  const subjects = [];
  const subjectsById = new Map();
  for (const bytes of input.subjectBytes) {
    const entry = validateVnextIdentityDocumentBytes(bytes);
    if (subjectsById.has(entry.subjectId) || receiptsById.has(entry.subjectId)) {
      failEvidence("campaign_projection_subject_duplicate", "campaign-projection-evidence");
    }
    if (Object.hasOwn(entry.value, "campaignId") &&
        entry.value.campaignId !== input.expectedCampaignId) {
      failEvidence("campaign_projection_campaign_mismatch", "campaign-projection-evidence");
    }
    subjects.push(entry);
    subjectsById.set(entry.subjectId, entry);
  }
  subjects.sort((left, right) => left.subjectId.localeCompare(right.subjectId));
  return { receipts, receiptsById, subjects, subjectsById };
}

function emptyPhaseClassification(campaignId) {
  return {
    campaignId,
    conflictingOperationIdentities: [],
    currentPhaseReceiptIds: [],
    eligiblePassPhaseReceiptIds: [],
    health: "healthy",
    receiptCount: 0,
    records: [],
    retainedHistoricalReceiptIds: []
  };
}

function classifyPhases(input, evidence) {
  const phaseEntries = evidence.receipts.filter((entry) =>
    supportedPhaseTypes.has(entry.receipt.receiptType));
  if (phaseEntries.length === 0) return emptyPhaseClassification(input.expectedCampaignId);
  return classifyVnextPhaseReceipts({
    campaignId: input.expectedCampaignId,
    receiptBytes: phaseEntries.map((entry) => entry.bytes)
  }).result;
}

function verifyAuthority(input) {
  if (input.trustedRootRegistryReceiptId === null) return null;
  return verifyVnextAuthorityGraph({
    campaignId: input.expectedCampaignId,
    environment: input.expectedEnvironment,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytes: input.receiptBytes,
    subjectBytes: input.subjectBytes,
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    verificationTimeUtc: input.verificationTimeUtc
  });
}

function parameterMap(receipt) {
  const map = new Map();
  for (const entry of receipt.publicParameters) {
    if (map.has(entry.name)) return null;
    map.set(entry.name, entry.value);
  }
  return map;
}

function exactParameters(receipt, expected) {
  const actual = parameterMap(receipt);
  const names = Object.keys(expected).sort();
  return actual !== null && actual.size === names.length && names.every((name) =>
    actual.get(name) === String(expected[name]));
}

function exactOutputHashes(receipt, expected) {
  const names = Object.keys(expected).sort();
  return receipt.outputHashes.length === names.length && names.every((name, index) => {
    const entry = receipt.outputHashes[index];
    return entry.name === name && entry.sha256 === expected[name];
  });
}

function hasInputHash(receipt, name, digest) {
  return receipt.inputHashes.some((entry) => entry.name === name && entry.sha256 === digest);
}

function bindingForType(receiptType) {
  return parsedProfile.objectiveReceiptBindings.find((entry) =>
    entry.receiptType === receiptType);
}

function currentSignaturesBySubject(authority) {
  const result = new Map();
  if (authority === null) return result;
  for (const signature of authority.signatures) {
    if (!signature.currentEvidenceEligible) continue;
    const values = result.get(signature.signedSubjectId) ?? [];
    values.push(signature);
    result.set(signature.signedSubjectId, values);
  }
  for (const values of result.values()) {
    values.sort((left, right) =>
      left.signatureReceiptId.localeCompare(right.signatureReceiptId));
  }
  return result;
}

function expectedCurrentSignatures(index, subjectId, binding) {
  return (index.get(subjectId) ?? []).filter((entry) =>
    entry.role === binding.role && entry.scope === binding.scope);
}

function runtimeEquals(receipt, expected) {
  return Object.entries(expected).every(([name, value]) => receipt.runtime[name] === value);
}

function matchQualification(record, receipt, planIndex) {
  const slot = planIndex.modelByQualificationOperation.get(record.operationId);
  if (!slot || record.phase !== "qualification" ||
      record.receiptType !== "qualification" || record.subjectId !== slot.artifactId ||
      !exactParameters(receipt, {
        operation_id: slot.qualificationOperationId,
        subject_id: slot.artifactId,
        artifact_id: slot.artifactId,
        artifact_sha256: slot.artifactSha256,
        model_slot_id: slot.modelSlotId
      }) ||
      !exactOutputHashes(receipt, { "qualified-artifact": slot.artifactSha256 }) ||
      !runtimeEquals(receipt, { executionClass: "local" })) return null;
  return slot;
}

function matchBrowser(record, receipt, planIndex) {
  const round = planIndex.browserByOperation.get(record.operationId);
  if (!round || record.phase !== "browser-round" ||
      record.receiptType !== "browser-round" || record.subjectId !== round.roundId) return null;
  const slot = planIndex.modelById.get(round.modelSlotId);
  const parameters = parameterMap(receipt);
  if (!parameters || parameters.size !== 9 ||
      parameters.get("operation_id") !== round.operationId ||
      parameters.get("subject_id") !== round.roundId ||
      parameters.get("artifact_id") !== slot.artifactId ||
      parameters.get("fresh_profile_created") !== "true" ||
      parameters.get("model_slot_id") !== slot.modelSlotId ||
      parameters.get("profile_deleted") !== "true" ||
      parameters.get("restart_id") !== round.restartId ||
      parameters.get("round_id") !== round.roundId ||
      !/^[2-6]$/u.test(parameters.get("turn_count") ?? "") ||
      !exactOutputHashes(receipt, {
        "conversation-evidence": receipt.outputHashes.find((entry) =>
          entry.name === "conversation-evidence")?.sha256,
        "profile-deletion-proof": receipt.outputHashes.find((entry) =>
          entry.name === "profile-deletion-proof")?.sha256
      }) ||
      !runtimeEquals(receipt, {
        architecture: "wasm32", executionClass: "browser", operatingSystem: "browser"
      })) return null;
  return { round, slot };
}

function matchMemory(record, receipt, planIndex) {
  const memory = planIndex.memoryByOperation.get(record.operationId);
  if (!memory || record.phase !== "memory-continuity" ||
      record.receiptType !== "memory-continuity" ||
      record.subjectId !== memory.memoryRoundId) return null;
  const round = planIndex.browserById.get(memory.browserRoundId);
  const slot = planIndex.modelById.get(memory.modelSlotId);
  if (!exactParameters(receipt, {
    operation_id: memory.operationId,
    subject_id: memory.memoryRoundId,
    artifact_id: slot.artifactId,
    browser_round_id: round.roundId,
    company_closed: "true",
    company_deleted: "true",
    company_id_hash: memory.companyIdHash,
    first_profile_deleted: "true",
    long_term_restored: "true",
    memory_contract_id: planIndex.plan.memoryContractId,
    memory_round_id: memory.memoryRoundId,
    model_slot_id: slot.modelSlotId,
    post_delete_rejected: "true",
    replay_rejected: "true",
    second_profile_deleted: "true",
    secret_scan_clear: "true",
    short_term_restored: "true"
  }) || !hasInputHash(receipt, "memory-contract",
    planIndex.plan.memoryContractId.slice("sha256:".length)) ||
      !exactOutputHashes(receipt, {
        "cleanup-proof": receipt.outputHashes.find((entry) =>
          entry.name === "cleanup-proof")?.sha256,
        "restore-proof": receipt.outputHashes.find((entry) =>
          entry.name === "restore-proof")?.sha256,
        "secret-scan": receipt.outputHashes.find((entry) =>
          entry.name === "secret-scan")?.sha256
      }) ||
      !runtimeEquals(receipt, { executionClass: "live-service" })) return null;
  return { memory, round, slot };
}

function matchAnnouncement(record, receipt, planIndex) {
  const announcement = planIndex.announcementByOperation.get(record.operationId);
  if (!announcement || record.phase !== "catalog-announcement" ||
      record.receiptType !== "catalog-announcement" ||
      record.subjectId !== announcement.announcementId) return null;
  const slot = planIndex.modelById.get(announcement.modelSlotId);
  if (!exactParameters(receipt, {
    operation_id: announcement.operationId,
    subject_id: announcement.announcementId,
    announcement_id: announcement.announcementId,
    artifact_id: slot.artifactId,
    live_readback_verified: "true",
    model_slot_id: slot.modelSlotId,
    public_https: "true"
  }) || !exactOutputHashes(receipt, {
    "announcement-metadata": receipt.outputHashes.find((entry) =>
      entry.name === "announcement-metadata")?.sha256,
    "catalog-readback": receipt.outputHashes.find((entry) =>
      entry.name === "catalog-readback")?.sha256
  }) || !runtimeEquals(receipt, { executionClass: "live-service" })) return null;
  return { announcement, slot };
}

function planIndex(plan) {
  return {
    plan,
    modelById: new Map(plan.models.map((entry) => [entry.modelSlotId, entry])),
    modelByQualificationOperation: new Map(plan.models.map((entry) =>
      [entry.qualificationOperationId, entry])),
    browserById: new Map(plan.browserRounds.map((entry) => [entry.roundId, entry])),
    browserByOperation: new Map(plan.browserRounds.map((entry) =>
      [entry.operationId, entry])),
    memoryByOperation: new Map(plan.memoryRounds.map((entry) =>
      [entry.operationId, entry])),
    laneById: new Map(plan.p2pLanes.map((entry) => [entry.laneId, entry])),
    announcementByOperation: new Map(plan.announcements.map((entry) =>
      [entry.operationId, entry]))
  };
}

function exactOutsideProof(subject, lane, slot, verificationTime) {
  const proof = subject.value;
  if (subject.schema !== parsedProfile.outsideProofBinding.schema ||
      proof.modelArtifactId !== slot.artifactId || proof.laneId !== lane.laneId ||
      proof.processInstanceId !== lane.processInstanceId ||
      proof.networkScope !== parsedProfile.outsideProofBinding.networkScope ||
      proof.completeTransferSha256 !== slot.artifactSha256 ||
      !Number.isSafeInteger(proof.completeTransferBytes) || proof.completeTransferBytes < 1 ||
      !contentIdPattern.test(proof.p2pManifestId) ||
      typeof proof.endpoint !== "string") return false;
  let endpoint;
  try {
    endpoint = new URL(proof.endpoint);
  } catch {
    return false;
  }
  if (endpoint.protocol !== "https:" || endpoint.origin + "/" !== proof.endpoint ||
      endpoint.username !== "" || endpoint.password !== "") return false;
  const routes = proof.checkedRoutes;
  if (!Array.isArray(routes) || routes.length !== 3) return false;
  const routeByPath = new Map(routes.map((entry) => [entry.path, entry]));
  const artifact = routeByPath.get("/artifact");
  const manifest = routeByPath.get("/manifest");
  const piece = routeByPath.get("/pieces/0");
  if (routeByPath.size !== 3 || !artifact || !manifest || !piece ||
      routes.some((entry) => entry.method !== "GET" || entry.status !== 200 ||
        !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 1) ||
      artifact.responseSha256 !== slot.artifactSha256) return false;
  const issued = utcNanoseconds(proof.issuedAtUtc);
  const observed = utcNanoseconds(proof.observedAtUtc);
  const expires = utcNanoseconds(proof.expiresAtUtc);
  return issued !== null && observed !== null && expires !== null &&
    observed <= issued && issued < expires && verificationTime < expires;
}

function phaseMatcher(type, record, receipt, index) {
  if (type === "qualification") return matchQualification(record, receipt, index);
  if (type === "browser-round") return matchBrowser(record, receipt, index);
  if (type === "memory-continuity") return matchMemory(record, receipt, index);
  if (type === "catalog-announcement") return matchAnnouncement(record, receipt, index);
  return null;
}

function countsObject(values) {
  return {
    announcedModels: {
      current: values.announcedModels,
      target: parsedProfile.objectiveTargets.announcedModels
    },
    cleanBrowserRounds: {
      current: values.cleanBrowserRounds,
      target: parsedProfile.objectiveTargets.cleanBrowserRounds
    },
    liveMemoryRounds: {
      current: values.liveMemoryRounds,
      target: parsedProfile.objectiveTargets.liveMemoryRounds
    },
    outsideProvenLanes: {
      current: values.outsideProvenLanes,
      target: parsedProfile.objectiveTargets.outsideProvenLanes
    },
    qualifiedModels: {
      current: values.qualifiedModels,
      target: parsedProfile.objectiveTargets.qualifiedModels
    }
  };
}

function currentOperation(authority, index, counted, complete) {
  if (complete) return { operationId: null, phase: null, state: "complete" };
  if (authority === null) return { operationId: null, phase: null, state: "blocked" };
  const stages = [
    ["qualification", index.plan.models, counted.qualificationByModel,
      (entry) => entry.modelSlotId, (entry) => entry.qualificationOperationId],
    ["browser-round", index.plan.browserRounds, counted.browserByRound,
      (entry) => entry.roundId, (entry) => entry.operationId],
    ["memory-continuity", index.plan.memoryRounds, counted.memoryByRound,
      (entry) => entry.memoryRoundId, (entry) => entry.operationId],
    ["outside-proof", index.plan.p2pLanes, counted.proofByLane,
      (entry) => entry.laneId, (entry) => entry.laneId],
    ["catalog-announcement", index.plan.announcements, counted.announcementByModel,
      (entry) => entry.modelSlotId, (entry) => entry.operationId]
  ];
  for (const [phase, planned, current, keyFor, operationFor] of stages) {
    const missing = planned.find((entry) => !current.has(keyFor(entry)));
    if (missing) return { operationId: operationFor(missing), phase, state: "pending" };
  }
  return { operationId: null, phase: null, state: "blocked" };
}

function immutableProjectionResult(result, bytes) {
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
    resultSha256: { enumerable: true, value: sha256(canonical) }
  });
  return Object.freeze(output);
}

function projectVnextCampaign(rawInput) {
  const input = parseProjectionInput(rawInput);
  const evidence = parseEvidence(input);
  const phase = classifyPhases(input, evidence);
  const authority = verifyAuthority(input);
  const signatures = currentSignaturesBySubject(authority);
  const index = planIndex(input.campaignPlan.plan);
  const recordsById = new Map(phase.records.map((entry) => [entry.receiptId, entry]));
  const phaseStateCounts = {
    conflict: 0,
    "current-nonpass": 0,
    "current-pass": 0,
    stale: 0,
    superseded: 0
  };
  for (const record of phase.records) phaseStateCounts[record.state] += 1;

  const unplannedCurrentReceiptIds = [];
  const unsignedCurrentReceiptIds = [];
  const conflictingObjectiveSignatureSubjectIds = [];
  const exactByType = new Map();
  for (const entry of evidence.receipts) {
    const receipt = entry.receipt;
    if (!objectiveTypes.has(receipt.receiptType)) continue;
    const record = recordsById.get(receipt.receiptId);
    if (!record) continue;
    const matched = phaseMatcher(receipt.receiptType, record, receipt, index);
    const isCurrent = record.state === "current-pass" ||
      record.state === "current-nonpass";
    if (!matched) {
      if (isCurrent) unplannedCurrentReceiptIds.push(receipt.receiptId);
      continue;
    }
    exactByType.set(receipt.receiptId, { entry, record, matched });
    if (!isCurrent) continue;
    const expected = expectedCurrentSignatures(signatures, receipt.receiptId,
      bindingForType(receipt.receiptType));
    if (expected.length === 0) unsignedCurrentReceiptIds.push(receipt.receiptId);
    if (expected.length > 1) {
      conflictingObjectiveSignatureSubjectIds.push(receipt.receiptId);
    }
  }
  unplannedCurrentReceiptIds.sort();
  unsignedCurrentReceiptIds.sort();
  conflictingObjectiveSignatureSubjectIds.sort();

  const usedSignatureIds = new Set();
  const counted = {
    qualificationByModel: new Map(),
    browserByRound: new Map(),
    memoryByRound: new Map(),
    proofByLane: new Map(),
    announcementByModel: new Map()
  };
  const currentSigned = (value, receiptType) => {
    if (!value || value.record.state !== "current-pass") return null;
    const values = expectedCurrentSignatures(signatures,
      value.entry.receipt.receiptId, bindingForType(receiptType));
    return values.length === 1 ? values[0] : null;
  };

  for (const slot of index.plan.models) {
    const value = [...exactByType.values()].find((entry) =>
      entry.record.receiptType === "qualification" &&
      entry.matched.modelSlotId === slot.modelSlotId);
    const signed = currentSigned(value, "qualification");
    if (!signed) continue;
    counted.qualificationByModel.set(slot.modelSlotId, value.entry.receipt.receiptId);
    usedSignatureIds.add(signed.signatureReceiptId);
  }
  for (const round of index.plan.browserRounds) {
    const value = [...exactByType.values()].find((entry) =>
      entry.record.receiptType === "browser-round" &&
      entry.matched.round.roundId === round.roundId);
    const qualificationId = counted.qualificationByModel.get(round.modelSlotId);
    const signed = currentSigned(value, "browser-round");
    if (!signed || !qualificationId ||
        !value.entry.receipt.inputReceiptIds.includes(qualificationId)) continue;
    counted.browserByRound.set(round.roundId, value.entry.receipt.receiptId);
    usedSignatureIds.add(signed.signatureReceiptId);
  }
  for (const memory of index.plan.memoryRounds) {
    const value = [...exactByType.values()].find((entry) =>
      entry.record.receiptType === "memory-continuity" &&
      entry.matched.memory.memoryRoundId === memory.memoryRoundId);
    const browserId = counted.browserByRound.get(memory.browserRoundId);
    const signed = currentSigned(value, "memory-continuity");
    if (!signed || !browserId || !value.entry.receipt.inputReceiptIds.includes(browserId)) {
      continue;
    }
    counted.memoryByRound.set(memory.memoryRoundId, value.entry.receipt.receiptId);
    usedSignatureIds.add(signed.signatureReceiptId);
  }

  const conflictingLaneIds = [];
  const verificationTime = utcNanoseconds(input.verificationTimeUtc);
  if (authority !== null) {
    for (const lane of index.plan.p2pLanes) {
      const slot = index.modelById.get(lane.modelSlotId);
      const candidates = [];
      for (const subject of evidence.subjects) {
        if (!exactOutsideProof(subject, lane, slot, verificationTime)) continue;
        const values = expectedCurrentSignatures(signatures, subject.subjectId,
          parsedProfile.outsideProofBinding).filter((entry) =>
          entry.signedSchema === parsedProfile.outsideProofBinding.schema);
        for (const signature of values) candidates.push({ signature, subject });
      }
      if (candidates.length > 1) {
        conflictingLaneIds.push(lane.laneId);
      } else if (candidates.length === 1) {
        counted.proofByLane.set(lane.laneId, candidates[0].subject.subjectId);
        usedSignatureIds.add(candidates[0].signature.signatureReceiptId);
      }
    }
  }
  conflictingLaneIds.sort();

  for (const announcement of index.plan.announcements) {
    const value = [...exactByType.values()].find((entry) =>
      entry.record.receiptType === "catalog-announcement" &&
      entry.matched.announcement.announcementId === announcement.announcementId);
    const signed = currentSigned(value, "catalog-announcement");
    const qualificationId = counted.qualificationByModel.get(announcement.modelSlotId);
    const lanes = index.plan.p2pLanes.filter((entry) =>
      entry.modelSlotId === announcement.modelSlotId);
    if (!signed || !qualificationId ||
        !value.entry.receipt.inputReceiptIds.includes(qualificationId) ||
        lanes.some((lane) => !counted.proofByLane.has(lane.laneId))) continue;
    counted.announcementByModel.set(announcement.modelSlotId,
      value.entry.receipt.receiptId);
    usedSignatureIds.add(signed.signatureReceiptId);
  }

  const countValues = {
    qualifiedModels: counted.qualificationByModel.size,
    cleanBrowserRounds: counted.browserByRound.size,
    liveMemoryRounds: counted.memoryByRound.size,
    outsideProvenLanes: counted.proofByLane.size,
    announcedModels: counted.announcementByModel.size
  };
  const counts = countsObject(countValues);
  const blockerCodes = [];
  if (authority === null) blockerCodes.push("authority_graph_unavailable");
  else if (!authority.terminalRegistryCurrent) blockerCodes.push("authority_registry_not_current");
  if (phase.conflictingOperationIdentities.length > 0) {
    blockerCodes.push("phase_conflicts_detected");
  }
  if (conflictingLaneIds.length > 0) blockerCodes.push("outside_proof_conflicts");
  if (conflictingObjectiveSignatureSubjectIds.length > 0) {
    blockerCodes.push("objective_signature_conflicts");
  }
  if (unplannedCurrentReceiptIds.length > 0) {
    blockerCodes.push("unplanned_current_objective_evidence");
  }
  if (unsignedCurrentReceiptIds.length > 0) {
    blockerCodes.push("unsigned_current_objective_evidence");
  }
  if (countValues.qualifiedModels !== parsedProfile.objectiveTargets.qualifiedModels) {
    blockerCodes.push("qualified_models_incomplete");
  }
  if (countValues.cleanBrowserRounds !== parsedProfile.objectiveTargets.cleanBrowserRounds) {
    blockerCodes.push("clean_browser_rounds_incomplete");
  }
  if (countValues.liveMemoryRounds !== parsedProfile.objectiveTargets.liveMemoryRounds) {
    blockerCodes.push("live_memory_rounds_incomplete");
  }
  if (countValues.outsideProvenLanes !== parsedProfile.objectiveTargets.outsideProvenLanes) {
    blockerCodes.push("outside_proofs_incomplete");
  }
  if (countValues.announcedModels !== parsedProfile.objectiveTargets.announcedModels) {
    blockerCodes.push("catalog_announcements_incomplete");
  }
  blockerCodes.sort();
  const complete = blockerCodes.length === 0;
  const blocked = authority === null || phase.conflictingOperationIdentities.length > 0 ||
    conflictingLaneIds.length > 0 || conflictingObjectiveSignatureSubjectIds.length > 0 ||
    unplannedCurrentReceiptIds.length > 0;
  const operation = currentOperation(authority, index, counted, complete);
  const result = {
    schema: parsedProfile.resultSchema,
    profileId: parsedProfile.profileId,
    profileSha256: campaignProjectionProfileSha256,
    campaignId: input.expectedCampaignId,
    environment: input.expectedEnvironment,
    campaignPlanId: input.campaignPlan.plan.planId,
    campaignPlanSha256: input.campaignPlan.planSha256,
    verificationTimeUtc: input.verificationTimeUtc,
    authorityStatus: authority === null ? "unavailable" : "verified",
    authorityTerminalRegistryReceiptId: authority?.terminalRegistryReceiptId ?? null,
    counts,
    complete,
    resumableState: complete ? "complete" : blocked ? "blocked" : "resumable",
    currentOperation: operation,
    blockerCodes,
    objectiveReceiptCount: evidence.receipts.filter((entry) =>
      objectiveTypes.has(entry.receipt.receiptType)).length,
    objectiveSignatureCount: usedSignatureIds.size,
    phaseReceiptCount: phase.receiptCount,
    phaseStateCounts,
    conflictingOperationIdentities: [...phase.conflictingOperationIdentities],
    conflictingLaneIds,
    conflictingObjectiveSignatureSubjectIds,
    unsignedCurrentReceiptIds,
    unplannedCurrentReceiptIds,
    countedEvidence: {
      announcedModelReceiptIds: [...counted.announcementByModel.values()].sort(),
      browserRoundReceiptIds: [...counted.browserByRound.values()].sort(),
      memoryRoundReceiptIds: [...counted.memoryByRound.values()].sort(),
      outsideProofSubjectIds: [...counted.proofByLane.values()].sort(),
      qualificationReceiptIds: [...counted.qualificationByModel.values()].sort(),
      signatureReceiptIds: [...usedSignatureIds].sort()
    }
  };
  const resultBytes = canonicalizeVnextJcsBytes(result, jcsLimits);
  if (resultBytes.length > parsedProfile.limits.maximumProjectionResultBytes) {
    failEvidence("campaign_projection_result_byte_limit", "campaign-projection-result");
  }
  return immutableProjectionResult(result, resultBytes);
}

module.exports = Object.freeze({
  campaignProjectionProfile,
  campaignProjectionProfileSha256,
  finalizeVnextCampaignPlan,
  projectVnextCampaign,
  validateCampaignPlanBytes
});
