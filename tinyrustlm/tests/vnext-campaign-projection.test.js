"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  campaignProjectionProfile,
  campaignProjectionProfileSha256,
  finalizeVnextCampaignPlan,
  projectVnextCampaign,
  validateCampaignProjectionResultBytes
} = require("../tools/vnext-campaign-projection.js");
const {
  finalizeVnextIdentityDocument
} = require("../tools/vnext-content-identity.js");
const {
  finalizeVnextReceipt
} = require("../tools/vnext-receipt-identity.js");
const {
  finalizeVnextOfflineBundleManifest,
  verifyVnextOfflineBundle
} = require("../tools/vnext-offline-bundle.js");
const {
  parseStrictJson
} = require("../tools/strict-json.js");
const {
  canonicalizeVnextJcsBytes
} = require("../tools/vnext-jcs.js");
const {
  authorityKey,
  baseReceiptDraft,
  campaignId,
  hash,
  makeAuthorityRegistry,
  makeSignatureReceipt
} = require("./helpers/vnext-authority-fixtures.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-projection-profile.v1.json");
const signatureProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "receipt-signature-profile.v1.json");
const offlineProfilePath = path.join(repositoryRoot, "contracts", "vnext",
  "offline-verification-bundle-profile.v1.json");
const verificationTimeUtc = "2026-08-09T00:30:00Z";
const memoryContractId = `sha256:${hash("memory-contract-v1")}`;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function modelSlot(index) {
  const ordinal = String(index + 1).padStart(2, "0");
  const artifactSha256 = hash(`campaign-artifact-${ordinal}`);
  return {
    artifactId: `sha256:${artifactSha256}`,
    artifactSha256,
    modelSlotId: `model-${ordinal}`,
    qualificationOperationId: `qualify-model-${ordinal}`
  };
}

function planDraft() {
  const models = Array.from({ length: 20 }, (_, index) => modelSlot(index));
  const browserRounds = Array.from({ length: 50 }, (_, index) => {
    const ordinal = String(index + 1).padStart(2, "0");
    const slot = models[index % models.length];
    return {
      memoryContinuityRequired: index < 25,
      modelSlotId: slot.modelSlotId,
      operationId: `browser-round-${ordinal}`,
      restartId: `restart-${ordinal}`,
      roundId: `round-${ordinal}`
    };
  });
  const memoryRounds = browserRounds.slice(0, 25).map((round, index) => {
    const ordinal = String(index + 1).padStart(2, "0");
    return {
      browserRoundId: round.roundId,
      companyIdHash: hash(`company-${ordinal}`),
      memoryRoundId: `memory-${ordinal}`,
      modelSlotId: round.modelSlotId,
      operationId: `memory-round-${ordinal}`
    };
  });
  const p2pLanes = models.flatMap((slot) => ["a", "b"].map((lane) => ({
    laneId: `${slot.modelSlotId}-lane-${lane}`,
    modelSlotId: slot.modelSlotId,
    processInstanceId: `${slot.modelSlotId}-process-${lane}`
  })));
  const announcements = models.map((slot) => ({
    announcementId: `announce-${slot.modelSlotId}`,
    modelSlotId: slot.modelSlotId,
    operationId: `announce-${slot.modelSlotId}`
  }));
  return {
    schema: "tinyrustlm.vnext.campaign_plan.v1",
    profileId: "tinyrustlm.vnext.campaign-projection.v1",
    campaignId,
    environment: "production",
    applicationOrigin: "https://tinyrustlm.com",
    memoryContractId,
    createdAtUtc: "2026-08-09T00:00:00Z",
    models,
    browserRounds,
    memoryRounds,
    p2pLanes,
    announcements
  };
}

function finalizedPlan() {
  return finalizeVnextCampaignPlan(planDraft());
}

function parameter(name, value) {
  return { name, value: String(value), unit: null };
}

