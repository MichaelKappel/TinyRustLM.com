"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const campaign = require("./dogfood-campaign.js");
const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");

const roundReceiptSchema = "tinyrustlm.dogfood_round_receipt.v3";
const roundReceiptType = "tinyrustlm.dogfood-round-v3";
const roundEvidenceClass = "fixture";
const redactionVersion = "tinyrustlm.public-receipt-redaction.v1";
const roundEvidenceFields = new Set([
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
const booleanEvidenceFields = new Set([
  "freshProfileBefore",
  "firstProfileDeleted",
  "finalProfileDeleted",
  "secondProfileFresh",
  "modelHashVerified",
  "manifestVerified",
  "qualityEvidenceVerified",
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
const integerEvidenceFields = new Set([
  "userMessageCount",
  "assistantMessageCount",
  "authoritativeResponseCount",
  "publicPromptLeakCount",
  "publicModelByteRequestCount",
  "unexpectedLocalAppRequestCount",
  "unexpectedThirdPartyRequestCount"
]);
const modelEvidenceFields = new Set([
  "modelId",
  "artifactSha256",
  "compositionGraphSha256",
  "compositionActiveGraphSha256",
  "compositionId",
  "manifestSha256",
  "sourceEvidenceSha256",
  "qualityEvidenceSha256",
  "qualificationReceiptId",
  "evalCasesSha256",
  "slmPackSha256",
  "evalBinarySha256",
  "chatTemplateKind",
  "chatTemplateSha256",
  "promptFormat",
  "systemPromptSha256",
  "evaluator",
  "evaluationSamplingProfile",
  "modelSamplingProfile",
  "samplingTemperature",
  "samplingTopK",
  "samplingTopP",
  "samplingRepetitionPenalty",
  "qualityEvidenceKind"
]);

// Throws a deterministic error when a campaign invariant is not satisfied.
function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Returns true only for ordinary JSON objects with no custom prototype.
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Hashes text using the campaign's standard SHA-256 identity representation.
function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

// Builds a prompt-binding configuration identity without persisting prompt text.
function configurationSha256(configuration) {
  const identity = {
    schema: configuration.schema,
    campaignId: configuration.campaignId,
    totalRuns: configuration.totalRuns,
    requiredModelCount: configuration.requiredModelCount,
    requiredMemoryContinuityRuns: configuration.requiredMemoryContinuityRuns,
    memoryEndpointsBaseUrl: configuration.memoryEndpointsBaseUrl,
    applicationUrl: configuration.applicationUrl,
    models: configuration.models,
    rounds: configuration.rounds
  };
  return sha256Text(canonicalJson(identity));
}

// Attempts to flush the containing directory after an atomic rename.
function syncDirectory(directoryPath) {
  let descriptor;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
  }
}

// Writes one JSON artifact through a synced same-directory temporary file.
function atomicWriteJson(filePath, value) {
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, payload, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    syncDirectory(directoryPath);
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    fs.rmSync(temporaryPath, { force: true });
  }
}

// Validates public-safe external blocker codes before including them in reports.
function sanitizeExternalBlockers(value) {
  if (value === undefined) {
    return [];
  }
  invariant(Array.isArray(value), "externalBlockers must be an array");
  return value.map((entry) => {
    const code = String(entry || "").trim();
    invariant(/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(code), "external blocker code is invalid");
    return code;
  });
}

// Restricts model verification output to cryptographic identities and claim kind.
function sanitizeModelEvidence(value, model) {
  invariant(isPlainObject(value), `model evidence is invalid for ${model.modelId}`);
  for (const key of Object.keys(value)) {
    invariant(modelEvidenceFields.has(key), `unknown model evidence field: ${key}`);
  }
  for (const key of modelEvidenceFields) {
    invariant(typeof value[key] === "string" && value[key].length > 0,
      `model evidence is missing ${key} for ${model.modelId}`);
  }
  invariant(value.modelId === model.modelId, `model evidence identity changed for ${model.modelId}`);
  invariant(value.artifactSha256 === model.artifactSha256,
    `model artifact evidence changed for ${model.modelId}`);
  for (const key of [
    "artifactSha256",
    "compositionGraphSha256",
    "compositionActiveGraphSha256",
    "manifestSha256",
    "sourceEvidenceSha256",
    "qualityEvidenceSha256",
    "evalCasesSha256",
    "slmPackSha256",
    "evalBinarySha256",
    "chatTemplateSha256",
    "systemPromptSha256"
  ]) {
    invariant(/^[a-f0-9]{64}$/.test(value[key]), `model evidence has invalid ${key} for ${model.modelId}`);
  }
  invariant(value.compositionGraphSha256 === model.compositionGraphSha256 &&
    value.compositionActiveGraphSha256 === model.compositionActiveGraphSha256 &&
    value.compositionId === model.compositionId &&
    /^composition-sha256-[a-f0-9]{64}$/.test(value.compositionId),
  `model composition evidence changed for ${model.modelId}`);
  invariant(/^[a-z0-9][a-z0-9._-]{2,127}$/.test(value.qualityEvidenceKind),
    `model evidence has invalid qualityEvidenceKind for ${model.modelId}`);
  for (const key of [
    "qualificationReceiptId",
    "evalCasesSha256",
    "slmPackSha256",
    "evalBinarySha256",
    "chatTemplateKind",
    "chatTemplateSha256",
    "promptFormat",
    "systemPromptSha256",
    "evaluator",
    "evaluationSamplingProfile",
    "modelSamplingProfile",
    "samplingTemperature",
    "samplingTopK",
    "samplingTopP",
    "samplingRepetitionPenalty"
  ]) {
    invariant(value[key] === String(model[key]),
      `model evidence changed ${key} for ${model.modelId}`);
  }
  return Object.freeze({
    modelId: value.modelId,
    artifactSha256: value.artifactSha256,
    compositionGraphSha256: value.compositionGraphSha256,
    compositionActiveGraphSha256: value.compositionActiveGraphSha256,
    compositionId: value.compositionId,
    manifestSha256: value.manifestSha256,
    sourceEvidenceSha256: value.sourceEvidenceSha256,
    qualityEvidenceSha256: value.qualityEvidenceSha256,
    qualificationReceiptId: value.qualificationReceiptId,
    evalCasesSha256: value.evalCasesSha256,
    slmPackSha256: value.slmPackSha256,
    evalBinarySha256: value.evalBinarySha256,
    chatTemplateKind: value.chatTemplateKind,
    chatTemplateSha256: value.chatTemplateSha256,
    promptFormat: value.promptFormat,
    systemPromptSha256: value.systemPromptSha256,
    evaluator: value.evaluator,
    evaluationSamplingProfile: value.evaluationSamplingProfile,
    modelSamplingProfile: value.modelSamplingProfile,
    samplingTemperature: value.samplingTemperature,
    samplingTopK: value.samplingTopK,
    samplingTopP: value.samplingTopP,
    samplingRepetitionPenalty: value.samplingRepetitionPenalty,
    qualityEvidenceKind: value.qualityEvidenceKind,
    evidenceClass: "fixture"
  });
}

// Restricts one executor result to the documented non-secret receipt fields.
function sanitizeRoundEvidence(value, round) {
  invariant(isPlainObject(value), `round ${round.round} evidence is invalid`);
  for (const key of Object.keys(value)) {
    invariant(roundEvidenceFields.has(key), `unknown evidence field: ${key}`);
  }
  for (const key of booleanEvidenceFields) {
    invariant(typeof value[key] === "boolean", `round ${round.round} evidence has invalid ${key}`);
  }
  for (const key of integerEvidenceFields) {
    invariant(Number.isSafeInteger(value[key]) && value[key] >= 0,
      `round ${round.round} evidence has invalid ${key}`);
  }
  invariant(/^[a-f0-9]{64}$/.test(String(value.rawConversationSha256 || "")),
    `round ${round.round} evidence has invalid rawConversationSha256`);
  invariant(value.memoryContinuityRequired === round.memoryContinuity,
    `round ${round.round} memory continuity requirement changed`);
  return Object.freeze({
    round: round.round,
    modelId: round.modelId,
    freshProfileBefore: value.freshProfileBefore,
    firstProfileDeleted: value.firstProfileDeleted,
    finalProfileDeleted: value.finalProfileDeleted,
    secondProfileFresh: value.secondProfileFresh,
    modelHashVerified: value.modelHashVerified,
    manifestVerified: value.manifestVerified,
    qualityEvidenceVerified: value.qualityEvidenceVerified,
    userMessageCount: value.userMessageCount,
    assistantMessageCount: value.assistantMessageCount,
    authoritativeResponseCount: value.authoritativeResponseCount,
    rawConversationSha256: value.rawConversationSha256,
    publicPromptLeakCount: value.publicPromptLeakCount,
    publicModelByteRequestCount: value.publicModelByteRequestCount,
    unexpectedLocalAppRequestCount: value.unexpectedLocalAppRequestCount,
    unexpectedThirdPartyRequestCount: value.unexpectedThirdPartyRequestCount,
    secretsPersisted: value.secretsPersisted,
    memoryContinuityRequired: value.memoryContinuityRequired,
    memoryShortTermRestored: value.memoryShortTermRestored,
    memoryLongTermRestored: value.memoryLongTermRestored,
    memoryAnswerRestored: value.memoryAnswerRestored,
    oneTimeUrlReplayRejected: value.oneTimeUrlReplayRejected,
    companyClosed: value.companyClosed,
    companyDeleted: value.companyDeleted,
    publicAnnouncementVerified: value.publicAnnouncementVerified
  });
}

// Creates non-passing evidence when the browser executor itself cannot return evidence.
function failedExecutorEvidence(round) {
  return Object.freeze({
    round: round.round,
    modelId: round.modelId,
    freshProfileBefore: false,
    firstProfileDeleted: false,
    finalProfileDeleted: false,
    secondProfileFresh: false,
    modelHashVerified: false,
    manifestVerified: false,
    qualityEvidenceVerified: false,
    userMessageCount: 0,
    assistantMessageCount: 0,
    authoritativeResponseCount: 0,
    rawConversationSha256: "0".repeat(64),
    publicPromptLeakCount: 0,
    publicModelByteRequestCount: 0,
    unexpectedLocalAppRequestCount: 0,
    unexpectedThirdPartyRequestCount: 0,
    secretsPersisted: false,
    memoryContinuityRequired: round.memoryContinuity,
    memoryShortTermRestored: false,
    memoryLongTermRestored: false,
    memoryAnswerRestored: false,
    oneTimeUrlReplayRejected: false,
    companyClosed: false,
    companyDeleted: false,
    publicAnnouncementVerified: false
  });
}

// Evaluates evidence and adds a public-safe executor failure code when necessary.
function evaluatedRound(evidence, executorFailed) {
  const evaluated = campaign.evaluateRoundEvidence(evidence);
  const failures = evaluated.failures.slice();
  if (executorFailed && !failures.includes("round_executor_failed")) {
    failures.push("round_executor_failed");
  }
  return Object.freeze({
    status: failures.length === 0 ? "pass" : "fail",
    failures: Object.freeze(failures),
    evidence
  });
}

// Returns all immutable attempts belonging to one configured round.
function matchingRoundReceipts(store, configuration, configHash, round) {
  return store.listReceipts((receipt) => receipt.receiptType === roundReceiptType &&
    receipt.campaignId === configuration.campaignId &&
    receipt.configurationHash === configHash &&
    receipt.evidenceClass === roundEvidenceClass &&
    receipt.publicSafeParameters.round === round.round &&
    receipt.publicSafeParameters.modelId === round.modelId)
    .slice()
    .sort((left, right) => left.attempt - right.attempt || left.receiptId.localeCompare(right.receiptId));
}

// Re-evaluates a prior passing immutable receipt before allowing resume.
function resumedRound(receipt, round) {
  if (!receipt || receipt.status !== "pass") {
    return null;
  }
  const evidenceInput = { ...receipt.publicSafeParameters };
  delete evidenceInput.round;
  delete evidenceInput.modelId;
  delete evidenceInput.failures;
  delete evidenceInput.executorFailed;
  const evidence = sanitizeRoundEvidence(evidenceInput, round);
  const evaluated = evaluatedRound(evidence, false);
  invariant(evaluated.status === "pass", `round ${round.round} passing receipt no longer passes`);
  return Object.freeze({
    ...evaluated,
    receiptId: receipt.receiptId,
    receiptContentHash: receipt.receiptContentHash,
    evidenceClass: receipt.evidenceClass,
    attempt: receipt.attempt,
    resumed: true
  });
}

function currentRuntimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function runnerBinarySha256() {
  return crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex");
}

// Persists one fixture attempt; a retry supersedes the pointer, never the receipt.
function writeRoundReceipt(store, configuration, configHash, round, model, modelEvidence, evaluated,
  executorFailed, attempt, createdAtUtc, previousReceipt) {
  const completedAtUtc = new Date().toISOString();
  const stored = store.putReceipt({
    receiptType: roundReceiptType,
    campaignId: configuration.campaignId,
    phase: "dogfood-round",
    attempt,
    status: evaluated.status,
    createdAtUtc,
    completedAtUtc,
    inputReceiptIds: [],
    inputHashes: {
      artifact: modelEvidence.artifactSha256,
      compositionGraph: modelEvidence.compositionGraphSha256,
      manifest: modelEvidence.manifestSha256,
      qualityEvidence: modelEvidence.qualityEvidenceSha256,
      sourceEvidence: modelEvidence.sourceEvidenceSha256
    },
    outputHashes: {
      rawConversation: evaluated.evidence.rawConversationSha256
    },
    sourceRevision: model.sourceRevision,
    toolNames: ["tinyrustlm-dogfood-campaign-runner"],
    toolVersions: ["2"],
    toolBinaryHashes: [runnerBinarySha256()],
    runtimeIdentifier: currentRuntimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      executionMode: "in-process-callback",
      liveBrowserObserved: false,
      liveServiceObserved: false
    },
    configurationHash: configHash,
    publicSafeParameters: {
      ...evaluated.evidence,
      failures: evaluated.failures,
      executorFailed
    },
    boundedDiagnostics: {
      failureCodes: evaluated.failures,
      executorFailed
    },
    blockerCode: evaluated.status === "pass" ? null : evaluated.failures[0],
    externalEvidenceReferences: [],
    redactionVersion,
    evidenceClass: roundEvidenceClass,
    supersedesReceiptIds: previousReceipt ? [previousReceipt.receiptId] : [],
    attestationReference: null
  }).receipt;
  return Object.freeze({
    ...evaluated,
    receiptId: stored.receiptId,
    receiptContentHash: stored.receiptContentHash,
    evidenceClass: stored.evidenceClass,
    attempt: stored.attempt,
    resumed: false
  });
}

// Updates a convenience index. Its receipt ID points to immutable authority.
function writeRoundIndex(filePath, configuration, configHash, round, evaluated) {
  atomicWriteJson(filePath, {
    schema: roundReceiptSchema,
    campaignId: configuration.campaignId,
    configurationSha256: configHash,
    round: round.round,
    modelId: round.modelId,
    receiptId: evaluated.receiptId,
    receiptContentHash: evaluated.receiptContentHash,
    evidenceClass: evaluated.evidenceClass,
    attempt: evaluated.attempt,
    status: evaluated.status
  });
}

// Runs or resumes the exact validated 20-model, 50-round dogfood campaign.
async function runCampaign(options) {
  invariant(isPlainObject(options), "campaign runner options are invalid");
  invariant(typeof options.executeRound === "function", "executeRound is required");
  const configuration = campaign.validateCampaignConfiguration(options.configuration, { checkFiles: false });
  const outputDir = path.resolve(String(options.outputDir || ""));
  invariant(String(options.outputDir || "").trim().length > 0, "outputDir is required");
  const verifyModel = options.verifyModel || campaign.verifyModelEvidence;
  invariant(typeof verifyModel === "function", "verifyModel is invalid");
  const configHash = configurationSha256(configuration);
  const modelEvidence = [];
  for (const model of configuration.models) {
    modelEvidence.push(sanitizeModelEvidence(await verifyModel(model), model));
  }
  const modelsById = new Map(configuration.models.map((model) => [model.modelId, model]));
  const modelEvidenceById = new Map(modelEvidence.map((evidence) => [evidence.modelId, evidence]));

  const roundsDirectory = path.join(outputDir, "rounds");
  fs.mkdirSync(roundsDirectory, { recursive: true });
  const evidenceStore = new CampaignEvidenceStore(path.join(outputDir, "evidence"), {
    knownSecrets: Array.isArray(options.knownSecrets) ? options.knownSecrets : []
  });
  const rebuild = evidenceStore.rebuild();
  const quarantineEntries = fs.readdirSync(evidenceStore.quarantinePath, { withFileTypes: true })
    .filter((entry) => entry.isFile());
  const rounds = [];
  for (const round of configuration.rounds) {
    const indexPath = path.join(roundsDirectory, `round-${String(round.round).padStart(4, "0")}.json`);
    const attempts = matchingRoundReceipts(evidenceStore, configuration, configHash, round);
    const resumed = resumedRound(attempts.filter((receipt) => receipt.status === "pass").at(-1), round);
    if (resumed) {
      writeRoundIndex(indexPath, configuration, configHash, round, resumed);
      rounds.push(resumed);
      continue;
    }

    const createdAtUtc = new Date().toISOString();
    let evidence;
    let executorFailed = false;
    try {
      evidence = sanitizeRoundEvidence(await options.executeRound(round, configuration), round);
    } catch (error) {
      if (/^(?:unknown evidence field|round \d+ evidence)/i.test(String(error && error.message))) {
        throw error;
      }
      executorFailed = true;
      evidence = failedExecutorEvidence(round);
    }
    const evaluated = evaluatedRound(evidence, executorFailed);
    const persisted = writeRoundReceipt(
      evidenceStore,
      configuration,
      configHash,
      round,
      modelsById.get(round.modelId),
      modelEvidenceById.get(round.modelId),
      evaluated,
      executorFailed,
      attempts.length === 0 ? 1 : attempts.at(-1).attempt + 1,
      createdAtUtc,
      attempts.at(-1) || null
    );
    writeRoundIndex(indexPath, configuration, configHash, round, persisted);
    rounds.push(persisted);
  }

  const externalBlockers = sanitizeExternalBlockers(options.externalBlockers);
  if ((rebuild.quarantined.length > 0 || quarantineEntries.length > 0) &&
      !externalBlockers.includes("campaign_evidence_quarantined")) {
    externalBlockers.push("campaign_evidence_quarantined");
  }
  const report = campaign.aggregateCampaign(
    configuration,
    modelEvidence,
    rounds,
    externalBlockers
  );
  const publicReport = Object.freeze({ ...report, configurationSha256: configHash });
  atomicWriteJson(path.join(outputDir, "campaign-report.json"), publicReport);
  return publicReport;
}

module.exports = Object.freeze({
  configurationSha256,
  roundReceiptSchema,
  runCampaign
});
