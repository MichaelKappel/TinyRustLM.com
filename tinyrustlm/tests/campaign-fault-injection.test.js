"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  attemptReceiptType,
  attemptSatisfiesFault,
  builtInExecutors,
  inspectFaultCampaignEvidence,
  loadFaultPlan,
  parseArguments,
  planReceiptType,
  reportReceiptType,
  reportSchema,
  requiredFaultIds,
  runSafeLocalFaults
} = require("../tools/campaign-fault-injection.js");

const campaignId = "fault-injection-test-20260715";
const sourceRevision = "a".repeat(40);
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

function setup(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-fault-campaign-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    options: {
      campaignId,
      evidenceRoot: path.join(root, "evidence"),
      reportOutputPath: path.join(root, "reports", "fault-report.json"),
      sourceRevision
    }
  };
}

function inputFromReceipt(receipt) {
  const result = { ...receipt };
  delete result.schemaVersion;
  delete result.receiptId;
  delete result.receiptContentHash;
  return result;
}

test("validates exactly the 24 required fault policies", () => {
  const plan = loadFaultPlan();
  assert.equal(plan.value.faults.length, 24);
  assert.deepEqual(plan.value.faults.map((fault) => fault.faultId).sort(),
    [...requiredFaultIds].sort());
  assert.match(plan.planSha256, /^[a-f0-9]{64}$/);
  assert.match(plan.fileSha256, /^[a-f0-9]{64}$/);
  for (const fault of plan.value.faults) {
    assert.ok(["Blocked", "Rejected"].includes(fault.expectedTransition.toState));
    assert.ok(fault.cleanupActions.length > 0);
    assert.ok(fault.recoveryEvidence.length > 0);
    assert.equal(fault.retryPolicy.allowed || fault.retryPolicy.maxRetries === 0, true);
    assert.match(fault.terminalCondition, /^[a-z0-9][a-z0-9.-]+$/);
  }
  assert.deepEqual(Object.keys(builtInExecutors).sort(),
    [
      "corrupt-model",
      "corrupted-piece",
      "disk-full",
      "lane-process-death",
      "network-loss",
      "p2p-peer-disappearance",
      "process-crash",
      "receipt-write-power-loss",
      "truncated-model"
    ]);
});

test("rejects unknown fields and a missing required fault", (context) => {
  const { root } = setup(context);
  const source = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../campaign-fault-plan.v1.json"), "utf8"));
  source.faults[0].mutablePassed = true;
  const unknownPath = path.join(root, "unknown.json");
  fs.writeFileSync(unknownPath, JSON.stringify(source));
  assert.throws(() => loadFaultPlan(unknownPath), /unknown field mutablePassed/i);

  delete source.faults[0].mutablePassed;
  source.faults.pop();
  const missingPath = path.join(root, "missing.json");
  fs.writeFileSync(missingPath, JSON.stringify(source));
  assert.throws(() => loadFaultPlan(missingPath), /every required fault/i);
});

