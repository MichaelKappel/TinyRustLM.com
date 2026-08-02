"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  CampaignEvidenceStore,
  canonicalJson
} = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  generatorSchema,
  generatorVersion,
  preferences,
  publicManifestSchema,
  resourceOrder,
  taskContractId,
  validateExpected
} = require("./task-specialist-case-generator.js");

const preregistrationSchema = "tinyrustlm.task-specialist-source-screen-preregistration.v3";
const privateVerdictSchema = "tinyrustlm.task-specialist-source-screen-verdict.v3";
const receiptType = "tinyrustlm.model-source-task-screen-v3";
const phase = "model-source-task-screen";
const toolVersion = "3";
const captureToolVersion = "6";
const maximumJsonBytes = 4 * 1024 * 1024;
const maximumRawOutputBytes = 16 * 1024;
const maximumWeightArtifactCount = 256;
const sha256Pattern = /^[a-f0-9]{64}$/;
const receiptIdPattern = /^sha256:[a-f0-9]{64}$/;
const sourceRevisionPattern = /^[a-f0-9]{40,64}$/;
const projectRevisionPattern = /^[a-f0-9]{40}$/;
const safeIdPattern = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const modelIdPattern = /^[A-Za-z0-9._-]{1,96}\/[A-Za-z0-9._-]{1,160}$/;
const outputKeys = Object.freeze([
  "budgetUsd",
  "deadlineDate",
  "availableResources",
  "unavailableResources",
  "preference"
]);
const executionArtifactNames = Object.freeze([
  "generation_config.json",
  "special_tokens_map.json",
  "added_tokens.json",
  "merges.txt",
  "vocab.json",
  "tokenizer.model",
  "chat_template.jinja"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort()),
    `${label} fields are invalid`);
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readArtifact(filePath, label, maximumBytes = maximumJsonBytes) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file`);
  invariant(stat.size > 0 && stat.size <= maximumBytes, `${label} has an invalid size`);
  const bytes = fs.readFileSync(resolved);
  return Object.freeze({ path: resolved, bytes, sha256: sha256Bytes(bytes) });
}

function readJsonArtifact(filePath, label, maximumBytes = maximumJsonBytes) {
  const artifact = readArtifact(filePath, label, maximumBytes);
  let value;
  try {
    value = JSON.parse(artifact.bytes.toString("utf8").replace(/^\uFEFF/u, ""));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  invariant(isPlainObject(value), `${label} must contain an object`);
  return Object.freeze({ ...artifact, value });
}

function requireSha256(value, label) {
  const normalized = String(value || "").toLowerCase();
  invariant(sha256Pattern.test(normalized), `${label} is not SHA-256`);
  return normalized;
}

function requireReceiptId(value, label) {
  const normalized = String(value || "");
  invariant(receiptIdPattern.test(normalized), `${label} is not a receipt identity`);
  return normalized;
}

function requireSafeId(value, label) {
  const normalized = String(value || "");
  invariant(safeIdPattern.test(normalized), `${label} is invalid`);
  return normalized;
}

function requireBoolean(value, label) {
  invariant(typeof value === "boolean", `${label} must be boolean`);
  return value;
}

function requireInteger(value, label, minimum, maximum) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${label} is invalid`);
  return value;
}

function requireStringArray(value, label, allowed = null) {
  invariant(Array.isArray(value) && value.length <= 256, `${label} must be a bounded array`);
  invariant(value.every((entry) => typeof entry === "string" && entry.length > 0),
    `${label} contains an invalid string`);
  invariant(new Set(value).size === value.length, `${label} contains duplicates`);
  if (allowed) {
    invariant(value.every((entry) => allowed.includes(entry)),
      `${label} contains an unsupported value`);
  }
  return Object.freeze([...value]);
}

function validateChatTemplateOptions(value) {
  invariant(isPlainObject(value), "chat template options must be an object");
  const keys = Object.keys(value);
  invariant(keys.length <= 1, "chat template options contain unsupported fields");
  if (keys.length === 1) {
    invariant(["enable_thinking", "thinking"].includes(keys[0]) &&
      value[keys[0]] === false,
    "chat template options are invalid");
  }
  return Object.freeze({ ...value });
}

class StrictJsonError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class StrictJsonParser {
  constructor(text) {
    this.text = text;
    this.index = 0;
    this.depth = 0;
  }

  fail(code, message) {
    throw new StrictJsonError(code, message);
  }

  skipWhitespace() {
    while (this.index < this.text.length && /[\u0009\u000A\u000D\u0020]/u.test(
      this.text[this.index])) {
      this.index += 1;
    }
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      this.fail("trailing-output", "JSON output contains trailing text");
    }
    return value;
  }

  parseValue() {
    if (this.depth > 16) this.fail("json-depth-exceeded", "JSON output is too deep");
    const character = this.text[this.index];
    if (character === "{") return this.parseObject();
    if (character === "[") return this.parseArray();
    if (character === "\"") return this.parseString();
    if (character === "t") return this.parseLiteral("true", true);
    if (character === "f") return this.parseLiteral("false", false);
    if (character === "n") return this.parseLiteral("null", null);
    if (character === "-" || /[0-9]/u.test(character || "")) return this.parseNumber();
    this.fail("invalid-json", "JSON output contains an invalid value");
  }

  parseLiteral(token, value) {
    if (this.text.slice(this.index, this.index + token.length) !== token) {
      this.fail("invalid-json", "JSON output contains an invalid literal");
    }
    this.index += token.length;
    return value;
  }

  parseString() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (!escaped && code < 0x20) {
        this.fail("invalid-json", "JSON string contains an unescaped control");
      }
      const character = this.text[this.index];
      if (!escaped && character === "\"") {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index));
        } catch {
          this.fail("invalid-json", "JSON string escape is invalid");
        }
      }
      if (!escaped && character === "\\") {
        escaped = true;
      } else {
        escaped = false;
      }
      this.index += 1;
    }
    this.fail("invalid-json", "JSON string is unterminated");
  }

  parseNumber() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(
      this.text.slice(this.index));
    if (!match) this.fail("invalid-json", "JSON number is invalid");
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.fail("invalid-json", "JSON number is not finite");
    return value;
  }

  parseArray() {
    this.depth += 1;
    this.index += 1;
    const result = [];
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      this.depth -= 1;
      return result;
    }
    while (true) {
      if (result.length >= 256) this.fail("json-array-too-large", "JSON array is too large");
      this.skipWhitespace();
      result.push(this.parseValue());
      this.skipWhitespace();
      const character = this.text[this.index];
      if (character === "]") {
        this.index += 1;
        this.depth -= 1;
        return result;
      }
      if (character !== ",") this.fail("invalid-json", "JSON array delimiter is invalid");
      this.index += 1;
    }
  }

  parseObject() {
    this.depth += 1;
    this.index += 1;
    const result = {};
    const seen = new Set();
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      this.depth -= 1;
      return result;
    }
    while (true) {
      if (seen.size >= 256) this.fail("json-object-too-large", "JSON object is too large");
      this.skipWhitespace();
      if (this.text[this.index] !== "\"") {
        this.fail("invalid-json", "JSON object key must be a string");
      }
      const key = this.parseString();
      if (seen.has(key)) this.fail("duplicate-json-key", "JSON object contains a duplicate key");
      seen.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        this.fail("invalid-json", "JSON object is missing a colon");
      }
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue();
      this.skipWhitespace();
      const character = this.text[this.index];
      if (character === "}") {
        this.index += 1;
        this.depth -= 1;
        return result;
      }
      if (character !== ",") this.fail("invalid-json", "JSON object delimiter is invalid");
      this.index += 1;
    }
  }
}

