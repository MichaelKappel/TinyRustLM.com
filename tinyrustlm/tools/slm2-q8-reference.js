"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const formatProfilePath = path.join(repositoryRoot, "contracts/vnext/slm2-format-profile.v1.json");
const weightProfilePath = path.join(repositoryRoot, "contracts/vnext/slm2-q8-weight-profile.v1.json");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/slm2-q8-weight-vectors.v1.json");

const MAGIC = Buffer.from([0x53, 0x4c, 0x4d, 0x32, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMAT_ID = Buffer.from("minimodel.slm2\0\0", "ascii");
const HEADER_BYTES = 224;
const QUANT_RECORD_BYTES = 128;
const TENSOR_RECORD_BYTES = 192;
const SECTION_ALIGNMENT = 64;
const MAXIMUM_MANIFEST_BYTES = 4_194_304;
const MAXIMUM_STRING_TABLE_BYTES = 16_777_216;
const MAXIMUM_STRINGS = 262_144;
const MAXIMUM_TENSORS = 262_144;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const LAYOUT_DOMAIN = Buffer.from("tinyrustlm.slm2.tensor-layout.mixed-q8-row.v1\0", "ascii");
const PAYLOAD_DOMAIN = Buffer.from("tinyrustlm.slm2.tensor-payload.mixed-q8-row.v1\0", "ascii");
const SCHEMA = "org.minimodel.slm/2.0";
const PROFILES = Object.freeze({
  activation: "tinyrustlm.silu-gated/1",
  architecture: "tinyrustlm.decoder-transformer/1",
  attention: "tinyrustlm.causal-gqa/1",
  kv: "tinyrustlm.kv-f32/1",
  minimumRuntime: "tinyrustlm.runtime/2.0",
  normalization: "tinyrustlm.rmsnorm/1",
  operator: "tinyrustlm.decoder-q8-row-symmetric-f32-accumulate/1",
  position: "tinyrustlm.rope/1",
  quantizer: "tinyrustlm.quantize-q8-row-symmetric-f32/1",
  role: "tinyrustlm.decoder-matrix-q8-normalization-bias-f32-roles/1",
  scalarKernel: "tinyrustlm.matmul-q8-row-f32-scalar/1",
  storage: "tinyrustlm.weight-q8-row-symmetric-f32-scale/1",
  tensor: "tinyrustlm.tensor-mixed-q8-row-f32/1"
});
const Q8_ROLES = new Set([
  "model.token-embedding.weight",
  "model.output-projection.weight",
  "layer.attention.query-projection.weight",
  "layer.attention.key-projection.weight",
  "layer.attention.value-projection.weight",
  "layer.attention.output-projection.weight",
  "layer.feed-forward.gate-projection.weight",
  "layer.feed-forward.down-projection.weight",
  "layer.feed-forward.up-projection.weight"
]);
const F32_ROLES = new Set([
  "model.final-normalization.weight",
  "layer.attention-normalization.weight",
  "layer.feed-forward-normalization.weight",
  "layer.attention.query-normalization.weight",
  "layer.attention.key-normalization.weight",
  "layer.attention.query-projection.bias",
  "layer.attention.key-projection.bias",
  "layer.attention.value-projection.bias"
]);

const TOP_LEVEL = Object.freeze([
  ["model.token-embedding.weight", "model.token-embedding.weight", "always", ["vocabularySize", "embeddingSize"]],
  ["model.final-normalization.weight", "model.final-normalization.weight", "always", ["embeddingSize"]],
  ["model.output-projection.weight", "model.output-projection.weight", "untied", ["vocabularySize", "embeddingSize"]]
]);
const PER_LAYER = Object.freeze([
  ["layer.attention-normalization.weight", "model.layers.{layer}.attention-normalization.weight", "always", ["embeddingSize"]],
  ["layer.feed-forward-normalization.weight", "model.layers.{layer}.feed-forward-normalization.weight", "always", ["embeddingSize"]],
  ["layer.attention.query-projection.weight", "model.layers.{layer}.attention.query-projection.weight", "always", ["queryWidth", "embeddingSize"]],
  ["layer.attention.key-projection.weight", "model.layers.{layer}.attention.key-projection.weight", "always", ["kvWidth", "embeddingSize"]],
  ["layer.attention.value-projection.weight", "model.layers.{layer}.attention.value-projection.weight", "always", ["kvWidth", "embeddingSize"]],
  ["layer.attention.output-projection.weight", "model.layers.{layer}.attention.output-projection.weight", "always", ["embeddingSize", "queryWidth"]],
  ["layer.feed-forward.gate-projection.weight", "model.layers.{layer}.feed-forward.gate-projection.weight", "always", ["feedForwardSize", "embeddingSize"]],
  ["layer.feed-forward.down-projection.weight", "model.layers.{layer}.feed-forward.down-projection.weight", "always", ["embeddingSize", "feedForwardSize"]],
  ["layer.feed-forward.up-projection.weight", "model.layers.{layer}.feed-forward.up-projection.weight", "always", ["feedForwardSize", "embeddingSize"]],
  ["layer.attention.query-projection.bias", "model.layers.{layer}.attention.query-projection.bias", "qkvBias", ["queryWidth"]],
  ["layer.attention.key-projection.bias", "model.layers.{layer}.attention.key-projection.bias", "qkvBias", ["kvWidth"]],
  ["layer.attention.value-projection.bias", "model.layers.{layer}.attention.value-projection.bias", "qkvBias", ["kvWidth"]],
  ["layer.attention.query-normalization.weight", "model.layers.{layer}.attention.query-normalization.weight", "qkNormalization", ["headDimension"]],
  ["layer.attention.key-normalization.weight", "model.layers.{layer}.attention.key-normalization.weight", "qkNormalization", ["headDimension"]]
]);

class Slm2Q8Error extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new Slm2Q8Error(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function sha256(...parts) {
  const hasher = crypto.createHash("sha256");
  parts.forEach((part) => hasher.update(part));
  return hasher.digest();
}

function sha256Hex(...parts) {
  return sha256(...parts).toString("hex");
}

function ensureRange(bytes, offset, length, code = "slm2-truncated-section") {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset + length > bytes.length) fail(code);
}

function readU16(bytes, offset) {
  ensureRange(bytes, offset, 2);
  return bytes.readUInt16LE(offset);
}

function readI16(bytes, offset) {
  ensureRange(bytes, offset, 2);
  return bytes.readInt16LE(offset);
}

function readU32(bytes, offset) {
  ensureRange(bytes, offset, 4);
  return bytes.readUInt32LE(offset);
}

function readI32(bytes, offset) {
  ensureRange(bytes, offset, 4);
  return bytes.readInt32LE(offset);
}

function readU64(bytes, offset) {
  ensureRange(bytes, offset, 8);
  const value = bytes.readBigUInt64LE(offset);
  if (value > MAX_SAFE_BIGINT) fail("slm2-offset-overflow");
  return Number(value);
}

function leU8(value) {
  return Buffer.from([value]);
}

function leU16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

function leI16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeInt16LE(value);
  return bytes;
}

function leU32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function leI32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeInt32LE(value);
  return bytes;
}

function leU64(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
}

function alignUp(value, alignment) {
  invariant(Number.isSafeInteger(value) && value >= 0
    && Number.isSafeInteger(alignment) && alignment > 0
    && (alignment & (alignment - 1)) === 0, "slm2-invalid-alignment");
  const result = Math.ceil(value / alignment) * alignment;
  invariant(Number.isSafeInteger(result), "slm2-offset-overflow");
  return result;
}

function checkedAdd(left, right) {
  const value = left + right;
  invariant(Number.isSafeInteger(value) && value >= 0, "slm2-offset-overflow");
  return value;
}

function checkedMultiply(left, right) {
  const value = left * right;
  invariant(Number.isSafeInteger(value) && value >= 0, "slm2-offset-overflow");
  return value;
}

