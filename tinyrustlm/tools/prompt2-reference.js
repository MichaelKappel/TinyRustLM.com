"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  parseTemplate2,
  renderPrompt
} = require("./template2-reference.js");
const {
  encodeText,
  parseTokenizer2
} = require("./tokenizer2-reference.js");
const {
  createGenerationController,
  parseSampling2,
  parseState,
  seedState,
  serializeState
} = require("./sampling2-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/prompt2-format-profile.v1.json");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/prompt2-format-vectors.v1.json");

const PROFILE_ID = "org.minimodel.prompt2/2.0";
const PROFILE_SHA256 = "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c";
const ARTIFACT_MAGIC = Buffer.from("50524d320d0a1a0a", "hex");
const ARTIFACT_FORMAT_ID = Buffer.from("6d696e696d6f64656c2e70726d320000", "hex");
const LOAD_MAGIC = Buffer.from("50324c440d0a1a0a", "hex");
const LOAD_FORMAT_ID = Buffer.from("6d696e696d6f64656c2e70326c640000", "hex");
const REQUEST_MAGIC = Buffer.from("503252510d0a1a0a", "hex");
const REQUEST_FORMAT_ID = Buffer.from("6d696e696d6f64656c2e703272710000", "hex");
const RESULT_MAGIC = Buffer.from("503252530d0a1a0a", "hex");
const RESULT_FORMAT_ID = Buffer.from("6d696e696d6f64656c2e703272730000", "hex");

const ARTIFACT_BYTES = 512;
const WIRE_HEADER_BYTES = 128;
const MESSAGE_RECORD_BYTES = 24;
const INSERTION_RECORD_BYTES = 32;
const SECTION_ALIGNMENT = 64;
const MAXIMUM_MESSAGES = 256;
const MAXIMUM_CONTROL_INSERTIONS = 515;
const MAXIMUM_MESSAGE_CONTENT_BYTES = 262_144;
const MAXIMUM_TOTAL_CONTENT_BYTES = 1_048_576;
const MAXIMUM_RENDERED_BYTES = 1_114_112;
const MAXIMUM_PROMPT_TOKENS = 40_960;
const MODEL_VOCABULARY_SIZE = 151_936;
const MAXIMUM_CONTEXT_TOKENS = 40_960;
const MAXIMUM_NEW_TOKENS = 4_096;
const MAXIMUM_STOP_TOKENS = 16;
const MAXIMUM_LOAD_BUNDLE_BYTES = 16_777_216;
const MAXIMUM_REQUEST_BYTES = 1_054_848;
const MAXIMUM_RESULT_BYTES = 1_310_720;
const TOKENIZER_ARTIFACT_BYTES = 7_038_773;
const TEMPLATE_ARTIFACT_BYTES = 1_403;
const SAMPLING_ARTIFACT_BYTES = 65_800;
const TOKENIZER_TOKEN_COUNT = 151_669;
const NONE_U32 = 0xffff_ffff;
const STOP_TOKEN_IDS = Object.freeze([151_645, 151_643]);

const TOKENIZER_PROFILE_SHA256 = "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de";
const TOKENIZER_ARTIFACT_SHA256 = "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";
const TEMPLATE_PROFILE_SHA256 = "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa";
const TEMPLATE_ARTIFACT_SHA256 = "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8";
const SAMPLING_PROFILE_SHA256 = "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d";
const SAMPLING_ARTIFACT_SHA256 = "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89";
const SAMPLING_TABLE_SHA256 = "fce2345bd4ddc53f137ecc36a48afca02a73ebd3549acce942628e440429c677";
const SOURCE_MODEL_CONFIG_SHA256 = "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd";
const SOURCE_TEMPLATE_SHA256 = "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8";
const SLM2_FORMAT_PROFILE_SHA256 = "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8";
const SLM2_RUNTIME_Q8_VECTOR_SHA256 = "c437ebb5e59c9059c49324d12d43e556493e62f5d6b2e857e369ca08674333a0";
const SUPERSEDED_SLM2_FORMAT_PROFILE_SHA256 =
  "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625";
const SUPERSEDED_SLM2_RUNTIME_VECTOR_SHA256 =
  "c7a0fdaf1dd578928e6a438be308dad5a9e8cc10e2bbb6da4b2c5e10bebe71f1";

const ROLE_IDS = Object.freeze({ system: 1, user: 2, assistant: 3 });
const ID_ROLES = Object.freeze({ 1: "system", 2: "user", 3: "assistant" });
const INSERTION_KIND_IDS = Object.freeze({
  "message-start": 1,
  "message-end": 2,
  "generation-start": 3,
  "thinking-start": 4,
  "thinking-end": 5
});
const ID_INSERTION_KINDS = Object.freeze({
  1: "message-start",
  2: "message-end",
  3: "generation-start",
  4: "thinking-start",
  5: "thinking-end"
});

const CONTROL_LITERALS = Object.freeze({
  151644: Buffer.from("<|im_start|>", "utf8"),
  151645: Buffer.from("<|im_end|>", "utf8"),
  151667: Buffer.from("<think>", "utf8"),
  151668: Buffer.from("</think>", "utf8")
});

class Prompt2ReferenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "Prompt2ReferenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new Prompt2ReferenceError(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function strictHex(value) {
  invariant(typeof value === "string" && value.length % 2 === 0 &&
    /^[0-9a-f]*$/u.test(value), "prompt2-vector-hex");
  return Buffer.from(value, "hex");
}

function hexChunks(bytes, maximumChunkBytes = 32_768) {
  invariant(Buffer.isBuffer(bytes) && Number.isSafeInteger(maximumChunkBytes) &&
    maximumChunkBytes >= 1, "prompt2-vector-hex");
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += maximumChunkBytes) {
    chunks.push(bytes.subarray(offset, offset + maximumChunkBytes).toString("hex"));
  }
  return Object.freeze(chunks);
}

function alignUp(value, alignment = SECTION_ALIGNMENT) {
  invariant(Number.isSafeInteger(value) && value >= 0 &&
    Number.isSafeInteger(alignment) && alignment > 0, "prompt2-arithmetic");
  const remainder = value % alignment;
  const aligned = remainder === 0 ? value : value + alignment - remainder;
  invariant(Number.isSafeInteger(aligned), "prompt2-arithmetic");
  return aligned;
}

function checkedAdd(...values) {
  let total = 0;
  for (const value of values) {
    invariant(Number.isSafeInteger(value) && value >= 0, "prompt2-arithmetic");
    total += value;
    invariant(Number.isSafeInteger(total), "prompt2-arithmetic");
  }
  return total;
}

function putU16(buffer, offset, value) {
  buffer.writeUInt16LE(value, offset);
}

function putU32(buffer, offset, value) {
  buffer.writeUInt32LE(value, offset);
}

function putU64(buffer, offset, value) {
  invariant(Number.isSafeInteger(value) && value >= 0, "prompt2-arithmetic");
  buffer.writeBigUInt64LE(BigInt(value), offset);
}

function getU16(buffer, offset, code) {
  invariant(offset >= 0 && offset + 2 <= buffer.length, code);
  return buffer.readUInt16LE(offset);
}

function getU32(buffer, offset, code) {
  invariant(offset >= 0 && offset + 4 <= buffer.length, code);
  return buffer.readUInt32LE(offset);
}

function getU64(buffer, offset, code) {
  invariant(offset >= 0 && offset + 8 <= buffer.length, code);
  const value = buffer.readBigUInt64LE(offset);
  invariant(value <= BigInt(Number.MAX_SAFE_INTEGER), code);
  return Number(value);
}

function allZero(buffer, start, end) {
  invariant(start >= 0 && end >= start && end <= buffer.length, "prompt2-arithmetic");
  for (let index = start; index < end; index += 1) {
    if (buffer[index] !== 0) return false;
  }
  return true;
}

function putDigest(buffer, offset, digest) {
  strictHex(digest).copy(buffer, offset);
}

function exactDigest(buffer, offset, digest) {
  return buffer.subarray(offset, offset + 32).equals(strictHex(digest));
}

function inputBytes(input, code) {
  invariant(Buffer.isBuffer(input) || input instanceof Uint8Array, code);
  return Buffer.from(input);
}

function dependencyCall(code, callback) {
  try {
    return callback();
  } catch {
    fail(code);
  }
}