test("executes portable local faults with independent domain evidence", (context) => {
  const { options } = setup(context);
  const result = runSafeLocalFaults(options);
  assert.equal(result.planReceipt.receiptType, planReceiptType);
  assert.equal(result.attempts.length, 9);
  assert.equal(result.attempts.every((receipt) => receipt.receiptType === attemptReceiptType &&
    receipt.status === "pass" && receipt.evidenceClass === "local"), true);
  assert.deepEqual(result.attempts.map((receipt) => receipt.publicSafeParameters.faultId).sort(),
    [
      "corrupt-model",
      "corrupted-piece",
      "disk-full",
      "lane-process-death",
      "network-loss",
      "p2p-peer-disappearance",
      "process-crash",
      "receipt-write-power-loss",
      "truncated-model"
    ]);
  assert.deepEqual(result.unavailableLocalFaultIds, ["invalid-tensor-offset"]);
  const receipts = new CampaignEvidenceStore(options.evidenceRoot).listReceipts();
  const receiptById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  for (const attempt of result.attempts) {
    assert.equal(attempt.inputReceiptIds.length, 2);
    assert.equal(attempt.inputReceiptIds[0], result.planReceipt.receiptId);
    const domain = receiptById.get(attempt.inputReceiptIds[1]);
    const fault = result.plan.faultsById.get(attempt.publicSafeParameters.faultId);
    assert.ok(domain);
    assert.equal(domain.receiptType, fault.expectedDomainReceiptType);
    assert.equal(domain.status, fault.expectedStatus);
    assert.equal(domain.evidenceClass, fault.requiredEvidenceClass);
    assert.equal(domain.blockerCode, null);
    assert.equal(domain.publicSafeParameters.faultId, fault.faultId);
    assert.equal(attempt.publicSafeParameters.domainReceiptId, domain.receiptId);
    assert.equal(attemptSatisfiesFault(attempt, fault, result.plan,
      receiptById, result.planReceipt), true);
  }
  assert.equal(result.receipt.receiptType, reportReceiptType);
  assert.equal(result.receipt.status, "blocked");
  assert.equal(result.receipt.blockerCode, "fault_injection_campaign_incomplete");
  assert.equal(result.report.schema, reportSchema);
  assert.equal(result.report.plannedFaultCount, 24);
  assert.equal(result.report.executedFaultCount, 9);
  assert.equal(result.report.satisfiedFaultCount, 9);
  assert.equal(result.report.incompleteFaultCount, 15);
  assert.equal(result.report.cases.find((item) => item.faultId === "host-restart").satisfied, false);
  assert.equal(result.report.cases.find((item) =>
    item.faultId === "invalid-tensor-offset").satisfied, false);
  assert.equal(result.report.cases.find((item) =>
    item.faultId === "package-restore-drift").satisfied, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(options.reportOutputPath, "utf8")), result.report);
  const inspection = inspectFaultCampaignEvidence(
    receipts);
  assert.equal(inspection.passed, false);
  assert.equal(inspection.plannedFaultCount, 24);
  assert.equal(inspection.executedFaultCount, 9);
  assert.equal(inspection.satisfiedFaultCount, 9);
  assert.equal(inspection.incompleteFaultCount, 15);
  assert.equal(inspection.reportClaimsValid, false);
  assert.ok(inspection.reasons.includes("fault_attempt_parent_set_incomplete"));

  const repeated = runSafeLocalFaults(options);
  assert.equal(repeated.planReceipt.receiptId, result.planReceipt.receiptId);
  assert.deepEqual(repeated.attempts.map((receipt) => receipt.receiptId),
    result.attempts.map((receipt) => receipt.receiptId));
  assert.equal(repeated.receipt.receiptId, result.receipt.receiptId);
});

test("rejects a fault attempt without its matching domain receipt parent", (context) => {
  const { options } = setup(context);
  const result = runSafeLocalFaults(options);
  const receipts = new CampaignEvidenceStore(options.evidenceRoot).listReceipts();
  const receiptById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  const attempt = result.attempts.find((receipt) =>
    receipt.publicSafeParameters.faultId === "process-crash");
  const fault = result.plan.faultsById.get("process-crash");
  assert.equal(attemptSatisfiesFault(attempt, fault, result.plan,
    receiptById, result.planReceipt), true);
  assert.equal(attemptSatisfiesFault({
    ...attempt,
    inputReceiptIds: [result.planReceipt.receiptId]
  }, fault, result.plan, receiptById, result.planReceipt), false);
});

test("does not let fixture evidence satisfy a target-platform fault", (context) => {
  const { options } = setup(context);
  const initial = runSafeLocalFaults(options);
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const processAttempt = initial.attempts.find((receipt) =>
    receipt.publicSafeParameters.faultId === "process-crash");
  const plan = initial.plan.faultsById.get("host-restart");
  const fake = inputFromReceipt(processAttempt);
  fake.attempt = 1;
  fake.configurationHash = digest("fixture-host-restart");
  fake.evidenceClass = "fixture";
  fake.publicSafeParameters = {
    ...processAttempt.publicSafeParameters,
    faultId: plan.faultId,
    requiredEvidenceClass: plan.requiredEvidenceClass,
    executionMode: plan.executionMode,
    expectedTransition: plan.expectedTransition,
    actualTransition: plan.expectedTransition,
    expectedDomainReceiptType: plan.expectedDomainReceiptType,
    expectedStatus: plan.expectedStatus
  };
  store.putReceipt(fake);

  const updated = runSafeLocalFaults(options);
  assert.equal(updated.report.executedFaultCount, 10);
  assert.equal(updated.report.satisfiedFaultCount, 9);
  const host = updated.report.cases.find((item) => item.faultId === "host-restart");
  assert.equal(host.observedEvidenceClass, "fixture");
  assert.equal(host.satisfied, false);
});

