"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const manifestRelativePath =
  "tinyrustlm/experiments/specialist-portfolio/" +
  "immutable-low-rank-overlay-preregistration.v1.json";
const manifestPath = path.join(repositoryRoot, manifestRelativePath);
const expectedSchema =
  "tinyrustlm.immutable_low_rank_overlay_preregistration.v1";
const expectedExperimentId =
  "immutable-low-rank-specialist-overlay-20260725";
const expectedManifestBytes = 22264;
const expectedManifestSha256 =
  "0bf13b559d11d2d0e0bd70fbaccdc722138eab7d3ccef5574de220eaa7d2a3b1";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const typedIdentityPattern = /^02[a-f0-9]{64}$/u;

const expectedBinaryFormat = Object.freeze({
  name: "Specialist Low-Rank Overlay",
  magic: "SLO1",
  version: 1,
  byteOrder: "little-endian",
  headerLength: 320,
  directoryEntryLength: 128,
  alignment: 64,
  maximumTargetCount: 256,
  maximumFactorRank: 64,
  maximumPackageBytes: 536870912,
  flags: {
    value: 0,
    unknownBits: "reject"
  },
  semantics: {
    tag: 1,
    name: "additive-direct"
  },
  factorDtype: {
    tag: 1,
    name: "f32-le"
  },
  factorLayout: {
    tag: 1,
    name: "component-major-output-then-input"
  },
  arithmetic: {
    tag: 1,
    name: "base-native-matvec-then-f32-overlay"
  },
  packageIdentity:
    "SHA-256 over every exact package byte, supplied and verified outside " +
    "the self-describing header",
  unknownValuePolicy: "reject",
  trailingBytePolicy: "reject"
});

const expectedHeaderFields = Object.freeze([
  ["magic", 0, 4, "ascii", "exactly-SLO1"],
  ["formatVersion", 4, 4, "u32", "exactly-1"],
  ["headerLength", 8, 4, "u32", "exactly-320"],
  ["flags", 12, 4, "u32", "exactly-zero"],
  ["targetCount", 16, 4, "u32", "one-through-256"],
  ["directoryEntryLength", 20, 4, "u32", "exactly-128"],
  ["directoryOffset", 24, 8, "u64", "exactly-320"],
  ["payloadOffset", 32, 8, "u64",
    "align64(headerLength-plus-targetCount-times-directoryEntryLength)"],
  ["totalByteCount", 40, 8, "u64",
    "exact-file-length-aligned-to-64-and-no-more-than-536870912"],
  ["semantics", 48, 4, "u32", "exactly-1-additive-direct"],
  ["factorDtype", 52, 4, "u32", "exactly-1-f32-le"],
  ["factorLayout", 56, 4, "u32",
    "exactly-1-component-major-output-then-input"],
  ["arithmetic", 60, 4, "u32",
    "exactly-1-base-native-matvec-then-f32-overlay"],
  ["baseModelSha256", 64, 32, "digest",
    "exact-nonzero-SHA-256-of-base-model-bytes"],
  ["baseStandaloneContentDigest", 96, 32, "digest",
    "exact-nonzero-standalone-model-content-identity-digest"],
  ["tokenizerSha256", 128, 32, "digest",
    "exact-nonzero-execution-binding"],
  ["chatTemplateSha256", 160, 32, "digest",
    "exact-nonzero-execution-binding"],
  ["tensorLayoutSha256", 192, 32, "digest",
    "exact-nonzero-execution-binding"],
  ["quantizationProfileSha256", 224, 32, "digest",
    "exact-nonzero-execution-binding"],
  ["executionProfileSha256", 256, 32, "digest",
    "exact-nonzero-execution-binding"],
  ["reserved", 288, 32, "bytes", "all-zero"]
]);

