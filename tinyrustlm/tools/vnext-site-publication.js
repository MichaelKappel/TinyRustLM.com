"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  finalizeVnextIdentityDocument,
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const { failEvidence } = require("./vnext-evidence-error.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const {
  domainSeparatedDigest,
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");

const profilePath = path.resolve(__dirname,
  "../../contracts/vnext/site-publication-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const sitePublicationProfile = parseStrictJson(profileBytes);
const sitePublicationProfileSha256 = sha256(profileBytes);

const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const sourceRevisionPattern = /^(?:git-sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/u;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const planInputFields = Object.freeze([
  "approvedClaimBytes",
  "previousHistoryBytes",
  "publicReadbackReceiptBytes",
  "releaseManifestBytes",
  "webPublicationGeneratorBytes"
]);
const materializationInputFields = Object.freeze([
  ...planInputFields,
  "sitePublicationPlanReceiptBytes",
  "sitePublisherSignatureReceiptBytes"
]);
const topProfileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "canonicalJsonProfile",
  "hashAlgorithm", "networkAccess", "sourceMutation", "releaseManifestSchema",
  "claimSchema", "receiptSchema", "plan", "sitePublisher", "materialization",
  "planMaterialFields", "pointerFields", "historyFields", "historyEntryFields",
  "generatedAssetFields", "limits"
]);
const planProfileFields = Object.freeze([
  "materialSchema", "receiptType", "phase", "status", "evidenceScope",
  "materialIdentityDomain", "configurationIdentityDomain",
  "approvedClaimSetIdentityDomain", "staticReadbackEvidenceScope",
  "requiredInputHashNames", "optionalInputHashName", "outputHashName",
  "requiredPublicParameterNames", "previousHistoryPolicy", "publicationPolicy"
]);
const sitePublisherProfileFields = Object.freeze([
  "receiptType", "role", "signatureDomain", "scope", "signedSchema",
  "releaseIdPolicy", "authorityPolicy", "signaturePolicy"
]);
const materializationProfileFields = Object.freeze([
  "pointerSchema", "pointerPath", "pointerRole", "historySchema", "historyPath",
  "historyRole", "contentType", "cachePolicy",
  "generatedInventoryIdentityDomain", "publishedClaimSetIdentityDomain",
  "webAssetInventoryIdentityDomain", "staticObservationOutputHashName",
  "verifiedWebInventoryOutputHashName", "publishedClaimStatus",
  "publishedClaimReleasePolicy", "publishedClaimEvidencePolicy",
  "publishedClaimSupersessionPolicy", "historyPolicy", "persistencePolicy",
  "publicationPolicy"
]);
const planMaterialFields = Object.freeze([
  "approvedClaimIds", "approvedClaimSetSha256", "campaignId",
  "materializationSeedSha256", "previousHistorySha256", "profileId",
  "profileSha256", "publicOrigin", "releaseId", "releaseManifestSha256",
  "schema", "siteId", "sourceRevision", "staticPublicReadbackReceiptId",
  "webPublicationGeneratorSha256", "webSecurityHeaderProfileSha256"
]);
const pointerFields = Object.freeze([
  "campaignId", "productId", "profileId", "profileSha256", "publicOrigin",
  "publicationAuthorizedAtUtc", "publishedClaimIds", "releaseDate", "releaseId",
  "releaseManifestSha256", "schema", "siteId", "sitePublisherSignatureReceiptId",
  "sourceRevision", "staticObservationInventorySha256",
  "staticPublicReadbackReceiptId", "version"
]);
const historyFields = Object.freeze([
  "entries", "generatedAtUtc", "profileId", "profileSha256", "publicOrigin",
  "schema", "siteId"
]);
const historyEntryFields = Object.freeze([
  "campaignId", "productId", "publicationAuthorizedAtUtc", "publishedClaimIds",
  "releaseDate", "releaseId", "releaseManifestSha256",
  "sitePublisherSignatureReceiptId", "sourceRevision",
  "staticObservationInventorySha256", "staticPublicReadbackReceiptId", "version"
]);
const generatedAssetFields = Object.freeze([
  "byteLength", "cachePolicy", "contentType", "path", "role",
  "securityHeaderProfileSha256", "sha256"
]);
const limitFields = Object.freeze([
  "maximumApprovedClaims", "maximumClaimBytes", "maximumHistoryBytes",
  "maximumHistoryEntries", "maximumPointerBytes", "maximumPlanMaterialBytes",
  "maximumGeneratedTotalBytes", "maximumInputBytes", "maximumDepth",
  "maximumTotalEntries", "maximumObjectMembers", "maximumArrayItems",
  "maximumStringCodeUnits", "maximumTotalStringCodeUnits"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameStrings(left, right) {
  return left.length === right.length &&
    left.every((entry, index) => entry === right[index]);
}

function exactDataObject(value, fields, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value).sort();
  const expected = [...fields].sort();
  if (!sameStrings(names, expected)) failEvidence(code, step);
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
  }
  return value;
}

function dataArray(value, maximum, code, step) {
  if (!Array.isArray(value) || value.length > maximum ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const expectedNames = ["length", ...value.map((_entry, index) => String(index))]
    .sort();
  if (!sameStrings(Object.getOwnPropertyNames(value).sort(), expectedNames)) {
    failEvidence(code, step);
  }
  return value.map((_entry, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    return descriptor.value;
  });
}

function assertStringArray(value, expected, code, step) {
  const entries = dataArray(value, expected.length, code, step);
  if (!sameStrings(entries, expected)) failEvidence(code, step);
}

function validateProfile() {
  const step = "site-publication-profile";
  exactDataObject(sitePublicationProfile, topProfileFields,
    "site_publication_profile_invalid", step);
  exactDataObject(sitePublicationProfile.plan, planProfileFields,
    "site_publication_profile_invalid", step);
  exactDataObject(sitePublicationProfile.sitePublisher, sitePublisherProfileFields,
    "site_publication_profile_invalid", step);
  exactDataObject(sitePublicationProfile.materialization,
    materializationProfileFields, "site_publication_profile_invalid", step);
  exactDataObject(sitePublicationProfile.limits, limitFields,
    "site_publication_profile_invalid", step);
  assertStringArray(sitePublicationProfile.planMaterialFields, planMaterialFields,
    "site_publication_profile_invalid", step);
  assertStringArray(sitePublicationProfile.pointerFields, pointerFields,
    "site_publication_profile_invalid", step);
  assertStringArray(sitePublicationProfile.historyFields, historyFields,
    "site_publication_profile_invalid", step);
  assertStringArray(sitePublicationProfile.historyEntryFields, historyEntryFields,
    "site_publication_profile_invalid", step);
  assertStringArray(sitePublicationProfile.generatedAssetFields, generatedAssetFields,
    "site_publication_profile_invalid", step);
  const limits = sitePublicationProfile.limits;
  if (sitePublicationProfile.schema !==
        "tinyrustlm.vnext.site_publication_profile.v1" ||
      sitePublicationProfile.profileId !== "tinyrustlm.vnext.site-publication.v1" ||
      sitePublicationProfile.status !== "frozen" ||
      sitePublicationProfile.versionPolicy !==
        "single-current-profile-no-compatibility-reader" ||
      sitePublicationProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      sitePublicationProfile.hashAlgorithm !== "sha256" ||
      sitePublicationProfile.networkAccess !==
        "forbidden-pure-materialization-only" ||
      sitePublicationProfile.sourceMutation !== "forbidden" ||
      sitePublicationProfile.releaseManifestSchema !==
        "tinyrustlm.vnext.release_manifest.v3" ||
      sitePublicationProfile.claimSchema !== "tinyrustlm.vnext.claim.v2" ||
      sitePublicationProfile.receiptSchema !== "tinyrustlm.vnext.receipt.v1" ||
      sitePublicationProfile.plan.receiptType !== "site-synchronization" ||
      sitePublicationProfile.plan.phase !== "site-synchronization" ||
      sitePublicationProfile.plan.status !== "pass" ||
      sitePublicationProfile.plan.evidenceScope !==
        "site-publication-plan-only" ||
      sitePublicationProfile.sitePublisher.role !== "site-publisher" ||
      sitePublicationProfile.sitePublisher.signatureDomain !==
        "tinyrustlm.signature.site-publisher.v1" ||
      sitePublicationProfile.sitePublisher.scope !== "site-publication" ||
      sitePublicationProfile.sitePublisher.signedSchema !==
        "tinyrustlm.vnext.receipt.v1" ||
      limitFields.some((name) => !Number.isSafeInteger(limits[name]) ||
        limits[name] <= 0)) {
    failEvidence("site_publication_profile_invalid", step);
  }
}

validateProfile();

const parserLimits = Object.freeze({
  maximumBytes: sitePublicationProfile.limits.maximumInputBytes,
  maximumDepth: sitePublicationProfile.limits.maximumDepth,
  maximumTotalEntries: sitePublicationProfile.limits.maximumTotalEntries,
  maximumObjectMembers: sitePublicationProfile.limits.maximumObjectMembers,
  maximumArrayItems: sitePublicationProfile.limits.maximumArrayItems,
  maximumStringCodeUnits: sitePublicationProfile.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits:
    sitePublicationProfile.limits.maximumTotalStringCodeUnits,
  maximumNumberCharacters: 128
});
const jcsLimits = Object.freeze({
  maximumDepth: sitePublicationProfile.limits.maximumDepth,
  maximumTotalEntries: sitePublicationProfile.limits.maximumTotalEntries,
  maximumObjectMembers: sitePublicationProfile.limits.maximumObjectMembers,
  maximumArrayItems: sitePublicationProfile.limits.maximumArrayItems,
  maximumStringCodeUnits: sitePublicationProfile.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits:
    sitePublicationProfile.limits.maximumTotalStringCodeUnits,
  numberProfile: "vnext-safe-integer"
});

function normalizeBytes(value, maximum, code, step) {
  let bytes;
  if (Buffer.isBuffer(value)) bytes = Buffer.from(value);
  else if (value instanceof Uint8Array) {
    bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  } else failEvidence(code, step);
  if (bytes.length === 0 || bytes.length > maximum) failEvidence(code, step);
  return bytes;
}

function parseCanonicalBytes(bytes, maximum, code, step) {
  if (bytes.length === 0 || bytes.length > maximum) failEvidence(code, step);
  let value;
  try {
    value = parseStrictJson(bytes, { ...parserLimits, maximumBytes: maximum });
  } catch {
    failEvidence(code, step);
  }
  let canonical;
  try {
    canonical = canonicalizeVnextJcsBytes(value, jcsLimits);
  } catch {
    failEvidence(code, step);
  }
  if (!canonical.equals(bytes)) failEvidence(code, step);
  return value;
}

function readIdentity(bytes, schema, code, step) {
  try {
    const result = validateVnextIdentityDocumentBytes(bytes);
    if (result.schema !== schema) failEvidence(code, step);
    return result;
  } catch (error) {
    if (error?.code === code) throw error;
    failEvidence(code, step);
  }
}

function readReceipt(bytes, code, step) {
  try {
    return validateVnextReceiptBytes(bytes);
  } catch (error) {
    if (error?.code === code) throw error;
    failEvidence(code, step);
  }
}

function compareUtc(left, right, code, step) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    failEvidence(code, step);
  }
  return Math.sign(leftTime - rightTime);
}

