"use strict";

// Read-only independent verifier for publisher, reconstructed, and Rust scalar
// trace bundles. It emits one bounded verdict to stdout and never writes evidence.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REQUEST_SCHEMA = "tinyrustlm.qwen3_numerical_trace_verification_request.v1";
const PROFILE_SCHEMA = "tinyrustlm.qwen3_numerical_differential_profile.v1";
const PROFILE_ID = "tinyrustlm.qwen3-source-reconstructed-scalar-differential/1";
const GENERIC_BUNDLE_SCHEMA = "tinyrustlm.numerical_trace_bundle.v1";
const SCALAR_BUNDLE_SCHEMA = "tinyrustlm.scalar-numerical-probe-result.v1";
const TRACE_PROFILE_ID = "tinyrustlm.scalar-full-stage-f32le/1";
const MAXIMUM_REQUEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_PROFILE_BYTES = 4 * 1024 * 1024;
const MAXIMUM_MANIFEST_BYTES = 32 * 1024 * 1024;
const MAXIMUM_TRACE_BYTES = 64 * 1024 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const TRACE_FILE = /^case-[0-9]{3}-step-[0-9]{3}\.f32le$/u;

const MODEL_SPEC = Object.freeze({
  vocabularySize: 151936,
  contextLength: 40960,
  embeddingSize: 1024,
  feedForwardSize: 3072,
  layerCount: 28,
  headCount: 16,
  kvHeadCount: 8,
  headDimension: 128,
  ropeTheta: 1000000,
  normalizationEpsilon: 0.000001,
  tiedEmbeddings: true,
  qkvBias: false,
  qkNormalization: true
});

const STAGE_ELEMENTS = Object.freeze({
  "token-embedding": MODEL_SPEC.embeddingSize,
  "attention-normalized": MODEL_SPEC.embeddingSize,
  "query-after-rope": MODEL_SPEC.headCount * MODEL_SPEC.headDimension,
  "key-after-rope": MODEL_SPEC.kvHeadCount * MODEL_SPEC.headDimension,
  value: MODEL_SPEC.kvHeadCount * MODEL_SPEC.headDimension,
  attention: MODEL_SPEC.headCount * MODEL_SPEC.headDimension,
  "post-attention-residual": MODEL_SPEC.embeddingSize,
  "feed-forward-normalized": MODEL_SPEC.embeddingSize,
  "feed-forward-activated": MODEL_SPEC.feedForwardSize,
  "post-feed-forward-residual": MODEL_SPEC.embeddingSize,
  "final-normalized": MODEL_SPEC.embeddingSize,
  logits: MODEL_SPEC.vocabularySize
});

class NumericalTraceVerificationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new NumericalTraceVerificationError(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && !Buffer.isBuffer(value);
}

