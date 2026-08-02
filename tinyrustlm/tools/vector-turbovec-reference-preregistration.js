"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const schema = "tinyrustlm.turbovec_reference_comparison_preregistration.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultRelativePath =
  "tinyrustlm/experiments/vector-quantization/" +
  "turbovec-reference-comparison-preregistration.v1.json";
const defaultPath = path.join(repositoryRoot, defaultRelativePath);
const maximumManifestBytes = 1024 * 1024;
const expectedManifestSha256 =
  "96a3fad0078850e2fe9fb4d619979ca9e5b753f23a3fab6df53aebe9b9afe6ed";
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
  "parents",
  "sourcePin",
  "sourceScreen",
  "build",
  "corpusReuse",
  "method",
  "metricAdapters",
  "byteAccounting",
  "groundTruth",
  "qualityThresholds",
  "performanceThresholds",
  "persistenceAndFailure",
  "execution",
  "validity",
  "evidencePolicy",
  "authority",
  "requiredNextGate"
]);

const expectedParents = Object.freeze([
  Object.freeze({
    kind: "preregistration",
    path:
      "tinyrustlm/experiments/vector-quantization/" +
      "exact-flat-baseline-evidence-preregistration.v1.json",
    experimentId: "exact-flat-sealed-corpus-and-durable-deletion-20260725",
    sha256: "f6c1ac0d2c0f40365aca977aeccb894416185dc7069a97bb357510b94d94b4d1"
  }),
  Object.freeze({
    kind: "observation",
    path:
      "tinyrustlm/experiments/vector-quantization/" +
      "exact-flat-baseline-evidence-observation-v1.json",
    receiptId: "exact-flat-baseline-evidence-94aab53fab3f93b7",
    contentHash: "94aab53fab3f93b741490b095da58fd952cfa0122a58106c208fdfd4b8db46bb",
    sha256: "fa04d21ae35555b6a1d500eaf8569c5a7246c1bfde1f0bfc2e62812d6965c45c"
  }),
  Object.freeze({
    kind: "verification",
    path:
      "tinyrustlm/experiments/vector-quantization/" +
      "exact-flat-baseline-evidence-verification-v1.json",
    receiptId: "exact-flat-baseline-evidence-verification-6eb3d0e13fe60cbd",
    contentHash: "6eb3d0e13fe60cbde24fa1234d8e254506fc7d8a02a8ad6aca5a6735b8e6cdae",
    sha256: "9e745a77807524ad6bf2eff3aab0cf5b2a5a3c246c484698bb9ce108948a9fe1"
  })
]);

const expectedSectionSha256 = Object.freeze({
  parents: "d64075c3698c2b68c865b76ea519bcaa29ec5048f1102ff51e84df76a4cdd695",
  sourcePin: "2f4bfaccc37284d19518d481ef173176221102f0af928505937df2918d2336e2",
  sourceScreen: "732d00dc46a5fe29a384e6b6218bb42d61249102d3d00e9cd9cce0ab3cbe1153",
  build: "49f65e5fec2de864e87ded00cb10aa1bcced7891dce5a4fdf5d165f0dfafecd0",
  corpusReuse: "2c0118c6cf1a5fde5438fd73e9288d8a0869f125306ece0656aa3de84c041d4f",
  method: "1227378e3c13a0c13bb9a8862320b71965d90e728bddf40498235afca541365c",
  metricAdapters: "76ef9b8aae1342d6dabb69b3d4317ee1d202f3b6b0306fa627bf020f30a898ae",
  byteAccounting: "ba7499ea0a97399f206bad647bca54955ad145178377feabd2cc8ac1ce3151fd",
  groundTruth: "c0d40a07f3171e06e7194c3052ea213a404a50f11b6f03880a16e5553af20b56",
  qualityThresholds:
    "98f42d5fb309749c9c5edde4f7dc5a271a413b4e2c79cd5ef98e3e68a42c5a74",
  performanceThresholds:
    "a7179d560944ca4f072a0bba0624676fc354c5aa672f510022dbd6ff76c7ef8e",
  persistenceAndFailure:
    "5b33fb41069adde15706b3a550ca93bd714b2ec3a5d88c39bbf3b97a69b1daa3",
  execution: "1b4fd2b196ada4fa1633b7b3c1b463c242a812e08227522212fc89d6adb091e9",
  validity: "cd9c0ec5e28c62a7aa96cbfc5d7e4f60c4d829c6479559b899133fba5b5c8685",
  evidencePolicy:
    "3c5b01604a68f9f55016289860f9e171d82ddffad7d6035cd19883d2cf20990e",
  authority: "58b75d9bcb93d95fad422c5d2c807262fedb3eb73715220d991f767e46067cb7",
  requiredNextGate:
    "bdd7cd39ff4278b1953b3371c1f5af71e8aefd1d5e26fa3dc5a38b46739f8814"
});

const expectedAuthority = Object.freeze({
  turbovec090NativeReferenceBehaviorMayBeClaimed: true,
  sameCorpusCompressedRankQualityMayBeClaimed: true,
  equalDynamicIndexByteCapacityUtilityMayBeClaimed: true,
  completeDynamicIndexByteReductionMayBeClaimed: true,
  nativeReferencePerformanceMayBeClaimed: true,
  wrapperProcessCrashRecoveryMayBeClaimed: true,
  upstreamPersistenceSafetyMayBeClaimed: false,
  turboQuantPaperConformanceMayBeClaimed: false,
  sourceAlgorithmIndependentReproductionMayBeClaimed: false,
  wasmCompatibilityMayBeClaimed: false,
  browserPerformanceMayBeClaimed: false,
  representativeSemanticMemoryQualityMayBeClaimed: false,
  powerLossDurabilityMayBeClaimed: false,
  filesystemForensicErasureMayBeClaimed: false,
  directProductDependencyAdoptionMayBeClaimed: false,
  productIntegrationMayBeClaimed: false,
  trainingMayBeAuthorized: false,
  releaseMayBeAuthorized: false
});

