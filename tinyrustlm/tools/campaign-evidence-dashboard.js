"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const {
  activeLifecycleStates,
  deriveCandidateLifecycles,
  lifecycleSchema
} = require("./campaign-lifecycle.js");
const {
  compareReceipts,
  currentAnnouncement,
  derivePublicEvidenceCohort,
  externalProofBaseValid,
  inspectPublicReleaseReadback,
  newestBy,
  publicReadbackAggregateValid,
  publicReadbackReceiptType,
  qualificationEvaluatorSha256,
  validModelId
} = require("./campaign-public-evidence.js");
const {
  buildCampaignPublicArtifactManifest
} = require("./campaign-public-artifact-scope.js");
const {
  inspectFaultCampaignEvidence
} = require("./campaign-fault-injection.js");
const { atomicCreate, atomicReplace } = require("./durable-files.js");

const dashboardSchema = "tinyrustlm.dogfood_campaign_dashboard.v9";
const candidateErrorReceiptType = "tinyrustlm.model-qualification-error";
const finalAttestationReceiptType = "tinyrustlm.final-release-attestation-v1";
const releaseSignatureReceiptType = "tinyrustlm.release-attestation-verification-v1";
const releaseSignatureVerificationSchema = "tinyrustlm.release_attestation_verification.v1";
const requiredModels = 20;
const requiredBrowserRounds = 50;
const requiredMemoryRounds = 25;
const requiredExternalLaneProofs = 40;
const requiredAnnouncements = 20;
const requiredNativeRids = Object.freeze(["win-x64", "linux-x64", "linux-arm64"]);
const requiredNativeRidCount = requiredNativeRids.length;
const defaultProofExpiryWarningSeconds = 24 * 60 * 60;
const browserRoundTypes = new Set([
  "tinyrustlm.browser-dogfood-round-v4",
  "tinyrustlm.live-memory-continuity-round-v1"
]);
const sourceTaskScreenReceiptTypes = new Set([
  "tinyrustlm.model-source-task-screen-v1",
  "tinyrustlm.model-source-task-screen-v2",
  "tinyrustlm.model-source-task-screen-v3",
  "tinyrustlm.model-source-task-screen-v4"
]);
const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/;
const safeOperationNamePattern = /^[A-Za-z0-9][A-Za-z0-9 ._:/+-]{0,159}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const receiptIdPattern = /^sha256:[a-f0-9]{64}$/;
const lifecycleRank = new Map(activeLifecycleStates.map((state, index) => [state, index]));

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

function verifiedNativeRids(receipt) {
  if (receipt?.evidenceClass !== "target-platform" ||
      !Array.isArray(receipt.hardwareEvidence?.execution) ||
      receipt.hardwareEvidence.execution.length !== requiredNativeRidCount) {
    return Object.freeze([]);
  }
  const rows = receipt.hardwareEvidence.execution;
  const byRid = new Map(rows.map((row) => [String(row?.rid || ""), row]));
  if (byRid.size !== requiredNativeRidCount ||
      requiredNativeRids.some((rid) => !byRid.has(rid))) {
    return Object.freeze([]);
  }
  return Object.freeze(requiredNativeRids.filter((rid) => {
    const row = byRid.get(rid);
    return row?.executed === true && row?.emulated === false &&
      (rid !== "linux-arm64" || row?.physicalHardware === true);
  }));
}

function progress(completed, required) {
  return Object.freeze({ completed, required, complete: completed === required });
}

function passingBrowserRound(receipt, qualifications) {
  if (!browserRoundTypes.has(receipt.receiptType) || receipt.status !== "pass" ||
      !new Set(["browser", "live-service"]).has(receipt.evidenceClass)) return false;
  const parameters = receipt.publicSafeParameters || {};
  const parentQualification = receipt.inputReceiptIds
    .map((receiptId) => qualifications.get(receiptId))
    .find(Boolean);
  return Boolean(parentQualification &&
    parameters.modelId === parentQualification.publicSafeParameters.modelId &&
    Number.isSafeInteger(parameters.round) && parameters.round >= 1 && parameters.round <= 50 &&
    parameters.freshProfileBefore === true && parameters.firstProfileDeleted === true &&
    parameters.finalProfileDeleted === true && parameters.modelHashVerified === true &&
    parameters.manifestVerified === true && parameters.qualityEvidenceVerified === true &&
    parameters.publicPromptLeakCount === 0 && parameters.publicModelByteRequestCount === 0 &&
    parameters.unexpectedLocalAppRequestCount === 0 &&
    parameters.unexpectedThirdPartyRequestCount === 0 && parameters.secretsPersisted === false);
}

function passingMemoryRound(receipt) {
  const parameters = receipt.publicSafeParameters || {};
  return receipt.receiptType === "tinyrustlm.live-memory-continuity-round-v1" &&
    receipt.status === "pass" && receipt.evidenceClass === "live-service" &&
    parameters.memoryContinuityRequired === true && parameters.secondProfileFresh === true &&
    parameters.memoryShortTermRestored === true && parameters.memoryLongTermRestored === true &&
    parameters.memoryAnswerRestored === true && parameters.oneTimeUrlReplayRejected === true &&
    parameters.companyClosed === true && parameters.companyDeleted === true;
}

function proofExpiryWarnings(receipts, generatedAtUnixMs, warningSeconds, qualifications) {
  const warnings = [];
  for (const receipt of receipts) {
    if (!externalProofBaseValid(receipt, qualifications)) continue;
    const parameters = receipt.publicSafeParameters;
    const millisecondsRemaining = Date.parse(parameters.expiresAtUtc) - generatedAtUnixMs;
    if (millisecondsRemaining > warningSeconds * 1000) continue;
    warnings.push(Object.freeze({
      modelId: parameters.modelId,
      laneId: parameters.laneId,
      expiresAtUtc: parameters.expiresAtUtc,
      secondsRemaining: Math.floor(millisecondsRemaining / 1000),
      status: millisecondsRemaining <= 0 ? "expired" : "expiring"
    }));
  }
  return Object.freeze(warnings.sort((left, right) =>
    left.secondsRemaining - right.secondsRemaining ||
    left.modelId.localeCompare(right.modelId) || left.laneId.localeCompare(right.laneId)));
}

