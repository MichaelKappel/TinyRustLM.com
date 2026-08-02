"use strict";

const crypto = require("node:crypto");

const CONTENT_VERSION = 1;
const MAX_IDENTITY_MEMBERS = 1024;
const MAX_U32 = 0xffff_ffff;
const MAX_U64 = (1n << 64n) - 1n;

const artifactKinds = Object.freeze({
  standaloneModel: Object.freeze({
    name: "standalone-model",
    tag: 1,
    prefix: "model-sha256-",
    domain: "tinyrustlm.content.standalone-model.v1"
  }),
  baseDependentAdapter: Object.freeze({
    name: "base-dependent-adapter",
    tag: 2,
    prefix: "adapter-sha256-",
    domain: "tinyrustlm.content.base-dependent-adapter.v1"
  }),
  composition: Object.freeze({
    name: "composition",
    tag: 3,
    prefix: "composition-sha256-",
    domain: "tinyrustlm.content.composition.v1"
  }),
  sharedChunk: Object.freeze({
    name: "shared-chunk",
    tag: 4,
    prefix: "chunk-sha256-",
    domain: "tinyrustlm.content.shared-chunk.v1"
  }),
  routePolicy: Object.freeze({
    name: "route-policy",
    tag: 5,
    prefix: "route-sha256-",
    domain: "tinyrustlm.content.route-policy.v1"
  }),
  kvFormat: Object.freeze({
    name: "kv-format",
    tag: 6,
    prefix: "kv-format-sha256-",
    domain: "tinyrustlm.content.kv-format.v1"
  }),
  retrievalIndex: Object.freeze({
    name: "retrieval-index",
    tag: 7,
    prefix: "retrieval-sha256-",
    domain: "tinyrustlm.content.retrieval-index.v1"
  })
});

const kindsByTag = new Map(
  Object.values(artifactKinds).map((kind) => [kind.tag, kind])
);

const compositionSemantics = Object.freeze({
  baseOnly: Object.freeze({ name: "base-only", tag: 0 }),
  additive: Object.freeze({ name: "additive", tag: 1 }),
  replacement: Object.freeze({ name: "replacement", tag: 2 }),
  sequential: Object.freeze({ name: "sequential", tag: 3 }),
  dependent: Object.freeze({ name: "dependent", tag: 4 })
});

const semanticsByName = new Map(
  Object.values(compositionSemantics).map((semantic) => [
    semantic.name,
    semantic
  ])
);

const retrievalMetrics = Object.freeze({
  cosine: Object.freeze({ name: "cosine", tag: 1 }),
  innerProduct: Object.freeze({ name: "inner-product", tag: 2 }),
  squaredEuclidean: Object.freeze({
    name: "squared-euclidean",
    tag: 3
  })
});

const metricsByName = new Map(
  Object.values(retrievalMetrics).map((metric) => [metric.name, metric])
);

const storageLayoutDomain = "tinyrustlm.content.storage-layout.v1";
const kvCacheKeyDomain = "tinyrustlm.content.kv-cache-key.v1";
const requiredByteFields = Object.freeze([
  "standaloneArtifactBytes",
  "logicalCompositionBytes",
  "incrementalSpecialistBytes",
  "physicalPortfolioBytes",
  "routePolicyBytes",
  "retrievalIndexBytes",
  "kvFormatDescriptorBytes",
  "kvAllocatedBytes",
  "kvCommittedBytes",
  "kvPeakBytes",
  "activationScratchBytes",
  "decodedTemporaryBytes",
  "peakResidentBytes"
]);

const contentIds = new WeakSet();
const bindingsValues = new WeakSet();
const standaloneModels = new WeakSet();
const adapters = new WeakSet();
const compositionMembers = new WeakSet();
const compositions = new WeakSet();
const sharedChunks = new WeakSet();
const storageLayouts = new WeakSet();
const kvFormats = new WeakSet();
const retrievalIndexes = new WeakSet();
const routePolicies = new WeakSet();

/** Throws a stable validation error when a contract condition is false. */
function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

/** Returns true only for an ordinary object with no custom prototype. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

/** Requires an object to contain exactly the declared field names. */
function exactKeys(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    actual.length === wanted.length &&
      actual.every((key, index) => key === wanted[index]),
    `${label} fields are invalid`
  );
}

