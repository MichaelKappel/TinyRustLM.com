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
  finalizeVnextReceipt,
  validateVnextReceiptBytes
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
  scanVnextPublicTextBytes,
  verifyVnextRedactionScanReceipt
} = require("./vnext-public-safe-redaction.js");
const {
  signatureProfile,
  signatureProfileSha256
} = require("./vnext-signature-payload.js");
const {
  verifyVnextAuthorityGraph
} = require("./vnext-signature-authority.js");
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
  "publicOrigin",
  "webBuildReceiptId",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes",
  "webAssets",
  "generatedPublicationFiles",
  "retiredPublicPaths",
  "offlineCapability",
  "serviceWorkerPath",
  "remainingRiskCodes",
  "sbomArtifactId",
  "version"
]);
const authorizeInputFields = Object.freeze([
  "authorizationReceiptBytes",
  "changelogBytes",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "knownSecrets",
  "releaseManifestId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const deploymentInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptBytes",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "knownSecrets",
  "releaseManifestId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
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
  "publicSafeRedactionProfileSha256", "receiptSignatureProfileId",
  "receiptSignatureProfileSha256", "canonicalJsonProfile", "hashAlgorithm",
  "campaignTruthInput", "operationPolicy", "storedProjectionPolicy",
  "callerVerdictPolicy", "callerCounterPolicy", "mutablePointerPolicy",
  "networkAccess", "clockAccess", "sourceMutation", "attestation",
  "operatorStatus", "releasePreparation", "releaseAuthorization",
  "releaseDeployment", "limits"
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
  "webBuildBinding", "webAssetInventoryIdentityDomain", "webAssetPolicy",
  "generatedPublicationPolicy", "retirementPolicy", "offlinePolicy",
  "selfReferencePolicy",
  "releaseDatePolicy", "redactionPolicy", "persistencePolicy",
  "unsafePersistence"
]);
const releaseAuthorizationProfileFields = Object.freeze([
  "resultSchema", "authorizedState", "manifestPolicy", "lineagePolicy",
  "signatureReceiptType", "role", "signatureDomain", "scope", "signedSchema",
  "releaseIdPolicy", "authorityPolicy", "registryPolicy", "timePolicy",
  "redactionPolicy", "persistencePolicy", "callerDecisionPolicy"
]);
const releaseDeploymentProfileFields = Object.freeze([
  "resultSchema", "admittedState", "receiptType", "phase", "status",
  "evidenceScope", "manifestPolicy", "authorizationPolicy", "receiptPolicy",
  "inputReceiptPolicy", "inputHashPolicy", "outputHashPolicy", "runtimePolicy",
  "timePolicy", "redactionPolicy", "persistencePolicy", "callerSuccessPolicy",
  "publicReadbackPolicy"
]);
const limitFields = Object.freeze([
  "maximumKnownSecrets", "maximumProjectionBytes", "maximumReceiptSnapshotMembers",
  "maximumSubjectSnapshotMembers", "maximumOperatorStatusBytes",
  "maximumBlockerCodes", "maximumCountRows", "maximumReleaseArtifactManifests",
  "maximumReleasePackageReceipts", "maximumReleaseClaims",
  "maximumRemainingRiskCodes", "maximumChangelogBytes",
  "maximumWebAssets", "maximumGeneratedPublicationFiles",
  "maximumRetiredPublicPaths", "maximumWebControlDocumentBytes",
  "maximumWebTotalBytes",
  "maximumReleaseManifestBytes", "maximumAuthorizationReceiptBytes",
  "maximumAuthorizationResultBytes", "maximumDeploymentReceiptBytes",
  "maximumDeploymentResultBytes"
]);
const operatorFields = Object.freeze([
  "attestationReceiptId", "blockerCodes", "campaignId", "counts", "environment",
  "operationId", "projectionResultSha256", "redactionReceiptId", "releaseEligible",
  "resumableState", "schema", "startedRecordId", "state", "terminalRecordId",
  "verificationTimeUtc"
]);
const webAssetFields = Object.freeze([
  "byteLength", "cachePolicy", "contentType", "path", "role", "securityHeaderProfileSha256",
  "sha256"
]);
const generatedPublicationFileFields = Object.freeze([
  "cachePolicy", "contentType", "path", "role", "securityHeaderProfileSha256"
]);
const webAssetRoles = Object.freeze([
  "application", "bootstrap", "documentation", "runtime", "runtime-metadata",
  "service-worker", "style"
]);
const webContentTypes = Object.freeze([
  "application/javascript", "application/json", "application/manifest+json",
  "application/octet-stream", "application/wasm", "font/woff2", "image/avif",
  "image/png", "image/svg+xml", "image/webp", "text/css", "text/html", "text/plain"
]);
const webCachePolicies = Object.freeze(["immutable", "no-cache", "no-store"]);
const publicPathPattern = /^\/(?!\/)[\x21-\x3e\x40-\x5a\x5e-\x7e]*$/u;

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

function requirePublicPath(value, code, step) {
  if (typeof value !== "string" || value.length > 2048 ||
      !publicPathPattern.test(value) || /[?#\\]/u.test(value) ||
      /%(?:2e|2f|5c)/iu.test(value) || value.split("/").some((segment) =>
        segment === "." || segment === "..")) {
    failEvidence(code, step);
  }
  return value;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    first === 100 && second >= 64 && second <= 127 ||
    first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 ||
    first === 192 && second === 168 || first >= 224;
}

function isPrivateIpv6(hostname) {
  const value = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fc") ||
    value.startsWith("fd") || /^fe[89ab]/u.test(value) || value.startsWith("ff");
}

function normalizePublicOrigin(value, code, step) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    failEvidence(code, step);
  }
  if (typeof value !== "string" || value.length > 2048 || parsed.protocol !== "https:" ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.pathname !== "/" || parsed.href !== value ||
      parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost") ||
      isPrivateIpv4(parsed.hostname) ||
      parsed.hostname.includes(":") && isPrivateIpv6(parsed.hostname)) {
    failEvidence(code, step);
  }
  return value;
}

function normalizeWebAssets(value, headerProfileSha256, step) {
  const entries = dataArray(value, parsedProfile.limits.maximumWebAssets,
    "release_surface_web_assets_invalid", step);
  if (entries.length === 0) failEvidence("release_surface_web_assets_invalid", step);
  const normalized = entries.map((entry) => {
    const asset = exactDataObject(entry, webAssetFields,
      "release_surface_web_assets_invalid", step);
    requirePublicPath(asset.path, "release_surface_web_assets_invalid", step);
    if (!webAssetRoles.includes(asset.role) ||
        !Number.isSafeInteger(asset.byteLength) || asset.byteLength < 1 ||
        asset.byteLength > parsedProfile.limits.maximumWebTotalBytes ||
        !digestPattern.test(asset.sha256) || !webContentTypes.includes(asset.contentType) ||
        !webCachePolicies.includes(asset.cachePolicy) ||
        asset.securityHeaderProfileSha256 !== headerProfileSha256) {
      failEvidence("release_surface_web_assets_invalid", step);
    }
    return Object.freeze({ ...asset });
  });
  if (normalized.some((entry, index) => index > 0 &&
      normalized[index - 1].path >= entry.path)) {
    failEvidence("release_surface_web_assets_invalid", step);
  }
  return Object.freeze(normalized);
}

function normalizeGeneratedPublicationFiles(value, headerProfileSha256, step) {
  const entries = dataArray(value,
    parsedProfile.limits.maximumGeneratedPublicationFiles,
    "release_surface_generated_files_invalid", step);
  if (entries.length !== parsedProfile.limits.maximumGeneratedPublicationFiles) {
    failEvidence("release_surface_generated_files_invalid", step);
  }
  const normalized = entries.map((entry) => {
    const generated = exactDataObject(entry, generatedPublicationFileFields,
      "release_surface_generated_files_invalid", step);
    requirePublicPath(generated.path, "release_surface_generated_files_invalid", step);
    if (!["current-release-pointer", "release-history"].includes(generated.role) ||
        generated.contentType !== "application/json" ||
        generated.cachePolicy !== "no-store" ||
        generated.securityHeaderProfileSha256 !== headerProfileSha256) {
      failEvidence("release_surface_generated_files_invalid", step);
    }
    return Object.freeze({ ...generated });
  });
  if (normalized.some((entry, index) => index > 0 &&
      normalized[index - 1].path >= entry.path)) {
    failEvidence("release_surface_generated_files_invalid", step);
  }
  return Object.freeze(normalized);
}

