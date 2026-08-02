"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { persistCatalogAnnouncementEvidence } = require(
  "../tools/catalog-announcement-evidence.js");
const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");

const campaignId = "catalog-readback-test-20260715";
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const artifactSha256 = digest("model");
const pieceSetSha256 = digest("piece-set");

function baseReceipt(label, overrides = {}) {
  return {
    receiptType: `tinyrustlm.${label}`,
    campaignId,
    phase: label,
    attempt: 1,
    status: "pass",
    createdAtUtc: "2026-07-15T07:00:00.000Z",
    completedAtUtc: "2026-07-15T07:01:00.000Z",
    inputReceiptIds: [],
    inputHashes: { input: digest(`${label}-input`) },
    outputHashes: { output: digest(`${label}-output`) },
    sourceRevision: "a".repeat(40),
    toolNames: ["fixture-tool"],
    toolVersions: ["1"],
    toolBinaryHashes: [digest("fixture-tool")],
    runtimeIdentifier: "win-x64",
    operatingSystem: "win32",
    architecture: "x64",
    hardwareEvidence: { fixture: true },
    configurationHash: digest(`${label}-configuration`),
    publicSafeParameters: {},
    boundedDiagnostics: {},
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "fixture",
    supersedesReceiptIds: [],
    attestationReference: null,
    ...overrides
  };
}

function putQualification(store) {
  return store.putReceipt(baseReceipt("model-qualification", {
    receiptType: "tinyrustlm.model-qualification",
    phase: "model-qualification",
    evidenceClass: "local",
    outputHashes: {
      evaluation: digest("evaluation"),
      manifest: digest("manifest"),
      model: artifactSha256,
      review: digest("review")
    },
    publicSafeParameters: {
      modelId: "tinyrustlm/model-a",
      qualityClaim: "conversation-proven"
    }
  })).receipt;
}

function putProof(store, qualification, laneId) {
  const suffix = laneId === "seed-a" ? "a" : "b";
  return store.putReceipt(baseReceipt(`outside-proof-${suffix}`, {
    receiptType: "tinyrustlm.p2p-outside-proof-v1",
    phase: "p2p-outside-complete-transfer-proof",
    inputReceiptIds: [qualification.receiptId],
    inputHashes: {
      fleetConfiguration: digest("fleet"),
      model: artifactSha256,
      observerTrust: digest(`trust-${suffix}`),
      signedExternalReceipt: digest(`signed-receipt-${suffix}`)
    },
    outputHashes: {
      artifact: artifactSha256,
      pieceSet: pieceSetSha256,
      rustInspection: digest(`rust-${suffix}`),
      signaturePayload: digest(`payload-${suffix}`)
    },
    publicSafeParameters: {
      modelId: "tinyrustlm/model-a",
      artifactSha256,
      pieceSetSha256,
      fleetId: "production-fleet",
      laneId,
      publicBaseUrl: `https://seed-${suffix}.example.net/models/a/`,
      externalReceiptId: `external-receipt-${suffix}`,
      externalReceiptVersion: 1,
      checkedAtUtc: "2026-07-15T07:30:00.000Z",
      expiresAtUtc: "2026-07-15T08:30:00.000Z",
      downloadedPieceCount: 2,
      downloadedArtifactByteCount: 1500000,
      checkedRouteCount: 5,
      publicReachabilityProven: true,
      observerSignatureVerified: true,
      completeTransferVerified: true
    }
  })).receipt;
}

function announcementFor(proof) {
  const parameters = proof.publicSafeParameters;
  return {
    announcement_kind: "minimodel.peer_source_announcement",
    announcement_version: 1,
    model_id: parameters.modelId,
    artifact_sha256: `sha256:${parameters.artifactSha256}`,
    peer_source: { peer_base_url: parameters.publicBaseUrl },
    external_reachability: {
      proof_kind: "minimodel.external_reachability_proof",
      proof_version: 1,
      complete_transfer_verified: true,
      receipt_id: parameters.externalReceiptId,
      receipt_sha256: `sha256:${proof.inputHashes.signedExternalReceipt}`,
      fleet_id: parameters.fleetId,
      lane_id: parameters.laneId,
      model_id: parameters.modelId,
      public_base_url: parameters.publicBaseUrl,
      expires_utc: parameters.expiresAtUtc
    }
  };
}

