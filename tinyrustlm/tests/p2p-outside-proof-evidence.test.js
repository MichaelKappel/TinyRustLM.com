"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  completeReceiptType,
  parseExternalReceipt,
  persistOutsideProofEvidence,
  sampledReceiptType
} = require("../tools/p2p-outside-proof-evidence.js");

const campaignId = "outside-proof-test-20260715";
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const artifactSha256 = digest("qualified-model");
const pieceSetSha256 = digest("piece-set");

function putQualification(store, modelHash = artifactSha256) {
  return store.putReceipt({
    receiptType: "tinyrustlm.model-qualification",
    campaignId,
    phase: "model-qualification",
    attempt: 1,
    status: "pass",
    createdAtUtc: "2026-07-15T06:00:00.000Z",
    completedAtUtc: "2026-07-15T06:01:00.000Z",
    inputReceiptIds: [],
    inputHashes: { configuration: digest("qualification-input") },
    outputHashes: {
      evaluation: digest("evaluation"),
      manifest: digest("manifest"),
      model: modelHash,
      review: digest("review")
    },
    sourceRevision: "a".repeat(40),
    toolNames: ["tinyrustlm-eval"],
    toolVersions: ["1"],
    toolBinaryHashes: [digest("evaluator")],
    runtimeIdentifier: "win-x64",
    operatingSystem: "win32",
    architecture: "x64",
    hardwareEvidence: { nativeExecution: true },
    configurationHash: digest("qualification-configuration"),
    publicSafeParameters: {
      modelId: "tinyrustlm/model-a",
      qualityClaim: "conversation-proven"
    },
    boundedDiagnostics: {},
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: null
  }).receipt;
}

function externalReceipt(version = 1, overrides = {}) {
  const routes = [
    {
      route: "minimodel.peer_status.v0.json",
      http_status: 200,
      body_byte_count: 32,
      body_sha256: `sha256:${digest("status")}`
    },
    {
      route: "minimodel.peer_companion_state.v0.json",
      http_status: 200,
      body_byte_count: 512,
      body_sha256: `sha256:${digest("state")}`
    },
    {
      route: "minimodel.peer_piece_set.v0",
      http_status: 200,
      body_byte_count: 1024,
      body_sha256: `sha256:${pieceSetSha256}`
    },
    {
      route: "piece-00000000.bin",
      http_status: 200,
      body_byte_count: 1048576,
      body_sha256: `sha256:${digest("piece-0")}`
    }
  ];
  if (version === 1) {
    routes.push({
      route: "piece-00000001.bin",
      http_status: 200,
      body_byte_count: 451424,
      body_sha256: `sha256:${digest("piece-1")}`
    });
  }
  return {
    receipt_kind: "minimodel.external_reachability_receipt",
    receipt_version: version,
    receipt_id: `observer-receipt-v${version}`,
    observer_id: "independent-observer",
    observer_key_id: `observer-key-v${version}`,
    fleet_id: "production-fleet",
    lane_id: "seed-a",
    model_id: "tinyrustlm/model-a",
    public_base_url: "https://seed.example.net/models/a/",
    artifact_sha256: `sha256:${artifactSha256}`,
    piece_set_sha256: `sha256:${pieceSetSha256}`,
    checked_utc: "2026-07-15T07:50:00.000Z",
    expires_utc: "2026-07-15T08:50:00.000Z",
    probe_implementation_version: `observer-v${version}`,
    network_scope: "outside-host-and-local-network",
    ...(version === 1 ? {
      transfer_scope: "complete-artifact-piece-set",
      downloaded_piece_count: 2,
      downloaded_artifact_byte_count: 1500000,
      downloaded_artifact_sha256: `sha256:${artifactSha256}`
    } : {}),
    checked_routes: routes,
    signature: {
      kind: "ed25519",
      payload_sha256: `sha256:${digest(`payload-v${version}`)}`,
      value: `ed25519-base64:${Buffer.alloc(64, version + 1).toString("base64")}`
    },
    ...overrides
  };
}

function verifierOutput(receipt) {
  const lines = [
    "MiniModel external probe receipt inspection: PASS",
    `receipt_version: ${receipt.receipt_version}`,
    `receipt_id: ${receipt.receipt_id}`,
    `observer_id: ${receipt.observer_id}`,
    `fleet_id: ${receipt.fleet_id}`,
    `lane_id: ${receipt.lane_id}`,
    `model_id: ${receipt.model_id}`,
    `public_base_url: ${receipt.public_base_url}`,
    `checked_utc: ${receipt.checked_utc}`,
    `expires_utc: ${receipt.expires_utc}`,
    `complete_transfer_verified: ${receipt.receipt_version === 1}`
  ];
  if (receipt.receipt_version === 1) {
    lines.push(`downloaded_piece_count: ${receipt.downloaded_piece_count}`);
    lines.push(`downloaded_artifact_byte_count: ${receipt.downloaded_artifact_byte_count}`);
    lines.push(`downloaded_artifact_sha256: ${receipt.downloaded_artifact_sha256}`);
  }
  lines.push("externally_reachable: true", "announcement_eligible: true");
  return `${lines.join("\n")}\n`;
}

