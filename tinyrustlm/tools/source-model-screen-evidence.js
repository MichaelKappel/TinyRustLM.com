"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");

const assessmentSchema = "tinyrustlm.source_model_screen_assessment.v1";
const screenSchema = "tinyrustlm.reference_raw_quality.v4";
const receiptType = "tinyrustlm.model-source-screen-v1";
const captureToolVersion = "6";
const toolVersion = "11";
const maximumJsonBytes = 256 * 1024;
const maximumSourceBytes = 8 * 1024 * 1024 * 1024;
const maximumWeightArtifactCount = 256;
const maximumTokenizerBytes = 64 * 1024 * 1024;
const maximumGenerationAuthorityBytes = 1024 * 1024;
const executionArtifactNames = Object.freeze([
  "generation_config.json",
  "special_tokens_map.json",
  "added_tokens.json",
  "merges.txt",
  "vocab.json",
  "tokenizer.model",
  "chat_template.jinja"
]);
const sha256Pattern = /^[a-f0-9]{64}$/;
const sourceRevisionPattern = /^[a-f0-9]{40,64}$/;
const modelIdPattern = /^[A-Za-z0-9._-]{1,96}\/[A-Za-z0-9._-]{1,160}$/;
const codePattern = /^[a-z0-9][a-z0-9._-]{2,127}$/;

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

