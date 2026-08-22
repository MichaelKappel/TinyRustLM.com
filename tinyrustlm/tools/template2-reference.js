"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const HEADER_BYTES = 256;
const SECTION_ALIGNMENT = 64;
const LITERAL_RECORD_BYTES = 24;
const LITERAL_COUNT = 31;
const NONE_TOKEN_ID = 0xffff_ffff;
const DEFAULT_MAXIMUM_ARTIFACT_BYTES = 1024 * 1024;
const MAXIMUM_MESSAGES = 256;
const MAXIMUM_MESSAGE_CONTENT_BYTES = 256 * 1024;
const MAXIMUM_TOTAL_CONTENT_BYTES = 1024 * 1024;
const MAXIMUM_RENDERED_BYTES = 1088 * 1024;
const MAXIMUM_PROMPT_TOKENS = 40_960;
const PROFILE_ID = "org.minimodel.template2/2.0";
const PROFILE_SHA256 = "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa";
const TOKENIZER_SHA256 = "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";
const SOURCE_TEMPLATE_SHA256 = "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8";
const SOURCE_MODEL_CONFIG_SHA256 = "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd";
const TOKENIZER_ARTIFACT_BYTES = 7_038_773;
const TOKENIZER_TOKEN_COUNT = 151_669;
const MODEL_VOCABULARY_SIZE = 151_936;
const MESSAGE_START_TOKEN_ID = 151_644;
const MESSAGE_END_TOKEN_ID = 151_645;
const THINKING_START_TOKEN_ID = 151_667;
const THINKING_END_TOKEN_ID = 151_668;
const MAGIC = Buffer.from([0x54, 0x50, 0x4c, 0x32, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMAT_ID = Buffer.from("minimodel.tpl2\0\0", "ascii");
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/template2-format-profile.v1.json");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/template2-format-vectors.v1.json");

const FLAG_RENDERER_EMITTED = 1;
const FLAG_FORBIDDEN_CONTENT = 2;
const FLAG_ADDED_TOKEN = 4;
const FLAG_SPECIAL_TOKEN = 8;
const KNOWN_LITERAL_FLAGS = 15;

class Template2ReferenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "Template2ReferenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new Template2ReferenceError(code);
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertInvariant(condition, code) {
  if (!condition) fail(code);
}

function literal(kind, text, flags, tokenId = NONE_TOKEN_ID) {
  return Object.freeze({
    kind,
    bytes: Buffer.from(text, "utf8"),
    flags,
    tokenId
  });
}

const canonicalLiterals = Object.freeze([
  literal(1, "<|im_start|>", 15, MESSAGE_START_TOKEN_ID),
  literal(2, "<|im_end|>", 15, MESSAGE_END_TOKEN_ID),
  literal(3, "system", 1),
  literal(4, "user", 1),
  literal(5, "assistant", 1),
  literal(6, "\n", 1),
  literal(7, "<think>\n\n</think>\n\n", 1),
  literal(8, "<|endoftext|>", 14, 151_643),
  literal(8, "<|object_ref_start|>", 14, 151_646),
  literal(8, "<|object_ref_end|>", 14, 151_647),
  literal(8, "<|box_start|>", 14, 151_648),
  literal(8, "<|box_end|>", 14, 151_649),
  literal(8, "<|quad_start|>", 14, 151_650),
  literal(8, "<|quad_end|>", 14, 151_651),
  literal(8, "<|vision_start|>", 14, 151_652),
  literal(8, "<|vision_end|>", 14, 151_653),
  literal(8, "<|vision_pad|>", 14, 151_654),
  literal(8, "<|image_pad|>", 14, 151_655),
  literal(8, "<|video_pad|>", 14, 151_656),
  literal(8, "<tool_call>", 6, 151_657),
  literal(8, "</tool_call>", 6, 151_658),
  literal(8, "<|fim_prefix|>", 6, 151_659),
  literal(8, "<|fim_middle|>", 6, 151_660),
  literal(8, "<|fim_suffix|>", 6, 151_661),
  literal(8, "<|fim_pad|>", 6, 151_662),
  literal(8, "<|repo_name|>", 6, 151_663),
  literal(8, "<|file_sep|>", 6, 151_664),
  literal(8, "<tool_response>", 6, 151_665),
  literal(8, "</tool_response>", 6, 151_666),
  literal(8, "<think>", 6, THINKING_START_TOKEN_ID),
  literal(8, "</think>", 6, THINKING_END_TOKEN_ID)
]);

const DEFAULT_POLICY = Object.freeze({
  maximumArtifactBytes: DEFAULT_MAXIMUM_ARTIFACT_BYTES,
  maximumMessages: MAXIMUM_MESSAGES,
  maximumMessageContentBytes: MAXIMUM_MESSAGE_CONTENT_BYTES,
  maximumTotalContentBytes: MAXIMUM_TOTAL_CONTENT_BYTES,
  maximumRenderedBytes: MAXIMUM_RENDERED_BYTES,
  maximumPromptTokens: MAXIMUM_PROMPT_TOKENS
});

function alignUp(value, alignment) {
  const result = Math.ceil(value / alignment) * alignment;
  if (!Number.isSafeInteger(result)) fail("template2-layout");
  return result;
}

function readU16(bytes, offset) {
  if (offset + 2 > bytes.length) fail("template2-header");
  return bytes.readUInt16LE(offset);
}

function readU32(bytes, offset) {
  if (offset + 4 > bytes.length) fail("template2-header");
  return bytes.readUInt32LE(offset);
}

function readU64(bytes, offset) {
  if (offset + 8 > bytes.length) fail("template2-header");
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("template2-layout");
  return Number(value);
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

function allZero(bytes, start, end) {
  for (let index = start; index < end; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  return true;
}

function strictHex(value) {
  if (typeof value !== "string" || value.length % 2 !== 0 ||
      !/^(?:[0-9a-f]{2})*$/u.test(value)) {
    fail("template2-vector-hex");
  }
  return Buffer.from(value, "hex");
}

function validateProfileIdentity() {
  const bytes = fs.readFileSync(profilePath);
  if (sha256Hex(bytes) !== PROFILE_SHA256) fail("template2-profile-drift");
  const profile = JSON.parse(bytes.toString("utf8"));
  if (profile.profileId !== PROFILE_ID) fail("template2-profile-drift");
}

function expectedLayout() {
  const literalTableOffset = HEADER_BYTES;
  const literalTableEnd = literalTableOffset + LITERAL_COUNT * LITERAL_RECORD_BYTES;
  const byteTableOffset = alignUp(literalTableEnd, SECTION_ALIGNMENT);
  const byteTableLength = canonicalLiterals.reduce(
    (total, entry) => total + entry.bytes.length, 0);
  const fileSize = byteTableOffset + byteTableLength;
  return Object.freeze({
    literalTableOffset,
    literalTableEnd,
    byteTableOffset,
    byteTableLength,
    fileSize
  });
}

function verifyHeader(bytes, policy) {
  const layout = expectedLayout();
  if (bytes.length < HEADER_BYTES || bytes.length > policy.maximumArtifactBytes ||
      !bytes.subarray(0, 8).equals(MAGIC) ||
      !bytes.subarray(8, 24).equals(FORMAT_ID) ||
      readU32(bytes, 24) !== HEADER_BYTES || readU16(bytes, 28) !== 2 ||
      readU16(bytes, 30) !== 0 || readU32(bytes, 32) !== 0x0102_0304) {
    fail("template2-header");
  }
  if (readU16(bytes, 36) !== 1 || readU16(bytes, 38) !== 0 ||
      !allZero(bytes, 246, 256)) {
    fail("template2-profile");
  }
  if (readU64(bytes, 40) !== bytes.length || bytes.length !== layout.fileSize) {
    fail("template2-header");
  }
  if (readU64(bytes, 48) !== layout.literalTableOffset ||
      readU32(bytes, 56) !== LITERAL_COUNT ||
      readU32(bytes, 60) !== LITERAL_RECORD_BYTES ||
      readU64(bytes, 64) !== layout.byteTableOffset ||
      readU64(bytes, 72) !== layout.byteTableLength) {
    fail("template2-layout");
  }
  if (bytes.subarray(80, 112).toString("hex") !== TOKENIZER_SHA256 ||
      bytes.subarray(112, 144).toString("hex") !== SOURCE_TEMPLATE_SHA256 ||
      bytes.subarray(144, 176).toString("hex") !== SOURCE_MODEL_CONFIG_SHA256) {
    fail("template2-source-binding");
  }
  const exactFields = [
    [176, 4_168],
    [188, TOKENIZER_TOKEN_COUNT],
    [192, MODEL_VOCABULARY_SIZE],
    [196, MESSAGE_START_TOKEN_ID],
    [200, MESSAGE_END_TOKEN_ID],
    [204, MESSAGE_END_TOKEN_ID],
    [208, 151_643],
    [212, MAXIMUM_MESSAGES],
    [216, MAXIMUM_MESSAGE_CONTENT_BYTES],
    [220, MAXIMUM_TOTAL_CONTENT_BYTES],
    [224, MAXIMUM_RENDERED_BYTES],
    [228, MAXIMUM_PROMPT_TOKENS]
  ];
  if (readU64(bytes, 180) !== TOKENIZER_ARTIFACT_BYTES ||
      exactFields.some(([offset, value]) => readU32(bytes, offset) !== value)) {
    fail("template2-token-binding");
  }
  if (readU16(bytes, 232) !== 0 || readU16(bytes, 234) !== 3 ||
      readU16(bytes, 236) !== 1 || readU16(bytes, 238) !== 1 ||
      readU16(bytes, 240) !== 1 || readU16(bytes, 242) !== 0 ||
      readU16(bytes, 244) !== 1) {
    fail("template2-profile");
  }
  return layout;
}

function validatePolicy(policy) {
  if (policy === null || typeof policy !== "object" || Array.isArray(policy) ||
      Object.getPrototypeOf(policy) !== Object.prototype) {
    fail("template2-policy");
  }
  const keys = Object.keys(policy).sort();
  const expectedKeys = Object.keys(DEFAULT_POLICY).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) fail("template2-policy");
  const maxima = [
    ["maximumArtifactBytes", DEFAULT_MAXIMUM_ARTIFACT_BYTES],
    ["maximumMessages", MAXIMUM_MESSAGES],
    ["maximumMessageContentBytes", MAXIMUM_MESSAGE_CONTENT_BYTES],
    ["maximumTotalContentBytes", MAXIMUM_TOTAL_CONTENT_BYTES],
    ["maximumRenderedBytes", MAXIMUM_RENDERED_BYTES],
    ["maximumPromptTokens", MAXIMUM_PROMPT_TOKENS]
  ];
  for (const [name, maximum] of maxima) {
    if (!Number.isInteger(policy[name]) || policy[name] <= 0 || policy[name] > maximum) {
      fail("template2-policy");
    }
  }
  return policy;
}

function parseTemplate2(input, policy = DEFAULT_POLICY) {
  validateProfileIdentity();
  validatePolicy(policy);
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const layout = verifyHeader(bytes, policy);
  if (!allZero(bytes, layout.literalTableEnd, layout.byteTableOffset)) {
    fail("template2-padding");
  }

  let expectedRelativeOffset = 0;
  const byteOwners = new Set();
  const tokenOwners = new Set();
  const literals = [];
  for (let index = 0; index < LITERAL_COUNT; index += 1) {
    const expected = canonicalLiterals[index];
    const recordOffset = layout.literalTableOffset + index * LITERAL_RECORD_BYTES;
    const relativeOffset = readU64(bytes, recordOffset);
    const byteLength = readU32(bytes, recordOffset + 8);
    const kind = readU16(bytes, recordOffset + 12);
    const flags = readU16(bytes, recordOffset + 14);
    const tokenId = readU32(bytes, recordOffset + 16);
    const reserved = readU32(bytes, recordOffset + 20);
    if (relativeOffset !== expectedRelativeOffset || byteLength === 0 || reserved !== 0 ||
        relativeOffset + byteLength > layout.byteTableLength) {
      fail("template2-literal-record");
    }
    if (kind !== expected.kind) fail("template2-literal-order");
    if ((flags & ~KNOWN_LITERAL_FLAGS) !== 0 || flags !== expected.flags ||
        ((flags & FLAG_SPECIAL_TOKEN) !== 0 && (flags & FLAG_ADDED_TOKEN) === 0)) {
      fail("template2-literal-flags");
    }
    if (tokenId !== expected.tokenId ||
        ((flags & FLAG_ADDED_TOKEN) !== 0) !== (tokenId !== NONE_TOKEN_ID) ||
        (tokenId !== NONE_TOKEN_ID && tokenId >= TOKENIZER_TOKEN_COUNT)) {
      fail("template2-token-binding");
    }
    const literalBytes = bytes.subarray(
      layout.byteTableOffset + relativeOffset,
      layout.byteTableOffset + relativeOffset + byteLength);
    try {
      UTF8_DECODER.decode(literalBytes);
    } catch {
      fail("template2-literal-utf8");
    }
    if (!literalBytes.equals(expected.bytes)) fail("template2-literal-bytes");
    const byteKey = literalBytes.toString("hex");
    if (byteOwners.has(byteKey)) fail("template2-duplicate-literal");
    byteOwners.add(byteKey);
    if (tokenId !== NONE_TOKEN_ID) {
      if (tokenOwners.has(tokenId)) fail("template2-duplicate-token-id");
      tokenOwners.add(tokenId);
    }
    literals.push(Object.freeze({
      index,
      kind,
      flags,
      tokenId: tokenId === NONE_TOKEN_ID ? null : tokenId,
      bytes: Buffer.from(literalBytes)
    }));
    expectedRelativeOffset += byteLength;
  }
  if (expectedRelativeOffset !== layout.byteTableLength) fail("template2-layout");
  return Object.freeze({
    profileId: PROFILE_ID,
    identity: Object.freeze({ byteLength: bytes.length, sha256: sha256Hex(bytes) }),
    header: Object.freeze({
      fileSize: bytes.length,
      literalTableOffset: layout.literalTableOffset,
      literalCount: LITERAL_COUNT,
      byteTableOffset: layout.byteTableOffset,
      byteTableLength: layout.byteTableLength,
      tokenizerArtifactSha256: TOKENIZER_SHA256,
      sourceTemplateSha256: SOURCE_TEMPLATE_SHA256,
      sourceModelConfigSha256: SOURCE_MODEL_CONFIG_SHA256,
      tokenizerArtifactByteLength: TOKENIZER_ARTIFACT_BYTES,
      tokenizerTokenCount: TOKENIZER_TOKEN_COUNT,
      modelVocabularySize: MODEL_VOCABULARY_SIZE,
      stopTokenIds: Object.freeze([MESSAGE_END_TOKEN_ID, 151_643])
    }),
    literals: Object.freeze(literals),
    policy
  });
}

function writeTemplate2() {
  validateProfileIdentity();
  const layout = expectedLayout();
  const artifact = Buffer.alloc(layout.fileSize);
  MAGIC.copy(artifact, 0);
  FORMAT_ID.copy(artifact, 8);
  writeU32(artifact, 24, HEADER_BYTES);
  writeU16(artifact, 28, 2);
  writeU16(artifact, 30, 0);
  writeU32(artifact, 32, 0x0102_0304);
  writeU16(artifact, 36, 1);
  writeU64(artifact, 40, layout.fileSize);
  writeU64(artifact, 48, layout.literalTableOffset);
  writeU32(artifact, 56, LITERAL_COUNT);
  writeU32(artifact, 60, LITERAL_RECORD_BYTES);
  writeU64(artifact, 64, layout.byteTableOffset);
  writeU64(artifact, 72, layout.byteTableLength);
  strictHex(TOKENIZER_SHA256).copy(artifact, 80);
  strictHex(SOURCE_TEMPLATE_SHA256).copy(artifact, 112);
  strictHex(SOURCE_MODEL_CONFIG_SHA256).copy(artifact, 144);
  writeU32(artifact, 176, 4_168);
  writeU64(artifact, 180, TOKENIZER_ARTIFACT_BYTES);
  writeU32(artifact, 188, TOKENIZER_TOKEN_COUNT);
  writeU32(artifact, 192, MODEL_VOCABULARY_SIZE);
  writeU32(artifact, 196, MESSAGE_START_TOKEN_ID);
  writeU32(artifact, 200, MESSAGE_END_TOKEN_ID);
  writeU32(artifact, 204, MESSAGE_END_TOKEN_ID);
  writeU32(artifact, 208, 151_643);
  writeU32(artifact, 212, MAXIMUM_MESSAGES);
  writeU32(artifact, 216, MAXIMUM_MESSAGE_CONTENT_BYTES);
  writeU32(artifact, 220, MAXIMUM_TOTAL_CONTENT_BYTES);
  writeU32(artifact, 224, MAXIMUM_RENDERED_BYTES);
  writeU32(artifact, 228, MAXIMUM_PROMPT_TOKENS);
  writeU16(artifact, 234, 3);
  writeU16(artifact, 236, 1);
  writeU16(artifact, 238, 1);
  writeU16(artifact, 240, 1);
  writeU16(artifact, 244, 1);

  let relativeOffset = 0;
  for (let index = 0; index < canonicalLiterals.length; index += 1) {
    const entry = canonicalLiterals[index];
    const recordOffset = layout.literalTableOffset + index * LITERAL_RECORD_BYTES;
    writeU64(artifact, recordOffset, relativeOffset);
    writeU32(artifact, recordOffset + 8, entry.bytes.length);
    writeU16(artifact, recordOffset + 12, entry.kind);
    writeU16(artifact, recordOffset + 14, entry.flags);
    writeU32(artifact, recordOffset + 16, entry.tokenId);
    entry.bytes.copy(artifact, layout.byteTableOffset + relativeOffset);
    relativeOffset += entry.bytes.length;
  }
  parseTemplate2(artifact);
  return artifact;
}

function validUnicodeScalarString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function messageRoleBytes(template, role) {
  if (role === "system") return template.literals[2].bytes;
  if (role === "user") return template.literals[3].bytes;
  if (role === "assistant") return template.literals[4].bytes;
  fail("template2-role");
}

function validateMessages(template, messages, policy) {
  if (!Array.isArray(messages) || messages.length === 0 ||
      messages.length > policy.maximumMessages) {
    fail("template2-message-count");
  }
  const validated = [];
  let totalContentBytes = 0;
  let cursor = 0;
  if (messages[0]?.role === "system") cursor = 1;
  if (cursor >= messages.length) fail("template2-role-order");
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === null || typeof message !== "object" || Array.isArray(message) ||
        Object.getPrototypeOf(message) !== Object.prototype ||
        JSON.stringify(Object.keys(message).sort()) !== '["content","role"]') {
      fail("template2-message-shape");
    }
    if (typeof message.role !== "string" ||
        !["system", "user", "assistant"].includes(message.role)) {
      fail("template2-role");
    }
    if (typeof message.content !== "string") fail("template2-content-type");
    if (!validUnicodeScalarString(message.content)) fail("template2-content-unicode");
    if (index === 0 && message.role === "system") {
      // The optional system slot was already accounted for.
    } else {
      const conversationalIndex = index - cursor;
      const expectedRole = conversationalIndex % 2 === 0 ? "user" : "assistant";
      if (message.role !== expectedRole) fail("template2-role-order");
    }
    const contentBytes = Buffer.from(message.content, "utf8");
    if (contentBytes.length > policy.maximumMessageContentBytes) {
      fail("template2-content-limit");
    }
    totalContentBytes += contentBytes.length;
    if (!Number.isSafeInteger(totalContentBytes) ||
        totalContentBytes > policy.maximumTotalContentBytes) {
      fail("template2-total-content-limit");
    }
    for (const entry of template.literals) {
      if ((entry.flags & FLAG_FORBIDDEN_CONTENT) !== 0 &&
          contentBytes.indexOf(entry.bytes) !== -1) {
        fail("template2-content-control-token");
      }
    }
    validated.push(Object.freeze({
      role: message.role,
      roleBytes: messageRoleBytes(template, message.role),
      contentBytes
    }));
  }
  if (messages.at(-1).role !== "user") fail("template2-role-order");
  return Object.freeze(validated);
}

