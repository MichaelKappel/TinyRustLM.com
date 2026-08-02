"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const manifestRelativePath =
  "tinyrustlm/experiments/specialist-portfolio/" +
  "content-identity-preregistration.v1.json";
const manifestPath = path.join(repositoryRoot, manifestRelativePath);
const expectedSchema = "tinyrustlm.content_identity_preregistration.v1";
const expectedExperimentId = "immutable-specialist-content-identity-20260725";
const expectedManifestBytes = 12175;
const expectedManifestSha256 =
  "fcc00f258f6049a0a02a75748fd52b63bbb3af68d31c8e9937af4137bf3aaa52";
const sha256Pattern = /^[a-f0-9]{64}$/u;

const expectedKinds = Object.freeze([
  ["standalone-model", 1, "model-sha256-",
    "tinyrustlm.content.standalone-model.v1"],
  ["base-dependent-adapter", 2, "adapter-sha256-",
    "tinyrustlm.content.base-dependent-adapter.v1"],
  ["composition", 3, "composition-sha256-",
    "tinyrustlm.content.composition.v1"],
  ["shared-chunk", 4, "chunk-sha256-",
    "tinyrustlm.content.shared-chunk.v1"],
  ["route-policy", 5, "route-sha256-",
    "tinyrustlm.content.route-policy.v1"],
  ["kv-format", 6, "kv-format-sha256-",
    "tinyrustlm.content.kv-format.v1"],
  ["retrieval-index", 7, "retrieval-sha256-",
    "tinyrustlm.content.retrieval-index.v1"]
]);

const expectedSemantics = Object.freeze([
  ["base-only", 0, "exactly-zero", "none", "none"],
  ["additive", 1, "one-or-more", "sort-by-full-typed-identity-bytes",
    "all-empty"],
  ["replacement", 2, "exactly-one", "declared-order-is-material",
    "all-empty"],
  ["sequential", 3, "one-or-more", "declared-order-is-material",
    "all-empty"],
  ["dependent", 4, "one-or-more",
    "declared-topological-order-is-material",
    "sorted-unique-earlier-member-typed-identities"]
]);

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

