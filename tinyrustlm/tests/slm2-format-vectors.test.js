"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/slm2-format-vectors.v1.json");
const profilePath = path.join(repositoryRoot, "contracts/vnext/slm2-format-profile.v1.json");
const vectorDocument = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
const profileBytes = fs.readFileSync(profilePath);
const profileDocument = JSON.parse(profileBytes.toString("utf8"));

const HEADER_BYTES = 224;
const TENSOR_RECORD_BYTES = 192;
const SECTION_ALIGNMENT = 64;
const PIECE_BYTES = 4_194_304;
const MAXIMUM_TENSORS = 262_144;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MAGIC = Buffer.from([0x53, 0x4c, 0x4d, 0x32, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMAT_ID = Buffer.from("minimodel.slm2\0\0", "ascii");
const TENSOR_LAYOUT_DOMAIN = Buffer.from("tinyrustlm.slm2.tensor-layout.v1\0", "ascii");
const TENSOR_PAYLOAD_DOMAIN = Buffer.from("tinyrustlm.slm2.tensor-payload.v1\0", "ascii");
const MERKLE_LEAF_DOMAIN = Buffer.from("TinyRustLM-Merkle-Leaf-v1\0", "ascii");
const MERKLE_NODE_DOMAIN = Buffer.from("TinyRustLM-Merkle-Node-v1\0", "ascii");
const MERKLE_CARRY_DOMAIN = Buffer.from("TinyRustLM-Merkle-Carry-v1\0", "ascii");
const MERKLE_ROOT_DOMAIN = Buffer.from("TinyRustLM-Merkle-Root-v1\0", "ascii");
const TENSOR_ROLE_PROFILE = "tinyrustlm.decoder-f32-tensor-roles/1";
const TOP_LEVEL_TENSOR_DEFINITIONS = [
  {
    semanticRole: "model.token-embedding.weight",
    canonicalName: "model.token-embedding.weight",
    condition: "always",
    shape: ["vocabulary_size", "embedding_size"]
  },
  {
    semanticRole: "model.final-normalization.weight",
    canonicalName: "model.final-normalization.weight",
    condition: "always",
    shape: ["embedding_size"]
  },
  {
    semanticRole: "model.output-projection.weight",
    canonicalName: "model.output-projection.weight",
    condition: "tied_embeddings-is-false",
    shape: ["vocabulary_size", "embedding_size"]
  }
];
const PER_LAYER_TENSOR_DEFINITIONS = [
  {
    semanticRole: "layer.attention-normalization.weight",
    canonicalName: "model.layers.{layer}.attention-normalization.weight",
    condition: "always",
    shape: ["embedding_size"]
  },
  {
    semanticRole: "layer.feed-forward-normalization.weight",
    canonicalName: "model.layers.{layer}.feed-forward-normalization.weight",
    condition: "always",
    shape: ["embedding_size"]
  },
  {
    semanticRole: "layer.attention.query-projection.weight",
    canonicalName: "model.layers.{layer}.attention.query-projection.weight",
    condition: "always",
    shape: ["query_width", "embedding_size"]
  },
  {
    semanticRole: "layer.attention.key-projection.weight",
    canonicalName: "model.layers.{layer}.attention.key-projection.weight",
    condition: "always",
    shape: ["kv_width", "embedding_size"]
  },
  {
    semanticRole: "layer.attention.value-projection.weight",
    canonicalName: "model.layers.{layer}.attention.value-projection.weight",
    condition: "always",
    shape: ["kv_width", "embedding_size"]
  },
  {
    semanticRole: "layer.attention.output-projection.weight",
    canonicalName: "model.layers.{layer}.attention.output-projection.weight",
    condition: "always",
    shape: ["embedding_size", "query_width"]
  },
  {
    semanticRole: "layer.feed-forward.gate-projection.weight",
    canonicalName: "model.layers.{layer}.feed-forward.gate-projection.weight",
    condition: "always",
    shape: ["feed_forward_size", "embedding_size"]
  },
  {
    semanticRole: "layer.feed-forward.down-projection.weight",
    canonicalName: "model.layers.{layer}.feed-forward.down-projection.weight",
    condition: "always",
    shape: ["embedding_size", "feed_forward_size"]
  },
  {
    semanticRole: "layer.feed-forward.up-projection.weight",
    canonicalName: "model.layers.{layer}.feed-forward.up-projection.weight",
    condition: "always",
    shape: ["feed_forward_size", "embedding_size"]
  },
  {
    semanticRole: "layer.attention.query-projection.bias",
    canonicalName: "model.layers.{layer}.attention.query-projection.bias",
    condition: "qkv_bias-is-true",
    shape: ["query_width"]
  },
  {
    semanticRole: "layer.attention.key-projection.bias",
    canonicalName: "model.layers.{layer}.attention.key-projection.bias",
    condition: "qkv_bias-is-true",
    shape: ["kv_width"]
  },
  {
    semanticRole: "layer.attention.value-projection.bias",
    canonicalName: "model.layers.{layer}.attention.value-projection.bias",
    condition: "qkv_bias-is-true",
    shape: ["kv_width"]
  },
  {
    semanticRole: "layer.attention.query-normalization.weight",
    canonicalName: "model.layers.{layer}.attention.query-normalization.weight",
    condition: "qk_normalization-is-true",
    shape: ["head_dimension"]
  },
  {
    semanticRole: "layer.attention.key-normalization.weight",
    canonicalName: "model.layers.{layer}.attention.key-normalization.weight",
    condition: "qk_normalization-is-true",
    shape: ["head_dimension"]
  }
];
const EXPECTED_TENSOR_ROLE_REGISTRY = {
  profileId: TENSOR_ROLE_PROFILE,
  unexpectedTensors: "fatal",
  missingTensors: "fatal",
  duplicateRoles: "fatal",
  layerField: "minus-one-for-global-zero-based-for-transformer-layer",
  subindexFields: "exactly-minus-one",
  payloadAlignment: "any-valid-format-alignment-bound-by-each-record",
  shapeSymbols: {
    vocabulary_size: "model-body-vocabulary-size",
    embedding_size: "model-body-embedding-size",
    feed_forward_size: "model-body-feed-forward-size",
    query_width: "head-count-times-head-dimension",
    kv_width: "kv-head-count-times-head-dimension",
    head_dimension: "model-body-head-dimension"
  },
  topLevel: TOP_LEVEL_TENSOR_DEFINITIONS,
  perLayer: PER_LAYER_TENSOR_DEFINITIONS
};

class Slm2ValidationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new Slm2ValidationError(code);
}

function sha256(...parts) {
  const hasher = crypto.createHash("sha256");
  for (const part of parts) {
    hasher.update(part);
  }
  return hasher.digest();
}

function sha256Hex(...parts) {
  return sha256(...parts).toString("hex");
}

function strictHex(value) {
  assert.equal(typeof value, "string");
  assert.match(value, /^(?:[0-9a-f]{2})+$/u);
  const bytes = Buffer.from(value, "hex");
  assert.equal(bytes.toString("hex"), value);
  return bytes;
}

function ensureRange(bytes, offset, length, code = "slm2-truncated-section") {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset + length > bytes.length) {
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

function readI32(bytes, offset) {
  ensureRange(bytes, offset, 4);
  return bytes.readInt32LE(offset);
}

function readU64(bytes, offset) {
  ensureRange(bytes, offset, 8);
  const value = bytes.readBigUInt64LE(offset);
  if (value > MAX_SAFE_BIGINT) {
    fail("slm2-offset-overflow");
  }
  return Number(value);
}

function leU16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
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
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(alignment)
      || value < 0 || alignment <= 0 || (alignment & (alignment - 1)) !== 0) {
    fail("slm2-invalid-alignment");
  }
  const result = Math.ceil(value / alignment) * alignment;
  if (!Number.isSafeInteger(result)) {
    fail("slm2-offset-overflow");
  }
  return result;
}

