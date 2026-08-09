"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const {
  VnextEvidenceError,
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");
const {
  createVnextCreateOnlyFiles,
  immutableRecord
} = require("./vnext-create-only-files.js");
const {
  createVnextReceiptStore,
  storeProfile: receiptStoreProfile
} = require("./vnext-receipt-store.js");
const {
  createVnextSubjectStore,
  subjectStoreProfile,
  subjectStoreProfileSha256
} = require("./vnext-subject-store.js");
const {
  campaignArtifactStoreProfile,
  campaignArtifactStoreProfileSha256,
  createVnextCampaignArtifactStore
} = require("./vnext-campaign-artifact-store.js");
const { utcNanoseconds } = require("./vnext-signature-payload.js");
const campaignEvidenceAdapter = require("./generated/vnext-campaign-evidence-wasm.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot, "campaign-runner-profile.v1.json");
const receiptStoreProfilePath = path.join(contractRoot, "receipt-store-profile.v1.json");
const campaignEvidenceProfilePath = path.join(
  contractRoot,
  "campaign-evidence-wasm-interface.v1.json"
);
const profileBytes = fs.readFileSync(profilePath);
const parsedProfile = parseStrictJson(profileBytes);
const expectedCampaignRunnerProfileSha256 =
  "083112f427566bd6e8cdec628d5b16a581d5382bfb95e5b93c09dffc2fbd7f93";
const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const digestFilePattern = /^([a-f0-9]{64})\.json$/u;
const prefixPattern = /^[a-f0-9]{2}$/u;
const temporaryPattern = /^\.([a-f0-9]{64})\.[0-9]{1,20}\.[a-f0-9]{4,64}\.tmp$/u;
const errorCodePattern = /^[a-z][a-z0-9_]{2,79}$/u;
const errorStepPattern = /^[a-z][a-z0-9_-]{2,63}$/u;
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const lockNoncePattern = /^[a-f0-9]{24}$/u;
const lockGenerationFilePattern = /^([a-f0-9]{16})\.json$/u;
const lockTemporaryPattern = /^\.([a-f0-9]{16})\.[0-9]{1,20}\.[a-f0-9]{4,64}\.tmp$/u;
const optionNames = Object.freeze([
  "campaignArtifactStoreRoot",
  "expectedWasmModuleSha256",
  "io",
  "platform",
  "processAlive",
  "randomBytes",
  "receiptStoreRoot",
  "subjectStoreRoot",
  "wasmModuleBytes"
]);
const requiredOptionNames = Object.freeze([
  "campaignArtifactStoreRoot",
  "expectedWasmModuleSha256",
  "receiptStoreRoot",
  "subjectStoreRoot",
  "wasmModuleBytes"
]);
const runInputFields = Object.freeze([
  "campaignPlanSha256",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "operationId",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc"
]);
const startFields = Object.freeze([
  "campaignArtifactStoreProfileId",
  "campaignEvidenceProfileId",
  "campaignPlanId",
  "campaignPlanSha256",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "operationId",
  "planCampaignId",
  "planEnvironment",
  "receiptSnapshot",
  "recordId",
  "schema",
  "state",
  "subjectSnapshot",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "wasmModuleSha256"
]);
const terminalFields = Object.freeze([
  "errorCode",
  "errorStep",
  "operationId",
  "outcome",
  "projectionResultSha256",
  "recordId",
  "schema",
  "startedRecordId",
  "state"
]);
const snapshotFields = Object.freeze([
  "aggregateBytes",
  "memberCount",
  "members",
  "profileId",
  "profileSha256",
  "snapshotSha256"
]);
const snapshotMemberFields = Object.freeze(["byteLength", "id", "wireSha256"]);
const lockClaimFields = Object.freeze([
  "generation",
  "nonce",
  "predecessorClaimSha256",
  "processId",
  "reason",
  "schema"
]);
const lockReleaseFields = Object.freeze([
  "claimSha256",
  "generation",
  "nonce",
  "processId",
  "schema"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameStrings(left, right) {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function exactObject(value, fields, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== fields.length || names.some((name) => !fields.includes(name))) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result[name] = descriptor.value;
  }
  return result;
}

function exactArray(value, maximum, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 || value.length > maximum) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes("length")) {
    failEvidence(code, step);
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result.push(descriptor.value);
  }
  return result;
}

function profileFailure() {
  failEvidence("campaign_runner_profile_invalid", "campaign-runner-profile");
}

function validateInstalledProfile() {
  const rootFields = [
    "schema", "profileId", "status", "versionPolicy", "campaignEvidenceProfileId",
    "campaignEvidenceProfileSha256", "campaignArtifactStoreProfileId",
    "campaignArtifactStoreProfileSha256", "receiptStoreProfileId",
    "receiptStoreProfileSha256", "subjectStoreProfileId", "subjectStoreProfileSha256",
    "operationRecordSchema", "operationRecordIdentityDomain", "snapshotIdentityDomain",
    "canonicalJsonProfile", "hashAlgorithm", "networkAccess", "clockAccess",
    "environmentAccess", "randomAccess", "selectionPolicy", "projectionAuthority",
    "storedProjectionAuthority", "snapshotProtocol", "operationRecord", "layout",
    "atomicCreate", "operationLock", "interruption", "rebuild", "limits",
    "resultContract"
  ];
  try {
    exactObject(parsedProfile, rootFields, "campaign_runner_profile_invalid",
      "campaign-runner-profile");
  } catch (_error) {
    profileFailure();
  }
  if (sha256(profileBytes) !== expectedCampaignRunnerProfileSha256) profileFailure();
  const receiptProfileSha256 = sha256(fs.readFileSync(receiptStoreProfilePath));
  const evidenceProfileSha256 = sha256(fs.readFileSync(campaignEvidenceProfilePath));
  const expectedLimits = {
    maximumWasmModuleBytes: 8388608,
    maximumPlanBytes: 1048576,
    maximumReceiptInputs: 2048,
    maximumSubjectInputs: 2048,
    maximumReceiptBytes: 262144,
    maximumSubjectBytes: 2097152,
    maximumTotalReceiptBytes: 67108864,
    maximumTotalSubjectBytes: 67108864,
    maximumOperationRecordBytes: 1048576,
    maximumActiveOperationRecords: 131072,
    maximumActiveOperationBytes: 1073741824,
    maximumQuarantineEntries: 131072,
    maximumDirectoryEntries: 132000,
    maximumScanEntries: 524288,
    maximumLockBytes: 4096,
    maximumLockGenerations: 131072,
    streamBufferBytes: 65536
  };
  const limits = parsedProfile.limits;
  const limitsValid = isPlainObject(limits) &&
    Object.keys(expectedLimits).every((name) => limits[name] === expectedLimits[name]) &&
    Object.keys(limits).length === Object.keys(expectedLimits).length;
  if (parsedProfile.schema !== "tinyrustlm.vnext.campaign_runner_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.campaign-runner.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.campaignEvidenceProfileId !== campaignEvidenceAdapter.profileId ||
      parsedProfile.campaignEvidenceProfileSha256 !== evidenceProfileSha256 ||
      parsedProfile.campaignArtifactStoreProfileId !== campaignArtifactStoreProfile.profileId ||
      parsedProfile.campaignArtifactStoreProfileSha256 !==
        campaignArtifactStoreProfileSha256 ||
      parsedProfile.receiptStoreProfileId !== receiptStoreProfile.profileId ||
      parsedProfile.receiptStoreProfileSha256 !== receiptProfileSha256 ||
      parsedProfile.subjectStoreProfileId !== subjectStoreProfile.profileId ||
      parsedProfile.subjectStoreProfileSha256 !== subjectStoreProfileSha256 ||
      parsedProfile.operationRecordSchema !==
        "tinyrustlm.vnext.campaign_runner_operation.v1" ||
      parsedProfile.operationRecordIdentityDomain !==
        "tinyrustlm.campaign-runner-operation.identity.v1" ||
      parsedProfile.snapshotIdentityDomain !==
        "tinyrustlm.campaign-runner-snapshot.identity.v1" ||
      parsedProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.clockAccess !== "caller-trusted-verification-time-only" ||
      parsedProfile.environmentAccess !== "forbidden" ||
      parsedProfile.selectionPolicy !== "all-active-members-no-subset-selection" ||
      parsedProfile.projectionAuthority !==
        "sole-generated-rust-campaign-evidence-abi" ||
      parsedProfile.storedProjectionAuthority !==
        "immutable-history-not-current-truth" ||
      parsedProfile.snapshotProtocol?.observations !== 2 ||
      !sameStrings(parsedProfile.operationRecord?.startFields, startFields) ||
      !sameStrings(parsedProfile.operationRecord?.terminalFields, terminalFields) ||
      !sameStrings(parsedProfile.operationRecord?.snapshotFields, snapshotFields) ||
      !sameStrings(parsedProfile.operationRecord?.snapshotMemberFields,
        snapshotMemberFields) ||
      !sameStrings(parsedProfile.operationLock?.claimFields, lockClaimFields) ||
      !sameStrings(parsedProfile.operationLock?.releaseFields, lockReleaseFields) ||
      parsedProfile.layout?.mutablePointerPolicy !== "forbidden" ||
      parsedProfile.atomicCreate?.publishPrimitive !== "hard-link-create-if-absent" ||
      parsedProfile.operationLock?.primitive !== "append-only-generation-claims" ||
      parsedProfile.operationLock?.claimSchema !==
        "tinyrustlm.vnext.campaign_runner_lock_claim.v1" ||
      parsedProfile.operationLock?.releaseSchema !==
        "tinyrustlm.vnext.campaign_runner_lock_release.v1" ||
      parsedProfile.operationLock?.deletionPolicy !== "never" ||
      parsedProfile.interruption?.startWithoutTerminalClassification !== "interrupted" ||
      parsedProfile.resultContract?.callerSuppliedVerdictAccepted !== false ||
      parsedProfile.resultContract?.bestOfN !== false ||
      !limitsValid ||
      limits.maximumReceiptInputs > receiptStoreProfile.limits.maximumActiveReceipts ||
      limits.maximumSubjectInputs > subjectStoreProfile.limits.maximumActiveSubjects ||
      limits.maximumTotalSubjectBytes > subjectStoreProfile.limits.maximumTotalSubjectBytes ||
      limits.maximumWasmModuleBytes > campaignEvidenceAdapter.limits.maximumModuleBytes ||
      limits.maximumReceiptInputs > campaignEvidenceAdapter.limits.maximumReceiptInputs ||
      limits.maximumSubjectInputs > campaignEvidenceAdapter.limits.maximumSubjectInputs) {
    profileFailure();
  }
}