function parseStrictJson(text) {
  invariant(typeof text === "string", "raw output must be text");
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes === 0) throw new StrictJsonError("empty-output", "raw output is empty");
  if (bytes > maximumRawOutputBytes) {
    throw new StrictJsonError("output-too-large", "raw output exceeds its limit");
  }
  return new StrictJsonParser(text).parse();
}

function validateTaskValue(value) {
  if (!isPlainObject(value)) return "top-level-not-object";
  if (canonicalJson(Object.keys(value)) !== canonicalJson(outputKeys)) return "wrong-key-order";
  if (value.budgetUsd !== null &&
      (!Number.isSafeInteger(value.budgetUsd) || value.budgetUsd < 0)) {
    return "schema-invalid";
  }
  if (value.deadlineDate !== null &&
      (typeof value.deadlineDate !== "string" ||
       !/^\d{4}-\d{2}-\d{2}$/u.test(value.deadlineDate))) {
    return "schema-invalid";
  }
  for (const key of ["availableResources", "unavailableResources"]) {
    if (!Array.isArray(value[key]) || new Set(value[key]).size !== value[key].length ||
        !value[key].every((entry) => resourceOrder.includes(entry))) {
      return "schema-invalid";
    }
    const sorted = [...value[key]].sort(
      (left, right) => resourceOrder.indexOf(left) - resourceOrder.indexOf(right));
    if (canonicalJson(value[key]) !== canonicalJson(sorted)) return "schema-invalid";
  }
  if (value.availableResources.some((entry) => value.unavailableResources.includes(entry))) {
    return "schema-invalid";
  }
  if (value.preference !== null && !preferences.includes(value.preference)) {
    return "schema-invalid";
  }
  return null;
}

function evaluateCaseOutput(rawOutput, expected) {
  const rawOutputSha256 = sha256Bytes(Buffer.from(String(rawOutput), "utf8"));
  const rawOutputBytes = Buffer.byteLength(String(rawOutput), "utf8");
  let parsed;
  try {
    parsed = parseStrictJson(rawOutput);
  } catch (error) {
    const code = error instanceof StrictJsonError ? error.code : "invalid-json";
    return Object.freeze({
      status: "fail",
      exactMatch: false,
      malformed: true,
      failureCodes: Object.freeze([code]),
      rawOutputSha256,
      rawOutputBytes
    });
  }
  const schemaFailure = validateTaskValue(parsed);
  if (schemaFailure) {
    return Object.freeze({
      status: "fail",
      exactMatch: false,
      malformed: true,
      failureCodes: Object.freeze([schemaFailure]),
      rawOutputSha256,
      rawOutputBytes
    });
  }
  const exactMatch = canonicalJson(parsed) === canonicalJson(expected);
  return Object.freeze({
    status: exactMatch ? "pass" : "fail",
    exactMatch,
    malformed: false,
    failureCodes: Object.freeze(exactMatch ? [] : ["semantic-value-mismatch"]),
    rawOutputSha256,
    rawOutputBytes
  });
}

function parseEvalFixture(bytes) {
  const text = bytes.toString("utf8").replace(/^\uFEFF/u, "");
  const fields = new Map();
  for (const [offset, rawLine] of text.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    invariant(separator > 0, `eval fixture line ${offset + 1} is invalid`);
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    invariant(value.length > 0 && !fields.has(key),
      `eval fixture line ${offset + 1} is empty or duplicated`);
    fields.set(key, value);
  }
  invariant(fields.get("tinyrustlm_eval_cases_version") === "1",
    "eval fixture version is invalid");
  invariant(fields.get("quality_gate_policy") === "task-specific-source-screen-v1",
    "eval fixture policy is invalid");
  const caseCount = Number(fields.get("case_count"));
  invariant(Number.isSafeInteger(caseCount) && caseCount > 0 && caseCount <= 128,
    "eval fixture case count is invalid");
  const expectedFieldCount = 3 + caseCount * 2;
  invariant(fields.size === expectedFieldCount, "eval fixture contains unknown fields");
  const cases = [];
  for (let index = 0; index < caseCount; index += 1) {
    const prompt = fields.get(`case.${index}.prompt`);
    const maxNewTokens = Number(fields.get(`case.${index}.max_new_tokens`));
    invariant(typeof prompt === "string" && prompt.length > 0 && prompt.length <= 16 * 1024,
      `eval fixture case ${index} prompt is invalid`);
    invariant(Number.isSafeInteger(maxNewTokens) && maxNewTokens > 0 && maxNewTokens <= 1024,
      `eval fixture case ${index} token limit is invalid`);
    cases.push(Object.freeze({ index, prompt, maxNewTokens }));
  }
  return Object.freeze(cases);
}

