"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const { buildCampaignDashboard } = require("../tools/campaign-evidence-dashboard.js");
const {
  persistPublicReleaseReadbackEvidence,
  publicReadbackReceiptType
} = require("../tools/campaign-public-readback-evidence.js");
const { currentReceipts } = require("../tools/campaign-public-evidence.js");

const campaignId = "public-readback-test-20260715";
const sourceRevision = "a".repeat(40);
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const evaluatorSha256 = digest("current-evaluator");
const catalogSha256 = digest("common-public-catalog");
const feedSha256 = digest("common-public-announcement-feed");

function receipt(label, overrides = {}) {
  return {
    receiptType: `tinyrustlm.${label}`,
    campaignId,
    phase: label,
    attempt: 1,
    status: "pass",
    createdAtUtc: "2026-07-15T06:00:00.000Z",
    completedAtUtc: "2026-07-15T06:01:00.000Z",
    inputReceiptIds: [],
    inputHashes: { input: digest(`${label}-input`) },
    outputHashes: { output: digest(`${label}-output`) },
    sourceRevision,
    toolNames: ["test-tool"],
    toolVersions: ["1"],
    toolBinaryHashes: [digest("test-tool")],
    runtimeIdentifier: "win-x64",
    operatingSystem: "win32",
    architecture: "x64",
    hardwareEvidence: { fixtureConstruction: true },
    configurationHash: digest(`${label}-configuration`),
    publicSafeParameters: {},
    boundedDiagnostics: {},
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: null,
    ...overrides
  };
}

function populateCompleteReadback(store, mutateAnnouncement = null) {
  const proofs = [];
  for (let index = 0; index < 20; index += 1) {
    const modelId = `tinyrustlm/model-${String(index).padStart(2, "0")}`;
    const artifactSha256 = digest(`${modelId}-artifact`);
    const pieceSetSha256 = digest(`${modelId}-pieces`);
    const qualification = store.putReceipt(receipt(`qualification-${index}`, {
      receiptType: "tinyrustlm.model-qualification",
      phase: "model-qualification",
      outputHashes: {
        evaluation: digest(`${modelId}-evaluation`),
        manifest: digest(`${modelId}-manifest`),
        model: artifactSha256,
        review: digest(`${modelId}-review`)
      },
      toolNames: ["tinyrustlm-slm-pack", "tinyrustlm-eval"],
      toolVersions: ["content-hash-bound", "content-hash-bound"],
      toolBinaryHashes: [digest("slm-pack"), evaluatorSha256],
      configurationHash: digest(`${modelId}-qualification`),
      publicSafeParameters: {
        modelId,
        qualityClaim: "conversation-proven",
        casesPassed: 14,
        expectedCaseCount: 14
      }
    })).receipt;
    const modelProofs = [];
    for (const laneId of ["seed-a", "seed-b"]) {
      const proof = store.putReceipt(receipt(`${modelId}-${laneId}-proof`, {
        receiptType: "tinyrustlm.p2p-outside-proof-v1",
        phase: "p2p-outside-complete-transfer-proof",
        inputReceiptIds: [qualification.receiptId],
        inputHashes: { model: artifactSha256 },
        outputHashes: { artifact: artifactSha256, pieceSet: pieceSetSha256 },
        configurationHash: digest(`${modelId}-${laneId}-proof`),
        publicSafeParameters: {
          modelId,
          artifactSha256,
          pieceSetSha256,
          fleetId: "production-fleet",
          laneId,
          publicBaseUrl: `https://${laneId}.example.net/models/${index}/`,
          externalReceiptVersion: 1,
          expiresAtUtc: "2099-07-15T08:50:00.000Z",
          publicReachabilityProven: true,
          observerSignatureVerified: true,
          completeTransferVerified: true,
          downloadedPieceCount: 2,
          downloadedArtifactByteCount: 1_500_000,
          checkedRouteCount: 5
        },
        evidenceClass: "outside-network",
        attestationReference: `sha256:${digest(`${modelId}-${laneId}-observer-receipt`)}`
      })).receipt;
      proofs.push(proof);
      modelProofs.push(proof);
    }
    const parameters = {
      modelId,
      artifactSha256,
      pieceSetSha256,
      fleetId: "production-fleet",
      laneIds: modelProofs.map((proof) => proof.publicSafeParameters.laneId),
      catalogUrl: "https://minimodel.org/catalog/models.v0.json",
      catalogSha256,
      announcementFeedUrl:
        "https://minimodel.org/catalog/peer-source-announcements.v0.json",
      announcementFeedSha256: feedSha256,
      publicHttpsReadback: true,
      active: true,
      matchedAnnouncementCount: 2,
      projectServerServesModelBytes: false,
      projectServerRunsModelBytes: false,
      projectServerProxiesModelBytes: false
    };
    if (mutateAnnouncement) mutateAnnouncement(parameters, index);
    store.putReceipt(receipt(`${modelId}-announcement`, {
      receiptType: "tinyrustlm.catalog-announcement-v1",
      phase: "catalog-announcement-public-readback",
      inputReceiptIds: modelProofs.map((proof) => proof.receiptId),
      inputHashes: { artifact: artifactSha256, pieceSet: pieceSetSha256 },
      outputHashes: {
        catalogReadback: parameters.catalogSha256,
        feedReadback: parameters.announcementFeedSha256
      },
      configurationHash: digest(`${modelId}-announcement`),
      publicSafeParameters: parameters,
      evidenceClass: "deployment",
      attestationReference: `sha256:${parameters.announcementFeedSha256}`
    }));
  }
  return proofs;
}