function newestReceiptOfType(receipts, receiptType) {
  return newestReceiptMatching(receipts, (receipt) => receipt.receiptType === receiptType);
}

function newestReceiptMatching(receipts, predicate) {
  return receipts
    .filter(predicate)
    .sort(compareReceipts)
    .at(-1) || null;
}

function finalAttestationValid(finalAttestation, receipts, generatedAtUnixMs) {
  if (!finalAttestation) return false;
  const parameters = finalAttestation.publicSafeParameters || {};
  const verificationParents = finalAttestation.inputReceiptIds
    .map((receiptId) => receipts.find((receipt) => receipt.receiptId === receiptId))
    .filter((receipt) => receipt?.receiptType === releaseSignatureReceiptType);
  if (verificationParents.length !== 1) return false;
  const verification = verificationParents[0];
  const verificationParameters = verification.publicSafeParameters || {};
  const predicateSha256 = String(parameters.predicateSha256 || "");
  const contentSha256 = String(parameters.attestationContentSha256 || "");
  const envelopeSha256 = String(parameters.authorizationEnvelopeSha256 || "");
  const registrySha256 = String(parameters.authorityRegistrySha256 || "");
  const signedPayloadSha256 = String(parameters.signedPayloadSha256 || "");
  const publicKeySpkiSha256 = String(parameters.publicKeySpkiSha256 || "");
  const expiryUnixMs = Date.parse(String(parameters.authorizationExpiresAtUtc || ""));
  return finalAttestation.status === "pass" && finalAttestation.evidenceClass === "deployment" &&
    parameters.schema === "tinyrustlm.campaign_final_attestation.v1" &&
    parameters.campaignPrerequisitesPassed === true &&
    parameters.finalAcceptancePassed === true && parameters.signatureVerified === true &&
    sha256Pattern.test(contentSha256) && sha256Pattern.test(predicateSha256) &&
    sha256Pattern.test(envelopeSha256) && sha256Pattern.test(registrySha256) &&
    sha256Pattern.test(signedPayloadSha256) && sha256Pattern.test(publicKeySpkiSha256) &&
    finalAttestation.outputHashes?.finalAttestationContent === contentSha256 &&
    finalAttestation.inputHashes?.releasePredicate === predicateSha256 &&
    finalAttestation.inputHashes?.authorityRegistry === registrySha256 &&
    parameters.signatureVerificationReceiptId === verification.receiptId &&
    finalAttestation.attestationReference === `sha256:${envelopeSha256}` &&
    Number.isFinite(expiryUnixMs) && generatedAtUnixMs < expiryUnixMs &&
    verification.status === "pass" && verification.phase === "release-attestation-verification" &&
    verification.evidenceClass === "deployment" &&
    verification.sourceRevision === finalAttestation.sourceRevision &&
    verificationParameters.schema === releaseSignatureVerificationSchema &&
    verificationParameters.campaignId === finalAttestation.campaignId &&
    verificationParameters.sourceRevision === finalAttestation.sourceRevision &&
    verificationParameters.predicateSha256 === predicateSha256 &&
    verificationParameters.signatureVerified === true &&
    verificationParameters.authorizedRelease === true &&
    verificationParameters.algorithm === "ed25519" &&
    verificationParameters.decision === "authorize-release" &&
    verificationParameters.signingAuthorityId === parameters.signingAuthorityId &&
    verificationParameters.signingKeyId === parameters.signingKeyId &&
    verificationParameters.authorizationEnvelopeSha256 === envelopeSha256 &&
    verificationParameters.authorityRegistrySha256 === registrySha256 &&
    verificationParameters.signedPayloadSha256 === signedPayloadSha256 &&
    verificationParameters.publicKeySpkiSha256 === publicKeySpkiSha256 &&
    verificationParameters.expiresAtUtc === parameters.authorizationExpiresAtUtc &&
    verification.inputHashes?.releasePredicate === predicateSha256 &&
    verification.outputHashes?.releasePredicate === predicateSha256 &&
    verification.inputHashes?.authorizationEnvelope === envelopeSha256 &&
    verification.inputHashes?.authorityRegistry === registrySha256 &&
    verification.inputHashes?.signedPayload === signedPayloadSha256 &&
    verification.inputHashes?.authorityPublicKey === publicKeySpkiSha256 &&
    verification.outputHashes?.verifiedAuthorizationEnvelope === envelopeSha256 &&
    verification.outputHashes?.verifiedSignedPayload === signedPayloadSha256 &&
    verification.hardwareEvidence?.cryptographicSignatureVerification === true &&
    verification.hardwareEvidence?.signatureAlgorithm === "ed25519" &&
    verification.attestationReference === `sha256:${envelopeSha256}`;
}

