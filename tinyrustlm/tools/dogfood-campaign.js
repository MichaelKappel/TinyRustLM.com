"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const campaignSchema = "tinyrustlm.dogfood_campaign.v3";
const reportSchema = "tinyrustlm.dogfood_campaign_report.v3";
const requiredRunCount = 50;
const requiredModelCount = 20;
const requiredMemoryRunCount = 25;
const maximumCompositionGraphBytes = 16 * 1024 * 1024;
const currentConversationQualityScope =
  "assistant-quality-cognitive-liberty-conversation-gate";
const currentConversationGovernanceProfile = "cognitive-liberty-conversation-v1";
const currentConversationGovernanceRecord = "UAIX-GOVR-3429";
const currentConversationCaseCount = 14;
const currentConversationFixedCaseCount = 8;
const currentConversationHoldoutCount = 6;
const currentConversationHoldoutSeed = 2026071101;
const qualityClaims = new Set([
  "conversation-proven",
  "task-specific-proven",
  "full-assistant-quality"
]);
const promptFormats = new Set([
  "alpaca-instruct-v1",
  "chatml-v1",
  "qwen3-chatml-no-think-v1",
  "llama2-chat-v1"
]);
const modelSamplingProfiles = new Map([
  ["runtime-greedy-v1", Object.freeze({
    temperature: 0,
    topK: 1,
    topP: 1,
    repetitionPenalty: 1
  })],
  ["qwen2.5-generation-config-v1", Object.freeze({
    temperature: 0.7,
    topK: 20,
    topP: 0.8,
    repetitionPenalty: 1.1
  })],
  ["qwen3-generation-config-v1", Object.freeze({
    temperature: 0.6,
    topK: 20,
    topP: 0.95,
    repetitionPenalty: 1
  })],
  ["smollm2-reviewed-runtime-v1", Object.freeze({
    temperature: 0.7,
    topK: 40,
    topP: 0.9,
    repetitionPenalty: 4.25
  })]
]);
const campaignFields = Object.freeze([
  "schema",
  "campaignId",
  "totalRuns",
  "requiredModelCount",
  "requiredMemoryContinuityRuns",
  "memoryEndpointsBaseUrl",
  "applicationUrl",
  "models",
  "rounds"
]);
const modelFields = Object.freeze([
  "modelId",
  "artifactPath",
  "manifestPath",
  "sourceEvidencePath",
  "qualityEvidencePath",
  "artifactSha256",
  "artifactByteCount",
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
  "systemPrompt",
  "systemPromptSha256",
  "contextLength",
  "evaluator",
  "evaluationSamplingProfile",
  "modelSamplingProfile",
  "samplingTemperature",
  "samplingTopK",
  "samplingTopP",
  "samplingRepetitionPenalty",
  "compositionGraphPath",
  "compositionGraphUrl",
  "compositionGraphSha256",
  "compositionGraphByteCount",
  "compositionBaseModelId",
  "compositionId",
  "compositionActiveGraphSha256",
  "compositionRoutePolicyId",
  "compositionKvFormatId",
  "compositionPositionPolicySha256",
  "compositionMemberCount",
  "qualityClaim",
  "sourceModelId",
  "sourceRevision"
]);
const roundFields = Object.freeze([
  "round",
  "modelId",
  "memoryContinuity",
  "prompts",
  "viewport",
  "reducedMotion",
  "allowedOrigins",
  "sampling"
]);
const viewportFields = Object.freeze(["width", "height"]);
const samplingFields = Object.freeze([
  "maxTokens",
  "temperature",
  "topK",
  "topP",
  "seed"
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function exactObject(value, label, fields) {
  invariant(value && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)),
  `${label} must be a plain object`);
  const allowed = new Set(fields);
  const actual = Object.keys(value);
  const unknown = actual.filter((field) => !allowed.has(field));
  const missing = fields.filter((field) => !Object.hasOwn(value, field));
  invariant(unknown.length === 0,
    `${label} contains unknown field ${unknown[0]}`);
  invariant(missing.length === 0,
    `${label} is missing required field ${missing[0]}`);
}

function boundedText(value, label, minimum, maximum) {
  const text = String(value || "").trim();
  invariant(text.length >= minimum && text.length <= maximum, `${label} is invalid`);
  return text;
}

function normalizedPath(value, label) {
  const text = boundedText(value, label, 1, 4096);
  invariant(!text.includes("\0"), `${label} is invalid`);
  return path.resolve(text);
}

function requireSha256(value, label) {
  const hash = boundedText(value, label, 64, 64).toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(hash), `${label} is invalid`);
  return hash;
}

function requireContentId(value, label, prefix) {
  const contentId = boundedText(value, label, prefix.length + 64, prefix.length + 64);
  invariant(contentId.startsWith(prefix) &&
    /^[a-f0-9]{64}$/.test(contentId.slice(prefix.length)) &&
    !/^0{64}$/.test(contentId.slice(prefix.length)), `${label} is invalid`);
  return contentId;
}

function requireReceiptId(value, label) {
  return requireContentId(value, label, "sha256:");
}

function boundedString(value, label, maximum) {
  invariant(typeof value === "string" && value.length <= maximum &&
    !value.includes("\0"), `${label} is invalid`);
  return value;
}

