"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const HEADER_BYTES = 192;
const SECTION_ALIGNMENT = 64;
const TOKEN_RECORD_BYTES = 24;
const MERGE_RECORD_BYTES = 16;
const NONE_TOKEN_ID = 0xffff_ffff;
const MAXIMUM_TOKENS = 1_048_576;
const MAXIMUM_MERGES = 1_048_576;
const MAXIMUM_ADDED_TOKENS = 65_536;
const MAXIMUM_TOKEN_BYTES = 1_048_576;
const DEFAULT_MAXIMUM_ARTIFACT_BYTES = 64 * 1024 * 1024;
const PROFILE_ID = "org.minimodel.tokenizer2/2.0";
const PROFILE_SHA256 = "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de";
const BASE_TOKEN_COUNT = 271;
const END_OF_TEXT_ID = 271;
const IM_START_ID = 272;
const IM_END_ID = 273;
const THINK_ID = 274;
const IM_PREFIX_ID = 275;
const DECOMPOSED_ADDED_ID = 276;
const MAGIC = Buffer.from([0x54, 0x4f, 0x4b, 0x32, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMAT_ID = Buffer.from("minimodel.tok2\0\0", "ascii");
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const SPACE_BODY = "\\u0009-\\u000d\\u0020\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PRETOKEN_EXPRESSION = [
  "'(?:s|t|re|ve|m|ll|d)",
  "[^\\r\\n\\p{L}\\p{N}]?\\p{L}+",
  "\\p{N}",
  ` ?[^${SPACE_BODY}\\p{L}\\p{N}]+[\\r\\n]*`,
  `[${SPACE_BODY}]*[\\r\\n]+`,
  `[${SPACE_BODY}]+(?![^${SPACE_BODY}])`,
  `[${SPACE_BODY}]+`
].join("|");
const repositoryRoot = path.resolve(__dirname, "../..");
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/tokenizer2-format-vectors.v1.json"
);
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/tokenizer2-format-profile.v1.json"
);

class Tokenizer2ReferenceError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new Tokenizer2ReferenceError(code);
}

function asBytes(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    fail("tokenizer2-file-size");
  }
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

function ensureRange(bytes, offset, length, code = "tokenizer2-truncated") {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
      offset < 0 || length < 0 || offset > bytes.length - length) {
    fail(code);
  }
}

function readU16(bytes, offset) {
  ensureRange(bytes, offset, 2);
  return bytes.readUInt16LE(offset);
}

function readU32(bytes, offset) {
  ensureRange(bytes, offset, 4);
  return bytes.readUInt32LE(offset);
}

function readU64(bytes, offset) {
  ensureRange(bytes, offset, 8);
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("tokenizer2-layout");
  return Number(value);
}

function alignUp(value, alignment) {
  if (!Number.isSafeInteger(value) || value < 0) fail("tokenizer2-layout");
  const remainder = value % alignment;
  const result = remainder === 0 ? value : value + alignment - remainder;
  if (!Number.isSafeInteger(result)) fail("tokenizer2-layout");
  return result;
}

function zeroRange(bytes, start, end) {
  ensureRange(bytes, start, end - start, "tokenizer2-padding");
  for (let offset = start; offset < end; offset += 1) {
    if (bytes[offset] !== 0) fail("tokenizer2-padding");
  }
}