function releaseGates(receipts, publicReadbackInspection, expectedScopeManifestSha256,
  generatedAtUnixMs) {
  const browser = newestReceiptOfType(receipts,
    "tinyrustlm.browser-acceptance-verification-v1");
  const native = newestReceiptOfType(receipts, "tinyrustlm.native-rid-verification-v1");
  const packageReceipt = newestReceiptMatching(receipts, (receipt) =>
    receipt.receiptType === "tinyrustlm.package-verification-v1" &&
    receipt.phase === "package-verification" &&
    !Object.hasOwn(receipt.publicSafeParameters || {}, "faultId"));
  const publicReadback = newestReceiptOfType(receipts, publicReadbackReceiptType);
  const publicSite = newestReceiptOfType(receipts,
    "tinyrustlm.packaged-public-site-verification-v1");
  const secretScan = newestReceiptOfType(receipts, "tinyrustlm.secret-scan-v2");
  const finalAttestation = newestReceiptOfType(receipts, finalAttestationReceiptType);
  const declaredExecutedNativeRidCount =
    Number(native?.publicSafeParameters?.executedRidCount || 0);
  const executedNativeRidCount =
    Number.isSafeInteger(declaredExecutedNativeRidCount) &&
      declaredExecutedNativeRidCount >= 0 &&
      declaredExecutedNativeRidCount <= requiredNativeRidCount
      ? declaredExecutedNativeRidCount
      : 0;
  const verifiedRids = verifiedNativeRids(native);
  const physicalLinuxArm64Verified =
    native?.publicSafeParameters?.physicalLinuxArm64Executed === true &&
    verifiedRids.includes("linux-arm64");
  const faultInjection = inspectFaultCampaignEvidence(receipts);
  return Object.freeze({
    browserAcceptance: Object.freeze({
      passed: browser?.status === "pass" && browser.evidenceClass === "browser" &&
        browser.publicSafeParameters?.campaignDogfoodRoundCount === 0,
      receiptId: browser?.receiptId || null
    }),
    nativeRids: Object.freeze({
      executed: executedNativeRidCount,
      verified: verifiedRids.length,
      verifiedRids,
      required: requiredNativeRidCount,
      physicalLinuxArm64Verified,
      passed: native?.status === "pass" && native.evidenceClass === "target-platform" &&
        executedNativeRidCount === requiredNativeRidCount &&
        verifiedRids.length === requiredNativeRidCount &&
        physicalLinuxArm64Verified,
      receiptId: native?.receiptId || null
    }),
    packages: Object.freeze({
      passed: packageReceipt?.status === "pass" &&
        packageReceipt.evidenceClass === "package" &&
        packageReceipt.blockerCode === null &&
        packageReceipt.hardwareEvidence?.packageConsumerExecution === true &&
        packageReceipt.publicSafeParameters?.packageAuditPassed === true &&
        packageReceipt.publicSafeParameters?.packageCount === 4 &&
        packageReceipt.publicSafeParameters?.symbolPackageCount === 4 &&
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u
          .test(String(packageReceipt.publicSafeParameters?.packageVersion || "")) &&
        sha256Pattern.test(String(packageReceipt.inputHashes?.packageAudit || "")) &&
        packageReceipt.inputHashes.packageAudit === packageReceipt.outputHashes?.packageAudit,
      receiptId: packageReceipt?.receiptId || null
    }),
    packagedPublicSite: Object.freeze({
      passed: publicSite?.status === "pass" &&
        publicSite.publicSafeParameters?.packagedPublicSiteVerified === true &&
        publicSite.publicSafeParameters?.publicHttpsReadback === false,
      receiptId: publicSite?.receiptId || null
    }),
    publicHttpsReadback: Object.freeze({
      passed: publicReadbackAggregateValid(publicReadback, publicReadbackInspection),
      receiptId: publicReadback?.receiptId || null
    }),
    secretScan: Object.freeze({
      passed: secretScan?.status === "pass" &&
        secretScan.publicSafeParameters?.scopeKind === "campaign-public-release" &&
        secretScan.publicSafeParameters?.scopeComplete === true &&
        secretScan.publicSafeParameters?.secretFindingCount === 0 &&
        secretScan.publicSafeParameters?.scannedArtifactCount > 0 &&
        typeof expectedScopeManifestSha256 === "string" &&
        secretScan.inputHashes?.scopeManifest === expectedScopeManifestSha256 &&
        secretScan.outputHashes?.scopeManifest === expectedScopeManifestSha256,
      receiptId: secretScan?.receiptId || null
    }),
    finalAttestation: Object.freeze({
      passed: finalAttestationValid(finalAttestation, receipts, generatedAtUnixMs),
      receiptId: finalAttestation?.receiptId || null
    }),
    faultInjection
  });
}

function operationParameters(receipt) {
  const parameters = receipt.publicSafeParameters || {};
  if (!safeIdentifierPattern.test(String(parameters.operationId || "")) ||
      !safeOperationNamePattern.test(String(parameters.operationName || ""))) return null;
  return Object.freeze({
    operationId: parameters.operationId,
    operationName: parameters.operationName
  });
}

function deriveCurrentOperation(receipts) {
  const starts = new Map();
  let invalidReceiptCount = 0;
  for (const receipt of receipts.filter((candidate) =>
    candidate.receiptType === "tinyrustlm.campaign-operation-start-v1")) {
    const parameters = operationParameters(receipt);
    if (receipt.status !== "pass" || !parameters) {
      invalidReceiptCount += 1;
      continue;
    }
    starts.set(receipt.receiptId, { receipt, parameters });
  }
  const finishedStarts = new Set();
  for (const receipt of receipts.filter((candidate) =>
    candidate.receiptType === "tinyrustlm.campaign-operation-finish-v1")) {
    const parentStarts = receipt.inputReceiptIds.filter((receiptId) => starts.has(receiptId));
    const parameters = operationParameters(receipt);
    const parent = parentStarts.length === 1 ? starts.get(parentStarts[0]) : null;
    if (!parameters || !parent || parameters.operationId !== parent.parameters.operationId ||
        parameters.operationName !== parent.parameters.operationName) {
      invalidReceiptCount += 1;
      continue;
    }
    finishedStarts.add(parentStarts[0]);
  }
  const active = Array.from(starts.values())
    .filter(({ receipt }) => !finishedStarts.has(receipt.receiptId))
    .sort((left, right) => compareReceipts(left.receipt, right.receipt));
  if (active.length === 0) {
    return Object.freeze({
      state: "idle",
      operationId: null,
      operationName: null,
      phase: null,
      startedAtUtc: null,
      startReceiptId: null,
      conflictingOperationCount: 0,
      invalidOperationReceiptCount: invalidReceiptCount
    });
  }
  if (active.length > 1) {
    return Object.freeze({
      state: "conflict",
      operationId: null,
      operationName: null,
      phase: null,
      startedAtUtc: active[0].receipt.createdAtUtc,
      startReceiptId: null,
      conflictingOperationCount: active.length,
      invalidOperationReceiptCount: invalidReceiptCount
    });
  }
  const [{ receipt, parameters }] = active;
  return Object.freeze({
    state: "running",
    operationId: parameters.operationId,
    operationName: parameters.operationName,
    phase: receipt.phase,
    startedAtUtc: receipt.createdAtUtc,
    startReceiptId: receipt.receiptId,
    conflictingOperationCount: 0,
    invalidOperationReceiptCount: invalidReceiptCount
  });
}

