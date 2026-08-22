"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const HEADER_BYTES = 256;
const WEIGHT_COUNT = 8193;
const WEIGHT_RECORD_BYTES = 8;
const WEIGHT_TABLE_BYTES = WEIGHT_COUNT * WEIGHT_RECORD_BYTES;
const FILE_BYTES = HEADER_BYTES + WEIGHT_TABLE_BYTES;
const LOG_STEPS_PER_NATURAL_UNIT = 256;
const MAXIMUM_LOG_STEP = 8192;
const WEIGHT_FRACTION_BITS = 48;
const LOGIT_FRACTION_BITS = 20;
const LOGIT_SCALE = 1n << 20n;
const MAXIMUM_FIXED_LOGIT = 32768n * LOGIT_SCALE;
const MAXIMUM_VOCABULARY_SIZE = 151_936;
const MAXIMUM_TOP_K = 1024;
const MAXIMUM_REPETITION_WINDOW = 64;
const MAXIMUM_STOP_TOKENS = 16;
const MAXIMUM_NEW_TOKENS = 4096;
const MAXIMUM_CONTEXT_TOKENS = 40_960;
const MILLION = 1_000_000n;
const MAXIMUM_TEMPERATURE = 4_000_000;
const MINIMUM_REPETITION_PENALTY = 1_000_000;
const MAXIMUM_REPETITION_PENALTY = 2_000_000;
const PROFILE_ID = "org.minimodel.sampling2/2.0";
const PROFILE_SHA256 = "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d";
const TABLE_SHA256 = "fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677";
const ARTIFACT_SHA256 = "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89";
const MAGIC = Buffer.from([0x53, 0x4d, 0x50, 0x32, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMAT_ID = Buffer.from("minimodel.smp2\0\0", "ascii");
const MASK_64 = (1n << 64n) - 1n;
const TWO_128 = 1n << 128n;
const MAX_U64 = MASK_64;
const SPLITMIX_INCREMENT = 0x9e3779b97f4a7c15n;
const SPLITMIX_MIX_1 = 0xbf58476d1ce4e5b9n;
const SPLITMIX_MIX_2 = 0x94d049bb133111ebn;
const CONFIG_KEYS = Object.freeze([
  "maximumNewTokens",
  "repetitionPenaltyMillionths",
  "repetitionWindow",
  "temperatureMillionths",
  "topK",
  "topPMillionths"
]);
const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/sampling2-format-profile.v1.json");
const tablePath = path.join(repositoryRoot, "contracts/vnext/sampling2-exp-q48-table.v1.bin");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/sampling2-format-vectors.v1.json");

class Sampling2ReferenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "Sampling2ReferenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new Sampling2ReferenceError(code);
}

function assertInvariant(condition, code) {
  if (!condition) fail(code);
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateProfileIdentity() {
  const bytes = fs.readFileSync(profilePath);
  if (sha256Hex(bytes) !== PROFILE_SHA256) fail("sampling2-profile-drift");
  const profile = JSON.parse(bytes.toString("utf8"));
  if (profile.profileId !== PROFILE_ID ||
      profile.format.canonicalArtifactSha256 !== ARTIFACT_SHA256 ||
      profile.weightTable.tableSha256 !== TABLE_SHA256) {
    fail("sampling2-profile-drift");
  }
}

function roundTiesEvenNumber(value) {
  const floor = Math.floor(value);
  const remainder = value - floor;
  if (remainder < 0.5) return floor;
  if (remainder > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

function roundDivEvenUnsigned(numerator, denominator) {
  assertInvariant(typeof numerator === "bigint" && numerator >= 0n &&
    typeof denominator === "bigint" && denominator > 0n, "sampling2-arithmetic");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const doubled = remainder * 2n;
  if (doubled < denominator) return quotient;
  if (doubled > denominator) return quotient + 1n;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

function ceilDivUnsigned(numerator, denominator) {
  assertInvariant(typeof numerator === "bigint" && numerator >= 0n &&
    typeof denominator === "bigint" && denominator > 0n, "sampling2-arithmetic");
  return numerator === 0n ? 0n : ((numerator - 1n) / denominator) + 1n;
}

function writeU16(bytes, offset, value) {
  bytes.writeUInt16LE(value, offset);
}

function writeU32(bytes, offset, value) {
  bytes.writeUInt32LE(value, offset);
}

function writeU64(bytes, offset, value) {
  bytes.writeBigUInt64LE(BigInt(value), offset);
}

function readU16(bytes, offset) {
  if (offset + 2 > bytes.length) fail("sampling2-header");
  return bytes.readUInt16LE(offset);
}

function readU32(bytes, offset) {
  if (offset + 4 > bytes.length) fail("sampling2-header");
  return bytes.readUInt32LE(offset);
}

function readU64(bytes, offset) {
  if (offset + 8 > bytes.length) fail("sampling2-header");
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("sampling2-layout");
  return Number(value);
}

function allZero(bytes, start, end) {
  for (let index = start; index < end; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  return true;
}

function strictHex(value) {
  if (typeof value !== "string" || value.length % 2 !== 0 ||
      !/^(?:[0-9a-f]{2})*$/u.test(value)) {
    fail("sampling2-vector-hex");
  }
  return Buffer.from(value, "hex");
}

function generateWeightTable() {
  const bytes = Buffer.alloc(WEIGHT_TABLE_BYTES);
  const scale = 2 ** WEIGHT_FRACTION_BITS;
  let prior = null;
  for (let index = 0; index < WEIGHT_COUNT; index += 1) {
    const weight = roundTiesEvenNumber(Math.exp(-index / LOG_STEPS_PER_NATURAL_UNIT) * scale);
    if (!Number.isSafeInteger(weight) || weight <= 0 || (prior !== null && weight > prior)) {
      fail("sampling2-table-values");
    }
    bytes.writeBigUInt64LE(BigInt(weight), index * WEIGHT_RECORD_BYTES);
    prior = weight;
  }
  if (bytes.readBigUInt64LE(0) !== 1n << 48n ||
      bytes.readBigUInt64LE(bytes.length - 8) !== 4n ||
      sha256Hex(bytes) !== TABLE_SHA256) {
    fail("sampling2-table-hash");
  }
  return bytes;
}

function writeSampling2() {
  validateProfileIdentity();
  const table = generateWeightTable();
  const artifact = Buffer.alloc(FILE_BYTES);
  MAGIC.copy(artifact, 0);
  FORMAT_ID.copy(artifact, 8);
  writeU32(artifact, 24, HEADER_BYTES);
  writeU16(artifact, 28, 2);
  writeU16(artifact, 30, 0);
  writeU32(artifact, 32, 0x0102_0304);
  writeU16(artifact, 36, 1);
  writeU16(artifact, 38, 0);
  writeU64(artifact, 40, FILE_BYTES);
  writeU64(artifact, 48, HEADER_BYTES);
  writeU32(artifact, 56, WEIGHT_COUNT);
  writeU32(artifact, 60, WEIGHT_RECORD_BYTES);
  writeU32(artifact, 64, LOG_STEPS_PER_NATURAL_UNIT);
  writeU32(artifact, 68, MAXIMUM_LOG_STEP);
  writeU16(artifact, 72, WEIGHT_FRACTION_BITS);
  writeU16(artifact, 74, 1);
  writeU16(artifact, 76, 1);
  writeU16(artifact, 78, 1);
  writeU32(artifact, 80, MAXIMUM_VOCABULARY_SIZE);
  writeU32(artifact, 84, MAXIMUM_TOP_K);
  writeU32(artifact, 88, MAXIMUM_REPETITION_WINDOW);
  writeU32(artifact, 92, MAXIMUM_STOP_TOKENS);
  writeU32(artifact, 96, MAXIMUM_NEW_TOKENS);
  writeU32(artifact, 100, MAXIMUM_CONTEXT_TOKENS);
  writeU32(artifact, 104, Number(MILLION));
  writeU16(artifact, 108, LOGIT_FRACTION_BITS);
  writeU16(artifact, 110, 1);
  writeU32(artifact, 112, 1);
  writeU32(artifact, 116, MAXIMUM_TEMPERATURE);
  writeU32(artifact, 120, 1);
  writeU32(artifact, 124, Number(MILLION));
  writeU32(artifact, 128, MINIMUM_REPETITION_PENALTY);
  writeU32(artifact, 132, MAXIMUM_REPETITION_PENALTY);
  Buffer.from(TABLE_SHA256, "hex").copy(artifact, 136);
  table.copy(artifact, HEADER_BYTES);
  if (sha256Hex(artifact) !== ARTIFACT_SHA256) fail("sampling2-artifact-identity");
  return artifact;
}

function validatePolicy(policy) {
  if (policy === undefined) return Object.freeze({ maximumArtifactBytes: FILE_BYTES });
  if (policy === null || typeof policy !== "object" || Array.isArray(policy) ||
      Object.keys(policy).length !== 1 ||
      !Number.isInteger(policy.maximumArtifactBytes) ||
      policy.maximumArtifactBytes < 1 || policy.maximumArtifactBytes > FILE_BYTES) {
    fail("sampling2-policy");
  }
  return Object.freeze({ maximumArtifactBytes: policy.maximumArtifactBytes });
}

function parseSampling2(input, policyInput) {
  validateProfileIdentity();
  const policy = validatePolicy(policyInput);
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from(input || []);
  if (bytes.length > policy.maximumArtifactBytes) fail("sampling2-artifact-limit");
  if (bytes.length < HEADER_BYTES || !bytes.subarray(0, 8).equals(MAGIC) ||
      !bytes.subarray(8, 24).equals(FORMAT_ID) || readU32(bytes, 24) !== HEADER_BYTES ||
      readU16(bytes, 28) !== 2 || readU16(bytes, 30) !== 0 ||
      readU32(bytes, 32) !== 0x0102_0304) {
    fail("sampling2-header");
  }
  if (readU16(bytes, 36) !== 1 || readU16(bytes, 38) !== 0) {
    fail("sampling2-profile");
  }
  if (readU64(bytes, 40) !== bytes.length || bytes.length !== FILE_BYTES) {
    fail("sampling2-header");
  }
  if (readU64(bytes, 48) !== HEADER_BYTES || readU32(bytes, 56) !== WEIGHT_COUNT ||
      readU32(bytes, 60) !== WEIGHT_RECORD_BYTES ||
      HEADER_BYTES + WEIGHT_COUNT * WEIGHT_RECORD_BYTES !== bytes.length) {
    fail("sampling2-layout");
  }
  if (readU32(bytes, 64) !== LOG_STEPS_PER_NATURAL_UNIT ||
      readU32(bytes, 68) !== MAXIMUM_LOG_STEP ||
      readU16(bytes, 72) !== WEIGHT_FRACTION_BITS ||
      readU16(bytes, 74) !== 1 || readU16(bytes, 76) !== 1 || readU16(bytes, 78) !== 1 ||
      readU32(bytes, 80) !== MAXIMUM_VOCABULARY_SIZE ||
      readU32(bytes, 84) !== MAXIMUM_TOP_K ||
      readU32(bytes, 88) !== MAXIMUM_REPETITION_WINDOW ||
      readU32(bytes, 92) !== MAXIMUM_STOP_TOKENS ||
      readU32(bytes, 96) !== MAXIMUM_NEW_TOKENS ||
      readU32(bytes, 100) !== MAXIMUM_CONTEXT_TOKENS ||
      readU32(bytes, 104) !== Number(MILLION) ||
      readU16(bytes, 108) !== LOGIT_FRACTION_BITS || readU16(bytes, 110) !== 1 ||
      readU32(bytes, 112) !== 1 || readU32(bytes, 116) !== MAXIMUM_TEMPERATURE ||
      readU32(bytes, 120) !== 1 || readU32(bytes, 124) !== Number(MILLION) ||
      readU32(bytes, 128) !== MINIMUM_REPETITION_PENALTY ||
      readU32(bytes, 132) !== MAXIMUM_REPETITION_PENALTY) {
    fail("sampling2-profile");
  }
  if (!bytes.subarray(136, 168).equals(Buffer.from(TABLE_SHA256, "hex"))) {
    fail("sampling2-table-hash");
  }
  if (!allZero(bytes, 168, HEADER_BYTES)) fail("sampling2-reserved");
  const tableBytes = bytes.subarray(HEADER_BYTES);
  if (sha256Hex(tableBytes) !== TABLE_SHA256) fail("sampling2-table-hash");
  const weights = [];
  let prior = null;
  for (let index = 0; index < WEIGHT_COUNT; index += 1) {
    const weight = tableBytes.readBigUInt64LE(index * WEIGHT_RECORD_BYTES);
    if (weight === 0n || (prior !== null && weight > prior)) fail("sampling2-table-values");
    weights.push(weight);
    prior = weight;
  }
  if (weights[0] !== 1n << 48n || weights.at(-1) !== 4n) {
    fail("sampling2-table-values");
  }
  if (sha256Hex(bytes) !== ARTIFACT_SHA256) fail("sampling2-artifact-identity");
  return Object.freeze({
    identity: Object.freeze({ byteLength: bytes.length, sha256: ARTIFACT_SHA256 }),
    profileId: PROFILE_ID,
    weights: Object.freeze(weights)
  });
}

function binary32ToQ20(bits) {
  if (!Number.isInteger(bits) || bits < 0 || bits > 0xffff_ffff) {
    fail("sampling2-logit-range");
  }
  const sign = bits >>> 31;
  const exponent = (bits >>> 23) & 0xff;
  const fraction = bits & 0x7f_ffff;
  if (exponent === 0xff) {
    if (fraction !== 0) fail("sampling2-logit-nan");
    if (sign === 0) fail("sampling2-logit-positive-infinity");
    return null;
  }
  if (exponent === 0 && fraction === 0) return 0n;
  const significand = BigInt(exponent === 0 ? fraction : 0x80_0000 + fraction);
  const shift = exponent === 0 ? -129 : exponent - 130;
  let magnitude;
  if (shift >= 0) {
    if (shift > 35) fail("sampling2-logit-range");
    magnitude = significand << BigInt(shift);
  } else {
    magnitude = roundDivEvenUnsigned(significand, 1n << BigInt(-shift));
  }
  if (magnitude > MAXIMUM_FIXED_LOGIT) fail("sampling2-logit-range");
  if (magnitude === 0n) return 0n;
  return sign === 0 ? magnitude : -magnitude;
}

function f32Bits(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatLE(value, 0);
  return bytes.readUInt32LE(0);
}

function validateConfig(config, vocabularySize) {
  if (config === null || typeof config !== "object" || Array.isArray(config) ||
      !Number.isInteger(vocabularySize) || vocabularySize < 1 ||
      vocabularySize > MAXIMUM_VOCABULARY_SIZE) {
    fail("sampling2-config");
  }
  const keys = Object.keys(config).sort();
  if (keys.length !== CONFIG_KEYS.length || keys.some((key, index) => key !== CONFIG_KEYS[index])) {
    fail("sampling2-config");
  }
  for (const key of CONFIG_KEYS) {
    if (!Number.isInteger(config[key]) || config[key] < 0 || config[key] > 0xffff_ffff) {
      fail("sampling2-config");
    }
  }
  if (config.temperatureMillionths > MAXIMUM_TEMPERATURE ||
      config.topK < 1 || config.topK > Math.min(MAXIMUM_TOP_K, vocabularySize) ||
      config.topPMillionths < 1 || config.topPMillionths > Number(MILLION) ||
      config.repetitionPenaltyMillionths < MINIMUM_REPETITION_PENALTY ||
      config.repetitionPenaltyMillionths > MAXIMUM_REPETITION_PENALTY ||
      config.repetitionWindow > MAXIMUM_REPETITION_WINDOW ||
      config.maximumNewTokens < 1 || config.maximumNewTokens > MAXIMUM_NEW_TOKENS ||
      (config.temperatureMillionths === 0 &&
        (config.topK !== 1 || config.topPMillionths !== Number(MILLION)))) {
    fail("sampling2-config");
  }
  return Object.freeze({ ...config });
}

function validateHistory(history, vocabularySize) {
  if (!Array.isArray(history) || history.length > MAXIMUM_NEW_TOKENS) {
    fail("sampling2-history-token");
  }
  for (const tokenId of history) {
    if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId >= vocabularySize) {
      fail("sampling2-history-token");
    }
  }
}

function applyRepetitionPenalty(score, penaltyMillionths) {
  if (score > 0n) {
    return roundDivEvenUnsigned(score * MILLION, BigInt(penaltyMillionths));
  }
  if (score < 0n) {
    return -roundDivEvenUnsigned((-score) * BigInt(penaltyMillionths), MILLION);
  }
  return 0n;
}

function prepareCandidates(sampling, logitBits, generatedHistory, configInput) {
  if (!sampling || sampling.profileId !== PROFILE_ID || !Array.isArray(logitBits) ||
      logitBits.length < 1 || logitBits.length > MAXIMUM_VOCABULARY_SIZE) {
    fail("sampling2-vocabulary");
  }
  const config = validateConfig(configInput, logitBits.length);
  validateHistory(generatedHistory, logitBits.length);
  const repeated = new Set(generatedHistory.slice(-config.repetitionWindow));
  const candidates = [];
  for (let tokenId = 0; tokenId < logitBits.length; tokenId += 1) {
    const converted = binary32ToQ20(logitBits[tokenId]);
    if (converted === null) continue;
    const adjusted = repeated.has(tokenId)
      ? applyRepetitionPenalty(converted, config.repetitionPenaltyMillionths)
      : converted;
    candidates.push({ tokenId, score: adjusted });
  }
  if (candidates.length === 0) fail("sampling2-all-masked");
  candidates.sort((left, right) => {
    if (left.score > right.score) return -1;
    if (left.score < right.score) return 1;
    return left.tokenId - right.tokenId;
  });
  candidates.length = Math.min(candidates.length, config.topK);
  if (config.temperatureMillionths === 0) {
    return Object.freeze({ config, candidates, retained: [candidates[0]], retainedWeight: null });
  }
  const maximum = candidates[0].score;
  let total = 0n;
  for (const candidate of candidates) {
    const gap = maximum - candidate.score;
    const step = roundDivEvenUnsigned(
      gap * BigInt(LOG_STEPS_PER_NATURAL_UNIT) * MILLION,
      BigInt(config.temperatureMillionths) * LOGIT_SCALE
    );
    candidate.step = step;
    candidate.weight = step <= BigInt(MAXIMUM_LOG_STEP) ? sampling.weights[Number(step)] : 0n;
    total += candidate.weight;
  }
  assertInvariant(total > 0n, "sampling2-arithmetic");
  const target = ceilDivUnsigned(total * BigInt(config.topPMillionths), MILLION);
  const retained = [];
  let cumulative = 0n;
  for (const candidate of candidates) {
    retained.push(candidate);
    cumulative += candidate.weight;
    if (cumulative >= target) break;
  }
  const retainedWeight = retained.reduce((sum, candidate) => sum + candidate.weight, 0n);
  assertInvariant(retained.length > 0 && retainedWeight > 0n, "sampling2-arithmetic");
  return Object.freeze({ config, candidates, retained, retainedWeight });
}

function rotateLeft64(value, amount) {
  const shift = BigInt(amount);
  return ((value << shift) | (value >> (64n - shift))) & MASK_64;
}

function splitMix64Word(context) {
  context.x = (context.x + SPLITMIX_INCREMENT) & MASK_64;
  let z = context.x;
  z = ((z ^ (z >> 30n)) * SPLITMIX_MIX_1) & MASK_64;
  z = ((z ^ (z >> 27n)) * SPLITMIX_MIX_2) & MASK_64;
  return (z ^ (z >> 31n)) & MASK_64;
}

function seedState(seed) {
  if (typeof seed !== "bigint" || seed < 0n || seed > MAX_U64) {
    fail("sampling2-prng-state");
  }
  const context = { x: seed };
  const state = {
    words: [
      splitMix64Word(context),
      splitMix64Word(context),
      splitMix64Word(context),
      splitMix64Word(context)
    ],
    drawCount: 0n
  };
  validateState(state);
  return state;
}

function validateState(state) {
  if (state === null || typeof state !== "object" || !Array.isArray(state.words) ||
      state.words.length !== 4 || typeof state.drawCount !== "bigint" ||
      state.drawCount < 0n || state.drawCount > MAX_U64 ||
      state.words.some((word) => typeof word !== "bigint" || word < 0n || word > MAX_U64) ||
      state.words.every((word) => word === 0n)) {
    fail("sampling2-prng-state");
  }
}

function cloneState(state) {
  validateState(state);
  return { words: [...state.words], drawCount: state.drawCount };
}

function nextU64(state) {
  validateState(state);
  if (state.drawCount === MAX_U64) fail("sampling2-prng-exhausted");
  const [s0, s1, s2, s3] = state.words;
  const result = (rotateLeft64((s1 * 5n) & MASK_64, 7) * 9n) & MASK_64;
  const t = (s1 << 17n) & MASK_64;
  let n2 = s2 ^ s0;
  let n3 = s3 ^ s1;
  const n1 = s1 ^ n2;
  const n0 = s0 ^ n3;
  n2 ^= t;
  n3 = rotateLeft64(n3, 45);
  state.words = [n0 & MASK_64, n1 & MASK_64, n2 & MASK_64, n3 & MASK_64];
  state.drawCount += 1n;
  return result;
}

function serializeState(state) {
  validateState(state);
  const bytes = Buffer.alloc(40);
  for (let index = 0; index < 4; index += 1) {
    bytes.writeBigUInt64LE(state.words[index], index * 8);
  }
  bytes.writeBigUInt64LE(state.drawCount, 32);
  return bytes;
}

function parseState(bytesInput) {
  const bytes = Buffer.isBuffer(bytesInput) ? bytesInput : Buffer.from(bytesInput || []);
  if (bytes.length !== 40) fail("sampling2-prng-state");
  const state = {
    words: [0, 1, 2, 3].map((index) => bytes.readBigUInt64LE(index * 8)),
    drawCount: bytes.readBigUInt64LE(32)
  };
  validateState(state);
  return state;
}

function uniformBelow(state, bound) {
  if (typeof bound !== "bigint" || bound <= 0n || bound >= TWO_128) {
    fail("sampling2-arithmetic");
  }
  const threshold = TWO_128 % bound;
  for (;;) {
    const high = nextU64(state);
    const low = nextU64(state);
    const candidate = (high << 64n) | low;
    if (candidate >= threshold) return candidate % bound;
  }
}

function uniformBelowWords(wordsInput, bound) {
  if (!Array.isArray(wordsInput) || typeof bound !== "bigint" || bound <= 0n ||
      bound >= TWO_128) {
    fail("sampling2-arithmetic");
  }
  const words = wordsInput.map((word) => {
    if (typeof word !== "bigint" || word < 0n || word > MAX_U64) fail("sampling2-arithmetic");
    return word;
  });
  const threshold = TWO_128 % bound;
  let offset = 0;
  for (;;) {
    if (offset + 2 > words.length) fail("sampling2-arithmetic");
    const candidate = (words[offset] << 64n) | words[offset + 1];
    offset += 2;
    if (candidate >= threshold) {
      return Object.freeze({ value: candidate % bound, consumedWords: offset, threshold });
    }
  }
}

function sampleToken(sampling, logitBits, generatedHistory, configInput, stateInput) {
  const prepared = prepareCandidates(sampling, logitBits, generatedHistory, configInput);
  const state = cloneState(stateInput);
  if (prepared.config.temperatureMillionths === 0) {
    return Object.freeze({
      tokenId: prepared.retained[0].tokenId,
      state,
      trace: traceCandidates(prepared)
    });
  }
  const draw = uniformBelow(state, prepared.retainedWeight);
  let cumulative = 0n;
  for (const candidate of prepared.retained) {
    cumulative += candidate.weight;
    if (cumulative > draw) {
      return Object.freeze({ tokenId: candidate.tokenId, state, trace: traceCandidates(prepared) });
    }
  }
  fail("sampling2-arithmetic");
}

function traceCandidates(prepared) {
  const retainedIds = new Set(prepared.retained.map((candidate) => candidate.tokenId));
  return Object.freeze(prepared.candidates.map((candidate) => Object.freeze({
    tokenId: candidate.tokenId,
    scoreQ20: candidate.score.toString(),
    logStep: candidate.step === undefined ? null : candidate.step.toString(),
    weight: candidate.weight === undefined ? null : candidate.weight.toString(),
    retained: retainedIds.has(candidate.tokenId)
  })));
}

function validateStopTokens(stopTokenIds, vocabularySize) {
  if (!Array.isArray(stopTokenIds) || stopTokenIds.length < 1 ||
      stopTokenIds.length > MAXIMUM_STOP_TOKENS) {
    fail("sampling2-stop-token");
  }
  const seen = new Set();
  for (const tokenId of stopTokenIds) {
    if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId >= vocabularySize ||
        seen.has(tokenId)) {
      fail("sampling2-stop-token");
    }
    seen.add(tokenId);
  }
  return Object.freeze([...stopTokenIds]);
}

function createGenerationController(sampling, options) {
  if (!sampling || sampling.profileId !== PROFILE_ID || options === null ||
      typeof options !== "object" || Array.isArray(options)) {
    fail("sampling2-config");
  }
  const expected = ["config", "promptTokenCount", "state", "stopTokenIds", "vocabularySize"];
  const keys = Object.keys(options).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
      !Number.isInteger(options.vocabularySize) || options.vocabularySize < 1 ||
      options.vocabularySize > MAXIMUM_VOCABULARY_SIZE ||
      !Number.isInteger(options.promptTokenCount) || options.promptTokenCount < 0 ||
      options.promptTokenCount > MAXIMUM_CONTEXT_TOKENS) {
    fail("sampling2-config");
  }
  const config = validateConfig(options.config, options.vocabularySize);
  const stopTokenIds = validateStopTokens(options.stopTokenIds, options.vocabularySize);
  const state = cloneState(options.state);
  return {
    sampling,
    config,
    promptTokenCount: options.promptTokenCount,
    vocabularySize: options.vocabularySize,
    stopTokenIds,
    state,
    generated: [],
    status: options.promptTokenCount === MAXIMUM_CONTEXT_TOKENS ? "context-limit" : "active",
    terminalTokenId: null
  };
}

function generationStep(controllerInput, logitBits, cancelled = false) {
  if (!controllerInput || controllerInput.status !== "active") {
    fail("sampling2-generation-terminal");
  }
  if (typeof cancelled !== "boolean") fail("sampling2-config");
  const controller = {
    ...controllerInput,
    state: cloneState(controllerInput.state),
    generated: [...controllerInput.generated]
  };
  if (cancelled) {
    controller.status = "cancelled";
    return controller;
  }
  if (!Array.isArray(logitBits) || logitBits.length !== controller.vocabularySize) {
    fail("sampling2-vocabulary");
  }
  const result = sampleToken(
    controller.sampling,
    logitBits,
    controller.generated,
    controller.config,
    controller.state
  );
  controller.state = result.state;
  if (controller.stopTokenIds.includes(result.tokenId)) {
    controller.status = "stop-token";
    controller.terminalTokenId = result.tokenId;
    return controller;
  }
  controller.generated.push(result.tokenId);
  if (controller.promptTokenCount + controller.generated.length >= MAXIMUM_CONTEXT_TOKENS) {
    controller.status = "context-limit";
  } else if (controller.generated.length >= controller.config.maximumNewTokens) {
    controller.status = "maximum-new-tokens";
  }
  return controller;
}

function applyMutation(original, mutation) {
  const output = Buffer.from(original);
  switch (mutation.operation) {
    case "set-byte":
      output[mutation.offset] = mutation.value;
      return output;
    case "xor-byte":
      output[mutation.offset] ^= mutation.value;
      return output;
    case "replace-hex": {
      const replacement = strictHex(mutation.hex);
      replacement.copy(output, mutation.offset);
      return output;
    }
    case "append-hex":
      return Buffer.concat([output, strictHex(mutation.hex)]);
    default:
      fail("sampling2-vector-mutation");
  }
}

function frozenMutations(artifact) {
  return Object.freeze([
    { id: "magic", operation: "xor-byte", offset: 0, value: 1, expectedError: "sampling2-header" },
    { id: "format-id", operation: "xor-byte", offset: 8, value: 1, expectedError: "sampling2-header" },
    { id: "major", operation: "replace-hex", offset: 28, hex: "0300", expectedError: "sampling2-header" },
    { id: "algorithm", operation: "replace-hex", offset: 36, hex: "0200", expectedError: "sampling2-profile" },
    { id: "flags", operation: "set-byte", offset: 38, value: 1, expectedError: "sampling2-profile" },
    { id: "file-size", operation: "replace-hex", offset: 40, hex: "0001010000000000", expectedError: "sampling2-header" },
    { id: "table-offset", operation: "replace-hex", offset: 48, hex: "4001000000000000", expectedError: "sampling2-layout" },
    { id: "top-k-limit", operation: "replace-hex", offset: 84, hex: "01040000", expectedError: "sampling2-profile" },
    { id: "table-hash-header", operation: "xor-byte", offset: 136, value: 1, expectedError: "sampling2-table-hash" },
    { id: "reserved", operation: "set-byte", offset: 168, value: 1, expectedError: "sampling2-reserved" },
    { id: "table-byte", operation: "xor-byte", offset: HEADER_BYTES + 8192, value: 1, expectedError: "sampling2-table-hash" },
    { id: "trailing-byte", operation: "append-hex", hex: "00", expectedError: "sampling2-artifact-limit" }
  ].map((entry) => Object.freeze(entry)));
}

function config(overrides = {}) {
  return Object.freeze({
    maximumNewTokens: 32,
    repetitionPenaltyMillionths: 1_100_000,
    repetitionWindow: 8,
    temperatureMillionths: 600_000,
    topK: 4,
    topPMillionths: 950_000,
    ...overrides
  });
}

function fixedScoreVectors() {
  const cases = [
    ["positive-zero", 0x0000_0000],
    ["negative-zero", 0x8000_0000],
    ["positive-one", f32Bits(1)],
    ["negative-one", f32Bits(-1)],
    ["positive-half", f32Bits(0.5)],
    ["negative-half", f32Bits(-0.5)],
    ["minimum-subnormal", 0x0000_0001],
    ["q20-half-tie-even-zero", f32Bits(2 ** -21)],
    ["q20-one-and-half-tie-even-two", f32Bits(3 * (2 ** -21))],
    ["maximum-positive", f32Bits(32768)],
    ["maximum-negative", f32Bits(-32768)]
  ];
  return cases.map(([id, bits]) => ({
    id,
    bitsHex: bits.toString(16).padStart(8, "0"),
    expectedQ20: binary32ToQ20(bits).toString()
  }));
}

function prngVectors() {
  return [0n, 1n, MAX_U64].map((seed) => {
    const state = seedState(seed);
    const initialStateHex = serializeState(state).toString("hex");
    const outputs = [];
    for (let index = 0; index < 8; index += 1) outputs.push(nextU64(state).toString());
    return {
      seed: seed.toString(),
      initialStateHex,
      firstEightU64: outputs,
      finalStateHex: serializeState(state).toString("hex")
    };
  });
}

function sampleVectors(sampling) {
  const definitions = [
    {
      id: "greedy-stable-tie-no-state-consumption",
      logits: [1, 1, 0],
      history: [],
      config: config({ temperatureMillionths: 0, topK: 1, topPMillionths: 1_000_000 }),
      seed: 7n
    },
    {
      id: "greedy-positive-repetition-changes-winner",
      logits: [2, 1.9, 0],
      history: [0, 0],
      config: config({
        temperatureMillionths: 0,
        topK: 1,
        topPMillionths: 1_000_000,
        repetitionPenaltyMillionths: 2_000_000
      }),
      seed: 7n
    },
    {
      id: "weighted-four-way",
      logits: [3, 2, 1, 0],
      history: [],
      config: config(),
      seed: 42n
    },
    {
      id: "weighted-resumed-state",
      logits: [0.25, 0.5, 0.75, 1],
      history: [3, 1, 3],
      config: config({ topPMillionths: 700_000, repetitionWindow: 3 }),
      seed: 987654321n,
      warmupDraws: 5
    },
    {
      id: "negative-infinity-mask",
      logitBits: [f32Bits(2), 0xff80_0000, f32Bits(1.5)],
      history: [],
      config: config({ topK: 3 }),
      seed: 123n
    },
    {
      id: "far-gap-zero-weight-suffix",
      logits: [100, 0, -100],
      history: [],
      config: config({ temperatureMillionths: 1, topK: 3, topPMillionths: 1_000_000 }),
      seed: 5n
    },
    {
      id: "negative-repetition-penalty",
      logits: [-1, -1.1, -1.2, -1.3],
      history: [0],
      config: config({ topPMillionths: 500_000 }),
      seed: 555n
    }
  ];
  return definitions.map((definition) => {
    const bits = definition.logitBits || definition.logits.map(f32Bits);
    const state = seedState(definition.seed);
    for (let index = 0; index < (definition.warmupDraws || 0); index += 1) nextU64(state);
    const initialStateHex = serializeState(state).toString("hex");
    const result = sampleToken(sampling, bits, definition.history, definition.config, state);
    return {
      id: definition.id,
      logitBitsHex: bits.map((value) => value.toString(16).padStart(8, "0")),
      generatedHistory: definition.history,
      config: definition.config,
      initialStateHex,
      expectedTokenId: result.tokenId,
      expectedStateHex: serializeState(result.state).toString("hex"),
      expectedTrace: result.trace
    };
  });
}

function generationVectors(sampling) {
  const greedy = config({
    maximumNewTokens: 1,
    temperatureMillionths: 0,
    topK: 1,
    topPMillionths: 1_000_000
  });
  const definitions = [
    { id: "stop-token", vocabularySize: 4, promptTokenCount: 3, stop: [2, 3], logits: [0, 1, 2, 0], cancelled: false },
    { id: "maximum-new-tokens", vocabularySize: 4, promptTokenCount: 3, stop: [3], logits: [0, 2, 1, 0], cancelled: false },
    { id: "context-limit", vocabularySize: 4, promptTokenCount: MAXIMUM_CONTEXT_TOKENS - 1, stop: [3], logits: [0, 2, 1, 0], cancelled: false },
    { id: "cancelled", vocabularySize: 4, promptTokenCount: 3, stop: [3], logits: [0, 2, 1, 0], cancelled: true }
  ];
  const vectors = definitions.map((definition, index) => {
    const controller = createGenerationController(sampling, {
      config: greedy,
      promptTokenCount: definition.promptTokenCount,
      state: seedState(BigInt(index + 1)),
      stopTokenIds: definition.stop,
      vocabularySize: definition.vocabularySize
    });
    const initialStateHex = serializeState(controller.state).toString("hex");
    const after = generationStep(controller, definition.logits.map(f32Bits), definition.cancelled);
    return {
      id: definition.id,
      config: greedy,
      promptTokenCount: definition.promptTokenCount,
      vocabularySize: definition.vocabularySize,
      stopTokenIds: definition.stop,
      logitBitsHex: definition.logits.map((value) => f32Bits(value).toString(16).padStart(8, "0")),
      cancelled: definition.cancelled,
      initialStateHex,
      expectedStatus: after.status,
      expectedGenerated: after.generated,
      expectedTerminalTokenId: after.terminalTokenId,
      expectedStateHex: serializeState(after.state).toString("hex")
    };
  });
  const initialTerminal = createGenerationController(sampling, {
    config: greedy,
    promptTokenCount: MAXIMUM_CONTEXT_TOKENS,
    state: seedState(99n),
    stopTokenIds: [3],
    vocabularySize: 4
  });
  vectors.push({
    id: "initial-context-limit",
    config: greedy,
    promptTokenCount: MAXIMUM_CONTEXT_TOKENS,
    vocabularySize: 4,
    stopTokenIds: [3],
    logitBitsHex: null,
    cancelled: false,
    initialStateHex: serializeState(initialTerminal.state).toString("hex"),
    expectedStatus: initialTerminal.status,
    expectedGenerated: [],
    expectedTerminalTokenId: null,
    expectedStateHex: serializeState(initialTerminal.state).toString("hex")
  });
  return vectors;
}

function rejectionVector() {
  const bound = (1n << 127n) + 1n;
  const scripted = uniformBelowWords([0n, 0n, MAX_U64, MAX_U64], bound);
  const initialStateBytes = Buffer.alloc(40);
  initialStateBytes.writeBigUInt64LE(1n, 24);
  const state = parseState(initialStateBytes);
  const initialStateHex = serializeState(state).toString("hex");
  const stateValue = uniformBelow(state, bound);
  return {
    bound: bound.toString(),
    expectedThreshold: scripted.threshold.toString(),
    scriptedWords: {
      words: [0n, 0n, MAX_U64, MAX_U64].map((word) => word.toString()),
      expectedValue: scripted.value.toString(),
      expectedConsumedWords: scripted.consumedWords
    },
    prngState: {
      initialStateHex,
      expectedValue: stateValue.toString(),
      expectedStateHex: serializeState(state).toString("hex"),
      expectedConsumedWords: Number(state.drawCount)
    }
  };
}

function malformedOperationVectors(sampling) {
  const state = seedState(1n);
  const cases = [
    { id: "nan", expectedError: "sampling2-logit-nan", run: () => sampleToken(sampling, [0x7fc0_0000], [], config({ topK: 1 }), state) },
    { id: "positive-infinity", expectedError: "sampling2-logit-positive-infinity", run: () => sampleToken(sampling, [0x7f80_0000], [], config({ topK: 1 }), state) },
    { id: "all-masked", expectedError: "sampling2-all-masked", run: () => sampleToken(sampling, [0xff80_0000], [], config({ topK: 1 }), state) },
    { id: "logit-over-range", expectedError: "sampling2-logit-range", run: () => sampleToken(sampling, [f32Bits(32769)], [], config({ topK: 1 }), state) },
    { id: "invalid-history", expectedError: "sampling2-history-token", run: () => sampleToken(sampling, [f32Bits(1)], [1], config({ topK: 1 }), state) },
    { id: "greedy-config-inconsistent", expectedError: "sampling2-config", run: () => sampleToken(sampling, [f32Bits(1)], [], config({ temperatureMillionths: 0, topK: 1 }), state) },
    { id: "all-zero-state", expectedError: "sampling2-prng-state", run: () => parseState(Buffer.alloc(40)) },
    { id: "duplicate-stop", expectedError: "sampling2-stop-token", run: () => createGenerationController(sampling, { config: config({ topK: 1 }), promptTokenCount: 1, state, stopTokenIds: [0, 0], vocabularySize: 1 }) }
  ];
  return cases.map((entry) => {
    try {
      entry.run();
      fail("sampling2-vector-malformed");
    } catch (error) {
      if (!(error instanceof Sampling2ReferenceError) || error.code !== entry.expectedError) throw error;
    }
    return { id: entry.id, expectedError: entry.expectedError };
  });
}

function renderVectorDocument() {
  validateProfileIdentity();
  const table = generateWeightTable();
  const artifact = writeSampling2();
  const sampling = parseSampling2(artifact);
  const mutations = frozenMutations(artifact);
  for (const mutation of mutations) {
    try {
      parseSampling2(applyMutation(artifact, mutation));
      fail("sampling2-vector-mutation");
    } catch (error) {
      if (!(error instanceof Sampling2ReferenceError) || error.code !== mutation.expectedError) {
        throw error;
      }
    }
  }
  for (let length = 0; length < artifact.length; length += 1) {
    try {
      parseSampling2(artifact.subarray(0, length));
      fail("sampling2-vector-truncation");
    } catch (error) {
      if (!(error instanceof Sampling2ReferenceError)) throw error;
    }
  }
  const document = {
    schema: "tinyrustlm.vnext.sampling2-format-vectors.v1",
    profileId: PROFILE_ID,
    profileSha256: PROFILE_SHA256,
    independentOracle: {
      implementation: "tinyrustlm/tools/sampling2-reference.js",
      sourceSha256: sha256Hex(fs.readFileSync(__filename)),
      nodeVersion: process.version,
      roles: ["table-generator", "writer", "parser", "fixed-score-converter", "sampler", "generation-controller"]
    },
    normativeTable: {
      path: "contracts/vnext/sampling2-exp-q48-table.v1.bin",
      byteLength: table.length,
      sha256: sha256Hex(table),
      firstWeight: table.readBigUInt64LE(0).toString(),
      lastWeight: table.readBigUInt64LE(table.length - 8).toString()
    },
    artifact: {
      artifactHex: artifact.toString("hex"),
      byteLength: artifact.length,
      sha256: sha256Hex(artifact),
      mutations,
      truncation: {
        operation: "every-prefix-length",
        startInclusive: 0,
        endExclusive: artifact.length,
        expected: "reject"
      }
    },
    fixedScoreCases: fixedScoreVectors(),
    prngCases: prngVectors(),
    u128RejectionCase: rejectionVector(),
    sampleCases: sampleVectors(sampling),
    generationCases: generationVectors(sampling),
    malformedOperationCases: malformedOperationVectors(sampling),
    claimBoundary: "Language-neutral development vectors only; not browser, quality, promotion, deployment, publication, or campaign evidence."
  };
  return Object.freeze({
    table,
    document: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8")
  });
}

function runCli() {
  const [operation, ...extra] = process.argv.slice(2);
  if ((operation !== "--check" && operation !== "--write") || extra.length !== 0) {
    fail("sampling2-vector-arguments");
  }
  const generated = renderVectorDocument();
  if (operation === "--check") {
    if (!fs.readFileSync(tablePath).equals(generated.table) ||
        !fs.readFileSync(vectorPath).equals(generated.document)) {
      fail("sampling2-vector-drift");
    }
    process.stdout.write('{"status":"pass","artifactVectors":1,"sampleCases":7}\n');
  } else {
    fs.writeFileSync(tablePath, generated.table, { flag: "w" });
    fs.writeFileSync(vectorPath, generated.document, { flag: "w" });
    process.stdout.write('{"status":"written","artifactVectors":1,"sampleCases":7}\n');
  }
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error?.code || "sampling2-vector-failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  ARTIFACT_SHA256,
  PROFILE_ID,
  PROFILE_SHA256,
  Sampling2ReferenceError,
  applyMutation,
  binary32ToQ20,
  createGenerationController,
  f32Bits,
  generateWeightTable,
  generationStep,
  nextU64,
  parseSampling2,
  parseState,
  prepareCandidates,
  renderVectorDocument,
  sampleToken,
  seedState,
  serializeState,
  sha256Hex,
  strictHex,
  tablePath,
  uniformBelowWords,
  vectorPath,
  writeSampling2
});