function phaseReceipt({
  attemptId,
  operationId,
  subjectId,
  receiptType,
  parameters,
  inputReceiptIds = [],
  inputHashes = [],
  outputHashes = [],
  supersedesReceiptIds = [],
  status = "pass",
  runtime = {}
}) {
  const draft = baseReceiptDraft({
    receiptType,
    attemptId,
    inputReceiptIds,
    inputHashes
  });
  draft.status = status;
  draft.publicParameters = [
    parameter("operation_id", operationId),
    parameter("subject_id", subjectId),
    ...parameters
  ].sort((left, right) => left.name.localeCompare(right.name));
  draft.outputHashes = [...outputHashes].sort((left, right) =>
    left.name.localeCompare(right.name));
  draft.supersedesReceiptIds = [...supersedesReceiptIds].sort();
  draft.runtime = {
    ...draft.runtime,
    ...runtime
  };
  if (status === "fail" || status === "rejected") {
    draft.error = {
      code: "synthetic-campaign-failure",
      failureStep: "campaign-evidence",
      retryStatus: status === "fail" ? "retryable" : "terminal",
      rollbackStatus: "not-required"
    };
  }
  if (status === "blocked") draft.blockerCode = "synthetic-campaign-blocker";
  return finalizeVnextReceipt(draft);
}

function qualificationReceipt(slot, overrides = {}) {
  return phaseReceipt({
    attemptId: overrides.attemptId ?? `qualification-${slot.modelSlotId}`,
    operationId: slot.qualificationOperationId,
    subjectId: slot.artifactId,
    receiptType: "qualification",
    parameters: [
      parameter("artifact_id", slot.artifactId),
      parameter("artifact_sha256", slot.artifactSha256),
      parameter("model_slot_id", slot.modelSlotId)
    ],
    outputHashes: [{ name: "qualified-artifact", sha256: slot.artifactSha256 }],
    supersedesReceiptIds: overrides.supersedesReceiptIds,
    status: overrides.status,
    runtime: { executionClass: "local" }
  });
}

function browserReceipt(round, slot, qualification, overrides = {}) {
  return phaseReceipt({
    attemptId: overrides.attemptId ?? `browser-${round.roundId}`,
    operationId: round.operationId,
    subjectId: round.roundId,
    receiptType: "browser-round",
    parameters: [
      parameter("artifact_id", slot.artifactId),
      parameter("fresh_profile_created", "true"),
      parameter("model_slot_id", slot.modelSlotId),
      parameter("profile_deleted", "true"),
      parameter("restart_id", round.restartId),
      parameter("round_id", round.roundId),
      parameter("turn_count", "3")
    ],
    inputReceiptIds: [qualification.receipt.receiptId],
    outputHashes: [
      { name: "conversation-evidence", sha256: hash(`conversation:${round.roundId}`) },
      { name: "profile-deletion-proof", sha256: hash(`deletion:${round.roundId}`) }
    ],
    runtime: {
      runtimeIdentifier: "chromium-campaign",
      operatingSystem: "browser",
      architecture: "wasm32",
      executionClass: "browser"
    },
    ...overrides
  });
}

function memoryReceipt(memory, round, slot, browser, overrides = {}) {
  return phaseReceipt({
    attemptId: overrides.attemptId ?? `memory-${memory.memoryRoundId}`,
    operationId: memory.operationId,
    subjectId: memory.memoryRoundId,
    receiptType: "memory-continuity",
    parameters: [
      parameter("artifact_id", slot.artifactId),
      parameter("browser_round_id", round.roundId),
      parameter("company_closed", "true"),
      parameter("company_deleted", "true"),
      parameter("company_id_hash", memory.companyIdHash),
      parameter("first_profile_deleted", "true"),
      parameter("long_term_restored", "true"),
      parameter("memory_contract_id", memoryContractId),
      parameter("memory_round_id", memory.memoryRoundId),
      parameter("model_slot_id", slot.modelSlotId),
      parameter("post_delete_rejected", "true"),
      parameter("replay_rejected", "true"),
      parameter("second_profile_deleted", "true"),
      parameter("secret_scan_clear", "true"),
      parameter("short_term_restored", "true")
    ],
    inputReceiptIds: [browser.receipt.receiptId],
    inputHashes: [{
      name: "memory-contract",
      sha256: memoryContractId.slice("sha256:".length)
    }],
    outputHashes: [
      { name: "cleanup-proof", sha256: hash(`cleanup:${memory.memoryRoundId}`) },
      { name: "restore-proof", sha256: hash(`restore:${memory.memoryRoundId}`) },
      { name: "secret-scan", sha256: hash(`secret-scan:${memory.memoryRoundId}`) }
    ],
    runtime: {
      runtimeIdentifier: "memory-endpoints-live",
      executionClass: "live-service"
    },
    ...overrides
  });
}