function renderPrompt(template, messages, policy = template?.policy ?? DEFAULT_POLICY) {
  if (template === null || typeof template !== "object" || template.profileId !== PROFILE_ID ||
      !Array.isArray(template.literals) || template.literals.length !== LITERAL_COUNT) {
    fail("template2-runtime");
  }
  validatePolicy(policy);
  const validated = validateMessages(template, messages, policy);
  const start = template.literals[0].bytes;
  const end = template.literals[1].bytes;
  const newline = template.literals[5].bytes;
  const thinkingDisabled = template.literals[6].bytes;
  const assistant = template.literals[4].bytes;
  let renderedLength = start.length + assistant.length + newline.length + thinkingDisabled.length;
  for (const message of validated) {
    renderedLength += start.length + message.roleBytes.length + newline.length +
      message.contentBytes.length + end.length + newline.length;
    if (!Number.isSafeInteger(renderedLength)) fail("template2-rendered-limit");
  }
  if (renderedLength > policy.maximumRenderedBytes) fail("template2-rendered-limit");

  const chunks = [];
  const insertions = [];
  let offset = 0;
  const append = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  for (let index = 0; index < validated.length; index += 1) {
    const message = validated[index];
    insertions.push(Object.freeze({
      kind: "message-start",
      messageIndex: index,
      tokenId: MESSAGE_START_TOKEN_ID,
      byteOffset: offset
    }));
    append(start);
    append(message.roleBytes);
    append(newline);
    append(message.contentBytes);
    insertions.push(Object.freeze({
      kind: "message-end",
      messageIndex: index,
      tokenId: MESSAGE_END_TOKEN_ID,
      byteOffset: offset
    }));
    append(end);
    append(newline);
  }
  insertions.push(Object.freeze({
    kind: "generation-start",
    messageIndex: null,
    tokenId: MESSAGE_START_TOKEN_ID,
    byteOffset: offset
  }));
  append(start);
  append(assistant);
  append(newline);
  insertions.push(Object.freeze({
    kind: "thinking-start",
    messageIndex: null,
    tokenId: THINKING_START_TOKEN_ID,
    byteOffset: offset
  }));
  insertions.push(Object.freeze({
    kind: "thinking-end",
    messageIndex: null,
    tokenId: THINKING_END_TOKEN_ID,
    byteOffset: offset + Buffer.byteLength("<think>\n\n", "utf8")
  }));
  append(thinkingDisabled);
  assertInvariant(offset === renderedLength, "template2-render-length");
  return Object.freeze({
    bytes: Buffer.concat(chunks, renderedLength),
    insertions: Object.freeze(insertions),
    thinkingMode: "disabled",
    stopTokenIds: Object.freeze([MESSAGE_END_TOKEN_ID, 151_643]),
    bosInserted: false,
    eosInserted: false
  });
}