function decodeOptionalId(value, tokenCount) {
  if (value === NONE_TOKEN_ID) return null;
  if (value >= tokenCount) fail("tokenizer2-special-id");
  return value;
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function pairKey(left, right) {
  return `${left}:${right}`;
}

function decodeUtf8(bytes, code = "tokenizer2-decoded-utf8") {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (_error) {
    fail(code);
  }
}

function parseHeader(bytes, maximumArtifactBytes) {
  if (bytes.length < HEADER_BYTES || bytes.length > maximumArtifactBytes) {
    fail("tokenizer2-file-size");
  }
  if (!bytes.subarray(0, 8).equals(MAGIC) ||
      !bytes.subarray(8, 24).equals(FORMAT_ID) ||
      readU32(bytes, 24) !== HEADER_BYTES ||
      readU16(bytes, 28) !== 2 || readU16(bytes, 30) !== 0 ||
      readU32(bytes, 32) !== 0x0102_0304 ||
      readU16(bytes, 36) !== 1 || readU16(bytes, 38) !== 0 ||
      readU64(bytes, 40) !== bytes.length) {
    fail("tokenizer2-header");
  }
  if (readU32(bytes, 60) !== TOKEN_RECORD_BYTES ||
      readU32(bytes, 76) !== MERGE_RECORD_BYTES ||
      readU16(bytes, 124) !== 1 || readU16(bytes, 126) !== 1 ||
      readU16(bytes, 128) !== 1 || readU16(bytes, 130) !== 1 ||
      readU16(bytes, 132) !== 9 || readU16(bytes, 134) !== 0 ||
      readU16(bytes, 136) !== 0 || readU16(bytes, 138) !== 16 ||
      readU16(bytes, 140) !== 0 || readU16(bytes, 142) !== 0 ||
      bytes.subarray(144, HEADER_BYTES).some((value) => value !== 0)) {
    fail("tokenizer2-profile");
  }

  const tokenCount = readU32(bytes, 56);
  const mergeCount = readU32(bytes, 72);
  const baseTokenCount = readU32(bytes, 96);
  const addedTokenCount = readU32(bytes, 100);
  const maximumTokenBytes = readU32(bytes, 120);
  const byteTableLength = readU64(bytes, 88);
  if (tokenCount < 256 || tokenCount > MAXIMUM_TOKENS ||
      mergeCount > MAXIMUM_MERGES || addedTokenCount > MAXIMUM_ADDED_TOKENS ||
      baseTokenCount !== 256 + mergeCount ||
      baseTokenCount + addedTokenCount !== tokenCount ||
      maximumTokenBytes === 0 || maximumTokenBytes > MAXIMUM_TOKEN_BYTES) {
    fail("tokenizer2-counts");
  }
  if (readU32(bytes, 116) !== NONE_TOKEN_ID) {
    fail("tokenizer2-unknown-token-forbidden");
  }

  const tokenTableOffset = HEADER_BYTES;
  const tokenTableEnd = tokenTableOffset + tokenCount * TOKEN_RECORD_BYTES;
  const mergeTableOffset = alignUp(tokenTableEnd, SECTION_ALIGNMENT);
  const mergeTableEnd = mergeTableOffset + mergeCount * MERGE_RECORD_BYTES;
  const byteTableOffset = alignUp(mergeTableEnd, SECTION_ALIGNMENT);
  const fileSize = byteTableOffset + byteTableLength;
  if (!Number.isSafeInteger(tokenTableEnd) || !Number.isSafeInteger(mergeTableEnd) ||
      !Number.isSafeInteger(fileSize) || readU64(bytes, 48) !== tokenTableOffset ||
      readU64(bytes, 64) !== mergeTableOffset || readU64(bytes, 80) !== byteTableOffset ||
      fileSize !== bytes.length) {
    fail("tokenizer2-layout");
  }
  zeroRange(bytes, tokenTableEnd, mergeTableOffset);
  zeroRange(bytes, mergeTableEnd, byteTableOffset);

  return Object.freeze({
    tokenCount,
    mergeCount,
    baseTokenCount,
    addedTokenCount,
    bosTokenId: decodeOptionalId(readU32(bytes, 104), tokenCount),
    eosTokenId: decodeOptionalId(readU32(bytes, 108), tokenCount),
    padTokenId: decodeOptionalId(readU32(bytes, 112), tokenCount),
    maximumTokenBytes,
    byteTableLength,
    tokenTableOffset,
    mergeTableOffset,
    byteTableOffset,
    fileSize
  });
}

function parseTokens(bytes, header) {
  const records = [];
  const byteTokenIds = new Array(256).fill(NONE_TOKEN_ID);
  const addedTokens = [];
  const tokenStrings = new Set();
  let expectedRelativeOffset = 0;
  let actualMaximum = 0;
  for (let id = 0; id < header.tokenCount; id += 1) {
    const recordOffset = header.tokenTableOffset + id * TOKEN_RECORD_BYTES;
    const relativeOffset = readU64(bytes, recordOffset);
    const byteLength = readU32(bytes, recordOffset + 8);
    const flags = readU32(bytes, recordOffset + 12);
    if (readU64(bytes, recordOffset + 16) !== 0 ||
        relativeOffset !== expectedRelativeOffset || byteLength === 0 ||
        byteLength > MAXIMUM_TOKEN_BYTES || (flags & ~3) !== 0) {
      fail("tokenizer2-token-record");
    }
    if ((id < header.baseTokenCount && flags !== 0) ||
        (id >= header.baseTokenCount && (flags & 1) === 0)) {
      fail("tokenizer2-token-flags");
    }
    const byteOffset = header.byteTableOffset + relativeOffset;
    ensureRange(bytes, byteOffset, byteLength, "tokenizer2-token-range");
    const tokenBytes = bytes.subarray(byteOffset, byteOffset + byteLength);
    const key = tokenBytes.toString("hex");
    if (tokenStrings.has(key)) fail("tokenizer2-duplicate-token");
    tokenStrings.add(key);
    if (id < 256) {
      if (byteLength !== 1 || byteTokenIds[tokenBytes[0]] !== NONE_TOKEN_ID) {
        fail("tokenizer2-byte-alphabet");
      }
      byteTokenIds[tokenBytes[0]] = id;
    }
    const record = Object.freeze({ id, byteOffset, byteLength, flags, tokenBytes });
    records.push(record);
    if ((flags & 1) !== 0) {
      decodeUtf8(tokenBytes, "tokenizer2-added-utf8");
      addedTokens.push(record);
    }
    expectedRelativeOffset += byteLength;
    actualMaximum = Math.max(actualMaximum, byteLength);
  }
  if (expectedRelativeOffset !== header.byteTableLength ||
      actualMaximum !== header.maximumTokenBytes ||
      byteTokenIds.some((id) => id === NONE_TOKEN_ID) ||
      addedTokens.length !== header.addedTokenCount) {
    fail("tokenizer2-token-closure");
  }
  addedTokens.sort((left, right) =>
    right.byteLength - left.byteLength || left.id - right.id);
  return Object.freeze({
    records: Object.freeze(records),
    byteTokenIds: Object.freeze(byteTokenIds),
    addedTokens: Object.freeze(addedTokens)
  });
}

function parseMerges(bytes, header, records) {
  const merges = new Map();
  const outputs = new Set();
  for (let rank = 0; rank < header.mergeCount; rank += 1) {
    const offset = header.mergeTableOffset + rank * MERGE_RECORD_BYTES;
    const left = readU32(bytes, offset);
    const right = readU32(bytes, offset + 4);
    const output = readU32(bytes, offset + 8);
    if (readU32(bytes, offset + 12) !== 0 || left >= header.baseTokenCount ||
        right >= header.baseTokenCount || output !== 256 + rank ||
        output >= header.baseTokenCount) {
      fail("tokenizer2-merge-record");
    }
    const key = pairKey(left, right);
    if (merges.has(key)) fail("tokenizer2-duplicate-merge");
    if (outputs.has(output)) fail("tokenizer2-duplicate-output");
    merges.set(key, Object.freeze({ left, right, output, rank }));
    outputs.add(output);
    const expected = Buffer.concat([records[left].tokenBytes, records[right].tokenBytes]);
    if (!records[output].tokenBytes.equals(expected)) fail("tokenizer2-merge-bytes");
  }
  if (outputs.size !== header.baseTokenCount - 256) fail("tokenizer2-merge-closure");
  return merges;
}

function parseTokenizer2(input, options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options) ||
      Object.keys(options).some((key) => key !== "maximumArtifactBytes")) {
    fail("tokenizer2-invalid-policy");
  }
  const maximumArtifactBytes = options.maximumArtifactBytes ?? DEFAULT_MAXIMUM_ARTIFACT_BYTES;
  if (!Number.isSafeInteger(maximumArtifactBytes) || maximumArtifactBytes < HEADER_BYTES) {
    fail("tokenizer2-invalid-policy");
  }
  const bytes = asBytes(input);
  const header = parseHeader(bytes, maximumArtifactBytes);
  const parsedTokens = parseTokens(bytes, header);
  const merges = parseMerges(bytes, header, parsedTokens.records);
  return Object.freeze({
    bytes,
    identity: Object.freeze({ byteLength: bytes.length, sha256: sha256Hex(bytes) }),
    header,
    records: parsedTokens.records,
    byteTokenIds: parsedTokens.byteTokenIds,
    addedTokens: parsedTokens.addedTokens,
    merges
  });
}

