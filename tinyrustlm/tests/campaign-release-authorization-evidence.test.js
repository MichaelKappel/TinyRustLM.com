"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { canonicalJson } = require("../tools/campaign-evidence-store.js");
const { buildFinalAttestationDocument } = require("../tools/campaign-final-attestation.js");
const {
  authorityRegistrySchema,
  authorizationEnvelopeSchema,
  authorizationVerificationSchema,
  recordReleaseAuthorizationVerification,
  verifyReleaseAuthorization
} = require("../tools/campaign-release-authorization-evidence.js");

const campaignId = "release-authorization-test-20260716";
const sourceRevision = "b".repeat(40);
const nowUtc = "2026-07-16T04:00:00.000Z";
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

function finalizedDashboard(body) {
  return { ...body, dashboardContentSha256: digest(canonicalJson(body)) };
}

function completeDashboard() {
  const progress = (completed, required) => ({ completed, required, complete: true });
  return finalizedDashboard({
    schema: "tinyrustlm.dogfood_campaign_dashboard.v9",
    campaignId,
    generatedAtUtc: nowUtc,
    status: "incomplete",
    lifecycle: {},
    progress: {
      qualifiedModels: progress(20, 20),
      cleanBrowserRounds: progress(50, 50),
      liveMemoryRounds: progress(25, 25),
      externallyProvenLanes: progress(40, 40),
      catalogAnnouncements: progress(20, 20),
      nativeRidGates: progress(3, 3),
      faultInjectionCases: progress(24, 24)
    },
    currentOperation: { state: "idle" },
    timing: {},
    activeBlockers: ["final_attestation_incomplete"],
    rejectedModels: [],
    retryQueues: {},
    evidenceValidation: { health: "healthy", graphValidated: true },
    diskUsage: {},
    proofExpiryWarnings: [],
    proofExpiryWarningSeconds: 86400,
    releaseGates: {
      browserAcceptance: { passed: true },
      nativeRids: { passed: true, physicalLinuxArm64Verified: true },
      packages: { passed: true },
      packagedPublicSite: { passed: true },
      publicHttpsReadback: { passed: true },
      secretScan: { passed: true },
      faultInjection: { passed: true, satisfiedFaultCount: 24, plannedFaultCount: 24 },
      finalAttestation: { passed: false }
    },
    modelPortfolio: {},
    qualifiedModelIds: Array.from({ length: 20 }, (_, index) => `model-${index}`),
    completedRoundNumbers: Array.from({ length: 50 }, (_, index) => index + 1),
    resumable: true
  });
}

function riskRegister() {
  return {
    schema: "tinyrustlm.campaign_remaining_risks.v1",
    campaignId,
    updatedAtUtc: "2026-07-16T02:00:00.000Z",
    risks: [{
      riskId: "accepted-low-risk",
      category: "release",
      severity: "low",
      status: "accepted",
      summary: "A bounded low residual risk remains.",
      mitigation: "Retain the declared operational control.",
      acceptanceCondition: "The release owner explicitly accepts this bounded risk.",
      blockerCodes: [],
      evidenceReferences: ["risk-review"]
    }]
  };
}

function unsignedAttestation() {
  const risks = riskRegister();
  return buildFinalAttestationDocument({
    dashboard: completeDashboard(),
    receipts: [],
    riskRegister: risks,
    riskRegisterSha256: digest(`${JSON.stringify(risks, null, 2)}\n`),
    signatureReceipt: null,
    sourceRevision
  });
}

function signedMaterial() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyBytes = publicKey.export({ format: "der", type: "spki" });
  const authorityRegistry = {
    schema: authorityRegistrySchema,
    campaignId,
    registryId: "release-authorities-20260716",
    validFromUtc: "2026-07-16T03:00:00.000Z",
    validUntilUtc: "2026-07-17T03:00:00.000Z",
    authorities: [{
      authorityId: "release-owner",
      keyId: "release-key-20260716",
      algorithm: "ed25519",
      publicKeySpkiBase64: publicKeyBytes.toString("base64"),
      publicKeySpkiSha256: digest(publicKeyBytes),
      role: "release-authorizer",
      status: "active"
    }]
  };
  const attestation = unsignedAttestation();
  const payload = {
    schema: authorizationEnvelopeSchema,
    campaignId,
    sourceRevision,
    predicateSha256: attestation.predicateSha256,
    decision: "authorize-release",
    authorityId: "release-owner",
    keyId: "release-key-20260716",
    issuedAtUtc: "2026-07-16T03:30:00.000Z",
    expiresAtUtc: "2026-07-16T05:30:00.000Z",
    nonce: "release-authorization-nonce-0001"
  };
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload), "utf8"), privateKey);
  const authorizationEnvelope = {
    ...payload,
    signature: { algorithm: "ed25519", valueBase64: signature.toString("base64") }
  };
  return { attestation, authorityRegistry, authorizationEnvelope };
}