function finiteNumber(value, label, minimum, maximum) {
  const number = Number(value);
  invariant(Number.isFinite(number) && number >= minimum && number <= maximum,
    `${label} is invalid`);
  return number;
}

function normalizedCompositionGraphUrl(value, applicationUrl, graphFileName) {
  const text = boundedText(value, "compositionGraphUrl", 8, 2048);
  const graphUrl = new URL(text, applicationUrl);
  invariant(graphUrl.origin === applicationUrl.origin &&
    graphUrl.username === "" && graphUrl.password === "" &&
    graphUrl.search === "" && graphUrl.hash === "",
  "compositionGraphUrl must be an uncredentialed application-origin URL");
  invariant(decodeURIComponent(graphUrl.pathname).split("/").at(-1) === graphFileName,
    "compositionGraphUrl must end in the exact composition graph file name");
  return graphUrl.href;
}

function normalizedModel(model, applicationUrl) {
  exactObject(model, "model entry", modelFields);
  const modelId = boundedText(model.modelId, "modelId", 3, 160);
  invariant(/^[A-Za-z0-9._/-]+$/.test(modelId), "modelId is invalid");
  const qualityClaim = boundedText(model.qualityClaim, "qualityClaim", 3, 64);
  invariant(qualityClaims.has(qualityClaim), "every model requires conversation quality evidence");
  const artifactSha256 = requireSha256(model.artifactSha256, "artifactSha256");
  const artifactByteCount = Number(model.artifactByteCount);
  invariant(
    Number.isSafeInteger(artifactByteCount) && artifactByteCount >= 1024 * 1024,
    "artifactByteCount is invalid"
  );
  const systemPrompt = boundedString(model.systemPrompt, "systemPrompt", 16 * 1024);
  invariant(systemPrompt.length > 0, "qualified conversation models require a systemPrompt");
  const systemPromptSha256 = requireSha256(model.systemPromptSha256, "systemPromptSha256");
  invariant(
    crypto.createHash("sha256").update(systemPrompt, "utf8").digest("hex") === systemPromptSha256,
    "systemPromptSha256 does not match systemPrompt"
  );
  const chatTemplateKind = boundedText(
    model.chatTemplateKind,
    "chatTemplateKind",
    3,
    96
  );
  invariant(chatTemplateKind === "revision-chatml-template-v1",
    "chatTemplateKind is unsupported");
  const promptFormat = boundedText(model.promptFormat, "promptFormat", 3, 96);
  invariant(promptFormats.has(promptFormat), "promptFormat is unsupported");
  const contextLength = Number(model.contextLength);
  invariant(Number.isSafeInteger(contextLength) &&
    contextLength >= 128 && contextLength <= 1_048_576,
  "contextLength is invalid");
  const evaluator = boundedText(model.evaluator, "evaluator", 3, 96);
  invariant(evaluator === "tinyrustlm-native-eval-runner", "evaluator is unsupported");
  const evaluationSamplingProfile = boundedText(
    model.evaluationSamplingProfile,
    "evaluationSamplingProfile",
    3,
    96
  );
  invariant(evaluationSamplingProfile === "task-adaptive-v1",
    "evaluationSamplingProfile is unsupported");
  const modelSamplingProfile = boundedText(
    model.modelSamplingProfile,
    "modelSamplingProfile",
    3,
    96
  );
  const expectedSampling = modelSamplingProfiles.get(modelSamplingProfile);
  invariant(expectedSampling, "modelSamplingProfile is unsupported");
  const samplingTemperature = finiteNumber(
    model.samplingTemperature,
    "samplingTemperature",
    0,
    5
  );
  const samplingTopK = Number(model.samplingTopK);
  invariant(Number.isSafeInteger(samplingTopK) && samplingTopK >= 1 && samplingTopK <= 100,
    "samplingTopK is invalid");
  const samplingTopP = finiteNumber(model.samplingTopP, "samplingTopP", 0.01, 1);
  const samplingRepetitionPenalty = finiteNumber(
    model.samplingRepetitionPenalty,
    "samplingRepetitionPenalty",
    1,
    128
  );
  invariant(
    samplingTemperature === expectedSampling.temperature &&
      samplingTopK === expectedSampling.topK &&
      samplingTopP === expectedSampling.topP &&
      samplingRepetitionPenalty === expectedSampling.repetitionPenalty,
    "model sampling values do not match modelSamplingProfile"
  );
  const compositionGraphPath = normalizedPath(
    model.compositionGraphPath,
    "compositionGraphPath"
  );
  const compositionGraphFileName = path.basename(compositionGraphPath);
  invariant(compositionGraphFileName.endsWith(".slm.acg1") &&
    /^[A-Za-z0-9._-]+$/.test(compositionGraphFileName),
  "compositionGraphPath must end in one route-safe .slm.acg1 file");
  const compositionGraphByteCount = Number(model.compositionGraphByteCount);
  invariant(Number.isSafeInteger(compositionGraphByteCount) &&
    compositionGraphByteCount >= 512 &&
    compositionGraphByteCount <= maximumCompositionGraphBytes &&
    compositionGraphByteCount % 64 === 0,
  "compositionGraphByteCount is invalid");
  const compositionMemberCount = Number(model.compositionMemberCount);
  invariant(Number.isSafeInteger(compositionMemberCount) &&
    compositionMemberCount >= 0 && compositionMemberCount <= 64,
  "compositionMemberCount is invalid");
  const sourceModelId = boundedText(model.sourceModelId, "sourceModelId", 3, 240);
  const sourceRevision = boundedText(model.sourceRevision, "sourceRevision", 40, 128);
  invariant(/^[a-fA-F0-9]{40,128}$/.test(sourceRevision), "sourceRevision must be immutable");
  return Object.freeze({
    modelId,
    artifactPath: normalizedPath(model.artifactPath, "artifactPath"),
    manifestPath: normalizedPath(model.manifestPath, "manifestPath"),
    sourceEvidencePath: normalizedPath(model.sourceEvidencePath, "sourceEvidencePath"),
    qualityEvidencePath: normalizedPath(model.qualityEvidencePath, "qualityEvidencePath"),
    artifactSha256,
    artifactByteCount,
    manifestSha256: requireSha256(model.manifestSha256, "manifestSha256"),
    sourceEvidenceSha256: requireSha256(
      model.sourceEvidenceSha256,
      "sourceEvidenceSha256"
    ),
    qualityEvidenceSha256: requireSha256(
      model.qualityEvidenceSha256,
      "qualityEvidenceSha256"
    ),
    qualificationReceiptId: requireReceiptId(
      model.qualificationReceiptId,
      "qualificationReceiptId"
    ),
    evalCasesSha256: requireSha256(model.evalCasesSha256, "evalCasesSha256"),
    slmPackSha256: requireSha256(model.slmPackSha256, "slmPackSha256"),
    evalBinarySha256: requireSha256(model.evalBinarySha256, "evalBinarySha256"),
    chatTemplateKind,
    chatTemplateSha256: requireSha256(
      model.chatTemplateSha256,
      "chatTemplateSha256"
    ),
    promptFormat,
    systemPrompt,
    systemPromptSha256,
    contextLength,
    evaluator,
    evaluationSamplingProfile,
    modelSamplingProfile,
    samplingTemperature,
    samplingTopK,
    samplingTopP,
    samplingRepetitionPenalty,
    compositionGraphPath,
    compositionGraphUrl: normalizedCompositionGraphUrl(
      model.compositionGraphUrl,
      applicationUrl,
      compositionGraphFileName
    ),
    compositionGraphSha256: requireSha256(
      model.compositionGraphSha256,
      "compositionGraphSha256"
    ),
    compositionGraphByteCount,
    compositionBaseModelId: requireContentId(
      model.compositionBaseModelId,
      "compositionBaseModelId",
      "model-sha256-"
    ),
    compositionId: requireContentId(
      model.compositionId,
      "compositionId",
      "composition-sha256-"
    ),
    compositionActiveGraphSha256: requireSha256(
      model.compositionActiveGraphSha256,
      "compositionActiveGraphSha256"
    ),
    compositionRoutePolicyId: requireContentId(
      model.compositionRoutePolicyId,
      "compositionRoutePolicyId",
      "route-sha256-"
    ),
    compositionKvFormatId: requireContentId(
      model.compositionKvFormatId,
      "compositionKvFormatId",
      "kv-format-sha256-"
    ),
    compositionPositionPolicySha256: requireSha256(
      model.compositionPositionPolicySha256,
      "compositionPositionPolicySha256"
    ),
    compositionMemberCount,
    qualityClaim,
    sourceModelId,
    sourceRevision: sourceRevision.toLowerCase()
  });
}