function pretokenizeText(text) {
  if (typeof text !== "string") fail("tokenizer2-pretokenizer-boundary");
  if (text.length === 0) return [];
  const expression = new RegExp(PRETOKEN_EXPRESSION, "giu");
  const pieces = [];
  let expectedIndex = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index !== expectedIndex || match[0].length === 0) {
      fail("tokenizer2-pretokenizer-gap");
    }
    pieces.push(match[0]);
    expectedIndex += match[0].length;
  }
  if (expectedIndex !== text.length) fail("tokenizer2-pretokenizer-gap");
  return pieces;
}

function nextUtf8Scalar(bytes, offset) {
  const first = bytes[offset];
  let width;
  if (first <= 0x7f) width = 1;
  else if (first >= 0xc2 && first <= 0xdf) width = 2;
  else if (first >= 0xe0 && first <= 0xef) width = 3;
  else if (first >= 0xf0 && first <= 0xf4) width = 4;
  else fail("tokenizer2-input-boundary");
  ensureRange(bytes, offset, width, "tokenizer2-input-boundary");
  decodeUtf8(bytes.subarray(offset, offset + width), "tokenizer2-input-boundary");
  return offset + width;
}

function addedAt(tokenizer, input, offset) {
  for (const added of tokenizer.addedTokens) {
    if (offset <= input.length - added.byteLength &&
        input.subarray(offset, offset + added.byteLength).equals(added.tokenBytes)) {
      return added;
    }
  }
  return null;
}

function applyBpe(initial, merges) {
  const tokens = [...initial];
  while (tokens.length > 1) {
    let selected = null;
    for (let index = 0; index + 1 < tokens.length; index += 1) {
      const merge = merges.get(pairKey(tokens[index], tokens[index + 1]));
      if (merge !== undefined &&
          (selected === null || merge.rank < selected.rank ||
           (merge.rank === selected.rank && index < selected.index))) {
        selected = { index, rank: merge.rank, output: merge.output };
      }
    }
    if (selected === null) break;
    tokens.splice(selected.index, 2, selected.output);
  }
  return tokens;
}

function encodeUnmatched(tokenizer, inputBytes) {
  const inputText = decodeUtf8(inputBytes, "tokenizer2-input-boundary");
  const normalized = inputText.normalize("NFC");
  const output = [];
  for (const piece of pretokenizeText(normalized)) {
    const initial = [...Buffer.from(piece, "utf8")].map((byte) => tokenizer.byteTokenIds[byte]);
    output.push(...applyBpe(initial, tokenizer.merges));
  }
  return output;
}

function encodeText(tokenizer, text) {
  if (typeof text !== "string") fail("tokenizer2-input-boundary");
  const input = Buffer.from(text, "utf8");
  const output = [];
  let offset = 0;
  while (offset < input.length) {
    const added = addedAt(tokenizer, input, offset);
    if (added !== null) {
      output.push(added.id);
      offset += added.byteLength;
      continue;
    }
    const start = offset;
    offset = nextUtf8Scalar(input, offset);
    while (offset < input.length && addedAt(tokenizer, input, offset) === null) {
      offset = nextUtf8Scalar(input, offset);
    }
    output.push(...encodeUnmatched(tokenizer, input.subarray(start, offset)));
  }
  return output;
}