function assertZero(bytes, start, end) {
  ensureRange(bytes, start, end - start);
  for (let offset = start; offset < end; offset += 1) {
    if (bytes[offset] !== 0) {
      fail("slm2-nonzero-padding");
    }
  }
}

function exactMap(map, expectedKeys) {
  if (!(map instanceof Map)) {
    fail("slm2-invalid-model-metadata");
  }
  assert.deepEqual([...map.keys()].sort(), [...expectedKeys].sort());
  return map;
}

function required(map, key) {
  if (!map.has(key)) {
    fail("slm2-invalid-model-metadata");
  }
  return map.get(key);
}

function compareCanonicalKeys(left, right) {
  return left.length - right.length || Buffer.compare(left, right);
}

function decodeDcbor(bytes) {
  const state = {
    bytes,
    offset: 0,
    items: 0,
    limits: {
      maximumDepth: 16,
      maximumItems: 65_536,
      maximumMapEntries: 4_096,
      maximumArrayEntries: 65_536,
      maximumByteStringBytes: 4_194_304,
      maximumTextBytes: 16_384
    }
  };

  function invalid() {
    fail("slm2-invalid-metadata");
  }

  function read(length) {
    if (!Number.isSafeInteger(length) || length < 0 || state.offset + length > bytes.length) {
      invalid();
    }
    const value = bytes.subarray(state.offset, state.offset + length);
    state.offset += length;
    return value;
  }

  function argument(additional) {
    let value;
    if (additional <= 23) {
      value = BigInt(additional);
    } else if (additional === 24) {
      value = BigInt(read(1)[0]);
      if (value < 24n) invalid();
    } else if (additional === 25) {
      value = BigInt(read(2).readUInt16BE(0));
      if (value <= 0xffn) invalid();
    } else if (additional === 26) {
      value = BigInt(read(4).readUInt32BE(0));
      if (value <= 0xffffn) invalid();
    } else if (additional === 27) {
      value = read(8).readBigUInt64BE(0);
      if (value <= 0xffff_ffffn) invalid();
    } else {
      invalid();
    }
    if (value > MAX_SAFE_BIGINT) invalid();
    return Number(value);
  }

  function boundedLength(additional, maximum) {
    const value = argument(additional);
    if (value > maximum || value > bytes.length - state.offset) invalid();
    return value;
  }

  function count(depth) {
    state.items += 1;
    if (depth > state.limits.maximumDepth || state.items > state.limits.maximumItems) invalid();
  }

  function preflight(additional) {
    if (state.items + additional > state.limits.maximumItems) invalid();
  }

  function value(depth) {
    count(depth);
    const initial = read(1)[0];
    const major = initial >> 5;
    const additional = initial & 0x1f;
    if (major === 0) return argument(additional);
    if (major === 1) return -1 - argument(additional);
    if (major === 2) {
      return Buffer.from(read(boundedLength(additional, state.limits.maximumByteStringBytes)));
    }
    if (major === 3) {
      const raw = read(boundedLength(additional, state.limits.maximumTextBytes));
      if ([...raw].some((byte) => byte > 0x7f)) invalid();
      return raw.toString("ascii");
    }
    if (major === 4) {
      const length = boundedLength(additional, state.limits.maximumArrayEntries);
      preflight(length);
      return Array.from({ length }, () => value(depth + 1));
    }
    if (major === 5) {
      const length = boundedLength(additional, state.limits.maximumMapEntries);
      preflight(length * 2);
      const result = new Map();
      let priorEncoding = null;
      for (let index = 0; index < length; index += 1) {
        const keyStart = state.offset;
        const key = value(depth + 1);
        if (typeof key !== "string") invalid();
        const keyEncoding = bytes.subarray(keyStart, state.offset);
        if (priorEncoding !== null && compareCanonicalKeys(priorEncoding, keyEncoding) >= 0) {
          invalid();
        }
        priorEncoding = keyEncoding;
        result.set(key, value(depth + 1));
      }
      return result;
    }
    if (major === 7 && additional === 20) return false;
    if (major === 7 && additional === 21) return true;
    if (major === 7 && additional === 22) return null;
    invalid();
  }

  const decoded = value(1);
  if (state.offset !== bytes.length) invalid();
  return decoded;
}

