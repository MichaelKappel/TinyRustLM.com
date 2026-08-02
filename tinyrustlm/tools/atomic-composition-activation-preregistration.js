"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  baseDependentAdapter,
  composition,
  compositionMember,
  decodeTypedId,
  encodeTypedId,
  executionBindings,
  kvCacheKey,
  kvFormat,
  routePolicy,
  standaloneModel
} = require("./content-identity.js");
const {
  parseSpecialistOverlay
} = require("./immutable-low-rank-overlay.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const manifestRelativePath =
  "tinyrustlm/experiments/specialist-portfolio/" +
  "atomic-composition-activation-preregistration.v1.json";
const manifestPath = path.join(repositoryRoot, manifestRelativePath);

const expectedSchema =
  "tinyrustlm.atomic_composition_activation_preregistration.v1";
const expectedExperimentId =
  "atomic-specialist-composition-activation-20260725";
const expectedManifestBytes = 24944;
const expectedManifestSha256 =
  "5d450e11a22452b0dd6d3e169ed87c612185a33deb0234e49754b9acc29c089a";

const MAGIC = "ACG1";
const VERSION = 1;
const HEADER_BYTES = 512;
const MEMBER_BYTES = 128;
const ALIGNMENT = 64;
const MAX_MEMBERS = 64;
const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;
const CONTENT_VERSION = 1;
const ACTIVE_GRAPH_DOMAIN =
  "tinyrustlm.runtime.active-composition.v1";
const PROMPT_TOKEN_DOMAIN =
  "tinyrustlm.content.prompt-token-sequence.v1";
const sha256Pattern = /^[a-f0-9]{64}$/u;

const expectedSectionSha256 = Object.freeze({
  scope: "8224e6c1b2a87e9945abc096821d624e46845b0dda024459d651df1ff2070da2",
  wireFormat:
    "abb16ca3f9af5f089afe1b1c0e2c397b52ce9403ab9615f29aff12330ab09aab",
  headerFields:
    "4510fb303bba5a9b91d53ed9ffd4554422b12feb546ce1f5f27f9dde82b2dcd2",
  memberFields:
    "f380d6fb79df7e431ce42baf2107033c6cf06f1169dc14b9d22dcb6baa0fe0b9",
  identityAndCacheEncoding:
    "c535c4df367719d0d722da332b663cb79c670cc86b7bbdb3f7725c02b7eebb8d",
  validationRules:
    "7fb7db46a52b610f5559e7b1e10404f34de477ab0985a8dcb0ed85631b81e3b5",
  activationStateMachine:
    "be78836fc6411fdc153b96e7f76f9cd9c3360fdae29bcb413954bc01b7e0c01b",
  kvIsolationContract:
    "168205ed6f9828e77a6d35c5ed7e61c8839cb9932f5c64872daf3c01701cce6a",
  rejectionMutations:
    "1ba80021d06660b0b980f26903cf269ec92e6ad3e0c56dac2a71161514741672",
  authority:
    "8b6128f375adda7d2fb4210a51b184d962979b43d054f0bdf0a461756bfa43f6",
  requiredNextGate:
    "b2e63b6eb9144c62a2ea2f25693551e3715d8ded10c455b4c111a528d4c65739"
});

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

/** Computes lowercase SHA-256 for exact bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Encodes one domain string with its required zero terminator. */
function domainBytes(domain) {
  return Buffer.concat([Buffer.from(domain, "utf8"), Buffer.from([0])]);
}

/** Encodes one unsigned 32-bit integer in canonical little-endian form. */
function encodeU32(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff,
    `${label} is not a u32`
  );
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

/** Writes one safe unsigned integer as a canonical u64. */
function writeU64(bytes, offset, value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    `${label} is not a safe u64`
  );
  bytes.writeBigUInt64LE(BigInt(value), offset);
}

/** Reads one u64 only when JavaScript can represent it exactly. */
function readU64(bytes, offset, label) {
  const value = bytes.readBigUInt64LE(offset);
  invariant(value <= BigInt(Number.MAX_SAFE_INTEGER),
    `${label} exceeds the safe integer range`);
  return Number(value);
}

