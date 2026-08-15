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
  scanVnextPublicDocumentBytes,
  scanVnextPublicJsonControlBytes,
  scanVnextPublicTextBytes,
  verifyVnextRedactionScanReceipt
} = require("./vnext-public-safe-redaction.js");
const {
  inspectVnextProtectedEqualityCustody,
  protectedEqualityCustodyProfile,
  protectedEqualityCustodyProfileSha256,
  scanVnextProtectedEqualityBytes
} = require("./vnext-protected-equality-custody.js");
const {
  loadVnextProtectedEqualityCustodyFromInheritedPipe,
  protectedEqualityPrivateLoaderProfile,
  protectedEqualityPrivateLoaderProfileSha256
} = require("./vnext-protected-equality-private-loader.js");
const {
  performVnextPublicHttpsReadback,
  publicHttpsReadbackProfile,
  publicHttpsReadbackProfileSha256,
  validateVnextWebSecurityHeaderProfileBytes
} = require("./vnext-public-https-readback.js");
const {
  signatureProfile,
  signatureProfileSha256
} = require("./vnext-signature-payload.js");
const {
  verifyVnextAuthorityGraph
} = require("./vnext-signature-authority.js");
const {
  createVnextSitePublicationPlanMaterial,
  materializeVnextSitePublication,
  sitePublicationProfile,
  sitePublicationProfileSha256
} = require("./vnext-site-publication.js");
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
const publicHttpsReadbackSourceSha256 = sha256(fs.readFileSync(path.join(__dirname,
  "vnext-public-https-readback.js")));
