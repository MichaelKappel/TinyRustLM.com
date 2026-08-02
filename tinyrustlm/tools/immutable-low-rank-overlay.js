"use strict";

const crypto = require("node:crypto");

const MAGIC = "SLO1";
const VERSION = 1;
const HEADER_BYTES = 320;
const ENTRY_BYTES = 128;
const ALIGNMENT = 64;
const MAX_TARGETS = 256;
const MAX_FACTOR_RANK = 64;
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const FORMAT_TAG = 1;
const sha256Pattern = /^[a-f0-9]{64}$/u;

/** Throws when an overlay invariant is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns true only for ordinary JavaScript objects. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/** Requires an object to contain exactly the declared keys. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    `${label} keys are invalid`
  );
}

/** Computes lowercase SHA-256 over exact bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Aligns one safe integer to the frozen 64-byte boundary. */
function align64(value) {
  invariant(Number.isSafeInteger(value) && value >= 0,
    "alignment input is invalid");
  const aligned = Math.ceil(value / ALIGNMENT) * ALIGNMENT;
  invariant(Number.isSafeInteger(aligned), "aligned value is invalid");
  return aligned;
}

/** Reads one little-endian u64 that fits a JavaScript safe integer. */
function readSafeU64(bytes, offset, label) {
  const value = bytes.readBigUInt64LE(offset);
  invariant(value <= BigInt(Number.MAX_SAFE_INTEGER),
    `${label} exceeds the safe integer range`);
  return Number(value);
}

/** Requires one byte range to be present and entirely zero. */
function requireZero(bytes, start, end, label) {
  invariant(
    Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
      start >= 0 && start <= end && end <= bytes.length,
    `${label} range is invalid`
  );
  invariant(bytes.subarray(start, end).every((byte) => byte === 0),
    `${label} must be zero`);
}

/** Requires and returns one lowercase nonzero SHA-256 string. */
function requireDigest(value, label) {
  invariant(typeof value === "string" && sha256Pattern.test(value) &&
    value !== "0".repeat(64), `${label} is invalid`);
  return value;
}

/** Reads one exact 32-byte digest as lowercase hexadecimal. */
function readDigest(bytes, offset) {
  return bytes.subarray(offset, offset + 32).toString("hex");
}

/** Reads finite little-endian f32 values from one exact range. */
function readF32Values(bytes, offset, count, label) {
  invariant(
    Number.isSafeInteger(count) && count > 0 &&
      offset >= 0 && offset + count * 4 <= bytes.length,
    `${label} range is invalid`
  );
  const values = Array.from({ length: count }, (_, index) =>
    bytes.readFloatLE(offset + index * 4));
  invariant(values.every(Number.isFinite), `${label} contains nonfinite data`);
  return Object.freeze(values);
}

/** Validates the expected base and tensor metadata supplied by a model loader. */
function validateExpected(expected) {
  exactKeys(expected, ["packageSha256", "base", "tensors"], "expected");
  requireDigest(expected.packageSha256, "expected package SHA-256");
  exactKeys(expected.base, [
    "modelSha256", "standaloneContentDigest", "tokenizerSha256",
    "chatTemplateSha256", "tensorLayoutSha256",
    "quantizationProfileSha256", "executionProfileSha256"
  ], "expected base");
  for (const [name, digest] of Object.entries(expected.base)) {
    requireDigest(digest, `expected base ${name}`);
  }
  invariant(Array.isArray(expected.tensors), "expected tensors are invalid");
  expected.tensors.forEach((tensor, index) => {
    exactKeys(tensor, [
      "nameHashHex", "dtype", "rank", "dim0", "dim1", "dim2", "dim3",
      "blockSize"
    ], `expected tensor ${index}`);
    invariant(
      /^[a-f0-9]{16}$/u.test(tensor.nameHashHex) &&
        [tensor.dtype, tensor.rank, tensor.dim0, tensor.dim1, tensor.dim2,
          tensor.dim3, tensor.blockSize]
          .every((value) => Number.isSafeInteger(value) && value >= 0),
      `expected tensor ${index} is invalid`
    );
  });
}