validateInstalledProfile();

const campaignRunnerProfile = immutableRecord({ ...parsedProfile });
const campaignRunnerProfileSha256 = sha256(profileBytes);
const operationParserLimits = Object.freeze({
  maximumBytes: parsedProfile.limits.maximumOperationRecordBytes,
  maximumDepth: 16,
  maximumTotalEntries: 32768,
  maximumObjectMembers: 64,
  maximumArrayItems: 4096,
  maximumStringCodeUnits: 262144,
  maximumTotalStringCodeUnits: 1048576,
  maximumNumberCharacters: 32
});
const operationJcsLimits = Object.freeze({
  maximumDepth: 16,
  maximumTotalEntries: 32768,
  maximumObjectMembers: 64,
  maximumArrayItems: 4096,
  maximumStringCodeUnits: 262144,
  maximumTotalStringCodeUnits: 1048576
});

function normalizeBytes(input, maximum, code, step) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    failEvidence(code, step);
  }
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length <= 0 || bytes.length > maximum) failEvidence(code, step);
  return Buffer.from(bytes);
}

function normalizeDigest(value, code, step) {
  if (typeof value !== "string" || !digestPattern.test(value)) failEvidence(code, step);
  return value;
}

function normalizeContentId(value, code, step) {
  if (typeof value !== "string" || !contentIdPattern.test(value)) failEvidence(code, step);
  return value;
}

function operationRecordIdentity(recordWithoutId) {
  const canonical = canonicalizeVnextJcsBytes(recordWithoutId, operationJcsLimits);
  return `sha256:${crypto.createHash("sha256")
    .update(Buffer.from(parsedProfile.operationRecordIdentityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonical)
    .digest("hex")}`;
}

function snapshotIdentity(kind, profileId, profileSha256, members) {
  const canonical = canonicalizeVnextJcsBytes(members, operationJcsLimits);
  return sha256(Buffer.concat([
    Buffer.from(parsedProfile.snapshotIdentityDomain, "utf8"),
    Buffer.from([0]),
    Buffer.from(kind, "utf8"),
    Buffer.from([0]),
    Buffer.from(profileId, "utf8"),
    Buffer.from([0]),
    Buffer.from(profileSha256, "utf8"),
    Buffer.from([0]),
    canonical
  ]));
}

function validateSnapshot(value, kind, expectedProfileId, expectedProfileSha256) {
  const snapshot = exactObject(
    value,
    snapshotFields,
    "campaign_runner_snapshot_fields_invalid",
    "campaign-runner-operation"
  );
  if (snapshot.profileId !== expectedProfileId ||
      snapshot.profileSha256 !== expectedProfileSha256 ||
      !digestPattern.test(String(snapshot.snapshotSha256 || "")) ||
      !Number.isSafeInteger(snapshot.memberCount) || snapshot.memberCount < 0 ||
      !Number.isSafeInteger(snapshot.aggregateBytes) || snapshot.aggregateBytes < 0) {
    failEvidence("campaign_runner_snapshot_invalid", "campaign-runner-operation");
  }
  const maximum = kind === "receipt"
    ? parsedProfile.limits.maximumReceiptInputs
    : parsedProfile.limits.maximumSubjectInputs;
  const members = exactArray(
    snapshot.members,
    maximum,
    "campaign_runner_snapshot_members_invalid",
    "campaign-runner-operation"
  );
  const normalizedMembers = [];
  let previous = null;
  let aggregateBytes = 0;
  for (const valueMember of members) {
    const member = exactObject(
      valueMember,
      snapshotMemberFields,
      "campaign_runner_snapshot_member_invalid",
      "campaign-runner-operation"
    );
    normalizeContentId(member.id, "campaign_runner_snapshot_member_invalid",
      "campaign-runner-operation");
    normalizeDigest(member.wireSha256, "campaign_runner_snapshot_member_invalid",
      "campaign-runner-operation");
    if (!Number.isSafeInteger(member.byteLength) || member.byteLength <= 0) {
      failEvidence("campaign_runner_snapshot_member_invalid",
        "campaign-runner-operation");
    }
    if (previous !== null && previous >= member.id) {
      failEvidence("campaign_runner_snapshot_member_order_invalid",
        "campaign-runner-operation");
    }
    previous = member.id;
    aggregateBytes += member.byteLength;
    if (!Number.isSafeInteger(aggregateBytes)) {
      failEvidence("campaign_runner_snapshot_aggregate_invalid",
        "campaign-runner-operation");
    }
    normalizedMembers.push({
      byteLength: member.byteLength,
      id: member.id,
      wireSha256: member.wireSha256
    });
  }
  if (snapshot.memberCount !== normalizedMembers.length ||
      snapshot.aggregateBytes !== aggregateBytes ||
      snapshot.snapshotSha256 !== snapshotIdentity(
        kind,
        expectedProfileId,
        expectedProfileSha256,
        normalizedMembers
      )) {
    failEvidence("campaign_runner_snapshot_identity_invalid", "campaign-runner-operation");
  }
  return immutableRecord({
    aggregateBytes: snapshot.aggregateBytes,
    memberCount: snapshot.memberCount,
    members: normalizedMembers,
    profileId: snapshot.profileId,
    profileSha256: snapshot.profileSha256,
    snapshotSha256: snapshot.snapshotSha256
  });
}

