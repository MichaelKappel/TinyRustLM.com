"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const manifestSchema = "tinyrustlm.exact_flat_retrieval_preregistration.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(
  repositoryRoot,
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-preregistration.v1.json"
);
const maximumManifestBytes = 256 * 1024;
const forbiddenTextPattern = /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|turn[0-9]+(?:search|view)[0-9]+|token=|secret=|bearer\s)/iu;

const topLevelKeys = Object.freeze([
  "schema",
  "experimentId",
  "registeredAtUtc",
  "status",
  "storageLane",
  "productAuthority",
  "trainingAuthority",
  "normativeSourceIds",
  "format",
  "identityFields",
  "pipeline",
  "limits",
  "testMatrix",
  "acceptance",
  "privacy",
  "requiredNextGate"
]);
const formatKeys = Object.freeze([
  "name",
  "magicAscii",
  "version",
  "headerBytes",
  "recordPrefixBytes",
  "footerBytes",
  "byteOrder",
  "recordOrder",
  "vectorEncoding",
  "footerIntegrity",
  "externalArtifactIdentity",
  "storesPayloadText"
]);
const limitKeys = Object.freeze([
  "maximumDimension",
  "maximumRecords",
  "maximumSerializedBytes",
  "maximumSearchResults"
]);
const matrixKeys = Object.freeze([
  "dimensions",
  "metrics",
  "normalizations",
  "transforms",
  "corpora",
  "lifecycleCases"
]);
const acceptanceKeys = Object.freeze([
  "canonicalBytesOrderInvariant",
  "nativeScoreAbsoluteTolerance",
  "nativeRankParityRequired",
  "exactRecallMinimum",
  "filteredSearchRequired",
  "duplicateIdRejectionRequired",
  "tombstoneSearchExclusionRequired",
  "compactionVectorRemovalRequired",
  "restartByteEqualityRequired",
  "corruptionDetectionRequired",
  "truncationDetectionRequired",
  "boundedAllocationRequired",
  "wasmCompileRequired",
  "wasmExecutionRequiredBeforePromotion",
  "latencyClaimAllowed",
  "compressionClaimAllowed",
  "turboVecParityClaimAllowed",
  "productIntegrationClaimAllowed"
]);
const privacyKeys = Object.freeze([
  "rawConversationAccepted",
  "payloadTextAccepted",
  "searchReturnsExternalIdsAndScoresOnly",
  "retrievedContentAuthority",
  "durableConsentRequiredByFutureProductIntegration"
]);

const expectedIdentityFields = Object.freeze([
  "format-version",
  "embedding-model-sha256",
  "tokenizer-sha256",
  "normalization",
  "metric",
  "dimension",
  "transform-family",
  "transform-seed",
  "vector-encoding",
  "codebook-sha256",
  "calibration-policy",
  "calibration-sha256",
  "implementation-sha256",
  "record-set-revision"
]);
const expectedPipeline = Object.freeze([
  "validate-finite-f32",
  "canonicalize-negative-zero",
  "optional-l2-normalize-in-f64",
  "optional-seeded-orthogonal-transform-in-f64",
  "canonicalize-stored-f32",
  "scan-in-external-id-order",
  "accumulate-scores-in-f64",
  "rank-by-metric-then-external-id"
]);
const expectedDimensions = Object.freeze([1, 3, 4, 7, 8, 31, 32]);
const expectedMetrics = Object.freeze(["dot-product", "squared-euclidean", "cosine"]);
const expectedNormalizations = Object.freeze(["none", "l2-unit"]);
const expectedTransforms = Object.freeze([
  "none",
  "signed-permutation-v1",
  "signed-normalized-hadamard-v1"
]);
const expectedCorpora = Object.freeze([
  "normalized",
  "unnormalized",
  "sparse",
  "anisotropic",
  "outliers",
  "duplicate-vectors",
  "near-ties",
  "distribution-drift"
]);
const expectedLifecycleCases = Object.freeze([
  "build-order",
  "filtered-search",
  "duplicate-id",
  "empty-index",
  "tombstone",
  "compaction",
  "restart",
  "corruption",
  "truncation",
  "oversized-count",
  "unknown-field"
]);