function validatePromptTokenCount(template, tokenCount, policy = template?.policy ?? DEFAULT_POLICY) {
  if (template === null || typeof template !== "object" || template.profileId !== PROFILE_ID) {
    fail("template2-runtime");
  }
  validatePolicy(policy);
  if (!Number.isInteger(tokenCount) || tokenCount < 0 || tokenCount > policy.maximumPromptTokens) {
    fail("template2-token-limit");
  }
}

function applyMutation(bytes, mutation) {
  const output = Buffer.from(bytes);
  if (mutation.operation === "set-byte") {
    if (!Number.isInteger(mutation.offset) || mutation.offset < 0 ||
        mutation.offset >= output.length || !Number.isInteger(mutation.value) ||
        mutation.value < 0 || mutation.value > 255) {
      fail("template2-vector-mutation");
    }
    output[mutation.offset] = mutation.value;
    return output;
  }
  if (mutation.operation === "xor-byte") {
    if (!Number.isInteger(mutation.offset) || mutation.offset < 0 ||
        mutation.offset >= output.length || !Number.isInteger(mutation.value) ||
        mutation.value < 1 || mutation.value > 255) {
      fail("template2-vector-mutation");
    }
    output[mutation.offset] ^= mutation.value;
    return output;
  }
  if (mutation.operation === "replace-hex") {
    const replacement = strictHex(mutation.hex);
    if (!Number.isInteger(mutation.offset) || mutation.offset < 0 ||
        mutation.offset + replacement.length > output.length) {
      fail("template2-vector-mutation");
    }
    replacement.copy(output, mutation.offset);
    return output;
  }
  if (mutation.operation === "append-hex") {
    return Buffer.concat([output, strictHex(mutation.hex)]);
  }
  fail("template2-vector-mutation");
}