function normalizeWebControlBytes(value, code, step) {
  if (!Buffer.isBuffer(value) || value.length === 0 ||
      value.length > parsedProfile.limits.maximumWebControlDocumentBytes) {
    failEvidence(code, step);
  }
  return Buffer.from(value);
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
  exactDataObject(parsedProfile.releaseAuthorization, releaseAuthorizationProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.releaseDeployment, releaseDeploymentProfileFields,
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
      parsedProfile.receiptSignatureProfileId !== signatureProfile.profileId ||
      parsedProfile.receiptSignatureProfileSha256 !== signatureProfileSha256 ||
      parsedProfile.canonicalJsonProfile !== "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.campaignTruthInput !==
        "fresh-sole-runner-return-created-and-consumed-inside-one-surface-call" ||
      parsedProfile.operationPolicy !== "never-before-used-operation-id-only" ||
      parsedProfile.storedProjectionPolicy !== "forbidden" ||
      parsedProfile.callerVerdictPolicy !== "forbidden" ||
      parsedProfile.callerCounterPolicy !== "forbidden" ||
      parsedProfile.mutablePointerPolicy !== "forbidden" ||
      parsedProfile.networkAccess !== "forbidden-until-public-readback-operation" ||
      parsedProfile.clockAccess !== "caller-trusted-verification-time-only" ||
      parsedProfile.sourceMutation !==
        "create-only-attestation-redaction-release-manifest-authorization-signature-and-deployment-attempt-receipts" ||
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
        "tinyrustlm.vnext.release_manifest.v3" ||
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
      parsedProfile.releasePreparation.webBuildBinding !==
        "current-pass-build-receipt-binds-source-revision-control-documents-changelog-and-exact-asset-inventory" ||
      parsedProfile.releasePreparation.webAssetInventoryIdentityDomain !==
        "tinyrustlm.web-asset-inventory.v1" ||
      parsedProfile.releasePreparation.webAssetPolicy !==
        "closed-sorted-path-disjoint-static-asset-graph-with-exact-hash-size-type-cache-header-profile-and-content-addressed-immutable-paths" ||
      parsedProfile.releasePreparation.generatedPublicationPolicy !==
        "pointer-and-history-paths-bound-before-identity-final-generated-by-bound-profile-and-byte-bound-only-in-site-publication-descendants" ||
      parsedProfile.releasePreparation.retirementPolicy !==
        "sorted-disjoint-negative-route-set" ||
      parsedProfile.releasePreparation.offlinePolicy !==
        "network-only-forbids-service-worker-service-worker-staged-requires-one-exact-worker" ||
      parsedProfile.releasePreparation.selfReferencePolicy !==
        "manifest-own-wire-and-generated-publication-wires-are-forward-only-site-publisher-descendants" ||
      parsedProfile.releasePreparation.releaseDatePolicy !==
        "trusted-verification-time-calendar-date" ||
      parsedProfile.releasePreparation.redactionPolicy !==
        "scan-selected-public-documents-changelog-and-final-manifest" ||
      parsedProfile.releasePreparation.persistencePolicy !==
        "redaction-receipts-before-create-only-release-manifest" ||
      parsedProfile.releasePreparation.unsafePersistence !==
        "release-manifest-forbidden" ||
      parsedProfile.releaseAuthorization.resultSchema !==
        "tinyrustlm.vnext.release_authorization_result.v1" ||
      parsedProfile.releaseAuthorization.authorizedState !==
        "release-authorized-awaiting-deployment" ||
      parsedProfile.releaseAuthorization.manifestPolicy !==
        "existing-current-prepared-manifest-only" ||
      parsedProfile.releaseAuthorization.lineagePolicy !==
        "exact-runner-snapshot-plus-preparation-descendants" ||
      parsedProfile.releaseAuthorization.signatureReceiptType !== "signature-envelope" ||
      parsedProfile.releaseAuthorization.role !== "release-authorizer" ||
      parsedProfile.releaseAuthorization.signatureDomain !==
        "tinyrustlm.signature.release-authorizer.v1" ||
      parsedProfile.releaseAuthorization.scope !== "release-authorization" ||
      parsedProfile.releaseAuthorization.signedSchema !==
        "tinyrustlm.vnext.release_manifest.v3" ||
      parsedProfile.releaseAuthorization.releaseIdPolicy !==
        "must-equal-signed-subject-id" ||
      parsedProfile.releaseAuthorization.authorityPolicy !==
        "exactly-one-current-evidence-eligible-signature" ||
      parsedProfile.releaseAuthorization.registryPolicy !==
        "caller-pinned-root-and-terminal" ||
      parsedProfile.releaseAuthorization.timePolicy !==
        "trusted-verification-time-and-finite-profile-lifetime" ||
      parsedProfile.releaseAuthorization.redactionPolicy !==
        "replay-preparation-scans-and-scan-authorization-before-persistence" ||
      parsedProfile.releaseAuthorization.persistencePolicy !==
        "authorization-redaction-before-create-only-signature-receipt" ||
      parsedProfile.releaseAuthorization.callerDecisionPolicy !== "forbidden" ||
      parsedProfile.releaseDeployment.resultSchema !==
        "tinyrustlm.vnext.release_deployment_admission_result.v1" ||
      parsedProfile.releaseDeployment.admittedState !==
        "deployment-attempt-admitted-awaiting-public-readback" ||
      parsedProfile.releaseDeployment.receiptType !== "deployment" ||
      parsedProfile.releaseDeployment.phase !== "deployment" ||
      parsedProfile.releaseDeployment.status !== "pass" ||
      parsedProfile.releaseDeployment.evidenceScope !== "deployment-attempt-only" ||
      parsedProfile.releaseDeployment.manifestPolicy !==
        "existing-current-authorized-manifest-only" ||
      parsedProfile.releaseDeployment.authorizationPolicy !==
        "exactly-one-stored-current-evidence-eligible-release-authorizer-signature" ||
      parsedProfile.releaseDeployment.receiptPolicy !==
        "externally-produced-canonical-receipt-with-closed-lineage-and-no-success-claim" ||
      parsedProfile.releaseDeployment.inputReceiptPolicy !==
        "exact-current-web-build-phase-parent-attestation-reference-and-authorization-receipt-reference" ||
      parsedProfile.releaseDeployment.inputHashPolicy !==
        "exact-release-manifest-web-inventory-deployment-manifest-publication-generator-and-security-header-profile" ||
      parsedProfile.releaseDeployment.outputHashPolicy !==
        "exact-submitted-web-inventory-plus-bounded-public-safe-attempt-transcript-digest" ||
      parsedProfile.releaseDeployment.runtimePolicy !==
        "deployment-execution-class-only" ||
      parsedProfile.releaseDeployment.timePolicy !==
        "attempt-after-authorization-and-not-after-trusted-verification-time" ||
      parsedProfile.releaseDeployment.redactionPolicy !==
        "scan-final-canonical-deployment-receipt-before-persistence" ||
      parsedProfile.releaseDeployment.persistencePolicy !==
        "deployment-redaction-before-create-only-deployment-receipt" ||
      parsedProfile.releaseDeployment.callerSuccessPolicy !== "forbidden" ||
      parsedProfile.releaseDeployment.publicReadbackPolicy !==
        "required-before-any-deployed-or-published-claim" ||
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
      parsedProfile.limits.maximumWebAssets !== 512 ||
      parsedProfile.limits.maximumGeneratedPublicationFiles !== 2 ||
      parsedProfile.limits.maximumRetiredPublicPaths !== 128 ||
      parsedProfile.limits.maximumWebControlDocumentBytes !== 1_048_576 ||
      parsedProfile.limits.maximumWebTotalBytes !== 68_719_476_736 ||
      parsedProfile.limits.maximumReleaseManifestBytes !==
        identityContractForSchema(parsedProfile.releasePreparation.manifestSchema)
          .maximumBytes ||
      parsedProfile.limits.maximumAuthorizationReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
      parsedProfile.limits.maximumDeploymentReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
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
  const webDeploymentManifestBytes = normalizeWebControlBytes(
    input.webDeploymentManifestBytes,
    "release_surface_web_deployment_manifest_invalid",
    step
  );
  const webSecurityHeaderProfileBytes = normalizeWebControlBytes(
    input.webSecurityHeaderProfileBytes,
    "release_surface_web_security_headers_invalid",
    step
  );
  const webPublicationGeneratorBytes = normalizeWebControlBytes(
    input.webPublicationGeneratorBytes,
    "release_surface_web_publication_generator_invalid",
    step
  );
  const webSecurityHeaderProfileSha256 = sha256(webSecurityHeaderProfileBytes);
  const webAssets = normalizeWebAssets(
    input.webAssets,
    webSecurityHeaderProfileSha256,
    step
  );
  const generatedPublicationFiles = normalizeGeneratedPublicationFiles(
    input.generatedPublicationFiles,
    webSecurityHeaderProfileSha256,
    step
  );
  const retiredPublicPaths = sortedUniqueStringArray(
    input.retiredPublicPaths,
    parsedProfile.limits.maximumRetiredPublicPaths,
    0,
    publicPathPattern,
    "release_surface_retired_paths_invalid",
    step
  );
  retiredPublicPaths.forEach((entry) => requirePublicPath(
    entry,
    "release_surface_retired_paths_invalid",
    step
  ));
  normalizePublicOrigin(input.publicOrigin, "release_surface_public_origin_invalid", step);
  if (input.serviceWorkerPath !== null) {
    requirePublicPath(input.serviceWorkerPath,
      "release_surface_offline_capability_invalid", step);
  }
  const activePaths = [
    ...webAssets.map((entry) => entry.path),
    ...generatedPublicationFiles.map((entry) => entry.path)
  ];
  const modelPath = (entry) => entry.toLowerCase().includes("/models/") ||
    /\.(?:acg1|acg2|gguf|safetensors|slm)$/u.test(entry.toLowerCase());
  const bootstraps = webAssets.filter((entry) => entry.role === "bootstrap");
  const workers = webAssets.filter((entry) => entry.role === "service-worker");
  const generatedByRole = new Map(generatedPublicationFiles.map((entry) =>
    [entry.role, entry]));
  const webTotalBytes = webAssets.reduce((total, entry) => total + entry.byteLength, 0);
  if (new Set(activePaths).size !== activePaths.length ||
      retiredPublicPaths.some((entry) => activePaths.includes(entry)) ||
      activePaths.some(modelPath) ||
      webAssets.some((entry) => entry.cachePolicy === "immutable" &&
        !entry.path.includes(entry.sha256)) ||
      webTotalBytes > parsedProfile.limits.maximumWebTotalBytes ||
      bootstraps.length !== 1 || bootstraps[0].path !== "/" ||
      bootstraps[0].contentType !== "text/html" ||
      bootstraps[0].cachePolicy !== "no-store" ||
      generatedByRole.size !== 2 ||
      generatedByRole.get("current-release-pointer")?.path !==
        "/.well-known/site-release.json" ||
      generatedByRole.get("release-history")?.path !==
        "/.well-known/site-release-history.json" ||
      !["network-only", "service-worker-staged"].includes(input.offlineCapability) ||
      input.offlineCapability === "network-only" &&
        (input.serviceWorkerPath !== null || workers.length !== 0) ||
      input.offlineCapability === "service-worker-staged" &&
        (input.serviceWorkerPath === null || workers.length !== 1 ||
          workers[0].path !== input.serviceWorkerPath ||
          workers[0].contentType !== "application/javascript" ||
          workers[0].cachePolicy !== "no-cache")) {
    failEvidence("release_surface_web_graph_invalid", step);
  }
  if (!digestPattern.test(input.campaignPlanSha256) ||
      !contentIdPattern.test(input.operationId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.sbomArtifactId) ||
      !contentIdPattern.test(input.provenanceReceiptId) ||
      !contentIdPattern.test(input.webBuildReceiptId) ||
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
    generatedPublicationFiles,
    knownSecrets,
    packageReceiptIds,
    remainingRiskCodes,
    retiredPublicPaths,
    webAssets,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes,
    webSecurityHeaderProfileSha256,
    webTotalBytes
  });
}