function exactKeys(value, keys, code) {
  invariant(isPlainObject(value), code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(expected), code);
  return value;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function canonicalJsonBytes(value, sorted = true) {
  const rendered = sorted ? sortValue(value) : value;
  return Buffer.from(`${JSON.stringify(rendered, null, 2)}\n`, "utf8");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function validDigest(value) {
  return typeof value === "string" && SHA256.test(value);
}

function validIdentifier(value, maximum = 160) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maximum
    && IDENTIFIER.test(value);
}

function normalizePath(filePath) {
  invariant(typeof filePath === "string" && filePath.length > 0 && filePath.length <= 4096
    && !filePath.includes("\0") && path.isAbsolute(filePath), "numerical-verifier-path");
  return path.resolve(filePath);
}

function directDirectory(directoryPath, code) {
  const normalized = normalizePath(directoryPath);
  let stat;
  let real;
  try {
    stat = fs.lstatSync(normalized);
    real = fs.realpathSync.native(normalized);
  } catch {
    fail(code);
  }
  invariant(stat.isDirectory() && !stat.isSymbolicLink()
    && path.normalize(real).toLowerCase() === path.normalize(normalized).toLowerCase(), code);
  return normalized;
}

function readRegularFile(filePath, maximumBytes, code, allowEmpty = false) {
  const normalized = normalizePath(filePath);
  let stat;
  let real;
  let bytes;
  try {
    stat = fs.lstatSync(normalized);
    real = fs.realpathSync.native(normalized);
    invariant(stat.isFile() && !stat.isSymbolicLink()
      && path.normalize(real).toLowerCase() === path.normalize(normalized).toLowerCase(), code);
    invariant((allowEmpty || stat.size > 0) && stat.size <= maximumBytes, code);
    bytes = fs.readFileSync(normalized);
  } catch (error) {
    if (error instanceof NumericalTraceVerificationError) throw error;
    fail(code);
  }
  invariant(bytes.length === stat.size, code);
  return Object.freeze({ path: normalized, bytes, byteLength: bytes.length, sha256: sha256(bytes) });
}

function readJson(filePath, maximumBytes, code, sortedCanonical) {
  const file = readRegularFile(filePath, maximumBytes, code);
  let value;
  try {
    value = JSON.parse(file.bytes.toString("utf8"));
  } catch {
    fail(code);
  }
  invariant(isPlainObject(value) && file.bytes.equals(canonicalJsonBytes(value, sortedCanonical)), code);
  return Object.freeze({ ...file, value });
}

function expectedStages() {
  const output = [{ stage: "token-embedding", layer: null }];
  const perLayer = [
    "attention-normalized",
    "query-after-rope",
    "key-after-rope",
    "value",
    "attention",
    "post-attention-residual",
    "feed-forward-normalized",
    "feed-forward-activated",
    "post-feed-forward-residual"
  ];
  for (let layer = 0; layer < MODEL_SPEC.layerCount; layer += 1) {
    perLayer.forEach((stage) => output.push({ stage, layer }));
  }
  output.push({ stage: "final-normalized", layer: null });
  output.push({ stage: "logits", layer: null });
  return output;
}

function f32FromBits(hex, code) {
  invariant(typeof hex === "string" && /^[0-9a-f]{8}$/u.test(hex), code);
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(Number.parseInt(hex, 16), 0);
  const value = bytes.readFloatLE(0);
  invariant(Number.isFinite(value), code);
  return value;
}

function validateModelSpec(raw, scalar) {
  const code = "numerical-verifier-model-spec";
  if (!scalar) {
    exactKeys(raw, Object.keys(MODEL_SPEC), code);
    invariant(Object.entries(MODEL_SPEC).every(([key, value]) => raw[key] === value), code);
    return MODEL_SPEC;
  }
  exactKeys(raw, [
    "vocabularySize", "contextLength", "embeddingSize", "feedForwardSize", "layerCount",
    "headCount", "kvHeadCount", "headDimension", "ropeThetaF32Bits",
    "normalizationEpsilonF32Bits", "tiedEmbeddings", "qkvBias", "qkNormalization"
  ], code);
  f32FromBits(raw.ropeThetaF32Bits, code);
  f32FromBits(raw.normalizationEpsilonF32Bits, code);
  invariant(raw.vocabularySize === MODEL_SPEC.vocabularySize
    && raw.contextLength === MODEL_SPEC.contextLength
    && raw.embeddingSize === MODEL_SPEC.embeddingSize
    && raw.feedForwardSize === MODEL_SPEC.feedForwardSize
    && raw.layerCount === MODEL_SPEC.layerCount
    && raw.headCount === MODEL_SPEC.headCount
    && raw.kvHeadCount === MODEL_SPEC.kvHeadCount
    && raw.headDimension === MODEL_SPEC.headDimension
    && raw.ropeThetaF32Bits === "49742400"
    && raw.normalizationEpsilonF32Bits === "358637bd"
    && raw.tiedEmbeddings === MODEL_SPEC.tiedEmbeddings
    && raw.qkvBias === MODEL_SPEC.qkvBias
    && raw.qkNormalization === MODEL_SPEC.qkNormalization, code);
  return MODEL_SPEC;
}

function validateIdentity(value, code) {
  exactKeys(value, ["byteLength", "sha256"], code);
  invariant(Number.isSafeInteger(value.byteLength) && value.byteLength > 0 && validDigest(value.sha256), code);
}

function validateStage(stage, expected, cursor, code) {
  exactKeys(stage, ["stage", "layer", "offsetBytes", "elementCount", "byteLength", "f32leSha256"], code);
  invariant(stage.stage === expected.stage && stage.layer === expected.layer
    && Object.hasOwn(STAGE_ELEMENTS, stage.stage)
    && stage.offsetBytes === cursor
    && stage.elementCount === STAGE_ELEMENTS[stage.stage]
    && stage.byteLength === stage.elementCount * 4
    && validDigest(stage.f32leSha256), code);
  return cursor + stage.byteLength;
}

function validateCases(rawCases, declaredCaseCount, declaredTraceFiles, declaredTraceBytes, code) {
  invariant(Array.isArray(rawCases) && rawCases.length > 0 && rawCases.length === declaredCaseCount, code);
  const expected = expectedStages();
  let traceFiles = 0;
  let traceBytes = 0;
  const caseIds = new Set();
  for (const item of rawCases) {
    exactKeys(item, ["id", "tokenCount", "tokenIdsLeU32Sha256", "steps"], code);
    invariant(validIdentifier(item.id, 96) && !caseIds.has(item.id) && validDigest(item.tokenIdsLeU32Sha256)
      && Number.isSafeInteger(item.tokenCount) && item.tokenCount > 0
      && Array.isArray(item.steps) && item.steps.length === item.tokenCount, code);
    caseIds.add(item.id);
    item.steps.forEach((step, stepIndex) => {
      exactKeys(step, [
        "step", "positionBefore", "positionAfter", "committedKvBytes", "greedyTokenId",
        "traceFile", "traceByteLength", "traceSha256", "stages"
      ], code);
      invariant(step.step === stepIndex && step.positionBefore === stepIndex
        && step.positionAfter === stepIndex + 1
        && Number.isSafeInteger(step.committedKvBytes) && step.committedKvBytes > 0
        && Number.isSafeInteger(step.greedyTokenId) && step.greedyTokenId >= 0
        && step.greedyTokenId < MODEL_SPEC.vocabularySize && TRACE_FILE.test(step.traceFile)
        && Number.isSafeInteger(step.traceByteLength) && step.traceByteLength > 0
        && validDigest(step.traceSha256) && Array.isArray(step.stages)
        && step.stages.length === expected.length, code);
      let cursor = 0;
      step.stages.forEach((stage, stageIndex) => {
        cursor = validateStage(stage, expected[stageIndex], cursor, code);
      });
      invariant(cursor === step.traceByteLength, code);
      traceFiles += 1;
      traceBytes += step.traceByteLength;
      invariant(Number.isSafeInteger(traceBytes) && traceBytes <= MAXIMUM_TRACE_BYTES, code);
    });
  }
  invariant(traceFiles === declaredTraceFiles && traceBytes === declaredTraceBytes, code);
}

function normalizeGenericBundle(document) {
  const code = "numerical-verifier-generic-bundle";
  exactKeys(document, [
    "schema", "operationId", "status", "claim", "implementation", "request",
    "differentialProfileSha256", "registrationSha256", "traceProfileId", "source",
    "modelSpec", "caseCount", "traceFileCount", "traceByteLength", "cases",
    "durability", "requiredNextGate"
  ], code);
  invariant(document.schema === GENERIC_BUNDLE_SCHEMA && validIdentifier(document.operationId)
    && document.status === "completed" && validDigest(document.differentialProfileSha256)
    && validDigest(document.registrationSha256) && document.traceProfileId === TRACE_PROFILE_ID
    && typeof document.claim === "string" && isPlainObject(document.implementation)
    && isPlainObject(document.source) && typeof document.requiredNextGate === "string", code);
  validateIdentity(document.request, code);
  validateModelSpec(document.modelSpec, false);
  exactKeys(document.durability,
    ["traceFilesSynced", "resultFileSynced", "directorySyncClaimed"], code);
  invariant(document.durability.traceFilesSynced === true
    && document.durability.resultFileSynced === true
    && document.durability.directorySyncClaimed === false
    && Number.isSafeInteger(document.caseCount) && document.caseCount > 0
    && Number.isSafeInteger(document.traceFileCount) && document.traceFileCount > 0
    && Number.isSafeInteger(document.traceByteLength) && document.traceByteLength > 0, code);
  validateCases(document.cases, document.caseCount, document.traceFileCount,
    document.traceByteLength, code);
  return document;
}

function validateEnvironmentBinding(value, code) {
  exactKeys(value, ["authority", "lock"], code);
  exactKeys(value.authority, ["relativePath", "byteLength", "sha256"], code);
  exactKeys(value.lock, [
    "relativePath", "byteLength", "sha256", "profileId", "runtimeClosureSha256"
  ], code);
  invariant(value.authority.relativePath
      === "tinyrustlm/tools/qwen3_numerical_environment_lock.py"
    && Number.isSafeInteger(value.authority.byteLength) && value.authority.byteLength > 0
    && validDigest(value.authority.sha256)
    && value.lock.relativePath
      === "contracts/vnext/qwen3-numerical-oracle-environment-lock.v1.json"
    && Number.isSafeInteger(value.lock.byteLength) && value.lock.byteLength > 0
    && validDigest(value.lock.sha256)
    && value.lock.profileId === "tinyrustlm.qwen3-numerical-oracle-python-win-x64/1"
    && validDigest(value.lock.runtimeClosureSha256), code);
}

function validateGenericRole(kind, document) {
  const code = `numerical-verifier-${kind}-role`;
  if (kind === "source") {
    invariant(document.claim === "private-publisher-source-traces-created-not-numerical-parity",
      code);
    exactKeys(document.implementation, [
      "kind", "profileId", "pythonVersion", "packages", "device", "dtype",
      "attentionImplementation", "threads", "environment"
    ], code);
    exactKeys(document.implementation.packages,
      ["torch", "transformers", "safetensors", "tokenizers", "numpy"], code);
    validateEnvironmentBinding(document.implementation.environment, code);
    invariant(document.implementation.kind === "publisher-source-framework"
      && document.implementation.profileId === "tinyrustlm.qwen3-publisher-source-trace/1"
      && document.implementation.pythonVersion === "3.12.10"
      && document.implementation.packages.torch === "2.7.0"
      && document.implementation.packages.transformers === "4.51.0"
      && document.implementation.packages.safetensors === "0.5.3"
      && document.implementation.packages.tokenizers === "0.21.1"
      && document.implementation.packages.numpy === "2.2.5"
      && document.implementation.device === "cpu" && document.implementation.dtype === "float32"
      && document.implementation.attentionImplementation === "eager"
      && document.implementation.threads === 1 && isPlainObject(document.implementation.packages),
    code);
    exactKeys(document.source, ["modelId", "revision", "sourceLock", "model"], code);
    invariant(document.source.modelId === "Qwen/Qwen3-0.6B"
      && document.source.revision === "c1899de289a04d12100db370d81485cdf75e47ca",
    code);
    validateIdentity(document.source.sourceLock, code);
    exactKeys(document.source.model, ["fileName", "byteLength", "sha256"], code);
    invariant(document.source.model.fileName === "model.safetensors"
      && Number.isSafeInteger(document.source.model.byteLength)
      && document.source.model.byteLength > 0 && validDigest(document.source.model.sha256), code);
    return;
  }
  invariant(kind === "reconstructed"
    && document.claim === "private-reconstructed-slm2-traces-created-not-numerical-parity", code);
  exactKeys(document.implementation, [
    "kind", "profileId", "pythonVersion", "packages", "matrixChunkRows", "wholeModelF32Shadow",
    "environment"
  ], code);
  exactKeys(document.implementation.packages, ["numpy"], code);
  validateEnvironmentBinding(document.implementation.environment, code);
  invariant(document.implementation.kind === "slm2-reconstructed-weight-diagnostic"
    && document.implementation.profileId === "tinyrustlm.qwen3-slm2-reconstructed-trace/1"
    && document.implementation.pythonVersion === "3.12.10"
    && document.implementation.packages.numpy === "2.2.5"
    && Number.isSafeInteger(document.implementation.matrixChunkRows)
    && document.implementation.matrixChunkRows > 0
    && document.implementation.wholeModelF32Shadow === false
    && isPlainObject(document.implementation.packages), code);
  exactKeys(document.source, ["compositionResultSha256", "model"], code);
  invariant(validDigest(document.source.compositionResultSha256), code);
  exactKeys(document.source.model, ["fileName", "byteLength", "sha256"], code);
  invariant(document.source.model.fileName === "model.slm2"
    && Number.isSafeInteger(document.source.model.byteLength)
    && document.source.model.byteLength > 0 && validDigest(document.source.model.sha256), code);
}

function normalizeScalarBundle(document) {
  const code = "numerical-verifier-scalar-bundle";
  exactKeys(document, [
    "schema", "operationId", "status", "claim", "request", "compositionResultSha256",
    "traceProfileId", "model", "modelSpec", "policy", "memoryPlan", "caseCount",
    "traceFileCount", "traceByteLength", "cases", "durability", "requiredNextGate"
  ], code);
  invariant(document.schema === SCALAR_BUNDLE_SCHEMA && validIdentifier(document.operationId)
    && document.status === "completed"
    && document.claim === "private-scalar-traces-created-not-numerical-parity"
    && validDigest(document.compositionResultSha256) && document.traceProfileId === TRACE_PROFILE_ID
    && isPlainObject(document.model) && isPlainObject(document.policy)
    && isPlainObject(document.memoryPlan) && typeof document.requiredNextGate === "string", code);
  validateIdentity(document.request, code);
  validateModelSpec(document.modelSpec, true);
  exactKeys(document.durability,
    ["traceFilesSynced", "resultFileSynced", "directorySyncClaimed"], code);
  invariant(document.durability.traceFilesSynced === true
    && document.durability.resultFileSynced === true
    && document.durability.directorySyncClaimed === false
    && Number.isSafeInteger(document.caseCount) && document.caseCount > 0
    && Number.isSafeInteger(document.traceFileCount) && document.traceFileCount > 0
    && Number.isSafeInteger(document.traceByteLength) && document.traceByteLength > 0, code);
  validateCases(document.cases, document.caseCount, document.traceFileCount,
    document.traceByteLength, code);
  return document;
}

function validateBundleRegistration(kind, document, request) {
  const code = "numerical-verifier-bundle-binding";
  invariant(document.operationId === request.operationId && document.traceProfileId === request.traceProfileId, code);
  if (kind !== "scalar") {
    invariant(document.differentialProfileSha256 === request.differentialProfile.sha256
      && document.registrationSha256 === request.registrationSha256, code);
  }
}

function loadBundle(kind, binding, request) {
  const code = `numerical-verifier-${kind}-binding`;
  exactKeys(binding, ["root", "manifest"], code);
  const root = directDirectory(binding.root, code);
  exactKeys(binding.manifest, ["fileName", "byteLength", "sha256"], code);
  invariant(binding.manifest.fileName === "probe.json"
    && Number.isSafeInteger(binding.manifest.byteLength) && binding.manifest.byteLength > 0
    && binding.manifest.byteLength <= request.policy.maximumManifestBytes
    && validDigest(binding.manifest.sha256), code);
  const manifestPath = path.join(root, binding.manifest.fileName);
  invariant(path.dirname(manifestPath).toLowerCase() === root.toLowerCase(), code);
  const manifest = readJson(manifestPath, request.policy.maximumManifestBytes, code, kind !== "scalar");
  invariant(manifest.byteLength === binding.manifest.byteLength
    && manifest.sha256 === binding.manifest.sha256, code);
  const document = kind === "scalar"
    ? normalizeScalarBundle(manifest.value)
    : normalizeGenericBundle(manifest.value);
  if (kind !== "scalar") validateGenericRole(kind, document);
  validateBundleRegistration(kind, document, request);
  const expectedNames = new Set(["probe.json"]);
  for (const item of document.cases) {
    for (const step of item.steps) {
      invariant(!expectedNames.has(step.traceFile), code);
      expectedNames.add(step.traceFile);
    }
  }
  let actualNames;
  try {
    actualNames = fs.readdirSync(root).sort();
  } catch {
    fail(code);
  }
  invariant(JSON.stringify(actualNames) === JSON.stringify([...expectedNames].sort()), code);
  return Object.freeze({ kind, root, manifest, document });
}

function validateThreshold(value, code) {
  exactKeys(value, [
    "maximumAbsoluteError", "maximumRelativeError", "maximumNormalizedRmse",
    "minimumCosineSimilarity", "maximumSignDisagreementRate", "maximumUlp"
  ], code);
  invariant(Number.isFinite(value.maximumAbsoluteError) && value.maximumAbsoluteError >= 0
    && Number.isFinite(value.maximumRelativeError) && value.maximumRelativeError >= 0
    && Number.isFinite(value.maximumNormalizedRmse) && value.maximumNormalizedRmse >= 0
    && Number.isFinite(value.minimumCosineSimilarity) && value.minimumCosineSimilarity >= -1
    && value.minimumCosineSimilarity <= 1
    && Number.isFinite(value.maximumSignDisagreementRate)
    && value.maximumSignDisagreementRate >= 0 && value.maximumSignDisagreementRate <= 1
    && Number.isSafeInteger(value.maximumUlp) && value.maximumUlp >= 0
    && value.maximumUlp <= 0xffff_ffff, code);
}

function validateArrow(value, code) {
  exactKeys(value, [
    "id", "reference", "candidate", "requireGreedyTokenIdentity", "minimumTopKOverlap",
    "thresholds"
  ], code);
  invariant(["source-to-reconstructed", "reconstructed-to-scalar"].includes(value.id)
    && ["source", "reconstructed", "scalar"].includes(value.reference)
    && ["source", "reconstructed", "scalar"].includes(value.candidate)
    && value.reference !== value.candidate && typeof value.requireGreedyTokenIdentity === "boolean"
    && Number.isFinite(value.minimumTopKOverlap) && value.minimumTopKOverlap >= 0
    && value.minimumTopKOverlap <= 1, code);
  exactKeys(value.thresholds, ["default", "stages"], code);
  validateThreshold(value.thresholds.default, code);
  invariant(isPlainObject(value.thresholds.stages), code);
  for (const [stage, threshold] of Object.entries(value.thresholds.stages)) {
    invariant(Object.hasOwn(STAGE_ELEMENTS, stage), code);
    validateThreshold(threshold, code);
  }
}

function validateRequest(requestPath) {
  const requestFile = readJson(requestPath, MAXIMUM_REQUEST_BYTES,
    "numerical-verifier-request", true);
  const value = requestFile.value;
  exactKeys(value, [
    "schema", "operationId", "differentialProfile", "registrationSha256", "traceProfileId",
    "bundles", "comparison", "policy"
  ], "numerical-verifier-request");
  invariant(value.schema === REQUEST_SCHEMA && validIdentifier(value.operationId)
    && validDigest(value.registrationSha256) && value.traceProfileId === TRACE_PROFILE_ID,
  "numerical-verifier-request");
  exactKeys(value.differentialProfile, ["relativePath", "byteLength", "sha256"],
    "numerical-verifier-profile-binding");
  invariant(value.differentialProfile.relativePath
    === "contracts/vnext/qwen3-numerical-differential-profile.v1.json"
    && Number.isSafeInteger(value.differentialProfile.byteLength)
    && value.differentialProfile.byteLength > 0
    && value.differentialProfile.byteLength <= MAXIMUM_PROFILE_BYTES
    && validDigest(value.differentialProfile.sha256), "numerical-verifier-profile-binding");
  exactKeys(value.bundles, ["source", "reconstructed", "scalar"], "numerical-verifier-bundles");
  exactKeys(value.comparison,
    ["chunkElements", "relativeFloor", "signFloor", "topK", "arrows"],
    "numerical-verifier-comparison");
  invariant(Number.isSafeInteger(value.comparison.chunkElements)
    && value.comparison.chunkElements >= 1 && value.comparison.chunkElements <= 1_048_576
    && Number.isFinite(value.comparison.relativeFloor) && value.comparison.relativeFloor > 0
    && Number.isFinite(value.comparison.signFloor) && value.comparison.signFloor >= 0
    && Number.isSafeInteger(value.comparison.topK) && value.comparison.topK >= 1
    && value.comparison.topK <= 1024 && Array.isArray(value.comparison.arrows)
    && value.comparison.arrows.length === 2, "numerical-verifier-comparison");
  value.comparison.arrows.forEach((arrow) => validateArrow(arrow, "numerical-verifier-arrow"));
  invariant(value.comparison.arrows[0].id === "source-to-reconstructed"
    && value.comparison.arrows[0].reference === "source"
    && value.comparison.arrows[0].candidate === "reconstructed"
    && value.comparison.arrows[1].id === "reconstructed-to-scalar"
    && value.comparison.arrows[1].reference === "reconstructed"
    && value.comparison.arrows[1].candidate === "scalar", "numerical-verifier-arrow-order");
  exactKeys(value.policy,
    ["maximumManifestBytes", "maximumTraceBytes", "maximumReceiptBytes", "maximumCases",
      "maximumTokensPerCase"],
    "numerical-verifier-policy");
  invariant(Number.isSafeInteger(value.policy.maximumManifestBytes)
    && value.policy.maximumManifestBytes >= 1 && value.policy.maximumManifestBytes <= MAXIMUM_MANIFEST_BYTES
    && Number.isSafeInteger(value.policy.maximumTraceBytes) && value.policy.maximumTraceBytes >= 1
    && value.policy.maximumTraceBytes <= MAXIMUM_TRACE_BYTES
    && Number.isSafeInteger(value.policy.maximumReceiptBytes)
    && value.policy.maximumReceiptBytes >= 1
    && value.policy.maximumReceiptBytes <= MAXIMUM_PROFILE_BYTES
    && Number.isSafeInteger(value.policy.maximumCases) && value.policy.maximumCases >= 1
    && value.policy.maximumCases <= 32
    && Number.isSafeInteger(value.policy.maximumTokensPerCase)
    && value.policy.maximumTokensPerCase >= 1 && value.policy.maximumTokensPerCase <= 256,
  "numerical-verifier-policy");

  const repositoryRoot = path.resolve(__dirname, "../..");
  const profilePath = path.join(repositoryRoot, ...value.differentialProfile.relativePath.split("/"));
  const profileFile = readRegularFile(profilePath, MAXIMUM_PROFILE_BYTES,
    "numerical-verifier-profile-binding");
  invariant(profileFile.byteLength === value.differentialProfile.byteLength
    && profileFile.sha256 === value.differentialProfile.sha256, "numerical-verifier-profile-binding");
  let profile;
  try {
    profile = JSON.parse(profileFile.bytes.toString("utf8"));
  } catch {
    fail("numerical-verifier-profile-binding");
  }
  invariant(profile.schema === PROFILE_SCHEMA && profile.profileId === PROFILE_ID,
    "numerical-verifier-profile-binding");
  return Object.freeze({ ...value, profile, requestIdentity: {
    byteLength: requestFile.byteLength, sha256: requestFile.sha256
  }, profileIdentity: { byteLength: profileFile.byteLength, sha256: profileFile.sha256 } });
}

function compareCaseClosure(bundles, request) {
  const source = bundles.source.document;
  const candidates = [bundles.reconstructed.document, bundles.scalar.document];
  const reconstructedModel = bundles.reconstructed.document.source.model;
  const scalarModel = bundles.scalar.document.model;
  const sourceEnvironment = bundles.source.document.implementation.environment;
  const reconstructedEnvironment = bundles.reconstructed.document.implementation.environment;
  const profileEnvironment = request.profile.environment;
  const profileAuthority = request.profile.implementations.environmentAuthority;
  exactKeys(scalarModel, ["fileName", "byteLength", "sha256"],
    "numerical-verifier-model-binding");
  invariant(reconstructedModel.fileName === scalarModel.fileName
    && reconstructedModel.byteLength === scalarModel.byteLength
    && reconstructedModel.sha256 === scalarModel.sha256
    && scalarModel.fileName === "model.slm2"
    && scalarModel.byteLength === request.profile.candidate.modelSlm2.byteLength
    && scalarModel.sha256 === request.profile.candidate.modelSlm2.sha256
    && bundles.reconstructed.document.source.compositionResultSha256
      === bundles.scalar.document.compositionResultSha256
    && bundles.scalar.document.compositionResultSha256
      === request.profile.candidate.compositionResult.sha256,
  "numerical-verifier-model-binding");
  invariant(source.source.sourceLock.byteLength
      === request.profile.candidate.sourceLock.byteLength
    && source.source.sourceLock.sha256 === request.profile.candidate.sourceLock.sha256,
  "numerical-verifier-source-lock-binding");
  invariant(profileEnvironment && profileEnvironment.lock && profileAuthority
    && sourceEnvironment.authority.relativePath === profileAuthority.path
    && sourceEnvironment.authority.byteLength === profileAuthority.byteLength
    && sourceEnvironment.authority.sha256 === profileAuthority.sha256
    && sourceEnvironment.lock.relativePath === profileEnvironment.lock.path
    && sourceEnvironment.lock.byteLength === profileEnvironment.lock.byteLength
    && sourceEnvironment.lock.sha256 === profileEnvironment.lock.sha256
    && sourceEnvironment.lock.profileId === profileEnvironment.lock.profileId
    && sourceEnvironment.lock.runtimeClosureSha256
      === profileEnvironment.lock.runtimeClosureSha256
    && reconstructedEnvironment.authority.relativePath === sourceEnvironment.authority.relativePath
    && reconstructedEnvironment.authority.byteLength === sourceEnvironment.authority.byteLength
    && reconstructedEnvironment.authority.sha256 === sourceEnvironment.authority.sha256
    && reconstructedEnvironment.lock.relativePath === sourceEnvironment.lock.relativePath
    && reconstructedEnvironment.lock.byteLength === sourceEnvironment.lock.byteLength
    && reconstructedEnvironment.lock.sha256 === sourceEnvironment.lock.sha256
    && reconstructedEnvironment.lock.profileId === sourceEnvironment.lock.profileId
    && reconstructedEnvironment.lock.runtimeClosureSha256
      === sourceEnvironment.lock.runtimeClosureSha256,
  "numerical-verifier-environment-binding");
  invariant(source.caseCount <= request.policy.maximumCases, "numerical-verifier-case-limit");
  for (const candidate of candidates) {
    invariant(candidate.caseCount === source.caseCount, "numerical-verifier-case-closure");
    source.cases.forEach((item, caseIndex) => {
      const other = candidate.cases[caseIndex];
      invariant(other.id === item.id && other.tokenCount === item.tokenCount
        && other.tokenCount <= request.policy.maximumTokensPerCase
        && other.tokenIdsLeU32Sha256 === item.tokenIdsLeU32Sha256
        && other.steps.length === item.steps.length, "numerical-verifier-case-closure");
      item.steps.forEach((step, stepIndex) => {
        const compared = other.steps[stepIndex];
        invariant(compared.step === step.step && compared.positionBefore === step.positionBefore
          && compared.positionAfter === step.positionAfter
          && compared.stages.length === step.stages.length, "numerical-verifier-case-closure");
      });
    });
  }
}

function readTrace(bundle, step, maximumBytes) {
  invariant(step.traceByteLength <= maximumBytes, "numerical-verifier-trace-limit");
  const tracePath = path.join(bundle.root, step.traceFile);
  invariant(path.dirname(tracePath).toLowerCase() === bundle.root.toLowerCase(),
    "numerical-verifier-trace-path");
  const trace = readRegularFile(tracePath, maximumBytes, "numerical-verifier-trace");
  invariant(trace.byteLength === step.traceByteLength && trace.sha256 === step.traceSha256,
    "numerical-verifier-trace-identity");
  step.stages.forEach((stage) => {
    const bytes = trace.bytes.subarray(stage.offsetBytes, stage.offsetBytes + stage.byteLength);
    invariant(bytes.length === stage.byteLength && sha256(bytes) === stage.f32leSha256,
      "numerical-verifier-stage-identity");
  });
  return trace.bytes;
}

function orderedF32(bits) {
  if ((bits & 0x7fff_ffff) === 0) return 0x8000_0000;
  return (bits & 0x8000_0000) !== 0
    ? 0x8000_0000 - (bits & 0x7fff_ffff)
    : 0x8000_0000 + bits;
}

function ulpDistance(leftBits, rightBits) {
  return Math.abs(orderedF32(leftBits) - orderedF32(rightBits));
}

function topK(bytes, stage, count) {
  const heap = [];
  const worse = (left, right) => left.value < right.value
    || left.value === right.value && left.index > right.index;
  const better = (left, right) => left.value > right.value
    || left.value === right.value && left.index < right.index;
  const bubbleUp = (start) => {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!worse(heap[index], heap[parent])) break;
      [heap[index], heap[parent]] = [heap[parent], heap[index]];
      index = parent;
    }
  };
  const bubbleDown = () => {
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let worst = index;
      if (left < heap.length && worse(heap[left], heap[worst])) worst = left;
      if (right < heap.length && worse(heap[right], heap[worst])) worst = right;
      if (worst === index) break;
      [heap[index], heap[worst]] = [heap[worst], heap[index]];
      index = worst;
    }
  };
  for (let index = 0; index < stage.elementCount; index += 1) {
    const value = bytes.readFloatLE(stage.offsetBytes + index * 4);
    invariant(Number.isFinite(value), "numerical-verifier-nonfinite");
    const item = { index, value };
    if (heap.length < count) {
      heap.push(item);
      bubbleUp(heap.length - 1);
    } else if (better(item, heap[0])) {
      heap[0] = item;
      bubbleDown();
    }
  }
  heap.sort((left, right) => right.value - left.value || left.index - right.index);
  return heap.map((item) => item.index);
}