function writePrompt2() {
  const artifact = Buffer.alloc(ARTIFACT_BYTES);
  ARTIFACT_MAGIC.copy(artifact, 0);
  ARTIFACT_FORMAT_ID.copy(artifact, 8);
  putU32(artifact, 24, ARTIFACT_BYTES);
  putU16(artifact, 28, 2);
  putU16(artifact, 30, 0);
  putU32(artifact, 32, 0x0102_0304);
  putU32(artifact, 36, 0);
  putU64(artifact, 40, ARTIFACT_BYTES);
  putU64(artifact, 48, TOKENIZER_ARTIFACT_BYTES);
  putU64(artifact, 56, TEMPLATE_ARTIFACT_BYTES);
  putU64(artifact, 64, SAMPLING_ARTIFACT_BYTES);
  putU64(artifact, 72, ARTIFACT_BYTES);
  putU32(artifact, 80, TOKENIZER_TOKEN_COUNT);
  putU32(artifact, 84, MODEL_VOCABULARY_SIZE);
  putU32(artifact, 88, MAXIMUM_MESSAGES);
  putU32(artifact, 92, MAXIMUM_CONTROL_INSERTIONS);
  putU32(artifact, 96, MAXIMUM_MESSAGE_CONTENT_BYTES);
  putU32(artifact, 100, MAXIMUM_TOTAL_CONTENT_BYTES);
  putU32(artifact, 104, MAXIMUM_RENDERED_BYTES);
  putU32(artifact, 108, MAXIMUM_PROMPT_TOKENS);
  putU32(artifact, 112, MAXIMUM_CONTEXT_TOKENS);
  putU32(artifact, 116, MAXIMUM_NEW_TOKENS);
  putU32(artifact, 120, MAXIMUM_STOP_TOKENS);
  putU32(artifact, 124, STOP_TOKEN_IDS.length);
  putU32(artifact, 128, STOP_TOKEN_IDS[0]);
  putU32(artifact, 132, STOP_TOKEN_IDS[1]);
  putU16(artifact, 136, 0);
  putU16(artifact, 138, 0);
  putU16(artifact, 140, 1);
  putU16(artifact, 142, 1);
  putDigest(artifact, 144, TOKENIZER_PROFILE_SHA256);
  putDigest(artifact, 176, TOKENIZER_ARTIFACT_SHA256);
  putDigest(artifact, 208, TEMPLATE_PROFILE_SHA256);
  putDigest(artifact, 240, TEMPLATE_ARTIFACT_SHA256);
  putDigest(artifact, 272, SAMPLING_PROFILE_SHA256);
  putDigest(artifact, 304, SAMPLING_ARTIFACT_SHA256);
  putDigest(artifact, 336, SAMPLING_TABLE_SHA256);
  putDigest(artifact, 368, SOURCE_MODEL_CONFIG_SHA256);
  putDigest(artifact, 400, SOURCE_TEMPLATE_SHA256);
  putDigest(artifact, 432, SLM2_FORMAT_PROFILE_SHA256);
  putDigest(artifact, 464, SLM2_RUNTIME_Q8_VECTOR_SHA256);
  return artifact;
}

const CANONICAL_ARTIFACT = writePrompt2();
const ARTIFACT_SHA256 = sha256Hex(CANONICAL_ARTIFACT);

function parsePrompt2(input, policy = {}) {
  invariant(policy !== null && typeof policy === "object" && !Array.isArray(policy) &&
    Object.keys(policy).every((key) => key === "maximumArtifactBytes"), "prompt2-policy");
  const bytes = inputBytes(input, "prompt2-header");
  const maximumArtifactBytes = policy.maximumArtifactBytes ?? ARTIFACT_BYTES;
  invariant(Number.isSafeInteger(maximumArtifactBytes) && maximumArtifactBytes > 0 &&
    maximumArtifactBytes <= ARTIFACT_BYTES, "prompt2-policy");
  invariant(bytes.length <= maximumArtifactBytes, "prompt2-artifact-limit");
  invariant(bytes.length === ARTIFACT_BYTES &&
    bytes.subarray(0, 8).equals(ARTIFACT_MAGIC) &&
    bytes.subarray(8, 24).equals(ARTIFACT_FORMAT_ID) &&
    getU32(bytes, 24, "prompt2-header") === ARTIFACT_BYTES &&
    getU16(bytes, 28, "prompt2-header") === 2 &&
    getU16(bytes, 30, "prompt2-header") === 0 &&
    getU32(bytes, 32, "prompt2-header") === 0x0102_0304 &&
    getU32(bytes, 36, "prompt2-header") === 0 &&
    getU64(bytes, 40, "prompt2-header") === ARTIFACT_BYTES,
  "prompt2-header");
  invariant(allZero(bytes, 496, 512), "prompt2-reserved");
  invariant(getU64(bytes, 48, "prompt2-header") === TOKENIZER_ARTIFACT_BYTES &&
    getU64(bytes, 56, "prompt2-header") === TEMPLATE_ARTIFACT_BYTES &&
    getU64(bytes, 64, "prompt2-header") === SAMPLING_ARTIFACT_BYTES &&
    getU64(bytes, 72, "prompt2-header") === ARTIFACT_BYTES &&
    getU32(bytes, 80, "prompt2-header") === TOKENIZER_TOKEN_COUNT &&
    getU32(bytes, 84, "prompt2-header") === MODEL_VOCABULARY_SIZE &&
    getU32(bytes, 88, "prompt2-header") === MAXIMUM_MESSAGES &&
    getU32(bytes, 92, "prompt2-header") === MAXIMUM_CONTROL_INSERTIONS &&
    getU32(bytes, 96, "prompt2-header") === MAXIMUM_MESSAGE_CONTENT_BYTES &&
    getU32(bytes, 100, "prompt2-header") === MAXIMUM_TOTAL_CONTENT_BYTES &&
    getU32(bytes, 104, "prompt2-header") === MAXIMUM_RENDERED_BYTES &&
    getU32(bytes, 108, "prompt2-header") === MAXIMUM_PROMPT_TOKENS &&
    getU32(bytes, 112, "prompt2-header") === MAXIMUM_CONTEXT_TOKENS &&
    getU32(bytes, 116, "prompt2-header") === MAXIMUM_NEW_TOKENS &&
    getU32(bytes, 120, "prompt2-header") === MAXIMUM_STOP_TOKENS &&
    getU32(bytes, 124, "prompt2-header") === 2 &&
    getU32(bytes, 128, "prompt2-header") === STOP_TOKEN_IDS[0] &&
    getU32(bytes, 132, "prompt2-header") === STOP_TOKEN_IDS[1] &&
    getU16(bytes, 136, "prompt2-header") === 0 &&
    getU16(bytes, 138, "prompt2-header") === 0 &&
    getU16(bytes, 140, "prompt2-header") === 1 &&
    getU16(bytes, 142, "prompt2-header") === 1,
  "prompt2-header");
  invariant(exactDigest(bytes, 144, TOKENIZER_PROFILE_SHA256) &&
    exactDigest(bytes, 176, TOKENIZER_ARTIFACT_SHA256) &&
    exactDigest(bytes, 208, TEMPLATE_PROFILE_SHA256) &&
    exactDigest(bytes, 240, TEMPLATE_ARTIFACT_SHA256) &&
    exactDigest(bytes, 272, SAMPLING_PROFILE_SHA256) &&
    exactDigest(bytes, 304, SAMPLING_ARTIFACT_SHA256) &&
    exactDigest(bytes, 336, SAMPLING_TABLE_SHA256) &&
    exactDigest(bytes, 368, SOURCE_MODEL_CONFIG_SHA256) &&
    exactDigest(bytes, 400, SOURCE_TEMPLATE_SHA256) &&
    exactDigest(bytes, 432, SLM2_FORMAT_PROFILE_SHA256) &&
    exactDigest(bytes, 464, SLM2_RUNTIME_Q8_VECTOR_SHA256),
  "prompt2-dependency-identity");
  invariant(sha256Hex(bytes) === ARTIFACT_SHA256, "prompt2-identity");
  return Object.freeze({
    bytes,
    identity: Object.freeze({ byteLength: bytes.length, sha256: ARTIFACT_SHA256 }),
    modelVocabularySize: MODEL_VOCABULARY_SIZE,
    maximumContextTokens: MAXIMUM_CONTEXT_TOKENS,
    stopTokenIds: STOP_TOKEN_IDS
  });
}

