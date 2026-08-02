"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { buildCampaignDashboard, validateDashboardHash } = require("./campaign-evidence-dashboard.js");
const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate, atomicReplace } = require("./durable-files.js");

const finalAttestationSchema = "tinyrustlm.campaign_final_attestation.v1";
const finalAttestationReceiptType = "tinyrustlm.final-release-attestation-v1";
const releaseSignatureReceiptType = "tinyrustlm.release-attestation-verification-v1";
const releaseSignatureVerificationSchema = "tinyrustlm.release_attestation_verification.v1";
const riskRegisterSchema = "tinyrustlm.campaign_remaining_risks.v1";
const finalAttestationBlocker = "final_attestation_incomplete";
const maximumRiskRegisterBytes = 512 * 1024;
const receiptIdPattern = /^sha256:[a-f0-9]{64}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/u;
const blockerPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const failureStatuses = new Set(["blocked", "fail", "rejected", "stale"]);
const riskSeverities = new Set(["release-blocking", "high", "medium", "low"]);
const riskStatuses = new Set(["open", "accepted", "mitigated"]);
const excludedSubjectReceiptTypes = new Set([
  finalAttestationReceiptType,
  releaseSignatureReceiptType,
  "tinyrustlm.secret-scan-v2"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactFields(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  const unknown = actual.filter((key) => !required.includes(key));
  const missing = required.filter((key) => !actual.includes(key));
  invariant(unknown.length === 0, `${label} has unknown field ${unknown[0]}`);
  invariant(missing.length === 0, `${label} is missing field ${missing[0]}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(utcPattern.test(text) && Number.isFinite(Date.parse(text)), `${label} must be UTC`);
  return text;
}

function requireBoundedString(value, label, maximum = 2048) {
  const text = String(value ?? "");
  invariant(text.length > 0 && text.length <= maximum, `${label} is invalid`);
  invariant(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text),
    `${label} contains controls`);
  return text;
}

function requireStringArray(value, label, pattern = null, maximum = 1024) {
  invariant(Array.isArray(value) && value.length <= maximum, `${label} must be a bounded array`);
  const result = value.map((entry) => requireBoundedString(entry, label));
  if (pattern) {
    for (const entry of result) invariant(pattern.test(entry), `${label} contains an invalid value`);
  }
  invariant(new Set(result).size === result.length, `${label} contains duplicates`);
  return Object.freeze(result);
}

function validateRiskRegister(value, expectedCampaignId) {
  requireExactFields(value, ["schema", "campaignId", "updatedAtUtc", "risks"],
    "remaining-risk register");
  invariant(value.schema === riskRegisterSchema, "remaining-risk schema is unsupported");
  invariant(value.campaignId === expectedCampaignId, "remaining-risk campaign ID does not match");
  const updatedAtUtc = requireUtc(value.updatedAtUtc, "remaining-risk update time");
  invariant(Array.isArray(value.risks) && value.risks.length > 0 && value.risks.length <= 256,
    "remaining-risk register must contain a bounded nonempty risk list");
  const risks = value.risks.map((risk, index) => {
    const label = `remaining-risk ${index}`;
    requireExactFields(risk, [
      "riskId", "category", "severity", "status", "summary", "mitigation",
      "acceptanceCondition", "blockerCodes", "evidenceReferences"
    ], label);
    const riskId = requireBoundedString(risk.riskId, `${label} riskId`, 160);
    const category = requireBoundedString(risk.category, `${label} category`, 128);
    invariant(safeIdPattern.test(riskId) && safeIdPattern.test(category),
      `${label} identity is invalid`);
    invariant(riskSeverities.has(risk.severity), `${label} severity is invalid`);
    invariant(riskStatuses.has(risk.status), `${label} status is invalid`);
    return Object.freeze({
      riskId,
      category,
      severity: risk.severity,
      status: risk.status,
      summary: requireBoundedString(risk.summary, `${label} summary`, 4096),
      mitigation: requireBoundedString(risk.mitigation, `${label} mitigation`, 4096),
      acceptanceCondition: requireBoundedString(
        risk.acceptanceCondition, `${label} acceptanceCondition`, 4096),
      blockerCodes: requireStringArray(risk.blockerCodes, `${label} blockerCodes`, blockerPattern, 128),
      evidenceReferences: requireStringArray(
        risk.evidenceReferences, `${label} evidenceReferences`, null, 128)
    });
  });
  invariant(new Set(risks.map((risk) => risk.riskId)).size === risks.length,
    "remaining-risk register contains duplicate risk IDs");
  return Object.freeze({ schema: riskRegisterSchema, campaignId: expectedCampaignId, updatedAtUtc,
    risks: Object.freeze(risks) });
}

function readRiskRegister(filePath, campaignId) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && stat.size > 0 && stat.size <= maximumRiskRegisterBytes,
    "remaining-risk register is missing or outside its size limit");
  const bytes = fs.readFileSync(resolved);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/u, ""));
  } catch (_error) {
    throw new Error("remaining-risk register is not valid JSON");
  }
  return Object.freeze({
    bytes,
    hash: sha256(bytes),
    value: validateRiskRegister(value, campaignId)
  });
}

function currentReceipts(receipts) {
  const superseded = new Set(receipts.flatMap((receipt) => receipt.supersedesReceiptIds || []));
  return receipts.filter((receipt) => !superseded.has(receipt.receiptId));
}

function compareReceipts(left, right) {
  return Date.parse(left.completedAtUtc) - Date.parse(right.completedAtUtc) ||
    String(left.receiptId).localeCompare(String(right.receiptId));
}

function subjectReceipts(receipts, campaignId) {
  invariant(Array.isArray(receipts), "attestation receipt set must be an array");
  return receipts.filter((receipt) => receipt.campaignId === campaignId &&
    !excludedSubjectReceiptTypes.has(receipt.receiptType)).sort(compareReceipts);
}

function failureRows(receipts) {
  return Object.freeze(receipts.filter((receipt) => failureStatuses.has(receipt.status))
    .map((receipt) => Object.freeze({
      receiptId: receipt.receiptId,
      receiptType: receipt.receiptType,
      phase: receipt.phase,
      status: receipt.status,
      blockerCode: receipt.blockerCode,
      completedAtUtc: receipt.completedAtUtc
    }))
    .sort((left, right) => left.completedAtUtc.localeCompare(right.completedAtUtc) ||
      left.receiptId.localeCompare(right.receiptId)));
}

function supersessionRows(receipts) {
  const ids = new Set(receipts.map((receipt) => receipt.receiptId));
  return Object.freeze(receipts.flatMap((receipt) => (receipt.supersedesReceiptIds || [])
    .filter((supersededReceiptId) => ids.has(supersededReceiptId))
    .map((supersededReceiptId) => Object.freeze({
      supersedingReceiptId: receipt.receiptId,
      supersededReceiptId
    })))
    .sort((left, right) => left.supersedingReceiptId.localeCompare(right.supersedingReceiptId) ||
      left.supersededReceiptId.localeCompare(right.supersededReceiptId)));
}

function normalizedProgress(progress) {
  const names = [
    "qualifiedModels", "cleanBrowserRounds", "liveMemoryRounds", "externallyProvenLanes",
    "catalogAnnouncements", "nativeRidGates", "faultInjectionCases"
  ];
  const result = {};
  for (const name of names) {
    const value = progress?.[name];
    invariant(isPlainObject(value) && Number.isSafeInteger(value.completed) &&
      Number.isSafeInteger(value.required) && typeof value.complete === "boolean",
    `campaign progress ${name} is invalid`);
    result[name] = Object.freeze({
      completed: value.completed,
      required: value.required,
      complete: value.complete
    });
  }
  return Object.freeze(result);
}

function normalizedReleaseGates(gates) {
  const required = [
    "browserAcceptance", "nativeRids", "packages", "packagedPublicSite",
    "publicHttpsReadback", "secretScan", "faultInjection"
  ];
  const result = {};
  for (const name of required) {
    invariant(isPlainObject(gates?.[name]) && typeof gates[name].passed === "boolean",
      `campaign release gate ${name} is invalid`);
    const receiptId = gates[name].receiptId === null || gates[name].receiptId === undefined
      ? null
      : String(gates[name].receiptId);
    invariant(receiptId === null || receiptIdPattern.test(receiptId),
      `campaign release gate ${name} receipt ID is invalid`);
    result[name] = Object.freeze({ passed: gates[name].passed, receiptId });
  }
  result.nativeRids = Object.freeze({
    passed: gates.nativeRids.passed,
    receiptId: result.nativeRids.receiptId,
    physicalLinuxArm64Verified: gates.nativeRids.physicalLinuxArm64Verified === true
  });
  result.faultInjection = Object.freeze({
    passed: gates.faultInjection.passed,
    receiptId: result.faultInjection.receiptId,
    satisfiedFaultCount: Number(gates.faultInjection.satisfiedFaultCount || 0),
    plannedFaultCount: Number(gates.faultInjection.plannedFaultCount || 0)
  });
  return Object.freeze(result);
}

function requiredProgressPassed(progress) {
  const expected = Object.freeze({
    qualifiedModels: 20,
    cleanBrowserRounds: 50,
    liveMemoryRounds: 25,
    externallyProvenLanes: 40,
    catalogAnnouncements: 20,
    nativeRidGates: 3,
    faultInjectionCases: 24
  });
  return Object.entries(expected).every(([name, required]) =>
    progress[name].completed === required && progress[name].required === required &&
    progress[name].complete === true);
}

function signatureAuthentication(signatureReceipt, predicateSha256, sourceRevision,
  verificationTimeUtc) {
  if (!signatureReceipt) {
    return Object.freeze({
      kind: "unsigned-content-addressed",
      signatureVerified: false,
      authorizedRelease: false,
      verificationReceiptId: null,
      attestationReference: null,
      signingAuthorityId: null,
      signingKeyId: null,
      authorizationEnvelopeSha256: null,
      authorityRegistrySha256: null,
      signedPayloadSha256: null,
      publicKeySpkiSha256: null,
      issuedAtUtc: null,
      expiresAtUtc: null
    });
  }
  invariant(receiptIdPattern.test(String(signatureReceipt.receiptId || "")),
    "release signature receipt identity is invalid");
  invariant(signatureReceipt.receiptType === releaseSignatureReceiptType &&
    signatureReceipt.phase === "release-attestation-verification" &&
    signatureReceipt.status === "pass" && signatureReceipt.evidenceClass === "deployment",
  "release signature receipt does not have deployment verification authority");
  invariant(signatureReceipt.sourceRevision === sourceRevision,
    "release signature receipt source revision does not match");
  const parameters = signatureReceipt.publicSafeParameters || {};
  invariant(parameters.schema === releaseSignatureVerificationSchema &&
    parameters.campaignId === signatureReceipt.campaignId &&
    parameters.sourceRevision === sourceRevision &&
    parameters.predicateSha256 === predicateSha256,
  "release signature verification identity does not match");
  invariant(signatureReceipt.inputHashes?.releasePredicate === predicateSha256 &&
    signatureReceipt.outputHashes?.releasePredicate === predicateSha256,
    "release signature receipt does not bind the final predicate");
  invariant(parameters.signatureVerified === true && parameters.authorizedRelease === true &&
    parameters.algorithm === "ed25519" && parameters.decision === "authorize-release" &&
    signatureReceipt.hardwareEvidence?.cryptographicSignatureVerification === true &&
    signatureReceipt.hardwareEvidence?.signatureAlgorithm === "ed25519",
  "release signature receipt does not authorize the release");
  invariant(typeof signatureReceipt.attestationReference === "string" &&
    signatureReceipt.attestationReference.length > 0,
  "release signature receipt lacks an attestation reference");
  const signingAuthorityId = String(parameters.signingAuthorityId || "");
  const signingKeyId = String(parameters.signingKeyId || "");
  const authorizationEnvelopeSha256 = String(parameters.authorizationEnvelopeSha256 || "");
  const authorityRegistrySha256 = String(parameters.authorityRegistrySha256 || "");
  const signedPayloadSha256 = String(parameters.signedPayloadSha256 || "");
  const publicKeySpkiSha256 = String(parameters.publicKeySpkiSha256 || "");
  invariant(safeIdPattern.test(signingAuthorityId) && safeIdPattern.test(signingKeyId),
    "release signing authority identity is invalid");
  invariant(sha256Pattern.test(authorizationEnvelopeSha256) &&
    sha256Pattern.test(authorityRegistrySha256) && sha256Pattern.test(signedPayloadSha256) &&
    sha256Pattern.test(publicKeySpkiSha256) &&
    signatureReceipt.inputHashes?.authorizationEnvelope === authorizationEnvelopeSha256 &&
    signatureReceipt.inputHashes?.authorityRegistry === authorityRegistrySha256 &&
    signatureReceipt.inputHashes?.signedPayload === signedPayloadSha256 &&
    signatureReceipt.inputHashes?.authorityPublicKey === publicKeySpkiSha256 &&
    signatureReceipt.outputHashes?.verifiedAuthorizationEnvelope === authorizationEnvelopeSha256 &&
    signatureReceipt.outputHashes?.verifiedSignedPayload === signedPayloadSha256 &&
    signatureReceipt.attestationReference === `sha256:${authorizationEnvelopeSha256}`,
  "release authorization envelope binding does not match");
  const issuedAtUtc = requireUtc(parameters.issuedAtUtc, "release authorization issue time");
  const expiresAtUtc = requireUtc(parameters.expiresAtUtc, "release authorization expiry time");
  const verifiedAt = Date.parse(requireUtc(verificationTimeUtc,
    "release authorization verification time"));
  invariant(Date.parse(issuedAtUtc) <= Date.parse(signatureReceipt.completedAtUtc) &&
    Date.parse(signatureReceipt.completedAtUtc) <= verifiedAt && verifiedAt < Date.parse(expiresAtUtc),
  "release authorization verification is expired or time-inconsistent");
  return Object.freeze({
    kind: "verified-release-attestation",
    signatureVerified: true,
    authorizedRelease: true,
    verificationReceiptId: signatureReceipt.receiptId,
    attestationReference: signatureReceipt.attestationReference,
    signingAuthorityId,
    signingKeyId,
    authorizationEnvelopeSha256,
    authorityRegistrySha256,
    signedPayloadSha256,
    publicKeySpkiSha256,
    issuedAtUtc,
    expiresAtUtc
  });
}

function buildFinalAttestationDocument(options) {
  invariant(isPlainObject(options), "final attestation options are invalid");
  const dashboard = options.dashboard;
  validateDashboardHash(dashboard);
  invariant(dashboard.schema === "tinyrustlm.dogfood_campaign_dashboard.v9",
    "final attestation requires the current dashboard schema");
  const campaignId = String(dashboard.campaignId || "");
  const sourceRevision = requireBoundedString(options.sourceRevision, "source revision", 256);
  const risks = validateRiskRegister(options.riskRegister, campaignId);
  const riskRegisterSha256 = String(options.riskRegisterSha256 || "").toLowerCase();
  invariant(sha256Pattern.test(riskRegisterSha256), "remaining-risk hash is invalid");
  const retained = subjectReceipts(options.receipts, campaignId);
  const current = currentReceipts(retained).sort(compareReceipts);
  const retainedIds = retained.map((receipt) => receipt.receiptId).sort();
  const currentIds = current.map((receipt) => receipt.receiptId).sort();
  const receiptById = new Map(options.receipts.map((receipt) => [receipt.receiptId, receipt]));
  const gateParentIds = releaseGateParentIds(dashboard, null);
  const missingGateParentId = gateParentIds.find((receiptId) => !receiptById.has(receiptId));
  invariant(!missingGateParentId,
    `campaign release gate receipt is absent from the evidence set: ${missingGateParentId}`);
  const gateParents = gateParentIds.map((receiptId) => receiptById.get(receiptId));
  const blockers = Object.freeze((dashboard.activeBlockers || [])
    .filter((code) => code !== finalAttestationBlocker).map(String).sort());
  const progress = normalizedProgress(dashboard.progress);
  const releaseGates = normalizedReleaseGates(dashboard.releaseGates);
  const openReleaseBlockingRiskIds = Object.freeze(risks.risks
    .filter((risk) => risk.severity === "release-blocking" && risk.status === "open")
    .map((risk) => risk.riskId).sort());
  const campaignPrerequisitesPassed = requiredProgressPassed(progress) &&
    Object.values(releaseGates).every((gate) => gate.passed === true) &&
    dashboard.evidenceValidation?.health === "healthy" &&
    dashboard.evidenceValidation?.graphValidated === true &&
    dashboard.resumable === true && blockers.length === 0 &&
    openReleaseBlockingRiskIds.length === 0;
  const campaignDecision = Object.freeze({
    campaignPrerequisitesPassed,
    progress,
    releaseGates,
    evidenceHealth: String(dashboard.evidenceValidation?.health || "invalid"),
    graphValidated: dashboard.evidenceValidation?.graphValidated === true,
    resumable: dashboard.resumable === true,
    blockers,
    qualifiedModelIds: Object.freeze([...(dashboard.qualifiedModelIds || [])].map(String).sort()),
    completedRoundNumbers: Object.freeze([...(dashboard.completedRoundNumbers || [])]
      .map(Number).sort((left, right) => left - right)),
    openReleaseBlockingRiskIds
  });
  const generatedAtUtc = new Date(Math.max(Date.parse(risks.updatedAtUtc),
    ...retained.map((receipt) => Date.parse(receipt.completedAtUtc)),
    ...gateParents.map((receipt) => Date.parse(receipt.completedAtUtc)), 0)).toISOString();
  const subject = Object.freeze({
    dashboardSchema: dashboard.schema,
    dashboardDecisionSha256: sha256(canonicalJson(campaignDecision)),
    riskRegisterSchema: risks.schema,
    riskRegisterSha256,
    retainedReceiptCount: retainedIds.length,
    retainedReceiptSetSha256: sha256(canonicalJson(retainedIds)),
    currentReceiptCount: currentIds.length,
    currentReceiptSetSha256: sha256(canonicalJson(currentIds))
  });
  const failures = failureRows(retained);
  const supersessions = supersessionRows(retained);
  const predicate = Object.freeze({
    schema: finalAttestationSchema,
    campaignId,
    sourceRevision,
    generatedAtUtc,
    subject,
    campaignDecision,
    failures,
    supersessions,
    residualRisks: risks.risks
  });
  const predicateSha256 = sha256(canonicalJson(predicate));
  const authentication = signatureAuthentication(
    options.signatureReceipt || null, predicateSha256, sourceRevision, dashboard.generatedAtUtc);
  const complete = campaignPrerequisitesPassed && authentication.signatureVerified &&
    authentication.authorizedRelease;
  const body = Object.freeze({
    ...predicate,
    predicateSha256,
    authentication,
    status: complete ? "complete" : "incomplete",
    claim: complete ? "release-complete" : "pre-release-incomplete"
  });
  return Object.freeze({
    ...body,
    attestationContentSha256: sha256(canonicalJson(body))
  });
}

function validateFinalAttestation(value) {
  requireExactFields(value, [
    "schema", "campaignId", "sourceRevision", "generatedAtUtc", "subject",
    "campaignDecision", "failures", "supersessions", "residualRisks", "predicateSha256",
    "authentication", "status", "claim", "attestationContentSha256"
  ], "final attestation");
  invariant(value.schema === finalAttestationSchema, "final attestation schema is unsupported");
  invariant(safeIdPattern.test(String(value.campaignId || "")), "final attestation campaign ID is invalid");
  requireBoundedString(value.sourceRevision, "final attestation source revision", 256);
  requireUtc(value.generatedAtUtc, "final attestation generation time");
  invariant(["complete", "incomplete"].includes(value.status), "final attestation status is invalid");
  invariant(value.claim === (value.status === "complete" ? "release-complete" :
    "pre-release-incomplete"), "final attestation claim does not match its status");
  const predicate = {
    schema: value.schema,
    campaignId: value.campaignId,
    sourceRevision: value.sourceRevision,
    generatedAtUtc: value.generatedAtUtc,
    subject: value.subject,
    campaignDecision: value.campaignDecision,
    failures: value.failures,
    supersessions: value.supersessions,
    residualRisks: value.residualRisks
  };
  invariant(sha256(canonicalJson(predicate)) === value.predicateSha256,
    "final attestation predicate hash does not match");
  const { attestationContentSha256, ...body } = value;
  invariant(sha256Pattern.test(String(attestationContentSha256 || "")) &&
    sha256(canonicalJson(body)) === attestationContentSha256,
  "final attestation content hash does not match");
  const shouldComplete = value.campaignDecision?.campaignPrerequisitesPassed === true &&
    value.authentication?.signatureVerified === true &&
    value.authentication?.authorizedRelease === true;
  invariant((value.status === "complete") === shouldComplete,
    "final attestation completion decision is inconsistent");
  return true;
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function currentReceiptOfType(receipts, receiptType) {
  return currentReceipts(receipts.filter((receipt) => receipt.receiptType === receiptType))
    .sort(compareReceipts).at(-1) || null;
}

function releaseGateParentIds(dashboard, signatureReceipt) {
  const ids = Object.entries(dashboard.releaseGates || {})
    .filter(([name]) => name !== "finalAttestation")
    .map(([, gate]) => gate?.receiptId)
    .filter((receiptId) => receiptIdPattern.test(String(receiptId || "")));
  if (signatureReceipt) ids.push(signatureReceipt.receiptId);
  return Object.freeze([...new Set(ids)].sort());
}

function putFinalReceipt(store, input) {
  const history = store.listReceipts((receipt) => receipt.receiptType === finalAttestationReceiptType &&
    receipt.campaignId === input.campaignId);
  const current = currentReceipts(history);
  invariant(current.length <= 1, "several current final attestation receipts exist");
  const existing = current.find((receipt) => receipt.sourceRevision === input.sourceRevision &&
    receipt.outputHashes.finalAttestationFile === input.outputHashes.finalAttestationFile &&
    receipt.inputHashes.releasePredicate === input.inputHashes.releasePredicate);
  if (existing) return existing;
  const attempt = history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  return store.putReceipt({
    ...input,
    attempt,
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId)
  }).receipt;
}

function recordCampaignFinalAttestation(options) {
  invariant(isPlainObject(options), "campaign final attestation options are invalid");
  const allowed = new Set([
    "campaignId", "evidenceRoot", "outputPath", "remainingRisksPath", "sourceRevision",
    "workspaceRoot", "releaseAssetsRoot"
  ]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown campaign final attestation option: ${key}`);
  }
  const campaignId = String(options.campaignId || "");
  invariant(safeIdPattern.test(campaignId), "campaign final attestation ID is invalid");
  const sourceRevision = requireBoundedString(options.sourceRevision, "source revision", 256);
  const outputPath = path.resolve(String(options.outputPath || ""));
  invariant(path.basename(outputPath).length > 0, "final attestation output path is invalid");
  const risks = readRiskRegister(options.remainingRisksPath, campaignId);
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "final attestation refuses a quarantined evidence store");
  const allReceipts = store.listReceipts();
  const signatureReceipt = currentReceiptOfType(allReceipts, releaseSignatureReceiptType);
  const dashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: options.evidenceRoot,
    releaseAssetsRoot: options.releaseAssetsRoot,
    workspaceRoot: options.workspaceRoot
  });
  const attestation = buildFinalAttestationDocument({
    dashboard,
    receipts: allReceipts,
    riskRegister: risks.value,
    riskRegisterSha256: risks.hash,
    signatureReceipt,
    sourceRevision
  });
  validateFinalAttestation(attestation);
  const payload = Buffer.from(`${JSON.stringify(attestation, null, 2)}\n`, "utf8");
  const fileSha256 = sha256(payload);
  const snapshotPath = path.join(path.dirname(outputPath), "final-attestation-snapshots", "sha256",
    fileSha256.slice(0, 2), `${fileSha256}.json`);
  atomicCreate(snapshotPath, payload);
  atomicReplace(outputPath, payload);
  const reopened = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  validateFinalAttestation(reopened);
  invariant(canonicalJson(reopened) === canonicalJson(attestation),
    "reopened final attestation changed");

  const parentIds = releaseGateParentIds(dashboard, signatureReceipt);
  const receiptById = new Map(allReceipts.map((candidate) => [candidate.receiptId, candidate]));
  const missingParentId = parentIds.find((receiptId) => !receiptById.has(receiptId));
  invariant(!missingParentId,
    `final attestation parent is absent from the evidence set: ${missingParentId}`);
  const receiptAtUtc = new Date(Math.max(Date.parse(attestation.generatedAtUtc),
    ...parentIds.map((receiptId) => Date.parse(receiptById.get(receiptId).completedAtUtc)),
    0)).toISOString();
  const toolHash = sha256(fs.readFileSync(__filename));
  const receipt = putFinalReceipt(store, {
    receiptType: finalAttestationReceiptType,
    campaignId,
    phase: "final-release-attestation",
    status: "pass",
    createdAtUtc: receiptAtUtc,
    completedAtUtc: receiptAtUtc,
    inputReceiptIds: parentIds,
    inputHashes: {
      ...(attestation.authentication.authorityRegistrySha256 ? {
        authorityRegistry: attestation.authentication.authorityRegistrySha256
      } : {}),
      currentReceiptSet: attestation.subject.currentReceiptSetSha256,
      releasePredicate: attestation.predicateSha256,
      remainingRisks: risks.hash,
      retainedReceiptSet: attestation.subject.retainedReceiptSetSha256
    },
    outputHashes: {
      finalAttestationContent: attestation.attestationContentSha256,
      finalAttestationFile: fileSha256
    },
    sourceRevision,
    toolNames: ["tinyrustlm-campaign-final-attestation"],
    toolVersions: ["1"],
    toolBinaryHashes: [toolHash],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: { generatedFromValidatedReceiptDag: true },
    configurationHash: sha256(canonicalJson({
      finalAttestationSchema,
      riskRegisterSchema,
      sourceRevision
    })),
    publicSafeParameters: {
      schema: finalAttestationSchema,
      campaignPrerequisitesPassed: attestation.campaignDecision.campaignPrerequisitesPassed,
      finalAcceptancePassed: attestation.status === "complete",
      signatureVerified: attestation.authentication.signatureVerified,
      failureCount: attestation.failures.length,
      supersessionCount: attestation.supersessions.length,
      residualRiskCount: attestation.residualRisks.length,
      attestationContentSha256: attestation.attestationContentSha256,
      predicateSha256: attestation.predicateSha256,
      signatureVerificationReceiptId: attestation.authentication.verificationReceiptId,
      signingAuthorityId: attestation.authentication.signingAuthorityId,
      signingKeyId: attestation.authentication.signingKeyId,
      authorizationEnvelopeSha256: attestation.authentication.authorizationEnvelopeSha256,
      authorityRegistrySha256: attestation.authentication.authorityRegistrySha256,
      signedPayloadSha256: attestation.authentication.signedPayloadSha256,
      publicKeySpkiSha256: attestation.authentication.publicKeySpkiSha256,
      authorizationIssuedAtUtc: attestation.authentication.issuedAtUtc,
      authorizationExpiresAtUtc: attestation.authentication.expiresAtUtc
    },
    boundedDiagnostics: {
      claim: attestation.claim,
      blockers: attestation.campaignDecision.blockers,
      openReleaseBlockingRiskIds: attestation.campaignDecision.openReleaseBlockingRiskIds
    },
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: attestation.status === "complete" ? "deployment" : "local",
    supersedesReceiptIds: [],
    attestationReference: attestation.authentication.attestationReference
  });
  const finalizedDashboard = buildCampaignDashboard({
    campaignId,
    evidenceRoot: options.evidenceRoot,
    generatedAtUtc: dashboard.generatedAtUtc,
    releaseAssetsRoot: options.releaseAssetsRoot,
    workspaceRoot: options.workspaceRoot
  });
  return Object.freeze({
    attestation,
    dashboard: finalizedDashboard,
    fileSha256,
    outputPath,
    receipt,
    snapshotPath
  });
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant([
      "--campaign-id", "--evidence-root", "--output", "--remaining-risks",
      "--release-assets-root", "--source-revision", "--workspace-root"
    ].includes(name), `unknown final attestation argument: ${name}`);
    invariant(value !== undefined, `final attestation argument requires a value: ${name}`);
    if (name === "--campaign-id") options.campaignId = value;
    if (name === "--evidence-root") options.evidenceRoot = value;
    if (name === "--output") options.outputPath = value;
    if (name === "--remaining-risks") options.remainingRisksPath = value;
    if (name === "--source-revision") options.sourceRevision = value;
    if (name === "--workspace-root") options.workspaceRoot = value;
    if (name === "--release-assets-root") options.releaseAssetsRoot = value;
    index += 1;
  }
  invariant(options.campaignId && options.evidenceRoot && options.outputPath &&
    options.remainingRisksPath && options.sourceRevision,
  "--campaign-id, --evidence-root, --output, --remaining-risks, and --source-revision are required");
  return options;
}

if (require.main === module) {
  const result = recordCampaignFinalAttestation(parseCliArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    schema: result.attestation.schema,
    status: result.attestation.status,
    claim: result.attestation.claim,
    attestationContentSha256: result.attestation.attestationContentSha256,
    fileSha256: result.fileSha256,
    receiptId: result.receipt.receiptId
  }, null, 2)}\n`);
}

module.exports = Object.freeze({
  buildFinalAttestationDocument,
  finalAttestationBlocker,
  finalAttestationReceiptType,
  finalAttestationSchema,
  recordCampaignFinalAttestation,
  releaseSignatureReceiptType,
  riskRegisterSchema,
  validateFinalAttestation,
  validateRiskRegister
});