function retryItem(receipt) {
  const modelId = validModelId(receipt.publicSafeParameters?.modelId)
    ? receipt.publicSafeParameters.modelId
    : null;
  return Object.freeze({
    receiptId: receipt.receiptId,
    phase: receipt.phase,
    status: receipt.status,
    blockerCode: receipt.blockerCode,
    modelId,
    completedAtUtc: receipt.completedAtUtc
  });
}

function deriveRetryQueues(receipts, currentCandidateErrorReceiptIds) {
  const queues = { ready: [], waitingForExternalCondition: [], operatorDecisionRequired: [] };
  for (const receipt of receipts.filter((candidate) =>
    candidate.status === "blocked" || candidate.status === "fail").sort(compareReceipts)) {
    if (receipt.receiptType === candidateErrorReceiptType &&
        !currentCandidateErrorReceiptIds.has(receipt.receiptId)) continue;
    const explicitRetry = receipt.publicSafeParameters?.retryAllowed === true ||
      receipt.boundedDiagnostics?.retryAllowed === true;
    if (explicitRetry) queues.ready.push(retryItem(receipt));
    else if (receipt.status === "blocked") queues.waitingForExternalCondition.push(retryItem(receipt));
    else queues.operatorDecisionRequired.push(retryItem(receipt));
  }
  return Object.freeze({
    ready: Object.freeze(queues.ready),
    waitingForExternalCondition: Object.freeze(queues.waitingForExternalCondition),
    operatorDecisionRequired: Object.freeze(queues.operatorDecisionRequired)
  });
}

function measureEvidenceDiskUsage(store) {
  const pending = [store.receiptsPath, store.quarantinePath];
  let bytes = 0;
  let files = 0;
  let directories = 0;
  let symbolicLinksSkipped = 0;
  try {
    while (pending.length > 0) {
      const current = pending.pop();
      const stat = fs.lstatSync(current, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isSymbolicLink()) {
        symbolicLinksSkipped += 1;
        continue;
      }
      if (stat.isDirectory()) {
        directories += 1;
        for (const entry of fs.readdirSync(current)) pending.push(path.join(current, entry));
        continue;
      }
      if (stat.isFile()) {
        files += 1;
        bytes += stat.size;
        invariant(Number.isSafeInteger(bytes), "evidence disk usage exceeds safe integer range");
      }
    }
    return Object.freeze({
      status: "measured",
      scope: "receipt-store-and-quarantine",
      bytes,
      files,
      directories,
      symbolicLinksSkipped
    });
  } catch {
    return Object.freeze({
      status: "unavailable",
      scope: "receipt-store-and-quarantine",
      errorCode: "evidence_disk_usage_unavailable"
    });
  }
}

function activeBlockers(receipts, counts, gates, evidenceValidation, warnings,
  currentCandidateErrorReceiptIds) {
  const blockers = new Set();
  for (const receipt of receipts) {
    if (receipt.receiptType === candidateErrorReceiptType &&
        !currentCandidateErrorReceiptIds.has(receipt.receiptId)) continue;
    if (["blocked", "fail"].includes(receipt.status) && receipt.blockerCode) {
      blockers.add(receipt.blockerCode);
    }
    const nested = receipt.boundedDiagnostics?.externalBlockers;
    if (Array.isArray(nested)) {
      for (const value of nested) {
        const code = String(value);
        if (/^[a-z0-9][a-z0-9._:-]{2,159}$/.test(code) &&
            !/^[a-z0-9]+_additional_qualified_models_absent$/u.test(code)) blockers.add(code);
      }
    }
  }
  if (counts.qualifiedModels !== requiredModels) blockers.add("qualified_models_incomplete");
  if (counts.evaluatedCandidates > 0 && !counts.currentEvaluatorCoverageComplete) {
    blockers.add("candidate_evaluator_coverage_incomplete");
  }
  if (counts.browserRounds !== requiredBrowserRounds) blockers.add("fresh_browser_rounds_incomplete");
  if (counts.memoryRounds !== requiredMemoryRounds) blockers.add("live_memory_rounds_incomplete");
  if (counts.externalLaneProofs !== requiredExternalLaneProofs) {
    blockers.add("outside_network_lane_proofs_incomplete");
  }
  if (counts.announcements !== requiredAnnouncements) blockers.add("catalog_announcements_incomplete");
  if (!gates.browserAcceptance.passed) blockers.add("browser_acceptance_verification_incomplete");
  if (!gates.packages.passed) blockers.add("package_verification_incomplete");
  if (!gates.nativeRids.passed) blockers.add("native_rid_execution_incomplete");
  if (!gates.nativeRids.physicalLinuxArm64Verified) {
    blockers.add("physical_linux_arm64_hardware_evidence_absent");
  }
  if (!gates.packagedPublicSite.passed) blockers.add("packaged_public_site_verification_incomplete");
  if (!gates.publicHttpsReadback.passed) blockers.add("public_https_readback_incomplete");
  if (!gates.secretScan.passed) blockers.add("secret_scan_incomplete");
  if (!gates.faultInjection.passed) blockers.add("fault_injection_campaign_incomplete");
  if (!gates.finalAttestation.passed) blockers.add("final_attestation_incomplete");
  if (evidenceValidation.health !== "healthy") blockers.add("campaign_evidence_validation_failed");
  if (warnings.some((warning) => warning.status === "expired")) blockers.add("outside_proof_expired");
  return Object.freeze(Array.from(blockers).sort());
}

