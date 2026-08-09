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
  finalizeVnextIdentityDocument,
  identityContractForSchema
} = require("./vnext-content-identity.js");
const {
  canonicalizeVnextJcsBytes
} = require("./vnext-jcs.js");
const {
  failEvidence
} = require("./vnext-evidence-error.js");
const {
  domainSeparatedDigest,
  finalizeVnextReceipt
} = require("./vnext-receipt-identity.js");
const {
  classifyVnextPhaseReceipts,
  phaseInvalidationProfile,
  phaseInvalidationProfileSha256
} = require("./vnext-phase-invalidation.js");
const {
  createVnextReceiptStore,
  storeProfile: receiptStoreProfile
} = require("./vnext-receipt-store.js");
const {
  createVnextRedactionScanReceipt,
  publicSafeRedactionProfile,
  publicSafeRedactionProfileSha256,
  scanKnownSecretRepresentations,
  scanVnextPublicDocumentBytes,
  scanVnextPublicTextBytes
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
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const utcPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;
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
const prepareInputFields = Object.freeze([
  ...attestationInputFields,
  "artifactManifestIds",
  "changelogBytes",
  "claimIds",
  "packageReceiptIds",
  "productId",
  "provenanceReceiptId",
  "remainingRiskCodes",
  "sbomArtifactId",
  "version"
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
  "phaseInvalidationProfileId", "phaseInvalidationProfileSha256",
  "receiptStoreProfileId", "receiptStoreProfileSha256", "subjectStoreProfileId",
  "subjectStoreProfileSha256", "publicSafeRedactionProfileId",
  "publicSafeRedactionProfileSha256", "canonicalJsonProfile", "hashAlgorithm",
  "campaignTruthInput", "operationPolicy", "storedProjectionPolicy",
  "callerVerdictPolicy", "callerCounterPolicy", "mutablePointerPolicy",
  "networkAccess", "clockAccess", "sourceMutation", "attestation",
  "operatorStatus", "releasePreparation", "limits"
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
const releasePreparationProfileFields = Object.freeze([
  "manifestSchema", "preparedState", "authorizationPolicy", "campaignPolicy",
  "snapshotPolicy", "phaseEvidencePolicy", "artifactCoverage",
  "artifactSetIdentityDomain", "packageBinding", "provenanceBinding",
  "sbomPolicy", "claimSelection", "claimConflictPolicy", "changelogPolicy",
  "releaseDatePolicy", "redactionPolicy", "persistencePolicy",
  "unsafePersistence"
]);
const limitFields = Object.freeze([
  "maximumKnownSecrets", "maximumProjectionBytes", "maximumReceiptSnapshotMembers",
  "maximumSubjectSnapshotMembers", "maximumOperatorStatusBytes",
  "maximumBlockerCodes", "maximumCountRows", "maximumReleaseArtifactManifests",
  "maximumReleasePackageReceipts", "maximumReleaseClaims",
  "maximumRemainingRiskCodes", "maximumChangelogBytes",
  "maximumReleaseManifestBytes"
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

function sortedUniqueStringArray(value, maximum, minimum, pattern, code, step) {
  const values = dataArray(value, maximum, code, step);
  if (values.length < minimum || values.some((entry, index) =>
    typeof entry !== "string" || !pattern.test(entry) ||
      index > 0 && values[index - 1] >= entry)) {
    failEvidence(code, step);
  }
  return values;
}

function validateInstalledProfile() {
  const step = "campaign-release-surface-profile";
  exactDataObject(parsedProfile, profileFields, "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.attestation, attestationProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.operatorStatus, operatorProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.releasePreparation, releasePreparationProfileFields,
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
      parsedProfile.phaseInvalidationProfileId !== phaseInvalidationProfile.profileId ||
      parsedProfile.phaseInvalidationProfileSha256 !== phaseInvalidationProfileSha256 ||
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
      parsedProfile.sourceMutation !==
        "create-only-attestation-redaction-receipts-and-release-manifests" ||
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
      parsedProfile.releasePreparation.manifestSchema !==
        "tinyrustlm.vnext.release_manifest.v2" ||
      parsedProfile.releasePreparation.preparedState !==
        "release-prepared-awaiting-authorization" ||
      parsedProfile.releasePreparation.authorizationPolicy !==
        "forbidden-in-preparation" ||
      parsedProfile.releasePreparation.campaignPolicy !==
        "fresh-projection-must-be-complete" ||
      parsedProfile.releasePreparation.snapshotPolicy !==
        "all-release-parents-exact-members-of-fresh-runner-snapshots" ||
      parsedProfile.releasePreparation.phaseEvidencePolicy !==
        "selected-receipts-and-all-evidence-current-pass" ||
      parsedProfile.releasePreparation.artifactCoverage !==
        "all-campaign-qualified-artifacts-plus-explicit-dependency-closure-and-sbom" ||
      parsedProfile.releasePreparation.artifactSetIdentityDomain !==
        "tinyrustlm.release-artifact-set.v1" ||
      parsedProfile.releasePreparation.packageBinding !==
        "current-pass-package-receipt-binds-exact-artifact-set-and-source-revision" ||
      parsedProfile.releasePreparation.provenanceBinding !==
        "current-pass-release-provenance-review-binds-exact-artifact-set-and-source-revision" ||
      parsedProfile.releasePreparation.sbomPolicy !==
        "one-selected-cyclonedx-json-1.6-sbom-without-qualification" ||
      parsedProfile.releasePreparation.claimSelection !==
        "all-current-approved-claims-for-source-revision" ||
      parsedProfile.releasePreparation.claimConflictPolicy !==
        "one-current-claim-per-site-route-component-and-wording-class" ||
      parsedProfile.releasePreparation.changelogPolicy !==
        "canonical-public-text-scanned-and-sha256-bound" ||
      parsedProfile.releasePreparation.releaseDatePolicy !==
        "trusted-verification-time-calendar-date" ||
      parsedProfile.releasePreparation.redactionPolicy !==
        "scan-selected-public-documents-changelog-and-final-manifest" ||
      parsedProfile.releasePreparation.persistencePolicy !==
        "redaction-receipts-before-create-only-release-manifest" ||
      parsedProfile.releasePreparation.unsafePersistence !==
        "release-manifest-forbidden" ||
      !limitsValid ||
      parsedProfile.limits.maximumProjectionBytes !==
        campaignProjectionProfile.limits.maximumProjectionResultBytes ||
      parsedProfile.limits.maximumReceiptSnapshotMembers !==
        campaignRunnerProfile.limits.maximumReceiptInputs ||
      parsedProfile.limits.maximumSubjectSnapshotMembers !==
        campaignRunnerProfile.limits.maximumSubjectInputs ||
      parsedProfile.limits.maximumReleaseArtifactManifests !== 64 ||
      parsedProfile.limits.maximumReleasePackageReceipts !== 64 ||
      parsedProfile.limits.maximumReleaseClaims !== 128 ||
      parsedProfile.limits.maximumRemainingRiskCodes !== 64 ||
      parsedProfile.limits.maximumReleaseManifestBytes !==
        identityContractForSchema(parsedProfile.releasePreparation.manifestSchema)
          .maximumBytes ||
      parsedProfile.limits.maximumChangelogBytes >
        publicSafeRedactionProfile.limits.maximumInputBytes) {
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

function normalizePrepareInput(rawInput) {
  const step = "release-surface-prepare-input";
  const input = exactDataObject(rawInput, prepareInputFields,
    "release_surface_prepare_input_invalid", step);
  const knownSecrets = dataArray(input.knownSecrets,
    parsedProfile.limits.maximumKnownSecrets,
    "release_surface_known_secrets_invalid", step);
  scanKnownSecretRepresentations(Buffer.from("{}", "utf8"), knownSecrets);
  const artifactManifestIds = sortedUniqueStringArray(
    input.artifactManifestIds,
    parsedProfile.limits.maximumReleaseArtifactManifests,
    1,
    contentIdPattern,
    "release_surface_artifact_ids_invalid",
    step
  );
  const packageReceiptIds = sortedUniqueStringArray(
    input.packageReceiptIds,
    parsedProfile.limits.maximumReleasePackageReceipts,
    1,
    contentIdPattern,
    "release_surface_package_ids_invalid",
    step
  );
  const claimIds = sortedUniqueStringArray(
    input.claimIds,
    parsedProfile.limits.maximumReleaseClaims,
    1,
    contentIdPattern,
    "release_surface_claim_ids_invalid",
    step
  );
  const remainingRiskCodes = sortedUniqueStringArray(
    input.remainingRiskCodes,
    parsedProfile.limits.maximumRemainingRiskCodes,
    0,
    safeIdPattern,
    "release_surface_risk_codes_invalid",
    step
  );
  if (!digestPattern.test(input.campaignPlanSha256) ||
      !contentIdPattern.test(input.operationId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.sbomArtifactId) ||
      !contentIdPattern.test(input.provenanceReceiptId) ||
      typeof input.productId !== "string" || !safeIdPattern.test(input.productId) ||
      typeof input.version !== "string" || input.version.length > 128 ||
      !semverPattern.test(input.version) ||
      !Buffer.isBuffer(input.changelogBytes) || input.changelogBytes.length === 0 ||
      input.changelogBytes.length > parsedProfile.limits.maximumChangelogBytes ||
      !artifactManifestIds.includes(input.sbomArtifactId)) {
    failEvidence("release_surface_prepare_input_invalid", step);
  }
  return Object.freeze({
    ...input,
    artifactManifestIds,
    changelogBytes: Buffer.from(input.changelogBytes),
    claimIds,
    knownSecrets,
    packageReceiptIds,
    remainingRiskCodes
  });
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

function utcNanoseconds(value) {
  if (typeof value !== "string") return null;
  const match = utcPattern.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (month < 1 || month > 12 || day < 1 ||
      candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const milliseconds = candidate.getTime();
  if (!Number.isSafeInteger(milliseconds)) return null;
  return BigInt(milliseconds) * 1_000_000n +
    BigInt(fraction.padEnd(9, "0") || "0");
}

function compareUtc(left, right, code, step) {
  const leftValue = utcNanoseconds(left);
  const rightValue = utcNanoseconds(right);
  if (leftValue === null || rightValue === null) failEvidence(code, step);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function publicParameter(receipt, name, code, step) {
  const entry = receipt.publicParameters.find((parameter) => parameter.name === name);
  if (!entry) failEvidence(code, step);
  return entry.value;
}

function hashBinding(receipt, collectionName, name, code, step) {
  const entry = receipt[collectionName].find((binding) => binding.name === name);
  if (!entry) failEvidence(code, step);
  return entry.sha256;
}

function snapshotDocuments(runnerResult, campaignId, receiptStore, subjectStore) {
  const step = "release-surface-snapshot";
  const receipts = new Map();
  for (const member of runnerResult.receiptSnapshot.members) {
    const validated = receiptStore.read(member.id);
    if (validated.bytes.length !== member.byteLength ||
        sha256(validated.bytes) !== member.wireSha256) {
      failEvidence("release_surface_snapshot_changed", step);
    }
    receipts.set(member.id, validated);
  }
  const subjects = new Map();
  for (const member of runnerResult.subjectSnapshot.members) {
    const validated = subjectStore.read(member.id);
    if (validated.bytes.length !== member.byteLength ||
        sha256(validated.bytes) !== member.wireSha256) {
      failEvidence("release_surface_snapshot_changed", step);
    }
    subjects.set(member.id, validated);
  }
  const supportedTypes = new Set(phaseInvalidationProfile.supportedPhaseReceiptTypes);
  const phaseReceiptBytes = [...receipts.values()]
    .filter((entry) => supportedTypes.has(entry.receipt.receiptType))
    .map((entry) => entry.bytes);
  if (phaseReceiptBytes.length === 0) {
    failEvidence("release_surface_phase_evidence_missing", step);
  }
  const phase = classifyVnextPhaseReceipts({
    campaignId,
    receiptBytes: phaseReceiptBytes
  });
  if (phase.result.health !== "healthy") {
    failEvidence("release_surface_phase_evidence_conflict", step);
  }
  return Object.freeze({
    phaseByReceiptId: new Map(phase.result.records.map((record) =>
      [record.receiptId, record])),
    receipts,
    subjects
  });
}

function requireSnapshotSubject(context, subjectId, schema, code, step) {
  const subject = context.subjects.get(subjectId);
  if (!subject || subject.schema !== schema) failEvidence(code, step);
  return subject;
}

function requireCurrentPassReceipt(context, receiptId, code, step) {
  const validated = context.receipts.get(receiptId);
  const phase = context.phaseByReceiptId.get(receiptId);
  if (!validated || !phase || phase.state !== "current-pass" ||
      validated.receipt.status !== "pass") {
    failEvidence(code, step);
  }
  return validated;
}

function validateReleaseEvidence(input, projection, context) {
  const step = "release-surface-evidence";
  const artifactSetSha256 = domainSeparatedDigest(
    parsedProfile.releasePreparation.artifactSetIdentityDomain,
    input.artifactManifestIds
  );
  const qualificationByArtifact = new Map();
  for (const receiptId of projection.countedEvidence.qualificationReceiptIds) {
    const validated = requireCurrentPassReceipt(
      context,
      receiptId,
      "release_surface_phase_evidence_not_current",
      step
    );
    const artifactId = publicParameter(validated.receipt, "artifact_id",
      "release_surface_artifact_coverage_invalid", step);
    if (validated.receipt.receiptType !== "qualification" ||
        validated.receipt.phase !== "qualification" ||
        qualificationByArtifact.has(artifactId)) {
      failEvidence("release_surface_artifact_coverage_invalid", step);
    }
    qualificationByArtifact.set(artifactId, receiptId);
  }
  if (qualificationByArtifact.size !== projection.counts.qualifiedModels.current) {
    failEvidence("release_surface_artifact_coverage_invalid", step);
  }

  const artifacts = input.artifactManifestIds.map((artifactId) => {
    const artifact = requireSnapshotSubject(
      context,
      artifactId,
      "tinyrustlm.vnext.artifact_manifest.v1",
      "release_surface_artifact_coverage_invalid",
      step
    );
    const value = artifact.value;
    if (value.artifactId !== artifactId ||
        value.provenanceReceiptId !== input.provenanceReceiptId ||
        compareUtc(value.createdAtUtc, input.verificationTimeUtc,
          "release_surface_artifact_time_invalid", step) > 0 ||
        value.dependencyArtifactIds.some((dependencyId) =>
          !input.artifactManifestIds.includes(dependencyId))) {
      failEvidence("release_surface_artifact_coverage_invalid", step);
    }
    const expectedQualification = qualificationByArtifact.get(artifactId);
    if (expectedQualification !== undefined &&
        value.qualificationReceiptId !== expectedQualification) {
      failEvidence("release_surface_artifact_coverage_invalid", step);
    }
    if (value.qualificationReceiptId !== null) {
      const qualification = requireCurrentPassReceipt(
        context,
        value.qualificationReceiptId,
        "release_surface_phase_evidence_not_current",
        step
      );
      if (qualification.receipt.receiptType !== "qualification" ||
          publicParameter(qualification.receipt, "artifact_id",
            "release_surface_artifact_coverage_invalid", step) !== artifactId) {
        failEvidence("release_surface_artifact_coverage_invalid", step);
      }
    }
    return artifact;
  });
  if ([...qualificationByArtifact.keys()].some((artifactId) =>
    !input.artifactManifestIds.includes(artifactId))) {
    failEvidence("release_surface_artifact_coverage_invalid", step);
  }
  const sboms = artifacts.filter((artifact) => artifact.value.artifactClass === "sbom");
  if (sboms.length !== 1 || sboms[0].subjectId !== input.sbomArtifactId ||
      sboms[0].value.formatProfile !== "cyclonedx-json-1.6" ||
      sboms[0].value.qualificationReceiptId !== null) {
    failEvidence("release_surface_sbom_invalid", step);
  }
  const artifactsById = new Map(artifacts.map((artifact) =>
    [artifact.subjectId, artifact]));
  const requiredArtifactIds = new Set([
    ...qualificationByArtifact.keys(),
    input.sbomArtifactId
  ]);
  const pendingArtifactIds = [...requiredArtifactIds];
  while (pendingArtifactIds.length > 0) {
    const artifactId = pendingArtifactIds.pop();
    const artifact = artifactsById.get(artifactId);
    if (!artifact) failEvidence("release_surface_artifact_coverage_invalid", step);
    for (const dependencyId of artifact.value.dependencyArtifactIds) {
      if (requiredArtifactIds.has(dependencyId)) continue;
      requiredArtifactIds.add(dependencyId);
      pendingArtifactIds.push(dependencyId);
    }
  }
  if (!sameStrings([...requiredArtifactIds].sort(), input.artifactManifestIds)) {
    failEvidence("release_surface_artifact_coverage_invalid", step);
  }
  const provenance = requireCurrentPassReceipt(
    context,
    input.provenanceReceiptId,
    "release_surface_phase_evidence_not_current",
    step
  );
  if (provenance.receipt.receiptType !== "review" ||
      provenance.receipt.phase !== "release-provenance" ||
      provenance.receipt.sourceRevision !== input.sourceRevision ||
      hashBinding(provenance.receipt, "inputHashes", "release-artifact-set",
        "release_surface_provenance_binding_invalid", step) !== artifactSetSha256 ||
      !provenance.receipt.outputHashes.some((entry) =>
        entry.name === "provenance-statement") ||
      !input.artifactManifestIds.includes(publicParameter(
        provenance.receipt,
        "subject_id",
        "release_surface_provenance_binding_invalid",
        step
      ))) {
    failEvidence("release_surface_provenance_binding_invalid", step);
  }
  const packages = input.packageReceiptIds.map((receiptId) => {
    const validated = requireCurrentPassReceipt(
      context,
      receiptId,
      "release_surface_phase_evidence_not_current",
      step
    );
    if (validated.receipt.receiptType !== "package" ||
        validated.receipt.phase !== "package" ||
        validated.receipt.sourceRevision !== input.sourceRevision ||
        hashBinding(validated.receipt, "inputHashes", "release-artifact-set",
          "release_surface_package_binding_invalid", step) !== artifactSetSha256 ||
        !validated.receipt.outputHashes.some((entry) => entry.name === "release-package") ||
        !input.artifactManifestIds.includes(publicParameter(
          validated.receipt,
          "subject_id",
          "release_surface_package_binding_invalid",
          step
        ))) {
      failEvidence("release_surface_package_binding_invalid", step);
    }
    return validated;
  });
  return Object.freeze({ artifactSetSha256, artifacts, packages, provenance });
}

function claimKey(claim) {
  return [claim.siteId, claim.route, claim.component, claim.wordingClass].join("\u0000");
}

function validateReleaseClaims(input, context) {
  const step = "release-surface-claims";
  const claims = [...context.subjects.values()].filter((entry) =>
    entry.schema === "tinyrustlm.vnext.claim.v2");
  const byId = new Map(claims.map((entry) => [entry.subjectId, entry]));
  const superseded = new Set();
  const edges = new Map();
  for (const entry of claims) {
    edges.set(entry.subjectId, [...entry.value.supersedesClaimIds]);
    for (const targetId of entry.value.supersedesClaimIds) {
      const target = byId.get(targetId);
      if (!target || targetId === entry.subjectId ||
          claimKey(target.value) !== claimKey(entry.value)) {
        failEvidence("release_surface_claim_history_invalid", step);
      }
      superseded.add(targetId);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(claimId) {
    if (visited.has(claimId)) return;
    if (visiting.has(claimId)) failEvidence("release_surface_claim_history_invalid", step);
    visiting.add(claimId);
    for (const targetId of edges.get(claimId) ?? []) visit(targetId);
    visiting.delete(claimId);
    visited.add(claimId);
  }
  for (const claimId of edges.keys()) visit(claimId);

  const current = claims.filter((entry) => !superseded.has(entry.subjectId));
  const currentByKey = new Map();
  for (const entry of current) {
    const key = claimKey(entry.value);
    if (currentByKey.has(key)) failEvidence("release_surface_claim_conflict", step);
    currentByKey.set(key, entry.subjectId);
  }
  const approved = current.filter((entry) =>
    entry.value.status === "approved-for-publication" &&
      entry.value.sourceRevision === input.sourceRevision)
    .map((entry) => entry.subjectId).sort();
  if (!sameStrings(approved, input.claimIds)) {
    failEvidence("release_surface_claim_selection_invalid", step);
  }
  return input.claimIds.map((claimId) => {
    const entry = requireSnapshotSubject(
      context,
      claimId,
      "tinyrustlm.vnext.claim.v2",
      "release_surface_claim_selection_invalid",
      step
    );
    const claim = entry.value;
    if (!context.subjects.has(claim.subjectId) || claim.releaseId !== null ||
        claim.blockerCodes.length !== 0 ||
        compareUtc(claim.effectiveAtUtc, input.verificationTimeUtc,
          "release_surface_claim_not_current", step) > 0 ||
        compareUtc(claim.lastVerifiedAtUtc, input.verificationTimeUtc,
          "release_surface_claim_not_current", step) > 0 ||
        claim.expiresAtUtc !== null && compareUtc(
          input.verificationTimeUtc,
          claim.expiresAtUtc,
          "release_surface_claim_not_current",
          step
        ) >= 0 ||
        compareUtc(input.verificationTimeUtc, claim.reviewAtUtc,
          "release_surface_claim_not_current", step) >= 0) {
      failEvidence("release_surface_claim_not_current", step);
    }
    for (const evidenceReceiptId of claim.evidenceReceiptIds) {
      const evidence = requireCurrentPassReceipt(
        context,
        evidenceReceiptId,
        "release_surface_phase_evidence_not_current",
        step
      );
      if (compareUtc(evidence.receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_claim_evidence_time_invalid", step) > 0) {
        failEvidence("release_surface_claim_evidence_time_invalid", step);
      }
    }
    return entry;
  });
}

function assertStoreMembership(receiptStore, subjectStore, expectedReceiptIds,
  expectedSubjectIds, step) {
  const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
  const currentSubjectIds = subjectStore.rebuild().activeSubjectIds;
  const expectedReceipts = [...new Set(expectedReceiptIds)].sort();
  const expectedSubjects = [...new Set(expectedSubjectIds)].sort();
  if (!sameStrings(currentReceiptIds, expectedReceipts)) {
    const code = currentReceiptIds.length < expectedReceipts.length
      ? "release_surface_receipt_snapshot_member_missing"
      : currentReceiptIds.length > expectedReceipts.length
        ? "release_surface_receipt_snapshot_member_unexpected"
        : "release_surface_receipt_snapshot_identity_changed";
    failEvidence(code, step);
  }
  if (!sameStrings(currentSubjectIds, expectedSubjects)) {
    const code = currentSubjectIds.length < expectedSubjects.length
      ? "release_surface_subject_snapshot_member_missing"
      : currentSubjectIds.length > expectedSubjects.length
        ? "release_surface_subject_snapshot_member_unexpected"
        : "release_surface_subject_snapshot_identity_changed";
    failEvidence(code, step);
  }
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

function immutableReleasePreparationResult(value, buffers) {
  const result = { ...value };
  for (const [name, bytes] of Object.entries(buffers)) {
    const canonical = Buffer.from(bytes);
    Object.defineProperty(result, name, {
      enumerable: true,
      get() {
        return Buffer.from(canonical);
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

  async function executeAttestation(input) {
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
    return Object.freeze({
      attestation,
      attestationPersistence,
      input,
      projection: validatedProjection.result,
      redactionPersistence,
      redactionReceipt,
      runnerResult,
      scan,
      status
    });
  }

  function publicAttestationResult(execution) {
    const { attestation, attestationPersistence, input, projection,
      redactionPersistence, redactionReceipt, runnerResult, scan, status } = execution;
    return immutableAttestationResult({
      operationId: input.operationId,
      projectionResultSha256: runnerResult.projectionResultSha256,
      startedRecordId: runnerResult.startedRecordId,
      terminalRecordId: runnerResult.terminalRecordId,
      campaignComplete: projection.complete,
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

  async function attestCampaign(rawInput) {
    return publicAttestationResult(await executeAttestation(normalizeInput(rawInput)));
  }

  function persistReleaseScan(input, campaignId, scan, label) {
    const receipt = createVnextRedactionScanReceipt({
      attemptId: `${label}-${input.operationId.slice("sha256:".length)}`,
      campaignId,
      completedAtUtc: input.verificationTimeUtc,
      scan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: input.verificationTimeUtc
    });
    const persistence = receiptStore.put(receipt.bytes);
    return Object.freeze({ persistence, receipt });
  }

  function scanReleaseDocuments(input, campaignId, documents) {
    const seen = new Set();
    for (const document of documents) {
      const wireSha256 = sha256(document.bytes);
      if (seen.has(wireSha256)) continue;
      seen.add(wireSha256);
      const scan = scanVnextPublicDocumentBytes(document.bytes, {
        knownSecrets: input.knownSecrets
      });
      if (!scan.publicSafe) {
        persistReleaseScan(input, campaignId, scan, "release-input-redaction");
        failEvidence("release_surface_public_input_unsafe", "release-surface-redaction");
      }
    }
  }

  async function prepareRelease(rawInput) {
    const input = normalizePrepareInput(rawInput);
    const execution = await executeAttestation(input);
    const { attestation, projection, redactionReceipt: attestationRedaction,
      runnerResult, scan: attestationScan } = execution;
    if (!projection.complete) {
      failEvidence("release_surface_campaign_incomplete", "release-surface-prepare");
    }
    if (!attestationScan.publicSafe) {
      failEvidence("release_surface_attestation_unsafe", "release-surface-prepare");
    }

    const context = snapshotDocuments(
      runnerResult,
      projection.campaignId,
      receiptStore,
      subjectStore
    );
    const evidence = validateReleaseEvidence(input, projection, context);
    const claims = validateReleaseClaims(input, context);
    const selectedDocuments = [
      ...evidence.artifacts,
      ...evidence.packages,
      evidence.provenance,
      ...claims
    ];
    const selectedReceiptIds = new Set();
    for (const artifact of evidence.artifacts) {
      if (artifact.value.qualificationReceiptId !== null) {
        selectedReceiptIds.add(artifact.value.qualificationReceiptId);
      }
    }
    for (const claim of claims) {
      for (const receiptId of claim.value.evidenceReceiptIds) {
        selectedReceiptIds.add(receiptId);
      }
    }
    for (const receiptId of selectedReceiptIds) {
      selectedDocuments.push(context.receipts.get(receiptId));
    }
    scanReleaseDocuments(input, projection.campaignId, selectedDocuments);

    const changelogScan = scanVnextPublicTextBytes(input.changelogBytes, {
      knownSecrets: input.knownSecrets
    });
    const changelogRedaction = persistReleaseScan(
      input,
      projection.campaignId,
      changelogScan,
      "release-changelog-redaction"
    );
    if (!changelogScan.publicSafe) {
      failEvidence("release_surface_public_input_unsafe", "release-surface-redaction");
    }

    const release = finalizeVnextIdentityDocument({
      schema: parsedProfile.releasePreparation.manifestSchema,
      productId: input.productId,
      version: input.version,
      releaseDate: input.verificationTimeUtc.slice(0, 10),
      sourceRevision: input.sourceRevision,
      campaignPlanSha256: projection.campaignPlanSha256,
      campaignProjectionSha256: runnerResult.projectionResultSha256,
      campaignAttestationReceiptId: attestation.receipt.receiptId,
      artifactManifestIds: [...input.artifactManifestIds],
      packageReceiptIds: [...input.packageReceiptIds],
      claimIds: [...input.claimIds],
      sbomArtifactId: input.sbomArtifactId,
      provenanceReceiptId: input.provenanceReceiptId,
      changelogSha256: changelogScan.result.sourceSha256,
      remainingRiskCodes: [...input.remainingRiskCodes],
      createdAtUtc: input.verificationTimeUtc,
      redaction: {
        profile: "tinyrustlm.vnext.public_safe.v1",
        decision: "public-safe"
      }
    });
    if (release.bytes.length > parsedProfile.limits.maximumReleaseManifestBytes) {
      failEvidence("release_surface_manifest_byte_limit", "release-surface-manifest");
    }
    const releaseScan = scanVnextPublicDocumentBytes(release.bytes, {
      knownSecrets: input.knownSecrets
    });
    const baseReceiptIds = runnerResult.receiptSnapshot.members.map((member) => member.id);
    const baseSubjectIds = runnerResult.subjectSnapshot.members.map((member) => member.id);
    const receiptsBeforeReleaseScan = [
      ...baseReceiptIds,
      attestation.receipt.receiptId,
      attestationRedaction.receipt.receiptId,
      changelogRedaction.receipt.receipt.receiptId
    ];
    assertStoreMembership(
      receiptStore,
      subjectStore,
      receiptsBeforeReleaseScan,
      baseSubjectIds,
      "release-surface-before-release-redaction"
    );
    const releaseRedaction = persistReleaseScan(
      input,
      projection.campaignId,
      releaseScan,
      "release-manifest-redaction"
    );
    if (!releaseScan.publicSafe) {
      failEvidence("release_surface_manifest_unsafe", "release-surface-redaction");
    }
    const receiptsBeforeManifest = [
      ...receiptsBeforeReleaseScan,
      releaseRedaction.receipt.receipt.receiptId
    ];
    assertStoreMembership(
      receiptStore,
      subjectStore,
      receiptsBeforeManifest,
      baseSubjectIds,
      "release-surface-before-manifest"
    );
    const releasePersistence = subjectStore.put(release.bytes);
    assertStoreMembership(
      receiptStore,
      subjectStore,
      receiptsBeforeManifest,
      [...baseSubjectIds, release.subjectId],
      "release-surface-after-manifest"
    );
    const readback = subjectStore.read(release.subjectId);
    if (!readback.bytes.equals(release.bytes)) {
      failEvidence("release_surface_manifest_readback_mismatch",
        "release-surface-manifest");
    }
    return immutableReleasePreparationResult({
      operationId: input.operationId,
      projectionResultSha256: runnerResult.projectionResultSha256,
      startedRecordId: runnerResult.startedRecordId,
      terminalRecordId: runnerResult.terminalRecordId,
      campaignComplete: true,
      releasePrepared: true,
      authorizationStatus: "not-authorized",
      state: parsedProfile.releasePreparation.preparedState,
      attestationReceiptId: attestation.receipt.receiptId,
      attestationRedactionReceiptId: attestationRedaction.receipt.receiptId,
      changelogRedactionReceiptId: changelogRedaction.receipt.receipt.receiptId,
      releaseManifestId: release.subjectId,
      releaseManifestSha256: release.canonicalContentSha256,
      releaseRedactionReceiptId: releaseRedaction.receipt.receipt.receiptId,
      attestationPersistence: execution.attestationPersistence,
      attestationRedactionPersistence: execution.redactionPersistence,
      changelogRedactionPersistence: changelogRedaction.persistence,
      releasePersistence,
      releaseRedactionPersistence: releaseRedaction.persistence
    }, {
      projectionResultBytes: runnerResult.projectionResultBytes,
      attestationReceiptBytes: attestation.bytes,
      attestationRedactionReceiptBytes: attestationRedaction.bytes,
      changelogBytes: changelogScan.outputBytes,
      changelogRedactionReceiptBytes: changelogRedaction.receipt.bytes,
      releaseManifestBytes: release.bytes,
      releaseRedactionReceiptBytes: releaseRedaction.receipt.bytes
    });
  }

  return Object.freeze({
    attestCampaign,
    prepareRelease,
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