function stageMetrics(referenceBytes, candidateBytes, referenceStage, candidateStage,
  comparison, threshold) {
  invariant(referenceStage.stage === candidateStage.stage
    && referenceStage.layer === candidateStage.layer
    && referenceStage.elementCount === candidateStage.elementCount,
  "numerical-verifier-stage-closure");
  let maximumAbsoluteError = 0;
  let maximumRelativeError = 0;
  let maximumUlp = 0;
  let worstElement = 0;
  let maximumRelativeElement = 0;
  let maximumUlpElement = 0;
  let firstSignDisagreement = null;
  let firstCoordinateFailure = null;
  let squaredError = 0;
  let squaredReference = 0;
  let dot = 0;
  let squaredCandidate = 0;
  let signDisagreements = 0;
  let signPopulation = 0;
  const chunkWorst = new Map();
  for (let index = 0; index < referenceStage.elementCount; index += 1) {
    const referenceOffset = referenceStage.offsetBytes + index * 4;
    const candidateOffset = candidateStage.offsetBytes + index * 4;
    const reference = referenceBytes.readFloatLE(referenceOffset);
    const candidate = candidateBytes.readFloatLE(candidateOffset);
    invariant(Number.isFinite(reference) && Number.isFinite(candidate),
      "numerical-verifier-nonfinite");
    const difference = candidate - reference;
    const absolute = Math.abs(difference);
    const relative = absolute / Math.max(Math.abs(reference), Math.abs(candidate),
      comparison.relativeFloor);
    const ulp = ulpDistance(referenceBytes.readUInt32LE(referenceOffset),
      candidateBytes.readUInt32LE(candidateOffset));
    if (absolute > maximumAbsoluteError || absolute === maximumAbsoluteError && index < worstElement) {
      maximumAbsoluteError = absolute;
      worstElement = index;
    }
    if (relative > maximumRelativeError) {
      maximumRelativeError = relative;
      maximumRelativeElement = index;
    }
    if (ulp > maximumUlp) {
      maximumUlp = ulp;
      maximumUlpElement = index;
    }
    squaredError += difference * difference;
    squaredReference += reference * reference;
    squaredCandidate += candidate * candidate;
    dot += reference * candidate;
    if (Math.max(Math.abs(reference), Math.abs(candidate)) > comparison.signFloor) {
      signPopulation += 1;
      if ((reference < 0) !== (candidate < 0)) {
        signDisagreements += 1;
        if (firstSignDisagreement === null) firstSignDisagreement = index;
      }
    }
    if (threshold && firstCoordinateFailure === null) {
      const reasons = [];
      if (absolute > threshold.maximumAbsoluteError) reasons.push("maximum-absolute-error");
      if (relative > threshold.maximumRelativeError) reasons.push("maximum-relative-error");
      if (ulp > threshold.maximumUlp) reasons.push("maximum-ulp");
      if (reasons.length > 0) firstCoordinateFailure = { element: index, reasons };
    }
    const chunk = Math.floor(index / comparison.chunkElements);
    const prior = chunkWorst.get(chunk) || { absolute: 0, relative: 0, ulp: 0, element: index };
    if (absolute > prior.absolute) {
      prior.absolute = absolute;
      prior.element = index;
    }
    prior.relative = Math.max(prior.relative, relative);
    prior.ulp = Math.max(prior.ulp, ulp);
    chunkWorst.set(chunk, prior);
  }
  const count = referenceStage.elementCount;
  const referenceRms = Math.sqrt(squaredReference / count);
  const normalizedRmse = Math.sqrt(squaredError / count)
    / Math.max(referenceRms, comparison.relativeFloor);
  let cosineSimilarity;
  if (squaredReference === 0 && squaredCandidate === 0) cosineSimilarity = 1;
  else if (squaredReference === 0 || squaredCandidate === 0) cosineSimilarity = 0;
  else cosineSimilarity = dot / Math.sqrt(squaredReference * squaredCandidate);
  const signDisagreementRate = signPopulation === 0 ? 0 : signDisagreements / signPopulation;
  invariant([maximumAbsoluteError, maximumRelativeError, normalizedRmse, cosineSimilarity,
    signDisagreementRate].every(Number.isFinite), "numerical-verifier-metric-nonfinite");
  return Object.freeze({
    maximumAbsoluteError,
    maximumRelativeError,
    maximumNormalizedRmse: normalizedRmse,
    minimumCosineSimilarity: cosineSimilarity,
    maximumSignDisagreementRate: signDisagreementRate,
    maximumUlp,
    worstElement,
    maximumRelativeElement,
    maximumUlpElement,
    firstSignDisagreement,
    firstCoordinateFailure,
    chunkWorst
  });
}