/** Validates one source dtype and block-size pairing. */
function validateSourceBlockSize(dtype, blockSize, cols) {
  const valid = dtype === 1
    ? blockSize === 0
    : dtype === 2
      ? blockSize === cols
      : dtype === 3
        ? blockSize > 0 && blockSize % 2 === 0 && cols % blockSize === 0
        : dtype === 4
          ? blockSize > 0 && blockSize % 8 === 0 &&
            cols % blockSize === 0
          : false;
  invariant(valid, "source dtype or block size is invalid");
}

/** Parses and validates one canonical target entry and factor payload. */
function parseTarget(bytes, entryOffset, modelTensors, priorTensorIndex,
  expectedOutputOffset, priorFactorEnd) {
  const tensorIndex = bytes.readUInt32LE(entryOffset);
  invariant(priorTensorIndex === null || tensorIndex > priorTensorIndex,
    "target tensor indices are not strictly increasing");
  const modelTensor = modelTensors[tensorIndex];
  invariant(modelTensor !== undefined, "target tensor index is invalid");
  const factorRank = bytes.readUInt32LE(entryOffset + 4);
  const rows = bytes.readUInt32LE(entryOffset + 8);
  const cols = bytes.readUInt32LE(entryOffset + 12);
  invariant(
    rows > 0 && cols > 0 && factorRank > 0 &&
      factorRank <= MAX_FACTOR_RANK &&
      factorRank <= rows && factorRank <= cols,
    "target factor shape is invalid"
  );
  const tensorNameHashHex = bytes.readBigUInt64LE(entryOffset + 16)
    .toString(16).padStart(16, "0");
  const sourceDtype = bytes.readUInt32LE(entryOffset + 24);
  const sourceBlockSize = bytes.readUInt32LE(entryOffset + 28);
  invariant(
    tensorNameHashHex === modelTensor.nameHashHex &&
      sourceDtype === modelTensor.dtype &&
      sourceBlockSize === modelTensor.blockSize &&
      bytes.readUInt32LE(entryOffset + 32) === 2 &&
      bytes.readUInt32LE(entryOffset + 36) === rows &&
      bytes.readUInt32LE(entryOffset + 40) === cols &&
      bytes.readUInt32LE(entryOffset + 44) === 0 &&
      bytes.readUInt32LE(entryOffset + 48) === 0 &&
      modelTensor.rank === 2 &&
      modelTensor.dim0 === rows &&
      modelTensor.dim1 === cols,
    "target model binding is invalid"
  );
  validateSourceBlockSize(sourceDtype, sourceBlockSize, cols);
  const scale = bytes.readFloatLE(entryOffset + 52);
  invariant(Number.isFinite(scale) && scale !== 0,
    "target scale is invalid");

  const outputCount = factorRank * rows;
  const inputCount = factorRank * cols;
  invariant(Number.isSafeInteger(outputCount) &&
    Number.isSafeInteger(inputCount), "target factor count is invalid");
  const outputFactorOffset =
    readSafeU64(bytes, entryOffset + 56, "output factor offset");
  const outputFactorBytes =
    readSafeU64(bytes, entryOffset + 64, "output factor bytes");
  const inputFactorOffset =
    readSafeU64(bytes, entryOffset + 72, "input factor offset");
  const inputFactorBytes =
    readSafeU64(bytes, entryOffset + 80, "input factor bytes");
  invariant(
    outputFactorOffset === expectedOutputOffset &&
      outputFactorBytes === outputCount * 4 &&
      inputFactorOffset === outputFactorOffset + outputFactorBytes &&
      inputFactorBytes === inputCount * 4,
    "target factor layout is invalid"
  );
  requireZero(bytes, priorFactorEnd, outputFactorOffset,
    "target payload padding");
  const factorEnd = inputFactorOffset + inputFactorBytes;
  invariant(Number.isSafeInteger(factorEnd) && factorEnd <= bytes.length,
    "target factor range is invalid");
  const declaredFactorSha256 = readDigest(bytes, entryOffset + 88);
  requireDigest(declaredFactorSha256, "target factor SHA-256");
  invariant(
    sha256(bytes.subarray(outputFactorOffset, factorEnd)) ===
      declaredFactorSha256,
    "target factor SHA-256 does not match"
  );
  requireZero(bytes, entryOffset + 120, entryOffset + ENTRY_BYTES,
    "target reserved bytes");
  const outputFactors = readF32Values(
    bytes, outputFactorOffset, outputCount, "output factors");
  const inputFactors = readF32Values(
    bytes, inputFactorOffset, inputCount, "input factors");
  for (let component = 0; component < factorRank; component += 1) {
    invariant(
      outputFactors
        .slice(component * rows, (component + 1) * rows)
        .some((value) => value !== 0) &&
      inputFactors
        .slice(component * cols, (component + 1) * cols)
        .some((value) => value !== 0),
      "target contains an empty rank component"
    );
  }
  return Object.freeze({
    tensorIndex,
    tensorNameHashHex,
    sourceDtype,
    sourceBlockSize,
    rows,
    cols,
    factorRank,
    scale,
    outputFactors,
    inputFactors,
    factorEnd
  });
}