function positiveU32(value) {
  if (!Number.isInteger(value) || value <= 0 || value > 0xffff_ffff) {
    fail("slm2-invalid-model-metadata");
  }
  return value;
}

function positiveFloatBits(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    fail("slm2-invalid-model-metadata");
  }
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  const decoded = bytes.readFloatLE();
  if (!Number.isFinite(decoded) || decoded <= 0) {
    fail("slm2-invalid-model-metadata");
  }
  return decoded;
}

function validateManifest(bytes, artifactClass) {
  const manifest = exactMap(decodeDcbor(bytes), [
    "artifact_class", "body", "dependencies", "extensions", "requirements", "schema"
  ]);
  if (required(manifest, "artifact_class") !== artifactClass
      || required(manifest, "schema") !== "org.minimodel.slm/2.0"
      || !Array.isArray(required(manifest, "dependencies"))
      || required(manifest, "dependencies").length !== 0
      || !Array.isArray(required(manifest, "extensions"))
      || required(manifest, "extensions").length !== 0) {
    fail("slm2-invalid-model-metadata");
  }
  const requirements = exactMap(required(manifest, "requirements"), [
    "kv_profile", "minimum_runtime", "operator_profile", "tensor_profile", "tensor_role_profile"
  ]);
  for (const [key, expected] of [
    ["kv_profile", "tinyrustlm.kv-f32/1"],
    ["minimum_runtime", "tinyrustlm.runtime/2.0"],
    ["operator_profile", "tinyrustlm.decoder-f32/1"],
    ["tensor_profile", "tinyrustlm.tensor-f32/1"],
    ["tensor_role_profile", TENSOR_ROLE_PROFILE]
  ]) {
    if (required(requirements, key) !== expected) fail("slm2-invalid-model-metadata");
  }
  const body = exactMap(required(manifest, "body"), [
    "activation_profile", "architecture_profile", "attention_profile", "context_length",
    "embedding_size", "feed_forward_size", "head_count", "head_dimension", "kv_head_count",
    "layer_count", "normalization_epsilon_bits", "normalization_profile", "position_profile",
    "qk_normalization", "qkv_bias", "rope_theta_bits", "tensor_layout_sha256", "tied_embeddings",
    "vocabulary_size"
  ]);
  for (const [key, expected] of [
    ["activation_profile", "tinyrustlm.silu-gated/1"],
    ["architecture_profile", "tinyrustlm.decoder-transformer/1"],
    ["attention_profile", "tinyrustlm.causal-gqa/1"],
    ["normalization_profile", "tinyrustlm.rmsnorm/1"],
    ["position_profile", "tinyrustlm.rope/1"]
  ]) {
    if (required(body, key) !== expected) fail("slm2-invalid-model-metadata");
  }
  const spec = {
    artifactClass,
    vocabularySize: positiveU32(required(body, "vocabulary_size")),
    contextLength: positiveU32(required(body, "context_length")),
    embeddingSize: positiveU32(required(body, "embedding_size")),
    feedForwardSize: positiveU32(required(body, "feed_forward_size")),
    layerCount: positiveU32(required(body, "layer_count")),
    headCount: positiveU32(required(body, "head_count")),
    kvHeadCount: positiveU32(required(body, "kv_head_count")),
    headDimension: positiveU32(required(body, "head_dimension")),
    ropeTheta: positiveFloatBits(required(body, "rope_theta_bits")),
    normalizationEpsilon: positiveFloatBits(required(body, "normalization_epsilon_bits")),
    qkNormalization: required(body, "qk_normalization"),
    qkvBias: required(body, "qkv_bias"),
    tiedEmbeddings: required(body, "tied_embeddings")
  };
  if (typeof spec.qkNormalization !== "boolean" || typeof spec.qkvBias !== "boolean"
      || typeof spec.tiedEmbeddings !== "boolean" || spec.kvHeadCount > spec.headCount
      || spec.headCount % spec.kvHeadCount !== 0
      || BigInt(spec.headCount) * BigInt(spec.headDimension) !== BigInt(spec.embeddingSize)
      || spec.layerCount > 0x7fff_ffff) {
    fail("slm2-invalid-model-metadata");
  }
  const layoutHash = required(body, "tensor_layout_sha256");
  if (!Buffer.isBuffer(layoutHash) || layoutHash.length !== 32 || layoutHash.every((byte) => byte === 0)) {
    fail("slm2-invalid-model-metadata");
  }
  return { spec, layoutHash };
}