function failedMetrics(metrics, threshold) {
  const reasons = [];
  if (metrics.maximumAbsoluteError > threshold.maximumAbsoluteError) reasons.push("maximum-absolute-error");
  if (metrics.maximumRelativeError > threshold.maximumRelativeError) reasons.push("maximum-relative-error");
  if (metrics.maximumNormalizedRmse > threshold.maximumNormalizedRmse) reasons.push("normalized-rmse");
  if (metrics.minimumCosineSimilarity < threshold.minimumCosineSimilarity) reasons.push("cosine-similarity");
  if (metrics.maximumSignDisagreementRate > threshold.maximumSignDisagreementRate) reasons.push("sign-disagreement");
  if (metrics.maximumUlp > threshold.maximumUlp) reasons.push("maximum-ulp");
  return reasons;
}

function headFor(stage, element) {
  if (["query-after-rope", "key-after-rope", "value", "attention"].includes(stage)) {
    return Math.floor(element / MODEL_SPEC.headDimension);
  }
  return null;
}

function metricsPublic(metrics) {
  const receipt = {
    maximumAbsoluteError: metrics.maximumAbsoluteError,
    maximumRelativeError: metrics.maximumRelativeError,
    maximumNormalizedRmse: metrics.maximumNormalizedRmse,
    minimumCosineSimilarity: metrics.minimumCosineSimilarity,
    maximumSignDisagreementRate: metrics.maximumSignDisagreementRate,
    maximumUlp: metrics.maximumUlp
  };
}