function normalizeAuthorizeInput(rawInput) {
  const step = "release-surface-authorize-input";
  const input = exactDataObject(rawInput, authorizeInputFields,
    "release_surface_authorize_input_invalid", step);
  const knownSecrets = dataArray(input.knownSecrets,
    parsedProfile.limits.maximumKnownSecrets,
    "release_surface_known_secrets_invalid", step);
  scanKnownSecretRepresentations(Buffer.from("{}", "utf8"), knownSecrets);
  const webDeploymentManifestBytes = normalizeWebControlBytes(
    input.webDeploymentManifestBytes,
    "release_surface_web_deployment_manifest_invalid",
    step
  );
  const webSecurityHeaderProfileBytes = normalizeWebControlBytes(
    input.webSecurityHeaderProfileBytes,
    "release_surface_web_security_headers_invalid",
    step
  );
  const webPublicationGeneratorBytes = normalizeWebControlBytes(
    input.webPublicationGeneratorBytes,
    "release_surface_web_publication_generator_invalid",
    step
  );
  if (!Buffer.isBuffer(input.authorizationReceiptBytes) ||
      input.authorizationReceiptBytes.length === 0 ||
      input.authorizationReceiptBytes.length >
        parsedProfile.limits.maximumAuthorizationReceiptBytes ||
      !Buffer.isBuffer(input.changelogBytes) || input.changelogBytes.length === 0 ||
      input.changelogBytes.length > parsedProfile.limits.maximumChangelogBytes ||
      typeof input.expectedCampaignId !== "string" ||
      !safeIdPattern.test(input.expectedCampaignId) ||
      !["development", "production", "staging"].includes(input.expectedEnvironment) ||
      !contentIdPattern.test(input.expectedTerminalRegistryReceiptId) ||
      !contentIdPattern.test(input.releaseManifestId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
      utcNanoseconds(input.verificationTimeUtc) === null) {
    failEvidence("release_surface_authorize_input_invalid", step);
  }
  return Object.freeze({
    ...input,
    authorizationReceiptBytes: Buffer.from(input.authorizationReceiptBytes),
    changelogBytes: Buffer.from(input.changelogBytes),
    knownSecrets,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  });
}

function normalizeDeploymentInput(rawInput) {
  const step = "release-surface-deployment-input";
  const input = exactDataObject(rawInput, deploymentInputFields,
    "release_surface_deployment_input_invalid", step);
  const knownSecrets = dataArray(input.knownSecrets,
    parsedProfile.limits.maximumKnownSecrets,
    "release_surface_known_secrets_invalid", step);
  scanKnownSecretRepresentations(Buffer.from("{}", "utf8"), knownSecrets);
  const webDeploymentManifestBytes = normalizeWebControlBytes(
    input.webDeploymentManifestBytes,
    "release_surface_web_deployment_manifest_invalid",
    step
  );
  const webSecurityHeaderProfileBytes = normalizeWebControlBytes(
    input.webSecurityHeaderProfileBytes,
    "release_surface_web_security_headers_invalid",
    step
  );
  const webPublicationGeneratorBytes = normalizeWebControlBytes(
    input.webPublicationGeneratorBytes,
    "release_surface_web_publication_generator_invalid",
    step
  );
  if (!Buffer.isBuffer(input.deploymentReceiptBytes) ||
      input.deploymentReceiptBytes.length === 0 ||
      input.deploymentReceiptBytes.length >
        parsedProfile.limits.maximumDeploymentReceiptBytes ||
      !Buffer.isBuffer(input.changelogBytes) || input.changelogBytes.length === 0 ||
      input.changelogBytes.length > parsedProfile.limits.maximumChangelogBytes ||
      typeof input.expectedCampaignId !== "string" ||
      !safeIdPattern.test(input.expectedCampaignId) ||
      !["development", "production", "staging"].includes(
        input.expectedEnvironment) ||
      !contentIdPattern.test(input.expectedTerminalRegistryReceiptId) ||
      !contentIdPattern.test(input.authorizationReceiptId) ||
      !contentIdPattern.test(input.releaseManifestId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
      utcNanoseconds(input.verificationTimeUtc) === null) {
    failEvidence("release_surface_deployment_input_invalid", step);
  }
  return Object.freeze({
    ...input,
    changelogBytes: Buffer.from(input.changelogBytes),
    deploymentReceiptBytes: Buffer.from(input.deploymentReceiptBytes),
    knownSecrets,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
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
  const webAssetInventorySha256 = domainSeparatedDigest(
    parsedProfile.releasePreparation.webAssetInventoryIdentityDomain,
    input.webAssets
  );
  const webBuild = requireCurrentPassReceipt(
    context,
    input.webBuildReceiptId,
    "release_surface_web_build_not_current",
    step
  );
  if (webBuild.receipt.receiptType !== "build" ||
      webBuild.receipt.phase !== "web-build" ||
      webBuild.receipt.sourceRevision !== input.sourceRevision ||
      publicParameter(webBuild.receipt, "subject_id",
        "release_surface_web_build_binding_invalid", step) !== input.productId ||
      publicParameter(webBuild.receipt, "public-origin",
        "release_surface_web_build_binding_invalid", step) !== input.publicOrigin ||
      hashBinding(webBuild.receipt, "inputHashes", "web-deployment-manifest",
        "release_surface_web_build_binding_invalid", step) !==
          sha256(input.webDeploymentManifestBytes) ||
      hashBinding(webBuild.receipt, "inputHashes", "web-security-header-profile",
        "release_surface_web_build_binding_invalid", step) !==
          sha256(input.webSecurityHeaderProfileBytes) ||
      hashBinding(webBuild.receipt, "inputHashes", "web-publication-generator",
        "release_surface_web_build_binding_invalid", step) !==
          sha256(input.webPublicationGeneratorBytes) ||
      hashBinding(webBuild.receipt, "inputHashes", "web-release-changelog",
        "release_surface_web_build_binding_invalid", step) !==
          sha256(input.changelogBytes) ||
      hashBinding(webBuild.receipt, "outputHashes", "web-asset-inventory",
        "release_surface_web_build_binding_invalid", step) !==
          webAssetInventorySha256) {
    failEvidence("release_surface_web_build_binding_invalid", step);
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
  return Object.freeze({
    artifactSetSha256,
    artifacts,
    packages,
    provenance,
    webAssetInventorySha256,
    webBuild
  });
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

function activeReceiptDocuments(receiptStore) {
  const rebuilt = receiptStore.rebuild();
  return Object.freeze({
    ids: rebuilt.activeReceiptIds,
    byId: new Map(rebuilt.activeReceiptIds.map((receiptId) =>
      [receiptId, receiptStore.read(receiptId)]))
  });
}

function requirePreparationScan(activeReceipts, input, operationId, label,
  targetBytes, targetKind, expectedTimeUtc) {
  const step = "release-surface-authorization-lineage";
  const attemptId = `${label}-${operationId.slice("sha256:".length)}`;
  const candidates = [...activeReceipts.byId.values()].filter((entry) =>
    entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === attemptId);
  if (candidates.length !== 1) {
    failEvidence("release_surface_preparation_scan_missing", step);
  }
  const candidate = candidates[0];
  if (candidate.receipt.status !== "pass" ||
      candidate.receipt.campaignId !== input.expectedCampaignId ||
      candidate.receipt.sourceRevision !== input.sourceRevision ||
      candidate.receipt.startedAtUtc !== expectedTimeUtc ||
      candidate.receipt.completedAtUtc !== expectedTimeUtc) {
    failEvidence("release_surface_preparation_scan_invalid", step);
  }
  const verified = verifyVnextRedactionScanReceipt({
    knownSecrets: input.knownSecrets,
    receiptBytes: candidate.bytes,
    targetBytes,
    targetKind
  });
  if (!verified.publicSafe || verified.scanStatus !== "pass") {
    failEvidence("release_surface_preparation_scan_invalid", step);
  }
  return candidate;
}

function validatePreparedReleaseLineage(input, release, runner, artifactStore,
  receiptStore, subjectStore) {
  const step = "release-surface-authorization-lineage";
  const manifest = release.value;
  if (release.schema !== parsedProfile.releasePreparation.manifestSchema ||
      release.subjectId !== input.releaseManifestId ||
      manifest.releaseId !== input.releaseManifestId ||
      manifest.sourceRevision !== input.sourceRevision ||
      manifest.releaseDate !== manifest.createdAtUtc.slice(0, 10) ||
      compareUtc(manifest.createdAtUtc, input.verificationTimeUtc,
        "release_surface_authorization_time_invalid", step) > 0 ||
      sha256(input.changelogBytes) !== manifest.changelogSha256 ||
      sha256(input.webDeploymentManifestBytes) !==
        manifest.webDeploymentManifestSha256 ||
      sha256(input.webSecurityHeaderProfileBytes) !==
        manifest.webSecurityHeaderProfileSha256 ||
      sha256(input.webPublicationGeneratorBytes) !==
        manifest.webPublicationGeneratorSha256) {
    failEvidence("release_surface_prepared_manifest_invalid", step);
  }
  const attestation = receiptStore.read(manifest.campaignAttestationReceiptId);
  const attestationReceipt = attestation.receipt;
  if (attestationReceipt.receiptType !== parsedProfile.attestation.receiptType ||
      attestationReceipt.phase !== parsedProfile.attestation.phase ||
      attestationReceipt.status !== parsedProfile.attestation.completeStatus ||
      attestationReceipt.blockerCode !== null ||
      attestationReceipt.campaignId !== input.expectedCampaignId ||
      attestationReceipt.sourceRevision !== input.sourceRevision ||
      !contentIdPattern.test(attestationReceipt.attemptId) ||
      attestationReceipt.configurationSha256 !== campaignReleaseSurfaceProfileSha256 ||
      publicParameter(attestationReceipt, "campaign-complete",
        "release_surface_prepared_attestation_invalid", step) !== "true" ||
      publicParameter(attestationReceipt, "campaign-environment",
        "release_surface_prepared_attestation_invalid", step) !==
          input.expectedEnvironment ||
      publicParameter(attestationReceipt, "campaign-id",
        "release_surface_prepared_attestation_invalid", step) !==
          input.expectedCampaignId ||
      hashBinding(attestationReceipt, "inputHashes", "campaign-plan",
        "release_surface_prepared_attestation_invalid", step) !==
          manifest.campaignPlanSha256 ||
      hashBinding(attestationReceipt, "inputHashes", "campaign-projection-result",
        "release_surface_prepared_attestation_invalid", step) !==
          manifest.campaignProjectionSha256 ||
      hashBinding(attestationReceipt, "inputHashes", "campaign-release-surface-profile",
        "release_surface_prepared_attestation_invalid", step) !==
          campaignReleaseSurfaceProfileSha256 ||
      hashBinding(attestationReceipt, "outputHashes", "campaign-projection-result",
        "release_surface_prepared_attestation_invalid", step) !==
          manifest.campaignProjectionSha256) {
    failEvidence("release_surface_prepared_attestation_invalid", step);
  }
  const operationId = attestationReceipt.attemptId;
  const history = runner.inspectOperation(operationId);
  if (history.state !== "completed" ||
      history.projectionResultSha256 !== manifest.campaignProjectionSha256) {
    failEvidence("release_surface_preparation_operation_invalid", step);
  }
  const started = runner.readOperationRecord(history.startedRecordId);
  const terminal = runner.readOperationRecord(history.terminalRecordId);
  const startedRecord = started.record;
  const terminalRecord = terminal.record;
  if (startedRecord.operationId !== operationId ||
      startedRecord.expectedCampaignId !== input.expectedCampaignId ||
      startedRecord.expectedEnvironment !== input.expectedEnvironment ||
      startedRecord.trustedRootRegistryReceiptId !==
        input.trustedRootRegistryReceiptId ||
      startedRecord.expectedTerminalRegistryReceiptId !==
        input.expectedTerminalRegistryReceiptId ||
      startedRecord.campaignPlanSha256 !== manifest.campaignPlanSha256 ||
      startedRecord.verificationTimeUtc !== manifest.createdAtUtc ||
      terminalRecord.outcome !== "completed" ||
      terminalRecord.startedRecordId !== startedRecord.recordId ||
      terminalRecord.projectionResultSha256 !== manifest.campaignProjectionSha256 ||
      hashBinding(attestationReceipt, "inputHashes", "campaign-runner-start-record",
        "release_surface_preparation_operation_invalid", step) !== sha256(started.bytes) ||
      hashBinding(attestationReceipt, "inputHashes", "campaign-runner-terminal-record",
        "release_surface_preparation_operation_invalid", step) !== sha256(terminal.bytes) ||
      hashBinding(attestationReceipt, "inputHashes", "receipt-snapshot",
        "release_surface_preparation_operation_invalid", step) !==
          startedRecord.receiptSnapshot.snapshotSha256 ||
      hashBinding(attestationReceipt, "inputHashes", "subject-snapshot",
        "release_surface_preparation_operation_invalid", step) !==
          startedRecord.subjectSnapshot.snapshotSha256 ||
      !sameStrings(attestationReceipt.inputReceiptIds,
        startedRecord.receiptSnapshot.members.map((member) => member.id))) {
    failEvidence("release_surface_preparation_operation_invalid", step);
  }
  artifactStore.rebuild();
  const storedProjection = artifactStore.readProjection(
    manifest.campaignProjectionSha256
  );
  if (storedProjection.resultSha256 !== manifest.campaignProjectionSha256 ||
      storedProjection.result.campaignPlanSha256 !== manifest.campaignPlanSha256 ||
      storedProjection.result.campaignId !== input.expectedCampaignId ||
      storedProjection.result.environment !== input.expectedEnvironment ||
      storedProjection.result.verificationTimeUtc !== manifest.createdAtUtc ||
      storedProjection.result.complete !== true ||
      storedProjection.result.resumableState !== "complete" ||
      storedProjection.result.blockerCodes.length !== 0) {
    failEvidence("release_surface_prepared_projection_invalid", step);
  }
  const context = snapshotDocuments({
    receiptSnapshot: startedRecord.receiptSnapshot,
    subjectSnapshot: startedRecord.subjectSnapshot
  }, input.expectedCampaignId, receiptStore, subjectStore);
  const releaseInput = Object.freeze({
    artifactManifestIds: manifest.artifactManifestIds,
    changelogBytes: input.changelogBytes,
    claimIds: manifest.claimIds,
    packageReceiptIds: manifest.packageReceiptIds,
    productId: manifest.productId,
    provenanceReceiptId: manifest.provenanceReceiptId,
    publicOrigin: manifest.publicOrigin,
    sbomArtifactId: manifest.sbomArtifactId,
    sourceRevision: manifest.sourceRevision,
    verificationTimeUtc: manifest.createdAtUtc,
    webAssets: manifest.webAssets,
    webBuildReceiptId: manifest.webBuildReceiptId,
    webDeploymentManifestBytes: input.webDeploymentManifestBytes,
    webPublicationGeneratorBytes: input.webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes: input.webSecurityHeaderProfileBytes
  });
  const evidence = validateReleaseEvidence(
    releaseInput,
    storedProjection.result,
    context
  );
  const claims = validateReleaseClaims(releaseInput, context);
  const selectedDocuments = [
    ...evidence.artifacts,
    ...evidence.packages,
    evidence.provenance,
    evidence.webBuild,
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
  for (const document of selectedDocuments) {
    const scan = scanVnextPublicDocumentBytes(document.bytes, {
      knownSecrets: input.knownSecrets
    });
    if (!scan.publicSafe) {
      failEvidence("release_surface_prepared_public_input_unsafe", step);
    }
  }
  const activeReceipts = activeReceiptDocuments(receiptStore);
  const attestationScan = requirePreparationScan(
    activeReceipts,
    input,
    operationId,
    "redaction",
    attestation.bytes,
    "document",
    manifest.createdAtUtc
  );
  const changelogScan = requirePreparationScan(
    activeReceipts,
    input,
    operationId,
    "release-changelog-redaction",
    input.changelogBytes,
    "public-text",
    manifest.createdAtUtc
  );
  const manifestScan = requirePreparationScan(
    activeReceipts,
    input,
    operationId,
    "release-manifest-redaction",
    release.bytes,
    "document",
    manifest.createdAtUtc
  );
  const webDeploymentManifestScan = requirePreparationScan(
    activeReceipts,
    input,
    operationId,
    "release-web-deployment-manifest-redaction",
    input.webDeploymentManifestBytes,
    "public-text",
    manifest.createdAtUtc
  );
  const webSecurityHeaderScan = requirePreparationScan(
    activeReceipts,
    input,
    operationId,
    "release-web-security-header-redaction",
    input.webSecurityHeaderProfileBytes,
    "public-text",
    manifest.createdAtUtc
  );
  const webPublicationGeneratorScan = requirePreparationScan(
    activeReceipts,
    input,
    operationId,
    "release-web-publication-generator-redaction",
    input.webPublicationGeneratorBytes,
    "public-text",
    manifest.createdAtUtc
  );
  const expectedReceiptIds = [
    ...startedRecord.receiptSnapshot.members.map((member) => member.id),
    attestationReceipt.receiptId,
    attestationScan.receipt.receiptId,
    changelogScan.receipt.receiptId,
    manifestScan.receipt.receiptId,
    webDeploymentManifestScan.receipt.receiptId,
    webSecurityHeaderScan.receipt.receiptId,
    webPublicationGeneratorScan.receipt.receiptId
  ];
  const expectedSubjectIds = [
    ...startedRecord.subjectSnapshot.members.map((member) => member.id),
    input.releaseManifestId
  ];
  return Object.freeze({
    activeReceipts,
    attestation,
    expectedReceiptIds: [...new Set(expectedReceiptIds)].sort(),
    expectedSubjectIds: [...new Set(expectedSubjectIds)].sort(),
    operationId,
    projection: storedProjection.result
  });
}

function validateReleaseAuthorizationReceipt(input, release) {
  const step = "release-surface-authorization-receipt";
  const validated = validateVnextReceiptBytes(input.authorizationReceiptBytes);
  const receipt = validated.receipt;
  const envelope = receipt.signatureEnvelope;
  if (receipt.receiptType !== parsedProfile.releaseAuthorization.signatureReceiptType ||
      receipt.phase !== parsedProfile.releaseAuthorization.signatureReceiptType ||
      receipt.status !== "pass" || receipt.error !== null ||
      receipt.blockerCode !== null || receipt.campaignId !== input.expectedCampaignId ||
      receipt.sourceRevision !== input.sourceRevision ||
      receipt.startedAtUtc !== receipt.completedAtUtc ||
      receipt.supersedesReceiptIds.length !== 0 || envelope === null ||
      envelope.role !== parsedProfile.releaseAuthorization.role ||
      envelope.signatureDomain !== parsedProfile.releaseAuthorization.signatureDomain ||
      envelope.scope !== parsedProfile.releaseAuthorization.scope ||
      envelope.signedSchema !== parsedProfile.releaseAuthorization.signedSchema ||
      envelope.signedSubjectId !== input.releaseManifestId ||
      envelope.releaseId !== input.releaseManifestId ||
      envelope.campaignId !== input.expectedCampaignId ||
      envelope.issuedAtUtc !== receipt.completedAtUtc ||
      envelope.expiresAtUtc === null ||
      !sameStrings(receipt.inputReceiptIds,
        [envelope.authorityRegistryReceiptId]) ||
      receipt.inputHashes.length !== 1 ||
      receipt.inputHashes[0].name !== "signed-subject-canonical-content" ||
      receipt.inputHashes[0].sha256 !== release.canonicalContentSha256 ||
      receipt.outputHashes.length !== 0 ||
      receipt.authorityRegistry !== null || receipt.keyRevocation !== null ||
      receipt.offlineBundle !== null || receipt.attestationReference !== null) {
    failEvidence("release_surface_authorization_receipt_invalid", step);
  }
  if (compareUtc(release.value.createdAtUtc, envelope.issuedAtUtc,
    "release_surface_authorization_time_invalid", step) > 0 ||
      compareUtc(envelope.issuedAtUtc, input.verificationTimeUtc,
        "release_surface_authorization_time_invalid", step) > 0 ||
      compareUtc(input.verificationTimeUtc, envelope.expiresAtUtc,
        "release_surface_authorization_time_invalid", step) >= 0) {
    failEvidence("release_surface_authorization_time_invalid", step);
  }
  return validated;
}

function verifyReleaseAuthorizationAuthority(input, release, authorization,
  activeReceipts, subjectStore) {
  const step = "release-surface-authorization-authority";
  const receiptBytesById = new Map([...activeReceipts.byId].map(([receiptId, entry]) =>
    [receiptId, entry.bytes]));
  const existing = receiptBytesById.get(authorization.receipt.receiptId);
  if (existing && !existing.equals(authorization.bytes)) {
    failEvidence("release_surface_authorization_identity_collision", step);
  }
  receiptBytesById.set(authorization.receipt.receiptId, authorization.bytes);
  const subjectIds = subjectStore.rebuild().activeSubjectIds;
  const authority = verifyVnextAuthorityGraph({
    campaignId: input.expectedCampaignId,
    environment: input.expectedEnvironment,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytes: [...receiptBytesById].sort(([left], [right]) =>
      left.localeCompare(right)).map(([, bytes]) => bytes),
    subjectBytes: subjectIds.map((subjectId) => subjectStore.read(subjectId).bytes),
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    verificationTimeUtc: input.verificationTimeUtc
  });
  const releaseAuthorizations = authority.signatures.filter((entry) =>
    entry.role === parsedProfile.releaseAuthorization.role &&
      entry.scope === parsedProfile.releaseAuthorization.scope &&
      entry.signedSubjectId === input.releaseManifestId &&
      entry.signedSchema === release.schema);
  if (releaseAuthorizations.length !== 1 ||
      releaseAuthorizations[0].signatureReceiptId !==
        authorization.receipt.receiptId ||
      releaseAuthorizations[0].authorityRegistryReceiptId !==
        authorization.receipt.signatureEnvelope.authorityRegistryReceiptId ||
      releaseAuthorizations[0].signatureVerified !== true ||
      releaseAuthorizations[0].authorityAtIssue !== true ||
      releaseAuthorizations[0].temporalCurrent !== true ||
      releaseAuthorizations[0].currentEvidenceEligible !== true ||
      releaseAuthorizations[0].staleReasons.length !== 0 ||
      authority.terminalRegistryCurrent !== true) {
    failEvidence("release_surface_authorization_not_current", step);
  }
  return Object.freeze({
    authority,
    signature: releaseAuthorizations[0]
  });
}

function validateStoredReleaseAuthorization(input, release, lineage, receiptStore,
  subjectStore) {
  const step = "release-surface-deployment-authorization";
  const authorization = receiptStore.read(input.authorizationReceiptId);
  const validated = validateReleaseAuthorizationReceipt({
    ...input,
    authorizationReceiptBytes: authorization.bytes
  }, release);
  if (validated.receipt.receiptId !== input.authorizationReceiptId ||
      !authorization.bytes.equals(validated.bytes)) {
    failEvidence("release_surface_deployment_authorization_invalid", step);
  }
  const redactionAttemptId = `release-authorization-redaction-${
    input.authorizationReceiptId.slice("sha256:".length)}`;
  const redactionCandidates = [...lineage.activeReceipts.byId.values()].filter(
    (entry) => entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === redactionAttemptId
  );
  if (redactionCandidates.length !== 1) {
    failEvidence("release_surface_deployment_authorization_redaction_missing", step);
  }
  const redaction = redactionCandidates[0];
  const verifiedScan = verifyVnextRedactionScanReceipt({
    knownSecrets: input.knownSecrets,
    receiptBytes: redaction.bytes,
    targetBytes: authorization.bytes,
    targetKind: "document"
  });
  if (!verifiedScan.publicSafe || verifiedScan.scanStatus !== "pass" ||
      redaction.receipt.campaignId !== input.expectedCampaignId ||
      redaction.receipt.sourceRevision !== input.sourceRevision ||
      redaction.receipt.startedAtUtc !== redaction.receipt.completedAtUtc ||
      compareUtc(validated.receipt.completedAtUtc,
        redaction.receipt.completedAtUtc,
        "release_surface_deployment_authorization_time_invalid", step) > 0 ||
      compareUtc(redaction.receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_deployment_authorization_time_invalid", step) > 0) {
    failEvidence("release_surface_deployment_authorization_redaction_invalid", step);
  }
  const authority = verifyReleaseAuthorizationAuthority(
    input,
    release,
    validated,
    lineage.activeReceipts,
    subjectStore
  );
  return Object.freeze({
    authorization: validated,
    authority,
    expectedReceiptIds: [...new Set([
      ...lineage.expectedReceiptIds,
      redaction.receipt.receiptId,
      validated.receipt.receiptId
    ])].sort(),
    expectedSubjectIds: lineage.expectedSubjectIds,
    redaction
  });
}

function exactPublicParameters(receipt, expected, code, step) {
  const actual = receipt.publicParameters.map((entry) => ({ ...entry }));
  const sortedExpected = [...expected].sort((left, right) =>
    left.name.localeCompare(right.name));
  if (actual.length !== sortedExpected.length || actual.some((entry, index) =>
    entry.name !== sortedExpected[index].name ||
      entry.value !== sortedExpected[index].value ||
      entry.unit !== sortedExpected[index].unit)) {
    failEvidence(code, step);
  }
}

function validateDeploymentAttemptReceipt(input, release, storedAuthorization) {
  const step = "release-surface-deployment-receipt";
  const validated = validateVnextReceiptBytes(input.deploymentReceiptBytes);
  const receipt = validated.receipt;
  const manifest = release.value;
  const webAssetInventorySha256 = domainSeparatedDigest(
    parsedProfile.releasePreparation.webAssetInventoryIdentityDomain,
    manifest.webAssets
  );
  const expectedInputReceiptIds = [manifest.webBuildReceiptId];
  const expectedInputHashes = [
    {
      name: "release-manifest-canonical-content",
      sha256: release.canonicalContentSha256
    },
    { name: "web-asset-inventory", sha256: webAssetInventorySha256 },
    {
      name: "web-deployment-manifest",
      sha256: manifest.webDeploymentManifestSha256
    },
    {
      name: "web-publication-generator",
      sha256: manifest.webPublicationGeneratorSha256
    },
    {
      name: "web-security-header-profile",
      sha256: manifest.webSecurityHeaderProfileSha256
    }
  ];
  const expectedOutputNames = [
    "deployment-attempt-transcript",
    "submitted-web-asset-inventory"
  ];
  const submittedWebAssetInventorySha256 = hashBinding(
    receipt,
    "outputHashes",
    "submitted-web-asset-inventory",
    "release_surface_deployment_output_invalid",
    step
  );
  if (submittedWebAssetInventorySha256 !== webAssetInventorySha256) {
    failEvidence("release_surface_deployment_output_invalid", step);
  }
  exactPublicParameters(receipt, [
    {
      name: "asset-count",
      value: String(manifest.webAssets.length),
      unit: "assets"
    },
    {
      name: "authorization-receipt-id",
      value: input.authorizationReceiptId,
      unit: null
    },
    {
      name: "evidence-scope",
      value: parsedProfile.releaseDeployment.evidenceScope,
      unit: null
    },
    { name: "operation_id", value: receipt.attemptId, unit: null },
    { name: "public-origin", value: manifest.publicOrigin, unit: null },
    { name: "subject_id", value: input.releaseManifestId, unit: null },
    {
      name: "total-bytes",
      value: String(manifest.webTotalBytes),
      unit: "bytes"
    }
  ], "release_surface_deployment_parameters_invalid", step);
  if (receipt.receiptType !== parsedProfile.releaseDeployment.receiptType ||
      receipt.phase !== parsedProfile.releaseDeployment.phase ||
      receipt.status !== parsedProfile.releaseDeployment.status ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.campaignId !== input.expectedCampaignId ||
      receipt.sourceRevision !== input.sourceRevision ||
      !contentIdPattern.test(receipt.attemptId) ||
      !sameStrings(receipt.inputReceiptIds, expectedInputReceiptIds) ||
      receipt.inputHashes.length !== expectedInputHashes.length ||
      receipt.inputHashes.some((entry, index) =>
        entry.name !== expectedInputHashes[index].name ||
          entry.sha256 !== expectedInputHashes[index].sha256) ||
      receipt.outputHashes.length !== expectedOutputNames.length ||
      receipt.outputHashes.some((entry, index) =>
        entry.name !== expectedOutputNames[index]) ||
      receipt.runtime.executionClass !== "deployment" ||
      receipt.externalEvidenceReferences.length !== 2 ||
      !receipt.externalEvidenceReferences.some((entry) =>
        entry.kind === "https" && entry.value === manifest.publicOrigin) ||
      !receipt.externalEvidenceReferences.some((entry) =>
        entry.kind === "receipt" && entry.value === input.authorizationReceiptId) ||
      receipt.attestationReference !== manifest.campaignAttestationReceiptId ||
      receipt.signatureEnvelope !== null || receipt.authorityRegistry !== null ||
      receipt.keyRevocation !== null || receipt.offlineBundle !== null ||
      receipt.supersedesReceiptIds.length !== 0 ||
      compareUtc(storedAuthorization.redaction.receipt.completedAtUtc,
        receipt.startedAtUtc,
        "release_surface_deployment_time_invalid", step) > 0 ||
      compareUtc(receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_deployment_time_invalid", step) > 0) {
    failEvidence("release_surface_deployment_receipt_invalid", step);
  }
  return Object.freeze({
    ...validated,
    webAssetInventorySha256
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
      evidence.webBuild,
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

    const controlScans = [
      {
        bytes: input.webDeploymentManifestBytes,
        label: "release-web-deployment-manifest-redaction"
      },
      {
        bytes: input.webSecurityHeaderProfileBytes,
        label: "release-web-security-header-redaction"
      },
      {
        bytes: input.webPublicationGeneratorBytes,
        label: "release-web-publication-generator-redaction"
      }
    ].map((entry) => {
      const scan = scanVnextPublicTextBytes(entry.bytes, {
        knownSecrets: input.knownSecrets
      });
      const persisted = persistReleaseScan(
        input,
        projection.campaignId,
        scan,
        entry.label
      );
      if (!scan.publicSafe) {
        failEvidence("release_surface_public_input_unsafe", "release-surface-redaction");
      }
      return Object.freeze({ ...entry, persisted, scan });
    });

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
      publicOrigin: input.publicOrigin,
      webBuildReceiptId: input.webBuildReceiptId,
      webDeploymentManifestSha256: sha256(input.webDeploymentManifestBytes),
      webSecurityHeaderProfileSha256: input.webSecurityHeaderProfileSha256,
      webPublicationGeneratorSha256: sha256(input.webPublicationGeneratorBytes),
      webAssets: input.webAssets.map((entry) => ({ ...entry })),
      generatedPublicationFiles: input.generatedPublicationFiles.map((entry) => ({
        ...entry
      })),
      retiredPublicPaths: [...input.retiredPublicPaths],
      webTotalBytes: input.webTotalBytes,
      offlineCapability: input.offlineCapability,
      serviceWorkerPath: input.serviceWorkerPath,
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
      changelogRedaction.receipt.receipt.receiptId,
      ...controlScans.map((entry) => entry.persisted.receipt.receipt.receiptId)
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
      webDeploymentManifestRedactionReceiptId:
        controlScans[0].persisted.receipt.receipt.receiptId,
      webSecurityHeaderRedactionReceiptId:
        controlScans[1].persisted.receipt.receipt.receiptId,
      webPublicationGeneratorRedactionReceiptId:
        controlScans[2].persisted.receipt.receipt.receiptId,
      releaseManifestId: release.subjectId,
      releaseManifestSha256: release.canonicalContentSha256,
      releaseRedactionReceiptId: releaseRedaction.receipt.receipt.receiptId,
      attestationPersistence: execution.attestationPersistence,
      attestationRedactionPersistence: execution.redactionPersistence,
      changelogRedactionPersistence: changelogRedaction.persistence,
      webDeploymentManifestRedactionPersistence: controlScans[0].persisted.persistence,
      webSecurityHeaderRedactionPersistence: controlScans[1].persisted.persistence,
      webPublicationGeneratorRedactionPersistence: controlScans[2].persisted.persistence,
      releasePersistence,
      releaseRedactionPersistence: releaseRedaction.persistence
    }, {
      projectionResultBytes: runnerResult.projectionResultBytes,
      attestationReceiptBytes: attestation.bytes,
      attestationRedactionReceiptBytes: attestationRedaction.bytes,
      changelogBytes: changelogScan.outputBytes,
      changelogRedactionReceiptBytes: changelogRedaction.receipt.bytes,
      webDeploymentManifestBytes: controlScans[0].scan.outputBytes,
      webDeploymentManifestRedactionReceiptBytes:
        controlScans[0].persisted.receipt.bytes,
      webSecurityHeaderProfileBytes: controlScans[1].scan.outputBytes,
      webSecurityHeaderRedactionReceiptBytes:
        controlScans[1].persisted.receipt.bytes,
      webPublicationGeneratorBytes: controlScans[2].scan.outputBytes,
      webPublicationGeneratorRedactionReceiptBytes:
        controlScans[2].persisted.receipt.bytes,
      releaseManifestBytes: release.bytes,
      releaseRedactionReceiptBytes: releaseRedaction.receipt.bytes
    });
  }

  async function authorizeRelease(rawInput) {
    const step = "release-surface-authorize";
    const input = normalizeAuthorizeInput(rawInput);
    const release = subjectStore.read(input.releaseManifestId);
    const lineage = validatePreparedReleaseLineage(
      input,
      release,
      runner,
      artifactStore,
      receiptStore,
      subjectStore
    );
    const authorization = validateReleaseAuthorizationReceipt(input, release);
    const authorizationScan = scanVnextPublicDocumentBytes(authorization.bytes, {
      knownSecrets: input.knownSecrets
    });
    const authorizationRedaction = createVnextRedactionScanReceipt({
      attemptId: `release-authorization-redaction-${
        authorization.receipt.receiptId.slice("sha256:".length)}`,
      campaignId: input.expectedCampaignId,
      completedAtUtc: input.verificationTimeUtc,
      scan: authorizationScan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: input.verificationTimeUtc
    });
    const preparedReceiptIds = lineage.expectedReceiptIds;
    const preparedSubjectIds = lineage.expectedSubjectIds;
    const withRedaction = [...new Set([
      ...preparedReceiptIds,
      authorizationRedaction.receipt.receiptId
    ])].sort();
    const withAuthorization = [...new Set([
      ...withRedaction,
      authorization.receipt.receiptId
    ])].sort();
    const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
    const isPrepared = sameStrings(currentReceiptIds, preparedReceiptIds);
    const hasRedaction = sameStrings(currentReceiptIds, withRedaction);
    const isAuthorized = sameStrings(currentReceiptIds, withAuthorization);
    if (!isPrepared && !hasRedaction && !isAuthorized) {
      failEvidence("release_surface_authorization_snapshot_changed", step);
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      currentReceiptIds,
      preparedSubjectIds,
      "release-surface-authorization-before-verification"
    );
    if (hasRedaction || isAuthorized) {
      const existingScan = receiptStore.read(
        authorizationRedaction.receipt.receiptId
      );
      if (!existingScan.bytes.equals(authorizationRedaction.bytes)) {
        failEvidence("release_surface_authorization_redaction_changed", step);
      }
    }
    if (isAuthorized) {
      const existingAuthorization = receiptStore.read(
        authorization.receipt.receiptId
      );
      if (!existingAuthorization.bytes.equals(authorization.bytes)) {
        failEvidence("release_surface_authorization_identity_collision", step);
      }
    }
    if (!authorizationScan.publicSafe) {
      if (isPrepared) receiptStore.put(authorizationRedaction.bytes);
      assertStoreMembership(
        receiptStore,
        subjectStore,
        withRedaction,
        preparedSubjectIds,
        "release-surface-authorization-redaction-failure"
      );
      failEvidence("release_surface_authorization_unsafe", step);
    }
    const verified = verifyReleaseAuthorizationAuthority(
      input,
      release,
      authorization,
      lineage.activeReceipts,
      subjectStore
    );
    const envelope = authorization.receipt.signatureEnvelope;
    const authorizationResult = deepFreeze({
      schema: parsedProfile.releaseAuthorization.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      authorizationReceiptId: authorization.receipt.receiptId,
      authorizationRedactionReceiptId: authorizationRedaction.receipt.receiptId,
      authorityRegistryReceiptId: envelope.authorityRegistryReceiptId,
      trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
      terminalRegistryReceiptId: verified.authority.terminalRegistryReceiptId,
      signerId: envelope.signerId,
      keyId: envelope.keyId,
      nonceHash: envelope.nonceHash,
      issuedAtUtc: envelope.issuedAtUtc,
      expiresAtUtc: envelope.expiresAtUtc,
      verifiedAtUtc: input.verificationTimeUtc,
      signatureVerified: true,
      currentEvidenceEligible: true,
      authorizationStatus: "authorized",
      state: parsedProfile.releaseAuthorization.authorizedState
    });
    const authorizationResultBytes = canonicalizeVnextJcsBytes(
      authorizationResult
    );
    if (authorizationResultBytes.length >
        parsedProfile.limits.maximumAuthorizationResultBytes) {
      failEvidence("release_surface_authorization_result_byte_limit", step);
    }
    const resultScan = scanKnownSecretRepresentations(
      authorizationResultBytes,
      input.knownSecrets
    );
    if (resultScan.findingCount !== 0) {
      failEvidence("release_surface_authorization_result_unsafe", step);
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      currentReceiptIds,
      preparedSubjectIds,
      "release-surface-authorization-before-persistence"
    );
    const authorizationRedactionPersistence = receiptStore.put(
      authorizationRedaction.bytes
    );
    assertStoreMembership(
      receiptStore,
      subjectStore,
      isAuthorized ? withAuthorization : withRedaction,
      preparedSubjectIds,
      "release-surface-authorization-after-redaction"
    );
    const authorizationPersistence = receiptStore.put(authorization.bytes);
    assertStoreMembership(
      receiptStore,
      subjectStore,
      withAuthorization,
      preparedSubjectIds,
      "release-surface-authorization-after-signature"
    );
    return immutableReleasePreparationResult({
      authorizationStatus: "authorized",
      state: parsedProfile.releaseAuthorization.authorizedState,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      authorizationReceiptId: authorization.receipt.receiptId,
      authorizationRedactionReceiptId: authorizationRedaction.receipt.receiptId,
      authorizationResult,
      authorizationResultSha256: sha256(authorizationResultBytes),
      authorizationPersistence,
      authorizationRedactionPersistence
    }, {
      authorizationReceiptBytes: authorization.bytes,
      authorizationRedactionReceiptBytes: authorizationRedaction.bytes,
      authorizationResultBytes,
      releaseManifestBytes: release.bytes
    });
  }

  async function admitDeploymentAttempt(rawInput) {
    const step = "release-surface-deployment";
    const input = normalizeDeploymentInput(rawInput);
    const release = subjectStore.read(input.releaseManifestId);
    const lineage = validatePreparedReleaseLineage(
      input,
      release,
      runner,
      artifactStore,
      receiptStore,
      subjectStore
    );
    const storedAuthorization = validateStoredReleaseAuthorization(
      input,
      release,
      lineage,
      receiptStore,
      subjectStore
    );
    const deployment = validateDeploymentAttemptReceipt(
      input,
      release,
      storedAuthorization
    );
    const deploymentScan = scanVnextPublicDocumentBytes(deployment.bytes, {
      knownSecrets: input.knownSecrets
    });
    const deploymentRedaction = createVnextRedactionScanReceipt({
      attemptId: `release-deployment-redaction-${
        deployment.receipt.receiptId.slice("sha256:".length)}`,
      campaignId: input.expectedCampaignId,
      completedAtUtc: deployment.receipt.completedAtUtc,
      scan: deploymentScan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: deployment.receipt.completedAtUtc
    });
    const authorizedReceiptIds = storedAuthorization.expectedReceiptIds;
    const authorizedSubjectIds = storedAuthorization.expectedSubjectIds;
    const withRedaction = [...new Set([
      ...authorizedReceiptIds,
      deploymentRedaction.receipt.receiptId
    ])].sort();
    const withDeployment = [...new Set([
      ...withRedaction,
      deployment.receipt.receiptId
    ])].sort();
    const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
    const isAuthorized = sameStrings(currentReceiptIds, authorizedReceiptIds);
    const hasRedaction = sameStrings(currentReceiptIds, withRedaction);
    const hasDeployment = sameStrings(currentReceiptIds, withDeployment);
    if (!isAuthorized && !hasRedaction && !hasDeployment) {
      failEvidence("release_surface_deployment_snapshot_changed", step);
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      currentReceiptIds,
      authorizedSubjectIds,
      "release-surface-deployment-before-verification"
    );
    if (hasRedaction || hasDeployment) {
      const existingScan = receiptStore.read(
        deploymentRedaction.receipt.receiptId
      );
      if (!existingScan.bytes.equals(deploymentRedaction.bytes)) {
        failEvidence("release_surface_deployment_redaction_changed", step);
      }
    }
    if (hasDeployment) {
      const existingDeployment = receiptStore.read(deployment.receipt.receiptId);
      if (!existingDeployment.bytes.equals(deployment.bytes)) {
        failEvidence("release_surface_deployment_identity_collision", step);
      }
    }
    if (!deploymentScan.publicSafe) {
      if (isAuthorized) receiptStore.put(deploymentRedaction.bytes);
      assertStoreMembership(
        receiptStore,
        subjectStore,
        withRedaction,
        authorizedSubjectIds,
        "release-surface-deployment-redaction-failure"
      );
      failEvidence("release_surface_deployment_unsafe", step);
    }
    const result = deepFreeze({
      schema: parsedProfile.releaseDeployment.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: release.value.publicOrigin,
      authorizationReceiptId: input.authorizationReceiptId,
      deploymentReceiptId: deployment.receipt.receiptId,
      deploymentRedactionReceiptId: deploymentRedaction.receipt.receiptId,
      deploymentAttemptId: deployment.receipt.attemptId,
      deploymentAttemptStartedAtUtc: deployment.receipt.startedAtUtc,
      deploymentAttemptCompletedAtUtc: deployment.receipt.completedAtUtc,
      verifiedAtUtc: input.verificationTimeUtc,
      evidenceScope: parsedProfile.releaseDeployment.evidenceScope,
      deploymentStatus: "attempt-admitted",
      publicReadbackStatus: "required-not-performed",
      state: parsedProfile.releaseDeployment.admittedState
    });
    const resultBytes = canonicalizeVnextJcsBytes(result);
    if (resultBytes.length > parsedProfile.limits.maximumDeploymentResultBytes) {
      failEvidence("release_surface_deployment_result_byte_limit", step);
    }
    const resultScan = scanKnownSecretRepresentations(
      resultBytes,
      input.knownSecrets
    );
    if (resultScan.findingCount !== 0) {
      failEvidence("release_surface_deployment_result_unsafe", step);
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      currentReceiptIds,
      authorizedSubjectIds,
      "release-surface-deployment-before-persistence"
    );
    const deploymentRedactionPersistence = receiptStore.put(
      deploymentRedaction.bytes
    );
    assertStoreMembership(
      receiptStore,
      subjectStore,
      hasDeployment ? withDeployment : withRedaction,
      authorizedSubjectIds,
      "release-surface-deployment-after-redaction"
    );
    const deploymentPersistence = receiptStore.put(deployment.bytes);
    assertStoreMembership(
      receiptStore,
      subjectStore,
      withDeployment,
      authorizedSubjectIds,
      "release-surface-deployment-after-receipt"
    );
    return immutableReleasePreparationResult({
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      authorizationReceiptId: input.authorizationReceiptId,
      deploymentReceiptId: deployment.receipt.receiptId,
      deploymentRedactionReceiptId: deploymentRedaction.receipt.receiptId,
      deploymentAttemptId: deployment.receipt.attemptId,
      deploymentStatus: result.deploymentStatus,
      publicReadbackStatus: result.publicReadbackStatus,
      state: result.state,
      deploymentResult: result,
      deploymentResultSha256: sha256(resultBytes),
      deploymentPersistence,
      deploymentRedactionPersistence
    }, {
      deploymentReceiptBytes: deployment.bytes,
      deploymentRedactionReceiptBytes: deploymentRedaction.bytes,
      deploymentResultBytes: resultBytes,
      releaseManifestBytes: release.bytes
    });
  }

  return Object.freeze({
    admitDeploymentAttempt,
    attestCampaign,
    authorizeRelease,
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