/** Requires every byte in a reserved or padding range to be zero. */
function requireZero(bytes, start, end, label) {
  invariant(
    Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
      start >= 0 && end >= start && end <= bytes.length,
    `${label} range is invalid`
  );
  for (let index = start; index < end; index += 1) {
    invariant(bytes[index] === 0, `${label} is nonzero`);
  }
}

/** Requires and normalizes one lowercase nonzero SHA-256 string. */
function requireDigest(value, label) {
  invariant(
    typeof value === "string" && sha256Pattern.test(value) &&
      !/^0{64}$/u.test(value),
    `${label} is not a nonzero lowercase SHA-256`
  );
  return value;
}

/** Converts one content identity to its fixed 40-byte ACG1 encoding. */
function encodePaddedTypedId(id) {
  const compact = encodeTypedId(id);
  return Buffer.concat([
    compact.subarray(0, 1),
    Buffer.alloc(7),
    compact.subarray(1)
  ]);
}

/** Parses one canonical fixed 40-byte ACG1 typed identity. */
function decodePaddedTypedId(bytes, offset, expectedKind, label) {
  requireZero(bytes, offset + 1, offset + 8, `${label} padding`);
  const compact = Buffer.concat([
    bytes.subarray(offset, offset + 1),
    bytes.subarray(offset + 8, offset + 40)
  ]);
  const id = decodeTypedId(compact);
  invariant(id.kind === expectedKind, `${label} kind is invalid`);
  return id;
}

/** Computes the active immutable graph digest. */
function activeGraphDigest(input) {
  exactKeys(input, [
    "compositionId", "routePolicyId", "kvFormatId",
    "positionPolicySha256"
  ], "active graph input");
  const positionPolicySha256 = requireDigest(
    input.positionPolicySha256,
    "active graph position policy"
  );
  return sha256(Buffer.concat([
    domainBytes(ACTIVE_GRAPH_DOMAIN),
    encodeU32(CONTENT_VERSION, "content version"),
    encodeTypedId(input.compositionId),
    encodeTypedId(input.routePolicyId),
    encodeTypedId(input.kvFormatId),
    Buffer.from(positionPolicySha256, "hex")
  ]));
}

/** Computes the exact digest of a retained prompt-token sequence. */
function promptTokenSequence(input) {
  invariant(Array.isArray(input), "prompt tokens must be an array");
  const parts = [
    domainBytes(PROMPT_TOKEN_DOMAIN),
    encodeU32(CONTENT_VERSION, "content version"),
    encodeU32(input.length, "prompt token count")
  ];
  for (const token of input) {
    parts.push(encodeU32(token, "prompt token"));
  }
  const material = Buffer.concat(parts);
  return Object.freeze({
    material,
    sha256: sha256(material)
  });
}

/** Builds the exact base metadata expected by the independent SLO1 parser. */
function overlayExpectation(context, packageSha256) {
  return Object.freeze({
    packageSha256,
    base: Object.freeze({
      modelSha256: context.base.modelSha256,
      standaloneContentDigest: context.base.id.digest,
      tokenizerSha256: context.bindings.tokenizerSha256,
      chatTemplateSha256: context.bindings.chatTemplateSha256,
      tensorLayoutSha256: context.bindings.tensorLayoutSha256,
      quantizationProfileSha256:
        context.bindings.quantizationProfileSha256,
      executionProfileSha256: context.bindings.executionProfileSha256
    }),
    tensors: context.modelTensors
  });
}

