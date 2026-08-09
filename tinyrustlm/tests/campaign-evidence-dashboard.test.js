"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildCampaignDashboard,
  formatCampaignDashboard,
  validateDashboardHash
} = require("../tools/campaign-evidence-dashboard.js");
const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  buildCampaignPublicArtifactManifest,
  staticArtifacts
} = require("../tools/campaign-public-artifact-scope.js");
const {
  attemptReceiptType,
  loadFaultPlan,
  planReceiptType,
  reportReceiptType
} = require("../tools/campaign-fault-injection.js");

const campaignId = "dashboard-test-20260715";
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

function baseReceipt(label, overrides = {}) {
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
    sourceRevision: "a".repeat(40),
    toolNames: ["test-tool"],
    toolVersions: ["1"],
    toolBinaryHashes: [digest("test-tool")],
    runtimeIdentifier: "win-x64",
    operatingSystem: "win32",
    architecture: "x64",
    hardwareEvidence: { test: true },
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

function writeWorkspaceFile(root, relativePath, text = "public fixture\n") {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function putQualification(store, options = {}) {
  const modelId = options.modelId || "tinyrustlm/model-a";
  const evaluatorSha256 = options.evaluatorSha256 || digest("tinyrustlm-eval-current");
  return store.putReceipt(baseReceipt("model-qualification", {
    receiptType: "tinyrustlm.model-qualification",
    phase: "model-qualification",
    status: options.status || "pass",
    outputHashes: {
      evaluation: digest(`${modelId}-evaluation`),
      manifest: digest(`${modelId}-manifest`),
      model: options.artifactSha256 || digest(`${modelId}-model`),
      review: digest(`${modelId}-review`)
    },
    publicSafeParameters: {
      modelId,
      qualityClaim: options.status === "rejected" ? "rejected" : "conversation-proven",
      casesPassed: options.casesPassed ?? (options.status === "rejected" ? 5 : 14),
      expectedCaseCount: 14
    },
    evidenceClass: options.evidenceClass || "local",
    blockerCode: options.status === "rejected" ? "model_quality_rejected" : null,
    completedAtUtc: options.completedAtUtc || "2026-07-15T06:01:00.000Z",
    toolNames: ["tinyrustlm-slm-pack", "tinyrustlm-eval"],
    toolVersions: ["content-hash-bound", "content-hash-bound"],
    toolBinaryHashes: [digest("tinyrustlm-slm-pack"), evaluatorSha256],
    supersedesReceiptIds: options.supersedesReceiptIds || [],
    configurationHash: options.configurationHash || digest(`${modelId}-${options.status || "pass"}`)
  })).receipt;
}

function putSourceScreen(store, options = {}) {
  const modelId = options.modelId || "LiquidAI/LFM2.5-350M";
  return store.putReceipt(baseReceipt("model-source-screen", {
    receiptType: "tinyrustlm.model-source-screen-v1",
    phase: "model-source-screen",
    status: options.status || "rejected",
    inputHashes: {
      sourceModel: options.artifactSha256 || digest(`${modelId}-source-model`)
    },
    outputHashes: {
      sourceScreen: digest(`${modelId}-source-screen`),
      assessment: digest(`${modelId}-assessment`)
    },
    publicSafeParameters: {
      modelId,
      decision: options.status || "rejected",
      casesPassed: options.status === "pass" ? 8 : 3,
      casesFailed: options.status === "pass" ? 0 : 5
    },
    blockerCode: options.status === "pass" ? null : "model_quality_rejected",
    evidenceClass: "local"
  })).receipt;
}

function putSourceTaskScreen(store, options = {}) {
  const modelId = options.modelId || "LiquidAI/LFM2.5-350M";
  const taskContractId = options.taskContractId || "planning-constraint-ledger-json-v1";
  return store.putReceipt(baseReceipt("model-source-task-screen", {
    receiptType: options.receiptType || "tinyrustlm.model-source-task-screen-v1",
    phase: "model-source-task-screen",
    status: options.status || "rejected",
    inputHashes: {
      sourceModel: options.artifactSha256 || digest(`${modelId}-source-model`)
    },
    outputHashes: {
      preservedRawCapture: digest(`${modelId}-${taskContractId}-raw-capture`),
      privateVerdict: digest(`${modelId}-${taskContractId}-verdict`)
    },
    publicSafeParameters: {
      modelId,
      taskContractId,
      sourceTaskScreenDecision: options.status || "rejected",
      taskSpecificProofGranted: false,
      broadQualityClaimSupported: false
    },
    blockerCode: options.status === "pass"
      ? null
      : "task_specific_source_quality_rejected",
    evidenceClass: "local",
    completedAtUtc: options.completedAtUtc || "2026-07-15T06:01:30.000Z"
  })).receipt;
}

function passingRoundParameters() {
  return {
    round: 1,
    modelId: "tinyrustlm/model-a",
    freshProfileBefore: true,
    firstProfileDeleted: true,
    finalProfileDeleted: true,
    secondProfileFresh: false,
    modelHashVerified: true,
    manifestVerified: true,
    qualityEvidenceVerified: true,
    userMessageCount: 2,
    assistantMessageCount: 2,
    authoritativeResponseCount: 1,
    rawConversationSha256: digest("conversation"),
    publicPromptLeakCount: 0,
    publicModelByteRequestCount: 0,
    unexpectedLocalAppRequestCount: 0,
    unexpectedThirdPartyRequestCount: 0,
    secretsPersisted: false,
    memoryContinuityRequired: false,
    memoryShortTermRestored: false,
    memoryLongTermRestored: false,
    memoryAnswerRestored: false,
    oneTimeUrlReplayRejected: false,
    companyClosed: false,
    companyDeleted: false,
    publicAnnouncementVerified: false,
    failures: []
  };
}

function putOperationStart(store, operationId, completedAtUtc) {
  return store.putReceipt(baseReceipt("campaign-operation-start-v1", {
    receiptType: "tinyrustlm.campaign-operation-start-v1",
    phase: "model-source-screen",
    completedAtUtc,
    createdAtUtc: completedAtUtc,
    publicSafeParameters: {
      operationId,
      operationName: "screen candidate"
    }
  })).receipt;
}

function putOperationFinish(store, start, completedAtUtc) {
  return store.putReceipt(baseReceipt("campaign-operation-finish-v1", {
    receiptType: "tinyrustlm.campaign-operation-finish-v1",
    phase: start.phase,
    inputReceiptIds: [start.receiptId],
    createdAtUtc: completedAtUtc,
    completedAtUtc,
    publicSafeParameters: {
      operationId: start.publicSafeParameters.operationId,
      operationName: start.publicSafeParameters.operationName
    }
  })).receipt;
}

function browserHardwareEvidence(fault, actualChromiumProcess = true) {
  return fault.requiredEvidenceClass === "browser" ? {
    actualChromiumProcess,
    browserExecutableHashVerified: true,
    ownedPersistentProfile: true,
    profileDeletionProven: true
  } : {};
}

function packageHardwareEvidence(fault) {
  return fault.requiredEvidenceClass === "package" ? {
    actualDotnetProcess: true,
    compositionIdentityVerified: true,
    consumerExecutionPassed: true,
    dotnetExecutableHashVerified: true,
    isolatedNuGetCache: true,
    lockedModeRestore: true,
    ownedWorkRootDeleted: true,
    packageContentHashDriftObserved: true,
    packageHashesVerified: true
  } : {};
}

function targetPlatformHardwareEvidence(fault) {
  return fault.requiredEvidenceClass === "target-platform" ? {
    actualPhysicalHostRestart: true,
    injectedFixtureEvidence: false,
    operatingSystemBootProbe: true,
    bootIdentityChanged: true,
    stableHostIdentityMatched: true,
    physicalMachineIdentityObserved: true,
    receiptDagRebuilt: true,
    orphanProcessScanPass: true,
    preRestartAttemptRetained: true,
    operatorApprovalReferenceVerified: true,
    restartSentinelTerminated: true,
    restartSentinelMarkerRetained: true,
    sentinelMarkerDeleted: true,
    restartVerificationArtifactRetained: true,
    hostProbeBinaryHashVerified: true,
    crossRestartFaultExecution: true
  } : {};
}

function putCompleteFaultCampaign(store, options = {}) {
  const plan = loadFaultPlan();
  const planReceipt = store.putReceipt(baseReceipt("fault-injection-plan-v1", {
    receiptType: planReceiptType,
    phase: "fault-injection-plan",
    outputHashes: { canonicalFaultPlan: plan.planSha256 },
    publicSafeParameters: {
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      plannedFaultCount: plan.value.faults.length,
      requiredFaultCount: plan.value.faults.length
    },
    evidenceClass: "local"
  })).receipt;
  const hostFault = plan.faultsById.get("host-restart");
  const approvalRequestId = digest("complete-host-restart-approval");
  const checkpointSha256 = digest("complete-host-restart-checkpoint");
  const preRestartReceiptSetSha256 = digest("complete-host-pre-restart-receipts");
  const sentinelMarkerSha256 = digest("complete-host-restart-sentinel");
  const operatorApprovalReferenceSha256 = digest(`operator-approved:${approvalRequestId}`);
  const hostOutputHashes = {
    approvalRequest: approvalRequestId,
    preRestartCheckpoint: checkpointSha256,
    preRestartReceiptSet: preRestartReceiptSetSha256,
    postRestartReceiptSet: digest("complete-host-post-restart-receipts"),
    bootIdentityBefore: digest("complete-host-boot-before"),
    bootIdentityAfter: digest("complete-host-boot-after"),
    stableHostIdentity: digest("complete-stable-host"),
    sentinelMarker: sentinelMarkerSha256,
    postRestartVerification: digest("complete-host-restart-verification")
  };
  const hostPreparation = store.putReceipt(baseReceipt("host-restart-preparation-v1", {
    receiptType: "tinyrustlm.host-restart-preparation-v1",
    phase: "fault-host-restart-preparation",
    inputReceiptIds: [planReceipt.receiptId],
    outputHashes: {
      approvalRequest: approvalRequestId,
      hostRestartCheckpoint: checkpointSha256,
      preRestartReceiptSet: preRestartReceiptSetSha256,
      sentinelMarker: sentinelMarkerSha256
    },
    hardwareEvidence: {
      actualHostProbe: true,
      bootIdentityCaptured: true,
      physicalMachineIdentityObserved: true,
      restartSentinelRunning: true,
      operatorApprovalReferenceVerified: true,
      hostProbeBinaryHashVerified: true
    },
    publicSafeParameters: {
      faultId: hostFault.faultId,
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      approvalRequestId,
      checkpointId: digest("complete-host-checkpoint-id"),
      preRestartReceiptCount: 1,
      preRestartReceiptSetSha256,
      expectedTransition: hostFault.expectedTransition,
      operatorApprovalReferenceSha256,
      preparationState: "armed"
    },
    evidenceClass: "target-platform",
    attestationReference: `sha256:${operatorApprovalReferenceSha256}`
  })).receipt;
  const domains = plan.value.faults.map((fault, index) => store.putReceipt(baseReceipt(
    `fault-domain-${String(index + 1).padStart(2, "0")}`, {
      receiptType: fault.expectedDomainReceiptType,
      phase: "fault-domain-evidence",
      status: fault.expectedStatus,
      inputReceiptIds: [planReceipt.receiptId,
        ...(fault.faultId === "host-restart" ? [hostPreparation.receiptId] : [])],
      inputHashes: {
        canonicalFaultPlan: plan.planSha256,
        faultDefinition: digest(JSON.stringify(fault)),
        prerequisiteReceiptSet: digest(JSON.stringify(
          fault.faultId === "host-restart" ? [hostPreparation.receiptId] : []))
      },
      outputHashes: fault.faultId === "host-restart"
        ? hostOutputHashes
        : { observedFault: digest(`observed-${fault.faultId}`) },
      publicSafeParameters: {
        faultId: fault.faultId,
        planId: plan.value.planId,
        planSha256: plan.planSha256,
        requiredEvidenceClass: fault.requiredEvidenceClass,
        executionMode: fault.executionMode,
        actualTransition: fault.expectedTransition,
        cleanupActions: fault.cleanupActions,
        cleanupVerified: true,
        recoveryEvidence: fault.recoveryEvidence,
        recoveryEvidenceVerified: true,
        prerequisiteReceiptIds: fault.faultId === "host-restart"
          ? [hostPreparation.receiptId]
          : [],
        terminalCondition: fault.terminalCondition
      },
      boundedDiagnostics: { observationCodes: fault.recoveryEvidence },
      hardwareEvidence: {
        test: true,
        ...browserHardwareEvidence(fault),
        ...packageHardwareEvidence(fault),
        ...targetPlatformHardwareEvidence(fault)
      },
      evidenceClass: fault.requiredEvidenceClass
    })).receipt);
  const attempts = plan.value.faults.map((fault, index) => store.putReceipt(baseReceipt(
    `fault-injection-attempt-${String(index + 1).padStart(2, "0")}`, {
      receiptType: attemptReceiptType,
      phase: "fault-injection",
      inputReceiptIds: [planReceipt.receiptId, domains[index].receiptId],
      inputHashes: {
        canonicalFaultPlan: plan.planSha256,
        faultDefinition: digest(JSON.stringify(fault)),
        domainEvidence: domains[index].receiptContentHash
      },
      outputHashes: domains[index].outputHashes,
      publicSafeParameters: {
        faultId: fault.faultId,
        planId: plan.value.planId,
        planSha256: plan.planSha256,
        requiredEvidenceClass: fault.requiredEvidenceClass,
        executionMode: fault.executionMode,
        expectedTransition: fault.expectedTransition,
        actualTransition: fault.expectedTransition,
        expectedDomainReceiptType: fault.expectedDomainReceiptType,
        expectedStatus: fault.expectedStatus,
        domainReceiptId: domains[index].receiptId,
        containmentObserved: true,
        cleanupVerified: true,
        recoveryEvidenceVerified: true,
        externalPrerequisitesSatisfied: true,
        releaseSatisfyingEvidence: true
      },
      hardwareEvidence: {
        test: true,
        ...browserHardwareEvidence(fault,
          !(options.invalidateBrowserAttempt === true && fault.requiredEvidenceClass === "browser")),
        ...packageHardwareEvidence(fault),
        ...targetPlatformHardwareEvidence(fault)
      },
      evidenceClass: fault.requiredEvidenceClass
    })).receipt);
  const reportSha256 = digest("complete-fault-report");
  const report = store.putReceipt(baseReceipt("fault-injection-report-v1", {
    receiptType: reportReceiptType,
    phase: "fault-injection-report",
    inputReceiptIds: [planReceipt.receiptId, ...attempts.map((receipt) => receipt.receiptId)],
    inputHashes: {
      canonicalFaultPlan: plan.planSha256,
      attemptReceiptSet: digest(attempts.map((receipt) => receipt.receiptId).sort().join("\n"))
    },
    outputHashes: { faultReport: reportSha256 },
    publicSafeParameters: {
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      plannedFaultCount: plan.value.faults.length,
      executedFaultCount: plan.value.faults.length,
      satisfiedFaultCount: plan.value.faults.length,
      incompleteFaultCount: 0,
      allRequiredFaultsSatisfied: true
    },
    boundedDiagnostics: { incompleteFaultIds: [] },
    evidenceClass: "local",
    attestationReference: `sha256:${reportSha256}`
  })).receipt;
  return { plan, planReceipt, attempts, report };
}

test("reports only current non-fixture evidence and preserves external blockers", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const qualification = putQualification(store);
  putSourceScreen(store);
  putSourceTaskScreen(store);
  putSourceTaskScreen(store, {
    receiptType: "tinyrustlm.model-source-task-screen-v2",
    completedAtUtc: "2026-07-15T06:01:31.000Z"
  });
  putSourceTaskScreen(store, {
    receiptType: "tinyrustlm.model-source-task-screen-v3",
    completedAtUtc: "2026-07-15T06:01:32.000Z"
  });
  putQualification(store, { modelId: "tinyrustlm/fixture", evidenceClass: "fixture" });
  putQualification(store, {
    modelId: "[REDACTED]",
    status: "rejected",
    configurationHash: digest("legacy-redacted-model-identity")
  });
  store.putReceipt(baseReceipt("model-qualification-error", {
    receiptType: "tinyrustlm.model-qualification-error",
    phase: "model-source-review",
    status: "fail",
    publicSafeParameters: {
      modelId: "tinyrustlm/model-source-error",
      errorStage: "model-source-review",
      errorCode: "candidate_source_review_failed"
    },
    blockerCode: "candidate_source_review_failed"
  }));
  store.putReceipt(baseReceipt("browser-round", {
    receiptType: "tinyrustlm.browser-dogfood-round-v4",
    phase: "browser-dogfood-round",
    inputReceiptIds: [qualification.receiptId],
    inputHashes: { model: qualification.outputHashes.model },
    outputHashes: { rawConversation: digest("conversation") },
    publicSafeParameters: passingRoundParameters(),
    evidenceClass: "browser"
  }));
  store.putReceipt(baseReceipt("dogfood-round-v3", {
    receiptType: "tinyrustlm.dogfood-round-v3",
    phase: "dogfood-round",
    publicSafeParameters: { round: 2, modelId: "tinyrustlm/fixture" },
    evidenceClass: "fixture"
  }));
  store.putReceipt(baseReceipt("p2p-local-two-lane", {
    receiptType: "tinyrustlm.p2p-local-two-lane",
    phase: "p2p-local-health",
    publicSafeParameters: { localReachableEndpointCount: 2 },
    boundedDiagnostics: {
      externalBlockers: [
        "outside_network_observer_absent",
        "nineteen_additional_qualified_models_absent"
      ]
    }
  }));
  store.putReceipt(baseReceipt("memory-endpoints-contract-audit", {
    receiptType: "tinyrustlm.memory-endpoints-contract-audit-v1",
    phase: "memory-endpoints-contract-audit",
    status: "blocked",
    evidenceClass: "live-service",
    blockerCode: "memory_endpoints_live_contract_incompatible"
  }));

  const outputPath = path.join(root, "dashboard.json");
  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    outputPath,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.schema, "tinyrustlm.dogfood_campaign_dashboard.v9");
  assert.equal(validateDashboardHash(dashboard), true);
  assert.equal(dashboard.status, "incomplete");
  assert.equal(dashboard.progress.qualifiedModels.completed, 1);
  assert.equal(dashboard.progress.qualifiedModels.required, 20);
  assert.equal(dashboard.modelPortfolio.attemptedCandidates, 3);
  assert.equal(dashboard.modelPortfolio.convertedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.rejectedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.blockedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.sourceScreenRejectedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.sourceTaskScreenPassedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.sourceTaskScreenRejectedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.sourceReviewRejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.infrastructureFailures, 1);
  assert.equal(dashboard.modelPortfolio.sourceReviewFailures, 1);
  assert.equal(dashboard.modelPortfolio.distinctCandidateArtifacts, 2);
  assert.equal(dashboard.modelPortfolio.evaluator.currentBinarySha256,
    digest("tinyrustlm-eval-current"));
  assert.equal(dashboard.modelPortfolio.evaluator.currentCandidateCount, 1);
  assert.equal(dashboard.modelPortfolio.evaluator.staleCandidateCount, 0);
  assert.equal(dashboard.modelPortfolio.evaluator.coverageComplete, true);
  assert.equal(dashboard.modelPortfolio.evaluator.bestCurrentCasesPassed, 14);
  assert.equal(dashboard.modelPortfolio.evaluator.bestHistoricalCasesPassed, 14);
  assert.equal(dashboard.modelPortfolio.evaluator.expectedCaseCount, 14);
  assert.equal(dashboard.progress.cleanBrowserRounds.completed, 1);
  assert.equal(dashboard.progress.liveMemoryRounds.completed, 0);
  assert.equal(dashboard.progress.externallyProvenLanes.completed, 0);
  assert.equal(dashboard.progress.catalogAnnouncements.completed, 0);
  assert.equal(dashboard.progress.faultInjectionCases.completed, 0);
  assert.equal(dashboard.progress.faultInjectionCases.required, 24);
  assert.equal(dashboard.progress.faultInjectionCases.complete, false);
  assert.equal(dashboard.modelPortfolio.nonPromotableEvidence.fixtureQualifiedModels, 1);
  assert.equal(dashboard.modelPortfolio.nonPromotableEvidence.fixtureValidatedRounds, 1);
  assert.equal(dashboard.modelPortfolio.nonPromotableEvidence.locallyValidatedP2pRuns, 1);
  assert.equal(dashboard.modelPortfolio.nonPromotableEvidence.locallyReachableP2pEndpoints, 2);
  assert.ok(dashboard.activeBlockers.includes("memory_endpoints_live_contract_incompatible"));
  assert.ok(dashboard.activeBlockers.includes("outside_network_observer_absent"));
  assert.ok(dashboard.activeBlockers.includes("qualified_models_incomplete"));
  assert.ok(dashboard.activeBlockers.includes("fault_injection_campaign_incomplete"));
  assert.equal(dashboard.activeBlockers.includes("nineteen_additional_qualified_models_absent"), false);
  assert.equal(dashboard.currentOperation.state, "idle");
  assert.equal(dashboard.evidenceValidation.health, "healthy");
  assert.equal(dashboard.diskUsage.status, "measured");
  assert.equal(dashboard.rejectedModels[0].modelId, "LiquidAI/LFM2.5-350M");
  assert.equal(dashboard.retryQueues.waitingForExternalCondition.length, 1);
  assert.equal(dashboard.retryQueues.operatorDecisionRequired.length, 1);
  assert.match(formatCampaignDashboard(dashboard), /Qualified models: 1 \/ 20/);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), dashboard);
  assert.equal(fs.readdirSync(path.join(root, "dashboard-snapshots", "sha256",
    dashboard.dashboardContentSha256.slice(0, 2))).length, 1);
});