function machineIdentifier(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 255
      || !/^[a-z0-9][a-z0-9._/-]*$/u.test(value)
      || value.startsWith("/") || value.endsWith("/")) {
    return false;
  }
  return value.split("/").every((component) => component !== "" && component !== "." && component !== "..");
}

function parseStringTable(bytes) {
  if (bytes.length < 12) fail("slm2-invalid-string-table");
  const count = readU32(bytes, 0);
  const poolLength = readU32(bytes, 4);
  const poolStart = 8 + (count + 1) * 4;
  if (count === 0 || poolStart + poolLength !== bytes.length || readU32(bytes, 8) !== 0) {
    fail("slm2-invalid-string-table");
  }
  const strings = [];
  for (let index = 0; index < count; index += 1) {
    const start = readU32(bytes, 8 + index * 4);
    const end = readU32(bytes, 8 + (index + 1) * 4);
    if (start >= end || end > poolLength) fail("slm2-invalid-string-table");
    const raw = bytes.subarray(poolStart + start, poolStart + end);
    if ([...raw].some((byte) => byte > 0x7f)) fail("slm2-invalid-string-table");
    const value = raw.toString("ascii");
    if (!machineIdentifier(value)
        || (strings.length > 0 && Buffer.compare(Buffer.from(strings.at(-1)), raw) >= 0)) {
      fail("slm2-invalid-string-table");
    }
    strings.push(value);
  }
  if (readU32(bytes, 8 + count * 4) !== poolLength) fail("slm2-invalid-string-table");
  return strings;
}

function validTensorAlignment(value) {
  return value >= 64 && value <= 4096 && (value & (value - 1)) === 0;
}

function parseTensor(record, strings, payloadBase) {
  if (record.length !== TENSOR_RECORD_BYTES || readU16(record, 0) !== 1 || record[3] !== 0
      || readU16(record, 4) !== 1 || readU16(record, 6) !== 0xffff
      || readU32(record, 28) !== 0 || record.subarray(132, 160).some((byte) => byte !== 0)) {
    fail("slm2-invalid-tensor");
  }
  const rank = record[2];
  if (rank > 8) fail("slm2-invalid-tensor");
  const role = strings[readU32(record, 8)];
  const name = strings[readU32(record, 12)];
  const layer = readI32(record, 16);
  const subindex0 = readI32(record, 20);
  const subindex1 = readI32(record, 24);
  const fullShape = Array.from({ length: 8 }, (_, index) => readU64(record, 32 + index * 8));
  const shape = fullShape.slice(0, rank);
  const alignment = readU32(record, 128);
  if (!machineIdentifier(role) || !machineIdentifier(name) || layer < -1 || subindex0 < -1
      || subindex1 < -1 || shape.some((value) => value === 0 || value > 0xffff_ffff)
      || fullShape.slice(rank).some((value) => value !== 0) || !validTensorAlignment(alignment)) {
    fail("slm2-invalid-tensor");
  }
  const logicalElements = shape.reduce((product, value) => product * value, 1);
  if (!Number.isSafeInteger(logicalElements)) fail("slm2-invalid-tensor");
  const payloadLength = readU64(record, 120);
  if (readU64(record, 96) !== logicalElements || readU64(record, 104) !== payloadLength
      || payloadLength !== logicalElements * 4) {
    fail("slm2-tensor-size-mismatch");
  }
  const payloadRelativeOffset = readU64(record, 112);
  const payloadSha = Buffer.from(record.subarray(160, 192));
  if (payloadSha.every((byte) => byte === 0)) fail("slm2-invalid-tensor");
  return {
    semanticRole: role,
    canonicalName: name,
    layer,
    subindex0,
    subindex1,
    shape,
    fullShape,
    logicalElements,
    payloadRelativeOffset,
    payloadOffset: payloadBase + payloadRelativeOffset,
    payloadLength,
    payloadAlignment: alignment,
    payloadSha
  };
}