/** Materializes one canonical ACG1 bundle from immutable identity objects. */
function buildCompositionBundle(context, compositionName) {
  const selected = context.compositions.get(compositionName);
  invariant(selected !== undefined, "composition name is unknown");
  const activeComposition = selected.identity;
  const members = activeComposition.members.map((member) => {
    const overlay = context.overlaysByAdapterId.get(
      member.adapter.id.display
    );
    invariant(overlay !== undefined,
      "composition member package is unavailable");
    return overlay;
  });
  const memberCount = members.length;
  const payloadOffset = HEADER_BYTES + memberCount * MEMBER_BYTES;
  const totalBytes = payloadOffset +
    members.reduce((sum, member) => sum + member.bytes.length, 0);
  invariant(
    totalBytes <= MAX_BUNDLE_BYTES && totalBytes % ALIGNMENT === 0,
    "materialized bundle length is invalid"
  );

  const bundle = Buffer.alloc(totalBytes);
  bundle.write(MAGIC, 0, "ascii");
  bundle.writeUInt32LE(VERSION, 4);
  bundle.writeUInt32LE(HEADER_BYTES, 8);
  bundle.writeUInt32LE(0, 12);
  bundle.writeUInt32LE(
    activeComposition.semantics === "base-only" ? 0 : 1,
    16
  );
  bundle.writeUInt32LE(memberCount, 20);
  bundle.writeUInt32LE(MEMBER_BYTES, 24);
  writeU64(bundle, 32, HEADER_BYTES, "directory offset");
  writeU64(bundle, 40, payloadOffset, "payload offset");
  writeU64(bundle, 48, totalBytes, "total byte count");
  writeU64(bundle, 56, Number(context.base.modelBytes),
    "base model bytes");
  Buffer.from(context.base.modelSha256, "hex").copy(bundle, 64);
  encodePaddedTypedId(context.base.id).copy(bundle, 96);
  Buffer.from(context.bindings.tokenizerSha256, "hex").copy(bundle, 136);
  Buffer.from(context.bindings.chatTemplateSha256, "hex")
    .copy(bundle, 168);
  Buffer.from(context.bindings.tensorLayoutSha256, "hex").copy(bundle, 200);
  Buffer.from(context.bindings.quantizationProfileSha256, "hex")
    .copy(bundle, 232);
  Buffer.from(context.bindings.executionProfileSha256, "hex")
    .copy(bundle, 264);
  encodePaddedTypedId(activeComposition.id).copy(bundle, 296);
  encodePaddedTypedId(context.route.id).copy(bundle, 336);
  encodePaddedTypedId(context.kv.id).copy(bundle, 376);
  Buffer.from(context.positionPolicySha256, "hex").copy(bundle, 416);
  writeU64(
    bundle,
    448,
    Number(activeComposition.incrementalSpecialistBytes),
    "incremental specialist bytes"
  );
  writeU64(
    bundle,
    456,
    Number(activeComposition.logicalBytes),
    "logical composition bytes"
  );
  const graphDigest = activeGraphDigest({
    compositionId: activeComposition.id,
    routePolicyId: context.route.id,
    kvFormatId: context.kv.id,
    positionPolicySha256: context.positionPolicySha256
  });
  Buffer.from(graphDigest, "hex").copy(bundle, 464);

  let packageOffset = payloadOffset;
  members.forEach((member, index) => {
    const entryOffset = HEADER_BYTES + index * MEMBER_BYTES;
    encodePaddedTypedId(member.adapter.id).copy(bundle, entryOffset);
    Buffer.from(member.packageSha256, "hex").copy(bundle, entryOffset + 40);
    writeU64(bundle, entryOffset + 72, packageOffset, "package offset");
    writeU64(bundle, entryOffset + 80, member.bytes.length, "package bytes");
    bundle.writeUInt32LE(member.parsed.targets.length, entryOffset + 88);
    bundle.writeUInt32LE(member.parsed.maximumFactorRank, entryOffset + 92);
    member.bytes.copy(bundle, packageOffset);
    packageOffset += member.bytes.length;
  });
  invariant(packageOffset === bundle.length,
    "materialized package range is invalid");

  return Object.freeze({
    bytes: bundle,
    sha256: sha256(bundle),
    activeGraphDigest: graphDigest,
    composition: activeComposition
  });
}