function branchState(state, lastVerifiedState, nextRequiredState, blockerCodes = []) {
  return Object.freeze({
    state,
    lastVerifiedState,
    nextRequiredState,
    blockerCodes: Object.freeze([...new Set(blockerCodes)].sort())
  });
}

function highestCandidateState(candidateStates) {
  return candidateStates
    .map((candidate) => candidate.lastVerifiedState)
    .filter((state) => lifecycleRank.has(state))
    .sort((left, right) => lifecycleRank.get(left) - lifecycleRank.get(right))
    .at(-1) || null;
}

function deriveLifecycle(counts, gates, candidateStates, current, complete) {
  const highestModelState = highestCandidateState(candidateStates);
  const modelPortfolio = counts.qualifiedModels === requiredModels
    ? branchState("Qualified", "Qualified", "BrowserTesting")
    : branchState(highestModelState, highestModelState, "Qualified");
  const browserCampaign = counts.browserRounds === requiredBrowserRounds
    ? branchState("BrowserProven", "BrowserProven", "MemoryContinuityTesting")
    : counts.browserRounds > 0
      ? branchState("BrowserTesting", "BrowserTesting", "BrowserProven")
      : counts.qualifiedModels === requiredModels
        ? branchState("Qualified", "Qualified", "BrowserTesting")
        : branchState("Blocked", null, "Qualified", ["qualified_models_incomplete"]);
  const memoryContractBlocked = current.some((receipt) =>
    receipt.receiptType === "tinyrustlm.memory-endpoints-contract-audit-v1" &&
    receipt.status === "blocked");
  const memoryCampaign = counts.memoryRounds === requiredMemoryRounds
    ? branchState("MemoryContinuityProven", "MemoryContinuityProven", "P2PPrepared")
    : counts.memoryRounds > 0
      ? branchState("MemoryContinuityTesting", "MemoryContinuityTesting",
        "MemoryContinuityProven")
      : memoryContractBlocked
        ? branchState("Blocked", null, "MemoryContinuityTesting",
          ["memory_endpoints_live_contract_incompatible"])
        : branchState("Blocked", null, "BrowserProven", ["fresh_browser_rounds_incomplete"]);
  const localServingModelCount = current
    .filter((receipt) => receipt.receiptType === "tinyrustlm.p2p-local-two-lane" &&
      receipt.status === "pass" && receipt.evidenceClass === "local")
    .reduce((maximum, receipt) =>
      Math.max(maximum, Number(receipt.publicSafeParameters?.modelCount || 0)), 0);
  const p2pFleet = counts.externalLaneProofs === requiredExternalLaneProofs
    ? branchState("P2PExternallyProven", "P2PExternallyProven", "CatalogAnnounced")
    : counts.externalLaneProofs > 0 || localServingModelCount > 0
      ? branchState("P2PServing", "P2PServing", "P2PExternallyProven",
        ["outside_network_lane_proofs_incomplete"])
      : counts.qualifiedModels === requiredModels
        ? branchState("P2PPrepared", "P2PPrepared", "P2PServing")
        : branchState("Blocked", null, "Qualified", ["qualified_models_incomplete"]);
  const catalog = counts.announcements === requiredAnnouncements
    ? branchState("CatalogAnnounced", "CatalogAnnounced", "Published")
    : counts.externalLaneProofs === requiredExternalLaneProofs
      ? branchState("P2PExternallyProven", "P2PExternallyProven", "CatalogAnnounced")
      : branchState("Blocked", null, "P2PExternallyProven",
        ["outside_network_lane_proofs_incomplete"]);
  const packaged = gates.packages.passed && gates.packagedPublicSite.passed;
  const release = complete
    ? branchState("Complete", "Complete", null)
    : gates.publicHttpsReadback.passed
      ? branchState("DeploymentVerified", "DeploymentVerified", "Complete")
      : packaged
        ? branchState("Blocked", "Packaged", "Published", ["public_https_readback_incomplete"])
        : branchState("Blocked", null, "Packaged", ["package_verification_incomplete"]);
  return Object.freeze({
    schema: lifecycleSchema,
    campaignState: complete ? "Complete" : modelPortfolio.state,
    branches: Object.freeze({ modelPortfolio, browserCampaign, memoryCampaign, p2pFleet, catalog, release }),
    candidateStates
  });
}

function finalizedDashboard(body) {
  const dashboardContentSha256 = sha256(canonicalJson(body));
  return Object.freeze({ ...body, dashboardContentSha256 });
}

function validateDashboardHash(dashboard) {
  invariant(isPlainObject(dashboard), "campaign dashboard is invalid");
  const { dashboardContentSha256, ...body } = dashboard;
  invariant(sha256Pattern.test(String(dashboardContentSha256 || "")),
    "campaign dashboard content hash is invalid");
  invariant(sha256(canonicalJson(body)) === dashboardContentSha256,
    "campaign dashboard content hash does not match");
  return true;
}