function normalizedAllowedOrigins(value, roundNumber, applicationOrigin) {
  invariant(value === undefined || Array.isArray(value),
    `round ${roundNumber} allowedOrigins must be an array`);
  const origins = (value || []).map((entry) => {
    const parsed = new URL(String(entry || ""));
    invariant(parsed.username === "" && parsed.password === "" &&
      parsed.search === "" && parsed.hash === "" && parsed.pathname === "/" &&
      (parsed.protocol === "https:" ||
        (parsed.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname))),
    `round ${roundNumber} allowed origin is invalid`);
    return parsed.origin;
  });
  invariant(origins.length <= 16 && new Set(origins).size === origins.length &&
    !origins.includes(applicationOrigin),
  `round ${roundNumber} allowed origins are duplicated or include the application origin`);
  return Object.freeze(origins);
}

function normalizedRound(round, modelsById, applicationUrl) {
  exactObject(round, "round entry", roundFields);
  const roundNumber = Number(round.round);
  invariant(Number.isSafeInteger(roundNumber) && roundNumber >= 1, "round number is invalid");
  const modelId = boundedText(round.modelId, "round modelId", 3, 160);
  const model = modelsById.get(modelId);
  invariant(model, `round ${roundNumber} references an unknown model`);
  invariant(typeof round.memoryContinuity === "boolean",
    `round ${roundNumber} memoryContinuity must be boolean`);
  invariant(typeof round.reducedMotion === "boolean",
    `round ${roundNumber} reducedMotion must be boolean`);
  invariant(Array.isArray(round.prompts) && round.prompts.length >= 2 && round.prompts.length <= 6,
    `round ${roundNumber} must contain a full multi-turn conversation`);
  const prompts = round.prompts.map((prompt, index) =>
    boundedText(prompt, `round ${roundNumber} prompt ${index + 1}`, 3, 4000));
  const viewport = round.viewport;
  exactObject(viewport, `round ${roundNumber} viewport`, viewportFields);
  invariant(Number.isSafeInteger(viewport.width) && viewport.width >= 320 && viewport.width <= 3840 &&
    Number.isSafeInteger(viewport.height) && viewport.height >= 480 && viewport.height <= 2160,
  `round ${roundNumber} viewport is invalid`);
  exactObject(round.sampling, `round ${roundNumber} sampling`, samplingFields);
  const maxTokens = Number(round.sampling.maxTokens);
  const temperature = finiteNumber(
    round.sampling.temperature,
    `round ${roundNumber} sampling temperature`,
    0,
    5
  );
  const topK = Number(round.sampling.topK);
  const topP = finiteNumber(
    round.sampling.topP,
    `round ${roundNumber} sampling topP`,
    0.01,
    1
  );
  const seed = Number(round.sampling.seed);
  invariant(Number.isSafeInteger(maxTokens) && maxTokens >= 1 &&
    maxTokens <= 1024 && maxTokens < model.contextLength,
  `round ${roundNumber} sampling maxTokens is invalid`);
  invariant(Number.isSafeInteger(topK) && topK >= 1 && topK <= 100,
    `round ${roundNumber} sampling topK is invalid`);
  invariant(Number.isSafeInteger(seed) && seed >= 0 && seed <= 4_294_967_295,
    `round ${roundNumber} sampling seed is invalid`);
  invariant(
    temperature === model.samplingTemperature &&
      topK === model.samplingTopK &&
      topP === model.samplingTopP,
    `round ${roundNumber} sampling does not match the qualified model profile`
  );
  return Object.freeze({
    round: roundNumber,
    modelId,
    memoryContinuity: round.memoryContinuity,
    prompts: Object.freeze(prompts),
    viewport: Object.freeze({ width: viewport.width, height: viewport.height }),
    reducedMotion: round.reducedMotion,
    sampling: Object.freeze({ maxTokens, temperature, topK, topP, seed }),
    allowedOrigins: normalizedAllowedOrigins(
      round.allowedOrigins,
      roundNumber,
      applicationUrl.origin
    )
  });
}