function f32(value) {
  const rounded = Math.fround(value);
  invariant(Number.isFinite(rounded), "slm2-nonfinite-f32");
  return rounded;
}

function f32Bits(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatLE(f32(value));
  return bytes.readUInt32LE(0);
}

function f32FromBits(bits) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(bits);
  return bytes.readFloatLE(0);
}

function encodeF32(values) {
  const bytes = Buffer.alloc(checkedMultiply(values.length, 4));
  values.forEach((value, index) => bytes.writeFloatLE(f32(value), index * 4));
  return bytes;
}

function roundHalfAwayFromZero(value) {
  invariant(Number.isFinite(value), "slm2-invalid-q8-source");
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

function quantizeRow(source) {
  invariant(Array.isArray(source) && source.length > 0, "slm2-invalid-q8-source");
  const values = source.map(f32);
  let maximum = 0;
  for (const value of values) maximum = Math.max(maximum, Math.abs(value));
  const scale = maximum === 0 ? f32(1) : f32(maximum / f32(127));
  invariant(Number.isFinite(scale) && scale > 0 && !Object.is(scale, -0),
    "slm2-invalid-q8-scale");
  const codes = values.map((value) => {
    const normalized = f32(value / scale);
    const rounded = roundHalfAwayFromZero(normalized);
    const clamped = Math.max(-127, Math.min(127, rounded));
    const code = clamped === 0 ? 0 : clamped;
    invariant(code >= -127 && code <= 127, "slm2-invalid-q8-code");
    return code;
  });
  if (codes.every((code) => code === 0)) {
    invariant(f32Bits(scale) === 0x3f80_0000, "slm2-invalid-q8-scale");
  }
  return { scale, scaleBits: f32Bits(scale), codes };
}

function encodeQ8Rows(values, rows, columns) {
  invariant(values.length === checkedMultiply(rows, columns), "slm2-tensor-size-mismatch");
  const rowBytes = checkedAdd(columns, 4);
  const output = Buffer.alloc(checkedMultiply(rows, rowBytes));
  const quantizedRows = [];
  for (let row = 0; row < rows; row += 1) {
    const quantized = quantizeRow(values.slice(row * columns, (row + 1) * columns));
    const offset = row * rowBytes;
    output.writeUInt32LE(quantized.scaleBits, offset);
    quantized.codes.forEach((code, column) => output.writeInt8(code, offset + 4 + column));
    quantizedRows.push(quantized);
  }
  return { bytes: output, rows: quantizedRows };
}

function q8Matvec(payload, rows, columns, input) {
  invariant(Buffer.isBuffer(payload)
    && payload.length === checkedMultiply(rows, checkedAdd(columns, 4))
    && input.length === columns, "slm2-q8-matvec-shape");
  const inputF32 = input.map(f32);
  const output = [];
  const rowBytes = columns + 4;
  for (let row = 0; row < rows; row += 1) {
    const rowOffset = row * rowBytes;
    const scale = payload.readFloatLE(rowOffset);
    invariant(Number.isFinite(scale) && scale > 0, "slm2-invalid-q8-payload");
    let sum = f32(0);
    for (let column = 0; column < columns; column += 1) {
      const code = payload.readInt8(rowOffset + 4 + column);
      invariant(code !== -128, "slm2-invalid-q8-payload");
      const dequantized = f32(scale * f32(code));
      const term = f32(inputF32[column] * dequantized);
      sum = f32(sum + term);
    }
    output.push(sum);
  }
  return output;
}

function encodeHead(major, value) {
  invariant(Number.isSafeInteger(value) && value >= 0, "slm2-invalid-metadata");
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value <= 0xff) return Buffer.from([(major << 5) | 24, value]);
  if (value <= 0xffff) {
    const output = Buffer.alloc(3);
    output[0] = (major << 5) | 25;
    output.writeUInt16BE(value, 1);
    return output;
  }
  if (value <= 0xffff_ffff) {
    const output = Buffer.alloc(5);
    output[0] = (major << 5) | 26;
    output.writeUInt32BE(value, 1);
    return output;
  }
  const output = Buffer.alloc(9);
  output[0] = (major << 5) | 27;
  output.writeBigUInt64BE(BigInt(value), 1);
  return output;
}

function encodeDcbor(value) {
  if (value === false) return Buffer.from([0xf4]);
  if (value === true) return Buffer.from([0xf5]);
  if (Number.isSafeInteger(value) && value >= 0) return encodeHead(0, value);
  if (Buffer.isBuffer(value)) return Buffer.concat([encodeHead(2, value.length), value]);
  if (typeof value === "string") {
    invariant(/^[\x20-\x7e]*$/u.test(value), "slm2-invalid-metadata");
    const bytes = Buffer.from(value, "ascii");
    return Buffer.concat([encodeHead(3, bytes.length), bytes]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([encodeHead(4, value.length), ...value.map(encodeDcbor)]);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, child]) => {
      const encodedKey = encodeDcbor(key);
      return { encodedKey, encodedValue: encodeDcbor(child) };
    }).sort((left, right) => left.encodedKey.length - right.encodedKey.length
      || Buffer.compare(left.encodedKey, right.encodedKey));
    for (let index = 1; index < entries.length; index += 1) {
      invariant(Buffer.compare(entries[index - 1].encodedKey, entries[index].encodedKey) !== 0,
        "slm2-invalid-metadata");
    }
    return Buffer.concat([encodeHead(5, entries.length),
      ...entries.flatMap((entry) => [entry.encodedKey, entry.encodedValue])]);
  }
  fail("slm2-invalid-metadata");
}

function decodeDcbor(bytes) {
  const state = { bytes, offset: 0, items: 0 };
  function read(count) {
    ensureRange(state.bytes, state.offset, count, "slm2-invalid-metadata");
    const output = state.bytes.subarray(state.offset, state.offset + count);
    state.offset += count;
    return output;
  }
  function argument(additional) {
    if (additional < 24) return additional;
    let value;
    if (additional === 24) value = read(1).readUInt8(0);
    else if (additional === 25) value = read(2).readUInt16BE(0);
    else if (additional === 26) value = read(4).readUInt32BE(0);
    else if (additional === 27) {
      const big = read(8).readBigUInt64BE(0);
      if (big > MAX_SAFE_BIGINT) fail("slm2-invalid-metadata");
      value = Number(big);
    } else fail("slm2-invalid-metadata");
    if ((additional === 24 && value < 24)
        || (additional === 25 && value <= 0xff)
        || (additional === 26 && value <= 0xffff)
        || (additional === 27 && value <= 0xffff_ffff)) fail("slm2-invalid-metadata");
    return value;
  }
  function parse(depth) {
    if (depth > 16 || ++state.items > 65_536) fail("slm2-invalid-metadata");
    const initial = read(1)[0];
    const major = initial >> 5;
    const additional = initial & 31;
    if (major === 7) {
      if (additional === 20) return false;
      if (additional === 21) return true;
      fail("slm2-invalid-metadata");
    }
    const length = argument(additional);
    if (major === 0) return length;
    if (major === 2) {
      if (length > 4_194_304) fail("slm2-invalid-metadata");
      return Buffer.from(read(length));
    }
    if (major === 3) {
      if (length > 16_384) fail("slm2-invalid-metadata");
      const value = read(length);
      if (value.some((byte) => byte < 0x20 || byte > 0x7e)) fail("slm2-invalid-metadata");
      return value.toString("ascii");
    }
    if (major === 4) {
      if (length > 65_536) fail("slm2-invalid-metadata");
      return Array.from({ length }, () => parse(depth + 1));
    }
    if (major === 5) {
      if (length > 4_096) fail("slm2-invalid-metadata");
      const output = {};
      let priorKeyBytes = null;
      for (let index = 0; index < length; index += 1) {
        const keyStart = state.offset;
        const key = parse(depth + 1);
        const keyBytes = state.bytes.subarray(keyStart, state.offset);
        if (typeof key !== "string"
            || priorKeyBytes !== null && (priorKeyBytes.length > keyBytes.length
              || priorKeyBytes.length === keyBytes.length
                && Buffer.compare(priorKeyBytes, keyBytes) >= 0)
            || Object.hasOwn(output, key)) fail("slm2-invalid-metadata");
        output[key] = parse(depth + 1);
        priorKeyBytes = keyBytes;
      }
      return output;
    }
    fail("slm2-invalid-metadata");
  }
  const value = parse(0);
  if (state.offset !== state.bytes.length) fail("slm2-invalid-metadata");
  return value;
}