function u16Hex(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes.toString("hex");
}

function u32Hex(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes.toString("hex");
}

function u64Hex(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes.toString("hex");
}

function frozenMutations(artifact) {
  const layout = expectedLayout();
  return [
    { id: "wrong-magic", operation: "xor-byte", offset: 0, value: 1, expectedError: "template2-header" },
    { id: "unknown-minor", operation: "set-byte", offset: 30, value: 1, expectedError: "template2-header" },
    { id: "unknown-renderer-profile", operation: "replace-hex", offset: 36, hex: u16Hex(2), expectedError: "template2-profile" },
    { id: "unknown-header-flag", operation: "set-byte", offset: 38, value: 1, expectedError: "template2-profile" },
    { id: "wrong-file-size", operation: "replace-hex", offset: 40, hex: u64Hex(artifact.length + 1), expectedError: "template2-header" },
    { id: "wrong-byte-table-offset", operation: "replace-hex", offset: 64, hex: u64Hex(layout.byteTableOffset + 64), expectedError: "template2-layout" },
    { id: "wrong-tokenizer-binding", operation: "xor-byte", offset: 80, value: 1, expectedError: "template2-source-binding" },
    { id: "wrong-template-binding", operation: "xor-byte", offset: 112, value: 1, expectedError: "template2-source-binding" },
    { id: "nonzero-header-reserved", operation: "set-byte", offset: 246, value: 1, expectedError: "template2-profile" },
    { id: "nonzero-section-padding", operation: "set-byte", offset: layout.literalTableEnd, value: 1, expectedError: "template2-padding" },
    { id: "unknown-literal-kind", operation: "replace-hex", offset: HEADER_BYTES + 12, hex: u16Hex(9), expectedError: "template2-literal-order" },
    { id: "unknown-literal-flag", operation: "replace-hex", offset: HEADER_BYTES + 14, hex: u16Hex(31), expectedError: "template2-literal-flags" },
    { id: "wrong-literal-token-id", operation: "replace-hex", offset: HEADER_BYTES + 16, hex: u32Hex(1), expectedError: "template2-token-binding" },
    { id: "wrong-literal-bytes", operation: "xor-byte", offset: layout.byteTableOffset, value: 1, expectedError: "template2-literal-bytes" },
    { id: "trailing-byte", operation: "append-hex", hex: "00", expectedError: "template2-header" }
  ];
}