/** Requires an array with no more than the frozen implementation bound. */
function boundedArray(value, label) {
  invariant(Array.isArray(value), `${label} must be an array`);
  invariant(value.length <= MAX_IDENTITY_MEMBERS,
    `${label} exceeds the member limit`);
  return value;
}

/** Converts a safe integer or bigint into one positive canonical u64. */
function positiveU64(value, label) {
  let result;
  if (typeof value === "bigint") {
    result = value;
  } else {
    invariant(Number.isSafeInteger(value),
      `${label} must be a safe integer or bigint`);
    result = BigInt(value);
  }
  invariant(result > 0n && result <= MAX_U64,
    `${label} must be a positive u64`);
  return result;
}

/** Converts a safe integer or bigint into one nonnegative canonical u64. */
function nonnegativeU64(value, label) {
  let result;
  if (typeof value === "bigint") {
    result = value;
  } else {
    invariant(Number.isSafeInteger(value),
      `${label} must be a safe integer or bigint`);
    result = BigInt(value);
  }
  invariant(result >= 0n && result <= MAX_U64,
    `${label} must be a nonnegative u64`);
  return result;
}

/** Requires an unsigned 32-bit JavaScript number. */
function u32Value(value, label, allowZero = true) {
  invariant(Number.isInteger(value) && value >= (allowZero ? 0 : 1) &&
    value <= MAX_U32, `${label} must be a valid u32`);
  return value;
}

/** Encodes one u32 in the frozen little-endian representation. */
function encodeU32(value) {
  const output = Buffer.allocUnsafe(4);
  output.writeUInt32LE(value);
  return output;
}

/** Encodes one u64 in the frozen little-endian representation. */
function encodeU64(value) {
  const output = Buffer.allocUnsafe(8);
  output.writeBigUInt64LE(value);
  return output;
}

/** Encodes one bounded list count. */
function encodeCount(value, label) {
  invariant(Number.isInteger(value) && value >= 0 &&
    value <= MAX_IDENTITY_MEMBERS, `${label} count is invalid`);
  return encodeU32(value);
}

/** Normalizes one required raw SHA-256 value to lowercase hexadecimal. */
function normalizeDigest(value, label) {
  let bytes;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    bytes = Buffer.from(value);
    invariant(bytes.length === 32, `${label} must contain 32 bytes`);
  } else {
    invariant(typeof value === "string" && /^[a-f0-9]{64}$/u.test(value),
      `${label} must be lowercase SHA-256`);
    bytes = Buffer.from(value, "hex");
  }
  invariant(!bytes.equals(Buffer.alloc(32)),
    `${label} cannot use the all-zero sentinel`);
  return bytes.toString("hex");
}

/** Returns immutable profile bindings after exact-field validation. */
function executionBindings(input) {
  exactKeys(input, [
    "tokenizerSha256",
    "chatTemplateSha256",
    "tensorLayoutSha256",
    "quantizationProfileSha256",
    "executionProfileSha256"
  ], "execution bindings");
  const result = Object.freeze({
    tokenizerSha256: normalizeDigest(
      input.tokenizerSha256,
      "tokenizerSha256"
    ),
    chatTemplateSha256: normalizeDigest(
      input.chatTemplateSha256,
      "chatTemplateSha256"
    ),
    tensorLayoutSha256: normalizeDigest(
      input.tensorLayoutSha256,
      "tensorLayoutSha256"
    ),
    quantizationProfileSha256: normalizeDigest(
      input.quantizationProfileSha256,
      "quantizationProfileSha256"
    ),
    executionProfileSha256: normalizeDigest(
      input.executionProfileSha256,
      "executionProfileSha256"
    )
  });
  bindingsValues.add(result);
  return result;
}

/** Requires a value created by this module and carrying the expected brand. */
function branded(value, brand, label) {
  invariant(value !== null && typeof value === "object" && brand.has(value),
    `${label} has an invalid identity type`);
  return value;
}