function exactObject(value, keys, code = "slm2-invalid-model-metadata") {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value)
    && !Buffer.isBuffer(value), code);
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), code);
  return value;
}

function validIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 255
    && /^[a-z0-9][a-z0-9._/-]*$/u.test(value)
    && !value.startsWith("/") && !value.endsWith("/")
    && !value.split("/").some((part) => part === "" || part === "." || part === "..");
}

function validateSpec(spec) {
  const numeric = ["vocabularySize", "contextLength", "embeddingSize", "feedForwardSize",
    "layerCount", "headCount", "kvHeadCount", "headDimension"];
  invariant(numeric.every((key) => Number.isInteger(spec[key]) && spec[key] > 0
      && spec[key] <= 0xffff_ffff)
    && spec.kvHeadCount <= spec.headCount
    && spec.headCount % spec.kvHeadCount === 0
    && Number.isFinite(spec.ropeTheta) && spec.ropeTheta > 0
    && Number.isFinite(spec.normalizationEpsilon) && spec.normalizationEpsilon > 0,
  "slm2-invalid-model-metadata");
  spec.queryWidth = checkedMultiply(spec.headCount, spec.headDimension);
  spec.kvWidth = checkedMultiply(spec.kvHeadCount, spec.headDimension);
  return spec;
}

function roleEnabled(condition, spec) {
  return condition === "always" || condition === "untied" && !spec.tiedEmbeddings
    || condition === "qkvBias" && spec.qkvBias
    || condition === "qkNormalization" && spec.qkNormalization;
}

function requiredTensors(rawSpec) {
  const spec = validateSpec({ ...rawSpec });
  const output = [];
  function append(definition, layer) {
    const [semanticRole, namePattern, condition, symbols] = definition;
    if (!roleEnabled(condition, spec)) return;
    const canonicalName = namePattern.replace("{layer}", String(layer));
    const shape = symbols.map((symbol) => spec[symbol]);
    const q8 = Q8_ROLES.has(semanticRole);
    invariant(q8 !== F32_ROLES.has(semanticRole) && (!q8 || shape.length === 2),
      "slm2-invalid-tensor-registry");
    const logicalElements = shape.reduce(checkedMultiply, 1);
    const storedBytes = q8
      ? checkedMultiply(shape[0], checkedAdd(shape[1], 4))
      : checkedMultiply(logicalElements, 4);
    output.push({
      semanticRole,
      canonicalName,
      layer,
      subindex0: -1,
      subindex1: -1,
      rank: shape.length,
      shape,
      shape8: [...shape, ...Array(8 - shape.length).fill(0)],
      logicalElements,
      storedBytes,
      payloadAlignment: 64,
      elementType: q8 ? 2 : 1,
      quantProfileIndex: q8 ? 0 : 0xffff,
      blockElements: q8 ? shape[1] : 0,
      blockBytes: q8 ? shape[1] + 4 : 0,
      scaleType: q8 ? 1 : 0,
      zeroPointType: 0,
      packingOrder: q8 ? 1 : 0,
      accumulatorType: q8 ? 1 : 0,
      tailRule: q8 ? 1 : 0,
      flags: 0,
      flags2: 0,
      auxiliaryFirst: 0,
      auxiliaryCount: 0
    });
  }
  TOP_LEVEL.forEach((definition) => append(definition, -1));
  for (let layer = 0; layer < spec.layerCount; layer += 1) {
    PER_LAYER.forEach((definition) => append(definition, layer));
  }
  output.sort((left, right) => Buffer.compare(Buffer.from(left.semanticRole), Buffer.from(right.semanticRole))
    || left.layer - right.layer || left.subindex0 - right.subindex0 || left.subindex1 - right.subindex1
    || Buffer.compare(Buffer.from(left.canonicalName), Buffer.from(right.canonicalName)));
  invariant(output.length > 0 && output.length <= MAXIMUM_TENSORS, "slm2-invalid-tensor-count");
  return output;
}

function sourceValues(tensor, tensorIndex) {
  const count = tensor.logicalElements;
  if (tensor.elementType === 1) {
    const normalization = tensor.semanticRole.includes("normalization");
    return Array.from({ length: count }, (_, index) => f32(
      normalization ? 1 + (tensorIndex + 1) / 1024 + index / 8192
        : ((tensorIndex + 1) * 0.01) + ((index % 7) - 3) * 0.0025
    ));
  }
  const [rows, columns] = tensor.shape;
  const values = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let value;
      if (tensor.semanticRole === "model.token-embedding.weight" && row === 0) {
        value = column % 2 === 0 ? 0 : -0;
      } else if (tensor.semanticRole === "model.token-embedding.weight" && row === 1) {
        value = [127, 0.5, -0.5, -127, 63.5, -63.5, 31.75, -31.75][column % 8];
      } else {
        const magnitude = (tensorIndex + 1) * 0.125 + (row + 1) * 0.03125
          + (column + 1) * 0.0078125;
        value = (tensorIndex + row + column) % 2 === 0 ? magnitude : -magnitude;
      }
      values.push(f32(value));
    }
  }
  return values;
}

function updateIdentifier(hasher, value) {
  invariant(validIdentifier(value), "slm2-invalid-identifier");
  const bytes = Buffer.from(value, "ascii");
  hasher.update(leU32(bytes.length));
  hasher.update(bytes);
}

function updateDescriptor(hasher, tensor) {
  updateIdentifier(hasher, tensor.semanticRole);
  updateIdentifier(hasher, tensor.canonicalName);
  hasher.update(leI32(tensor.layer));
  hasher.update(leI32(tensor.subindex0));
  hasher.update(leI32(tensor.subindex1));
  hasher.update(leU32(tensor.rank));
  tensor.shape8.forEach((dimension) => hasher.update(leU64(dimension)));
  hasher.update(leU64(tensor.logicalElements));
  hasher.update(leU16(tensor.elementType));
  hasher.update(leU16(tensor.quantProfileIndex));
  hasher.update(leU64(tensor.storedBytes));
  hasher.update(leU32(tensor.payloadAlignment));
  hasher.update(leU32(tensor.blockElements));
  hasher.update(leU32(tensor.blockBytes));
  hasher.update(leU16(tensor.scaleType));
  hasher.update(leU16(tensor.zeroPointType));
  hasher.update(leU16(tensor.packingOrder));
  hasher.update(leU16(tensor.accumulatorType));
  hasher.update(leU16(tensor.tailRule));
  hasher.update(leU8(tensor.flags));
  hasher.update(leU16(tensor.flags2));
  hasher.update(leU32(tensor.auxiliaryFirst));
  hasher.update(leU32(tensor.auxiliaryCount));
}

function layoutHash(artifactClass, tensors) {
  const hasher = crypto.createHash("sha256");
  hasher.update(LAYOUT_DOMAIN);
  hasher.update(leU16(artifactClass));
  hasher.update(leU32(tensors.length));
  tensors.forEach((tensor) => updateDescriptor(hasher, tensor));
  return hasher.digest();
}

function payloadHash(artifactClass, tensor, payload) {
  const hasher = crypto.createHash("sha256");
  hasher.update(PAYLOAD_DOMAIN);
  hasher.update(leU16(artifactClass));
  updateDescriptor(hasher, tensor);
  hasher.update(leU64(payload.length));
  hasher.update(payload);
  return hasher.digest();
}