const expectedDirectoryFields = Object.freeze([
  ["tensorIndex", 0, 4, "u32",
    "strictly-increasing-and-exact-loaded-model-index"],
  ["factorRank", 4, 4, "u32",
    "one-through-minimum-of-64-rows-and-cols"],
  ["rows", 8, 4, "u32",
    "positive-and-exact-loaded-model-row-count"],
  ["cols", 12, 4, "u32",
    "positive-and-exact-loaded-model-column-count"],
  ["tensorNameHash", 16, 8, "u64",
    "exact-loaded-model-tensor-name-hash"],
  ["sourceDtype", 24, 4, "u32",
    "supported-source-dtype-and-exact-loaded-model-dtype"],
  ["sourceBlockSize", 28, 4, "u32",
    "dtype-specific-and-exact-loaded-model-block-size"],
  ["tensorRank", 32, 4, "u32", "exactly-2"],
  ["dim0", 36, 4, "u32", "exactly-rows"],
  ["dim1", 40, 4, "u32", "exactly-cols"],
  ["dim2", 44, 4, "u32", "exactly-zero"],
  ["dim3", 48, 4, "u32", "exactly-zero"],
  ["scale", 52, 4, "f32", "finite-and-nonzero"],
  ["outputFactorOffset", 56, 8, "u64",
    "align64-of-prior-target-end-or-payloadOffset-for-first-target"],
  ["outputFactorBytes", 64, 8, "u64",
    "exactly-factorRank-times-rows-times-four"],
  ["inputFactorOffset", 72, 8, "u64",
    "exactly-outputFactorOffset-plus-outputFactorBytes"],
  ["inputFactorBytes", 80, 8, "u64",
    "exactly-factorRank-times-cols-times-four"],
  ["factorPayloadSha256", 88, 32, "digest",
    "SHA-256-of-exact-concatenated-output-and-input-factor-bytes"],
  ["reserved", 120, 8, "bytes", "all-zero"]
]);

const expectedSourceDtypes = Object.freeze([
  ["f32", 1, "exactly-zero"],
  ["q8_0", 2, "exactly-cols"],
  ["q4_0", 3, "positive-even-divisor-of-cols"],
  ["q5_0", 4, "positive-multiple-of-eight-divisor-of-cols"]
]);

const expectedFixture = Object.freeze({
  bytes: 576,
  factorPayloadSha256:
    "dbeca01321757007acb3edec02653d6922e40388289c148131696bc7e461feee",
  packageSha256:
    "9e4181606e362b6fc970ed8d6dd1e3325fe7f0a3ce2eb48e5f837380e5b8f07f"
});

const expectedPrimary = Object.freeze({
  componentDots: [0.125, 1.625],
  delta: [0.46875, 1.1875, -0.796875]
});

const expectedSecondary = Object.freeze({
  componentDots: [-0.25],
  delta: [0.03125, -0.0625, 0.125]
});

const expectedSourceOutputs = Object.freeze({
  f32: {
    base: [-1.0625, 2, 2.625],
    primary: [-0.59375, 3.1875, 1.828125],
    combined: [-0.5625, 3.125, 1.953125]
  },
  q8_0: {
    base: [-1.0625, 2, 2.625],
    primary: [-0.59375, 3.1875, 1.828125],
    combined: [-0.5625, 3.125, 1.953125]
  },
  q5_0: {
    base: [-1.0625, 2, 2.625],
    primary: [-0.59375, 3.1875, 1.828125],
    combined: [-0.5625, 3.125, 1.953125]
  },
  q4_0: {
    base: [-1.1875, 2.125, 2.625],
    primary: [-0.71875, 3.3125, 1.828125],
    combined: [-0.6875, 3.25, 1.953125]
  }
});

const expectedSourceCaseOrder = Object.freeze([
  "f32",
  "q8_0",
  "q5_0",
  "q4_0"
]);

/** Throws when a preregistration invariant is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns true only for ordinary JSON objects. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/** Requires one object to contain exactly the declared keys. */
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

/** Requires exact canonical structural equality. */
function exactStructure(value, expected, label) {
  invariant(canonicalJson(value) === canonicalJson(expected),
    `${label} is invalid`);
}

/** Computes lowercase SHA-256 for exact bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Returns true when every byte in a slice is zero. */
function isZeroRange(bytes, start, end) {
  return bytes.subarray(start, end).every((value) => value === 0);
}

/** Reads one u64 that must fit exactly in JavaScript's safe integer range. */
function readSafeU64(bytes, offset, label) {
  const value = bytes.readBigUInt64LE(offset);
  invariant(value <= BigInt(Number.MAX_SAFE_INTEGER),
    `${label} exceeds safe integer range`);
  return Number(value);
}