function validateFilePresence(model) {
  for (const [label, filePath] of [
    ["artifact", model.artifactPath],
    ["composition graph", model.compositionGraphPath],
    ["manifest", model.manifestPath],
    ["source evidence", model.sourceEvidencePath],
    ["quality evidence", model.qualityEvidencePath]
  ]) {
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    invariant(stat && stat.isFile(), `${label} file is missing for ${model.modelId}`);
    if (label === "artifact") {
      invariant(stat.size === model.artifactByteCount, `artifact byte count changed for ${model.modelId}`);
    } else if (label === "composition graph") {
      invariant(stat.size === model.compositionGraphByteCount,
        `composition graph byte count changed for ${model.modelId}`);
    } else {
      invariant(stat.size > 0 && stat.size <= 4 * 1024 * 1024, `${label} file is outside its size limit`);
    }
  }
}

function validateCampaignConfiguration(value, options) {
  const settings = options || {};
  exactObject(value, "campaign configuration", campaignFields);
  invariant(value.schema === campaignSchema, `campaign schema must be ${campaignSchema}`);
  invariant(Number(value.totalRuns) === requiredRunCount, "campaign must declare exactly 50 runs");
  invariant(Number(value.requiredModelCount) === requiredModelCount, "campaign must require exactly 20 models");
  invariant(
    Number(value.requiredMemoryContinuityRuns) === requiredMemoryRunCount,
    "campaign must require exactly 25 memory continuity rounds"
  );
  const campaignId = boundedText(value.campaignId, "campaignId", 8, 160);
  invariant(/^[A-Za-z0-9._-]+$/.test(campaignId), "campaignId is invalid");
  const memoryEndpointsBaseUrl = boundedText(
    value.memoryEndpointsBaseUrl,
    "memoryEndpointsBaseUrl",
    8,
    2048
  );
  const memoryUrl = new URL(memoryEndpointsBaseUrl);
  invariant(
    memoryUrl.protocol === "https:" ||
      (memoryUrl.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(memoryUrl.hostname)),
    "memoryEndpointsBaseUrl must use HTTPS except for loopback tests"
  );
  invariant(!memoryUrl.username && !memoryUrl.password && !memoryUrl.search && !memoryUrl.hash,
    "memoryEndpointsBaseUrl must not contain credentials");
  const applicationUrl = new URL(String(value.applicationUrl));
  invariant(applicationUrl.protocol === "https:" ||
    (applicationUrl.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(applicationUrl.hostname)),
  "applicationUrl must use HTTPS except for loopback tests");
  invariant(applicationUrl.username === "" && applicationUrl.password === "" &&
    applicationUrl.search === "" && applicationUrl.hash === "",
  "applicationUrl must not contain credentials, a query, or a fragment");

  invariant(Array.isArray(value.models) && value.models.length === requiredModelCount,
    "campaign must contain exactly 20 model entries");
  const models = value.models.map((model) => normalizedModel(model, applicationUrl));
  const modelIds = new Set(models.map((model) => model.modelId));
  invariant(modelIds.size === requiredModelCount, "campaign requires 20 distinct model identities");
  const artifactHashes = new Set(models.map((model) => model.artifactSha256));
  invariant(artifactHashes.size === requiredModelCount,
    "campaign requires 20 distinct model artifacts, not relabeled duplicate bytes");
  const qualificationReceiptIds =
    new Set(models.map((model) => model.qualificationReceiptId));
  invariant(qualificationReceiptIds.size === requiredModelCount,
    "campaign requires one distinct qualification receipt per model");

  invariant(Array.isArray(value.rounds) && value.rounds.length === requiredRunCount,
    "campaign must contain exactly 50 rounds");
  const modelsById = new Map(models.map((model) => [model.modelId, model]));
  const rounds = value.rounds.map((round) =>
    normalizedRound(round, modelsById, applicationUrl));
  const roundNumbers = rounds.map((round) => round.round).sort((left, right) => left - right);
  invariant(
    roundNumbers.every((roundNumber, index) => roundNumber === index + 1),
    "campaign rounds must be numbered exactly 1 through 50"
  );
  invariant(
    rounds.filter((round) => round.memoryContinuity).length === requiredMemoryRunCount,
    "campaign requires exactly 25 memory continuity rounds"
  );
  invariant(rounds.some((round) => round.viewport.width <= 480) &&
    rounds.some((round) => round.viewport.width >= 700 && round.viewport.width <= 1100) &&
    rounds.some((round) => round.viewport.width >= 1200),
  "campaign requires mobile, narrow-desktop, and desktop viewport coverage");
  invariant(rounds.some((round) => round.reducedMotion),
    "campaign requires reduced-motion browser coverage");
  const referencedModels = new Set(rounds.map((round) => round.modelId));
  invariant(referencedModels.size === requiredModelCount, "all 20 models must run in the campaign");
  for (const modelId of modelIds) {
    invariant(
      rounds.filter((round) => round.modelId === modelId).length >= 2,
      `model ${modelId} must be exercised in at least two clean restarts`
    );
  }
  if (settings.checkFiles !== false) {
    for (const model of models) {
      validateFilePresence(model);
    }
  }
  return Object.freeze({
    schema: campaignSchema,
    campaignId,
    totalRuns: requiredRunCount,
    requiredModelCount,
    requiredMemoryContinuityRuns: requiredMemoryRunCount,
    memoryEndpointsBaseUrl: memoryUrl.origin,
    applicationUrl: applicationUrl.href,
    models: Object.freeze(models),
    rounds: Object.freeze(rounds)
  });
}