test("a current rejection supersedes and removes an old qualification pass", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-superseded-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const accepted = putQualification(store);
  putQualification(store, {
    status: "rejected",
    supersedesReceiptIds: [accepted.receiptId],
    configurationHash: digest("rejected-configuration")
  });
  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.progress.qualifiedModels.completed, 0);
  assert.equal(dashboard.rejectedModels.length, 1);
  assert.equal(dashboard.activeBlockers.includes("model_quality_rejected"), false);
});

test("later candidate decisions resolve transient errors without deleting history", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-recovered-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const rejectedModelId = "tinyrustlm/recovered-then-rejected";
  const qualifiedModelId = "tinyrustlm/recovered-and-qualified";
  const rejectedError = store.putReceipt(baseReceipt("model-qualification-error-rejected", {
    receiptType: "tinyrustlm.model-qualification-error",
    phase: "model-qualification",
    status: "fail",
    completedAtUtc: "2026-07-15T06:01:00.000Z",
    publicSafeParameters: { modelId: rejectedModelId },
    blockerCode: "candidate_qualification_infrastructure_failed"
  })).receipt;
  const qualifiedError = store.putReceipt(baseReceipt("model-qualification-error-qualified", {
    receiptType: "tinyrustlm.model-qualification-error",
    phase: "model-source-review",
    status: "fail",
    completedAtUtc: "2026-07-15T06:02:00.000Z",
    publicSafeParameters: { modelId: qualifiedModelId },
    blockerCode: "candidate_source_review_failed"
  })).receipt;
  putQualification(store, {
    modelId: rejectedModelId,
    status: "rejected",
    completedAtUtc: "2026-07-15T07:01:00.000Z"
  });
  putQualification(store, {
    modelId: qualifiedModelId,
    completedAtUtc: "2026-07-15T07:02:00.000Z"
  });

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });

  assert.equal(dashboard.evidenceValidation.retainedReceiptCount, 4);
  assert.equal(dashboard.evidenceValidation.currentReceiptCount, 4);
  assert.ok(store.readReceipt(rejectedError.receiptId));
  assert.ok(store.readReceipt(qualifiedError.receiptId));
  assert.equal(dashboard.modelPortfolio.infrastructureFailures, 0);
  assert.equal(dashboard.modelPortfolio.sourceReviewFailures, 0);
  assert.equal(dashboard.modelPortfolio.blockedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.rejectedCandidates, 1);
  assert.deepEqual(dashboard.rejectedModels[0].blockerCodes, ["model_quality_rejected"]);
  assert.equal(dashboard.activeBlockers.includes(
    "candidate_qualification_infrastructure_failed"), false);
  assert.equal(dashboard.activeBlockers.includes("candidate_source_review_failed"), false);
  assert.equal(dashboard.retryQueues.operatorDecisionRequired.length, 0);
});