function validateCampaignRunnerOperationBytes(input) {
  const bytes = normalizeBytes(
    input,
    parsedProfile.limits.maximumOperationRecordBytes,
    "campaign_runner_operation_byte_limit",
    "campaign-runner-operation"
  );
  let record;
  try {
    record = parseStrictJson(bytes, operationParserLimits);
  } catch (error) {
    throw new VnextEvidenceError(
      "campaign_runner_operation_invalid",
      "campaign-runner-operation",
      error?.code
    );
  }
  if (!isPlainObject(record) || record.schema !== parsedProfile.operationRecordSchema ||
      !contentIdPattern.test(String(record.recordId || ""))) {
    failEvidence("campaign_runner_operation_invalid", "campaign-runner-operation");
  }
  let normalized;
  if (record.state === parsedProfile.operationRecord.startState) {
    const start = exactObject(
      record,
      startFields,
      "campaign_runner_operation_start_fields_invalid",
      "campaign-runner-operation"
    );
    normalizeContentId(start.operationId, "campaign_runner_operation_id_invalid",
      "campaign-runner-operation");
    normalizeDigest(start.campaignPlanSha256, "campaign_runner_operation_start_invalid",
      "campaign-runner-operation");
    normalizeDigest(start.wasmModuleSha256, "campaign_runner_operation_start_invalid",
      "campaign-runner-operation");
    normalizeContentId(start.campaignPlanId, "campaign_runner_operation_start_invalid",
      "campaign-runner-operation");
    for (const value of [
      start.expectedCampaignId,
      start.expectedEnvironment,
      start.planCampaignId,
      start.planEnvironment
    ]) {
      if (typeof value !== "string" || !safeIdPattern.test(value)) {
        failEvidence("campaign_runner_operation_start_invalid",
          "campaign-runner-operation");
      }
    }
    if (utcNanoseconds(start.verificationTimeUtc) === null ||
        start.campaignArtifactStoreProfileId !==
          parsedProfile.campaignArtifactStoreProfileId ||
        start.campaignEvidenceProfileId !== parsedProfile.campaignEvidenceProfileId) {
      failEvidence("campaign_runner_operation_start_invalid", "campaign-runner-operation");
    }
    const rootNull = start.trustedRootRegistryReceiptId === null;
    const terminalNull = start.expectedTerminalRegistryReceiptId === null;
    if (rootNull !== terminalNull || (!rootNull &&
        (!contentIdPattern.test(start.trustedRootRegistryReceiptId) ||
         !contentIdPattern.test(start.expectedTerminalRegistryReceiptId)))) {
      failEvidence("campaign_runner_operation_start_invalid", "campaign-runner-operation");
    }
    normalized = {
      ...start,
      receiptSnapshot: validateSnapshot(
        start.receiptSnapshot,
        "receipt",
        parsedProfile.receiptStoreProfileId,
        parsedProfile.receiptStoreProfileSha256
      ),
      subjectSnapshot: validateSnapshot(
        start.subjectSnapshot,
        "subject",
        parsedProfile.subjectStoreProfileId,
        parsedProfile.subjectStoreProfileSha256
      )
    };
  } else if (record.state === parsedProfile.operationRecord.terminalState) {
    const terminal = exactObject(
      record,
      terminalFields,
      "campaign_runner_operation_terminal_fields_invalid",
      "campaign-runner-operation"
    );
    normalizeContentId(terminal.operationId, "campaign_runner_operation_id_invalid",
      "campaign-runner-operation");
    normalizeContentId(terminal.startedRecordId,
      "campaign_runner_operation_terminal_invalid", "campaign-runner-operation");
    if (!parsedProfile.operationRecord.terminalOutcomes.includes(terminal.outcome)) {
      failEvidence("campaign_runner_operation_terminal_invalid",
        "campaign-runner-operation");
    }
    if (terminal.outcome === "completed") {
      normalizeDigest(terminal.projectionResultSha256,
        "campaign_runner_operation_terminal_invalid", "campaign-runner-operation");
      if (terminal.errorCode !== null || terminal.errorStep !== null) {
        failEvidence("campaign_runner_operation_terminal_invalid",
          "campaign-runner-operation");
      }
    } else if (terminal.projectionResultSha256 !== null ||
        !errorCodePattern.test(String(terminal.errorCode || "")) ||
        !errorStepPattern.test(String(terminal.errorStep || ""))) {
      failEvidence("campaign_runner_operation_terminal_invalid",
        "campaign-runner-operation");
    }
    normalized = terminal;
  } else {
    failEvidence("campaign_runner_operation_state_invalid", "campaign-runner-operation");
  }
  const withoutId = { ...normalized };
  delete withoutId.recordId;
  const expectedId = operationRecordIdentity(withoutId);
  const canonical = canonicalizeVnextJcsBytes({ ...withoutId, recordId: expectedId },
    operationJcsLimits);
  if (expectedId !== normalized.recordId || !canonical.equals(bytes)) {
    failEvidence("campaign_runner_operation_noncanonical", "campaign-runner-operation");
  }
  const frozen = immutableRecord({ ...normalized, recordId: expectedId });
  const result = { record: frozen };
  Object.defineProperty(result, "bytes", {
    enumerable: true,
    get() {
      return Buffer.from(canonical);
    }
  });
  return Object.freeze(result);
}

function finalizeOperationRecord(value) {
  const withoutId = { ...value };
  const recordId = operationRecordIdentity(withoutId);
  return validateCampaignRunnerOperationBytes(canonicalizeVnextJcsBytes(
    { ...withoutId, recordId },
    operationJcsLimits
  ));
}

function operationRecordRelativePath(recordId) {
  const digest = normalizeContentId(
    recordId,
    "campaign_runner_operation_id_invalid",
    "campaign-runner-operation-path"
  ).slice("sha256:".length);
  return `operations/sha256/${digest.slice(0, 2)}/${digest}.json`;
}