const expectedLanes = Object.freeze([
  Object.freeze({
    laneId: "fashion-mnist-euclidean-784",
    laneKind: "natural",
    metric: "squared-euclidean",
    originalDimension: 784,
    encodedDimension: 792,
    recordCount: 2000,
    queryCount: 200,
    metricAdapter: "euclidean-to-mips-v1",
    calibrationMode: "tqplus-fitted-first-single-add",
    candidateDynamicIndexBytes: 822354,
    capacityMatchedExactRecordCount: 260,
    capacityMatchedExactIndexBytes: 819800
  }),
  Object.freeze({
    laneId: "fashion-mnist-cosine-784",
    laneKind: "natural",
    metric: "cosine",
    originalDimension: 784,
    encodedDimension: 784,
    recordCount: 2000,
    queryCount: 200,
    metricAdapter: "identity-normalized-dot-v1",
    calibrationMode: "tqplus-fitted-first-single-add",
    candidateDynamicIndexBytes: 814290,
    capacityMatchedExactRecordCount: 258,
    capacityMatchedExactIndexBytes: 813496
  }),
  Object.freeze({
    laneId: "synthetic-dot-128",
    laneKind: "synthetic",
    metric: "dot-product",
    originalDimension: 128,
    encodedDimension: 128,
    recordCount: 1200,
    queryCount: 120,
    metricAdapter: "identity-dot-v1",
    calibrationMode: "tqplus-fitted-first-single-add",
    candidateDynamicIndexBytes: 92242,
    capacityMatchedExactRecordCount: 174,
    capacityMatchedExactIndexBytes: 92152
  }),
  Object.freeze({
    laneId: "synthetic-cosine-384",
    laneKind: "synthetic",
    metric: "cosine",
    originalDimension: 384,
    encodedDimension: 384,
    recordCount: 1200,
    queryCount: 120,
    metricAdapter: "identity-normalized-dot-v1",
    calibrationMode: "tqplus-fitted-first-single-add",
    candidateDynamicIndexBytes: 247890,
    capacityMatchedExactRecordCount: 159,
    capacityMatchedExactIndexBytes: 247048
  }),
  Object.freeze({
    laneId: "synthetic-euclidean-768",
    laneKind: "synthetic",
    metric: "squared-euclidean",
    originalDimension: 768,
    encodedDimension: 776,
    recordCount: 1200,
    queryCount: 120,
    metricAdapter: "euclidean-to-mips-v1",
    calibrationMode: "tqplus-fitted-first-single-add",
    candidateDynamicIndexBytes: 486226,
    capacityMatchedExactRecordCount: 157,
    capacityMatchedExactIndexBytes: 485096
  }),
  Object.freeze({
    laneId: "controlled-memory-cosine-64",
    laneKind: "controlled-memory",
    metric: "cosine",
    originalDimension: 64,
    encodedDimension: 64,
    recordCount: 120,
    queryCount: 30,
    metricAdapter: "identity-normalized-dot-v1",
    calibrationMode: "identity-below-upstream-1000-sample-floor",
    candidateDynamicIndexBytes: 5810,
    capacityMatchedExactRecordCount: 20,
    capacityMatchedExactIndexBytes: 5720
  })
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are invalid`
  );
}

function exactValue(value, expected, label) {
  invariant(JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalManifestBytes(manifest) {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function sectionSha256(value) {
  return sha256(Buffer.from(JSON.stringify(value), "utf8"));
}

function validateFrozenSection(manifest, name) {
  invariant(
    sectionSha256(manifest[name]) === expectedSectionSha256[name],
    `${name} contract is invalid`
  );
}

function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const hash = crypto.createHash("sha256");
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

function resolveRepositoryFile(relativePath, label) {
  invariant(relativePathPattern.test(relativePath), `${label} path is unsafe`);
  const resolved = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `${label} escaped repository root`
  );
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file`);
  return resolved;
}

function validateParents(parents) {
  invariant(Array.isArray(parents), "parents must be an array");
  exactValue(parents, expectedParents, "parents");
  exactKeys(parents[0], ["kind", "path", "experimentId", "sha256"], "parents[0]");
  for (const index of [1, 2]) {
    exactKeys(
      parents[index],
      ["kind", "path", "receiptId", "contentHash", "sha256"],
      `parents[${index}]`
    );
  }
  for (const [index, parent] of parents.entries()) {
    invariant(relativePathPattern.test(parent.path), `parents[${index}].path is unsafe`);
    invariant(sha256Pattern.test(parent.sha256), `parents[${index}].sha256 is invalid`);
    if (index > 0) {
      invariant(
        sha256Pattern.test(parent.contentHash),
        `parents[${index}].contentHash is invalid`
      );
    }
  }
  validateFrozenSection({ parents }, "parents");
}

function validateSourcePin(sourcePin) {
  exactKeys(sourcePin, ["claimLedger", "crate", "dependencyPolicy"], "sourcePin");
  exactKeys(sourcePin.claimLedger, ["path", "ledgerId", "sha256"],
    "sourcePin.claimLedger");
  invariant(relativePathPattern.test(sourcePin.claimLedger.path),
    "sourcePin.claimLedger.path is unsafe");
  invariant(sourcePin.claimLedger.ledgerId === "turbovec-turboquant-review-20260722",
    "sourcePin claim ledger identity is invalid");
  invariant(sha256Pattern.test(sourcePin.claimLedger.sha256),
    "sourcePin claim ledger hash is invalid");

  exactKeys(sourcePin.crate, [
    "sourceId", "name", "version", "registry", "artifactUrl", "artifactBytes",
    "artifactSha256", "vcsRevision", "vcsInfoSha256", "cargoTomlSha256",
    "cargoTomlOrigSha256", "upstreamCargoLockSha256", "licenseExpression",
    "licenseUrl", "licenseSha256", "repositoryArchiveUrl", "repositoryArchiveBytes",
    "repositoryArchiveSha256", "externalArtifactLocatorEnvironmentVariable",
    "externalArtifactPathMayEnterEvidence", "externalSourceBytesMayEnterRepository",
    "sourceCodeCopyingAllowed", "testVectorCopyingAllowed", "role"
  ], "sourcePin.crate");
  invariant(sourcePin.crate.name === "turbovec" && sourcePin.crate.version === "0.9.0",
    "sourcePin crate package identity is invalid");
  invariant(sourcePin.crate.vcsRevision ===
    "1e7200cfd8f26c92ce2855652db64bc7f85bc039",
  "sourcePin crate revision is invalid");
  invariant(sourcePin.crate.artifactBytes === 89523 &&
    sourcePin.crate.repositoryArchiveBytes === 549022,
  "sourcePin artifact sizes are invalid");
  for (const field of [
    "artifactSha256", "vcsInfoSha256", "cargoTomlSha256", "cargoTomlOrigSha256",
    "upstreamCargoLockSha256", "licenseSha256", "repositoryArchiveSha256"
  ]) {
    invariant(sha256Pattern.test(sourcePin.crate[field]),
      `sourcePin.crate.${field} is invalid`);
  }
  invariant(sourcePin.crate.licenseExpression === "MIT",
    "sourcePin crate license is invalid");
  invariant(sourcePin.crate.externalArtifactLocatorEnvironmentVariable ===
    "TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE",
  "sourcePin external locator is invalid");
  for (const field of [
    "externalArtifactPathMayEnterEvidence", "externalSourceBytesMayEnterRepository",
    "sourceCodeCopyingAllowed", "testVectorCopyingAllowed"
  ]) {
    invariant(sourcePin.crate[field] === false, `sourcePin.crate.${field} must remain false`);
  }

  exactKeys(sourcePin.dependencyPolicy, [
    "wrapperDependencyRequirement", "committedCargoLockRequired",
    "registryChecksumMustMatchArtifactSha256", "offlineLockedObservationBuildRequired",
    "resolvedPackageCountObservedDuringSourceScreen",
    "rootNormalDependencyCountObservedDuringSourceScreen",
    "resolvedPackagesMissingLicenseMetadata", "transitiveLegalApprovalForProductUse",
    "directProductDependencyAdoptionAllowed"
  ], "sourcePin.dependencyPolicy");
  invariant(sourcePin.dependencyPolicy.wrapperDependencyRequirement ===
    "turbovec = \"=0.9.0\"",
  "sourcePin wrapper dependency is invalid");
  invariant(sourcePin.dependencyPolicy.committedCargoLockRequired === true &&
    sourcePin.dependencyPolicy.registryChecksumMustMatchArtifactSha256 === true &&
    sourcePin.dependencyPolicy.offlineLockedObservationBuildRequired === true,
  "sourcePin locked dependency policy is invalid");
  invariant(sourcePin.dependencyPolicy.transitiveLegalApprovalForProductUse === false &&
    sourcePin.dependencyPolicy.directProductDependencyAdoptionAllowed === false,
  "sourcePin product dependency authority is invalid");
  validateFrozenSection({ sourcePin }, "sourcePin");
}