function compareTensorKeys(left, right) {
  return Buffer.compare(Buffer.from(left.semanticRole), Buffer.from(right.semanticRole))
    || left.layer - right.layer
    || left.subindex0 - right.subindex0
    || left.subindex1 - right.subindex1
    || Buffer.compare(Buffer.from(left.canonicalName), Buffer.from(right.canonicalName));
}

function tensorConditionEnabled(condition, spec) {
  if (condition === "always") return true;
  if (condition === "tied_embeddings-is-false") return !spec.tiedEmbeddings;
  if (condition === "qkv_bias-is-true") return spec.qkvBias;
  if (condition === "qk_normalization-is-true") return spec.qkNormalization;
  throw new Error(`unsupported tensor registry condition ${condition}`);
}

function tensorShapeDimension(symbol, spec) {
  const values = {
    vocabulary_size: spec.vocabularySize,
    embedding_size: spec.embeddingSize,
    feed_forward_size: spec.feedForwardSize,
    query_width: spec.headCount * spec.headDimension,
    kv_width: spec.kvHeadCount * spec.headDimension,
    head_dimension: spec.headDimension
  };
  if (!Object.hasOwn(values, symbol)) {
    throw new Error(`unsupported tensor registry shape symbol ${symbol}`);
  }
  return values[symbol];
}

function requiredModelTensors(spec) {
  const topLevel = TOP_LEVEL_TENSOR_DEFINITIONS.filter((definition) => (
    tensorConditionEnabled(definition.condition, spec)
  ));
  const perLayer = PER_LAYER_TENSOR_DEFINITIONS.filter((definition) => (
    tensorConditionEnabled(definition.condition, spec)
  ));
  const expectedCount = topLevel.length + spec.layerCount * perLayer.length;
  if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0 || expectedCount > MAXIMUM_TENSORS) {
    fail("slm2-invalid-tensor-registry");
  }
  const tensors = topLevel.map((definition) => ({
    semanticRole: definition.semanticRole,
    canonicalName: definition.canonicalName,
    layer: -1,
    subindex0: -1,
    subindex1: -1,
    shape: definition.shape.map((symbol) => tensorShapeDimension(symbol, spec))
  }));
  for (let layer = 0; layer < spec.layerCount; layer += 1) {
    for (const definition of perLayer) {
      tensors.push({
        semanticRole: definition.semanticRole,
        canonicalName: definition.canonicalName.replace("{layer}", String(layer)),
        layer,
        subindex0: -1,
        subindex1: -1,
        shape: definition.shape.map((symbol) => tensorShapeDimension(symbol, spec))
      });
    }
  }
  return tensors.sort(compareTensorKeys);
}

function validateTensorRegistry(spec, tensors) {
  const expected = requiredModelTensors(spec);
  if (tensors.length !== expected.length) fail("slm2-invalid-tensor-registry");
  for (let index = 0; index < tensors.length; index += 1) {
    const actual = tensors[index];
    const requiredTensor = expected[index];
    if (actual.semanticRole !== requiredTensor.semanticRole
        || actual.canonicalName !== requiredTensor.canonicalName
        || actual.layer !== requiredTensor.layer
        || actual.subindex0 !== -1
        || actual.subindex1 !== -1
        || actual.shape.length !== requiredTensor.shape.length
        || actual.shape.some((dimension, shapeIndex) => dimension !== requiredTensor.shape[shapeIndex])) {
      fail("slm2-invalid-tensor-registry");
    }
  }
}

function identifierFrame(value) {
  return Buffer.concat([leU32(Buffer.byteLength(value, "ascii")), Buffer.from(value, "ascii")]);
}

function tensorLayoutHash(artifactClass, tensors) {
  const parts = [TENSOR_LAYOUT_DOMAIN, leU16(artifactClass), leU32(tensors.length)];
  for (const tensor of tensors) {
    parts.push(identifierFrame(tensor.semanticRole), identifierFrame(tensor.canonicalName));
    parts.push(leI32(tensor.layer), leI32(tensor.subindex0), leI32(tensor.subindex1));
    parts.push(leU32(tensor.shape.length));
    for (const dimension of tensor.fullShape) parts.push(leU64(dimension));
    parts.push(leU16(1), leU16(0xffff), leU32(tensor.payloadAlignment));
  }
  return sha256(...parts);
}

function tensorPayloadHash(artifactClass, tensor, payload) {
  const parts = [
    TENSOR_PAYLOAD_DOMAIN,
    leU16(artifactClass),
    identifierFrame(tensor.semanticRole),
    identifierFrame(tensor.canonicalName),
    leI32(tensor.layer),
    leI32(tensor.subindex0),
    leI32(tensor.subindex1),
    leU32(tensor.shape.length)
  ];
  for (const dimension of tensor.fullShape) parts.push(leU64(dimension));
  parts.push(leU16(1), leU16(0xffff), leU64(tensor.logicalElements), leU64(tensor.payloadLength), payload);
  return sha256(...parts);
}