/** Encodes all five profile bindings in their frozen order. */
function encodeBindings(value) {
  branded(value, bindingsValues, "execution bindings");
  return Buffer.concat([
    Buffer.from(value.tokenizerSha256, "hex"),
    Buffer.from(value.chatTemplateSha256, "hex"),
    Buffer.from(value.tensorLayoutSha256, "hex"),
    Buffer.from(value.quantizationProfileSha256, "hex"),
    Buffer.from(value.executionProfileSha256, "hex")
  ]);
}

/** Starts one domain-separated identity byte stream. */
function domainBytes(domain) {
  return Buffer.concat([Buffer.from(domain, "utf8"), Buffer.from([0])]);
}

/** Computes lowercase SHA-256 for exact bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Creates one branded, immutable kind-tagged content identity. */
function createContentId(kind, digest) {
  const normalized = normalizeDigest(digest, `${kind.name} identity`);
  const value = Object.freeze({
    kind: kind.name,
    tag: kind.tag,
    digest: normalized,
    display: `${kind.prefix}${normalized}`
  });
  contentIds.add(value);
  return value;
}

/** Requires a branded content identity and returns it unchanged. */
function requireContentId(value, label) {
  return branded(value, contentIds, label);
}

/** Encodes one content identity as kind tag followed by raw digest. */
function encodeTypedId(value) {
  const id = requireContentId(value, "content identity");
  return Buffer.concat([
    Buffer.from([id.tag]),
    Buffer.from(id.digest, "hex")
  ]);
}

/** Parses exactly one 33-byte known typed identity without trailing bytes. */
function decodeTypedId(value) {
  invariant(Buffer.isBuffer(value) || value instanceof Uint8Array,
    "typed identity must be bytes");
  const bytes = Buffer.from(value);
  invariant(bytes.length === 33,
    "typed identity must contain exactly 33 bytes");
  const kind = kindsByTag.get(bytes[0]);
  invariant(kind !== undefined, "typed identity kind tag is unknown");
  return createContentId(kind, bytes.subarray(1));
}

/** Compares content identities by their complete typed byte representation. */
function compareIds(left, right) {
  return Buffer.compare(encodeTypedId(left), encodeTypedId(right));
}

/** Requires one supported composition semantic name. */
function semanticValue(value) {
  invariant(typeof value === "string" && semanticsByName.has(value),
    "composition semantic is unknown");
  return semanticsByName.get(value);
}

/** Requires one supported retrieval metric name. */
function metricValue(value) {
  invariant(typeof value === "string" && metricsByName.has(value),
    "retrieval metric is unknown");
  return metricsByName.get(value);
}

/** Performs checked u64 addition. */
function checkedAdd(left, right, label) {
  const sum = left + right;
  invariant(sum <= MAX_U64, `${label} overflows u64`);
  return sum;
}

/** Compares exact profile binding values. */
function bindingsEqual(left, right) {
  return left.tokenizerSha256 === right.tokenizerSha256 &&
    left.chatTemplateSha256 === right.chatTemplateSha256 &&
    left.tensorLayoutSha256 === right.tensorLayoutSha256 &&
    left.quantizationProfileSha256 === right.quantizationProfileSha256 &&
    left.executionProfileSha256 === right.executionProfileSha256;
}

/** Builds one complete standalone model content identity. */
function standaloneModel(input) {
  exactKeys(input, ["modelBytes", "modelSha256", "bindings"],
    "standalone model");
  const modelBytes = positiveU64(input.modelBytes, "modelBytes");
  const modelSha256 = normalizeDigest(input.modelSha256, "modelSha256");
  const bindings = branded(input.bindings, bindingsValues,
    "standalone bindings");
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.standaloneModel.domain),
    encodeU32(CONTENT_VERSION),
    encodeU64(modelBytes),
    Buffer.from(modelSha256, "hex"),
    encodeBindings(bindings)
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.standaloneModel, digest),
    modelBytes,
    modelSha256,
    bindings
  });
  standaloneModels.add(value);
  return value;
}