function validateSourceScreen(sourceScreen) {
  exactKeys(sourceScreen, [
    "scope", "qualityCorpusExecuted", "compressedComparisonImplemented",
    "compressedComparisonResultsObserved", "nativeCheck", "wasmCheck", "apiFacts",
    "knownSourceWarningsAreNotWaived",
    "nativeScreenDoesNotAuthorizeQualityPerformanceWasmOrProductClaims"
  ], "sourceScreen");
  exactKeys(sourceScreen.nativeCheck, [
    "target", "rustcVersion", "cargoVersion", "command", "exitCode",
    "upstreamWarningCount", "evidenceClass"
  ], "sourceScreen.nativeCheck");
  exactKeys(sourceScreen.wasmCheck, [
    "target", "command", "exitCode", "blockerCode", "failureClass",
    "directBrowserCompatibilityObserved", "downstreamFeatureOverrideTested"
  ], "sourceScreen.wasmCheck");
  exactKeys(sourceScreen.apiFacts, [
    "acceptedBitWidths", "dimensionMustBePositiveMultipleOf8", "maximumDimension",
    "stableExternalIdsAvailable", "allowlistFilteringAvailable",
    "swapRemoveDeletionAvailable", "searchObjective",
    "builtInSquaredEuclideanObjectiveAvailable", "builtInCosineObjectiveAvailable",
    "persistenceFormat", "persistenceContainsCryptographicDigest",
    "persistenceWriterCallsSyncAll", "persistenceWriterUsesAtomicReplace"
  ], "sourceScreen.apiFacts");
  invariant(sourceScreen.qualityCorpusExecuted === false &&
    sourceScreen.compressedComparisonImplemented === false &&
    sourceScreen.compressedComparisonResultsObserved === false,
  "sourceScreen crossed the preregistration boundary");
  invariant(sourceScreen.nativeCheck.exitCode === 0 &&
    sourceScreen.nativeCheck.target === "x86_64-pc-windows-msvc",
  "sourceScreen native feasibility is invalid");
  invariant(sourceScreen.wasmCheck.exitCode === 1 &&
    sourceScreen.wasmCheck.blockerCode === "UPSTREAM_GETRANDOM_JS_FEATURE_NOT_ENABLED" &&
    sourceScreen.wasmCheck.directBrowserCompatibilityObserved === false,
  "sourceScreen wasm blocker is invalid");
  invariant(sourceScreen.apiFacts.searchObjective === "maximum-inner-product" &&
    sourceScreen.apiFacts.builtInSquaredEuclideanObjectiveAvailable === false &&
    sourceScreen.apiFacts.persistenceContainsCryptographicDigest === false &&
    sourceScreen.apiFacts.persistenceWriterCallsSyncAll === false &&
    sourceScreen.apiFacts.persistenceWriterUsesAtomicReplace === false,
  "sourceScreen API or persistence boundary is invalid");
  validateFrozenSection({ sourceScreen }, "sourceScreen");
}

function validateBuild(build) {
  exactKeys(build, [
    "comparisonManifest", "comparisonLock", "benchmarkSource",
    "observationRunnerSource", "verificationRunnerSource", "exactFlatLibraryManifest",
    "exactFlatLibrarySource", "binaryOutput", "buildCommand", "target", "profile",
    "wrapperWarningsAllowed", "upstreamWarningsMustBeReported",
    "unsafeCodeInWrapperAllowed", "workspaceManifestMutationAllowed",
    "productSourceMutationAllowed", "exactFlatSourceMutationAllowed",
    "upstreamSourceMutationAllowed", "thirdPartySourceVendoringAllowed",
    "productImportAllowed", "wasmBuildClaimAllowed"
  ], "build");
  exactKeys(build.profile,
    ["optLevel", "lto", "codegenUnits", "overflowChecks", "debug"],
    "build.profile");
  for (const field of [
    "comparisonManifest", "comparisonLock", "benchmarkSource",
    "observationRunnerSource", "verificationRunnerSource", "exactFlatLibraryManifest",
    "exactFlatLibrarySource"
  ]) {
    invariant(relativePathPattern.test(build[field]), `build.${field} is unsafe`);
  }
  invariant(build.target === "x86_64-pc-windows-msvc" &&
    build.wrapperWarningsAllowed === 0 && build.upstreamWarningsMustBeReported === true,
  "build target or warning policy is invalid");
  for (const field of [
    "unsafeCodeInWrapperAllowed", "workspaceManifestMutationAllowed",
    "productSourceMutationAllowed", "exactFlatSourceMutationAllowed",
    "upstreamSourceMutationAllowed", "thirdPartySourceVendoringAllowed",
    "productImportAllowed", "wasmBuildClaimAllowed"
  ]) {
    invariant(build[field] === false, `build.${field} must remain false`);
  }
  validateFrozenSection({ build }, "build");
}

function candidateBytes(lane) {
  return 18 + (lane.recordCount * lane.encodedDimension * 4) / 8 +
    12 * lane.recordCount + 8 * lane.encodedDimension;
}

function exactBytes(dimension, recordCount) {
  return 280 + recordCount * (16 + 4 * dimension);
}