function frozenRenderInputs() {
  return [
    { id: "single-user", messages: [{ role: "user", content: "Hello" }] },
    { id: "system-and-user", messages: [
      { role: "system", content: "Be concise." },
      { role: "user", content: "Summarize this." }
    ] },
    { id: "multi-turn", messages: [
      { role: "user", content: "Plan this." },
      { role: "assistant", content: "I can help." },
      { role: "user", content: "Use only what I have." }
    ] },
    { id: "empty-user", messages: [{ role: "user", content: "" }] },
    { id: "empty-system-and-assistant", messages: [
      { role: "system", content: "" },
      { role: "user", content: "First" },
      { role: "assistant", content: "" },
      { role: "user", content: "Second" }
    ] },
    { id: "unicode-and-newline", messages: [
      { role: "user", content: "R\u00e9sum\u00e9 \ud83d\ude42\n\u7b2c\u4e8c\u884c" }
    ] },
    { id: "template-syntax-is-data", messages: [
      { role: "user", content: "Treat {{ 7 * 7 }} and {% for x in y %} as data." }
    ] },
    { id: "preserve-crlf-and-trailing-space", messages: [
      { role: "user", content: "line one\r\nline two " }
    ] }
  ];
}

function frozenMalformedInputs() {
  return [
    { id: "empty-messages", messages: [], expectedError: "template2-message-count" },
    { id: "assistant-first", messages: [{ role: "assistant", content: "x" }], expectedError: "template2-role-order" },
    { id: "system-only", messages: [{ role: "system", content: "x" }], expectedError: "template2-role-order" },
    { id: "system-after-user", messages: [
      { role: "user", content: "x" }, { role: "system", content: "y" },
      { role: "user", content: "z" }
    ], expectedError: "template2-role-order" },
    { id: "consecutive-users", messages: [
      { role: "user", content: "x" }, { role: "user", content: "y" }
    ], expectedError: "template2-role-order" },
    { id: "final-assistant", messages: [
      { role: "user", content: "x" }, { role: "assistant", content: "y" }
    ], expectedError: "template2-role-order" },
    { id: "duplicate-system", messages: [
      { role: "system", content: "x" }, { role: "system", content: "y" },
      { role: "user", content: "z" }
    ], expectedError: "template2-role-order" },
    { id: "unknown-role", messages: [{ role: "developer", content: "x" }], expectedError: "template2-role" },
    { id: "unknown-field", messages: [{ role: "user", content: "x", name: "n" }], expectedError: "template2-message-shape" },
    { id: "nested-content", messages: [{ role: "user", content: { text: "x" } }], expectedError: "template2-content-type" },
    { id: "numeric-content", messages: [{ role: "user", content: 7 }], expectedError: "template2-content-type" }
  ];
}