/** Reads contiguous little-endian f32 values. */
function readF32Values(bytes, offset, count) {
  return Array.from({ length: count },
    (_, index) => bytes.readFloatLE(offset + index * 4));
}

/** Applies explicit f32 rounding after one arithmetic operation. */
function f32(value) {
  return Math.fround(value);
}

/** Computes one f32 dot product in increasing element order. */
function dotF32(left, right) {
  invariant(left.length === right.length, "dot product shape is invalid");
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum = f32(sum + f32(f32(left[index]) * f32(right[index])));
  }
  return sum;
}

/** Decodes one signed integer represented by a fixed bit width. */
function signExtend(value, bits) {
  const sign = 1 << (bits - 1);
  const mask = (1 << bits) - 1;
  const normalized = value & mask;
  return normalized >= sign ? normalized - (1 << bits) : normalized;
}

/** Decodes row-major source weights from the frozen storage fixture. */
function decodeSourceWeights(source, rows, cols) {
  const storage = source.storage;
  if (source.name === "f32") return [...storage.values];
  if (source.name === "q8_0") {
    return storage.codes.map((code, index) =>
      f32(code * storage.scales[Math.floor(index / cols)]));
  }
  const packed = Buffer.from(storage.packedHex, "hex");
  if (source.name === "q4_0") {
    const values = [];
    for (const byte of packed) {
      values.push(signExtend(byte & 0x0f, 4));
      values.push(signExtend(byte >>> 4, 4));
    }
    return values.map((code, index) => {
      const block = Math.floor((index % cols) / source.blockSize);
      const blocksPerRow = cols / source.blockSize;
      const row = Math.floor(index / cols);
      return f32(code * storage.scales[row * blocksPerRow + block]);
    });
  }
  invariant(source.name === "q5_0", "source case name is invalid");
  const values = [];
  for (let group = 0; group < packed.length / 5; group += 1) {
    let word = 0n;
    for (let byte = 0; byte < 5; byte += 1) {
      word |= BigInt(packed[group * 5 + byte]) << BigInt(byte * 8);
    }
    for (let lane = 0; lane < 8; lane += 1) {
      values.push(signExtend(
        Number((word >> BigInt(lane * 5)) & 0x1fn), 5));
    }
  }
  return values.map((code, index) => {
    const block = Math.floor((index % cols) / source.blockSize);
    const blocksPerRow = cols / source.blockSize;
    const row = Math.floor(index / cols);
    return f32(code * storage.scales[row * blocksPerRow + block]);
  });
}

/** Computes the frozen native-source reference output. */
function calculateBaseOutput(source, inputVector, rows, cols) {
  const weights = decodeSourceWeights(source, rows, cols);
  invariant(weights.length === rows * cols,
    `${source.name} decoded weight count is invalid`);
  return Array.from({ length: rows }, (_, row) =>
    dotF32(weights.slice(row * cols, (row + 1) * cols), inputVector));
}

/** Computes direct low-rank component dots and row deltas. */
function calculateOverlay(overlay, inputVector) {
  const componentDots = Array.from({ length: overlay.factorRank }, (_, k) =>
    dotF32(
      overlay.inputFactors.slice(k * overlay.cols, (k + 1) * overlay.cols),
      inputVector
    ));
  const delta = Array.from({ length: overlay.rows }, (_, row) => {
    let sum = 0;
    for (let k = 0; k < overlay.factorRank; k += 1) {
      sum = f32(sum + f32(
        f32(overlay.outputFactors[k * overlay.rows + row]) *
        componentDots[k]
      ));
    }
    return f32(f32(overlay.scale) * sum);
  });
  return Object.freeze({ componentDots, delta });
}

/** Adds one frozen output vector using f32 arithmetic. */
function addF32(left, right) {
  invariant(left.length === right.length, "output vector shape is invalid");
  return left.map((value, index) => f32(value + right[index]));
}