function validateCorpusReuse(corpusReuse) {
  exactKeys(corpusReuse, [
    "parentExperimentId", "selectionAlgorithm", "selectionSeed", "selectionSha256",
    "selectedRecordAndQueryIdentitiesMustMatchParent", "selectedIndicesMayEnterEvidence",
    "rawVectorsMayEnterEvidence", "rawImagesMayEnterEvidence", "rawTextMayEnterEvidence",
    "recordInsertionOrder", "queryOrder", "lanes"
  ], "corpusReuse");
  invariant(corpusReuse.parentExperimentId ===
    "exact-flat-sealed-corpus-and-durable-deletion-20260725" &&
    corpusReuse.selectionSha256 ===
      "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd",
  "corpusReuse parent or selection identity is invalid");
  invariant(corpusReuse.selectedRecordAndQueryIdentitiesMustMatchParent === true &&
    corpusReuse.selectedIndicesMayEnterEvidence === false &&
    corpusReuse.rawVectorsMayEnterEvidence === false &&
    corpusReuse.rawImagesMayEnterEvidence === false &&
    corpusReuse.rawTextMayEnterEvidence === false,
  "corpusReuse privacy or identity policy is invalid");
  invariant(Array.isArray(corpusReuse.lanes) && corpusReuse.lanes.length === 6,
    "corpusReuse must contain six lanes");
  const laneKeys = Object.keys(expectedLanes[0]);
  for (const [index, lane] of corpusReuse.lanes.entries()) {
    exactKeys(lane, laneKeys, `corpusReuse.lanes[${index}]`);
    invariant(lane.encodedDimension > 0 && lane.encodedDimension % 8 === 0,
      `corpusReuse.lanes[${index}] encoded dimension is invalid`);
    invariant(candidateBytes(lane) === lane.candidateDynamicIndexBytes,
      `corpusReuse.lanes[${index}] candidate byte formula is invalid`);
    invariant(exactBytes(lane.originalDimension, lane.capacityMatchedExactRecordCount) ===
      lane.capacityMatchedExactIndexBytes,
    `corpusReuse.lanes[${index}] exact control byte formula is invalid`);
    invariant(lane.capacityMatchedExactIndexBytes <= lane.candidateDynamicIndexBytes,
      `corpusReuse.lanes[${index}] exact control exceeds budget`);
    invariant(exactBytes(lane.originalDimension,
      lane.capacityMatchedExactRecordCount + 1) > lane.candidateDynamicIndexBytes,
    `corpusReuse.lanes[${index}] exact control is not maximal under budget`);
    invariant(lane.candidateDynamicIndexBytes /
      exactBytes(lane.originalDimension, lane.recordCount) <= 0.2,
    `corpusReuse.lanes[${index}] persistent ratio exceeds the frozen limit`);
  }
  exactValue(corpusReuse.lanes, expectedLanes, "corpusReuse.lanes");
  validateFrozenSection({ corpusReuse }, "corpusReuse");
}

function validateMethod(method) {
  exactKeys(method, [
    "methodId", "indexType", "bitWidth", "codeCountPerCoordinate",
    "rotationAlgorithm", "rotationSeed", "codebookAlgorithm",
    "calibrationAlgorithm", "calibrationMinimumSampleCount", "calibrationBatch",
    "calibrationFrozenAfterFirstAdd", "perVectorCorrection", "packedCodeLayout",
    "topKValues", "searchUsesUpstreamTopKMembership", "searchOverfetchAllowed",
    "returnedMembershipRepairAllowed", "returnedScoreRepairAllowed",
    "returnedExactScoreTiesCanonicalizedByAscendingExternalId",
    "topKCutoffTieMembershipRemainsUpstreamBehavior", "sourceVectorRerankingAllowed",
    "reconstructionRerankingAllowed", "featureAblationAllowed",
    "secondBitWidthAllowed", "secondCompressedMethodAllowed", "bestOfNAllowed"
  ], "method");
  invariant(method.methodId ===
    "turbovec-crate-090-4bit-tqplus-native-reference" &&
    method.indexType === "turbovec::IdMapIndex" && method.bitWidth === 4 &&
    method.rotationSeed === 42 && method.calibrationMinimumSampleCount === 1000,
  "method identity or fixed parameters are invalid");
  exactValue(method.topKValues, [1, 10, 100], "method.topKValues");
  invariant(method.searchUsesUpstreamTopKMembership === true &&
    method.returnedExactScoreTiesCanonicalizedByAscendingExternalId === true &&
    method.topKCutoffTieMembershipRemainsUpstreamBehavior === true,
  "method membership or tie policy is invalid");
  for (const field of [
    "searchOverfetchAllowed", "returnedMembershipRepairAllowed",
    "returnedScoreRepairAllowed", "sourceVectorRerankingAllowed",
    "reconstructionRerankingAllowed", "featureAblationAllowed", "secondBitWidthAllowed",
    "secondCompressedMethodAllowed", "bestOfNAllowed"
  ]) {
    invariant(method[field] === false, `method.${field} must remain false`);
  }
  validateFrozenSection({ method }, "method");
}

function validateMetricAdapters(metricAdapters) {
  exactKeys(metricAdapters,
    ["dotProduct", "cosine", "squaredEuclidean", "allTransforms"],
    "metricAdapters");
  exactKeys(metricAdapters.dotProduct, [
    "recordTransform", "queryTransform", "encodedDimensionRule",
    "candidateScoreToDeclaredScore", "rankDirection"
  ], "metricAdapters.dotProduct");
  exactKeys(metricAdapters.cosine, [
    "recordTransform", "queryTransform", "encodedDimensionRule",
    "candidateScoreToDeclaredScore", "rankDirection"
  ], "metricAdapters.cosine");
  exactKeys(metricAdapters.squaredEuclidean, [
    "recordTransform", "queryTransform", "encodedDimensionRule",
    "candidateScoreToDeclaredScore", "rankDirection", "externalIdPreserved",
    "paddingCountsTowardEffectiveBytes"
  ], "metricAdapters.squaredEuclidean");
  exactKeys(metricAdapters.allTransforms, [
    "negativeZeroCanonicalized",
    "allCoordinatesMustRemainFiniteAndBelowUpstreamMagnitudeLimit",
    "transformFailureInvalidatesLane", "transformedCoordinatesMayEnterEvidence"
  ], "metricAdapters.allTransforms");
  invariant(metricAdapters.squaredEuclidean.externalIdPreserved === true &&
    metricAdapters.squaredEuclidean.paddingCountsTowardEffectiveBytes === true,
  "metricAdapters squared-Euclidean accounting is invalid");
  invariant(metricAdapters.allTransforms.transformFailureInvalidatesLane === true &&
    metricAdapters.allTransforms.transformedCoordinatesMayEnterEvidence === false,
  "metricAdapters transform failure or evidence policy is invalid");
  validateFrozenSection({ metricAdapters }, "metricAdapters");
}