function announcementReceipt(announcement, slot, qualification, overrides = {}) {
  return phaseReceipt({
    attemptId: overrides.attemptId ?? `announcement-${announcement.announcementId}`,
    operationId: announcement.operationId,
    subjectId: announcement.announcementId,
    receiptType: "catalog-announcement",
    parameters: [
      parameter("announcement_id", announcement.announcementId),
      parameter("artifact_id", slot.artifactId),
      parameter("live_readback_verified", "true"),
      parameter("model_slot_id", slot.modelSlotId),
      parameter("public_https", "true")
    ],
    inputReceiptIds: [qualification.receipt.receiptId],
    outputHashes: [
      { name: "announcement-metadata", sha256: hash(`metadata:${slot.modelSlotId}`) },
      { name: "catalog-readback", sha256: hash(`readback:${slot.modelSlotId}`) }
    ],
    runtime: {
      runtimeIdentifier: "minimodel-live-catalog",
      executionClass: "live-service"
    },
    ...overrides
  });
}

function outsideProof(lane, slot, authority) {
  return finalizeVnextIdentityDocument({
    schema: "tinyrustlm.vnext.outside_proof.v2",
    campaignId,
    modelArtifactId: slot.artifactId,
    p2pManifestId: `sha256:${hash(`p2p:${slot.modelSlotId}`)}`,
    laneId: lane.laneId,
    processInstanceId: lane.processInstanceId,
    endpoint: `https://${lane.laneId}.peer.example.com/`,
    observerId: authority.observerKey.record.signerId,
    observerRegistryId: authority.root.receipt.receiptId,
    nonceHash: hash(`proof-nonce:${lane.laneId}`),
    implementationSha256: hash("campaign-p2p-implementation"),
    checkedRoutes: [
      { method: "GET", path: "/artifact", status: 200, byteLength: 1,
        responseSha256: slot.artifactSha256 },
      { method: "GET", path: "/manifest", status: 200, byteLength: 2,
        responseSha256: hash(`manifest:${lane.laneId}`) },
      { method: "GET", path: "/pieces/0", status: 200, byteLength: 1,
        responseSha256: hash(`piece:${lane.laneId}`) }
    ],
    completeTransferSha256: slot.artifactSha256,
    completeTransferBytes: 1,
    networkScope: "outside-host-and-local-network",
    observedAtUtc: "2026-08-09T00:00:00Z",
    issuedAtUtc: "2026-08-09T00:00:01Z",
    expiresAtUtc: "2026-08-09T01:00:01Z",
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    }
  });
}

function campaignAuthority() {
  const localKey = authorityKey({
    keyId: "local-key-001",
    signerId: "local-recorder-001",
    role: "local-recorder"
  });
  const observerKey = authorityKey({
    keyId: "observer-key-campaign-001",
    signerId: "outside-observer-campaign-001",
    role: "outside-network-observer"
  });
  const p2pKey = authorityKey({
    keyId: "p2p-key-campaign-001",
    signerId: "p2p-publisher-campaign-001",
    role: "p2p-publisher"
  });
  const releaseKey = authorityKey({
    keyId: "release-key-campaign-001",
    signerId: "release-authorizer-campaign-001",
    role: "release-authorizer"
  });
  const root = makeAuthorityRegistry({
    label: "campaign-projection-root",
    keys: [localKey, observerKey, p2pKey, releaseKey]
  });
  return { localKey, observerKey, p2pKey, releaseKey, root };
}

function signature(authority, subject, label, kind) {
  let settings;
  if (kind === "local") {
    settings = { signingKey: authority.localKey, scope: "receipt-recording" };
  } else if (kind === "observer") {
    settings = {
      signingKey: authority.observerKey,
      scope: "outside-proof",
      nonceHash: subject.value.nonceHash
    };
  } else {
    settings = { signingKey: authority.p2pKey, scope: "p2p-publication" };
  }
  return makeSignatureReceipt({
    label,
    authorityRegistry: authority.root,
    subject,
    ...settings
  });
}