function decodeTokens(tokenizer, tokenIds, mode) {
  if (!Array.isArray(tokenIds) || (mode !== "include-all" && mode !== "skip-special")) {
    fail("tokenizer2-token-limit");
  }
  const pieces = [];
  for (const id of tokenIds) {
    if (!Number.isInteger(id) || id < 0 || id >= tokenizer.records.length) {
      fail("tokenizer2-unknown-id");
    }
    const record = tokenizer.records[id];
    if (mode === "skip-special" && (record.flags & 2) !== 0) continue;
    pieces.push(record.tokenBytes);
  }
  const output = Buffer.concat(pieces);
  decodeUtf8(output);
  return output;
}

function strictHex(value) {
  if (typeof value !== "string" || value.length % 2 !== 0 ||
      !/^[0-9a-f]*$/u.test(value)) {
    fail("tokenizer2-vector-hex");
  }
  return Buffer.from(value, "hex");
}

function applyMutation(source, mutation) {
  const bytes = Buffer.from(source);
  if (mutation.operation === "xor-byte") {
    bytes[mutation.offset] ^= mutation.value;
    return bytes;
  }
  if (mutation.operation === "set-byte") {
    bytes[mutation.offset] = mutation.value;
    return bytes;
  }
  if (mutation.operation === "replace-hex") {
    strictHex(mutation.hex).copy(bytes, mutation.offset);
    return bytes;
  }
  if (mutation.operation === "append-hex") {
    return Buffer.concat([bytes, strictHex(mutation.hex)]);
  }
  fail("tokenizer2-vector-mutation");
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

function encodeOptionalId(value, tokenCount) {
  if (value === null) return NONE_TOKEN_ID;
  if (!Number.isInteger(value) || value < 0 || value >= tokenCount) {
    fail("tokenizer2-special-id");
  }
  return value;
}

function validateWriterSpec(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec) ||
      !Array.isArray(spec.tokens) || !Array.isArray(spec.merges)) {
    fail("tokenizer2-writer-spec");
  }
  const tokenCount = spec.tokens.length;
  const mergeCount = spec.merges.length;
  const baseTokenCount = spec.baseTokenCount;
  if (tokenCount < 256 || tokenCount > MAXIMUM_TOKENS ||
      mergeCount > MAXIMUM_MERGES || baseTokenCount !== 256 + mergeCount ||
      baseTokenCount > tokenCount || tokenCount - baseTokenCount > MAXIMUM_ADDED_TOKENS) {
    fail("tokenizer2-base-closure");
  }
  const bosTokenId = encodeOptionalId(spec.bosTokenId, tokenCount);
  const eosTokenId = encodeOptionalId(spec.eosTokenId, tokenCount);
  const padTokenId = encodeOptionalId(spec.padTokenId, tokenCount);
  if (spec.unkTokenId !== null) fail("tokenizer2-unknown-token-forbidden");

  const tokenStrings = new Map();
  const byteOwners = new Array(256).fill(NONE_TOKEN_ID);
  let byteTableLength = 0;
  let maximumTokenBytes = 0;
  for (let id = 0; id < tokenCount; id += 1) {
    const token = spec.tokens[id];
    if (token === null || typeof token !== "object" || Array.isArray(token) ||
        !Buffer.isBuffer(token.bytes) || typeof token.added !== "boolean" ||
        typeof token.special !== "boolean" || token.bytes.length === 0 ||
        token.bytes.length > MAXIMUM_TOKEN_BYTES) {
      fail("tokenizer2-token-length");
    }
    if ((id < baseTokenCount && (token.added || token.special)) ||
        (id >= baseTokenCount && !token.added)) {
      fail("tokenizer2-token-flags");
    }
    if (id >= baseTokenCount) decodeUtf8(token.bytes, "tokenizer2-added-utf8");
    const key = token.bytes.toString("hex");
    if (tokenStrings.has(key)) fail("tokenizer2-duplicate-token");
    tokenStrings.set(key, id);
    if (id < 256) {
      if (token.bytes.length !== 1 || byteOwners[token.bytes[0]] !== NONE_TOKEN_ID) {
        fail("tokenizer2-byte-alphabet");
      }
      byteOwners[token.bytes[0]] = id;
    }
    byteTableLength += token.bytes.length;
    maximumTokenBytes = Math.max(maximumTokenBytes, token.bytes.length);
  }
  if (!Number.isSafeInteger(byteTableLength) ||
      byteOwners.some((id) => id === NONE_TOKEN_ID)) {
    fail("tokenizer2-byte-alphabet");
  }

  const pairs = new Set();
  const outputs = new Set();
  for (let rank = 0; rank < mergeCount; rank += 1) {
    const merge = spec.merges[rank];
    const output = 256 + rank;
    if (merge === null || typeof merge !== "object" || Array.isArray(merge) ||
        !Number.isInteger(merge.left) || !Number.isInteger(merge.right) ||
        !Number.isInteger(merge.output) || merge.left < 0 || merge.right < 0 ||
        merge.left >= baseTokenCount || merge.right >= baseTokenCount ||
        merge.output !== output || output >= baseTokenCount) {
      fail("tokenizer2-merge-record");
    }
    const key = pairKey(merge.left, merge.right);
    if (pairs.has(key)) fail("tokenizer2-duplicate-merge");
    if (outputs.has(output)) fail("tokenizer2-duplicate-output");
    pairs.add(key);
    outputs.add(output);
    const expected = Buffer.concat([
      spec.tokens[merge.left].bytes,
      spec.tokens[merge.right].bytes
    ]);
    if (!spec.tokens[output].bytes.equals(expected)) fail("tokenizer2-merge-bytes");
  }

  const tokenTableOffset = HEADER_BYTES;
  const tokenTableEnd = tokenTableOffset + tokenCount * TOKEN_RECORD_BYTES;
  const mergeTableOffset = alignUp(tokenTableEnd, SECTION_ALIGNMENT);
  const mergeTableEnd = mergeTableOffset + mergeCount * MERGE_RECORD_BYTES;
  const byteTableOffset = alignUp(mergeTableEnd, SECTION_ALIGNMENT);
  const fileSize = byteTableOffset + byteTableLength;
  if (!Number.isSafeInteger(fileSize) || fileSize > DEFAULT_MAXIMUM_ARTIFACT_BYTES) {
    fail("tokenizer2-file-size");
  }
  return Object.freeze({
    tokenCount,
    mergeCount,
    baseTokenCount,
    addedTokenCount: tokenCount - baseTokenCount,
    bosTokenId,
    eosTokenId,
    padTokenId,
    byteTableLength,
    maximumTokenBytes,
    tokenTableOffset,
    mergeTableOffset,
    byteTableOffset,
    fileSize
  });
}