/** Parses a complete immutable SLO1 package without mutating model state. */
function parseSpecialistOverlay(input, expected) {
  invariant(Buffer.isBuffer(input), "overlay bytes must be a Buffer");
  validateExpected(expected);
  const bytes = input;
  invariant(
    bytes.length >= HEADER_BYTES &&
      bytes.length <= MAX_PACKAGE_BYTES &&
      bytes.length % ALIGNMENT === 0,
    "overlay byte length is invalid"
  );
  invariant(sha256(bytes) === expected.packageSha256,
    "overlay package SHA-256 does not match");
  invariant(bytes.subarray(0, 4).toString("ascii") === MAGIC,
    "overlay magic is invalid");
  invariant(bytes.readUInt32LE(4) === VERSION,
    "overlay version is unsupported");
  invariant(
    bytes.readUInt32LE(8) === HEADER_BYTES &&
      bytes.readUInt32LE(12) === 0 &&
      bytes.readUInt32LE(20) === ENTRY_BYTES &&
      readSafeU64(bytes, 24, "directory offset") === HEADER_BYTES &&
      readSafeU64(bytes, 40, "total byte count") === bytes.length,
    "overlay header is invalid"
  );
  const targetCount = bytes.readUInt32LE(16);
  invariant(targetCount > 0 && targetCount <= MAX_TARGETS,
    "overlay target count is invalid");
  const directoryEnd = HEADER_BYTES + targetCount * ENTRY_BYTES;
  invariant(Number.isSafeInteger(directoryEnd),
    "overlay directory length is invalid");
  const payloadOffset = readSafeU64(bytes, 32, "payload offset");
  invariant(payloadOffset === align64(directoryEnd),
    "overlay payload offset is invalid");
  invariant(
    bytes.readUInt32LE(48) === FORMAT_TAG &&
      bytes.readUInt32LE(52) === FORMAT_TAG &&
      bytes.readUInt32LE(56) === FORMAT_TAG &&
      bytes.readUInt32LE(60) === FORMAT_TAG,
    "overlay format tag is invalid"
  );
  const expectedDigests = [
    expected.base.modelSha256,
    expected.base.standaloneContentDigest,
    expected.base.tokenizerSha256,
    expected.base.chatTemplateSha256,
    expected.base.tensorLayoutSha256,
    expected.base.quantizationProfileSha256,
    expected.base.executionProfileSha256
  ];
  expectedDigests.forEach((digest, index) => {
    invariant(readDigest(bytes, 64 + index * 32) === digest,
      `overlay base digest ${index} does not match`);
  });
  requireZero(bytes, 288, HEADER_BYTES, "overlay header reserved bytes");
  requireZero(bytes, directoryEnd, payloadOffset,
    "overlay directory padding");

  const targets = [];
  let priorTensorIndex = null;
  let expectedOutputOffset = payloadOffset;
  let priorFactorEnd = payloadOffset;
  let maximumFactorRank = 0;
  for (let index = 0; index < targetCount; index += 1) {
    const target = parseTarget(
      bytes,
      HEADER_BYTES + index * ENTRY_BYTES,
      expected.tensors,
      priorTensorIndex,
      expectedOutputOffset,
      priorFactorEnd
    );
    targets.push(target);
    priorTensorIndex = target.tensorIndex;
    priorFactorEnd = target.factorEnd;
    expectedOutputOffset = align64(priorFactorEnd);
    maximumFactorRank = Math.max(maximumFactorRank, target.factorRank);
  }
  invariant(expectedOutputOffset === bytes.length,
    "overlay canonical final length is invalid");
  requireZero(bytes, priorFactorEnd, bytes.length,
    "overlay final padding");
  return Object.freeze({
    packageSha256: expected.packageSha256,
    baseModelSha256: expected.base.modelSha256,
    maximumFactorRank,
    targets: Object.freeze(targets)
  });
}