function parseKeyValueDocument(text) {
  const fields = new Map();
  for (const line of String(text || "").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      const key = line.slice(0, separator);
      invariant(!fields.has(key), `evidence duplicated ${key}`);
      fields.set(key, line.slice(separator + 1));
    }
  }
  return fields;
}

function textChecksum(bytes) {
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const mask = 0xffffffffffffffffn;
  let accumulator = 0x4d595df4d0f33173n;
  for (let index = 0; index < input.length; index += 1) {
    accumulator ^= BigInt(input[index]) + (BigInt(index) << 2n);
    accumulator = ((accumulator << 9n) | (accumulator >> 55n)) & mask;
    accumulator = (accumulator * 0x100000001b3n) & mask;
  }
  return `0x${accumulator.toString(16).padStart(16, "0")}`;
}

function requireField(fields, name, expected, modelId) {
  const value = fields.get(name);
  invariant(value !== undefined && value !== "", `${modelId} evidence is missing ${name}`);
  if (expected !== undefined) {
    invariant(value === expected, `${modelId} evidence has invalid ${name}`);
  }
  return value;
}

function positiveIntegerField(fields, name, modelId) {
  const value = Number(requireField(fields, name, undefined, modelId));
  invariant(Number.isSafeInteger(value) && value > 0, `${modelId} evidence has invalid ${name}`);
  return value;
}

function validateSourceEvidence(model, sourceText) {
  const source = parseKeyValueDocument(sourceText);
  requireField(source, "tinyrustlm_safetensors_candidate_review_version", "1", model.modelId);
  requireField(source, "review_layout", "safetensors-real-trained-candidate-review-v1", model.modelId);
  requireField(source, "source_model_id", model.sourceModelId, model.modelId);
  const explicitRevision = source.get("source_revision");
  const sourcePath = requireField(source, "source_path", undefined, model.modelId).toLowerCase();
  invariant(
    explicitRevision
      ? explicitRevision.toLowerCase() === model.sourceRevision
      : sourcePath.includes(model.sourceRevision),
    `${model.modelId} source evidence does not bind the immutable source revision`
  );
  requireField(source, "source_config_artifact_status", "local-json-validated", model.modelId);
  requireField(source, "source_tokenizer_artifact_status", "local-json-validated", model.modelId);
  requireField(source, "source_license_artifact_status", "local-text-bound", model.modelId);
  const sourceSha = requireField(source, "source_model_sha", undefined, model.modelId)
    .replace(/^sha256:/, "").toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(sourceSha), `${model.modelId} source SHA-256 is invalid`);
  const matched = positiveIntegerField(source, "matched_tensor_count", model.modelId);
  const tensors = positiveIntegerField(source, "safetensors_tensor_count", model.modelId);
  invariant(matched === tensors, `${model.modelId} source evidence did not match every tensor`);
  return source;
}