function createOperationStore(rootInput, options) {
  const { io, platform, randomBytes } = options;
  const fileOps = createVnextCreateOnlyFiles({
    codePrefix: "campaign_runner_operation",
    io,
    platform,
    randomBytes,
    steps: {
      open: "campaign-runner-store-open",
      path: "campaign-runner-operation-path",
      persist: "campaign-runner-operation-persist",
      quarantine: "campaign-runner-operation-quarantine",
      read: "campaign-runner-operation-read",
      scan: "campaign-runner-operation-scan"
    },
    streamBufferBytes: parsedProfile.limits.streamBufferBytes
  });
  const root = fileOps.normalizeRoot(rootInput);
  function ensureLayout() {
    fileOps.ensureRoot(root);
    const operations = fileOps.safeChild(root, ["operations"]);
    const shaRoot = fileOps.safeChild(root, ["operations", "sha256"]);
    const locks = fileOps.safeChild(root, ["locks"]);
    const lockClaims = fileOps.safeChild(root, ["locks", "claims"]);
    const lockReleases = fileOps.safeChild(root, ["locks", "releases"]);
    const quarantine = fileOps.safeChild(root, ["quarantine"]);
    fileOps.ensureDirectory(operations);
    fileOps.ensureDirectory(shaRoot);
    fileOps.ensureDirectory(locks);
    fileOps.ensureDirectory(lockClaims);
    fileOps.ensureDirectory(lockReleases);
    fileOps.ensureDirectory(quarantine);
    return Object.freeze({ lockClaims, lockReleases, locks, operations, quarantine,
      shaRoot });
  }
  const layout = ensureLayout();
  let activeRecords = new Map();
  let operationsById = new Map();
  let activeTotalBytes = 0;

  function scanUnknown(directory, allowed, quarantines, scan, quarantine) {
    for (const entry of scan(directory, parsedProfile.limits.maximumDirectoryEntries)) {
      if (!allowed.has(entry.name)) {
        const result = quarantine(path.join(directory, entry.name), "unknown_entry");
        if (result !== null) quarantines.push(result);
      }
    }
  }

  function classify(records) {
    const groups = new Map();
    for (const metadata of records.values()) {
      const operationId = metadata.record.operationId;
      if (!groups.has(operationId)) groups.set(operationId, { starts: [], terminals: [] });
      const group = groups.get(operationId);
      if (metadata.record.state === "started") group.starts.push(metadata);
      else group.terminals.push(metadata);
    }
    const invalid = new Map();
    const states = new Map();
    for (const [operationId, group] of groups) {
      if (group.starts.length !== 1 || group.terminals.length > 1) {
        for (const metadata of [...group.starts, ...group.terminals]) {
          invalid.set(metadata.record.recordId, "operation_conflict");
        }
        continue;
      }
      const started = group.starts[0];
      const terminal = group.terminals[0] || null;
      if (terminal !== null && terminal.record.startedRecordId !== started.record.recordId) {
        invalid.set(terminal.record.recordId, "terminal_start_mismatch");
        invalid.set(started.record.recordId, "operation_conflict");
        continue;
      }
      states.set(operationId, Object.freeze({ started, terminal }));
    }
    for (const group of groups.values()) {
      if (group.starts.length === 0) {
        for (const terminal of group.terminals) {
          invalid.set(terminal.record.recordId, "missing_start");
        }
      }
    }
    return { invalid, states };
  }

  function rebuild() {
    ensureLayout();
    let totalScanEntries = 0;
    const scan = (directory, maximum) => {
      const entries = fileOps.boundedDirectoryEntries(directory, maximum);
      totalScanEntries += entries.length;
      if (!Number.isSafeInteger(totalScanEntries) ||
          totalScanEntries > parsedProfile.limits.maximumScanEntries) {
        failEvidence("campaign_runner_operation_store_total_scan_limit",
          "campaign-runner-operation-scan");
      }
      return entries;
    };
    const existingQuarantineEntries = scan(
      layout.quarantine,
      parsedProfile.limits.maximumQuarantineEntries
    ).length;
    let quarantineCount = existingQuarantineEntries;
    const newQuarantines = [];
    const quarantine = (source, reasonCode, recordId = null) => {
      if (quarantineCount >= parsedProfile.limits.maximumQuarantineEntries) {
        failEvidence("campaign_runner_operation_store_quarantine_limit",
          "campaign-runner-operation-quarantine");
      }
      const result = fileOps.quarantineEntry(
        root,
        layout.quarantine,
        source,
        reasonCode,
        "recordId",
        recordId
      );
      if (result !== null) quarantineCount += 1;
      return result;
    };
    scanUnknown(root, new Set(["locks", "operations", "quarantine"]),
      newQuarantines, scan, quarantine);
    scanUnknown(layout.operations, new Set(["sha256"]), newQuarantines, scan, quarantine);
    scanUnknown(layout.locks, new Set(["claims", "releases"]), newQuarantines,
      scan, quarantine);
    const candidates = new Map();
    let pendingTemporaryCount = 0;
    let rebuiltTotalBytes = 0;
    for (const prefixEntry of scan(
      layout.shaRoot,
      parsedProfile.limits.maximumDirectoryEntries
    )) {
      const prefixPath = path.join(layout.shaRoot, prefixEntry.name);
      if (!prefixPattern.test(prefixEntry.name) || !prefixEntry.isDirectory() ||
          prefixEntry.isSymbolicLink()) {
        const result = quarantine(prefixPath, "unknown_entry");
        if (result !== null) newQuarantines.push(result);
        continue;
      }
      for (const entry of scan(prefixPath, parsedProfile.limits.maximumDirectoryEntries)) {
        const filePath = path.join(prefixPath, entry.name);
        const temporary = temporaryPattern.exec(entry.name);
        if (temporary) {
          const target = path.join(prefixPath, `${temporary[1]}.json`);
          const state = fileOps.inspectIncompleteTemporary(
            filePath,
            target,
            parsedProfile.rebuild.minimumIncompleteTemporaryAgeMs
          );
          if (state === "missing") continue;
          if (state === "pending") {
            pendingTemporaryCount += 1;
          } else {
            const result = quarantine(
              filePath,
              state === "invalid" ? "unknown_entry" : "incomplete_temporary"
            );
            if (result !== null) newQuarantines.push(result);
          }
          continue;
        }
        const digestMatch = digestFilePattern.exec(entry.name);
        if (!digestMatch || !entry.isFile() || entry.isSymbolicLink()) {
          const result = quarantine(filePath, "unknown_entry");
          if (result !== null) newQuarantines.push(result);
          continue;
        }
        let validated;
        try {
          validated = validateCampaignRunnerOperationBytes(fileOps.boundedReadFile(
            filePath,
            parsedProfile.limits.maximumOperationRecordBytes
          ));
        } catch (_error) {
          const result = quarantine(filePath, "invalid_operation_record");
          if (result !== null) newQuarantines.push(result);
          continue;
        }
        const recordId = validated.record.recordId;
        const expectedDigest = recordId.slice("sha256:".length);
        if (expectedDigest !== digestMatch[1] || expectedDigest.slice(0, 2) !== prefixEntry.name) {
          const result = quarantine(filePath, "path_identity_mismatch", recordId);
          if (result !== null) newQuarantines.push(result);
          continue;
        }
        if (candidates.has(recordId)) {
          const result = quarantine(filePath, "duplicate_record", recordId);
          if (result !== null) newQuarantines.push(result);
          continue;
        }
        const byteLength = validated.bytes.length;
        candidates.set(recordId, Object.freeze({
          byteLength,
          record: validated.record,
          relativePath: operationRecordRelativePath(recordId)
        }));
        rebuiltTotalBytes += byteLength;
        if (candidates.size > parsedProfile.limits.maximumActiveOperationRecords) {
          failEvidence("campaign_runner_operation_store_active_limit",
            "campaign-runner-operation-scan");
        }
        if (!Number.isSafeInteger(rebuiltTotalBytes) ||
            rebuiltTotalBytes > parsedProfile.limits.maximumActiveOperationBytes) {
          failEvidence("campaign_runner_operation_store_byte_limit",
            "campaign-runner-operation-scan");
        }
      }
    }
    const classified = classify(candidates);
    for (const [recordId, reasonCode] of classified.invalid) {
      const candidate = candidates.get(recordId);
      if (!candidate) continue;
      const source = path.join(root, ...candidate.relativePath.split("/"));
      const result = quarantine(source, reasonCode, recordId);
      if (result !== null) newQuarantines.push(result);
      rebuiltTotalBytes -= candidate.byteLength;
      candidates.delete(recordId);
    }
    activeRecords = candidates;
    operationsById = classify(candidates).states;
    activeTotalBytes = rebuiltTotalBytes;
    return immutableRecord({
      activeRecordIds: [...activeRecords.keys()].sort(),
      activeTotalBytes,
      directoryMetadata: fileOps.syncDirectory(layout.shaRoot),
      existingQuarantineEntries,
      newQuarantines,
      operationCount: operationsById.size,
      pendingTemporaryCount,
      scannedEntryCount: totalScanEntries
    });
  }

  const startup = rebuild();

  function read(recordIdInput) {
    const recordId = normalizeContentId(
      recordIdInput,
      "campaign_runner_operation_id_invalid",
      "campaign-runner-operation-read"
    );
    const metadata = activeRecords.get(recordId);
    if (!metadata) failEvidence("campaign_runner_operation_not_active",
      "campaign-runner-operation-read");
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    let validated;
    try {
      validated = validateCampaignRunnerOperationBytes(fileOps.boundedReadFile(
        filePath,
        parsedProfile.limits.maximumOperationRecordBytes
      ));
    } catch (error) {
      throw new VnextEvidenceError(
        "campaign_runner_operation_active_read_failed",
        "campaign-runner-operation-read",
        error?.code
      );
    }
    if (validated.record.recordId !== recordId ||
        validated.bytes.length !== metadata.byteLength) {
      failEvidence("campaign_runner_operation_active_identity_changed",
        "campaign-runner-operation-read");
    }
    return validated;
  }

  function inspect(operationIdInput) {
    const operationId = normalizeContentId(
      operationIdInput,
      "campaign_runner_operation_id_invalid",
      "campaign-runner-operation-inspect"
    );
    const state = operationsById.get(operationId);
    if (!state) failEvidence("campaign_runner_operation_not_found",
      "campaign-runner-operation-inspect");
    const terminal = state.terminal?.record || null;
    return immutableRecord({
      errorCode: terminal?.errorCode ?? null,
      errorStep: terminal?.errorStep ?? null,
      operationId,
      projectionResultSha256: terminal?.projectionResultSha256 ?? null,
      startedRecordId: state.started.record.recordId,
      state: terminal === null ? "interrupted" : terminal.outcome,
      terminalRecordId: terminal?.recordId ?? null
    });
  }

  function put(validatedInput) {
    const validated = validateCampaignRunnerOperationBytes(validatedInput.bytes);
    const record = validated.record;
    const current = operationsById.get(record.operationId);
    if (record.state === "started") {
      if (current && current.started.record.recordId !== record.recordId) {
        failEvidence("campaign_runner_operation_id_conflict",
          "campaign-runner-operation-persist");
      }
      if (current?.terminal) {
        failEvidence("campaign_runner_operation_already_terminal",
          "campaign-runner-operation-persist");
      }
    } else {
      if (!current || current.started.record.recordId !== record.startedRecordId) {
        failEvidence("campaign_runner_operation_start_missing",
          "campaign-runner-operation-persist");
      }
      if (current.terminal && current.terminal.record.recordId !== record.recordId) {
        failEvidence("campaign_runner_operation_terminal_conflict",
          "campaign-runner-operation-persist");
      }
    }
    const existing = activeRecords.get(record.recordId);
    if (!existing && activeRecords.size >=
        parsedProfile.limits.maximumActiveOperationRecords) {
      failEvidence("campaign_runner_operation_store_active_limit",
        "campaign-runner-operation-persist");
    }
    if (!existing && activeTotalBytes + validated.bytes.length >
        parsedProfile.limits.maximumActiveOperationBytes) {
      failEvidence("campaign_runner_operation_store_byte_limit",
        "campaign-runner-operation-persist");
    }
    const relativePath = operationRecordRelativePath(record.recordId);
    const target = path.join(root, ...relativePath.split("/"));
    const persistence = fileOps.publishBytes(
      target,
      validated.bytes,
      parsedProfile.limits.maximumOperationRecordBytes
    );
    const rebuilt = rebuild();
    if (!activeRecords.has(record.recordId)) {
      failEvidence("campaign_runner_operation_publish_not_active",
        "campaign-runner-operation-persist");
    }
    return immutableRecord({
      disposition: persistence.disposition,
      durability: persistence.durability,
      recordId: record.recordId,
      relativePath,
      rebuiltActiveRecordCount: rebuilt.activeRecordIds.length
    });
  }

  return Object.freeze({
    fileOps,
    inspect,
    layout,
    put,
    read,
    rebuild,
    root,
    startup
  });
}