function validateByteAccounting(byteAccounting) {
  exactKeys(byteAccounting, [
    "scope", "exactFlatFullIndexFormula", "candidateTvimFormula",
    "candidateFormulaTerms", "actualFileLengthMustEqualFormula",
    "effectiveBitsPerOriginalCoordinateFormula", "persistentRatioFormula",
    "maximumCandidateToFullExactPersistentRatioPerLane", "capacityMatchedControl",
    "separatelyReportedPersistentBytes", "separatelyReportedStaticBytes",
    "separatelyReportedRuntimeMemory", "temporarySnapshotBytesMustBeReported",
    "decodedF32ShadowAllowed", "hiddenSourceVectorSidecarAllowed",
    "nominalBitWidthMaySubstituteForEffectiveBytes",
    "sameCorpusComparisonMayBeCalledEqualByte"
  ], "byteAccounting");
  exactKeys(byteAccounting.candidateFormulaTerms, [
    "fixedMagicVersionHeaderAndCalibrationCountBytes",
    "packedCodeBitsPerEncodedCoordinate", "perVectorCorrectionBytes",
    "externalIdBytes", "tqplusShiftBytesPerEncodedCoordinate",
    "tqplusScaleBytesPerEncodedCoordinate"
  ], "byteAccounting.candidateFormulaTerms");
  exactKeys(byteAccounting.capacityMatchedControl, [
    "budget", "exactRecordCountFormula", "exactControlMustNotExceedBudget",
    "oneAdditionalExactRecordMustExceedBudget", "subsetAlgorithm",
    "subsetUsesOnlyParentSelectedRecords", "subsetMaySpecialCaseExpectedAnswersOrLabels",
    "queryIdentitiesMustMatchFullParent", "comparisonClaim"
  ], "byteAccounting.capacityMatchedControl");
  invariant(byteAccounting.actualFileLengthMustEqualFormula === true &&
    byteAccounting.maximumCandidateToFullExactPersistentRatioPerLane === 0.2 &&
    byteAccounting.capacityMatchedControl.exactControlMustNotExceedBudget === true &&
    byteAccounting.capacityMatchedControl.oneAdditionalExactRecordMustExceedBudget === true,
  "byteAccounting formulas or capacity budget are invalid");
  for (const field of [
    "decodedF32ShadowAllowed", "hiddenSourceVectorSidecarAllowed",
    "nominalBitWidthMaySubstituteForEffectiveBytes",
    "sameCorpusComparisonMayBeCalledEqualByte"
  ]) {
    invariant(byteAccounting[field] === false,
      `byteAccounting.${field} must remain false`);
  }
  validateFrozenSection({ byteAccounting }, "byteAccounting");
}

function validateGroundTruth(groundTruth) {
  exactKeys(groundTruth, [
    "implementation", "parentGroundTruthContractReused", "mayCallCandidateSearch",
    "mayReadCandidatePrivateState", "inputCoordinates", "scoreAccumulation",
    "tieBreak", "fullExactControl", "capacityMatchedExactControl", "rankMetrics",
    "scoreMetrics", "naturalUtilityMetrics", "controlledUtilityMetrics",
    "normalizedScoreErrorDenominator", "rawPerQueryMetricsRetained",
    "rawCandidateScoresRetained", "rawVectorsMayEnterEvidence",
    "rawImagesMayEnterEvidence", "rawTextMayEnterEvidence"
  ], "groundTruth");
  invariant(groundTruth.implementation ===
    "independent-benchmark-f64-exhaustive-scan-v1" &&
    groundTruth.parentGroundTruthContractReused === true &&
    groundTruth.mayCallCandidateSearch === false &&
    groundTruth.mayReadCandidatePrivateState === false,
  "groundTruth independence is invalid");
  invariant(groundTruth.rawPerQueryMetricsRetained === true &&
    groundTruth.rawCandidateScoresRetained === true &&
    groundTruth.rawVectorsMayEnterEvidence === false &&
    groundTruth.rawImagesMayEnterEvidence === false &&
    groundTruth.rawTextMayEnterEvidence === false,
  "groundTruth raw evidence policy is invalid");
  validateFrozenSection({ groundTruth }, "groundTruth");
}

function validateQualityThresholds(thresholds) {
  exactKeys(thresholds, [
    "sameCorpusAllLanes", "naturalLanes", "controlledMemoryLane",
    "capacityMatchedControl", "determinism", "resultDrivenChangesAllowed",
    "failedThresholdMayBeLowered", "qualityThresholdFailureMayBeRetried"
  ], "qualityThresholds");
  exactKeys(thresholds.sameCorpusAllLanes, [
    "minimumRecallAt1", "minimumRecallAt10", "minimumRecallAt100",
    "minimumMrrAt100", "minimumNdcgAt100", "maximumRankInversionRateAt100",
    "maximumMeanAbsoluteNormalizedScoreError",
    "maximumP99AbsoluteNormalizedScoreError", "nonFiniteCandidateScoresAllowed",
    "missingOrDuplicateResultsAllowed"
  ], "qualityThresholds.sameCorpusAllLanes");
  invariant(thresholds.sameCorpusAllLanes.minimumRecallAt1 === 0.7 &&
    thresholds.sameCorpusAllLanes.minimumRecallAt10 === 0.85 &&
    thresholds.sameCorpusAllLanes.minimumRecallAt100 === 0.95 &&
    thresholds.sameCorpusAllLanes.nonFiniteCandidateScoresAllowed === 0 &&
    thresholds.sameCorpusAllLanes.missingOrDuplicateResultsAllowed === 0,
  "qualityThresholds same-corpus gate is invalid");
  invariant(Array.isArray(thresholds.naturalLanes) &&
    thresholds.naturalLanes.length === 2,
  "qualityThresholds natural lane count is invalid");
  exactKeys(thresholds.controlledMemoryLane, [
    "minimumExpectedFirstHitRate", "maximumForbiddenHitRateAt10",
    "maximumDeletedHitCount", "maximumFilterViolationCount"
  ], "qualityThresholds.controlledMemoryLane");
  exactKeys(thresholds.capacityMatchedControl, [
    "candidateMustMeetOrExceedExactSubsetRecallAt1",
    "candidateMustMeetOrExceedExactSubsetRecallAt10",
    "candidateMustMeetOrExceedExactSubsetRecallAt100",
    "candidateMustMeetOrExceedExactSubsetMrrAt100",
    "candidateMustMeetOrExceedExactSubsetNdcgAt100",
    "comparisonRequiredForEveryLane"
  ], "qualityThresholds.capacityMatchedControl");
  exactKeys(thresholds.determinism, [
    "independentBuildCount", "candidateIndexBytesMustMatch",
    "candidateSearchOutputsMustMatch", "preAndPostReloadOutputsMustMatch"
  ], "qualityThresholds.determinism");
  invariant(thresholds.controlledMemoryLane.minimumExpectedFirstHitRate === 1 &&
    thresholds.controlledMemoryLane.maximumForbiddenHitRateAt10 === 0 &&
    thresholds.controlledMemoryLane.maximumDeletedHitCount === 0 &&
    thresholds.controlledMemoryLane.maximumFilterViolationCount === 0,
  "qualityThresholds controlled-memory gate is invalid");
  invariant(thresholds.determinism.independentBuildCount === 2 &&
    thresholds.determinism.candidateIndexBytesMustMatch === true &&
    thresholds.determinism.candidateSearchOutputsMustMatch === true &&
    thresholds.determinism.preAndPostReloadOutputsMustMatch === true,
  "qualityThresholds determinism gate is invalid");
  invariant(thresholds.resultDrivenChangesAllowed === false &&
    thresholds.failedThresholdMayBeLowered === false &&
    thresholds.qualityThresholdFailureMayBeRetried === false,
  "qualityThresholds weakening or retry is invalid");
  validateFrozenSection({ qualityThresholds: thresholds }, "qualityThresholds");
}