function projectionInput(plan, {
  authority = null,
  receipts = [],
  subjects = [],
  verificationTime = verificationTimeUtc
} = {}) {
  return {
    campaignPlanBytes: plan.bytes,
    expectedCampaignPlanSha256: plan.planSha256,
    expectedCampaignId: campaignId,
    expectedEnvironment: "production",
    trustedRootRegistryReceiptId: authority?.root.receipt.receiptId ?? null,
    expectedTerminalRegistryReceiptId: authority?.root.receipt.receiptId ?? null,
    verificationTimeUtc: verificationTime,
    receiptBytes: authority === null
      ? receipts.map((entry) => entry.bytes)
      : [authority.root.bytes, ...receipts.map((entry) => entry.bytes)],
    subjectBytes: subjects.map((entry) => entry.bytes)
  };
}

function buildCompleteEvidence(plan) {
  const authority = campaignAuthority();
  const models = new Map(plan.plan.models.map((entry) => [entry.modelSlotId, entry]));
  const receipts = [];
  const subjects = [];
  const qualificationByModel = new Map();
  const browserByRound = new Map();

  for (const slot of plan.plan.models) {
    const receipt = qualificationReceipt(slot);
    qualificationByModel.set(slot.modelSlotId, receipt);
    receipts.push(receipt,
      signature(authority, receipt, `qualification-${slot.modelSlotId}`, "local"));
  }
  for (const round of plan.plan.browserRounds) {
    const slot = models.get(round.modelSlotId);
    const receipt = browserReceipt(round, slot,
      qualificationByModel.get(round.modelSlotId));
    browserByRound.set(round.roundId, receipt);
    receipts.push(receipt,
      signature(authority, receipt, `browser-${round.roundId}`, "local"));
  }
  for (const memory of plan.plan.memoryRounds) {
    const round = plan.plan.browserRounds.find((entry) =>
      entry.roundId === memory.browserRoundId);
    const slot = models.get(memory.modelSlotId);
    const receipt = memoryReceipt(memory, round, slot,
      browserByRound.get(round.roundId));
    receipts.push(receipt,
      signature(authority, receipt, `memory-${memory.memoryRoundId}`, "local"));
  }
  for (const lane of plan.plan.p2pLanes) {
    const slot = models.get(lane.modelSlotId);
    const proof = outsideProof(lane, slot, authority);
    subjects.push(proof);
    receipts.push(signature(authority, proof, `proof-${lane.laneId}`, "observer"));
  }
  for (const announcement of plan.plan.announcements) {
    const slot = models.get(announcement.modelSlotId);
    const receipt = announcementReceipt(announcement, slot,
      qualificationByModel.get(slot.modelSlotId));
    receipts.push(receipt,
      signature(authority, receipt, `announcement-${announcement.announcementId}`, "p2p"));
  }
  return { authority, receipts, subjects };
}