/** Builds one adapter bound to an exact standalone base and profiles. */
function baseDependentAdapter(input) {
  exactKeys(input, [
    "adapterBytes", "adapterSha256", "base", "semantics"
  ], "base-dependent adapter");
  const adapterBytes = positiveU64(input.adapterBytes, "adapterBytes");
  const adapterSha256 = normalizeDigest(
    input.adapterSha256,
    "adapterSha256"
  );
  const base = branded(input.base, standaloneModels, "adapter base");
  const semantic = semanticValue(input.semantics);
  invariant(semantic !== compositionSemantics.baseOnly,
    "an adapter cannot use base-only semantics");
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.baseDependentAdapter.domain),
    encodeU32(CONTENT_VERSION),
    encodeU64(adapterBytes),
    Buffer.from(adapterSha256, "hex"),
    encodeTypedId(base.id),
    encodeBindings(base.bindings),
    Buffer.from([semantic.tag])
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.baseDependentAdapter, digest),
    adapterBytes,
    adapterSha256,
    baseId: base.id,
    bindings: base.bindings,
    semantics: semantic.name
  });
  adapters.add(value);
  return value;
}

/** Creates one composition member with explicit typed dependencies. */
function compositionMember(input) {
  exactKeys(input, ["adapter", "dependencies"], "composition member");
  const adapter = branded(input.adapter, adapters, "member adapter");
  const dependencies = boundedArray(
    input.dependencies,
    "member dependencies"
  ).map((dependency) =>
    requireContentId(dependency, "member dependency"));
  const value = Object.freeze({
    adapter,
    dependencies: Object.freeze(dependencies)
  });
  compositionMembers.add(value);
  return value;
}

/** Validates member cardinality for one composition semantic. */
function validateMemberCount(semantic, count) {
  const valid = semantic === compositionSemantics.baseOnly
    ? count === 0
    : semantic === compositionSemantics.replacement
      ? count === 1
      : count >= 1;
  invariant(valid, "composition member count is invalid");
}

/** Rejects duplicate member IDs after any required canonical sorting. */
function requireUniqueMembers(members) {
  const seen = new Set();
  for (const member of members) {
    invariant(!seen.has(member.adapter.id.display),
      "composition contains a duplicate member");
    seen.add(member.adapter.id.display);
  }
}

/** Validates dependency emptiness or a sorted earlier-member DAG. */
function validateDependencies(semantic, members) {
  for (let index = 0; index < members.length; index += 1) {
    const dependencies = members[index].dependencies;
    if (semantic !== compositionSemantics.dependent) {
      invariant(dependencies.length === 0,
        "non-dependent members cannot declare dependencies");
      continue;
    }
    for (let dependencyIndex = 0;
      dependencyIndex < dependencies.length;
      dependencyIndex += 1) {
      const dependency = dependencies[dependencyIndex];
      invariant(
        dependency.kind === artifactKinds.baseDependentAdapter.name,
        "dependent members require adapter identities"
      );
      if (dependencyIndex > 0) {
        invariant(
          compareIds(dependencies[dependencyIndex - 1], dependency) < 0,
          "dependent member identities must be sorted and unique"
        );
      }
      invariant(
        members.slice(0, index).some((prior) =>
          prior.adapter.id.display === dependency.display),
        "dependent member refers to a non-earlier member"
      );
    }
  }
}

/** Builds one immutable homogeneous base-plus-adapter composition. */
function composition(input) {
  exactKeys(input, ["base", "semantics", "members"], "composition");
  const base = branded(input.base, standaloneModels, "composition base");
  const semantic = semanticValue(input.semantics);
  const members = boundedArray(input.members, "composition members")
    .map((member) =>
      branded(member, compositionMembers, "composition member"));
  validateMemberCount(semantic, members.length);
  for (const member of members) {
    invariant(member.adapter.baseId.display === base.id.display,
      "composition member base does not match");
    invariant(bindingsEqual(member.adapter.bindings, base.bindings),
      "composition member bindings do not match");
    invariant(member.adapter.semantics === semantic.name,
      "composition member semantic does not match");
  }
  if (semantic === compositionSemantics.additive) {
    members.sort((left, right) =>
      compareIds(left.adapter.id, right.adapter.id));
  }
  requireUniqueMembers(members);
  validateDependencies(semantic, members);

  const memberBytes = [];
  let incrementalSpecialistBytes = 0n;
  for (const member of members) {
    incrementalSpecialistBytes = checkedAdd(
      incrementalSpecialistBytes,
      member.adapter.adapterBytes,
      "incremental specialist bytes"
    );
    memberBytes.push(
      encodeTypedId(member.adapter.id),
      encodeCount(member.dependencies.length, "dependency")
    );
    for (const dependency of member.dependencies) {
      memberBytes.push(encodeTypedId(dependency));
    }
  }
  const logicalBytes = checkedAdd(
    base.modelBytes,
    incrementalSpecialistBytes,
    "logical composition bytes"
  );
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.composition.domain),
    encodeU32(CONTENT_VERSION),
    encodeTypedId(base.id),
    encodeBindings(base.bindings),
    Buffer.from([semantic.tag]),
    encodeCount(members.length, "composition member"),
    ...memberBytes
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.composition, digest),
    base,
    semantics: semantic.name,
    members: Object.freeze(members),
    logicalBytes,
    incrementalSpecialistBytes
  });
  compositions.add(value);
  return value;
}