/** Throws a stable validation error when `condition` is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns whether `value` is a non-array JSON object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Requires exactly the declared object keys to prevent silent schema growth. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be a JSON object`);
  const actual = Object.keys(value).sort();
  const expected = Array.from(keys).sort();
  invariant(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields are invalid`);
}

/** Requires exact array membership and ordering. */
function exactArray(value, expected, message) {
  invariant(Array.isArray(value) && JSON.stringify(value) === JSON.stringify(expected), message);
}

/** Requires a nonempty bounded string. */
function requiredString(value, label, maximum = 2048) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= maximum,
    `${label} must be a nonempty bounded string`);
  return value;
}

/** Requires one exact Boolean value. */
function requiredBoolean(value, expected, message) {
  invariant(value === expected, message);
  return value;
}

/** Returns canonical pretty-printed manifest bytes. */
function canonicalManifestBytes(manifest) {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/** Produces lowercase SHA-256 for one byte buffer. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Validates the complete frozen exact-flat preregistration. */
function validateManifest(manifest) {
  exactKeys(manifest, topLevelKeys, "manifest");
  invariant(manifest.schema === manifestSchema, "manifest schema is unsupported");
  invariant(manifest.experimentId === "exact-flat-f32-baseline-20260722",
    "experiment identity is invalid");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(manifest.registeredAtUtc)
    && Number.isFinite(Date.parse(manifest.registeredAtUtc)), "registeredAtUtc is invalid");
  invariant(manifest.status === "preregistered-before-results", "manifest status is invalid");
  invariant(manifest.storageLane === "embedding-index", "storage lane is invalid");
  requiredBoolean(manifest.productAuthority, false, "manifest must not grant product authority");
  requiredBoolean(manifest.trainingAuthority, false, "manifest must not grant training authority");
  exactArray(manifest.normativeSourceIds, ["nist-fips-180-4-2015"],
    "normative source identity is invalid");

  exactKeys(manifest.format, formatKeys, "manifest.format");
  const expectedFormat = {
    name: "tinyrustlm-exact-flat-f32-v1",
    magicAscii: "TRFLAT01",
    version: 1,
    headerBytes: 248,
    recordPrefixBytes: 16,
    footerBytes: 32,
    byteOrder: "little-endian",
    recordOrder: "external-id-ascending",
    vectorEncoding: "f32",
    footerIntegrity: "sha256-fips-180-4",
    externalArtifactIdentity: "sha256-required",
    storesPayloadText: false
  };
  invariant(JSON.stringify(manifest.format) === JSON.stringify(expectedFormat),
    manifest.format.storesPayloadText === true
      ? "format must not store payload text"
      : "format contract is invalid");

  exactArray(manifest.identityFields, expectedIdentityFields, "identity fields are invalid");
  exactArray(manifest.pipeline, expectedPipeline, "vector pipeline is invalid");

  exactKeys(manifest.limits, limitKeys, "manifest.limits");
  invariant(JSON.stringify(manifest.limits) === JSON.stringify({
    maximumDimension: 1048576,
    maximumRecords: 1000000,
    maximumSerializedBytes: 268435456,
    maximumSearchResults: 100000
  }), "bounded limits are invalid");

  exactKeys(manifest.testMatrix, matrixKeys, "manifest.testMatrix");
  exactArray(manifest.testMatrix.dimensions, expectedDimensions, "dimension matrix is invalid");
  exactArray(manifest.testMatrix.metrics, expectedMetrics, "metric matrix is invalid");
  exactArray(manifest.testMatrix.normalizations, expectedNormalizations,
    "normalization matrix is invalid");
  exactArray(manifest.testMatrix.transforms, expectedTransforms, "transform matrix is invalid");
  exactArray(manifest.testMatrix.corpora, expectedCorpora, "corpus matrix is invalid");
  exactArray(manifest.testMatrix.lifecycleCases, expectedLifecycleCases,
    "lifecycle matrix is invalid");

  exactKeys(manifest.acceptance, acceptanceKeys, "manifest.acceptance");
  const acceptance = manifest.acceptance;
  for (const field of [
    "canonicalBytesOrderInvariant",
    "nativeRankParityRequired",
    "filteredSearchRequired",
    "duplicateIdRejectionRequired",
    "tombstoneSearchExclusionRequired",
    "compactionVectorRemovalRequired",
    "restartByteEqualityRequired",
    "corruptionDetectionRequired",
    "truncationDetectionRequired",
    "boundedAllocationRequired",
    "wasmCompileRequired",
    "wasmExecutionRequiredBeforePromotion"
  ]) {
    requiredBoolean(acceptance[field], true, `${field} must remain required`);
  }
  invariant(acceptance.nativeScoreAbsoluteTolerance === 0,
    "native score tolerance must remain exact");
  invariant(acceptance.exactRecallMinimum === 1, "exact recall minimum must remain one");
  requiredBoolean(acceptance.latencyClaimAllowed, false,
    "latency claim must remain forbidden");
  requiredBoolean(acceptance.compressionClaimAllowed, false,
    "compression claim must remain forbidden");
  requiredBoolean(acceptance.turboVecParityClaimAllowed, false,
    "TurboVec parity claim must remain forbidden");
  requiredBoolean(acceptance.productIntegrationClaimAllowed, false,
    "product integration claim must remain forbidden");

  exactKeys(manifest.privacy, privacyKeys, "manifest.privacy");
  requiredBoolean(manifest.privacy.rawConversationAccepted, false,
    "raw conversation acceptance must remain false");
  requiredBoolean(manifest.privacy.payloadTextAccepted, false,
    "payload text acceptance must remain false");
  requiredBoolean(manifest.privacy.searchReturnsExternalIdsAndScoresOnly, true,
    "search output must remain identifier-and-score only");
  invariant(manifest.privacy.retrievedContentAuthority === "untrusted-data-only",
    "retrieved content authority is invalid");
  requiredBoolean(manifest.privacy.durableConsentRequiredByFutureProductIntegration, true,
    "future durable consent must remain required");

  requiredString(manifest.requiredNextGate, "manifest.requiredNextGate", 2048);
  invariant(!forbiddenTextPattern.test(JSON.stringify(manifest)),
    "manifest contains private, credential-like, or internal-citation text");
  return manifest;
}

