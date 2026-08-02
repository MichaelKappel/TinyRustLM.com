"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const campaign = require("./dogfood-campaign.js");
const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const { executionSchema } = require("./fresh-browser-conversation.js");

const receiptType = "tinyrustlm.browser-dogfood-round-v4";
const compositionKeys = new Set([
  "activated",
  "bundleSha256",
  "compositionId",
  "activeGraphSha256",
  "routePolicyId",
  "kvFormatId",
  "memberCount",
  "activationCount",
  "graphRequestCount"
]);
const evidenceKeys = new Set([
  "freshProfileBefore",
  "firstProfileDeleted",
  "finalProfileDeleted",
  "secondProfileFresh",
  "modelHashVerified",
  "manifestVerified",
  "qualityEvidenceVerified",
  "userMessageCount",
  "assistantMessageCount",
  "authoritativeResponseCount",
  "rawConversationSha256",
  "publicPromptLeakCount",
  "publicModelByteRequestCount",
  "unexpectedLocalAppRequestCount",
  "unexpectedThirdPartyRequestCount",
  "secretsPersisted",
  "memoryContinuityRequired",
  "memoryShortTermRestored",
  "memoryLongTermRestored",
  "memoryAnswerRestored",
  "oneTimeUrlReplayRejected",
  "companyClosed",
  "companyDeleted",
  "publicAnnouncementVerified"
]);
const profileScanKeys = new Set([
  "complete",
  "matchCount",
  "filesScanned",
  "bytesScanned"
]);
const browserStateScanKeys = new Set([
  "complete",
  "matchCount",
  "itemCount",
  "bytesScanned",
  "localStorageItemCount",
  "sessionStorageItemCount",
  "cookieCount",
  "indexedDbDatabaseCount",
  "cacheCount",
  "serviceWorkerCount",
  "opfsFileCount"
]);
const consoleScanKeys = new Set([
  "complete",
  "matchCount",
  "eventCount"
]);
const runtimeIdentityKeys = new Set([
  "admissionSha256",
  "artifactSha256",
  "manifestSha256",
  "qualityEvidenceSha256",
  "qualificationReceiptId",
  "promptFormat",
  "systemPromptSha256",
  "modelSamplingProfile"
]);
const samplingKeys = new Set([
  "maxTokens",
  "temperature",
  "topK",
  "topP",
  "seed",
  "repetitionPenalty",
  "turns"
]);
const samplingTurnKeys = new Set([
  "maxTokens",
  "temperature",
  "topK",
  "topP",
  "seed",
  "repetitionPenalty",
  "generatedTokenCount"
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireSha256(value, label) {
  const hash = String(value || "").toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(hash), `${label} must be SHA-256`);
  return hash;
}

function currentRuntimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function executorSha256() {
  return sha256(fs.readFileSync(require.resolve("./fresh-browser-conversation.js")));
}

function validatedComposition(execution, model) {
  const composition = execution.composition;
  invariant(isPlainObject(composition), "browser composition evidence is invalid");
  for (const key of Object.keys(composition)) {
    invariant(compositionKeys.has(key), `unknown browser composition field: ${key}`);
  }
  for (const key of compositionKeys) {
    invariant(Object.hasOwn(composition, key),
      `browser composition evidence is missing ${key}`);
  }
  invariant(typeof composition.activated === "boolean",
    "browser composition activation evidence is invalid");
  for (const key of ["bundleSha256", "activeGraphSha256"]) {
    requireSha256(composition[key], key);
  }
  for (const key of ["memberCount", "activationCount", "graphRequestCount"]) {
    invariant(Number.isSafeInteger(composition[key]) && composition[key] >= 0,
      `browser composition ${key} is invalid`);
  }
  if (composition.activated) {
    invariant(composition.bundleSha256 === model.compositionGraphSha256 &&
      composition.compositionId === model.compositionId &&
      composition.activeGraphSha256 === model.compositionActiveGraphSha256 &&
      composition.routePolicyId === model.compositionRoutePolicyId &&
      composition.kvFormatId === model.compositionKvFormatId &&
      composition.memberCount === model.compositionMemberCount &&
      composition.activationCount >= 1,
    "browser active composition does not match the campaign model");
  } else {
    invariant(composition.bundleSha256 === "0".repeat(64) &&
      composition.compositionId === "none" &&
      composition.activeGraphSha256 === "0".repeat(64) &&
      composition.routePolicyId === "none" &&
      composition.kvFormatId === "none" &&
      composition.memberCount === 0 &&
      composition.activationCount === 0,
    "inactive browser composition evidence is not canonical");
  }
  if (execution.status === "pass") {
    invariant(composition.activated && composition.graphRequestCount === 1,
      "passing browser evidence requires one exact composition graph request and activation");
  }
  return Object.freeze({ ...composition });
}

function validatedEvidence(execution, round) {
  invariant(isPlainObject(execution.evidence), "browser round evidence is invalid");
  for (const key of Object.keys(execution.evidence)) {
    invariant(evidenceKeys.has(key), `unknown browser round evidence field: ${key}`);
  }
  for (const key of evidenceKeys) {
    invariant(Object.hasOwn(execution.evidence, key),
      `browser round evidence is missing ${key}`);
  }
  const evidence = Object.freeze({ ...execution.evidence });
  invariant(evidence.memoryContinuityRequired === false && round.memoryContinuity !== true,
    "browser evidence cannot satisfy hosted-memory continuity");
  invariant(evidence.publicAnnouncementVerified === false,
    "browser evidence cannot establish a catalog announcement");
  requireSha256(evidence.rawConversationSha256, "rawConversationSha256");
  const evaluated = campaign.evaluateRoundEvidence(evidence);
  invariant((execution.status === "pass") === (evaluated.status === "pass"),
    "browser execution status disagrees with campaign evaluation");
  invariant(execution.status === "pass" ||
    (execution.status === "fail" && /^[a-z0-9][a-z0-9._-]{2,159}$/.test(execution.failureCode)),
  "browser execution failure code is invalid");
  return Object.freeze({ evidence, evaluated });
}

function validatedScan(value, keys, label) {
  invariant(isPlainObject(value), `${label} is invalid`);
  for (const key of Object.keys(value)) {
    invariant(keys.has(key), `${label} contains unknown field ${key}`);
  }
  for (const key of keys) {
    invariant(Object.hasOwn(value, key), `${label} is missing ${key}`);
  }
  invariant(typeof value.complete === "boolean", `${label} completeness is invalid`);
  for (const key of keys) {
    if (key === "complete") continue;
    invariant(Number.isSafeInteger(value[key]) && value[key] >= 0,
      `${label} ${key} is invalid`);
  }
  return Object.freeze({ ...value });
}

function validatedPrivacy(execution) {
  const profile = validatedScan(execution.profileScan, profileScanKeys, "profile scan");
  const browserState = validatedScan(
    execution.browserStateScan,
    browserStateScanKeys,
    "browser state scan"
  );
  const console = validatedScan(execution.consoleScan, consoleScanKeys, "console scan");
  if (execution.status === "pass") {
    invariant(profile.complete && browserState.complete && console.complete,
      "passing browser evidence requires complete privacy scans");
    invariant(profile.matchCount === 0 && browserState.matchCount === 0 &&
      console.matchCount === 0,
    "passing browser evidence contains a secret match");
  }
  return Object.freeze({ profile, browserState, console });
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} is invalid`);
  for (const key of Object.keys(value)) {
    invariant(keys.has(key), `${label} contains unknown field ${key}`);
  }
  for (const key of keys) {
    invariant(Object.hasOwn(value, key), `${label} is missing ${key}`);
  }
}

function validatedRuntimeIdentity(execution, model) {
  const identity = execution.runtimeIdentity;
  exactKeys(identity, runtimeIdentityKeys, "browser runtime identity");
  for (const key of [
    "admissionSha256",
    "artifactSha256",
    "manifestSha256",
    "qualityEvidenceSha256",
    "systemPromptSha256"
  ]) {
    requireSha256(identity[key], `browser runtime ${key}`);
  }
  const matches = identity.artifactSha256 === model.artifactSha256 &&
    identity.manifestSha256 === model.manifestSha256 &&
    identity.qualityEvidenceSha256 === model.qualityEvidenceSha256 &&
    identity.qualificationReceiptId === model.qualificationReceiptId &&
    identity.promptFormat === model.promptFormat &&
    identity.systemPromptSha256 === model.systemPromptSha256 &&
    identity.modelSamplingProfile === model.modelSamplingProfile;
  const empty = [
    identity.admissionSha256,
    identity.artifactSha256,
    identity.manifestSha256,
    identity.qualityEvidenceSha256,
    identity.systemPromptSha256
  ].every((value) => value === "0".repeat(64)) &&
    identity.qualificationReceiptId === "none" &&
    identity.promptFormat === "none" &&
    identity.modelSamplingProfile === "none";
  invariant(matches || (execution.status === "fail" && empty),
    "browser runtime identity does not match the campaign model");
  if (execution.status === "pass") {
    invariant(matches, "passing browser evidence lacks the runtime admission identity");
  }
  return Object.freeze({ ...identity });
}

function validatedSampling(execution, round, model) {
  const sampling = execution.sampling;
  exactKeys(sampling, samplingKeys, "browser sampling evidence");
  invariant(Number.isSafeInteger(sampling.maxTokens) &&
    Number.isSafeInteger(sampling.topK) &&
    Number.isSafeInteger(sampling.seed) &&
    Number.isFinite(sampling.temperature) &&
    Number.isFinite(sampling.topP) &&
    Number.isFinite(sampling.repetitionPenalty) &&
    sampling.maxTokens === round.sampling.maxTokens &&
    sampling.temperature === round.sampling.temperature &&
    sampling.topK === round.sampling.topK &&
    sampling.topP === round.sampling.topP &&
    sampling.seed === round.sampling.seed &&
    sampling.repetitionPenalty === model.samplingRepetitionPenalty,
  "browser sampling evidence does not match the sealed round");
  invariant(Array.isArray(sampling.turns) &&
    sampling.turns.length <= round.prompts.length,
  "browser sampling turn evidence is invalid");
  if (execution.status === "pass") {
    invariant(sampling.turns.length === round.prompts.length,
      "passing browser evidence requires sampling diagnostics for every turn");
  }
  const turns = sampling.turns.map((turn, index) => {
    exactKeys(turn, samplingTurnKeys, `browser sampling turn ${index + 1}`);
    invariant(Number.isSafeInteger(turn.generatedTokenCount) &&
      turn.generatedTokenCount >= 0 && turn.generatedTokenCount <= sampling.maxTokens &&
      turn.maxTokens === sampling.maxTokens &&
      turn.temperature === sampling.temperature &&
      turn.topK === sampling.topK &&
      turn.topP === sampling.topP &&
      turn.seed === sampling.seed &&
      turn.repetitionPenalty === sampling.repetitionPenalty,
    `browser sampling turn ${index + 1} changed`);
    return Object.freeze({ ...turn });
  });
  return Object.freeze({ ...sampling, turns: Object.freeze(turns) });
}

function validateQualification(receipt, model) {
  invariant(receipt && receipt.receiptType === "tinyrustlm.model-qualification" &&
    receipt.phase === "model-qualification", "browser round parent is not model qualification");
  invariant(receipt.status === "pass" && receipt.evidenceClass === "local",
    "browser round requires passing local-native model qualification");
  invariant(receipt.receiptId === model.qualificationReceiptId,
    "browser round qualification receipt changed");
  invariant(receipt.publicSafeParameters.modelId === model.modelId &&
    receipt.publicSafeParameters.qualityClaim === "conversation-proven" &&
    receipt.publicSafeParameters.chatTemplateKind === model.chatTemplateKind &&
    receipt.publicSafeParameters.promptFormat === model.promptFormat &&
    receipt.publicSafeParameters.systemPromptSha256 === model.systemPromptSha256 &&
    receipt.publicSafeParameters.evaluator === model.evaluator &&
    receipt.publicSafeParameters.evaluationSamplingProfile ===
      model.evaluationSamplingProfile &&
    receipt.publicSafeParameters.modelSamplingProfile === model.modelSamplingProfile &&
    receipt.publicSafeParameters.samplingTemperature === model.samplingTemperature &&
    receipt.publicSafeParameters.samplingTopK === model.samplingTopK &&
    receipt.publicSafeParameters.samplingTopP === model.samplingTopP &&
    receipt.publicSafeParameters.samplingRepetitionPenalty ===
      model.samplingRepetitionPenalty,
  "browser round qualification identity or claim changed");
  invariant(receipt.inputHashes.chatTemplate === model.chatTemplateSha256 &&
    receipt.inputHashes.evalCases === model.evalCasesSha256 &&
    receipt.outputHashes.model === model.artifactSha256 &&
    receipt.outputHashes.manifest === model.manifestSha256 &&
    receipt.outputHashes.review === model.sourceEvidenceSha256 &&
    receipt.outputHashes.evaluation === model.qualityEvidenceSha256,
  "browser round artifacts do not match qualification");
  invariant(Array.isArray(receipt.toolBinaryHashes) &&
    receipt.toolBinaryHashes.length === 2 &&
    receipt.toolBinaryHashes[0] === model.slmPackSha256 &&
    receipt.toolBinaryHashes[1] === model.evalBinarySha256,
  "browser round qualification toolchain changed");
  invariant(receipt.sourceRevision === model.sourceRevision,
    "browser round qualification source revision changed");
  return receipt;
}

function configurationHash(options, qualification, execution) {
  const application = new URL(String(options.applicationUrl || ""));
  invariant(application.username === "" && application.password === "" &&
    application.hash === "", "browser campaign application URL is unsafe");
  return sha256(canonicalJson({
    schema: receiptType,
    campaignId: options.campaignId,
    round: options.round.round,
    modelId: options.model.modelId,
    modelArtifactSha256: options.model.artifactSha256,
    compositionGraphSha256: options.model.compositionGraphSha256,
    compositionActiveGraphSha256: options.model.compositionActiveGraphSha256,
    compositionId: options.model.compositionId,
    compositionGraphUrl: options.model.compositionGraphUrl,
    qualificationReceiptId: qualification.receiptId,
    manifestSha256: options.model.manifestSha256,
    qualityEvidenceSha256: options.model.qualityEvidenceSha256,
    sourceEvidenceSha256: options.model.sourceEvidenceSha256,
    evalCasesSha256: options.model.evalCasesSha256,
    chatTemplateSha256: options.model.chatTemplateSha256,
    promptFormat: options.model.promptFormat,
    systemPromptSha256: options.model.systemPromptSha256,
    modelSamplingProfile: options.model.modelSamplingProfile,
    roundSampling: options.round.sampling,
    runtimeIdentity: execution.runtimeIdentity,
    promptSha256: options.round.prompts.map((prompt) => sha256(String(prompt))),
    applicationOrigin: application.origin,
    viewport: execution.viewport,
    browserExecutableSha256: execution.browserExecutableSha256,
    playwrightVersion: execution.playwrightVersion
  }));
}

function matchingReceipts(store, options, hash) {
  return store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId && receipt.configurationHash === hash &&
    receipt.publicSafeParameters.round === options.round.round &&
    receipt.publicSafeParameters.modelId === options.model.modelId)
    .slice()
    .sort((left, right) => left.attempt - right.attempt ||
      left.receiptId.localeCompare(right.receiptId));
}

function persistBrowserRoundEvidence(options) {
  invariant(isPlainObject(options) && isPlainObject(options.round) && isPlainObject(options.model) &&
    isPlainObject(options.execution), "browser round receipt options are invalid");
  invariant(Array.isArray(options.round.prompts) && options.round.prompts.length >= 2 &&
    options.round.prompts.length <= 6, "browser round prompts are invalid");
  const store = new CampaignEvidenceStore(options.evidenceRoot, {
    knownSecrets: Array.isArray(options.knownSecrets) ? options.knownSecrets : []
  });
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "browser campaign evidence store contains quarantined files");
  const qualification = validateQualification(
    store.readReceipt(options.model.qualificationReceiptId), options.model);
  const execution = options.execution;
  invariant(execution.schema === executionSchema && execution.evidenceClass === "browser" &&
    execution.round === options.round.round && execution.modelId === options.model.modelId,
  "browser execution identity changed");
  requireSha256(execution.browserVersionSha256, "browserVersionSha256");
  requireSha256(execution.browserExecutableSha256, "browserExecutableSha256");
  requireSha256(execution.profileRootMarkerHash, "profileRootMarkerHash");
  requireSha256(execution.profileMarkerHash, "profileMarkerHash");
  requireSha256(execution.profileDeletionReceiptSha256, "profileDeletionReceiptSha256");
  invariant(sha256(String(execution.browserVersion)) === execution.browserVersionSha256,
    "browser version hash changed");
  const validated = validatedEvidence(execution, options.round);
  const composition = validatedComposition(execution, options.model);
  const runtimeIdentity = validatedRuntimeIdentity(execution, options.model);
  const sampling = validatedSampling(execution, options.round, options.model);
  const privacy = validatedPrivacy(execution);
  const configHash = configurationHash(options, qualification, execution);
  const matching = matchingReceipts(store, options, configHash);
  const sameAttempt = matching.find((receipt) =>
    receipt.status === execution.status &&
    receipt.outputHashes.rawConversation === validated.evidence.rawConversationSha256 &&
    receipt.outputHashes.profileDeletion === execution.profileDeletionReceiptSha256);
  if (sameAttempt) {
    return sameAttempt;
  }
  const previous = matching.at(-1) || null;
  const attempt = matching.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  const networkAuditSha256 = sha256(canonicalJson({
    requestCount: execution.networkRequestCount,
    publicPromptLeakCount: validated.evidence.publicPromptLeakCount,
    publicModelByteRequestCount: validated.evidence.publicModelByteRequestCount,
    unexpectedLocalAppRequestCount: validated.evidence.unexpectedLocalAppRequestCount,
    unexpectedThirdPartyRequestCount: validated.evidence.unexpectedThirdPartyRequestCount
  }));
  const privacyAuditSha256 = sha256(canonicalJson(privacy));
  const samplingAuditSha256 = sha256(canonicalJson(sampling));
  return store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: "browser-dogfood-round",
    attempt,
    status: execution.status,
    createdAtUtc: execution.startedAtUtc,
    completedAtUtc: execution.completedAtUtc,
    inputReceiptIds: [qualification.receiptId],
    inputHashes: {
      evaluation: qualification.outputHashes.evaluation,
      evalCases: options.model.evalCasesSha256,
      chatTemplate: options.model.chatTemplateSha256,
      compositionGraph: options.model.compositionGraphSha256,
      manifest: qualification.outputHashes.manifest,
      model: qualification.outputHashes.model,
      review: qualification.outputHashes.review,
      sourceEvidence: options.model.sourceEvidenceSha256,
      qualityEvidence: options.model.qualityEvidenceSha256
    },
    outputHashes: {
      networkAudit: networkAuditSha256,
      activeCompositionGraph: composition.activeGraphSha256,
      compositionGraph: composition.bundleSha256,
      profileDeletion: execution.profileDeletionReceiptSha256,
      privacyAudit: privacyAuditSha256,
      runtimeAdmission: runtimeIdentity.admissionSha256,
      samplingAudit: samplingAuditSha256,
      rawConversation: validated.evidence.rawConversationSha256
    },
    sourceRevision: qualification.sourceRevision,
    toolNames: ["tinyrustlm-fresh-browser-conversation", "chromium"],
    toolVersions: [executionSchema, String(execution.browserVersion)],
    toolBinaryHashes: [executorSha256(), execution.browserExecutableSha256],
    runtimeIdentifier: currentRuntimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      realBrowserProcess: true,
      persistentProfile: true,
      browserStateInspected: privacy.browserState.complete,
      immutableCompositionActivated: composition.activated,
      profileDeletionProven: validated.evidence.finalProfileDeleted,
      liveHostedServiceObserved: false
    },
    configurationHash: configHash,
    publicSafeParameters: {
      round: options.round.round,
      modelId: options.model.modelId,
      activeComposition: composition,
      runtimeIdentity,
      sampling: {
        maxTokens: sampling.maxTokens,
        temperature: sampling.temperature,
        topK: sampling.topK,
        topP: sampling.topP,
        seed: sampling.seed,
        repetitionPenalty: sampling.repetitionPenalty,
        observedTurnCount: sampling.turns.length
      },
      ...validated.evidence,
      failures: validated.evaluated.failures
    },
    boundedDiagnostics: {
      browserName: execution.browserName,
      browserVersion: execution.browserVersion,
      playwrightVersion: execution.playwrightVersion,
      failureCode: execution.failureCode,
      compositionActivationCount: composition.activationCount,
      compositionGraphRequestCount: composition.graphRequestCount,
      samplingTurnCount: sampling.turns.length,
      networkRequestCount: execution.networkRequestCount,
      profileScanComplete: privacy.profile.complete,
      profileSecretMatchCount: privacy.profile.matchCount,
      browserStateScanComplete: privacy.browserState.complete,
      browserStateSecretMatchCount: privacy.browserState.matchCount,
      browserStateItemCount: privacy.browserState.itemCount,
      consoleScanComplete: privacy.console.complete,
      consoleSecretMatchCount: privacy.console.matchCount,
      consoleEventCount: privacy.console.eventCount
    },
    blockerCode: execution.status === "pass" ? null : execution.failureCode,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "browser",
    supersedesReceiptIds: previous ? [previous.receiptId] : [],
    attestationReference: null
  }).receipt;
}

module.exports = Object.freeze({
  persistBrowserRoundEvidence,
  receiptType
});