function compareArrow(arrow, bundles, request) {
  const referenceBundle = bundles[arrow.reference];
  const candidateBundle = bundles[arrow.candidate];
  const summary = {
    id: arrow.id,
    status: "pass",
    comparedStageCount: 0,
    comparedElementCount: 0,
    worst: {
      maximumAbsoluteError: 0,
      maximumRelativeError: 0,
      maximumNormalizedRmse: 0,
      minimumCosineSimilarity: 1,
      maximumSignDisagreementRate: 0,
      maximumUlp: 0
    }
  };
  for (let caseIndex = 0; caseIndex < referenceBundle.document.cases.length; caseIndex += 1) {
    const referenceCase = referenceBundle.document.cases[caseIndex];
    const candidateCase = candidateBundle.document.cases[caseIndex];
    for (let stepIndex = 0; stepIndex < referenceCase.steps.length; stepIndex += 1) {
      const referenceStep = referenceCase.steps[stepIndex];
      const candidateStep = candidateCase.steps[stepIndex];
      const referenceBytes = readTrace(referenceBundle, referenceStep,
        request.policy.maximumTraceBytes);
      const candidateBytes = readTrace(candidateBundle, candidateStep,
        request.policy.maximumTraceBytes);
      for (let stageIndex = 0; stageIndex < referenceStep.stages.length; stageIndex += 1) {
        const referenceStage = referenceStep.stages[stageIndex];
        const candidateStage = candidateStep.stages[stageIndex];
        const threshold = arrow.thresholds.stages[referenceStage.stage]
          || arrow.thresholds.default;
        const metrics = stageMetrics(referenceBytes, candidateBytes, referenceStage,
          candidateStage, request.comparison, threshold);
        summary.comparedStageCount += 1;
        summary.comparedElementCount += referenceStage.elementCount;
        summary.worst.maximumAbsoluteError = Math.max(summary.worst.maximumAbsoluteError,
          metrics.maximumAbsoluteError);
        summary.worst.maximumRelativeError = Math.max(summary.worst.maximumRelativeError,
          metrics.maximumRelativeError);
        summary.worst.maximumNormalizedRmse = Math.max(summary.worst.maximumNormalizedRmse,
          metrics.maximumNormalizedRmse);
        summary.worst.minimumCosineSimilarity = Math.min(summary.worst.minimumCosineSimilarity,
          metrics.minimumCosineSimilarity);
        summary.worst.maximumSignDisagreementRate = Math.max(
          summary.worst.maximumSignDisagreementRate, metrics.maximumSignDisagreementRate);
        summary.worst.maximumUlp = Math.max(summary.worst.maximumUlp, metrics.maximumUlp);
        const reasons = failedMetrics(metrics, threshold);
        let topKOverlap = null;
        if (referenceStage.stage === "logits") {
          const referenceTop = topK(referenceBytes, referenceStage, request.comparison.topK);
          const candidateTop = new Set(topK(candidateBytes, candidateStage,
            request.comparison.topK));
          topKOverlap = referenceTop.filter((token) => candidateTop.has(token)).length
            / request.comparison.topK;
          if (topKOverlap < arrow.minimumTopKOverlap) reasons.push("top-k-overlap");
          if (arrow.requireGreedyTokenIdentity
              && referenceStep.greedyTokenId !== candidateStep.greedyTokenId) {
            reasons.push("greedy-token-identity");
          }
        }
        if (reasons.length > 0) {
          summary.status = "fail";
          let element = metrics.worstElement;
          if (metrics.firstCoordinateFailure !== null) {
            element = metrics.firstCoordinateFailure.element;
          } else if (reasons.includes("maximum-relative-error")) {
            element = metrics.maximumRelativeElement;
          } else if (reasons.includes("maximum-ulp")) {
            element = metrics.maximumUlpElement;
          } else if (reasons.includes("sign-disagreement")
              && metrics.firstSignDisagreement !== null) {
            element = metrics.firstSignDisagreement;
          } else if (referenceStage.stage === "logits"
              && reasons.includes("greedy-token-identity")) {
            element = referenceStep.greedyTokenId;
          }
          return {
            summary,
            divergence: {
              arrow: arrow.id,
              reference: arrow.reference,
              candidate: arrow.candidate,
              caseId: referenceCase.id,
              caseIndex,
              step: stepIndex,
              position: referenceStep.positionBefore,
              stage: referenceStage.stage,
              layer: referenceStage.layer,
              head: headFor(referenceStage.stage, element),
              elementIndex: element,
              chunkIndex: Math.floor(element / request.comparison.chunkElements),
              chunkStartElement: Math.floor(element / request.comparison.chunkElements)
                * request.comparison.chunkElements,
              reasons,
              metrics: metricsPublic(metrics),
              threshold,
              topKOverlap
            }
          };
        }
      }
    }
  }
  return { summary, divergence: null };
}