function writeCampaignDashboard(outputPath, dashboard) {
  validateDashboardHash(dashboard);
  const targetPath = path.resolve(outputPath);
  const payload = Buffer.from(`${JSON.stringify(dashboard, null, 2)}\n`, "utf8");
  const snapshotPath = path.join(path.dirname(targetPath), "dashboard-snapshots", "sha256",
    dashboard.dashboardContentSha256.slice(0, 2), `${dashboard.dashboardContentSha256}.json`);
  atomicCreate(snapshotPath, payload);
  atomicReplace(targetPath, payload);
  const reopened = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  validateDashboardHash(reopened);
  invariant(canonicalJson(reopened) === canonicalJson(dashboard),
    "reopened campaign dashboard changed");
  return Object.freeze({ targetPath, snapshotPath });
}

function buildCampaignDashboard(options) {
  invariant(isPlainObject(options), "campaign dashboard options are invalid");
  const campaignId = String(options.campaignId || "");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/.test(campaignId),
    "campaign dashboard ID is invalid");
  const generatedAtUtc = options.generatedAtUtc || options.generatedUtc || new Date().toISOString();
  invariant(Number.isFinite(Date.parse(generatedAtUtc)), "campaign dashboard time is invalid");
  const warningSeconds = options.proofExpiryWarningSeconds ?? defaultProofExpiryWarningSeconds;
  invariant(Number.isSafeInteger(warningSeconds) && warningSeconds >= 60 &&
    warningSeconds <= 30 * 24 * 60 * 60, "proof expiry warning interval is invalid");

  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  const retainedQuarantine = fs.readdirSync(store.quarantinePath, { withFileTypes: true })
    .filter((entry) => entry.isFile()).length;
  const campaignReceipts = rebuilt.receipts.filter((receipt) => receipt.campaignId === campaignId);
  const publicCohort = derivePublicEvidenceCohort(campaignReceipts, generatedAtUtc);
  const current = publicCohort.current;
  const candidateStates = deriveCandidateLifecycles(current.filter((receipt) =>
    receipt.evidenceClass !== "fixture"));
  const currentCandidateErrorReceiptIds = new Set(candidateStates
    .filter((candidate) => candidate.state === "Blocked" && candidate.currentTerminalReceiptId)
    .map((candidate) => candidate.currentTerminalReceiptId));

  const candidateQualifications = publicCohort.candidateQualifications;
  const candidateSourceScreens = newestBy(current.filter((receipt) =>
    receipt.receiptType === "tinyrustlm.model-source-screen-v1" &&
    receipt.evidenceClass === "local" && ["pass", "rejected"].includes(receipt.status) &&
    validModelId(receipt.publicSafeParameters?.modelId)),
  (receipt) => receipt.publicSafeParameters.modelId);
  const candidateSourceTaskScreens = newestBy(current.filter((receipt) =>
    sourceTaskScreenReceiptTypes.has(receipt.receiptType) &&
    receipt.evidenceClass === "local" && ["pass", "rejected"].includes(receipt.status) &&
    validModelId(receipt.publicSafeParameters?.modelId)),
  (receipt) =>
  `${receipt.publicSafeParameters.modelId}:${receipt.publicSafeParameters.taskContractId}`);
  const candidateSourceReviews = newestBy(current.filter((receipt) =>
    receipt.receiptType === "tinyrustlm.model-source-review-v1" &&
    receipt.evidenceClass === "local" && ["pass", "rejected"].includes(receipt.status) &&
    validModelId(receipt.publicSafeParameters?.modelId)),
  (receipt) => receipt.publicSafeParameters.modelId);
  const candidateErrors = newestBy(current.filter((receipt) =>
    receipt.receiptType === candidateErrorReceiptType &&
    receipt.evidenceClass === "local" && receipt.status === "fail" &&
    currentCandidateErrorReceiptIds.has(receipt.receiptId) &&
    validModelId(receipt.publicSafeParameters?.modelId)),
  (receipt) => receipt.publicSafeParameters.modelId);
  const currentCandidateEvaluatorSha256 = publicCohort.evaluatorSha256;
  const currentEvaluatorQualifications = publicCohort.evaluatorQualifications;
  const currentEvaluatorCoverageComplete = publicCohort.evaluatorCoverageComplete;
  const qualifications = publicCohort.qualifications;
  const qualificationById = publicCohort.qualificationById;
  const browserRounds = newestBy(current.filter((receipt) =>
    passingBrowserRound(receipt, qualificationById)), (receipt) =>
  String(receipt.publicSafeParameters.round));
  const memoryRounds = browserRounds.filter(passingMemoryRound);
  const generatedAtUnixMs = publicCohort.generatedAtUnixMs;
  const proofList = publicCohort.proofList;
  const proofById = publicCohort.proofById;
  const announcements = publicCohort.announcements;
  const localP2p = current.filter((receipt) =>
    receipt.receiptType === "tinyrustlm.p2p-local-two-lane" &&
    receipt.status === "pass" && receipt.evidenceClass === "local");
  const fixtureQualifications = current.filter((receipt) =>
    receipt.receiptType === "tinyrustlm.model-qualification" &&
    receipt.status === "pass" && receipt.evidenceClass === "fixture");
  const fixtureRounds = current.filter((receipt) =>
    /dogfood-round/.test(receipt.receiptType) && receipt.status === "pass" &&
    receipt.evidenceClass === "fixture");
  const candidateScores = currentEvaluatorQualifications
    .map((receipt) => Number(receipt.publicSafeParameters.casesPassed || 0))
    .filter(Number.isSafeInteger);
  const historicalCandidateScores = candidateQualifications
    .map((receipt) => Number(receipt.publicSafeParameters.casesPassed || 0))
    .filter(Number.isSafeInteger);
  const candidateCaseCounts = currentEvaluatorQualifications
    .map((receipt) => Number(receipt.publicSafeParameters.expectedCaseCount || 0))
    .filter(Number.isSafeInteger);
  const counts = Object.freeze({
    qualifiedModels: qualifications.length,
    browserRounds: browserRounds.length,
    memoryRounds: memoryRounds.length,
    externalLaneProofs: proofList.length,
    announcements: announcements.length,
    currentEvaluatorCoverageComplete,
    evaluatedCandidates: candidateQualifications.length,
    convertedCandidates: candidateStates.filter((candidate) =>
      lifecycleRank.get(candidate.lastVerifiedState) >= lifecycleRank.get("Converted")).length
  });
  const publicReadbackInspection = inspectPublicReleaseReadback(campaignReceipts, generatedAtUtc);
  let publicArtifactScope;
  try {
    const manifest = buildCampaignPublicArtifactManifest({
      workspaceRoot: options.workspaceRoot,
      evidenceRoot: options.evidenceRoot,
      releaseAssetsRoot: options.releaseAssetsRoot
    });
    publicArtifactScope = Object.freeze({
      status: "validated",
      artifactCount: manifest.artifactCount,
      scopeKind: manifest.scopeKind,
      scopeManifestSha256: manifest.scopeManifestSha256
    });
  } catch {
    publicArtifactScope = Object.freeze({
      status: "unavailable",
      artifactCount: 0,
      scopeKind: "campaign-public-release",
      scopeManifestSha256: null,
      errorCode: "campaign_public_artifact_scope_unavailable"
    });
  }
  const gates = releaseGates(current, publicReadbackInspection,
    publicArtifactScope.scopeManifestSha256, generatedAtUnixMs);
  const operation = deriveCurrentOperation(current);
  const invalidOutsideProofCount = current.filter((receipt) =>
    receipt.receiptType === "tinyrustlm.p2p-outside-proof-v1" &&
    !externalProofBaseValid(receipt, qualificationById)).length;
  const invalidAnnouncementCount = current.filter((receipt) =>
    receipt.receiptType === "tinyrustlm.catalog-announcement-v1" &&
    !currentAnnouncement(receipt, proofById)).length;
  const evidenceHealthIsGood = retainedQuarantine === 0 && invalidOutsideProofCount === 0 &&
    invalidAnnouncementCount === 0 && operation.state !== "conflict" &&
    operation.invalidOperationReceiptCount === 0;
  const evidenceValidation = Object.freeze({
    health: evidenceHealthIsGood ? "healthy" : "invalid",
    graphValidated: true,
    receiptSetSha256: sha256(canonicalJson(campaignReceipts
      .map((receipt) => receipt.receiptId).sort())),
    currentReceiptSetSha256: sha256(canonicalJson(current
      .map((receipt) => receipt.receiptId).sort())),
    retainedReceiptCount: campaignReceipts.length,
    currentReceiptCount: current.length,
    quarantinedEvidenceCount: retainedQuarantine,
    newlyQuarantinedEvidenceCount: rebuilt.quarantined.length,
    invalidOutsideProofCount,
    invalidAnnouncementCount,
    invalidOperationReceiptCount: operation.invalidOperationReceiptCount,
    publicArtifactScope
  });
  const warnings = proofExpiryWarnings(current, generatedAtUnixMs, warningSeconds,
    qualificationById);
  const blockers = activeBlockers(current, counts, gates, evidenceValidation, warnings,
    currentCandidateErrorReceiptIds);
  const complete = counts.qualifiedModels === requiredModels &&
    counts.browserRounds === requiredBrowserRounds && counts.memoryRounds === requiredMemoryRounds &&
    counts.externalLaneProofs === requiredExternalLaneProofs &&
    counts.announcements === requiredAnnouncements && gates.browserAcceptance.passed &&
    gates.packages.passed && gates.nativeRids.passed && gates.packagedPublicSite.passed &&
    gates.publicHttpsReadback.passed && gates.secretScan.passed && gates.faultInjection.passed &&
    gates.finalAttestation.passed &&
    blockers.length === 0;
  const sortedReceipts = [...campaignReceipts].sort(compareReceipts);
  const lastCheckpoint = [...current].sort(compareReceipts).at(-1) || null;
  const startedAtUtc = sortedReceipts[0]?.createdAtUtc || null;
  const elapsedMilliseconds = startedAtUtc
    ? Math.max(0, generatedAtUnixMs - Date.parse(startedAtUtc))
    : 0;
  const rejectedModels = Object.freeze(candidateStates
    .filter((candidate) => candidate.state === "Rejected")
    .map((candidate) => Object.freeze({
      modelId: candidate.modelId,
      lastVerifiedState: candidate.lastVerifiedState,
      artifactSha256: candidate.artifactSha256,
      blockerCodes: candidate.blockerCodes,
      lastReceiptId: candidate.lastReceiptId,
      rejectedAtUtc: candidate.lastCompletedAtUtc
    })));
  const retryQueues = deriveRetryQueues(current, currentCandidateErrorReceiptIds);
  const modelPortfolio = Object.freeze({
    attemptedCandidates: candidateStates.length,
    convertedCandidates: counts.convertedCandidates,
    rejectedCandidates: rejectedModels.length,
    blockedCandidates: candidateStates.filter((candidate) => candidate.state === "Blocked").length,
    sourceScreenRejectedCandidates: candidateSourceScreens.filter((receipt) =>
      receipt.status === "rejected").length,
    sourceTaskScreenPassedCandidates: candidateSourceTaskScreens.filter((receipt) =>
      receipt.status === "pass").length,
    sourceTaskScreenRejectedCandidates: candidateSourceTaskScreens.filter((receipt) =>
      receipt.status === "rejected").length,
    sourceReviewRejectedCandidates: candidateSourceReviews.filter((receipt) =>
      receipt.status === "rejected").length,
    infrastructureFailures: candidateErrors.length,
    sourceReviewFailures: candidateErrors.filter((receipt) =>
      receipt.phase === "model-source-review").length,
    distinctCandidateArtifacts: new Set(candidateStates
      .map((candidate) => candidate.artifactSha256).filter(Boolean)).size,
    evaluator: Object.freeze({
      currentBinarySha256: currentCandidateEvaluatorSha256,
      currentCandidateCount: currentEvaluatorQualifications.length,
      staleCandidateCount: candidateQualifications.length - currentEvaluatorQualifications.length,
      coverageComplete: currentEvaluatorCoverageComplete,
      bestCurrentCasesPassed: candidateScores.length > 0 ? Math.max(...candidateScores) : 0,
      bestHistoricalCasesPassed: historicalCandidateScores.length > 0
        ? Math.max(...historicalCandidateScores)
        : 0,
      expectedCaseCount: candidateCaseCounts.length > 0 ? Math.max(...candidateCaseCounts) : 0
    }),
    nonPromotableEvidence: Object.freeze({
      fixtureQualifiedModels: fixtureQualifications.length,
      fixtureValidatedRounds: fixtureRounds.length,
      locallyValidatedP2pRuns: localP2p.length,
      locallyReachableP2pEndpoints: localP2p.reduce((total, receipt) =>
        total + Number(receipt.publicSafeParameters.localReachableEndpointCount || 0), 0)
    })
  });
  const lifecycle = deriveLifecycle(counts, gates, candidateStates, current, complete);
  const body = {
    schema: dashboardSchema,
    campaignId,
    generatedAtUtc,
    status: complete ? "complete" : "incomplete",
    lifecycle,
    progress: Object.freeze({
      qualifiedModels: progress(counts.qualifiedModels, requiredModels),
      cleanBrowserRounds: progress(counts.browserRounds, requiredBrowserRounds),
      liveMemoryRounds: progress(counts.memoryRounds, requiredMemoryRounds),
      externallyProvenLanes: progress(counts.externalLaneProofs, requiredExternalLaneProofs),
      catalogAnnouncements: progress(counts.announcements, requiredAnnouncements),
      nativeRidGates: Object.freeze({
        completed: gates.nativeRids.verified,
        required: gates.nativeRids.required,
        complete: gates.nativeRids.passed
      }),
      faultInjectionCases: Object.freeze({
        completed: gates.faultInjection.satisfiedFaultCount,
        required: gates.faultInjection.plannedFaultCount,
        complete: gates.faultInjection.passed
      })
    }),
    currentOperation: operation,
    timing: Object.freeze({
      campaignStartedAtUtc: startedAtUtc,
      elapsedMilliseconds,
      lastDurableCheckpoint: lastCheckpoint ? Object.freeze({
        receiptId: lastCheckpoint.receiptId,
        receiptType: lastCheckpoint.receiptType,
        phase: lastCheckpoint.phase,
        status: lastCheckpoint.status,
        completedAtUtc: lastCheckpoint.completedAtUtc
      }) : null
    }),
    activeBlockers: blockers,
    rejectedModels,
    retryQueues,
    evidenceValidation,
    diskUsage: measureEvidenceDiskUsage(store),
    proofExpiryWarnings: warnings,
    proofExpiryWarningSeconds: warningSeconds,
    releaseGates: gates,
    modelPortfolio,
    qualifiedModelIds: Object.freeze(qualifications
      .map((receipt) => receipt.publicSafeParameters.modelId).sort()),
    completedRoundNumbers: Object.freeze(browserRounds
      .map((receipt) => receipt.publicSafeParameters.round).sort((left, right) => left - right)),
    resumable: evidenceValidation.health === "healthy" && operation.state !== "conflict"
  };
  const dashboard = finalizedDashboard(body);
  if (options.outputPath) writeCampaignDashboard(options.outputPath, dashboard);
  return dashboard;
}