function validatePerformanceThresholds(thresholds) {
  exactKeys(thresholds, [
    "measurementTarget", "pairedProcessRepetitionCount", "methodOrder",
    "warmupFullQueryPasses", "measuredFullQueryPasses", "processesRunSerially",
    "datasetLoadAndSelectionExcludedFromBuildTimer", "metricAdapterTimeIncluded",
    "candidatePrepareTimeIncludedInColdFirstQuery", "topKHeapTimeIncluded",
    "idTranslationTimeIncluded", "buildSerializationAndLoadMeasuredSeparately",
    "requiredLatencyStatistics", "maximumMedianSteadyQueryLatencyRatioToExact",
    "maximumP95SteadyQueryLatencyRatioToExact", "maximumColdFirstQueryMilliseconds",
    "maximumBuildMilliseconds", "maximumPeakWorkingSetBytes",
    "maximumPeakWorkingSetRatioToExact", "maximumPostPrepareWorkingSetRatioToExact",
    "maximumCandidateToFullExactPersistentRatioPerLane",
    "comparisonExecutableBytesMustBeReported", "upstreamDependencyBytesMustBeReported",
    "energyMeasured", "energyClaimAllowed", "performanceOutcomeFailureMayBeRetried",
    "instrumentationFailureMayBeRetried"
  ], "performanceThresholds");
  invariant(thresholds.pairedProcessRepetitionCount === 5 &&
    thresholds.warmupFullQueryPasses === 5 &&
    thresholds.measuredFullQueryPasses === 5 &&
    thresholds.processesRunSerially === true,
  "performanceThresholds run schedule is invalid");
  invariant(thresholds.maximumMedianSteadyQueryLatencyRatioToExact === 1.25 &&
    thresholds.maximumP95SteadyQueryLatencyRatioToExact === 1.5 &&
    thresholds.maximumCandidateToFullExactPersistentRatioPerLane === 0.2,
  "performanceThresholds comparison limits are invalid");
  invariant(thresholds.energyMeasured === false && thresholds.energyClaimAllowed === false &&
    thresholds.performanceOutcomeFailureMayBeRetried === false &&
    thresholds.instrumentationFailureMayBeRetried === true,
  "performanceThresholds authority or retry policy is invalid");
  validateFrozenSection({ performanceThresholds: thresholds },
    "performanceThresholds");
}

function validatePersistenceAndFailure(persistence) {
  exactKeys(persistence, [
    "candidateCoreFormat", "candidateCoreFormatModified", "wrapperStorageDesign",
    "wrapperCryptographicHash", "wrapperMustVerifyExactFileLengthBeforeUpstreamLoad",
    "wrapperMustVerifySha256BeforeUpstreamLoad", "upstreamLoadMayReceiveUnverifiedBytes",
    "sameDirectoryTemporarySuffix", "fileSyncRequiredBeforeFinalize",
    "sameDirectoryAtomicFinalizeRequired", "directoryFlushAttemptRequired",
    "reopenAndValidateRequired", "deletionOperation", "deleteTargetSelection",
    "deleteTargetCount", "allowlistDensity", "allowlistSelection", "corruptionCases",
    "corruptionMustFailBeforeUpstreamLoad", "panicAllowed", "crashScenarios",
    "processCrashExitCode", "allCrashScenariosMustRecover", "retryMustBeIdempotent",
    "committedDeletedIdsMayRemainSearchable",
    "committedDeletedVectorFingerprintsMayRemainActive", "powerLossSimulated",
    "powerLossDurabilityClaimAllowed", "filesystemForensicErasureTested",
    "filesystemForensicErasureClaimAllowed", "upstreamPersistenceSafetyClaimAllowed",
    "wrapperProcessCrashRecoveryClaimMayBeEarned"
  ], "persistenceAndFailure");
  invariant(persistence.candidateCoreFormatModified === false &&
    persistence.wrapperMustVerifyExactFileLengthBeforeUpstreamLoad === true &&
    persistence.wrapperMustVerifySha256BeforeUpstreamLoad === true &&
    persistence.upstreamLoadMayReceiveUnverifiedBytes === false,
  "persistenceAndFailure upstream-load boundary is invalid");
  invariant(Array.isArray(persistence.corruptionCases) &&
    persistence.corruptionCases.length === 7 &&
    persistence.corruptionMustFailBeforeUpstreamLoad === true &&
    persistence.panicAllowed === false,
  "persistenceAndFailure corruption gate is invalid");
  invariant(Array.isArray(persistence.crashScenarios) &&
    persistence.crashScenarios.length === 4,
  "persistenceAndFailure crash scenario count is invalid");
  exactValue(persistence.crashScenarios, [
    {
      scenarioId: "after-snapshot-temp-sync-before-finalize",
      expectedActiveGeneration: 1,
      deletionCommitted: false
    },
    {
      scenarioId: "after-snapshot-finalize-before-commit-temp",
      expectedActiveGeneration: 1,
      deletionCommitted: false
    },
    {
      scenarioId: "after-commit-temp-sync-before-finalize",
      expectedActiveGeneration: 1,
      deletionCommitted: false
    },
    {
      scenarioId: "after-commit-finalize-before-obsolete-cleanup",
      expectedActiveGeneration: 2,
      deletionCommitted: true
    }
  ], "persistenceAndFailure.crashScenarios");
  invariant(persistence.processCrashExitCode === 74 &&
    persistence.allCrashScenariosMustRecover === true &&
    persistence.retryMustBeIdempotent === true &&
    persistence.committedDeletedIdsMayRemainSearchable === false &&
    persistence.committedDeletedVectorFingerprintsMayRemainActive === false,
  "persistenceAndFailure deletion or recovery gate is invalid");
  invariant(persistence.powerLossSimulated === false &&
    persistence.powerLossDurabilityClaimAllowed === false &&
    persistence.filesystemForensicErasureTested === false &&
    persistence.filesystemForensicErasureClaimAllowed === false &&
    persistence.upstreamPersistenceSafetyClaimAllowed === false,
  "persistenceAndFailure authority exceeds the registered experiment");
  validateFrozenSection({ persistenceAndFailure: persistence },
    "persistenceAndFailure");
}