const expectedDigests = Object.freeze({
  standaloneModel:
    "83d45410e3001af2e476fe0ec9e3b24ce25da89ff764984bf8113d17c6e70712",
  additiveAdapter:
    "0d36e52ccbfa3d41b4186d1a3a2d9adeda28f41a0ae40d7fc184763fd20ac9f6",
  championComposition:
    "217a076597ef9e5ecbd5c7152cf20b5d4158db4b0faadf9ac4e3cef42ab9bb59",
  specialistComposition:
    "c7a1d4b8586cee3f9d8d284dd7bbc5f555bc8be620a766f5120dcfbfb7d41e20",
  chunkOne:
    "f79a22b124d46f5d8516b581d3bb84a5d9e652a6002ff47c03d482b19309f3a6",
  chunkTwo:
    "46432c105cdeab0fdc64bbdddf32aee4132a6ebefd166f9f481ea81fa2c0eba0",
  storageLayout:
    "210193d2db2f3bf84dce1d7390ab8be25e92d3a4b518ede1ac5bb9498f662db9",
  kvFormat:
    "8108d7a2bda41c88d3e541f47b17be789462b7360c391a7ebbe9264408322430",
  retrievalIndex:
    "b5b59c101fd6ce1245c94043665db7616c217359208e99a1461a5906ed899a59",
  routePolicy:
    "f33ccf5198a97517a07bc68408aa7784bdefe5d779532f4ffedd612ae08dccfe",
  kvCacheKey:
    "be74ec931c3fa92500ba6f292d046789c61324ce712636476a45aec9758d0f51"
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

/** Requires exact canonical structural equality. */
function exactStructure(value, expected, label) {
  invariant(canonicalJson(value) === canonicalJson(expected),
    `${label} is invalid`);
}

/** Computes lowercase SHA-256 for exact bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Validates the frozen content-identity preregistration object. */
function validateManifest(value) {
  exactKeys(value, [
    "schema", "experimentId", "status", "scope", "encoding",
    "artifactKinds", "compositionSemantics", "validationRules",
    "storageLayout", "kvCacheKey", "byteAccounting", "testVector",
    "authority", "requiredNextGate"
  ], "manifest");
  invariant(value.schema === expectedSchema, "manifest schema is invalid");
  invariant(value.experimentId === expectedExperimentId,
    "manifest experiment id is invalid");
  invariant(value.status === "preregistered-no-runtime-authority",
    "manifest status is invalid");

  exactKeys(value.scope, [
    "purpose", "preReleaseRewrite", "legacyCompatibility",
    "runtimeIntegrationAuthorized", "modelAdoptionAuthorized",
    "trainingAuthorized", "releaseAuthorized"
  ], "scope");
  invariant(
    value.scope.preReleaseRewrite === true &&
      value.scope.legacyCompatibility === false &&
      value.scope.runtimeIntegrationAuthorized === false &&
      value.scope.modelAdoptionAuthorized === false &&
      value.scope.trainingAuthorized === false &&
      value.scope.releaseAuthorized === false,
    "scope authority is invalid"
  );

  exactKeys(value.encoding, [
    "hashAlgorithm", "domainEncoding", "unsignedIntegerEncoding",
    "versionEncoding", "byteCountEncoding", "listCountEncoding",
    "enumEncoding", "digestEncoding", "typedIdentityEncoding",
    "contentVersion", "identityDisplay", "timestampsInContentIdentity",
    "hostnamesInContentIdentity", "processIdsInContentIdentity",
    "mutableAliasesInContentIdentity"
  ], "encoding");
  exactStructure(value.encoding, {
    hashAlgorithm: "SHA-256",
    domainEncoding: "utf8-followed-by-one-zero-byte",
    unsignedIntegerEncoding: "fixed-width-little-endian",
    versionEncoding: "u32",
    byteCountEncoding: "u64",
    listCountEncoding: "u32",
    enumEncoding: "u8",
    digestEncoding: "exactly-32-raw-bytes",
    typedIdentityEncoding:
      "one-u8-kind-tag-followed-by-32-digest-bytes",
    contentVersion: 1,
    identityDisplay: "lowercase-kind-prefix-plus-full-lowercase-sha256",
    timestampsInContentIdentity: false,
    hostnamesInContentIdentity: false,
    processIdsInContentIdentity: false,
    mutableAliasesInContentIdentity: false
  }, "encoding");

  invariant(
    Array.isArray(value.artifactKinds) &&
      value.artifactKinds.length === expectedKinds.length,
    "artifact kind count is invalid"
  );
  value.artifactKinds.forEach((kind, index) => {
    exactKeys(kind, [
      "kind", "tag", "displayPrefix", "domain", "fieldOrder"
    ], `artifact kind ${index}`);
    const expected = expectedKinds[index];
    exactStructure(
      [kind.kind, kind.tag, kind.displayPrefix, kind.domain],
      expected,
      `artifact kind ${index} identity`
    );
    invariant(
      Array.isArray(kind.fieldOrder) && kind.fieldOrder.length >= 3 &&
        kind.fieldOrder[0] === "contentVersion" &&
        new Set(kind.fieldOrder).size === kind.fieldOrder.length,
      `artifact kind ${index} field order is invalid`
    );
  });

  invariant(
    Array.isArray(value.compositionSemantics) &&
      value.compositionSemantics.length === expectedSemantics.length,
    "composition semantics count is invalid"
  );
  value.compositionSemantics.forEach((semantic, index) => {
    exactKeys(semantic, [
      "name", "tag", "memberRule", "orderingRule", "dependencyRule"
    ], `composition semantic ${index}`);
    exactStructure(
      [
        semantic.name,
        semantic.tag,
        semantic.memberRule,
        semantic.orderingRule,
        semantic.dependencyRule
      ],
      expectedSemantics[index],
      `composition semantic ${index}`
    );
  });

  invariant(
    Array.isArray(value.validationRules) &&
      value.validationRules.length === 10 &&
      value.validationRules.every((rule) =>
        typeof rule === "string" && rule.length >= 40),
    "validation rules are invalid"
  );
  exactKeys(value.storageLayout, ["domain", "fieldOrder", "rules"],
    "storage layout");
  invariant(
    value.storageLayout.domain ===
      "tinyrustlm.content.storage-layout.v1" &&
      value.storageLayout.fieldOrder.length === 5 &&
      value.storageLayout.rules.length === 5,
    "storage layout contract is invalid"
  );
  exactKeys(value.kvCacheKey, ["domain", "fieldOrder", "rules"],
    "kv cache key");
  invariant(
    value.kvCacheKey.domain === "tinyrustlm.content.kv-cache-key.v1" &&
      value.kvCacheKey.fieldOrder.length === 8 &&
      value.kvCacheKey.rules.length === 3,
    "kv cache key contract is invalid"
  );
  exactKeys(value.byteAccounting, ["requiredFields", "rules"],
    "byte accounting");
  exactStructure(
    value.byteAccounting.requiredFields,
    requiredByteFields,
    "byte accounting fields"
  );
  invariant(value.byteAccounting.rules.length === 5,
    "byte accounting rules are invalid");

  exactKeys(value.testVector, [
    "hashOctets", "sizes", "expectedDigests"
  ], "test vector");
  exactKeys(value.testVector.hashOctets, [
    "model", "tokenizer", "chatTemplate", "tensorLayout",
    "quantizationProfile", "executionProfile", "adapter", "chunkOne",
    "chunkTwo", "kvDescriptor", "retrievalIndex", "embeddingProfile",
    "routePolicy"
  ], "test vector hash octets");
  for (const [name, digest] of Object.entries(value.testVector.hashOctets)) {
    invariant(sha256Pattern.test(digest) && !/^0{64}$/u.test(digest),
      `test vector ${name} is invalid`);
  }
  exactKeys(value.testVector.sizes, [
    "modelBytes", "adapterBytes", "chunkBytes", "kvDescriptorBytes",
    "retrievalIndexBytes", "routePolicyBytes",
    "retrievalVectorDimension", "retrievalMetricTag"
  ], "test vector sizes");
  invariant(
    Object.values(value.testVector.sizes).every((size) =>
      Number.isSafeInteger(size) && size > 0),
    "test vector sizes are invalid"
  );
  exactStructure(
    value.testVector.expectedDigests,
    expectedDigests,
    "test vector expected digests"
  );

  exactKeys(value.authority, [
    "contentIdentityContractFrozen", "crossLanguageImplementationVerified",
    "runtimeCompositionImplemented", "immutableOverlayExecutionVerified",
    "atomicActivationVerified", "kvIsolationVerified",
    "trainedSpecialistVerified", "routerVerified", "browserVerified",
    "productIntegrationVerified", "trainingAuthorized", "releaseAuthorized"
  ], "authority");
  invariant(value.authority.contentIdentityContractFrozen === true,
    "content identity contract is not frozen");
  for (const [key, authority] of Object.entries(value.authority)) {
    if (key !== "contentIdentityContractFrozen") {
      invariant(authority === false, `authority ${key} is inflated`);
    }
  }
  invariant(
    value.requiredNextGate ===
      "Commit an independent zero-dependency Rust implementation and a " +
      "separately implemented JavaScript oracle, then prove every frozen " +
      "vector, rejection rule, byte category, and cross-language identity " +
      "without integrating or applying an adapter.",
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
  expectedDigests,
  expectedManifestBytes,
  expectedManifestSha256,
  manifestPath,
  manifestRelativePath,
  requiredByteFields,
  validateManifest,
  validateManifestFile
});