function response(bytes) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-length" ? String(bytes.length) : null },
    arrayBuffer: async () => bytes
  };
}

function setupFixture(context, mutation = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-catalog-readback-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const qualification = putQualification(store);
  const proofs = [putProof(store, qualification, "seed-a"), putProof(store, qualification, "seed-b")];
  const feed = {
    announcement_catalog_kind: "minimodel.peer_source_announcement_catalog",
    announcement_catalog_version: 0,
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements: proofs.map(announcementFor)
  };
  if (mutation) mutation({ proofs, feed });
  const feedBytes = Buffer.from(JSON.stringify(feed));
  const catalog = {
    catalog_kind: "minimodel.model_catalog",
    catalog_version: 0,
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    entries: [{
      entry_kind: "minimodel.catalog_entry",
      model_id: "tinyrustlm/model-a",
      artifact_kind: "slm",
      artifact_byte_count: 1500000,
      artifact_sha256: `sha256:${artifactSha256}`,
      artifact_project_server_url: null,
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false
    }],
    peer_source_announcement_routes: [{
      route: "peer-source-announcements.v0.json",
      route_kind: "minimodel.peer_source_announcement_catalog",
      sha256: `sha256:${sha256(feedBytes)}`
    }]
  };
  const catalogBytes = Buffer.from(JSON.stringify(catalog));
  const bodies = new Map([
    ["https://minimodel.org/catalog/models.v0.json", catalogBytes],
    ["https://minimodel.org/catalog/peer-source-announcements.v0.json", feedBytes]
  ]);
  return {
    root,
    proofs,
    feed,
    catalog,
    options: {
      evidenceRoot: root,
      campaignId,
      proofReceiptIds: proofs.map((proof) => proof.receiptId),
      catalogUrl: "https://minimodel.org/catalog/models.v0.json",
      readbackUtc: "2026-07-15T08:00:00.000Z",
      evidenceClass: "fixture",
      fetchImpl: async (url) => {
        const bytes = bodies.get(url);
        return bytes ? response(bytes) : { ok: false, status: 404 };
      },
      fixtureMiniModelSha256: digest("minimodel"),
      fixtureRustValidator: () => ({
        catalogPass: true,
        feedPass: true,
        catalogOutputSha256: digest("catalog-output"),
        feedOutputSha256: digest("feed-output")
      })
    }
  };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("binds fixture catalog readback to two full-transfer lane proofs", async (context) => {
  const setup = setupFixture(context);
  const receipt = await persistCatalogAnnouncementEvidence(setup.options);
  assert.equal(receipt.receiptType, "tinyrustlm.catalog-announcement-v1");
  assert.equal(receipt.evidenceClass, "fixture");
  assert.equal(receipt.publicSafeParameters.matchedAnnouncementCount, 2);
  assert.equal(receipt.publicSafeParameters.publicHttpsReadback, false);
  assert.deepEqual(receipt.inputReceiptIds, setup.proofs.map((proof) => proof.receiptId).sort());
  assert.equal((await persistCatalogAnnouncementEvidence(setup.options)).receiptId, receipt.receiptId);
});

test("rejects duplicate lane proof parents", async (context) => {
  const setup = setupFixture(context);
  await assert.rejects(() => persistCatalogAnnouncementEvidence({
    ...setup.options,
    proofReceiptIds: [setup.proofs[0].receiptId, setup.proofs[0].receiptId]
  }), /exactly two proof parents/i);
});

test("rejects a feed row that does not bind the signed observer receipt", async (context) => {
  const setup = setupFixture(context, ({ feed }) => {
    feed.announcements[1].external_reachability.receipt_sha256 = `sha256:${digest("wrong")}`;
  });
  await assert.rejects(() => persistCatalogAnnouncementEvidence(setup.options),
    /exactly one row for lane seed-b/i);
});

test("rejects expired proof parents before public reads", async (context) => {
  const setup = setupFixture(context);
  await assert.rejects(() => persistCatalogAnnouncementEvidence({
    ...setup.options,
    readbackUtc: "2026-07-15T09:00:00.000Z"
  }), /expired/i);
});

test("never lets injected fetch or validation create deployment evidence", async (context) => {
  const setup = setupFixture(context);
  await assert.rejects(() => persistCatalogAnnouncementEvidence({
    ...setup.options,
    evidenceClass: "deployment"
  }), /proof evidence class is invalid|injected fetch/i);
});