/** Applies explicit f32 rounding after one arithmetic operation. */
function f32(value) {
  return Math.fround(value);
}

/** Finds one target in a strictly sorted parsed overlay. */
function findTarget(overlay, tensorIndex) {
  let low = 0;
  let high = overlay.targets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = overlay.targets[middle];
    if (candidate.tensorIndex < tensorIndex) low = middle + 1;
    else high = middle;
  }
  return overlay.targets[low]?.tensorIndex === tensorIndex
    ? overlay.targets[low]
    : null;
}

/** Adds one parsed overlay to an already computed native base output. */
function applySpecialistOverlay(overlay, tensorIndex, vector, baseOutput) {
  invariant(
    Number.isSafeInteger(tensorIndex) && tensorIndex >= 0 &&
      Array.isArray(vector) && vector.every(Number.isFinite) &&
      Array.isArray(baseOutput) && baseOutput.every(Number.isFinite),
    "overlay call arguments are invalid"
  );
  const target = findTarget(overlay, tensorIndex);
  if (target === null) {
    return Object.freeze({
      output: Object.freeze(baseOutput.map(f32)),
      scratch: Object.freeze([])
    });
  }
  invariant(
    vector.length === target.cols && baseOutput.length === target.rows,
    "overlay call shape is invalid"
  );
  const scratch = Array.from({ length: target.factorRank }, (_, component) => {
    let sum = 0;
    for (let col = 0; col < target.cols; col += 1) {
      sum = f32(sum + f32(
        f32(target.inputFactors[component * target.cols + col]) *
        f32(vector[col])
      ));
    }
    return sum;
  });
  const output = baseOutput.map((base, row) => {
    let delta = 0;
    for (let component = 0; component < target.factorRank; component += 1) {
      delta = f32(delta + f32(
        f32(target.outputFactors[component * target.rows + row]) *
        scratch[component]
      ));
    }
    return f32(f32(base) + f32(f32(target.scale) * delta));
  });
  return Object.freeze({
    output: Object.freeze(output),
    scratch: Object.freeze(scratch)
  });
}

/** Computes a high-precision materialized delta-weight reference matvec. */
function materializedOverlayMatvec(overlay, tensorIndex, baseWeights, vector) {
  const target = findTarget(overlay, tensorIndex);
  invariant(target !== null, "materialized reference target is absent");
  invariant(
    Array.isArray(baseWeights) &&
      baseWeights.length === target.rows * target.cols &&
      baseWeights.every(Number.isFinite) &&
      Array.isArray(vector) &&
      vector.length === target.cols &&
      vector.every(Number.isFinite),
    "materialized reference shape is invalid"
  );
  return Object.freeze(Array.from({ length: target.rows }, (_, row) => {
    let sum = 0;
    for (let col = 0; col < target.cols; col += 1) {
      let deltaWeight = 0;
      for (let component = 0;
        component < target.factorRank;
        component += 1) {
        deltaWeight +=
          target.outputFactors[component * target.rows + row] *
          target.inputFactors[component * target.cols + col];
      }
      const weight = baseWeights[row * target.cols + col] +
        target.scale * deltaWeight;
      sum += weight * vector[col];
    }
    return sum;
  }));
}

module.exports = Object.freeze({
  ALIGNMENT,
  ENTRY_BYTES,
  HEADER_BYTES,
  MAGIC,
  MAX_FACTOR_RANK,
  MAX_PACKAGE_BYTES,
  MAX_TARGETS,
  VERSION,
  applySpecialistOverlay,
  materializedOverlayMatvec,
  parseSpecialistOverlay,
  sha256
});
