"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  campaignRunnerProfile,
  campaignRunnerProfileSha256,
  createVnextCampaignRunner
} = require("./vnext-campaign-runner.js");
const {
  campaignProjectionProfile,
  campaignProjectionProfileSha256,
  validateCampaignProjectionResultBytes
} = require("./vnext-campaign-projection.js");
const {
  createVnextCampaignArtifactStore
} = require("./vnext-campaign-artifact-store.js");
const {
  canonicalizeVnextJcsBytes
} = require("./vnext-jcs.js");
const {
  failEvidence
} = require("./vnext-evidence-error.js");
const {
  finalizeVnextReceipt
} = require("./vnext-receipt-identity.js");
const {
  createVnextReceiptStore,
  storeProfile: receiptStoreProfile
} = require("./vnext-receipt-store.js");
const {
  createVnextRedactionScanReceipt,
  publicSafeRedactionProfile,
  publicSafeRedactionProfileSha256,
  scanKnownSecretRepresentations,
  scanVnextPublicDocumentBytes
} = require("./vnext-public-safe-redaction.js");
const {
  createVnextSubjectStore,
  subjectStoreProfile,
  subjectStoreProfileSha256
} = require("./vnext-subject-store.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot, "campaign-release-surface-profile.v1.json");
const registryPath = path.join(contractRoot, "contract-family.v1.json");
const receiptStoreProfilePath = path.join(contractRoot, "receipt-store-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const registryBytes = fs.readFileSync(registryPath);
const receiptStoreProfileBytes = fs.readFileSync(receiptStoreProfilePath);
const parsedProfile = parseStrictJson(profileBytes);
const campaignReleaseSurfaceProfileSha256 = sha256(profileBytes);
const receiptStoreProfileSha256 = sha256(receiptStoreProfileBytes);
const sourceSha256 = sha256(fs.readFileSync(__filename));
const runnerSourceSha256 = sha256(fs.readFileSync(path.join(__dirname,
  "vnext-campaign-runner.js")));

const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^(?:git-sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/u;
const attestationInputFields = Object.freeze([
  "campaignPlanSha256",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "knownSecrets",
  "operationId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc"
]);
const optionFields = Object.freeze([
  "campaignArtifactStoreRoot",
  "expectedWasmModuleSha256",
  "receiptStoreRoot",
  "subjectStoreRoot",
  "wasmModuleBytes"
]);
const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "campaignRunnerProfileId", "campaignRunnerProfileSha256",
  "campaignProjectionProfileId", "campaignProjectionProfileSha256",
  "receiptStoreProfileId", "receiptStoreProfileSha256", "subjectStoreProfileId",
  "subjectStoreProfileSha256", "publicSafeRedactionProfileId",
  "publicSafeRedactionProfileSha256", "canonicalJsonProfile", "hashAlgorithm",
  "campaignTruthInput", "operationPolicy", "storedProjectionPolicy",
  "callerVerdictPolicy", "callerCounterPolicy", "mutablePointerPolicy",
  "networkAccess", "clockAccess", "sourceMutation", "attestation",
  "operatorStatus", "limits"
]);
const attestationProfileFields = Object.freeze([
  "receiptSchema", "receiptType", "phase", "completeStatus", "incompleteStatus",
  "incompleteBlockerCode", "redactionFailureBlockerCode", "inputReceiptPolicy",
  "projectionBinding", "redactionPolicy", "unsafeAttestationPersistence"
]);
const operatorProfileFields = Object.freeze([
  "schema", "source", "completeState", "incompleteState", "redactionBlockedState",
  "doneState", "fields"
]);
const limitFields = Object.freeze([
  "maximumKnownSecrets", "maximumProjectionBytes", "maximumReceiptSnapshotMembers",
  "maximumSubjectSnapshotMembers", "maximumOperatorStatusBytes",
  "maximumBlockerCodes", "maximumCountRows"
]);
const operatorFields = Object.freeze([
  "attestationReceiptId", "blockerCodes", "campaignId", "counts", "environment",
  "operationId", "projectionResultSha256", "redactionReceiptId", "releaseEligible",
  "resumableState", "schema", "startedRecordId", "state", "terminalRecordId",
  "verificationTimeUtc"
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
  const names = Object.getOwnPropertyNames(value).sort();
  const expected = [...fields].sort();
  if (names.length !== expected.length ||
      names.some((name, index) => name !== expected[index])) {
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
  return Object.freeze(result);
}

function dataArray(value, maximum, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 || value.length > maximum ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
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
  return Object.freeze(result);
}

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((entry, index) => entry === right[index]);
}

function validateInstalledProfile() {
  const step = "campaign-release-surface-profile";
  exactDataObject(parsedProfile, profileFields, "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.attestation, attestationProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.operatorStatus, operatorProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.limits, limitFields,
    "release_surface_profile_invalid", step);
  const limitsValid = Object.values(parsedProfile.limits)
    .every((value) => Number.isSafeInteger(value) && value > 0);
  if (parsedProfile.schema !== "tinyrustlm.vnext.campaign_release_surface_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.campaign-release-surface.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.contractRegistrySha256 !== sha256(registryBytes) ||
      parsedProfile.campaignRunnerProfileId !== campaignRunnerProfile.profileId ||
      parsedProfile.campaignRunnerProfileSha256 !== campaignRunnerProfileSha256 ||
      parsedProfile.campaignProjectionProfileId !== campaignProjectionProfile.profileId ||
      parsedProfile.campaignProjectionProfileSha256 !== campaignProjectionProfileSha256 ||
      parsedProfile.receiptStoreProfileId !== receiptStoreProfile.profileId ||
      parsedProfile.receiptStoreProfileSha256 !== receiptStoreProfileSha256 ||
      parsedProfile.subjectStoreProfileId !== subjectStoreProfile.profileId ||
      parsedProfile.subjectStoreProfileSha256 !== subjectStoreProfileSha256 ||
      parsedProfile.publicSafeRedactionProfileId !== publicSafeRedactionProfile.profileId ||
      parsedProfile.publicSafeRedactionProfileSha256 !==
        publicSafeRedactionProfileSha256 ||
      parsedProfile.canonicalJsonProfile !== "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.campaignTruthInput !==
        "fresh-sole-runner-return-created-and-consumed-inside-one-surface-call" ||
      parsedProfile.operationPolicy !== "never-before-used-operation-id-only" ||
      parsedProfile.storedProjectionPolicy !== "forbidden" ||
      parsedProfile.callerVerdictPolicy !== "forbidden" ||
      parsedProfile.callerCounterPolicy !== "forbidden" ||
      parsedProfile.mutablePointerPolicy !== "forbidden" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.clockAccess !== "caller-trusted-verification-time-only" ||
      parsedProfile.sourceMutation !== "create-only-attestation-and-redaction-receipts" ||
      parsedProfile.attestation.receiptSchema !== "tinyrustlm.vnext.receipt.v1" ||
      parsedProfile.attestation.receiptType !== "final-attestation" ||
      parsedProfile.attestation.phase !== "final-attestation" ||
      parsedProfile.attestation.completeStatus !== "pass" ||
      parsedProfile.attestation.incompleteStatus !== "blocked" ||
      parsedProfile.attestation.incompleteBlockerCode !==
        "campaign-objectives-incomplete" ||
      parsedProfile.attestation.redactionFailureBlockerCode !==
        "public-evidence-secret-scan-failed" ||
      parsedProfile.attestation.inputReceiptPolicy !==
        "every-active-receipt-in-fresh-runner-snapshot" ||
      parsedProfile.attestation.projectionBinding !==
        "exact-plan-projection-operation-and-snapshot-hashes" ||
      parsedProfile.attestation.redactionPolicy !==
        "scan-final-canonical-bytes-before-attestation-persistence" ||
      parsedProfile.attestation.unsafeAttestationPersistence !== "forbidden" ||
      parsedProfile.operatorStatus.schema !==
        "tinyrustlm.vnext.campaign_release_status.v1" ||
      parsedProfile.operatorStatus.source !== "fresh-projection-only" ||
      parsedProfile.operatorStatus.completeState !==
        "campaign-complete-awaiting-release-inputs" ||
      parsedProfile.operatorStatus.incompleteState !== "campaign-incomplete" ||
      parsedProfile.operatorStatus.redactionBlockedState !==
        "release-evidence-redaction-blocked" ||
      parsedProfile.operatorStatus.doneState !==
        "forbidden-before-authorized-release-and-public-readback" ||
      !sameStrings(parsedProfile.operatorStatus.fields, [...operatorFields].sort()) ||
      !limitsValid ||
      parsedProfile.limits.maximumProjectionBytes !==
        campaignProjectionProfile.limits.maximumProjectionResultBytes ||
      parsedProfile.limits.maximumReceiptSnapshotMembers !==
        campaignRunnerProfile.limits.maximumReceiptInputs ||
      parsedProfile.limits.maximumSubjectSnapshotMembers !==
        campaignRunnerProfile.limits.maximumSubjectInputs) {
    failEvidence("release_surface_profile_invalid", step);
  }
}

validateInstalledProfile();

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

const campaignReleaseSurfaceProfile = deepFreeze({ ...parsedProfile });

function runtimeRecord() {
  const operatingSystem = process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "macos" :
      process.platform === "linux" ? "linux" : null;
  const architecture = process.arch === "x64" ? "x86_64" :
    process.arch === "arm64" ? "aarch64" : null;
  if (operatingSystem === null || architecture === null) {
    failEvidence("release_surface_runtime_unsupported", "release-surface-attestation");
  }
  return {
    runtimeIdentifier: `node.${process.versions.node}.${process.platform}.${process.arch}`,
    operatingSystem,
    architecture,
    executionClass: "local"
  };
}

function normalizeInput(rawInput) {
  const input = exactDataObject(rawInput, attestationInputFields,
    "release_surface_input_invalid", "release-surface-input");
  const knownSecrets = dataArray(input.knownSecrets,
    parsedProfile.limits.maximumKnownSecrets,
    "release_surface_known_secrets_invalid", "release-surface-input");
  scanKnownSecretRepresentations(Buffer.from("{}", "utf8"), knownSecrets);
  if (!digestPattern.test(input.campaignPlanSha256) ||
      !contentIdPattern.test(input.operationId) ||
      !sourceRevisionPattern.test(input.sourceRevision)) {
    failEvidence("release_surface_input_invalid", "release-surface-input");
  }
  return Object.freeze({ ...input, knownSecrets });
}

function normalizeOptions(rawOptions) {
  const options = exactDataObject(rawOptions, optionFields,
    "release_surface_options_invalid", "release-surface-open");
  if (!digestPattern.test(options.expectedWasmModuleSha256) ||
      !Buffer.isBuffer(options.wasmModuleBytes)) {
    failEvidence("release_surface_options_invalid", "release-surface-open");
  }
  return options;
}

function assertNeverUsedOperation(runner, operationId) {
  try {
    runner.inspectOperation(operationId);
  } catch (error) {
    if (error?.code === "campaign_runner_operation_not_found") return;
    throw error;
  }
  failEvidence("release_surface_operation_not_fresh", "release-surface-runner");
}

function countParameters(projection) {
  const names = Object.keys(projection.counts).sort();
  if (names.length > parsedProfile.limits.maximumCountRows) {
    failEvidence("release_surface_count_limit", "release-surface-attestation");
  }
  return names.flatMap((name) => [
    {
      name: `${name.replace(/[A-Z]/gu, (character) =>
        `-${character.toLowerCase()}`)}-current`,
      value: String(projection.counts[name].current),
      unit: "count"
    },
    {
      name: `${name.replace(/[A-Z]/gu, (character) =>
        `-${character.toLowerCase()}`)}-target`,
      value: String(projection.counts[name].target),
      unit: "count"
    }
  ]);
}

function currentAttestationIds(receiptStore, campaignId) {
  const rebuilt = receiptStore.rebuild();
  const attestations = [];
  const superseded = new Set();
  for (const receiptId of rebuilt.activeReceiptIds) {
    const receipt = receiptStore.read(receiptId).receipt;
    for (const parentId of receipt.supersedesReceiptIds) superseded.add(parentId);
    if (receipt.campaignId === campaignId && receipt.receiptType === "final-attestation") {
      attestations.push(receiptId);
    }
  }
  const current = attestations.filter((receiptId) => !superseded.has(receiptId)).sort();
  if (current.length > 64) {
    failEvidence("release_surface_attestation_conflict_limit",
      "release-surface-attestation");
  }
  return Object.freeze({ activeReceiptIds: rebuilt.activeReceiptIds, current });
}

function createAttestation(input, runnerResult, projection, runner, receiptStore,
  subjectStore) {
  const history = runner.inspectOperation(input.operationId);
  if (history.state !== "completed" ||
      history.startedRecordId !== runnerResult.startedRecordId ||
      history.terminalRecordId !== runnerResult.terminalRecordId ||
      history.projectionResultSha256 !== runnerResult.projectionResultSha256) {
    failEvidence("release_surface_operation_not_completed", "release-surface-attestation");
  }
  const started = runner.readOperationRecord(history.startedRecordId);
  const terminal = runner.readOperationRecord(history.terminalRecordId);
  if (started.record.receiptSnapshot.snapshotSha256 !==
        runnerResult.receiptSnapshot.snapshotSha256 ||
      started.record.subjectSnapshot.snapshotSha256 !==
        runnerResult.subjectSnapshot.snapshotSha256 ||
      terminal.record.outcome !== "completed") {
    failEvidence("release_surface_operation_binding_mismatch",
      "release-surface-attestation");
  }
  const current = currentAttestationIds(receiptStore, projection.campaignId);
  if (!sameStrings(current.activeReceiptIds,
    runnerResult.receiptSnapshot.members.map((member) => member.id))) {
    failEvidence("release_surface_snapshot_changed", "release-surface-attestation");
  }
  const currentSubjects = subjectStore.rebuild().activeSubjectIds;
  if (!sameStrings(currentSubjects,
    runnerResult.subjectSnapshot.members.map((member) => member.id))) {
    failEvidence("release_surface_snapshot_changed", "release-surface-attestation");
  }
  const inputHashes = [
    { name: "campaign-plan", sha256: projection.campaignPlanSha256 },
    { name: "campaign-projection-result", sha256: runnerResult.projectionResultSha256 },
    { name: "campaign-release-surface-profile", sha256: campaignReleaseSurfaceProfileSha256 },
    { name: "campaign-runner-profile", sha256: campaignRunnerProfileSha256 },
    { name: "campaign-runner-start-record", sha256: sha256(started.bytes) },
    { name: "campaign-runner-terminal-record", sha256: sha256(terminal.bytes) },
    { name: "public-safe-redaction-profile", sha256: publicSafeRedactionProfileSha256 },
    { name: "receipt-snapshot", sha256: runnerResult.receiptSnapshot.snapshotSha256 },
    { name: "subject-snapshot", sha256: runnerResult.subjectSnapshot.snapshotSha256 },
    { name: "wasm-module", sha256: runner.wasmModuleSha256 }
  ].sort((left, right) => left.name.localeCompare(right.name));
  const publicParameters = [
    ...countParameters(projection),
    { name: "authority-status", value: projection.authorityStatus, unit: null },
    { name: "campaign-complete", value: String(projection.complete), unit: null },
    { name: "campaign-environment", value: projection.environment, unit: null },
    { name: "campaign-id", value: projection.campaignId, unit: null },
    { name: "operation-id", value: input.operationId, unit: null },
    { name: "resumable-state", value: projection.resumableState, unit: null },
    { name: "runner-start-record-id", value: runnerResult.startedRecordId, unit: null },
    { name: "runner-terminal-record-id", value: runnerResult.terminalRecordId, unit: null }
  ].sort((left, right) => left.name.localeCompare(right.name));
  return finalizeVnextReceipt({
    schema: parsedProfile.attestation.receiptSchema,
    receiptType: parsedProfile.attestation.receiptType,
    campaignId: projection.campaignId,
    attemptId: input.operationId,
    phase: parsedProfile.attestation.phase,
    status: projection.complete
      ? parsedProfile.attestation.completeStatus
      : parsedProfile.attestation.incompleteStatus,
    startedAtUtc: input.verificationTimeUtc,
    completedAtUtc: input.verificationTimeUtc,
    sourceRevision: input.sourceRevision,
    inputReceiptIds: [...current.activeReceiptIds],
    inputHashes,
    outputHashes: [{
      name: "campaign-projection-result",
      sha256: runnerResult.projectionResultSha256
    }],
    tools: [
      {
        name: "tinyrustlm.vnext.campaign-release-surface",
        version: "1.0.0",
        binarySha256: sourceSha256
      },
      {
        name: "tinyrustlm.vnext.campaign-runner",
        version: "1.0.0",
        binarySha256: runnerSourceSha256
      },
      {
        name: "tinyrustlm.vnext.campaign-runner-wasm",
        version: "1.0.0",
        binarySha256: runner.wasmModuleSha256
      }
    ],
    configurationSha256: campaignReleaseSurfaceProfileSha256,
    runtime: runtimeRecord(),
    publicParameters,
    error: null,
    blockerCode: projection.complete
      ? null
      : parsedProfile.attestation.incompleteBlockerCode,
    externalEvidenceReferences: [],
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: null,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: [...current.current]
  });
}

function operatorStatus(input, runnerResult, projection, attestationReceiptId,
  redactionReceiptId, redactionPassed) {
  const blockerCodes = [...new Set([
    ...projection.blockerCodes,
    ...(redactionPassed ? [] : [parsedProfile.attestation.redactionFailureBlockerCode])
  ])].sort();
  if (blockerCodes.length > parsedProfile.limits.maximumBlockerCodes) {
    failEvidence("release_surface_blocker_limit", "release-surface-operator");
  }
  const state = !redactionPassed
    ? parsedProfile.operatorStatus.redactionBlockedState
    : projection.complete
      ? parsedProfile.operatorStatus.completeState
      : parsedProfile.operatorStatus.incompleteState;
  const status = {
    schema: parsedProfile.operatorStatus.schema,
    campaignId: projection.campaignId,
    environment: projection.environment,
    operationId: input.operationId,
    startedRecordId: runnerResult.startedRecordId,
    terminalRecordId: runnerResult.terminalRecordId,
    projectionResultSha256: runnerResult.projectionResultSha256,
    verificationTimeUtc: projection.verificationTimeUtc,
    counts: projection.counts,
    resumableState: projection.resumableState,
    blockerCodes,
    releaseEligible: projection.complete && redactionPassed,
    state,
    attestationReceiptId,
    redactionReceiptId
  };
  const bytes = canonicalizeVnextJcsBytes(status);
  if (bytes.length > parsedProfile.limits.maximumOperatorStatusBytes) {
    failEvidence("release_surface_operator_byte_limit", "release-surface-operator");
  }
  const knownScan = scanKnownSecretRepresentations(bytes, input.knownSecrets);
  if (knownScan.findingCount !== 0) {
    failEvidence("release_surface_operator_secret_detected", "release-surface-operator");
  }
  return immutableStatus(status, bytes);
}

function immutableStatus(status, bytes) {
  const canonical = Buffer.from(bytes);
  const result = {
    status: deepFreeze(status),
    statusSha256: sha256(canonical)
  };
  Object.defineProperty(result, "statusBytes", {
    enumerable: true,
    get() {
      return Buffer.from(canonical);
    }
  });
  return Object.freeze(result);
}

function immutableAttestationResult(value, projectionBytes, attestationBytes,
  redactionBytes, statusBytes) {
  const result = { ...value };
  const buffers = {
    projectionResultBytes: projectionBytes,
    attestationReceiptBytes: attestationBytes,
    redactionReceiptBytes: redactionBytes,
    operatorStatusBytes: statusBytes
  };
  for (const [name, bytes] of Object.entries(buffers)) {
    const canonical = bytes === null ? null : Buffer.from(bytes);
    Object.defineProperty(result, name, {
      enumerable: true,
      get() {
        return canonical === null ? null : Buffer.from(canonical);
      }
    });
  }
  return Object.freeze(result);
}

async function createVnextCampaignReleaseSurface(rootInput, rawOptions) {
  const options = normalizeOptions(rawOptions);
  const runner = await createVnextCampaignRunner(rootInput, {
    campaignArtifactStoreRoot: options.campaignArtifactStoreRoot,
    expectedWasmModuleSha256: options.expectedWasmModuleSha256,
    receiptStoreRoot: options.receiptStoreRoot,
    subjectStoreRoot: options.subjectStoreRoot,
    wasmModuleBytes: options.wasmModuleBytes
  });
  const artifactStore = createVnextCampaignArtifactStore(options.campaignArtifactStoreRoot);
  const receiptStore = createVnextReceiptStore(options.receiptStoreRoot);
  const subjectStore = createVnextSubjectStore(options.subjectStoreRoot);

  async function attestCampaign(rawInput) {
    const input = normalizeInput(rawInput);
    assertNeverUsedOperation(runner, input.operationId);
    const runnerResult = await runner.runProjection({
      campaignPlanSha256: input.campaignPlanSha256,
      expectedCampaignId: input.expectedCampaignId,
      expectedEnvironment: input.expectedEnvironment,
      expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
      operationId: input.operationId,
      trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
      verificationTimeUtc: input.verificationTimeUtc
    });
    const plan = artifactStore.readPlan(input.campaignPlanSha256);
    const validatedProjection = validateCampaignProjectionResultBytes(
      runnerResult.projectionResultBytes,
      plan.bytes
    );
    if (validatedProjection.resultSha256 !== runnerResult.projectionResultSha256 ||
        validatedProjection.result.verificationTimeUtc !== input.verificationTimeUtc ||
        validatedProjection.result.campaignId !== input.expectedCampaignId ||
        validatedProjection.result.environment !== input.expectedEnvironment) {
      failEvidence("release_surface_projection_binding_mismatch",
        "release-surface-projection");
    }
    const attestation = createAttestation(
      input,
      runnerResult,
      validatedProjection.result,
      runner,
      receiptStore,
      subjectStore
    );
    const scan = scanVnextPublicDocumentBytes(attestation.bytes, {
      knownSecrets: input.knownSecrets
    });
    const redactionReceipt = createVnextRedactionScanReceipt({
      attemptId: `redaction-${input.operationId.slice("sha256:".length)}`,
      campaignId: validatedProjection.result.campaignId,
      completedAtUtc: input.verificationTimeUtc,
      scan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: input.verificationTimeUtc
    });
    let attestationPersistence = null;
    if (scan.publicSafe) attestationPersistence = receiptStore.put(attestation.bytes);
    const redactionPersistence = receiptStore.put(redactionReceipt.bytes);
    const status = operatorStatus(
      input,
      runnerResult,
      validatedProjection.result,
      scan.publicSafe ? attestation.receipt.receiptId : null,
      redactionReceipt.receipt.receiptId,
      scan.publicSafe
    );
    return immutableAttestationResult({
      operationId: input.operationId,
      projectionResultSha256: runnerResult.projectionResultSha256,
      startedRecordId: runnerResult.startedRecordId,
      terminalRecordId: runnerResult.terminalRecordId,
      campaignComplete: validatedProjection.result.complete,
      releaseEligible: status.status.releaseEligible,
      attestationReceiptId: scan.publicSafe ? attestation.receipt.receiptId : null,
      redactionReceiptId: redactionReceipt.receipt.receiptId,
      attestationPersistence,
      redactionPersistence,
      operatorStatus: status.status,
      operatorStatusSha256: status.statusSha256
    }, runnerResult.projectionResultBytes,
    scan.publicSafe ? attestation.bytes : null,
    redactionReceipt.bytes,
    status.statusBytes);
  }

  return Object.freeze({
    attestCampaign,
    profileId: parsedProfile.profileId,
    profileSha256: campaignReleaseSurfaceProfileSha256,
    runnerStartup: runner.startup
  });
}

module.exports = Object.freeze({
  campaignReleaseSurfaceProfile,
  campaignReleaseSurfaceProfileSha256,
  createVnextCampaignReleaseSurface
});