const sitePublicationSourceSha256 = sha256(fs.readFileSync(path.join(__dirname,
  "vnext-site-publication.js")));

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
  "releaseManifestId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const publicReadbackInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptId",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "operationId",
  "releaseManifestId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const sitePublicationPlanInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptId",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "operationId",
  "previousHistoryBytes",
  "publicReadbackReceiptId",
  "releaseManifestId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const sitePublicationAuthorizationInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptId",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "previousHistoryBytes",
  "publicReadbackReceiptId",
  "releaseManifestId",
  "sitePublicationPlanReceiptId",
  "sitePublisherSignatureReceiptBytes",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const generatedDeploymentInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptId",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "generatedDeploymentReceiptBytes",
  "previousHistoryBytes",
  "publicReadbackReceiptId",
  "releaseManifestId",
  "sitePublicationPlanReceiptId",
  "sitePublisherSignatureReceiptId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const generatedPublicReadbackInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptId",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "generatedDeploymentReceiptId",
  "operationId",
  "previousHistoryBytes",
  "publicReadbackReceiptId",
  "releaseManifestId",
  "sitePublicationPlanReceiptId",
  "sitePublisherSignatureReceiptId",
  "sourceRevision",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc",
  "webDeploymentManifestBytes",
  "webSecurityHeaderProfileBytes",
  "webPublicationGeneratorBytes"
]);
const sitePublicationFinalizationInputFields = Object.freeze([
  "authorizationReceiptId",
  "changelogBytes",
  "deploymentReceiptId",
  "expectedCampaignId",
  "expectedEnvironment",
  "expectedTerminalRegistryReceiptId",
  "generatedDeploymentReceiptId",
  "generatedPublicReadbackReceiptId",
  "operationId",
  "previousHistoryBytes",
  "publicReadbackReceiptId",
  "releaseManifestId",
  "sitePublicationPlanReceiptId",
  "sitePublisherSignatureReceiptId",
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
  "publicSafeRedactionProfileSha256", "protectedEqualityCustodyProfileId",
  "protectedEqualityCustodyProfileSha256",
  "protectedEqualityPrivateLoaderProfileId",
  "protectedEqualityPrivateLoaderProfileSha256", "receiptSignatureProfileId",
  "receiptSignatureProfileSha256", "publicHttpsReadbackProfileId",
  "publicHttpsReadbackProfileSha256", "sitePublicationProfileId",
  "sitePublicationProfileSha256", "canonicalJsonProfile", "hashAlgorithm",
  "campaignTruthInput", "operationPolicy", "storedProjectionPolicy",
  "callerVerdictPolicy", "callerCounterPolicy",
  "protectedEqualityBootstrapPolicy",
  "mutablePointerPolicy",
  "networkAccess", "clockAccess", "sourceMutation", "attestation",
  "operatorStatus", "releasePreparation", "releaseAuthorization",
  "releaseDeployment", "publicReadback", "sitePublicationPlan",
  "sitePublicationAuthorization", "generatedDeployment",
  "generatedPublicReadback", "sitePublicationFinalization", "limits"
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
const publicReadbackProfileFields = Object.freeze([
  "resultSchema", "verifiedState", "configurationIdentityDomain",
  "receiptType", "phase", "status",
  "evidenceScope", "manifestPolicy", "authorizationPolicy",
  "deploymentPolicy", "networkPolicy", "resultPolicy",
  "inputReceiptPolicy", "inputHashPolicy", "outputHashPolicy",
  "runtimePolicy", "timePolicy", "redactionPolicy", "persistencePolicy",
  "replayPolicy", "publicationPolicy"
]);
const sitePublicationPlanProfileFields = Object.freeze([
  "resultSchema", "preparedState", "receiptType", "phase", "status",
  "evidenceScope", "lineagePolicy", "previousHistoryPolicy", "inputPolicy",
  "callerTruthPolicy", "redactionPolicy", "persistencePolicy", "replayPolicy"
]);
const sitePublicationAuthorizationProfileFields = Object.freeze([
  "resultSchema", "authorizedState", "signatureReceiptType", "role",
  "signatureDomain", "scope", "signedSchema", "releaseIdPolicy",
  "authorityPolicy", "registryPolicy", "timePolicy", "materializationPolicy",
  "redactionPolicy", "persistencePolicy", "callerDecisionPolicy"
]);
const generatedDeploymentProfileFields = Object.freeze([
  "resultSchema", "admittedState", "receiptType", "phase", "status",
  "evidenceScope", "lineagePolicy", "receiptPolicy", "inputReceiptPolicy",
  "inputHashPolicy", "outputHashPolicy", "runtimePolicy", "timePolicy",
  "redactionPolicy", "persistencePolicy", "callerSuccessPolicy"
]);
const generatedPublicReadbackProfileFields = Object.freeze([
  "resultSchema", "verifiedState", "configurationIdentityDomain",
  "combinedAssetInventoryIdentityDomain", "receiptType", "phase", "status",
  "evidenceScope", "lineagePolicy", "networkPolicy", "resultPolicy",
  "inputReceiptPolicy", "inputHashPolicy", "outputHashPolicy", "runtimePolicy",
  "timePolicy", "redactionPolicy", "persistencePolicy", "replayPolicy",
  "publicationPolicy"
]);
const sitePublicationFinalizationProfileFields = Object.freeze([
  "resultSchema", "publishedState", "receiptType", "phase", "status",
  "evidenceScope", "lineagePolicy", "authorityPolicy", "readbackPolicy",
  "inputReceiptPolicy", "inputHashPolicy", "outputHashPolicy", "claimPolicy",
  "historyPolicy", "redactionPolicy", "persistencePolicy", "interruptionPolicy",
  "callerTruthPolicy"
]);
const limitFields = Object.freeze([
  "maximumProjectionBytes", "maximumReceiptSnapshotMembers",
  "maximumSubjectSnapshotMembers", "maximumOperatorStatusBytes",
  "maximumBlockerCodes", "maximumCountRows", "maximumReleaseArtifactManifests",
  "maximumReleasePackageReceipts", "maximumReleaseClaims",
  "maximumRemainingRiskCodes", "maximumChangelogBytes",
  "maximumWebAssets", "maximumGeneratedPublicationFiles",
  "maximumRetiredPublicPaths", "maximumWebControlDocumentBytes",
  "maximumWebTotalBytes",
  "maximumReleaseManifestBytes", "maximumAuthorizationReceiptBytes",
  "maximumAuthorizationResultBytes", "maximumDeploymentReceiptBytes",
  "maximumDeploymentResultBytes", "maximumPublicReadbackResultBytes",
  "maximumPublicReadbackReceiptBytes",
  "maximumPublicReadbackAdmissionResultBytes",
  "maximumSitePublicationPlanResultBytes",
  "maximumSitePublicationAuthorizationResultBytes",
  "maximumSitePublicationHistoryBytes",
  "maximumSitePublicationSignatureReceiptBytes",
  "maximumGeneratedDeploymentReceiptBytes",
  "maximumGeneratedDeploymentResultBytes",
  "maximumGeneratedPublicReadbackReceiptBytes",
  "maximumGeneratedPublicReadbackAdmissionResultBytes",
  "maximumSitePublicationReceiptBytes",
  "maximumSitePublicationAdmissionResultBytes"
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
const publicReadbackResultFields = Object.freeze([
  "schema", "profileId", "profileSha256", "verifierSourceSha256",
  "publicOrigin", "assetCount", "totalBytes", "dnsAddressCount",
  "certificateCount", "observationInventorySha256", "dnsAddressSetSha256",
  "pinnedAddressSha256", "certificateSetSha256",
  "securityHeaderProfileSha256", "observations"
]);
const publicReadbackObservationFields = Object.freeze([
  "byteLength", "cacheControl", "contentType", "path",
  "securityHeaderProfileSha256", "sha256", "statusCode", "tlsProtocol"
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
  exactDataObject(parsedProfile.publicReadback, publicReadbackProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.sitePublicationPlan,
    sitePublicationPlanProfileFields, "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.sitePublicationAuthorization,
    sitePublicationAuthorizationProfileFields,
    "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.generatedDeployment,
    generatedDeploymentProfileFields, "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.generatedPublicReadback,
    generatedPublicReadbackProfileFields, "release_surface_profile_invalid", step);
  exactDataObject(parsedProfile.sitePublicationFinalization,
    sitePublicationFinalizationProfileFields,
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
      parsedProfile.protectedEqualityCustodyProfileId !==
        protectedEqualityCustodyProfile.profileId ||
      parsedProfile.protectedEqualityCustodyProfileSha256 !==
        protectedEqualityCustodyProfileSha256 ||
      parsedProfile.protectedEqualityPrivateLoaderProfileId !==
        protectedEqualityPrivateLoaderProfile.profileId ||
      parsedProfile.protectedEqualityPrivateLoaderProfileSha256 !==
        protectedEqualityPrivateLoaderProfileSha256 ||
      parsedProfile.receiptSignatureProfileId !== signatureProfile.profileId ||
      parsedProfile.receiptSignatureProfileSha256 !== signatureProfileSha256 ||
      parsedProfile.publicHttpsReadbackProfileId !==
        publicHttpsReadbackProfile.profileId ||
      parsedProfile.publicHttpsReadbackProfileSha256 !==
        publicHttpsReadbackProfileSha256 ||
      parsedProfile.sitePublicationProfileId !== sitePublicationProfile.profileId ||
      parsedProfile.sitePublicationProfileSha256 !== sitePublicationProfileSha256 ||
      parsedProfile.canonicalJsonProfile !== "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.campaignTruthInput !==
        "fresh-sole-runner-return-created-and-consumed-inside-one-surface-call" ||
      parsedProfile.operationPolicy !== "never-before-used-operation-id-only" ||
      parsedProfile.storedProjectionPolicy !== "forbidden" ||
      parsedProfile.callerVerdictPolicy !== "forbidden" ||
      parsedProfile.callerCounterPolicy !== "forbidden" ||
      parsedProfile.protectedEqualityBootstrapPolicy !==
        "one-process-runtime-loads-one-signed-revision-from-fixed-inherited-pipe-before-any-surface-open-no-caller-custody-input" ||
      parsedProfile.mutablePointerPolicy !== "forbidden" ||
      parsedProfile.networkAccess !== "forbidden-until-public-readback-operation" ||
      parsedProfile.clockAccess !== "caller-trusted-verification-time-only" ||
      parsedProfile.sourceMutation !==
        "create-only-attestation-redaction-release-manifest-authorization-signature-deployment-attempt-public-readback-site-publication-plan-site-publisher-generated-deployment-generated-readback-final-publication-receipts-and-published-claim-subjects" ||
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
      parsedProfile.publicReadback.resultSchema !==
        "tinyrustlm.vnext.public_readback_admission_result.v1" ||
      parsedProfile.publicReadback.verifiedState !==
        "public-readback-verified-awaiting-publication" ||
      parsedProfile.publicReadback.configurationIdentityDomain !==
        "tinyrustlm.release-public-readback-configuration.v1" ||
      parsedProfile.publicReadback.receiptType !== "public-readback" ||
      parsedProfile.publicReadback.phase !== "public-readback" ||
      parsedProfile.publicReadback.status !== "pass" ||
      parsedProfile.publicReadback.evidenceScope !==
        "exact-production-public-https-static-asset-closure" ||
      parsedProfile.publicReadback.manifestPolicy !==
        "existing-current-authorized-manifest-with-one-admitted-deployment-attempt-only" ||
      parsedProfile.publicReadback.authorizationPolicy !==
        "rerun-current-evidence-eligible-release-authorizer-signature" ||
      parsedProfile.publicReadback.deploymentPolicy !==
        "exactly-one-stored-current-admitted-deployment-attempt" ||
      parsedProfile.publicReadback.networkPolicy !==
        "surface-invokes-sole-production-verifier-without-caller-transport-or-result" ||
      parsedProfile.publicReadback.resultPolicy !==
        "strict-canonical-result-revalidated-against-manifest-and-profile" ||
      parsedProfile.publicReadback.inputReceiptPolicy !==
        "exact-admitted-deployment-attempt-parent" ||
      parsedProfile.publicReadback.inputHashPolicy !==
        "exact-release-authorization-deployment-manifest-web-inventory-control-documents-and-verifier-profile" ||
      parsedProfile.publicReadback.outputHashPolicy !==
        "exact-result-observation-dns-pinned-address-certificate-set-and-verified-web-inventory" ||
      parsedProfile.publicReadback.runtimePolicy !==
        "deployment-execution-class-only" ||
      parsedProfile.publicReadback.timePolicy !==
        "readback-not-before-deployment-and-current-authorization-at-trusted-verification-time" ||
      parsedProfile.publicReadback.redactionPolicy !==
        "scan-result-known-secret-representations-and-final-receipt-before-persistence" ||
      parsedProfile.publicReadback.persistencePolicy !==
        "readback-redaction-before-create-only-public-readback-receipt" ||
      parsedProfile.publicReadback.replayPolicy !==
        "exact-dependency-prefix-and-byte-identical-replay-only" ||
      parsedProfile.publicReadback.publicationPolicy !==
        "forbidden-until-generated-files-published-claims-and-site-publisher-descendants" ||
      parsedProfile.sitePublicationPlan.resultSchema !==
        "tinyrustlm.vnext.site_publication_plan_result.v1" ||
      parsedProfile.sitePublicationPlan.preparedState !==
        "site-publication-plan-prepared-awaiting-authorization" ||
      parsedProfile.sitePublicationPlan.receiptType !== "site-synchronization" ||
      parsedProfile.sitePublicationPlan.phase !== "site-synchronization" ||
      parsedProfile.sitePublicationPlan.status !== "pass" ||
      parsedProfile.sitePublicationPlan.evidenceScope !==
        sitePublicationProfile.plan.evidenceScope ||
      parsedProfile.sitePublicationPlan.lineagePolicy !==
        "exact-current-static-readback-release-and-approved-claim-closure" ||
      parsedProfile.sitePublicationPlan.previousHistoryPolicy !==
        "none-for-first-release-or-exact-current-published-history-hash" ||
      parsedProfile.sitePublicationPlan.inputPolicy !==
        "stored-release-readback-and-claims-plus-bound-generator-and-history-bytes" ||
      parsedProfile.sitePublicationPlan.callerTruthPolicy !==
        "status-currentness-verdict-counter-and-publication-inputs-forbidden" ||
      parsedProfile.sitePublicationPlan.redactionPolicy !==
        "scan-history-plan-material-and-final-plan-receipt-before-persistence" ||
      parsedProfile.sitePublicationPlan.persistencePolicy !==
        "plan-redaction-before-create-only-site-synchronization-receipt" ||
      parsedProfile.sitePublicationPlan.replayPolicy !==
        "exact-dependency-prefix-and-byte-identical-recovery-only" ||
      parsedProfile.sitePublicationAuthorization.resultSchema !==
        "tinyrustlm.vnext.site_publication_authorization_result.v1" ||
      parsedProfile.sitePublicationAuthorization.authorizedState !==
        "site-publication-authorized-awaiting-generated-deployment" ||
      parsedProfile.sitePublicationAuthorization.signatureReceiptType !==
        sitePublicationProfile.sitePublisher.receiptType ||
      parsedProfile.sitePublicationAuthorization.role !==
        sitePublicationProfile.sitePublisher.role ||
      parsedProfile.sitePublicationAuthorization.signatureDomain !==
        sitePublicationProfile.sitePublisher.signatureDomain ||
      parsedProfile.sitePublicationAuthorization.scope !==
        sitePublicationProfile.sitePublisher.scope ||
      parsedProfile.sitePublicationAuthorization.signedSchema !==
        sitePublicationProfile.sitePublisher.signedSchema ||
      parsedProfile.sitePublicationAuthorization.releaseIdPolicy !==
        "must-equal-plan-release-id" ||
      parsedProfile.sitePublicationAuthorization.authorityPolicy !==
        "exactly-one-current-evidence-eligible-signature" ||
      parsedProfile.sitePublicationAuthorization.registryPolicy !==
        "caller-pinned-root-and-terminal" ||
      parsedProfile.sitePublicationAuthorization.timePolicy !==
        "trusted-verification-time-and-finite-profile-lifetime" ||
      parsedProfile.sitePublicationAuthorization.materializationPolicy !==
        "pure-profile-bound-pointer-history-and-published-claim-candidates-only" ||
      parsedProfile.sitePublicationAuthorization.redactionPolicy !==
        "scan-signature-and-all-materialized-candidates-before-return" ||
      parsedProfile.sitePublicationAuthorization.persistencePolicy !==
        "signature-redaction-before-create-only-site-publisher-signature-receipt" ||
      parsedProfile.sitePublicationAuthorization.callerDecisionPolicy !== "forbidden" ||
      parsedProfile.generatedDeployment.resultSchema !==
        "tinyrustlm.vnext.generated_publication_deployment_admission_result.v1" ||
      parsedProfile.generatedDeployment.admittedState !==
        "site-generated-deployment-attempt-admitted-awaiting-complete-readback" ||
      parsedProfile.generatedDeployment.receiptType !== "deployment" ||
      parsedProfile.generatedDeployment.phase !== "generated-publication-deployment" ||
      parsedProfile.generatedDeployment.status !== "pass" ||
      parsedProfile.generatedDeployment.evidenceScope !==
        "generated-publication-deployment-attempt-only" ||
      parsedProfile.generatedDeployment.lineagePolicy !==
        "exact-static-readback-plan-current-site-publisher-and-materialized-generated-inventory" ||
      parsedProfile.generatedDeployment.receiptPolicy !==
        "externally-produced-canonical-receipt-with-closed-lineage-and-no-success-claim" ||
      parsedProfile.generatedDeployment.inputReceiptPolicy !==
        "exact-static-readback-plan-and-site-publisher-signature-parents" ||
      parsedProfile.generatedDeployment.inputHashPolicy !==
        "exact-release-plan-signature-profile-generator-header-and-generated-inventory" ||
      parsedProfile.generatedDeployment.outputHashPolicy !==
        "exact-submitted-generated-inventory-plus-bounded-public-safe-attempt-transcript-digest" ||
      parsedProfile.generatedDeployment.runtimePolicy !==
        "deployment-execution-class-only" ||
      parsedProfile.generatedDeployment.timePolicy !==
        "attempt-after-site-publisher-authorization-and-not-after-trusted-verification-time" ||
      parsedProfile.generatedDeployment.redactionPolicy !==
        "scan-final-canonical-generated-deployment-receipt-before-persistence" ||
      parsedProfile.generatedDeployment.persistencePolicy !==
        "generated-deployment-redaction-before-create-only-generated-deployment-receipt" ||
      parsedProfile.generatedDeployment.callerSuccessPolicy !== "forbidden" ||
      parsedProfile.generatedPublicReadback.resultSchema !==
        "tinyrustlm.vnext.generated_publication_readback_admission_result.v1" ||
      parsedProfile.generatedPublicReadback.verifiedState !==
        "site-generated-public-readback-verified-awaiting-publication-commit" ||
      parsedProfile.generatedPublicReadback.configurationIdentityDomain !==
        "tinyrustlm.generated-publication-readback-configuration.v1" ||
      parsedProfile.generatedPublicReadback.combinedAssetInventoryIdentityDomain !==
        "tinyrustlm.complete-publication-web-asset-inventory.v1" ||
      parsedProfile.generatedPublicReadback.receiptType !== "public-readback" ||
      parsedProfile.generatedPublicReadback.phase !==
        "generated-publication-readback" ||
      parsedProfile.generatedPublicReadback.status !== "pass" ||
      parsedProfile.generatedPublicReadback.evidenceScope !==
        "exact-production-public-https-static-and-generated-asset-closure" ||
      parsedProfile.generatedPublicReadback.lineagePolicy !==
        "exact-generated-deployment-static-readback-plan-current-site-publisher-and-materialized-generated-inventory" ||
      parsedProfile.generatedPublicReadback.networkPolicy !==
        "surface-invokes-sole-production-verifier-over-sorted-static-plus-generated-closure-without-caller-transport-or-result" ||
      parsedProfile.generatedPublicReadback.resultPolicy !==
        "strict-canonical-result-revalidated-against-combined-inventory-and-profile" ||
      parsedProfile.generatedPublicReadback.inputReceiptPolicy !==
        "exact-generated-deployment-attempt-parent" ||
      parsedProfile.generatedPublicReadback.inputHashPolicy !==
        "exact-release-static-readback-plan-signature-generated-deployment-control-profiles-and-combined-inventory" ||
      parsedProfile.generatedPublicReadback.outputHashPolicy !==
        "exact-result-observation-dns-pinned-address-certificate-set-generated-and-combined-inventories" ||
      parsedProfile.generatedPublicReadback.runtimePolicy !==
        "deployment-execution-class-only" ||
      parsedProfile.generatedPublicReadback.timePolicy !==
        "readback-not-before-generated-deployment-and-current-site-publisher-at-trusted-verification-time" ||
      parsedProfile.generatedPublicReadback.redactionPolicy !==
        "scan-result-known-secret-representations-and-final-generated-readback-receipt-before-persistence" ||
      parsedProfile.generatedPublicReadback.persistencePolicy !==
        "generated-readback-redaction-before-create-only-generated-readback-receipt" ||
      parsedProfile.generatedPublicReadback.replayPolicy !==
        "exact-dependency-prefix-and-byte-identical-replay-only" ||
      parsedProfile.generatedPublicReadback.publicationPolicy !==
        "forbidden-until-create-only-published-claim-prefix-and-final-site-publication-receipt" ||
      parsedProfile.sitePublicationFinalization.resultSchema !==
        "tinyrustlm.vnext.site_publication_admission_result.v1" ||
      parsedProfile.sitePublicationFinalization.publishedState !==
        "site-publication-published" ||
      parsedProfile.sitePublicationFinalization.receiptType !==
        "site-synchronization" ||
      parsedProfile.sitePublicationFinalization.phase !== "site-publication" ||
      parsedProfile.sitePublicationFinalization.status !== "pass" ||
      parsedProfile.sitePublicationFinalization.evidenceScope !==
        "exact-production-site-publication-closure" ||
      parsedProfile.sitePublicationFinalization.lineagePolicy !==
        "exact-generated-readback-plan-release-current-site-publisher-and-deterministic-descendants" ||
      parsedProfile.sitePublicationFinalization.authorityPolicy !==
        "rerun-exactly-one-current-evidence-eligible-site-publisher-signature" ||
      parsedProfile.sitePublicationFinalization.readbackPolicy !==
        "exact-static-plus-generated-production-observation-closure" ||
      parsedProfile.sitePublicationFinalization.inputReceiptPolicy !==
        "exact-plan-site-publisher-signature-generated-deployment-and-generated-readback-parents" ||
      parsedProfile.sitePublicationFinalization.inputHashPolicy !==
        "exact-release-pointer-history-generated-inventory-published-claim-set-and-complete-observation" ||
      parsedProfile.sitePublicationFinalization.outputHashPolicy !==
        "exact-pointer-history-generated-inventory-and-published-claim-set" ||
      parsedProfile.sitePublicationFinalization.claimPolicy !==
        "direct-approved-claim-descendants-admitted-only-by-final-commit-receipt" ||
      parsedProfile.sitePublicationFinalization.historyPolicy !==
        "append-only-current-history-and-explicit-prior-publication-supersession" ||
      parsedProfile.sitePublicationFinalization.redactionPolicy !==
        "reverify-candidate-redactions-and-scan-final-publication-receipt-before-any-public-subject-persistence" ||
      parsedProfile.sitePublicationFinalization.persistencePolicy !==
        "final-receipt-redaction-then-create-only-published-claim-prefix-then-final-commit-receipt" ||
      parsedProfile.sitePublicationFinalization.interruptionPolicy !==
        "incomplete-prefix-inert-and-byte-identical-restart-resumable" ||
      parsedProfile.sitePublicationFinalization.callerTruthPolicy !== "forbidden" ||
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
      parsedProfile.limits.maximumPublicReadbackResultBytes !==
        publicHttpsReadbackProfile.limits.maximumResultBytes ||
      parsedProfile.limits.maximumPublicReadbackReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
      parsedProfile.limits.maximumPublicReadbackAdmissionResultBytes !== 262_144 ||
      parsedProfile.limits.maximumSitePublicationPlanResultBytes !== 262_144 ||
      parsedProfile.limits.maximumSitePublicationAuthorizationResultBytes !== 262_144 ||
      parsedProfile.limits.maximumSitePublicationHistoryBytes !==
        sitePublicationProfile.limits.maximumHistoryBytes ||
      parsedProfile.limits.maximumSitePublicationSignatureReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
      parsedProfile.limits.maximumGeneratedDeploymentReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
      parsedProfile.limits.maximumGeneratedDeploymentResultBytes !== 262_144 ||
      parsedProfile.limits.maximumGeneratedPublicReadbackReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
      parsedProfile.limits.maximumGeneratedPublicReadbackAdmissionResultBytes !==
        262_144 ||
      parsedProfile.limits.maximumSitePublicationReceiptBytes !==
        receiptStoreProfile.wire.maximumReceiptBytes ||
      parsedProfile.limits.maximumSitePublicationAdmissionResultBytes !== 262_144 ||
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

function runtimeRecord(executionClass = "local") {
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
    executionClass
  };
}

function normalizeInput(rawInput, equalityCustody) {
  const input = exactDataObject(rawInput, attestationInputFields,
    "release_surface_input_invalid", "release-surface-input");
  if (!digestPattern.test(input.campaignPlanSha256) ||
      !contentIdPattern.test(input.operationId) ||
      !sourceRevisionPattern.test(input.sourceRevision)) {
    failEvidence("release_surface_input_invalid", "release-surface-input");
  }
  return Object.freeze({ ...input, equalityCustody });
}

function normalizePrepareInput(rawInput, equalityCustody) {
  const step = "release-surface-prepare-input";
  const input = exactDataObject(rawInput, prepareInputFields,
    "release_surface_prepare_input_invalid", step);
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
    equalityCustody,
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

function normalizeAuthorizeInput(rawInput, equalityCustody) {
  const step = "release-surface-authorize-input";
  const input = exactDataObject(rawInput, authorizeInputFields,
    "release_surface_authorize_input_invalid", step);
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
    equalityCustody,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  });
}

function normalizeDeploymentInput(rawInput, equalityCustody) {
  const step = "release-surface-deployment-input";
  const input = exactDataObject(rawInput, deploymentInputFields,
    "release_surface_deployment_input_invalid", step);
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
    equalityCustody,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  });
}

function normalizePublicReadbackInput(rawInput, equalityCustody) {
  const step = "release-surface-public-readback-input";
  const input = exactDataObject(rawInput, publicReadbackInputFields,
    "release_surface_public_readback_input_invalid", step);
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
  if (!Buffer.isBuffer(input.changelogBytes) || input.changelogBytes.length === 0 ||
      input.changelogBytes.length > parsedProfile.limits.maximumChangelogBytes ||
      typeof input.expectedCampaignId !== "string" ||
      !safeIdPattern.test(input.expectedCampaignId) ||
      !["development", "production", "staging"].includes(
        input.expectedEnvironment) ||
      !contentIdPattern.test(input.expectedTerminalRegistryReceiptId) ||
      !contentIdPattern.test(input.authorizationReceiptId) ||
      !contentIdPattern.test(input.deploymentReceiptId) ||
      !contentIdPattern.test(input.operationId) ||
      !contentIdPattern.test(input.releaseManifestId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
      utcNanoseconds(input.verificationTimeUtc) === null) {
    failEvidence("release_surface_public_readback_input_invalid", step);
  }
  return Object.freeze({
    ...input,
    changelogBytes: Buffer.from(input.changelogBytes),
    equalityCustody,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  });
}

function normalizeSitePublicationInput(rawInput, equalityCustody, fields, code, step) {
  const input = exactDataObject(rawInput, fields, code, step);
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
  let previousHistoryBytes = null;
  if (input.previousHistoryBytes !== null) {
    if (!Buffer.isBuffer(input.previousHistoryBytes) ||
        input.previousHistoryBytes.length === 0 ||
        input.previousHistoryBytes.length >
          parsedProfile.limits.maximumSitePublicationHistoryBytes) {
      failEvidence(code, step);
    }
    previousHistoryBytes = Buffer.from(input.previousHistoryBytes);
  }
  const planInput = fields === sitePublicationPlanInputFields;
  if (!Buffer.isBuffer(input.changelogBytes) || input.changelogBytes.length === 0 ||
      input.changelogBytes.length > parsedProfile.limits.maximumChangelogBytes ||
      typeof input.expectedCampaignId !== "string" ||
      !safeIdPattern.test(input.expectedCampaignId) ||
      !["development", "production", "staging"].includes(
        input.expectedEnvironment) ||
      !contentIdPattern.test(input.expectedTerminalRegistryReceiptId) ||
      !contentIdPattern.test(input.authorizationReceiptId) ||
      !contentIdPattern.test(input.deploymentReceiptId) ||
      !contentIdPattern.test(input.publicReadbackReceiptId) ||
      !contentIdPattern.test(input.releaseManifestId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
      utcNanoseconds(input.verificationTimeUtc) === null ||
      planInput && !contentIdPattern.test(input.operationId) ||
      !planInput && (!contentIdPattern.test(input.sitePublicationPlanReceiptId) ||
        !Buffer.isBuffer(input.sitePublisherSignatureReceiptBytes) ||
        input.sitePublisherSignatureReceiptBytes.length === 0 ||
        input.sitePublisherSignatureReceiptBytes.length >
          parsedProfile.limits.maximumSitePublicationSignatureReceiptBytes)) {
    failEvidence(code, step);
  }
  return Object.freeze({
    ...input,
    changelogBytes: Buffer.from(input.changelogBytes),
    equalityCustody,
    previousHistoryBytes,
    sitePublisherSignatureReceiptBytes: planInput
      ? null
      : Buffer.from(input.sitePublisherSignatureReceiptBytes),
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  });
}

function normalizeSitePublicationPlanInput(rawInput, equalityCustody) {
  return normalizeSitePublicationInput(
    rawInput,
    equalityCustody,
    sitePublicationPlanInputFields,
    "release_surface_site_publication_plan_input_invalid",
    "release-surface-site-publication-plan-input"
  );
}

function normalizeSitePublicationAuthorizationInput(rawInput, equalityCustody) {
  return normalizeSitePublicationInput(
    rawInput,
    equalityCustody,
    sitePublicationAuthorizationInputFields,
    "release_surface_site_publication_authorization_input_invalid",
    "release-surface-site-publication-authorization-input"
  );
}

function normalizeSitePublicationContinuationInput(
  rawInput,
  equalityCustody,
  fields,
  code,
  step
) {
  const input = exactDataObject(rawInput, fields, code, step);
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
  let previousHistoryBytes = null;
  if (input.previousHistoryBytes !== null) {
    if (!Buffer.isBuffer(input.previousHistoryBytes) ||
        input.previousHistoryBytes.length === 0 ||
        input.previousHistoryBytes.length >
          parsedProfile.limits.maximumSitePublicationHistoryBytes) {
      failEvidence(code, step);
    }
    previousHistoryBytes = Buffer.from(input.previousHistoryBytes);
  }
  const hasGeneratedReceiptBytes = fields === generatedDeploymentInputFields;
  const hasGeneratedReceiptId = fields !== generatedDeploymentInputFields;
  const hasGeneratedReadbackId = fields === sitePublicationFinalizationInputFields;
  const hasOperationId = fields !== generatedDeploymentInputFields;
  if (!Buffer.isBuffer(input.changelogBytes) || input.changelogBytes.length === 0 ||
      input.changelogBytes.length > parsedProfile.limits.maximumChangelogBytes ||
      typeof input.expectedCampaignId !== "string" ||
      !safeIdPattern.test(input.expectedCampaignId) ||
      !["development", "production", "staging"].includes(
        input.expectedEnvironment) ||
      !contentIdPattern.test(input.expectedTerminalRegistryReceiptId) ||
      !contentIdPattern.test(input.authorizationReceiptId) ||
      !contentIdPattern.test(input.deploymentReceiptId) ||
      !contentIdPattern.test(input.publicReadbackReceiptId) ||
      !contentIdPattern.test(input.releaseManifestId) ||
      !contentIdPattern.test(input.sitePublicationPlanReceiptId) ||
      !contentIdPattern.test(input.sitePublisherSignatureReceiptId) ||
      !sourceRevisionPattern.test(input.sourceRevision) ||
      !contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
      utcNanoseconds(input.verificationTimeUtc) === null ||
      hasOperationId && !contentIdPattern.test(input.operationId) ||
      hasGeneratedReceiptId &&
        !contentIdPattern.test(input.generatedDeploymentReceiptId) ||
      hasGeneratedReadbackId &&
        !contentIdPattern.test(input.generatedPublicReadbackReceiptId) ||
      hasGeneratedReceiptBytes &&
        (!Buffer.isBuffer(input.generatedDeploymentReceiptBytes) ||
          input.generatedDeploymentReceiptBytes.length === 0 ||
          input.generatedDeploymentReceiptBytes.length >
            parsedProfile.limits.maximumGeneratedDeploymentReceiptBytes)) {
    failEvidence(code, step);
  }
  return Object.freeze({
    ...input,
    changelogBytes: Buffer.from(input.changelogBytes),
    generatedDeploymentReceiptBytes: hasGeneratedReceiptBytes
      ? Buffer.from(input.generatedDeploymentReceiptBytes)
      : null,
    equalityCustody,
    previousHistoryBytes,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  });
}

function normalizeGeneratedDeploymentInput(rawInput, equalityCustody) {
  return normalizeSitePublicationContinuationInput(
    rawInput,
    equalityCustody,
    generatedDeploymentInputFields,
    "release_surface_generated_deployment_input_invalid",
    "release-surface-generated-deployment-input"
  );
}

function normalizeGeneratedPublicReadbackInput(rawInput, equalityCustody) {
  return normalizeSitePublicationContinuationInput(
    rawInput,
    equalityCustody,
    generatedPublicReadbackInputFields,
    "release_surface_generated_public_readback_input_invalid",
    "release-surface-generated-public-readback-input"
  );
}

function normalizeSitePublicationFinalizationInput(rawInput, equalityCustody) {
  return normalizeSitePublicationContinuationInput(
    rawInput,
    equalityCustody,
    sitePublicationFinalizationInputFields,
    "release_surface_site_publication_finalization_input_invalid",
    "release-surface-site-publication-finalization-input"
  );
}

function normalizeOptions(rawOptions, equalityCustody) {
  const options = exactDataObject(rawOptions, optionFields,
    "release_surface_options_invalid", "release-surface-open");
  if (!digestPattern.test(options.expectedWasmModuleSha256) ||
      !Buffer.isBuffer(options.wasmModuleBytes)) {
    failEvidence("release_surface_options_invalid", "release-surface-open");
  }
  const equalityCustodyBinding =
    inspectVnextProtectedEqualityCustody(equalityCustody);
  return Object.freeze({ ...options, equalityCustody, equalityCustodyBinding });
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
    equalityCustody: input.equalityCustody,
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
      equalityCustody: input.equalityCustody
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
    equalityCustody: input.equalityCustody,
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

function validateStoredDeploymentAttempt(input, release, storedAuthorization,
  receiptStore) {
  const step = "release-surface-public-readback-deployment";
  const stored = receiptStore.read(input.deploymentReceiptId);
  const deployment = validateDeploymentAttemptReceipt({
    ...input,
    deploymentReceiptBytes: stored.bytes
  }, release, storedAuthorization);
  if (deployment.receipt.receiptId !== input.deploymentReceiptId ||
      !deployment.bytes.equals(stored.bytes)) {
    failEvidence("release_surface_public_readback_deployment_invalid", step);
  }
  const activeReceipts = activeReceiptDocuments(receiptStore);
  const redactionAttemptId = `release-deployment-redaction-${
    input.deploymentReceiptId.slice("sha256:".length)}`;
  const redactionCandidates = [...activeReceipts.byId.values()].filter((entry) =>
    entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === redactionAttemptId);
  if (redactionCandidates.length !== 1) {
    failEvidence("release_surface_public_readback_deployment_redaction_missing", step);
  }
  const redaction = redactionCandidates[0];
  const verifiedScan = verifyVnextRedactionScanReceipt({
    equalityCustody: input.equalityCustody,
    receiptBytes: redaction.bytes,
    targetBytes: deployment.bytes,
    targetKind: "document"
  });
  if (!verifiedScan.publicSafe || verifiedScan.scanStatus !== "pass" ||
      redaction.receipt.campaignId !== input.expectedCampaignId ||
      redaction.receipt.sourceRevision !== input.sourceRevision ||
      redaction.receipt.startedAtUtc !== deployment.receipt.completedAtUtc ||
      redaction.receipt.completedAtUtc !== deployment.receipt.completedAtUtc ||
      compareUtc(deployment.receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_public_readback_time_invalid", step) > 0) {
    failEvidence("release_surface_public_readback_deployment_redaction_invalid", step);
  }
  return Object.freeze({
    activeReceipts,
    deployment,
    expectedReceiptIds: [...new Set([
      ...storedAuthorization.expectedReceiptIds,
      redaction.receipt.receiptId,
      deployment.receipt.receiptId
    ])].sort(),
    expectedSubjectIds: storedAuthorization.expectedSubjectIds,
    redaction
  });
}

function validateStoredStaticPublicReadback(input, release, storedDeployment,
  receiptStore) {
  const step = "release-surface-site-publication-static-readback";
  const stored = receiptStore.read(input.publicReadbackReceiptId);
  const validated = validateVnextReceiptBytes(stored.bytes);
  const receipt = validated.receipt;
  if (receipt.receiptId !== input.publicReadbackReceiptId ||
      receipt.receiptType !== parsedProfile.publicReadback.receiptType ||
      receipt.phase !== parsedProfile.publicReadback.phase ||
      receipt.status !== parsedProfile.publicReadback.status ||
      receipt.campaignId !== input.expectedCampaignId ||
      receipt.sourceRevision !== input.sourceRevision ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.signatureEnvelope !== null || receipt.authorityRegistry !== null ||
      receipt.keyRevocation !== null || receipt.offlineBundle !== null ||
      receipt.attestationReference !==
        release.value.campaignAttestationReceiptId ||
      !sameStrings(receipt.inputReceiptIds, [input.deploymentReceiptId]) ||
      compareUtc(storedDeployment.deployment.receipt.completedAtUtc,
        receipt.startedAtUtc,
        "release_surface_site_publication_static_readback_time_invalid", step) > 0 ||
      compareUtc(receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_site_publication_static_readback_time_invalid", step) > 0) {
    failEvidence("release_surface_site_publication_static_readback_invalid", step);
  }
  const activeReceipts = activeReceiptDocuments(receiptStore);
  const redactionAttemptId = `release-public-readback-redaction-${
    input.publicReadbackReceiptId.slice("sha256:".length)}`;
  const redactionCandidates = [...activeReceipts.byId.values()].filter((entry) =>
    entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === redactionAttemptId);
  if (redactionCandidates.length !== 1) {
    failEvidence("release_surface_site_publication_static_redaction_missing", step);
  }
  const redaction = redactionCandidates[0];
  const verifiedScan = verifyVnextRedactionScanReceipt({
    equalityCustody: input.equalityCustody,
    receiptBytes: redaction.bytes,
    targetBytes: stored.bytes,
    targetKind: "document"
  });
  if (!verifiedScan.publicSafe || verifiedScan.scanStatus !== "pass" ||
      redaction.receipt.campaignId !== input.expectedCampaignId ||
      redaction.receipt.sourceRevision !== input.sourceRevision ||
      redaction.receipt.startedAtUtc !== receipt.completedAtUtc ||
      redaction.receipt.completedAtUtc !== receipt.completedAtUtc) {
    failEvidence("release_surface_site_publication_static_redaction_invalid", step);
  }
  return Object.freeze({
    activeReceipts,
    expectedReceiptIds: [...new Set([
      ...storedDeployment.expectedReceiptIds,
      redaction.receipt.receiptId,
      receipt.receiptId
    ])].sort(),
    expectedSubjectIds: storedDeployment.expectedSubjectIds,
    readback: validated,
    redaction
  });
}

function currentSitePublicationReceipt(activeReceipts, planMaterial) {
  const candidates = [...activeReceipts.byId.values()].filter((entry) => {
    const receipt = entry.receipt;
    if (receipt.receiptType !== "site-synchronization" ||
        receipt.phase !== "site-publication" || receipt.status !== "pass") {
      return false;
    }
    const parameters = new Map(receipt.publicParameters.map((parameter) =>
      [parameter.name, parameter]));
    return parameters.get("site-id")?.value === planMaterial.siteId &&
      parameters.get("public-origin")?.value === planMaterial.publicOrigin;
  });
  const superseded = new Set(candidates.flatMap((entry) =>
    entry.receipt.supersedesReceiptIds));
  const current = candidates.filter((entry) =>
    !superseded.has(entry.receipt.receiptId));
  if (current.length > 1) {
    failEvidence("release_surface_site_publication_history_conflict",
      "release-surface-site-publication-history");
  }
  return current[0] ?? null;
}

function validatePreviousSitePublication(input, activeReceipts, planMaterial) {
  const step = "release-surface-site-publication-history";
  const current = currentSitePublicationReceipt(activeReceipts, planMaterial);
  if (current !== null && publicParameter(current.receipt, "subject_id",
    "release_surface_site_publication_history_unbound", step) ===
      planMaterial.releaseId) {
    if (current.receipt.supersedesReceiptIds.length === 0) {
      if (input.previousHistoryBytes !== null) {
        failEvidence("release_surface_site_publication_history_changed", step);
      }
      return null;
    }
    if (current.receipt.supersedesReceiptIds.length !== 1 ||
        input.previousHistoryBytes === null) {
      failEvidence("release_surface_site_publication_history_required", step);
    }
    const previous = activeReceipts.byId.get(current.receipt.supersedesReceiptIds[0]);
    if (!previous || previous.receipt.receiptType !== "site-synchronization" ||
        previous.receipt.phase !== "site-publication") {
      failEvidence("release_surface_site_publication_history_unbound", step);
    }
    const previousHistoryHash = hashBinding(previous.receipt, "outputHashes",
      "site-release-history", "release_surface_site_publication_history_unbound", step);
    if (previousHistoryHash !== sha256(input.previousHistoryBytes)) {
      failEvidence("release_surface_site_publication_history_changed", step);
    }
    return previous;
  }
  if (input.previousHistoryBytes === null) {
    if (current !== null) {
      failEvidence("release_surface_site_publication_history_required", step);
    }
    return null;
  }
  if (current === null) {
    failEvidence("release_surface_site_publication_history_unbound", step);
  }
  const historyHash = hashBinding(current.receipt, "outputHashes",
    "site-release-history", "release_surface_site_publication_history_unbound", step);
  if (historyHash !== sha256(input.previousHistoryBytes)) {
    failEvidence("release_surface_site_publication_history_changed", step);
  }
  return current;
}

function sitePublicationMaterialContext(input, release, staticReadback,
  subjectStore) {
  const approvedClaimBytes = release.value.claimIds.map((claimId) =>
    subjectStore.read(claimId).bytes);
  const material = createVnextSitePublicationPlanMaterial({
    approvedClaimBytes,
    previousHistoryBytes: input.previousHistoryBytes,
    publicReadbackReceiptBytes: staticReadback.readback.bytes,
    releaseManifestBytes: release.bytes,
    webPublicationGeneratorBytes: input.webPublicationGeneratorBytes
  });
  const previousPublication = validatePreviousSitePublication(
    input,
    staticReadback.activeReceipts,
    material.planMaterial
  );
  return Object.freeze({
    approvedClaimBytes,
    material,
    previousPublication,
    staticReadback
  });
}

function createSitePublicationPlanReceipt(input, release, context) {
  const material = context.material.planMaterial;
  const inputHashes = [
    { name: "approved-claim-set", sha256: material.approvedClaimSetSha256 },
    {
      name: "release-manifest-canonical-content",
      sha256: material.releaseManifestSha256
    },
    { name: "site-publication-profile", sha256: sitePublicationProfileSha256 },
    {
      name: "web-publication-generator",
      sha256: material.webPublicationGeneratorSha256
    },
    {
      name: "web-security-header-profile",
      sha256: material.webSecurityHeaderProfileSha256
    }
  ];
  if (material.previousHistorySha256 !== null) {
    inputHashes.push({
      name: sitePublicationProfile.plan.optionalInputHashName,
      sha256: material.previousHistorySha256
    });
  }
  const publicParameters = [
    {
      name: "evidence-scope",
      value: parsedProfile.sitePublicationPlan.evidenceScope,
      unit: null
    },
    { name: "operation_id", value: input.operationId, unit: null },
    { name: "public-origin", value: material.publicOrigin, unit: null },
    { name: "site-id", value: material.siteId, unit: null },
    { name: "subject_id", value: material.releaseId, unit: null }
  ].sort((left, right) => left.name.localeCompare(right.name));
  return finalizeVnextReceipt({
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: parsedProfile.sitePublicationPlan.receiptType,
    campaignId: input.expectedCampaignId,
    attemptId: input.operationId,
    phase: parsedProfile.sitePublicationPlan.phase,
    status: parsedProfile.sitePublicationPlan.status,
    startedAtUtc: input.verificationTimeUtc,
    completedAtUtc: input.verificationTimeUtc,
    sourceRevision: input.sourceRevision,
    inputReceiptIds: [input.publicReadbackReceiptId],
    inputHashes: inputHashes.sort((left, right) => left.name.localeCompare(right.name)),
    outputHashes: [{
      name: sitePublicationProfile.plan.outputHashName,
      sha256: context.material.planMaterialSha256
    }],
    tools: [
      {
        name: "tinyrustlm.vnext.campaign-release-surface",
        version: "1.0.0",
        binarySha256: sourceSha256
      },
      {
        name: "tinyrustlm.vnext.site-publication",
        version: "1.0.0",
        binarySha256: sitePublicationSourceSha256
      }
    ],
    configurationSha256: domainSeparatedDigest(
      sitePublicationProfile.plan.configurationIdentityDomain,
      {
        profileSha256: sitePublicationProfileSha256,
        webPublicationGeneratorSha256: material.webPublicationGeneratorSha256
      }
    ),
    runtime: runtimeRecord(),
    publicParameters,
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [],
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: release.value.campaignAttestationReceiptId,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  });
}

function sitePublicationScan(input, targetBytes, targetKind, label) {
  let scanner;
  if (targetKind === "document") {
    scanner = scanVnextPublicDocumentBytes;
  } else if (targetKind === "public-json-control") {
    scanner = scanVnextPublicJsonControlBytes;
  } else if (targetKind === "public-text") {
    scanner = scanVnextPublicTextBytes;
  } else {
    failEvidence("release_surface_site_publication_redaction_target_invalid",
      "release-surface-site-publication-redaction");
  }
  const scan = scanner(targetBytes, { equalityCustody: input.equalityCustody });
  const attemptIdentity = domainSeparatedDigest(
    "tinyrustlm.site_publication.redaction_attempt.v1",
    { label, targetSha256: sha256(targetBytes) }
  );
  const receipt = createVnextRedactionScanReceipt({
    attemptId: `site-publication-redaction-${attemptIdentity}`,
    campaignId: input.expectedCampaignId,
    completedAtUtc: input.verificationTimeUtc,
    scan,
    sourceRevision: input.sourceRevision,
    startedAtUtc: input.verificationTimeUtc
  });
  return Object.freeze({ label, receipt, scan, targetBytes, targetKind });
}

function sitePublicationPlanArtifacts(input, release, context) {
  const planReceipt = createSitePublicationPlanReceipt(input, release, context);
  const scans = [];
  if (input.previousHistoryBytes !== null) {
    scans.push(sitePublicationScan(input, input.previousHistoryBytes,
      "public-json-control",
      "previous-history-redaction"));
  }
  scans.push(sitePublicationScan(input, context.material.planMaterialBytes,
    "public-json-control", "plan-material-redaction"));
  scans.push(sitePublicationScan(input, planReceipt.bytes, "document",
    "plan-receipt-redaction"));
  return Object.freeze({ planReceipt, scans: Object.freeze(scans) });
}

function receiptPrefixLength(currentReceiptIds, baseReceiptIds, descendants,
  code, step) {
  const uniqueBase = [...new Set(baseReceiptIds)].sort();
  const uniqueDescendants = [];
  const seen = new Set(uniqueBase);
  for (const receiptId of descendants) {
    if (seen.has(receiptId)) failEvidence(code, step);
    seen.add(receiptId);
    uniqueDescendants.push(receiptId);
  }
  for (let length = 0; length <= uniqueDescendants.length; length += 1) {
    const expected = [...uniqueBase, ...uniqueDescendants.slice(0, length)].sort();
    if (sameStrings(currentReceiptIds, expected)) return length;
  }
  failEvidence(code, step);
}

function validateStoredSitePublicationPlan(input, release, context, receiptStore) {
  const step = "release-surface-site-publication-plan";
  const stored = receiptStore.read(input.sitePublicationPlanReceiptId);
  const validated = validateVnextReceiptBytes(stored.bytes);
  if (validated.receipt.receiptId !== input.sitePublicationPlanReceiptId ||
      compareUtc(validated.receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_site_publication_plan_time_invalid", step) > 0) {
    failEvidence("release_surface_site_publication_plan_invalid", step);
  }
  const planInput = Object.freeze({
    ...input,
    operationId: validated.receipt.attemptId,
    verificationTimeUtc: validated.receipt.completedAtUtc
  });
  const artifacts = sitePublicationPlanArtifacts(planInput, release, context);
  if (artifacts.planReceipt.receipt.receiptId !== input.sitePublicationPlanReceiptId ||
      !artifacts.planReceipt.bytes.equals(stored.bytes)) {
    failEvidence("release_surface_site_publication_plan_changed", step);
  }
  for (const scan of artifacts.scans) {
    const persisted = receiptStore.read(scan.receipt.receipt.receiptId);
    if (!persisted.bytes.equals(scan.receipt.bytes)) {
      failEvidence("release_surface_site_publication_plan_redaction_changed", step);
    }
    const verified = verifyVnextRedactionScanReceipt({
      equalityCustody: input.equalityCustody,
      receiptBytes: persisted.bytes,
      targetBytes: scan.targetBytes,
      targetKind: scan.targetKind
    });
    if (!verified.publicSafe || verified.scanStatus !== "pass") {
      failEvidence("release_surface_site_publication_plan_redaction_invalid", step);
    }
  }
  return Object.freeze({ artifacts, planInput, stored: validated });
}

function verifySitePublisherAuthority(input, release, plan, signature,
  activeReceipts, subjectStore) {
  const step = "release-surface-site-publisher-authority";
  const receiptBytesById = new Map([...activeReceipts.byId].map(([receiptId, entry]) =>
    [receiptId, entry.bytes]));
  const existing = receiptBytesById.get(signature.receipt.receiptId);
  if (existing && !existing.equals(signature.bytes)) {
    failEvidence("release_surface_site_publisher_identity_collision", step);
  }
  receiptBytesById.set(signature.receipt.receiptId, signature.bytes);
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
  const signatures = authority.signatures.filter((entry) =>
    entry.role === parsedProfile.sitePublicationAuthorization.role &&
      entry.scope === parsedProfile.sitePublicationAuthorization.scope &&
      entry.signedSubjectId === plan.receipt.receiptId &&
      entry.signedSchema === plan.receipt.schema);
  const envelope = signature.receipt.signatureEnvelope;
  if (signatures.length !== 1 ||
      signatures[0].signatureReceiptId !== signature.receipt.receiptId ||
      signatures[0].authorityRegistryReceiptId !==
        envelope.authorityRegistryReceiptId ||
      signatures[0].signatureVerified !== true ||
      signatures[0].authorityAtIssue !== true ||
      signatures[0].temporalCurrent !== true ||
      signatures[0].currentEvidenceEligible !== true ||
      signatures[0].staleReasons.length !== 0 ||
      authority.terminalRegistryCurrent !== true ||
      envelope.releaseId !== release.subjectId) {
    failEvidence("release_surface_site_publisher_not_current", step);
  }
  return Object.freeze({ authority, signature: signatures[0] });
}

function sitePublicationCandidateScans(input, materialized, signature) {
  return Object.freeze([
    sitePublicationScan(input, signature.bytes, "document",
      "site-publisher-signature-redaction"),
    sitePublicationScan(input, materialized.pointerBytes, "public-json-control",
      "pointer-redaction"),
    sitePublicationScan(input, materialized.historyBytes, "public-json-control",
      "history-redaction"),
    ...materialized.publishedClaims.map((claim) => sitePublicationScan(
      input,
      claim.claimBytes,
      "document",
      `published-claim-redaction-${claim.claimId.slice("sha256:".length)}`
    ))
  ]);
}

function sitePublicationPlanReceiptIds(staticReadback, storedPlan) {
  return [...new Set([
    ...staticReadback.expectedReceiptIds,
    ...storedPlan.artifacts.scans.map((entry) => entry.receipt.receipt.receiptId),
    storedPlan.stored.receipt.receiptId
  ])].sort();
}

function validateStoredSitePublicationAuthorization(input, reconstructed,
  receiptStore, subjectStore) {
  const step = "release-surface-stored-site-publication-authorization";
  const { publication, release, staticReadback } = reconstructed;
  const storedPlan = validateStoredSitePublicationPlan(
    input,
    release,
    publication,
    receiptStore
  );
  const storedSignature = receiptStore.read(input.sitePublisherSignatureReceiptId);
  const signature = validateVnextReceiptBytes(storedSignature.bytes);
  if (signature.receipt.receiptId !== input.sitePublisherSignatureReceiptId ||
      !signature.bytes.equals(storedSignature.bytes)) {
    failEvidence("release_surface_site_publisher_signature_invalid", step);
  }
  const materialized = materializeVnextSitePublication({
    approvedClaimBytes: publication.approvedClaimBytes,
    previousHistoryBytes: input.previousHistoryBytes,
    publicReadbackReceiptBytes: staticReadback.readback.bytes,
    releaseManifestBytes: release.bytes,
    sitePublicationPlanReceiptBytes: storedPlan.stored.bytes,
    sitePublisherSignatureReceiptBytes: signature.bytes,
    webPublicationGeneratorBytes: input.webPublicationGeneratorBytes
  });
  const probe = sitePublicationCandidateScans(input, materialized, signature)[0];
  const candidates = [...staticReadback.activeReceipts.byId.values()].filter((entry) =>
    entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === probe.receipt.receipt.attemptId);
  if (candidates.length !== 1) {
    failEvidence("release_surface_site_publisher_redaction_missing", step);
  }
  const authorizationTimeUtc = candidates[0].receipt.completedAtUtc;
  if (candidates[0].receipt.startedAtUtc !== authorizationTimeUtc ||
      compareUtc(signature.receipt.signatureEnvelope.issuedAtUtc,
        authorizationTimeUtc,
        "release_surface_site_publisher_time_invalid", step) > 0 ||
      compareUtc(authorizationTimeUtc, input.verificationTimeUtc,
        "release_surface_site_publisher_time_invalid", step) > 0) {
    failEvidence("release_surface_site_publisher_time_invalid", step);
  }
  const scans = sitePublicationCandidateScans(Object.freeze({
    ...input,
    verificationTimeUtc: authorizationTimeUtc
  }), materialized, signature);
  for (const scan of scans) {
    const persisted = receiptStore.read(scan.receipt.receipt.receiptId);
    if (!persisted.bytes.equals(scan.receipt.bytes)) {
      failEvidence("release_surface_site_publication_candidate_changed", step);
    }
    const verified = verifyVnextRedactionScanReceipt({
      equalityCustody: input.equalityCustody,
      receiptBytes: persisted.bytes,
      targetBytes: scan.targetBytes,
      targetKind: scan.targetKind
    });
    if (!verified.publicSafe || verified.scanStatus !== "pass") {
      failEvidence("release_surface_site_publication_candidate_unsafe", step);
    }
  }
  const authority = verifySitePublisherAuthority(
    input,
    release,
    storedPlan.stored,
    signature,
    staticReadback.activeReceipts,
    subjectStore
  );
  const planReceiptIds = sitePublicationPlanReceiptIds(staticReadback, storedPlan);
  const expectedReceiptIds = [...new Set([
    ...planReceiptIds,
    ...scans.map((entry) => entry.receipt.receipt.receiptId),
    signature.receipt.receiptId
  ])].sort();
  return Object.freeze({
    authority,
    authorizationTimeUtc,
    candidateScans: scans,
    expectedReceiptIds,
    expectedSubjectIds: staticReadback.expectedSubjectIds,
    materialized,
    planReceiptIds,
    signature,
    storedPlan
  });
}

function assertReadbackPrefixCandidate(receiptStore, subjectStore,
  expectedReceiptIds, expectedSubjectIds) {
  const step = "release-surface-public-readback-prefix";
  const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
  const base = new Set(expectedReceiptIds);
  if (expectedReceiptIds.some((receiptId) => !currentReceiptIds.includes(receiptId))) {
    failEvidence("release_surface_receipt_snapshot_member_missing", step);
  }
  const extras = currentReceiptIds.filter((receiptId) => !base.has(receiptId));
  if (extras.length > 2 || currentReceiptIds.length !== expectedReceiptIds.length +
      extras.length) {
    failEvidence("release_surface_public_readback_snapshot_changed", step);
  }
  const currentSubjectIds = subjectStore.rebuild().activeSubjectIds;
  if (!sameStrings(currentSubjectIds, expectedSubjectIds)) {
    failEvidence("release_surface_public_readback_subject_snapshot_changed", step);
  }
  return Object.freeze({ currentReceiptIds, extras });
}

function readCanonicalPublicReadbackResult(rawResult, expectedGraph,
  webSecurityHeaderProfileBytes) {
  const step = "release-surface-public-readback-result";
  if (!isPlainObject(rawResult) || Object.getOwnPropertySymbols(rawResult).length !== 0) {
    failEvidence("release_surface_public_readback_result_invalid", step);
  }
  const expectedWrapperFields = [...publicReadbackResultFields,
    "resultBytes", "resultSha256"].sort();
  const wrapperFields = Object.getOwnPropertyNames(rawResult).sort();
  if (!sameStrings(wrapperFields, expectedWrapperFields)) {
    failEvidence("release_surface_public_readback_result_invalid", step);
  }
  const wrapperValue = {};
  for (const field of publicReadbackResultFields) {
    const descriptor = Object.getOwnPropertyDescriptor(rawResult, field);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence("release_surface_public_readback_result_accessor", step);
    }
    wrapperValue[field] = descriptor.value;
  }
  const bytesDescriptor = Object.getOwnPropertyDescriptor(rawResult, "resultBytes");
  const shaDescriptor = Object.getOwnPropertyDescriptor(rawResult, "resultSha256");
  if (!bytesDescriptor || !bytesDescriptor.enumerable ||
      typeof bytesDescriptor.get !== "function" || bytesDescriptor.set !== undefined ||
      !shaDescriptor || !shaDescriptor.enumerable || !("value" in shaDescriptor) ||
      !digestPattern.test(shaDescriptor.value)) {
    failEvidence("release_surface_public_readback_result_invalid", step);
  }
  let bytes;
  try {
    bytes = bytesDescriptor.get.call(rawResult);
  } catch {
    failEvidence("release_surface_public_readback_result_accessor", step);
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 ||
      bytes.length > parsedProfile.limits.maximumPublicReadbackResultBytes ||
      sha256(bytes) !== shaDescriptor.value) {
    failEvidence("release_surface_public_readback_result_invalid", step);
  }
  let result;
  try {
    result = parseStrictJson(bytes);
  } catch {
    failEvidence("release_surface_public_readback_result_invalid", step);
  }
  exactDataObject(result, publicReadbackResultFields,
    "release_surface_public_readback_result_invalid", step);
  if (!canonicalizeVnextJcsBytes(result).equals(bytes) ||
      !canonicalizeVnextJcsBytes(wrapperValue).equals(bytes)) {
    failEvidence("release_surface_public_readback_result_wire_invalid", step);
  }
  const observations = dataArray(result.observations,
    publicHttpsReadbackProfile.limits.maximumAssets,
    "release_surface_public_readback_observations_invalid", step);
  const security = validateVnextWebSecurityHeaderProfileBytes(
    webSecurityHeaderProfileBytes
  );
  const manifest = expectedGraph;
  if (result.schema !== publicHttpsReadbackProfile.resultSchema ||
      result.profileId !== publicHttpsReadbackProfile.profileId ||
      result.profileSha256 !== publicHttpsReadbackProfileSha256 ||
      result.verifierSourceSha256 !== publicHttpsReadbackSourceSha256 ||
      result.publicOrigin !== manifest.publicOrigin ||
      result.assetCount !== manifest.webAssets.length ||
      result.totalBytes !== manifest.webTotalBytes ||
      !Number.isSafeInteger(result.dnsAddressCount) || result.dnsAddressCount < 1 ||
      result.dnsAddressCount > publicHttpsReadbackProfile.limits.maximumDnsAddresses ||
      !Number.isSafeInteger(result.certificateCount) || result.certificateCount < 1 ||
      result.certificateCount >
        publicHttpsReadbackProfile.limits.maximumCertificates ||
      !digestPattern.test(result.observationInventorySha256) ||
      !digestPattern.test(result.dnsAddressSetSha256) ||
      !digestPattern.test(result.pinnedAddressSha256) ||
      !digestPattern.test(result.certificateSetSha256) ||
      result.securityHeaderProfileSha256 !== security.profileSha256 ||
      observations.length !== manifest.webAssets.length) {
    failEvidence("release_surface_public_readback_result_invalid", step);
  }
  const normalizedObservations = observations.map((entry, index) => {
    const observation = exactDataObject(entry, publicReadbackObservationFields,
      "release_surface_public_readback_observations_invalid", step);
    const asset = manifest.webAssets[index];
    if (observation.path !== asset.path ||
        observation.byteLength !== asset.byteLength ||
        observation.sha256 !== asset.sha256 ||
        observation.contentType !== asset.contentType ||
        observation.cacheControl !== security.cacheControlByPolicy[asset.cachePolicy] ||
        observation.securityHeaderProfileSha256 !==
          asset.securityHeaderProfileSha256 ||
        observation.statusCode !== publicHttpsReadbackProfile.response.requiredStatus ||
        !["TLSv1.2", "TLSv1.3"].includes(observation.tlsProtocol)) {
      failEvidence("release_surface_public_readback_observations_invalid", step);
    }
    return Object.freeze({ ...observation });
  });
  const observationInventorySha256 = domainSeparatedDigest(
    publicHttpsReadbackProfile.observation.inventoryIdentityDomain,
    normalizedObservations
  );
  if (result.observationInventorySha256 !== observationInventorySha256) {
    failEvidence("release_surface_public_readback_inventory_invalid", step);
  }
  return Object.freeze({
    bytes: Buffer.from(bytes),
    result: deepFreeze({
      ...result,
      observations: normalizedObservations
    }),
    resultSha256: shaDescriptor.value,
    security
  });
}

function createPublicReadbackReceipt(input, release, storedAuthorization,
  storedDeployment, verifiedResult) {
  const manifest = release.value;
  const result = verifiedResult.result;
  const configurationSha256 = domainSeparatedDigest(
    parsedProfile.publicReadback.configurationIdentityDomain,
    {
      campaignReleaseSurfaceProfileSha256,
      publicHttpsReadbackProfileSha256,
      publicHttpsReadbackSourceSha256,
      webSecurityHeaderProfileSha256: manifest.webSecurityHeaderProfileSha256
    }
  );
  const inputHashes = [
    {
      name: "campaign-release-surface-profile",
      sha256: campaignReleaseSurfaceProfileSha256
    },
    {
      name: "deployment-attempt-canonical-content",
      sha256: storedDeployment.deployment.receipt.canonicalContentSha256
    },
    {
      name: "public-https-readback-profile",
      sha256: publicHttpsReadbackProfileSha256
    },
    {
      name: "release-authorization-canonical-content",
      sha256: storedAuthorization.authorization.receipt.canonicalContentSha256
    },
    {
      name: "release-manifest-canonical-content",
      sha256: release.canonicalContentSha256
    },
    {
      name: "web-asset-inventory",
      sha256: storedDeployment.deployment.webAssetInventorySha256
    },
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
  ].sort((left, right) => left.name.localeCompare(right.name));
  const outputHashes = [
    { name: "certificate-set", sha256: result.certificateSetSha256 },
    { name: "dns-address-set", sha256: result.dnsAddressSetSha256 },
    {
      name: "public-https-readback-observation-inventory",
      sha256: result.observationInventorySha256
    },
    {
      name: "public-https-readback-result",
      sha256: verifiedResult.resultSha256
    },
    { name: "public-https-readback-selected-address", sha256:
      result.pinnedAddressSha256 },
    {
      name: "verified-web-asset-inventory",
      sha256: storedDeployment.deployment.webAssetInventorySha256
    }
  ].sort((left, right) => left.name.localeCompare(right.name));
  const publicParameters = [
    { name: "asset-count", value: String(result.assetCount), unit: "assets" },
    {
      name: "authorization-receipt-id",
      value: input.authorizationReceiptId,
      unit: null
    },
    {
      name: "certificate-count",
      value: String(result.certificateCount),
      unit: "certificates"
    },
    {
      name: "deployment-receipt-id",
      value: input.deploymentReceiptId,
      unit: null
    },
    {
      name: "dns-address-count",
      value: String(result.dnsAddressCount),
      unit: "addresses"
    },
    {
      name: "evidence-scope",
      value: parsedProfile.publicReadback.evidenceScope,
      unit: null
    },
    { name: "operation_id", value: input.operationId, unit: null },
    { name: "public-origin", value: manifest.publicOrigin, unit: null },
    {
      name: "public-readback-profile-id",
      value: publicHttpsReadbackProfile.profileId,
      unit: null
    },
    { name: "subject_id", value: input.releaseManifestId, unit: null },
    { name: "total-bytes", value: String(result.totalBytes), unit: "bytes" }
  ].sort((left, right) => left.name.localeCompare(right.name));
  return finalizeVnextReceipt({
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: parsedProfile.publicReadback.receiptType,
    campaignId: input.expectedCampaignId,
    attemptId: input.operationId,
    phase: parsedProfile.publicReadback.phase,
    status: parsedProfile.publicReadback.status,
    startedAtUtc: input.verificationTimeUtc,
    completedAtUtc: input.verificationTimeUtc,
    sourceRevision: input.sourceRevision,
    inputReceiptIds: [input.deploymentReceiptId],
    inputHashes,
    outputHashes,
    tools: [
      {
        name: "tinyrustlm.vnext.campaign-release-surface",
        version: "1.0.0",
        binarySha256: sourceSha256
      },
      {
        name: "tinyrustlm.vnext.public-https-readback",
        version: "1.0.0",
        binarySha256: publicHttpsReadbackSourceSha256
      }
    ],
    configurationSha256,
    runtime: runtimeRecord("deployment"),
    publicParameters,
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [
      { kind: "https", value: manifest.publicOrigin },
      { kind: "receipt", value: input.deploymentReceiptId }
    ].sort((left, right) => left.value.localeCompare(right.value)),
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: manifest.campaignAttestationReceiptId,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  });
}

function exactHashBindings(actual, expected, code, step) {
  const sorted = [...expected].sort((left, right) => left.name.localeCompare(right.name));
  if (actual.length !== sorted.length || actual.some((entry, index) =>
    entry.name !== sorted[index].name || entry.sha256 !== sorted[index].sha256)) {
    failEvidence(code, step);
  }
}

function combinedPublicationGraph(release, materialized) {
  const step = "release-surface-complete-publication-graph";
  const webAssets = [
    ...release.value.webAssets.map((entry) => ({ ...entry })),
    ...materialized.generatedAssets.map((entry) => ({ ...entry }))
  ].sort((left, right) => left.path.localeCompare(right.path));
  if (webAssets.length !== release.value.webAssets.length +
      materialized.generatedAssets.length || webAssets.some((entry, index) =>
        index > 0 && webAssets[index - 1].path >= entry.path)) {
    failEvidence("release_surface_complete_publication_graph_invalid", step);
  }
  const webTotalBytes = webAssets.reduce((total, entry) => total + entry.byteLength, 0);
  if (!Number.isSafeInteger(webTotalBytes) ||
      webAssets.length > publicHttpsReadbackProfile.limits.maximumAssets ||
      webTotalBytes > publicHttpsReadbackProfile.limits.maximumTotalBytes) {
    failEvidence("release_surface_complete_publication_graph_limit", step);
  }
  const combinedAssetInventorySha256 = domainSeparatedDigest(
    parsedProfile.generatedPublicReadback.combinedAssetInventoryIdentityDomain,
    webAssets
  );
  return Object.freeze({
    combinedAssetInventorySha256,
    publicOrigin: release.value.publicOrigin,
    webAssets: Object.freeze(webAssets.map((entry) => Object.freeze(entry))),
    webTotalBytes
  });
}

function validateGeneratedDeploymentAttemptReceipt(input, reconstructed,
  authorization) {
  const step = "release-surface-generated-deployment-receipt";
  const { release } = reconstructed;
  const materialized = authorization.materialized;
  const validated = validateVnextReceiptBytes(input.generatedDeploymentReceiptBytes);
  const receipt = validated.receipt;
  const expectedInputReceiptIds = [
    input.publicReadbackReceiptId,
    input.sitePublicationPlanReceiptId,
    input.sitePublisherSignatureReceiptId
  ].sort();
  const expectedInputHashes = [
    {
      name: "generated-asset-inventory",
      sha256: materialized.generatedInventorySha256
    },
    {
      name: "release-manifest-canonical-content",
      sha256: release.canonicalContentSha256
    },
    {
      name: "site-publication-plan-material",
      sha256: materialized.planMaterialSha256
    },
    { name: "site-publication-profile", sha256: sitePublicationProfileSha256 },
    {
      name: "site-publisher-signature-canonical-content",
      sha256: authorization.signature.receipt.canonicalContentSha256
    },
    {
      name: "web-publication-generator",
      sha256: release.value.webPublicationGeneratorSha256
    },
    {
      name: "web-security-header-profile",
      sha256: release.value.webSecurityHeaderProfileSha256
    }
  ];
  exactHashBindings(receipt.inputHashes, expectedInputHashes,
    "release_surface_generated_deployment_input_hash_invalid", step);
  const submittedInventory = hashBinding(receipt, "outputHashes",
    "submitted-generated-asset-inventory",
    "release_surface_generated_deployment_output_invalid", step);
  if (submittedInventory !== materialized.generatedInventorySha256 ||
      receipt.outputHashes.length !== 2 ||
      !sameStrings(receipt.outputHashes.map((entry) => entry.name), [
        "deployment-attempt-transcript",
        "submitted-generated-asset-inventory"
      ])) {
    failEvidence("release_surface_generated_deployment_output_invalid", step);
  }
  exactPublicParameters(receipt, [
    {
      name: "asset-count",
      value: String(materialized.generatedAssets.length),
      unit: "assets"
    },
    {
      name: "authorization-receipt-id",
      value: input.sitePublisherSignatureReceiptId,
      unit: null
    },
    {
      name: "evidence-scope",
      value: parsedProfile.generatedDeployment.evidenceScope,
      unit: null
    },
    { name: "operation_id", value: receipt.attemptId, unit: null },
    { name: "public-origin", value: release.value.publicOrigin, unit: null },
    { name: "site-id", value: materialized.planMaterial.siteId, unit: null },
    { name: "subject_id", value: input.releaseManifestId, unit: null },
    {
      name: "total-bytes",
      value: String(materialized.generatedTotalBytes),
      unit: "bytes"
    }
  ], "release_surface_generated_deployment_parameters_invalid", step);
  if (receipt.receiptType !== parsedProfile.generatedDeployment.receiptType ||
      receipt.phase !== parsedProfile.generatedDeployment.phase ||
      receipt.status !== parsedProfile.generatedDeployment.status ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.campaignId !== input.expectedCampaignId ||
      receipt.sourceRevision !== input.sourceRevision ||
      !contentIdPattern.test(receipt.attemptId) ||
      !sameStrings(receipt.inputReceiptIds, expectedInputReceiptIds) ||
      receipt.runtime.executionClass !== "deployment" ||
      receipt.externalEvidenceReferences.length !== 2 ||
      !receipt.externalEvidenceReferences.some((entry) =>
        entry.kind === "https" && entry.value === release.value.publicOrigin) ||
      !receipt.externalEvidenceReferences.some((entry) =>
        entry.kind === "receipt" &&
          entry.value === input.sitePublisherSignatureReceiptId) ||
      receipt.attestationReference !== release.value.campaignAttestationReceiptId ||
      receipt.signatureEnvelope !== null || receipt.authorityRegistry !== null ||
      receipt.keyRevocation !== null || receipt.offlineBundle !== null ||
      receipt.supersedesReceiptIds.length !== 0 ||
      compareUtc(authorization.authorizationTimeUtc, receipt.startedAtUtc,
        "release_surface_generated_deployment_time_invalid", step) > 0 ||
      compareUtc(receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_generated_deployment_time_invalid", step) > 0) {
    failEvidence("release_surface_generated_deployment_receipt_invalid", step);
  }
  return Object.freeze({ ...validated });
}

function validateStoredGeneratedDeploymentAttempt(input, reconstructed,
  authorization, receiptStore) {
  const step = "release-surface-stored-generated-deployment";
  const stored = receiptStore.read(input.generatedDeploymentReceiptId);
  const deployment = validateGeneratedDeploymentAttemptReceipt({
    ...input,
    generatedDeploymentReceiptBytes: stored.bytes
  }, reconstructed, authorization);
  if (deployment.receipt.receiptId !== input.generatedDeploymentReceiptId ||
      !deployment.bytes.equals(stored.bytes)) {
    failEvidence("release_surface_generated_deployment_identity_invalid", step);
  }
  const activeReceipts = activeReceiptDocuments(receiptStore);
  const attemptId = `generated-deployment-redaction-${
    deployment.receipt.receiptId.slice("sha256:".length)}`;
  const candidates = [...activeReceipts.byId.values()].filter((entry) =>
    entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === attemptId);
  if (candidates.length !== 1) {
    failEvidence("release_surface_generated_deployment_redaction_missing", step);
  }
  const redaction = candidates[0];
  const verified = verifyVnextRedactionScanReceipt({
    equalityCustody: input.equalityCustody,
    receiptBytes: redaction.bytes,
    targetBytes: deployment.bytes,
    targetKind: "document"
  });
  if (!verified.publicSafe || verified.scanStatus !== "pass" ||
      redaction.receipt.campaignId !== input.expectedCampaignId ||
      redaction.receipt.sourceRevision !== input.sourceRevision ||
      redaction.receipt.startedAtUtc !== deployment.receipt.completedAtUtc ||
      redaction.receipt.completedAtUtc !== deployment.receipt.completedAtUtc ||
      compareUtc(deployment.receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_generated_deployment_time_invalid", step) > 0) {
    failEvidence("release_surface_generated_deployment_redaction_invalid", step);
  }
  return Object.freeze({
    activeReceipts,
    deployment,
    expectedReceiptIds: [...new Set([
      ...authorization.expectedReceiptIds,
      redaction.receipt.receiptId,
      deployment.receipt.receiptId
    ])].sort(),
    expectedSubjectIds: authorization.expectedSubjectIds,
    redaction
  });
}

function createGeneratedPublicReadbackReceipt(input, reconstructed,
  authorization, storedGenerated, graph, verifiedResult) {
  const release = reconstructed.release;
  const materialized = authorization.materialized;
  const result = verifiedResult.result;
  const inputHashes = [
    {
      name: "campaign-release-surface-profile",
      sha256: campaignReleaseSurfaceProfileSha256
    },
    {
      name: "complete-web-asset-inventory",
      sha256: graph.combinedAssetInventorySha256
    },
    {
      name: "generated-asset-inventory",
      sha256: materialized.generatedInventorySha256
    },
    {
      name: "generated-deployment-attempt-canonical-content",
      sha256: storedGenerated.deployment.receipt.canonicalContentSha256
    },
    {
      name: "public-https-readback-profile",
      sha256: publicHttpsReadbackProfileSha256
    },
    {
      name: "release-manifest-canonical-content",
      sha256: release.canonicalContentSha256
    },
    {
      name: "site-publication-plan-material",
      sha256: materialized.planMaterialSha256
    },
    { name: "site-publication-profile", sha256: sitePublicationProfileSha256 },
    {
      name: "site-publisher-signature-canonical-content",
      sha256: authorization.signature.receipt.canonicalContentSha256
    },
    {
      name: "static-public-readback-canonical-content",
      sha256: reconstructed.staticReadback.readback.receipt.canonicalContentSha256
    },
    {
      name: "web-security-header-profile",
      sha256: release.value.webSecurityHeaderProfileSha256
    }
  ].sort((left, right) => left.name.localeCompare(right.name));
  const outputHashes = [
    { name: "certificate-set", sha256: result.certificateSetSha256 },
    {
      name: "complete-web-asset-inventory",
      sha256: graph.combinedAssetInventorySha256
    },
    { name: "dns-address-set", sha256: result.dnsAddressSetSha256 },
    {
      name: "generated-asset-inventory",
      sha256: materialized.generatedInventorySha256
    },
    {
      name: "public-https-readback-observation-inventory",
      sha256: result.observationInventorySha256
    },
    {
      name: "public-https-readback-result",
      sha256: verifiedResult.resultSha256
    },
    {
      name: "public-https-readback-selected-address",
      sha256: result.pinnedAddressSha256
    }
  ].sort((left, right) => left.name.localeCompare(right.name));
  const publicParameters = [
    { name: "asset-count", value: String(result.assetCount), unit: "assets" },
    {
      name: "certificate-count",
      value: String(result.certificateCount),
      unit: "certificates"
    },
    {
      name: "dns-address-count",
      value: String(result.dnsAddressCount),
      unit: "addresses"
    },
    {
      name: "evidence-scope",
      value: parsedProfile.generatedPublicReadback.evidenceScope,
      unit: null
    },
    {
      name: "generated-asset-count",
      value: String(materialized.generatedAssets.length),
      unit: "assets"
    },
    {
      name: "generated-deployment-receipt-id",
      value: input.generatedDeploymentReceiptId,
      unit: null
    },
    { name: "operation_id", value: input.operationId, unit: null },
    { name: "public-origin", value: release.value.publicOrigin, unit: null },
    {
      name: "public-readback-profile-id",
      value: publicHttpsReadbackProfile.profileId,
      unit: null
    },
    { name: "site-id", value: materialized.planMaterial.siteId, unit: null },
    { name: "subject_id", value: input.releaseManifestId, unit: null },
    { name: "total-bytes", value: String(result.totalBytes), unit: "bytes" }
  ].sort((left, right) => left.name.localeCompare(right.name));
  return finalizeVnextReceipt({
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: parsedProfile.generatedPublicReadback.receiptType,
    campaignId: input.expectedCampaignId,
    attemptId: input.operationId,
    phase: parsedProfile.generatedPublicReadback.phase,
    status: parsedProfile.generatedPublicReadback.status,
    startedAtUtc: input.verificationTimeUtc,
    completedAtUtc: input.verificationTimeUtc,
    sourceRevision: input.sourceRevision,
    inputReceiptIds: [input.generatedDeploymentReceiptId],
    inputHashes,
    outputHashes,
    tools: [
      {
        name: "tinyrustlm.vnext.campaign-release-surface",
        version: "1.0.0",
        binarySha256: sourceSha256
      },
      {
        name: "tinyrustlm.vnext.public-https-readback",
        version: "1.0.0",
        binarySha256: publicHttpsReadbackSourceSha256
      },
      {
        name: "tinyrustlm.vnext.site-publication",
        version: "1.0.0",
        binarySha256: sitePublicationSourceSha256
      }
    ],
    configurationSha256: domainSeparatedDigest(
      parsedProfile.generatedPublicReadback.configurationIdentityDomain,
      {
        campaignReleaseSurfaceProfileSha256,
        publicHttpsReadbackProfileSha256,
        sitePublicationProfileSha256,
        webSecurityHeaderProfileSha256:
          release.value.webSecurityHeaderProfileSha256
      }
    ),
    runtime: runtimeRecord("deployment"),
    publicParameters,
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [
      { kind: "https", value: release.value.publicOrigin },
      { kind: "receipt", value: input.generatedDeploymentReceiptId }
    ].sort((left, right) => left.value.localeCompare(right.value)),
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: release.value.campaignAttestationReceiptId,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  });
}

function validateStoredGeneratedPublicReadback(input, reconstructed,
  authorization, storedGenerated, graph, receiptStore) {
  const step = "release-surface-stored-generated-public-readback";
  const stored = receiptStore.read(input.generatedPublicReadbackReceiptId);
  const validated = validateVnextReceiptBytes(stored.bytes);
  const receipt = validated.receipt;
  const release = reconstructed.release;
  const materialized = authorization.materialized;
  const expectedConfigurationSha256 = domainSeparatedDigest(
    parsedProfile.generatedPublicReadback.configurationIdentityDomain,
    {
      campaignReleaseSurfaceProfileSha256,
      publicHttpsReadbackProfileSha256,
      sitePublicationProfileSha256,
      webSecurityHeaderProfileSha256: release.value.webSecurityHeaderProfileSha256
    }
  );
  exactHashBindings(receipt.inputHashes, [
    {
      name: "campaign-release-surface-profile",
      sha256: campaignReleaseSurfaceProfileSha256
    },
    {
      name: "complete-web-asset-inventory",
      sha256: graph.combinedAssetInventorySha256
    },
    {
      name: "generated-asset-inventory",
      sha256: materialized.generatedInventorySha256
    },
    {
      name: "generated-deployment-attempt-canonical-content",
      sha256: storedGenerated.deployment.receipt.canonicalContentSha256
    },
    {
      name: "public-https-readback-profile",
      sha256: publicHttpsReadbackProfileSha256
    },
    {
      name: "release-manifest-canonical-content",
      sha256: release.canonicalContentSha256
    },
    {
      name: "site-publication-plan-material",
      sha256: materialized.planMaterialSha256
    },
    { name: "site-publication-profile", sha256: sitePublicationProfileSha256 },
    {
      name: "site-publisher-signature-canonical-content",
      sha256: authorization.signature.receipt.canonicalContentSha256
    },
    {
      name: "static-public-readback-canonical-content",
      sha256: reconstructed.staticReadback.readback.receipt.canonicalContentSha256
    },
    {
      name: "web-security-header-profile",
      sha256: release.value.webSecurityHeaderProfileSha256
    }
  ], "release_surface_generated_public_readback_input_hash_invalid", step);
  const outputNames = [
    "certificate-set",
    "complete-web-asset-inventory",
    "dns-address-set",
    "generated-asset-inventory",
    "public-https-readback-observation-inventory",
    "public-https-readback-result",
    "public-https-readback-selected-address"
  ];
  if (receipt.outputHashes.length !== outputNames.length ||
      !sameStrings(receipt.outputHashes.map((entry) => entry.name), outputNames) ||
      hashBinding(receipt, "outputHashes", "complete-web-asset-inventory",
        "release_surface_generated_public_readback_output_invalid", step) !==
          graph.combinedAssetInventorySha256 ||
      hashBinding(receipt, "outputHashes", "generated-asset-inventory",
        "release_surface_generated_public_readback_output_invalid", step) !==
          materialized.generatedInventorySha256) {
    failEvidence("release_surface_generated_public_readback_output_invalid", step);
  }
  exactPublicParameters(receipt, [
    {
      name: "asset-count",
      value: String(graph.webAssets.length),
      unit: "assets"
    },
    {
      name: "certificate-count",
      value: publicParameter(receipt, "certificate-count",
        "release_surface_generated_public_readback_parameters_invalid", step),
      unit: "certificates"
    },
    {
      name: "dns-address-count",
      value: publicParameter(receipt, "dns-address-count",
        "release_surface_generated_public_readback_parameters_invalid", step),
      unit: "addresses"
    },
    {
      name: "evidence-scope",
      value: parsedProfile.generatedPublicReadback.evidenceScope,
      unit: null
    },
    {
      name: "generated-asset-count",
      value: String(materialized.generatedAssets.length),
      unit: "assets"
    },
    {
      name: "generated-deployment-receipt-id",
      value: input.generatedDeploymentReceiptId,
      unit: null
    },
    { name: "operation_id", value: receipt.attemptId, unit: null },
    { name: "public-origin", value: release.value.publicOrigin, unit: null },
    {
      name: "public-readback-profile-id",
      value: publicHttpsReadbackProfile.profileId,
      unit: null
    },
    { name: "site-id", value: materialized.planMaterial.siteId, unit: null },
    { name: "subject_id", value: input.releaseManifestId, unit: null },
    { name: "total-bytes", value: String(graph.webTotalBytes), unit: "bytes" }
  ], "release_surface_generated_public_readback_parameters_invalid", step);
  const certificateCount = Number(publicParameter(receipt, "certificate-count",
    "release_surface_generated_public_readback_parameters_invalid", step));
  const dnsAddressCount = Number(publicParameter(receipt, "dns-address-count",
    "release_surface_generated_public_readback_parameters_invalid", step));
  if (!Number.isSafeInteger(certificateCount) || certificateCount < 1 ||
      certificateCount > publicHttpsReadbackProfile.limits.maximumCertificates ||
      !Number.isSafeInteger(dnsAddressCount) || dnsAddressCount < 1 ||
      dnsAddressCount > publicHttpsReadbackProfile.limits.maximumDnsAddresses ||
      receipt.receiptId !== input.generatedPublicReadbackReceiptId ||
      !validated.bytes.equals(stored.bytes) ||
      receipt.receiptType !== parsedProfile.generatedPublicReadback.receiptType ||
      receipt.phase !== parsedProfile.generatedPublicReadback.phase ||
      receipt.status !== parsedProfile.generatedPublicReadback.status ||
      receipt.campaignId !== input.expectedCampaignId ||
      receipt.sourceRevision !== input.sourceRevision ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.configurationSha256 !== expectedConfigurationSha256 ||
      !sameStrings(receipt.inputReceiptIds, [input.generatedDeploymentReceiptId]) ||
      receipt.runtime.executionClass !== "deployment" ||
      receipt.externalEvidenceReferences.length !== 2 ||
      !receipt.externalEvidenceReferences.some((entry) =>
        entry.kind === "https" && entry.value === release.value.publicOrigin) ||
      !receipt.externalEvidenceReferences.some((entry) =>
        entry.kind === "receipt" &&
          entry.value === input.generatedDeploymentReceiptId) ||
      receipt.attestationReference !== release.value.campaignAttestationReceiptId ||
      receipt.signatureEnvelope !== null || receipt.authorityRegistry !== null ||
      receipt.keyRevocation !== null || receipt.offlineBundle !== null ||
      receipt.supersedesReceiptIds.length !== 0 ||
      compareUtc(storedGenerated.deployment.receipt.completedAtUtc,
        receipt.startedAtUtc,
        "release_surface_generated_public_readback_time_invalid", step) > 0 ||
      compareUtc(receipt.completedAtUtc, input.verificationTimeUtc,
        "release_surface_generated_public_readback_time_invalid", step) > 0) {
    failEvidence("release_surface_generated_public_readback_invalid", step);
  }
  const activeReceipts = activeReceiptDocuments(receiptStore);
  const attemptId = `generated-public-readback-redaction-${
    receipt.receiptId.slice("sha256:".length)}`;
  const candidates = [...activeReceipts.byId.values()].filter((entry) =>
    entry.receipt.receiptType === "redaction-scan" &&
      entry.receipt.attemptId === attemptId);
  if (candidates.length !== 1) {
    failEvidence("release_surface_generated_public_readback_redaction_missing", step);
  }
  const redaction = candidates[0];
  const verified = verifyVnextRedactionScanReceipt({
    equalityCustody: input.equalityCustody,
    receiptBytes: redaction.bytes,
    targetBytes: validated.bytes,
    targetKind: "document"
  });
  if (!verified.publicSafe || verified.scanStatus !== "pass" ||
      redaction.receipt.startedAtUtc !== receipt.completedAtUtc ||
      redaction.receipt.completedAtUtc !== receipt.completedAtUtc) {
    failEvidence("release_surface_generated_public_readback_redaction_invalid", step);
  }
  return Object.freeze({
    activeReceipts,
    expectedReceiptIds: [...new Set([
      ...storedGenerated.expectedReceiptIds,
      redaction.receipt.receiptId,
      receipt.receiptId
    ])].sort(),
    expectedSubjectIds: storedGenerated.expectedSubjectIds,
    readback: validated,
    redaction
  });
}

function createFinalSitePublicationReceipt(input, reconstructed, authorization,
  storedGeneratedReadback, graph) {
  const release = reconstructed.release;
  const materialized = authorization.materialized;
  const readbackReceipt = storedGeneratedReadback.readback.receipt;
  const observationInventorySha256 = hashBinding(
    readbackReceipt,
    "outputHashes",
    "public-https-readback-observation-inventory",
    "release_surface_final_publication_readback_invalid",
    "release-surface-final-publication-receipt"
  );
  const inputHashes = [
    {
      name: "complete-observation-inventory",
      sha256: observationInventorySha256
    },
    {
      name: "generated-asset-inventory",
      sha256: materialized.generatedInventorySha256
    },
    { name: "site-release-history", sha256: sha256(materialized.historyBytes) },
    { name: "site-release-pointer", sha256: sha256(materialized.pointerBytes) },
    {
      name: "published-claim-set",
      sha256: materialized.publishedClaimSetSha256
    },
    {
      name: "release-manifest-canonical-content",
      sha256: release.canonicalContentSha256
    },
    { name: "site-publication-profile", sha256: sitePublicationProfileSha256 }
  ].sort((left, right) => left.name.localeCompare(right.name));
  const outputHashes = [
    {
      name: "generated-asset-inventory",
      sha256: materialized.generatedInventorySha256
    },
    {
      name: "published-claim-set",
      sha256: materialized.publishedClaimSetSha256
    },
    { name: "site-release-history", sha256: sha256(materialized.historyBytes) },
    { name: "site-release-pointer", sha256: sha256(materialized.pointerBytes) }
  ].sort((left, right) => left.name.localeCompare(right.name));
  return finalizeVnextReceipt({
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: parsedProfile.sitePublicationFinalization.receiptType,
    campaignId: input.expectedCampaignId,
    attemptId: input.operationId,
    phase: parsedProfile.sitePublicationFinalization.phase,
    status: parsedProfile.sitePublicationFinalization.status,
    startedAtUtc: input.verificationTimeUtc,
    completedAtUtc: input.verificationTimeUtc,
    sourceRevision: input.sourceRevision,
    inputReceiptIds: [
      input.generatedDeploymentReceiptId,
      input.generatedPublicReadbackReceiptId,
      input.sitePublicationPlanReceiptId,
      input.sitePublisherSignatureReceiptId
    ].sort(),
    inputHashes,
    outputHashes,
    tools: [
      {
        name: "tinyrustlm.vnext.campaign-release-surface",
        version: "1.0.0",
        binarySha256: sourceSha256
      },
      {
        name: "tinyrustlm.vnext.site-publication",
        version: "1.0.0",
        binarySha256: sitePublicationSourceSha256
      }
    ],
    configurationSha256: domainSeparatedDigest(
      "tinyrustlm.final-site-publication-configuration.v1",
      {
        campaignReleaseSurfaceProfileSha256,
        sitePublicationProfileSha256,
        combinedAssetInventorySha256: graph.combinedAssetInventorySha256
      }
    ),
    runtime: runtimeRecord("deployment"),
    publicParameters: [
      {
        name: "evidence-scope",
        value: parsedProfile.sitePublicationFinalization.evidenceScope,
        unit: null
      },
      {
        name: "generated-asset-count",
        value: String(materialized.generatedAssets.length),
        unit: "assets"
      },
      { name: "operation_id", value: input.operationId, unit: null },
      { name: "public-origin", value: release.value.publicOrigin, unit: null },
      {
        name: "published-claim-count",
        value: String(materialized.publishedClaims.length),
        unit: "claims"
      },
      { name: "site-id", value: materialized.planMaterial.siteId, unit: null },
      { name: "subject_id", value: input.releaseManifestId, unit: null }
    ].sort((left, right) => left.name.localeCompare(right.name)),
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [
      { kind: "https", value: release.value.publicOrigin },
      { kind: "receipt", value: input.generatedPublicReadbackReceiptId }
    ].sort((left, right) => left.value.localeCompare(right.value)),
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: release.value.campaignAttestationReceiptId,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: reconstructed.publication.previousPublication === null
      ? []
      : [reconstructed.publication.previousPublication.receipt.receiptId]
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
  const knownScan = scanVnextProtectedEqualityBytes(bytes, input.equalityCustody);
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

async function createCampaignReleaseSurfaceForRuntime(
  rootInput,
  rawOptions,
  equalityCustody
) {
  const options = normalizeOptions(rawOptions, equalityCustody);
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
      equalityCustody: input.equalityCustody
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
    return publicAttestationResult(await executeAttestation(normalizeInput(
      rawInput,
      options.equalityCustody
    )));
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
        equalityCustody: input.equalityCustody
      });
      if (!scan.publicSafe) {
        persistReleaseScan(input, campaignId, scan, "release-input-redaction");
        failEvidence("release_surface_public_input_unsafe", "release-surface-redaction");
      }
    }
  }

  async function prepareRelease(rawInput) {
    const input = normalizePrepareInput(rawInput, options.equalityCustody);
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
      equalityCustody: input.equalityCustody
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
        equalityCustody: input.equalityCustody
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
      equalityCustody: input.equalityCustody
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
    const input = normalizeAuthorizeInput(rawInput, options.equalityCustody);
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
      equalityCustody: input.equalityCustody
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
    const resultScan = scanVnextProtectedEqualityBytes(
      authorizationResultBytes,
      input.equalityCustody
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
    const input = normalizeDeploymentInput(rawInput, options.equalityCustody);
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
      equalityCustody: input.equalityCustody
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
    const resultScan = scanVnextProtectedEqualityBytes(
      resultBytes,
      input.equalityCustody
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

  async function verifyPublicReadback(rawInput) {
    const step = "release-surface-public-readback";
    const input = normalizePublicReadbackInput(rawInput, options.equalityCustody);
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
    const storedDeployment = validateStoredDeploymentAttempt(
      input,
      release,
      storedAuthorization,
      receiptStore
    );
    assertReadbackPrefixCandidate(
      receiptStore,
      subjectStore,
      storedDeployment.expectedReceiptIds,
      storedDeployment.expectedSubjectIds
    );

    const rawReadbackResult = await performVnextPublicHttpsReadback({
      publicOrigin: release.value.publicOrigin,
      webAssets: release.value.webAssets.map((entry) => ({ ...entry })),
      webSecurityHeaderProfileBytes: input.webSecurityHeaderProfileBytes
    });
    const verifiedResult = readCanonicalPublicReadbackResult(
      rawReadbackResult,
      {
        publicOrigin: release.value.publicOrigin,
        webAssets: release.value.webAssets,
        webTotalBytes: release.value.webTotalBytes
      },
      input.webSecurityHeaderProfileBytes
    );
    const resultKnownSecretScan = scanVnextProtectedEqualityBytes(
      verifiedResult.bytes,
      input.equalityCustody
    );
    if (resultKnownSecretScan.findingCount !== 0) {
      failEvidence("release_surface_public_readback_result_unsafe", step);
    }
    const readback = createPublicReadbackReceipt(
      input,
      release,
      storedAuthorization,
      storedDeployment,
      verifiedResult
    );
    if (readback.bytes.length >
        parsedProfile.limits.maximumPublicReadbackReceiptBytes) {
      failEvidence("release_surface_public_readback_receipt_byte_limit", step);
    }
    const readbackScan = scanVnextPublicDocumentBytes(readback.bytes, {
      equalityCustody: input.equalityCustody
    });
    const readbackRedaction = createVnextRedactionScanReceipt({
      attemptId: `release-public-readback-redaction-${
        readback.receipt.receiptId.slice("sha256:".length)}`,
      campaignId: input.expectedCampaignId,
      completedAtUtc: input.verificationTimeUtc,
      scan: readbackScan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: input.verificationTimeUtc
    });
    const deployedReceiptIds = storedDeployment.expectedReceiptIds;
    const deployedSubjectIds = storedDeployment.expectedSubjectIds;
    const withRedaction = [...new Set([
      ...deployedReceiptIds,
      readbackRedaction.receipt.receiptId
    ])].sort();
    const withReadback = [...new Set([
      ...withRedaction,
      readback.receipt.receiptId
    ])].sort();
    const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
    const isDeployed = sameStrings(currentReceiptIds, deployedReceiptIds);
    const hasRedaction = sameStrings(currentReceiptIds, withRedaction);
    const hasReadback = sameStrings(currentReceiptIds, withReadback);
    if (!isDeployed && !hasRedaction && !hasReadback) {
      failEvidence("release_surface_public_readback_snapshot_changed", step);
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      currentReceiptIds,
      deployedSubjectIds,
      "release-surface-public-readback-before-verification"
    );
    if (hasRedaction || hasReadback) {
      const existingScan = receiptStore.read(
        readbackRedaction.receipt.receiptId
      );
      if (!existingScan.bytes.equals(readbackRedaction.bytes)) {
        failEvidence("release_surface_public_readback_redaction_changed", step);
      }
    }
    if (hasReadback) {
      const existingReadback = receiptStore.read(readback.receipt.receiptId);
      if (!existingReadback.bytes.equals(readback.bytes)) {
        failEvidence("release_surface_public_readback_identity_collision", step);
      }
    }
    if (!readbackScan.publicSafe) {
      if (isDeployed) receiptStore.put(readbackRedaction.bytes);
      assertStoreMembership(
        receiptStore,
        subjectStore,
        withRedaction,
        deployedSubjectIds,
        "release-surface-public-readback-redaction-failure"
      );
      failEvidence("release_surface_public_readback_unsafe", step);
    }

    const admissionResult = deepFreeze({
      schema: parsedProfile.publicReadback.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: release.value.publicOrigin,
      authorizationReceiptId: input.authorizationReceiptId,
      deploymentReceiptId: input.deploymentReceiptId,
      publicReadbackReceiptId: readback.receipt.receiptId,
      publicReadbackRedactionReceiptId: readbackRedaction.receipt.receiptId,
      publicHttpsReadbackProfileId: publicHttpsReadbackProfile.profileId,
      publicHttpsReadbackProfileSha256,
      publicHttpsReadbackResultSha256: verifiedResult.resultSha256,
      observationInventorySha256:
        verifiedResult.result.observationInventorySha256,
      verifiedAtUtc: input.verificationTimeUtc,
      evidenceScope: parsedProfile.publicReadback.evidenceScope,
      deploymentStatus: "public-bytes-verified",
      publicReadbackStatus: "verified",
      publicationStatus: "not-published",
      state: parsedProfile.publicReadback.verifiedState
    });
    const admissionResultBytes = canonicalizeVnextJcsBytes(admissionResult);
    if (admissionResultBytes.length >
        parsedProfile.limits.maximumPublicReadbackAdmissionResultBytes) {
      failEvidence("release_surface_public_readback_admission_result_byte_limit", step);
    }
    const admissionScan = scanVnextProtectedEqualityBytes(
      admissionResultBytes,
      input.equalityCustody
    );
    if (admissionScan.findingCount !== 0) {
      failEvidence("release_surface_public_readback_admission_result_unsafe", step);
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      currentReceiptIds,
      deployedSubjectIds,
      "release-surface-public-readback-before-persistence"
    );
    const readbackRedactionPersistence = receiptStore.put(
      readbackRedaction.bytes
    );
    assertStoreMembership(
      receiptStore,
      subjectStore,
      hasReadback ? withReadback : withRedaction,
      deployedSubjectIds,
      "release-surface-public-readback-after-redaction"
    );
    const readbackPersistence = receiptStore.put(readback.bytes);
    assertStoreMembership(
      receiptStore,
      subjectStore,
      withReadback,
      deployedSubjectIds,
      "release-surface-public-readback-after-receipt"
    );
    return immutableReleasePreparationResult({
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      authorizationReceiptId: input.authorizationReceiptId,
      deploymentReceiptId: input.deploymentReceiptId,
      publicReadbackReceiptId: readback.receipt.receiptId,
      publicReadbackRedactionReceiptId: readbackRedaction.receipt.receiptId,
      deploymentStatus: admissionResult.deploymentStatus,
      publicReadbackStatus: admissionResult.publicReadbackStatus,
      publicationStatus: admissionResult.publicationStatus,
      state: admissionResult.state,
      publicReadbackAdmissionResult: admissionResult,
      publicReadbackAdmissionResultSha256: sha256(admissionResultBytes),
      publicHttpsReadbackResult: verifiedResult.result,
      publicHttpsReadbackResultSha256: verifiedResult.resultSha256,
      readbackPersistence,
      readbackRedactionPersistence
    }, {
      publicHttpsReadbackResultBytes: verifiedResult.bytes,
      publicReadbackReceiptBytes: readback.bytes,
      publicReadbackRedactionReceiptBytes: readbackRedaction.bytes,
      publicReadbackAdmissionResultBytes: admissionResultBytes,
      releaseManifestBytes: release.bytes
    });
  }

  function reconstructSitePublication(input) {
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
    const storedDeployment = validateStoredDeploymentAttempt(
      input,
      release,
      storedAuthorization,
      receiptStore
    );
    const staticReadback = validateStoredStaticPublicReadback(
      input,
      release,
      storedDeployment,
      receiptStore
    );
    const publication = sitePublicationMaterialContext(
      input,
      release,
      staticReadback,
      subjectStore
    );
    return Object.freeze({
      lineage,
      publication,
      release,
      staticReadback,
      storedAuthorization,
      storedDeployment
    });
  }

  function reconstructAuthorizedSitePublication(input) {
    const reconstructed = reconstructSitePublication(input);
    const authorization = validateStoredSitePublicationAuthorization(
      input,
      reconstructed,
      receiptStore,
      subjectStore
    );
    const graph = combinedPublicationGraph(
      reconstructed.release,
      authorization.materialized
    );
    return Object.freeze({ authorization, graph, reconstructed });
  }

  function persistReceiptSequence(baseReceiptIds, baseSubjectIds, sequence, step) {
    const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
    const currentSubjectIds = subjectStore.rebuild().activeSubjectIds;
    if (!sameStrings(currentSubjectIds, baseSubjectIds)) {
      failEvidence("release_surface_site_publication_subject_snapshot_changed", step);
    }
    const prefix = receiptPrefixLength(
      currentReceiptIds,
      baseReceiptIds,
      sequence.map((entry) => entry.receiptId),
      "release_surface_site_publication_receipt_snapshot_changed",
      step
    );
    for (let index = 0; index < prefix; index += 1) {
      const existing = receiptStore.read(sequence[index].receiptId);
      if (!existing.bytes.equals(sequence[index].bytes)) {
        failEvidence("release_surface_site_publication_identity_collision", step);
      }
    }
    const persistence = [];
    for (let index = prefix; index < sequence.length; index += 1) {
      persistence.push(receiptStore.put(sequence[index].bytes));
      assertStoreMembership(
        receiptStore,
        subjectStore,
        [...baseReceiptIds, ...sequence.slice(0, index + 1).map((entry) =>
          entry.receiptId)],
        baseSubjectIds,
        step
      );
    }
    return Object.freeze({ persistence: Object.freeze(persistence), prefix });
  }

  function persistFinalPublication(baseReceiptIds, baseSubjectIds, finalRedaction,
    finalReceipt, publishedClaims, step) {
    const claims = [...publishedClaims].sort((left, right) =>
      left.claimId.localeCompare(right.claimId));
    const expectedClaimIds = claims.map((entry) => entry.claimId);
    const currentReceiptIds = receiptStore.rebuild().activeReceiptIds;
    const withRedaction = [...new Set([
      ...baseReceiptIds,
      finalRedaction.receipt.receipt.receiptId
    ])].sort();
    const withCommit = [...new Set([
      ...withRedaction,
      finalReceipt.receipt.receiptId
    ])].sort();
    const hasBaseReceipts = sameStrings(currentReceiptIds, baseReceiptIds);
    const hasRedaction = sameStrings(currentReceiptIds, withRedaction);
    const hasCommit = sameStrings(currentReceiptIds, withCommit);
    if (!hasBaseReceipts && !hasRedaction && !hasCommit) {
      failEvidence("release_surface_final_publication_receipt_snapshot_changed", step);
    }
    const currentSubjectIds = subjectStore.rebuild().activeSubjectIds;
    let claimPrefix = -1;
    for (let length = 0; length <= expectedClaimIds.length; length += 1) {
      const expected = [...new Set([
        ...baseSubjectIds,
        ...expectedClaimIds.slice(0, length)
      ])].sort();
      if (sameStrings(currentSubjectIds, expected)) {
        claimPrefix = length;
        break;
      }
    }
    if (claimPrefix < 0 || hasBaseReceipts && claimPrefix !== 0 ||
        hasCommit && claimPrefix !== expectedClaimIds.length) {
      failEvidence("release_surface_final_publication_subject_snapshot_changed", step);
    }
    if (hasRedaction || hasCommit) {
      const existing = receiptStore.read(finalRedaction.receipt.receipt.receiptId);
      if (!existing.bytes.equals(finalRedaction.receipt.bytes)) {
        failEvidence("release_surface_final_publication_redaction_changed", step);
      }
    }
    for (let index = 0; index < claimPrefix; index += 1) {
      const existing = subjectStore.read(claims[index].claimId);
      if (!existing.bytes.equals(claims[index].claimBytes)) {
        failEvidence("release_surface_final_publication_claim_changed", step);
      }
    }
    if (hasCommit) {
      const existing = receiptStore.read(finalReceipt.receipt.receiptId);
      if (!existing.bytes.equals(finalReceipt.bytes)) {
        failEvidence("release_surface_final_publication_commit_changed", step);
      }
    }
    const receiptPersistence = [];
    const subjectPersistence = [];
    if (hasBaseReceipts) {
      receiptPersistence.push(receiptStore.put(finalRedaction.receipt.bytes));
      assertStoreMembership(receiptStore, subjectStore, withRedaction,
        baseSubjectIds, `${step}-after-redaction`);
    }
    for (let index = claimPrefix; index < claims.length; index += 1) {
      subjectPersistence.push(subjectStore.put(claims[index].claimBytes));
      assertStoreMembership(
        receiptStore,
        subjectStore,
        withRedaction,
        [...baseSubjectIds, ...expectedClaimIds.slice(0, index + 1)],
        `${step}-after-claim`
      );
    }
    if (!hasCommit) {
      receiptPersistence.push(receiptStore.put(finalReceipt.bytes));
    }
    assertStoreMembership(
      receiptStore,
      subjectStore,
      withCommit,
      [...baseSubjectIds, ...expectedClaimIds],
      `${step}-after-commit`
    );
    return Object.freeze({
      claimPrefix,
      receiptPersistence: Object.freeze(receiptPersistence),
      subjectPersistence: Object.freeze(subjectPersistence)
    });
  }

  async function prepareSitePublication(rawInput) {
    const step = "release-surface-site-publication-plan";
    const input = normalizeSitePublicationPlanInput(rawInput,
      options.equalityCustody);
    const reconstructed = reconstructSitePublication(input);
    const { publication, release, staticReadback } = reconstructed;
    const artifacts = sitePublicationPlanArtifacts(input, release, publication);
    const operationCandidates = [...staticReadback.activeReceipts.byId.values()]
      .filter((entry) => entry.receipt.attemptId === input.operationId);
    if (operationCandidates.some((entry) =>
      entry.receipt.receiptId !== artifacts.planReceipt.receipt.receiptId)) {
      failEvidence("release_surface_site_publication_operation_not_fresh", step);
    }
    const failedScan = artifacts.scans.find((entry) => !entry.scan.publicSafe);
    if (failedScan) {
      assertStoreMembership(
        receiptStore,
        subjectStore,
        staticReadback.expectedReceiptIds,
        staticReadback.expectedSubjectIds,
        `${step}-redaction-failure-prefix`
      );
      receiptStore.put(failedScan.receipt.bytes);
      failEvidence("release_surface_site_publication_plan_unsafe", step);
    }
    const sequence = [
      ...artifacts.scans.map((entry) => ({
        bytes: entry.receipt.bytes,
        receiptId: entry.receipt.receipt.receiptId
      })),
      {
        bytes: artifacts.planReceipt.bytes,
        receiptId: artifacts.planReceipt.receipt.receiptId
      }
    ];
    const persisted = persistReceiptSequence(
      staticReadback.expectedReceiptIds,
      staticReadback.expectedSubjectIds,
      sequence,
      step
    );
    const result = deepFreeze({
      schema: parsedProfile.sitePublicationPlan.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: publication.material.planMaterial.publicOrigin,
      siteId: publication.material.planMaterial.siteId,
      staticPublicReadbackReceiptId: input.publicReadbackReceiptId,
      previousPublicationReceiptId:
        publication.previousPublication?.receipt.receiptId ?? null,
      previousHistorySha256:
        publication.material.planMaterial.previousHistorySha256,
      sitePublicationPlanReceiptId: artifacts.planReceipt.receipt.receiptId,
      sitePublicationPlanMaterialSha256: publication.material.planMaterialSha256,
      sitePublicationProfileId: sitePublicationProfile.profileId,
      sitePublicationProfileSha256,
      planStatus: "prepared",
      publicationStatus: "not-published",
      state: parsedProfile.sitePublicationPlan.preparedState,
      verifiedAtUtc: input.verificationTimeUtc
    });
    const resultBytes = canonicalizeVnextJcsBytes(result);
    if (resultBytes.length >
        parsedProfile.limits.maximumSitePublicationPlanResultBytes ||
        scanVnextProtectedEqualityBytes(resultBytes, input.equalityCustody).findingCount !== 0) {
      failEvidence("release_surface_site_publication_plan_result_unsafe", step);
    }
    return immutableReleasePreparationResult({
      ...result,
      planPersistence: persisted,
      planRedactionReceiptIds: artifacts.scans.map((entry) =>
        entry.receipt.receipt.receiptId)
    }, {
      sitePublicationPlanMaterialBytes: publication.material.planMaterialBytes,
      sitePublicationPlanReceiptBytes: artifacts.planReceipt.bytes,
      sitePublicationPlanResultBytes: resultBytes
    });
  }

  async function authorizeSitePublication(rawInput) {
    const step = "release-surface-site-publication-authorization";
    const input = normalizeSitePublicationAuthorizationInput(rawInput,
      options.equalityCustody);
    const reconstructed = reconstructSitePublication(input);
    const { publication, release, staticReadback } = reconstructed;
    const storedPlan = validateStoredSitePublicationPlan(
      input,
      release,
      publication,
      receiptStore
    );
    const materialized = materializeVnextSitePublication({
      approvedClaimBytes: publication.approvedClaimBytes,
      previousHistoryBytes: input.previousHistoryBytes,
      publicReadbackReceiptBytes: staticReadback.readback.bytes,
      releaseManifestBytes: release.bytes,
      sitePublicationPlanReceiptBytes: storedPlan.stored.bytes,
      sitePublisherSignatureReceiptBytes: input.sitePublisherSignatureReceiptBytes,
      webPublicationGeneratorBytes: input.webPublicationGeneratorBytes
    });
    const signature = validateVnextReceiptBytes(
      input.sitePublisherSignatureReceiptBytes
    );
    const envelope = signature.receipt.signatureEnvelope;
    if (compareUtc(envelope.issuedAtUtc, input.verificationTimeUtc,
      "release_surface_site_publisher_time_invalid", step) > 0 ||
        compareUtc(input.verificationTimeUtc, envelope.expiresAtUtc,
          "release_surface_site_publisher_time_invalid", step) >= 0) {
      failEvidence("release_surface_site_publisher_time_invalid", step);
    }
    const authority = verifySitePublisherAuthority(
      input,
      release,
      storedPlan.stored,
      signature,
      staticReadback.activeReceipts,
      subjectStore
    );
    const candidateScans = sitePublicationCandidateScans(
      input,
      materialized,
      signature
    );
    const failedScan = candidateScans.find((entry) => !entry.scan.publicSafe);
    const planReceiptIds = sitePublicationPlanReceiptIds(staticReadback, storedPlan);
    if (failedScan) {
      assertStoreMembership(
        receiptStore,
        subjectStore,
        planReceiptIds,
        staticReadback.expectedSubjectIds,
        `${step}-redaction-failure-prefix`
      );
      receiptStore.put(failedScan.receipt.bytes);
      failEvidence("release_surface_site_publication_candidate_unsafe", step);
    }
    const sequence = [
      {
        bytes: candidateScans[0].receipt.bytes,
        receiptId: candidateScans[0].receipt.receipt.receiptId
      },
      { bytes: signature.bytes, receiptId: signature.receipt.receiptId },
      ...candidateScans.slice(1).map((entry) => ({
        bytes: entry.receipt.bytes,
        receiptId: entry.receipt.receipt.receiptId
      }))
    ];
    const persisted = persistReceiptSequence(
      planReceiptIds,
      staticReadback.expectedSubjectIds,
      sequence,
      step
    );
    const result = deepFreeze({
      schema: parsedProfile.sitePublicationAuthorization.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: publication.material.planMaterial.publicOrigin,
      siteId: publication.material.planMaterial.siteId,
      sitePublicationPlanReceiptId: storedPlan.stored.receipt.receiptId,
      sitePublisherSignatureReceiptId: signature.receipt.receiptId,
      authorityRegistryReceiptId: envelope.authorityRegistryReceiptId,
      trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
      terminalRegistryReceiptId: authority.authority.terminalRegistryReceiptId,
      signerId: envelope.signerId,
      keyId: envelope.keyId,
      nonceHash: envelope.nonceHash,
      issuedAtUtc: envelope.issuedAtUtc,
      expiresAtUtc: envelope.expiresAtUtc,
      generatedInventorySha256: materialized.generatedInventorySha256,
      generatedTotalBytes: materialized.generatedTotalBytes,
      publishedClaimSetSha256: materialized.publishedClaimSetSha256,
      currentEvidenceEligible: true,
      candidatePublishedClaimCount: materialized.publishedClaims.length,
      authorizationStatus: "authorized",
      publicationStatus: materialized.publicationStatus,
      state: parsedProfile.sitePublicationAuthorization.authorizedState,
      verifiedAtUtc: input.verificationTimeUtc
    });
    const resultBytes = canonicalizeVnextJcsBytes(result);
    if (resultBytes.length >
        parsedProfile.limits.maximumSitePublicationAuthorizationResultBytes ||
        scanVnextProtectedEqualityBytes(resultBytes, input.equalityCustody).findingCount !== 0) {
      failEvidence("release_surface_site_publication_authorization_result_unsafe", step);
    }
    return immutableReleasePreparationResult({
      ...result,
      authorizationPersistence: persisted,
      candidateRedactionReceiptIds: candidateScans.map((entry) =>
        entry.receipt.receipt.receiptId),
      generatedAssets: materialized.generatedAssets,
      candidatePublishedClaimSetSha256: materialized.publishedClaimSetSha256
    }, {
      sitePublicationAuthorizationResultBytes: resultBytes,
      sitePublisherSignatureReceiptBytes: signature.bytes,
      siteReleaseHistoryBytes: materialized.historyBytes,
      siteReleasePointerBytes: materialized.pointerBytes
    });
  }

  async function admitGeneratedDeploymentAttempt(rawInput) {
    const step = "release-surface-generated-deployment";
    const input = normalizeGeneratedDeploymentInput(rawInput,
      options.equalityCustody);
    const { authorization, reconstructed } =
      reconstructAuthorizedSitePublication(input);
    const deployment = validateGeneratedDeploymentAttemptReceipt(
      input,
      reconstructed,
      authorization
    );
    if (deployment.bytes.length >
        parsedProfile.limits.maximumGeneratedDeploymentReceiptBytes) {
      failEvidence("release_surface_generated_deployment_receipt_byte_limit", step);
    }
    const scan = scanVnextPublicDocumentBytes(deployment.bytes, {
      equalityCustody: input.equalityCustody
    });
    const redaction = createVnextRedactionScanReceipt({
      attemptId: `generated-deployment-redaction-${
        deployment.receipt.receiptId.slice("sha256:".length)}`,
      campaignId: input.expectedCampaignId,
      completedAtUtc: deployment.receipt.completedAtUtc,
      scan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: deployment.receipt.completedAtUtc
    });
    const redactionEntry = {
      bytes: redaction.bytes,
      receiptId: redaction.receipt.receiptId
    };
    if (!scan.publicSafe) {
      persistReceiptSequence(
        authorization.expectedReceiptIds,
        authorization.expectedSubjectIds,
        [redactionEntry],
        `${step}-redaction-failure`
      );
      failEvidence("release_surface_generated_deployment_unsafe", step);
    }
    const persistence = persistReceiptSequence(
      authorization.expectedReceiptIds,
      authorization.expectedSubjectIds,
      [
        redactionEntry,
        { bytes: deployment.bytes, receiptId: deployment.receipt.receiptId }
      ],
      step
    );
    const result = deepFreeze({
      schema: parsedProfile.generatedDeployment.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: reconstructed.release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: reconstructed.release.value.publicOrigin,
      siteId: authorization.materialized.planMaterial.siteId,
      sitePublicationPlanReceiptId: input.sitePublicationPlanReceiptId,
      sitePublisherSignatureReceiptId: input.sitePublisherSignatureReceiptId,
      generatedInventorySha256:
        authorization.materialized.generatedInventorySha256,
      generatedDeploymentReceiptId: deployment.receipt.receiptId,
      generatedDeploymentRedactionReceiptId: redaction.receipt.receiptId,
      generatedDeploymentAttemptId: deployment.receipt.attemptId,
      evidenceScope: parsedProfile.generatedDeployment.evidenceScope,
      deploymentStatus: "attempt-admitted",
      completePublicReadbackStatus: "required-not-performed",
      publicationStatus: "not-published",
      state: parsedProfile.generatedDeployment.admittedState,
      verifiedAtUtc: input.verificationTimeUtc
    });
    const resultBytes = canonicalizeVnextJcsBytes(result);
    if (resultBytes.length >
          parsedProfile.limits.maximumGeneratedDeploymentResultBytes ||
        scanVnextProtectedEqualityBytes(resultBytes, input.equalityCustody)
          .findingCount !== 0) {
      failEvidence("release_surface_generated_deployment_result_unsafe", step);
    }
    return immutableReleasePreparationResult({
      ...result,
      deploymentPersistence: persistence
    }, {
      generatedDeploymentReceiptBytes: deployment.bytes,
      generatedDeploymentRedactionReceiptBytes: redaction.bytes,
      generatedDeploymentResultBytes: resultBytes,
      siteReleaseHistoryBytes: authorization.materialized.historyBytes,
      siteReleasePointerBytes: authorization.materialized.pointerBytes
    });
  }

  async function verifyGeneratedPublicationReadback(rawInput) {
    const step = "release-surface-generated-public-readback";
    const input = normalizeGeneratedPublicReadbackInput(rawInput,
      options.equalityCustody);
    const { authorization, graph, reconstructed } =
      reconstructAuthorizedSitePublication(input);
    const storedGenerated = validateStoredGeneratedDeploymentAttempt(
      input,
      reconstructed,
      authorization,
      receiptStore
    );
    assertReadbackPrefixCandidate(
      receiptStore,
      subjectStore,
      storedGenerated.expectedReceiptIds,
      storedGenerated.expectedSubjectIds
    );
    const rawResult = await performVnextPublicHttpsReadback({
      publicOrigin: graph.publicOrigin,
      webAssets: graph.webAssets.map((entry) => ({ ...entry })),
      webSecurityHeaderProfileBytes: input.webSecurityHeaderProfileBytes
    });
    const verifiedResult = readCanonicalPublicReadbackResult(
      rawResult,
      graph,
      input.webSecurityHeaderProfileBytes
    );
    if (scanVnextProtectedEqualityBytes(verifiedResult.bytes,
      input.equalityCustody).findingCount !== 0) {
      failEvidence("release_surface_generated_public_readback_result_unsafe", step);
    }
    const readback = createGeneratedPublicReadbackReceipt(
      input,
      reconstructed,
      authorization,
      storedGenerated,
      graph,
      verifiedResult
    );
    if (readback.bytes.length >
        parsedProfile.limits.maximumGeneratedPublicReadbackReceiptBytes) {
      failEvidence("release_surface_generated_public_readback_receipt_byte_limit", step);
    }
    const scan = scanVnextPublicDocumentBytes(readback.bytes, {
      equalityCustody: input.equalityCustody
    });
    const redaction = createVnextRedactionScanReceipt({
      attemptId: `generated-public-readback-redaction-${
        readback.receipt.receiptId.slice("sha256:".length)}`,
      campaignId: input.expectedCampaignId,
      completedAtUtc: input.verificationTimeUtc,
      scan,
      sourceRevision: input.sourceRevision,
      startedAtUtc: input.verificationTimeUtc
    });
    const redactionEntry = {
      bytes: redaction.bytes,
      receiptId: redaction.receipt.receiptId
    };
    if (!scan.publicSafe) {
      persistReceiptSequence(
        storedGenerated.expectedReceiptIds,
        storedGenerated.expectedSubjectIds,
        [redactionEntry],
        `${step}-redaction-failure`
      );
      failEvidence("release_surface_generated_public_readback_unsafe", step);
    }
    const persistence = persistReceiptSequence(
      storedGenerated.expectedReceiptIds,
      storedGenerated.expectedSubjectIds,
      [
        redactionEntry,
        { bytes: readback.bytes, receiptId: readback.receipt.receiptId }
      ],
      step
    );
    const result = deepFreeze({
      schema: parsedProfile.generatedPublicReadback.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: reconstructed.release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: graph.publicOrigin,
      siteId: authorization.materialized.planMaterial.siteId,
      sitePublisherSignatureReceiptId: input.sitePublisherSignatureReceiptId,
      generatedDeploymentReceiptId: input.generatedDeploymentReceiptId,
      generatedPublicReadbackReceiptId: readback.receipt.receiptId,
      generatedPublicReadbackRedactionReceiptId: redaction.receipt.receiptId,
      generatedInventorySha256:
        authorization.materialized.generatedInventorySha256,
      completeWebAssetInventorySha256: graph.combinedAssetInventorySha256,
      completeObservationInventorySha256:
        verifiedResult.result.observationInventorySha256,
      publicHttpsReadbackResultSha256: verifiedResult.resultSha256,
      evidenceScope: parsedProfile.generatedPublicReadback.evidenceScope,
      deploymentStatus: "public-bytes-verified",
      completePublicReadbackStatus: "verified",
      publicationStatus: "not-published",
      state: parsedProfile.generatedPublicReadback.verifiedState,
      verifiedAtUtc: input.verificationTimeUtc
    });
    const resultBytes = canonicalizeVnextJcsBytes(result);
    if (resultBytes.length >
          parsedProfile.limits.maximumGeneratedPublicReadbackAdmissionResultBytes ||
        scanVnextProtectedEqualityBytes(resultBytes, input.equalityCustody)
          .findingCount !== 0) {
      failEvidence("release_surface_generated_public_readback_admission_unsafe", step);
    }
    return immutableReleasePreparationResult({
      ...result,
      readbackPersistence: persistence,
      publicHttpsReadbackResult: verifiedResult.result
    }, {
      generatedPublicReadbackReceiptBytes: readback.bytes,
      generatedPublicReadbackRedactionReceiptBytes: redaction.bytes,
      generatedPublicReadbackAdmissionResultBytes: resultBytes,
      publicHttpsReadbackResultBytes: verifiedResult.bytes
    });
  }

  async function finalizeSitePublication(rawInput) {
    const step = "release-surface-final-site-publication";
    const input = normalizeSitePublicationFinalizationInput(rawInput,
      options.equalityCustody);
    const { authorization, graph, reconstructed } =
      reconstructAuthorizedSitePublication(input);
    const storedGenerated = validateStoredGeneratedDeploymentAttempt(
      input,
      reconstructed,
      authorization,
      receiptStore
    );
    const storedReadback = validateStoredGeneratedPublicReadback(
      input,
      reconstructed,
      authorization,
      storedGenerated,
      graph,
      receiptStore
    );
    const finalReceipt = createFinalSitePublicationReceipt(
      input,
      reconstructed,
      authorization,
      storedReadback,
      graph
    );
    if (finalReceipt.bytes.length >
        parsedProfile.limits.maximumSitePublicationReceiptBytes) {
      failEvidence("release_surface_final_publication_receipt_byte_limit", step);
    }
    const finalRedaction = sitePublicationScan(
      input,
      finalReceipt.bytes,
      "document",
      "final-publication-receipt-redaction"
    );
    if (!finalRedaction.scan.publicSafe) {
      assertStoreMembership(
        receiptStore,
        subjectStore,
        storedReadback.expectedReceiptIds,
        storedReadback.expectedSubjectIds,
        `${step}-unsafe-prefix`
      );
      receiptStore.put(finalRedaction.receipt.bytes);
      failEvidence("release_surface_final_publication_unsafe", step);
    }
    const persistence = persistFinalPublication(
      storedReadback.expectedReceiptIds,
      storedReadback.expectedSubjectIds,
      finalRedaction,
      finalReceipt,
      authorization.materialized.publishedClaims,
      step
    );
    const current = currentSitePublicationReceipt(
      activeReceiptDocuments(receiptStore),
      authorization.materialized.planMaterial
    );
    if (current === null ||
        current.receipt.receiptId !== finalReceipt.receipt.receiptId) {
      failEvidence("release_surface_final_publication_not_current", step);
    }
    const result = deepFreeze({
      schema: parsedProfile.sitePublicationFinalization.resultSchema,
      campaignId: input.expectedCampaignId,
      environment: input.expectedEnvironment,
      releaseManifestId: input.releaseManifestId,
      releaseManifestSha256: reconstructed.release.canonicalContentSha256,
      sourceRevision: input.sourceRevision,
      publicOrigin: graph.publicOrigin,
      siteId: authorization.materialized.planMaterial.siteId,
      sitePublicationPlanReceiptId: input.sitePublicationPlanReceiptId,
      sitePublisherSignatureReceiptId: input.sitePublisherSignatureReceiptId,
      generatedDeploymentReceiptId: input.generatedDeploymentReceiptId,
      generatedPublicReadbackReceiptId: input.generatedPublicReadbackReceiptId,
      publicationReceiptId: finalReceipt.receipt.receiptId,
      publicationRedactionReceiptId:
        finalRedaction.receipt.receipt.receiptId,
      generatedInventorySha256:
        authorization.materialized.generatedInventorySha256,
      completeWebAssetInventorySha256: graph.combinedAssetInventorySha256,
      publishedClaimSetSha256:
        authorization.materialized.publishedClaimSetSha256,
      publishedClaimIds: authorization.materialized.publishedClaims
        .map((entry) => entry.claimId).sort(),
      siteReleasePointerSha256:
        sha256(authorization.materialized.pointerBytes),
      siteReleaseHistorySha256:
        sha256(authorization.materialized.historyBytes),
      evidenceScope: parsedProfile.sitePublicationFinalization.evidenceScope,
      deploymentStatus: "public-bytes-verified",
      completePublicReadbackStatus: "verified",
      publicationStatus: "published",
      state: parsedProfile.sitePublicationFinalization.publishedState,
      publishedAtUtc: input.verificationTimeUtc
    });
    const resultBytes = canonicalizeVnextJcsBytes(result);
    if (resultBytes.length >
          parsedProfile.limits.maximumSitePublicationAdmissionResultBytes ||
        scanVnextProtectedEqualityBytes(resultBytes, input.equalityCustody)
          .findingCount !== 0) {
      failEvidence("release_surface_final_publication_result_unsafe", step);
    }
    return immutableReleasePreparationResult({
      ...result,
      publicationPersistence: persistence
    }, {
      publicationReceiptBytes: finalReceipt.bytes,
      publicationRedactionReceiptBytes: finalRedaction.receipt.bytes,
      sitePublicationAdmissionResultBytes: resultBytes,
      siteReleaseHistoryBytes: authorization.materialized.historyBytes,
      siteReleasePointerBytes: authorization.materialized.pointerBytes
    });
  }

  return Object.freeze({
    admitGeneratedDeploymentAttempt,
    admitDeploymentAttempt,
    attestCampaign,
    authorizeSitePublication,
    authorizeRelease,
    finalizeSitePublication,
    prepareSitePublication,
    prepareRelease,
    verifyGeneratedPublicationReadback,
    verifyPublicReadback,
    profileId: parsedProfile.profileId,
    profileSha256: campaignReleaseSurfaceProfileSha256,
    runnerStartup: runner.startup
  });
}

function bootstrapVnextCampaignReleaseRuntime(rawTrustDescriptorBytes) {
  const equalityCustody =
    loadVnextProtectedEqualityCustodyFromInheritedPipe(rawTrustDescriptorBytes);
  const equalityCustodyBinding =
    inspectVnextProtectedEqualityCustody(equalityCustody);
  async function createCampaignReleaseSurface(rootInput, rawOptions) {
    return createCampaignReleaseSurfaceForRuntime(
      rootInput,
      rawOptions,
      equalityCustody
    );
  }
  return Object.freeze({
    createCampaignReleaseSurface,
    equalityCustodyBinding,
    profileId: parsedProfile.profileId,
    profileSha256: campaignReleaseSurfaceProfileSha256
  });
}

module.exports = Object.freeze({
  bootstrapVnextCampaignReleaseRuntime,
  campaignReleaseSurfaceProfile,
  campaignReleaseSurfaceProfileSha256
});