function pieceManifest(bytes) {
  const pieces = [];
  const leaves = [];
  for (let offset = 0, index = 0; offset < bytes.length; offset += PIECE_BYTES, index += 1) {
    const piece = bytes.subarray(offset, Math.min(offset + PIECE_BYTES, bytes.length));
    const plain = sha256(piece);
    pieces.push({ index, byteLength: piece.length, sha256: plain });
    leaves.push(sha256(MERKLE_LEAF_DOMAIN, leU64(index), leU64(piece.length), plain));
  }
  if (pieces.length === 0) fail("slm2-invalid-piece-layout");
  let nodes = leaves;
  let level = 1;
  while (nodes.length > 1) {
    const next = [];
    for (let index = 0; index < nodes.length; index += 2) {
      const parentIndex = index / 2;
      next.push(index + 1 < nodes.length
        ? sha256(MERKLE_NODE_DOMAIN, leU32(level), leU64(parentIndex), nodes[index], nodes[index + 1])
        : sha256(MERKLE_CARRY_DOMAIN, leU32(level), leU64(parentIndex), nodes[index]));
    }
    nodes = next;
    level += 1;
  }
  const root = sha256(MERKLE_ROOT_DOMAIN, leU64(bytes.length), leU64(pieces.length), nodes[0]);
  return {
    pieceSize: PIECE_BYTES,
    pieceCount: pieces.length,
    pieceLengths: pieces.map((piece) => piece.byteLength),
    pieceSha256: pieces.map((piece) => piece.sha256.toString("hex")),
    merkleRoot: root.toString("hex")
  };
}

function validateArtifact(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < HEADER_BYTES) fail("slm2-truncated-header");
  if (!bytes.subarray(0, 8).equals(MAGIC)) fail("slm2-invalid-magic");
  if (!bytes.subarray(8, 24).equals(FORMAT_ID)) fail("slm2-invalid-format-id");
  if (readU32(bytes, 24) !== HEADER_BYTES) fail("slm2-invalid-header-size");
  if (readU16(bytes, 28) !== 2 || readU16(bytes, 30) !== 0) fail("slm2-unsupported-version");
  if (readU32(bytes, 32) !== 0x0102_0304) fail("slm2-invalid-byte-order");
  const artifactClass = readU16(bytes, 36);
  if (artifactClass !== 1 && artifactClass !== 2) fail("slm2-unsupported-artifact-class");
  if (readU16(bytes, 38) !== 0 || bytes.subarray(160, 224).some((byte) => byte !== 0)) {
    fail("slm2-invalid-header-flags");
  }
  const fileSize = readU64(bytes, 40);
  if (fileSize !== bytes.length) fail("slm2-file-size-mismatch");
  if (bytes.subarray(80, 96).some((byte) => byte !== 0)
      || bytes.subarray(112, 144).some((byte) => byte !== 0)) {
    fail("slm2-unsupported-table");
  }
  const header = {
    headerBytes: HEADER_BYTES,
    artifactClass,
    fileSize,
    manifestOffset: readU64(bytes, 48),
    manifestLength: readU64(bytes, 56),
    stringTableOffset: readU64(bytes, 64),
    stringTableLength: readU64(bytes, 72),
    tensorTableOffset: readU64(bytes, 96),
    tensorCount: readU32(bytes, 104),
    tensorRecordBytes: readU32(bytes, 108),
    payloadOffset: readU64(bytes, 144),
    payloadLength: readU64(bytes, 152)
  };
  if (header.manifestLength === 0 || header.stringTableLength === 0 || header.tensorCount === 0
      || header.tensorCount > MAXIMUM_TENSORS
      || header.tensorRecordBytes !== TENSOR_RECORD_BYTES || header.payloadLength === 0) {
    fail("slm2-invalid-section");
  }
  if (header.manifestOffset !== alignUp(HEADER_BYTES, SECTION_ALIGNMENT)
      || header.stringTableOffset !== alignUp(header.manifestOffset + header.manifestLength, SECTION_ALIGNMENT)
      || header.tensorTableOffset !== alignUp(header.stringTableOffset + header.stringTableLength, SECTION_ALIGNMENT)
      || header.payloadOffset !== alignUp(header.tensorTableOffset
        + header.tensorCount * TENSOR_RECORD_BYTES, SECTION_ALIGNMENT)
      || header.payloadOffset + header.payloadLength !== fileSize) {
    fail("slm2-invalid-section-layout");
  }
  assertZero(bytes, HEADER_BYTES, header.manifestOffset);
  assertZero(bytes, header.manifestOffset + header.manifestLength, header.stringTableOffset);
  assertZero(bytes, header.stringTableOffset + header.stringTableLength, header.tensorTableOffset);
  assertZero(bytes, header.tensorTableOffset + header.tensorCount * TENSOR_RECORD_BYTES, header.payloadOffset);

  const manifestBytes = bytes.subarray(header.manifestOffset, header.manifestOffset + header.manifestLength);
  const { spec, layoutHash } = validateManifest(manifestBytes, artifactClass);
  const strings = parseStringTable(bytes.subarray(
    header.stringTableOffset,
    header.stringTableOffset + header.stringTableLength
  ));
  const tensors = [];
  for (let index = 0; index < header.tensorCount; index += 1) {
    const start = header.tensorTableOffset + index * TENSOR_RECORD_BYTES;
    tensors.push(parseTensor(bytes.subarray(start, start + TENSOR_RECORD_BYTES), strings, header.payloadOffset));
  }
  const names = new Set();
  for (let index = 0; index < tensors.length; index += 1) {
    if (names.has(tensors[index].canonicalName)
        || (index > 0 && compareTensorKeys(tensors[index - 1], tensors[index]) >= 0)) {
      fail("slm2-invalid-tensor-order");
    }
    names.add(tensors[index].canonicalName);
  }
  validateTensorRegistry(spec, tensors);
  const actualLayoutHash = tensorLayoutHash(artifactClass, tensors);
  if (!actualLayoutHash.equals(layoutHash)) fail("slm2-layout-hash-drift");

  let cursor = header.payloadOffset;
  for (const tensor of tensors) {
    const expectedOffset = alignUp(cursor, tensor.payloadAlignment);
    if (tensor.payloadOffset !== expectedOffset) fail("slm2-invalid-payload-layout");
    assertZero(bytes, cursor, tensor.payloadOffset);
    const payload = bytes.subarray(tensor.payloadOffset, tensor.payloadOffset + tensor.payloadLength);
    ensureRange(bytes, tensor.payloadOffset, tensor.payloadLength);
    for (let offset = 0; offset < payload.length; offset += 4) {
      if (!Number.isFinite(payload.readFloatLE(offset))) fail("slm2-nonfinite-f32");
    }
    if (!tensorPayloadHash(artifactClass, tensor, payload).equals(tensor.payloadSha)) {
      fail("slm2-payload-hash-drift");
    }
    cursor = tensor.payloadOffset + tensor.payloadLength;
  }
  if (cursor !== bytes.length) fail("slm2-trailing-bytes");

  return {
    header,
    spec,
    manifestSha256: sha256Hex(manifestBytes),
    tensorLayoutSha256: actualLayoutHash.toString("hex"),
    artifactSha256: sha256Hex(bytes),
    strings,
    tensors: tensors.map((tensor) => ({
      semanticRole: tensor.semanticRole,
      canonicalName: tensor.canonicalName,
      layer: tensor.layer,
      subindex0: tensor.subindex0,
      subindex1: tensor.subindex1,
      shape: tensor.shape,
      logicalElements: tensor.logicalElements,
      payloadRelativeOffset: tensor.payloadRelativeOffset,
      payloadLength: tensor.payloadLength,
      payloadAlignment: tensor.payloadAlignment,
      payloadSha256: tensor.payloadSha.toString("hex")
    })),
    pieceManifest: pieceManifest(bytes)
  };
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
  throw new Error(`unsupported mutation ${mutation.operation}`);
}