function validateManifestEvidence(model, manifestText) {
  const manifest = parseKeyValueDocument(manifestText);
  requireField(manifest, "tinyrustlm_slm_manifest_version", "1", model.modelId);
  requireField(manifest, "source_kind", "converted-trained", model.modelId);
  requireField(manifest, "quality_claim", model.qualityClaim, model.modelId);
  invariant(
    Number(requireField(manifest, "model_bytes", undefined, model.modelId)) === model.artifactByteCount,
    `${model.modelId} manifest byte count changed`
  );
  invariant(/^0x[a-f0-9]{16}$/i.test(requireField(manifest, "slm_checksum", undefined, model.modelId)),
    `${model.modelId} manifest SLM checksum is invalid`);
  requireField(manifest, "prompt_format", model.promptFormat, model.modelId);
  requireField(manifest, "system_prompt", model.systemPrompt, model.modelId);
  requireField(manifest, "context_length", String(model.contextLength), model.modelId);
  requireField(manifest, "sampling_profile", model.modelSamplingProfile, model.modelId);
  invariant(
    Number(requireField(manifest, "sampling_temperature", undefined, model.modelId)) ===
      model.samplingTemperature &&
      Number(requireField(manifest, "sampling_top_k", undefined, model.modelId)) ===
        model.samplingTopK &&
      Number(requireField(manifest, "sampling_top_p", undefined, model.modelId)) ===
        model.samplingTopP &&
      Number(requireField(
        manifest,
        "sampling_repetition_penalty",
        undefined,
        model.modelId
      )) === model.samplingRepetitionPenalty,
    `${model.modelId} manifest sampling values changed`
  );
  invariant(!/pending|smoke|fixture/i.test(requireField(manifest, "admission_status", undefined, model.modelId)),
    `${model.modelId} manifest is not quality-admitted`);
  return manifest;
}

function validateCurrentRuntimeEval(model, quality, manifestText, manifest) {
  requireField(quality, "tinyrustlm_eval_manifest_version", "1", model.modelId);
  requireField(quality, "source_kind", "converted-trained", model.modelId);
  requireField(quality, "manifest_checksum", textChecksum(Buffer.from(manifestText)), model.modelId);
  requireField(quality, "slm_checksum", manifest.get("slm_checksum"), model.modelId);
  requireField(quality, "eval_status", "pass", model.modelId);
  requireField(quality, "task_eval_status", "pass", model.modelId);
  requireField(quality, "quality_decision", "accepted-for-assistant-quality", model.modelId);
  requireField(quality, "quality_gate_policy", "honest-assistant-quality-v1", model.modelId);
  requireField(quality, "quality_scope", currentConversationQualityScope, model.modelId);
  requireField(quality, "governance_profile", currentConversationGovernanceProfile, model.modelId);
  requireField(quality, "governance_record", currentConversationGovernanceRecord, model.modelId);
  requireField(quality, "arithmetic_policy", "calculator-tool-separated-v1", model.modelId);
  requireField(quality, "boundary_policy", "least-restrictive-concrete-harm-v1", model.modelId);
  requireField(quality, "prompt_format", model.promptFormat, model.modelId);
  requireField(quality, "system_prompt", model.systemPrompt, model.modelId);
  requireField(quality, "evaluator", model.evaluator, model.modelId);
  requireField(
    quality,
    "sampling_profile",
    model.evaluationSamplingProfile,
    model.modelId
  );
  requireField(
    quality,
    "model_sampling_profile",
    model.modelSamplingProfile,
    model.modelId
  );
  invariant(
    Number(requireField(
      quality,
      "model_sampling_temperature_ceiling",
      undefined,
      model.modelId
    )) === model.samplingTemperature &&
      Number(requireField(
        quality,
        "model_sampling_top_k_ceiling",
        undefined,
        model.modelId
      )) === model.samplingTopK &&
      Number(requireField(
        quality,
        "model_sampling_top_p_ceiling",
        undefined,
        model.modelId
      )) === model.samplingTopP &&
      Number(requireField(
        quality,
        "model_sampling_repetition_penalty",
        undefined,
        model.modelId
      )) === model.samplingRepetitionPenalty,
    `${model.modelId} evaluation sampling values changed`
  );
  requireField(quality, "no_cheat_status", "pass", model.modelId);
  requireField(quality, "no_cheat_failure_count", "0", model.modelId);
  requireField(quality, "cases_failed", "0", model.modelId);
  requireField(quality, "case_count", String(currentConversationCaseCount), model.modelId);
  requireField(quality, "expected_case_count", String(currentConversationCaseCount), model.modelId);
  requireField(quality, "cases_passed", String(currentConversationCaseCount), model.modelId);
  requireField(quality, "fixed_case_count", String(currentConversationFixedCaseCount), model.modelId);
  requireField(quality, "holdout_case_count", String(currentConversationHoldoutCount), model.modelId);
  requireField(quality, "holdout_seed", String(currentConversationHoldoutSeed), model.modelId);
  validateCompositionEvidence(model, quality);
  for (let index = 0; index < currentConversationCaseCount; index += 1) {
    const prefix = `case.${index}`;
    requireField(quality, `${prefix}.status`, "pass", model.modelId);
    requireField(
      quality,
      `${prefix}.origin`,
      index < currentConversationFixedCaseCount ? "fixed" : "holdout",
      model.modelId
    );
    requireField(quality, `${prefix}.output_transform`, "none", model.modelId);
    requireField(quality, `${prefix}.error`, "ok", model.modelId);
    const rawActual = requireField(quality, `${prefix}.raw_actual`, undefined, model.modelId).trim();
    invariant(!/^(?:empty-output|not-applicable)$/i.test(rawActual),
      `${model.modelId} case ${index} did not preserve raw output`);
    const diagnostics = requireField(quality, `${prefix}.diagnostics`, undefined, model.modelId);
    invariant(/"model_loaded"\s*:\s*true/.test(diagnostics) &&
      /"last_error"\s*:\s*"ok"/.test(diagnostics),
    `${model.modelId} case ${index} did not prove clean runtime execution`);
  }
  return "passing-current-cognitive-liberty-eval";
}