function validatePreregistration(value) {
  requireExactKeys(value, [
    "schema",
    "experimentId",
    "registeredAtUtc",
    "status",
    "authority",
    "sourceModel",
    "taskContract",
    "sealedInputs",
    "captureContract",
    "acceptance",
    "prohibitions",
    "requiredNextGate"
  ], "preregistration");
  invariant(value.schema === preregistrationSchema, "preregistration schema is invalid");
  const experimentId = requireSafeId(value.experimentId, "experiment id");
  invariant(Number.isFinite(Date.parse(value.registeredAtUtc)) &&
    value.registeredAtUtc.endsWith("Z"), "preregistration time is invalid");
  invariant(value.status === "preregistered-before-model-output",
    "preregistration status is invalid");

  requireExactKeys(value.authority, [
    "productAuthority",
    "trainingAuthority",
    "conversionAuthority",
    "taskSpecificProofAuthority",
    "broadQualityAuthority",
    "releaseAuthority"
  ], "preregistration authority");
  invariant(Object.values(value.authority).every((entry) => entry === false),
    "preregistration cannot grant authority");

  requireExactKeys(value.sourceModel, [
    "modelId",
    "sourceRevision",
    "sourceModelSha256",
    "sourceExecutionInputsSha256",
    "sourceWeightIdentityKind",
    "sourceWeightArtifactCount",
    "sourceWeightByteCount",
    "broadSourceScreenReceiptId",
    "broadSourceScreenStatus",
    "broadSourceScreenRole",
    "sourceIdentityAuthority"
  ], "preregistered source model");
  invariant(modelIdPattern.test(value.sourceModel.modelId), "source model id is invalid");
  invariant(sourceRevisionPattern.test(value.sourceModel.sourceRevision),
    "source model revision is invalid");
  requireSha256(value.sourceModel.sourceModelSha256, "source model hash");
  requireSha256(value.sourceModel.sourceExecutionInputsSha256,
    "source execution-input hash");
  invariant([
    "direct-safetensors-sha256",
    "indexed-safetensors-set-v1"
  ].includes(value.sourceModel.sourceWeightIdentityKind),
  "source weight identity kind is invalid");
  requireInteger(value.sourceModel.sourceWeightArtifactCount,
    "source weight artifact count", 1, maximumWeightArtifactCount);
  requireInteger(value.sourceModel.sourceWeightByteCount,
    "source weight byte count", 1, 8 * 1024 * 1024 * 1024);
  invariant(
    value.sourceModel.sourceWeightIdentityKind !== "direct-safetensors-sha256" ||
      value.sourceModel.sourceWeightArtifactCount === 1,
  "direct source weight identity must contain one artifact");
  invariant(
    value.sourceModel.sourceWeightIdentityKind !== "indexed-safetensors-set-v1" ||
      value.sourceModel.sourceWeightArtifactCount >= 2,
  "indexed source weight identity must contain an index and at least one shard");
  requireReceiptId(value.sourceModel.broadSourceScreenReceiptId,
    "broad source-screen receipt");
  invariant(value.sourceModel.broadSourceScreenStatus === "rejected",
    "broad source-screen status must remain rejected");
  invariant(value.sourceModel.broadSourceScreenRole === "broad-claim-boundary-only",
    "broad source-screen role is invalid");
  invariant(value.sourceModel.sourceIdentityAuthority ===
    "independent-task-capture-checkpoint-artifacts-v1",
  "task source identity authority is invalid");

  requireExactKeys(value.taskContract, [
    "taskContractId",
    "outputKeys",
    "resourceVocabulary",
    "preferenceVocabulary",
    "claimBoundary"
  ], "task contract");
  invariant(value.taskContract.taskContractId === taskContractId,
    "task contract id is invalid");
  invariant(canonicalJson(value.taskContract.outputKeys) === canonicalJson(outputKeys),
    "task output keys are invalid");
  invariant(canonicalJson(value.taskContract.resourceVocabulary) === canonicalJson(resourceOrder),
    "task resource vocabulary is invalid");
  invariant(canonicalJson(value.taskContract.preferenceVocabulary) === canonicalJson(preferences),
    "task preference vocabulary is invalid");
  invariant(value.taskContract.claimBoundary ===
    "source-screen-only-non-promotional-no-general-assistant-claim",
  "task claim boundary is invalid");

  requireExactKeys(value.sealedInputs, [
    "visibility",
    "generatorVersion",
    "generatorSha256",
    "captureToolSha256",
    "evaluatorToolSha256",
    "seedCommitmentSha256",
    "privateCaseSetSha256",
    "evalCasesSha256",
    "publicManifestSha256",
    "caseCount",
    "casesPerCategory",
    "categoryCount"
  ], "sealed inputs");
  invariant(value.sealedInputs.visibility ===
    "private-prompts-and-expected-values-public-hashes-only",
  "sealed-input visibility is invalid");
  invariant(value.sealedInputs.generatorVersion === generatorVersion,
    "generator version is invalid");
  for (const key of [
    "generatorSha256",
    "captureToolSha256",
    "evaluatorToolSha256",
    "seedCommitmentSha256",
    "privateCaseSetSha256",
    "evalCasesSha256",
    "publicManifestSha256"
  ]) {
    requireSha256(value.sealedInputs[key], `sealed input ${key}`);
  }
  requireInteger(value.sealedInputs.caseCount, "sealed case count", 1, 128);
  requireInteger(value.sealedInputs.casesPerCategory, "cases per category", 1, 32);
  requireInteger(value.sealedInputs.categoryCount, "category count", 1, 32);
  invariant(value.sealedInputs.caseCount ===
    value.sealedInputs.casesPerCategory * value.sealedInputs.categoryCount,
  "sealed case cardinality is inconsistent");

  requireExactKeys(value.captureContract, [
    "reportSchema",
    "generationProfile",
    "generationSeedBase",
    "generationCallsPerCase",
    "samplingAllowed",
    "adapterAllowed",
    "policyExamplesAllowed",
    "userSuffixAllowed",
    "responseRepairAllowed",
    "retryAllowed",
    "bestOfNAllowed",
    "rawOutputPreserved",
    "chatTemplateOptions",
    "systemPromptSha256"
  ], "capture contract");
  invariant(value.captureContract.reportSchema === "tinyrustlm.reference_raw_quality.v4" &&
    value.captureContract.generationProfile === "greedy",
  "capture report contract is invalid");
  requireInteger(value.captureContract.generationSeedBase,
    "generation seed base", 0, 0x7fffffff);
  invariant(value.captureContract.generationCallsPerCase === 1 &&
    value.captureContract.samplingAllowed === false &&
    value.captureContract.adapterAllowed === false &&
    value.captureContract.policyExamplesAllowed === false &&
    value.captureContract.userSuffixAllowed === false &&
    value.captureContract.responseRepairAllowed === false &&
    value.captureContract.retryAllowed === false &&
    value.captureContract.bestOfNAllowed === false &&
    value.captureContract.rawOutputPreserved === true,
  "capture behavior contract is invalid");
  validateChatTemplateOptions(value.captureContract.chatTemplateOptions);
  requireSha256(value.captureContract.systemPromptSha256, "system prompt hash");

  requireExactKeys(value.acceptance, [
    "minimumExactPassCount",
    "minimumPerCategoryPassCount",
    "criticalCasesMustAllPass",
    "malformedOutputMaximum",
    "deterministicReplayRequiredBeforePromotion",
    "sourcePassAuthorizesConversionSpendOnly",
    "sourcePassGrantsTaskSpecificProof",
    "sourcePassGrantsBroadQuality"
  ], "acceptance");
  requireInteger(value.acceptance.minimumExactPassCount, "minimum exact pass count",
    1, value.sealedInputs.caseCount);
  requireInteger(value.acceptance.minimumPerCategoryPassCount,
    "minimum category pass count", 1, value.sealedInputs.casesPerCategory);
  requireInteger(value.acceptance.malformedOutputMaximum,
    "malformed output maximum", 0, value.sealedInputs.caseCount);
  invariant(value.acceptance.criticalCasesMustAllPass === true &&
    value.acceptance.deterministicReplayRequiredBeforePromotion === true &&
    value.acceptance.sourcePassAuthorizesConversionSpendOnly === true &&
    value.acceptance.sourcePassGrantsTaskSpecificProof === false &&
    value.acceptance.sourcePassGrantsBroadQuality === false,
  "acceptance authority is invalid");

  invariant(Array.isArray(value.prohibitions) && value.prohibitions.length >= 8 &&
    value.prohibitions.length <= 32 &&
    value.prohibitions.every((entry) => typeof entry === "string" &&
      entry.length >= 8 && entry.length <= 256) &&
    new Set(value.prohibitions).size === value.prohibitions.length,
  "preregistration prohibitions are invalid");
  invariant(value.requiredNextGate ===
    "If and only if this source screen passes, convert the exact source and rerun a larger independently sealed task suite against untouched native and browser .slm output before issuing task-specific proof.",
  "required next gate is invalid");

  return Object.freeze({
    experimentId,
    sourceModel: Object.freeze({ ...value.sourceModel }),
    taskContract: Object.freeze({ ...value.taskContract }),
    sealedInputs: Object.freeze({ ...value.sealedInputs }),
    captureContract: Object.freeze({
      ...value.captureContract,
      chatTemplateOptions: Object.freeze({ ...value.captureContract.chatTemplateOptions })
    }),
    acceptance: Object.freeze({ ...value.acceptance })
  });
}