test("freezes one bounded projection profile and sufficient full-campaign limits", () => {
  const profileBytes = fs.readFileSync(profilePath);
  const source = fs.readFileSync(path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-campaign-projection.js"), "utf8");
  const signatureProfile = parseStrictJson(fs.readFileSync(signatureProfilePath));
  const offlineProfile = parseStrictJson(fs.readFileSync(offlineProfilePath));

  assert.equal(campaignProjectionProfileSha256, sha256(profileBytes));
  assert.equal(campaignProjectionProfile.profileId,
    "tinyrustlm.vnext.campaign-projection.v1");
  assert.equal(campaignProjectionProfile.status, "frozen");
  assert.deepEqual(campaignProjectionProfile.objectiveTargets, {
    announcedModels: 20,
    cleanBrowserRounds: 50,
    liveMemoryRounds: 25,
    outsideProvenLanes: 40,
    qualifiedModels: 20
  });
  assert.equal(offlineProfile.limits.maximumTargetSignatures, 512);
  assert.equal(signatureProfile.limits.maximumSignatureEnvelopes, 1024);
  assert.ok(2 * (20 + 50 + 25 + 40 + 20) <
    signatureProfile.limits.maximumSignatureEnvelopes);
  assert.doesNotMatch(source,
    /JSON\.parse|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("finalizes one deterministic content-addressed exact campaign schedule", () => {
  const first = finalizedPlan();
  const second = finalizeVnextCampaignPlan(planDraft());

  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.planSha256, second.planSha256);
  assert.match(first.plan.planId, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(first.plan.models.length, 20);
  assert.equal(new Set(first.plan.models.map((entry) =>
    entry.artifactSha256)).size, 20);
  assert.equal(first.plan.browserRounds.length, 50);
  assert.equal(first.plan.browserRounds.filter((entry) =>
    entry.memoryContinuityRequired).length, 25);
  assert.equal(first.plan.memoryRounds.length, 25);
  assert.equal(first.plan.p2pLanes.length, 40);
  assert.equal(first.plan.announcements.length, 20);
  for (const model of first.plan.models) {
    const restarts = first.plan.browserRounds.filter((entry) =>
      entry.modelSlotId === model.modelSlotId).map((entry) => entry.restartId);
    assert.ok(new Set(restarts).size >= 2);
    const lanes = first.plan.p2pLanes.filter((entry) =>
      entry.modelSlotId === model.modelSlotId);
    assert.equal(lanes.length, 2);
    assert.notEqual(lanes[0].processInstanceId, lanes[1].processInstanceId);
  }
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.plan), true);
  assert.notEqual(first.bytes, first.bytes);
});

test("rejects count drift, duplicate artifacts, reused processes, and memory mismatch", () => {
  const wrongCount = planDraft();
  wrongCount.browserRounds.pop();
  throwsCode(() => finalizeVnextCampaignPlan(wrongCount),
    "campaign_plan_browser_schedule_invalid");

  const duplicateArtifact = planDraft();
  duplicateArtifact.models[1].artifactId = duplicateArtifact.models[0].artifactId;
  duplicateArtifact.models[1].artifactSha256 =
    duplicateArtifact.models[0].artifactSha256;
  throwsCode(() => finalizeVnextCampaignPlan(duplicateArtifact),
    "campaign_plan_model_identity_invalid");

  const reusedProcess = planDraft();
  reusedProcess.p2pLanes[1].processInstanceId =
    reusedProcess.p2pLanes[0].processInstanceId;
  throwsCode(() => finalizeVnextCampaignPlan(reusedProcess),
    "campaign_plan_lane_identity_invalid");

  const wrongMemory = planDraft();
  wrongMemory.memoryRounds[0].browserRoundId = "round-50";
  throwsCode(() => finalizeVnextCampaignPlan(wrongMemory),
    "campaign_plan_memory_schedule_invalid");
});

test("projects honest zeros and explicit blockers without authority or evidence", () => {
  const plan = finalizedPlan();
  const result = projectVnextCampaign(projectionInput(plan));

  assert.deepEqual(result.result.counts, {
    announcedModels: { current: 0, target: 20 },
    cleanBrowserRounds: { current: 0, target: 50 },
    liveMemoryRounds: { current: 0, target: 25 },
    outsideProvenLanes: { current: 0, target: 40 },
    qualifiedModels: { current: 0, target: 20 }
  });
  assert.equal(result.result.complete, false);
  assert.equal(result.result.authorityStatus, "unavailable");
  assert.equal(result.result.resumableState, "blocked");
  assert.equal(result.result.currentOperation.operationId, null);
  assert.ok(result.result.blockerCodes.includes("authority_graph_unavailable"));
  assert.ok(result.result.blockerCodes.includes("qualified_models_incomplete"));
  assert.equal(result.result.objectiveReceiptCount, 0);
  assert.equal(result.result.objectiveSignatureCount, 0);
});

test("counts only signed exact evidence and preserves dependency ordering", () => {
  const plan = finalizedPlan();
  const authority = campaignAuthority();
  const slot = plan.plan.models[0];
  const round = plan.plan.browserRounds.find((entry) =>
    entry.modelSlotId === slot.modelSlotId);
  const memory = plan.plan.memoryRounds.find((entry) =>
    entry.browserRoundId === round.roundId);
  const qualification = qualificationReceipt(slot);
  const browser = browserReceipt(round, slot, qualification);
  const memoryValue = memoryReceipt(memory, round, slot, browser);
  const signed = [
    qualification,
    signature(authority, qualification, "partial-qualification", "local"),
    browser,
    signature(authority, browser, "partial-browser", "local"),
    memoryValue,
    signature(authority, memoryValue, "partial-memory", "local")
  ];
  const result = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: signed
  }));

  assert.equal(result.result.counts.qualifiedModels.current, 1);
  assert.equal(result.result.counts.cleanBrowserRounds.current, 1);
  assert.equal(result.result.counts.liveMemoryRounds.current, 1);
  assert.equal(result.result.counts.outsideProvenLanes.current, 0);
  assert.equal(result.result.counts.announcedModels.current, 0);
  assert.equal(result.result.currentOperation.phase, "qualification");
  assert.equal(result.result.authorityStatus, "verified");
});