function writeLoadBundle(parts) {
  invariant(parts !== null && typeof parts === "object" && !Array.isArray(parts) &&
    Object.keys(parts).sort().join(",") === "prompt2,sampling2,template2,tokenizer2",
  "prompt2-load-bundle");
  const prompt = inputBytes(parts.prompt2, "prompt2-load-bundle");
  const tokenizer = inputBytes(parts.tokenizer2, "prompt2-load-bundle");
  const template = inputBytes(parts.template2, "prompt2-load-bundle");
  const sampling = inputBytes(parts.sampling2, "prompt2-load-bundle");
  invariant(prompt.length === ARTIFACT_BYTES && tokenizer.length === TOKENIZER_ARTIFACT_BYTES &&
    template.length === TEMPLATE_ARTIFACT_BYTES && sampling.length === SAMPLING_ARTIFACT_BYTES,
  "prompt2-load-bundle");
  const promptOffset = WIRE_HEADER_BYTES;
  const tokenizerOffset = checkedAdd(promptOffset, prompt.length);
  const templateOffset = checkedAdd(tokenizerOffset, tokenizer.length);
  const samplingOffset = checkedAdd(templateOffset, template.length);
  const fileBytes = checkedAdd(samplingOffset, sampling.length);
  invariant(fileBytes <= MAXIMUM_LOAD_BUNDLE_BYTES, "prompt2-load-bundle");
  const output = Buffer.alloc(fileBytes);
  LOAD_MAGIC.copy(output, 0);
  LOAD_FORMAT_ID.copy(output, 8);
  putU32(output, 24, WIRE_HEADER_BYTES);
  putU16(output, 28, 1);
  putU16(output, 30, 0);
  putU32(output, 32, 0x0102_0304);
  putU32(output, 36, 0);
  putU64(output, 40, fileBytes);
  putU64(output, 48, promptOffset);
  putU64(output, 56, prompt.length);
  putU64(output, 64, tokenizerOffset);
  putU64(output, 72, tokenizer.length);
  putU64(output, 80, templateOffset);
  putU64(output, 88, template.length);
  putU64(output, 96, samplingOffset);
  putU64(output, 104, sampling.length);
  prompt.copy(output, promptOffset);
  tokenizer.copy(output, tokenizerOffset);
  template.copy(output, templateOffset);
  sampling.copy(output, samplingOffset);
  return output;
}

function parseLoadBundle(input, maximumBytes = MAXIMUM_LOAD_BUNDLE_BYTES) {
  const bytes = inputBytes(input, "prompt2-load-bundle");
  invariant(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 &&
    maximumBytes <= MAXIMUM_LOAD_BUNDLE_BYTES, "prompt2-policy");
  invariant(bytes.length >= WIRE_HEADER_BYTES && bytes.length <= maximumBytes &&
    bytes.subarray(0, 8).equals(LOAD_MAGIC) &&
    bytes.subarray(8, 24).equals(LOAD_FORMAT_ID) &&
    getU32(bytes, 24, "prompt2-load-bundle") === WIRE_HEADER_BYTES &&
    getU16(bytes, 28, "prompt2-load-bundle") === 1 &&
    getU16(bytes, 30, "prompt2-load-bundle") === 0 &&
    getU32(bytes, 32, "prompt2-load-bundle") === 0x0102_0304 &&
    getU32(bytes, 36, "prompt2-load-bundle") === 0 &&
    getU64(bytes, 40, "prompt2-load-bundle") === bytes.length &&
    allZero(bytes, 112, 128), "prompt2-load-bundle");
  const entries = [
    ["prompt2", getU64(bytes, 48, "prompt2-load-bundle"),
      getU64(bytes, 56, "prompt2-load-bundle"), ARTIFACT_BYTES],
    ["tokenizer2", getU64(bytes, 64, "prompt2-load-bundle"),
      getU64(bytes, 72, "prompt2-load-bundle"), TOKENIZER_ARTIFACT_BYTES],
    ["template2", getU64(bytes, 80, "prompt2-load-bundle"),
      getU64(bytes, 88, "prompt2-load-bundle"), TEMPLATE_ARTIFACT_BYTES],
    ["sampling2", getU64(bytes, 96, "prompt2-load-bundle"),
      getU64(bytes, 104, "prompt2-load-bundle"), SAMPLING_ARTIFACT_BYTES]
  ];
  let cursor = WIRE_HEADER_BYTES;
  const result = {};
  for (const [name, offset, length, expectedLength] of entries) {
    invariant(offset === cursor && length === expectedLength &&
      checkedAdd(offset, length) <= bytes.length, "prompt2-load-bundle");
    result[name] = bytes.subarray(offset, offset + length);
    cursor = checkedAdd(cursor, length);
  }
  invariant(cursor === bytes.length, "prompt2-load-bundle");
  return Object.freeze(result);
}

function validateConfig(config) {
  invariant(config !== null && typeof config === "object" && !Array.isArray(config) &&
    Object.keys(config).sort().join(",") === [
      "maximumNewTokens", "repetitionPenaltyMillionths", "repetitionWindow",
      "temperatureMillionths", "topK", "topPMillionths"
    ].sort().join(","), "prompt2-sampling");
  const values = Object.values(config);
  invariant(values.every((value) => Number.isSafeInteger(value) && value >= 0) &&
    config.temperatureMillionths <= 4_000_000 &&
    config.topK >= 1 && config.topK <= 1_024 &&
    config.topPMillionths >= 1 && config.topPMillionths <= 1_000_000 &&
    config.repetitionPenaltyMillionths >= 1_000_000 &&
    config.repetitionPenaltyMillionths <= 2_000_000 &&
    config.repetitionWindow <= 64 &&
    config.maximumNewTokens >= 1 && config.maximumNewTokens <= MAXIMUM_NEW_TOKENS &&
    (config.temperatureMillionths !== 0 ||
      (config.topK === 1 && config.topPMillionths === 1_000_000)),
  "prompt2-sampling");
  return Object.freeze({ ...config });
}

function validateMessages(messages) {
  invariant(Array.isArray(messages) && messages.length >= 1 &&
    messages.length <= MAXIMUM_MESSAGES, "prompt2-request-layout");
  let total = 0;
  return Object.freeze(messages.map((message) => {
    invariant(message !== null && typeof message === "object" && !Array.isArray(message) &&
      Object.keys(message).sort().join(",") === "content,role" &&
      Object.hasOwn(ROLE_IDS, message.role) && typeof message.content === "string",
    "prompt2-request-layout");
    const contentBytes = Buffer.from(message.content, "utf8");
    invariant(contentBytes.toString("utf8") === message.content &&
      contentBytes.length <= MAXIMUM_MESSAGE_CONTENT_BYTES,
    "prompt2-request-utf8");
    total = checkedAdd(total, contentBytes.length);
    invariant(total <= MAXIMUM_TOTAL_CONTENT_BYTES, "prompt2-request-limit");
    return Object.freeze({ role: message.role, content: message.content, contentBytes });
  }));
}

function writeRequest(value) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === "config,messages,seed", "prompt2-request-layout");
  const messages = validateMessages(value.messages);
  const config = validateConfig(value.config);
  invariant(typeof value.seed === "bigint" && value.seed >= 0n &&
    value.seed <= 0xffff_ffff_ffff_ffffn, "prompt2-request-layout");
  const messageTableOffset = WIRE_HEADER_BYTES;
  const tableEnd = checkedAdd(messageTableOffset, messages.length * MESSAGE_RECORD_BYTES);
  const contentOffset = alignUp(tableEnd);
  const contentBytes = messages.reduce((sum, message) =>
    checkedAdd(sum, message.contentBytes.length), 0);
  const fileBytes = checkedAdd(contentOffset, contentBytes);
  invariant(fileBytes <= MAXIMUM_REQUEST_BYTES, "prompt2-request-limit");
  const output = Buffer.alloc(fileBytes);
  REQUEST_MAGIC.copy(output, 0);
  REQUEST_FORMAT_ID.copy(output, 8);
  putU32(output, 24, WIRE_HEADER_BYTES);
  putU16(output, 28, 1);
  putU16(output, 30, 0);
  putU32(output, 32, 0x0102_0304);
  putU32(output, 36, 0);
  putU64(output, 40, fileBytes);
  putU64(output, 48, messageTableOffset);
  putU32(output, 56, messages.length);
  putU32(output, 60, MESSAGE_RECORD_BYTES);
  putU64(output, 64, contentOffset);
  putU64(output, 72, contentBytes);
  putU32(output, 80, config.temperatureMillionths);
  putU32(output, 84, config.topK);
  putU32(output, 88, config.topPMillionths);
  putU32(output, 92, config.repetitionPenaltyMillionths);
  putU32(output, 96, config.repetitionWindow);
  putU32(output, 100, config.maximumNewTokens);
  output.writeBigUInt64LE(value.seed, 104);
  let relativeOffset = 0;
  messages.forEach((message, index) => {
    const recordOffset = messageTableOffset + index * MESSAGE_RECORD_BYTES;
    putU16(output, recordOffset, ROLE_IDS[message.role]);
    putU16(output, recordOffset + 2, 0);
    putU32(output, recordOffset + 4, index);
    putU64(output, recordOffset + 8, relativeOffset);
    putU64(output, recordOffset + 16, message.contentBytes.length);
    message.contentBytes.copy(output, contentOffset + relativeOffset);
    relativeOffset = checkedAdd(relativeOffset, message.contentBytes.length);
  });
  return output;
}