/** Builds one shared physical chunk identity. */
function sharedChunk(input) {
  exactKeys(input, ["chunkBytes", "chunkSha256"], "shared chunk");
  const chunkBytes = positiveU64(input.chunkBytes, "chunkBytes");
  const chunkSha256 = normalizeDigest(input.chunkSha256, "chunkSha256");
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.sharedChunk.domain),
    encodeU32(CONTENT_VERSION),
    encodeU64(chunkBytes),
    Buffer.from(chunkSha256, "hex")
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.sharedChunk, digest),
    chunkBytes,
    chunkSha256
  });
  sharedChunks.add(value);
  return value;
}

/** Builds a non-executable ordered chunk layout for one standalone model. */
function storageLayout(input) {
  exactKeys(input, ["target", "chunks"], "storage layout");
  const target = branded(input.target, standaloneModels,
    "storage layout target");
  const chunks = boundedArray(input.chunks, "storage layout chunks")
    .map((chunk) => branded(chunk, sharedChunks, "storage layout chunk"));
  invariant(chunks.length > 0, "storage layout requires chunks");
  const seen = new Set();
  let total = 0n;
  const encodedChunks = [];
  for (const chunk of chunks) {
    invariant(!seen.has(chunk.id.display),
      "storage layout contains a duplicate chunk");
    seen.add(chunk.id.display);
    total = checkedAdd(total, chunk.chunkBytes, "storage layout bytes");
    encodedChunks.push(
      encodeTypedId(chunk.id),
      encodeU64(chunk.chunkBytes)
    );
  }
  invariant(total === target.modelBytes,
    "storage layout bytes do not match the target");
  const digest = sha256(Buffer.concat([
    domainBytes(storageLayoutDomain),
    encodeU32(CONTENT_VERSION),
    encodeTypedId(target.id),
    encodeU64(target.modelBytes),
    encodeCount(chunks.length, "storage chunk"),
    ...encodedChunks
  ]));
  const value = Object.freeze({
    digest,
    target,
    chunks: Object.freeze(chunks)
  });
  storageLayouts.add(value);
  return value;
}

/** Verifies every chunk and the complete reconstructed target byte stream. */
function verifyReconstruction(layout, payloads) {
  const value = branded(layout, storageLayouts, "storage layout");
  invariant(Array.isArray(payloads) &&
    payloads.length === value.chunks.length,
    "reconstruction payload count is invalid");
  const targetHash = crypto.createHash("sha256");
  let targetBytes = 0n;
  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index];
    invariant(Buffer.isBuffer(payload) || payload instanceof Uint8Array,
      "reconstruction payload must be bytes");
    const bytes = Buffer.from(payload);
    const chunk = value.chunks[index];
    invariant(BigInt(bytes.length) === chunk.chunkBytes,
      "reconstruction chunk length is invalid");
    invariant(sha256(bytes) === chunk.chunkSha256,
      "reconstruction chunk digest is invalid");
    targetBytes = checkedAdd(
      targetBytes,
      BigInt(bytes.length),
      "reconstructed target bytes"
    );
    targetHash.update(bytes);
  }
  invariant(targetBytes === value.target.modelBytes,
    "reconstructed target length is invalid");
  invariant(targetHash.digest("hex") === value.target.modelSha256,
    "reconstructed target digest is invalid");
}