function formatCampaignDashboard(dashboard) {
  validateDashboardHash(dashboard);
  const progressValues = dashboard.progress;
  const line = (label, value) => `${label}: ${value.completed} / ${value.required}`;
  return [
    `Campaign ${dashboard.campaignId}: ${dashboard.status}`,
    line("Qualified models", progressValues.qualifiedModels),
    line("Clean browser rounds", progressValues.cleanBrowserRounds),
    line("Live memory rounds", progressValues.liveMemoryRounds),
    line("Externally proven lanes", progressValues.externallyProvenLanes),
    line("Catalog announcements", progressValues.catalogAnnouncements),
    line("Native RID gates", progressValues.nativeRidGates),
    line("Fault-injection cases", progressValues.faultInjectionCases),
    `Current operation: ${dashboard.currentOperation.state}`,
    `Evidence health: ${dashboard.evidenceValidation.health}`,
    `Active blockers: ${dashboard.activeBlockers.length}`,
    `Rejected models: ${dashboard.rejectedModels.length}`,
    `Resumable: ${dashboard.resumable}`
  ].join("\n");
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant([
      "--campaign-id", "--evidence-root", "--output", "--release-assets-root", "--workspace-root"
    ].includes(name),
      `unknown dashboard argument: ${name}`);
    invariant(value !== undefined, `dashboard argument requires a value: ${name}`);
    if (name === "--campaign-id") options.campaignId = value;
    if (name === "--evidence-root") options.evidenceRoot = value;
    if (name === "--output") options.outputPath = value;
    if (name === "--release-assets-root") options.releaseAssetsRoot = value;
    if (name === "--workspace-root") options.workspaceRoot = value;
    index += 1;
  }
  invariant(options.campaignId && options.evidenceRoot,
    "--campaign-id and --evidence-root are required");
  return options;
}

if (require.main === module) {
  const dashboard = buildCampaignDashboard(parseCliArguments(process.argv.slice(2)));
  process.stdout.write(`${formatCampaignDashboard(dashboard)}\n`);
}

module.exports = Object.freeze({
  buildCampaignDashboard,
  dashboardSchema,
  formatCampaignDashboard,
  validateDashboardHash,
  writeCampaignDashboard
});