/** Reads, bounds, canonicalizes, and validates one preregistration file. */
function validateManifestFile(filePath = manifestPath) {
  const metadata = fs.lstatSync(filePath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), "manifest must be a regular file");
  invariant(metadata.size > 0 && metadata.size <= maximumManifestBytes,
    "manifest size is invalid");
  const bytes = fs.readFileSync(filePath);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalManifestBytes(manifest)), "manifest bytes are not canonical");
  return Object.freeze({ manifest, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Validates the canonical preregistration and prints a public-safe summary. */
function main(argumentsList) {
  invariant(argumentsList.length <= 1, "usage: node vector-retrieval-preregistration.js [path]");
  const filePath = argumentsList.length === 0
    ? manifestPath
    : path.resolve(repositoryRoot, argumentsList[0]);
  const validated = validateManifestFile(filePath);
  process.stdout.write(`${JSON.stringify({
    schema: validated.manifest.schema,
    experimentId: validated.manifest.experimentId,
    status: validated.manifest.status,
    storageLane: validated.manifest.storageLane,
    productAuthority: validated.manifest.productAuthority,
    trainingAuthority: validated.manifest.trainingAuthority,
    bytes: validated.bytes,
    sha256: validated.sha256
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector retrieval preregistration failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  canonicalManifestBytes,
  manifestPath,
  manifestSchema,
  validateManifest,
  validateManifestFile
});
