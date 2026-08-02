"use strict";

const qualificationReceiptType = "tinyrustlm.model-qualification";
const outsideProofReceiptType = "tinyrustlm.p2p-outside-proof-v1";
const announcementReceiptType = "tinyrustlm.catalog-announcement-v1";
const publicReadbackReceiptType = "tinyrustlm.public-release-readback-v2";
const requiredModelCount = 20;
const requiredLaneProofCount = 40;
const canonicalCatalogUrl = "https://minimodel.org/catalog/models.v0.json";
const canonicalAnnouncementFeedUrl =
  "https://minimodel.org/catalog/peer-source-announcements.v0.json";
const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function compareReceipts(left, right) {
  return left.completedAtUtc.localeCompare(right.completedAtUtc) ||
    left.receiptId.localeCompare(right.receiptId);
}

function currentReceipts(receipts) {
  const superseded = new Set(receipts.flatMap((receipt) => receipt.supersedesReceiptIds));
  return receipts.filter((receipt) => !superseded.has(receipt.receiptId));
}

function newestBy(values, key) {
  const result = new Map();
  for (const value of values) {
    const identity = key(value);
    const previous = result.get(identity);
    if (!previous || compareReceipts(previous, value) < 0) result.set(identity, value);
  }
  return Array.from(result.values());
}

function validModelId(value) {
  return typeof value === "string" && safeIdentifierPattern.test(value);
}

function qualificationEvaluatorSha256(receipt) {
  const index = receipt.toolNames.indexOf("tinyrustlm-eval");
  const candidate = index >= 0 ? String(receipt.toolBinaryHashes[index] || "") : "";
  return sha256Pattern.test(candidate) ? candidate : null;
}

function newestEvaluatorSha256(receipts) {
  const candidates = receipts
    .map((receipt) => ({ receipt, evaluatorSha256: qualificationEvaluatorSha256(receipt) }))
    .filter((candidate) => candidate.evaluatorSha256)
    .sort((left, right) => compareReceipts(left.receipt, right.receipt));
  return candidates.at(-1)?.evaluatorSha256 || null;
}

function qualificationIsCountable(receipt) {
  return receipt.receiptType === qualificationReceiptType &&
    receipt.status === "pass" && receipt.evidenceClass !== "fixture" &&
    receipt.publicSafeParameters?.qualityClaim === "conversation-proven" &&
    validModelId(receipt.publicSafeParameters?.modelId) &&
    sha256Pattern.test(String(receipt.outputHashes?.model || ""));
}

function externalProofBaseValid(receipt, qualifications) {
  const parameters = receipt.publicSafeParameters || {};
  const parentQualification = receipt.inputReceiptIds
    .map((receiptId) => qualifications.get(receiptId))
    .find(Boolean);
  return receipt.receiptType === outsideProofReceiptType &&
    receipt.status === "pass" && receipt.evidenceClass === "outside-network" &&
    Boolean(parentQualification) &&
    parameters.modelId === parentQualification?.publicSafeParameters?.modelId &&
    parameters.artifactSha256 === parentQualification?.outputHashes?.model &&
    receipt.outputHashes?.artifact === parentQualification?.outputHashes?.model &&
    parameters.externalReceiptVersion === 1 &&
    parameters.publicReachabilityProven === true &&
    parameters.observerSignatureVerified === true &&
    parameters.completeTransferVerified === true &&
    Number.isSafeInteger(parameters.downloadedPieceCount) && parameters.downloadedPieceCount > 0 &&
    Number.isSafeInteger(parameters.downloadedArtifactByteCount) &&
    parameters.downloadedArtifactByteCount > 0 &&
    parameters.checkedRouteCount === 3 + parameters.downloadedPieceCount &&
    validModelId(parameters.modelId) && validModelId(parameters.laneId) &&
    Number.isFinite(Date.parse(parameters.expiresAtUtc));
}

function currentExternalProof(receipt, generatedAtUnixMs, qualifications) {
  return externalProofBaseValid(receipt, qualifications) &&
    Date.parse(receipt.publicSafeParameters.expiresAtUtc) > generatedAtUnixMs;
}