function validatePrivateCaseSet(value, preregistration, artifactSha256) {
  requireExactKeys(value, [
    "schema",
    "generatorVersion",
    "generatorSha256",
    "experimentId",
    "taskContractId",
    "seedCommitmentSha256",
    "evalCasesSha256",
    "caseCount",
    "casesPerCategory",
    "categories",
    "cases"
  ], "private case set");
  const sealed = preregistration.sealedInputs;
  invariant(value.schema === generatorSchema &&
    value.generatorVersion === generatorVersion &&
    value.generatorSha256 === sealed.generatorSha256 &&
    value.experimentId === preregistration.experimentId &&
    value.taskContractId === taskContractId &&
    value.seedCommitmentSha256 === sealed.seedCommitmentSha256 &&
    value.evalCasesSha256 === sealed.evalCasesSha256 &&
    artifactSha256 === sealed.privateCaseSetSha256,
  "private case-set identity changed");
  invariant(value.caseCount === sealed.caseCount &&
    value.casesPerCategory === sealed.casesPerCategory &&
    Array.isArray(value.categories) &&
    value.categories.length === sealed.categoryCount &&
    Array.isArray(value.cases) &&
    value.cases.length === sealed.caseCount,
  "private case-set cardinality changed");
  const categoryMap = new Map();
  for (const category of value.categories) {
    requireExactKeys(category, ["id", "critical", "count"], "private case category");
    const id = requireSafeId(category.id, "private case category id");
    invariant(!categoryMap.has(id), "private case category is duplicated");
    requireBoolean(category.critical, "private case category criticality");
    invariant(category.count === sealed.casesPerCategory,
      "private case category count changed");
    categoryMap.set(id, Object.freeze({ ...category }));
  }
  const cases = value.cases.map((candidate, expectedIndex) => {
    requireExactKeys(candidate, [
      "index",
      "caseId",
      "category",
      "critical",
      "prompt",
      "promptSha256",
      "expected",
      "expectedSha256",
      "maxNewTokens"
    ], "private case");
    invariant(candidate.index === expectedIndex, "private case index changed");
    requireSafeId(candidate.caseId, "private case id");
    const category = categoryMap.get(candidate.category);
    invariant(category && candidate.critical === category.critical,
      "private case category or criticality changed");
    invariant(typeof candidate.prompt === "string" &&
      candidate.prompt.length > 0 && candidate.prompt.length <= 16 * 1024 &&
      !/[\r\n\0]/u.test(candidate.prompt),
    "private case prompt is invalid");
    invariant(sha256Bytes(Buffer.from(candidate.prompt, "utf8")) ===
      requireSha256(candidate.promptSha256, "private prompt hash"),
    "private case prompt hash changed");
    validateExpected(candidate.expected);
    invariant(sha256Bytes(Buffer.from(canonicalJson(candidate.expected), "utf8")) ===
      requireSha256(candidate.expectedSha256, "private expected-value hash"),
    "private case expected-value hash changed");
    requireInteger(candidate.maxNewTokens, "private case token limit", 1, 1024);
    return Object.freeze({ ...candidate, expected: Object.freeze({ ...candidate.expected }) });
  });
  for (const category of categoryMap.values()) {
    invariant(cases.filter((candidate) => candidate.category === category.id).length ===
      category.count, "private category membership changed");
  }
  return Object.freeze({
    categories: Object.freeze(Array.from(categoryMap.values())),
    cases: Object.freeze(cases)
  });
}