/** Builds one KV-format descriptor identity without authorizing cache reuse. */
function kvFormat(input) {
  exactKeys(input, ["descriptorBytes", "descriptorSha256"], "KV format");
  const descriptorBytes = positiveU64(
    input.descriptorBytes,
    "descriptorBytes"
  );
  const descriptorSha256 = normalizeDigest(
    input.descriptorSha256,
    "descriptorSha256"
  );
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.kvFormat.domain),
    encodeU32(CONTENT_VERSION),
    encodeU64(descriptorBytes),
    Buffer.from(descriptorSha256, "hex")
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.kvFormat, digest),
    descriptorBytes,
    descriptorSha256
  });
  kvFormats.add(value);
  return value;
}

/** Builds one durable retrieval index bound to its embedding interpretation. */
function retrievalIndex(input) {
  exactKeys(input, [
    "indexBytes", "indexSha256", "embeddingModel",
    "embeddingProfileSha256", "vectorDimension", "metric"
  ], "retrieval index");
  const indexBytes = positiveU64(input.indexBytes, "indexBytes");
  const indexSha256 = normalizeDigest(input.indexSha256, "indexSha256");
  const embeddingModel = branded(
    input.embeddingModel,
    standaloneModels,
    "embedding model"
  );
  const embeddingProfileSha256 = normalizeDigest(
    input.embeddingProfileSha256,
    "embeddingProfileSha256"
  );
  const vectorDimension = u32Value(
    input.vectorDimension,
    "vectorDimension",
    false
  );
  const metric = metricValue(input.metric);
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.retrievalIndex.domain),
    encodeU32(CONTENT_VERSION),
    encodeU64(indexBytes),
    Buffer.from(indexSha256, "hex"),
    encodeTypedId(embeddingModel.id),
    Buffer.from(embeddingProfileSha256, "hex"),
    encodeU32(vectorDimension),
    Buffer.from([metric.tag])
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.retrievalIndex, digest),
    indexBytes,
    indexSha256,
    embeddingModelId: embeddingModel.id,
    embeddingProfileSha256,
    vectorDimension,
    metric: metric.name
  });
  retrievalIndexes.add(value);
  return value;
}

/** Sorts and rejects duplicate content identities. */
function sortedUniqueIds(values, label) {
  const result = values.map((value) => requireContentId(value, label));
  result.sort(compareIds);
  for (let index = 1; index < result.length; index += 1) {
    invariant(compareIds(result[index - 1], result[index]) !== 0,
      `${label} contains a duplicate identity`);
  }
  return result;
}

/** Builds one conservative pre-generation route-policy identity. */
function routePolicy(input) {
  exactKeys(input, [
    "policyBytes", "policySha256", "champion", "specialists", "selectors"
  ], "route policy");
  const policyBytes = positiveU64(input.policyBytes, "policyBytes");
  const policySha256 = normalizeDigest(input.policySha256, "policySha256");
  const champion = branded(input.champion, compositions, "route champion");
  invariant(champion.semantics === compositionSemantics.baseOnly.name,
    "route champion must be a base-only composition");
  const specialists = boundedArray(input.specialists, "route specialists")
    .map((specialist) =>
      branded(specialist, compositions, "route specialist"));
  invariant(specialists.length > 0,
    "route policy requires at least one specialist");
  const specialistIds = sortedUniqueIds(
    specialists.map((specialist) => specialist.id),
    "route specialist"
  );
  invariant(!specialistIds.some((id) =>
    id.display === champion.id.display),
  "route specialist cannot equal the champion");
  const selectors = boundedArray(input.selectors, "route selectors");
  const selectorIds = sortedUniqueIds(selectors, "route selector");
  invariant(selectorIds.every((id) =>
    id.kind === artifactKinds.standaloneModel.name ||
      id.kind === artifactKinds.retrievalIndex.name),
  "route selector kind is invalid");
  const digest = sha256(Buffer.concat([
    domainBytes(artifactKinds.routePolicy.domain),
    encodeU32(CONTENT_VERSION),
    encodeU64(policyBytes),
    Buffer.from(policySha256, "hex"),
    encodeTypedId(champion.id),
    encodeCount(specialistIds.length, "route specialist"),
    ...specialistIds.map(encodeTypedId),
    encodeCount(selectorIds.length, "route selector"),
    ...selectorIds.map(encodeTypedId)
  ]));
  const value = Object.freeze({
    id: createContentId(artifactKinds.routePolicy, digest),
    policyBytes,
    policySha256,
    championId: champion.id,
    specialistIds: Object.freeze(specialistIds),
    selectorIds: Object.freeze(selectorIds)
  });
  routePolicies.add(value);
  return value;
}