function writeTokenizer2(spec) {
  const layout = validateWriterSpec(spec);
  const artifact = Buffer.alloc(layout.fileSize);
  MAGIC.copy(artifact, 0);
  FORMAT_ID.copy(artifact, 8);
  writeU32(artifact, 24, HEADER_BYTES);
  writeU16(artifact, 28, 2);
  writeU16(artifact, 30, 0);
  writeU32(artifact, 32, 0x0102_0304);
  writeU16(artifact, 36, 1);
  writeU64(artifact, 40, layout.fileSize);
  writeU64(artifact, 48, layout.tokenTableOffset);
  writeU32(artifact, 56, layout.tokenCount);
  writeU32(artifact, 60, TOKEN_RECORD_BYTES);
  writeU64(artifact, 64, layout.mergeTableOffset);
  writeU32(artifact, 72, layout.mergeCount);
  writeU32(artifact, 76, MERGE_RECORD_BYTES);
  writeU64(artifact, 80, layout.byteTableOffset);
  writeU64(artifact, 88, layout.byteTableLength);
  writeU32(artifact, 96, layout.baseTokenCount);
  writeU32(artifact, 100, layout.addedTokenCount);
  writeU32(artifact, 104, layout.bosTokenId);
  writeU32(artifact, 108, layout.eosTokenId);
  writeU32(artifact, 112, layout.padTokenId);
  writeU32(artifact, 116, NONE_TOKEN_ID);
  writeU32(artifact, 120, layout.maximumTokenBytes);
  writeU16(artifact, 124, 1);
  writeU16(artifact, 126, 1);
  writeU16(artifact, 128, 1);
  writeU16(artifact, 130, 1);
  writeU16(artifact, 132, 9);
  writeU16(artifact, 138, 16);

  let relativeOffset = 0;
  for (let id = 0; id < spec.tokens.length; id += 1) {
    const token = spec.tokens[id];
    const offset = layout.tokenTableOffset + id * TOKEN_RECORD_BYTES;
    writeU64(artifact, offset, relativeOffset);
    writeU32(artifact, offset + 8, token.bytes.length);
    writeU32(artifact, offset + 12,
      (token.added ? 1 : 0) | (token.special ? 2 : 0));
    token.bytes.copy(artifact, layout.byteTableOffset + relativeOffset);
    relativeOffset += token.bytes.length;
  }
  spec.merges.forEach((merge, rank) => {
    const offset = layout.mergeTableOffset + rank * MERGE_RECORD_BYTES;
    writeU32(artifact, offset, merge.left);
    writeU32(artifact, offset + 4, merge.right);
    writeU32(artifact, offset + 8, merge.output);
  });
  return artifact;
}

function gpt2ByteOrder() {
  const bytes = [];
  for (let value = 0x21; value <= 0x7e; value += 1) bytes.push(value);
  for (let value = 0xa1; value <= 0xac; value += 1) bytes.push(value);
  for (let value = 0xae; value <= 0xff; value += 1) bytes.push(value);
  for (let value = 0; value <= 0xff; value += 1) {
    if (!bytes.includes(value)) bytes.push(value);
  }
  assertInvariant(bytes.length === 256, "tokenizer2-vector-fixture");
  return bytes;
}

function assertInvariant(condition, code) {
  if (!condition) fail(code);
}

function addFixtureMerge(tokens, merges, left, right, outputBytes) {
  const output = 256 + merges.length;
  tokens.push(Object.freeze({ bytes: Buffer.from(outputBytes), added: false, special: false }));
  merges.push(Object.freeze({ left, right, output }));
}