function encodeStringTable(strings) {
  invariant(strings.length > 0 && strings.length <= MAXIMUM_STRINGS, "slm2-invalid-string-table");
  const encoded = strings.map((value) => {
    invariant(validIdentifier(value), "slm2-invalid-string-table");
    return Buffer.from(value, "ascii");
  });
  for (let index = 1; index < encoded.length; index += 1) {
    invariant(Buffer.compare(encoded[index - 1], encoded[index]) < 0, "slm2-invalid-string-table");
  }
  const pool = Buffer.concat(encoded);
  const prefix = Buffer.alloc(8 + (strings.length + 1) * 4);
  prefix.writeUInt32LE(strings.length, 0);
  prefix.writeUInt32LE(pool.length, 4);
  let offset = 0;
  prefix.writeUInt32LE(0, 8);
  encoded.forEach((value, index) => {
    offset += value.length;
    prefix.writeUInt32LE(offset, 8 + (index + 1) * 4);
  });
  const output = Buffer.concat([prefix, pool]);
  invariant(output.length <= MAXIMUM_STRING_TABLE_BYTES, "slm2-invalid-string-table");
  return output;
}

function decodeStringTable(bytes) {
  invariant(bytes.length >= 12 && bytes.length <= MAXIMUM_STRING_TABLE_BYTES,
    "slm2-invalid-string-table");
  const count = readU32(bytes, 0);
  const poolLength = readU32(bytes, 4);
  invariant(count > 0 && count <= MAXIMUM_STRINGS, "slm2-invalid-string-table");
  const poolStart = 8 + (count + 1) * 4;
  invariant(poolStart + poolLength === bytes.length && readU32(bytes, 8) === 0,
    "slm2-invalid-string-table");
  const strings = [];
  for (let index = 0; index < count; index += 1) {
    const start = readU32(bytes, 8 + index * 4);
    const end = readU32(bytes, 8 + (index + 1) * 4);
    invariant(start < end && end <= poolLength, "slm2-invalid-string-table");
    const value = bytes.subarray(poolStart + start, poolStart + end).toString("ascii");
    invariant(validIdentifier(value) && (index === 0
      || Buffer.compare(Buffer.from(strings[index - 1]), Buffer.from(value)) < 0),
    "slm2-invalid-string-table");
    strings.push(value);
  }
  invariant(readU32(bytes, 8 + count * 4) === poolLength, "slm2-invalid-string-table");
  return strings;
}

function manifestFor(spec, tensorLayoutSha256) {
  return {
    artifact_class: spec.artifactClass,
    body: {
      activation_profile: PROFILES.activation,
      architecture_profile: PROFILES.architecture,
      attention_profile: PROFILES.attention,
      context_length: spec.contextLength,
      embedding_size: spec.embeddingSize,
      feed_forward_size: spec.feedForwardSize,
      head_count: spec.headCount,
      head_dimension: spec.headDimension,
      kv_head_count: spec.kvHeadCount,
      layer_count: spec.layerCount,
      normalization_epsilon_bits: f32Bits(spec.normalizationEpsilon),
      normalization_profile: PROFILES.normalization,
      position_profile: PROFILES.position,
      qk_normalization: spec.qkNormalization,
      qkv_bias: spec.qkvBias,
      rope_theta_bits: f32Bits(spec.ropeTheta),
      tensor_layout_sha256: tensorLayoutSha256,
      tied_embeddings: spec.tiedEmbeddings,
      vocabulary_size: spec.vocabularySize
    },
    dependencies: [],
    extensions: [],
    requirements: {
      kv_profile: PROFILES.kv,
      minimum_runtime: PROFILES.minimumRuntime,
      operator_profile: PROFILES.operator,
      tensor_role_profile: PROFILES.role,
      tensor_profile: PROFILES.tensor
    },
    schema: SCHEMA
  };
}

function decodeManifest(bytes, artifactClass) {
  const top = exactObject(decodeDcbor(bytes), ["artifact_class", "body", "dependencies",
    "extensions", "requirements", "schema"]);
  invariant(top.artifact_class === artifactClass && top.schema === SCHEMA
    && Array.isArray(top.dependencies) && top.dependencies.length === 0
    && Array.isArray(top.extensions) && top.extensions.length === 0,
  "slm2-invalid-model-metadata");
  const requirements = exactObject(top.requirements, ["kv_profile", "minimum_runtime",
    "operator_profile", "tensor_role_profile", "tensor_profile"]);
  invariant(requirements.kv_profile === PROFILES.kv
    && requirements.minimum_runtime === PROFILES.minimumRuntime
    && requirements.operator_profile === PROFILES.operator
    && requirements.tensor_role_profile === PROFILES.role
    && requirements.tensor_profile === PROFILES.tensor, "slm2-invalid-model-metadata");
  const body = exactObject(top.body, ["activation_profile", "architecture_profile",
    "attention_profile", "context_length", "embedding_size", "feed_forward_size",
    "head_count", "head_dimension", "kv_head_count", "layer_count",
    "normalization_epsilon_bits", "normalization_profile", "position_profile",
    "qk_normalization", "qkv_bias", "rope_theta_bits", "tensor_layout_sha256",
    "tied_embeddings", "vocabulary_size"]);
  invariant(body.activation_profile === PROFILES.activation
    && body.architecture_profile === PROFILES.architecture
    && body.attention_profile === PROFILES.attention
    && body.normalization_profile === PROFILES.normalization
    && body.position_profile === PROFILES.position
    && Buffer.isBuffer(body.tensor_layout_sha256) && body.tensor_layout_sha256.length === 32
    && body.tensor_layout_sha256.some((byte) => byte !== 0), "slm2-invalid-model-metadata");
  const spec = validateSpec({
    artifactClass,
    vocabularySize: body.vocabulary_size,
    contextLength: body.context_length,
    embeddingSize: body.embedding_size,
    feedForwardSize: body.feed_forward_size,
    layerCount: body.layer_count,
    headCount: body.head_count,
    kvHeadCount: body.kv_head_count,
    headDimension: body.head_dimension,
    ropeTheta: f32FromBits(body.rope_theta_bits),
    normalizationEpsilon: f32FromBits(body.normalization_epsilon_bits),
    tiedEmbeddings: body.tied_embeddings,
    qkvBias: body.qkv_bias,
    qkNormalization: body.qk_normalization
  });
  invariant([spec.tiedEmbeddings, spec.qkvBias, spec.qkNormalization]
    .every((value) => typeof value === "boolean"), "slm2-invalid-model-metadata");
  return { spec, tensorLayoutSha256: body.tensor_layout_sha256 };
}