/** Builds the exact composition-bound key required for any KV cache hit. */
function kvCacheKey(input) {
  exactKeys(input, [
    "composition", "positionPolicySha256", "kvFormat",
    "promptTokenSha256"
  ], "KV cache key");
  const active = branded(input.composition, compositions,
    "KV composition");
  const positionPolicySha256 = normalizeDigest(
    input.positionPolicySha256,
    "positionPolicySha256"
  );
  const format = branded(input.kvFormat, kvFormats, "KV format");
  const promptTokenSha256 = normalizeDigest(
    input.promptTokenSha256,
    "promptTokenSha256"
  );
  return sha256(Buffer.concat([
    domainBytes(kvCacheKeyDomain),
    encodeU32(CONTENT_VERSION),
    encodeTypedId(active.id),
    Buffer.from(active.base.bindings.tokenizerSha256, "hex"),
    Buffer.from(active.base.bindings.chatTemplateSha256, "hex"),
    Buffer.from(positionPolicySha256, "hex"),
    encodeTypedId(format.id),
    Buffer.from(promptTokenSha256, "hex"),
    Buffer.from(active.base.bindings.executionProfileSha256, "hex")
  ]));
}

/** Validates current and peak runtime memory measurements. */
function runtimeMemory(input) {
  exactKeys(input, [
    "kvAllocatedBytes", "kvCommittedBytes", "kvPeakBytes",
    "activationScratchBytes", "decodedTemporaryBytes", "peakResidentBytes"
  ], "runtime memory");
  const value = Object.freeze({
    kvAllocatedBytes: nonnegativeU64(
      input.kvAllocatedBytes,
      "kvAllocatedBytes"
    ),
    kvCommittedBytes: nonnegativeU64(
      input.kvCommittedBytes,
      "kvCommittedBytes"
    ),
    kvPeakBytes: nonnegativeU64(input.kvPeakBytes, "kvPeakBytes"),
    activationScratchBytes: nonnegativeU64(
      input.activationScratchBytes,
      "activationScratchBytes"
    ),
    decodedTemporaryBytes: nonnegativeU64(
      input.decodedTemporaryBytes,
      "decodedTemporaryBytes"
    ),
    peakResidentBytes: nonnegativeU64(
      input.peakResidentBytes,
      "peakResidentBytes"
    )
  });
  invariant(value.kvCommittedBytes <= value.kvAllocatedBytes,
    "committed KV bytes exceed allocated bytes");
  invariant(value.kvPeakBytes >= value.kvAllocatedBytes &&
    value.kvPeakBytes >= value.kvCommittedBytes,
  "peak KV bytes are invalid");
  invariant(value.peakResidentBytes >= value.kvPeakBytes &&
    value.peakResidentBytes >= value.activationScratchBytes &&
    value.peakResidentBytes >= value.decodedTemporaryBytes,
  "peak resident bytes are invalid");
  return value;
}

/** Tracks unique verified physical objects for portfolio byte accounting. */
class PhysicalPortfolio {
  /** Creates an empty physical portfolio. */
  constructor() {
    this.objects = new Map();
    this.layoutTargets = new Set();
  }

  /** Adds one monolithic standalone model object. */
  addStandalone(value) {
    const model = branded(value, standaloneModels, "physical standalone");
    this.insert(model.id, model.modelBytes);
    return this;
  }

  /** Adds verified chunks in place of one monolithic standalone object. */
  addStorageLayout(value) {
    const layout = branded(value, storageLayouts, "physical storage layout");
    invariant(!this.layoutTargets.has(layout.target.id.display),
      "physical portfolio already contains this storage layout target");
    for (const chunk of layout.chunks) {
      this.insert(chunk.id, chunk.chunkBytes);
    }
    this.layoutTargets.add(layout.target.id.display);
    return this;
  }