test("withdraws superseded passes and rejects unsigned or unplanned current evidence", () => {
  const plan = finalizedPlan();
  const authority = campaignAuthority();
  const slot = plan.plan.models[0];
  const passed = qualificationReceipt(slot);
  const failed = qualificationReceipt(slot, {
    attemptId: "qualification-model-01-failed",
    status: "fail",
    supersedesReceiptIds: [passed.receipt.receiptId]
  });
  const result = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [
      passed,
      signature(authority, passed, "superseded-pass", "local"),
      failed,
      signature(authority, failed, "current-fail", "local")
    ]
  }));
  assert.equal(result.result.counts.qualifiedModels.current, 0);
  assert.ok(result.result.blockerCodes.includes("qualified_models_incomplete"));
  assert.equal(result.result.phaseStateCounts.superseded, 1);
  assert.equal(result.result.phaseStateCounts["current-nonpass"], 1);

  const unsigned = qualificationReceipt(plan.plan.models[1]);
  const unsignedResult = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [unsigned]
  }));
  assert.equal(unsignedResult.result.counts.qualifiedModels.current, 0);
  assert.deepEqual(unsignedResult.result.unsignedCurrentReceiptIds,
    [unsigned.receipt.receiptId]);
  assert.ok(unsignedResult.result.blockerCodes.includes(
    "unsigned_current_objective_evidence"));

  const unplanned = phaseReceipt({
    attemptId: "qualification-unplanned-model",
    operationId: "qualify-unplanned-model",
    subjectId: `sha256:${hash("unplanned-model")}`,
    receiptType: "qualification",
    parameters: [
      parameter("artifact_id", `sha256:${hash("unplanned-model")}`),
      parameter("artifact_sha256", hash("unplanned-model")),
      parameter("model_slot_id", "model-unplanned")
    ],
    outputHashes: [{ name: "qualified-artifact", sha256: hash("unplanned-model") }],
    runtime: { executionClass: "local" }
  });
  const unplannedResult = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [
      unplanned,
      signature(authority, unplanned, "unplanned-qualification", "local")
    ]
  }));
  assert.deepEqual(unplannedResult.result.unplannedCurrentReceiptIds,
    [unplanned.receipt.receiptId]);
  assert.ok(unplannedResult.result.blockerCodes.includes(
    "unplanned_current_objective_evidence"));
});

test("rejects duplicate current role-correct signatures for one objective", () => {
  const plan = finalizedPlan();
  const authority = campaignAuthority();
  const qualification = qualificationReceipt(plan.plan.models[0]);
  const result = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [
      qualification,
      signature(authority, qualification, "duplicate-signature-a", "local"),
      signature(authority, qualification, "duplicate-signature-b", "local")
    ]
  }));
  assert.equal(result.result.counts.qualifiedModels.current, 0);
  assert.deepEqual(result.result.conflictingObjectiveSignatureSubjectIds,
    [qualification.receipt.receiptId]);
  assert.ok(result.result.blockerCodes.includes("objective_signature_conflicts"));
});

test("requires one current outside proof per planned lane and withdraws expired proof", () => {
  const plan = finalizedPlan();
  const authority = campaignAuthority();
  const lane = plan.plan.p2pLanes[0];
  const slot = plan.plan.models.find((entry) =>
    entry.modelSlotId === lane.modelSlotId);
  const proof = outsideProof(lane, slot, authority);
  const proofSignature = signature(authority, proof, "one-lane-proof", "observer");
  const current = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [proofSignature],
    subjects: [proof]
  }));
  assert.equal(current.result.counts.outsideProvenLanes.current, 1);

  const expired = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [proofSignature],
    subjects: [proof],
    verificationTime: "2026-08-09T02:00:00Z"
  }));
  assert.equal(expired.result.counts.outsideProvenLanes.current, 0);
  assert.ok(expired.result.blockerCodes.includes("outside_proofs_incomplete"));
});