function validatePublicManifest(value, preregistration, privateSet, artifactSha256) {
  requireExactKeys(value, [
    "schema",
    "generatorVersion",
    "generatorSha256",
    "experimentId",
    "taskContractId",
    "seedCommitmentSha256",
    "privateCaseSetSha256",
    "evalCasesSha256",
    "caseCount",
    "casesPerCategory",
    "categories",
    "caseIdentities",
    "privatePromptBodiesPublished",
    "privateExpectedValuesPublished",
    "easySeedSelectionAllowed",
    "trainingAccessAllowed"
  ], "public case manifest");
  const sealed = preregistration.sealedInputs;
  invariant(value.schema === publicManifestSchema &&
    value.generatorVersion === generatorVersion &&
    value.generatorSha256 === sealed.generatorSha256 &&
    value.experimentId === preregistration.experimentId &&
    value.taskContractId === taskContractId &&
    value.seedCommitmentSha256 === sealed.seedCommitmentSha256 &&
    value.privateCaseSetSha256 === sealed.privateCaseSetSha256 &&
    value.evalCasesSha256 === sealed.evalCasesSha256 &&
    artifactSha256 === sealed.publicManifestSha256 &&
    value.caseCount === sealed.caseCount &&
    value.casesPerCategory === sealed.casesPerCategory,
  "public case-manifest identity changed");
  invariant(value.privatePromptBodiesPublished === false &&
    value.privateExpectedValuesPublished === false &&
    value.easySeedSelectionAllowed === false &&
    value.trainingAccessAllowed === false,
  "public case-manifest privacy authority changed");
  invariant(canonicalJson(value.categories) === canonicalJson(privateSet.categories),
    "public category manifest changed");
  invariant(Array.isArray(value.caseIdentities) &&
    value.caseIdentities.length === privateSet.cases.length,
  "public case identity count changed");
  value.caseIdentities.forEach((identity, index) => {
    requireExactKeys(identity, [
      "index",
      "caseId",
      "category",
      "critical",
      "promptSha256",
      "expectedSha256",
      "maxNewTokens"
    ], "public case identity");
    const privateCase = privateSet.cases[index];
    invariant(identity.index === privateCase.index &&
      identity.caseId === privateCase.caseId &&
      identity.category === privateCase.category &&
      identity.critical === privateCase.critical &&
      identity.promptSha256 === privateCase.promptSha256 &&
      identity.expectedSha256 === privateCase.expectedSha256 &&
      identity.maxNewTokens === privateCase.maxNewTokens,
    "public case identity changed");
  });
}

function executionInputSha256(checkpointArtifacts) {
  invariant(isPlainObject(checkpointArtifacts), "capture checkpoint artifacts are invalid");
  const orderedNames = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    ...executionArtifactNames.filter((name) => Object.hasOwn(checkpointArtifacts, name))
  ];
  const inputs = orderedNames.map((name) => {
    const artifact = checkpointArtifacts[name];
    invariant(isPlainObject(artifact), `capture artifact ${name} is missing`);
    return {
      name,
      bytes: requireInteger(artifact.bytes, `capture artifact ${name} bytes`, 1,
        8 * 1024 * 1024 * 1024),
      sha256: requireSha256(artifact.sha256, `capture artifact ${name} hash`)
    };
  });
  return sha256Bytes(Buffer.from(canonicalJson(inputs), "utf8"));
}

function sourceWeightIdentity(checkpointArtifacts) {
  invariant(isPlainObject(checkpointArtifacts), "capture checkpoint artifacts are invalid");
  const hasDirect = Object.hasOwn(checkpointArtifacts, "model.safetensors");
  const hasIndex = Object.hasOwn(checkpointArtifacts, "model.safetensors.index.json");
  invariant(hasDirect !== hasIndex,
    "capture must bind either direct or indexed safetensors weights");

  let identityKind;
  let names;
  if (hasDirect) {
    identityKind = "direct-safetensors-sha256";
    names = ["model.safetensors"];
  } else {
    identityKind = "indexed-safetensors-set-v1";
    const shardNames = Object.keys(checkpointArtifacts)
      .filter((name) => name !== "model.safetensors.index.json" &&
        name.endsWith(".safetensors"))
      .sort();
    invariant(shardNames.length > 0 &&
      shardNames.length + 1 <= maximumWeightArtifactCount,
    "capture weight shard count is invalid");
    names = ["model.safetensors.index.json", ...shardNames];
  }

  const artifacts = names.map((name) => {
    const artifact = checkpointArtifacts[name];
    invariant(isPlainObject(artifact), `capture weight artifact ${name} is missing`);
    return {
      name,
      bytes: requireInteger(artifact.bytes, `capture weight artifact ${name} bytes`,
        1, 8 * 1024 * 1024 * 1024),
      sha256: requireSha256(artifact.sha256, `capture weight artifact ${name} hash`)
    };
  });
  const byteCount = artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
  invariant(Number.isSafeInteger(byteCount) && byteCount > 0 &&
    byteCount <= 8 * 1024 * 1024 * 1024,
  "capture source weight byte count is invalid");
  return Object.freeze({
    identityKind,
    artifactCount: artifacts.length,
    byteCount,
    sha256: hasDirect
      ? artifacts[0].sha256
      : sha256Bytes(Buffer.from(canonicalJson(artifacts), "utf8")),
    artifacts: Object.freeze(artifacts.map((artifact) => Object.freeze(artifact)))
  });
}

function validateSourceParent(store, preregistration) {
  const source = preregistration.sourceModel;
  const parent = store.readReceipt(source.broadSourceScreenReceiptId);
  invariant(parent, "broad source-screen parent is missing");
  // The parent bounds broad claims; the task capture independently binds source inputs.
  invariant(parent.receiptType === "tinyrustlm.model-source-screen-v1" &&
    parent.phase === "model-source-screen" &&
    parent.status === source.broadSourceScreenStatus &&
    parent.publicSafeParameters?.modelId === source.modelId &&
    parent.publicSafeParameters?.sourceModelId === source.modelId &&
    parent.publicSafeParameters?.decision === source.broadSourceScreenStatus &&
    parent.sourceRevision === source.sourceRevision &&
    parent.inputHashes?.sourceModel === source.sourceModelSha256 &&
    parent.publicSafeParameters?.sourceModelIdentityKind ===
      source.sourceWeightIdentityKind &&
    parent.publicSafeParameters?.sourceWeightArtifactCount ===
      source.sourceWeightArtifactCount &&
    parent.publicSafeParameters?.sourceWeightByteCount ===
      source.sourceWeightByteCount &&
    parent.blockerCode === "model_quality_rejected" &&
    source.broadSourceScreenRole === "broad-claim-boundary-only" &&
    source.sourceIdentityAuthority ===
      "independent-task-capture-checkpoint-artifacts-v1",
  "broad source-screen parent identity changed");
  const superseded = store.listReceipts().some((receipt) =>
    receipt.supersedesReceiptIds.includes(parent.receiptId));
  invariant(!superseded, "broad source-screen parent is superseded");
  return parent;
}