function generatedMessageSequence(count, includeSystem) {
  const messages = [];
  if (includeSystem) messages.push({ role: "system", content: "" });
  while (messages.length < count) {
    const conversationalIndex = messages.length - (includeSystem ? 1 : 0);
    messages.push({
      role: conversationalIndex % 2 === 0 ? "user" : "assistant",
      content: ""
    });
  }
  return messages;
}

function validateFrozenBoundaries(template) {
  renderPrompt(template, generatedMessageSequence(MAXIMUM_MESSAGES, true));
  try {
    renderPrompt(template, generatedMessageSequence(MAXIMUM_MESSAGES + 1, false));
    fail("template2-vector-boundary");
  } catch (error) {
    if (!(error instanceof Template2ReferenceError) || error.code !== "template2-message-count") throw error;
  }
  renderPrompt(template, [{ role: "user", content: "x".repeat(MAXIMUM_MESSAGE_CONTENT_BYTES) }]);
  try {
    renderPrompt(template, [{ role: "user", content: "x".repeat(MAXIMUM_MESSAGE_CONTENT_BYTES + 1) }]);
    fail("template2-vector-boundary");
  } catch (error) {
    if (!(error instanceof Template2ReferenceError) || error.code !== "template2-content-limit") throw error;
  }
  const exactTotal = [
    { role: "user", content: "x".repeat(MAXIMUM_MESSAGE_CONTENT_BYTES) },
    { role: "assistant", content: "x".repeat(MAXIMUM_MESSAGE_CONTENT_BYTES) },
    { role: "user", content: "x".repeat(MAXIMUM_MESSAGE_CONTENT_BYTES) },
    { role: "assistant", content: "x".repeat(MAXIMUM_MESSAGE_CONTENT_BYTES) },
    { role: "user", content: "" }
  ];
  renderPrompt(template, exactTotal);
  exactTotal[4] = { role: "user", content: "x" };
  try {
    renderPrompt(template, exactTotal);
    fail("template2-vector-boundary");
  } catch (error) {
    if (!(error instanceof Template2ReferenceError) || error.code !== "template2-total-content-limit") throw error;
  }
  validatePromptTokenCount(template, MAXIMUM_PROMPT_TOKENS);
  try {
    validatePromptTokenCount(template, MAXIMUM_PROMPT_TOKENS + 1);
    fail("template2-vector-boundary");
  } catch (error) {
    if (!(error instanceof Template2ReferenceError) || error.code !== "template2-token-limit") throw error;
  }
}