function verificationInput(material) {
  const attestationBytes = Buffer.from(`${JSON.stringify(material.attestation, null, 2)}\n`);
  const registryBytes = Buffer.from(`${JSON.stringify(material.authorityRegistry, null, 2)}\n`);
  const envelopeBytes = Buffer.from(`${JSON.stringify(material.authorizationEnvelope, null, 2)}\n`);
  return {
    attestation: material.attestation,
    attestationFileSha256: digest(attestationBytes),
    authorityRegistry: material.authorityRegistry,
    authorityRegistrySha256: digest(registryBytes),
    authorizationEnvelope: material.authorizationEnvelope,
    authorizationEnvelopeSha256: digest(envelopeBytes),
    campaignId,
    nowUtc,
    sourceRevision
  };
}

test("verifies an authorized Ed25519 release envelope over the exact predicate", () => {
  const material = signedMaterial();
  const result = verifyReleaseAuthorization(verificationInput(material));
  assert.equal(result.schema, authorizationVerificationSchema);
  assert.equal(result.predicateSha256, material.attestation.predicateSha256);
  assert.equal(result.signingAuthorityId, "release-owner");
  assert.equal(result.signingKeyId, "release-key-20260716");
  assert.equal(result.signatureVerified, true);
  assert.equal(result.authorizedRelease, true);
});

test("rejects signature tampering, revoked keys, and unknown envelope fields", () => {
  const material = signedMaterial();
  const tampered = structuredClone(material);
  const signature = Buffer.from(tampered.authorizationEnvelope.signature.valueBase64, "base64");
  signature[0] ^= 0xff;
  tampered.authorizationEnvelope.signature.valueBase64 = signature.toString("base64");
  assert.throws(() => verifyReleaseAuthorization(verificationInput(tampered)),
    /Ed25519 signature is invalid/i);

  const revoked = structuredClone(material);
  revoked.authorityRegistry.authorities[0].status = "revoked";
  assert.throws(() => verifyReleaseAuthorization(verificationInput(revoked)),
    /absent or revoked/i);

  const unknown = structuredClone(material);
  unknown.authorizationEnvelope.operatorOverride = true;
  assert.throws(() => verifyReleaseAuthorization(verificationInput(unknown)),
    /unknown field operatorOverride/i);
});

test("records one content-addressed deployment verification receipt", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-release-authorization-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const material = signedMaterial();
  const attestationPath = path.join(root, "final-attestation.json");
  const authorityRegistryPath = path.join(root, "release-authorities.json");
  const authorizationEnvelopePath = path.join(root, "release-authorization.json");
  fs.writeFileSync(attestationPath, `${JSON.stringify(material.attestation, null, 2)}\n`);
  fs.writeFileSync(authorityRegistryPath, `${JSON.stringify(material.authorityRegistry, null, 2)}\n`);
  fs.writeFileSync(authorizationEnvelopePath,
    `${JSON.stringify(material.authorizationEnvelope, null, 2)}\n`);
  const options = {
    campaignId,
    evidenceRoot: path.join(root, "evidence"),
    attestationPath,
    authorityRegistryPath,
    authorizationEnvelopePath,
    sourceRevision,
    nowUtc
  };
  const first = recordReleaseAuthorizationVerification(options);
  const repeated = recordReleaseAuthorizationVerification(options);
  assert.equal(first.receipt.receiptId, repeated.receipt.receiptId);
  assert.equal(first.receipt.evidenceClass, "deployment");
  assert.equal(first.receipt.hardwareEvidence.cryptographicSignatureVerification, true);
  assert.equal(first.receipt.inputHashes.releasePredicate, material.attestation.predicateSha256);
  assert.equal(first.receipt.attestationReference,
    `sha256:${first.result.authorizationEnvelopeSha256}`);
});