function parseRequest(input, maximumBytes = MAXIMUM_REQUEST_BYTES) {
  const bytes = inputBytes(input, "prompt2-request-header");
  invariant(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 &&
    maximumBytes <= MAXIMUM_REQUEST_BYTES, "prompt2-policy");
  invariant(bytes.length >= WIRE_HEADER_BYTES && bytes.length <= maximumBytes,
    "prompt2-request-limit");
  invariant(bytes.subarray(0, 8).equals(REQUEST_MAGIC) &&
    bytes.subarray(8, 24).equals(REQUEST_FORMAT_ID) &&
    getU32(bytes, 24, "prompt2-request-header") === WIRE_HEADER_BYTES &&
    getU16(bytes, 28, "prompt2-request-header") === 1 &&
    getU16(bytes, 30, "prompt2-request-header") === 0 &&
    getU32(bytes, 32, "prompt2-request-header") === 0x0102_0304 &&
    getU32(bytes, 36, "prompt2-request-header") === 0 &&
    getU64(bytes, 40, "prompt2-request-header") === bytes.length &&
    allZero(bytes, 112, 128), "prompt2-request-header");
  const messageTableOffset = getU64(bytes, 48, "prompt2-request-layout");
  const messageCount = getU32(bytes, 56, "prompt2-request-layout");
  const recordBytes = getU32(bytes, 60, "prompt2-request-layout");
  const contentOffset = getU64(bytes, 64, "prompt2-request-layout");
  const contentBytes = getU64(bytes, 72, "prompt2-request-layout");
  invariant(messageTableOffset === WIRE_HEADER_BYTES && messageCount >= 1 &&
    messageCount <= MAXIMUM_MESSAGES && recordBytes === MESSAGE_RECORD_BYTES,
  "prompt2-request-layout");
  const tableEnd = checkedAdd(messageTableOffset, messageCount * recordBytes);
  invariant(contentOffset === alignUp(tableEnd) &&
    allZero(bytes, tableEnd, contentOffset) &&
    checkedAdd(contentOffset, contentBytes) === bytes.length &&
    contentBytes <= MAXIMUM_TOTAL_CONTENT_BYTES, "prompt2-request-layout");
  const messages = [];
  let expectedRelativeOffset = 0;
  for (let index = 0; index < messageCount; index += 1) {
    const recordOffset = messageTableOffset + index * recordBytes;
    const roleId = getU16(bytes, recordOffset, "prompt2-request-layout");
    const flags = getU16(bytes, recordOffset + 2, "prompt2-request-layout");
    const recordIndex = getU32(bytes, recordOffset + 4, "prompt2-request-layout");
    const relativeOffset = getU64(bytes, recordOffset + 8, "prompt2-request-layout");
    const length = getU64(bytes, recordOffset + 16, "prompt2-request-layout");
    invariant(Object.hasOwn(ID_ROLES, roleId) && flags === 0 && recordIndex === index &&
      relativeOffset === expectedRelativeOffset && length <= MAXIMUM_MESSAGE_CONTENT_BYTES &&
      checkedAdd(relativeOffset, length) <= contentBytes, "prompt2-request-layout");
    const content = bytes.subarray(contentOffset + relativeOffset,
      contentOffset + relativeOffset + length);
    const decoded = content.toString("utf8");
    invariant(Buffer.from(decoded, "utf8").equals(content), "prompt2-request-utf8");
    messages.push(Object.freeze({ role: ID_ROLES[roleId], content: decoded }));
    expectedRelativeOffset = checkedAdd(expectedRelativeOffset, length);
  }
  invariant(expectedRelativeOffset === contentBytes, "prompt2-request-layout");
  const config = validateConfig({
    temperatureMillionths: getU32(bytes, 80, "prompt2-request-layout"),
    topK: getU32(bytes, 84, "prompt2-request-layout"),
    topPMillionths: getU32(bytes, 88, "prompt2-request-layout"),
    repetitionPenaltyMillionths: getU32(bytes, 92, "prompt2-request-layout"),
    repetitionWindow: getU32(bytes, 96, "prompt2-request-layout"),
    maximumNewTokens: getU32(bytes, 100, "prompt2-request-layout")
  });
  return Object.freeze({
    messages: Object.freeze(messages),
    config,
    seed: bytes.readBigUInt64LE(104)
  });
}

function expectedInsertion(index, messageCount) {
  if (index < messageCount * 2) {
    const messageIndex = Math.floor(index / 2);
    return index % 2 === 0
      ? Object.freeze({ kind: "message-start", messageIndex, tokenId: 151_644 })
      : Object.freeze({ kind: "message-end", messageIndex, tokenId: 151_645 });
  }
  const trailing = [
    Object.freeze({ kind: "generation-start", messageIndex: null, tokenId: 151_644 }),
    Object.freeze({ kind: "thinking-start", messageIndex: null, tokenId: 151_667 }),
    Object.freeze({ kind: "thinking-end", messageIndex: null, tokenId: 151_668 })
  ];
  return trailing[index - messageCount * 2];
}

function validateInsertionSequence(rendered, tokenIds, insertions) {
  invariant(insertions.length >= 5 && (insertions.length - 3) % 2 === 0,
    "prompt2-result-layout");
  const messageCount = (insertions.length - 3) / 2;
  invariant(messageCount >= 1 && messageCount <= MAXIMUM_MESSAGES,
    "prompt2-result-layout");
  let previousByteOffset = -1;
  let previousTokenIndex = -1;
  const insertionTokenIndexes = new Set();
  for (let index = 0; index < insertions.length; index += 1) {
    const insertion = insertions[index];
    const expected = expectedInsertion(index, messageCount);
    const literal = CONTROL_LITERALS[expected.tokenId];
    invariant(expected !== undefined && insertion.kind === expected.kind &&
      insertion.messageIndex === expected.messageIndex && insertion.tokenId === expected.tokenId &&
      insertion.byteOffset > previousByteOffset && insertion.tokenIndex > previousTokenIndex &&
      rendered.subarray(insertion.byteOffset, insertion.byteOffset + literal.length).equals(literal) &&
      tokenIds[insertion.tokenIndex] === insertion.tokenId &&
      !insertionTokenIndexes.has(insertion.tokenIndex), "prompt2-result-layout");
    previousByteOffset = insertion.byteOffset;
    previousTokenIndex = insertion.tokenIndex;
    insertionTokenIndexes.add(insertion.tokenIndex);
  }
  invariant(insertions[0].byteOffset === 0 && insertions[0].tokenIndex === 0,
    "prompt2-result-layout");
  const controlTokenIds = new Set(Object.keys(CONTROL_LITERALS).map(Number));
  for (let tokenIndex = 0; tokenIndex < tokenIds.length; tokenIndex += 1) {
    if (controlTokenIds.has(tokenIds[tokenIndex])) {
      invariant(insertionTokenIndexes.has(tokenIndex), "prompt2-result-layout");
    }
  }
}