function validateCompositionEvidence(model, quality) {
  requireField(
    quality,
    "composition_graph_activation_status",
    "activated-before-eval",
    model.modelId
  );
  requireField(
    quality,
    "composition_graph_file",
    path.basename(model.compositionGraphPath),
    model.modelId
  );
  requireField(
    quality,
    "composition_graph_bytes",
    String(model.compositionGraphByteCount),
    model.modelId
  );
  requireField(
    quality,
    "composition_graph_sha256",
    `sha256:${model.compositionGraphSha256}`,
    model.modelId
  );
  requireField(
    quality,
    "composition_base_model_id",
    model.compositionBaseModelId,
    model.modelId
  );
  requireField(quality, "composition_id", model.compositionId, model.modelId);
  requireField(
    quality,
    "composition_active_graph_sha256",
    `sha256:${model.compositionActiveGraphSha256}`,
    model.modelId
  );
  requireField(
    quality,
    "composition_route_policy_id",
    model.compositionRoutePolicyId,
    model.modelId
  );
  requireField(
    quality,
    "composition_kv_format_id",
    model.compositionKvFormatId,
    model.modelId
  );
  requireField(
    quality,
    "composition_position_policy_sha256",
    `sha256:${model.compositionPositionPolicySha256}`,
    model.modelId
  );
  requireField(
    quality,
    "composition_member_count",
    String(model.compositionMemberCount),
    model.modelId
  );
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

async function verifyModelEvidence(model) {
  validateFilePresence(model);
  const artifactSha256 = await sha256File(model.artifactPath);
  invariant(artifactSha256 === model.artifactSha256, `artifact SHA-256 changed for ${model.modelId}`);
  const compositionGraphSha256 = await sha256File(model.compositionGraphPath);
  invariant(compositionGraphSha256 === model.compositionGraphSha256,
    `composition graph SHA-256 changed for ${model.modelId}`);
  const manifestText = fs.readFileSync(model.manifestPath, "utf8");
  const sourceText = fs.readFileSync(model.sourceEvidencePath, "utf8");
  const qualityText = fs.readFileSync(model.qualityEvidencePath, "utf8");
  const manifestSha256 = crypto.createHash("sha256").update(manifestText).digest("hex");
  const sourceEvidenceSha256 =
    crypto.createHash("sha256").update(sourceText).digest("hex");
  const qualityEvidenceSha256 =
    crypto.createHash("sha256").update(qualityText).digest("hex");
  invariant(manifestSha256 === model.manifestSha256,
    `manifest SHA-256 changed for ${model.modelId}`);
  invariant(sourceEvidenceSha256 === model.sourceEvidenceSha256,
    `source evidence SHA-256 changed for ${model.modelId}`);
  invariant(qualityEvidenceSha256 === model.qualityEvidenceSha256,
    `quality evidence SHA-256 changed for ${model.modelId}`);
  invariant(!/deterministic-smoke|runtime-smoke-only/i.test(manifestText),
    `${model.modelId} is a fixture or runtime-smoke artifact`);
  const manifest = validateManifestEvidence(model, manifestText);
  validateSourceEvidence(model, sourceText);
  const quality = parseKeyValueDocument(qualityText);
  const qualityEvidenceKind = validateCurrentRuntimeEval(
    model,
    quality,
    manifestText,
    manifest
  );
  return Object.freeze({
    modelId: model.modelId,
    artifactSha256,
    compositionGraphSha256,
    compositionActiveGraphSha256: model.compositionActiveGraphSha256,
    compositionId: model.compositionId,
    manifestSha256,
    sourceEvidenceSha256,
    qualityEvidenceSha256,
    qualificationReceiptId: model.qualificationReceiptId,
    evalCasesSha256: model.evalCasesSha256,
    slmPackSha256: model.slmPackSha256,
    evalBinarySha256: model.evalBinarySha256,
    chatTemplateKind: model.chatTemplateKind,
    chatTemplateSha256: model.chatTemplateSha256,
    promptFormat: model.promptFormat,
    systemPromptSha256: model.systemPromptSha256,
    evaluator: model.evaluator,
    evaluationSamplingProfile: model.evaluationSamplingProfile,
    modelSamplingProfile: model.modelSamplingProfile,
    samplingTemperature: String(model.samplingTemperature),
    samplingTopK: String(model.samplingTopK),
    samplingTopP: String(model.samplingTopP),
    samplingRepetitionPenalty: String(model.samplingRepetitionPenalty),
    qualityEvidenceKind
  });
}

function evaluateRoundEvidence(value) {
  const evidence = Object.freeze({ ...(value || {}) });
  const failures = [];
  const requireTrue = (field, code) => {
    if (evidence[field] !== true) {
      failures.push(code);
    }
  };
  requireTrue("freshProfileBefore", "browser_profile_not_fresh");
  requireTrue("firstProfileDeleted", "first_browser_profile_not_deleted");
  requireTrue("finalProfileDeleted", "final_browser_profile_not_deleted");
  requireTrue("modelHashVerified", "model_hash_not_verified");
  requireTrue("manifestVerified", "manifest_not_verified");
  requireTrue("qualityEvidenceVerified", "quality_evidence_not_verified");
  if (!Number.isInteger(evidence.userMessageCount) || evidence.userMessageCount < 2) {
    failures.push("full_user_conversation_missing");
  }
  if (!Number.isInteger(evidence.assistantMessageCount) ||
      evidence.assistantMessageCount !== evidence.userMessageCount) {
    failures.push("full_assistant_conversation_missing");
  }
  if (evidence.authoritativeResponseCount !== 1) {
    failures.push("duplicate_response_renderer");
  }
  if (!/^[a-f0-9]{64}$/.test(String(evidence.rawConversationSha256 || ""))) {
    failures.push("raw_conversation_receipt_missing");
  }
  if (evidence.publicPromptLeakCount !== 0) {
    failures.push("public_prompt_leak_detected");
  }
  if (evidence.publicModelByteRequestCount !== 0) {
    failures.push("public_model_byte_request_detected");
  }
  if (evidence.unexpectedLocalAppRequestCount !== 0) {
    failures.push("unexpected_local_app_request_detected");
  }
  if (evidence.unexpectedThirdPartyRequestCount !== 0) {
    failures.push("unexpected_third_party_request_detected");
  }
  if (evidence.secretsPersisted !== false) {
    failures.push("secret_persistence_detected");
  }
  if (evidence.memoryContinuityRequired === true) {
    requireTrue("secondProfileFresh", "restore_browser_profile_not_fresh");
    requireTrue("memoryShortTermRestored", "short_term_memory_not_restored");
    requireTrue("memoryLongTermRestored", "long_term_memory_not_restored");
    requireTrue("memoryAnswerRestored", "model_did_not_use_restored_memory");
    requireTrue("oneTimeUrlReplayRejected", "one_time_url_replay_not_rejected");
    requireTrue("companyClosed", "memory_company_not_closed");
    requireTrue("companyDeleted", "memory_company_not_deleted");
  }
  return Object.freeze({
    status: failures.length === 0 ? "pass" : "fail",
    failures: Object.freeze(failures),
    evidence
  });
}

function aggregateCampaign(configuration, modelEvidence, rounds, externalBlockers) {
  const fixtureRounds = rounds.filter((round) => round.evidenceClass === "fixture");
  const liveRounds = rounds.filter((round) =>
    round.evidenceClass === "browser" || round.evidenceClass === "live-service");
  const passedRounds = liveRounds.filter((round) => round.status === "pass").length;
  const fixturePassed = fixtureRounds.filter((round) => round.status === "pass").length;
  const memoryPassed = liveRounds.filter((round) => round.evidenceClass === "live-service" &&
    round.evidence.memoryContinuityRequired === true && round.status === "pass").length;
  const fixtureMemoryPassed = fixtureRounds.filter((round) =>
    round.evidence.memoryContinuityRequired === true && round.status === "pass").length;
  const qualityVerifiedModels = modelEvidence.filter((evidence) => evidence.evidenceClass !== "fixture").length;
  const fixtureVerifiedModels = modelEvidence.filter((evidence) => evidence.evidenceClass === "fixture").length;
  // Announcements and outside-network proof are separate signed receipt classes.
  // A browser-round callback cannot establish either fact.
  const externallyProvenLanes = 0;
  const announcedModels = 0;
  const blockers = Array.isArray(externalBlockers) ? externalBlockers.slice() : [];
  const complete = passedRounds === requiredRunCount &&
    memoryPassed === requiredMemoryRunCount &&
    qualityVerifiedModels === requiredModelCount &&
    externallyProvenLanes === requiredModelCount * 2 &&
    announcedModels === requiredModelCount &&
    blockers.length === 0;
  return Object.freeze({
    schema: reportSchema,
    campaignId: configuration.campaignId,
    generatedUtc: new Date().toISOString(),
    status: complete ? "pass" : "incomplete",
    requiredRuns: requiredRunCount,
    passedRuns: passedRounds,
    fixtureValidatedRuns: fixturePassed,
    requiredMemoryContinuityRuns: requiredMemoryRunCount,
    passedMemoryContinuityRuns: memoryPassed,
    fixtureValidatedMemoryContinuityRuns: fixtureMemoryPassed,
    requiredModels: requiredModelCount,
    qualityVerifiedModels,
    fixtureVerifiedModels,
    requiredExternalLaneProofs: requiredModelCount * 2,
    externallyProvenLanes,
    requiredAnnouncements: requiredModelCount,
    publiclySharedModels: announcedModels,
    announcedModels,
    externalBlockers: Object.freeze(blockers),
    modelEvidence: Object.freeze(modelEvidence.slice()),
    rounds: Object.freeze(rounds.slice())
  });
}

module.exports = Object.freeze({
  aggregateCampaign,
  campaignSchema,
  evaluateRoundEvidence,
  reportSchema,
  sha256File,
  textChecksum,
  validateCampaignConfiguration,
  verifyModelEvidence
});