test("requires a retained preparation receipt and actual restart hardware claims", (context) => {
  const { options } = setup(context);
  const initial = runSafeLocalFaults(options);
  const fault = initial.plan.faultsById.get("host-restart");
  const preparationReceiptId = `sha256:${digest("host-preparation")}`;
  const domainReceiptId = `sha256:${digest("host-domain")}`;
  const approvalRequestId = digest("host-approval");
  const checkpointSha256 = digest("host-checkpoint");
  const preRestartReceiptSetSha256 = digest("pre-restart-receipts");
  const sentinelMarkerSha256 = digest("restart-sentinel");
  const operatorApprovalReferenceSha256 = digest(`operator-approved:${approvalRequestId}`);
  const outputHashes = {
    approvalRequest: approvalRequestId,
    preRestartCheckpoint: checkpointSha256,
    preRestartReceiptSet: preRestartReceiptSetSha256,
    postRestartReceiptSet: digest("post-restart-receipts"),
    bootIdentityBefore: digest("boot-before"),
    bootIdentityAfter: digest("boot-after"),
    stableHostIdentity: digest("stable-host"),
    sentinelMarker: sentinelMarkerSha256,
    postRestartVerification: digest("host-restart-verification")
  };
  const restartHardware = {
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
  };
  const preparation = {
    receiptId: preparationReceiptId,
    receiptType: "tinyrustlm.host-restart-preparation-v1",
    phase: "fault-host-restart-preparation",
    status: "pass",
    evidenceClass: "target-platform",
    inputReceiptIds: [initial.planReceipt.receiptId],
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
      faultId: "host-restart",
      planId: initial.plan.value.planId,
      planSha256: initial.plan.planSha256,
      approvalRequestId,
      preRestartReceiptSetSha256,
      expectedTransition: fault.expectedTransition,
      operatorApprovalReferenceSha256
    },
    attestationReference: `sha256:${operatorApprovalReferenceSha256}`
  };
  const domain = {
    receiptId: domainReceiptId,
    receiptContentHash: digest("host-domain-content"),
    receiptType: fault.expectedDomainReceiptType,
    status: fault.expectedStatus,
    evidenceClass: fault.requiredEvidenceClass,
    inputReceiptIds: [initial.planReceipt.receiptId, preparationReceiptId],
    inputHashes: { prerequisiteReceiptSet: digest(JSON.stringify([preparationReceiptId])) },
    outputHashes,
    hardwareEvidence: restartHardware,
    publicSafeParameters: {
      faultId: fault.faultId,
      planId: initial.plan.value.planId,
      planSha256: initial.plan.planSha256,
      requiredEvidenceClass: fault.requiredEvidenceClass,
      executionMode: fault.executionMode,
      actualTransition: fault.expectedTransition,
      cleanupActions: fault.cleanupActions,
      cleanupVerified: true,
      recoveryEvidence: fault.recoveryEvidence,
      recoveryEvidenceVerified: true,
      prerequisiteReceiptIds: [preparationReceiptId],
      terminalCondition: fault.terminalCondition
    }
  };
  const attempt = {
    receiptId: `sha256:${digest("host-attempt")}`,
    receiptType: attemptReceiptType,
    status: "pass",
    evidenceClass: fault.requiredEvidenceClass,
    inputReceiptIds: [initial.planReceipt.receiptId, domainReceiptId],
    inputHashes: { domainEvidence: domain.receiptContentHash },
    outputHashes,
    hardwareEvidence: restartHardware,
    publicSafeParameters: {
      faultId: fault.faultId,
      planSha256: initial.plan.planSha256,
      requiredEvidenceClass: fault.requiredEvidenceClass,
      executionMode: fault.executionMode,
      expectedTransition: fault.expectedTransition,
      actualTransition: fault.expectedTransition,
      expectedDomainReceiptType: fault.expectedDomainReceiptType,
      expectedStatus: fault.expectedStatus,
      domainReceiptId,
      containmentObserved: true,
      cleanupVerified: true,
      recoveryEvidenceVerified: true,
      externalPrerequisitesSatisfied: true,
      releaseSatisfyingEvidence: true
    }
  };
  const receiptById = new Map([
    [domainReceiptId, domain],
    [preparationReceiptId, preparation]
  ]);

  assert.equal(attemptSatisfiesFault(attempt, fault, initial.plan,
    receiptById, initial.planReceipt), true);
  assert.equal(attemptSatisfiesFault(attempt, fault, initial.plan,
    new Map([[domainReceiptId, domain]]), initial.planReceipt), false);
  assert.equal(attemptSatisfiesFault({
    ...attempt,
    hardwareEvidence: { ...restartHardware, injectedFixtureEvidence: true }
  }, fault, initial.plan, receiptById, initial.planReceipt), false);
});