/** Parses and fully validates one canonical ACG1 bundle. */
function parseCompositionBundle(input, expectedBundleSha256, context) {
  invariant(Buffer.isBuffer(input), "bundle bytes must be a Buffer");
  const expectedHash = requireDigest(
    expectedBundleSha256,
    "expected bundle SHA-256"
  );
  invariant(sha256(input) === expectedHash,
    "bundle SHA-256 does not match");
  const bytes = input;
  invariant(
    bytes.length >= HEADER_BYTES &&
      bytes.length <= MAX_BUNDLE_BYTES &&
      bytes.length % ALIGNMENT === 0,
    "bundle byte length is invalid"
  );
  invariant(bytes.subarray(0, 4).toString("ascii") === MAGIC,
    "bundle magic is invalid");
  invariant(bytes.readUInt32LE(4) === VERSION,
    "bundle version is unsupported");
  invariant(
    bytes.readUInt32LE(8) === HEADER_BYTES &&
      bytes.readUInt32LE(12) === 0 &&
      bytes.readUInt32LE(24) === MEMBER_BYTES,
    "bundle envelope is invalid"
  );
  requireZero(bytes, 28, 32, "bundle reserved0");

  const semanticsTag = bytes.readUInt32LE(16);
  const memberCount = bytes.readUInt32LE(20);
  invariant(
    (semanticsTag === 0 && memberCount === 0) ||
      (semanticsTag === 1 &&
        memberCount > 0 && memberCount <= MAX_MEMBERS),
    "bundle composition semantics or member count is invalid"
  );
  const payloadOffset = HEADER_BYTES + memberCount * MEMBER_BYTES;
  invariant(
    readU64(bytes, 32, "directory offset") === HEADER_BYTES &&
      readU64(bytes, 40, "payload offset") === payloadOffset &&
      readU64(bytes, 48, "total byte count") === bytes.length,
    "bundle range envelope is invalid"
  );
  requireZero(bytes, 496, HEADER_BYTES, "bundle reserved1");

  invariant(
    readU64(bytes, 56, "base model bytes") ===
      Number(context.base.modelBytes) &&
      bytes.subarray(64, 96).toString("hex") === context.base.modelSha256,
    "bundle loaded model binding does not match"
  );
  const baseId = decodePaddedTypedId(
    bytes, 96, "standalone-model", "bundle base identity"
  );
  invariant(baseId.display === context.base.id.display,
    "bundle base identity does not match");
  const bindingOffsets = Object.freeze([
    ["tokenizerSha256", 136],
    ["chatTemplateSha256", 168],
    ["tensorLayoutSha256", 200],
    ["quantizationProfileSha256", 232],
    ["executionProfileSha256", 264]
  ]);
  for (const [name, offset] of bindingOffsets) {
    invariant(
      bytes.subarray(offset, offset + 32).toString("hex") ===
        context.bindings[name],
      `bundle ${name} does not match`
    );
  }

  const declaredCompositionId = decodePaddedTypedId(
    bytes, 296, "composition", "bundle composition identity"
  );
  const routeId = decodePaddedTypedId(
    bytes, 336, "route-policy", "bundle route identity"
  );
  const kvId = decodePaddedTypedId(
    bytes, 376, "kv-format", "bundle KV identity"
  );
  invariant(routeId.display === context.route.id.display,
    "bundle route identity does not match");
  invariant(kvId.display === context.kv.id.display,
    "bundle KV identity does not match");
  invariant(
    bytes.subarray(416, 448).toString("hex") ===
      context.positionPolicySha256,
    "bundle position policy does not match"
  );

  const memberValues = [];
  let priorTypedId = null;
  let expectedPackageOffset = payloadOffset;
  let incrementalBytes = 0;
  for (let index = 0; index < memberCount; index += 1) {
    const entryOffset = HEADER_BYTES + index * MEMBER_BYTES;
    const adapterId = decodePaddedTypedId(
      bytes,
      entryOffset,
      "base-dependent-adapter",
      `bundle member ${index} identity`
    );
    const compactId = encodeTypedId(adapterId);
    invariant(
      priorTypedId === null || Buffer.compare(priorTypedId, compactId) < 0,
      "bundle member identities are not strictly increasing"
    );
    priorTypedId = compactId;
    const packageSha256 =
      bytes.subarray(entryOffset + 40, entryOffset + 72).toString("hex");
    requireDigest(packageSha256, `bundle member ${index} package SHA-256`);
    const packageOffset = readU64(
      bytes, entryOffset + 72, `bundle member ${index} package offset`
    );
    const packageBytes = readU64(
      bytes, entryOffset + 80, `bundle member ${index} package bytes`
    );
    invariant(
      packageOffset === expectedPackageOffset &&
        packageBytes > 0 &&
        packageBytes % ALIGNMENT === 0 &&
        packageOffset + packageBytes <= bytes.length,
      `bundle member ${index} range is invalid`
    );
    requireZero(
      bytes,
      entryOffset + 96,
      entryOffset + MEMBER_BYTES,
      `bundle member ${index} reserved bytes`
    );
    const packageValue = bytes.subarray(
      packageOffset,
      packageOffset + packageBytes
    );
    invariant(sha256(packageValue) === packageSha256,
      `bundle member ${index} package SHA-256 does not match`);
    const parsed = parseSpecialistOverlay(
      Buffer.from(packageValue),
      overlayExpectation(context, packageSha256)
    );
    invariant(
      bytes.readUInt32LE(entryOffset + 88) === parsed.targets.length &&
        bytes.readUInt32LE(entryOffset + 92) === parsed.maximumFactorRank,
      `bundle member ${index} parsed metadata does not match`
    );
    const adapter = baseDependentAdapter({
      adapterBytes: packageBytes,
      adapterSha256: packageSha256,
      base: context.base,
      semantics: "additive"
    });
    invariant(adapter.id.display === adapterId.display,
      `bundle member ${index} adapter identity does not match`);
    memberValues.push(compositionMember({
      adapter,
      dependencies: []
    }));
    incrementalBytes += packageBytes;
    invariant(Number.isSafeInteger(incrementalBytes),
      "bundle incremental byte count overflowed");
    expectedPackageOffset += packageBytes;
  }
  invariant(expectedPackageOffset === bytes.length,
    "bundle contains a gap or trailing bytes");

  const activeComposition = composition({
    base: context.base,
    semantics: semanticsTag === 0 ? "base-only" : "additive",
    members: memberValues
  });
  invariant(activeComposition.id.display === declaredCompositionId.display,
    "bundle composition identity does not match");
  invariant(
    readU64(bytes, 448, "incremental specialist bytes") ===
      incrementalBytes &&
      readU64(bytes, 456, "logical composition bytes") ===
        Number(context.base.modelBytes) + incrementalBytes,
    "bundle byte accounting does not match"
  );
  const graphDigest = activeGraphDigest({
    compositionId: activeComposition.id,
    routePolicyId: context.route.id,
    kvFormatId: context.kv.id,
    positionPolicySha256: context.positionPolicySha256
  });
  invariant(
    bytes.subarray(464, 496).toString("hex") === graphDigest,
    "bundle active graph digest does not match"
  );
  return Object.freeze({
    sha256: expectedHash,
    bytes: bytes.length,
    activeGraphDigest: graphDigest,
    base: context.base,
    composition: activeComposition,
    memberCount
  });
}