function validateResult(value) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [
      "initialSamplingState", "initialStatus", "insertions", "renderedUtf8",
      "stopTokenIds", "tokenIds"
    ].sort().join(","),
    "prompt2-result-layout");
  invariant(typeof value.renderedUtf8 === "string", "prompt2-result-layout");
  const rendered = Buffer.from(value.renderedUtf8, "utf8");
  invariant(rendered.toString("utf8") === value.renderedUtf8 &&
    rendered.length <= MAXIMUM_RENDERED_BYTES, "prompt2-result-limit");
  invariant(Array.isArray(value.tokenIds) && value.tokenIds.length >= 1 &&
    value.tokenIds.length <= MAXIMUM_PROMPT_TOKENS &&
    value.tokenIds.every((tokenId) => Number.isSafeInteger(tokenId) && tokenId >= 0 &&
      tokenId < TOKENIZER_TOKEN_COUNT), "prompt2-result-layout");
  invariant(Array.isArray(value.insertions) &&
    value.insertions.length <= MAXIMUM_CONTROL_INSERTIONS, "prompt2-result-layout");
  const insertions = value.insertions.map((insertion) => {
    invariant(insertion !== null && typeof insertion === "object" &&
      Object.keys(insertion).sort().join(",") ===
        "byteOffset,kind,messageIndex,tokenId,tokenIndex" &&
      Object.hasOwn(INSERTION_KIND_IDS, insertion.kind) &&
      (insertion.messageIndex === null ||
        Number.isSafeInteger(insertion.messageIndex) && insertion.messageIndex >= 0 &&
        insertion.messageIndex < MAXIMUM_MESSAGES) &&
      Number.isSafeInteger(insertion.tokenId) && insertion.tokenId >= 0 &&
      insertion.tokenId < MODEL_VOCABULARY_SIZE &&
      Number.isSafeInteger(insertion.byteOffset) && insertion.byteOffset >= 0 &&
      insertion.byteOffset < rendered.length &&
      Number.isSafeInteger(insertion.tokenIndex) && insertion.tokenIndex >= 0 &&
      insertion.tokenIndex < value.tokenIds.length,
    "prompt2-result-layout");
    return Object.freeze({ ...insertion });
  });
  invariant(Array.isArray(value.stopTokenIds) &&
    value.stopTokenIds.length === STOP_TOKEN_IDS.length &&
    value.stopTokenIds.every((tokenId, index) => tokenId === STOP_TOKEN_IDS[index]),
  "prompt2-result-layout");
  const state = inputBytes(value.initialSamplingState, "prompt2-result-layout");
  invariant(state.length === 40, "prompt2-result-layout");
  try {
    parseState(state);
  } catch {
    fail("prompt2-result-layout");
  }
  invariant(value.initialStatus === "active" || value.initialStatus === "context-limit",
    "prompt2-result-layout");
  invariant((value.initialStatus === "active" && value.tokenIds.length < MAXIMUM_CONTEXT_TOKENS) ||
    (value.initialStatus === "context-limit" &&
      value.tokenIds.length === MAXIMUM_CONTEXT_TOKENS), "prompt2-result-layout");
  validateInsertionSequence(rendered, value.tokenIds, insertions);
  return Object.freeze({ rendered, tokenIds: [...value.tokenIds], insertions,
    stopTokenIds: [...value.stopTokenIds], state, initialStatus: value.initialStatus });
}

function writeResult(value) {
  const result = validateResult(value);
  const renderedOffset = WIRE_HEADER_BYTES;
  const tokenOffset = alignUp(checkedAdd(renderedOffset, result.rendered.length));
  const insertionOffset = alignUp(checkedAdd(tokenOffset, result.tokenIds.length * 4));
  const stopOffset = alignUp(checkedAdd(insertionOffset,
    result.insertions.length * INSERTION_RECORD_BYTES));
  const stateOffset = alignUp(checkedAdd(stopOffset, result.stopTokenIds.length * 4));
  const fileBytes = checkedAdd(stateOffset, result.state.length);
  invariant(fileBytes <= MAXIMUM_RESULT_BYTES, "prompt2-result-limit");
  const output = Buffer.alloc(fileBytes);
  RESULT_MAGIC.copy(output, 0);
  RESULT_FORMAT_ID.copy(output, 8);
  putU32(output, 24, WIRE_HEADER_BYTES);
  putU16(output, 28, 1);
  putU16(output, 30, 0);
  putU32(output, 32, 0x0102_0304);
  putU32(output, 36, 0);
  putU64(output, 40, fileBytes);
  putU64(output, 48, renderedOffset);
  putU64(output, 56, result.rendered.length);
  putU64(output, 64, tokenOffset);
  putU32(output, 72, result.tokenIds.length);
  putU32(output, 76, 4);
  putU64(output, 80, insertionOffset);
  putU32(output, 88, result.insertions.length);
  putU32(output, 92, INSERTION_RECORD_BYTES);
  putU64(output, 96, stopOffset);
  putU32(output, 104, result.stopTokenIds.length);
  putU32(output, 108, 4);
  putU64(output, 112, stateOffset);
  putU32(output, 120, result.state.length);
  putU16(output, 124, result.initialStatus === "active" ? 1 : 2);
  result.rendered.copy(output, renderedOffset);
  result.tokenIds.forEach((tokenId, index) => putU32(output, tokenOffset + index * 4, tokenId));
  result.insertions.forEach((insertion, index) => {
    const offset = insertionOffset + index * INSERTION_RECORD_BYTES;
    putU16(output, offset, INSERTION_KIND_IDS[insertion.kind]);
    putU16(output, offset + 2, 0);
    putU32(output, offset + 4, insertion.messageIndex === null ? NONE_U32 : insertion.messageIndex);
    putU32(output, offset + 8, insertion.tokenId);
    putU32(output, offset + 12, 0);
    putU64(output, offset + 16, insertion.byteOffset);
    putU64(output, offset + 24, insertion.tokenIndex);
  });
  result.stopTokenIds.forEach((tokenId, index) => putU32(output, stopOffset + index * 4, tokenId));
  result.state.copy(output, stateOffset);
  return output;
}

function parseResult(input, maximumBytes = MAXIMUM_RESULT_BYTES) {
  const bytes = inputBytes(input, "prompt2-result-header");
  invariant(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 &&
    maximumBytes <= MAXIMUM_RESULT_BYTES, "prompt2-policy");
  invariant(bytes.length >= WIRE_HEADER_BYTES && bytes.length <= maximumBytes,
    "prompt2-result-limit");
  invariant(bytes.subarray(0, 8).equals(RESULT_MAGIC) &&
    bytes.subarray(8, 24).equals(RESULT_FORMAT_ID) &&
    getU32(bytes, 24, "prompt2-result-header") === WIRE_HEADER_BYTES &&
    getU16(bytes, 28, "prompt2-result-header") === 1 &&
    getU16(bytes, 30, "prompt2-result-header") === 0 &&
    getU32(bytes, 32, "prompt2-result-header") === 0x0102_0304 &&
    getU32(bytes, 36, "prompt2-result-header") === 0 &&
    getU64(bytes, 40, "prompt2-result-header") === bytes.length &&
    getU16(bytes, 126, "prompt2-result-header") === 0,
  "prompt2-result-header");
  const renderedOffset = getU64(bytes, 48, "prompt2-result-layout");
  const renderedBytes = getU64(bytes, 56, "prompt2-result-layout");
  const tokenOffset = getU64(bytes, 64, "prompt2-result-layout");
  const tokenCount = getU32(bytes, 72, "prompt2-result-layout");
  const tokenRecordBytes = getU32(bytes, 76, "prompt2-result-layout");
  const insertionOffset = getU64(bytes, 80, "prompt2-result-layout");
  const insertionCount = getU32(bytes, 88, "prompt2-result-layout");
  const insertionRecordBytes = getU32(bytes, 92, "prompt2-result-layout");
  const stopOffset = getU64(bytes, 96, "prompt2-result-layout");
  const stopCount = getU32(bytes, 104, "prompt2-result-layout");
  const stopRecordBytes = getU32(bytes, 108, "prompt2-result-layout");
  const stateOffset = getU64(bytes, 112, "prompt2-result-layout");
  const stateBytes = getU32(bytes, 120, "prompt2-result-layout");
  const initialStatusId = getU16(bytes, 124, "prompt2-result-layout");
  const renderedEnd = checkedAdd(renderedOffset, renderedBytes);
  const tokenEnd = checkedAdd(tokenOffset, tokenCount * 4);
  const insertionEnd = checkedAdd(insertionOffset, insertionCount * INSERTION_RECORD_BYTES);
  const stopEnd = checkedAdd(stopOffset, stopCount * 4);
  const stateEnd = checkedAdd(stateOffset, stateBytes);
  invariant(renderedOffset === WIRE_HEADER_BYTES && renderedBytes <= MAXIMUM_RENDERED_BYTES &&
    tokenOffset === alignUp(renderedEnd) && tokenCount <= MAXIMUM_PROMPT_TOKENS &&
    tokenRecordBytes === 4 && insertionOffset === alignUp(tokenEnd) &&
    insertionCount <= MAXIMUM_CONTROL_INSERTIONS &&
    insertionRecordBytes === INSERTION_RECORD_BYTES && stopOffset === alignUp(insertionEnd) &&
    stopCount === STOP_TOKEN_IDS.length && stopRecordBytes === 4 &&
    stateOffset === alignUp(stopEnd) && stateBytes === 40 && stateEnd === bytes.length &&
    (initialStatusId === 1 || initialStatusId === 2) &&
    allZero(bytes, renderedEnd, tokenOffset) && allZero(bytes, tokenEnd, insertionOffset) &&
    allZero(bytes, insertionEnd, stopOffset) && allZero(bytes, stopEnd, stateOffset),
  "prompt2-result-layout");
  const renderedBuffer = bytes.subarray(renderedOffset, renderedEnd);
  const renderedUtf8 = renderedBuffer.toString("utf8");
  invariant(Buffer.from(renderedUtf8, "utf8").equals(renderedBuffer),
    "prompt2-result-layout");
  const tokenIds = [];
  for (let index = 0; index < tokenCount; index += 1) {
    const tokenId = getU32(bytes, tokenOffset + index * 4, "prompt2-result-layout");
    invariant(tokenId < TOKENIZER_TOKEN_COUNT, "prompt2-result-layout");
    tokenIds.push(tokenId);
  }
  const insertions = [];
  for (let index = 0; index < insertionCount; index += 1) {
    const offset = insertionOffset + index * INSERTION_RECORD_BYTES;
    const kindId = getU16(bytes, offset, "prompt2-result-layout");
    const messageIndex = getU32(bytes, offset + 4, "prompt2-result-layout");
    const tokenId = getU32(bytes, offset + 8, "prompt2-result-layout");
    const byteOffset = getU64(bytes, offset + 16, "prompt2-result-layout");
    const tokenIndex = getU64(bytes, offset + 24, "prompt2-result-layout");
    invariant(Object.hasOwn(ID_INSERTION_KINDS, kindId) &&
      getU16(bytes, offset + 2, "prompt2-result-layout") === 0 &&
      getU32(bytes, offset + 12, "prompt2-result-layout") === 0 &&
      (messageIndex === NONE_U32 || messageIndex < MAXIMUM_MESSAGES) &&
      tokenId < MODEL_VOCABULARY_SIZE && byteOffset < renderedBytes &&
      tokenIndex < tokenCount, "prompt2-result-layout");
    insertions.push(Object.freeze({
      kind: ID_INSERTION_KINDS[kindId],
      messageIndex: messageIndex === NONE_U32 ? null : messageIndex,
      tokenId,
      byteOffset,
      tokenIndex
    }));
  }
  const stopTokenIds = [];
  for (let index = 0; index < stopCount; index += 1) {
    const tokenId = getU32(bytes, stopOffset + index * 4, "prompt2-result-layout");
    invariant(tokenId === STOP_TOKEN_IDS[index], "prompt2-result-layout");
    stopTokenIds.push(tokenId);
  }
  const validated = validateResult({
    renderedUtf8,
    tokenIds,
    insertions,
    stopTokenIds,
    initialSamplingState: bytes.subarray(stateOffset, stateEnd),
    initialStatus: initialStatusId === 1 ? "active" : "context-limit"
  });
  return Object.freeze({
    renderedUtf8: validated.rendered.toString("utf8"),
    tokenIds: Object.freeze(validated.tokenIds),
    insertions: Object.freeze(validated.insertions),
    stopTokenIds: Object.freeze(validated.stopTokenIds),
    initialSamplingState: Buffer.from(validated.state),
    initialStatus: validated.initialStatus
  });
}

