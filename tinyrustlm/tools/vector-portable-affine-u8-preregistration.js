"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const schema = "tinyrustlm.portable_affine_u8_flat_preregistration.v1";
const experimentId = "portable-affine-u8-flat-20260726";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultRelativePath =
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-flat-preregistration.v1.json";
const defaultPath = path.join(repositoryRoot, defaultRelativePath);
const expectedManifestSha256 =
  "76cccb8fe353847235f8ea1d647c6762677e19b8abe593b83f9733dfbfe6c06d";
const maximumManifestBytes = 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:^|[\s"'=])(?:[a-z]:[\\/]|\/home\/|\/users\/|\/mnt\/[a-z]\/)|bearer\s+|(?:token|secret|password)=|(?:sk|ghp)_[A-Za-z0-9_-]{12,}|turn\d+(?:search|view)\d+/iu;

const topLevelKeys = Object.freeze([
  "schema",
  "experimentId",
  "registeredAtUtc",
  "status",
  "lineage",
  "method",
  "implementationBoundary",
  "corpusReuse",
  "groundTruth",
  "byteAccounting",
  "qualityThresholds",
  "nativeAndWasm",
  "performanceThresholds",
  "persistenceAndFailure",
  "execution",
  "validity",
  "evidencePolicy",
  "authority",
  "requiredNextGate"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    `${label} fields are invalid`
  );
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function canonicalManifestBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function publicSafe(value) {
  invariant(
    !forbiddenTextPattern.test(JSON.stringify(value)),
    "manifest contains private or secret text"
  );
}

function validateCriticalBoundaries(manifest) {
  invariant(
    manifest.lineage.terminalReferenceExperiment.sameExperimentRetryAllowed === false &&
      manifest.lineage.terminalReferenceExperiment.rawQualityMetricsRetained === false &&
      manifest.lineage.newMethodIsNotATurboVecRetry === true &&
      manifest.lineage.newMethodMayNotClaimTurboVecOrTurboQuantParity === true,
    "terminal reference lineage is invalid"
  );
  invariant(
    manifest.method.methodId === "portable-global-affine-u8-flat-v1" &&
      manifest.method.bitWidth === 8 &&
      manifest.method.levels === 256 &&
      manifest.method.sourceVectorRerankingAllowed === false &&
      manifest.method.decodedF32ShadowAllowed === false &&
      manifest.method.bestOfNAllowed === false,
    "method contract is invalid"
  );
  invariant(
    manifest.implementationBoundary.implementationExistsAtRegistration === false &&
      manifest.implementationBoundary.comparisonResultExistsAtRegistration === false &&
      manifest.implementationBoundary.unsafeCodeAllowed === false &&
      manifest.implementationBoundary.workspaceDependencyAdditionAllowed === false &&
      manifest.implementationBoundary.productImportAllowed === false &&
      manifest.implementationBoundary.existingExactFlatSourceMutationAllowed === false &&
      manifest.implementationBoundary.existingScalarPrimitiveMutationAllowed === false,
    "implementation boundary is invalid"
  );
  invariant(
    manifest.corpusReuse.selectionSha256 ===
      "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd" &&
      manifest.corpusReuse.selectedRecordAndQueryIdentitiesMustMatchParent === true &&
      manifest.corpusReuse.lanes.length === 6 &&
      manifest.corpusReuse.selectedIndicesMayEnterEvidence === false &&
      manifest.corpusReuse.rawVectorsMayEnterEvidence === false,
    "sealed corpus contract is invalid"
  );
  invariant(
    manifest.byteAccounting.candidateFormula === "96+n*(8+d)" &&
      manifest.byteAccounting.maximumCandidateToFullExactPersistentRatioPerLane === 0.3 &&
      manifest.byteAccounting.nominalBitWidthMaySubstituteForEffectiveBytes === false &&
      manifest.byteAccounting.sameCorpusComparisonMayBeCalledEqualByte === false,
    "byte accounting contract is invalid"
  );
  invariant(
    manifest.qualityThresholds.sameCorpusAllLanes.minimumRecallAt1 === 0.85 &&
      manifest.qualityThresholds.sameCorpusAllLanes.minimumRecallAt10 === 0.95 &&
      manifest.qualityThresholds.sameCorpusAllLanes.minimumRecallAt100 === 0.98 &&
      manifest.qualityThresholds.resultDrivenChangesAllowed === false &&
      manifest.qualityThresholds.failedThresholdMayBeLowered === false &&
      manifest.qualityThresholds.qualityThresholdFailureMayBeRetried === false,
    "quality threshold contract is invalid"
  );
  invariant(
    manifest.nativeAndWasm.wasmTarget === "wasm32-unknown-unknown" &&
      manifest.nativeAndWasm.wasmBuildRequired === true &&
      manifest.nativeAndWasm.wasmImportsAllowed === 0 &&
      manifest.nativeAndWasm.nativeAndWasmCanonicalIndexBytesMustMatch === true &&
      manifest.nativeAndWasm.nativeAndWasmSelectedExternalIdsMustMatch === true &&
      manifest.nativeAndWasm.realBrowserExecutionRequiredBeforeProductPromotion === true,
    "native and wasm contract is invalid"
  );
  invariant(
    manifest.execution.networkPolicy === "deny-all-during-observation" &&
      manifest.execution.terminalOutcomeMetricsMustBeRetained === true &&
      manifest.execution.bestOfNAllowed === false &&
      manifest.execution.resultRepairAllowed === false &&
      manifest.execution.qualityThresholdFailureMayBeRetried === false &&
      manifest.execution.performanceOutcomeFailureMayBeRetried === false,
    "execution contract is invalid"
  );
  invariant(
    manifest.evidencePolicy.failedAttemptsArePreserved === true &&
      manifest.evidencePolicy.terminalOutcomeMetricsArePreserved === true &&
      manifest.evidencePolicy.rawVectorsAllowed === false &&
      manifest.evidencePolicy.privateAbsolutePathsAllowed === false &&
      manifest.evidencePolicy.credentialsAllowed === false &&
      manifest.evidencePolicy.modelBytesAllowed === false,
    "evidence policy is invalid"
  );
  invariant(
    manifest.authority.portableAffineU8NumericalBehaviorMayBeClaimed === true &&
      manifest.authority.turboVecParityMayBeClaimed === false &&
      manifest.authority.turboQuantPaperConformanceMayBeClaimed === false &&
      manifest.authority.representativeSemanticMemoryQualityMayBeClaimed === false &&
      manifest.authority.productIntegrationMayBeClaimed === false &&
      manifest.authority.trainingMayBeAuthorized === false &&
      manifest.authority.releaseMayBeAuthorized === false,
    "authority contract is invalid"
  );
}

function validateManifest(manifest) {
  exactKeys(manifest, topLevelKeys, "manifest");
  invariant(manifest.schema === schema, "manifest schema is invalid");
  invariant(manifest.experimentId === experimentId, "manifest experimentId is invalid");
  invariant(
    utcPattern.test(manifest.registeredAtUtc) &&
      Number.isFinite(Date.parse(manifest.registeredAtUtc)),
    "manifest registeredAtUtc is invalid"
  );
  invariant(
    manifest.status === "preregistered-before-implementation-or-results",
    "manifest status is invalid"
  );
  publicSafe(manifest);
  validateCriticalBoundaries(manifest);
  invariant(
    sha256(canonicalManifestBytes(manifest)) === expectedManifestSha256,
    "manifest frozen contract is invalid"
  );
  return manifest;
}

function lineageFiles(manifest) {
  return [
    ...manifest.lineage.sealedBaseline,
    manifest.lineage.terminalReferenceExperiment.preregistration,
    ...manifest.lineage.terminalReferenceExperiment.attempts
  ];
}

function validateLineageFiles(manifest) {
  for (const [index, entry] of lineageFiles(manifest).entries()) {
    invariant(relativePathPattern.test(entry.path), `lineage[${index}] path is unsafe`);
    const resolved = path.resolve(repositoryRoot, entry.path);
    const relative = path.relative(repositoryRoot, resolved);
    invariant(
      relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
      `lineage[${index}] escaped repository root`
    );
    const stat = fs.lstatSync(resolved);
    invariant(
      stat.isFile() && !stat.isSymbolicLink(),
      `lineage[${index}] must be a regular file`
    );
    const expected = entry.sha256 ?? entry.fileSha256;
    invariant(sha256Pattern.test(expected), `lineage[${index}] hash is invalid`);
    invariant(sha256File(resolved) === expected, `lineage[${index}] bytes drifted`);
  }
}

function validateManifestFile(filePath = defaultPath) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 0 && stat.size <= maximumManifestBytes,
    "manifest file is invalid"
  );
  const bytes = fs.readFileSync(filePath);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const manifest = JSON.parse(text);
  invariant(
    bytes.equals(canonicalManifestBytes(manifest)),
    "manifest bytes are not canonical pretty JSON"
  );
  validateManifest(manifest);
  validateLineageFiles(manifest);
  invariant(sha256(bytes) === expectedManifestSha256, "manifest file hash is invalid");
  return Object.freeze({
    manifest,
    bytes: bytes.length,
    sha256: expectedManifestSha256
  });
}

if (require.main === module) {
  const result = validateManifestFile(process.argv[2] ?? defaultPath);
  process.stdout.write(`${JSON.stringify({
    schema: result.manifest.schema,
    experimentId: result.manifest.experimentId,
    status: result.manifest.status,
    bytes: result.bytes,
    sha256: result.sha256
  }, null, 2)}\n`);
}

module.exports = Object.freeze({
  defaultPath,
  expectedManifestSha256,
  experimentId,
  schema,
  validateManifest,
  validateManifestFile
});