function sha256File(filePath, maximumBytes = maximumSourceBytes) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${path.basename(filePath)} is not a regular file`);
  invariant(stat.size > 0 && stat.size <= maximumBytes, `${path.basename(filePath)} has an invalid size`);
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let offset = 0;
    while (offset < stat.size) {
      const read = fs.readSync(descriptor, buffer, 0, Math.min(buffer.length, stat.size - offset), offset);
      invariant(read > 0, `${path.basename(filePath)} ended while hashing`);
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({ bytes: stat.size, sha256: digest.digest("hex") });
}

function readJson(filePath, label, maximumBytes = maximumJsonBytes) {
  const artifact = sha256File(filePath, maximumBytes);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  invariant(isPlainObject(value), `${label} must be an object`);
  return Object.freeze({ artifact, value });
}

function safeSourceFile(sourceRoot, name, label, maximumBytes = maximumSourceBytes) {
  invariant(typeof name === "string" && name.length > 0 && name.length <= 255 &&
    path.basename(name) === name && !name.includes(".."), `${label} name is unsafe`);
  const resolvedRoot = path.resolve(sourceRoot);
  const filePath = path.resolve(resolvedRoot, name);
  invariant(path.dirname(filePath) === resolvedRoot, `${label} escapes the source root`);
  invariant(fs.existsSync(filePath), `${label} is missing`);
  return Object.freeze({ name, ...sha256File(filePath, maximumBytes) });
}

function hasDefaultEmbeddedChatTemplate(value) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => isPlainObject(entry) && entry.name === "default" &&
      typeof entry.template === "string" && entry.template.trim().length > 0);
  }
  return isPlainObject(value) && typeof value.default === "string" &&
    value.default.trim().length > 0;
}

function sourceCheckpointArtifacts(sourceRoot) {
  const resolvedRoot = path.resolve(sourceRoot);
  const directPath = path.join(resolvedRoot, "model.safetensors");
  const indexPath = path.join(resolvedRoot, "model.safetensors.index.json");
  const hasDirect = fs.existsSync(directPath);
  const hasIndex = fs.existsSync(indexPath);
  invariant(hasDirect !== hasIndex,
    "source checkpoint must contain either direct or indexed safetensors weights");

  let modelFiles;
  let identityKind;
  if (hasDirect) {
    modelFiles = Object.freeze([
      safeSourceFile(resolvedRoot, "model.safetensors", "source model weights")
    ]);
    identityKind = "direct-safetensors-sha256";
  } else {
    const index = readJson(indexPath, "source model weight index");
    const weightMap = index.value.weight_map;
    invariant(isPlainObject(weightMap) && Object.keys(weightMap).length > 0,
      "source model weight index has no tensor mappings");
    const shardNames = [...new Set(Object.entries(weightMap).map(([tensorName, shardName]) => {
      invariant(typeof tensorName === "string" && tensorName.length > 0 && tensorName.length <= 512,
        "source model weight index has an invalid tensor name");
      invariant(typeof shardName === "string" && shardName.endsWith(".safetensors"),
        "source model weight index has an invalid shard name");
      return shardName;
    }))].sort();
    invariant(shardNames.length > 0 && shardNames.length < maximumWeightArtifactCount,
      "source model weight shard count is invalid");
    modelFiles = Object.freeze([
      Object.freeze({ name: "model.safetensors.index.json", ...index.artifact }),
      ...shardNames.map((name) => safeSourceFile(resolvedRoot, name, "source model weight shard"))
    ]);
    identityKind = "indexed-safetensors-set-v1";
  }

  const modelSha256 = hasDirect
    ? modelFiles[0].sha256
    : sha256(canonicalJson(modelFiles.map(({ name, bytes, sha256: digest }) => ({
      name,
      bytes,
      sha256: digest
    }))));
  const config = safeSourceFile(resolvedRoot, "config.json", "source config", maximumJsonBytes);
  const tokenizer = safeSourceFile(
    resolvedRoot, "tokenizer.json", "source tokenizer", maximumTokenizerBytes);
  const tokenizerConfigRead = readJson(
    path.join(resolvedRoot, "tokenizer_config.json"),
    "source tokenizer config",
    maximumTokenizerBytes);
  const tokenizerConfig = Object.freeze({
    name: "tokenizer_config.json",
    ...tokenizerConfigRead.artifact
  });
  const executionFiles = executionArtifactNames.flatMap((name) => {
    const filePath = path.join(resolvedRoot, name);
    return fs.existsSync(filePath)
      ? [safeSourceFile(resolvedRoot, name, `source ${name}`, maximumTokenizerBytes)]
      : [];
  });
  const generationConfigPath = path.join(resolvedRoot, "generation_config.json");
  const sourceGenerationConfig = fs.existsSync(generationConfigPath)
    ? readJson(generationConfigPath, "source generation config", maximumTokenizerBytes).value
    : {};
  invariant(!fs.existsSync(path.join(resolvedRoot, "chat_templates")),
    "source chat_templates directories are unsupported until every selected template can be bound");
  const hasStandaloneChatTemplate = executionFiles.some(
    (artifact) => artifact.name === "chat_template.jinja");
  invariant(hasStandaloneChatTemplate ||
    hasDefaultEmbeddedChatTemplate(tokenizerConfigRead.value.chat_template),
  "source checkpoint has no bound default chat template");
  const executionInputs = Object.freeze([
    config,
    tokenizer,
    tokenizerConfig,
    ...executionFiles
  ]);
  const executionInputSha256 = sha256(canonicalJson(executionInputs.map(
    ({ name, bytes, sha256: digest }) => ({ name, bytes, sha256: digest }))));
  return Object.freeze({
    sourceRoot: resolvedRoot,
    config,
    tokenizer,
    tokenizerConfig,
    chatTemplateMode: hasStandaloneChatTemplate
      ? "standalone-jinja"
      : "embedded-tokenizer-config",
    executionFiles: Object.freeze(executionFiles),
    executionInputs,
    executionInputSha256,
    sourceGenerationConfig: Object.freeze(sourceGenerationConfig),
    model: Object.freeze({
      bytes: modelFiles.reduce((total, artifact) => total + artifact.bytes, 0),
      sha256: modelSha256
    }),
    modelFiles,
    identityKind
  });
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(canonicalJson(actual) === canonicalJson(wanted), `${label} fields are invalid`);
}

function requireSha256(value, label) {
  const normalized = String(value || "").toLowerCase();
  invariant(sha256Pattern.test(normalized), `${label} is not SHA-256`);
  return normalized;
}

function requireCode(value, label) {
  const normalized = String(value || "");
  invariant(codePattern.test(normalized), `${label} is invalid`);
  return normalized;
}

function tokenSha256(tokenIds, label) {
  invariant(Array.isArray(tokenIds) && tokenIds.length > 0 && tokenIds.length <= 131_072,
    `${label} token ids are invalid`);
  const bytes = Buffer.allocUnsafe(tokenIds.length * 4);
  tokenIds.forEach((tokenId, index) => {
    invariant(Number.isSafeInteger(tokenId) && tokenId >= 0 && tokenId <= 0xffffffff,
      `${label} token id is invalid`);
    bytes.writeUInt32LE(tokenId, index * 4);
  });
  return sha256(bytes);
}

function validTokenId(value) {
  if (Number.isSafeInteger(value) && value >= 0) {
    return true;
  }
  return Array.isArray(value) && value.length > 0 && value.length <= 16 &&
    new Set(value).size === value.length &&
    value.every((tokenId) => Number.isSafeInteger(tokenId) && tokenId >= 0);
}

function validatePublisherGenerationOverride(screen, artifacts) {
  const override = screen.publisher_generation_override;
  if (override === null) {
    return null;
  }
  invariant(isPlainObject(override), "publisher generation override is invalid");
  requireExactKeys(override, [
    "authority_file", "authority_file_bytes", "authority_file_sha256", "eos_token_id"
  ], "publisher generation override");
  invariant(typeof override.authority_file === "string",
    "publisher generation authority file is invalid");
  invariant(Number.isSafeInteger(override.authority_file_bytes) &&
    override.authority_file_bytes > 0 &&
    override.authority_file_bytes <= maximumGenerationAuthorityBytes,
  "publisher generation authority byte length is invalid");
  const authority = safeSourceFile(
    artifacts.sourceRoot,
    override.authority_file,
    "publisher generation authority",
    maximumGenerationAuthorityBytes
  );
  invariant(override.authority_file_bytes === authority.bytes &&
    requireSha256(override.authority_file_sha256, "publisher generation authority hash") ===
      authority.sha256,
  "publisher generation authority changed");
  invariant(validTokenId(override.eos_token_id),
    "publisher generation override EOS token IDs are invalid");
  return Object.freeze({
    authorityFile: authority.name,
    authorityBytes: authority.bytes,
    authoritySha256: authority.sha256,
    eosTokenId: override.eos_token_id
  });
}

function validateGenerationTokenIds(config, actual, label, publisherOverride) {
  invariant(isPlainObject(config), "bound source generation config is invalid");
  const eosTokenId = publisherOverride?.eosTokenId ??
    config.eos_token_id ?? actual.eos_token_id;
  const padTokenId = config.pad_token_id ??
    (publisherOverride ? actual.pad_token_id : eosTokenId);
  invariant(validTokenId(eosTokenId) && validTokenId(padTokenId),
    `${label} token IDs are invalid`);
  invariant(canonicalJson(actual.eos_token_id) === canonicalJson(eosTokenId) &&
    canonicalJson(actual.pad_token_id) === canonicalJson(padTokenId),
  `${label} token IDs changed`);
}

function expectedSourceGeneration(config, actual, publisherOverride) {
  invariant(isPlainObject(config), "bound source generation config is invalid");
  invariant(isPlainObject(actual), "source generation parameters are invalid");
  const doSample = Boolean(config.do_sample ?? false);
  const eosTokenId = publisherOverride?.eosTokenId ??
    config.eos_token_id ?? actual.eos_token_id;
  const padTokenId = config.pad_token_id ??
    (publisherOverride ? actual.pad_token_id : eosTokenId);
  invariant(validTokenId(eosTokenId) && validTokenId(padTokenId),
    "source generation token IDs are invalid");
  const repetitionPenalty = Number(config.repetition_penalty ?? 1.0);
  invariant(Number.isFinite(repetitionPenalty) && repetitionPenalty > 0,
    "source repetition penalty is invalid");
  const expected = {
    do_sample: doSample,
    repetition_penalty: repetitionPenalty,
    pad_token_id: padTokenId,
    eos_token_id: eosTokenId
  };
  if (doSample) {
    const temperature = Number(config.temperature ?? 1.0);
    const topK = Number(config.top_k ?? 50);
    const topP = Number(config.top_p ?? 1.0);
    invariant(Number.isFinite(temperature) && temperature > 0 &&
      Number.isSafeInteger(topK) && topK > 0 &&
      Number.isFinite(topP) && topP > 0 && topP <= 1,
    "bound source sampling profile is invalid");
    Object.assign(expected, {
      temperature,
      top_k: topK,
      top_p: topP
    });
  }
  return Object.freeze(expected);
}

function validateGenerationProfile(screen, artifacts) {
  invariant(isPlainObject(screen.source_generation_config) &&
    canonicalJson(screen.source_generation_config) ===
      canonicalJson(artifacts.sourceGenerationConfig),
  "source generation config changed");
  invariant(isPlainObject(screen.generation), "source screen generation parameters are invalid");
  const publisherOverride = validatePublisherGenerationOverride(screen, artifacts);
  if (screen.generation_profile === "greedy") {
    const expectedKeys = [
      "do_sample", "repetition_penalty", "pad_token_id", "eos_token_id",
      "temperature", "top_k", "top_p"
    ];
    requireExactKeys(screen.generation, expectedKeys, "greedy generation parameters");
    invariant(screen.generation.do_sample === false &&
      screen.generation.repetition_penalty === 1 &&
      validTokenId(screen.generation.pad_token_id) &&
      validTokenId(screen.generation.eos_token_id) &&
      screen.generation.temperature === null &&
      screen.generation.top_k === null &&
      screen.generation.top_p === null,
    "greedy generation parameters changed");
    validateGenerationTokenIds(
      artifacts.sourceGenerationConfig, screen.generation, "greedy generation", publisherOverride);
    return Object.freeze({
      profile: "greedy",
      samplingEnabled: false,
      publisherOverride
    });
  }
  if (screen.generation_profile === "explicit") {
    const expectedKeys = [
      "do_sample", "repetition_penalty", "pad_token_id", "eos_token_id",
      "temperature", "top_k", "top_p"
    ];
    requireExactKeys(screen.generation, expectedKeys, "explicit generation parameters");
    const sampled = screen.generation.do_sample === true;
    invariant(typeof screen.generation.do_sample === "boolean" &&
      Number.isFinite(screen.generation.repetition_penalty) &&
      screen.generation.repetition_penalty > 0 &&
      validTokenId(screen.generation.pad_token_id) &&
      validTokenId(screen.generation.eos_token_id),
    "explicit generation parameters are invalid");
    validateGenerationTokenIds(
      artifacts.sourceGenerationConfig, screen.generation, "explicit generation", publisherOverride);
    if (sampled) {
      invariant(Number.isFinite(screen.generation.temperature) &&
        screen.generation.temperature > 0 &&
        Number.isSafeInteger(screen.generation.top_k) && screen.generation.top_k > 0 &&
        Number.isFinite(screen.generation.top_p) &&
        screen.generation.top_p > 0 && screen.generation.top_p <= 1,
      "explicit sampled generation parameters are invalid");
    } else {
      invariant(screen.generation.temperature === null &&
        screen.generation.top_k === null && screen.generation.top_p === null,
      "explicit deterministic generation parameters are invalid");
    }
    return Object.freeze({
      profile: "explicit",
      samplingEnabled: sampled,
      parameters: Object.freeze({ ...screen.generation }),
      publisherOverride
    });
  }
  invariant(screen.generation_profile === "source",
    "source screen generation profile is unsupported");
  const expected = expectedSourceGeneration(
    artifacts.sourceGenerationConfig,
    screen.generation,
    publisherOverride
  );
  invariant(canonicalJson(screen.generation) === canonicalJson(expected),
    "source generation parameters changed");
  return Object.freeze({
    profile: "source",
    samplingEnabled: expected.do_sample,
    parameters: expected,
    publisherOverride
  });
}

function validateLoaderContract(screen) {
  invariant(screen.loader_contract === "local-files-no-remote-code-v1",
    "source screen loader contract is unsupported");
  invariant(screen.torch_compile_mode === "disabled-eager",
    "source screen torch compile mode changed");
  invariant(isPlainObject(screen.tokenizer_load_options),
    "source screen tokenizer load options are invalid");
  requireExactKeys(screen.tokenizer_load_options,
    ["local_files_only", "trust_remote_code", "fix_mistral_regex"],
    "source screen tokenizer load options");
  invariant(screen.tokenizer_load_options.local_files_only === true &&
    screen.tokenizer_load_options.trust_remote_code === false &&
    typeof screen.tokenizer_load_options.fix_mistral_regex === "boolean",
  "source screen tokenizer load options changed");
  invariant(isPlainObject(screen.model_load_options),
    "source screen model load options are invalid");
  requireExactKeys(screen.model_load_options,
    ["local_files_only", "trust_remote_code", "dtype"],
    "source screen model load options");
  invariant(screen.model_load_options.local_files_only === true &&
    screen.model_load_options.trust_remote_code === false &&
    screen.model_load_options.dtype === "float32",
  "source screen model load options changed");
  return Object.freeze({
    loaderContract: screen.loader_contract,
    torchCompileMode: screen.torch_compile_mode,
    fixMistralRegex: screen.tokenizer_load_options.fix_mistral_regex
  });
}

function validateSystemPromptContract(screen) {
  const mode = String(screen.system_prompt_mode || "");
  invariant(new Set(["included", "omitted-publisher-template"]).has(mode),
    "source screen system prompt mode is unsupported");
  invariant(typeof screen.system_prompt === "string",
    "source screen system prompt is invalid");
  if (mode === "included") {
    invariant(screen.system_prompt.length > 0 && screen.system_prompt === screen.system_prompt.trim() &&
      !screen.system_prompt.includes("\0") && Buffer.byteLength(screen.system_prompt, "utf8") <= 16 * 1024,
    "included source screen system prompt is invalid");
  } else {
    invariant(screen.system_prompt === "",
      "omitted source screen system prompt must be empty");
  }
  return Object.freeze({
    mode,
    sha256: sha256(Buffer.from(screen.system_prompt, "utf8"))
  });
}

function validateScreen(screen, artifacts) {
  invariant(screen.schema === screenSchema, "source screen schema is unsupported");
  invariant(modelIdPattern.test(String(screen.source_model_id || "")), "source model ID is invalid");
  invariant(sourceRevisionPattern.test(String(screen.source_revision || "")),
    "source revision must be immutable");
  invariant(screen.adapter === null, "source screen must not apply an adapter");
  invariant(screen.policy_examples === null, "source screen must not inject policy examples");
  invariant(screen.user_suffix === "", "source screen must not append a user suffix");
  invariant(screen.generation_contract === "one-call-unmodified-v1" &&
    screen.generation_retries_allowed === false && screen.response_repairs_allowed === false &&
    screen.field_assembly_allowed === false && screen.expected_answer_injection_allowed === false,
  "source screen generation contract is not no-cheat compatible");
  const loaderContract = validateLoaderContract(screen);
  const systemPrompt = validateSystemPromptContract(screen);
  const generationProfile = validateGenerationProfile(screen, artifacts);
  invariant(Number.isSafeInteger(screen.generation_seed_base) &&
    screen.generation_seed_base >= 0 && screen.generation_seed_base <= 0xffffffff,
  "source screen seed is invalid");
  invariant(screen.dtype === "float32" && screen.device === "cpu",
    "source screen execution profile changed");
  invariant(Number.isSafeInteger(screen.case_count) && screen.case_count > 0 && screen.case_count <= 64 &&
    Array.isArray(screen.cases) && screen.cases.length === screen.case_count,
  "source screen case count is invalid");
  invariant(requireSha256(screen.eval_cases_sha256, "source screen eval hash") === artifacts.eval.sha256,
    "source screen eval artifact changed");

  const checkpointArtifacts = screen.checkpoint_artifacts;
  invariant(isPlainObject(checkpointArtifacts), "source screen checkpoint artifacts are missing");
  const expectedArtifacts = [
    ...artifacts.modelFiles.map((artifact) => [artifact.name, artifact]),
    ...artifacts.executionInputs.map((artifact) => [artifact.name, artifact])
  ];
  requireExactKeys(checkpointArtifacts, expectedArtifacts.map(([name]) => name),
    "source screen checkpoint artifacts");
  for (const [name, artifact] of expectedArtifacts) {
    const bound = checkpointArtifacts[name];
    invariant(isPlainObject(bound) && Number(bound.bytes) === artifact.bytes &&
      requireSha256(bound.sha256, `${name} screen hash`) === artifact.sha256,
    `${name} does not match the source screen`);
  }

  const seenIndexes = new Set();
  for (const candidate of screen.cases) {
    invariant(isPlainObject(candidate), "source screen case is invalid");
    invariant(Number.isSafeInteger(candidate.index) && candidate.index >= 0 &&
      candidate.index < screen.case_count && !seenIndexes.has(candidate.index),
    "source screen case index is invalid");
    seenIndexes.add(candidate.index);
    invariant(candidate.generation_call_count === 1 && candidate.output_transform === "none",
      `source screen case ${candidate.index} was retried or transformed`);
    invariant(candidate.seed === screen.generation_seed_base + candidate.index,
      `source screen case ${candidate.index} seed changed`);
    invariant(Number.isSafeInteger(candidate.max_new_tokens) && candidate.max_new_tokens > 0 &&
      candidate.max_new_tokens <= 131_072,
    `source screen case ${candidate.index} token budget is invalid`);
    invariant(typeof candidate.raw_output_text === "string" && candidate.raw_output_text.length <= 64 * 1024,
      `source screen case ${candidate.index} raw output is invalid`);
    invariant(typeof candidate.rendered_prompt === "string" &&
      sha256(Buffer.from(candidate.rendered_prompt, "utf8")) ===
        requireSha256(candidate.rendered_prompt_sha256, "rendered prompt hash"),
    `source screen case ${candidate.index} rendered prompt hash changed`);
    invariant(tokenSha256(candidate.prompt_token_ids, "prompt") ===
      requireSha256(candidate.prompt_token_sha256_le_u32, "prompt token hash"),
    `source screen case ${candidate.index} prompt token hash changed`);
    invariant(tokenSha256(candidate.output_token_ids, "output") ===
      requireSha256(candidate.output_token_sha256_le_u32, "output token hash"),
    `source screen case ${candidate.index} output token hash changed`);
    invariant(candidate.output_token_ids.length <= candidate.max_new_tokens,
      `source screen case ${candidate.index} exceeded its token budget`);
    invariant(Array.isArray(candidate.first_step_top5) &&
      candidate.first_step_top5.length > 0 && candidate.first_step_top5.length <= 5,
    `source screen case ${candidate.index} first-step diagnostics are invalid`);
    for (const diagnostic of candidate.first_step_top5) {
      invariant(isPlainObject(diagnostic) &&
        Number.isSafeInteger(diagnostic.token_id) && diagnostic.token_id >= 0 &&
        Number.isFinite(diagnostic.logit) &&
        typeof diagnostic.token_text === "string" && diagnostic.token_text.length <= 512,
      `source screen case ${candidate.index} first-step logit is invalid`);
    }
    invariant(Number.isFinite(candidate.elapsed_seconds) && candidate.elapsed_seconds >= 0,
      `source screen case ${candidate.index} elapsed time is invalid`);
  }
  return Object.freeze({
    modelId: screen.source_model_id,
    sourceRevision: screen.source_revision,
    caseCount: screen.case_count,
    systemPromptMode: systemPrompt.mode,
    systemPromptSha256: systemPrompt.sha256,
    generationSeed: screen.generation_seed_base,
    generationProfile: generationProfile.profile,
    samplingEnabled: generationProfile.samplingEnabled,
    generationParameters: generationProfile.parameters || Object.freeze({ ...screen.generation }),
    publisherGenerationOverride: generationProfile.publisherOverride,
    referenceFramework: String(screen.reference_framework || ""),
    torchVersion: String(screen.torch_version || ""),
    transformersVersion: String(screen.transformers_version || ""),
    loaderContract: loaderContract.loaderContract,
    torchCompileMode: loaderContract.torchCompileMode,
    fixMistralRegex: loaderContract.fixMistralRegex
  });
}

function validateAssessment(assessment, screen, screenArtifact, sourceModelSha256) {
  requireExactKeys(assessment, [
    "schema", "sourceModelId", "sourceRevision", "sourceModelArtifactSha256",
    "sourceScreenSha256", "decision", "decisionAuthority", "architectureFamily",
    "runtimeAdmission", "licenseDisposition", "blockerCode", "criticalFailureCodes",
    "caseDispositions", "officialReferences"
  ], "source screen assessment");
  invariant(assessment.schema === assessmentSchema, "source screen assessment schema is unsupported");
  invariant(assessment.sourceModelId === screen.modelId && assessment.sourceRevision === screen.sourceRevision,
    "source screen assessment identity changed");
  invariant(requireSha256(assessment.sourceModelArtifactSha256, "assessed model hash") ===
    sourceModelSha256, "source screen assessment model hash changed");
  invariant(requireSha256(assessment.sourceScreenSha256, "assessed screen hash") ===
    screenArtifact.sha256, "source screen assessment transcript hash changed");
  invariant(new Set(["continue", "rejected"]).has(assessment.decision),
    "source screen assessment decision is invalid");
  invariant(assessment.decisionAuthority === "engineering-source-screen-v1",
    "source screen assessment authority is invalid");
  const architectureFamily = requireCode(assessment.architectureFamily, "architecture family");
  const runtimeAdmission = requireCode(assessment.runtimeAdmission, "runtime admission");
  const licenseDisposition = requireCode(assessment.licenseDisposition, "license disposition");
  const blockerCode = assessment.blockerCode === null
    ? null
    : requireCode(assessment.blockerCode, "source screen blocker");
  invariant((assessment.decision === "rejected") === Boolean(blockerCode),
    "source screen blocker does not match the decision");

  invariant(Array.isArray(assessment.criticalFailureCodes) &&
    assessment.criticalFailureCodes.length <= 32, "critical failure codes are invalid");
  const criticalFailureCodes = assessment.criticalFailureCodes.map((code) =>
    requireCode(code, "critical failure code"));
  invariant(new Set(criticalFailureCodes).size === criticalFailureCodes.length,
    "critical failure codes contain duplicates");
  invariant((assessment.decision === "rejected") === (criticalFailureCodes.length > 0),
    "critical failures do not match the source screen decision");

  invariant(Array.isArray(assessment.caseDispositions) &&
    assessment.caseDispositions.length === screen.caseCount,
  "source screen assessment must classify every case");
  const caseDispositions = assessment.caseDispositions.map((disposition) => {
    requireExactKeys(disposition, ["index", "status", "failureCodes"], "case disposition");
    invariant(Number.isSafeInteger(disposition.index) && disposition.index >= 0 &&
      disposition.index < screen.caseCount, "case disposition index is invalid");
    invariant(new Set(["pass", "fail"]).has(disposition.status),
      "case disposition status is invalid");
    invariant(Array.isArray(disposition.failureCodes) && disposition.failureCodes.length <= 8,
      "case disposition failure codes are invalid");
    const failureCodes = disposition.failureCodes.map((code) => requireCode(code, "case failure code"));
    invariant(new Set(failureCodes).size === failureCodes.length,
      "case disposition failure codes contain duplicates");
    invariant((disposition.status === "fail") === (failureCodes.length > 0),
      "case disposition failure codes do not match status");
    return Object.freeze({ index: disposition.index, status: disposition.status, failureCodes });
  }).sort((left, right) => left.index - right.index);
  invariant(caseDispositions.every((disposition, index) => disposition.index === index),
    "case dispositions contain duplicate or missing indexes");
  const dispositionCodes = new Set(caseDispositions.flatMap((entry) => entry.failureCodes));
  invariant(criticalFailureCodes.every((code) => dispositionCodes.has(code)),
    "critical failure code is not bound to a failed case");

  invariant(Array.isArray(assessment.officialReferences) &&
    assessment.officialReferences.length > 0 && assessment.officialReferences.length <= 8 &&
    assessment.officialReferences.every((reference) => {
      try {
        return new URL(reference).protocol === "https:";
      } catch {
        return false;
      }
    }), "official references are invalid");
  const failed = caseDispositions.filter((entry) => entry.status === "fail").length;
  return Object.freeze({
    decision: assessment.decision,
    architectureFamily,
    runtimeAdmission,
    licenseDisposition,
    blockerCode,
    criticalFailureCodes: Object.freeze(criticalFailureCodes),
    caseDispositions: Object.freeze(caseDispositions),
    casesPassed: screen.caseCount - failed,
    casesFailed: failed,
    officialReferences: Object.freeze([...assessment.officialReferences])
  });
}

function runtimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function recordSourceModelScreen(options) {
  invariant(isPlainObject(options), "source screen evidence options are invalid");
  const startedAtUtc = options.startedAtUtc || new Date().toISOString();
  invariant(Number.isFinite(Date.parse(startedAtUtc)), "source screen start time is invalid");
  const sourceRoot = path.resolve(options.sourceRoot);
  const screen = readJson(path.resolve(options.screenPath), "source screen");
  const assessment = readJson(path.resolve(options.assessmentPath), "source screen assessment");
  const sourceArtifacts = sourceCheckpointArtifacts(sourceRoot);
  const artifacts = Object.freeze({
    ...sourceArtifacts,
    license: sha256File(path.resolve(options.licensePath), 1024 * 1024),
    eval: sha256File(path.resolve(options.evalCasesPath), maximumJsonBytes)
  });
  const inspectedScreen = validateScreen(screen.value, artifacts);
  const inspectedAssessment = validateAssessment(
    assessment.value, inspectedScreen, screen.artifact, artifacts.model.sha256);
  const completedAtUtc = options.completedAtUtc || new Date().toISOString();
  invariant(Number.isFinite(Date.parse(completedAtUtc)) &&
    Date.parse(completedAtUtc) >= Date.parse(startedAtUtc), "source screen completion time is invalid");

  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "source screen evidence store contains quarantined files");
  const captureToolHash = sha256File(
    path.join(__dirname, "reference-raw-quality.py"), maximumJsonBytes).sha256;
  const toolHash = sha256File(__filename, maximumJsonBytes).sha256;
  const toolVersions = Object.freeze([captureToolVersion, toolVersion]);
  const toolBinaryHashes = Object.freeze([captureToolHash, toolHash]);
  const matching = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId && receipt.outputHashes.sourceScreen === screen.artifact.sha256 &&
    receipt.outputHashes.assessment === assessment.artifact.sha256 &&
    canonicalJson(receipt.toolVersions) === canonicalJson(toolVersions) &&
    canonicalJson(receipt.toolBinaryHashes) === canonicalJson(toolBinaryHashes));
  if (matching.length > 0) {
    invariant(matching.length === 1, "source screen receipt is duplicated");
    return Object.freeze({ inspection: inspectedAssessment, receipt: matching[0] });
  }
  const prior = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId &&
    receipt.publicSafeParameters.modelId === inspectedScreen.modelId);
  const attempt = prior.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  const previous = [...prior].sort((left, right) => left.attempt - right.attempt).at(-1) || null;
  const receipt = store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: "model-source-screen",
    attempt,
    status: inspectedAssessment.decision === "rejected" ? "rejected" : "pass",
    createdAtUtc: startedAtUtc,
    completedAtUtc,
    inputReceiptIds: [],
    inputHashes: {
      sourceModel: artifacts.model.sha256,
      sourceConfig: artifacts.config.sha256,
      sourceTokenizer: artifacts.tokenizer.sha256,
      sourceTokenizerConfig: artifacts.tokenizerConfig.sha256,
      sourceExecutionInputs: artifacts.executionInputSha256,
      sourceLicense: artifacts.license.sha256,
      evalCases: artifacts.eval.sha256,
      systemPrompt: inspectedScreen.systemPromptSha256,
      ...(inspectedScreen.publisherGenerationOverride
        ? { publisherGenerationAuthority:
            inspectedScreen.publisherGenerationOverride.authoritySha256 }
        : {})
    },
    outputHashes: {
      sourceScreen: screen.artifact.sha256,
      assessment: assessment.artifact.sha256
    },
    sourceRevision: inspectedScreen.sourceRevision,
    toolNames: [
      "tinyrustlm-reference-raw-quality",
      "tinyrustlm-source-model-screen-evidence"
    ],
    toolVersions,
    toolBinaryHashes,
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      device: screen.value.device,
      dtype: screen.value.dtype,
      referenceFramework: inspectedScreen.referenceFramework,
      torchVersion: inspectedScreen.torchVersion,
      transformersVersion: inspectedScreen.transformersVersion
    },
    configurationHash: sha256(canonicalJson({
      assessmentSchema,
      screenSchema,
      generationContract: screen.value.generation_contract,
      generationProfile: screen.value.generation_profile,
      generationParameters: inspectedScreen.generationParameters,
      publisherGenerationOverride: inspectedScreen.publisherGenerationOverride,
      generationSeed: inspectedScreen.generationSeed,
      loaderContract: inspectedScreen.loaderContract,
      torchCompileMode: inspectedScreen.torchCompileMode,
      fixMistralRegex: inspectedScreen.fixMistralRegex,
      systemPromptMode: inspectedScreen.systemPromptMode,
      evalCasesSha256: artifacts.eval.sha256,
      systemPromptSha256: inspectedScreen.systemPromptSha256
    })),
    publicSafeParameters: {
      modelId: inspectedScreen.modelId,
      sourceModelId: inspectedScreen.modelId,
      architectureFamily: inspectedAssessment.architectureFamily,
      runtimeAdmission: inspectedAssessment.runtimeAdmission,
      licenseDisposition: inspectedAssessment.licenseDisposition,
      decision: inspectedAssessment.decision,
      decisionAuthority: assessment.value.decisionAuthority,
      caseCount: inspectedScreen.caseCount,
      casesPassed: inspectedAssessment.casesPassed,
      casesFailed: inspectedAssessment.casesFailed,
      criticalFailureCount: inspectedAssessment.criticalFailureCodes.length,
      sourceModelIdentityKind: artifacts.identityKind,
      sourceWeightArtifactCount: artifacts.modelFiles.length,
      sourceWeightByteCount: artifacts.model.bytes,
      sourceExecutionArtifactCount: artifacts.executionInputs.length,
      sourceChatTemplateMode: artifacts.chatTemplateMode,
      systemPromptMode: inspectedScreen.systemPromptMode,
      loaderContract: inspectedScreen.loaderContract,
      torchCompileMode: inspectedScreen.torchCompileMode,
      tokenizerRegexMode: inspectedScreen.fixMistralRegex
        ? "fix-mistral-regex"
        : "source-regex",
      remoteCodeEnabled: false,
      generationProfile: inspectedScreen.generationProfile,
      samplingEnabled: inspectedScreen.samplingEnabled,
      publisherGenerationOverride: Boolean(inspectedScreen.publisherGenerationOverride),
      rawOutputPreserved: true,
      generationCallCountPerCase: 1,
      responseRepairApplied: false
    },
    boundedDiagnostics: {
      criticalFailureCodes: inspectedAssessment.criticalFailureCodes,
      failedCaseIndexes: inspectedAssessment.caseDispositions
        .filter((entry) => entry.status === "fail").map((entry) => entry.index),
      sourceScreenByteCount: screen.artifact.bytes,
      assessmentByteCount: assessment.artifact.bytes
    },
    blockerCode: inspectedAssessment.blockerCode,
    externalEvidenceReferences: inspectedAssessment.officialReferences,
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: previous ? [previous.receiptId] : [],
    attestationReference: null
  }).receipt;
  return Object.freeze({ inspection: inspectedAssessment, receipt });
}

if (require.main === module) {
  const [evidenceRoot, campaignId, screenPath, assessmentPath, sourceRoot, evalCasesPath, licensePath] =
    process.argv.slice(2);
  invariant(Boolean(evidenceRoot && campaignId && screenPath && assessmentPath && sourceRoot &&
    evalCasesPath && licensePath),
    "usage: node source-model-screen-evidence.js <evidence-root> <campaign-id> <screen> <assessment> <source-root> <eval-cases> <license>");
  const result = recordSourceModelScreen({
    evidenceRoot,
    campaignId,
    screenPath,
    assessmentPath,
    sourceRoot,
    evalCasesPath,
    licensePath
  });
  process.stdout.write(`${JSON.stringify({
    receiptId: result.receipt.receiptId,
    status: result.receipt.status,
    modelId: result.receipt.publicSafeParameters.modelId,
    casesPassed: result.receipt.publicSafeParameters.casesPassed,
    caseCount: result.receipt.publicSafeParameters.caseCount
  })}\n`);
}

module.exports = Object.freeze({
  assessmentSchema,
  recordSourceModelScreen,
  receiptType,
  screenSchema,
  sourceCheckpointArtifacts,
  validateAssessment,
  validateScreen
});