test("a typed source review rejection closes an earlier review retry", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-source-rejected-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const modelId = "tinyrustlm/incompatible-source";
  store.putReceipt(baseReceipt("model-source-review-error", {
    receiptType: "tinyrustlm.model-qualification-error",
    phase: "model-source-review",
    status: "fail",
    completedAtUtc: "2026-07-15T06:00:00.000Z",
    publicSafeParameters: { modelId },
    blockerCode: "candidate_source_review_failed"
  }));
  store.putReceipt(baseReceipt("model-source-review-rejection", {
    receiptType: "tinyrustlm.model-source-review-v1",
    phase: "model-source-review",
    status: "rejected",
    completedAtUtc: "2026-07-15T07:00:00.000Z",
    outputHashes: { review: digest("source-review-rejection") },
    publicSafeParameters: {
      modelId,
      rejectionCode: "tied-output-payload-mismatch"
    },
    blockerCode: "candidate_source_tensor_contract_rejected"
  }));

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });

  assert.equal(dashboard.modelPortfolio.rejectedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.blockedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.infrastructureFailures, 0);
  assert.equal(dashboard.modelPortfolio.sourceReviewFailures, 0);
  assert.equal(dashboard.modelPortfolio.sourceReviewRejectedCandidates, 1);
  assert.equal(dashboard.activeBlockers.includes("candidate_source_review_failed"), false);
  assert.equal(dashboard.activeBlockers.includes(
    "candidate_source_tensor_contract_rejected"), false);
  assert.equal(dashboard.retryQueues.operatorDecisionRequired.length, 0);
});