function validateCapture(value, preregistration, privateSet, evalArtifact) {
  const source = preregistration.sourceModel;
  const capture = preregistration.captureContract;
  invariant(value.schema === capture.reportSchema, "raw capture schema changed");
  invariant(value.source_model_id === source.modelId &&
    value.source_revision === source.sourceRevision,
  "raw capture source identity changed");
  invariant(value.eval_cases_sha256 === evalArtifact.sha256 &&
    evalArtifact.sha256 === preregistration.sealedInputs.evalCasesSha256,
  "raw capture eval identity changed");
  invariant(value.adapter === null && value.policy_examples === null &&
    value.user_suffix === "",
  "raw capture added an adapter, examples, or suffix");
  invariant(canonicalJson(validateChatTemplateOptions(value.chat_template_options)) ===
    canonicalJson(capture.chatTemplateOptions),
  "raw capture chat template options changed");
  invariant(sha256Bytes(Buffer.from(String(value.system_prompt), "utf8")) ===
    capture.systemPromptSha256,
  "raw capture system prompt changed");
  invariant(value.generation_profile === "greedy" &&
    value.generation_seed_base === capture.generationSeedBase &&
    value.generation_contract === "one-call-unmodified-v1" &&
    value.generation_retries_allowed === false &&
    value.response_repairs_allowed === false &&
    value.field_assembly_allowed === false &&
    value.expected_answer_injection_allowed === false,
  "raw capture generation contract changed");
  invariant(isPlainObject(value.generation) &&
    value.generation.do_sample === false &&
    value.generation.repetition_penalty === 1 &&
    value.generation.temperature === null &&
    value.generation.top_k === null &&
    value.generation.top_p === null,
  "raw capture is not the preregistered greedy profile");
  invariant(value.loader_contract === "local-files-no-remote-code-v1" &&
    value.torch_compile_mode === "disabled-eager" &&
    value.tokenizer_load_options?.local_files_only === true &&
    value.tokenizer_load_options?.trust_remote_code === false &&
    value.model_load_options?.local_files_only === true &&
    value.model_load_options?.trust_remote_code === false &&
    value.model_load_options?.dtype === "float32" &&
    value.dtype === "float32" &&
    value.device === "cpu",
  "raw capture loader contract changed");
  const weightIdentity = sourceWeightIdentity(value.checkpoint_artifacts);
  invariant(weightIdentity.sha256 === source.sourceModelSha256 &&
    weightIdentity.identityKind === source.sourceWeightIdentityKind &&
    weightIdentity.artifactCount === source.sourceWeightArtifactCount &&
    weightIdentity.byteCount === source.sourceWeightByteCount &&
    executionInputSha256(value.checkpoint_artifacts) === source.sourceExecutionInputsSha256,
  "raw capture checkpoint identity changed");
  invariant(value.case_count === privateSet.cases.length &&
    Array.isArray(value.cases) &&
    value.cases.length === privateSet.cases.length,
  "raw capture case count changed");
  return Object.freeze(value.cases.map((candidate, index) => {
    const expectedCase = privateSet.cases[index];
    invariant(isPlainObject(candidate) &&
      candidate.index === index &&
      candidate.prompt === expectedCase.prompt &&
      sha256Bytes(Buffer.from(candidate.prompt, "utf8")) === expectedCase.promptSha256 &&
      candidate.max_new_tokens === expectedCase.maxNewTokens &&
      Array.isArray(candidate.history) && candidate.history.length === 0 &&
      candidate.generation_call_count === capture.generationCallsPerCase &&
      candidate.output_transform === "none" &&
      candidate.seed === capture.generationSeedBase + index &&
      typeof candidate.raw_output_text === "string",
    `raw capture case ${index} changed`);
    return Object.freeze({ ...candidate });
  }));
}

function aggregateVerdicts(privateSet, captureCases, acceptance) {
  const verdicts = privateSet.cases.map((candidate, index) => {
    const outcome = evaluateCaseOutput(
      captureCases[index].raw_output_text,
      candidate.expected
    );
    return Object.freeze({
      index,
      caseId: candidate.caseId,
      category: candidate.category,
      critical: candidate.critical,
      status: outcome.status,
      exactMatch: outcome.exactMatch,
      malformed: outcome.malformed,
      failureCodes: outcome.failureCodes,
      rawOutputSha256: outcome.rawOutputSha256,
      rawOutputBytes: outcome.rawOutputBytes
    });
  });
  const categories = privateSet.categories.map((category) => {
    const members = verdicts.filter((candidate) => candidate.category === category.id);
    const exactPassCount = members.filter((candidate) => candidate.exactMatch).length;
    return Object.freeze({
      id: category.id,
      critical: category.critical,
      caseCount: members.length,
      exactPassCount,
      failedCount: members.length - exactPassCount,
      accepted: exactPassCount >= acceptance.minimumPerCategoryPassCount
    });
  });
  const exactPassCount = verdicts.filter((candidate) => candidate.exactMatch).length;
  const malformedOutputCount = verdicts.filter((candidate) => candidate.malformed).length;
  const criticalFailureCount = verdicts.filter(
    (candidate) => candidate.critical && !candidate.exactMatch).length;
  const decisionReasons = [];
  if (exactPassCount < acceptance.minimumExactPassCount) {
    decisionReasons.push("overall-exact-pass-floor-failed");
  }
  if (categories.some((category) => !category.accepted)) {
    decisionReasons.push("category-exact-pass-floor-failed");
  }
  if (acceptance.criticalCasesMustAllPass && criticalFailureCount > 0) {
    decisionReasons.push("critical-case-failed");
  }
  if (malformedOutputCount > acceptance.malformedOutputMaximum) {
    decisionReasons.push("malformed-output-limit-exceeded");
  }
  return Object.freeze({
    verdicts: Object.freeze(verdicts),
    categories: Object.freeze(categories),
    exactPassCount,
    failedCount: verdicts.length - exactPassCount,
    malformedOutputCount,
    criticalFailureCount,
    decision: decisionReasons.length === 0 ? "pass" : "rejected",
    decisionReasons: Object.freeze(decisionReasons)
  });
}