function currentAnnouncement(receipt, proofReceipts) {
  if (receipt.receiptType !== announcementReceiptType) return false;
  const parameters = receipt.publicSafeParameters || {};
  const proofParents = receipt.inputReceiptIds
    .map((receiptId) => proofReceipts.get(receiptId))
    .filter((proof) => proof?.publicSafeParameters?.modelId === parameters.modelId);
  const proofParameters = proofParents.map((proof) => proof.publicSafeParameters);
  return receipt.status === "pass" && receipt.evidenceClass === "deployment" &&
    parameters.publicHttpsReadback === true && parameters.active === true &&
    parameters.matchedAnnouncementCount === 2 &&
    parameters.projectServerServesModelBytes === false &&
    parameters.projectServerRunsModelBytes === false &&
    parameters.projectServerProxiesModelBytes === false &&
    validModelId(parameters.modelId) && proofParents.length === 2 &&
    new Set(proofParameters.map((proof) => proof.laneId)).size === 2 &&
    proofParameters.every((proof) => proof.artifactSha256 === parameters.artifactSha256 &&
      proof.pieceSetSha256 === parameters.pieceSetSha256 && proof.fleetId === parameters.fleetId) &&
    Array.isArray(parameters.laneIds) && parameters.laneIds.length === 2 &&
    new Set(parameters.laneIds).size === 2 && parameters.laneIds.every((laneId) =>
      proofParameters.some((proof) => proof.laneId === laneId));
}

function derivePublicEvidenceCohort(receipts, generatedAtUtc) {
  const generatedAtUnixMs = Date.parse(String(generatedAtUtc || ""));
  invariant(Number.isFinite(generatedAtUnixMs), "public evidence inspection time is invalid");
  const current = currentReceipts(receipts);
  const candidateQualifications = newestBy(current.filter((receipt) =>
    receipt.receiptType === qualificationReceiptType && receipt.evidenceClass === "local" &&
    ["pass", "rejected"].includes(receipt.status) &&
    validModelId(receipt.publicSafeParameters?.modelId)),
  (receipt) => receipt.publicSafeParameters.modelId);
  const evaluatorSha256 = newestEvaluatorSha256(candidateQualifications);
  const evaluatorQualifications = evaluatorSha256
    ? candidateQualifications.filter((receipt) =>
      qualificationEvaluatorSha256(receipt) === evaluatorSha256)
    : [];
  const evaluatorCoverageComplete = candidateQualifications.length > 0 &&
    evaluatorQualifications.length === candidateQualifications.length;
  const qualificationModels = newestBy(evaluatorQualifications.filter(qualificationIsCountable),
    (receipt) => receipt.publicSafeParameters.modelId);
  const qualifications = newestBy(qualificationModels, (receipt) => receipt.outputHashes.model);
  const qualificationById = new Map(qualifications.map((receipt) =>
    [receipt.receiptId, receipt]));
  const proofList = newestBy(current.filter((receipt) =>
    currentExternalProof(receipt, generatedAtUnixMs, qualificationById)), (receipt) =>
  `${receipt.publicSafeParameters.modelId}:${receipt.publicSafeParameters.laneId}`);
  const proofById = new Map(proofList.map((receipt) => [receipt.receiptId, receipt]));
  const announcements = newestBy(current.filter((receipt) =>
    currentAnnouncement(receipt, proofById)), (receipt) => receipt.publicSafeParameters.modelId);
  return Object.freeze({
    current: Object.freeze(current),
    candidateQualifications: Object.freeze(candidateQualifications),
    evaluatorSha256,
    evaluatorQualifications: Object.freeze(evaluatorQualifications),
    evaluatorCoverageComplete,
    qualifications: Object.freeze(qualifications),
    qualificationById,
    proofList: Object.freeze(proofList),
    proofById,
    announcements: Object.freeze(announcements),
    generatedAtUnixMs
  });
}