/** Validates and materializes every frozen identity and binary vector. */
function materializeTestVector(value) {
  exactKeys(value.runtimeDescriptors, ["kvFormat", "positionPolicy"],
    "runtime descriptors");
  for (const [name, descriptor] of Object.entries(
    value.runtimeDescriptors
  )) {
    const keys = name === "kvFormat"
      ? ["exactUtf8", "byteCount", "sha256", "typedId"]
      : ["exactUtf8", "byteCount", "sha256"];
    exactKeys(descriptor, keys, `${name} descriptor`);
    const bytes = Buffer.from(descriptor.exactUtf8, "utf8");
    invariant(
      bytes.length === descriptor.byteCount &&
        sha256(bytes) === descriptor.sha256,
      `${name} descriptor bytes do not match`
    );
  }

  exactKeys(value.testVector, [
    "base", "routePolicy", "modelTensors", "overlays", "compositions",
    "promptSequence", "switchingSequence"
  ], "test vector");
  const vector = value.testVector;
  exactKeys(vector.base, [
    "modelBytes", "modelSha256", "standaloneTypedId",
    "tokenizerSha256", "chatTemplateSha256", "tensorLayoutSha256",
    "quantizationProfileSha256", "executionProfileSha256"
  ], "test vector base");
  const bindings = executionBindings({
    tokenizerSha256: vector.base.tokenizerSha256,
    chatTemplateSha256: vector.base.chatTemplateSha256,
    tensorLayoutSha256: vector.base.tensorLayoutSha256,
    quantizationProfileSha256: vector.base.quantizationProfileSha256,
    executionProfileSha256: vector.base.executionProfileSha256
  });
  const base = standaloneModel({
    modelBytes: vector.base.modelBytes,
    modelSha256: vector.base.modelSha256,
    bindings
  });
  invariant(base.id.display === vector.base.standaloneTypedId,
    "test vector standalone identity does not match");

  invariant(
    Array.isArray(vector.modelTensors) &&
      vector.modelTensors.length === 8,
    "test vector model tensor count is invalid"
  );
  vector.modelTensors.forEach((tensor, index) => {
    exactKeys(tensor, [
      "nameHashHex", "dtype", "rank", "dim0", "dim1", "dim2", "dim3",
      "blockSize"
    ], `test vector tensor ${index}`);
  });

  const context = {
    base,
    bindings,
    modelTensors: vector.modelTensors,
    overlaysByName: new Map(),
    overlaysByAdapterId: new Map(),
    compositions: new Map(),
    route: null,
    kv: null,
    positionPolicySha256:
      value.runtimeDescriptors.positionPolicy.sha256
  };
  invariant(
    Array.isArray(vector.overlays) && vector.overlays.length === 2,
    "test vector overlay count is invalid"
  );
  vector.overlays.forEach((overlay, index) => {
    exactKeys(overlay, [
      "name", "packageBytes", "packageSha256", "factorPayloadSha256",
      "adapterTypedId", "targetCount", "maximumFactorRank", "packageHex"
    ], `test vector overlay ${index}`);
    invariant(
      overlay.name === ["A", "B"][index] &&
        !context.overlaysByName.has(overlay.name),
      `test vector overlay ${index} name is invalid`
    );
    const bytes = Buffer.from(overlay.packageHex, "hex");
    invariant(
      bytes.length === overlay.packageBytes &&
        sha256(bytes) === overlay.packageSha256,
      `test vector overlay ${index} package identity does not match`
    );
    const parsed = parseSpecialistOverlay(
      bytes,
      overlayExpectation(context, overlay.packageSha256)
    );
    invariant(
      parsed.targets.length === overlay.targetCount &&
        parsed.maximumFactorRank === overlay.maximumFactorRank &&
        sha256(bytes.subarray(
          parsed.targets[0].factorEnd -
            (parsed.targets[0].factorRank *
              (parsed.targets[0].rows + parsed.targets[0].cols) * 4),
          parsed.targets[0].factorEnd
        )) === overlay.factorPayloadSha256,
      `test vector overlay ${index} parsed metadata does not match`
    );
    const adapter = baseDependentAdapter({
      adapterBytes: overlay.packageBytes,
      adapterSha256: overlay.packageSha256,
      base,
      semantics: "additive"
    });
    invariant(adapter.id.display === overlay.adapterTypedId,
      `test vector overlay ${index} adapter identity does not match`);
    const materialized = Object.freeze({
      name: overlay.name,
      bytes,
      packageSha256: overlay.packageSha256,
      parsed,
      adapter
    });
    context.overlaysByName.set(overlay.name, materialized);
    context.overlaysByAdapterId.set(adapter.id.display, materialized);
  });

  invariant(
    Array.isArray(vector.compositions) &&
      vector.compositions.length === 4,
    "test vector composition count is invalid"
  );
  vector.compositions.forEach((entry, index) => {
    exactKeys(entry, [
      "name", "semantics", "memberNames", "canonicalMemberTypedIds",
      "compositionTypedId", "incrementalSpecialistBytes",
      "logicalCompositionBytes", "bundleBytes", "bundleSha256",
      "activeGraphDigest"
    ], `test vector composition ${index}`);
    invariant(entry.name === ["base", "A", "B", "A+B"][index],
      `test vector composition ${index} name is invalid`);
    const identity = composition({
      base,
      semantics: entry.semantics,
      members: entry.memberNames.map((name) => {
        const overlay = context.overlaysByName.get(name);
        invariant(overlay !== undefined,
          `composition ${entry.name} member is unknown`);
        return compositionMember({
          adapter: overlay.adapter,
          dependencies: []
        });
      })
    });
    invariant(
      identity.id.display === entry.compositionTypedId &&
        Number(identity.incrementalSpecialistBytes) ===
          entry.incrementalSpecialistBytes &&
        Number(identity.logicalBytes) === entry.logicalCompositionBytes &&
        JSON.stringify(identity.members.map((member) =>
          member.adapter.id.display)) ===
          JSON.stringify(entry.canonicalMemberTypedIds),
      `test vector composition ${index} identity does not match`
    );
    context.compositions.set(entry.name, Object.freeze({
      manifest: entry,
      identity
    }));
  });

  exactKeys(vector.routePolicy, [
    "exactUtf8", "byteCount", "sha256", "typedId"
  ], "test vector route policy");
  const policyBytes = Buffer.from(vector.routePolicy.exactUtf8, "utf8");
  invariant(
    policyBytes.length === vector.routePolicy.byteCount &&
      sha256(policyBytes) === vector.routePolicy.sha256,
    "test vector route policy bytes do not match"
  );
  context.route = routePolicy({
    policyBytes: vector.routePolicy.byteCount,
    policySha256: vector.routePolicy.sha256,
    champion: context.compositions.get("base").identity,
    specialists: ["A", "B", "A+B"].map((name) =>
      context.compositions.get(name).identity),
    selectors: []
  });
  invariant(context.route.id.display === vector.routePolicy.typedId,
    "test vector route policy identity does not match");
  context.kv = kvFormat({
    descriptorBytes: value.runtimeDescriptors.kvFormat.byteCount,
    descriptorSha256: value.runtimeDescriptors.kvFormat.sha256
  });
  invariant(
    context.kv.id.display === value.runtimeDescriptors.kvFormat.typedId,
    "test vector KV format identity does not match"
  );

  const bundles = new Map();
  for (const [name, entry] of context.compositions) {
    const built = buildCompositionBundle(context, name);
    invariant(
      built.bytes.length === entry.manifest.bundleBytes &&
        built.sha256 === entry.manifest.bundleSha256 &&
        built.activeGraphDigest === entry.manifest.activeGraphDigest,
      `test vector ${name} bundle does not match`
    );
    const parsed = parseCompositionBundle(
      built.bytes,
      built.sha256,
      context
    );
    invariant(parsed.composition.id.display === entry.identity.id.display,
      `test vector ${name} parsed composition does not match`);
    bundles.set(name, Object.freeze({ built, parsed }));
  }

  exactKeys(vector.promptSequence, [
    "tokens", "materialHex", "sha256", "compositionAKvCacheKey"
  ], "test vector prompt sequence");
  const prompt = promptTokenSequence(vector.promptSequence.tokens);
  invariant(
    prompt.material.toString("hex") === vector.promptSequence.materialHex &&
      prompt.sha256 === vector.promptSequence.sha256,
    "test vector prompt sequence does not match"
  );
  const compositionAKvCacheKey = kvCacheKey({
    composition: context.compositions.get("A").identity,
    positionPolicySha256: context.positionPolicySha256,
    kvFormat: context.kv,
    promptTokenSha256: prompt.sha256
  });
  invariant(
    compositionAKvCacheKey ===
      vector.promptSequence.compositionAKvCacheKey,
    "test vector KV cache key does not match"
  );
  return Object.freeze({
    ...context,
    bundles,
    prompt,
    compositionAKvCacheKey
  });
}