function renderVectorDocument() {
  validateProfileIdentity();
  const artifact = writeTemplate2();
  const template = parseTemplate2(artifact);
  const renderCases = frozenRenderInputs().map((entry) => {
    const rendered = renderPrompt(template, entry.messages);
    return Object.freeze({
      id: entry.id,
      messages: entry.messages,
      expectedUtf8Hex: rendered.bytes.toString("hex"),
      expectedInsertions: rendered.insertions
    });
  });
  const malformedInputs = frozenMalformedInputs();
  for (const entry of malformedInputs) {
    try {
      renderPrompt(template, entry.messages);
      fail("template2-vector-malformed");
    } catch (error) {
      if (!(error instanceof Template2ReferenceError) || error.code !== entry.expectedError) throw error;
    }
  }
  const forbiddenContentCases = template.literals
    .filter((entry) => (entry.flags & FLAG_FORBIDDEN_CONTENT) !== 0)
    .map((entry) => ({
      tokenId: entry.tokenId,
      utf8Hex: entry.bytes.toString("hex"),
      expectedError: "template2-content-control-token"
    }));
  for (const entry of forbiddenContentCases) {
    try {
      renderPrompt(template, [{ role: "user", content: UTF8_DECODER.decode(strictHex(entry.utf8Hex)) }]);
      fail("template2-vector-forbidden-content");
    } catch (error) {
      if (!(error instanceof Template2ReferenceError) || error.code !== entry.expectedError) throw error;
    }
  }
  validateFrozenBoundaries(template);
  const mutations = frozenMutations(artifact);
  for (const mutation of mutations) {
    try {
      parseTemplate2(applyMutation(artifact, mutation));
      fail("template2-vector-mutation");
    } catch (error) {
      if (!(error instanceof Template2ReferenceError) || error.code !== mutation.expectedError) throw error;
    }
  }
  for (let length = 0; length < artifact.length; length += 1) {
    try {
      parseTemplate2(artifact.subarray(0, length));
      fail("template2-vector-truncation");
    } catch (error) {
      if (!(error instanceof Template2ReferenceError)) throw error;
    }
  }

  const document = {
    schema: "tinyrustlm.vnext.template2-format-vectors.v1",
    profileId: PROFILE_ID,
    profileSha256: PROFILE_SHA256,
    independentOracle: {
      implementation: "tinyrustlm/tools/template2-reference.js",
      sourceSha256: sha256Hex(fs.readFileSync(__filename)),
      roles: ["vector-generator", "writer", "parser", "renderer"]
    },
    sourceAuthority: {
      modelId: "Qwen/Qwen3-0.6B",
      revision: "c1899de289a04d12100db370d81485cdf75e47ca",
      sourceTemplateByteLength: 4_168,
      sourceTemplateSha256: SOURCE_TEMPLATE_SHA256,
      sourceModelConfigSha256: SOURCE_MODEL_CONFIG_SHA256,
      tokenizerArtifactByteLength: TOKENIZER_ARTIFACT_BYTES,
      tokenizerArtifactSha256: TOKENIZER_SHA256
    },
    vectors: [{
      id: "qwen3-chatml-no-tools-thinking-disabled-v1",
      artifactHex: artifact.toString("hex"),
      artifactByteLength: artifact.length,
      artifactSha256: sha256Hex(artifact),
      header: template.header,
      literals: template.literals.map((entry) => ({
        index: entry.index,
        kind: entry.kind,
        flags: entry.flags,
        tokenId: entry.tokenId,
        utf8Hex: entry.bytes.toString("hex")
      })),
      renderCases,
      malformedInputs,
      forbiddenContentCases,
      boundaryCases: [
        { id: "maximum-messages", recipe: "optional-empty-system-plus-255-empty-alternating-conversation-messages", expected: "pass" },
        { id: "message-count-over", recipe: "257-empty-alternating-conversation-messages", expectedError: "template2-message-count" },
        { id: "maximum-message-content", asciiByteLength: MAXIMUM_MESSAGE_CONTENT_BYTES, expected: "pass" },
        { id: "message-content-over", asciiByteLength: MAXIMUM_MESSAGE_CONTENT_BYTES + 1, expectedError: "template2-content-limit" },
        { id: "maximum-total-content", asciiByteLength: MAXIMUM_TOTAL_CONTENT_BYTES, expected: "pass" },
        { id: "total-content-over", asciiByteLength: MAXIMUM_TOTAL_CONTENT_BYTES + 1, expectedError: "template2-total-content-limit" },
        { id: "maximum-prompt-tokens", tokenCount: MAXIMUM_PROMPT_TOKENS, expected: "pass" },
        { id: "prompt-token-over", tokenCount: MAXIMUM_PROMPT_TOKENS + 1, expectedError: "template2-token-limit" }
      ],
      mutations,
      truncation: {
        operation: "every-prefix-length",
        startInclusive: 0,
        endExclusive: artifact.length,
        expected: "reject"
      }
    }]
  };
  return Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function runCli() {
  const [operation, ...extra] = process.argv.slice(2);
  if ((operation !== "--check" && operation !== "--write") || extra.length !== 0) {
    fail("template2-vector-arguments");
  }
  const generated = renderVectorDocument();
  if (operation === "--check") {
    if (!fs.readFileSync(vectorPath).equals(generated)) fail("template2-vector-drift");
    process.stdout.write('{"status":"pass","vectors":1}\n');
  } else {
    fs.writeFileSync(vectorPath, generated, { flag: "w" });
    process.stdout.write('{"status":"written","vectors":1}\n');
  }
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error?.code || "template2-vector-failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  DEFAULT_POLICY,
  Template2ReferenceError,
  applyMutation,
  parseTemplate2,
  renderPrompt,
  renderVectorDocument,
  sha256Hex,
  strictHex,
  validatePromptTokenCount,
  vectorPath,
  writeTemplate2
});