function validateDependencies(parts) {
  invariant(parts !== null && typeof parts === "object" && !Array.isArray(parts) &&
    Object.keys(parts).sort().join(",") === "prompt2,sampling2,template2,tokenizer2",
  "prompt2-dependency-shape");
  const dependencyBytes = Object.freeze({
    prompt2: inputBytes(parts.prompt2, "prompt2-dependency-shape"),
    tokenizer2: inputBytes(parts.tokenizer2, "prompt2-dependency-shape"),
    template2: inputBytes(parts.template2, "prompt2-dependency-shape"),
    sampling2: inputBytes(parts.sampling2, "prompt2-dependency-shape")
  });
  const prompt2 = parsePrompt2(dependencyBytes.prompt2);
  invariant(dependencyBytes.tokenizer2.length === TOKENIZER_ARTIFACT_BYTES &&
    sha256Hex(dependencyBytes.tokenizer2) === TOKENIZER_ARTIFACT_SHA256 &&
    dependencyBytes.template2.length === TEMPLATE_ARTIFACT_BYTES &&
    sha256Hex(dependencyBytes.template2) === TEMPLATE_ARTIFACT_SHA256 &&
    dependencyBytes.sampling2.length === SAMPLING_ARTIFACT_BYTES &&
    sha256Hex(dependencyBytes.sampling2) === SAMPLING_ARTIFACT_SHA256,
  "prompt2-dependency-identity");
  const tokenizer = dependencyCall("prompt2-tokenizer", () =>
    parseTokenizer2(dependencyBytes.tokenizer2, {
      maximumArtifactBytes: TOKENIZER_ARTIFACT_BYTES
    }));
  const template = dependencyCall("prompt2-template", () =>
    parseTemplate2(dependencyBytes.template2));
  const sampling = dependencyCall("prompt2-sampling", () =>
    parseSampling2(dependencyBytes.sampling2));
  invariant(template.profileId === "org.minimodel.template2/2.0" &&
    sampling.profileId === "org.minimodel.sampling2/2.0", "prompt2-dependency-profile");
  invariant(tokenizer.identity.sha256 === TOKENIZER_ARTIFACT_SHA256 &&
    tokenizer.header.tokenCount === TOKENIZER_TOKEN_COUNT &&
    tokenizer.records.length === TOKENIZER_TOKEN_COUNT &&
    template.header.tokenizerArtifactSha256 === TOKENIZER_ARTIFACT_SHA256 &&
    template.header.sourceTemplateSha256 === SOURCE_TEMPLATE_SHA256 &&
    template.header.sourceModelConfigSha256 === SOURCE_MODEL_CONFIG_SHA256 &&
    template.header.modelVocabularySize === MODEL_VOCABULARY_SIZE &&
    template.header.stopTokenIds.length === STOP_TOKEN_IDS.length &&
    template.header.stopTokenIds.every((tokenId, index) => tokenId === STOP_TOKEN_IDS[index]),
  "prompt2-dependency-shape");
  return Object.freeze({ prompt2, tokenizer, template, sampling });
}

function loadDependencies(input, maximumBytes = MAXIMUM_LOAD_BUNDLE_BYTES) {
  return validateDependencies(parseLoadBundle(input, maximumBytes));
}

function mapControlInsertions(tokenizer, renderedUtf8, wholeTokenIds, insertions) {
  const rendered = Buffer.from(renderedUtf8, "utf8");
  const recomposed = [];
  const mapped = [];
  let cursor = 0;
  let previousByteOffset = -1;
  for (const insertion of insertions) {
    const literal = CONTROL_LITERALS[insertion.tokenId];
    invariant(literal && insertion.byteOffset > previousByteOffset &&
      insertion.byteOffset >= cursor &&
      rendered.subarray(insertion.byteOffset, insertion.byteOffset + literal.length).equals(literal),
    "prompt2-control-layout");
    const span = rendered.subarray(cursor, insertion.byteOffset);
    const spanText = span.toString("utf8");
    invariant(Buffer.from(spanText, "utf8").equals(span), "prompt2-control-layout");
    recomposed.push(...dependencyCall("prompt2-tokenizer", () =>
      encodeText(tokenizer, spanText)));
    const tokenIndex = recomposed.length;
    recomposed.push(insertion.tokenId);
    mapped.push(Object.freeze({ ...insertion, tokenIndex }));
    cursor = insertion.byteOffset + literal.length;
    previousByteOffset = insertion.byteOffset;
  }
  const tail = rendered.subarray(cursor);
  const tailText = tail.toString("utf8");
  invariant(Buffer.from(tailText, "utf8").equals(tail), "prompt2-control-layout");
  recomposed.push(...dependencyCall("prompt2-tokenizer", () =>
    encodeText(tokenizer, tailText)));
  invariant(recomposed.length === wholeTokenIds.length &&
    recomposed.every((tokenId, index) => tokenId === wholeTokenIds[index]) &&
    mapped.every((insertion) => wholeTokenIds[insertion.tokenIndex] === insertion.tokenId),
  "prompt2-control-tokenization");
  return Object.freeze(mapped);
}