function encodeQuantRecord(stringIds) {
  const bytes = Buffer.alloc(QUANT_RECORD_BYTES);
  bytes.writeUInt16LE(1, 0);
  bytes.writeUInt32LE(stringIds.get(PROFILES.storage), 4);
  bytes.writeUInt32LE(stringIds.get(PROFILES.quantizer), 8);
  bytes.writeUInt32LE(stringIds.get(PROFILES.scalarKernel), 12);
  bytes.writeUInt32LE(stringIds.get(PROFILES.role), 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt16LE(8, 24);
  bytes.writeUInt16LE(1, 26);
  bytes.writeInt16LE(-127, 28);
  bytes.writeInt16LE(127, 30);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(1, 36);
  bytes.writeUInt16LE(1, 38);
  bytes.writeUInt16LE(1, 40);
  bytes.writeUInt16LE(1, 42);
  bytes.writeUInt32LE(0x42fe_0000, 48);
  bytes.writeUInt32LE(0x3f80_0000, 52);
  return bytes;
}

function decodeQuantRecord(bytes, strings) {
  invariant(bytes.length === QUANT_RECORD_BYTES
    && readU16(bytes, 0) === 1 && readU16(bytes, 2) === 0
    && readU16(bytes, 20) === 1 && readU16(bytes, 22) === 2
    && readU16(bytes, 24) === 8 && readU16(bytes, 26) === 1
    && readI16(bytes, 28) === -127 && readI16(bytes, 30) === 127
    && readU16(bytes, 32) === 1 && readU16(bytes, 34) === 0
    && readU16(bytes, 36) === 1 && readU16(bytes, 38) === 1
    && readU16(bytes, 40) === 1 && readU16(bytes, 42) === 1
    && readU16(bytes, 44) === 0 && readU16(bytes, 46) === 0
    && readU32(bytes, 48) === 0x42fe_0000 && readU32(bytes, 52) === 0x3f80_0000
    && bytes.subarray(56).every((byte) => byte === 0), "slm2-invalid-quantization");
  const expected = [PROFILES.storage, PROFILES.quantizer, PROFILES.scalarKernel, PROFILES.role];
  [4, 8, 12, 16].forEach((offset, index) => {
    const id = readU32(bytes, offset);
    invariant(id < strings.length && strings[id] === expected[index], "slm2-invalid-quantization");
  });
  return {
    storageProfile: strings[readU32(bytes, 4)],
    quantizerProfile: strings[readU32(bytes, 8)],
    scalarKernelProfile: strings[readU32(bytes, 12)],
    roleProfile: strings[readU32(bytes, 16)]
  };
}

function encodeTensorRecord(tensor, roleId, nameId) {
  const bytes = Buffer.alloc(TENSOR_RECORD_BYTES);
  bytes.writeUInt16LE(1, 0);
  bytes[2] = tensor.rank;
  bytes[3] = tensor.flags;
  bytes.writeUInt16LE(tensor.elementType, 4);
  bytes.writeUInt16LE(tensor.quantProfileIndex, 6);
  bytes.writeUInt32LE(roleId, 8);
  bytes.writeUInt32LE(nameId, 12);
  bytes.writeInt32LE(tensor.layer, 16);
  bytes.writeInt32LE(tensor.subindex0, 20);
  bytes.writeInt32LE(tensor.subindex1, 24);
  tensor.shape8.forEach((dimension, index) => bytes.writeBigUInt64LE(BigInt(dimension), 32 + index * 8));
  bytes.writeBigUInt64LE(BigInt(tensor.logicalElements), 96);
  bytes.writeBigUInt64LE(BigInt(tensor.storedBytes), 104);
  bytes.writeBigUInt64LE(BigInt(tensor.payloadRelativeOffset), 112);
  bytes.writeBigUInt64LE(BigInt(tensor.storedBytes), 120);
  bytes.writeUInt32LE(tensor.payloadAlignment, 128);
  bytes.writeUInt32LE(tensor.blockElements, 132);
  bytes.writeUInt32LE(tensor.blockBytes, 136);
  bytes.writeUInt16LE(tensor.scaleType, 140);
  bytes.writeUInt16LE(tensor.zeroPointType, 142);
  bytes.writeUInt16LE(tensor.packingOrder, 144);
  bytes.writeUInt16LE(tensor.accumulatorType, 146);
  bytes.writeUInt16LE(tensor.tailRule, 148);
  bytes.writeUInt16LE(tensor.flags2, 150);
  bytes.writeUInt32LE(tensor.auxiliaryFirst, 152);
  bytes.writeUInt32LE(tensor.auxiliaryCount, 156);
  tensor.payloadSha256.copy(bytes, 160);
  return bytes;
}

function descriptorFromRecord(bytes, strings, payloadBase) {
  invariant(bytes.length === TENSOR_RECORD_BYTES && readU16(bytes, 0) === 1
    && bytes[3] === 0 && readU32(bytes, 28) === 0, "slm2-invalid-tensor");
  const roleId = readU32(bytes, 8);
  const nameId = readU32(bytes, 12);
  invariant(roleId < strings.length && nameId < strings.length, "slm2-invalid-tensor");
  const rank = bytes[2];
  invariant(rank <= 8, "slm2-invalid-tensor");
  const shape8 = Array.from({ length: 8 }, (_, index) => readU64(bytes, 32 + index * 8));
  invariant(shape8.slice(0, rank).every((value) => value > 0 && value <= 0xffff_ffff)
    && shape8.slice(rank).every((value) => value === 0), "slm2-invalid-tensor");
  const shape = shape8.slice(0, rank);
  const logicalElements = shape.reduce(checkedMultiply, 1);
  const tensor = {
    semanticRole: strings[roleId],
    canonicalName: strings[nameId],
    layer: readI32(bytes, 16),
    subindex0: readI32(bytes, 20),
    subindex1: readI32(bytes, 24),
    rank,
    shape,
    shape8,
    logicalElements,
    storedBytes: readU64(bytes, 104),
    payloadRelativeOffset: readU64(bytes, 112),
    payloadLength: readU64(bytes, 120),
    payloadAlignment: readU32(bytes, 128),
    elementType: readU16(bytes, 4),
    quantProfileIndex: readU16(bytes, 6),
    blockElements: readU32(bytes, 132),
    blockBytes: readU32(bytes, 136),
    scaleType: readU16(bytes, 140),
    zeroPointType: readU16(bytes, 142),
    packingOrder: readU16(bytes, 144),
    accumulatorType: readU16(bytes, 146),
    tailRule: readU16(bytes, 148),
    flags: bytes[3],
    flags2: readU16(bytes, 150),
    auxiliaryFirst: readU32(bytes, 152),
    auxiliaryCount: readU32(bytes, 156),
    payloadOffset: checkedAdd(payloadBase, readU64(bytes, 112)),
    payloadSha256: Buffer.from(bytes.subarray(160, 192))
  };
  invariant(validIdentifier(tensor.semanticRole) && validIdentifier(tensor.canonicalName)
    && tensor.layer >= -1 && tensor.subindex0 >= -1 && tensor.subindex1 >= -1
    && tensor.payloadAlignment >= 64 && tensor.payloadAlignment <= 4096
    && (tensor.payloadAlignment & (tensor.payloadAlignment - 1)) === 0
    && tensor.payloadSha256.some((byte) => byte !== 0), "slm2-invalid-tensor");
  const q8 = Q8_ROLES.has(tensor.semanticRole);
  const f32Role = F32_ROLES.has(tensor.semanticRole);
  invariant(q8 !== f32Role, "slm2-invalid-tensor-registry");
  if (q8) {
    invariant(rank === 2 && tensor.elementType === 2 && tensor.quantProfileIndex === 0
      && tensor.payloadLength === tensor.storedBytes
      && tensor.logicalElements === checkedMultiply(shape[0], shape[1])
      && tensor.storedBytes === checkedMultiply(shape[0], shape[1] + 4)
      && tensor.blockElements === shape[1] && tensor.blockBytes === shape[1] + 4
      && tensor.scaleType === 1 && tensor.zeroPointType === 0 && tensor.packingOrder === 1
      && tensor.accumulatorType === 1 && tensor.tailRule === 1 && tensor.flags2 === 0
      && tensor.auxiliaryFirst === 0 && tensor.auxiliaryCount === 0,
    "slm2-invalid-tensor-encoding");
  } else {
    invariant(tensor.elementType === 1 && tensor.quantProfileIndex === 0xffff
      && tensor.payloadLength === tensor.storedBytes
      && tensor.storedBytes === checkedMultiply(logicalElements, 4)
      && tensor.blockElements === 0 && tensor.blockBytes === 0 && tensor.scaleType === 0
      && tensor.zeroPointType === 0 && tensor.packingOrder === 0 && tensor.accumulatorType === 0
      && tensor.tailRule === 0 && tensor.flags2 === 0 && tensor.auxiliaryFirst === 0
      && tensor.auxiliaryCount === 0, "slm2-invalid-tensor-encoding");
  }
  return tensor;
}

function validateQ8Payload(payload, tensor) {
  const columns = tensor.shape[1];
  const rowBytes = columns + 4;
  for (let row = 0; row < tensor.shape[0]; row += 1) {
    const offset = row * rowBytes;
    const scaleBits = readU32(payload, offset);
    const scale = payload.readFloatLE(offset);
    invariant(Number.isFinite(scale) && scale > 0 && scaleBits !== 0x8000_0000,
      "slm2-invalid-q8-payload");
    let allZero = true;
    for (let column = 0; column < columns; column += 1) {
      const code = payload.readInt8(offset + 4 + column);
      invariant(code !== -128, "slm2-invalid-q8-payload");
      allZero = allZero && code === 0;
    }
    if (allZero) invariant(scaleBits === 0x3f80_0000, "slm2-invalid-q8-payload");
  }
}

function canonicalSpec() {
  return {
    artifactClass: 1,
    vocabularySize: 32,
    contextLength: 128,
    embeddingSize: 8,
    feedForwardSize: 16,
    layerCount: 1,
    headCount: 2,
    kvHeadCount: 1,
    headDimension: 8,
    ropeTheta: f32(10_000),
    normalizationEpsilon: f32(0.000_01),
    tiedEmbeddings: false,
    qkvBias: true,
    qkNormalization: true
  };
}

function writeCanonicalArtifact() {
  const spec = validateSpec(canonicalSpec());
  const tensors = requiredTensors(spec).map((tensor, index) => {
    const source = sourceValues(tensor, index);
    const encoded = tensor.elementType === 2
      ? encodeQ8Rows(source, tensor.shape[0], tensor.shape[1])
      : { bytes: encodeF32(source), rows: [] };
    invariant(encoded.bytes.length === tensor.storedBytes, "slm2-tensor-size-mismatch");
    return { ...tensor, source, payload: encoded.bytes, quantizedRows: encoded.rows };
  });
  const tensorLayoutSha256 = layoutHash(spec.artifactClass, tensors);
  const manifest = encodeDcbor(manifestFor(spec, tensorLayoutSha256));
  invariant(manifest.length > 0 && manifest.length <= MAXIMUM_MANIFEST_BYTES,
    "slm2-invalid-manifest-size");
  const stringSet = new Set([PROFILES.storage, PROFILES.quantizer, PROFILES.scalarKernel,
    PROFILES.role]);
  tensors.forEach((tensor) => {
    stringSet.add(tensor.semanticRole);
    stringSet.add(tensor.canonicalName);
  });
  const strings = [...stringSet].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const stringIds = new Map(strings.map((value, index) => [value, index]));
  const stringTable = encodeStringTable(strings);
  const quantTable = encodeQuantRecord(stringIds);
  const manifestOffset = alignUp(HEADER_BYTES, SECTION_ALIGNMENT);
  const stringTableOffset = alignUp(manifestOffset + manifest.length, SECTION_ALIGNMENT);
  const quantTableOffset = alignUp(stringTableOffset + stringTable.length, SECTION_ALIGNMENT);
  const tensorTableOffset = alignUp(quantTableOffset + quantTable.length, SECTION_ALIGNMENT);
  const payloadOffset = alignUp(tensorTableOffset + tensors.length * TENSOR_RECORD_BYTES,
    SECTION_ALIGNMENT);
  let cursor = payloadOffset;
  tensors.forEach((tensor) => {
    const absolute = alignUp(cursor, tensor.payloadAlignment);
    tensor.payloadRelativeOffset = absolute - payloadOffset;
    tensor.payloadSha256 = payloadHash(spec.artifactClass, tensor, tensor.payload);
    cursor = absolute + tensor.payload.length;
  });
  const artifact = Buffer.alloc(cursor);
  MAGIC.copy(artifact, 0);
  FORMAT_ID.copy(artifact, 8);
  artifact.writeUInt32LE(HEADER_BYTES, 24);
  artifact.writeUInt16LE(2, 28);
  artifact.writeUInt32LE(0x0102_0304, 32);
  artifact.writeUInt16LE(spec.artifactClass, 36);
  artifact.writeBigUInt64LE(BigInt(artifact.length), 40);
  artifact.writeBigUInt64LE(BigInt(manifestOffset), 48);
  artifact.writeBigUInt64LE(BigInt(manifest.length), 56);
  artifact.writeBigUInt64LE(BigInt(stringTableOffset), 64);
  artifact.writeBigUInt64LE(BigInt(stringTable.length), 72);
  artifact.writeBigUInt64LE(BigInt(quantTableOffset), 80);
  artifact.writeUInt32LE(1, 88);
  artifact.writeUInt32LE(QUANT_RECORD_BYTES, 92);
  artifact.writeBigUInt64LE(BigInt(tensorTableOffset), 96);
  artifact.writeUInt32LE(tensors.length, 104);
  artifact.writeUInt32LE(TENSOR_RECORD_BYTES, 108);
  artifact.writeBigUInt64LE(BigInt(payloadOffset), 144);
  artifact.writeBigUInt64LE(BigInt(artifact.length - payloadOffset), 152);
  manifest.copy(artifact, manifestOffset);
  stringTable.copy(artifact, stringTableOffset);
  quantTable.copy(artifact, quantTableOffset);
  tensors.forEach((tensor, index) => {
    encodeTensorRecord(tensor, stringIds.get(tensor.semanticRole), stringIds.get(tensor.canonicalName))
      .copy(artifact, tensorTableOffset + index * TENSOR_RECORD_BYTES);
    tensor.payload.copy(artifact, payloadOffset + tensor.payloadRelativeOffset);
  });
  const parsed = parseArtifact(artifact);
  invariant(parsed.tensorLayoutSha256.equals(tensorLayoutSha256), "slm2-layout-hash-drift");
  return { artifact, manifest, quantTable, spec, strings, tensors, parsed };
}

function assertZero(bytes, start, end) {
  ensureRange(bytes, start, end - start);
  invariant(bytes.subarray(start, end).every((byte) => byte === 0), "slm2-nonzero-padding");
}

function parseArtifact(bytes) {
  invariant(Buffer.isBuffer(bytes), "slm2-invalid-input");
  if (bytes.length < HEADER_BYTES) fail("slm2-truncated-header");
  invariant(bytes.subarray(0, 8).equals(MAGIC), "slm2-invalid-magic");
  invariant(bytes.subarray(8, 24).equals(FORMAT_ID), "slm2-invalid-format-id");
  invariant(readU32(bytes, 24) === HEADER_BYTES, "slm2-invalid-header-size");
  invariant(readU16(bytes, 28) === 2 && readU16(bytes, 30) === 0, "slm2-unsupported-version");
  invariant(readU32(bytes, 32) === 0x0102_0304, "slm2-invalid-byte-order");
  const artifactClass = readU16(bytes, 36);
  invariant([1, 2].includes(artifactClass), "slm2-unsupported-artifact-class");
  invariant(readU16(bytes, 38) === 0 && bytes.subarray(112, 144).every((byte) => byte === 0)
    && bytes.subarray(160, 224).every((byte) => byte === 0), "slm2-invalid-header-flags");
  invariant(readU64(bytes, 40) === bytes.length, "slm2-file-size-mismatch");
  const header = {
    artifactClass,
    fileSize: bytes.length,
    manifestOffset: readU64(bytes, 48),
    manifestLength: readU64(bytes, 56),
    stringTableOffset: readU64(bytes, 64),
    stringTableLength: readU64(bytes, 72),
    quantTableOffset: readU64(bytes, 80),
    quantCount: readU32(bytes, 88),
    quantRecordBytes: readU32(bytes, 92),
    tensorTableOffset: readU64(bytes, 96),
    tensorCount: readU32(bytes, 104),
    tensorRecordBytes: readU32(bytes, 108),
    payloadOffset: readU64(bytes, 144),
    payloadLength: readU64(bytes, 152)
  };
  invariant(header.manifestLength > 0 && header.manifestLength <= MAXIMUM_MANIFEST_BYTES
    && header.stringTableLength > 0 && header.stringTableLength <= MAXIMUM_STRING_TABLE_BYTES
    && header.quantCount === 1 && header.quantRecordBytes === QUANT_RECORD_BYTES
    && header.tensorCount > 0 && header.tensorCount <= MAXIMUM_TENSORS
    && header.tensorRecordBytes === TENSOR_RECORD_BYTES, "slm2-invalid-quantization");
  const expectedManifest = alignUp(HEADER_BYTES, SECTION_ALIGNMENT);
  const expectedStrings = alignUp(header.manifestOffset + header.manifestLength, SECTION_ALIGNMENT);
  const expectedQuant = alignUp(header.stringTableOffset + header.stringTableLength, SECTION_ALIGNMENT);
  const expectedTensors = alignUp(header.quantTableOffset + QUANT_RECORD_BYTES, SECTION_ALIGNMENT);
  const expectedPayload = alignUp(header.tensorTableOffset
    + header.tensorCount * TENSOR_RECORD_BYTES, SECTION_ALIGNMENT);
  invariant(header.manifestOffset === expectedManifest && header.stringTableOffset === expectedStrings
    && header.quantTableOffset === expectedQuant && header.tensorTableOffset === expectedTensors
    && header.payloadOffset === expectedPayload && header.payloadLength > 0
    && header.payloadOffset + header.payloadLength === bytes.length, "slm2-invalid-section-layout");
  assertZero(bytes, HEADER_BYTES, header.manifestOffset);
  assertZero(bytes, header.manifestOffset + header.manifestLength, header.stringTableOffset);
  assertZero(bytes, header.stringTableOffset + header.stringTableLength, header.quantTableOffset);
  assertZero(bytes, header.quantTableOffset + QUANT_RECORD_BYTES, header.tensorTableOffset);
  assertZero(bytes, header.tensorTableOffset + header.tensorCount * TENSOR_RECORD_BYTES,
    header.payloadOffset);
  const manifestBytes = bytes.subarray(header.manifestOffset,
    header.manifestOffset + header.manifestLength);
  const { spec, tensorLayoutSha256 } = decodeManifest(manifestBytes, artifactClass);
  const strings = decodeStringTable(bytes.subarray(header.stringTableOffset,
    header.stringTableOffset + header.stringTableLength));
  const quantization = decodeQuantRecord(bytes.subarray(header.quantTableOffset,
    header.quantTableOffset + QUANT_RECORD_BYTES), strings);
  const tensors = [];
  for (let index = 0; index < header.tensorCount; index += 1) {
    const offset = header.tensorTableOffset + index * TENSOR_RECORD_BYTES;
    tensors.push(descriptorFromRecord(bytes.subarray(offset, offset + TENSOR_RECORD_BYTES),
      strings, header.payloadOffset));
  }
  const expected = requiredTensors(spec);
  invariant(tensors.length === expected.length, "slm2-invalid-tensor-registry");
  tensors.forEach((tensor, index) => {
    const expectedTensor = expected[index];
    invariant(tensor.semanticRole === expectedTensor.semanticRole
      && tensor.canonicalName === expectedTensor.canonicalName && tensor.layer === expectedTensor.layer
      && tensor.subindex0 === -1 && tensor.subindex1 === -1
      && JSON.stringify(tensor.shape) === JSON.stringify(expectedTensor.shape),
    "slm2-invalid-tensor-registry");
    if (index > 0) {
      const prior = tensors[index - 1];
      invariant(prior.semanticRole < tensor.semanticRole
        || prior.semanticRole === tensor.semanticRole && prior.layer < tensor.layer,
      "slm2-invalid-tensor-order");
    }
  });
  invariant(layoutHash(artifactClass, tensors).equals(tensorLayoutSha256), "slm2-layout-hash-drift");
  let cursor = header.payloadOffset;
  tensors.forEach((tensor) => {
    const expectedOffset = alignUp(cursor, tensor.payloadAlignment);
    invariant(tensor.payloadOffset === expectedOffset, "slm2-invalid-payload-layout");
    assertZero(bytes, cursor, tensor.payloadOffset);
    ensureRange(bytes, tensor.payloadOffset, tensor.payloadLength);
    const payload = bytes.subarray(tensor.payloadOffset, tensor.payloadOffset + tensor.payloadLength);
    if (tensor.elementType === 2) validateQ8Payload(payload, tensor);
    else {
      for (let offset = 0; offset < payload.length; offset += 4) {
        invariant(Number.isFinite(payload.readFloatLE(offset)), "slm2-nonfinite-f32");
      }
    }
    invariant(payloadHash(artifactClass, tensor, payload).equals(tensor.payloadSha256),
      "slm2-payload-hash-drift");
    tensor.payload = payload;
    cursor = tensor.payloadOffset + tensor.payloadLength;
  });
  invariant(cursor === bytes.length, "slm2-trailing-bytes");
  return {
    artifactSha256: sha256(bytes),
    header,
    manifestSha256: sha256(manifestBytes),
    quantization,
    spec,
    strings,
    tensorLayoutSha256,
    tensors
  };
}

function mutation(id, operation, offset, value, expectedError) {
  return { id, operation, offset, value, expectedError };
}

function applyMutation(source, entry) {
  let bytes = Buffer.from(source);
  if (entry.operation === "xor-byte") bytes[entry.offset] ^= entry.value;
  else if (entry.operation === "set-u8") bytes.writeUInt8(entry.value, entry.offset);
  else if (entry.operation === "set-i8") bytes.writeInt8(entry.value, entry.offset);
  else if (entry.operation === "set-u16") bytes.writeUInt16LE(entry.value, entry.offset);
  else if (entry.operation === "set-u32") bytes.writeUInt32LE(entry.value, entry.offset);
  else if (entry.operation === "append-byte") bytes = Buffer.concat([bytes, Buffer.from([entry.value])]);
  else fail("slm2-vector-mutation-unsupported");
  return bytes;
}

function expectedError(bytes) {
  try {
    parseArtifact(bytes);
  } catch (error) {
    if (error instanceof Slm2Q8Error) return error.code;
    throw error;
  }
  fail("slm2-hostile-vector-was-accepted");
}

function rowCases() {
  const cases = [
    ["positive-and-negative-zero", [0, -0, 0, -0]],
    ["positive-and-negative-extrema", [127, -127, 0.5, -0.5]],
    ["positive-half-tie", [254, 1, 0, -254]],
    ["negative-half-tie", [254, -1, 0, -254]],
    ["just-below-and-above-half", [127, f32(0.49999997), f32(0.50000006),
      f32(-0.49999997), f32(-0.50000006)]],
    ["rounded-scale-clamp", [f32FromBits(0x7f7f_ffff), f32FromBits(0xff7f_ffff), 1, -1]],
    ["non-power-of-two-scale", [3, 1, -2, f32(0.1)]]
  ];
  return cases.map(([id, source]) => {
    const result = quantizeRow(source);
    return {
      id,
      sourceF32Bits: source.map((value) => f32Bits(value)),
      scaleF32Bits: result.scaleBits,
      codes: result.codes
    };
  });
}

function matvecCases() {
  const cases = [
    ["zero-row", [[0, -0, 0, -0]], [1, -2, 3, -4]],
    ["mixed-sign-row", [[3, 1, -2, 0.1]], [0.5, -1, 2, -0.25]],
    ["multiple-rows", [[1, 2, 3], [-4, 5, -6], [0.25, -0.5, 0.75]], [2, -1, 0.5]],
    ["finite-extreme-without-overflow", [[65504, -32752]], [0.5, 0.25]]
  ];
  return cases.map(([id, rows, input]) => {
    const flattened = rows.flat().map(f32);
    const encoded = encodeQ8Rows(flattened, rows.length, rows[0].length);
    const output = q8Matvec(encoded.bytes, rows.length, rows[0].length, input);
    return {
      id,
      rows: rows.length,
      columns: rows[0].length,
      sourceF32Bits: flattened.map(f32Bits),
      inputF32Bits: input.map(f32Bits),
      payloadHex: encoded.bytes.toString("hex"),
      outputF32Bits: output.map(f32Bits)
    };
  });
}

function vectorDocument() {
  const built = writeCanonicalArtifact();
  const formatProfileBytes = fs.readFileSync(formatProfilePath);
  const weightProfileBytes = fs.readFileSync(weightProfilePath);
  const oracleBytes = fs.readFileSync(__filename);
  const firstQ8Index = built.parsed.tensors.findIndex((tensor) => tensor.elementType === 2);
  const firstF32Index = built.parsed.tensors.findIndex((tensor) => tensor.elementType === 1);
  const zeroTensorIndex = built.parsed.tensors.findIndex((tensor) =>
    tensor.semanticRole === "model.token-embedding.weight");
  const firstQ8 = built.parsed.tensors[firstQ8Index];
  const firstF32 = built.parsed.tensors[firstF32Index];
  const zeroTensor = built.parsed.tensors[zeroTensorIndex];
  const tensorRecord = (index) => built.parsed.header.tensorTableOffset + index * TENSOR_RECORD_BYTES;
  const manifestDigestOffset = built.artifact.indexOf(built.parsed.tensorLayoutSha256,
    built.parsed.header.manifestOffset);
  invariant(manifestDigestOffset >= built.parsed.header.manifestOffset, "slm2-vector-offset-missing");
  const mutations = [
    mutation("wrong-magic", "xor-byte", 0, 1, "slm2-invalid-magic"),
    mutation("quant-count-zero", "set-u32", 88, 0, "slm2-invalid-quantization"),
    mutation("quant-record-reserved", "set-u8", built.parsed.header.quantTableOffset + 56, 1,
      "slm2-invalid-quantization"),
    mutation("quant-profile-string-id-range", "set-u32", built.parsed.header.quantTableOffset + 4,
      0xffff_ffff, "slm2-invalid-quantization"),
    mutation("unknown-rounding-enum", "set-u16", built.parsed.header.quantTableOffset + 42, 2,
      "slm2-invalid-quantization"),
    mutation("q8-role-as-f32", "set-u16", tensorRecord(firstQ8Index) + 4, 1,
      "slm2-invalid-tensor-encoding"),
    mutation("f32-role-as-q8", "set-u16", tensorRecord(firstF32Index) + 4, 2,
      "slm2-invalid-tensor-encoding"),
    mutation("q8-rank-one", "set-u8", tensorRecord(firstQ8Index) + 2, 1,
      "slm2-invalid-tensor"),
    mutation("q8-quant-index-none", "set-u16", tensorRecord(firstQ8Index) + 6, 0xffff,
      "slm2-invalid-tensor-encoding"),
    mutation("q8-block-elements-drift", "set-u32", tensorRecord(firstQ8Index) + 132,
      firstQ8.blockElements + 1, "slm2-invalid-tensor-encoding"),
    mutation("q8-stored-bytes-drift", "set-u32", tensorRecord(firstQ8Index) + 104,
      firstQ8.storedBytes + 1, "slm2-invalid-tensor-encoding"),
    mutation("zero-row-negative-zero-scale", "set-u32", zeroTensor.payloadOffset, 0x8000_0000,
      "slm2-invalid-q8-payload"),
    mutation("negative-128-code", "set-i8", zeroTensor.payloadOffset + 4, -128,
      "slm2-invalid-q8-payload"),
    mutation("payload-hash-drift", "xor-byte", firstQ8.payloadOffset + 5, 1,
      "slm2-payload-hash-drift"),
    mutation("layout-hash-drift", "xor-byte", manifestDigestOffset, 1, "slm2-layout-hash-drift"),
    mutation("nonzero-section-padding", "set-u8", HEADER_BYTES, 1, "slm2-nonzero-padding"),
    mutation("trailing-byte", "append-byte", built.artifact.length, 0, "slm2-file-size-mismatch")
  ];
  mutations.forEach((entry) => {
    const actual = expectedError(applyMutation(built.artifact, entry));
    if (actual !== entry.expectedError) {
      const error = new Error(`${entry.id}: expected ${entry.expectedError}, observed ${actual}`);
      error.code = "slm2-hostile-vector-verdict-drift";
      throw error;
    }
  });
  return {
    schema: "tinyrustlm.slm2-q8-weight-vectors.v1",
    formatProfile: {
      path: "contracts/vnext/slm2-format-profile.v1.json",
      byteLength: formatProfileBytes.length,
      sha256: sha256Hex(formatProfileBytes)
    },
    weightProfile: {
      path: "contracts/vnext/slm2-q8-weight-profile.v1.json",
      byteLength: weightProfileBytes.length,
      sha256: sha256Hex(weightProfileBytes),
      profileId: PROFILES.storage
    },
    oracle: {
      path: "tinyrustlm/tools/slm2-q8-reference.js",
      byteLength: oracleBytes.length,
      sha256: sha256Hex(oracleBytes),
      invokesRust: false,
      invokesSubprocess: false,
      usesNetwork: false
    },
    canonical: {
      id: "base-model-required-mixed-q8-row-f32-registry",
      artifactHex: built.artifact.toString("hex"),
      artifactByteLength: built.artifact.length,
      artifactSha256: sha256Hex(built.artifact),
      manifestSha256: sha256Hex(built.manifest),
      tensorLayoutSha256: built.parsed.tensorLayoutSha256.toString("hex"),
      modelSpec: built.spec,
      header: built.parsed.header,
      strings: built.strings,
      quantRecordHex: built.quantTable.toString("hex"),
      tensors: built.tensors.map((tensor) => ({
        semanticRole: tensor.semanticRole,
        canonicalName: tensor.canonicalName,
        layer: tensor.layer,
        shape: tensor.shape,
        logicalElements: tensor.logicalElements,
        elementType: tensor.elementType,
        quantProfileIndex: tensor.quantProfileIndex,
        storedBytes: tensor.storedBytes,
        payloadRelativeOffset: tensor.payloadRelativeOffset,
        payloadLength: tensor.payload.length,
        payloadAlignment: tensor.payloadAlignment,
        blockElements: tensor.blockElements,
        blockBytes: tensor.blockBytes,
        scaleType: tensor.scaleType,
        zeroPointType: tensor.zeroPointType,
        packingOrder: tensor.packingOrder,
        accumulatorType: tensor.accumulatorType,
        tailRule: tensor.tailRule,
        sourceF32Sha256: sha256Hex(encodeF32(tensor.source)),
        payloadSha256: tensor.payloadSha256.toString("hex")
      })),
      rowCases: rowCases(),
      matvecCases: matvecCases(),
      mutations
    }
  };
}

function renderVectors() {
  return Buffer.from(`${JSON.stringify(vectorDocument(), null, 2)}\n`, "utf8");
}

function runCli() {
  invariant(process.argv.length === 3 && ["--check", "--write"].includes(process.argv[2]),
    "usage: node slm2-q8-reference.js --check|--write");
  const rendered = renderVectors();
  if (process.argv[2] === "--write") {
    fs.writeFileSync(vectorPath, rendered, { flag: "w" });
    return;
  }
  invariant(fs.existsSync(vectorPath) && fs.readFileSync(vectorPath).equals(rendered),
    "slm2-q8-vector-contract-stale");
}

if (require.main === module) runCli();

module.exports = {
  Slm2Q8Error,
  applyMutation,
  canonicalSpec,
  formatProfilePath,
  parseArtifact,
  q8Matvec,
  quantizeRow,
  renderVectors,
  requiredTensors,
  vectorDocument,
  vectorPath,
  weightProfilePath,
  writeCanonicalArtifact
};