test("does not double count a source screen followed by model qualification", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-screened-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  putSourceScreen(store, { modelId: "tinyrustlm/model-a", status: "pass" });
  putQualification(store);

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.modelPortfolio.attemptedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.convertedCandidates, 1);
  assert.equal(dashboard.modelPortfolio.rejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.sourceScreenRejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.sourceReviewRejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.distinctCandidateArtifacts, 1);
  assert.equal(dashboard.activeBlockers.includes("model_quality_rejected"), false);
});

test("uses only the newest evaluator cohort for current quality counts", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-evaluator-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const oldEvaluator = digest("tinyrustlm-eval-old");
  const currentEvaluator = digest("tinyrustlm-eval-new");
  putQualification(store, {
    modelId: "tinyrustlm/model-old",
    status: "rejected",
    casesPassed: 5,
    evaluatorSha256: oldEvaluator,
    completedAtUtc: "2026-07-15T06:01:00.000Z"
  });
  putQualification(store, {
    modelId: "tinyrustlm/model-current",
    status: "rejected",
    casesPassed: 1,
    evaluatorSha256: currentEvaluator,
    completedAtUtc: "2026-07-15T07:01:00.000Z"
  });

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.modelPortfolio.evaluator.currentBinarySha256, currentEvaluator);
  assert.equal(dashboard.modelPortfolio.evaluator.currentCandidateCount, 1);
  assert.equal(dashboard.modelPortfolio.evaluator.staleCandidateCount, 1);
  assert.equal(dashboard.modelPortfolio.evaluator.coverageComplete, false);
  assert.equal(dashboard.modelPortfolio.evaluator.bestCurrentCasesPassed, 1);
  assert.equal(dashboard.modelPortfolio.evaluator.bestHistoricalCasesPassed, 5);
  assert.ok(dashboard.activeBlockers.includes("candidate_evaluator_coverage_incomplete"));
});