function inspectPublicReleaseReadback(receipts, generatedAtUtc) {
  const cohort = derivePublicEvidenceCohort(receipts, generatedAtUtc);
  const reasons = [];
  const announcements = [...cohort.announcements].sort((left, right) =>
    left.publicSafeParameters.modelId.localeCompare(right.publicSafeParameters.modelId));
  const proofReceiptIds = new Set(announcements.flatMap((receipt) => receipt.inputReceiptIds));
  const modelIds = new Set(announcements.map((receipt) => receipt.publicSafeParameters.modelId));
  const identities = new Map();
  for (const receipt of announcements) {
    const parameters = receipt.publicSafeParameters;
    const validIdentity = parameters.catalogUrl === canonicalCatalogUrl &&
      parameters.announcementFeedUrl === canonicalAnnouncementFeedUrl &&
      sha256Pattern.test(String(parameters.catalogSha256 || "")) &&
      sha256Pattern.test(String(parameters.announcementFeedSha256 || "")) &&
      receipt.outputHashes?.catalogReadback === parameters.catalogSha256 &&
      receipt.outputHashes?.feedReadback === parameters.announcementFeedSha256 &&
      receipt.attestationReference === `sha256:${parameters.announcementFeedSha256}`;
    if (!validIdentity) {
      reasons.push(`catalog_readback_identity_invalid:${parameters.modelId}`);
      continue;
    }
    const identity = `${parameters.catalogSha256}:${parameters.announcementFeedSha256}`;
    identities.set(identity, (identities.get(identity) || 0) + 1);
  }
  if (cohort.qualifications.length !== requiredModelCount) reasons.push("qualified_models_incomplete");
  if (cohort.proofList.length !== requiredLaneProofCount) reasons.push("outside_proofs_incomplete");
  if (announcements.length !== requiredModelCount) reasons.push("catalog_announcements_incomplete");
  if (modelIds.size !== requiredModelCount) reasons.push("catalog_model_identity_count_invalid");
  if (proofReceiptIds.size !== requiredLaneProofCount) reasons.push("catalog_proof_parent_count_invalid");
  if (identities.size !== 1 || Array.from(identities.values())[0] !== requiredModelCount) {
    reasons.push("catalog_readback_snapshot_not_common");
  }
  const common = identities.size === 1 ? Array.from(identities.keys())[0].split(":") : [];
  const complete = reasons.length === 0;
  return Object.freeze({
    complete,
    reasons: Object.freeze([...new Set(reasons)].sort()),
    announcements: Object.freeze(announcements),
    announcementReceiptIds: Object.freeze(announcements.map((receipt) => receipt.receiptId).sort()),
    proofReceiptIds: Object.freeze(Array.from(proofReceiptIds).sort()),
    modelIds: Object.freeze(Array.from(modelIds).sort()),
    catalogSha256: complete ? common[0] : null,
    announcementFeedSha256: complete ? common[1] : null,
    cohort
  });
}

function publicReadbackAggregateValid(receipt, inspection) {
  if (!receipt || !inspection.complete) return false;
  const parameters = receipt.publicSafeParameters || {};
  return receipt.receiptType === publicReadbackReceiptType && receipt.status === "pass" &&
    receipt.evidenceClass === "deployment" &&
    parameters.publicHttpsReadback === true &&
    parameters.finalReleaseReadbackPassed === true &&
    parameters.activeModelCount === requiredModelCount &&
    parameters.announcementCount === requiredModelCount &&
    parameters.externalLaneProofCount === requiredLaneProofCount &&
    parameters.catalogUrl === canonicalCatalogUrl &&
    parameters.announcementFeedUrl === canonicalAnnouncementFeedUrl &&
    parameters.catalogSha256 === inspection.catalogSha256 &&
    parameters.announcementFeedSha256 === inspection.announcementFeedSha256 &&
    receipt.outputHashes?.catalogReadback === inspection.catalogSha256 &&
    receipt.outputHashes?.feedReadback === inspection.announcementFeedSha256 &&
    receipt.attestationReference === `sha256:${inspection.announcementFeedSha256}` &&
    JSON.stringify([...receipt.inputReceiptIds].sort()) ===
      JSON.stringify(inspection.announcementReceiptIds);
}

module.exports = Object.freeze({
  announcementReceiptType,
  canonicalAnnouncementFeedUrl,
  canonicalCatalogUrl,
  compareReceipts,
  currentAnnouncement,
  currentExternalProof,
  currentReceipts,
  derivePublicEvidenceCohort,
  externalProofBaseValid,
  inspectPublicReleaseReadback,
  newestBy,
  outsideProofReceiptType,
  publicReadbackAggregateValid,
  publicReadbackReceiptType,
  qualificationEvaluatorSha256,
  qualificationIsCountable,
  requiredLaneProofCount,
  requiredModelCount,
  validModelId
});