test("completes only from all exact current signed objective evidence", () => {
  const plan = finalizedPlan();
  const evidence = buildCompleteEvidence(plan);
  const result = projectVnextCampaign(projectionInput(plan, evidence));

  assert.deepEqual(result.result.counts, {
    announcedModels: { current: 20, target: 20 },
    cleanBrowserRounds: { current: 50, target: 50 },
    liveMemoryRounds: { current: 25, target: 25 },
    outsideProvenLanes: { current: 40, target: 40 },
    qualifiedModels: { current: 20, target: 20 }
  });
  assert.equal(result.result.complete, true);
  assert.equal(result.result.resumableState, "complete");
  assert.deepEqual(result.result.blockerCodes, []);
  assert.equal(result.result.objectiveReceiptCount, 115);
  assert.equal(result.result.objectiveSignatureCount, 155);
  assert.equal(result.result.currentOperation.state, "complete");
  assert.equal(result.result.unplannedCurrentReceiptIds.length, 0);
  assert.equal(result.result.conflictingLaneIds.length, 0);
  assert.deepEqual(
    validateCampaignProjectionResultBytes(result.resultBytes, plan.bytes).resultBytes,
    result.resultBytes
  );
});

test("packages and verifies the complete campaign evidence closure offline", () => {
  const plan = finalizedPlan();
  const evidence = buildCompleteEvidence(plan);
  const receiptBytes = [
    evidence.authority.root.bytes,
    ...evidence.receipts.map((entry) => entry.bytes)
  ];
  const subjectBytes = evidence.subjects.map((entry) => entry.bytes);
  const targetSignatureReceiptIds = evidence.receipts
    .filter((entry) => entry.receipt.receiptType === "signature-envelope")
    .map((entry) => entry.receipt.receiptId)
    .sort();
  assert.equal(receiptBytes.length, 271);
  assert.equal(targetSignatureReceiptIds.length, 155);

  const manifest = finalizeVnextOfflineBundleManifest({
    campaignId,
    createdAtUtc: "2026-08-09T00:05:00Z",
    environment: "production",
    expectedTerminalRegistryReceiptId:
      evidence.authority.root.receipt.receiptId,
    receiptBytes,
    subjectBytes,
    targetSignatureReceiptIds,
    trustedRootRegistryReceiptId: evidence.authority.root.receipt.receiptId
  });
  assert.equal(manifest.receiptIds.length, 271);
  assert.equal(manifest.signatureEnvelopeReceiptIds.length, 155);
  assert.ok(manifest.manifest.profileBindings.some((entry) =>
    entry.name === "campaign-projection-profile" &&
    entry.sha256 === campaignProjectionProfileSha256));

  const draft = baseReceiptDraft({
    receiptType: "offline-verification-bundle",
    attemptId: "offline-complete-campaign",
    startedAtUtc: manifest.manifest.createdAtUtc,
    completedAtUtc: manifest.manifest.createdAtUtc,
    inputReceiptIds: manifest.allReceiptIds,
    inputHashes: [{
      name: "offline-bundle-manifest",
      sha256: manifest.manifestSha256
    }]
  });
  draft.offlineBundle = {
    bundleManifestSha256: manifest.manifestSha256,
    receiptIds: manifest.receiptIds,
    signatureEnvelopeReceiptIds: manifest.signatureEnvelopeReceiptIds,
    authorityRegistryReceiptIds: manifest.authorityRegistryReceiptIds,
    revocationReceiptIds: manifest.revocationReceiptIds,
    schemaHashes: manifest.schemaHashes,
    createdAtUtc: manifest.manifest.createdAtUtc
  };
  const verificationReceipt = finalizeVnextReceipt(draft);
  const verified = verifyVnextOfflineBundle({
    bundleManifestBytes: manifest.bytes,
    expectedBundleManifestSha256: manifest.manifestSha256,
    expectedCampaignId: campaignId,
    expectedEnvironment: "production",
    expectedTerminalRegistryReceiptId:
      evidence.authority.root.receipt.receiptId,
    receiptBytes,
    subjectBytes,
    trustedRootRegistryReceiptId: evidence.authority.root.receipt.receiptId,
    verificationReceiptBytes: verificationReceipt.bytes,
    verificationTimeUtc
  });
  assert.equal(verified.offlineBundleVerified, true);
  assert.equal(verified.targetCurrentEvidenceEligibleCount, 155);
});