test("an empty evidence store remains an honest zero-count report", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-empty-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.progress.qualifiedModels.completed, 0);
  assert.equal(dashboard.modelPortfolio.attemptedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.convertedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.rejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.sourceScreenRejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.sourceReviewRejectedCandidates, 0);
  assert.equal(dashboard.modelPortfolio.infrastructureFailures, 0);
  assert.equal(dashboard.modelPortfolio.sourceReviewFailures, 0);
  assert.equal(dashboard.modelPortfolio.distinctCandidateArtifacts, 0);
  assert.equal(dashboard.modelPortfolio.evaluator.currentBinarySha256, null);
  assert.equal(dashboard.modelPortfolio.evaluator.currentCandidateCount, 0);
  assert.equal(dashboard.modelPortfolio.evaluator.staleCandidateCount, 0);
  assert.equal(dashboard.modelPortfolio.evaluator.coverageComplete, false);
  assert.equal(dashboard.modelPortfolio.evaluator.bestCurrentCasesPassed, 0);
  assert.equal(dashboard.modelPortfolio.evaluator.bestHistoricalCasesPassed, 0);
  assert.equal(dashboard.modelPortfolio.evaluator.expectedCaseCount, 0);
  assert.equal(dashboard.progress.cleanBrowserRounds.completed, 0);
  assert.equal(dashboard.progress.liveMemoryRounds.completed, 0);
  assert.equal(dashboard.progress.externallyProvenLanes.completed, 0);
  assert.equal(dashboard.progress.catalogAnnouncements.completed, 0);
  assert.equal(dashboard.releaseGates.browserAcceptance.passed, false);
  assert.equal(dashboard.releaseGates.packages.passed, false);
  assert.equal(dashboard.releaseGates.nativeRids.executed, 0);
  assert.equal(dashboard.releaseGates.nativeRids.verified, 0);
  assert.deepEqual(dashboard.releaseGates.nativeRids.verifiedRids, []);
  assert.equal(dashboard.releaseGates.nativeRids.physicalLinuxArm64Verified, false);
  assert.equal(dashboard.releaseGates.nativeRids.passed, false);
  assert.equal(dashboard.releaseGates.packagedPublicSite.passed, false);
  assert.equal(dashboard.releaseGates.publicHttpsReadback.passed, false);
  assert.equal(dashboard.releaseGates.secretScan.passed, false);
  assert.equal(dashboard.releaseGates.faultInjection.passed, false);
  assert.equal(dashboard.releaseGates.faultInjection.satisfiedFaultCount, 0);
  assert.equal(dashboard.currentOperation.state, "idle");
  assert.equal(dashboard.timing.campaignStartedAtUtc, null);
  assert.equal(dashboard.timing.elapsedMilliseconds, 0);
  assert.equal(dashboard.timing.lastDurableCheckpoint, null);
  assert.equal(dashboard.resumable, true);
});