function verify(arguments_) {
  invariant(Array.isArray(arguments_) && arguments_.length === 1,
    "numerical-verifier-arguments");
  const request = validateRequest(arguments_[0]);
  const bundles = {
    source: loadBundle("source", request.bundles.source, request),
    reconstructed: loadBundle("reconstructed", request.bundles.reconstructed, request),
    scalar: loadBundle("scalar", request.bundles.scalar, request)
  };
  compareCaseClosure(bundles, request);
  const arrowResults = [];
  let firstDivergence = null;
  for (const arrow of request.comparison.arrows) {
    const result = compareArrow(arrow, bundles, request);
    arrowResults.push(result.summary);
    if (result.divergence !== null) {
      firstDivergence = result.divergence;
      break;
    }
  }
  const status = firstDivergence === null ? "pass" : "fail";
  return {
    schema: "tinyrustlm.qwen3_numerical_trace_verification_receipt.v1",
    operationId: request.operationId,
    status,
    claim: status === "pass"
      ? "registered-source-reconstructed-scalar-traces-within-bounds"
      : "registered-numerical-differential-rejected",
    request: request.requestIdentity,
    differentialProfile: request.profileIdentity,
    registrationSha256: request.registrationSha256,
    traceProfileId: request.traceProfileId,
    bundles: Object.fromEntries(Object.entries(bundles).map(([kind, bundle]) => [kind, {
      manifestByteLength: bundle.manifest.byteLength,
      manifestSha256: bundle.manifest.sha256,
      caseCount: bundle.document.caseCount,
      traceFileCount: bundle.document.traceFileCount,
      traceByteLength: bundle.document.traceByteLength
    }])),
    comparison: {
      chunkElements: request.comparison.chunkElements,
      relativeFloor: request.comparison.relativeFloor,
      signFloor: request.comparison.signFloor,
      topK: request.comparison.topK,
      arrowResults,
      firstDivergence
    },
    writesPerformed: false,
    allowedClaim: status === "pass" ? "source-to-reconstructed-and-reconstructed-to-scalar-numerical-gate" : "none",
    prohibitedClaims: [
      "browser-wasm-parity",
      "behavioral-quality",
      "p2p-availability",
      "site-release",
      "campaign-progress"
    ]
  };
  invariant(canonicalJsonBytes(receipt, true).length <= request.policy.maximumReceiptBytes,
    "numerical-verifier-receipt-limit");
  return receipt;
}

function main() {
  const receipt = verify(process.argv.slice(2));
  process.stdout.write(canonicalJsonBytes(receipt, true));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const code = error instanceof NumericalTraceVerificationError
      ? error.code : "numerical-verifier-internal";
    process.stderr.write(`qwen3-numerical-verifier-error:${code}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  NumericalTraceVerificationError,
  canonicalJsonBytes,
  expectedStages,
  stageMetrics,
  verify
});