/** Validates the frozen atomic-composition preregistration object. */
function validateManifest(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "scope", "wireFormat",
    "headerFields", "memberFields", "identityAndCacheEncoding",
    "runtimeDescriptors", "validationRules", "activationStateMachine",
    "kvIsolationContract", "testVector", "rejectionMutations",
    "authority", "requiredNextGate"
  ], "manifest");
  invariant(value.schema === expectedSchema, "manifest schema is invalid");
  invariant(value.experimentId === expectedExperimentId,
    "manifest experiment id is invalid");
  invariant(value.status === "preregistered-no-runtime-authority",
    "manifest status is invalid");

  for (const [name, expectedHash] of Object.entries(
    expectedSectionSha256
  )) {
    invariant(
      sha256(Buffer.from(JSON.stringify(value[name]), "utf8")) ===
        expectedHash,
      `manifest ${name} contract is invalid`
    );
  }
  invariant(
    value.scope.preReleaseRewrite === true &&
      value.scope.legacyCompatibility === false &&
      value.scope.acceptedLegacyMagics.length === 0 &&
      value.scope.mutableBaseTensorUpdatesPermitted === false,
    "manifest clean-slate scope is invalid"
  );
  invariant(value.authority.activationContractFrozen === true,
    "activation contract is not frozen");
  for (const [name, authority] of Object.entries(value.authority)) {
    if (name !== "activationContractFrozen") {
      invariant(authority === false, `authority ${name} is inflated`);
    }
  }
  invariant(
    Array.isArray(value.rejectionMutations) &&
      value.rejectionMutations.length === 25 &&
      new Set(value.rejectionMutations).size === 25,
    "rejection mutation set is invalid"
  );

  const materialized = materializeTestVector(value);
  exactKeys(value.testVector.switchingSequence, [
    "states", "repeatCount", "failedActivationPreservesPriorGraphAndKv",
    "differentActiveGraphFlushesEntireKv", "sameActiveGraphIsIdempotent",
    "baseMutationAllowed", "driftAllowed"
  ], "switching sequence");
  invariant(
    JSON.stringify(value.testVector.switchingSequence.states) ===
      JSON.stringify(["base", "A", "base", "B", "base", "A+B", "base"]) &&
      value.testVector.switchingSequence.repeatCount === 100 &&
      value.testVector.switchingSequence
        .failedActivationPreservesPriorGraphAndKv === true &&
      value.testVector.switchingSequence
        .differentActiveGraphFlushesEntireKv === true &&
      value.testVector.switchingSequence.sameActiveGraphIsIdempotent ===
        true &&
      value.testVector.switchingSequence.baseMutationAllowed === false &&
      value.testVector.switchingSequence.driftAllowed === false,
    "switching sequence contract is invalid"
  );

  const canonicalBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`,
    "utf8");
  invariant(
    canonicalBytes.length === expectedManifestBytes &&
      sha256(canonicalBytes) === expectedManifestSha256,
    "manifest canonical identity is invalid"
  );
  return Object.freeze({ manifest: value, materialized });
}

/** Loads, validates, and checks canonical pretty-printed manifest bytes. */
function validateManifestFile(filePath = manifestPath) {
  const bytes = fs.readFileSync(filePath);
  const result = validateManifest(JSON.parse(bytes.toString("utf8")));
  const expectedBytes = Buffer.from(
    `${JSON.stringify(result.manifest, null, 2)}\n`,
    "utf8"
  );
  invariant(bytes.equals(expectedBytes), "manifest bytes are not canonical");
  return Object.freeze({
    ...result,
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
      bundleCount: result.materialized.bundles.size,
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
  ACTIVE_GRAPH_DOMAIN,
  ALIGNMENT,
  HEADER_BYTES,
  MAGIC,
  MAX_BUNDLE_BYTES,
  MAX_MEMBERS,
  MEMBER_BYTES,
  PROMPT_TOKEN_DOMAIN,
  VERSION,
  activeGraphDigest,
  buildCompositionBundle,
  expectedManifestBytes,
  expectedManifestSha256,
  manifestPath,
  manifestRelativePath,
  materializeTestVector,
  parseCompositionBundle,
  promptTokenSequence,
  sha256,
  validateManifest,
  validateManifestFile
});