function setManifestBooleanTrue(source, key) {
  const bytes = Buffer.from(source);
  const manifestOffset = readU64(bytes, 48);
  const manifestLength = readU64(bytes, 56);
  const keyBytes = Buffer.from(key, "ascii");
  const keyOffset = bytes.indexOf(keyBytes, manifestOffset);
  const valueOffset = keyOffset + keyBytes.length;
  assert.ok(keyOffset >= manifestOffset);
  assert.ok(valueOffset < manifestOffset + manifestLength);
  assert.equal(bytes[valueOffset], 0xf4);
  bytes[valueOffset] = 0xf5;
  return bytes;
}

test("profile publishes the exact independently implemented tensor-role registry", () => {
  assert.deepEqual(profileDocument.tensorRoleRegistry, EXPECTED_TENSOR_ROLE_REGISTRY);
  assert.deepEqual(profileDocument.requirements, {
    exactKeys: [
      "kv_profile", "minimum_runtime", "operator_profile", "tensor_role_profile", "tensor_profile"
    ],
    literalValues: {
      kv_profile: "tinyrustlm.kv-f32/1",
      minimum_runtime: "tinyrustlm.runtime/2.0",
      operator_profile: "tinyrustlm.decoder-f32/1",
      tensor_role_profile: TENSOR_ROLE_PROFILE,
      tensor_profile: "tinyrustlm.tensor-f32/1"
    }
  });
  assert.deepEqual(profileDocument.modelBody.booleanFields, [
    "qk_normalization", "qkv_bias", "tied_embeddings"
  ]);
  assert.ok(profileDocument.modelBody.invariants.includes("tensor-role-registry-complete-and-exact"));
});