function validateExecution(execution) {
  exactKeys(execution, [
    "networkPolicy", "parallelProcesses", "overallTimeoutMilliseconds",
    "perProcessTimeoutMilliseconds", "datasetHashBufferBytes", "crateHashBufferBytes",
    "requiredEnvironmentVariables", "environmentVariableValuesMayEnterEvidence",
    "temporaryRootsMustBeOutsideRepository", "temporaryRootMarkerRequired",
    "recursiveCleanupRequiresResolvedRootAndMarker", "stdoutContract",
    "stderrContract", "resultOrder", "outlierPolicy", "bestOfNAllowed",
    "resultRepairAllowed", "comparisonRunAllowedOnlyAfterPreregistrationCommit",
    "implementationAndTestsMustBeCommittedBeforeObservation",
    "observationWriteRequiresExplicitWriteFlag",
    "sourceScreenMayNotBeCountedAsComparisonExecution"
  ], "execution");
  invariant(execution.networkPolicy === "deny-all-during-observation" &&
    execution.parallelProcesses === 1,
  "execution network or process policy is invalid");
  exactValue(execution.requiredEnvironmentVariables, [
    "TINYRUSTLM_FASHION_MNIST_ROOT",
    "TINYRUSTLM_TURBOVEC_CRATE_ARCHIVE"
  ], "execution.requiredEnvironmentVariables");
  invariant(execution.environmentVariableValuesMayEnterEvidence === false &&
    execution.temporaryRootsMustBeOutsideRepository === true &&
    execution.temporaryRootMarkerRequired === true &&
    execution.recursiveCleanupRequiresResolvedRootAndMarker === true,
  "execution private locator or temporary-root policy is invalid");
  invariant(execution.bestOfNAllowed === false && execution.resultRepairAllowed === false &&
    execution.comparisonRunAllowedOnlyAfterPreregistrationCommit === true &&
    execution.implementationAndTestsMustBeCommittedBeforeObservation === true &&
    execution.observationWriteRequiresExplicitWriteFlag === true &&
    execution.sourceScreenMayNotBeCountedAsComparisonExecution === true,
  "execution result boundary is invalid");
  validateFrozenSection({ execution }, "execution");
}

function validateValidity(validity) {
  exactKeys(validity, [
    "allParentBytesAndContentHashesMustMatch", "claimLedgerMustMatch",
    "crateArchiveHashSizeVersionAndVcsRevisionMustMatch",
    "committedLockedDependencyGraphMustMatch", "offlineBuildMustSucceed",
    "selectedCorpusAndQueriesMustMatchParent", "allSixLanesMustComplete",
    "allPerQueryMetricsMustBeRetained", "allQualityThresholdsMustPass",
    "allPerformanceThresholdsMustPass", "allByteFormulasMustMatchActualFiles",
    "allCapacityMatchedControlsMustBeMaximalUnderBudget",
    "bothDeterminismBuildsMustMatch", "allCorruptionCasesMustRejectBeforeUpstreamLoad",
    "allFourCrashScenariosMustRecoverToExpectedGeneration",
    "committedDeletionMustRemainDeletedAfterRestart",
    "ownedTemporaryRootsMustBePhysicallyDeleted",
    "toolSourceBinaryDatasetAndCrateHashesRequired",
    "directWasmBuildRequiredForNativeReferenceValidity",
    "directWasmFailureMustRemainAnOpenProductBlocker",
    "infrastructureFailuresMayBeRetried", "qualityThresholdFailuresMayBeRetried",
    "performanceOutcomeFailuresMayBeRetried", "deletionSemanticFailuresMayBeRetried",
    "resultDrivenThresholdChangesAllowed"
  ], "validity");
  for (const field of [
    "allParentBytesAndContentHashesMustMatch", "claimLedgerMustMatch",
    "crateArchiveHashSizeVersionAndVcsRevisionMustMatch",
    "committedLockedDependencyGraphMustMatch", "offlineBuildMustSucceed",
    "selectedCorpusAndQueriesMustMatchParent", "allSixLanesMustComplete",
    "allPerQueryMetricsMustBeRetained", "allQualityThresholdsMustPass",
    "allPerformanceThresholdsMustPass", "allByteFormulasMustMatchActualFiles",
    "allCapacityMatchedControlsMustBeMaximalUnderBudget",
    "bothDeterminismBuildsMustMatch", "allCorruptionCasesMustRejectBeforeUpstreamLoad",
    "allFourCrashScenariosMustRecoverToExpectedGeneration",
    "committedDeletionMustRemainDeletedAfterRestart",
    "ownedTemporaryRootsMustBePhysicallyDeleted",
    "toolSourceBinaryDatasetAndCrateHashesRequired",
    "directWasmFailureMustRemainAnOpenProductBlocker",
    "infrastructureFailuresMayBeRetried"
  ]) {
    invariant(validity[field] === true, `validity.${field} must remain true`);
  }
  invariant(validity.directWasmBuildRequiredForNativeReferenceValidity === false,
    "validity native reference improperly requires wasm");
  for (const field of [
    "qualityThresholdFailuresMayBeRetried", "performanceOutcomeFailuresMayBeRetried",
    "deletionSemanticFailuresMayBeRetried", "resultDrivenThresholdChangesAllowed"
  ]) {
    invariant(validity[field] === false, `validity.${field} must remain false`);
  }
  validateFrozenSection({ validity }, "validity");
}

