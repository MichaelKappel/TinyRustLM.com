"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const {
  canonicalAnnouncementFeedUrl,
  canonicalCatalogUrl,
  currentReceipts,
  inspectPublicReleaseReadback,
  publicReadbackReceiptType,
  requiredLaneProofCount,
  requiredModelCount
} = require("./campaign-public-evidence.js");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function persistPublicReleaseReadbackEvidence(options) {
  invariant(isPlainObject(options), "public release readback options are invalid");
  const allowedFields = new Set(["campaignId", "evidenceRoot", "sourceRevision"]);
  for (const key of Object.keys(options)) {
    invariant(allowedFields.has(key), `unknown public release readback option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/.test(campaignId),
    "campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "source revision is invalid");

  const observedAtUtc = new Date().toISOString();
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true })
      .every((entry) => !entry.isFile()),
  "public release readback evidence store contains quarantined files");
  const campaignReceipts = rebuilt.receipts.filter((receipt) => receipt.campaignId === campaignId);
  const inspection = inspectPublicReleaseReadback(campaignReceipts, observedAtUtc);
  const announcementReceiptSetSha256 = sha256(canonicalJson(inspection.announcementReceiptIds));
  const configurationHash = sha256(canonicalJson({
    receiptType: publicReadbackReceiptType,
    sourceRevision,
    requiredModelCount,
    requiredLaneProofCount,
    announcementReceiptIds: inspection.announcementReceiptIds,
    catalogSha256: inspection.catalogSha256,
    announcementFeedSha256: inspection.announcementFeedSha256,
    reasons: inspection.reasons
  }));
  const history = store.listReceipts((receipt) =>
    receipt.campaignId === campaignId && receipt.receiptType === publicReadbackReceiptType);
  const current = currentReceipts(history);
  invariant(current.length <= 1, "public release readback has several current receipts");
  const existing = current.find((receipt) => receipt.configurationHash === configurationHash);
  if (existing) return existing;

  const outputHashes = { announcementReceiptSet: announcementReceiptSetSha256 };
  if (inspection.complete) {
    outputHashes.catalogReadback = inspection.catalogSha256;
    outputHashes.feedReadback = inspection.announcementFeedSha256;
  }
  const toolHash = sha256(fs.readFileSync(__filename));
  return store.putReceipt({
    receiptType: publicReadbackReceiptType,
    campaignId,
    phase: "public-release-readback",
    attempt: history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: inspection.complete ? "pass" : "blocked",
    createdAtUtc: observedAtUtc,
    completedAtUtc: observedAtUtc,
    inputReceiptIds: inspection.announcementReceiptIds,
    inputHashes: { announcementReceiptSet: announcementReceiptSetSha256 },
    outputHashes,
    sourceRevision,
    toolNames: ["tinyrustlm-campaign-public-readback-evidence"],
    toolVersions: ["2"],
    toolBinaryHashes: [toolHash],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      credentialFreePublicHttpsReadback: inspection.complete,
      currentOutsideProofParentCount: inspection.proofReceiptIds.length,
      commonCatalogSnapshot: inspection.complete
    },
    configurationHash,
    publicSafeParameters: {
      activeModelCount: inspection.modelIds.length,
      announcementCount: inspection.announcements.length,
      externalLaneProofCount: inspection.proofReceiptIds.length,
      requiredModelCount,
      requiredLaneProofCount,
      catalogUrl: canonicalCatalogUrl,
      announcementFeedUrl: canonicalAnnouncementFeedUrl,
      catalogSha256: inspection.catalogSha256,
      announcementFeedSha256: inspection.announcementFeedSha256,
      publicHttpsReadback: inspection.complete,
      finalReleaseReadbackPassed: inspection.complete
    },
    boundedDiagnostics: {
      reasons: inspection.reasons,
      validationMode: "current-receipt-dag-and-common-live-https-snapshot"
    },
    blockerCode: inspection.complete ? null : "public_https_readback_incomplete",
    externalEvidenceReferences: [canonicalCatalogUrl, canonicalAnnouncementFeedUrl],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: inspection.complete ? "deployment" : "local",
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId),
    attestationReference: inspection.complete
      ? `sha256:${inspection.announcementFeedSha256}`
      : null
  }).receipt;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant(["--campaign-id", "--evidence-root", "--source-revision"].includes(name),
      `unknown public release readback argument: ${name}`);
    invariant(value !== undefined && !values.has(name),
      `public release readback argument is missing or duplicated: ${name}`);
    values.set(name, value);
  }
  for (const name of ["--campaign-id", "--evidence-root", "--source-revision"]) {
    invariant(values.has(name), `missing public release readback argument: ${name}`);
  }
  return Object.freeze({
    campaignId: values.get("--campaign-id"),
    evidenceRoot: values.get("--evidence-root"),
    sourceRevision: values.get("--source-revision")
  });
}

if (require.main === module) {
  try {
    const receipt = persistPublicReleaseReadbackEvidence(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({
      receiptId: receipt.receiptId,
      status: receipt.status,
      activeModelCount: receipt.publicSafeParameters.activeModelCount,
      announcementCount: receipt.publicSafeParameters.announcementCount,
      externalLaneProofCount: receipt.publicSafeParameters.externalLaneProofCount,
      blockerCode: receipt.blockerCode
    })}\n`);
    if (receipt.status !== "pass") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Public release readback evidence failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = Object.freeze({
  parseArguments,
  persistPublicReleaseReadbackEvidence,
  publicReadbackReceiptType
});