function nextAttempt(store, campaignId, modelId, experimentId) {
  const attempts = store.listReceipts((receipt) =>
    receipt.receiptType === receiptType &&
    receipt.campaignId === campaignId &&
    receipt.publicSafeParameters?.modelId === modelId &&
    receipt.publicSafeParameters?.experimentId === experimentId)
    .map((receipt) => receipt.attempt);
  return attempts.length === 0 ? 1 : Math.max(...attempts) + 1;
}

function writePrivateArtifact(rootPath, category, bytes) {
  const digest = sha256Bytes(bytes);
  const target = path.join(path.resolve(rootPath), category, "sha256",
    digest.slice(0, 2), `${digest}.json`);
  atomicCreate(target, bytes);
  return Object.freeze({ sha256: digest, path: target, bytes: bytes.length });
}

function runScreen(settings) {
  const startedAtUtc = new Date().toISOString();
  const preregistrationArtifact = readJsonArtifact(
    settings.preregistrationPath, "task specialist preregistration");
  const preregistration = validatePreregistration(preregistrationArtifact.value);
  const generatorPath = path.join(__dirname, "task-specialist-case-generator.js");
  const captureToolPath = path.join(__dirname, "reference-raw-quality.py");
  invariant(sha256Bytes(fs.readFileSync(generatorPath)) ===
    preregistration.sealedInputs.generatorSha256,
  "case generator bytes differ from preregistration");
  invariant(sha256Bytes(fs.readFileSync(captureToolPath)) ===
    preregistration.sealedInputs.captureToolSha256,
  "capture tool bytes differ from preregistration");
  invariant(sha256Bytes(fs.readFileSync(__filename)) ===
    preregistration.sealedInputs.evaluatorToolSha256,
  "task evaluator bytes differ from preregistration");

  const privateArtifact = readJsonArtifact(
    settings.privateCaseSetPath, "private task case set");
  const privateSet = validatePrivateCaseSet(
    privateArtifact.value, preregistration, privateArtifact.sha256);
  const evalArtifact = readArtifact(settings.evalCasesPath, "private task eval fixture");
  invariant(evalArtifact.sha256 === preregistration.sealedInputs.evalCasesSha256,
    "private eval fixture differs from preregistration");
  const evalCases = parseEvalFixture(evalArtifact.bytes);
  invariant(evalCases.length === privateSet.cases.length, "eval fixture cardinality changed");
  evalCases.forEach((candidate, index) => {
    const privateCase = privateSet.cases[index];
    invariant(candidate.index === index &&
      candidate.prompt === privateCase.prompt &&
      candidate.maxNewTokens === privateCase.maxNewTokens,
    `eval fixture case ${index} differs from private case set`);
  });

  const publicArtifact = readJsonArtifact(
    settings.publicManifestPath, "public task case manifest");
  validatePublicManifest(
    publicArtifact.value, preregistration, privateSet, publicArtifact.sha256);
  const rawCaptureArtifact = readJsonArtifact(
    settings.rawCapturePath, "private raw source capture", maximumJsonBytes);
  const captureCases = validateCapture(
    rawCaptureArtifact.value, preregistration, privateSet, evalArtifact);
  const aggregate = aggregateVerdicts(
    privateSet, captureCases, preregistration.acceptance);

  const preservedCapture = writePrivateArtifact(
    settings.privateArtifactRoot, "raw-captures", rawCaptureArtifact.bytes);
  const verdict = {
    schema: privateVerdictSchema,
    experimentId: preregistration.experimentId,
    taskContractId,
    preregistrationSha256: preregistrationArtifact.sha256,
    privateCaseSetSha256: privateArtifact.sha256,
    evalCasesSha256: evalArtifact.sha256,
    publicManifestSha256: publicArtifact.sha256,
    rawCaptureSha256: rawCaptureArtifact.sha256,
    sourceModelId: preregistration.sourceModel.modelId,
    sourceRevision: preregistration.sourceModel.sourceRevision,
    sourceModelSha256: preregistration.sourceModel.sourceModelSha256,
    sourceWeightIdentityKind: preregistration.sourceModel.sourceWeightIdentityKind,
    sourceWeightArtifactCount: preregistration.sourceModel.sourceWeightArtifactCount,
    sourceWeightByteCount: preregistration.sourceModel.sourceWeightByteCount,
    caseCount: privateSet.cases.length,
    exactPassCount: aggregate.exactPassCount,
    failedCount: aggregate.failedCount,
    malformedOutputCount: aggregate.malformedOutputCount,
    criticalFailureCount: aggregate.criticalFailureCount,
    decision: aggregate.decision,
    decisionReasons: aggregate.decisionReasons,
    categories: aggregate.categories,
    cases: aggregate.verdicts
  };
  const verdictBytes = Buffer.from(`${JSON.stringify(verdict, null, 2)}\n`, "utf8");
  const preservedVerdict = writePrivateArtifact(
    settings.privateArtifactRoot, "verdicts", verdictBytes);

  const store = new CampaignEvidenceStore(settings.evidenceRoot);
  store.rebuild();
  const sourceParent = validateSourceParent(store, preregistration);
  const attempt = nextAttempt(
    store,
    settings.campaignId,
    preregistration.sourceModel.modelId,
    preregistration.experimentId
  );
  const completedAtUtc = new Date().toISOString();
  const evaluatorSha256 = sha256Bytes(fs.readFileSync(__filename));
  const receipt = store.putReceipt({
    receiptType,
    campaignId: settings.campaignId,
    phase,
    attempt,
    status: aggregate.decision === "pass" ? "pass" : "rejected",
    createdAtUtc: startedAtUtc,
    completedAtUtc,
    inputReceiptIds: [sourceParent.receiptId],
    inputHashes: {
      preregistration: preregistrationArtifact.sha256,
      privateCaseSet: privateArtifact.sha256,
      evalCases: evalArtifact.sha256,
      publicCaseManifest: publicArtifact.sha256,
      rawCapture: rawCaptureArtifact.sha256,
      sourceModel: preregistration.sourceModel.sourceModelSha256,
      sourceExecutionInputs: preregistration.sourceModel.sourceExecutionInputsSha256
    },
    outputHashes: {
      preservedRawCapture: preservedCapture.sha256,
      privateVerdict: preservedVerdict.sha256,
      publicCaseManifest: publicArtifact.sha256
    },
    sourceRevision: preregistration.sourceModel.sourceRevision,
    toolNames: [
      "tinyrustlm-task-specialist-case-generator",
      "tinyrustlm-reference-raw-quality",
      "tinyrustlm-task-specialist-source-screen-v3"
    ],
    toolVersions: [generatorVersion, captureToolVersion, toolVersion],
    toolBinaryHashes: [
      preregistration.sealedInputs.generatorSha256,
      preregistration.sealedInputs.captureToolSha256,
      evaluatorSha256
    ],
    runtimeIdentifier: "win-x64",
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      device: rawCaptureArtifact.value.device,
      dtype: rawCaptureArtifact.value.dtype,
      referenceFramework: rawCaptureArtifact.value.reference_framework,
      torchVersion: rawCaptureArtifact.value.torch_version,
      transformersVersion: rawCaptureArtifact.value.transformers_version
    },
    configurationHash: preregistrationArtifact.sha256,
    publicSafeParameters: {
      experimentId: preregistration.experimentId,
      modelId: preregistration.sourceModel.modelId,
      sourceModelId: preregistration.sourceModel.modelId,
      taskContractId,
      claimBoundary: preregistration.taskContract.claimBoundary,
      broadSourceScreenStatus: sourceParent.status,
      broadSourceScreenRole: preregistration.sourceModel.broadSourceScreenRole,
      sourceIdentityAuthority: preregistration.sourceModel.sourceIdentityAuthority,
      sourceModelIdentityKind: preregistration.sourceModel.sourceWeightIdentityKind,
      sourceWeightArtifactCount: preregistration.sourceModel.sourceWeightArtifactCount,
      sourceWeightByteCount: preregistration.sourceModel.sourceWeightByteCount,
      broadQualityClaimSupported: false,
      taskSpecificProofGranted: false,
      sourceTaskScreenDecision: aggregate.decision,
      conversionSpendAuthorized: aggregate.decision === "pass",
      caseCount: privateSet.cases.length,
      exactPassCount: aggregate.exactPassCount,
      failedCount: aggregate.failedCount,
      malformedOutputCount: aggregate.malformedOutputCount,
      criticalFailureCount: aggregate.criticalFailureCount,
      categoryCount: aggregate.categories.length,
      generationProfile: "greedy",
      generationCallCountPerCase: 1,
      rawOutputPreserved: true,
      responseRepairApplied: false,
      bestOfNApplied: false,
      projectSourceRevision: settings.projectRevision
    },
    boundedDiagnostics: {
      decisionReasons: aggregate.decisionReasons,
      failedCaseIndexes: aggregate.verdicts
        .filter((candidate) => candidate.status === "fail")
        .map((candidate) => candidate.index),
      failureCodes: [...new Set(aggregate.verdicts.flatMap(
        (candidate) => candidate.failureCodes))].sort(),
      categoryPassCounts: aggregate.categories.map((category) => ({
        category: category.id,
        passed: category.exactPassCount,
        total: category.caseCount
      })),
      rawCaptureByteCount: rawCaptureArtifact.bytes.length,
      privateVerdictByteCount: verdictBytes.length
    },
    blockerCode: aggregate.decision === "pass"
      ? null
      : "task_specific_source_quality_rejected",
    externalEvidenceReferences: sourceParent.externalEvidenceReferences,
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: `sha256:${preregistrationArtifact.sha256}`
  });
  return Object.freeze({
    receipt: receipt.receipt,
    receiptPath: receipt.path,
    privateRawCapturePath: preservedCapture.path,
    privateVerdictPath: preservedVerdict.path,
    publicSummary: Object.freeze({
      receiptId: receipt.receipt.receiptId,
      status: receipt.receipt.status,
      modelId: preregistration.sourceModel.modelId,
      taskContractId,
      caseCount: privateSet.cases.length,
      exactPassCount: aggregate.exactPassCount,
      malformedOutputCount: aggregate.malformedOutputCount,
      criticalFailureCount: aggregate.criticalFailureCount,
      conversionSpendAuthorized: aggregate.decision === "pass",
      taskSpecificProofGranted: false
    })
  });
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    invariant(key?.startsWith("--") && value !== undefined, "invalid command arguments");
    invariant(!values.has(key), `duplicate argument: ${key}`);
    values.set(key, value);
  }
  const required = [
    "--evidence-root",
    "--campaign-id",
    "--preregistration",
    "--private-case-set",
    "--eval-cases",
    "--public-manifest",
    "--raw-capture",
    "--private-artifact-root",
    "--project-revision"
  ];
  for (const key of required) invariant(values.has(key), `missing argument: ${key}`);
  invariant(values.size === required.length, "unknown command argument");
  const projectRevision = String(values.get("--project-revision")).toLowerCase();
  invariant(projectRevisionPattern.test(projectRevision), "project revision is invalid");
  return Object.freeze({
    evidenceRoot: path.resolve(values.get("--evidence-root")),
    campaignId: values.get("--campaign-id"),
    preregistrationPath: path.resolve(values.get("--preregistration")),
    privateCaseSetPath: path.resolve(values.get("--private-case-set")),
    evalCasesPath: path.resolve(values.get("--eval-cases")),
    publicManifestPath: path.resolve(values.get("--public-manifest")),
    rawCapturePath: path.resolve(values.get("--raw-capture")),
    privateArtifactRoot: path.resolve(values.get("--private-artifact-root")),
    projectRevision
  });
}

function main(argv) {
  const result = runScreen(parseArguments(argv));
  process.stdout.write(`${JSON.stringify(result.publicSummary)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  aggregateVerdicts,
  evaluateCaseOutput,
  outputKeys,
  parseStrictJson,
  preregistrationSchema,
  privateVerdictSchema,
  receiptType,
  runScreen,
  sourceWeightIdentity,
  toolVersion,
  validateCapture,
  validateChatTemplateOptions,
  validatePreregistration,
  validateSourceParent,
  validateTaskValue
});