function buildFixture() {
  const idForByte = new Array(256).fill(NONE_TOKEN_ID);
  const tokens = gpt2ByteOrder().map((byte, id) => {
    idForByte[byte] = id;
    return Object.freeze({ bytes: Buffer.from([byte]), added: false, special: false });
  });
  const merges = [];
  addFixtureMerge(tokens, merges, idForByte[0x68], idForByte[0x65], Buffer.from("he"));
  addFixtureMerge(tokens, merges, 256, idForByte[0x6c], Buffer.from("hel"));
  addFixtureMerge(tokens, merges, 257, idForByte[0x6c], Buffer.from("hell"));
  addFixtureMerge(tokens, merges, 258, idForByte[0x6f], Buffer.from("hello"));
  addFixtureMerge(tokens, merges, idForByte[0x20], idForByte[0x77], Buffer.from(" w"));
  addFixtureMerge(tokens, merges, 260, idForByte[0x6f], Buffer.from(" wo"));
  addFixtureMerge(tokens, merges, 261, idForByte[0x72], Buffer.from(" wor"));
  addFixtureMerge(tokens, merges, 262, idForByte[0x6c], Buffer.from(" worl"));
  addFixtureMerge(tokens, merges, 263, idForByte[0x64], Buffer.from(" world"));
  addFixtureMerge(tokens, merges, idForByte[0xc3], idForByte[0xa9], Buffer.from([0xc3, 0xa9]));
  addFixtureMerge(tokens, merges, idForByte[0x21], idForByte[0x21], Buffer.from("!!"));
  addFixtureMerge(tokens, merges, 266, idForByte[0x21], Buffer.from("!!!"));
  addFixtureMerge(tokens, merges, idForByte[0x20], idForByte[0x20], Buffer.from("  "));
  addFixtureMerge(tokens, merges, 268, 268, Buffer.from("    "));
  addFixtureMerge(tokens, merges, idForByte[0x31], idForByte[0x32], Buffer.from("12"));
  assertInvariant(tokens.length === BASE_TOKEN_COUNT, "tokenizer2-vector-fixture");
  for (const [hex, special] of [
    ["3c7c656e646f66746578747c3e", true],
    ["3c7c696d5f73746172747c3e", true],
    ["3c7c696d5f656e647c3e", true],
    ["3c7468696e6b3e", false],
    ["3c7c696d", false],
    ["65cc8121", false]
  ]) {
    tokens.push(Object.freeze({ bytes: Buffer.from(hex, "hex"), added: true, special }));
  }
  return Object.freeze({
    spec: Object.freeze({
      tokens: Object.freeze(tokens),
      merges: Object.freeze(merges),
      baseTokenCount: BASE_TOKEN_COUNT,
      bosTokenId: null,
      eosTokenId: IM_END_ID,
      padTokenId: END_OF_TEXT_ID,
      unkTokenId: null
    }),
    idForByte: Object.freeze(idForByte)
  });
}

function addedTokenValue(id, bytes, special) {
  return Object.freeze({ id, utf8Hex: bytes.toString("hex"), special });
}

function frozenPretokenCases() {
  return [
    ["contraction-order", "78275354", ["78", "2753", "54"]],
    ["whitespace-lookahead", "78202079", ["78", "20", "2079"]],
    ["line-ending-and-space", "610d0a202062", ["61", "0d0a", "20", "2062"]],
    ["leading-space-letter", "2078", ["2078"]],
    ["symbols-consume-line-ending", "2121210d0a", ["2121210d0a"]],
    ["digit-isolation", "413132", ["41", "31", "32"]],
    ["tab-newline-trailing-space", "090a20", ["090a", "20"]],
    ["unicode-punctuation-before-letter", "666f6fe28094626172", ["666f6f", "e28094626172"]],
    ["nel-before-letter", "78c28579", ["78", "c28579"]],
    ["bom-before-letter", "78efbbbf79", ["78", "efbbbf79"]],
    ["unicode-case-folded-contraction", "7827c5bf", ["78", "27c5bf"]]
  ].map(([id, normalizedInputUtf8Hex, expectedPieceUtf8Hex]) =>
    Object.freeze({ id, normalizedInputUtf8Hex, expectedPieceUtf8Hex }));
}

function frozenEncodingCases(fixture, tokenizer) {
  const byte = (value) => fixture.idForByte[value];
  const cases = [
    ["empty", "", []],
    ["ranked-bpe", "68656c6c6f20776f726c64", [259, 264]],
    ["nfc-before-bpe", "65cc81", [265]],
    ["symbol-rank", "212121", [267]],
    ["trailing-whitespace-bpe", "20202020", [269]],
    ["digit-pretoken-boundary", "413132", [byte(0x41), byte(0x31), byte(0x32)]],
    ["contraction-order", "78275354", [byte(0x78), byte(0x27), byte(0x53), byte(0x54)]],
    ["whitespace-lookahead", "78202079", [byte(0x78), byte(0x20), byte(0x20), byte(0x79)]],
    ["symbol-with-line-ending", "2121210d0a", [267, byte(0x0d), byte(0x0a)]],
    ["longest-added-token", "3c7c696d5f73746172747c3e3c7c696d", [IM_START_ID, IM_PREFIX_ID]],
    ["added-before-normalization", "65cc8121", [DECOMPOSED_ADDED_ID]],
    ["normal-added-normal", "68656c6c6f3c7c696d5f656e647c3e20776f726c64", [259, IM_END_ID, 264]]
  ];
  return cases.map(([id, inputUtf8Hex, expectedTokenIds]) => {
    const input = decodeUtf8(Buffer.from(inputUtf8Hex, "hex"), "tokenizer2-vector-utf8");
    assertInvariant(
      JSON.stringify(encodeText(tokenizer, input)) === JSON.stringify(expectedTokenIds),
      "tokenizer2-vector-encoding"
    );
    return Object.freeze({ id, inputUtf8Hex, expectedTokenIds });
  });
}