/** Validates the exact frozen binary fixture and returns decoded factors. */
function validateBinaryFixture(testVector) {
  const fixture = testVector.binaryFixture;
  const bytes = Buffer.from(fixture.packageHex, "hex");
  invariant(bytes.length === expectedFixture.bytes,
    "binary fixture byte count is invalid");
  invariant(sha256(bytes) === expectedFixture.packageSha256,
    "binary fixture package hash is invalid");
  invariant(bytes.subarray(0, 4).toString("ascii") === "SLO1",
    "binary fixture magic is invalid");
  invariant(bytes.readUInt32LE(4) === 1, "binary fixture version is invalid");
  invariant(bytes.readUInt32LE(8) === 320,
    "binary fixture header length is invalid");
  invariant(bytes.readUInt32LE(12) === 0,
    "binary fixture flags are invalid");
  invariant(bytes.readUInt32LE(16) === fixture.targetCount,
    "binary fixture target count is invalid");
  invariant(bytes.readUInt32LE(20) === 128,
    "binary fixture entry length is invalid");
  invariant(readSafeU64(bytes, 24, "directory offset") ===
    fixture.directoryOffset, "binary fixture directory offset is invalid");
  invariant(readSafeU64(bytes, 32, "payload offset") === fixture.payloadOffset,
    "binary fixture payload offset is invalid");
  invariant(readSafeU64(bytes, 40, "total byte count") ===
    fixture.totalByteCount, "binary fixture total byte count is invalid");
  invariant(
    bytes.readUInt32LE(48) === 1 &&
      bytes.readUInt32LE(52) === 1 &&
      bytes.readUInt32LE(56) === 1 &&
      bytes.readUInt32LE(60) === 1,
    "binary fixture format tags are invalid"
  );
  for (const [offset, octet] of [
    [64, fixture.baseModelDigestOctet],
    [96, fixture.baseStandaloneContentDigestOctet],
    [128, fixture.tokenizerDigestOctet],
    [160, fixture.chatTemplateDigestOctet],
    [192, fixture.tensorLayoutDigestOctet],
    [224, fixture.quantizationProfileDigestOctet],
    [256, fixture.executionProfileDigestOctet]
  ]) {
    invariant(bytes.subarray(offset, offset + 32)
      .every((value) => value === octet),
    `binary fixture digest at ${offset} is invalid`);
  }
  invariant(isZeroRange(bytes, 288, 320),
    "binary fixture header reserved bytes are invalid");

  const entry = fixture.directoryOffset;
  invariant(bytes.readUInt32LE(entry) === fixture.tensorIndex,
    "binary fixture tensor index is invalid");
  invariant(bytes.readUInt32LE(entry + 4) === fixture.factorRank,
    "binary fixture factor rank is invalid");
  invariant(bytes.readUInt32LE(entry + 8) === fixture.rows,
    "binary fixture rows are invalid");
  invariant(bytes.readUInt32LE(entry + 12) === fixture.cols,
    "binary fixture cols are invalid");
  invariant(
    bytes.readBigUInt64LE(entry + 16).toString(16).padStart(16, "0") ===
      fixture.tensorNameHashHex,
    "binary fixture tensor name hash is invalid"
  );
  invariant(bytes.readUInt32LE(entry + 24) === fixture.sourceDtype,
    "binary fixture source dtype is invalid");
  invariant(bytes.readUInt32LE(entry + 28) === fixture.sourceBlockSize,
    "binary fixture source block size is invalid");
  invariant(
    bytes.readUInt32LE(entry + 32) === 2 &&
      bytes.readUInt32LE(entry + 36) === fixture.rows &&
      bytes.readUInt32LE(entry + 40) === fixture.cols &&
      bytes.readUInt32LE(entry + 44) === 0 &&
      bytes.readUInt32LE(entry + 48) === 0,
    "binary fixture tensor dimensions are invalid"
  );
  invariant(bytes.readFloatLE(entry + 52) === fixture.scale,
    "binary fixture scale is invalid");
  for (const [offset, expected, label] of [
    [entry + 56, fixture.outputFactorOffset, "output offset"],
    [entry + 64, fixture.outputFactorBytes, "output bytes"],
    [entry + 72, fixture.inputFactorOffset, "input offset"],
    [entry + 80, fixture.inputFactorBytes, "input bytes"]
  ]) {
    invariant(readSafeU64(bytes, offset, label) === expected,
      `binary fixture ${label} is invalid`);
  }
  invariant(bytes.subarray(entry + 88, entry + 120).toString("hex") ===
    fixture.factorPayloadSha256,
  "binary fixture factor hash field is invalid");
  invariant(isZeroRange(bytes, entry + 120, entry + 128),
    "binary fixture entry reserved bytes are invalid");
  invariant(isZeroRange(bytes, entry + 128, fixture.payloadOffset),
    "binary fixture directory padding is invalid");

  const factorEnd = fixture.inputFactorOffset + fixture.inputFactorBytes;
  const factorBytes = bytes.subarray(fixture.outputFactorOffset, factorEnd);
  invariant(sha256(factorBytes) === expectedFixture.factorPayloadSha256,
    "binary fixture factor payload hash is invalid");
  invariant(isZeroRange(bytes, factorEnd, fixture.totalByteCount),
    "binary fixture final padding is invalid");
  const outputFactors = readF32Values(
    bytes, fixture.outputFactorOffset, fixture.outputFactorBytes / 4);
  const inputFactors = readF32Values(
    bytes, fixture.inputFactorOffset, fixture.inputFactorBytes / 4);
  exactStructure(outputFactors, testVector.primaryOverlay.outputFactors,
    "binary fixture output factors");
  exactStructure(inputFactors, testVector.primaryOverlay.inputFactors,
    "binary fixture input factors");
  return Object.freeze({ bytes, outputFactors, inputFactors });
}