test("does not count emulated ARM64 execution as a completed native RID gate", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-arm64-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  store.putReceipt(baseReceipt("native-rid-verification-v1", {
    receiptType: "tinyrustlm.native-rid-verification-v1",
    phase: "native-rid-verification",
    status: "blocked",
    blockerCode: "physical_linux_arm64_hardware_evidence_absent",
    evidenceClass: "target-platform",
    hardwareEvidence: {
      execution: [
        {
          rid: "win-x64",
          executed: true,
          emulated: false,
          physicalHardware: true
        },
        {
          rid: "linux-x64",
          executed: true,
          emulated: false,
          physicalHardware: true
        },
        {
          rid: "linux-arm64",
          executed: true,
          emulated: true,
          physicalHardware: false
        }
      ],
      physicalLinuxArm64Executed: false
    },
    publicSafeParameters: {
      executedRidCount: 3,
      physicalLinuxArm64Executed: false,
      requiredNativeRidCount: 3
    }
  }));

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.releaseGates.nativeRids.executed, 3);
  assert.equal(dashboard.releaseGates.nativeRids.verified, 2);
  assert.deepEqual(dashboard.releaseGates.nativeRids.verifiedRids,
    ["win-x64", "linux-x64"]);
  assert.equal(dashboard.releaseGates.nativeRids.passed, false);
  assert.deepEqual(dashboard.progress.nativeRidGates, {
    completed: 2,
    required: 3,
    complete: false
  });
  assert.match(formatCampaignDashboard(dashboard), /Native RID gates: 2 \/ 3/u);
  assert.ok(dashboard.activeBlockers.includes(
    "physical_linux_arm64_hardware_evidence_absent"
  ));
});