function frozenDecodingCases(tokenizer, idForByte) {
  const cases = [
    {
      id: "include-all",
      tokenIds: [IM_START_ID, 259, IM_END_ID, THINK_ID, IM_PREFIX_ID, DECOMPOSED_ADDED_ID],
      mode: "include-all",
      expectedUtf8Hex: "3c7c696d5f73746172747c3e68656c6c6f3c7c696d5f656e647c3e3c7468696e6b3e3c7c696d65cc8121",
      expectedError: null
    },
    {
      id: "skip-special",
      tokenIds: [END_OF_TEXT_ID, IM_START_ID, 259, IM_END_ID, THINK_ID, IM_PREFIX_ID],
      mode: "skip-special",
      expectedUtf8Hex: "68656c6c6f3c7468696e6b3e3c7c696d",
      expectedError: null
    },
    {
      id: "invalid-final-utf8",
      tokenIds: [idForByte[0xc3]],
      mode: "include-all",
      expectedUtf8Hex: null,
      expectedError: "tokenizer2-decoded-utf8"
    },
    {
      id: "unknown-token-id",
      tokenIds: [277],
      mode: "include-all",
      expectedUtf8Hex: null,
      expectedError: "tokenizer2-unknown-id"
    }
  ];
  for (const entry of cases) {
    if (entry.expectedError === null) {
      assertInvariant(
        decodeTokens(tokenizer, entry.tokenIds, entry.mode).toString("hex") ===
          entry.expectedUtf8Hex,
        "tokenizer2-vector-decoding"
      );
    } else {
      try {
        decodeTokens(tokenizer, entry.tokenIds, entry.mode);
        fail("tokenizer2-vector-decoding");
      } catch (error) {
        if (!(error instanceof Tokenizer2ReferenceError) || error.code !== entry.expectedError) {
          throw error;
        }
      }
    }
  }
  return cases;
}

function tokenByteOffset(artifact, tokenId) {
  const tokenTable = readU64(artifact, 48);
  const byteTable = readU64(artifact, 80);
  return byteTable + readU64(artifact, tokenTable + tokenId * TOKEN_RECORD_BYTES);
}

function replacementMutation(id, offset, bytes, expectedError) {
  return Object.freeze({
    id,
    operation: "replace-hex",
    offset,
    hex: Buffer.from(bytes).toString("hex"),
    expectedError
  });
}

function frozenMutations(artifact, idForByte) {
  const tokenTable = readU64(artifact, 48);
  const mergeTable = readU64(artifact, 64);
  const byteTable = readU64(artifact, 80);
  const tokenCount = readU32(artifact, 56);
  const tokenEnd = tokenTable + tokenCount * TOKEN_RECORD_BYTES;
  return [
    { id: "wrong-magic", operation: "xor-byte", offset: 0, value: 1, expectedError: "tokenizer2-header" },
    { id: "unknown-minor", operation: "set-byte", offset: 30, value: 1, expectedError: "tokenizer2-header" },
    { id: "nonzero-header-reserved", operation: "set-byte", offset: 144, value: 1, expectedError: "tokenizer2-profile" },
    { id: "nonzero-section-padding", operation: "set-byte", offset: tokenEnd, value: 1, expectedError: "tokenizer2-padding" },
    replacementMutation("unknown-token-flag", tokenTable + END_OF_TEXT_ID * TOKEN_RECORD_BYTES + 12, Buffer.from([5, 0, 0, 0]), "tokenizer2-token-record"),
    { id: "duplicate-single-byte-token", operation: "set-byte", offset: byteTable + 1, value: artifact[byteTable], expectedError: "tokenizer2-duplicate-token" },
    { id: "invalid-added-token-utf8", operation: "set-byte", offset: tokenByteOffset(artifact, DECOMPOSED_ADDED_ID), value: 0xff, expectedError: "tokenizer2-added-utf8" },
    replacementMutation("wrong-merge-output", mergeTable + 8, Buffer.from([1, 1, 0, 0]), "tokenizer2-merge-record"),
    replacementMutation("duplicate-merge-pair", mergeTable + 14 * MERGE_RECORD_BYTES, Buffer.concat([u32Bytes(idForByte[0x68]), u32Bytes(idForByte[0x65])]), "tokenizer2-duplicate-merge"),
    { id: "merge-byte-mismatch", operation: "set-byte", offset: tokenByteOffset(artifact, 270), value: 0x33, expectedError: "tokenizer2-merge-bytes" },
    replacementMutation("out-of-range-eos", 108, u32Bytes(tokenCount), "tokenizer2-special-id"),
    replacementMutation("unknown-token-present", 116, u32Bytes(0), "tokenizer2-unknown-token-forbidden"),
    { id: "trailing-byte", operation: "append-hex", hex: "00", expectedError: "tokenizer2-header" }
  ];
}