test("independently parses and reproduces every checked-in SLM2 vector identity", () => {
  assert.deepEqual(Object.keys(vectorDocument).sort(), ["profileId", "profileSha256", "schema", "vectors"]);
  assert.equal(vectorDocument.schema, "tinyrustlm.vnext.slm2-format-vectors.v1");
  assert.equal(vectorDocument.profileId, "org.minimodel.slm2/2.0");
  assert.equal(sha256Hex(profileBytes), vectorDocument.profileSha256);
  assert.equal(vectorDocument.vectors.length, 1);
  const vector = vectorDocument.vectors[0];
  const bytes = strictHex(vector.artifactHex);
  assert.equal(bytes.length, vector.artifactByteLength);
  const actual = validateArtifact(bytes);
  assert.deepEqual(actual.header, vector.header);
  assert.equal(actual.artifactSha256, vector.artifactSha256);
  assert.equal(actual.manifestSha256, vector.manifestSha256);
  assert.equal(actual.tensorLayoutSha256, vector.tensorLayoutSha256);
  assert.deepEqual(actual.strings, vector.strings);
  assert.deepEqual(actual.tensors, vector.tensors);
  assert.deepEqual(actual.pieceManifest, vector.pieceManifest);
  assert.deepEqual(actual.spec, {
    artifactClass: 1,
    vocabularySize: 32,
    contextLength: 128,
    embeddingSize: 8,
    feedForwardSize: 16,
    layerCount: 1,
    headCount: 2,
    kvHeadCount: 1,
    headDimension: 4,
    ropeTheta: 10_000,
    normalizationEpsilon: Math.fround(0.000_01),
    qkNormalization: false,
    qkvBias: false,
    tiedEmbeddings: true
  });
});

test("independent registry expands every model flag and rejects incomplete or oversized registries", () => {
  const baseSpec = {
    artifactClass: 1,
    vocabularySize: 32,
    contextLength: 128,
    embeddingSize: 8,
    feedForwardSize: 16,
    layerCount: 1,
    headCount: 2,
    kvHeadCount: 1,
    headDimension: 4,
    ropeTheta: 10_000,
    normalizationEpsilon: Math.fround(0.000_01),
    qkNormalization: false,
    qkvBias: false,
    tiedEmbeddings: true
  };
  const base = requiredModelTensors(baseSpec);
  assert.equal(base.length, 11);
  validateTensorRegistry(baseSpec, base);

  const expandedSpec = {
    ...baseSpec,
    qkNormalization: true,
    qkvBias: true,
    tiedEmbeddings: false
  };
  const expanded = requiredModelTensors(expandedSpec);
  assert.equal(expanded.length, 17);
  assert.ok(expanded.some((tensor) => tensor.semanticRole === "model.output-projection.weight"));
  assert.equal(expanded.filter((tensor) => tensor.semanticRole.endsWith(".bias")).length, 3);
  assert.equal(expanded.filter((tensor) => tensor.semanticRole.includes("-normalization.weight")).length, 5);
  validateTensorRegistry(expandedSpec, expanded);

  assert.throws(
    () => validateTensorRegistry(expandedSpec, expanded.slice(1)),
    (error) => error instanceof Slm2ValidationError && error.code === "slm2-invalid-tensor-registry"
  );
  const reshaped = expanded.map((tensor) => ({ ...tensor, shape: [...tensor.shape] }));
  reshaped[0].shape[0] += 1;
  assert.throws(
    () => validateTensorRegistry(expandedSpec, reshaped),
    (error) => error instanceof Slm2ValidationError && error.code === "slm2-invalid-tensor-registry"
  );
  assert.throws(
    () => requiredModelTensors({ ...expandedSpec, layerCount: 0x7fff_ffff }),
    (error) => error instanceof Slm2ValidationError && error.code === "slm2-invalid-tensor-registry"
  );
});

test("independent parser rejects a canonical manifest whose flags require absent tensors", () => {
  const source = strictHex(vectorDocument.vectors[0].artifactHex);
  assert.throws(
    () => validateArtifact(setManifestBooleanTrue(source, "qkv_bias")),
    (error) => error instanceof Slm2ValidationError && error.code === "slm2-invalid-tensor-registry"
  );
});

test("independent parser rejects every frozen hostile artifact mutation", () => {
  const vector = vectorDocument.vectors[0];
  const source = strictHex(vector.artifactHex);
  assert.equal(vector.mutations.length, 5);
  for (const mutation of vector.mutations) {
    assert.throws(
      () => validateArtifact(applyMutation(source, mutation)),
      (error) => error instanceof Slm2ValidationError && error.code === mutation.expectedError,
      mutation.id
    );
  }
});

test("independent SLM-DCBOR-1 parser rejects noncanonical and unbounded forms", () => {
  const hostile = [
    Buffer.from([0x18, 0x01]),
    Buffer.from([0xa2, 0x61, 0x61, 0x01, 0x61, 0x61, 0x02]),
    Buffer.from([0x9f, 0xff]),
    Buffer.from([0xf9, 0x00, 0x00]),
    Buffer.from([0xc0, 0x00]),
    Buffer.from([0x00, 0x00]),
    Buffer.from([0x61, 0x80]),
    Buffer.from([0xa1, 0x01, 0x00])
  ];
  for (const bytes of hostile) {
    assert.throws(
      () => decodeDcbor(bytes),
      (error) => error instanceof Slm2ValidationError && error.code === "slm2-invalid-metadata"
    );
  }
});