test("requires the canonical plan and all 24 attempt parents for the fault gate", (context) => {
  const selfAssertedRoot = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-dashboard-fault-self-asserted-"));
  const completeRoot = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-dashboard-fault-complete-"));
  const invalidBrowserRoot = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-dashboard-fault-browser-invalid-"));
  context.after(() => {
    fs.rmSync(selfAssertedRoot, { recursive: true, force: true });
    fs.rmSync(completeRoot, { recursive: true, force: true });
    fs.rmSync(invalidBrowserRoot, { recursive: true, force: true });
  });
  const plan = loadFaultPlan();
  const reportSha256 = digest("self-asserted-fault-report");
  const selfAssertedStore = new CampaignEvidenceStore(selfAssertedRoot);
  selfAssertedStore.putReceipt(baseReceipt("fault-injection-report-v1", {
    receiptType: reportReceiptType,
    phase: "fault-injection-report",
    outputHashes: { faultReport: reportSha256 },
    publicSafeParameters: {
      planId: plan.value.planId,
      planSha256: plan.planSha256,
      plannedFaultCount: 24,
      executedFaultCount: 24,
      satisfiedFaultCount: 24,
      incompleteFaultCount: 0,
      allRequiredFaultsSatisfied: true
    },
    boundedDiagnostics: { incompleteFaultIds: [] },
    evidenceClass: "local",
    attestationReference: `sha256:${reportSha256}`
  }));

  const rejected = buildCampaignDashboard({
    campaignId,
    evidenceRoot: selfAssertedRoot,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(rejected.releaseGates.faultInjection.passed, false);
  assert.equal(rejected.releaseGates.faultInjection.parentEvidenceValid, false);
  assert.equal(rejected.progress.faultInjectionCases.completed, 0);
  assert.ok(rejected.activeBlockers.includes("fault_injection_campaign_incomplete"));

  const completeStore = new CampaignEvidenceStore(completeRoot);
  const completeEvidence = putCompleteFaultCampaign(completeStore);
  const accepted = buildCampaignDashboard({
    campaignId,
    evidenceRoot: completeRoot,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(accepted.releaseGates.faultInjection.passed, true);
  assert.equal(accepted.releaseGates.faultInjection.parentEvidenceValid, true);
  assert.equal(accepted.releaseGates.faultInjection.reportClaimsValid, true);
  assert.equal(accepted.releaseGates.faultInjection.receiptId, completeEvidence.report.receiptId);
  assert.equal(accepted.progress.faultInjectionCases.completed, 24);
  assert.equal(accepted.progress.faultInjectionCases.complete, true);
  assert.equal(accepted.activeBlockers.includes("fault_injection_campaign_incomplete"), false);

  const invalidBrowserStore = new CampaignEvidenceStore(invalidBrowserRoot);
  putCompleteFaultCampaign(invalidBrowserStore, { invalidateBrowserAttempt: true });
  const browserRejected = buildCampaignDashboard({
    campaignId,
    evidenceRoot: invalidBrowserRoot,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(browserRejected.releaseGates.faultInjection.passed, false);
  assert.equal(browserRejected.releaseGates.faultInjection.parentEvidenceValid, false);
  assert.equal(browserRejected.progress.faultInjectionCases.complete, false);
  assert.ok(browserRejected.activeBlockers.includes("fault_injection_campaign_incomplete"));
});

test("reports local release gates but rejects a self-asserted legacy HTTPS receipt", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-gates-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  store.putReceipt(baseReceipt("browser-acceptance-verification-v1", {
    receiptType: "tinyrustlm.browser-acceptance-verification-v1",
    phase: "browser-acceptance-verification",
    evidenceClass: "browser",
    publicSafeParameters: { campaignDogfoodRoundCount: 0 }
  }));
  store.putReceipt(baseReceipt("package-verification-v1", {
    receiptType: "tinyrustlm.package-verification-v1",
    phase: "package-verification",
    evidenceClass: "package",
    inputHashes: { packageAudit: digest("release-package-audit") },
    outputHashes: { packageAudit: digest("release-package-audit") },
    hardwareEvidence: { packageConsumerExecution: true },
    publicSafeParameters: {
      packageAuditPassed: true,
      packageCount: 4,
      packageVersion: "0.1.8",
      symbolPackageCount: 4
    }
  }));
  store.putReceipt(baseReceipt("native-rid-verification-v1", {
    receiptType: "tinyrustlm.native-rid-verification-v1",
    phase: "native-rid-verification",
    evidenceClass: "target-platform",
    hardwareEvidence: {
      execution: [
        {
          rid: "win-x64",
          executed: true,
          emulated: false,
          physicalHardware: true
        },
        {
          rid: "linux-x64",
          executed: true,
          emulated: false,
          physicalHardware: true
        },
        {
          rid: "linux-arm64",
          executed: true,
          emulated: false,
          physicalHardware: true
        }
      ]
    },
    publicSafeParameters: {
      executedRidCount: 3,
      physicalLinuxArm64Executed: true,
      requiredNativeRidCount: 3
    }
  }));
  store.putReceipt(baseReceipt("packaged-public-site-verification-v1", {
    receiptType: "tinyrustlm.packaged-public-site-verification-v1",
    phase: "packaged-public-site-verification",
    publicSafeParameters: { packagedPublicSiteVerified: true, publicHttpsReadback: false }
  }));
  store.putReceipt(baseReceipt("public-catalog-readback-v1", {
    receiptType: "tinyrustlm.public-catalog-readback-v1",
    phase: "public-catalog-readback",
    evidenceClass: "deployment",
    publicSafeParameters: { finalReleaseReadbackPassed: true, publicHttpsReadback: true }
  }));
  store.putReceipt(baseReceipt("secret-scan-v2", {
    receiptType: "tinyrustlm.secret-scan-v2",
    phase: "secret-scan",
    evidenceClass: "package",
    publicSafeParameters: {
      scannedArtifactCount: 12,
      secretFindingCount: 0,
      scopeComplete: true,
      scopeKind: "campaign-public-release"
    }
  }));

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.progress.cleanBrowserRounds.completed, 0);
  assert.equal(dashboard.releaseGates.browserAcceptance.passed, true);
  assert.equal(dashboard.releaseGates.packages.passed, true);
  assert.equal(dashboard.releaseGates.nativeRids.executed, 3);
  assert.equal(dashboard.releaseGates.nativeRids.verified, 3);
  assert.deepEqual(dashboard.releaseGates.nativeRids.verifiedRids,
    ["win-x64", "linux-x64", "linux-arm64"]);
  assert.equal(dashboard.releaseGates.nativeRids.physicalLinuxArm64Verified, true);
  assert.equal(dashboard.releaseGates.nativeRids.passed, true);
  assert.equal(dashboard.releaseGates.packagedPublicSite.passed, true);
  assert.equal(dashboard.releaseGates.publicHttpsReadback.passed, false);
  assert.ok(dashboard.activeBlockers.includes("public_https_readback_incomplete"));
  assert.equal(dashboard.releaseGates.secretScan.passed, false);
  assert.equal(dashboard.status, "incomplete");
});

test("a newer package fault receipt cannot shadow release package verification", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-package-gate-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const packageAudit = digest("package-audit");
  const release = store.putReceipt(baseReceipt("package-release-verification-v1", {
    receiptType: "tinyrustlm.package-verification-v1",
    phase: "package-verification",
    evidenceClass: "package",
    inputHashes: { packageAudit },
    outputHashes: { packageAudit },
    hardwareEvidence: { packageConsumerExecution: true },
    publicSafeParameters: {
      packageAuditPassed: true,
      packageCount: 4,
      packageVersion: "0.1.8",
      symbolPackageCount: 4
    }
  })).receipt;
  store.putReceipt(baseReceipt("package-fault-domain-v1", {
    receiptType: "tinyrustlm.package-verification-v1",
    phase: "fault-domain-evidence",
    status: "blocked",
    createdAtUtc: "2026-07-15T07:00:00.000Z",
    completedAtUtc: "2026-07-15T07:01:00.000Z",
    evidenceClass: "package",
    publicSafeParameters: { faultId: "package-restore-drift" }
  }));

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.releaseGates.packages.passed, true);
  assert.equal(dashboard.releaseGates.packages.receiptId, release.receiptId);
  assert.equal(dashboard.activeBlockers.includes("package_verification_incomplete"), false);
});

test("does not accept an old or incomplete secret-scan scope", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-secret-scope-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  store.putReceipt(baseReceipt("secret-scan-v1", {
    receiptType: "tinyrustlm.secret-scan-v1",
    phase: "secret-scan",
    evidenceClass: "package",
    publicSafeParameters: { scannedArtifactCount: 1000, secretFindingCount: 0 }
  }));
  store.putReceipt(baseReceipt("secret-scan-v2", {
    receiptType: "tinyrustlm.secret-scan-v2",
    phase: "secret-scan",
    evidenceClass: "package",
    completedAtUtc: "2026-07-15T07:01:00.000Z",
    publicSafeParameters: {
      scannedArtifactCount: 1000,
      secretFindingCount: 0,
      scopeComplete: false,
      scopeKind: "campaign-public-release"
    }
  }));

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(dashboard.releaseGates.secretScan.passed, false);
  assert.ok(dashboard.activeBlockers.includes("secret_scan_incomplete"));
});

test("binds the secret-scan gate to the recomputed current publishable scope", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-bound-scope-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const artifact of staticArtifacts) writeWorkspaceFile(root, artifact.relativePath);
  fs.mkdirSync(path.join(root, "artifacts", "packages"), { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts", "releases"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "report-intake", "2026-07-15",
    "liquid-edge-research"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "report-intake", "2026-07-15",
    "deeper-small-model-research"), { recursive: true });
  const evidenceRoot = path.join(root, "artifacts", "reports", "evidence");
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const manifest = buildCampaignPublicArtifactManifest({ workspaceRoot: root, evidenceRoot });
  const store = new CampaignEvidenceStore(evidenceRoot);
  store.putReceipt(baseReceipt("secret-scan-v2", {
    receiptType: "tinyrustlm.secret-scan-v2",
    phase: "secret-scan",
    evidenceClass: "package",
    inputHashes: { scopeManifest: manifest.scopeManifestSha256 },
    outputHashes: {
      scanReport: digest("scan-report"),
      scopeManifest: manifest.scopeManifestSha256
    },
    publicSafeParameters: {
      scannedArtifactCount: manifest.artifactCount,
      secretFindingCount: 0,
      scopeComplete: true,
      scopeKind: "campaign-public-release"
    }
  }));

  const accepted = buildCampaignDashboard({
    campaignId,
    evidenceRoot,
    workspaceRoot: root,
    generatedAtUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(accepted.evidenceValidation.publicArtifactScope.status, "validated");
  assert.equal(accepted.releaseGates.secretScan.passed, true);

  writeWorkspaceFile(root, staticArtifacts[0].relativePath, "changed after scan\n");
  const stale = buildCampaignDashboard({
    campaignId,
    evidenceRoot,
    workspaceRoot: root,
    generatedAtUtc: "2026-07-15T08:01:00.000Z"
  });
  assert.equal(stale.releaseGates.secretScan.passed, false);
  assert.ok(stale.activeBlockers.includes("secret_scan_incomplete"));
});

test("counts only current complete-transfer v1 proofs bound to qualification", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-proof-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const qualification = putQualification(store);
  store.putReceipt(baseReceipt("p2p-outside-reachability-v0", {
    receiptType: "tinyrustlm.p2p-outside-reachability-v0",
    phase: "p2p-outside-reachability-sample",
    inputReceiptIds: [qualification.receiptId],
    evidenceClass: "outside-network",
    publicSafeParameters: {
      modelId: "tinyrustlm/model-a",
      laneId: "seed-a",
      publicReachabilityProven: true,
      observerSignatureVerified: true,
      completeTransferVerified: false,
      expiresAtUtc: "2026-07-15T08:50:00.000Z"
    }
  }));
  store.putReceipt(baseReceipt("p2p-outside-proof-v1", {
    receiptType: "tinyrustlm.p2p-outside-proof-v1",
    phase: "p2p-outside-complete-transfer-proof",
    inputReceiptIds: [qualification.receiptId],
    inputHashes: { model: qualification.outputHashes.model },
    outputHashes: {
      artifact: qualification.outputHashes.model,
      pieceSet: digest("piece-set"),
      rustInspection: digest("rust-inspection"),
      signaturePayload: digest("signature-payload")
    },
    evidenceClass: "outside-network",
    publicSafeParameters: {
      modelId: "tinyrustlm/model-a",
      artifactSha256: qualification.outputHashes.model,
      laneId: "seed-a",
      externalReceiptVersion: 1,
      publicReachabilityProven: true,
      observerSignatureVerified: true,
      completeTransferVerified: true,
      downloadedPieceCount: 2,
      downloadedArtifactByteCount: 1500000,
      checkedRouteCount: 5,
      expiresAtUtc: "2026-07-15T08:50:00.000Z"
    }
  }));

  const current = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T08:00:00.000Z"
  });
  assert.equal(current.progress.externallyProvenLanes.completed, 1);
  assert.equal(current.proofExpiryWarnings.length, 1);
  assert.equal(current.proofExpiryWarnings[0].status, "expiring");

  const expired = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedUtc: "2026-07-15T09:00:00.000Z"
  });
  assert.equal(expired.progress.externallyProvenLanes.completed, 0);
  assert.equal(expired.proofExpiryWarnings[0].status, "expired");
  assert.ok(expired.activeBlockers.includes("outside_proof_expired"));
});