function exactOptions(options) {
  if (!isPlainObject(options)) {
    failEvidence("campaign_runner_options_invalid", "campaign-runner-open");
  }
  if (Object.getOwnPropertySymbols(options).length !== 0) {
    failEvidence("campaign_runner_option_unknown", "campaign-runner-open");
  }
  const names = Object.getOwnPropertyNames(options);
  if (names.some((name) => !optionNames.includes(name)) ||
      requiredOptionNames.some((name) => !names.includes(name))) {
    failEvidence("campaign_runner_option_unknown", "campaign-runner-open");
  }
  const values = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (!descriptor || !descriptor.enumerable) {
      failEvidence("campaign_runner_option_unknown", "campaign-runner-open");
    }
    if (!("value" in descriptor)) {
      failEvidence("campaign_runner_option_accessor", "campaign-runner-open");
    }
    values[name] = descriptor.value;
  }
  return values;
}

function normalizeAbsoluteRoot(value, code) {
  if (typeof value !== "string" || value.length < 3 || value.length > 1024 ||
      value.includes("\0") || !path.isAbsolute(value) ||
      path.resolve(value) !== path.normalize(value)) {
    failEvidence(code, "campaign-runner-open");
  }
  return path.resolve(value);
}

function rootsOverlap(left, right, platform) {
  const normalizeCase = (value) => platform === "win32" ? value.toLowerCase() : value;
  const a = normalizeCase(left);
  const b = normalizeCase(right);
  if (a === b) return true;
  const isDescendant = (parent, candidate) => {
    const relative = path.relative(parent, candidate);
    return relative !== "" && relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  return isDescendant(a, b) || isDescendant(b, a);
}

function defaultProcessAlive(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function exactRunInput(value) {
  const input = exactObject(
    value,
    runInputFields,
    "campaign_runner_input_invalid",
    "campaign-runner-input"
  );
  normalizeContentId(input.operationId, "campaign_runner_operation_id_invalid",
    "campaign-runner-input");
  normalizeDigest(input.campaignPlanSha256, "campaign_runner_plan_identity_invalid",
    "campaign-runner-input");
  if (typeof input.expectedCampaignId !== "string" ||
      !safeIdPattern.test(input.expectedCampaignId) ||
      typeof input.expectedEnvironment !== "string" ||
      !safeIdPattern.test(input.expectedEnvironment) ||
      utcNanoseconds(input.verificationTimeUtc) === null) {
    failEvidence("campaign_runner_input_invalid", "campaign-runner-input");
  }
  const rootNull = input.trustedRootRegistryReceiptId === null;
  const terminalNull = input.expectedTerminalRegistryReceiptId === null;
  if (rootNull !== terminalNull || (!rootNull &&
      (!contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
       !contentIdPattern.test(input.expectedTerminalRegistryReceiptId)))) {
    failEvidence("campaign_runner_input_invalid", "campaign-runner-input");
  }
  return Object.freeze({ ...input });
}

function snapshotPublic(kind, profileId, profileSha256, members, aggregateBytes) {
  const snapshot = {
    aggregateBytes,
    memberCount: members.length,
    members: members.map((member) => ({
      byteLength: member.byteLength,
      id: member.id,
      wireSha256: member.wireSha256
    })),
    profileId,
    profileSha256,
    snapshotSha256: snapshotIdentity(kind, profileId, profileSha256, members.map((member) => ({
      byteLength: member.byteLength,
      id: member.id,
      wireSha256: member.wireSha256
    })))
  };
  return validateSnapshot(snapshot, kind, profileId, profileSha256);
}

function snapshotsEqual(left, right) {
  if (left.public.snapshotSha256 !== right.public.snapshotSha256 ||
      left.public.aggregateBytes !== right.public.aggregateBytes ||
      left.public.memberCount !== right.public.memberCount ||
      left.members.length !== right.members.length) return false;
  return left.members.every((member, index) => {
    const other = right.members[index];
    return member.id === other.id && member.wireSha256 === other.wireSha256 &&
      member.bytes.equals(other.bytes);
  });
}

async function createVnextCampaignRunner(rootInput, optionsInput) {
  const options = exactOptions(optionsInput);
  const io = Object.hasOwn(options, "io") ? options.io : fs;
  const platform = Object.hasOwn(options, "platform") ? options.platform : process.platform;
  const randomBytes = Object.hasOwn(options, "randomBytes")
    ? options.randomBytes
    : crypto.randomBytes;
  const processAlive = Object.hasOwn(options, "processAlive")
    ? options.processAlive
    : defaultProcessAlive;
  if ((typeof io !== "object" && typeof io !== "function") || io === null ||
      typeof platform !== "string" || platform.length === 0 ||
      typeof randomBytes !== "function" || typeof processAlive !== "function") {
    failEvidence("campaign_runner_options_invalid", "campaign-runner-open");
  }
  const root = normalizeAbsoluteRoot(rootInput, "campaign_runner_root_invalid");
  const roots = [
    root,
    normalizeAbsoluteRoot(options.campaignArtifactStoreRoot,
      "campaign_runner_artifact_root_invalid"),
    normalizeAbsoluteRoot(options.receiptStoreRoot, "campaign_runner_receipt_root_invalid"),
    normalizeAbsoluteRoot(options.subjectStoreRoot, "campaign_runner_subject_root_invalid")
  ];
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      if (rootsOverlap(roots[left], roots[right], platform)) {
        failEvidence("campaign_runner_store_roots_overlap", "campaign-runner-open");
      }
    }
  }
  const expectedWasmModuleSha256 = normalizeDigest(
    options.expectedWasmModuleSha256,
    "campaign_runner_wasm_identity_invalid",
    "campaign-runner-open"
  );
  const wasmModuleBytes = normalizeBytes(
    options.wasmModuleBytes,
    parsedProfile.limits.maximumWasmModuleBytes,
    "campaign_runner_wasm_byte_limit",
    "campaign-runner-open"
  );
  const wasmModuleSha256 = sha256(wasmModuleBytes);
  if (wasmModuleSha256 !== expectedWasmModuleSha256) {
    failEvidence("campaign_runner_wasm_identity_mismatch", "campaign-runner-open");
  }
  const verifier = await campaignEvidenceAdapter.instantiateCampaignEvidence(wasmModuleBytes);
  const storeOptions = { io, platform, randomBytes };
  const artifactStore = createVnextCampaignArtifactStore(roots[1], storeOptions);
  const receiptStore = createVnextReceiptStore(roots[2], storeOptions);
  const subjectStore = createVnextSubjectStore(roots[3], storeOptions);
  const operationStore = createOperationStore(root, storeOptions);
  const lockFileOps = createVnextCreateOnlyFiles({
    codePrefix: "campaign_runner_lock",
    io,
    platform,
    randomBytes,
    steps: {
      open: "campaign-runner-lock",
      path: "campaign-runner-lock",
      persist: "campaign-runner-lock",
      quarantine: "campaign-runner-lock",
      read: "campaign-runner-lock",
      scan: "campaign-runner-lock"
    },
    streamBufferBytes: parsedProfile.limits.streamBufferBytes
  });

  function lockGenerationFileName(generation) {
    if (!Number.isSafeInteger(generation) || generation < 0 ||
        generation >= parsedProfile.limits.maximumLockGenerations) {
      failEvidence("campaign_runner_lock_generation_limit", "campaign-runner-lock");
    }
    return `${generation.toString(16).padStart(16, "0")}.json`;
  }

  function parseLockRecord(bytesInput, fields, schema, kind) {
    const bytes = normalizeBytes(
      bytesInput,
      parsedProfile.limits.maximumLockBytes,
      "campaign_runner_lock_invalid",
      "campaign-runner-lock"
    );
    let value;
    try {
      value = parseStrictJson(bytes, {
        ...operationParserLimits,
        maximumBytes: parsedProfile.limits.maximumLockBytes
      });
    } catch (_error) {
      failEvidence("campaign_runner_lock_invalid", "campaign-runner-lock");
    }
    const record = exactObject(value, fields,
      "campaign_runner_lock_invalid", "campaign-runner-lock");
    const canonical = canonicalizeVnextJcsBytes(record, operationJcsLimits);
    if (!canonical.equals(bytes) || record.schema !== schema ||
        !Number.isSafeInteger(record.generation) || record.generation < 0 ||
        record.generation >= parsedProfile.limits.maximumLockGenerations ||
        !Number.isSafeInteger(record.processId) || record.processId <= 0 ||
        !lockNoncePattern.test(String(record.nonce || ""))) {
      failEvidence("campaign_runner_lock_invalid", "campaign-runner-lock");
    }
    if (kind === "claim") {
      const predecessorValid = record.generation === 0
        ? record.predecessorClaimSha256 === null && record.reason === "initial"
        : digestPattern.test(String(record.predecessorClaimSha256 || "")) &&
          record.reason === "predecessor_inactive";
      if (!predecessorValid) {
        failEvidence("campaign_runner_lock_invalid", "campaign-runner-lock");
      }
    } else if (!digestPattern.test(String(record.claimSha256 || ""))) {
      failEvidence("campaign_runner_lock_invalid", "campaign-runner-lock");
    }
    return Object.freeze({ bytes, record: Object.freeze(record), sha256: sha256(bytes) });
  }

  function validateLockClaim(bytes) {
    return parseLockRecord(bytes, lockClaimFields,
      parsedProfile.operationLock.claimSchema, "claim");
  }

  function validateLockRelease(bytes) {
    return parseLockRecord(bytes, lockReleaseFields,
      parsedProfile.operationLock.releaseSchema, "release");
  }

  function scanLockDirectory(directory, kind) {
    const records = new Map();
    let pendingTemporaryCount = 0;
    const entries = lockFileOps.boundedDirectoryEntries(
      directory,
      parsedProfile.limits.maximumDirectoryEntries
    );
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      const temporary = lockTemporaryPattern.exec(entry.name);
      if (temporary) {
        const target = path.join(directory, `${temporary[1]}.json`);
        const state = lockFileOps.inspectIncompleteTemporary(
          filePath,
          target,
          parsedProfile.rebuild.minimumIncompleteTemporaryAgeMs
        );
        if (state === "pending") {
          pendingTemporaryCount += 1;
        } else if (state !== "missing") {
          const result = lockFileOps.quarantineEntry(
            root,
            operationStore.layout.quarantine,
            filePath,
            state === "invalid" ? "invalid_lock_temporary" : "incomplete_lock_temporary"
          );
          if (result !== null) pendingTemporaryCount = Math.max(0,
            pendingTemporaryCount - 1);
        }
        continue;
      }
      const match = lockGenerationFilePattern.exec(entry.name);
      if (!match || !entry.isFile() || entry.isSymbolicLink()) {
        failEvidence("campaign_runner_lock_history_invalid", "campaign-runner-lock");
      }
      const validated = kind === "claim"
        ? validateLockClaim(lockFileOps.boundedReadFile(
          filePath, parsedProfile.limits.maximumLockBytes))
        : validateLockRelease(lockFileOps.boundedReadFile(
          filePath, parsedProfile.limits.maximumLockBytes));
      const generation = Number.parseInt(match[1], 16);
      if (!Number.isSafeInteger(generation) || generation !== validated.record.generation ||
          records.has(generation)) {
        failEvidence("campaign_runner_lock_history_invalid", "campaign-runner-lock");
      }
      records.set(generation, validated);
      if (records.size > parsedProfile.limits.maximumLockGenerations) {
        failEvidence("campaign_runner_lock_generation_limit", "campaign-runner-lock");
      }
    }
    return Object.freeze({ pendingTemporaryCount, records });
  }

  function rebuildLockHistory() {
    const claimsResult = scanLockDirectory(operationStore.layout.lockClaims, "claim");
    const releasesResult = scanLockDirectory(operationStore.layout.lockReleases, "release");
    const claims = claimsResult.records;
    const releases = releasesResult.records;
    if (releases.size > claims.size) {
      failEvidence("campaign_runner_lock_history_invalid", "campaign-runner-lock");
    }
    let predecessor = null;
    for (let generation = 0; generation < claims.size; generation += 1) {
      const claim = claims.get(generation);
      if (!claim || (generation === 0
        ? claim.record.predecessorClaimSha256 !== null
        : claim.record.predecessorClaimSha256 !== predecessor.sha256)) {
        failEvidence("campaign_runner_lock_history_invalid", "campaign-runner-lock");
      }
      const release = releases.get(generation) || null;
      if (release !== null && (release.record.claimSha256 !== claim.sha256 ||
          release.record.processId !== claim.record.processId ||
          release.record.nonce !== claim.record.nonce)) {
        failEvidence("campaign_runner_lock_history_invalid", "campaign-runner-lock");
      }
      predecessor = claim;
    }
    for (const generation of releases.keys()) {
      if (!claims.has(generation)) {
        failEvidence("campaign_runner_lock_history_invalid", "campaign-runner-lock");
      }
    }
    const latestGeneration = claims.size - 1;
    return Object.freeze({
      claimCount: claims.size,
      claims,
      latestClaim: latestGeneration < 0 ? null : claims.get(latestGeneration),
      latestRelease: latestGeneration < 0 ? null : releases.get(latestGeneration) || null,
      pendingTemporaryCount:
        claimsResult.pendingTemporaryCount + releasesResult.pendingTemporaryCount,
      releaseCount: releases.size,
      releases
    });
  }

  function newLockNonce() {
    let nonce;
    try {
      nonce = randomBytes(12);
    } catch (error) {
      throw asEvidenceError(error, "campaign_runner_lock_random_failed",
        "campaign-runner-lock");
    }
    if (!Buffer.isBuffer(nonce) || nonce.length !== 12) {
      failEvidence("campaign_runner_lock_random_invalid", "campaign-runner-lock");
    }
    return nonce.toString("hex");
  }

  function acquireLock() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = rebuildLockHistory();
      if (state.latestClaim !== null && state.latestRelease === null) {
        let alive;
        try {
          alive = processAlive(state.latestClaim.record.processId);
        } catch (error) {
          throw asEvidenceError(error, "campaign_runner_lock_liveness_failed",
            "campaign-runner-lock");
        }
        if (alive !== false) {
          failEvidence("campaign_runner_busy", "campaign-runner-lock");
        }
      }
      const generation = state.claimCount;
      const record = {
        generation,
        nonce: newLockNonce(),
        predecessorClaimSha256: state.latestClaim?.sha256 ?? null,
        processId: process.pid,
        reason: generation === 0 ? "initial" : "predecessor_inactive",
        schema: parsedProfile.operationLock.claimSchema
      };
      const bytes = canonicalizeVnextJcsBytes(record, operationJcsLimits);
      const claim = validateLockClaim(bytes);
      const target = path.join(
        operationStore.layout.lockClaims,
        lockGenerationFileName(generation)
      );
      try {
        lockFileOps.publishBytes(target, bytes, parsedProfile.limits.maximumLockBytes);
      } catch (error) {
        if (error?.code === "campaign_runner_lock_target_conflict") continue;
        throw asEvidenceError(error, "campaign_runner_lock_create_failed",
          "campaign-runner-lock");
      }
      const verified = rebuildLockHistory();
      if (verified.latestClaim?.sha256 !== claim.sha256 ||
          verified.latestRelease !== null) {
        failEvidence("campaign_runner_lock_lost", "campaign-runner-lock");
      }
      return claim;
    }
    failEvidence("campaign_runner_busy", "campaign-runner-lock");
  }

  function releaseLock(owner) {
    const before = rebuildLockHistory();
    if (before.latestClaim?.sha256 !== owner.sha256 || before.latestRelease !== null) {
      failEvidence("campaign_runner_lock_lost", "campaign-runner-lock");
    }
    const record = {
      claimSha256: owner.sha256,
      generation: owner.record.generation,
      nonce: owner.record.nonce,
      processId: owner.record.processId,
      schema: parsedProfile.operationLock.releaseSchema
    };
    const bytes = canonicalizeVnextJcsBytes(record, operationJcsLimits);
    const release = validateLockRelease(bytes);
    const target = path.join(
      operationStore.layout.lockReleases,
      lockGenerationFileName(owner.record.generation)
    );
    try {
      lockFileOps.publishBytes(target, bytes, parsedProfile.limits.maximumLockBytes);
    } catch (error) {
      throw asEvidenceError(error, "campaign_runner_lock_release_failed",
        "campaign-runner-lock");
    }
    const after = rebuildLockHistory();
    if (after.releases.get(owner.record.generation)?.sha256 !== release.sha256) {
      failEvidence("campaign_runner_lock_release_failed", "campaign-runner-lock");
    }
  }

  const lockStartup = rebuildLockHistory();

  function observePlan(planSha256) {
    const rebuilt = artifactStore.rebuild();
    if (!rebuilt.activePlanSha256s.includes(planSha256)) {
      failEvidence("campaign_runner_plan_not_active", "campaign-runner-snapshot");
    }
    const plan = artifactStore.readPlan(planSha256);
    return Object.freeze({
      bytes: plan.bytes,
      campaignId: plan.plan.campaignId,
      environment: plan.plan.environment,
      planId: plan.plan.planId,
      planSha256: plan.planSha256,
      wireSha256: sha256(plan.bytes)
    });
  }

  function observeStore(kind) {
    const receipt = kind === "receipt";
    const store = receipt ? receiptStore : subjectStore;
    const rebuilt = store.rebuild();
    const ids = receipt ? rebuilt.activeReceiptIds : rebuilt.activeSubjectIds;
    const maximumCount = receipt
      ? parsedProfile.limits.maximumReceiptInputs
      : parsedProfile.limits.maximumSubjectInputs;
    const maximumTotal = receipt
      ? parsedProfile.limits.maximumTotalReceiptBytes
      : parsedProfile.limits.maximumTotalSubjectBytes;
    if (!Array.isArray(ids) || ids.length > maximumCount ||
        ids.some((id, index) => !contentIdPattern.test(id) ||
          (index > 0 && ids[index - 1] >= id))) {
      failEvidence(`campaign_runner_${kind}_snapshot_membership_invalid`,
        "campaign-runner-snapshot");
    }
    const members = [];
    let aggregateBytes = 0;
    for (const id of ids) {
      const validated = store.read(id);
      const bytes = validated.bytes;
      const maximumSingle = receipt
        ? parsedProfile.limits.maximumReceiptBytes
        : parsedProfile.limits.maximumSubjectBytes;
      if (bytes.length <= 0 || bytes.length > maximumSingle) {
        failEvidence(`campaign_runner_${kind}_snapshot_byte_limit`,
          "campaign-runner-snapshot");
      }
      aggregateBytes += bytes.length;
      if (!Number.isSafeInteger(aggregateBytes) || aggregateBytes > maximumTotal) {
        failEvidence(`campaign_runner_${kind}_snapshot_total_byte_limit`,
          "campaign-runner-snapshot");
      }
      members.push(Object.freeze({
        byteLength: bytes.length,
        id,
        wireSha256: sha256(bytes),
        bytes: Buffer.from(bytes)
      }));
    }
    const profileId = receipt
      ? parsedProfile.receiptStoreProfileId
      : parsedProfile.subjectStoreProfileId;
    const profileSha256 = receipt
      ? parsedProfile.receiptStoreProfileSha256
      : parsedProfile.subjectStoreProfileSha256;
    return Object.freeze({
      members: Object.freeze(members),
      public: snapshotPublic(kind, profileId, profileSha256, members, aggregateBytes)
    });
  }

  function stableInputs(planSha256) {
    const first = {
      plan: observePlan(planSha256),
      receipts: observeStore("receipt"),
      subjects: observeStore("subject")
    };
    const second = {
      plan: observePlan(planSha256),
      receipts: observeStore("receipt"),
      subjects: observeStore("subject")
    };
    if (first.plan.wireSha256 !== second.plan.wireSha256 ||
        first.plan.planId !== second.plan.planId ||
        !first.plan.bytes.equals(second.plan.bytes) ||
        !snapshotsEqual(first.receipts, second.receipts) ||
        !snapshotsEqual(first.subjects, second.subjects)) {
      failEvidence("campaign_runner_snapshot_changed", "campaign-runner-snapshot");
    }
    return second;
  }

  function projectionMetadataBytes(input) {
    return canonicalizeVnextJcsBytes({
      expectedCampaignId: input.expectedCampaignId,
      expectedCampaignPlanSha256: input.campaignPlanSha256,
      expectedEnvironment: input.expectedEnvironment,
      expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
      trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
      verificationTimeUtc: input.verificationTimeUtc
    }, operationJcsLimits);
  }

  function startRecord(input, stable) {
    return finalizeOperationRecord({
      campaignArtifactStoreProfileId: parsedProfile.campaignArtifactStoreProfileId,
      campaignEvidenceProfileId: parsedProfile.campaignEvidenceProfileId,
      campaignPlanId: stable.plan.planId,
      campaignPlanSha256: stable.plan.planSha256,
      expectedCampaignId: input.expectedCampaignId,
      expectedEnvironment: input.expectedEnvironment,
      expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
      operationId: input.operationId,
      planCampaignId: stable.plan.campaignId,
      planEnvironment: stable.plan.environment,
      receiptSnapshot: stable.receipts.public,
      schema: parsedProfile.operationRecordSchema,
      state: "started",
      subjectSnapshot: stable.subjects.public,
      trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
      verificationTimeUtc: input.verificationTimeUtc,
      wasmModuleSha256
    });
  }

  function terminalRecord(operationId, startedRecordId, outcome, projectionSha256,
    errorCode, errorStep) {
    return finalizeOperationRecord({
      errorCode,
      errorStep,
      operationId,
      outcome,
      projectionResultSha256: projectionSha256,
      schema: parsedProfile.operationRecordSchema,
      startedRecordId,
      state: "terminal"
    });
  }

  async function executeProjection(input) {
    operationStore.rebuild();
    let existing = null;
    try {
      existing = operationStore.inspect(input.operationId);
    } catch (error) {
      if (error?.code !== "campaign_runner_operation_not_found") throw error;
    }
    if (existing !== null && existing.state !== "interrupted") {
      failEvidence("campaign_runner_operation_already_terminal", "campaign-runner-operation");
    }
    const stable = stableInputs(input.campaignPlanSha256);
    const started = startRecord(input, stable);
    if (existing !== null && existing.startedRecordId !== started.record.recordId) {
      failEvidence("campaign_runner_operation_resume_mismatch", "campaign-runner-operation");
    }
    const startPersistence = operationStore.put(started);
    let projectionBytes;
    let projectionPersistence;
    try {
      projectionBytes = Buffer.from(verifier.projectCampaign({
        campaignPlanBytes: stable.plan.bytes,
        metadataBytes: projectionMetadataBytes(input),
        receiptBytes: stable.receipts.members.map((member) => Buffer.from(member.bytes)),
        subjectBytes: stable.subjects.members.map((member) => Buffer.from(member.bytes))
      }));
      const validatedResult = Buffer.from(verifier.validateCampaignProjectionResult(
        projectionBytes,
        stable.plan.bytes
      ));
      if (!validatedResult.equals(projectionBytes)) {
        failEvidence("campaign_runner_projection_validation_mismatch",
          "campaign-projection");
      }
      projectionPersistence = artifactStore.putProjection(projectionBytes);
      const terminal = terminalRecord(
        input.operationId,
        started.record.recordId,
        "completed",
        projectionPersistence.artifactSha256,
        null,
        null
      );
      const terminalPersistence = operationStore.put(terminal);
      return Object.freeze({
        operationId: input.operationId,
        persistence: immutableRecord({
          projectionDisposition: projectionPersistence.disposition,
          startedDisposition: startPersistence.disposition,
          terminalDisposition: terminalPersistence.disposition
        }),
        projectionResultBytes: Buffer.from(projectionBytes),
        projectionResultSha256: projectionPersistence.artifactSha256,
        receiptSnapshot: stable.receipts.public,
        startedRecordId: started.record.recordId,
        subjectSnapshot: stable.subjects.public,
        terminalRecordId: terminal.record.recordId
      });
    } catch (error) {
      const bounded = error instanceof VnextEvidenceError
        ? error
        : new VnextEvidenceError(
          errorCodePattern.test(String(error?.code || ""))
            ? String(error.code)
            : "campaign_runner_projection_failed",
          "campaign-projection"
        );
      const step = errorStepPattern.test(String(error?.step || ""))
        ? String(error.step)
        : "campaign-projection";
      const failed = terminalRecord(
        input.operationId,
        started.record.recordId,
        "failed",
        null,
        bounded.code,
        step
      );
      try {
        operationStore.put(failed);
      } catch (persistError) {
        throw new VnextEvidenceError(
          "campaign_runner_failure_record_persist_failed",
          "campaign-runner-operation",
          persistError?.code
        );
      }
      if (error instanceof VnextEvidenceError) throw error;
      if (errorCodePattern.test(String(error?.code || ""))) {
        throw new VnextEvidenceError(String(error.code), step);
      }
      throw bounded;
    }
  }

  async function runProjection(value) {
    const input = exactRunInput(value);
    const lock = acquireLock();
    let result;
    let failure;
    try {
      result = await executeProjection(input);
    } catch (error) {
      failure = error;
    }
    try {
      releaseLock(lock);
    } catch (error) {
      throw new VnextEvidenceError(
        "campaign_runner_lock_release_failed",
        "campaign-runner-lock",
        error?.code
      );
    }
    if (failure) throw failure;
    return result;
  }

  return Object.freeze({
    inspectOperation: operationStore.inspect,
    lockStartup,
    profileId: parsedProfile.profileId,
    readOperationRecord: operationStore.read,
    rebuildOperationHistory: operationStore.rebuild,
    runProjection,
    startup: operationStore.startup,
    wasmModuleSha256
  });
}

module.exports = Object.freeze({
  campaignRunnerProfile,
  campaignRunnerProfileSha256,
  createVnextCampaignRunner,
  operationRecordRelativePath,
  validateCampaignRunnerOperationBytes
});