test("rejects caller attempts to inject arbitrary result fields", (context) => {
  const { options } = setup(context);
  assert.throws(() => runSafeLocalFaults({ ...options, allFaultsPassed: true }),
    /unknown fault option/i);
});

test("parses only arguments owned by the selected fault runner", () => {
  const common = [
    "--campaign-id", campaignId,
    "--evidence-root", "evidence",
    "--report-output", "report.json",
    "--source-revision", sourceRevision
  ];
  const local = parseArguments(["run-safe-local", ...common]);
  assert.equal(Object.hasOwn(local, "slmPackPath"), false);
  assert.equal(Object.hasOwn(local, "chromiumPath"), false);
  assert.equal(Object.hasOwn(local, "profileParent"), false);

  const browser = parseArguments([
    "run-browser", ...common, "--chromium", "chromium", "--profile-parent", "profiles"
  ]);
  assert.equal(Object.hasOwn(browser, "chromiumPath"), true);
  assert.equal(Object.hasOwn(browser, "profileParent"), true);
  assert.equal(Object.hasOwn(browser, "slmPackPath"), false);
  assert.equal(Object.hasOwn(browser, "modelFixturePath"), false);

  assert.throws(() => parseArguments([
    "run-package", ...common, "--dotnet", "dotnet", "--package-source", "packages",
    "--model-fixture", "model.slm", "--composition-fixture", "composition.acg1",
    "--work-parent", "work"
  ]), /fault command is unsupported/);
  for (const flag of ["--slm-pack", "--model-fixture"]) {
    assert.throws(() => parseArguments(["run-safe-local", ...common, flag, "retired"]),
      /unknown run-safe-local fault argument/);
  }

  const request = parseArguments([
    "request-host-restart",
    "--campaign-id", campaignId,
    "--evidence-root", "evidence",
    "--source-revision", sourceRevision,
    "--request-output", "request.json"
  ]);
  assert.equal(Object.hasOwn(request, "requestOutputPath"), true);
  assert.equal(Object.hasOwn(request, "reportOutputPath"), false);

  const prepare = parseArguments([
    "prepare-host-restart",
    "--campaign-id", campaignId,
    "--evidence-root", "evidence",
    "--source-revision", sourceRevision,
    "--approval-request-id", "f".repeat(64),
    "--checkpoint-output", "checkpoint.json",
    "--request", "request.json"
  ]);
  assert.equal(prepare.approvalRequestId, "f".repeat(64));
  assert.equal(Object.hasOwn(prepare, "checkpointOutputPath"), true);
  assert.equal(Object.hasOwn(prepare, "requestPath"), true);

  const verify = parseArguments([
    "verify-host-restart", ...common, "--checkpoint", "checkpoint.json"
  ]);
  assert.equal(Object.hasOwn(verify, "checkpointPath"), true);
  assert.equal(Object.hasOwn(verify, "reportOutputPath"), true);
  assert.throws(() => parseArguments(["run-safe-local", ...common, "--chromium", "chromium"]),
    /unknown run-safe-local fault argument/i);
  assert.throws(() => parseArguments([
    "request-host-restart", ...common, "--request-output", "request.json"
  ]), /unknown request-host-restart fault argument.*report-output/i);
});

test("retired model and package entry points reject before writing evidence", (context) => {
  const { options } = setup(context);
  for (const name of ["slmPackPath", "modelFixturePath", "compositionFixturePath", "packageSource"]) {
    assert.throws(() => runSafeLocalFaults({ ...options, [name]: "retired" }), /unknown fault option/);
    assert.equal(fs.existsSync(options.evidenceRoot), false);
  }
  const api = require("../tools/campaign-fault-injection.js");
  assert.equal(Object.hasOwn(api, "runPackageFaults"), false);
  assert.equal(Object.hasOwn(api, "packageFaultIds"), false);
});