function validDate(value) {
  const match = datePattern.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function validPublicOrigin(value) {
  if (typeof value !== "string" || !value.endsWith("/")) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.username === "" &&
    parsed.password === "" && parsed.search === "" && parsed.hash === "" &&
    parsed.pathname === "/" && parsed.href === value;
}

function bindingMap(entries, code, step) {
  const result = new Map();
  for (const entry of entries) {
    if (result.has(entry.name)) failEvidence(code, step);
    result.set(entry.name, entry.sha256);
  }
  return result;
}

function parameterMap(entries, code, step) {
  const result = new Map();
  for (const entry of entries) {
    if (result.has(entry.name)) failEvidence(code, step);
    result.set(entry.name, entry);
  }
  return result;
}

function requireExactBindings(actualEntries, expectedEntries, code, step) {
  const actual = bindingMap(actualEntries, code, step);
  const expected = new Map(expectedEntries.map((entry) => [entry.name, entry.sha256]));
  if (actual.size !== expected.size) failEvidence(code, step);
  for (const [name, digest] of expected) {
    if (actual.get(name) !== digest) failEvidence(code, step);
  }
}

function requireExactParameters(actualEntries, expectedEntries, code, step) {
  const actual = parameterMap(actualEntries, code, step);
  const expected = new Map(expectedEntries.map((entry) => [entry.name, entry]));
  if (actual.size !== expected.size) failEvidence(code, step);
  for (const [name, entry] of expected) {
    const candidate = actual.get(name);
    if (!candidate || candidate.value !== entry.value || candidate.unit !== entry.unit) {
      failEvidence(code, step);
    }
  }
}

function ensureAggregateInputLimit(byteGroups) {
  let total = 0;
  for (const bytes of byteGroups) {
    if (bytes !== null) total += bytes.length;
    if (!Number.isSafeInteger(total) ||
        total > sitePublicationProfile.limits.maximumInputBytes) {
      failEvidence("site_publication_input_byte_limit", "site-publication-input");
    }
  }
}

function normalizePlanInput(rawInput, fields = planInputFields) {
  const step = "site-publication-input";
  exactDataObject(rawInput, fields, "site_publication_input_invalid", step);
  const releaseManifestBytes = normalizeBytes(rawInput.releaseManifestBytes,
    524288, "site_publication_release_bytes_invalid", step);
  const publicReadbackReceiptBytes = normalizeBytes(
    rawInput.publicReadbackReceiptBytes, 262144,
    "site_publication_readback_bytes_invalid", step);
  const webPublicationGeneratorBytes = normalizeBytes(
    rawInput.webPublicationGeneratorBytes, 1048576,
    "site_publication_generator_bytes_invalid", step);
  const approvedClaimValues = dataArray(rawInput.approvedClaimBytes,
    sitePublicationProfile.limits.maximumApprovedClaims,
    "site_publication_claim_array_invalid", step);
  if (approvedClaimValues.length === 0) {
    failEvidence("site_publication_claim_array_invalid", step);
  }
  const approvedClaimBytes = approvedClaimValues.map((value) => normalizeBytes(
    value, sitePublicationProfile.limits.maximumClaimBytes,
    "site_publication_claim_bytes_invalid", step));
  let previousHistoryBytes = null;
  if (rawInput.previousHistoryBytes !== null) {
    previousHistoryBytes = normalizeBytes(rawInput.previousHistoryBytes,
      sitePublicationProfile.limits.maximumHistoryBytes,
      "site_publication_history_bytes_invalid", step);
  }
  const extraBytes = fields === materializationInputFields
    ? [
        normalizeBytes(rawInput.sitePublicationPlanReceiptBytes, 262144,
          "site_publication_plan_receipt_bytes_invalid", step),
        normalizeBytes(rawInput.sitePublisherSignatureReceiptBytes, 262144,
          "site_publication_signature_bytes_invalid", step)
      ]
    : [];
  ensureAggregateInputLimit([
    releaseManifestBytes,
    publicReadbackReceiptBytes,
    webPublicationGeneratorBytes,
    previousHistoryBytes,
    ...approvedClaimBytes,
    ...extraBytes
  ]);
  return Object.freeze({
    approvedClaimBytes,
    previousHistoryBytes,
    publicReadbackReceiptBytes,
    releaseManifestBytes,
    webPublicationGeneratorBytes,
    sitePublicationPlanReceiptBytes: extraBytes[0] ?? null,
    sitePublisherSignatureReceiptBytes: extraBytes[1] ?? null
  });
}

function validateGeneratedDescriptors(release) {
  const step = "site-publication-release";
  const expected = [
    {
      path: sitePublicationProfile.materialization.historyPath,
      role: sitePublicationProfile.materialization.historyRole
    },
    {
      path: sitePublicationProfile.materialization.pointerPath,
      role: sitePublicationProfile.materialization.pointerRole
    }
  ].sort((left, right) => left.path.localeCompare(right.path));
  if (release.generatedPublicationFiles.length !== expected.length) {
    failEvidence("site_publication_generated_descriptor_invalid", step);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const actual = release.generatedPublicationFiles[index];
    if (actual.path !== expected[index].path || actual.role !== expected[index].role ||
        actual.contentType !== sitePublicationProfile.materialization.contentType ||
        actual.cachePolicy !== sitePublicationProfile.materialization.cachePolicy ||
        actual.securityHeaderProfileSha256 !==
          release.webSecurityHeaderProfileSha256) {
      failEvidence("site_publication_generated_descriptor_invalid", step);
    }
  }
}

function validateClaims(release, claimByteValues) {
  const step = "site-publication-claims";
  const claims = claimByteValues.map((bytes) => readIdentity(bytes,
    sitePublicationProfile.claimSchema, "site_publication_claim_invalid", step));
  const claimIds = claims.map((claim) => claim.subjectId);
  if (!sameStrings(claimIds, release.claimIds)) {
    failEvidence("site_publication_claim_selection_invalid", step);
  }
  const siteIds = new Set();
  for (const claim of claims) {
    const value = claim.value;
    siteIds.add(value.siteId);
    if (value.status !== "approved-for-publication" ||
        value.sourceRevision !== release.sourceRevision || value.releaseId !== null ||
        value.evidenceReceiptIds.length === 0 || value.blockerCodes.length !== 0) {
      failEvidence("site_publication_claim_not_approved", step);
    }
  }
  if (siteIds.size !== 1) failEvidence("site_publication_claim_site_mismatch", step);
  return Object.freeze({ claims, claimIds, siteId: [...siteIds][0] });
}

function validateStaticReadback(release, receiptBytes, generatorSha256) {
  const step = "site-publication-static-readback";
  const validated = readReceipt(receiptBytes,
    "site_publication_static_readback_invalid", step);
  const receipt = validated.receipt;
  if (receipt.receiptType !== "public-readback" ||
      receipt.phase !== "public-readback" || receipt.status !== "pass" ||
      receipt.sourceRevision !== release.sourceRevision ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.signatureEnvelope !== null || receipt.authorityRegistry !== null ||
      receipt.keyRevocation !== null || receipt.offlineBundle !== null ||
      receipt.redaction.profile !== "tinyrustlm.vnext.public_safe.v1" ||
      receipt.redaction.decision !== "public-safe") {
    failEvidence("site_publication_static_readback_invalid", step);
  }
  const parameters = parameterMap(receipt.publicParameters,
    "site_publication_static_readback_invalid", step);
  const expectedParameters = new Map([
    ["subject_id", release.releaseId],
    ["public-origin", release.publicOrigin],
    ["evidence-scope", sitePublicationProfile.plan.staticReadbackEvidenceScope],
    ["asset-count", String(release.webAssets.length)],
    ["total-bytes", String(release.webTotalBytes)]
  ]);
  for (const [name, value] of expectedParameters) {
    if (parameters.get(name)?.value !== value) {
      failEvidence("site_publication_static_readback_binding_invalid", step);
    }
  }
  const expectedWebInventorySha256 = domainSeparatedDigest(
    sitePublicationProfile.materialization.webAssetInventoryIdentityDomain,
    release.webAssets
  );
  const inputHashes = bindingMap(receipt.inputHashes,
    "site_publication_static_readback_invalid", step);
  const outputHashes = bindingMap(receipt.outputHashes,
    "site_publication_static_readback_invalid", step);
  if (inputHashes.get("release-manifest-canonical-content") !==
        release.canonicalContentSha256 ||
      inputHashes.get("web-publication-generator") !== generatorSha256 ||
      inputHashes.get("web-security-header-profile") !==
        release.webSecurityHeaderProfileSha256 ||
      inputHashes.get("web-asset-inventory") !== expectedWebInventorySha256 ||
      outputHashes.get(
        sitePublicationProfile.materialization.verifiedWebInventoryOutputHashName
      ) !== expectedWebInventorySha256) {
    failEvidence("site_publication_static_readback_binding_invalid", step);
  }
  const observationInventorySha256 = outputHashes.get(
    sitePublicationProfile.materialization.staticObservationOutputHashName
  );
  if (!digestPattern.test(observationInventorySha256 ?? "")) {
    failEvidence("site_publication_static_readback_binding_invalid", step);
  }
  return Object.freeze({
    campaignId: receipt.campaignId,
    completedAtUtc: receipt.completedAtUtc,
    observationInventorySha256,
    receiptId: receipt.receiptId,
    validated
  });
}

function validateHistoryEntry(entry, context, previousEntry) {
  const step = "site-publication-history";
  exactDataObject(entry, historyEntryFields, "site_publication_history_invalid", step);
  if (!contentIdPattern.test(entry.releaseId) ||
      !digestPattern.test(entry.releaseManifestSha256) ||
      !contentIdPattern.test(entry.sitePublisherSignatureReceiptId) ||
      !contentIdPattern.test(entry.staticPublicReadbackReceiptId) ||
      !digestPattern.test(entry.staticObservationInventorySha256) ||
      !semverPattern.test(entry.version) || !safeIdPattern.test(entry.campaignId) ||
      !safeIdPattern.test(entry.productId) ||
      !sourceRevisionPattern.test(entry.sourceRevision) ||
      !validDate(entry.releaseDate) ||
      !Array.isArray(entry.publishedClaimIds) ||
      entry.publishedClaimIds.length === 0 ||
      entry.publishedClaimIds.some((id) => !contentIdPattern.test(id)) ||
      !sameStrings(entry.publishedClaimIds, [...new Set(entry.publishedClaimIds)].sort())) {
    failEvidence("site_publication_history_invalid", step);
  }
  compareUtc(entry.publicationAuthorizedAtUtc,
    entry.publicationAuthorizedAtUtc, "site_publication_history_invalid", step);
  if (context !== null && (entry.productId !== context.productId ||
      entry.sourceRevision.length === 0)) {
    failEvidence("site_publication_history_invalid", step);
  }
  if (previousEntry !== null &&
      (compareUtc(previousEntry.publicationAuthorizedAtUtc,
        entry.publicationAuthorizedAtUtc,
        "site_publication_history_invalid", step) >= 0 ||
       compareSemver(previousEntry.version, entry.version) >= 0 ||
       previousEntry.releaseId === entry.releaseId ||
       previousEntry.releaseDate > entry.releaseDate)) {
    failEvidence("site_publication_history_not_appendable", step);
  }
}

function compareSemver(left, right) {
  const leftMatch = semverPattern.exec(left);
  const rightMatch = semverPattern.exec(right);
  if (!leftMatch || !rightMatch) return Number.NaN;
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftMatch[index]) - Number(rightMatch[index]);
    if (difference !== 0) return Math.sign(difference);
  }
  const leftPrerelease = leftMatch[4];
  const rightPrerelease = rightMatch[4];
  if (leftPrerelease === undefined && rightPrerelease === undefined) return 0;
  if (leftPrerelease === undefined) return 1;
  if (rightPrerelease === undefined) return -1;
  const leftParts = leftPrerelease.split(".");
  const rightParts = rightPrerelease.split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    if (leftParts[index] === undefined) return -1;
    if (rightParts[index] === undefined) return 1;
    if (leftParts[index] === rightParts[index]) continue;
    const leftNumeric = /^\d+$/u.test(leftParts[index]);
    const rightNumeric = /^\d+$/u.test(rightParts[index]);
    if (leftNumeric && rightNumeric) {
      return Number(leftParts[index]) < Number(rightParts[index]) ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

function validateVnextSitePublicationHistoryBytes(rawBytes, expected = null) {
  const step = "site-publication-history";
  const bytes = normalizeBytes(rawBytes,
    sitePublicationProfile.limits.maximumHistoryBytes,
    "site_publication_history_bytes_invalid", step);
  const value = parseCanonicalBytes(bytes,
    sitePublicationProfile.limits.maximumHistoryBytes,
    "site_publication_history_invalid", step);
  exactDataObject(value, historyFields, "site_publication_history_invalid", step);
  if (value.schema !== sitePublicationProfile.materialization.historySchema ||
      value.profileId !== sitePublicationProfile.profileId ||
      value.profileSha256 !== sitePublicationProfileSha256 ||
      !safeIdPattern.test(value.siteId) || !validPublicOrigin(value.publicOrigin)) {
    failEvidence("site_publication_history_invalid", step);
  }
  if (expected !== null && (value.siteId !== expected.siteId ||
      value.publicOrigin !== expected.publicOrigin)) {
    failEvidence("site_publication_history_context_mismatch", step);
  }
  const entries = dataArray(value.entries,
    sitePublicationProfile.limits.maximumHistoryEntries,
    "site_publication_history_invalid", step);
  if (entries.length === 0) failEvidence("site_publication_history_invalid", step);
  let previous = null;
  let context = null;
  const releaseIds = new Set();
  for (const entry of entries) {
    if (context === null) context = { productId: entry.productId };
    validateHistoryEntry(entry, context, previous);
    if (releaseIds.has(entry.releaseId)) {
      failEvidence("site_publication_history_invalid", step);
    }
    releaseIds.add(entry.releaseId);
    previous = entry;
  }
  if (value.generatedAtUtc !== previous.publicationAuthorizedAtUtc) {
    failEvidence("site_publication_history_invalid", step);
  }
  return immutableBytesResult({ bytes, value: deepFreeze(value) });
}

function buildPlan(normalized) {
  const step = "site-publication-plan";
  const releaseResult = readIdentity(normalized.releaseManifestBytes,
    sitePublicationProfile.releaseManifestSchema,
    "site_publication_release_invalid", step);
  const release = releaseResult.value;
  validateGeneratedDescriptors(release);
  const generatorSha256 = sha256(normalized.webPublicationGeneratorBytes);
  if (generatorSha256 !== release.webPublicationGeneratorSha256) {
    failEvidence("site_publication_generator_binding_invalid", step);
  }
  const claimSet = validateClaims(release, normalized.approvedClaimBytes);
  const staticReadback = validateStaticReadback(release,
    normalized.publicReadbackReceiptBytes, generatorSha256);
  const previousHistory = normalized.previousHistoryBytes === null
    ? null
    : validateVnextSitePublicationHistoryBytes(normalized.previousHistoryBytes, {
        publicOrigin: release.publicOrigin,
        siteId: claimSet.siteId
      });
  const approvedClaimSetSha256 = domainSeparatedDigest(
    sitePublicationProfile.plan.approvedClaimSetIdentityDomain,
    claimSet.claims.map((claim) => ({
      canonicalContentSha256: claim.canonicalContentSha256,
      claimId: claim.subjectId
    }))
  );
  const base = {
    approvedClaimIds: claimSet.claimIds,
    approvedClaimSetSha256,
    campaignId: staticReadback.campaignId,
    previousHistorySha256: previousHistory === null
      ? null
      : sha256(previousHistory.bytes),
    profileId: sitePublicationProfile.profileId,
    profileSha256: sitePublicationProfileSha256,
    publicOrigin: release.publicOrigin,
    releaseId: release.releaseId,
    releaseManifestSha256: release.canonicalContentSha256,
    schema: sitePublicationProfile.plan.materialSchema,
    siteId: claimSet.siteId,
    sourceRevision: release.sourceRevision,
    staticPublicReadbackReceiptId: staticReadback.receiptId,
    webPublicationGeneratorSha256: generatorSha256,
    webSecurityHeaderProfileSha256: release.webSecurityHeaderProfileSha256
  };
  const materializationSeedSha256 = domainSeparatedDigest(
    sitePublicationProfile.plan.materialIdentityDomain, base);
  const planMaterial = {
    approvedClaimIds: base.approvedClaimIds,
    approvedClaimSetSha256: base.approvedClaimSetSha256,
    campaignId: base.campaignId,
    materializationSeedSha256,
    previousHistorySha256: base.previousHistorySha256,
    profileId: base.profileId,
    profileSha256: base.profileSha256,
    publicOrigin: base.publicOrigin,
    releaseId: base.releaseId,
    releaseManifestSha256: base.releaseManifestSha256,
    schema: base.schema,
    siteId: base.siteId,
    sourceRevision: base.sourceRevision,
    staticPublicReadbackReceiptId: base.staticPublicReadbackReceiptId,
    webPublicationGeneratorSha256: base.webPublicationGeneratorSha256,
    webSecurityHeaderProfileSha256: base.webSecurityHeaderProfileSha256
  };
  exactDataObject(planMaterial, planMaterialFields,
    "site_publication_plan_material_invalid", step);
  const planMaterialBytes = canonicalizeVnextJcsBytes(planMaterial, jcsLimits);
  if (planMaterialBytes.length >
      sitePublicationProfile.limits.maximumPlanMaterialBytes) {
    failEvidence("site_publication_plan_material_byte_limit", step);
  }
  return Object.freeze({
    approvedClaims: claimSet.claims,
    planMaterial: deepFreeze(planMaterial),
    planMaterialBytes,
    planMaterialSha256: sha256(planMaterialBytes),
    previousHistory,
    release: releaseResult,
    staticReadback
  });
}

function createVnextSitePublicationPlanMaterial(rawInput) {
  const normalized = normalizePlanInput(rawInput);
  const built = buildPlan(normalized);
  return immutableBytesResult({
    bytes: built.planMaterialBytes,
    value: {
      materialSchema: sitePublicationProfile.plan.materialSchema,
      materializationSeedSha256: built.planMaterial.materializationSeedSha256,
      planMaterial: built.planMaterial,
      planMaterialSha256: built.planMaterialSha256,
      profileId: sitePublicationProfile.profileId,
      profileSha256: sitePublicationProfileSha256,
      publicationStatus: "not-published",
      releaseId: built.release.subjectId
    },
    byteProperty: "planMaterialBytes"
  });
}

function expectedPlanReceiptBindings(built) {
  const material = built.planMaterial;
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
  return Object.freeze({
    configurationSha256: domainSeparatedDigest(
      sitePublicationProfile.plan.configurationIdentityDomain,
      {
        profileSha256: sitePublicationProfileSha256,
        webPublicationGeneratorSha256: material.webPublicationGeneratorSha256
      }
    ),
    inputHashes: inputHashes.sort((left, right) => left.name.localeCompare(right.name)),
    outputHashes: [{
      name: sitePublicationProfile.plan.outputHashName,
      sha256: built.planMaterialSha256
    }],
    publicParameters: [
      {
        name: "evidence-scope",
        value: sitePublicationProfile.plan.evidenceScope,
        unit: null
      },
      { name: "operation_id", value: null, unit: null },
      { name: "public-origin", value: material.publicOrigin, unit: null },
      { name: "site-id", value: material.siteId, unit: null },
      { name: "subject_id", value: material.releaseId, unit: null }
    ]
  });
}

function validatePlanReceipt(built, rawBytes) {
  const step = "site-publication-plan-receipt";
  const validated = readReceipt(rawBytes, "site_publication_plan_receipt_invalid", step);
  const receipt = validated.receipt;
  const expected = expectedPlanReceiptBindings(built);
  const parameters = parameterMap(receipt.publicParameters,
    "site_publication_plan_receipt_invalid", step);
  const operation = parameters.get("operation_id");
  if (!operation || operation.value !== receipt.attemptId || operation.unit !== null) {
    failEvidence("site_publication_plan_receipt_invalid", step);
  }
  const expectedParameters = expected.publicParameters.map((entry) =>
    entry.name === "operation_id"
      ? { ...entry, value: receipt.attemptId }
      : entry);
  if (receipt.receiptType !== sitePublicationProfile.plan.receiptType ||
      receipt.phase !== sitePublicationProfile.plan.phase ||
      receipt.status !== sitePublicationProfile.plan.status ||
      receipt.campaignId !== built.planMaterial.campaignId ||
      receipt.sourceRevision !== built.planMaterial.sourceRevision ||
      !sameStrings(receipt.inputReceiptIds,
        [built.staticReadback.receiptId]) ||
      receipt.configurationSha256 !== expected.configurationSha256 ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.signatureEnvelope !== null || receipt.authorityRegistry !== null ||
      receipt.keyRevocation !== null || receipt.offlineBundle !== null ||
      receipt.attestationReference !==
        built.release.value.campaignAttestationReceiptId ||
      receipt.externalEvidenceReferences.length !== 0 ||
      receipt.redaction.profile !== "tinyrustlm.vnext.public_safe.v1" ||
      receipt.redaction.decision !== "public-safe" ||
      receipt.supersedesReceiptIds.length !== 0 ||
      compareUtc(built.staticReadback.completedAtUtc, receipt.completedAtUtc,
        "site_publication_plan_receipt_invalid", step) > 0) {
    failEvidence("site_publication_plan_receipt_invalid", step);
  }
  requireExactBindings(receipt.inputHashes, expected.inputHashes,
    "site_publication_plan_receipt_binding_invalid", step);
  requireExactBindings(receipt.outputHashes, expected.outputHashes,
    "site_publication_plan_receipt_binding_invalid", step);
  requireExactParameters(receipt.publicParameters, expectedParameters,
    "site_publication_plan_receipt_binding_invalid", step);
  return validated;
}

function validateSitePublisherSignature(built, planReceipt, rawBytes) {
  const step = "site-publication-signature";
  const validated = readReceipt(rawBytes, "site_publication_signature_invalid", step);
  const receipt = validated.receipt;
  const envelope = receipt.signatureEnvelope;
  if (receipt.receiptType !== sitePublicationProfile.sitePublisher.receiptType ||
      receipt.phase !== sitePublicationProfile.sitePublisher.receiptType ||
      receipt.status !== "pass" || receipt.campaignId !== built.planMaterial.campaignId ||
      receipt.sourceRevision !== built.planMaterial.sourceRevision ||
      envelope === null || envelope.role !== sitePublicationProfile.sitePublisher.role ||
      envelope.signatureDomain !==
        sitePublicationProfile.sitePublisher.signatureDomain ||
      envelope.scope !== sitePublicationProfile.sitePublisher.scope ||
      envelope.signedSchema !== sitePublicationProfile.sitePublisher.signedSchema ||
      envelope.signedSubjectId !== planReceipt.receipt.receiptId ||
      envelope.campaignId !== built.planMaterial.campaignId ||
      envelope.releaseId !== built.planMaterial.releaseId ||
      !sameStrings(receipt.inputReceiptIds, [
        envelope.authorityRegistryReceiptId,
        planReceipt.receipt.receiptId
      ].sort()) || receipt.inputHashes.length !== 0 ||
      receipt.outputHashes.length !== 0 || receipt.publicParameters.length !== 0 ||
      receipt.externalEvidenceReferences.length !== 0 ||
      receipt.error !== null || receipt.blockerCode !== null ||
      receipt.authorityRegistry !== null || receipt.keyRevocation !== null ||
      receipt.offlineBundle !== null || receipt.attestationReference !== null ||
      receipt.redaction.profile !== "tinyrustlm.vnext.public_safe.v1" ||
      receipt.redaction.decision !== "public-safe" ||
      receipt.supersedesReceiptIds.length !== 0 ||
      compareUtc(planReceipt.receipt.completedAtUtc, envelope.issuedAtUtc,
        "site_publication_signature_invalid", step) > 0 ||
      compareUtc(envelope.issuedAtUtc, envelope.expiresAtUtc,
        "site_publication_signature_invalid", step) >= 0) {
    failEvidence("site_publication_signature_invalid", step);
  }
  return validated;
}

function makePublishedClaims(built, signature) {
  const step = "site-publication-published-claims";
  const issuedAtUtc = signature.receipt.signatureEnvelope.issuedAtUtc;
  return built.approvedClaims.map((approved) => {
    const value = approved.value;
    if (compareUtc(issuedAtUtc, value.reviewAtUtc,
      "site_publication_claim_not_current", step) >= 0 ||
        value.expiresAtUtc !== null && compareUtc(issuedAtUtc, value.expiresAtUtc,
          "site_publication_claim_not_current", step) >= 0) {
      failEvidence("site_publication_claim_not_current", step);
    }
    return finalizeVnextIdentityDocument({
      schema: sitePublicationProfile.claimSchema,
      subjectId: value.subjectId,
      siteId: value.siteId,
      route: value.route,
      component: value.component,
      wordingClass: value.wordingClass,
      claimType: value.claimType,
      evidenceTier: value.evidenceTier,
      status: sitePublicationProfile.materialization.publishedClaimStatus,
      scope: value.scope,
      publicWording: value.publicWording,
      evidenceReceiptIds: [...new Set([
        ...value.evidenceReceiptIds,
        built.staticReadback.receiptId,
        signature.receipt.receiptId
      ])].sort(),
      sourceRevision: value.sourceRevision,
      releaseId: built.release.subjectId,
      effectiveAtUtc: issuedAtUtc,
      expiresAtUtc: value.expiresAtUtc,
      reviewAtUtc: value.reviewAtUtc,
      ownerId: value.ownerId,
      blockerCodes: [],
      lastVerifiedAtUtc: issuedAtUtc,
      supersedesClaimIds: [approved.subjectId],
      redaction: value.redaction
    });
  });
}

function generatedAsset(descriptor, bytes) {
  return {
    byteLength: bytes.length,
    cachePolicy: descriptor.cachePolicy,
    contentType: descriptor.contentType,
    path: descriptor.path,
    role: descriptor.role,
    securityHeaderProfileSha256: descriptor.securityHeaderProfileSha256,
    sha256: sha256(bytes)
  };
}

function immutableBytesResult({ bytes, value, byteProperty = "bytes" }) {
  const owned = Buffer.from(bytes);
  const result = deepFreeze({ ...value });
  const wrapper = { ...result };
  Object.defineProperty(wrapper, byteProperty, {
    enumerable: true,
    get() {
      return Buffer.from(owned);
    }
  });
  return Object.freeze(wrapper);
}

function immutablePublishedClaim(claim) {
  return immutableBytesResult({
    bytes: claim.bytes,
    byteProperty: "claimBytes",
    value: {
      canonicalContentSha256: claim.canonicalContentSha256,
      claim: claim.value,
      claimId: claim.subjectId
    }
  });
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Buffer.isBuffer(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function materializeVnextSitePublication(rawInput) {
  const normalized = normalizePlanInput(rawInput, materializationInputFields);
  const built = buildPlan(normalized);
  const planReceipt = validatePlanReceipt(built,
    normalized.sitePublicationPlanReceiptBytes);
  const signature = validateSitePublisherSignature(built, planReceipt,
    normalized.sitePublisherSignatureReceiptBytes);
  const publishedClaims = makePublishedClaims(built, signature);
  const publishedClaimIds = publishedClaims.map((claim) => claim.subjectId).sort();
  const publishedClaimSetSha256 = domainSeparatedDigest(
    sitePublicationProfile.materialization.publishedClaimSetIdentityDomain,
    publishedClaims.map((claim) => ({
      canonicalContentSha256: claim.canonicalContentSha256,
      claimId: claim.subjectId
    })).sort((left, right) => left.claimId.localeCompare(right.claimId))
  );
  const release = built.release.value;
  const authorizedAtUtc = signature.receipt.signatureEnvelope.issuedAtUtc;
  const pointer = {
    campaignId: built.planMaterial.campaignId,
    productId: release.productId,
    profileId: sitePublicationProfile.profileId,
    profileSha256: sitePublicationProfileSha256,
    publicOrigin: release.publicOrigin,
    publicationAuthorizedAtUtc: authorizedAtUtc,
    publishedClaimIds,
    releaseDate: release.releaseDate,
    releaseId: release.releaseId,
    releaseManifestSha256: release.canonicalContentSha256,
    schema: sitePublicationProfile.materialization.pointerSchema,
    siteId: built.planMaterial.siteId,
    sitePublisherSignatureReceiptId: signature.receipt.receiptId,
    sourceRevision: release.sourceRevision,
    staticObservationInventorySha256:
      built.staticReadback.observationInventorySha256,
    staticPublicReadbackReceiptId: built.staticReadback.receiptId,
    version: release.version
  };
  exactDataObject(pointer, pointerFields, "site_publication_pointer_invalid",
    "site-publication-materialization");
  const pointerBytes = canonicalizeVnextJcsBytes(pointer, jcsLimits);
  if (pointerBytes.length > sitePublicationProfile.limits.maximumPointerBytes) {
    failEvidence("site_publication_pointer_byte_limit",
      "site-publication-materialization");
  }
  const historyEntry = Object.fromEntries(historyEntryFields.map((name) =>
    [name, pointer[name]]));
  const previousEntries = built.previousHistory === null
    ? []
    : built.previousHistory.entries;
  validateHistoryEntry(historyEntry, { productId: release.productId },
    previousEntries.at(-1) ?? null);
  const history = {
    entries: [...previousEntries, historyEntry],
    generatedAtUtc: authorizedAtUtc,
    profileId: sitePublicationProfile.profileId,
    profileSha256: sitePublicationProfileSha256,
    publicOrigin: release.publicOrigin,
    schema: sitePublicationProfile.materialization.historySchema,
    siteId: built.planMaterial.siteId
  };
  const historyBytes = canonicalizeVnextJcsBytes(history, jcsLimits);
  validateVnextSitePublicationHistoryBytes(historyBytes, {
    publicOrigin: release.publicOrigin,
    siteId: built.planMaterial.siteId
  });
  const descriptors = new Map(release.generatedPublicationFiles.map((entry) =>
    [entry.path, entry]));
  const generatedAssets = [
    generatedAsset(descriptors.get(
      sitePublicationProfile.materialization.historyPath), historyBytes),
    generatedAsset(descriptors.get(
      sitePublicationProfile.materialization.pointerPath), pointerBytes)
  ].sort((left, right) => left.path.localeCompare(right.path));
  const generatedTotalBytes = generatedAssets.reduce((sum, entry) =>
    sum + entry.byteLength, 0);
  if (generatedTotalBytes >
      sitePublicationProfile.limits.maximumGeneratedTotalBytes) {
    failEvidence("site_publication_generated_byte_limit",
      "site-publication-materialization");
  }
  const generatedInventorySha256 = domainSeparatedDigest(
    sitePublicationProfile.materialization.generatedInventoryIdentityDomain,
    generatedAssets
  );
  return Object.freeze({
    generatedAssets: deepFreeze(generatedAssets),
    generatedInventorySha256,
    generatedTotalBytes,
    get historyBytes() {
      return Buffer.from(historyBytes);
    },
    history: deepFreeze(history),
    planMaterial: built.planMaterial,
    planMaterialSha256: built.planMaterialSha256,
    planReceiptId: planReceipt.receipt.receiptId,
    profileId: sitePublicationProfile.profileId,
    profileSha256: sitePublicationProfileSha256,
    publicationStatus: "not-published-awaiting-generated-file-readback",
    publishedClaimSetSha256,
    publishedClaims: Object.freeze(publishedClaims.map(immutablePublishedClaim)),
    get pointerBytes() {
      return Buffer.from(pointerBytes);
    },
    pointer: deepFreeze(pointer),
    releaseId: release.releaseId,
    sitePublisherSignatureReceiptId: signature.receipt.receiptId
  });
}

module.exports = Object.freeze({
  createVnextSitePublicationPlanMaterial,
  materializeVnextSitePublication,
  sitePublicationProfile: deepFreeze(sitePublicationProfile),
  sitePublicationProfileSha256,
  validateVnextSitePublicationHistoryBytes
});