function compilePrompt2(dependencies, requestValue) {
  invariant(dependencies !== null && typeof dependencies === "object" &&
    Object.keys(dependencies).sort().join(",") === "prompt2,sampling,template,tokenizer" &&
    dependencies.prompt2?.identity?.sha256 === ARTIFACT_SHA256 &&
    dependencies.tokenizer?.identity?.sha256 === TOKENIZER_ARTIFACT_SHA256 &&
    dependencies.template?.identity?.sha256 === TEMPLATE_ARTIFACT_SHA256 &&
    dependencies.sampling?.identity?.sha256 === SAMPLING_ARTIFACT_SHA256,
  "prompt2-dependency-shape");
  const request = Buffer.isBuffer(requestValue) || requestValue instanceof Uint8Array
    ? parseRequest(requestValue)
    : parseRequest(writeRequest(requestValue));
  const rendered = dependencyCall("prompt2-template", () =>
    renderPrompt(dependencies.template, request.messages));
  invariant(rendered.bytes.length <= MAXIMUM_RENDERED_BYTES &&
    rendered.bosInserted === false && rendered.eosInserted === false,
  "prompt2-template");
  const renderedUtf8 = rendered.bytes.toString("utf8");
  invariant(Buffer.from(renderedUtf8, "utf8").equals(rendered.bytes), "prompt2-template");
  const tokenIds = dependencyCall("prompt2-tokenizer", () =>
    encodeText(dependencies.tokenizer, renderedUtf8));
  invariant(tokenIds.length <= MAXIMUM_PROMPT_TOKENS &&
    tokenIds.every((tokenId) => tokenId < TOKENIZER_TOKEN_COUNT), "prompt2-prompt-limit");
  const mapped = mapControlInsertions(
    dependencies.tokenizer,
    renderedUtf8,
    tokenIds,
    rendered.insertions
  );
  const state = dependencyCall("prompt2-sampling", () => seedState(request.seed));
  const controller = dependencyCall("prompt2-sampling", () =>
    createGenerationController(dependencies.sampling, {
      config: request.config,
      promptTokenCount: tokenIds.length,
      vocabularySize: MODEL_VOCABULARY_SIZE,
      stopTokenIds: STOP_TOKEN_IDS,
      state
    }));
  return Object.freeze({
    renderedUtf8,
    tokenIds: Object.freeze(tokenIds),
    insertions: mapped,
    stopTokenIds: STOP_TOKEN_IDS,
    initialSamplingState: serializeState(state),
    initialStatus: controller.status
  });
}

function applyMutation(input, mutation) {
  let bytes = Buffer.from(input);
  if (mutation.kind === "truncate") {
    return bytes.subarray(0, mutation.length);
  }
  if (mutation.kind === "append") {
    return Buffer.concat([bytes, strictHex(mutation.hex)]);
  }
  bytes = Buffer.from(bytes);
  if (mutation.kind === "xor") {
    bytes[mutation.offset] ^= mutation.mask;
    return bytes;
  }
  if (mutation.kind === "set-u16") {
    putU16(bytes, mutation.offset, mutation.value);
    return bytes;
  }
  if (mutation.kind === "set-u32") {
    putU32(bytes, mutation.offset, mutation.value);
    return bytes;
  }
  if (mutation.kind === "set-u64") {
    putU64(bytes, mutation.offset, mutation.value);
    return bytes;
  }
  if (mutation.kind === "fill") {
    invariant(Number.isSafeInteger(mutation.offset) && mutation.offset >= 0 &&
      Number.isSafeInteger(mutation.length) && mutation.length >= 0 &&
      mutation.offset + mutation.length <= bytes.length &&
      Number.isSafeInteger(mutation.value) && mutation.value >= 0 && mutation.value <= 255,
    "prompt2-vector-mutation");
    bytes.fill(mutation.value, mutation.offset, mutation.offset + mutation.length);
    return bytes;
  }
  if (mutation.kind === "set-hex") {
    const replacement = strictHex(mutation.hex);
    invariant(Number.isSafeInteger(mutation.offset) && mutation.offset >= 0 &&
      replacement.length > 0 && mutation.offset + replacement.length <= bytes.length,
    "prompt2-vector-mutation");
    replacement.copy(bytes, mutation.offset);
    return bytes;
  }
  fail("prompt2-vector-mutation");
}

function mutationVerdict(parser, bytes, mutation) {
  try {
    parser(applyMutation(bytes, mutation));
  } catch (error) {
    invariant(error instanceof Prompt2ReferenceError, "prompt2-vector-mutation");
    return error.code;
  }
  fail("prompt2-vector-mutation-not-rejected");
}

function sourceSha256() {
  return sha256Hex(fs.readFileSync(__filename));
}

function loadHeaderVector() {
  const promptOffset = WIRE_HEADER_BYTES;
  const tokenizerOffset = promptOffset + ARTIFACT_BYTES;
  const templateOffset = tokenizerOffset + TOKENIZER_ARTIFACT_BYTES;
  const samplingOffset = templateOffset + TEMPLATE_ARTIFACT_BYTES;
  const fileBytes = samplingOffset + SAMPLING_ARTIFACT_BYTES;
  const header = Buffer.alloc(WIRE_HEADER_BYTES);
  LOAD_MAGIC.copy(header, 0);
  LOAD_FORMAT_ID.copy(header, 8);
  putU32(header, 24, WIRE_HEADER_BYTES);
  putU16(header, 28, 1);
  putU16(header, 30, 0);
  putU32(header, 32, 0x0102_0304);
  putU64(header, 40, fileBytes);
  putU64(header, 48, promptOffset);
  putU64(header, 56, ARTIFACT_BYTES);
  putU64(header, 64, tokenizerOffset);
  putU64(header, 72, TOKENIZER_ARTIFACT_BYTES);
  putU64(header, 80, templateOffset);
  putU64(header, 88, TEMPLATE_ARTIFACT_BYTES);
  putU64(header, 96, samplingOffset);
  putU64(header, 104, SAMPLING_ARTIFACT_BYTES);
  return Object.freeze({
    byteLength: fileBytes,
    headerHex: header.toString("hex"),
    headerSha256: sha256Hex(header),
    offsets: Object.freeze({ promptOffset, tokenizerOffset, templateOffset, samplingOffset })
  });
}

function requestCases() {
  const cases = [
    {
      id: "single-user-greedy",
      messages: [{ role: "user", content: "Explain one careful next step." }],
      config: {
        temperatureMillionths: 0,
        topK: 1,
        topPMillionths: 1_000_000,
        repetitionPenaltyMillionths: 1_100_000,
        repetitionWindow: 64,
        maximumNewTokens: 256
      },
      seed: 0n
    },
    {
      id: "system-user-sampled",
      messages: [
        { role: "system", content: "Answer directly and preserve uncertainty." },
        { role: "user", content: "Compare the two stated options." }
      ],
      config: {
        temperatureMillionths: 700_000,
        topK: 40,
        topPMillionths: 900_000,
        repetitionPenaltyMillionths: 1_100_000,
        repetitionWindow: 64,
        maximumNewTokens: 512
      },
      seed: 0xffff_ffff_ffff_ffffn
    },
    {
      id: "five-turn-empty-content",
      messages: [
        { role: "user", content: "First" },
        { role: "assistant", content: "Second" },
        { role: "user", content: "" },
        { role: "assistant", content: "Fourth" },
        { role: "user", content: "Fifth\nline" }
      ],
      config: {
        temperatureMillionths: 250_000,
        topK: 20,
        topPMillionths: 700_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 0,
        maximumNewTokens: 1
      },
      seed: 4_294_967_296n
    }
  ];
  return cases.map((entry) => {
    const bytes = writeRequest({
      messages: entry.messages,
      config: entry.config,
      seed: entry.seed
    });
    const parsed = parseRequest(bytes);
    return Object.freeze({
      id: entry.id,
      byteLength: bytes.length,
      sha256: sha256Hex(bytes),
      requestHex: bytes.toString("hex"),
      parsed: Object.freeze({
        messages: parsed.messages,
        config: parsed.config,
        seed: parsed.seed.toString(10)
      })
    });
  });
}

function syntheticResultCases() {
  const rendered = "<|im_start|>user\nHi<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n";
  const activeTokenIds = [
    151644, 872, 13048, 151645, 198, 151644, 77091, 198, 151667, 271, 151668, 271
  ];
  const insertions = [
    { kind: "message-start", messageIndex: 0, tokenId: 151644, byteOffset: 0, tokenIndex: 0 },
    { kind: "message-end", messageIndex: 0, tokenId: 151645, byteOffset: 19, tokenIndex: 3 },
    { kind: "generation-start", messageIndex: null, tokenId: 151644, byteOffset: 30, tokenIndex: 5 },
    { kind: "thinking-start", messageIndex: null, tokenId: 151667, byteOffset: 52, tokenIndex: 8 },
    { kind: "thinking-end", messageIndex: null, tokenId: 151668, byteOffset: 61, tokenIndex: 10 }
  ];
  const values = [
    {
      id: "synthetic-active",
      renderedUtf8: rendered,
      tokenIds: activeTokenIds,
      insertions,
      stopTokenIds: STOP_TOKEN_IDS,
      initialSamplingState: serializeState(seedState(7n)),
      initialStatus: "active"
    },
    {
      id: "synthetic-structural-context-limit",
      renderedUtf8: rendered,
      tokenIds: activeTokenIds.concat(
        new Array(MAXIMUM_CONTEXT_TOKENS - activeTokenIds.length).fill(87)),
      insertions,
      stopTokenIds: STOP_TOKEN_IDS,
      initialSamplingState: serializeState(seedState(9n)),
      initialStatus: "context-limit"
    }
  ];
  return values.map((value) => {
    const bytes = writeResult({
      renderedUtf8: value.renderedUtf8,
      tokenIds: value.tokenIds,
      insertions: value.insertions,
      stopTokenIds: value.stopTokenIds,
      initialSamplingState: value.initialSamplingState,
      initialStatus: value.initialStatus
    });
    const parsed = parseResult(bytes);
    const tokenBytes = Buffer.alloc(parsed.tokenIds.length * 4);
    parsed.tokenIds.forEach((tokenId, index) => putU32(tokenBytes, index * 4, tokenId));
    return Object.freeze({
      id: value.id,
      byteLength: bytes.length,
      sha256: sha256Hex(bytes),
      resultHexChunks: hexChunks(bytes),
      parsed: Object.freeze({
        renderedUtf8: parsed.renderedUtf8,
        tokenCount: parsed.tokenIds.length,
        tokenIdsU32LeSha256: sha256Hex(tokenBytes),
        tokenIdsHead: Object.freeze(parsed.tokenIds.slice(0, 16)),
        tokenIdsTail: Object.freeze(parsed.tokenIds.slice(-16)),
        insertions: parsed.insertions,
        stopTokenIds: parsed.stopTokenIds,
        initialSamplingStateHex: parsed.initialSamplingState.toString("hex"),
        initialStatus: parsed.initialStatus
      })
    });
  });
}

