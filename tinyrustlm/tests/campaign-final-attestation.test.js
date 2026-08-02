"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  CampaignEvidenceStore,
  canonicalJson,
  finalizedReceipt
} = require("../tools/campaign-evidence-store.js");
const { buildCampaignDashboard } = require("../tools/campaign-evidence-dashboard.js");
const {
  buildFinalAttestationDocument,
  finalAttestationSchema,
  recordCampaignFinalAttestation,
  validateFinalAttestation,
  validateRiskRegister
} = require("../tools/campaign-final-attestation.js");

const campaignId = "final-attestation-test-20260716";
const sourceRevision = "a".repeat(40);
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

function receipt(label, overrides = {}) {
  return {
    receiptType: `tinyrustlm.${label}`,
    campaignId,
    phase: label,
    attempt: 1,
    status: "pass",
    createdAtUtc: "2026-07-16T01:00:00.000Z",
    completedAtUtc: "2026-07-16T01:01:00.000Z",
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

function riskRegister(overrides = {}) {
  return {
    schema: "tinyrustlm.campaign_remaining_risks.v1",
    campaignId,
    updatedAtUtc: "2026-07-16T02:00:00.000Z",
    risks: [{
      riskId: "external-gates-open",
      category: "release",
      severity: "release-blocking",
      status: "open",
      summary: "External release gates remain incomplete.",
      mitigation: "Collect the declared external evidence.",
      acceptanceCondition: "Every external release gate passes.",
      blockerCodes: ["qualified_models_incomplete"],
      evidenceReferences: ["campaign-dashboard"]
    }],
    ...overrides
  };
}

function writeRiskRegister(root, value = riskRegister()) {
  const target = path.join(root, "remaining-risks.json");
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function finalizedDashboard(body) {
  return {
    ...body,
    dashboardContentSha256: digest(canonicalJson(body))
  };
}

function prerequisiteDashboard() {
  const complete = (completed, required) => ({ completed, required, complete: true });
  return finalizedDashboard({
    schema: "tinyrustlm.dogfood_campaign_dashboard.v9",
    campaignId,
    generatedAtUtc: "2026-07-16T02:00:00.000Z",
    status: "incomplete",
    lifecycle: { schema: "tinyrustlm.campaign_lifecycle.v1" },
    progress: {
      qualifiedModels: complete(20, 20),
      cleanBrowserRounds: complete(50, 50),
      liveMemoryRounds: complete(25, 25),
      externallyProvenLanes: complete(40, 40),
      catalogAnnouncements: complete(20, 20),
      nativeRidGates: complete(3, 3),
      faultInjectionCases: complete(24, 24)
    },
    currentOperation: { state: "idle" },
    timing: { campaignStartedAtUtc: "2026-07-15T00:00:00.000Z" },
    activeBlockers: ["final_attestation_incomplete"],
    rejectedModels: [],
    retryQueues: {},
    evidenceValidation: { health: "healthy", graphValidated: true },
    diskUsage: {},
    proofExpiryWarnings: [],
    proofExpiryWarningSeconds: 86400,
    releaseGates: {
      browserAcceptance: { passed: true, receiptId: null },
      nativeRids: { passed: true, receiptId: null },
      packages: { passed: true, receiptId: null },
      packagedPublicSite: { passed: true, receiptId: null },
      publicHttpsReadback: { passed: true, receiptId: null },
      secretScan: { passed: true, receiptId: null },
      faultInjection: { passed: true, receiptId: null },
      finalAttestation: { passed: false, receiptId: null }
    },
    modelPortfolio: {},
    qualifiedModelIds: Array.from({ length: 20 }, (_, index) => `model-${index}`),
    completedRoundNumbers: Array.from({ length: 50 }, (_, index) => index + 1),
    resumable: true
  });
}

test("records a deterministic incomplete attestation from rebuilt campaign evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-final-attestation-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evidenceRoot = path.join(root, "evidence");
  const store = new CampaignEvidenceStore(evidenceRoot);
  const blocked = store.putReceipt(receipt("blocked-source", {
    status: "blocked",
    blockerCode: "source_contract_absent"
  })).receipt;
  store.putReceipt(receipt("rejected-source", {
    status: "rejected",
    supersedesReceiptIds: [blocked.receiptId]
  }));
  const outputPath = path.join(root, "final-attestation.json");
  const options = {
    campaignId,
    evidenceRoot,
    outputPath,
    remainingRisksPath: writeRiskRegister(root),
    sourceRevision
  };

  const first = recordCampaignFinalAttestation(options);
  assert.equal(first.attestation.schema, finalAttestationSchema);
  assert.equal(first.attestation.status, "incomplete");
  assert.equal(first.attestation.claim, "pre-release-incomplete");
  assert.equal(first.attestation.authentication.signatureVerified, false);
  assert.equal(first.attestation.campaignDecision.campaignPrerequisitesPassed, false);
  assert.ok(first.attestation.campaignDecision.blockers.includes("qualified_models_incomplete"));
  assert.deepEqual(first.attestation.failures.map((item) => item.status).sort(),
    ["blocked", "rejected"]);
  assert.equal(first.attestation.supersessions.length, 1);
  assert.equal(first.receipt.status, "pass");
  assert.equal(first.receipt.publicSafeParameters.finalAcceptancePassed, false);
  assert.equal(fs.existsSync(first.snapshotPath), true);
  assert.equal(validateFinalAttestation(JSON.parse(fs.readFileSync(outputPath, "utf8"))), true);
  const rebuiltAfterReceipt = buildCampaignDashboard({
    campaignId,
    evidenceRoot,
    generatedAtUtc: first.dashboard.generatedAtUtc
  });
  assert.deepEqual(first.dashboard, rebuiltAfterReceipt);
  assert.equal(first.dashboard.releaseGates.finalAttestation.receiptId, first.receipt.receiptId);

  const repeated = recordCampaignFinalAttestation(options);
  assert.equal(repeated.attestation.attestationContentSha256,
    first.attestation.attestationContentSha256);
  assert.equal(repeated.receipt.receiptId, first.receipt.receiptId);
  assert.equal(repeated.snapshotPath, first.snapshotPath);
});

test("requires a verified authorized attestation receipt before a complete claim", () => {
  const dashboard = prerequisiteDashboard();
  const risks = riskRegister({
    risks: [{
      ...riskRegister().risks[0],
      severity: "low",
      status: "accepted",
      blockerCodes: []
    }]
  });
  const riskHash = digest(`${JSON.stringify(risks, null, 2)}\n`);
  const unsigned = buildFinalAttestationDocument({
    dashboard,
    receipts: [],
    riskRegister: risks,
    riskRegisterSha256: riskHash,
    signatureReceipt: null,
    sourceRevision
  });
  assert.equal(unsigned.status, "incomplete");
  assert.equal(unsigned.campaignDecision.campaignPrerequisitesPassed, true);
  assert.equal(unsigned.authentication.signatureVerified, false);

  const signature = finalizedReceipt(receipt("release-attestation-verification", {
    receiptType: "tinyrustlm.release-attestation-verification-v1",
    phase: "release-attestation-verification",
    evidenceClass: "deployment",
    createdAtUtc: "2026-07-16T01:30:00.000Z",
    completedAtUtc: "2026-07-16T01:31:00.000Z",
    inputHashes: {
      releasePredicate: unsigned.predicateSha256,
      authorizationEnvelope: digest("authorization-envelope"),
      authorityRegistry: digest("authority-registry"),
      signedPayload: digest("signed-payload"),
      authorityPublicKey: digest("authority-public-key")
    },
    outputHashes: {
      releasePredicate: unsigned.predicateSha256,
      verifiedAuthorizationEnvelope: digest("authorization-envelope"),
      verifiedSignedPayload: digest("signed-payload")
    },
    hardwareEvidence: {
      cryptographicSignatureVerification: true,
      signatureAlgorithm: "ed25519"
    },
    publicSafeParameters: {
      schema: "tinyrustlm.release_attestation_verification.v1",
      campaignId,
      sourceRevision,
      predicateSha256: unsigned.predicateSha256,
      authorizedRelease: true,
      signatureVerified: true,
      algorithm: "ed25519",
      decision: "authorize-release",
      signingAuthorityId: "authorized-release-signer",
      signingKeyId: "release-key-1",
      authorizationEnvelopeSha256: digest("authorization-envelope"),
      authorityRegistrySha256: digest("authority-registry"),
      signedPayloadSha256: digest("signed-payload"),
      publicKeySpkiSha256: digest("authority-public-key"),
      issuedAtUtc: "2026-07-16T01:30:00.000Z",
      expiresAtUtc: "2026-07-16T03:00:00.000Z"
    },
    attestationReference: `sha256:${digest("authorization-envelope")}`
  }));
  const signed = buildFinalAttestationDocument({
    dashboard,
    receipts: [],
    riskRegister: risks,
    riskRegisterSha256: riskHash,
    signatureReceipt: signature,
    sourceRevision
  });
  assert.equal(signed.status, "complete");
  assert.equal(signed.claim, "release-complete");
  assert.equal(signed.authentication.signatureVerified, true);
  assert.equal(signed.authentication.verificationReceiptId, signature.receiptId);
  assert.equal(validateFinalAttestation(signed), true);
});

test("binds the secret-scan gate and advances the evidence cutoff to its receipt", () => {
  const scan = finalizedReceipt(receipt("secret-scan", {
    receiptType: "tinyrustlm.secret-scan-v2",
    phase: "secret-scan",
    createdAtUtc: "2026-07-16T02:29:00.000Z",
    completedAtUtc: "2026-07-16T02:30:00.000Z"
  }));
  const initial = prerequisiteDashboard();
  const { dashboardContentSha256: _ignored, ...body } = initial;
  const dashboard = finalizedDashboard({
    ...body,
    releaseGates: {
      ...body.releaseGates,
      secretScan: { passed: true, receiptId: scan.receiptId }
    }
  });
  const risks = riskRegister();
  const attestation = buildFinalAttestationDocument({
    dashboard,
    receipts: [scan],
    riskRegister: risks,
    riskRegisterSha256: digest(`${JSON.stringify(risks, null, 2)}\n`),
    signatureReceipt: null,
    sourceRevision
  });

  assert.equal(attestation.generatedAtUtc, scan.completedAtUtc);
  assert.equal(attestation.campaignDecision.releaseGates.secretScan.receiptId, scan.receiptId);
  assert.equal(validateFinalAttestation(attestation), true);
});

test("rejects unknown risk fields and attestation tampering", () => {
  assert.throws(() => validateRiskRegister({
    ...riskRegister(),
    mutablePassed: true
  }, campaignId), /remaining-risk.*unknown field/i);

  const dashboard = prerequisiteDashboard();
  const risks = riskRegister();
  const attestation = buildFinalAttestationDocument({
    dashboard,
    receipts: [],
    riskRegister: risks,
    riskRegisterSha256: digest(`${JSON.stringify(risks, null, 2)}\n`),
    signatureReceipt: null,
    sourceRevision
  });
  const tampered = JSON.parse(JSON.stringify(attestation));
  tampered.campaignDecision.blockers.push("invented-pass");
  assert.throws(() => validateFinalAttestation(tampered), /(?:predicate|content) hash/i);
});

test("dashboard v9 accepts only an exactly bound deployment attestation receipt", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-final-gate-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const predicateSha256 = digest("release-predicate");
  const contentSha256 = digest("final-attestation-content");
  const envelopeSha256 = digest("authorization-envelope");
  const registrySha256 = digest("authority-registry");
  const signedPayloadSha256 = digest("signed-payload");
  const publicKeySpkiSha256 = digest("authority-public-key");
  const verification = store.putReceipt(receipt("release-attestation-verification", {
    receiptType: "tinyrustlm.release-attestation-verification-v1",
    phase: "release-attestation-verification",
    evidenceClass: "deployment",
    inputHashes: {
      releasePredicate: predicateSha256,
      authorizationEnvelope: envelopeSha256,
      authorityRegistry: registrySha256,
      signedPayload: signedPayloadSha256,
      authorityPublicKey: publicKeySpkiSha256
    },
    outputHashes: {
      releasePredicate: predicateSha256,
      verifiedAuthorizationEnvelope: envelopeSha256,
      verifiedSignedPayload: signedPayloadSha256
    },
    hardwareEvidence: {
      cryptographicSignatureVerification: true,
      signatureAlgorithm: "ed25519"
    },
    publicSafeParameters: {
      schema: "tinyrustlm.release_attestation_verification.v1",
      campaignId,
      sourceRevision,
      predicateSha256,
      signatureVerified: true,
      authorizedRelease: true,
      algorithm: "ed25519",
      decision: "authorize-release",
      signingAuthorityId: "authorized-release-signer",
      signingKeyId: "release-key-1",
      authorizationEnvelopeSha256: envelopeSha256,
      authorityRegistrySha256: registrySha256,
      signedPayloadSha256,
      publicKeySpkiSha256,
      expiresAtUtc: "2026-07-16T03:00:00.000Z"
    },
    attestationReference: `sha256:${envelopeSha256}`
  })).receipt;
  const accepted = store.putReceipt(receipt("final-release-attestation", {
    receiptType: "tinyrustlm.final-release-attestation-v1",
    phase: "final-release-attestation",
    evidenceClass: "deployment",
    inputReceiptIds: [verification.receiptId],
    inputHashes: {
      releasePredicate: predicateSha256,
      authorityRegistry: registrySha256
    },
    outputHashes: {
      finalAttestationContent: contentSha256,
      finalAttestationFile: digest("final-attestation-file")
    },
    publicSafeParameters: {
      schema: finalAttestationSchema,
      campaignPrerequisitesPassed: true,
      finalAcceptancePassed: true,
      signatureVerified: true,
      attestationContentSha256: contentSha256,
      predicateSha256,
      signatureVerificationReceiptId: verification.receiptId,
      signingAuthorityId: "authorized-release-signer",
      signingKeyId: "release-key-1",
      authorizationEnvelopeSha256: envelopeSha256,
      authorityRegistrySha256: registrySha256,
      signedPayloadSha256,
      publicKeySpkiSha256,
      authorizationExpiresAtUtc: "2026-07-16T03:00:00.000Z"
    },
    attestationReference: `sha256:${envelopeSha256}`
  })).receipt;
  const passing = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-16T02:00:00.000Z"
  });
  assert.equal(passing.releaseGates.finalAttestation.passed, true);
  assert.equal(passing.releaseGates.finalAttestation.receiptId, accepted.receiptId);
  assert.equal(passing.activeBlockers.includes("final_attestation_incomplete"), false);

  store.putReceipt(receipt("drifted-final-release-attestation", {
    receiptType: "tinyrustlm.final-release-attestation-v1",
    phase: "final-release-attestation",
    attempt: 2,
    evidenceClass: "deployment",
    inputReceiptIds: [verification.receiptId],
    inputHashes: {
      releasePredicate: predicateSha256,
      authorityRegistry: registrySha256
    },
    outputHashes: {
      finalAttestationContent: contentSha256,
      finalAttestationFile: digest("drifted-final-attestation-file")
    },
    publicSafeParameters: {
      schema: finalAttestationSchema,
      campaignPrerequisitesPassed: true,
      finalAcceptancePassed: true,
      signatureVerified: true,
      attestationContentSha256: contentSha256,
      predicateSha256: digest("different-predicate"),
      signatureVerificationReceiptId: verification.receiptId,
      signingAuthorityId: "authorized-release-signer",
      signingKeyId: "release-key-1",
      authorizationEnvelopeSha256: envelopeSha256,
      authorityRegistrySha256: registrySha256,
      signedPayloadSha256,
      publicKeySpkiSha256,
      authorizationExpiresAtUtc: "2026-07-16T03:00:00.000Z"
    },
    supersedesReceiptIds: [accepted.receiptId],
    attestationReference: `sha256:${envelopeSha256}`
  }));
  const rejected = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-16T02:00:00.000Z"
  });
  assert.equal(rejected.releaseGates.finalAttestation.passed, false);
  assert.ok(rejected.activeBlockers.includes("final_attestation_incomplete"));
});