function setup(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-public-readback-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, store: new CampaignEvidenceStore(root) };
}

test("aggregates one common live catalog snapshot across 20 models and 40 proofs", (context) => {
  const { root, store } = setup(context);
  populateCompleteReadback(store);
  const result = persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: root,
    sourceRevision
  });
  assert.equal(result.receiptType, publicReadbackReceiptType);
  assert.equal(result.status, "pass");
  assert.equal(result.evidenceClass, "deployment");
  assert.equal(result.inputReceiptIds.length, 20);
  assert.equal(result.publicSafeParameters.activeModelCount, 20);
  assert.equal(result.publicSafeParameters.externalLaneProofCount, 40);
  assert.equal(result.publicSafeParameters.catalogSha256, catalogSha256);
  assert.equal(result.publicSafeParameters.announcementFeedSha256, feedSha256);
  assert.equal(result.publicSafeParameters.finalReleaseReadbackPassed, true);
  const dashboard = buildCampaignDashboard({ campaignId, evidenceRoot: root });
  assert.equal(dashboard.releaseGates.publicHttpsReadback.passed, true);
  assert.equal(persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: root,
    sourceRevision
  }).receiptId, result.receiptId);
});

test("blocks aggregation when the public readbacks do not share exact bytes", (context) => {
  const { root, store } = setup(context);
  populateCompleteReadback(store, (parameters, index) => {
    if (index === 19) parameters.announcementFeedSha256 = digest("different-feed");
  });
  const result = persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: root,
    sourceRevision
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.evidenceClass, "local");
  assert.equal(result.publicSafeParameters.publicHttpsReadback, false);
  assert.ok(result.boundedDiagnostics.reasons.includes("catalog_readback_snapshot_not_common"));
});

test("an expired or superseded lane proof invalidates and supersedes an earlier pass", (context) => {
  const { root, store } = setup(context);
  const proofs = populateCompleteReadback(store);
  const accepted = persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: root,
    sourceRevision
  });
  const oldProof = proofs[0];
  store.putReceipt(receipt("stale-outside-proof", {
    receiptType: "tinyrustlm.p2p-outside-proof-v1",
    phase: "p2p-outside-proof-expired",
    status: "stale",
    inputReceiptIds: oldProof.inputReceiptIds,
    inputHashes: oldProof.inputHashes,
    outputHashes: oldProof.outputHashes,
    publicSafeParameters: oldProof.publicSafeParameters,
    blockerCode: "outside_proof_expired",
    evidenceClass: "outside-network",
    supersedesReceiptIds: [oldProof.receiptId],
    configurationHash: digest("stale-outside-proof")
  }));
  const blocked = persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: root,
    sourceRevision
  });
  assert.equal(blocked.status, "blocked");
  assert.deepEqual(blocked.supersedesReceiptIds, [accepted.receiptId]);
  const aggregateHistory = new CampaignEvidenceStore(root).listReceipts((item) =>
    item.receiptType === publicReadbackReceiptType);
  assert.deepEqual(currentReceipts(aggregateHistory).map((item) => item.receiptId),
    [blocked.receiptId]);
});

test("rejects obsolete caller truth inputs", (context) => {
  const { root } = setup(context);
  assert.throws(() => persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: root,
    sourceRevision,
    publicHttpsReadback: true
  }), /unknown public release readback option/i);
});