function fixture(context, version = 1, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-outside-proof-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const receipt = externalReceipt(version, overrides);
  const receiptPath = path.join(root, "external-receipt.json");
  const trustPath = path.join(root, "observer-trust.json");
  const fleetConfigPath = path.join(root, "fleet.json");
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  fs.writeFileSync(trustPath, JSON.stringify({ trust: true }));
  fs.writeFileSync(fleetConfigPath, JSON.stringify({ fleet: true }));
  const qualification = putQualification(new CampaignEvidenceStore(root));
  return {
    root,
    receipt,
    qualification,
    options: {
      evidenceRoot: root,
      campaignId,
      qualificationReceiptId: qualification.receiptId,
      receiptPath,
      trustPath,
      fleetConfigPath,
      inspectedAtUtc: "2026-07-15T08:00:00.000Z",
      evidenceClass: "fixture",
      fixtureMiniModelSha256: digest("fixture-minimodel"),
      fixtureVerifier: () => verifierOutput(receipt)
    }
  };
}

test("persists complete-transfer fixture evidence without making it live", (context) => {
  const setup = fixture(context, 1);
  const receipt = persistOutsideProofEvidence(setup.options);
  assert.equal(receipt.receiptType, completeReceiptType);
  assert.equal(receipt.evidenceClass, "fixture");
  assert.equal(receipt.publicSafeParameters.completeTransferVerified, true);
  assert.equal(receipt.publicSafeParameters.downloadedPieceCount, 2);
  assert.equal(receipt.publicSafeParameters.checkedRouteCount, 5);
  assert.deepEqual(receipt.inputReceiptIds, [setup.qualification.receiptId]);
  assert.equal(persistOutsideProofEvidence(setup.options).receiptId, receipt.receiptId);
});

test("keeps signed sampled reachability distinct from complete transfer", (context) => {
  const setup = fixture(context, 0);
  const receipt = persistOutsideProofEvidence(setup.options);
  assert.equal(receipt.receiptType, sampledReceiptType);
  assert.equal(receipt.publicSafeParameters.completeTransferVerified, false);
  assert.equal(receipt.publicSafeParameters.checkedRouteCount, 4);
  assert.equal(receipt.publicSafeParameters.downloadedPieceCount, null);
});

test("rejects local URLs even when fixture verifier claims outside scope", () => {
  const receipt = externalReceipt(1, {
    public_base_url: "http://127.0.0.1:18571/models/a/"
  });
  assert.throws(() => parseExternalReceipt(
    Buffer.from(JSON.stringify(receipt)), "2026-07-15T08:00:00.000Z"
  ), /local or reserved IPv4/i);
});

test("rejects incomplete complete-transfer route evidence", () => {
  const receipt = externalReceipt(1);
  receipt.checked_routes.pop();
  assert.throws(() => parseExternalReceipt(
    Buffer.from(JSON.stringify(receipt)), "2026-07-15T08:00:00.000Z"
  ), /include every downloaded piece route/i);
});

test("never permits an injected verifier to create outside-network evidence", (context) => {
  const setup = fixture(context, 1);
  assert.throws(() => persistOutsideProofEvidence({
    ...setup.options,
    evidenceClass: "outside-network"
  }), /injected verifier may only create fixture evidence/i);
});

test("requires exact qualification artifact identity", (context) => {
  const setup = fixture(context, 1);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-outside-mismatch-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.copyFileSync(setup.options.receiptPath, path.join(root, "receipt.json"));
  fs.copyFileSync(setup.options.trustPath, path.join(root, "trust.json"));
  fs.copyFileSync(setup.options.fleetConfigPath, path.join(root, "fleet.json"));
  const qualification = putQualification(new CampaignEvidenceStore(root), digest("wrong-model"));
  assert.throws(() => persistOutsideProofEvidence({
    ...setup.options,
    evidenceRoot: root,
    qualificationReceiptId: qualification.receiptId,
    receiptPath: path.join(root, "receipt.json"),
    trustPath: path.join(root, "trust.json"),
    fleetConfigPath: path.join(root, "fleet.json")
  }), /artifact does not match model qualification/i);
});