function u32Bytes(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function headerValue(artifact, parsed) {
  return Object.freeze({
    headerBytes: readU32(artifact, 24),
    versionMajor: readU16(artifact, 28),
    versionMinor: readU16(artifact, 30),
    algorithmProfile: readU16(artifact, 36),
    fileSize: parsed.header.fileSize,
    tokenTableOffset: parsed.header.tokenTableOffset,
    tokenCount: parsed.header.tokenCount,
    tokenRecordBytes: readU32(artifact, 60),
    mergeTableOffset: parsed.header.mergeTableOffset,
    mergeCount: parsed.header.mergeCount,
    mergeRecordBytes: readU32(artifact, 76),
    byteTableOffset: parsed.header.byteTableOffset,
    byteTableLength: parsed.header.byteTableLength,
    baseTokenCount: parsed.header.baseTokenCount,
    addedTokenCount: parsed.header.addedTokenCount,
    bosTokenId: parsed.header.bosTokenId,
    eosTokenId: parsed.header.eosTokenId,
    padTokenId: parsed.header.padTokenId,
    unkTokenId: null,
    maximumTokenBytes: parsed.header.maximumTokenBytes
  });
}

function renderVectorDocument() {
  const profileBytes = fs.readFileSync(profilePath);
  assertInvariant(sha256Hex(profileBytes) === PROFILE_SHA256, "tokenizer2-profile-drift");
  const profile = JSON.parse(profileBytes.toString("utf8"));
  assertInvariant(profile.profileId === PROFILE_ID, "tokenizer2-profile-drift");
  const fixture = buildFixture();
  const artifact = writeTokenizer2(fixture.spec);
  const parsed = parseTokenizer2(artifact);
  const mutations = frozenMutations(artifact, fixture.idForByte);
  for (const mutation of mutations) {
    try {
      parseTokenizer2(applyMutation(artifact, mutation));
      fail("tokenizer2-vector-mutation");
    } catch (error) {
      if (!(error instanceof Tokenizer2ReferenceError) || error.code !== mutation.expectedError) {
        throw error;
      }
    }
  }
  for (let length = 0; length < artifact.length; length += 1) {
    try {
      parseTokenizer2(artifact.subarray(0, length));
      fail("tokenizer2-vector-truncation");
    } catch (error) {
      if (!(error instanceof Tokenizer2ReferenceError)) throw error;
    }
  }
  const document = {
    schema: "tinyrustlm.vnext.tokenizer2-format-vectors.v1",
    profileId: PROFILE_ID,
    profileSha256: PROFILE_SHA256,
    independentOracle: {
      implementation: "tinyrustlm/tools/tokenizer2-reference.js",
      sourceSha256: sha256Hex(fs.readFileSync(__filename)),
      roles: ["vector-generator", "writer", "parser", "encoder", "decoder"]
    },
    oracleScope: {
      normalization: "frozen-vector-code-points-stable-across-unicode-9-through-17",
      pretokenization: "frozen-vector-code-points-only",
      claimBeyondVectors: false
    },
    vectors: [{
      id: "qwen-bytelevel-bpe-canonical-miniature",
      artifactHex: artifact.toString("hex"),
      artifactByteLength: artifact.length,
      artifactSha256: sha256Hex(artifact),
      header: headerValue(artifact, parsed),
      addedTokens: [
        addedTokenValue(END_OF_TEXT_ID, fixture.spec.tokens[END_OF_TEXT_ID].bytes, true),
        addedTokenValue(IM_START_ID, fixture.spec.tokens[IM_START_ID].bytes, true),
        addedTokenValue(IM_END_ID, fixture.spec.tokens[IM_END_ID].bytes, true),
        addedTokenValue(THINK_ID, fixture.spec.tokens[THINK_ID].bytes, false),
        addedTokenValue(IM_PREFIX_ID, fixture.spec.tokens[IM_PREFIX_ID].bytes, false),
        addedTokenValue(DECOMPOSED_ADDED_ID, fixture.spec.tokens[DECOMPOSED_ADDED_ID].bytes, false)
      ],
      pretokenCases: frozenPretokenCases(),
      encodingCases: frozenEncodingCases(fixture, parsed),
      decodingCases: frozenDecodingCases(parsed, fixture.idForByte),
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
    fail("tokenizer2-vector-arguments");
  }
  const generated = renderVectorDocument();
  if (operation === "--check") {
    if (!fs.readFileSync(vectorPath).equals(generated)) fail("tokenizer2-vector-drift");
    process.stdout.write("{\"status\":\"pass\",\"vectors\":1}\n");
  } else {
    fs.writeFileSync(vectorPath, generated, { flag: "w" });
    process.stdout.write("{\"status\":\"written\",\"vectors\":1}\n");
  }
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error?.code || "tokenizer2-vector-failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  Tokenizer2ReferenceError,
  applyMutation,
  buildFixture,
  decodeTokens,
  encodeText,
  parseTokenizer2,
  pretokenizeText,
  renderVectorDocument,
  sha256Hex,
  strictHex,
  vectorPath,
  writeTokenizer2
});