function validateEvidencePolicy(policy) {
  exactKeys(policy, [
    "attemptsAreImmutable", "failedAttemptsArePreserved", "attemptDirectory",
    "successfulObservationPath", "verificationReceiptPath", "externalCrateBytesAllowed",
    "externalRepositoryBytesAllowed", "selectedIndicesAllowed", "rawVectorsAllowed",
    "rawImagesAllowed", "rawTextAllowed", "privateAbsolutePathsAllowed",
    "credentialsAllowed", "modelBytesAllowed",
    "publicPackageIdsHashesVersionsSizesCommandsAndBoundedErrorsAllowed"
  ], "evidencePolicy");
  invariant(policy.attemptsAreImmutable === true && policy.failedAttemptsArePreserved === true,
    "evidencePolicy immutable attempt history is invalid");
  for (const field of [
    "attemptDirectory", "successfulObservationPath", "verificationReceiptPath"
  ]) {
    invariant(relativePathPattern.test(policy[field]), `evidencePolicy.${field} is unsafe`);
  }
  for (const field of [
    "externalCrateBytesAllowed", "externalRepositoryBytesAllowed", "selectedIndicesAllowed",
    "rawVectorsAllowed", "rawImagesAllowed", "rawTextAllowed",
    "privateAbsolutePathsAllowed", "credentialsAllowed", "modelBytesAllowed"
  ]) {
    invariant(policy[field] === false, `evidencePolicy.${field} must remain false`);
  }
  invariant(policy.publicPackageIdsHashesVersionsSizesCommandsAndBoundedErrorsAllowed === true,
    "evidencePolicy public package evidence is invalid");
  validateFrozenSection({ evidencePolicy: policy }, "evidencePolicy");
}

function validateManifest(manifest) {
  exactKeys(manifest, topLevelKeys, "manifest");
  invariant(manifest.schema === schema, "manifest schema is invalid");
  invariant(manifest.experimentId ===
    "turbovec-090-4bit-tqplus-reference-comparison-20260725",
  "manifest experimentId is invalid");
  invariant(utcPattern.test(manifest.registeredAtUtc) &&
    Number.isFinite(Date.parse(manifest.registeredAtUtc)) &&
    manifest.registeredAtUtc === "2026-07-25T22:11:00Z",
  "manifest registration time is invalid");
  invariant(manifest.status ===
    "preregistered-after-source-screen-before-comparison-implementation-or-results",
  "manifest status is invalid");
  invariant(!forbiddenTextPattern.test(JSON.stringify(manifest)),
    "manifest contains a private path, credential, or internal citation");

  validateParents(manifest.parents);
  validateSourcePin(manifest.sourcePin);
  validateSourceScreen(manifest.sourceScreen);
  validateBuild(manifest.build);
  validateCorpusReuse(manifest.corpusReuse);
  validateMethod(manifest.method);
  validateMetricAdapters(manifest.metricAdapters);
  validateByteAccounting(manifest.byteAccounting);
  validateGroundTruth(manifest.groundTruth);
  validateQualityThresholds(manifest.qualityThresholds);
  validatePerformanceThresholds(manifest.performanceThresholds);
  validatePersistenceAndFailure(manifest.persistenceAndFailure);
  validateExecution(manifest.execution);
  validateValidity(manifest.validity);
  validateEvidencePolicy(manifest.evidencePolicy);
  exactKeys(manifest.authority, Object.keys(expectedAuthority), "authority");
  exactValue(manifest.authority, expectedAuthority, "authority");
  validateFrozenSection(manifest, "authority");
  validateFrozenSection(manifest, "requiredNextGate");

  invariant(sha256(canonicalManifestBytes(manifest)) === expectedManifestSha256,
    "manifest contract is not the registered contract");
  return manifest;
}

function validateManifestFile(filePath = defaultPath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumManifestBytes, "manifest must be a bounded regular file");
  const bytes = fs.readFileSync(resolved);
  const manifest = validateManifest(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalManifestBytes(manifest)),
    "manifest bytes are not canonical pretty JSON");

  for (const [index, parent] of manifest.parents.entries()) {
    const parentPath = resolveRepositoryFile(parent.path, `parents[${index}]`);
    invariant(sha256File(parentPath) === parent.sha256,
      `parent hash drifted: ${parent.path}`);
    if (index === 1) {
      const parentJson = JSON.parse(fs.readFileSync(parentPath, "utf8"));
      invariant(parentJson.observationId === parent.receiptId &&
        parentJson.observationContentHash === parent.contentHash,
      "observation parent content identity drifted");
    }
    if (index === 2) {
      const parentJson = JSON.parse(fs.readFileSync(parentPath, "utf8"));
      invariant(parentJson.receiptId === parent.receiptId &&
        parentJson.receiptContentHash === parent.contentHash,
      "verification parent content identity drifted");
    }
  }

  const ledgerPath = resolveRepositoryFile(
    manifest.sourcePin.claimLedger.path,
    "sourcePin.claimLedger"
  );
  invariant(sha256File(ledgerPath) === manifest.sourcePin.claimLedger.sha256,
    "claim ledger hash drifted");
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  invariant(ledger.ledgerId === manifest.sourcePin.claimLedger.ledgerId,
    "claim ledger identity drifted");
  const crateSource = ledger.sources.find(
    (source) => source.sourceId === manifest.sourcePin.crate.sourceId
  );
  invariant(crateSource !== undefined, "claim ledger is missing the crate source");
  invariant(crateSource.publicationVersion === "crates.io:turbovec:0.9.0" &&
    crateSource.repositoryRevision === manifest.sourcePin.crate.vcsRevision &&
    crateSource.artifactBytes === manifest.sourcePin.crate.artifactBytes &&
    crateSource.artifactSha256 === manifest.sourcePin.crate.artifactSha256 &&
    crateSource.licenseIdentity === manifest.sourcePin.crate.licenseExpression &&
    crateSource.licenseArtifactSha256 === manifest.sourcePin.crate.licenseSha256,
  "claim ledger crate source drifted");

  return Object.freeze({
    manifest,
    path: path.relative(repositoryRoot, resolved).replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: sha256(bytes)
  });
}

if (require.main === module) {
  try {
    const result = validateManifestFile(process.argv[2] || defaultPath);
    process.stdout.write(`${JSON.stringify({
      schema: result.manifest.schema,
      experimentId: result.manifest.experimentId,
      methodId: result.manifest.method.methodId,
      bitWidth: result.manifest.method.bitWidth,
      laneCount: result.manifest.corpusReuse.lanes.length,
      nativeTarget: result.manifest.build.target,
      directWasmCompatibilityObserved:
        result.manifest.sourceScreen.wasmCheck.directBrowserCompatibilityObserved,
      sourceScreenExecutedComparison: false,
      sha256: result.sha256,
      status: "valid"
    })}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "manifest validation failed"}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  defaultPath,
  expectedAuthority,
  expectedLanes,
  expectedManifestSha256,
  expectedParents,
  schema,
  validateManifest,
  validateManifestFile
});