function renderVectorDocument() {
  const profile = fs.readFileSync(profilePath);
  invariant(sha256Hex(profile) === PROFILE_SHA256, "prompt2-profile-drift");
  const artifactMutations = [
    { id: "bad-magic", kind: "xor", offset: 0, mask: 1 },
    { id: "bad-format-id", kind: "xor", offset: 8, mask: 1 },
    { id: "bad-header-bytes", kind: "set-u32", offset: 24, value: 256 },
    { id: "bad-major", kind: "set-u16", offset: 28, value: 3 },
    { id: "bad-byte-order", kind: "set-u32", offset: 32, value: 0x0403_0201 },
    { id: "bad-flags", kind: "set-u32", offset: 36, value: 1 },
    { id: "bad-file-size", kind: "set-u64", offset: 40, value: 511 },
    { id: "bad-vocabulary", kind: "set-u32", offset: 84, value: 151_935 },
    { id: "bad-stop-order", kind: "set-u32", offset: 128, value: 151_643 },
    { id: "bad-tokenizer-hash", kind: "xor", offset: 176, mask: 1 },
    { id: "superseded-slm2-format-profile", kind: "set-hex", offset: 432,
      hex: SUPERSEDED_SLM2_FORMAT_PROFILE_SHA256 },
    { id: "superseded-slm2-runtime-vector", kind: "set-hex", offset: 464,
      hex: SUPERSEDED_SLM2_RUNTIME_VECTOR_SHA256 },
    { id: "bad-reserved", kind: "xor", offset: 496, mask: 1 },
    { id: "truncated", kind: "truncate", length: 511 },
    { id: "trailing", kind: "append", hex: "00" }
  ].map((mutation) => Object.freeze({
    ...mutation,
    expectedError: mutationVerdict(parsePrompt2, CANONICAL_ARTIFACT, mutation)
  }));
  const requests = requestCases();
  const requestBase = strictHex(requests[0].requestHex);
  const requestMutations = [
    { id: "request-bad-magic", kind: "xor", offset: 0, mask: 1 },
    { id: "request-bad-size", kind: "set-u64", offset: 40, value: requestBase.length - 1 },
    { id: "request-zero-count", kind: "set-u32", offset: 56, value: 0 },
    { id: "request-bad-record-size", kind: "set-u32", offset: 60, value: 16 },
    { id: "request-bad-content-offset", kind: "set-u64", offset: 64, value: 129 },
    { id: "request-bad-config", kind: "set-u32", offset: 84, value: 0 },
    { id: "request-reserved", kind: "xor", offset: 112, mask: 1 },
    { id: "request-truncated", kind: "truncate", length: requestBase.length - 1 },
    { id: "request-trailing", kind: "append", hex: "00" }
  ].map((mutation) => Object.freeze({
    ...mutation,
    expectedError: mutationVerdict(parseRequest, requestBase, mutation)
  }));
  const results = syntheticResultCases();
  const resultBase = strictHex(results[0].resultHexChunks.join(""));
  const resultTokenOffset = getU64(resultBase, 64, "prompt2-vector-mutation");
  const resultInsertionOffset = getU64(resultBase, 80, "prompt2-vector-mutation");
  const resultStateOffset = getU64(resultBase, 112, "prompt2-vector-mutation");
  const resultMutations = [
    { id: "result-bad-magic", kind: "xor", offset: 0, mask: 1 },
    { id: "result-bad-size", kind: "set-u64", offset: 40, value: resultBase.length - 1 },
    { id: "result-bad-token-record", kind: "set-u32", offset: 76, value: 8 },
    { id: "result-bad-insertion-record", kind: "set-u32", offset: 92, value: 24 },
    { id: "result-bad-stop-count", kind: "set-u32", offset: 104, value: 1 },
    { id: "result-bad-state-size", kind: "set-u32", offset: 120, value: 39 },
    { id: "result-bad-status", kind: "set-u16", offset: 124, value: 3 },
    { id: "result-status-count-mismatch", kind: "set-u16", offset: 124, value: 2 },
    { id: "result-reserved", kind: "set-u16", offset: 126, value: 1 },
    { id: "result-token-outside-tokenizer", kind: "set-u32",
      offset: resultTokenOffset + 4, value: TOKENIZER_TOKEN_COUNT },
    { id: "result-unmapped-control-token", kind: "set-u32",
      offset: resultTokenOffset + 4, value: 151_644 },
    { id: "result-bad-insertion-kind", kind: "set-u16",
      offset: resultInsertionOffset, value: 2 },
    { id: "result-bad-insertion-token", kind: "set-u32",
      offset: resultInsertionOffset + 8, value: 151_645 },
    { id: "result-bad-insertion-byte-offset", kind: "set-u64",
      offset: resultInsertionOffset + 16, value: 1 },
    { id: "result-bad-insertion-token-index", kind: "set-u64",
      offset: resultInsertionOffset + 24, value: 1 },
    { id: "result-zero-prng-words", kind: "fill",
      offset: resultStateOffset, length: 32, value: 0 },
    { id: "result-truncated", kind: "truncate", length: resultBase.length - 1 },
    { id: "result-trailing", kind: "append", hex: "00" }
  ].map((mutation) => Object.freeze({
    ...mutation,
    expectedError: mutationVerdict(parseResult, resultBase, mutation)
  }));
  const document = {
    schema: "tinyrustlm.vnext.prompt2-format-vectors.v1",
    profileId: PROFILE_ID,
    profileSha256: PROFILE_SHA256,
    generator: {
      implementation: "tinyrustlm/tools/prompt2-reference.js",
      sourceSha256: sourceSha256(),
      ownership: "independent-node-core-artifact-wire-and-composition-authority"
    },
    artifact: {
      byteLength: CANONICAL_ARTIFACT.length,
      sha256: ARTIFACT_SHA256,
      artifactHex: CANONICAL_ARTIFACT.toString("hex"),
      properPrefixCount: CANONICAL_ARTIFACT.length,
      mutations: artifactMutations
    },
    loadBundle: loadHeaderVector(),
    requestCases: requests,
    requestMutations,
    resultCases: results,
    resultMutations,
    claimBoundary: "format-and-wire-vectors-only-no-full-tokenizer-composition-output"
  };
  return Object.freeze({
    value: document,
    bytes: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8")
  });
}

function runCli() {
  const mode = process.argv[2];
  invariant(mode === "--write" || mode === "--check", "prompt2-vector-usage");
  const rendered = renderVectorDocument();
  if (mode === "--write") {
    fs.writeFileSync(vectorPath, rendered.bytes, { flag: "wx" });
  } else {
    invariant(fs.readFileSync(vectorPath).equals(rendered.bytes), "prompt2-vector-drift");
  }
  process.stdout.write(`${JSON.stringify({
    status: "pass",
    artifactSha256: ARTIFACT_SHA256,
    requestCases: rendered.value.requestCases.length,
    resultCases: rendered.value.resultCases.length
  })}\n`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error?.code || "prompt2-vector-failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  ARTIFACT_SHA256,
  PROFILE_ID,
  PROFILE_SHA256,
  Prompt2ReferenceError,
  applyMutation,
  compilePrompt2,
  loadDependencies,
  parseLoadBundle,
  parsePrompt2,
  parseRequest,
  parseResult,
  renderVectorDocument,
  sha256Hex,
  strictHex,
  validateDependencies,
  vectorPath,
  writeLoadBundle,
  writePrompt2,
  writeRequest,
  writeResult
});