/** Validates the frozen immutable-overlay preregistration object. */
function validateManifest(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "scope", "binaryFormat",
    "headerFields", "directoryFields", "sourceDtypes", "validationRules",
    "runtimeMath", "compositionAndKvRules", "testVector", "authority",
    "requiredNextGate"
  ], "manifest");
  invariant(value.schema === expectedSchema, "manifest schema is invalid");
  invariant(value.experimentId === expectedExperimentId,
    "manifest experiment id is invalid");
  invariant(value.status === "preregistered-no-runtime-authority",
    "manifest status is invalid");

  exactKeys(value.scope, [
    "purpose", "preReleaseRewrite", "legacyCompatibility",
    "acceptedLegacyMagics", "rejectedLegacyMagics",
    "mutableBaseTensorUpdatesPermitted", "runtimeImplementationClaimed",
    "runtimeActivationClaimed", "modelAdoptionClaimed", "trainingClaimed",
    "browserClaimed", "releaseClaimed"
  ], "scope");
  invariant(
    value.scope.preReleaseRewrite === true &&
      value.scope.legacyCompatibility === false &&
      value.scope.acceptedLegacyMagics.length === 0 &&
      canonicalJson(value.scope.rejectedLegacyMagics) ===
        canonicalJson(["ADP1", "ASP1", "ALR1"]) &&
      value.scope.mutableBaseTensorUpdatesPermitted === false,
    "scope clean-slate contract is invalid"
  );
  for (const key of [
    "runtimeImplementationClaimed", "runtimeActivationClaimed",
    "modelAdoptionClaimed", "trainingClaimed", "browserClaimed",
    "releaseClaimed"
  ]) {
    invariant(value.scope[key] === false, `scope ${key} is inflated`);
  }

  exactStructure(value.binaryFormat, expectedBinaryFormat, "binary format");
  invariant(
    Array.isArray(value.headerFields) &&
      value.headerFields.length === expectedHeaderFields.length,
    "header field count is invalid"
  );
  value.headerFields.forEach((field, index) => {
    exactKeys(field, ["name", "offset", "length", "type", "rule"],
      `header field ${index}`);
    exactStructure(
      [field.name, field.offset, field.length, field.type, field.rule],
      expectedHeaderFields[index],
      `header field ${index}`
    );
  });
  invariant(
    Array.isArray(value.directoryFields) &&
      value.directoryFields.length === expectedDirectoryFields.length,
    "directory field count is invalid"
  );
  value.directoryFields.forEach((field, index) => {
    exactKeys(field, ["name", "offset", "length", "type", "rule"],
      `directory field ${index}`);
    exactStructure(
      [field.name, field.offset, field.length, field.type, field.rule],
      expectedDirectoryFields[index],
      `directory field ${index}`
    );
  });
  invariant(
    Array.isArray(value.sourceDtypes) &&
      value.sourceDtypes.length === expectedSourceDtypes.length,
    "source dtype count is invalid"
  );
  value.sourceDtypes.forEach((dtype, index) => {
    exactKeys(dtype, ["name", "tag", "blockSizeRule"],
      `source dtype ${index}`);
    exactStructure(
      [dtype.name, dtype.tag, dtype.blockSizeRule],
      expectedSourceDtypes[index],
      `source dtype ${index}`
    );
  });
  invariant(
    Array.isArray(value.validationRules) &&
      value.validationRules.length === 15 &&
      value.validationRules.every((rule) =>
        typeof rule === "string" && rule.length >= 70),
    "validation rules are invalid"
  );

  exactKeys(value.runtimeMath, [
    "deltaWeightFormula", "componentDotFormula", "overlayOutputFormula",
    "executionOrder", "scratchElements", "baseTensorMutation",
    "factorMutation", "expandedDeltaTensor", "dequantizedModelShadow",
    "quantizedBaseBehavior", "hiddenRetryOrOutputRepair"
  ], "runtime math");
  invariant(
    value.runtimeMath.executionOrder.length === 4 &&
      value.runtimeMath.scratchElements ===
        "factorRank-f32-values-per-active-matvec-call" &&
      value.runtimeMath.baseTensorMutation === false &&
      value.runtimeMath.factorMutation === false &&
      value.runtimeMath.expandedDeltaTensor === false &&
      value.runtimeMath.dequantizedModelShadow === false &&
      value.runtimeMath.hiddenRetryOrOutputRepair === false,
    "runtime math mutability or ordering is invalid"
  );
  exactKeys(value.compositionAndKvRules, [
    "routeTiming", "fallback", "compositionIdentity", "additiveOrder",
    "orderSensitiveUseOfThisFormat", "activation", "activationFailure",
    "compositionChange", "sameCompositionReuse", "midGenerationSwitch"
  ], "composition and kv rules");
  invariant(
    value.compositionAndKvRules.additiveOrder ===
      "sort-by-full-typed-content-identity-bytes" &&
      value.compositionAndKvRules.orderSensitiveUseOfThisFormat === "reject" &&
      value.compositionAndKvRules.compositionChange ===
        "flush-entire-kv-cache-before-next-token",
    "composition or kv isolation contract is invalid"
  );

  exactKeys(value.testVector, [
    "binaryFixture", "primaryOverlay", "secondaryOverlay", "inputVector",
    "sourceCases", "differentialCriteria", "switchingSequence",
    "rejectionMutations"
  ], "test vector");
  exactKeys(value.testVector.binaryFixture, [
    "description", "baseModelDigestOctet",
    "baseStandaloneContentDigestOctet", "tokenizerDigestOctet",
    "chatTemplateDigestOctet", "tensorLayoutDigestOctet",
    "quantizationProfileDigestOctet", "executionProfileDigestOctet",
    "targetCount", "directoryOffset", "payloadOffset", "totalByteCount",
    "tensorIndex", "tensorNameHashHex", "sourceDtype", "sourceBlockSize",
    "factorRank", "rows", "cols", "scale", "outputFactorOffset",
    "outputFactorBytes", "inputFactorOffset", "inputFactorBytes",
    "factorPayloadSha256", "packageSha256", "packageHex"
  ], "binary fixture");
  invariant(
    value.testVector.binaryFixture.totalByteCount === expectedFixture.bytes &&
      value.testVector.binaryFixture.factorPayloadSha256 ===
        expectedFixture.factorPayloadSha256 &&
      value.testVector.binaryFixture.packageSha256 ===
        expectedFixture.packageSha256 &&
      sha256Pattern.test(value.testVector.binaryFixture.packageSha256),
    "binary fixture identity fields are invalid"
  );

  for (const [name, expected] of [
    ["primaryOverlay", expectedPrimary],
    ["secondaryOverlay", expectedSecondary]
  ]) {
    const overlay = value.testVector[name];
    exactKeys(overlay, [
      "name", "syntheticTypedIdentityHex", "rows", "cols", "factorRank",
      "scale", "outputFactors", "inputFactors", "expectedComponentDots",
      "expectedDelta"
    ], name);
    invariant(typedIdentityPattern.test(overlay.syntheticTypedIdentityHex),
      `${name} typed identity is invalid`);
    invariant(
      overlay.rows === 3 && overlay.cols === 8 &&
        overlay.factorRank >= 1 && overlay.factorRank <= 2 &&
        Number.isFinite(overlay.scale) && overlay.scale !== 0 &&
        overlay.outputFactors.length === overlay.factorRank * overlay.rows &&
        overlay.inputFactors.length === overlay.factorRank * overlay.cols &&
        [...overlay.outputFactors, ...overlay.inputFactors]
          .every(Number.isFinite),
      `${name} factor shape is invalid`
    );
    const calculated = calculateOverlay(overlay,
      value.testVector.inputVector);
    exactStructure(calculated.componentDots, expected.componentDots,
      `${name} calculated component dots`);
    exactStructure(calculated.delta, expected.delta,
      `${name} calculated delta`);
    exactStructure(overlay.expectedComponentDots, expected.componentDots,
      `${name} expected component dots`);
    exactStructure(overlay.expectedDelta, expected.delta,
      `${name} expected delta`);
  }
  invariant(
    value.testVector.primaryOverlay.syntheticTypedIdentityHex <
      value.testVector.secondaryOverlay.syntheticTypedIdentityHex,
    "synthetic additive identity order is invalid"
  );
  invariant(
    value.testVector.inputVector.length === 8 &&
      value.testVector.inputVector.every(Number.isFinite),
    "input vector is invalid"
  );

  invariant(
    Array.isArray(value.testVector.sourceCases) &&
      value.testVector.sourceCases.length === 4,
    "source case count is invalid"
  );
  value.testVector.sourceCases.forEach((source, index) => {
    exactKeys(source, [
      "name", "dtypeTag", "blockSize", "storage", "expectedBaseOutput",
      "expectedPrimaryOutput", "expectedCombinedOutput"
    ], `source case ${index}`);
    const dtype = expectedSourceDtypes.find(
      (candidate) => candidate[0] === source.name);
    invariant(
      source.name === expectedSourceCaseOrder[index] &&
        dtype !== undefined && source.dtypeTag === dtype[1],
      `source case ${index} identity is invalid`);
    const calculatedBase = calculateBaseOutput(
      source, value.testVector.inputVector, 3, 8);
    const calculatedPrimary = addF32(calculatedBase,
      value.testVector.primaryOverlay.expectedDelta);
    const calculatedCombined = addF32(calculatedPrimary,
      value.testVector.secondaryOverlay.expectedDelta);
    const expected = expectedSourceOutputs[source.name];
    exactStructure(source.expectedBaseOutput, expected.base,
      `${source.name} expected base output`);
    exactStructure(source.expectedPrimaryOutput, expected.primary,
      `${source.name} expected primary output`);
    exactStructure(source.expectedCombinedOutput, expected.combined,
      `${source.name} expected combined output`);
    exactStructure(calculatedBase, expected.base,
      `${source.name} calculated base output`);
    exactStructure(calculatedPrimary, expected.primary,
      `${source.name} calculated primary output`);
    exactStructure(calculatedCombined, expected.combined,
      `${source.name} calculated combined output`);
  });

  exactKeys(value.testVector.differentialCriteria, [
    "materializedReference", "directReference",
    "expectedValueAbsoluteTolerance",
    "directVersusMaterializedAbsoluteToleranceByDtype",
    "directVersusMaterializedRelativeToleranceByDtype", "baseReturnRule"
  ], "differential criteria");
  exactKeys(
    value.testVector.differentialCriteria
      .directVersusMaterializedAbsoluteToleranceByDtype,
    ["f32", "q8_0", "q5_0", "q4_0"],
    "absolute tolerances"
  );
  exactKeys(
    value.testVector.differentialCriteria
      .directVersusMaterializedRelativeToleranceByDtype,
    ["f32", "q8_0", "q5_0", "q4_0"],
    "relative tolerances"
  );
  invariant(
    Object.values(value.testVector.differentialCriteria
      .directVersusMaterializedAbsoluteToleranceByDtype)
      .every((tolerance) => tolerance > 0 && tolerance <= 0.000002) &&
      Object.values(value.testVector.differentialCriteria
        .directVersusMaterializedRelativeToleranceByDtype)
        .every((tolerance) => tolerance > 0 && tolerance <= 0.000002),
    "differential tolerances are invalid"
  );
  exactKeys(value.testVector.switchingSequence, [
    "states", "repeatCount", "requestedAdditiveOrderCanonicalization",
    "baseMutationAllowed", "driftAllowed",
    "compositionChangeRequiresFullKvFlush"
  ], "switching sequence");
  exactStructure(value.testVector.switchingSequence.states, [
    "base", "A", "base", "B", "base", "A+B", "base", "B+A", "base"
  ], "switching states");
  invariant(
    value.testVector.switchingSequence.repeatCount === 100 &&
      value.testVector.switchingSequence.baseMutationAllowed === false &&
      value.testVector.switchingSequence.driftAllowed === false &&
      value.testVector.switchingSequence
        .compositionChangeRequiresFullKvFlush === true,
    "switching sequence authority is invalid"
  );
  invariant(
    Array.isArray(value.testVector.rejectionMutations) &&
      value.testVector.rejectionMutations.length === 23 &&
      new Set(value.testVector.rejectionMutations).size === 23,
    "rejection mutation set is invalid"
  );

  validateBinaryFixture(value.testVector);
  exactKeys(value.authority, [
    "overlayContractFrozen", "runtimeParserImplemented",
    "rustScalarDirectMatvecVerified",
    "independentJavascriptBinaryOracleVerified", "f32ParityVerified",
    "q8ParityVerified", "q5ParityVerified", "q4ParityVerified",
    "baseImmutabilityVerified", "switchingDriftVerified",
    "atomicActivationVerified", "compositionKvIsolationVerified",
    "trainedSpecialistVerified", "routerVerified", "browserVerified",
    "productIntegrationVerified", "trainingAuthorized",
    "modelAdoptionAuthorized", "releaseAuthorized"
  ], "authority");
  invariant(value.authority.overlayContractFrozen === true,
    "overlay contract is not frozen");
  for (const [key, authority] of Object.entries(value.authority)) {
    if (key !== "overlayContractFrozen") {
      invariant(authority === false, `authority ${key} is inflated`);
    }
  }
  invariant(
    value.requiredNextGate ===
      "Commit this preregistration before implementation, then build a " +
      "separately tested Rust parser and scalar direct matvec plus a general " +
      "independent JavaScript binary oracle; prove every frozen rejection, " +
      "dtype differential, immutability, and switching vector without " +
      "activating a product composition or claiming specialist quality.",
    "required next gate is invalid"
  );

  const canonicalBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`,
    "utf8");
  invariant(
    canonicalBytes.length === expectedManifestBytes &&
      sha256(canonicalBytes) === expectedManifestSha256,
    "manifest canonical identity is invalid"
  );
  return value;
}

/** Loads, validates, and checks canonical pretty-printed manifest bytes. */
function validateManifestFile(filePath = manifestPath) {
  const bytes = fs.readFileSync(filePath);
  const value = validateManifest(JSON.parse(bytes.toString("utf8")));
  const expectedBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`,
    "utf8");
  invariant(bytes.equals(expectedBytes), "manifest bytes are not canonical");
  return Object.freeze({
    manifest: value,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

if (require.main === module) {
  try {
    const result = validateManifestFile();
    process.stdout.write(`${JSON.stringify({
      schema: result.manifest.schema,
      experimentId: result.manifest.experimentId,
      bytes: result.bytes,
      sha256: result.sha256,
      status: "valid"
    })}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "validation failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  addF32,
  calculateBaseOutput,
  calculateOverlay,
  expectedFixture,
  expectedManifestBytes,
  expectedManifestSha256,
  expectedPrimary,
  expectedSecondary,
  expectedSourceOutputs,
  manifestPath,
  manifestRelativePath,
  validateBinaryFixture,
  validateManifest,
  validateManifestFile
});