test("derives a running operation from a durable start and closes it with a finish", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-operation-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const start = putOperationStart(store, "screen-001", "2026-07-15T06:00:00.000Z");

  const running = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-15T06:05:00.000Z"
  });
  assert.equal(running.currentOperation.state, "running");
  assert.equal(running.currentOperation.operationId, "screen-001");
  assert.equal(running.currentOperation.startReceiptId, start.receiptId);
  assert.equal(running.timing.elapsedMilliseconds, 5 * 60 * 1000);
  assert.equal(running.timing.lastDurableCheckpoint.receiptId, start.receiptId);

  const finish = putOperationFinish(store, start, "2026-07-15T06:06:00.000Z");
  const finished = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-15T06:07:00.000Z"
  });
  assert.equal(finished.currentOperation.state, "idle");
  assert.equal(finished.timing.lastDurableCheckpoint.receiptId, finish.receiptId);
  assert.equal(finished.evidenceValidation.health, "healthy");
});

test("refuses resumability when two durable operations are simultaneously active", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-dashboard-conflict-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  putOperationStart(store, "screen-001", "2026-07-15T06:00:00.000Z");
  putOperationStart(store, "screen-002", "2026-07-15T06:01:00.000Z");

  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: root,
    generatedAtUtc: "2026-07-15T06:05:00.000Z"
  });
  assert.equal(dashboard.currentOperation.state, "conflict");
  assert.equal(dashboard.currentOperation.conflictingOperationCount, 2);
  assert.equal(dashboard.evidenceValidation.health, "invalid");
  assert.equal(dashboard.resumable, false);
  assert.ok(dashboard.activeBlockers.includes("campaign_evidence_validation_failed"));
});