  /** Adds one adapter object. */
  addAdapter(value) {
    const adapter = branded(value, adapters, "physical adapter");
    this.insert(adapter.id, adapter.adapterBytes);
    return this;
  }

  /** Adds one route-policy object. */
  addRoutePolicy(value) {
    const route = branded(value, routePolicies, "physical route policy");
    this.insert(route.id, route.policyBytes);
    return this;
  }

  /** Adds one retrieval-index object. */
  addRetrievalIndex(value) {
    const index = branded(value, retrievalIndexes,
      "physical retrieval index");
    this.insert(index.id, index.indexBytes);
    return this;
  }

  /** Adds one KV-format descriptor object. */
  addKvFormat(value) {
    const format = branded(value, kvFormats, "physical KV format");
    this.insert(format.id, format.descriptorBytes);
    return this;
  }

  /** Derives the 13 required byte categories for one active composition. */
  account(activeValue, runtimeValue) {
    const active = branded(activeValue, compositions,
      "active composition");
    const runtime = runtimeMemory(runtimeValue);
    const basePresent = this.objects.has(active.base.id.display) ||
      this.layoutTargets.has(active.base.id.display);
    invariant(basePresent, "active composition base is missing");
    invariant(active.members.every((member) =>
      this.objects.has(member.adapter.id.display)),
    "active composition adapter is missing");

    let physicalPortfolioBytes = 0n;
    for (const object of this.objects.values()) {
      physicalPortfolioBytes = checkedAdd(
        physicalPortfolioBytes,
        object.bytes,
        "physical portfolio bytes"
      );
    }
    const result = Object.freeze({
      standaloneArtifactBytes: active.base.modelBytes,
      logicalCompositionBytes: active.logicalBytes,
      incrementalSpecialistBytes: active.incrementalSpecialistBytes,
      physicalPortfolioBytes,
      routePolicyBytes: this.sumKind(artifactKinds.routePolicy.name),
      retrievalIndexBytes: this.sumKind(
        artifactKinds.retrievalIndex.name
      ),
      kvFormatDescriptorBytes: this.sumKind(artifactKinds.kvFormat.name),
      kvAllocatedBytes: runtime.kvAllocatedBytes,
      kvCommittedBytes: runtime.kvCommittedBytes,
      kvPeakBytes: runtime.kvPeakBytes,
      activationScratchBytes: runtime.activationScratchBytes,
      decodedTemporaryBytes: runtime.decodedTemporaryBytes,
      peakResidentBytes: runtime.peakResidentBytes
    });
    invariant(
      Object.keys(result).join("\n") === requiredByteFields.join("\n"),
      "byte accounting field order drifted"
    );
    return result;
  }

  /** Inserts an object once, allowing an exact idempotent re-add. */
  insert(idValue, bytesValue) {
    const id = requireContentId(idValue, "physical object");
    const bytes = positiveU64(bytesValue, "physical object bytes");
    const existing = this.objects.get(id.display);
    if (existing !== undefined) {
      invariant(existing.bytes === bytes,
        "physical object byte count changed");
      return;
    }
    this.objects.set(id.display, Object.freeze({ id, bytes }));
  }

  /** Sums one physical artifact class with checked u64 arithmetic. */
  sumKind(kind) {
    let total = 0n;
    for (const object of this.objects.values()) {
      if (object.id.kind === kind) {
        total = checkedAdd(total, object.bytes, `${kind} bytes`);
      }
    }
    return total;
  }
}

module.exports = Object.freeze({
  PhysicalPortfolio,
  artifactKinds,
  baseDependentAdapter,
  composition,
  compositionMember,
  compositionSemantics,
  decodeTypedId,
  encodeTypedId,
  executionBindings,
  kvCacheKey,
  kvFormat,
  requiredByteFields,
  retrievalIndex,
  retrievalMetrics,
  routePolicy,
  runtimeMemory,
  sharedChunk,
  standaloneModel,
  storageLayout,
  verifyReconstruction
});