test("is transport-order deterministic and returns defensive immutable bytes", () => {
  const plan = finalizedPlan();
  const authority = campaignAuthority();
  const slot = plan.plan.models[0];
  const qualification = qualificationReceipt(slot);
  const signed = signature(authority, qualification, "deterministic", "local");
  const first = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [qualification, signed]
  }));
  const second = projectVnextCampaign(projectionInput(plan, {
    authority,
    receipts: [signed, qualification]
  }));

  assert.deepEqual(first.resultBytes, second.resultBytes);
  assert.equal(first.resultSha256, second.resultSha256);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.result), true);
  assert.notEqual(first.resultBytes, first.resultBytes);
  const changed = first.resultBytes;
  changed[0] ^= 0xff;
  assert.deepEqual(first.resultBytes, second.resultBytes);

  let getterInvoked = false;
  const hostile = projectionInput(plan);
  Object.defineProperty(hostile, "receiptBytes", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return [];
    }
  });
  throwsCode(() => projectVnextCampaign(hostile),
    "campaign_projection_input_invalid");
  assert.equal(getterInvoked, false);
});

test("validates a canonical projection result against its exact campaign plan", () => {
  const plan = finalizedPlan();
  const projected = projectVnextCampaign(projectionInput(plan));
  const validated = validateCampaignProjectionResultBytes(projected.resultBytes, plan.bytes);

  assert.deepEqual(validated.resultBytes, projected.resultBytes);
  assert.equal(validated.resultSha256, projected.resultSha256);
  assert.equal(Object.isFrozen(validated.result), true);
  const first = validated.resultBytes;
  first[0] ^= 0xff;
  assert.deepEqual(validated.resultBytes, projected.resultBytes);

  const pretty = Buffer.from(JSON.stringify(projected.result, null, 2));
  throwsCode(() => validateCampaignProjectionResultBytes(pretty, plan.bytes),
    "campaign_projection_result_wire_not_canonical");

  const inconsistent = structuredClone(projected.result);
  inconsistent.counts.qualifiedModels.current = 1;
  const inconsistentBytes = canonicalizeVnextJcsBytes(inconsistent, {
    maximumDepth: campaignProjectionProfile.limits.maximumDepth,
    maximumTotalEntries: campaignProjectionProfile.limits.maximumTotalEntries,
    maximumObjectMembers: campaignProjectionProfile.limits.maximumObjectMembers,
    maximumArrayItems: campaignProjectionProfile.limits.maximumArrayItems,
    maximumStringCodeUnits: campaignProjectionProfile.limits.maximumStringCodeUnits,
    maximumTotalStringCodeUnits: campaignProjectionProfile.limits.maximumTotalStringCodeUnits
  });
  throwsCode(() => validateCampaignProjectionResultBytes(inconsistentBytes, plan.bytes),
    "campaign_projection_result_counts_invalid");

  const otherPlan = planDraft();
  otherPlan.campaignId = "campaign-vnext-002";
  const finalizedOther = finalizeVnextCampaignPlan(otherPlan);
  throwsCode(() => validateCampaignProjectionResultBytes(
    projected.resultBytes, finalizedOther.bytes), "campaign_projection_result_plan_mismatch");

  const evidence = buildCompleteEvidence(plan);
  const partial = projectVnextCampaign(projectionInput(plan, {
    authority: evidence.authority,
    receipts: evidence.receipts.slice(0, 2)
  }));
  assert.equal(partial.result.resumableState, "resumable");
  assert.deepEqual(
    validateCampaignProjectionResultBytes(partial.resultBytes, plan.bytes).resultBytes,
    partial.resultBytes
  );
});
